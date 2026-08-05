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
import { runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Schemas } from "../../../../base/common/network.js";
import * as performance from "../../../../base/common/performance.js";
import { isCI } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IRemoteAuthorityResolverService, RemoteAuthorityResolverError, RemoteConnectionType, getRemoteAuthorityPrefix } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteExtensionsScannerService } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import { getRemoteName, parseAuthorityWithPort } from "../../../../platform/remote/common/remoteHosts.js";
import { updateProxyConfigurationsScope } from "../../../../platform/request/common/request.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { EnablementState, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { WebWorkerExtensionHost } from "../browser/webWorkerExtensionHost.js";
import { AbstractExtensionService, ExtensionHostCrashTracker, LocalExtensions, RemoteExtensions, ResolverExtensions, checkEnabledAndProposedAPI, extensionIsEnabled, isResolverExtension } from "../common/abstractExtensionService.js";
import { parseExtensionDevOptions } from "../common/extensionDevOptions.js";
import { ExtensionHostKind, ExtensionRunningPreference, extensionHostKindToString, extensionRunningPreferenceToString } from "../common/extensionHostKind.js";
import { ExtensionHostExitCode } from "../common/extensionHostProtocol.js";
import { IExtensionManifestPropertiesService } from "../common/extensionManifestPropertiesService.js";
import { filterExtensionDescriptions } from "../common/extensionRunningLocationTracker.js";
import { ExtensionHostExtensions, ExtensionHostStartup, IExtensionService, toExtension, webWorkerExtHostConfig } from "../common/extensions.js";
import { ExtensionsProposedApi } from "../common/extensionsProposedApi.js";
import { RemoteExtensionHost } from "../common/remoteExtensionHost.js";
import { CachedExtensionScanner } from "./cachedExtensionScanner.js";
import { NativeLocalProcessExtensionHost } from "./localProcessExtensionHost.js";
import { IHostService } from "../../host/browser/host.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IRemoteExplorerService } from "../../remote/common/remoteExplorerService.js";
import { AsyncIterableObject } from "../../../../base/common/async.js";
let NativeExtensionService = class extends AbstractExtensionService {
  constructor(instantiationService, notificationService, environmentService, telemetryService, extensionEnablementService, fileService, productService, extensionManagementService, contextService, configurationService, extensionManifestPropertiesService, logService, remoteAgentService, remoteExtensionsScannerService, lifecycleService, remoteAuthorityResolverService, _nativeHostService, _hostService, _remoteExplorerService, _extensionGalleryService, _workspaceTrustManagementService, dialogService) {
    const extensionsProposedApi = instantiationService.createInstance(ExtensionsProposedApi);
    const extensionScanner = instantiationService.createInstance(CachedExtensionScanner);
    const extensionHostFactory = new NativeExtensionHostFactory(
      extensionsProposedApi,
      extensionScanner,
      () => this._getExtensionRegistrySnapshotWhenReady(),
      instantiationService,
      environmentService,
      extensionEnablementService,
      configurationService,
      remoteAgentService,
      remoteAuthorityResolverService,
      logService
    );
    super(
      { hasLocalProcess: true, allowRemoteExtensionsInLocalWebWorker: false },
      extensionsProposedApi,
      extensionHostFactory,
      new NativeExtensionHostKindPicker(environmentService, configurationService, logService),
      instantiationService,
      notificationService,
      environmentService,
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
    this._nativeHostService = _nativeHostService;
    this._hostService = _hostService;
    this._remoteExplorerService = _remoteExplorerService;
    this._extensionGalleryService = _extensionGalleryService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._localCrashTracker = new ExtensionHostCrashTracker();
    this._extensionScanner = extensionScanner;
    lifecycleService.when(LifecyclePhase.Ready).then(() => {
      runWhenWindowIdle(
        mainWindow,
        () => {
          this._initialize();
        },
        50
        /*max delay*/
      );
    });
  }
  async _scanAllLocalExtensions() {
    return this._extensionScanner.scannedExtensions;
  }
  _onExtensionHostCrashed(extensionHost, code, signal) {
    const activatedExtensions = [];
    const extensionsStatus = this.getExtensionsStatus();
    for (const key of Object.keys(extensionsStatus)) {
      const extensionStatus = extensionsStatus[key];
      if (extensionStatus.activationStarted && extensionHost.containsExtension(extensionStatus.id)) {
        activatedExtensions.push(extensionStatus.id);
      }
    }
    super._onExtensionHostCrashed(extensionHost, code, signal);
    if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
      if (code === ExtensionHostExitCode.VersionMismatch) {
        this._notificationService.prompt(
          Severity.Error,
          nls.localize("extensionService.versionMismatchCrash", "Extension host cannot start: version mismatch."),
          [{
            label: nls.localize("relaunch", "Relaunch VS Code"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const hostService = accessor.get(IHostService);
                hostService.restart();
              });
            }
          }]
        );
        return;
      }
      this._logExtensionHostCrash(extensionHost);
      this._sendExtensionHostCrashTelemetry(code, signal, activatedExtensions);
      this._localCrashTracker.registerCrash();
      if (this._localCrashTracker.shouldAutomaticallyRestart()) {
        this._logService.info(`Automatically restarting the extension host.`);
        this._notificationService.status(nls.localize("extensionService.autoRestart", "The extension host terminated unexpectedly. Restarting..."), { hideAfter: 5e3 });
        this.startExtensionHosts();
      } else {
        const choices = [];
        if (this._environmentService.isBuilt) {
          choices.push({
            label: nls.localize("startBisect", "Start Extension Bisect"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const commandService = accessor.get(ICommandService);
                commandService.executeCommand("extension.bisect.start");
              });
            }
          });
        } else {
          choices.push({
            label: nls.localize("devTools", "Open Developer Tools"),
            run: () => this._nativeHostService.openDevTools()
          });
        }
        choices.push({
          label: nls.localize("restart", "Restart Extension Host"),
          run: () => this.startExtensionHosts()
        });
        if (this._environmentService.isBuilt) {
          choices.push({
            label: nls.localize("learnMore", "Learn More"),
            run: () => {
              this._instantiationService.invokeFunction((accessor) => {
                const openerService = accessor.get(IOpenerService);
                openerService.open("https://aka.ms/vscode-extension-bisect");
              });
            }
          });
        }
        this._notificationService.prompt(Severity.Error, nls.localize("extensionService.crash", "Extension host terminated unexpectedly 3 times within the last 5 minutes."), choices);
      }
    }
  }
  _sendExtensionHostCrashTelemetry(code, signal, activatedExtensions) {
    this._telemetryService.publicLog2("extensionHostCrash", {
      code,
      signal,
      extensionIds: activatedExtensions.map((e) => e.value)
    });
    for (const extensionId of activatedExtensions) {
      this._telemetryService.publicLog2("extensionHostCrashExtension", {
        code,
        signal,
        extensionId: extensionId.value
      });
    }
  }
  // --- impl
  async _resolveAuthority(remoteAuthority) {
    const authorityPlusIndex = remoteAuthority.indexOf("+");
    if (authorityPlusIndex === -1) {
      const { host, port } = parseAuthorityWithPort(remoteAuthority);
      return {
        authority: {
          authority: remoteAuthority,
          connectTo: {
            type: RemoteConnectionType.WebSocket,
            host,
            port
          },
          connectionToken: void 0
        }
      };
    }
    return this._resolveAuthorityOnExtensionHosts(ExtensionHostKind.LocalProcess, remoteAuthority);
  }
  async _getCanonicalURI(remoteAuthority, uri) {
    const authorityPlusIndex = remoteAuthority.indexOf("+");
    if (authorityPlusIndex === -1) {
      return uri;
    }
    const localProcessExtensionHosts = this._getExtensionHostManagers(ExtensionHostKind.LocalProcess);
    if (localProcessExtensionHosts.length === 0) {
      throw new Error(`Cannot resolve canonical URI`);
    }
    const results = await Promise.all(localProcessExtensionHosts.map((extHost) => extHost.getCanonicalURI(remoteAuthority, uri)));
    for (const result of results) {
      if (result) {
        return result;
      }
    }
    throw new Error(`Cannot get canonical URI because no extension is installed to resolve ${getRemoteAuthorityPrefix(remoteAuthority)}`);
  }
  _resolveExtensions() {
    return new AsyncIterableObject((emitter) => this._doResolveExtensions(emitter));
  }
  async _doResolveExtensions(emitter) {
    this._extensionScanner.startScanningExtensions();
    const remoteAuthority = this._environmentService.remoteAuthority;
    let remoteEnv = null;
    let remoteExtensions = [];
    if (remoteAuthority) {
      this._remoteAuthorityResolverService._setCanonicalURIProvider(async (uri) => {
        if (uri.scheme !== Schemas.vscodeRemote || uri.authority !== remoteAuthority) {
          return uri;
        }
        performance.mark(`code/willGetCanonicalURI/${getRemoteAuthorityPrefix(remoteAuthority)}`);
        if (isCI) {
          this._logService.info(`Invoking getCanonicalURI for authority ${getRemoteAuthorityPrefix(remoteAuthority)}...`);
        }
        try {
          return this._getCanonicalURI(remoteAuthority, uri);
        } finally {
          performance.mark(`code/didGetCanonicalURI/${getRemoteAuthorityPrefix(remoteAuthority)}`);
          if (isCI) {
            this._logService.info(`getCanonicalURI returned for authority ${getRemoteAuthorityPrefix(remoteAuthority)}.`);
          }
        }
      });
      if (isCI) {
        this._logService.info(`Starting to wait on IWorkspaceTrustManagementService.workspaceResolved...`);
      }
      await this._workspaceTrustManagementService.workspaceResolved;
      if (isCI) {
        this._logService.info(`Finished waiting on IWorkspaceTrustManagementService.workspaceResolved.`);
      }
      const localExtensions = await this._scanAllLocalExtensions();
      const resolverExtensions = localExtensions.filter((extension) => isResolverExtension(extension));
      if (resolverExtensions.length) {
        emitter.emitOne(new ResolverExtensions(resolverExtensions));
      }
      let resolverResult;
      try {
        resolverResult = await this._resolveAuthorityInitial(remoteAuthority);
      } catch (err) {
        if (RemoteAuthorityResolverError.isNoResolverFound(err)) {
          err.isHandled = await this._handleNoResolverFound(remoteAuthority);
        } else {
          if (RemoteAuthorityResolverError.isHandled(err)) {
            console.log(`Error handled: Not showing a notification for the error`);
          }
        }
        this._remoteAuthorityResolverService._setResolvedAuthorityError(remoteAuthority, err);
        return this._startLocalExtensionHost(emitter);
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
      [remoteEnv, remoteExtensions] = await Promise.all([
        this._remoteAgentService.getEnvironment(),
        this._remoteExtensionsScannerService.scanExtensions()
      ]);
      if (!remoteEnv) {
        this._notificationService.notify({ severity: Severity.Error, message: nls.localize("getEnvironmentFailure", "Could not fetch remote environment") });
        return this._startLocalExtensionHost(emitter);
      }
      const useHostProxyDefault = remoteEnv.useHostProxy;
      this._register(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("http.useLocalProxyConfiguration")) {
          updateProxyConfigurationsScope(this._configurationService.getValue("http.useLocalProxyConfiguration"), useHostProxyDefault);
        }
      }));
      updateProxyConfigurationsScope(this._configurationService.getValue("http.useLocalProxyConfiguration"), useHostProxyDefault);
    } else {
      this._remoteAuthorityResolverService._setCanonicalURIProvider(async (uri) => uri);
    }
    return this._startLocalExtensionHost(emitter, remoteExtensions);
  }
  async _startLocalExtensionHost(emitter, remoteExtensions = []) {
    await this._workspaceTrustManagementService.workspaceTrustInitialized;
    if (remoteExtensions.length) {
      emitter.emitOne(new RemoteExtensions(remoteExtensions));
    }
    emitter.emitOne(new LocalExtensions(await this._scanAllLocalExtensions()));
  }
  async _onExtensionHostExit(code) {
    await this._doStopExtensionHosts();
    const connection = this._remoteAgentService.getConnection();
    connection?.dispose();
    if (parseExtensionDevOptions(this._environmentService).isExtensionDevTestFromCli) {
      if (isCI) {
        this._logService.info(`Asking native host service to exit with code ${code}.`);
      }
      this._nativeHostService.exit(code);
    } else {
      this._nativeHostService.closeWindow();
    }
  }
  async _handleNoResolverFound(remoteAuthority) {
    const remoteName = getRemoteName(remoteAuthority);
    const recommendation = this._productService.remoteExtensionTips?.[remoteName];
    if (!recommendation) {
      return false;
    }
    const resolverExtensionId = recommendation.extensionId;
    const allExtensions = await this._scanAllLocalExtensions();
    const extension = allExtensions.filter((e) => e.identifier.value === resolverExtensionId)[0];
    if (extension) {
      if (!extensionIsEnabled(this._logService, this._extensionEnablementService, extension, false)) {
        const message = nls.localize("enableResolver", "Extension '{0}' is required to open the remote window.\nOK to enable?", recommendation.friendlyName);
        this._notificationService.prompt(
          Severity.Info,
          message,
          [{
            label: nls.localize("enable", "Enable and Reload"),
            run: async () => {
              await this._extensionEnablementService.setEnablement([toExtension(extension)], EnablementState.EnabledGlobally);
              await this._hostService.reload();
            }
          }],
          {
            sticky: true,
            priority: NotificationPriority.URGENT
          }
        );
      }
    } else {
      const message = nls.localize("installResolver", "Extension '{0}' is required to open the remote window.\nDo you want to install the extension?", recommendation.friendlyName);
      this._notificationService.prompt(
        Severity.Info,
        message,
        [{
          label: nls.localize("install", "Install and Reload"),
          run: async () => {
            const [galleryExtension] = await this._extensionGalleryService.getExtensions([{ id: resolverExtensionId }], CancellationToken.None);
            if (galleryExtension) {
              await this._extensionManagementService.installFromGallery(galleryExtension);
              await this._hostService.reload();
            } else {
              this._notificationService.error(nls.localize("resolverExtensionNotFound", "`{0}` not found on marketplace"));
            }
          }
        }],
        {
          sticky: true,
          priority: NotificationPriority.URGENT
        }
      );
    }
    return true;
  }
};
NativeExtensionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkbenchExtensionEnablementService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IWorkbenchExtensionManagementService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionManifestPropertiesService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IRemoteAgentService),
  __decorateParam(13, IRemoteExtensionsScannerService),
  __decorateParam(14, ILifecycleService),
  __decorateParam(15, IRemoteAuthorityResolverService),
  __decorateParam(16, INativeHostService),
  __decorateParam(17, IHostService),
  __decorateParam(18, IRemoteExplorerService),
  __decorateParam(19, IExtensionGalleryService),
  __decorateParam(20, IWorkspaceTrustManagementService),
  __decorateParam(21, IDialogService)
], NativeExtensionService);
let NativeExtensionHostFactory = class {
  constructor(_extensionsProposedApi, _extensionScanner, _getExtensionRegistrySnapshotWhenReady, _instantiationService, environmentService, _extensionEnablementService, configurationService, _remoteAgentService, _remoteAuthorityResolverService, _logService) {
    this._extensionsProposedApi = _extensionsProposedApi;
    this._extensionScanner = _extensionScanner;
    this._getExtensionRegistrySnapshotWhenReady = _getExtensionRegistrySnapshotWhenReady;
    this._instantiationService = _instantiationService;
    this._extensionEnablementService = _extensionEnablementService;
    this._remoteAgentService = _remoteAgentService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._logService = _logService;
    this._webWorkerExtHostEnablement = determineLocalWebWorkerExtHostEnablement(environmentService, configurationService);
  }
  createExtensionHost(runningLocations, runningLocation, isInitialStart) {
    switch (runningLocation.kind) {
      case ExtensionHostKind.LocalProcess: {
        const startup = isInitialStart ? ExtensionHostStartup.EagerManualStart : ExtensionHostStartup.EagerAutoStart;
        return this._instantiationService.createInstance(NativeLocalProcessExtensionHost, runningLocation, startup, this._createLocalProcessExtensionHostDataProvider(runningLocations, isInitialStart, runningLocation));
      }
      case ExtensionHostKind.LocalWebWorker: {
        if (this._webWorkerExtHostEnablement !== 0 /* Disabled */) {
          const startup = isInitialStart ? this._webWorkerExtHostEnablement === 2 /* Lazy */ ? ExtensionHostStartup.Lazy : ExtensionHostStartup.EagerManualStart : ExtensionHostStartup.EagerAutoStart;
          return this._instantiationService.createInstance(WebWorkerExtensionHost, runningLocation, startup, this._createWebWorkerExtensionHostDataProvider(runningLocations, runningLocation));
        }
        return null;
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
  _createLocalProcessExtensionHostDataProvider(runningLocations, isInitialStart, desiredRunningLocation) {
    return {
      getInitData: async () => {
        if (isInitialStart) {
          const scannedExtensions = await this._extensionScanner.scannedExtensions;
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.scannedExtensions: ${scannedExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
          const localExtensions = checkEnabledAndProposedAPI(
            this._logService,
            this._extensionEnablementService,
            this._extensionsProposedApi,
            scannedExtensions,
            /* ignore workspace trust */
            true
          );
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.localExtensions: ${localExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
          const runningLocation = runningLocations.computeRunningLocation(localExtensions, [], false);
          const myExtensions = filterExtensionDescriptions(localExtensions, runningLocation, (extRunningLocation) => desiredRunningLocation.equals(extRunningLocation));
          const extensions = new ExtensionHostExtensions(0, localExtensions, myExtensions.map((extension) => extension.identifier));
          if (isCI) {
            this._logService.info(`NativeExtensionHostFactory._createLocalProcessExtensionHostDataProvider.myExtensions: ${myExtensions.map((ext) => ext.identifier.value).join(",")}`);
          }
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
  _createWebWorkerExtensionHostDataProvider(runningLocations, desiredRunningLocation) {
    return {
      getInitData: async () => {
        const snapshot = await this._getExtensionRegistrySnapshotWhenReady();
        const myExtensions = runningLocations.filterByRunningLocation(snapshot.extensions, desiredRunningLocation);
        const extensions = new ExtensionHostExtensions(snapshot.versionId, snapshot.extensions, myExtensions.map((extension) => extension.identifier));
        return { extensions };
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
NativeExtensionHostFactory = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IWorkbenchExtensionEnablementService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IRemoteAgentService),
  __decorateParam(8, IRemoteAuthorityResolverService),
  __decorateParam(9, ILogService)
], NativeExtensionHostFactory);
function determineLocalWebWorkerExtHostEnablement(environmentService, configurationService) {
  if (environmentService.isExtensionDevelopment && environmentService.extensionDevelopmentKind?.some((k) => k === "web")) {
    return 1 /* Eager */;
  } else {
    const config = configurationService.getValue(webWorkerExtHostConfig);
    if (config === true) {
      return 1 /* Eager */;
    } else if (config === "auto") {
      return 2 /* Lazy */;
    } else {
      return 0 /* Disabled */;
    }
  }
}
var LocalWebWorkerExtHostEnablement = /* @__PURE__ */ ((LocalWebWorkerExtHostEnablement2) => {
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Disabled"] = 0] = "Disabled";
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Eager"] = 1] = "Eager";
  LocalWebWorkerExtHostEnablement2[LocalWebWorkerExtHostEnablement2["Lazy"] = 2] = "Lazy";
  return LocalWebWorkerExtHostEnablement2;
})(LocalWebWorkerExtHostEnablement || {});
let NativeExtensionHostKindPicker = class {
  constructor(environmentService, configurationService, _logService) {
    this._logService = _logService;
    this._hasRemoteExtHost = Boolean(environmentService.remoteAuthority);
    const webWorkerExtHostEnablement = determineLocalWebWorkerExtHostEnablement(environmentService, configurationService);
    this._hasWebWorkerExtHost = webWorkerExtHostEnablement !== 0 /* Disabled */;
  }
  pickExtensionHostKind(extensionId, extensionKinds, isInstalledLocally, isInstalledRemotely, preference) {
    const result = NativeExtensionHostKindPicker.pickExtensionHostKind(extensionKinds, isInstalledLocally, isInstalledRemotely, preference, this._hasRemoteExtHost, this._hasWebWorkerExtHost);
    this._logService.trace(`pickRunningLocation for ${extensionId.value}, extension kinds: [${extensionKinds.join(", ")}], isInstalledLocally: ${isInstalledLocally}, isInstalledRemotely: ${isInstalledRemotely}, preference: ${extensionRunningPreferenceToString(preference)} => ${extensionHostKindToString(result)}`);
    return result;
  }
  static pickExtensionHostKind(extensionKinds, isInstalledLocally, isInstalledRemotely, preference, hasRemoteExtHost, hasWebWorkerExtHost) {
    const result = [];
    for (const extensionKind of extensionKinds) {
      if (extensionKind === "ui" && isInstalledLocally) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalProcess;
        } else {
          result.push(ExtensionHostKind.LocalProcess);
        }
      }
      if (extensionKind === "workspace" && isInstalledRemotely) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Remote) {
          return ExtensionHostKind.Remote;
        } else {
          result.push(ExtensionHostKind.Remote);
        }
      }
      if (extensionKind === "workspace" && !hasRemoteExtHost) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalProcess;
        } else {
          result.push(ExtensionHostKind.LocalProcess);
        }
      }
      if (extensionKind === "web" && isInstalledLocally && hasWebWorkerExtHost) {
        if (preference === ExtensionRunningPreference.None || preference === ExtensionRunningPreference.Local) {
          return ExtensionHostKind.LocalWebWorker;
        } else {
          result.push(ExtensionHostKind.LocalWebWorker);
        }
      }
    }
    return result.length > 0 ? result[0] : null;
  }
};
NativeExtensionHostKindPicker = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService)
], NativeExtensionHostKindPicker);
class RestartExtensionHostAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.restartExtensionHost",
      title: nls.localize2("restartExtensionHost", "Restart Extension Host"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const extensionService = accessor.get(IExtensionService);
    const stopped = await extensionService.stopExtensionHosts(nls.localize("restartExtensionHost.reason", "An explicit request"));
    if (stopped) {
      extensionService.startExtensionHosts();
    }
  }
}
registerAction2(RestartExtensionHostAction);
registerSingleton(IExtensionService, NativeExtensionService, InstantiationType.Eager);
export {
  NativeExtensionHostKindPicker,
  NativeExtensionService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9lbGVjdHJvbi1zYW5kYm94L25hdGl2ZUV4dGVuc2lvblNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBydW5XaGVuV2luZG93SWRsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0ICogYXMgcGVyZm9ybWFuY2UgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgaXNDSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBJUHJvbXB0Q2hvaWNlLCBOb3RpZmljYXRpb25Qcmlvcml0eSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50RW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvciwgUmVtb3RlQ29ubmVjdGlvblR5cGUsIFJlc29sdmVyUmVzdWx0LCBnZXRSZW1vdGVBdXRob3JpdHlQcmVmaXggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IElSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUV4dGVuc2lvbnNTY2FubmVyLmpzJztcbmltcG9ydCB7IGdldFJlbW90ZU5hbWUsIHBhcnNlQXV0aG9yaXR5V2l0aFBvcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IHVwZGF0ZVByb3h5Q29uZmlndXJhdGlvbnNTY29wZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW5hYmxlbWVudFN0YXRlLCBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVdlYldvcmtlckV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIsIElXZWJXb3JrZXJFeHRlbnNpb25Ib3N0SW5pdERhdGEsIFdlYldvcmtlckV4dGVuc2lvbkhvc3QgfSBmcm9tICcuLi9icm93c2VyL3dlYldvcmtlckV4dGVuc2lvbkhvc3QuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlLCBFeHRlbnNpb25Ib3N0Q3Jhc2hUcmFja2VyLCBJRXh0ZW5zaW9uSG9zdEZhY3RvcnksIExvY2FsRXh0ZW5zaW9ucywgUmVtb3RlRXh0ZW5zaW9ucywgUmVzb2x2ZWRFeHRlbnNpb25zLCBSZXNvbHZlckV4dGVuc2lvbnMsIGNoZWNrRW5hYmxlZEFuZFByb3Bvc2VkQVBJLCBleHRlbnNpb25Jc0VuYWJsZWQsIGlzUmVzb2x2ZXJFeHRlbnNpb24gfSBmcm9tICcuLi9jb21tb24vYWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnlTbmFwc2hvdCB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25EZXZPcHRpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RLaW5kLCBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZSwgSUV4dGVuc2lvbkhvc3RLaW5kUGlja2VyLCBleHRlbnNpb25Ib3N0S2luZFRvU3RyaW5nLCBleHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZVRvU3RyaW5nIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkhvc3RLaW5kLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Ib3N0TWFuYWdlciB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25Ib3N0TWFuYWdlcnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSG9zdEV4aXRDb2RlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbkhvc3RQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbiwgTG9jYWxQcm9jZXNzUnVubmluZ0xvY2F0aW9uLCBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25SdW5uaW5nTG9jYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uVHJhY2tlciwgZmlsdGVyRXh0ZW5zaW9uRGVzY3JpcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnMsIEV4dGVuc2lvbkhvc3RTdGFydHVwLCBJRXh0ZW5zaW9uSG9zdCwgSUV4dGVuc2lvblNlcnZpY2UsIFdlYldvcmtlckV4dEhvc3RDb25maWdWYWx1ZSwgdG9FeHRlbnNpb24sIHdlYldvcmtlckV4dEhvc3RDb25maWcgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUHJvcG9zZWRBcGkgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLmpzJztcbmltcG9ydCB7IElSZW1vdGVFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyLCBJUmVtb3RlRXh0ZW5zaW9uSG9zdEluaXREYXRhLCBSZW1vdGVFeHRlbnNpb25Ib3N0IH0gZnJvbSAnLi4vY29tbW9uL3JlbW90ZUV4dGVuc2lvbkhvc3QuanMnO1xuaW1wb3J0IHsgQ2FjaGVkRXh0ZW5zaW9uU2Nhbm5lciB9IGZyb20gJy4vY2FjaGVkRXh0ZW5zaW9uU2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBJTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlciwgSUxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3RJbml0RGF0YSwgTmF0aXZlTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdCB9IGZyb20gJy4vbG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdC5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uL3JlbW90ZS9jb21tb24vcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFzeW5jSXRlcmFibGVFbWl0dGVyLCBBc3luY0l0ZXJhYmxlT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuXG5leHBvcnQgY2xhc3MgTmF0aXZlRXh0ZW5zaW9uU2VydmljZSBleHRlbmRzIEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZSBpbXBsZW1lbnRzIElFeHRlbnNpb25TZXJ2aWNlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TY2FubmVyOiBDYWNoZWRFeHRlbnNpb25TY2FubmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2NhbENyYXNoVHJhY2tlciA9IG5ldyBFeHRlbnNpb25Ib3N0Q3Jhc2hUcmFja2VyKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIHJlbW90ZUV4dGVuc2lvbnNTY2FubmVyU2VydmljZTogSVJlbW90ZUV4dGVuc2lvbnNTY2FubmVyU2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlOiBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJTmF0aXZlSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbmF0aXZlSG9zdFNlcnZpY2U6IElOYXRpdmVIb3N0U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlRXhwbG9yZXJTZXJ2aWNlOiBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBleHRlbnNpb25zUHJvcG9zZWRBcGkgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUHJvcG9zZWRBcGkpO1xuXHRcdGNvbnN0IGV4dGVuc2lvblNjYW5uZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDYWNoZWRFeHRlbnNpb25TY2FubmVyKTtcblx0XHRjb25zdCBleHRlbnNpb25Ib3N0RmFjdG9yeSA9IG5ldyBOYXRpdmVFeHRlbnNpb25Ib3N0RmFjdG9yeShcblx0XHRcdGV4dGVuc2lvbnNQcm9wb3NlZEFwaSxcblx0XHRcdGV4dGVuc2lvblNjYW5uZXIsXG5cdFx0XHQoKSA9PiB0aGlzLl9nZXRFeHRlbnNpb25SZWdpc3RyeVNuYXBzaG90V2hlblJlYWR5KCksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdGVudmlyb25tZW50U2VydmljZSxcblx0XHRcdGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0XHRsb2dTZXJ2aWNlXG5cdFx0KTtcblx0XHRzdXBlcihcblx0XHRcdHsgaGFzTG9jYWxQcm9jZXNzOiB0cnVlLCBhbGxvd1JlbW90ZUV4dGVuc2lvbnNJbkxvY2FsV2ViV29ya2VyOiBmYWxzZSB9LFxuXHRcdFx0ZXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLFxuXHRcdFx0ZXh0ZW5zaW9uSG9zdEZhY3RvcnksXG5cdFx0XHRuZXcgTmF0aXZlRXh0ZW5zaW9uSG9zdEtpbmRQaWNrZXIoZW52aXJvbm1lbnRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbG9nU2VydmljZSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0XHRlbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdFx0ZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0XHRmaWxlU2VydmljZSxcblx0XHRcdHByb2R1Y3RTZXJ2aWNlLFxuXHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0XHRjb250ZXh0U2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0ZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRcdGxvZ1NlcnZpY2UsXG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0XHRyZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdFx0XHRsaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdFx0ZGlhbG9nU2VydmljZVxuXHRcdCk7XG5cblx0XHR0aGlzLl9leHRlbnNpb25TY2FubmVyID0gZXh0ZW5zaW9uU2Nhbm5lcjtcblxuXHRcdC8vIGRlbGF5IGV4dGVuc2lvbiBob3N0IGNyZWF0aW9uIGFuZCBleHRlbnNpb24gc2Nhbm5pbmdcblx0XHQvLyB1bnRpbCB0aGUgd29ya2JlbmNoIGlzIHJ1bm5pbmcuIHdlIGNhbm5vdCBkZWZlciB0aGVcblx0XHQvLyBleHRlbnNpb24gaG9zdCBtb3JlIChMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCkgYmVjYXVzZVxuXHRcdC8vIHNvbWUgZWRpdG9ycyByZXF1aXJlIHRoZSBleHRlbnNpb24gaG9zdCB0byByZXN0b3JlXG5cdFx0Ly8gYW5kIHRoaXMgd291bGQgcmVzdWx0IGluIGEgZGVhZGxvY2tcblx0XHQvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQxMzIyXG5cdFx0bGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLlJlYWR5KS50aGVuKCgpID0+IHtcblx0XHRcdC8vIHJlc2NoZWR1bGUgdG8gZW5zdXJlIHRoaXMgcnVucyBhZnRlciByZXN0b3Jpbmcgdmlld2xldHMsIHBhbmVscywgYW5kIGVkaXRvcnNcblx0XHRcdHJ1bldoZW5XaW5kb3dJZGxlKG1haW5XaW5kb3csICgpID0+IHtcblx0XHRcdFx0dGhpcy5faW5pdGlhbGl6ZSgpO1xuXHRcdFx0fSwgNTAgLyptYXggZGVsYXkqLyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zY2FuQWxsTG9jYWxFeHRlbnNpb25zKCk6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uU2Nhbm5lci5zY2FubmVkRXh0ZW5zaW9ucztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfb25FeHRlbnNpb25Ib3N0Q3Jhc2hlZChleHRlbnNpb25Ib3N0OiBJRXh0ZW5zaW9uSG9zdE1hbmFnZXIsIGNvZGU6IG51bWJlciwgc2lnbmFsOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG5cblx0XHRjb25zdCBhY3RpdmF0ZWRFeHRlbnNpb25zOiBFeHRlbnNpb25JZGVudGlmaWVyW10gPSBbXTtcblx0XHRjb25zdCBleHRlbnNpb25zU3RhdHVzID0gdGhpcy5nZXRFeHRlbnNpb25zU3RhdHVzKCk7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZXh0ZW5zaW9uc1N0YXR1cykpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvblN0YXR1cyA9IGV4dGVuc2lvbnNTdGF0dXNba2V5XTtcblx0XHRcdGlmIChleHRlbnNpb25TdGF0dXMuYWN0aXZhdGlvblN0YXJ0ZWQgJiYgZXh0ZW5zaW9uSG9zdC5jb250YWluc0V4dGVuc2lvbihleHRlbnNpb25TdGF0dXMuaWQpKSB7XG5cdFx0XHRcdGFjdGl2YXRlZEV4dGVuc2lvbnMucHVzaChleHRlbnNpb25TdGF0dXMuaWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHN1cGVyLl9vbkV4dGVuc2lvbkhvc3RDcmFzaGVkKGV4dGVuc2lvbkhvc3QsIGNvZGUsIHNpZ25hbCk7XG5cblx0XHRpZiAoZXh0ZW5zaW9uSG9zdC5raW5kID09PSBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3MpIHtcblx0XHRcdGlmIChjb2RlID09PSBFeHRlbnNpb25Ib3N0RXhpdENvZGUuVmVyc2lvbk1pc21hdGNoKSB7XG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRcdFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uU2VydmljZS52ZXJzaW9uTWlzbWF0Y2hDcmFzaCcsIFwiRXh0ZW5zaW9uIGhvc3QgY2Fubm90IHN0YXJ0OiB2ZXJzaW9uIG1pc21hdGNoLlwiKSxcblx0XHRcdFx0XHRbe1xuXHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVsYXVuY2gnLCBcIlJlbGF1bmNoIFZTIENvZGVcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRcdFx0XHRcdFx0XHRob3N0U2VydmljZS5yZXN0YXJ0KCk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbG9nRXh0ZW5zaW9uSG9zdENyYXNoKGV4dGVuc2lvbkhvc3QpO1xuXHRcdFx0dGhpcy5fc2VuZEV4dGVuc2lvbkhvc3RDcmFzaFRlbGVtZXRyeShjb2RlLCBzaWduYWwsIGFjdGl2YXRlZEV4dGVuc2lvbnMpO1xuXG5cdFx0XHR0aGlzLl9sb2NhbENyYXNoVHJhY2tlci5yZWdpc3RlckNyYXNoKCk7XG5cblx0XHRcdGlmICh0aGlzLl9sb2NhbENyYXNoVHJhY2tlci5zaG91bGRBdXRvbWF0aWNhbGx5UmVzdGFydCgpKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQXV0b21hdGljYWxseSByZXN0YXJ0aW5nIHRoZSBleHRlbnNpb24gaG9zdC5gKTtcblx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5zdGF0dXMobmxzLmxvY2FsaXplKCdleHRlbnNpb25TZXJ2aWNlLmF1dG9SZXN0YXJ0JywgXCJUaGUgZXh0ZW5zaW9uIGhvc3QgdGVybWluYXRlZCB1bmV4cGVjdGVkbHkuIFJlc3RhcnRpbmcuLi5cIiksIHsgaGlkZUFmdGVyOiA1MDAwIH0pO1xuXHRcdFx0XHR0aGlzLnN0YXJ0RXh0ZW5zaW9uSG9zdHMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNob2ljZXM6IElQcm9tcHRDaG9pY2VbXSA9IFtdO1xuXHRcdFx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQpIHtcblx0XHRcdFx0XHRjaG9pY2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnc3RhcnRCaXNlY3QnLCBcIlN0YXJ0IEV4dGVuc2lvbiBCaXNlY3RcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRcdFx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2V4dGVuc2lvbi5iaXNlY3Quc3RhcnQnKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hvaWNlcy5wdXNoKHtcblx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2RldlRvb2xzJywgXCJPcGVuIERldmVsb3BlciBUb29sc1wiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fbmF0aXZlSG9zdFNlcnZpY2Uub3BlbkRldlRvb2xzKClcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNob2ljZXMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVzdGFydCcsIFwiUmVzdGFydCBFeHRlbnNpb24gSG9zdFwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuc3RhcnRFeHRlbnNpb25Ib3N0cygpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0XHRcdGNob2ljZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdsZWFybk1vcmUnLCBcIkxlYXJuIE1vcmVcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG9wZW5lclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0XHRcdG9wZW5lclNlcnZpY2Uub3BlbignaHR0cHM6Ly9ha2EubXMvdnNjb2RlLWV4dGVuc2lvbi1iaXNlY3QnKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdleHRlbnNpb25TZXJ2aWNlLmNyYXNoJywgXCJFeHRlbnNpb24gaG9zdCB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSAzIHRpbWVzIHdpdGhpbiB0aGUgbGFzdCA1IG1pbnV0ZXMuXCIpLCBjaG9pY2VzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kRXh0ZW5zaW9uSG9zdENyYXNoVGVsZW1ldHJ5KGNvZGU6IG51bWJlciwgc2lnbmFsOiBzdHJpbmcgfCBudWxsLCBhY3RpdmF0ZWRFeHRlbnNpb25zOiBFeHRlbnNpb25JZGVudGlmaWVyW10pOiB2b2lkIHtcblx0XHR0eXBlIEV4dGVuc2lvbkhvc3RDcmFzaENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdhbGV4ZGltYSc7XG5cdFx0XHRjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBob3N0IGhhcyB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSc7XG5cdFx0XHRjb2RlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGV4aXQgY29kZSBvZiB0aGUgZXh0ZW5zaW9uIGhvc3QgcHJvY2Vzcy4nIH07XG5cdFx0XHRzaWduYWw6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgc2lnbmFsIHRoYXQgY2F1c2VkIHRoZSBleHRlbnNpb24gaG9zdCBwcm9jZXNzIHRvIGV4aXQuJyB9O1xuXHRcdFx0ZXh0ZW5zaW9uSWRzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGxpc3Qgb2YgbG9hZGVkIGV4dGVuc2lvbnMuJyB9O1xuXHRcdH07XG5cdFx0dHlwZSBFeHRlbnNpb25Ib3N0Q3Jhc2hFdmVudCA9IHtcblx0XHRcdGNvZGU6IG51bWJlcjtcblx0XHRcdHNpZ25hbDogc3RyaW5nIHwgbnVsbDtcblx0XHRcdGV4dGVuc2lvbklkczogc3RyaW5nW107XG5cdFx0fTtcblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXh0ZW5zaW9uSG9zdENyYXNoRXZlbnQsIEV4dGVuc2lvbkhvc3RDcmFzaENsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uSG9zdENyYXNoJywge1xuXHRcdFx0Y29kZSxcblx0XHRcdHNpZ25hbCxcblx0XHRcdGV4dGVuc2lvbklkczogYWN0aXZhdGVkRXh0ZW5zaW9ucy5tYXAoZSA9PiBlLnZhbHVlKVxuXHRcdH0pO1xuXG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25JZCBvZiBhY3RpdmF0ZWRFeHRlbnNpb25zKSB7XG5cdFx0XHR0eXBlIEV4dGVuc2lvbkhvc3RDcmFzaEV4dGVuc2lvbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdFx0Y29tbWVudDogJ1RoZSBleHRlbnNpb24gaG9zdCBoYXMgdGVybWluYXRlZCB1bmV4cGVjdGVkbHknO1xuXHRcdFx0XHRjb2RlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGV4aXQgY29kZSBvZiB0aGUgZXh0ZW5zaW9uIGhvc3QgcHJvY2Vzcy4nIH07XG5cdFx0XHRcdHNpZ25hbDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBzaWduYWwgdGhhdCBjYXVzZWQgdGhlIGV4dGVuc2lvbiBob3N0IHByb2Nlc3MgdG8gZXhpdC4nIH07XG5cdFx0XHRcdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXIgb2YgdGhlIGV4dGVuc2lvbi4nIH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBFeHRlbnNpb25Ib3N0Q3Jhc2hFeHRlbnNpb25FdmVudCA9IHtcblx0XHRcdFx0Y29kZTogbnVtYmVyO1xuXHRcdFx0XHRzaWduYWw6IHN0cmluZyB8IG51bGw7XG5cdFx0XHRcdGV4dGVuc2lvbklkOiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEV4dGVuc2lvbkhvc3RDcmFzaEV4dGVuc2lvbkV2ZW50LCBFeHRlbnNpb25Ib3N0Q3Jhc2hFeHRlbnNpb25DbGFzc2lmaWNhdGlvbj4oJ2V4dGVuc2lvbkhvc3RDcmFzaEV4dGVuc2lvbicsIHtcblx0XHRcdFx0Y29kZSxcblx0XHRcdFx0c2lnbmFsLFxuXHRcdFx0XHRleHRlbnNpb25JZDogZXh0ZW5zaW9uSWQudmFsdWVcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBpbXBsXG5cblx0cHJvdGVjdGVkIGFzeW5jIF9yZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxSZXNvbHZlclJlc3VsdD4ge1xuXG5cdFx0Y29uc3QgYXV0aG9yaXR5UGx1c0luZGV4ID0gcmVtb3RlQXV0aG9yaXR5LmluZGV4T2YoJysnKTtcblx0XHRpZiAoYXV0aG9yaXR5UGx1c0luZGV4ID09PSAtMSkge1xuXHRcdFx0Ly8gVGhpcyBhdXRob3JpdHkgZG9lcyBub3QgbmVlZCB0byBiZSByZXNvbHZlZCwgc2ltcGx5IHBhcnNlIHRoZSBwb3J0IG51bWJlclxuXHRcdFx0Y29uc3QgeyBob3N0LCBwb3J0IH0gPSBwYXJzZUF1dGhvcml0eVdpdGhQb3J0KHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRhdXRob3JpdHk6IHtcblx0XHRcdFx0XHRhdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0XHRjb25uZWN0VG86IHtcblx0XHRcdFx0XHRcdHR5cGU6IFJlbW90ZUNvbm5lY3Rpb25UeXBlLldlYlNvY2tldCxcblx0XHRcdFx0XHRcdGhvc3QsXG5cdFx0XHRcdFx0XHRwb3J0XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb25uZWN0aW9uVG9rZW46IHVuZGVmaW5lZFxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yZXNvbHZlQXV0aG9yaXR5T25FeHRlbnNpb25Ib3N0cyhFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3MsIHJlbW90ZUF1dGhvcml0eSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRDYW5vbmljYWxVUkkocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcsIHVyaTogVVJJKTogUHJvbWlzZTxVUkk+IHtcblxuXHRcdGNvbnN0IGF1dGhvcml0eVBsdXNJbmRleCA9IHJlbW90ZUF1dGhvcml0eS5pbmRleE9mKCcrJyk7XG5cdFx0aWYgKGF1dGhvcml0eVBsdXNJbmRleCA9PT0gLTEpIHtcblx0XHRcdC8vIFRoaXMgYXV0aG9yaXR5IGRvZXMgbm90IHVzZSBhIHJlc29sdmVyXG5cdFx0XHRyZXR1cm4gdXJpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3RzID0gdGhpcy5fZ2V0RXh0ZW5zaW9uSG9zdE1hbmFnZXJzKEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsUHJvY2Vzcyk7XG5cdFx0aWYgKGxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3RzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gbm8gbG9jYWwgcHJvY2VzcyBleHRlbnNpb24gaG9zdHNcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlc29sdmUgY2Fub25pY2FsIFVSSWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChsb2NhbFByb2Nlc3NFeHRlbnNpb25Ib3N0cy5tYXAoZXh0SG9zdCA9PiBleHRIb3N0LmdldENhbm9uaWNhbFVSSShyZW1vdGVBdXRob3JpdHksIHVyaSkpKTtcblxuXHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB3ZSBjYW4gb25seSByZWFjaCB0aGlzIGlmIHRoZXJlIHdhcyBubyByZXNvbHZlciBleHRlbnNpb24gdGhhdCBjYW4gcmV0dXJuIHRoZSBjYW5ub25pY2FsIHVyaVxuXHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGdldCBjYW5vbmljYWwgVVJJIGJlY2F1c2Ugbm8gZXh0ZW5zaW9uIGlzIGluc3RhbGxlZCB0byByZXNvbHZlICR7Z2V0UmVtb3RlQXV0aG9yaXR5UHJlZml4KHJlbW90ZUF1dGhvcml0eSl9YCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3Jlc29sdmVFeHRlbnNpb25zKCk6IEFzeW5jSXRlcmFibGU8UmVzb2x2ZWRFeHRlbnNpb25zPiB7XG5cdFx0cmV0dXJuIG5ldyBBc3luY0l0ZXJhYmxlT2JqZWN0KGVtaXR0ZXIgPT4gdGhpcy5fZG9SZXNvbHZlRXh0ZW5zaW9ucyhlbWl0dGVyKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kb1Jlc29sdmVFeHRlbnNpb25zKGVtaXR0ZXI6IEFzeW5jSXRlcmFibGVFbWl0dGVyPFJlc29sdmVkRXh0ZW5zaW9ucz4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9leHRlbnNpb25TY2FubmVyLnN0YXJ0U2Nhbm5pbmdFeHRlbnNpb25zKCk7XG5cblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXG5cdFx0bGV0IHJlbW90ZUVudjogSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfCBudWxsID0gbnVsbDtcblx0XHRsZXQgcmVtb3RlRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXTtcblxuXHRcdGlmIChyZW1vdGVBdXRob3JpdHkpIHtcblxuXHRcdFx0dGhpcy5fcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLl9zZXRDYW5vbmljYWxVUklQcm92aWRlcihhc3luYyAodXJpKSA9PiB7XG5cdFx0XHRcdGlmICh1cmkuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZVJlbW90ZSB8fCB1cmkuYXV0aG9yaXR5ICE9PSByZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0XHQvLyBUaGUgY3VycmVudCByZW1vdGUgYXV0aG9yaXR5IHJlc29sdmVyIGNhbm5vdCBnaXZlIHRoZSBjYW5vbmljYWwgVVJJIGZvciB0aGlzIFVSSVxuXHRcdFx0XHRcdHJldHVybiB1cmk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS93aWxsR2V0Q2Fub25pY2FsVVJJLyR7Z2V0UmVtb3RlQXV0aG9yaXR5UHJlZml4KHJlbW90ZUF1dGhvcml0eSl9YCk7XG5cdFx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBJbnZva2luZyBnZXRDYW5vbmljYWxVUkkgZm9yIGF1dGhvcml0eSAke2dldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHkpfS4uLmApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2dldENhbm9uaWNhbFVSSShyZW1vdGVBdXRob3JpdHksIHVyaSk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS9kaWRHZXRDYW5vbmljYWxVUkkvJHtnZXRSZW1vdGVBdXRob3JpdHlQcmVmaXgocmVtb3RlQXV0aG9yaXR5KX1gKTtcblx0XHRcdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBnZXRDYW5vbmljYWxVUkkgcmV0dXJuZWQgZm9yIGF1dGhvcml0eSAke2dldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHkpfS5gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYFN0YXJ0aW5nIHRvIHdhaXQgb24gSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlUmVzb2x2ZWQuLi5gKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTm93IHRoYXQgdGhlIGNhbm9uaWNhbCBVUkkgcHJvdmlkZXIgaGFzIGJlZW4gcmVnaXN0ZXJlZCwgd2UgbmVlZCB0byB3YWl0IGZvciB0aGUgdHJ1c3Qgc3RhdGUgdG8gYmVcblx0XHRcdC8vIGNhbGN1bGF0ZWQuIFRoZSB0cnVzdCBzdGF0ZSB3aWxsIGJlIHVzZWQgd2hpbGUgcmVzb2x2aW5nIHRoZSBhdXRob3JpdHksIGhvd2V2ZXIgdGhlIHJlc29sdmVyIGNhblxuXHRcdFx0Ly8gb3ZlcnJpZGUgdGhlIHRydXN0IHN0YXRlIHRocm91Z2ggdGhlIHJlc29sdmVyIHJlc3VsdC5cblx0XHRcdGF3YWl0IHRoaXMuX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlUmVzb2x2ZWQ7XG5cblx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgRmluaXNoZWQgd2FpdGluZyBvbiBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS53b3Jrc3BhY2VSZXNvbHZlZC5gKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5fc2NhbkFsbExvY2FsRXh0ZW5zaW9ucygpO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZXJFeHRlbnNpb25zID0gbG9jYWxFeHRlbnNpb25zLmZpbHRlcihleHRlbnNpb24gPT4gaXNSZXNvbHZlckV4dGVuc2lvbihleHRlbnNpb24pKTtcblx0XHRcdGlmIChyZXNvbHZlckV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGVtaXR0ZXIuZW1pdE9uZShuZXcgUmVzb2x2ZXJFeHRlbnNpb25zKHJlc29sdmVyRXh0ZW5zaW9ucykpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcmVzb2x2ZXJSZXN1bHQ6IFJlc29sdmVyUmVzdWx0O1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVzb2x2ZXJSZXN1bHQgPSBhd2FpdCB0aGlzLl9yZXNvbHZlQXV0aG9yaXR5SW5pdGlhbChyZW1vdGVBdXRob3JpdHkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGlmIChSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yLmlzTm9SZXNvbHZlckZvdW5kKGVycikpIHtcblx0XHRcdFx0XHRlcnIuaXNIYW5kbGVkID0gYXdhaXQgdGhpcy5faGFuZGxlTm9SZXNvbHZlckZvdW5kKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IuaXNIYW5kbGVkKGVycikpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBoYW5kbGVkOiBOb3Qgc2hvd2luZyBhIG5vdGlmaWNhdGlvbiBmb3IgdGhlIGVycm9yYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3JlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5fc2V0UmVzb2x2ZWRBdXRob3JpdHlFcnJvcihyZW1vdGVBdXRob3JpdHksIGVycik7XG5cblx0XHRcdFx0Ly8gUHJvY2VlZCB3aXRoIHRoZSBsb2NhbCBleHRlbnNpb24gaG9zdFxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fc3RhcnRMb2NhbEV4dGVuc2lvbkhvc3QoZW1pdHRlcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHNldCB0aGUgcmVzb2x2ZWQgYXV0aG9yaXR5XG5cdFx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuX3NldFJlc29sdmVkQXV0aG9yaXR5KHJlc29sdmVyUmVzdWx0LmF1dGhvcml0eSwgcmVzb2x2ZXJSZXN1bHQub3B0aW9ucyk7XG5cdFx0XHR0aGlzLl9yZW1vdGVFeHBsb3JlclNlcnZpY2Uuc2V0VHVubmVsSW5mb3JtYXRpb24ocmVzb2x2ZXJSZXN1bHQudHVubmVsSW5mb3JtYXRpb24pO1xuXG5cdFx0XHQvLyBtb25pdG9yIGZvciBicmVha2FnZVxuXHRcdFx0Y29uc3QgY29ubmVjdGlvbiA9IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk7XG5cdFx0XHRpZiAoY29ubmVjdGlvbikge1xuXHRcdFx0XHRjb25uZWN0aW9uLm9uRGlkU3RhdGVDaGFuZ2UoYXN5bmMgKGUpID0+IHtcblx0XHRcdFx0XHRpZiAoZS50eXBlID09PSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5Db25uZWN0aW9uTG9zdCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLl9jbGVhclJlc29sdmVkQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29ubmVjdGlvbi5vblJlY29ubmVjdGluZygoKSA9PiB0aGlzLl9yZXNvbHZlQXV0aG9yaXR5QWdhaW4oKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZldGNoIHRoZSByZW1vdGUgZW52aXJvbm1lbnRcblx0XHRcdFtyZW1vdGVFbnYsIHJlbW90ZUV4dGVuc2lvbnNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHR0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKSxcblx0XHRcdFx0dGhpcy5fcmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5FeHRlbnNpb25zKClcblx0XHRcdF0pO1xuXG5cdFx0XHRpZiAoIXJlbW90ZUVudikge1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7IHNldmVyaXR5OiBTZXZlcml0eS5FcnJvciwgbWVzc2FnZTogbmxzLmxvY2FsaXplKCdnZXRFbnZpcm9ubWVudEZhaWx1cmUnLCBcIkNvdWxkIG5vdCBmZXRjaCByZW1vdGUgZW52aXJvbm1lbnRcIikgfSk7XG5cdFx0XHRcdC8vIFByb2NlZWQgd2l0aCB0aGUgbG9jYWwgZXh0ZW5zaW9uIGhvc3Rcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3N0YXJ0TG9jYWxFeHRlbnNpb25Ib3N0KGVtaXR0ZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1c2VIb3N0UHJveHlEZWZhdWx0ID0gcmVtb3RlRW52LnVzZUhvc3RQcm94eTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2h0dHAudXNlTG9jYWxQcm94eUNvbmZpZ3VyYXRpb24nKSkge1xuXHRcdFx0XHRcdHVwZGF0ZVByb3h5Q29uZmlndXJhdGlvbnNTY29wZSh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbicpLCB1c2VIb3N0UHJveHlEZWZhdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dXBkYXRlUHJveHlDb25maWd1cmF0aW9uc1Njb3BlKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdodHRwLnVzZUxvY2FsUHJveHlDb25maWd1cmF0aW9uJyksIHVzZUhvc3RQcm94eURlZmF1bHQpO1xuXHRcdH0gZWxzZSB7XG5cblx0XHRcdHRoaXMuX3JlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5fc2V0Q2Fub25pY2FsVVJJUHJvdmlkZXIoYXN5bmMgKHVyaSkgPT4gdXJpKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9zdGFydExvY2FsRXh0ZW5zaW9uSG9zdChlbWl0dGVyLCByZW1vdGVFeHRlbnNpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3N0YXJ0TG9jYWxFeHRlbnNpb25Ib3N0KGVtaXR0ZXI6IEFzeW5jSXRlcmFibGVFbWl0dGVyPFJlc29sdmVkRXh0ZW5zaW9ucz4sIHJlbW90ZUV4dGVuc2lvbnM6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdID0gW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBFbnN1cmUgdGhhdCB0aGUgd29ya3NwYWNlIHRydXN0IHN0YXRlIGhhcyBiZWVuIGZ1bGx5IGluaXRpYWxpemVkIHNvXG5cdFx0Ly8gdGhhdCB0aGUgZXh0ZW5zaW9uIGhvc3QgY2FuIHN0YXJ0IHdpdGggdGhlIGNvcnJlY3Qgc2V0IG9mIGV4dGVuc2lvbnMuXG5cdFx0YXdhaXQgdGhpcy5fd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS53b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkO1xuXG5cdFx0aWYgKHJlbW90ZUV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRlbWl0dGVyLmVtaXRPbmUobmV3IFJlbW90ZUV4dGVuc2lvbnMocmVtb3RlRXh0ZW5zaW9ucykpO1xuXHRcdH1cblxuXHRcdGVtaXR0ZXIuZW1pdE9uZShuZXcgTG9jYWxFeHRlbnNpb25zKGF3YWl0IHRoaXMuX3NjYW5BbGxMb2NhbEV4dGVuc2lvbnMoKSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9vbkV4dGVuc2lvbkhvc3RFeGl0KGNvZGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIERpc3Bvc2UgZXZlcnl0aGluZyBhc3NvY2lhdGVkIHdpdGggdGhlIGV4dGVuc2lvbiBob3N0XG5cdFx0YXdhaXQgdGhpcy5fZG9TdG9wRXh0ZW5zaW9uSG9zdHMoKTtcblxuXHRcdC8vIERpc3Bvc2UgdGhlIG1hbmFnZW1lbnQgY29ubmVjdGlvbiB0byBhdm9pZCByZWNvbm5lY3RpbmcgYWZ0ZXIgdGhlIGV4dGVuc2lvbiBob3N0IGV4aXRzXG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk7XG5cdFx0Y29ubmVjdGlvbj8uZGlzcG9zZSgpO1xuXG5cdFx0aWYgKHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UpLmlzRXh0ZW5zaW9uRGV2VGVzdEZyb21DbGkpIHtcblx0XHRcdC8vIFdoZW4gQ0xJIHRlc3RpbmcgbWFrZSBzdXJlIHRvIGV4aXQgd2l0aCBwcm9wZXIgZXhpdCBjb2RlXG5cdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEFza2luZyBuYXRpdmUgaG9zdCBzZXJ2aWNlIHRvIGV4aXQgd2l0aCBjb2RlICR7Y29kZX0uYCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5leGl0KGNvZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBFeHBlY3RlZCBkZXZlbG9wbWVudCBleHRlbnNpb24gdGVybWluYXRpb246IFdoZW4gdGhlIGV4dGVuc2lvbiBob3N0IGdvZXMgZG93biB3ZSBhbHNvIHNodXRkb3duIHRoZSB3aW5kb3dcblx0XHRcdHRoaXMuX25hdGl2ZUhvc3RTZXJ2aWNlLmNsb3NlV2luZG93KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlTm9SZXNvbHZlckZvdW5kKHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgcmVtb3RlTmFtZSA9IGdldFJlbW90ZU5hbWUocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRjb25zdCByZWNvbW1lbmRhdGlvbiA9IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvblRpcHM/LltyZW1vdGVOYW1lXTtcblx0XHRpZiAoIXJlY29tbWVuZGF0aW9uKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZXJFeHRlbnNpb25JZCA9IHJlY29tbWVuZGF0aW9uLmV4dGVuc2lvbklkO1xuXHRcdGNvbnN0IGFsbEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLl9zY2FuQWxsTG9jYWxFeHRlbnNpb25zKCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gYWxsRXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBlLmlkZW50aWZpZXIudmFsdWUgPT09IHJlc29sdmVyRXh0ZW5zaW9uSWQpWzBdO1xuXHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdGlmICghZXh0ZW5zaW9uSXNFbmFibGVkKHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBleHRlbnNpb24sIGZhbHNlKSkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdlbmFibGVSZXNvbHZlcicsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIHJlcXVpcmVkIHRvIG9wZW4gdGhlIHJlbW90ZSB3aW5kb3cuXFxuT0sgdG8gZW5hYmxlP1wiLCByZWNvbW1lbmRhdGlvbi5mcmllbmRseU5hbWUpO1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5JbmZvLCBtZXNzYWdlLFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdlbmFibGUnLCAnRW5hYmxlIGFuZCBSZWxvYWQnKSxcblx0XHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5zZXRFbmFibGVtZW50KFt0b0V4dGVuc2lvbihleHRlbnNpb24pXSwgRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSk7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2hvc3RTZXJ2aWNlLnJlbG9hZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEluc3RhbGwgdGhlIEV4dGVuc2lvbiBhbmQgcmVsb2FkIHRoZSB3aW5kb3cgdG8gaGFuZGxlLlxuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnaW5zdGFsbFJlc29sdmVyJywgXCJFeHRlbnNpb24gJ3swfScgaXMgcmVxdWlyZWQgdG8gb3BlbiB0aGUgcmVtb3RlIHdpbmRvdy5cXG5EbyB5b3Ugd2FudCB0byBpbnN0YWxsIHRoZSBleHRlbnNpb24/XCIsIHJlY29tbWVuZGF0aW9uLmZyaWVuZGx5TmFtZSk7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5JbmZvLCBtZXNzYWdlLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2luc3RhbGwnLCAnSW5zdGFsbCBhbmQgUmVsb2FkJyksXG5cdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBbZ2FsbGVyeUV4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLl9leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiByZXNvbHZlckV4dGVuc2lvbklkIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0XHRcdGlmIChnYWxsZXJ5RXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxGcm9tR2FsbGVyeShnYWxsZXJ5RXh0ZW5zaW9uKTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5faG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgncmVzb2x2ZXJFeHRlbnNpb25Ob3RGb3VuZCcsIFwiYHswfWAgbm90IGZvdW5kIG9uIG1hcmtldHBsYWNlXCIpKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzdGlja3k6IHRydWUsXG5cdFx0XHRcdFx0cHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5LlVSR0VOVCxcblx0XHRcdFx0fVxuXHRcdFx0KTtcblxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5jbGFzcyBOYXRpdmVFeHRlbnNpb25Ib3N0RmFjdG9yeSBpbXBsZW1lbnRzIElFeHRlbnNpb25Ib3N0RmFjdG9yeSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQ6IExvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uc1Byb3Bvc2VkQXBpOiBFeHRlbnNpb25zUHJvcG9zZWRBcGksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2Nhbm5lcjogQ2FjaGVkRXh0ZW5zaW9uU2Nhbm5lcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9nZXRFeHRlbnNpb25SZWdpc3RyeVNuYXBzaG90V2hlblJlYWR5OiAoKSA9PiBQcm9taXNlPEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnlTbmFwc2hvdD4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3JlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl93ZWJXb3JrZXJFeHRIb3N0RW5hYmxlbWVudCA9IGRldGVybWluZUxvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQoZW52aXJvbm1lbnRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlRXh0ZW5zaW9uSG9zdChydW5uaW5nTG9jYXRpb25zOiBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb25UcmFja2VyLCBydW5uaW5nTG9jYXRpb246IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbiwgaXNJbml0aWFsU3RhcnQ6IGJvb2xlYW4pOiBJRXh0ZW5zaW9uSG9zdCB8IG51bGwge1xuXHRcdHN3aXRjaCAocnVubmluZ0xvY2F0aW9uLmtpbmQpIHtcblx0XHRcdGNhc2UgRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzOiB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0dXAgPSAoXG5cdFx0XHRcdFx0aXNJbml0aWFsU3RhcnRcblx0XHRcdFx0XHRcdD8gRXh0ZW5zaW9uSG9zdFN0YXJ0dXAuRWFnZXJNYW51YWxTdGFydFxuXHRcdFx0XHRcdFx0OiBFeHRlbnNpb25Ib3N0U3RhcnR1cC5FYWdlckF1dG9TdGFydFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTmF0aXZlTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdCwgcnVubmluZ0xvY2F0aW9uLCBzdGFydHVwLCB0aGlzLl9jcmVhdGVMb2NhbFByb2Nlc3NFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyKHJ1bm5pbmdMb2NhdGlvbnMsIGlzSW5pdGlhbFN0YXJ0LCBydW5uaW5nTG9jYXRpb24pKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxXZWJXb3JrZXI6IHtcblx0XHRcdFx0aWYgKHRoaXMuX3dlYldvcmtlckV4dEhvc3RFbmFibGVtZW50ICE9PSBMb2NhbFdlYldvcmtlckV4dEhvc3RFbmFibGVtZW50LkRpc2FibGVkKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnR1cCA9IChcblx0XHRcdFx0XHRcdGlzSW5pdGlhbFN0YXJ0XG5cdFx0XHRcdFx0XHRcdD8gKHRoaXMuX3dlYldvcmtlckV4dEhvc3RFbmFibGVtZW50ID09PSBMb2NhbFdlYldvcmtlckV4dEhvc3RFbmFibGVtZW50LkxhenkgPyBFeHRlbnNpb25Ib3N0U3RhcnR1cC5MYXp5IDogRXh0ZW5zaW9uSG9zdFN0YXJ0dXAuRWFnZXJNYW51YWxTdGFydClcblx0XHRcdFx0XHRcdFx0OiBFeHRlbnNpb25Ib3N0U3RhcnR1cC5FYWdlckF1dG9TdGFydFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdlYldvcmtlckV4dGVuc2lvbkhvc3QsIHJ1bm5pbmdMb2NhdGlvbiwgc3RhcnR1cCwgdGhpcy5fY3JlYXRlV2ViV29ya2VyRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlcihydW5uaW5nTG9jYXRpb25zLCBydW5uaW5nTG9jYXRpb24pKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGNhc2UgRXh0ZW5zaW9uSG9zdEtpbmQuUmVtb3RlOiB7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZUFnZW50Q29ubmVjdGlvbiA9IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk7XG5cdFx0XHRcdGlmIChyZW1vdGVBZ2VudENvbm5lY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVtb3RlRXh0ZW5zaW9uSG9zdCwgcnVubmluZ0xvY2F0aW9uLCB0aGlzLl9jcmVhdGVSZW1vdGVFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyKHJ1bm5pbmdMb2NhdGlvbnMsIHJlbW90ZUFnZW50Q29ubmVjdGlvbi5yZW1vdGVBdXRob3JpdHkpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVMb2NhbFByb2Nlc3NFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyKHJ1bm5pbmdMb2NhdGlvbnM6IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIsIGlzSW5pdGlhbFN0YXJ0OiBib29sZWFuLCBkZXNpcmVkUnVubmluZ0xvY2F0aW9uOiBMb2NhbFByb2Nlc3NSdW5uaW5nTG9jYXRpb24pOiBJTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldEluaXREYXRhOiBhc3luYyAoKTogUHJvbWlzZTxJTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdEluaXREYXRhPiA9PiB7XG5cdFx0XHRcdGlmIChpc0luaXRpYWxTdGFydCkge1xuXHRcdFx0XHRcdC8vIEhlcmUgd2UgbG9hZCBldmVuIGV4dGVuc2lvbnMgdGhhdCB3b3VsZCBiZSBkaXNhYmxlZCBieSB3b3Jrc3BhY2UgdHJ1c3Rcblx0XHRcdFx0XHRjb25zdCBzY2FubmVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuX2V4dGVuc2lvblNjYW5uZXIuc2Nhbm5lZEV4dGVuc2lvbnM7XG5cdFx0XHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgTmF0aXZlRXh0ZW5zaW9uSG9zdEZhY3RvcnkuX2NyZWF0ZUxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIuc2Nhbm5lZEV4dGVuc2lvbnM6ICR7c2Nhbm5lZEV4dGVuc2lvbnMubWFwKGV4dCA9PiBleHQuaWRlbnRpZmllci52YWx1ZSkuam9pbignLCcpfWApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IGNoZWNrRW5hYmxlZEFuZFByb3Bvc2VkQVBJKHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCB0aGlzLl9leHRlbnNpb25zUHJvcG9zZWRBcGksIHNjYW5uZWRFeHRlbnNpb25zLCAvKiBpZ25vcmUgd29ya3NwYWNlIHRydXN0ICovdHJ1ZSk7XG5cdFx0XHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgTmF0aXZlRXh0ZW5zaW9uSG9zdEZhY3RvcnkuX2NyZWF0ZUxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIubG9jYWxFeHRlbnNpb25zOiAke2xvY2FsRXh0ZW5zaW9ucy5tYXAoZXh0ID0+IGV4dC5pZGVudGlmaWVyLnZhbHVlKS5qb2luKCcsJyl9YCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgcnVubmluZ0xvY2F0aW9uID0gcnVubmluZ0xvY2F0aW9ucy5jb21wdXRlUnVubmluZ0xvY2F0aW9uKGxvY2FsRXh0ZW5zaW9ucywgW10sIGZhbHNlKTtcblx0XHRcdFx0XHRjb25zdCBteUV4dGVuc2lvbnMgPSBmaWx0ZXJFeHRlbnNpb25EZXNjcmlwdGlvbnMobG9jYWxFeHRlbnNpb25zLCBydW5uaW5nTG9jYXRpb24sIGV4dFJ1bm5pbmdMb2NhdGlvbiA9PiBkZXNpcmVkUnVubmluZ0xvY2F0aW9uLmVxdWFscyhleHRSdW5uaW5nTG9jYXRpb24pKTtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gbmV3IEV4dGVuc2lvbkhvc3RFeHRlbnNpb25zKDAsIGxvY2FsRXh0ZW5zaW9ucywgbXlFeHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBOYXRpdmVFeHRlbnNpb25Ib3N0RmFjdG9yeS5fY3JlYXRlTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlci5teUV4dGVuc2lvbnM6ICR7bXlFeHRlbnNpb25zLm1hcChleHQgPT4gZXh0LmlkZW50aWZpZXIudmFsdWUpLmpvaW4oJywnKX1gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucyB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHJlc3RhcnQgY2FzZVxuXHRcdFx0XHRcdGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgdGhpcy5fZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpO1xuXHRcdFx0XHRcdGNvbnN0IG15RXh0ZW5zaW9ucyA9IHJ1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlSdW5uaW5nTG9jYXRpb24oc25hcHNob3QuZXh0ZW5zaW9ucywgZGVzaXJlZFJ1bm5pbmdMb2NhdGlvbik7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IG5ldyBFeHRlbnNpb25Ib3N0RXh0ZW5zaW9ucyhzbmFwc2hvdC52ZXJzaW9uSWQsIHNuYXBzaG90LmV4dGVuc2lvbnMsIG15RXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVdlYldvcmtlckV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIocnVubmluZ0xvY2F0aW9uczogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uVHJhY2tlciwgZGVzaXJlZFJ1bm5pbmdMb2NhdGlvbjogTG9jYWxXZWJXb3JrZXJSdW5uaW5nTG9jYXRpb24pOiBJV2ViV29ya2VyRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldEluaXREYXRhOiBhc3luYyAoKTogUHJvbWlzZTxJV2ViV29ya2VyRXh0ZW5zaW9uSG9zdEluaXREYXRhPiA9PiB7XG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgdGhpcy5fZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpO1xuXHRcdFx0XHRjb25zdCBteUV4dGVuc2lvbnMgPSBydW5uaW5nTG9jYXRpb25zLmZpbHRlckJ5UnVubmluZ0xvY2F0aW9uKHNuYXBzaG90LmV4dGVuc2lvbnMsIGRlc2lyZWRSdW5uaW5nTG9jYXRpb24pO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gbmV3IEV4dGVuc2lvbkhvc3RFeHRlbnNpb25zKHNuYXBzaG90LnZlcnNpb25JZCwgc25hcHNob3QuZXh0ZW5zaW9ucywgbXlFeHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucyB9O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVSZW1vdGVFeHRlbnNpb25Ib3N0RGF0YVByb3ZpZGVyKHJ1bm5pbmdMb2NhdGlvbnM6IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIsIHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogSVJlbW90ZUV4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eSxcblx0XHRcdGdldEluaXREYXRhOiBhc3luYyAoKTogUHJvbWlzZTxJUmVtb3RlRXh0ZW5zaW9uSG9zdEluaXREYXRhPiA9PiB7XG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgdGhpcy5fZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpO1xuXG5cdFx0XHRcdGNvbnN0IHJlbW90ZUVudiA9IGF3YWl0IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRcdFx0XHRpZiAoIXJlbW90ZUVudikge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHByb3ZpZGUgaW5pdCBkYXRhIGZvciByZW1vdGUgZXh0ZW5zaW9uIGhvc3QhJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBteUV4dGVuc2lvbnMgPSBydW5uaW5nTG9jYXRpb25zLmZpbHRlckJ5RXh0ZW5zaW9uSG9zdEtpbmQoc25hcHNob3QuZXh0ZW5zaW9ucywgRXh0ZW5zaW9uSG9zdEtpbmQuUmVtb3RlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IG5ldyBFeHRlbnNpb25Ib3N0RXh0ZW5zaW9ucyhzbmFwc2hvdC52ZXJzaW9uSWQsIHNuYXBzaG90LmV4dGVuc2lvbnMsIG15RXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjb25uZWN0aW9uRGF0YTogdGhpcy5fcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLmdldENvbm5lY3Rpb25EYXRhKHJlbW90ZUF1dGhvcml0eSksXG5cdFx0XHRcdFx0cGlkOiByZW1vdGVFbnYucGlkLFxuXHRcdFx0XHRcdGFwcFJvb3Q6IHJlbW90ZUVudi5hcHBSb290LFxuXHRcdFx0XHRcdGV4dGVuc2lvbkhvc3RMb2dzUGF0aDogcmVtb3RlRW52LmV4dGVuc2lvbkhvc3RMb2dzUGF0aCxcblx0XHRcdFx0XHRnbG9iYWxTdG9yYWdlSG9tZTogcmVtb3RlRW52Lmdsb2JhbFN0b3JhZ2VIb21lLFxuXHRcdFx0XHRcdHdvcmtzcGFjZVN0b3JhZ2VIb21lOiByZW1vdGVFbnYud29ya3NwYWNlU3RvcmFnZUhvbWUsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9ucyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIGRldGVybWluZUxvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQoZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogTG9jYWxXZWJXb3JrZXJFeHRIb3N0RW5hYmxlbWVudCB7XG5cdGlmIChlbnZpcm9ubWVudFNlcnZpY2UuaXNFeHRlbnNpb25EZXZlbG9wbWVudCAmJiBlbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kPy5zb21lKGsgPT4gayA9PT0gJ3dlYicpKSB7XG5cdFx0cmV0dXJuIExvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQuRWFnZXI7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgY29uZmlnID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8V2ViV29ya2VyRXh0SG9zdENvbmZpZ1ZhbHVlPih3ZWJXb3JrZXJFeHRIb3N0Q29uZmlnKTtcblx0XHRpZiAoY29uZmlnID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gTG9jYWxXZWJXb3JrZXJFeHRIb3N0RW5hYmxlbWVudC5FYWdlcjtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZyA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gTG9jYWxXZWJXb3JrZXJFeHRIb3N0RW5hYmxlbWVudC5MYXp5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gTG9jYWxXZWJXb3JrZXJFeHRIb3N0RW5hYmxlbWVudC5EaXNhYmxlZDtcblx0XHR9XG5cdH1cbn1cblxuY29uc3QgZW51bSBMb2NhbFdlYldvcmtlckV4dEhvc3RFbmFibGVtZW50IHtcblx0RGlzYWJsZWQgPSAwLFxuXHRFYWdlciA9IDEsXG5cdExhenkgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVFeHRlbnNpb25Ib3N0S2luZFBpY2tlciBpbXBsZW1lbnRzIElFeHRlbnNpb25Ib3N0S2luZFBpY2tlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaGFzUmVtb3RlRXh0SG9zdDogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzV2ViV29ya2VyRXh0SG9zdDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5faGFzUmVtb3RlRXh0SG9zdCA9IEJvb2xlYW4oZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0Y29uc3Qgd2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQgPSBkZXRlcm1pbmVMb2NhbFdlYldvcmtlckV4dEhvc3RFbmFibGVtZW50KGVudmlyb25tZW50U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuX2hhc1dlYldvcmtlckV4dEhvc3QgPSAod2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQgIT09IExvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQuRGlzYWJsZWQpO1xuXHR9XG5cblx0cHVibGljIHBpY2tFeHRlbnNpb25Ib3N0S2luZChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZXh0ZW5zaW9uS2luZHM6IEV4dGVuc2lvbktpbmRbXSwgaXNJbnN0YWxsZWRMb2NhbGx5OiBib29sZWFuLCBpc0luc3RhbGxlZFJlbW90ZWx5OiBib29sZWFuLCBwcmVmZXJlbmNlOiBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZSk6IEV4dGVuc2lvbkhvc3RLaW5kIHwgbnVsbCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gTmF0aXZlRXh0ZW5zaW9uSG9zdEtpbmRQaWNrZXIucGlja0V4dGVuc2lvbkhvc3RLaW5kKGV4dGVuc2lvbktpbmRzLCBpc0luc3RhbGxlZExvY2FsbHksIGlzSW5zdGFsbGVkUmVtb3RlbHksIHByZWZlcmVuY2UsIHRoaXMuX2hhc1JlbW90ZUV4dEhvc3QsIHRoaXMuX2hhc1dlYldvcmtlckV4dEhvc3QpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYHBpY2tSdW5uaW5nTG9jYXRpb24gZm9yICR7ZXh0ZW5zaW9uSWQudmFsdWV9LCBleHRlbnNpb24ga2luZHM6IFske2V4dGVuc2lvbktpbmRzLmpvaW4oJywgJyl9XSwgaXNJbnN0YWxsZWRMb2NhbGx5OiAke2lzSW5zdGFsbGVkTG9jYWxseX0sIGlzSW5zdGFsbGVkUmVtb3RlbHk6ICR7aXNJbnN0YWxsZWRSZW1vdGVseX0sIHByZWZlcmVuY2U6ICR7ZXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2VUb1N0cmluZyhwcmVmZXJlbmNlKX0gPT4gJHtleHRlbnNpb25Ib3N0S2luZFRvU3RyaW5nKHJlc3VsdCl9YCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgcGlja0V4dGVuc2lvbkhvc3RLaW5kKGV4dGVuc2lvbktpbmRzOiBFeHRlbnNpb25LaW5kW10sIGlzSW5zdGFsbGVkTG9jYWxseTogYm9vbGVhbiwgaXNJbnN0YWxsZWRSZW1vdGVseTogYm9vbGVhbiwgcHJlZmVyZW5jZTogRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UsIGhhc1JlbW90ZUV4dEhvc3Q6IGJvb2xlYW4sIGhhc1dlYldvcmtlckV4dEhvc3Q6IGJvb2xlYW4pOiBFeHRlbnNpb25Ib3N0S2luZCB8IG51bGwge1xuXHRcdGNvbnN0IHJlc3VsdDogRXh0ZW5zaW9uSG9zdEtpbmRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uS2luZCBvZiBleHRlbnNpb25LaW5kcykge1xuXHRcdFx0aWYgKGV4dGVuc2lvbktpbmQgPT09ICd1aScgJiYgaXNJbnN0YWxsZWRMb2NhbGx5KSB7XG5cdFx0XHRcdC8vIHVpIGV4dGVuc2lvbnMgcnVuIGxvY2FsbHkgaWYgcG9zc2libGVcblx0XHRcdFx0aWYgKHByZWZlcmVuY2UgPT09IEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLk5vbmUgfHwgcHJlZmVyZW5jZSA9PT0gRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UuTG9jYWwpIHtcblx0XHRcdFx0XHRyZXR1cm4gRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsUHJvY2Vzcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25LaW5kID09PSAnd29ya3NwYWNlJyAmJiBpc0luc3RhbGxlZFJlbW90ZWx5KSB7XG5cdFx0XHRcdC8vIHdvcmtzcGFjZSBleHRlbnNpb25zIHJ1biByZW1vdGVseSBpZiBwb3NzaWJsZVxuXHRcdFx0XHRpZiAocHJlZmVyZW5jZSA9PT0gRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UuTm9uZSB8fCBwcmVmZXJlbmNlID09PSBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZS5SZW1vdGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gRXh0ZW5zaW9uSG9zdEtpbmQuUmVtb3RlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKEV4dGVuc2lvbkhvc3RLaW5kLlJlbW90ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25LaW5kID09PSAnd29ya3NwYWNlJyAmJiAhaGFzUmVtb3RlRXh0SG9zdCkge1xuXHRcdFx0XHQvLyB3b3Jrc3BhY2UgZXh0ZW5zaW9ucyBhbHNvIHJ1biBsb2NhbGx5IGlmIHRoZXJlIGlzIG5vIHJlbW90ZVxuXHRcdFx0XHRpZiAocHJlZmVyZW5jZSA9PT0gRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UuTm9uZSB8fCBwcmVmZXJlbmNlID09PSBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZS5Mb2NhbCkge1xuXHRcdFx0XHRcdHJldHVybiBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3M7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbktpbmQgPT09ICd3ZWInICYmIGlzSW5zdGFsbGVkTG9jYWxseSAmJiBoYXNXZWJXb3JrZXJFeHRIb3N0KSB7XG5cdFx0XHRcdC8vIHdlYiB3b3JrZXIgZXh0ZW5zaW9ucyBydW4gaW4gdGhlIGxvY2FsIHdlYiB3b3JrZXIgaWYgcG9zc2libGVcblx0XHRcdFx0aWYgKHByZWZlcmVuY2UgPT09IEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLk5vbmUgfHwgcHJlZmVyZW5jZSA9PT0gRXh0ZW5zaW9uUnVubmluZ1ByZWZlcmVuY2UuTG9jYWwpIHtcblx0XHRcdFx0XHRyZXR1cm4gRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxXZWJXb3JrZXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxXZWJXb3JrZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiAocmVzdWx0Lmxlbmd0aCA+IDAgPyByZXN1bHRbMF0gOiBudWxsKTtcblx0fVxufVxuXG5jbGFzcyBSZXN0YXJ0RXh0ZW5zaW9uSG9zdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5yZXN0YXJ0RXh0ZW5zaW9uSG9zdCcsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMigncmVzdGFydEV4dGVuc2lvbkhvc3QnLCBcIlJlc3RhcnQgRXh0ZW5zaW9uIEhvc3RcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBzdG9wcGVkID0gYXdhaXQgZXh0ZW5zaW9uU2VydmljZS5zdG9wRXh0ZW5zaW9uSG9zdHMobmxzLmxvY2FsaXplKCdyZXN0YXJ0RXh0ZW5zaW9uSG9zdC5yZWFzb24nLCBcIkFuIGV4cGxpY2l0IHJlcXVlc3RcIikpO1xuXHRcdGlmIChzdG9wcGVkKSB7XG5cdFx0XHRleHRlbnNpb25TZXJ2aWNlLnN0YXJ0RXh0ZW5zaW9uSG9zdHMoKTtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKFJlc3RhcnRFeHRlbnNpb25Ib3N0QWN0aW9uKTtcblxucmVnaXN0ZXJTaW5nbGV0b24oSUV4dGVuc2lvblNlcnZpY2UsIE5hdGl2ZUV4dGVuc2lvblNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFlBQVksaUJBQWlCO0FBQzdCLFNBQVMsWUFBWTtBQUVyQixZQUFZLFNBQVM7QUFDckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLHVCQUF1QjtBQUN6QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLGdDQUFnQztBQUV6QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQkFBcUMsc0JBQXNCLGdCQUFnQjtBQUNwRixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFDQUFxQztBQUU5QyxTQUFTLGlDQUFpQyw4QkFBOEIsc0JBQXNDLGdDQUFnQztBQUM5SSxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLGVBQWUsOEJBQThCO0FBQ3RELFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsaUJBQWlCLHNDQUFzQyw0Q0FBNEM7QUFDNUcsU0FBK0UsOEJBQThCO0FBQzdHLFNBQVMsMEJBQTBCLDJCQUFrRCxpQkFBaUIsa0JBQXNDLG9CQUFvQiw0QkFBNEIsb0JBQW9CLDJCQUEyQjtBQUUzTyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG1CQUFtQiw0QkFBc0QsMkJBQTJCLDBDQUEwQztBQUV2SixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJDQUEyQztBQUVwRCxTQUEwQyxtQ0FBbUM7QUFDN0UsU0FBUyx5QkFBeUIsc0JBQXNDLG1CQUFnRCxhQUFhLDhCQUE4QjtBQUNuSyxTQUFTLDZCQUE2QjtBQUN0QyxTQUF5RSwyQkFBMkI7QUFDcEcsU0FBUyw4QkFBOEI7QUFDdkMsU0FBcUYsdUNBQXVDO0FBQzVILFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUJBQW1CLHNCQUFzQjtBQUNsRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUErQiwyQkFBMkI7QUFFbkQsSUFBTSx5QkFBTixjQUFxQyx5QkFBc0Q7QUFBQSxFQUtqRyxZQUN3QixzQkFDRCxxQkFDUSxvQkFDWCxrQkFDbUIsNEJBQ3hCLGFBQ0csZ0JBQ3FCLDRCQUNaLGdCQUNILHNCQUNjLG9DQUN4QixZQUNRLG9CQUNZLGdDQUNkLGtCQUNjLGdDQUNJLG9CQUNOLGNBQ1Usd0JBQ0UsMEJBQ1Esa0NBQ25DLGVBQ2Y7QUFDRCxVQUFNLHdCQUF3QixxQkFBcUIsZUFBZSxxQkFBcUI7QUFDdkYsVUFBTSxtQkFBbUIscUJBQXFCLGVBQWUsc0JBQXNCO0FBQ25GLFVBQU0sdUJBQXVCLElBQUk7QUFBQSxNQUNoQztBQUFBLE1BQ0E7QUFBQSxNQUNBLE1BQU0sS0FBSyx1Q0FBdUM7QUFBQSxNQUNsRDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0MsRUFBRSxpQkFBaUIsTUFBTSx1Q0FBdUMsTUFBTTtBQUFBLE1BQ3RFO0FBQUEsTUFDQTtBQUFBLE1BQ0EsSUFBSSw4QkFBOEIsb0JBQW9CLHNCQUFzQixVQUFVO0FBQUEsTUFDdEY7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQTNDcUM7QUFDTjtBQUNVO0FBQ0U7QUFDUTtBQXZCcEQsU0FBaUIscUJBQXFCLElBQUksMEJBQTBCO0FBZ0VuRSxTQUFLLG9CQUFvQjtBQVF6QixxQkFBaUIsS0FBSyxlQUFlLEtBQUssRUFBRSxLQUFLLE1BQU07QUFFdEQ7QUFBQSxRQUFrQjtBQUFBLFFBQVksTUFBTTtBQUNuQyxlQUFLLFlBQVk7QUFBQSxRQUNsQjtBQUFBLFFBQUc7QUFBQTtBQUFBLE1BQWdCO0FBQUEsSUFDcEIsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsMEJBQTREO0FBQ3pFLFdBQU8sS0FBSyxrQkFBa0I7QUFBQSxFQUMvQjtBQUFBLEVBRW1CLHdCQUF3QixlQUFzQyxNQUFjLFFBQTZCO0FBRTNILFVBQU0sc0JBQTZDLENBQUM7QUFDcEQsVUFBTSxtQkFBbUIsS0FBSyxvQkFBb0I7QUFDbEQsZUFBVyxPQUFPLE9BQU8sS0FBSyxnQkFBZ0IsR0FBRztBQUNoRCxZQUFNLGtCQUFrQixpQkFBaUIsR0FBRztBQUM1QyxVQUFJLGdCQUFnQixxQkFBcUIsY0FBYyxrQkFBa0IsZ0JBQWdCLEVBQUUsR0FBRztBQUM3Riw0QkFBb0IsS0FBSyxnQkFBZ0IsRUFBRTtBQUFBLE1BQzVDO0FBQUEsSUFDRDtBQUVBLFVBQU0sd0JBQXdCLGVBQWUsTUFBTSxNQUFNO0FBRXpELFFBQUksY0FBYyxTQUFTLGtCQUFrQixjQUFjO0FBQzFELFVBQUksU0FBUyxzQkFBc0IsaUJBQWlCO0FBQ25ELGFBQUsscUJBQXFCO0FBQUEsVUFDekIsU0FBUztBQUFBLFVBQ1QsSUFBSSxTQUFTLHlDQUF5QyxnREFBZ0Q7QUFBQSxVQUN0RyxDQUFDO0FBQUEsWUFDQSxPQUFPLElBQUksU0FBUyxZQUFZLGtCQUFrQjtBQUFBLFlBQ2xELEtBQUssTUFBTTtBQUNWLG1CQUFLLHNCQUFzQixlQUFlLENBQUMsYUFBYTtBQUN2RCxzQkFBTSxjQUFjLFNBQVMsSUFBSSxZQUFZO0FBQzdDLDRCQUFZLFFBQVE7QUFBQSxjQUNyQixDQUFDO0FBQUEsWUFDRjtBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0Y7QUFDQTtBQUFBLE1BQ0Q7QUFFQSxXQUFLLHVCQUF1QixhQUFhO0FBQ3pDLFdBQUssaUNBQWlDLE1BQU0sUUFBUSxtQkFBbUI7QUFFdkUsV0FBSyxtQkFBbUIsY0FBYztBQUV0QyxVQUFJLEtBQUssbUJBQW1CLDJCQUEyQixHQUFHO0FBQ3pELGFBQUssWUFBWSxLQUFLLDhDQUE4QztBQUNwRSxhQUFLLHFCQUFxQixPQUFPLElBQUksU0FBUyxnQ0FBZ0MsMkRBQTJELEdBQUcsRUFBRSxXQUFXLElBQUssQ0FBQztBQUMvSixhQUFLLG9CQUFvQjtBQUFBLE1BQzFCLE9BQU87QUFDTixjQUFNLFVBQTJCLENBQUM7QUFDbEMsWUFBSSxLQUFLLG9CQUFvQixTQUFTO0FBQ3JDLGtCQUFRLEtBQUs7QUFBQSxZQUNaLE9BQU8sSUFBSSxTQUFTLGVBQWUsd0JBQXdCO0FBQUEsWUFDM0QsS0FBSyxNQUFNO0FBQ1YsbUJBQUssc0JBQXNCLGVBQWUsY0FBWTtBQUNyRCxzQkFBTSxpQkFBaUIsU0FBUyxJQUFJLGVBQWU7QUFDbkQsK0JBQWUsZUFBZSx3QkFBd0I7QUFBQSxjQUN2RCxDQUFDO0FBQUEsWUFDRjtBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0YsT0FBTztBQUNOLGtCQUFRLEtBQUs7QUFBQSxZQUNaLE9BQU8sSUFBSSxTQUFTLFlBQVksc0JBQXNCO0FBQUEsWUFDdEQsS0FBSyxNQUFNLEtBQUssbUJBQW1CLGFBQWE7QUFBQSxVQUNqRCxDQUFDO0FBQUEsUUFDRjtBQUVBLGdCQUFRLEtBQUs7QUFBQSxVQUNaLE9BQU8sSUFBSSxTQUFTLFdBQVcsd0JBQXdCO0FBQUEsVUFDdkQsS0FBSyxNQUFNLEtBQUssb0JBQW9CO0FBQUEsUUFDckMsQ0FBQztBQUVELFlBQUksS0FBSyxvQkFBb0IsU0FBUztBQUNyQyxrQkFBUSxLQUFLO0FBQUEsWUFDWixPQUFPLElBQUksU0FBUyxhQUFhLFlBQVk7QUFBQSxZQUM3QyxLQUFLLE1BQU07QUFDVixtQkFBSyxzQkFBc0IsZUFBZSxjQUFZO0FBQ3JELHNCQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCw4QkFBYyxLQUFLLHdDQUF3QztBQUFBLGNBQzVELENBQUM7QUFBQSxZQUNGO0FBQUEsVUFDRCxDQUFDO0FBQUEsUUFDRjtBQUVBLGFBQUsscUJBQXFCLE9BQU8sU0FBUyxPQUFPLElBQUksU0FBUywwQkFBMEIsMkVBQTJFLEdBQUcsT0FBTztBQUFBLE1BQzlLO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlDQUFpQyxNQUFjLFFBQXVCLHFCQUFrRDtBQWEvSCxTQUFLLGtCQUFrQixXQUFzRSxzQkFBc0I7QUFBQSxNQUNsSDtBQUFBLE1BQ0E7QUFBQSxNQUNBLGNBQWMsb0JBQW9CLElBQUksT0FBSyxFQUFFLEtBQUs7QUFBQSxJQUNuRCxDQUFDO0FBRUQsZUFBVyxlQUFlLHFCQUFxQjtBQWE5QyxXQUFLLGtCQUFrQixXQUF3RiwrQkFBK0I7QUFBQSxRQUM3STtBQUFBLFFBQ0E7QUFBQSxRQUNBLGFBQWEsWUFBWTtBQUFBLE1BQzFCLENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJQSxNQUFnQixrQkFBa0IsaUJBQWtEO0FBRW5GLFVBQU0scUJBQXFCLGdCQUFnQixRQUFRLEdBQUc7QUFDdEQsUUFBSSx1QkFBdUIsSUFBSTtBQUU5QixZQUFNLEVBQUUsTUFBTSxLQUFLLElBQUksdUJBQXVCLGVBQWU7QUFDN0QsYUFBTztBQUFBLFFBQ04sV0FBVztBQUFBLFVBQ1YsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFlBQ1YsTUFBTSxxQkFBcUI7QUFBQSxZQUMzQjtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBQUEsVUFDQSxpQkFBaUI7QUFBQSxRQUNsQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsV0FBTyxLQUFLLGtDQUFrQyxrQkFBa0IsY0FBYyxlQUFlO0FBQUEsRUFDOUY7QUFBQSxFQUVBLE1BQWMsaUJBQWlCLGlCQUF5QixLQUF3QjtBQUUvRSxVQUFNLHFCQUFxQixnQkFBZ0IsUUFBUSxHQUFHO0FBQ3RELFFBQUksdUJBQXVCLElBQUk7QUFFOUIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLDZCQUE2QixLQUFLLDBCQUEwQixrQkFBa0IsWUFBWTtBQUNoRyxRQUFJLDJCQUEyQixXQUFXLEdBQUc7QUFFNUMsWUFBTSxJQUFJLE1BQU0sOEJBQThCO0FBQUEsSUFDL0M7QUFFQSxVQUFNLFVBQVUsTUFBTSxRQUFRLElBQUksMkJBQTJCLElBQUksYUFBVyxRQUFRLGdCQUFnQixpQkFBaUIsR0FBRyxDQUFDLENBQUM7QUFFMUgsZUFBVyxVQUFVLFNBQVM7QUFDN0IsVUFBSSxRQUFRO0FBQ1gsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBR0EsVUFBTSxJQUFJLE1BQU0seUVBQXlFLHlCQUF5QixlQUFlLENBQUMsRUFBRTtBQUFBLEVBQ3JJO0FBQUEsRUFFVSxxQkFBd0Q7QUFDakUsV0FBTyxJQUFJLG9CQUFvQixhQUFXLEtBQUsscUJBQXFCLE9BQU8sQ0FBQztBQUFBLEVBQzdFO0FBQUEsRUFFQSxNQUFjLHFCQUFxQixTQUFrRTtBQUNwRyxTQUFLLGtCQUFrQix3QkFBd0I7QUFFL0MsVUFBTSxrQkFBa0IsS0FBSyxvQkFBb0I7QUFFakQsUUFBSSxZQUE0QztBQUNoRCxRQUFJLG1CQUE0QyxDQUFDO0FBRWpELFFBQUksaUJBQWlCO0FBRXBCLFdBQUssZ0NBQWdDLHlCQUF5QixPQUFPLFFBQVE7QUFDNUUsWUFBSSxJQUFJLFdBQVcsUUFBUSxnQkFBZ0IsSUFBSSxjQUFjLGlCQUFpQjtBQUU3RSxpQkFBTztBQUFBLFFBQ1I7QUFDQSxvQkFBWSxLQUFLLDRCQUE0Qix5QkFBeUIsZUFBZSxDQUFDLEVBQUU7QUFDeEYsWUFBSSxNQUFNO0FBQ1QsZUFBSyxZQUFZLEtBQUssMENBQTBDLHlCQUF5QixlQUFlLENBQUMsS0FBSztBQUFBLFFBQy9HO0FBQ0EsWUFBSTtBQUNILGlCQUFPLEtBQUssaUJBQWlCLGlCQUFpQixHQUFHO0FBQUEsUUFDbEQsVUFBRTtBQUNELHNCQUFZLEtBQUssMkJBQTJCLHlCQUF5QixlQUFlLENBQUMsRUFBRTtBQUN2RixjQUFJLE1BQU07QUFDVCxpQkFBSyxZQUFZLEtBQUssMENBQTBDLHlCQUF5QixlQUFlLENBQUMsR0FBRztBQUFBLFVBQzdHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFVBQUksTUFBTTtBQUNULGFBQUssWUFBWSxLQUFLLDJFQUEyRTtBQUFBLE1BQ2xHO0FBS0EsWUFBTSxLQUFLLGlDQUFpQztBQUU1QyxVQUFJLE1BQU07QUFDVCxhQUFLLFlBQVksS0FBSyx5RUFBeUU7QUFBQSxNQUNoRztBQUVBLFlBQU0sa0JBQWtCLE1BQU0sS0FBSyx3QkFBd0I7QUFDM0QsWUFBTSxxQkFBcUIsZ0JBQWdCLE9BQU8sZUFBYSxvQkFBb0IsU0FBUyxDQUFDO0FBQzdGLFVBQUksbUJBQW1CLFFBQVE7QUFDOUIsZ0JBQVEsUUFBUSxJQUFJLG1CQUFtQixrQkFBa0IsQ0FBQztBQUFBLE1BQzNEO0FBRUEsVUFBSTtBQUNKLFVBQUk7QUFDSCx5QkFBaUIsTUFBTSxLQUFLLHlCQUF5QixlQUFlO0FBQUEsTUFDckUsU0FBUyxLQUFLO0FBQ2IsWUFBSSw2QkFBNkIsa0JBQWtCLEdBQUcsR0FBRztBQUN4RCxjQUFJLFlBQVksTUFBTSxLQUFLLHVCQUF1QixlQUFlO0FBQUEsUUFDbEUsT0FBTztBQUNOLGNBQUksNkJBQTZCLFVBQVUsR0FBRyxHQUFHO0FBQ2hELG9CQUFRLElBQUkseURBQXlEO0FBQUEsVUFDdEU7QUFBQSxRQUNEO0FBQ0EsYUFBSyxnQ0FBZ0MsMkJBQTJCLGlCQUFpQixHQUFHO0FBR3BGLGVBQU8sS0FBSyx5QkFBeUIsT0FBTztBQUFBLE1BQzdDO0FBR0EsV0FBSyxnQ0FBZ0Msc0JBQXNCLGVBQWUsV0FBVyxlQUFlLE9BQU87QUFDM0csV0FBSyx1QkFBdUIscUJBQXFCLGVBQWUsaUJBQWlCO0FBR2pGLFlBQU0sYUFBYSxLQUFLLG9CQUFvQixjQUFjO0FBQzFELFVBQUksWUFBWTtBQUNmLG1CQUFXLGlCQUFpQixPQUFPLE1BQU07QUFDeEMsY0FBSSxFQUFFLFNBQVMsOEJBQThCLGdCQUFnQjtBQUM1RCxpQkFBSyxnQ0FBZ0Msd0JBQXdCLGVBQWU7QUFBQSxVQUM3RTtBQUFBLFFBQ0QsQ0FBQztBQUNELG1CQUFXLGVBQWUsTUFBTSxLQUFLLHVCQUF1QixDQUFDO0FBQUEsTUFDOUQ7QUFHQSxPQUFDLFdBQVcsZ0JBQWdCLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxRQUNqRCxLQUFLLG9CQUFvQixlQUFlO0FBQUEsUUFDeEMsS0FBSyxnQ0FBZ0MsZUFBZTtBQUFBLE1BQ3JELENBQUM7QUFFRCxVQUFJLENBQUMsV0FBVztBQUNmLGFBQUsscUJBQXFCLE9BQU8sRUFBRSxVQUFVLFNBQVMsT0FBTyxTQUFTLElBQUksU0FBUyx5QkFBeUIsb0NBQW9DLEVBQUUsQ0FBQztBQUVuSixlQUFPLEtBQUsseUJBQXlCLE9BQU87QUFBQSxNQUM3QztBQUVBLFlBQU0sc0JBQXNCLFVBQVU7QUFDdEMsV0FBSyxVQUFVLEtBQUssc0JBQXNCLHlCQUF5QixPQUFLO0FBQ3ZFLFlBQUksRUFBRSxxQkFBcUIsaUNBQWlDLEdBQUc7QUFDOUQseUNBQStCLEtBQUssc0JBQXNCLFNBQVMsaUNBQWlDLEdBQUcsbUJBQW1CO0FBQUEsUUFDM0g7QUFBQSxNQUNELENBQUMsQ0FBQztBQUNGLHFDQUErQixLQUFLLHNCQUFzQixTQUFTLGlDQUFpQyxHQUFHLG1CQUFtQjtBQUFBLElBQzNILE9BQU87QUFFTixXQUFLLGdDQUFnQyx5QkFBeUIsT0FBTyxRQUFRLEdBQUc7QUFBQSxJQUVqRjtBQUVBLFdBQU8sS0FBSyx5QkFBeUIsU0FBUyxnQkFBZ0I7QUFBQSxFQUMvRDtBQUFBLEVBRUEsTUFBYyx5QkFBeUIsU0FBbUQsbUJBQTRDLENBQUMsR0FBa0I7QUFHeEosVUFBTSxLQUFLLGlDQUFpQztBQUU1QyxRQUFJLGlCQUFpQixRQUFRO0FBQzVCLGNBQVEsUUFBUSxJQUFJLGlCQUFpQixnQkFBZ0IsQ0FBQztBQUFBLElBQ3ZEO0FBRUEsWUFBUSxRQUFRLElBQUksZ0JBQWdCLE1BQU0sS0FBSyx3QkFBd0IsQ0FBQyxDQUFDO0FBQUEsRUFDMUU7QUFBQSxFQUVBLE1BQWdCLHFCQUFxQixNQUE2QjtBQUVqRSxVQUFNLEtBQUssc0JBQXNCO0FBR2pDLFVBQU0sYUFBYSxLQUFLLG9CQUFvQixjQUFjO0FBQzFELGdCQUFZLFFBQVE7QUFFcEIsUUFBSSx5QkFBeUIsS0FBSyxtQkFBbUIsRUFBRSwyQkFBMkI7QUFFakYsVUFBSSxNQUFNO0FBQ1QsYUFBSyxZQUFZLEtBQUssZ0RBQWdELElBQUksR0FBRztBQUFBLE1BQzlFO0FBQ0EsV0FBSyxtQkFBbUIsS0FBSyxJQUFJO0FBQUEsSUFDbEMsT0FBTztBQUVOLFdBQUssbUJBQW1CLFlBQVk7QUFBQSxJQUNyQztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsdUJBQXVCLGlCQUEyQztBQUMvRSxVQUFNLGFBQWEsY0FBYyxlQUFlO0FBQ2hELFVBQU0saUJBQWlCLEtBQUssZ0JBQWdCLHNCQUFzQixVQUFVO0FBQzVFLFFBQUksQ0FBQyxnQkFBZ0I7QUFDcEIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLHNCQUFzQixlQUFlO0FBQzNDLFVBQU0sZ0JBQWdCLE1BQU0sS0FBSyx3QkFBd0I7QUFDekQsVUFBTSxZQUFZLGNBQWMsT0FBTyxPQUFLLEVBQUUsV0FBVyxVQUFVLG1CQUFtQixFQUFFLENBQUM7QUFDekYsUUFBSSxXQUFXO0FBQ2QsVUFBSSxDQUFDLG1CQUFtQixLQUFLLGFBQWEsS0FBSyw2QkFBNkIsV0FBVyxLQUFLLEdBQUc7QUFDOUYsY0FBTSxVQUFVLElBQUksU0FBUyxrQkFBa0IseUVBQXlFLGVBQWUsWUFBWTtBQUNuSixhQUFLLHFCQUFxQjtBQUFBLFVBQU8sU0FBUztBQUFBLFVBQU07QUFBQSxVQUMvQyxDQUFDO0FBQUEsWUFDQSxPQUFPLElBQUksU0FBUyxVQUFVLG1CQUFtQjtBQUFBLFlBQ2pELEtBQUssWUFBWTtBQUNoQixvQkFBTSxLQUFLLDRCQUE0QixjQUFjLENBQUMsWUFBWSxTQUFTLENBQUMsR0FBRyxnQkFBZ0IsZUFBZTtBQUM5RyxvQkFBTSxLQUFLLGFBQWEsT0FBTztBQUFBLFlBQ2hDO0FBQUEsVUFDRCxDQUFDO0FBQUEsVUFDRDtBQUFBLFlBQ0MsUUFBUTtBQUFBLFlBQ1IsVUFBVSxxQkFBcUI7QUFBQSxVQUNoQztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxPQUFPO0FBRU4sWUFBTSxVQUFVLElBQUksU0FBUyxtQkFBbUIsaUdBQWlHLGVBQWUsWUFBWTtBQUM1SyxXQUFLLHFCQUFxQjtBQUFBLFFBQU8sU0FBUztBQUFBLFFBQU07QUFBQSxRQUMvQyxDQUFDO0FBQUEsVUFDQSxPQUFPLElBQUksU0FBUyxXQUFXLG9CQUFvQjtBQUFBLFVBQ25ELEtBQUssWUFBWTtBQUNoQixrQkFBTSxDQUFDLGdCQUFnQixJQUFJLE1BQU0sS0FBSyx5QkFBeUIsY0FBYyxDQUFDLEVBQUUsSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLGtCQUFrQixJQUFJO0FBQ2xJLGdCQUFJLGtCQUFrQjtBQUNyQixvQkFBTSxLQUFLLDRCQUE0QixtQkFBbUIsZ0JBQWdCO0FBQzFFLG9CQUFNLEtBQUssYUFBYSxPQUFPO0FBQUEsWUFDaEMsT0FBTztBQUNOLG1CQUFLLHFCQUFxQixNQUFNLElBQUksU0FBUyw2QkFBNkIsZ0NBQWdDLENBQUM7QUFBQSxZQUM1RztBQUFBLFVBRUQ7QUFBQSxRQUNELENBQUM7QUFBQSxRQUNEO0FBQUEsVUFDQyxRQUFRO0FBQUEsVUFDUixVQUFVLHFCQUFxQjtBQUFBLFFBQ2hDO0FBQUEsTUFDRDtBQUFBLElBRUQ7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBdmNhLHlCQUFOO0FBQUEsRUFNSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBM0JVO0FBeWNiLElBQU0sNkJBQU4sTUFBa0U7QUFBQSxFQUlqRSxZQUNrQix3QkFDQSxtQkFDQSx3Q0FDdUIsdUJBQ1Ysb0JBQ3lCLDZCQUNoQyxzQkFDZSxxQkFDWSxpQ0FDcEIsYUFDN0I7QUFWZ0I7QUFDQTtBQUNBO0FBQ3VCO0FBRWU7QUFFakI7QUFDWTtBQUNwQjtBQUU5QixTQUFLLDhCQUE4Qix5Q0FBeUMsb0JBQW9CLG9CQUFvQjtBQUFBLEVBQ3JIO0FBQUEsRUFFTyxvQkFBb0Isa0JBQW1ELGlCQUEyQyxnQkFBZ0Q7QUFDeEssWUFBUSxnQkFBZ0IsTUFBTTtBQUFBLE1BQzdCLEtBQUssa0JBQWtCLGNBQWM7QUFDcEMsY0FBTSxVQUNMLGlCQUNHLHFCQUFxQixtQkFDckIscUJBQXFCO0FBRXpCLGVBQU8sS0FBSyxzQkFBc0IsZUFBZSxpQ0FBaUMsaUJBQWlCLFNBQVMsS0FBSyw2Q0FBNkMsa0JBQWtCLGdCQUFnQixlQUFlLENBQUM7QUFBQSxNQUNqTjtBQUFBLE1BQ0EsS0FBSyxrQkFBa0IsZ0JBQWdCO0FBQ3RDLFlBQUksS0FBSyxnQ0FBZ0Msa0JBQTBDO0FBQ2xGLGdCQUFNLFVBQ0wsaUJBQ0ksS0FBSyxnQ0FBZ0MsZUFBdUMscUJBQXFCLE9BQU8scUJBQXFCLG1CQUM5SCxxQkFBcUI7QUFFekIsaUJBQU8sS0FBSyxzQkFBc0IsZUFBZSx3QkFBd0IsaUJBQWlCLFNBQVMsS0FBSywwQ0FBMEMsa0JBQWtCLGVBQWUsQ0FBQztBQUFBLFFBQ3JMO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFBQSxNQUNBLEtBQUssa0JBQWtCLFFBQVE7QUFDOUIsY0FBTSx3QkFBd0IsS0FBSyxvQkFBb0IsY0FBYztBQUNyRSxZQUFJLHVCQUF1QjtBQUMxQixpQkFBTyxLQUFLLHNCQUFzQixlQUFlLHFCQUFxQixpQkFBaUIsS0FBSyx1Q0FBdUMsa0JBQWtCLHNCQUFzQixlQUFlLENBQUM7QUFBQSxRQUM1TDtBQUNBLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDZDQUE2QyxrQkFBbUQsZ0JBQXlCLHdCQUE2RjtBQUM3TixXQUFPO0FBQUEsTUFDTixhQUFhLFlBQXlEO0FBQ3JFLFlBQUksZ0JBQWdCO0FBRW5CLGdCQUFNLG9CQUFvQixNQUFNLEtBQUssa0JBQWtCO0FBQ3ZELGNBQUksTUFBTTtBQUNULGlCQUFLLFlBQVksS0FBSyw4RkFBOEYsa0JBQWtCLElBQUksU0FBTyxJQUFJLFdBQVcsS0FBSyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUU7QUFBQSxVQUNuTDtBQUVBLGdCQUFNLGtCQUFrQjtBQUFBLFlBQTJCLEtBQUs7QUFBQSxZQUFhLEtBQUs7QUFBQSxZQUE2QixLQUFLO0FBQUEsWUFBd0I7QUFBQTtBQUFBLFlBQStDO0FBQUEsVUFBSTtBQUN2TCxjQUFJLE1BQU07QUFDVCxpQkFBSyxZQUFZLEtBQUssNEZBQTRGLGdCQUFnQixJQUFJLFNBQU8sSUFBSSxXQUFXLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFO0FBQUEsVUFDL0s7QUFFQSxnQkFBTSxrQkFBa0IsaUJBQWlCLHVCQUF1QixpQkFBaUIsQ0FBQyxHQUFHLEtBQUs7QUFDMUYsZ0JBQU0sZUFBZSw0QkFBNEIsaUJBQWlCLGlCQUFpQix3QkFBc0IsdUJBQXVCLE9BQU8sa0JBQWtCLENBQUM7QUFDMUosZ0JBQU0sYUFBYSxJQUFJLHdCQUF3QixHQUFHLGlCQUFpQixhQUFhLElBQUksZUFBYSxVQUFVLFVBQVUsQ0FBQztBQUN0SCxjQUFJLE1BQU07QUFDVCxpQkFBSyxZQUFZLEtBQUsseUZBQXlGLGFBQWEsSUFBSSxTQUFPLElBQUksV0FBVyxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRTtBQUFBLFVBQ3pLO0FBQ0EsaUJBQU8sRUFBRSxXQUFXO0FBQUEsUUFDckIsT0FBTztBQUVOLGdCQUFNLFdBQVcsTUFBTSxLQUFLLHVDQUF1QztBQUNuRSxnQkFBTSxlQUFlLGlCQUFpQix3QkFBd0IsU0FBUyxZQUFZLHNCQUFzQjtBQUN6RyxnQkFBTSxhQUFhLElBQUksd0JBQXdCLFNBQVMsV0FBVyxTQUFTLFlBQVksYUFBYSxJQUFJLGVBQWEsVUFBVSxVQUFVLENBQUM7QUFDM0ksaUJBQU8sRUFBRSxXQUFXO0FBQUEsUUFDckI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDBDQUEwQyxrQkFBbUQsd0JBQTRGO0FBQ2hNLFdBQU87QUFBQSxNQUNOLGFBQWEsWUFBc0Q7QUFDbEUsY0FBTSxXQUFXLE1BQU0sS0FBSyx1Q0FBdUM7QUFDbkUsY0FBTSxlQUFlLGlCQUFpQix3QkFBd0IsU0FBUyxZQUFZLHNCQUFzQjtBQUN6RyxjQUFNLGFBQWEsSUFBSSx3QkFBd0IsU0FBUyxXQUFXLFNBQVMsWUFBWSxhQUFhLElBQUksZUFBYSxVQUFVLFVBQVUsQ0FBQztBQUMzSSxlQUFPLEVBQUUsV0FBVztBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHVDQUF1QyxrQkFBbUQsaUJBQTJEO0FBQzVKLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxhQUFhLFlBQW1EO0FBQy9ELGNBQU0sV0FBVyxNQUFNLEtBQUssdUNBQXVDO0FBRW5FLGNBQU0sWUFBWSxNQUFNLEtBQUssb0JBQW9CLGVBQWU7QUFDaEUsWUFBSSxDQUFDLFdBQVc7QUFDZixnQkFBTSxJQUFJLE1BQU0scURBQXFEO0FBQUEsUUFDdEU7QUFFQSxjQUFNLGVBQWUsaUJBQWlCLDBCQUEwQixTQUFTLFlBQVksa0JBQWtCLE1BQU07QUFDN0csY0FBTSxhQUFhLElBQUksd0JBQXdCLFNBQVMsV0FBVyxTQUFTLFlBQVksYUFBYSxJQUFJLGVBQWEsVUFBVSxVQUFVLENBQUM7QUFFM0ksZUFBTztBQUFBLFVBQ04sZ0JBQWdCLEtBQUssZ0NBQWdDLGtCQUFrQixlQUFlO0FBQUEsVUFDdEYsS0FBSyxVQUFVO0FBQUEsVUFDZixTQUFTLFVBQVU7QUFBQSxVQUNuQix1QkFBdUIsVUFBVTtBQUFBLFVBQ2pDLG1CQUFtQixVQUFVO0FBQUEsVUFDN0Isc0JBQXNCLFVBQVU7QUFBQSxVQUNoQztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXhITSw2QkFBTjtBQUFBLEVBUUc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWRHO0FBMEhOLFNBQVMseUNBQXlDLG9CQUFrRCxzQkFBOEU7QUFDakwsTUFBSSxtQkFBbUIsMEJBQTBCLG1CQUFtQiwwQkFBMEIsS0FBSyxPQUFLLE1BQU0sS0FBSyxHQUFHO0FBQ3JILFdBQU87QUFBQSxFQUNSLE9BQU87QUFDTixVQUFNLFNBQVMscUJBQXFCLFNBQXNDLHNCQUFzQjtBQUNoRyxRQUFJLFdBQVcsTUFBTTtBQUNwQixhQUFPO0FBQUEsSUFDUixXQUFXLFdBQVcsUUFBUTtBQUM3QixhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxJQUFXLGtDQUFYLGtCQUFXQSxxQ0FBWDtBQUNDLEVBQUFBLGtFQUFBLGNBQVcsS0FBWDtBQUNBLEVBQUFBLGtFQUFBLFdBQVEsS0FBUjtBQUNBLEVBQUFBLGtFQUFBLFVBQU8sS0FBUDtBQUhVLFNBQUFBO0FBQUEsR0FBQTtBQU1KLElBQU0sZ0NBQU4sTUFBd0U7QUFBQSxFQUs5RSxZQUMrQixvQkFDUCxzQkFDTyxhQUM3QjtBQUQ2QjtBQUU5QixTQUFLLG9CQUFvQixRQUFRLG1CQUFtQixlQUFlO0FBQ25FLFVBQU0sNkJBQTZCLHlDQUF5QyxvQkFBb0Isb0JBQW9CO0FBQ3BILFNBQUssdUJBQXdCLCtCQUErQjtBQUFBLEVBQzdEO0FBQUEsRUFFTyxzQkFBc0IsYUFBa0MsZ0JBQWlDLG9CQUE2QixxQkFBOEIsWUFBa0U7QUFDNU4sVUFBTSxTQUFTLDhCQUE4QixzQkFBc0IsZ0JBQWdCLG9CQUFvQixxQkFBcUIsWUFBWSxLQUFLLG1CQUFtQixLQUFLLG9CQUFvQjtBQUN6TCxTQUFLLFlBQVksTUFBTSwyQkFBMkIsWUFBWSxLQUFLLHVCQUF1QixlQUFlLEtBQUssSUFBSSxDQUFDLDBCQUEwQixrQkFBa0IsMEJBQTBCLG1CQUFtQixpQkFBaUIsbUNBQW1DLFVBQVUsQ0FBQyxPQUFPLDBCQUEwQixNQUFNLENBQUMsRUFBRTtBQUNyVCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsT0FBYyxzQkFBc0IsZ0JBQWlDLG9CQUE2QixxQkFBOEIsWUFBd0Msa0JBQTJCLHFCQUF3RDtBQUMxUCxVQUFNLFNBQThCLENBQUM7QUFDckMsZUFBVyxpQkFBaUIsZ0JBQWdCO0FBQzNDLFVBQUksa0JBQWtCLFFBQVEsb0JBQW9CO0FBRWpELFlBQUksZUFBZSwyQkFBMkIsUUFBUSxlQUFlLDJCQUEyQixPQUFPO0FBQ3RHLGlCQUFPLGtCQUFrQjtBQUFBLFFBQzFCLE9BQU87QUFDTixpQkFBTyxLQUFLLGtCQUFrQixZQUFZO0FBQUEsUUFDM0M7QUFBQSxNQUNEO0FBQ0EsVUFBSSxrQkFBa0IsZUFBZSxxQkFBcUI7QUFFekQsWUFBSSxlQUFlLDJCQUEyQixRQUFRLGVBQWUsMkJBQTJCLFFBQVE7QUFDdkcsaUJBQU8sa0JBQWtCO0FBQUEsUUFDMUIsT0FBTztBQUNOLGlCQUFPLEtBQUssa0JBQWtCLE1BQU07QUFBQSxRQUNyQztBQUFBLE1BQ0Q7QUFDQSxVQUFJLGtCQUFrQixlQUFlLENBQUMsa0JBQWtCO0FBRXZELFlBQUksZUFBZSwyQkFBMkIsUUFBUSxlQUFlLDJCQUEyQixPQUFPO0FBQ3RHLGlCQUFPLGtCQUFrQjtBQUFBLFFBQzFCLE9BQU87QUFDTixpQkFBTyxLQUFLLGtCQUFrQixZQUFZO0FBQUEsUUFDM0M7QUFBQSxNQUNEO0FBQ0EsVUFBSSxrQkFBa0IsU0FBUyxzQkFBc0IscUJBQXFCO0FBRXpFLFlBQUksZUFBZSwyQkFBMkIsUUFBUSxlQUFlLDJCQUEyQixPQUFPO0FBQ3RHLGlCQUFPLGtCQUFrQjtBQUFBLFFBQzFCLE9BQU87QUFDTixpQkFBTyxLQUFLLGtCQUFrQixjQUFjO0FBQUEsUUFDN0M7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQVEsT0FBTyxTQUFTLElBQUksT0FBTyxDQUFDLElBQUk7QUFBQSxFQUN6QztBQUNEO0FBM0RhLGdDQUFOO0FBQUEsRUFNSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FSVTtBQTZEYixNQUFNLG1DQUFtQyxRQUFRO0FBQUEsRUFFaEQsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sSUFBSSxVQUFVLHdCQUF3Qix3QkFBd0I7QUFBQSxNQUNyRSxVQUFVLFdBQVc7QUFBQSxNQUNyQixJQUFJO0FBQUEsSUFDTCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxJQUFJLFVBQTJDO0FBQ3BELFVBQU0sbUJBQW1CLFNBQVMsSUFBSSxpQkFBaUI7QUFFdkQsVUFBTSxVQUFVLE1BQU0saUJBQWlCLG1CQUFtQixJQUFJLFNBQVMsK0JBQStCLHFCQUFxQixDQUFDO0FBQzVILFFBQUksU0FBUztBQUNaLHVCQUFpQixvQkFBb0I7QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFDRDtBQUVBLGdCQUFnQiwwQkFBMEI7QUFFMUMsa0JBQWtCLG1CQUFtQix3QkFBd0Isa0JBQWtCLEtBQUs7IiwKICAibmFtZXMiOiBbIkxvY2FsV2ViV29ya2VyRXh0SG9zdEVuYWJsZW1lbnQiXQp9Cg==
