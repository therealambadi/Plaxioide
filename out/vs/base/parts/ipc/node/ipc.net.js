import { createHash } from "crypto";
import { createServer, createConnection } from "net";
import { tmpdir } from "os";
import { createDeflateRaw, createInflateRaw } from "zlib";
import { VSBuffer } from "../../../common/buffer.js";
import { onUnexpectedError } from "../../../common/errors.js";
import { Emitter, Event } from "../../../common/event.js";
import { Disposable } from "../../../common/lifecycle.js";
import { join } from "../../../common/path.js";
import { Platform, platform } from "../../../common/platform.js";
import { generateUuid } from "../../../common/uuid.js";
import { IPCServer } from "../common/ipc.js";
import { ChunkStream, Client, Protocol, SocketCloseEventType, SocketDiagnostics, SocketDiagnosticsEventType } from "../common/ipc.net.js";
const socketEndTimeoutMs = 3e4;
class NodeSocket {
  constructor(socket, debugLabel = "") {
    this._canWrite = true;
    this.debugLabel = debugLabel;
    this.socket = socket;
    this.traceSocketEvent(SocketDiagnosticsEventType.Created, { type: "NodeSocket" });
    this._errorListener = (err) => {
      this.traceSocketEvent(SocketDiagnosticsEventType.Error, { code: err?.code, message: err?.message });
      if (err) {
        if (err.code === "EPIPE") {
          return;
        }
        onUnexpectedError(err);
      }
    };
    this.socket.on("error", this._errorListener);
    let endTimeoutHandle;
    this._closeListener = (hadError) => {
      this.traceSocketEvent(SocketDiagnosticsEventType.Close, { hadError });
      this._canWrite = false;
      if (endTimeoutHandle) {
        clearTimeout(endTimeoutHandle);
      }
    };
    this.socket.on("close", this._closeListener);
    this._endListener = () => {
      this.traceSocketEvent(SocketDiagnosticsEventType.NodeEndReceived);
      this._canWrite = false;
      endTimeoutHandle = setTimeout(() => socket.destroy(), socketEndTimeoutMs);
    };
    this.socket.on("end", this._endListener);
  }
  traceSocketEvent(type, data) {
    SocketDiagnostics.traceSocketEvent(this.socket, this.debugLabel, type, data);
  }
  dispose() {
    this.socket.off("error", this._errorListener);
    this.socket.off("close", this._closeListener);
    this.socket.off("end", this._endListener);
    this.socket.destroy();
  }
  onData(_listener) {
    const listener = (buff) => {
      this.traceSocketEvent(SocketDiagnosticsEventType.Read, buff);
      _listener(VSBuffer.wrap(buff));
    };
    this.socket.on("data", listener);
    return {
      dispose: () => this.socket.off("data", listener)
    };
  }
  onClose(listener) {
    const adapter = (hadError) => {
      listener({
        type: SocketCloseEventType.NodeSocketCloseEvent,
        hadError,
        error: void 0
      });
    };
    this.socket.on("close", adapter);
    return {
      dispose: () => this.socket.off("close", adapter)
    };
  }
  onEnd(listener) {
    const adapter = () => {
      listener();
    };
    this.socket.on("end", adapter);
    return {
      dispose: () => this.socket.off("end", adapter)
    };
  }
  write(buffer) {
    if (this.socket.destroyed || !this._canWrite) {
      return;
    }
    try {
      this.traceSocketEvent(SocketDiagnosticsEventType.Write, buffer);
      this.socket.write(buffer.buffer, (err) => {
        if (err) {
          if (err.code === "EPIPE") {
            return;
          }
          onUnexpectedError(err);
        }
      });
    } catch (err) {
      if (err.code === "EPIPE") {
        return;
      }
      onUnexpectedError(err);
    }
  }
  end() {
    this.traceSocketEvent(SocketDiagnosticsEventType.NodeEndSent);
    this.socket.end();
  }
  drain() {
    this.traceSocketEvent(SocketDiagnosticsEventType.NodeDrainBegin);
    return new Promise((resolve, reject) => {
      if (this.socket.bufferSize === 0) {
        this.traceSocketEvent(SocketDiagnosticsEventType.NodeDrainEnd);
        resolve();
        return;
      }
      const finished = () => {
        this.socket.off("close", finished);
        this.socket.off("end", finished);
        this.socket.off("error", finished);
        this.socket.off("timeout", finished);
        this.socket.off("drain", finished);
        this.traceSocketEvent(SocketDiagnosticsEventType.NodeDrainEnd);
        resolve();
      };
      this.socket.on("close", finished);
      this.socket.on("end", finished);
      this.socket.on("error", finished);
      this.socket.on("timeout", finished);
      this.socket.on("drain", finished);
    });
  }
}
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MinHeaderByteSize"] = 2] = "MinHeaderByteSize";
  Constants2[Constants2["MaxWebSocketMessageLength"] = 262144] = "MaxWebSocketMessageLength";
  return Constants2;
})(Constants || {});
var ReadState = /* @__PURE__ */ ((ReadState2) => {
  ReadState2[ReadState2["PeekHeader"] = 1] = "PeekHeader";
  ReadState2[ReadState2["ReadHeader"] = 2] = "ReadHeader";
  ReadState2[ReadState2["ReadBody"] = 3] = "ReadBody";
  ReadState2[ReadState2["Fin"] = 4] = "Fin";
  return ReadState2;
})(ReadState || {});
class WebSocketNodeSocket extends Disposable {
  /**
   * Create a socket which can communicate using WebSocket frames.
   *
   * **NOTE**: When using the permessage-deflate WebSocket extension, if parts of inflating was done
   *  in a different zlib instance, we need to pass all those bytes into zlib, otherwise the inflate
   *  might hit an inflated portion referencing a distance too far back.
   *
   * @param socket The underlying socket
   * @param permessageDeflate Use the permessage-deflate WebSocket extension
   * @param inflateBytes "Seed" zlib inflate with these bytes.
   * @param recordInflateBytes Record all bytes sent to inflate
   */
  constructor(socket, permessageDeflate, inflateBytes, recordInflateBytes) {
    super();
    this._onData = this._register(new Emitter());
    this._onClose = this._register(new Emitter());
    this._isEnded = false;
    this._state = {
      state: 1 /* PeekHeader */,
      readLen: 2 /* MinHeaderByteSize */,
      fin: 0,
      compressed: false,
      firstFrameOfMessage: true,
      mask: 0,
      opcode: 0
    };
    this.socket = socket;
    this.traceSocketEvent(SocketDiagnosticsEventType.Created, { type: "WebSocketNodeSocket", permessageDeflate, inflateBytesLength: inflateBytes?.byteLength || 0, recordInflateBytes });
    this._flowManager = this._register(new WebSocketFlowManager(
      this,
      permessageDeflate,
      inflateBytes,
      recordInflateBytes,
      this._onData,
      (data, options) => this._write(data, options)
    ));
    this._register(this._flowManager.onError((err) => {
      console.error(err);
      onUnexpectedError(err);
      this._onClose.fire({
        type: SocketCloseEventType.NodeSocketCloseEvent,
        hadError: true,
        error: err
      });
    }));
    this._incomingData = new ChunkStream();
    this._register(this.socket.onData((data) => this._acceptChunk(data)));
    this._register(this.socket.onClose(async (e) => {
      if (this._flowManager.isProcessingReadQueue()) {
        await Event.toPromise(this._flowManager.onDidFinishProcessingReadQueue);
      }
      this._onClose.fire(e);
    }));
  }
  get permessageDeflate() {
    return this._flowManager.permessageDeflate;
  }
  get recordedInflateBytes() {
    return this._flowManager.recordedInflateBytes;
  }
  traceSocketEvent(type, data) {
    this.socket.traceSocketEvent(type, data);
  }
  dispose() {
    if (this._flowManager.isProcessingWriteQueue()) {
      this._register(this._flowManager.onDidFinishProcessingWriteQueue(() => {
        this.dispose();
      }));
    } else {
      this.socket.dispose();
      super.dispose();
    }
  }
  onData(listener) {
    return this._onData.event(listener);
  }
  onClose(listener) {
    return this._onClose.event(listener);
  }
  onEnd(listener) {
    return this.socket.onEnd(listener);
  }
  write(buffer) {
    let start = 0;
    while (start < buffer.byteLength) {
      this._flowManager.writeMessage(buffer.slice(start, Math.min(start + 262144 /* MaxWebSocketMessageLength */, buffer.byteLength)), {
        compressed: true,
        opcode: 2
        /* Binary frame */
      });
      start += 262144 /* MaxWebSocketMessageLength */;
    }
  }
  _write(buffer, { compressed, opcode }) {
    if (this._isEnded) {
      return;
    }
    this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketWrite, buffer);
    let headerLen = 2 /* MinHeaderByteSize */;
    if (buffer.byteLength < 126) {
      headerLen += 0;
    } else if (buffer.byteLength < 2 ** 16) {
      headerLen += 2;
    } else {
      headerLen += 8;
    }
    const header = VSBuffer.alloc(headerLen);
    const compressedFlag = compressed ? 64 : 0;
    const opcodeFlag = opcode & 15;
    header.writeUInt8(128 | compressedFlag | opcodeFlag, 0);
    if (buffer.byteLength < 126) {
      header.writeUInt8(buffer.byteLength, 1);
    } else if (buffer.byteLength < 2 ** 16) {
      header.writeUInt8(126, 1);
      let offset = 1;
      header.writeUInt8(buffer.byteLength >>> 8 & 255, ++offset);
      header.writeUInt8(buffer.byteLength >>> 0 & 255, ++offset);
    } else {
      header.writeUInt8(127, 1);
      let offset = 1;
      header.writeUInt8(0, ++offset);
      header.writeUInt8(0, ++offset);
      header.writeUInt8(0, ++offset);
      header.writeUInt8(0, ++offset);
      header.writeUInt8(buffer.byteLength >>> 24 & 255, ++offset);
      header.writeUInt8(buffer.byteLength >>> 16 & 255, ++offset);
      header.writeUInt8(buffer.byteLength >>> 8 & 255, ++offset);
      header.writeUInt8(buffer.byteLength >>> 0 & 255, ++offset);
    }
    this.socket.write(VSBuffer.concat([header, buffer]));
  }
  end() {
    this._isEnded = true;
    this.socket.end();
  }
  _acceptChunk(data) {
    if (data.byteLength === 0) {
      return;
    }
    this._incomingData.acceptChunk(data);
    while (this._incomingData.byteLength >= this._state.readLen) {
      if (this._state.state === 1 /* PeekHeader */) {
        const peekHeader = this._incomingData.peek(this._state.readLen);
        const firstByte = peekHeader.readUInt8(0);
        const finBit = (firstByte & 128) >>> 7;
        const rsv1Bit = (firstByte & 64) >>> 6;
        const opcode = firstByte & 15;
        const secondByte = peekHeader.readUInt8(1);
        const hasMask = (secondByte & 128) >>> 7;
        const len = secondByte & 127;
        this._state.state = 2 /* ReadHeader */;
        this._state.readLen = 2 /* MinHeaderByteSize */ + (hasMask ? 4 : 0) + (len === 126 ? 2 : 0) + (len === 127 ? 8 : 0);
        this._state.fin = finBit;
        if (this._state.firstFrameOfMessage) {
          this._state.compressed = Boolean(rsv1Bit);
        }
        this._state.firstFrameOfMessage = Boolean(finBit);
        this._state.mask = 0;
        this._state.opcode = opcode;
        this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketPeekedHeader, { headerSize: this._state.readLen, compressed: this._state.compressed, fin: this._state.fin, opcode: this._state.opcode });
      } else if (this._state.state === 2 /* ReadHeader */) {
        const header = this._incomingData.read(this._state.readLen);
        const secondByte = header.readUInt8(1);
        const hasMask = (secondByte & 128) >>> 7;
        let len = secondByte & 127;
        let offset = 1;
        if (len === 126) {
          len = header.readUInt8(++offset) * 2 ** 8 + header.readUInt8(++offset);
        } else if (len === 127) {
          len = header.readUInt8(++offset) * 0 + header.readUInt8(++offset) * 0 + header.readUInt8(++offset) * 0 + header.readUInt8(++offset) * 0 + header.readUInt8(++offset) * 2 ** 24 + header.readUInt8(++offset) * 2 ** 16 + header.readUInt8(++offset) * 2 ** 8 + header.readUInt8(++offset);
        }
        let mask = 0;
        if (hasMask) {
          mask = header.readUInt8(++offset) * 2 ** 24 + header.readUInt8(++offset) * 2 ** 16 + header.readUInt8(++offset) * 2 ** 8 + header.readUInt8(++offset);
        }
        this._state.state = 3 /* ReadBody */;
        this._state.readLen = len;
        this._state.mask = mask;
        this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketPeekedHeader, { bodySize: this._state.readLen, compressed: this._state.compressed, fin: this._state.fin, mask: this._state.mask, opcode: this._state.opcode });
      } else if (this._state.state === 3 /* ReadBody */) {
        const body = this._incomingData.read(this._state.readLen);
        this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketReadData, body);
        unmask(body, this._state.mask);
        this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketUnmaskedData, body);
        this._state.state = 1 /* PeekHeader */;
        this._state.readLen = 2 /* MinHeaderByteSize */;
        this._state.mask = 0;
        if (this._state.opcode <= 2) {
          this._flowManager.acceptFrame(body, this._state.compressed, !!this._state.fin);
        } else if (this._state.opcode === 9) {
          this._flowManager.writeMessage(body, {
            compressed: false,
            opcode: 10
            /* Pong frame */
          });
        }
      }
    }
  }
  async drain() {
    this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketDrainBegin);
    if (this._flowManager.isProcessingWriteQueue()) {
      await Event.toPromise(this._flowManager.onDidFinishProcessingWriteQueue);
    }
    await this.socket.drain();
    this.traceSocketEvent(SocketDiagnosticsEventType.WebSocketNodeSocketDrainEnd);
  }
}
class WebSocketFlowManager extends Disposable {
  constructor(_tracer, permessageDeflate, inflateBytes, recordInflateBytes, _onData, _writeFn) {
    super();
    this._tracer = _tracer;
    this._onData = _onData;
    this._writeFn = _writeFn;
    this._onError = this._register(new Emitter());
    this.onError = this._onError.event;
    this._writeQueue = [];
    this._readQueue = [];
    this._onDidFinishProcessingReadQueue = this._register(new Emitter());
    this.onDidFinishProcessingReadQueue = this._onDidFinishProcessingReadQueue.event;
    this._onDidFinishProcessingWriteQueue = this._register(new Emitter());
    this.onDidFinishProcessingWriteQueue = this._onDidFinishProcessingWriteQueue.event;
    this._isProcessingWriteQueue = false;
    this._isProcessingReadQueue = false;
    if (permessageDeflate) {
      this._zlibInflateStream = this._register(new ZlibInflateStream(this._tracer, recordInflateBytes, inflateBytes, { windowBits: 15 }));
      this._zlibDeflateStream = this._register(new ZlibDeflateStream(this._tracer, { windowBits: 15 }));
      this._register(this._zlibInflateStream.onError((err) => this._onError.fire(err)));
      this._register(this._zlibDeflateStream.onError((err) => this._onError.fire(err)));
    } else {
      this._zlibInflateStream = null;
      this._zlibDeflateStream = null;
    }
  }
  get permessageDeflate() {
    return Boolean(this._zlibInflateStream && this._zlibDeflateStream);
  }
  get recordedInflateBytes() {
    if (this._zlibInflateStream) {
      return this._zlibInflateStream.recordedInflateBytes;
    }
    return VSBuffer.alloc(0);
  }
  writeMessage(data, options) {
    this._writeQueue.push({ data, options });
    this._processWriteQueue();
  }
  async _processWriteQueue() {
    if (this._isProcessingWriteQueue) {
      return;
    }
    this._isProcessingWriteQueue = true;
    while (this._writeQueue.length > 0) {
      const { data, options } = this._writeQueue.shift();
      if (this._zlibDeflateStream && options.compressed) {
        const compressedData = await this._deflateMessage(this._zlibDeflateStream, data);
        this._writeFn(compressedData, options);
      } else {
        this._writeFn(data, { ...options, compressed: false });
      }
    }
    this._isProcessingWriteQueue = false;
    this._onDidFinishProcessingWriteQueue.fire();
  }
  isProcessingWriteQueue() {
    return this._isProcessingWriteQueue;
  }
  /**
   * Subsequent calls should wait for the previous `_deflateBuffer` call to complete.
   */
  _deflateMessage(zlibDeflateStream, buffer) {
    return new Promise((resolve, reject) => {
      zlibDeflateStream.write(buffer);
      zlibDeflateStream.flush((data) => resolve(data));
    });
  }
  acceptFrame(data, isCompressed, isLastFrameOfMessage) {
    this._readQueue.push({ data, isCompressed, isLastFrameOfMessage });
    this._processReadQueue();
  }
  async _processReadQueue() {
    if (this._isProcessingReadQueue) {
      return;
    }
    this._isProcessingReadQueue = true;
    while (this._readQueue.length > 0) {
      const frameInfo = this._readQueue.shift();
      if (this._zlibInflateStream && frameInfo.isCompressed) {
        const data = await this._inflateFrame(this._zlibInflateStream, frameInfo.data, frameInfo.isLastFrameOfMessage);
        this._onData.fire(data);
      } else {
        this._onData.fire(frameInfo.data);
      }
    }
    this._isProcessingReadQueue = false;
    this._onDidFinishProcessingReadQueue.fire();
  }
  isProcessingReadQueue() {
    return this._isProcessingReadQueue;
  }
  /**
   * Subsequent calls should wait for the previous `transformRead` call to complete.
   */
  _inflateFrame(zlibInflateStream, buffer, isLastFrameOfMessage) {
    return new Promise((resolve, reject) => {
      zlibInflateStream.write(buffer);
      if (isLastFrameOfMessage) {
        zlibInflateStream.write(VSBuffer.fromByteArray([0, 0, 255, 255]));
      }
      zlibInflateStream.flush((data) => resolve(data));
    });
  }
}
class ZlibInflateStream extends Disposable {
  constructor(_tracer, _recordInflateBytes, inflateBytes, options) {
    super();
    this._tracer = _tracer;
    this._recordInflateBytes = _recordInflateBytes;
    this._onError = this._register(new Emitter());
    this.onError = this._onError.event;
    this._recordedInflateBytes = [];
    this._pendingInflateData = [];
    this._zlibInflate = createInflateRaw(options);
    this._zlibInflate.on("error", (err) => {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateError, { message: err?.message, code: err?.code });
      this._onError.fire(err);
    });
    this._zlibInflate.on("data", (data) => {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateData, data);
      this._pendingInflateData.push(VSBuffer.wrap(data));
    });
    if (inflateBytes) {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateInitialWrite, inflateBytes.buffer);
      this._zlibInflate.write(inflateBytes.buffer);
      this._zlibInflate.flush(() => {
        this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateInitialFlushFired);
        this._pendingInflateData.length = 0;
      });
    }
  }
  get recordedInflateBytes() {
    if (this._recordInflateBytes) {
      return VSBuffer.concat(this._recordedInflateBytes);
    }
    return VSBuffer.alloc(0);
  }
  write(buffer) {
    if (this._recordInflateBytes) {
      this._recordedInflateBytes.push(buffer.clone());
    }
    this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateWrite, buffer);
    this._zlibInflate.write(buffer.buffer);
  }
  flush(callback) {
    this._zlibInflate.flush(() => {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibInflateFlushFired);
      const data = VSBuffer.concat(this._pendingInflateData);
      this._pendingInflateData.length = 0;
      callback(data);
    });
  }
}
class ZlibDeflateStream extends Disposable {
  constructor(_tracer, options) {
    super();
    this._tracer = _tracer;
    this._onError = this._register(new Emitter());
    this.onError = this._onError.event;
    this._pendingDeflateData = [];
    this._zlibDeflate = createDeflateRaw({
      windowBits: 15
    });
    this._zlibDeflate.on("error", (err) => {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibDeflateError, { message: err?.message, code: err?.code });
      this._onError.fire(err);
    });
    this._zlibDeflate.on("data", (data) => {
      this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibDeflateData, data);
      this._pendingDeflateData.push(VSBuffer.wrap(data));
    });
  }
  write(buffer) {
    this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibDeflateWrite, buffer.buffer);
    this._zlibDeflate.write(buffer.buffer);
  }
  flush(callback) {
    this._zlibDeflate.flush(
      /*Z_SYNC_FLUSH*/
      2,
      () => {
        this._tracer.traceSocketEvent(SocketDiagnosticsEventType.zlibDeflateFlushFired);
        let data = VSBuffer.concat(this._pendingDeflateData);
        this._pendingDeflateData.length = 0;
        data = data.slice(0, data.byteLength - 4);
        callback(data);
      }
    );
  }
}
function unmask(buffer, mask) {
  if (mask === 0) {
    return;
  }
  const cnt = buffer.byteLength >>> 2;
  for (let i = 0; i < cnt; i++) {
    const v = buffer.readUInt32BE(i * 4);
    buffer.writeUInt32BE(v ^ mask, i * 4);
  }
  const offset = cnt * 4;
  const bytesLeft = buffer.byteLength - offset;
  const m3 = mask >>> 24 & 255;
  const m2 = mask >>> 16 & 255;
  const m1 = mask >>> 8 & 255;
  if (bytesLeft >= 1) {
    buffer.writeUInt8(buffer.readUInt8(offset) ^ m3, offset);
  }
  if (bytesLeft >= 2) {
    buffer.writeUInt8(buffer.readUInt8(offset + 1) ^ m2, offset + 1);
  }
  if (bytesLeft >= 3) {
    buffer.writeUInt8(buffer.readUInt8(offset + 2) ^ m1, offset + 2);
  }
}
const XDG_RUNTIME_DIR = process.env["XDG_RUNTIME_DIR"];
const safeIpcPathLengths = {
  [Platform.Linux]: 107,
  [Platform.Mac]: 103
};
function createRandomIPCHandle() {
  const randomSuffix = generateUuid();
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\vscode-ipc-${randomSuffix}-sock`;
  }
  const basePath = process.platform !== "darwin" && XDG_RUNTIME_DIR ? XDG_RUNTIME_DIR : tmpdir();
  const result = join(basePath, `vscode-ipc-${randomSuffix}.sock`);
  validateIPCHandleLength(result);
  return result;
}
function createStaticIPCHandle(directoryPath, type, version) {
  const scope = createHash("sha256").update(directoryPath).digest("hex");
  const scopeForSocket = scope.substr(0, 8);
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${scopeForSocket}-${version}-${type}-sock`;
  }
  const versionForSocket = version.substr(0, 4);
  const typeForSocket = type.substr(0, 6);
  let result;
  if (process.platform !== "darwin" && XDG_RUNTIME_DIR && !process.env["VSCODE_PORTABLE"]) {
    result = join(XDG_RUNTIME_DIR, `vscode-${scopeForSocket}-${versionForSocket}-${typeForSocket}.sock`);
  } else {
    result = join(directoryPath, `${versionForSocket}-${typeForSocket}.sock`);
  }
  validateIPCHandleLength(result);
  return result;
}
function validateIPCHandleLength(handle) {
  const limit = safeIpcPathLengths[platform];
  if (typeof limit === "number" && handle.length >= limit) {
    console.warn(`WARNING: IPC handle "${handle}" is longer than ${limit} chars, try a shorter --user-data-dir`);
  }
}
class Server extends IPCServer {
  static toClientConnectionEvent(server) {
    const onConnection = Event.fromNodeEventEmitter(server, "connection");
    return Event.map(onConnection, (socket) => ({
      protocol: new Protocol(new NodeSocket(socket, "ipc-server-connection")),
      onDidClientDisconnect: Event.once(Event.fromNodeEventEmitter(socket, "close"))
    }));
  }
  constructor(server) {
    super(Server.toClientConnectionEvent(server));
    this.server = server;
  }
  dispose() {
    super.dispose();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
function serve(hook) {
  return new Promise((c, e) => {
    const server = createServer();
    server.on("error", e);
    server.listen(hook, () => {
      server.removeListener("error", e);
      c(new Server(server));
    });
  });
}
function connect(hook, clientId) {
  return new Promise((c, e) => {
    const socket = createConnection(hook, () => {
      socket.removeListener("error", e);
      c(Client.fromSocket(new NodeSocket(socket, `ipc-client${clientId}`), clientId));
    });
    socket.once("error", e);
  });
}
export {
  NodeSocket,
  Server,
  WebSocketNodeSocket,
  XDG_RUNTIME_DIR,
  connect,
  createRandomIPCHandle,
  createStaticIPCHandle,
  serve
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy9ub2RlL2lwYy5uZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IFNlcnZlciBhcyBOZXRTZXJ2ZXIsIFNvY2tldCwgY3JlYXRlU2VydmVyLCBjcmVhdGVDb25uZWN0aW9uIH0gZnJvbSAnbmV0JztcbmltcG9ydCB7IHRtcGRpciB9IGZyb20gJ29zJztcbmltcG9ydCB7IGNyZWF0ZURlZmxhdGVSYXcsIFpsaWJPcHRpb25zLCBJbmZsYXRlUmF3LCBEZWZsYXRlUmF3LCBjcmVhdGVJbmZsYXRlUmF3IH0gZnJvbSAnemxpYic7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgUGxhdGZvcm0sIHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IENsaWVudENvbm5lY3Rpb25FdmVudCwgSVBDU2VydmVyIH0gZnJvbSAnLi4vY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBDaHVua1N0cmVhbSwgQ2xpZW50LCBJU29ja2V0LCBQcm90b2NvbCwgU29ja2V0Q2xvc2VFdmVudCwgU29ja2V0Q2xvc2VFdmVudFR5cGUsIFNvY2tldERpYWdub3N0aWNzLCBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSB9IGZyb20gJy4uL2NvbW1vbi9pcGMubmV0LmpzJztcblxuLyoqXG4gKiBNYXhpbXVtIHRpbWUgdG8gd2FpdCBmb3IgYSAnY2xvc2UnIGV2ZW50IHRvIGZpcmUgYWZ0ZXIgdGhlIHNvY2tldCBzdHJlYW1cbiAqIGVuZHMuIEZvciB1bml4IGRvbWFpbiBzb2NrZXRzLCB0aGUgY2xvc2UgZXZlbnQgbWF5IG5vdCBmaXJlIGNvbnNpc3RlbnRseVxuICogZHVlIHRvIHdoYXQgYXBwZWFycyB0byBiZSBhIE5vZGUuanMgYnVnLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIxMTQ2MiNpc3N1ZWNvbW1lbnQtMjE1NTQ3MTk5NlxuICovXG5jb25zdCBzb2NrZXRFbmRUaW1lb3V0TXMgPSAzMF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBOb2RlU29ja2V0IGltcGxlbWVudHMgSVNvY2tldCB7XG5cblx0cHVibGljIHJlYWRvbmx5IGRlYnVnTGFiZWw6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IHNvY2tldDogU29ja2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lcnJvckxpc3RlbmVyOiAoZXJyOiBhbnkpID0+IHZvaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Nsb3NlTGlzdGVuZXI6IChoYWRFcnJvcjogYm9vbGVhbikgPT4gdm9pZDtcblx0cHJpdmF0ZSByZWFkb25seSBfZW5kTGlzdGVuZXI6ICgpID0+IHZvaWQ7XG5cdHByaXZhdGUgX2NhbldyaXRlID0gdHJ1ZTtcblxuXHRwdWJsaWMgdHJhY2VTb2NrZXRFdmVudCh0eXBlOiBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSwgZGF0YT86IFZTQnVmZmVyIHwgVWludDhBcnJheSB8IEFycmF5QnVmZmVyIHwgQXJyYXlCdWZmZXJWaWV3IHwgYW55KTogdm9pZCB7XG5cdFx0U29ja2V0RGlhZ25vc3RpY3MudHJhY2VTb2NrZXRFdmVudCh0aGlzLnNvY2tldCwgdGhpcy5kZWJ1Z0xhYmVsLCB0eXBlLCBkYXRhKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHNvY2tldDogU29ja2V0LCBkZWJ1Z0xhYmVsOiBzdHJpbmcgPSAnJykge1xuXHRcdHRoaXMuZGVidWdMYWJlbCA9IGRlYnVnTGFiZWw7XG5cdFx0dGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG5cdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLkNyZWF0ZWQsIHsgdHlwZTogJ05vZGVTb2NrZXQnIH0pO1xuXHRcdHRoaXMuX2Vycm9yTGlzdGVuZXIgPSAoZXJyOiBhbnkpID0+IHtcblx0XHRcdHRoaXMudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS5FcnJvciwgeyBjb2RlOiBlcnI/LmNvZGUsIG1lc3NhZ2U6IGVycj8ubWVzc2FnZSB9KTtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0aWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG5cdFx0XHRcdFx0Ly8gQW4gRVBJUEUgZXhjZXB0aW9uIGF0IHRoZSB3cm9uZyB0aW1lIGNhbiBsZWFkIHRvIGEgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaFxuXHRcdFx0XHRcdC8vIHNvIGlnbm9yZSB0aGUgZXJyb3Igc2luY2UgdGhlIHNvY2tldCB3aWxsIGZpcmUgdGhlIGNsb3NlIGV2ZW50IHNvb24gYW55d2F5czpcblx0XHRcdFx0XHQvLyA+IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvZXJyb3JzLmh0bWwjZXJyb3JzX2NvbW1vbl9zeXN0ZW1fZXJyb3JzXG5cdFx0XHRcdFx0Ly8gPiBFUElQRSAoQnJva2VuIHBpcGUpOiBBIHdyaXRlIG9uIGEgcGlwZSwgc29ja2V0LCBvciBGSUZPIGZvciB3aGljaCB0aGVyZSBpcyBub1xuXHRcdFx0XHRcdC8vID4gcHJvY2VzcyB0byByZWFkIHRoZSBkYXRhLiBDb21tb25seSBlbmNvdW50ZXJlZCBhdCB0aGUgbmV0IGFuZCBodHRwIGxheWVycyxcblx0XHRcdFx0XHQvLyA+IGluZGljYXRpdmUgdGhhdCB0aGUgcmVtb3RlIHNpZGUgb2YgdGhlIHN0cmVhbSBiZWluZyB3cml0dGVuIHRvIGhhcyBiZWVuIGNsb3NlZC5cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuc29ja2V0Lm9uKCdlcnJvcicsIHRoaXMuX2Vycm9yTGlzdGVuZXIpO1xuXG5cdFx0bGV0IGVuZFRpbWVvdXRIYW5kbGU6IE5vZGVKUy5UaW1lb3V0IHwgdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2Nsb3NlTGlzdGVuZXIgPSAoaGFkRXJyb3I6IGJvb2xlYW4pID0+IHtcblx0XHRcdHRoaXMudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS5DbG9zZSwgeyBoYWRFcnJvciB9KTtcblx0XHRcdHRoaXMuX2NhbldyaXRlID0gZmFsc2U7XG5cdFx0XHRpZiAoZW5kVGltZW91dEhhbmRsZSkge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoZW5kVGltZW91dEhhbmRsZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLnNvY2tldC5vbignY2xvc2UnLCB0aGlzLl9jbG9zZUxpc3RlbmVyKTtcblxuXHRcdHRoaXMuX2VuZExpc3RlbmVyID0gKCkgPT4ge1xuXHRcdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLk5vZGVFbmRSZWNlaXZlZCk7XG5cdFx0XHR0aGlzLl9jYW5Xcml0ZSA9IGZhbHNlO1xuXHRcdFx0ZW5kVGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4gc29ja2V0LmRlc3Ryb3koKSwgc29ja2V0RW5kVGltZW91dE1zKTtcblx0XHR9O1xuXHRcdHRoaXMuc29ja2V0Lm9uKCdlbmQnLCB0aGlzLl9lbmRMaXN0ZW5lcik7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnNvY2tldC5vZmYoJ2Vycm9yJywgdGhpcy5fZXJyb3JMaXN0ZW5lcik7XG5cdFx0dGhpcy5zb2NrZXQub2ZmKCdjbG9zZScsIHRoaXMuX2Nsb3NlTGlzdGVuZXIpO1xuXHRcdHRoaXMuc29ja2V0Lm9mZignZW5kJywgdGhpcy5fZW5kTGlzdGVuZXIpO1xuXHRcdHRoaXMuc29ja2V0LmRlc3Ryb3koKTtcblx0fVxuXG5cdHB1YmxpYyBvbkRhdGEoX2xpc3RlbmVyOiAoZTogVlNCdWZmZXIpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgbGlzdGVuZXIgPSAoYnVmZjogQnVmZmVyKSA9PiB7XG5cdFx0XHR0aGlzLnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuUmVhZCwgYnVmZik7XG5cdFx0XHRfbGlzdGVuZXIoVlNCdWZmZXIud3JhcChidWZmKSk7XG5cdFx0fTtcblx0XHR0aGlzLnNvY2tldC5vbignZGF0YScsIGxpc3RlbmVyKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4gdGhpcy5zb2NrZXQub2ZmKCdkYXRhJywgbGlzdGVuZXIpXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBvbkNsb3NlKGxpc3RlbmVyOiAoZTogU29ja2V0Q2xvc2VFdmVudCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBhZGFwdGVyID0gKGhhZEVycm9yOiBib29sZWFuKSA9PiB7XG5cdFx0XHRsaXN0ZW5lcih7XG5cdFx0XHRcdHR5cGU6IFNvY2tldENsb3NlRXZlbnRUeXBlLk5vZGVTb2NrZXRDbG9zZUV2ZW50LFxuXHRcdFx0XHRoYWRFcnJvcjogaGFkRXJyb3IsXG5cdFx0XHRcdGVycm9yOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdH07XG5cdFx0dGhpcy5zb2NrZXQub24oJ2Nsb3NlJywgYWRhcHRlcik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHRoaXMuc29ja2V0Lm9mZignY2xvc2UnLCBhZGFwdGVyKVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgb25FbmQobGlzdGVuZXI6ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgYWRhcHRlciA9ICgpID0+IHtcblx0XHRcdGxpc3RlbmVyKCk7XG5cdFx0fTtcblx0XHR0aGlzLnNvY2tldC5vbignZW5kJywgYWRhcHRlcik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHRoaXMuc29ja2V0Lm9mZignZW5kJywgYWRhcHRlcilcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHdyaXRlKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHQvLyByZXR1cm4gZWFybHkgaWYgc29ja2V0IGhhcyBiZWVuIGRlc3Ryb3llZCBpbiB0aGUgbWVhbnRpbWVcblx0XHRpZiAodGhpcy5zb2NrZXQuZGVzdHJveWVkIHx8ICF0aGlzLl9jYW5Xcml0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHdlIGlnbm9yZSB0aGUgcmV0dXJuZWQgdmFsdWUgZnJvbSBgd3JpdGVgIGJlY2F1c2Ugd2Ugd291bGQgaGF2ZSB0byBjYWNoZWQgdGhlIGRhdGFcblx0XHQvLyBhbnl3YXlzIGFuZCBub2RlanMgaXMgYWxyZWFkeSBkb2luZyB0aGF0IGZvciB1czpcblx0XHQvLyA+IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvc3RyZWFtLmh0bWwjc3RyZWFtX3dyaXRhYmxlX3dyaXRlX2NodW5rX2VuY29kaW5nX2NhbGxiYWNrXG5cdFx0Ly8gPiBIb3dldmVyLCB0aGUgZmFsc2UgcmV0dXJuIHZhbHVlIGlzIG9ubHkgYWR2aXNvcnkgYW5kIHRoZSB3cml0YWJsZSBzdHJlYW0gd2lsbCB1bmNvbmRpdGlvbmFsbHlcblx0XHQvLyA+IGFjY2VwdCBhbmQgYnVmZmVyIGNodW5rIGV2ZW4gaWYgaXQgaGFzIG5vdCBiZWVuIGFsbG93ZWQgdG8gZHJhaW4uXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS5Xcml0ZSwgYnVmZmVyKTtcblx0XHRcdHRoaXMuc29ja2V0LndyaXRlKGJ1ZmZlci5idWZmZXIsIChlcnI6IGFueSkgPT4ge1xuXHRcdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdFx0aWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG5cdFx0XHRcdFx0XHQvLyBBbiBFUElQRSBleGNlcHRpb24gYXQgdGhlIHdyb25nIHRpbWUgY2FuIGxlYWQgdG8gYSByZW5kZXJlciBwcm9jZXNzIGNyYXNoXG5cdFx0XHRcdFx0XHQvLyBzbyBpZ25vcmUgdGhlIGVycm9yIHNpbmNlIHRoZSBzb2NrZXQgd2lsbCBmaXJlIHRoZSBjbG9zZSBldmVudCBzb29uIGFueXdheXM6XG5cdFx0XHRcdFx0XHQvLyA+IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvZXJyb3JzLmh0bWwjZXJyb3JzX2NvbW1vbl9zeXN0ZW1fZXJyb3JzXG5cdFx0XHRcdFx0XHQvLyA+IEVQSVBFIChCcm9rZW4gcGlwZSk6IEEgd3JpdGUgb24gYSBwaXBlLCBzb2NrZXQsIG9yIEZJRk8gZm9yIHdoaWNoIHRoZXJlIGlzIG5vXG5cdFx0XHRcdFx0XHQvLyA+IHByb2Nlc3MgdG8gcmVhZCB0aGUgZGF0YS4gQ29tbW9ubHkgZW5jb3VudGVyZWQgYXQgdGhlIG5ldCBhbmQgaHR0cCBsYXllcnMsXG5cdFx0XHRcdFx0XHQvLyA+IGluZGljYXRpdmUgdGhhdCB0aGUgcmVtb3RlIHNpZGUgb2YgdGhlIHN0cmVhbSBiZWluZyB3cml0dGVuIHRvIGhhcyBiZWVuIGNsb3NlZC5cblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHtcblx0XHRcdFx0Ly8gQW4gRVBJUEUgZXhjZXB0aW9uIGF0IHRoZSB3cm9uZyB0aW1lIGNhbiBsZWFkIHRvIGEgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaFxuXHRcdFx0XHQvLyBzbyBpZ25vcmUgdGhlIGVycm9yIHNpbmNlIHRoZSBzb2NrZXQgd2lsbCBmaXJlIHRoZSBjbG9zZSBldmVudCBzb29uIGFueXdheXM6XG5cdFx0XHRcdC8vID4gaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9lcnJvcnMuaHRtbCNlcnJvcnNfY29tbW9uX3N5c3RlbV9lcnJvcnNcblx0XHRcdFx0Ly8gPiBFUElQRSAoQnJva2VuIHBpcGUpOiBBIHdyaXRlIG9uIGEgcGlwZSwgc29ja2V0LCBvciBGSUZPIGZvciB3aGljaCB0aGVyZSBpcyBub1xuXHRcdFx0XHQvLyA+IHByb2Nlc3MgdG8gcmVhZCB0aGUgZGF0YS4gQ29tbW9ubHkgZW5jb3VudGVyZWQgYXQgdGhlIG5ldCBhbmQgaHR0cCBsYXllcnMsXG5cdFx0XHRcdC8vID4gaW5kaWNhdGl2ZSB0aGF0IHRoZSByZW1vdGUgc2lkZSBvZiB0aGUgc3RyZWFtIGJlaW5nIHdyaXR0ZW4gdG8gaGFzIGJlZW4gY2xvc2VkLlxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBlbmQoKTogdm9pZCB7XG5cdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLk5vZGVFbmRTZW50KTtcblx0XHR0aGlzLnNvY2tldC5lbmQoKTtcblx0fVxuXG5cdHB1YmxpYyBkcmFpbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuTm9kZURyYWluQmVnaW4pO1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5zb2NrZXQuYnVmZmVyU2l6ZSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuTm9kZURyYWluRW5kKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmaW5pc2hlZCA9ICgpID0+IHtcblx0XHRcdFx0dGhpcy5zb2NrZXQub2ZmKCdjbG9zZScsIGZpbmlzaGVkKTtcblx0XHRcdFx0dGhpcy5zb2NrZXQub2ZmKCdlbmQnLCBmaW5pc2hlZCk7XG5cdFx0XHRcdHRoaXMuc29ja2V0Lm9mZignZXJyb3InLCBmaW5pc2hlZCk7XG5cdFx0XHRcdHRoaXMuc29ja2V0Lm9mZigndGltZW91dCcsIGZpbmlzaGVkKTtcblx0XHRcdFx0dGhpcy5zb2NrZXQub2ZmKCdkcmFpbicsIGZpbmlzaGVkKTtcblx0XHRcdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLk5vZGVEcmFpbkVuZCk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLnNvY2tldC5vbignY2xvc2UnLCBmaW5pc2hlZCk7XG5cdFx0XHR0aGlzLnNvY2tldC5vbignZW5kJywgZmluaXNoZWQpO1xuXHRcdFx0dGhpcy5zb2NrZXQub24oJ2Vycm9yJywgZmluaXNoZWQpO1xuXHRcdFx0dGhpcy5zb2NrZXQub24oJ3RpbWVvdXQnLCBmaW5pc2hlZCk7XG5cdFx0XHR0aGlzLnNvY2tldC5vbignZHJhaW4nLCBmaW5pc2hlZCk7XG5cdFx0fSk7XG5cdH1cbn1cblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHRNaW5IZWFkZXJCeXRlU2l6ZSA9IDIsXG5cdC8qKlxuXHQgKiBJZiB3ZSBuZWVkIHRvIHdyaXRlIGEgbGFyZ2UgYnVmZmVyLCB3ZSB3aWxsIHNwbGl0IGl0IGludG8gMjU2S0IgY2h1bmtzIGFuZFxuXHQgKiBzZW5kIGVhY2ggY2h1bmsgYXMgYSB3ZWJzb2NrZXQgbWVzc2FnZS4gVGhpcyBpcyB0byBwcmV2ZW50IHRoYXQgdGhlIHNlbmRpbmdcblx0ICogc2lkZSBpcyBzdHVjayB3YWl0aW5nIGZvciB0aGUgZW50aXJlIGJ1ZmZlciB0byBiZSBjb21wcmVzc2VkIGJlZm9yZSB3cml0aW5nXG5cdCAqIHRvIHRoZSB1bmRlcmx5aW5nIHNvY2tldCBvciB0aGF0IHRoZSByZWNlaXZpbmcgc2lkZSBpcyBzdHVjayB3YWl0aW5nIGZvciB0aGVcblx0ICogZW50aXJlIG1lc3NhZ2UgdG8gYmUgcmVjZWl2ZWQgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIGJ5dGVzLlxuXHQgKi9cblx0TWF4V2ViU29ja2V0TWVzc2FnZUxlbmd0aCA9IDI1NiAqIDEwMjQgLy8gMjU2IEtCXG59XG5cbmNvbnN0IGVudW0gUmVhZFN0YXRlIHtcblx0UGVla0hlYWRlciA9IDEsXG5cdFJlYWRIZWFkZXIgPSAyLFxuXHRSZWFkQm9keSA9IDMsXG5cdEZpbiA9IDRcbn1cblxuaW50ZXJmYWNlIElTb2NrZXRUcmFjZXIge1xuXHR0cmFjZVNvY2tldEV2ZW50KHR5cGU6IFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLCBkYXRhPzogVlNCdWZmZXIgfCBVaW50OEFycmF5IHwgQXJyYXlCdWZmZXIgfCBBcnJheUJ1ZmZlclZpZXcgfCBhbnkpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgRnJhbWVPcHRpb25zIHtcblx0Y29tcHJlc3NlZDogYm9vbGVhbjtcblx0b3Bjb2RlOiBudW1iZXI7XG59XG5cbi8qKlxuICogU2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM2NDU1I3NlY3Rpb24tNS4yXG4gKi9cbmV4cG9ydCBjbGFzcyBXZWJTb2NrZXROb2RlU29ja2V0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTb2NrZXQsIElTb2NrZXRUcmFjZXIge1xuXG5cdHB1YmxpYyByZWFkb25seSBzb2NrZXQ6IE5vZGVTb2NrZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Zsb3dNYW5hZ2VyOiBXZWJTb2NrZXRGbG93TWFuYWdlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5jb21pbmdEYXRhOiBDaHVua1N0cmVhbTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VlNCdWZmZXI+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNsb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8U29ja2V0Q2xvc2VFdmVudD4oKSk7XG5cdHByaXZhdGUgX2lzRW5kZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGF0ZSA9IHtcblx0XHRzdGF0ZTogUmVhZFN0YXRlLlBlZWtIZWFkZXIsXG5cdFx0cmVhZExlbjogQ29uc3RhbnRzLk1pbkhlYWRlckJ5dGVTaXplLFxuXHRcdGZpbjogMCxcblx0XHRjb21wcmVzc2VkOiBmYWxzZSxcblx0XHRmaXJzdEZyYW1lT2ZNZXNzYWdlOiB0cnVlLFxuXHRcdG1hc2s6IDAsXG5cdFx0b3Bjb2RlOiAwXG5cdH07XG5cblx0cHVibGljIGdldCBwZXJtZXNzYWdlRGVmbGF0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZmxvd01hbmFnZXIucGVybWVzc2FnZURlZmxhdGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHJlY29yZGVkSW5mbGF0ZUJ5dGVzKCk6IFZTQnVmZmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fZmxvd01hbmFnZXIucmVjb3JkZWRJbmZsYXRlQnl0ZXM7XG5cdH1cblxuXHRwdWJsaWMgdHJhY2VTb2NrZXRFdmVudCh0eXBlOiBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSwgZGF0YT86IFZTQnVmZmVyIHwgVWludDhBcnJheSB8IEFycmF5QnVmZmVyIHwgQXJyYXlCdWZmZXJWaWV3IHwgYW55KTogdm9pZCB7XG5cdFx0dGhpcy5zb2NrZXQudHJhY2VTb2NrZXRFdmVudCh0eXBlLCBkYXRhKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBzb2NrZXQgd2hpY2ggY2FuIGNvbW11bmljYXRlIHVzaW5nIFdlYlNvY2tldCBmcmFtZXMuXG5cdCAqXG5cdCAqICoqTk9URSoqOiBXaGVuIHVzaW5nIHRoZSBwZXJtZXNzYWdlLWRlZmxhdGUgV2ViU29ja2V0IGV4dGVuc2lvbiwgaWYgcGFydHMgb2YgaW5mbGF0aW5nIHdhcyBkb25lXG5cdCAqICBpbiBhIGRpZmZlcmVudCB6bGliIGluc3RhbmNlLCB3ZSBuZWVkIHRvIHBhc3MgYWxsIHRob3NlIGJ5dGVzIGludG8gemxpYiwgb3RoZXJ3aXNlIHRoZSBpbmZsYXRlXG5cdCAqICBtaWdodCBoaXQgYW4gaW5mbGF0ZWQgcG9ydGlvbiByZWZlcmVuY2luZyBhIGRpc3RhbmNlIHRvbyBmYXIgYmFjay5cblx0ICpcblx0ICogQHBhcmFtIHNvY2tldCBUaGUgdW5kZXJseWluZyBzb2NrZXRcblx0ICogQHBhcmFtIHBlcm1lc3NhZ2VEZWZsYXRlIFVzZSB0aGUgcGVybWVzc2FnZS1kZWZsYXRlIFdlYlNvY2tldCBleHRlbnNpb25cblx0ICogQHBhcmFtIGluZmxhdGVCeXRlcyBcIlNlZWRcIiB6bGliIGluZmxhdGUgd2l0aCB0aGVzZSBieXRlcy5cblx0ICogQHBhcmFtIHJlY29yZEluZmxhdGVCeXRlcyBSZWNvcmQgYWxsIGJ5dGVzIHNlbnQgdG8gaW5mbGF0ZVxuXHQgKi9cblx0Y29uc3RydWN0b3Ioc29ja2V0OiBOb2RlU29ja2V0LCBwZXJtZXNzYWdlRGVmbGF0ZTogYm9vbGVhbiwgaW5mbGF0ZUJ5dGVzOiBWU0J1ZmZlciB8IG51bGwsIHJlY29yZEluZmxhdGVCeXRlczogYm9vbGVhbikge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG5cdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLkNyZWF0ZWQsIHsgdHlwZTogJ1dlYlNvY2tldE5vZGVTb2NrZXQnLCBwZXJtZXNzYWdlRGVmbGF0ZSwgaW5mbGF0ZUJ5dGVzTGVuZ3RoOiBpbmZsYXRlQnl0ZXM/LmJ5dGVMZW5ndGggfHwgMCwgcmVjb3JkSW5mbGF0ZUJ5dGVzIH0pO1xuXHRcdHRoaXMuX2Zsb3dNYW5hZ2VyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdlYlNvY2tldEZsb3dNYW5hZ2VyKFxuXHRcdFx0dGhpcyxcblx0XHRcdHBlcm1lc3NhZ2VEZWZsYXRlLFxuXHRcdFx0aW5mbGF0ZUJ5dGVzLFxuXHRcdFx0cmVjb3JkSW5mbGF0ZUJ5dGVzLFxuXHRcdFx0dGhpcy5fb25EYXRhLFxuXHRcdFx0KGRhdGEsIG9wdGlvbnMpID0+IHRoaXMuX3dyaXRlKGRhdGEsIG9wdGlvbnMpXG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmxvd01hbmFnZXIub25FcnJvcigoZXJyKSA9PiB7XG5cdFx0XHQvLyB6bGliIGVycm9ycyBhcmUgZmF0YWwsIHNpbmNlIHdlIGhhdmUgbm8gaWRlYSBob3cgdG8gcmVjb3ZlclxuXHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdHRoaXMuX29uQ2xvc2UuZmlyZSh7XG5cdFx0XHRcdHR5cGU6IFNvY2tldENsb3NlRXZlbnRUeXBlLk5vZGVTb2NrZXRDbG9zZUV2ZW50LFxuXHRcdFx0XHRoYWRFcnJvcjogdHJ1ZSxcblx0XHRcdFx0ZXJyb3I6IGVyclxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2luY29taW5nRGF0YSA9IG5ldyBDaHVua1N0cmVhbSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc29ja2V0Lm9uRGF0YShkYXRhID0+IHRoaXMuX2FjY2VwdENodW5rKGRhdGEpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zb2NrZXQub25DbG9zZShhc3luYyAoZSkgPT4ge1xuXHRcdFx0Ly8gRGVsYXkgc3VyZmFjaW5nIHRoZSBjbG9zZSBldmVudCB1bnRpbCB0aGUgYXN5bmMgaW5mbGF0aW5nIGlzIGRvbmVcblx0XHRcdC8vIGFuZCBhbGwgZGF0YSBoYXMgYmVlbiBlbWl0dGVkXG5cdFx0XHRpZiAodGhpcy5fZmxvd01hbmFnZXIuaXNQcm9jZXNzaW5nUmVhZFF1ZXVlKCkpIHtcblx0XHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHRoaXMuX2Zsb3dNYW5hZ2VyLm9uRGlkRmluaXNoUHJvY2Vzc2luZ1JlYWRRdWV1ZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkNsb3NlLmZpcmUoZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2Zsb3dNYW5hZ2VyLmlzUHJvY2Vzc2luZ1dyaXRlUXVldWUoKSkge1xuXHRcdFx0Ly8gV2FpdCBmb3IgYW55IG91dHN0YW5kaW5nIHdyaXRlcyB0byBmaW5pc2ggYmVmb3JlIGRpc3Bvc2luZ1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmxvd01hbmFnZXIub25EaWRGaW5pc2hQcm9jZXNzaW5nV3JpdGVRdWV1ZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNvY2tldC5kaXNwb3NlKCk7XG5cdFx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG9uRGF0YShsaXN0ZW5lcjogKGU6IFZTQnVmZmVyKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB0aGlzLl9vbkRhdGEuZXZlbnQobGlzdGVuZXIpO1xuXHR9XG5cblx0cHVibGljIG9uQ2xvc2UobGlzdGVuZXI6IChlOiBTb2NrZXRDbG9zZUV2ZW50KSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB0aGlzLl9vbkNsb3NlLmV2ZW50KGxpc3RlbmVyKTtcblx0fVxuXG5cdHB1YmxpYyBvbkVuZChsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5zb2NrZXQub25FbmQobGlzdGVuZXIpO1xuXHR9XG5cblx0cHVibGljIHdyaXRlKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHQvLyBJZiB3ZSB3cml0ZSBtYW55IGxvZ2ljYWwgbWVzc2FnZXMgKGxldCdzIHNheSAxMDAwIG1lc3NhZ2VzIG9mIDEwMEtCKSBkdXJpbmcgYSBzaW5nbGUgcHJvY2VzcyB0aWNrLCB3ZSBkb1xuXHRcdC8vIHRoaXMgdGhpbmcgd2hlcmUgd2UgaW5zdGFsbCBhIHByb2Nlc3MubmV4dFRpY2sgdGltZXIgYW5kIGdyb3VwIGFsbCBvZiB0aGVtIHRvZ2V0aGVyIGFuZCB3ZSB0aGVuIGlzc3VlIGFcblx0XHQvLyBzaW5nbGUgV2ViU29ja2V0Tm9kZVNvY2tldC53cml0ZSB3aXRoIGEgMTAwTUIgYnVmZmVyLlxuXHRcdC8vXG5cdFx0Ly8gVGhlIGZpcnN0IHByb2JsZW0gaXMgdGhhdCB0aGUgYWN0dWFsIHdyaXRpbmcgdG8gdGhlIHVuZGVybHlpbmcgbm9kZSBzb2NrZXQgd2lsbCBvbmx5IGhhcHBlbiBhZnRlciBhbGwgb2Zcblx0XHQvLyB0aGUgMTAwTUIgaGF2ZSBiZWVuIGRlZmxhdGVkIChkdWUgdG8gd2FpdGluZyBvbiB6bGliIGZsdXNoKS4gVGhlIHNlY29uZCBwcm9ibGVtIGlzIG9uIHRoZSByZWFkaW5nIHNpZGUsXG5cdFx0Ly8gd2hlcmUgd2Ugd2lsbCBnZXQgYSBzaW5nbGUgV2ViU29ja2V0Tm9kZVNvY2tldC5vbkRhdGEgZXZlbnQgZmlyZWQgd2hlbiBhbGwgdGhlIDEwME1CIGhhdmUgYXJyaXZlZCxcblx0XHQvLyBkZWxheWluZyBwcm9jZXNzaW5nIHRoZSAxMDAwIHJlY2VpdmVkIG1lc3NhZ2VzIHVudGlsIGFsbCBoYXZlIGFycml2ZWQsIGluc3RlYWQgb2YgcHJvY2Vzc2luZyB0aGVtIGFzIGVhY2hcblx0XHQvLyBvbmUgYXJyaXZlcy5cblx0XHQvL1xuXHRcdC8vIFdlIHRoZXJlZm9yZSBzcGxpdCB0aGUgYnVmZmVyIGludG8gY2h1bmtzLCBhbmQgaXNzdWUgYSB3cml0ZSBmb3IgZWFjaCBjaHVuay5cblxuXHRcdGxldCBzdGFydCA9IDA7XG5cdFx0d2hpbGUgKHN0YXJ0IDwgYnVmZmVyLmJ5dGVMZW5ndGgpIHtcblx0XHRcdHRoaXMuX2Zsb3dNYW5hZ2VyLndyaXRlTWVzc2FnZShidWZmZXIuc2xpY2Uoc3RhcnQsIE1hdGgubWluKHN0YXJ0ICsgQ29uc3RhbnRzLk1heFdlYlNvY2tldE1lc3NhZ2VMZW5ndGgsIGJ1ZmZlci5ieXRlTGVuZ3RoKSksIHsgY29tcHJlc3NlZDogdHJ1ZSwgb3Bjb2RlOiAweDAyIC8qIEJpbmFyeSBmcmFtZSAqLyB9KTtcblx0XHRcdHN0YXJ0ICs9IENvbnN0YW50cy5NYXhXZWJTb2NrZXRNZXNzYWdlTGVuZ3RoO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3dyaXRlKGJ1ZmZlcjogVlNCdWZmZXIsIHsgY29tcHJlc3NlZCwgb3Bjb2RlIH06IEZyYW1lT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0VuZGVkKSB7XG5cdFx0XHQvLyBBdm9pZCBFUlJfU1RSRUFNX1dSSVRFX0FGVEVSX0VORFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS5XZWJTb2NrZXROb2RlU29ja2V0V3JpdGUsIGJ1ZmZlcik7XG5cdFx0bGV0IGhlYWRlckxlbiA9IENvbnN0YW50cy5NaW5IZWFkZXJCeXRlU2l6ZTtcblx0XHRpZiAoYnVmZmVyLmJ5dGVMZW5ndGggPCAxMjYpIHtcblx0XHRcdGhlYWRlckxlbiArPSAwO1xuXHRcdH0gZWxzZSBpZiAoYnVmZmVyLmJ5dGVMZW5ndGggPCAyICoqIDE2KSB7XG5cdFx0XHRoZWFkZXJMZW4gKz0gMjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGVhZGVyTGVuICs9IDg7XG5cdFx0fVxuXHRcdGNvbnN0IGhlYWRlciA9IFZTQnVmZmVyLmFsbG9jKGhlYWRlckxlbik7XG5cblx0XHQvLyBUaGUgUlNWMSBiaXQgaW5kaWNhdGVzIGEgY29tcHJlc3NlZCBmcmFtZVxuXHRcdGNvbnN0IGNvbXByZXNzZWRGbGFnID0gY29tcHJlc3NlZCA/IDBiMDEwMDAwMDAgOiAwO1xuXHRcdGNvbnN0IG9wY29kZUZsYWcgPSBvcGNvZGUgJiAwYjAwMDAxMTExO1xuXHRcdGhlYWRlci53cml0ZVVJbnQ4KDBiMTAwMDAwMDAgfCBjb21wcmVzc2VkRmxhZyB8IG9wY29kZUZsYWcsIDApO1xuXHRcdGlmIChidWZmZXIuYnl0ZUxlbmd0aCA8IDEyNikge1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoYnVmZmVyLmJ5dGVMZW5ndGgsIDEpO1xuXHRcdH0gZWxzZSBpZiAoYnVmZmVyLmJ5dGVMZW5ndGggPCAyICoqIDE2KSB7XG5cdFx0XHRoZWFkZXIud3JpdGVVSW50OCgxMjYsIDEpO1xuXHRcdFx0bGV0IG9mZnNldCA9IDE7XG5cdFx0XHRoZWFkZXIud3JpdGVVSW50OCgoYnVmZmVyLmJ5dGVMZW5ndGggPj4+IDgpICYgMGIxMTExMTExMSwgKytvZmZzZXQpO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoKGJ1ZmZlci5ieXRlTGVuZ3RoID4+PiAwKSAmIDBiMTExMTExMTEsICsrb2Zmc2V0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoMTI3LCAxKTtcblx0XHRcdGxldCBvZmZzZXQgPSAxO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoMCwgKytvZmZzZXQpO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoMCwgKytvZmZzZXQpO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoMCwgKytvZmZzZXQpO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoMCwgKytvZmZzZXQpO1xuXHRcdFx0aGVhZGVyLndyaXRlVUludDgoKGJ1ZmZlci5ieXRlTGVuZ3RoID4+PiAyNCkgJiAwYjExMTExMTExLCArK29mZnNldCk7XG5cdFx0XHRoZWFkZXIud3JpdGVVSW50OCgoYnVmZmVyLmJ5dGVMZW5ndGggPj4+IDE2KSAmIDBiMTExMTExMTEsICsrb2Zmc2V0KTtcblx0XHRcdGhlYWRlci53cml0ZVVJbnQ4KChidWZmZXIuYnl0ZUxlbmd0aCA+Pj4gOCkgJiAwYjExMTExMTExLCArK29mZnNldCk7XG5cdFx0XHRoZWFkZXIud3JpdGVVSW50OCgoYnVmZmVyLmJ5dGVMZW5ndGggPj4+IDApICYgMGIxMTExMTExMSwgKytvZmZzZXQpO1xuXHRcdH1cblxuXHRcdHRoaXMuc29ja2V0LndyaXRlKFZTQnVmZmVyLmNvbmNhdChbaGVhZGVyLCBidWZmZXJdKSk7XG5cdH1cblxuXHRwdWJsaWMgZW5kKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lzRW5kZWQgPSB0cnVlO1xuXHRcdHRoaXMuc29ja2V0LmVuZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWNjZXB0Q2h1bmsoZGF0YTogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRpZiAoZGF0YS5ieXRlTGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5faW5jb21pbmdEYXRhLmFjY2VwdENodW5rKGRhdGEpO1xuXG5cdFx0d2hpbGUgKHRoaXMuX2luY29taW5nRGF0YS5ieXRlTGVuZ3RoID49IHRoaXMuX3N0YXRlLnJlYWRMZW4pIHtcblxuXHRcdFx0aWYgKHRoaXMuX3N0YXRlLnN0YXRlID09PSBSZWFkU3RhdGUuUGVla0hlYWRlcikge1xuXHRcdFx0XHQvLyBwZWVrIHRvIHNlZSBpZiB3ZSBjYW4gcmVhZCB0aGUgZW50aXJlIGhlYWRlclxuXHRcdFx0XHRjb25zdCBwZWVrSGVhZGVyID0gdGhpcy5faW5jb21pbmdEYXRhLnBlZWsodGhpcy5fc3RhdGUucmVhZExlbik7XG5cdFx0XHRcdGNvbnN0IGZpcnN0Qnl0ZSA9IHBlZWtIZWFkZXIucmVhZFVJbnQ4KDApO1xuXHRcdFx0XHRjb25zdCBmaW5CaXQgPSAoZmlyc3RCeXRlICYgMGIxMDAwMDAwMCkgPj4+IDc7XG5cdFx0XHRcdGNvbnN0IHJzdjFCaXQgPSAoZmlyc3RCeXRlICYgMGIwMTAwMDAwMCkgPj4+IDY7XG5cdFx0XHRcdGNvbnN0IG9wY29kZSA9IChmaXJzdEJ5dGUgJiAwYjAwMDAxMTExKTtcblxuXHRcdFx0XHRjb25zdCBzZWNvbmRCeXRlID0gcGVla0hlYWRlci5yZWFkVUludDgoMSk7XG5cdFx0XHRcdGNvbnN0IGhhc01hc2sgPSAoc2Vjb25kQnl0ZSAmIDBiMTAwMDAwMDApID4+PiA3O1xuXHRcdFx0XHRjb25zdCBsZW4gPSAoc2Vjb25kQnl0ZSAmIDBiMDExMTExMTEpO1xuXG5cdFx0XHRcdHRoaXMuX3N0YXRlLnN0YXRlID0gUmVhZFN0YXRlLlJlYWRIZWFkZXI7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLnJlYWRMZW4gPSBDb25zdGFudHMuTWluSGVhZGVyQnl0ZVNpemUgKyAoaGFzTWFzayA/IDQgOiAwKSArIChsZW4gPT09IDEyNiA/IDIgOiAwKSArIChsZW4gPT09IDEyNyA/IDggOiAwKTtcblx0XHRcdFx0dGhpcy5fc3RhdGUuZmluID0gZmluQml0O1xuXHRcdFx0XHRpZiAodGhpcy5fc3RhdGUuZmlyc3RGcmFtZU9mTWVzc2FnZSkge1xuXHRcdFx0XHRcdC8vIGlmIHRoZSBmcmFtZSBpcyBjb21wcmVzc2VkLCB0aGUgUlNWMSBiaXQgaXMgc2V0IG9ubHkgZm9yIHRoZSBmaXJzdCBmcmFtZSBvZiB0aGUgbWVzc2FnZVxuXHRcdFx0XHRcdHRoaXMuX3N0YXRlLmNvbXByZXNzZWQgPSBCb29sZWFuKHJzdjFCaXQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3N0YXRlLmZpcnN0RnJhbWVPZk1lc3NhZ2UgPSBCb29sZWFuKGZpbkJpdCk7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLm1hc2sgPSAwO1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5vcGNvZGUgPSBvcGNvZGU7XG5cblx0XHRcdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLldlYlNvY2tldE5vZGVTb2NrZXRQZWVrZWRIZWFkZXIsIHsgaGVhZGVyU2l6ZTogdGhpcy5fc3RhdGUucmVhZExlbiwgY29tcHJlc3NlZDogdGhpcy5fc3RhdGUuY29tcHJlc3NlZCwgZmluOiB0aGlzLl9zdGF0ZS5maW4sIG9wY29kZTogdGhpcy5fc3RhdGUub3Bjb2RlIH0pO1xuXG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlLnN0YXRlID09PSBSZWFkU3RhdGUuUmVhZEhlYWRlcikge1xuXHRcdFx0XHQvLyByZWFkIGVudGlyZSBoZWFkZXJcblx0XHRcdFx0Y29uc3QgaGVhZGVyID0gdGhpcy5faW5jb21pbmdEYXRhLnJlYWQodGhpcy5fc3RhdGUucmVhZExlbik7XG5cdFx0XHRcdGNvbnN0IHNlY29uZEJ5dGUgPSBoZWFkZXIucmVhZFVJbnQ4KDEpO1xuXHRcdFx0XHRjb25zdCBoYXNNYXNrID0gKHNlY29uZEJ5dGUgJiAwYjEwMDAwMDAwKSA+Pj4gNztcblx0XHRcdFx0bGV0IGxlbiA9IChzZWNvbmRCeXRlICYgMGIwMTExMTExMSk7XG5cblx0XHRcdFx0bGV0IG9mZnNldCA9IDE7XG5cdFx0XHRcdGlmIChsZW4gPT09IDEyNikge1xuXHRcdFx0XHRcdGxlbiA9IChcblx0XHRcdFx0XHRcdGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpICogMiAqKiA4XG5cdFx0XHRcdFx0XHQrIGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSBlbHNlIGlmIChsZW4gPT09IDEyNykge1xuXHRcdFx0XHRcdGxlbiA9IChcblx0XHRcdFx0XHRcdGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpICogMFxuXHRcdFx0XHRcdFx0KyBoZWFkZXIucmVhZFVJbnQ4KCsrb2Zmc2V0KSAqIDBcblx0XHRcdFx0XHRcdCsgaGVhZGVyLnJlYWRVSW50OCgrK29mZnNldCkgKiAwXG5cdFx0XHRcdFx0XHQrIGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpICogMFxuXHRcdFx0XHRcdFx0KyBoZWFkZXIucmVhZFVJbnQ4KCsrb2Zmc2V0KSAqIDIgKiogMjRcblx0XHRcdFx0XHRcdCsgaGVhZGVyLnJlYWRVSW50OCgrK29mZnNldCkgKiAyICoqIDE2XG5cdFx0XHRcdFx0XHQrIGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpICogMiAqKiA4XG5cdFx0XHRcdFx0XHQrIGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBtYXNrID0gMDtcblx0XHRcdFx0aWYgKGhhc01hc2spIHtcblx0XHRcdFx0XHRtYXNrID0gKFxuXHRcdFx0XHRcdFx0aGVhZGVyLnJlYWRVSW50OCgrK29mZnNldCkgKiAyICoqIDI0XG5cdFx0XHRcdFx0XHQrIGhlYWRlci5yZWFkVUludDgoKytvZmZzZXQpICogMiAqKiAxNlxuXHRcdFx0XHRcdFx0KyBoZWFkZXIucmVhZFVJbnQ4KCsrb2Zmc2V0KSAqIDIgKiogOFxuXHRcdFx0XHRcdFx0KyBoZWFkZXIucmVhZFVJbnQ4KCsrb2Zmc2V0KVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zdGF0ZS5zdGF0ZSA9IFJlYWRTdGF0ZS5SZWFkQm9keTtcblx0XHRcdFx0dGhpcy5fc3RhdGUucmVhZExlbiA9IGxlbjtcblx0XHRcdFx0dGhpcy5fc3RhdGUubWFzayA9IG1hc2s7XG5cblx0XHRcdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLldlYlNvY2tldE5vZGVTb2NrZXRQZWVrZWRIZWFkZXIsIHsgYm9keVNpemU6IHRoaXMuX3N0YXRlLnJlYWRMZW4sIGNvbXByZXNzZWQ6IHRoaXMuX3N0YXRlLmNvbXByZXNzZWQsIGZpbjogdGhpcy5fc3RhdGUuZmluLCBtYXNrOiB0aGlzLl9zdGF0ZS5tYXNrLCBvcGNvZGU6IHRoaXMuX3N0YXRlLm9wY29kZSB9KTtcblxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9zdGF0ZS5zdGF0ZSA9PT0gUmVhZFN0YXRlLlJlYWRCb2R5KSB7XG5cdFx0XHRcdC8vIHJlYWQgYm9keVxuXG5cdFx0XHRcdGNvbnN0IGJvZHkgPSB0aGlzLl9pbmNvbWluZ0RhdGEucmVhZCh0aGlzLl9zdGF0ZS5yZWFkTGVuKTtcblx0XHRcdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLldlYlNvY2tldE5vZGVTb2NrZXRSZWFkRGF0YSwgYm9keSk7XG5cblx0XHRcdFx0dW5tYXNrKGJvZHksIHRoaXMuX3N0YXRlLm1hc2spO1xuXHRcdFx0XHR0aGlzLnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuV2ViU29ja2V0Tm9kZVNvY2tldFVubWFza2VkRGF0YSwgYm9keSk7XG5cblx0XHRcdFx0dGhpcy5fc3RhdGUuc3RhdGUgPSBSZWFkU3RhdGUuUGVla0hlYWRlcjtcblx0XHRcdFx0dGhpcy5fc3RhdGUucmVhZExlbiA9IENvbnN0YW50cy5NaW5IZWFkZXJCeXRlU2l6ZTtcblx0XHRcdFx0dGhpcy5fc3RhdGUubWFzayA9IDA7XG5cblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlLm9wY29kZSA8PSAweDAyIC8qIENvbnRpbnVhdGlvbiBmcmFtZSBvciBUZXh0IGZyYW1lIG9yIGJpbmFyeSBmcmFtZSAqLykge1xuXHRcdFx0XHRcdHRoaXMuX2Zsb3dNYW5hZ2VyLmFjY2VwdEZyYW1lKGJvZHksIHRoaXMuX3N0YXRlLmNvbXByZXNzZWQsICEhdGhpcy5fc3RhdGUuZmluKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9zdGF0ZS5vcGNvZGUgPT09IDB4MDkgLyogUGluZyBmcmFtZSAqLykge1xuXHRcdFx0XHRcdC8vIFBpbmcgZnJhbWVzIGNvdWxkIGJlIHNlbmQgYnkgc29tZSBicm93c2VycyBlLmcuIEZpcmVmb3hcblx0XHRcdFx0XHR0aGlzLl9mbG93TWFuYWdlci53cml0ZU1lc3NhZ2UoYm9keSwgeyBjb21wcmVzc2VkOiBmYWxzZSwgb3Bjb2RlOiAweDBBIC8qIFBvbmcgZnJhbWUgKi8gfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZHJhaW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLldlYlNvY2tldE5vZGVTb2NrZXREcmFpbkJlZ2luKTtcblx0XHRpZiAodGhpcy5fZmxvd01hbmFnZXIuaXNQcm9jZXNzaW5nV3JpdGVRdWV1ZSgpKSB7XG5cdFx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UodGhpcy5fZmxvd01hbmFnZXIub25EaWRGaW5pc2hQcm9jZXNzaW5nV3JpdGVRdWV1ZSk7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuc29ja2V0LmRyYWluKCk7XG5cdFx0dGhpcy50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLldlYlNvY2tldE5vZGVTb2NrZXREcmFpbkVuZCk7XG5cdH1cbn1cblxuY2xhc3MgV2ViU29ja2V0Rmxvd01hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXJyb3I+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25FcnJvciA9IHRoaXMuX29uRXJyb3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfemxpYkluZmxhdGVTdHJlYW06IFpsaWJJbmZsYXRlU3RyZWFtIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfemxpYkRlZmxhdGVTdHJlYW06IFpsaWJEZWZsYXRlU3RyZWFtIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfd3JpdGVRdWV1ZTogeyBkYXRhOiBWU0J1ZmZlcjsgb3B0aW9uczogRnJhbWVPcHRpb25zIH1bXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWFkUXVldWU6IHsgZGF0YTogVlNCdWZmZXI7IGlzQ29tcHJlc3NlZDogYm9vbGVhbjsgaXNMYXN0RnJhbWVPZk1lc3NhZ2U6IGJvb2xlYW4gfVtdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGaW5pc2hQcm9jZXNzaW5nUmVhZFF1ZXVlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEZpbmlzaFByb2Nlc3NpbmdSZWFkUXVldWUgPSB0aGlzLl9vbkRpZEZpbmlzaFByb2Nlc3NpbmdSZWFkUXVldWUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGaW5pc2hQcm9jZXNzaW5nV3JpdGVRdWV1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRGaW5pc2hQcm9jZXNzaW5nV3JpdGVRdWV1ZSA9IHRoaXMuX29uRGlkRmluaXNoUHJvY2Vzc2luZ1dyaXRlUXVldWUuZXZlbnQ7XG5cblx0cHVibGljIGdldCBwZXJtZXNzYWdlRGVmbGF0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gQm9vbGVhbih0aGlzLl96bGliSW5mbGF0ZVN0cmVhbSAmJiB0aGlzLl96bGliRGVmbGF0ZVN0cmVhbSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHJlY29yZGVkSW5mbGF0ZUJ5dGVzKCk6IFZTQnVmZmVyIHtcblx0XHRpZiAodGhpcy5femxpYkluZmxhdGVTdHJlYW0pIHtcblx0XHRcdHJldHVybiB0aGlzLl96bGliSW5mbGF0ZVN0cmVhbS5yZWNvcmRlZEluZmxhdGVCeXRlcztcblx0XHR9XG5cdFx0cmV0dXJuIFZTQnVmZmVyLmFsbG9jKDApO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdHJhY2VyOiBJU29ja2V0VHJhY2VyLFxuXHRcdHBlcm1lc3NhZ2VEZWZsYXRlOiBib29sZWFuLFxuXHRcdGluZmxhdGVCeXRlczogVlNCdWZmZXIgfCBudWxsLFxuXHRcdHJlY29yZEluZmxhdGVCeXRlczogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkRhdGE6IEVtaXR0ZXI8VlNCdWZmZXI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dyaXRlRm46IChkYXRhOiBWU0J1ZmZlciwgb3B0aW9uczogRnJhbWVPcHRpb25zKSA9PiB2b2lkXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0aWYgKHBlcm1lc3NhZ2VEZWZsYXRlKSB7XG5cdFx0XHQvLyBTZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzc2OTIjcGFnZS0xNlxuXHRcdFx0Ly8gVG8gc2ltcGxpZnkgb3VyIGxvZ2ljLCB3ZSBkb24ndCBuZWdvdGlhdGUgdGhlIHdpbmRvdyBzaXplXG5cdFx0XHQvLyBhbmQgc2ltcGx5IGRlZGljYXRlICgyXjE1KSAvIDMya2IgcGVyIHdlYiBzb2NrZXRcblx0XHRcdHRoaXMuX3psaWJJbmZsYXRlU3RyZWFtID0gdGhpcy5fcmVnaXN0ZXIobmV3IFpsaWJJbmZsYXRlU3RyZWFtKHRoaXMuX3RyYWNlciwgcmVjb3JkSW5mbGF0ZUJ5dGVzLCBpbmZsYXRlQnl0ZXMsIHsgd2luZG93Qml0czogMTUgfSkpO1xuXHRcdFx0dGhpcy5femxpYkRlZmxhdGVTdHJlYW0gPSB0aGlzLl9yZWdpc3RlcihuZXcgWmxpYkRlZmxhdGVTdHJlYW0odGhpcy5fdHJhY2VyLCB7IHdpbmRvd0JpdHM6IDE1IH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3psaWJJbmZsYXRlU3RyZWFtLm9uRXJyb3IoKGVycikgPT4gdGhpcy5fb25FcnJvci5maXJlKGVycikpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3psaWJEZWZsYXRlU3RyZWFtLm9uRXJyb3IoKGVycikgPT4gdGhpcy5fb25FcnJvci5maXJlKGVycikpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5femxpYkluZmxhdGVTdHJlYW0gPSBudWxsO1xuXHRcdFx0dGhpcy5femxpYkRlZmxhdGVTdHJlYW0gPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyB3cml0ZU1lc3NhZ2UoZGF0YTogVlNCdWZmZXIsIG9wdGlvbnM6IEZyYW1lT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX3dyaXRlUXVldWUucHVzaCh7IGRhdGEsIG9wdGlvbnMgfSk7XG5cdFx0dGhpcy5fcHJvY2Vzc1dyaXRlUXVldWUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzUHJvY2Vzc2luZ1dyaXRlUXVldWUgPSBmYWxzZTtcblx0cHJpdmF0ZSBhc3luYyBfcHJvY2Vzc1dyaXRlUXVldWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX2lzUHJvY2Vzc2luZ1dyaXRlUXVldWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faXNQcm9jZXNzaW5nV3JpdGVRdWV1ZSA9IHRydWU7XG5cdFx0d2hpbGUgKHRoaXMuX3dyaXRlUXVldWUubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgeyBkYXRhLCBvcHRpb25zIH0gPSB0aGlzLl93cml0ZVF1ZXVlLnNoaWZ0KCkhO1xuXHRcdFx0aWYgKHRoaXMuX3psaWJEZWZsYXRlU3RyZWFtICYmIG9wdGlvbnMuY29tcHJlc3NlZCkge1xuXHRcdFx0XHRjb25zdCBjb21wcmVzc2VkRGF0YSA9IGF3YWl0IHRoaXMuX2RlZmxhdGVNZXNzYWdlKHRoaXMuX3psaWJEZWZsYXRlU3RyZWFtLCBkYXRhKTtcblx0XHRcdFx0dGhpcy5fd3JpdGVGbihjb21wcmVzc2VkRGF0YSwgb3B0aW9ucyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl93cml0ZUZuKGRhdGEsIHsgLi4ub3B0aW9ucywgY29tcHJlc3NlZDogZmFsc2UgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2lzUHJvY2Vzc2luZ1dyaXRlUXVldWUgPSBmYWxzZTtcblx0XHR0aGlzLl9vbkRpZEZpbmlzaFByb2Nlc3NpbmdXcml0ZVF1ZXVlLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBpc1Byb2Nlc3NpbmdXcml0ZVF1ZXVlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5faXNQcm9jZXNzaW5nV3JpdGVRdWV1ZSk7XG5cdH1cblxuXHQvKipcblx0ICogU3Vic2VxdWVudCBjYWxscyBzaG91bGQgd2FpdCBmb3IgdGhlIHByZXZpb3VzIGBfZGVmbGF0ZUJ1ZmZlcmAgY2FsbCB0byBjb21wbGV0ZS5cblx0ICovXG5cdHByaXZhdGUgX2RlZmxhdGVNZXNzYWdlKHpsaWJEZWZsYXRlU3RyZWFtOiBabGliRGVmbGF0ZVN0cmVhbSwgYnVmZmVyOiBWU0J1ZmZlcik6IFByb21pc2U8VlNCdWZmZXI+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8VlNCdWZmZXI+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHpsaWJEZWZsYXRlU3RyZWFtLndyaXRlKGJ1ZmZlcik7XG5cdFx0XHR6bGliRGVmbGF0ZVN0cmVhbS5mbHVzaChkYXRhID0+IHJlc29sdmUoZGF0YSkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdEZyYW1lKGRhdGE6IFZTQnVmZmVyLCBpc0NvbXByZXNzZWQ6IGJvb2xlYW4sIGlzTGFzdEZyYW1lT2ZNZXNzYWdlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVhZFF1ZXVlLnB1c2goeyBkYXRhLCBpc0NvbXByZXNzZWQsIGlzTGFzdEZyYW1lT2ZNZXNzYWdlIH0pO1xuXHRcdHRoaXMuX3Byb2Nlc3NSZWFkUXVldWUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzUHJvY2Vzc2luZ1JlYWRRdWV1ZSA9IGZhbHNlO1xuXHRwcml2YXRlIGFzeW5jIF9wcm9jZXNzUmVhZFF1ZXVlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9pc1Byb2Nlc3NpbmdSZWFkUXVldWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faXNQcm9jZXNzaW5nUmVhZFF1ZXVlID0gdHJ1ZTtcblx0XHR3aGlsZSAodGhpcy5fcmVhZFF1ZXVlLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IGZyYW1lSW5mbyA9IHRoaXMuX3JlYWRRdWV1ZS5zaGlmdCgpITtcblx0XHRcdGlmICh0aGlzLl96bGliSW5mbGF0ZVN0cmVhbSAmJiBmcmFtZUluZm8uaXNDb21wcmVzc2VkKSB7XG5cdFx0XHRcdC8vIFNlZSBodHRwczovL2RhdGF0cmFja2VyLmlldGYub3JnL2RvYy9odG1sL3JmYzc2OTIjc2VjdGlvbi05LjJcblx0XHRcdFx0Ly8gRXZlbiBpZiBwZXJtZXNzYWdlRGVmbGF0ZSBpcyBuZWdvdGlhdGVkLCBpdCBpcyBwb3NzaWJsZVxuXHRcdFx0XHQvLyB0aGF0IHRoZSBvdGhlciBzaWRlIG1pZ2h0IGRlY2lkZSB0byBzZW5kIHVuY29tcHJlc3NlZCBtZXNzYWdlc1xuXHRcdFx0XHQvLyBTbyBvbmx5IGRlY29tcHJlc3MgbWVzc2FnZXMgdGhhdCBoYXZlIHRoZSBSU1YgMSBiaXQgc2V0XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLl9pbmZsYXRlRnJhbWUodGhpcy5femxpYkluZmxhdGVTdHJlYW0sIGZyYW1lSW5mby5kYXRhLCBmcmFtZUluZm8uaXNMYXN0RnJhbWVPZk1lc3NhZ2UpO1xuXHRcdFx0XHR0aGlzLl9vbkRhdGEuZmlyZShkYXRhKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX29uRGF0YS5maXJlKGZyYW1lSW5mby5kYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5faXNQcm9jZXNzaW5nUmVhZFF1ZXVlID0gZmFsc2U7XG5cdFx0dGhpcy5fb25EaWRGaW5pc2hQcm9jZXNzaW5nUmVhZFF1ZXVlLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBpc1Byb2Nlc3NpbmdSZWFkUXVldWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICh0aGlzLl9pc1Byb2Nlc3NpbmdSZWFkUXVldWUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN1YnNlcXVlbnQgY2FsbHMgc2hvdWxkIHdhaXQgZm9yIHRoZSBwcmV2aW91cyBgdHJhbnNmb3JtUmVhZGAgY2FsbCB0byBjb21wbGV0ZS5cblx0ICovXG5cdHByaXZhdGUgX2luZmxhdGVGcmFtZSh6bGliSW5mbGF0ZVN0cmVhbTogWmxpYkluZmxhdGVTdHJlYW0sIGJ1ZmZlcjogVlNCdWZmZXIsIGlzTGFzdEZyYW1lT2ZNZXNzYWdlOiBib29sZWFuKTogUHJvbWlzZTxWU0J1ZmZlcj4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxWU0J1ZmZlcj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3NjkyI3NlY3Rpb24tNy4yLjJcblx0XHRcdHpsaWJJbmZsYXRlU3RyZWFtLndyaXRlKGJ1ZmZlcik7XG5cdFx0XHRpZiAoaXNMYXN0RnJhbWVPZk1lc3NhZ2UpIHtcblx0XHRcdFx0emxpYkluZmxhdGVTdHJlYW0ud3JpdGUoVlNCdWZmZXIuZnJvbUJ5dGVBcnJheShbMHgwMCwgMHgwMCwgMHhmZiwgMHhmZl0pKTtcblx0XHRcdH1cblx0XHRcdHpsaWJJbmZsYXRlU3RyZWFtLmZsdXNoKGRhdGEgPT4gcmVzb2x2ZShkYXRhKSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgWmxpYkluZmxhdGVTdHJlYW0gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXJyb3I+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25FcnJvciA9IHRoaXMuX29uRXJyb3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfemxpYkluZmxhdGU6IEluZmxhdGVSYXc7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlY29yZGVkSW5mbGF0ZUJ5dGVzOiBWU0J1ZmZlcltdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlbmRpbmdJbmZsYXRlRGF0YTogVlNCdWZmZXJbXSA9IFtdO1xuXG5cdHB1YmxpYyBnZXQgcmVjb3JkZWRJbmZsYXRlQnl0ZXMoKTogVlNCdWZmZXIge1xuXHRcdGlmICh0aGlzLl9yZWNvcmRJbmZsYXRlQnl0ZXMpIHtcblx0XHRcdHJldHVybiBWU0J1ZmZlci5jb25jYXQodGhpcy5fcmVjb3JkZWRJbmZsYXRlQnl0ZXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gVlNCdWZmZXIuYWxsb2MoMCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90cmFjZXI6IElTb2NrZXRUcmFjZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVjb3JkSW5mbGF0ZUJ5dGVzOiBib29sZWFuLFxuXHRcdGluZmxhdGVCeXRlczogVlNCdWZmZXIgfCBudWxsLFxuXHRcdG9wdGlvbnM6IFpsaWJPcHRpb25zXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5femxpYkluZmxhdGUgPSBjcmVhdGVJbmZsYXRlUmF3KG9wdGlvbnMpO1xuXHRcdHRoaXMuX3psaWJJbmZsYXRlLm9uKCdlcnJvcicsIChlcnIpID0+IHtcblx0XHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJJbmZsYXRlRXJyb3IsIHsgbWVzc2FnZTogZXJyPy5tZXNzYWdlLCBjb2RlOiAoPGFueT5lcnIpPy5jb2RlIH0pO1xuXHRcdFx0dGhpcy5fb25FcnJvci5maXJlKGVycik7XG5cdFx0fSk7XG5cdFx0dGhpcy5femxpYkluZmxhdGUub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XG5cdFx0XHR0aGlzLl90cmFjZXIudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS56bGliSW5mbGF0ZURhdGEsIGRhdGEpO1xuXHRcdFx0dGhpcy5fcGVuZGluZ0luZmxhdGVEYXRhLnB1c2goVlNCdWZmZXIud3JhcChkYXRhKSk7XG5cdFx0fSk7XG5cdFx0aWYgKGluZmxhdGVCeXRlcykge1xuXHRcdFx0dGhpcy5fdHJhY2VyLnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuemxpYkluZmxhdGVJbml0aWFsV3JpdGUsIGluZmxhdGVCeXRlcy5idWZmZXIpO1xuXHRcdFx0dGhpcy5femxpYkluZmxhdGUud3JpdGUoaW5mbGF0ZUJ5dGVzLmJ1ZmZlcik7XG5cdFx0XHR0aGlzLl96bGliSW5mbGF0ZS5mbHVzaCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJJbmZsYXRlSW5pdGlhbEZsdXNoRmlyZWQpO1xuXHRcdFx0XHR0aGlzLl9wZW5kaW5nSW5mbGF0ZURhdGEubGVuZ3RoID0gMDtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyB3cml0ZShidWZmZXI6IFZTQnVmZmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3JlY29yZEluZmxhdGVCeXRlcykge1xuXHRcdFx0dGhpcy5fcmVjb3JkZWRJbmZsYXRlQnl0ZXMucHVzaChidWZmZXIuY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJJbmZsYXRlV3JpdGUsIGJ1ZmZlcik7XG5cdFx0dGhpcy5femxpYkluZmxhdGUud3JpdGUoYnVmZmVyLmJ1ZmZlcik7XG5cdH1cblxuXHRwdWJsaWMgZmx1c2goY2FsbGJhY2s6IChkYXRhOiBWU0J1ZmZlcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRoaXMuX3psaWJJbmZsYXRlLmZsdXNoKCgpID0+IHtcblx0XHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJJbmZsYXRlRmx1c2hGaXJlZCk7XG5cdFx0XHRjb25zdCBkYXRhID0gVlNCdWZmZXIuY29uY2F0KHRoaXMuX3BlbmRpbmdJbmZsYXRlRGF0YSk7XG5cdFx0XHR0aGlzLl9wZW5kaW5nSW5mbGF0ZURhdGEubGVuZ3RoID0gMDtcblx0XHRcdGNhbGxiYWNrKGRhdGEpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFpsaWJEZWZsYXRlU3RyZWFtIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25FcnJvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEVycm9yPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRXJyb3IgPSB0aGlzLl9vbkVycm9yLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3psaWJEZWZsYXRlOiBEZWZsYXRlUmF3O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nRGVmbGF0ZURhdGE6IFZTQnVmZmVyW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90cmFjZXI6IElTb2NrZXRUcmFjZXIsXG5cdFx0b3B0aW9uczogWmxpYk9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3psaWJEZWZsYXRlID0gY3JlYXRlRGVmbGF0ZVJhdyh7XG5cdFx0XHR3aW5kb3dCaXRzOiAxNVxuXHRcdH0pO1xuXHRcdHRoaXMuX3psaWJEZWZsYXRlLm9uKCdlcnJvcicsIChlcnIpID0+IHtcblx0XHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJEZWZsYXRlRXJyb3IsIHsgbWVzc2FnZTogZXJyPy5tZXNzYWdlLCBjb2RlOiAoPGFueT5lcnIpPy5jb2RlIH0pO1xuXHRcdFx0dGhpcy5fb25FcnJvci5maXJlKGVycik7XG5cdFx0fSk7XG5cdFx0dGhpcy5femxpYkRlZmxhdGUub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XG5cdFx0XHR0aGlzLl90cmFjZXIudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS56bGliRGVmbGF0ZURhdGEsIGRhdGEpO1xuXHRcdFx0dGhpcy5fcGVuZGluZ0RlZmxhdGVEYXRhLnB1c2goVlNCdWZmZXIud3JhcChkYXRhKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgd3JpdGUoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdHRoaXMuX3RyYWNlci50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLnpsaWJEZWZsYXRlV3JpdGUsIGJ1ZmZlci5idWZmZXIpO1xuXHRcdHRoaXMuX3psaWJEZWZsYXRlLndyaXRlKDxCdWZmZXI+YnVmZmVyLmJ1ZmZlcik7XG5cdH1cblxuXHRwdWJsaWMgZmx1c2goY2FsbGJhY2s6IChkYXRhOiBWU0J1ZmZlcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdC8vIFNlZSBodHRwczovL3psaWIubmV0L21hbnVhbC5odG1sI0NvbnN0YW50c1xuXHRcdHRoaXMuX3psaWJEZWZsYXRlLmZsdXNoKC8qWl9TWU5DX0ZMVVNIKi8yLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl90cmFjZXIudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS56bGliRGVmbGF0ZUZsdXNoRmlyZWQpO1xuXG5cdFx0XHRsZXQgZGF0YSA9IFZTQnVmZmVyLmNvbmNhdCh0aGlzLl9wZW5kaW5nRGVmbGF0ZURhdGEpO1xuXHRcdFx0dGhpcy5fcGVuZGluZ0RlZmxhdGVEYXRhLmxlbmd0aCA9IDA7XG5cblx0XHRcdC8vIFNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjNzY5MiNzZWN0aW9uLTcuMi4xXG5cdFx0XHRkYXRhID0gZGF0YS5zbGljZSgwLCBkYXRhLmJ5dGVMZW5ndGggLSA0KTtcblxuXHRcdFx0Y2FsbGJhY2soZGF0YSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdW5tYXNrKGJ1ZmZlcjogVlNCdWZmZXIsIG1hc2s6IG51bWJlcik6IHZvaWQge1xuXHRpZiAobWFzayA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBjbnQgPSBidWZmZXIuYnl0ZUxlbmd0aCA+Pj4gMjtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjbnQ7IGkrKykge1xuXHRcdGNvbnN0IHYgPSBidWZmZXIucmVhZFVJbnQzMkJFKGkgKiA0KTtcblx0XHRidWZmZXIud3JpdGVVSW50MzJCRSh2IF4gbWFzaywgaSAqIDQpO1xuXHR9XG5cdGNvbnN0IG9mZnNldCA9IGNudCAqIDQ7XG5cdGNvbnN0IGJ5dGVzTGVmdCA9IGJ1ZmZlci5ieXRlTGVuZ3RoIC0gb2Zmc2V0O1xuXHRjb25zdCBtMyA9IChtYXNrID4+PiAyNCkgJiAwYjExMTExMTExO1xuXHRjb25zdCBtMiA9IChtYXNrID4+PiAxNikgJiAwYjExMTExMTExO1xuXHRjb25zdCBtMSA9IChtYXNrID4+PiA4KSAmIDBiMTExMTExMTE7XG5cdGlmIChieXRlc0xlZnQgPj0gMSkge1xuXHRcdGJ1ZmZlci53cml0ZVVJbnQ4KGJ1ZmZlci5yZWFkVUludDgob2Zmc2V0KSBeIG0zLCBvZmZzZXQpO1xuXHR9XG5cdGlmIChieXRlc0xlZnQgPj0gMikge1xuXHRcdGJ1ZmZlci53cml0ZVVJbnQ4KGJ1ZmZlci5yZWFkVUludDgob2Zmc2V0ICsgMSkgXiBtMiwgb2Zmc2V0ICsgMSk7XG5cdH1cblx0aWYgKGJ5dGVzTGVmdCA+PSAzKSB7XG5cdFx0YnVmZmVyLndyaXRlVUludDgoYnVmZmVyLnJlYWRVSW50OChvZmZzZXQgKyAyKSBeIG0xLCBvZmZzZXQgKyAyKTtcblx0fVxufVxuXG4vLyBSZWFkIHRoaXMgYmVmb3JlIHRoZXJlJ3MgYW55IGNoYW5jZSBpdCBpcyBvdmVyd3JpdHRlblxuLy8gUmVsYXRlZCB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzA2MjRcbmV4cG9ydCBjb25zdCBYREdfUlVOVElNRV9ESVIgPSA8c3RyaW5nIHwgdW5kZWZpbmVkPnByb2Nlc3MuZW52WydYREdfUlVOVElNRV9ESVInXTtcblxuY29uc3Qgc2FmZUlwY1BhdGhMZW5ndGhzOiB7IFtwbGF0Zm9ybTogbnVtYmVyXTogbnVtYmVyIH0gPSB7XG5cdFtQbGF0Zm9ybS5MaW51eF06IDEwNyxcblx0W1BsYXRmb3JtLk1hY106IDEwM1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJhbmRvbUlQQ0hhbmRsZSgpOiBzdHJpbmcge1xuXHRjb25zdCByYW5kb21TdWZmaXggPSBnZW5lcmF0ZVV1aWQoKTtcblxuXHQvLyBXaW5kb3dzOiB1c2UgbmFtZWQgcGlwZVxuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiBgXFxcXFxcXFwuXFxcXHBpcGVcXFxcdnNjb2RlLWlwYy0ke3JhbmRvbVN1ZmZpeH0tc29ja2A7XG5cdH1cblxuXHQvLyBNYWMgJiBVbml4OiBVc2Ugc29ja2V0IGZpbGVcblx0Ly8gVW5peDogUHJlZmVyIFhER19SVU5USU1FX0RJUiBvdmVyIHVzZXIgZGF0YSBwYXRoXG5cdGNvbnN0IGJhc2VQYXRoID0gcHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicgJiYgWERHX1JVTlRJTUVfRElSID8gWERHX1JVTlRJTUVfRElSIDogdG1wZGlyKCk7XG5cdGNvbnN0IHJlc3VsdCA9IGpvaW4oYmFzZVBhdGgsIGB2c2NvZGUtaXBjLSR7cmFuZG9tU3VmZml4fS5zb2NrYCk7XG5cblx0Ly8gVmFsaWRhdGUgbGVuZ3RoXG5cdHZhbGlkYXRlSVBDSGFuZGxlTGVuZ3RoKHJlc3VsdCk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0YXRpY0lQQ0hhbmRsZShkaXJlY3RvcnlQYXRoOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qgc2NvcGUgPSBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoZGlyZWN0b3J5UGF0aCkuZGlnZXN0KCdoZXgnKTtcblx0Y29uc3Qgc2NvcGVGb3JTb2NrZXQgPSBzY29wZS5zdWJzdHIoMCwgOCk7XG5cblx0Ly8gV2luZG93czogdXNlIG5hbWVkIHBpcGVcblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcblx0XHRyZXR1cm4gYFxcXFxcXFxcLlxcXFxwaXBlXFxcXCR7c2NvcGVGb3JTb2NrZXR9LSR7dmVyc2lvbn0tJHt0eXBlfS1zb2NrYDtcblx0fVxuXG5cdC8vIE1hYyAmIFVuaXg6IFVzZSBzb2NrZXQgZmlsZVxuXHQvLyBVbml4OiBQcmVmZXIgWERHX1JVTlRJTUVfRElSIG92ZXIgdXNlciBkYXRhIHBhdGgsIHVubGVzcyBwb3J0YWJsZVxuXHQvLyBUcmltIHRoZSB2ZXJzaW9uIGFuZCB0eXBlIHZhbHVlcyBmb3IgdGhlIHNvY2tldCB0byBwcmV2ZW50IHRvbyBsYXJnZVxuXHQvLyBmaWxlIG5hbWVzIGNhdXNpbmcgaXNzdWVzOiBodHRwczovL3VuaXguc3RhY2tleGNoYW5nZS5jb20vcS8zNjcwMDhcblxuXHRjb25zdCB2ZXJzaW9uRm9yU29ja2V0ID0gdmVyc2lvbi5zdWJzdHIoMCwgNCk7XG5cdGNvbnN0IHR5cGVGb3JTb2NrZXQgPSB0eXBlLnN1YnN0cigwLCA2KTtcblxuXHRsZXQgcmVzdWx0OiBzdHJpbmc7XG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJyAmJiBYREdfUlVOVElNRV9ESVIgJiYgIXByb2Nlc3MuZW52WydWU0NPREVfUE9SVEFCTEUnXSkge1xuXHRcdHJlc3VsdCA9IGpvaW4oWERHX1JVTlRJTUVfRElSLCBgdnNjb2RlLSR7c2NvcGVGb3JTb2NrZXR9LSR7dmVyc2lvbkZvclNvY2tldH0tJHt0eXBlRm9yU29ja2V0fS5zb2NrYCk7XG5cdH0gZWxzZSB7XG5cdFx0cmVzdWx0ID0gam9pbihkaXJlY3RvcnlQYXRoLCBgJHt2ZXJzaW9uRm9yU29ja2V0fS0ke3R5cGVGb3JTb2NrZXR9LnNvY2tgKTtcblx0fVxuXG5cdC8vIFZhbGlkYXRlIGxlbmd0aFxuXHR2YWxpZGF0ZUlQQ0hhbmRsZUxlbmd0aChyZXN1bHQpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlSVBDSGFuZGxlTGVuZ3RoKGhhbmRsZTogc3RyaW5nKTogdm9pZCB7XG5cdGNvbnN0IGxpbWl0ID0gc2FmZUlwY1BhdGhMZW5ndGhzW3BsYXRmb3JtXTtcblx0aWYgKHR5cGVvZiBsaW1pdCA9PT0gJ251bWJlcicgJiYgaGFuZGxlLmxlbmd0aCA+PSBsaW1pdCkge1xuXHRcdC8vIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvbmV0Lmh0bWwjbmV0X2lkZW50aWZ5aW5nX3BhdGhzX2Zvcl9pcGNfY29ubmVjdGlvbnNcblx0XHRjb25zb2xlLndhcm4oYFdBUk5JTkc6IElQQyBoYW5kbGUgXCIke2hhbmRsZX1cIiBpcyBsb25nZXIgdGhhbiAke2xpbWl0fSBjaGFycywgdHJ5IGEgc2hvcnRlciAtLXVzZXItZGF0YS1kaXJgKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VydmVyIGV4dGVuZHMgSVBDU2VydmVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyB0b0NsaWVudENvbm5lY3Rpb25FdmVudChzZXJ2ZXI6IE5ldFNlcnZlcik6IEV2ZW50PENsaWVudENvbm5lY3Rpb25FdmVudD4ge1xuXHRcdGNvbnN0IG9uQ29ubmVjdGlvbiA9IEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyPFNvY2tldD4oc2VydmVyLCAnY29ubmVjdGlvbicpO1xuXG5cdFx0cmV0dXJuIEV2ZW50Lm1hcChvbkNvbm5lY3Rpb24sIHNvY2tldCA9PiAoe1xuXHRcdFx0cHJvdG9jb2w6IG5ldyBQcm90b2NvbChuZXcgTm9kZVNvY2tldChzb2NrZXQsICdpcGMtc2VydmVyLWNvbm5lY3Rpb24nKSksXG5cdFx0XHRvbkRpZENsaWVudERpc2Nvbm5lY3Q6IEV2ZW50Lm9uY2UoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXI8dm9pZD4oc29ja2V0LCAnY2xvc2UnKSlcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHNlcnZlcjogTmV0U2VydmVyIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihzZXJ2ZXI6IE5ldFNlcnZlcikge1xuXHRcdHN1cGVyKFNlcnZlci50b0NsaWVudENvbm5lY3Rpb25FdmVudChzZXJ2ZXIpKTtcblx0XHR0aGlzLnNlcnZlciA9IHNlcnZlcjtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdGlmICh0aGlzLnNlcnZlcikge1xuXHRcdFx0dGhpcy5zZXJ2ZXIuY2xvc2UoKTtcblx0XHRcdHRoaXMuc2VydmVyID0gbnVsbDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcnZlKHBvcnQ6IG51bWJlcik6IFByb21pc2U8U2VydmVyPjtcbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZShuYW1lZFBpcGU6IHN0cmluZyk6IFByb21pc2U8U2VydmVyPjtcbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZShob29rOiBhbnkpOiBQcm9taXNlPFNlcnZlcj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8U2VydmVyPigoYywgZSkgPT4ge1xuXHRcdGNvbnN0IHNlcnZlciA9IGNyZWF0ZVNlcnZlcigpO1xuXG5cdFx0c2VydmVyLm9uKCdlcnJvcicsIGUpO1xuXHRcdHNlcnZlci5saXN0ZW4oaG9vaywgKCkgPT4ge1xuXHRcdFx0c2VydmVyLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIGUpO1xuXHRcdFx0YyhuZXcgU2VydmVyKHNlcnZlcikpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3Qob3B0aW9uczogeyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9LCBjbGllbnRJZDogc3RyaW5nKTogUHJvbWlzZTxDbGllbnQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3QocG9ydDogbnVtYmVyLCBjbGllbnRJZDogc3RyaW5nKTogUHJvbWlzZTxDbGllbnQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3QobmFtZWRQaXBlOiBzdHJpbmcsIGNsaWVudElkOiBzdHJpbmcpOiBQcm9taXNlPENsaWVudD47XG5leHBvcnQgZnVuY3Rpb24gY29ubmVjdChob29rOiBhbnksIGNsaWVudElkOiBzdHJpbmcpOiBQcm9taXNlPENsaWVudD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8Q2xpZW50PigoYywgZSkgPT4ge1xuXHRcdGNvbnN0IHNvY2tldCA9IGNyZWF0ZUNvbm5lY3Rpb24oaG9vaywgKCkgPT4ge1xuXHRcdFx0c29ja2V0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIGUpO1xuXHRcdFx0YyhDbGllbnQuZnJvbVNvY2tldChuZXcgTm9kZVNvY2tldChzb2NrZXQsIGBpcGMtY2xpZW50JHtjbGllbnRJZH1gKSwgY2xpZW50SWQpKTtcblx0XHR9KTtcblxuXHRcdHNvY2tldC5vbmNlKCdlcnJvcicsIGUpO1xuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQXNDLGNBQWMsd0JBQXdCO0FBQzVFLFNBQVMsY0FBYztBQUN2QixTQUFTLGtCQUF1RCx3QkFBd0I7QUFDeEYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBZ0MsaUJBQWlCO0FBQ2pELFNBQVMsYUFBYSxR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SSxhQUFhLE9BQU87QUFBQSxFQUN6RTtBQUdBLDBCQUF3QixNQUFNO0FBRTlCLFNBQU87QUFDUjtBQUVBLFNBQVMsd0JBQXdCLFFBQXNCO0FBQ3RELFFBQU0sUUFBUSxtQkFBbUIsUUFBUTtBQUN6QyxNQUFJLE9BQU8sVUFBVSxZQUFZLE9BQU8sVUFBVSxPQUFPO0FBRXhELFlBQVEsS0FBSyx3QkFBd0IsTUFBTSxvQkFBb0IsS0FBSyx1Q0FBdUM7QUFBQSxFQUM1RztBQUNEO0FBRU8sTUFBTSxlQUFlLFVBQVU7QUFBQSxFQUVyQyxPQUFlLHdCQUF3QixRQUFpRDtBQUN2RixVQUFNLGVBQWUsTUFBTSxxQkFBNkIsUUFBUSxZQUFZO0FBRTVFLFdBQU8sTUFBTSxJQUFJLGNBQWMsYUFBVztBQUFBLE1BQ3pDLFVBQVUsSUFBSSxTQUFTLElBQUksV0FBVyxRQUFRLHVCQUF1QixDQUFDO0FBQUEsTUFDdEUsdUJBQXVCLE1BQU0sS0FBSyxNQUFNLHFCQUEyQixRQUFRLE9BQU8sQ0FBQztBQUFBLElBQ3BGLEVBQUU7QUFBQSxFQUNIO0FBQUEsRUFJQSxZQUFZLFFBQW1CO0FBQzlCLFVBQU0sT0FBTyx3QkFBd0IsTUFBTSxDQUFDO0FBQzVDLFNBQUssU0FBUztBQUFBLEVBQ2Y7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFVBQU0sUUFBUTtBQUNkLFFBQUksS0FBSyxRQUFRO0FBQ2hCLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFdBQUssU0FBUztBQUFBLElBQ2Y7QUFBQSxFQUNEO0FBQ0Q7QUFJTyxTQUFTLE1BQU0sTUFBNEI7QUFDakQsU0FBTyxJQUFJLFFBQWdCLENBQUMsR0FBRyxNQUFNO0FBQ3BDLFVBQU0sU0FBUyxhQUFhO0FBRTVCLFdBQU8sR0FBRyxTQUFTLENBQUM7QUFDcEIsV0FBTyxPQUFPLE1BQU0sTUFBTTtBQUN6QixhQUFPLGVBQWUsU0FBUyxDQUFDO0FBQ2hDLFFBQUUsSUFBSSxPQUFPLE1BQU0sQ0FBQztBQUFBLElBQ3JCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRjtBQUtPLFNBQVMsUUFBUSxNQUFXLFVBQW1DO0FBQ3JFLFNBQU8sSUFBSSxRQUFnQixDQUFDLEdBQUcsTUFBTTtBQUNwQyxVQUFNLFNBQVMsaUJBQWlCLE1BQU0sTUFBTTtBQUMzQyxhQUFPLGVBQWUsU0FBUyxDQUFDO0FBQ2hDLFFBQUUsT0FBTyxXQUFXLElBQUksV0FBVyxRQUFRLGFBQWEsUUFBUSxFQUFFLEdBQUcsUUFBUSxDQUFDO0FBQUEsSUFDL0UsQ0FBQztBQUVELFdBQU8sS0FBSyxTQUFTLENBQUM7QUFBQSxFQUN2QixDQUFDO0FBQ0Y7IiwKICAibmFtZXMiOiBbIkNvbnN0YW50cyIsICJSZWFkU3RhdGUiXQp9Cg==
