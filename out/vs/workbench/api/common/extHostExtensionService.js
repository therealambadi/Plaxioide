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
import * as nls from "../../../nls.js";
import * as path from "../../../base/common/path.js";
import * as performance from "../../../base/common/performance.js";
import { originalFSPath, joinPath, extUriBiasedIgnorePathCase } from "../../../base/common/resources.js";
import { asPromise, Barrier, IntervalTimer, timeout } from "../../../base/common/async.js";
import { dispose, toDisposable, Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostConfiguration } from "./extHostConfiguration.js";
import { ActivatedExtension, EmptyExtension, ExtensionActivationTimes, ExtensionActivationTimesBuilder, ExtensionsActivator, HostExtension } from "./extHostExtensionActivator.js";
import { ExtHostStorage, IExtHostStorage } from "./extHostStorage.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
import { ActivationKind, checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { ExtensionDescriptionRegistry } from "../../services/extensions/common/extensionDescriptionRegistry.js";
import * as errors from "../../../base/common/errors.js";
import { ExtensionIdentifier, ExtensionIdentifierMap, ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { ExtensionGlobalMemento, ExtensionMemento } from "./extHostMemento.js";
import { RemoteAuthorityResolverError, ExtensionKind, ExtensionMode, ManagedResolvedAuthority as ExtHostManagedResolvedAuthority } from "./extHostTypes.js";
import { RemoteAuthorityResolverErrorCode, getRemoteAuthorityPrefix, ManagedRemoteConnection, WebSocketRemoteConnection } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { IInstantiationService, createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { IExtensionStoragePaths } from "./extHostStoragePaths.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { IExtHostTunnelService } from "./extHostTunnelService.js";
import { IExtHostTerminalService } from "./extHostTerminalService.js";
import { IExtHostLanguageModels } from "./extHostLanguageModels.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { checkActivateWorkspaceContainsExtension } from "../../services/extensions/common/workspaceContains.js";
import { ExtHostSecretState, IExtHostSecretState } from "./extHostSecretState.js";
import { ExtensionSecrets } from "./extHostSecrets.js";
import { Schemas } from "../../../base/common/network.js";
import { IExtHostLocalizationService } from "./extHostLocalizationService.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { isCI, setTimeout0 } from "../../../base/common/platform.js";
import { IExtHostManagedSockets } from "./extHostManagedSockets.js";
const IHostUtils = createDecorator("IHostUtils");
let AbstractExtHostExtensionService = class extends Disposable {
  constructor(instaService, hostUtils, extHostContext, extHostWorkspace, extHostConfiguration, logService, initData, storagePath, extHostTunnelService, extHostTerminalService, extHostLocalizationService, _extHostManagedSockets, _extHostLanguageModels) {
    super();
    this._extHostManagedSockets = _extHostManagedSockets;
    this._extHostLanguageModels = _extHostLanguageModels;
    this._onDidChangeRemoteConnectionData = this._register(new Emitter());
    this.onDidChangeRemoteConnectionData = this._onDidChangeRemoteConnectionData.event;
    this._realPathCache = /* @__PURE__ */ new Map();
    this._isTerminating = false;
    this._hostUtils = hostUtils;
    this._extHostContext = extHostContext;
    this._initData = initData;
    this._extHostWorkspace = extHostWorkspace;
    this._extHostConfiguration = extHostConfiguration;
    this._logService = logService;
    this._extHostTunnelService = extHostTunnelService;
    this._extHostTerminalService = extHostTerminalService;
    this._extHostLocalizationService = extHostLocalizationService;
    this._mainThreadWorkspaceProxy = this._extHostContext.getProxy(MainContext.MainThreadWorkspace);
    this._mainThreadTelemetryProxy = this._extHostContext.getProxy(MainContext.MainThreadTelemetry);
    this._mainThreadExtensionsProxy = this._extHostContext.getProxy(MainContext.MainThreadExtensionService);
    this._almostReadyToRunExtensions = new Barrier();
    this._readyToStartExtensionHost = new Barrier();
    this._readyToRunExtensions = new Barrier();
    this._eagerExtensionsActivated = new Barrier();
    this._activationEventsReader = new SyncedActivationEventsReader(this._initData.extensions.activationEvents);
    this._globalRegistry = new ExtensionDescriptionRegistry(this._activationEventsReader, this._initData.extensions.allExtensions);
    const myExtensionsSet = new ExtensionIdentifierSet(this._initData.extensions.myExtensions);
    this._myRegistry = new ExtensionDescriptionRegistry(
      this._activationEventsReader,
      filterExtensions(this._globalRegistry, myExtensionsSet)
    );
    if (isCI) {
      this._logService.info(`Creating extension host with the following global extensions: ${printExtIds(this._globalRegistry)}`);
      this._logService.info(`Creating extension host with the following local extensions: ${printExtIds(this._myRegistry)}`);
    }
    this._storage = new ExtHostStorage(this._extHostContext, this._logService);
    this._secretState = new ExtHostSecretState(this._extHostContext);
    this._storagePath = storagePath;
    this._instaService = this._store.add(instaService.createChild(new ServiceCollection(
      [IExtHostStorage, this._storage],
      [IExtHostSecretState, this._secretState]
    )));
    this._activator = this._register(new ExtensionsActivator(
      this._myRegistry,
      this._globalRegistry,
      {
        onExtensionActivationError: (extensionId, error, missingExtensionDependency) => {
          this._mainThreadExtensionsProxy.$onExtensionActivationError(extensionId, errors.transformErrorForSerialization(error), missingExtensionDependency);
        },
        actualActivateExtension: async (extensionId, reason) => {
          if (ExtensionDescriptionRegistry.isHostExtension(extensionId, this._myRegistry, this._globalRegistry)) {
            await this._mainThreadExtensionsProxy.$activateExtension(extensionId, reason);
            return new HostExtension();
          }
          const extensionDescription = this._myRegistry.getExtensionDescription(extensionId);
          return this._activateExtension(extensionDescription, reason);
        }
      },
      this._logService
    ));
    this._extensionPathIndex = null;
    this._resolvers = /* @__PURE__ */ Object.create(null);
    this._started = false;
    this._remoteConnectionData = this._initData.remote.connectionData;
  }
  getRemoteConnectionData() {
    return this._remoteConnectionData;
  }
  async initialize() {
    try {
      await this._beforeAlmostReadyToRunExtensions();
      this._almostReadyToRunExtensions.open();
      await this._extHostWorkspace.waitForInitializeCall();
      performance.mark("code/extHost/ready");
      this._readyToStartExtensionHost.open();
      if (this._initData.autoStart) {
        this._startExtensionHost();
      }
    } catch (err) {
      errors.onUnexpectedError(err);
    }
  }
  async _deactivateAll() {
    this._storagePath.onWillDeactivateAll();
    let allPromises = [];
    try {
      const allExtensions = this._myRegistry.getAllExtensionDescriptions();
      const allExtensionsIds = allExtensions.map((ext) => ext.identifier);
      const activatedExtensions = allExtensionsIds.filter((id) => this.isActivated(id));
      allPromises = activatedExtensions.map((extensionId) => {
        return this._deactivate(extensionId);
      });
    } catch (err) {
    }
    await Promise.all(allPromises);
  }
  terminate(reason, code = 0) {
    if (this._isTerminating) {
      return;
    }
    this._isTerminating = true;
    this._logService.info(`Extension host terminating: ${reason}`);
    this._logService.flush();
    this._extHostTerminalService.dispose();
    this._activator.dispose();
    errors.setUnexpectedErrorHandler((err) => {
      this._logService.error(err);
    });
    this._extHostContext.dispose();
    const extensionsDeactivated = this._deactivateAll();
    Promise.race([timeout(5e3), extensionsDeactivated]).finally(() => {
      if (this._hostUtils.pid) {
        this._logService.info(`Extension host with pid ${this._hostUtils.pid} exiting with code ${code}`);
      } else {
        this._logService.info(`Extension host exiting with code ${code}`);
      }
      this._logService.flush();
      this._logService.dispose();
      this._hostUtils.exit(code);
    });
  }
  isActivated(extensionId) {
    if (this._readyToRunExtensions.isOpen()) {
      return this._activator.isActivated(extensionId);
    }
    return false;
  }
  async getExtension(extensionId) {
    const ext = await this._mainThreadExtensionsProxy.$getExtension(extensionId);
    return ext && {
      ...ext,
      identifier: new ExtensionIdentifier(ext.identifier.value),
      extensionLocation: URI.revive(ext.extensionLocation)
    };
  }
  _activateByEvent(activationEvent, startup) {
    return this._activator.activateByEvent(activationEvent, startup);
  }
  _activateById(extensionId, reason) {
    return this._activator.activateById(extensionId, reason);
  }
  activateByIdWithErrors(extensionId, reason) {
    return this._activateById(extensionId, reason).then(() => {
      const extension = this._activator.getActivatedExtension(extensionId);
      if (extension.activationFailed) {
        return Promise.reject(extension.activationFailedError);
      }
      return void 0;
    });
  }
  getExtensionRegistry() {
    return this._readyToRunExtensions.wait().then((_) => this._myRegistry);
  }
  getExtensionExports(extensionId) {
    if (this._readyToRunExtensions.isOpen()) {
      return this._activator.getActivatedExtension(extensionId).exports;
    } else {
      try {
        return this._activator.getActivatedExtension(extensionId).exports;
      } catch (err) {
        return null;
      }
    }
  }
  /**
   * Applies realpath to file-uris and returns all others uris unmodified.
   * The real path is cached for the lifetime of the extension host.
   */
  async _realPathExtensionUri(uri) {
    if (uri.scheme === Schemas.file && this._hostUtils.fsRealpath) {
      const fsPath = uri.fsPath;
      if (!this._realPathCache.has(fsPath)) {
        this._realPathCache.set(fsPath, this._hostUtils.fsRealpath(fsPath));
      }
      const realpathValue = await this._realPathCache.get(fsPath);
      return URI.file(realpathValue);
    }
    return uri;
  }
  // create trie to enable fast 'filename -> extension id' look up
  async getExtensionPathIndex() {
    if (!this._extensionPathIndex) {
      this._extensionPathIndex = this._createExtensionPathIndex(this._myRegistry.getAllExtensionDescriptions()).then((searchTree) => {
        return new ExtensionPaths(searchTree);
      });
    }
    return this._extensionPathIndex;
  }
  /**
   * create trie to enable fast 'filename -> extension id' look up
   */
  async _createExtensionPathIndex(extensions) {
    const tst = TernarySearchTree.forUris((key) => {
      return extUriBiasedIgnorePathCase.ignorePathCasing(key);
    });
    await Promise.all(extensions.map(async (ext) => {
      if (this._getEntryPoint(ext)) {
        const uri = await this._realPathExtensionUri(ext.extensionLocation);
        tst.set(uri, ext);
      }
    }));
    return tst;
  }
  _deactivate(extensionId) {
    let result = Promise.resolve(void 0);
    if (!this._readyToRunExtensions.isOpen()) {
      return result;
    }
    if (!this._activator.isActivated(extensionId)) {
      return result;
    }
    const extension = this._activator.getActivatedExtension(extensionId);
    if (!extension) {
      return result;
    }
    try {
      if (typeof extension.module.deactivate === "function") {
        result = Promise.resolve(extension.module.deactivate()).then(void 0, (err) => {
          this._logService.error(err);
          return Promise.resolve(void 0);
        });
      }
    } catch (err) {
      this._logService.error(`An error occurred when deactivating the extension '${extensionId.value}':`);
      this._logService.error(err);
    }
    try {
      extension.disposable.dispose();
    } catch (err) {
      this._logService.error(`An error occurred when disposing the subscriptions for extension '${extensionId.value}':`);
      this._logService.error(err);
    }
    return result;
  }
  // --- impl
  async _activateExtension(extensionDescription, reason) {
    if (!this._initData.remote.isRemote) {
      await this._mainThreadExtensionsProxy.$onWillActivateExtension(extensionDescription.identifier);
    } else {
      this._mainThreadExtensionsProxy.$onWillActivateExtension(extensionDescription.identifier);
    }
    return this._doActivateExtension(extensionDescription, reason).then((activatedExtension) => {
      const activationTimes = activatedExtension.activationTimes;
      this._mainThreadExtensionsProxy.$onDidActivateExtension(extensionDescription.identifier, activationTimes.codeLoadingTime, activationTimes.activateCallTime, activationTimes.activateResolvedTime, reason);
      this._logExtensionActivationTimes(extensionDescription, reason, "success", activationTimes);
      return activatedExtension;
    }, (err) => {
      this._logExtensionActivationTimes(extensionDescription, reason, "failure");
      throw err;
    });
  }
  _logExtensionActivationTimes(extensionDescription, reason, outcome, activationTimes) {
    const event = getTelemetryActivationEvent(extensionDescription, reason);
    this._mainThreadTelemetryProxy.$publicLog2("extensionActivationTimes", {
      ...event,
      ...activationTimes || {},
      outcome
    });
  }
  _doActivateExtension(extensionDescription, reason) {
    const event = getTelemetryActivationEvent(extensionDescription, reason);
    this._mainThreadTelemetryProxy.$publicLog2("activatePlugin", event);
    const entryPoint = this._getEntryPoint(extensionDescription);
    if (!entryPoint) {
      return Promise.resolve(new EmptyExtension(ExtensionActivationTimes.NONE));
    }
    this._logService.info(`ExtensionService#_doActivateExtension ${extensionDescription.identifier.value}, startup: ${reason.startup}, activationEvent: '${reason.activationEvent}'${extensionDescription.identifier.value !== reason.extensionId.value ? `, root cause: ${reason.extensionId.value}` : ``}`);
    this._logService.flush();
    const extensionInternalStore = new DisposableStore();
    const activationTimesBuilder = new ExtensionActivationTimesBuilder(reason.startup);
    return Promise.all([
      this._loadCommonJSModule(extensionDescription, joinPath(extensionDescription.extensionLocation, entryPoint), activationTimesBuilder),
      this._loadExtensionContext(extensionDescription, extensionInternalStore)
    ]).then((values) => {
      performance.mark(`code/extHost/willActivateExtension/${extensionDescription.identifier.value}`);
      return AbstractExtHostExtensionService._callActivate(this._logService, extensionDescription.identifier, values[0], values[1], extensionInternalStore, activationTimesBuilder);
    }).then((activatedExtension) => {
      performance.mark(`code/extHost/didActivateExtension/${extensionDescription.identifier.value}`);
      return activatedExtension;
    });
  }
  _loadExtensionContext(extensionDescription, extensionInternalStore) {
    const languageModelAccessInformation = this._extHostLanguageModels.createLanguageModelAccessInformation(extensionDescription);
    const globalState = extensionInternalStore.add(new ExtensionGlobalMemento(extensionDescription, this._storage));
    const workspaceState = extensionInternalStore.add(new ExtensionMemento(extensionDescription.identifier.value, false, this._storage));
    const secrets = extensionInternalStore.add(new ExtensionSecrets(extensionDescription, this._secretState));
    const extensionMode = extensionDescription.isUnderDevelopment ? this._initData.environment.extensionTestsLocationURI ? ExtensionMode.Test : ExtensionMode.Development : ExtensionMode.Production;
    const extensionKind = this._initData.remote.isRemote ? ExtensionKind.Workspace : ExtensionKind.UI;
    this._logService.trace(`ExtensionService#loadExtensionContext ${extensionDescription.identifier.value}`);
    return Promise.all([
      globalState.whenReady,
      workspaceState.whenReady,
      this._storagePath.whenReady
    ]).then(() => {
      const that = this;
      let extension;
      let messagePassingProtocol;
      const messagePort = isProposedApiEnabled(extensionDescription, "ipc") ? this._initData.messagePorts?.get(ExtensionIdentifier.toKey(extensionDescription.identifier)) : void 0;
      return Object.freeze({
        globalState,
        workspaceState,
        secrets,
        subscriptions: [],
        get languageModelAccessInformation() {
          return languageModelAccessInformation;
        },
        get extensionUri() {
          return extensionDescription.extensionLocation;
        },
        get extensionPath() {
          return extensionDescription.extensionLocation.fsPath;
        },
        asAbsolutePath(relativePath) {
          return path.join(extensionDescription.extensionLocation.fsPath, relativePath);
        },
        get storagePath() {
          return that._storagePath.workspaceValue(extensionDescription)?.fsPath;
        },
        get globalStoragePath() {
          return that._storagePath.globalValue(extensionDescription).fsPath;
        },
        get logPath() {
          return path.join(that._initData.logsLocation.fsPath, extensionDescription.identifier.value);
        },
        get logUri() {
          return URI.joinPath(that._initData.logsLocation, extensionDescription.identifier.value);
        },
        get storageUri() {
          return that._storagePath.workspaceValue(extensionDescription);
        },
        get globalStorageUri() {
          return that._storagePath.globalValue(extensionDescription);
        },
        get extensionMode() {
          return extensionMode;
        },
        get extension() {
          if (extension === void 0) {
            extension = new Extension(that, extensionDescription.identifier, extensionDescription, extensionKind, false);
          }
          return extension;
        },
        get extensionRuntime() {
          checkProposedApiEnabled(extensionDescription, "extensionRuntime");
          return that.extensionRuntime;
        },
        get environmentVariableCollection() {
          return that._extHostTerminalService.getEnvironmentVariableCollection(extensionDescription);
        },
        get messagePassingProtocol() {
          if (!messagePassingProtocol) {
            if (!messagePort) {
              return void 0;
            }
            const onDidReceiveMessage = Event.buffer(Event.fromDOMEventEmitter(messagePort, "message", (e) => e.data));
            messagePort.start();
            messagePassingProtocol = {
              onDidReceiveMessage,
              postMessage: messagePort.postMessage.bind(messagePort)
            };
          }
          return messagePassingProtocol;
        }
      });
    });
  }
  static _callActivate(logService, extensionId, extensionModule, context, extensionInternalStore, activationTimesBuilder) {
    extensionModule = extensionModule || {
      activate: void 0,
      deactivate: void 0
    };
    return this._callActivateOptional(logService, extensionId, extensionModule, context, activationTimesBuilder).then((extensionExports) => {
      return new ActivatedExtension(false, null, activationTimesBuilder.build(), extensionModule, extensionExports, toDisposable(() => {
        extensionInternalStore.dispose();
        dispose(context.subscriptions);
      }));
    });
  }
  static _callActivateOptional(logService, extensionId, extensionModule, context, activationTimesBuilder) {
    if (typeof extensionModule.activate === "function") {
      try {
        activationTimesBuilder.activateCallStart();
        logService.trace(`ExtensionService#_callActivateOptional ${extensionId.value}`);
        const scope = typeof global === "object" ? global : self;
        const activateResult = extensionModule.activate.apply(scope, [context]);
        activationTimesBuilder.activateCallStop();
        activationTimesBuilder.activateResolveStart();
        return Promise.resolve(activateResult).then((value) => {
          activationTimesBuilder.activateResolveStop();
          return value;
        });
      } catch (err) {
        return Promise.reject(err);
      }
    } else {
      return Promise.resolve(extensionModule);
    }
  }
  // -- eager activation
  _activateOneStartupFinished(desc, activationEvent) {
    this._activateById(desc.identifier, {
      startup: false,
      extensionId: desc.identifier,
      activationEvent
    }).then(void 0, (err) => {
      this._logService.error(err);
    });
  }
  _activateAllStartupFinishedDeferred(extensions, start = 0) {
    const timeBudget = 50;
    const startTime = Date.now();
    setTimeout0(() => {
      for (let i = start; i < extensions.length; i += 1) {
        const desc = extensions[i];
        for (const activationEvent of desc.activationEvents ?? []) {
          if (activationEvent === "onStartupFinished") {
            if (Date.now() - startTime > timeBudget) {
              this._activateAllStartupFinishedDeferred(extensions, i);
              break;
            } else {
              this._activateOneStartupFinished(desc, activationEvent);
            }
          }
        }
      }
    });
  }
  _activateAllStartupFinished() {
    this._mainThreadExtensionsProxy.$setPerformanceMarks(performance.getMarks());
    this._extHostConfiguration.getConfigProvider().then((configProvider) => {
      const shouldDeferActivation = configProvider.getConfiguration("extensions.experimental").get("deferredStartupFinishedActivation");
      const allExtensionDescriptions = this._myRegistry.getAllExtensionDescriptions();
      if (shouldDeferActivation) {
        this._activateAllStartupFinishedDeferred(allExtensionDescriptions);
      } else {
        for (const desc of allExtensionDescriptions) {
          if (desc.activationEvents) {
            for (const activationEvent of desc.activationEvents) {
              if (activationEvent === "onStartupFinished") {
                this._activateOneStartupFinished(desc, activationEvent);
              }
            }
          }
        }
      }
    });
  }
  // Handle "eager" activation extensions
  _handleEagerExtensions() {
    const starActivation = this._activateByEvent("*", true).then(void 0, (err) => {
      this._logService.error(err);
    });
    this._register(this._extHostWorkspace.onDidChangeWorkspace((e) => this._handleWorkspaceContainsEagerExtensions(e.added)));
    const folders = this._extHostWorkspace.workspace ? this._extHostWorkspace.workspace.folders : [];
    const workspaceContainsActivation = this._handleWorkspaceContainsEagerExtensions(folders);
    const remoteResolverActivation = this._handleRemoteResolverEagerExtensions();
    const eagerExtensionsActivation = Promise.all([remoteResolverActivation, starActivation, workspaceContainsActivation]).then(() => {
    });
    Promise.race([eagerExtensionsActivation, timeout(1e4)]).then(() => {
      this._activateAllStartupFinished();
    });
    return eagerExtensionsActivation;
  }
  _handleWorkspaceContainsEagerExtensions(folders) {
    if (folders.length === 0) {
      return Promise.resolve(void 0);
    }
    return Promise.all(
      this._myRegistry.getAllExtensionDescriptions().map((desc) => {
        return this._handleWorkspaceContainsEagerExtension(folders, desc);
      })
    ).then(() => {
    });
  }
  async _handleWorkspaceContainsEagerExtension(folders, desc) {
    if (this.isActivated(desc.identifier)) {
      return;
    }
    const localWithRemote = !this._initData.remote.isRemote && !!this._initData.remote.authority;
    const host = {
      logService: this._logService,
      folders: folders.map((folder) => folder.uri),
      forceUsingSearch: localWithRemote || !this._hostUtils.fsExists,
      exists: (uri) => this._hostUtils.fsExists(uri.fsPath),
      checkExists: (folders2, includes, token) => this._mainThreadWorkspaceProxy.$checkExists(folders2, includes, token)
    };
    const result = await checkActivateWorkspaceContainsExtension(host, desc);
    if (!result) {
      return;
    }
    return this._activateById(desc.identifier, { startup: true, extensionId: desc.identifier, activationEvent: result.activationEvent }).then(void 0, (err) => this._logService.error(err));
  }
  async _handleRemoteResolverEagerExtensions() {
    if (this._initData.remote.authority) {
      return this._activateByEvent(`onResolveRemoteAuthority:${this._initData.remote.authority}`, false);
    }
  }
  async $extensionTestsExecute() {
    await this._eagerExtensionsActivated.wait();
    try {
      return await this._doHandleExtensionTests();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async _doHandleExtensionTests() {
    const { extensionDevelopmentLocationURI, extensionTestsLocationURI } = this._initData.environment;
    if (!extensionDevelopmentLocationURI || !extensionTestsLocationURI) {
      throw new Error(nls.localize("extensionTestError1", "Cannot load test runner."));
    }
    const testRunner = await this._loadCommonJSModule(null, extensionTestsLocationURI, new ExtensionActivationTimesBuilder(false));
    if (!testRunner || typeof testRunner.run !== "function") {
      throw new Error(nls.localize("extensionTestError", "Path {0} does not point to a valid extension test runner.", extensionTestsLocationURI.toString()));
    }
    return new Promise((resolve, reject) => {
      const oldTestRunnerCallback = (error, failures) => {
        if (error) {
          if (isCI) {
            this._logService.error(`Test runner called back with error`, error);
          }
          reject(error);
        } else {
          if (isCI) {
            if (failures) {
              this._logService.info(`Test runner called back with ${failures} failures.`);
            } else {
              this._logService.info(`Test runner called back with successful outcome.`);
            }
          }
          resolve(
            typeof failures === "number" && failures > 0 ? 1 : 0
            /* OK */
          );
        }
      };
      const extensionTestsPath = originalFSPath(extensionTestsLocationURI);
      const runResult = testRunner.run(extensionTestsPath, oldTestRunnerCallback);
      if (runResult && runResult.then) {
        runResult.then(() => {
          if (isCI) {
            this._logService.info(`Test runner finished successfully.`);
          }
          resolve(0);
        }).catch((err) => {
          if (isCI) {
            this._logService.error(`Test runner finished with error`, err);
          }
          reject(err instanceof Error && err.stack ? err.stack : String(err));
        });
      }
    });
  }
  _startExtensionHost() {
    if (this._started) {
      throw new Error(`Extension host is already started!`);
    }
    this._started = true;
    return this._readyToStartExtensionHost.wait().then(() => this._readyToRunExtensions.open()).then(() => {
      return Promise.race([this._activator.waitForActivatingExtensions(), timeout(1e3)]);
    }).then(() => this._handleEagerExtensions()).then(() => {
      this._eagerExtensionsActivated.open();
      this._logService.info(`Eager extensions activated`);
    });
  }
  // -- called by extensions
  registerRemoteAuthorityResolver(authorityPrefix, resolver) {
    this._resolvers[authorityPrefix] = resolver;
    return toDisposable(() => {
      delete this._resolvers[authorityPrefix];
    });
  }
  async getRemoteExecServer(remoteAuthority) {
    const { resolver } = await this._activateAndGetResolver(remoteAuthority);
    return resolver?.resolveExecServer?.(remoteAuthority, { resolveAttempt: 0 });
  }
  // -- called by main thread
  async _activateAndGetResolver(remoteAuthority) {
    const authorityPlusIndex = remoteAuthority.indexOf("+");
    if (authorityPlusIndex === -1) {
      throw new RemoteAuthorityResolverError(`Not an authority that can be resolved!`, RemoteAuthorityResolverErrorCode.InvalidAuthority);
    }
    const authorityPrefix = remoteAuthority.substr(0, authorityPlusIndex);
    await this._almostReadyToRunExtensions.wait();
    await this._activateByEvent(`onResolveRemoteAuthority:${authorityPrefix}`, false);
    return { authorityPrefix, resolver: this._resolvers[authorityPrefix] };
  }
  async $resolveAuthority(remoteAuthorityChain, resolveAttempt) {
    const sw = StopWatch.create(false);
    const prefix = () => `[resolveAuthority(${getRemoteAuthorityPrefix(remoteAuthorityChain)},${resolveAttempt})][${sw.elapsed()}ms] `;
    const logInfo = (msg) => this._logService.info(`${prefix()}${msg}`);
    const logWarning = (msg) => this._logService.warn(`${prefix()}${msg}`);
    const logError = (msg, err = void 0) => this._logService.error(`${prefix()}${msg}`, err);
    const normalizeError = (err) => {
      if (err instanceof RemoteAuthorityResolverError) {
        return {
          type: "error",
          error: {
            code: err._code,
            message: err._message,
            detail: err._detail
          }
        };
      }
      throw err;
    };
    const getResolver = async (remoteAuthority) => {
      logInfo(`activating resolver for ${remoteAuthority}...`);
      const { resolver, authorityPrefix } = await this._activateAndGetResolver(remoteAuthority);
      if (!resolver) {
        logError(`no resolver for ${authorityPrefix}`);
        throw new RemoteAuthorityResolverError(`No remote extension installed to resolve ${authorityPrefix}.`, RemoteAuthorityResolverErrorCode.NoResolverFound);
      }
      return { resolver, authorityPrefix, remoteAuthority };
    };
    const chain = remoteAuthorityChain.split(/@|%40/g).reverse();
    logInfo(`activating remote resolvers ${chain.join(" -> ")}`);
    let resolvers;
    try {
      resolvers = await Promise.all(chain.map(getResolver)).catch(async (e) => {
        if (!(e instanceof RemoteAuthorityResolverError) || e._code !== RemoteAuthorityResolverErrorCode.InvalidAuthority) {
          throw e;
        }
        logWarning(`resolving nested authorities failed: ${e.message}`);
        return [await getResolver(remoteAuthorityChain)];
      });
    } catch (e) {
      return normalizeError(e);
    }
    const intervalLogger = new IntervalTimer();
    intervalLogger.cancelAndSet(() => logInfo("waiting..."), 1e3);
    let result;
    let execServer;
    for (const [i, { authorityPrefix, resolver, remoteAuthority }] of resolvers.entries()) {
      try {
        if (i === resolvers.length - 1) {
          logInfo(`invoking final resolve()...`);
          performance.mark(`code/extHost/willResolveAuthority/${authorityPrefix}`);
          result = await resolver.resolve(remoteAuthority, { resolveAttempt, execServer });
          performance.mark(`code/extHost/didResolveAuthorityOK/${authorityPrefix}`);
          logInfo(`setting tunnel factory...`);
          this._register(await this._extHostTunnelService.setTunnelFactory(
            resolver,
            ExtHostManagedResolvedAuthority.isManagedResolvedAuthority(result) ? result : void 0
          ));
        } else {
          logInfo(`invoking resolveExecServer() for ${remoteAuthority}`);
          performance.mark(`code/extHost/willResolveExecServer/${authorityPrefix}`);
          execServer = await resolver.resolveExecServer?.(remoteAuthority, { resolveAttempt, execServer });
          if (!execServer) {
            throw new RemoteAuthorityResolverError(`Exec server was not available for ${remoteAuthority}`, RemoteAuthorityResolverErrorCode.NoResolverFound);
          }
          performance.mark(`code/extHost/didResolveExecServerOK/${authorityPrefix}`);
        }
      } catch (e) {
        performance.mark(`code/extHost/didResolveAuthorityError/${authorityPrefix}`);
        logError(`returned an error`, e);
        intervalLogger.dispose();
        return normalizeError(e);
      }
    }
    intervalLogger.dispose();
    const tunnelInformation = {
      environmentTunnels: result.environmentTunnels,
      features: result.tunnelFeatures ? {
        elevation: result.tunnelFeatures.elevation,
        privacyOptions: result.tunnelFeatures.privacyOptions,
        protocol: result.tunnelFeatures.protocol === void 0 ? true : result.tunnelFeatures.protocol
      } : void 0
    };
    const options = {
      extensionHostEnv: result.extensionHostEnv,
      isTrusted: result.isTrusted,
      authenticationSession: result.authenticationSessionForInitializingExtensions ? { id: result.authenticationSessionForInitializingExtensions.id, providerId: result.authenticationSessionForInitializingExtensions.providerId } : void 0
    };
    logInfo(`returned ${ExtHostManagedResolvedAuthority.isManagedResolvedAuthority(result) ? "managed authority" : `${result.host}:${result.port}`}`);
    let authority;
    if (ExtHostManagedResolvedAuthority.isManagedResolvedAuthority(result)) {
      const socketFactoryId = resolveAttempt;
      this._extHostManagedSockets.setFactory(socketFactoryId, result.makeConnection);
      authority = {
        authority: remoteAuthorityChain,
        connectTo: new ManagedRemoteConnection(socketFactoryId),
        connectionToken: result.connectionToken
      };
    } else {
      authority = {
        authority: remoteAuthorityChain,
        connectTo: new WebSocketRemoteConnection(result.host, result.port),
        connectionToken: result.connectionToken
      };
    }
    return {
      type: "ok",
      value: {
        authority,
        options,
        tunnelInformation
      }
    };
  }
  async $getCanonicalURI(remoteAuthority, uriComponents) {
    this._logService.info(`$getCanonicalURI invoked for authority (${getRemoteAuthorityPrefix(remoteAuthority)})`);
    const { resolver } = await this._activateAndGetResolver(remoteAuthority);
    if (!resolver) {
      return null;
    }
    const uri = URI.revive(uriComponents);
    if (typeof resolver.getCanonicalURI === "undefined") {
      return uri;
    }
    const result = await asPromise(() => resolver.getCanonicalURI(uri));
    if (!result) {
      return uri;
    }
    return result;
  }
  async $startExtensionHost(extensionsDelta) {
    extensionsDelta.toAdd.forEach((extension) => extension.extensionLocation = URI.revive(extension.extensionLocation));
    const { globalRegistry, myExtensions } = applyExtensionsDelta(this._activationEventsReader, this._globalRegistry, this._myRegistry, extensionsDelta);
    const newSearchTree = await this._createExtensionPathIndex(myExtensions);
    const extensionsPaths = await this.getExtensionPathIndex();
    extensionsPaths.setSearchTree(newSearchTree);
    this._globalRegistry.set(globalRegistry.getAllExtensionDescriptions());
    this._myRegistry.set(myExtensions);
    if (isCI) {
      this._logService.info(`$startExtensionHost: global extensions: ${printExtIds(this._globalRegistry)}`);
      this._logService.info(`$startExtensionHost: local extensions: ${printExtIds(this._myRegistry)}`);
    }
    return this._startExtensionHost();
  }
  $activateByEvent(activationEvent, activationKind) {
    if (activationKind === ActivationKind.Immediate) {
      return this._almostReadyToRunExtensions.wait().then((_) => this._activateByEvent(activationEvent, false));
    }
    return this._readyToRunExtensions.wait().then((_) => this._activateByEvent(activationEvent, false));
  }
  async $activate(extensionId, reason) {
    await this._readyToRunExtensions.wait();
    if (!this._myRegistry.getExtensionDescription(extensionId)) {
      return false;
    }
    await this._activateById(extensionId, reason);
    return true;
  }
  async $deltaExtensions(extensionsDelta) {
    extensionsDelta.toAdd.forEach((extension) => extension.extensionLocation = URI.revive(extension.extensionLocation));
    const { globalRegistry, myExtensions } = applyExtensionsDelta(this._activationEventsReader, this._globalRegistry, this._myRegistry, extensionsDelta);
    const newSearchTree = await this._createExtensionPathIndex(myExtensions);
    const extensionsPaths = await this.getExtensionPathIndex();
    extensionsPaths.setSearchTree(newSearchTree);
    this._globalRegistry.set(globalRegistry.getAllExtensionDescriptions());
    this._myRegistry.set(myExtensions);
    if (isCI) {
      this._logService.info(`$deltaExtensions: global extensions: ${printExtIds(this._globalRegistry)}`);
      this._logService.info(`$deltaExtensions: local extensions: ${printExtIds(this._myRegistry)}`);
    }
    return Promise.resolve(void 0);
  }
  async $test_latency(n) {
    return n;
  }
  async $test_up(b) {
    return b.byteLength;
  }
  async $test_down(size) {
    const buff = VSBuffer.alloc(size);
    const value = Math.random() % 256;
    for (let i = 0; i < size; i++) {
      buff.writeUInt8(value, i);
    }
    return buff;
  }
  async $updateRemoteConnectionData(connectionData) {
    this._remoteConnectionData = connectionData;
    this._onDidChangeRemoteConnectionData.fire();
  }
};
AbstractExtHostExtensionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IHostUtils),
  __decorateParam(2, IExtHostRpcService),
  __decorateParam(3, IExtHostWorkspace),
  __decorateParam(4, IExtHostConfiguration),
  __decorateParam(5, ILogService),
  __decorateParam(6, IExtHostInitDataService),
  __decorateParam(7, IExtensionStoragePaths),
  __decorateParam(8, IExtHostTunnelService),
  __decorateParam(9, IExtHostTerminalService),
  __decorateParam(10, IExtHostLocalizationService),
  __decorateParam(11, IExtHostManagedSockets),
  __decorateParam(12, IExtHostLanguageModels)
], AbstractExtHostExtensionService);
function applyExtensionsDelta(activationEventsReader, oldGlobalRegistry, oldMyRegistry, extensionsDelta) {
  activationEventsReader.addActivationEvents(extensionsDelta.addActivationEvents);
  const globalRegistry = new ExtensionDescriptionRegistry(activationEventsReader, oldGlobalRegistry.getAllExtensionDescriptions());
  globalRegistry.deltaExtensions(extensionsDelta.toAdd, extensionsDelta.toRemove);
  const myExtensionsSet = new ExtensionIdentifierSet(oldMyRegistry.getAllExtensionDescriptions().map((extension) => extension.identifier));
  for (const extensionId of extensionsDelta.myToRemove) {
    myExtensionsSet.delete(extensionId);
  }
  for (const extensionId of extensionsDelta.myToAdd) {
    myExtensionsSet.add(extensionId);
  }
  const myExtensions = filterExtensions(globalRegistry, myExtensionsSet);
  return { globalRegistry, myExtensions };
}
function getTelemetryActivationEvent(extensionDescription, reason) {
  const event = {
    id: extensionDescription.identifier.value,
    name: extensionDescription.name,
    extensionVersion: extensionDescription.version,
    publisherDisplayName: extensionDescription.publisher,
    activationEvents: extensionDescription.activationEvents ? extensionDescription.activationEvents.join(",") : null,
    isBuiltin: extensionDescription.isBuiltin,
    reason: reason.activationEvent,
    reasonId: reason.extensionId.value
  };
  return event;
}
function printExtIds(registry) {
  return registry.getAllExtensionDescriptions().map((ext) => ext.identifier.value).join(",");
}
const IExtHostExtensionService = createDecorator("IExtHostExtensionService");
class Extension {
  #extensionService;
  #originExtensionId;
  #identifier;
  constructor(extensionService, originExtensionId, description, kind, isFromDifferentExtensionHost) {
    this.#extensionService = extensionService;
    this.#originExtensionId = originExtensionId;
    this.#identifier = description.identifier;
    this.id = description.identifier.value;
    this.extensionUri = description.extensionLocation;
    this.extensionPath = path.normalize(originalFSPath(description.extensionLocation));
    this.packageJSON = description;
    this.extensionKind = kind;
    this.isFromDifferentExtensionHost = isFromDifferentExtensionHost;
  }
  get isActive() {
    return this.#extensionService.isActivated(this.#identifier);
  }
  get exports() {
    if (this.packageJSON.api === "none" || this.isFromDifferentExtensionHost) {
      return void 0;
    }
    return this.#extensionService.getExtensionExports(this.#identifier);
  }
  async activate() {
    if (this.isFromDifferentExtensionHost) {
      throw new Error("Cannot activate foreign extension");
    }
    await this.#extensionService.activateByIdWithErrors(this.#identifier, { startup: false, extensionId: this.#originExtensionId, activationEvent: "api" });
    return this.exports;
  }
}
function filterExtensions(globalRegistry, desiredExtensions) {
  return globalRegistry.getAllExtensionDescriptions().filter(
    (extension) => desiredExtensions.has(extension.identifier)
  );
}
class ExtensionPaths {
  constructor(_searchTree) {
    this._searchTree = _searchTree;
  }
  setSearchTree(searchTree) {
    this._searchTree = searchTree;
  }
  findSubstr(key) {
    return this._searchTree.findSubstr(key);
  }
  forEach(callback) {
    return this._searchTree.forEach(callback);
  }
}
class SyncedActivationEventsReader {
  constructor(activationEvents) {
    this._map = new ExtensionIdentifierMap();
    this.addActivationEvents(activationEvents);
  }
  readActivationEvents(extensionDescription) {
    return this._map.get(extensionDescription.identifier) ?? [];
  }
  addActivationEvents(activationEvents) {
    for (const extensionId of Object.keys(activationEvents)) {
      this._map.set(extensionId, activationEvents[extensionId]);
    }
  }
}
export {
  AbstractExtHostExtensionService,
  Extension,
  ExtensionPaths,
  IExtHostExtensionService,
  IHostUtils
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RXh0ZW5zaW9uU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qIGVzbGludC1kaXNhYmxlIGxvY2FsL2NvZGUtbm8tbmF0aXZlLXByaXZhdGUgKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0ICogYXMgcGVyZm9ybWFuY2UgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgb3JpZ2luYWxGU1BhdGgsIGpvaW5QYXRoLCBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBhc1Byb21pc2UsIEJhcnJpZXIsIEludGVydmFsVGltZXIsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGVybmFyeVNlYXJjaFRyZWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90ZXJuYXJ5U2VhcmNoVHJlZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RXh0ZW5zaW9uU2VydmljZVNoYXBlLCBNYWluQ29udGV4dCwgTWFpblRocmVhZEV4dGVuc2lvblNlcnZpY2VTaGFwZSwgTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlLCBNYWluVGhyZWFkV29ya3NwYWNlU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uRGVsdGEsIElFeHRlbnNpb25Ib3N0SW5pdERhdGEgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25Ib3N0UHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbmZpZ3VyYXRpb24sIElFeHRIb3N0Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vZXh0SG9zdENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWN0aXZhdGVkRXh0ZW5zaW9uLCBFbXB0eUV4dGVuc2lvbiwgRXh0ZW5zaW9uQWN0aXZhdGlvblRpbWVzLCBFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNCdWlsZGVyLCBFeHRlbnNpb25zQWN0aXZhdG9yLCBJRXh0ZW5zaW9uQVBJLCBJRXh0ZW5zaW9uTW9kdWxlLCBIb3N0RXh0ZW5zaW9uLCBFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNGcmFnbWVudCB9IGZyb20gJy4vZXh0SG9zdEV4dGVuc2lvbkFjdGl2YXRvci5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0U3RvcmFnZSwgSUV4dEhvc3RTdG9yYWdlIH0gZnJvbSAnLi9leHRIb3N0U3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0V29ya3NwYWNlLCBJRXh0SG9zdFdvcmtzcGFjZSB9IGZyb20gJy4vZXh0SG9zdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBNaXNzaW5nRXh0ZW5zaW9uRGVwZW5kZW5jeSwgQWN0aXZhdGlvbktpbmQsIGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCwgRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbiB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSwgSUFjdGl2YXRpb25FdmVudHNSZWFkZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIEV4dGVuc2lvbklkZW50aWZpZXJNYXAsIEV4dGVuc2lvbklkZW50aWZpZXJTZXQsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uR2xvYmFsTWVtZW50bywgRXh0ZW5zaW9uTWVtZW50byB9IGZyb20gJy4vZXh0SG9zdE1lbWVudG8uanMnO1xuaW1wb3J0IHsgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvciwgRXh0ZW5zaW9uS2luZCwgRXh0ZW5zaW9uTW9kZSwgRXh0ZW5zaW9uUnVudGltZSwgTWFuYWdlZFJlc29sdmVkQXV0aG9yaXR5IGFzIEV4dEhvc3RNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHkgfSBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEF1dGhvcml0eSwgUmVzb2x2ZWRPcHRpb25zLCBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yQ29kZSwgSVJlbW90ZUNvbm5lY3Rpb25EYXRhLCBnZXRSZW1vdGVBdXRob3JpdHlQcmVmaXgsIFR1bm5lbEluZm9ybWF0aW9uLCBNYW5hZ2VkUmVtb3RlQ29ubmVjdGlvbiwgV2ViU29ja2V0UmVtb3RlQ29ubmVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0SW5pdERhdGFTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TdG9yYWdlUGF0aHMgfSBmcm9tICcuL2V4dEhvc3RTdG9yYWdlUGF0aHMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElFeHRIb3N0VHVubmVsU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFR1bm5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RUZXJtaW5hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RMYW5ndWFnZU1vZGVscyB9IGZyb20gJy4vZXh0SG9zdExhbmd1YWdlTW9kZWxzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkFjdGl2YXRpb25Ib3N0LCBjaGVja0FjdGl2YXRlV29ya3NwYWNlQ29udGFpbnNFeHRlbnNpb24gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi93b3Jrc3BhY2VDb250YWlucy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0U2VjcmV0U3RhdGUsIElFeHRIb3N0U2VjcmV0U3RhdGUgfSBmcm9tICcuL2V4dEhvc3RTZWNyZXRTdGF0ZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25TZWNyZXRzIH0gZnJvbSAnLi9leHRIb3N0U2VjcmV0cy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZUF1dGhvcml0eVJlc3VsdCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkhvc3RQcm94eS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdExvY2FsaXphdGlvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBpc0NJLCBzZXRUaW1lb3V0MCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFeHRIb3N0TWFuYWdlZFNvY2tldHMgfSBmcm9tICcuL2V4dEhvc3RNYW5hZ2VkU29ja2V0cy5qcyc7XG5pbXBvcnQgeyBEdG8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuXG5pbnRlcmZhY2UgSVRlc3RSdW5uZXIge1xuXHQvKiogT2xkIHRlc3QgcnVubmVyIEFQSSwgYXMgZXhwb3J0ZWQgZnJvbSBgdnNjb2RlL2xpYi90ZXN0cnVubmVyYCAqL1xuXHRydW4odGVzdHNSb290OiBzdHJpbmcsIGNsYjogKGVycm9yOiBFcnJvciwgZmFpbHVyZXM/OiBudW1iZXIpID0+IHZvaWQpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSU5ld1Rlc3RSdW5uZXIge1xuXHQvKiogTmV3IHRlc3QgcnVubmVyIEFQSSwgYXMgZXhwbGFpbmVkIGluIHRoZSBleHRlbnNpb24gdGVzdCBkb2MgKi9cblx0cnVuKCk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjb25zdCBJSG9zdFV0aWxzID0gY3JlYXRlRGVjb3JhdG9yPElIb3N0VXRpbHM+KCdJSG9zdFV0aWxzJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUhvc3RVdGlscyB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcGlkOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdGV4aXQoY29kZTogbnVtYmVyKTogdm9pZDtcblx0ZnNFeGlzdHM/KHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG5cdGZzUmVhbHBhdGg/KHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPjtcbn1cblxudHlwZSBUZWxlbWV0cnlBY3RpdmF0aW9uRXZlbnRGcmFnbWVudCA9IHtcblx0aWQ6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXIgb2YgYW4gZXh0ZW5zaW9uJyB9O1xuXHRuYW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnUHVibGljTm9uUGVyc29uYWxEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBuYW1lIG9mIHRoZSBleHRlbnNpb24nIH07XG5cdGV4dGVuc2lvblZlcnNpb246IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHZlcnNpb24gb2YgdGhlIGV4dGVuc2lvbicgfTtcblx0cHVibGlzaGVyRGlzcGxheU5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgcHVibGlzaGVyIG9mIHRoZSBleHRlbnNpb24nIH07XG5cdGFjdGl2YXRpb25FdmVudHM6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdBbGwgYWN0aXZhdGlvbiBldmVudHMgb2YgdGhlIGV4dGVuc2lvbicgfTtcblx0aXNCdWlsdGluOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSWYgdGhlIGV4dGVuc2lvbiBpcyBidWlsdGluIG9yIGdpdCBpbnN0YWxsZWQnIH07XG5cdHJlYXNvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBhY3RpdmF0aW9uIGV2ZW50JyB9O1xuXHRyZWFzb25JZDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaWRlbnRpZmllciBvZiB0aGUgYWN0aXZhdGlvbiBldmVudCcgfTtcbn07XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIEV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlU2hhcGUge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRhYnN0cmFjdCByZWFkb25seSBleHRlbnNpb25SdW50aW1lOiBFeHRlbnNpb25SdW50aW1lO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVtb3RlQ29ubmVjdGlvbkRhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVtb3RlQ29ubmVjdGlvbkRhdGEgPSB0aGlzLl9vbkRpZENoYW5nZVJlbW90ZUNvbm5lY3Rpb25EYXRhLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfaG9zdFV0aWxzOiBJSG9zdFV0aWxzO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2luaXREYXRhOiBJRXh0ZW5zaW9uSG9zdEluaXREYXRhO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2V4dEhvc3RDb250ZXh0OiBJRXh0SG9zdFJwY1NlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfZXh0SG9zdFdvcmtzcGFjZTogRXh0SG9zdFdvcmtzcGFjZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9leHRIb3N0Q29uZmlndXJhdGlvbjogRXh0SG9zdENvbmZpZ3VyYXRpb247XG5cdHByb3RlY3RlZCByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfZXh0SG9zdFR1bm5lbFNlcnZpY2U6IElFeHRIb3N0VHVubmVsU2VydmljZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9leHRIb3N0VGVybWluYWxTZXJ2aWNlOiBJRXh0SG9zdFRlcm1pbmFsU2VydmljZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9leHRIb3N0TG9jYWxpemF0aW9uU2VydmljZTogSUV4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfbWFpblRocmVhZFdvcmtzcGFjZVByb3h5OiBNYWluVGhyZWFkV29ya3NwYWNlU2hhcGU7XG5cdHByb3RlY3RlZCByZWFkb25seSBfbWFpblRocmVhZFRlbGVtZXRyeVByb3h5OiBNYWluVGhyZWFkVGVsZW1ldHJ5U2hhcGU7XG5cdHByb3RlY3RlZCByZWFkb25seSBfbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eTogTWFpblRocmVhZEV4dGVuc2lvblNlcnZpY2VTaGFwZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hbG1vc3RSZWFkeVRvUnVuRXh0ZW5zaW9uczogQmFycmllcjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVhZHlUb1N0YXJ0RXh0ZW5zaW9uSG9zdDogQmFycmllcjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVhZHlUb1J1bkV4dGVuc2lvbnM6IEJhcnJpZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VhZ2VyRXh0ZW5zaW9uc0FjdGl2YXRlZDogQmFycmllcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3RpdmF0aW9uRXZlbnRzUmVhZGVyOiBTeW5jZWRBY3RpdmF0aW9uRXZlbnRzUmVhZGVyO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX215UmVnaXN0cnk6IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfZ2xvYmFsUmVnaXN0cnk6IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2U6IEV4dEhvc3RTdG9yYWdlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZWNyZXRTdGF0ZTogRXh0SG9zdFNlY3JldFN0YXRlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlUGF0aDogSUV4dGVuc2lvblN0b3JhZ2VQYXRocztcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZhdG9yOiBFeHRlbnNpb25zQWN0aXZhdG9yO1xuXHRwcml2YXRlIF9leHRlbnNpb25QYXRoSW5kZXg6IFByb21pc2U8RXh0ZW5zaW9uUGF0aHM+IHwgbnVsbDtcblx0cHJpdmF0ZSBfcmVhbFBhdGhDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPHN0cmluZz4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZXJzOiB7IFthdXRob3JpdHlQcmVmaXg6IHN0cmluZ106IHZzY29kZS5SZW1vdGVBdXRob3JpdHlSZXNvbHZlciB9O1xuXG5cdHByaXZhdGUgX3N0YXJ0ZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX2lzVGVybWluYXRpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfcmVtb3RlQ29ubmVjdGlvbkRhdGE6IElSZW1vdGVDb25uZWN0aW9uRGF0YSB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUhvc3RVdGlscyBob3N0VXRpbHM6IElIb3N0VXRpbHMsXG5cdFx0QElFeHRIb3N0UnBjU2VydmljZSBleHRIb3N0Q29udGV4dDogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdFdvcmtzcGFjZSBleHRIb3N0V29ya3NwYWNlOiBJRXh0SG9zdFdvcmtzcGFjZSxcblx0XHRASUV4dEhvc3RDb25maWd1cmF0aW9uIGV4dEhvc3RDb25maWd1cmF0aW9uOiBJRXh0SG9zdENvbmZpZ3VyYXRpb24sXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEluaXREYXRhU2VydmljZSBpbml0RGF0YTogSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TdG9yYWdlUGF0aHMgc3RvcmFnZVBhdGg6IElFeHRlbnNpb25TdG9yYWdlUGF0aHMsXG5cdFx0QElFeHRIb3N0VHVubmVsU2VydmljZSBleHRIb3N0VHVubmVsU2VydmljZTogSUV4dEhvc3RUdW5uZWxTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdFRlcm1pbmFsU2VydmljZSBleHRIb3N0VGVybWluYWxTZXJ2aWNlOiBJRXh0SG9zdFRlcm1pbmFsU2VydmljZSxcblx0XHRASUV4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlIGV4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlOiBJRXh0SG9zdExvY2FsaXphdGlvblNlcnZpY2UsXG5cdFx0QElFeHRIb3N0TWFuYWdlZFNvY2tldHMgcHJpdmF0ZSByZWFkb25seSBfZXh0SG9zdE1hbmFnZWRTb2NrZXRzOiBJRXh0SG9zdE1hbmFnZWRTb2NrZXRzLFxuXHRcdEBJRXh0SG9zdExhbmd1YWdlTW9kZWxzIHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RMYW5ndWFnZU1vZGVsczogSUV4dEhvc3RMYW5ndWFnZU1vZGVscyxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9ob3N0VXRpbHMgPSBob3N0VXRpbHM7XG5cdFx0dGhpcy5fZXh0SG9zdENvbnRleHQgPSBleHRIb3N0Q29udGV4dDtcblx0XHR0aGlzLl9pbml0RGF0YSA9IGluaXREYXRhO1xuXG5cdFx0dGhpcy5fZXh0SG9zdFdvcmtzcGFjZSA9IGV4dEhvc3RXb3Jrc3BhY2U7XG5cdFx0dGhpcy5fZXh0SG9zdENvbmZpZ3VyYXRpb24gPSBleHRIb3N0Q29uZmlndXJhdGlvbjtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlID0gbG9nU2VydmljZTtcblx0XHR0aGlzLl9leHRIb3N0VHVubmVsU2VydmljZSA9IGV4dEhvc3RUdW5uZWxTZXJ2aWNlO1xuXHRcdHRoaXMuX2V4dEhvc3RUZXJtaW5hbFNlcnZpY2UgPSBleHRIb3N0VGVybWluYWxTZXJ2aWNlO1xuXHRcdHRoaXMuX2V4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlID0gZXh0SG9zdExvY2FsaXphdGlvblNlcnZpY2U7XG5cblx0XHR0aGlzLl9tYWluVGhyZWFkV29ya3NwYWNlUHJveHkgPSB0aGlzLl9leHRIb3N0Q29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkV29ya3NwYWNlKTtcblx0XHR0aGlzLl9tYWluVGhyZWFkVGVsZW1ldHJ5UHJveHkgPSB0aGlzLl9leHRIb3N0Q29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkVGVsZW1ldHJ5KTtcblx0XHR0aGlzLl9tYWluVGhyZWFkRXh0ZW5zaW9uc1Byb3h5ID0gdGhpcy5fZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZEV4dGVuc2lvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fYWxtb3N0UmVhZHlUb1J1bkV4dGVuc2lvbnMgPSBuZXcgQmFycmllcigpO1xuXHRcdHRoaXMuX3JlYWR5VG9TdGFydEV4dGVuc2lvbkhvc3QgPSBuZXcgQmFycmllcigpO1xuXHRcdHRoaXMuX3JlYWR5VG9SdW5FeHRlbnNpb25zID0gbmV3IEJhcnJpZXIoKTtcblx0XHR0aGlzLl9lYWdlckV4dGVuc2lvbnNBY3RpdmF0ZWQgPSBuZXcgQmFycmllcigpO1xuXHRcdHRoaXMuX2FjdGl2YXRpb25FdmVudHNSZWFkZXIgPSBuZXcgU3luY2VkQWN0aXZhdGlvbkV2ZW50c1JlYWRlcih0aGlzLl9pbml0RGF0YS5leHRlbnNpb25zLmFjdGl2YXRpb25FdmVudHMpO1xuXHRcdHRoaXMuX2dsb2JhbFJlZ2lzdHJ5ID0gbmV3IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkodGhpcy5fYWN0aXZhdGlvbkV2ZW50c1JlYWRlciwgdGhpcy5faW5pdERhdGEuZXh0ZW5zaW9ucy5hbGxFeHRlbnNpb25zKTtcblx0XHRjb25zdCBteUV4dGVuc2lvbnNTZXQgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllclNldCh0aGlzLl9pbml0RGF0YS5leHRlbnNpb25zLm15RXh0ZW5zaW9ucyk7XG5cdFx0dGhpcy5fbXlSZWdpc3RyeSA9IG5ldyBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5KFxuXHRcdFx0dGhpcy5fYWN0aXZhdGlvbkV2ZW50c1JlYWRlcixcblx0XHRcdGZpbHRlckV4dGVuc2lvbnModGhpcy5fZ2xvYmFsUmVnaXN0cnksIG15RXh0ZW5zaW9uc1NldClcblx0XHQpO1xuXG5cdFx0aWYgKGlzQ0kpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQ3JlYXRpbmcgZXh0ZW5zaW9uIGhvc3Qgd2l0aCB0aGUgZm9sbG93aW5nIGdsb2JhbCBleHRlbnNpb25zOiAke3ByaW50RXh0SWRzKHRoaXMuX2dsb2JhbFJlZ2lzdHJ5KX1gKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQ3JlYXRpbmcgZXh0ZW5zaW9uIGhvc3Qgd2l0aCB0aGUgZm9sbG93aW5nIGxvY2FsIGV4dGVuc2lvbnM6ICR7cHJpbnRFeHRJZHModGhpcy5fbXlSZWdpc3RyeSl9YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc3RvcmFnZSA9IG5ldyBFeHRIb3N0U3RvcmFnZSh0aGlzLl9leHRIb3N0Q29udGV4dCwgdGhpcy5fbG9nU2VydmljZSk7XG5cdFx0dGhpcy5fc2VjcmV0U3RhdGUgPSBuZXcgRXh0SG9zdFNlY3JldFN0YXRlKHRoaXMuX2V4dEhvc3RDb250ZXh0KTtcblx0XHR0aGlzLl9zdG9yYWdlUGF0aCA9IHN0b3JhZ2VQYXRoO1xuXG5cdFx0dGhpcy5faW5zdGFTZXJ2aWNlID0gdGhpcy5fc3RvcmUuYWRkKGluc3RhU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUV4dEhvc3RTdG9yYWdlLCB0aGlzLl9zdG9yYWdlXSxcblx0XHRcdFtJRXh0SG9zdFNlY3JldFN0YXRlLCB0aGlzLl9zZWNyZXRTdGF0ZV1cblx0XHQpKSk7XG5cblx0XHR0aGlzLl9hY3RpdmF0b3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgRXh0ZW5zaW9uc0FjdGl2YXRvcihcblx0XHRcdHRoaXMuX215UmVnaXN0cnksXG5cdFx0XHR0aGlzLl9nbG9iYWxSZWdpc3RyeSxcblx0XHRcdHtcblx0XHRcdFx0b25FeHRlbnNpb25BY3RpdmF0aW9uRXJyb3I6IChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZXJyb3I6IEVycm9yLCBtaXNzaW5nRXh0ZW5zaW9uRGVwZW5kZW5jeTogTWlzc2luZ0V4dGVuc2lvbkRlcGVuZGVuY3kgfCBudWxsKTogdm9pZCA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eS4kb25FeHRlbnNpb25BY3RpdmF0aW9uRXJyb3IoZXh0ZW5zaW9uSWQsIGVycm9ycy50cmFuc2Zvcm1FcnJvckZvclNlcmlhbGl6YXRpb24oZXJyb3IpLCBtaXNzaW5nRXh0ZW5zaW9uRGVwZW5kZW5jeSk7XG5cdFx0XHRcdH0sXG5cblx0XHRcdFx0YWN0dWFsQWN0aXZhdGVFeHRlbnNpb246IGFzeW5jIChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTxBY3RpdmF0ZWRFeHRlbnNpb24+ID0+IHtcblx0XHRcdFx0XHRpZiAoRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeS5pc0hvc3RFeHRlbnNpb24oZXh0ZW5zaW9uSWQsIHRoaXMuX215UmVnaXN0cnksIHRoaXMuX2dsb2JhbFJlZ2lzdHJ5KSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eS4kYWN0aXZhdGVFeHRlbnNpb24oZXh0ZW5zaW9uSWQsIHJlYXNvbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEhvc3RFeHRlbnNpb24oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uRGVzY3JpcHRpb24gPSB0aGlzLl9teVJlZ2lzdHJ5LmdldEV4dGVuc2lvbkRlc2NyaXB0aW9uKGV4dGVuc2lvbklkKSE7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRlRXh0ZW5zaW9uKGV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGhpcy5fbG9nU2VydmljZVxuXHRcdCkpO1xuXHRcdHRoaXMuX2V4dGVuc2lvblBhdGhJbmRleCA9IG51bGw7XG5cdFx0dGhpcy5fcmVzb2x2ZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl9zdGFydGVkID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVtb3RlQ29ubmVjdGlvbkRhdGEgPSB0aGlzLl9pbml0RGF0YS5yZW1vdGUuY29ubmVjdGlvbkRhdGE7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmVtb3RlQ29ubmVjdGlvbkRhdGEoKTogSVJlbW90ZUNvbm5lY3Rpb25EYXRhIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZUNvbm5lY3Rpb25EYXRhO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblxuXHRcdFx0YXdhaXQgdGhpcy5fYmVmb3JlQWxtb3N0UmVhZHlUb1J1bkV4dGVuc2lvbnMoKTtcblx0XHRcdHRoaXMuX2FsbW9zdFJlYWR5VG9SdW5FeHRlbnNpb25zLm9wZW4oKTtcblxuXHRcdFx0YXdhaXQgdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53YWl0Rm9ySW5pdGlhbGl6ZUNhbGwoKTtcblx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvZXh0SG9zdC9yZWFkeScpO1xuXHRcdFx0dGhpcy5fcmVhZHlUb1N0YXJ0RXh0ZW5zaW9uSG9zdC5vcGVuKCk7XG5cblx0XHRcdGlmICh0aGlzLl9pbml0RGF0YS5hdXRvU3RhcnQpIHtcblx0XHRcdFx0dGhpcy5fc3RhcnRFeHRlbnNpb25Ib3N0KCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRlcnJvcnMub25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kZWFjdGl2YXRlQWxsKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3N0b3JhZ2VQYXRoLm9uV2lsbERlYWN0aXZhdGVBbGwoKTtcblxuXHRcdGxldCBhbGxQcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFsbEV4dGVuc2lvbnMgPSB0aGlzLl9teVJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpO1xuXHRcdFx0Y29uc3QgYWxsRXh0ZW5zaW9uc0lkcyA9IGFsbEV4dGVuc2lvbnMubWFwKGV4dCA9PiBleHQuaWRlbnRpZmllcik7XG5cdFx0XHRjb25zdCBhY3RpdmF0ZWRFeHRlbnNpb25zID0gYWxsRXh0ZW5zaW9uc0lkcy5maWx0ZXIoaWQgPT4gdGhpcy5pc0FjdGl2YXRlZChpZCkpO1xuXG5cdFx0XHRhbGxQcm9taXNlcyA9IGFjdGl2YXRlZEV4dGVuc2lvbnMubWFwKChleHRlbnNpb25JZCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZGVhY3RpdmF0ZShleHRlbnNpb25JZCk7XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdC8vIFRPRE86IHdyaXRlIHRvIGxvZyBvbmNlIHdlIGhhdmUgb25lXG5cdFx0fVxuXHRcdGF3YWl0IFByb21pc2UuYWxsKGFsbFByb21pc2VzKTtcblx0fVxuXG5cdHB1YmxpYyB0ZXJtaW5hdGUocmVhc29uOiBzdHJpbmcsIGNvZGU6IG51bWJlciA9IDApOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNUZXJtaW5hdGluZykge1xuXHRcdFx0Ly8gd2UgYXJlIGFscmVhZHkgc2h1dHRpbmcgZG93bi4uLlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc1Rlcm1pbmF0aW5nID0gdHJ1ZTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEV4dGVuc2lvbiBob3N0IHRlcm1pbmF0aW5nOiAke3JlYXNvbn1gKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmZsdXNoKCk7XG5cblx0XHR0aGlzLl9leHRIb3N0VGVybWluYWxTZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9hY3RpdmF0b3IuZGlzcG9zZSgpO1xuXG5cdFx0ZXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKGVycikgPT4ge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gSW52YWxpZGF0ZSBhbGwgcHJveGllc1xuXHRcdHRoaXMuX2V4dEhvc3RDb250ZXh0LmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNEZWFjdGl2YXRlZCA9IHRoaXMuX2RlYWN0aXZhdGVBbGwoKTtcblxuXHRcdC8vIEdpdmUgZXh0ZW5zaW9ucyBhdCBtb3N0IDUgc2Vjb25kcyB0byB3cmFwIHVwIGFueSBhc3luYyBkZWFjdGl2YXRlLCB0aGVuIGV4aXRcblx0XHRQcm9taXNlLnJhY2UoW3RpbWVvdXQoNTAwMCksIGV4dGVuc2lvbnNEZWFjdGl2YXRlZF0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2hvc3RVdGlscy5waWQpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb24gaG9zdCB3aXRoIHBpZCAke3RoaXMuX2hvc3RVdGlscy5waWR9IGV4aXRpbmcgd2l0aCBjb2RlICR7Y29kZX1gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgRXh0ZW5zaW9uIGhvc3QgZXhpdGluZyB3aXRoIGNvZGUgJHtjb2RlfWApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9ob3N0VXRpbHMuZXhpdChjb2RlKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBpc0FjdGl2YXRlZChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9yZWFkeVRvUnVuRXh0ZW5zaW9ucy5pc09wZW4oKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRvci5pc0FjdGl2YXRlZChleHRlbnNpb25JZCk7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRFeHRlbnNpb24oZXh0ZW5zaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZXh0ID0gYXdhaXQgdGhpcy5fbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eS4kZ2V0RXh0ZW5zaW9uKGV4dGVuc2lvbklkKTtcblx0XHRyZXR1cm4gZXh0ICYmIHtcblx0XHRcdC4uLmV4dCxcblx0XHRcdGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKGV4dC5pZGVudGlmaWVyLnZhbHVlKSxcblx0XHRcdGV4dGVuc2lvbkxvY2F0aW9uOiBVUkkucmV2aXZlKGV4dC5leHRlbnNpb25Mb2NhdGlvbilcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudDogc3RyaW5nLCBzdGFydHVwOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRvci5hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50LCBzdGFydHVwKTtcblx0fVxuXG5cdHByaXZhdGUgX2FjdGl2YXRlQnlJZChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRvci5hY3RpdmF0ZUJ5SWQoZXh0ZW5zaW9uSWQsIHJlYXNvbik7XG5cdH1cblxuXHRwdWJsaWMgYWN0aXZhdGVCeUlkV2l0aEVycm9ycyhleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRlQnlJZChleHRlbnNpb25JZCwgcmVhc29uKS50aGVuKCgpID0+IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuX2FjdGl2YXRvci5nZXRBY3RpdmF0ZWRFeHRlbnNpb24oZXh0ZW5zaW9uSWQpO1xuXHRcdFx0aWYgKGV4dGVuc2lvbi5hY3RpdmF0aW9uRmFpbGVkKSB7XG5cdFx0XHRcdC8vIGFjdGl2YXRpb24gZmFpbGVkID0+IGJ1YmJsZSB1cCB0aGUgZXJyb3IgYXMgdGhlIHByb21pc2UgcmVzdWx0XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChleHRlbnNpb24uYWN0aXZhdGlvbkZhaWxlZEVycm9yKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RXh0ZW5zaW9uUmVnaXN0cnkoKTogUHJvbWlzZTxFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlYWR5VG9SdW5FeHRlbnNpb25zLndhaXQoKS50aGVuKF8gPT4gdGhpcy5fbXlSZWdpc3RyeSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RXh0ZW5zaW9uRXhwb3J0cyhleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcik6IElFeHRlbnNpb25BUEkgfCBudWxsIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fcmVhZHlUb1J1bkV4dGVuc2lvbnMuaXNPcGVuKCkpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hY3RpdmF0b3IuZ2V0QWN0aXZhdGVkRXh0ZW5zaW9uKGV4dGVuc2lvbklkKS5leHBvcnRzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fYWN0aXZhdG9yLmdldEFjdGl2YXRlZEV4dGVuc2lvbihleHRlbnNpb25JZCkuZXhwb3J0cztcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQXBwbGllcyByZWFscGF0aCB0byBmaWxlLXVyaXMgYW5kIHJldHVybnMgYWxsIG90aGVycyB1cmlzIHVubW9kaWZpZWQuXG5cdCAqIFRoZSByZWFsIHBhdGggaXMgY2FjaGVkIGZvciB0aGUgbGlmZXRpbWUgb2YgdGhlIGV4dGVuc2lvbiBob3N0LlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfcmVhbFBhdGhFeHRlbnNpb25VcmkodXJpOiBVUkkpOiBQcm9taXNlPFVSST4ge1xuXHRcdGlmICh1cmkuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgJiYgdGhpcy5faG9zdFV0aWxzLmZzUmVhbHBhdGgpIHtcblx0XHRcdGNvbnN0IGZzUGF0aCA9IHVyaS5mc1BhdGg7XG5cdFx0XHRpZiAoIXRoaXMuX3JlYWxQYXRoQ2FjaGUuaGFzKGZzUGF0aCkpIHtcblx0XHRcdFx0dGhpcy5fcmVhbFBhdGhDYWNoZS5zZXQoZnNQYXRoLCB0aGlzLl9ob3N0VXRpbHMuZnNSZWFscGF0aChmc1BhdGgpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlYWxwYXRoVmFsdWUgPSBhd2FpdCB0aGlzLl9yZWFsUGF0aENhY2hlLmdldChmc1BhdGgpITtcblx0XHRcdHJldHVybiBVUkkuZmlsZShyZWFscGF0aFZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVyaTtcblx0fVxuXG5cdC8vIGNyZWF0ZSB0cmllIHRvIGVuYWJsZSBmYXN0ICdmaWxlbmFtZSAtPiBleHRlbnNpb24gaWQnIGxvb2sgdXBcblx0cHVibGljIGFzeW5jIGdldEV4dGVuc2lvblBhdGhJbmRleCgpOiBQcm9taXNlPEV4dGVuc2lvblBhdGhzPiB7XG5cdFx0aWYgKCF0aGlzLl9leHRlbnNpb25QYXRoSW5kZXgpIHtcblx0XHRcdHRoaXMuX2V4dGVuc2lvblBhdGhJbmRleCA9IHRoaXMuX2NyZWF0ZUV4dGVuc2lvblBhdGhJbmRleCh0aGlzLl9teVJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKS50aGVuKChzZWFyY2hUcmVlKSA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgRXh0ZW5zaW9uUGF0aHMoc2VhcmNoVHJlZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2V4dGVuc2lvblBhdGhJbmRleDtcblx0fVxuXG5cdC8qKlxuXHQgKiBjcmVhdGUgdHJpZSB0byBlbmFibGUgZmFzdCAnZmlsZW5hbWUgLT4gZXh0ZW5zaW9uIGlkJyBsb29rIHVwXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVFeHRlbnNpb25QYXRoSW5kZXgoZXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10pOiBQcm9taXNlPFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uPj4ge1xuXHRcdGNvbnN0IHRzdCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXM8SUV4dGVuc2lvbkRlc2NyaXB0aW9uPihrZXkgPT4ge1xuXHRcdFx0Ly8gdXNpbmcgdGhlIGRlZmF1bHQvYmlhc2VkIGV4dFVyaS11dGlsIGJlY2F1c2UgdGhlIElFeHRIb3N0RmlsZVN5c3RlbUluZm8tc2VydmljZVxuXHRcdFx0Ly8gaXNuJ3QgcmVhZHkgdG8gYmUgdXNlZCB5ZXQsIGUuZyB0aGUga25vd2xlZGdlIGFib3V0IGBmaWxlYCBwcm90b2NvbCBhbmQgb3RoZXJzXG5cdFx0XHQvLyBjb21lcyBpbiB3aGlsZSB0aGlzIGNvZGUgcnVuc1xuXHRcdFx0cmV0dXJuIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLmlnbm9yZVBhdGhDYXNpbmcoa2V5KTtcblx0XHR9KTtcblx0XHQvLyBjb25zdCB0c3QgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPElFeHRlbnNpb25EZXNjcmlwdGlvbj4oa2V5ID0+IHRydWUpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGV4dGVuc2lvbnMubWFwKGFzeW5jIChleHQpID0+IHtcblx0XHRcdGlmICh0aGlzLl9nZXRFbnRyeVBvaW50KGV4dCkpIHtcblx0XHRcdFx0Y29uc3QgdXJpID0gYXdhaXQgdGhpcy5fcmVhbFBhdGhFeHRlbnNpb25VcmkoZXh0LmV4dGVuc2lvbkxvY2F0aW9uKTtcblx0XHRcdFx0dHN0LnNldCh1cmksIGV4dCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHJldHVybiB0c3Q7XG5cdH1cblxuXHRwcml2YXRlIF9kZWFjdGl2YXRlKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHJlc3VsdCA9IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXG5cdFx0aWYgKCF0aGlzLl9yZWFkeVRvUnVuRXh0ZW5zaW9ucy5pc09wZW4oKSkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2FjdGl2YXRvci5pc0FjdGl2YXRlZChleHRlbnNpb25JZCkpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gdGhpcy5fYWN0aXZhdG9yLmdldEFjdGl2YXRlZEV4dGVuc2lvbihleHRlbnNpb25JZCk7XG5cdFx0aWYgKCFleHRlbnNpb24pIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gY2FsbCBkZWFjdGl2YXRlIGlmIGF2YWlsYWJsZVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbi5tb2R1bGUuZGVhY3RpdmF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRyZXN1bHQgPSBQcm9taXNlLnJlc29sdmUoZXh0ZW5zaW9uLm1vZHVsZS5kZWFjdGl2YXRlKCkpLnRoZW4odW5kZWZpbmVkLCAoZXJyKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGRlYWN0aXZhdGluZyB0aGUgZXh0ZW5zaW9uICcke2V4dGVuc2lvbklkLnZhbHVlfSc6YCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXG5cdFx0Ly8gY2xlYW4gdXAgc3Vic2NyaXB0aW9uc1xuXHRcdHRyeSB7XG5cdFx0XHRleHRlbnNpb24uZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGRpc3Bvc2luZyB0aGUgc3Vic2NyaXB0aW9ucyBmb3IgZXh0ZW5zaW9uICcke2V4dGVuc2lvbklkLnZhbHVlfSc6YCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8vIC0tLSBpbXBsXG5cblx0cHJpdmF0ZSBhc3luYyBfYWN0aXZhdGVFeHRlbnNpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTxBY3RpdmF0ZWRFeHRlbnNpb24+IHtcblx0XHRpZiAoIXRoaXMuX2luaXREYXRhLnJlbW90ZS5pc1JlbW90ZSkge1xuXHRcdFx0Ly8gbG9jYWwgZXh0ZW5zaW9uIGhvc3QgcHJvY2Vzc1xuXHRcdFx0YXdhaXQgdGhpcy5fbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eS4kb25XaWxsQWN0aXZhdGVFeHRlbnNpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHJlbW90ZSBleHRlbnNpb24gaG9zdCBwcm9jZXNzXG5cdFx0XHQvLyBkbyBub3Qgd2FpdCBmb3IgcmVuZGVyZXIgY29uZmlybWF0aW9uXG5cdFx0XHR0aGlzLl9tYWluVGhyZWFkRXh0ZW5zaW9uc1Byb3h5LiRvbldpbGxBY3RpdmF0ZUV4dGVuc2lvbihleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2RvQWN0aXZhdGVFeHRlbnNpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb24sIHJlYXNvbikudGhlbigoYWN0aXZhdGVkRXh0ZW5zaW9uKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmF0aW9uVGltZXMgPSBhY3RpdmF0ZWRFeHRlbnNpb24uYWN0aXZhdGlvblRpbWVzO1xuXHRcdFx0dGhpcy5fbWFpblRocmVhZEV4dGVuc2lvbnNQcm94eS4kb25EaWRBY3RpdmF0ZUV4dGVuc2lvbihleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBhY3RpdmF0aW9uVGltZXMuY29kZUxvYWRpbmdUaW1lLCBhY3RpdmF0aW9uVGltZXMuYWN0aXZhdGVDYWxsVGltZSwgYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRlUmVzb2x2ZWRUaW1lLCByZWFzb24pO1xuXHRcdFx0dGhpcy5fbG9nRXh0ZW5zaW9uQWN0aXZhdGlvblRpbWVzKGV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb24sICdzdWNjZXNzJywgYWN0aXZhdGlvblRpbWVzKTtcblx0XHRcdHJldHVybiBhY3RpdmF0ZWRFeHRlbnNpb247XG5cdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0dGhpcy5fbG9nRXh0ZW5zaW9uQWN0aXZhdGlvblRpbWVzKGV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb24sICdmYWlsdXJlJyk7XG5cdFx0XHR0aHJvdyBlcnI7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9sb2dFeHRlbnNpb25BY3RpdmF0aW9uVGltZXMoZXh0ZW5zaW9uRGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uLCBvdXRjb21lOiBzdHJpbmcsIGFjdGl2YXRpb25UaW1lcz86IEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lcykge1xuXHRcdGNvbnN0IGV2ZW50ID0gZ2V0VGVsZW1ldHJ5QWN0aXZhdGlvbkV2ZW50KGV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb24pO1xuXHRcdHR5cGUgRXh0ZW5zaW9uQWN0aXZhdGlvblRpbWVzQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ2pyaWVrZW4nO1xuXHRcdFx0Y29tbWVudDogJ1RpbWVzdGFtcHMgZm9yIGV4dGVuc2lvbiBhY3RpdmF0aW9uJztcblx0XHRcdG91dGNvbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdEaWQgZXh0ZW5zaW9uIGFjdGl2YXRpb24gc3VjY2VlZCBvciBmYWlsJyB9O1xuXHRcdH0gJiBUZWxlbWV0cnlBY3RpdmF0aW9uRXZlbnRGcmFnbWVudCAmIEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lc0ZyYWdtZW50O1xuXG5cdFx0dHlwZSBFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNFdmVudCA9IHtcblx0XHRcdG91dGNvbWU6IHN0cmluZztcblx0XHR9ICYgQWN0aXZhdGlvblRpbWVzRXZlbnQgJiBUZWxlbWV0cnlBY3RpdmF0aW9uRXZlbnQ7XG5cblx0XHR0eXBlIEFjdGl2YXRpb25UaW1lc0V2ZW50ID0ge1xuXHRcdFx0c3RhcnR1cD86IGJvb2xlYW47XG5cdFx0XHRjb2RlTG9hZGluZ1RpbWU/OiBudW1iZXI7XG5cdFx0XHRhY3RpdmF0ZUNhbGxUaW1lPzogbnVtYmVyO1xuXHRcdFx0YWN0aXZhdGVSZXNvbHZlZFRpbWU/OiBudW1iZXI7XG5cdFx0fTtcblxuXHRcdHRoaXMuX21haW5UaHJlYWRUZWxlbWV0cnlQcm94eS4kcHVibGljTG9nMjxFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNFdmVudCwgRXh0ZW5zaW9uQWN0aXZhdGlvblRpbWVzQ2xhc3NpZmljYXRpb24+KCdleHRlbnNpb25BY3RpdmF0aW9uVGltZXMnLCB7XG5cdFx0XHQuLi5ldmVudCxcblx0XHRcdC4uLihhY3RpdmF0aW9uVGltZXMgfHwge30pLFxuXHRcdFx0b3V0Y29tZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZG9BY3RpdmF0ZUV4dGVuc2lvbihleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb246IEV4dGVuc2lvbkFjdGl2YXRpb25SZWFzb24pOiBQcm9taXNlPEFjdGl2YXRlZEV4dGVuc2lvbj4ge1xuXHRcdGNvbnN0IGV2ZW50ID0gZ2V0VGVsZW1ldHJ5QWN0aXZhdGlvbkV2ZW50KGV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWFzb24pO1xuXHRcdHR5cGUgQWN0aXZhdGVQbHVnaW5DbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnanJpZWtlbic7XG5cdFx0XHRjb21tZW50OiAnRGF0YSBhYm91dCBob3cvd2h5IGFuIGV4dGVuc2lvbiB3YXMgYWN0aXZhdGVkJztcblx0XHR9ICYgVGVsZW1ldHJ5QWN0aXZhdGlvbkV2ZW50RnJhZ21lbnQ7XG5cdFx0dGhpcy5fbWFpblRocmVhZFRlbGVtZXRyeVByb3h5LiRwdWJsaWNMb2cyPFRlbGVtZXRyeUFjdGl2YXRpb25FdmVudCwgQWN0aXZhdGVQbHVnaW5DbGFzc2lmaWNhdGlvbj4oJ2FjdGl2YXRlUGx1Z2luJywgZXZlbnQpO1xuXHRcdGNvbnN0IGVudHJ5UG9pbnQgPSB0aGlzLl9nZXRFbnRyeVBvaW50KGV4dGVuc2lvbkRlc2NyaXB0aW9uKTtcblx0XHRpZiAoIWVudHJ5UG9pbnQpIHtcblx0XHRcdC8vIFRyZWF0IHRoZSBleHRlbnNpb24gYXMgYmVpbmcgZW1wdHkgPT4gTk9UIEFOIEVSUk9SIENBU0Vcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEVtcHR5RXh0ZW5zaW9uKEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lcy5OT05FKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb25TZXJ2aWNlI19kb0FjdGl2YXRlRXh0ZW5zaW9uICR7ZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0sIHN0YXJ0dXA6ICR7cmVhc29uLnN0YXJ0dXB9LCBhY3RpdmF0aW9uRXZlbnQ6ICcke3JlYXNvbi5hY3RpdmF0aW9uRXZlbnR9JyR7ZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSAhPT0gcmVhc29uLmV4dGVuc2lvbklkLnZhbHVlID8gYCwgcm9vdCBjYXVzZTogJHtyZWFzb24uZXh0ZW5zaW9uSWQudmFsdWV9YCA6IGBgfWApO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZmx1c2goKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbkludGVybmFsU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7IC8vIGRpc3Bvc2FibGVzIHRoYXQgZm9sbG93IHRoZSBleHRlbnNpb24gbGlmZWN5Y2xlXG5cdFx0Y29uc3QgYWN0aXZhdGlvblRpbWVzQnVpbGRlciA9IG5ldyBFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNCdWlsZGVyKHJlYXNvbi5zdGFydHVwKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy5fbG9hZENvbW1vbkpTTW9kdWxlPElFeHRlbnNpb25Nb2R1bGU+KGV4dGVuc2lvbkRlc2NyaXB0aW9uLCBqb2luUGF0aChleHRlbnNpb25EZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbiwgZW50cnlQb2ludCksIGFjdGl2YXRpb25UaW1lc0J1aWxkZXIpLFxuXHRcdFx0dGhpcy5fbG9hZEV4dGVuc2lvbkNvbnRleHQoZXh0ZW5zaW9uRGVzY3JpcHRpb24sIGV4dGVuc2lvbkludGVybmFsU3RvcmUpXG5cdFx0XSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS9leHRIb3N0L3dpbGxBY3RpdmF0ZUV4dGVuc2lvbi8ke2V4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9YCk7XG5cdFx0XHRyZXR1cm4gQWJzdHJhY3RFeHRIb3N0RXh0ZW5zaW9uU2VydmljZS5fY2FsbEFjdGl2YXRlKHRoaXMuX2xvZ1NlcnZpY2UsIGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIHZhbHVlc1swXSwgdmFsdWVzWzFdLCBleHRlbnNpb25JbnRlcm5hbFN0b3JlLCBhY3RpdmF0aW9uVGltZXNCdWlsZGVyKTtcblx0XHR9KS50aGVuKChhY3RpdmF0ZWRFeHRlbnNpb24pID0+IHtcblx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZXh0SG9zdC9kaWRBY3RpdmF0ZUV4dGVuc2lvbi8ke2V4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9YCk7XG5cdFx0XHRyZXR1cm4gYWN0aXZhdGVkRXh0ZW5zaW9uO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9hZEV4dGVuc2lvbkNvbnRleHQoZXh0ZW5zaW9uRGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgZXh0ZW5zaW9uSW50ZXJuYWxTdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTx2c2NvZGUuRXh0ZW5zaW9uQ29udGV4dD4ge1xuXG5cdFx0Y29uc3QgbGFuZ3VhZ2VNb2RlbEFjY2Vzc0luZm9ybWF0aW9uID0gdGhpcy5fZXh0SG9zdExhbmd1YWdlTW9kZWxzLmNyZWF0ZUxhbmd1YWdlTW9kZWxBY2Nlc3NJbmZvcm1hdGlvbihleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0Y29uc3QgZ2xvYmFsU3RhdGUgPSBleHRlbnNpb25JbnRlcm5hbFN0b3JlLmFkZChuZXcgRXh0ZW5zaW9uR2xvYmFsTWVtZW50byhleHRlbnNpb25EZXNjcmlwdGlvbiwgdGhpcy5fc3RvcmFnZSkpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVN0YXRlID0gZXh0ZW5zaW9uSW50ZXJuYWxTdG9yZS5hZGQobmV3IEV4dGVuc2lvbk1lbWVudG8oZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSwgZmFsc2UsIHRoaXMuX3N0b3JhZ2UpKTtcblx0XHRjb25zdCBzZWNyZXRzID0gZXh0ZW5zaW9uSW50ZXJuYWxTdG9yZS5hZGQobmV3IEV4dGVuc2lvblNlY3JldHMoZXh0ZW5zaW9uRGVzY3JpcHRpb24sIHRoaXMuX3NlY3JldFN0YXRlKSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uTW9kZSA9IGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlzVW5kZXJEZXZlbG9wbWVudFxuXHRcdFx0PyAodGhpcy5faW5pdERhdGEuZW52aXJvbm1lbnQuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSA/IEV4dGVuc2lvbk1vZGUuVGVzdCA6IEV4dGVuc2lvbk1vZGUuRGV2ZWxvcG1lbnQpXG5cdFx0XHQ6IEV4dGVuc2lvbk1vZGUuUHJvZHVjdGlvbjtcblx0XHRjb25zdCBleHRlbnNpb25LaW5kID0gdGhpcy5faW5pdERhdGEucmVtb3RlLmlzUmVtb3RlID8gRXh0ZW5zaW9uS2luZC5Xb3Jrc3BhY2UgOiBFeHRlbnNpb25LaW5kLlVJO1xuXG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgRXh0ZW5zaW9uU2VydmljZSNsb2FkRXh0ZW5zaW9uQ29udGV4dCAke2V4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9YCk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW1xuXHRcdFx0Z2xvYmFsU3RhdGUud2hlblJlYWR5LFxuXHRcdFx0d29ya3NwYWNlU3RhdGUud2hlblJlYWR5LFxuXHRcdFx0dGhpcy5fc3RvcmFnZVBhdGgud2hlblJlYWR5XG5cdFx0XSkudGhlbigoKSA9PiB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGxldCBleHRlbnNpb246IHZzY29kZS5FeHRlbnNpb248YW55PiB8IHVuZGVmaW5lZDtcblxuXHRcdFx0bGV0IG1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w6IHZzY29kZS5NZXNzYWdlUGFzc2luZ1Byb3RvY29sIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgbWVzc2FnZVBvcnQgPSBpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb25EZXNjcmlwdGlvbiwgJ2lwYycpXG5cdFx0XHRcdD8gdGhpcy5faW5pdERhdGEubWVzc2FnZVBvcnRzPy5nZXQoRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyKSlcblx0XHRcdFx0OiB1bmRlZmluZWQ7XG5cblx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplPHZzY29kZS5FeHRlbnNpb25Db250ZXh0Pih7XG5cdFx0XHRcdGdsb2JhbFN0YXRlLFxuXHRcdFx0XHR3b3Jrc3BhY2VTdGF0ZSxcblx0XHRcdFx0c2VjcmV0cyxcblx0XHRcdFx0c3Vic2NyaXB0aW9uczogW10sXG5cdFx0XHRcdGdldCBsYW5ndWFnZU1vZGVsQWNjZXNzSW5mb3JtYXRpb24oKSB7IHJldHVybiBsYW5ndWFnZU1vZGVsQWNjZXNzSW5mb3JtYXRpb247IH0sXG5cdFx0XHRcdGdldCBleHRlbnNpb25VcmkoKSB7IHJldHVybiBleHRlbnNpb25EZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbjsgfSxcblx0XHRcdFx0Z2V0IGV4dGVuc2lvblBhdGgoKSB7IHJldHVybiBleHRlbnNpb25EZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbi5mc1BhdGg7IH0sXG5cdFx0XHRcdGFzQWJzb2x1dGVQYXRoKHJlbGF0aXZlUGF0aDogc3RyaW5nKSB7IHJldHVybiBwYXRoLmpvaW4oZXh0ZW5zaW9uRGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24uZnNQYXRoLCByZWxhdGl2ZVBhdGgpOyB9LFxuXHRcdFx0XHRnZXQgc3RvcmFnZVBhdGgoKSB7IHJldHVybiB0aGF0Ll9zdG9yYWdlUGF0aC53b3Jrc3BhY2VWYWx1ZShleHRlbnNpb25EZXNjcmlwdGlvbik/LmZzUGF0aDsgfSxcblx0XHRcdFx0Z2V0IGdsb2JhbFN0b3JhZ2VQYXRoKCkgeyByZXR1cm4gdGhhdC5fc3RvcmFnZVBhdGguZ2xvYmFsVmFsdWUoZXh0ZW5zaW9uRGVzY3JpcHRpb24pLmZzUGF0aDsgfSxcblx0XHRcdFx0Z2V0IGxvZ1BhdGgoKSB7IHJldHVybiBwYXRoLmpvaW4odGhhdC5faW5pdERhdGEubG9nc0xvY2F0aW9uLmZzUGF0aCwgZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSk7IH0sXG5cdFx0XHRcdGdldCBsb2dVcmkoKSB7IHJldHVybiBVUkkuam9pblBhdGgodGhhdC5faW5pdERhdGEubG9nc0xvY2F0aW9uLCBleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlKTsgfSxcblx0XHRcdFx0Z2V0IHN0b3JhZ2VVcmkoKSB7IHJldHVybiB0aGF0Ll9zdG9yYWdlUGF0aC53b3Jrc3BhY2VWYWx1ZShleHRlbnNpb25EZXNjcmlwdGlvbik7IH0sXG5cdFx0XHRcdGdldCBnbG9iYWxTdG9yYWdlVXJpKCkgeyByZXR1cm4gdGhhdC5fc3RvcmFnZVBhdGguZ2xvYmFsVmFsdWUoZXh0ZW5zaW9uRGVzY3JpcHRpb24pOyB9LFxuXHRcdFx0XHRnZXQgZXh0ZW5zaW9uTW9kZSgpIHsgcmV0dXJuIGV4dGVuc2lvbk1vZGU7IH0sXG5cdFx0XHRcdGdldCBleHRlbnNpb24oKSB7XG5cdFx0XHRcdFx0aWYgKGV4dGVuc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb24gPSBuZXcgRXh0ZW5zaW9uKHRoYXQsIGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbkRlc2NyaXB0aW9uLCBleHRlbnNpb25LaW5kLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBleHRlbnNpb247XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBleHRlbnNpb25SdW50aW1lKCkge1xuXHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbkRlc2NyaXB0aW9uLCAnZXh0ZW5zaW9uUnVudGltZScpO1xuXHRcdFx0XHRcdHJldHVybiB0aGF0LmV4dGVuc2lvblJ1bnRpbWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBlbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbigpIHsgcmV0dXJuIHRoYXQuX2V4dEhvc3RUZXJtaW5hbFNlcnZpY2UuZ2V0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb24pOyB9LFxuXHRcdFx0XHRnZXQgbWVzc2FnZVBhc3NpbmdQcm90b2NvbCgpIHtcblx0XHRcdFx0XHRpZiAoIW1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wpIHtcblx0XHRcdFx0XHRcdGlmICghbWVzc2FnZVBvcnQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3Qgb25EaWRSZWNlaXZlTWVzc2FnZSA9IEV2ZW50LmJ1ZmZlcihFdmVudC5mcm9tRE9NRXZlbnRFbWl0dGVyKG1lc3NhZ2VQb3J0LCAnbWVzc2FnZScsIGUgPT4gZS5kYXRhKSk7XG5cdFx0XHRcdFx0XHRtZXNzYWdlUG9ydC5zdGFydCgpO1xuXHRcdFx0XHRcdFx0bWVzc2FnZVBhc3NpbmdQcm90b2NvbCA9IHtcblx0XHRcdFx0XHRcdFx0b25EaWRSZWNlaXZlTWVzc2FnZSxcblx0XHRcdFx0XHRcdFx0cG9zdE1lc3NhZ2U6IG1lc3NhZ2VQb3J0LnBvc3RNZXNzYWdlLmJpbmQobWVzc2FnZVBvcnQpIGFzIGFueVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbWVzc2FnZVBhc3NpbmdQcm90b2NvbDtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY2FsbEFjdGl2YXRlKGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLCBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZXh0ZW5zaW9uTW9kdWxlOiBJRXh0ZW5zaW9uTW9kdWxlLCBjb250ZXh0OiB2c2NvZGUuRXh0ZW5zaW9uQ29udGV4dCwgZXh0ZW5zaW9uSW50ZXJuYWxTdG9yZTogSURpc3Bvc2FibGUsIGFjdGl2YXRpb25UaW1lc0J1aWxkZXI6IEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lc0J1aWxkZXIpOiBQcm9taXNlPEFjdGl2YXRlZEV4dGVuc2lvbj4ge1xuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgZXh0ZW5zaW9uJ3Mgc3VyZmFjZSBpcyBub3QgdW5kZWZpbmVkXG5cdFx0ZXh0ZW5zaW9uTW9kdWxlID0gZXh0ZW5zaW9uTW9kdWxlIHx8IHtcblx0XHRcdGFjdGl2YXRlOiB1bmRlZmluZWQsXG5cdFx0XHRkZWFjdGl2YXRlOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuX2NhbGxBY3RpdmF0ZU9wdGlvbmFsKGxvZ1NlcnZpY2UsIGV4dGVuc2lvbklkLCBleHRlbnNpb25Nb2R1bGUsIGNvbnRleHQsIGFjdGl2YXRpb25UaW1lc0J1aWxkZXIpLnRoZW4oKGV4dGVuc2lvbkV4cG9ydHMpID0+IHtcblx0XHRcdHJldHVybiBuZXcgQWN0aXZhdGVkRXh0ZW5zaW9uKGZhbHNlLCBudWxsLCBhY3RpdmF0aW9uVGltZXNCdWlsZGVyLmJ1aWxkKCksIGV4dGVuc2lvbk1vZHVsZSwgZXh0ZW5zaW9uRXhwb3J0cywgdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0ZXh0ZW5zaW9uSW50ZXJuYWxTdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRcdGRpc3Bvc2UoY29udGV4dC5zdWJzY3JpcHRpb25zKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jYWxsQWN0aXZhdGVPcHRpb25hbChsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGV4dGVuc2lvbk1vZHVsZTogSUV4dGVuc2lvbk1vZHVsZSwgY29udGV4dDogdnNjb2RlLkV4dGVuc2lvbkNvbnRleHQsIGFjdGl2YXRpb25UaW1lc0J1aWxkZXI6IEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lc0J1aWxkZXIpOiBQcm9taXNlPElFeHRlbnNpb25BUEk+IHtcblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbk1vZHVsZS5hY3RpdmF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YWN0aXZhdGlvblRpbWVzQnVpbGRlci5hY3RpdmF0ZUNhbGxTdGFydCgpO1xuXHRcdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKGBFeHRlbnNpb25TZXJ2aWNlI19jYWxsQWN0aXZhdGVPcHRpb25hbCAke2V4dGVuc2lvbklkLnZhbHVlfWApO1xuXHRcdFx0XHRjb25zdCBzY29wZSA9IHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnID8gZ2xvYmFsIDogc2VsZjsgLy8gYGdsb2JhbGAgaXMgbm9kZWpzIHdoaWxlIGBzZWxmYCBpcyBmb3Igd29ya2Vyc1xuXHRcdFx0XHRjb25zdCBhY3RpdmF0ZVJlc3VsdDogUHJvbWlzZTxJRXh0ZW5zaW9uQVBJPiA9IGV4dGVuc2lvbk1vZHVsZS5hY3RpdmF0ZS5hcHBseShzY29wZSwgW2NvbnRleHRdKTtcblx0XHRcdFx0YWN0aXZhdGlvblRpbWVzQnVpbGRlci5hY3RpdmF0ZUNhbGxTdG9wKCk7XG5cblx0XHRcdFx0YWN0aXZhdGlvblRpbWVzQnVpbGRlci5hY3RpdmF0ZVJlc29sdmVTdGFydCgpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGFjdGl2YXRlUmVzdWx0KS50aGVuKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdGFjdGl2YXRpb25UaW1lc0J1aWxkZXIuYWN0aXZhdGVSZXNvbHZlU3RvcCgpO1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIE5vIGFjdGl2YXRlIGZvdW5kID0+IHRoZSBtb2R1bGUgaXMgdGhlIGV4dGVuc2lvbidzIGV4cG9ydHNcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmU8SUV4dGVuc2lvbkFQST4oZXh0ZW5zaW9uTW9kdWxlKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLSBlYWdlciBhY3RpdmF0aW9uXG5cblx0cHJpdmF0ZSBfYWN0aXZhdGVPbmVTdGFydHVwRmluaXNoZWQoZGVzYzogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2FjdGl2YXRlQnlJZChkZXNjLmlkZW50aWZpZXIsIHtcblx0XHRcdHN0YXJ0dXA6IGZhbHNlLFxuXHRcdFx0ZXh0ZW5zaW9uSWQ6IGRlc2MuaWRlbnRpZmllcixcblx0XHRcdGFjdGl2YXRpb25FdmVudDogYWN0aXZhdGlvbkV2ZW50XG5cdFx0fSkudGhlbih1bmRlZmluZWQsIChlcnIpID0+IHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2FjdGl2YXRlQWxsU3RhcnR1cEZpbmlzaGVkRGVmZXJyZWQoZXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIHN0YXJ0OiBudW1iZXIgPSAwKTogdm9pZCB7XG5cdFx0Y29uc3QgdGltZUJ1ZGdldCA9IDUwOyAvLyA1MCBtaWxsaXNlY29uZHNcblx0XHRjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0c2V0VGltZW91dDAoKCkgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZXh0ZW5zaW9ucy5sZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjb25zdCBkZXNjID0gZXh0ZW5zaW9uc1tpXTtcblx0XHRcdFx0Zm9yIChjb25zdCBhY3RpdmF0aW9uRXZlbnQgb2YgKGRlc2MuYWN0aXZhdGlvbkV2ZW50cyA/PyBbXSkpIHtcblx0XHRcdFx0XHRpZiAoYWN0aXZhdGlvbkV2ZW50ID09PSAnb25TdGFydHVwRmluaXNoZWQnKSB7XG5cdFx0XHRcdFx0XHRpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA+IHRpbWVCdWRnZXQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gdGltZSBidWRnZXQgZm9yIGN1cnJlbnQgdGFzayBoYXMgYmVlbiBleGNlZWRlZFxuXHRcdFx0XHRcdFx0XHQvLyBzZXQgYSBuZXcgdGFzayB0byBhY3RpdmF0ZSBjdXJyZW50IGFuZCByZW1haW5pbmcgZXh0ZW5zaW9uc1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9hY3RpdmF0ZUFsbFN0YXJ0dXBGaW5pc2hlZERlZmVycmVkKGV4dGVuc2lvbnMsIGkpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2FjdGl2YXRlT25lU3RhcnR1cEZpbmlzaGVkKGRlc2MsIGFjdGl2YXRpb25FdmVudCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9hY3RpdmF0ZUFsbFN0YXJ0dXBGaW5pc2hlZCgpOiB2b2lkIHtcblx0XHQvLyBzdGFydHVwIGlzIGNvbnNpZGVyZWQgZmluaXNoZWRcblx0XHR0aGlzLl9tYWluVGhyZWFkRXh0ZW5zaW9uc1Byb3h5LiRzZXRQZXJmb3JtYW5jZU1hcmtzKHBlcmZvcm1hbmNlLmdldE1hcmtzKCkpO1xuXG5cdFx0dGhpcy5fZXh0SG9zdENvbmZpZ3VyYXRpb24uZ2V0Q29uZmlnUHJvdmlkZXIoKS50aGVuKChjb25maWdQcm92aWRlcikgPT4ge1xuXHRcdFx0Y29uc3Qgc2hvdWxkRGVmZXJBY3RpdmF0aW9uID0gY29uZmlnUHJvdmlkZXIuZ2V0Q29uZmlndXJhdGlvbignZXh0ZW5zaW9ucy5leHBlcmltZW50YWwnKS5nZXQ8Ym9vbGVhbj4oJ2RlZmVycmVkU3RhcnR1cEZpbmlzaGVkQWN0aXZhdGlvbicpO1xuXHRcdFx0Y29uc3QgYWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zID0gdGhpcy5fbXlSZWdpc3RyeS5nZXRBbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMoKTtcblx0XHRcdGlmIChzaG91bGREZWZlckFjdGl2YXRpb24pIHtcblx0XHRcdFx0dGhpcy5fYWN0aXZhdGVBbGxTdGFydHVwRmluaXNoZWREZWZlcnJlZChhbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChjb25zdCBkZXNjIG9mIGFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucykge1xuXHRcdFx0XHRcdGlmIChkZXNjLmFjdGl2YXRpb25FdmVudHMpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgYWN0aXZhdGlvbkV2ZW50IG9mIGRlc2MuYWN0aXZhdGlvbkV2ZW50cykge1xuXHRcdFx0XHRcdFx0XHRpZiAoYWN0aXZhdGlvbkV2ZW50ID09PSAnb25TdGFydHVwRmluaXNoZWQnKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fYWN0aXZhdGVPbmVTdGFydHVwRmluaXNoZWQoZGVzYywgYWN0aXZhdGlvbkV2ZW50KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Ly8gSGFuZGxlIFwiZWFnZXJcIiBhY3RpdmF0aW9uIGV4dGVuc2lvbnNcblx0cHJpdmF0ZSBfaGFuZGxlRWFnZXJFeHRlbnNpb25zKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHN0YXJBY3RpdmF0aW9uID0gdGhpcy5fYWN0aXZhdGVCeUV2ZW50KCcqJywgdHJ1ZSkudGhlbih1bmRlZmluZWQsIChlcnIpID0+IHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2V4dEhvc3RXb3Jrc3BhY2Uub25EaWRDaGFuZ2VXb3Jrc3BhY2UoKGUpID0+IHRoaXMuX2hhbmRsZVdvcmtzcGFjZUNvbnRhaW5zRWFnZXJFeHRlbnNpb25zKGUuYWRkZWQpKSk7XG5cdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMuX2V4dEhvc3RXb3Jrc3BhY2Uud29ya3NwYWNlID8gdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2UuZm9sZGVycyA6IFtdO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbnRhaW5zQWN0aXZhdGlvbiA9IHRoaXMuX2hhbmRsZVdvcmtzcGFjZUNvbnRhaW5zRWFnZXJFeHRlbnNpb25zKGZvbGRlcnMpO1xuXHRcdGNvbnN0IHJlbW90ZVJlc29sdmVyQWN0aXZhdGlvbiA9IHRoaXMuX2hhbmRsZVJlbW90ZVJlc29sdmVyRWFnZXJFeHRlbnNpb25zKCk7XG5cdFx0Y29uc3QgZWFnZXJFeHRlbnNpb25zQWN0aXZhdGlvbiA9IFByb21pc2UuYWxsKFtyZW1vdGVSZXNvbHZlckFjdGl2YXRpb24sIHN0YXJBY3RpdmF0aW9uLCB3b3Jrc3BhY2VDb250YWluc0FjdGl2YXRpb25dKS50aGVuKCgpID0+IHsgfSk7XG5cblx0XHRQcm9taXNlLnJhY2UoW2VhZ2VyRXh0ZW5zaW9uc0FjdGl2YXRpb24sIHRpbWVvdXQoMTAwMDApXSkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZUFsbFN0YXJ0dXBGaW5pc2hlZCgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGVhZ2VyRXh0ZW5zaW9uc0FjdGl2YXRpb247XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVXb3Jrc3BhY2VDb250YWluc0VhZ2VyRXh0ZW5zaW9ucyhmb2xkZXJzOiBSZWFkb25seUFycmF5PHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXI+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGZvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKFxuXHRcdFx0dGhpcy5fbXlSZWdpc3RyeS5nZXRBbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMoKS5tYXAoKGRlc2MpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2hhbmRsZVdvcmtzcGFjZUNvbnRhaW5zRWFnZXJFeHRlbnNpb24oZm9sZGVycywgZGVzYyk7XG5cdFx0XHR9KVxuXHRcdCkudGhlbigoKSA9PiB7IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlV29ya3NwYWNlQ29udGFpbnNFYWdlckV4dGVuc2lvbihmb2xkZXJzOiBSZWFkb25seUFycmF5PHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXI+LCBkZXNjOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pc0FjdGl2YXRlZChkZXNjLmlkZW50aWZpZXIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9jYWxXaXRoUmVtb3RlID0gIXRoaXMuX2luaXREYXRhLnJlbW90ZS5pc1JlbW90ZSAmJiAhIXRoaXMuX2luaXREYXRhLnJlbW90ZS5hdXRob3JpdHk7XG5cdFx0Y29uc3QgaG9zdDogSUV4dGVuc2lvbkFjdGl2YXRpb25Ib3N0ID0ge1xuXHRcdFx0bG9nU2VydmljZTogdGhpcy5fbG9nU2VydmljZSxcblx0XHRcdGZvbGRlcnM6IGZvbGRlcnMubWFwKGZvbGRlciA9PiBmb2xkZXIudXJpKSxcblx0XHRcdGZvcmNlVXNpbmdTZWFyY2g6IGxvY2FsV2l0aFJlbW90ZSB8fCAhdGhpcy5faG9zdFV0aWxzLmZzRXhpc3RzLFxuXHRcdFx0ZXhpc3RzOiAodXJpKSA9PiB0aGlzLl9ob3N0VXRpbHMuZnNFeGlzdHMhKHVyaS5mc1BhdGgpLFxuXHRcdFx0Y2hlY2tFeGlzdHM6IChmb2xkZXJzLCBpbmNsdWRlcywgdG9rZW4pID0+IHRoaXMuX21haW5UaHJlYWRXb3Jrc3BhY2VQcm94eS4kY2hlY2tFeGlzdHMoZm9sZGVycywgaW5jbHVkZXMsIHRva2VuKVxuXHRcdH07XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja0FjdGl2YXRlV29ya3NwYWNlQ29udGFpbnNFeHRlbnNpb24oaG9zdCwgZGVzYyk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gKFxuXHRcdFx0dGhpcy5fYWN0aXZhdGVCeUlkKGRlc2MuaWRlbnRpZmllciwgeyBzdGFydHVwOiB0cnVlLCBleHRlbnNpb25JZDogZGVzYy5pZGVudGlmaWVyLCBhY3RpdmF0aW9uRXZlbnQ6IHJlc3VsdC5hY3RpdmF0aW9uRXZlbnQgfSlcblx0XHRcdFx0LnRoZW4odW5kZWZpbmVkLCBlcnIgPT4gdGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9oYW5kbGVSZW1vdGVSZXNvbHZlckVhZ2VyRXh0ZW5zaW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5faW5pdERhdGEucmVtb3RlLmF1dGhvcml0eSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRlQnlFdmVudChgb25SZXNvbHZlUmVtb3RlQXV0aG9yaXR5OiR7dGhpcy5faW5pdERhdGEucmVtb3RlLmF1dGhvcml0eX1gLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jICRleHRlbnNpb25UZXN0c0V4ZWN1dGUoKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRhd2FpdCB0aGlzLl9lYWdlckV4dGVuc2lvbnNBY3RpdmF0ZWQud2FpdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fZG9IYW5kbGVFeHRlbnNpb25UZXN0cygpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKTsgLy8gZW5zdXJlIGFueSBlcnJvciBtZXNzYWdlIG1ha2VzIGl0IG9udG8gdGhlIGNvbnNvbGVcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2RvSGFuZGxlRXh0ZW5zaW9uVGVzdHMoKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRjb25zdCB7IGV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkksIGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkgfSA9IHRoaXMuX2luaXREYXRhLmVudmlyb25tZW50O1xuXHRcdGlmICghZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSSB8fCAhZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uVGVzdEVycm9yMScsIFwiQ2Fubm90IGxvYWQgdGVzdCBydW5uZXIuXCIpKTtcblx0XHR9XG5cblx0XHQvLyBSZXF1aXJlIHRoZSB0ZXN0IHJ1bm5lciB2aWEgbm9kZSByZXF1aXJlIGZyb20gdGhlIHByb3ZpZGVkIHBhdGhcblx0XHRjb25zdCB0ZXN0UnVubmVyID0gYXdhaXQgdGhpcy5fbG9hZENvbW1vbkpTTW9kdWxlPElUZXN0UnVubmVyIHwgSU5ld1Rlc3RSdW5uZXIgfCB1bmRlZmluZWQ+KG51bGwsIGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkksIG5ldyBFeHRlbnNpb25BY3RpdmF0aW9uVGltZXNCdWlsZGVyKGZhbHNlKSk7XG5cblx0XHRpZiAoIXRlc3RSdW5uZXIgfHwgdHlwZW9mIHRlc3RSdW5uZXIucnVuICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobmxzLmxvY2FsaXplKCdleHRlbnNpb25UZXN0RXJyb3InLCBcIlBhdGggezB9IGRvZXMgbm90IHBvaW50IHRvIGEgdmFsaWQgZXh0ZW5zaW9uIHRlc3QgcnVubmVyLlwiLCBleHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJLnRvU3RyaW5nKCkpKTtcblx0XHR9XG5cblx0XHQvLyBFeGVjdXRlIHRoZSBydW5uZXIgaWYgaXQgZm9sbG93cyB0aGUgb2xkIGBydW5gIHNwZWNcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBvbGRUZXN0UnVubmVyQ2FsbGJhY2sgPSAoZXJyb3I6IEVycm9yLCBmYWlsdXJlczogbnVtYmVyIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBUZXN0IHJ1bm5lciBjYWxsZWQgYmFjayB3aXRoIGVycm9yYCwgZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdFx0XHRpZiAoZmFpbHVyZXMpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBUZXN0IHJ1bm5lciBjYWxsZWQgYmFjayB3aXRoICR7ZmFpbHVyZXN9IGZhaWx1cmVzLmApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBUZXN0IHJ1bm5lciBjYWxsZWQgYmFjayB3aXRoIHN1Y2Nlc3NmdWwgb3V0Y29tZS5gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVzb2x2ZSgodHlwZW9mIGZhaWx1cmVzID09PSAnbnVtYmVyJyAmJiBmYWlsdXJlcyA+IDApID8gMSAvKiBFUlJPUiAqLyA6IDAgLyogT0sgKi8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBleHRlbnNpb25UZXN0c1BhdGggPSBvcmlnaW5hbEZTUGF0aChleHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJKTsgLy8gZm9yIHRoZSBvbGQgdGVzdCBydW5uZXIgQVBJXG5cblx0XHRcdGNvbnN0IHJ1blJlc3VsdCA9IHRlc3RSdW5uZXIucnVuKGV4dGVuc2lvblRlc3RzUGF0aCwgb2xkVGVzdFJ1bm5lckNhbGxiYWNrKTtcblxuXHRcdFx0Ly8gVXNpbmcgdGhlIG5ldyBBUEkgYHJ1bigpOiBQcm9taXNlPHZvaWQ+YFxuXHRcdFx0aWYgKHJ1blJlc3VsdCAmJiBydW5SZXN1bHQudGhlbikge1xuXHRcdFx0XHRydW5SZXN1bHRcblx0XHRcdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYFRlc3QgcnVubmVyIGZpbmlzaGVkIHN1Y2Nlc3NmdWxseS5gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJlc29sdmUoMCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQuY2F0Y2goKGVycjogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgVGVzdCBydW5uZXIgZmluaXNoZWQgd2l0aCBlcnJvcmAsIGVycik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZWplY3QoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyLnN0YWNrID8gZXJyLnN0YWNrIDogU3RyaW5nKGVycikpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhcnRFeHRlbnNpb25Ib3N0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9zdGFydGVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4dGVuc2lvbiBob3N0IGlzIGFscmVhZHkgc3RhcnRlZCFgKTtcblx0XHR9XG5cdFx0dGhpcy5fc3RhcnRlZCA9IHRydWU7XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVhZHlUb1N0YXJ0RXh0ZW5zaW9uSG9zdC53YWl0KClcblx0XHRcdC50aGVuKCgpID0+IHRoaXMuX3JlYWR5VG9SdW5FeHRlbnNpb25zLm9wZW4oKSlcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0Ly8gd2FpdCBmb3IgYWxsIGFjdGl2YXRpb24gZXZlbnRzIHRoYXQgY2FtZSBpbiBkdXJpbmcgd29ya2JlbmNoIHN0YXJ0dXAsIGJ1dCBhdCBtYXhpbXVtIDFzXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJhY2UoW3RoaXMuX2FjdGl2YXRvci53YWl0Rm9yQWN0aXZhdGluZ0V4dGVuc2lvbnMoKSwgdGltZW91dCgxMDAwKV0pO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKCgpID0+IHRoaXMuX2hhbmRsZUVhZ2VyRXh0ZW5zaW9ucygpKVxuXHRcdFx0LnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9lYWdlckV4dGVuc2lvbnNBY3RpdmF0ZWQub3BlbigpO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEVhZ2VyIGV4dGVuc2lvbnMgYWN0aXZhdGVkYCk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdC8vIC0tIGNhbGxlZCBieSBleHRlbnNpb25zXG5cblx0cHVibGljIHJlZ2lzdGVyUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIoYXV0aG9yaXR5UHJlZml4OiBzdHJpbmcsIHJlc29sdmVyOiB2c2NvZGUuUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5fcmVzb2x2ZXJzW2F1dGhvcml0eVByZWZpeF0gPSByZXNvbHZlcjtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9yZXNvbHZlcnNbYXV0aG9yaXR5UHJlZml4XTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRSZW1vdGVFeGVjU2VydmVyKHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTx2c2NvZGUuRXhlY1NlcnZlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHsgcmVzb2x2ZXIgfSA9IGF3YWl0IHRoaXMuX2FjdGl2YXRlQW5kR2V0UmVzb2x2ZXIocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRyZXR1cm4gcmVzb2x2ZXI/LnJlc29sdmVFeGVjU2VydmVyPy4ocmVtb3RlQXV0aG9yaXR5LCB7IHJlc29sdmVBdHRlbXB0OiAwIH0pO1xuXHR9XG5cblx0Ly8gLS0gY2FsbGVkIGJ5IG1haW4gdGhyZWFkXG5cblx0cHJpdmF0ZSBhc3luYyBfYWN0aXZhdGVBbmRHZXRSZXNvbHZlcihyZW1vdGVBdXRob3JpdHk6IHN0cmluZyk6IFByb21pc2U8eyBhdXRob3JpdHlQcmVmaXg6IHN0cmluZzsgcmVzb2x2ZXI6IHZzY29kZS5SZW1vdGVBdXRob3JpdHlSZXNvbHZlciB8IHVuZGVmaW5lZCB9PiB7XG5cdFx0Y29uc3QgYXV0aG9yaXR5UGx1c0luZGV4ID0gcmVtb3RlQXV0aG9yaXR5LmluZGV4T2YoJysnKTtcblx0XHRpZiAoYXV0aG9yaXR5UGx1c0luZGV4ID09PSAtMSkge1xuXHRcdFx0dGhyb3cgbmV3IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IoYE5vdCBhbiBhdXRob3JpdHkgdGhhdCBjYW4gYmUgcmVzb2x2ZWQhYCwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvckNvZGUuSW52YWxpZEF1dGhvcml0eSk7XG5cdFx0fVxuXHRcdGNvbnN0IGF1dGhvcml0eVByZWZpeCA9IHJlbW90ZUF1dGhvcml0eS5zdWJzdHIoMCwgYXV0aG9yaXR5UGx1c0luZGV4KTtcblxuXHRcdGF3YWl0IHRoaXMuX2FsbW9zdFJlYWR5VG9SdW5FeHRlbnNpb25zLndhaXQoKTtcblx0XHRhd2FpdCB0aGlzLl9hY3RpdmF0ZUJ5RXZlbnQoYG9uUmVzb2x2ZVJlbW90ZUF1dGhvcml0eToke2F1dGhvcml0eVByZWZpeH1gLCBmYWxzZSk7XG5cblx0XHRyZXR1cm4geyBhdXRob3JpdHlQcmVmaXgsIHJlc29sdmVyOiB0aGlzLl9yZXNvbHZlcnNbYXV0aG9yaXR5UHJlZml4XSB9O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRyZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eUNoYWluOiBzdHJpbmcsIHJlc29sdmVBdHRlbXB0OiBudW1iZXIpOiBQcm9taXNlPER0bzxJUmVzb2x2ZUF1dGhvcml0eVJlc3VsdD4+IHtcblx0XHRjb25zdCBzdyA9IFN0b3BXYXRjaC5jcmVhdGUoZmFsc2UpO1xuXHRcdGNvbnN0IHByZWZpeCA9ICgpID0+IGBbcmVzb2x2ZUF1dGhvcml0eSgke2dldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHlDaGFpbil9LCR7cmVzb2x2ZUF0dGVtcHR9KV1bJHtzdy5lbGFwc2VkKCl9bXNdIGA7XG5cdFx0Y29uc3QgbG9nSW5mbyA9IChtc2c6IHN0cmluZykgPT4gdGhpcy5fbG9nU2VydmljZS5pbmZvKGAke3ByZWZpeCgpfSR7bXNnfWApO1xuXHRcdGNvbnN0IGxvZ1dhcm5pbmcgPSAobXNnOiBzdHJpbmcpID0+IHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgJHtwcmVmaXgoKX0ke21zZ31gKTtcblx0XHRjb25zdCBsb2dFcnJvciA9IChtc2c6IHN0cmluZywgZXJyOiBhbnkgPSB1bmRlZmluZWQpID0+IHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYCR7cHJlZml4KCl9JHttc2d9YCwgZXJyKTtcblx0XHRjb25zdCBub3JtYWxpemVFcnJvciA9IChlcnI6IHVua25vd24pID0+IHtcblx0XHRcdGlmIChlcnIgaW5zdGFuY2VvZiBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Vycm9yJyBhcyBjb25zdCxcblx0XHRcdFx0XHRlcnJvcjoge1xuXHRcdFx0XHRcdFx0Y29kZTogZXJyLl9jb2RlLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogZXJyLl9tZXNzYWdlLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiBlcnIuX2RldGFpbFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRocm93IGVycjtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZ2V0UmVzb2x2ZXIgPSBhc3luYyAocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcpID0+IHtcblx0XHRcdGxvZ0luZm8oYGFjdGl2YXRpbmcgcmVzb2x2ZXIgZm9yICR7cmVtb3RlQXV0aG9yaXR5fS4uLmApO1xuXHRcdFx0Y29uc3QgeyByZXNvbHZlciwgYXV0aG9yaXR5UHJlZml4IH0gPSBhd2FpdCB0aGlzLl9hY3RpdmF0ZUFuZEdldFJlc29sdmVyKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRpZiAoIXJlc29sdmVyKSB7XG5cdFx0XHRcdGxvZ0Vycm9yKGBubyByZXNvbHZlciBmb3IgJHthdXRob3JpdHlQcmVmaXh9YCk7XG5cdFx0XHRcdHRocm93IG5ldyBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yKGBObyByZW1vdGUgZXh0ZW5zaW9uIGluc3RhbGxlZCB0byByZXNvbHZlICR7YXV0aG9yaXR5UHJlZml4fS5gLCBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yQ29kZS5Ob1Jlc29sdmVyRm91bmQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgcmVzb2x2ZXIsIGF1dGhvcml0eVByZWZpeCwgcmVtb3RlQXV0aG9yaXR5IH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNoYWluID0gcmVtb3RlQXV0aG9yaXR5Q2hhaW4uc3BsaXQoL0B8JTQwL2cpLnJldmVyc2UoKTtcblx0XHRsb2dJbmZvKGBhY3RpdmF0aW5nIHJlbW90ZSByZXNvbHZlcnMgJHtjaGFpbi5qb2luKCcgLT4gJyl9YCk7XG5cblx0XHRsZXQgcmVzb2x2ZXJzO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXNvbHZlcnMgPSBhd2FpdCBQcm9taXNlLmFsbChjaGFpbi5tYXAoZ2V0UmVzb2x2ZXIpKS5jYXRjaChhc3luYyAoZTogRXJyb3IpID0+IHtcblx0XHRcdFx0aWYgKCEoZSBpbnN0YW5jZW9mIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IpIHx8IGUuX2NvZGUgIT09IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlLkludmFsaWRBdXRob3JpdHkpIHsgdGhyb3cgZTsgfVxuXHRcdFx0XHRsb2dXYXJuaW5nKGByZXNvbHZpbmcgbmVzdGVkIGF1dGhvcml0aWVzIGZhaWxlZDogJHtlLm1lc3NhZ2V9YCk7XG5cdFx0XHRcdHJldHVybiBbYXdhaXQgZ2V0UmVzb2x2ZXIocmVtb3RlQXV0aG9yaXR5Q2hhaW4pXTtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVFcnJvcihlKTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnRlcnZhbExvZ2dlciA9IG5ldyBJbnRlcnZhbFRpbWVyKCk7XG5cdFx0aW50ZXJ2YWxMb2dnZXIuY2FuY2VsQW5kU2V0KCgpID0+IGxvZ0luZm8oJ3dhaXRpbmcuLi4nKSwgMTAwMCk7XG5cblx0XHRsZXQgcmVzdWx0ITogdnNjb2RlLlJlc29sdmVyUmVzdWx0O1xuXHRcdGxldCBleGVjU2VydmVyOiB2c2NvZGUuRXhlY1NlcnZlciB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IFtpLCB7IGF1dGhvcml0eVByZWZpeCwgcmVzb2x2ZXIsIHJlbW90ZUF1dGhvcml0eSB9XSBvZiByZXNvbHZlcnMuZW50cmllcygpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoaSA9PT0gcmVzb2x2ZXJzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRsb2dJbmZvKGBpbnZva2luZyBmaW5hbCByZXNvbHZlKCkuLi5gKTtcblx0XHRcdFx0XHRwZXJmb3JtYW5jZS5tYXJrKGBjb2RlL2V4dEhvc3Qvd2lsbFJlc29sdmVBdXRob3JpdHkvJHthdXRob3JpdHlQcmVmaXh9YCk7XG5cdFx0XHRcdFx0cmVzdWx0ID0gYXdhaXQgcmVzb2x2ZXIucmVzb2x2ZShyZW1vdGVBdXRob3JpdHksIHsgcmVzb2x2ZUF0dGVtcHQsIGV4ZWNTZXJ2ZXIgfSk7XG5cdFx0XHRcdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS9leHRIb3N0L2RpZFJlc29sdmVBdXRob3JpdHlPSy8ke2F1dGhvcml0eVByZWZpeH1gKTtcblx0XHRcdFx0XHRsb2dJbmZvKGBzZXR0aW5nIHR1bm5lbCBmYWN0b3J5Li4uYCk7XG5cdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoYXdhaXQgdGhpcy5fZXh0SG9zdFR1bm5lbFNlcnZpY2Uuc2V0VHVubmVsRmFjdG9yeShcblx0XHRcdFx0XHRcdHJlc29sdmVyLFxuXHRcdFx0XHRcdFx0RXh0SG9zdE1hbmFnZWRSZXNvbHZlZEF1dGhvcml0eS5pc01hbmFnZWRSZXNvbHZlZEF1dGhvcml0eShyZXN1bHQpID8gcmVzdWx0IDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG9nSW5mbyhgaW52b2tpbmcgcmVzb2x2ZUV4ZWNTZXJ2ZXIoKSBmb3IgJHtyZW1vdGVBdXRob3JpdHl9YCk7XG5cdFx0XHRcdFx0cGVyZm9ybWFuY2UubWFyayhgY29kZS9leHRIb3N0L3dpbGxSZXNvbHZlRXhlY1NlcnZlci8ke2F1dGhvcml0eVByZWZpeH1gKTtcblx0XHRcdFx0XHRleGVjU2VydmVyID0gYXdhaXQgcmVzb2x2ZXIucmVzb2x2ZUV4ZWNTZXJ2ZXI/LihyZW1vdGVBdXRob3JpdHksIHsgcmVzb2x2ZUF0dGVtcHQsIGV4ZWNTZXJ2ZXIgfSk7XG5cdFx0XHRcdFx0aWYgKCFleGVjU2VydmVyKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvcihgRXhlYyBzZXJ2ZXIgd2FzIG5vdCBhdmFpbGFibGUgZm9yICR7cmVtb3RlQXV0aG9yaXR5fWAsIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlLk5vUmVzb2x2ZXJGb3VuZCk7IC8vIHdlIGRpZCwgaW4gZmFjdCwgYnJlYWsgdGhlIGNoYWluIDooXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZXh0SG9zdC9kaWRSZXNvbHZlRXhlY1NlcnZlck9LLyR7YXV0aG9yaXR5UHJlZml4fWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoYGNvZGUvZXh0SG9zdC9kaWRSZXNvbHZlQXV0aG9yaXR5RXJyb3IvJHthdXRob3JpdHlQcmVmaXh9YCk7XG5cdFx0XHRcdGxvZ0Vycm9yKGByZXR1cm5lZCBhbiBlcnJvcmAsIGUpO1xuXHRcdFx0XHRpbnRlcnZhbExvZ2dlci5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybiBub3JtYWxpemVFcnJvcihlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpbnRlcnZhbExvZ2dlci5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCB0dW5uZWxJbmZvcm1hdGlvbjogVHVubmVsSW5mb3JtYXRpb24gPSB7XG5cdFx0XHRlbnZpcm9ubWVudFR1bm5lbHM6IHJlc3VsdC5lbnZpcm9ubWVudFR1bm5lbHMsXG5cdFx0XHRmZWF0dXJlczogcmVzdWx0LnR1bm5lbEZlYXR1cmVzID8ge1xuXHRcdFx0XHRlbGV2YXRpb246IHJlc3VsdC50dW5uZWxGZWF0dXJlcy5lbGV2YXRpb24sXG5cdFx0XHRcdHByaXZhY3lPcHRpb25zOiByZXN1bHQudHVubmVsRmVhdHVyZXMucHJpdmFjeU9wdGlvbnMsXG5cdFx0XHRcdHByb3RvY29sOiByZXN1bHQudHVubmVsRmVhdHVyZXMucHJvdG9jb2wgPT09IHVuZGVmaW5lZCA/IHRydWUgOiByZXN1bHQudHVubmVsRmVhdHVyZXMucHJvdG9jb2wsXG5cdFx0XHR9IDogdW5kZWZpbmVkXG5cdFx0fTtcblxuXHRcdC8vIFNwbGl0IG1lcmdlZCBBUEkgcmVzdWx0IGludG8gc2VwYXJhdGUgYXV0aG9yaXR5L29wdGlvbnNcblx0XHRjb25zdCBvcHRpb25zOiBSZXNvbHZlZE9wdGlvbnMgPSB7XG5cdFx0XHRleHRlbnNpb25Ib3N0RW52OiByZXN1bHQuZXh0ZW5zaW9uSG9zdEVudixcblx0XHRcdGlzVHJ1c3RlZDogcmVzdWx0LmlzVHJ1c3RlZCxcblx0XHRcdGF1dGhlbnRpY2F0aW9uU2Vzc2lvbjogcmVzdWx0LmF1dGhlbnRpY2F0aW9uU2Vzc2lvbkZvckluaXRpYWxpemluZ0V4dGVuc2lvbnMgPyB7IGlkOiByZXN1bHQuYXV0aGVudGljYXRpb25TZXNzaW9uRm9ySW5pdGlhbGl6aW5nRXh0ZW5zaW9ucy5pZCwgcHJvdmlkZXJJZDogcmVzdWx0LmF1dGhlbnRpY2F0aW9uU2Vzc2lvbkZvckluaXRpYWxpemluZ0V4dGVuc2lvbnMucHJvdmlkZXJJZCB9IDogdW5kZWZpbmVkXG5cdFx0fTtcblxuXHRcdC8vIGV4dGVuc2lvbiBhcmUgbm90IHJlcXVpcmVkIHRvIHJldHVybiBhbiBpbnN0YW5jZSBvZiBSZXNvbHZlZEF1dGhvcml0eSBvciBNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHksIHNvIGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcblx0XHRsb2dJbmZvKGByZXR1cm5lZCAke0V4dEhvc3RNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHkuaXNNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHkocmVzdWx0KSA/ICdtYW5hZ2VkIGF1dGhvcml0eScgOiBgJHtyZXN1bHQuaG9zdH06JHtyZXN1bHQucG9ydH1gfWApO1xuXG5cdFx0bGV0IGF1dGhvcml0eTogUmVzb2x2ZWRBdXRob3JpdHk7XG5cdFx0aWYgKEV4dEhvc3RNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHkuaXNNYW5hZ2VkUmVzb2x2ZWRBdXRob3JpdHkocmVzdWx0KSkge1xuXHRcdFx0Ly8gVGhlIHNvY2tldCBmYWN0b3J5IGlzIGlkZW50aWZpZWQgYnkgdGhlIGByZXNvbHZlQXR0ZW1wdGAsIHNpbmNlIHRoYXQgaXMgYSBudW1iZXIgd2hpY2hcblx0XHRcdC8vIGFsd2F5cyBpbmNyZW1lbnRzIGFuZCBpcyB1bmlxdWUgb3ZlciBhbGwgcmVzb2x2ZSgpIGNhbGxzIGluIGEgd29ya2JlbmNoIHNlc3Npb24uXG5cdFx0XHRjb25zdCBzb2NrZXRGYWN0b3J5SWQgPSByZXNvbHZlQXR0ZW1wdDtcblxuXHRcdFx0Ly8gVGhlcmUgaXMgb25seSBvbiBtYW5hZ2VkIHNvY2tldCBmYWN0b3J5IGF0IGEgdGltZSwgc28gd2UgY2FuIGp1c3Qgb3ZlcndyaXRlIHRoZSBvbGQgb25lLlxuXHRcdFx0dGhpcy5fZXh0SG9zdE1hbmFnZWRTb2NrZXRzLnNldEZhY3Rvcnkoc29ja2V0RmFjdG9yeUlkLCByZXN1bHQubWFrZUNvbm5lY3Rpb24pO1xuXG5cdFx0XHRhdXRob3JpdHkgPSB7XG5cdFx0XHRcdGF1dGhvcml0eTogcmVtb3RlQXV0aG9yaXR5Q2hhaW4sXG5cdFx0XHRcdGNvbm5lY3RUbzogbmV3IE1hbmFnZWRSZW1vdGVDb25uZWN0aW9uKHNvY2tldEZhY3RvcnlJZCksXG5cdFx0XHRcdGNvbm5lY3Rpb25Ub2tlbjogcmVzdWx0LmNvbm5lY3Rpb25Ub2tlblxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXV0aG9yaXR5ID0ge1xuXHRcdFx0XHRhdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eUNoYWluLFxuXHRcdFx0XHRjb25uZWN0VG86IG5ldyBXZWJTb2NrZXRSZW1vdGVDb25uZWN0aW9uKHJlc3VsdC5ob3N0LCByZXN1bHQucG9ydCksXG5cdFx0XHRcdGNvbm5lY3Rpb25Ub2tlbjogcmVzdWx0LmNvbm5lY3Rpb25Ub2tlblxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ29rJyxcblx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdGF1dGhvcml0eTogYXV0aG9yaXR5IGFzIER0bzxSZXNvbHZlZEF1dGhvcml0eT4sXG5cdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHRcdHR1bm5lbEluZm9ybWF0aW9uLFxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGdldENhbm9uaWNhbFVSSShyZW1vdGVBdXRob3JpdHk6IHN0cmluZywgdXJpQ29tcG9uZW50czogVXJpQ29tcG9uZW50cyk6IFByb21pc2U8VXJpQ29tcG9uZW50cyB8IG51bGw+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYCRnZXRDYW5vbmljYWxVUkkgaW52b2tlZCBmb3IgYXV0aG9yaXR5ICgke2dldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHkpfSlgKTtcblxuXHRcdGNvbnN0IHsgcmVzb2x2ZXIgfSA9IGF3YWl0IHRoaXMuX2FjdGl2YXRlQW5kR2V0UmVzb2x2ZXIocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRpZiAoIXJlc29sdmVyKSB7XG5cdFx0XHQvLyBSZXR1cm4gYG51bGxgIGlmIG5vIHJlc29sdmVyIGZvciBgcmVtb3RlQXV0aG9yaXR5YCBpcyBmb3VuZC5cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUodXJpQ29tcG9uZW50cyk7XG5cblx0XHRpZiAodHlwZW9mIHJlc29sdmVyLmdldENhbm9uaWNhbFVSSSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdC8vIHJlc29sdmVyIGNhbm5vdCBjb21wdXRlIGNhbm9uaWNhbCBVUklcblx0XHRcdHJldHVybiB1cmk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYXNQcm9taXNlKCgpID0+IHJlc29sdmVyLmdldENhbm9uaWNhbFVSSSEodXJpKSk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1cmk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkc3RhcnRFeHRlbnNpb25Ib3N0KGV4dGVuc2lvbnNEZWx0YTogSUV4dGVuc2lvbkRlc2NyaXB0aW9uRGVsdGEpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRleHRlbnNpb25zRGVsdGEudG9BZGQuZm9yRWFjaCgoZXh0ZW5zaW9uKSA9PiAoPGFueT5leHRlbnNpb24pLmV4dGVuc2lvbkxvY2F0aW9uID0gVVJJLnJldml2ZShleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24pKTtcblxuXHRcdGNvbnN0IHsgZ2xvYmFsUmVnaXN0cnksIG15RXh0ZW5zaW9ucyB9ID0gYXBwbHlFeHRlbnNpb25zRGVsdGEodGhpcy5fYWN0aXZhdGlvbkV2ZW50c1JlYWRlciwgdGhpcy5fZ2xvYmFsUmVnaXN0cnksIHRoaXMuX215UmVnaXN0cnksIGV4dGVuc2lvbnNEZWx0YSk7XG5cdFx0Y29uc3QgbmV3U2VhcmNoVHJlZSA9IGF3YWl0IHRoaXMuX2NyZWF0ZUV4dGVuc2lvblBhdGhJbmRleChteUV4dGVuc2lvbnMpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNQYXRocyA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uUGF0aEluZGV4KCk7XG5cdFx0ZXh0ZW5zaW9uc1BhdGhzLnNldFNlYXJjaFRyZWUobmV3U2VhcmNoVHJlZSk7XG5cdFx0dGhpcy5fZ2xvYmFsUmVnaXN0cnkuc2V0KGdsb2JhbFJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKTtcblx0XHR0aGlzLl9teVJlZ2lzdHJ5LnNldChteUV4dGVuc2lvbnMpO1xuXG5cdFx0aWYgKGlzQ0kpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgJHN0YXJ0RXh0ZW5zaW9uSG9zdDogZ2xvYmFsIGV4dGVuc2lvbnM6ICR7cHJpbnRFeHRJZHModGhpcy5fZ2xvYmFsUmVnaXN0cnkpfWApO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGAkc3RhcnRFeHRlbnNpb25Ib3N0OiBsb2NhbCBleHRlbnNpb25zOiAke3ByaW50RXh0SWRzKHRoaXMuX215UmVnaXN0cnkpfWApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9zdGFydEV4dGVuc2lvbkhvc3QoKTtcblx0fVxuXG5cdHB1YmxpYyAkYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudDogc3RyaW5nLCBhY3RpdmF0aW9uS2luZDogQWN0aXZhdGlvbktpbmQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoYWN0aXZhdGlvbktpbmQgPT09IEFjdGl2YXRpb25LaW5kLkltbWVkaWF0ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbW9zdFJlYWR5VG9SdW5FeHRlbnNpb25zLndhaXQoKVxuXHRcdFx0XHQudGhlbihfID0+IHRoaXMuX2FjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQsIGZhbHNlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChcblx0XHRcdHRoaXMuX3JlYWR5VG9SdW5FeHRlbnNpb25zLndhaXQoKVxuXHRcdFx0XHQudGhlbihfID0+IHRoaXMuX2FjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQsIGZhbHNlKSlcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRhY3RpdmF0ZShleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVhZHlUb1J1bkV4dGVuc2lvbnMud2FpdCgpO1xuXHRcdGlmICghdGhpcy5fbXlSZWdpc3RyeS5nZXRFeHRlbnNpb25EZXNjcmlwdGlvbihleHRlbnNpb25JZCkpIHtcblx0XHRcdC8vIHVua25vd24gZXh0ZW5zaW9uID0+IGlnbm9yZVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLl9hY3RpdmF0ZUJ5SWQoZXh0ZW5zaW9uSWQsIHJlYXNvbik7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGRlbHRhRXh0ZW5zaW9ucyhleHRlbnNpb25zRGVsdGE6IElFeHRlbnNpb25EZXNjcmlwdGlvbkRlbHRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZXh0ZW5zaW9uc0RlbHRhLnRvQWRkLmZvckVhY2goKGV4dGVuc2lvbikgPT4gKDxhbnk+ZXh0ZW5zaW9uKS5leHRlbnNpb25Mb2NhdGlvbiA9IFVSSS5yZXZpdmUoZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uKSk7XG5cblx0XHQvLyBGaXJzdCBidWlsZCB1cCBhbmQgdXBkYXRlIHRoZSB0cmllIGFuZCBvbmx5IGFmdGVyd2FyZHMgYXBwbHkgdGhlIGRlbHRhXG5cdFx0Y29uc3QgeyBnbG9iYWxSZWdpc3RyeSwgbXlFeHRlbnNpb25zIH0gPSBhcHBseUV4dGVuc2lvbnNEZWx0YSh0aGlzLl9hY3RpdmF0aW9uRXZlbnRzUmVhZGVyLCB0aGlzLl9nbG9iYWxSZWdpc3RyeSwgdGhpcy5fbXlSZWdpc3RyeSwgZXh0ZW5zaW9uc0RlbHRhKTtcblx0XHRjb25zdCBuZXdTZWFyY2hUcmVlID0gYXdhaXQgdGhpcy5fY3JlYXRlRXh0ZW5zaW9uUGF0aEluZGV4KG15RXh0ZW5zaW9ucyk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1BhdGhzID0gYXdhaXQgdGhpcy5nZXRFeHRlbnNpb25QYXRoSW5kZXgoKTtcblx0XHRleHRlbnNpb25zUGF0aHMuc2V0U2VhcmNoVHJlZShuZXdTZWFyY2hUcmVlKTtcblx0XHR0aGlzLl9nbG9iYWxSZWdpc3RyeS5zZXQoZ2xvYmFsUmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCkpO1xuXHRcdHRoaXMuX215UmVnaXN0cnkuc2V0KG15RXh0ZW5zaW9ucyk7XG5cblx0XHRpZiAoaXNDSSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGAkZGVsdGFFeHRlbnNpb25zOiBnbG9iYWwgZXh0ZW5zaW9uczogJHtwcmludEV4dElkcyh0aGlzLl9nbG9iYWxSZWdpc3RyeSl9YCk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYCRkZWx0YUV4dGVuc2lvbnM6IGxvY2FsIGV4dGVuc2lvbnM6ICR7cHJpbnRFeHRJZHModGhpcy5fbXlSZWdpc3RyeSl9YCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICR0ZXN0X2xhdGVuY3kobjogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRyZXR1cm4gbjtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkdGVzdF91cChiOiBWU0J1ZmZlcik6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIGIuYnl0ZUxlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkdGVzdF9kb3duKHNpemU6IG51bWJlcik6IFByb21pc2U8VlNCdWZmZXI+IHtcblx0XHRjb25zdCBidWZmID0gVlNCdWZmZXIuYWxsb2Moc2l6ZSk7XG5cdFx0Y29uc3QgdmFsdWUgPSBNYXRoLnJhbmRvbSgpICUgMjU2O1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7XG5cdFx0XHRidWZmLndyaXRlVUludDgodmFsdWUsIGkpO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZjtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkdXBkYXRlUmVtb3RlQ29ubmVjdGlvbkRhdGEoY29ubmVjdGlvbkRhdGE6IElSZW1vdGVDb25uZWN0aW9uRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3JlbW90ZUNvbm5lY3Rpb25EYXRhID0gY29ubmVjdGlvbkRhdGE7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VSZW1vdGVDb25uZWN0aW9uRGF0YS5maXJlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2JlZm9yZUFsbW9zdFJlYWR5VG9SdW5FeHRlbnNpb25zKCk6IFByb21pc2U8dm9pZD47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfZ2V0RW50cnlQb2ludChleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2xvYWRDb21tb25KU01vZHVsZTxUIGV4dGVuZHMgb2JqZWN0IHwgdW5kZWZpbmVkPihleHRlbnNpb25JZDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uIHwgbnVsbCwgbW9kdWxlOiBVUkksIGFjdGl2YXRpb25UaW1lc0J1aWxkZXI6IEV4dGVuc2lvbkFjdGl2YXRpb25UaW1lc0J1aWxkZXIpOiBQcm9taXNlPFQ+O1xuXHRwdWJsaWMgYWJzdHJhY3QgJHNldFJlbW90ZUVudmlyb25tZW50KGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBudWxsIH0pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5mdW5jdGlvbiBhcHBseUV4dGVuc2lvbnNEZWx0YShhY3RpdmF0aW9uRXZlbnRzUmVhZGVyOiBTeW5jZWRBY3RpdmF0aW9uRXZlbnRzUmVhZGVyLCBvbGRHbG9iYWxSZWdpc3RyeTogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSwgb2xkTXlSZWdpc3RyeTogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSwgZXh0ZW5zaW9uc0RlbHRhOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25EZWx0YSkge1xuXHRhY3RpdmF0aW9uRXZlbnRzUmVhZGVyLmFkZEFjdGl2YXRpb25FdmVudHMoZXh0ZW5zaW9uc0RlbHRhLmFkZEFjdGl2YXRpb25FdmVudHMpO1xuXHRjb25zdCBnbG9iYWxSZWdpc3RyeSA9IG5ldyBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5KGFjdGl2YXRpb25FdmVudHNSZWFkZXIsIG9sZEdsb2JhbFJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKTtcblx0Z2xvYmFsUmVnaXN0cnkuZGVsdGFFeHRlbnNpb25zKGV4dGVuc2lvbnNEZWx0YS50b0FkZCwgZXh0ZW5zaW9uc0RlbHRhLnRvUmVtb3ZlKTtcblxuXHRjb25zdCBteUV4dGVuc2lvbnNTZXQgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllclNldChvbGRNeVJlZ2lzdHJ5LmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0Zm9yIChjb25zdCBleHRlbnNpb25JZCBvZiBleHRlbnNpb25zRGVsdGEubXlUb1JlbW92ZSkge1xuXHRcdG15RXh0ZW5zaW9uc1NldC5kZWxldGUoZXh0ZW5zaW9uSWQpO1xuXHR9XG5cdGZvciAoY29uc3QgZXh0ZW5zaW9uSWQgb2YgZXh0ZW5zaW9uc0RlbHRhLm15VG9BZGQpIHtcblx0XHRteUV4dGVuc2lvbnNTZXQuYWRkKGV4dGVuc2lvbklkKTtcblx0fVxuXHRjb25zdCBteUV4dGVuc2lvbnMgPSBmaWx0ZXJFeHRlbnNpb25zKGdsb2JhbFJlZ2lzdHJ5LCBteUV4dGVuc2lvbnNTZXQpO1xuXG5cdHJldHVybiB7IGdsb2JhbFJlZ2lzdHJ5LCBteUV4dGVuc2lvbnMgfTtcbn1cblxudHlwZSBUZWxlbWV0cnlBY3RpdmF0aW9uRXZlbnQgPSB7XG5cdGlkOiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0ZXh0ZW5zaW9uVmVyc2lvbjogc3RyaW5nO1xuXHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogc3RyaW5nO1xuXHRhY3RpdmF0aW9uRXZlbnRzOiBzdHJpbmcgfCBudWxsO1xuXHRpc0J1aWx0aW46IGJvb2xlYW47XG5cdHJlYXNvbjogc3RyaW5nO1xuXHRyZWFzb25JZDogc3RyaW5nO1xufTtcblxuZnVuY3Rpb24gZ2V0VGVsZW1ldHJ5QWN0aXZhdGlvbkV2ZW50KGV4dGVuc2lvbkRlc2NyaXB0aW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHJlYXNvbjogRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbik6IFRlbGVtZXRyeUFjdGl2YXRpb25FdmVudCB7XG5cdGNvbnN0IGV2ZW50ID0ge1xuXHRcdGlkOiBleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlLFxuXHRcdG5hbWU6IGV4dGVuc2lvbkRlc2NyaXB0aW9uLm5hbWUsXG5cdFx0ZXh0ZW5zaW9uVmVyc2lvbjogZXh0ZW5zaW9uRGVzY3JpcHRpb24udmVyc2lvbixcblx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogZXh0ZW5zaW9uRGVzY3JpcHRpb24ucHVibGlzaGVyLFxuXHRcdGFjdGl2YXRpb25FdmVudHM6IGV4dGVuc2lvbkRlc2NyaXB0aW9uLmFjdGl2YXRpb25FdmVudHMgPyBleHRlbnNpb25EZXNjcmlwdGlvbi5hY3RpdmF0aW9uRXZlbnRzLmpvaW4oJywnKSA6IG51bGwsXG5cdFx0aXNCdWlsdGluOiBleHRlbnNpb25EZXNjcmlwdGlvbi5pc0J1aWx0aW4sXG5cdFx0cmVhc29uOiByZWFzb24uYWN0aXZhdGlvbkV2ZW50LFxuXHRcdHJlYXNvbklkOiByZWFzb24uZXh0ZW5zaW9uSWQudmFsdWUsXG5cdH07XG5cblx0cmV0dXJuIGV2ZW50O1xufVxuXG5mdW5jdGlvbiBwcmludEV4dElkcyhyZWdpc3RyeTogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSkge1xuXHRyZXR1cm4gcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCkubWFwKGV4dCA9PiBleHQuaWRlbnRpZmllci52YWx1ZSkuam9pbignLCcpO1xufVxuXG5leHBvcnQgY29uc3QgSUV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElFeHRIb3N0RXh0ZW5zaW9uU2VydmljZT4oJ0lFeHRIb3N0RXh0ZW5zaW9uU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRIb3N0RXh0ZW5zaW9uU2VydmljZSBleHRlbmRzIEFic3RyYWN0RXh0SG9zdEV4dGVuc2lvblNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPjtcblx0dGVybWluYXRlKHJlYXNvbjogc3RyaW5nKTogdm9pZDtcblx0Z2V0RXh0ZW5zaW9uKGV4dGVuc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZD47XG5cdGlzQWN0aXZhdGVkKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogYm9vbGVhbjtcblx0YWN0aXZhdGVCeUlkV2l0aEVycm9ycyhleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTx2b2lkPjtcblx0Z2V0RXh0ZW5zaW9uRXhwb3J0cyhleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcik6IElFeHRlbnNpb25BUEkgfCBudWxsIHwgdW5kZWZpbmVkO1xuXHRnZXRFeHRlbnNpb25SZWdpc3RyeSgpOiBQcm9taXNlPEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnk+O1xuXHRnZXRFeHRlbnNpb25QYXRoSW5kZXgoKTogUHJvbWlzZTxFeHRlbnNpb25QYXRocz47XG5cdHJlZ2lzdGVyUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIoYXV0aG9yaXR5UHJlZml4OiBzdHJpbmcsIHJlc29sdmVyOiB2c2NvZGUuUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIpOiB2c2NvZGUuRGlzcG9zYWJsZTtcblx0Z2V0UmVtb3RlRXhlY1NlcnZlcihhdXRob3JpdHk6IHN0cmluZyk6IFByb21pc2U8dnNjb2RlLkV4ZWNTZXJ2ZXIgfCB1bmRlZmluZWQ+O1xuXG5cdG9uRGlkQ2hhbmdlUmVtb3RlQ29ubmVjdGlvbkRhdGE6IEV2ZW50PHZvaWQ+O1xuXHRnZXRSZW1vdGVDb25uZWN0aW9uRGF0YSgpOiBJUmVtb3RlQ29ubmVjdGlvbkRhdGEgfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uPFQgZXh0ZW5kcyBvYmplY3QgfCBudWxsIHwgdW5kZWZpbmVkPiBpbXBsZW1lbnRzIHZzY29kZS5FeHRlbnNpb248VD4ge1xuXG5cdCNleHRlbnNpb25TZXJ2aWNlOiBJRXh0SG9zdEV4dGVuc2lvblNlcnZpY2U7XG5cdCNvcmlnaW5FeHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblx0I2lkZW50aWZpZXI6IEV4dGVuc2lvbklkZW50aWZpZXI7XG5cblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uVXJpOiBVUkk7XG5cdHJlYWRvbmx5IGV4dGVuc2lvblBhdGg6IHN0cmluZztcblx0cmVhZG9ubHkgcGFja2FnZUpTT046IElFeHRlbnNpb25EZXNjcmlwdGlvbjtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uS2luZDogdnNjb2RlLkV4dGVuc2lvbktpbmQ7XG5cdHJlYWRvbmx5IGlzRnJvbURpZmZlcmVudEV4dGVuc2lvbkhvc3Q6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoZXh0ZW5zaW9uU2VydmljZTogSUV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLCBvcmlnaW5FeHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwga2luZDogRXh0ZW5zaW9uS2luZCwgaXNGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdDogYm9vbGVhbikge1xuXHRcdHRoaXMuI2V4dGVuc2lvblNlcnZpY2UgPSBleHRlbnNpb25TZXJ2aWNlO1xuXHRcdHRoaXMuI29yaWdpbkV4dGVuc2lvbklkID0gb3JpZ2luRXh0ZW5zaW9uSWQ7XG5cdFx0dGhpcy4jaWRlbnRpZmllciA9IGRlc2NyaXB0aW9uLmlkZW50aWZpZXI7XG5cdFx0dGhpcy5pZCA9IGRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWU7XG5cdFx0dGhpcy5leHRlbnNpb25VcmkgPSBkZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbjtcblx0XHR0aGlzLmV4dGVuc2lvblBhdGggPSBwYXRoLm5vcm1hbGl6ZShvcmlnaW5hbEZTUGF0aChkZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbikpO1xuXHRcdHRoaXMucGFja2FnZUpTT04gPSBkZXNjcmlwdGlvbjtcblx0XHR0aGlzLmV4dGVuc2lvbktpbmQgPSBraW5kO1xuXHRcdHRoaXMuaXNGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdCA9IGlzRnJvbURpZmZlcmVudEV4dGVuc2lvbkhvc3Q7XG5cdH1cblxuXHRnZXQgaXNBY3RpdmUoKTogYm9vbGVhbiB7XG5cdFx0Ly8gVE9ET0BhbGV4ZGltYSBzdXBwb3J0IHRoaXNcblx0XHRyZXR1cm4gdGhpcy4jZXh0ZW5zaW9uU2VydmljZS5pc0FjdGl2YXRlZCh0aGlzLiNpZGVudGlmaWVyKTtcblx0fVxuXG5cdGdldCBleHBvcnRzKCk6IFQge1xuXHRcdGlmICh0aGlzLnBhY2thZ2VKU09OLmFwaSA9PT0gJ25vbmUnIHx8IHRoaXMuaXNGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZCE7IC8vIFN0cmljdCBudWxsb3ZlcnJpZGUgLSBQdWJsaWMgYXBpXG5cdFx0fVxuXHRcdHJldHVybiA8VD50aGlzLiNleHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbkV4cG9ydHModGhpcy4jaWRlbnRpZmllcik7XG5cdH1cblxuXHRhc3luYyBhY3RpdmF0ZSgpOiBQcm9taXNlPFQ+IHtcblx0XHRpZiAodGhpcy5pc0Zyb21EaWZmZXJlbnRFeHRlbnNpb25Ib3N0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBhY3RpdmF0ZSBmb3JlaWduIGV4dGVuc2lvbicpOyAvLyBUT0RPQGFsZXhkaW1hIHN1cHBvcnQgdGhpc1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLiNleHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlJZFdpdGhFcnJvcnModGhpcy4jaWRlbnRpZmllciwgeyBzdGFydHVwOiBmYWxzZSwgZXh0ZW5zaW9uSWQ6IHRoaXMuI29yaWdpbkV4dGVuc2lvbklkLCBhY3RpdmF0aW9uRXZlbnQ6ICdhcGknIH0pO1xuXHRcdHJldHVybiB0aGlzLmV4cG9ydHM7XG5cdH1cbn1cblxuZnVuY3Rpb24gZmlsdGVyRXh0ZW5zaW9ucyhnbG9iYWxSZWdpc3RyeTogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSwgZGVzaXJlZEV4dGVuc2lvbnM6IEV4dGVuc2lvbklkZW50aWZpZXJTZXQpOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSB7XG5cdHJldHVybiBnbG9iYWxSZWdpc3RyeS5nZXRBbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMoKS5maWx0ZXIoXG5cdFx0ZXh0ZW5zaW9uID0+IGRlc2lyZWRFeHRlbnNpb25zLmhhcyhleHRlbnNpb24uaWRlbnRpZmllcilcblx0KTtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvblBhdGhzIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9zZWFyY2hUcmVlOiBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIElFeHRlbnNpb25EZXNjcmlwdGlvbj5cblx0KSB7IH1cblxuXHRzZXRTZWFyY2hUcmVlKHNlYXJjaFRyZWU6IFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uPik6IHZvaWQge1xuXHRcdHRoaXMuX3NlYXJjaFRyZWUgPSBzZWFyY2hUcmVlO1xuXHR9XG5cblx0ZmluZFN1YnN0cihrZXk6IFVSSSk6IElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlYXJjaFRyZWUuZmluZFN1YnN0cihrZXkpO1xuXHR9XG5cblx0Zm9yRWFjaChjYWxsYmFjazogKHZhbHVlOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGluZGV4OiBVUkkpID0+IGFueSk6IHZvaWQge1xuXHRcdHJldHVybiB0aGlzLl9zZWFyY2hUcmVlLmZvckVhY2goY2FsbGJhY2spO1xuXHR9XG59XG5cbi8qKlxuICogVGhpcyBtaXJyb3JzIHRoZSBhY3RpdmF0aW9uIGV2ZW50cyBhcyBzZWVuIGJ5IHRoZSByZW5kZXJlci4gVGhlIHJlbmRlcmVyXG4gKiBpcyB0aGUgb25seSBvbmUgd2hpY2ggY2FuIGhhdmUgYSByZWxpYWJsZSB2aWV3IG9mIGFjdGl2YXRpb24gZXZlbnRzIGJlY2F1c2VcbiAqIGltcGxpY2l0IGFjdGl2YXRpb24gZXZlbnRzIGFyZSBnZW5lcmF0ZWQgdmlhIGV4dGVuc2lvbiBwb2ludHMsIGFuZCB0aGV5XG4gKiBhcmUgcmVnaXN0ZXJlZCBvbmx5IG9uIHRoZSByZW5kZXJlciBzaWRlLlxuICovXG5jbGFzcyBTeW5jZWRBY3RpdmF0aW9uRXZlbnRzUmVhZGVyIGltcGxlbWVudHMgSUFjdGl2YXRpb25FdmVudHNSZWFkZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21hcCA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwPHN0cmluZ1tdPigpO1xuXG5cdGNvbnN0cnVjdG9yKGFjdGl2YXRpb25FdmVudHM6IHsgW2V4dGVuc2lvbklkOiBzdHJpbmddOiBzdHJpbmdbXSB9KSB7XG5cdFx0dGhpcy5hZGRBY3RpdmF0aW9uRXZlbnRzKGFjdGl2YXRpb25FdmVudHMpO1xuXHR9XG5cblx0cHVibGljIHJlYWRBY3RpdmF0aW9uRXZlbnRzKGV4dGVuc2lvbkRlc2NyaXB0aW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5nZXQoZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcikgPz8gW107XG5cdH1cblxuXHRwdWJsaWMgYWRkQWN0aXZhdGlvbkV2ZW50cyhhY3RpdmF0aW9uRXZlbnRzOiB7IFtleHRlbnNpb25JZDogc3RyaW5nXTogc3RyaW5nW10gfSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uSWQgb2YgT2JqZWN0LmtleXMoYWN0aXZhdGlvbkV2ZW50cykpIHtcblx0XHRcdHRoaXMuX21hcC5zZXQoZXh0ZW5zaW9uSWQsIGFjdGl2YXRpb25FdmVudHNbZXh0ZW5zaW9uSWRdKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBT0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksVUFBVTtBQUN0QixZQUFZLGlCQUFpQjtBQUM3QixTQUFTLGdCQUFnQixVQUFVLGtDQUFrQztBQUNyRSxTQUFTLFdBQVcsU0FBUyxlQUFlLGVBQWU7QUFDM0QsU0FBUyxTQUFTLGNBQWMsWUFBWSx1QkFBb0M7QUFDaEYsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLG1CQUFtQjtBQUM1QixTQUF1QyxtQkFBd0c7QUFFL0ksU0FBK0IsNkJBQTZCO0FBQzVELFNBQVMsb0JBQW9CLGdC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
