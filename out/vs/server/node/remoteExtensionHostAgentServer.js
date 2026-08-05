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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as crypto from "crypto";
import * as fs from "fs";
import * as net from "net";
import { performance } from "perf_hooks";
import * as url from "url";
import { VSBuffer } from "../../base/common/buffer.js";
import { CharCode } from "../../base/common/charCode.js";
import { isSigPipeError, onUnexpectedError, setUnexpectedErrorHandler } from "../../base/common/errors.js";
import { isEqualOrParent } from "../../base/common/extpath.js";
import { Disposable, DisposableStore } from "../../base/common/lifecycle.js";
import { connectionTokenQueryName, FileAccess, getServerProductSegment, Schemas } from "../../base/common/network.js";
import { dirname, join } from "../../base/common/path.js";
import * as perf from "../../base/common/performance.js";
import * as platform from "../../base/common/platform.js";
import { createRegExp, escapeRegExpCharacters } from "../../base/common/strings.js";
import { URI } from "../../base/common/uri.js";
import { generateUuid } from "../../base/common/uuid.js";
import { getOSReleaseInfo } from "../../base/node/osReleaseInfo.js";
import { findFreePort } from "../../base/node/ports.js";
import { addUNCHostToAllowlist, disableUNCAccessRestrictions } from "../../base/node/unc.js";
import { PersistentProtocol } from "../../base/parts/ipc/common/ipc.net.js";
import { NodeSocket, WebSocketNodeSocket } from "../../base/parts/ipc/node/ipc.net.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../platform/log/common/log.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { ConnectionType } from "../../platform/remote/common/remoteAgentConnection.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { ExtensionHostConnection } from "./extensionHostConnection.js";
import { ManagementConnection } from "./remoteExtensionManagement.js";
import { determineServerConnectionToken, requestHasValidConnectionToken as httpRequestHasValidConnectionToken, ServerConnectionTokenParseError, ServerConnectionTokenType } from "./serverConnectionToken.js";
import { IServerEnvironmentService } from "./serverEnvironmentService.js";
import { setupServerServices } from "./serverServices.js";
import { CacheControl, serveError, serveFile, WebClientServer } from "./webClientServer.js";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const SHUTDOWN_TIMEOUT = 5 * 60 * 1e3;
let RemoteExtensionHostAgentServer = class extends Disposable {
  constructor(_socketServer, _connectionToken, _vsdaMod, hasWebClient, serverBasePath, _environmentService, _productService, _logService, _instantiationService) {
    super();
    this._socketServer = _socketServer;
    this._connectionToken = _connectionToken;
    this._vsdaMod = _vsdaMod;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._webEndpointOriginChecker = WebEndpointOriginChecker.create(this._productService);
    if (serverBasePath !== void 0 && serverBasePath.charCodeAt(serverBasePath.length - 1) === CharCode.Slash) {
      serverBasePath = serverBasePath.substring(0, serverBasePath.length - 1);
    }
    this._serverBasePath = serverBasePath;
    this._serverProductPath = `/${getServerProductSegment(_productService)}`;
    this._extHostConnections = /* @__PURE__ */ Object.create(null);
    this._managementConnections = /* @__PURE__ */ Object.create(null);
    this._allReconnectionTokens = /* @__PURE__ */ new Set();
    this._webClientServer = hasWebClient ? this._instantiationService.createInstance(WebClientServer, this._connectionToken, serverBasePath ?? "/", this._serverProductPath) : null;
    this._logService.info(`Extension host agent started.`);
    this._waitThenShutdown(true);
  }
  async handleRequest(req, res) {
    if (req.method !== "GET") {
      return serveError(req, res, 405, `Unsupported method ${req.method}`);
    }
    if (!req.url) {
      return serveError(req, res, 400, `Bad request.`);
    }
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    if (!pathname) {
      return serveError(req, res, 400, `Bad request.`);
    }
    if (this._serverBasePath !== void 0 && pathname.startsWith(this._serverBasePath)) {
      pathname = pathname.substring(this._serverBasePath.length) || "/";
    }
    if (pathname.startsWith(this._serverProductPath) && pathname.charCodeAt(this._serverProductPath.length) === CharCode.Slash) {
      pathname = pathname.substring(this._serverProductPath.length);
    }
    if (pathname === "/version") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return void res.end(this._productService.commit || "");
    }
    if (pathname === "/delay-shutdown") {
      this._delayShutdown();
      res.writeHead(200);
      return void res.end("OK");
    }
    if (!httpRequestHasValidConnectionToken(this._connectionToken, req, parsedUrl)) {
      return serveError(req, res, 403, `Forbidden.`);
    }
    if (pathname === "/vscode-remote-resource") {
      const desiredPath = parsedUrl.query["path"];
      if (typeof desiredPath !== "string") {
        return serveError(req, res, 400, `Bad request.`);
      }
      let filePath;
      try {
        filePath = URI.from({ scheme: Schemas.file, path: desiredPath }).fsPath;
      } catch (err) {
        return serveError(req, res, 400, `Bad request.`);
      }
      const responseHeaders = /* @__PURE__ */ Object.create(null);
      if (this._environmentService.isBuilt) {
        if (isEqualOrParent(filePath, this._environmentService.builtinExtensionsPath, !platform.isLinux) || isEqualOrParent(filePath, this._environmentService.extensionsPath, !platform.isLinux)) {
          responseHeaders["Cache-Control"] = "public, max-age=31536000";
        }
      }
      responseHeaders["Vary"] = "Origin";
      const requestOrigin = req.headers["origin"];
      if (requestOrigin && this._webEndpointOriginChecker.matches(requestOrigin)) {
        responseHeaders["Access-Control-Allow-Origin"] = requestOrigin;
      }
      return serveFile(filePath, CacheControl.ETAG, this._logService, req, res, responseHeaders);
    }
    if (this._webClientServer) {
      this._webClientServer.handle(req, res, parsedUrl, pathname);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    return void res.end("Not found");
  }
  handleUpgrade(req, socket) {
    let reconnectionToken = generateUuid();
    let isReconnection = false;
    let skipWebSocketFrames = false;
    if (req.url) {
      const query = url.parse(req.url, true).query;
      if (typeof query.reconnectionToken === "string") {
        reconnectionToken = query.reconnectionToken;
      }
      if (query.reconnection === "true") {
        isReconnection = true;
      }
      if (query.skipWebSocketFrames === "true") {
        skipWebSocketFrames = true;
      }
    }
    if (req.headers["upgrade"] === void 0 || req.headers["upgrade"].toLowerCase() !== "websocket") {
      socket.end("HTTP/1.1 400 Bad Request");
      return;
    }
    const requestNonce = req.headers["sec-websocket-key"];
    const hash = crypto.createHash("sha1");
    hash.update(requestNonce + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
    const responseNonce = hash.digest("base64");
    const responseHeaders = [
      `HTTP/1.1 101 Switching Protocols`,
      `Upgrade: websocket`,
      `Connection: Upgrade`,
      `Sec-WebSocket-Accept: ${responseNonce}`
    ];
    let permessageDeflate = false;
    if (!skipWebSocketFrames && !this._environmentService.args["disable-websocket-compression"] && req.headers["sec-websocket-extensions"]) {
      const websocketExtensionOptions = Array.isArray(req.headers["sec-websocket-extensions"]) ? req.headers["sec-websocket-extensions"] : [req.headers["sec-websocket-extensions"]];
      for (const websocketExtensionOption of websocketExtensionOptions) {
        if (/\b((server_max_window_bits)|(server_no_context_takeover)|(client_no_context_takeover))\b/.test(websocketExtensionOption)) {
          continue;
        }
        if (/\b(permessage-deflate)\b/.test(websocketExtensionOption)) {
          permessageDeflate = true;
          responseHeaders.push(`Sec-WebSocket-Extensions: permessage-deflate`);
          break;
        }
        if (/\b(x-webkit-deflate-frame)\b/.test(websocketExtensionOption)) {
          permessageDeflate = true;
          responseHeaders.push(`Sec-WebSocket-Extensions: x-webkit-deflate-frame`);
          break;
        }
      }
    }
    socket.write(responseHeaders.join("\r\n") + "\r\n\r\n");
    socket.setTimeout(0);
    socket.setNoDelay(true);
    if (skipWebSocketFrames) {
      this._handleWebSocketConnection(new NodeSocket(socket, `server-connection-${reconnectionToken}`), isReconnection, reconnectionToken);
    } else {
      this._handleWebSocketConnection(new WebSocketNodeSocket(new NodeSocket(socket, `server-connection-${reconnectionToken}`), permessageDeflate, null, true), isReconnection, reconnectionToken);
    }
  }
  handleServerError(err) {
    this._logService.error(`Error occurred in server`);
    this._logService.error(err);
  }
  // Eventually cleanup
  _getRemoteAddress(socket) {
    let _socket;
    if (socket instanceof NodeSocket) {
      _socket = socket.socket;
    } else {
      _socket = socket.socket.socket;
    }
    return _socket.remoteAddress || `<unknown>`;
  }
  async _rejectWebSocketConnection(logPrefix, protocol, reason) {
    const socket = protocol.getSocket();
    this._logService.error(`${logPrefix} ${reason}.`);
    const errMessage = {
      type: "error",
      reason
    };
    protocol.sendControl(VSBuffer.fromString(JSON.stringify(errMessage)));
    protocol.dispose();
    await socket.drain();
    socket.dispose();
  }
  /**
   * NOTE: Avoid using await in this method!
   * The problem is that await introduces a process.nextTick due to the implicit Promise.then
   * This can lead to some bytes being received and interpreted and a control message being emitted before the next listener has a chance to be registered.
   */
  _handleWebSocketConnection(socket, isReconnection, reconnectionToken) {
    const remoteAddress = this._getRemoteAddress(socket);
    const logPrefix = `[${remoteAddress}][${reconnectionToken.substr(0, 8)}]`;
    const protocol = new PersistentProtocol({ socket });
    const validator = this._vsdaMod ? new this._vsdaMod.validator() : null;
    const signer = this._vsdaMod ? new this._vsdaMod.signer() : null;
    let State;
    ((State2) => {
      State2[State2["WaitingForAuth"] = 0] = "WaitingForAuth";
      State2[State2["WaitingForConnectionType"] = 1] = "WaitingForConnectionType";
      State2[State2["Done"] = 2] = "Done";
      State2[State2["Error"] = 3] = "Error";
    })(State || (State = {}));
    let state = 0 /* WaitingForAuth */;
    const rejectWebSocketConnection = (msg) => {
      state = 3 /* Error */;
      listener.dispose();
      this._rejectWebSocketConnection(logPrefix, protocol, msg);
    };
    const listener = protocol.onControlMessage((raw) => {
      if (state === 0 /* WaitingForAuth */) {
        let msg1;
        try {
          msg1 = JSON.parse(raw.toString());
        } catch (err) {
          return rejectWebSocketConnection(`Malformed first message`);
        }
        if (msg1.type !== "auth") {
          return rejectWebSocketConnection(`Invalid first message`);
        }
        if (this._connectionToken.type === ServerConnectionTokenType.Mandatory && !this._connectionToken.validate(msg1.auth)) {
          return rejectWebSocketConnection(`Unauthorized client refused: auth mismatch`);
        }
        let signedData = generateUuid();
        if (signer) {
          try {
            signedData = signer.sign(msg1.data);
          } catch (e) {
          }
        }
        let someText = generateUuid();
        if (validator) {
          try {
            someText = validator.createNewMessage(someText);
          } catch (e) {
          }
        }
        const signRequest = {
          type: "sign",
          data: someText,
          signedData
        };
        protocol.sendControl(VSBuffer.fromString(JSON.stringify(signRequest)));
        state = 1 /* WaitingForConnectionType */;
      } else if (state === 1 /* WaitingForConnectionType */) {
        let msg2;
        try {
          msg2 = JSON.parse(raw.toString());
        } catch (err) {
          return rejectWebSocketConnection(`Malformed second message`);
        }
        if (msg2.type !== "connectionType") {
          return rejectWebSocketConnection(`Invalid second message`);
        }
        if (typeof msg2.signedData !== "string") {
          return rejectWebSocketConnection(`Invalid second message field type`);
        }
        const rendererCommit = msg2.commit;
        const myCommit = this._productService.commit;
        if (rendererCommit && myCommit) {
          if (rendererCommit !== myCommit) {
            return rejectWebSocketConnection(`Client refused: version mismatch`);
          }
        }
        let valid = false;
        if (!validator) {
          valid = true;
        } else if (this._connectionToken.validate(msg2.signedData)) {
          valid = true;
        } else {
          try {
            valid = validator.validate(msg2.signedData) === "ok";
          } catch (e) {
          }
        }
        if (!valid) {
          if (this._environmentService.isBuilt) {
            return rejectWebSocketConnection(`Unauthorized client refused`);
          } else {
            this._logService.error(`${logPrefix} Unauthorized client handshake failed but we proceed because of dev mode.`);
          }
        }
        for (const key in this._managementConnections) {
          const managementConnection = this._managementConnections[key];
          managementConnection.shortenReconnectionGraceTimeIfNecessary();
        }
        for (const key in this._extHostConnections) {
          const extHostConnection = this._extHostConnections[key];
          extHostConnection.shortenReconnectionGraceTimeIfNecessary();
        }
        state = 2 /* Done */;
        listener.dispose();
        this._handleConnectionType(remoteAddress, logPrefix, protocol, socket, isReconnection, reconnectionToken, msg2);
      }
    });
  }
  async _handleConnectionType(remoteAddress, _logPrefix, protocol, socket, isReconnection, reconnectionToken, msg) {
    const logPrefix = msg.desiredConnectionType === ConnectionType.Management ? `${_logPrefix}[ManagementConnection]` : msg.desiredConnectionType === ConnectionType.ExtensionHost ? `${_logPrefix}[ExtensionHostConnection]` : _logPrefix;
    if (msg.desiredConnectionType === ConnectionType.Management) {
      if (isReconnection) {
        if (!this._managementConnections[reconnectionToken]) {
          if (!this._allReconnectionTokens.has(reconnectionToken)) {
            return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (never seen)`);
          } else {
            return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (seen before)`);
          }
        }
        protocol.sendControl(VSBuffer.fromString(JSON.stringify({ type: "ok" })));
        const dataChunk = protocol.readEntireBuffer();
        protocol.dispose();
        this._managementConnections[reconnectionToken].acceptReconnection(remoteAddress, socket, dataChunk);
      } else {
        if (this._managementConnections[reconnectionToken]) {
          return this._rejectWebSocketConnection(logPrefix, protocol, `Duplicate reconnection token`);
        }
        protocol.sendControl(VSBuffer.fromString(JSON.stringify({ type: "ok" })));
        const con = new ManagementConnection(this._logService, reconnectionToken, remoteAddress, protocol);
        this._socketServer.acceptConnection(con.protocol, con.onClose);
        this._managementConnections[reconnectionToken] = con;
        this._allReconnectionTokens.add(reconnectionToken);
        con.onClose(() => {
          delete this._managementConnections[reconnectionToken];
        });
      }
    } else if (msg.desiredConnectionType === ConnectionType.ExtensionHost) {
      const startParams0 = msg.args || { language: "en" };
      const startParams = await this._updateWithFreeDebugPort(startParams0);
      if (startParams.port) {
        this._logService.trace(`${logPrefix} - startParams debug port ${startParams.port}`);
      }
      this._logService.trace(`${logPrefix} - startParams language: ${startParams.language}`);
      this._logService.trace(`${logPrefix} - startParams env: ${JSON.stringify(startParams.env)}`);
      if (isReconnection) {
        if (!this._extHostConnections[reconnectionToken]) {
          if (!this._allReconnectionTokens.has(reconnectionToken)) {
            return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (never seen)`);
          } else {
            return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (seen before)`);
          }
        }
        protocol.sendPause();
        protocol.sendControl(VSBuffer.fromString(JSON.stringify(startParams.port ? { debugPort: startParams.port } : {})));
        const dataChunk = protocol.readEntireBuffer();
        protocol.dispose();
        this._extHostConnections[reconnectionToken].acceptReconnection(remoteAddress, socket, dataChunk);
      } else {
        if (this._extHostConnections[reconnectionToken]) {
          return this._rejectWebSocketConnection(logPrefix, protocol, `Duplicate reconnection token`);
        }
        protocol.sendPause();
        protocol.sendControl(VSBuffer.fromString(JSON.stringify(startParams.port ? { debugPort: startParams.port } : {})));
        const dataChunk = protocol.readEntireBuffer();
        protocol.dispose();
        const con = this._instantiationService.createInstance(ExtensionHostConnection, reconnectionToken, remoteAddress, socket, dataChunk);
        this._extHostConnections[reconnectionToken] = con;
        this._allReconnectionTokens.add(reconnectionToken);
        con.onClose(() => {
          con.dispose();
          delete this._extHostConnections[reconnectionToken];
          this._onDidCloseExtHostConnection();
        });
        con.start(startParams);
      }
    } else if (msg.desiredConnectionType === ConnectionType.Tunnel) {
      const tunnelStartParams = msg.args;
      this._createTunnel(protocol, tunnelStartParams);
    } else {
      return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown initial data received`);
    }
  }
  async _createTunnel(protocol, tunnelStartParams) {
    const remoteSocket = protocol.getSocket().socket;
    const dataChunk = protocol.readEntireBuffer();
    protocol.dispose();
    remoteSocket.pause();
    const localSocket = await this._connectTunnelSocket(tunnelStartParams.host, tunnelStartParams.port);
    if (dataChunk.byteLength > 0) {
      localSocket.write(dataChunk.buffer);
    }
    localSocket.on("end", () => remoteSocket.end());
    localSocket.on("close", () => remoteSocket.end());
    localSocket.on("error", () => remoteSocket.destroy());
    remoteSocket.on("end", () => localSocket.end());
    remoteSocket.on("close", () => localSocket.end());
    remoteSocket.on("error", () => localSocket.destroy());
    localSocket.pipe(remoteSocket);
    remoteSocket.pipe(localSocket);
  }
  _connectTunnelSocket(host, port) {
    return new Promise((c, e) => {
      const socket = net.createConnection(
        {
          host,
          port,
          autoSelectFamily: true
        },
        () => {
          socket.removeListener("error", e);
          socket.pause();
          c(socket);
        }
      );
      socket.once("error", e);
    });
  }
  _updateWithFreeDebugPort(startParams) {
    if (typeof startParams.port === "number") {
      return findFreePort(
        startParams.port,
        10,
        5e3
        /* try up to 5 seconds */
      ).then((freePort) => {
        startParams.port = freePort;
        return startParams;
      });
    }
    startParams.debugId = void 0;
    startParams.port = void 0;
    startParams.break = void 0;
    return Promise.resolve(startParams);
  }
  async _onDidCloseExtHostConnection() {
    if (!this._environmentService.args["enable-remote-auto-shutdown"]) {
      return;
    }
    this._cancelShutdown();
    const hasActiveExtHosts = !!Object.keys(this._extHostConnections).length;
    if (!hasActiveExtHosts) {
      console.log("Last EH closed, waiting before shutting down");
      this._logService.info("Last EH closed, waiting before shutting down");
      this._waitThenShutdown();
    }
  }
  _waitThenShutdown(initial = false) {
    if (!this._environmentService.args["enable-remote-auto-shutdown"]) {
      return;
    }
    if (this._environmentService.args["remote-auto-shutdown-without-delay"] && !initial) {
      this._shutdown();
    } else {
      this.shutdownTimer = setTimeout(() => {
        this.shutdownTimer = void 0;
        this._shutdown();
      }, SHUTDOWN_TIMEOUT);
    }
  }
  _shutdown() {
    const hasActiveExtHosts = !!Object.keys(this._extHostConnections).length;
    if (hasActiveExtHosts) {
      console.log("New EH opened, aborting shutdown");
      this._logService.info("New EH opened, aborting shutdown");
      return;
    } else {
      console.log("Last EH closed, shutting down");
      this._logService.info("Last EH closed, shutting down");
      this.dispose();
      process.exit(0);
    }
  }
  /**
   * If the server is in a shutdown timeout, cancel it and start over
   */
  _delayShutdown() {
    if (this.shutdownTimer) {
      console.log("Got delay-shutdown request while in shutdown timeout, delaying");
      this._logService.info("Got delay-shutdown request while in shutdown timeout, delaying");
      this._cancelShutdown();
      this._waitThenShutdown();
    }
  }
  _cancelShutdown() {
    if (this.shutdownTimer) {
      console.log("Cancelling previous shutdown timeout");
      this._logService.info("Cancelling previous shutdown timeout");
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = void 0;
    }
  }
};
RemoteExtensionHostAgentServer = __decorateClass([
  __decorateParam(5, IServerEnvironmentService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IInstantiationService)
], RemoteExtensionHostAgentServer);
async function createServer(address, args, REMOTE_DATA_FOLDER) {
  const connectionToken = await determineServerConnectionToken(args);
  if (connectionToken instanceof ServerConnectionTokenParseError) {
    console.warn(connectionToken.message);
    process.exit(1);
  }
  function initUnexpectedErrorHandler(handler) {
    setUnexpectedErrorHandler((err) => {
      if (isSigPipeError(err) && err.stack && /unexpectedErrorHandler/.test(err.stack)) {
        return;
      }
      handler(err);
    });
  }
  const unloggedErrors = [];
  initUnexpectedErrorHandler((error) => {
    unloggedErrors.push(error);
    console.error(error);
  });
  let didLogAboutSIGPIPE = false;
  process.on("SIGPIPE", () => {
    if (!didLogAboutSIGPIPE) {
      didLogAboutSIGPIPE = true;
      onUnexpectedError(new Error(`Unexpected SIGPIPE`));
    }
  });
  const disposables = new DisposableStore();
  const { socketServer, instantiationService } = await setupServerServices(connectionToken, args, REMOTE_DATA_FOLDER, disposables);
  instantiationService.invokeFunction((accessor) => {
    const logService = accessor.get(ILogService);
    unloggedErrors.forEach((error) => logService.error(error));
    unloggedErrors.length = 0;
    initUnexpectedErrorHandler((error) => logService.error(error));
  });
  instantiationService.invokeFunction((accessor) => {
    const configurationService = accessor.get(IConfigurationService);
    if (platform.isWindows) {
      if (configurationService.getValue("security.restrictUNCAccess") === false) {
        disableUNCAccessRestrictions();
      } else {
        addUNCHostToAllowlist(configurationService.getValue("security.allowedUNCHosts"));
      }
    }
  });
  instantiationService.invokeFunction((accessor) => {
    const logService = accessor.get(ILogService);
    if (platform.isWindows && process.env.HOMEDRIVE && process.env.HOMEPATH) {
      const homeDirModulesPath = join(process.env.HOMEDRIVE, "node_modules");
      const userDir = dirname(join(process.env.HOMEDRIVE, process.env.HOMEPATH));
      const userDirModulesPath = join(userDir, "node_modules");
      if (fs.existsSync(homeDirModulesPath) || fs.existsSync(userDirModulesPath)) {
        const message = `

*
* !!!! Server terminated due to presence of CVE-2020-1416 !!!!
*
* Please remove the following directories and re-try
* ${homeDirModulesPath}
* ${userDirModulesPath}
*
* For more information on the vulnerability https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-1416
*

`;
        logService.warn(message);
        console.warn(message);
        process.exit(0);
      }
    }
  });
  const vsdaMod = instantiationService.invokeFunction((accessor) => {
    const logService = accessor.get(ILogService);
    const hasVSDA = fs.existsSync(join(FileAccess.asFileUri("").fsPath, "../node_modules/vsda"));
    if (hasVSDA) {
      try {
        return require2("vsda");
      } catch (err) {
        logService.error(err);
      }
    }
    return null;
  });
  let serverBasePath = args["server-base-path"];
  if (serverBasePath && !serverBasePath.startsWith("/")) {
    serverBasePath = `/${serverBasePath}`;
  }
  const hasWebClient = fs.existsSync(FileAccess.asFileUri(`vs/code/browser/workbench/workbench.html`).fsPath);
  if (hasWebClient && address && typeof address !== "string") {
    const queryPart = connectionToken.type !== ServerConnectionTokenType.None ? `?${connectionTokenQueryName}=${connectionToken.value}` : "";
    console.log(`Web UI available at http://localhost${address.port === 80 ? "" : `:${address.port}`}${serverBasePath ?? ""}${queryPart}`);
  }
  const remoteExtensionHostAgentServer = instantiationService.createInstance(RemoteExtensionHostAgentServer, socketServer, connectionToken, vsdaMod, hasWebClient, serverBasePath);
  perf.mark("code/server/ready");
  const currentTime = performance.now();
  const vscodeServerStartTime = global.vscodeServerStartTime;
  const vscodeServerListenTime = global.vscodeServerListenTime;
  const vscodeServerCodeLoadedTime = global.vscodeServerCodeLoadedTime;
  instantiationService.invokeFunction(async (accessor) => {
    const telemetryService = accessor.get(ITelemetryService);
    telemetryService.publicLog2("serverStart", {
      startTime: vscodeServerStartTime,
      startedTime: vscodeServerListenTime,
      codeLoadedTime: vscodeServerCodeLoadedTime,
      readyTime: currentTime
    });
    if (platform.isLinux) {
      const logService = accessor.get(ILogService);
      const releaseInfo = await getOSReleaseInfo(logService.error.bind(logService));
      if (releaseInfo) {
        telemetryService.publicLog2("serverPlatformInfo", {
          platformId: releaseInfo.id,
          platformVersionId: releaseInfo.version_id,
          platformIdLike: releaseInfo.id_like
        });
      }
    }
  });
  if (args["print-startup-performance"]) {
    let output = "";
    output += `Start-up time: ${vscodeServerListenTime - vscodeServerStartTime}
`;
    output += `Code loading time: ${vscodeServerCodeLoadedTime - vscodeServerStartTime}
`;
    output += `Initialized time: ${currentTime - vscodeServerStartTime}
`;
    output += `
`;
    console.log(output);
  }
  return remoteExtensionHostAgentServer;
}
class WebEndpointOriginChecker {
  constructor(_originRegExp) {
    this._originRegExp = _originRegExp;
  }
  static create(productService) {
    const webEndpointUrlTemplate = productService.webEndpointUrlTemplate;
    const commit = productService.commit;
    const quality = productService.quality;
    if (!webEndpointUrlTemplate || !commit || !quality) {
      return new WebEndpointOriginChecker(null);
    }
    const uuid = generateUuid();
    const exampleUrl = new URL(
      webEndpointUrlTemplate.replace("{{uuid}}", uuid).replace("{{commit}}", commit).replace("{{quality}}", quality)
    );
    const exampleOrigin = exampleUrl.origin;
    const originRegExpSource = escapeRegExpCharacters(exampleOrigin).replace(uuid, "[a-zA-Z0-9\\-]+");
    try {
      const originRegExp = createRegExp(`^${originRegExpSource}$`, true, { matchCase: false });
      return new WebEndpointOriginChecker(originRegExp);
    } catch (err) {
      return new WebEndpointOriginChecker(null);
    }
  }
  matches(origin) {
    if (!this._originRegExp) {
      return false;
    }
    return this._originRegExp.test(origin);
  }
}
export {
  createServer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9zZXJ2ZXIvbm9kZS9yZW1vdGVFeHRlbnNpb25Ib3N0QWdlbnRTZXJ2ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyBuZXQgZnJvbSAnbmV0JztcbmltcG9ydCB7IHBlcmZvcm1hbmNlIH0gZnJvbSAncGVyZl9ob29rcyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgaXNTaWdQaXBlRXJyb3IsIG9uVW5leHBlY3RlZEVycm9yLCBzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNvbm5lY3Rpb25Ub2tlblF1ZXJ5TmFtZSwgRmlsZUFjY2VzcywgZ2V0U2VydmVyUHJvZHVjdFNlZ21lbnQsIFNjaGVtYXMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW4gfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIHBlcmYgZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgY3JlYXRlUmVnRXhwLCBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBnZXRPU1JlbGVhc2VJbmZvIH0gZnJvbSAnLi4vLi4vYmFzZS9ub2RlL29zUmVsZWFzZUluZm8uanMnO1xuaW1wb3J0IHsgZmluZEZyZWVQb3J0IH0gZnJvbSAnLi4vLi4vYmFzZS9ub2RlL3BvcnRzLmpzJztcbmltcG9ydCB7IGFkZFVOQ0hvc3RUb0FsbG93bGlzdCwgZGlzYWJsZVVOQ0FjY2Vzc1Jlc3RyaWN0aW9ucyB9IGZyb20gJy4uLy4uL2Jhc2Uvbm9kZS91bmMuanMnO1xuaW1wb3J0IHsgUGVyc2lzdGVudFByb3RvY29sIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgTm9kZVNvY2tldCwgV2ViU29ja2V0Tm9kZVNvY2tldCB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvaXBjL25vZGUvaXBjLm5ldC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb25uZWN0aW9uVHlwZSwgQ29ubmVjdGlvblR5cGVSZXF1ZXN0LCBFcnJvck1lc3NhZ2UsIEhhbmRzaGFrZU1lc3NhZ2UsIElSZW1vdGVFeHRlbnNpb25Ib3N0U3RhcnRQYXJhbXMsIElUdW5uZWxDb25uZWN0aW9uU3RhcnRQYXJhbXMsIFNpZ25SZXF1ZXN0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgUmVtb3RlQWdlbnRDb25uZWN0aW9uQ29udGV4dCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RDb25uZWN0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25Ib3N0Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBNYW5hZ2VtZW50Q29ubmVjdGlvbiB9IGZyb20gJy4vcmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBkZXRlcm1pbmVTZXJ2ZXJDb25uZWN0aW9uVG9rZW4sIHJlcXVlc3RIYXNWYWxpZENvbm5lY3Rpb25Ub2tlbiBhcyBodHRwUmVxdWVzdEhhc1ZhbGlkQ29ubmVjdGlvblRva2VuLCBTZXJ2ZXJDb25uZWN0aW9uVG9rZW4sIFNlcnZlckNvbm5lY3Rpb25Ub2tlblBhcnNlRXJyb3IsIFNlcnZlckNvbm5lY3Rpb25Ub2tlblR5cGUgfSBmcm9tICcuL3NlcnZlckNvbm5lY3Rpb25Ub2tlbi5qcyc7XG5pbXBvcnQgeyBJU2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlLCBTZXJ2ZXJQYXJzZWRBcmdzIH0gZnJvbSAnLi9zZXJ2ZXJFbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgc2V0dXBTZXJ2ZXJTZXJ2aWNlcywgU29ja2V0U2VydmVyIH0gZnJvbSAnLi9zZXJ2ZXJTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBDYWNoZUNvbnRyb2wsIHNlcnZlRXJyb3IsIHNlcnZlRmlsZSwgV2ViQ2xpZW50U2VydmVyIH0gZnJvbSAnLi93ZWJDbGllbnRTZXJ2ZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7XG5cbmNvbnN0IFNIVVRET1dOX1RJTUVPVVQgPSA1ICogNjAgKiAxMDAwO1xuXG5kZWNsYXJlIG1vZHVsZSB2c2RhIHtcblx0Ly8gdGhlIHNpZ25lciBpcyBhIG5hdGl2ZSBtb2R1bGUgdGhhdCBmb3IgaGlzdG9yaWNhbCByZWFzb25zIHVzZXMgYSBsb3dlciBjYXNlIGNsYXNzIG5hbWVcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuXHRleHBvcnQgY2xhc3Mgc2lnbmVyIHtcblx0XHRzaWduKGFyZzogc3RyaW5nKTogc3RyaW5nO1xuXHR9XG5cblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuXHRleHBvcnQgY2xhc3MgdmFsaWRhdG9yIHtcblx0XHRjcmVhdGVOZXdNZXNzYWdlKGFyZzogc3RyaW5nKTogc3RyaW5nO1xuXHRcdHZhbGlkYXRlKGFyZzogc3RyaW5nKTogJ29rJyB8ICdlcnJvcic7XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50U2VydmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTZXJ2ZXJBUEkge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RDb25uZWN0aW9uczogeyBbcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZ106IEV4dGVuc2lvbkhvc3RDb25uZWN0aW9uIH07XG5cdHByaXZhdGUgcmVhZG9ubHkgX21hbmFnZW1lbnRDb25uZWN0aW9uczogeyBbcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZ106IE1hbmFnZW1lbnRDb25uZWN0aW9uIH07XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FsbFJlY29ubmVjdGlvblRva2VuczogU2V0PHN0cmluZz47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dlYkNsaWVudFNlcnZlcjogV2ViQ2xpZW50U2VydmVyIHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfd2ViRW5kcG9pbnRPcmlnaW5DaGVja2VyOiBXZWJFbmRwb2ludE9yaWdpbkNoZWNrZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2VydmVyQmFzZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2VydmVyUHJvZHVjdFBhdGg6IHN0cmluZztcblxuXHRwcml2YXRlIHNodXRkb3duVGltZXI6IE5vZGVKUy5UaW1lb3V0IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NvY2tldFNlcnZlcjogU29ja2V0U2VydmVyPFJlbW90ZUFnZW50Q29ubmVjdGlvbkNvbnRleHQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Nvbm5lY3Rpb25Ub2tlbjogU2VydmVyQ29ubmVjdGlvblRva2VuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZzZGFNb2Q6IHR5cGVvZiB2c2RhIHwgbnVsbCxcblx0XHRoYXNXZWJDbGllbnQ6IGJvb2xlYW4sXG5cdFx0c2VydmVyQmFzZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASVNlcnZlckVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElTZXJ2ZXJFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fd2ViRW5kcG9pbnRPcmlnaW5DaGVja2VyID0gV2ViRW5kcG9pbnRPcmlnaW5DaGVja2VyLmNyZWF0ZSh0aGlzLl9wcm9kdWN0U2VydmljZSk7XG5cblx0XHRpZiAoc2VydmVyQmFzZVBhdGggIT09IHVuZGVmaW5lZCAmJiBzZXJ2ZXJCYXNlUGF0aC5jaGFyQ29kZUF0KHNlcnZlckJhc2VQYXRoLmxlbmd0aCAtIDEpID09PSBDaGFyQ29kZS5TbGFzaCkge1xuXHRcdFx0Ly8gUmVtb3ZlIHRyYWlsaW5nIHNsYXNoIGZyb20gYmFzZSBwYXRoXG5cdFx0XHRzZXJ2ZXJCYXNlUGF0aCA9IHNlcnZlckJhc2VQYXRoLnN1YnN0cmluZygwLCBzZXJ2ZXJCYXNlUGF0aC5sZW5ndGggLSAxKTtcblx0XHR9XG5cdFx0dGhpcy5fc2VydmVyQmFzZVBhdGggPSBzZXJ2ZXJCYXNlUGF0aDsgLy8gdW5kZWZpbmVkIG9yIHN0YXJ0cyB3aXRoIGEgc2xhc2hcblx0XHR0aGlzLl9zZXJ2ZXJQcm9kdWN0UGF0aCA9IGAvJHtnZXRTZXJ2ZXJQcm9kdWN0U2VnbWVudChfcHJvZHVjdFNlcnZpY2UpfWA7IC8vIHN0YXJ0cyB3aXRoIGEgc2xhc2hcblx0XHR0aGlzLl9leHRIb3N0Q29ubmVjdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX21hbmFnZW1lbnRDb25uZWN0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy5fYWxsUmVjb25uZWN0aW9uVG9rZW5zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0dGhpcy5fd2ViQ2xpZW50U2VydmVyID0gKFxuXHRcdFx0aGFzV2ViQ2xpZW50XG5cdFx0XHRcdD8gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2ViQ2xpZW50U2VydmVyLCB0aGlzLl9jb25uZWN0aW9uVG9rZW4sIHNlcnZlckJhc2VQYXRoID8/ICcvJywgdGhpcy5fc2VydmVyUHJvZHVjdFBhdGgpXG5cdFx0XHRcdDogbnVsbFxuXHRcdCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb24gaG9zdCBhZ2VudCBzdGFydGVkLmApO1xuXG5cdFx0dGhpcy5fd2FpdFRoZW5TaHV0ZG93bih0cnVlKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBoYW5kbGVSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIE9ubHkgc2VydmUgR0VUIHJlcXVlc3RzXG5cdFx0aWYgKHJlcS5tZXRob2QgIT09ICdHRVQnKSB7XG5cdFx0XHRyZXR1cm4gc2VydmVFcnJvcihyZXEsIHJlcywgNDA1LCBgVW5zdXBwb3J0ZWQgbWV0aG9kICR7cmVxLm1ldGhvZH1gKTtcblx0XHR9XG5cblx0XHRpZiAoIXJlcS51cmwpIHtcblx0XHRcdHJldHVybiBzZXJ2ZUVycm9yKHJlcSwgcmVzLCA0MDAsIGBCYWQgcmVxdWVzdC5gKTtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UocmVxLnVybCwgdHJ1ZSk7XG5cdFx0bGV0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuXG5cdFx0aWYgKCFwYXRobmFtZSkge1xuXHRcdFx0cmV0dXJuIHNlcnZlRXJyb3IocmVxLCByZXMsIDQwMCwgYEJhZCByZXF1ZXN0LmApO1xuXHRcdH1cblxuXHRcdC8vIFNlcnZlIGZyb20gYm90aCAnLycgYW5kIHNlcnZlckJhc2VQYXRoXG5cdFx0aWYgKHRoaXMuX3NlcnZlckJhc2VQYXRoICE9PSB1bmRlZmluZWQgJiYgcGF0aG5hbWUuc3RhcnRzV2l0aCh0aGlzLl9zZXJ2ZXJCYXNlUGF0aCkpIHtcblx0XHRcdHBhdGhuYW1lID0gcGF0aG5hbWUuc3Vic3RyaW5nKHRoaXMuX3NlcnZlckJhc2VQYXRoLmxlbmd0aCkgfHwgJy8nO1xuXHRcdH1cblx0XHQvLyBmb3Igbm93IGFjY2VwdCBhbGwgcGF0aHMsIHdpdGggb3Igd2l0aG91dCBzZXJ2ZXIgcHJvZHVjdCBwYXRoXG5cdFx0aWYgKHBhdGhuYW1lLnN0YXJ0c1dpdGgodGhpcy5fc2VydmVyUHJvZHVjdFBhdGgpICYmIHBhdGhuYW1lLmNoYXJDb2RlQXQodGhpcy5fc2VydmVyUHJvZHVjdFBhdGgubGVuZ3RoKSA9PT0gQ2hhckNvZGUuU2xhc2gpIHtcblx0XHRcdHBhdGhuYW1lID0gcGF0aG5hbWUuc3Vic3RyaW5nKHRoaXMuX3NlcnZlclByb2R1Y3RQYXRoLmxlbmd0aCk7XG5cdFx0fVxuXG5cdFx0Ly8gVmVyc2lvblxuXHRcdGlmIChwYXRobmFtZSA9PT0gJy92ZXJzaW9uJykge1xuXHRcdFx0cmVzLndyaXRlSGVhZCgyMDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcblx0XHRcdHJldHVybiB2b2lkIHJlcy5lbmQodGhpcy5fcHJvZHVjdFNlcnZpY2UuY29tbWl0IHx8ICcnKTtcblx0XHR9XG5cblx0XHQvLyBEZWxheSBzaHV0ZG93blxuXHRcdGlmIChwYXRobmFtZSA9PT0gJy9kZWxheS1zaHV0ZG93bicpIHtcblx0XHRcdHRoaXMuX2RlbGF5U2h1dGRvd24oKTtcblx0XHRcdHJlcy53cml0ZUhlYWQoMjAwKTtcblx0XHRcdHJldHVybiB2b2lkIHJlcy5lbmQoJ09LJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFodHRwUmVxdWVzdEhhc1ZhbGlkQ29ubmVjdGlvblRva2VuKHRoaXMuX2Nvbm5lY3Rpb25Ub2tlbiwgcmVxLCBwYXJzZWRVcmwpKSB7XG5cdFx0XHQvLyBpbnZhbGlkIGNvbm5lY3Rpb24gdG9rZW5cblx0XHRcdHJldHVybiBzZXJ2ZUVycm9yKHJlcSwgcmVzLCA0MDMsIGBGb3JiaWRkZW4uYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHBhdGhuYW1lID09PSAnL3ZzY29kZS1yZW1vdGUtcmVzb3VyY2UnKSB7XG5cdFx0XHQvLyBIYW5kbGUgSFRUUCByZXF1ZXN0cyBmb3IgcmVzb3VyY2VzIHJlbmRlcmVkIGluIHRoZSByaWNoIGNsaWVudCAoaW1hZ2VzLCBmb250cywgZXRjLilcblx0XHRcdC8vIFRoZXNlIHJlc291cmNlcyBjb3VsZCBiZSBmaWxlcyBzaGlwcGVkIHdpdGggZXh0ZW5zaW9ucyBvciBldmVuIHdvcmtzcGFjZSBmaWxlcy5cblx0XHRcdGNvbnN0IGRlc2lyZWRQYXRoID0gcGFyc2VkVXJsLnF1ZXJ5WydwYXRoJ107XG5cdFx0XHRpZiAodHlwZW9mIGRlc2lyZWRQYXRoICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm4gc2VydmVFcnJvcihyZXEsIHJlcywgNDAwLCBgQmFkIHJlcXVlc3QuYCk7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBmaWxlUGF0aDogc3RyaW5nO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZmlsZVBhdGggPSBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiBkZXNpcmVkUGF0aCB9KS5mc1BhdGg7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0cmV0dXJuIHNlcnZlRXJyb3IocmVxLCByZXMsIDQwMCwgYEJhZCByZXF1ZXN0LmApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXNwb25zZUhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0aWYgKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0KSB7XG5cdFx0XHRcdGlmIChpc0VxdWFsT3JQYXJlbnQoZmlsZVBhdGgsIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5idWlsdGluRXh0ZW5zaW9uc1BhdGgsICFwbGF0Zm9ybS5pc0xpbnV4KVxuXHRcdFx0XHRcdHx8IGlzRXF1YWxPclBhcmVudChmaWxlUGF0aCwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvbnNQYXRoLCAhcGxhdGZvcm0uaXNMaW51eClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmVzcG9uc2VIZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAncHVibGljLCBtYXgtYWdlPTMxNTM2MDAwJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBBbGxvdyBjcm9zcyBvcmlnaW4gcmVxdWVzdHMgZnJvbSB0aGUgd2ViIHdvcmtlciBleHRlbnNpb24gaG9zdFxuXHRcdFx0cmVzcG9uc2VIZWFkZXJzWydWYXJ5J10gPSAnT3JpZ2luJztcblx0XHRcdGNvbnN0IHJlcXVlc3RPcmlnaW4gPSByZXEuaGVhZGVyc1snb3JpZ2luJ107XG5cdFx0XHRpZiAocmVxdWVzdE9yaWdpbiAmJiB0aGlzLl93ZWJFbmRwb2ludE9yaWdpbkNoZWNrZXIubWF0Y2hlcyhyZXF1ZXN0T3JpZ2luKSkge1xuXHRcdFx0XHRyZXNwb25zZUhlYWRlcnNbJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbiddID0gcmVxdWVzdE9yaWdpbjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzZXJ2ZUZpbGUoZmlsZVBhdGgsIENhY2hlQ29udHJvbC5FVEFHLCB0aGlzLl9sb2dTZXJ2aWNlLCByZXEsIHJlcywgcmVzcG9uc2VIZWFkZXJzKTtcblx0XHR9XG5cblx0XHQvLyB3b3JrYmVuY2ggd2ViIFVJXG5cdFx0aWYgKHRoaXMuX3dlYkNsaWVudFNlcnZlcikge1xuXHRcdFx0dGhpcy5fd2ViQ2xpZW50U2VydmVyLmhhbmRsZShyZXEsIHJlcywgcGFyc2VkVXJsLCBwYXRobmFtZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcblx0XHRyZXR1cm4gdm9pZCByZXMuZW5kKCdOb3QgZm91bmQnKTtcblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVVcGdyYWRlKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHNvY2tldDogbmV0LlNvY2tldCkge1xuXHRcdGxldCByZWNvbm5lY3Rpb25Ub2tlbiA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdGxldCBpc1JlY29ubmVjdGlvbiA9IGZhbHNlO1xuXHRcdGxldCBza2lwV2ViU29ja2V0RnJhbWVzID0gZmFsc2U7XG5cblx0XHRpZiAocmVxLnVybCkge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSB1cmwucGFyc2UocmVxLnVybCwgdHJ1ZSkucXVlcnk7XG5cdFx0XHRpZiAodHlwZW9mIHF1ZXJ5LnJlY29ubmVjdGlvblRva2VuID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbiA9IHF1ZXJ5LnJlY29ubmVjdGlvblRva2VuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHF1ZXJ5LnJlY29ubmVjdGlvbiA9PT0gJ3RydWUnKSB7XG5cdFx0XHRcdGlzUmVjb25uZWN0aW9uID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmIChxdWVyeS5za2lwV2ViU29ja2V0RnJhbWVzID09PSAndHJ1ZScpIHtcblx0XHRcdFx0c2tpcFdlYlNvY2tldEZyYW1lcyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJlcS5oZWFkZXJzWyd1cGdyYWRlJ10gPT09IHVuZGVmaW5lZCB8fCByZXEuaGVhZGVyc1sndXBncmFkZSddLnRvTG93ZXJDYXNlKCkgIT09ICd3ZWJzb2NrZXQnKSB7XG5cdFx0XHRzb2NrZXQuZW5kKCdIVFRQLzEuMSA0MDAgQmFkIFJlcXVlc3QnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjNjQ1NSNzZWN0aW9uLTRcblx0XHRjb25zdCByZXF1ZXN0Tm9uY2UgPSByZXEuaGVhZGVyc1snc2VjLXdlYnNvY2tldC1rZXknXTtcblx0XHRjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTEnKTsvLyBDb2RlUUwgW1NNMDQ1MTRdIFNIQTEgbXVzdCBiZSB1c2VkIGhlcmUgdG8gcmVzcGVjdCB0aGUgV2ViU29ja2V0IHByb3RvY29sIHNwZWNpZmljYXRpb25cblx0XHRoYXNoLnVwZGF0ZShyZXF1ZXN0Tm9uY2UgKyAnMjU4RUFGQTUtRTkxNC00N0RBLTk1Q0EtQzVBQjBEQzg1QjExJyk7XG5cdFx0Y29uc3QgcmVzcG9uc2VOb25jZSA9IGhhc2guZGlnZXN0KCdiYXNlNjQnKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlSGVhZGVycyA9IFtcblx0XHRcdGBIVFRQLzEuMSAxMDEgU3dpdGNoaW5nIFByb3RvY29sc2AsXG5cdFx0XHRgVXBncmFkZTogd2Vic29ja2V0YCxcblx0XHRcdGBDb25uZWN0aW9uOiBVcGdyYWRlYCxcblx0XHRcdGBTZWMtV2ViU29ja2V0LUFjY2VwdDogJHtyZXNwb25zZU5vbmNlfWBcblx0XHRdO1xuXG5cdFx0Ly8gU2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3NjkyI3BhZ2UtMTJcblx0XHRsZXQgcGVybWVzc2FnZURlZmxhdGUgPSBmYWxzZTtcblx0XHRpZiAoIXNraXBXZWJTb2NrZXRGcmFtZXMgJiYgIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWydkaXNhYmxlLXdlYnNvY2tldC1jb21wcmVzc2lvbiddICYmIHJlcS5oZWFkZXJzWydzZWMtd2Vic29ja2V0LWV4dGVuc2lvbnMnXSkge1xuXHRcdFx0Y29uc3Qgd2Vic29ja2V0RXh0ZW5zaW9uT3B0aW9ucyA9IEFycmF5LmlzQXJyYXkocmVxLmhlYWRlcnNbJ3NlYy13ZWJzb2NrZXQtZXh0ZW5zaW9ucyddKSA/IHJlcS5oZWFkZXJzWydzZWMtd2Vic29ja2V0LWV4dGVuc2lvbnMnXSA6IFtyZXEuaGVhZGVyc1snc2VjLXdlYnNvY2tldC1leHRlbnNpb25zJ11dO1xuXHRcdFx0Zm9yIChjb25zdCB3ZWJzb2NrZXRFeHRlbnNpb25PcHRpb24gb2Ygd2Vic29ja2V0RXh0ZW5zaW9uT3B0aW9ucykge1xuXHRcdFx0XHRpZiAoL1xcYigoc2VydmVyX21heF93aW5kb3dfYml0cyl8KHNlcnZlcl9ub19jb250ZXh0X3Rha2VvdmVyKXwoY2xpZW50X25vX2NvbnRleHRfdGFrZW92ZXIpKVxcYi8udGVzdCh3ZWJzb2NrZXRFeHRlbnNpb25PcHRpb24pKSB7XG5cdFx0XHRcdFx0Ly8gc29ycnksIHRoZSBzZXJ2ZXIgZG9lcyBub3Qgc3VwcG9ydCB6bGliIHBhcmFtZXRlciB0d2Vha3Ncblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoL1xcYihwZXJtZXNzYWdlLWRlZmxhdGUpXFxiLy50ZXN0KHdlYnNvY2tldEV4dGVuc2lvbk9wdGlvbikpIHtcblx0XHRcdFx0XHRwZXJtZXNzYWdlRGVmbGF0ZSA9IHRydWU7XG5cdFx0XHRcdFx0cmVzcG9uc2VIZWFkZXJzLnB1c2goYFNlYy1XZWJTb2NrZXQtRXh0ZW5zaW9uczogcGVybWVzc2FnZS1kZWZsYXRlYCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKC9cXGIoeC13ZWJraXQtZGVmbGF0ZS1mcmFtZSlcXGIvLnRlc3Qod2Vic29ja2V0RXh0ZW5zaW9uT3B0aW9uKSkge1xuXHRcdFx0XHRcdHBlcm1lc3NhZ2VEZWZsYXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXNwb25zZUhlYWRlcnMucHVzaChgU2VjLVdlYlNvY2tldC1FeHRlbnNpb25zOiB4LXdlYmtpdC1kZWZsYXRlLWZyYW1lYCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRzb2NrZXQud3JpdGUocmVzcG9uc2VIZWFkZXJzLmpvaW4oJ1xcclxcbicpICsgJ1xcclxcblxcclxcbicpO1xuXG5cdFx0Ly8gTmV2ZXIgdGltZW91dCB0aGlzIHNvY2tldCBkdWUgdG8gaW5hY3Rpdml0eSFcblx0XHRzb2NrZXQuc2V0VGltZW91dCgwKTtcblx0XHQvLyBEaXNhYmxlIE5hZ2xlJ3MgYWxnb3JpdGhtXG5cdFx0c29ja2V0LnNldE5vRGVsYXkodHJ1ZSk7XG5cdFx0Ly8gRmluYWxseSFcblxuXHRcdGlmIChza2lwV2ViU29ja2V0RnJhbWVzKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVXZWJTb2NrZXRDb25uZWN0aW9uKG5ldyBOb2RlU29ja2V0KHNvY2tldCwgYHNlcnZlci1jb25uZWN0aW9uLSR7cmVjb25uZWN0aW9uVG9rZW59YCksIGlzUmVjb25uZWN0aW9uLCByZWNvbm5lY3Rpb25Ub2tlbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2hhbmRsZVdlYlNvY2tldENvbm5lY3Rpb24obmV3IFdlYlNvY2tldE5vZGVTb2NrZXQobmV3IE5vZGVTb2NrZXQoc29ja2V0LCBgc2VydmVyLWNvbm5lY3Rpb24tJHtyZWNvbm5lY3Rpb25Ub2tlbn1gKSwgcGVybWVzc2FnZURlZmxhdGUsIG51bGwsIHRydWUpLCBpc1JlY29ubmVjdGlvbiwgcmVjb25uZWN0aW9uVG9rZW4pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVTZXJ2ZXJFcnJvcihlcnI6IEVycm9yKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgRXJyb3Igb2NjdXJyZWQgaW4gc2VydmVyYCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHR9XG5cblx0Ly8gRXZlbnR1YWxseSBjbGVhbnVwXG5cblx0cHJpdmF0ZSBfZ2V0UmVtb3RlQWRkcmVzcyhzb2NrZXQ6IE5vZGVTb2NrZXQgfCBXZWJTb2NrZXROb2RlU29ja2V0KTogc3RyaW5nIHtcblx0XHRsZXQgX3NvY2tldDogbmV0LlNvY2tldDtcblx0XHRpZiAoc29ja2V0IGluc3RhbmNlb2YgTm9kZVNvY2tldCkge1xuXHRcdFx0X3NvY2tldCA9IHNvY2tldC5zb2NrZXQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdF9zb2NrZXQgPSBzb2NrZXQuc29ja2V0LnNvY2tldDtcblx0XHR9XG5cdFx0cmV0dXJuIF9zb2NrZXQucmVtb3RlQWRkcmVzcyB8fCBgPHVua25vd24+YDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlamVjdFdlYlNvY2tldENvbm5lY3Rpb24obG9nUHJlZml4OiBzdHJpbmcsIHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wsIHJlYXNvbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc29ja2V0ID0gcHJvdG9jb2wuZ2V0U29ja2V0KCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgJHtsb2dQcmVmaXh9ICR7cmVhc29ufS5gKTtcblx0XHRjb25zdCBlcnJNZXNzYWdlOiBFcnJvck1lc3NhZ2UgPSB7XG5cdFx0XHR0eXBlOiAnZXJyb3InLFxuXHRcdFx0cmVhc29uOiByZWFzb25cblx0XHR9O1xuXHRcdHByb3RvY29sLnNlbmRDb250cm9sKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoZXJyTWVzc2FnZSkpKTtcblx0XHRwcm90b2NvbC5kaXNwb3NlKCk7XG5cdFx0YXdhaXQgc29ja2V0LmRyYWluKCk7XG5cdFx0c29ja2V0LmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOT1RFOiBBdm9pZCB1c2luZyBhd2FpdCBpbiB0aGlzIG1ldGhvZCFcblx0ICogVGhlIHByb2JsZW0gaXMgdGhhdCBhd2FpdCBpbnRyb2R1Y2VzIGEgcHJvY2Vzcy5uZXh0VGljayBkdWUgdG8gdGhlIGltcGxpY2l0IFByb21pc2UudGhlblxuXHQgKiBUaGlzIGNhbiBsZWFkIHRvIHNvbWUgYnl0ZXMgYmVpbmcgcmVjZWl2ZWQgYW5kIGludGVycHJldGVkIGFuZCBhIGNvbnRyb2wgbWVzc2FnZSBiZWluZyBlbWl0dGVkIGJlZm9yZSB0aGUgbmV4dCBsaXN0ZW5lciBoYXMgYSBjaGFuY2UgdG8gYmUgcmVnaXN0ZXJlZC5cblx0ICovXG5cdHByaXZhdGUgX2hhbmRsZVdlYlNvY2tldENvbm5lY3Rpb24oc29ja2V0OiBOb2RlU29ja2V0IHwgV2ViU29ja2V0Tm9kZVNvY2tldCwgaXNSZWNvbm5lY3Rpb246IGJvb2xlYW4sIHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCByZW1vdGVBZGRyZXNzID0gdGhpcy5fZ2V0UmVtb3RlQWRkcmVzcyhzb2NrZXQpO1xuXHRcdGNvbnN0IGxvZ1ByZWZpeCA9IGBbJHtyZW1vdGVBZGRyZXNzfV1bJHtyZWNvbm5lY3Rpb25Ub2tlbi5zdWJzdHIoMCwgOCl9XWA7XG5cdFx0Y29uc3QgcHJvdG9jb2wgPSBuZXcgUGVyc2lzdGVudFByb3RvY29sKHsgc29ja2V0IH0pO1xuXG5cdFx0Y29uc3QgdmFsaWRhdG9yID0gdGhpcy5fdnNkYU1vZCA/IG5ldyB0aGlzLl92c2RhTW9kLnZhbGlkYXRvcigpIDogbnVsbDtcblx0XHRjb25zdCBzaWduZXIgPSB0aGlzLl92c2RhTW9kID8gbmV3IHRoaXMuX3ZzZGFNb2Quc2lnbmVyKCkgOiBudWxsO1xuXG5cdFx0Y29uc3QgZW51bSBTdGF0ZSB7XG5cdFx0XHRXYWl0aW5nRm9yQXV0aCxcblx0XHRcdFdhaXRpbmdGb3JDb25uZWN0aW9uVHlwZSxcblx0XHRcdERvbmUsXG5cdFx0XHRFcnJvclxuXHRcdH1cblx0XHRsZXQgc3RhdGUgPSBTdGF0ZS5XYWl0aW5nRm9yQXV0aDtcblxuXHRcdGNvbnN0IHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24gPSAobXNnOiBzdHJpbmcpID0+IHtcblx0XHRcdHN0YXRlID0gU3RhdGUuRXJyb3I7XG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9yZWplY3RXZWJTb2NrZXRDb25uZWN0aW9uKGxvZ1ByZWZpeCwgcHJvdG9jb2wsIG1zZyk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyID0gcHJvdG9jb2wub25Db250cm9sTWVzc2FnZSgocmF3KSA9PiB7XG5cdFx0XHRpZiAoc3RhdGUgPT09IFN0YXRlLldhaXRpbmdGb3JBdXRoKSB7XG5cdFx0XHRcdGxldCBtc2cxOiBIYW5kc2hha2VNZXNzYWdlO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdG1zZzEgPSA8SGFuZHNoYWtlTWVzc2FnZT5KU09OLnBhcnNlKHJhdy50b1N0cmluZygpKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24oYE1hbGZvcm1lZCBmaXJzdCBtZXNzYWdlYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1zZzEudHlwZSAhPT0gJ2F1dGgnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24oYEludmFsaWQgZmlyc3QgbWVzc2FnZWApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX2Nvbm5lY3Rpb25Ub2tlbi50eXBlID09PSBTZXJ2ZXJDb25uZWN0aW9uVG9rZW5UeXBlLk1hbmRhdG9yeSAmJiAhdGhpcy5fY29ubmVjdGlvblRva2VuLnZhbGlkYXRlKG1zZzEuYXV0aCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0V2ViU29ja2V0Q29ubmVjdGlvbihgVW5hdXRob3JpemVkIGNsaWVudCByZWZ1c2VkOiBhdXRoIG1pc21hdGNoYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTZW5kIGBzaWduYCByZXF1ZXN0XG5cdFx0XHRcdGxldCBzaWduZWREYXRhID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0XHRcdGlmIChzaWduZXIpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0c2lnbmVkRGF0YSA9IHNpZ25lci5zaWduKG1zZzEuZGF0YSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRsZXQgc29tZVRleHQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHRcdFx0aWYgKHZhbGlkYXRvcikge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRzb21lVGV4dCA9IHZhbGlkYXRvci5jcmVhdGVOZXdNZXNzYWdlKHNvbWVUZXh0KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNpZ25SZXF1ZXN0OiBTaWduUmVxdWVzdCA9IHtcblx0XHRcdFx0XHR0eXBlOiAnc2lnbicsXG5cdFx0XHRcdFx0ZGF0YTogc29tZVRleHQsXG5cdFx0XHRcdFx0c2lnbmVkRGF0YTogc2lnbmVkRGF0YVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRwcm90b2NvbC5zZW5kQ29udHJvbChWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHNpZ25SZXF1ZXN0KSkpO1xuXG5cdFx0XHRcdHN0YXRlID0gU3RhdGUuV2FpdGluZ0ZvckNvbm5lY3Rpb25UeXBlO1xuXG5cdFx0XHR9IGVsc2UgaWYgKHN0YXRlID09PSBTdGF0ZS5XYWl0aW5nRm9yQ29ubmVjdGlvblR5cGUpIHtcblxuXHRcdFx0XHRsZXQgbXNnMjogSGFuZHNoYWtlTWVzc2FnZTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRtc2cyID0gPEhhbmRzaGFrZU1lc3NhZ2U+SlNPTi5wYXJzZShyYXcudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdHJldHVybiByZWplY3RXZWJTb2NrZXRDb25uZWN0aW9uKGBNYWxmb3JtZWQgc2Vjb25kIG1lc3NhZ2VgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobXNnMi50eXBlICE9PSAnY29ubmVjdGlvblR5cGUnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24oYEludmFsaWQgc2Vjb25kIG1lc3NhZ2VgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodHlwZW9mIG1zZzIuc2lnbmVkRGF0YSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0V2ViU29ja2V0Q29ubmVjdGlvbihgSW52YWxpZCBzZWNvbmQgbWVzc2FnZSBmaWVsZCB0eXBlYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZW5kZXJlckNvbW1pdCA9IG1zZzIuY29tbWl0O1xuXHRcdFx0XHRjb25zdCBteUNvbW1pdCA9IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmNvbW1pdDtcblx0XHRcdFx0aWYgKHJlbmRlcmVyQ29tbWl0ICYmIG15Q29tbWl0KSB7XG5cdFx0XHRcdFx0Ly8gUnVubmluZyBpbiB0aGUgYnVpbHQgdmVyc2lvbiB3aGVyZSBjb21taXRzIGFyZSBkZWZpbmVkXG5cdFx0XHRcdFx0aWYgKHJlbmRlcmVyQ29tbWl0ICE9PSBteUNvbW1pdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24oYENsaWVudCByZWZ1c2VkOiB2ZXJzaW9uIG1pc21hdGNoYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHZhbGlkID0gZmFsc2U7XG5cdFx0XHRcdGlmICghdmFsaWRhdG9yKSB7XG5cdFx0XHRcdFx0dmFsaWQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuX2Nvbm5lY3Rpb25Ub2tlbi52YWxpZGF0ZShtc2cyLnNpZ25lZERhdGEpKSB7XG5cdFx0XHRcdFx0Ly8gd2ViIGNsaWVudFxuXHRcdFx0XHRcdHZhbGlkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dmFsaWQgPSB2YWxpZGF0b3IudmFsaWRhdGUobXNnMi5zaWduZWREYXRhKSA9PT0gJ29rJztcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCF2YWxpZCkge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlamVjdFdlYlNvY2tldENvbm5lY3Rpb24oYFVuYXV0aG9yaXplZCBjbGllbnQgcmVmdXNlZGApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGAke2xvZ1ByZWZpeH0gVW5hdXRob3JpemVkIGNsaWVudCBoYW5kc2hha2UgZmFpbGVkIGJ1dCB3ZSBwcm9jZWVkIGJlY2F1c2Ugb2YgZGV2IG1vZGUuYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gV2UgaGF2ZSByZWNlaXZlZCBhIG5ldyBjb25uZWN0aW9uLlxuXHRcdFx0XHQvLyBUaGlzIGluZGljYXRlcyB0aGF0IHRoZSBzZXJ2ZXIgb3duZXIgaGFzIGNvbm5lY3Rpdml0eS5cblx0XHRcdFx0Ly8gVGhlcmVmb3JlIHdlIHdpbGwgc2hvcnRlbiB0aGUgcmVjb25uZWN0aW9uIGdyYWNlIHBlcmlvZCBmb3IgZGlzY29ubmVjdGVkIGNvbm5lY3Rpb25zIVxuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9tYW5hZ2VtZW50Q29ubmVjdGlvbnMpIHtcblx0XHRcdFx0XHRjb25zdCBtYW5hZ2VtZW50Q29ubmVjdGlvbiA9IHRoaXMuX21hbmFnZW1lbnRDb25uZWN0aW9uc1trZXldO1xuXHRcdFx0XHRcdG1hbmFnZW1lbnRDb25uZWN0aW9uLnNob3J0ZW5SZWNvbm5lY3Rpb25HcmFjZVRpbWVJZk5lY2Vzc2FyeSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2V4dEhvc3RDb25uZWN0aW9ucykge1xuXHRcdFx0XHRcdGNvbnN0IGV4dEhvc3RDb25uZWN0aW9uID0gdGhpcy5fZXh0SG9zdENvbm5lY3Rpb25zW2tleV07XG5cdFx0XHRcdFx0ZXh0SG9zdENvbm5lY3Rpb24uc2hvcnRlblJlY29ubmVjdGlvbkdyYWNlVGltZUlmTmVjZXNzYXJ5KCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzdGF0ZSA9IFN0YXRlLkRvbmU7XG5cdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5faGFuZGxlQ29ubmVjdGlvblR5cGUocmVtb3RlQWRkcmVzcywgbG9nUHJlZml4LCBwcm90b2NvbCwgc29ja2V0LCBpc1JlY29ubmVjdGlvbiwgcmVjb25uZWN0aW9uVG9rZW4sIG1zZzIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlQ29ubmVjdGlvblR5cGUocmVtb3RlQWRkcmVzczogc3RyaW5nLCBfbG9nUHJlZml4OiBzdHJpbmcsIHByb3RvY29sOiBQZXJzaXN0ZW50UHJvdG9jb2wsIHNvY2tldDogTm9kZVNvY2tldCB8IFdlYlNvY2tldE5vZGVTb2NrZXQsIGlzUmVjb25uZWN0aW9uOiBib29sZWFuLCByZWNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nLCBtc2c6IENvbm5lY3Rpb25UeXBlUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGxvZ1ByZWZpeCA9IChcblx0XHRcdG1zZy5kZXNpcmVkQ29ubmVjdGlvblR5cGUgPT09IENvbm5lY3Rpb25UeXBlLk1hbmFnZW1lbnRcblx0XHRcdFx0PyBgJHtfbG9nUHJlZml4fVtNYW5hZ2VtZW50Q29ubmVjdGlvbl1gXG5cdFx0XHRcdDogbXNnLmRlc2lyZWRDb25uZWN0aW9uVHlwZSA9PT0gQ29ubmVjdGlvblR5cGUuRXh0ZW5zaW9uSG9zdFxuXHRcdFx0XHRcdD8gYCR7X2xvZ1ByZWZpeH1bRXh0ZW5zaW9uSG9zdENvbm5lY3Rpb25dYFxuXHRcdFx0XHRcdDogX2xvZ1ByZWZpeFxuXHRcdCk7XG5cblx0XHRpZiAobXNnLmRlc2lyZWRDb25uZWN0aW9uVHlwZSA9PT0gQ29ubmVjdGlvblR5cGUuTWFuYWdlbWVudCkge1xuXHRcdFx0Ly8gVGhpcyBzaG91bGQgYmVjb21lIGEgbWFuYWdlbWVudCBjb25uZWN0aW9uXG5cblx0XHRcdGlmIChpc1JlY29ubmVjdGlvbikge1xuXHRcdFx0XHQvLyBUaGlzIGlzIGEgcmVjb25uZWN0aW9uXG5cdFx0XHRcdGlmICghdGhpcy5fbWFuYWdlbWVudENvbm5lY3Rpb25zW3JlY29ubmVjdGlvblRva2VuXSkge1xuXHRcdFx0XHRcdGlmICghdGhpcy5fYWxsUmVjb25uZWN0aW9uVG9rZW5zLmhhcyhyZWNvbm5lY3Rpb25Ub2tlbikpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgYW4gdW5rbm93biByZWNvbm5lY3Rpb24gdG9rZW5cblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9yZWplY3RXZWJTb2NrZXRDb25uZWN0aW9uKGxvZ1ByZWZpeCwgcHJvdG9jb2wsIGBVbmtub3duIHJlY29ubmVjdGlvbiB0b2tlbiAobmV2ZXIgc2VlbilgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBhIGNvbm5lY3Rpb24gdGhhdCB3YXMgc2VlbiBpbiB0aGUgcGFzdCwgYnV0IGlzIG5vIGxvbmdlciB2YWxpZFxuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3JlamVjdFdlYlNvY2tldENvbm5lY3Rpb24obG9nUHJlZml4LCBwcm90b2NvbCwgYFVua25vd24gcmVjb25uZWN0aW9uIHRva2VuIChzZWVuIGJlZm9yZSlgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcm90b2NvbC5zZW5kQ29udHJvbChWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ29rJyB9KSkpO1xuXHRcdFx0XHRjb25zdCBkYXRhQ2h1bmsgPSBwcm90b2NvbC5yZWFkRW50aXJlQnVmZmVyKCk7XG5cdFx0XHRcdHByb3RvY29sLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fbWFuYWdlbWVudENvbm5lY3Rpb25zW3JlY29ubmVjdGlvblRva2VuXS5hY2NlcHRSZWNvbm5lY3Rpb24ocmVtb3RlQWRkcmVzcywgc29ja2V0LCBkYXRhQ2h1bmspO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBUaGlzIGlzIGEgZnJlc2ggY29ubmVjdGlvblxuXHRcdFx0XHRpZiAodGhpcy5fbWFuYWdlbWVudENvbm5lY3Rpb25zW3JlY29ubmVjdGlvblRva2VuXSkge1xuXHRcdFx0XHRcdC8vIENhbm5vdCBoYXZlIHR3byBjb25jdXJyZW50IGNvbm5lY3Rpb25zIHVzaW5nIHRoZSBzYW1lIHJlY29ubmVjdGlvbiB0b2tlblxuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9yZWplY3RXZWJTb2NrZXRDb25uZWN0aW9uKGxvZ1ByZWZpeCwgcHJvdG9jb2wsIGBEdXBsaWNhdGUgcmVjb25uZWN0aW9uIHRva2VuYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcm90b2NvbC5zZW5kQ29udHJvbChWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ29rJyB9KSkpO1xuXHRcdFx0XHRjb25zdCBjb24gPSBuZXcgTWFuYWdlbWVudENvbm5lY3Rpb24odGhpcy5fbG9nU2VydmljZSwgcmVjb25uZWN0aW9uVG9rZW4sIHJlbW90ZUFkZHJlc3MsIHByb3RvY29sKTtcblx0XHRcdFx0dGhpcy5fc29ja2V0U2VydmVyLmFjY2VwdENvbm5lY3Rpb24oY29uLnByb3RvY29sLCBjb24ub25DbG9zZSk7XG5cdFx0XHRcdHRoaXMuX21hbmFnZW1lbnRDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl0gPSBjb247XG5cdFx0XHRcdHRoaXMuX2FsbFJlY29ubmVjdGlvblRva2Vucy5hZGQocmVjb25uZWN0aW9uVG9rZW4pO1xuXHRcdFx0XHRjb24ub25DbG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX21hbmFnZW1lbnRDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl07XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKG1zZy5kZXNpcmVkQ29ubmVjdGlvblR5cGUgPT09IENvbm5lY3Rpb25UeXBlLkV4dGVuc2lvbkhvc3QpIHtcblxuXHRcdFx0Ly8gVGhpcyBzaG91bGQgYmVjb21lIGFuIGV4dGVuc2lvbiBob3N0IGNvbm5lY3Rpb25cblx0XHRcdGNvbnN0IHN0YXJ0UGFyYW1zMCA9IDxJUmVtb3RlRXh0ZW5zaW9uSG9zdFN0YXJ0UGFyYW1zPm1zZy5hcmdzIHx8IHsgbGFuZ3VhZ2U6ICdlbicgfTtcblx0XHRcdGNvbnN0IHN0YXJ0UGFyYW1zID0gYXdhaXQgdGhpcy5fdXBkYXRlV2l0aEZyZWVEZWJ1Z1BvcnQoc3RhcnRQYXJhbXMwKTtcblxuXHRcdFx0aWYgKHN0YXJ0UGFyYW1zLnBvcnQpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgJHtsb2dQcmVmaXh9IC0gc3RhcnRQYXJhbXMgZGVidWcgcG9ydCAke3N0YXJ0UGFyYW1zLnBvcnR9YCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGAke2xvZ1ByZWZpeH0gLSBzdGFydFBhcmFtcyBsYW5ndWFnZTogJHtzdGFydFBhcmFtcy5sYW5ndWFnZX1gKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYCR7bG9nUHJlZml4fSAtIHN0YXJ0UGFyYW1zIGVudjogJHtKU09OLnN0cmluZ2lmeShzdGFydFBhcmFtcy5lbnYpfWApO1xuXG5cdFx0XHRpZiAoaXNSZWNvbm5lY3Rpb24pIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBhIHJlY29ubmVjdGlvblxuXHRcdFx0XHRpZiAoIXRoaXMuX2V4dEhvc3RDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl0pIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuX2FsbFJlY29ubmVjdGlvblRva2Vucy5oYXMocmVjb25uZWN0aW9uVG9rZW4pKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIGFuIHVua25vd24gcmVjb25uZWN0aW9uIHRva2VuXG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVqZWN0V2ViU29ja2V0Q29ubmVjdGlvbihsb2dQcmVmaXgsIHByb3RvY29sLCBgVW5rbm93biByZWNvbm5lY3Rpb24gdG9rZW4gKG5ldmVyIHNlZW4pYCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBjb25uZWN0aW9uIHRoYXQgd2FzIHNlZW4gaW4gdGhlIHBhc3QsIGJ1dCBpcyBubyBsb25nZXIgdmFsaWRcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9yZWplY3RXZWJTb2NrZXRDb25uZWN0aW9uKGxvZ1ByZWZpeCwgcHJvdG9jb2wsIGBVbmtub3duIHJlY29ubmVjdGlvbiB0b2tlbiAoc2VlbiBiZWZvcmUpYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJvdG9jb2wuc2VuZFBhdXNlKCk7XG5cdFx0XHRcdHByb3RvY29sLnNlbmRDb250cm9sKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoc3RhcnRQYXJhbXMucG9ydCA/IHsgZGVidWdQb3J0OiBzdGFydFBhcmFtcy5wb3J0IH0gOiB7fSkpKTtcblx0XHRcdFx0Y29uc3QgZGF0YUNodW5rID0gcHJvdG9jb2wucmVhZEVudGlyZUJ1ZmZlcigpO1xuXHRcdFx0XHRwcm90b2NvbC5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2V4dEhvc3RDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl0uYWNjZXB0UmVjb25uZWN0aW9uKHJlbW90ZUFkZHJlc3MsIHNvY2tldCwgZGF0YUNodW5rKTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBhIGZyZXNoIGNvbm5lY3Rpb25cblx0XHRcdFx0aWYgKHRoaXMuX2V4dEhvc3RDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl0pIHtcblx0XHRcdFx0XHQvLyBDYW5ub3QgaGF2ZSB0d28gY29uY3VycmVudCBjb25uZWN0aW9ucyB1c2luZyB0aGUgc2FtZSByZWNvbm5lY3Rpb24gdG9rZW5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVqZWN0V2ViU29ja2V0Q29ubmVjdGlvbihsb2dQcmVmaXgsIHByb3RvY29sLCBgRHVwbGljYXRlIHJlY29ubmVjdGlvbiB0b2tlbmApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJvdG9jb2wuc2VuZFBhdXNlKCk7XG5cdFx0XHRcdHByb3RvY29sLnNlbmRDb250cm9sKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoc3RhcnRQYXJhbXMucG9ydCA/IHsgZGVidWdQb3J0OiBzdGFydFBhcmFtcy5wb3J0IH0gOiB7fSkpKTtcblx0XHRcdFx0Y29uc3QgZGF0YUNodW5rID0gcHJvdG9jb2wucmVhZEVudGlyZUJ1ZmZlcigpO1xuXHRcdFx0XHRwcm90b2NvbC5kaXNwb3NlKCk7XG5cdFx0XHRcdGNvbnN0IGNvbiA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbkhvc3RDb25uZWN0aW9uLCByZWNvbm5lY3Rpb25Ub2tlbiwgcmVtb3RlQWRkcmVzcywgc29ja2V0LCBkYXRhQ2h1bmspO1xuXHRcdFx0XHR0aGlzLl9leHRIb3N0Q29ubmVjdGlvbnNbcmVjb25uZWN0aW9uVG9rZW5dID0gY29uO1xuXHRcdFx0XHR0aGlzLl9hbGxSZWNvbm5lY3Rpb25Ub2tlbnMuYWRkKHJlY29ubmVjdGlvblRva2VuKTtcblx0XHRcdFx0Y29uLm9uQ2xvc2UoKCkgPT4ge1xuXHRcdFx0XHRcdGNvbi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX2V4dEhvc3RDb25uZWN0aW9uc1tyZWNvbm5lY3Rpb25Ub2tlbl07XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDbG9zZUV4dEhvc3RDb25uZWN0aW9uKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb24uc3RhcnQoc3RhcnRQYXJhbXMpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIGlmIChtc2cuZGVzaXJlZENvbm5lY3Rpb25UeXBlID09PSBDb25uZWN0aW9uVHlwZS5UdW5uZWwpIHtcblxuXHRcdFx0Y29uc3QgdHVubmVsU3RhcnRQYXJhbXMgPSA8SVR1bm5lbENvbm5lY3Rpb25TdGFydFBhcmFtcz5tc2cuYXJncztcblx0XHRcdHRoaXMuX2NyZWF0ZVR1bm5lbChwcm90b2NvbCwgdHVubmVsU3RhcnRQYXJhbXMpO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0cmV0dXJuIHRoaXMuX3JlamVjdFdlYlNvY2tldENvbm5lY3Rpb24obG9nUHJlZml4LCBwcm90b2NvbCwgYFVua25vd24gaW5pdGlhbCBkYXRhIHJlY2VpdmVkYCk7XG5cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVUdW5uZWwocHJvdG9jb2w6IFBlcnNpc3RlbnRQcm90b2NvbCwgdHVubmVsU3RhcnRQYXJhbXM6IElUdW5uZWxDb25uZWN0aW9uU3RhcnRQYXJhbXMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZW1vdGVTb2NrZXQgPSAoPE5vZGVTb2NrZXQ+cHJvdG9jb2wuZ2V0U29ja2V0KCkpLnNvY2tldDtcblx0XHRjb25zdCBkYXRhQ2h1bmsgPSBwcm90b2NvbC5yZWFkRW50aXJlQnVmZmVyKCk7XG5cdFx0cHJvdG9jb2wuZGlzcG9zZSgpO1xuXG5cdFx0cmVtb3RlU29ja2V0LnBhdXNlKCk7XG5cdFx0Y29uc3QgbG9jYWxTb2NrZXQgPSBhd2FpdCB0aGlzLl9jb25uZWN0VHVubmVsU29ja2V0KHR1bm5lbFN0YXJ0UGFyYW1zLmhvc3QsIHR1bm5lbFN0YXJ0UGFyYW1zLnBvcnQpO1xuXG5cdFx0aWYgKGRhdGFDaHVuay5ieXRlTGVuZ3RoID4gMCkge1xuXHRcdFx0bG9jYWxTb2NrZXQud3JpdGUoZGF0YUNodW5rLmJ1ZmZlcik7XG5cdFx0fVxuXG5cdFx0bG9jYWxTb2NrZXQub24oJ2VuZCcsICgpID0+IHJlbW90ZVNvY2tldC5lbmQoKSk7XG5cdFx0bG9jYWxTb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4gcmVtb3RlU29ja2V0LmVuZCgpKTtcblx0XHRsb2NhbFNvY2tldC5vbignZXJyb3InLCAoKSA9PiByZW1vdGVTb2NrZXQuZGVzdHJveSgpKTtcblx0XHRyZW1vdGVTb2NrZXQub24oJ2VuZCcsICgpID0+IGxvY2FsU29ja2V0LmVuZCgpKTtcblx0XHRyZW1vdGVTb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4gbG9jYWxTb2NrZXQuZW5kKCkpO1xuXHRcdHJlbW90ZVNvY2tldC5vbignZXJyb3InLCAoKSA9PiBsb2NhbFNvY2tldC5kZXN0cm95KCkpO1xuXG5cdFx0bG9jYWxTb2NrZXQucGlwZShyZW1vdGVTb2NrZXQpO1xuXHRcdHJlbW90ZVNvY2tldC5waXBlKGxvY2FsU29ja2V0KTtcblx0fVxuXG5cdHByaXZhdGUgX2Nvbm5lY3RUdW5uZWxTb2NrZXQoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIpOiBQcm9taXNlPG5ldC5Tb2NrZXQ+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8bmV0LlNvY2tldD4oKGMsIGUpID0+IHtcblx0XHRcdGNvbnN0IHNvY2tldCA9IG5ldC5jcmVhdGVDb25uZWN0aW9uKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aG9zdDogaG9zdCxcblx0XHRcdFx0XHRwb3J0OiBwb3J0LFxuXHRcdFx0XHRcdGF1dG9TZWxlY3RGYW1pbHk6IHRydWVcblx0XHRcdFx0fSwgKCkgPT4ge1xuXHRcdFx0XHRcdHNvY2tldC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBlKTtcblx0XHRcdFx0XHRzb2NrZXQucGF1c2UoKTtcblx0XHRcdFx0XHRjKHNvY2tldCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdHNvY2tldC5vbmNlKCdlcnJvcicsIGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlV2l0aEZyZWVEZWJ1Z1BvcnQoc3RhcnRQYXJhbXM6IElSZW1vdGVFeHRlbnNpb25Ib3N0U3RhcnRQYXJhbXMpOiBUaGVuYWJsZTxJUmVtb3RlRXh0ZW5zaW9uSG9zdFN0YXJ0UGFyYW1zPiB7XG5cdFx0aWYgKHR5cGVvZiBzdGFydFBhcmFtcy5wb3J0ID09PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIGZpbmRGcmVlUG9ydChzdGFydFBhcmFtcy5wb3J0LCAxMCAvKiB0cnkgMTAgcG9ydHMgKi8sIDUwMDAgLyogdHJ5IHVwIHRvIDUgc2Vjb25kcyAqLykudGhlbihmcmVlUG9ydCA9PiB7XG5cdFx0XHRcdHN0YXJ0UGFyYW1zLnBvcnQgPSBmcmVlUG9ydDtcblx0XHRcdFx0cmV0dXJuIHN0YXJ0UGFyYW1zO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdC8vIE5vIHBvcnQgY2xlYXIgZGVidWcgY29uZmlndXJhdGlvbi5cblx0XHRzdGFydFBhcmFtcy5kZWJ1Z0lkID0gdW5kZWZpbmVkO1xuXHRcdHN0YXJ0UGFyYW1zLnBvcnQgPSB1bmRlZmluZWQ7XG5cdFx0c3RhcnRQYXJhbXMuYnJlYWsgPSB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShzdGFydFBhcmFtcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9vbkRpZENsb3NlRXh0SG9zdENvbm5lY3Rpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZW5hYmxlLXJlbW90ZS1hdXRvLXNodXRkb3duJ10pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jYW5jZWxTaHV0ZG93bigpO1xuXG5cdFx0Y29uc3QgaGFzQWN0aXZlRXh0SG9zdHMgPSAhIU9iamVjdC5rZXlzKHRoaXMuX2V4dEhvc3RDb25uZWN0aW9ucykubGVuZ3RoO1xuXHRcdGlmICghaGFzQWN0aXZlRXh0SG9zdHMpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdMYXN0IEVIIGNsb3NlZCwgd2FpdGluZyBiZWZvcmUgc2h1dHRpbmcgZG93bicpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKCdMYXN0IEVIIGNsb3NlZCwgd2FpdGluZyBiZWZvcmUgc2h1dHRpbmcgZG93bicpO1xuXHRcdFx0dGhpcy5fd2FpdFRoZW5TaHV0ZG93bigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3dhaXRUaGVuU2h1dGRvd24oaW5pdGlhbCA9IGZhbHNlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZW5hYmxlLXJlbW90ZS1hdXRvLXNodXRkb3duJ10pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ3JlbW90ZS1hdXRvLXNodXRkb3duLXdpdGhvdXQtZGVsYXknXSAmJiAhaW5pdGlhbCkge1xuXHRcdFx0dGhpcy5fc2h1dGRvd24oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zaHV0ZG93blRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2h1dGRvd25UaW1lciA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHR0aGlzLl9zaHV0ZG93bigpO1xuXHRcdFx0fSwgU0hVVERPV05fVElNRU9VVCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2h1dGRvd24oKTogdm9pZCB7XG5cdFx0Y29uc3QgaGFzQWN0aXZlRXh0SG9zdHMgPSAhIU9iamVjdC5rZXlzKHRoaXMuX2V4dEhvc3RDb25uZWN0aW9ucykubGVuZ3RoO1xuXHRcdGlmIChoYXNBY3RpdmVFeHRIb3N0cykge1xuXHRcdFx0Y29uc29sZS5sb2coJ05ldyBFSCBvcGVuZWQsIGFib3J0aW5nIHNodXRkb3duJyk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oJ05ldyBFSCBvcGVuZWQsIGFib3J0aW5nIHNodXRkb3duJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUubG9nKCdMYXN0IEVIIGNsb3NlZCwgc2h1dHRpbmcgZG93bicpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKCdMYXN0IEVIIGNsb3NlZCwgc2h1dHRpbmcgZG93bicpO1xuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHRwcm9jZXNzLmV4aXQoMCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIElmIHRoZSBzZXJ2ZXIgaXMgaW4gYSBzaHV0ZG93biB0aW1lb3V0LCBjYW5jZWwgaXQgYW5kIHN0YXJ0IG92ZXJcblx0ICovXG5cdHByaXZhdGUgX2RlbGF5U2h1dGRvd24oKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2h1dGRvd25UaW1lcikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0dvdCBkZWxheS1zaHV0ZG93biByZXF1ZXN0IHdoaWxlIGluIHNodXRkb3duIHRpbWVvdXQsIGRlbGF5aW5nJyk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oJ0dvdCBkZWxheS1zaHV0ZG93biByZXF1ZXN0IHdoaWxlIGluIHNodXRkb3duIHRpbWVvdXQsIGRlbGF5aW5nJyk7XG5cdFx0XHR0aGlzLl9jYW5jZWxTaHV0ZG93bigpO1xuXHRcdFx0dGhpcy5fd2FpdFRoZW5TaHV0ZG93bigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NhbmNlbFNodXRkb3duKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNodXRkb3duVGltZXIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdDYW5jZWxsaW5nIHByZXZpb3VzIHNodXRkb3duIHRpbWVvdXQnKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbygnQ2FuY2VsbGluZyBwcmV2aW91cyBzaHV0ZG93biB0aW1lb3V0Jyk7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5zaHV0ZG93blRpbWVyKTtcblx0XHRcdHRoaXMuc2h1dGRvd25UaW1lciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VydmVyQVBJIHtcblx0LyoqXG5cdCAqIERvIG5vdCByZW1vdmUhIS4gQ2FsbGVkIGZyb20gc2VydmVyLW1haW4uanNcblx0ICovXG5cdGhhbmRsZVJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPjtcblx0LyoqXG5cdCAqIERvIG5vdCByZW1vdmUhIS4gQ2FsbGVkIGZyb20gc2VydmVyLW1haW4uanNcblx0ICovXG5cdGhhbmRsZVVwZ3JhZGUocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgc29ja2V0OiBuZXQuU29ja2V0KTogdm9pZDtcblx0LyoqXG5cdCAqIERvIG5vdCByZW1vdmUhIS4gQ2FsbGVkIGZyb20gc2VydmVyLW1haW4uanNcblx0ICovXG5cdGhhbmRsZVNlcnZlckVycm9yKGVycjogRXJyb3IpOiB2b2lkO1xuXHQvKipcblx0ICogRG8gbm90IHJlbW92ZSEhLiBDYWxsZWQgZnJvbSBzZXJ2ZXItbWFpbi5qc1xuXHQgKi9cblx0ZGlzcG9zZSgpOiB2b2lkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2VydmVyKGFkZHJlc3M6IHN0cmluZyB8IG5ldC5BZGRyZXNzSW5mbyB8IG51bGwsIGFyZ3M6IFNlcnZlclBhcnNlZEFyZ3MsIFJFTU9URV9EQVRBX0ZPTERFUjogc3RyaW5nKTogUHJvbWlzZTxJU2VydmVyQVBJPiB7XG5cblx0Y29uc3QgY29ubmVjdGlvblRva2VuID0gYXdhaXQgZGV0ZXJtaW5lU2VydmVyQ29ubmVjdGlvblRva2VuKGFyZ3MpO1xuXHRpZiAoY29ubmVjdGlvblRva2VuIGluc3RhbmNlb2YgU2VydmVyQ29ubmVjdGlvblRva2VuUGFyc2VFcnJvcikge1xuXHRcdGNvbnNvbGUud2Fybihjb25uZWN0aW9uVG9rZW4ubWVzc2FnZSk7XG5cdFx0cHJvY2Vzcy5leGl0KDEpO1xuXHR9XG5cblx0Ly8gc2V0dGluZyB1cCBlcnJvciBoYW5kbGVycywgZmlyc3Qgd2l0aCBjb25zb2xlLmVycm9yLCB0aGVuLCBvbmNlIGF2YWlsYWJsZSwgdXNpbmcgdGhlIGxvZyBzZXJ2aWNlXG5cblx0ZnVuY3Rpb24gaW5pdFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoaGFuZGxlcjogKGVycjogYW55KSA9PiB2b2lkKSB7XG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlcnIgPT4ge1xuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlLXJlbW90ZS1yZWxlYXNlL2lzc3Vlcy82NDgxXG5cdFx0XHQvLyBJbiBzb21lIGNpcmN1bXN0YW5jZXMsIGNvbnNvbGUuZXJyb3Igd2lsbCB0aHJvdyBhbiBhc3luY2hyb25vdXMgZXJyb3IuIFRoaXMgYXN5bmNocm9ub3VzIGVycm9yXG5cdFx0XHQvLyB3aWxsIGVuZCB1cCBoZXJlLCBhbmQgdGhlbiBpdCB3aWxsIGJlIGxvZ2dlZCBhZ2FpbiwgdGh1cyBjcmVhdGluZyBhbiBlbmRsZXNzIGFzeW5jaHJvbm91cyBsb29wLlxuXHRcdFx0Ly8gSGVyZSB3ZSB0cnkgdG8gYnJlYWsgdGhlIGxvb3AgYnkgaWdub3JpbmcgRVBJUEUgZXJyb3JzIHRoYXQgaW5jbHVkZSBvdXIgb3duIHVuZXhwZWN0ZWQgZXJyb3IgaGFuZGxlciBpbiB0aGUgc3RhY2suXG5cdFx0XHRpZiAoaXNTaWdQaXBlRXJyb3IoZXJyKSAmJiBlcnIuc3RhY2sgJiYgL3VuZXhwZWN0ZWRFcnJvckhhbmRsZXIvLnRlc3QoZXJyLnN0YWNrKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRoYW5kbGVyKGVycik7XG5cdFx0fSk7XG5cdH1cblxuXHRjb25zdCB1bmxvZ2dlZEVycm9yczogYW55W10gPSBbXTtcblx0aW5pdFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKGVycm9yOiBhbnkpID0+IHtcblx0XHR1bmxvZ2dlZEVycm9ycy5wdXNoKGVycm9yKTtcblx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0fSk7XG5cdGxldCBkaWRMb2dBYm91dFNJR1BJUEUgPSBmYWxzZTtcblx0cHJvY2Vzcy5vbignU0lHUElQRScsICgpID0+IHtcblx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUtcmVtb3RlLXJlbGVhc2UvaXNzdWVzLzY1NDNcblx0XHQvLyBXZSB3b3VsZCBub3JtYWxseSBpbnN0YWxsIGEgU0lHUElQRSBsaXN0ZW5lciBpbiBib290c3RyYXAtbm9kZS5qc1xuXHRcdC8vIEJ1dCBpbiBjZXJ0YWluIHNpdHVhdGlvbnMsIHRoZSBjb25zb2xlIGl0c2VsZiBjYW4gYmUgaW4gYSBicm9rZW4gcGlwZSBzdGF0ZVxuXHRcdC8vIHNvIGxvZ2dpbmcgU0lHUElQRSB0byB0aGUgY29uc29sZSB3aWxsIGNhdXNlIGFuIGluZmluaXRlIGFzeW5jIGxvb3Bcblx0XHRpZiAoIWRpZExvZ0Fib3V0U0lHUElQRSkge1xuXHRcdFx0ZGlkTG9nQWJvdXRTSUdQSVBFID0gdHJ1ZTtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKG5ldyBFcnJvcihgVW5leHBlY3RlZCBTSUdQSVBFYCkpO1xuXHRcdH1cblx0fSk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IHsgc29ja2V0U2VydmVyLCBpbnN0YW50aWF0aW9uU2VydmljZSB9ID0gYXdhaXQgc2V0dXBTZXJ2ZXJTZXJ2aWNlcyhjb25uZWN0aW9uVG9rZW4sIGFyZ3MsIFJFTU9URV9EQVRBX0ZPTERFUiwgZGlzcG9zYWJsZXMpO1xuXG5cdC8vIFNldCB0aGUgdW5leHBlY3RlZCBlcnJvciBoYW5kbGVyIGFmdGVyIHRoZSBzZXJ2aWNlcyBoYXZlIGJlZW4gaW5pdGlhbGl6ZWQsIHRvIGF2b2lkIGhhdmluZ1xuXHQvLyB0aGUgdGVsZW1ldHJ5IHNlcnZpY2Ugb3ZlcndyaXRlIG91ciBoYW5kbGVyXG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdHVubG9nZ2VkRXJyb3JzLmZvckVhY2goZXJyb3IgPT4gbG9nU2VydmljZS5lcnJvcihlcnJvcikpO1xuXHRcdHVubG9nZ2VkRXJyb3JzLmxlbmd0aCA9IDA7XG5cblx0XHRpbml0VW5leHBlY3RlZEVycm9ySGFuZGxlcigoZXJyb3I6IGFueSkgPT4gbG9nU2VydmljZS5lcnJvcihlcnJvcikpO1xuXHR9KTtcblxuXHQvLyBPbiBXaW5kb3dzLCBjb25maWd1cmUgdGhlIFVOQyBhbGxvdyBsaXN0IGJhc2VkIG9uIHNldHRpbmdzXG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3NlY3VyaXR5LnJlc3RyaWN0VU5DQWNjZXNzJykgPT09IGZhbHNlKSB7XG5cdFx0XHRcdGRpc2FibGVVTkNBY2Nlc3NSZXN0cmljdGlvbnMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFkZFVOQ0hvc3RUb0FsbG93bGlzdChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnc2VjdXJpdHkuYWxsb3dlZFVOQ0hvc3RzJykpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Ly9cblx0Ly8gT24gV2luZG93cywgZXhpdCBlYXJseSB3aXRoIHdhcm5pbmcgbWVzc2FnZSB0byB1c2VycyBhYm91dCBwb3RlbnRpYWwgc2VjdXJpdHkgaXNzdWVcblx0Ly8gaWYgdGhlcmUgaXMgbm9kZV9tb2R1bGVzIGZvbGRlciB1bmRlciBob21lIGRyaXZlIG9yIFVzZXJzIGZvbGRlci5cblx0Ly9cblx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzICYmIHByb2Nlc3MuZW52LkhPTUVEUklWRSAmJiBwcm9jZXNzLmVudi5IT01FUEFUSCkge1xuXHRcdFx0Y29uc3QgaG9tZURpck1vZHVsZXNQYXRoID0gam9pbihwcm9jZXNzLmVudi5IT01FRFJJVkUsICdub2RlX21vZHVsZXMnKTtcblx0XHRcdGNvbnN0IHVzZXJEaXIgPSBkaXJuYW1lKGpvaW4ocHJvY2Vzcy5lbnYuSE9NRURSSVZFLCBwcm9jZXNzLmVudi5IT01FUEFUSCkpO1xuXHRcdFx0Y29uc3QgdXNlckRpck1vZHVsZXNQYXRoID0gam9pbih1c2VyRGlyLCAnbm9kZV9tb2R1bGVzJyk7XG5cdFx0XHRpZiAoZnMuZXhpc3RzU3luYyhob21lRGlyTW9kdWxlc1BhdGgpIHx8IGZzLmV4aXN0c1N5bmModXNlckRpck1vZHVsZXNQYXRoKSkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gYFxuXG4qXG4qICEhISEgU2VydmVyIHRlcm1pbmF0ZWQgZHVlIHRvIHByZXNlbmNlIG9mIENWRS0yMDIwLTE0MTYgISEhIVxuKlxuKiBQbGVhc2UgcmVtb3ZlIHRoZSBmb2xsb3dpbmcgZGlyZWN0b3JpZXMgYW5kIHJlLXRyeVxuKiAke2hvbWVEaXJNb2R1bGVzUGF0aH1cbiogJHt1c2VyRGlyTW9kdWxlc1BhdGh9XG4qXG4qIEZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZSB2dWxuZXJhYmlsaXR5IGh0dHBzOi8vY3ZlLm1pdHJlLm9yZy9jZ2ktYmluL2N2ZW5hbWUuY2dpP25hbWU9Q1ZFLTIwMjAtMTQxNlxuKlxuXG5gO1xuXHRcdFx0XHRsb2dTZXJ2aWNlLndhcm4obWVzc2FnZSk7XG5cdFx0XHRcdGNvbnNvbGUud2FybihtZXNzYWdlKTtcblx0XHRcdFx0cHJvY2Vzcy5leGl0KDApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Y29uc3QgdnNkYU1vZCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGhhc1ZTREEgPSBmcy5leGlzdHNTeW5jKGpvaW4oRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJycpLmZzUGF0aCwgJy4uL25vZGVfbW9kdWxlcy92c2RhJykpO1xuXHRcdGlmIChoYXNWU0RBKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gcmVxdWlyZSgndnNkYScpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0pO1xuXG5cdGxldCBzZXJ2ZXJCYXNlUGF0aCA9IGFyZ3NbJ3NlcnZlci1iYXNlLXBhdGgnXTtcblx0aWYgKHNlcnZlckJhc2VQYXRoICYmICFzZXJ2ZXJCYXNlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcblx0XHRzZXJ2ZXJCYXNlUGF0aCA9IGAvJHtzZXJ2ZXJCYXNlUGF0aH1gO1xuXHR9XG5cblx0Y29uc3QgaGFzV2ViQ2xpZW50ID0gZnMuZXhpc3RzU3luYyhGaWxlQWNjZXNzLmFzRmlsZVVyaShgdnMvY29kZS9icm93c2VyL3dvcmtiZW5jaC93b3JrYmVuY2guaHRtbGApLmZzUGF0aCk7XG5cblx0aWYgKGhhc1dlYkNsaWVudCAmJiBhZGRyZXNzICYmIHR5cGVvZiBhZGRyZXNzICE9PSAnc3RyaW5nJykge1xuXHRcdC8vIHNoaXBzIHRoZSB3ZWIgdWkhXG5cdFx0Y29uc3QgcXVlcnlQYXJ0ID0gKGNvbm5lY3Rpb25Ub2tlbi50eXBlICE9PSBTZXJ2ZXJDb25uZWN0aW9uVG9rZW5UeXBlLk5vbmUgPyBgPyR7Y29ubmVjdGlvblRva2VuUXVlcnlOYW1lfT0ke2Nvbm5lY3Rpb25Ub2tlbi52YWx1ZX1gIDogJycpO1xuXHRcdGNvbnNvbGUubG9nKGBXZWIgVUkgYXZhaWxhYmxlIGF0IGh0dHA6Ly9sb2NhbGhvc3Qke2FkZHJlc3MucG9ydCA9PT0gODAgPyAnJyA6IGA6JHthZGRyZXNzLnBvcnR9YH0ke3NlcnZlckJhc2VQYXRoID8/ICcnfSR7cXVlcnlQYXJ0fWApO1xuXHR9XG5cblx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50U2VydmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50U2VydmVyLCBzb2NrZXRTZXJ2ZXIsIGNvbm5lY3Rpb25Ub2tlbiwgdnNkYU1vZCwgaGFzV2ViQ2xpZW50LCBzZXJ2ZXJCYXNlUGF0aCk7XG5cblx0cGVyZi5tYXJrKCdjb2RlL3NlcnZlci9yZWFkeScpO1xuXHRjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHRjb25zdCB2c2NvZGVTZXJ2ZXJTdGFydFRpbWU6IG51bWJlciA9ICg8YW55Pmdsb2JhbCkudnNjb2RlU2VydmVyU3RhcnRUaW1lO1xuXHRjb25zdCB2c2NvZGVTZXJ2ZXJMaXN0ZW5UaW1lOiBudW1iZXIgPSAoPGFueT5nbG9iYWwpLnZzY29kZVNlcnZlckxpc3RlblRpbWU7XG5cdGNvbnN0IHZzY29kZVNlcnZlckNvZGVMb2FkZWRUaW1lOiBudW1iZXIgPSAoPGFueT5nbG9iYWwpLnZzY29kZVNlcnZlckNvZGVMb2FkZWRUaW1lO1xuXG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFzeW5jIChhY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IHRlbGVtZXRyeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0dHlwZSBTZXJ2ZXJTdGFydENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdhbGV4ZGltYSc7XG5cdFx0XHRjb21tZW50OiAnVGhlIHNlcnZlciBoYXMgc3RhcnRlZCB1cCc7XG5cdFx0XHRzdGFydFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdGltZSB0aGUgc2VydmVyIHN0YXJ0ZWQgYXQuJyB9O1xuXHRcdFx0c3RhcnRlZFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdGltZSB0aGUgc2VydmVyIGJlZ2FuIGxpc3RlbmluZyBmb3IgY29ubmVjdGlvbnMuJyB9O1xuXHRcdFx0Y29kZUxvYWRlZFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdGltZSB3aGljaCB0aGUgY29kZSBsb2FkZWQgb24gdGhlIHNlcnZlcicgfTtcblx0XHRcdHJlYWR5VGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB0aW1lIHdoZW4gdGhlIHNlcnZlciB3YXMgY29tcGxldGVseSByZWFkeScgfTtcblx0XHR9O1xuXHRcdHR5cGUgU2VydmVyU3RhcnRFdmVudCA9IHtcblx0XHRcdHN0YXJ0VGltZTogbnVtYmVyO1xuXHRcdFx0c3RhcnRlZFRpbWU6IG51bWJlcjtcblx0XHRcdGNvZGVMb2FkZWRUaW1lOiBudW1iZXI7XG5cdFx0XHRyZWFkeVRpbWU6IG51bWJlcjtcblx0XHR9O1xuXHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTZXJ2ZXJTdGFydEV2ZW50LCBTZXJ2ZXJTdGFydENsYXNzaWZpY2F0aW9uPignc2VydmVyU3RhcnQnLCB7XG5cdFx0XHRzdGFydFRpbWU6IHZzY29kZVNlcnZlclN0YXJ0VGltZSxcblx0XHRcdHN0YXJ0ZWRUaW1lOiB2c2NvZGVTZXJ2ZXJMaXN0ZW5UaW1lLFxuXHRcdFx0Y29kZUxvYWRlZFRpbWU6IHZzY29kZVNlcnZlckNvZGVMb2FkZWRUaW1lLFxuXHRcdFx0cmVhZHlUaW1lOiBjdXJyZW50VGltZVxuXHRcdH0pO1xuXG5cdFx0aWYgKHBsYXRmb3JtLmlzTGludXgpIHtcblx0XHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVsZWFzZUluZm8gPSBhd2FpdCBnZXRPU1JlbGVhc2VJbmZvKGxvZ1NlcnZpY2UuZXJyb3IuYmluZChsb2dTZXJ2aWNlKSk7XG5cdFx0XHRpZiAocmVsZWFzZUluZm8pIHtcblx0XHRcdFx0dHlwZSBTZXJ2ZXJQbGF0Zm9ybUluZm9DbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0XHRwbGF0Zm9ybUlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQSBzdHJpbmcgaWRlbnRpZnlpbmcgdGhlIG9wZXJhdGluZyBzeXN0ZW0gd2l0aG91dCBhbnkgdmVyc2lvbiBpbmZvcm1hdGlvbi4nIH07XG5cdFx0XHRcdFx0cGxhdGZvcm1WZXJzaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdBIHN0cmluZyBpZGVudGlmeWluZyB0aGUgb3BlcmF0aW5nIHN5c3RlbSB2ZXJzaW9uIGV4Y2x1ZGluZyBhbnkgbmFtZSBpbmZvcm1hdGlvbiBvciByZWxlYXNlIGNvZGUuJyB9O1xuXHRcdFx0XHRcdHBsYXRmb3JtSWRMaWtlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQSBzdHJpbmcgaWRlbnRpZnlpbmcgdGhlIG9wZXJhdGluZyBzeXN0ZW0gdGhlIGN1cnJlbnQgT1MgZGVyaXZhdGUgaXMgY2xvc2VseSByZWxhdGVkIHRvLicgfTtcblx0XHRcdFx0XHRvd25lcjogJ2RlZXBhazE1NTYnO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdQcm92aWRlcyBpbnNpZ2h0IGludG8gdGhlIGRpc3RybyBpbmZvcm1hdGlvbiBvbiBMaW51eC4nO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0eXBlIFNlcnZlclBsYXRmb3JtSW5mb0V2ZW50ID0ge1xuXHRcdFx0XHRcdHBsYXRmb3JtSWQ6IHN0cmluZztcblx0XHRcdFx0XHRwbGF0Zm9ybVZlcnNpb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHBsYXRmb3JtSWRMaWtlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTZXJ2ZXJQbGF0Zm9ybUluZm9FdmVudCwgU2VydmVyUGxhdGZvcm1JbmZvQ2xhc3NpZmljYXRpb24+KCdzZXJ2ZXJQbGF0Zm9ybUluZm8nLCB7XG5cdFx0XHRcdFx0cGxhdGZvcm1JZDogcmVsZWFzZUluZm8uaWQsXG5cdFx0XHRcdFx0cGxhdGZvcm1WZXJzaW9uSWQ6IHJlbGVhc2VJbmZvLnZlcnNpb25faWQsXG5cdFx0XHRcdFx0cGxhdGZvcm1JZExpa2U6IHJlbGVhc2VJbmZvLmlkX2xpa2Vcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRpZiAoYXJnc1sncHJpbnQtc3RhcnR1cC1wZXJmb3JtYW5jZSddKSB7XG5cdFx0bGV0IG91dHB1dCA9ICcnO1xuXHRcdG91dHB1dCArPSBgU3RhcnQtdXAgdGltZTogJHt2c2NvZGVTZXJ2ZXJMaXN0ZW5UaW1lIC0gdnNjb2RlU2VydmVyU3RhcnRUaW1lfVxcbmA7XG5cdFx0b3V0cHV0ICs9IGBDb2RlIGxvYWRpbmcgdGltZTogJHt2c2NvZGVTZXJ2ZXJDb2RlTG9hZGVkVGltZSAtIHZzY29kZVNlcnZlclN0YXJ0VGltZX1cXG5gO1xuXHRcdG91dHB1dCArPSBgSW5pdGlhbGl6ZWQgdGltZTogJHtjdXJyZW50VGltZSAtIHZzY29kZVNlcnZlclN0YXJ0VGltZX1cXG5gO1xuXHRcdG91dHB1dCArPSBgXFxuYDtcblx0XHRjb25zb2xlLmxvZyhvdXRwdXQpO1xuXHR9XG5cdHJldHVybiByZW1vdGVFeHRlbnNpb25Ib3N0QWdlbnRTZXJ2ZXI7XG59XG5cbmNsYXNzIFdlYkVuZHBvaW50T3JpZ2luQ2hlY2tlciB7XG5cblx0cHVibGljIHN0YXRpYyBjcmVhdGUocHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSk6IFdlYkVuZHBvaW50T3JpZ2luQ2hlY2tlciB7XG5cdFx0Y29uc3Qgd2ViRW5kcG9pbnRVcmxUZW1wbGF0ZSA9IHByb2R1Y3RTZXJ2aWNlLndlYkVuZHBvaW50VXJsVGVtcGxhdGU7XG5cdFx0Y29uc3QgY29tbWl0ID0gcHJvZHVjdFNlcnZpY2UuY29tbWl0O1xuXHRcdGNvbnN0IHF1YWxpdHkgPSBwcm9kdWN0U2VydmljZS5xdWFsaXR5O1xuXHRcdGlmICghd2ViRW5kcG9pbnRVcmxUZW1wbGF0ZSB8fCAhY29tbWl0IHx8ICFxdWFsaXR5KSB7XG5cdFx0XHRyZXR1cm4gbmV3IFdlYkVuZHBvaW50T3JpZ2luQ2hlY2tlcihudWxsKTtcblx0XHR9XG5cblx0XHRjb25zdCB1dWlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0Y29uc3QgZXhhbXBsZVVybCA9IG5ldyBVUkwoXG5cdFx0XHR3ZWJFbmRwb2ludFVybFRlbXBsYXRlXG5cdFx0XHRcdC5yZXBsYWNlKCd7e3V1aWR9fScsIHV1aWQpXG5cdFx0XHRcdC5yZXBsYWNlKCd7e2NvbW1pdH19JywgY29tbWl0KVxuXHRcdFx0XHQucmVwbGFjZSgne3txdWFsaXR5fX0nLCBxdWFsaXR5KVxuXHRcdCk7XG5cdFx0Y29uc3QgZXhhbXBsZU9yaWdpbiA9IGV4YW1wbGVVcmwub3JpZ2luO1xuXHRcdGNvbnN0IG9yaWdpblJlZ0V4cFNvdXJjZSA9IChcblx0XHRcdGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMoZXhhbXBsZU9yaWdpbilcblx0XHRcdFx0LnJlcGxhY2UodXVpZCwgJ1thLXpBLVowLTlcXFxcLV0rJylcblx0XHQpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBvcmlnaW5SZWdFeHAgPSBjcmVhdGVSZWdFeHAoYF4ke29yaWdpblJlZ0V4cFNvdXJjZX0kYCwgdHJ1ZSwgeyBtYXRjaENhc2U6IGZhbHNlIH0pO1xuXHRcdFx0cmV0dXJuIG5ldyBXZWJFbmRwb2ludE9yaWdpbkNoZWNrZXIob3JpZ2luUmVnRXhwKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHJldHVybiBuZXcgV2ViRW5kcG9pbnRPcmlnaW5DaGVja2VyKG51bGwpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29yaWdpblJlZ0V4cDogUmVnRXhwIHwgbnVsbFxuXHQpIHsgfVxuXG5cdHB1YmxpYyBtYXRjaGVzKG9yaWdpbjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9vcmlnaW5SZWdFeHApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX29yaWdpblJlZ0V4cC50ZXN0KG9yaWdpbik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxZQUFZO0FBQ3hCLFlBQVksUUFBUTtBQUVwQixZQUFZLFNBQVM7QUFDckIsU0FBUyxtQkFBbUI7QUFDNUIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCLG1CQUFtQixpQ0FBaUM7QUFDN0UsU0FBUyx1QkFB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QUFBLE1BQ3ZGLFdBQVc7QUFBQSxNQUNYLGFBQWE7QUFBQSxNQUNiLGdCQUFnQjtBQUFBLE1BQ2hCLFdBQVc7QUFBQSxJQUNaLENBQUM7QUFFRCxRQUFJLFNBQVMsU0FBUztBQUNyQixZQUFNLGFBQWEsU0FBUyxJQUFJLFdBQVc7QUFDM0MsWUFBTSxjQUFjLE1BQU0saUJBQWlCLFdBQVcsTUFBTSxLQUFLLFVBQVUsQ0FBQztBQUM1RSxVQUFJLGFBQWE7QUFhaEIseUJBQWlCLFdBQXNFLHNCQUFzQjtBQUFBLFVBQzVHLFlBQVksWUFBWTtBQUFBLFVBQ3hCLG1CQUFtQixZQUFZO0FBQUEsVUFDL0IsZ0JBQWdCLFlBQVk7QUFBQSxRQUM3QixDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxNQUFJLEtBQUssMkJBQTJCLEdBQUc7QUFDdEMsUUFBSSxTQUFTO0FBQ2IsY0FBVSxrQkFBa0IseUJBQXlCLHFCQUFxQjtBQUFBO0FBQzFFLGNBQVUsc0JBQXNCLDZCQUE2QixxQkFBcUI7QUFBQTtBQUNsRixjQUFVLHFCQUFxQixjQUFjLHFCQUFxQjtBQUFBO0FBQ2xFLGNBQVU7QUFBQTtBQUNWLFlBQVEsSUFBSSxNQUFNO0FBQUEsRUFDbkI7QUFDQSxTQUFPO0FBQ1I7QUFFQSxNQUFNLHlCQUF5QjtBQUFBLEVBOEI5QixZQUNrQixlQUNoQjtBQURnQjtBQUFBLEVBQ2Q7QUFBQSxFQTlCSixPQUFjLE9BQU8sZ0JBQTJEO0FBQy9FLFVBQU0seUJBQXlCLGVBQWU7QUFDOUMsVUFBTSxTQUFTLGVBQWU7QUFDOUIsVUFBTSxVQUFVLGVBQWU7QUFDL0IsUUFBSSxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxTQUFTO0FBQ25ELGFBQU8sSUFBSSx5QkFBeUIsSUFBSTtBQUFBLElBQ3pDO0FBRUEsVUFBTSxPQUFPLGFBQWE7QUFDMUIsVUFBTSxhQUFhLElBQUk7QUFBQSxNQUN0Qix1QkFDRSxRQUFRLFlBQVksSUFBSSxFQUN4QixRQUFRLGNBQWMsTUFBTSxFQUM1QixRQUFRLGVBQWUsT0FBTztBQUFBLElBQ2pDO0FBQ0EsVUFBTSxnQkFBZ0IsV0FBVztBQUNqQyxVQUFNLHFCQUNMLHVCQUF1QixhQUFhLEVBQ2xDLFFBQVEsTUFBTSxpQkFBaUI7QUFFbEMsUUFBSTtBQUNILFlBQU0sZUFBZSxhQUFhLElBQUksa0JBQWtCLEtBQUssTUFBTSxFQUFFLFdBQVcsTUFBTSxDQUFDO0FBQ3ZGLGFBQU8sSUFBSSx5QkFBeUIsWUFBWTtBQUFBLElBQ2pELFNBQVMsS0FBSztBQUNiLGFBQU8sSUFBSSx5QkFBeUIsSUFBSTtBQUFBLElBQ3pDO0FBQUEsRUFDRDtBQUFBLEVBTU8sUUFBUSxRQUF5QjtBQUN2QyxRQUFJLENBQUMsS0FBSyxlQUFlO0FBQ3hCLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxLQUFLLGNBQWMsS0FBSyxNQUFNO0FBQUEsRUFDdEM7QUFDRDsiLAogICJuYW1lcyI6IFsicmVxdWlyZSIsICJTdGF0ZSJdCn0K
