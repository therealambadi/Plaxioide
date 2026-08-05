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
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { memoize } from "../../../../base/common/decorators.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { parseLineAndColumnAware } from "../../../../base/common/extpath.js";
import { LogLevelToString } from "../../../../platform/log/common/log.js";
import { isUndefined } from "../../../../base/common/types.js";
import { refineServiceDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { EXTENSION_IDENTIFIER_WITH_LOG_REGEX } from "../../../../platform/environment/common/environmentService.js";
const IBrowserWorkbenchEnvironmentService = refineServiceDecorator(IEnvironmentService);
class BrowserWorkbenchEnvironmentService {
  constructor(workspaceId, logsHome, options, productService) {
    this.workspaceId = workspaceId;
    this.logsHome = logsHome;
    this.options = options;
    this.productService = productService;
    this.extensionHostDebugEnvironment = void 0;
    if (options.workspaceProvider && Array.isArray(options.workspaceProvider.payload)) {
      try {
        this.payload = new Map(options.workspaceProvider.payload);
      } catch (error) {
        onUnexpectedError(error);
      }
    }
  }
  get remoteAuthority() {
    return this.options.remoteAuthority;
  }
  get expectsResolverExtension() {
    return !!this.options.remoteAuthority?.includes("+") && !this.options.webSocketFactory;
  }
  get isBuilt() {
    return !!this.productService.commit;
  }
  get logLevel() {
    const logLevelFromPayload = this.payload?.get("logLevel");
    if (logLevelFromPayload) {
      return logLevelFromPayload.split(",").find((entry) => !EXTENSION_IDENTIFIER_WITH_LOG_REGEX.test(entry));
    }
    return this.options.developmentOptions?.logLevel !== void 0 ? LogLevelToString(this.options.developmentOptions?.logLevel) : void 0;
  }
  get extensionLogLevel() {
    const logLevelFromPayload = this.payload?.get("logLevel");
    if (logLevelFromPayload) {
      const result = [];
      for (const entry of logLevelFromPayload.split(",")) {
        const matches = EXTENSION_IDENTIFIER_WITH_LOG_REGEX.exec(entry);
        if (matches && matches[1] && matches[2]) {
          result.push([matches[1], matches[2]]);
        }
      }
      return result.length ? result : void 0;
    }
    return this.options.developmentOptions?.extensionLogLevel !== void 0 ? this.options.developmentOptions?.extensionLogLevel.map(([extension, logLevel]) => [extension, LogLevelToString(logLevel)]) : void 0;
  }
  get profDurationMarkers() {
    const profDurationMarkersFromPayload = this.payload?.get("profDurationMarkers");
    if (profDurationMarkersFromPayload) {
      const result = [];
      for (const entry of profDurationMarkersFromPayload.split(",")) {
        result.push(entry);
      }
      return result.length === 2 ? result : void 0;
    }
    return void 0;
  }
  get windowLogsPath() {
    return this.logsHome;
  }
  get logFile() {
    return joinPath(this.windowLogsPath, "window.log");
  }
  get userRoamingDataHome() {
    return URI.file("/User").with({ scheme: Schemas.vscodeUserData });
  }
  get argvResource() {
    return joinPath(this.userRoamingDataHome, "argv.json");
  }
  get cacheHome() {
    return joinPath(this.userRoamingDataHome, "caches");
  }
  get workspaceStorageHome() {
    return joinPath(this.userRoamingDataHome, "workspaceStorage");
  }
  get localHistoryHome() {
    return joinPath(this.userRoamingDataHome, "History");
  }
  get stateResource() {
    return joinPath(this.userRoamingDataHome, "State", "storage.json");
  }
  get userDataSyncHome() {
    return joinPath(this.userRoamingDataHome, "sync", this.workspaceId);
  }
  get sync() {
    return void 0;
  }
  get keyboardLayoutResource() {
    return joinPath(this.userRoamingDataHome, "keyboardLayout.json");
  }
  get untitledWorkspacesHome() {
    return joinPath(this.userRoamingDataHome, "Workspaces");
  }
  get serviceMachineIdResource() {
    return joinPath(this.userRoamingDataHome, "machineid");
  }
  get extHostLogsPath() {
    return joinPath(this.logsHome, "exthost");
  }
  get debugExtensionHost() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.params;
  }
  get isExtensionDevelopment() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.isExtensionDevelopment;
  }
  get extensionDevelopmentLocationURI() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.extensionDevelopmentLocationURI;
  }
  get extensionDevelopmentLocationKind() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.extensionDevelopmentKind;
  }
  get extensionTestsLocationURI() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.extensionTestsLocationURI;
  }
  get extensionEnabledProposedApi() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.extensionEnabledProposedApi;
  }
  get debugRenderer() {
    if (!this.extensionHostDebugEnvironment) {
      this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
    }
    return this.extensionHostDebugEnvironment.debugRenderer;
  }
  get enableSmokeTestDriver() {
    return this.options.developmentOptions?.enableSmokeTestDriver;
  }
  get disableExtensions() {
    return this.payload?.get("disableExtensions") === "true";
  }
  get enableExtensions() {
    return this.options.enabledExtensions;
  }
  get webviewExternalEndpoint() {
    const endpoint = this.options.webviewEndpoint || this.productService.webviewContentExternalBaseUrlTemplate || "https://{{uuid}}.vscode-cdn.net/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/";
    const webviewExternalEndpointCommit = this.payload?.get("webviewExternalEndpointCommit");
    return endpoint.replace("{{commit}}", webviewExternalEndpointCommit ?? this.productService.commit ?? "ef65ac1ba57f57f2a3961bfe94aa20481caca4c6").replace("{{quality}}", (webviewExternalEndpointCommit ? "insider" : this.productService.quality) ?? "insider");
  }
  get extensionTelemetryLogResource() {
    return joinPath(this.logsHome, "extensionTelemetry.log");
  }
  get disableTelemetry() {
    return false;
  }
  get verbose() {
    return this.payload?.get("verbose") === "true";
  }
  get logExtensionHostCommunication() {
    return this.payload?.get("logExtensionHostCommunication") === "true";
  }
  get skipReleaseNotes() {
    return this.payload?.get("skipReleaseNotes") === "true";
  }
  get skipWelcome() {
    return this.payload?.get("skipWelcome") === "true";
  }
  get disableWorkspaceTrust() {
    return this.options.enableWorkspaceTrust === false;
  }
  get profile() {
    return this.payload?.get("profile");
  }
  get editSessionId() {
    return this.options.editSessionId;
  }
  resolveExtensionHostDebugEnvironment() {
    const extensionHostDebugEnvironment = {
      params: {
        port: null,
        break: false
      },
      debugRenderer: false,
      isExtensionDevelopment: false,
      extensionDevelopmentLocationURI: void 0,
      extensionDevelopmentKind: void 0
    };
    if (this.payload) {
      for (const [key, value] of this.payload) {
        switch (key) {
          case "extensionDevelopmentPath":
            if (!extensionHostDebugEnvironment.extensionDevelopmentLocationURI) {
              extensionHostDebugEnvironment.extensionDevelopmentLocationURI = [];
            }
            extensionHostDebugEnvironment.extensionDevelopmentLocationURI.push(URI.parse(value));
            extensionHostDebugEnvironment.isExtensionDevelopment = true;
            break;
          case "extensionDevelopmentKind":
            extensionHostDebugEnvironment.extensionDevelopmentKind = [value];
            break;
          case "extensionTestsPath":
            extensionHostDebugEnvironment.extensionTestsLocationURI = URI.parse(value);
            break;
          case "debugRenderer":
            extensionHostDebugEnvironment.debugRenderer = value === "true";
            break;
          case "debugId":
            extensionHostDebugEnvironment.params.debugId = value;
            break;
          case "inspect-brk-extensions":
            extensionHostDebugEnvironment.params.port = parseInt(value);
            extensionHostDebugEnvironment.params.break = true;
            break;
          case "inspect-extensions":
            extensionHostDebugEnvironment.params.port = parseInt(value);
            break;
          case "enableProposedApi":
            extensionHostDebugEnvironment.extensionEnabledProposedApi = [];
            break;
        }
      }
    }
    const developmentOptions = this.options.developmentOptions;
    if (developmentOptions && !extensionHostDebugEnvironment.isExtensionDevelopment) {
      if (developmentOptions.extensions?.length) {
        extensionHostDebugEnvironment.extensionDevelopmentLocationURI = developmentOptions.extensions.map((e) => URI.revive(e));
        extensionHostDebugEnvironment.isExtensionDevelopment = true;
      }
      if (developmentOptions.extensionTestsPath) {
        extensionHostDebugEnvironment.extensionTestsLocationURI = URI.revive(developmentOptions.extensionTestsPath);
      }
    }
    return extensionHostDebugEnvironment;
  }
  get filesToOpenOrCreate() {
    if (this.payload) {
      const fileToOpen = this.payload.get("openFile");
      if (fileToOpen) {
        const fileUri = URI.parse(fileToOpen);
        if (this.payload.has("gotoLineMode")) {
          const pathColumnAware = parseLineAndColumnAware(fileUri.path);
          return [{
            fileUri: fileUri.with({ path: pathColumnAware.path }),
            options: {
              selection: !isUndefined(pathColumnAware.line) ? { startLineNumber: pathColumnAware.line, startColumn: pathColumnAware.column || 1 } : void 0
            }
          }];
        }
        return [{ fileUri }];
      }
    }
    return void 0;
  }
  get filesToDiff() {
    if (this.payload) {
      const fileToDiffPrimary = this.payload.get("diffFilePrimary");
      const fileToDiffSecondary = this.payload.get("diffFileSecondary");
      if (fileToDiffPrimary && fileToDiffSecondary) {
        return [
          { fileUri: URI.parse(fileToDiffSecondary) },
          { fileUri: URI.parse(fileToDiffPrimary) }
        ];
      }
    }
    return void 0;
  }
  get filesToMerge() {
    if (this.payload) {
      const fileToMerge1 = this.payload.get("mergeFile1");
      const fileToMerge2 = this.payload.get("mergeFile2");
      const fileToMergeBase = this.payload.get("mergeFileBase");
      const fileToMergeResult = this.payload.get("mergeFileResult");
      if (fileToMerge1 && fileToMerge2 && fileToMergeBase && fileToMergeResult) {
        return [
          { fileUri: URI.parse(fileToMerge1) },
          { fileUri: URI.parse(fileToMerge2) },
          { fileUri: URI.parse(fileToMergeBase) },
          { fileUri: URI.parse(fileToMergeResult) }
        ];
      }
    }
    return void 0;
  }
}
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "remoteAuthority", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "expectsResolverExtension", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "isBuilt", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "logLevel", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "windowLogsPath", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "logFile", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "userRoamingDataHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "argvResource", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "cacheHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "workspaceStorageHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "localHistoryHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "stateResource", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "userDataSyncHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "sync", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "keyboardLayoutResource", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "untitledWorkspacesHome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "serviceMachineIdResource", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extHostLogsPath", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "debugExtensionHost", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "isExtensionDevelopment", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extensionDevelopmentLocationURI", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extensionDevelopmentLocationKind", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extensionTestsLocationURI", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extensionEnabledProposedApi", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "debugRenderer", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "enableSmokeTestDriver", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "disableExtensions", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "enableExtensions", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "webviewExternalEndpoint", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "extensionTelemetryLogResource", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "disableTelemetry", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "verbose", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "logExtensionHostCommunication", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "skipReleaseNotes", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "skipWelcome", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "disableWorkspaceTrust", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "profile", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "editSessionId", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "filesToOpenOrCreate", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "filesToDiff", 1);
__decorateClass([
  memoize
], BrowserWorkbenchEnvironmentService.prototype, "filesToMerge", 1);
export {
  BrowserWorkbenchEnvironmentService,
  IBrowserWorkbenchEnvironmentService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2luZCwgSUVudmlyb25tZW50U2VydmljZSwgSUV4dGVuc2lvbkhvc3REZWJ1Z1BhcmFtcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb25zdHJ1Y3Rpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci93ZWIuYXBpLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IHBhcnNlTGluZUFuZENvbHVtbkF3YXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBMb2dMZXZlbFRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyByZWZpbmVTZXJ2aWNlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFWFRFTlNJT05fSURFTlRJRklFUl9XSVRIX0xPR19SRUdFWCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY29uc3QgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgPSByZWZpbmVTZXJ2aWNlRGVjb3JhdG9yPElFbnZpcm9ubWVudFNlcnZpY2UsIElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlPihJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuLyoqXG4gKiBBIHN1YmNsYXNzIG9mIHRoZSBgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZWAgdG8gYmUgdXNlZCBvbmx5IGVudmlyb25tZW50c1xuICogd2hlcmUgdGhlIHdlYiBBUEkgaXMgYXZhaWxhYmxlIChicm93c2VycywgRWxlY3Ryb24pLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGV4dGVuZHMgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB7XG5cblx0LyoqXG5cdCAqIE9wdGlvbnMgdXNlZCB0byBjb25maWd1cmUgdGhlIHdvcmtiZW5jaC5cblx0ICovXG5cdHJlYWRvbmx5IG9wdGlvbnM/OiBJV29ya2JlbmNoQ29uc3RydWN0aW9uT3B0aW9ucztcblxuXHQvKipcblx0ICogR2V0cyB3aGV0aGVyIGEgcmVzb2x2ZXIgZXh0ZW5zaW9uIGlzIGV4cGVjdGVkIGZvciB0aGUgZW52aXJvbm1lbnQuXG5cdCAqL1xuXHRyZWFkb25seSBleHBlY3RzUmVzb2x2ZXJFeHRlbnNpb246IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGltcGxlbWVudHMgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdEBtZW1vaXplXG5cdGdldCByZW1vdGVBdXRob3JpdHkoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMub3B0aW9ucy5yZW1vdGVBdXRob3JpdHk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZXhwZWN0c1Jlc29sdmVyRXh0ZW5zaW9uKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMub3B0aW9ucy5yZW1vdGVBdXRob3JpdHk/LmluY2x1ZGVzKCcrJykgJiYgIXRoaXMub3B0aW9ucy53ZWJTb2NrZXRGYWN0b3J5O1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGlzQnVpbHQoKTogYm9vbGVhbiB7IHJldHVybiAhIXRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0OyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGxvZ0xldmVsKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbG9nTGV2ZWxGcm9tUGF5bG9hZCA9IHRoaXMucGF5bG9hZD8uZ2V0KCdsb2dMZXZlbCcpO1xuXHRcdGlmIChsb2dMZXZlbEZyb21QYXlsb2FkKSB7XG5cdFx0XHRyZXR1cm4gbG9nTGV2ZWxGcm9tUGF5bG9hZC5zcGxpdCgnLCcpLmZpbmQoZW50cnkgPT4gIUVYVEVOU0lPTl9JREVOVElGSUVSX1dJVEhfTE9HX1JFR0VYLnRlc3QoZW50cnkpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zLmRldmVsb3BtZW50T3B0aW9ucz8ubG9nTGV2ZWwgIT09IHVuZGVmaW5lZCA/IExvZ0xldmVsVG9TdHJpbmcodGhpcy5vcHRpb25zLmRldmVsb3BtZW50T3B0aW9ucz8ubG9nTGV2ZWwpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IGV4dGVuc2lvbkxvZ0xldmVsKCk6IFtzdHJpbmcsIHN0cmluZ11bXSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbG9nTGV2ZWxGcm9tUGF5bG9hZCA9IHRoaXMucGF5bG9hZD8uZ2V0KCdsb2dMZXZlbCcpO1xuXHRcdGlmIChsb2dMZXZlbEZyb21QYXlsb2FkKSB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBsb2dMZXZlbEZyb21QYXlsb2FkLnNwbGl0KCcsJykpIHtcblx0XHRcdFx0Y29uc3QgbWF0Y2hlcyA9IEVYVEVOU0lPTl9JREVOVElGSUVSX1dJVEhfTE9HX1JFR0VYLmV4ZWMoZW50cnkpO1xuXHRcdFx0XHRpZiAobWF0Y2hlcyAmJiBtYXRjaGVzWzFdICYmIG1hdGNoZXNbMl0pIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChbbWF0Y2hlc1sxXSwgbWF0Y2hlc1syXV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQubGVuZ3RoID8gcmVzdWx0IDogdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm9wdGlvbnMuZGV2ZWxvcG1lbnRPcHRpb25zPy5leHRlbnNpb25Mb2dMZXZlbCAhPT0gdW5kZWZpbmVkID8gdGhpcy5vcHRpb25zLmRldmVsb3BtZW50T3B0aW9ucz8uZXh0ZW5zaW9uTG9nTGV2ZWwubWFwKChbZXh0ZW5zaW9uLCBsb2dMZXZlbF0pID0+IChbZXh0ZW5zaW9uLCBMb2dMZXZlbFRvU3RyaW5nKGxvZ0xldmVsKV0pKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCBwcm9mRHVyYXRpb25NYXJrZXJzKCk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwcm9mRHVyYXRpb25NYXJrZXJzRnJvbVBheWxvYWQgPSB0aGlzLnBheWxvYWQ/LmdldCgncHJvZkR1cmF0aW9uTWFya2VycycpO1xuXHRcdGlmIChwcm9mRHVyYXRpb25NYXJrZXJzRnJvbVBheWxvYWQpIHtcblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgcHJvZkR1cmF0aW9uTWFya2Vyc0Zyb21QYXlsb2FkLnNwbGl0KCcsJykpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goZW50cnkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0Lmxlbmd0aCA9PT0gMiA/IHJlc3VsdCA6IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IHdpbmRvd0xvZ3NQYXRoKCk6IFVSSSB7IHJldHVybiB0aGlzLmxvZ3NIb21lOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGxvZ0ZpbGUoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMud2luZG93TG9nc1BhdGgsICd3aW5kb3cubG9nJyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgdXNlclJvYW1pbmdEYXRhSG9tZSgpOiBVUkkgeyByZXR1cm4gVVJJLmZpbGUoJy9Vc2VyJykud2l0aCh7IHNjaGVtZTogU2NoZW1hcy52c2NvZGVVc2VyRGF0YSB9KTsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBhcmd2UmVzb3VyY2UoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMudXNlclJvYW1pbmdEYXRhSG9tZSwgJ2FyZ3YuanNvbicpOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGNhY2hlSG9tZSgpOiBVUkkgeyByZXR1cm4gam9pblBhdGgodGhpcy51c2VyUm9hbWluZ0RhdGFIb21lLCAnY2FjaGVzJyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgd29ya3NwYWNlU3RvcmFnZUhvbWUoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMudXNlclJvYW1pbmdEYXRhSG9tZSwgJ3dvcmtzcGFjZVN0b3JhZ2UnKTsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBsb2NhbEhpc3RvcnlIb21lKCk6IFVSSSB7IHJldHVybiBqb2luUGF0aCh0aGlzLnVzZXJSb2FtaW5nRGF0YUhvbWUsICdIaXN0b3J5Jyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgc3RhdGVSZXNvdXJjZSgpOiBVUkkgeyByZXR1cm4gam9pblBhdGgodGhpcy51c2VyUm9hbWluZ0RhdGFIb21lLCAnU3RhdGUnLCAnc3RvcmFnZS5qc29uJyk7IH1cblxuXHQvKipcblx0ICogSW4gV2ViIGV2ZXJ5IHdvcmtzcGFjZSBjYW4gcG90ZW50aWFsbHkgaGF2ZSBzY29wZWQgdXNlci1kYXRhXG5cdCAqIGFuZC9vciBleHRlbnNpb25zIGFuZCBpZiBTeW5jIHN0YXRlIGlzIHNoYXJlZCB0aGVuIGl0IGNhbiBtYWtlXG5cdCAqIFN5bmMgZXJyb3IgcHJvbmUgLSBzYXkgcmVtb3ZpbmcgZXh0ZW5zaW9ucyBmcm9tIGFub3RoZXIgd29ya3NwYWNlLlxuXHQgKiBIZW5jZSBzY29wZSBTeW5jIHN0YXRlIHBlciB3b3Jrc3BhY2UuIFN5bmMgc2NvcGVkIHRvIGEgd29ya3NwYWNlXG5cdCAqIGlzIGNhcGFibGUgb2YgaGFuZGxpbmcgb3BlbmluZyBzYW1lIHdvcmtzcGFjZSBpbiBtdWx0aXBsZSB3aW5kb3dzLlxuXHQgKi9cblx0QG1lbW9pemVcblx0Z2V0IHVzZXJEYXRhU3luY0hvbWUoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMudXNlclJvYW1pbmdEYXRhSG9tZSwgJ3N5bmMnLCB0aGlzLndvcmtzcGFjZUlkKTsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBzeW5jKCk6ICdvbicgfCAnb2ZmJyB8IHVuZGVmaW5lZCB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQga2V5Ym9hcmRMYXlvdXRSZXNvdXJjZSgpOiBVUkkgeyByZXR1cm4gam9pblBhdGgodGhpcy51c2VyUm9hbWluZ0RhdGFIb21lLCAna2V5Ym9hcmRMYXlvdXQuanNvbicpOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IHVudGl0bGVkV29ya3NwYWNlc0hvbWUoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMudXNlclJvYW1pbmdEYXRhSG9tZSwgJ1dvcmtzcGFjZXMnKTsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBzZXJ2aWNlTWFjaGluZUlkUmVzb3VyY2UoKTogVVJJIHsgcmV0dXJuIGpvaW5QYXRoKHRoaXMudXNlclJvYW1pbmdEYXRhSG9tZSwgJ21hY2hpbmVpZCcpOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGV4dEhvc3RMb2dzUGF0aCgpOiBVUkkgeyByZXR1cm4gam9pblBhdGgodGhpcy5sb2dzSG9tZSwgJ2V4dGhvc3QnKTsgfVxuXG5cdHByaXZhdGUgZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQ6IElFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRAbWVtb2l6ZVxuXHRnZXQgZGVidWdFeHRlbnNpb25Ib3N0KCk6IElFeHRlbnNpb25Ib3N0RGVidWdQYXJhbXMge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCkge1xuXHRcdFx0dGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCA9IHRoaXMucmVzb2x2ZUV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQucGFyYW1zO1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KSB7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50ID0gdGhpcy5yZXNvbHZlRXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5pc0V4dGVuc2lvbkRldmVsb3BtZW50O1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkkoKTogVVJJW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCkge1xuXHRcdFx0dGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCA9IHRoaXMucmVzb2x2ZUV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBleHRlbnNpb25EZXZlbG9wbWVudExvY2F0aW9uS2luZCgpOiBFeHRlbnNpb25LaW5kW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCkge1xuXHRcdFx0dGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCA9IHRoaXMucmVzb2x2ZUV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kO1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQgPSB0aGlzLnJlc29sdmVFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkk7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZXh0ZW5zaW9uRW5hYmxlZFByb3Bvc2VkQXBpKCk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQgPSB0aGlzLnJlc29sdmVFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmV4dGVuc2lvbkVuYWJsZWRQcm9wb3NlZEFwaTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBkZWJ1Z1JlbmRlcmVyKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCkge1xuXHRcdFx0dGhpcy5leHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCA9IHRoaXMucmVzb2x2ZUV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQuZGVidWdSZW5kZXJlcjtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBlbmFibGVTbW9rZVRlc3REcml2ZXIoKSB7IHJldHVybiB0aGlzLm9wdGlvbnMuZGV2ZWxvcG1lbnRPcHRpb25zPy5lbmFibGVTbW9rZVRlc3REcml2ZXI7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZGlzYWJsZUV4dGVuc2lvbnMoKSB7IHJldHVybiB0aGlzLnBheWxvYWQ/LmdldCgnZGlzYWJsZUV4dGVuc2lvbnMnKSA9PT0gJ3RydWUnOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGVuYWJsZUV4dGVuc2lvbnMoKSB7IHJldHVybiB0aGlzLm9wdGlvbnMuZW5hYmxlZEV4dGVuc2lvbnM7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgd2Vidmlld0V4dGVybmFsRW5kcG9pbnQoKTogc3RyaW5nIHtcblx0XHRjb25zdCBlbmRwb2ludCA9IHRoaXMub3B0aW9ucy53ZWJ2aWV3RW5kcG9pbnRcblx0XHRcdHx8IHRoaXMucHJvZHVjdFNlcnZpY2Uud2Vidmlld0NvbnRlbnRFeHRlcm5hbEJhc2VVcmxUZW1wbGF0ZVxuXHRcdFx0fHwgJ2h0dHBzOi8ve3t1dWlkfX0udnNjb2RlLWNkbi5uZXQve3txdWFsaXR5fX0ve3tjb21taXR9fS9vdXQvdnMvd29ya2JlbmNoL2NvbnRyaWIvd2Vidmlldy9icm93c2VyL3ByZS8nO1xuXG5cdFx0Y29uc3Qgd2Vidmlld0V4dGVybmFsRW5kcG9pbnRDb21taXQgPSB0aGlzLnBheWxvYWQ/LmdldCgnd2Vidmlld0V4dGVybmFsRW5kcG9pbnRDb21taXQnKTtcblx0XHRyZXR1cm4gZW5kcG9pbnRcblx0XHRcdC5yZXBsYWNlKCd7e2NvbW1pdH19Jywgd2Vidmlld0V4dGVybmFsRW5kcG9pbnRDb21taXQgPz8gdGhpcy5wcm9kdWN0U2VydmljZS5jb21taXQgPz8gJ2VmNjVhYzFiYTU3ZjU3ZjJhMzk2MWJmZTk0YWEyMDQ4MWNhY2E0YzYnKVxuXHRcdFx0LnJlcGxhY2UoJ3t7cXVhbGl0eX19JywgKHdlYnZpZXdFeHRlcm5hbEVuZHBvaW50Q29tbWl0ID8gJ2luc2lkZXInIDogdGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5KSA/PyAnaW5zaWRlcicpO1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGV4dGVuc2lvblRlbGVtZXRyeUxvZ1Jlc291cmNlKCk6IFVSSSB7IHJldHVybiBqb2luUGF0aCh0aGlzLmxvZ3NIb21lLCAnZXh0ZW5zaW9uVGVsZW1ldHJ5LmxvZycpOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGRpc2FibGVUZWxlbWV0cnkoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCB2ZXJib3NlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5wYXlsb2FkPy5nZXQoJ3ZlcmJvc2UnKSA9PT0gJ3RydWUnOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IGxvZ0V4dGVuc2lvbkhvc3RDb21tdW5pY2F0aW9uKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5wYXlsb2FkPy5nZXQoJ2xvZ0V4dGVuc2lvbkhvc3RDb21tdW5pY2F0aW9uJykgPT09ICd0cnVlJzsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBza2lwUmVsZWFzZU5vdGVzKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5wYXlsb2FkPy5nZXQoJ3NraXBSZWxlYXNlTm90ZXMnKSA9PT0gJ3RydWUnOyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IHNraXBXZWxjb21lKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5wYXlsb2FkPy5nZXQoJ3NraXBXZWxjb21lJykgPT09ICd0cnVlJzsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCBkaXNhYmxlV29ya3NwYWNlVHJ1c3QoKTogYm9vbGVhbiB7IHJldHVybiAhdGhpcy5vcHRpb25zLmVuYWJsZVdvcmtzcGFjZVRydXN0OyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IHByb2ZpbGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMucGF5bG9hZD8uZ2V0KCdwcm9maWxlJyk7IH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZWRpdFNlc3Npb25JZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5vcHRpb25zLmVkaXRTZXNzaW9uSWQ7IH1cblxuXHRwcml2YXRlIHBheWxvYWQ6IE1hcDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VJZDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGxvZ3NIb21lOiBVUkksXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogSVdvcmtiZW5jaENvbnN0cnVjdGlvbk9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlXG5cdCkge1xuXHRcdGlmIChvcHRpb25zLndvcmtzcGFjZVByb3ZpZGVyICYmIEFycmF5LmlzQXJyYXkob3B0aW9ucy53b3Jrc3BhY2VQcm92aWRlci5wYXlsb2FkKSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5wYXlsb2FkID0gbmV3IE1hcChvcHRpb25zLndvcmtzcGFjZVByb3ZpZGVyLnBheWxvYWQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpOyAvLyBwb3NzaWJsZSBpbnZhbGlkIHBheWxvYWQgZm9yIG1hcFxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZUV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50KCk6IElFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQ6IElFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCA9IHtcblx0XHRcdHBhcmFtczoge1xuXHRcdFx0XHRwb3J0OiBudWxsLFxuXHRcdFx0XHRicmVhazogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRkZWJ1Z1JlbmRlcmVyOiBmYWxzZSxcblx0XHRcdGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQ6IGZhbHNlLFxuXHRcdFx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSTogdW5kZWZpbmVkLFxuXHRcdFx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0Ly8gRmlsbCBpbiBzZWxlY3RlZCBleHRyYSBlbnZpcm9ubWVudGFsIHByb3BlcnRpZXNcblx0XHRpZiAodGhpcy5wYXlsb2FkKSB7XG5cdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzLnBheWxvYWQpIHtcblx0XHRcdFx0c3dpdGNoIChrZXkpIHtcblx0XHRcdFx0XHRjYXNlICdleHRlbnNpb25EZXZlbG9wbWVudFBhdGgnOlxuXHRcdFx0XHRcdFx0aWYgKCFleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5leHRlbnNpb25EZXZlbG9wbWVudExvY2F0aW9uVVJJKSB7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkkgPSBbXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkkucHVzaChVUkkucGFyc2UodmFsdWUpKTtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kJzpcblx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmV4dGVuc2lvbkRldmVsb3BtZW50S2luZCA9IFs8RXh0ZW5zaW9uS2luZD52YWx1ZV07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdleHRlbnNpb25UZXN0c1BhdGgnOlxuXHRcdFx0XHRcdFx0ZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSA9IFVSSS5wYXJzZSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdkZWJ1Z1JlbmRlcmVyJzpcblx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmRlYnVnUmVuZGVyZXIgPSB2YWx1ZSA9PT0gJ3RydWUnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnZGVidWdJZCc6XG5cdFx0XHRcdFx0XHRleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5wYXJhbXMuZGVidWdJZCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnaW5zcGVjdC1icmstZXh0ZW5zaW9ucyc6XG5cdFx0XHRcdFx0XHRleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5wYXJhbXMucG9ydCA9IHBhcnNlSW50KHZhbHVlKTtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LnBhcmFtcy5icmVhayA9IHRydWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdpbnNwZWN0LWV4dGVuc2lvbnMnOlxuXHRcdFx0XHRcdFx0ZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQucGFyYW1zLnBvcnQgPSBwYXJzZUludCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdlbmFibGVQcm9wb3NlZEFwaSc6XG5cdFx0XHRcdFx0XHRleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5leHRlbnNpb25FbmFibGVkUHJvcG9zZWRBcGkgPSBbXTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGV2ZWxvcG1lbnRPcHRpb25zID0gdGhpcy5vcHRpb25zLmRldmVsb3BtZW50T3B0aW9ucztcblx0XHRpZiAoZGV2ZWxvcG1lbnRPcHRpb25zICYmICFleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5pc0V4dGVuc2lvbkRldmVsb3BtZW50KSB7XG5cdFx0XHRpZiAoZGV2ZWxvcG1lbnRPcHRpb25zLmV4dGVuc2lvbnM/Lmxlbmd0aCkge1xuXHRcdFx0XHRleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5leHRlbnNpb25EZXZlbG9wbWVudExvY2F0aW9uVVJJID0gZGV2ZWxvcG1lbnRPcHRpb25zLmV4dGVuc2lvbnMubWFwKGUgPT4gVVJJLnJldml2ZShlKSk7XG5cdFx0XHRcdGV4dGVuc2lvbkhvc3REZWJ1Z0Vudmlyb25tZW50LmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZGV2ZWxvcG1lbnRPcHRpb25zLmV4dGVuc2lvblRlc3RzUGF0aCkge1xuXHRcdFx0XHRleHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudC5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJID0gVVJJLnJldml2ZShkZXZlbG9wbWVudE9wdGlvbnMuZXh0ZW5zaW9uVGVzdHNQYXRoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZXh0ZW5zaW9uSG9zdERlYnVnRW52aXJvbm1lbnQ7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZmlsZXNUb09wZW5PckNyZWF0ZSgpOiBJUGF0aDxJVGV4dEVkaXRvck9wdGlvbnM+W10gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLnBheWxvYWQpIHtcblx0XHRcdGNvbnN0IGZpbGVUb09wZW4gPSB0aGlzLnBheWxvYWQuZ2V0KCdvcGVuRmlsZScpO1xuXHRcdFx0aWYgKGZpbGVUb09wZW4pIHtcblx0XHRcdFx0Y29uc3QgZmlsZVVyaSA9IFVSSS5wYXJzZShmaWxlVG9PcGVuKTtcblxuXHRcdFx0XHQvLyBTdXBwb3J0OiAtLWdvdG8gcGFyYW1ldGVyIHRvIG9wZW4gb24gbGluZS9jb2xcblx0XHRcdFx0aWYgKHRoaXMucGF5bG9hZC5oYXMoJ2dvdG9MaW5lTW9kZScpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGF0aENvbHVtbkF3YXJlID0gcGFyc2VMaW5lQW5kQ29sdW1uQXdhcmUoZmlsZVVyaS5wYXRoKTtcblxuXHRcdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdFx0ZmlsZVVyaTogZmlsZVVyaS53aXRoKHsgcGF0aDogcGF0aENvbHVtbkF3YXJlLnBhdGggfSksXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdHNlbGVjdGlvbjogIWlzVW5kZWZpbmVkKHBhdGhDb2x1bW5Bd2FyZS5saW5lKSA/IHsgc3RhcnRMaW5lTnVtYmVyOiBwYXRoQ29sdW1uQXdhcmUubGluZSwgc3RhcnRDb2x1bW46IHBhdGhDb2x1bW5Bd2FyZS5jb2x1bW4gfHwgMSB9IDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gW3sgZmlsZVVyaSB9XTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0QG1lbW9pemVcblx0Z2V0IGZpbGVzVG9EaWZmKCk6IElQYXRoW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLnBheWxvYWQpIHtcblx0XHRcdGNvbnN0IGZpbGVUb0RpZmZQcmltYXJ5ID0gdGhpcy5wYXlsb2FkLmdldCgnZGlmZkZpbGVQcmltYXJ5Jyk7XG5cdFx0XHRjb25zdCBmaWxlVG9EaWZmU2Vjb25kYXJ5ID0gdGhpcy5wYXlsb2FkLmdldCgnZGlmZkZpbGVTZWNvbmRhcnknKTtcblx0XHRcdGlmIChmaWxlVG9EaWZmUHJpbWFyeSAmJiBmaWxlVG9EaWZmU2Vjb25kYXJ5KSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0eyBmaWxlVXJpOiBVUkkucGFyc2UoZmlsZVRvRGlmZlNlY29uZGFyeSkgfSxcblx0XHRcdFx0XHR7IGZpbGVVcmk6IFVSSS5wYXJzZShmaWxlVG9EaWZmUHJpbWFyeSkgfVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgZmlsZXNUb01lcmdlKCk6IElQYXRoW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLnBheWxvYWQpIHtcblx0XHRcdGNvbnN0IGZpbGVUb01lcmdlMSA9IHRoaXMucGF5bG9hZC5nZXQoJ21lcmdlRmlsZTEnKTtcblx0XHRcdGNvbnN0IGZpbGVUb01lcmdlMiA9IHRoaXMucGF5bG9hZC5nZXQoJ21lcmdlRmlsZTInKTtcblx0XHRcdGNvbnN0IGZpbGVUb01lcmdlQmFzZSA9IHRoaXMucGF5bG9hZC5nZXQoJ21lcmdlRmlsZUJhc2UnKTtcblx0XHRcdGNvbnN0IGZpbGVUb01lcmdlUmVzdWx0ID0gdGhpcy5wYXlsb2FkLmdldCgnbWVyZ2VGaWxlUmVzdWx0Jyk7XG5cdFx0XHRpZiAoZmlsZVRvTWVyZ2UxICYmIGZpbGVUb01lcmdlMiAmJiBmaWxlVG9NZXJnZUJhc2UgJiYgZmlsZVRvTWVyZ2VSZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHR7IGZpbGVVcmk6IFVSSS5wYXJzZShmaWxlVG9NZXJnZTEpIH0sXG5cdFx0XHRcdFx0eyBmaWxlVXJpOiBVUkkucGFyc2UoZmlsZVRvTWVyZ2UyKSB9LFxuXHRcdFx0XHRcdHsgZmlsZVVyaTogVVJJLnBhcnNlKGZpbGVUb01lcmdlQmFzZSkgfSxcblx0XHRcdFx0XHR7IGZpbGVVcmk6IFVSSS5wYXJzZShmaWxlVG9NZXJnZVJlc3VsdCkgfVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElFeHRlbnNpb25Ib3N0RGVidWdFbnZpcm9ubWVudCB7XG5cdHBhcmFtczogSUV4dGVuc2lvbkhvc3REZWJ1Z1BhcmFtcztcblx0ZGVidWdSZW5kZXJlcjogYm9vbGVhbjtcblx0aXNFeHRlbnNpb25EZXZlbG9wbWVudDogYm9vbGVhbjtcblx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSST86IFVSSVtdO1xuXHRleHRlbnNpb25EZXZlbG9wbWVudEtpbmQ/OiBFeHRlbnNpb25LaW5kW107XG5cdGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkk/OiBVUkk7XG5cdGV4dGVuc2lvbkVuYWJsZWRQcm9wb3NlZEFwaT86IHN0cmluZ1tdO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBd0IsMkJBQXNEO0FBSzlFLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLDJDQUEyQztBQUU3QyxNQUFNLHNDQUFzQyx1QkFBaUYsbUJBQW1CO0FBbUJoSixNQUFNLG1DQUFrRjtBQUFBLEVBNE45RixZQUNrQixhQUNSLFVBQ0EsU0FDUSxn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
