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
import { mainWindow } from "../../../../base/browser/window.js";
import { Schemas } from "../../../../base/common/network.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getLogs } from "../../../../platform/log/browser/log.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IRemoteAuthorityResolverService, RemoteAuthorityResolverError } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteExtensionsScannerService } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IWebExtensionsScannerService, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { WebWorkerExtensionHost } from "./webWorkerExtensionHost.js";
import { FetchFileSystemProvider } from "./webWorkerFileSystemProvider.js";
import { AbstractExtensionService, LocalExtensions, RemoteExtensions, ResolverExtensions, checkEnabledAndProposedAPI, isResolverExtension } from "../common/abstractExtensionService.js";
import { ExtensionHostKind, ExtensionRunningPreference, extensionHostKindToString, extensionRunningPreferenceToString } from "../common/extensionHostKind.js";
import { IExtensionManifestPropertiesService } from "../common/extensionManifestPropertiesService.js";
import { filterExtensionDescriptions } from "../common/extensionRunningLocationTracker.js";
import { ExtensionHostExtensions, ExtensionHostStartup, IExtensionService, toExtensionDescription } from "../common/extensions.js";
import { ExtensionsProposedApi } from "../common/extensionsProposedApi.js";
import { dedupExtensions } from "../common/extensionsUtil.js";
import { RemoteExtensionHost } from "../common/remoteExtensionHost.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IRemoteExplorerService } from "../../remote/common/remoteExplorerService.js";
import { IUserDataInitializationService } from "../../userData/browser/userDataInit.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { AsyncIterableObject } from "../../../../base/common/async.js";
let ExtensionService = class extends AbstractExtensionService {
  constructor(instantiationService, notificationService, _browserEnvironmentService, telemetryService, extensionEnablementService, fileService, productService, extensionManagementService, contextService, configurationService, extensionManifestPropertiesService, _webExtensionsScannerService, logService, remoteAgentService, remoteExtensionsScannerService, lifecycleService, remoteAuthorityResolverService, _userDataInitializationService, _userDataProfileService, _workspaceTrustManagementService, _remoteExplorerService, dialogService) {
    const extensionsProposedApi = instantiationService.createInstance(ExtensionsProposedApi);
    const extensionHostFactory = new BrowserExtensionHostFactory(
      extensionsProposedApi,
      () => this._scanWebExtensions(),
      () => this._getExtensionRegistrySnapshotWhenReady(),
      instantiationService,
      remoteAgentService,
      remoteAuthorityResolverService,
      extensionEnablementService,
      logService
    );
    super(
      { hasLocalProcess: false, allowRemoteExtensionsInLocalWebWorker: true },
      extensionsProposedApi,
      extensionHostFactory,
      new BrowserExtensionHostKindPicker(logService),
      instantiationService,
      notificationService,
      _browserEnvironmentService,
      telemetryService,
      extensionEnablementService,
      fileService,
      productService,
      extensionManagementService,
      contextService,
      configurationService,
      extensionManifestPropertiesService,
      logService,
      remoteAgentService,
      remoteExtensionsScannerService,
      lifecycleService,
      remoteAuthorityResolverService,
      dialogService
    );
    this._browserEnvironmentService = _browserEnvironmentService;
    this._webExtensionsScannerService = _webExtensionsScannerService;
    this._userDataInitializationService = _userDataInitializationService;
    this._userDataProfileService = _userDataProfileService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._remoteExplorerService = _remoteExplorerService;
    lifecycleService.when(LifecyclePhase.Ready).then(async () => {
      await this._userDataInitializationService.initializeInstalledExtensions(this._instantiationService);
      this._initialize();
    });
    this._initFetchFileSystem();
  }
  _initFetchFileSystem() {
    const provider = new FetchFileSystemProvider();
    this._register(this._fileService.registerProvider(Schemas.http, provider));
    this._register(this._fileService.registerProvider(Schemas.https, provider));
  }
  async _scanWebExtensions() {
    if (!this._scanWebExtensionsPromise) {
      this._scanWebExtensionsPromise = (async () => {
        const system = [], user = [], development = [];
        try {
          await Promise.all([
            this._webExtensionsScannerService.scanSystemExtensions().then((extensions) => system.push(...extensions.map((e) => toExtensionDescription(e)))),
            this._webExtensionsScannerService.scanUserExtensions(this._userDataProfileService.currentProfile.extensionsResource, { skipInvalidExtensions: true }).then((extensions) => user.push(...extensions.map((e) => toExtensionDescription(e)))),
            this._webExtensionsScannerService.scanExtensionsUnderDevelopment().then((extensions) => development.push(...extensions.map((e) => toExtensionDescription(e, true))))
          ]);
        } catch (error) {
          this._logService.error(error);
        }
        return dedupExtensions(system, user, [], development, this._logService);
      })();
    }
    return this._scanWebExtensionsPromise;
  }
  async _resolveExtensionsDefault(emitter) {
    const [localExtensions, remoteExtensions] = await Promise.all([
      this._scanWebExtensions(),
      this._remoteExtensionsScannerService.scanExtensions()
    ]);
    if (remoteExtensions.length) {
      emitter.emitOne(new RemoteExtensions(remoteExtensions));
    }
    emitter.emitOne(new LocalExtensions(localExtensions));
  }
  _resolveExtensions() {
    return new AsyncIterableObject((emitter) => this._doResolveExtensions(emitter));
  }
  async _doResolveExtensions(emitter) {
    if (!this._browserEnvironmentService.expectsResolverExtension) {
      return this._resolveExtensionsDefault(emitter);
    }
    const remoteAuthority = this._environmentService.remoteAuthority;
    await this._workspaceTrustManagementService.workspaceResolved;
    const localExtensions = await this._scanWebExtensions();
    const resolverExtensions = localExtensions.filter((extension) => isResolverExtension(extension));
    if (resolverExtensions.length) {
      emitter.emitOne(new ResolverExtensions(resolverExtensions));
    }
    let resolverResult;
    try {
      resolverResult = await this._resolveAuthorityInitial(remoteAuthority);
    } catch (err) {
      if (RemoteAuthorityResolverError.isHandled(err)) {
        console.log(`Error handled: Not showing a notification for the error`);
      }
      this._remoteAuthorityResolverService._setResolvedAuthorityError(remoteAuthority, err);
      return this._resolveExtensionsDefault(emitter);
    }
    this._remoteAuthorityResolverService._setResolvedAuthority(resolverResult.authority, resolverResult.options);
    this._remoteExplorerService.setTunnelInformation(resolverResult.tunnelInformation);
    const connection = this._remoteAgentService.getConnection();
    if (connection) {
      connection.onDidStateChange(async (e) => {
        if (e.type === PersistentConnectionEventType.ConnectionLost) {
          this._remoteAuthorityResolverService._clearResolvedAuthority(remoteAuthority);
        }
      });
      connection.onReconnecting(() => this._resolveAuthorityAgain());
    }
    return this._resolveExtensionsDefault(emitter);
  }
  async _onExtensionHostExit(code) {
    await this._doStopExtensionHosts();
    const automatedWindow = mainWindow;
    if (typeof automatedWindow.codeAutomationExit === "function") {
      automatedWindow.codeAutomationExit(code, await getLogs(this._fileService, this._environmentService));
    }
  }
  async _resolveAuthority(remoteAuthority) {
    return this._resolveAuthorityOnExtensionHosts(ExtensionHostKind.LocalWebWorker, remoteAuthority);
  }
};
ExtensionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkbenchExtensionEnablementService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IWorkbenchExtensionManagementService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionManifestPropertiesService),
  __decorateParam(11, IWebExtensionsScannerService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IRemoteAgentService),
  __decorateParam(14, IRemoteExtensionsScannerService),
  __decorateParam(15, ILifecycleService),
  __decorateParam(16, IRemoteAuthorityResolverService),
  __decorateParam(17, IUserDataInitializationService),
  __decorateParam(18, IUserDataProfileService),
  __decorateParam(19, IWorkspaceTrustManagementService),
  __decorateParam(20, IRemoteExplorerService),
  __decorateParam(21, IDialogService)
], ExtensionService);
let BrowserExtensionHostFactory = class {
  constructor(_extensionsProposedApi, _scanWebExtensions, _getExtensionRegistrySnapshotWhenReady, _instantiationService, _remoteAgentService, _remoteAuthorityResolverService, _extensionEnablementService, _logService) {
    this._extensionsProposedApi = _extensionsProposedApi;
    this._scanWebExtensions = _scanWebExtensions;
    this._getExtensionRegistrySnapshotWhenReady = _getExtensionRegistrySnapshotWhenReady;
    this._instantiationService = _instantiationService;
    this._remoteAgentService = _remoteAgentService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._extensionEnablementService = _extensionEnablementService;
    this._logService = _logService;
  }
  createExtensionHost(runningLocations, runningLocation, isInitialStart) {
    switch (runningLocation.kind) {
      case ExtensionHostKind.LocalProcess: {
        return null;
      }
      case ExtensionHostKind.LocalWebWorker: {
        const startup = isInitialStart ? ExtensionHostStartup.EagerManualStart : ExtensionHostStartup.EagerAutoStart;
        return this._instantiationService.createInstance(WebWorkerExtensionHost, runningLocation, startup, this._createLocalExtensionHostDataProvider(runningLocations, runningLocation, isInitialStart));
      }
      case ExtensionHostKind.Remote: {
        const remoteAgentConnection = this._remoteAgentService.getConnection();
        if (remoteAgentConnection) {
          return this._instantiationService.createInstance(RemoteExtensionHost, runningLocation, this._createRemoteExtensionHostDataProvider(runningLocations, remoteAgentConnection.remoteAuthority));
        }
        return null;
      }
    }
  }
  _createLocalExtensionHostDataProvider(runningLocations, desiredRunningLocation, isInitialStart) {
    return {
      getInitData: async () => {
        if (isInitialStart) {
          const localExtensions = checkEnabledAndProposedAPI(
            this._logService,
            this._extensionEnablementService,
            this._extensionsProposedApi,
            await this._scanWebExtensions(),
            /* ignore workspace trust */
            true
          );
          const runningLocation = runningLocations.computeRunningLocation(localExtensions, [], false);
          const myExtensions = filterExtensionDescriptions(localExtensions, runningLocation, (extRunningLocation) => desiredRunningLocation.equals(extRunningLocation));
          const extensions = new ExtensionHostExtensions(0, localExtensions, myExtensions.map((extension) => extension.identifier));
          return { extensions };
        } else {
          const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
          const myExtensions = runningLocations.filterByRunningLocation(snapshot.extensions, desiredRunningLocation);
          const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
          return { extensions };
        }
      }
    };
  }
  _createRemoteExtensionHostDataProvider(runningLocations, remoteAuthority) {
    return {
      remoteAuthority,
      getInitData: async () => {
        const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
        const remoteEnv = await this._remoteAgentService.getEnvironment();
        if (!remoteEnv) {
          throw new Error("Cannot provide init data for remote extension host!");
        }
        const myExtensions = runningLocations.filterByExtensionHostKind(snapshot.extensions, ExtensionHostKind.Remote);
        const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
        return {
          connectionData: this._remoteAuthorityResolverService.getConnectionData(remoteAuthority),
          pid: remoteEnv.pid,
          appRoot: remoteEnv.appRoot,
          extensionHostLogsPath: remoteEnv.extensionHostLogsPath,
          globalStorageHome: remoteEnv.globalStorageHome,
          workspaceStorageHome: remoteEnv.workspaceStorageHome,
          extensions
        };
      }
    };
  }
};
BrowserExtensionHostFactory = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IRemoteAgentService),
  __decorateParam(5, IRemoteAuthorityResolverService),
  __decorateParam(6, IWorkbenchExtensionEnablementService),
  __decorateParam(7, ILogService)
], BrowserExtensionHostFactory);
let BrowserExtensionHostKindPicker = class {
  constructor(_logService) {
    this._logService = _logService;
  }
  pickExtensionHostKind(extensionId, extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = BrowserExtensionHostKindPicker.pickRunningLocation(extensionKinds, isInstalledLocally, isInstalledRemotely, preference);
    this._logService.trace(`pickRunningLocation for ${extensionId.value}, extension kinds: [${extensionKinds.join(", ")}], isInstalledLocally: ${isInstalledLocally}, isInstalledRemotely: ${isInstalledRemotely}, preference: ${extensionRunningPreferenceToString(preference)} => ${extensionHostKindToString(result)}`);
    return result;
  }
  static pickRunningLocation(extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = [];
    let canRunRemotely = false;
    for (const extensionKind of extensionKinds) {
      if (extensionKind === "ui" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          canRunRemotely = true;
        }
      }
      if (extensionKind === "workspace" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          result.push(ExtensionHostKind.Remote);
        }
      }
      if (extensionKind === "web" && (isInstalledLocally || isInstalledRemotely)) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalWebWorker;
        } else {
          result.push(ExtensionHostKind.LocalWebWorker);
        }
      }
    }
    if (canRunRemotely) {
      result.push(ExtensionHostKind.Remote);
    }
    return result.length > 0 ? result[0] : null;
  }
};
BrowserExtensionHostKindPicker = __decorateClass([
  __decorateParam(0, ILogService)
], BrowserExtensionHostKindPicker);
registerSingleton(IExtensionService, ExtensionService, InstantiationType.Eager);
export {
  BrowserExtensionHostKindPicker,
  ExtensionService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvblNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQXV0b21hdGVkV2luZG93LCBnZXRMb2dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2Jyb3dzZXIvbG9nLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRDb25uZWN0aW9uLmpzJztcbmltcG9ydCB7IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IsIFJlc29sdmVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHRlbnNpb25zU2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsIElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJV2ViV29ya2VyRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlciwgSVdlYldvcmtlckV4dGVuc2lvbkhvc3RJbml0RGF0YSwgV2ViV29ya2VyRXh0ZW5zaW9uSG9zdCB9IGZyb20gJy4vd2ViV29ya2VyRXh0ZW5zaW9uSG9zdC5qcyc7XG5pbXBvcnQgeyBGZXRjaEZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4vd2ViV29ya2VyRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZSwgSUV4dGVuc2lvbkhvc3RGYWN0b3J5LCBMb2NhbEV4dGVuc2lvbnMsIFJlbW90ZUV4dGVuc2lvbnMsIFJlc29sdmVkRXh0ZW5zaW9ucywgUmVzb2x2ZXJFeHRlbnNpb25zLCBjaGVja0VuYWJsZWRBbmRQcm9wb3NlZEFQSSwgaXNSZXNvbHZlckV4dGVuc2lvbiB9IGZyb20gJy4uL2NvbW1vbi9hYnN0cmFjdEV4dGVuc2lvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeVNuYXBzaG90IH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSG9zdEtpbmQsIEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLCBJRXh0ZW5zaW9uSG9zdEtpbmRQaWNrZXIsIGV4dGVuc2lvbkhvc3RLaW5kVG9TdHJpbmcsIGV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlVG9TdHJpbmcgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uSG9zdEtpbmQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb24gfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIsIGZpbHRlckV4dGVuc2lvbkRlc2NyaXB0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25SdW5uaW5nTG9jYXRpb25UcmFja2VyLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RFeHRlbnNpb25zLCBFeHRlbnNpb25Ib3N0U3RhcnR1cCwgSUV4dGVuc2lvbkhvc3QsIElFeHRlbnNpb25TZXJ2aWNlLCB0b0V4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnNQcm9wb3NlZEFwaS5qcyc7XG5pbXBvcnQgeyBkZWR1cEV4dGVuc2lvbnMgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc1V0aWwuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIsIElSZW1vdGVFeHRlbnNpb25Ib3N0SW5pdERhdGEsIFJlbW90ZUV4dGVuc2lvbkhvc3QgfSBmcm9tICcuLi9jb21tb24vcmVtb3RlRXh0ZW5zaW9uSG9zdC5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uL3JlbW90ZS9jb21tb24vcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhL2Jyb3dzZXIvdXNlckRhdGFJbml0LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgQXN5bmNJdGVyYWJsZUVtaXR0ZXIsIEFzeW5jSXRlcmFibGVPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25TZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlIGltcGxlbWVudHMgSUV4dGVuc2lvblNlcnZpY2Uge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Jyb3dzZXJFbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZTogSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UsXG5cdFx0QElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJV2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91c2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZTogSVVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlRXhwbG9yZXJTZXJ2aWNlOiBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1Byb3Bvc2VkQXBpID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpKTtcblx0XHRjb25zdCBleHRlbnNpb25Ib3N0RmFjdG9yeSA9IG5ldyBCcm93c2VyRXh0ZW5zaW9uSG9zdEZhY3RvcnkoXG5cdFx0XHRleHRlbnNpb25zUHJvcG9zZWRBcGksXG5cdFx0XHQoKSA9PiB0aGlzLl9zY2FuV2ViRXh0ZW5zaW9ucygpLFxuXHRcdFx0KCkgPT4gdGhpcy5fZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0XHRleHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRcdGxvZ1NlcnZpY2Vcblx0XHQpO1xuXHRcdHN1cGVyKFxuXHRcdFx0eyBoYXNMb2NhbFByb2Nlc3M6IGZhbHNlLCBhbGxvd1JlbW90ZUV4dGVuc2lvbnNJbkxvY2FsV2ViV29ya2VyOiB0cnVlIH0sXG5cdFx0XHRleHRlbnNpb25zUHJvcG9zZWRBcGksXG5cdFx0XHRleHRlbnNpb25Ib3N0RmFjdG9yeSxcblx0XHRcdG5ldyBCcm93c2VyRXh0ZW5zaW9uSG9zdEtpbmRQaWNrZXIobG9nU2VydmljZSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0XHRfYnJvd3NlckVudmlyb25tZW50U2VydmljZSxcblx0XHRcdHRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHRleHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRcdGZpbGVTZXJ2aWNlLFxuXHRcdFx0cHJvZHVjdFNlcnZpY2UsXG5cdFx0XHRleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRcdGNvbnRleHRTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHRcdFx0bG9nU2VydmljZSxcblx0XHRcdHJlbW90ZUFnZW50U2VydmljZSxcblx0XHRcdHJlbW90ZUV4dGVuc2lvbnNTY2FubmVyU2VydmljZSxcblx0XHRcdGxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0XHRkaWFsb2dTZXJ2aWNlXG5cdFx0KTtcblxuXHRcdC8vIEluaXRpYWxpemUgaW5zdGFsbGVkIGV4dGVuc2lvbnMgZmlyc3QgYW5kIGRvIGl0IG9ubHkgYWZ0ZXIgd29ya2JlbmNoIGlzIHJlYWR5XG5cdFx0bGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLlJlYWR5KS50aGVuKGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuX3VzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLmluaXRpYWxpemVJbnN0YWxsZWRFeHRlbnNpb25zKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdHRoaXMuX2luaXRpYWxpemUoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2luaXRGZXRjaEZpbGVTeXN0ZW0oKTtcblx0fVxuXG5cdHByaXZhdGUgX2luaXRGZXRjaEZpbGVTeXN0ZW0oKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgRmV0Y2hGaWxlU3lzdGVtUHJvdmlkZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuaHR0cCwgcHJvdmlkZXIpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuaHR0cHMsIHByb3ZpZGVyKSk7XG5cdH1cblxuXHRwcml2YXRlIF9zY2FuV2ViRXh0ZW5zaW9uc1Byb21pc2U6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uW10+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFzeW5jIF9zY2FuV2ViRXh0ZW5zaW9ucygpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPiB7XG5cdFx0aWYgKCF0aGlzLl9zY2FuV2ViRXh0ZW5zaW9uc1Byb21pc2UpIHtcblx0XHRcdHRoaXMuX3NjYW5XZWJFeHRlbnNpb25zUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN5c3RlbTogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXSwgdXNlcjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXSwgZGV2ZWxvcG1lbnQ6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdID0gW107XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdFx0dGhpcy5fd2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5TeXN0ZW1FeHRlbnNpb25zKCkudGhlbihleHRlbnNpb25zID0+IHN5c3RlbS5wdXNoKC4uLmV4dGVuc2lvbnMubWFwKGUgPT4gdG9FeHRlbnNpb25EZXNjcmlwdGlvbihlKSkpKSxcblx0XHRcdFx0XHRcdHRoaXMuX3dlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuVXNlckV4dGVuc2lvbnModGhpcy5fdXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UsIHsgc2tpcEludmFsaWRFeHRlbnNpb25zOiB0cnVlIH0pLnRoZW4oZXh0ZW5zaW9ucyA9PiB1c2VyLnB1c2goLi4uZXh0ZW5zaW9ucy5tYXAoZSA9PiB0b0V4dGVuc2lvbkRlc2NyaXB0aW9uKGUpKSkpLFxuXHRcdFx0XHRcdFx0dGhpcy5fd2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5FeHRlbnNpb25zVW5kZXJEZXZlbG9wbWVudCgpLnRoZW4oZXh0ZW5zaW9ucyA9PiBkZXZlbG9wbWVudC5wdXNoKC4uLmV4dGVuc2lvbnMubWFwKGUgPT4gdG9FeHRlbnNpb25EZXNjcmlwdGlvbihlLCB0cnVlKSkpKVxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBkZWR1cEV4dGVuc2lvbnMoc3lzdGVtLCB1c2VyLCBbXSwgZGV2ZWxvcG1lbnQsIHRoaXMuX2xvZ1NlcnZpY2UpO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3NjYW5XZWJFeHRlbnNpb25zUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVFeHRlbnNpb25zRGVmYXVsdChlbWl0dGVyOiBBc3luY0l0ZXJhYmxlRW1pdHRlcjxSZXNvbHZlZEV4dGVuc2lvbnM+KSB7XG5cdFx0Y29uc3QgW2xvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9uc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHR0aGlzLl9zY2FuV2ViRXh0ZW5zaW9ucygpLFxuXHRcdFx0dGhpcy5fcmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5FeHRlbnNpb25zKClcblx0XHRdKTtcblxuXHRcdGlmIChyZW1vdGVFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0ZW1pdHRlci5lbWl0T25lKG5ldyBSZW1vdGVFeHRlbnNpb25zKHJlbW90ZUV4dGVuc2lvbnMpKTtcblx0XHR9XG5cdFx0ZW1pdHRlci5lbWl0T25lKG5ldyBMb2NhbEV4dGVuc2lvbnMobG9jYWxFeHRlbnNpb25zKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3Jlc29sdmVFeHRlbnNpb25zKCk6IEFzeW5jSXRlcmFibGU8UmVzb2x2ZWRFeHRlbnNpb25zPiB7XG5cdFx0cmV0dXJuIG5ldyBBc3luY0l0ZXJhYmxlT2JqZWN0KGVtaXR0ZXIgPT4gdGhpcy5fZG9SZXNvbHZlRXh0ZW5zaW9ucyhlbWl0dGVyKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kb1Jlc29sdmVFeHRlbnNpb25zKGVtaXR0ZXI6IEFzeW5jSXRlcmFibGVFbWl0dGVyPFJlc29sdmVkRXh0ZW5zaW9ucz4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX2Jyb3dzZXJFbnZpcm9ubWVudFNlcnZpY2UuZXhwZWN0c1Jlc29sdmVyRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZUV4dGVuc2lvbnNEZWZhdWx0KGVtaXR0ZXIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkhO1xuXG5cdFx0Ly8gTm93IHRoYXQgdGhlIGNhbm9uaWNhbCBVUkkgcHJvdmlkZXIgaGFzIGJlZW4gcmVnaXN0ZXJlZCwgd2UgbmVlZCB0byB3YWl0IGZvciB0aGUgdHJ1c3Qgc3RhdGUgdG8gYmVcblx0XHQvLyBjYWxjdWxhdGVkLiBUaGUgdHJ1c3Qgc3RhdGUgd2lsbCBiZSB1c2VkIHdoaWxlIHJlc29sdmluZyB0aGUgYXV0aG9yaXR5LCBob3dldmVyIHRoZSByZXNvbHZlciBjYW5cblx0XHQvLyBvdmVycmlkZSB0aGUgdHJ1c3Qgc3RhdGUgdGhyb3VnaCB0aGUgcmVzb2x2ZXIgcmVzdWx0LlxuXHRcdGF3YWl0IHRoaXMuX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlUmVzb2x2ZWQ7XG5cblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLl9zY2FuV2ViRXh0ZW5zaW9ucygpO1xuXHRcdGNvbnN0IHJlc29sdmVyRXh0ZW5zaW9ucyA9IGxvY2FsRXh0ZW5zaW9ucy5maWx0ZXIoZXh0ZW5zaW9uID0+IGlzUmVzb2x2ZXJFeHRlbnNpb24oZXh0ZW5zaW9uKSk7XG5cdFx0aWYgKHJlc29sdmVyRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdGVtaXR0ZXIuZW1pdE9uZShuZXcgUmVzb2x2ZXJFeHRlbnNpb25zKHJlc29sdmVyRXh0ZW5zaW9ucykpO1xuXHRcdH1cblxuXHRcdGxldCByZXNvbHZlclJlc3VsdDogUmVzb2x2ZXJSZXN1bHQ7XG5cdFx0dHJ5IHtcblx0XHRcdHJlc29sdmVyUmVzdWx0ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUF1dGhvcml0eUluaXRpYWwocmVtb3RlQXV0aG9yaXR5KTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGlmIChSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yLmlzSGFuZGxlZChlcnIpKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBoYW5kbGVkOiBOb3Qgc2hvd2luZyBhIG5vdGlmaWNhdGlvbiBmb3IgdGhlIGVycm9yYCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuX3NldFJlc29sdmVkQXV0aG9yaXR5RXJyb3IocmVtb3RlQXV0aG9yaXR5LCBlcnIpO1xuXG5cdFx0XHQvLyBQcm9jZWVkIHdpdGggdGhlIGxvY2FsIGV4dGVuc2lvbiBob3N0XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZUV4dGVuc2lvbnNEZWZhdWx0KGVtaXR0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIHNldCB0aGUgcmVzb2x2ZWQgYXV0aG9yaXR5XG5cdFx0dGhpcy5fcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLl9zZXRSZXNvbHZlZEF1dGhvcml0eShyZXNvbHZlclJlc3VsdC5hdXRob3JpdHksIHJlc29sdmVyUmVzdWx0Lm9wdGlvbnMpO1xuXHRcdHRoaXMuX3JlbW90ZUV4cGxvcmVyU2VydmljZS5zZXRUdW5uZWxJbmZvcm1hdGlvbihyZXNvbHZlclJlc3VsdC50dW5uZWxJbmZvcm1hdGlvbik7XG5cblx0XHQvLyBtb25pdG9yIGZvciBicmVha2FnZVxuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpO1xuXHRcdGlmIChjb25uZWN0aW9uKSB7XG5cdFx0XHRjb25uZWN0aW9uLm9uRGlkU3RhdGVDaGFuZ2UoYXN5bmMgKGUpID0+IHtcblx0XHRcdFx0aWYgKGUudHlwZSA9PT0gUGVyc2lzdGVudENvbm5lY3Rpb25FdmVudFR5cGUuQ29ubmVjdGlvbkxvc3QpIHtcblx0XHRcdFx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuX2NsZWFyUmVzb2x2ZWRBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjb25uZWN0aW9uLm9uUmVjb25uZWN0aW5nKCgpID0+IHRoaXMuX3Jlc29sdmVBdXRob3JpdHlBZ2FpbigpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZUV4dGVuc2lvbnNEZWZhdWx0KGVtaXR0ZXIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9vbkV4dGVuc2lvbkhvc3RFeGl0KGNvZGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIERpc3Bvc2UgZXZlcnl0aGluZyBhc3NvY2lhdGVkIHdpdGggdGhlIGV4dGVuc2lvbiBob3N0XG5cdFx0YXdhaXQgdGhpcy5fZG9TdG9wRXh0ZW5zaW9uSG9zdHMoKTtcblxuXHRcdC8vIElmIHdlIGFyZSBydW5uaW5nIGV4dGVuc2lvbiB0ZXN0cywgZm9yd2FyZCBsb2dzIGFuZCBleGl0IGNvZGVcblx0XHRjb25zdCBhdXRvbWF0ZWRXaW5kb3cgPSBtYWluV2luZG93IGFzIHVua25vd24gYXMgSUF1dG9tYXRlZFdpbmRvdztcblx0XHRpZiAodHlwZW9mIGF1dG9tYXRlZFdpbmRvdy5jb2RlQXV0b21hdGlvbkV4aXQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGF1dG9tYXRlZFdpbmRvdy5jb2RlQXV0b21hdGlvbkV4aXQoY29kZSwgYXdhaXQgZ2V0TG9ncyh0aGlzLl9maWxlU2VydmljZSwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9yZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxSZXNvbHZlclJlc3VsdD4ge1xuXHRcdHJldHVybiB0aGlzLl9yZXNvbHZlQXV0aG9yaXR5T25FeHRlbnNpb25Ib3N0cyhFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFdlYldvcmtlciwgcmVtb3RlQXV0aG9yaXR5KTtcblx0fVxufVxuXG5jbGFzcyBCcm93c2VyRXh0ZW5zaW9uSG9zdEZhY3RvcnkgaW1wbGVtZW50cyBJRXh0ZW5zaW9uSG9zdEZhY3Rvcnkge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbnNQcm9wb3NlZEFwaTogRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NjYW5XZWJFeHRlbnNpb25zOiAoKSA9PiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9nZXRFeHRlbnNpb25SZWdpc3RyeVNuYXBzaG90V2hlblJlYWR5OiAoKSA9PiBQcm9taXNlPEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnlTbmFwc2hvdD4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3JlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7IH1cblxuXHRjcmVhdGVFeHRlbnNpb25Ib3N0KHJ1bm5pbmdMb2NhdGlvbnM6IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIsIHJ1bm5pbmdMb2NhdGlvbjogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uLCBpc0luaXRpYWxTdGFydDogYm9vbGVhbik6IElFeHRlbnNpb25Ib3N0IHwgbnVsbCB7XG5cdFx0c3dpdGNoIChydW5uaW5nTG9jYXRpb24ua2luZCkge1xuXHRcdFx0Y2FzZSBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3M6IHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsV2ViV29ya2VyOiB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0dXAgPSAoXG5cdFx0XHRcdFx0aXNJbml0aWFsU3RhcnRcblx0XHRcdFx0XHRcdD8gRXh0ZW5zaW9uSG9zdFN0YXJ0dXAuRWFnZXJNYW51YWxTdGFydFxuXHRcdFx0XHRcdFx0OiBFeHRlbnNpb25Ib3N0U3RhcnR1cC5FYWdlckF1dG9TdGFydFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2ViV29ya2VyRXh0ZW5zaW9uSG9zdCwgcnVubmluZ0xvY2F0aW9uLCBzdGFydHVwLCB0aGlzLl9jcmVhdGVMb2NhbEV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIocnVubmluZ0xvY2F0aW9ucywgcnVubmluZ0xvY2F0aW9uLCBpc0luaXRpYWxTdGFydCkpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBFeHRlbnNpb25Ib3N0S2luZC5SZW1vdGU6IHtcblx0XHRcdFx0Y29uc3QgcmVtb3RlQWdlbnRDb25uZWN0aW9uID0gdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKTtcblx0XHRcdFx0aWYgKHJlbW90ZUFnZW50Q29ubmVjdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZW1vdGVFeHRlbnNpb25Ib3N0LCBydW5uaW5nTG9jYXRpb24sIHRoaXMuX2NyZWF0ZVJlbW90ZUV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIocnVubmluZ0xvY2F0aW9ucywgcmVtb3RlQWdlbnRDb25uZWN0aW9uLnJlbW90ZUF1dGhvcml0eSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUxvY2FsRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlcihydW5uaW5nTG9jYXRpb25zOiBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb25UcmFja2VyLCBkZXNpcmVkUnVubmluZ0xvY2F0aW9uOiBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb24sIGlzSW5pdGlhbFN0YXJ0OiBib29sZWFuKTogSVdlYldvcmtlckV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRJbml0RGF0YTogYXN5bmMgKCk6IFByb21pc2U8SVdlYldvcmtlckV4dGVuc2lvbkhvc3RJbml0RGF0YT4gPT4ge1xuXHRcdFx0XHRpZiAoaXNJbml0aWFsU3RhcnQpIHtcblx0XHRcdFx0XHQvLyBIZXJlIHdlIGxvYWQgZXZlbiBleHRlbnNpb25zIHRoYXQgd291bGQgYmUgZGlzYWJsZWQgYnkgd29ya3NwYWNlIHRydXN0XG5cdFx0XHRcdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gY2hlY2tFbmFibGVkQW5kUHJvcG9zZWRBUEkodGhpcy5fbG9nU2VydmljZSwgdGhpcy5fZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIHRoaXMuX2V4dGVuc2lvbnNQcm9wb3NlZEFwaSwgYXdhaXQgdGhpcy5fc2NhbldlYkV4dGVuc2lvbnMoKSwgLyogaWdub3JlIHdvcmtzcGFjZSB0cnVzdCAqL3RydWUpO1xuXHRcdFx0XHRcdGNvbnN0IHJ1bm5pbmdMb2NhdGlvbiA9IHJ1bm5pbmdMb2NhdGlvbnMuY29tcHV0ZVJ1bm5pbmdMb2NhdGlvbihsb2NhbEV4dGVuc2lvbnMsIFtdLCBmYWxzZSk7XG5cdFx0XHRcdFx0Y29uc3QgbXlFeHRlbnNpb25zID0gZmlsdGVyRXh0ZW5zaW9uRGVzY3JpcHRpb25zKGxvY2FsRXh0ZW5zaW9ucywgcnVubmluZ0xvY2F0aW9uLCBleHRSdW5uaW5nTG9jYXRpb24gPT4gZGVzaXJlZFJ1bm5pbmdMb2NhdGlvbi5lcXVhbHMoZXh0UnVubmluZ0xvY2F0aW9uKSk7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IG5ldyBFeHRlbnNpb25Ib3N0RXh0ZW5zaW9ucygwLCBsb2NhbEV4dGVuc2lvbnMsIG15RXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucyB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHJlc3RhcnQgY2FzZVxuXHRcdFx0XHRcdGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgdGhpcy5fZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpO1xuXHRcdFx0XHRcdGNvbnN0IG15RXh0ZW5zaW9ucyA9IHJ1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlSdW5uaW5nTG9jYXRpb24oc25hcHNob3QuZXh0ZW5zaW9ucywgZGVzaXJlZFJ1bm5pbmdMb2NhdGlvbik7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IG5ldyBFeHRlbnNpb25Ib3N0RXh0ZW5zaW9ucyhzbmFwc2hvdC52ZXJzaW9uSWQsIHNuYXBzaG90LmV4dGVuc2lvbnMsIG15RXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVJlbW90ZUV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIocnVubmluZ0xvY2F0aW9uczogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uVHJhY2tlciwgcmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcpOiBJUmVtb3RlRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlbW90ZUF1dGhvcml0eTogcmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0Z2V0SW5pdERhdGE6IGFzeW5jICgpOiBQcm9taXNlPElSZW1vdGVFeHRlbnNpb25Ib3N0SW5pdERhdGE+ID0+IHtcblx0XHRcdFx0Y29uc3Qgc25hcHNob3QgPSBhd2FpdCB0aGlzLl9nZXRFeHRlbnNpb25SZWdpc3RyeVNuYXBzaG90V2hlblJlYWR5KCk7XG5cblx0XHRcdFx0Y29uc3QgcmVtb3RlRW52ID0gYXdhaXQgdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0XHRcdGlmICghcmVtb3RlRW52KSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcHJvdmlkZSBpbml0IGRhdGEgZm9yIHJlbW90ZSBleHRlbnNpb24gaG9zdCEnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG15RXh0ZW5zaW9ucyA9IHJ1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlFeHRlbnNpb25Ib3N0S2luZChzbmFwc2hvdC5leHRlbnNpb25zLCBFeHRlbnNpb25Ib3N0S2luZC5SZW1vdGUpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gbmV3IEV4dGVuc2lvbkhvc3RFeHRlbnNpb25zKHNuYXBzaG90LnZlcnNpb25JZCwgc25hcHNob3QuZXh0ZW5zaW9ucywgbXlFeHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNvbm5lY3Rpb25EYXRhOiB0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuZ2V0Q29ubmVjdGlvbkRhdGEocmVtb3RlQXV0aG9yaXR5KSxcblx0XHRcdFx0XHRwaWQ6IHJlbW90ZUVudi5waWQsXG5cdFx0XHRcdFx0YXBwUm9vdDogcmVtb3RlRW52LmFwcFJvb3QsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSG9zdExvZ3NQYXRoOiByZW1vdGVFbnYuZXh0ZW5zaW9uSG9zdExvZ3NQYXRoLFxuXHRcdFx0XHRcdGdsb2JhbFN0b3JhZ2VIb21lOiByZW1vdGVFbnYuZ2xvYmFsU3RvcmFnZUhvbWUsXG5cdFx0XHRcdFx0d29ya3NwYWNlU3RvcmFnZUhvbWU6IHJlbW90ZUVudi53b3Jrc3BhY2VTdG9yYWdlSG9tZSxcblx0XHRcdFx0XHRleHRlbnNpb25zLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJyb3dzZXJFeHRlbnNpb25Ib3N0S2luZFBpY2tlciBpbXBsZW1lbnRzIElFeHRlbnNpb25Ib3N0S2luZFBpY2tlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHBpY2tFeHRlbnNpb25Ib3N0S2luZChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZXh0ZW5zaW9uS2luZHM6IEV4dGVuc2lvbktpbmRbXSwgaXNJbnN0YWxsZWRMb2NhbGx5OiBib29sZWFuLCBpc0luc3RhbGxlZFJlbW90ZWx5OiBib29sZWFuLCBwcmVmZXJlbmNlOiBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZSk6IEV4dGVuc2lvbkhvc3RLaW5kIHwgbnVsbCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gQnJvd3NlckV4dGVuc2lvbkhvc3RLaW5kUGlja2VyLnBpY2tSdW5uaW5nTG9jYXRpb24oZXh0ZW5zaW9uS2luZHMsIGlzSW5zdGFsbGVkTG9jYWxseSwgaXNJbnN0YWxsZWRSZW1vdGVseSwgcHJlZmVyZW5jZSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgcGlja1J1bm5pbmdMb2NhdGlvbiBmb3IgJHtleHRlbnNpb25JZC52YWx1ZX0sIGV4dGVuc2lvbiBraW5kczogWyR7ZXh0ZW5zaW9uS2luZHMuam9pbignLCAnKX1dLCBpc0luc3RhbGxlZExvY2FsbHk6ICR7aXNJbnN0YWxsZWRMb2NhbGx5fSwgaXNJbnN0YWxsZWRSZW1vdGVseTogJHtpc0luc3RhbGxlZFJlbW90ZWx5fSwgcHJlZmVyZW5jZTogJHtleHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZVRvU3RyaW5nKHByZWZlcmVuY2UpfSA9PiAke2V4dGVuc2lvbkhvc3RLaW5kVG9TdHJpbmcocmVzdWx0KX1gKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBwaWNrUnVubmluZ0xvY2F0aW9uKGV4dGVuc2lvbktpbmRzOiBFeHRlbnNpb25LaW5kW10sIGlzSW5zdGFsbGVkTG9jYWxseTogYm9vbGVhbiwgaXNJbnN0YWxsZWRSZW1vdGVseTogYm9vbGVhbiwgcHJlZmVyZW5jZTogRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UpOiBFeHRlbnNpb25Ib3N0S2luZCB8IG51bGwge1xuXHRcdGNvbnN0IHJlc3VsdDogRXh0ZW5zaW9uSG9zdEtpbmRbXSA9IFtdO1xuXHRcdGxldCBjYW5SdW5SZW1vdGVseSA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uS2luZCBvZiBleHRlbnNpb25LaW5kcykge1xuXHRcdFx0aWYgKGV4dGVuc2lvbktpbmQgPT09ICd1aScgJiYgaXNJbnN0YWxsZWRSZW1vdGVseSkge1xuXHRcdFx0XHQvLyB1aSBleHRlbnNpb25zIHJ1biByZW1vdGVseSBpZiBwb3NzaWJsZSAoYnV0IG9ubHkgYXMgYSBsYXN0IHJlc29ydClcblx0XHRcdFx0aWYgKHByZWZlcmVuY2UgPT09IEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLlJlbW90ZSkge1xuXHRcdFx0XHRcdHJldHVybiBFeHRlbnNpb25Ib3N0S2luZC5SZW1vdGU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FuUnVuUmVtb3RlbHkgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9uS2luZCA9PT0gJ3dvcmtzcGFjZScgJiYgaXNJbnN0YWxsZWRSZW1vdGVseSkge1xuXHRcdFx0XHQvLyB3b3Jrc3BhY2UgZXh0ZW5zaW9ucyBydW4gcmVtb3RlbHkgaWYgcG9zc2libGVcblx0XHRcdFx0aWYgKHByZWZlcmVuY2UgPT09IEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLk5vbmUgfHwgcHJlZmVyZW5jZSA9PT0gRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UuUmVtb3RlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIEV4dGVuc2lvbkhvc3RLaW5kLlJlbW90ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChFeHRlbnNpb25Ib3N0S2luZC5SZW1vdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9uS2luZCA9PT0gJ3dlYicgJiYgKGlzSW5zdGFsbGVkTG9jYWxseSB8fCBpc0luc3RhbGxlZFJlbW90ZWx5KSkge1xuXHRcdFx0XHQvLyB3ZWIgd29ya2VyIGV4dGVuc2lvbnMgcnVuIGluIHRoZSBsb2NhbCB3ZWIgd29ya2VyIGlmIHBvc3NpYmxlXG5cdFx0XHRcdGlmIChwcmVmZXJlbmNlID09PSBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZS5Ob25lIHx8IHByZWZlcmVuY2UgPT09IEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLkxvY2FsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsV2ViV29ya2VyO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsV2ViV29ya2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY2FuUnVuUmVtb3RlbHkpIHtcblx0XHRcdHJlc3VsdC5wdXNoKEV4dGVuc2lvbkhvc3RLaW5kLlJlbW90ZSk7XG5cdFx0fVxuXHRcdHJldHVybiAocmVzdWx0Lmxlbmd0aCA+IDAgPyByZXN1bHRbMF0gOiBudWxsKTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJRXh0ZW5zaW9uU2VydmljZSwgRXh0ZW5zaW9uU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFHL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQTJCLGVBQWU7QUFDMUMsU0FBUyxtQkFBbUI7QUFD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
