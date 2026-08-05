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
import { getRandomElement } from "../../../common/arrays.js";
import { createCancelablePromise, timeout } from "../../../common/async.js";
import { VSBuffer } from "../../../common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../common/cancellation.js";
import { memoize } from "../../../common/decorators.js";
import { CancellationError, ErrorNoTelemetry } from "../../../common/errors.js";
import { Emitter, Event, EventMultiplexer, Relay } from "../../../common/event.js";
import { createSingleCallFunction } from "../../../common/functional.js";
import { DisposableStore, dispose, toDisposable } from "../../../common/lifecycle.js";
import { revive } from "../../../common/marshalling.js";
import * as strings from "../../../common/strings.js";
import { isFunction, isUndefinedOrNull } from "../../../common/types.js";
var RequestType = /* @__PURE__ */ ((RequestType2) => {
  RequestType2[RequestType2["Promise"] = 100] = "Promise";
  RequestType2[RequestType2["PromiseCancel"] = 101] = "PromiseCancel";
  RequestType2[RequestType2["EventListen"] = 102] = "EventListen";
  RequestType2[RequestType2["EventDispose"] = 103] = "EventDispose";
  return RequestType2;
})(RequestType || {});
function requestTypeToStr(type) {
  switch (type) {
    case 100 /* Promise */:
      return "req";
    case 101 /* PromiseCancel */:
      return "cancel";
    case 102 /* EventListen */:
      return "subscribe";
    case 103 /* EventDispose */:
      return "unsubscribe";
  }
}
var ResponseType = /* @__PURE__ */ ((ResponseType2) => {
  ResponseType2[ResponseType2["Initialize"] = 200] = "Initialize";
  ResponseType2[ResponseType2["PromiseSuccess"] = 201] = "PromiseSuccess";
  ResponseType2[ResponseType2["PromiseError"] = 202] = "PromiseError";
  ResponseType2[ResponseType2["PromiseErrorObj"] = 203] = "PromiseErrorObj";
  ResponseType2[ResponseType2["EventFire"] = 204] = "EventFire";
  return ResponseType2;
})(ResponseType || {});
function responseTypeToStr(type) {
  switch (type) {
    case 200 /* Initialize */:
      return `init`;
    case 201 /* PromiseSuccess */:
      return `reply:`;
    case 202 /* PromiseError */:
    case 203 /* PromiseErrorObj */:
      return `replyErr:`;
    case 204 /* EventFire */:
      return `event:`;
  }
}
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Uninitialized"] = 0] = "Uninitialized";
  State2[State2["Idle"] = 1] = "Idle";
  return State2;
})(State || {});
function readIntVQL(reader) {
  let value = 0;
  for (let n = 0; ; n += 7) {
    const next = reader.read(1);
    value |= (next.buffer[0] & 127) << n;
    if (!(next.buffer[0] & 128)) {
      return value;
    }
  }
}
const vqlZero = createOneByteBuffer(0);
function writeInt32VQL(writer, value) {
  if (value === 0) {
    writer.write(vqlZero);
    return;
  }
  let len = 0;
  for (let v2 = value; v2 !== 0; v2 = v2 >>> 7) {
    len++;
  }
  const scratch = VSBuffer.alloc(len);
  for (let i = 0; value !== 0; i++) {
    scratch.buffer[i] = value & 127;
    value = value >>> 7;
    if (value > 0) {
      scratch.buffer[i] |= 128;
    }
  }
  writer.write(scratch);
}
class BufferReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.pos = 0;
  }
  read(bytes) {
    const result = this.buffer.slice(this.pos, this.pos + bytes);
    this.pos += result.byteLength;
    return result;
  }
}
class BufferWriter {
  constructor() {
    this.buffers = [];
  }
  get buffer() {
    return VSBuffer.concat(this.buffers);
  }
  write(buffer) {
    this.buffers.push(buffer);
  }
}
var DataType = /* @__PURE__ */ ((DataType2) => {
  DataType2[DataType2["Undefined"] = 0] = "Undefined";
  DataType2[DataType2["String"] = 1] = "String";
  DataType2[DataType2["Buffer"] = 2] = "Buffer";
  DataType2[DataType2["VSBuffer"] = 3] = "VSBuffer";
  DataType2[DataType2["Array"] = 4] = "Array";
  DataType2[DataType2["Object"] = 5] = "Object";
  DataType2[DataType2["Int"] = 6] = "Int";
  return DataType2;
})(DataType || {});
function createOneByteBuffer(value) {
  const result = VSBuffer.alloc(1);
  result.writeUInt8(value, 0);
  return result;
}
const BufferPresets = {
  Undefined: createOneByteBuffer(0 /* Undefined */),
  String: createOneByteBuffer(1 /* String */),
  Buffer: createOneByteBuffer(2 /* Buffer */),
  VSBuffer: createOneByteBuffer(3 /* VSBuffer */),
  Array: createOneByteBuffer(4 /* Array */),
  Object: createOneByteBuffer(5 /* Object */),
  Uint: createOneByteBuffer(6 /* Int */)
};
const hasBuffer = typeof Buffer !== "undefined";
function serialize(writer, data) {
  if (typeof data === "undefined") {
    writer.write(BufferPresets.Undefined);
  } else if (typeof data === "string") {
    const buffer = VSBuffer.fromString(data);
    writer.write(BufferPresets.String);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  } else if (hasBuffer && Buffer.isBuffer(data)) {
    const buffer = VSBuffer.wrap(data);
    writer.write(BufferPresets.Buffer);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  } else if (data instanceof VSBuffer) {
    writer.write(BufferPresets.VSBuffer);
    writeInt32VQL(writer, data.byteLength);
    writer.write(data);
  } else if (Array.isArray(data)) {
    writer.write(BufferPresets.Array);
    writeInt32VQL(writer, data.length);
    for (const el of data) {
      serialize(writer, el);
    }
  } else if (typeof data === "number" && (data | 0) === data) {
    writer.write(BufferPresets.Uint);
    writeInt32VQL(writer, data);
  } else {
    const buffer = VSBuffer.fromString(JSON.stringify(data));
    writer.write(BufferPresets.Object);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  }
}
function deserialize(reader) {
  const type = reader.read(1).readUInt8(0);
  switch (type) {
    case 0 /* Undefined */:
      return void 0;
    case 1 /* String */:
      return reader.read(readIntVQL(reader)).toString();
    case 2 /* Buffer */:
      return reader.read(readIntVQL(reader)).buffer;
    case 3 /* VSBuffer */:
      return reader.read(readIntVQL(reader));
    case 4 /* Array */: {
      const length = readIntVQL(reader);
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(deserialize(reader));
      }
      return result;
    }
    case 5 /* Object */:
      return JSON.parse(reader.read(readIntVQL(reader)).toString());
    case 6 /* Int */:
      return readIntVQL(reader);
  }
}
class ChannelServer {
  constructor(protocol, ctx, logger = null, timeoutDelay = 1e3) {
    this.protocol = protocol;
    this.ctx = ctx;
    this.logger = logger;
    this.timeoutDelay = timeoutDelay;
    this.channels = /* @__PURE__ */ new Map();
    this.activeRequests = /* @__PURE__ */ new Map();
    // Requests might come in for channels which are not yet registered.
    // They will timeout after `timeoutDelay`.
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.protocolListener = this.protocol.onMessage((msg) => this.onRawMessage(msg));
    this.sendResponse({ type: 200 /* Initialize */ });
  }
  registerChannel(channelName, channel) {
    this.channels.set(channelName, channel);
    setTimeout(() => this.flushPendingRequests(channelName), 0);
  }
  sendResponse(response) {
    switch (response.type) {
      case 200 /* Initialize */: {
        const msgLength = this.send([response.type]);
        this.logger?.logOutgoing(msgLength, 0, 1 /* OtherSide */, responseTypeToStr(response.type));
        return;
      }
      case 201 /* PromiseSuccess */:
      case 202 /* PromiseError */:
      case 204 /* EventFire */:
      case 203 /* PromiseErrorObj */: {
        const msgLength = this.send([response.type, response.id], response.data);
        this.logger?.logOutgoing(msgLength, response.id, 1 /* OtherSide */, responseTypeToStr(response.type), response.data);
        return;
      }
    }
  }
  send(header, body = void 0) {
    const writer = new BufferWriter();
    serialize(writer, header);
    serialize(writer, body);
    return this.sendBuffer(writer.buffer);
  }
  sendBuffer(message) {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      return 0;
    }
  }
  onRawMessage(message) {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type = header[0];
    switch (type) {
      case 100 /* Promise */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
        return this.onPromise({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
      case 102 /* EventListen */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
        return this.onEventListen({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
      case 101 /* PromiseCancel */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}`);
        return this.disposeActiveRequest({ type, id: header[1] });
      case 103 /* EventDispose */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}`);
        return this.disposeActiveRequest({ type, id: header[1] });
    }
  }
  onPromise(request) {
    const channel = this.channels.get(request.channelName);
    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }
    const cancellationTokenSource = new CancellationTokenSource();
    let promise;
    try {
      promise = channel.call(this.ctx, request.name, request.arg, cancellationTokenSource.token);
    } catch (err) {
      promise = Promise.reject(err);
    }
    const id = request.id;
    promise.then((data) => {
      this.sendResponse({ id, data, type: 201 /* PromiseSuccess */ });
    }, (err) => {
      if (err instanceof Error) {
        this.sendResponse({
          id,
          data: {
            message: err.message,
            name: err.name,
            stack: err.stack ? err.stack.split("\n") : void 0
          },
          type: 202 /* PromiseError */
        });
      } else {
        this.sendResponse({ id, data: err, type: 203 /* PromiseErrorObj */ });
      }
    }).finally(() => {
      disposable.dispose();
      this.activeRequests.delete(request.id);
    });
    const disposable = toDisposable(() => cancellationTokenSource.cancel());
    this.activeRequests.set(request.id, disposable);
  }
  onEventListen(request) {
    const channel = this.channels.get(request.channelName);
    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }
    const id = request.id;
    const event = channel.listen(this.ctx, request.name, request.arg);
    const disposable = event((data) => this.sendResponse({ id, data, type: 204 /* EventFire */ }));
    this.activeRequests.set(request.id, disposable);
  }
  disposeActiveRequest(request) {
    const disposable = this.activeRequests.get(request.id);
    if (disposable) {
      disposable.dispose();
      this.activeRequests.delete(request.id);
    }
  }
  collectPendingRequest(request) {
    let pendingRequests = this.pendingRequests.get(request.channelName);
    if (!pendingRequests) {
      pendingRequests = [];
      this.pendingRequests.set(request.channelName, pendingRequests);
    }
    const timer = setTimeout(() => {
      console.error(`Unknown channel: ${request.channelName}`);
      if (request.type === 100 /* Promise */) {
        this.sendResponse({
          id: request.id,
          data: { name: "Unknown channel", message: `Channel name '${request.channelName}' timed out after ${this.timeoutDelay}ms`, stack: void 0 },
          type: 202 /* PromiseError */
        });
      }
    }, this.timeoutDelay);
    pendingRequests.push({ request, timeoutTimer: timer });
  }
  flushPendingRequests(channelName) {
    const requests = this.pendingRequests.get(channelName);
    if (requests) {
      for (const request of requests) {
        clearTimeout(request.timeoutTimer);
        switch (request.request.type) {
          case 100 /* Promise */:
            this.onPromise(request.request);
            break;
          case 102 /* EventListen */:
            this.onEventListen(request.request);
            break;
        }
      }
      this.pendingRequests.delete(channelName);
    }
  }
  dispose() {
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
  }
}
var RequestInitiator = /* @__PURE__ */ ((RequestInitiator2) => {
  RequestInitiator2[RequestInitiator2["LocalSide"] = 0] = "LocalSide";
  RequestInitiator2[RequestInitiator2["OtherSide"] = 1] = "OtherSide";
  return RequestInitiator2;
})(RequestInitiator || {});
class ChannelClient {
  constructor(protocol, logger = null) {
    this.protocol = protocol;
    this.isDisposed = false;
    this.state = 0 /* Uninitialized */;
    this.activeRequests = /* @__PURE__ */ new Set();
    this.handlers = /* @__PURE__ */ new Map();
    this.lastRequestId = 0;
    this._onDidInitialize = new Emitter();
    this.onDidInitialize = this._onDidInitialize.event;
    this.protocolListener = this.protocol.onMessage((msg) => this.onBuffer(msg));
    this.logger = logger;
  }
  getChannel(channelName) {
    const that = this;
    return {
      call(command, arg, cancellationToken) {
        if (that.isDisposed) {
          return Promise.reject(new CancellationError());
        }
        return that.requestPromise(channelName, command, arg, cancellationToken);
      },
      listen(event, arg) {
        if (that.isDisposed) {
          return Event.None;
        }
        return that.requestEvent(channelName, event, arg);
      }
    };
  }
  requestPromise(channelName, name, arg, cancellationToken = CancellationToken.None) {
    const id = this.lastRequestId++;
    const type = 100 /* Promise */;
    const request = { id, type, channelName, name, arg };
    if (cancellationToken.isCancellationRequested) {
      return Promise.reject(new CancellationError());
    }
    let disposable;
    let disposableWithRequestCancel;
    const result = new Promise((c, e) => {
      if (cancellationToken.isCancellationRequested) {
        return e(new CancellationError());
      }
      const doRequest = () => {
        const handler = (response) => {
          switch (response.type) {
            case 201 /* PromiseSuccess */:
              this.handlers.delete(id);
              c(response.data);
              break;
            case 202 /* PromiseError */: {
              this.handlers.delete(id);
              const error = new Error(response.data.message);
              error.stack = Array.isArray(response.data.stack) ? response.data.stack.join("\n") : response.data.stack;
              error.name = response.data.name;
              e(error);
              break;
            }
            case 203 /* PromiseErrorObj */:
              this.handlers.delete(id);
              e(response.data);
              break;
          }
        };
        this.handlers.set(id, handler);
        this.sendRequest(request);
      };
      let uninitializedPromise = null;
      if (this.state === 1 /* Idle */) {
        doRequest();
      } else {
        uninitializedPromise = createCancelablePromise((_) => this.whenInitialized());
        uninitializedPromise.then(() => {
          uninitializedPromise = null;
          doRequest();
        });
      }
      const cancel = () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.sendRequest({ id, type: 101 /* PromiseCancel */ });
        }
        e(new CancellationError());
      };
      disposable = cancellationToken.onCancellationRequested(cancel);
      disposableWithRequestCancel = {
        dispose: createSingleCallFunction(() => {
          cancel();
          disposable.dispose();
        })
      };
      this.activeRequests.add(disposableWithRequestCancel);
    });
    return result.finally(() => {
      disposable?.dispose();
      this.activeRequests.delete(disposableWithRequestCancel);
    });
  }
  requestEvent(channelName, name, arg) {
    const id = this.lastRequestId++;
    const type = 102 /* EventListen */;
    const request = { id, type, channelName, name, arg };
    let uninitializedPromise = null;
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        const doRequest = () => {
          this.activeRequests.add(emitter);
          this.sendRequest(request);
        };
        if (this.state === 1 /* Idle */) {
          doRequest();
        } else {
          uninitializedPromise = createCancelablePromise((_) => this.whenInitialized());
          uninitializedPromise.then(() => {
            uninitializedPromise = null;
            doRequest();
          });
        }
      },
      onDidRemoveLastListener: () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.activeRequests.delete(emitter);
          this.sendRequest({ id, type: 103 /* EventDispose */ });
        }
      }
    });
    const handler = (res) => emitter.fire(res.data);
    this.handlers.set(id, handler);
    return emitter.event;
  }
  sendRequest(request) {
    switch (request.type) {
      case 100 /* Promise */:
      case 102 /* EventListen */: {
        const msgLength = this.send([request.type, request.id, request.channelName, request.name], request.arg);
        this.logger?.logOutgoing(msgLength, request.id, 0 /* LocalSide */, `${requestTypeToStr(request.type)}: ${request.channelName}.${request.name}`, request.arg);
        return;
      }
      case 101 /* PromiseCancel */:
      case 103 /* EventDispose */: {
        const msgLength = this.send([request.type, request.id]);
        this.logger?.logOutgoing(msgLength, request.id, 0 /* LocalSide */, requestTypeToStr(request.type));
        return;
      }
    }
  }
  send(header, body = void 0) {
    const writer = new BufferWriter();
    serialize(writer, header);
    serialize(writer, body);
    return this.sendBuffer(writer.buffer);
  }
  sendBuffer(message) {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      return 0;
    }
  }
  onBuffer(message) {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type = header[0];
    switch (type) {
      case 200 /* Initialize */:
        this.logger?.logIncoming(message.byteLength, 0, 0 /* LocalSide */, responseTypeToStr(type));
        return this.onResponse({ type: header[0] });
      case 201 /* PromiseSuccess */:
      case 202 /* PromiseError */:
      case 204 /* EventFire */:
      case 203 /* PromiseErrorObj */:
        this.logger?.logIncoming(message.byteLength, header[1], 0 /* LocalSide */, responseTypeToStr(type), body);
        return this.onResponse({ type: header[0], id: header[1], data: body });
    }
  }
  onResponse(response) {
    if (response.type === 200 /* Initialize */) {
      this.state = 1 /* Idle */;
      this._onDidInitialize.fire();
      return;
    }
    const handler = this.handlers.get(response.id);
    handler?.(response);
  }
  get onDidInitializePromise() {
    return Event.toPromise(this.onDidInitialize);
  }
  whenInitialized() {
    if (this.state === 1 /* Idle */) {
      return Promise.resolve();
    } else {
      return this.onDidInitializePromise;
    }
  }
  dispose() {
    this.isDisposed = true;
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
  }
}
__decorateClass([
  memoize
], ChannelClient.prototype, "onDidInitializePromise", 1);
class IPCServer {
  constructor(onDidClientConnect, ipcLogger, timeoutDelay) {
    this.channels = /* @__PURE__ */ new Map();
    this._connections = /* @__PURE__ */ new Set();
    this._onDidAddConnection = new Emitter();
    this.onDidAddConnection = this._onDidAddConnection.event;
    this._onDidRemoveConnection = new Emitter();
    this.onDidRemoveConnection = this._onDidRemoveConnection.event;
    this.disposables = new DisposableStore();
    this.disposables.add(onDidClientConnect(({ protocol, onDidClientDisconnect }) => {
      const onFirstMessage = Event.once(protocol.onMessage);
      this.disposables.add(onFirstMessage((msg) => {
        const reader = new BufferReader(msg);
        const ctx = deserialize(reader);
        const channelServer = new ChannelServer(protocol, ctx, ipcLogger, timeoutDelay);
        const channelClient = new ChannelClient(protocol, ipcLogger);
        this.channels.forEach((channel, name) => channelServer.registerChannel(name, channel));
        const connection = { channelServer, channelClient, ctx };
        this._connections.add(connection);
        this._onDidAddConnection.fire(connection);
        this.disposables.add(onDidClientDisconnect(() => {
          channelServer.dispose();
          channelClient.dispose();
          this._connections.delete(connection);
          this._onDidRemoveConnection.fire(connection);
        }));
      }));
    }));
  }
  get connections() {
    const result = [];
    this._connections.forEach((ctx) => result.push(ctx));
    return result;
  }
  getChannel(channelName, routerOrClientFilter) {
    const that = this;
    return {
      call(command, arg, cancellationToken) {
        let connectionPromise;
        if (isFunction(routerOrClientFilter)) {
          const connection = getRandomElement(that.connections.filter(routerOrClientFilter));
          connectionPromise = connection ? Promise.resolve(connection) : Event.toPromise(Event.filter(that.onDidAddConnection, routerOrClientFilter));
        } else {
          connectionPromise = routerOrClientFilter.routeCall(that, command, arg);
        }
        const channelPromise = connectionPromise.then((connection) => connection.channelClient.getChannel(channelName));
        return getDelayedChannel(channelPromise).call(command, arg, cancellationToken);
      },
      listen(event, arg) {
        if (isFunction(routerOrClientFilter)) {
          return that.getMulticastEvent(channelName, routerOrClientFilter, event, arg);
        }
        const channelPromise = routerOrClientFilter.routeEvent(that, event, arg).then((connection) => connection.channelClient.getChannel(channelName));
        return getDelayedChannel(channelPromise).listen(event, arg);
      }
    };
  }
  getMulticastEvent(channelName, clientFilter, eventName, arg) {
    const that = this;
    let disposables;
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        disposables = new DisposableStore();
        const eventMultiplexer = new EventMultiplexer();
        const map = /* @__PURE__ */ new Map();
        const onDidAddConnection = (connection) => {
          const channel = connection.channelClient.getChannel(channelName);
          const event = channel.listen(eventName, arg);
          const disposable = eventMultiplexer.add(event);
          map.set(connection, disposable);
        };
        const onDidRemoveConnection = (connection) => {
          const disposable = map.get(connection);
          if (!disposable) {
            return;
          }
          disposable.dispose();
          map.delete(connection);
        };
        that.connections.filter(clientFilter).forEach(onDidAddConnection);
        Event.filter(that.onDidAddConnection, clientFilter)(onDidAddConnection, void 0, disposables);
        that.onDidRemoveConnection(onDidRemoveConnection, void 0, disposables);
        eventMultiplexer.event(emitter.fire, emitter, disposables);
        disposables.add(eventMultiplexer);
      },
      onDidRemoveLastListener: () => {
        disposables?.dispose();
        disposables = void 0;
      }
    });
    that.disposables.add(emitter);
    return emitter.event;
  }
  registerChannel(channelName, channel) {
    this.channels.set(channelName, channel);
    for (const connection of this._connections) {
      connection.channelServer.registerChannel(channelName, channel);
    }
  }
  dispose() {
    this.disposables.dispose();
    for (const connection of this._connections) {
      connection.channelClient.dispose();
      connection.channelServer.dispose();
    }
    this._connections.clear();
    this.channels.clear();
    this._onDidAddConnection.dispose();
    this._onDidRemoveConnection.dispose();
  }
}
class IPCClient {
  constructor(protocol, ctx, ipcLogger = null) {
    const writer = new BufferWriter();
    serialize(writer, ctx);
    protocol.send(writer.buffer);
    this.channelClient = new ChannelClient(protocol, ipcLogger);
    this.channelServer = new ChannelServer(protocol, ctx, ipcLogger);
  }
  getChannel(channelName) {
    return this.channelClient.getChannel(channelName);
  }
  registerChannel(channelName, channel) {
    this.channelServer.registerChannel(channelName, channel);
  }
  dispose() {
    this.channelClient.dispose();
    this.channelServer.dispose();
  }
}
function getDelayedChannel(promise) {
  return {
    call(command, arg, cancellationToken) {
      return promise.then((c) => c.call(command, arg, cancellationToken));
    },
    listen(event, arg) {
      const relay = new Relay();
      promise.then((c) => relay.input = c.listen(event, arg));
      return relay.event;
    }
  };
}
function getNextTickChannel(channel) {
  let didTick = false;
  return {
    call(command, arg, cancellationToken) {
      if (didTick) {
        return channel.call(command, arg, cancellationToken);
      }
      return timeout(0).then(() => didTick = true).then(() => channel.call(command, arg, cancellationToken));
    },
    listen(event, arg) {
      if (didTick) {
        return channel.listen(event, arg);
      }
      const relay = new Relay();
      timeout(0).then(() => didTick = true).then(() => relay.input = channel.listen(event, arg));
      return relay.event;
    }
  };
}
class StaticRouter {
  constructor(fn) {
    this.fn = fn;
  }
  routeCall(hub) {
    return this.route(hub);
  }
  routeEvent(hub) {
    return this.route(hub);
  }
  async route(hub) {
    for (const connection of hub.connections) {
      if (await Promise.resolve(this.fn(connection.ctx))) {
        return Promise.resolve(connection);
      }
    }
    await Event.toPromise(hub.onDidAddConnection);
    return await this.route(hub);
  }
}
var ProxyChannel;
((ProxyChannel2) => {
  function fromService(service, disposables, options) {
    const handler = service;
    const disableMarshalling = options && options.disableMarshalling;
    const mapEventNameToEvent = /* @__PURE__ */ new Map();
    for (const key in handler) {
      if (propertyIsEvent(key)) {
        mapEventNameToEvent.set(key, Event.buffer(handler[key], true, void 0, disposables));
      }
    }
    return new class {
      listen(_, event, arg) {
        const eventImpl = mapEventNameToEvent.get(event);
        if (eventImpl) {
          return eventImpl;
        }
        const target = handler[event];
        if (typeof target === "function") {
          if (propertyIsDynamicEvent(event)) {
            return target.call(handler, arg);
          }
          if (propertyIsEvent(event)) {
            mapEventNameToEvent.set(event, Event.buffer(handler[event], true, void 0, disposables));
            return mapEventNameToEvent.get(event);
          }
        }
        throw new ErrorNoTelemetry(`Event not found: ${event}`);
      }
      call(_, command, args) {
        const target = handler[command];
        if (typeof target === "function") {
          if (!disableMarshalling && Array.isArray(args)) {
            for (let i = 0; i < args.length; i++) {
              args[i] = revive(args[i]);
            }
          }
          let res = target.apply(handler, args);
          if (!(res instanceof Promise)) {
            res = Promise.resolve(res);
          }
          return res;
        }
        throw new ErrorNoTelemetry(`Method not found: ${command}`);
      }
    }();
  }
  ProxyChannel2.fromService = fromService;
  function toService(channel, options) {
    const disableMarshalling = options && options.disableMarshalling;
    return new Proxy({}, {
      get(_target, propKey) {
        if (typeof propKey === "string") {
          if (options?.properties?.has(propKey)) {
            return options.properties.get(propKey);
          }
          if (propertyIsDynamicEvent(propKey)) {
            return function(arg) {
              return channel.listen(propKey, arg);
            };
          }
          if (propertyIsEvent(propKey)) {
            return channel.listen(propKey);
          }
          return async function(...args) {
            let methodArgs;
            if (options && !isUndefinedOrNull(options.context)) {
              methodArgs = [options.context, ...args];
            } else {
              methodArgs = args;
            }
            const result = await channel.call(propKey, methodArgs);
            if (!disableMarshalling) {
              return revive(result);
            }
            return result;
          };
        }
        throw new ErrorNoTelemetry(`Property not found: ${String(propKey)}`);
      }
    });
  }
  ProxyChannel2.toService = toService;
  function propertyIsEvent(name) {
    return name[0] === "o" && name[1] === "n" && strings.isUpperAsciiLetter(name.charCodeAt(2));
  }
  function propertyIsDynamicEvent(name) {
    return /^onDynamic/.test(name) && strings.isUpperAsciiLetter(name.charCodeAt(9));
  }
})(ProxyChannel || (ProxyChannel = {}));
const colorTables = [
  ["#2977B1", "#FC802D", "#34A13A", "#D3282F", "#9366BA"],
  ["#8B564C", "#E177C0", "#7F7F7F", "#BBBE3D", "#2EBECD"]
];
function prettyWithoutArrays(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object" && typeof data.toString === "function") {
    const result = data.toString();
    if (result !== "[object Object]") {
      return result;
    }
  }
  return data;
}
function pretty(data) {
  if (Array.isArray(data)) {
    return data.map(prettyWithoutArrays);
  }
  return prettyWithoutArrays(data);
}
function logWithColors(direction, totalLength, msgLength, req, initiator, str, data) {
  data = pretty(data);
  const colorTable = colorTables[initiator];
  const color = colorTable[req % colorTable.length];
  let args = [`%c[${direction}]%c[${String(totalLength).padStart(7, " ")}]%c[len: ${String(msgLength).padStart(5, " ")}]%c${String(req).padStart(5, " ")} - ${str}`, "color: darkgreen", "color: grey", "color: grey", `color: ${color}`];
  if (/\($/.test(str)) {
    args = args.concat(data);
    args.push(")");
  } else {
    args.push(data);
  }
  console.log.apply(console, args);
}
class IPCLogger {
  constructor(_outgoingPrefix, _incomingPrefix) {
    this._outgoingPrefix = _outgoingPrefix;
    this._incomingPrefix = _incomingPrefix;
    this._totalIncoming = 0;
    this._totalOutgoing = 0;
  }
  logOutgoing(msgLength, requestId, initiator, str, data) {
    this._totalOutgoing += msgLength;
    logWithColors(this._outgoingPrefix, this._totalOutgoing, msgLength, requestId, initiator, str, data);
  }
  logIncoming(msgLength, requestId, initiator, str, data) {
    this._totalIncoming += msgLength;
    logWithColors(this._incomingPrefix, this._totalIncoming, msgLength, requestId, initiator, str, data);
  }
}
export {
  BufferReader,
  BufferWriter,
  ChannelClient,
  ChannelServer,
  IPCClient,
  IPCLogger,
  IPCServer,
  ProxyChannel,
  RequestInitiator,
  StaticRouter,
  deserialize,
  getDelayedChannel,
  getNextTickChannel,
  serialize
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZ2V0UmFuZG9tRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciwgRXJyb3JOb1RlbGVtZXRyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIEV2ZW50TXVsdGlwbGV4ZXIsIFJlbGF5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9mdW5jdGlvbmFsLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcmV2aXZlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgaXNGdW5jdGlvbiwgaXNVbmRlZmluZWRPck51bGwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdHlwZXMuanMnO1xuXG4vKipcbiAqIEFuIGBJQ2hhbm5lbGAgaXMgYW4gYWJzdHJhY3Rpb24gb3ZlciBhIGNvbGxlY3Rpb24gb2YgY29tbWFuZHMuXG4gKiBZb3UgY2FuIGBjYWxsYCBzZXZlcmFsIGNvbW1hbmRzIG9uIGEgY2hhbm5lbCwgZWFjaCB0YWtpbmcgYXRcbiAqIG1vc3Qgb25lIHNpbmdsZSBhcmd1bWVudC4gQSBgY2FsbGAgYWx3YXlzIHJldHVybnMgYSBwcm9taXNlXG4gKiB3aXRoIGF0IG1vc3Qgb25lIHNpbmdsZSByZXR1cm4gdmFsdWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYW5uZWwge1xuXHRjYWxsPFQ+KGNvbW1hbmQ6IHN0cmluZywgYXJnPzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUPjtcblx0bGlzdGVuPFQ+KGV2ZW50OiBzdHJpbmcsIGFyZz86IGFueSk6IEV2ZW50PFQ+O1xufVxuXG4vKipcbiAqIEFuIGBJU2VydmVyQ2hhbm5lbGAgaXMgdGhlIGNvdW50ZXIgcGFydCB0byBgSUNoYW5uZWxgLFxuICogb24gdGhlIHNlcnZlci1zaWRlLiBZb3Ugc2hvdWxkIGltcGxlbWVudCB0aGlzIGludGVyZmFjZVxuICogaWYgeW91J2QgbGlrZSB0byBoYW5kbGUgcmVtb3RlIHByb21pc2VzIG9yIGV2ZW50cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJU2VydmVyQ2hhbm5lbDxUQ29udGV4dCA9IHN0cmluZz4ge1xuXHRjYWxsPFQ+KGN0eDogVENvbnRleHQsIGNvbW1hbmQ6IHN0cmluZywgYXJnPzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUPjtcblx0bGlzdGVuPFQ+KGN0eDogVENvbnRleHQsIGV2ZW50OiBzdHJpbmcsIGFyZz86IGFueSk6IEV2ZW50PFQ+O1xufVxuXG5jb25zdCBlbnVtIFJlcXVlc3RUeXBlIHtcblx0UHJvbWlzZSA9IDEwMCxcblx0UHJvbWlzZUNhbmNlbCA9IDEwMSxcblx0RXZlbnRMaXN0ZW4gPSAxMDIsXG5cdEV2ZW50RGlzcG9zZSA9IDEwM1xufVxuXG5mdW5jdGlvbiByZXF1ZXN0VHlwZVRvU3RyKHR5cGU6IFJlcXVlc3RUeXBlKTogc3RyaW5nIHtcblx0c3dpdGNoICh0eXBlKSB7XG5cdFx0Y2FzZSBSZXF1ZXN0VHlwZS5Qcm9taXNlOlxuXHRcdFx0cmV0dXJuICdyZXEnO1xuXHRcdGNhc2UgUmVxdWVzdFR5cGUuUHJvbWlzZUNhbmNlbDpcblx0XHRcdHJldHVybiAnY2FuY2VsJztcblx0XHRjYXNlIFJlcXVlc3RUeXBlLkV2ZW50TGlzdGVuOlxuXHRcdFx0cmV0dXJuICdzdWJzY3JpYmUnO1xuXHRcdGNhc2UgUmVxdWVzdFR5cGUuRXZlbnREaXNwb3NlOlxuXHRcdFx0cmV0dXJuICd1bnN1YnNjcmliZSc7XG5cdH1cbn1cblxudHlwZSBJUmF3UHJvbWlzZVJlcXVlc3QgPSB7IHR5cGU6IFJlcXVlc3RUeXBlLlByb21pc2U7IGlkOiBudW1iZXI7IGNoYW5uZWxOYW1lOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgYXJnOiBhbnkgfTtcbnR5cGUgSVJhd1Byb21pc2VDYW5jZWxSZXF1ZXN0ID0geyB0eXBlOiBSZXF1ZXN0VHlwZS5Qcm9taXNlQ2FuY2VsOyBpZDogbnVtYmVyIH07XG50eXBlIElSYXdFdmVudExpc3RlblJlcXVlc3QgPSB7IHR5cGU6IFJlcXVlc3RUeXBlLkV2ZW50TGlzdGVuOyBpZDogbnVtYmVyOyBjaGFubmVsTmFtZTogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGFyZzogYW55IH07XG50eXBlIElSYXdFdmVudERpc3Bvc2VSZXF1ZXN0ID0geyB0eXBlOiBSZXF1ZXN0VHlwZS5FdmVudERpc3Bvc2U7IGlkOiBudW1iZXIgfTtcbnR5cGUgSVJhd1JlcXVlc3QgPSBJUmF3UHJvbWlzZVJlcXVlc3QgfCBJUmF3UHJvbWlzZUNhbmNlbFJlcXVlc3QgfCBJUmF3RXZlbnRMaXN0ZW5SZXF1ZXN0IHwgSVJhd0V2ZW50RGlzcG9zZVJlcXVlc3Q7XG5cbmNvbnN0IGVudW0gUmVzcG9uc2VUeXBlIHtcblx0SW5pdGlhbGl6ZSA9IDIwMCxcblx0UHJvbWlzZVN1Y2Nlc3MgPSAyMDEsXG5cdFByb21pc2VFcnJvciA9IDIwMixcblx0UHJvbWlzZUVycm9yT2JqID0gMjAzLFxuXHRFdmVudEZpcmUgPSAyMDRcbn1cblxuZnVuY3Rpb24gcmVzcG9uc2VUeXBlVG9TdHIodHlwZTogUmVzcG9uc2VUeXBlKTogc3RyaW5nIHtcblx0c3dpdGNoICh0eXBlKSB7XG5cdFx0Y2FzZSBSZXNwb25zZVR5cGUuSW5pdGlhbGl6ZTpcblx0XHRcdHJldHVybiBgaW5pdGA7XG5cdFx0Y2FzZSBSZXNwb25zZVR5cGUuUHJvbWlzZVN1Y2Nlc3M6XG5cdFx0XHRyZXR1cm4gYHJlcGx5OmA7XG5cdFx0Y2FzZSBSZXNwb25zZVR5cGUuUHJvbWlzZUVycm9yOlxuXHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvck9iajpcblx0XHRcdHJldHVybiBgcmVwbHlFcnI6YDtcblx0XHRjYXNlIFJlc3BvbnNlVHlwZS5FdmVudEZpcmU6XG5cdFx0XHRyZXR1cm4gYGV2ZW50OmA7XG5cdH1cbn1cblxudHlwZSBJUmF3SW5pdGlhbGl6ZVJlc3BvbnNlID0geyB0eXBlOiBSZXNwb25zZVR5cGUuSW5pdGlhbGl6ZSB9O1xudHlwZSBJUmF3UHJvbWlzZVN1Y2Nlc3NSZXNwb25zZSA9IHsgdHlwZTogUmVzcG9uc2VUeXBlLlByb21pc2VTdWNjZXNzOyBpZDogbnVtYmVyOyBkYXRhOiBhbnkgfTtcbnR5cGUgSVJhd1Byb21pc2VFcnJvclJlc3BvbnNlID0geyB0eXBlOiBSZXNwb25zZVR5cGUuUHJvbWlzZUVycm9yOyBpZDogbnVtYmVyOyBkYXRhOiB7IG1lc3NhZ2U6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBzdGFjazogc3RyaW5nW10gfCB1bmRlZmluZWQgfSB9O1xudHlwZSBJUmF3UHJvbWlzZUVycm9yT2JqUmVzcG9uc2UgPSB7IHR5cGU6IFJlc3BvbnNlVHlwZS5Qcm9taXNlRXJyb3JPYmo7IGlkOiBudW1iZXI7IGRhdGE6IGFueSB9O1xudHlwZSBJUmF3RXZlbnRGaXJlUmVzcG9uc2UgPSB7IHR5cGU6IFJlc3BvbnNlVHlwZS5FdmVudEZpcmU7IGlkOiBudW1iZXI7IGRhdGE6IGFueSB9O1xudHlwZSBJUmF3UmVzcG9uc2UgPSBJUmF3SW5pdGlhbGl6ZVJlc3BvbnNlIHwgSVJhd1Byb21pc2VTdWNjZXNzUmVzcG9uc2UgfCBJUmF3UHJvbWlzZUVycm9yUmVzcG9uc2UgfCBJUmF3UHJvbWlzZUVycm9yT2JqUmVzcG9uc2UgfCBJUmF3RXZlbnRGaXJlUmVzcG9uc2U7XG5cbmludGVyZmFjZSBJSGFuZGxlciB7XG5cdChyZXNwb25zZTogSVJhd1Jlc3BvbnNlKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCB7XG5cdHNlbmQoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQ7XG5cdG9uTWVzc2FnZTogRXZlbnQ8VlNCdWZmZXI+O1xuXHQvKipcblx0ICogV2FpdCBmb3IgdGhlIHdyaXRlIGJ1ZmZlciAoaWYgYXBwbGljYWJsZSkgdG8gYmVjb21lIGVtcHR5LlxuXHQgKi9cblx0ZHJhaW4/KCk6IFByb21pc2U8dm9pZD47XG59XG5cbmVudW0gU3RhdGUge1xuXHRVbmluaXRpYWxpemVkLFxuXHRJZGxlXG59XG5cbi8qKlxuICogQW4gYElDaGFubmVsU2VydmVyYCBob3N0cyBhIGNvbGxlY3Rpb24gb2YgY2hhbm5lbHMuIFlvdSBhcmVcbiAqIGFibGUgdG8gcmVnaXN0ZXIgY2hhbm5lbHMgb250byBpdCwgcHJvdmlkZWQgYSBjaGFubmVsIG5hbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYW5uZWxTZXJ2ZXI8VENvbnRleHQgPSBzdHJpbmc+IHtcblx0cmVnaXN0ZXJDaGFubmVsKGNoYW5uZWxOYW1lOiBzdHJpbmcsIGNoYW5uZWw6IElTZXJ2ZXJDaGFubmVsPFRDb250ZXh0Pik6IHZvaWQ7XG59XG5cbi8qKlxuICogQW4gYElDaGFubmVsQ2xpZW50YCBoYXMgYWNjZXNzIHRvIGEgY29sbGVjdGlvbiBvZiBjaGFubmVscy4gWW91XG4gKiBhcmUgYWJsZSB0byBnZXQgdGhvc2UgY2hhbm5lbHMsIGdpdmVuIHRoZWlyIGNoYW5uZWwgbmFtZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQ2hhbm5lbENsaWVudCB7XG5cdGdldENoYW5uZWw8VCBleHRlbmRzIElDaGFubmVsPihjaGFubmVsTmFtZTogc3RyaW5nKTogVDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDbGllbnQ8VENvbnRleHQ+IHtcblx0cmVhZG9ubHkgY3R4OiBUQ29udGV4dDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29ubmVjdGlvbkh1YjxUQ29udGV4dD4ge1xuXHRyZWFkb25seSBjb25uZWN0aW9uczogQ29ubmVjdGlvbjxUQ29udGV4dD5bXTtcblx0cmVhZG9ubHkgb25EaWRBZGRDb25uZWN0aW9uOiBFdmVudDxDb25uZWN0aW9uPFRDb250ZXh0Pj47XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlQ29ubmVjdGlvbjogRXZlbnQ8Q29ubmVjdGlvbjxUQ29udGV4dD4+O1xufVxuXG4vKipcbiAqIEFuIGBJQ2xpZW50Um91dGVyYCBpcyByZXNwb25zaWJsZSBmb3Igcm91dGluZyBjYWxscyB0byBzcGVjaWZpY1xuICogY2hhbm5lbHMsIGluIHNjZW5hcmlvcyBpbiB3aGljaCB0aGVyZSBhcmUgbXVsdGlwbGUgcG9zc2libGVcbiAqIGNoYW5uZWxzIChlYWNoIGZyb20gYSBzZXBhcmF0ZSBjbGllbnQpIHRvIHBpY2sgZnJvbS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQ2xpZW50Um91dGVyPFRDb250ZXh0ID0gc3RyaW5nPiB7XG5cdHJvdXRlQ2FsbChodWI6IElDb25uZWN0aW9uSHViPFRDb250ZXh0PiwgY29tbWFuZDogc3RyaW5nLCBhcmc/OiBhbnksIGNhbmNlbGxhdGlvblRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPENsaWVudDxUQ29udGV4dD4+O1xuXHRyb3V0ZUV2ZW50KGh1YjogSUNvbm5lY3Rpb25IdWI8VENvbnRleHQ+LCBldmVudDogc3RyaW5nLCBhcmc/OiBhbnkpOiBQcm9taXNlPENsaWVudDxUQ29udGV4dD4+O1xufVxuXG4vKipcbiAqIFNpbWlsYXIgdG8gdGhlIGBJQ2hhbm5lbENsaWVudGAsIHlvdSBjYW4gZ2V0IGNoYW5uZWxzIGZyb20gdGhpc1xuICogY29sbGVjdGlvbiBvZiBjaGFubmVscy4gVGhlIGRpZmZlcmVuY2UgYmVpbmcgdGhhdCBpbiB0aGVcbiAqIGBJUm91dGluZ0NoYW5uZWxDbGllbnRgLCB0aGVyZSBhcmUgbXVsdGlwbGUgY2xpZW50cyBwcm92aWRpbmdcbiAqIHRoZSBzYW1lIGNoYW5uZWwuIFlvdSdsbCBuZWVkIHRvIHBhc3MgaW4gYW4gYElDbGllbnRSb3V0ZXJgIGluXG4gKiBvcmRlciB0byBwaWNrIHRoZSByaWdodCBvbmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVJvdXRpbmdDaGFubmVsQ2xpZW50PFRDb250ZXh0ID0gc3RyaW5nPiB7XG5cdGdldENoYW5uZWw8VCBleHRlbmRzIElDaGFubmVsPihjaGFubmVsTmFtZTogc3RyaW5nLCByb3V0ZXI/OiBJQ2xpZW50Um91dGVyPFRDb250ZXh0Pik6IFQ7XG59XG5cbmludGVyZmFjZSBJUmVhZGVyIHtcblx0cmVhZChieXRlczogbnVtYmVyKTogVlNCdWZmZXI7XG59XG5cbmludGVyZmFjZSBJV3JpdGVyIHtcblx0d3JpdGUoYnVmZmVyOiBWU0J1ZmZlcik6IHZvaWQ7XG59XG5cblxuLyoqXG4gKiBAc2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1ZhcmlhYmxlLWxlbmd0aF9xdWFudGl0eVxuICovXG5mdW5jdGlvbiByZWFkSW50VlFMKHJlYWRlcjogSVJlYWRlcikge1xuXHRsZXQgdmFsdWUgPSAwO1xuXHRmb3IgKGxldCBuID0gMDsgOyBuICs9IDcpIHtcblx0XHRjb25zdCBuZXh0ID0gcmVhZGVyLnJlYWQoMSk7XG5cdFx0dmFsdWUgfD0gKG5leHQuYnVmZmVyWzBdICYgMGIwMTExMTExMSkgPDwgbjtcblx0XHRpZiAoIShuZXh0LmJ1ZmZlclswXSAmIDBiMTAwMDAwMDApKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IHZxbFplcm8gPSBjcmVhdGVPbmVCeXRlQnVmZmVyKDApO1xuXG4vKipcbiAqIEBzZWUgaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVmFyaWFibGUtbGVuZ3RoX3F1YW50aXR5XG4gKi9cbmZ1bmN0aW9uIHdyaXRlSW50MzJWUUwod3JpdGVyOiBJV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGlmICh2YWx1ZSA9PT0gMCkge1xuXHRcdHdyaXRlci53cml0ZSh2cWxaZXJvKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgbGVuID0gMDtcblx0Zm9yIChsZXQgdjIgPSB2YWx1ZTsgdjIgIT09IDA7IHYyID0gdjIgPj4+IDcpIHtcblx0XHRsZW4rKztcblx0fVxuXG5cdGNvbnN0IHNjcmF0Y2ggPSBWU0J1ZmZlci5hbGxvYyhsZW4pO1xuXHRmb3IgKGxldCBpID0gMDsgdmFsdWUgIT09IDA7IGkrKykge1xuXHRcdHNjcmF0Y2guYnVmZmVyW2ldID0gdmFsdWUgJiAwYjAxMTExMTExO1xuXHRcdHZhbHVlID0gdmFsdWUgPj4+IDc7XG5cdFx0aWYgKHZhbHVlID4gMCkge1xuXHRcdFx0c2NyYXRjaC5idWZmZXJbaV0gfD0gMGIxMDAwMDAwMDtcblx0XHR9XG5cdH1cblxuXHR3cml0ZXIud3JpdGUoc2NyYXRjaCk7XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmZXJSZWFkZXIgaW1wbGVtZW50cyBJUmVhZGVyIHtcblxuXHRwcml2YXRlIHBvcyA9IDA7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBidWZmZXI6IFZTQnVmZmVyKSB7IH1cblxuXHRyZWFkKGJ5dGVzOiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5idWZmZXIuc2xpY2UodGhpcy5wb3MsIHRoaXMucG9zICsgYnl0ZXMpO1xuXHRcdHRoaXMucG9zICs9IHJlc3VsdC5ieXRlTGVuZ3RoO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmZlcldyaXRlciBpbXBsZW1lbnRzIElXcml0ZXIge1xuXG5cdHByaXZhdGUgYnVmZmVyczogVlNCdWZmZXJbXSA9IFtdO1xuXG5cdGdldCBidWZmZXIoKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiBWU0J1ZmZlci5jb25jYXQodGhpcy5idWZmZXJzKTtcblx0fVxuXG5cdHdyaXRlKGJ1ZmZlcjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHR0aGlzLmJ1ZmZlcnMucHVzaChidWZmZXIpO1xuXHR9XG59XG5cbmVudW0gRGF0YVR5cGUge1xuXHRVbmRlZmluZWQgPSAwLFxuXHRTdHJpbmcgPSAxLFxuXHRCdWZmZXIgPSAyLFxuXHRWU0J1ZmZlciA9IDMsXG5cdEFycmF5ID0gNCxcblx0T2JqZWN0ID0gNSxcblx0SW50ID0gNlxufVxuXG5mdW5jdGlvbiBjcmVhdGVPbmVCeXRlQnVmZmVyKHZhbHVlOiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdGNvbnN0IHJlc3VsdCA9IFZTQnVmZmVyLmFsbG9jKDEpO1xuXHRyZXN1bHQud3JpdGVVSW50OCh2YWx1ZSwgMCk7XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmNvbnN0IEJ1ZmZlclByZXNldHMgPSB7XG5cdFVuZGVmaW5lZDogY3JlYXRlT25lQnl0ZUJ1ZmZlcihEYXRhVHlwZS5VbmRlZmluZWQpLFxuXHRTdHJpbmc6IGNyZWF0ZU9uZUJ5dGVCdWZmZXIoRGF0YVR5cGUuU3RyaW5nKSxcblx0QnVmZmVyOiBjcmVhdGVPbmVCeXRlQnVmZmVyKERhdGFUeXBlLkJ1ZmZlciksXG5cdFZTQnVmZmVyOiBjcmVhdGVPbmVCeXRlQnVmZmVyKERhdGFUeXBlLlZTQnVmZmVyKSxcblx0QXJyYXk6IGNyZWF0ZU9uZUJ5dGVCdWZmZXIoRGF0YVR5cGUuQXJyYXkpLFxuXHRPYmplY3Q6IGNyZWF0ZU9uZUJ5dGVCdWZmZXIoRGF0YVR5cGUuT2JqZWN0KSxcblx0VWludDogY3JlYXRlT25lQnl0ZUJ1ZmZlcihEYXRhVHlwZS5JbnQpLFxufTtcblxuZGVjbGFyZSBjb25zdCBCdWZmZXI6IGFueTtcbmNvbnN0IGhhc0J1ZmZlciA9ICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemUod3JpdGVyOiBJV3JpdGVyLCBkYXRhOiBhbnkpOiB2b2lkIHtcblx0aWYgKHR5cGVvZiBkYXRhID09PSAndW5kZWZpbmVkJykge1xuXHRcdHdyaXRlci53cml0ZShCdWZmZXJQcmVzZXRzLlVuZGVmaW5lZCk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdFx0Y29uc3QgYnVmZmVyID0gVlNCdWZmZXIuZnJvbVN0cmluZyhkYXRhKTtcblx0XHR3cml0ZXIud3JpdGUoQnVmZmVyUHJlc2V0cy5TdHJpbmcpO1xuXHRcdHdyaXRlSW50MzJWUUwod3JpdGVyLCBidWZmZXIuYnl0ZUxlbmd0aCk7XG5cdFx0d3JpdGVyLndyaXRlKGJ1ZmZlcik7XG5cdH0gZWxzZSBpZiAoaGFzQnVmZmVyICYmIEJ1ZmZlci5pc0J1ZmZlcihkYXRhKSkge1xuXHRcdGNvbnN0IGJ1ZmZlciA9IFZTQnVmZmVyLndyYXAoZGF0YSk7XG5cdFx0d3JpdGVyLndyaXRlKEJ1ZmZlclByZXNldHMuQnVmZmVyKTtcblx0XHR3cml0ZUludDMyVlFMKHdyaXRlciwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xuXHRcdHdyaXRlci53cml0ZShidWZmZXIpO1xuXHR9IGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBWU0J1ZmZlcikge1xuXHRcdHdyaXRlci53cml0ZShCdWZmZXJQcmVzZXRzLlZTQnVmZmVyKTtcblx0XHR3cml0ZUludDMyVlFMKHdyaXRlciwgZGF0YS5ieXRlTGVuZ3RoKTtcblx0XHR3cml0ZXIud3JpdGUoZGF0YSk7XG5cdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuXHRcdHdyaXRlci53cml0ZShCdWZmZXJQcmVzZXRzLkFycmF5KTtcblx0XHR3cml0ZUludDMyVlFMKHdyaXRlciwgZGF0YS5sZW5ndGgpO1xuXG5cdFx0Zm9yIChjb25zdCBlbCBvZiBkYXRhKSB7XG5cdFx0XHRzZXJpYWxpemUod3JpdGVyLCBlbCk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSAnbnVtYmVyJyAmJiAoZGF0YSB8IDApID09PSBkYXRhKSB7XG5cdFx0Ly8gd3JpdGUgYSB2cWwgaWYgaXQncyBhIG51bWJlciB0aGF0IHdlIGNhbiBkbyBiaXR3aXNlIG9wZXJhdGlvbnMgb25cblx0XHR3cml0ZXIud3JpdGUoQnVmZmVyUHJlc2V0cy5VaW50KTtcblx0XHR3cml0ZUludDMyVlFMKHdyaXRlciwgZGF0YSk7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgYnVmZmVyID0gVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShkYXRhKSk7XG5cdFx0d3JpdGVyLndyaXRlKEJ1ZmZlclByZXNldHMuT2JqZWN0KTtcblx0XHR3cml0ZUludDMyVlFMKHdyaXRlciwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xuXHRcdHdyaXRlci53cml0ZShidWZmZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXNlcmlhbGl6ZShyZWFkZXI6IElSZWFkZXIpOiBhbnkge1xuXHRjb25zdCB0eXBlID0gcmVhZGVyLnJlYWQoMSkucmVhZFVJbnQ4KDApO1xuXG5cdHN3aXRjaCAodHlwZSkge1xuXHRcdGNhc2UgRGF0YVR5cGUuVW5kZWZpbmVkOiByZXR1cm4gdW5kZWZpbmVkO1xuXHRcdGNhc2UgRGF0YVR5cGUuU3RyaW5nOiByZXR1cm4gcmVhZGVyLnJlYWQocmVhZEludFZRTChyZWFkZXIpKS50b1N0cmluZygpO1xuXHRcdGNhc2UgRGF0YVR5cGUuQnVmZmVyOiByZXR1cm4gcmVhZGVyLnJlYWQocmVhZEludFZRTChyZWFkZXIpKS5idWZmZXI7XG5cdFx0Y2FzZSBEYXRhVHlwZS5WU0J1ZmZlcjogcmV0dXJuIHJlYWRlci5yZWFkKHJlYWRJbnRWUUwocmVhZGVyKSk7XG5cdFx0Y2FzZSBEYXRhVHlwZS5BcnJheToge1xuXHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZEludFZRTChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBhbnlbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGRlc2VyaWFsaXplKHJlYWRlcikpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRjYXNlIERhdGFUeXBlLk9iamVjdDogcmV0dXJuIEpTT04ucGFyc2UocmVhZGVyLnJlYWQocmVhZEludFZRTChyZWFkZXIpKS50b1N0cmluZygpKTtcblx0XHRjYXNlIERhdGFUeXBlLkludDogcmV0dXJuIHJlYWRJbnRWUUwocmVhZGVyKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ1JlcXVlc3Qge1xuXHRyZXF1ZXN0OiBJUmF3UHJvbWlzZVJlcXVlc3QgfCBJUmF3RXZlbnRMaXN0ZW5SZXF1ZXN0O1xuXHR0aW1lb3V0VGltZXI6IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIENoYW5uZWxTZXJ2ZXI8VENvbnRleHQgPSBzdHJpbmc+IGltcGxlbWVudHMgSUNoYW5uZWxTZXJ2ZXI8VENvbnRleHQ+LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBjaGFubmVscyA9IG5ldyBNYXA8c3RyaW5nLCBJU2VydmVyQ2hhbm5lbDxUQ29udGV4dD4+KCk7XG5cdHByaXZhdGUgYWN0aXZlUmVxdWVzdHMgPSBuZXcgTWFwPG51bWJlciwgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcHJvdG9jb2xMaXN0ZW5lcjogSURpc3Bvc2FibGUgfCBudWxsO1xuXG5cdC8vIFJlcXVlc3RzIG1pZ2h0IGNvbWUgaW4gZm9yIGNoYW5uZWxzIHdoaWNoIGFyZSBub3QgeWV0IHJlZ2lzdGVyZWQuXG5cdC8vIFRoZXkgd2lsbCB0aW1lb3V0IGFmdGVyIGB0aW1lb3V0RGVsYXlgLlxuXHRwcml2YXRlIHBlbmRpbmdSZXF1ZXN0cyA9IG5ldyBNYXA8c3RyaW5nLCBQZW5kaW5nUmVxdWVzdFtdPigpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcHJvdG9jb2w6IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sLCBwcml2YXRlIGN0eDogVENvbnRleHQsIHByaXZhdGUgbG9nZ2VyOiBJSVBDTG9nZ2VyIHwgbnVsbCA9IG51bGwsIHByaXZhdGUgdGltZW91dERlbGF5OiBudW1iZXIgPSAxMDAwKSB7XG5cdFx0dGhpcy5wcm90b2NvbExpc3RlbmVyID0gdGhpcy5wcm90b2NvbC5vbk1lc3NhZ2UobXNnID0+IHRoaXMub25SYXdNZXNzYWdlKG1zZykpO1xuXHRcdHRoaXMuc2VuZFJlc3BvbnNlKHsgdHlwZTogUmVzcG9uc2VUeXBlLkluaXRpYWxpemUgfSk7XG5cdH1cblxuXHRyZWdpc3RlckNoYW5uZWwoY2hhbm5lbE5hbWU6IHN0cmluZywgY2hhbm5lbDogSVNlcnZlckNoYW5uZWw8VENvbnRleHQ+KTogdm9pZCB7XG5cdFx0dGhpcy5jaGFubmVscy5zZXQoY2hhbm5lbE5hbWUsIGNoYW5uZWwpO1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzcyNTMxXG5cdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmZsdXNoUGVuZGluZ1JlcXVlc3RzKGNoYW5uZWxOYW1lKSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIHNlbmRSZXNwb25zZShyZXNwb25zZTogSVJhd1Jlc3BvbnNlKTogdm9pZCB7XG5cdFx0c3dpdGNoIChyZXNwb25zZS50eXBlKSB7XG5cdFx0XHRjYXNlIFJlc3BvbnNlVHlwZS5Jbml0aWFsaXplOiB7XG5cdFx0XHRcdGNvbnN0IG1zZ0xlbmd0aCA9IHRoaXMuc2VuZChbcmVzcG9uc2UudHlwZV0pO1xuXHRcdFx0XHR0aGlzLmxvZ2dlcj8ubG9nT3V0Z29pbmcobXNnTGVuZ3RoLCAwLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgcmVzcG9uc2VUeXBlVG9TdHIocmVzcG9uc2UudHlwZSkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VTdWNjZXNzOlxuXHRcdFx0Y2FzZSBSZXNwb25zZVR5cGUuUHJvbWlzZUVycm9yOlxuXHRcdFx0Y2FzZSBSZXNwb25zZVR5cGUuRXZlbnRGaXJlOlxuXHRcdFx0Y2FzZSBSZXNwb25zZVR5cGUuUHJvbWlzZUVycm9yT2JqOiB7XG5cdFx0XHRcdGNvbnN0IG1zZ0xlbmd0aCA9IHRoaXMuc2VuZChbcmVzcG9uc2UudHlwZSwgcmVzcG9uc2UuaWRdLCByZXNwb25zZS5kYXRhKTtcblx0XHRcdFx0dGhpcy5sb2dnZXI/LmxvZ091dGdvaW5nKG1zZ0xlbmd0aCwgcmVzcG9uc2UuaWQsIFJlcXVlc3RJbml0aWF0b3IuT3RoZXJTaWRlLCByZXNwb25zZVR5cGVUb1N0cihyZXNwb25zZS50eXBlKSwgcmVzcG9uc2UuZGF0YSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNlbmQoaGVhZGVyOiBhbnksIGJvZHk6IGFueSA9IHVuZGVmaW5lZCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gbmV3IEJ1ZmZlcldyaXRlcigpO1xuXHRcdHNlcmlhbGl6ZSh3cml0ZXIsIGhlYWRlcik7XG5cdFx0c2VyaWFsaXplKHdyaXRlciwgYm9keSk7XG5cdFx0cmV0dXJuIHRoaXMuc2VuZEJ1ZmZlcih3cml0ZXIuYnVmZmVyKTtcblx0fVxuXG5cdHByaXZhdGUgc2VuZEJ1ZmZlcihtZXNzYWdlOiBWU0J1ZmZlcik6IG51bWJlciB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMucHJvdG9jb2wuc2VuZChtZXNzYWdlKTtcblx0XHRcdHJldHVybiBtZXNzYWdlLmJ5dGVMZW5ndGg7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBub29wXG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUmF3TWVzc2FnZShtZXNzYWdlOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdGNvbnN0IHJlYWRlciA9IG5ldyBCdWZmZXJSZWFkZXIobWVzc2FnZSk7XG5cdFx0Y29uc3QgaGVhZGVyID0gZGVzZXJpYWxpemUocmVhZGVyKTtcblx0XHRjb25zdCBib2R5ID0gZGVzZXJpYWxpemUocmVhZGVyKTtcblx0XHRjb25zdCB0eXBlID0gaGVhZGVyWzBdIGFzIFJlcXVlc3RUeXBlO1xuXG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLlByb21pc2U6XG5cdFx0XHRcdHRoaXMubG9nZ2VyPy5sb2dJbmNvbWluZyhtZXNzYWdlLmJ5dGVMZW5ndGgsIGhlYWRlclsxXSwgUmVxdWVzdEluaXRpYXRvci5PdGhlclNpZGUsIGAke3JlcXVlc3RUeXBlVG9TdHIodHlwZSl9OiAke2hlYWRlclsyXX0uJHtoZWFkZXJbM119YCwgYm9keSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLm9uUHJvbWlzZSh7IHR5cGUsIGlkOiBoZWFkZXJbMV0sIGNoYW5uZWxOYW1lOiBoZWFkZXJbMl0sIG5hbWU6IGhlYWRlclszXSwgYXJnOiBib2R5IH0pO1xuXHRcdFx0Y2FzZSBSZXF1ZXN0VHlwZS5FdmVudExpc3Rlbjpcblx0XHRcdFx0dGhpcy5sb2dnZXI/LmxvZ0luY29taW5nKG1lc3NhZ2UuYnl0ZUxlbmd0aCwgaGVhZGVyWzFdLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgYCR7cmVxdWVzdFR5cGVUb1N0cih0eXBlKX06ICR7aGVhZGVyWzJdfS4ke2hlYWRlclszXX1gLCBib2R5KTtcblx0XHRcdFx0cmV0dXJuIHRoaXMub25FdmVudExpc3Rlbih7IHR5cGUsIGlkOiBoZWFkZXJbMV0sIGNoYW5uZWxOYW1lOiBoZWFkZXJbMl0sIG5hbWU6IGhlYWRlclszXSwgYXJnOiBib2R5IH0pO1xuXHRcdFx0Y2FzZSBSZXF1ZXN0VHlwZS5Qcm9taXNlQ2FuY2VsOlxuXHRcdFx0XHR0aGlzLmxvZ2dlcj8ubG9nSW5jb21pbmcobWVzc2FnZS5ieXRlTGVuZ3RoLCBoZWFkZXJbMV0sIFJlcXVlc3RJbml0aWF0b3IuT3RoZXJTaWRlLCBgJHtyZXF1ZXN0VHlwZVRvU3RyKHR5cGUpfWApO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5kaXNwb3NlQWN0aXZlUmVxdWVzdCh7IHR5cGUsIGlkOiBoZWFkZXJbMV0gfSk7XG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLkV2ZW50RGlzcG9zZTpcblx0XHRcdFx0dGhpcy5sb2dnZXI/LmxvZ0luY29taW5nKG1lc3NhZ2UuYnl0ZUxlbmd0aCwgaGVhZGVyWzFdLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgYCR7cmVxdWVzdFR5cGVUb1N0cih0eXBlKX1gKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGlzcG9zZUFjdGl2ZVJlcXVlc3QoeyB0eXBlLCBpZDogaGVhZGVyWzFdIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Qcm9taXNlKHJlcXVlc3Q6IElSYXdQcm9taXNlUmVxdWVzdCk6IHZvaWQge1xuXHRcdGNvbnN0IGNoYW5uZWwgPSB0aGlzLmNoYW5uZWxzLmdldChyZXF1ZXN0LmNoYW5uZWxOYW1lKTtcblxuXHRcdGlmICghY2hhbm5lbCkge1xuXHRcdFx0dGhpcy5jb2xsZWN0UGVuZGluZ1JlcXVlc3QocmVxdWVzdCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRsZXQgcHJvbWlzZTogUHJvbWlzZTxhbnk+O1xuXG5cdFx0dHJ5IHtcblx0XHRcdHByb21pc2UgPSBjaGFubmVsLmNhbGwodGhpcy5jdHgsIHJlcXVlc3QubmFtZSwgcmVxdWVzdC5hcmcsIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHByb21pc2UgPSBQcm9taXNlLnJlamVjdChlcnIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlkID0gcmVxdWVzdC5pZDtcblxuXHRcdHByb21pc2UudGhlbihkYXRhID0+IHtcblx0XHRcdHRoaXMuc2VuZFJlc3BvbnNlKHsgaWQsIGRhdGEsIHR5cGU6IFJlc3BvbnNlVHlwZS5Qcm9taXNlU3VjY2VzcyB9KTtcblx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0aWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG5cdFx0XHRcdHRoaXMuc2VuZFJlc3BvbnNlKHtcblx0XHRcdFx0XHRpZCwgZGF0YToge1xuXHRcdFx0XHRcdFx0bWVzc2FnZTogZXJyLm1lc3NhZ2UsXG5cdFx0XHRcdFx0XHRuYW1lOiBlcnIubmFtZSxcblx0XHRcdFx0XHRcdHN0YWNrOiBlcnIuc3RhY2sgPyBlcnIuc3RhY2suc3BsaXQoJ1xcbicpIDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSwgdHlwZTogUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvclxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2VuZFJlc3BvbnNlKHsgaWQsIGRhdGE6IGVyciwgdHlwZTogUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvck9iaiB9KTtcblx0XHRcdH1cblx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5hY3RpdmVSZXF1ZXN0cy5kZWxldGUocmVxdWVzdC5pZCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9EaXNwb3NhYmxlKCgpID0+IGNhbmNlbGxhdGlvblRva2VuU291cmNlLmNhbmNlbCgpKTtcblx0XHR0aGlzLmFjdGl2ZVJlcXVlc3RzLnNldChyZXF1ZXN0LmlkLCBkaXNwb3NhYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgb25FdmVudExpc3RlbihyZXF1ZXN0OiBJUmF3RXZlbnRMaXN0ZW5SZXF1ZXN0KTogdm9pZCB7XG5cdFx0Y29uc3QgY2hhbm5lbCA9IHRoaXMuY2hhbm5lbHMuZ2V0KHJlcXVlc3QuY2hhbm5lbE5hbWUpO1xuXG5cdFx0aWYgKCFjaGFubmVsKSB7XG5cdFx0XHR0aGlzLmNvbGxlY3RQZW5kaW5nUmVxdWVzdChyZXF1ZXN0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpZCA9IHJlcXVlc3QuaWQ7XG5cdFx0Y29uc3QgZXZlbnQgPSBjaGFubmVsLmxpc3Rlbih0aGlzLmN0eCwgcmVxdWVzdC5uYW1lLCByZXF1ZXN0LmFyZyk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGV2ZW50KGRhdGEgPT4gdGhpcy5zZW5kUmVzcG9uc2UoeyBpZCwgZGF0YSwgdHlwZTogUmVzcG9uc2VUeXBlLkV2ZW50RmlyZSB9KSk7XG5cblx0XHR0aGlzLmFjdGl2ZVJlcXVlc3RzLnNldChyZXF1ZXN0LmlkLCBkaXNwb3NhYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgZGlzcG9zZUFjdGl2ZVJlcXVlc3QocmVxdWVzdDogSVJhd1JlcXVlc3QpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpcy5hY3RpdmVSZXF1ZXN0cy5nZXQocmVxdWVzdC5pZCk7XG5cblx0XHRpZiAoZGlzcG9zYWJsZSkge1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmFjdGl2ZVJlcXVlc3RzLmRlbGV0ZShyZXF1ZXN0LmlkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbGxlY3RQZW5kaW5nUmVxdWVzdChyZXF1ZXN0OiBJUmF3UHJvbWlzZVJlcXVlc3QgfCBJUmF3RXZlbnRMaXN0ZW5SZXF1ZXN0KTogdm9pZCB7XG5cdFx0bGV0IHBlbmRpbmdSZXF1ZXN0cyA9IHRoaXMucGVuZGluZ1JlcXVlc3RzLmdldChyZXF1ZXN0LmNoYW5uZWxOYW1lKTtcblxuXHRcdGlmICghcGVuZGluZ1JlcXVlc3RzKSB7XG5cdFx0XHRwZW5kaW5nUmVxdWVzdHMgPSBbXTtcblx0XHRcdHRoaXMucGVuZGluZ1JlcXVlc3RzLnNldChyZXF1ZXN0LmNoYW5uZWxOYW1lLCBwZW5kaW5nUmVxdWVzdHMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGBVbmtub3duIGNoYW5uZWw6ICR7cmVxdWVzdC5jaGFubmVsTmFtZX1gKTtcblxuXHRcdFx0aWYgKHJlcXVlc3QudHlwZSA9PT0gUmVxdWVzdFR5cGUuUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLnNlbmRSZXNwb25zZSh7XG5cdFx0XHRcdFx0aWQ6IHJlcXVlc3QuaWQsXG5cdFx0XHRcdFx0ZGF0YTogeyBuYW1lOiAnVW5rbm93biBjaGFubmVsJywgbWVzc2FnZTogYENoYW5uZWwgbmFtZSAnJHtyZXF1ZXN0LmNoYW5uZWxOYW1lfScgdGltZWQgb3V0IGFmdGVyICR7dGhpcy50aW1lb3V0RGVsYXl9bXNgLCBzdGFjazogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0dHlwZTogUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvclxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9LCB0aGlzLnRpbWVvdXREZWxheSk7XG5cblx0XHRwZW5kaW5nUmVxdWVzdHMucHVzaCh7IHJlcXVlc3QsIHRpbWVvdXRUaW1lcjogdGltZXIgfSk7XG5cdH1cblxuXHRwcml2YXRlIGZsdXNoUGVuZGluZ1JlcXVlc3RzKGNoYW5uZWxOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCByZXF1ZXN0cyA9IHRoaXMucGVuZGluZ1JlcXVlc3RzLmdldChjaGFubmVsTmFtZSk7XG5cblx0XHRpZiAocmVxdWVzdHMpIHtcblx0XHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiByZXF1ZXN0cykge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQocmVxdWVzdC50aW1lb3V0VGltZXIpO1xuXG5cdFx0XHRcdHN3aXRjaCAocmVxdWVzdC5yZXF1ZXN0LnR5cGUpIHtcblx0XHRcdFx0XHRjYXNlIFJlcXVlc3RUeXBlLlByb21pc2U6IHRoaXMub25Qcm9taXNlKHJlcXVlc3QucmVxdWVzdCk7IGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgUmVxdWVzdFR5cGUuRXZlbnRMaXN0ZW46IHRoaXMub25FdmVudExpc3RlbihyZXF1ZXN0LnJlcXVlc3QpOyBicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnBlbmRpbmdSZXF1ZXN0cy5kZWxldGUoY2hhbm5lbE5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnByb3RvY29sTGlzdGVuZXIpIHtcblx0XHRcdHRoaXMucHJvdG9jb2xMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLnByb3RvY29sTGlzdGVuZXIgPSBudWxsO1xuXHRcdH1cblx0XHRkaXNwb3NlKHRoaXMuYWN0aXZlUmVxdWVzdHMudmFsdWVzKCkpO1xuXHRcdHRoaXMuYWN0aXZlUmVxdWVzdHMuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBSZXF1ZXN0SW5pdGlhdG9yIHtcblx0TG9jYWxTaWRlID0gMCxcblx0T3RoZXJTaWRlID0gMVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElJUENMb2dnZXIge1xuXHRsb2dJbmNvbWluZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxdWVzdElkOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkO1xuXHRsb2dPdXRnb2luZyhtc2dMZW5ndGg6IG51bWJlciwgcmVxdWVzdElkOiBudW1iZXIsIGluaXRpYXRvcjogUmVxdWVzdEluaXRpYXRvciwgc3RyOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhbm5lbENsaWVudCBpbXBsZW1lbnRzIElDaGFubmVsQ2xpZW50LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBpc0Rpc3Bvc2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgc3RhdGU6IFN0YXRlID0gU3RhdGUuVW5pbml0aWFsaXplZDtcblx0cHJpdmF0ZSBhY3RpdmVSZXF1ZXN0cyA9IG5ldyBTZXQ8SURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgaGFuZGxlcnMgPSBuZXcgTWFwPG51bWJlciwgSUhhbmRsZXI+KCk7XG5cdHByaXZhdGUgbGFzdFJlcXVlc3RJZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBwcm90b2NvbExpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IG51bGw7XG5cdHByaXZhdGUgbG9nZ2VyOiBJSVBDTG9nZ2VyIHwgbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEluaXRpYWxpemUgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZEluaXRpYWxpemUgPSB0aGlzLl9vbkRpZEluaXRpYWxpemUuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBwcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wsIGxvZ2dlcjogSUlQQ0xvZ2dlciB8IG51bGwgPSBudWxsKSB7XG5cdFx0dGhpcy5wcm90b2NvbExpc3RlbmVyID0gdGhpcy5wcm90b2NvbC5vbk1lc3NhZ2UobXNnID0+IHRoaXMub25CdWZmZXIobXNnKSk7XG5cdFx0dGhpcy5sb2dnZXIgPSBsb2dnZXI7XG5cdH1cblxuXHRnZXRDaGFubmVsPFQgZXh0ZW5kcyBJQ2hhbm5lbD4oY2hhbm5lbE5hbWU6IHN0cmluZyk6IFQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdHJldHVybiB7XG5cdFx0XHRjYWxsKGNvbW1hbmQ6IHN0cmluZywgYXJnPzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbj86IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0XHRcdGlmICh0aGF0LmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGF0LnJlcXVlc3RQcm9taXNlKGNoYW5uZWxOYW1lLCBjb21tYW5kLCBhcmcsIGNhbmNlbGxhdGlvblRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRsaXN0ZW4oZXZlbnQ6IHN0cmluZywgYXJnOiBhbnkpIHtcblx0XHRcdFx0aWYgKHRoYXQuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJldHVybiBFdmVudC5Ob25lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGF0LnJlcXVlc3RFdmVudChjaGFubmVsTmFtZSwgZXZlbnQsIGFyZyk7XG5cdFx0XHR9XG5cdFx0fSBhcyBUO1xuXHR9XG5cblx0cHJpdmF0ZSByZXF1ZXN0UHJvbWlzZShjaGFubmVsTmFtZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGFyZz86IGFueSwgY2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTx1bmtub3duPiB7XG5cdFx0Y29uc3QgaWQgPSB0aGlzLmxhc3RSZXF1ZXN0SWQrKztcblx0XHRjb25zdCB0eXBlID0gUmVxdWVzdFR5cGUuUHJvbWlzZTtcblx0XHRjb25zdCByZXF1ZXN0OiBJUmF3UmVxdWVzdCA9IHsgaWQsIHR5cGUsIGNoYW5uZWxOYW1lLCBuYW1lLCBhcmcgfTtcblxuXHRcdGlmIChjYW5jZWxsYXRpb25Ub2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0XHR9XG5cblx0XHRsZXQgZGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG5cdFx0bGV0IGRpc3Bvc2FibGVXaXRoUmVxdWVzdENhbmNlbDogSURpc3Bvc2FibGU7XG5cblx0XHRjb25zdCByZXN1bHQgPSBuZXcgUHJvbWlzZSgoYywgZSkgPT4ge1xuXHRcdFx0aWYgKGNhbmNlbGxhdGlvblRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybiBlKG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZG9SZXF1ZXN0ID0gKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBoYW5kbGVyOiBJSGFuZGxlciA9IHJlc3BvbnNlID0+IHtcblx0XHRcdFx0XHRzd2l0Y2ggKHJlc3BvbnNlLnR5cGUpIHtcblx0XHRcdFx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VTdWNjZXNzOlxuXHRcdFx0XHRcdFx0XHR0aGlzLmhhbmRsZXJzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdFx0XHRcdGMocmVzcG9uc2UuZGF0YSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0XHRjYXNlIFJlc3BvbnNlVHlwZS5Qcm9taXNlRXJyb3I6IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5oYW5kbGVycy5kZWxldGUoaWQpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBlcnJvciA9IG5ldyBFcnJvcihyZXNwb25zZS5kYXRhLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHQoPGFueT5lcnJvcikuc3RhY2sgPSBBcnJheS5pc0FycmF5KHJlc3BvbnNlLmRhdGEuc3RhY2spID8gcmVzcG9uc2UuZGF0YS5zdGFjay5qb2luKCdcXG4nKSA6IHJlc3BvbnNlLmRhdGEuc3RhY2s7XG5cdFx0XHRcdFx0XHRcdGVycm9yLm5hbWUgPSByZXNwb25zZS5kYXRhLm5hbWU7XG5cdFx0XHRcdFx0XHRcdGUoZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvck9iajpcblx0XHRcdFx0XHRcdFx0dGhpcy5oYW5kbGVycy5kZWxldGUoaWQpO1xuXHRcdFx0XHRcdFx0XHRlKHJlc3BvbnNlLmRhdGEpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5oYW5kbGVycy5zZXQoaWQsIGhhbmRsZXIpO1xuXHRcdFx0XHR0aGlzLnNlbmRSZXF1ZXN0KHJlcXVlc3QpO1xuXHRcdFx0fTtcblxuXHRcdFx0bGV0IHVuaW5pdGlhbGl6ZWRQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPiB8IG51bGwgPSBudWxsO1xuXHRcdFx0aWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLklkbGUpIHtcblx0XHRcdFx0ZG9SZXF1ZXN0KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR1bmluaXRpYWxpemVkUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKF8gPT4gdGhpcy53aGVuSW5pdGlhbGl6ZWQoKSk7XG5cdFx0XHRcdHVuaW5pdGlhbGl6ZWRQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdHVuaW5pdGlhbGl6ZWRQcm9taXNlID0gbnVsbDtcblx0XHRcdFx0XHRkb1JlcXVlc3QoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNhbmNlbCA9ICgpID0+IHtcblx0XHRcdFx0aWYgKHVuaW5pdGlhbGl6ZWRQcm9taXNlKSB7XG5cdFx0XHRcdFx0dW5pbml0aWFsaXplZFByb21pc2UuY2FuY2VsKCk7XG5cdFx0XHRcdFx0dW5pbml0aWFsaXplZFByb21pc2UgPSBudWxsO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc2VuZFJlcXVlc3QoeyBpZCwgdHlwZTogUmVxdWVzdFR5cGUuUHJvbWlzZUNhbmNlbCB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGUobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdFx0fTtcblxuXHRcdFx0ZGlzcG9zYWJsZSA9IGNhbmNlbGxhdGlvblRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKGNhbmNlbCk7XG5cdFx0XHRkaXNwb3NhYmxlV2l0aFJlcXVlc3RDYW5jZWwgPSB7XG5cdFx0XHRcdGRpc3Bvc2U6IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbigoKSA9PiB7XG5cdFx0XHRcdFx0Y2FuY2VsKCk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmFjdGl2ZVJlcXVlc3RzLmFkZChkaXNwb3NhYmxlV2l0aFJlcXVlc3RDYW5jZWwpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdC5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGU/LmRpc3Bvc2UoKTsgLy8gU2VlbiBhcyB1bmRlZmluZWQgaW4gdGVzdHMuXG5cdFx0XHR0aGlzLmFjdGl2ZVJlcXVlc3RzLmRlbGV0ZShkaXNwb3NhYmxlV2l0aFJlcXVlc3RDYW5jZWwpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZXF1ZXN0RXZlbnQoY2hhbm5lbE5hbWU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBhcmc/OiBhbnkpOiBFdmVudDxhbnk+IHtcblx0XHRjb25zdCBpZCA9IHRoaXMubGFzdFJlcXVlc3RJZCsrO1xuXHRcdGNvbnN0IHR5cGUgPSBSZXF1ZXN0VHlwZS5FdmVudExpc3Rlbjtcblx0XHRjb25zdCByZXF1ZXN0OiBJUmF3UmVxdWVzdCA9IHsgaWQsIHR5cGUsIGNoYW5uZWxOYW1lLCBuYW1lLCBhcmcgfTtcblxuXHRcdGxldCB1bmluaXRpYWxpemVkUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD4gfCBudWxsID0gbnVsbDtcblxuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxhbnk+KHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZG9SZXF1ZXN0ID0gKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuYWN0aXZlUmVxdWVzdHMuYWRkKGVtaXR0ZXIpO1xuXHRcdFx0XHRcdHRoaXMuc2VuZFJlcXVlc3QocmVxdWVzdCk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5JZGxlKSB7XG5cdFx0XHRcdFx0ZG9SZXF1ZXN0KCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dW5pbml0aWFsaXplZFByb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShfID0+IHRoaXMud2hlbkluaXRpYWxpemVkKCkpO1xuXHRcdFx0XHRcdHVuaW5pdGlhbGl6ZWRQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0dW5pbml0aWFsaXplZFByb21pc2UgPSBudWxsO1xuXHRcdFx0XHRcdFx0ZG9SZXF1ZXN0KCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcjogKCkgPT4ge1xuXHRcdFx0XHRpZiAodW5pbml0aWFsaXplZFByb21pc2UpIHtcblx0XHRcdFx0XHR1bmluaXRpYWxpemVkUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdFx0XHR1bmluaXRpYWxpemVkUHJvbWlzZSA9IG51bGw7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVSZXF1ZXN0cy5kZWxldGUoZW1pdHRlcik7XG5cdFx0XHRcdFx0dGhpcy5zZW5kUmVxdWVzdCh7IGlkLCB0eXBlOiBSZXF1ZXN0VHlwZS5FdmVudERpc3Bvc2UgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGhhbmRsZXI6IElIYW5kbGVyID0gKHJlczogSVJhd1Jlc3BvbnNlKSA9PiBlbWl0dGVyLmZpcmUoKHJlcyBhcyBJUmF3RXZlbnRGaXJlUmVzcG9uc2UpLmRhdGEpO1xuXHRcdHRoaXMuaGFuZGxlcnMuc2V0KGlkLCBoYW5kbGVyKTtcblxuXHRcdHJldHVybiBlbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kUmVxdWVzdChyZXF1ZXN0OiBJUmF3UmVxdWVzdCk6IHZvaWQge1xuXHRcdHN3aXRjaCAocmVxdWVzdC50eXBlKSB7XG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLlByb21pc2U6XG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLkV2ZW50TGlzdGVuOiB7XG5cdFx0XHRcdGNvbnN0IG1zZ0xlbmd0aCA9IHRoaXMuc2VuZChbcmVxdWVzdC50eXBlLCByZXF1ZXN0LmlkLCByZXF1ZXN0LmNoYW5uZWxOYW1lLCByZXF1ZXN0Lm5hbWVdLCByZXF1ZXN0LmFyZyk7XG5cdFx0XHRcdHRoaXMubG9nZ2VyPy5sb2dPdXRnb2luZyhtc2dMZW5ndGgsIHJlcXVlc3QuaWQsIFJlcXVlc3RJbml0aWF0b3IuTG9jYWxTaWRlLCBgJHtyZXF1ZXN0VHlwZVRvU3RyKHJlcXVlc3QudHlwZSl9OiAke3JlcXVlc3QuY2hhbm5lbE5hbWV9LiR7cmVxdWVzdC5uYW1lfWAsIHJlcXVlc3QuYXJnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLlByb21pc2VDYW5jZWw6XG5cdFx0XHRjYXNlIFJlcXVlc3RUeXBlLkV2ZW50RGlzcG9zZToge1xuXHRcdFx0XHRjb25zdCBtc2dMZW5ndGggPSB0aGlzLnNlbmQoW3JlcXVlc3QudHlwZSwgcmVxdWVzdC5pZF0pO1xuXHRcdFx0XHR0aGlzLmxvZ2dlcj8ubG9nT3V0Z29pbmcobXNnTGVuZ3RoLCByZXF1ZXN0LmlkLCBSZXF1ZXN0SW5pdGlhdG9yLkxvY2FsU2lkZSwgcmVxdWVzdFR5cGVUb1N0cihyZXF1ZXN0LnR5cGUpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2VuZChoZWFkZXI6IGFueSwgYm9keTogYW55ID0gdW5kZWZpbmVkKTogbnVtYmVyIHtcblx0XHRjb25zdCB3cml0ZXIgPSBuZXcgQnVmZmVyV3JpdGVyKCk7XG5cdFx0c2VyaWFsaXplKHdyaXRlciwgaGVhZGVyKTtcblx0XHRzZXJpYWxpemUod3JpdGVyLCBib2R5KTtcblx0XHRyZXR1cm4gdGhpcy5zZW5kQnVmZmVyKHdyaXRlci5idWZmZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kQnVmZmVyKG1lc3NhZ2U6IFZTQnVmZmVyKTogbnVtYmVyIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5wcm90b2NvbC5zZW5kKG1lc3NhZ2UpO1xuXHRcdFx0cmV0dXJuIG1lc3NhZ2UuYnl0ZUxlbmd0aDtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdC8vIG5vb3Bcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25CdWZmZXIobWVzc2FnZTogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRjb25zdCByZWFkZXIgPSBuZXcgQnVmZmVyUmVhZGVyKG1lc3NhZ2UpO1xuXHRcdGNvbnN0IGhlYWRlciA9IGRlc2VyaWFsaXplKHJlYWRlcik7XG5cdFx0Y29uc3QgYm9keSA9IGRlc2VyaWFsaXplKHJlYWRlcik7XG5cdFx0Y29uc3QgdHlwZTogUmVzcG9uc2VUeXBlID0gaGVhZGVyWzBdO1xuXG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlIFJlc3BvbnNlVHlwZS5Jbml0aWFsaXplOlxuXHRcdFx0XHR0aGlzLmxvZ2dlcj8ubG9nSW5jb21pbmcobWVzc2FnZS5ieXRlTGVuZ3RoLCAwLCBSZXF1ZXN0SW5pdGlhdG9yLkxvY2FsU2lkZSwgcmVzcG9uc2VUeXBlVG9TdHIodHlwZSkpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5vblJlc3BvbnNlKHsgdHlwZTogaGVhZGVyWzBdIH0pO1xuXG5cdFx0XHRjYXNlIFJlc3BvbnNlVHlwZS5Qcm9taXNlU3VjY2Vzczpcblx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvcjpcblx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLkV2ZW50RmlyZTpcblx0XHRcdGNhc2UgUmVzcG9uc2VUeXBlLlByb21pc2VFcnJvck9iajpcblx0XHRcdFx0dGhpcy5sb2dnZXI/LmxvZ0luY29taW5nKG1lc3NhZ2UuYnl0ZUxlbmd0aCwgaGVhZGVyWzFdLCBSZXF1ZXN0SW5pdGlhdG9yLkxvY2FsU2lkZSwgcmVzcG9uc2VUeXBlVG9TdHIodHlwZSksIGJvZHkpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5vblJlc3BvbnNlKHsgdHlwZTogaGVhZGVyWzBdLCBpZDogaGVhZGVyWzFdLCBkYXRhOiBib2R5IH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25SZXNwb25zZShyZXNwb25zZTogSVJhd1Jlc3BvbnNlKTogdm9pZCB7XG5cdFx0aWYgKHJlc3BvbnNlLnR5cGUgPT09IFJlc3BvbnNlVHlwZS5Jbml0aWFsaXplKSB7XG5cdFx0XHR0aGlzLnN0YXRlID0gU3RhdGUuSWRsZTtcblx0XHRcdHRoaXMuX29uRGlkSW5pdGlhbGl6ZS5maXJlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFuZGxlciA9IHRoaXMuaGFuZGxlcnMuZ2V0KHJlc3BvbnNlLmlkKTtcblxuXHRcdGhhbmRsZXI/LihyZXNwb25zZSk7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgb25EaWRJbml0aWFsaXplUHJvbWlzZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gRXZlbnQudG9Qcm9taXNlKHRoaXMub25EaWRJbml0aWFsaXplKTtcblx0fVxuXG5cdHByaXZhdGUgd2hlbkluaXRpYWxpemVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5JZGxlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLm9uRGlkSW5pdGlhbGl6ZVByb21pc2U7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmlzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdGlmICh0aGlzLnByb3RvY29sTGlzdGVuZXIpIHtcblx0XHRcdHRoaXMucHJvdG9jb2xMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLnByb3RvY29sTGlzdGVuZXIgPSBudWxsO1xuXHRcdH1cblx0XHRkaXNwb3NlKHRoaXMuYWN0aXZlUmVxdWVzdHMudmFsdWVzKCkpO1xuXHRcdHRoaXMuYWN0aXZlUmVxdWVzdHMuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENsaWVudENvbm5lY3Rpb25FdmVudCB7XG5cdHByb3RvY29sOiBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbDtcblx0b25EaWRDbGllbnREaXNjb25uZWN0OiBFdmVudDx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIENvbm5lY3Rpb248VENvbnRleHQ+IGV4dGVuZHMgQ2xpZW50PFRDb250ZXh0PiB7XG5cdHJlYWRvbmx5IGNoYW5uZWxTZXJ2ZXI6IENoYW5uZWxTZXJ2ZXI8VENvbnRleHQ+O1xuXHRyZWFkb25seSBjaGFubmVsQ2xpZW50OiBDaGFubmVsQ2xpZW50O1xufVxuXG4vKipcbiAqIEFuIGBJUENTZXJ2ZXJgIGlzIGJvdGggYSBjaGFubmVsIHNlcnZlciBhbmQgYSByb3V0aW5nIGNoYW5uZWxcbiAqIGNsaWVudC5cbiAqXG4gKiBBcyB0aGUgb3duZXIgb2YgYSBwcm90b2NvbCwgeW91IHNob3VsZCBleHRlbmQgYm90aCB0aGlzXG4gKiBhbmQgdGhlIGBJUENDbGllbnRgIGNsYXNzZXMgdG8gZ2V0IElQQyBpbXBsZW1lbnRhdGlvbnNcbiAqIGZvciB5b3VyIHByb3RvY29sLlxuICovXG5leHBvcnQgY2xhc3MgSVBDU2VydmVyPFRDb250ZXh0ID0gc3RyaW5nPiBpbXBsZW1lbnRzIElDaGFubmVsU2VydmVyPFRDb250ZXh0PiwgSVJvdXRpbmdDaGFubmVsQ2xpZW50PFRDb250ZXh0PiwgSUNvbm5lY3Rpb25IdWI8VENvbnRleHQ+LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBjaGFubmVscyA9IG5ldyBNYXA8c3RyaW5nLCBJU2VydmVyQ2hhbm5lbDxUQ29udGV4dD4+KCk7XG5cdHByaXZhdGUgX2Nvbm5lY3Rpb25zID0gbmV3IFNldDxDb25uZWN0aW9uPFRDb250ZXh0Pj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEFkZENvbm5lY3Rpb24gPSBuZXcgRW1pdHRlcjxDb25uZWN0aW9uPFRDb250ZXh0Pj4oKTtcblx0cmVhZG9ubHkgb25EaWRBZGRDb25uZWN0aW9uOiBFdmVudDxDb25uZWN0aW9uPFRDb250ZXh0Pj4gPSB0aGlzLl9vbkRpZEFkZENvbm5lY3Rpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmVDb25uZWN0aW9uID0gbmV3IEVtaXR0ZXI8Q29ubmVjdGlvbjxUQ29udGV4dD4+KCk7XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlQ29ubmVjdGlvbjogRXZlbnQ8Q29ubmVjdGlvbjxUQ29udGV4dD4+ID0gdGhpcy5fb25EaWRSZW1vdmVDb25uZWN0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Z2V0IGNvbm5lY3Rpb25zKCk6IENvbm5lY3Rpb248VENvbnRleHQ+W10ge1xuXHRcdGNvbnN0IHJlc3VsdDogQ29ubmVjdGlvbjxUQ29udGV4dD5bXSA9IFtdO1xuXHRcdHRoaXMuX2Nvbm5lY3Rpb25zLmZvckVhY2goY3R4ID0+IHJlc3VsdC5wdXNoKGN0eCkpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihvbkRpZENsaWVudENvbm5lY3Q6IEV2ZW50PENsaWVudENvbm5lY3Rpb25FdmVudD4sIGlwY0xvZ2dlcj86IElJUENMb2dnZXIgfCBudWxsLCB0aW1lb3V0RGVsYXk/OiBudW1iZXIpIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChvbkRpZENsaWVudENvbm5lY3QoKHsgcHJvdG9jb2wsIG9uRGlkQ2xpZW50RGlzY29ubmVjdCB9KSA9PiB7XG5cdFx0XHRjb25zdCBvbkZpcnN0TWVzc2FnZSA9IEV2ZW50Lm9uY2UocHJvdG9jb2wub25NZXNzYWdlKTtcblxuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25GaXJzdE1lc3NhZ2UobXNnID0+IHtcblx0XHRcdFx0Y29uc3QgcmVhZGVyID0gbmV3IEJ1ZmZlclJlYWRlcihtc2cpO1xuXHRcdFx0XHRjb25zdCBjdHggPSBkZXNlcmlhbGl6ZShyZWFkZXIpIGFzIFRDb250ZXh0O1xuXG5cdFx0XHRcdGNvbnN0IGNoYW5uZWxTZXJ2ZXIgPSBuZXcgQ2hhbm5lbFNlcnZlcihwcm90b2NvbCwgY3R4LCBpcGNMb2dnZXIsIHRpbWVvdXREZWxheSk7XG5cdFx0XHRcdGNvbnN0IGNoYW5uZWxDbGllbnQgPSBuZXcgQ2hhbm5lbENsaWVudChwcm90b2NvbCwgaXBjTG9nZ2VyKTtcblxuXHRcdFx0XHR0aGlzLmNoYW5uZWxzLmZvckVhY2goKGNoYW5uZWwsIG5hbWUpID0+IGNoYW5uZWxTZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKG5hbWUsIGNoYW5uZWwpKTtcblxuXHRcdFx0XHRjb25zdCBjb25uZWN0aW9uOiBDb25uZWN0aW9uPFRDb250ZXh0PiA9IHsgY2hhbm5lbFNlcnZlciwgY2hhbm5lbENsaWVudCwgY3R4IH07XG5cdFx0XHRcdHRoaXMuX2Nvbm5lY3Rpb25zLmFkZChjb25uZWN0aW9uKTtcblx0XHRcdFx0dGhpcy5fb25EaWRBZGRDb25uZWN0aW9uLmZpcmUoY29ubmVjdGlvbik7XG5cblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25EaWRDbGllbnREaXNjb25uZWN0KCgpID0+IHtcblx0XHRcdFx0XHRjaGFubmVsU2VydmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRjaGFubmVsQ2xpZW50LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9jb25uZWN0aW9ucy5kZWxldGUoY29ubmVjdGlvbik7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRSZW1vdmVDb25uZWN0aW9uLmZpcmUoY29ubmVjdGlvbik7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0pKTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGEgY2hhbm5lbCBmcm9tIGEgcmVtb3RlIGNsaWVudC4gV2hlbiBwYXNzZWQgYSByb3V0ZXIsXG5cdCAqIG9uZSBjYW4gc3BlY2lmeSB3aGljaCBjbGllbnQgaXQgd2FudHMgdG8gY2FsbCBhbmQgbGlzdGVuIHRvL2Zyb20uXG5cdCAqIE90aGVyd2lzZSwgd2hlbiBjYWxsaW5nIHdpdGhvdXQgYSByb3V0ZXIsIGEgcmFuZG9tIGNsaWVudCB3aWxsXG5cdCAqIGJlIHNlbGVjdGVkIGFuZCB3aGVuIGxpc3RlbmluZyB3aXRob3V0IGEgcm91dGVyLCBldmVyeSBjbGllbnRcblx0ICogd2lsbCBiZSBsaXN0ZW5lZCB0by5cblx0ICovXG5cdGdldENoYW5uZWw8VCBleHRlbmRzIElDaGFubmVsPihjaGFubmVsTmFtZTogc3RyaW5nLCByb3V0ZXI6IElDbGllbnRSb3V0ZXI8VENvbnRleHQ+KTogVDtcblx0Z2V0Q2hhbm5lbDxUIGV4dGVuZHMgSUNoYW5uZWw+KGNoYW5uZWxOYW1lOiBzdHJpbmcsIGNsaWVudEZpbHRlcjogKGNsaWVudDogQ2xpZW50PFRDb250ZXh0PikgPT4gYm9vbGVhbik6IFQ7XG5cdGdldENoYW5uZWw8VCBleHRlbmRzIElDaGFubmVsPihjaGFubmVsTmFtZTogc3RyaW5nLCByb3V0ZXJPckNsaWVudEZpbHRlcjogSUNsaWVudFJvdXRlcjxUQ29udGV4dD4gfCAoKGNsaWVudDogQ2xpZW50PFRDb250ZXh0PikgPT4gYm9vbGVhbikpOiBUIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2FsbChjb21tYW5kOiBzdHJpbmcsIGFyZz86IGFueSwgY2FuY2VsbGF0aW9uVG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VD4ge1xuXHRcdFx0XHRsZXQgY29ubmVjdGlvblByb21pc2U6IFByb21pc2U8Q2xpZW50PFRDb250ZXh0Pj47XG5cblx0XHRcdFx0aWYgKGlzRnVuY3Rpb24ocm91dGVyT3JDbGllbnRGaWx0ZXIpKSB7XG5cdFx0XHRcdFx0Ly8gd2hlbiBubyByb3V0ZXIgaXMgcHJvdmlkZWQsIHdlIGdvIHJhbmRvbSBjbGllbnQgcGlja2luZ1xuXHRcdFx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBnZXRSYW5kb21FbGVtZW50KHRoYXQuY29ubmVjdGlvbnMuZmlsdGVyKHJvdXRlck9yQ2xpZW50RmlsdGVyKSk7XG5cblx0XHRcdFx0XHRjb25uZWN0aW9uUHJvbWlzZSA9IGNvbm5lY3Rpb25cblx0XHRcdFx0XHRcdC8vIGlmIHdlIGZvdW5kIGEgY2xpZW50LCBsZXQncyBjYWxsIG9uIGl0XG5cdFx0XHRcdFx0XHQ/IFByb21pc2UucmVzb2x2ZShjb25uZWN0aW9uKVxuXHRcdFx0XHRcdFx0Ly8gZWxzZSwgbGV0J3Mgd2FpdCBmb3IgYSBjbGllbnQgdG8gY29tZSBhbG9uZ1xuXHRcdFx0XHRcdFx0OiBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKHRoYXQub25EaWRBZGRDb25uZWN0aW9uLCByb3V0ZXJPckNsaWVudEZpbHRlcikpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbm5lY3Rpb25Qcm9taXNlID0gcm91dGVyT3JDbGllbnRGaWx0ZXIucm91dGVDYWxsKHRoYXQsIGNvbW1hbmQsIGFyZyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBjaGFubmVsUHJvbWlzZSA9IGNvbm5lY3Rpb25Qcm9taXNlXG5cdFx0XHRcdFx0LnRoZW4oY29ubmVjdGlvbiA9PiAoY29ubmVjdGlvbiBhcyBDb25uZWN0aW9uPFRDb250ZXh0PikuY2hhbm5lbENsaWVudC5nZXRDaGFubmVsKGNoYW5uZWxOYW1lKSk7XG5cblx0XHRcdFx0cmV0dXJuIGdldERlbGF5ZWRDaGFubmVsKGNoYW5uZWxQcm9taXNlKVxuXHRcdFx0XHRcdC5jYWxsKGNvbW1hbmQsIGFyZywgY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdGxpc3RlbihldmVudDogc3RyaW5nLCBhcmc6IGFueSk6IEV2ZW50PFQ+IHtcblx0XHRcdFx0aWYgKGlzRnVuY3Rpb24ocm91dGVyT3JDbGllbnRGaWx0ZXIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoYXQuZ2V0TXVsdGljYXN0RXZlbnQoY2hhbm5lbE5hbWUsIHJvdXRlck9yQ2xpZW50RmlsdGVyLCBldmVudCwgYXJnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGNoYW5uZWxQcm9taXNlID0gcm91dGVyT3JDbGllbnRGaWx0ZXIucm91dGVFdmVudCh0aGF0LCBldmVudCwgYXJnKVxuXHRcdFx0XHRcdC50aGVuKGNvbm5lY3Rpb24gPT4gKGNvbm5lY3Rpb24gYXMgQ29ubmVjdGlvbjxUQ29udGV4dD4pLmNoYW5uZWxDbGllbnQuZ2V0Q2hhbm5lbChjaGFubmVsTmFtZSkpO1xuXG5cdFx0XHRcdHJldHVybiBnZXREZWxheWVkQ2hhbm5lbChjaGFubmVsUHJvbWlzZSlcblx0XHRcdFx0XHQubGlzdGVuKGV2ZW50LCBhcmcpO1xuXHRcdFx0fVxuXHRcdH0gYXMgVDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TXVsdGljYXN0RXZlbnQ8VCBleHRlbmRzIElDaGFubmVsPihjaGFubmVsTmFtZTogc3RyaW5nLCBjbGllbnRGaWx0ZXI6IChjbGllbnQ6IENsaWVudDxUQ29udGV4dD4pID0+IGJvb2xlYW4sIGV2ZW50TmFtZTogc3RyaW5nLCBhcmc6IGFueSk6IEV2ZW50PFQ+IHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZDtcblxuXHRcdC8vIENyZWF0ZSBhbiBlbWl0dGVyIHdoaWNoIGhvb2tzIHVwIHRvIGFsbCBjbGllbnRzXG5cdFx0Ly8gYXMgc29vbiBhcyBmaXJzdCBsaXN0ZW5lciBpcyBhZGRlZC4gSXQgYWxzb1xuXHRcdC8vIGRpc2Nvbm5lY3RzIGZyb20gYWxsIGNsaWVudHMgYXMgc29vbiBhcyB0aGUgbGFzdCBsaXN0ZW5lclxuXHRcdC8vIGlzIHJlbW92ZWQuXG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFQ+KHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdFx0Ly8gVGhlIGV2ZW50IG11bHRpcGxleGVyIGlzIHVzZWZ1bCBzaW5jZSB0aGUgYWN0aXZlXG5cdFx0XHRcdC8vIGNsaWVudCBsaXN0IGlzIGR5bmFtaWMuIFdlIG5lZWQgdG8gaG9vayB1cCBhbmQgZGlzY29ubmVjdGlvblxuXHRcdFx0XHQvLyB0by9mcm9tIGNsaWVudHMgYXMgdGhleSBjb21lIGFuZCBnby5cblx0XHRcdFx0Y29uc3QgZXZlbnRNdWx0aXBsZXhlciA9IG5ldyBFdmVudE11bHRpcGxleGVyPFQ+KCk7XG5cdFx0XHRcdGNvbnN0IG1hcCA9IG5ldyBNYXA8Q29ubmVjdGlvbjxUQ29udGV4dD4sIElEaXNwb3NhYmxlPigpO1xuXG5cdFx0XHRcdGNvbnN0IG9uRGlkQWRkQ29ubmVjdGlvbiA9IChjb25uZWN0aW9uOiBDb25uZWN0aW9uPFRDb250ZXh0PikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNoYW5uZWwgPSBjb25uZWN0aW9uLmNoYW5uZWxDbGllbnQuZ2V0Q2hhbm5lbChjaGFubmVsTmFtZSk7XG5cdFx0XHRcdFx0Y29uc3QgZXZlbnQgPSBjaGFubmVsLmxpc3RlbjxUPihldmVudE5hbWUsIGFyZyk7XG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGV2ZW50TXVsdGlwbGV4ZXIuYWRkKGV2ZW50KTtcblxuXHRcdFx0XHRcdG1hcC5zZXQoY29ubmVjdGlvbiwgZGlzcG9zYWJsZSk7XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Y29uc3Qgb25EaWRSZW1vdmVDb25uZWN0aW9uID0gKGNvbm5lY3Rpb246IENvbm5lY3Rpb248VENvbnRleHQ+KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG1hcC5nZXQoY29ubmVjdGlvbik7XG5cblx0XHRcdFx0XHRpZiAoIWRpc3Bvc2FibGUpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRtYXAuZGVsZXRlKGNvbm5lY3Rpb24pO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHRoYXQuY29ubmVjdGlvbnMuZmlsdGVyKGNsaWVudEZpbHRlcikuZm9yRWFjaChvbkRpZEFkZENvbm5lY3Rpb24pO1xuXHRcdFx0XHRFdmVudC5maWx0ZXIodGhhdC5vbkRpZEFkZENvbm5lY3Rpb24sIGNsaWVudEZpbHRlcikob25EaWRBZGRDb25uZWN0aW9uLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0dGhhdC5vbkRpZFJlbW92ZUNvbm5lY3Rpb24ob25EaWRSZW1vdmVDb25uZWN0aW9uLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0ZXZlbnRNdWx0aXBsZXhlci5ldmVudChlbWl0dGVyLmZpcmUsIGVtaXR0ZXIsIGRpc3Bvc2FibGVzKTtcblxuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXZlbnRNdWx0aXBsZXhlcik7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXM/LmRpc3Bvc2UoKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhhdC5kaXNwb3NhYmxlcy5hZGQoZW1pdHRlcik7XG5cblx0XHRyZXR1cm4gZW1pdHRlci5ldmVudDtcblx0fVxuXG5cdHJlZ2lzdGVyQ2hhbm5lbChjaGFubmVsTmFtZTogc3RyaW5nLCBjaGFubmVsOiBJU2VydmVyQ2hhbm5lbDxUQ29udGV4dD4pOiB2b2lkIHtcblx0XHR0aGlzLmNoYW5uZWxzLnNldChjaGFubmVsTmFtZSwgY2hhbm5lbCk7XG5cblx0XHRmb3IgKGNvbnN0IGNvbm5lY3Rpb24gb2YgdGhpcy5fY29ubmVjdGlvbnMpIHtcblx0XHRcdGNvbm5lY3Rpb24uY2hhbm5lbFNlcnZlci5yZWdpc3RlckNoYW5uZWwoY2hhbm5lbE5hbWUsIGNoYW5uZWwpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cblx0XHRmb3IgKGNvbnN0IGNvbm5lY3Rpb24gb2YgdGhpcy5fY29ubmVjdGlvbnMpIHtcblx0XHRcdGNvbm5lY3Rpb24uY2hhbm5lbENsaWVudC5kaXNwb3NlKCk7XG5cdFx0XHRjb25uZWN0aW9uLmNoYW5uZWxTZXJ2ZXIuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Nvbm5lY3Rpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy5jaGFubmVscy5jbGVhcigpO1xuXHRcdHRoaXMuX29uRGlkQWRkQ29ubmVjdGlvbi5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRSZW1vdmVDb25uZWN0aW9uLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKipcbiAqIEFuIGBJUENDbGllbnRgIGlzIGJvdGggYSBjaGFubmVsIGNsaWVudCBhbmQgYSBjaGFubmVsIHNlcnZlci5cbiAqXG4gKiBBcyB0aGUgb3duZXIgb2YgYSBwcm90b2NvbCwgeW91IHNob3VsZCBleHRlbmQgYm90aCB0aGlzXG4gKiBhbmQgdGhlIGBJUENTZXJ2ZXJgIGNsYXNzZXMgdG8gZ2V0IElQQyBpbXBsZW1lbnRhdGlvbnNcbiAqIGZvciB5b3VyIHByb3RvY29sLlxuICovXG5leHBvcnQgY2xhc3MgSVBDQ2xpZW50PFRDb250ZXh0ID0gc3RyaW5nPiBpbXBsZW1lbnRzIElDaGFubmVsQ2xpZW50LCBJQ2hhbm5lbFNlcnZlcjxUQ29udGV4dD4sIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGNoYW5uZWxDbGllbnQ6IENoYW5uZWxDbGllbnQ7XG5cdHByaXZhdGUgY2hhbm5lbFNlcnZlcjogQ2hhbm5lbFNlcnZlcjxUQ29udGV4dD47XG5cblx0Y29uc3RydWN0b3IocHJvdG9jb2w6IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sLCBjdHg6IFRDb250ZXh0LCBpcGNMb2dnZXI6IElJUENMb2dnZXIgfCBudWxsID0gbnVsbCkge1xuXHRcdGNvbnN0IHdyaXRlciA9IG5ldyBCdWZmZXJXcml0ZXIoKTtcblx0XHRzZXJpYWxpemUod3JpdGVyLCBjdHgpO1xuXHRcdHByb3RvY29sLnNlbmQod3JpdGVyLmJ1ZmZlcik7XG5cblx0XHR0aGlzLmNoYW5uZWxDbGllbnQgPSBuZXcgQ2hhbm5lbENsaWVudChwcm90b2NvbCwgaXBjTG9nZ2VyKTtcblx0XHR0aGlzLmNoYW5uZWxTZXJ2ZXIgPSBuZXcgQ2hhbm5lbFNlcnZlcihwcm90b2NvbCwgY3R4LCBpcGNMb2dnZXIpO1xuXHR9XG5cblx0Z2V0Q2hhbm5lbDxUIGV4dGVuZHMgSUNoYW5uZWw+KGNoYW5uZWxOYW1lOiBzdHJpbmcpOiBUIHtcblx0XHRyZXR1cm4gdGhpcy5jaGFubmVsQ2xpZW50LmdldENoYW5uZWwoY2hhbm5lbE5hbWUpIGFzIFQ7XG5cdH1cblxuXHRyZWdpc3RlckNoYW5uZWwoY2hhbm5lbE5hbWU6IHN0cmluZywgY2hhbm5lbDogSVNlcnZlckNoYW5uZWw8VENvbnRleHQ+KTogdm9pZCB7XG5cdFx0dGhpcy5jaGFubmVsU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbChjaGFubmVsTmFtZSwgY2hhbm5lbCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY2hhbm5lbENsaWVudC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5jaGFubmVsU2VydmVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVsYXllZENoYW5uZWw8VCBleHRlbmRzIElDaGFubmVsPihwcm9taXNlOiBQcm9taXNlPFQ+KTogVCB7XG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0cmV0dXJuIHtcblx0XHRjYWxsKGNvbW1hbmQ6IHN0cmluZywgYXJnPzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUPiB7XG5cdFx0XHRyZXR1cm4gcHJvbWlzZS50aGVuKGMgPT4gYy5jYWxsPFQ+KGNvbW1hbmQsIGFyZywgY2FuY2VsbGF0aW9uVG9rZW4pKTtcblx0XHR9LFxuXG5cdFx0bGlzdGVuPFQ+KGV2ZW50OiBzdHJpbmcsIGFyZz86IGFueSk6IEV2ZW50PFQ+IHtcblx0XHRcdGNvbnN0IHJlbGF5ID0gbmV3IFJlbGF5PGFueT4oKTtcblx0XHRcdHByb21pc2UudGhlbihjID0+IHJlbGF5LmlucHV0ID0gYy5saXN0ZW4oZXZlbnQsIGFyZykpO1xuXHRcdFx0cmV0dXJuIHJlbGF5LmV2ZW50O1xuXHRcdH1cblx0fSBhcyBUO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmV4dFRpY2tDaGFubmVsPFQgZXh0ZW5kcyBJQ2hhbm5lbD4oY2hhbm5lbDogVCk6IFQge1xuXHRsZXQgZGlkVGljayA9IGZhbHNlO1xuXG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0cmV0dXJuIHtcblx0XHRjYWxsPFQ+KGNvbW1hbmQ6IHN0cmluZywgYXJnPzogYW55LCBjYW5jZWxsYXRpb25Ub2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUPiB7XG5cdFx0XHRpZiAoZGlkVGljaykge1xuXHRcdFx0XHRyZXR1cm4gY2hhbm5lbC5jYWxsKGNvbW1hbmQsIGFyZywgY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGltZW91dCgwKVxuXHRcdFx0XHQudGhlbigoKSA9PiBkaWRUaWNrID0gdHJ1ZSlcblx0XHRcdFx0LnRoZW4oKCkgPT4gY2hhbm5lbC5jYWxsPFQ+KGNvbW1hbmQsIGFyZywgY2FuY2VsbGF0aW9uVG9rZW4pKTtcblx0XHR9LFxuXHRcdGxpc3RlbjxUPihldmVudDogc3RyaW5nLCBhcmc/OiBhbnkpOiBFdmVudDxUPiB7XG5cdFx0XHRpZiAoZGlkVGljaykge1xuXHRcdFx0XHRyZXR1cm4gY2hhbm5lbC5saXN0ZW48VD4oZXZlbnQsIGFyZyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlbGF5ID0gbmV3IFJlbGF5PFQ+KCk7XG5cblx0XHRcdHRpbWVvdXQoMClcblx0XHRcdFx0LnRoZW4oKCkgPT4gZGlkVGljayA9IHRydWUpXG5cdFx0XHRcdC50aGVuKCgpID0+IHJlbGF5LmlucHV0ID0gY2hhbm5lbC5saXN0ZW48VD4oZXZlbnQsIGFyZykpO1xuXG5cdFx0XHRyZXR1cm4gcmVsYXkuZXZlbnQ7XG5cdFx0fVxuXHR9IGFzIFQ7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNSb3V0ZXI8VENvbnRleHQgPSBzdHJpbmc+IGltcGxlbWVudHMgSUNsaWVudFJvdXRlcjxUQ29udGV4dD4ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZm46IChjdHg6IFRDb250ZXh0KSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPikgeyB9XG5cblx0cm91dGVDYWxsKGh1YjogSUNvbm5lY3Rpb25IdWI8VENvbnRleHQ+KTogUHJvbWlzZTxDbGllbnQ8VENvbnRleHQ+PiB7XG5cdFx0cmV0dXJuIHRoaXMucm91dGUoaHViKTtcblx0fVxuXG5cdHJvdXRlRXZlbnQoaHViOiBJQ29ubmVjdGlvbkh1YjxUQ29udGV4dD4pOiBQcm9taXNlPENsaWVudDxUQ29udGV4dD4+IHtcblx0XHRyZXR1cm4gdGhpcy5yb3V0ZShodWIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByb3V0ZShodWI6IElDb25uZWN0aW9uSHViPFRDb250ZXh0Pik6IFByb21pc2U8Q2xpZW50PFRDb250ZXh0Pj4ge1xuXHRcdGZvciAoY29uc3QgY29ubmVjdGlvbiBvZiBodWIuY29ubmVjdGlvbnMpIHtcblx0XHRcdGlmIChhd2FpdCBQcm9taXNlLnJlc29sdmUodGhpcy5mbihjb25uZWN0aW9uLmN0eCkpKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoY29ubmVjdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKGh1Yi5vbkRpZEFkZENvbm5lY3Rpb24pO1xuXHRcdHJldHVybiBhd2FpdCB0aGlzLnJvdXRlKGh1Yik7XG5cdH1cbn1cblxuLyoqXG4gKiBVc2UgUHJveHlDaGFubmVscyB0byBhdXRvbWF0aWNhbGx5IHdyYXBwaW5nIGFuZCB1bndyYXBwaW5nXG4gKiBzZXJ2aWNlcyB0by9mcm9tIElQQyBjaGFubmVscywgaW5zdGVhZCBvZiBtYW51YWxseSB3cmFwcGluZ1xuICogZWFjaCBzZXJ2aWNlIG1ldGhvZCBhbmQgZXZlbnQuXG4gKlxuICogUmVzdHJpY3Rpb25zOlxuICogLSBJZiBtYXJzaGFsbGluZyBpcyBlbmFibGVkLCBvbmx5IGBVUklgIGFuZCBgUmVnRXhwYCBpcyBjb252ZXJ0ZWRcbiAqICAgYXV0b21hdGljYWxseSBmb3IgeW91XG4gKiAtIEV2ZW50cyBtdXN0IGZvbGxvdyB0aGUgbmFtaW5nIGNvbnZlbnRpb24gYG9uVXBwZXJDYXNlYFxuICogLSBgQ2FuY2VsbGF0aW9uVG9rZW5gIGlzIGN1cnJlbnRseSBub3Qgc3VwcG9ydGVkXG4gKiAtIElmIGEgY29udGV4dCBpcyBwcm92aWRlZCwgeW91IGNhbiB1c2UgYEFkZEZpcnN0UGFyYW1ldGVyVG9GdW5jdGlvbnNgXG4gKiAgIHV0aWxpdHkgdG8gc2lnbmFsIHRoaXMgaW4gdGhlIHJlY2VpdmluZyBzaWRlIHR5cGVcbiAqL1xuZXhwb3J0IG5hbWVzcGFjZSBQcm94eUNoYW5uZWwge1xuXG5cdGV4cG9ydCBpbnRlcmZhY2UgSVByb3h5T3B0aW9ucyB7XG5cblx0XHQvKipcblx0XHQgKiBEaXNhYmxlcyBhdXRvbWF0aWMgbWFyc2hhbGxpbmcgb2YgYFVSSWAuXG5cdFx0ICogSWYgbWFyc2hhbGxpbmcgaXMgZGlzYWJsZWQsIGBVcmlDb21wb25lbnRzYFxuXHRcdCAqIG11c3QgYmUgdXNlZCBpbnN0ZWFkLlxuXHRcdCAqL1xuXHRcdGRpc2FibGVNYXJzaGFsbGluZz86IGJvb2xlYW47XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIElDcmVhdGVTZXJ2aWNlQ2hhbm5lbE9wdGlvbnMgZXh0ZW5kcyBJUHJveHlPcHRpb25zIHsgfVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tU2VydmljZTxUQ29udGV4dD4oc2VydmljZTogdW5rbm93biwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgb3B0aW9ucz86IElDcmVhdGVTZXJ2aWNlQ2hhbm5lbE9wdGlvbnMpOiBJU2VydmVyQ2hhbm5lbDxUQ29udGV4dD4ge1xuXHRcdGNvbnN0IGhhbmRsZXIgPSBzZXJ2aWNlIGFzIHsgW2tleTogc3RyaW5nXTogdW5rbm93biB9O1xuXHRcdGNvbnN0IGRpc2FibGVNYXJzaGFsbGluZyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kaXNhYmxlTWFyc2hhbGxpbmc7XG5cblx0XHQvLyBCdWZmZXIgYW55IGV2ZW50IHRoYXQgc2hvdWxkIGJlIHN1cHBvcnRlZCBieVxuXHRcdC8vIGl0ZXJhdGluZyBvdmVyIGFsbCBwcm9wZXJ0eSBrZXlzIGFuZCBmaW5kaW5nIHRoZW1cblx0XHQvLyBIb3dldmVyLCB0aGlzIHdpbGwgbm90IHdvcmsgZm9yIHNlcnZpY2VzIHRoYXRcblx0XHQvLyBhcmUgbGF6eSBhbmQgdXNlIGEgUHJveHkgd2l0aGluLiBGb3IgdGhhdCB3ZVxuXHRcdC8vIHN0aWxsIG5lZWQgdG8gY2hlY2sgbGF0ZXIgKHNlZSBiZWxvdykuXG5cdFx0Y29uc3QgbWFwRXZlbnROYW1lVG9FdmVudCA9IG5ldyBNYXA8c3RyaW5nLCBFdmVudDx1bmtub3duPj4oKTtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiBoYW5kbGVyKSB7XG5cdFx0XHRpZiAocHJvcGVydHlJc0V2ZW50KGtleSkpIHtcblx0XHRcdFx0bWFwRXZlbnROYW1lVG9FdmVudC5zZXQoa2V5LCBFdmVudC5idWZmZXIoaGFuZGxlcltrZXldIGFzIEV2ZW50PHVua25vd24+LCB0cnVlLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBjbGFzcyBpbXBsZW1lbnRzIElTZXJ2ZXJDaGFubmVsIHtcblxuXHRcdFx0bGlzdGVuPFQ+KF86IHVua25vd24sIGV2ZW50OiBzdHJpbmcsIGFyZzogYW55KTogRXZlbnQ8VD4ge1xuXHRcdFx0XHRjb25zdCBldmVudEltcGwgPSBtYXBFdmVudE5hbWVUb0V2ZW50LmdldChldmVudCk7XG5cdFx0XHRcdGlmIChldmVudEltcGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gZXZlbnRJbXBsIGFzIEV2ZW50PFQ+O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gaGFuZGxlcltldmVudF07XG5cdFx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0aWYgKHByb3BlcnR5SXNEeW5hbWljRXZlbnQoZXZlbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGFyZ2V0LmNhbGwoaGFuZGxlciwgYXJnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocHJvcGVydHlJc0V2ZW50KGV2ZW50KSkge1xuXHRcdFx0XHRcdFx0bWFwRXZlbnROYW1lVG9FdmVudC5zZXQoZXZlbnQsIEV2ZW50LmJ1ZmZlcihoYW5kbGVyW2V2ZW50XSBhcyBFdmVudDx1bmtub3duPiwgdHJ1ZSwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlcykpO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4gbWFwRXZlbnROYW1lVG9FdmVudC5nZXQoZXZlbnQpIGFzIEV2ZW50PFQ+O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvck5vVGVsZW1ldHJ5KGBFdmVudCBub3QgZm91bmQ6ICR7ZXZlbnR9YCk7XG5cdFx0XHR9XG5cblx0XHRcdGNhbGwoXzogdW5rbm93biwgY29tbWFuZDogc3RyaW5nLCBhcmdzPzogYW55W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRjb25zdCB0YXJnZXQgPSBoYW5kbGVyW2NvbW1hbmRdO1xuXHRcdFx0XHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ2Z1bmN0aW9uJykge1xuXG5cdFx0XHRcdFx0Ly8gUmV2aXZlIHVubGVzcyBtYXJzaGFsbGluZyBkaXNhYmxlZFxuXHRcdFx0XHRcdGlmICghZGlzYWJsZU1hcnNoYWxsaW5nICYmIEFycmF5LmlzQXJyYXkoYXJncykpIHtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRhcmdzW2ldID0gcmV2aXZlKGFyZ3NbaV0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxldCByZXMgPSB0YXJnZXQuYXBwbHkoaGFuZGxlciwgYXJncyk7XG5cdFx0XHRcdFx0aWYgKCEocmVzIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcblx0XHRcdFx0XHRcdHJlcyA9IFByb21pc2UucmVzb2x2ZShyZXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yTm9UZWxlbWV0cnkoYE1ldGhvZCBub3QgZm91bmQ6ICR7Y29tbWFuZH1gKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJQ3JlYXRlUHJveHlTZXJ2aWNlT3B0aW9ucyBleHRlbmRzIElQcm94eU9wdGlvbnMge1xuXG5cdFx0LyoqXG5cdFx0ICogSWYgcHJvdmlkZWQsIHdpbGwgYWRkIHRoZSB2YWx1ZSBvZiBgY29udGV4dGBcblx0XHQgKiB0byBlYWNoIG1ldGhvZCBjYWxsIHRvIHRoZSB0YXJnZXQuXG5cdFx0ICovXG5cdFx0Y29udGV4dD86IHVua25vd247XG5cblx0XHQvKipcblx0XHQgKiBJZiBwcm92aWRlZCwgd2lsbCBub3QgcHJveHkgYW55IG9mIHRoZSBwcm9wZXJ0aWVzXG5cdFx0ICogdGhhdCBhcmUgcGFydCBvZiB0aGUgTWFwIGJ1dCByYXRoZXIgcmV0dXJuIHRoYXQgdmFsdWUuXG5cdFx0ICovXG5cdFx0cHJvcGVydGllcz86IE1hcDxzdHJpbmcsIHVua25vd24+O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvU2VydmljZTxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBJQ2hhbm5lbCwgb3B0aW9ucz86IElDcmVhdGVQcm94eVNlcnZpY2VPcHRpb25zKTogVCB7XG5cdFx0Y29uc3QgZGlzYWJsZU1hcnNoYWxsaW5nID0gb3B0aW9ucyAmJiBvcHRpb25zLmRpc2FibGVNYXJzaGFsbGluZztcblxuXHRcdHJldHVybiBuZXcgUHJveHkoe30sIHtcblx0XHRcdGdldChfdGFyZ2V0OiBULCBwcm9wS2V5OiBQcm9wZXJ0eUtleSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIHByb3BLZXkgPT09ICdzdHJpbmcnKSB7XG5cblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgcHJlZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0XHRpZiAob3B0aW9ucz8ucHJvcGVydGllcz8uaGFzKHByb3BLZXkpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5wcm9wZXJ0aWVzLmdldChwcm9wS2V5KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBEeW5hbWljIEV2ZW50XG5cdFx0XHRcdFx0aWYgKHByb3BlcnR5SXNEeW5hbWljRXZlbnQocHJvcEtleSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiAoYXJnOiBhbnkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGNoYW5uZWwubGlzdGVuKHByb3BLZXksIGFyZyk7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEV2ZW50XG5cdFx0XHRcdFx0aWYgKHByb3BlcnR5SXNFdmVudChwcm9wS2V5KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNoYW5uZWwubGlzdGVuKHByb3BLZXkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEZ1bmN0aW9uXG5cdFx0XHRcdFx0cmV0dXJuIGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuXG5cdFx0XHRcdFx0XHQvLyBBZGQgY29udGV4dCBpZiBhbnlcblx0XHRcdFx0XHRcdGxldCBtZXRob2RBcmdzOiBhbnlbXTtcblx0XHRcdFx0XHRcdGlmIChvcHRpb25zICYmICFpc1VuZGVmaW5lZE9yTnVsbChvcHRpb25zLmNvbnRleHQpKSB7XG5cdFx0XHRcdFx0XHRcdG1ldGhvZEFyZ3MgPSBbb3B0aW9ucy5jb250ZXh0LCAuLi5hcmdzXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG1ldGhvZEFyZ3MgPSBhcmdzO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBjaGFubmVsLmNhbGwocHJvcEtleSwgbWV0aG9kQXJncyk7XG5cblx0XHRcdFx0XHRcdC8vIFJldml2ZSB1bmxlc3MgbWFyc2hhbGxpbmcgZGlzYWJsZWRcblx0XHRcdFx0XHRcdGlmICghZGlzYWJsZU1hcnNoYWxsaW5nKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiByZXZpdmUocmVzdWx0KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yTm9UZWxlbWV0cnkoYFByb3BlcnR5IG5vdCBmb3VuZDogJHtTdHJpbmcocHJvcEtleSl9YCk7XG5cdFx0XHR9XG5cdFx0fSkgYXMgVDtcblx0fVxuXG5cdGZ1bmN0aW9uIHByb3BlcnR5SXNFdmVudChuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHQvLyBBc3N1bWUgYSBwcm9wZXJ0eSBpcyBhbiBldmVudCBpZiBpdCBoYXMgYSBmb3JtIG9mIFwib25Tb21ldGhpbmdcIlxuXHRcdHJldHVybiBuYW1lWzBdID09PSAnbycgJiYgbmFtZVsxXSA9PT0gJ24nICYmIHN0cmluZ3MuaXNVcHBlckFzY2lpTGV0dGVyKG5hbWUuY2hhckNvZGVBdCgyKSk7XG5cdH1cblxuXHRmdW5jdGlvbiBwcm9wZXJ0eUlzRHluYW1pY0V2ZW50KG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdC8vIEFzc3VtZSBhIHByb3BlcnR5IGlzIGEgZHluYW1pYyBldmVudCAoYSBtZXRob2QgdGhhdCByZXR1cm5zIGFuIGV2ZW50KSBpZiBpdCBoYXMgYSBmb3JtIG9mIFwib25EeW5hbWljU29tZXRoaW5nXCJcblx0XHRyZXR1cm4gL15vbkR5bmFtaWMvLnRlc3QobmFtZSkgJiYgc3RyaW5ncy5pc1VwcGVyQXNjaWlMZXR0ZXIobmFtZS5jaGFyQ29kZUF0KDkpKTtcblx0fVxufVxuXG5jb25zdCBjb2xvclRhYmxlcyA9IFtcblx0WycjMjk3N0IxJywgJyNGQzgwMkQnLCAnIzM0QTEzQScsICcjRDMyODJGJywgJyM5MzY2QkEnXSxcblx0WycjOEI1NjRDJywgJyNFMTc3QzAnLCAnIzdGN0Y3RicsICcjQkJCRTNEJywgJyMyRUJFQ0QnXVxuXTtcblxuZnVuY3Rpb24gcHJldHR5V2l0aG91dEFycmF5cyhkYXRhOiBhbnkpOiBhbnkge1xuXHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cdGlmIChkYXRhICYmIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgZGF0YS50b1N0cmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGRhdGEudG9TdHJpbmcoKTtcblx0XHRpZiAocmVzdWx0ICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIHByZXR0eShkYXRhOiBhbnkpOiBhbnkge1xuXHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuXHRcdHJldHVybiBkYXRhLm1hcChwcmV0dHlXaXRob3V0QXJyYXlzKTtcblx0fVxuXHRyZXR1cm4gcHJldHR5V2l0aG91dEFycmF5cyhkYXRhKTtcbn1cblxuZnVuY3Rpb24gbG9nV2l0aENvbG9ycyhkaXJlY3Rpb246IHN0cmluZywgdG90YWxMZW5ndGg6IG51bWJlciwgbXNnTGVuZ3RoOiBudW1iZXIsIHJlcTogbnVtYmVyLCBpbml0aWF0b3I6IFJlcXVlc3RJbml0aWF0b3IsIHN0cjogc3RyaW5nLCBkYXRhOiBhbnkpOiB2b2lkIHtcblx0ZGF0YSA9IHByZXR0eShkYXRhKTtcblxuXHRjb25zdCBjb2xvclRhYmxlID0gY29sb3JUYWJsZXNbaW5pdGlhdG9yXTtcblx0Y29uc3QgY29sb3IgPSBjb2xvclRhYmxlW3JlcSAlIGNvbG9yVGFibGUubGVuZ3RoXTtcblx0bGV0IGFyZ3MgPSBbYCVjWyR7ZGlyZWN0aW9ufV0lY1ske1N0cmluZyh0b3RhbExlbmd0aCkucGFkU3RhcnQoNywgJyAnKX1dJWNbbGVuOiAke1N0cmluZyhtc2dMZW5ndGgpLnBhZFN0YXJ0KDUsICcgJyl9XSVjJHtTdHJpbmcocmVxKS5wYWRTdGFydCg1LCAnICcpfSAtICR7c3RyfWAsICdjb2xvcjogZGFya2dyZWVuJywgJ2NvbG9yOiBncmV5JywgJ2NvbG9yOiBncmV5JywgYGNvbG9yOiAke2NvbG9yfWBdO1xuXHRpZiAoL1xcKCQvLnRlc3Qoc3RyKSkge1xuXHRcdGFyZ3MgPSBhcmdzLmNvbmNhdChkYXRhKTtcblx0XHRhcmdzLnB1c2goJyknKTtcblx0fSBlbHNlIHtcblx0XHRhcmdzLnB1c2goZGF0YSk7XG5cdH1cblx0Y29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgYXJncyBhcyBbc3RyaW5nLCAuLi5zdHJpbmdbXV0pO1xufVxuXG5leHBvcnQgY2xhc3MgSVBDTG9nZ2VyIGltcGxlbWVudHMgSUlQQ0xvZ2dlciB7XG5cdHByaXZhdGUgX3RvdGFsSW5jb21pbmcgPSAwO1xuXHRwcml2YXRlIF90b3RhbE91dGdvaW5nID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vdXRnb2luZ1ByZWZpeDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luY29taW5nUHJlZml4OiBzdHJpbmcsXG5cdCkgeyB9XG5cblx0cHVibGljIGxvZ091dGdvaW5nKG1zZ0xlbmd0aDogbnVtYmVyLCByZXF1ZXN0SWQ6IG51bWJlciwgaW5pdGlhdG9yOiBSZXF1ZXN0SW5pdGlhdG9yLCBzdHI6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuX3RvdGFsT3V0Z29pbmcgKz0gbXNnTGVuZ3RoO1xuXHRcdGxvZ1dpdGhDb2xvcnModGhpcy5fb3V0Z29pbmdQcmVmaXgsIHRoaXMuX3RvdGFsT3V0Z29pbmcsIG1zZ0xlbmd0aCwgcmVxdWVzdElkLCBpbml0aWF0b3IsIHN0ciwgZGF0YSk7XG5cdH1cblxuXHRwdWJsaWMgbG9nSW5jb21pbmcobXNnTGVuZ3RoOiBudW1iZXIsIHJlcXVlc3RJZDogbnVtYmVyLCBpbml0aWF0b3I6IFJlcXVlc3RJbml0aWF0b3IsIHN0cjogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5fdG90YWxJbmNvbWluZyArPSBtc2dMZW5ndGg7XG5cdFx0bG9nV2l0aENvbG9ycyh0aGlzLl9pbmNvbWluZ1ByZWZpeCwgdGhpcy5fdG90YWxJbmNvbWluZywgbXNnTGVuZ3RoLCByZXF1ZXN0SWQsIGluaXRpYXRvciwgc3RyLCBkYXRhKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQTRCLHlCQUF5QixlQUFlO0FBQ3BFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxtQkFBbUIsd0JBQXdCO0FBQ3BELFNBQVMsU0FBUyxPQUFPLGtCQUFrQixhQUFhO0FBQ3hELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsaUJBQWlCLFNBQXNCLG9CQUFvQjtBQUNwRSxTQUFTLGNBQWM7QUFDdkIsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsWUFBWSx5QkFBeUI7QUF1QjlDLElBQVcsY0FBWCxrQkFBV0EsaUJBQVg7QUFDQyxFQUFBQSwwQkFBQSxhQUFVLE9BQVY7QUFDQSxFQUFBQSwwQkFBQSxtQkFBZ0IsT0FBaEI7QUFDQSxFQUFBQSwwQkFBQSxpQkFBYyxPQUFkO0FBQ0EsRUFBQUEsMEJBQUEsa0JBQWUsT0FBZjtBQUpVLFNBQUFBO0FBQUEsR0FBQTtBQU9YLFNBQVMsaUJBQWlCLE1BQTJCO0FBQ3BELFVBQVEsTUFBTTtBQUFBLElBQ2IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxFQUNUO0FBQ0Q7QUFRQSxJQUFXLGVBQVgsa0JBQVdDLGtCQUFY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USxXQUFXLE1BQU0sV0FBVyxNQUFNO0FBQ2hELE1BQUksT0FBTyxDQUFDLE1BQU0sU0FBUyxPQUFPLE9BQU8sV0FBVyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsWUFBWSxPQUFPLFNBQVMsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLE1BQU0sT0FBTyxHQUFHLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxvQkFBb0IsZUFBZSxlQUFlLFVBQVUsS0FBSyxFQUFFO0FBQ3RPLE1BQUksTUFBTSxLQUFLLEdBQUcsR0FBRztBQUNwQixXQUFPLEtBQUssT0FBTyxJQUFJO0FBQ3ZCLFNBQUssS0FBSyxHQUFHO0FBQUEsRUFDZCxPQUFPO0FBQ04sU0FBSyxLQUFLLElBQUk7QUFBQSxFQUNmO0FBQ0EsVUFBUSxJQUFJLE1BQU0sU0FBUyxJQUE2QjtBQUN6RDtBQUVPLE1BQU0sVUFBZ0M7QUFBQSxFQUk1QyxZQUNrQixpQkFDQSxpQkFDaEI7QUFGZ0I7QUFDQTtBQUxsQixTQUFRLGlCQUFpQjtBQUN6QixTQUFRLGlCQUFpQjtBQUFBLEVBS3JCO0FBQUEsRUFFRyxZQUFZLFdBQW1CLFdBQW1CLFdBQTZCLEtBQWEsTUFBa0I7QUFDcEgsU0FBSyxrQkFBa0I7QUFDdkIsa0JBQWMsS0FBSyxpQkFBaUIsS0FBSyxnQkFBZ0IsV0FBVyxXQUFXLFdBQVcsS0FBSyxJQUFJO0FBQUEsRUFDcEc7QUFBQSxFQUVPLFlBQVksV0FBbUIsV0FBbUIsV0FBNkIsS0FBYSxNQUFrQjtBQUNwSCxTQUFLLGtCQUFrQjtBQUN2QixrQkFBYyxLQUFLLGlCQUFpQixLQUFLLGdCQUFnQixXQUFXLFdBQVcsV0FBVyxLQUFLLElBQUk7QUFBQSxFQUNwRztBQUNEOyIsCiAgIm5hbWVzIjogWyJSZXF1ZXN0VHlwZSIsICJSZXNwb25zZVR5cGUiLCAiU3RhdGUiLCAiRGF0YVR5cGUiLCAiUmVxdWVzdEluaXRpYXRvciIsICJQcm94eUNoYW5uZWwiXQp9Cg==
