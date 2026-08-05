var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import { execFile, exec } from "child_process";
import { AutoOpenBarrier, ProcessTimeRunOnceScheduler, Promises, Queue, timeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { isWindows, OS } from "../../../base/common/platform.js";
import { getSystemShell } from "../../../base/node/shell.js";
import { LogLevel } from "../../log/common/log.js";
import { RequestStore } from "../common/requestStore.js";
import { TitleEventSource, ProcessPropertyType } from "../common/terminal.js";
import { TerminalDataBufferer } from "../common/terminalDataBuffering.js";
import { escapeNonWindowsPath } from "../common/terminalEnvironment.js";
import { getWindowsBuildNumber } from "./terminalEnvironment.js";
import { TerminalProcess } from "./terminalProcess.js";
import { localize } from "../../../nls.js";
import { ignoreProcessNames } from "./childProcessMonitor.js";
import { ErrorNoTelemetry } from "../../../base/common/errors.js";
import { ShellIntegrationAddon } from "../common/xterm/shellIntegrationAddon.js";
import { formatMessageForTerminal } from "../common/terminalStrings.js";
import { join } from "path";
import { memoize } from "../../../base/common/decorators.js";
import * as performance from "../../../base/common/performance.js";
import pkg from "@xterm/headless";
import { AutoRepliesPtyServiceContribution } from "./terminalContrib/autoReplies/autoRepliesContribController.js";
const { Terminal: XtermTerminal } = pkg;
function traceRpc(_target, key, descriptor) {
  if (typeof descriptor.value !== "function") {
    throw new Error("not supported");
  }
  const fnKey = "value";
  const fn = descriptor.value;
  descriptor[fnKey] = async function(...args) {
    if (this.traceRpcArgs.logService.getLevel() === LogLevel.Trace) {
      this.traceRpcArgs.logService.trace(`[RPC Request] PtyService#${fn.name}(${args.map((e) => JSON.stringify(e)).join(", ")})`);
    }
    if (this.traceRpcArgs.simulatedLatency) {
      await timeout(this.traceRpcArgs.simulatedLatency);
    }
    let result;
    try {
      result = await fn.apply(this, args);
    } catch (e) {
      this.traceRpcArgs.logService.error(`[RPC Response] PtyService#${fn.name}`, e);
      throw e;
    }
    if (this.traceRpcArgs.logService.getLevel() === LogLevel.Trace) {
      this.traceRpcArgs.logService.trace(`[RPC Response] PtyService#${fn.name}`, result);
    }
    return result;
  };
}
let SerializeAddon;
let Unicode11Addon;
class PtyService extends Disposable {
  constructor(_logService, _productService, _reconnectConstants, _simulatedLatency) {
    super();
    this._logService = _logService;
    this._productService = _productService;
    this._reconnectConstants = _reconnectConstants;
    this._simulatedLatency = _simulatedLatency;
    this._ptys = /* @__PURE__ */ new Map();
    this._workspaceLayoutInfos = /* @__PURE__ */ new Map();
    this._revivedPtyIdMap = /* @__PURE__ */ new Map();
    // #region Pty service contribution RPC calls
    this._autoRepliesContribution = new AutoRepliesPtyServiceContribution(this._logService);
    // #endregion
    this._contributions = [
      this._autoRepliesContribution
    ];
    this._lastPtyId = 0;
    this._onHeartbeat = this._register(new Emitter());
    this.onHeartbeat = this._traceEvent("_onHeartbeat", this._onHeartbeat.event);
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._traceEvent("_onProcessData", this._onProcessData.event);
    this._onProcessReplay = this._register(new Emitter());
    this.onProcessReplay = this._traceEvent("_onProcessReplay", this._onProcessReplay.event);
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._traceEvent("_onProcessReady", this._onProcessReady.event);
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._traceEvent("_onProcessExit", this._onProcessExit.event);
    this._onProcessOrphanQuestion = this._register(new Emitter());
    this.onProcessOrphanQuestion = this._traceEvent("_onProcessOrphanQuestion", this._onProcessOrphanQuestion.event);
    this._onDidRequestDetach = this._register(new Emitter());
    this.onDidRequestDetach = this._traceEvent("_onDidRequestDetach", this._onDidRequestDetach.event);
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._traceEvent("_onDidChangeProperty", this._onDidChangeProperty.event);
    this._register(toDisposable(() => {
      for (const pty of this._ptys.values()) {
        pty.shutdown(true);
      }
      this._ptys.clear();
    }));
    this._detachInstanceRequestStore = this._register(new RequestStore(void 0, this._logService));
    this._detachInstanceRequestStore.onCreateRequest(this._onDidRequestDetach.fire, this._onDidRequestDetach);
  }
  async installAutoReply(match, reply) {
    await this._autoRepliesContribution.installAutoReply(match, reply);
  }
  async uninstallAllAutoReplies() {
    await this._autoRepliesContribution.uninstallAllAutoReplies();
  }
  _traceEvent(name, event) {
    event((e) => {
      if (this._logService.getLevel() === LogLevel.Trace) {
        this._logService.trace(`[RPC Event] PtyService#${name}.fire(${JSON.stringify(e)})`);
      }
    });
    return event;
  }
  get traceRpcArgs() {
    return {
      logService: this._logService,
      simulatedLatency: this._simulatedLatency
    };
  }
  async refreshIgnoreProcessNames(names) {
    ignoreProcessNames.length = 0;
    ignoreProcessNames.push(...names);
  }
  async requestDetachInstance(workspaceId, instanceId) {
    return this._detachInstanceRequestStore.createRequest({ workspaceId, instanceId });
  }
  async acceptDetachInstanceReply(requestId, persistentProcessId) {
    let processDetails = void 0;
    const pty = this._ptys.get(persistentProcessId);
    if (pty) {
      processDetails = await this._buildProcessDetails(persistentProcessId, pty);
    }
    this._detachInstanceRequestStore.acceptReply(requestId, processDetails);
  }
  async freePortKillProcess(port) {
    const stdout = await new Promise((resolve, reject) => {
      exec(isWindows ? `netstat -ano | findstr "${port}"` : `lsof -nP -iTCP -sTCP:LISTEN | grep ${port}`, {}, (err, stdout2) => {
        if (err) {
          return reject("Problem occurred when listing active processes");
        }
        resolve(stdout2);
      });
    });
    const processesForPort = stdout.split(/\r?\n/).filter((s) => !!s.trim());
    if (processesForPort.length >= 1) {
      const capturePid = /\s+(\d+)(?:\s+|$)/;
      const processId = processesForPort[0].match(capturePid)?.[1];
      if (processId) {
        try {
          process.kill(Number.parseInt(processId));
        } catch {
        }
      } else {
        throw new Error(`Processes for port ${port} were not found`);
      }
      return { port, processId };
    }
    throw new Error(`Could not kill process with port ${port}`);
  }
  async serializeTerminalState(ids) {
    const promises = [];
    for (const [persistentProcessId, persistentProcess] of this._ptys.entries()) {
      if (persistentProcess.hasWrittenData && ids.indexOf(persistentProcessId) !== -1) {
        promises.push(Promises.withAsyncBody(async (r) => {
          r({
            id: persistentProcessId,
            shellLaunchConfig: persistentProcess.shellLaunchConfig,
            processDetails: await this._buildProcessDetails(persistentProcessId, persistentProcess),
            processLaunchConfig: persistentProcess.processLaunchOptions,
            unicodeVersion: persistentProcess.unicodeVersion,
            replayEvent: await persistentProcess.serializeNormalBuffer(),
            timestamp: Date.now()
          });
        }));
      }
    }
    const serialized = {
      version: 1,
      state: await Promise.all(promises)
    };
    return JSON.stringify(serialized);
  }
  async reviveTerminalProcesses(workspaceId, state, dateTimeFormatLocale) {
    const promises = [];
    for (const terminal of state) {
      promises.push(this._reviveTerminalProcess(workspaceId, terminal));
    }
    await Promise.all(promises);
  }
  async _reviveTerminalProcess(workspaceId, terminal) {
    const restoreMessage = localize("terminal-history-restored", "History restored");
    let postRestoreMessage = "";
    if (isWindows) {
      const lastReplayEvent = terminal.replayEvent.events.length > 0 ? terminal.replayEvent.events.at(-1) : void 0;
      if (lastReplayEvent) {
        postRestoreMessage += "\r\n".repeat(lastReplayEvent.rows - 1) + `\x1B[H`;
      }
    }
    const newId = await this.createProcess(
      {
        ...terminal.shellLaunchConfig,
        cwd: terminal.processDetails.cwd,
        color: terminal.processDetails.color,
        icon: terminal.processDetails.icon,
        name: terminal.processDetails.titleSource === TitleEventSource.Api ? terminal.processDetails.title : void 0,
        initialText: terminal.replayEvent.events[0].data + formatMessageForTerminal(restoreMessage, { loudFormatting: true }) + postRestoreMessage
      },
      terminal.processDetails.cwd,
      terminal.replayEvent.events[0].cols,
      terminal.replayEvent.events[0].rows,
      terminal.unicodeVersion,
      terminal.processLaunchConfig.env,
      terminal.processLaunchConfig.executableEnv,
      terminal.processLaunchConfig.options,
      true,
      terminal.processDetails.workspaceId,
      terminal.processDetails.workspaceName,
      true,
      terminal.replayEvent.events[0].data
    );
    const oldId = this._getRevivingProcessId(workspaceId, terminal.id);
    this._revivedPtyIdMap.set(oldId, { newId, state: terminal });
    this._logService.info(`Revived process, old id ${oldId} -> new id ${newId}`);
  }
  async shutdownAll() {
    this.dispose();
  }
  async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, executableEnv, options, shouldPersist, workspaceId, workspaceName, isReviving, rawReviveBuffer) {
    if (shellLaunchConfig.attachPersistentProcess) {
      throw new Error("Attempt to create a process when attach object was provided");
    }
    const id = ++this._lastPtyId;
    const process2 = new TerminalProcess(shellLaunchConfig, cwd, cols, rows, env, executableEnv, options, this._logService, this._productService);
    const processLaunchOptions = {
      env,
      executableEnv,
      options
    };
    const persistentProcess = new PersistentTerminalProcess(id, process2, workspaceId, workspaceName, shouldPersist, cols, rows, processLaunchOptions, unicodeVersion, this._reconnectConstants, this._logService, isReviving && typeof shellLaunchConfig.initialText === "string" ? shellLaunchConfig.initialText : void 0, rawReviveBuffer, shellLaunchConfig.icon, shellLaunchConfig.color, shellLaunchConfig.name, shellLaunchConfig.fixedDimensions);
    process2.onProcessExit((event) => {
      for (const contrib of this._contributions) {
        contrib.handleProcessDispose(id);
      }
      persistentProcess.dispose();
      this._ptys.delete(id);
      this._onProcessExit.fire({ id, event });
    });
    persistentProcess.onProcessData((event) => this._onProcessData.fire({ id, event }));
    persistentProcess.onProcessReplay((event) => this._onProcessReplay.fire({ id, event }));
    persistentProcess.onProcessReady((event) => this._onProcessReady.fire({ id, event }));
    persistentProcess.onProcessOrphanQuestion(() => this._onProcessOrphanQuestion.fire({ id }));
    persistentProcess.onDidChangeProperty((property) => this._onDidChangeProperty.fire({ id, property }));
    persistentProcess.onPersistentProcessReady(() => {
      for (const contrib of this._contributions) {
        contrib.handleProcessReady(id, process2);
      }
    });
    this._ptys.set(id, persistentProcess);
    return id;
  }
  async attachToProcess(id) {
    try {
      await this._throwIfNoPty(id).attach();
      this._logService.info(`Persistent process reconnection "${id}"`);
    } catch (e) {
      this._logService.warn(`Persistent process reconnection "${id}" failed`, e.message);
      throw e;
    }
  }
  async updateTitle(id, title, titleSource) {
    this._throwIfNoPty(id).setTitle(title, titleSource);
  }
  async updateIcon(id, userInitiated, icon, color) {
    this._throwIfNoPty(id).setIcon(userInitiated, icon, color);
  }
  async clearBuffer(id) {
    this._throwIfNoPty(id).clearBuffer();
  }
  async refreshProperty(id, type) {
    return this._throwIfNoPty(id).refreshProperty(type);
  }
  async updateProperty(id, type, value) {
    return this._throwIfNoPty(id).updateProperty(type, value);
  }
  async detachFromProcess(id, forcePersist) {
    return this._throwIfNoPty(id).detach(forcePersist);
  }
  async reduceConnectionGraceTime() {
    for (const pty of this._ptys.values()) {
      pty.reduceGraceTime();
    }
  }
  async listProcesses() {
    const persistentProcesses = Array.from(this._ptys.entries()).filter(([_, pty]) => pty.shouldPersistTerminal);
    this._logService.info(`Listing ${persistentProcesses.length} persistent terminals, ${this._ptys.size} total terminals`);
    const promises = persistentProcesses.map(async ([id, terminalProcessData]) => this._buildProcessDetails(id, terminalProcessData));
    const allTerminals = await Promise.all(promises);
    return allTerminals.filter((entry) => entry.isOrphan);
  }
  async getPerformanceMarks() {
    return performance.getMarks();
  }
  async start(id) {
    const pty = this._ptys.get(id);
    return pty ? pty.start() : { message: `Could not find pty with id "${id}"` };
  }
  async shutdown(id, immediate) {
    return this._ptys.get(id)?.shutdown(immediate);
  }
  async input(id, data) {
    const pty = this._throwIfNoPty(id);
    if (pty) {
      for (const contrib of this._contributions) {
        contrib.handleProcessInput(id, data);
      }
      pty.input(data);
    }
  }
  async processBinary(id, data) {
    return this._throwIfNoPty(id).writeBinary(data);
  }
  async resize(id, cols, rows) {
    const pty = this._throwIfNoPty(id);
    if (pty) {
      for (const contrib of this._contributions) {
        contrib.handleProcessResize(id, cols, rows);
      }
      pty.resize(cols, rows);
    }
  }
  async getInitialCwd(id) {
    return this._throwIfNoPty(id).getInitialCwd();
  }
  async getCwd(id) {
    return this._throwIfNoPty(id).getCwd();
  }
  async acknowledgeDataEvent(id, charCount) {
    return this._throwIfNoPty(id).acknowledgeDataEvent(charCount);
  }
  async setUnicodeVersion(id, version) {
    return this._throwIfNoPty(id).setUnicodeVersion(version);
  }
  async getLatency() {
    return [];
  }
  async orphanQuestionReply(id) {
    return this._throwIfNoPty(id).orphanQuestionReply();
  }
  async getDefaultSystemShell(osOverride = OS) {
    return getSystemShell(osOverride, process.env);
  }
  async getEnvironment() {
    return { ...process.env };
  }
  async getWslPath(original, direction) {
    if (direction === "win-to-unix") {
      if (!isWindows) {
        return original;
      }
      if (getWindowsBuildNumber() < 17063) {
        return original.replace(/\\/g, "/");
      }
      const wslExecutable = this._getWSLExecutablePath();
      if (!wslExecutable) {
        return original;
      }
      return new Promise((c) => {
        const proc = execFile(wslExecutable, ["-e", "wslpath", original], {}, (error, stdout, stderr) => {
          c(error ? original : escapeNonWindowsPath(stdout.trim()));
        });
        proc.stdin.end();
      });
    }
    if (direction === "unix-to-win") {
      if (isWindows) {
        if (getWindowsBuildNumber() < 17063) {
          return original;
        }
        const wslExecutable = this._getWSLExecutablePath();
        if (!wslExecutable) {
          return original;
        }
        return new Promise((c) => {
          const proc = execFile(wslExecutable, ["-e", "wslpath", "-w", original], {}, (error, stdout, stderr) => {
            c(error ? original : stdout.trim());
          });
          proc.stdin.end();
        });
      }
    }
    return original;
  }
  _getWSLExecutablePath() {
    const useWSLexe = getWindowsBuildNumber() >= 16299;
    const is32ProcessOn64Windows = process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432");
    const systemRoot = process.env["SystemRoot"];
    if (systemRoot) {
      return join(systemRoot, is32ProcessOn64Windows ? "Sysnative" : "System32", useWSLexe ? "wsl.exe" : "bash.exe");
    }
    return void 0;
  }
  async getRevivedPtyNewId(workspaceId, id) {
    try {
      return this._revivedPtyIdMap.get(this._getRevivingProcessId(workspaceId, id))?.newId;
    } catch (e) {
      this._logService.warn(`Couldn't find terminal ID ${workspaceId}-${id}`, e.message);
    }
    return void 0;
  }
  async setTerminalLayoutInfo(args) {
    this._workspaceLayoutInfos.set(args.workspaceId, args);
  }
  async getTerminalLayoutInfo(args) {
    performance.mark("code/willGetTerminalLayoutInfo");
    const layout = this._workspaceLayoutInfos.get(args.workspaceId);
    if (layout) {
      const doneSet = /* @__PURE__ */ new Set();
      const expandedTabs = await Promise.all(layout.tabs.map(async (tab) => this._expandTerminalTab(args.workspaceId, tab, doneSet)));
      const tabs = expandedTabs.filter((t) => t.terminals.length > 0);
      performance.mark("code/didGetTerminalLayoutInfo");
      return { tabs };
    }
    performance.mark("code/didGetTerminalLayoutInfo");
    return void 0;
  }
  async _expandTerminalTab(workspaceId, tab, doneSet) {
    const expandedTerminals = await Promise.all(tab.terminals.map((t) => this._expandTerminalInstance(workspaceId, t, doneSet)));
    const filtered = expandedTerminals.filter((term) => term.terminal !== null);
    return {
      isActive: tab.isActive,
      activePersistentProcessId: tab.activePersistentProcessId,
      terminals: filtered
    };
  }
  async _expandTerminalInstance(workspaceId, t, doneSet) {
    try {
      const oldId = this._getRevivingProcessId(workspaceId, t.terminal);
      const revivedPtyId = this._revivedPtyIdMap.get(oldId)?.newId;
      this._logService.info(`Expanding terminal instance, old id ${oldId} -> new id ${revivedPtyId}`);
      this._revivedPtyIdMap.delete(oldId);
      const persistentProcessId = revivedPtyId ?? t.terminal;
      if (doneSet.has(persistentProcessId)) {
        throw new Error(`Terminal ${persistentProcessId} has already been expanded`);
      }
      doneSet.add(persistentProcessId);
      const persistentProcess = this._throwIfNoPty(persistentProcessId);
      const processDetails = persistentProcess && await this._buildProcessDetails(t.terminal, persistentProcess, revivedPtyId !== void 0);
      return {
        terminal: { ...processDetails, id: persistentProcessId },
        relativeSize: t.relativeSize
      };
    } catch (e) {
      this._logService.warn(`Couldn't get layout info, a terminal was probably disconnected`, e.message);
      this._logService.debug("Reattach to wrong terminal debug info - layout info by id", t);
      this._logService.debug("Reattach to wrong terminal debug info - _revivePtyIdMap", Array.from(this._revivedPtyIdMap.values()));
      this._logService.debug("Reattach to wrong terminal debug info - _ptys ids", Array.from(this._ptys.keys()));
      return {
        terminal: null,
        relativeSize: t.relativeSize
      };
    }
  }
  _getRevivingProcessId(workspaceId, ptyId) {
    return `${workspaceId}-${ptyId}`;
  }
  async _buildProcessDetails(id, persistentProcess, wasRevived = false) {
    performance.mark(`code/willBuildProcessDetails/${id}`);
    const [cwd, isOrphan] = await Promise.all([persistentProcess.getCwd(), wasRevived ? true : persistentProcess.isOrphaned()]);
    const result = {
      id,
      title: persistentProcess.title,
      titleSource: persistentProcess.titleSource,
      pid: persistentProcess.pid,
      workspaceId: persistentProcess.workspaceId,
      workspaceName: persistentProcess.workspaceName,
      cwd,
      isOrphan,
      icon: persistentProcess.icon,
      color: persistentProcess.color,
      fixedDimensions: persistentProcess.fixedDimensions,
      environmentVariableCollections: persistentProcess.processLaunchOptions.options.environmentVariableCollections,
      reconnectionProperties: persistentProcess.shellLaunchConfig.reconnectionProperties,
      waitOnExit: persistentProcess.shellLaunchConfig.waitOnExit,
      hideFromUser: persistentProcess.shellLaunchConfig.hideFromUser,
      isFeatureTerminal: persistentProcess.shellLaunchConfig.isFeatureTerminal,
      type: persistentProcess.shellLaunchConfig.type,
      hasChildProcesses: persistentProcess.hasChildProcesses,
      shellIntegrationNonce: persistentProcess.processLaunchOptions.options.shellIntegration.nonce,
      tabActions: persistentProcess.shellLaunchConfig.tabActions
    };
    performance.mark(`code/didBuildProcessDetails/${id}`);
    return result;
  }
  _throwIfNoPty(id) {
    const pty = this._ptys.get(id);
    if (!pty) {
      throw new ErrorNoTelemetry(`Could not find pty ${id} on pty host`);
    }
    return pty;
  }
}
__decorateClass([
  traceRpc
], PtyService.prototype, "installAutoReply", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "uninstallAllAutoReplies", 1);
__decorateClass([
  memoize
], PtyService.prototype, "traceRpcArgs", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "refreshIgnoreProcessNames", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "requestDetachInstance", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "acceptDetachInstanceReply", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "freePortKillProcess", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "serializeTerminalState", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "reviveTerminalProcesses", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "shutdownAll", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "createProcess", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "attachToProcess", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "updateTitle", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "updateIcon", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "clearBuffer", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "refreshProperty", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "updateProperty", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "detachFromProcess", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "reduceConnectionGraceTime", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "listProcesses", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getPerformanceMarks", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "start", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "shutdown", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "input", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "processBinary", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "resize", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getInitialCwd", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getCwd", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "acknowledgeDataEvent", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "setUnicodeVersion", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getLatency", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "orphanQuestionReply", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getDefaultSystemShell", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getEnvironment", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getWslPath", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getRevivedPtyNewId", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "setTerminalLayoutInfo", 1);
__decorateClass([
  traceRpc
], PtyService.prototype, "getTerminalLayoutInfo", 1);
var InteractionState = /* @__PURE__ */ ((InteractionState2) => {
  InteractionState2["None"] = "None";
  InteractionState2["ReplayOnly"] = "ReplayOnly";
  InteractionState2["Session"] = "Session";
  return InteractionState2;
})(InteractionState || {});
class PersistentTerminalProcess extends Disposable {
  constructor(_persistentProcessId, _terminalProcess, workspaceId, workspaceName, shouldPersistTerminal, cols, rows, processLaunchOptions, unicodeVersion, reconnectConstants, _logService, reviveBuffer, rawReviveBuffer, _icon, _color, name, fixedDimensions) {
    super();
    this._persistentProcessId = _persistentProcessId;
    this._terminalProcess = _terminalProcess;
    this.workspaceId = workspaceId;
    this.workspaceName = workspaceName;
    this.shouldPersistTerminal = shouldPersistTerminal;
    this.processLaunchOptions = processLaunchOptions;
    this.unicodeVersion = unicodeVersion;
    this._logService = _logService;
    this._icon = _icon;
    this._color = _color;
    this._pendingCommands = /* @__PURE__ */ new Map();
    this._isStarted = false;
    this._orphanRequestQueue = new Queue();
    this._onProcessReplay = this._register(new Emitter());
    this.onProcessReplay = this._onProcessReplay.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onPersistentProcessReady = this._register(new Emitter());
    /** Fired when the persistent process has a ready process and has finished its replay. */
    this.onPersistentProcessReady = this._onPersistentProcessReady.event;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessOrphanQuestion = this._register(new Emitter());
    this.onProcessOrphanQuestion = this._onProcessOrphanQuestion.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._inReplay = false;
    this._pid = -1;
    this._cwd = "";
    this._titleSource = TitleEventSource.Process;
    this._interactionState = new MutationLogger(`Persistent process "${this._persistentProcessId}" interaction state`, "None" /* None */, this._logService);
    this._wasRevived = reviveBuffer !== void 0;
    this._serializer = new XtermSerializer(
      cols,
      rows,
      reconnectConstants.scrollback,
      unicodeVersion,
      reviveBuffer,
      processLaunchOptions.options.shellIntegration.nonce,
      shouldPersistTerminal ? rawReviveBuffer : void 0,
      this._logService
    );
    if (name) {
      this.setTitle(name, TitleEventSource.Api);
    }
    this._fixedDimensions = fixedDimensions;
    this._orphanQuestionBarrier = null;
    this._orphanQuestionReplyTime = 0;
    this._disconnectRunner1 = this._register(new ProcessTimeRunOnceScheduler(() => {
      this._logService.info(`Persistent process "${this._persistentProcessId}": The reconnection grace time of ${printTime(reconnectConstants.graceTime)} has expired, shutting down pid "${this._pid}"`);
      this.shutdown(true);
    }, reconnectConstants.graceTime));
    this._disconnectRunner2 = this._register(new ProcessTimeRunOnceScheduler(() => {
      this._logService.info(`Persistent process "${this._persistentProcessId}": The short reconnection grace time of ${printTime(reconnectConstants.shortGraceTime)} has expired, shutting down pid ${this._pid}`);
      this.shutdown(true);
    }, reconnectConstants.shortGraceTime));
    this._register(this._terminalProcess.onProcessExit(() => this._bufferer.stopBuffering(this._persistentProcessId)));
    this._register(this._terminalProcess.onProcessReady((e) => {
      this._pid = e.pid;
      this._cwd = e.cwd;
      this._onProcessReady.fire(e);
    }));
    this._register(this._terminalProcess.onDidChangeProperty((e) => {
      this._onDidChangeProperty.fire(e);
    }));
    this._bufferer = new TerminalDataBufferer((_, data) => this._onProcessData.fire(data));
    this._register(this._bufferer.startBuffering(this._persistentProcessId, this._terminalProcess.onProcessData));
    this._register(this.onProcessData((e) => this._serializer.handleData(e)));
  }
  get pid() {
    return this._pid;
  }
  get shellLaunchConfig() {
    return this._terminalProcess.shellLaunchConfig;
  }
  get hasWrittenData() {
    return this._interactionState.value !== "None" /* None */;
  }
  get title() {
    return this._title || this._terminalProcess.currentTitle;
  }
  get titleSource() {
    return this._titleSource;
  }
  get icon() {
    return this._icon;
  }
  get color() {
    return this._color;
  }
  get fixedDimensions() {
    return this._fixedDimensions;
  }
  get hasChildProcesses() {
    return this._terminalProcess.hasChildProcesses;
  }
  setTitle(title, titleSource) {
    if (titleSource === TitleEventSource.Api) {
      this._interactionState.setValue("Session" /* Session */, "setTitle");
      this._serializer.freeRawReviveBuffer();
    }
    this._title = title;
    this._titleSource = titleSource;
  }
  setIcon(userInitiated, icon, color) {
    if (!this._icon || "id" in icon && "id" in this._icon && icon.id !== this._icon.id || !this.color || color !== this._color) {
      this._serializer.freeRawReviveBuffer();
      if (userInitiated) {
        this._interactionState.setValue("Session" /* Session */, "setIcon");
      }
    }
    this._icon = icon;
    this._color = color;
  }
  _setFixedDimensions(fixedDimensions) {
    this._fixedDimensions = fixedDimensions;
  }
  async attach() {
    if (!this._disconnectRunner1.isScheduled() && !this._disconnectRunner2.isScheduled()) {
      this._logService.warn(`Persistent process "${this._persistentProcessId}": Process had no disconnect runners but was an orphan`);
    }
    this._disconnectRunner1.cancel();
    this._disconnectRunner2.cancel();
  }
  async detach(forcePersist) {
    if (this.shouldPersistTerminal && (this._interactionState.value !== "None" /* None */ || forcePersist)) {
      this._disconnectRunner1.schedule();
    } else {
      this.shutdown(true);
    }
  }
  serializeNormalBuffer() {
    return this._serializer.generateReplayEvent(true, this._interactionState.value !== "Session" /* Session */);
  }
  async refreshProperty(type) {
    return this._terminalProcess.refreshProperty(type);
  }
  async updateProperty(type, value) {
    if (type === ProcessPropertyType.FixedDimensions) {
      return this._setFixedDimensions(value);
    }
  }
  async start() {
    if (!this._isStarted) {
      const result = await this._terminalProcess.start();
      if (result && "message" in result) {
        return result;
      }
      this._isStarted = true;
      if (this._wasRevived) {
        this.triggerReplay();
      } else {
        this._onPersistentProcessReady.fire();
      }
      return result;
    }
    this._onProcessReady.fire({ pid: this._pid, cwd: this._cwd, windowsPty: this._terminalProcess.getWindowsPty() });
    this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: this._terminalProcess.currentTitle });
    this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: this._terminalProcess.shellType });
    this.triggerReplay();
    return void 0;
  }
  shutdown(immediate) {
    return this._terminalProcess.shutdown(immediate);
  }
  input(data) {
    this._interactionState.setValue("Session" /* Session */, "input");
    this._serializer.freeRawReviveBuffer();
    if (this._inReplay) {
      return;
    }
    return this._terminalProcess.input(data);
  }
  writeBinary(data) {
    return this._terminalProcess.processBinary(data);
  }
  resize(cols, rows) {
    if (this._inReplay) {
      return;
    }
    this._serializer.handleResize(cols, rows);
    this._bufferer.flushBuffer(this._persistentProcessId);
    return this._terminalProcess.resize(cols, rows);
  }
  async clearBuffer() {
    this._serializer.clearBuffer();
    this._terminalProcess.clearBuffer();
  }
  setUnicodeVersion(version) {
    this.unicodeVersion = version;
    this._serializer.setUnicodeVersion?.(version);
  }
  acknowledgeDataEvent(charCount) {
    if (this._inReplay) {
      return;
    }
    return this._terminalProcess.acknowledgeDataEvent(charCount);
  }
  getInitialCwd() {
    return this._terminalProcess.getInitialCwd();
  }
  getCwd() {
    return this._terminalProcess.getCwd();
  }
  async triggerReplay() {
    if (this._interactionState.value === "None" /* None */) {
      this._interactionState.setValue("ReplayOnly" /* ReplayOnly */, "triggerReplay");
    }
    const ev = await this._serializer.generateReplayEvent();
    let dataLength = 0;
    for (const e of ev.events) {
      dataLength += e.data.length;
    }
    this._logService.info(`Persistent process "${this._persistentProcessId}": Replaying ${dataLength} chars and ${ev.events.length} size events`);
    this._onProcessReplay.fire(ev);
    this._terminalProcess.clearUnacknowledgedChars();
    this._onPersistentProcessReady.fire();
  }
  sendCommandResult(reqId, isError, serializedPayload) {
    const data = this._pendingCommands.get(reqId);
    if (!data) {
      return;
    }
    this._pendingCommands.delete(reqId);
  }
  orphanQuestionReply() {
    this._orphanQuestionReplyTime = Date.now();
    if (this._orphanQuestionBarrier) {
      const barrier = this._orphanQuestionBarrier;
      this._orphanQuestionBarrier = null;
      barrier.open();
    }
  }
  reduceGraceTime() {
    if (this._disconnectRunner2.isScheduled()) {
      return;
    }
    if (this._disconnectRunner1.isScheduled()) {
      this._disconnectRunner2.schedule();
    }
  }
  async isOrphaned() {
    return await this._orphanRequestQueue.queue(async () => this._isOrphaned());
  }
  async _isOrphaned() {
    if (this._disconnectRunner1.isScheduled() || this._disconnectRunner2.isScheduled()) {
      return true;
    }
    if (!this._orphanQuestionBarrier) {
      this._orphanQuestionBarrier = new AutoOpenBarrier(4e3);
      this._orphanQuestionReplyTime = 0;
      this._onProcessOrphanQuestion.fire();
    }
    await this._orphanQuestionBarrier.wait();
    return Date.now() - this._orphanQuestionReplyTime > 500;
  }
}
class MutationLogger {
  constructor(_name, _value, _logService) {
    this._name = _name;
    this._value = _value;
    this._logService = _logService;
    this._log("initialized");
  }
  get value() {
    return this._value;
  }
  setValue(value, reason) {
    if (this._value !== value) {
      this._value = value;
      this._log(reason);
    }
  }
  _log(reason) {
    this._logService.debug(`MutationLogger "${this._name}" set to "${this._value}", reason: ${reason}`);
  }
}
class XtermSerializer {
  constructor(cols, rows, scrollback, unicodeVersion, reviveBufferWithRestoreMessage, shellIntegrationNonce, _rawReviveBuffer, logService) {
    this._rawReviveBuffer = _rawReviveBuffer;
    this._xterm = new XtermTerminal({
      cols,
      rows,
      scrollback,
      allowProposedApi: true
    });
    if (reviveBufferWithRestoreMessage) {
      this._xterm.writeln(reviveBufferWithRestoreMessage);
    }
    this.setUnicodeVersion(unicodeVersion);
    this._shellIntegrationAddon = new ShellIntegrationAddon(shellIntegrationNonce, true, void 0, logService);
    this._xterm.loadAddon(this._shellIntegrationAddon);
  }
  freeRawReviveBuffer() {
    this._rawReviveBuffer = void 0;
  }
  handleData(data) {
    this._xterm.write(data);
  }
  handleResize(cols, rows) {
    this._xterm.resize(cols, rows);
  }
  clearBuffer() {
    this._xterm.clear();
  }
  async generateReplayEvent(normalBufferOnly, restoreToLastReviveBuffer) {
    const serialize = new (await this._getSerializeConstructor())();
    this._xterm.loadAddon(serialize);
    const options = {
      scrollback: this._xterm.options.scrollback
    };
    if (normalBufferOnly) {
      options.excludeAltBuffer = true;
      options.excludeModes = true;
    }
    let serialized;
    if (restoreToLastReviveBuffer && this._rawReviveBuffer) {
      serialized = this._rawReviveBuffer;
    } else {
      serialized = serialize.serialize(options);
    }
    return {
      events: [
        {
          cols: this._xterm.cols,
          rows: this._xterm.rows,
          data: serialized
        }
      ],
      commands: this._shellIntegrationAddon.serialize()
    };
  }
  async setUnicodeVersion(version) {
    if (this._xterm.unicode.activeVersion === version) {
      return;
    }
    if (version === "11") {
      this._unicodeAddon = new (await this._getUnicode11Constructor())();
      this._xterm.loadAddon(this._unicodeAddon);
    } else {
      this._unicodeAddon?.dispose();
      this._unicodeAddon = void 0;
    }
    this._xterm.unicode.activeVersion = version;
  }
  async _getUnicode11Constructor() {
    if (!Unicode11Addon) {
      Unicode11Addon = (await import("@xterm/addon-unicode11")).Unicode11Addon;
    }
    return Unicode11Addon;
  }
  async _getSerializeConstructor() {
    if (!SerializeAddon) {
      SerializeAddon = (await import("@xterm/addon-serialize")).SerializeAddon;
    }
    return SerializeAddon;
  }
}
function printTime(ms) {
  let h = 0;
  let m = 0;
  let s = 0;
  if (ms >= 1e3) {
    s = Math.floor(ms / 1e3);
    ms -= s * 1e3;
  }
  if (s >= 60) {
    m = Math.floor(s / 60);
    s -= m * 60;
  }
  if (m >= 60) {
    h = Math.floor(m / 60);
    m -= h * 60;
  }
  const _h = h ? `${h}h` : ``;
  const _m = m ? `${m}m` : ``;
  const _s = s ? `${s}s` : ``;
  const _ms = ms ? `${ms}ms` : ``;
  return `${_h}${_m}${_s}${_ms}`;
}
export {
  PtyService,
  traceRpc
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3B0eVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBleGVjRmlsZSwgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgQXV0b09wZW5CYXJyaWVyLCBQcm9jZXNzVGltZVJ1bk9uY2VTY2hlZHVsZXIsIFByb21pc2VzLCBRdWV1ZSwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzV2luZG93cywgT3BlcmF0aW5nU3lzdGVtLCBPUyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZXRTeXN0ZW1TaGVsbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9zaGVsbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTG9nTGV2ZWwgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBSZXF1ZXN0U3RvcmUgfSBmcm9tICcuLi9jb21tb24vcmVxdWVzdFN0b3JlLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRGF0YUV2ZW50LCBJUHJvY2Vzc1JlYWR5RXZlbnQsIElQdHlTZXJ2aWNlLCBJUmF3VGVybWluYWxJbnN0YW5jZUxheW91dEluZm8sIElSZWNvbm5lY3RDb25zdGFudHMsIElTaGVsbExhdW5jaENvbmZpZywgSVRlcm1pbmFsSW5zdGFuY2VMYXlvdXRJbmZvQnlJZCwgSVRlcm1pbmFsTGF1bmNoRXJyb3IsIElUZXJtaW5hbHNMYXlvdXRJbmZvLCBJVGVybWluYWxUYWJMYXlvdXRJbmZvQnlJZCwgVGVybWluYWxJY29uLCBJUHJvY2Vzc1Byb3BlcnR5LCBUaXRsZUV2ZW50U291cmNlLCBQcm9jZXNzUHJvcGVydHlUeXBlLCBJUHJvY2Vzc1Byb3BlcnR5TWFwLCBJRml4ZWRUZXJtaW5hbERpbWVuc2lvbnMsIElQZXJzaXN0ZW50VGVybWluYWxQcm9jZXNzTGF1bmNoQ29uZmlnLCBJQ3Jvc3NWZXJzaW9uU2VyaWFsaXplZFRlcm1pbmFsU3RhdGUsIElTZXJpYWxpemVkVGVybWluYWxTdGF0ZSwgSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsIElQdHlIb3N0TGF0ZW5jeU1lYXN1cmVtZW50LCB0eXBlIElQdHlTZXJ2aWNlQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsRGF0YUJ1ZmZlcmVyIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsRGF0YUJ1ZmZlcmluZy5qcyc7XG5pbXBvcnQgeyBlc2NhcGVOb25XaW5kb3dzUGF0aCB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbEVudmlyb25tZW50LmpzJztcbmltcG9ydCB0eXBlIHsgSVNlcmlhbGl6ZU9wdGlvbnMsIFNlcmlhbGl6ZUFkZG9uIGFzIFh0ZXJtU2VyaWFsaXplQWRkb24gfSBmcm9tICdAeHRlcm0vYWRkb24tc2VyaWFsaXplJztcbmltcG9ydCB0eXBlIHsgVW5pY29kZTExQWRkb24gYXMgWHRlcm1Vbmljb2RlMTFBZGRvbiB9IGZyb20gJ0B4dGVybS9hZGRvbi11bmljb2RlMTEnO1xuaW1wb3J0IHsgSUdldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MsIElQcm9jZXNzRGV0YWlscywgSVNldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MsIElUZXJtaW5hbFRhYkxheW91dEluZm9EdG8gfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxQcm9jZXNzLmpzJztcbmltcG9ydCB7IGdldFdpbmRvd3NCdWlsZE51bWJlciB9IGZyb20gJy4vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFByb2Nlc3MgfSBmcm9tICcuL3Rlcm1pbmFsUHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBpZ25vcmVQcm9jZXNzTmFtZXMgfSBmcm9tICcuL2NoaWxkUHJvY2Vzc01vbml0b3IuanMnO1xuaW1wb3J0IHsgRXJyb3JOb1RlbGVtZXRyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBTaGVsbEludGVncmF0aW9uQWRkb24gfSBmcm9tICcuLi9jb21tb24veHRlcm0vc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmpzJztcbmltcG9ydCB7IGZvcm1hdE1lc3NhZ2VGb3JUZXJtaW5hbCB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVB0eUhvc3RQcm9jZXNzUmVwbGF5RXZlbnQgfSBmcm9tICcuLi9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgKiBhcyBwZXJmb3JtYW5jZSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJ0B4dGVybS9oZWFkbGVzcyc7XG5pbXBvcnQgeyBBdXRvUmVwbGllc1B0eVNlcnZpY2VDb250cmlidXRpb24gfSBmcm9tICcuL3Rlcm1pbmFsQ29udHJpYi9hdXRvUmVwbGllcy9hdXRvUmVwbGllc0NvbnRyaWJDb250cm9sbGVyLmpzJztcblxudHlwZSBYdGVybVRlcm1pbmFsID0gcGtnLlRlcm1pbmFsO1xuY29uc3QgeyBUZXJtaW5hbDogWHRlcm1UZXJtaW5hbCB9ID0gcGtnO1xuXG5leHBvcnQgZnVuY3Rpb24gdHJhY2VScGMoX3RhcmdldDogYW55LCBrZXk6IHN0cmluZywgZGVzY3JpcHRvcjogYW55KSB7XG5cdGlmICh0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdHRocm93IG5ldyBFcnJvcignbm90IHN1cHBvcnRlZCcpO1xuXHR9XG5cdGNvbnN0IGZuS2V5ID0gJ3ZhbHVlJztcblx0Y29uc3QgZm4gPSBkZXNjcmlwdG9yLnZhbHVlO1xuXHRkZXNjcmlwdG9yW2ZuS2V5XSA9IGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuXHRcdGlmICh0aGlzLnRyYWNlUnBjQXJncy5sb2dTZXJ2aWNlLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHR0aGlzLnRyYWNlUnBjQXJncy5sb2dTZXJ2aWNlLnRyYWNlKGBbUlBDIFJlcXVlc3RdIFB0eVNlcnZpY2UjJHtmbi5uYW1lfSgke2FyZ3MubWFwKGUgPT4gSlNPTi5zdHJpbmdpZnkoZSkpLmpvaW4oJywgJyl9KWApO1xuXHRcdH1cblx0XHRpZiAodGhpcy50cmFjZVJwY0FyZ3Muc2ltdWxhdGVkTGF0ZW5jeSkge1xuXHRcdFx0YXdhaXQgdGltZW91dCh0aGlzLnRyYWNlUnBjQXJncy5zaW11bGF0ZWRMYXRlbmN5KTtcblx0XHR9XG5cdFx0bGV0IHJlc3VsdDogYW55O1xuXHRcdHRyeSB7XG5cdFx0XHRyZXN1bHQgPSBhd2FpdCBmbi5hcHBseSh0aGlzLCBhcmdzKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLnRyYWNlUnBjQXJncy5sb2dTZXJ2aWNlLmVycm9yKGBbUlBDIFJlc3BvbnNlXSBQdHlTZXJ2aWNlIyR7Zm4ubmFtZX1gLCBlKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnRyYWNlUnBjQXJncy5sb2dTZXJ2aWNlLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHR0aGlzLnRyYWNlUnBjQXJncy5sb2dTZXJ2aWNlLnRyYWNlKGBbUlBDIFJlc3BvbnNlXSBQdHlTZXJ2aWNlIyR7Zm4ubmFtZX1gLCByZXN1bHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xufVxuXG50eXBlIFdvcmtzcGFjZUlkID0gc3RyaW5nO1xuXG5sZXQgU2VyaWFsaXplQWRkb246IHR5cGVvZiBYdGVybVNlcmlhbGl6ZUFkZG9uO1xubGV0IFVuaWNvZGUxMUFkZG9uOiB0eXBlb2YgWHRlcm1Vbmljb2RlMTFBZGRvbjtcblxuZXhwb3J0IGNsYXNzIFB0eVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVB0eVNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wdHlzOiBNYXA8bnVtYmVyLCBQZXJzaXN0ZW50VGVybWluYWxQcm9jZXNzPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlTGF5b3V0SW5mb3MgPSBuZXcgTWFwPFdvcmtzcGFjZUlkLCBJU2V0VGVybWluYWxMYXlvdXRJbmZvQXJncz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGV0YWNoSW5zdGFuY2VSZXF1ZXN0U3RvcmU6IFJlcXVlc3RTdG9yZTxJUHJvY2Vzc0RldGFpbHMgfCB1bmRlZmluZWQsIHsgd29ya3NwYWNlSWQ6IHN0cmluZzsgaW5zdGFuY2VJZDogbnVtYmVyIH0+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXZpdmVkUHR5SWRNYXA6IE1hcDxzdHJpbmcsIHsgbmV3SWQ6IG51bWJlcjsgc3RhdGU6IElTZXJpYWxpemVkVGVybWluYWxTdGF0ZSB9PiA9IG5ldyBNYXAoKTtcblxuXHQvLyAjcmVnaW9uIFB0eSBzZXJ2aWNlIGNvbnRyaWJ1dGlvbiBSUEMgY2FsbHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hdXRvUmVwbGllc0NvbnRyaWJ1dGlvbiA9IG5ldyBBdXRvUmVwbGllc1B0eVNlcnZpY2VDb250cmlidXRpb24odGhpcy5fbG9nU2VydmljZSk7XG5cdEB0cmFjZVJwY1xuXHRhc3luYyBpbnN0YWxsQXV0b1JlcGx5KG1hdGNoOiBzdHJpbmcsIHJlcGx5OiBzdHJpbmcpIHtcblx0XHRhd2FpdCB0aGlzLl9hdXRvUmVwbGllc0NvbnRyaWJ1dGlvbi5pbnN0YWxsQXV0b1JlcGx5KG1hdGNoLCByZXBseSk7XG5cdH1cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHVuaW5zdGFsbEFsbEF1dG9SZXBsaWVzKCkge1xuXHRcdGF3YWl0IHRoaXMuX2F1dG9SZXBsaWVzQ29udHJpYnV0aW9uLnVuaW5zdGFsbEFsbEF1dG9SZXBsaWVzKCk7XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29udHJpYnV0aW9uczogSVB0eVNlcnZpY2VDb250cmlidXRpb25bXSA9IFtcblx0XHR0aGlzLl9hdXRvUmVwbGllc0NvbnRyaWJ1dGlvblxuXHRdO1xuXG5cdHByaXZhdGUgX2xhc3RQdHlJZDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkhlYXJ0YmVhdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkhlYXJ0YmVhdCA9IHRoaXMuX3RyYWNlRXZlbnQoJ19vbkhlYXJ0YmVhdCcsIHRoaXMuX29uSGVhcnRiZWF0LmV2ZW50KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NEYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBpZDogbnVtYmVyOyBldmVudDogSVByb2Nlc3NEYXRhRXZlbnQgfCBzdHJpbmcgfT4oKSk7XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc0RhdGEgPSB0aGlzLl90cmFjZUV2ZW50KCdfb25Qcm9jZXNzRGF0YScsIHRoaXMuX29uUHJvY2Vzc0RhdGEuZXZlbnQpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZXBsYXkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGlkOiBudW1iZXI7IGV2ZW50OiBJUHR5SG9zdFByb2Nlc3NSZXBsYXlFdmVudCB9PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzUmVwbGF5ID0gdGhpcy5fdHJhY2VFdmVudCgnX29uUHJvY2Vzc1JlcGxheScsIHRoaXMuX29uUHJvY2Vzc1JlcGxheS5ldmVudCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc1JlYWR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBpZDogbnVtYmVyOyBldmVudDogSVByb2Nlc3NSZWFkeUV2ZW50IH0+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZWFkeSA9IHRoaXMuX3RyYWNlRXZlbnQoJ19vblByb2Nlc3NSZWFkeScsIHRoaXMuX29uUHJvY2Vzc1JlYWR5LmV2ZW50KTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzRXhpdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IG51bWJlcjsgZXZlbnQ6IG51bWJlciB8IHVuZGVmaW5lZCB9PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzRXhpdCA9IHRoaXMuX3RyYWNlRXZlbnQoJ19vblByb2Nlc3NFeGl0JywgdGhpcy5fb25Qcm9jZXNzRXhpdC5ldmVudCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc09ycGhhblF1ZXN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBpZDogbnVtYmVyIH0+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NPcnBoYW5RdWVzdGlvbiA9IHRoaXMuX3RyYWNlRXZlbnQoJ19vblByb2Nlc3NPcnBoYW5RdWVzdGlvbicsIHRoaXMuX29uUHJvY2Vzc09ycGhhblF1ZXN0aW9uLmV2ZW50KTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXF1ZXN0RGV0YWNoID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZXF1ZXN0SWQ6IG51bWJlcjsgd29ya3NwYWNlSWQ6IHN0cmluZzsgaW5zdGFuY2VJZDogbnVtYmVyIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3REZXRhY2ggPSB0aGlzLl90cmFjZUV2ZW50KCdfb25EaWRSZXF1ZXN0RGV0YWNoJywgdGhpcy5fb25EaWRSZXF1ZXN0RGV0YWNoLmV2ZW50KTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VQcm9wZXJ0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IG51bWJlcjsgcHJvcGVydHk6IElQcm9jZXNzUHJvcGVydHk8YW55PiB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQcm9wZXJ0eSA9IHRoaXMuX3RyYWNlRXZlbnQoJ19vbkRpZENoYW5nZVByb3BlcnR5JywgdGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5ldmVudCk7XG5cblx0cHJpdmF0ZSBfdHJhY2VFdmVudDxUPihuYW1lOiBzdHJpbmcsIGV2ZW50OiBFdmVudDxUPik6IEV2ZW50PFQ+IHtcblx0XHRldmVudChlID0+IHtcblx0XHRcdGlmICh0aGlzLl9sb2dTZXJ2aWNlLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFtSUEMgRXZlbnRdIFB0eVNlcnZpY2UjJHtuYW1lfS5maXJlKCR7SlNPTi5zdHJpbmdpZnkoZSl9KWApO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCB0cmFjZVJwY0FyZ3MoKTogeyBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZTsgc2ltdWxhdGVkTGF0ZW5jeTogbnVtYmVyIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRsb2dTZXJ2aWNlOiB0aGlzLl9sb2dTZXJ2aWNlLFxuXHRcdFx0c2ltdWxhdGVkTGF0ZW5jeTogdGhpcy5fc2ltdWxhdGVkTGF0ZW5jeVxuXHRcdH07XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlY29ubmVjdENvbnN0YW50czogSVJlY29ubmVjdENvbnN0YW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zaW11bGF0ZWRMYXRlbmN5OiBudW1iZXJcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IHB0eSBvZiB0aGlzLl9wdHlzLnZhbHVlcygpKSB7XG5cdFx0XHRcdHB0eS5zaHV0ZG93bih0cnVlKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3B0eXMuY2xlYXIoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kZXRhY2hJbnN0YW5jZVJlcXVlc3RTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXF1ZXN0U3RvcmUodW5kZWZpbmVkLCB0aGlzLl9sb2dTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fZGV0YWNoSW5zdGFuY2VSZXF1ZXN0U3RvcmUub25DcmVhdGVSZXF1ZXN0KHRoaXMuX29uRGlkUmVxdWVzdERldGFjaC5maXJlLCB0aGlzLl9vbkRpZFJlcXVlc3REZXRhY2gpO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHJlZnJlc2hJZ25vcmVQcm9jZXNzTmFtZXMobmFtZXM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWdub3JlUHJvY2Vzc05hbWVzLmxlbmd0aCA9IDA7XG5cdFx0aWdub3JlUHJvY2Vzc05hbWVzLnB1c2goLi4ubmFtZXMpO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHJlcXVlc3REZXRhY2hJbnN0YW5jZSh3b3Jrc3BhY2VJZDogc3RyaW5nLCBpbnN0YW5jZUlkOiBudW1iZXIpOiBQcm9taXNlPElQcm9jZXNzRGV0YWlscyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9kZXRhY2hJbnN0YW5jZVJlcXVlc3RTdG9yZS5jcmVhdGVSZXF1ZXN0KHsgd29ya3NwYWNlSWQsIGluc3RhbmNlSWQgfSk7XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShyZXF1ZXN0SWQ6IG51bWJlciwgcGVyc2lzdGVudFByb2Nlc3NJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHByb2Nlc3NEZXRhaWxzOiBJUHJvY2Vzc0RldGFpbHMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcHR5ID0gdGhpcy5fcHR5cy5nZXQocGVyc2lzdGVudFByb2Nlc3NJZCk7XG5cdFx0aWYgKHB0eSkge1xuXHRcdFx0cHJvY2Vzc0RldGFpbHMgPSBhd2FpdCB0aGlzLl9idWlsZFByb2Nlc3NEZXRhaWxzKHBlcnNpc3RlbnRQcm9jZXNzSWQsIHB0eSk7XG5cdFx0fVxuXHRcdHRoaXMuX2RldGFjaEluc3RhbmNlUmVxdWVzdFN0b3JlLmFjY2VwdFJlcGx5KHJlcXVlc3RJZCwgcHJvY2Vzc0RldGFpbHMpO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIGZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydDogc3RyaW5nKTogUHJvbWlzZTx7IHBvcnQ6IHN0cmluZzsgcHJvY2Vzc0lkOiBzdHJpbmcgfT4ge1xuXHRcdGNvbnN0IHN0ZG91dCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0ZXhlYyhpc1dpbmRvd3MgPyBgbmV0c3RhdCAtYW5vIHwgZmluZHN0ciBcIiR7cG9ydH1cImAgOiBgbHNvZiAtblAgLWlUQ1AgLXNUQ1A6TElTVEVOIHwgZ3JlcCAke3BvcnR9YCwge30sIChlcnIsIHN0ZG91dCkgPT4ge1xuXHRcdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdCgnUHJvYmxlbSBvY2N1cnJlZCB3aGVuIGxpc3RpbmcgYWN0aXZlIHByb2Nlc3NlcycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUoc3Rkb3V0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGNvbnN0IHByb2Nlc3Nlc0ZvclBvcnQgPSBzdGRvdXQuc3BsaXQoL1xccj9cXG4vKS5maWx0ZXIocyA9PiAhIXMudHJpbSgpKTtcblx0XHRpZiAocHJvY2Vzc2VzRm9yUG9ydC5sZW5ndGggPj0gMSkge1xuXHRcdFx0Y29uc3QgY2FwdHVyZVBpZCA9IC9cXHMrKFxcZCspKD86XFxzK3wkKS87XG5cdFx0XHRjb25zdCBwcm9jZXNzSWQgPSBwcm9jZXNzZXNGb3JQb3J0WzBdLm1hdGNoKGNhcHR1cmVQaWQpPy5bMV07XG5cdFx0XHRpZiAocHJvY2Vzc0lkKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cHJvY2Vzcy5raWxsKE51bWJlci5wYXJzZUludChwcm9jZXNzSWQpKTtcblx0XHRcdFx0fSBjYXRjaCB7IH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgUHJvY2Vzc2VzIGZvciBwb3J0ICR7cG9ydH0gd2VyZSBub3QgZm91bmRgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7IHBvcnQsIHByb2Nlc3NJZCB9O1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBraWxsIHByb2Nlc3Mgd2l0aCBwb3J0ICR7cG9ydH1gKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBzZXJpYWxpemVUZXJtaW5hbFN0YXRlKGlkczogbnVtYmVyW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPElTZXJpYWxpemVkVGVybWluYWxTdGF0ZT5bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW3BlcnNpc3RlbnRQcm9jZXNzSWQsIHBlcnNpc3RlbnRQcm9jZXNzXSBvZiB0aGlzLl9wdHlzLmVudHJpZXMoKSkge1xuXHRcdFx0Ly8gT25seSBzZXJpYWxpemUgcGVyc2lzdGVudCBwcm9jZXNzZXMgdGhhdCBoYXZlIGhhZCBkYXRhIHdyaXR0ZW4gb3IgcGVyZm9ybWVkIGEgcmVwbGF5XG5cdFx0XHRpZiAocGVyc2lzdGVudFByb2Nlc3MuaGFzV3JpdHRlbkRhdGEgJiYgaWRzLmluZGV4T2YocGVyc2lzdGVudFByb2Nlc3NJZCkgIT09IC0xKSB7XG5cdFx0XHRcdHByb21pc2VzLnB1c2goUHJvbWlzZXMud2l0aEFzeW5jQm9keTxJU2VyaWFsaXplZFRlcm1pbmFsU3RhdGU+KGFzeW5jIHIgPT4ge1xuXHRcdFx0XHRcdHIoe1xuXHRcdFx0XHRcdFx0aWQ6IHBlcnNpc3RlbnRQcm9jZXNzSWQsXG5cdFx0XHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZzogcGVyc2lzdGVudFByb2Nlc3Muc2hlbGxMYXVuY2hDb25maWcsXG5cdFx0XHRcdFx0XHRwcm9jZXNzRGV0YWlsczogYXdhaXQgdGhpcy5fYnVpbGRQcm9jZXNzRGV0YWlscyhwZXJzaXN0ZW50UHJvY2Vzc0lkLCBwZXJzaXN0ZW50UHJvY2VzcyksXG5cdFx0XHRcdFx0XHRwcm9jZXNzTGF1bmNoQ29uZmlnOiBwZXJzaXN0ZW50UHJvY2Vzcy5wcm9jZXNzTGF1bmNoT3B0aW9ucyxcblx0XHRcdFx0XHRcdHVuaWNvZGVWZXJzaW9uOiBwZXJzaXN0ZW50UHJvY2Vzcy51bmljb2RlVmVyc2lvbixcblx0XHRcdFx0XHRcdHJlcGxheUV2ZW50OiBhd2FpdCBwZXJzaXN0ZW50UHJvY2Vzcy5zZXJpYWxpemVOb3JtYWxCdWZmZXIoKSxcblx0XHRcdFx0XHRcdHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHNlcmlhbGl6ZWQ6IElDcm9zc1ZlcnNpb25TZXJpYWxpemVkVGVybWluYWxTdGF0ZSA9IHtcblx0XHRcdHZlcnNpb246IDEsXG5cdFx0XHRzdGF0ZTogYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpXG5cdFx0fTtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplZCk7XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgcmV2aXZlVGVybWluYWxQcm9jZXNzZXMod29ya3NwYWNlSWQ6IHN0cmluZywgc3RhdGU6IElTZXJpYWxpemVkVGVybWluYWxTdGF0ZVtdLCBkYXRlVGltZUZvcm1hdExvY2FsZTogc3RyaW5nKSB7XG5cdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgdGVybWluYWwgb2Ygc3RhdGUpIHtcblx0XHRcdHByb21pc2VzLnB1c2godGhpcy5fcmV2aXZlVGVybWluYWxQcm9jZXNzKHdvcmtzcGFjZUlkLCB0ZXJtaW5hbCkpO1xuXHRcdH1cblx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXZpdmVUZXJtaW5hbFByb2Nlc3Mod29ya3NwYWNlSWQ6IHN0cmluZywgdGVybWluYWw6IElTZXJpYWxpemVkVGVybWluYWxTdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3RvcmVNZXNzYWdlID0gbG9jYWxpemUoJ3Rlcm1pbmFsLWhpc3RvcnktcmVzdG9yZWQnLCBcIkhpc3RvcnkgcmVzdG9yZWRcIik7XG5cblx0XHQvLyBDb25wdHkgdjEuMjIrIHVzZXMgcGFzc3Rocm91Z2ggYW5kIGRvZXNuJ3QgcmVwcmludCB0aGUgYnVmZmVyIG9mdGVuLCB0aGlzIG1lYW5zIHRoYXQgd2hlblxuXHRcdC8vIHRoZSB0ZXJtaW5hbCBpcyByZXZpdmVkLCB0aGUgY3Vyc29yIHdvdWxkIGJlIGF0IHRoZSBib3R0b20gb2YgdGhlIGJ1ZmZlciB0aGVuIHdoZW5cblx0XHQvLyBQU1JlYWRMaW5lIHJlcXVlc3RzIGBHZXRDb25zb2xlQ3Vyc29ySW5mb2AgaXQgd2lsbCBiZSBoYW5kbGVkIGJ5IGNvbnB0eSBpdHNlbGYgYnkgZGVzaWduLlxuXHRcdC8vIFRoaXMgY2F1c2VzIHRoZSBjdXJzb3IgdG8gbW92ZSB0byB0aGUgdG9wIGludG8gdGhlIHJlcGxheWVkIHRlcm1pbmFsIGNvbnRlbnRzLiBUbyBhdm9pZFxuXHRcdC8vIHRoaXMsIHRoZSBwb3N0IHJlc3RvcmUgbWVzc2FnZSB3aWxsIHByaW50IG5ldyBsaW5lcyB0byBnZXQgYSBjbGVhciB2aWV3cG9ydCBhbmQgcHV0IHRoZVxuXHRcdC8vIGN1cnNvciBiYWNrIGF0IHRvIHRvcCBsZWZ0LlxuXHRcdGxldCBwb3N0UmVzdG9yZU1lc3NhZ2UgPSAnJztcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBsYXN0UmVwbGF5RXZlbnQgPSB0ZXJtaW5hbC5yZXBsYXlFdmVudC5ldmVudHMubGVuZ3RoID4gMCA/IHRlcm1pbmFsLnJlcGxheUV2ZW50LmV2ZW50cy5hdCgtMSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAobGFzdFJlcGxheUV2ZW50KSB7XG5cdFx0XHRcdHBvc3RSZXN0b3JlTWVzc2FnZSArPSAnXFxyXFxuJy5yZXBlYXQobGFzdFJlcGxheUV2ZW50LnJvd3MgLSAxKSArIGBcXHgxYltIYDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUT0RPOiBXZSBtYXkgYXQgc29tZSBwb2ludCB3YW50IHRvIHNob3cgZGF0ZSBpbmZvcm1hdGlvbiBpbiBhIGhvdmVyIHZpYSBhIGN1c3RvbSBzZXF1ZW5jZTpcblx0XHQvLyAgIG5ldyBEYXRlKHRlcm1pbmFsLnRpbWVzdGFtcCkudG9Mb2NhbGVEYXRlU3RyaW5nKGRhdGVUaW1lRm9ybWF0TG9jYWxlKVxuXHRcdC8vICAgbmV3IERhdGUodGVybWluYWwudGltZXN0YW1wKS50b0xvY2FsZVRpbWVTdHJpbmcoZGF0ZVRpbWVGb3JtYXRMb2NhbGUpXG5cdFx0Y29uc3QgbmV3SWQgPSBhd2FpdCB0aGlzLmNyZWF0ZVByb2Nlc3MoXG5cdFx0XHR7XG5cdFx0XHRcdC4uLnRlcm1pbmFsLnNoZWxsTGF1bmNoQ29uZmlnLFxuXHRcdFx0XHRjd2Q6IHRlcm1pbmFsLnByb2Nlc3NEZXRhaWxzLmN3ZCxcblx0XHRcdFx0Y29sb3I6IHRlcm1pbmFsLnByb2Nlc3NEZXRhaWxzLmNvbG9yLFxuXHRcdFx0XHRpY29uOiB0ZXJtaW5hbC5wcm9jZXNzRGV0YWlscy5pY29uLFxuXHRcdFx0XHRuYW1lOiB0ZXJtaW5hbC5wcm9jZXNzRGV0YWlscy50aXRsZVNvdXJjZSA9PT0gVGl0bGVFdmVudFNvdXJjZS5BcGkgPyB0ZXJtaW5hbC5wcm9jZXNzRGV0YWlscy50aXRsZSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0aW5pdGlhbFRleHQ6IHRlcm1pbmFsLnJlcGxheUV2ZW50LmV2ZW50c1swXS5kYXRhICsgZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsKHJlc3RvcmVNZXNzYWdlLCB7IGxvdWRGb3JtYXR0aW5nOiB0cnVlIH0pICsgcG9zdFJlc3RvcmVNZXNzYWdlXG5cdFx0XHR9LFxuXHRcdFx0dGVybWluYWwucHJvY2Vzc0RldGFpbHMuY3dkLFxuXHRcdFx0dGVybWluYWwucmVwbGF5RXZlbnQuZXZlbnRzWzBdLmNvbHMsXG5cdFx0XHR0ZXJtaW5hbC5yZXBsYXlFdmVudC5ldmVudHNbMF0ucm93cyxcblx0XHRcdHRlcm1pbmFsLnVuaWNvZGVWZXJzaW9uLFxuXHRcdFx0dGVybWluYWwucHJvY2Vzc0xhdW5jaENvbmZpZy5lbnYsXG5cdFx0XHR0ZXJtaW5hbC5wcm9jZXNzTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGVFbnYsXG5cdFx0XHR0ZXJtaW5hbC5wcm9jZXNzTGF1bmNoQ29uZmlnLm9wdGlvbnMsXG5cdFx0XHR0cnVlLFxuXHRcdFx0dGVybWluYWwucHJvY2Vzc0RldGFpbHMud29ya3NwYWNlSWQsXG5cdFx0XHR0ZXJtaW5hbC5wcm9jZXNzRGV0YWlscy53b3Jrc3BhY2VOYW1lLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRlcm1pbmFsLnJlcGxheUV2ZW50LmV2ZW50c1swXS5kYXRhXG5cdFx0KTtcblx0XHQvLyBEb24ndCBzdGFydCB0aGUgcHJvY2VzcyBoZXJlIGFzIHRoZXJlJ3Mgbm8gdGVybWluYWwgdG8gYW5zd2VyIENQUlxuXHRcdGNvbnN0IG9sZElkID0gdGhpcy5fZ2V0UmV2aXZpbmdQcm9jZXNzSWQod29ya3NwYWNlSWQsIHRlcm1pbmFsLmlkKTtcblx0XHR0aGlzLl9yZXZpdmVkUHR5SWRNYXAuc2V0KG9sZElkLCB7IG5ld0lkLCBzdGF0ZTogdGVybWluYWwgfSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBSZXZpdmVkIHByb2Nlc3MsIG9sZCBpZCAke29sZElkfSAtPiBuZXcgaWQgJHtuZXdJZH1gKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBzaHV0ZG93bkFsbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBjcmVhdGVQcm9jZXNzKFxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsXG5cdFx0Y3dkOiBzdHJpbmcsXG5cdFx0Y29sczogbnVtYmVyLFxuXHRcdHJvd3M6IG51bWJlcixcblx0XHR1bmljb2RlVmVyc2lvbjogJzYnIHwgJzExJyxcblx0XHRlbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsXG5cdFx0ZXhlY3V0YWJsZUVudjogSVByb2Nlc3NFbnZpcm9ubWVudCxcblx0XHRvcHRpb25zOiBJVGVybWluYWxQcm9jZXNzT3B0aW9ucyxcblx0XHRzaG91bGRQZXJzaXN0OiBib29sZWFuLFxuXHRcdHdvcmtzcGFjZUlkOiBzdHJpbmcsXG5cdFx0d29ya3NwYWNlTmFtZTogc3RyaW5nLFxuXHRcdGlzUmV2aXZpbmc/OiBib29sZWFuLFxuXHRcdHJhd1Jldml2ZUJ1ZmZlcj86IHN0cmluZ1xuXHQpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdBdHRlbXB0IHRvIGNyZWF0ZSBhIHByb2Nlc3Mgd2hlbiBhdHRhY2ggb2JqZWN0IHdhcyBwcm92aWRlZCcpO1xuXHRcdH1cblx0XHRjb25zdCBpZCA9ICsrdGhpcy5fbGFzdFB0eUlkO1xuXHRcdGNvbnN0IHByb2Nlc3MgPSBuZXcgVGVybWluYWxQcm9jZXNzKHNoZWxsTGF1bmNoQ29uZmlnLCBjd2QsIGNvbHMsIHJvd3MsIGVudiwgZXhlY3V0YWJsZUVudiwgb3B0aW9ucywgdGhpcy5fbG9nU2VydmljZSwgdGhpcy5fcHJvZHVjdFNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb2Nlc3NMYXVuY2hPcHRpb25zOiBJUGVyc2lzdGVudFRlcm1pbmFsUHJvY2Vzc0xhdW5jaENvbmZpZyA9IHtcblx0XHRcdGVudixcblx0XHRcdGV4ZWN1dGFibGVFbnYsXG5cdFx0XHRvcHRpb25zXG5cdFx0fTtcblx0XHRjb25zdCBwZXJzaXN0ZW50UHJvY2VzcyA9IG5ldyBQZXJzaXN0ZW50VGVybWluYWxQcm9jZXNzKGlkLCBwcm9jZXNzLCB3b3Jrc3BhY2VJZCwgd29ya3NwYWNlTmFtZSwgc2hvdWxkUGVyc2lzdCwgY29scywgcm93cywgcHJvY2Vzc0xhdW5jaE9wdGlvbnMsIHVuaWNvZGVWZXJzaW9uLCB0aGlzLl9yZWNvbm5lY3RDb25zdGFudHMsIHRoaXMuX2xvZ1NlcnZpY2UsIGlzUmV2aXZpbmcgJiYgdHlwZW9mIHNoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0ID09PSAnc3RyaW5nJyA/IHNoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0IDogdW5kZWZpbmVkLCByYXdSZXZpdmVCdWZmZXIsIHNoZWxsTGF1bmNoQ29uZmlnLmljb24sIHNoZWxsTGF1bmNoQ29uZmlnLmNvbG9yLCBzaGVsbExhdW5jaENvbmZpZy5uYW1lLCBzaGVsbExhdW5jaENvbmZpZy5maXhlZERpbWVuc2lvbnMpO1xuXHRcdHByb2Nlc3Mub25Qcm9jZXNzRXhpdChldmVudCA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgdGhpcy5fY29udHJpYnV0aW9ucykge1xuXHRcdFx0XHRjb250cmliLmhhbmRsZVByb2Nlc3NEaXNwb3NlKGlkKTtcblx0XHRcdH1cblx0XHRcdHBlcnNpc3RlbnRQcm9jZXNzLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3B0eXMuZGVsZXRlKGlkKTtcblx0XHRcdHRoaXMuX29uUHJvY2Vzc0V4aXQuZmlyZSh7IGlkLCBldmVudCB9KTtcblx0XHR9KTtcblx0XHRwZXJzaXN0ZW50UHJvY2Vzcy5vblByb2Nlc3NEYXRhKGV2ZW50ID0+IHRoaXMuX29uUHJvY2Vzc0RhdGEuZmlyZSh7IGlkLCBldmVudCB9KSk7XG5cdFx0cGVyc2lzdGVudFByb2Nlc3Mub25Qcm9jZXNzUmVwbGF5KGV2ZW50ID0+IHRoaXMuX29uUHJvY2Vzc1JlcGxheS5maXJlKHsgaWQsIGV2ZW50IH0pKTtcblx0XHRwZXJzaXN0ZW50UHJvY2Vzcy5vblByb2Nlc3NSZWFkeShldmVudCA9PiB0aGlzLl9vblByb2Nlc3NSZWFkeS5maXJlKHsgaWQsIGV2ZW50IH0pKTtcblx0XHRwZXJzaXN0ZW50UHJvY2Vzcy5vblByb2Nlc3NPcnBoYW5RdWVzdGlvbigoKSA9PiB0aGlzLl9vblByb2Nlc3NPcnBoYW5RdWVzdGlvbi5maXJlKHsgaWQgfSkpO1xuXHRcdHBlcnNpc3RlbnRQcm9jZXNzLm9uRGlkQ2hhbmdlUHJvcGVydHkocHJvcGVydHkgPT4gdGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5maXJlKHsgaWQsIHByb3BlcnR5IH0pKTtcblx0XHRwZXJzaXN0ZW50UHJvY2Vzcy5vblBlcnNpc3RlbnRQcm9jZXNzUmVhZHkoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBjb250cmliIG9mIHRoaXMuX2NvbnRyaWJ1dGlvbnMpIHtcblx0XHRcdFx0Y29udHJpYi5oYW5kbGVQcm9jZXNzUmVhZHkoaWQsIHByb2Nlc3MpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3B0eXMuc2V0KGlkLCBwZXJzaXN0ZW50UHJvY2Vzcyk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIGF0dGFjaFRvUHJvY2VzcyhpZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuX3Rocm93SWZOb1B0eShpZCkuYXR0YWNoKCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYFBlcnNpc3RlbnQgcHJvY2VzcyByZWNvbm5lY3Rpb24gXCIke2lkfVwiYCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKGBQZXJzaXN0ZW50IHByb2Nlc3MgcmVjb25uZWN0aW9uIFwiJHtpZH1cIiBmYWlsZWRgLCBlLm1lc3NhZ2UpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgdXBkYXRlVGl0bGUoaWQ6IG51bWJlciwgdGl0bGU6IHN0cmluZywgdGl0bGVTb3VyY2U6IFRpdGxlRXZlbnRTb3VyY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl90aHJvd0lmTm9QdHkoaWQpLnNldFRpdGxlKHRpdGxlLCB0aXRsZVNvdXJjZSk7XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgdXBkYXRlSWNvbihpZDogbnVtYmVyLCB1c2VySW5pdGlhdGVkOiBib29sZWFuLCBpY29uOiBVUkkgfCB7IGxpZ2h0OiBVUkk7IGRhcms6IFVSSSB9IHwgeyBpZDogc3RyaW5nOyBjb2xvcj86IHsgaWQ6IHN0cmluZyB9IH0sIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fdGhyb3dJZk5vUHR5KGlkKS5zZXRJY29uKHVzZXJJbml0aWF0ZWQsIGljb24sIGNvbG9yKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBjbGVhckJ1ZmZlcihpZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fdGhyb3dJZk5vUHR5KGlkKS5jbGVhckJ1ZmZlcigpO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHJlZnJlc2hQcm9wZXJ0eTxUIGV4dGVuZHMgUHJvY2Vzc1Byb3BlcnR5VHlwZT4oaWQ6IG51bWJlciwgdHlwZTogVCk6IFByb21pc2U8SVByb2Nlc3NQcm9wZXJ0eU1hcFtUXT4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLnJlZnJlc2hQcm9wZXJ0eSh0eXBlKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyB1cGRhdGVQcm9wZXJ0eTxUIGV4dGVuZHMgUHJvY2Vzc1Byb3BlcnR5VHlwZT4oaWQ6IG51bWJlciwgdHlwZTogVCwgdmFsdWU6IElQcm9jZXNzUHJvcGVydHlNYXBbVF0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fdGhyb3dJZk5vUHR5KGlkKS51cGRhdGVQcm9wZXJ0eSh0eXBlLCB2YWx1ZSk7XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgZGV0YWNoRnJvbVByb2Nlc3MoaWQ6IG51bWJlciwgZm9yY2VQZXJzaXN0PzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLmRldGFjaChmb3JjZVBlcnNpc3QpO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBwdHkgb2YgdGhpcy5fcHR5cy52YWx1ZXMoKSkge1xuXHRcdFx0cHR5LnJlZHVjZUdyYWNlVGltZSgpO1xuXHRcdH1cblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBsaXN0UHJvY2Vzc2VzKCk6IFByb21pc2U8SVByb2Nlc3NEZXRhaWxzW10+IHtcblx0XHRjb25zdCBwZXJzaXN0ZW50UHJvY2Vzc2VzID0gQXJyYXkuZnJvbSh0aGlzLl9wdHlzLmVudHJpZXMoKSkuZmlsdGVyKChbXywgcHR5XSkgPT4gcHR5LnNob3VsZFBlcnNpc3RUZXJtaW5hbCk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYExpc3RpbmcgJHtwZXJzaXN0ZW50UHJvY2Vzc2VzLmxlbmd0aH0gcGVyc2lzdGVudCB0ZXJtaW5hbHMsICR7dGhpcy5fcHR5cy5zaXplfSB0b3RhbCB0ZXJtaW5hbHNgKTtcblx0XHRjb25zdCBwcm9taXNlcyA9IHBlcnNpc3RlbnRQcm9jZXNzZXMubWFwKGFzeW5jIChbaWQsIHRlcm1pbmFsUHJvY2Vzc0RhdGFdKSA9PiB0aGlzLl9idWlsZFByb2Nlc3NEZXRhaWxzKGlkLCB0ZXJtaW5hbFByb2Nlc3NEYXRhKSk7XG5cdFx0Y29uc3QgYWxsVGVybWluYWxzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdHJldHVybiBhbGxUZXJtaW5hbHMuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LmlzT3JwaGFuKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXRQZXJmb3JtYW5jZU1hcmtzKCk6IFByb21pc2U8cGVyZm9ybWFuY2UuUGVyZm9ybWFuY2VNYXJrW10+IHtcblx0XHRyZXR1cm4gcGVyZm9ybWFuY2UuZ2V0TWFya3MoKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBzdGFydChpZDogbnVtYmVyKTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHsgaW5qZWN0ZWRBcmdzOiBzdHJpbmdbXSB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcHR5ID0gdGhpcy5fcHR5cy5nZXQoaWQpO1xuXHRcdHJldHVybiBwdHkgPyBwdHkuc3RhcnQoKSA6IHsgbWVzc2FnZTogYENvdWxkIG5vdCBmaW5kIHB0eSB3aXRoIGlkIFwiJHtpZH1cImAgfTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBzaHV0ZG93bihpZDogbnVtYmVyLCBpbW1lZGlhdGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBEb24ndCB0aHJvdyBpZiB0aGUgcHR5IGlzIGFscmVhZHkgc2h1dGRvd25cblx0XHRyZXR1cm4gdGhpcy5fcHR5cy5nZXQoaWQpPy5zaHV0ZG93bihpbW1lZGlhdGUpO1xuXHR9XG5cdEB0cmFjZVJwY1xuXHRhc3luYyBpbnB1dChpZDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwdHkgPSB0aGlzLl90aHJvd0lmTm9QdHkoaWQpO1xuXHRcdGlmIChwdHkpIHtcblx0XHRcdGZvciAoY29uc3QgY29udHJpYiBvZiB0aGlzLl9jb250cmlidXRpb25zKSB7XG5cdFx0XHRcdGNvbnRyaWIuaGFuZGxlUHJvY2Vzc0lucHV0KGlkLCBkYXRhKTtcblx0XHRcdH1cblx0XHRcdHB0eS5pbnB1dChkYXRhKTtcblx0XHR9XG5cdH1cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHByb2Nlc3NCaW5hcnkoaWQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rocm93SWZOb1B0eShpZCkud3JpdGVCaW5hcnkoZGF0YSk7XG5cdH1cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHJlc2l6ZShpZDogbnVtYmVyLCBjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHB0eSA9IHRoaXMuX3Rocm93SWZOb1B0eShpZCk7XG5cdFx0aWYgKHB0eSkge1xuXHRcdFx0Zm9yIChjb25zdCBjb250cmliIG9mIHRoaXMuX2NvbnRyaWJ1dGlvbnMpIHtcblx0XHRcdFx0Y29udHJpYi5oYW5kbGVQcm9jZXNzUmVzaXplKGlkLCBjb2xzLCByb3dzKTtcblx0XHRcdH1cblx0XHRcdHB0eS5yZXNpemUoY29scywgcm93cyk7XG5cdFx0fVxuXHR9XG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXRJbml0aWFsQ3dkKGlkOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLmdldEluaXRpYWxDd2QoKTtcblx0fVxuXHRAdHJhY2VScGNcblx0YXN5bmMgZ2V0Q3dkKGlkOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLmdldEN3ZCgpO1xuXHR9XG5cdEB0cmFjZVJwY1xuXHRhc3luYyBhY2tub3dsZWRnZURhdGFFdmVudChpZDogbnVtYmVyLCBjaGFyQ291bnQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLmFja25vd2xlZGdlRGF0YUV2ZW50KGNoYXJDb3VudCk7XG5cdH1cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHNldFVuaWNvZGVWZXJzaW9uKGlkOiBudW1iZXIsIHZlcnNpb246ICc2JyB8ICcxMScpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fdGhyb3dJZk5vUHR5KGlkKS5zZXRVbmljb2RlVmVyc2lvbih2ZXJzaW9uKTtcblx0fVxuXHRAdHJhY2VScGNcblx0YXN5bmMgZ2V0TGF0ZW5jeSgpOiBQcm9taXNlPElQdHlIb3N0TGF0ZW5jeU1lYXN1cmVtZW50W10+IHtcblx0XHRyZXR1cm4gW107XG5cdH1cblx0QHRyYWNlUnBjXG5cdGFzeW5jIG9ycGhhblF1ZXN0aW9uUmVwbHkoaWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl90aHJvd0lmTm9QdHkoaWQpLm9ycGhhblF1ZXN0aW9uUmVwbHkoKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXREZWZhdWx0U3lzdGVtU2hlbGwob3NPdmVycmlkZTogT3BlcmF0aW5nU3lzdGVtID0gT1MpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiBnZXRTeXN0ZW1TaGVsbChvc092ZXJyaWRlLCBwcm9jZXNzLmVudik7XG5cdH1cblxuXHRAdHJhY2VScGNcblx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50PiB7XG5cdFx0cmV0dXJuIHsgLi4ucHJvY2Vzcy5lbnYgfTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXRXc2xQYXRoKG9yaWdpbmFsOiBzdHJpbmcsIGRpcmVjdGlvbjogJ3VuaXgtdG8td2luJyB8ICd3aW4tdG8tdW5peCcgfCB1bmtub3duKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoZGlyZWN0aW9uID09PSAnd2luLXRvLXVuaXgnKSB7XG5cdFx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0XHRyZXR1cm4gb3JpZ2luYWw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZ2V0V2luZG93c0J1aWxkTnVtYmVyKCkgPCAxNzA2Mykge1xuXHRcdFx0XHRyZXR1cm4gb3JpZ2luYWwucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgd3NsRXhlY3V0YWJsZSA9IHRoaXMuX2dldFdTTEV4ZWN1dGFibGVQYXRoKCk7XG5cdFx0XHRpZiAoIXdzbEV4ZWN1dGFibGUpIHtcblx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oYyA9PiB7XG5cdFx0XHRcdGNvbnN0IHByb2MgPSBleGVjRmlsZSh3c2xFeGVjdXRhYmxlLCBbJy1lJywgJ3dzbHBhdGgnLCBvcmlnaW5hbF0sIHt9LCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG5cdFx0XHRcdFx0YyhlcnJvciA/IG9yaWdpbmFsIDogZXNjYXBlTm9uV2luZG93c1BhdGgoc3Rkb3V0LnRyaW0oKSkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cHJvYy5zdGRpbiEuZW5kKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKGRpcmVjdGlvbiA9PT0gJ3VuaXgtdG8td2luJykge1xuXHRcdFx0Ly8gVGhlIGJhY2tlbmQgaXMgV2luZG93cywgZm9yIGV4YW1wbGUgYSBsb2NhbCBXaW5kb3dzIHdvcmtzcGFjZSB3aXRoIGEgd3NsIHNlc3Npb24gaW5cblx0XHRcdC8vIHRoZSB0ZXJtaW5hbC5cblx0XHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdFx0aWYgKGdldFdpbmRvd3NCdWlsZE51bWJlcigpIDwgMTcwNjMpIHtcblx0XHRcdFx0XHRyZXR1cm4gb3JpZ2luYWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3Qgd3NsRXhlY3V0YWJsZSA9IHRoaXMuX2dldFdTTEV4ZWN1dGFibGVQYXRoKCk7XG5cdFx0XHRcdGlmICghd3NsRXhlY3V0YWJsZSkge1xuXHRcdFx0XHRcdHJldHVybiBvcmlnaW5hbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPihjID0+IHtcblx0XHRcdFx0XHRjb25zdCBwcm9jID0gZXhlY0ZpbGUod3NsRXhlY3V0YWJsZSwgWyctZScsICd3c2xwYXRoJywgJy13Jywgb3JpZ2luYWxdLCB7fSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuXHRcdFx0XHRcdFx0YyhlcnJvciA/IG9yaWdpbmFsIDogc3Rkb3V0LnRyaW0oKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0cHJvYy5zdGRpbiEuZW5kKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBGYWxsYmFjayBqdXN0IGluIGNhc2Vcblx0XHRyZXR1cm4gb3JpZ2luYWw7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRXU0xFeGVjdXRhYmxlUGF0aCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHVzZVdTTGV4ZSA9IGdldFdpbmRvd3NCdWlsZE51bWJlcigpID49IDE2Mjk5O1xuXHRcdGNvbnN0IGlzMzJQcm9jZXNzT242NFdpbmRvd3MgPSBwcm9jZXNzLmVudi5oYXNPd25Qcm9wZXJ0eSgnUFJPQ0VTU09SX0FSQ0hJVEVXNjQzMicpO1xuXHRcdGNvbnN0IHN5c3RlbVJvb3QgPSBwcm9jZXNzLmVudlsnU3lzdGVtUm9vdCddO1xuXHRcdGlmIChzeXN0ZW1Sb290KSB7XG5cdFx0XHRyZXR1cm4gam9pbihzeXN0ZW1Sb290LCBpczMyUHJvY2Vzc09uNjRXaW5kb3dzID8gJ1N5c25hdGl2ZScgOiAnU3lzdGVtMzInLCB1c2VXU0xleGUgPyAnd3NsLmV4ZScgOiAnYmFzaC5leGUnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXRSZXZpdmVkUHR5TmV3SWQod29ya3NwYWNlSWQ6IHN0cmluZywgaWQ6IG51bWJlcik6IFByb21pc2U8bnVtYmVyIHwgdW5kZWZpbmVkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiB0aGlzLl9yZXZpdmVkUHR5SWRNYXAuZ2V0KHRoaXMuX2dldFJldml2aW5nUHJvY2Vzc0lkKHdvcmtzcGFjZUlkLCBpZCkpPy5uZXdJZDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYENvdWxkbid0IGZpbmQgdGVybWluYWwgSUQgJHt3b3Jrc3BhY2VJZH0tJHtpZH1gLCBlLm1lc3NhZ2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0QHRyYWNlUnBjXG5cdGFzeW5jIHNldFRlcm1pbmFsTGF5b3V0SW5mbyhhcmdzOiBJU2V0VGVybWluYWxMYXlvdXRJbmZvQXJncyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3dvcmtzcGFjZUxheW91dEluZm9zLnNldChhcmdzLndvcmtzcGFjZUlkLCBhcmdzKTtcblx0fVxuXG5cdEB0cmFjZVJwY1xuXHRhc3luYyBnZXRUZXJtaW5hbExheW91dEluZm8oYXJnczogSUdldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MpOiBQcm9taXNlPElUZXJtaW5hbHNMYXlvdXRJbmZvIHwgdW5kZWZpbmVkPiB7XG5cdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS93aWxsR2V0VGVybWluYWxMYXlvdXRJbmZvJyk7XG5cdFx0Y29uc3QgbGF5b3V0ID0gdGhpcy5fd29ya3NwYWNlTGF5b3V0SW5mb3MuZ2V0KGFyZ3Mud29ya3NwYWNlSWQpO1xuXHRcdGlmIChsYXlvdXQpIHtcblx0XHRcdGNvbnN0IGRvbmVTZXQ6IFNldDxudW1iZXI+ID0gbmV3IFNldCgpO1xuXHRcdFx0Y29uc3QgZXhwYW5kZWRUYWJzID0gYXdhaXQgUHJvbWlzZS5hbGwobGF5b3V0LnRhYnMubWFwKGFzeW5jIHRhYiA9PiB0aGlzLl9leHBhbmRUZXJtaW5hbFRhYihhcmdzLndvcmtzcGFjZUlkLCB0YWIsIGRvbmVTZXQpKSk7XG5cdFx0XHRjb25zdCB0YWJzID0gZXhwYW5kZWRUYWJzLmZpbHRlcih0ID0+IHQudGVybWluYWxzLmxlbmd0aCA+IDApO1xuXHRcdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS9kaWRHZXRUZXJtaW5hbExheW91dEluZm8nKTtcblx0XHRcdHJldHVybiB7IHRhYnMgfTtcblx0XHR9XG5cdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS9kaWRHZXRUZXJtaW5hbExheW91dEluZm8nKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZXhwYW5kVGVybWluYWxUYWIod29ya3NwYWNlSWQ6IHN0cmluZywgdGFiOiBJVGVybWluYWxUYWJMYXlvdXRJbmZvQnlJZCwgZG9uZVNldDogU2V0PG51bWJlcj4pOiBQcm9taXNlPElUZXJtaW5hbFRhYkxheW91dEluZm9EdG8+IHtcblx0XHRjb25zdCBleHBhbmRlZFRlcm1pbmFscyA9IChhd2FpdCBQcm9taXNlLmFsbCh0YWIudGVybWluYWxzLm1hcCh0ID0+IHRoaXMuX2V4cGFuZFRlcm1pbmFsSW5zdGFuY2Uod29ya3NwYWNlSWQsIHQsIGRvbmVTZXQpKSkpO1xuXHRcdGNvbnN0IGZpbHRlcmVkID0gZXhwYW5kZWRUZXJtaW5hbHMuZmlsdGVyKHRlcm0gPT4gdGVybS50ZXJtaW5hbCAhPT0gbnVsbCkgYXMgSVJhd1Rlcm1pbmFsSW5zdGFuY2VMYXlvdXRJbmZvPElQcm9jZXNzRGV0YWlscz5bXTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aXNBY3RpdmU6IHRhYi5pc0FjdGl2ZSxcblx0XHRcdGFjdGl2ZVBlcnNpc3RlbnRQcm9jZXNzSWQ6IHRhYi5hY3RpdmVQZXJzaXN0ZW50UHJvY2Vzc0lkLFxuXHRcdFx0dGVybWluYWxzOiBmaWx0ZXJlZFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9leHBhbmRUZXJtaW5hbEluc3RhbmNlKHdvcmtzcGFjZUlkOiBzdHJpbmcsIHQ6IElUZXJtaW5hbEluc3RhbmNlTGF5b3V0SW5mb0J5SWQsIGRvbmVTZXQ6IFNldDxudW1iZXI+KTogUHJvbWlzZTxJUmF3VGVybWluYWxJbnN0YW5jZUxheW91dEluZm88SVByb2Nlc3NEZXRhaWxzIHwgbnVsbD4+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgb2xkSWQgPSB0aGlzLl9nZXRSZXZpdmluZ1Byb2Nlc3NJZCh3b3Jrc3BhY2VJZCwgdC50ZXJtaW5hbCk7XG5cdFx0XHRjb25zdCByZXZpdmVkUHR5SWQgPSB0aGlzLl9yZXZpdmVkUHR5SWRNYXAuZ2V0KG9sZElkKT8ubmV3SWQ7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEV4cGFuZGluZyB0ZXJtaW5hbCBpbnN0YW5jZSwgb2xkIGlkICR7b2xkSWR9IC0+IG5ldyBpZCAke3Jldml2ZWRQdHlJZH1gKTtcblx0XHRcdHRoaXMuX3Jldml2ZWRQdHlJZE1hcC5kZWxldGUob2xkSWQpO1xuXHRcdFx0Y29uc3QgcGVyc2lzdGVudFByb2Nlc3NJZCA9IHJldml2ZWRQdHlJZCA/PyB0LnRlcm1pbmFsO1xuXHRcdFx0aWYgKGRvbmVTZXQuaGFzKHBlcnNpc3RlbnRQcm9jZXNzSWQpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVGVybWluYWwgJHtwZXJzaXN0ZW50UHJvY2Vzc0lkfSBoYXMgYWxyZWFkeSBiZWVuIGV4cGFuZGVkYCk7XG5cdFx0XHR9XG5cdFx0XHRkb25lU2V0LmFkZChwZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0XHRcdGNvbnN0IHBlcnNpc3RlbnRQcm9jZXNzID0gdGhpcy5fdGhyb3dJZk5vUHR5KHBlcnNpc3RlbnRQcm9jZXNzSWQpO1xuXHRcdFx0Y29uc3QgcHJvY2Vzc0RldGFpbHMgPSBwZXJzaXN0ZW50UHJvY2VzcyAmJiBhd2FpdCB0aGlzLl9idWlsZFByb2Nlc3NEZXRhaWxzKHQudGVybWluYWwsIHBlcnNpc3RlbnRQcm9jZXNzLCByZXZpdmVkUHR5SWQgIT09IHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0ZXJtaW5hbDogeyAuLi5wcm9jZXNzRGV0YWlscywgaWQ6IHBlcnNpc3RlbnRQcm9jZXNzSWQgfSxcblx0XHRcdFx0cmVsYXRpdmVTaXplOiB0LnJlbGF0aXZlU2l6ZVxuXHRcdFx0fTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYENvdWxkbid0IGdldCBsYXlvdXQgaW5mbywgYSB0ZXJtaW5hbCB3YXMgcHJvYmFibHkgZGlzY29ubmVjdGVkYCwgZS5tZXNzYWdlKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ1JlYXR0YWNoIHRvIHdyb25nIHRlcm1pbmFsIGRlYnVnIGluZm8gLSBsYXlvdXQgaW5mbyBieSBpZCcsIHQpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnUmVhdHRhY2ggdG8gd3JvbmcgdGVybWluYWwgZGVidWcgaW5mbyAtIF9yZXZpdmVQdHlJZE1hcCcsIEFycmF5LmZyb20odGhpcy5fcmV2aXZlZFB0eUlkTWFwLnZhbHVlcygpKSk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdSZWF0dGFjaCB0byB3cm9uZyB0ZXJtaW5hbCBkZWJ1ZyBpbmZvIC0gX3B0eXMgaWRzJywgQXJyYXkuZnJvbSh0aGlzLl9wdHlzLmtleXMoKSkpO1xuXHRcdFx0Ly8gdGhpcyB3aWxsIGJlIGZpbHRlcmVkIG91dCBhbmQgbm90IHJlY29ubmVjdGVkXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0ZXJtaW5hbDogbnVsbCxcblx0XHRcdFx0cmVsYXRpdmVTaXplOiB0LnJlbGF0aXZlU2l6ZVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRSZXZpdmluZ1Byb2Nlc3NJZCh3b3Jrc3BhY2VJZDogc3RyaW5nLCBwdHlJZDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7d29ya3NwYWNlSWR9LSR7cHR5SWR9YDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2J1aWxkUHJvY2Vzc0RldGFpbHMoaWQ6IG51bWJlciwgcGVyc2lzdGVudFByb2Nlc3M6IFBlcnNpc3RlbnRUZXJtaW5hbFByb2Nlc3MsIHdhc1Jldml2ZWQ6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8SVByb2Nlc3NEZXRhaWxzPiB7XG5cdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS93aWxsQnVpbGRQcm9jZXNzRGV0YWlscy8ke2lkfWApO1xuXHRcdC8vIElmIHRoZSBwcm9jZXNzIHdhcyBqdXN0IHJldml2ZWQsIGRvbid0IGRvIHRoZSBvcnBoYW4gY2hlY2sgYXMgaXQgd2lsbFxuXHRcdC8vIHRha2Ugc29tZSB0aW1lXG5cdFx0Y29uc3QgW2N3ZCwgaXNPcnBoYW5dID0gYXdhaXQgUHJvbWlzZS5hbGwoW3BlcnNpc3RlbnRQcm9jZXNzLmdldEN3ZCgpLCB3YXNSZXZpdmVkID8gdHJ1ZSA6IHBlcnNpc3RlbnRQcm9jZXNzLmlzT3JwaGFuZWQoKV0pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGU6IHBlcnNpc3RlbnRQcm9jZXNzLnRpdGxlLFxuXHRcdFx0dGl0bGVTb3VyY2U6IHBlcnNpc3RlbnRQcm9jZXNzLnRpdGxlU291cmNlLFxuXHRcdFx0cGlkOiBwZXJzaXN0ZW50UHJvY2Vzcy5waWQsXG5cdFx0XHR3b3Jrc3BhY2VJZDogcGVyc2lzdGVudFByb2Nlc3Mud29ya3NwYWNlSWQsXG5cdFx0XHR3b3Jrc3BhY2VOYW1lOiBwZXJzaXN0ZW50UHJvY2Vzcy53b3Jrc3BhY2VOYW1lLFxuXHRcdFx0Y3dkLFxuXHRcdFx0aXNPcnBoYW4sXG5cdFx0XHRpY29uOiBwZXJzaXN0ZW50UHJvY2Vzcy5pY29uLFxuXHRcdFx0Y29sb3I6IHBlcnNpc3RlbnRQcm9jZXNzLmNvbG9yLFxuXHRcdFx0Zml4ZWREaW1lbnNpb25zOiBwZXJzaXN0ZW50UHJvY2Vzcy5maXhlZERpbWVuc2lvbnMsXG5cdFx0XHRlbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnM6IHBlcnNpc3RlbnRQcm9jZXNzLnByb2Nlc3NMYXVuY2hPcHRpb25zLm9wdGlvbnMuZW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zLFxuXHRcdFx0cmVjb25uZWN0aW9uUHJvcGVydGllczogcGVyc2lzdGVudFByb2Nlc3Muc2hlbGxMYXVuY2hDb25maWcucmVjb25uZWN0aW9uUHJvcGVydGllcyxcblx0XHRcdHdhaXRPbkV4aXQ6IHBlcnNpc3RlbnRQcm9jZXNzLnNoZWxsTGF1bmNoQ29uZmlnLndhaXRPbkV4aXQsXG5cdFx0XHRoaWRlRnJvbVVzZXI6IHBlcnNpc3RlbnRQcm9jZXNzLnNoZWxsTGF1bmNoQ29uZmlnLmhpZGVGcm9tVXNlcixcblx0XHRcdGlzRmVhdHVyZVRlcm1pbmFsOiBwZXJzaXN0ZW50UHJvY2Vzcy5zaGVsbExhdW5jaENvbmZpZy5pc0ZlYXR1cmVUZXJtaW5hbCxcblx0XHRcdHR5cGU6IHBlcnNpc3RlbnRQcm9jZXNzLnNoZWxsTGF1bmNoQ29uZmlnLnR5cGUsXG5cdFx0XHRoYXNDaGlsZFByb2Nlc3NlczogcGVyc2lzdGVudFByb2Nlc3MuaGFzQ2hpbGRQcm9jZXNzZXMsXG5cdFx0XHRzaGVsbEludGVncmF0aW9uTm9uY2U6IHBlcnNpc3RlbnRQcm9jZXNzLnByb2Nlc3NMYXVuY2hPcHRpb25zLm9wdGlvbnMuc2hlbGxJbnRlZ3JhdGlvbi5ub25jZSxcblx0XHRcdHRhYkFjdGlvbnM6IHBlcnNpc3RlbnRQcm9jZXNzLnNoZWxsTGF1bmNoQ29uZmlnLnRhYkFjdGlvbnNcblx0XHR9O1xuXHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZGlkQnVpbGRQcm9jZXNzRGV0YWlscy8ke2lkfWApO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF90aHJvd0lmTm9QdHkoaWQ6IG51bWJlcik6IFBlcnNpc3RlbnRUZXJtaW5hbFByb2Nlc3Mge1xuXHRcdGNvbnN0IHB0eSA9IHRoaXMuX3B0eXMuZ2V0KGlkKTtcblx0XHRpZiAoIXB0eSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yTm9UZWxlbWV0cnkoYENvdWxkIG5vdCBmaW5kIHB0eSAke2lkfSBvbiBwdHkgaG9zdGApO1xuXHRcdH1cblx0XHRyZXR1cm4gcHR5O1xuXHR9XG59XG5cbmNvbnN0IGVudW0gSW50ZXJhY3Rpb25TdGF0ZSB7XG5cdC8qKiBUaGUgdGVybWluYWwgaGFzIG5vdCBiZWVuIGludGVyYWN0ZWQgd2l0aC4gKi9cblx0Tm9uZSA9ICdOb25lJyxcblx0LyoqIFRoZSB0ZXJtaW5hbCBoYXMgb25seSBiZWVuIGludGVyYWN0ZWQgd2l0aCBieSB0aGUgcmVwbGF5IG1lY2hhbmlzbS4gKi9cblx0UmVwbGF5T25seSA9ICdSZXBsYXlPbmx5Jyxcblx0LyoqIFRoZSB0ZXJtaW5hbCBoYXMgYmVlbiBkaXJlY3RseSBpbnRlcmFjdGVkIHdpdGggdGhpcyBzZXNzaW9uLiAqL1xuXHRTZXNzaW9uID0gJ1Nlc3Npb24nXG59XG5cbmNsYXNzIFBlcnNpc3RlbnRUZXJtaW5hbFByb2Nlc3MgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9idWZmZXJlcjogVGVybWluYWxEYXRhQnVmZmVyZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ0NvbW1hbmRzID0gbmV3IE1hcDxudW1iZXIsIHsgcmVzb2x2ZTogKGRhdGE6IGFueSkgPT4gdm9pZDsgcmVqZWN0OiAoZXJyOiBhbnkpID0+IHZvaWQgfT4oKTtcblxuXHRwcml2YXRlIF9pc1N0YXJ0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaW50ZXJhY3Rpb25TdGF0ZTogTXV0YXRpb25Mb2dnZXI8SW50ZXJhY3Rpb25TdGF0ZT47XG5cblx0cHJpdmF0ZSBfb3JwaGFuUXVlc3Rpb25CYXJyaWVyOiBBdXRvT3BlbkJhcnJpZXIgfCBudWxsO1xuXHRwcml2YXRlIF9vcnBoYW5RdWVzdGlvblJlcGx5VGltZTogbnVtYmVyO1xuXHRwcml2YXRlIF9vcnBoYW5SZXF1ZXN0UXVldWUgPSBuZXcgUXVldWU8Ym9vbGVhbj4oKTtcblx0cHJpdmF0ZSBfZGlzY29ubmVjdFJ1bm5lcjE6IFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBfZGlzY29ubmVjdFJ1bm5lcjI6IFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZXBsYXkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHR5SG9zdFByb2Nlc3NSZXBsYXlFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc1JlcGxheSA9IHRoaXMuX29uUHJvY2Vzc1JlcGxheS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzUmVhZHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvY2Vzc1JlYWR5RXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZWFkeSA9IHRoaXMuX29uUHJvY2Vzc1JlYWR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblBlcnNpc3RlbnRQcm9jZXNzUmVhZHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0LyoqIEZpcmVkIHdoZW4gdGhlIHBlcnNpc3RlbnQgcHJvY2VzcyBoYXMgYSByZWFkeSBwcm9jZXNzIGFuZCBoYXMgZmluaXNoZWQgaXRzIHJlcGxheS4gKi9cblx0cmVhZG9ubHkgb25QZXJzaXN0ZW50UHJvY2Vzc1JlYWR5ID0gdGhpcy5fb25QZXJzaXN0ZW50UHJvY2Vzc1JlYWR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NEYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzRGF0YSA9IHRoaXMuX29uUHJvY2Vzc0RhdGEuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc09ycGhhblF1ZXN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc09ycGhhblF1ZXN0aW9uID0gdGhpcy5fb25Qcm9jZXNzT3JwaGFuUXVlc3Rpb24uZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvcGVydHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvY2Vzc1Byb3BlcnR5PGFueT4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVByb3BlcnR5ID0gdGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5ldmVudDtcblxuXHRwcml2YXRlIF9pblJlcGxheSA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX3BpZCA9IC0xO1xuXHRwcml2YXRlIF9jd2QgPSAnJztcblx0cHJpdmF0ZSBfdGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdGl0bGVTb3VyY2U6IFRpdGxlRXZlbnRTb3VyY2UgPSBUaXRsZUV2ZW50U291cmNlLlByb2Nlc3M7XG5cdHByaXZhdGUgX3NlcmlhbGl6ZXI6IElUZXJtaW5hbFNlcmlhbGl6ZXI7XG5cdHByaXZhdGUgX3dhc1Jldml2ZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX2ZpeGVkRGltZW5zaW9uczogSUZpeGVkVGVybWluYWxEaW1lbnNpb25zIHwgdW5kZWZpbmVkO1xuXG5cdGdldCBwaWQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX3BpZDsgfVxuXHRnZXQgc2hlbGxMYXVuY2hDb25maWcoKTogSVNoZWxsTGF1bmNoQ29uZmlnIHsgcmV0dXJuIHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5zaGVsbExhdW5jaENvbmZpZzsgfVxuXHRnZXQgaGFzV3JpdHRlbkRhdGEoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pbnRlcmFjdGlvblN0YXRlLnZhbHVlICE9PSBJbnRlcmFjdGlvblN0YXRlLk5vbmU7IH1cblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl90aXRsZSB8fCB0aGlzLl90ZXJtaW5hbFByb2Nlc3MuY3VycmVudFRpdGxlOyB9XG5cdGdldCB0aXRsZVNvdXJjZSgpOiBUaXRsZUV2ZW50U291cmNlIHsgcmV0dXJuIHRoaXMuX3RpdGxlU291cmNlOyB9XG5cdGdldCBpY29uKCk6IFRlcm1pbmFsSWNvbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9pY29uOyB9XG5cdGdldCBjb2xvcigpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fY29sb3I7IH1cblx0Z2V0IGZpeGVkRGltZW5zaW9ucygpOiBJRml4ZWRUZXJtaW5hbERpbWVuc2lvbnMgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fZml4ZWREaW1lbnNpb25zOyB9XG5cdGdldCBoYXNDaGlsZFByb2Nlc3NlcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5oYXNDaGlsZFByb2Nlc3NlczsgfVxuXG5cdHNldFRpdGxlKHRpdGxlOiBzdHJpbmcsIHRpdGxlU291cmNlOiBUaXRsZUV2ZW50U291cmNlKTogdm9pZCB7XG5cdFx0aWYgKHRpdGxlU291cmNlID09PSBUaXRsZUV2ZW50U291cmNlLkFwaSkge1xuXHRcdFx0dGhpcy5faW50ZXJhY3Rpb25TdGF0ZS5zZXRWYWx1ZShJbnRlcmFjdGlvblN0YXRlLlNlc3Npb24sICdzZXRUaXRsZScpO1xuXHRcdFx0dGhpcy5fc2VyaWFsaXplci5mcmVlUmF3UmV2aXZlQnVmZmVyKCk7XG5cdFx0fVxuXHRcdHRoaXMuX3RpdGxlID0gdGl0bGU7XG5cdFx0dGhpcy5fdGl0bGVTb3VyY2UgPSB0aXRsZVNvdXJjZTtcblx0fVxuXG5cdHNldEljb24odXNlckluaXRpYXRlZDogYm9vbGVhbiwgaWNvbjogVGVybWluYWxJY29uLCBjb2xvcj86IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faWNvbiB8fCAnaWQnIGluIGljb24gJiYgJ2lkJyBpbiB0aGlzLl9pY29uICYmIGljb24uaWQgIT09IHRoaXMuX2ljb24uaWQgfHxcblx0XHRcdCF0aGlzLmNvbG9yIHx8IGNvbG9yICE9PSB0aGlzLl9jb2xvcikge1xuXG5cdFx0XHR0aGlzLl9zZXJpYWxpemVyLmZyZWVSYXdSZXZpdmVCdWZmZXIoKTtcblx0XHRcdGlmICh1c2VySW5pdGlhdGVkKSB7XG5cdFx0XHRcdHRoaXMuX2ludGVyYWN0aW9uU3RhdGUuc2V0VmFsdWUoSW50ZXJhY3Rpb25TdGF0ZS5TZXNzaW9uLCAnc2V0SWNvbicpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9pY29uID0gaWNvbjtcblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0Rml4ZWREaW1lbnNpb25zKGZpeGVkRGltZW5zaW9ucz86IElGaXhlZFRlcm1pbmFsRGltZW5zaW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpeGVkRGltZW5zaW9ucyA9IGZpeGVkRGltZW5zaW9ucztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3BlcnNpc3RlbnRQcm9jZXNzSWQ6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2Nlc3M6IFRlcm1pbmFsUHJvY2Vzcyxcblx0XHRyZWFkb25seSB3b3Jrc3BhY2VJZDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IHdvcmtzcGFjZU5hbWU6IHN0cmluZyxcblx0XHRyZWFkb25seSBzaG91bGRQZXJzaXN0VGVybWluYWw6IGJvb2xlYW4sXG5cdFx0Y29sczogbnVtYmVyLFxuXHRcdHJvd3M6IG51bWJlcixcblx0XHRyZWFkb25seSBwcm9jZXNzTGF1bmNoT3B0aW9uczogSVBlcnNpc3RlbnRUZXJtaW5hbFByb2Nlc3NMYXVuY2hDb25maWcsXG5cdFx0cHVibGljIHVuaWNvZGVWZXJzaW9uOiAnNicgfCAnMTEnLFxuXHRcdHJlY29ubmVjdENvbnN0YW50czogSVJlY29ubmVjdENvbnN0YW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRyZXZpdmVCdWZmZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRyYXdSZXZpdmVCdWZmZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIF9pY29uPzogVGVybWluYWxJY29uLFxuXHRcdHByaXZhdGUgX2NvbG9yPzogc3RyaW5nLFxuXHRcdG5hbWU/OiBzdHJpbmcsXG5cdFx0Zml4ZWREaW1lbnNpb25zPzogSUZpeGVkVGVybWluYWxEaW1lbnNpb25zXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5faW50ZXJhY3Rpb25TdGF0ZSA9IG5ldyBNdXRhdGlvbkxvZ2dlcihgUGVyc2lzdGVudCBwcm9jZXNzIFwiJHt0aGlzLl9wZXJzaXN0ZW50UHJvY2Vzc0lkfVwiIGludGVyYWN0aW9uIHN0YXRlYCwgSW50ZXJhY3Rpb25TdGF0ZS5Ob25lLCB0aGlzLl9sb2dTZXJ2aWNlKTtcblx0XHR0aGlzLl93YXNSZXZpdmVkID0gcmV2aXZlQnVmZmVyICE9PSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc2VyaWFsaXplciA9IG5ldyBYdGVybVNlcmlhbGl6ZXIoXG5cdFx0XHRjb2xzLFxuXHRcdFx0cm93cyxcblx0XHRcdHJlY29ubmVjdENvbnN0YW50cy5zY3JvbGxiYWNrLFxuXHRcdFx0dW5pY29kZVZlcnNpb24sXG5cdFx0XHRyZXZpdmVCdWZmZXIsXG5cdFx0XHRwcm9jZXNzTGF1bmNoT3B0aW9ucy5vcHRpb25zLnNoZWxsSW50ZWdyYXRpb24ubm9uY2UsXG5cdFx0XHRzaG91bGRQZXJzaXN0VGVybWluYWwgPyByYXdSZXZpdmVCdWZmZXIgOiB1bmRlZmluZWQsXG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlXG5cdFx0KTtcblx0XHRpZiAobmFtZSkge1xuXHRcdFx0dGhpcy5zZXRUaXRsZShuYW1lLCBUaXRsZUV2ZW50U291cmNlLkFwaSk7XG5cdFx0fVxuXHRcdHRoaXMuX2ZpeGVkRGltZW5zaW9ucyA9IGZpeGVkRGltZW5zaW9ucztcblx0XHR0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXIgPSBudWxsO1xuXHRcdHRoaXMuX29ycGhhblF1ZXN0aW9uUmVwbHlUaW1lID0gMDtcblx0XHR0aGlzLl9kaXNjb25uZWN0UnVubmVyMSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm9jZXNzVGltZVJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBQZXJzaXN0ZW50IHByb2Nlc3MgXCIke3RoaXMuX3BlcnNpc3RlbnRQcm9jZXNzSWR9XCI6IFRoZSByZWNvbm5lY3Rpb24gZ3JhY2UgdGltZSBvZiAke3ByaW50VGltZShyZWNvbm5lY3RDb25zdGFudHMuZ3JhY2VUaW1lKX0gaGFzIGV4cGlyZWQsIHNodXR0aW5nIGRvd24gcGlkIFwiJHt0aGlzLl9waWR9XCJgKTtcblx0XHRcdHRoaXMuc2h1dGRvd24odHJ1ZSk7XG5cdFx0fSwgcmVjb25uZWN0Q29uc3RhbnRzLmdyYWNlVGltZSkpO1xuXHRcdHRoaXMuX2Rpc2Nvbm5lY3RSdW5uZXIyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYFBlcnNpc3RlbnQgcHJvY2VzcyBcIiR7dGhpcy5fcGVyc2lzdGVudFByb2Nlc3NJZH1cIjogVGhlIHNob3J0IHJlY29ubmVjdGlvbiBncmFjZSB0aW1lIG9mICR7cHJpbnRUaW1lKHJlY29ubmVjdENvbnN0YW50cy5zaG9ydEdyYWNlVGltZSl9IGhhcyBleHBpcmVkLCBzaHV0dGluZyBkb3duIHBpZCAke3RoaXMuX3BpZH1gKTtcblx0XHRcdHRoaXMuc2h1dGRvd24odHJ1ZSk7XG5cdFx0fSwgcmVjb25uZWN0Q29uc3RhbnRzLnNob3J0R3JhY2VUaW1lKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxQcm9jZXNzLm9uUHJvY2Vzc0V4aXQoKCkgPT4gdGhpcy5fYnVmZmVyZXIuc3RvcEJ1ZmZlcmluZyh0aGlzLl9wZXJzaXN0ZW50UHJvY2Vzc0lkKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5vblByb2Nlc3NSZWFkeShlID0+IHtcblx0XHRcdHRoaXMuX3BpZCA9IGUucGlkO1xuXHRcdFx0dGhpcy5fY3dkID0gZS5jd2Q7XG5cdFx0XHR0aGlzLl9vblByb2Nlc3NSZWFkeS5maXJlKGUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbFByb2Nlc3Mub25EaWRDaGFuZ2VQcm9wZXJ0eShlID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZShlKTtcblx0XHR9KSk7XG5cblx0XHQvLyBEYXRhIGJ1ZmZlcmluZyB0byByZWR1Y2UgdGhlIGFtb3VudCBvZiBtZXNzYWdlcyBnb2luZyB0byB0aGUgcmVuZGVyZXJcblx0XHR0aGlzLl9idWZmZXJlciA9IG5ldyBUZXJtaW5hbERhdGFCdWZmZXJlcigoXywgZGF0YSkgPT4gdGhpcy5fb25Qcm9jZXNzRGF0YS5maXJlKGRhdGEpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9idWZmZXJlci5zdGFydEJ1ZmZlcmluZyh0aGlzLl9wZXJzaXN0ZW50UHJvY2Vzc0lkLCB0aGlzLl90ZXJtaW5hbFByb2Nlc3Mub25Qcm9jZXNzRGF0YSkpO1xuXG5cdFx0Ly8gRGF0YSByZWNvcmRpbmcgZm9yIHJlY29ubmVjdFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25Qcm9jZXNzRGF0YShlID0+IHRoaXMuX3NlcmlhbGl6ZXIuaGFuZGxlRGF0YShlKSkpO1xuXHR9XG5cblx0YXN5bmMgYXR0YWNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fZGlzY29ubmVjdFJ1bm5lcjEuaXNTY2hlZHVsZWQoKSAmJiAhdGhpcy5fZGlzY29ubmVjdFJ1bm5lcjIuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKGBQZXJzaXN0ZW50IHByb2Nlc3MgXCIke3RoaXMuX3BlcnNpc3RlbnRQcm9jZXNzSWR9XCI6IFByb2Nlc3MgaGFkIG5vIGRpc2Nvbm5lY3QgcnVubmVycyBidXQgd2FzIGFuIG9ycGhhbmApO1xuXHRcdH1cblx0XHR0aGlzLl9kaXNjb25uZWN0UnVubmVyMS5jYW5jZWwoKTtcblx0XHR0aGlzLl9kaXNjb25uZWN0UnVubmVyMi5jYW5jZWwoKTtcblx0fVxuXG5cdGFzeW5jIGRldGFjaChmb3JjZVBlcnNpc3Q/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gS2VlcCB0aGUgcHJvY2VzcyBhcm91bmQgaWYgaXQgd2FzIGluZGljYXRlZCB0byBwZXJzaXN0IGFuZCBpdCBoYXMgaGFkIHNvbWUgaXRlcmFjdGlvbiBvclxuXHRcdC8vIHdhcyByZXBsYXllZFxuXHRcdGlmICh0aGlzLnNob3VsZFBlcnNpc3RUZXJtaW5hbCAmJiAodGhpcy5faW50ZXJhY3Rpb25TdGF0ZS52YWx1ZSAhPT0gSW50ZXJhY3Rpb25TdGF0ZS5Ob25lIHx8IGZvcmNlUGVyc2lzdCkpIHtcblx0XHRcdHRoaXMuX2Rpc2Nvbm5lY3RSdW5uZXIxLnNjaGVkdWxlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2h1dGRvd24odHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0c2VyaWFsaXplTm9ybWFsQnVmZmVyKCk6IFByb21pc2U8SVB0eUhvc3RQcm9jZXNzUmVwbGF5RXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fc2VyaWFsaXplci5nZW5lcmF0ZVJlcGxheUV2ZW50KHRydWUsIHRoaXMuX2ludGVyYWN0aW9uU3RhdGUudmFsdWUgIT09IEludGVyYWN0aW9uU3RhdGUuU2Vzc2lvbik7XG5cdH1cblxuXHRhc3luYyByZWZyZXNoUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHR5cGU6IFQpOiBQcm9taXNlPElQcm9jZXNzUHJvcGVydHlNYXBbVF0+IHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLnJlZnJlc2hQcm9wZXJ0eSh0eXBlKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZVByb3BlcnR5PFQgZXh0ZW5kcyBQcm9jZXNzUHJvcGVydHlUeXBlPih0eXBlOiBULCB2YWx1ZTogSVByb2Nlc3NQcm9wZXJ0eU1hcFtUXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0eXBlID09PSBQcm9jZXNzUHJvcGVydHlUeXBlLkZpeGVkRGltZW5zaW9ucykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NldEZpeGVkRGltZW5zaW9ucyh2YWx1ZSBhcyBJUHJvY2Vzc1Byb3BlcnR5TWFwW1Byb2Nlc3NQcm9wZXJ0eVR5cGUuRml4ZWREaW1lbnNpb25zXSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc3RhcnQoKTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHsgaW5qZWN0ZWRBcmdzOiBzdHJpbmdbXSB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl9pc1N0YXJ0ZWQpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5zdGFydCgpO1xuXHRcdFx0aWYgKHJlc3VsdCAmJiAnbWVzc2FnZScgaW4gcmVzdWx0KSB7XG5cdFx0XHRcdC8vIGl0J3MgYSB0ZXJtaW5hbCBsYXVuY2ggZXJyb3Jcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2lzU3RhcnRlZCA9IHRydWU7XG5cblx0XHRcdC8vIElmIHRoZSBwcm9jZXNzIHdhcyByZXZpdmVkLCB0cmlnZ2VyIGEgcmVwbGF5IG9uIGZpcnN0IHN0YXJ0LiBBbiBhbHRlcm5hdGl2ZSBhcHByb2FjaFxuXHRcdFx0Ly8gY291bGQgYmUgdG8gc3RhcnQgaXQgb24gdGhlIHB0eSBob3N0IGJlZm9yZSBhdHRhY2hpbmcgYnV0IHRoaXMgZmFpbHMgb24gV2luZG93cyBhc1xuXHRcdFx0Ly8gY29ucHR5J3MgaW5oZXJpdCBjdXJzb3Igb3B0aW9uIHdoaWNoIGlzIHJlcXVpcmVkLCBlbmRzIHVwIHNlbmRpbmcgRFNSIENQUiB3aGljaFxuXHRcdFx0Ly8gY2F1c2VzIGNvbmhvc3QgdG8gaGFuZyB3aGVuIG5vIHJlc3BvbnNlIGlzIHJlY2VpdmVkIGZyb20gdGhlIHRlcm1pbmFsICh3aGljaCB3b3VsZG4ndFxuXHRcdFx0Ly8gYmUgYXR0YWNoZWQgeWV0KS4gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC90ZXJtaW5hbC9pc3N1ZXMvMTEyMTNcblx0XHRcdGlmICh0aGlzLl93YXNSZXZpdmVkKSB7XG5cdFx0XHRcdHRoaXMudHJpZ2dlclJlcGxheSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fb25QZXJzaXN0ZW50UHJvY2Vzc1JlYWR5LmZpcmUoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25Qcm9jZXNzUmVhZHkuZmlyZSh7IHBpZDogdGhpcy5fcGlkLCBjd2Q6IHRoaXMuX2N3ZCwgd2luZG93c1B0eTogdGhpcy5fdGVybWluYWxQcm9jZXNzLmdldFdpbmRvd3NQdHkoKSB9KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLlRpdGxlLCB2YWx1ZTogdGhpcy5fdGVybWluYWxQcm9jZXNzLmN1cnJlbnRUaXRsZSB9KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLlNoZWxsVHlwZSwgdmFsdWU6IHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5zaGVsbFR5cGUgfSk7XG5cdFx0dGhpcy50cmlnZ2VyUmVwbGF5KCk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRzaHV0ZG93bihpbW1lZGlhdGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLnNodXRkb3duKGltbWVkaWF0ZSk7XG5cdH1cblx0aW5wdXQoZGF0YTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5faW50ZXJhY3Rpb25TdGF0ZS5zZXRWYWx1ZShJbnRlcmFjdGlvblN0YXRlLlNlc3Npb24sICdpbnB1dCcpO1xuXHRcdHRoaXMuX3NlcmlhbGl6ZXIuZnJlZVJhd1Jldml2ZUJ1ZmZlcigpO1xuXHRcdGlmICh0aGlzLl9pblJlcGxheSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLmlucHV0KGRhdGEpO1xuXHR9XG5cdHdyaXRlQmluYXJ5KGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbFByb2Nlc3MucHJvY2Vzc0JpbmFyeShkYXRhKTtcblx0fVxuXHRyZXNpemUoY29sczogbnVtYmVyLCByb3dzOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5SZXBsYXkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fc2VyaWFsaXplci5oYW5kbGVSZXNpemUoY29scywgcm93cyk7XG5cblx0XHQvLyBCdWZmZXJlZCBldmVudHMgc2hvdWxkIGZsdXNoIHdoZW4gYSByZXNpemUgb2NjdXJzXG5cdFx0dGhpcy5fYnVmZmVyZXIuZmx1c2hCdWZmZXIodGhpcy5fcGVyc2lzdGVudFByb2Nlc3NJZCk7XG5cblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLnJlc2l6ZShjb2xzLCByb3dzKTtcblx0fVxuXHRhc3luYyBjbGVhckJ1ZmZlcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9zZXJpYWxpemVyLmNsZWFyQnVmZmVyKCk7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzLmNsZWFyQnVmZmVyKCk7XG5cdH1cblx0c2V0VW5pY29kZVZlcnNpb24odmVyc2lvbjogJzYnIHwgJzExJyk6IHZvaWQge1xuXHRcdHRoaXMudW5pY29kZVZlcnNpb24gPSB2ZXJzaW9uO1xuXHRcdHRoaXMuX3NlcmlhbGl6ZXIuc2V0VW5pY29kZVZlcnNpb24/Lih2ZXJzaW9uKTtcblx0XHQvLyBUT0RPOiBQYXNzIGluIHVuaWNvZGUgdmVyc2lvbiBpbiBjdG9yXG5cdH1cblx0YWNrbm93bGVkZ2VEYXRhRXZlbnQoY2hhckNvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5SZXBsYXkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsUHJvY2Vzcy5hY2tub3dsZWRnZURhdGFFdmVudChjaGFyQ291bnQpO1xuXHR9XG5cdGdldEluaXRpYWxDd2QoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLmdldEluaXRpYWxDd2QoKTtcblx0fVxuXHRnZXRDd2QoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxQcm9jZXNzLmdldEN3ZCgpO1xuXHR9XG5cblx0YXN5bmMgdHJpZ2dlclJlcGxheSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5faW50ZXJhY3Rpb25TdGF0ZS52YWx1ZSA9PT0gSW50ZXJhY3Rpb25TdGF0ZS5Ob25lKSB7XG5cdFx0XHR0aGlzLl9pbnRlcmFjdGlvblN0YXRlLnNldFZhbHVlKEludGVyYWN0aW9uU3RhdGUuUmVwbGF5T25seSwgJ3RyaWdnZXJSZXBsYXknKTtcblx0XHR9XG5cdFx0Y29uc3QgZXYgPSBhd2FpdCB0aGlzLl9zZXJpYWxpemVyLmdlbmVyYXRlUmVwbGF5RXZlbnQoKTtcblx0XHRsZXQgZGF0YUxlbmd0aCA9IDA7XG5cdFx0Zm9yIChjb25zdCBlIG9mIGV2LmV2ZW50cykge1xuXHRcdFx0ZGF0YUxlbmd0aCArPSBlLmRhdGEubGVuZ3RoO1xuXHRcdH1cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYFBlcnNpc3RlbnQgcHJvY2VzcyBcIiR7dGhpcy5fcGVyc2lzdGVudFByb2Nlc3NJZH1cIjogUmVwbGF5aW5nICR7ZGF0YUxlbmd0aH0gY2hhcnMgYW5kICR7ZXYuZXZlbnRzLmxlbmd0aH0gc2l6ZSBldmVudHNgKTtcblx0XHR0aGlzLl9vblByb2Nlc3NSZXBsYXkuZmlyZShldik7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzLmNsZWFyVW5hY2tub3dsZWRnZWRDaGFycygpO1xuXHRcdHRoaXMuX29uUGVyc2lzdGVudFByb2Nlc3NSZWFkeS5maXJlKCk7XG5cdH1cblxuXHRzZW5kQ29tbWFuZFJlc3VsdChyZXFJZDogbnVtYmVyLCBpc0Vycm9yOiBib29sZWFuLCBzZXJpYWxpemVkUGF5bG9hZDogYW55KTogdm9pZCB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX3BlbmRpbmdDb21tYW5kcy5nZXQocmVxSWQpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9wZW5kaW5nQ29tbWFuZHMuZGVsZXRlKHJlcUlkKTtcblx0fVxuXG5cdG9ycGhhblF1ZXN0aW9uUmVwbHkoKTogdm9pZCB7XG5cdFx0dGhpcy5fb3JwaGFuUXVlc3Rpb25SZXBseVRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdGlmICh0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXIpIHtcblx0XHRcdGNvbnN0IGJhcnJpZXIgPSB0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXI7XG5cdFx0XHR0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXIgPSBudWxsO1xuXHRcdFx0YmFycmllci5vcGVuKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVkdWNlR3JhY2VUaW1lKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaXNjb25uZWN0UnVubmVyMi5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHQvLyB3ZSBhcmUgZGlzY29ubmVjdGVkIGFuZCBhbHJlYWR5IHJ1bm5pbmcgdGhlIHNob3J0IHJlY29ubmVjdGlvbiB0aW1lclxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZGlzY29ubmVjdFJ1bm5lcjEuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0Ly8gd2UgYXJlIGRpc2Nvbm5lY3RlZCBhbmQgcnVubmluZyB0aGUgbG9uZyByZWNvbm5lY3Rpb24gdGltZXJcblx0XHRcdHRoaXMuX2Rpc2Nvbm5lY3RSdW5uZXIyLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgaXNPcnBoYW5lZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fb3JwaGFuUmVxdWVzdFF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHRoaXMuX2lzT3JwaGFuZWQoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pc09ycGhhbmVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdC8vIFRoZSBwcm9jZXNzIGlzIGFscmVhZHkga25vd24gdG8gYmUgb3JwaGFuZWRcblx0XHRpZiAodGhpcy5fZGlzY29ubmVjdFJ1bm5lcjEuaXNTY2hlZHVsZWQoKSB8fCB0aGlzLl9kaXNjb25uZWN0UnVubmVyMi5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBBc2sgd2hldGhlciB0aGUgcmVuZGVyZXIocykgd2hldGhlciB0aGUgcHJvY2VzcyBpcyBvcnBoYW5lZCBhbmQgYXdhaXQgdGhlIHJlcGx5XG5cdFx0aWYgKCF0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXIpIHtcblx0XHRcdC8vIHRoZSBiYXJyaWVyIG9wZW5zIGFmdGVyIDQgc2Vjb25kcyB3aXRoIG9yIHdpdGhvdXQgYSByZXBseVxuXHRcdFx0dGhpcy5fb3JwaGFuUXVlc3Rpb25CYXJyaWVyID0gbmV3IEF1dG9PcGVuQmFycmllcig0MDAwKTtcblx0XHRcdHRoaXMuX29ycGhhblF1ZXN0aW9uUmVwbHlUaW1lID0gMDtcblx0XHRcdHRoaXMuX29uUHJvY2Vzc09ycGhhblF1ZXN0aW9uLmZpcmUoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLl9vcnBoYW5RdWVzdGlvbkJhcnJpZXIud2FpdCgpO1xuXHRcdHJldHVybiAoRGF0ZS5ub3coKSAtIHRoaXMuX29ycGhhblF1ZXN0aW9uUmVwbHlUaW1lID4gNTAwKTtcblx0fVxufVxuXG5jbGFzcyBNdXRhdGlvbkxvZ2dlcjxUPiB7XG5cdGdldCB2YWx1ZSgpOiBUIHsgcmV0dXJuIHRoaXMuX3ZhbHVlOyB9XG5cdHNldFZhbHVlKHZhbHVlOiBULCByZWFzb246IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl92YWx1ZSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLl9sb2cocmVhc29uKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9uYW1lOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfdmFsdWU6IFQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fbG9nKCdpbml0aWFsaXplZCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9nKHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgTXV0YXRpb25Mb2dnZXIgXCIke3RoaXMuX25hbWV9XCIgc2V0IHRvIFwiJHt0aGlzLl92YWx1ZX1cIiwgcmVhc29uOiAke3JlYXNvbn1gKTtcblx0fVxufVxuXG5jbGFzcyBYdGVybVNlcmlhbGl6ZXIgaW1wbGVtZW50cyBJVGVybWluYWxTZXJpYWxpemVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfeHRlcm06IFh0ZXJtVGVybWluYWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NoZWxsSW50ZWdyYXRpb25BZGRvbjogU2hlbGxJbnRlZ3JhdGlvbkFkZG9uO1xuXHRwcml2YXRlIF91bmljb2RlQWRkb24/OiBYdGVybVVuaWNvZGUxMUFkZG9uO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbHM6IG51bWJlcixcblx0XHRyb3dzOiBudW1iZXIsXG5cdFx0c2Nyb2xsYmFjazogbnVtYmVyLFxuXHRcdHVuaWNvZGVWZXJzaW9uOiAnNicgfCAnMTEnLFxuXHRcdHJldml2ZUJ1ZmZlcldpdGhSZXN0b3JlTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHNoZWxsSW50ZWdyYXRpb25Ob25jZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgX3Jhd1Jldml2ZUJ1ZmZlcjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3h0ZXJtID0gbmV3IFh0ZXJtVGVybWluYWwoe1xuXHRcdFx0Y29scyxcblx0XHRcdHJvd3MsXG5cdFx0XHRzY3JvbGxiYWNrLFxuXHRcdFx0YWxsb3dQcm9wb3NlZEFwaTogdHJ1ZVxuXHRcdH0pO1xuXHRcdGlmIChyZXZpdmVCdWZmZXJXaXRoUmVzdG9yZU1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuX3h0ZXJtLndyaXRlbG4ocmV2aXZlQnVmZmVyV2l0aFJlc3RvcmVNZXNzYWdlKTtcblx0XHR9XG5cdFx0dGhpcy5zZXRVbmljb2RlVmVyc2lvbih1bmljb2RlVmVyc2lvbik7XG5cdFx0dGhpcy5fc2hlbGxJbnRlZ3JhdGlvbkFkZG9uID0gbmV3IFNoZWxsSW50ZWdyYXRpb25BZGRvbihzaGVsbEludGVncmF0aW9uTm9uY2UsIHRydWUsIHVuZGVmaW5lZCwgbG9nU2VydmljZSk7XG5cdFx0dGhpcy5feHRlcm0ubG9hZEFkZG9uKHRoaXMuX3NoZWxsSW50ZWdyYXRpb25BZGRvbik7XG5cdH1cblxuXHRmcmVlUmF3UmV2aXZlQnVmZmVyKCk6IHZvaWQge1xuXHRcdC8vIEZyZWUgdGhlIG1lbW9yeSBvZiB0aGUgdGVybWluYWwgaWYgaXQgd2lsbCBuZWVkIHRvIGJlIHJlLXNlcmlhbGl6ZWRcblx0XHR0aGlzLl9yYXdSZXZpdmVCdWZmZXIgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRoYW5kbGVEYXRhKGRhdGE6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3h0ZXJtLndyaXRlKGRhdGEpO1xuXHR9XG5cblx0aGFuZGxlUmVzaXplKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5feHRlcm0ucmVzaXplKGNvbHMsIHJvd3MpO1xuXHR9XG5cblx0Y2xlYXJCdWZmZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5feHRlcm0uY2xlYXIoKTtcblx0fVxuXG5cdGFzeW5jIGdlbmVyYXRlUmVwbGF5RXZlbnQobm9ybWFsQnVmZmVyT25seT86IGJvb2xlYW4sIHJlc3RvcmVUb0xhc3RSZXZpdmVCdWZmZXI/OiBib29sZWFuKTogUHJvbWlzZTxJUHR5SG9zdFByb2Nlc3NSZXBsYXlFdmVudD4ge1xuXHRcdGNvbnN0IHNlcmlhbGl6ZSA9IG5ldyAoYXdhaXQgdGhpcy5fZ2V0U2VyaWFsaXplQ29uc3RydWN0b3IoKSk7XG5cdFx0dGhpcy5feHRlcm0ubG9hZEFkZG9uKHNlcmlhbGl6ZSk7XG5cdFx0Y29uc3Qgb3B0aW9uczogSVNlcmlhbGl6ZU9wdGlvbnMgPSB7XG5cdFx0XHRzY3JvbGxiYWNrOiB0aGlzLl94dGVybS5vcHRpb25zLnNjcm9sbGJhY2tcblx0XHR9O1xuXHRcdGlmIChub3JtYWxCdWZmZXJPbmx5KSB7XG5cdFx0XHRvcHRpb25zLmV4Y2x1ZGVBbHRCdWZmZXIgPSB0cnVlO1xuXHRcdFx0b3B0aW9ucy5leGNsdWRlTW9kZXMgPSB0cnVlO1xuXHRcdH1cblx0XHRsZXQgc2VyaWFsaXplZDogc3RyaW5nO1xuXHRcdGlmIChyZXN0b3JlVG9MYXN0UmV2aXZlQnVmZmVyICYmIHRoaXMuX3Jhd1Jldml2ZUJ1ZmZlcikge1xuXHRcdFx0c2VyaWFsaXplZCA9IHRoaXMuX3Jhd1Jldml2ZUJ1ZmZlcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VyaWFsaXplZCA9IHNlcmlhbGl6ZS5zZXJpYWxpemUob3B0aW9ucyk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRldmVudHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbHM6IHRoaXMuX3h0ZXJtLmNvbHMsXG5cdFx0XHRcdFx0cm93czogdGhpcy5feHRlcm0ucm93cyxcblx0XHRcdFx0XHRkYXRhOiBzZXJpYWxpemVkXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRjb21tYW5kczogdGhpcy5fc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLnNlcmlhbGl6ZSgpXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHNldFVuaWNvZGVWZXJzaW9uKHZlcnNpb246ICc2JyB8ICcxMScpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5feHRlcm0udW5pY29kZS5hY3RpdmVWZXJzaW9uID09PSB2ZXJzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh2ZXJzaW9uID09PSAnMTEnKSB7XG5cdFx0XHR0aGlzLl91bmljb2RlQWRkb24gPSBuZXcgKGF3YWl0IHRoaXMuX2dldFVuaWNvZGUxMUNvbnN0cnVjdG9yKCkpO1xuXHRcdFx0dGhpcy5feHRlcm0ubG9hZEFkZG9uKHRoaXMuX3VuaWNvZGVBZGRvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3VuaWNvZGVBZGRvbj8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fdW5pY29kZUFkZG9uID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl94dGVybS51bmljb2RlLmFjdGl2ZVZlcnNpb24gPSB2ZXJzaW9uO1xuXHR9XG5cblx0YXN5bmMgX2dldFVuaWNvZGUxMUNvbnN0cnVjdG9yKCk6IFByb21pc2U8dHlwZW9mIFVuaWNvZGUxMUFkZG9uPiB7XG5cdFx0aWYgKCFVbmljb2RlMTFBZGRvbikge1xuXHRcdFx0VW5pY29kZTExQWRkb24gPSAoYXdhaXQgaW1wb3J0KCdAeHRlcm0vYWRkb24tdW5pY29kZTExJykpLlVuaWNvZGUxMUFkZG9uO1xuXHRcdH1cblx0XHRyZXR1cm4gVW5pY29kZTExQWRkb247XG5cdH1cblxuXHRhc3luYyBfZ2V0U2VyaWFsaXplQ29uc3RydWN0b3IoKTogUHJvbWlzZTx0eXBlb2YgU2VyaWFsaXplQWRkb24+IHtcblx0XHRpZiAoIVNlcmlhbGl6ZUFkZG9uKSB7XG5cdFx0XHRTZXJpYWxpemVBZGRvbiA9IChhd2FpdCBpbXBvcnQoJ0B4dGVybS9hZGRvbi1zZXJpYWxpemUnKSkuU2VyaWFsaXplQWRkb247XG5cdFx0fVxuXHRcdHJldHVybiBTZXJpYWxpemVBZGRvbjtcblx0fVxufVxuXG5mdW5jdGlvbiBwcmludFRpbWUobXM6IG51bWJlcik6IHN0cmluZyB7XG5cdGxldCBoID0gMDtcblx0bGV0IG0gPSAwO1xuXHRsZXQgcyA9IDA7XG5cdGlmIChtcyA+PSAxMDAwKSB7XG5cdFx0cyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcblx0XHRtcyAtPSBzICogMTAwMDtcblx0fVxuXHRpZiAocyA+PSA2MCkge1xuXHRcdG0gPSBNYXRoLmZsb29yKHMgLyA2MCk7XG5cdFx0cyAtPSBtICogNjA7XG5cdH1cblx0aWYgKG0gPj0gNjApIHtcblx0XHRoID0gTWF0aC5mbG9vcihtIC8gNjApO1xuXHRcdG0gLT0gaCAqIDYwO1xuXHR9XG5cdGNvbnN0IF9oID0gaCA/IGAke2h9aGAgOiBgYDtcblx0Y29uc3QgX20gPSBtID8gYCR7bX1tYCA6IGBgO1xuXHRjb25zdCBfcyA9IHMgPyBgJHtzfXNgIDogYGA7XG5cdGNvbnN0IF9tcyA9IG1zID8gYCR7bXN9bXNgIDogYGA7XG5cdHJldHVybiBgJHtfaH0ke19tfSR7X3N9JHtfbXN9YDtcbn1cblxuaW50ZXJmYWNlIElUZXJtaW5hbFNlcmlhbGl6ZXIge1xuXHRoYW5kbGVEYXRhKGRhdGE6IHN0cmluZyk6IHZvaWQ7XG5cdGZyZWVSYXdSZXZpdmVCdWZmZXIoKTogdm9pZDtcblx0aGFuZGxlUmVzaXplKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyKTogdm9pZDtcblx0Y2xlYXJCdWZmZXIoKTogdm9pZDtcblx0Z2VuZXJhdGVSZXBsYXlFdmVudChub3JtYWxCdWZmZXJPbmx5PzogYm9vbGVhbiwgcmVzdG9yZVRvTGFzdFJldml2ZUJ1ZmZlcj86IGJvb2xlYW4pOiBQcm9taXNlPElQdHlIb3N0UHJvY2Vzc1JlcGxheUV2ZW50Pjtcblx0c2V0VW5pY29kZVZlcnNpb24/KHZlcnNpb246ICc2JyB8ICcxMScpOiB2b2lkO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsVUFBVSxZQUFZO0FBQy9CLFNBQVMsaUJBQWlCLDZCQUE2QixVQUFVLE9BQU8sZUFBZTtBQUN2RixTQUFTLGVBQXNCO0FBQy9CLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBOEIsV0FBNEIsVUFBVTtBQUVwRSxTQUFTLHNCQUFzQjtBQUMvQixTQUFzQixnQkFBZ0I7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBK1Esa0JBQWtCLDJCQUFxUTtBQUN0aUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw0QkFBNEI7QUFJckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7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QUFDUixNQUFJLElBQUk7QUFDUixNQUFJLElBQUk7QUFDUixNQUFJLE1BQU0sS0FBTTtBQUNmLFFBQUksS0FBSyxNQUFNLEtBQUssR0FBSTtBQUN4QixVQUFNLElBQUk7QUFBQSxFQUNYO0FBQ0EsTUFBSSxLQUFLLElBQUk7QUFDWixRQUFJLEtBQUssTUFBTSxJQUFJLEVBQUU7QUFDckIsU0FBSyxJQUFJO0FBQUEsRUFDVjtBQUNBLE1BQUksS0FBSyxJQUFJO0FBQ1osUUFBSSxLQUFLLE1BQU0sSUFBSSxFQUFFO0FBQ3JCLFNBQUssSUFBSTtBQUFBLEVBQ1Y7QUFDQSxRQUFNLEtBQUssSUFBSSxHQUFHLENBQUMsTUFBTTtBQUN6QixRQUFNLEtBQUssSUFBSSxHQUFHLENBQUMsTUFBTTtBQUN6QixRQUFNLEtBQUssSUFBSSxHQUFHLENBQUMsTUFBTTtBQUN6QixRQUFNLE1BQU0sS0FBSyxHQUFHLEVBQUUsT0FBTztBQUM3QixTQUFPLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRztBQUM3QjsiLAogICJuYW1lcyI6IFsic3Rkb3V0IiwgInByb2Nlc3MiLCAiSW50ZXJhY3Rpb25TdGF0ZSJdCn0K
