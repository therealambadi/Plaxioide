import { mark } from "../../base/common/performance.js";
import { domContentLoaded, detectFullscreen, getCookieValue, getWindow } from "../../base/browser/dom.js";
import { assertIsDefined } from "../../base/common/types.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { ILogService, ConsoleLogger, getLogLevel, ILoggerService } from "../../platform/log/common/log.js";
import { ConsoleLogInAutomationLogger } from "../../platform/log/browser/log.js";
import { Disposable, DisposableStore, toDisposable } from "../../base/common/lifecycle.js";
import { BrowserWorkbenchEnvironmentService, IBrowserWorkbenchEnvironmentService } from "../services/environment/browser/environmentService.js";
import { Workbench } from "./workbench.js";
import { RemoteFileSystemProviderClient } from "../services/remote/common/remoteFileSystemProviderClient.js";
import { IProductService } from "../../platform/product/common/productService.js";
import product from "../../platform/product/common/product.js";
import { RemoteAgentService } from "../services/remote/browser/remoteAgentService.js";
import { RemoteAuthorityResolverService } from "../../platform/remote/browser/remoteAuthorityResolverService.js";
import { IRemoteAuthorityResolverService, RemoteConnectionType } from "../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteAgentService } from "../services/remote/common/remoteAgentService.js";
import { IFileService } from "../../platform/files/common/files.js";
import { FileService } from "../../platform/files/common/fileService.js";
import { Schemas, connectionTokenCookieName } from "../../base/common/network.js";
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE, isTemporaryWorkspace, isWorkspaceIdentifier } from "../../platform/workspace/common/workspace.js";
import { IWorkbenchConfigurationService } from "../services/configuration/common/configuration.js";
import { onUnexpectedError } from "../../base/common/errors.js";
import { setFullscreen } from "../../base/browser/browser.js";
import { URI } from "../../base/common/uri.js";
import { WorkspaceService } from "../services/configuration/browser/configurationService.js";
import { ConfigurationCache } from "../services/configuration/common/configurationCache.js";
import { ISignService } from "../../platform/sign/common/sign.js";
import { SignService } from "../../platform/sign/browser/signService.js";
import { BrowserStorageService } from "../services/storage/browser/storageService.js";
import { IStorageService } from "../../platform/storage/common/storage.js";
import { toLocalISOString } from "../../base/common/date.js";
import { isWorkspaceToOpen, isFolderToOpen } from "../../platform/window/common/window.js";
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from "../services/workspaces/browser/workspaces.js";
import { InMemoryFileSystemProvider } from "../../platform/files/common/inMemoryFilesystemProvider.js";
import { ICommandService } from "../../platform/commands/common/commands.js";
import { IndexedDBFileSystemProvider } from "../../platform/files/browser/indexedDBFileSystemProvider.js";
import { BrowserRequestService } from "../services/request/browser/requestService.js";
import { IRequestService } from "../../platform/request/common/request.js";
import { IUserDataInitializationService, UserDataInitializationService } from "../services/userData/browser/userDataInit.js";
import { UserDataSyncStoreManagementService } from "../../platform/userDataSync/common/userDataSyncStoreService.js";
import { IUserDataSyncStoreManagementService } from "../../platform/userDataSync/common/userDataSync.js";
import { ILifecycleService } from "../services/lifecycle/common/lifecycle.js";
import { Action2, MenuId, registerAction2 } from "../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { localize, localize2 } from "../../nls.js";
import { Categories } from "../../platform/action/common/actionCommonCategories.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { IHostService } from "../services/host/browser/host.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../platform/uriIdentity/common/uriIdentityService.js";
import { BrowserWindow } from "./window.js";
import { ITimerService } from "../services/timer/browser/timerService.js";
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from "../services/workspaces/common/workspaceTrust.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../platform/workspace/common/workspaceTrust.js";
import { HTMLFileSystemProvider } from "../../platform/files/browser/htmlFileSystemProvider.js";
import { IOpenerService } from "../../platform/opener/common/opener.js";
import { mixin, safeStringify } from "../../base/common/objects.js";
import { IndexedDB } from "../../base/browser/indexedDB.js";
import { WebFileSystemAccess } from "../../platform/files/browser/webFileSystemAccess.js";
import { IProgressService } from "../../platform/progress/common/progress.js";
import { DelayedLogChannel } from "../services/output/common/delayedLogChannel.js";
import { dirname, joinPath } from "../../base/common/resources.js";
import { IUserDataProfilesService } from "../../platform/userDataProfile/common/userDataProfile.js";
import { NullPolicyService } from "../../platform/policy/common/policy.js";
import { IRemoteExplorerService } from "../services/remote/common/remoteExplorerService.js";
import { DisposableTunnel, TunnelProtocol } from "../../platform/tunnel/common/tunnel.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { UserDataProfileService } from "../services/userDataProfile/common/userDataProfileService.js";
import { IUserDataProfileService } from "../services/userDataProfile/common/userDataProfile.js";
import { BrowserUserDataProfilesService } from "../../platform/userDataProfile/browser/userDataProfile.js";
import { DeferredPromise, timeout } from "../../base/common/async.js";
import { windowLogGroup, windowLogId } from "../services/log/common/logConstants.js";
import { LogService } from "../../platform/log/common/logService.js";
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from "../../platform/remote/common/remoteSocketFactoryService.js";
import { BrowserSocketFactory } from "../../platform/remote/browser/browserSocketFactory.js";
import { VSBuffer } from "../../base/common/buffer.js";
import { UserDataProfileInitializer } from "../services/userDataProfile/browser/userDataProfileInit.js";
import { UserDataSyncInitializer } from "../services/userDataSync/browser/userDataSyncInit.js";
import { BrowserRemoteResourceLoader } from "../services/remote/browser/browserRemoteResourceHandler.js";
import { BufferLogger } from "../../platform/log/common/bufferLog.js";
import { FileLoggerService } from "../../platform/log/common/fileLog.js";
import { IEmbedderTerminalService } from "../services/terminal/common/embedderTerminalService.js";
import { BrowserSecretStorageService } from "../services/secrets/browser/secretStorageService.js";
import { EncryptionService } from "../services/encryption/browser/encryptionService.js";
import { IEncryptionService } from "../../platform/encryption/common/encryptionService.js";
import { ISecretStorageService } from "../../platform/secrets/common/secrets.js";
import { TunnelSource } from "../services/remote/common/tunnelModel.js";
import { mainWindow } from "../../base/browser/window.js";
import { INotificationService, Severity } from "../../platform/notification/common/notification.js";
class BrowserMain extends Disposable {
  constructor(domElement, configuration) {
    super();
    this.domElement = domElement;
    this.configuration = configuration;
    this.onWillShutdownDisposables = this._register(new DisposableStore());
    this.indexedDBFileSystemProviders = [];
    this.init();
  }
  init() {
    setFullscreen(!!detectFullscreen(mainWindow), mainWindow);
  }
  async open() {
    const [services] = await Promise.all([this.initServices(), domContentLoaded(getWindow(this.domElement))]);
    const workbench = new Workbench(this.domElement, void 0, services.serviceCollection, services.logService);
    this.registerListeners(workbench);
    const instantiationService = workbench.startup();
    this._register(instantiationService.createInstance(BrowserWindow));
    services.logService.trace("workbench#open with configuration", safeStringify(this.configuration));
    return instantiationService.invokeFunction((accessor) => {
      const commandService = accessor.get(ICommandService);
      const lifecycleService = accessor.get(ILifecycleService);
      const timerService = accessor.get(ITimerService);
      const openerService = accessor.get(IOpenerService);
      const productService = accessor.get(IProductService);
      const progressService = accessor.get(IProgressService);
      const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
      const instantiationService2 = accessor.get(IInstantiationService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const labelService = accessor.get(ILabelService);
      const embedderTerminalService = accessor.get(IEmbedderTerminalService);
      const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
      const notificationService = accessor.get(INotificationService);
      async function showMessage(severity, message, ...items) {
        const choice = new DeferredPromise();
        const handle = notificationService.prompt(severity, message, items.map((item) => ({
          label: item,
          run: () => choice.complete(item)
        })));
        const disposable = handle.onDidClose(() => {
          choice.complete(void 0);
          disposable.dispose();
        });
        const result = await choice.p;
        handle.close();
        return result;
      }
      let logger = void 0;
      return {
        commands: {
          executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
        },
        env: {
          async getUriScheme() {
            return productService.urlProtocol;
          },
          async retrievePerformanceMarks() {
            await timerService.whenReady();
            return timerService.getPerformanceMarks();
          },
          async openUri(uri) {
            return openerService.open(uri, {});
          }
        },
        logger: {
          log: (level, message) => {
            if (!logger) {
              logger = instantiationService2.createInstance(DelayedLogChannel, "webEmbedder", productService.embedderIdentifier || productService.nameShort, joinPath(dirname(environmentService.logFile), "webEmbedder.log"));
            }
            logger.log(level, message);
          }
        },
        window: {
          withProgress: (options, task) => progressService.withProgress(options, task),
          createTerminal: async (options) => embedderTerminalService.createTerminal(options),
          showInformationMessage: (message, ...items) => showMessage(Severity.Info, message, ...items)
        },
        workspace: {
          didResolveRemoteAuthority: async () => {
            if (!this.configuration.remoteAuthority) {
              return;
            }
            await remoteAuthorityResolverService.resolveAuthority(this.configuration.remoteAuthority);
          },
          openTunnel: async (tunnelOptions) => {
            const tunnel = assertIsDefined(await remoteExplorerService.forward({
              remote: tunnelOptions.remoteAddress,
              local: tunnelOptions.localAddressPort,
              name: tunnelOptions.label,
              source: {
                source: TunnelSource.Extension,
                description: labelService.getHostLabel(Schemas.vscodeRemote, this.configuration.remoteAuthority)
              },
              elevateIfNeeded: false,
              privacy: tunnelOptions.privacy
            }, {
              label: tunnelOptions.label,
              elevateIfNeeded: void 0,
              onAutoForward: void 0,
              requireLocalPort: void 0,
              protocol: tunnelOptions.protocol === TunnelProtocol.Https ? tunnelOptions.protocol : TunnelProtocol.Http
            }));
            if (typeof tunnel === "string") {
              throw new Error(tunnel);
            }
            return new class extends DisposableTunnel {
            }({
              port: tunnel.tunnelRemotePort,
              host: tunnel.tunnelRemoteHost
            }, tunnel.localAddress, () => tunnel.dispose());
          }
        },
        shutdown: () => lifecycleService.shutdown()
      };
    });
  }
  registerListeners(workbench) {
    this._register(workbench.onWillShutdown(() => this.onWillShutdownDisposables.clear()));
    this._register(workbench.onDidShutdown(() => this.dispose()));
  }
  async initServices() {
    const serviceCollection = new ServiceCollection();
    const workspace = this.resolveWorkspace();
    const productService = mixin({ _serviceBrand: void 0, ...product }, this.configuration.productConfiguration);
    serviceCollection.set(IProductService, productService);
    const logsPath = URI.file(toLocalISOString(/* @__PURE__ */ new Date()).replace(/-|:|\.\d+Z$/g, "")).with({ scheme: "vscode-log" });
    const environmentService = new BrowserWorkbenchEnvironmentService(workspace.id, logsPath, this.configuration, productService);
    serviceCollection.set(IBrowserWorkbenchEnvironmentService, environmentService);
    const fileLogger = new BufferLogger();
    const fileService = this._register(new FileService(fileLogger));
    serviceCollection.set(IFileService, fileService);
    const loggerService = new FileLoggerService(getLogLevel(environmentService), logsPath, fileService);
    serviceCollection.set(ILoggerService, loggerService);
    const otherLoggers = [new ConsoleLogger(loggerService.getLogLevel())];
    if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
      otherLoggers.push(new ConsoleLogInAutomationLogger(loggerService.getLogLevel()));
    }
    const logger = loggerService.createLogger(environmentService.logFile, { id: windowLogId, name: windowLogGroup.name, group: windowLogGroup });
    const logService = new LogService(logger, otherLoggers);
    serviceCollection.set(ILogService, logService);
    fileLogger.logger = logService;
    await this.registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath);
    const connectionToken = environmentService.options.connectionToken || getCookieValue(connectionTokenCookieName);
    const remoteResourceLoader = this.configuration.remoteResourceProvider ? new BrowserRemoteResourceLoader(fileService, this.configuration.remoteResourceProvider) : void 0;
    const resourceUriProvider = this.configuration.resourceUriProvider ?? remoteResourceLoader?.getResourceUriProvider();
    const remoteAuthorityResolverService = new RemoteAuthorityResolverService(!environmentService.expectsResolverExtension, connectionToken, resourceUriProvider, this.configuration.serverBasePath, productService, logService);
    serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);
    const signService = new SignService(productService);
    serviceCollection.set(ISignService, signService);
    const uriIdentityService = new UriIdentityService(fileService);
    serviceCollection.set(IUriIdentityService, uriIdentityService);
    const userDataProfilesService = new BrowserUserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
    serviceCollection.set(IUserDataProfilesService, userDataProfilesService);
    const currentProfile = await this.getCurrentProfile(workspace, userDataProfilesService, environmentService);
    await userDataProfilesService.setProfileForWorkspace(workspace, currentProfile);
    const userDataProfileService = new UserDataProfileService(currentProfile);
    serviceCollection.set(IUserDataProfileService, userDataProfileService);
    const remoteSocketFactoryService = new RemoteSocketFactoryService();
    remoteSocketFactoryService.register(RemoteConnectionType.WebSocket, new BrowserSocketFactory(this.configuration.webSocketFactory));
    serviceCollection.set(IRemoteSocketFactoryService, remoteSocketFactoryService);
    const remoteAgentService = this._register(new RemoteAgentService(remoteSocketFactoryService, userDataProfileService, environmentService, productService, remoteAuthorityResolverService, signService, logService));
    serviceCollection.set(IRemoteAgentService, remoteAgentService);
    this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));
    const [configurationService, storageService] = await Promise.all([
      this.createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService).then((service) => {
        serviceCollection.set(IWorkspaceContextService, service);
        serviceCollection.set(IWorkbenchConfigurationService, service);
        return service;
      }),
      this.createStorageService(workspace, logService, userDataProfileService).then((service) => {
        serviceCollection.set(IStorageService, service);
        return service;
      })
    ]);
    const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
    serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);
    const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, configurationService, workspaceTrustEnablementService, fileService);
    serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);
    configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
    this._register(workspaceTrustManagementService.onDidChangeTrust(() => configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted())));
    const requestService = new BrowserRequestService(remoteAgentService, configurationService, loggerService);
    serviceCollection.set(IRequestService, requestService);
    const userDataSyncStoreManagementService = new UserDataSyncStoreManagementService(productService, configurationService, storageService);
    serviceCollection.set(IUserDataSyncStoreManagementService, userDataSyncStoreManagementService);
    const encryptionService = new EncryptionService();
    serviceCollection.set(IEncryptionService, encryptionService);
    const secretStorageService = new BrowserSecretStorageService(storageService, encryptionService, environmentService, logService);
    serviceCollection.set(ISecretStorageService, secretStorageService);
    const userDataInitializers = [];
    userDataInitializers.push(new UserDataSyncInitializer(environmentService, secretStorageService, userDataSyncStoreManagementService, fileService, userDataProfilesService, storageService, productService, requestService, logService, uriIdentityService));
    if (environmentService.options.profile) {
      userDataInitializers.push(new UserDataProfileInitializer(environmentService, fileService, userDataProfileService, storageService, logService, uriIdentityService, requestService));
    }
    const userDataInitializationService = new UserDataInitializationService(userDataInitializers);
    serviceCollection.set(IUserDataInitializationService, userDataInitializationService);
    try {
      await Promise.race(
        [
          // Do not block more than 5s
          timeout(5e3),
          this.initializeUserData(userDataInitializationService, configurationService)
        ]
      );
    } catch (error) {
      logService.error(error);
    }
    return { serviceCollection, configurationService, logService };
  }
  async initializeUserData(userDataInitializationService, configurationService) {
    if (await userDataInitializationService.requiresInitialization()) {
      mark("code/willInitRequiredUserData");
      await userDataInitializationService.initializeRequiredResources();
      await configurationService.reloadLocalUserConfiguration();
      mark("code/didInitRequiredUserData");
    }
  }
  async registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath) {
    let indexedDB;
    const userDataStore = "vscode-userdata-store";
    const logsStore = "vscode-logs-store";
    const handlesStore = "vscode-filehandles-store";
    try {
      indexedDB = await IndexedDB.create("vscode-web-db", 3, [userDataStore, logsStore, handlesStore]);
      this.onWillShutdownDisposables.add(toDisposable(() => indexedDB?.close()));
    } catch (error) {
      logService.error("Error while creating IndexedDB", error);
    }
    if (indexedDB) {
      const logFileSystemProvider = new IndexedDBFileSystemProvider(logsPath.scheme, indexedDB, logsStore, false);
      this.indexedDBFileSystemProviders.push(logFileSystemProvider);
      fileService.registerProvider(logsPath.scheme, logFileSystemProvider);
    } else {
      fileService.registerProvider(logsPath.scheme, new InMemoryFileSystemProvider());
    }
    let userDataProvider;
    if (indexedDB) {
      userDataProvider = new IndexedDBFileSystemProvider(Schemas.vscodeUserData, indexedDB, userDataStore, true);
      this.indexedDBFileSystemProviders.push(userDataProvider);
      this.registerDeveloperActions(userDataProvider);
    } else {
      logService.info("Using in-memory user data provider");
      userDataProvider = new InMemoryFileSystemProvider();
    }
    fileService.registerProvider(Schemas.vscodeUserData, userDataProvider);
    if (WebFileSystemAccess.supported(mainWindow)) {
      fileService.registerProvider(Schemas.file, new HTMLFileSystemProvider(indexedDB, handlesStore, logService));
    }
    fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());
  }
  registerDeveloperActions(provider) {
    this._register(registerAction2(class ResetUserDataAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.resetUserData",
          title: localize2("reset", "Reset User Data"),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          }
        });
      }
      async run(accessor) {
        const dialogService = accessor.get(IDialogService);
        const hostService = accessor.get(IHostService);
        const storageService = accessor.get(IStorageService);
        const logService = accessor.get(ILogService);
        const result = await dialogService.confirm({
          message: localize("reset user data message", "Would you like to reset your data (settings, keybindings, extensions, snippets and UI State) and reload?")
        });
        if (result.confirmed) {
          try {
            await provider?.reset();
            if (storageService instanceof BrowserStorageService) {
              await storageService.clear();
            }
          } catch (error) {
            logService.error(error);
            throw error;
          }
        }
        hostService.reload();
      }
    }));
  }
  async createStorageService(workspace, logService, userDataProfileService) {
    const storageService = new BrowserStorageService(workspace, userDataProfileService, logService);
    try {
      await storageService.initialize();
      this.onWillShutdownDisposables.add(toDisposable(() => storageService.close()));
      return storageService;
    } catch (error) {
      onUnexpectedError(error);
      logService.error(error);
      return storageService;
    }
  }
  async createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService) {
    if (isWorkspaceIdentifier(workspace) && isTemporaryWorkspace(workspace.configPath)) {
      try {
        const emptyWorkspace = { folders: [] };
        await fileService.createFile(workspace.configPath, VSBuffer.fromString(JSON.stringify(emptyWorkspace, null, "	")), { overwrite: false });
      } catch (error) {
      }
    }
    const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData, Schemas.tmp], environmentService, fileService);
    const workspaceService = new WorkspaceService({ remoteAuthority: this.configuration.remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, new NullPolicyService());
    try {
      await workspaceService.initialize(workspace);
      return workspaceService;
    } catch (error) {
      onUnexpectedError(error);
      logService.error(error);
      return workspaceService;
    }
  }
  async getCurrentProfile(workspace, userDataProfilesService, environmentService) {
    const profileName = environmentService.options?.profile?.name ?? environmentService.profile;
    if (profileName) {
      const profile = userDataProfilesService.profiles.find((p) => p.name === profileName);
      if (profile) {
        return profile;
      }
      return userDataProfilesService.createNamedProfile(profileName, void 0, workspace);
    }
    return userDataProfilesService.getProfileForWorkspace(workspace) ?? userDataProfilesService.defaultProfile;
  }
  resolveWorkspace() {
    let workspace = void 0;
    if (this.configuration.workspaceProvider) {
      workspace = this.configuration.workspaceProvider.workspace;
    }
    if (workspace && isWorkspaceToOpen(workspace)) {
      return getWorkspaceIdentifier(workspace.workspaceUri);
    }
    if (workspace && isFolderToOpen(workspace)) {
      return getSingleFolderWorkspaceIdentifier(workspace.folderUri);
    }
    return UNKNOWN_EMPTY_WINDOW_WORKSPACE;
  }
}
export {
  BrowserMain
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci93ZWIubWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBkb21Db250ZW50TG9hZGVkLCBkZXRlY3RGdWxsc2NyZWVuLCBnZXRDb29raWVWYWx1ZSwgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBDb25zb2xlTG9nZ2VyLCBnZXRMb2dMZXZlbCwgSUxvZ2dlclNlcnZpY2UsIElMb2dnZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDb25zb2xlTG9nSW5BdXRvbWF0aW9uTG9nZ2VyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2Jyb3dzZXIvbG9nLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoIH0gZnJvbSAnLi93b3JrYmVuY2guanMnO1xuaW1wb3J0IHsgUmVtb3RlRmlsZVN5c3RlbVByb3ZpZGVyQ2xpZW50IH0gZnJvbSAnLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVGaWxlU3lzdGVtUHJvdmlkZXJDbGllbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9yZW1vdGUvYnJvd3Nlci9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2Jyb3dzZXIvcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsIFJlbW90ZUNvbm5lY3Rpb25UeXBlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMsIGNvbm5lY3Rpb25Ub2tlbkNvb2tpZU5hbWUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFVOS05PV05fRU1QVFlfV0lORE9XX1dPUktTUEFDRSwgaXNUZW1wb3JhcnlXb3Jrc3BhY2UsIGlzV29ya3NwYWNlSWRlbnRpZmllciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgc2V0RnVsbHNjcmVlbiB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9icm93c2VyL2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DYWNoZSB9IGZyb20gJy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25DYWNoZS5qcyc7XG5pbXBvcnQgeyBJU2lnblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zaWduL2NvbW1vbi9zaWduLmpzJztcbmltcG9ydCB7IFNpZ25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vc2lnbi9icm93c2VyL3NpZ25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb25zdHJ1Y3Rpb25PcHRpb25zLCBJV29ya2JlbmNoLCBJV29ya3NwYWNlLCBJVHVubmVsIH0gZnJvbSAnLi93ZWIuYXBpLmpzJztcbmltcG9ydCB7IEJyb3dzZXJTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3N0b3JhZ2UvYnJvd3Nlci9zdG9yYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IHRvTG9jYWxJU09TdHJpbmcgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9kYXRlLmpzJztcbmltcG9ydCB7IGlzV29ya3NwYWNlVG9PcGVuLCBpc0ZvbGRlclRvT3BlbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IGdldFNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIGdldFdvcmtzcGFjZUlkZW50aWZpZXIgfSBmcm9tICcuLi9zZXJ2aWNlcy93b3Jrc3BhY2VzL2Jyb3dzZXIvd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvYnJvd3Nlci9pbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgQnJvd3NlclJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvcmVxdWVzdC9icm93c2VyL3JlcXVlc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLCBJVXNlckRhdGFJbml0aWFsaXplciwgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy91c2VyRGF0YS9icm93c2VyL3VzZXJEYXRhSW5pdC5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEJyb3dzZXJXaW5kb3cgfSBmcm9tICcuL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJVGltZXJTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvdGltZXIvYnJvd3Nlci90aW1lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSwgV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZVRydXN0LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLCBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgSFRNTEZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2Jyb3dzZXIvaHRtbEZpbGVTeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IG1peGluLCBzYWZlU3RyaW5naWZ5IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBJbmRleGVkREIgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvaW5kZXhlZERCLmpzJztcbmltcG9ydCB7IFdlYkZpbGVTeXN0ZW1BY2Nlc3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9maWxlcy9icm93c2VyL3dlYkZpbGVTeXN0ZW1BY2Nlc3MuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBEZWxheWVkTG9nQ2hhbm5lbCB9IGZyb20gJy4uL3NlcnZpY2VzL291dHB1dC9jb21tb24vZGVsYXllZExvZ0NoYW5uZWwuanMnO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pblBhdGggfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgTnVsbFBvbGljeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wb2xpY3kvY29tbW9uL3BvbGljeS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHBsb3JlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVR1bm5lbCwgVHVubmVsUHJvdG9jb2wgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBCcm93c2VyVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgd2luZG93TG9nR3JvdXAsIHdpbmRvd0xvZ0lkIH0gZnJvbSAnLi4vc2VydmljZXMvbG9nL2NvbW1vbi9sb2dDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsIFJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBCcm93c2VyU29ja2V0RmFjdG9yeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9icm93c2VyL2Jyb3dzZXJTb2NrZXRGYWN0b3J5LmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElTdG9yZWRXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhUHJvZmlsZUluaXRpYWxpemVyIH0gZnJvbSAnLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvdXNlckRhdGFQcm9maWxlSW5pdC5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNJbml0aWFsaXplciB9IGZyb20gJy4uL3NlcnZpY2VzL3VzZXJEYXRhU3luYy9icm93c2VyL3VzZXJEYXRhU3luY0luaXQuanMnO1xuaW1wb3J0IHsgQnJvd3NlclJlbW90ZVJlc291cmNlTG9hZGVyIH0gZnJvbSAnLi4vc2VydmljZXMvcmVtb3RlL2Jyb3dzZXIvYnJvd3NlclJlbW90ZVJlc291cmNlSGFuZGxlci5qcyc7XG5pbXBvcnQgeyBCdWZmZXJMb2dnZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2J1ZmZlckxvZy5qcyc7XG5pbXBvcnQgeyBGaWxlTG9nZ2VyU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vZmlsZUxvZy5qcyc7XG5pbXBvcnQgeyBJRW1iZWRkZXJUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy90ZXJtaW5hbC9jb21tb24vZW1iZWRkZXJUZXJtaW5hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJvd3NlclNlY3JldFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvc2VjcmV0cy9icm93c2VyL3NlY3JldFN0b3JhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVuY3J5cHRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZW5jcnlwdGlvbi9icm93c2VyL2VuY3J5cHRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbmNyeXB0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2VuY3J5cHRpb24vY29tbW9uL2VuY3J5cHRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTZWNyZXRTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvY29tbW9uL3NlY3JldHMuanMnO1xuaW1wb3J0IHsgVHVubmVsU291cmNlIH0gZnJvbSAnLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi90dW5uZWxNb2RlbC5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyTWFpbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgb25XaWxsU2h1dGRvd25EaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyczogSW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRvbUVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvbjogSVdvcmtiZW5jaENvbnN0cnVjdGlvbk9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0KCk6IHZvaWQge1xuXG5cdFx0Ly8gQnJvd3NlciBjb25maWdcblx0XHRzZXRGdWxsc2NyZWVuKCEhZGV0ZWN0RnVsbHNjcmVlbihtYWluV2luZG93KSwgbWFpbldpbmRvdyk7XG5cdH1cblxuXHRhc3luYyBvcGVuKCk6IFByb21pc2U8SVdvcmtiZW5jaD4ge1xuXG5cdFx0Ly8gSW5pdCBzZXJ2aWNlcyBhbmQgd2FpdCBmb3IgRE9NIHRvIGJlIHJlYWR5IGluIHBhcmFsbGVsXG5cdFx0Y29uc3QgW3NlcnZpY2VzXSA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLmluaXRTZXJ2aWNlcygpLCBkb21Db250ZW50TG9hZGVkKGdldFdpbmRvdyh0aGlzLmRvbUVsZW1lbnQpKV0pO1xuXG5cdFx0Ly8gQ3JlYXRlIFdvcmtiZW5jaFxuXHRcdGNvbnN0IHdvcmtiZW5jaCA9IG5ldyBXb3JrYmVuY2godGhpcy5kb21FbGVtZW50LCB1bmRlZmluZWQsIHNlcnZpY2VzLnNlcnZpY2VDb2xsZWN0aW9uLCBzZXJ2aWNlcy5sb2dTZXJ2aWNlKTtcblxuXHRcdC8vIExpc3RlbmVyc1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMod29ya2JlbmNoKTtcblxuXHRcdC8vIFN0YXJ0dXBcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaC5zdGFydHVwKCk7XG5cblx0XHQvLyBXaW5kb3dcblx0XHR0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcm93c2VyV2luZG93KSk7XG5cblx0XHQvLyBMb2dnaW5nXG5cdFx0c2VydmljZXMubG9nU2VydmljZS50cmFjZSgnd29ya2JlbmNoI29wZW4gd2l0aCBjb25maWd1cmF0aW9uJywgc2FmZVN0cmluZ2lmeSh0aGlzLmNvbmZpZ3VyYXRpb24pKTtcblxuXHRcdC8vIFJldHVybiBBUEkgRmFjYWRlXG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRjb25zdCBsaWZlY3ljbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaWZlY3ljbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRpbWVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGltZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG9wZW5lclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcHJvZHVjdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHByb2dyZXNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJvZ3Jlc3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSk7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVFeHBsb3JlclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZW1iZWRkZXJUZXJtaW5hbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVtYmVkZGVyVGVybWluYWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRhc3luYyBmdW5jdGlvbiBzaG93TWVzc2FnZTxUIGV4dGVuZHMgc3RyaW5nPihzZXZlcml0eTogU2V2ZXJpdHksIG1lc3NhZ2U6IHN0cmluZywgLi4uaXRlbXM6IFRbXSk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0XHRjb25zdCBjaG9pY2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPFQgfCB1bmRlZmluZWQ+KCk7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZSA9IG5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KHNldmVyaXR5LCBtZXNzYWdlLCBpdGVtcy5tYXAoaXRlbSA9PiAoe1xuXHRcdFx0XHRcdGxhYmVsOiBpdGVtLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gY2hvaWNlLmNvbXBsZXRlKGl0ZW0pXG5cdFx0XHRcdH0pKSk7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBoYW5kbGUub25EaWRDbG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0Y2hvaWNlLmNvbXBsZXRlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBjaG9pY2UucDtcblx0XHRcdFx0aGFuZGxlLmNsb3NlKCk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBsb2dnZXI6IERlbGF5ZWRMb2dDaGFubmVsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb21tYW5kczoge1xuXHRcdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiAoY29tbWFuZCwgLi4uYXJncykgPT4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZCwgLi4uYXJncylcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW52OiB7XG5cdFx0XHRcdFx0YXN5bmMgZ2V0VXJpU2NoZW1lKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvZHVjdFNlcnZpY2UudXJsUHJvdG9jb2w7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhc3luYyByZXRyaWV2ZVBlcmZvcm1hbmNlTWFya3MoKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lclNlcnZpY2Uud2hlblJlYWR5KCk7XG5cblx0XHRcdFx0XHRcdHJldHVybiB0aW1lclNlcnZpY2UuZ2V0UGVyZm9ybWFuY2VNYXJrcygpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YXN5bmMgb3BlblVyaSh1cmk6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG9wZW5lclNlcnZpY2Uub3Blbih1cmksIHt9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxvZ2dlcjoge1xuXHRcdFx0XHRcdGxvZzogKGxldmVsLCBtZXNzYWdlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIWxvZ2dlcikge1xuXHRcdFx0XHRcdFx0XHRsb2dnZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWxheWVkTG9nQ2hhbm5lbCwgJ3dlYkVtYmVkZGVyJywgcHJvZHVjdFNlcnZpY2UuZW1iZWRkZXJJZGVudGlmaWVyIHx8IHByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCwgam9pblBhdGgoZGlybmFtZShlbnZpcm9ubWVudFNlcnZpY2UubG9nRmlsZSksICd3ZWJFbWJlZGRlci5sb2cnKSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGxvZ2dlci5sb2cobGV2ZWwsIG1lc3NhZ2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0d2luZG93OiB7XG5cdFx0XHRcdFx0d2l0aFByb2dyZXNzOiAob3B0aW9ucywgdGFzaykgPT4gcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyhvcHRpb25zLCB0YXNrKSxcblx0XHRcdFx0XHRjcmVhdGVUZXJtaW5hbDogYXN5bmMgKG9wdGlvbnMpID0+IGVtYmVkZGVyVGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKG9wdGlvbnMpLFxuXHRcdFx0XHRcdHNob3dJbmZvcm1hdGlvbk1lc3NhZ2U6IChtZXNzYWdlLCAuLi5pdGVtcykgPT4gc2hvd01lc3NhZ2UoU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSwgLi4uaXRlbXMpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3b3Jrc3BhY2U6IHtcblx0XHRcdFx0XHRkaWRSZXNvbHZlUmVtb3RlQXV0aG9yaXR5OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMuY29uZmlndXJhdGlvbi5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRhd2FpdCByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UucmVzb2x2ZUF1dGhvcml0eSh0aGlzLmNvbmZpZ3VyYXRpb24ucmVtb3RlQXV0aG9yaXR5KTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG9wZW5UdW5uZWw6IGFzeW5jIHR1bm5lbE9wdGlvbnMgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgdHVubmVsID0gYXNzZXJ0SXNEZWZpbmVkKGF3YWl0IHJlbW90ZUV4cGxvcmVyU2VydmljZS5mb3J3YXJkKHtcblx0XHRcdFx0XHRcdFx0cmVtb3RlOiB0dW5uZWxPcHRpb25zLnJlbW90ZUFkZHJlc3MsXG5cdFx0XHRcdFx0XHRcdGxvY2FsOiB0dW5uZWxPcHRpb25zLmxvY2FsQWRkcmVzc1BvcnQsXG5cdFx0XHRcdFx0XHRcdG5hbWU6IHR1bm5lbE9wdGlvbnMubGFiZWwsXG5cdFx0XHRcdFx0XHRcdHNvdXJjZToge1xuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZTogVHVubmVsU291cmNlLkV4dGVuc2lvbixcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbGFiZWxTZXJ2aWNlLmdldEhvc3RMYWJlbChTY2hlbWFzLnZzY29kZVJlbW90ZSwgdGhpcy5jb25maWd1cmF0aW9uLnJlbW90ZUF1dGhvcml0eSlcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZWxldmF0ZUlmTmVlZGVkOiBmYWxzZSxcblx0XHRcdFx0XHRcdFx0cHJpdmFjeTogdHVubmVsT3B0aW9ucy5wcml2YWN5XG5cdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiB0dW5uZWxPcHRpb25zLmxhYmVsLFxuXHRcdFx0XHRcdFx0XHRlbGV2YXRlSWZOZWVkZWQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0b25BdXRvRm9yd2FyZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRyZXF1aXJlTG9jYWxQb3J0OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHByb3RvY29sOiB0dW5uZWxPcHRpb25zLnByb3RvY29sID09PSBUdW5uZWxQcm90b2NvbC5IdHRwcyA/IHR1bm5lbE9wdGlvbnMucHJvdG9jb2wgOiBUdW5uZWxQcm90b2NvbC5IdHRwXG5cdFx0XHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgdHVubmVsID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IodHVubmVsKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBjbGFzcyBleHRlbmRzIERpc3Bvc2FibGVUdW5uZWwgaW1wbGVtZW50cyBJVHVubmVsIHtcblx0XHRcdFx0XHRcdFx0ZGVjbGFyZSBsb2NhbEFkZHJlc3M6IHN0cmluZztcblx0XHRcdFx0XHRcdH0oe1xuXHRcdFx0XHRcdFx0XHRwb3J0OiB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCxcblx0XHRcdFx0XHRcdFx0aG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3Rcblx0XHRcdFx0XHRcdH0sIHR1bm5lbC5sb2NhbEFkZHJlc3MsICgpID0+IHR1bm5lbC5kaXNwb3NlKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0c2h1dGRvd246ICgpID0+IGxpZmVjeWNsZVNlcnZpY2Uuc2h1dGRvd24oKVxuXHRcdFx0fSBzYXRpc2ZpZXMgSVdvcmtiZW5jaDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMod29ya2JlbmNoOiBXb3JrYmVuY2gpOiB2b2lkIHtcblxuXHRcdC8vIFdvcmtiZW5jaCBMaWZlY3ljbGVcblx0XHR0aGlzLl9yZWdpc3Rlcih3b3JrYmVuY2gub25XaWxsU2h1dGRvd24oKCkgPT4gdGhpcy5vbldpbGxTaHV0ZG93bkRpc3Bvc2FibGVzLmNsZWFyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih3b3JrYmVuY2gub25EaWRTaHV0ZG93bigoKSA9PiB0aGlzLmRpc3Bvc2UoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0U2VydmljZXMoKTogUHJvbWlzZTx7IHNlcnZpY2VDb2xsZWN0aW9uOiBTZXJ2aWNlQ29sbGVjdGlvbjsgY29uZmlndXJhdGlvblNlcnZpY2U6IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZTsgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UgfT4ge1xuXHRcdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKCk7XG5cblxuXHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblx0XHQvL1xuXHRcdC8vIE5PVEU6IFBsZWFzZSBkbyBOT1QgcmVnaXN0ZXIgc2VydmljZXMgaGVyZS4gVXNlIGByZWdpc3RlclNpbmdsZXRvbigpYFxuXHRcdC8vICAgICAgIGZyb20gYHdvcmtiZW5jaC5jb21tb24ubWFpbi50c2AgaWYgdGhlIHNlcnZpY2UgaXMgc2hhcmVkIGJldHdlZW5cblx0XHQvLyAgICAgICBkZXNrdG9wIGFuZCB3ZWIgb3IgYHdvcmtiZW5jaC53ZWIubWFpbi50c2AgaWYgdGhlIHNlcnZpY2Vcblx0XHQvLyAgICAgICBpcyB3ZWIgb25seS5cblx0XHQvL1xuXHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy5yZXNvbHZlV29ya3NwYWNlKCk7XG5cblx0XHQvLyBQcm9kdWN0XG5cdFx0Y29uc3QgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSA9IG1peGluKHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCAuLi5wcm9kdWN0IH0sIHRoaXMuY29uZmlndXJhdGlvbi5wcm9kdWN0Q29uZmlndXJhdGlvbik7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElQcm9kdWN0U2VydmljZSwgcHJvZHVjdFNlcnZpY2UpO1xuXG5cdFx0Ly8gRW52aXJvbm1lbnRcblx0XHRjb25zdCBsb2dzUGF0aCA9IFVSSS5maWxlKHRvTG9jYWxJU09TdHJpbmcobmV3IERhdGUoKSkucmVwbGFjZSgvLXw6fFxcLlxcZCtaJC9nLCAnJykpLndpdGgoeyBzY2hlbWU6ICd2c2NvZGUtbG9nJyB9KTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBuZXcgQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSh3b3Jrc3BhY2UuaWQsIGxvZ3NQYXRoLCB0aGlzLmNvbmZpZ3VyYXRpb24sIHByb2R1Y3RTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHQvLyBGaWxlc1xuXHRcdGNvbnN0IGZpbGVMb2dnZXIgPSBuZXcgQnVmZmVyTG9nZ2VyKCk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRmlsZVNlcnZpY2UoZmlsZUxvZ2dlcikpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJRmlsZVNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblxuXHRcdC8vIExvZ2dlclxuXHRcdGNvbnN0IGxvZ2dlclNlcnZpY2UgPSBuZXcgRmlsZUxvZ2dlclNlcnZpY2UoZ2V0TG9nTGV2ZWwoZW52aXJvbm1lbnRTZXJ2aWNlKSwgbG9nc1BhdGgsIGZpbGVTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSUxvZ2dlclNlcnZpY2UsIGxvZ2dlclNlcnZpY2UpO1xuXG5cdFx0Ly8gTG9nIFNlcnZpY2Vcblx0XHRjb25zdCBvdGhlckxvZ2dlcnM6IElMb2dnZXJbXSA9IFtuZXcgQ29uc29sZUxvZ2dlcihsb2dnZXJTZXJ2aWNlLmdldExvZ0xldmVsKCkpXTtcblx0XHRpZiAoZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQgJiYgISFlbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSkge1xuXHRcdFx0b3RoZXJMb2dnZXJzLnB1c2gobmV3IENvbnNvbGVMb2dJbkF1dG9tYXRpb25Mb2dnZXIobG9nZ2VyU2VydmljZS5nZXRMb2dMZXZlbCgpKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGxvZ2dlciA9IGxvZ2dlclNlcnZpY2UuY3JlYXRlTG9nZ2VyKGVudmlyb25tZW50U2VydmljZS5sb2dGaWxlLCB7IGlkOiB3aW5kb3dMb2dJZCwgbmFtZTogd2luZG93TG9nR3JvdXAubmFtZSwgZ3JvdXA6IHdpbmRvd0xvZ0dyb3VwIH0pO1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBuZXcgTG9nU2VydmljZShsb2dnZXIsIG90aGVyTG9nZ2Vycyk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElMb2dTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblxuXHRcdC8vIFNldCB0aGUgbG9nZ2VyIG9mIHRoZSBmaWxlTG9nZ2VyIGFmdGVyIHRoZSBsb2cgc2VydmljZSBpcyByZWFkeS5cblx0XHQvLyBUaGlzIGlzIHRvIGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmN5XG5cdFx0ZmlsZUxvZ2dlci5sb2dnZXIgPSBsb2dTZXJ2aWNlO1xuXG5cdFx0Ly8gUmVnaXN0ZXIgRmlsZSBTeXN0ZW0gUHJvdmlkZXJzIGRlcGVuZGluZyBvbiBJbmRleGVkREIgc3VwcG9ydFxuXHRcdC8vIFJlZ2lzdGVyIHRoZW0gZWFybHkgYmVjYXVzZSB0aGV5IGFyZSBuZWVkZWQgZm9yIHRoZSBwcm9maWxlcyBpbml0aWFsaXphdGlvblxuXHRcdGF3YWl0IHRoaXMucmVnaXN0ZXJJbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXJzKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIGxvZ1NlcnZpY2UsIGxvZ2dlclNlcnZpY2UsIGxvZ3NQYXRoKTtcblxuXG5cdFx0Y29uc3QgY29ubmVjdGlvblRva2VuID0gZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMuY29ubmVjdGlvblRva2VuIHx8IGdldENvb2tpZVZhbHVlKGNvbm5lY3Rpb25Ub2tlbkNvb2tpZU5hbWUpO1xuXHRcdGNvbnN0IHJlbW90ZVJlc291cmNlTG9hZGVyID0gdGhpcy5jb25maWd1cmF0aW9uLnJlbW90ZVJlc291cmNlUHJvdmlkZXIgPyBuZXcgQnJvd3NlclJlbW90ZVJlc291cmNlTG9hZGVyKGZpbGVTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb24ucmVtb3RlUmVzb3VyY2VQcm92aWRlcikgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVzb3VyY2VVcmlQcm92aWRlciA9IHRoaXMuY29uZmlndXJhdGlvbi5yZXNvdXJjZVVyaVByb3ZpZGVyID8/IHJlbW90ZVJlc291cmNlTG9hZGVyPy5nZXRSZXNvdXJjZVVyaVByb3ZpZGVyKCk7XG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlID0gbmV3IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSghZW52aXJvbm1lbnRTZXJ2aWNlLmV4cGVjdHNSZXNvbHZlckV4dGVuc2lvbiwgY29ubmVjdGlvblRva2VuLCByZXNvdXJjZVVyaVByb3ZpZGVyLCB0aGlzLmNvbmZpZ3VyYXRpb24uc2VydmVyQmFzZVBhdGgsIHByb2R1Y3RTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSwgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlKTtcblxuXHRcdC8vIFNpZ25pbmdcblx0XHRjb25zdCBzaWduU2VydmljZSA9IG5ldyBTaWduU2VydmljZShwcm9kdWN0U2VydmljZSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElTaWduU2VydmljZSwgc2lnblNlcnZpY2UpO1xuXG5cblx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0Ly9cblx0XHQvLyBOT1RFOiBQbGVhc2UgZG8gTk9UIHJlZ2lzdGVyIHNlcnZpY2VzIGhlcmUuIFVzZSBgcmVnaXN0ZXJTaW5nbGV0b24oKWBcblx0XHQvLyAgICAgICBmcm9tIGB3b3JrYmVuY2guY29tbW9uLm1haW4udHNgIGlmIHRoZSBzZXJ2aWNlIGlzIHNoYXJlZCBiZXR3ZWVuXG5cdFx0Ly8gICAgICAgZGVza3RvcCBhbmQgd2ViIG9yIGB3b3JrYmVuY2gud2ViLm1haW4udHNgIGlmIHRoZSBzZXJ2aWNlXG5cdFx0Ly8gICAgICAgaXMgd2ViIG9ubHkuXG5cdFx0Ly9cblx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cblxuXHRcdC8vIFVSSSBJZGVudGl0eVxuXHRcdGNvbnN0IHVyaUlkZW50aXR5U2VydmljZSA9IG5ldyBVcmlJZGVudGl0eVNlcnZpY2UoZmlsZVNlcnZpY2UpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJVXJpSWRlbnRpdHlTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UpO1xuXG5cdFx0Ly8gVXNlciBEYXRhIFByb2ZpbGVzXG5cdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UgPSBuZXcgQnJvd3NlclVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY3VycmVudFByb2ZpbGUgPSBhd2FpdCB0aGlzLmdldEN1cnJlbnRQcm9maWxlKHdvcmtzcGFjZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSk7XG5cdFx0YXdhaXQgdXNlckRhdGFQcm9maWxlc1NlcnZpY2Uuc2V0UHJvZmlsZUZvcldvcmtzcGFjZSh3b3Jrc3BhY2UsIGN1cnJlbnRQcm9maWxlKTtcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlID0gbmV3IFVzZXJEYXRhUHJvZmlsZVNlcnZpY2UoY3VycmVudFByb2ZpbGUpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJVXNlckRhdGFQcm9maWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSk7XG5cblx0XHQvLyBSZW1vdGUgQWdlbnRcblx0XHRjb25zdCByZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSA9IG5ldyBSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSgpO1xuXHRcdHJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlLnJlZ2lzdGVyKFJlbW90ZUNvbm5lY3Rpb25UeXBlLldlYlNvY2tldCwgbmV3IEJyb3dzZXJTb2NrZXRGYWN0b3J5KHRoaXMuY29uZmlndXJhdGlvbi53ZWJTb2NrZXRGYWN0b3J5KSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSwgcmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IHJlbW90ZUFnZW50U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZW1vdGVBZ2VudFNlcnZpY2UocmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIHJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSwgc2lnblNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVJlbW90ZUFnZW50U2VydmljZSwgcmVtb3RlQWdlbnRTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihSZW1vdGVGaWxlU3lzdGVtUHJvdmlkZXJDbGllbnQucmVnaXN0ZXIocmVtb3RlQWdlbnRTZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSkpO1xuXG5cdFx0Ly8gTG9uZyBydW5uaW5nIHNlcnZpY2VzICh3b3Jrc3BhY2UsIGNvbmZpZywgc3RvcmFnZSlcblx0XHRjb25zdCBbY29uZmlndXJhdGlvblNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMuY3JlYXRlV29ya3NwYWNlU2VydmljZSh3b3Jrc3BhY2UsIGVudmlyb25tZW50U2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIGZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSkudGhlbihzZXJ2aWNlID0+IHtcblxuXHRcdFx0XHQvLyBXb3Jrc3BhY2Vcblx0XHRcdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgc2VydmljZSk7XG5cblx0XHRcdFx0Ly8gQ29uZmlndXJhdGlvblxuXHRcdFx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzZXJ2aWNlKTtcblxuXHRcdFx0XHRyZXR1cm4gc2VydmljZTtcblx0XHRcdH0pLFxuXG5cdFx0XHR0aGlzLmNyZWF0ZVN0b3JhZ2VTZXJ2aWNlKHdvcmtzcGFjZSwgbG9nU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSkudGhlbihzZXJ2aWNlID0+IHtcblxuXHRcdFx0XHQvLyBTdG9yYWdlXG5cdFx0XHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJU3RvcmFnZVNlcnZpY2UsIHNlcnZpY2UpO1xuXG5cdFx0XHRcdHJldHVybiBzZXJ2aWNlO1xuXHRcdFx0fSlcblx0XHRdKTtcblxuXHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblx0XHQvL1xuXHRcdC8vIE5PVEU6IFBsZWFzZSBkbyBOT1QgcmVnaXN0ZXIgc2VydmljZXMgaGVyZS4gVXNlIGByZWdpc3RlclNpbmdsZXRvbigpYFxuXHRcdC8vICAgICAgIGZyb20gYHdvcmtiZW5jaC5jb21tb24ubWFpbi50c2AgaWYgdGhlIHNlcnZpY2UgaXMgc2hhcmVkIGJldHdlZW5cblx0XHQvLyAgICAgICBkZXNrdG9wIGFuZCB3ZWIgb3IgYHdvcmtiZW5jaC53ZWIubWFpbi50c2AgaWYgdGhlIHNlcnZpY2Vcblx0XHQvLyAgICAgICBpcyB3ZWIgb25seS5cblx0XHQvL1xuXHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXG5cdFx0Ly8gV29ya3NwYWNlIFRydXN0IFNlcnZpY2Vcblx0XHRjb25zdCB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlID0gbmV3IFdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UoY29uZmlndXJhdGlvblNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLCB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgPSBuZXcgV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZShjb25maWd1cmF0aW9uU2VydmljZSwgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLCB3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlKTtcblxuXHRcdC8vIFVwZGF0ZSB3b3Jrc3BhY2UgdHJ1c3Qgc28gdGhhdCBjb25maWd1cmF0aW9uIGlzIHVwZGF0ZWQgYWNjb3JkaW5nbHlcblx0XHRjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVXb3Jrc3BhY2VUcnVzdCh3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlVHJ1c3QoKCkgPT4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlV29ya3NwYWNlVHJ1c3Qod29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkpKTtcblxuXHRcdC8vIFJlcXVlc3QgU2VydmljZVxuXHRcdGNvbnN0IHJlcXVlc3RTZXJ2aWNlID0gbmV3IEJyb3dzZXJSZXF1ZXN0U2VydmljZShyZW1vdGVBZ2VudFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsb2dnZXJTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVJlcXVlc3RTZXJ2aWNlLCByZXF1ZXN0U2VydmljZSk7XG5cblx0XHQvLyBVc2VyZGF0YSBTeW5jIFN0b3JlIE1hbmFnZW1lbnQgU2VydmljZVxuXHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UgPSBuZXcgVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZShwcm9kdWN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsIHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UpO1xuXG5cblx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0Ly9cblx0XHQvLyBOT1RFOiBQbGVhc2UgZG8gTk9UIHJlZ2lzdGVyIHNlcnZpY2VzIGhlcmUuIFVzZSBgcmVnaXN0ZXJTaW5nbGV0b24oKWBcblx0XHQvLyAgICAgICBmcm9tIGB3b3JrYmVuY2guY29tbW9uLm1haW4udHNgIGlmIHRoZSBzZXJ2aWNlIGlzIHNoYXJlZCBiZXR3ZWVuXG5cdFx0Ly8gICAgICAgZGVza3RvcCBhbmQgd2ViIG9yIGB3b3JrYmVuY2gud2ViLm1haW4udHNgIGlmIHRoZSBzZXJ2aWNlXG5cdFx0Ly8gICAgICAgaXMgd2ViIG9ubHkuXG5cdFx0Ly9cblx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cblx0XHRjb25zdCBlbmNyeXB0aW9uU2VydmljZSA9IG5ldyBFbmNyeXB0aW9uU2VydmljZSgpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJRW5jcnlwdGlvblNlcnZpY2UsIGVuY3J5cHRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBzZWNyZXRTdG9yYWdlU2VydmljZSA9IG5ldyBCcm93c2VyU2VjcmV0U3RvcmFnZVNlcnZpY2Uoc3RvcmFnZVNlcnZpY2UsIGVuY3J5cHRpb25TZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJU2VjcmV0U3RvcmFnZVNlcnZpY2UsIHNlY3JldFN0b3JhZ2VTZXJ2aWNlKTtcblxuXHRcdC8vIFVzZXJkYXRhIEluaXRpYWxpemUgU2VydmljZVxuXHRcdGNvbnN0IHVzZXJEYXRhSW5pdGlhbGl6ZXJzOiBJVXNlckRhdGFJbml0aWFsaXplcltdID0gW107XG5cdFx0dXNlckRhdGFJbml0aWFsaXplcnMucHVzaChuZXcgVXNlckRhdGFTeW5jSW5pdGlhbGl6ZXIoZW52aXJvbm1lbnRTZXJ2aWNlLCBzZWNyZXRTdG9yYWdlU2VydmljZSwgdXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIHJlcXVlc3RTZXJ2aWNlLCBsb2dTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UpKTtcblx0XHRpZiAoZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMucHJvZmlsZSkge1xuXHRcdFx0dXNlckRhdGFJbml0aWFsaXplcnMucHVzaChuZXcgVXNlckRhdGFQcm9maWxlSW5pdGlhbGl6ZXIoZW52aXJvbm1lbnRTZXJ2aWNlLCBmaWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxvZ1NlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgcmVxdWVzdFNlcnZpY2UpKTtcblx0XHR9XG5cdFx0Y29uc3QgdXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UgPSBuZXcgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UodXNlckRhdGFJbml0aWFsaXplcnMpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UsIHVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHQvLyBEbyBub3QgYmxvY2sgbW9yZSB0aGFuIDVzXG5cdFx0XHRcdHRpbWVvdXQoNTAwMCksXG5cdFx0XHRcdHRoaXMuaW5pdGlhbGl6ZVVzZXJEYXRhKHVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSldXG5cdFx0XHQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBzZXJ2aWNlQ29sbGVjdGlvbiwgY29uZmlndXJhdGlvblNlcnZpY2UsIGxvZ1NlcnZpY2UgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZVVzZXJEYXRhKHVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlOiBVc2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2U6IFdvcmtzcGFjZVNlcnZpY2UpIHtcblx0XHRpZiAoYXdhaXQgdXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UucmVxdWlyZXNJbml0aWFsaXphdGlvbigpKSB7XG5cdFx0XHRtYXJrKCdjb2RlL3dpbGxJbml0UmVxdWlyZWRVc2VyRGF0YScpO1xuXG5cdFx0XHQvLyBJbml0aWFsaXplIHJlcXVpcmVkIHJlc291cmNlcyAtIHNldHRpbmdzICYgZ2xvYmFsIHN0YXRlXG5cdFx0XHRhd2FpdCB1c2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZS5pbml0aWFsaXplUmVxdWlyZWRSZXNvdXJjZXMoKTtcblxuXHRcdFx0Ly8gSW1wb3J0YW50OiBSZWxvYWQgb25seSBsb2NhbCB1c2VyIGNvbmZpZ3VyYXRpb24gYWZ0ZXIgaW5pdGlhbGl6aW5nXG5cdFx0XHQvLyBSZWxvYWRpbmcgY29tcGxldGUgY29uZmlndXJhdGlvbiBibG9ja3Mgd29ya2JlbmNoIHVudGlsIHJlbW90ZSBjb25maWd1cmF0aW9uIGlzIGxvYWRlZC5cblx0XHRcdGF3YWl0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlbG9hZExvY2FsVXNlckNvbmZpZ3VyYXRpb24oKTtcblxuXHRcdFx0bWFyaygnY29kZS9kaWRJbml0UmVxdWlyZWRVc2VyRGF0YScpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVnaXN0ZXJJbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXJzKGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLCBsb2dzUGF0aDogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBJbmRleGVkREIgaXMgdXNlZCBmb3IgbG9nZ2luZyBhbmQgdXNlciBkYXRhXG5cdFx0bGV0IGluZGV4ZWREQjogSW5kZXhlZERCIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHVzZXJEYXRhU3RvcmUgPSAndnNjb2RlLXVzZXJkYXRhLXN0b3JlJztcblx0XHRjb25zdCBsb2dzU3RvcmUgPSAndnNjb2RlLWxvZ3Mtc3RvcmUnO1xuXHRcdGNvbnN0IGhhbmRsZXNTdG9yZSA9ICd2c2NvZGUtZmlsZWhhbmRsZXMtc3RvcmUnO1xuXHRcdHRyeSB7XG5cdFx0XHRpbmRleGVkREIgPSBhd2FpdCBJbmRleGVkREIuY3JlYXRlKCd2c2NvZGUtd2ViLWRiJywgMywgW3VzZXJEYXRhU3RvcmUsIGxvZ3NTdG9yZSwgaGFuZGxlc1N0b3JlXSk7XG5cblx0XHRcdC8vIENsb3NlIG9uV2lsbFNodXRkb3duXG5cdFx0XHR0aGlzLm9uV2lsbFNodXRkb3duRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBpbmRleGVkREI/LmNsb3NlKCkpKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bG9nU2VydmljZS5lcnJvcignRXJyb3Igd2hpbGUgY3JlYXRpbmcgSW5kZXhlZERCJywgZXJyb3IpO1xuXHRcdH1cblxuXHRcdC8vIExvZ2dlclxuXHRcdGlmIChpbmRleGVkREIpIHtcblx0XHRcdGNvbnN0IGxvZ0ZpbGVTeXN0ZW1Qcm92aWRlciA9IG5ldyBJbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXIobG9nc1BhdGguc2NoZW1lLCBpbmRleGVkREIsIGxvZ3NTdG9yZSwgZmFsc2UpO1xuXHRcdFx0dGhpcy5pbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXJzLnB1c2gobG9nRmlsZVN5c3RlbVByb3ZpZGVyKTtcblx0XHRcdGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIobG9nc1BhdGguc2NoZW1lLCBsb2dGaWxlU3lzdGVtUHJvdmlkZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKGxvZ3NQYXRoLnNjaGVtZSwgbmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdH1cblxuXHRcdC8vIFVzZXIgZGF0YVxuXHRcdGxldCB1c2VyRGF0YVByb3ZpZGVyO1xuXHRcdGlmIChpbmRleGVkREIpIHtcblx0XHRcdHVzZXJEYXRhUHJvdmlkZXIgPSBuZXcgSW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyKFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIGluZGV4ZWREQiwgdXNlckRhdGFTdG9yZSwgdHJ1ZSk7XG5cdFx0XHR0aGlzLmluZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlcnMucHVzaCh1c2VyRGF0YVByb3ZpZGVyKTtcblx0XHRcdHRoaXMucmVnaXN0ZXJEZXZlbG9wZXJBY3Rpb25zKDxJbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXI+dXNlckRhdGFQcm92aWRlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxvZ1NlcnZpY2UuaW5mbygnVXNpbmcgaW4tbWVtb3J5IHVzZXIgZGF0YSBwcm92aWRlcicpO1xuXHRcdFx0dXNlckRhdGFQcm92aWRlciA9IG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpO1xuXHRcdH1cblx0XHRmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIHVzZXJEYXRhUHJvdmlkZXIpO1xuXG5cdFx0Ly8gTG9jYWwgZmlsZSBhY2Nlc3MgKGlmIHN1cHBvcnRlZCBieSBicm93c2VyKVxuXHRcdGlmIChXZWJGaWxlU3lzdGVtQWNjZXNzLnN1cHBvcnRlZChtYWluV2luZG93KSkge1xuXHRcdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLmZpbGUsIG5ldyBIVE1MRmlsZVN5c3RlbVByb3ZpZGVyKGluZGV4ZWREQiwgaGFuZGxlc1N0b3JlLCBsb2dTZXJ2aWNlKSk7XG5cdFx0fVxuXG5cdFx0Ly8gSW4tbWVtb3J5XG5cdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLnRtcCwgbmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckRldmVsb3BlckFjdGlvbnMocHJvdmlkZXI6IEluZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZXNldFVzZXJEYXRhQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5yZXNldFVzZXJEYXRhJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXNldCcsIFwiUmVzZXQgVXNlciBEYXRhXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgncmVzZXQgdXNlciBkYXRhIG1lc3NhZ2UnLCBcIldvdWxkIHlvdSBsaWtlIHRvIHJlc2V0IHlvdXIgZGF0YSAoc2V0dGluZ3MsIGtleWJpbmRpbmdzLCBleHRlbnNpb25zLCBzbmlwcGV0cyBhbmQgVUkgU3RhdGUpIGFuZCByZWxvYWQ/XCIpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHByb3ZpZGVyPy5yZXNldCgpO1xuXHRcdFx0XHRcdFx0aWYgKHN0b3JhZ2VTZXJ2aWNlIGluc3RhbmNlb2YgQnJvd3NlclN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHN0b3JhZ2VTZXJ2aWNlLmNsZWFyKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVTdG9yYWdlU2VydmljZSh3b3Jrc3BhY2U6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyLCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UpOiBQcm9taXNlPElTdG9yYWdlU2VydmljZT4ge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gbmV3IEJyb3dzZXJTdG9yYWdlU2VydmljZSh3b3Jrc3BhY2UsIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHN0b3JhZ2VTZXJ2aWNlLmluaXRpYWxpemUoKTtcblxuXHRcdFx0Ly8gUmVnaXN0ZXIgdG8gY2xvc2Ugb24gc2h1dGRvd25cblx0XHRcdHRoaXMub25XaWxsU2h1dGRvd25EaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHN0b3JhZ2VTZXJ2aWNlLmNsb3NlKCkpKTtcblxuXHRcdFx0cmV0dXJuIHN0b3JhZ2VTZXJ2aWNlO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7XG5cdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblxuXHRcdFx0cmV0dXJuIHN0b3JhZ2VTZXJ2aWNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlV29ya3NwYWNlU2VydmljZSh3b3Jrc3BhY2U6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyLCBlbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgZmlsZVNlcnZpY2U6IEZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpOiBQcm9taXNlPFdvcmtzcGFjZVNlcnZpY2U+IHtcblxuXHRcdC8vIFRlbXBvcmFyeSB3b3Jrc3BhY2VzIGRvIG5vdCBleGlzdCBvbiBzdGFydHVwIGJlY2F1c2UgdGhleSBhcmVcblx0XHQvLyBqdXN0IGluIG1lbW9yeS4gQXMgc3VjaCwgZGV0ZWN0IHRoaXMgY2FzZSBhbmQgZWFnZXJseSBjcmVhdGVcblx0XHQvLyB0aGUgd29ya3NwYWNlIGZpbGUgZW1wdHkgc28gdGhhdCBpdCBpcyBhIHZhbGlkIHdvcmtzcGFjZS5cblxuXHRcdGlmIChpc1dvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlKSAmJiBpc1RlbXBvcmFyeVdvcmtzcGFjZSh3b3Jrc3BhY2UuY29uZmlnUGF0aCkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGVtcHR5V29ya3NwYWNlOiBJU3RvcmVkV29ya3NwYWNlID0geyBmb2xkZXJzOiBbXSB9O1xuXHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGaWxlKHdvcmtzcGFjZS5jb25maWdQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KGVtcHR5V29ya3NwYWNlLCBudWxsLCAnXFx0JykpLCB7IG92ZXJ3cml0ZTogZmFsc2UgfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBpZ25vcmUgaWYgd29ya3NwYWNlIGZpbGUgYWxyZWFkeSBleGlzdHNcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uQ2FjaGUgPSBuZXcgQ29uZmlndXJhdGlvbkNhY2hlKFtTY2hlbWFzLmZpbGUsIFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIFNjaGVtYXMudG1wXSAvKiBDYWNoZSBhbGwgbm9uIG5hdGl2ZSByZXNvdXJjZXMgKi8sIGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVNlcnZpY2UgPSBuZXcgV29ya3NwYWNlU2VydmljZSh7IHJlbW90ZUF1dGhvcml0eTogdGhpcy5jb25maWd1cmF0aW9uLnJlbW90ZUF1dGhvcml0eSwgY29uZmlndXJhdGlvbkNhY2hlIH0sIGVudmlyb25tZW50U2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIGZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHdvcmtzcGFjZVNlcnZpY2UuaW5pdGlhbGl6ZSh3b3Jrc3BhY2UpO1xuXG5cdFx0XHRyZXR1cm4gd29ya3NwYWNlU2VydmljZTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xuXHRcdFx0bG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cblx0XHRcdHJldHVybiB3b3Jrc3BhY2VTZXJ2aWNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0Q3VycmVudFByb2ZpbGUod29ya3NwYWNlOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IEJyb3dzZXJVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlOiBCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPiB7XG5cdFx0Y29uc3QgcHJvZmlsZU5hbWUgPSBlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8ucHJvZmlsZT8ubmFtZSA/PyBlbnZpcm9ubWVudFNlcnZpY2UucHJvZmlsZTtcblx0XHRpZiAocHJvZmlsZU5hbWUpIHtcblx0XHRcdGNvbnN0IHByb2ZpbGUgPSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5maW5kKHAgPT4gcC5uYW1lID09PSBwcm9maWxlTmFtZSk7XG5cdFx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0XHRyZXR1cm4gcHJvZmlsZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5jcmVhdGVOYW1lZFByb2ZpbGUocHJvZmlsZU5hbWUsIHVuZGVmaW5lZCwgd29ya3NwYWNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmdldFByb2ZpbGVGb3JXb3Jrc3BhY2Uod29ya3NwYWNlKSA/PyB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVdvcmtzcGFjZSgpOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciB7XG5cdFx0bGV0IHdvcmtzcGFjZTogSVdvcmtzcGFjZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uLndvcmtzcGFjZVByb3ZpZGVyKSB7XG5cdFx0XHR3b3Jrc3BhY2UgPSB0aGlzLmNvbmZpZ3VyYXRpb24ud29ya3NwYWNlUHJvdmlkZXIud29ya3NwYWNlO1xuXHRcdH1cblxuXHRcdC8vIE11bHRpLXJvb3Qgd29ya3NwYWNlXG5cdFx0aWYgKHdvcmtzcGFjZSAmJiBpc1dvcmtzcGFjZVRvT3Blbih3b3Jrc3BhY2UpKSB7XG5cdFx0XHRyZXR1cm4gZ2V0V29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2Uud29ya3NwYWNlVXJpKTtcblx0XHR9XG5cblx0XHQvLyBTaW5nbGUtZm9sZGVyIHdvcmtzcGFjZVxuXHRcdGlmICh3b3Jrc3BhY2UgJiYgaXNGb2xkZXJUb09wZW4od29ya3NwYWNlKSkge1xuXHRcdFx0cmV0dXJuIGdldFNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlLmZvbGRlclVyaSk7XG5cdFx0fVxuXG5cdFx0Ly8gRW1wdHkgd2luZG93IHdvcmtzcGFjZVxuXHRcdHJldHVybiBVTktOT1dOX0VNUFRZX1dJTkRPV19XT1JLU1BBQ0U7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsWUFBWTtBQUNyQixTQUFTLGtCQUFrQixrQkFBa0IsZ0JBQWdCLGlCQUFpQjtBQUM5RSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWEsZUFBZSxhQUFhLHNCQUErQjtBQUNqRixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLG9DQUFvQywyQ0FBMkM7QUFDeEYsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxzQ0FBc0M7QUFFL0MsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyxhQUFhO0FBQ3BCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsaUNBQWlDLDRCQUE0QjtBQUN0RSxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFNBQVMsaUNBQWlDO0FBQ25ELFNBQWtDLDBCQUEwQixnQ0FBZ0Msc0JBQXNCLDZCQUE2QjtBQUMvSSxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHlCQUF5QjtBQUNsQyxT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QkFBeUMsb0JBQXlDLFlBQW9EO0FBTXJZLFFBQUksc0JBQXNCLFNBQVMsS0FBSyxxQkFBcUIsVUFBVSxVQUFVLEdBQUc7QUFDbkYsVUFBSTtBQUNILGNBQU0saUJBQW1DLEVBQUUsU0FBUyxDQUFDLEVBQUU7QUFDdkQsY0FBTSxZQUFZLFdBQVcsVUFBVSxZQUFZLFNBQVMsV0FBVyxLQUFLLFVBQVUsZ0JBQWdCLE1BQU0sR0FBSSxDQUFDLEdBQUcsRUFBRSxXQUFXLE1BQU0sQ0FBQztBQUFBLE1BQ3pJLFNBQVMsT0FBTztBQUFBLE1BRWhCO0FBQUEsSUFDRDtBQUVBLFVBQU0scUJBQXFCLElBQUksbUJBQW1CLENBQUMsUUFBUSxNQUFNLFFBQVEsZ0JBQWdCLFFBQVEsR0FBRyxHQUF3QyxvQkFBb0IsV0FBVztBQUMzSyxVQUFNLG1CQUFtQixJQUFJLGlCQUFpQixFQUFFLGlCQUFpQixLQUFLLGNBQWMsaUJBQWlCLG1CQUFtQixHQUFHLG9CQUFvQix3QkFBd0IseUJBQXlCLGFBQWEsb0JBQW9CLG9CQUFvQixZQUFZLElBQUksa0JBQWtCLENBQUM7QUFFeFIsUUFBSTtBQUNILFlBQU0saUJBQWlCLFdBQVcsU0FBUztBQUUzQyxhQUFPO0FBQUEsSUFDUixTQUFTLE9BQU87QUFDZix3QkFBa0IsS0FBSztBQUN2QixpQkFBVyxNQUFNLEtBQUs7QUFFdEIsYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLGtCQUFrQixXQUFvQyx5QkFBeUQsb0JBQW1GO0FBQy9NLFVBQU0sY0FBYyxtQkFBbUIsU0FBUyxTQUFTLFFBQVEsbUJBQW1CO0FBQ3BGLFFBQUksYUFBYTtBQUNoQixZQUFNLFVBQVUsd0JBQXdCLFNBQVMsS0FBSyxPQUFLLEVBQUUsU0FBUyxXQUFXO0FBQ2pGLFVBQUksU0FBUztBQUNaLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyx3QkFBd0IsbUJBQW1CLGFBQWEsUUFBVyxTQUFTO0FBQUEsSUFDcEY7QUFDQSxXQUFPLHdCQUF3Qix1QkFBdUIsU0FBUyxLQUFLLHdCQUF3QjtBQUFBLEVBQzdGO0FBQUEsRUFFUSxtQkFBNEM7QUFDbkQsUUFBSSxZQUFvQztBQUN4QyxRQUFJLEtBQUssY0FBYyxtQkFBbUI7QUFDekMsa0JBQVksS0FBSyxjQUFjLGtCQUFrQjtBQUFBLElBQ2xEO0FBR0EsUUFBSSxhQUFhLGtCQUFrQixTQUFTLEdBQUc7QUFDOUMsYUFBTyx1QkFBdUIsVUFBVSxZQUFZO0FBQUEsSUFDckQ7QUFHQSxRQUFJLGFBQWEsZUFBZSxTQUFTLEdBQUc7QUFDM0MsYUFBTyxtQ0FBbUMsVUFBVSxTQUFTO0FBQUEsSUFDOUQ7QUFHQSxXQUFPO0FBQUEsRUFDUjtBQUNEOyIsCiAgIm5hbWVzIjogWyJpbnN0YW50aWF0aW9uU2VydmljZSJdCn0K
