import { VSBuffer } from "../../../common/buffer.js";
import { Emitter } from "../../../common/event.js";
import { Disposable, DisposableStore } from "../../../common/lifecycle.js";
import { IPCClient } from "./ipc.js";
var SocketDiagnosticsEventType = /* @__PURE__ */ ((SocketDiagnosticsEventType2) => {
  SocketDiagnosticsEventType2["Created"] = "created";
  SocketDiagnosticsEventType2["Read"] = "read";
  SocketDiagnosticsEventType2["Write"] = "write";
  SocketDiagnosticsEventType2["Open"] = "open";
  SocketDiagnosticsEventType2["Error"] = "error";
  SocketDiagnosticsEventType2["Close"] = "close";
  SocketDiagnosticsEventType2["BrowserWebSocketBlobReceived"] = "browserWebSocketBlobReceived";
  SocketDiagnosticsEventType2["NodeEndReceived"] = "nodeEndReceived";
  SocketDiagnosticsEventType2["NodeEndSent"] = "nodeEndSent";
  SocketDiagnosticsEventType2["NodeDrainBegin"] = "nodeDrainBegin";
  SocketDiagnosticsEventType2["NodeDrainEnd"] = "nodeDrainEnd";
  SocketDiagnosticsEventType2["zlibInflateError"] = "zlibInflateError";
  SocketDiagnosticsEventType2["zlibInflateData"] = "zlibInflateData";
  SocketDiagnosticsEventType2["zlibInflateInitialWrite"] = "zlibInflateInitialWrite";
  SocketDiagnosticsEventType2["zlibInflateInitialFlushFired"] = "zlibInflateInitialFlushFired";
  SocketDiagnosticsEventType2["zlibInflateWrite"] = "zlibInflateWrite";
  SocketDiagnosticsEventType2["zlibInflateFlushFired"] = "zlibInflateFlushFired";
  SocketDiagnosticsEventType2["zlibDeflateError"] = "zlibDeflateError";
  SocketDiagnosticsEventType2["zlibDeflateData"] = "zlibDeflateData";
  SocketDiagnosticsEventType2["zlibDeflateWrite"] = "zlibDeflateWrite";
  SocketDiagnosticsEventType2["zlibDeflateFlushFired"] = "zlibDeflateFlushFired";
  SocketDiagnosticsEventType2["WebSocketNodeSocketWrite"] = "webSocketNodeSocketWrite";
  SocketDiagnosticsEventType2["WebSocketNodeSocketPeekedHeader"] = "webSocketNodeSocketPeekedHeader";
  SocketDiagnosticsEventType2["WebSocketNodeSocketReadHeader"] = "webSocketNodeSocketReadHeader";
  SocketDiagnosticsEventType2["WebSocketNodeSocketReadData"] = "webSocketNodeSocketReadData";
  SocketDiagnosticsEventType2["WebSocketNodeSocketUnmaskedData"] = "webSocketNodeSocketUnmaskedData";
  SocketDiagnosticsEventType2["WebSocketNodeSocketDrainBegin"] = "webSocketNodeSocketDrainBegin";
  SocketDiagnosticsEventType2["WebSocketNodeSocketDrainEnd"] = "webSocketNodeSocketDrainEnd";
  SocketDiagnosticsEventType2["ProtocolHeaderRead"] = "protocolHeaderRead";
  SocketDiagnosticsEventType2["ProtocolMessageRead"] = "protocolMessageRead";
  SocketDiagnosticsEventType2["ProtocolHeaderWrite"] = "protocolHeaderWrite";
  SocketDiagnosticsEventType2["ProtocolMessageWrite"] = "protocolMessageWrite";
  SocketDiagnosticsEventType2["ProtocolWrite"] = "protocolWrite";
  return SocketDiagnosticsEventType2;
})(SocketDiagnosticsEventType || {});
var SocketDiagnostics;
((SocketDiagnostics2) => {
  SocketDiagnostics2.enableDiagnostics = false;
  SocketDiagnostics2.records = [];
  const socketIds = /* @__PURE__ */ new WeakMap();
  let lastUsedSocketId = 0;
  function getSocketId(nativeObject, label) {
    if (!socketIds.has(nativeObject)) {
      const id = String(++lastUsedSocketId);
      socketIds.set(nativeObject, id);
    }
    return socketIds.get(nativeObject);
  }
  function traceSocketEvent(nativeObject, socketDebugLabel, type, data) {
    if (!SocketDiagnostics2.enableDiagnostics) {
      return;
    }
    const id = getSocketId(nativeObject, socketDebugLabel);
    if (data instanceof VSBuffer || data instanceof Uint8Array || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const copiedData = VSBuffer.alloc(data.byteLength);
      copiedData.set(data);
      SocketDiagnostics2.records.push({ timestamp: Date.now(), id, label: socketDebugLabel, type, buff: copiedData });
    } else {
      SocketDiagnostics2.records.push({ timestamp: Date.now(), id, label: socketDebugLabel, type, data });
    }
  }
  SocketDiagnostics2.traceSocketEvent = traceSocketEvent;
})(SocketDiagnostics || (SocketDiagnostics = {}));
var SocketCloseEventType = /* @__PURE__ */ ((SocketCloseEventType2) => {
  SocketCloseEventType2[SocketCloseEventType2["NodeSocketCloseEvent"] = 0] = "NodeSocketCloseEvent";
  SocketCloseEventType2[SocketCloseEventType2["WebSocketCloseEvent"] = 1] = "WebSocketCloseEvent";
  return SocketCloseEventType2;
})(SocketCloseEventType || {});
let emptyBuffer = null;
function getEmptyBuffer() {
  if (!emptyBuffer) {
    emptyBuffer = VSBuffer.alloc(0);
  }
  return emptyBuffer;
}
class ChunkStream {
  get byteLength() {
    return this._totalLength;
  }
  constructor() {
    this._chunks = [];
    this._totalLength = 0;
  }
  acceptChunk(buff) {
    this._chunks.push(buff);
    this._totalLength += buff.byteLength;
  }
  read(byteCount) {
    return this._read(byteCount, true);
  }
  peek(byteCount) {
    return this._read(byteCount, false);
  }
  _read(byteCount, advance) {
    if (byteCount === 0) {
      return getEmptyBuffer();
    }
    if (byteCount > this._totalLength) {
      throw new Error(`Cannot read so many bytes!`);
    }
    if (this._chunks[0].byteLength === byteCount) {
      const result2 = this._chunks[0];
      if (advance) {
        this._chunks.shift();
        this._totalLength -= byteCount;
      }
      return result2;
    }
    if (this._chunks[0].byteLength > byteCount) {
      const result2 = this._chunks[0].slice(0, byteCount);
      if (advance) {
        this._chunks[0] = this._chunks[0].slice(byteCount);
        this._totalLength -= byteCount;
      }
      return result2;
    }
    const result = VSBuffer.alloc(byteCount);
    let resultOffset = 0;
    let chunkIndex = 0;
    while (byteCount > 0) {
      const chunk = this._chunks[chunkIndex];
      if (chunk.byteLength > byteCount) {
        const chunkPart = chunk.slice(0, byteCount);
        result.set(chunkPart, resultOffset);
        resultOffset += byteCount;
        if (advance) {
          this._chunks[chunkIndex] = chunk.slice(byteCount);
          this._totalLength -= byteCount;
        }
        byteCount -= byteCount;
      } else {
        result.set(chunk, resultOffset);
        resultOffset += chunk.byteLength;
        if (advance) {
          this._chunks.shift();
          this._totalLength -= chunk.byteLength;
        } else {
          chunkIndex++;
        }
        byteCount -= chunk.byteLength;
      }
    }
    return result;
  }
}
var ProtocolMessageType = /* @__PURE__ */ ((ProtocolMessageType2) => {
  ProtocolMessageType2[ProtocolMessageType2["None"] = 0] = "None";
  ProtocolMessageType2[ProtocolMessageType2["Regular"] = 1] = "Regular";
  ProtocolMessageType2[ProtocolMessageType2["Control"] = 2] = "Control";
  ProtocolMessageType2[ProtocolMessageType2["Ack"] = 3] = "Ack";
  ProtocolMessageType2[ProtocolMessageType2["Disconnect"] = 5] = "Disconnect";
  ProtocolMessageType2[ProtocolMessageType2["ReplayRequest"] = 6] = "ReplayRequest";
  ProtocolMessageType2[ProtocolMessageType2["Pause"] = 7] = "Pause";
  ProtocolMessageType2[ProtocolMessageType2["Resume"] = 8] = "Resume";
  ProtocolMessageType2[ProtocolMessageType2["KeepAlive"] = 9] = "KeepAlive";
  return ProtocolMessageType2;
})(ProtocolMessageType || {});
function protocolMessageTypeToString(messageType) {
  switch (messageType) {
    case 0 /* None */:
      return "None";
    case 1 /* Regular */:
      return "Regular";
    case 2 /* Control */:
      return "Control";
    case 3 /* Ack */:
      return "Ack";
    case 5 /* Disconnect */:
      return "Disconnect";
    case 6 /* ReplayRequest */:
      return "ReplayRequest";
    case 7 /* Pause */:
      return "PauseWriting";
    case 8 /* Resume */:
      return "ResumeWriting";
    case 9 /* KeepAlive */:
      return "KeepAlive";
  }
}
var ProtocolConstants = /* @__PURE__ */ ((ProtocolConstants2) => {
  ProtocolConstants2[ProtocolConstants2["HeaderLength"] = 13] = "HeaderLength";
  ProtocolConstants2[ProtocolConstants2["AcknowledgeTime"] = 2e3] = "AcknowledgeTime";
  ProtocolConstants2[ProtocolConstants2["TimeoutTime"] = 2e4] = "TimeoutTime";
  ProtocolConstants2[ProtocolConstants2["ReconnectionGraceTime"] = 108e5] = "ReconnectionGraceTime";
  ProtocolConstants2[ProtocolConstants2["ReconnectionShortGraceTime"] = 3e5] = "ReconnectionShortGraceTime";
  ProtocolConstants2[ProtocolConstants2["KeepAliveSendTime"] = 5e3] = "KeepAliveSendTime";
  return ProtocolConstants2;
})(ProtocolConstants || {});
class ProtocolMessage {
  constructor(type, id, ack, data) {
    this.type = type;
    this.id = id;
    this.ack = ack;
    this.data = data;
    this.writtenTime = 0;
  }
  get size() {
    return this.data.byteLength;
  }
}
class ProtocolReader extends Disposable {
  constructor(socket) {
    super();
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._state = {
      readHead: true,
      readLen: 13 /* HeaderLength */,
      messageType: 0 /* None */,
      id: 0,
      ack: 0
    };
    this._socket = socket;
    this._isDisposed = false;
    this._incomingData = new ChunkStream();
    this._register(this._socket.onData((data) => this.acceptChunk(data)));
    this.lastReadTime = Date.now();
  }
  acceptChunk(data) {
    if (!data || data.byteLength === 0) {
      return;
    }
    this.lastReadTime = Date.now();
    this._incomingData.acceptChunk(data);
    while (this._incomingData.byteLength >= this._state.readLen) {
      const buff = this._incomingData.read(this._state.readLen);
      if (this._state.readHead) {
        this._state.readHead = false;
        this._state.readLen = buff.readUInt32BE(9);
        this._state.messageType = buff.readUInt8(0);
        this._state.id = buff.readUInt32BE(1);
        this._state.ack = buff.readUInt32BE(5);
        this._socket.traceSocketEvent("protocolHeaderRead" /* ProtocolHeaderRead */, { messageType: protocolMessageTypeToString(this._state.messageType), id: this._state.id, ack: this._state.ack, messageSize: this._state.readLen });
      } else {
        const messageType = this._state.messageType;
        const id = this._state.id;
        const ack = this._state.ack;
        this._state.readHead = true;
        this._state.readLen = 13 /* HeaderLength */;
        this._state.messageType = 0 /* None */;
        this._state.id = 0;
        this._state.ack = 0;
        this._socket.traceSocketEvent("protocolMessageRead" /* ProtocolMessageRead */, buff);
        this._onMessage.fire(new ProtocolMessage(messageType, id, ack, buff));
        if (this._isDisposed) {
          break;
        }
      }
    }
  }
  readEntireBuffer() {
    return this._incomingData.read(this._incomingData.byteLength);
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
  }
}
class ProtocolWriter {
  constructor(socket) {
    this._writeNowTimeout = null;
    this._isDisposed = false;
    this._isPaused = false;
    this._socket = socket;
    this._data = [];
    this._totalLength = 0;
    this.lastWriteTime = 0;
  }
  dispose() {
    try {
      this.flush();
    } catch (err) {
    }
    this._isDisposed = true;
  }
  drain() {
    this.flush();
    return this._socket.drain();
  }
  flush() {
    this._writeNow();
  }
  pause() {
    this._isPaused = true;
  }
  resume() {
    this._isPaused = false;
    this._scheduleWriting();
  }
  write(msg) {
    if (this._isDisposed) {
      return;
    }
    msg.writtenTime = Date.now();
    this.lastWriteTime = Date.now();
    const header = VSBuffer.alloc(13 /* HeaderLength */);
    header.writeUInt8(msg.type, 0);
    header.writeUInt32BE(msg.id, 1);
    header.writeUInt32BE(msg.ack, 5);
    header.writeUInt32BE(msg.data.byteLength, 9);
    this._socket.traceSocketEvent("protocolHeaderWrite" /* ProtocolHeaderWrite */, { messageType: protocolMessageTypeToString(msg.type), id: msg.id, ack: msg.ack, messageSize: msg.data.byteLength });
    this._socket.traceSocketEvent("protocolMessageWrite" /* ProtocolMessageWrite */, msg.data);
    this._writeSoon(header, msg.data);
  }
  _bufferAdd(head, body) {
    const wasEmpty = this._totalLength === 0;
    this._data.push(head, body);
    this._totalLength += head.byteLength + body.byteLength;
    return wasEmpty;
  }
  _bufferTake() {
    const ret = VSBuffer.concat(this._data, this._totalLength);
    this._data.length = 0;
    this._totalLength = 0;
    return ret;
  }
  _writeSoon(header, data) {
    if (this._bufferAdd(header, data)) {
      this._scheduleWriting();
    }
  }
  _scheduleWriting() {
    if (this._writeNowTimeout) {
      return;
    }
    this._writeNowTimeout = setTimeout(() => {
      this._writeNowTimeout = null;
      this._writeNow();
    });
  }
  _writeNow() {
    if (this._totalLength === 0) {
      return;
    }
    if (this._isPaused) {
      return;
    }
    const data = this._bufferTake();
    this._socket.traceSocketEvent("protocolWrite" /* ProtocolWrite */, { byteLength: data.byteLength });
    this._socket.write(data);
  }
}
class Protocol extends Disposable {
  constructor(socket) {
    super();
    this._onMessage = new Emitter();
    this.onMessage = this._onMessage.event;
    this._onDidDispose = new Emitter();
    this.onDidDispose = this._onDidDispose.event;
    this._socket = socket;
    this._socketWriter = this._register(new ProtocolWriter(this._socket));
    this._socketReader = this._register(new ProtocolReader(this._socket));
    this._register(this._socketReader.onMessage((msg) => {
      if (msg.type === 1 /* Regular */) {
        this._onMessage.fire(msg.data);
      }
    }));
    this._register(this._socket.onClose(() => this._onDidDispose.fire()));
  }
  drain() {
    return this._socketWriter.drain();
  }
  getSocket() {
    return this._socket;
  }
  sendDisconnect() {
  }
  send(buffer) {
    this._socketWriter.write(new ProtocolMessage(1 /* Regular */, 0, 0, buffer));
  }
}
class Client extends IPCClient {
  constructor(protocol, id, ipcLogger = null) {
    super(protocol, id, ipcLogger);
    this.protocol = protocol;
  }
  static fromSocket(socket, id) {
    return new Client(new Protocol(socket), id);
  }
  get onDidDispose() {
    return this.protocol.onDidDispose;
  }
  dispose() {
    super.dispose();
    const socket = this.protocol.getSocket();
    this.protocol.sendDisconnect();
    this.protocol.dispose();
    socket.end();
  }
}
class BufferedEmitter {
  constructor() {
    this._hasListeners = false;
    this._isDeliveringMessages = false;
    this._bufferedMessages = [];
    this._emitter = new Emitter({
      onWillAddFirstListener: () => {
        this._hasListeners = true;
        queueMicrotask(() => this._deliverMessages());
      },
      onDidRemoveLastListener: () => {
        this._hasListeners = false;
      }
    });
    this.event = this._emitter.event;
  }
  _deliverMessages() {
    if (this._isDeliveringMessages) {
      return;
    }
    this._isDeliveringMessages = true;
    while (this._hasListeners && this._bufferedMessages.length > 0) {
      this._emitter.fire(this._bufferedMessages.shift());
    }
    this._isDeliveringMessages = false;
  }
  fire(event) {
    if (this._hasListeners) {
      if (this._bufferedMessages.length > 0) {
        this._bufferedMessages.push(event);
      } else {
        this._emitter.fire(event);
      }
    } else {
      this._bufferedMessages.push(event);
    }
  }
  flushBuffer() {
    this._bufferedMessages = [];
  }
}
class QueueElement {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}
class Queue {
  constructor() {
    this._first = null;
    this._last = null;
  }
  length() {
    let result = 0;
    let current = this._first;
    while (current) {
      current = current.next;
      result++;
    }
    return result;
  }
  peek() {
    if (!this._first) {
      return null;
    }
    return this._first.data;
  }
  toArray() {
    const result = [];
    let resultLen = 0;
    let it = this._first;
    while (it) {
      result[resultLen++] = it.data;
      it = it.next;
    }
    return result;
  }
  pop() {
    if (!this._first) {
      return;
    }
    if (this._first === this._last) {
      this._first = null;
      this._last = null;
      return;
    }
    this._first = this._first.next;
  }
  push(item) {
    const element = new QueueElement(item);
    if (!this._first) {
      this._first = element;
      this._last = element;
      return;
    }
    this._last.next = element;
    this._last = element;
  }
}
const _LoadEstimator = class _LoadEstimator {
  static getInstance() {
    if (!_LoadEstimator._INSTANCE) {
      _LoadEstimator._INSTANCE = new _LoadEstimator();
    }
    return _LoadEstimator._INSTANCE;
  }
  constructor() {
    this.lastRuns = [];
    const now = Date.now();
    for (let i = 0; i < _LoadEstimator._HISTORY_LENGTH; i++) {
      this.lastRuns[i] = now - 1e3 * i;
    }
    setInterval(() => {
      for (let i = _LoadEstimator._HISTORY_LENGTH; i >= 1; i--) {
        this.lastRuns[i] = this.lastRuns[i - 1];
      }
      this.lastRuns[0] = Date.now();
    }, 1e3);
  }
  /**
   * returns an estimative number, from 0 (low load) to 1 (high load)
   */
  load() {
    const now = Date.now();
    const historyLimit = (1 + _LoadEstimator._HISTORY_LENGTH) * 1e3;
    let score = 0;
    for (let i = 0; i < _LoadEstimator._HISTORY_LENGTH; i++) {
      if (now - this.lastRuns[i] <= historyLimit) {
        score++;
      }
    }
    return 1 - score / _LoadEstimator._HISTORY_LENGTH;
  }
  hasHighLoad() {
    return this.load() >= 0.5;
  }
};
_LoadEstimator._HISTORY_LENGTH = 10;
_LoadEstimator._INSTANCE = null;
let LoadEstimator = _LoadEstimator;
class PersistentProtocol {
  constructor(opts) {
    this._onControlMessage = new BufferedEmitter();
    this.onControlMessage = this._onControlMessage.event;
    this._onMessage = new BufferedEmitter();
    this.onMessage = this._onMessage.event;
    this._onDidDispose = new BufferedEmitter();
    this.onDidDispose = this._onDidDispose.event;
    this._onSocketClose = new BufferedEmitter();
    this.onSocketClose = this._onSocketClose.event;
    this._onSocketTimeout = new BufferedEmitter();
    this.onSocketTimeout = this._onSocketTimeout.event;
    this._loadEstimator = opts.loadEstimator ?? LoadEstimator.getInstance();
    this._shouldSendKeepAlive = opts.sendKeepAlive ?? true;
    this._isReconnecting = false;
    this._outgoingUnackMsg = new Queue();
    this._outgoingMsgId = 0;
    this._outgoingAckId = 0;
    this._outgoingAckTimeout = null;
    this._incomingMsgId = 0;
    this._incomingAckId = 0;
    this._incomingMsgLastTime = 0;
    this._incomingAckTimeout = null;
    this._lastReplayRequestTime = 0;
    this._lastSocketTimeoutTime = Date.now();
    this._socketDisposables = new DisposableStore();
    this._socket = opts.socket;
    this._socketWriter = this._socketDisposables.add(new ProtocolWriter(this._socket));
    this._socketReader = this._socketDisposables.add(new ProtocolReader(this._socket));
    this._socketDisposables.add(this._socketReader.onMessage((msg) => this._receiveMessage(msg)));
    this._socketDisposables.add(this._socket.onClose((e) => this._onSocketClose.fire(e)));
    if (opts.initialChunk) {
      this._socketReader.acceptChunk(opts.initialChunk);
    }
    if (this._shouldSendKeepAlive) {
      this._keepAliveInterval = setInterval(() => {
        this._sendKeepAlive();
      }, 5e3 /* KeepAliveSendTime */);
    } else {
      this._keepAliveInterval = null;
    }
  }
  get unacknowledgedCount() {
    return this._outgoingMsgId - this._outgoingAckId;
  }
  dispose() {
    if (this._outgoingAckTimeout) {
      clearTimeout(this._outgoingAckTimeout);
      this._outgoingAckTimeout = null;
    }
    if (this._incomingAckTimeout) {
      clearTimeout(this._incomingAckTimeout);
      this._incomingAckTimeout = null;
    }
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }
    this._socketDisposables.dispose();
  }
  drain() {
    return this._socketWriter.drain();
  }
  sendDisconnect() {
    if (!this._didSendDisconnect) {
      this._didSendDisconnect = true;
      const msg = new ProtocolMessage(5 /* Disconnect */, 0, 0, getEmptyBuffer());
      this._socketWriter.write(msg);
      this._socketWriter.flush();
    }
  }
  sendPause() {
    const msg = new ProtocolMessage(7 /* Pause */, 0, 0, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  sendResume() {
    const msg = new ProtocolMessage(8 /* Resume */, 0, 0, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  pauseSocketWriting() {
    this._socketWriter.pause();
  }
  getSocket() {
    return this._socket;
  }
  getMillisSinceLastIncomingData() {
    return Date.now() - this._socketReader.lastReadTime;
  }
  beginAcceptReconnection(socket, initialDataChunk) {
    this._isReconnecting = true;
    this._socketDisposables.dispose();
    this._socketDisposables = new DisposableStore();
    this._onControlMessage.flushBuffer();
    this._onSocketClose.flushBuffer();
    this._onSocketTimeout.flushBuffer();
    this._socket.dispose();
    this._lastReplayRequestTime = 0;
    this._lastSocketTimeoutTime = Date.now();
    this._socket = socket;
    this._socketWriter = this._socketDisposables.add(new ProtocolWriter(this._socket));
    this._socketReader = this._socketDisposables.add(new ProtocolReader(this._socket));
    this._socketDisposables.add(this._socketReader.onMessage((msg) => this._receiveMessage(msg)));
    this._socketDisposables.add(this._socket.onClose((e) => this._onSocketClose.fire(e)));
    this._socketReader.acceptChunk(initialDataChunk);
  }
  endAcceptReconnection() {
    this._isReconnecting = false;
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(3 /* Ack */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
    const toSend = this._outgoingUnackMsg.toArray();
    for (let i = 0, len = toSend.length; i < len; i++) {
      this._socketWriter.write(toSend[i]);
    }
    this._recvAckCheck();
  }
  acceptDisconnect() {
    this._onDidDispose.fire();
  }
  _receiveMessage(msg) {
    if (msg.ack > this._outgoingAckId) {
      this._outgoingAckId = msg.ack;
      do {
        const first = this._outgoingUnackMsg.peek();
        if (first && first.id <= msg.ack) {
          this._outgoingUnackMsg.pop();
        } else {
          break;
        }
      } while (true);
    }
    switch (msg.type) {
      case 0 /* None */: {
        break;
      }
      case 1 /* Regular */: {
        if (msg.id > this._incomingMsgId) {
          if (msg.id !== this._incomingMsgId + 1) {
            const now = Date.now();
            if (now - this._lastReplayRequestTime > 1e4) {
              this._lastReplayRequestTime = now;
              this._socketWriter.write(new ProtocolMessage(6 /* ReplayRequest */, 0, 0, getEmptyBuffer()));
            }
          } else {
            this._incomingMsgId = msg.id;
            this._incomingMsgLastTime = Date.now();
            this._sendAckCheck();
            this._onMessage.fire(msg.data);
          }
        }
        break;
      }
      case 2 /* Control */: {
        this._onControlMessage.fire(msg.data);
        break;
      }
      case 3 /* Ack */: {
        break;
      }
      case 5 /* Disconnect */: {
        this._onDidDispose.fire();
        break;
      }
      case 6 /* ReplayRequest */: {
        const toSend = this._outgoingUnackMsg.toArray();
        for (let i = 0, len = toSend.length; i < len; i++) {
          this._socketWriter.write(toSend[i]);
        }
        this._recvAckCheck();
        break;
      }
      case 7 /* Pause */: {
        this._socketWriter.pause();
        break;
      }
      case 8 /* Resume */: {
        this._socketWriter.resume();
        break;
      }
      case 9 /* KeepAlive */: {
        break;
      }
    }
  }
  readEntireBuffer() {
    return this._socketReader.readEntireBuffer();
  }
  flush() {
    this._socketWriter.flush();
  }
  send(buffer) {
    const myId = ++this._outgoingMsgId;
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(1 /* Regular */, myId, this._incomingAckId, buffer);
    this._outgoingUnackMsg.push(msg);
    if (!this._isReconnecting) {
      this._socketWriter.write(msg);
      this._recvAckCheck();
    }
  }
  /**
   * Send a message which will not be part of the regular acknowledge flow.
   * Use this for early control messages which are repeated in case of reconnection.
   */
  sendControl(buffer) {
    const msg = new ProtocolMessage(2 /* Control */, 0, 0, buffer);
    this._socketWriter.write(msg);
  }
  _sendAckCheck() {
    if (this._incomingMsgId <= this._incomingAckId) {
      return;
    }
    if (this._incomingAckTimeout) {
      return;
    }
    const timeSinceLastIncomingMsg = Date.now() - this._incomingMsgLastTime;
    if (timeSinceLastIncomingMsg >= 2e3 /* AcknowledgeTime */) {
      this._sendAck();
      return;
    }
    this._incomingAckTimeout = setTimeout(() => {
      this._incomingAckTimeout = null;
      this._sendAckCheck();
    }, 2e3 /* AcknowledgeTime */ - timeSinceLastIncomingMsg + 5);
  }
  _recvAckCheck() {
    if (this._outgoingMsgId <= this._outgoingAckId) {
      return;
    }
    if (this._outgoingAckTimeout) {
      return;
    }
    if (this._isReconnecting) {
      return;
    }
    const oldestUnacknowledgedMsg = this._outgoingUnackMsg.peek();
    const timeSinceOldestUnacknowledgedMsg = Date.now() - oldestUnacknowledgedMsg.writtenTime;
    const timeSinceLastReceivedSomeData = Date.now() - this._socketReader.lastReadTime;
    const timeSinceLastTimeout = Date.now() - this._lastSocketTimeoutTime;
    if (timeSinceOldestUnacknowledgedMsg >= 2e4 /* TimeoutTime */ && timeSinceLastReceivedSomeData >= 2e4 /* TimeoutTime */ && timeSinceLastTimeout >= 2e4 /* TimeoutTime */) {
      if (!this._loadEstimator.hasHighLoad()) {
        this._lastSocketTimeoutTime = Date.now();
        this._onSocketTimeout.fire({
          unacknowledgedMsgCount: this._outgoingUnackMsg.length(),
          timeSinceOldestUnacknowledgedMsg,
          timeSinceLastReceivedSomeData
        });
        return;
      }
    }
    const minimumTimeUntilTimeout = Math.max(
      2e4 /* TimeoutTime */ - timeSinceOldestUnacknowledgedMsg,
      2e4 /* TimeoutTime */ - timeSinceLastReceivedSomeData,
      2e4 /* TimeoutTime */ - timeSinceLastTimeout,
      500
    );
    this._outgoingAckTimeout = setTimeout(() => {
      this._outgoingAckTimeout = null;
      this._recvAckCheck();
    }, minimumTimeUntilTimeout);
  }
  _sendAck() {
    if (this._incomingMsgId <= this._incomingAckId) {
      return;
    }
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(3 /* Ack */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  _sendKeepAlive() {
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(9 /* KeepAlive */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
}
export {
  BufferedEmitter,
  ChunkStream,
  Client,
  PersistentProtocol,
  Protocol,
  ProtocolConstants,
  SocketCloseEventType,
  SocketDiagnostics,
  SocketDiagnosticsEventType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLm5ldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJSVBDTG9nZ2VyLCBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCwgSVBDQ2xpZW50IH0gZnJvbSAnLi9pcGMuanMnO1xuXG5leHBvcnQgY29uc3QgZW51bSBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSB7XG5cdENyZWF0ZWQgPSAnY3JlYXRlZCcsXG5cdFJlYWQgPSAncmVhZCcsXG5cdFdyaXRlID0gJ3dyaXRlJyxcblx0T3BlbiA9ICdvcGVuJyxcblx0RXJyb3IgPSAnZXJyb3InLFxuXHRDbG9zZSA9ICdjbG9zZScsXG5cblx0QnJvd3NlcldlYlNvY2tldEJsb2JSZWNlaXZlZCA9ICdicm93c2VyV2ViU29ja2V0QmxvYlJlY2VpdmVkJyxcblxuXHROb2RlRW5kUmVjZWl2ZWQgPSAnbm9kZUVuZFJlY2VpdmVkJyxcblx0Tm9kZUVuZFNlbnQgPSAnbm9kZUVuZFNlbnQnLFxuXHROb2RlRHJhaW5CZWdpbiA9ICdub2RlRHJhaW5CZWdpbicsXG5cdE5vZGVEcmFpbkVuZCA9ICdub2RlRHJhaW5FbmQnLFxuXG5cdHpsaWJJbmZsYXRlRXJyb3IgPSAnemxpYkluZmxhdGVFcnJvcicsXG5cdHpsaWJJbmZsYXRlRGF0YSA9ICd6bGliSW5mbGF0ZURhdGEnLFxuXHR6bGliSW5mbGF0ZUluaXRpYWxXcml0ZSA9ICd6bGliSW5mbGF0ZUluaXRpYWxXcml0ZScsXG5cdHpsaWJJbmZsYXRlSW5pdGlhbEZsdXNoRmlyZWQgPSAnemxpYkluZmxhdGVJbml0aWFsRmx1c2hGaXJlZCcsXG5cdHpsaWJJbmZsYXRlV3JpdGUgPSAnemxpYkluZmxhdGVXcml0ZScsXG5cdHpsaWJJbmZsYXRlRmx1c2hGaXJlZCA9ICd6bGliSW5mbGF0ZUZsdXNoRmlyZWQnLFxuXHR6bGliRGVmbGF0ZUVycm9yID0gJ3psaWJEZWZsYXRlRXJyb3InLFxuXHR6bGliRGVmbGF0ZURhdGEgPSAnemxpYkRlZmxhdGVEYXRhJyxcblx0emxpYkRlZmxhdGVXcml0ZSA9ICd6bGliRGVmbGF0ZVdyaXRlJyxcblx0emxpYkRlZmxhdGVGbHVzaEZpcmVkID0gJ3psaWJEZWZsYXRlRmx1c2hGaXJlZCcsXG5cblx0V2ViU29ja2V0Tm9kZVNvY2tldFdyaXRlID0gJ3dlYlNvY2tldE5vZGVTb2NrZXRXcml0ZScsXG5cdFdlYlNvY2tldE5vZGVTb2NrZXRQZWVrZWRIZWFkZXIgPSAnd2ViU29ja2V0Tm9kZVNvY2tldFBlZWtlZEhlYWRlcicsXG5cdFdlYlNvY2tldE5vZGVTb2NrZXRSZWFkSGVhZGVyID0gJ3dlYlNvY2tldE5vZGVTb2NrZXRSZWFkSGVhZGVyJyxcblx0V2ViU29ja2V0Tm9kZVNvY2tldFJlYWREYXRhID0gJ3dlYlNvY2tldE5vZGVTb2NrZXRSZWFkRGF0YScsXG5cdFdlYlNvY2tldE5vZGVTb2NrZXRVbm1hc2tlZERhdGEgPSAnd2ViU29ja2V0Tm9kZVNvY2tldFVubWFza2VkRGF0YScsXG5cdFdlYlNvY2tldE5vZGVTb2NrZXREcmFpbkJlZ2luID0gJ3dlYlNvY2tldE5vZGVTb2NrZXREcmFpbkJlZ2luJyxcblx0V2ViU29ja2V0Tm9kZVNvY2tldERyYWluRW5kID0gJ3dlYlNvY2tldE5vZGVTb2NrZXREcmFpbkVuZCcsXG5cblx0UHJvdG9jb2xIZWFkZXJSZWFkID0gJ3Byb3RvY29sSGVhZGVyUmVhZCcsXG5cdFByb3RvY29sTWVzc2FnZVJlYWQgPSAncHJvdG9jb2xNZXNzYWdlUmVhZCcsXG5cdFByb3RvY29sSGVhZGVyV3JpdGUgPSAncHJvdG9jb2xIZWFkZXJXcml0ZScsXG5cdFByb3RvY29sTWVzc2FnZVdyaXRlID0gJ3Byb3RvY29sTWVzc2FnZVdyaXRlJyxcblx0UHJvdG9jb2xXcml0ZSA9ICdwcm90b2NvbFdyaXRlJyxcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBTb2NrZXREaWFnbm9zdGljcyB7XG5cblx0ZXhwb3J0IGNvbnN0IGVuYWJsZURpYWdub3N0aWNzID0gZmFsc2U7XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJUmVjb3JkIHtcblx0XHR0aW1lc3RhbXA6IG51bWJlcjtcblx0XHRpZDogc3RyaW5nO1xuXHRcdGxhYmVsOiBzdHJpbmc7XG5cdFx0dHlwZTogU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGU7XG5cdFx0YnVmZj86IFZTQnVmZmVyO1xuXHRcdGRhdGE/OiBhbnk7XG5cdH1cblxuXHRleHBvcnQgY29uc3QgcmVjb3JkczogSVJlY29yZFtdID0gW107XG5cdGNvbnN0IHNvY2tldElkcyA9IG5ldyBXZWFrTWFwPGFueSwgc3RyaW5nPigpO1xuXHRsZXQgbGFzdFVzZWRTb2NrZXRJZCA9IDA7XG5cblx0ZnVuY3Rpb24gZ2V0U29ja2V0SWQobmF0aXZlT2JqZWN0OiBhbnksIGxhYmVsOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmICghc29ja2V0SWRzLmhhcyhuYXRpdmVPYmplY3QpKSB7XG5cdFx0XHRjb25zdCBpZCA9IFN0cmluZygrK2xhc3RVc2VkU29ja2V0SWQpO1xuXHRcdFx0c29ja2V0SWRzLnNldChuYXRpdmVPYmplY3QsIGlkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHNvY2tldElkcy5nZXQobmF0aXZlT2JqZWN0KSE7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdHJhY2VTb2NrZXRFdmVudChuYXRpdmVPYmplY3Q6IGFueSwgc29ja2V0RGVidWdMYWJlbDogc3RyaW5nLCB0eXBlOiBTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZSwgZGF0YT86IFZTQnVmZmVyIHwgVWludDhBcnJheSB8IEFycmF5QnVmZmVyIHwgQXJyYXlCdWZmZXJWaWV3IHwgYW55KTogdm9pZCB7XG5cdFx0aWYgKCFlbmFibGVEaWFnbm9zdGljcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpZCA9IGdldFNvY2tldElkKG5hdGl2ZU9iamVjdCwgc29ja2V0RGVidWdMYWJlbCk7XG5cblx0XHRpZiAoZGF0YSBpbnN0YW5jZW9mIFZTQnVmZmVyIHx8IGRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5IHx8IGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fCBBcnJheUJ1ZmZlci5pc1ZpZXcoZGF0YSkpIHtcblx0XHRcdGNvbnN0IGNvcGllZERhdGEgPSBWU0J1ZmZlci5hbGxvYyhkYXRhLmJ5dGVMZW5ndGgpO1xuXHRcdFx0Y29waWVkRGF0YS5zZXQoZGF0YSk7XG5cdFx0XHRyZWNvcmRzLnB1c2goeyB0aW1lc3RhbXA6IERhdGUubm93KCksIGlkLCBsYWJlbDogc29ja2V0RGVidWdMYWJlbCwgdHlwZSwgYnVmZjogY29waWVkRGF0YSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZGF0YSBpcyBhIGN1c3RvbSBvYmplY3Rcblx0XHRcdHJlY29yZHMucHVzaCh7IHRpbWVzdGFtcDogRGF0ZS5ub3coKSwgaWQsIGxhYmVsOiBzb2NrZXREZWJ1Z0xhYmVsLCB0eXBlLCBkYXRhOiBkYXRhIH0pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTb2NrZXRDbG9zZUV2ZW50VHlwZSB7XG5cdE5vZGVTb2NrZXRDbG9zZUV2ZW50ID0gMCxcblx0V2ViU29ja2V0Q2xvc2VFdmVudCA9IDFcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb2RlU29ja2V0Q2xvc2VFdmVudCB7XG5cdC8qKlxuXHQgKiBUaGUgdHlwZSBvZiB0aGUgZXZlbnRcblx0ICovXG5cdHJlYWRvbmx5IHR5cGU6IFNvY2tldENsb3NlRXZlbnRUeXBlLk5vZGVTb2NrZXRDbG9zZUV2ZW50O1xuXHQvKipcblx0ICogYHRydWVgIGlmIHRoZSBzb2NrZXQgaGFkIGEgdHJhbnNtaXNzaW9uIGVycm9yLlxuXHQgKi9cblx0cmVhZG9ubHkgaGFkRXJyb3I6IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBVbmRlcmx5aW5nIGVycm9yLlxuXHQgKi9cblx0cmVhZG9ubHkgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYlNvY2tldENsb3NlRXZlbnQge1xuXHQvKipcblx0ICogVGhlIHR5cGUgb2YgdGhlIGV2ZW50XG5cdCAqL1xuXHRyZWFkb25seSB0eXBlOiBTb2NrZXRDbG9zZUV2ZW50VHlwZS5XZWJTb2NrZXRDbG9zZUV2ZW50O1xuXHQvKipcblx0ICogUmV0dXJucyB0aGUgV2ViU29ja2V0IGNvbm5lY3Rpb24gY2xvc2UgY29kZSBwcm92aWRlZCBieSB0aGUgc2VydmVyLlxuXHQgKi9cblx0cmVhZG9ubHkgY29kZTogbnVtYmVyO1xuXHQvKipcblx0ICogUmV0dXJucyB0aGUgV2ViU29ja2V0IGNvbm5lY3Rpb24gY2xvc2UgcmVhc29uIHByb3ZpZGVkIGJ5IHRoZSBzZXJ2ZXIuXG5cdCAqL1xuXHRyZWFkb25seSByZWFzb246IHN0cmluZztcblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgY29ubmVjdGlvbiBjbG9zZWQgY2xlYW5seTsgZmFsc2Ugb3RoZXJ3aXNlLlxuXHQgKi9cblx0cmVhZG9ubHkgd2FzQ2xlYW46IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBVbmRlcmx5aW5nIGV2ZW50LlxuXHQgKi9cblx0cmVhZG9ubHkgZXZlbnQ6IGFueSB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IHR5cGUgU29ja2V0Q2xvc2VFdmVudCA9IE5vZGVTb2NrZXRDbG9zZUV2ZW50IHwgV2ViU29ja2V0Q2xvc2VFdmVudCB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGludGVyZmFjZSBTb2NrZXRUaW1lb3V0RXZlbnQge1xuXHRyZWFkb25seSB1bmFja25vd2xlZGdlZE1zZ0NvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IHRpbWVTaW5jZU9sZGVzdFVuYWNrbm93bGVkZ2VkTXNnOiBudW1iZXI7XG5cdHJlYWRvbmx5IHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNvY2tldCBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0b25EYXRhKGxpc3RlbmVyOiAoZTogVlNCdWZmZXIpID0+IHZvaWQpOiBJRGlzcG9zYWJsZTtcblx0b25DbG9zZShsaXN0ZW5lcjogKGU6IFNvY2tldENsb3NlRXZlbnQpID0+IHZvaWQpOiBJRGlzcG9zYWJsZTtcblx0b25FbmQobGlzdGVuZXI6ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZTtcblx0d3JpdGUoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQ7XG5cdGVuZCgpOiB2b2lkO1xuXHRkcmFpbigpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHRyYWNlU29ja2V0RXZlbnQodHlwZTogU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUsIGRhdGE/OiBWU0J1ZmZlciB8IFVpbnQ4QXJyYXkgfCBBcnJheUJ1ZmZlciB8IEFycmF5QnVmZmVyVmlldyB8IGFueSk6IHZvaWQ7XG59XG5cbmxldCBlbXB0eUJ1ZmZlcjogVlNCdWZmZXIgfCBudWxsID0gbnVsbDtcbmZ1bmN0aW9uIGdldEVtcHR5QnVmZmVyKCk6IFZTQnVmZmVyIHtcblx0aWYgKCFlbXB0eUJ1ZmZlcikge1xuXHRcdGVtcHR5QnVmZmVyID0gVlNCdWZmZXIuYWxsb2MoMCk7XG5cdH1cblx0cmV0dXJuIGVtcHR5QnVmZmVyO1xufVxuXG5leHBvcnQgY2xhc3MgQ2h1bmtTdHJlYW0ge1xuXG5cdHByaXZhdGUgX2NodW5rczogVlNCdWZmZXJbXTtcblx0cHJpdmF0ZSBfdG90YWxMZW5ndGg6IG51bWJlcjtcblxuXHRwdWJsaWMgZ2V0IGJ5dGVMZW5ndGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3RvdGFsTGVuZ3RoO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fY2h1bmtzID0gW107XG5cdFx0dGhpcy5fdG90YWxMZW5ndGggPSAwO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdENodW5rKGJ1ZmY6IFZTQnVmZmVyKSB7XG5cdFx0dGhpcy5fY2h1bmtzLnB1c2goYnVmZik7XG5cdFx0dGhpcy5fdG90YWxMZW5ndGggKz0gYnVmZi5ieXRlTGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIHJlYWQoYnl0ZUNvdW50OiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlYWQoYnl0ZUNvdW50LCB0cnVlKTtcblx0fVxuXG5cdHB1YmxpYyBwZWVrKGJ5dGVDb3VudDogbnVtYmVyKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiB0aGlzLl9yZWFkKGJ5dGVDb3VudCwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVhZChieXRlQ291bnQ6IG51bWJlciwgYWR2YW5jZTogYm9vbGVhbik6IFZTQnVmZmVyIHtcblxuXHRcdGlmIChieXRlQ291bnQgPT09IDApIHtcblx0XHRcdHJldHVybiBnZXRFbXB0eUJ1ZmZlcigpO1xuXHRcdH1cblxuXHRcdGlmIChieXRlQ291bnQgPiB0aGlzLl90b3RhbExlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVhZCBzbyBtYW55IGJ5dGVzIWApO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jaHVua3NbMF0uYnl0ZUxlbmd0aCA9PT0gYnl0ZUNvdW50KSB7XG5cdFx0XHQvLyBzdXBlciBmYXN0IHBhdGgsIHByZWNpc2VseSBmaXJzdCBjaHVuayBtdXN0IGJlIHJldHVybmVkXG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9jaHVua3NbMF07XG5cdFx0XHRpZiAoYWR2YW5jZSkge1xuXHRcdFx0XHR0aGlzLl9jaHVua3Muc2hpZnQoKTtcblx0XHRcdFx0dGhpcy5fdG90YWxMZW5ndGggLT0gYnl0ZUNvdW50O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY2h1bmtzWzBdLmJ5dGVMZW5ndGggPiBieXRlQ291bnQpIHtcblx0XHRcdC8vIGZhc3QgcGF0aCwgdGhlIHJlYWRpbmcgaXMgZW50aXJlbHkgd2l0aGluIHRoZSBmaXJzdCBjaHVua1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fY2h1bmtzWzBdLnNsaWNlKDAsIGJ5dGVDb3VudCk7XG5cdFx0XHRpZiAoYWR2YW5jZSkge1xuXHRcdFx0XHR0aGlzLl9jaHVua3NbMF0gPSB0aGlzLl9jaHVua3NbMF0uc2xpY2UoYnl0ZUNvdW50KTtcblx0XHRcdFx0dGhpcy5fdG90YWxMZW5ndGggLT0gYnl0ZUNvdW50O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBWU0J1ZmZlci5hbGxvYyhieXRlQ291bnQpO1xuXHRcdGxldCByZXN1bHRPZmZzZXQgPSAwO1xuXHRcdGxldCBjaHVua0luZGV4ID0gMDtcblx0XHR3aGlsZSAoYnl0ZUNvdW50ID4gMCkge1xuXHRcdFx0Y29uc3QgY2h1bmsgPSB0aGlzLl9jaHVua3NbY2h1bmtJbmRleF07XG5cdFx0XHRpZiAoY2h1bmsuYnl0ZUxlbmd0aCA+IGJ5dGVDb3VudCkge1xuXHRcdFx0XHQvLyB0aGlzIGNodW5rIHdpbGwgc3Vydml2ZVxuXHRcdFx0XHRjb25zdCBjaHVua1BhcnQgPSBjaHVuay5zbGljZSgwLCBieXRlQ291bnQpO1xuXHRcdFx0XHRyZXN1bHQuc2V0KGNodW5rUGFydCwgcmVzdWx0T2Zmc2V0KTtcblx0XHRcdFx0cmVzdWx0T2Zmc2V0ICs9IGJ5dGVDb3VudDtcblxuXHRcdFx0XHRpZiAoYWR2YW5jZSkge1xuXHRcdFx0XHRcdHRoaXMuX2NodW5rc1tjaHVua0luZGV4XSA9IGNodW5rLnNsaWNlKGJ5dGVDb3VudCk7XG5cdFx0XHRcdFx0dGhpcy5fdG90YWxMZW5ndGggLT0gYnl0ZUNvdW50O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ynl0ZUNvdW50IC09IGJ5dGVDb3VudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHRoaXMgY2h1bmsgd2lsbCBiZSBlbnRpcmVseSByZWFkXG5cdFx0XHRcdHJlc3VsdC5zZXQoY2h1bmssIHJlc3VsdE9mZnNldCk7XG5cdFx0XHRcdHJlc3VsdE9mZnNldCArPSBjaHVuay5ieXRlTGVuZ3RoO1xuXG5cdFx0XHRcdGlmIChhZHZhbmNlKSB7XG5cdFx0XHRcdFx0dGhpcy5fY2h1bmtzLnNoaWZ0KCk7XG5cdFx0XHRcdFx0dGhpcy5fdG90YWxMZW5ndGggLT0gY2h1bmsuYnl0ZUxlbmd0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjaHVua0luZGV4Kys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRieXRlQ291bnQgLT0gY2h1bmsuYnl0ZUxlbmd0aDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jb25zdCBlbnVtIFByb3RvY29sTWVzc2FnZVR5cGUge1xuXHROb25lID0gMCxcblx0UmVndWxhciA9IDEsXG5cdENvbnRyb2wgPSAyLFxuXHRBY2sgPSAzLFxuXHREaXNjb25uZWN0ID0gNSxcblx0UmVwbGF5UmVxdWVzdCA9IDYsXG5cdFBhdXNlID0gNyxcblx0UmVzdW1lID0gOCxcblx0S2VlcEFsaXZlID0gOVxufVxuXG5mdW5jdGlvbiBwcm90b2NvbE1lc3NhZ2VUeXBlVG9TdHJpbmcobWVzc2FnZVR5cGU6IFByb3RvY29sTWVzc2FnZVR5cGUpIHtcblx0c3dpdGNoIChtZXNzYWdlVHlwZSkge1xuXHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5Ob25lOiByZXR1cm4gJ05vbmUnO1xuXHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5SZWd1bGFyOiByZXR1cm4gJ1JlZ3VsYXInO1xuXHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5Db250cm9sOiByZXR1cm4gJ0NvbnRyb2wnO1xuXHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5BY2s6IHJldHVybiAnQWNrJztcblx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuRGlzY29ubmVjdDogcmV0dXJuICdEaXNjb25uZWN0Jztcblx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuUmVwbGF5UmVxdWVzdDogcmV0dXJuICdSZXBsYXlSZXF1ZXN0Jztcblx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuUGF1c2U6IHJldHVybiAnUGF1c2VXcml0aW5nJztcblx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuUmVzdW1lOiByZXR1cm4gJ1Jlc3VtZVdyaXRpbmcnO1xuXHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5LZWVwQWxpdmU6IHJldHVybiAnS2VlcEFsaXZlJztcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBQcm90b2NvbENvbnN0YW50cyB7XG5cdEhlYWRlckxlbmd0aCA9IDEzLFxuXHQvKipcblx0ICogU2VuZCBhbiBBY2tub3dsZWRnZSBtZXNzYWdlIGF0IG1vc3QgMiBzZWNvbmRzIGxhdGVyLi4uXG5cdCAqL1xuXHRBY2tub3dsZWRnZVRpbWUgPSAyMDAwLCAvLyAyIHNlY29uZHNcblx0LyoqXG5cdCAqIElmIHRoZXJlIGlzIGEgc2VudCBtZXNzYWdlIHRoYXQgaGFzIGJlZW4gdW5hY2tub3dsZWRnZWQgZm9yIDIwIHNlY29uZHMsXG5cdCAqIGFuZCB3ZSBkaWRuJ3Qgc2VlIGFueSBpbmNvbWluZyBzZXJ2ZXIgZGF0YSBpbiB0aGUgcGFzdCAyMCBzZWNvbmRzLFxuXHQgKiB0aGVuIGNvbnNpZGVyIHRoZSBjb25uZWN0aW9uIGhhcyB0aW1lZCBvdXQuXG5cdCAqL1xuXHRUaW1lb3V0VGltZSA9IDIwMDAwLCAvLyAyMCBzZWNvbmRzXG5cdC8qKlxuXHQgKiBJZiB0aGVyZSBpcyBubyByZWNvbm5lY3Rpb24gd2l0aGluIHRoaXMgdGltZS1mcmFtZSwgY29uc2lkZXIgdGhlIGNvbm5lY3Rpb24gcGVybWFuZW50bHkgY2xvc2VkLi4uXG5cdCAqL1xuXHRSZWNvbm5lY3Rpb25HcmFjZVRpbWUgPSAzICogNjAgKiA2MCAqIDEwMDAsIC8vIDNocnNcblx0LyoqXG5cdCAqIE1heGltYWwgZ3JhY2UgdGltZSBiZXR3ZWVuIHRoZSBmaXJzdCBhbmQgdGhlIGxhc3QgcmVjb25uZWN0aW9uLi4uXG5cdCAqL1xuXHRSZWNvbm5lY3Rpb25TaG9ydEdyYWNlVGltZSA9IDUgKiA2MCAqIDEwMDAsIC8vIDVtaW5cblx0LyoqXG5cdCAqIFNlbmQgYSBtZXNzYWdlIGV2ZXJ5IDUgc2Vjb25kcyB0byBhdm9pZCB0aGF0IHRoZSBjb25uZWN0aW9uIGlzIGNsb3NlZCBieSB0aGUgT1MuXG5cdCAqL1xuXHRLZWVwQWxpdmVTZW5kVGltZSA9IDUwMDAsIC8vIDUgc2Vjb25kc1xufVxuXG5jbGFzcyBQcm90b2NvbE1lc3NhZ2Uge1xuXG5cdHB1YmxpYyB3cml0dGVuVGltZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB0eXBlOiBQcm90b2NvbE1lc3NhZ2VUeXBlLFxuXHRcdHB1YmxpYyByZWFkb25seSBpZDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBhY2s6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGF0YTogVlNCdWZmZXJcblx0KSB7XG5cdFx0dGhpcy53cml0dGVuVGltZSA9IDA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG5cdH1cbn1cblxuY2xhc3MgUHJvdG9jb2xSZWFkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zb2NrZXQ6IElTb2NrZXQ7XG5cdHByaXZhdGUgX2lzRGlzcG9zZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luY29taW5nRGF0YTogQ2h1bmtTdHJlYW07XG5cdHB1YmxpYyBsYXN0UmVhZFRpbWU6IG51bWJlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1lc3NhZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxQcm90b2NvbE1lc3NhZ2U+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25NZXNzYWdlOiBFdmVudDxQcm90b2NvbE1lc3NhZ2U+ID0gdGhpcy5fb25NZXNzYWdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0ge1xuXHRcdHJlYWRIZWFkOiB0cnVlLFxuXHRcdHJlYWRMZW46IFByb3RvY29sQ29uc3RhbnRzLkhlYWRlckxlbmd0aCxcblx0XHRtZXNzYWdlVHlwZTogUHJvdG9jb2xNZXNzYWdlVHlwZS5Ob25lLFxuXHRcdGlkOiAwLFxuXHRcdGFjazogMFxuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKHNvY2tldDogSVNvY2tldCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fc29ja2V0ID0gc29ja2V0O1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9pbmNvbWluZ0RhdGEgPSBuZXcgQ2h1bmtTdHJlYW0oKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zb2NrZXQub25EYXRhKGRhdGEgPT4gdGhpcy5hY2NlcHRDaHVuayhkYXRhKSkpO1xuXHRcdHRoaXMubGFzdFJlYWRUaW1lID0gRGF0ZS5ub3coKTtcblx0fVxuXG5cdHB1YmxpYyBhY2NlcHRDaHVuayhkYXRhOiBWU0J1ZmZlciB8IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoIWRhdGEgfHwgZGF0YS5ieXRlTGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0UmVhZFRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0dGhpcy5faW5jb21pbmdEYXRhLmFjY2VwdENodW5rKGRhdGEpO1xuXG5cdFx0d2hpbGUgKHRoaXMuX2luY29taW5nRGF0YS5ieXRlTGVuZ3RoID49IHRoaXMuX3N0YXRlLnJlYWRMZW4pIHtcblxuXHRcdFx0Y29uc3QgYnVmZiA9IHRoaXMuX2luY29taW5nRGF0YS5yZWFkKHRoaXMuX3N0YXRlLnJlYWRMZW4pO1xuXG5cdFx0XHRpZiAodGhpcy5fc3RhdGUucmVhZEhlYWQpIHtcblx0XHRcdFx0Ly8gYnVmZiBpcyB0aGUgaGVhZGVyXG5cblx0XHRcdFx0Ly8gc2F2ZSBuZXcgc3RhdGUgPT4gbmV4dCB0aW1lIHdpbGwgcmVhZCB0aGUgYm9keVxuXHRcdFx0XHR0aGlzLl9zdGF0ZS5yZWFkSGVhZCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5yZWFkTGVuID0gYnVmZi5yZWFkVUludDMyQkUoOSk7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLm1lc3NhZ2VUeXBlID0gYnVmZi5yZWFkVUludDgoMCk7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLmlkID0gYnVmZi5yZWFkVUludDMyQkUoMSk7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLmFjayA9IGJ1ZmYucmVhZFVJbnQzMkJFKDUpO1xuXG5cdFx0XHRcdHRoaXMuX3NvY2tldC50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLlByb3RvY29sSGVhZGVyUmVhZCwgeyBtZXNzYWdlVHlwZTogcHJvdG9jb2xNZXNzYWdlVHlwZVRvU3RyaW5nKHRoaXMuX3N0YXRlLm1lc3NhZ2VUeXBlKSwgaWQ6IHRoaXMuX3N0YXRlLmlkLCBhY2s6IHRoaXMuX3N0YXRlLmFjaywgbWVzc2FnZVNpemU6IHRoaXMuX3N0YXRlLnJlYWRMZW4gfSk7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGJ1ZmYgaXMgdGhlIGJvZHlcblx0XHRcdFx0Y29uc3QgbWVzc2FnZVR5cGUgPSB0aGlzLl9zdGF0ZS5tZXNzYWdlVHlwZTtcblx0XHRcdFx0Y29uc3QgaWQgPSB0aGlzLl9zdGF0ZS5pZDtcblx0XHRcdFx0Y29uc3QgYWNrID0gdGhpcy5fc3RhdGUuYWNrO1xuXG5cdFx0XHRcdC8vIHNhdmUgbmV3IHN0YXRlID0+IG5leHQgdGltZSB3aWxsIHJlYWQgdGhlIGhlYWRlclxuXHRcdFx0XHR0aGlzLl9zdGF0ZS5yZWFkSGVhZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLnJlYWRMZW4gPSBQcm90b2NvbENvbnN0YW50cy5IZWFkZXJMZW5ndGg7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLm1lc3NhZ2VUeXBlID0gUHJvdG9jb2xNZXNzYWdlVHlwZS5Ob25lO1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5pZCA9IDA7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLmFjayA9IDA7XG5cblx0XHRcdFx0dGhpcy5fc29ja2V0LnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuUHJvdG9jb2xNZXNzYWdlUmVhZCwgYnVmZik7XG5cblx0XHRcdFx0dGhpcy5fb25NZXNzYWdlLmZpcmUobmV3IFByb3RvY29sTWVzc2FnZShtZXNzYWdlVHlwZSwgaWQsIGFjaywgYnVmZikpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0Ly8gY2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgbGVhZCB0byBvdXIgZGlzcG9zYWxcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZWFkRW50aXJlQnVmZmVyKCk6IFZTQnVmZmVyIHtcblx0XHRyZXR1cm4gdGhpcy5faW5jb21pbmdEYXRhLnJlYWQodGhpcy5faW5jb21pbmdEYXRhLmJ5dGVMZW5ndGgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFByb3RvY29sV3JpdGVyIHtcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXHRwcml2YXRlIF9pc1BhdXNlZDogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfc29ja2V0OiBJU29ja2V0O1xuXHRwcml2YXRlIF9kYXRhOiBWU0J1ZmZlcltdO1xuXHRwcml2YXRlIF90b3RhbExlbmd0aDogbnVtYmVyO1xuXHRwdWJsaWMgbGFzdFdyaXRlVGltZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHNvY2tldDogSVNvY2tldCkge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9pc1BhdXNlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX3NvY2tldCA9IHNvY2tldDtcblx0XHR0aGlzLl9kYXRhID0gW107XG5cdFx0dGhpcy5fdG90YWxMZW5ndGggPSAwO1xuXHRcdHRoaXMubGFzdFdyaXRlVGltZSA9IDA7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gaWdub3JlIGVycm9yLCBzaW5jZSB0aGUgc29ja2V0IGNvdWxkIGJlIGFscmVhZHkgY2xvc2VkXG5cdFx0fVxuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHR9XG5cblx0cHVibGljIGRyYWluKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuZmx1c2goKTtcblx0XHRyZXR1cm4gdGhpcy5fc29ja2V0LmRyYWluKCk7XG5cdH1cblxuXHRwdWJsaWMgZmx1c2goKTogdm9pZCB7XG5cdFx0Ly8gZmx1c2hcblx0XHR0aGlzLl93cml0ZU5vdygpO1xuXHR9XG5cblx0cHVibGljIHBhdXNlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lzUGF1c2VkID0gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyByZXN1bWUoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNQYXVzZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9zY2hlZHVsZVdyaXRpbmcoKTtcblx0fVxuXG5cdHB1YmxpYyB3cml0ZShtc2c6IFByb3RvY29sTWVzc2FnZSkge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHQvLyBpZ25vcmU6IHRoZXJlIGNvdWxkIGJlIGxlZnQtb3ZlciBwcm9taXNlcyB3aGljaCBjb21wbGV0ZSBhbmQgdGhlblxuXHRcdFx0Ly8gZGVjaWRlIHRvIHdyaXRlIGEgcmVzcG9uc2UsIGV0Yy4uLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtc2cud3JpdHRlblRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMubGFzdFdyaXRlVGltZSA9IERhdGUubm93KCk7XG5cdFx0Y29uc3QgaGVhZGVyID0gVlNCdWZmZXIuYWxsb2MoUHJvdG9jb2xDb25zdGFudHMuSGVhZGVyTGVuZ3RoKTtcblx0XHRoZWFkZXIud3JpdGVVSW50OChtc2cudHlwZSwgMCk7XG5cdFx0aGVhZGVyLndyaXRlVUludDMyQkUobXNnLmlkLCAxKTtcblx0XHRoZWFkZXIud3JpdGVVSW50MzJCRShtc2cuYWNrLCA1KTtcblx0XHRoZWFkZXIud3JpdGVVSW50MzJCRShtc2cuZGF0YS5ieXRlTGVuZ3RoLCA5KTtcblxuXHRcdHRoaXMuX3NvY2tldC50cmFjZVNvY2tldEV2ZW50KFNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlLlByb3RvY29sSGVhZGVyV3JpdGUsIHsgbWVzc2FnZVR5cGU6IHByb3RvY29sTWVzc2FnZVR5cGVUb1N0cmluZyhtc2cudHlwZSksIGlkOiBtc2cuaWQsIGFjazogbXNnLmFjaywgbWVzc2FnZVNpemU6IG1zZy5kYXRhLmJ5dGVMZW5ndGggfSk7XG5cdFx0dGhpcy5fc29ja2V0LnRyYWNlU29ja2V0RXZlbnQoU29ja2V0RGlhZ25vc3RpY3NFdmVudFR5cGUuUHJvdG9jb2xNZXNzYWdlV3JpdGUsIG1zZy5kYXRhKTtcblxuXHRcdHRoaXMuX3dyaXRlU29vbihoZWFkZXIsIG1zZy5kYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgX2J1ZmZlckFkZChoZWFkOiBWU0J1ZmZlciwgYm9keTogVlNCdWZmZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCB3YXNFbXB0eSA9IHRoaXMuX3RvdGFsTGVuZ3RoID09PSAwO1xuXHRcdHRoaXMuX2RhdGEucHVzaChoZWFkLCBib2R5KTtcblx0XHR0aGlzLl90b3RhbExlbmd0aCArPSBoZWFkLmJ5dGVMZW5ndGggKyBib2R5LmJ5dGVMZW5ndGg7XG5cdFx0cmV0dXJuIHdhc0VtcHR5O1xuXHR9XG5cblx0cHJpdmF0ZSBfYnVmZmVyVGFrZSgpOiBWU0J1ZmZlciB7XG5cdFx0Y29uc3QgcmV0ID0gVlNCdWZmZXIuY29uY2F0KHRoaXMuX2RhdGEsIHRoaXMuX3RvdGFsTGVuZ3RoKTtcblx0XHR0aGlzLl9kYXRhLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy5fdG90YWxMZW5ndGggPSAwO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRwcml2YXRlIF93cml0ZVNvb24oaGVhZGVyOiBWU0J1ZmZlciwgZGF0YTogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fYnVmZmVyQWRkKGhlYWRlciwgZGF0YSkpIHtcblx0XHRcdHRoaXMuX3NjaGVkdWxlV3JpdGluZygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3dyaXRlTm93VGltZW91dDogYW55ID0gbnVsbDtcblx0cHJpdmF0ZSBfc2NoZWR1bGVXcml0aW5nKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93cml0ZU5vd1RpbWVvdXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fd3JpdGVOb3dUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl93cml0ZU5vd1RpbWVvdXQgPSBudWxsO1xuXHRcdFx0dGhpcy5fd3JpdGVOb3coKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3dyaXRlTm93KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90b3RhbExlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5faXNQYXVzZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2J1ZmZlclRha2UoKTtcblx0XHR0aGlzLl9zb2NrZXQudHJhY2VTb2NrZXRFdmVudChTb2NrZXREaWFnbm9zdGljc0V2ZW50VHlwZS5Qcm90b2NvbFdyaXRlLCB7IGJ5dGVMZW5ndGg6IGRhdGEuYnl0ZUxlbmd0aCB9KTtcblx0XHR0aGlzLl9zb2NrZXQud3JpdGUoZGF0YSk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIG1lc3NhZ2UgaGFzIHRoZSBmb2xsb3dpbmcgZm9ybWF0OlxuICogYGBgXG4gKiAgICAgLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS0tXFxcbiAqICAgICB8ICAgICAgICAgICAgIEhFQURFUiAgICAgICAgICAgIHwgICAgICB8XG4gKiAgICAgfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18IERBVEEgfFxuICogICAgIHwgVFlQRSB8IElEIHwgQUNLIHwgREFUQV9MRU5HVEggfCAgICAgIHxcbiAqICAgICBcXC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS0tL1xuICogYGBgXG4gKiBUaGUgaGVhZGVyIGlzIDkgYnl0ZXMgYW5kIGNvbnNpc3RzIG9mOlxuICogIC0gVFlQRSBpcyAxIGJ5dGUgKFByb3RvY29sTWVzc2FnZVR5cGUpIC0gdGhlIG1lc3NhZ2UgdHlwZVxuICogIC0gSUQgaXMgNCBieXRlcyAodTMyYmUpIC0gdGhlIG1lc3NhZ2UgaWQgKGNhbiBiZSAwIHRvIGluZGljYXRlIHRvIGJlIGlnbm9yZWQpXG4gKiAgLSBBQ0sgaXMgNCBieXRlcyAodTMyYmUpIC0gdGhlIGFja25vd2xlZGdlZCBtZXNzYWdlIGlkIChjYW4gYmUgMCB0byBpbmRpY2F0ZSB0byBiZSBpZ25vcmVkKVxuICogIC0gREFUQV9MRU5HVEggaXMgNCBieXRlcyAodTMyYmUpIC0gdGhlIGxlbmd0aCBpbiBieXRlcyBvZiBEQVRBXG4gKlxuICogT25seSBSZWd1bGFyIG1lc3NhZ2VzIGFyZSBjb3VudGVkLCBvdGhlciBtZXNzYWdlcyBhcmUgbm90IGNvdW50ZWQsIG5vciBhY2tub3dsZWRnZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBQcm90b2NvbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCB7XG5cblx0cHJpdmF0ZSBfc29ja2V0OiBJU29ja2V0O1xuXHRwcml2YXRlIF9zb2NrZXRXcml0ZXI6IFByb3RvY29sV3JpdGVyO1xuXHRwcml2YXRlIF9zb2NrZXRSZWFkZXI6IFByb3RvY29sUmVhZGVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTWVzc2FnZSA9IG5ldyBFbWl0dGVyPFZTQnVmZmVyPigpO1xuXHRyZWFkb25seSBvbk1lc3NhZ2U6IEV2ZW50PFZTQnVmZmVyPiA9IHRoaXMuX29uTWVzc2FnZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZERpc3Bvc2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWREaXNwb3NlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHNvY2tldDogSVNvY2tldCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fc29ja2V0ID0gc29ja2V0O1xuXHRcdHRoaXMuX3NvY2tldFdyaXRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm90b2NvbFdyaXRlcih0aGlzLl9zb2NrZXQpKTtcblx0XHR0aGlzLl9zb2NrZXRSZWFkZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUHJvdG9jb2xSZWFkZXIodGhpcy5fc29ja2V0KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zb2NrZXRSZWFkZXIub25NZXNzYWdlKChtc2cpID0+IHtcblx0XHRcdGlmIChtc2cudHlwZSA9PT0gUHJvdG9jb2xNZXNzYWdlVHlwZS5SZWd1bGFyKSB7XG5cdFx0XHRcdHRoaXMuX29uTWVzc2FnZS5maXJlKG1zZy5kYXRhKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zb2NrZXQub25DbG9zZSgoKSA9PiB0aGlzLl9vbkRpZERpc3Bvc2UuZmlyZSgpKSk7XG5cdH1cblxuXHRkcmFpbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fc29ja2V0V3JpdGVyLmRyYWluKCk7XG5cdH1cblxuXHRnZXRTb2NrZXQoKTogSVNvY2tldCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvY2tldDtcblx0fVxuXG5cdHNlbmREaXNjb25uZWN0KCk6IHZvaWQge1xuXHRcdC8vIE5vdGhpbmcgdG8gZG8uLi5cblx0fVxuXG5cdHNlbmQoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdHRoaXMuX3NvY2tldFdyaXRlci53cml0ZShuZXcgUHJvdG9jb2xNZXNzYWdlKFByb3RvY29sTWVzc2FnZVR5cGUuUmVndWxhciwgMCwgMCwgYnVmZmVyKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENsaWVudDxUQ29udGV4dCA9IHN0cmluZz4gZXh0ZW5kcyBJUENDbGllbnQ8VENvbnRleHQ+IHtcblxuXHRzdGF0aWMgZnJvbVNvY2tldDxUQ29udGV4dCA9IHN0cmluZz4oc29ja2V0OiBJU29ja2V0LCBpZDogVENvbnRleHQpOiBDbGllbnQ8VENvbnRleHQ+IHtcblx0XHRyZXR1cm4gbmV3IENsaWVudChuZXcgUHJvdG9jb2woc29ja2V0KSwgaWQpO1xuXHR9XG5cblx0Z2V0IG9uRGlkRGlzcG9zZSgpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLnByb3RvY29sLm9uRGlkRGlzcG9zZTsgfVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcHJvdG9jb2w6IFByb3RvY29sIHwgUGVyc2lzdGVudFByb3RvY29sLCBpZDogVENvbnRleHQsIGlwY0xvZ2dlcjogSUlQQ0xvZ2dlciB8IG51bGwgPSBudWxsKSB7XG5cdFx0c3VwZXIocHJvdG9jb2wsIGlkLCBpcGNMb2dnZXIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0Y29uc3Qgc29ja2V0ID0gdGhpcy5wcm90b2NvbC5nZXRTb2NrZXQoKTtcblx0XHQvLyBzaG91bGQgYmUgc2VudCBncmFjZWZ1bGx5IHdpdGggYSAuZmx1c2goKSwgYnV0IHRyeSB0byBzZW5kIGl0IG91dCBhcyBhXG5cdFx0Ly8gbGFzdCByZXNvcnQgaGVyZSBpZiBub3RoaW5nIGVsc2U6XG5cdFx0dGhpcy5wcm90b2NvbC5zZW5kRGlzY29ubmVjdCgpO1xuXHRcdHRoaXMucHJvdG9jb2wuZGlzcG9zZSgpO1xuXHRcdHNvY2tldC5lbmQoKTtcblx0fVxufVxuXG4vKipcbiAqIFdpbGwgZW5zdXJlIG5vIG1lc3NhZ2VzIGFyZSBsb3N0IGlmIHRoZXJlIGFyZSBubyBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBCdWZmZXJlZEVtaXR0ZXI8VD4ge1xuXHRwcml2YXRlIF9lbWl0dGVyOiBFbWl0dGVyPFQ+O1xuXHRwdWJsaWMgcmVhZG9ubHkgZXZlbnQ6IEV2ZW50PFQ+O1xuXG5cdHByaXZhdGUgX2hhc0xpc3RlbmVycyA9IGZhbHNlO1xuXHRwcml2YXRlIF9pc0RlbGl2ZXJpbmdNZXNzYWdlcyA9IGZhbHNlO1xuXHRwcml2YXRlIF9idWZmZXJlZE1lc3NhZ2VzOiBUW10gPSBbXTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9lbWl0dGVyID0gbmV3IEVtaXR0ZXI8VD4oe1xuXHRcdFx0b25XaWxsQWRkRmlyc3RMaXN0ZW5lcjogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9oYXNMaXN0ZW5lcnMgPSB0cnVlO1xuXHRcdFx0XHQvLyBpdCBpcyBpbXBvcnRhbnQgdG8gZGVsaXZlciB0aGVzZSBtZXNzYWdlcyBhZnRlciB0aGlzIGNhbGwsIGJ1dCBiZWZvcmVcblx0XHRcdFx0Ly8gb3RoZXIgbWVzc2FnZXMgaGF2ZSBhIGNoYW5jZSB0byBiZSByZWNlaXZlZCAodG8gZ3VhcmFudGVlIGluIG9yZGVyIGRlbGl2ZXJ5KVxuXHRcdFx0XHQvLyB0aGF0J3Mgd2h5IHdlJ3JlIHVzaW5nIGhlcmUgcXVldWVNaWNyb3Rhc2sgYW5kIG5vdCBvdGhlciB0eXBlcyBvZiB0aW1lb3V0c1xuXHRcdFx0XHRxdWV1ZU1pY3JvdGFzaygoKSA9PiB0aGlzLl9kZWxpdmVyTWVzc2FnZXMoKSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5faGFzTGlzdGVuZXJzID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmV2ZW50ID0gdGhpcy5fZW1pdHRlci5ldmVudDtcblx0fVxuXG5cdHByaXZhdGUgX2RlbGl2ZXJNZXNzYWdlcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEZWxpdmVyaW5nTWVzc2FnZXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faXNEZWxpdmVyaW5nTWVzc2FnZXMgPSB0cnVlO1xuXHRcdHdoaWxlICh0aGlzLl9oYXNMaXN0ZW5lcnMgJiYgdGhpcy5fYnVmZmVyZWRNZXNzYWdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9lbWl0dGVyLmZpcmUodGhpcy5fYnVmZmVyZWRNZXNzYWdlcy5zaGlmdCgpISk7XG5cdFx0fVxuXHRcdHRoaXMuX2lzRGVsaXZlcmluZ01lc3NhZ2VzID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZmlyZShldmVudDogVCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9oYXNMaXN0ZW5lcnMpIHtcblx0XHRcdGlmICh0aGlzLl9idWZmZXJlZE1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5fYnVmZmVyZWRNZXNzYWdlcy5wdXNoKGV2ZW50KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2VtaXR0ZXIuZmlyZShldmVudCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2J1ZmZlcmVkTWVzc2FnZXMucHVzaChldmVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGZsdXNoQnVmZmVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX2J1ZmZlcmVkTWVzc2FnZXMgPSBbXTtcblx0fVxufVxuXG5jbGFzcyBRdWV1ZUVsZW1lbnQ8VD4ge1xuXHRwdWJsaWMgcmVhZG9ubHkgZGF0YTogVDtcblx0cHVibGljIG5leHQ6IFF1ZXVlRWxlbWVudDxUPiB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoZGF0YTogVCkge1xuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0dGhpcy5uZXh0ID0gbnVsbDtcblx0fVxufVxuXG5jbGFzcyBRdWV1ZTxUPiB7XG5cblx0cHJpdmF0ZSBfZmlyc3Q6IFF1ZXVlRWxlbWVudDxUPiB8IG51bGw7XG5cdHByaXZhdGUgX2xhc3Q6IFF1ZXVlRWxlbWVudDxUPiB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fZmlyc3QgPSBudWxsO1xuXHRcdHRoaXMuX2xhc3QgPSBudWxsO1xuXHR9XG5cblx0cHVibGljIGxlbmd0aCgpOiBudW1iZXIge1xuXHRcdGxldCByZXN1bHQgPSAwO1xuXHRcdGxldCBjdXJyZW50ID0gdGhpcy5fZmlyc3Q7XG5cdFx0d2hpbGUgKGN1cnJlbnQpIHtcblx0XHRcdGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG5cdFx0XHRyZXN1bHQrKztcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBwZWVrKCk6IFQgfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX2ZpcnN0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2ZpcnN0LmRhdGE7XG5cdH1cblxuXHRwdWJsaWMgdG9BcnJheSgpOiBUW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogVFtdID0gW107XG5cdFx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdFx0bGV0IGl0ID0gdGhpcy5fZmlyc3Q7XG5cdFx0d2hpbGUgKGl0KSB7XG5cdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gaXQuZGF0YTtcblx0XHRcdGl0ID0gaXQubmV4dDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBwb3AoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9maXJzdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZmlyc3QgPT09IHRoaXMuX2xhc3QpIHtcblx0XHRcdHRoaXMuX2ZpcnN0ID0gbnVsbDtcblx0XHRcdHRoaXMuX2xhc3QgPSBudWxsO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9maXJzdCA9IHRoaXMuX2ZpcnN0Lm5leHQ7XG5cdH1cblxuXHRwdWJsaWMgcHVzaChpdGVtOiBUKTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IG5ldyBRdWV1ZUVsZW1lbnQoaXRlbSk7XG5cdFx0aWYgKCF0aGlzLl9maXJzdCkge1xuXHRcdFx0dGhpcy5fZmlyc3QgPSBlbGVtZW50O1xuXHRcdFx0dGhpcy5fbGFzdCA9IGVsZW1lbnQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3QhLm5leHQgPSBlbGVtZW50O1xuXHRcdHRoaXMuX2xhc3QgPSBlbGVtZW50O1xuXHR9XG59XG5cbmNsYXNzIExvYWRFc3RpbWF0b3Ige1xuXG5cdHByaXZhdGUgc3RhdGljIF9ISVNUT1JZX0xFTkdUSCA9IDEwO1xuXHRwcml2YXRlIHN0YXRpYyBfSU5TVEFOQ0U6IExvYWRFc3RpbWF0b3IgfCBudWxsID0gbnVsbDtcblx0cHVibGljIHN0YXRpYyBnZXRJbnN0YW5jZSgpOiBMb2FkRXN0aW1hdG9yIHtcblx0XHRpZiAoIUxvYWRFc3RpbWF0b3IuX0lOU1RBTkNFKSB7XG5cdFx0XHRMb2FkRXN0aW1hdG9yLl9JTlNUQU5DRSA9IG5ldyBMb2FkRXN0aW1hdG9yKCk7XG5cdFx0fVxuXHRcdHJldHVybiBMb2FkRXN0aW1hdG9yLl9JTlNUQU5DRTtcblx0fVxuXG5cdHByaXZhdGUgbGFzdFJ1bnM6IG51bWJlcltdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubGFzdFJ1bnMgPSBbXTtcblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgTG9hZEVzdGltYXRvci5fSElTVE9SWV9MRU5HVEg7IGkrKykge1xuXHRcdFx0dGhpcy5sYXN0UnVuc1tpXSA9IG5vdyAtIDEwMDAgKiBpO1xuXHRcdH1cblx0XHRzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gTG9hZEVzdGltYXRvci5fSElTVE9SWV9MRU5HVEg7IGkgPj0gMTsgaS0tKSB7XG5cdFx0XHRcdHRoaXMubGFzdFJ1bnNbaV0gPSB0aGlzLmxhc3RSdW5zW2kgLSAxXTtcblx0XHRcdH1cblx0XHRcdHRoaXMubGFzdFJ1bnNbMF0gPSBEYXRlLm5vdygpO1xuXHRcdH0sIDEwMDApO1xuXHR9XG5cblx0LyoqXG5cdCAqIHJldHVybnMgYW4gZXN0aW1hdGl2ZSBudW1iZXIsIGZyb20gMCAobG93IGxvYWQpIHRvIDEgKGhpZ2ggbG9hZClcblx0ICovXG5cdHByaXZhdGUgbG9hZCgpOiBudW1iZXIge1xuXHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0Y29uc3QgaGlzdG9yeUxpbWl0ID0gKDEgKyBMb2FkRXN0aW1hdG9yLl9ISVNUT1JZX0xFTkdUSCkgKiAxMDAwO1xuXHRcdGxldCBzY29yZSA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBMb2FkRXN0aW1hdG9yLl9ISVNUT1JZX0xFTkdUSDsgaSsrKSB7XG5cdFx0XHRpZiAobm93IC0gdGhpcy5sYXN0UnVuc1tpXSA8PSBoaXN0b3J5TGltaXQpIHtcblx0XHRcdFx0c2NvcmUrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIDEgLSBzY29yZSAvIExvYWRFc3RpbWF0b3IuX0hJU1RPUllfTEVOR1RIO1xuXHR9XG5cblx0cHVibGljIGhhc0hpZ2hMb2FkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmxvYWQoKSA+PSAwLjU7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTG9hZEVzdGltYXRvciB7XG5cdGhhc0hpZ2hMb2FkKCk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVyc2lzdGVudFByb3RvY29sT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBUaGUgc29ja2V0IHRvIHVzZS5cblx0ICovXG5cdHNvY2tldDogSVNvY2tldDtcblx0LyoqXG5cdCAqIFRoZSBpbml0aWFsIGNodW5rIG9mIGRhdGEgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHJlY2VpdmVkIGZyb20gdGhlIHNvY2tldC5cblx0ICovXG5cdGluaXRpYWxDaHVuaz86IFZTQnVmZmVyIHwgbnVsbDtcblx0LyoqXG5cdCAqIFRoZSBDUFUgbG9hZCBlc3RpbWF0b3IgdG8gdXNlLlxuXHQgKi9cblx0bG9hZEVzdGltYXRvcj86IElMb2FkRXN0aW1hdG9yO1xuXHQvKipcblx0ICogV2hldGhlciB0byBzZW5kIGtlZXAgYWxpdmUgbWVzc2FnZXMuIERlZmF1bHRzIHRvIHRydWUuXG5cdCAqL1xuXHRzZW5kS2VlcEFsaXZlPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBTYW1lIGFzIFByb3RvY29sLCBidXQgd2lsbCBhY3R1YWxseSB0cmFjayBtZXNzYWdlcyBhbmQgYWNrcy5cbiAqIE1vcmVvdmVyLCBpdCB3aWxsIGVuc3VyZSBubyBtZXNzYWdlcyBhcmUgbG9zdCBpZiB0aGVyZSBhcmUgbm8gZXZlbnQgbGlzdGVuZXJzLlxuICovXG5leHBvcnQgY2xhc3MgUGVyc2lzdGVudFByb3RvY29sIGltcGxlbWVudHMgSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wge1xuXG5cdHByaXZhdGUgX2lzUmVjb25uZWN0aW5nOiBib29sZWFuO1xuXHRwcml2YXRlIF9kaWRTZW5kRGlzY29ubmVjdD86IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfb3V0Z29pbmdVbmFja01zZzogUXVldWU8UHJvdG9jb2xNZXNzYWdlPjtcblx0cHJpdmF0ZSBfb3V0Z29pbmdNc2dJZDogbnVtYmVyO1xuXHRwcml2YXRlIF9vdXRnb2luZ0Fja0lkOiBudW1iZXI7XG5cdHByaXZhdGUgX291dGdvaW5nQWNrVGltZW91dDogYW55IHwgbnVsbDtcblxuXHRwcml2YXRlIF9pbmNvbWluZ01zZ0lkOiBudW1iZXI7XG5cdHByaXZhdGUgX2luY29taW5nQWNrSWQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfaW5jb21pbmdNc2dMYXN0VGltZTogbnVtYmVyO1xuXHRwcml2YXRlIF9pbmNvbWluZ0Fja1RpbWVvdXQ6IGFueSB8IG51bGw7XG5cblx0cHJpdmF0ZSBfa2VlcEFsaXZlSW50ZXJ2YWw6IGFueSB8IG51bGw7XG5cblx0cHJpdmF0ZSBfbGFzdFJlcGxheVJlcXVlc3RUaW1lOiBudW1iZXI7XG5cdHByaXZhdGUgX2xhc3RTb2NrZXRUaW1lb3V0VGltZTogbnVtYmVyO1xuXG5cdHByaXZhdGUgX3NvY2tldDogSVNvY2tldDtcblx0cHJpdmF0ZSBfc29ja2V0V3JpdGVyOiBQcm90b2NvbFdyaXRlcjtcblx0cHJpdmF0ZSBfc29ja2V0UmVhZGVyOiBQcm90b2NvbFJlYWRlcjtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tcG90ZW50aWFsbHktdW5zYWZlLWRpc3Bvc2FibGVzXG5cdHByaXZhdGUgX3NvY2tldERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbG9hZEVzdGltYXRvcjogSUxvYWRFc3RpbWF0b3I7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nob3VsZFNlbmRLZWVwQWxpdmU6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Db250cm9sTWVzc2FnZSA9IG5ldyBCdWZmZXJlZEVtaXR0ZXI8VlNCdWZmZXI+KCk7XG5cdHJlYWRvbmx5IG9uQ29udHJvbE1lc3NhZ2U6IEV2ZW50PFZTQnVmZmVyPiA9IHRoaXMuX29uQ29udHJvbE1lc3NhZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25NZXNzYWdlID0gbmV3IEJ1ZmZlcmVkRW1pdHRlcjxWU0J1ZmZlcj4oKTtcblx0cmVhZG9ubHkgb25NZXNzYWdlOiBFdmVudDxWU0J1ZmZlcj4gPSB0aGlzLl9vbk1lc3NhZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREaXNwb3NlID0gbmV3IEJ1ZmZlcmVkRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWREaXNwb3NlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU29ja2V0Q2xvc2UgPSBuZXcgQnVmZmVyZWRFbWl0dGVyPFNvY2tldENsb3NlRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uU29ja2V0Q2xvc2U6IEV2ZW50PFNvY2tldENsb3NlRXZlbnQ+ID0gdGhpcy5fb25Tb2NrZXRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblNvY2tldFRpbWVvdXQgPSBuZXcgQnVmZmVyZWRFbWl0dGVyPFNvY2tldFRpbWVvdXRFdmVudD4oKTtcblx0cmVhZG9ubHkgb25Tb2NrZXRUaW1lb3V0OiBFdmVudDxTb2NrZXRUaW1lb3V0RXZlbnQ+ID0gdGhpcy5fb25Tb2NrZXRUaW1lb3V0LmV2ZW50O1xuXG5cdHB1YmxpYyBnZXQgdW5hY2tub3dsZWRnZWRDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9vdXRnb2luZ01zZ0lkIC0gdGhpcy5fb3V0Z29pbmdBY2tJZDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKG9wdHM6IFBlcnNpc3RlbnRQcm90b2NvbE9wdGlvbnMpIHtcblx0XHR0aGlzLl9sb2FkRXN0aW1hdG9yID0gb3B0cy5sb2FkRXN0aW1hdG9yID8/IExvYWRFc3RpbWF0b3IuZ2V0SW5zdGFuY2UoKTtcblx0XHR0aGlzLl9zaG91bGRTZW5kS2VlcEFsaXZlID0gb3B0cy5zZW5kS2VlcEFsaXZlID8/IHRydWU7XG5cdFx0dGhpcy5faXNSZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0XHR0aGlzLl9vdXRnb2luZ1VuYWNrTXNnID0gbmV3IFF1ZXVlPFByb3RvY29sTWVzc2FnZT4oKTtcblx0XHR0aGlzLl9vdXRnb2luZ01zZ0lkID0gMDtcblx0XHR0aGlzLl9vdXRnb2luZ0Fja0lkID0gMDtcblx0XHR0aGlzLl9vdXRnb2luZ0Fja1RpbWVvdXQgPSBudWxsO1xuXG5cdFx0dGhpcy5faW5jb21pbmdNc2dJZCA9IDA7XG5cdFx0dGhpcy5faW5jb21pbmdBY2tJZCA9IDA7XG5cdFx0dGhpcy5faW5jb21pbmdNc2dMYXN0VGltZSA9IDA7XG5cdFx0dGhpcy5faW5jb21pbmdBY2tUaW1lb3V0ID0gbnVsbDtcblxuXHRcdHRoaXMuX2xhc3RSZXBsYXlSZXF1ZXN0VGltZSA9IDA7XG5cdFx0dGhpcy5fbGFzdFNvY2tldFRpbWVvdXRUaW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdHRoaXMuX3NvY2tldERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuX3NvY2tldCA9IG9wdHMuc29ja2V0O1xuXHRcdHRoaXMuX3NvY2tldFdyaXRlciA9IHRoaXMuX3NvY2tldERpc3Bvc2FibGVzLmFkZChuZXcgUHJvdG9jb2xXcml0ZXIodGhpcy5fc29ja2V0KSk7XG5cdFx0dGhpcy5fc29ja2V0UmVhZGVyID0gdGhpcy5fc29ja2V0RGlzcG9zYWJsZXMuYWRkKG5ldyBQcm90b2NvbFJlYWRlcih0aGlzLl9zb2NrZXQpKTtcblx0XHR0aGlzLl9zb2NrZXREaXNwb3NhYmxlcy5hZGQodGhpcy5fc29ja2V0UmVhZGVyLm9uTWVzc2FnZShtc2cgPT4gdGhpcy5fcmVjZWl2ZU1lc3NhZ2UobXNnKSkpO1xuXHRcdHRoaXMuX3NvY2tldERpc3Bvc2FibGVzLmFkZCh0aGlzLl9zb2NrZXQub25DbG9zZShlID0+IHRoaXMuX29uU29ja2V0Q2xvc2UuZmlyZShlKSkpO1xuXG5cdFx0aWYgKG9wdHMuaW5pdGlhbENodW5rKSB7XG5cdFx0XHR0aGlzLl9zb2NrZXRSZWFkZXIuYWNjZXB0Q2h1bmsob3B0cy5pbml0aWFsQ2h1bmspO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zaG91bGRTZW5kS2VlcEFsaXZlKSB7XG5cdFx0XHR0aGlzLl9rZWVwQWxpdmVJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fc2VuZEtlZXBBbGl2ZSgpO1xuXHRcdFx0fSwgUHJvdG9jb2xDb25zdGFudHMuS2VlcEFsaXZlU2VuZFRpbWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9rZWVwQWxpdmVJbnRlcnZhbCA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fb3V0Z29pbmdBY2tUaW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fb3V0Z29pbmdBY2tUaW1lb3V0KTtcblx0XHRcdHRoaXMuX291dGdvaW5nQWNrVGltZW91dCA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pbmNvbWluZ0Fja1RpbWVvdXQpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9pbmNvbWluZ0Fja1RpbWVvdXQpO1xuXHRcdFx0dGhpcy5faW5jb21pbmdBY2tUaW1lb3V0ID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2tlZXBBbGl2ZUludGVydmFsKSB7XG5cdFx0XHRjbGVhckludGVydmFsKHRoaXMuX2tlZXBBbGl2ZUludGVydmFsKTtcblx0XHRcdHRoaXMuX2tlZXBBbGl2ZUludGVydmFsID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5fc29ja2V0RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZHJhaW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvY2tldFdyaXRlci5kcmFpbigpO1xuXHR9XG5cblx0c2VuZERpc2Nvbm5lY3QoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9kaWRTZW5kRGlzY29ubmVjdCkge1xuXHRcdFx0dGhpcy5fZGlkU2VuZERpc2Nvbm5lY3QgPSB0cnVlO1xuXHRcdFx0Y29uc3QgbXNnID0gbmV3IFByb3RvY29sTWVzc2FnZShQcm90b2NvbE1lc3NhZ2VUeXBlLkRpc2Nvbm5lY3QsIDAsIDAsIGdldEVtcHR5QnVmZmVyKCkpO1xuXHRcdFx0dGhpcy5fc29ja2V0V3JpdGVyLndyaXRlKG1zZyk7XG5cdFx0XHR0aGlzLl9zb2NrZXRXcml0ZXIuZmx1c2goKTtcblx0XHR9XG5cdH1cblxuXHRzZW5kUGF1c2UoKTogdm9pZCB7XG5cdFx0Y29uc3QgbXNnID0gbmV3IFByb3RvY29sTWVzc2FnZShQcm90b2NvbE1lc3NhZ2VUeXBlLlBhdXNlLCAwLCAwLCBnZXRFbXB0eUJ1ZmZlcigpKTtcblx0XHR0aGlzLl9zb2NrZXRXcml0ZXIud3JpdGUobXNnKTtcblx0fVxuXG5cdHNlbmRSZXN1bWUoKTogdm9pZCB7XG5cdFx0Y29uc3QgbXNnID0gbmV3IFByb3RvY29sTWVzc2FnZShQcm90b2NvbE1lc3NhZ2VUeXBlLlJlc3VtZSwgMCwgMCwgZ2V0RW1wdHlCdWZmZXIoKSk7XG5cdFx0dGhpcy5fc29ja2V0V3JpdGVyLndyaXRlKG1zZyk7XG5cdH1cblxuXHRwYXVzZVNvY2tldFdyaXRpbmcoKSB7XG5cdFx0dGhpcy5fc29ja2V0V3JpdGVyLnBhdXNlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U29ja2V0KCk6IElTb2NrZXQge1xuXHRcdHJldHVybiB0aGlzLl9zb2NrZXQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIERhdGUubm93KCkgLSB0aGlzLl9zb2NrZXRSZWFkZXIubGFzdFJlYWRUaW1lO1xuXHR9XG5cblx0cHVibGljIGJlZ2luQWNjZXB0UmVjb25uZWN0aW9uKHNvY2tldDogSVNvY2tldCwgaW5pdGlhbERhdGFDaHVuazogVlNCdWZmZXIgfCBudWxsKTogdm9pZCB7XG5cdFx0dGhpcy5faXNSZWNvbm5lY3RpbmcgPSB0cnVlO1xuXG5cdFx0dGhpcy5fc29ja2V0RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3NvY2tldERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuX29uQ29udHJvbE1lc3NhZ2UuZmx1c2hCdWZmZXIoKTtcblx0XHR0aGlzLl9vblNvY2tldENsb3NlLmZsdXNoQnVmZmVyKCk7XG5cdFx0dGhpcy5fb25Tb2NrZXRUaW1lb3V0LmZsdXNoQnVmZmVyKCk7XG5cdFx0dGhpcy5fc29ja2V0LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2xhc3RSZXBsYXlSZXF1ZXN0VGltZSA9IDA7XG5cdFx0dGhpcy5fbGFzdFNvY2tldFRpbWVvdXRUaW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdHRoaXMuX3NvY2tldCA9IHNvY2tldDtcblx0XHR0aGlzLl9zb2NrZXRXcml0ZXIgPSB0aGlzLl9zb2NrZXREaXNwb3NhYmxlcy5hZGQobmV3IFByb3RvY29sV3JpdGVyKHRoaXMuX3NvY2tldCkpO1xuXHRcdHRoaXMuX3NvY2tldFJlYWRlciA9IHRoaXMuX3NvY2tldERpc3Bvc2FibGVzLmFkZChuZXcgUHJvdG9jb2xSZWFkZXIodGhpcy5fc29ja2V0KSk7XG5cdFx0dGhpcy5fc29ja2V0RGlzcG9zYWJsZXMuYWRkKHRoaXMuX3NvY2tldFJlYWRlci5vbk1lc3NhZ2UobXNnID0+IHRoaXMuX3JlY2VpdmVNZXNzYWdlKG1zZykpKTtcblx0XHR0aGlzLl9zb2NrZXREaXNwb3NhYmxlcy5hZGQodGhpcy5fc29ja2V0Lm9uQ2xvc2UoZSA9PiB0aGlzLl9vblNvY2tldENsb3NlLmZpcmUoZSkpKTtcblxuXHRcdHRoaXMuX3NvY2tldFJlYWRlci5hY2NlcHRDaHVuayhpbml0aWFsRGF0YUNodW5rKTtcblx0fVxuXG5cdHB1YmxpYyBlbmRBY2NlcHRSZWNvbm5lY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5faXNSZWNvbm5lY3RpbmcgPSBmYWxzZTtcblxuXHRcdC8vIEFmdGVyIGEgcmVjb25uZWN0aW9uLCBsZXQgdGhlIG90aGVyIHBhcnR5IGtub3cgKGFnYWluKSB3aGljaCBtZXNzYWdlcyBoYXZlIGJlZW4gcmVjZWl2ZWQuXG5cdFx0Ly8gKHBlcmhhcHMgdGhlIG90aGVyIHBhcnR5IGRpZG4ndCByZWNlaXZlIGEgcHJldmlvdXMgQUNLKVxuXHRcdHRoaXMuX2luY29taW5nQWNrSWQgPSB0aGlzLl9pbmNvbWluZ01zZ0lkO1xuXHRcdGNvbnN0IG1zZyA9IG5ldyBQcm90b2NvbE1lc3NhZ2UoUHJvdG9jb2xNZXNzYWdlVHlwZS5BY2ssIDAsIHRoaXMuX2luY29taW5nQWNrSWQsIGdldEVtcHR5QnVmZmVyKCkpO1xuXHRcdHRoaXMuX3NvY2tldFdyaXRlci53cml0ZShtc2cpO1xuXG5cdFx0Ly8gU2VuZCBhZ2FpbiBhbGwgdW5hY2tub3dsZWRnZWQgbWVzc2FnZXNcblx0XHRjb25zdCB0b1NlbmQgPSB0aGlzLl9vdXRnb2luZ1VuYWNrTXNnLnRvQXJyYXkoKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdG9TZW5kLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHR0aGlzLl9zb2NrZXRXcml0ZXIud3JpdGUodG9TZW5kW2ldKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVjdkFja0NoZWNrKCk7XG5cdH1cblxuXHRwdWJsaWMgYWNjZXB0RGlzY29ubmVjdCgpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZERpc3Bvc2UuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVjZWl2ZU1lc3NhZ2UobXNnOiBQcm90b2NvbE1lc3NhZ2UpOiB2b2lkIHtcblx0XHRpZiAobXNnLmFjayA+IHRoaXMuX291dGdvaW5nQWNrSWQpIHtcblx0XHRcdHRoaXMuX291dGdvaW5nQWNrSWQgPSBtc2cuYWNrO1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRjb25zdCBmaXJzdCA9IHRoaXMuX291dGdvaW5nVW5hY2tNc2cucGVlaygpO1xuXHRcdFx0XHRpZiAoZmlyc3QgJiYgZmlyc3QuaWQgPD0gbXNnLmFjaykge1xuXHRcdFx0XHRcdC8vIHRoaXMgbWVzc2FnZSBoYXMgYmVlbiBjb25maXJtZWQsIHJlbW92ZSBpdFxuXHRcdFx0XHRcdHRoaXMuX291dGdvaW5nVW5hY2tNc2cucG9wKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKHRydWUpO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAobXNnLnR5cGUpIHtcblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5Ob25lOiB7XG5cdFx0XHRcdC8vIE4vQVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5SZWd1bGFyOiB7XG5cdFx0XHRcdGlmIChtc2cuaWQgPiB0aGlzLl9pbmNvbWluZ01zZ0lkKSB7XG5cdFx0XHRcdFx0aWYgKG1zZy5pZCAhPT0gdGhpcy5faW5jb21pbmdNc2dJZCArIDEpIHtcblx0XHRcdFx0XHRcdC8vIGluIGNhc2Ugd2UgbWlzc2VkIHNvbWUgbWVzc2FnZXMgd2UgYXNrIHRoZSBvdGhlciBwYXJ0eSB0byByZXNlbmQgdGhlbVxuXHRcdFx0XHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0XHRcdGlmIChub3cgLSB0aGlzLl9sYXN0UmVwbGF5UmVxdWVzdFRpbWUgPiAxMDAwMCkge1xuXHRcdFx0XHRcdFx0XHQvLyBzZW5kIGEgcmVwbGF5IHJlcXVlc3QgYXQgbW9zdCBvbmNlIGV2ZXJ5IDEwc1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sYXN0UmVwbGF5UmVxdWVzdFRpbWUgPSBub3c7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3NvY2tldFdyaXRlci53cml0ZShuZXcgUHJvdG9jb2xNZXNzYWdlKFByb3RvY29sTWVzc2FnZVR5cGUuUmVwbGF5UmVxdWVzdCwgMCwgMCwgZ2V0RW1wdHlCdWZmZXIoKSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbmNvbWluZ01zZ0lkID0gbXNnLmlkO1xuXHRcdFx0XHRcdFx0dGhpcy5faW5jb21pbmdNc2dMYXN0VGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdFx0XHR0aGlzLl9zZW5kQWNrQ2hlY2soKTtcblx0XHRcdFx0XHRcdHRoaXMuX29uTWVzc2FnZS5maXJlKG1zZy5kYXRhKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuQ29udHJvbDoge1xuXHRcdFx0XHR0aGlzLl9vbkNvbnRyb2xNZXNzYWdlLmZpcmUobXNnLmRhdGEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5BY2s6IHtcblx0XHRcdFx0Ly8gbm90aGluZyB0byBkbywgLmFjayBpcyBoYW5kbGVkIGFib3ZlIGFscmVhZHlcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFByb3RvY29sTWVzc2FnZVR5cGUuRGlzY29ubmVjdDoge1xuXHRcdFx0XHR0aGlzLl9vbkRpZERpc3Bvc2UuZmlyZSgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5SZXBsYXlSZXF1ZXN0OiB7XG5cdFx0XHRcdC8vIFNlbmQgYWdhaW4gYWxsIHVuYWNrbm93bGVkZ2VkIG1lc3NhZ2VzXG5cdFx0XHRcdGNvbnN0IHRvU2VuZCA9IHRoaXMuX291dGdvaW5nVW5hY2tNc2cudG9BcnJheSgpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdG9TZW5kLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0dGhpcy5fc29ja2V0V3JpdGVyLndyaXRlKHRvU2VuZFtpXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcmVjdkFja0NoZWNrKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBQcm90b2NvbE1lc3NhZ2VUeXBlLlBhdXNlOiB7XG5cdFx0XHRcdHRoaXMuX3NvY2tldFdyaXRlci5wYXVzZSgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5SZXN1bWU6IHtcblx0XHRcdFx0dGhpcy5fc29ja2V0V3JpdGVyLnJlc3VtZSgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvdG9jb2xNZXNzYWdlVHlwZS5LZWVwQWxpdmU6IHtcblx0XHRcdFx0Ly8gbm90aGluZyB0byBkb1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZWFkRW50aXJlQnVmZmVyKCk6IFZTQnVmZmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fc29ja2V0UmVhZGVyLnJlYWRFbnRpcmVCdWZmZXIoKTtcblx0fVxuXG5cdGZsdXNoKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NvY2tldFdyaXRlci5mbHVzaCgpO1xuXHR9XG5cblx0c2VuZChidWZmZXI6IFZTQnVmZmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbXlJZCA9ICsrdGhpcy5fb3V0Z29pbmdNc2dJZDtcblx0XHR0aGlzLl9pbmNvbWluZ0Fja0lkID0gdGhpcy5faW5jb21pbmdNc2dJZDtcblx0XHRjb25zdCBtc2cgPSBuZXcgUHJvdG9jb2xNZXNzYWdlKFByb3RvY29sTWVzc2FnZVR5cGUuUmVndWxhciwgbXlJZCwgdGhpcy5faW5jb21pbmdBY2tJZCwgYnVmZmVyKTtcblx0XHR0aGlzLl9vdXRnb2luZ1VuYWNrTXNnLnB1c2gobXNnKTtcblx0XHRpZiAoIXRoaXMuX2lzUmVjb25uZWN0aW5nKSB7XG5cdFx0XHR0aGlzLl9zb2NrZXRXcml0ZXIud3JpdGUobXNnKTtcblx0XHRcdHRoaXMuX3JlY3ZBY2tDaGVjaygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgbWVzc2FnZSB3aGljaCB3aWxsIG5vdCBiZSBwYXJ0IG9mIHRoZSByZWd1bGFyIGFja25vd2xlZGdlIGZsb3cuXG5cdCAqIFVzZSB0aGlzIGZvciBlYXJseSBjb250cm9sIG1lc3NhZ2VzIHdoaWNoIGFyZSByZXBlYXRlZCBpbiBjYXNlIG9mIHJlY29ubmVjdGlvbi5cblx0ICovXG5cdHNlbmRDb250cm9sKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRjb25zdCBtc2cgPSBuZXcgUHJvdG9jb2xNZXNzYWdlKFByb3RvY29sTWVzc2FnZVR5cGUuQ29udHJvbCwgMCwgMCwgYnVmZmVyKTtcblx0XHR0aGlzLl9zb2NrZXRXcml0ZXIud3JpdGUobXNnKTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRBY2tDaGVjaygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5jb21pbmdNc2dJZCA8PSB0aGlzLl9pbmNvbWluZ0Fja0lkKSB7XG5cdFx0XHQvLyBub3RoaW5rIHRvIGFja25vd2xlZGdlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2luY29taW5nQWNrVGltZW91dCkge1xuXHRcdFx0Ly8gdGhlcmUgd2lsbCBiZSBhIGNoZWNrIGluIHRoZSBuZWFyIGZ1dHVyZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpbWVTaW5jZUxhc3RJbmNvbWluZ01zZyA9IERhdGUubm93KCkgLSB0aGlzLl9pbmNvbWluZ01zZ0xhc3RUaW1lO1xuXHRcdGlmICh0aW1lU2luY2VMYXN0SW5jb21pbmdNc2cgPj0gUHJvdG9jb2xDb25zdGFudHMuQWNrbm93bGVkZ2VUaW1lKSB7XG5cdFx0XHQvLyBzdWZmaWNpZW50IHRpbWUgaGFzIHBhc3NlZCBzaW5jZSB0aGlzIG1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQsXG5cdFx0XHQvLyBhbmQgbm8gbWVzc2FnZSBmcm9tIG91ciBzaWRlIG5lZWRlZCB0byBiZSBzZW50IGluIHRoZSBtZWFudGltZSxcblx0XHRcdC8vIHNvIHdlIHdpbGwgc2VuZCBhIG1lc3NhZ2UgY29udGFpbmluZyBvbmx5IGFuIGFjay5cblx0XHRcdHRoaXMuX3NlbmRBY2soKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9pbmNvbWluZ0Fja1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuX2luY29taW5nQWNrVGltZW91dCA9IG51bGw7XG5cdFx0XHR0aGlzLl9zZW5kQWNrQ2hlY2soKTtcblx0XHR9LCBQcm90b2NvbENvbnN0YW50cy5BY2tub3dsZWRnZVRpbWUgLSB0aW1lU2luY2VMYXN0SW5jb21pbmdNc2cgKyA1KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlY3ZBY2tDaGVjaygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fb3V0Z29pbmdNc2dJZCA8PSB0aGlzLl9vdXRnb2luZ0Fja0lkKSB7XG5cdFx0XHQvLyBldmVyeXRoaW5nIGhhcyBiZWVuIGFja25vd2xlZGdlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9vdXRnb2luZ0Fja1RpbWVvdXQpIHtcblx0XHRcdC8vIHRoZXJlIHdpbGwgYmUgYSBjaGVjayBpbiB0aGUgbmVhciBmdXR1cmVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faXNSZWNvbm5lY3RpbmcpIHtcblx0XHRcdC8vIGRvIG5vdCBjYXVzZSBhIHRpbWVvdXQgZHVyaW5nIHJlY29ubmVjdGlvbixcblx0XHRcdC8vIGJlY2F1c2UgbWVzc2FnZXMgd2lsbCBub3QgYmUgYWN0dWFsbHkgd3JpdHRlbiB1bnRpbCBgZW5kQWNjZXB0UmVjb25uZWN0aW9uYFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9sZGVzdFVuYWNrbm93bGVkZ2VkTXNnID0gdGhpcy5fb3V0Z29pbmdVbmFja01zZy5wZWVrKCkhO1xuXHRcdGNvbnN0IHRpbWVTaW5jZU9sZGVzdFVuYWNrbm93bGVkZ2VkTXNnID0gRGF0ZS5ub3coKSAtIG9sZGVzdFVuYWNrbm93bGVkZ2VkTXNnLndyaXR0ZW5UaW1lO1xuXHRcdGNvbnN0IHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhID0gRGF0ZS5ub3coKSAtIHRoaXMuX3NvY2tldFJlYWRlci5sYXN0UmVhZFRpbWU7XG5cdFx0Y29uc3QgdGltZVNpbmNlTGFzdFRpbWVvdXQgPSBEYXRlLm5vdygpIC0gdGhpcy5fbGFzdFNvY2tldFRpbWVvdXRUaW1lO1xuXG5cdFx0aWYgKFxuXHRcdFx0dGltZVNpbmNlT2xkZXN0VW5hY2tub3dsZWRnZWRNc2cgPj0gUHJvdG9jb2xDb25zdGFudHMuVGltZW91dFRpbWVcblx0XHRcdCYmIHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhID49IFByb3RvY29sQ29uc3RhbnRzLlRpbWVvdXRUaW1lXG5cdFx0XHQmJiB0aW1lU2luY2VMYXN0VGltZW91dCA+PSBQcm90b2NvbENvbnN0YW50cy5UaW1lb3V0VGltZVxuXHRcdCkge1xuXHRcdFx0Ly8gSXQncyBiZWVuIGEgbG9uZyB0aW1lIHNpbmNlIG91ciBzZW50IG1lc3NhZ2Ugd2FzIGFja25vd2xlZGdlZFxuXHRcdFx0Ly8gYW5kIGEgbG9uZyB0aW1lIHNpbmNlIHdlIHJlY2VpdmVkIHNvbWUgZGF0YVxuXG5cdFx0XHQvLyBCdXQgdGhpcyBtaWdodCBiZSBjYXVzZWQgYnkgdGhlIGV2ZW50IGxvb3AgYmVpbmcgYnVzeSBhbmQgZmFpbGluZyB0byByZWFkIG1lc3NhZ2VzXG5cdFx0XHRpZiAoIXRoaXMuX2xvYWRFc3RpbWF0b3IuaGFzSGlnaExvYWQoKSkge1xuXHRcdFx0XHQvLyBUcmFzaCB0aGUgc29ja2V0XG5cdFx0XHRcdHRoaXMuX2xhc3RTb2NrZXRUaW1lb3V0VGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdHRoaXMuX29uU29ja2V0VGltZW91dC5maXJlKHtcblx0XHRcdFx0XHR1bmFja25vd2xlZGdlZE1zZ0NvdW50OiB0aGlzLl9vdXRnb2luZ1VuYWNrTXNnLmxlbmd0aCgpLFxuXHRcdFx0XHRcdHRpbWVTaW5jZU9sZGVzdFVuYWNrbm93bGVkZ2VkTXNnLFxuXHRcdFx0XHRcdHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWluaW11bVRpbWVVbnRpbFRpbWVvdXQgPSBNYXRoLm1heChcblx0XHRcdFByb3RvY29sQ29uc3RhbnRzLlRpbWVvdXRUaW1lIC0gdGltZVNpbmNlT2xkZXN0VW5hY2tub3dsZWRnZWRNc2csXG5cdFx0XHRQcm90b2NvbENvbnN0YW50cy5UaW1lb3V0VGltZSAtIHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhLFxuXHRcdFx0UHJvdG9jb2xDb25zdGFudHMuVGltZW91dFRpbWUgLSB0aW1lU2luY2VMYXN0VGltZW91dCxcblx0XHRcdDUwMFxuXHRcdCk7XG5cblx0XHR0aGlzLl9vdXRnb2luZ0Fja1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuX291dGdvaW5nQWNrVGltZW91dCA9IG51bGw7XG5cdFx0XHR0aGlzLl9yZWN2QWNrQ2hlY2soKTtcblx0XHR9LCBtaW5pbXVtVGltZVVudGlsVGltZW91dCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kQWNrKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pbmNvbWluZ01zZ0lkIDw9IHRoaXMuX2luY29taW5nQWNrSWQpIHtcblx0XHRcdC8vIG5vdGhpbmsgdG8gYWNrbm93bGVkZ2Vcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9pbmNvbWluZ0Fja0lkID0gdGhpcy5faW5jb21pbmdNc2dJZDtcblx0XHRjb25zdCBtc2cgPSBuZXcgUHJvdG9jb2xNZXNzYWdlKFByb3RvY29sTWVzc2FnZVR5cGUuQWNrLCAwLCB0aGlzLl9pbmNvbWluZ0Fja0lkLCBnZXRFbXB0eUJ1ZmZlcigpKTtcblx0XHR0aGlzLl9zb2NrZXRXcml0ZXIud3JpdGUobXNnKTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRLZWVwQWxpdmUoKTogdm9pZCB7XG5cdFx0dGhpcy5faW5jb21pbmdBY2tJZCA9IHRoaXMuX2luY29taW5nTXNnSWQ7XG5cdFx0Y29uc3QgbXNnID0gbmV3IFByb3RvY29sTWVzc2FnZShQcm90b2NvbE1lc3NhZ2VUeXBlLktlZXBBbGl2ZSwgMCwgdGhpcy5faW5jb21pbmdBY2tJZCwgZ2V0RW1wdHlCdWZmZXIoKSk7XG5cdFx0dGhpcy5fc29ja2V0V3JpdGVyLndyaXRlKG1zZyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLHVCQUFvQztBQUN6RCxTQUE4QyxpQkFBaUI7QUFFeEQsSUFBVyw2QkFBWCxrQkFBV0EsZ0NBQVg7QUFDTixFQUFBQSw0QkFBQSxhQUFVO0FBQ1YsRUFBQUEsNEJBQUEsVUFBTztBQUNQLEVBQUFBLDRCQUFBLFdBQVE7QUFDUixFQUFBQSw0QkFBQSxVQUFPO0FBQ1AsRUFBQUEsNEJBQUEsV0FBUTtBQUNSLEVBQUFBLDRCQUFBLFdBQVE7QUFFUixFQUFBQSw0QkFBQSxrQ0FBK0I7QUFFL0IsRUFBQUEsNEJBQUEscUJBQWtCO0FBQ2xCLEVBQUFBLDRCQUFBLGlCQUFjO0FBQ2QsRUFBQUEsNEJBQUEsb0JBQWlCO0FBQ2pCLEVBQUFBLDRCQUFBLGtCQUFlO0FBRWYsRUFBQUEsNEJBQUEsc0JBQW1CO0FBQ25CLEVBQUFBLDRCQUFBLHFCQUFrQjtBQUNsQixFQUFBQSw0QkFBQSw2QkFB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O0FBQUEsSUFDcEIsR0FBRyx1QkFBdUI7QUFBQSxFQUMzQjtBQUFBLEVBRVEsV0FBaUI7QUFDeEIsUUFBSSxLQUFLLGtCQUFrQixLQUFLLGdCQUFnQjtBQUUvQztBQUFBLElBQ0Q7QUFFQSxTQUFLLGlCQUFpQixLQUFLO0FBQzNCLFVBQU0sTUFBTSxJQUFJLGdCQUFnQixhQUF5QixHQUFHLEtBQUssZ0JBQWdCLGVBQWUsQ0FBQztBQUNqRyxTQUFLLGNBQWMsTUFBTSxHQUFHO0FBQUEsRUFDN0I7QUFBQSxFQUVRLGlCQUF1QjtBQUM5QixTQUFLLGlCQUFpQixLQUFLO0FBQzNCLFVBQU0sTUFBTSxJQUFJLGdCQUFnQixtQkFBK0IsR0FBRyxLQUFLLGdCQUFnQixlQUFlLENBQUM7QUFDdkcsU0FBSyxjQUFjLE1BQU0sR0FBRztBQUFBLEVBQzdCO0FBQ0Q7IiwKICAibmFtZXMiOiBbIlNvY2tldERpYWdub3N0aWNzRXZlbnRUeXBlIiwgIlNvY2tldERpYWdub3N0aWNzIiwgIlNvY2tldENsb3NlRXZlbnRUeXBlIiwgInJlc3VsdCIsICJQcm90b2NvbE1lc3NhZ2VUeXBlIiwgIlByb3RvY29sQ29uc3RhbnRzIl0KfQo=
