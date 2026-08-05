import { CharCode } from "../charCode.js";
import { onUnexpectedError, transformErrorForSerialization } from "../errors.js";
import { Emitter } from "../event.js";
import { Disposable } from "../lifecycle.js";
import { isWeb } from "../platform.js";
import * as strings from "../strings.js";
const DEFAULT_CHANNEL = "default";
const INITIALIZE = "$initialize";
let webWorkerWarningLogged = false;
function logOnceWebWorkerWarning(err) {
  if (!isWeb) {
    return;
  }
  if (!webWorkerWarningLogged) {
    webWorkerWarningLogged = true;
    console.warn("Could not create web worker(s). Falling back to loading web worker code in main thread, which might cause UI freezes. Please see https://github.com/microsoft/monaco-editor#faq");
  }
  console.warn(err.message);
}
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2[MessageType2["Request"] = 0] = "Request";
  MessageType2[MessageType2["Reply"] = 1] = "Reply";
  MessageType2[MessageType2["SubscribeEvent"] = 2] = "SubscribeEvent";
  MessageType2[MessageType2["Event"] = 3] = "Event";
  MessageType2[MessageType2["UnsubscribeEvent"] = 4] = "UnsubscribeEvent";
  return MessageType2;
})(MessageType || {});
class RequestMessage {
  constructor(vsWorker, req, channel, method, args) {
    this.vsWorker = vsWorker;
    this.req = req;
    this.channel = channel;
    this.method = method;
    this.args = args;
    this.type = 0 /* Request */;
  }
}
class ReplyMessage {
  constructor(vsWorker, seq, res, err) {
    this.vsWorker = vsWorker;
    this.seq = seq;
    this.res = res;
    this.err = err;
    this.type = 1 /* Reply */;
  }
}
class SubscribeEventMessage {
  constructor(vsWorker, req, channel, eventName, arg) {
    this.vsWorker = vsWorker;
    this.req = req;
    this.channel = channel;
    this.eventName = eventName;
    this.arg = arg;
    this.type = 2 /* SubscribeEvent */;
  }
}
class EventMessage {
  constructor(vsWorker, req, event) {
    this.vsWorker = vsWorker;
    this.req = req;
    this.event = event;
    this.type = 3 /* Event */;
  }
}
class UnsubscribeEventMessage {
  constructor(vsWorker, req) {
    this.vsWorker = vsWorker;
    this.req = req;
    this.type = 4 /* UnsubscribeEvent */;
  }
}
class WebWorkerProtocol {
  constructor(handler) {
    this._workerId = -1;
    this._handler = handler;
    this._lastSentReq = 0;
    this._pendingReplies = /* @__PURE__ */ Object.create(null);
    this._pendingEmitters = /* @__PURE__ */ new Map();
    this._pendingEvents = /* @__PURE__ */ new Map();
  }
  setWorkerId(workerId) {
    this._workerId = workerId;
  }
  sendMessage(channel, method, args) {
    const req = String(++this._lastSentReq);
    return new Promise((resolve, reject) => {
      this._pendingReplies[req] = {
        resolve,
        reject
      };
      this._send(new RequestMessage(this._workerId, req, channel, method, args));
    });
  }
  listen(channel, eventName, arg) {
    let req = null;
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        req = String(++this._lastSentReq);
        this._pendingEmitters.set(req, emitter);
        this._send(new SubscribeEventMessage(this._workerId, req, channel, eventName, arg));
      },
      onDidRemoveLastListener: () => {
        this._pendingEmitters.delete(req);
        this._send(new UnsubscribeEventMessage(this._workerId, req));
        req = null;
      }
    });
    return emitter.event;
  }
  handleMessage(message) {
    if (!message || !message.vsWorker) {
      return;
    }
    if (this._workerId !== -1 && message.vsWorker !== this._workerId) {
      return;
    }
    this._handleMessage(message);
  }
  createProxyToRemoteChannel(channel, sendMessageBarrier) {
    const handler = {
      get: (target, name) => {
        if (typeof name === "string" && !target[name]) {
          if (propertyIsDynamicEvent(name)) {
            target[name] = (arg) => {
              return this.listen(channel, name, arg);
            };
          } else if (propertyIsEvent(name)) {
            target[name] = this.listen(channel, name, void 0);
          } else if (name.charCodeAt(0) === CharCode.DollarSign) {
            target[name] = async (...myArgs) => {
              await sendMessageBarrier?.();
              return this.sendMessage(channel, name, myArgs);
            };
          }
        }
        return target[name];
      }
    };
    return new Proxy(/* @__PURE__ */ Object.create(null), handler);
  }
  _handleMessage(msg) {
    switch (msg.type) {
      case 1 /* Reply */:
        return this._handleReplyMessage(msg);
      case 0 /* Request */:
        return this._handleRequestMessage(msg);
      case 2 /* SubscribeEvent */:
        return this._handleSubscribeEventMessage(msg);
      case 3 /* Event */:
        return this._handleEventMessage(msg);
      case 4 /* UnsubscribeEvent */:
        return this._handleUnsubscribeEventMessage(msg);
    }
  }
  _handleReplyMessage(replyMessage) {
    if (!this._pendingReplies[replyMessage.seq]) {
      console.warn("Got reply to unknown seq");
      return;
    }
    const reply = this._pendingReplies[replyMessage.seq];
    delete this._pendingReplies[replyMessage.seq];
    if (replyMessage.err) {
      let err = replyMessage.err;
      if (replyMessage.err.$isError) {
        err = new Error();
        err.name = replyMessage.err.name;
        err.message = replyMessage.err.message;
        err.stack = replyMessage.err.stack;
      }
      reply.reject(err);
      return;
    }
    reply.resolve(replyMessage.res);
  }
  _handleRequestMessage(requestMessage) {
    const req = requestMessage.req;
    const result = this._handler.handleMessage(requestMessage.channel, requestMessage.method, requestMessage.args);
    result.then((r) => {
      this._send(new ReplyMessage(this._workerId, req, r, void 0));
    }, (e) => {
      if (e.detail instanceof Error) {
        e.detail = transformErrorForSerialization(e.detail);
      }
      this._send(new ReplyMessage(this._workerId, req, void 0, transformErrorForSerialization(e)));
    });
  }
  _handleSubscribeEventMessage(msg) {
    const req = msg.req;
    const disposable = this._handler.handleEvent(msg.channel, msg.eventName, msg.arg)((event) => {
      this._send(new EventMessage(this._workerId, req, event));
    });
    this._pendingEvents.set(req, disposable);
  }
  _handleEventMessage(msg) {
    if (!this._pendingEmitters.has(msg.req)) {
      console.warn("Got event for unknown req");
      return;
    }
    this._pendingEmitters.get(msg.req).fire(msg.event);
  }
  _handleUnsubscribeEventMessage(msg) {
    if (!this._pendingEvents.has(msg.req)) {
      console.warn("Got unsubscribe for unknown req");
      return;
    }
    this._pendingEvents.get(msg.req).dispose();
    this._pendingEvents.delete(msg.req);
  }
  _send(msg) {
    const transfer = [];
    if (msg.type === 0 /* Request */) {
      for (let i = 0; i < msg.args.length; i++) {
        if (msg.args[i] instanceof ArrayBuffer) {
          transfer.push(msg.args[i]);
        }
      }
    } else if (msg.type === 1 /* Reply */) {
      if (msg.res instanceof ArrayBuffer) {
        transfer.push(msg.res);
      }
    }
    this._handler.sendMessage(msg, transfer);
  }
}
class WebWorkerClient extends Disposable {
  constructor(worker) {
    super();
    this._localChannels = /* @__PURE__ */ new Map();
    this._remoteChannels = /* @__PURE__ */ new Map();
    this._worker = worker;
    this._register(this._worker.onMessage((msg) => {
      this._protocol.handleMessage(msg);
    }));
    this._register(this._worker.onError((err) => {
      logOnceWebWorkerWarning(err);
      onUnexpectedError(err);
    }));
    this._protocol = new WebWorkerProtocol({
      sendMessage: (msg, transfer) => {
        this._worker.postMessage(msg, transfer);
      },
      handleMessage: (channel, method, args) => {
        return this._handleMessage(channel, method, args);
      },
      handleEvent: (channel, eventName, arg) => {
        return this._handleEvent(channel, eventName, arg);
      }
    });
    this._protocol.setWorkerId(this._worker.getId());
    this._onModuleLoaded = this._protocol.sendMessage(DEFAULT_CHANNEL, INITIALIZE, [
      this._worker.getId()
    ]);
    this.proxy = this._protocol.createProxyToRemoteChannel(DEFAULT_CHANNEL, async () => {
      await this._onModuleLoaded;
    });
    this._onModuleLoaded.catch((e) => {
      this._onError("Worker failed to load ", e);
    });
  }
  _handleMessage(channelName, method, args) {
    const channel = this._localChannels.get(channelName);
    if (!channel) {
      return Promise.reject(new Error(`Missing channel ${channelName} on main thread`));
    }
    if (typeof channel[method] !== "function") {
      return Promise.reject(new Error(`Missing method ${method} on main thread channel ${channelName}`));
    }
    try {
      return Promise.resolve(channel[method].apply(channel, args));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  _handleEvent(channelName, eventName, arg) {
    const channel = this._localChannels.get(channelName);
    if (!channel) {
      throw new Error(`Missing channel ${channelName} on main thread`);
    }
    if (propertyIsDynamicEvent(eventName)) {
      const event = channel[eventName].call(channel, arg);
      if (typeof event !== "function") {
        throw new Error(`Missing dynamic event ${eventName} on main thread channel ${channelName}.`);
      }
      return event;
    }
    if (propertyIsEvent(eventName)) {
      const event = channel[eventName];
      if (typeof event !== "function") {
        throw new Error(`Missing event ${eventName} on main thread channel ${channelName}.`);
      }
      return event;
    }
    throw new Error(`Malformed event name ${eventName}`);
  }
  setChannel(channel, handler) {
    this._localChannels.set(channel, handler);
  }
  getChannel(channel) {
    if (!this._remoteChannels.has(channel)) {
      const inst = this._protocol.createProxyToRemoteChannel(channel, async () => {
        await this._onModuleLoaded;
      });
      this._remoteChannels.set(channel, inst);
    }
    return this._remoteChannels.get(channel);
  }
  _onError(message, error) {
    console.error(message);
    console.info(error);
  }
}
function propertyIsEvent(name) {
  return name[0] === "o" && name[1] === "n" && strings.isUpperAsciiLetter(name.charCodeAt(2));
}
function propertyIsDynamicEvent(name) {
  return /^onDynamic/.test(name) && strings.isUpperAsciiLetter(name.charCodeAt(9));
}
class WebWorkerServer {
  constructor(postMessage, requestHandlerFactory) {
    this._localChannels = /* @__PURE__ */ new Map();
    this._remoteChannels = /* @__PURE__ */ new Map();
    this._protocol = new WebWorkerProtocol({
      sendMessage: (msg, transfer) => {
        postMessage(msg, transfer);
      },
      handleMessage: (channel, method, args) => this._handleMessage(channel, method, args),
      handleEvent: (channel, eventName, arg) => this._handleEvent(channel, eventName, arg)
    });
    this.requestHandler = requestHandlerFactory(this);
  }
  onmessage(msg) {
    this._protocol.handleMessage(msg);
  }
  _handleMessage(channel, method, args) {
    if (channel === DEFAULT_CHANNEL && method === INITIALIZE) {
      return this.initialize(args[0]);
    }
    const requestHandler = channel === DEFAULT_CHANNEL ? this.requestHandler : this._localChannels.get(channel);
    if (!requestHandler) {
      return Promise.reject(new Error(`Missing channel ${channel} on worker thread`));
    }
    if (typeof requestHandler[method] !== "function") {
      return Promise.reject(new Error(`Missing method ${method} on worker thread channel ${channel}`));
    }
    try {
      return Promise.resolve(requestHandler[method].apply(requestHandler, args));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  _handleEvent(channel, eventName, arg) {
    const requestHandler = channel === DEFAULT_CHANNEL ? this.requestHandler : this._localChannels.get(channel);
    if (!requestHandler) {
      throw new Error(`Missing channel ${channel} on worker thread`);
    }
    if (propertyIsDynamicEvent(eventName)) {
      const event = requestHandler[eventName].call(requestHandler, arg);
      if (typeof event !== "function") {
        throw new Error(`Missing dynamic event ${eventName} on request handler.`);
      }
      return event;
    }
    if (propertyIsEvent(eventName)) {
      const event = requestHandler[eventName];
      if (typeof event !== "function") {
        throw new Error(`Missing event ${eventName} on request handler.`);
      }
      return event;
    }
    throw new Error(`Malformed event name ${eventName}`);
  }
  setChannel(channel, handler) {
    this._localChannels.set(channel, handler);
  }
  getChannel(channel) {
    if (!this._remoteChannels.has(channel)) {
      const inst = this._protocol.createProxyToRemoteChannel(channel);
      this._remoteChannels.set(channel, inst);
    }
    return this._remoteChannels.get(channel);
  }
  async initialize(workerId) {
    this._protocol.setWorkerId(workerId);
  }
}
export {
  WebWorkerClient,
  WebWorkerServer,
  logOnceWebWorkerWarning
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi93b3JrZXIvd2ViV29ya2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciwgdHJhbnNmb3JtRXJyb3JGb3JTZXJpYWxpemF0aW9uIH0gZnJvbSAnLi4vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uL3N0cmluZ3MuanMnO1xuXG5jb25zdCBERUZBVUxUX0NIQU5ORUwgPSAnZGVmYXVsdCc7XG5jb25zdCBJTklUSUFMSVpFID0gJyRpbml0aWFsaXplJztcblxuZXhwb3J0IGludGVyZmFjZSBJV2ViV29ya2VyIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRnZXRJZCgpOiBudW1iZXI7XG5cdG9uTWVzc2FnZTogRXZlbnQ8TWVzc2FnZT47XG5cdG9uRXJyb3I6IEV2ZW50PGFueT47XG5cdHBvc3RNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2UsIHRyYW5zZmVyOiBBcnJheUJ1ZmZlcltdKTogdm9pZDtcbn1cblxubGV0IHdlYldvcmtlcldhcm5pbmdMb2dnZWQgPSBmYWxzZTtcbmV4cG9ydCBmdW5jdGlvbiBsb2dPbmNlV2ViV29ya2VyV2FybmluZyhlcnI6IGFueSk6IHZvaWQge1xuXHRpZiAoIWlzV2ViKSB7XG5cdFx0Ly8gcnVubmluZyB0ZXN0c1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAoIXdlYldvcmtlcldhcm5pbmdMb2dnZWQpIHtcblx0XHR3ZWJXb3JrZXJXYXJuaW5nTG9nZ2VkID0gdHJ1ZTtcblx0XHRjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBjcmVhdGUgd2ViIHdvcmtlcihzKS4gRmFsbGluZyBiYWNrIHRvIGxvYWRpbmcgd2ViIHdvcmtlciBjb2RlIGluIG1haW4gdGhyZWFkLCB3aGljaCBtaWdodCBjYXVzZSBVSSBmcmVlemVzLiBQbGVhc2Ugc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvbW9uYWNvLWVkaXRvciNmYXEnKTtcblx0fVxuXHRjb25zb2xlLndhcm4oZXJyLm1lc3NhZ2UpO1xufVxuXG5jb25zdCBlbnVtIE1lc3NhZ2VUeXBlIHtcblx0UmVxdWVzdCxcblx0UmVwbHksXG5cdFN1YnNjcmliZUV2ZW50LFxuXHRFdmVudCxcblx0VW5zdWJzY3JpYmVFdmVudFxufVxuY2xhc3MgUmVxdWVzdE1lc3NhZ2Uge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IE1lc3NhZ2VUeXBlLlJlcXVlc3Q7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB2c1dvcmtlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSByZXE6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBtZXRob2Q6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgYXJnczogYW55W11cblx0KSB7IH1cbn1cbmNsYXNzIFJlcGx5TWVzc2FnZSB7XG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gTWVzc2FnZVR5cGUuUmVwbHk7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB2c1dvcmtlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBzZXE6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVzOiBhbnksXG5cdFx0cHVibGljIHJlYWRvbmx5IGVycjogYW55XG5cdCkgeyB9XG59XG5jbGFzcyBTdWJzY3JpYmVFdmVudE1lc3NhZ2Uge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IE1lc3NhZ2VUeXBlLlN1YnNjcmliZUV2ZW50O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdnNXb3JrZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNoYW5uZWw6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZXZlbnROYW1lOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGFyZzogYW55XG5cdCkgeyB9XG59XG5jbGFzcyBFdmVudE1lc3NhZ2Uge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IE1lc3NhZ2VUeXBlLkV2ZW50O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdnNXb3JrZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGV2ZW50OiBhbnlcblx0KSB7IH1cbn1cbmNsYXNzIFVuc3Vic2NyaWJlRXZlbnRNZXNzYWdlIHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBNZXNzYWdlVHlwZS5VbnN1YnNjcmliZUV2ZW50O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdnNXb3JrZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxOiBzdHJpbmdcblx0KSB7IH1cbn1cbmV4cG9ydCB0eXBlIE1lc3NhZ2UgPSBSZXF1ZXN0TWVzc2FnZSB8IFJlcGx5TWVzc2FnZSB8IFN1YnNjcmliZUV2ZW50TWVzc2FnZSB8IEV2ZW50TWVzc2FnZSB8IFVuc3Vic2NyaWJlRXZlbnRNZXNzYWdlO1xuXG5pbnRlcmZhY2UgSU1lc3NhZ2VSZXBseSB7XG5cdHJlc29sdmU6ICh2YWx1ZT86IGFueSkgPT4gdm9pZDtcblx0cmVqZWN0OiAoZXJyb3I/OiBhbnkpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJTWVzc2FnZUhhbmRsZXIge1xuXHRzZW5kTWVzc2FnZShtc2c6IGFueSwgdHJhbnNmZXI/OiBBcnJheUJ1ZmZlcltdKTogdm9pZDtcblx0aGFuZGxlTWVzc2FnZShjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55Pjtcblx0aGFuZGxlRXZlbnQoY2hhbm5lbDogc3RyaW5nLCBldmVudE5hbWU6IHN0cmluZywgYXJnOiBhbnkpOiBFdmVudDxhbnk+O1xufVxuXG5jbGFzcyBXZWJXb3JrZXJQcm90b2NvbCB7XG5cblx0cHJpdmF0ZSBfd29ya2VySWQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfbGFzdFNlbnRSZXE6IG51bWJlcjtcblx0cHJpdmF0ZSBfcGVuZGluZ1JlcGxpZXM6IHsgW3JlcTogc3RyaW5nXTogSU1lc3NhZ2VSZXBseSB9O1xuXHRwcml2YXRlIF9wZW5kaW5nRW1pdHRlcnM6IE1hcDxzdHJpbmcsIEVtaXR0ZXI8YW55Pj47XG5cdHByaXZhdGUgX3BlbmRpbmdFdmVudHM6IE1hcDxzdHJpbmcsIElEaXNwb3NhYmxlPjtcblx0cHJpdmF0ZSBfaGFuZGxlcjogSU1lc3NhZ2VIYW5kbGVyO1xuXG5cdGNvbnN0cnVjdG9yKGhhbmRsZXI6IElNZXNzYWdlSGFuZGxlcikge1xuXHRcdHRoaXMuX3dvcmtlcklkID0gLTE7XG5cdFx0dGhpcy5faGFuZGxlciA9IGhhbmRsZXI7XG5cdFx0dGhpcy5fbGFzdFNlbnRSZXEgPSAwO1xuXHRcdHRoaXMuX3BlbmRpbmdSZXBsaWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl9wZW5kaW5nRW1pdHRlcnMgPSBuZXcgTWFwPHN0cmluZywgRW1pdHRlcjxhbnk+PigpO1xuXHRcdHRoaXMuX3BlbmRpbmdFdmVudHMgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0V29ya2VySWQod29ya2VySWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3dvcmtlcklkID0gd29ya2VySWQ7XG5cdH1cblxuXHRwdWJsaWMgc2VuZE1lc3NhZ2UoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgYXJnczogYW55W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHJlcSA9IFN0cmluZygrK3RoaXMuX2xhc3RTZW50UmVxKTtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLl9wZW5kaW5nUmVwbGllc1tyZXFdID0ge1xuXHRcdFx0XHRyZXNvbHZlOiByZXNvbHZlLFxuXHRcdFx0XHRyZWplY3Q6IHJlamVjdFxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3NlbmQobmV3IFJlcXVlc3RNZXNzYWdlKHRoaXMuX3dvcmtlcklkLCByZXEsIGNoYW5uZWwsIG1ldGhvZCwgYXJncykpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGxpc3RlbihjaGFubmVsOiBzdHJpbmcsIGV2ZW50TmFtZTogc3RyaW5nLCBhcmc6IGFueSk6IEV2ZW50PGFueT4ge1xuXHRcdGxldCByZXE6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxhbnk+KHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0cmVxID0gU3RyaW5nKCsrdGhpcy5fbGFzdFNlbnRSZXEpO1xuXHRcdFx0XHR0aGlzLl9wZW5kaW5nRW1pdHRlcnMuc2V0KHJlcSwgZW1pdHRlcik7XG5cdFx0XHRcdHRoaXMuX3NlbmQobmV3IFN1YnNjcmliZUV2ZW50TWVzc2FnZSh0aGlzLl93b3JrZXJJZCwgcmVxLCBjaGFubmVsLCBldmVudE5hbWUsIGFyZykpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3BlbmRpbmdFbWl0dGVycy5kZWxldGUocmVxISk7XG5cdFx0XHRcdHRoaXMuX3NlbmQobmV3IFVuc3Vic2NyaWJlRXZlbnRNZXNzYWdlKHRoaXMuX3dvcmtlcklkLCByZXEhKSk7XG5cdFx0XHRcdHJlcSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGVtaXR0ZXIuZXZlbnQ7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlKTogdm9pZCB7XG5cdFx0aWYgKCFtZXNzYWdlIHx8ICFtZXNzYWdlLnZzV29ya2VyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl93b3JrZXJJZCAhPT0gLTEgJiYgbWVzc2FnZS52c1dvcmtlciAhPT0gdGhpcy5fd29ya2VySWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faGFuZGxlTWVzc2FnZShtZXNzYWdlKTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVQcm94eVRvUmVtb3RlQ2hhbm5lbDxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBzdHJpbmcsIHNlbmRNZXNzYWdlQmFycmllcj86ICgpID0+IFByb21pc2U8dm9pZD4pOiBUIHtcblx0XHRjb25zdCBoYW5kbGVyID0ge1xuXHRcdFx0Z2V0OiAodGFyZ2V0OiBhbnksIG5hbWU6IFByb3BlcnR5S2V5KSA9PiB7XG5cdFx0XHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycgJiYgIXRhcmdldFtuYW1lXSkge1xuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eUlzRHluYW1pY0V2ZW50KG5hbWUpKSB7IC8vIG9uRHluYW1pYy4uLlxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gKGFyZzogYW55KTogRXZlbnQ8YW55PiA9PiB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmxpc3RlbihjaGFubmVsLCBuYW1lLCBhcmcpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHByb3BlcnR5SXNFdmVudChuYW1lKSkgeyAvLyBvbi4uLlxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gdGhpcy5saXN0ZW4oY2hhbm5lbCwgbmFtZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKG5hbWUuY2hhckNvZGVBdCgwKSA9PT0gQ2hhckNvZGUuRG9sbGFyU2lnbikgeyAvLyAkLi4uXG5cdFx0XHRcdFx0XHR0YXJnZXRbbmFtZV0gPSBhc3luYyAoLi4ubXlBcmdzOiBhbnlbXSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBzZW5kTWVzc2FnZUJhcnJpZXI/LigpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZW5kTWVzc2FnZShjaGFubmVsLCBuYW1lLCBteUFyZ3MpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRhcmdldFtuYW1lXTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBuZXcgUHJveHkoT2JqZWN0LmNyZWF0ZShudWxsKSwgaGFuZGxlcik7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVNZXNzYWdlKG1zZzogTWVzc2FnZSk6IHZvaWQge1xuXHRcdHN3aXRjaCAobXNnLnR5cGUpIHtcblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuUmVwbHk6XG5cdFx0XHRcdHJldHVybiB0aGlzLl9oYW5kbGVSZXBseU1lc3NhZ2UobXNnKTtcblx0XHRcdGNhc2UgTWVzc2FnZVR5cGUuUmVxdWVzdDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2hhbmRsZVJlcXVlc3RNZXNzYWdlKG1zZyk7XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLlN1YnNjcmliZUV2ZW50OlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlU3Vic2NyaWJlRXZlbnRNZXNzYWdlKG1zZyk7XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLkV2ZW50OlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlRXZlbnRNZXNzYWdlKG1zZyk7XG5cdFx0XHRjYXNlIE1lc3NhZ2VUeXBlLlVuc3Vic2NyaWJlRXZlbnQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLl9oYW5kbGVVbnN1YnNjcmliZUV2ZW50TWVzc2FnZShtc2cpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVJlcGx5TWVzc2FnZShyZXBseU1lc3NhZ2U6IFJlcGx5TWVzc2FnZSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fcGVuZGluZ1JlcGxpZXNbcmVwbHlNZXNzYWdlLnNlcV0pIHtcblx0XHRcdGNvbnNvbGUud2FybignR290IHJlcGx5IHRvIHVua25vd24gc2VxJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVwbHkgPSB0aGlzLl9wZW5kaW5nUmVwbGllc1tyZXBseU1lc3NhZ2Uuc2VxXTtcblx0XHRkZWxldGUgdGhpcy5fcGVuZGluZ1JlcGxpZXNbcmVwbHlNZXNzYWdlLnNlcV07XG5cblx0XHRpZiAocmVwbHlNZXNzYWdlLmVycikge1xuXHRcdFx0bGV0IGVyciA9IHJlcGx5TWVzc2FnZS5lcnI7XG5cdFx0XHRpZiAocmVwbHlNZXNzYWdlLmVyci4kaXNFcnJvcikge1xuXHRcdFx0XHRlcnIgPSBuZXcgRXJyb3IoKTtcblx0XHRcdFx0ZXJyLm5hbWUgPSByZXBseU1lc3NhZ2UuZXJyLm5hbWU7XG5cdFx0XHRcdGVyci5tZXNzYWdlID0gcmVwbHlNZXNzYWdlLmVyci5tZXNzYWdlO1xuXHRcdFx0XHRlcnIuc3RhY2sgPSByZXBseU1lc3NhZ2UuZXJyLnN0YWNrO1xuXHRcdFx0fVxuXHRcdFx0cmVwbHkucmVqZWN0KGVycik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVwbHkucmVzb2x2ZShyZXBseU1lc3NhZ2UucmVzKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVJlcXVlc3RNZXNzYWdlKHJlcXVlc3RNZXNzYWdlOiBSZXF1ZXN0TWVzc2FnZSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlcSA9IHJlcXVlc3RNZXNzYWdlLnJlcTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9oYW5kbGVyLmhhbmRsZU1lc3NhZ2UocmVxdWVzdE1lc3NhZ2UuY2hhbm5lbCwgcmVxdWVzdE1lc3NhZ2UubWV0aG9kLCByZXF1ZXN0TWVzc2FnZS5hcmdzKTtcblx0XHRyZXN1bHQudGhlbigocikgPT4ge1xuXHRcdFx0dGhpcy5fc2VuZChuZXcgUmVwbHlNZXNzYWdlKHRoaXMuX3dvcmtlcklkLCByZXEsIHIsIHVuZGVmaW5lZCkpO1xuXHRcdH0sIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5kZXRhaWwgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0XHQvLyBMb2FkaW5nIGVycm9ycyBoYXZlIGEgZGV0YWlsIHByb3BlcnR5IHRoYXQgcG9pbnRzIHRvIHRoZSBhY3R1YWwgZXJyb3Jcblx0XHRcdFx0ZS5kZXRhaWwgPSB0cmFuc2Zvcm1FcnJvckZvclNlcmlhbGl6YXRpb24oZS5kZXRhaWwpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc2VuZChuZXcgUmVwbHlNZXNzYWdlKHRoaXMuX3dvcmtlcklkLCByZXEsIHVuZGVmaW5lZCwgdHJhbnNmb3JtRXJyb3JGb3JTZXJpYWxpemF0aW9uKGUpKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVTdWJzY3JpYmVFdmVudE1lc3NhZ2UobXNnOiBTdWJzY3JpYmVFdmVudE1lc3NhZ2UpOiB2b2lkIHtcblx0XHRjb25zdCByZXEgPSBtc2cucmVxO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl9oYW5kbGVyLmhhbmRsZUV2ZW50KG1zZy5jaGFubmVsLCBtc2cuZXZlbnROYW1lLCBtc2cuYXJnKSgoZXZlbnQpID0+IHtcblx0XHRcdHRoaXMuX3NlbmQobmV3IEV2ZW50TWVzc2FnZSh0aGlzLl93b3JrZXJJZCwgcmVxLCBldmVudCkpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3BlbmRpbmdFdmVudHMuc2V0KHJlcSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVFdmVudE1lc3NhZ2UobXNnOiBFdmVudE1lc3NhZ2UpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3BlbmRpbmdFbWl0dGVycy5oYXMobXNnLnJlcSkpIHtcblx0XHRcdGNvbnNvbGUud2FybignR290IGV2ZW50IGZvciB1bmtub3duIHJlcScpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9wZW5kaW5nRW1pdHRlcnMuZ2V0KG1zZy5yZXEpIS5maXJlKG1zZy5ldmVudCk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVVbnN1YnNjcmliZUV2ZW50TWVzc2FnZShtc2c6IFVuc3Vic2NyaWJlRXZlbnRNZXNzYWdlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9wZW5kaW5nRXZlbnRzLmhhcyhtc2cucmVxKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdHb3QgdW5zdWJzY3JpYmUgZm9yIHVua25vd24gcmVxJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3BlbmRpbmdFdmVudHMuZ2V0KG1zZy5yZXEpIS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcGVuZGluZ0V2ZW50cy5kZWxldGUobXNnLnJlcSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kKG1zZzogTWVzc2FnZSk6IHZvaWQge1xuXHRcdGNvbnN0IHRyYW5zZmVyOiBBcnJheUJ1ZmZlcltdID0gW107XG5cdFx0aWYgKG1zZy50eXBlID09PSBNZXNzYWdlVHlwZS5SZXF1ZXN0KSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1zZy5hcmdzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChtc2cuYXJnc1tpXSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG5cdFx0XHRcdFx0dHJhbnNmZXIucHVzaChtc2cuYXJnc1tpXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKG1zZy50eXBlID09PSBNZXNzYWdlVHlwZS5SZXBseSkge1xuXHRcdFx0aWYgKG1zZy5yZXMgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuXHRcdFx0XHR0cmFuc2Zlci5wdXNoKG1zZy5yZXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9oYW5kbGVyLnNlbmRNZXNzYWdlKG1zZywgdHJhbnNmZXIpO1xuXHR9XG59XG5cbnR5cGUgUHJveGllZE1ldGhvZE5hbWUgPSAoYCQke3N0cmluZ31gIHwgYG9uJHtzdHJpbmd9YCk7XG5cbmV4cG9ydCB0eXBlIFByb3hpZWQ8VD4gPSB7IFtLIGluIGtleW9mIFRdOiBUW0tdIGV4dGVuZHMgKC4uLmFyZ3M6IGluZmVyIEEpID0+IGluZmVyIFJcblx0PyAoXG5cdFx0SyBleHRlbmRzIFByb3hpZWRNZXRob2ROYW1lXG5cdFx0PyAoLi4uYXJnczogQSkgPT4gUHJvbWlzZTxBd2FpdGVkPFI+PlxuXHRcdDogbmV2ZXJcblx0KVxuXHQ6IG5ldmVyXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIElXZWJXb3JrZXJDbGllbnQ8VFByb3h5PiB7XG5cdHByb3h5OiBQcm94aWVkPFRQcm94eT47XG5cdGRpc3Bvc2UoKTogdm9pZDtcblx0c2V0Q2hhbm5lbDxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBzdHJpbmcsIGhhbmRsZXI6IFQpOiB2b2lkO1xuXHRnZXRDaGFubmVsPFQgZXh0ZW5kcyBvYmplY3Q+KGNoYW5uZWw6IHN0cmluZyk6IFByb3hpZWQ8VD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdlYldvcmtlclNlcnZlciB7XG5cdHNldENoYW5uZWw8VCBleHRlbmRzIG9iamVjdD4oY2hhbm5lbDogc3RyaW5nLCBoYW5kbGVyOiBUKTogdm9pZDtcblx0Z2V0Q2hhbm5lbDxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBzdHJpbmcpOiBQcm94aWVkPFQ+O1xufVxuXG4vKipcbiAqIE1haW4gdGhyZWFkIHNpZGVcbiAqL1xuZXhwb3J0IGNsYXNzIFdlYldvcmtlckNsaWVudDxXIGV4dGVuZHMgb2JqZWN0PiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV2ViV29ya2VyQ2xpZW50PFc+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93b3JrZXI6IElXZWJXb3JrZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTW9kdWxlTG9hZGVkOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm90b2NvbDogV2ViV29ya2VyUHJvdG9jb2w7XG5cdHB1YmxpYyByZWFkb25seSBwcm94eTogUHJveGllZDxXPjtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9jYWxDaGFubmVsczogTWFwPHN0cmluZywgb2JqZWN0PiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQ2hhbm5lbHM6IE1hcDxzdHJpbmcsIG9iamVjdD4gPSBuZXcgTWFwKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0d29ya2VyOiBJV2ViV29ya2VyXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93b3JrZXIgPSB3b3JrZXI7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fd29ya2VyLm9uTWVzc2FnZSgobXNnKSA9PiB7XG5cdFx0XHR0aGlzLl9wcm90b2NvbC5oYW5kbGVNZXNzYWdlKG1zZyk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3dvcmtlci5vbkVycm9yKChlcnIpID0+IHtcblx0XHRcdGxvZ09uY2VXZWJXb3JrZXJXYXJuaW5nKGVycik7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3Byb3RvY29sID0gbmV3IFdlYldvcmtlclByb3RvY29sKHtcblx0XHRcdHNlbmRNZXNzYWdlOiAobXNnOiBhbnksIHRyYW5zZmVyOiBBcnJheUJ1ZmZlcltdKTogdm9pZCA9PiB7XG5cdFx0XHRcdHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShtc2csIHRyYW5zZmVyKTtcblx0XHRcdH0sXG5cdFx0XHRoYW5kbGVNZXNzYWdlOiAoY2hhbm5lbDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlTWVzc2FnZShjaGFubmVsLCBtZXRob2QsIGFyZ3MpO1xuXHRcdFx0fSxcblx0XHRcdGhhbmRsZUV2ZW50OiAoY2hhbm5lbDogc3RyaW5nLCBldmVudE5hbWU6IHN0cmluZywgYXJnOiBhbnkpOiBFdmVudDxhbnk+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2hhbmRsZUV2ZW50KGNoYW5uZWwsIGV2ZW50TmFtZSwgYXJnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9wcm90b2NvbC5zZXRXb3JrZXJJZCh0aGlzLl93b3JrZXIuZ2V0SWQoKSk7XG5cblx0XHQvLyBTZW5kIGluaXRpYWxpemUgbWVzc2FnZVxuXHRcdHRoaXMuX29uTW9kdWxlTG9hZGVkID0gdGhpcy5fcHJvdG9jb2wuc2VuZE1lc3NhZ2UoREVGQVVMVF9DSEFOTkVMLCBJTklUSUFMSVpFLCBbXG5cdFx0XHR0aGlzLl93b3JrZXIuZ2V0SWQoKSxcblx0XHRdKTtcblxuXHRcdHRoaXMucHJveHkgPSB0aGlzLl9wcm90b2NvbC5jcmVhdGVQcm94eVRvUmVtb3RlQ2hhbm5lbChERUZBVUxUX0NIQU5ORUwsIGFzeW5jICgpID0+IHsgYXdhaXQgdGhpcy5fb25Nb2R1bGVMb2FkZWQ7IH0pO1xuXHRcdHRoaXMuX29uTW9kdWxlTG9hZGVkLmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkVycm9yKCdXb3JrZXIgZmFpbGVkIHRvIGxvYWQgJywgZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVNZXNzYWdlKGNoYW5uZWxOYW1lOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgY2hhbm5lbDogb2JqZWN0IHwgdW5kZWZpbmVkID0gdGhpcy5fbG9jYWxDaGFubmVscy5nZXQoY2hhbm5lbE5hbWUpO1xuXHRcdGlmICghY2hhbm5lbCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgTWlzc2luZyBjaGFubmVsICR7Y2hhbm5lbE5hbWV9IG9uIG1haW4gdGhyZWFkYCkpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIChjaGFubmVsIGFzIGFueSlbbWV0aG9kXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgTWlzc2luZyBtZXRob2QgJHttZXRob2R9IG9uIG1haW4gdGhyZWFkIGNoYW5uZWwgJHtjaGFubmVsTmFtZX1gKSk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKGNoYW5uZWwgYXMgYW55KVttZXRob2RdLmFwcGx5KGNoYW5uZWwsIGFyZ3MpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlRXZlbnQoY2hhbm5lbE5hbWU6IHN0cmluZywgZXZlbnROYW1lOiBzdHJpbmcsIGFyZzogYW55KTogRXZlbnQ8YW55PiB7XG5cdFx0Y29uc3QgY2hhbm5lbDogb2JqZWN0IHwgdW5kZWZpbmVkID0gdGhpcy5fbG9jYWxDaGFubmVscy5nZXQoY2hhbm5lbE5hbWUpO1xuXHRcdGlmICghY2hhbm5lbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGNoYW5uZWwgJHtjaGFubmVsTmFtZX0gb24gbWFpbiB0aHJlYWRgKTtcblx0XHR9XG5cdFx0aWYgKHByb3BlcnR5SXNEeW5hbWljRXZlbnQoZXZlbnROYW1lKSkge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSAoY2hhbm5lbCBhcyBhbnkpW2V2ZW50TmFtZV0uY2FsbChjaGFubmVsLCBhcmcpO1xuXHRcdFx0aWYgKHR5cGVvZiBldmVudCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgZHluYW1pYyBldmVudCAke2V2ZW50TmFtZX0gb24gbWFpbiB0aHJlYWQgY2hhbm5lbCAke2NoYW5uZWxOYW1lfS5gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBldmVudDtcblx0XHR9XG5cdFx0aWYgKHByb3BlcnR5SXNFdmVudChldmVudE5hbWUpKSB7XG5cdFx0XHRjb25zdCBldmVudCA9IChjaGFubmVsIGFzIGFueSlbZXZlbnROYW1lXTtcblx0XHRcdGlmICh0eXBlb2YgZXZlbnQgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGV2ZW50ICR7ZXZlbnROYW1lfSBvbiBtYWluIHRocmVhZCBjaGFubmVsICR7Y2hhbm5lbE5hbWV9LmApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV2ZW50O1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoYE1hbGZvcm1lZCBldmVudCBuYW1lICR7ZXZlbnROYW1lfWApO1xuXHR9XG5cblx0cHVibGljIHNldENoYW5uZWw8VCBleHRlbmRzIG9iamVjdD4oY2hhbm5lbDogc3RyaW5nLCBoYW5kbGVyOiBUKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9jYWxDaGFubmVscy5zZXQoY2hhbm5lbCwgaGFuZGxlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q2hhbm5lbDxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBzdHJpbmcpOiBQcm94aWVkPFQ+IHtcblx0XHRpZiAoIXRoaXMuX3JlbW90ZUNoYW5uZWxzLmhhcyhjaGFubmVsKSkge1xuXHRcdFx0Y29uc3QgaW5zdCA9IHRoaXMuX3Byb3RvY29sLmNyZWF0ZVByb3h5VG9SZW1vdGVDaGFubmVsKGNoYW5uZWwsIGFzeW5jICgpID0+IHsgYXdhaXQgdGhpcy5fb25Nb2R1bGVMb2FkZWQ7IH0pO1xuXHRcdFx0dGhpcy5fcmVtb3RlQ2hhbm5lbHMuc2V0KGNoYW5uZWwsIGluc3QpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlQ2hhbm5lbHMuZ2V0KGNoYW5uZWwpIGFzIFByb3hpZWQ8VD47XG5cdH1cblxuXHRwcml2YXRlIF9vbkVycm9yKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBhbnkpOiB2b2lkIHtcblx0XHRjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuXHRcdGNvbnNvbGUuaW5mbyhlcnJvcik7XG5cdH1cbn1cblxuZnVuY3Rpb24gcHJvcGVydHlJc0V2ZW50KG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHQvLyBBc3N1bWUgYSBwcm9wZXJ0eSBpcyBhbiBldmVudCBpZiBpdCBoYXMgYSBmb3JtIG9mIFwib25Tb21ldGhpbmdcIlxuXHRyZXR1cm4gbmFtZVswXSA9PT0gJ28nICYmIG5hbWVbMV0gPT09ICduJyAmJiBzdHJpbmdzLmlzVXBwZXJBc2NpaUxldHRlcihuYW1lLmNoYXJDb2RlQXQoMikpO1xufVxuXG5mdW5jdGlvbiBwcm9wZXJ0eUlzRHluYW1pY0V2ZW50KG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHQvLyBBc3N1bWUgYSBwcm9wZXJ0eSBpcyBhIGR5bmFtaWMgZXZlbnQgKGEgbWV0aG9kIHRoYXQgcmV0dXJucyBhbiBldmVudCkgaWYgaXQgaGFzIGEgZm9ybSBvZiBcIm9uRHluYW1pY1NvbWV0aGluZ1wiXG5cdHJldHVybiAvXm9uRHluYW1pYy8udGVzdChuYW1lKSAmJiBzdHJpbmdzLmlzVXBwZXJBc2NpaUxldHRlcihuYW1lLmNoYXJDb2RlQXQoOSkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB7XG5cdF9yZXF1ZXN0SGFuZGxlckJyYW5kOiBhbnk7XG5cdFtwcm9wOiBzdHJpbmddOiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdlYldvcmtlclNlcnZlclJlcXVlc3RIYW5kbGVyRmFjdG9yeTxUIGV4dGVuZHMgSVdlYldvcmtlclNlcnZlclJlcXVlc3RIYW5kbGVyPiB7XG5cdCh3b3JrZXJTZXJ2ZXI6IElXZWJXb3JrZXJTZXJ2ZXIpOiBUO1xufVxuXG4vKipcbiAqIFdvcmtlciBzaWRlXG4gKi9cbmV4cG9ydCBjbGFzcyBXZWJXb3JrZXJTZXJ2ZXI8VCBleHRlbmRzIElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlcj4gaW1wbGVtZW50cyBJV2ViV29ya2VyU2VydmVyIHtcblxuXHRwdWJsaWMgcmVhZG9ubHkgcmVxdWVzdEhhbmRsZXI6IFQ7XG5cdHByaXZhdGUgX3Byb3RvY29sOiBXZWJXb3JrZXJQcm90b2NvbDtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9jYWxDaGFubmVsczogTWFwPHN0cmluZywgb2JqZWN0PiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQ2hhbm5lbHM6IE1hcDxzdHJpbmcsIG9iamVjdD4gPSBuZXcgTWFwKCk7XG5cblx0Y29uc3RydWN0b3IocG9zdE1lc3NhZ2U6IChtc2c6IE1lc3NhZ2UsIHRyYW5zZmVyPzogQXJyYXlCdWZmZXJbXSkgPT4gdm9pZCwgcmVxdWVzdEhhbmRsZXJGYWN0b3J5OiBJV2ViV29ya2VyU2VydmVyUmVxdWVzdEhhbmRsZXJGYWN0b3J5PFQ+KSB7XG5cdFx0dGhpcy5fcHJvdG9jb2wgPSBuZXcgV2ViV29ya2VyUHJvdG9jb2woe1xuXHRcdFx0c2VuZE1lc3NhZ2U6IChtc2c6IGFueSwgdHJhbnNmZXI6IEFycmF5QnVmZmVyW10pOiB2b2lkID0+IHtcblx0XHRcdFx0cG9zdE1lc3NhZ2UobXNnLCB0cmFuc2Zlcik7XG5cdFx0XHR9LFxuXHRcdFx0aGFuZGxlTWVzc2FnZTogKGNoYW5uZWw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHRoaXMuX2hhbmRsZU1lc3NhZ2UoY2hhbm5lbCwgbWV0aG9kLCBhcmdzKSxcblx0XHRcdGhhbmRsZUV2ZW50OiAoY2hhbm5lbDogc3RyaW5nLCBldmVudE5hbWU6IHN0cmluZywgYXJnOiBhbnkpOiBFdmVudDxhbnk+ID0+IHRoaXMuX2hhbmRsZUV2ZW50KGNoYW5uZWwsIGV2ZW50TmFtZSwgYXJnKVxuXHRcdH0pO1xuXHRcdHRoaXMucmVxdWVzdEhhbmRsZXIgPSByZXF1ZXN0SGFuZGxlckZhY3RvcnkodGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgb25tZXNzYWdlKG1zZzogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5fcHJvdG9jb2wuaGFuZGxlTWVzc2FnZShtc2cpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlTWVzc2FnZShjaGFubmVsOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKGNoYW5uZWwgPT09IERFRkFVTFRfQ0hBTk5FTCAmJiBtZXRob2QgPT09IElOSVRJQUxJWkUpIHtcblx0XHRcdHJldHVybiB0aGlzLmluaXRpYWxpemUoPG51bWJlcj5hcmdzWzBdKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXF1ZXN0SGFuZGxlcjogb2JqZWN0IHwgbnVsbCB8IHVuZGVmaW5lZCA9IChjaGFubmVsID09PSBERUZBVUxUX0NIQU5ORUwgPyB0aGlzLnJlcXVlc3RIYW5kbGVyIDogdGhpcy5fbG9jYWxDaGFubmVscy5nZXQoY2hhbm5lbCkpO1xuXHRcdGlmICghcmVxdWVzdEhhbmRsZXIpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoYE1pc3NpbmcgY2hhbm5lbCAke2NoYW5uZWx9IG9uIHdvcmtlciB0aHJlYWRgKSk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgKHJlcXVlc3RIYW5kbGVyIGFzIGFueSlbbWV0aG9kXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgTWlzc2luZyBtZXRob2QgJHttZXRob2R9IG9uIHdvcmtlciB0aHJlYWQgY2hhbm5lbCAke2NoYW5uZWx9YCkpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKChyZXF1ZXN0SGFuZGxlciBhcyBhbnkpW21ldGhvZF0uYXBwbHkocmVxdWVzdEhhbmRsZXIsIGFyZ3MpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlRXZlbnQoY2hhbm5lbDogc3RyaW5nLCBldmVudE5hbWU6IHN0cmluZywgYXJnOiBhbnkpOiBFdmVudDxhbnk+IHtcblx0XHRjb25zdCByZXF1ZXN0SGFuZGxlcjogb2JqZWN0IHwgbnVsbCB8IHVuZGVmaW5lZCA9IChjaGFubmVsID09PSBERUZBVUxUX0NIQU5ORUwgPyB0aGlzLnJlcXVlc3RIYW5kbGVyIDogdGhpcy5fbG9jYWxDaGFubmVscy5nZXQoY2hhbm5lbCkpO1xuXHRcdGlmICghcmVxdWVzdEhhbmRsZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBjaGFubmVsICR7Y2hhbm5lbH0gb24gd29ya2VyIHRocmVhZGApO1xuXHRcdH1cblx0XHRpZiAocHJvcGVydHlJc0R5bmFtaWNFdmVudChldmVudE5hbWUpKSB7XG5cdFx0XHRjb25zdCBldmVudCA9IChyZXF1ZXN0SGFuZGxlciBhcyBhbnkpW2V2ZW50TmFtZV0uY2FsbChyZXF1ZXN0SGFuZGxlciwgYXJnKTtcblx0XHRcdGlmICh0eXBlb2YgZXZlbnQgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGR5bmFtaWMgZXZlbnQgJHtldmVudE5hbWV9IG9uIHJlcXVlc3QgaGFuZGxlci5gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBldmVudDtcblx0XHR9XG5cdFx0aWYgKHByb3BlcnR5SXNFdmVudChldmVudE5hbWUpKSB7XG5cdFx0XHRjb25zdCBldmVudCA9IChyZXF1ZXN0SGFuZGxlciBhcyBhbnkpW2V2ZW50TmFtZV07XG5cdFx0XHRpZiAodHlwZW9mIGV2ZW50ICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBldmVudCAke2V2ZW50TmFtZX0gb24gcmVxdWVzdCBoYW5kbGVyLmApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV2ZW50O1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoYE1hbGZvcm1lZCBldmVudCBuYW1lICR7ZXZlbnROYW1lfWApO1xuXHR9XG5cblx0cHVibGljIHNldENoYW5uZWw8VCBleHRlbmRzIG9iamVjdD4oY2hhbm5lbDogc3RyaW5nLCBoYW5kbGVyOiBUKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9jYWxDaGFubmVscy5zZXQoY2hhbm5lbCwgaGFuZGxlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q2hhbm5lbDxUIGV4dGVuZHMgb2JqZWN0PihjaGFubmVsOiBzdHJpbmcpOiBQcm94aWVkPFQ+IHtcblx0XHRpZiAoIXRoaXMuX3JlbW90ZUNoYW5uZWxzLmhhcyhjaGFubmVsKSkge1xuXHRcdFx0Y29uc3QgaW5zdCA9IHRoaXMuX3Byb3RvY29sLmNyZWF0ZVByb3h5VG9SZW1vdGVDaGFubmVsKGNoYW5uZWwpO1xuXHRcdFx0dGhpcy5fcmVtb3RlQ2hhbm5lbHMuc2V0KGNoYW5uZWwsIGluc3QpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlQ2hhbm5lbHMuZ2V0KGNoYW5uZWwpIGFzIFByb3hpZWQ8VD47XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemUod29ya2VySWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3Byb3RvY29sLnNldFdvcmtlcklkKHdvcmtlcklkKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxtQkFBbUIsc0NBQXNDO0FBQ2xFLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxhQUFhO0FBQ3RCLFlBQVksYUFBYTtBQUV6QixNQUFNLGtCQUFrQjtBQUN4QixNQUFNLGFBQWE7QUFTbkIsSUFBSSx5QkFBeUI7QUFDdEIsU0FBUyx3QkFBd0IsS0FBZ0I7QUFDdkQsTUFBSSxDQUFDLE9BQU87QUFFWDtBQUFBLEVBQ0Q7QUFDQSxNQUFJLENBQUMsd0JBQXdCO0FBQzVCLDZCQUF5QjtBQUN6QixZQUFRLEtBQUssaUxBQWlMO0FBQUEsRUFDL0w7QUFDQSxVQUFRLEtBQUssSUFBSSxPQUFPO0FBQ3pCO0FBRUEsSUFBVyxjQUFYLGtCQUFXQSxpQkFBWDtBQUNDLEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFDQSxFQUFBQSwwQkFBQTtBQUNBLEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFMVSxTQUFBQTtBQUFBLEdBQUE7QUFPWCxNQUFNLGVBQWU7QUFBQSxFQUVwQixZQUNpQixVQUNBLEtBQ0EsU0FDQSxRQUNBLE1BQ2Y7QUFMZTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTmpCLFNBQWdCLE9BQU87QUFBQSxFQU9uQjtBQUNMO0FBQ0EsTUFBTSxhQUFhO0FBQUEsRUFFbEIsWUFDaUIsVUFDQSxLQUNBLEtBQ0EsS0FDZjtBQUplO0FBQ0E7QUFDQTtBQUNBO0FBTGpCLFNBQWdCLE9BQU87QUFBQSxFQU1uQjtBQUNMO0FBQ0EsTUFBTSxzQkFBc0I7QUFBQSxFQUUzQixZQUNpQixVQUNBLEtBQ0EsU0FDQSxXQUNBLEtBQ2Y7QUFMZTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTmpCLFNBQWdCLE9BQU87QUFBQSxFQU9uQjtBQUNMO0FBQ0EsTUFBTSxhQUFhO0FBQUEsRUFFbEIsWUFDaUIsVUFD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
