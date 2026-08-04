import { clmToST, buildTagIndexMap } from "./clm/clmToST.js";
import { runtimeStore } from "./runtimeStore.js";
import { logicStore } from "./logicStore.js";
import * as ipcService from "../../../runtimeProcessManagerService.js";
const OPENPLC_BASE_URL = "https://localhost:8443";
const OPENPLC_PORT = 8443;
const COMPILE_POLL_INTERVAL_MS = 500;
const COMPILE_TIMEOUT_MS = 12e4;
const DEBUG_POLL_INTERVAL_MS = 500;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2e3;
function iecToDebugType(dt) {
  switch (dt) {
    case "BOOL":
      return "BOOL";
    case "INT":
    case "UINT":
      return "INT";
    case "DINT":
    case "UDINT":
      return "DINT";
    case "REAL":
    case "LREAL":
      return "REAL";
    case "WORD":
    case "BYTE":
    case "DWORD":
      return "WORD";
    default:
      return "INT";
  }
}
function be16(n) {
  return [n >> 8 & 255, n & 255];
}
function le16(n) {
  return [n & 255, n >> 8 & 255];
}
function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}
function hexToBytes(hex) {
  return hex.trim().split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16));
}
function buildGetListCommand(arrayIdx, elemIndexes) {
  return bytesToHex([
    68,
    ...be16(elemIndexes.length),
    ...elemIndexes.flatMap((e) => [arrayIdx, ...be16(e)])
  ]);
}
function buildForceCommand(arrayIdx, elemIdx, type, value) {
  const bytes = [66, arrayIdx, ...be16(elemIdx)];
  switch (type) {
    case "BOOL":
      bytes.push(0, value ? 1 : 0);
      break;
    case "INT":
    case "WORD": {
      const v = Number(value) & 65535;
      bytes.push(1, ...le16(v));
      break;
    }
    case "DINT": {
      const v = Number(value) >>> 0;
      bytes.push(2, v & 255, v >> 8 & 255, v >> 16 & 255, v >> 24 & 255);
      break;
    }
    case "REAL": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, Number(value), true);
      const arr = new Uint8Array(buf);
      bytes.push(3, arr[0], arr[1], arr[2], arr[3]);
      break;
    }
  }
  return bytesToHex(bytes);
}
function parseGetListResponse(hex, tagIndexMap) {
  const bytes = hexToBytes(hex);
  const result = {};
  if (bytes.length < 10 || bytes[1] !== 126) return result;
  const responseSz = bytes[8] << 8 | bytes[9];
  if (responseSz === 0) return result;
  const indexToName = /* @__PURE__ */ new Map();
  for (const [name, idx] of tagIndexMap) {
    indexToName.set(idx, name);
  }
  let i = 10;
  let entryIdx = 0;
  while (i < bytes.length) {
    const typeByte = bytes[i];
    i++;
    const tagName = indexToName.get(entryIdx);
    switch (typeByte) {
      case 0: {
        if (i >= bytes.length) break;
        if (tagName) result[tagName] = bytes[i] !== 0;
        i++;
        entryIdx++;
        break;
      }
      case 1:
      // INT — 2 bytes LE
      case 4: {
        if (i + 2 > bytes.length) break;
        if (tagName) result[tagName] = bytes[i] | bytes[i + 1] << 8;
        i += 2;
        entryIdx++;
        break;
      }
      case 2: {
        if (i + 4 > bytes.length) break;
        if (tagName) result[tagName] = bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16 | bytes[i + 3] << 24 | 0;
        i += 4;
        entryIdx++;
        break;
      }
      case 3: {
        if (i + 4 > bytes.length) break;
        const raw = (bytes[i + 3] << 24 | bytes[i + 2] << 16 | bytes[i + 1] << 8 | bytes[i]) >>> 0;
        const buf = new ArrayBuffer(4);
        new DataView(buf).setUint32(0, raw, false);
        if (tagName) result[tagName] = new DataView(buf).getFloat32(0, false);
        i += 4;
        entryIdx++;
        break;
      }
      default:
        i = bytes.length;
    }
  }
  return result;
}
async function plcFetch(path, init = {}) {
  const url = `${OPENPLC_BASE_URL}${path}`;
  const method = init.method || "GET";
  const headers = init.headers;
  const body = init.body;
  const result = await ipcService.plcFetch(url, method, headers, body);
  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": "application/json" }
  });
}
class RuntimeProcessManager {
  constructor() {
    this.token = null;
    this.socket = null;
    // Socket.IO socket instance
    this.pollTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this._isRunning = false;
    this.currentDebugMap = null;
    this.tagIndexMap = /* @__PURE__ */ new Map();
    // tagName → elemIdx
    this.tagTypes = /* @__PURE__ */ new Map();
    // tagName → type
    this.debugArrayIdx = 0;
    // always 0 for our programs
    this._projectPath = null;
  }
  /** Set by the VS Code layer before calling runProgram. */
  setProjectPath(p) {
    this._projectPath = p;
  }
  get isRunning() {
    return this._isRunning;
  }
  // ─── Full pipeline: CLM → run PLC ─────────────────────────────────────────
  async runProgram(clm, programName = "program", cycleMs = 50) {
    runtimeStore.clearLog();
    runtimeStore.appendLog("info", "Starting compilation pipeline...");
    const stResult = clmToST(clm, cycleMs);
    console.error("[clmToST] Generated ST code:\n" + stResult.stCode);
    runtimeStore.appendLog("info", `Generated ST: ${stResult.tagCount} tags, ${stResult.rungCount} rungs`);
    if (stResult.warnings.length > 0) {
      stResult.warnings.forEach((w) => runtimeStore.appendLog("warn", w));
    }
    runtimeStore.setMatiecStatus("starting", "Validating...");
    const matiecResult = await this._validateWithMatIEC(stResult.stCode);
    if (!matiecResult.success) {
      runtimeStore.setMatiecStatus("error", void 0, matiecResult.errors.join("\n"));
      matiecResult.errors.forEach((e) => runtimeStore.appendLog("error", `MatIEC: ${e}`));
      throw new Error(`MatIEC validation failed: ${matiecResult.errors.join("; ")}`);
    }
    runtimeStore.setMatiecStatus("running", `PASS (${matiecResult.errors.length} errors)`);
    runtimeStore.appendLog("success", "MatIEC: PASS");
    runtimeStore.setStrucppStatus("starting", "Compiling...");
    const { zipBase64, debugMap, errors } = await this._compileWithStrucpp(
      stResult.stCodeForStrucpp,
      programName,
      cycleMs
    );
    if (!zipBase64) {
      runtimeStore.setStrucppStatus("error", void 0);
      errors.forEach((e) => runtimeStore.appendLog("error", `STruC++: ${e}`));
      throw new Error(`STruC++ compilation failed`);
    }
    const leafCount = debugMap.leaves?.length ?? 0;
    runtimeStore.setStrucppStatus("running", `${leafCount} variables`);
    runtimeStore.appendLog("success", `STruC++: compiled ${leafCount} variables`);
    this.currentDebugMap = debugMap;
    this.tagIndexMap = buildTagIndexMap(debugMap);
    this.tagTypes.clear();
    for (const tag of logicStore.getState().tagDatabase) {
      this.tagTypes.set(tag.name, iecToDebugType(tag.dataType));
    }
    runtimeStore.appendLog("info", "Step 3/5: Checking PLC webserver...");
    await this._ensureOpenPLCRunning();
    runtimeStore.appendLog("info", `Step 4/5: Logging in to OpenPLC...`);
    await this._loginOpenPLC();
    runtimeStore.appendLog("success", "Logged in to OpenPLC");
    const approxKb = (zipBase64.length * 3 / 4 / 1024).toFixed(1);
    runtimeStore.appendLog("info", `Uploading program.zip (~${approxKb} KB)...`);
    await this._uploadZip(zipBase64, programName);
    runtimeStore.appendLog("success", "Upload complete \u2014 waiting for g++ compile...");
    const compileResult = await this._waitForCompilation();
    if (compileResult.status !== "SUCCESS") {
      const logs = compileResult.logs.slice(-10).join("\n");
      runtimeStore.appendLog("error", `g++ compile failed:
${logs}`);
      throw new Error(`OpenPLC compilation failed`);
    }
    runtimeStore.appendLog("success", "g++ compile: SUCCESS");
    runtimeStore.appendLog("info", "Step 5/5: Starting PLC...");
    await this._startPLC();
    this._isRunning = true;
    this.reconnectAttempts = 0;
    runtimeStore.appendLog("success", `PLC running at ${cycleMs}ms cycle`);
    runtimeStore.appendLog("info", "Connecting debug stream...");
    try {
      const pollerResult = await ipcService.plcStartDebugPoller();
      if (pollerResult.ok) {
        runtimeStore.appendLog("success", "Debug stream connected");
      } else {
        runtimeStore.appendLog("warn", `Debug poller: ${pollerResult.error ?? "failed"}`);
      }
    } catch (e) {
      runtimeStore.appendLog("warn", `Debug poller error: ${e?.message ?? String(e)}`);
    }
    runtimeStore.setPlcRunning(true, this.tagIndexMap.size);
  }
  async stopProgram() {
    this._isRunning = false;
    this._stopDebugStream();
    if (this._projectPath) {
      try {
        await ipcService.plcStop();
      } catch {
      }
    } else {
      try {
        await this._loginOpenPLC();
        await plcFetch("/api/stop-plc", { headers: this._authHeaders() });
      } catch {
      }
    }
    runtimeStore.setPlcRunning(false);
    runtimeStore.appendLog("info", "PLC stopped");
  }
  // ─── MatIEC validation ────────────────────────────────────────────────────
  async _validateWithMatIEC(stCode) {
    return ipcService.plcCompileMatiec(stCode);
  }
  // ─── STruC++ in-process codegen ───────────────────────────────────────────
  async _compileWithStrucpp(stCodeForStrucpp, programName, _cycleMs) {
    const result = await ipcService.plcCompileStrucpp(stCodeForStrucpp, programName);
    if (result.errors?.length > 0 || !result.zipBase64) {
      return { zipBase64: null, debugMap: {}, errors: result.errors ?? ["strucpp failed"] };
    }
    const debugMap = result.debugMapJson ? JSON.parse(result.debugMapJson) : {};
    return { zipBase64: result.zipBase64, debugMap, errors: [] };
  }
  // ─── OpenPLC Runtime management ───────────────────────────────────────────
  async _ensureOpenPLCRunning() {
    runtimeStore.setOpenPLCStatus("starting", "Checking...");
    try {
      const r = await plcFetch("/api/version", { signal: AbortSignal.timeout(3e3) });
      if (r.ok) {
        runtimeStore.setOpenPLCStatus("running", `Port ${OPENPLC_PORT}`);
        runtimeStore.appendLog("success", `PLC webserver already running on port ${OPENPLC_PORT}`);
        return;
      }
    } catch {
    }
    if (this._projectPath) {
      runtimeStore.appendLog("info", "PLC webserver not running \u2014 starting it...");
      const result = await ipcService.plcStart(this._projectPath);
      if (!result.ok) {
        runtimeStore.setOpenPLCStatus("error", void 0, result.error ?? "plc:start failed");
        runtimeStore.appendLog("error", `Webserver start failed: ${result.error}`);
        throw new Error(result.error ?? "plc:start failed");
      }
      try {
        const r = await plcFetch("/api/version", { signal: AbortSignal.timeout(5e3) });
        if (r.ok) {
          runtimeStore.setOpenPLCStatus("running", `Port ${OPENPLC_PORT}`);
          runtimeStore.appendLog("success", "PLC webserver ready");
          return;
        }
      } catch {
      }
      runtimeStore.setOpenPLCStatus("error", void 0, "Webserver started but not responding");
      runtimeStore.appendLog("error", "Webserver process started but /api/version not responding");
      throw new Error("Webserver started but /api/version not responding");
    }
    const msg = "No workspace folder open. Open a folder containing your PLC project to run the simulator.";
    runtimeStore.setOpenPLCStatus("error", void 0, msg);
    runtimeStore.appendLog("error", msg);
    throw new Error(msg);
  }
  // ─── OpenPLC REST API ─────────────────────────────────────────────────────
  async _loginOpenPLC() {
    const result = await ipcService.plcGetToken();
    if (!result.ok || !result.token) {
      throw new Error(`OpenPLC login failed: ${result.error ?? "no token returned"}`);
    }
    this.token = result.token;
    runtimeStore.appendLog("success", "Auth token obtained");
  }
  _authHeaders() {
    return { "Authorization": `Bearer ${this.token ?? ""}` };
  }
  async _uploadZip(zipBase64, programName) {
    const result = await ipcService.plcUploadZip(zipBase64, `${programName}.zip`, this.token ?? "");
    if (!result.ok) throw new Error(`Upload failed (${result.status}): ${result.body}`);
    let data = {};
    try {
      data = JSON.parse(result.body);
    } catch {
    }
    if (data.UploadFileFail) throw new Error(`Upload rejected: ${data.UploadFileFail}`);
  }
  async _waitForCompilation() {
    const deadline = Date.now() + COMPILE_TIMEOUT_MS;
    let lastStatus = "";
    while (Date.now() < deadline) {
      const r = await plcFetch("/api/compilation-status", { headers: this._authHeaders() });
      if (!r.ok) throw new Error(`Compilation status check failed (${r.status})`);
      const data = await r.json();
      if (data.status !== lastStatus) {
        runtimeStore.appendLog("info", `g++ status: ${data.status}`);
        lastStatus = data.status;
      }
      if (data.status === "SUCCESS" || data.status === "FAILED") return data;
      await new Promise((res) => setTimeout(res, COMPILE_POLL_INTERVAL_MS));
    }
    throw new Error(`Compilation timed out after ${COMPILE_TIMEOUT_MS}ms`);
  }
  async _startPLC() {
    const r = await plcFetch("/api/start-plc", { method: "GET", headers: this._authHeaders() });
    if (!r.ok) throw new Error(`Failed to start PLC (${r.status})`);
    runtimeStore.appendLog("success", "PLC start command sent");
  }
  // ─── Socket.IO debug stream ───────────────────────────────────────────────
  _connectDebugStream() {
    this._stopDebugStream();
    if (!this.token || this.tagIndexMap.size === 0) return;
    let SocketIO;
    try {
      try {
        SocketIO = require("socket.io-client").io;
      } catch {
      }
      if (!SocketIO) {
        const path = require("path");
        SocketIO = require(path.join(__dirname, "../../../../../../../../../../../../volt.diy/node_modules/socket.io-client")).io;
      }
    } catch (e) {
      runtimeStore.appendLog("error", `socket.io-client not found: ${e.message}`);
      return;
    }
    this.socket = SocketIO(`${OPENPLC_BASE_URL}/api/debug`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: this.token },
      rejectUnauthorized: false,
      reconnection: false
    });
    this.socket.on("connect", () => {
      this.reconnectAttempts = 0;
      const tagCount = this.tagIndexMap.size;
      runtimeStore.setPlcRunning(true, tagCount);
      runtimeStore.appendLog("success", `Debug stream connected \u2014 monitoring ${tagCount} variables`);
      this._startPolling();
    });
    this.socket.on("debug_response", (data) => {
      if (!data.success || !data.data) return;
      try {
        const tagValues = parseGetListResponse(data.data, this.tagIndexMap);
        for (const [tagName, value] of Object.entries(tagValues)) {
          logicStore.updateTagLiveValue(tagName, String(value));
        }
      } catch {
      }
    });
    this.socket.on("connect_error", () => {
      this._scheduleReconnect();
    });
    this.socket.on("disconnect", () => {
      this._stopPolling();
      this._scheduleReconnect();
    });
  }
  _startPolling() {
    this._stopPolling();
    if (this.tagIndexMap.size === 0) return;
    const elemIndexes = Array.from(this.tagIndexMap.values());
    const cmd = buildGetListCommand(this.debugArrayIdx, elemIndexes);
    this.pollTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("debug_command", { command: cmd });
      }
    }, DEBUG_POLL_INTERVAL_MS);
  }
  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  _stopDebugStream() {
    this._stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    runtimeStore.setPlcRunning(false);
  }
  _scheduleReconnect() {
    if (!this._isRunning) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      runtimeStore.appendLog("error", "Debug stream: max reconnect attempts reached");
      runtimeStore.setOpenPLCStatus("error", void 0, "Debug stream disconnected");
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this._isRunning) this._connectDebugStream();
    }, delay);
  }
  // ─── Force / release tag ─────────────────────────────────────────────────
  forceTag(tagName, value) {
    const elemIdx = this.tagIndexMap.get(tagName);
    const tagType = this.tagTypes.get(tagName);
    if (elemIdx === void 0 || !tagType || !this.socket?.connected) return;
    const cmd = buildForceCommand(this.debugArrayIdx, elemIdx, tagType, value);
    this.socket.emit("debug_command", { command: cmd });
  }
  releaseTag(tagName) {
    const tagType = this.tagTypes.get(tagName);
    this.forceTag(tagName, tagType === "BOOL" ? false : 0);
  }
  // ─── Cleanup ─────────────────────────────────────────────────────────────
  destroy() {
    this._isRunning = false;
    this._stopDebugStream();
  }
}
const runtimeProcessManager = new RuntimeProcessManager();
export {
  runtimeProcessManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9ydW50aW1lUHJvY2Vzc01hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBSdW50aW1lIFByb2Nlc3MgTWFuYWdlclxuICogT3ducyB0aGUgbGlmZWN5Y2xlIG9mIGFsbCBQTEMgYmFja2VuZCBjb21wb25lbnRzOlxuICogICAxLiBNYXRJRUMgKGllYzJjKSAgICAgICAgICBcdTIwMTQgbmF0aXZlIGNoaWxkIHByb2Nlc3MsIFNUIFx1MjE5MiBDIHZhbGlkYXRpb25cbiAqICAgMi4gU1RydUMrKyBjb2RlZ2VuICAgICAgICAgXHUyMDE0IGluLXByb2Nlc3MgTm9kZS5qcyBtb2R1bGUsIFNUIFx1MjE5MiBDKysgKyBkZWJ1Zy1tYXBcbiAqICAgMy4gT3BlblBMQyBSdW50aW1lIHY0ICAgICAgXHUyMDE0IERvY2tlciBjb250YWluZXIgKG1hY09TKSwgbmF0aXZlIHByb2Nlc3MgKExpbnV4KVxuICpcbiAqIEJpbmFyeSBwcm90b2NvbCBidWcgbm90ZSAoY29uZmlybWVkIGZyb20gZGVidWdfaGFuZGxlci5jIHNvdXJjZSk6XG4gKiAgIC0gR0VUX0xJU1QgcmVxdWVzdCB1c2VzIEJJRy1FTkRJQU4gY291bnQgYW5kIDMtYnl0ZSBlbnRyaWVzIFthcnIsIGVsZW1faGksIGVsZW1fbG9dXG4gKiAgIC0gVGhlIHZvbHQuZGl5IG9wZW5wbGNDbGllbnQudHMgdXNlcyBsaXR0bGUtZW5kaWFuIDItYnl0ZSBlbnRyaWVzIFx1MjAxNCBETyBOT1QgY29weSB0aGF0XG4gKiAgIC0gQ29ycmVjdCBidWlsZGVyOiBidWlsZEdldExpc3RDb21tYW5kKCkgYmVsb3dcbiAqXG4gKiBEZWJ1Zy1tYXAgcGF0aCBmb3JtYXQgKGNvbmZpcm1lZCBmcm9tIHJlYWwgU1RydUMrKyBvdXRwdXQpOlxuICogICBcIklOU1QwLjxVUFBFUkNBU0VfVkFSTkFNRT5cIiBcdTIwMTQgdXNlIHJlc29sdmVUYWdEZWJ1Z0xlYWYoKSBmcm9tIGNsbVRvU1QudHNcbiAqXG4gKiBGaXJzdC1ydW4gbm90ZTpcbiAqICAgT3BlblBMQyB2NCBzdGFydHMgd2l0aCBhbiBlbXB0eSB1c2VyIERCLiBNdXN0IFBPU1QgL2FwaS9jcmVhdGUtdXNlciBvbiBmaXJzdCBsYXVuY2guXG4gKi9cblxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXZhci1yZXF1aXJlcyAqL1xuXG5pbXBvcnQgdHlwZSB7IENMTUdyYXBoIH0gZnJvbSAnLi9jbG0vZ3JhcGguanMnO1xuaW1wb3J0IHsgY2xtVG9TVCwgYnVpbGRUYWdJbmRleE1hcCB9IGZyb20gJy4vY2xtL2NsbVRvU1QuanMnO1xuaW1wb3J0IHR5cGUgeyBEZWJ1Z01hcCB9IGZyb20gJy4vY2xtL2NsbVRvU1QuanMnO1xuaW1wb3J0IHsgcnVudGltZVN0b3JlIH0gZnJvbSAnLi9ydW50aW1lU3RvcmUuanMnO1xuaW1wb3J0IHsgbG9naWNTdG9yZSB9IGZyb20gJy4vbG9naWNTdG9yZS5qcyc7XG5pbXBvcnQgdHlwZSB7IElFQ0RhdGFUeXBlIH0gZnJvbSAnLi9sb2dpY1N0b3JlLmpzJztcbmltcG9ydCAqIGFzIGlwY1NlcnZpY2UgZnJvbSAnLi4vLi4vLi4vcnVudGltZVByb2Nlc3NNYW5hZ2VyU2VydmljZS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb25zdGFudHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IE9QRU5QTENfQkFTRV9VUkwgPSAnaHR0cHM6Ly9sb2NhbGhvc3Q6ODQ0Myc7XG5jb25zdCBPUEVOUExDX1BPUlQgPSA4NDQzO1xuY29uc3QgQ09NUElMRV9QT0xMX0lOVEVSVkFMX01TID0gNTAwO1xuY29uc3QgQ09NUElMRV9USU1FT1VUX01TID0gMTIwXzAwMDtcbmNvbnN0IERFQlVHX1BPTExfSU5URVJWQUxfTVMgPSA1MDA7XG5jb25zdCBNQVhfUkVDT05ORUNUX0FUVEVNUFRTID0gNTtcbmNvbnN0IFJFQ09OTkVDVF9ERUxBWV9NUyA9IDIwMDA7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJRUMgdHlwZSBcdTIxOTIgZGVidWcgdHlwZSBtYXBwaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG50eXBlIERlYnVnVGFnVHlwZSA9ICdCT09MJyB8ICdJTlQnIHwgJ0RJTlQnIHwgJ1JFQUwnIHwgJ1dPUkQnO1xuXG5mdW5jdGlvbiBpZWNUb0RlYnVnVHlwZShkdDogSUVDRGF0YVR5cGUpOiBEZWJ1Z1RhZ1R5cGUge1xuICBzd2l0Y2ggKGR0KSB7XG4gICAgY2FzZSAnQk9PTCc6IHJldHVybiAnQk9PTCc7XG4gICAgY2FzZSAnSU5UJzogY2FzZSAnVUlOVCc6IHJldHVybiAnSU5UJztcbiAgICBjYXNlICdESU5UJzogY2FzZSAnVURJTlQnOiByZXR1cm4gJ0RJTlQnO1xuICAgIGNhc2UgJ1JFQUwnOiBjYXNlICdMUkVBTCc6IHJldHVybiAnUkVBTCc7XG4gICAgY2FzZSAnV09SRCc6IGNhc2UgJ0JZVEUnOiBjYXNlICdEV09SRCc6IHJldHVybiAnV09SRCc7XG4gICAgZGVmYXVsdDogcmV0dXJuICdJTlQnO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBCaW5hcnkgcHJvdG9jb2wgaGVscGVycyAoQ09SUkVDVCBcdTIwMTQgY29uZmlybWVkIGZyb20gZGVidWdfaGFuZGxlci5jKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gYmUxNihuOiBudW1iZXIpOiBudW1iZXJbXSB7XG4gIHJldHVybiBbKG4gPj4gOCkgJiAweGZmLCBuICYgMHhmZl07XG59XG5cbmZ1bmN0aW9uIGxlMTYobjogbnVtYmVyKTogbnVtYmVyW10ge1xuICByZXR1cm4gW24gJiAweGZmLCAobiA+PiA4KSAmIDB4ZmZdO1xufVxuXG5mdW5jdGlvbiBieXRlc1RvSGV4KGJ5dGVzOiBudW1iZXJbXSk6IHN0cmluZyB7XG4gIHJldHVybiBieXRlcy5tYXAoYiA9PiBiLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKS5qb2luKCcgJyk7XG59XG5cbmZ1bmN0aW9uIGhleFRvQnl0ZXMoaGV4OiBzdHJpbmcpOiBudW1iZXJbXSB7XG4gIHJldHVybiBoZXgudHJpbSgpLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLm1hcChoID0+IHBhcnNlSW50KGgsIDE2KSk7XG59XG5cbi8qKlxuICogQnVpbGQgRkMgMHg0NCBHRVRfTElTVCBjb21tYW5kLlxuICogRm9ybWF0IHBlciBkZWJ1Z19oYW5kbGVyLmM6IFsweDQ0LCBjb3VudF9oaSwgY291bnRfbG8sIGFycigxQiksIGVsZW1faGksIGVsZW1fbG8sIC4uLl1cbiAqIGFycmF5SWR4IGlzIDAgZm9yIHRoZSBzaW5nbGUgZmxhdCBhcnJheSBpbiBhbGwgb3VyIGdlbmVyYXRlZCBwcm9ncmFtcy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRHZXRMaXN0Q29tbWFuZChhcnJheUlkeDogbnVtYmVyLCBlbGVtSW5kZXhlczogbnVtYmVyW10pOiBzdHJpbmcge1xuICByZXR1cm4gYnl0ZXNUb0hleChbXG4gICAgMHg0NCxcbiAgICAuLi5iZTE2KGVsZW1JbmRleGVzLmxlbmd0aCksXG4gICAgLi4uZWxlbUluZGV4ZXMuZmxhdE1hcChlID0+IFthcnJheUlkeCwgLi4uYmUxNihlKV0pLFxuICBdKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBGQyAweDQyIERFQlVHX1NFVCBjb21tYW5kIChmb3JjZSBhIHZhcmlhYmxlIHZhbHVlKS5cbiAqIEZvcm1hdDogWzB4NDIsIGFycigxQiksIGVsZW1faGksIGVsZW1fbG8sIHR5cGVfYnl0ZSwgdmFsdWVfYnl0ZXMuLi5dXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkRm9yY2VDb21tYW5kKGFycmF5SWR4OiBudW1iZXIsIGVsZW1JZHg6IG51bWJlciwgdHlwZTogRGVidWdUYWdUeXBlLCB2YWx1ZTogYm9vbGVhbiB8IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGJ5dGVzOiBudW1iZXJbXSA9IFsweDQyLCBhcnJheUlkeCwgLi4uYmUxNihlbGVtSWR4KV07XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ0JPT0wnOlxuICAgICAgYnl0ZXMucHVzaCgweDAwLCB2YWx1ZSA/IDB4MDEgOiAweDAwKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0lOVCc6XG4gICAgY2FzZSAnV09SRCc6IHtcbiAgICAgIGNvbnN0IHYgPSBOdW1iZXIodmFsdWUpICYgMHhmZmZmO1xuICAgICAgYnl0ZXMucHVzaCgweDAxLCAuLi5sZTE2KHYpKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlICdESU5UJzoge1xuICAgICAgY29uc3QgdiA9IE51bWJlcih2YWx1ZSkgPj4+IDA7XG4gICAgICBieXRlcy5wdXNoKDB4MDIsIHYgJiAweGZmLCAodiA+PiA4KSAmIDB4ZmYsICh2ID4+IDE2KSAmIDB4ZmYsICh2ID4+IDI0KSAmIDB4ZmYpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ1JFQUwnOiB7XG4gICAgICBjb25zdCBidWYgPSBuZXcgQXJyYXlCdWZmZXIoNCk7XG4gICAgICBuZXcgRGF0YVZpZXcoYnVmKS5zZXRGbG9hdDMyKDAsIE51bWJlcih2YWx1ZSksIHRydWUpO1xuICAgICAgY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKTtcbiAgICAgIGJ5dGVzLnB1c2goMHgwMywgYXJyWzBdLCBhcnJbMV0sIGFyclsyXSwgYXJyWzNdKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZXNUb0hleChieXRlcyk7XG59XG5cbi8qKlxuICogUGFyc2UgRkMgMHg0NCBHRVRfTElTVCByZXNwb25zZS5cbiAqIFJlc3BvbnNlIGhlYWRlciAoMTAgYnl0ZXMpOlxuICogICBbMF0gPSAweDQ0IChvcGNvZGUgZWNobylcbiAqICAgWzFdID0gMHg3RSAoU1VDQ0VTUykgb3IgMHg4MSAoZXJyb3IpXG4gKiAgIFsyLi4zXSA9IGxhc3RfcmVxX2lkeCAoYmlnLWVuZGlhbiB1aW50MTYpXG4gKiAgIFs0Li43XSA9IHNjYW5fY291bnRlciAoYmlnLWVuZGlhbiB1aW50MzIpXG4gKiAgIFs4Li45XSA9IHJlc3BvbnNlX3N6IChiaWctZW5kaWFuIHVpbnQxNilcbiAqICAgWzEwLi5dID0gdmFyaWFibGUgZGF0YSAoZnJvbSBleHRfc3RydWNwcF9kZWJ1Z19yZWFkKVxuICpcbiAqIFZhcmlhYmxlIGRhdGEgZm9ybWF0IHBlciBkZWJ1Z190YWJsZS5ocHAgXHUyMDE0IGVhY2ggZW50cnk6XG4gKiAgIFt0eXBlX2J5dGUsIHZhbHVlX2J5dGVzLi4uXSB3aGVyZSB0eXBlIG1hdGNoZXMgSUVDX1NURExJQiB0eXBlVGFnc1xuICovXG5mdW5jdGlvbiBwYXJzZUdldExpc3RSZXNwb25zZShoZXg6IHN0cmluZywgdGFnSW5kZXhNYXA6IE1hcDxzdHJpbmcsIG51bWJlcj4pOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuIHwgbnVtYmVyPiB7XG4gIGNvbnN0IGJ5dGVzID0gaGV4VG9CeXRlcyhoZXgpO1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4gfCBudW1iZXI+ID0ge307XG5cbiAgaWYgKGJ5dGVzLmxlbmd0aCA8IDEwIHx8IGJ5dGVzWzFdICE9PSAweDdlKSByZXR1cm4gcmVzdWx0O1xuXG4gIGNvbnN0IHJlc3BvbnNlU3ogPSAoYnl0ZXNbOF0gPDwgOCkgfCBieXRlc1s5XTtcbiAgaWYgKHJlc3BvbnNlU3ogPT09IDApIHJldHVybiByZXN1bHQ7XG5cbiAgLy8gQnVpbGQgcmV2ZXJzZSBtYXA6IGVsZW1JZHggXHUyMTkyIHRhZ05hbWVcbiAgY29uc3QgaW5kZXhUb05hbWUgPSBuZXcgTWFwPG51bWJlciwgc3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBpZHhdIG9mIHRhZ0luZGV4TWFwKSB7XG4gICAgaW5kZXhUb05hbWUuc2V0KGlkeCwgbmFtZSk7XG4gIH1cblxuICAvLyBWYXJpYWJsZSBkYXRhIHN0YXJ0cyBhdCBvZmZzZXQgMTA7IGZvcm1hdCBpcyBbdHlwZV90YWcsIC4uLnZhbHVlX2J5dGVzXVxuICAvLyBUaGUgZW50cmllcyBhcmUgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZSByZXF1ZXN0ZWQgKGVsZW1JZHggb3JkZXIpXG4gIGxldCBpID0gMTA7XG4gIGxldCBlbnRyeUlkeCA9IDA7XG4gIHdoaWxlIChpIDwgYnl0ZXMubGVuZ3RoKSB7XG4gICAgY29uc3QgdHlwZUJ5dGUgPSBieXRlc1tpXTtcbiAgICBpKys7XG5cbiAgICBjb25zdCB0YWdOYW1lID0gaW5kZXhUb05hbWUuZ2V0KGVudHJ5SWR4KTtcblxuICAgIHN3aXRjaCAodHlwZUJ5dGUpIHtcbiAgICAgIGNhc2UgMHgwMDogeyAvLyBCT09MIFx1MjAxNCAxIGJ5dGVcbiAgICAgICAgaWYgKGkgPj0gYnl0ZXMubGVuZ3RoKSBicmVhaztcbiAgICAgICAgaWYgKHRhZ05hbWUpIHJlc3VsdFt0YWdOYW1lXSA9IGJ5dGVzW2ldICE9PSAwO1xuICAgICAgICBpKys7XG4gICAgICAgIGVudHJ5SWR4Kys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAweDAxOiAvLyBJTlQgXHUyMDE0IDIgYnl0ZXMgTEVcbiAgICAgIGNhc2UgMHgwNDogeyAvLyBXT1JEIFx1MjAxNCAyIGJ5dGVzIExFXG4gICAgICAgIGlmIChpICsgMiA+IGJ5dGVzLmxlbmd0aCkgYnJlYWs7XG4gICAgICAgIGlmICh0YWdOYW1lKSByZXN1bHRbdGFnTmFtZV0gPSBieXRlc1tpXSB8IChieXRlc1tpICsgMV0gPDwgOCk7XG4gICAgICAgIGkgKz0gMjtcbiAgICAgICAgZW50cnlJZHgrKztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIDB4MDI6IHsgLy8gRElOVCBcdTIwMTQgNCBieXRlcyBMRVxuICAgICAgICBpZiAoaSArIDQgPiBieXRlcy5sZW5ndGgpIGJyZWFrO1xuICAgICAgICBpZiAodGFnTmFtZSkgcmVzdWx0W3RhZ05hbWVdID0gKGJ5dGVzW2ldIHwgKGJ5dGVzW2krMV08PDgpIHwgKGJ5dGVzW2krMl08PDE2KSB8IChieXRlc1tpKzNdPDwyNCkpIHwgMDtcbiAgICAgICAgaSArPSA0O1xuICAgICAgICBlbnRyeUlkeCsrO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgMHgwMzogeyAvLyBSRUFMIFx1MjAxNCA0IGJ5dGVzIExFIGZsb2F0XG4gICAgICAgIGlmIChpICsgNCA+IGJ5dGVzLmxlbmd0aCkgYnJlYWs7XG4gICAgICAgIGNvbnN0IHJhdyA9IChieXRlc1tpKzNdPDwyNCB8IGJ5dGVzW2krMl08PDE2IHwgYnl0ZXNbaSsxXTw8OCB8IGJ5dGVzW2ldKSA+Pj4gMDtcbiAgICAgICAgY29uc3QgYnVmID0gbmV3IEFycmF5QnVmZmVyKDQpO1xuICAgICAgICBuZXcgRGF0YVZpZXcoYnVmKS5zZXRVaW50MzIoMCwgcmF3LCBmYWxzZSk7XG4gICAgICAgIGlmICh0YWdOYW1lKSByZXN1bHRbdGFnTmFtZV0gPSBuZXcgRGF0YVZpZXcoYnVmKS5nZXRGbG9hdDMyKDAsIGZhbHNlKTtcbiAgICAgICAgaSArPSA0O1xuICAgICAgICBlbnRyeUlkeCsrO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIFVua25vd24gdHlwZSBcdTIwMTQgc3RvcCBwYXJzaW5nXG4gICAgICAgIGkgPSBieXRlcy5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhUVFBTIGZldGNoIHdpdGggc2VsZi1zaWduZWQgY2VydCBieXBhc3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBSb3V0ZXMgdGhyb3VnaCBJUEMgdG8gdGhlIG1haW4gcHJvY2VzcyAoTm9kZS5qcykgc28gc2VsZi1zaWduZWQgY2VydCBpcyBieXBhc3NlZC5cblxuYXN5bmMgZnVuY3Rpb24gcGxjRmV0Y2gocGF0aDogc3RyaW5nLCBpbml0OiBSZXF1ZXN0SW5pdCA9IHt9KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBjb25zdCB1cmwgPSBgJHtPUEVOUExDX0JBU0VfVVJMfSR7cGF0aH1gO1xuICBjb25zdCBtZXRob2QgPSAoaW5pdC5tZXRob2QgYXMgc3RyaW5nKSB8fCAnR0VUJztcbiAgY29uc3QgaGVhZGVycyA9IGluaXQuaGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBjb25zdCBib2R5ID0gaW5pdC5ib2R5IGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaXBjU2VydmljZS5wbGNGZXRjaCh1cmwsIG1ldGhvZCwgaGVhZGVycywgYm9keSk7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UocmVzdWx0LmJvZHksIHtcbiAgICBzdGF0dXM6IHJlc3VsdC5zdGF0dXMsXG4gICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gIH0pO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUnVudGltZSBQcm9jZXNzIE1hbmFnZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFJ1bnRpbWVQcm9jZXNzTWFuYWdlciB7XG4gIHByaXZhdGUgdG9rZW46IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHNvY2tldDogYW55ID0gbnVsbDsgIC8vIFNvY2tldC5JTyBzb2NrZXQgaW5zdGFuY2VcbiAgcHJpdmF0ZSBwb2xsVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlY29ubmVjdFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHJlY29ubmVjdEF0dGVtcHRzID0gMDtcbiAgcHJpdmF0ZSBfaXNSdW5uaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgY3VycmVudERlYnVnTWFwOiBEZWJ1Z01hcCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRhZ0luZGV4TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTsgIC8vIHRhZ05hbWUgXHUyMTkyIGVsZW1JZHhcbiAgcHJpdmF0ZSB0YWdUeXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBEZWJ1Z1RhZ1R5cGU+KCk7IC8vIHRhZ05hbWUgXHUyMTkyIHR5cGVcbiAgcHJpdmF0ZSBkZWJ1Z0FycmF5SWR4ID0gMDsgLy8gYWx3YXlzIDAgZm9yIG91ciBwcm9ncmFtc1xuICBwcml2YXRlIF9wcm9qZWN0UGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgLyoqIFNldCBieSB0aGUgVlMgQ29kZSBsYXllciBiZWZvcmUgY2FsbGluZyBydW5Qcm9ncmFtLiAqL1xuICBzZXRQcm9qZWN0UGF0aChwOiBzdHJpbmcpOiB2b2lkIHsgdGhpcy5fcHJvamVjdFBhdGggPSBwOyB9XG5cbiAgZ2V0IGlzUnVubmluZygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzUnVubmluZzsgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGdWxsIHBpcGVsaW5lOiBDTE0gXHUyMTkyIHJ1biBQTEMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcnVuUHJvZ3JhbShjbG06IENMTUdyYXBoLCBwcm9ncmFtTmFtZSA9ICdwcm9ncmFtJywgY3ljbGVNcyA9IDUwKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcnVudGltZVN0b3JlLmNsZWFyTG9nKCk7XG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnaW5mbycsICdTdGFydGluZyBjb21waWxhdGlvbiBwaXBlbGluZS4uLicpO1xuXG4gICAgLy8gU3RlcCAxOiBNYXRJRUMgdmFsaWRhdGlvblxuICAgIGNvbnN0IHN0UmVzdWx0ID0gY2xtVG9TVChjbG0sIGN5Y2xlTXMpO1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tjbG1Ub1NUXSBHZW5lcmF0ZWQgU1QgY29kZTpcXG4nICsgc3RSZXN1bHQuc3RDb2RlKTtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdpbmZvJywgYEdlbmVyYXRlZCBTVDogJHtzdFJlc3VsdC50YWdDb3VudH0gdGFncywgJHtzdFJlc3VsdC5ydW5nQ291bnR9IHJ1bmdzYCk7XG4gICAgaWYgKHN0UmVzdWx0Lndhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0UmVzdWx0Lndhcm5pbmdzLmZvckVhY2godyA9PiBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCd3YXJuJywgdykpO1xuICAgIH1cblxuICAgIHJ1bnRpbWVTdG9yZS5zZXRNYXRpZWNTdGF0dXMoJ3N0YXJ0aW5nJywgJ1ZhbGlkYXRpbmcuLi4nKTtcbiAgICBjb25zdCBtYXRpZWNSZXN1bHQgPSBhd2FpdCB0aGlzLl92YWxpZGF0ZVdpdGhNYXRJRUMoc3RSZXN1bHQuc3RDb2RlKTtcbiAgICBpZiAoIW1hdGllY1Jlc3VsdC5zdWNjZXNzKSB7XG4gICAgICBydW50aW1lU3RvcmUuc2V0TWF0aWVjU3RhdHVzKCdlcnJvcicsIHVuZGVmaW5lZCwgbWF0aWVjUmVzdWx0LmVycm9ycy5qb2luKCdcXG4nKSk7XG4gICAgICBtYXRpZWNSZXN1bHQuZXJyb3JzLmZvckVhY2goZSA9PiBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdlcnJvcicsIGBNYXRJRUM6ICR7ZX1gKSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE1hdElFQyB2YWxpZGF0aW9uIGZhaWxlZDogJHttYXRpZWNSZXN1bHQuZXJyb3JzLmpvaW4oJzsgJyl9YCk7XG4gICAgfVxuICAgIHJ1bnRpbWVTdG9yZS5zZXRNYXRpZWNTdGF0dXMoJ3J1bm5pbmcnLCBgUEFTUyAoJHttYXRpZWNSZXN1bHQuZXJyb3JzLmxlbmd0aH0gZXJyb3JzKWApO1xuICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3N1Y2Nlc3MnLCAnTWF0SUVDOiBQQVNTJyk7XG5cbiAgICAvLyBTdGVwIDI6IFNUcnVDKysgY29kZWdlbiAoaW4tcHJvY2VzcylcbiAgICBydW50aW1lU3RvcmUuc2V0U3RydWNwcFN0YXR1cygnc3RhcnRpbmcnLCAnQ29tcGlsaW5nLi4uJyk7XG4gICAgY29uc3QgeyB6aXBCYXNlNjQsIGRlYnVnTWFwLCBlcnJvcnMgfSA9IGF3YWl0IHRoaXMuX2NvbXBpbGVXaXRoU3RydWNwcChcbiAgICAgIHN0UmVzdWx0LnN0Q29kZUZvclN0cnVjcHAsIHByb2dyYW1OYW1lLCBjeWNsZU1zXG4gICAgKTtcbiAgICBpZiAoIXppcEJhc2U2NCkge1xuICAgICAgcnVudGltZVN0b3JlLnNldFN0cnVjcHBTdGF0dXMoJ2Vycm9yJywgdW5kZWZpbmVkKTtcbiAgICAgIGVycm9ycy5mb3JFYWNoKGUgPT4gcnVudGltZVN0b3JlLmFwcGVuZExvZygnZXJyb3InLCBgU1RydUMrKzogJHtlfWApKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU1RydUMrKyBjb21waWxhdGlvbiBmYWlsZWRgKTtcbiAgICB9XG4gICAgY29uc3QgbGVhZkNvdW50ID0gZGVidWdNYXAubGVhdmVzPy5sZW5ndGggPz8gMDtcbiAgICBydW50aW1lU3RvcmUuc2V0U3RydWNwcFN0YXR1cygncnVubmluZycsIGAke2xlYWZDb3VudH0gdmFyaWFibGVzYCk7XG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnc3VjY2VzcycsIGBTVHJ1QysrOiBjb21waWxlZCAke2xlYWZDb3VudH0gdmFyaWFibGVzYCk7XG4gICAgdGhpcy5jdXJyZW50RGVidWdNYXAgPSBkZWJ1Z01hcDtcblxuICAgIC8vIEJ1aWxkIHRhZyBpbmRleCBtYXAgZm9yIGRlYnVnIHN0cmVhbVxuICAgIHRoaXMudGFnSW5kZXhNYXAgPSBidWlsZFRhZ0luZGV4TWFwKGRlYnVnTWFwKTtcbiAgICB0aGlzLnRhZ1R5cGVzLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCB0YWcgb2YgbG9naWNTdG9yZS5nZXRTdGF0ZSgpLnRhZ0RhdGFiYXNlKSB7XG4gICAgICB0aGlzLnRhZ1R5cGVzLnNldCh0YWcubmFtZSwgaWVjVG9EZWJ1Z1R5cGUodGFnLmRhdGFUeXBlKSk7XG4gICAgfVxuXG4gICAgLy8gU3RlcCAzOiBFbnN1cmUgT3BlblBMQyBSdW50aW1lIGlzIHJ1bm5pbmdcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdpbmZvJywgJ1N0ZXAgMy81OiBDaGVja2luZyBQTEMgd2Vic2VydmVyLi4uJyk7XG4gICAgYXdhaXQgdGhpcy5fZW5zdXJlT3BlblBMQ1J1bm5pbmcoKTtcblxuICAgIC8vIFN0ZXAgNDogVXBsb2FkIGFuZCBjb21waWxlXG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnaW5mbycsIGBTdGVwIDQvNTogTG9nZ2luZyBpbiB0byBPcGVuUExDLi4uYCk7XG4gICAgYXdhaXQgdGhpcy5fbG9naW5PcGVuUExDKCk7XG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnc3VjY2VzcycsICdMb2dnZWQgaW4gdG8gT3BlblBMQycpO1xuICAgIC8vIEJhc2U2NCBsZW5ndGggXHUyMTkyIGFwcHJveGltYXRlIGJ5dGUgc2l6ZVxuICAgIGNvbnN0IGFwcHJveEtiID0gKCh6aXBCYXNlNjQubGVuZ3RoICogMykgLyA0IC8gMTAyNCkudG9GaXhlZCgxKTtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdpbmZvJywgYFVwbG9hZGluZyBwcm9ncmFtLnppcCAofiR7YXBwcm94S2J9IEtCKS4uLmApO1xuICAgIGF3YWl0IHRoaXMuX3VwbG9hZFppcCh6aXBCYXNlNjQsIHByb2dyYW1OYW1lKTtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdzdWNjZXNzJywgJ1VwbG9hZCBjb21wbGV0ZSBcdTIwMTQgd2FpdGluZyBmb3IgZysrIGNvbXBpbGUuLi4nKTtcbiAgICBjb25zdCBjb21waWxlUmVzdWx0ID0gYXdhaXQgdGhpcy5fd2FpdEZvckNvbXBpbGF0aW9uKCk7XG4gICAgaWYgKGNvbXBpbGVSZXN1bHQuc3RhdHVzICE9PSAnU1VDQ0VTUycpIHtcbiAgICAgIGNvbnN0IGxvZ3MgPSBjb21waWxlUmVzdWx0LmxvZ3Muc2xpY2UoLTEwKS5qb2luKCdcXG4nKTtcbiAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ2Vycm9yJywgYGcrKyBjb21waWxlIGZhaWxlZDpcXG4ke2xvZ3N9YCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE9wZW5QTEMgY29tcGlsYXRpb24gZmFpbGVkYCk7XG4gICAgfVxuICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3N1Y2Nlc3MnLCAnZysrIGNvbXBpbGU6IFNVQ0NFU1MnKTtcblxuICAgIC8vIFN0ZXAgNTogU3RhcnQgUExDICsgZGVidWcgc3RyZWFtXG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnaW5mbycsICdTdGVwIDUvNTogU3RhcnRpbmcgUExDLi4uJyk7XG4gICAgYXdhaXQgdGhpcy5fc3RhcnRQTEMoKTtcbiAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgIHRoaXMucmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xuICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3N1Y2Nlc3MnLCBgUExDIHJ1bm5pbmcgYXQgJHtjeWNsZU1zfW1zIGN5Y2xlYCk7XG4gICAgLy8gU3RhcnQgbWFpbi1wcm9jZXNzIGRlYnVnIHBvbGxlciAoVEFHX0ZSQU1FIGV2ZW50cyBwdXNoZWQgdmlhIElQQylcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdpbmZvJywgJ0Nvbm5lY3RpbmcgZGVidWcgc3RyZWFtLi4uJyk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBvbGxlclJlc3VsdCA9IGF3YWl0IGlwY1NlcnZpY2UucGxjU3RhcnREZWJ1Z1BvbGxlcigpO1xuICAgICAgaWYgKHBvbGxlclJlc3VsdC5vaykge1xuICAgICAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdzdWNjZXNzJywgJ0RlYnVnIHN0cmVhbSBjb25uZWN0ZWQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3dhcm4nLCBgRGVidWcgcG9sbGVyOiAke3BvbGxlclJlc3VsdC5lcnJvciA/PyAnZmFpbGVkJ31gKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3dhcm4nLCBgRGVidWcgcG9sbGVyIGVycm9yOiAke2U/Lm1lc3NhZ2UgPz8gU3RyaW5nKGUpfWApO1xuICAgIH1cbiAgICBydW50aW1lU3RvcmUuc2V0UGxjUnVubmluZyh0cnVlLCB0aGlzLnRhZ0luZGV4TWFwLnNpemUpO1xuICB9XG5cbiAgYXN5bmMgc3RvcFByb2dyYW0oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5faXNSdW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fc3RvcERlYnVnU3RyZWFtKCk7XG4gICAgaWYgKHRoaXMuX3Byb2plY3RQYXRoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBpcGNTZXJ2aWNlLnBsY1N0b3AoKTtcbiAgICAgIH0gY2F0Y2ggeyAvKiBiZXN0LWVmZm9ydCAqLyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuX2xvZ2luT3BlblBMQygpO1xuICAgICAgICBhd2FpdCBwbGNGZXRjaCgnL2FwaS9zdG9wLXBsYycsIHsgaGVhZGVyczogdGhpcy5fYXV0aEhlYWRlcnMoKSB9KTtcbiAgICAgIH0gY2F0Y2ggeyAvKiBiZXN0LWVmZm9ydCAqLyB9XG4gICAgfVxuICAgIHJ1bnRpbWVTdG9yZS5zZXRQbGNSdW5uaW5nKGZhbHNlKTtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdpbmZvJywgJ1BMQyBzdG9wcGVkJyk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTWF0SUVDIHZhbGlkYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBhc3luYyBfdmFsaWRhdGVXaXRoTWF0SUVDKHN0Q29kZTogc3RyaW5nKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yczogc3RyaW5nW10gfT4ge1xuICAgIHJldHVybiBpcGNTZXJ2aWNlLnBsY0NvbXBpbGVNYXRpZWMoc3RDb2RlKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTVHJ1QysrIGluLXByb2Nlc3MgY29kZWdlbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGFzeW5jIF9jb21waWxlV2l0aFN0cnVjcHAoXG4gICAgc3RDb2RlRm9yU3RydWNwcDogc3RyaW5nLFxuICAgIHByb2dyYW1OYW1lOiBzdHJpbmcsXG4gICAgX2N5Y2xlTXM6IG51bWJlcixcbiAgKTogUHJvbWlzZTx7IHppcEJhc2U2NDogc3RyaW5nIHwgbnVsbDsgZGVidWdNYXA6IERlYnVnTWFwOyBlcnJvcnM6IHN0cmluZ1tdIH0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpcGNTZXJ2aWNlLnBsY0NvbXBpbGVTdHJ1Y3BwKHN0Q29kZUZvclN0cnVjcHAsIHByb2dyYW1OYW1lKTtcbiAgICBpZiAocmVzdWx0LmVycm9ycz8ubGVuZ3RoID4gMCB8fCAhcmVzdWx0LnppcEJhc2U2NCkge1xuICAgICAgcmV0dXJuIHsgemlwQmFzZTY0OiBudWxsLCBkZWJ1Z01hcDoge30gYXMgRGVidWdNYXAsIGVycm9yczogcmVzdWx0LmVycm9ycyA/PyBbJ3N0cnVjcHAgZmFpbGVkJ10gfTtcbiAgICB9XG4gICAgY29uc3QgZGVidWdNYXA6IERlYnVnTWFwID0gcmVzdWx0LmRlYnVnTWFwSnNvbiA/IEpTT04ucGFyc2UocmVzdWx0LmRlYnVnTWFwSnNvbikgOiB7fSBhcyBEZWJ1Z01hcDtcbiAgICByZXR1cm4geyB6aXBCYXNlNjQ6IHJlc3VsdC56aXBCYXNlNjQsIGRlYnVnTWFwLCBlcnJvcnM6IFtdIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgT3BlblBMQyBSdW50aW1lIG1hbmFnZW1lbnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBhc3luYyBfZW5zdXJlT3BlblBMQ1J1bm5pbmcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcnVudGltZVN0b3JlLnNldE9wZW5QTENTdGF0dXMoJ3N0YXJ0aW5nJywgJ0NoZWNraW5nLi4uJyk7XG5cbiAgICAvLyBDaGVjayBpZiBhbHJlYWR5IHJlc3BvbmRpbmdcbiAgICB0cnkge1xuICAgICAgY29uc3QgciA9IGF3YWl0IHBsY0ZldGNoKCcvYXBpL3ZlcnNpb24nLCB7IHNpZ25hbDogQWJvcnRTaWduYWwudGltZW91dCgzMDAwKSB9KTtcbiAgICAgIGlmIChyLm9rKSB7XG4gICAgICAgIHJ1bnRpbWVTdG9yZS5zZXRPcGVuUExDU3RhdHVzKCdydW5uaW5nJywgYFBvcnQgJHtPUEVOUExDX1BPUlR9YCk7XG4gICAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ3N1Y2Nlc3MnLCBgUExDIHdlYnNlcnZlciBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydCAke09QRU5QTENfUE9SVH1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggeyAvKiBub3QgdXAgeWV0ICovIH1cblxuICAgIC8vIFN0YXJ0IHZpYSBFbGVjdHJvbi1tYWluIElQQyAoc3Bhd25zIHRoZSB3ZWJzZXJ2ZXIgY2hpbGQgcHJvY2VzcylcbiAgICBpZiAodGhpcy5fcHJvamVjdFBhdGgpIHtcbiAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ2luZm8nLCAnUExDIHdlYnNlcnZlciBub3QgcnVubmluZyBcdTIwMTQgc3RhcnRpbmcgaXQuLi4nKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGlwY1NlcnZpY2UucGxjU3RhcnQodGhpcy5fcHJvamVjdFBhdGgpO1xuICAgICAgaWYgKCFyZXN1bHQub2spIHtcbiAgICAgICAgcnVudGltZVN0b3JlLnNldE9wZW5QTENTdGF0dXMoJ2Vycm9yJywgdW5kZWZpbmVkLCByZXN1bHQuZXJyb3IgPz8gJ3BsYzpzdGFydCBmYWlsZWQnKTtcbiAgICAgICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnZXJyb3InLCBgV2Vic2VydmVyIHN0YXJ0IGZhaWxlZDogJHtyZXN1bHQuZXJyb3J9YCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IgPz8gJ3BsYzpzdGFydCBmYWlsZWQnKTtcbiAgICAgIH1cbiAgICAgIC8vIHBsY1N0YXJ0IHdhaXRzIHVudGlsIHRoZSB3ZWJzZXJ2ZXIgaXMgcmVhZHkgXHUyMDE0IGNoZWNrIGl0IGlzIGFjdHVhbGx5IHVwXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByID0gYXdhaXQgcGxjRmV0Y2goJy9hcGkvdmVyc2lvbicsIHsgc2lnbmFsOiBBYm9ydFNpZ25hbC50aW1lb3V0KDUwMDApIH0pO1xuICAgICAgICBpZiAoci5vaykge1xuICAgICAgICAgIHJ1bnRpbWVTdG9yZS5zZXRPcGVuUExDU3RhdHVzKCdydW5uaW5nJywgYFBvcnQgJHtPUEVOUExDX1BPUlR9YCk7XG4gICAgICAgICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnc3VjY2VzcycsICdQTEMgd2Vic2VydmVyIHJlYWR5Jyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgICBydW50aW1lU3RvcmUuc2V0T3BlblBMQ1N0YXR1cygnZXJyb3InLCB1bmRlZmluZWQsICdXZWJzZXJ2ZXIgc3RhcnRlZCBidXQgbm90IHJlc3BvbmRpbmcnKTtcbiAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ2Vycm9yJywgJ1dlYnNlcnZlciBwcm9jZXNzIHN0YXJ0ZWQgYnV0IC9hcGkvdmVyc2lvbiBub3QgcmVzcG9uZGluZycpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJzZXJ2ZXIgc3RhcnRlZCBidXQgL2FwaS92ZXJzaW9uIG5vdCByZXNwb25kaW5nJyk7XG4gICAgfVxuXG4gICAgLy8gTm8gcHJvamVjdCBwYXRoIHNldCBcdTIwMTQgY2Fubm90IHN0YXJ0IG5hdGl2ZSBydW50aW1lXG4gICAgY29uc3QgbXNnID0gJ05vIHdvcmtzcGFjZSBmb2xkZXIgb3Blbi4gT3BlbiBhIGZvbGRlciBjb250YWluaW5nIHlvdXIgUExDIHByb2plY3QgdG8gcnVuIHRoZSBzaW11bGF0b3IuJztcbiAgICBydW50aW1lU3RvcmUuc2V0T3BlblBMQ1N0YXR1cygnZXJyb3InLCB1bmRlZmluZWQsIG1zZyk7XG4gICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnZXJyb3InLCBtc2cpO1xuICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIE9wZW5QTEMgUkVTVCBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBhc3luYyBfbG9naW5PcGVuUExDKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIERlbGVnYXRlIGF1dGggdG8gbWFpbiBwcm9jZXNzIFx1MjAxNCBpdCBvd25zIHRoZSBjcmVkZW50aWFscyAodm9sdC1pbnRlcm5hbCArIGVuY3J5cHRlZCBwYXNzd29yZClcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpcGNTZXJ2aWNlLnBsY0dldFRva2VuKCk7XG4gICAgaWYgKCFyZXN1bHQub2sgfHwgIXJlc3VsdC50b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPcGVuUExDIGxvZ2luIGZhaWxlZDogJHtyZXN1bHQuZXJyb3IgPz8gJ25vIHRva2VuIHJldHVybmVkJ31gKTtcbiAgICB9XG4gICAgdGhpcy50b2tlbiA9IHJlc3VsdC50b2tlbjtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdzdWNjZXNzJywgJ0F1dGggdG9rZW4gb2J0YWluZWQnKTtcbiAgfVxuXG4gIHByaXZhdGUgX2F1dGhIZWFkZXJzKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIHJldHVybiB7ICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMudG9rZW4gPz8gJyd9YCB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfdXBsb2FkWmlwKHppcEJhc2U2NDogc3RyaW5nLCBwcm9ncmFtTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaXBjU2VydmljZS5wbGNVcGxvYWRaaXAoemlwQmFzZTY0LCBgJHtwcm9ncmFtTmFtZX0uemlwYCwgdGhpcy50b2tlbiA/PyAnJyk7XG4gICAgaWYgKCFyZXN1bHQub2spIHRocm93IG5ldyBFcnJvcihgVXBsb2FkIGZhaWxlZCAoJHtyZXN1bHQuc3RhdHVzfSk6ICR7cmVzdWx0LmJvZHl9YCk7XG4gICAgbGV0IGRhdGE6IHsgVXBsb2FkRmlsZUZhaWw/OiBzdHJpbmcgfSA9IHt9O1xuICAgIHRyeSB7IGRhdGEgPSBKU09OLnBhcnNlKHJlc3VsdC5ib2R5KTsgfSBjYXRjaCB7fVxuICAgIGlmIChkYXRhLlVwbG9hZEZpbGVGYWlsKSB0aHJvdyBuZXcgRXJyb3IoYFVwbG9hZCByZWplY3RlZDogJHtkYXRhLlVwbG9hZEZpbGVGYWlsfWApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfd2FpdEZvckNvbXBpbGF0aW9uKCk6IFByb21pc2U8eyBzdGF0dXM6IHN0cmluZzsgbG9nczogc3RyaW5nW10gfT4ge1xuICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIENPTVBJTEVfVElNRU9VVF9NUztcbiAgICBsZXQgbGFzdFN0YXR1cyA9ICcnO1xuICAgIHdoaWxlIChEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgIGNvbnN0IHIgPSBhd2FpdCBwbGNGZXRjaCgnL2FwaS9jb21waWxhdGlvbi1zdGF0dXMnLCB7IGhlYWRlcnM6IHRoaXMuX2F1dGhIZWFkZXJzKCkgfSk7XG4gICAgICBpZiAoIXIub2spIHRocm93IG5ldyBFcnJvcihgQ29tcGlsYXRpb24gc3RhdHVzIGNoZWNrIGZhaWxlZCAoJHtyLnN0YXR1c30pYCk7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgci5qc29uKCkgYXMgeyBzdGF0dXM6IHN0cmluZzsgbG9nczogc3RyaW5nW107IGV4aXRfY29kZTogbnVtYmVyIHwgbnVsbCB9O1xuICAgICAgaWYgKGRhdGEuc3RhdHVzICE9PSBsYXN0U3RhdHVzKSB7XG4gICAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ2luZm8nLCBgZysrIHN0YXR1czogJHtkYXRhLnN0YXR1c31gKTtcbiAgICAgICAgbGFzdFN0YXR1cyA9IGRhdGEuc3RhdHVzO1xuICAgICAgfVxuICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSAnU1VDQ0VTUycgfHwgZGF0YS5zdGF0dXMgPT09ICdGQUlMRUQnKSByZXR1cm4gZGF0YTtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlcyA9PiBzZXRUaW1lb3V0KHJlcywgQ09NUElMRV9QT0xMX0lOVEVSVkFMX01TKSk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgQ29tcGlsYXRpb24gdGltZWQgb3V0IGFmdGVyICR7Q09NUElMRV9USU1FT1VUX01TfW1zYCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9zdGFydFBMQygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByID0gYXdhaXQgcGxjRmV0Y2goJy9hcGkvc3RhcnQtcGxjJywgeyBtZXRob2Q6ICdHRVQnLCBoZWFkZXJzOiB0aGlzLl9hdXRoSGVhZGVycygpIH0pO1xuICAgIGlmICghci5vaykgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gc3RhcnQgUExDICgke3Iuc3RhdHVzfSlgKTtcbiAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdzdWNjZXNzJywgJ1BMQyBzdGFydCBjb21tYW5kIHNlbnQnKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTb2NrZXQuSU8gZGVidWcgc3RyZWFtIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgX2Nvbm5lY3REZWJ1Z1N0cmVhbSgpOiB2b2lkIHtcbiAgICB0aGlzLl9zdG9wRGVidWdTdHJlYW0oKTtcbiAgICBpZiAoIXRoaXMudG9rZW4gfHwgdGhpcy50YWdJbmRleE1hcC5zaXplID09PSAwKSByZXR1cm47XG5cbiAgICBsZXQgU29ja2V0SU86IGFueTtcbiAgICB0cnkge1xuICAgICAgLy8gVHJ5IHBhY2thZ2VkIGRlcGVuZGVuY3kgZmlyc3QsIHRoZW4gZGV2IGxvY2F0aW9uXG4gICAgICB0cnkgeyBTb2NrZXRJTyA9IHJlcXVpcmUoJ3NvY2tldC5pby1jbGllbnQnKS5pbzsgfSBjYXRjaCB7fVxuICAgICAgaWYgKCFTb2NrZXRJTykge1xuICAgICAgICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuICAgICAgICBTb2NrZXRJTyA9IHJlcXVpcmUocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3ZvbHQuZGl5L25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tY2xpZW50JykpLmlvO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJ1bnRpbWVTdG9yZS5hcHBlbmRMb2coJ2Vycm9yJywgYHNvY2tldC5pby1jbGllbnQgbm90IGZvdW5kOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc29ja2V0ID0gU29ja2V0SU8oYCR7T1BFTlBMQ19CQVNFX1VSTH0vYXBpL2RlYnVnYCwge1xuICAgICAgcGF0aDogJy9zb2NrZXQuaW8nLFxuICAgICAgdHJhbnNwb3J0czogWyd3ZWJzb2NrZXQnXSxcbiAgICAgIGF1dGg6IHsgdG9rZW46IHRoaXMudG9rZW4gfSxcbiAgICAgIHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UsXG4gICAgICByZWNvbm5lY3Rpb246IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5zb2NrZXQub24oJ2Nvbm5lY3QnLCAoKSA9PiB7XG4gICAgICB0aGlzLnJlY29ubmVjdEF0dGVtcHRzID0gMDtcbiAgICAgIGNvbnN0IHRhZ0NvdW50ID0gdGhpcy50YWdJbmRleE1hcC5zaXplO1xuICAgICAgcnVudGltZVN0b3JlLnNldFBsY1J1bm5pbmcodHJ1ZSwgdGFnQ291bnQpO1xuICAgICAgcnVudGltZVN0b3JlLmFwcGVuZExvZygnc3VjY2VzcycsIGBEZWJ1ZyBzdHJlYW0gY29ubmVjdGVkIFx1MjAxNCBtb25pdG9yaW5nICR7dGFnQ291bnR9IHZhcmlhYmxlc2ApO1xuICAgICAgdGhpcy5fc3RhcnRQb2xsaW5nKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnNvY2tldC5vbignZGVidWdfcmVzcG9uc2UnLCAoZGF0YTogeyBzdWNjZXNzOiBib29sZWFuOyBkYXRhPzogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9KSA9PiB7XG4gICAgICBpZiAoIWRhdGEuc3VjY2VzcyB8fCAhZGF0YS5kYXRhKSByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB0YWdWYWx1ZXMgPSBwYXJzZUdldExpc3RSZXNwb25zZShkYXRhLmRhdGEsIHRoaXMudGFnSW5kZXhNYXApO1xuICAgICAgICAvLyBQdXNoIGxpdmUgdmFsdWVzIGludG8gbG9naWNTdG9yZVxuICAgICAgICBmb3IgKGNvbnN0IFt0YWdOYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModGFnVmFsdWVzKSkge1xuICAgICAgICAgIGxvZ2ljU3RvcmUudXBkYXRlVGFnTGl2ZVZhbHVlKHRhZ05hbWUsIFN0cmluZyh2YWx1ZSkpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHsgLyogbWFsZm9ybWVkIGZyYW1lIFx1MjAxNCBza2lwICovIH1cbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0Lm9uKCdjb25uZWN0X2Vycm9yJywgKCkgPT4ge1xuICAgICAgdGhpcy5fc2NoZWR1bGVSZWNvbm5lY3QoKTtcbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgKCkgPT4ge1xuICAgICAgdGhpcy5fc3RvcFBvbGxpbmcoKTtcbiAgICAgIHRoaXMuX3NjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9zdGFydFBvbGxpbmcoKTogdm9pZCB7XG4gICAgdGhpcy5fc3RvcFBvbGxpbmcoKTtcbiAgICBpZiAodGhpcy50YWdJbmRleE1hcC5zaXplID09PSAwKSByZXR1cm47XG4gICAgY29uc3QgZWxlbUluZGV4ZXMgPSBBcnJheS5mcm9tKHRoaXMudGFnSW5kZXhNYXAudmFsdWVzKCkpO1xuICAgIGNvbnN0IGNtZCA9IGJ1aWxkR2V0TGlzdENvbW1hbmQodGhpcy5kZWJ1Z0FycmF5SWR4LCBlbGVtSW5kZXhlcyk7XG5cbiAgICB0aGlzLnBvbGxUaW1lciA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLnNvY2tldD8uY29ubmVjdGVkKSB7XG4gICAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2RlYnVnX2NvbW1hbmQnLCB7IGNvbW1hbmQ6IGNtZCB9KTtcbiAgICAgIH1cbiAgICB9LCBERUJVR19QT0xMX0lOVEVSVkFMX01TKTtcbiAgfVxuXG4gIHByaXZhdGUgX3N0b3BQb2xsaW5nKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnBvbGxUaW1lcikgeyBjbGVhckludGVydmFsKHRoaXMucG9sbFRpbWVyKTsgdGhpcy5wb2xsVGltZXIgPSBudWxsOyB9XG4gIH1cblxuICBwcml2YXRlIF9zdG9wRGVidWdTdHJlYW0oKTogdm9pZCB7XG4gICAgdGhpcy5fc3RvcFBvbGxpbmcoKTtcbiAgICBpZiAodGhpcy5yZWNvbm5lY3RUaW1lcikgeyBjbGVhclRpbWVvdXQodGhpcy5yZWNvbm5lY3RUaW1lcik7IHRoaXMucmVjb25uZWN0VGltZXIgPSBudWxsOyB9XG4gICAgaWYgKHRoaXMuc29ja2V0KSB7XG4gICAgICB0aGlzLnNvY2tldC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgIHRoaXMuc29ja2V0LmRpc2Nvbm5lY3QoKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gbnVsbDtcbiAgICB9XG4gICAgcnVudGltZVN0b3JlLnNldFBsY1J1bm5pbmcoZmFsc2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBfc2NoZWR1bGVSZWNvbm5lY3QoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9pc1J1bm5pbmcpIHJldHVybjtcbiAgICBpZiAodGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA+PSBNQVhfUkVDT05ORUNUX0FUVEVNUFRTKSB7XG4gICAgICBydW50aW1lU3RvcmUuYXBwZW5kTG9nKCdlcnJvcicsICdEZWJ1ZyBzdHJlYW06IG1heCByZWNvbm5lY3QgYXR0ZW1wdHMgcmVhY2hlZCcpO1xuICAgICAgcnVudGltZVN0b3JlLnNldE9wZW5QTENTdGF0dXMoJ2Vycm9yJywgdW5kZWZpbmVkLCAnRGVidWcgc3RyZWFtIGRpc2Nvbm5lY3RlZCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnJlY29ubmVjdEF0dGVtcHRzKys7XG4gICAgY29uc3QgZGVsYXkgPSBSRUNPTk5FQ1RfREVMQVlfTVMgKiB0aGlzLnJlY29ubmVjdEF0dGVtcHRzO1xuICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBudWxsO1xuICAgICAgaWYgKHRoaXMuX2lzUnVubmluZykgdGhpcy5fY29ubmVjdERlYnVnU3RyZWFtKCk7XG4gICAgfSwgZGVsYXkpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZvcmNlIC8gcmVsZWFzZSB0YWcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZm9yY2VUYWcodGFnTmFtZTogc3RyaW5nLCB2YWx1ZTogYm9vbGVhbiB8IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGVsZW1JZHggPSB0aGlzLnRhZ0luZGV4TWFwLmdldCh0YWdOYW1lKTtcbiAgICBjb25zdCB0YWdUeXBlID0gdGhpcy50YWdUeXBlcy5nZXQodGFnTmFtZSk7XG4gICAgaWYgKGVsZW1JZHggPT09IHVuZGVmaW5lZCB8fCAhdGFnVHlwZSB8fCAhdGhpcy5zb2NrZXQ/LmNvbm5lY3RlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgY21kID0gYnVpbGRGb3JjZUNvbW1hbmQodGhpcy5kZWJ1Z0FycmF5SWR4LCBlbGVtSWR4LCB0YWdUeXBlLCB2YWx1ZSk7XG4gICAgdGhpcy5zb2NrZXQuZW1pdCgnZGVidWdfY29tbWFuZCcsIHsgY29tbWFuZDogY21kIH0pO1xuICB9XG5cbiAgcmVsZWFzZVRhZyh0YWdOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCB0YWdUeXBlID0gdGhpcy50YWdUeXBlcy5nZXQodGFnTmFtZSk7XG4gICAgdGhpcy5mb3JjZVRhZyh0YWdOYW1lLCB0YWdUeXBlID09PSAnQk9PTCcgPyBmYWxzZSA6IDApO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIENsZWFudXAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLl9pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9zdG9wRGVidWdTdHJlYW0oKTtcbiAgfVxufVxuXG4vLyBTaW5nbGV0b25cbmV4cG9ydCBjb25zdCBydW50aW1lUHJvY2Vzc01hbmFnZXIgPSBuZXcgUnVudGltZVByb2Nlc3NNYW5hZ2VyKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFzQkEsU0FBUyxTQUFTLHdCQUF3QjtBQUUxQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGtCQUFrQjtBQUUzQixZQUFZLGdCQUFnQjtBQUk1QixNQUFNLG1CQUFtQjtBQUN6QixNQUFNLGVBQWU7QUFDckIsTUFBTSwyQkFBMkI7QUFDakMsTUFBTSxxQkFBcUI7QUFDM0IsTUFBTSx5QkFBeUI7QUFDL0IsTUFBTSx5QkFBeUI7QUFDL0IsTUFBTSxxQkFBcUI7QUFNM0IsU0FBUyxlQUFlLElBQStCO0FBQ3JELFVBQVEsSUFBSTtBQUFBLElBQ1YsS0FBSztBQUFRLGFBQU87QUFBQSxJQUNwQixLQUFLO0FBQUEsSUFBTyxLQUFLO0FBQVEsYUFBTztBQUFBLElBQ2hDLEtBQUs7QUFBQSxJQUFRLEtBQUs7QUFBUyxhQUFPO0FBQUEsSUFDbEMsS0FBSztBQUFBLElBQVEsS0FBSztBQUFTLGFBQU87QUFBQSxJQUNsQyxLQUFLO0FBQUEsSUFBUSxLQUFLO0FBQUEsSUFBUSxLQUFLO0FBQVMsYUFBTztBQUFBLElBQy9DO0FBQVMsYUFBTztBQUFBLEVBQ2xCO0FBQ0Y7QUFJQSxTQUFTLEtBQUssR0FBcUI7QUFDakMsU0FBTyxDQUFFLEtBQUssSUFBSyxLQUFNLElBQUksR0FBSTtBQUNuQztBQUVBLFNBQVMsS0FBSyxHQUFxQjtBQUNqQyxTQUFPLENBQUMsSUFBSSxLQUFPLEtBQUssSUFBSyxHQUFJO0FBQ25DO0FBRUEsU0FBUyxXQUFXLE9BQXlCO0FBQzNDLFNBQU8sTUFBTSxJQUFJLE9BQUssRUFBRSxTQUFTLEVBQUUsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQ2pFO0FBRUEsU0FBUyxXQUFXLEtBQXVCO0FBQ3pDLFNBQU8sSUFBSSxLQUFLLEVB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
