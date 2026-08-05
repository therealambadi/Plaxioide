var _a, _b;
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { CharCode } from "../../../../base/common/charCode.js";
import * as errors from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { transformIncomingURIs } from "../../../../base/common/uriIpc.js";
import { CanceledLazyPromise, LazyPromise } from "./lazyPromise.js";
import { getStringIdentifierForProxy, ProxyIdentifier, SerializableObjectWithBuffers } from "./proxyIdentifier.js";
function safeStringify(obj, replacer) {
  try {
    return JSON.stringify(obj, replacer);
  } catch (err) {
    return "null";
  }
}
const refSymbolName = "$$ref$$";
const undefinedRef = { [refSymbolName]: -1 };
class StringifiedJsonWithBufferRefs {
  constructor(jsonString, referencedBuffers) {
    this.jsonString = jsonString;
    this.referencedBuffers = referencedBuffers;
  }
}
function stringifyJsonWithBufferRefs(obj, replacer = null, useSafeStringify = false) {
  const foundBuffers = [];
  const serialized = (useSafeStringify ? safeStringify : JSON.stringify)(obj, (key, value) => {
    if (typeof value === "undefined") {
      return undefinedRef;
    } else if (typeof value === "object") {
      if (value instanceof VSBuffer) {
        const bufferIndex = foundBuffers.push(value) - 1;
        return { [refSymbolName]: bufferIndex };
      }
      if (replacer) {
        return replacer(key, value);
      }
    }
    return value;
  });
  return {
    jsonString: serialized,
    referencedBuffers: foundBuffers
  };
}
function parseJsonAndRestoreBufferRefs(jsonString, buffers, uriTransformer) {
  return JSON.parse(jsonString, (_key, value) => {
    if (value) {
      const ref = value[refSymbolName];
      if (typeof ref === "number") {
        return buffers[ref];
      }
      if (uriTransformer && value.$mid === MarshalledId.Uri) {
        return uriTransformer.transformIncoming(value);
      }
    }
    return value;
  });
}
function stringify(obj, replacer) {
  return JSON.stringify(obj, replacer);
}
function createURIReplacer(transformer) {
  if (!transformer) {
    return null;
  }
  return (key, value) => {
    if (value && value.$mid === MarshalledId.Uri) {
      return transformer.transformOutgoing(value);
    }
    return value;
  };
}
var RequestInitiator = /* @__PURE__ */ ((RequestInitiator2) => {
  RequestInitiator2[RequestInitiator2["LocalSide"] = 0] = "LocalSide";
  RequestInitiator2[RequestInitiator2["OtherSide"] = 1] = "OtherSide";
  return RequestInitiator2;
})(RequestInitiator || {});
var ResponsiveState = /* @__PURE__ */ ((ResponsiveState2) => {
  ResponsiveState2[ResponsiveState2["Responsive"] = 0] = "Responsive";
  ResponsiveState2[ResponsiveState2["Unresponsive"] = 1] = "Unresponsive";
  return ResponsiveState2;
})(ResponsiveState || {});
const noop = () => {
};
const _RPCProtocolSymbol = Symbol.for("rpcProtocol");
const _RPCProxySymbol = Symbol.for("rpcProxy");
const _RPCProtocol = class _RPCProtocol extends (_b = Disposable, _a = _RPCProtocolSymbol, _b) {
  constructor(protocol, logger = null, transformer = null) {
    super();
    this[_a] = true;
    // 3s
    this._onDidChangeResponsiveState = this._register(new Emitter());
    this.onDidChangeResponsiveState = this._onDidChangeResponsiveState.event;
    this._protocol = protocol;
    this._logger = logger;
    this._uriTransformer = transformer;
    this._uriReplacer = createURIReplacer(this._uriTransformer);
    this._isDisposed = false;
    this._locals = [];
    this._proxies = [];
    for (let i = 0, len = ProxyIdentifier.count; i < len; i++) {
      this._locals[i] = null;
      this._proxies[i] = null;
    }
    this._lastMessageId = 0;
    this._cancelInvokedHandlers = /* @__PURE__ */ Object.create(null);
    this._pendingRPCReplies = {};
    this._responsiveState = 0 /* Responsive */;
    this._unacknowledgedCount = 0;
    this._unresponsiveTime = 0;
    this._asyncCheckUresponsive = this._register(new RunOnceScheduler(() => this._checkUnresponsive(), 1e3));
    this._register(this._protocol.onMessage((msg) => this._receiveOneMessage(msg)));
  }
  dispose() {
    this._isDisposed = true;
    Object.keys(this._pendingRPCReplies).forEach((msgId) => {
      const pending = this._pendingRPCReplies[msgId];
      delete this._pendingRPCReplies[msgId];
      pending.resolveErr(errors.canceled());
    });
    super.dispose();
  }
  drain() {
    if (typeof this._protocol.drain === "function") {
      return this._protocol.drain();
    }
    return Promise.resolve();
  }
  _onWillSendRequest(req) {
    if (this._unacknowledgedCount === 0) {
      this._unresponsiveTime = Date.now() + _RPCProtocol.UNRESPONSIVE_TIME;
    }
    this._unacknowledgedCount++;
    if (!this._asyncCheckUresponsive.isScheduled()) {
      this._asyncCheckUresponsive.schedule();
    }
  }
  _onDidReceiveAcknowledge(req) {
    this._unresponsiveTime = Date.now() + _RPCProtocol.UNRESPONSIVE_TIME;
    this._unacknowledgedCount--;
    if (this._unacknowledgedCount === 0) {
      this._asyncCheckUresponsive.cancel();
    }
    this._setResponsiveState(0 /* Responsive */);
  }
  _checkUnresponsive() {
    if (this._unacknowledgedCount === 0) {
      return;
    }
    if (Date.now() > this._unresponsiveTime) {
      this._setResponsiveState(1 /* Unresponsive */);
    } else {
      this._asyncCheckUresponsive.schedule();
    }
  }
  _setResponsiveState(newResponsiveState) {
    if (this._responsiveState === newResponsiveState) {
      return;
    }
    this._responsiveState = newResponsiveState;
    this._onDidChangeResponsiveState.fire(this._responsiveState);
  }
  get responsiveState() {
    return this._responsiveState;
  }
  transformIncomingURIs(obj) {
    if (!this._uriTransformer) {
      return obj;
    }
    return transformIncomingURIs(obj, this._uriTransformer);
  }
  getProxy(identifier) {
    const { nid: rpcId, sid } = identifier;
    if (!this._proxies[rpcId]) {
      this._proxies[rpcId] = this._createProxy(rpcId, sid);
    }
    return this._proxies[rpcId];
  }
  _createProxy(rpcId, debugName) {
    const handler = {
      get: (target, name) => {
        if (typeof name === "string" && !target[name] && name.charCodeAt(0) === CharCode.DollarSign) {
          target[name] = (...myArgs) => {
            return this._remoteCall(rpcId, name, myArgs);
          };
        }
        if (name === _RPCProxySymbol) {
          return debugName;
        }
        return target[name];
      }
    };
    return new Proxy(/* @__PURE__ */ Object.create(null), handler);
  }
  set(identifier, value) {
    this._locals[identifier.nid] = value;
    return value;
  }
  assertRegistered(identifiers) {
    for (let i = 0, len = identifiers.length; i < len; i++) {
      const identifier = identifiers[i];
      if (!this._locals[identifier.nid]) {
        throw new Error(`Missing proxy instance ${identifier.sid}`);
      }
    }
  }
  _receiveOneMessage(rawmsg) {
    if (this._isDisposed) {
      return;
    }
    const msgLength = rawmsg.byteLength;
    const buff = MessageBuffer.read(rawmsg, 0);
    const messageType = buff.readUInt8();
    const req = buff.readUInt32();
    switch (messageType) {
      case 1 /* RequestJSONArgs */:
      case 2 /* RequestJSONArgsWithCancellation */: {
        let { rpcId, method, args } = MessageIO.deserializeRequestJSONArgs(buff);
        if (this._uriTransformer) {
          args = transformIncomingURIs(args, this._uriTransformer);
        }
        this._receiveRequest(msgLength, req, rpcId, method, args, messageType === 2 /* RequestJSONArgsWithCancellation */);
        break;
      }
      case 3 /* RequestMixedArgs */:
      case 4 /* RequestMixedArgsWithCancellation */: {
        let { rpcId, method, args } = MessageIO.deserializeRequestMixedArgs(buff);
        if (this._uriTransformer) {
          args = transformIncomingURIs(args, this._uriTransformer);
        }
        this._receiveRequest(msgLength, req, rpcId, method, args, messageType === 4 /* RequestMixedArgsWithCancellation */);
        break;
      }
      case 5 /* Acknowledged */: {
        this._logger?.logIncoming(msgLength, req, 0 /* LocalSide */, `ack`);
        this._onDidReceiveAcknowledge(req);
        break;
      }
      case 6 /* Cancel */: {
        this._receiveCancel(msgLength, req);
        break;
      }
      case 7 /* ReplyOKEmpty */: {
        this._receiveReply(msgLength, req, void 0);
        break;
      }
      case 9 /* ReplyOKJSON */: {
        let value = MessageIO.deserializeReplyOKJSON(buff);
        if (this._uriTransformer) {
          value = transformIncomingURIs(value, this._uriTransformer);
        }
        this._receiveReply(msgLength, req, value);
        break;
      }
      case 10 /* ReplyOKJSONWithBuffers */: {
        const value = MessageIO.deserializeReplyOKJSONWithBuffers(buff, this._uriTransformer);
        this._receiveReply(msgLength, req, value);
        break;
      }
      case 8 /* ReplyOKVSBuffer */: {
        const value = MessageIO.deserializeReplyOKVSBuffer(buff);
        this._receiveReply(msgLength, req, value);
        break;
      }
      case 11 /* ReplyErrError */: {
        let err = MessageIO.deserializeReplyErrError(buff);
        if (this._uriTransformer) {
          err = transformIncomingURIs(err, this._uriTransformer);
        }
        this._receiveReplyErr(msgLength, req, err);
        break;
      }
      case 12 /* ReplyErrEmpty */: {
        this._receiveReplyErr(msgLength, req, void 0);
        break;
      }
      default:
        console.error(`received unexpected message`);
        console.error(rawmsg);
    }
  }
  _receiveRequest(msgLength, req, rpcId, method, args, usesCancellationToken) {
    this._logger?.logIncoming(msgLength, req, 1 /* OtherSide */, `receiveRequest ${getStringIdentifierForProxy(rpcId)}.${method}(`, args);
    const callId = String(req);
    let promise;
    let cancel;
    if (usesCancellationToken) {
      const cancellationTokenSource = new CancellationTokenSource();
      args.push(cancellationTokenSource.token);
      promise = this._invokeHandler(rpcId, method, args);
      cancel = () => cancellationTokenSource.cancel();
    } else {
      promise = this._invokeHandler(rpcId, method, args);
      cancel = noop;
    }
    this._cancelInvokedHandlers[callId] = cancel;
    const msg = MessageIO.serializeAcknowledged(req);
    this._logger?.logOutgoing(msg.byteLength, req, 1 /* OtherSide */, `ack`);
    this._protocol.send(msg);
    promise.then((r) => {
      delete this._cancelInvokedHandlers[callId];
      const msg2 = MessageIO.serializeReplyOK(req, r, this._uriReplacer);
      this._logger?.logOutgoing(msg2.byteLength, req, 1 /* OtherSide */, `reply:`, r);
      this._protocol.send(msg2);
    }, (err) => {
      delete this._cancelInvokedHandlers[callId];
      const msg2 = MessageIO.serializeReplyErr(req, err);
      this._logger?.logOutgoing(msg2.byteLength, req, 1 /* OtherSide */, `replyErr:`, err);
      this._protocol.send(msg2);
    });
  }
  _receiveCancel(msgLength, req) {
    this._logger?.logIncoming(msgLength, req, 1 /* OtherSide */, `receiveCancel`);
    const callId = String(req);
    this._cancelInvokedHandlers[callId]?.();
  }
  _receiveReply(msgLength, req, value) {
    this._logger?.logIncoming(msgLength, req, 0 /* LocalSide */, `receiveReply:`, value);
    const callId = String(req);
    if (!this._pendingRPCReplies.hasOwnProperty(callId)) {
      return;
    }
    const pendingReply = this._pendingRPCReplies[callId];
    delete this._pendingRPCReplies[callId];
    pendingReply.resolveOk(value);
  }
  _receiveReplyErr(msgLength, req, value) {
    this._logger?.logIncoming(msgLength, req, 0 /* LocalSide */, `receiveReplyErr:`, value);
    const callId = String(req);
    if (!this._pendingRPCReplies.hasOwnProperty(callId)) {
      return;
    }
    const pendingReply = this._pendingRPCReplies[callId];
    delete this._pendingRPCReplies[callId];
    let err = void 0;
    if (value) {
      if (value.$isError) {
        err = new Error();
        err.name = value.name;
        err.message = value.message;
        err.stack = value.stack;
      } else {
        err = value;
      }
    }
    pendingReply.resolveErr(err);
  }
  _invokeHandler(rpcId, methodName, args) {
    try {
      return Promise.resolve(this._doInvokeHandler(rpcId, methodName, args));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  _doInvokeHandler(rpcId, methodName, args) {
    const actor = this._locals[rpcId];
    if (!actor) {
      throw new Error("Unknown actor " + getStringIdentifierForProxy(rpcId));
    }
    const method = actor[methodName];
    if (typeof method !== "function") {
      throw new Error("Unknown method " + methodName + " on actor " + getStringIdentifierForProxy(rpcId));
    }
    return method.apply(actor, args);
  }
  _remoteCall(rpcId, methodName, args) {
    if (this._isDisposed) {
      return new CanceledLazyPromise();
    }
    let cancellationToken = null;
    if (args.length > 0 && CancellationToken.isCancellationToken(args[args.length - 1])) {
      cancellationToken = args.pop();
    }
    if (cancellationToken && cancellationToken.isCancellationRequested) {
      return Promise.reject(errors.canceled());
    }
    const serializedRequestArguments = MessageIO.serializeRequestArguments(args, this._uriReplacer);
    const req = ++this._lastMessageId;
    const callId = String(req);
    const result = new LazyPromise();
    const disposable = new DisposableStore();
    if (cancellationToken) {
      disposable.add(cancellationToken.onCancellationRequested(() => {
        const msg2 = MessageIO.serializeCancel(req);
        this._logger?.logOutgoing(msg2.byteLength, req, 0 /* LocalSide */, `cancel`);
        this._protocol.send(msg2);
      }));
    }
    this._pendingRPCReplies[callId] = new PendingRPCReply(result, disposable);
    this._onWillSendRequest(req);
    const msg = MessageIO.serializeRequest(req, rpcId, methodName, serializedRequestArguments, !!cancellationToken);
    this._logger?.logOutgoing(msg.byteLength, req, 0 /* LocalSide */, `request: ${getStringIdentifierForProxy(rpcId)}.${methodName}(`, args);
    this._protocol.send(msg);
    return result;
  }
};
_RPCProtocol.UNRESPONSIVE_TIME = 3 * 1e3;
let RPCProtocol = _RPCProtocol;
class PendingRPCReply {
  constructor(_promise, _disposable) {
    this._promise = _promise;
    this._disposable = _disposable;
  }
  resolveOk(value) {
    this._promise.resolveOk(value);
    this._disposable.dispose();
  }
  resolveErr(err) {
    this._promise.resolveErr(err);
    this._disposable.dispose();
  }
}
const _MessageBuffer = class _MessageBuffer {
  static alloc(type, req, messageSize) {
    const result = new _MessageBuffer(VSBuffer.alloc(
      messageSize + 1 + 4
      /* req */
    ), 0);
    result.writeUInt8(type);
    result.writeUInt32(req);
    return result;
  }
  static read(buff, offset) {
    return new _MessageBuffer(buff, offset);
  }
  get buffer() {
    return this._buff;
  }
  constructor(buff, offset) {
    this._buff = buff;
    this._offset = offset;
  }
  static sizeUInt8() {
    return 1;
  }
  writeUInt8(n) {
    this._buff.writeUInt8(n, this._offset);
    this._offset += 1;
  }
  readUInt8() {
    const n = this._buff.readUInt8(this._offset);
    this._offset += 1;
    return n;
  }
  writeUInt32(n) {
    this._buff.writeUInt32BE(n, this._offset);
    this._offset += 4;
  }
  readUInt32() {
    const n = this._buff.readUInt32BE(this._offset);
    this._offset += 4;
    return n;
  }
  static sizeShortString(str) {
    return 1 + str.byteLength;
  }
  writeShortString(str) {
    this._buff.writeUInt8(str.byteLength, this._offset);
    this._offset += 1;
    this._buff.set(str, this._offset);
    this._offset += str.byteLength;
  }
  readShortString() {
    const strByteLength = this._buff.readUInt8(this._offset);
    this._offset += 1;
    const strBuff = this._buff.slice(this._offset, this._offset + strByteLength);
    const str = strBuff.toString();
    this._offset += strByteLength;
    return str;
  }
  static sizeLongString(str) {
    return 4 + str.byteLength;
  }
  writeLongString(str) {
    this._buff.writeUInt32BE(str.byteLength, this._offset);
    this._offset += 4;
    this._buff.set(str, this._offset);
    this._offset += str.byteLength;
  }
  readLongString() {
    const strByteLength = this._buff.readUInt32BE(this._offset);
    this._offset += 4;
    const strBuff = this._buff.slice(this._offset, this._offset + strByteLength);
    const str = strBuff.toString();
    this._offset += strByteLength;
    return str;
  }
  writeBuffer(buff) {
    this._buff.writeUInt32BE(buff.byteLength, this._offset);
    this._offset += 4;
    this._buff.set(buff, this._offset);
    this._offset += buff.byteLength;
  }
  static sizeVSBuffer(buff) {
    return 4 + buff.byteLength;
  }
  writeVSBuffer(buff) {
    this._buff.writeUInt32BE(buff.byteLength, this._offset);
    this._offset += 4;
    this._buff.set(buff, this._offset);
    this._offset += buff.byteLength;
  }
  readVSBuffer() {
    const buffLength = this._buff.readUInt32BE(this._offset);
    this._offset += 4;
    const buff = this._buff.slice(this._offset, this._offset + buffLength);
    this._offset += buffLength;
    return buff;
  }
  static sizeMixedArray(arr) {
    let size = 0;
    size += 1;
    for (let i = 0, len = arr.length; i < len; i++) {
      const el = arr[i];
      size += 1;
      switch (el.type) {
        case 1 /* String */:
          size += this.sizeLongString(el.value);
          break;
        case 2 /* VSBuffer */:
          size += this.sizeVSBuffer(el.value);
          break;
        case 3 /* SerializedObjectWithBuffers */:
          size += this.sizeUInt32;
          size += this.sizeLongString(el.value);
          for (let i2 = 0; i2 < el.buffers.length; ++i2) {
            size += this.sizeVSBuffer(el.buffers[i2]);
          }
          break;
        case 4 /* Undefined */:
          break;
      }
    }
    return size;
  }
  writeMixedArray(arr) {
    this._buff.writeUInt8(arr.length, this._offset);
    this._offset += 1;
    for (let i = 0, len = arr.length; i < len; i++) {
      const el = arr[i];
      switch (el.type) {
        case 1 /* String */:
          this.writeUInt8(1 /* String */);
          this.writeLongString(el.value);
          break;
        case 2 /* VSBuffer */:
          this.writeUInt8(2 /* VSBuffer */);
          this.writeVSBuffer(el.value);
          break;
        case 3 /* SerializedObjectWithBuffers */:
          this.writeUInt8(3 /* SerializedObjectWithBuffers */);
          this.writeUInt32(el.buffers.length);
          this.writeLongString(el.value);
          for (let i2 = 0; i2 < el.buffers.length; ++i2) {
            this.writeBuffer(el.buffers[i2]);
          }
          break;
        case 4 /* Undefined */:
          this.writeUInt8(4 /* Undefined */);
          break;
      }
    }
  }
  readMixedArray() {
    const arrLen = this._buff.readUInt8(this._offset);
    this._offset += 1;
    const arr = new Array(arrLen);
    for (let i = 0; i < arrLen; i++) {
      const argType = this.readUInt8();
      switch (argType) {
        case 1 /* String */:
          arr[i] = this.readLongString();
          break;
        case 2 /* VSBuffer */:
          arr[i] = this.readVSBuffer();
          break;
        case 3 /* SerializedObjectWithBuffers */: {
          const bufferCount = this.readUInt32();
          const jsonString = this.readLongString();
          const buffers = [];
          for (let i2 = 0; i2 < bufferCount; ++i2) {
            buffers.push(this.readVSBuffer());
          }
          arr[i] = new SerializableObjectWithBuffers(parseJsonAndRestoreBufferRefs(jsonString, buffers, null));
          break;
        }
        case 4 /* Undefined */:
          arr[i] = void 0;
          break;
      }
    }
    return arr;
  }
};
_MessageBuffer.sizeUInt32 = 4;
let MessageBuffer = _MessageBuffer;
var SerializedRequestArgumentType = /* @__PURE__ */ ((SerializedRequestArgumentType2) => {
  SerializedRequestArgumentType2[SerializedRequestArgumentType2["Simple"] = 0] = "Simple";
  SerializedRequestArgumentType2[SerializedRequestArgumentType2["Mixed"] = 1] = "Mixed";
  return SerializedRequestArgumentType2;
})(SerializedRequestArgumentType || {});
class MessageIO {
  static _useMixedArgSerialization(arr) {
    for (let i = 0, len = arr.length; i < len; i++) {
      if (arr[i] instanceof VSBuffer) {
        return true;
      }
      if (arr[i] instanceof SerializableObjectWithBuffers) {
        return true;
      }
      if (typeof arr[i] === "undefined") {
        return true;
      }
    }
    return false;
  }
  static serializeRequestArguments(args, replacer) {
    if (this._useMixedArgSerialization(args)) {
      const massagedArgs = [];
      for (let i = 0, len = args.length; i < len; i++) {
        const arg = args[i];
        if (arg instanceof VSBuffer) {
          massagedArgs[i] = { type: 2 /* VSBuffer */, value: arg };
        } else if (typeof arg === "undefined") {
          massagedArgs[i] = { type: 4 /* Undefined */ };
        } else if (arg instanceof SerializableObjectWithBuffers) {
          const { jsonString, referencedBuffers } = stringifyJsonWithBufferRefs(arg.value, replacer);
          massagedArgs[i] = { type: 3 /* SerializedObjectWithBuffers */, value: VSBuffer.fromString(jsonString), buffers: referencedBuffers };
        } else {
          massagedArgs[i] = { type: 1 /* String */, value: VSBuffer.fromString(stringify(arg, replacer)) };
        }
      }
      return {
        type: 1 /* Mixed */,
        args: massagedArgs
      };
    }
    return {
      type: 0 /* Simple */,
      args: stringify(args, replacer)
    };
  }
  static serializeRequest(req, rpcId, method, serializedArgs, usesCancellationToken) {
    switch (serializedArgs.type) {
      case 0 /* Simple */:
        return this._requestJSONArgs(req, rpcId, method, serializedArgs.args, usesCancellationToken);
      case 1 /* Mixed */:
        return this._requestMixedArgs(req, rpcId, method, serializedArgs.args, usesCancellationToken);
    }
  }
  static _requestJSONArgs(req, rpcId, method, args, usesCancellationToken) {
    const methodBuff = VSBuffer.fromString(method);
    const argsBuff = VSBuffer.fromString(args);
    let len = 0;
    len += MessageBuffer.sizeUInt8();
    len += MessageBuffer.sizeShortString(methodBuff);
    len += MessageBuffer.sizeLongString(argsBuff);
    const result = MessageBuffer.alloc(usesCancellationToken ? 2 /* RequestJSONArgsWithCancellation */ : 1 /* RequestJSONArgs */, req, len);
    result.writeUInt8(rpcId);
    result.writeShortString(methodBuff);
    result.writeLongString(argsBuff);
    return result.buffer;
  }
  static deserializeRequestJSONArgs(buff) {
    const rpcId = buff.readUInt8();
    const method = buff.readShortString();
    const args = buff.readLongString();
    return {
      rpcId,
      method,
      args: JSON.parse(args)
    };
  }
  static _requestMixedArgs(req, rpcId, method, args, usesCancellationToken) {
    const methodBuff = VSBuffer.fromString(method);
    let len = 0;
    len += MessageBuffer.sizeUInt8();
    len += MessageBuffer.sizeShortString(methodBuff);
    len += MessageBuffer.sizeMixedArray(args);
    const result = MessageBuffer.alloc(usesCancellationToken ? 4 /* RequestMixedArgsWithCancellation */ : 3 /* RequestMixedArgs */, req, len);
    result.writeUInt8(rpcId);
    result.writeShortString(methodBuff);
    result.writeMixedArray(args);
    return result.buffer;
  }
  static deserializeRequestMixedArgs(buff) {
    const rpcId = buff.readUInt8();
    const method = buff.readShortString();
    const rawargs = buff.readMixedArray();
    const args = new Array(rawargs.length);
    for (let i = 0, len = rawargs.length; i < len; i++) {
      const rawarg = rawargs[i];
      if (typeof rawarg === "string") {
        args[i] = JSON.parse(rawarg);
      } else {
        args[i] = rawarg;
      }
    }
    return {
      rpcId,
      method,
      args
    };
  }
  static serializeAcknowledged(req) {
    return MessageBuffer.alloc(5 /* Acknowledged */, req, 0).buffer;
  }
  static serializeCancel(req) {
    return MessageBuffer.alloc(6 /* Cancel */, req, 0).buffer;
  }
  static serializeReplyOK(req, res, replacer) {
    if (typeof res === "undefined") {
      return this._serializeReplyOKEmpty(req);
    } else if (res instanceof VSBuffer) {
      return this._serializeReplyOKVSBuffer(req, res);
    } else if (res instanceof SerializableObjectWithBuffers) {
      const { jsonString, referencedBuffers } = stringifyJsonWithBufferRefs(res.value, replacer, true);
      return this._serializeReplyOKJSONWithBuffers(req, jsonString, referencedBuffers);
    } else {
      return this._serializeReplyOKJSON(req, safeStringify(res, replacer));
    }
  }
  static _serializeReplyOKEmpty(req) {
    return MessageBuffer.alloc(7 /* ReplyOKEmpty */, req, 0).buffer;
  }
  static _serializeReplyOKVSBuffer(req, res) {
    let len = 0;
    len += MessageBuffer.sizeVSBuffer(res);
    const result = MessageBuffer.alloc(8 /* ReplyOKVSBuffer */, req, len);
    result.writeVSBuffer(res);
    return result.buffer;
  }
  static deserializeReplyOKVSBuffer(buff) {
    return buff.readVSBuffer();
  }
  static _serializeReplyOKJSON(req, res) {
    const resBuff = VSBuffer.fromString(res);
    let len = 0;
    len += MessageBuffer.sizeLongString(resBuff);
    const result = MessageBuffer.alloc(9 /* ReplyOKJSON */, req, len);
    result.writeLongString(resBuff);
    return result.buffer;
  }
  static _serializeReplyOKJSONWithBuffers(req, res, buffers) {
    const resBuff = VSBuffer.fromString(res);
    let len = 0;
    len += MessageBuffer.sizeUInt32;
    len += MessageBuffer.sizeLongString(resBuff);
    for (const buffer of buffers) {
      len += MessageBuffer.sizeVSBuffer(buffer);
    }
    const result = MessageBuffer.alloc(10 /* ReplyOKJSONWithBuffers */, req, len);
    result.writeUInt32(buffers.length);
    result.writeLongString(resBuff);
    for (const buffer of buffers) {
      result.writeBuffer(buffer);
    }
    return result.buffer;
  }
  static deserializeReplyOKJSON(buff) {
    const res = buff.readLongString();
    return JSON.parse(res);
  }
  static deserializeReplyOKJSONWithBuffers(buff, uriTransformer) {
    const bufferCount = buff.readUInt32();
    const res = buff.readLongString();
    const buffers = [];
    for (let i = 0; i < bufferCount; ++i) {
      buffers.push(buff.readVSBuffer());
    }
    return new SerializableObjectWithBuffers(parseJsonAndRestoreBufferRefs(res, buffers, uriTransformer));
  }
  static serializeReplyErr(req, err) {
    const errStr = err ? safeStringify(errors.transformErrorForSerialization(err), null) : void 0;
    if (typeof errStr !== "string") {
      return this._serializeReplyErrEmpty(req);
    }
    const errBuff = VSBuffer.fromString(errStr);
    let len = 0;
    len += MessageBuffer.sizeLongString(errBuff);
    const result = MessageBuffer.alloc(11 /* ReplyErrError */, req, len);
    result.writeLongString(errBuff);
    return result.buffer;
  }
  static deserializeReplyErrError(buff) {
    const err = buff.readLongString();
    return JSON.parse(err);
  }
  static _serializeReplyErrEmpty(req) {
    return MessageBuffer.alloc(12 /* ReplyErrEmpty */, req, 0).buffer;
  }
}
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2[MessageType2["RequestJSONArgs"] = 1] = "RequestJSONArgs";
  MessageType2[MessageType2["RequestJSONArgsWithCancellation"] = 2] = "RequestJSONArgsWithCancellation";
  MessageType2[MessageType2["RequestMixedArgs"] = 3] = "RequestMixedArgs";
  MessageType2[MessageType2["RequestMixedArgsWithCancellation"] = 4] = "RequestMixedArgsWithCancellation";
  MessageType2[MessageType2["Acknowledged"] = 5] = "Acknowledged";
  MessageType2[MessageType2["Cancel"] = 6] = "Cancel";
  MessageType2[MessageType2["ReplyOKEmpty"] = 7] = "ReplyOKEmpty";
  MessageType2[MessageType2["ReplyOKVSBuffer"] = 8] = "ReplyOKVSBuffer";
  MessageType2[MessageType2["ReplyOKJSON"] = 9] = "ReplyOKJSON";
  MessageType2[MessageType2["ReplyOKJSONWithBuffers"] = 10] = "ReplyOKJSONWithBuffers";
  MessageType2[MessageType2["ReplyErrError"] = 11] = "ReplyErrError";
  MessageType2[MessageType2["ReplyErrEmpty"] = 12] = "ReplyErrEmpty";
  return MessageType2;
})(MessageType || {});
var ArgType = /* @__PURE__ */ ((ArgType2) => {
  ArgType2[ArgType2["String"] = 1] = "String";
  ArgType2[ArgType2["VSBuffer"] = 2] = "VSBuffer";
  ArgType2[ArgType2["SerializedObjectWithBuffers"] = 3] = "SerializedObjectWithBuffers";
  ArgType2[ArgType2["Undefined"] = 4] = "Undefined";
  return ArgType2;
})(ArgType || {});
export {
  RPCProtocol,
  RequestInitiator,
  ResponsiveState,
  parseJsonAndRestoreBufferRefs,
  stringifyJsonWithBufferRefs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcnBjUHJvdG9jb2wudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZE9iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IElVUklUcmFuc2Zvcm1lciwgdHJhbnNmb3JtSW5jb21pbmdVUklzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpSXBjLmpzJztcbmltcG9ydCB7IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxlZExhenlQcm9taXNlLCBMYXp5UHJvbWlzZSB9IGZyb20gJy4vbGF6eVByb21pc2UuanMnO1xuaW1wb3J0IHsgZ2V0U3RyaW5nSWRlbnRpZmllckZvclByb3h5LCBJUlBDUHJvdG9jb2wsIFByb3hpZWQsIFByb3h5SWRlbnRpZmllciwgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMgfSBmcm9tICcuL3Byb3h5SWRlbnRpZmllci5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSlNPTlN0cmluZ2lmeVJlcGxhY2VyIHtcblx0KGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogYW55O1xufVxuXG5mdW5jdGlvbiBzYWZlU3RyaW5naWZ5KG9iajogYW55LCByZXBsYWNlcjogSlNPTlN0cmluZ2lmeVJlcGxhY2VyIHwgbnVsbCk6IHN0cmluZyB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgPChrZXk6IHN0cmluZywgdmFsdWU6IGFueSkgPT4gYW55PnJlcGxhY2VyKTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0cmV0dXJuICdudWxsJztcblx0fVxufVxuXG5jb25zdCByZWZTeW1ib2xOYW1lID0gJyQkcmVmJCQnO1xuY29uc3QgdW5kZWZpbmVkUmVmID0geyBbcmVmU3ltYm9sTmFtZV06IC0xIH0gYXMgY29uc3Q7XG5cbmNsYXNzIFN0cmluZ2lmaWVkSnNvbldpdGhCdWZmZXJSZWZzIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGpzb25TdHJpbmc6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVmZXJlbmNlZEJ1ZmZlcnM6IHJlYWRvbmx5IFZTQnVmZmVyW10sXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnlKc29uV2l0aEJ1ZmZlclJlZnM8VD4ob2JqOiBULCByZXBsYWNlcjogSlNPTlN0cmluZ2lmeVJlcGxhY2VyIHwgbnVsbCA9IG51bGwsIHVzZVNhZmVTdHJpbmdpZnkgPSBmYWxzZSk6IFN0cmluZ2lmaWVkSnNvbldpdGhCdWZmZXJSZWZzIHtcblx0Y29uc3QgZm91bmRCdWZmZXJzOiBWU0J1ZmZlcltdID0gW107XG5cdGNvbnN0IHNlcmlhbGl6ZWQgPSAodXNlU2FmZVN0cmluZ2lmeSA/IHNhZmVTdHJpbmdpZnkgOiBKU09OLnN0cmluZ2lmeSkob2JqLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkUmVmOyAvLyBKU09OLnN0cmluZ2lmeSBub3JtYWxseSBjb252ZXJ0cyAndW5kZWZpbmVkJyB0byAnbnVsbCdcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZTQnVmZmVyKSB7XG5cdFx0XHRcdGNvbnN0IGJ1ZmZlckluZGV4ID0gZm91bmRCdWZmZXJzLnB1c2godmFsdWUpIC0gMTtcblx0XHRcdFx0cmV0dXJuIHsgW3JlZlN5bWJvbE5hbWVdOiBidWZmZXJJbmRleCB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlcGxhY2VyKSB7XG5cdFx0XHRcdHJldHVybiByZXBsYWNlcihrZXksIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9KTtcblx0cmV0dXJuIHtcblx0XHRqc29uU3RyaW5nOiBzZXJpYWxpemVkLFxuXHRcdHJlZmVyZW5jZWRCdWZmZXJzOiBmb3VuZEJ1ZmZlcnNcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSnNvbkFuZFJlc3RvcmVCdWZmZXJSZWZzKGpzb25TdHJpbmc6IHN0cmluZywgYnVmZmVyczogcmVhZG9ubHkgVlNCdWZmZXJbXSwgdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwpOiBhbnkge1xuXHRyZXR1cm4gSlNPTi5wYXJzZShqc29uU3RyaW5nLCAoX2tleSwgdmFsdWUpID0+IHtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdGNvbnN0IHJlZiA9IHZhbHVlW3JlZlN5bWJvbE5hbWVdO1xuXHRcdFx0aWYgKHR5cGVvZiByZWYgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHJldHVybiBidWZmZXJzW3JlZl07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh1cmlUcmFuc2Zvcm1lciAmJiAoPE1hcnNoYWxsZWRPYmplY3Q+dmFsdWUpLiRtaWQgPT09IE1hcnNoYWxsZWRJZC5VcmkpIHtcblx0XHRcdFx0cmV0dXJuIHVyaVRyYW5zZm9ybWVyLnRyYW5zZm9ybUluY29taW5nKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9KTtcbn1cblxuXG5mdW5jdGlvbiBzdHJpbmdpZnkob2JqOiBhbnksIHJlcGxhY2VyOiBKU09OU3RyaW5naWZ5UmVwbGFjZXIgfCBudWxsKTogc3RyaW5nIHtcblx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgPChrZXk6IHN0cmluZywgdmFsdWU6IGFueSkgPT4gYW55PnJlcGxhY2VyKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVVJJUmVwbGFjZXIodHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwpOiBKU09OU3RyaW5naWZ5UmVwbGFjZXIgfCBudWxsIHtcblx0aWYgKCF0cmFuc2Zvcm1lcikge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdHJldHVybiAoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkgPT4ge1xuXHRcdGlmICh2YWx1ZSAmJiB2YWx1ZS4kbWlkID09PSBNYXJzaGFsbGVkSWQuVXJpKSB7XG5cdFx0XHRyZXR1cm4gdHJhbnNmb3JtZXIudHJhbnNmb3JtT3V0Z29pbmcodmFsdWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH07XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFJlcXVlc3RJbml0aWF0b3Ige1xuXHRMb2NhbFNpZGUgPSAwLFxuXHRPdGhlclNpZGUgPSAxXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFJlc3BvbnNpdmVTdGF0ZSB7XG5cdFJlc3BvbnNpdmUgPSAwLFxuXHRVbnJlc3BvbnNpdmUgPSAxXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJQQ1Byb3RvY29sTG9nZ2VyIHtcblx0bG9nSW5jb21pbmcobXNnTGVuZ3RoOiBudW1iZXIsIHJlcTogbnVtYmVyLCBpbml0aWF0b3I6IFJlcXVlc3RJbml0aWF0b3IsIHN0cjogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZDtcblx0bG9nT3V0Z29pbmcobXNnTGVuZ3RoOiBudW1iZXIsIHJlcTogbnVtYmVyLCBpbml0aWF0b3I6IFJlcXVlc3RJbml0aWF0b3IsIHN0cjogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZDtcbn1cblxuY29uc3Qgbm9vcCA9ICgpID0+IHsgfTtcblxuY29uc3QgX1JQQ1Byb3RvY29sU3ltYm9sID0gU3ltYm9sLmZvcigncnBjUHJvdG9jb2wnKTtcbmNvbnN0IF9SUENQcm94eVN5bWJvbCA9IFN5bWJvbC5mb3IoJ3JwY1Byb3h5Jyk7XG5cbmV4cG9ydCBjbGFzcyBSUENQcm90b2NvbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUlBDUHJvdG9jb2wge1xuXG5cdFtfUlBDUHJvdG9jb2xTeW1ib2xdID0gdHJ1ZTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBVTlJFU1BPTlNJVkVfVElNRSA9IDMgKiAxMDAwOyAvLyAzc1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVzcG9uc2l2ZVN0YXRlOiBFbWl0dGVyPFJlc3BvbnNpdmVTdGF0ZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxSZXNwb25zaXZlU3RhdGU+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VSZXNwb25zaXZlU3RhdGU6IEV2ZW50PFJlc3BvbnNpdmVTdGF0ZT4gPSB0aGlzLl9vbkRpZENoYW5nZVJlc3BvbnNpdmVTdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvZ2dlcjogSVJQQ1Byb3RvY29sTG9nZ2VyIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3VyaVJlcGxhY2VyOiBKU09OU3RyaW5naWZ5UmVwbGFjZXIgfCBudWxsO1xuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2NhbHM6IGFueVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94aWVzOiBhbnlbXTtcblx0cHJpdmF0ZSBfbGFzdE1lc3NhZ2VJZDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYW5jZWxJbnZva2VkSGFuZGxlcnM6IHsgW3JlcTogc3RyaW5nXTogKCkgPT4gdm9pZCB9O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nUlBDUmVwbGllczogeyBbbXNnSWQ6IHN0cmluZ106IFBlbmRpbmdSUENSZXBseSB9O1xuXHRwcml2YXRlIF9yZXNwb25zaXZlU3RhdGU6IFJlc3BvbnNpdmVTdGF0ZTtcblx0cHJpdmF0ZSBfdW5hY2tub3dsZWRnZWRDb3VudDogbnVtYmVyO1xuXHRwcml2YXRlIF91bnJlc3BvbnNpdmVUaW1lOiBudW1iZXI7XG5cdHByaXZhdGUgX2FzeW5jQ2hlY2tVcmVzcG9uc2l2ZTogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRjb25zdHJ1Y3Rvcihwcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wsIGxvZ2dlcjogSVJQQ1Byb3RvY29sTG9nZ2VyIHwgbnVsbCA9IG51bGwsIHRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCBudWxsID0gbnVsbCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcHJvdG9jb2wgPSBwcm90b2NvbDtcblx0XHR0aGlzLl9sb2dnZXIgPSBsb2dnZXI7XG5cdFx0dGhpcy5fdXJpVHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcjtcblx0XHR0aGlzLl91cmlSZXBsYWNlciA9IGNyZWF0ZVVSSVJlcGxhY2VyKHRoaXMuX3VyaVRyYW5zZm9ybWVyKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdFx0dGhpcy5fbG9jYWxzID0gW107XG5cdFx0dGhpcy5fcHJveGllcyA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBQcm94eUlkZW50aWZpZXIuY291bnQ7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0dGhpcy5fbG9jYWxzW2ldID0gbnVsbDtcblx0XHRcdHRoaXMuX3Byb3hpZXNbaV0gPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLl9sYXN0TWVzc2FnZUlkID0gMDtcblx0XHR0aGlzLl9jYW5jZWxJbnZva2VkSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX3BlbmRpbmdSUENSZXBsaWVzID0ge307XG5cdFx0dGhpcy5fcmVzcG9uc2l2ZVN0YXRlID0gUmVzcG9uc2l2ZVN0YXRlLlJlc3BvbnNpdmU7XG5cdFx0dGhpcy5fdW5hY2tub3dsZWRnZWRDb3VudCA9IDA7XG5cdFx0dGhpcy5fdW5yZXNwb25zaXZlVGltZSA9IDA7XG5cdFx0dGhpcy5fYXN5bmNDaGVja1VyZXNwb25zaXZlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5fY2hlY2tVbnJlc3BvbnNpdmUoKSwgMTAwMCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Byb3RvY29sLm9uTWVzc2FnZSgobXNnKSA9PiB0aGlzLl9yZWNlaXZlT25lTWVzc2FnZShtc2cpKSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblxuXHRcdC8vIFJlbGVhc2UgYWxsIG91dHN0YW5kaW5nIHByb21pc2VzIHdpdGggYSBjYW5jZWxlZCBlcnJvclxuXHRcdE9iamVjdC5rZXlzKHRoaXMuX3BlbmRpbmdSUENSZXBsaWVzKS5mb3JFYWNoKChtc2dJZCkgPT4ge1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IHRoaXMuX3BlbmRpbmdSUENSZXBsaWVzW21zZ0lkXTtcblx0XHRcdGRlbGV0ZSB0aGlzLl9wZW5kaW5nUlBDUmVwbGllc1ttc2dJZF07XG5cdFx0XHRwZW5kaW5nLnJlc29sdmVFcnIoZXJyb3JzLmNhbmNlbGVkKCkpO1xuXHRcdH0pO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIGRyYWluKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fcHJvdG9jb2wuZHJhaW4gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiB0aGlzLl9wcm90b2NvbC5kcmFpbigpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbldpbGxTZW5kUmVxdWVzdChyZXE6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl91bmFja25vd2xlZGdlZENvdW50ID09PSAwKSB7XG5cdFx0XHQvLyBTaW5jZSB0aGlzIGlzIHRoZSBmaXJzdCByZXF1ZXN0IHdlIGFyZSBzZW5kaW5nIGluIGEgd2hpbGUsXG5cdFx0XHQvLyBtYXJrIHRoaXMgbW9tZW50IGFzIHRoZSBzdGFydCBmb3IgdGhlIGNvdW50ZG93biB0byB1bnJlc3BvbnNpdmUgdGltZVxuXHRcdFx0dGhpcy5fdW5yZXNwb25zaXZlVGltZSA9IERhdGUubm93KCkgKyBSUENQcm90b2NvbC5VTlJFU1BPTlNJVkVfVElNRTtcblx0XHR9XG5cdFx0dGhpcy5fdW5hY2tub3dsZWRnZWRDb3VudCsrO1xuXHRcdGlmICghdGhpcy5fYXN5bmNDaGVja1VyZXNwb25zaXZlLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdHRoaXMuX2FzeW5jQ2hlY2tVcmVzcG9uc2l2ZS5zY2hlZHVsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uRGlkUmVjZWl2ZUFja25vd2xlZGdlKHJlcTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gVGhlIG5leHQgcG9zc2libGUgdW5yZXNwb25zaXZlIHRpbWUgaXMgbm93ICsgZGVsdGEuXG5cdFx0dGhpcy5fdW5yZXNwb25zaXZlVGltZSA9IERhdGUubm93KCkgKyBSUENQcm90b2NvbC5VTlJFU1BPTlNJVkVfVElNRTtcblx0XHR0aGlzLl91bmFja25vd2xlZGdlZENvdW50LS07XG5cdFx0aWYgKHRoaXMuX3VuYWNrbm93bGVkZ2VkQ291bnQgPT09IDApIHtcblx0XHRcdC8vIE5vIG1vcmUgbmVlZCB0byBjaGVjayBmb3IgdW5yZXNwb25zaXZlXG5cdFx0XHR0aGlzLl9hc3luY0NoZWNrVXJlc3BvbnNpdmUuY2FuY2VsKCk7XG5cdFx0fVxuXHRcdC8vIFRoZSBleHQgaG9zdCBpcyByZXNwb25zaXZlIVxuXHRcdHRoaXMuX3NldFJlc3BvbnNpdmVTdGF0ZShSZXNwb25zaXZlU3RhdGUuUmVzcG9uc2l2ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9jaGVja1VucmVzcG9uc2l2ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdW5hY2tub3dsZWRnZWRDb3VudCA9PT0gMCkge1xuXHRcdFx0Ly8gTm90IHdhaXRpbmcgZm9yIGFueXRoaW5nID0+IGNhbm5vdCBzYXkgaWYgaXQgaXMgcmVzcG9uc2l2ZSBvciBub3Rcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoRGF0ZS5ub3coKSA+IHRoaXMuX3VucmVzcG9uc2l2ZVRpbWUpIHtcblx0XHRcdC8vIFVucmVzcG9uc2l2ZSEhXG5cdFx0XHR0aGlzLl9zZXRSZXNwb25zaXZlU3RhdGUoUmVzcG9uc2l2ZVN0YXRlLlVucmVzcG9uc2l2ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIE5vdCAoeWV0KSB1bnJlc3BvbnNpdmUsIGJlIHN1cmUgdG8gY2hlY2sgYWdhaW4gc29vblxuXHRcdFx0dGhpcy5fYXN5bmNDaGVja1VyZXNwb25zaXZlLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0UmVzcG9uc2l2ZVN0YXRlKG5ld1Jlc3BvbnNpdmVTdGF0ZTogUmVzcG9uc2l2ZVN0YXRlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3Jlc3BvbnNpdmVTdGF0ZSA9PT0gbmV3UmVzcG9uc2l2ZVN0YXRlKSB7XG5cdFx0XHQvLyBubyBjaGFuZ2Vcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmVzcG9uc2l2ZVN0YXRlID0gbmV3UmVzcG9uc2l2ZVN0YXRlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVzcG9uc2l2ZVN0YXRlLmZpcmUodGhpcy5fcmVzcG9uc2l2ZVN0YXRlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgcmVzcG9uc2l2ZVN0YXRlKCk6IFJlc3BvbnNpdmVTdGF0ZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc3BvbnNpdmVTdGF0ZTtcblx0fVxuXG5cdHB1YmxpYyB0cmFuc2Zvcm1JbmNvbWluZ1VSSXM8VD4ob2JqOiBUKTogVCB7XG5cdFx0aWYgKCF0aGlzLl91cmlUcmFuc2Zvcm1lcikge1xuXHRcdFx0cmV0dXJuIG9iajtcblx0XHR9XG5cdFx0cmV0dXJuIHRyYW5zZm9ybUluY29taW5nVVJJcyhvYmosIHRoaXMuX3VyaVRyYW5zZm9ybWVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQcm94eTxUPihpZGVudGlmaWVyOiBQcm94eUlkZW50aWZpZXI8VD4pOiBQcm94aWVkPFQ+IHtcblx0XHRjb25zdCB7IG5pZDogcnBjSWQsIHNpZCB9ID0gaWRlbnRpZmllcjtcblx0XHRpZiAoIXRoaXMuX3Byb3hpZXNbcnBjSWRdKSB7XG5cdFx0XHR0aGlzLl9wcm94aWVzW3JwY0lkXSA9IHRoaXMuX2NyZWF0ZVByb3h5KHJwY0lkLCBzaWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJveGllc1tycGNJZF07XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVQcm94eTxUPihycGNJZDogbnVtYmVyLCBkZWJ1Z05hbWU6IHN0cmluZyk6IFQge1xuXHRcdGNvbnN0IGhhbmRsZXIgPSB7XG5cdFx0XHRnZXQ6ICh0YXJnZXQ6IGFueSwgbmFtZTogUHJvcGVydHlLZXkpID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyAmJiAhdGFyZ2V0W25hbWVdICYmIG5hbWUuY2hhckNvZGVBdCgwKSA9PT0gQ2hhckNvZGUuRG9sbGFyU2lnbikge1xuXHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9ICguLi5teUFyZ3M6IGFueVtdKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlQ2FsbChycGNJZCwgbmFtZSwgbXlBcmdzKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChuYW1lID09PSBfUlBDUHJveHlTeW1ib2wpIHtcblx0XHRcdFx0XHRyZXR1cm4gZGVidWdOYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0YXJnZXRbbmFtZV07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gbmV3IFByb3h5KE9iamVjdC5jcmVhdGUobnVsbCksIGhhbmRsZXIpO1xuXHR9XG5cblx0cHVibGljIHNldDxULCBSIGV4dGVuZHMgVD4oaWRlbnRpZmllcjogUHJveHlJZGVudGlmaWVyPFQ+LCB2YWx1ZTogUik6IFIge1xuXHRcdHRoaXMuX2xvY2Fsc1tpZGVudGlmaWVyLm5pZF0gPSB2YWx1ZTtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgYXNzZXJ0UmVnaXN0ZXJlZChpZGVudGlmaWVyczogUHJveHlJZGVudGlmaWVyPGFueT5bXSk6IHZvaWQge1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBpZGVudGlmaWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IGlkZW50aWZpZXJzW2ldO1xuXHRcdFx0aWYgKCF0aGlzLl9sb2NhbHNbaWRlbnRpZmllci5uaWRdKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBwcm94eSBpbnN0YW5jZSAke2lkZW50aWZpZXIuc2lkfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlY2VpdmVPbmVNZXNzYWdlKHJhd21zZzogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1zZ0xlbmd0aCA9IHJhd21zZy5ieXRlTGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZmYgPSBNZXNzYWdlQnVmZmVyLnJlYWQocmF3bXNnLCAwKTtcblx0XHRjb25zdCBtZXNzYWdlVHlwZSA9IDxNZXNzYWdlVHlwZT5idWZmLnJlYWRVSW50OCgpO1xuXHRcdGNvbnN0IHJlcSA9IGJ1ZmYucmVhZFVJbnQzMigpO1xuXG5cdFx0c3dpdGNoIChtZXNzYWdlVHlwZSkge1xuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXF1ZXN0SlNPTkFyZ3M6XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLlJlcXVlc3RKU09OQXJnc1dpdGhDYW5jZWxsYXRpb246IHtcblx0XHRcdFx0bGV0IHsgcnBjSWQsIG1ldGhvZCwgYXJncyB9ID0gTWVzc2FnZUlPLmRlc2VyaWFsaXplUmVxdWVzdEpTT05BcmdzKGJ1ZmYpO1xuXHRcdFx0XHRpZiAodGhpcy5fdXJpVHJhbnNmb3JtZXIpIHtcblx0XHRcdFx0XHRhcmdzID0gdHJhbnNmb3JtSW5jb21pbmdVUklzKGFyZ3MsIHRoaXMuX3VyaVRyYW5zZm9ybWVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yZWNlaXZlUmVxdWVzdChtc2dMZW5ndGgsIHJlcSwgcnBjSWQsIG1ldGhvZCwgYXJncywgKG1lc3NhZ2VUeXBlID09PSBNZXNzYWdlVHlwZS5SZXF1ZXN0SlNPTkFyZ3NXaXRoQ2FuY2VsbGF0aW9uKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXF1ZXN0TWl4ZWRBcmdzOlxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXF1ZXN0TWl4ZWRBcmdzV2l0aENhbmNlbGxhdGlvbjoge1xuXHRcdFx0XHRsZXQgeyBycGNJZCwgbWV0aG9kLCBhcmdzIH0gPSBNZXNzYWdlSU8uZGVzZXJpYWxpemVSZXF1ZXN0TWl4ZWRBcmdzKGJ1ZmYpO1xuXHRcdFx0XHRpZiAodGhpcy5fdXJpVHJhbnNmb3JtZXIpIHtcblx0XHRcdFx0XHRhcmdzID0gdHJhbnNmb3JtSW5jb21pbmdVUklzKGFyZ3MsIHRoaXMuX3VyaVRyYW5zZm9ybWVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yZWNlaXZlUmVxdWVzdChtc2dMZW5ndGgsIHJlcSwgcnBjSWQsIG1ldGhvZCwgYXJncywgKG1lc3NhZ2VUeXBlID09PSBNZXNzYWdlVHlwZS5SZXF1ZXN0TWl4ZWRBcmdzV2l0aENhbmNlbGxhdGlvbikpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuQWNrbm93bGVkZ2VkOiB7XG5cdFx0XHRcdHRoaXMuX2xvZ2dlcj8ubG9nSW5jb21pbmcobXNnTGVuZ3RoLCByZXEsIFJlcXVlc3RJbml0aWF0b3IuTG9jYWxTaWRlLCBgYWNrYCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkUmVjZWl2ZUFja25vd2xlZGdlKHJlcSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5DYW5jZWw6IHtcblx0XHRcdFx0dGhpcy5fcmVjZWl2ZUNhbmNlbChtc2dMZW5ndGgsIHJlcSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXBseU9LRW1wdHk6IHtcblx0XHRcdFx0dGhpcy5fcmVjZWl2ZVJlcGx5KG1zZ0xlbmd0aCwgcmVxLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuUmVwbHlPS0pTT046IHtcblx0XHRcdFx0bGV0IHZhbHVlID0gTWVzc2FnZUlPLmRlc2VyaWFsaXplUmVwbHlPS0pTT04oYnVmZik7XG5cdFx0XHRcdGlmICh0aGlzLl91cmlUcmFuc2Zvcm1lcikge1xuXHRcdFx0XHRcdHZhbHVlID0gdHJhbnNmb3JtSW5jb21pbmdVUklzKHZhbHVlLCB0aGlzLl91cmlUcmFuc2Zvcm1lcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcmVjZWl2ZVJlcGx5KG1zZ0xlbmd0aCwgcmVxLCB2YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXBseU9LSlNPTldpdGhCdWZmZXJzOiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gTWVzc2FnZUlPLmRlc2VyaWFsaXplUmVwbHlPS0pTT05XaXRoQnVmZmVycyhidWZmLCB0aGlzLl91cmlUcmFuc2Zvcm1lcik7XG5cdFx0XHRcdHRoaXMuX3JlY2VpdmVSZXBseShtc2dMZW5ndGgsIHJlcSwgdmFsdWUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuUmVwbHlPS1ZTQnVmZmVyOiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gTWVzc2FnZUlPLmRlc2VyaWFsaXplUmVwbHlPS1ZTQnVmZmVyKGJ1ZmYpO1xuXHRcdFx0XHR0aGlzLl9yZWNlaXZlUmVwbHkobXNnTGVuZ3RoLCByZXEsIHZhbHVlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLlJlcGx5RXJyRXJyb3I6IHtcblx0XHRcdFx0bGV0IGVyciA9IE1lc3NhZ2VJTy5kZXNlcmlhbGl6ZVJlcGx5RXJyRXJyb3IoYnVmZik7XG5cdFx0XHRcdGlmICh0aGlzLl91cmlUcmFuc2Zvcm1lcikge1xuXHRcdFx0XHRcdGVyciA9IHRyYW5zZm9ybUluY29taW5nVVJJcyhlcnIsIHRoaXMuX3VyaVRyYW5zZm9ybWVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yZWNlaXZlUmVwbHlFcnIobXNnTGVuZ3RoLCByZXEsIGVycik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNZXNzYWdlVHlwZS5SZXBseUVyckVtcHR5OiB7XG5cdFx0XHRcdHRoaXMuX3JlY2VpdmVSZXBseUVycihtc2dMZW5ndGgsIHJlcSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRjb25zb2xlLmVycm9yKGByZWNlaXZlZCB1bmV4cGVjdGVkIG1lc3NhZ2VgKTtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihyYXdtc2cpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlY2VpdmVSZXF1ZXN0KG1zZ0xlbmd0aDogbnVtYmVyLCByZXE6IG51bWJlciwgcnBjSWQ6IG51bWJlciwgbWV0aG9kOiBzdHJpbmcsIGFyZ3M6IGFueVtdLCB1c2VzQ2FuY2VsbGF0aW9uVG9rZW46IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dnZXI/LmxvZ0luY29taW5nKG1zZ0xlbmd0aCwgcmVxLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgYHJlY2VpdmVSZXF1ZXN0ICR7Z2V0U3RyaW5nSWRlbnRpZmllckZvclByb3h5KHJwY0lkKX0uJHttZXRob2R9KGAsIGFyZ3MpO1xuXHRcdGNvbnN0IGNhbGxJZCA9IFN0cmluZyhyZXEpO1xuXG5cdFx0bGV0IHByb21pc2U6IFByb21pc2U8YW55Pjtcblx0XHRsZXQgY2FuY2VsOiAoKSA9PiB2b2lkO1xuXHRcdGlmICh1c2VzQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRhcmdzLnB1c2goY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4pO1xuXHRcdFx0cHJvbWlzZSA9IHRoaXMuX2ludm9rZUhhbmRsZXIocnBjSWQsIG1ldGhvZCwgYXJncyk7XG5cdFx0XHRjYW5jZWwgPSAoKSA9PiBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gY2Fubm90IGJlIGNhbmNlbGxlZFxuXHRcdFx0cHJvbWlzZSA9IHRoaXMuX2ludm9rZUhhbmRsZXIocnBjSWQsIG1ldGhvZCwgYXJncyk7XG5cdFx0XHRjYW5jZWwgPSBub29wO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NhbmNlbEludm9rZWRIYW5kbGVyc1tjYWxsSWRdID0gY2FuY2VsO1xuXG5cdFx0Ly8gQWNrbm93bGVkZ2UgdGhlIHJlcXVlc3Rcblx0XHRjb25zdCBtc2cgPSBNZXNzYWdlSU8uc2VyaWFsaXplQWNrbm93bGVkZ2VkKHJlcSk7XG5cdFx0dGhpcy5fbG9nZ2VyPy5sb2dPdXRnb2luZyhtc2cuYnl0ZUxlbmd0aCwgcmVxLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgYGFja2ApO1xuXHRcdHRoaXMuX3Byb3RvY29sLnNlbmQobXNnKTtcblxuXHRcdHByb21pc2UudGhlbigocikgPT4ge1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2NhbmNlbEludm9rZWRIYW5kbGVyc1tjYWxsSWRdO1xuXHRcdFx0Y29uc3QgbXNnID0gTWVzc2FnZUlPLnNlcmlhbGl6ZVJlcGx5T0socmVxLCByLCB0aGlzLl91cmlSZXBsYWNlcik7XG5cdFx0XHR0aGlzLl9sb2dnZXI/LmxvZ091dGdvaW5nKG1zZy5ieXRlTGVuZ3RoLCByZXEsIFJlcXVlc3RJbml0aWF0b3IuT3RoZXJTaWRlLCBgcmVwbHk6YCwgcik7XG5cdFx0XHR0aGlzLl9wcm90b2NvbC5zZW5kKG1zZyk7XG5cdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2NhbmNlbEludm9rZWRIYW5kbGVyc1tjYWxsSWRdO1xuXHRcdFx0Y29uc3QgbXNnID0gTWVzc2FnZUlPLnNlcmlhbGl6ZVJlcGx5RXJyKHJlcSwgZXJyKTtcblx0XHRcdHRoaXMuX2xvZ2dlcj8ubG9nT3V0Z29pbmcobXNnLmJ5dGVMZW5ndGgsIHJlcSwgUmVxdWVzdEluaXRpYXRvci5PdGhlclNpZGUsIGByZXBseUVycjpgLCBlcnIpO1xuXHRcdFx0dGhpcy5fcHJvdG9jb2wuc2VuZChtc2cpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVjZWl2ZUNhbmNlbChtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dnZXI/LmxvZ0luY29taW5nKG1zZ0xlbmd0aCwgcmVxLCBSZXF1ZXN0SW5pdGlhdG9yLk90aGVyU2lkZSwgYHJlY2VpdmVDYW5jZWxgKTtcblx0XHRjb25zdCBjYWxsSWQgPSBTdHJpbmcocmVxKTtcblx0XHR0aGlzLl9jYW5jZWxJbnZva2VkSGFuZGxlcnNbY2FsbElkXT8uKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWNlaXZlUmVwbHkobXNnTGVuZ3RoOiBudW1iZXIsIHJlcTogbnVtYmVyLCB2YWx1ZTogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5fbG9nZ2VyPy5sb2dJbmNvbWluZyhtc2dMZW5ndGgsIHJlcSwgUmVxdWVzdEluaXRpYXRvci5Mb2NhbFNpZGUsIGByZWNlaXZlUmVwbHk6YCwgdmFsdWUpO1xuXHRcdGNvbnN0IGNhbGxJZCA9IFN0cmluZyhyZXEpO1xuXHRcdGlmICghdGhpcy5fcGVuZGluZ1JQQ1JlcGxpZXMuaGFzT3duUHJvcGVydHkoY2FsbElkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBlbmRpbmdSZXBseSA9IHRoaXMuX3BlbmRpbmdSUENSZXBsaWVzW2NhbGxJZF07XG5cdFx0ZGVsZXRlIHRoaXMuX3BlbmRpbmdSUENSZXBsaWVzW2NhbGxJZF07XG5cblx0XHRwZW5kaW5nUmVwbHkucmVzb2x2ZU9rKHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlY2VpdmVSZXBseUVycihtc2dMZW5ndGg6IG51bWJlciwgcmVxOiBudW1iZXIsIHZhbHVlOiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dnZXI/LmxvZ0luY29taW5nKG1zZ0xlbmd0aCwgcmVxLCBSZXF1ZXN0SW5pdGlhdG9yLkxvY2FsU2lkZSwgYHJlY2VpdmVSZXBseUVycjpgLCB2YWx1ZSk7XG5cblx0XHRjb25zdCBjYWxsSWQgPSBTdHJpbmcocmVxKTtcblx0XHRpZiAoIXRoaXMuX3BlbmRpbmdSUENSZXBsaWVzLmhhc093blByb3BlcnR5KGNhbGxJZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwZW5kaW5nUmVwbHkgPSB0aGlzLl9wZW5kaW5nUlBDUmVwbGllc1tjYWxsSWRdO1xuXHRcdGRlbGV0ZSB0aGlzLl9wZW5kaW5nUlBDUmVwbGllc1tjYWxsSWRdO1xuXG5cdFx0bGV0IGVycjogYW55ID0gdW5kZWZpbmVkO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0aWYgKHZhbHVlLiRpc0Vycm9yKSB7XG5cdFx0XHRcdGVyciA9IG5ldyBFcnJvcigpO1xuXHRcdFx0XHRlcnIubmFtZSA9IHZhbHVlLm5hbWU7XG5cdFx0XHRcdGVyci5tZXNzYWdlID0gdmFsdWUubWVzc2FnZTtcblx0XHRcdFx0ZXJyLnN0YWNrID0gdmFsdWUuc3RhY2s7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlcnIgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cGVuZGluZ1JlcGx5LnJlc29sdmVFcnIoZXJyKTtcblx0fVxuXG5cdHByaXZhdGUgX2ludm9rZUhhbmRsZXIocnBjSWQ6IG51bWJlciwgbWV0aG9kTmFtZTogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fZG9JbnZva2VIYW5kbGVyKHJwY0lkLCBtZXRob2ROYW1lLCBhcmdzKSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kb0ludm9rZUhhbmRsZXIocnBjSWQ6IG51bWJlciwgbWV0aG9kTmFtZTogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IGFueSB7XG5cdFx0Y29uc3QgYWN0b3IgPSB0aGlzLl9sb2NhbHNbcnBjSWRdO1xuXHRcdGlmICghYWN0b3IpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBhY3RvciAnICsgZ2V0U3RyaW5nSWRlbnRpZmllckZvclByb3h5KHJwY0lkKSk7XG5cdFx0fVxuXHRcdGNvbnN0IG1ldGhvZCA9IGFjdG9yW21ldGhvZE5hbWVdO1xuXHRcdGlmICh0eXBlb2YgbWV0aG9kICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWV0aG9kICcgKyBtZXRob2ROYW1lICsgJyBvbiBhY3RvciAnICsgZ2V0U3RyaW5nSWRlbnRpZmllckZvclByb3h5KHJwY0lkKSk7XG5cdFx0fVxuXHRcdHJldHVybiBtZXRob2QuYXBwbHkoYWN0b3IsIGFyZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3RlQ2FsbChycGNJZDogbnVtYmVyLCBtZXRob2ROYW1lOiBzdHJpbmcsIGFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIG5ldyBDYW5jZWxlZExhenlQcm9taXNlKCk7XG5cdFx0fVxuXHRcdGxldCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gfCBudWxsID0gbnVsbDtcblx0XHRpZiAoYXJncy5sZW5ndGggPiAwICYmIENhbmNlbGxhdGlvblRva2VuLmlzQ2FuY2VsbGF0aW9uVG9rZW4oYXJnc1thcmdzLmxlbmd0aCAtIDFdKSkge1xuXHRcdFx0Y2FuY2VsbGF0aW9uVG9rZW4gPSBhcmdzLnBvcCgpO1xuXHRcdH1cblxuXHRcdGlmIChjYW5jZWxsYXRpb25Ub2tlbiAmJiBjYW5jZWxsYXRpb25Ub2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0Ly8gTm8gbmVlZCB0byBkbyBhbnl0aGluZy4uLlxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0PGFueT4oZXJyb3JzLmNhbmNlbGVkKCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRzID0gTWVzc2FnZUlPLnNlcmlhbGl6ZVJlcXVlc3RBcmd1bWVudHMoYXJncywgdGhpcy5fdXJpUmVwbGFjZXIpO1xuXG5cdFx0Y29uc3QgcmVxID0gKyt0aGlzLl9sYXN0TWVzc2FnZUlkO1xuXHRcdGNvbnN0IGNhbGxJZCA9IFN0cmluZyhyZXEpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBMYXp5UHJvbWlzZSgpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpZiAoY2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRcdGRpc3Bvc2FibGUuYWRkKGNhbmNlbGxhdGlvblRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgbXNnID0gTWVzc2FnZUlPLnNlcmlhbGl6ZUNhbmNlbChyZXEpO1xuXHRcdFx0XHR0aGlzLl9sb2dnZXI/LmxvZ091dGdvaW5nKG1zZy5ieXRlTGVuZ3RoLCByZXEsIFJlcXVlc3RJbml0aWF0b3IuTG9jYWxTaWRlLCBgY2FuY2VsYCk7XG5cdFx0XHRcdHRoaXMuX3Byb3RvY29sLnNlbmQobXNnKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9wZW5kaW5nUlBDUmVwbGllc1tjYWxsSWRdID0gbmV3IFBlbmRpbmdSUENSZXBseShyZXN1bHQsIGRpc3Bvc2FibGUpO1xuXHRcdHRoaXMuX29uV2lsbFNlbmRSZXF1ZXN0KHJlcSk7XG5cdFx0Y29uc3QgbXNnID0gTWVzc2FnZUlPLnNlcmlhbGl6ZVJlcXVlc3QocmVxLCBycGNJZCwgbWV0aG9kTmFtZSwgc2VyaWFsaXplZFJlcXVlc3RBcmd1bWVudHMsICEhY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdHRoaXMuX2xvZ2dlcj8ubG9nT3V0Z29pbmcobXNnLmJ5dGVMZW5ndGgsIHJlcSwgUmVxdWVzdEluaXRpYXRvci5Mb2NhbFNpZGUsIGByZXF1ZXN0OiAke2dldFN0cmluZ0lkZW50aWZpZXJGb3JQcm94eShycGNJZCl9LiR7bWV0aG9kTmFtZX0oYCwgYXJncyk7XG5cdFx0dGhpcy5fcHJvdG9jb2wuc2VuZChtc2cpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY2xhc3MgUGVuZGluZ1JQQ1JlcGx5IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvbWlzZTogTGF6eVByb21pc2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZTogSURpc3Bvc2FibGVcblx0KSB7IH1cblxuXHRwdWJsaWMgcmVzb2x2ZU9rKHZhbHVlOiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl9wcm9taXNlLnJlc29sdmVPayh2YWx1ZSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZUVycihlcnI6IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb21pc2UucmVzb2x2ZUVycihlcnIpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE1lc3NhZ2VCdWZmZXIge1xuXG5cdHB1YmxpYyBzdGF0aWMgYWxsb2ModHlwZTogTWVzc2FnZVR5cGUsIHJlcTogbnVtYmVyLCBtZXNzYWdlU2l6ZTogbnVtYmVyKTogTWVzc2FnZUJ1ZmZlciB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IE1lc3NhZ2VCdWZmZXIoVlNCdWZmZXIuYWxsb2MobWVzc2FnZVNpemUgKyAxIC8qIHR5cGUgKi8gKyA0IC8qIHJlcSAqLyksIDApO1xuXHRcdHJlc3VsdC53cml0ZVVJbnQ4KHR5cGUpO1xuXHRcdHJlc3VsdC53cml0ZVVJbnQzMihyZXEpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHJlYWQoYnVmZjogVlNCdWZmZXIsIG9mZnNldDogbnVtYmVyKTogTWVzc2FnZUJ1ZmZlciB7XG5cdFx0cmV0dXJuIG5ldyBNZXNzYWdlQnVmZmVyKGJ1ZmYsIG9mZnNldCk7XG5cdH1cblxuXHRwcml2YXRlIF9idWZmOiBWU0J1ZmZlcjtcblx0cHJpdmF0ZSBfb2Zmc2V0OiBudW1iZXI7XG5cblx0cHVibGljIGdldCBidWZmZXIoKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiB0aGlzLl9idWZmO1xuXHR9XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihidWZmOiBWU0J1ZmZlciwgb2Zmc2V0OiBudW1iZXIpIHtcblx0XHR0aGlzLl9idWZmID0gYnVmZjtcblx0XHR0aGlzLl9vZmZzZXQgPSBvZmZzZXQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNpemVVSW50OCgpOiBudW1iZXIge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBzaXplVUludDMyID0gNDtcblxuXHRwdWJsaWMgd3JpdGVVSW50OChuOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9idWZmLndyaXRlVUludDgobiwgdGhpcy5fb2Zmc2V0KTsgdGhpcy5fb2Zmc2V0ICs9IDE7XG5cdH1cblxuXHRwdWJsaWMgcmVhZFVJbnQ4KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgbiA9IHRoaXMuX2J1ZmYucmVhZFVJbnQ4KHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSAxO1xuXHRcdHJldHVybiBuO1xuXHR9XG5cblx0cHVibGljIHdyaXRlVUludDMyKG46IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2J1ZmYud3JpdGVVSW50MzJCRShuLCB0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gNDtcblx0fVxuXG5cdHB1YmxpYyByZWFkVUludDMyKCk6IG51bWJlciB7XG5cdFx0Y29uc3QgbiA9IHRoaXMuX2J1ZmYucmVhZFVJbnQzMkJFKHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSA0O1xuXHRcdHJldHVybiBuO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzaXplU2hvcnRTdHJpbmcoc3RyOiBWU0J1ZmZlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIDEgLyogc3RyaW5nIGxlbmd0aCAqLyArIHN0ci5ieXRlTGVuZ3RoIC8qIGFjdHVhbCBzdHJpbmcgKi87XG5cdH1cblxuXHRwdWJsaWMgd3JpdGVTaG9ydFN0cmluZyhzdHI6IFZTQnVmZmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYnVmZi53cml0ZVVJbnQ4KHN0ci5ieXRlTGVuZ3RoLCB0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gMTtcblx0XHR0aGlzLl9idWZmLnNldChzdHIsIHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSBzdHIuYnl0ZUxlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyByZWFkU2hvcnRTdHJpbmcoKTogc3RyaW5nIHtcblx0XHRjb25zdCBzdHJCeXRlTGVuZ3RoID0gdGhpcy5fYnVmZi5yZWFkVUludDgodGhpcy5fb2Zmc2V0KTsgdGhpcy5fb2Zmc2V0ICs9IDE7XG5cdFx0Y29uc3Qgc3RyQnVmZiA9IHRoaXMuX2J1ZmYuc2xpY2UodGhpcy5fb2Zmc2V0LCB0aGlzLl9vZmZzZXQgKyBzdHJCeXRlTGVuZ3RoKTtcblx0XHRjb25zdCBzdHIgPSBzdHJCdWZmLnRvU3RyaW5nKCk7IHRoaXMuX29mZnNldCArPSBzdHJCeXRlTGVuZ3RoO1xuXHRcdHJldHVybiBzdHI7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNpemVMb25nU3RyaW5nKHN0cjogVlNCdWZmZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiA0IC8qIHN0cmluZyBsZW5ndGggKi8gKyBzdHIuYnl0ZUxlbmd0aCAvKiBhY3R1YWwgc3RyaW5nICovO1xuXHR9XG5cblx0cHVibGljIHdyaXRlTG9uZ1N0cmluZyhzdHI6IFZTQnVmZmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYnVmZi53cml0ZVVJbnQzMkJFKHN0ci5ieXRlTGVuZ3RoLCB0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gNDtcblx0XHR0aGlzLl9idWZmLnNldChzdHIsIHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSBzdHIuYnl0ZUxlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyByZWFkTG9uZ1N0cmluZygpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHN0ckJ5dGVMZW5ndGggPSB0aGlzLl9idWZmLnJlYWRVSW50MzJCRSh0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gNDtcblx0XHRjb25zdCBzdHJCdWZmID0gdGhpcy5fYnVmZi5zbGljZSh0aGlzLl9vZmZzZXQsIHRoaXMuX29mZnNldCArIHN0ckJ5dGVMZW5ndGgpO1xuXHRcdGNvbnN0IHN0ciA9IHN0ckJ1ZmYudG9TdHJpbmcoKTsgdGhpcy5fb2Zmc2V0ICs9IHN0ckJ5dGVMZW5ndGg7XG5cdFx0cmV0dXJuIHN0cjtcblx0fVxuXG5cdHB1YmxpYyB3cml0ZUJ1ZmZlcihidWZmOiBWU0J1ZmZlcik6IHZvaWQge1xuXHRcdHRoaXMuX2J1ZmYud3JpdGVVSW50MzJCRShidWZmLmJ5dGVMZW5ndGgsIHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSA0O1xuXHRcdHRoaXMuX2J1ZmYuc2V0KGJ1ZmYsIHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSBidWZmLmJ5dGVMZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNpemVWU0J1ZmZlcihidWZmOiBWU0J1ZmZlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIDQgLyogYnVmZmVyIGxlbmd0aCAqLyArIGJ1ZmYuYnl0ZUxlbmd0aCAvKiBhY3R1YWwgYnVmZmVyICovO1xuXHR9XG5cblx0cHVibGljIHdyaXRlVlNCdWZmZXIoYnVmZjogVlNCdWZmZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9idWZmLndyaXRlVUludDMyQkUoYnVmZi5ieXRlTGVuZ3RoLCB0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gNDtcblx0XHR0aGlzLl9idWZmLnNldChidWZmLCB0aGlzLl9vZmZzZXQpOyB0aGlzLl9vZmZzZXQgKz0gYnVmZi5ieXRlTGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIHJlYWRWU0J1ZmZlcigpOiBWU0J1ZmZlciB7XG5cdFx0Y29uc3QgYnVmZkxlbmd0aCA9IHRoaXMuX2J1ZmYucmVhZFVJbnQzMkJFKHRoaXMuX29mZnNldCk7IHRoaXMuX29mZnNldCArPSA0O1xuXHRcdGNvbnN0IGJ1ZmYgPSB0aGlzLl9idWZmLnNsaWNlKHRoaXMuX29mZnNldCwgdGhpcy5fb2Zmc2V0ICsgYnVmZkxlbmd0aCk7IHRoaXMuX29mZnNldCArPSBidWZmTGVuZ3RoO1xuXHRcdHJldHVybiBidWZmO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzaXplTWl4ZWRBcnJheShhcnI6IHJlYWRvbmx5IE1peGVkQXJnW10pOiBudW1iZXIge1xuXHRcdGxldCBzaXplID0gMDtcblx0XHRzaXplICs9IDE7IC8vIGFyciBsZW5ndGhcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBlbCA9IGFycltpXTtcblx0XHRcdHNpemUgKz0gMTsgLy8gYXJnIHR5cGVcblx0XHRcdHN3aXRjaCAoZWwudHlwZSkge1xuXHRcdFx0XHRjYXNlIEFyZ1R5cGUuU3RyaW5nOlxuXHRcdFx0XHRcdHNpemUgKz0gdGhpcy5zaXplTG9uZ1N0cmluZyhlbC52YWx1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQXJnVHlwZS5WU0J1ZmZlcjpcblx0XHRcdFx0XHRzaXplICs9IHRoaXMuc2l6ZVZTQnVmZmVyKGVsLnZhbHVlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBBcmdUeXBlLlNlcmlhbGl6ZWRPYmplY3RXaXRoQnVmZmVyczpcblx0XHRcdFx0XHRzaXplICs9IHRoaXMuc2l6ZVVJbnQzMjsgLy8gYnVmZmVyIGNvdW50XG5cdFx0XHRcdFx0c2l6ZSArPSB0aGlzLnNpemVMb25nU3RyaW5nKGVsLnZhbHVlKTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGVsLmJ1ZmZlcnMubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0XHRcdHNpemUgKz0gdGhpcy5zaXplVlNCdWZmZXIoZWwuYnVmZmVyc1tpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEFyZ1R5cGUuVW5kZWZpbmVkOlxuXHRcdFx0XHRcdC8vIGVtcHR5Li4uXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBzaXplO1xuXHR9XG5cblx0cHVibGljIHdyaXRlTWl4ZWRBcnJheShhcnI6IHJlYWRvbmx5IE1peGVkQXJnW10pOiB2b2lkIHtcblx0XHR0aGlzLl9idWZmLndyaXRlVUludDgoYXJyLmxlbmd0aCwgdGhpcy5fb2Zmc2V0KTsgdGhpcy5fb2Zmc2V0ICs9IDE7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgZWwgPSBhcnJbaV07XG5cdFx0XHRzd2l0Y2ggKGVsLnR5cGUpIHtcblx0XHRcdFx0Y2FzZSBBcmdUeXBlLlN0cmluZzpcblx0XHRcdFx0XHR0aGlzLndyaXRlVUludDgoQXJnVHlwZS5TdHJpbmcpO1xuXHRcdFx0XHRcdHRoaXMud3JpdGVMb25nU3RyaW5nKGVsLnZhbHVlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBBcmdUeXBlLlZTQnVmZmVyOlxuXHRcdFx0XHRcdHRoaXMud3JpdGVVSW50OChBcmdUeXBlLlZTQnVmZmVyKTtcblx0XHRcdFx0XHR0aGlzLndyaXRlVlNCdWZmZXIoZWwudmFsdWUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEFyZ1R5cGUuU2VyaWFsaXplZE9iamVjdFdpdGhCdWZmZXJzOlxuXHRcdFx0XHRcdHRoaXMud3JpdGVVSW50OChBcmdUeXBlLlNlcmlhbGl6ZWRPYmplY3RXaXRoQnVmZmVycyk7XG5cdFx0XHRcdFx0dGhpcy53cml0ZVVJbnQzMihlbC5idWZmZXJzLmxlbmd0aCk7XG5cdFx0XHRcdFx0dGhpcy53cml0ZUxvbmdTdHJpbmcoZWwudmFsdWUpO1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZWwuYnVmZmVycy5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHRcdFx0dGhpcy53cml0ZUJ1ZmZlcihlbC5idWZmZXJzW2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQXJnVHlwZS5VbmRlZmluZWQ6XG5cdFx0XHRcdFx0dGhpcy53cml0ZVVJbnQ4KEFyZ1R5cGUuVW5kZWZpbmVkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVhZE1peGVkQXJyYXkoKTogQXJyYXk8c3RyaW5nIHwgVlNCdWZmZXIgfCBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVyczxhbnk+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgYXJyTGVuID0gdGhpcy5fYnVmZi5yZWFkVUludDgodGhpcy5fb2Zmc2V0KTsgdGhpcy5fb2Zmc2V0ICs9IDE7XG5cdFx0Y29uc3QgYXJyOiBBcnJheTxzdHJpbmcgfCBWU0J1ZmZlciB8IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPGFueT4gfCB1bmRlZmluZWQ+ID0gbmV3IEFycmF5KGFyckxlbik7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcnJMZW47IGkrKykge1xuXHRcdFx0Y29uc3QgYXJnVHlwZSA9IDxBcmdUeXBlPnRoaXMucmVhZFVJbnQ4KCk7XG5cdFx0XHRzd2l0Y2ggKGFyZ1R5cGUpIHtcblx0XHRcdFx0Y2FzZSBBcmdUeXBlLlN0cmluZzpcblx0XHRcdFx0XHRhcnJbaV0gPSB0aGlzLnJlYWRMb25nU3RyaW5nKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQXJnVHlwZS5WU0J1ZmZlcjpcblx0XHRcdFx0XHRhcnJbaV0gPSB0aGlzLnJlYWRWU0J1ZmZlcigpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEFyZ1R5cGUuU2VyaWFsaXplZE9iamVjdFdpdGhCdWZmZXJzOiB7XG5cdFx0XHRcdFx0Y29uc3QgYnVmZmVyQ291bnQgPSB0aGlzLnJlYWRVSW50MzIoKTtcblx0XHRcdFx0XHRjb25zdCBqc29uU3RyaW5nID0gdGhpcy5yZWFkTG9uZ1N0cmluZygpO1xuXHRcdFx0XHRcdGNvbnN0IGJ1ZmZlcnM6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlckNvdW50OyArK2kpIHtcblx0XHRcdFx0XHRcdGJ1ZmZlcnMucHVzaCh0aGlzLnJlYWRWU0J1ZmZlcigpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXJyW2ldID0gbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHBhcnNlSnNvbkFuZFJlc3RvcmVCdWZmZXJSZWZzKGpzb25TdHJpbmcsIGJ1ZmZlcnMsIG51bGwpKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIEFyZ1R5cGUuVW5kZWZpbmVkOlxuXHRcdFx0XHRcdGFycltpXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGFycjtcblx0fVxufVxuXG5jb25zdCBlbnVtIFNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRUeXBlIHtcblx0U2ltcGxlLFxuXHRNaXhlZCxcbn1cblxudHlwZSBTZXJpYWxpemVkUmVxdWVzdEFyZ3VtZW50cyA9XG5cdHwgeyByZWFkb25seSB0eXBlOiBTZXJpYWxpemVkUmVxdWVzdEFyZ3VtZW50VHlwZS5TaW1wbGU7IGFyZ3M6IHN0cmluZyB9XG5cdHwgeyByZWFkb25seSB0eXBlOiBTZXJpYWxpemVkUmVxdWVzdEFyZ3VtZW50VHlwZS5NaXhlZDsgYXJnczogTWl4ZWRBcmdbXSB9O1xuXG5cbmNsYXNzIE1lc3NhZ2VJTyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3VzZU1peGVkQXJnU2VyaWFsaXphdGlvbihhcnI6IGFueVtdKTogYm9vbGVhbiB7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKGFycltpXSBpbnN0YW5jZW9mIFZTQnVmZmVyKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFycltpXSBpbnN0YW5jZW9mIFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBhcnJbaV0gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNlcmlhbGl6ZVJlcXVlc3RBcmd1bWVudHMoYXJnczogYW55W10sIHJlcGxhY2VyOiBKU09OU3RyaW5naWZ5UmVwbGFjZXIgfCBudWxsKTogU2VyaWFsaXplZFJlcXVlc3RBcmd1bWVudHMge1xuXHRcdGlmICh0aGlzLl91c2VNaXhlZEFyZ1NlcmlhbGl6YXRpb24oYXJncykpIHtcblx0XHRcdGNvbnN0IG1hc3NhZ2VkQXJnczogTWl4ZWRBcmdbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgYXJnID0gYXJnc1tpXTtcblx0XHRcdFx0aWYgKGFyZyBpbnN0YW5jZW9mIFZTQnVmZmVyKSB7XG5cdFx0XHRcdFx0bWFzc2FnZWRBcmdzW2ldID0geyB0eXBlOiBBcmdUeXBlLlZTQnVmZmVyLCB2YWx1ZTogYXJnIH07XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRtYXNzYWdlZEFyZ3NbaV0gPSB7IHR5cGU6IEFyZ1R5cGUuVW5kZWZpbmVkIH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMpIHtcblx0XHRcdFx0XHRjb25zdCB7IGpzb25TdHJpbmcsIHJlZmVyZW5jZWRCdWZmZXJzIH0gPSBzdHJpbmdpZnlKc29uV2l0aEJ1ZmZlclJlZnMoYXJnLnZhbHVlLCByZXBsYWNlcik7XG5cdFx0XHRcdFx0bWFzc2FnZWRBcmdzW2ldID0geyB0eXBlOiBBcmdUeXBlLlNlcmlhbGl6ZWRPYmplY3RXaXRoQnVmZmVycywgdmFsdWU6IFZTQnVmZmVyLmZyb21TdHJpbmcoanNvblN0cmluZyksIGJ1ZmZlcnM6IHJlZmVyZW5jZWRCdWZmZXJzIH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWFzc2FnZWRBcmdzW2ldID0geyB0eXBlOiBBcmdUeXBlLlN0cmluZywgdmFsdWU6IFZTQnVmZmVyLmZyb21TdHJpbmcoc3RyaW5naWZ5KGFyZywgcmVwbGFjZXIpKSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiBTZXJpYWxpemVkUmVxdWVzdEFyZ3VtZW50VHlwZS5NaXhlZCxcblx0XHRcdFx0YXJnczogbWFzc2FnZWRBcmdzLFxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRUeXBlLlNpbXBsZSxcblx0XHRcdGFyZ3M6IHN0cmluZ2lmeShhcmdzLCByZXBsYWNlcilcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzZXJpYWxpemVSZXF1ZXN0KHJlcTogbnVtYmVyLCBycGNJZDogbnVtYmVyLCBtZXRob2Q6IHN0cmluZywgc2VyaWFsaXplZEFyZ3M6IFNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRzLCB1c2VzQ2FuY2VsbGF0aW9uVG9rZW46IGJvb2xlYW4pOiBWU0J1ZmZlciB7XG5cdFx0c3dpdGNoIChzZXJpYWxpemVkQXJncy50eXBlKSB7XG5cdFx0XHRjYXNlIFNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRUeXBlLlNpbXBsZTpcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JlcXVlc3RKU09OQXJncyhyZXEsIHJwY0lkLCBtZXRob2QsIHNlcmlhbGl6ZWRBcmdzLmFyZ3MsIHVzZXNDYW5jZWxsYXRpb25Ub2tlbik7XG5cdFx0XHRjYXNlIFNlcmlhbGl6ZWRSZXF1ZXN0QXJndW1lbnRUeXBlLk1peGVkOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVxdWVzdE1peGVkQXJncyhyZXEsIHJwY0lkLCBtZXRob2QsIHNlcmlhbGl6ZWRBcmdzLmFyZ3MsIHVzZXNDYW5jZWxsYXRpb25Ub2tlbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlcXVlc3RKU09OQXJncyhyZXE6IG51bWJlciwgcnBjSWQ6IG51bWJlciwgbWV0aG9kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZywgdXNlc0NhbmNlbGxhdGlvblRva2VuOiBib29sZWFuKTogVlNCdWZmZXIge1xuXHRcdGNvbnN0IG1ldGhvZEJ1ZmYgPSBWU0J1ZmZlci5mcm9tU3RyaW5nKG1ldGhvZCk7XG5cdFx0Y29uc3QgYXJnc0J1ZmYgPSBWU0J1ZmZlci5mcm9tU3RyaW5nKGFyZ3MpO1xuXG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVVJbnQ4KCk7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVNob3J0U3RyaW5nKG1ldGhvZEJ1ZmYpO1xuXHRcdGxlbiArPSBNZXNzYWdlQnVmZmVyLnNpemVMb25nU3RyaW5nKGFyZ3NCdWZmKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IE1lc3NhZ2VCdWZmZXIuYWxsb2ModXNlc0NhbmNlbGxhdGlvblRva2VuID8gTWVzc2FnZVR5cGUuUmVxdWVzdEpTT05BcmdzV2l0aENhbmNlbGxhdGlvbiA6IE1lc3NhZ2VUeXBlLlJlcXVlc3RKU09OQXJncywgcmVxLCBsZW4pO1xuXHRcdHJlc3VsdC53cml0ZVVJbnQ4KHJwY0lkKTtcblx0XHRyZXN1bHQud3JpdGVTaG9ydFN0cmluZyhtZXRob2RCdWZmKTtcblx0XHRyZXN1bHQud3JpdGVMb25nU3RyaW5nKGFyZ3NCdWZmKTtcblx0XHRyZXR1cm4gcmVzdWx0LmJ1ZmZlcjtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVzZXJpYWxpemVSZXF1ZXN0SlNPTkFyZ3MoYnVmZjogTWVzc2FnZUJ1ZmZlcik6IHsgcnBjSWQ6IG51bWJlcjsgbWV0aG9kOiBzdHJpbmc7IGFyZ3M6IGFueVtdIH0ge1xuXHRcdGNvbnN0IHJwY0lkID0gYnVmZi5yZWFkVUludDgoKTtcblx0XHRjb25zdCBtZXRob2QgPSBidWZmLnJlYWRTaG9ydFN0cmluZygpO1xuXHRcdGNvbnN0IGFyZ3MgPSBidWZmLnJlYWRMb25nU3RyaW5nKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJwY0lkOiBycGNJZCxcblx0XHRcdG1ldGhvZDogbWV0aG9kLFxuXHRcdFx0YXJnczogSlNPTi5wYXJzZShhcmdzKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmVxdWVzdE1peGVkQXJncyhyZXE6IG51bWJlciwgcnBjSWQ6IG51bWJlciwgbWV0aG9kOiBzdHJpbmcsIGFyZ3M6IHJlYWRvbmx5IE1peGVkQXJnW10sIHVzZXNDYW5jZWxsYXRpb25Ub2tlbjogYm9vbGVhbik6IFZTQnVmZmVyIHtcblx0XHRjb25zdCBtZXRob2RCdWZmID0gVlNCdWZmZXIuZnJvbVN0cmluZyhtZXRob2QpO1xuXG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVVJbnQ4KCk7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVNob3J0U3RyaW5nKG1ldGhvZEJ1ZmYpO1xuXHRcdGxlbiArPSBNZXNzYWdlQnVmZmVyLnNpemVNaXhlZEFycmF5KGFyZ3MpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gTWVzc2FnZUJ1ZmZlci5hbGxvYyh1c2VzQ2FuY2VsbGF0aW9uVG9rZW4gPyBNZXNzYWdlVHlwZS5SZXF1ZXN0TWl4ZWRBcmdzV2l0aENhbmNlbGxhdGlvbiA6IE1lc3NhZ2VUeXBlLlJlcXVlc3RNaXhlZEFyZ3MsIHJlcSwgbGVuKTtcblx0XHRyZXN1bHQud3JpdGVVSW50OChycGNJZCk7XG5cdFx0cmVzdWx0LndyaXRlU2hvcnRTdHJpbmcobWV0aG9kQnVmZik7XG5cdFx0cmVzdWx0LndyaXRlTWl4ZWRBcnJheShhcmdzKTtcblx0XHRyZXR1cm4gcmVzdWx0LmJ1ZmZlcjtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVzZXJpYWxpemVSZXF1ZXN0TWl4ZWRBcmdzKGJ1ZmY6IE1lc3NhZ2VCdWZmZXIpOiB7IHJwY0lkOiBudW1iZXI7IG1ldGhvZDogc3RyaW5nOyBhcmdzOiBhbnlbXSB9IHtcblx0XHRjb25zdCBycGNJZCA9IGJ1ZmYucmVhZFVJbnQ4KCk7XG5cdFx0Y29uc3QgbWV0aG9kID0gYnVmZi5yZWFkU2hvcnRTdHJpbmcoKTtcblx0XHRjb25zdCByYXdhcmdzID0gYnVmZi5yZWFkTWl4ZWRBcnJheSgpO1xuXHRcdGNvbnN0IGFyZ3M6IGFueVtdID0gbmV3IEFycmF5KHJhd2FyZ3MubGVuZ3RoKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmF3YXJncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgcmF3YXJnID0gcmF3YXJnc1tpXTtcblx0XHRcdGlmICh0eXBlb2YgcmF3YXJnID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRhcmdzW2ldID0gSlNPTi5wYXJzZShyYXdhcmcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXJnc1tpXSA9IHJhd2FyZztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJwY0lkOiBycGNJZCxcblx0XHRcdG1ldGhvZDogbWV0aG9kLFxuXHRcdFx0YXJnczogYXJnc1xuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHNlcmlhbGl6ZUFja25vd2xlZGdlZChyZXE6IG51bWJlcik6IFZTQnVmZmVyIHtcblx0XHRyZXR1cm4gTWVzc2FnZUJ1ZmZlci5hbGxvYyhNZXNzYWdlVHlwZS5BY2tub3dsZWRnZWQsIHJlcSwgMCkuYnVmZmVyO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzZXJpYWxpemVDYW5jZWwocmVxOiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdFx0cmV0dXJuIE1lc3NhZ2VCdWZmZXIuYWxsb2MoTWVzc2FnZVR5cGUuQ2FuY2VsLCByZXEsIDApLmJ1ZmZlcjtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgc2VyaWFsaXplUmVwbHlPSyhyZXE6IG51bWJlciwgcmVzOiBhbnksIHJlcGxhY2VyOiBKU09OU3RyaW5naWZ5UmVwbGFjZXIgfCBudWxsKTogVlNCdWZmZXIge1xuXHRcdGlmICh0eXBlb2YgcmVzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NlcmlhbGl6ZVJlcGx5T0tFbXB0eShyZXEpO1xuXHRcdH0gZWxzZSBpZiAocmVzIGluc3RhbmNlb2YgVlNCdWZmZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zZXJpYWxpemVSZXBseU9LVlNCdWZmZXIocmVxLCByZXMpO1xuXHRcdH0gZWxzZSBpZiAocmVzIGluc3RhbmNlb2YgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMpIHtcblx0XHRcdGNvbnN0IHsganNvblN0cmluZywgcmVmZXJlbmNlZEJ1ZmZlcnMgfSA9IHN0cmluZ2lmeUpzb25XaXRoQnVmZmVyUmVmcyhyZXMudmFsdWUsIHJlcGxhY2VyLCB0cnVlKTtcblx0XHRcdHJldHVybiB0aGlzLl9zZXJpYWxpemVSZXBseU9LSlNPTldpdGhCdWZmZXJzKHJlcSwganNvblN0cmluZywgcmVmZXJlbmNlZEJ1ZmZlcnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2VyaWFsaXplUmVwbHlPS0pTT04ocmVxLCBzYWZlU3RyaW5naWZ5KHJlcywgcmVwbGFjZXIpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2VyaWFsaXplUmVwbHlPS0VtcHR5KHJlcTogbnVtYmVyKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiBNZXNzYWdlQnVmZmVyLmFsbG9jKE1lc3NhZ2VUeXBlLlJlcGx5T0tFbXB0eSwgcmVxLCAwKS5idWZmZXI7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2VyaWFsaXplUmVwbHlPS1ZTQnVmZmVyKHJlcTogbnVtYmVyLCByZXM6IFZTQnVmZmVyKTogVlNCdWZmZXIge1xuXHRcdGxldCBsZW4gPSAwO1xuXHRcdGxlbiArPSBNZXNzYWdlQnVmZmVyLnNpemVWU0J1ZmZlcihyZXMpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gTWVzc2FnZUJ1ZmZlci5hbGxvYyhNZXNzYWdlVHlwZS5SZXBseU9LVlNCdWZmZXIsIHJlcSwgbGVuKTtcblx0XHRyZXN1bHQud3JpdGVWU0J1ZmZlcihyZXMpO1xuXHRcdHJldHVybiByZXN1bHQuYnVmZmVyO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBkZXNlcmlhbGl6ZVJlcGx5T0tWU0J1ZmZlcihidWZmOiBNZXNzYWdlQnVmZmVyKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiBidWZmLnJlYWRWU0J1ZmZlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3NlcmlhbGl6ZVJlcGx5T0tKU09OKHJlcTogbnVtYmVyLCByZXM6IHN0cmluZyk6IFZTQnVmZmVyIHtcblx0XHRjb25zdCByZXNCdWZmID0gVlNCdWZmZXIuZnJvbVN0cmluZyhyZXMpO1xuXG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZUxvbmdTdHJpbmcocmVzQnVmZik7XG5cblx0XHRjb25zdCByZXN1bHQgPSBNZXNzYWdlQnVmZmVyLmFsbG9jKE1lc3NhZ2VUeXBlLlJlcGx5T0tKU09OLCByZXEsIGxlbik7XG5cdFx0cmVzdWx0LndyaXRlTG9uZ1N0cmluZyhyZXNCdWZmKTtcblx0XHRyZXR1cm4gcmVzdWx0LmJ1ZmZlcjtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9zZXJpYWxpemVSZXBseU9LSlNPTldpdGhCdWZmZXJzKHJlcTogbnVtYmVyLCByZXM6IHN0cmluZywgYnVmZmVyczogcmVhZG9ubHkgVlNCdWZmZXJbXSk6IFZTQnVmZmVyIHtcblx0XHRjb25zdCByZXNCdWZmID0gVlNCdWZmZXIuZnJvbVN0cmluZyhyZXMpO1xuXG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVVJbnQzMjsgLy8gYnVmZmVyIGNvdW50XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZUxvbmdTdHJpbmcocmVzQnVmZik7XG5cdFx0Zm9yIChjb25zdCBidWZmZXIgb2YgYnVmZmVycykge1xuXHRcdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZVZTQnVmZmVyKGJ1ZmZlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gTWVzc2FnZUJ1ZmZlci5hbGxvYyhNZXNzYWdlVHlwZS5SZXBseU9LSlNPTldpdGhCdWZmZXJzLCByZXEsIGxlbik7XG5cdFx0cmVzdWx0LndyaXRlVUludDMyKGJ1ZmZlcnMubGVuZ3RoKTtcblx0XHRyZXN1bHQud3JpdGVMb25nU3RyaW5nKHJlc0J1ZmYpO1xuXHRcdGZvciAoY29uc3QgYnVmZmVyIG9mIGJ1ZmZlcnMpIHtcblx0XHRcdHJlc3VsdC53cml0ZUJ1ZmZlcihidWZmZXIpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQuYnVmZmVyO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBkZXNlcmlhbGl6ZVJlcGx5T0tKU09OKGJ1ZmY6IE1lc3NhZ2VCdWZmZXIpOiBhbnkge1xuXHRcdGNvbnN0IHJlcyA9IGJ1ZmYucmVhZExvbmdTdHJpbmcoKTtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZShyZXMpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBkZXNlcmlhbGl6ZVJlcGx5T0tKU09OV2l0aEJ1ZmZlcnMoYnVmZjogTWVzc2FnZUJ1ZmZlciwgdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwpOiBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVyczxhbnk+IHtcblx0XHRjb25zdCBidWZmZXJDb3VudCA9IGJ1ZmYucmVhZFVJbnQzMigpO1xuXHRcdGNvbnN0IHJlcyA9IGJ1ZmYucmVhZExvbmdTdHJpbmcoKTtcblxuXHRcdGNvbnN0IGJ1ZmZlcnM6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlckNvdW50OyArK2kpIHtcblx0XHRcdGJ1ZmZlcnMucHVzaChidWZmLnJlYWRWU0J1ZmZlcigpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHBhcnNlSnNvbkFuZFJlc3RvcmVCdWZmZXJSZWZzKHJlcywgYnVmZmVycywgdXJpVHJhbnNmb3JtZXIpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgc2VyaWFsaXplUmVwbHlFcnIocmVxOiBudW1iZXIsIGVycjogYW55KTogVlNCdWZmZXIge1xuXHRcdGNvbnN0IGVyclN0cjogc3RyaW5nIHwgdW5kZWZpbmVkID0gKGVyciA/IHNhZmVTdHJpbmdpZnkoZXJyb3JzLnRyYW5zZm9ybUVycm9yRm9yU2VyaWFsaXphdGlvbihlcnIpLCBudWxsKSA6IHVuZGVmaW5lZCk7XG5cdFx0aWYgKHR5cGVvZiBlcnJTdHIgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2VyaWFsaXplUmVwbHlFcnJFbXB0eShyZXEpO1xuXHRcdH1cblx0XHRjb25zdCBlcnJCdWZmID0gVlNCdWZmZXIuZnJvbVN0cmluZyhlcnJTdHIpO1xuXG5cdFx0bGV0IGxlbiA9IDA7XG5cdFx0bGVuICs9IE1lc3NhZ2VCdWZmZXIuc2l6ZUxvbmdTdHJpbmcoZXJyQnVmZik7XG5cblx0XHRjb25zdCByZXN1bHQgPSBNZXNzYWdlQnVmZmVyLmFsbG9jKE1lc3NhZ2VUeXBlLlJlcGx5RXJyRXJyb3IsIHJlcSwgbGVuKTtcblx0XHRyZXN1bHQud3JpdGVMb25nU3RyaW5nKGVyckJ1ZmYpO1xuXHRcdHJldHVybiByZXN1bHQuYnVmZmVyO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBkZXNlcmlhbGl6ZVJlcGx5RXJyRXJyb3IoYnVmZjogTWVzc2FnZUJ1ZmZlcik6IEVycm9yIHtcblx0XHRjb25zdCBlcnIgPSBidWZmLnJlYWRMb25nU3RyaW5nKCk7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2UoZXJyKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9zZXJpYWxpemVSZXBseUVyckVtcHR5KHJlcTogbnVtYmVyKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiBNZXNzYWdlQnVmZmVyLmFsbG9jKE1lc3NhZ2VUeXBlLlJlcGx5RXJyRW1wdHksIHJlcSwgMCkuYnVmZmVyO1xuXHR9XG59XG5cbmNvbnN0IGVudW0gTWVzc2FnZVR5cGUge1xuXHRSZXF1ZXN0SlNPTkFyZ3MgPSAxLFxuXHRSZXF1ZXN0SlNPTkFyZ3NXaXRoQ2FuY2VsbGF0aW9uID0gMixcblx0UmVxdWVzdE1peGVkQXJncyA9IDMsXG5cdFJlcXVlc3RNaXhlZEFyZ3NXaXRoQ2FuY2VsbGF0aW9uID0gNCxcblx0QWNrbm93bGVkZ2VkID0gNSxcblx0Q2FuY2VsID0gNixcblx0UmVwbHlPS0VtcHR5ID0gNyxcblx0UmVwbHlPS1ZTQnVmZmVyID0gOCxcblx0UmVwbHlPS0pTT04gPSA5LFxuXHRSZXBseU9LSlNPTldpdGhCdWZmZXJzID0gMTAsXG5cdFJlcGx5RXJyRXJyb3IgPSAxMSxcblx0UmVwbHlFcnJFbXB0eSA9IDEyLFxufVxuXG5jb25zdCBlbnVtIEFyZ1R5cGUge1xuXHRTdHJpbmcgPSAxLFxuXHRWU0J1ZmZlciA9IDIsXG5cdFNlcmlhbGl6ZWRPYmplY3RXaXRoQnVmZmVycyA9IDMsXG5cdFVuZGVmaW5lZCA9IDQsXG59XG5cblxudHlwZSBNaXhlZEFyZyA9XG5cdHwgeyByZWFkb25seSB0eXBlOiBBcmdUeXBlLlN0cmluZzsgcmVhZG9ubHkgdmFsdWU6IFZTQnVmZmVyIH1cblx0fCB7IHJlYWRvbmx5IHR5cGU6IEFyZ1R5cGUuVlNCdWZmZXI7IHJlYWRvbmx5IHZhbHVlOiBWU0J1ZmZlciB9XG5cdHwgeyByZWFkb25seSB0eXBlOiBBcmdUeXBlLlNlcmlhbGl6ZWRPYmplY3RXaXRoQnVmZmVyczsgcmVhZG9ubHkgdmFsdWU6IFZTQnVmZmVyOyByZWFkb25seSBidWZmZXJzOiByZWFkb25seSBWU0J1ZmZlcltdIH1cblx0fCB7IHJlYWRvbmx5IHR5cGU6IEFyZ1R5cGUuVW5kZWZpbmVkIH1cblx0O1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFLQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLHVCQUFvQztBQUV6RCxTQUFTLG9CQUFvQjtBQUM3QixTQUEwQiw2QkFBNkI7QUFFdkQsU0FBUyxxQkFBcUIsbUJBQW1CO0FBQ2pELFNBQVMsNkJB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QUEsMEJBQUEscUJBQWtCLEtBQWxCO0FBQ0EsRUFBQUEsMEJBQUEscUNBQWtDLEtBQWxDO0FBQ0EsRUFBQUEsMEJBQUEsc0JBQW1CLEtBQW5CO0FBQ0EsRUFBQUEsMEJBQUEsc0NBQW1DLEtBQW5DO0FBQ0EsRUFBQUEsMEJBQUEsa0JBQWUsS0FBZjtBQUNBLEVBQUFBLDBCQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLDBCQUFBLGtCQUFlLEtBQWY7QUFDQSxFQUFBQSwwQkFBQSxxQkFBa0IsS0FBbEI7QUFDQSxFQUFBQSwwQkFBQSxpQkFBYyxLQUFkO0FBQ0EsRUFBQUEsMEJBQUEsNEJBQXlCLE1BQXpCO0FBQ0EsRUFBQUEsMEJBQUEsbUJBQWdCLE1BQWhCO0FBQ0EsRUFBQUEsMEJBQUEsbUJBQWdCLE1BQWhCO0FBWlUsU0FBQUE7QUFBQSxHQUFBO0FBZVgsSUFBVyxVQUFYLGtCQUFXQyxhQUFYO0FBQ0MsRUFBQUEsa0JBQUEsWUFBUyxLQUFUO0FBQ0EsRUFBQUEsa0JBQUEsY0FBVyxLQUFYO0FBQ0EsRUFBQUEsa0JBQUEsaUNBQThCLEtBQTlCO0FBQ0EsRUFBQUEsa0JBQUEsZUFBWSxLQUFaO0FBSlUsU0FBQUE7QUFBQSxHQUFBOyIsCiAgIm5hbWVzIjogWyJSZXF1ZXN0SW5pdGlhdG9yIiwgIlJlc3BvbnNpdmVTdGF0ZSIsICJtc2ciLCAiaSIsICJTZXJpYWxpemVkUmVxdWVzdEFyZ3VtZW50VHlwZSIsICJNZXNzYWdlVHlwZSIsICJBcmdUeXBlIl0KfQo=
