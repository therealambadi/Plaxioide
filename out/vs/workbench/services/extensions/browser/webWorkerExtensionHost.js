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
import * as dom from "../../../../base/browser/dom.js";
import { parentOriginHash } from "../../../../base/browser/iframe.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Barrier } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { canceled, onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { COI, FileAccess } from "../../../../base/common/network.js";
import * as platform from "../../../../base/common/platform.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { getNLSLanguage, getNLSMessages } from "../../../../nls.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { ILogService, ILoggerService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isLoggingOnly } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { ExtensionHostExitCode, MessageType, UIKind, createMessageOfType, isMessageOfType } from "../common/extensionHostProtocol.js";
import { ExtensionHostStartup } from "../common/extensions.js";
let WebWorkerExtensionHost = class extends Disposable {
  constructor(runningLocation, startup, _initDataProvider, _telemetryService, _contextService, _labelService, _logService, _loggerService, _environmentService, _userDataProfilesService, _productService, _layoutService, _storageService) {
    super();
    this.runningLocation = runningLocation;
    this.startup = startup;
    this._initDataProvider = _initDataProvider;
    this._telemetryService = _telemetryService;
    this._contextService = _contextService;
    this._labelService = _labelService;
    this._logService = _logService;
    this._loggerService = _loggerService;
    this._environmentService = _environmentService;
    this._userDataProfilesService = _userDataProfilesService;
    this._productService = _productService;
    this._layoutService = _layoutService;
    this._storageService = _storageService;
    this.pid = null;
    this.remoteAuthority = null;
    this.extensions = null;
    this._onDidExit = this._register(new Emitter());
    this.onExit = this._onDidExit.event;
    this._isTerminating = false;
    this._protocolPromise = null;
    this._protocol = null;
    this._extensionHostLogsLocation = joinPath(this._environmentService.extHostLogsPath, "webWorker");
  }
  async _getWebWorkerExtensionHostIframeSrc() {
    const suffixSearchParams = new URLSearchParams();
    if (this._environmentService.debugExtensionHost && this._environmentService.debugRenderer) {
      suffixSearchParams.set("debugged", "1");
    }
    COI.addSearchParam(suffixSearchParams, true, true);
    const suffix = `?${suffixSearchParams.toString()}`;
    const iframeModulePath = `vs/workbench/services/extensions/worker/webWorkerExtensionHostIframe.html`;
    if (platform.isWeb) {
      const webEndpointUrlTemplate = this._productService.webEndpointUrlTemplate;
      const commit = this._productService.commit;
      const quality = this._productService.quality;
      if (webEndpointUrlTemplate && commit && quality) {
        const key = "webWorkerExtensionHostIframeStableOriginUUID";
        let stableOriginUUID = this._storageService.get(key, StorageScope.WORKSPACE);
        if (typeof stableOriginUUID === "undefined") {
          stableOriginUUID = generateUuid();
          this._storageService.store(key, stableOriginUUID, StorageScope.WORKSPACE, StorageTarget.MACHINE);
        }
        const hash = await parentOriginHash(mainWindow.origin, stableOriginUUID);
        const baseUrl = webEndpointUrlTemplate.replace("{{uuid}}", `v--${hash}`).replace("{{commit}}", commit).replace("{{quality}}", quality);
        const res = new URL(`${baseUrl}/out/${iframeModulePath}${suffix}`);
        res.searchParams.set("parentOrigin", mainWindow.origin);
        res.searchParams.set("salt", stableOriginUUID);
        return res.toString();
      }
      console.warn(`The web worker extension host is started in a same-origin iframe!`);
    }
    const relativeExtensionHostIframeSrc = FileAccess.asBrowserUri(iframeModulePath);
    return `${relativeExtensionHostIframeSrc.toString(true)}${suffix}`;
  }
  async start() {
    if (!this._protocolPromise) {
      this._protocolPromise = this._startInsideIframe();
      this._protocolPromise.then((protocol) => this._protocol = protocol);
    }
    return this._protocolPromise;
  }
  async _startInsideIframe() {
    const webWorkerExtensionHostIframeSrc = await this._getWebWorkerExtensionHostIframeSrc();
    const emitter = this._register(new Emitter());
    const iframe = document.createElement("iframe");
    iframe.setAttribute("class", "web-worker-ext-host-iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.setAttribute("allow", "usb; serial; hid; cross-origin-isolated;");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.display = "none";
    const vscodeWebWorkerExtHostId = generateUuid();
    iframe.setAttribute("src", `${webWorkerExtensionHostIframeSrc}&vscodeWebWorkerExtHostId=${vscodeWebWorkerExtHostId}`);
    const barrier = new Barrier();
    let port;
    let barrierError = null;
    let barrierHasError = false;
    let startTimeout = null;
    const rejectBarrier = (exitCode, error) => {
      barrierError = error;
      barrierHasError = true;
      onUnexpectedError(barrierError);
      clearTimeout(startTimeout);
      this._onDidExit.fire([ExtensionHostExitCode.UnexpectedError, barrierError.message]);
      barrier.open();
    };
    const resolveBarrier = (messagePort) => {
      port = messagePort;
      clearTimeout(startTimeout);
      barrier.open();
    };
    startTimeout = setTimeout(() => {
      console.warn(`The Web Worker Extension Host did not start in 60s, that might be a problem.`);
    }, 6e4);
    this._register(dom.addDisposableListener(mainWindow, "message", (event) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }
      if (event.data.vscodeWebWorkerExtHostId !== vscodeWebWorkerExtHostId) {
        return;
      }
      if (event.data.error) {
        const { name, message, stack } = event.data.error;
        const err = new Error();
        err.message = message;
        err.name = name;
        err.stack = stack;
        return rejectBarrier(ExtensionHostExitCode.UnexpectedError, err);
      }
      if (event.data.type === "vscode.bootstrap.nls") {
        iframe.contentWindow.postMessage({
          type: event.data.type,
          data: {
            workerUrl: FileAccess.asBrowserUri("vs/workbench/api/worker/extensionHostWorkerMain.js").toString(true),
            fileRoot: globalThis._VSCODE_FILE_ROOT,
            nls: {
              messages: getNLSMessages(),
              language: getNLSLanguage()
            }
          }
        }, "*");
        return;
      }
      const { data } = event.data;
      if (barrier.isOpen() || !(data instanceof MessagePort)) {
        console.warn("UNEXPECTED message", event);
        const err = new Error("UNEXPECTED message");
        return rejectBarrier(ExtensionHostExitCode.UnexpectedError, err);
      }
      resolveBarrier(data);
    }));
    this._layoutService.mainContainer.appendChild(iframe);
    this._register(toDisposable(() => iframe.remove()));
    await barrier.wait();
    if (barrierHasError) {
      throw barrierError;
    }
    const messagePorts = this._environmentService.options?.messagePorts ?? /* @__PURE__ */ new Map();
    iframe.contentWindow.postMessage({ type: "vscode.init", data: messagePorts }, "*", [...messagePorts.values()]);
    port.onmessage = (event) => {
      const { data } = event;
      if (!(data instanceof ArrayBuffer)) {
        console.warn("UNKNOWN data received", data);
        this._onDidExit.fire([77, "UNKNOWN data received"]);
        return;
      }
      emitter.fire(VSBuffer.wrap(new Uint8Array(data, 0, data.byteLength)));
    };
    const protocol = {
      onMessage: emitter.event,
      send: (vsbuf) => {
        const data = vsbuf.buffer.buffer.slice(vsbuf.buffer.byteOffset, vsbuf.buffer.byteOffset + vsbuf.buffer.byteLength);
        port.postMessage(data, [data]);
      }
    };
    return this._performHandshake(protocol);
  }
  async _performHandshake(protocol) {
    await Event.toPromise(Event.filter(protocol.onMessage, (msg) => isMessageOfType(msg, MessageType.Ready)));
    if (this._isTerminating) {
      throw canceled();
    }
    protocol.send(VSBuffer.fromString(JSON.stringify(await this._createExtHostInitData())));
    if (this._isTerminating) {
      throw canceled();
    }
    await Event.toPromise(Event.filter(protocol.onMessage, (msg) => isMessageOfType(msg, MessageType.Initialized)));
    if (this._isTerminating) {
      throw canceled();
    }
    return protocol;
  }
  dispose() {
    if (this._isTerminating) {
      return;
    }
    this._isTerminating = true;
    this._protocol?.send(createMessageOfType(MessageType.Terminate));
    super.dispose();
  }
  getInspectPort() {
    return void 0;
  }
  enableInspectPort() {
    return Promise.resolve(false);
  }
  async _createExtHostInitData() {
    const initData = await this._initDataProvider.getInitData();
    this.extensions = initData.extensions;
    const workspace = this._contextService.getWorkspace();
    const nlsBaseUrl = this._productService.extensionsGallery?.nlsBaseUrl;
    let nlsUrlWithDetails = void 0;
    if (nlsBaseUrl && this._productService.commit && !platform.Language.isDefaultVariant()) {
      nlsUrlWithDetails = URI.joinPath(URI.parse(nlsBaseUrl), this._productService.commit, this._productService.version, platform.Language.value());
    }
    return {
      commit: this._productService.commit,
      version: this._productService.version,
      quality: this._productService.quality,
      parentPid: 0,
      environment: {
        isExtensionDevelopmentDebug: this._environmentService.debugRenderer,
        appName: this._productService.nameLong,
        appHost: this._productService.embedderIdentifier ?? (platform.isWeb ? "web" : "desktop"),
        appUriScheme: this._productService.urlProtocol,
        appLanguage: platform.language,
        isExtensionTelemetryLoggingOnly: isLoggingOnly(this._productService, this._environmentService),
        extensionDevelopmentLocationURI: this._environmentService.extensionDevelopmentLocationURI,
        extensionTestsLocationURI: this._environmentService.extensionTestsLocationURI,
        globalStorageHome: this._userDataProfilesService.defaultProfile.globalStorageHome,
        workspaceStorageHome: this._environmentService.workspaceStorageHome,
        extensionLogLevel: this._environmentService.extensionLogLevel
      },
      workspace: this._contextService.getWorkbenchState() === WorkbenchState.EMPTY ? void 0 : {
        configuration: workspace.configuration || void 0,
        id: workspace.id,
        name: this._labelService.getWorkspaceLabel(workspace),
        transient: workspace.transient
      },
      consoleForward: {
        includeStack: false,
        logNative: this._environmentService.debugRenderer
      },
      extensions: this.extensions.toSnapshot(),
      nlsBaseUrl: nlsUrlWithDetails,
      telemetryInfo: {
        sessionId: this._telemetryService.sessionId,
        machineId: this._telemetryService.machineId,
        sqmId: this._telemetryService.sqmId,
        devDeviceId: this._telemetryService.devDeviceId,
        firstSessionDate: this._telemetryService.firstSessionDate,
        msftInternal: this._telemetryService.msftInternal
      },
      logLevel: this._logService.getLevel(),
      loggers: [...this._loggerService.getRegisteredLoggers()],
      logsLocation: this._extensionHostLogsLocation,
      autoStart: this.startup === ExtensionHostStartup.EagerAutoStart,
      remote: {
        authority: this._environmentService.remoteAuthority,
        connectionData: null,
        isRemote: false
      },
      uiKind: platform.isWeb ? UIKind.Web : UIKind.Desktop
    };
  }
};
WebWorkerExtensionHost = __decorateClass([
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ILoggerService),
  __decorateParam(8, IBrowserWorkbenchEnvironmentService),
  __decorateParam(9, IUserDataProfilesService),
  __decorateParam(10, IProductService),
  __decorateParam(11, ILayoutService),
  __decorateParam(12, IStorageService)
], WebWorkerExtensionHost);
export {
  WebWorkerExtensionHost
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9icm93c2VyL3dlYldvcmtlckV4dGVuc2lvbkhvc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBwYXJlbnRPcmlnaW5IYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2lmcmFtZS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBCYXJyaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgY2FuY2VsZWQsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEFwcFJlc291cmNlUGF0aCwgQ09JLCBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMuanMnO1xuaW1wb3J0IHsgZ2V0TkxTTGFuZ3VhZ2UsIGdldE5MU01lc3NhZ2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBJTG9nZ2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGlzTG9nZ2luZ09ubHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgV29ya2JlbmNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RFeGl0Q29kZSwgSUV4dGVuc2lvbkhvc3RJbml0RGF0YSwgTWVzc2FnZVR5cGUsIFVJS2luZCwgY3JlYXRlTWVzc2FnZU9mVHlwZSwgaXNNZXNzYWdlT2ZUeXBlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkhvc3RQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25SdW5uaW5nTG9jYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnMsIEV4dGVuc2lvbkhvc3RTdGFydHVwLCBJRXh0ZW5zaW9uSG9zdCB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJV2ViV29ya2VyRXh0ZW5zaW9uSG9zdEluaXREYXRhIHtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uczogRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdlYldvcmtlckV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIge1xuXHRnZXRJbml0RGF0YSgpOiBQcm9taXNlPElXZWJXb3JrZXJFeHRlbnNpb25Ib3N0SW5pdERhdGE+O1xufVxuXG5leHBvcnQgY2xhc3MgV2ViV29ya2VyRXh0ZW5zaW9uSG9zdCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uSG9zdCB7XG5cblx0cHVibGljIHJlYWRvbmx5IHBpZCA9IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSByZW1vdGVBdXRob3JpdHkgPSBudWxsO1xuXHRwdWJsaWMgZXh0ZW5zaW9uczogRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnMgfCBudWxsID0gbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEV4aXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxbbnVtYmVyLCBzdHJpbmcgfCBudWxsXT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkV4aXQ6IEV2ZW50PFtudW1iZXIsIHN0cmluZyB8IG51bGxdPiA9IHRoaXMuX29uRGlkRXhpdC5ldmVudDtcblxuXHRwcml2YXRlIF9pc1Rlcm1pbmF0aW5nOiBib29sZWFuO1xuXHRwcml2YXRlIF9wcm90b2NvbFByb21pc2U6IFByb21pc2U8SU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w+IHwgbnVsbDtcblx0cHJpdmF0ZSBfcHJvdG9jb2w6IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sIHwgbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25Ib3N0TG9nc0xvY2F0aW9uOiBVUkk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHJ1bm5pbmdMb2NhdGlvbjogTG9jYWxXZWJXb3JrZXJSdW5uaW5nTG9jYXRpb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0YXJ0dXA6IEV4dGVuc2lvbkhvc3RTdGFydHVwLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luaXREYXRhUHJvdmlkZXI6IElXZWJXb3JrZXJFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxvZ2dlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nZ2VyU2VydmljZTogSUxvZ2dlclNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Vudmlyb25tZW50U2VydmljZTogSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2lzVGVybWluYXRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLl9wcm90b2NvbFByb21pc2UgPSBudWxsO1xuXHRcdHRoaXMuX3Byb3RvY29sID0gbnVsbDtcblx0XHR0aGlzLl9leHRlbnNpb25Ib3N0TG9nc0xvY2F0aW9uID0gam9pblBhdGgodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmV4dEhvc3RMb2dzUGF0aCwgJ3dlYldvcmtlcicpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0V2ViV29ya2VyRXh0ZW5zaW9uSG9zdElmcmFtZVNyYygpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IHN1ZmZpeFNlYXJjaFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcblx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmRlYnVnRXh0ZW5zaW9uSG9zdCAmJiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdSZW5kZXJlcikge1xuXHRcdFx0c3VmZml4U2VhcmNoUGFyYW1zLnNldCgnZGVidWdnZWQnLCAnMScpO1xuXHRcdH1cblx0XHRDT0kuYWRkU2VhcmNoUGFyYW0oc3VmZml4U2VhcmNoUGFyYW1zLCB0cnVlLCB0cnVlKTtcblxuXHRcdGNvbnN0IHN1ZmZpeCA9IGA/JHtzdWZmaXhTZWFyY2hQYXJhbXMudG9TdHJpbmcoKX1gO1xuXG5cdFx0Y29uc3QgaWZyYW1lTW9kdWxlUGF0aDogQXBwUmVzb3VyY2VQYXRoID0gYHZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL3dvcmtlci93ZWJXb3JrZXJFeHRlbnNpb25Ib3N0SWZyYW1lLmh0bWxgO1xuXHRcdGlmIChwbGF0Zm9ybS5pc1dlYikge1xuXHRcdFx0Y29uc3Qgd2ViRW5kcG9pbnRVcmxUZW1wbGF0ZSA9IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLndlYkVuZHBvaW50VXJsVGVtcGxhdGU7XG5cdFx0XHRjb25zdCBjb21taXQgPSB0aGlzLl9wcm9kdWN0U2VydmljZS5jb21taXQ7XG5cdFx0XHRjb25zdCBxdWFsaXR5ID0gdGhpcy5fcHJvZHVjdFNlcnZpY2UucXVhbGl0eTtcblx0XHRcdGlmICh3ZWJFbmRwb2ludFVybFRlbXBsYXRlICYmIGNvbW1pdCAmJiBxdWFsaXR5KSB7XG5cdFx0XHRcdC8vIFRyeSB0byBrZWVwIHRoZSB3ZWIgd29ya2VyIGV4dGVuc2lvbiBob3N0IGlmcmFtZSBvcmlnaW4gc3RhYmxlIGJ5IHN0b3JpbmcgaXQgaW4gd29ya3NwYWNlIHN0b3JhZ2Vcblx0XHRcdFx0Y29uc3Qga2V5ID0gJ3dlYldvcmtlckV4dGVuc2lvbkhvc3RJZnJhbWVTdGFibGVPcmlnaW5VVUlEJztcblx0XHRcdFx0bGV0IHN0YWJsZU9yaWdpblVVSUQgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBzdGFibGVPcmlnaW5VVUlEID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdHN0YWJsZU9yaWdpblVVSUQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHRcdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShrZXksIHN0YWJsZU9yaWdpblVVSUQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaGFzaCA9IGF3YWl0IHBhcmVudE9yaWdpbkhhc2gobWFpbldpbmRvdy5vcmlnaW4sIHN0YWJsZU9yaWdpblVVSUQpO1xuXHRcdFx0XHRjb25zdCBiYXNlVXJsID0gKFxuXHRcdFx0XHRcdHdlYkVuZHBvaW50VXJsVGVtcGxhdGVcblx0XHRcdFx0XHRcdC5yZXBsYWNlKCd7e3V1aWR9fScsIGB2LS0ke2hhc2h9YCkgLy8gdXNpbmcgYHYtLWAgYXMgYSBtYXJrZXIgdG8gcmVxdWlyZSBgcGFyZW50T3JpZ2luYC9gc2FsdGAgdmVyaWZpY2F0aW9uXG5cdFx0XHRcdFx0XHQucmVwbGFjZSgne3tjb21taXR9fScsIGNvbW1pdClcblx0XHRcdFx0XHRcdC5yZXBsYWNlKCd7e3F1YWxpdHl9fScsIHF1YWxpdHkpXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Y29uc3QgcmVzID0gbmV3IFVSTChgJHtiYXNlVXJsfS9vdXQvJHtpZnJhbWVNb2R1bGVQYXRofSR7c3VmZml4fWApO1xuXHRcdFx0XHRyZXMuc2VhcmNoUGFyYW1zLnNldCgncGFyZW50T3JpZ2luJywgbWFpbldpbmRvdy5vcmlnaW4pO1xuXHRcdFx0XHRyZXMuc2VhcmNoUGFyYW1zLnNldCgnc2FsdCcsIHN0YWJsZU9yaWdpblVVSUQpO1xuXHRcdFx0XHRyZXR1cm4gcmVzLnRvU3RyaW5nKCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUud2FybihgVGhlIHdlYiB3b3JrZXIgZXh0ZW5zaW9uIGhvc3QgaXMgc3RhcnRlZCBpbiBhIHNhbWUtb3JpZ2luIGlmcmFtZSFgKTtcblx0XHR9XG5cblx0XHRjb25zdCByZWxhdGl2ZUV4dGVuc2lvbkhvc3RJZnJhbWVTcmMgPSBGaWxlQWNjZXNzLmFzQnJvd3NlclVyaShpZnJhbWVNb2R1bGVQYXRoKTtcblx0XHRyZXR1cm4gYCR7cmVsYXRpdmVFeHRlbnNpb25Ib3N0SWZyYW1lU3JjLnRvU3RyaW5nKHRydWUpfSR7c3VmZml4fWA7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3RhcnQoKTogUHJvbWlzZTxJTWVzc2FnZVBhc3NpbmdQcm90b2NvbD4ge1xuXHRcdGlmICghdGhpcy5fcHJvdG9jb2xQcm9taXNlKSB7XG5cdFx0XHR0aGlzLl9wcm90b2NvbFByb21pc2UgPSB0aGlzLl9zdGFydEluc2lkZUlmcmFtZSgpO1xuXHRcdFx0dGhpcy5fcHJvdG9jb2xQcm9taXNlLnRoZW4ocHJvdG9jb2wgPT4gdGhpcy5fcHJvdG9jb2wgPSBwcm90b2NvbCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcm90b2NvbFByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zdGFydEluc2lkZUlmcmFtZSgpOiBQcm9taXNlPElNZXNzYWdlUGFzc2luZ1Byb3RvY29sPiB7XG5cdFx0Y29uc3Qgd2ViV29ya2VyRXh0ZW5zaW9uSG9zdElmcmFtZVNyYyA9IGF3YWl0IHRoaXMuX2dldFdlYldvcmtlckV4dGVuc2lvbkhvc3RJZnJhbWVTcmMoKTtcblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VlNCdWZmZXI+KCkpO1xuXG5cdFx0Y29uc3QgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG5cdFx0aWZyYW1lLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnd2ViLXdvcmtlci1leHQtaG9zdC1pZnJhbWUnKTtcblx0XHRpZnJhbWUuc2V0QXR0cmlidXRlKCdzYW5kYm94JywgJ2FsbG93LXNjcmlwdHMgYWxsb3ctc2FtZS1vcmlnaW4nKTtcblx0XHRpZnJhbWUuc2V0QXR0cmlidXRlKCdhbGxvdycsICd1c2I7IHNlcmlhbDsgaGlkOyBjcm9zcy1vcmlnaW4taXNvbGF0ZWQ7Jyk7XG5cdFx0aWZyYW1lLnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xuXHRcdGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0Y29uc3QgdnNjb2RlV2ViV29ya2VyRXh0SG9zdElkID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0aWZyYW1lLnNldEF0dHJpYnV0ZSgnc3JjJywgYCR7d2ViV29ya2VyRXh0ZW5zaW9uSG9zdElmcmFtZVNyY30mdnNjb2RlV2ViV29ya2VyRXh0SG9zdElkPSR7dnNjb2RlV2ViV29ya2VyRXh0SG9zdElkfWApO1xuXG5cdFx0Y29uc3QgYmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0bGV0IHBvcnQhOiBNZXNzYWdlUG9ydDtcblx0XHRsZXQgYmFycmllckVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXHRcdGxldCBiYXJyaWVySGFzRXJyb3IgPSBmYWxzZTtcblx0XHRsZXQgc3RhcnRUaW1lb3V0OiBhbnkgPSBudWxsO1xuXG5cdFx0Y29uc3QgcmVqZWN0QmFycmllciA9IChleGl0Q29kZTogbnVtYmVyLCBlcnJvcjogRXJyb3IpID0+IHtcblx0XHRcdGJhcnJpZXJFcnJvciA9IGVycm9yO1xuXHRcdFx0YmFycmllckhhc0Vycm9yID0gdHJ1ZTtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGJhcnJpZXJFcnJvcik7XG5cdFx0XHRjbGVhclRpbWVvdXQoc3RhcnRUaW1lb3V0KTtcblx0XHRcdHRoaXMuX29uRGlkRXhpdC5maXJlKFtFeHRlbnNpb25Ib3N0RXhpdENvZGUuVW5leHBlY3RlZEVycm9yLCBiYXJyaWVyRXJyb3IubWVzc2FnZV0pO1xuXHRcdFx0YmFycmllci5vcGVuKCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlc29sdmVCYXJyaWVyID0gKG1lc3NhZ2VQb3J0OiBNZXNzYWdlUG9ydCkgPT4ge1xuXHRcdFx0cG9ydCA9IG1lc3NhZ2VQb3J0O1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHN0YXJ0VGltZW91dCk7XG5cdFx0XHRiYXJyaWVyLm9wZW4oKTtcblx0XHR9O1xuXG5cdFx0c3RhcnRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFRoZSBXZWIgV29ya2VyIEV4dGVuc2lvbiBIb3N0IGRpZCBub3Qgc3RhcnQgaW4gNjBzLCB0aGF0IG1pZ2h0IGJlIGEgcHJvYmxlbS5gKTtcblx0XHR9LCA2MDAwMCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG1haW5XaW5kb3csICdtZXNzYWdlJywgKGV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZXZlbnQuc291cmNlICE9PSBpZnJhbWUuY29udGVudFdpbmRvdykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXZlbnQuZGF0YS52c2NvZGVXZWJXb3JrZXJFeHRIb3N0SWQgIT09IHZzY29kZVdlYldvcmtlckV4dEhvc3RJZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXZlbnQuZGF0YS5lcnJvcikge1xuXHRcdFx0XHRjb25zdCB7IG5hbWUsIG1lc3NhZ2UsIHN0YWNrIH0gPSBldmVudC5kYXRhLmVycm9yO1xuXHRcdFx0XHRjb25zdCBlcnIgPSBuZXcgRXJyb3IoKTtcblx0XHRcdFx0ZXJyLm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdFx0XHRlcnIubmFtZSA9IG5hbWU7XG5cdFx0XHRcdGVyci5zdGFjayA9IHN0YWNrO1xuXHRcdFx0XHRyZXR1cm4gcmVqZWN0QmFycmllcihFeHRlbnNpb25Ib3N0RXhpdENvZGUuVW5leHBlY3RlZEVycm9yLCBlcnIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ3ZzY29kZS5ib290c3RyYXAubmxzJykge1xuXHRcdFx0XHRpZnJhbWUuY29udGVudFdpbmRvdyEucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdHR5cGU6IGV2ZW50LmRhdGEudHlwZSxcblx0XHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0XHR3b3JrZXJVcmw6IEZpbGVBY2Nlc3MuYXNCcm93c2VyVXJpKCd2cy93b3JrYmVuY2gvYXBpL3dvcmtlci9leHRlbnNpb25Ib3N0V29ya2VyTWFpbi5qcycpLnRvU3RyaW5nKHRydWUpLFxuXHRcdFx0XHRcdFx0ZmlsZVJvb3Q6IGdsb2JhbFRoaXMuX1ZTQ09ERV9GSUxFX1JPT1QsXG5cdFx0XHRcdFx0XHRubHM6IHtcblx0XHRcdFx0XHRcdFx0bWVzc2FnZXM6IGdldE5MU01lc3NhZ2VzKCksXG5cdFx0XHRcdFx0XHRcdGxhbmd1YWdlOiBnZXROTFNMYW5ndWFnZSgpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAnKicpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB7IGRhdGEgfSA9IGV2ZW50LmRhdGE7XG5cdFx0XHRpZiAoYmFycmllci5pc09wZW4oKSB8fCAhKGRhdGEgaW5zdGFuY2VvZiBNZXNzYWdlUG9ydCkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdVTkVYUEVDVEVEIG1lc3NhZ2UnLCBldmVudCk7XG5cdFx0XHRcdGNvbnN0IGVyciA9IG5ldyBFcnJvcignVU5FWFBFQ1RFRCBtZXNzYWdlJyk7XG5cdFx0XHRcdHJldHVybiByZWplY3RCYXJyaWVyKEV4dGVuc2lvbkhvc3RFeGl0Q29kZS5VbmV4cGVjdGVkRXJyb3IsIGVycik7XG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlQmFycmllcihkYXRhKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9sYXlvdXRTZXJ2aWNlLm1haW5Db250YWluZXIuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gaWZyYW1lLnJlbW92ZSgpKSk7XG5cblx0XHQvLyBhd2FpdCBNZXNzYWdlUG9ydCBhbmQgdXNlIGl0IHRvIGRpcmVjdGx5IGNvbW11bmljYXRlXG5cdFx0Ly8gd2l0aCB0aGUgd29ya2VyIGV4dGVuc2lvbiBob3N0XG5cdFx0YXdhaXQgYmFycmllci53YWl0KCk7XG5cblx0XHRpZiAoYmFycmllckhhc0Vycm9yKSB7XG5cdFx0XHR0aHJvdyBiYXJyaWVyRXJyb3I7XG5cdFx0fVxuXG5cdFx0Ly8gU2VuZCBvdmVyIG1lc3NhZ2UgcG9ydHMgZm9yIGV4dGVuc2lvbiBBUElcblx0XHRjb25zdCBtZXNzYWdlUG9ydHMgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8ubWVzc2FnZVBvcnRzID8/IG5ldyBNYXAoKTtcblx0XHRpZnJhbWUuY29udGVudFdpbmRvdyEucG9zdE1lc3NhZ2UoeyB0eXBlOiAndnNjb2RlLmluaXQnLCBkYXRhOiBtZXNzYWdlUG9ydHMgfSwgJyonLCBbLi4ubWVzc2FnZVBvcnRzLnZhbHVlcygpXSk7XG5cblx0XHRwb3J0Lm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgeyBkYXRhIH0gPSBldmVudDtcblx0XHRcdGlmICghKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdVTktOT1dOIGRhdGEgcmVjZWl2ZWQnLCBkYXRhKTtcblx0XHRcdFx0dGhpcy5fb25EaWRFeGl0LmZpcmUoWzc3LCAnVU5LTk9XTiBkYXRhIHJlY2VpdmVkJ10pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlbWl0dGVyLmZpcmUoVlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShkYXRhLCAwLCBkYXRhLmJ5dGVMZW5ndGgpKSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHByb3RvY29sOiBJTWVzc2FnZVBhc3NpbmdQcm90b2NvbCA9IHtcblx0XHRcdG9uTWVzc2FnZTogZW1pdHRlci5ldmVudCxcblx0XHRcdHNlbmQ6IHZzYnVmID0+IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IHZzYnVmLmJ1ZmZlci5idWZmZXIuc2xpY2UodnNidWYuYnVmZmVyLmJ5dGVPZmZzZXQsIHZzYnVmLmJ1ZmZlci5ieXRlT2Zmc2V0ICsgdnNidWYuYnVmZmVyLmJ5dGVMZW5ndGgpO1xuXHRcdFx0XHRwb3J0LnBvc3RNZXNzYWdlKGRhdGEsIFtkYXRhXSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLl9wZXJmb3JtSGFuZHNoYWtlKHByb3RvY29sKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3BlcmZvcm1IYW5kc2hha2UocHJvdG9jb2w6IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sKTogUHJvbWlzZTxJTWVzc2FnZVBhc3NpbmdQcm90b2NvbD4ge1xuXHRcdC8vIGV4dGVuc2lvbiBob3N0IGhhbmRzaGFrZSBoYXBwZW5zIGJlbG93XG5cdFx0Ly8gKDEpIDw9PSB3YWl0IGZvcjogUmVhZHlcblx0XHQvLyAoMikgPT0+IHNlbmQ6IGluaXQgZGF0YVxuXHRcdC8vICgzKSA8PT0gd2FpdCBmb3I6IEluaXRpYWxpemVkXG5cblx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKHByb3RvY29sLm9uTWVzc2FnZSwgbXNnID0+IGlzTWVzc2FnZU9mVHlwZShtc2csIE1lc3NhZ2VUeXBlLlJlYWR5KSkpO1xuXHRcdGlmICh0aGlzLl9pc1Rlcm1pbmF0aW5nKSB7XG5cdFx0XHR0aHJvdyBjYW5jZWxlZCgpO1xuXHRcdH1cblx0XHRwcm90b2NvbC5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoYXdhaXQgdGhpcy5fY3JlYXRlRXh0SG9zdEluaXREYXRhKCkpKSk7XG5cdFx0aWYgKHRoaXMuX2lzVGVybWluYXRpbmcpIHtcblx0XHRcdHRocm93IGNhbmNlbGVkKCk7XG5cdFx0fVxuXHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShFdmVudC5maWx0ZXIocHJvdG9jb2wub25NZXNzYWdlLCBtc2cgPT4gaXNNZXNzYWdlT2ZUeXBlKG1zZywgTWVzc2FnZVR5cGUuSW5pdGlhbGl6ZWQpKSk7XG5cdFx0aWYgKHRoaXMuX2lzVGVybWluYXRpbmcpIHtcblx0XHRcdHRocm93IGNhbmNlbGVkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb3RvY29sO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzVGVybWluYXRpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faXNUZXJtaW5hdGluZyA9IHRydWU7XG5cdFx0dGhpcy5fcHJvdG9jb2w/LnNlbmQoY3JlYXRlTWVzc2FnZU9mVHlwZShNZXNzYWdlVHlwZS5UZXJtaW5hdGUpKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRJbnNwZWN0UG9ydCgpOiB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRlbmFibGVJbnNwZWN0UG9ydCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZUV4dEhvc3RJbml0RGF0YSgpOiBQcm9taXNlPElFeHRlbnNpb25Ib3N0SW5pdERhdGE+IHtcblx0XHRjb25zdCBpbml0RGF0YSA9IGF3YWl0IHRoaXMuX2luaXREYXRhUHJvdmlkZXIuZ2V0SW5pdERhdGEoKTtcblx0XHR0aGlzLmV4dGVuc2lvbnMgPSBpbml0RGF0YS5leHRlbnNpb25zO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdGNvbnN0IG5sc0Jhc2VVcmwgPSB0aGlzLl9wcm9kdWN0U2VydmljZS5leHRlbnNpb25zR2FsbGVyeT8ubmxzQmFzZVVybDtcblx0XHRsZXQgbmxzVXJsV2l0aERldGFpbHM6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHQvLyBPbmx5IHVzZSB0aGUgbmxzQmFzZVVybCBpZiB3ZSBhcmUgdXNpbmcgYSBsYW5ndWFnZSBvdGhlciB0aGFuIHRoZSBkZWZhdWx0LCBFbmdsaXNoLlxuXHRcdGlmIChubHNCYXNlVXJsICYmIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmNvbW1pdCAmJiAhcGxhdGZvcm0uTGFuZ3VhZ2UuaXNEZWZhdWx0VmFyaWFudCgpKSB7XG5cdFx0XHRubHNVcmxXaXRoRGV0YWlscyA9IFVSSS5qb2luUGF0aChVUkkucGFyc2UobmxzQmFzZVVybCksIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmNvbW1pdCwgdGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgcGxhdGZvcm0uTGFuZ3VhZ2UudmFsdWUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRjb21taXQ6IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmNvbW1pdCxcblx0XHRcdHZlcnNpb246IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLnZlcnNpb24sXG5cdFx0XHRxdWFsaXR5OiB0aGlzLl9wcm9kdWN0U2VydmljZS5xdWFsaXR5LFxuXHRcdFx0cGFyZW50UGlkOiAwLFxuXHRcdFx0ZW52aXJvbm1lbnQ6IHtcblx0XHRcdFx0aXNFeHRlbnNpb25EZXZlbG9wbWVudERlYnVnOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdSZW5kZXJlcixcblx0XHRcdFx0YXBwTmFtZTogdGhpcy5fcHJvZHVjdFNlcnZpY2UubmFtZUxvbmcsXG5cdFx0XHRcdGFwcEhvc3Q6IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmVtYmVkZGVySWRlbnRpZmllciA/PyAocGxhdGZvcm0uaXNXZWIgPyAnd2ViJyA6ICdkZXNrdG9wJyksXG5cdFx0XHRcdGFwcFVyaVNjaGVtZTogdGhpcy5fcHJvZHVjdFNlcnZpY2UudXJsUHJvdG9jb2wsXG5cdFx0XHRcdGFwcExhbmd1YWdlOiBwbGF0Zm9ybS5sYW5ndWFnZSxcblx0XHRcdFx0aXNFeHRlbnNpb25UZWxlbWV0cnlMb2dnaW5nT25seTogaXNMb2dnaW5nT25seSh0aGlzLl9wcm9kdWN0U2VydmljZSwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlKSxcblx0XHRcdFx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSTogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkksXG5cdFx0XHRcdGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkk6IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJLFxuXHRcdFx0XHRnbG9iYWxTdG9yYWdlSG9tZTogdGhpcy5fdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZ2xvYmFsU3RvcmFnZUhvbWUsXG5cdFx0XHRcdHdvcmtzcGFjZVN0b3JhZ2VIb21lOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsXG5cdFx0XHRcdGV4dGVuc2lvbkxvZ0xldmVsOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uTG9nTGV2ZWxcblx0XHRcdH0sXG5cdFx0XHR3b3Jrc3BhY2U6IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uOiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdGlkOiB3b3Jrc3BhY2UuaWQsXG5cdFx0XHRcdG5hbWU6IHRoaXMuX2xhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbCh3b3Jrc3BhY2UpLFxuXHRcdFx0XHR0cmFuc2llbnQ6IHdvcmtzcGFjZS50cmFuc2llbnRcblx0XHRcdH0sXG5cdFx0XHRjb25zb2xlRm9yd2FyZDoge1xuXHRcdFx0XHRpbmNsdWRlU3RhY2s6IGZhbHNlLFxuXHRcdFx0XHRsb2dOYXRpdmU6IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5kZWJ1Z1JlbmRlcmVyXG5cdFx0XHR9LFxuXHRcdFx0ZXh0ZW5zaW9uczogdGhpcy5leHRlbnNpb25zLnRvU25hcHNob3QoKSxcblx0XHRcdG5sc0Jhc2VVcmw6IG5sc1VybFdpdGhEZXRhaWxzLFxuXHRcdFx0dGVsZW1ldHJ5SW5mbzoge1xuXHRcdFx0XHRzZXNzaW9uSWQ6IHRoaXMuX3RlbGVtZXRyeVNlcnZpY2Uuc2Vzc2lvbklkLFxuXHRcdFx0XHRtYWNoaW5lSWQ6IHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UubWFjaGluZUlkLFxuXHRcdFx0XHRzcW1JZDogdGhpcy5fdGVsZW1ldHJ5U2VydmljZS5zcW1JZCxcblx0XHRcdFx0ZGV2RGV2aWNlSWQ6IHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UuZGV2RGV2aWNlSWQsXG5cdFx0XHRcdGZpcnN0U2Vzc2lvbkRhdGU6IHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UuZmlyc3RTZXNzaW9uRGF0ZSxcblx0XHRcdFx0bXNmdEludGVybmFsOiB0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLm1zZnRJbnRlcm5hbFxuXHRcdFx0fSxcblx0XHRcdGxvZ0xldmVsOiB0aGlzLl9sb2dTZXJ2aWNlLmdldExldmVsKCksXG5cdFx0XHRsb2dnZXJzOiBbLi4udGhpcy5fbG9nZ2VyU2VydmljZS5nZXRSZWdpc3RlcmVkTG9nZ2VycygpXSxcblx0XHRcdGxvZ3NMb2NhdGlvbjogdGhpcy5fZXh0ZW5zaW9uSG9zdExvZ3NMb2NhdGlvbixcblx0XHRcdGF1dG9TdGFydDogKHRoaXMuc3RhcnR1cCA9PT0gRXh0ZW5zaW9uSG9zdFN0YXJ0dXAuRWFnZXJBdXRvU3RhcnQpLFxuXHRcdFx0cmVtb3RlOiB7XG5cdFx0XHRcdGF1dGhvcml0eTogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0Y29ubmVjdGlvbkRhdGE6IG51bGwsXG5cdFx0XHRcdGlzUmVtb3RlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdHVpS2luZDogcGxhdGZvcm0uaXNXZWIgPyBVSUtpbmQuV2ViIDogVUlLaW5kLkRlc2t0b3Bcblx0XHR9O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxVQUFVLHlCQUF5QjtBQUM1QyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksb0JBQW9CO0FBQ3pDLFNBQTBCLEtBQUssa0JBQWtCO0FBQ2pELFlBQVksY0FBYztBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7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
