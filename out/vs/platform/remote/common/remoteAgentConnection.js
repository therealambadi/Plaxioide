import { createCancelablePromise, promiseWithResolvers } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { isCancellationError, onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { RemoteAuthorities } from "../../../base/common/network.js";
import * as performance from "../../../base/common/performance.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { Client, PersistentProtocol, SocketCloseEventType } from "../../../base/parts/ipc/common/ipc.net.js";
import { RemoteAuthorityResolverError } from "./remoteAuthorityResolver.js";
const RECONNECT_TIMEOUT = 30 * 1e3;
var ConnectionType = /* @__PURE__ */ ((ConnectionType2) => {
  ConnectionType2[ConnectionType2["Management"] = 1] = "Management";
  ConnectionType2[ConnectionType2["ExtensionHost"] = 2] = "ExtensionHost";
  ConnectionType2[ConnectionType2["Tunnel"] = 3] = "Tunnel";
  return ConnectionType2;
})(ConnectionType || {});
function connectionTypeToString(connectionType) {
  switch (connectionType) {
    case 1 /* Management */:
      return "Management";
    case 2 /* ExtensionHost */:
      return "ExtensionHost";
    case 3 /* Tunnel */:
      return "Tunnel";
  }
}
function createTimeoutCancellation(millis) {
  const source = new CancellationTokenSource();
  setTimeout(() => source.cancel(), millis);
  return source.token;
}
function combineTimeoutCancellation(a, b) {
  if (a.isCancellationRequested || b.isCancellationRequested) {
    return CancellationToken.Cancelled;
  }
  const source = new CancellationTokenSource();
  a.onCancellationRequested(() => source.cancel());
  b.onCancellationRequested(() => source.cancel());
  return source.token;
}
class PromiseWithTimeout {
  get didTimeout() {
    return this._state === "timedout";
  }
  constructor(timeoutCancellationToken) {
    this._state = "pending";
    this._disposables = new DisposableStore();
    ({ promise: this.promise, resolve: this._resolvePromise, reject: this._rejectPromise } = promiseWithResolvers());
    if (timeoutCancellationToken.isCancellationRequested) {
      this._timeout();
    } else {
      this._disposables.add(timeoutCancellationToken.onCancellationRequested(() => this._timeout()));
    }
  }
  registerDisposable(disposable) {
    if (this._state === "pending") {
      this._disposables.add(disposable);
    } else {
      disposable.dispose();
    }
  }
  _timeout() {
    if (this._state !== "pending") {
      return;
    }
    this._disposables.dispose();
    this._state = "timedout";
    this._rejectPromise(this._createTimeoutError());
  }
  _createTimeoutError() {
    const err = new Error("Time limit reached");
    err.code = "ETIMEDOUT";
    err.syscall = "connect";
    return err;
  }
  resolve(value) {
    if (this._state !== "pending") {
      return;
    }
    this._disposables.dispose();
    this._state = "resolved";
    this._resolvePromise(value);
  }
  reject(err) {
    if (this._state !== "pending") {
      return;
    }
    this._disposables.dispose();
    this._state = "rejected";
    this._rejectPromise(err);
  }
}
function readOneControlMessage(protocol, timeoutCancellationToken) {
  const result = new PromiseWithTimeout(timeoutCancellationToken);
  result.registerDisposable(protocol.onControlMessage((raw) => {
    const msg = JSON.parse(raw.toString());
    const error = getErrorFromMessage(msg);
    if (error) {
      result.reject(error);
    } else {
      result.resolve(msg);
    }
  }));
  return result.promise;
}
function createSocket(logService, remoteSocketFactoryService, connectTo, path, query, debugConnectionType, debugLabel, timeoutCancellationToken) {
  const result = new PromiseWithTimeout(timeoutCancellationToken);
  const sw = StopWatch.create(false);
  logService.info(`Creating a socket (${debugLabel})...`);
  performance.mark(`code/willCreateSocket/${debugConnectionType}`);
  remoteSocketFactoryService.connect(connectTo, path, query, debugLabel).then((socket) => {
    if (result.didTimeout) {
      performance.mark(`code/didCreateSocketError/${debugConnectionType}`);
      logService.info(`Creating a socket (${debugLabel}) finished after ${sw.elapsed()} ms, but this is too late and has timed out already.`);
      socket?.dispose();
    } else {
      performance.mark(`code/didCreateSocketOK/${debugConnectionType}`);
      logService.info(`Creating a socket (${debugLabel}) was successful after ${sw.elapsed()} ms.`);
      result.resolve(socket);
    }
  }, (err) => {
    performance.mark(`code/didCreateSocketError/${debugConnectionType}`);
    logService.info(`Creating a socket (${debugLabel}) returned an error after ${sw.elapsed()} ms.`);
    logService.error(err);
    result.reject(err);
  });
  return result.promise;
}
function raceWithTimeoutCancellation(promise, timeoutCancellationToken) {
  const result = new PromiseWithTimeout(timeoutCancellationToken);
  promise.then(
    (res) => {
      if (!result.didTimeout) {
        result.resolve(res);
      }
    },
    (err) => {
      if (!result.didTimeout) {
        result.reject(err);
      }
    }
  );
  return result.promise;
}
async function connectToRemoteExtensionHostAgent(options, connectionType, args, timeoutCancellationToken) {
  const logPrefix = connectLogPrefix(options, connectionType);
  options.logService.trace(`${logPrefix} 1/6. invoking socketFactory.connect().`);
  let socket;
  try {
    socket = await createSocket(options.logService, options.remoteSocketFactoryService, options.connectTo, RemoteAuthorities.getServerRootPath(), `reconnectionToken=${options.reconnectionToken}&reconnection=${options.reconnectionProtocol ? "true" : "false"}`, connectionTypeToString(connectionType), `renderer-${connectionTypeToString(connectionType)}-${options.reconnectionToken}`, timeoutCancellationToken);
  } catch (error) {
    options.logService.error(`${logPrefix} socketFactory.connect() failed or timed out. Error:`);
    options.logService.error(error);
    throw error;
  }
  options.logService.trace(`${logPrefix} 2/6. socketFactory.connect() was successful.`);
  let protocol;
  let ownsProtocol;
  if (options.reconnectionProtocol) {
    options.reconnectionProtocol.beginAcceptReconnection(socket, null);
    protocol = options.reconnectionProtocol;
    ownsProtocol = false;
  } else {
    protocol = new PersistentProtocol({ socket });
    ownsProtocol = true;
  }
  options.logService.trace(`${logPrefix} 3/6. sending AuthRequest control message.`);
  const message = await raceWithTimeoutCancellation(options.signService.createNewMessage(generateUuid()), timeoutCancellationToken);
  const authRequest = {
    type: "auth",
    auth: options.connectionToken || "00000000000000000000",
    data: message.data
  };
  protocol.sendControl(VSBuffer.fromString(JSON.stringify(authRequest)));
  try {
    const msg = await readOneControlMessage(protocol, combineTimeoutCancellation(timeoutCancellationToken, createTimeoutCancellation(1e4)));
    if (msg.type !== "sign" || typeof msg.data !== "string") {
      const error = new Error("Unexpected handshake message");
      error.code = "VSCODE_CONNECTION_ERROR";
      throw error;
    }
    options.logService.trace(`${logPrefix} 4/6. received SignRequest control message.`);
    const isValid = await raceWithTimeoutCancellation(options.signService.validate(message, msg.signedData), timeoutCancellationToken);
    if (!isValid) {
      const error = new Error("Refused to connect to unsupported server");
      error.code = "VSCODE_CONNECTION_ERROR";
      throw error;
    }
    const signed = await raceWithTimeoutCancellation(options.signService.sign(msg.data), timeoutCancellationToken);
    const connTypeRequest = {
      type: "connectionType",
      commit: options.commit,
      signedData: signed,
      desiredConnectionType: connectionType
    };
    if (args) {
      connTypeRequest.args = args;
    }
    options.logService.trace(`${logPrefix} 5/6. sending ConnectionTypeRequest control message.`);
    protocol.sendControl(VSBuffer.fromString(JSON.stringify(connTypeRequest)));
    return { protocol, ownsProtocol };
  } catch (error) {
    if (error && error.code === "ETIMEDOUT") {
      options.logService.error(`${logPrefix} the handshake timed out. Error:`);
      options.logService.error(error);
    }
    if (error && error.code === "VSCODE_CONNECTION_ERROR") {
      options.logService.error(`${logPrefix} received error control message when negotiating connection. Error:`);
      options.logService.error(error);
    }
    if (ownsProtocol) {
      safeDisposeProtocolAndSocket(protocol);
    }
    throw error;
  }
}
async function connectToRemoteExtensionHostAgentAndReadOneMessage(options, connectionType, args, timeoutCancellationToken) {
  const startTime = Date.now();
  const logPrefix = connectLogPrefix(options, connectionType);
  const { protocol, ownsProtocol } = await connectToRemoteExtensionHostAgent(options, connectionType, args, timeoutCancellationToken);
  const result = new PromiseWithTimeout(timeoutCancellationToken);
  result.registerDisposable(protocol.onControlMessage((raw) => {
    const msg = JSON.parse(raw.toString());
    const error = getErrorFromMessage(msg);
    if (error) {
      options.logService.error(`${logPrefix} received error control message when negotiating connection. Error:`);
      options.logService.error(error);
      if (ownsProtocol) {
        safeDisposeProtocolAndSocket(protocol);
      }
      result.reject(error);
    } else {
      options.reconnectionProtocol?.endAcceptReconnection();
      options.logService.trace(`${logPrefix} 6/6. handshake finished, connection is up and running after ${logElapsed(startTime)}!`);
      result.resolve({ protocol, firstMessage: msg });
    }
  }));
  return result.promise;
}
async function doConnectRemoteAgentManagement(options, timeoutCancellationToken) {
  const { protocol } = await connectToRemoteExtensionHostAgentAndReadOneMessage(options, 1 /* Management */, void 0, timeoutCancellationToken);
  return { protocol };
}
async function doConnectRemoteAgentExtensionHost(options, startArguments, timeoutCancellationToken) {
  const { protocol, firstMessage } = await connectToRemoteExtensionHostAgentAndReadOneMessage(options, 2 /* ExtensionHost */, startArguments, timeoutCancellationToken);
  const debugPort = firstMessage && firstMessage.debugPort;
  return { protocol, debugPort };
}
async function doConnectRemoteAgentTunnel(options, startParams, timeoutCancellationToken) {
  const startTime = Date.now();
  const logPrefix = connectLogPrefix(options, 3 /* Tunnel */);
  const { protocol } = await connectToRemoteExtensionHostAgent(options, 3 /* Tunnel */, startParams, timeoutCancellationToken);
  options.logService.trace(`${logPrefix} 6/6. handshake finished, connection is up and running after ${logElapsed(startTime)}!`);
  return protocol;
}
async function resolveConnectionOptions(options, reconnectionToken, reconnectionProtocol) {
  const { connectTo, connectionToken } = await options.addressProvider.getAddress();
  return {
    commit: options.commit,
    quality: options.quality,
    connectTo,
    connectionToken,
    reconnectionToken,
    reconnectionProtocol,
    remoteSocketFactoryService: options.remoteSocketFactoryService,
    signService: options.signService,
    logService: options.logService
  };
}
async function connectRemoteAgentManagement(options, remoteAuthority, clientId) {
  return createInitialConnection(
    options,
    async (simpleOptions) => {
      const { protocol } = await doConnectRemoteAgentManagement(simpleOptions, CancellationToken.None);
      return new ManagementPersistentConnection(options, remoteAuthority, clientId, simpleOptions.reconnectionToken, protocol);
    }
  );
}
async function connectRemoteAgentExtensionHost(options, startArguments) {
  return createInitialConnection(
    options,
    async (simpleOptions) => {
      const { protocol, debugPort } = await doConnectRemoteAgentExtensionHost(simpleOptions, startArguments, CancellationToken.None);
      return new ExtensionHostPersistentConnection(options, startArguments, simpleOptions.reconnectionToken, protocol, debugPort);
    }
  );
}
async function createInitialConnection(options, connectionFactory) {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      const reconnectionToken = generateUuid();
      const simpleOptions = await resolveConnectionOptions(options, reconnectionToken, null);
      const result = await connectionFactory(simpleOptions);
      return result;
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        options.logService.error(`[remote-connection][attempt ${attempt}] An error occurred in initial connection! Will retry... Error:`);
        options.logService.error(err);
      } else {
        options.logService.error(`[remote-connection][attempt ${attempt}]  An error occurred in initial connection! It will be treated as a permanent error. Error:`);
        options.logService.error(err);
        PersistentConnection.triggerPermanentFailure(0, 0, RemoteAuthorityResolverError.isHandled(err));
        throw err;
      }
    }
  }
}
async function connectRemoteAgentTunnel(options, tunnelRemoteHost, tunnelRemotePort) {
  const simpleOptions = await resolveConnectionOptions(options, generateUuid(), null);
  const protocol = await doConnectRemoteAgentTunnel(simpleOptions, { host: tunnelRemoteHost, port: tunnelRemotePort }, CancellationToken.None);
  return protocol;
}
function sleep(seconds) {
  return createCancelablePromise((token) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, seconds * 1e3);
      token.onCancellationRequested(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  });
}
var PersistentConnectionEventType = /* @__PURE__ */ ((PersistentConnectionEventType2) => {
  PersistentConnectionEventType2[PersistentConnectionEventType2["ConnectionLost"] = 0] = "ConnectionLost";
  PersistentConnectionEventType2[PersistentConnectionEventType2["ReconnectionWait"] = 1] = "ReconnectionWait";
  PersistentConnectionEventType2[PersistentConnectionEventType2["ReconnectionRunning"] = 2] = "ReconnectionRunning";
  PersistentConnectionEventType2[PersistentConnectionEventType2["ReconnectionPermanentFailure"] = 3] = "ReconnectionPermanentFailure";
  PersistentConnectionEventType2[PersistentConnectionEventType2["ConnectionGain"] = 4] = "ConnectionGain";
  return PersistentConnectionEventType2;
})(PersistentConnectionEventType || {});
class ConnectionLostEvent {
  constructor(reconnectionToken, millisSinceLastIncomingData) {
    this.reconnectionToken = reconnectionToken;
    this.millisSinceLastIncomingData = millisSinceLastIncomingData;
    this.type = 0 /* ConnectionLost */;
  }
}
class ReconnectionWaitEvent {
  constructor(reconnectionToken, millisSinceLastIncomingData, durationSeconds, cancellableTimer) {
    this.reconnectionToken = reconnectionToken;
    this.millisSinceLastIncomingData = millisSinceLastIncomingData;
    this.durationSeconds = durationSeconds;
    this.cancellableTimer = cancellableTimer;
    this.type = 1 /* ReconnectionWait */;
  }
  skipWait() {
    this.cancellableTimer.cancel();
  }
}
class ReconnectionRunningEvent {
  constructor(reconnectionToken, millisSinceLastIncomingData, attempt) {
    this.reconnectionToken = reconnectionToken;
    this.millisSinceLastIncomingData = millisSinceLastIncomingData;
    this.attempt = attempt;
    this.type = 2 /* ReconnectionRunning */;
  }
}
class ConnectionGainEvent {
  constructor(reconnectionToken, millisSinceLastIncomingData, attempt) {
    this.reconnectionToken = reconnectionToken;
    this.millisSinceLastIncomingData = millisSinceLastIncomingData;
    this.attempt = attempt;
    this.type = 4 /* ConnectionGain */;
  }
}
class ReconnectionPermanentFailureEvent {
  constructor(reconnectionToken, millisSinceLastIncomingData, attempt, handled) {
    this.reconnectionToken = reconnectionToken;
    this.millisSinceLastIncomingData = millisSinceLastIncomingData;
    this.attempt = attempt;
    this.handled = handled;
    this.type = 3 /* ReconnectionPermanentFailure */;
  }
}
const _PersistentConnection = class _PersistentConnection extends Disposable {
  constructor(_connectionType, _options, reconnectionToken, protocol, _reconnectionFailureIsFatal) {
    super();
    this._connectionType = _connectionType;
    this._options = _options;
    this.reconnectionToken = reconnectionToken;
    this.protocol = protocol;
    this._reconnectionFailureIsFatal = _reconnectionFailureIsFatal;
    this._onDidStateChange = this._register(new Emitter());
    this.onDidStateChange = this._onDidStateChange.event;
    this._permanentFailure = false;
    this._isReconnecting = false;
    this._isDisposed = false;
    this._onDidStateChange.fire(new ConnectionGainEvent(this.reconnectionToken, 0, 0));
    this._register(protocol.onSocketClose((e) => {
      const logPrefix = commonLogPrefix(this._connectionType, this.reconnectionToken, true);
      if (!e) {
        this._options.logService.info(`${logPrefix} received socket close event.`);
      } else if (e.type === SocketCloseEventType.NodeSocketCloseEvent) {
        this._options.logService.info(`${logPrefix} received socket close event (hadError: ${e.hadError}).`);
        if (e.error) {
          this._options.logService.error(e.error);
        }
      } else {
        this._options.logService.info(`${logPrefix} received socket close event (wasClean: ${e.wasClean}, code: ${e.code}, reason: ${e.reason}).`);
        if (e.event) {
          this._options.logService.error(e.event);
        }
      }
      this._beginReconnecting();
    }));
    this._register(protocol.onSocketTimeout((e) => {
      const logPrefix = commonLogPrefix(this._connectionType, this.reconnectionToken, true);
      this._options.logService.info(`${logPrefix} received socket timeout event (unacknowledgedMsgCount: ${e.unacknowledgedMsgCount}, timeSinceOldestUnacknowledgedMsg: ${e.timeSinceOldestUnacknowledgedMsg}, timeSinceLastReceivedSomeData: ${e.timeSinceLastReceivedSomeData}).`);
      this._beginReconnecting();
    }));
    _PersistentConnection._instances.push(this);
    this._register(toDisposable(() => {
      const myIndex = _PersistentConnection._instances.indexOf(this);
      if (myIndex >= 0) {
        _PersistentConnection._instances.splice(myIndex, 1);
      }
    }));
    if (this._isPermanentFailure) {
      this._gotoPermanentFailure(_PersistentConnection._permanentFailureMillisSinceLastIncomingData, _PersistentConnection._permanentFailureAttempt, _PersistentConnection._permanentFailureHandled);
    }
  }
  static triggerPermanentFailure(millisSinceLastIncomingData, attempt, handled) {
    this._permanentFailure = true;
    this._permanentFailureMillisSinceLastIncomingData = millisSinceLastIncomingData;
    this._permanentFailureAttempt = attempt;
    this._permanentFailureHandled = handled;
    this._instances.forEach((instance) => instance._gotoPermanentFailure(this._permanentFailureMillisSinceLastIncomingData, this._permanentFailureAttempt, this._permanentFailureHandled));
  }
  static debugTriggerReconnection() {
    this._instances.forEach((instance) => instance._beginReconnecting());
  }
  static debugPauseSocketWriting() {
    this._instances.forEach((instance) => instance._pauseSocketWriting());
  }
  get _isPermanentFailure() {
    return this._permanentFailure || _PersistentConnection._permanentFailure;
  }
  dispose() {
    super.dispose();
    this._isDisposed = true;
  }
  async _beginReconnecting() {
    if (this._isReconnecting) {
      return;
    }
    try {
      this._isReconnecting = true;
      await this._runReconnectingLoop();
    } finally {
      this._isReconnecting = false;
    }
  }
  async _runReconnectingLoop() {
    if (this._isPermanentFailure || this._isDisposed) {
      return;
    }
    const logPrefix = commonLogPrefix(this._connectionType, this.reconnectionToken, true);
    this._options.logService.info(`${logPrefix} starting reconnecting loop. You can get more information with the trace log level.`);
    this._onDidStateChange.fire(new ConnectionLostEvent(this.reconnectionToken, this.protocol.getMillisSinceLastIncomingData()));
    const TIMES = [0, 5, 5, 10, 10, 10, 10, 10, 30];
    let attempt = -1;
    do {
      attempt++;
      const waitTime = attempt < TIMES.length ? TIMES[attempt] : TIMES[TIMES.length - 1];
      try {
        if (waitTime > 0) {
          const sleepPromise = sleep(waitTime);
          this._onDidStateChange.fire(new ReconnectionWaitEvent(this.reconnectionToken, this.protocol.getMillisSinceLastIncomingData(), waitTime, sleepPromise));
          this._options.logService.info(`${logPrefix} waiting for ${waitTime} seconds before reconnecting...`);
          try {
            await sleepPromise;
          } catch {
          }
        }
        if (this._isPermanentFailure) {
          this._options.logService.error(`${logPrefix} permanent failure occurred while running the reconnecting loop.`);
          break;
        }
        this._onDidStateChange.fire(new ReconnectionRunningEvent(this.reconnectionToken, this.protocol.getMillisSinceLastIncomingData(), attempt + 1));
        this._options.logService.info(`${logPrefix} resolving connection...`);
        const simpleOptions = await resolveConnectionOptions(this._options, this.reconnectionToken, this.protocol);
        this._options.logService.info(`${logPrefix} connecting to ${simpleOptions.connectTo}...`);
        await this._reconnect(simpleOptions, createTimeoutCancellation(RECONNECT_TIMEOUT));
        this._options.logService.info(`${logPrefix} reconnected!`);
        this._onDidStateChange.fire(new ConnectionGainEvent(this.reconnectionToken, this.protocol.getMillisSinceLastIncomingData(), attempt + 1));
        break;
      } catch (err) {
        if (err.code === "VSCODE_CONNECTION_ERROR") {
          this._options.logService.error(`${logPrefix} A permanent error occurred in the reconnecting loop! Will give up now! Error:`);
          this._options.logService.error(err);
          this._onReconnectionPermanentFailure(this.protocol.getMillisSinceLastIncomingData(), attempt + 1, false);
          break;
        }
        if (attempt > 360) {
          this._options.logService.error(`${logPrefix} An error occurred while reconnecting, but it will be treated as a permanent error because the reconnection grace time has expired! Will give up now! Error:`);
          this._options.logService.error(err);
          this._onReconnectionPermanentFailure(this.protocol.getMillisSinceLastIncomingData(), attempt + 1, false);
          break;
        }
        if (RemoteAuthorityResolverError.isTemporarilyNotAvailable(err)) {
          this._options.logService.info(`${logPrefix} A temporarily not available error occurred while trying to reconnect, will try again...`);
          this._options.logService.trace(err);
          continue;
        }
        if ((err.code === "ETIMEDOUT" || err.code === "ENETUNREACH" || err.code === "ECONNREFUSED" || err.code === "ECONNRESET") && err.syscall === "connect") {
          this._options.logService.info(`${logPrefix} A network error occurred while trying to reconnect, will try again...`);
          this._options.logService.trace(err);
          continue;
        }
        if (isCancellationError(err)) {
          this._options.logService.info(`${logPrefix} A promise cancelation error occurred while trying to reconnect, will try again...`);
          this._options.logService.trace(err);
          continue;
        }
        if (err instanceof RemoteAuthorityResolverError) {
          this._options.logService.error(`${logPrefix} A RemoteAuthorityResolverError occurred while trying to reconnect. Will give up now! Error:`);
          this._options.logService.error(err);
          this._onReconnectionPermanentFailure(this.protocol.getMillisSinceLastIncomingData(), attempt + 1, RemoteAuthorityResolverError.isHandled(err));
          break;
        }
        this._options.logService.error(`${logPrefix} An unknown error occurred while trying to reconnect, since this is an unknown case, it will be treated as a permanent error! Will give up now! Error:`);
        this._options.logService.error(err);
        this._onReconnectionPermanentFailure(this.protocol.getMillisSinceLastIncomingData(), attempt + 1, false);
        break;
      }
    } while (!this._isPermanentFailure && !this._isDisposed);
  }
  _onReconnectionPermanentFailure(millisSinceLastIncomingData, attempt, handled) {
    if (this._reconnectionFailureIsFatal) {
      _PersistentConnection.triggerPermanentFailure(millisSinceLastIncomingData, attempt, handled);
    } else {
      this._gotoPermanentFailure(millisSinceLastIncomingData, attempt, handled);
    }
  }
  _gotoPermanentFailure(millisSinceLastIncomingData, attempt, handled) {
    this._onDidStateChange.fire(new ReconnectionPermanentFailureEvent(this.reconnectionToken, millisSinceLastIncomingData, attempt, handled));
    safeDisposeProtocolAndSocket(this.protocol);
  }
  _pauseSocketWriting() {
    this.protocol.pauseSocketWriting();
  }
};
_PersistentConnection._permanentFailure = false;
_PersistentConnection._permanentFailureMillisSinceLastIncomingData = 0;
_PersistentConnection._permanentFailureAttempt = 0;
_PersistentConnection._permanentFailureHandled = false;
_PersistentConnection._instances = [];
let PersistentConnection = _PersistentConnection;
class ManagementPersistentConnection extends PersistentConnection {
  constructor(options, remoteAuthority, clientId, reconnectionToken, protocol) {
    super(
      1 /* Management */,
      options,
      reconnectionToken,
      protocol,
      /*reconnectionFailureIsFatal*/
      true
    );
    this.client = this._register(new Client(protocol, {
      remoteAuthority,
      clientId
    }, options.ipcLogger));
  }
  async _reconnect(options, timeoutCancellationToken) {
    await doConnectRemoteAgentManagement(options, timeoutCancellationToken);
  }
}
class ExtensionHostPersistentConnection extends PersistentConnection {
  constructor(options, startArguments, reconnectionToken, protocol, debugPort) {
    super(
      2 /* ExtensionHost */,
      options,
      reconnectionToken,
      protocol,
      /*reconnectionFailureIsFatal*/
      false
    );
    this._startArguments = startArguments;
    this.debugPort = debugPort;
  }
  async _reconnect(options, timeoutCancellationToken) {
    await doConnectRemoteAgentExtensionHost(options, this._startArguments, timeoutCancellationToken);
  }
}
function safeDisposeProtocolAndSocket(protocol) {
  try {
    protocol.acceptDisconnect();
    const socket = protocol.getSocket();
    protocol.dispose();
    socket.dispose();
  } catch (err) {
    onUnexpectedError(err);
  }
}
function getErrorFromMessage(msg) {
  if (msg && msg.type === "error") {
    const error = new Error(`Connection error: ${msg.reason}`);
    error.code = "VSCODE_CONNECTION_ERROR";
    return error;
  }
  return null;
}
function stringRightPad(str, len) {
  while (str.length < len) {
    str += " ";
  }
  return str;
}
function _commonLogPrefix(connectionType, reconnectionToken) {
  return `[remote-connection][${stringRightPad(connectionTypeToString(connectionType), 13)}][${reconnectionToken.substr(0, 5)}\u2026]`;
}
function commonLogPrefix(connectionType, reconnectionToken, isReconnect) {
  return `${_commonLogPrefix(connectionType, reconnectionToken)}[${isReconnect ? "reconnect" : "initial"}]`;
}
function connectLogPrefix(options, connectionType) {
  return `${commonLogPrefix(connectionType, options.reconnectionToken, !!options.reconnectionProtocol)}[${options.connectTo}]`;
}
function logElapsed(startTime) {
  return `${Date.now() - startTime} ms`;
}
export {
  ConnectionGainEvent,
  ConnectionLostEvent,
  ConnectionType,
  ExtensionHostPersistentConnection,
  ManagementPersistentConnection,
  PersistentConnection,
  PersistentConnectionEventType,
  ReconnectionPermanentFailureEvent,
  ReconnectionRunningEvent,
  ReconnectionWaitEvent,
  connectRemoteAgentExtensionHost,
  connectRemoteAgentManagement,
  connectRemoteAgentTunnel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50Q29ubmVjdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgcHJvbWlzZVdpdGhSZXNvbHZlcnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZW1vdGVBdXRob3JpdGllcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0ICogYXMgcGVyZm9ybWFuY2UgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUlQQ0xvZ2dlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMuanMnO1xuaW1wb3J0IHsgQ2xpZW50LCBJU29ja2V0LCBQZXJzaXN0ZW50UHJvdG9jb2wsIFNvY2tldENsb3NlRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBSZW1vdGVBZ2VudENvbm5lY3Rpb25Db250ZXh0IH0gZnJvbSAnLi9yZW1vdGVBZ2VudEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IsIFJlbW90ZUNvbm5lY3Rpb24gfSBmcm9tICcuL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IElSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSB9IGZyb20gJy4vcmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNpZ25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2lnbi9jb21tb24vc2lnbi5qcyc7XG5cbmNvbnN0IFJFQ09OTkVDVF9USU1FT1VUID0gMzAgKiAxMDAwIC8qIDMwcyAqLztcblxuZXhwb3J0IGNvbnN0IGVudW0gQ29ubmVjdGlvblR5cGUge1xuXHRNYW5hZ2VtZW50ID0gMSxcblx0RXh0ZW5zaW9uSG9zdCA9IDIsXG5cdFR1bm5lbCA9IDMsXG59XG5cbmZ1bmN0aW9uIGNvbm5lY3Rpb25UeXBlVG9TdHJpbmcoY29ubmVjdGlvblR5cGU6IENvbm5lY3Rpb25UeXBlKTogc3RyaW5nIHtcblx0c3dpdGNoIChjb25uZWN0aW9uVHlwZSkge1xuXHRcdGNhc2UgQ29ubmVjdGlvblR5cGUuTWFuYWdlbWVudDpcblx0XHRcdHJldHVybiAnTWFuYWdlbWVudCc7XG5cdFx0Y2FzZSBDb25uZWN0aW9uVHlwZS5FeHRlbnNpb25Ib3N0OlxuXHRcdFx0cmV0dXJuICdFeHRlbnNpb25Ib3N0Jztcblx0XHRjYXNlIENvbm5lY3Rpb25UeXBlLlR1bm5lbDpcblx0XHRcdHJldHVybiAnVHVubmVsJztcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhSZXF1ZXN0IHtcblx0dHlwZTogJ2F1dGgnO1xuXHRhdXRoOiBzdHJpbmc7XG5cdGRhdGE6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTaWduUmVxdWVzdCB7XG5cdHR5cGU6ICdzaWduJztcblx0ZGF0YTogc3RyaW5nO1xuXHRzaWduZWREYXRhOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubmVjdGlvblR5cGVSZXF1ZXN0IHtcblx0dHlwZTogJ2Nvbm5lY3Rpb25UeXBlJztcblx0Y29tbWl0Pzogc3RyaW5nO1xuXHRzaWduZWREYXRhOiBzdHJpbmc7XG5cdGRlc2lyZWRDb25uZWN0aW9uVHlwZT86IENvbm5lY3Rpb25UeXBlO1xuXHRhcmdzPzogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVycm9yTWVzc2FnZSB7XG5cdHR5cGU6ICdlcnJvcic7XG5cdHJlYXNvbjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9LTWVzc2FnZSB7XG5cdHR5cGU6ICdvayc7XG59XG5cbmV4cG9ydCB0eXBlIEhhbmRzaGFrZU1lc3NhZ2UgPSBBdXRoUmVxdWVzdCB8IFNpZ25SZXF1ZXN0IHwgQ29ubmVjdGlvblR5cGVSZXF1ZXN0IHwgRXJyb3JNZXNzYWdlIHwgT0tNZXNzYWdlO1xuXG5cbmludGVyZmFjZSBJU2ltcGxlQ29ubmVjdGlvbk9wdGlvbnM8VCBleHRlbmRzIFJlbW90ZUNvbm5lY3Rpb24gPSBSZW1vdGVDb25uZWN0aW9uPiB7XG5cdGNvbW1pdDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRxdWFsaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGNvbm5lY3RUbzogVDtcblx0Y29ubmVjdGlvblRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmc7XG5cdHJlY29ubmVjdGlvblByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wgfCBudWxsO1xuXHRyZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZTogSVJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlO1xuXHRzaWduU2VydmljZTogSVNpZ25TZXJ2aWNlO1xuXHRsb2dTZXJ2aWNlOiBJTG9nU2VydmljZTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVGltZW91dENhbmNlbGxhdGlvbihtaWxsaXM6IG51bWJlcik6IENhbmNlbGxhdGlvblRva2VuIHtcblx0Y29uc3Qgc291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdHNldFRpbWVvdXQoKCkgPT4gc291cmNlLmNhbmNlbCgpLCBtaWxsaXMpO1xuXHRyZXR1cm4gc291cmNlLnRva2VuO1xufVxuXG5mdW5jdGlvbiBjb21iaW5lVGltZW91dENhbmNlbGxhdGlvbihhOiBDYW5jZWxsYXRpb25Ub2tlbiwgYjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBDYW5jZWxsYXRpb25Ub2tlbiB7XG5cdGlmIChhLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8IGIuaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRyZXR1cm4gQ2FuY2VsbGF0aW9uVG9rZW4uQ2FuY2VsbGVkO1xuXHR9XG5cdGNvbnN0IHNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRhLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHNvdXJjZS5jYW5jZWwoKSk7XG5cdGIub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gc291cmNlLmNhbmNlbCgpKTtcblx0cmV0dXJuIHNvdXJjZS50b2tlbjtcbn1cblxuY2xhc3MgUHJvbWlzZVdpdGhUaW1lb3V0PFQ+IHtcblxuXHRwcml2YXRlIF9zdGF0ZTogJ3BlbmRpbmcnIHwgJ3Jlc29sdmVkJyB8ICdyZWplY3RlZCcgfCAndGltZWRvdXQnO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRwdWJsaWMgcmVhZG9ubHkgcHJvbWlzZTogUHJvbWlzZTxUPjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZVByb21pc2U6ICh2YWx1ZTogVCkgPT4gdm9pZDtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVqZWN0UHJvbWlzZTogKGVycjogYW55KSA9PiB2b2lkO1xuXG5cdHB1YmxpYyBnZXQgZGlkVGltZW91dCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKHRoaXMuX3N0YXRlID09PSAndGltZWRvdXQnKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHR0aGlzLl9zdGF0ZSA9ICdwZW5kaW5nJztcblx0XHR0aGlzLl9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdCh7IHByb21pc2U6IHRoaXMucHJvbWlzZSwgcmVzb2x2ZTogdGhpcy5fcmVzb2x2ZVByb21pc2UsIHJlamVjdDogdGhpcy5fcmVqZWN0UHJvbWlzZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8VD4oKSk7XG5cblx0XHRpZiAodGltZW91dENhbmNlbGxhdGlvblRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHR0aGlzLl90aW1lb3V0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gdGhpcy5fdGltZW91dCgpKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyRGlzcG9zYWJsZShkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gJ3BlbmRpbmcnKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3RpbWVvdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSAncGVuZGluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0YXRlID0gJ3RpbWVkb3V0Jztcblx0XHR0aGlzLl9yZWplY3RQcm9taXNlKHRoaXMuX2NyZWF0ZVRpbWVvdXRFcnJvcigpKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVRpbWVvdXRFcnJvcigpOiBFcnJvciB7XG5cdFx0Y29uc3QgZXJyOiBhbnkgPSBuZXcgRXJyb3IoJ1RpbWUgbGltaXQgcmVhY2hlZCcpO1xuXHRcdGVyci5jb2RlID0gJ0VUSU1FRE9VVCc7XG5cdFx0ZXJyLnN5c2NhbGwgPSAnY29ubmVjdCc7XG5cdFx0cmV0dXJuIGVycjtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlKHZhbHVlOiBUKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSAncGVuZGluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0YXRlID0gJ3Jlc29sdmVkJztcblx0XHR0aGlzLl9yZXNvbHZlUHJvbWlzZSh2YWx1ZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVqZWN0KGVycjogYW55KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSAncGVuZGluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0YXRlID0gJ3JlamVjdGVkJztcblx0XHR0aGlzLl9yZWplY3RQcm9taXNlKGVycik7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVhZE9uZUNvbnRyb2xNZXNzYWdlPFQ+KHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFQ+IHtcblx0Y29uc3QgcmVzdWx0ID0gbmV3IFByb21pc2VXaXRoVGltZW91dDxUPih0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRyZXN1bHQucmVnaXN0ZXJEaXNwb3NhYmxlKHByb3RvY29sLm9uQ29udHJvbE1lc3NhZ2UocmF3ID0+IHtcblx0XHRjb25zdCBtc2c6IFQgPSBKU09OLnBhcnNlKHJhdy50b1N0cmluZygpKTtcblx0XHRjb25zdCBlcnJvciA9IGdldEVycm9yRnJvbU1lc3NhZ2UobXNnKTtcblx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdHJlc3VsdC5yZWplY3QoZXJyb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQucmVzb2x2ZShtc2cpO1xuXHRcdH1cblx0fSkpO1xuXHRyZXR1cm4gcmVzdWx0LnByb21pc2U7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNvY2tldDxUIGV4dGVuZHMgUmVtb3RlQ29ubmVjdGlvbj4obG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIHJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlOiBJUmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsIGNvbm5lY3RUbzogVCwgcGF0aDogc3RyaW5nLCBxdWVyeTogc3RyaW5nLCBkZWJ1Z0Nvbm5lY3Rpb25UeXBlOiBzdHJpbmcsIGRlYnVnTGFiZWw6IHN0cmluZywgdGltZW91dENhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNvY2tldD4ge1xuXHRjb25zdCByZXN1bHQgPSBuZXcgUHJvbWlzZVdpdGhUaW1lb3V0PElTb2NrZXQ+KHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdGNvbnN0IHN3ID0gU3RvcFdhdGNoLmNyZWF0ZShmYWxzZSk7XG5cdGxvZ1NlcnZpY2UuaW5mbyhgQ3JlYXRpbmcgYSBzb2NrZXQgKCR7ZGVidWdMYWJlbH0pLi4uYCk7XG5cdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvd2lsbENyZWF0ZVNvY2tldC8ke2RlYnVnQ29ubmVjdGlvblR5cGV9YCk7XG5cblx0cmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UuY29ubmVjdChjb25uZWN0VG8sIHBhdGgsIHF1ZXJ5LCBkZWJ1Z0xhYmVsKS50aGVuKChzb2NrZXQpID0+IHtcblx0XHRpZiAocmVzdWx0LmRpZFRpbWVvdXQpIHtcblx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZGlkQ3JlYXRlU29ja2V0RXJyb3IvJHtkZWJ1Z0Nvbm5lY3Rpb25UeXBlfWApO1xuXHRcdFx0bG9nU2VydmljZS5pbmZvKGBDcmVhdGluZyBhIHNvY2tldCAoJHtkZWJ1Z0xhYmVsfSkgZmluaXNoZWQgYWZ0ZXIgJHtzdy5lbGFwc2VkKCl9IG1zLCBidXQgdGhpcyBpcyB0b28gbGF0ZSBhbmQgaGFzIHRpbWVkIG91dCBhbHJlYWR5LmApO1xuXHRcdFx0c29ja2V0Py5kaXNwb3NlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZGlkQ3JlYXRlU29ja2V0T0svJHtkZWJ1Z0Nvbm5lY3Rpb25UeXBlfWApO1xuXHRcdFx0bG9nU2VydmljZS5pbmZvKGBDcmVhdGluZyBhIHNvY2tldCAoJHtkZWJ1Z0xhYmVsfSkgd2FzIHN1Y2Nlc3NmdWwgYWZ0ZXIgJHtzdy5lbGFwc2VkKCl9IG1zLmApO1xuXHRcdFx0cmVzdWx0LnJlc29sdmUoc29ja2V0KTtcblx0XHR9XG5cdH0sIChlcnIpID0+IHtcblx0XHRwZXJmb3JtYW5jZS5tYXJrKGBjb2RlL2RpZENyZWF0ZVNvY2tldEVycm9yLyR7ZGVidWdDb25uZWN0aW9uVHlwZX1gKTtcblx0XHRsb2dTZXJ2aWNlLmluZm8oYENyZWF0aW5nIGEgc29ja2V0ICgke2RlYnVnTGFiZWx9KSByZXR1cm5lZCBhbiBlcnJvciBhZnRlciAke3N3LmVsYXBzZWQoKX0gbXMuYCk7XG5cdFx0bG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdHJlc3VsdC5yZWplY3QoZXJyKTtcblx0fSk7XG5cblx0cmV0dXJuIHJlc3VsdC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiByYWNlV2l0aFRpbWVvdXRDYW5jZWxsYXRpb248VD4ocHJvbWlzZTogUHJvbWlzZTxUPiwgdGltZW91dENhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VD4ge1xuXHRjb25zdCByZXN1bHQgPSBuZXcgUHJvbWlzZVdpdGhUaW1lb3V0PFQ+KHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdHByb21pc2UudGhlbihcblx0XHQocmVzKSA9PiB7XG5cdFx0XHRpZiAoIXJlc3VsdC5kaWRUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc3VsdC5yZXNvbHZlKHJlcyk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHQoZXJyKSA9PiB7XG5cdFx0XHRpZiAoIXJlc3VsdC5kaWRUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc3VsdC5yZWplY3QoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cdCk7XG5cdHJldHVybiByZXN1bHQucHJvbWlzZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29ubmVjdFRvUmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50PFQgZXh0ZW5kcyBSZW1vdGVDb25uZWN0aW9uPihvcHRpb25zOiBJU2ltcGxlQ29ubmVjdGlvbk9wdGlvbnM8VD4sIGNvbm5lY3Rpb25UeXBlOiBDb25uZWN0aW9uVHlwZSwgYXJnczogYW55IHwgdW5kZWZpbmVkLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2w7IG93bnNQcm90b2NvbDogYm9vbGVhbiB9PiB7XG5cdGNvbnN0IGxvZ1ByZWZpeCA9IGNvbm5lY3RMb2dQcmVmaXgob3B0aW9ucywgY29ubmVjdGlvblR5cGUpO1xuXG5cdG9wdGlvbnMubG9nU2VydmljZS50cmFjZShgJHtsb2dQcmVmaXh9IDEvNi4gaW52b2tpbmcgc29ja2V0RmFjdG9yeS5jb25uZWN0KCkuYCk7XG5cblx0bGV0IHNvY2tldDogSVNvY2tldDtcblx0dHJ5IHtcblx0XHRzb2NrZXQgPSBhd2FpdCBjcmVhdGVTb2NrZXQob3B0aW9ucy5sb2dTZXJ2aWNlLCBvcHRpb25zLnJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlLCBvcHRpb25zLmNvbm5lY3RUbywgUmVtb3RlQXV0aG9yaXRpZXMuZ2V0U2VydmVyUm9vdFBhdGgoKSwgYHJlY29ubmVjdGlvblRva2VuPSR7b3B0aW9ucy5yZWNvbm5lY3Rpb25Ub2tlbn0mcmVjb25uZWN0aW9uPSR7b3B0aW9ucy5yZWNvbm5lY3Rpb25Qcm90b2NvbCA/ICd0cnVlJyA6ICdmYWxzZSd9YCwgY29ubmVjdGlvblR5cGVUb1N0cmluZyhjb25uZWN0aW9uVHlwZSksIGByZW5kZXJlci0ke2Nvbm5lY3Rpb25UeXBlVG9TdHJpbmcoY29ubmVjdGlvblR5cGUpfS0ke29wdGlvbnMucmVjb25uZWN0aW9uVG9rZW59YCwgdGltZW91dENhbmNlbGxhdGlvblRva2VuKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYCR7bG9nUHJlZml4fSBzb2NrZXRGYWN0b3J5LmNvbm5lY3QoKSBmYWlsZWQgb3IgdGltZWQgb3V0LiBFcnJvcjpgKTtcblx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdHRocm93IGVycm9yO1xuXHR9XG5cblx0b3B0aW9ucy5sb2dTZXJ2aWNlLnRyYWNlKGAke2xvZ1ByZWZpeH0gMi82LiBzb2NrZXRGYWN0b3J5LmNvbm5lY3QoKSB3YXMgc3VjY2Vzc2Z1bC5gKTtcblxuXHRsZXQgcHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbDtcblx0bGV0IG93bnNQcm90b2NvbDogYm9vbGVhbjtcblx0aWYgKG9wdGlvbnMucmVjb25uZWN0aW9uUHJvdG9jb2wpIHtcblx0XHRvcHRpb25zLnJlY29ubmVjdGlvblByb3RvY29sLmJlZ2luQWNjZXB0UmVjb25uZWN0aW9uKHNvY2tldCwgbnVsbCk7XG5cdFx0cHJvdG9jb2wgPSBvcHRpb25zLnJlY29ubmVjdGlvblByb3RvY29sO1xuXHRcdG93bnNQcm90b2NvbCA9IGZhbHNlO1xuXHR9IGVsc2Uge1xuXHRcdHByb3RvY29sID0gbmV3IFBlcnNpc3RlbnRQcm90b2NvbCh7IHNvY2tldCB9KTtcblx0XHRvd25zUHJvdG9jb2wgPSB0cnVlO1xuXHR9XG5cblx0b3B0aW9ucy5sb2dTZXJ2aWNlLnRyYWNlKGAke2xvZ1ByZWZpeH0gMy82LiBzZW5kaW5nIEF1dGhSZXF1ZXN0IGNvbnRyb2wgbWVzc2FnZS5gKTtcblx0Y29uc3QgbWVzc2FnZSA9IGF3YWl0IHJhY2VXaXRoVGltZW91dENhbmNlbGxhdGlvbihvcHRpb25zLnNpZ25TZXJ2aWNlLmNyZWF0ZU5ld01lc3NhZ2UoZ2VuZXJhdGVVdWlkKCkpLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW4pO1xuXG5cdGNvbnN0IGF1dGhSZXF1ZXN0OiBBdXRoUmVxdWVzdCA9IHtcblx0XHR0eXBlOiAnYXV0aCcsXG5cdFx0YXV0aDogb3B0aW9ucy5jb25uZWN0aW9uVG9rZW4gfHwgJzAwMDAwMDAwMDAwMDAwMDAwMDAwJyxcblx0XHRkYXRhOiBtZXNzYWdlLmRhdGFcblx0fTtcblx0cHJvdG9jb2wuc2VuZENvbnRyb2woVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShhdXRoUmVxdWVzdCkpKTtcblxuXHR0cnkge1xuXHRcdGNvbnN0IG1zZyA9IGF3YWl0IHJlYWRPbmVDb250cm9sTWVzc2FnZTxIYW5kc2hha2VNZXNzYWdlPihwcm90b2NvbCwgY29tYmluZVRpbWVvdXRDYW5jZWxsYXRpb24odGltZW91dENhbmNlbGxhdGlvblRva2VuLCBjcmVhdGVUaW1lb3V0Q2FuY2VsbGF0aW9uKDEwMDAwKSkpO1xuXG5cdFx0aWYgKG1zZy50eXBlICE9PSAnc2lnbicgfHwgdHlwZW9mIG1zZy5kYXRhICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgZXJyb3I6IGFueSA9IG5ldyBFcnJvcignVW5leHBlY3RlZCBoYW5kc2hha2UgbWVzc2FnZScpO1xuXHRcdFx0ZXJyb3IuY29kZSA9ICdWU0NPREVfQ09OTkVDVElPTl9FUlJPUic7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cblx0XHRvcHRpb25zLmxvZ1NlcnZpY2UudHJhY2UoYCR7bG9nUHJlZml4fSA0LzYuIHJlY2VpdmVkIFNpZ25SZXF1ZXN0IGNvbnRyb2wgbWVzc2FnZS5gKTtcblxuXHRcdGNvbnN0IGlzVmFsaWQgPSBhd2FpdCByYWNlV2l0aFRpbWVvdXRDYW5jZWxsYXRpb24ob3B0aW9ucy5zaWduU2VydmljZS52YWxpZGF0ZShtZXNzYWdlLCBtc2cuc2lnbmVkRGF0YSksIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdFx0aWYgKCFpc1ZhbGlkKSB7XG5cdFx0XHRjb25zdCBlcnJvcjogYW55ID0gbmV3IEVycm9yKCdSZWZ1c2VkIHRvIGNvbm5lY3QgdG8gdW5zdXBwb3J0ZWQgc2VydmVyJyk7XG5cdFx0XHRlcnJvci5jb2RlID0gJ1ZTQ09ERV9DT05ORUNUSU9OX0VSUk9SJztcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNpZ25lZCA9IGF3YWl0IHJhY2VXaXRoVGltZW91dENhbmNlbGxhdGlvbihvcHRpb25zLnNpZ25TZXJ2aWNlLnNpZ24obXNnLmRhdGEpLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdGNvbnN0IGNvbm5UeXBlUmVxdWVzdDogQ29ubmVjdGlvblR5cGVSZXF1ZXN0ID0ge1xuXHRcdFx0dHlwZTogJ2Nvbm5lY3Rpb25UeXBlJyxcblx0XHRcdGNvbW1pdDogb3B0aW9ucy5jb21taXQsXG5cdFx0XHRzaWduZWREYXRhOiBzaWduZWQsXG5cdFx0XHRkZXNpcmVkQ29ubmVjdGlvblR5cGU6IGNvbm5lY3Rpb25UeXBlXG5cdFx0fTtcblx0XHRpZiAoYXJncykge1xuXHRcdFx0Y29ublR5cGVSZXF1ZXN0LmFyZ3MgPSBhcmdzO1xuXHRcdH1cblxuXHRcdG9wdGlvbnMubG9nU2VydmljZS50cmFjZShgJHtsb2dQcmVmaXh9IDUvNi4gc2VuZGluZyBDb25uZWN0aW9uVHlwZVJlcXVlc3QgY29udHJvbCBtZXNzYWdlLmApO1xuXHRcdHByb3RvY29sLnNlbmRDb250cm9sKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoY29ublR5cGVSZXF1ZXN0KSkpO1xuXG5cdFx0cmV0dXJuIHsgcHJvdG9jb2wsIG93bnNQcm90b2NvbCB9O1xuXG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKGVycm9yICYmIGVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnKSB7XG5cdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYCR7bG9nUHJlZml4fSB0aGUgaGFuZHNoYWtlIHRpbWVkIG91dC4gRXJyb3I6YCk7XG5cdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0XHRpZiAoZXJyb3IgJiYgZXJyb3IuY29kZSA9PT0gJ1ZTQ09ERV9DT05ORUNUSU9OX0VSUk9SJykge1xuXHRcdFx0b3B0aW9ucy5sb2dTZXJ2aWNlLmVycm9yKGAke2xvZ1ByZWZpeH0gcmVjZWl2ZWQgZXJyb3IgY29udHJvbCBtZXNzYWdlIHdoZW4gbmVnb3RpYXRpbmcgY29ubmVjdGlvbi4gRXJyb3I6YCk7XG5cdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0XHRpZiAob3duc1Byb3RvY29sKSB7XG5cdFx0XHRzYWZlRGlzcG9zZVByb3RvY29sQW5kU29ja2V0KHByb3RvY29sKTtcblx0XHR9XG5cdFx0dGhyb3cgZXJyb3I7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElNYW5hZ2VtZW50Q29ubmVjdGlvblJlc3VsdCB7XG5cdHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2w7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RUb1JlbW90ZUV4dGVuc2lvbkhvc3RBZ2VudEFuZFJlYWRPbmVNZXNzYWdlPFQ+KG9wdGlvbnM6IElTaW1wbGVDb25uZWN0aW9uT3B0aW9ucywgY29ubmVjdGlvblR5cGU6IENvbm5lY3Rpb25UeXBlLCBhcmdzOiBhbnkgfCB1bmRlZmluZWQsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHsgcHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbDsgZmlyc3RNZXNzYWdlOiBUIH0+IHtcblx0Y29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblx0Y29uc3QgbG9nUHJlZml4ID0gY29ubmVjdExvZ1ByZWZpeChvcHRpb25zLCBjb25uZWN0aW9uVHlwZSk7XG5cdGNvbnN0IHsgcHJvdG9jb2wsIG93bnNQcm90b2NvbCB9ID0gYXdhaXQgY29ubmVjdFRvUmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50KG9wdGlvbnMsIGNvbm5lY3Rpb25UeXBlLCBhcmdzLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRjb25zdCByZXN1bHQgPSBuZXcgUHJvbWlzZVdpdGhUaW1lb3V0PHsgcHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbDsgZmlyc3RNZXNzYWdlOiBUIH0+KHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdHJlc3VsdC5yZWdpc3RlckRpc3Bvc2FibGUocHJvdG9jb2wub25Db250cm9sTWVzc2FnZShyYXcgPT4ge1xuXHRcdGNvbnN0IG1zZzogVCA9IEpTT04ucGFyc2UocmF3LnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IGVycm9yID0gZ2V0RXJyb3JGcm9tTWVzc2FnZShtc2cpO1xuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0b3B0aW9ucy5sb2dTZXJ2aWNlLmVycm9yKGAke2xvZ1ByZWZpeH0gcmVjZWl2ZWQgZXJyb3IgY29udHJvbCBtZXNzYWdlIHdoZW4gbmVnb3RpYXRpbmcgY29ubmVjdGlvbi4gRXJyb3I6YCk7XG5cdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0aWYgKG93bnNQcm90b2NvbCkge1xuXHRcdFx0XHRzYWZlRGlzcG9zZVByb3RvY29sQW5kU29ja2V0KHByb3RvY29sKTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdC5yZWplY3QoZXJyb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvcHRpb25zLnJlY29ubmVjdGlvblByb3RvY29sPy5lbmRBY2NlcHRSZWNvbm5lY3Rpb24oKTtcblx0XHRcdG9wdGlvbnMubG9nU2VydmljZS50cmFjZShgJHtsb2dQcmVmaXh9IDYvNi4gaGFuZHNoYWtlIGZpbmlzaGVkLCBjb25uZWN0aW9uIGlzIHVwIGFuZCBydW5uaW5nIGFmdGVyICR7bG9nRWxhcHNlZChzdGFydFRpbWUpfSFgKTtcblx0XHRcdHJlc3VsdC5yZXNvbHZlKHsgcHJvdG9jb2wsIGZpcnN0TWVzc2FnZTogbXNnIH0pO1xuXHRcdH1cblx0fSkpO1xuXHRyZXR1cm4gcmVzdWx0LnByb21pc2U7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvQ29ubmVjdFJlbW90ZUFnZW50TWFuYWdlbWVudChvcHRpb25zOiBJU2ltcGxlQ29ubmVjdGlvbk9wdGlvbnMsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElNYW5hZ2VtZW50Q29ubmVjdGlvblJlc3VsdD4ge1xuXHRjb25zdCB7IHByb3RvY29sIH0gPSBhd2FpdCBjb25uZWN0VG9SZW1vdGVFeHRlbnNpb25Ib3N0QWdlbnRBbmRSZWFkT25lTWVzc2FnZShvcHRpb25zLCBDb25uZWN0aW9uVHlwZS5NYW5hZ2VtZW50LCB1bmRlZmluZWQsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdHJldHVybiB7IHByb3RvY29sIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlbW90ZUV4dGVuc2lvbkhvc3RTdGFydFBhcmFtcyB7XG5cdGxhbmd1YWdlOiBzdHJpbmc7XG5cdGRlYnVnSWQ/OiBzdHJpbmc7XG5cdGJyZWFrPzogYm9vbGVhbjtcblx0cG9ydD86IG51bWJlciB8IG51bGw7XG5cdGVudj86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgbnVsbCB9O1xufVxuXG5pbnRlcmZhY2UgSUV4dGVuc2lvbkhvc3RDb25uZWN0aW9uUmVzdWx0IHtcblx0cHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbDtcblx0ZGVidWdQb3J0PzogbnVtYmVyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkb0Nvbm5lY3RSZW1vdGVBZ2VudEV4dGVuc2lvbkhvc3Qob3B0aW9uczogSVNpbXBsZUNvbm5lY3Rpb25PcHRpb25zLCBzdGFydEFyZ3VtZW50czogSVJlbW90ZUV4dGVuc2lvbkhvc3RTdGFydFBhcmFtcywgdGltZW91dENhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUV4dGVuc2lvbkhvc3RDb25uZWN0aW9uUmVzdWx0PiB7XG5cdGNvbnN0IHsgcHJvdG9jb2wsIGZpcnN0TWVzc2FnZSB9ID0gYXdhaXQgY29ubmVjdFRvUmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50QW5kUmVhZE9uZU1lc3NhZ2U8eyBkZWJ1Z1BvcnQ/OiBudW1iZXIgfT4ob3B0aW9ucywgQ29ubmVjdGlvblR5cGUuRXh0ZW5zaW9uSG9zdCwgc3RhcnRBcmd1bWVudHMsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdGNvbnN0IGRlYnVnUG9ydCA9IGZpcnN0TWVzc2FnZSAmJiBmaXJzdE1lc3NhZ2UuZGVidWdQb3J0O1xuXHRyZXR1cm4geyBwcm90b2NvbCwgZGVidWdQb3J0IH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVR1bm5lbENvbm5lY3Rpb25TdGFydFBhcmFtcyB7XG5cdGhvc3Q6IHN0cmluZztcblx0cG9ydDogbnVtYmVyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkb0Nvbm5lY3RSZW1vdGVBZ2VudFR1bm5lbChvcHRpb25zOiBJU2ltcGxlQ29ubmVjdGlvbk9wdGlvbnMsIHN0YXJ0UGFyYW1zOiBJVHVubmVsQ29ubmVjdGlvblN0YXJ0UGFyYW1zLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxQZXJzaXN0ZW50UHJvdG9jb2w+IHtcblx0Y29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblx0Y29uc3QgbG9nUHJlZml4ID0gY29ubmVjdExvZ1ByZWZpeChvcHRpb25zLCBDb25uZWN0aW9uVHlwZS5UdW5uZWwpO1xuXHRjb25zdCB7IHByb3RvY29sIH0gPSBhd2FpdCBjb25uZWN0VG9SZW1vdGVFeHRlbnNpb25Ib3N0QWdlbnQob3B0aW9ucywgQ29ubmVjdGlvblR5cGUuVHVubmVsLCBzdGFydFBhcmFtcywgdGltZW91dENhbmNlbGxhdGlvblRva2VuKTtcblx0b3B0aW9ucy5sb2dTZXJ2aWNlLnRyYWNlKGAke2xvZ1ByZWZpeH0gNi82LiBoYW5kc2hha2UgZmluaXNoZWQsIGNvbm5lY3Rpb24gaXMgdXAgYW5kIHJ1bm5pbmcgYWZ0ZXIgJHtsb2dFbGFwc2VkKHN0YXJ0VGltZSl9IWApO1xuXHRyZXR1cm4gcHJvdG9jb2w7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbm5lY3Rpb25PcHRpb25zPFQgZXh0ZW5kcyBSZW1vdGVDb25uZWN0aW9uID0gUmVtb3RlQ29ubmVjdGlvbj4ge1xuXHRjb21taXQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cXVhbGl0eTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRhZGRyZXNzUHJvdmlkZXI6IElBZGRyZXNzUHJvdmlkZXI8VD47XG5cdHJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlOiBJUmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2U7XG5cdHNpZ25TZXJ2aWNlOiBJU2lnblNlcnZpY2U7XG5cdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlO1xuXHRpcGNMb2dnZXI6IElJUENMb2dnZXIgfCBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlQ29ubmVjdGlvbk9wdGlvbnM8VCBleHRlbmRzIFJlbW90ZUNvbm5lY3Rpb24+KG9wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9uczxUPiwgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZywgcmVjb25uZWN0aW9uUHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbCB8IG51bGwpOiBQcm9taXNlPElTaW1wbGVDb25uZWN0aW9uT3B0aW9uczxUPj4ge1xuXHRjb25zdCB7IGNvbm5lY3RUbywgY29ubmVjdGlvblRva2VuIH0gPSBhd2FpdCBvcHRpb25zLmFkZHJlc3NQcm92aWRlci5nZXRBZGRyZXNzKCk7XG5cdHJldHVybiB7XG5cdFx0Y29tbWl0OiBvcHRpb25zLmNvbW1pdCxcblx0XHRxdWFsaXR5OiBvcHRpb25zLnF1YWxpdHksXG5cdFx0Y29ubmVjdFRvLFxuXHRcdGNvbm5lY3Rpb25Ub2tlbjogY29ubmVjdGlvblRva2VuLFxuXHRcdHJlY29ubmVjdGlvblRva2VuOiByZWNvbm5lY3Rpb25Ub2tlbixcblx0XHRyZWNvbm5lY3Rpb25Qcm90b2NvbDogcmVjb25uZWN0aW9uUHJvdG9jb2wsXG5cdFx0cmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2U6IG9wdGlvbnMucmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsXG5cdFx0c2lnblNlcnZpY2U6IG9wdGlvbnMuc2lnblNlcnZpY2UsXG5cdFx0bG9nU2VydmljZTogb3B0aW9ucy5sb2dTZXJ2aWNlXG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFkZHJlc3M8VCBleHRlbmRzIFJlbW90ZUNvbm5lY3Rpb24gPSBSZW1vdGVDb25uZWN0aW9uPiB7XG5cdGNvbm5lY3RUbzogVDtcblx0Y29ubmVjdGlvblRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFkZHJlc3NQcm92aWRlcjxUIGV4dGVuZHMgUmVtb3RlQ29ubmVjdGlvbiA9IFJlbW90ZUNvbm5lY3Rpb24+IHtcblx0Z2V0QWRkcmVzcygpOiBQcm9taXNlPElBZGRyZXNzPFQ+Pjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RSZW1vdGVBZ2VudE1hbmFnZW1lbnQob3B0aW9uczogSUNvbm5lY3Rpb25PcHRpb25zLCByZW1vdGVBdXRob3JpdHk6IHN0cmluZywgY2xpZW50SWQ6IHN0cmluZyk6IFByb21pc2U8TWFuYWdlbWVudFBlcnNpc3RlbnRDb25uZWN0aW9uPiB7XG5cdHJldHVybiBjcmVhdGVJbml0aWFsQ29ubmVjdGlvbihcblx0XHRvcHRpb25zLFxuXHRcdGFzeW5jIChzaW1wbGVPcHRpb25zKSA9PiB7XG5cdFx0XHRjb25zdCB7IHByb3RvY29sIH0gPSBhd2FpdCBkb0Nvbm5lY3RSZW1vdGVBZ2VudE1hbmFnZW1lbnQoc2ltcGxlT3B0aW9ucywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRyZXR1cm4gbmV3IE1hbmFnZW1lbnRQZXJzaXN0ZW50Q29ubmVjdGlvbihvcHRpb25zLCByZW1vdGVBdXRob3JpdHksIGNsaWVudElkLCBzaW1wbGVPcHRpb25zLnJlY29ubmVjdGlvblRva2VuLCBwcm90b2NvbCk7XG5cdFx0fVxuXHQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29ubmVjdFJlbW90ZUFnZW50RXh0ZW5zaW9uSG9zdChvcHRpb25zOiBJQ29ubmVjdGlvbk9wdGlvbnMsIHN0YXJ0QXJndW1lbnRzOiBJUmVtb3RlRXh0ZW5zaW9uSG9zdFN0YXJ0UGFyYW1zKTogUHJvbWlzZTxFeHRlbnNpb25Ib3N0UGVyc2lzdGVudENvbm5lY3Rpb24+IHtcblx0cmV0dXJuIGNyZWF0ZUluaXRpYWxDb25uZWN0aW9uKFxuXHRcdG9wdGlvbnMsXG5cdFx0YXN5bmMgKHNpbXBsZU9wdGlvbnMpID0+IHtcblx0XHRcdGNvbnN0IHsgcHJvdG9jb2wsIGRlYnVnUG9ydCB9ID0gYXdhaXQgZG9Db25uZWN0UmVtb3RlQWdlbnRFeHRlbnNpb25Ib3N0KHNpbXBsZU9wdGlvbnMsIHN0YXJ0QXJndW1lbnRzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdHJldHVybiBuZXcgRXh0ZW5zaW9uSG9zdFBlcnNpc3RlbnRDb25uZWN0aW9uKG9wdGlvbnMsIHN0YXJ0QXJndW1lbnRzLCBzaW1wbGVPcHRpb25zLnJlY29ubmVjdGlvblRva2VuLCBwcm90b2NvbCwgZGVidWdQb3J0KTtcblx0XHR9XG5cdCk7XG59XG5cbi8qKlxuICogV2lsbCBhdHRlbXB0IHRvIGNvbm5lY3QgNSB0aW1lcy4gSWYgaXQgZmFpbHMgNSBjb25zZWN1dGl2ZSB0aW1lcywgaXQgd2lsbCBnaXZlIHVwLlxuICovXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVJbml0aWFsQ29ubmVjdGlvbjxUIGV4dGVuZHMgUGVyc2lzdGVudENvbm5lY3Rpb24sIE8gZXh0ZW5kcyBSZW1vdGVDb25uZWN0aW9uPihvcHRpb25zOiBJQ29ubmVjdGlvbk9wdGlvbnM8Tz4sIGNvbm5lY3Rpb25GYWN0b3J5OiAoc2ltcGxlT3B0aW9uczogSVNpbXBsZUNvbm5lY3Rpb25PcHRpb25zPE8+KSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG5cdGNvbnN0IE1BWF9BVFRFTVBUUyA9IDU7XG5cblx0Zm9yIChsZXQgYXR0ZW1wdCA9IDE7IDsgYXR0ZW1wdCsrKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlY29ubmVjdGlvblRva2VuID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0XHRjb25zdCBzaW1wbGVPcHRpb25zID0gYXdhaXQgcmVzb2x2ZUNvbm5lY3Rpb25PcHRpb25zKG9wdGlvbnMsIHJlY29ubmVjdGlvblRva2VuLCBudWxsKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbm5lY3Rpb25GYWN0b3J5KHNpbXBsZU9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGlmIChhdHRlbXB0IDwgTUFYX0FUVEVNUFRTKSB7XG5cdFx0XHRcdG9wdGlvbnMubG9nU2VydmljZS5lcnJvcihgW3JlbW90ZS1jb25uZWN0aW9uXVthdHRlbXB0ICR7YXR0ZW1wdH1dIEFuIGVycm9yIG9jY3VycmVkIGluIGluaXRpYWwgY29ubmVjdGlvbiEgV2lsbCByZXRyeS4uLiBFcnJvcjpgKTtcblx0XHRcdFx0b3B0aW9ucy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYFtyZW1vdGUtY29ubmVjdGlvbl1bYXR0ZW1wdCAke2F0dGVtcHR9XSAgQW4gZXJyb3Igb2NjdXJyZWQgaW4gaW5pdGlhbCBjb25uZWN0aW9uISBJdCB3aWxsIGJlIHRyZWF0ZWQgYXMgYSBwZXJtYW5lbnQgZXJyb3IuIEVycm9yOmApO1xuXHRcdFx0XHRvcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdFx0UGVyc2lzdGVudENvbm5lY3Rpb24udHJpZ2dlclBlcm1hbmVudEZhaWx1cmUoMCwgMCwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvci5pc0hhbmRsZWQoZXJyKSk7XG5cdFx0XHRcdHRocm93IGVycjtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RSZW1vdGVBZ2VudFR1bm5lbChvcHRpb25zOiBJQ29ubmVjdGlvbk9wdGlvbnMsIHR1bm5lbFJlbW90ZUhvc3Q6IHN0cmluZywgdHVubmVsUmVtb3RlUG9ydDogbnVtYmVyKTogUHJvbWlzZTxQZXJzaXN0ZW50UHJvdG9jb2w+IHtcblx0Y29uc3Qgc2ltcGxlT3B0aW9ucyA9IGF3YWl0IHJlc29sdmVDb25uZWN0aW9uT3B0aW9ucyhvcHRpb25zLCBnZW5lcmF0ZVV1aWQoKSwgbnVsbCk7XG5cdGNvbnN0IHByb3RvY29sID0gYXdhaXQgZG9Db25uZWN0UmVtb3RlQWdlbnRUdW5uZWwoc2ltcGxlT3B0aW9ucywgeyBob3N0OiB0dW5uZWxSZW1vdGVIb3N0LCBwb3J0OiB0dW5uZWxSZW1vdGVQb3J0IH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRyZXR1cm4gcHJvdG9jb2w7XG59XG5cbmZ1bmN0aW9uIHNsZWVwKHNlY29uZHM6IG51bWJlcik6IENhbmNlbGFibGVQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgc2Vjb25kcyAqIDEwMDApO1xuXHRcdFx0dG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQodGltZW91dCk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gUGVyc2lzdGVudENvbm5lY3Rpb25FdmVudFR5cGUge1xuXHRDb25uZWN0aW9uTG9zdCxcblx0UmVjb25uZWN0aW9uV2FpdCxcblx0UmVjb25uZWN0aW9uUnVubmluZyxcblx0UmVjb25uZWN0aW9uUGVybWFuZW50RmFpbHVyZSxcblx0Q29ubmVjdGlvbkdhaW5cbn1cbmV4cG9ydCBjbGFzcyBDb25uZWN0aW9uTG9zdEV2ZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5Db25uZWN0aW9uTG9zdDtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogbnVtYmVyXG5cdCkgeyB9XG59XG5leHBvcnQgY2xhc3MgUmVjb25uZWN0aW9uV2FpdEV2ZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25XYWl0O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGR1cmF0aW9uU2Vjb25kczogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY2FuY2VsbGFibGVUaW1lcjogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD5cblx0KSB7IH1cblxuXHRwdWJsaWMgc2tpcFdhaXQoKTogdm9pZCB7XG5cdFx0dGhpcy5jYW5jZWxsYWJsZVRpbWVyLmNhbmNlbCgpO1xuXHR9XG59XG5leHBvcnQgY2xhc3MgUmVjb25uZWN0aW9uUnVubmluZ0V2ZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25SdW5uaW5nO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGF0dGVtcHQ6IG51bWJlclxuXHQpIHsgfVxufVxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb25HYWluRXZlbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlLkNvbm5lY3Rpb25HYWluO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGF0dGVtcHQ6IG51bWJlclxuXHQpIHsgfVxufVxuZXhwb3J0IGNsYXNzIFJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVFdmVudCB7XG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gUGVyc2lzdGVudENvbm5lY3Rpb25FdmVudFR5cGUuUmVjb25uZWN0aW9uUGVybWFuZW50RmFpbHVyZTtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBhdHRlbXB0OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGhhbmRsZWQ6IGJvb2xlYW5cblx0KSB7IH1cbn1cbmV4cG9ydCB0eXBlIFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnQgPSBDb25uZWN0aW9uR2FpbkV2ZW50IHwgQ29ubmVjdGlvbkxvc3RFdmVudCB8IFJlY29ubmVjdGlvbldhaXRFdmVudCB8IFJlY29ubmVjdGlvblJ1bm5pbmdFdmVudCB8IFJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVFdmVudDtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFBlcnNpc3RlbnRDb25uZWN0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHVibGljIHN0YXRpYyB0cmlnZ2VyUGVybWFuZW50RmFpbHVyZShtaWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGE6IG51bWJlciwgYXR0ZW1wdDogbnVtYmVyLCBoYW5kbGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fcGVybWFuZW50RmFpbHVyZSA9IHRydWU7XG5cdFx0dGhpcy5fcGVybWFuZW50RmFpbHVyZU1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSA9IG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTtcblx0XHR0aGlzLl9wZXJtYW5lbnRGYWlsdXJlQXR0ZW1wdCA9IGF0dGVtcHQ7XG5cdFx0dGhpcy5fcGVybWFuZW50RmFpbHVyZUhhbmRsZWQgPSBoYW5kbGVkO1xuXHRcdHRoaXMuX2luc3RhbmNlcy5mb3JFYWNoKGluc3RhbmNlID0+IGluc3RhbmNlLl9nb3RvUGVybWFuZW50RmFpbHVyZSh0aGlzLl9wZXJtYW5lbnRGYWlsdXJlTWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhLCB0aGlzLl9wZXJtYW5lbnRGYWlsdXJlQXR0ZW1wdCwgdGhpcy5fcGVybWFuZW50RmFpbHVyZUhhbmRsZWQpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVidWdUcmlnZ2VyUmVjb25uZWN0aW9uKCkge1xuXHRcdHRoaXMuX2luc3RhbmNlcy5mb3JFYWNoKGluc3RhbmNlID0+IGluc3RhbmNlLl9iZWdpblJlY29ubmVjdGluZygpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVidWdQYXVzZVNvY2tldFdyaXRpbmcoKSB7XG5cdFx0dGhpcy5faW5zdGFuY2VzLmZvckVhY2goaW5zdGFuY2UgPT4gaW5zdGFuY2UuX3BhdXNlU29ja2V0V3JpdGluZygpKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9wZXJtYW5lbnRGYWlsdXJlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgc3RhdGljIF9wZXJtYW5lbnRGYWlsdXJlTWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIHN0YXRpYyBfcGVybWFuZW50RmFpbHVyZUF0dGVtcHQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgc3RhdGljIF9wZXJtYW5lbnRGYWlsdXJlSGFuZGxlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2VzOiBQZXJzaXN0ZW50Q29ubmVjdGlvbltdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdGF0ZUNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRTdGF0ZUNoYW5nZSA9IHRoaXMuX29uRGlkU3RhdGVDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfcGVybWFuZW50RmFpbHVyZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIGdldCBfaXNQZXJtYW5lbnRGYWlsdXJlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9wZXJtYW5lbnRGYWlsdXJlIHx8IFBlcnNpc3RlbnRDb25uZWN0aW9uLl9wZXJtYW5lbnRGYWlsdXJlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNSZWNvbm5lY3Rpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Nvbm5lY3Rpb25UeXBlOiBDb25uZWN0aW9uVHlwZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9ucyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZWNvbm5lY3Rpb25GYWlsdXJlSXNGYXRhbDogYm9vbGVhblxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb25EaWRTdGF0ZUNoYW5nZS5maXJlKG5ldyBDb25uZWN0aW9uR2FpbkV2ZW50KHRoaXMucmVjb25uZWN0aW9uVG9rZW4sIDAsIDApKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb3RvY29sLm9uU29ja2V0Q2xvc2UoKGUpID0+IHtcblx0XHRcdGNvbnN0IGxvZ1ByZWZpeCA9IGNvbW1vbkxvZ1ByZWZpeCh0aGlzLl9jb25uZWN0aW9uVHlwZSwgdGhpcy5yZWNvbm5lY3Rpb25Ub2tlbiwgdHJ1ZSk7XG5cdFx0XHRpZiAoIWUpIHtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmluZm8oYCR7bG9nUHJlZml4fSByZWNlaXZlZCBzb2NrZXQgY2xvc2UgZXZlbnQuYCk7XG5cdFx0XHR9IGVsc2UgaWYgKGUudHlwZSA9PT0gU29ja2V0Q2xvc2VFdmVudFR5cGUuTm9kZVNvY2tldENsb3NlRXZlbnQpIHtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmluZm8oYCR7bG9nUHJlZml4fSByZWNlaXZlZCBzb2NrZXQgY2xvc2UgZXZlbnQgKGhhZEVycm9yOiAke2UuaGFkRXJyb3J9KS5gKTtcblx0XHRcdFx0aWYgKGUuZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZS5lcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5pbmZvKGAke2xvZ1ByZWZpeH0gcmVjZWl2ZWQgc29ja2V0IGNsb3NlIGV2ZW50ICh3YXNDbGVhbjogJHtlLndhc0NsZWFufSwgY29kZTogJHtlLmNvZGV9LCByZWFzb246ICR7ZS5yZWFzb259KS5gKTtcblx0XHRcdFx0aWYgKGUuZXZlbnQpIHtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZS5ldmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX2JlZ2luUmVjb25uZWN0aW5nKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb3RvY29sLm9uU29ja2V0VGltZW91dCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgbG9nUHJlZml4ID0gY29tbW9uTG9nUHJlZml4KHRoaXMuX2Nvbm5lY3Rpb25UeXBlLCB0aGlzLnJlY29ubmVjdGlvblRva2VuLCB0cnVlKTtcblx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5pbmZvKGAke2xvZ1ByZWZpeH0gcmVjZWl2ZWQgc29ja2V0IHRpbWVvdXQgZXZlbnQgKHVuYWNrbm93bGVkZ2VkTXNnQ291bnQ6ICR7ZS51bmFja25vd2xlZGdlZE1zZ0NvdW50fSwgdGltZVNpbmNlT2xkZXN0VW5hY2tub3dsZWRnZWRNc2c6ICR7ZS50aW1lU2luY2VPbGRlc3RVbmFja25vd2xlZGdlZE1zZ30sIHRpbWVTaW5jZUxhc3RSZWNlaXZlZFNvbWVEYXRhOiAke2UudGltZVNpbmNlTGFzdFJlY2VpdmVkU29tZURhdGF9KS5gKTtcblx0XHRcdHRoaXMuX2JlZ2luUmVjb25uZWN0aW5nKCk7XG5cdFx0fSkpO1xuXG5cdFx0UGVyc2lzdGVudENvbm5lY3Rpb24uX2luc3RhbmNlcy5wdXNoKHRoaXMpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBteUluZGV4ID0gUGVyc2lzdGVudENvbm5lY3Rpb24uX2luc3RhbmNlcy5pbmRleE9mKHRoaXMpO1xuXHRcdFx0aWYgKG15SW5kZXggPj0gMCkge1xuXHRcdFx0XHRQZXJzaXN0ZW50Q29ubmVjdGlvbi5faW5zdGFuY2VzLnNwbGljZShteUluZGV4LCAxKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAodGhpcy5faXNQZXJtYW5lbnRGYWlsdXJlKSB7XG5cdFx0XHR0aGlzLl9nb3RvUGVybWFuZW50RmFpbHVyZShQZXJzaXN0ZW50Q29ubmVjdGlvbi5fcGVybWFuZW50RmFpbHVyZU1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSwgUGVyc2lzdGVudENvbm5lY3Rpb24uX3Blcm1hbmVudEZhaWx1cmVBdHRlbXB0LCBQZXJzaXN0ZW50Q29ubmVjdGlvbi5fcGVybWFuZW50RmFpbHVyZUhhbmRsZWQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2JlZ2luUmVjb25uZWN0aW5nKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIE9ubHkgaGF2ZSBvbmUgcmVjb25uZWN0aW9uIGxvb3AgYWN0aXZlIGF0IGEgdGltZS5cblx0XHRpZiAodGhpcy5faXNSZWNvbm5lY3RpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2lzUmVjb25uZWN0aW5nID0gdHJ1ZTtcblx0XHRcdGF3YWl0IHRoaXMuX3J1blJlY29ubmVjdGluZ0xvb3AoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faXNSZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9ydW5SZWNvbm5lY3RpbmdMb29wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9pc1Blcm1hbmVudEZhaWx1cmUgfHwgdGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0Ly8gbm8gbW9yZSBhdHRlbXB0cyFcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbG9nUHJlZml4ID0gY29tbW9uTG9nUHJlZml4KHRoaXMuX2Nvbm5lY3Rpb25UeXBlLCB0aGlzLnJlY29ubmVjdGlvblRva2VuLCB0cnVlKTtcblx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuaW5mbyhgJHtsb2dQcmVmaXh9IHN0YXJ0aW5nIHJlY29ubmVjdGluZyBsb29wLiBZb3UgY2FuIGdldCBtb3JlIGluZm9ybWF0aW9uIHdpdGggdGhlIHRyYWNlIGxvZyBsZXZlbC5gKTtcblx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUobmV3IENvbm5lY3Rpb25Mb3N0RXZlbnQodGhpcy5yZWNvbm5lY3Rpb25Ub2tlbiwgdGhpcy5wcm90b2NvbC5nZXRNaWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGEoKSkpO1xuXHRcdGNvbnN0IFRJTUVTID0gWzAsIDUsIDUsIDEwLCAxMCwgMTAsIDEwLCAxMCwgMzBdO1xuXHRcdGxldCBhdHRlbXB0ID0gLTE7XG5cdFx0ZG8ge1xuXHRcdFx0YXR0ZW1wdCsrO1xuXHRcdFx0Y29uc3Qgd2FpdFRpbWUgPSAoYXR0ZW1wdCA8IFRJTUVTLmxlbmd0aCA/IFRJTUVTW2F0dGVtcHRdIDogVElNRVNbVElNRVMubGVuZ3RoIC0gMV0pO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHdhaXRUaW1lID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IHNsZWVwUHJvbWlzZSA9IHNsZWVwKHdhaXRUaW1lKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUobmV3IFJlY29ubmVjdGlvbldhaXRFdmVudCh0aGlzLnJlY29ubmVjdGlvblRva2VuLCB0aGlzLnByb3RvY29sLmdldE1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSgpLCB3YWl0VGltZSwgc2xlZXBQcm9taXNlKSk7XG5cblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuaW5mbyhgJHtsb2dQcmVmaXh9IHdhaXRpbmcgZm9yICR7d2FpdFRpbWV9IHNlY29uZHMgYmVmb3JlIHJlY29ubmVjdGluZy4uLmApO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCBzbGVlcFByb21pc2U7XG5cdFx0XHRcdFx0fSBjYXRjaCB7IH0gLy8gVXNlciBjYW5jZWxlZCB0aW1lclxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX2lzUGVybWFuZW50RmFpbHVyZSkge1xuXHRcdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5lcnJvcihgJHtsb2dQcmVmaXh9IHBlcm1hbmVudCBmYWlsdXJlIG9jY3VycmVkIHdoaWxlIHJ1bm5pbmcgdGhlIHJlY29ubmVjdGluZyBsb29wLmApO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gY29ubmVjdGlvbiB3YXMgbG9zdCwgbGV0J3MgdHJ5IHRvIHJlLWVzdGFibGlzaCBpdFxuXHRcdFx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUobmV3IFJlY29ubmVjdGlvblJ1bm5pbmdFdmVudCh0aGlzLnJlY29ubmVjdGlvblRva2VuLCB0aGlzLnByb3RvY29sLmdldE1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSgpLCBhdHRlbXB0ICsgMSkpO1xuXHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuaW5mbyhgJHtsb2dQcmVmaXh9IHJlc29sdmluZyBjb25uZWN0aW9uLi4uYCk7XG5cdFx0XHRcdGNvbnN0IHNpbXBsZU9wdGlvbnMgPSBhd2FpdCByZXNvbHZlQ29ubmVjdGlvbk9wdGlvbnModGhpcy5fb3B0aW9ucywgdGhpcy5yZWNvbm5lY3Rpb25Ub2tlbiwgdGhpcy5wcm90b2NvbCk7XG5cdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5pbmZvKGAke2xvZ1ByZWZpeH0gY29ubmVjdGluZyB0byAke3NpbXBsZU9wdGlvbnMuY29ubmVjdFRvfS4uLmApO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9yZWNvbm5lY3Qoc2ltcGxlT3B0aW9ucywgY3JlYXRlVGltZW91dENhbmNlbGxhdGlvbihSRUNPTk5FQ1RfVElNRU9VVCkpO1xuXHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuaW5mbyhgJHtsb2dQcmVmaXh9IHJlY29ubmVjdGVkIWApO1xuXHRcdFx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUobmV3IENvbm5lY3Rpb25HYWluRXZlbnQodGhpcy5yZWNvbm5lY3Rpb25Ub2tlbiwgdGhpcy5wcm90b2NvbC5nZXRNaWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGEoKSwgYXR0ZW1wdCArIDEpKTtcblxuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRpZiAoZXJyLmNvZGUgPT09ICdWU0NPREVfQ09OTkVDVElPTl9FUlJPUicpIHtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYCR7bG9nUHJlZml4fSBBIHBlcm1hbmVudCBlcnJvciBvY2N1cnJlZCBpbiB0aGUgcmVjb25uZWN0aW5nIGxvb3AhIFdpbGwgZ2l2ZSB1cCBub3chIEVycm9yOmApO1xuXHRcdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHRoaXMuX29uUmVjb25uZWN0aW9uUGVybWFuZW50RmFpbHVyZSh0aGlzLnByb3RvY29sLmdldE1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSgpLCBhdHRlbXB0ICsgMSwgZmFsc2UpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChhdHRlbXB0ID4gMzYwKSB7XG5cdFx0XHRcdFx0Ly8gUmVjb25uZWN0aW9uR3JhY2VUaW1lIGlzIDNocnMsIHdpdGggMzBzIGJldHdlZW4gYXR0ZW1wdHMgdGhhdCB5aWVsZHMgYSBtYXhpbXVtIG9mIDM2MCBhdHRlbXB0c1xuXHRcdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS5lcnJvcihgJHtsb2dQcmVmaXh9IEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHJlY29ubmVjdGluZywgYnV0IGl0IHdpbGwgYmUgdHJlYXRlZCBhcyBhIHBlcm1hbmVudCBlcnJvciBiZWNhdXNlIHRoZSByZWNvbm5lY3Rpb24gZ3JhY2UgdGltZSBoYXMgZXhwaXJlZCEgV2lsbCBnaXZlIHVwIG5vdyEgRXJyb3I6YCk7XG5cdFx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0dGhpcy5fb25SZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlKHRoaXMucHJvdG9jb2wuZ2V0TWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhKCksIGF0dGVtcHQgKyAxLCBmYWxzZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IuaXNUZW1wb3JhcmlseU5vdEF2YWlsYWJsZShlcnIpKSB7XG5cdFx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmluZm8oYCR7bG9nUHJlZml4fSBBIHRlbXBvcmFyaWx5IG5vdCBhdmFpbGFibGUgZXJyb3Igb2NjdXJyZWQgd2hpbGUgdHJ5aW5nIHRvIHJlY29ubmVjdCwgd2lsbCB0cnkgYWdhaW4uLi5gKTtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UudHJhY2UoZXJyKTtcblx0XHRcdFx0XHQvLyB0cnkgYWdhaW4hXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKChlcnIuY29kZSA9PT0gJ0VUSU1FRE9VVCcgfHwgZXJyLmNvZGUgPT09ICdFTkVUVU5SRUFDSCcgfHwgZXJyLmNvZGUgPT09ICdFQ09OTlJFRlVTRUQnIHx8IGVyci5jb2RlID09PSAnRUNPTk5SRVNFVCcpICYmIGVyci5zeXNjYWxsID09PSAnY29ubmVjdCcpIHtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuaW5mbyhgJHtsb2dQcmVmaXh9IEEgbmV0d29yayBlcnJvciBvY2N1cnJlZCB3aGlsZSB0cnlpbmcgdG8gcmVjb25uZWN0LCB3aWxsIHRyeSBhZ2Fpbi4uLmApO1xuXHRcdFx0XHRcdHRoaXMuX29wdGlvbnMubG9nU2VydmljZS50cmFjZShlcnIpO1xuXHRcdFx0XHRcdC8vIHRyeSBhZ2FpbiFcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmluZm8oYCR7bG9nUHJlZml4fSBBIHByb21pc2UgY2FuY2VsYXRpb24gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdHJ5aW5nIHRvIHJlY29ubmVjdCwgd2lsbCB0cnkgYWdhaW4uLi5gKTtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UudHJhY2UoZXJyKTtcblx0XHRcdFx0XHQvLyB0cnkgYWdhaW4hXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVyciBpbnN0YW5jZW9mIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYCR7bG9nUHJlZml4fSBBIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3Igb2NjdXJyZWQgd2hpbGUgdHJ5aW5nIHRvIHJlY29ubmVjdC4gV2lsbCBnaXZlIHVwIG5vdyEgRXJyb3I6YCk7XG5cdFx0XHRcdFx0dGhpcy5fb3B0aW9ucy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0dGhpcy5fb25SZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlKHRoaXMucHJvdG9jb2wuZ2V0TWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhKCksIGF0dGVtcHQgKyAxLCBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yLmlzSGFuZGxlZChlcnIpKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoYCR7bG9nUHJlZml4fSBBbiB1bmtub3duIGVycm9yIG9jY3VycmVkIHdoaWxlIHRyeWluZyB0byByZWNvbm5lY3QsIHNpbmNlIHRoaXMgaXMgYW4gdW5rbm93biBjYXNlLCBpdCB3aWxsIGJlIHRyZWF0ZWQgYXMgYSBwZXJtYW5lbnQgZXJyb3IhIFdpbGwgZ2l2ZSB1cCBub3chIEVycm9yOmApO1xuXHRcdFx0XHR0aGlzLl9vcHRpb25zLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdFx0dGhpcy5fb25SZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlKHRoaXMucHJvdG9jb2wuZ2V0TWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhKCksIGF0dGVtcHQgKyAxLCBmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKCF0aGlzLl9pc1Blcm1hbmVudEZhaWx1cmUgJiYgIXRoaXMuX2lzRGlzcG9zZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25SZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlKG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogbnVtYmVyLCBhdHRlbXB0OiBudW1iZXIsIGhhbmRsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcmVjb25uZWN0aW9uRmFpbHVyZUlzRmF0YWwpIHtcblx0XHRcdFBlcnNpc3RlbnRDb25uZWN0aW9uLnRyaWdnZXJQZXJtYW5lbnRGYWlsdXJlKG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSwgYXR0ZW1wdCwgaGFuZGxlZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2dvdG9QZXJtYW5lbnRGYWlsdXJlKG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSwgYXR0ZW1wdCwgaGFuZGxlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ290b1Blcm1hbmVudEZhaWx1cmUobWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXIsIGF0dGVtcHQ6IG51bWJlciwgaGFuZGxlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkU3RhdGVDaGFuZ2UuZmlyZShuZXcgUmVjb25uZWN0aW9uUGVybWFuZW50RmFpbHVyZUV2ZW50KHRoaXMucmVjb25uZWN0aW9uVG9rZW4sIG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YSwgYXR0ZW1wdCwgaGFuZGxlZCkpO1xuXHRcdHNhZmVEaXNwb3NlUHJvdG9jb2xBbmRTb2NrZXQodGhpcy5wcm90b2NvbCk7XG5cdH1cblxuXHRwcml2YXRlIF9wYXVzZVNvY2tldFdyaXRpbmcoKTogdm9pZCB7XG5cdFx0dGhpcy5wcm90b2NvbC5wYXVzZVNvY2tldFdyaXRpbmcoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfcmVjb25uZWN0KG9wdGlvbnM6IElTaW1wbGVDb25uZWN0aW9uT3B0aW9ucywgdGltZW91dENhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VtZW50UGVyc2lzdGVudENvbm5lY3Rpb24gZXh0ZW5kcyBQZXJzaXN0ZW50Q29ubmVjdGlvbiB7XG5cblx0cHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50PFJlbW90ZUFnZW50Q29ubmVjdGlvbkNvbnRleHQ+O1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9ucywgcmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcsIGNsaWVudElkOiBzdHJpbmcsIHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcsIHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wpIHtcblx0XHRzdXBlcihDb25uZWN0aW9uVHlwZS5NYW5hZ2VtZW50LCBvcHRpb25zLCByZWNvbm5lY3Rpb25Ub2tlbiwgcHJvdG9jb2wsIC8qcmVjb25uZWN0aW9uRmFpbHVyZUlzRmF0YWwqL3RydWUpO1xuXHRcdHRoaXMuY2xpZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IENsaWVudDxSZW1vdGVBZ2VudENvbm5lY3Rpb25Db250ZXh0Pihwcm90b2NvbCwge1xuXHRcdFx0cmVtb3RlQXV0aG9yaXR5OiByZW1vdGVBdXRob3JpdHksXG5cdFx0XHRjbGllbnRJZDogY2xpZW50SWRcblx0XHR9LCBvcHRpb25zLmlwY0xvZ2dlcikpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9yZWNvbm5lY3Qob3B0aW9uczogSVNpbXBsZUNvbm5lY3Rpb25PcHRpb25zLCB0aW1lb3V0Q2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgZG9Db25uZWN0UmVtb3RlQWdlbnRNYW5hZ2VtZW50KG9wdGlvbnMsIHRpbWVvdXRDYW5jZWxsYXRpb25Ub2tlbik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkhvc3RQZXJzaXN0ZW50Q29ubmVjdGlvbiBleHRlbmRzIFBlcnNpc3RlbnRDb25uZWN0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFydEFyZ3VtZW50czogSVJlbW90ZUV4dGVuc2lvbkhvc3RTdGFydFBhcmFtcztcblx0cHVibGljIHJlYWRvbmx5IGRlYnVnUG9ydDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9ucywgc3RhcnRBcmd1bWVudHM6IElSZW1vdGVFeHRlbnNpb25Ib3N0U3RhcnRQYXJhbXMsIHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcsIHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wsIGRlYnVnUG9ydDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0c3VwZXIoQ29ubmVjdGlvblR5cGUuRXh0ZW5zaW9uSG9zdCwgb3B0aW9ucywgcmVjb25uZWN0aW9uVG9rZW4sIHByb3RvY29sLCAvKnJlY29ubmVjdGlvbkZhaWx1cmVJc0ZhdGFsKi9mYWxzZSk7XG5cdFx0dGhpcy5fc3RhcnRBcmd1bWVudHMgPSBzdGFydEFyZ3VtZW50cztcblx0XHR0aGlzLmRlYnVnUG9ydCA9IGRlYnVnUG9ydDtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfcmVjb25uZWN0KG9wdGlvbnM6IElTaW1wbGVDb25uZWN0aW9uT3B0aW9ucywgdGltZW91dENhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGRvQ29ubmVjdFJlbW90ZUFnZW50RXh0ZW5zaW9uSG9zdChvcHRpb25zLCB0aGlzLl9zdGFydEFyZ3VtZW50cywgdGltZW91dENhbmNlbGxhdGlvblRva2VuKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzYWZlRGlzcG9zZVByb3RvY29sQW5kU29ja2V0KHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wpOiB2b2lkIHtcblx0dHJ5IHtcblx0XHRwcm90b2NvbC5hY2NlcHREaXNjb25uZWN0KCk7XG5cdFx0Y29uc3Qgc29ja2V0ID0gcHJvdG9jb2wuZ2V0U29ja2V0KCk7XG5cdFx0cHJvdG9jb2wuZGlzcG9zZSgpO1xuXHRcdHNvY2tldC5kaXNwb3NlKCk7XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RXJyb3JGcm9tTWVzc2FnZShtc2c6IGFueSk6IEVycm9yIHwgbnVsbCB7XG5cdGlmIChtc2cgJiYgbXNnLnR5cGUgPT09ICdlcnJvcicpIHtcblx0XHRjb25zdCBlcnJvciA9IG5ldyBFcnJvcihgQ29ubmVjdGlvbiBlcnJvcjogJHttc2cucmVhc29ufWApO1xuXHRcdCg8YW55PmVycm9yKS5jb2RlID0gJ1ZTQ09ERV9DT05ORUNUSU9OX0VSUk9SJztcblx0XHRyZXR1cm4gZXJyb3I7XG5cdH1cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ1JpZ2h0UGFkKHN0cjogc3RyaW5nLCBsZW46IG51bWJlcik6IHN0cmluZyB7XG5cdHdoaWxlIChzdHIubGVuZ3RoIDwgbGVuKSB7XG5cdFx0c3RyICs9ICcgJztcblx0fVxuXHRyZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBfY29tbW9uTG9nUHJlZml4KGNvbm5lY3Rpb25UeXBlOiBDb25uZWN0aW9uVHlwZSwgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBgW3JlbW90ZS1jb25uZWN0aW9uXVske3N0cmluZ1JpZ2h0UGFkKGNvbm5lY3Rpb25UeXBlVG9TdHJpbmcoY29ubmVjdGlvblR5cGUpLCAxMyl9XVske3JlY29ubmVjdGlvblRva2VuLnN1YnN0cigwLCA1KX1cdTIwMjZdYDtcbn1cblxuZnVuY3Rpb24gY29tbW9uTG9nUHJlZml4KGNvbm5lY3Rpb25UeXBlOiBDb25uZWN0aW9uVHlwZSwgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZywgaXNSZWNvbm5lY3Q6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRyZXR1cm4gYCR7X2NvbW1vbkxvZ1ByZWZpeChjb25uZWN0aW9uVHlwZSwgcmVjb25uZWN0aW9uVG9rZW4pfVske2lzUmVjb25uZWN0ID8gJ3JlY29ubmVjdCcgOiAnaW5pdGlhbCd9XWA7XG59XG5cbmZ1bmN0aW9uIGNvbm5lY3RMb2dQcmVmaXgob3B0aW9uczogSVNpbXBsZUNvbm5lY3Rpb25PcHRpb25zLCBjb25uZWN0aW9uVHlwZTogQ29ubmVjdGlvblR5cGUpOiBzdHJpbmcge1xuXHRyZXR1cm4gYCR7Y29tbW9uTG9nUHJlZml4KGNvbm5lY3Rpb25UeXBlLCBvcHRpb25zLnJlY29ubmVjdGlvblRva2VuLCAhIW9wdGlvbnMucmVjb25uZWN0aW9uUHJvdG9jb2wpfVske29wdGlvbnMuY29ubmVjdFRvfV1gO1xufVxuXG5mdW5jdGlvbiBsb2dFbGFwc2VkKHN0YXJ0VGltZTogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuIGAke0RhdGUubm93KCkgLSBzdGFydFRpbWV9IG1zYDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQTRCLHlCQUF5Qiw0QkFBNEI7QUFDakYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMscUJBQXFCLHlCQUF5QjtBQUN2RCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyx5QkFBeUI7QUFDbEMsWUFBWSxpQkFB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QUE2QixnQkFBaUQsbUJBQTJCLFVBQThCLFdBQStCO0FBQ2pMO0FBQUEsTUFBTTtBQUFBLE1BQThCO0FBQUEsTUFBUztBQUFBLE1BQW1CO0FBQUE7QUFBQSxNQUF3QztBQUFBLElBQUs7QUFDN0csU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxZQUFZO0FBQUEsRUFDbEI7QUFBQSxFQUVBLE1BQWdCLFdBQVcsU0FBbUMsMEJBQTREO0FBQ3pILFVBQU0sa0NBQWtDLFNBQVMsS0FBSyxpQkFBaUIsd0JBQXdCO0FBQUEsRUFDaEc7QUFDRDtBQUVBLFNBQVMsNkJBQTZCLFVBQW9DO0FBQ3pFLE1BQUk7QUFDSCxhQUFTLGlCQUFpQjtBQUMxQixVQUFNLFNBQVMsU0FBUyxVQUFVO0FBQ2xDLGFBQVMsUUFBUTtBQUNqQixXQUFPLFFBQVE7QUFBQSxFQUNoQixTQUFTLEtBQUs7QUFDYixzQkFBa0IsR0FBRztBQUFBLEVBQ3RCO0FBQ0Q7QUFFQSxTQUFTLG9CQUFvQixLQUF3QjtBQUNwRCxNQUFJLE9BQU8sSUFBSSxTQUFTLFNBQVM7QUFDaEMsVUFBTSxRQUFRLElBQUksTUFBTSxxQkFBcUIsSUFBSSxNQUFNLEVBQUU7QUFDekQsSUFBTSxNQUFPLE9BQU87QUFDcEIsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLGVBQWUsS0FBYSxLQUFxQjtBQUN6RCxTQUFPLElBQUksU0FBUyxLQUFLO0FBQ3hCLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTztBQUNSO0FBRUEsU0FBUyxpQkFBaUIsZ0JBQWdDLG1CQUFtQztBQUM1RixTQUFPLHVCQUF1QixlQUFlLHVCQUF1QixjQUFjLEdBQUcsRUFBRSxDQUFDLEtBQUssa0JBQWtCLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDNUg7QUFFQSxTQUFTLGdCQUFnQixnQkFBZ0MsbUJBQTJCLGFBQThCO0FBQ2pILFNBQU8sR0FBRyxpQkFBaUIsZ0JBQWdCLGlCQUFpQixDQUFDLElBQUksY0FBYyxjQUFjLFNBQVM7QUFDdkc7QUFFQSxTQUFTLGlCQUFpQixTQUFtQyxnQkFBd0M7QUFDcEcsU0FBTyxHQUFHLGdCQUFnQixnQkFBZ0IsUUFBUSxtQkFBbUIsQ0FBQyxDQUFDLFFBQVEsb0JBQW9CLENBQUMsSUFBSSxRQUFRLFNBQVM7QUFDMUg7QUFFQSxTQUFTLFdBQVcsV0FBMkI7QUFDOUMsU0FBTyxHQUFHLEtBQUssSUFBSSxJQUFJLFNBQVM7QUFDakM7IiwKICAibmFtZXMiOiBbIkNvbm5lY3Rpb25UeXBlIiwgIlBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlIl0KfQo=
