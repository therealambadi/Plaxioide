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
import { Barrier } from "../../../../base/common/async.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import * as perf from "../../../../base/common/performance.js";
import { isCI } from "../../../../base/common/platform.js";
import { isEqualOrParent } from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { isDefined } from "../../../../base/common/types.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstallOperation } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ImplicitActivationEvents } from "../../../../platform/extensionManagement/common/implicitActivationEvents.js";
import { ExtensionIdentifier, ExtensionIdentifierMap } from "../../../../platform/extensions/common/extensions.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { handleVetos } from "../../../../platform/lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IRemoteAuthorityResolverService, RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode, getRemoteAuthorityPrefix } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IRemoteExtensionsScannerService } from "../../../../platform/remote/common/remoteExtensionsScanner.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { Extensions as ExtensionFeaturesExtensions } from "../../extensionManagement/common/extensionFeatures.js";
import { IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { LockableExtensionDescriptionRegistry } from "./extensionDescriptionRegistry.js";
import { parseExtensionDevOptions } from "./extensionDevOptions.js";
import { ExtensionHostKind, ExtensionRunningPreference } from "./extensionHostKind.js";
import { ExtensionHostManager } from "./extensionHostManager.js";
import { IExtensionManifestPropertiesService } from "./extensionManifestPropertiesService.js";
import { LocalProcessRunningLocation, LocalWebWorkerRunningLocation, RemoteRunningLocation } from "./extensionRunningLocation.js";
import { ExtensionRunningLocationTracker, filterExtensionIdentifiers } from "./extensionRunningLocationTracker.js";
import { ActivationKind, ActivationTimes, ExtensionHostStartup, ExtensionPointContribution, toExtension, toExtensionDescription } from "./extensions.js";
import { ExtensionMessageCollector, ExtensionsRegistry } from "./extensionsRegistry.js";
import { LazyCreateExtensionHostManager } from "./lazyCreateExtensionHostManager.js";
import { ResponsiveState } from "./rpcProtocol.js";
import { checkActivateWorkspaceContainsExtension, checkGlobFileExists } from "./workspaceContains.js";
import { ILifecycleService, WillShutdownJoinerOrder } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
const hasOwnProperty = Object.hasOwnProperty;
const NO_OP_VOID_PROMISE = Promise.resolve(void 0);
let AbstractExtensionService = class extends Disposable {
  constructor(options, _extensionsProposedApi, _extensionHostFactory, _extensionHostKindPicker, _instantiationService, _notificationService, _environmentService, _telemetryService, _extensionEnablementService, _fileService, _productService, _extensionManagementService, _contextService, _configurationService, _extensionManifestPropertiesService, _logService, _remoteAgentService, _remoteExtensionsScannerService, _lifecycleService, _remoteAuthorityResolverService, _dialogService) {
    super();
    this._extensionsProposedApi = _extensionsProposedApi;
    this._extensionHostFactory = _extensionHostFactory;
    this._extensionHostKindPicker = _extensionHostKindPicker;
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this._environmentService = _environmentService;
    this._telemetryService = _telemetryService;
    this._extensionEnablementService = _extensionEnablementService;
    this._fileService = _fileService;
    this._productService = _productService;
    this._extensionManagementService = _extensionManagementService;
    this._contextService = _contextService;
    this._configurationService = _configurationService;
    this._extensionManifestPropertiesService = _extensionManifestPropertiesService;
    this._logService = _logService;
    this._remoteAgentService = _remoteAgentService;
    this._remoteExtensionsScannerService = _remoteExtensionsScannerService;
    this._lifecycleService = _lifecycleService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._dialogService = _dialogService;
    this._onDidRegisterExtensions = this._register(new Emitter());
    this.onDidRegisterExtensions = this._onDidRegisterExtensions.event;
    this._onDidChangeExtensionsStatus = this._register(new Emitter());
    this.onDidChangeExtensionsStatus = this._onDidChangeExtensionsStatus.event;
    this._onDidChangeExtensions = this._register(new Emitter({ leakWarningThreshold: 400 }));
    this.onDidChangeExtensions = this._onDidChangeExtensions.event;
    this._onWillActivateByEvent = this._register(new Emitter());
    this.onWillActivateByEvent = this._onWillActivateByEvent.event;
    this._onDidChangeResponsiveChange = this._register(new Emitter());
    this.onDidChangeResponsiveChange = this._onDidChangeResponsiveChange.event;
    this._onWillStop = this._register(new Emitter());
    this.onWillStop = this._onWillStop.event;
    this._activationEventReader = new ImplicitActivationAwareReader();
    this._registry = new LockableExtensionDescriptionRegistry(this._activationEventReader);
    this._installedExtensionsReady = new Barrier();
    this._extensionStatus = new ExtensionIdentifierMap();
    this._allRequestedActivateEvents = /* @__PURE__ */ new Set();
    this._remoteCrashTracker = new ExtensionHostCrashTracker();
    this._deltaExtensionsQueue = [];
    this._inHandleDeltaExtensions = false;
    this._extensionHostManagers = this._register(new ExtensionHostCollection());
    this._resolveAuthorityAttempt = 0;
    this._hasLocalProcess = options.hasLocalProcess;
    this._allowRemoteExtensionsInLocalWebWorker = options.allowRemoteExtensionsInLocalWebWorker;
    this._register(this._fileService.onWillActivateFileSystemProvider((e) => {
      if (e.scheme !== Schemas.vscodeRemote) {
        e.join(this.activateByEvent(`onFileSystem:${e.scheme}`));
      }
    }));
    this._runningLocations = new ExtensionRunningLocationTracker(
      this._registry,
      this._extensionHostKindPicker,
      this._environmentService,
      this._configurationService,
      this._logService,
      this._extensionManifestPropertiesService
    );
    this._register(this._extensionEnablementService.onEnablementChanged((extensions) => {
      const toAdd = [];
      const toRemove = [];
      for (const extension of extensions) {
        if (this._safeInvokeIsEnabled(extension)) {
          toAdd.push(extension);
        } else {
          toRemove.push(extension);
        }
      }
      if (isCI) {
        this._logService.info(`AbstractExtensionService.onEnablementChanged fired for ${extensions.map((e) => e.identifier.id).join(", ")}`);
      }
      this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove));
    }));
    this._register(this._extensionManagementService.onDidChangeProfile(({ added, removed }) => {
      if (added.length || removed.length) {
        if (isCI) {
          this._logService.info(`AbstractExtensionService.onDidChangeProfile fired`);
        }
        this._handleDeltaExtensions(new DeltaExtensionsQueueItem(added, removed));
      }
    }));
    this._register(this._extensionManagementService.onDidEnableExtensions((extensions) => {
      if (extensions.length) {
        if (isCI) {
          this._logService.info(`AbstractExtensionService.onDidEnableExtensions fired`);
        }
        this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, []));
      }
    }));
    this._register(this._extensionManagementService.onDidInstallExtensions((result) => {
      const extensions = [];
      for (const { local, operation } of result) {
        if (local && local.isValid && operation !== InstallOperation.Migrate && this._safeInvokeIsEnabled(local)) {
          extensions.push(local);
        }
      }
      if (extensions.length) {
        if (isCI) {
          this._logService.info(`AbstractExtensionService.onDidInstallExtensions fired for ${extensions.map((e) => e.identifier.id).join(", ")}`);
        }
        this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, []));
      }
    }));
    this._register(this._extensionManagementService.onDidUninstallExtension((event) => {
      if (!event.error) {
        if (isCI) {
          this._logService.info(`AbstractExtensionService.onDidUninstallExtension fired for ${event.identifier.id}`);
        }
        this._handleDeltaExtensions(new DeltaExtensionsQueueItem([], [event.identifier.id]));
      }
    }));
    this._register(this._lifecycleService.onWillShutdown((event) => {
      if (this._remoteAgentService.getConnection()) {
        event.join(async () => {
          try {
            await this._remoteAgentService.endConnection();
            await this._doStopExtensionHosts();
            this._remoteAgentService.getConnection()?.dispose();
          } catch {
            this._logService.warn("Error while disconnecting remote agent");
          }
        }, {
          id: "join.disconnectRemote",
          label: nls.localize("disconnectRemote", "Disconnect Remote Agent"),
          order: WillShutdownJoinerOrder.Last
          // after others have joined that might depend on a remote connection
        });
      } else {
        event.join(this._doStopExtensionHosts(), {
          id: "join.stopExtensionHosts",
          label: nls.localize("stopExtensionHosts", "Stopping Extension Hosts")
        });
      }
    }));
  }
  _getExtensionHostManagers(kind) {
    return this._extensionHostManagers.getByKind(kind);
  }
  //#region deltaExtensions
  async _handleDeltaExtensions(item) {
    this._deltaExtensionsQueue.push(item);
    if (this._inHandleDeltaExtensions) {
      return;
    }
    let lock = null;
    try {
      this._inHandleDeltaExtensions = true;
      await this._installedExtensionsReady.wait();
      lock = await this._registry.acquireLock("handleDeltaExtensions");
      while (this._deltaExtensionsQueue.length > 0) {
        const item2 = this._deltaExtensionsQueue.shift();
        await this._deltaExtensions(lock, item2.toAdd, item2.toRemove);
      }
    } finally {
      this._inHandleDeltaExtensions = false;
      lock?.dispose();
    }
  }
  async _deltaExtensions(lock, _toAdd, _toRemove) {
    if (isCI) {
      this._logService.info(`AbstractExtensionService._deltaExtensions: toAdd: [${_toAdd.map((e) => e.identifier.id).join(",")}] toRemove: [${_toRemove.map((e) => typeof e === "string" ? e : e.identifier.id).join(",")}]`);
    }
    let toRemove = [];
    for (let i = 0, len = _toRemove.length; i < len; i++) {
      const extensionOrId = _toRemove[i];
      const extensionId = typeof extensionOrId === "string" ? extensionOrId : extensionOrId.identifier.id;
      const extension = typeof extensionOrId === "string" ? null : extensionOrId;
      const extensionDescription = this._registry.getExtensionDescription(extensionId);
      if (!extensionDescription) {
        continue;
      }
      if (extension && extensionDescription.extensionLocation.scheme !== extension.location.scheme) {
        continue;
      }
      if (!this.canRemoveExtension(extensionDescription)) {
        continue;
      }
      toRemove.push(extensionDescription);
    }
    const toAdd = [];
    for (let i = 0, len = _toAdd.length; i < len; i++) {
      const extension = _toAdd[i];
      const extensionDescription = toExtensionDescription(extension, false);
      if (!extensionDescription) {
        continue;
      }
      if (!this._canAddExtension(extensionDescription, toRemove)) {
        continue;
      }
      toAdd.push(extensionDescription);
    }
    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }
    const result = this._registry.deltaExtensions(lock, toAdd, toRemove.map((e) => e.identifier));
    this._onDidChangeExtensions.fire({ added: toAdd, removed: toRemove });
    toRemove = toRemove.concat(result.removedDueToLooping);
    if (result.removedDueToLooping.length > 0) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: nls.localize("looping", "The following extensions contain dependency loops and have been disabled: {0}", result.removedDueToLooping.map((e) => `'${e.identifier.value}'`).join(", "))
      });
    }
    this._extensionsProposedApi.updateEnabledApiProposals(toAdd);
    this._doHandleExtensionPoints([].concat(toAdd).concat(toRemove), false);
    await this._updateExtensionsOnExtHosts(result.versionId, toAdd, toRemove.map((e) => e.identifier));
    for (let i = 0; i < toAdd.length; i++) {
      this._activateAddedExtensionIfNeeded(toAdd[i]);
    }
  }
  async _updateExtensionsOnExtHosts(versionId, toAdd, toRemove) {
    const removedRunningLocation = this._runningLocations.deltaExtensions(toAdd, toRemove);
    const promises = this._extensionHostManagers.map(
      (extHostManager) => this._updateExtensionsOnExtHost(extHostManager, versionId, toAdd, toRemove, removedRunningLocation)
    );
    await Promise.all(promises);
  }
  async _updateExtensionsOnExtHost(extensionHostManager, versionId, toAdd, toRemove, removedRunningLocation) {
    const myToAdd = this._runningLocations.filterByExtensionHostManager(toAdd, extensionHostManager);
    const myToRemove = filterExtensionIdentifiers(toRemove, removedRunningLocation, (extRunningLocation) => extensionHostManager.representsRunningLocation(extRunningLocation));
    const addActivationEvents = ImplicitActivationEvents.createActivationEventsMap(toAdd);
    if (isCI) {
      const printExtIds = (extensions) => extensions.map((e) => e.identifier.value).join(",");
      const printIds = (extensions) => extensions.map((e) => e.value).join(",");
      this._logService.info(`AbstractExtensionService: Calling deltaExtensions: toRemove: [${printIds(toRemove)}], toAdd: [${printExtIds(toAdd)}], myToRemove: [${printIds(myToRemove)}], myToAdd: [${printExtIds(myToAdd)}],`);
    }
    await extensionHostManager.deltaExtensions({ versionId, toRemove, toAdd, addActivationEvents, myToRemove, myToAdd: myToAdd.map((extension) => extension.identifier) });
  }
  canAddExtension(extension) {
    return this._canAddExtension(extension, []);
  }
  _canAddExtension(extension, extensionsBeingRemoved) {
    const existing = this._registry.getExtensionDescriptionByIdOrUUID(extension.identifier, extension.id);
    if (existing) {
      const isBeingRemoved = extensionsBeingRemoved.some((extensionDescription) => ExtensionIdentifier.equals(extension.identifier, extensionDescription.identifier));
      if (!isBeingRemoved) {
        return false;
      }
    }
    const extensionKinds = this._runningLocations.readExtensionKinds(extension);
    const isRemote = extension.extensionLocation.scheme === Schemas.vscodeRemote;
    const extensionHostKind = this._extensionHostKindPicker.pickExtensionHostKind(extension.identifier, extensionKinds, !isRemote, isRemote, ExtensionRunningPreference.None);
    if (extensionHostKind === null) {
      return false;
    }
    return true;
  }
  canRemoveExtension(extension) {
    const extensionDescription = this._registry.getExtensionDescription(extension.identifier);
    if (!extensionDescription) {
      return false;
    }
    if (this._extensionStatus.get(extensionDescription.identifier)?.activationStarted) {
      return false;
    }
    return true;
  }
  async _activateAddedExtensionIfNeeded(extensionDescription) {
    let shouldActivate = false;
    let shouldActivateReason = null;
    let hasWorkspaceContains = false;
    const activationEvents = this._activationEventReader.readActivationEvents(extensionDescription);
    for (const activationEvent of activationEvents) {
      if (this._allRequestedActivateEvents.has(activationEvent)) {
        shouldActivate = true;
        shouldActivateReason = activationEvent;
        break;
      }
      if (activationEvent === "*") {
        shouldActivate = true;
        shouldActivateReason = activationEvent;
        break;
      }
      if (/^workspaceContains/.test(activationEvent)) {
        hasWorkspaceContains = true;
      }
      if (activationEvent === "onStartupFinished") {
        shouldActivate = true;
        shouldActivateReason = activationEvent;
        break;
      }
    }
    if (shouldActivate) {
      await Promise.all(
        this._extensionHostManagers.map((extHostManager) => extHostManager.activate(extensionDescription.identifier, { startup: false, extensionId: extensionDescription.identifier, activationEvent: shouldActivateReason }))
      ).then(() => {
      });
    } else if (hasWorkspaceContains) {
      const workspace = await this._contextService.getCompleteWorkspace();
      const forceUsingSearch = !!this._environmentService.remoteAuthority;
      const host = {
        logService: this._logService,
        folders: workspace.folders.map((folder) => folder.uri),
        forceUsingSearch,
        exists: (uri) => this._fileService.exists(uri),
        checkExists: (folders, includes2, token) => this._instantiationService.invokeFunction((accessor) => checkGlobFileExists(accessor, folders, includes2, token))
      };
      const result = await checkActivateWorkspaceContainsExtension(host, extensionDescription);
      if (!result) {
        return;
      }
      await Promise.all(
        this._extensionHostManagers.map((extHostManager) => extHostManager.activate(extensionDescription.identifier, { startup: false, extensionId: extensionDescription.identifier, activationEvent: result.activationEvent }))
      ).then(() => {
      });
    }
  }
  //#endregion
  async _initialize() {
    perf.mark("code/willLoadExtensions");
    this._startExtensionHostsIfNecessary(true, []);
    const lock = await this._registry.acquireLock("_initialize");
    try {
      await this._resolveAndProcessExtensions(lock);
      const snapshot = this._registry.getSnapshot();
      for (const extHostManager of this._extensionHostManagers) {
        if (extHostManager.startup !== ExtensionHostStartup.EagerAutoStart) {
          const extensions = this._runningLocations.filterByExtensionHostManager(snapshot.extensions, extHostManager);
          extHostManager.start(snapshot.versionId, snapshot.extensions, extensions.map((extension) => extension.identifier));
        }
      }
    } finally {
      lock.dispose();
    }
    this._releaseBarrier();
    perf.mark("code/didLoadExtensions");
    await this._handleExtensionTests();
  }
  async _resolveAndProcessExtensions(lock) {
    let resolverExtensions = [];
    let localExtensions = [];
    let remoteExtensions = [];
    for await (const extensions of this._resolveExtensions()) {
      if (extensions instanceof ResolverExtensions) {
        resolverExtensions = checkEnabledAndProposedAPI(this._logService, this._extensionEnablementService, this._extensionsProposedApi, extensions.extensions, false);
        this._registry.deltaExtensions(lock, resolverExtensions, []);
        this._doHandleExtensionPoints(resolverExtensions, true);
      }
      if (extensions instanceof LocalExtensions) {
        localExtensions = checkEnabledAndProposedAPI(this._logService, this._extensionEnablementService, this._extensionsProposedApi, extensions.extensions, false);
      }
      if (extensions instanceof RemoteExtensions) {
        remoteExtensions = checkEnabledAndProposedAPI(this._logService, this._extensionEnablementService, this._extensionsProposedApi, extensions.extensions, false);
      }
    }
    this._runningLocations.initializeRunningLocation(localExtensions, remoteExtensions);
    this._startExtensionHostsIfNecessary(true, []);
    const remoteExtensionsThatNeedToRunLocally = this._allowRemoteExtensionsInLocalWebWorker ? this._runningLocations.filterByExtensionHostKind(remoteExtensions, ExtensionHostKind.LocalWebWorker) : [];
    const localProcessExtensions = this._hasLocalProcess ? this._runningLocations.filterByExtensionHostKind(localExtensions, ExtensionHostKind.LocalProcess) : [];
    const localWebWorkerExtensions = this._runningLocations.filterByExtensionHostKind(localExtensions, ExtensionHostKind.LocalWebWorker);
    remoteExtensions = this._runningLocations.filterByExtensionHostKind(remoteExtensions, ExtensionHostKind.Remote);
    for (const ext of remoteExtensionsThatNeedToRunLocally) {
      if (!includes(localWebWorkerExtensions, ext.identifier)) {
        localWebWorkerExtensions.push(ext);
      }
    }
    const allExtensions = remoteExtensions.concat(localProcessExtensions).concat(localWebWorkerExtensions);
    let toAdd = allExtensions;
    if (resolverExtensions.length) {
      toAdd = allExtensions.filter((extension) => !resolverExtensions.some((e) => ExtensionIdentifier.equals(e.identifier, extension.identifier) && e.extensionLocation.toString() === extension.extensionLocation.toString()));
      if (allExtensions.length < toAdd.length + resolverExtensions.length) {
        const toRemove = resolverExtensions.filter((registered) => !allExtensions.some((e) => ExtensionIdentifier.equals(e.identifier, registered.identifier) && e.extensionLocation.toString() === registered.extensionLocation.toString()));
        if (toRemove.length) {
          this._registry.deltaExtensions(lock, [], toRemove.map((e) => e.identifier));
          this._doHandleExtensionPoints(toRemove, true);
        }
      }
    }
    const result = this._registry.deltaExtensions(lock, toAdd, []);
    if (result.removedDueToLooping.length > 0) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: nls.localize("looping", "The following extensions contain dependency loops and have been disabled: {0}", result.removedDueToLooping.map((e) => `'${e.identifier.value}'`).join(", "))
      });
    }
    this._doHandleExtensionPoints(this._registry.getAllExtensionDescriptions(), false);
  }
  async _handleExtensionTests() {
    if (!this._environmentService.isExtensionDevelopment || !this._environmentService.extensionTestsLocationURI) {
      return;
    }
    const extensionHostManager = this.findTestExtensionHost(this._environmentService.extensionTestsLocationURI);
    if (!extensionHostManager) {
      const msg = nls.localize("extensionTestError", "No extension host found that can launch the test runner at {0}.", this._environmentService.extensionTestsLocationURI.toString());
      console.error(msg);
      this._notificationService.error(msg);
      return;
    }
    let exitCode;
    try {
      exitCode = await extensionHostManager.extensionTestsExecute();
      if (isCI) {
        this._logService.info(`Extension host test runner exit code: ${exitCode}`);
      }
    } catch (err) {
      if (isCI) {
        this._logService.error(`Extension host test runner error`, err);
      }
      console.error(err);
      exitCode = 1;
    }
    this._onExtensionHostExit(exitCode);
  }
  findTestExtensionHost(testLocation) {
    let runningLocation = null;
    for (const extension of this._registry.getAllExtensionDescriptions()) {
      if (isEqualOrParent(testLocation, extension.extensionLocation)) {
        runningLocation = this._runningLocations.getRunningLocation(extension.identifier);
        break;
      }
    }
    if (runningLocation === null) {
      if (testLocation.scheme === Schemas.vscodeRemote) {
        runningLocation = new RemoteRunningLocation();
      } else {
        runningLocation = new LocalProcessRunningLocation(0);
      }
    }
    if (runningLocation !== null) {
      return this._extensionHostManagers.getByRunningLocation(runningLocation);
    }
    return null;
  }
  _releaseBarrier() {
    this._installedExtensionsReady.open();
    this._onDidRegisterExtensions.fire(void 0);
    this._onDidChangeExtensionsStatus.fire(this._registry.getAllExtensionDescriptions().map((e) => e.identifier));
  }
  //#region remote authority resolving
  async _resolveAuthorityInitial(remoteAuthority) {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      try {
        return this._resolveAuthorityWithLogging(remoteAuthority);
      } catch (err) {
        if (RemoteAuthorityResolverError.isNoResolverFound(err)) {
          throw err;
        }
        if (RemoteAuthorityResolverError.isNotAvailable(err)) {
          throw err;
        }
        if (attempt >= MAX_ATTEMPTS) {
          throw err;
        }
      }
    }
  }
  async _resolveAuthorityAgain() {
    const remoteAuthority = this._environmentService.remoteAuthority;
    if (!remoteAuthority) {
      return;
    }
    this._remoteAuthorityResolverService._clearResolvedAuthority(remoteAuthority);
    try {
      const result = await this._resolveAuthorityWithLogging(remoteAuthority);
      this._remoteAuthorityResolverService._setResolvedAuthority(result.authority, result.options);
    } catch (err) {
      this._remoteAuthorityResolverService._setResolvedAuthorityError(remoteAuthority, err);
    }
  }
  async _resolveAuthorityWithLogging(remoteAuthority) {
    const authorityPrefix = getRemoteAuthorityPrefix(remoteAuthority);
    const sw = StopWatch.create(false);
    this._logService.info(`Invoking resolveAuthority(${authorityPrefix})...`);
    try {
      perf.mark(`code/willResolveAuthority/${authorityPrefix}`);
      const result = await this._resolveAuthority(remoteAuthority);
      perf.mark(`code/didResolveAuthorityOK/${authorityPrefix}`);
      this._logService.info(`resolveAuthority(${authorityPrefix}) returned '${result.authority.connectTo}' after ${sw.elapsed()} ms`);
      return result;
    } catch (err) {
      perf.mark(`code/didResolveAuthorityError/${authorityPrefix}`);
      this._logService.error(`resolveAuthority(${authorityPrefix}) returned an error after ${sw.elapsed()} ms`, err);
      throw err;
    }
  }
  async _resolveAuthorityOnExtensionHosts(kind, remoteAuthority) {
    const extensionHosts = this._getExtensionHostManagers(kind);
    if (extensionHosts.length === 0) {
      throw new Error(`Cannot resolve authority`);
    }
    this._resolveAuthorityAttempt++;
    const results = await Promise.all(extensionHosts.map((extHost) => extHost.resolveAuthority(remoteAuthority, this._resolveAuthorityAttempt)));
    let bestErrorResult = null;
    for (const result of results) {
      if (result.type === "ok") {
        return result.value;
      }
      if (!bestErrorResult) {
        bestErrorResult = result;
        continue;
      }
      const bestErrorIsUnknown = bestErrorResult.error.code === RemoteAuthorityResolverErrorCode.Unknown;
      const errorIsUnknown = result.error.code === RemoteAuthorityResolverErrorCode.Unknown;
      if (bestErrorIsUnknown && !errorIsUnknown) {
        bestErrorResult = result;
      }
    }
    throw new RemoteAuthorityResolverError(bestErrorResult.error.message, bestErrorResult.error.code, bestErrorResult.error.detail);
  }
  //#endregion
  //#region Stopping / Starting / Restarting
  stopExtensionHosts(reason, auto) {
    return this._doStopExtensionHostsWithVeto(reason, auto);
  }
  async _doStopExtensionHosts() {
    const previouslyActivatedExtensionIds = [];
    for (const extensionStatus of this._extensionStatus.values()) {
      if (extensionStatus.activationStarted) {
        previouslyActivatedExtensionIds.push(extensionStatus.id);
      }
    }
    await this._extensionHostManagers.stopAllInReverse();
    for (const extensionStatus of this._extensionStatus.values()) {
      extensionStatus.clearRuntimeStatus();
    }
    if (previouslyActivatedExtensionIds.length > 0) {
      this._onDidChangeExtensionsStatus.fire(previouslyActivatedExtensionIds);
    }
  }
  async _doStopExtensionHostsWithVeto(reason, auto = false) {
    if (auto && this._environmentService.isExtensionDevelopment) {
      return false;
    }
    const vetos = [];
    const vetoReasons = /* @__PURE__ */ new Set();
    this._onWillStop.fire({
      reason,
      auto,
      veto(value, reason2) {
        vetos.push(value);
        if (typeof value === "boolean") {
          if (value === true) {
            vetoReasons.add(reason2);
          }
        } else {
          value.then((value2) => {
            if (value2) {
              vetoReasons.add(reason2);
            }
          }).catch((error) => {
            vetoReasons.add(nls.localize("extensionStopVetoError", "{0} (Error: {1})", reason2, toErrorMessage(error)));
          });
        }
      }
    });
    const veto = await handleVetos(vetos, (error) => this._logService.error(error));
    if (!veto) {
      await this._doStopExtensionHosts();
    } else {
      if (!auto) {
        const vetoReasonsArray = Array.from(vetoReasons);
        this._logService.warn(`Extension host was not stopped because of veto (stop reason: ${reason}, veto reason: ${vetoReasonsArray.join(", ")})`);
        const { confirmed } = await this._dialogService.confirm({
          type: Severity.Warning,
          message: nls.localize("extensionStopVetoMessage", "Please confirm restart of extensions."),
          detail: vetoReasonsArray.length === 1 ? vetoReasonsArray[0] : vetoReasonsArray.join("\n -"),
          primaryButton: nls.localize("proceedAnyways", "Restart Anyway")
        });
        if (confirmed) {
          return true;
        }
      }
    }
    return !veto;
  }
  _startExtensionHostsIfNecessary(isInitialStart, initialActivationEvents) {
    const locations = [];
    for (let affinity = 0; affinity <= this._runningLocations.maxLocalProcessAffinity; affinity++) {
      locations.push(new LocalProcessRunningLocation(affinity));
    }
    for (let affinity = 0; affinity <= this._runningLocations.maxLocalWebWorkerAffinity; affinity++) {
      locations.push(new LocalWebWorkerRunningLocation(affinity));
    }
    locations.push(new RemoteRunningLocation());
    for (const location of locations) {
      if (this._extensionHostManagers.getByRunningLocation(location)) {
        continue;
      }
      const res = this._createExtensionHostManager(location, isInitialStart, initialActivationEvents);
      if (res) {
        const [extHostManager, disposableStore] = res;
        this._extensionHostManagers.add(extHostManager, disposableStore);
      }
    }
  }
  _createExtensionHostManager(runningLocation, isInitialStart, initialActivationEvents) {
    const extensionHost = this._extensionHostFactory.createExtensionHost(this._runningLocations, runningLocation, isInitialStart);
    if (!extensionHost) {
      return null;
    }
    const processManager = this._doCreateExtensionHostManager(extensionHost, initialActivationEvents);
    const disposableStore = new DisposableStore();
    disposableStore.add(processManager.onDidExit(([code, signal]) => this._onExtensionHostCrashOrExit(processManager, code, signal)));
    disposableStore.add(processManager.onDidChangeResponsiveState((responsiveState) => {
      this._logService.info(`Extension host (${processManager.friendyName}) is ${responsiveState === ResponsiveState.Responsive ? "responsive" : "unresponsive"}.`);
      this._onDidChangeResponsiveChange.fire({
        extensionHostKind: processManager.kind,
        isResponsive: responsiveState === ResponsiveState.Responsive,
        getInspectListener: (tryEnableInspector) => {
          return processManager.getInspectPort(tryEnableInspector);
        }
      });
    }));
    return [processManager, disposableStore];
  }
  _doCreateExtensionHostManager(extensionHost, initialActivationEvents) {
    const internalExtensionService = this._acquireInternalAPI(extensionHost);
    if (extensionHost.startup === ExtensionHostStartup.Lazy && initialActivationEvents.length === 0) {
      return this._instantiationService.createInstance(LazyCreateExtensionHostManager, extensionHost, internalExtensionService);
    }
    return this._instantiationService.createInstance(ExtensionHostManager, extensionHost, initialActivationEvents, internalExtensionService);
  }
  _onExtensionHostCrashOrExit(extensionHost, code, signal) {
    const isExtensionDevHost = parseExtensionDevOptions(this._environmentService).isExtensionDevHost;
    if (!isExtensionDevHost) {
      this._onExtensionHostCrashed(extensionHost, code, signal);
      return;
    }
    this._onExtensionHostExit(code);
  }
  _onExtensionHostCrashed(extensionHost, code, signal) {
    console.error(`Extension host (${extensionHost.friendyName}) terminated unexpectedly. Code: ${code}, Signal: ${signal}`);
    if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
      this._doStopExtensionHosts();
    } else if (extensionHost.kind === ExtensionHostKind.Remote) {
      if (signal) {
        this._onRemoteExtensionHostCrashed(extensionHost, signal);
      }
      this._extensionHostManagers.stopOne(extensionHost);
    }
  }
  _getExtensionHostExitInfoWithTimeout(reconnectionToken) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error("getExtensionHostExitInfo timed out"));
      }, 2e3);
      this._remoteAgentService.getExtensionHostExitInfo(reconnectionToken).then(
        (r) => {
          clearTimeout(timeoutHandle);
          resolve(r);
        },
        reject
      );
    });
  }
  async _onRemoteExtensionHostCrashed(extensionHost, reconnectionToken) {
    try {
      const info = await this._getExtensionHostExitInfoWithTimeout(reconnectionToken);
      if (info) {
        this._logService.error(`Extension host (${extensionHost.friendyName}) terminated unexpectedly with code ${info.code}.`);
      }
      this._logExtensionHostCrash(extensionHost);
      this._remoteCrashTracker.registerCrash();
      if (this._remoteCrashTracker.shouldAutomaticallyRestart()) {
        this._logService.info(`Automatically restarting the remote extension host.`);
        this._notificationService.status(nls.localize("extensionService.autoRestart", "The remote extension host terminated unexpectedly. Restarting..."), { hideAfter: 5e3 });
        this._startExtensionHostsIfNecessary(false, Array.from(this._allRequestedActivateEvents.keys()));
      } else {
        this._notificationService.prompt(
          Severity.Error,
          nls.localize("extensionService.crash", "Remote Extension host terminated unexpectedly 3 times within the last 5 minutes."),
          [{
            label: nls.localize("restart", "Restart Remote Extension Host"),
            run: () => {
              this._startExtensionHostsIfNecessary(false, Array.from(this._allRequestedActivateEvents.keys()));
            }
          }]
        );
      }
    } catch (err) {
    }
  }
  _logExtensionHostCrash(extensionHost) {
    const activatedExtensions = [];
    for (const extensionStatus of this._extensionStatus.values()) {
      if (extensionStatus.activationStarted && extensionHost.containsExtension(extensionStatus.id)) {
        activatedExtensions.push(extensionStatus.id);
      }
    }
    if (activatedExtensions.length > 0) {
      this._logService.error(`Extension host (${extensionHost.friendyName}) terminated unexpectedly. The following extensions were running: ${activatedExtensions.map((id) => id.value).join(", ")}`);
    } else {
      this._logService.error(`Extension host (${extensionHost.friendyName}) terminated unexpectedly. No extensions were activated.`);
    }
  }
  async startExtensionHosts(updates) {
    await this._doStopExtensionHosts();
    if (updates) {
      await this._handleDeltaExtensions(new DeltaExtensionsQueueItem(updates.toAdd, updates.toRemove));
    }
    const lock = await this._registry.acquireLock("startExtensionHosts");
    try {
      this._startExtensionHostsIfNecessary(false, Array.from(this._allRequestedActivateEvents.keys()));
      const localProcessExtensionHosts = this._getExtensionHostManagers(ExtensionHostKind.LocalProcess);
      await Promise.all(localProcessExtensionHosts.map((extHost) => extHost.ready()));
    } finally {
      lock.dispose();
    }
  }
  //#endregion
  //#region IExtensionService
  activateByEvent(activationEvent, activationKind = ActivationKind.Normal) {
    if (this._installedExtensionsReady.isOpen()) {
      this._allRequestedActivateEvents.add(activationEvent);
      if (!this._registry.containsActivationEvent(activationEvent)) {
        return NO_OP_VOID_PROMISE;
      }
      return this._activateByEvent(activationEvent, activationKind);
    } else {
      this._allRequestedActivateEvents.add(activationEvent);
      if (activationKind === ActivationKind.Immediate) {
        return this._activateByEvent(activationEvent, activationKind);
      }
      return this._installedExtensionsReady.wait().then(() => this._activateByEvent(activationEvent, activationKind));
    }
  }
  _activateByEvent(activationEvent, activationKind) {
    const result = Promise.all(
      this._extensionHostManagers.map((extHostManager) => extHostManager.activateByEvent(activationEvent, activationKind))
    ).then(() => {
    });
    this._onWillActivateByEvent.fire({
      event: activationEvent,
      activation: result
    });
    return result;
  }
  activateById(extensionId, reason) {
    return this._activateById(extensionId, reason);
  }
  activationEventIsDone(activationEvent) {
    if (!this._installedExtensionsReady.isOpen()) {
      return false;
    }
    if (!this._registry.containsActivationEvent(activationEvent)) {
      return true;
    }
    return this._extensionHostManagers.every((manager) => manager.activationEventIsDone(activationEvent));
  }
  whenInstalledExtensionsRegistered() {
    return this._installedExtensionsReady.wait();
  }
  get extensions() {
    return this._registry.getAllExtensionDescriptions();
  }
  _getExtensionRegistrySnapshotWhenReady() {
    return this._installedExtensionsReady.wait().then(() => this._registry.getSnapshot());
  }
  getExtension(id) {
    return this._installedExtensionsReady.wait().then(() => {
      return this._registry.getExtensionDescription(id);
    });
  }
  readExtensionPointContributions(extPoint) {
    return this._installedExtensionsReady.wait().then(() => {
      const availableExtensions = this._registry.getAllExtensionDescriptions();
      const result = [];
      for (const desc of availableExtensions) {
        if (desc.contributes && hasOwnProperty.call(desc.contributes, extPoint.name)) {
          result.push(new ExtensionPointContribution(desc, desc.contributes[extPoint.name]));
        }
      }
      return result;
    });
  }
  getExtensionsStatus() {
    const result = /* @__PURE__ */ Object.create(null);
    if (this._registry) {
      const extensions = this._registry.getAllExtensionDescriptions();
      for (const extension of extensions) {
        const extensionStatus = this._extensionStatus.get(extension.identifier);
        result[extension.identifier.value] = {
          id: extension.identifier,
          messages: extensionStatus?.messages ?? [],
          activationStarted: extensionStatus?.activationStarted ?? false,
          activationTimes: extensionStatus?.activationTimes ?? void 0,
          runtimeErrors: extensionStatus?.runtimeErrors ?? [],
          runningLocation: this._runningLocations.getRunningLocation(extension.identifier)
        };
      }
    }
    return result;
  }
  async getInspectPorts(extensionHostKind, tryEnableInspector) {
    const result = await Promise.all(
      this._getExtensionHostManagers(extensionHostKind).map((extHost) => extHost.getInspectPort(tryEnableInspector))
    );
    return result.filter(isDefined);
  }
  async setRemoteEnvironment(env) {
    await this._extensionHostManagers.map((manager) => manager.setRemoteEnvironment(env));
  }
  //#endregion
  // --- impl
  _safeInvokeIsEnabled(extension) {
    try {
      return this._extensionEnablementService.isEnabled(extension);
    } catch (err) {
      return false;
    }
  }
  _doHandleExtensionPoints(affectedExtensions, onlyResolverExtensionPoints) {
    const affectedExtensionPoints = /* @__PURE__ */ Object.create(null);
    for (const extensionDescription of affectedExtensions) {
      if (extensionDescription.contributes) {
        for (const extPointName in extensionDescription.contributes) {
          if (hasOwnProperty.call(extensionDescription.contributes, extPointName)) {
            affectedExtensionPoints[extPointName] = true;
          }
        }
      }
    }
    const messageHandler = (msg) => this._handleExtensionPointMessage(msg);
    const availableExtensions = this._registry.getAllExtensionDescriptions();
    const extensionPoints = ExtensionsRegistry.getExtensionPoints();
    perf.mark(onlyResolverExtensionPoints ? "code/willHandleResolverExtensionPoints" : "code/willHandleExtensionPoints");
    for (const extensionPoint of extensionPoints) {
      if (affectedExtensionPoints[extensionPoint.name] && (!onlyResolverExtensionPoints || extensionPoint.canHandleResolver)) {
        perf.mark(`code/willHandleExtensionPoint/${extensionPoint.name}`);
        AbstractExtensionService._handleExtensionPoint(extensionPoint, availableExtensions, messageHandler);
        perf.mark(`code/didHandleExtensionPoint/${extensionPoint.name}`);
      }
    }
    perf.mark(onlyResolverExtensionPoints ? "code/didHandleResolverExtensionPoints" : "code/didHandleExtensionPoints");
  }
  _getOrCreateExtensionStatus(extensionId) {
    if (!this._extensionStatus.has(extensionId)) {
      this._extensionStatus.set(extensionId, new ExtensionStatus(extensionId));
    }
    return this._extensionStatus.get(extensionId);
  }
  _handleExtensionPointMessage(msg) {
    const extensionStatus = this._getOrCreateExtensionStatus(msg.extensionId);
    extensionStatus.addMessage(msg);
    const extension = this._registry.getExtensionDescription(msg.extensionId);
    const strMsg = `[${msg.extensionId.value}]: ${msg.message}`;
    if (msg.type === Severity.Error) {
      if (extension && extension.isUnderDevelopment) {
        this._notificationService.notify({ severity: Severity.Error, message: strMsg });
      }
      this._logService.error(strMsg);
    } else if (msg.type === Severity.Warning) {
      if (extension && extension.isUnderDevelopment) {
        this._notificationService.notify({ severity: Severity.Warning, message: strMsg });
      }
      this._logService.warn(strMsg);
    } else {
      this._logService.info(strMsg);
    }
    if (msg.extensionId && this._environmentService.isBuilt && !this._environmentService.isExtensionDevelopment) {
      const { type, extensionId, extensionPointId, message } = msg;
      this._telemetryService.publicLog2("extensionsMessage", {
        type,
        extensionId: extensionId.value,
        extensionPointId,
        message
      });
    }
  }
  static _handleExtensionPoint(extensionPoint, availableExtensions, messageHandler) {
    const users = [];
    for (const desc of availableExtensions) {
      if (desc.contributes && hasOwnProperty.call(desc.contributes, extensionPoint.name)) {
        users.push({
          description: desc,
          value: desc.contributes[extensionPoint.name],
          collector: new ExtensionMessageCollector(messageHandler, desc, extensionPoint.name)
        });
      }
    }
    extensionPoint.acceptUsers(users);
  }
  //#region Called by extension host
  _acquireInternalAPI(extensionHost) {
    return {
      _activateById: (extensionId, reason) => {
        return this._activateById(extensionId, reason);
      },
      _onWillActivateExtension: (extensionId) => {
        return this._onWillActivateExtension(extensionId, extensionHost.runningLocation);
      },
      _onDidActivateExtension: (extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason) => {
        return this._onDidActivateExtension(extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason);
      },
      _onDidActivateExtensionError: (extensionId, error) => {
        return this._onDidActivateExtensionError(extensionId, error);
      },
      _onExtensionRuntimeError: (extensionId, err) => {
        return this._onExtensionRuntimeError(extensionId, err);
      }
    };
  }
  async _activateById(extensionId, reason) {
    const results = await Promise.all(
      this._extensionHostManagers.map((manager) => manager.activate(extensionId, reason))
    );
    const activated = results.some((e) => e);
    if (!activated) {
      throw new Error(`Unknown extension ${extensionId.value}`);
    }
  }
  _onWillActivateExtension(extensionId, runningLocation) {
    this._runningLocations.set(extensionId, runningLocation);
    const extensionStatus = this._getOrCreateExtensionStatus(extensionId);
    extensionStatus.onWillActivate();
  }
  _onDidActivateExtension(extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason) {
    const extensionStatus = this._getOrCreateExtensionStatus(extensionId);
    extensionStatus.setActivationTimes(new ActivationTimes(codeLoadingTime, activateCallTime, activateResolvedTime, activationReason));
    this._onDidChangeExtensionsStatus.fire([extensionId]);
  }
  _onDidActivateExtensionError(extensionId, error) {
    this._telemetryService.publicLog2("extensionActivationError", {
      extensionId: extensionId.value,
      error: error.message
    });
  }
  _onExtensionRuntimeError(extensionId, err) {
    const extensionStatus = this._getOrCreateExtensionStatus(extensionId);
    extensionStatus.addRuntimeError(err);
    this._onDidChangeExtensionsStatus.fire([extensionId]);
  }
};
AbstractExtensionService = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IWorkbenchEnvironmentService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IWorkbenchExtensionEnablementService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IWorkbenchExtensionManagementService),
  __decorateParam(12, IWorkspaceContextService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IExtensionManifestPropertiesService),
  __decorateParam(15, ILogService),
  __decorateParam(16, IRemoteAgentService),
  __decorateParam(17, IRemoteExtensionsScannerService),
  __decorateParam(18, ILifecycleService),
  __decorateParam(19, IRemoteAuthorityResolverService),
  __decorateParam(20, IDialogService)
], AbstractExtensionService);
class ExtensionHostCollection extends Disposable {
  constructor() {
    super(...arguments);
    this._extensionHostManagers = [];
  }
  dispose() {
    for (let i = this._extensionHostManagers.length - 1; i >= 0; i--) {
      const manager = this._extensionHostManagers[i];
      manager.extensionHost.disconnect();
      manager.dispose();
    }
    this._extensionHostManagers = [];
    super.dispose();
  }
  add(extensionHostManager, disposableStore) {
    this._extensionHostManagers.push(new ExtensionHostManagerData(extensionHostManager, disposableStore));
  }
  async stopAllInReverse() {
    for (let i = this._extensionHostManagers.length - 1; i >= 0; i--) {
      const manager = this._extensionHostManagers[i];
      await manager.extensionHost.disconnect();
      manager.dispose();
    }
    this._extensionHostManagers = [];
  }
  async stopOne(extensionHostManager) {
    const index = this._extensionHostManagers.findIndex((el) => el.extensionHost === extensionHostManager);
    if (index >= 0) {
      this._extensionHostManagers.splice(index, 1);
      await extensionHostManager.disconnect();
      extensionHostManager.dispose();
    }
  }
  getByKind(kind) {
    return this.filter((el) => el.kind === kind);
  }
  getByRunningLocation(runningLocation) {
    for (const el of this._extensionHostManagers) {
      if (el.extensionHost.representsRunningLocation(runningLocation)) {
        return el.extensionHost;
      }
    }
    return null;
  }
  *[Symbol.iterator]() {
    for (const extensionHostManager of this._extensionHostManagers) {
      yield extensionHostManager.extensionHost;
    }
  }
  map(callback) {
    return this._extensionHostManagers.map((el) => callback(el.extensionHost));
  }
  every(callback) {
    return this._extensionHostManagers.every((el) => callback(el.extensionHost));
  }
  filter(callback) {
    return this._extensionHostManagers.filter((el) => callback(el.extensionHost)).map((el) => el.extensionHost);
  }
}
class ExtensionHostManagerData {
  constructor(extensionHost, disposableStore) {
    this.extensionHost = extensionHost;
    this.disposableStore = disposableStore;
  }
  dispose() {
    this.disposableStore.dispose();
    this.extensionHost.dispose();
  }
}
class ResolverExtensions {
  constructor(extensions) {
    this.extensions = extensions;
  }
}
class LocalExtensions {
  constructor(extensions) {
    this.extensions = extensions;
  }
}
class RemoteExtensions {
  constructor(extensions) {
    this.extensions = extensions;
  }
}
class DeltaExtensionsQueueItem {
  constructor(toAdd, toRemove) {
    this.toAdd = toAdd;
    this.toRemove = toRemove;
  }
}
function isResolverExtension(extension) {
  return !!extension.activationEvents?.some((activationEvent) => activationEvent.startsWith("onResolveRemoteAuthority:"));
}
function checkEnabledAndProposedAPI(logService, extensionEnablementService, extensionsProposedApi, extensions, ignoreWorkspaceTrust) {
  extensionsProposedApi.updateEnabledApiProposals(extensions);
  return filterEnabledExtensions(logService, extensionEnablementService, extensions, ignoreWorkspaceTrust);
}
function filterEnabledExtensions(logService, extensionEnablementService, extensions, ignoreWorkspaceTrust) {
  const enabledExtensions = [], extensionsToCheck = [], mappedExtensions = [];
  for (const extension of extensions) {
    if (extension.isUnderDevelopment) {
      enabledExtensions.push(extension);
    } else {
      extensionsToCheck.push(extension);
      mappedExtensions.push(toExtension(extension));
    }
  }
  const enablementStates = extensionEnablementService.getEnablementStates(mappedExtensions, ignoreWorkspaceTrust ? { trusted: true } : void 0);
  for (let index = 0; index < enablementStates.length; index++) {
    if (extensionEnablementService.isEnabledEnablementState(enablementStates[index])) {
      enabledExtensions.push(extensionsToCheck[index]);
    } else {
      if (isCI) {
        logService.info(`filterEnabledExtensions: extension '${extensionsToCheck[index].identifier.value}' is disabled`);
      }
    }
  }
  return enabledExtensions;
}
function extensionIsEnabled(logService, extensionEnablementService, extension, ignoreWorkspaceTrust) {
  return filterEnabledExtensions(logService, extensionEnablementService, [extension], ignoreWorkspaceTrust).includes(extension);
}
function includes(extensions, identifier) {
  for (const extension of extensions) {
    if (ExtensionIdentifier.equals(extension.identifier, identifier)) {
      return true;
    }
  }
  return false;
}
class ExtensionStatus {
  constructor(id) {
    this.id = id;
    this._messages = [];
    this._activationTimes = null;
    this._runtimeErrors = [];
    this._activationStarted = false;
  }
  get messages() {
    return this._messages;
  }
  get activationTimes() {
    return this._activationTimes;
  }
  get runtimeErrors() {
    return this._runtimeErrors;
  }
  get activationStarted() {
    return this._activationStarted;
  }
  clearRuntimeStatus() {
    this._activationStarted = false;
    this._activationTimes = null;
    this._runtimeErrors = [];
  }
  addMessage(msg) {
    this._messages.push(msg);
  }
  setActivationTimes(activationTimes) {
    this._activationTimes = activationTimes;
  }
  addRuntimeError(err) {
    this._runtimeErrors.push(err);
  }
  onWillActivate() {
    this._activationStarted = true;
  }
}
const _ExtensionHostCrashTracker = class _ExtensionHostCrashTracker {
  constructor() {
    this._recentCrashes = [];
  }
  _removeOldCrashes() {
    const limit = Date.now() - _ExtensionHostCrashTracker._TIME_LIMIT;
    while (this._recentCrashes.length > 0 && this._recentCrashes[0].timestamp < limit) {
      this._recentCrashes.shift();
    }
  }
  registerCrash() {
    this._removeOldCrashes();
    this._recentCrashes.push({ timestamp: Date.now() });
  }
  shouldAutomaticallyRestart() {
    this._removeOldCrashes();
    return this._recentCrashes.length < _ExtensionHostCrashTracker._CRASH_LIMIT;
  }
};
_ExtensionHostCrashTracker._TIME_LIMIT = 5 * 60 * 1e3;
// 5 minutes
_ExtensionHostCrashTracker._CRASH_LIMIT = 3;
let ExtensionHostCrashTracker = _ExtensionHostCrashTracker;
class ImplicitActivationAwareReader {
  readActivationEvents(extensionDescription) {
    return ImplicitActivationEvents.readActivationEvents(extensionDescription);
  }
}
class ActivationFeatureMarkdowneRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "markdown";
  }
  shouldRender(manifest) {
    return !!manifest.activationEvents;
  }
  render(manifest) {
    const activationEvents = manifest.activationEvents || [];
    const data = new MarkdownString();
    if (activationEvents.length) {
      for (const activationEvent of activationEvents) {
        data.appendMarkdown(`- \`${activationEvent}\`
`);
      }
    }
    return {
      data,
      dispose: () => {
      }
    };
  }
}
Registry.as(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "activationEvents",
  label: nls.localize("activation", "Activation Events"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ActivationFeatureMarkdowneRenderer)
});
export {
  AbstractExtensionService,
  ExtensionHostCrashTracker,
  ExtensionStatus,
  ImplicitActivationAwareReader,
  LocalExtensions,
  RemoteExtensions,
  ResolverExtensions,
  checkEnabledAndProposedAPI,
  extensionIsEnabled,
  filterEnabledExtensions,
  isResolverExtension
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vYWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQmFycmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBlcmYgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgaXNDSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSW5zdGFsbE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSW1wbGljaXRBY3RpdmF0aW9uRXZlbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vaW1wbGljaXRBY3RpdmF0aW9uRXZlbnRzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIEV4dGVuc2lvbklkZW50aWZpZXJNYXAsIElFeHRlbnNpb24sIElFeHRlbnNpb25Db250cmlidXRpb25zLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIElFeHRlbnNpb25NYW5pZmVzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBoYW5kbGVWZXRvcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvciwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvckNvZGUsIFJlc29sdmVyUmVzdWx0LCBnZXRSZW1vdGVBdXRob3JpdHlQcmVmaXggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IElSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUV4dGVuc2lvbnNTY2FubmVyLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgRXh0ZW5zaW9uRmVhdHVyZXNFeHRlbnNpb25zLCBJRXh0ZW5zaW9uRmVhdHVyZU1hcmtkb3duUmVuZGVyZXIsIElSZW5kZXJlZERhdGEsIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnlMb2NrLCBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5U25hcHNob3QsIElBY3RpdmF0aW9uRXZlbnRzUmVhZGVyLCBMb2NrYWJsZUV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkgfSBmcm9tICcuL2V4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcGFyc2VFeHRlbnNpb25EZXZPcHRpb25zIH0gZnJvbSAnLi9leHRlbnNpb25EZXZPcHRpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RLaW5kLCBFeHRlbnNpb25SdW5uaW5nUHJlZmVyZW5jZSwgSUV4dGVuc2lvbkhvc3RLaW5kUGlja2VyIH0gZnJvbSAnLi9leHRlbnNpb25Ib3N0S2luZC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25Ib3N0TWFuYWdlciB9IGZyb20gJy4vZXh0ZW5zaW9uSG9zdE1hbmFnZXIuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3RNYW5hZ2VyIH0gZnJvbSAnLi9leHRlbnNpb25Ib3N0TWFuYWdlcnMuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVBdXRob3JpdHlFcnJvclJlc3VsdCB9IGZyb20gJy4vZXh0ZW5zaW9uSG9zdFByb3h5LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlIH0gZnJvbSAnLi9leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbiwgTG9jYWxQcm9jZXNzUnVubmluZ0xvY2F0aW9uLCBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvbiwgUmVtb3RlUnVubmluZ0xvY2F0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25SdW5uaW5nTG9jYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uVHJhY2tlciwgZmlsdGVyRXh0ZW5zaW9uSWRlbnRpZmllcnMgfSBmcm9tICcuL2V4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIuanMnO1xuaW1wb3J0IHsgQWN0aXZhdGlvbktpbmQsIEFjdGl2YXRpb25UaW1lcywgRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbiwgRXh0ZW5zaW9uSG9zdFN0YXJ0dXAsIEV4dGVuc2lvblBvaW50Q29udHJpYnV0aW9uLCBJRXh0ZW5zaW9uSG9zdCwgSUV4dGVuc2lvblNlcnZpY2UsIElFeHRlbnNpb25zU3RhdHVzLCBJSW50ZXJuYWxFeHRlbnNpb25TZXJ2aWNlLCBJTWVzc2FnZSwgSVJlc3BvbnNpdmVTdGF0ZUNoYW5nZUV2ZW50LCBJV2lsbEFjdGl2YXRlRXZlbnQsIFdpbGxTdG9wRXh0ZW5zaW9uSG9zdHNFdmVudCwgdG9FeHRlbnNpb24sIHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpIH0gZnJvbSAnLi9leHRlbnNpb25zUHJvcG9zZWRBcGkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciwgRXh0ZW5zaW9uUG9pbnQsIEV4dGVuc2lvbnNSZWdpc3RyeSwgSUV4dGVuc2lvblBvaW50LCBJRXh0ZW5zaW9uUG9pbnRVc2VyIH0gZnJvbSAnLi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTGF6eUNyZWF0ZUV4dGVuc2lvbkhvc3RNYW5hZ2VyIH0gZnJvbSAnLi9sYXp5Q3JlYXRlRXh0ZW5zaW9uSG9zdE1hbmFnZXIuanMnO1xuaW1wb3J0IHsgUmVzcG9uc2l2ZVN0YXRlIH0gZnJvbSAnLi9ycGNQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uQWN0aXZhdGlvbkhvc3QgYXMgSVdvcmtzcGFjZUNvbnRhaW5zQWN0aXZhdGlvbkhvc3QsIGNoZWNrQWN0aXZhdGVXb3Jrc3BhY2VDb250YWluc0V4dGVuc2lvbiwgY2hlY2tHbG9iRmlsZUV4aXN0cyB9IGZyb20gJy4vd29ya3NwYWNlQ29udGFpbnMuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIFdpbGxTaHV0ZG93bkpvaW5lck9yZGVyIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3RFeGl0SW5mbywgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcblxuY29uc3QgaGFzT3duUHJvcGVydHkgPSBPYmplY3QuaGFzT3duUHJvcGVydHk7XG5jb25zdCBOT19PUF9WT0lEX1BST01JU0UgPSBQcm9taXNlLnJlc29sdmU8dm9pZD4odW5kZWZpbmVkKTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uU2VydmljZSB7XG5cblx0cHVibGljIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNMb2NhbFByb2Nlc3M6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FsbG93UmVtb3RlRXh0ZW5zaW9uc0luTG9jYWxXZWJXb3JrZXI6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWdpc3RlckV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkUmVnaXN0ZXJFeHRlbnNpb25zID0gdGhpcy5fb25EaWRSZWdpc3RlckV4dGVuc2lvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VFeHRlbnNpb25zU3RhdHVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXh0ZW5zaW9uSWRlbnRpZmllcltdPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlRXh0ZW5zaW9uc1N0YXR1cyA9IHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9uc1N0YXR1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHJlYWRvbmx5IGFkZGVkOiBSZWFkb25seUFycmF5PElFeHRlbnNpb25EZXNjcmlwdGlvbj47IHJlYWRvbmx5IHJlbW92ZWQ6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbkRlc2NyaXB0aW9uPiB9Pih7IGxlYWtXYXJuaW5nVGhyZXNob2xkOiA0MDAgfSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VFeHRlbnNpb25zID0gdGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbEFjdGl2YXRlQnlFdmVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElXaWxsQWN0aXZhdGVFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbldpbGxBY3RpdmF0ZUJ5RXZlbnQgPSB0aGlzLl9vbldpbGxBY3RpdmF0ZUJ5RXZlbnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZXNwb25zaXZlQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVJlc3BvbnNpdmVTdGF0ZUNoYW5nZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVzcG9uc2l2ZUNoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlUmVzcG9uc2l2ZUNoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxTdG9wID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8V2lsbFN0b3BFeHRlbnNpb25Ib3N0c0V2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uV2lsbFN0b3AgPSB0aGlzLl9vbldpbGxTdG9wLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2YXRpb25FdmVudFJlYWRlciA9IG5ldyBJbXBsaWNpdEFjdGl2YXRpb25Bd2FyZVJlYWRlcigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWdpc3RyeSA9IG5ldyBMb2NrYWJsZUV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkodGhpcy5fYWN0aXZhdGlvbkV2ZW50UmVhZGVyKTtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5zdGFsbGVkRXh0ZW5zaW9uc1JlYWR5ID0gbmV3IEJhcnJpZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU3RhdHVzID0gbmV3IEV4dGVuc2lvbklkZW50aWZpZXJNYXA8RXh0ZW5zaW9uU3RhdHVzPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hbGxSZXF1ZXN0ZWRBY3RpdmF0ZUV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ydW5uaW5nTG9jYXRpb25zOiBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb25UcmFja2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVDcmFzaFRyYWNrZXIgPSBuZXcgRXh0ZW5zaW9uSG9zdENyYXNoVHJhY2tlcigpO1xuXG5cdHByaXZhdGUgX2RlbHRhRXh0ZW5zaW9uc1F1ZXVlOiBEZWx0YUV4dGVuc2lvbnNRdWV1ZUl0ZW1bXSA9IFtdO1xuXHRwcml2YXRlIF9pbkhhbmRsZURlbHRhRXh0ZW5zaW9ucyA9IGZhbHNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkhvc3RNYW5hZ2VycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFeHRlbnNpb25Ib3N0Q29sbGVjdGlvbigpKTtcblxuXHRwcml2YXRlIF9yZXNvbHZlQXV0aG9yaXR5QXR0ZW1wdDogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiB7IGhhc0xvY2FsUHJvY2VzczogYm9vbGVhbjsgYWxsb3dSZW1vdGVFeHRlbnNpb25zSW5Mb2NhbFdlYldvcmtlcjogYm9vbGVhbiB9LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbnNQcm9wb3NlZEFwaTogRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkhvc3RGYWN0b3J5OiBJRXh0ZW5zaW9uSG9zdEZhY3RvcnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uSG9zdEtpbmRQaWNrZXI6IElFeHRlbnNpb25Ib3N0S2luZFBpY2tlcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2Vudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfcmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9saWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX3JlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZTogSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9oYXNMb2NhbFByb2Nlc3MgPSBvcHRpb25zLmhhc0xvY2FsUHJvY2Vzcztcblx0XHR0aGlzLl9hbGxvd1JlbW90ZUV4dGVuc2lvbnNJbkxvY2FsV2ViV29ya2VyID0gb3B0aW9ucy5hbGxvd1JlbW90ZUV4dGVuc2lvbnNJbkxvY2FsV2ViV29ya2VyO1xuXG5cdFx0Ly8gaGVscCB0aGUgZmlsZSBzZXJ2aWNlIHRvIGFjdGl2YXRlIHByb3ZpZGVycyBieSBhY3RpdmF0aW5nIGV4dGVuc2lvbnMgYnkgZmlsZSBzeXN0ZW0gZXZlbnRcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maWxlU2VydmljZS5vbldpbGxBY3RpdmF0ZUZpbGVTeXN0ZW1Qcm92aWRlcihlID0+IHtcblx0XHRcdGlmIChlLnNjaGVtZSAhPT0gU2NoZW1hcy52c2NvZGVSZW1vdGUpIHtcblx0XHRcdFx0ZS5qb2luKHRoaXMuYWN0aXZhdGVCeUV2ZW50KGBvbkZpbGVTeXN0ZW06JHtlLnNjaGVtZX1gKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcnVubmluZ0xvY2F0aW9ucyA9IG5ldyBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb25UcmFja2VyKFxuXHRcdFx0dGhpcy5fcmVnaXN0cnksXG5cdFx0XHR0aGlzLl9leHRlbnNpb25Ib3N0S2luZFBpY2tlcixcblx0XHRcdHRoaXMuX2Vudmlyb25tZW50U2VydmljZSxcblx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0dGhpcy5fbG9nU2VydmljZSxcblx0XHRcdHRoaXMuX2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2Vcblx0XHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2Uub25FbmFibGVtZW50Q2hhbmdlZCgoZXh0ZW5zaW9ucykgPT4ge1xuXHRcdFx0Y29uc3QgdG9BZGQ6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgdG9SZW1vdmU6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRpZiAodGhpcy5fc2FmZUludm9rZUlzRW5hYmxlZChleHRlbnNpb24pKSB7XG5cdFx0XHRcdFx0Ly8gYW4gZXh0ZW5zaW9uIGhhcyBiZWVuIGVuYWJsZWRcblx0XHRcdFx0XHR0b0FkZC5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gYW4gZXh0ZW5zaW9uIGhhcyBiZWVuIGRpc2FibGVkXG5cdFx0XHRcdFx0dG9SZW1vdmUucHVzaChleHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZS5vbkVuYWJsZW1lbnRDaGFuZ2VkIGZpcmVkIGZvciAke2V4dGVuc2lvbnMubWFwKGUgPT4gZS5pZGVudGlmaWVyLmlkKS5qb2luKCcsICcpfWApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5faGFuZGxlRGVsdGFFeHRlbnNpb25zKG5ldyBEZWx0YUV4dGVuc2lvbnNRdWV1ZUl0ZW0odG9BZGQsIHRvUmVtb3ZlKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VQcm9maWxlKCh7IGFkZGVkLCByZW1vdmVkIH0pID0+IHtcblx0XHRcdGlmIChhZGRlZC5sZW5ndGggfHwgcmVtb3ZlZC5sZW5ndGgpIHtcblx0XHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZVByb2ZpbGUgZmlyZWRgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9oYW5kbGVEZWx0YUV4dGVuc2lvbnMobmV3IERlbHRhRXh0ZW5zaW9uc1F1ZXVlSXRlbShhZGRlZCwgcmVtb3ZlZCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkRW5hYmxlRXh0ZW5zaW9ucyhleHRlbnNpb25zID0+IHtcblx0XHRcdGlmIChleHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlLm9uRGlkRW5hYmxlRXh0ZW5zaW9ucyBmaXJlZGApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2hhbmRsZURlbHRhRXh0ZW5zaW9ucyhuZXcgRGVsdGFFeHRlbnNpb25zUXVldWVJdGVtKGV4dGVuc2lvbnMsIFtdKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRJbnN0YWxsRXh0ZW5zaW9ucygocmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgeyBsb2NhbCwgb3BlcmF0aW9uIH0gb2YgcmVzdWx0KSB7XG5cdFx0XHRcdGlmIChsb2NhbCAmJiBsb2NhbC5pc1ZhbGlkICYmIG9wZXJhdGlvbiAhPT0gSW5zdGFsbE9wZXJhdGlvbi5NaWdyYXRlICYmIHRoaXMuX3NhZmVJbnZva2VJc0VuYWJsZWQobG9jYWwpKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKGxvY2FsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBBYnN0cmFjdEV4dGVuc2lvblNlcnZpY2Uub25EaWRJbnN0YWxsRXh0ZW5zaW9ucyBmaXJlZCBmb3IgJHtleHRlbnNpb25zLm1hcChlID0+IGUuaWRlbnRpZmllci5pZCkuam9pbignLCAnKX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9oYW5kbGVEZWx0YUV4dGVuc2lvbnMobmV3IERlbHRhRXh0ZW5zaW9uc1F1ZXVlSXRlbShleHRlbnNpb25zLCBbXSkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uKChldmVudCkgPT4ge1xuXHRcdFx0aWYgKCFldmVudC5lcnJvcikge1xuXHRcdFx0XHQvLyBhbiBleHRlbnNpb24gaGFzIGJlZW4gdW5pbnN0YWxsZWRcblx0XHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbiBmaXJlZCBmb3IgJHtldmVudC5pZGVudGlmaWVyLmlkfWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2hhbmRsZURlbHRhRXh0ZW5zaW9ucyhuZXcgRGVsdGFFeHRlbnNpb25zUXVldWVJdGVtKFtdLCBbZXZlbnQuaWRlbnRpZmllci5pZF0pKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGV2ZW50ID0+IHtcblx0XHRcdGlmICh0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpKSB7XG5cdFx0XHRcdGV2ZW50LmpvaW4oYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdC8vIFdlIG5lZWQgdG8gZGlzY29ubmVjdCB0aGUgbWFuYWdlbWVudCBjb25uZWN0aW9uIGJlZm9yZSBraWxsaW5nIHRoZSBsb2NhbCBleHRlbnNpb24gaG9zdC5cblx0XHRcdFx0XHQvLyBPdGhlcndpc2UsIHRoZSBsb2NhbCBleHRlbnNpb24gaG9zdCBtaWdodCB0ZXJtaW5hdGUgdGhlIHVuZGVybHlpbmcgdHVubmVsIGJlZm9yZSB0aGVcblx0XHRcdFx0XHQvLyBtYW5hZ2VtZW50IGNvbm5lY3Rpb24gaGFzIGEgY2hhbmNlIHRvIHNlbmQgaXRzIGRpc2Nvbm5lY3Rpb24gbWVzc2FnZS5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmVuZENvbm5lY3Rpb24oKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2RvU3RvcEV4dGVuc2lvbkhvc3RzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpPy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ0Vycm9yIHdoaWxlIGRpc2Nvbm5lY3RpbmcgcmVtb3RlIGFnZW50Jyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6ICdqb2luLmRpc2Nvbm5lY3RSZW1vdGUnLFxuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2Rpc2Nvbm5lY3RSZW1vdGUnLCBcIkRpc2Nvbm5lY3QgUmVtb3RlIEFnZW50XCIpLFxuXHRcdFx0XHRcdG9yZGVyOiBXaWxsU2h1dGRvd25Kb2luZXJPcmRlci5MYXN0IC8vIGFmdGVyIG90aGVycyBoYXZlIGpvaW5lZCB0aGF0IG1pZ2h0IGRlcGVuZCBvbiBhIHJlbW90ZSBjb25uZWN0aW9uXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXZlbnQuam9pbih0aGlzLl9kb1N0b3BFeHRlbnNpb25Ib3N0cygpLCB7XG5cdFx0XHRcdFx0aWQ6ICdqb2luLnN0b3BFeHRlbnNpb25Ib3N0cycsXG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnc3RvcEV4dGVuc2lvbkhvc3RzJywgXCJTdG9wcGluZyBFeHRlbnNpb24gSG9zdHNcIiksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0RXh0ZW5zaW9uSG9zdE1hbmFnZXJzKGtpbmQ6IEV4dGVuc2lvbkhvc3RLaW5kKTogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyW10ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMuZ2V0QnlLaW5kKGtpbmQpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIGRlbHRhRXh0ZW5zaW9uc1xuXG5cdHByaXZhdGUgYXN5bmMgX2hhbmRsZURlbHRhRXh0ZW5zaW9ucyhpdGVtOiBEZWx0YUV4dGVuc2lvbnNRdWV1ZUl0ZW0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9kZWx0YUV4dGVuc2lvbnNRdWV1ZS5wdXNoKGl0ZW0pO1xuXHRcdGlmICh0aGlzLl9pbkhhbmRsZURlbHRhRXh0ZW5zaW9ucykge1xuXHRcdFx0Ly8gTGV0IHRoZSBjdXJyZW50IGl0ZW0gZmluaXNoLCB0aGUgbmV3IG9uZSB3aWxsIGJlIHBpY2tlZCB1cFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBsb2NrOiBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5TG9jayB8IG51bGwgPSBudWxsO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9pbkhhbmRsZURlbHRhRXh0ZW5zaW9ucyA9IHRydWU7XG5cblx0XHRcdC8vIHdhaXQgZm9yIF9pbml0aWFsaXplIHRvIGZpbmlzaCBiZWZvcmUgaGFubGRpbmcgYW55IGRlbHRhIGV4dGVuc2lvbiBldmVudHNcblx0XHRcdGF3YWl0IHRoaXMuX2luc3RhbGxlZEV4dGVuc2lvbnNSZWFkeS53YWl0KCk7XG5cblx0XHRcdGxvY2sgPSBhd2FpdCB0aGlzLl9yZWdpc3RyeS5hY3F1aXJlTG9jaygnaGFuZGxlRGVsdGFFeHRlbnNpb25zJyk7XG5cdFx0XHR3aGlsZSAodGhpcy5fZGVsdGFFeHRlbnNpb25zUXVldWUubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5fZGVsdGFFeHRlbnNpb25zUXVldWUuc2hpZnQoKSE7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX2RlbHRhRXh0ZW5zaW9ucyhsb2NrLCBpdGVtLnRvQWRkLCBpdGVtLnRvUmVtb3ZlKTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faW5IYW5kbGVEZWx0YUV4dGVuc2lvbnMgPSBmYWxzZTtcblx0XHRcdGxvY2s/LmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kZWx0YUV4dGVuc2lvbnMobG9jazogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeUxvY2ssIF90b0FkZDogSUV4dGVuc2lvbltdLCBfdG9SZW1vdmU6IHN0cmluZ1tdIHwgSUV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzQ0kpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQWJzdHJhY3RFeHRlbnNpb25TZXJ2aWNlLl9kZWx0YUV4dGVuc2lvbnM6IHRvQWRkOiBbJHtfdG9BZGQubWFwKGUgPT4gZS5pZGVudGlmaWVyLmlkKS5qb2luKCcsJyl9XSB0b1JlbW92ZTogWyR7X3RvUmVtb3ZlLm1hcChlID0+IHR5cGVvZiBlID09PSAnc3RyaW5nJyA/IGUgOiBlLmlkZW50aWZpZXIuaWQpLmpvaW4oJywnKX1dYCk7XG5cdFx0fVxuXHRcdGxldCB0b1JlbW92ZTogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gX3RvUmVtb3ZlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25PcklkID0gX3RvUmVtb3ZlW2ldO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSAodHlwZW9mIGV4dGVuc2lvbk9ySWQgPT09ICdzdHJpbmcnID8gZXh0ZW5zaW9uT3JJZCA6IGV4dGVuc2lvbk9ySWQuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRjb25zdCBleHRlbnNpb24gPSAodHlwZW9mIGV4dGVuc2lvbk9ySWQgPT09ICdzdHJpbmcnID8gbnVsbCA6IGV4dGVuc2lvbk9ySWQpO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uRGVzY3JpcHRpb24gPSB0aGlzLl9yZWdpc3RyeS5nZXRFeHRlbnNpb25EZXNjcmlwdGlvbihleHRlbnNpb25JZCk7XG5cdFx0XHRpZiAoIWV4dGVuc2lvbkRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSBkaXNhYmxpbmcvdW5pbnN0YWxsaW5nIGFuIGV4dGVuc2lvbiB3aGljaCBpcyBub3QgcnVubmluZ1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dGVuc2lvbiAmJiBleHRlbnNpb25EZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbi5zY2hlbWUgIT09IGV4dGVuc2lvbi5sb2NhdGlvbi5zY2hlbWUpIHtcblx0XHRcdFx0Ly8gdGhpcyBldmVudCBpcyBmb3IgYSBkaWZmZXJlbnQgZXh0ZW5zaW9uIHRoYW4gbWluZSAobWF5YmUgZm9yIHRoZSBsb2NhbCBleHRlbnNpb24sIHdoaWxlIEkgaGF2ZSB0aGUgcmVtb3RlIGV4dGVuc2lvbilcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5jYW5SZW1vdmVFeHRlbnNpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb24pKSB7XG5cdFx0XHRcdC8vIHVzZXMgbm9uLWR5bmFtaWMgZXh0ZW5zaW9uIHBvaW50IG9yIGlzIGFjdGl2YXRlZFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dG9SZW1vdmUucHVzaChleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9BZGQ6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IF90b0FkZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gX3RvQWRkW2ldO1xuXG5cdFx0XHRjb25zdCBleHRlbnNpb25EZXNjcmlwdGlvbiA9IHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oZXh0ZW5zaW9uLCBmYWxzZSk7XG5cdFx0XHRpZiAoIWV4dGVuc2lvbkRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdC8vIGNvdWxkIG5vdCBzY2FuIGV4dGVuc2lvbi4uLlxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl9jYW5BZGRFeHRlbnNpb24oZXh0ZW5zaW9uRGVzY3JpcHRpb24sIHRvUmVtb3ZlKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dG9BZGQucHVzaChleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0fVxuXG5cdFx0aWYgKHRvQWRkLmxlbmd0aCA9PT0gMCAmJiB0b1JlbW92ZS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdGhlIGxvY2FsIHJlZ2lzdHJ5XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fcmVnaXN0cnkuZGVsdGFFeHRlbnNpb25zKGxvY2ssIHRvQWRkLCB0b1JlbW92ZS5tYXAoZSA9PiBlLmlkZW50aWZpZXIpKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnMuZmlyZSh7IGFkZGVkOiB0b0FkZCwgcmVtb3ZlZDogdG9SZW1vdmUgfSk7XG5cblx0XHR0b1JlbW92ZSA9IHRvUmVtb3ZlLmNvbmNhdChyZXN1bHQucmVtb3ZlZER1ZVRvTG9vcGluZyk7XG5cdFx0aWYgKHJlc3VsdC5yZW1vdmVkRHVlVG9Mb29waW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2xvb3BpbmcnLCBcIlRoZSBmb2xsb3dpbmcgZXh0ZW5zaW9ucyBjb250YWluIGRlcGVuZGVuY3kgbG9vcHMgYW5kIGhhdmUgYmVlbiBkaXNhYmxlZDogezB9XCIsIHJlc3VsdC5yZW1vdmVkRHVlVG9Mb29waW5nLm1hcChlID0+IGAnJHtlLmlkZW50aWZpZXIudmFsdWV9J2ApLmpvaW4oJywgJykpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBlbmFibGUgb3IgZGlzYWJsZSBwcm9wb3NlZCBBUEkgcGVyIGV4dGVuc2lvblxuXHRcdHRoaXMuX2V4dGVuc2lvbnNQcm9wb3NlZEFwaS51cGRhdGVFbmFibGVkQXBpUHJvcG9zYWxzKHRvQWRkKTtcblxuXHRcdC8vIFVwZGF0ZSBleHRlbnNpb24gcG9pbnRzXG5cdFx0dGhpcy5fZG9IYW5kbGVFeHRlbnNpb25Qb2ludHMoKDxJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXT5bXSkuY29uY2F0KHRvQWRkKS5jb25jYXQodG9SZW1vdmUpLCBmYWxzZSk7XG5cblx0XHQvLyBVcGRhdGUgdGhlIGV4dGVuc2lvbiBob3N0XG5cdFx0YXdhaXQgdGhpcy5fdXBkYXRlRXh0ZW5zaW9uc09uRXh0SG9zdHMocmVzdWx0LnZlcnNpb25JZCwgdG9BZGQsIHRvUmVtb3ZlLm1hcChlID0+IGUuaWRlbnRpZmllcikpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0b0FkZC5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVBZGRlZEV4dGVuc2lvbklmTmVlZGVkKHRvQWRkW2ldKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVFeHRlbnNpb25zT25FeHRIb3N0cyh2ZXJzaW9uSWQ6IG51bWJlciwgdG9BZGQ6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdLCB0b1JlbW92ZTogRXh0ZW5zaW9uSWRlbnRpZmllcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVtb3ZlZFJ1bm5pbmdMb2NhdGlvbiA9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuZGVsdGFFeHRlbnNpb25zKHRvQWRkLCB0b1JlbW92ZSk7XG5cdFx0Y29uc3QgcHJvbWlzZXMgPSB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMubWFwKFxuXHRcdFx0ZXh0SG9zdE1hbmFnZXIgPT4gdGhpcy5fdXBkYXRlRXh0ZW5zaW9uc09uRXh0SG9zdChleHRIb3N0TWFuYWdlciwgdmVyc2lvbklkLCB0b0FkZCwgdG9SZW1vdmUsIHJlbW92ZWRSdW5uaW5nTG9jYXRpb24pXG5cdFx0KTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVFeHRlbnNpb25zT25FeHRIb3N0KGV4dGVuc2lvbkhvc3RNYW5hZ2VyOiBJRXh0ZW5zaW9uSG9zdE1hbmFnZXIsIHZlcnNpb25JZDogbnVtYmVyLCB0b0FkZDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIHRvUmVtb3ZlOiBFeHRlbnNpb25JZGVudGlmaWVyW10sIHJlbW92ZWRSdW5uaW5nTG9jYXRpb246IEV4dGVuc2lvbklkZW50aWZpZXJNYXA8RXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uIHwgbnVsbD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBteVRvQWRkID0gdGhpcy5fcnVubmluZ0xvY2F0aW9ucy5maWx0ZXJCeUV4dGVuc2lvbkhvc3RNYW5hZ2VyKHRvQWRkLCBleHRlbnNpb25Ib3N0TWFuYWdlcik7XG5cdFx0Y29uc3QgbXlUb1JlbW92ZSA9IGZpbHRlckV4dGVuc2lvbklkZW50aWZpZXJzKHRvUmVtb3ZlLCByZW1vdmVkUnVubmluZ0xvY2F0aW9uLCBleHRSdW5uaW5nTG9jYXRpb24gPT4gZXh0ZW5zaW9uSG9zdE1hbmFnZXIucmVwcmVzZW50c1J1bm5pbmdMb2NhdGlvbihleHRSdW5uaW5nTG9jYXRpb24pKTtcblx0XHRjb25zdCBhZGRBY3RpdmF0aW9uRXZlbnRzID0gSW1wbGljaXRBY3RpdmF0aW9uRXZlbnRzLmNyZWF0ZUFjdGl2YXRpb25FdmVudHNNYXAodG9BZGQpO1xuXHRcdGlmIChpc0NJKSB7XG5cdFx0XHRjb25zdCBwcmludEV4dElkcyA9IChleHRlbnNpb25zOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSkgPT4gZXh0ZW5zaW9ucy5tYXAoZSA9PiBlLmlkZW50aWZpZXIudmFsdWUpLmpvaW4oJywnKTtcblx0XHRcdGNvbnN0IHByaW50SWRzID0gKGV4dGVuc2lvbnM6IEV4dGVuc2lvbklkZW50aWZpZXJbXSkgPT4gZXh0ZW5zaW9ucy5tYXAoZSA9PiBlLnZhbHVlKS5qb2luKCcsJyk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEFic3RyYWN0RXh0ZW5zaW9uU2VydmljZTogQ2FsbGluZyBkZWx0YUV4dGVuc2lvbnM6IHRvUmVtb3ZlOiBbJHtwcmludElkcyh0b1JlbW92ZSl9XSwgdG9BZGQ6IFske3ByaW50RXh0SWRzKHRvQWRkKX1dLCBteVRvUmVtb3ZlOiBbJHtwcmludElkcyhteVRvUmVtb3ZlKX1dLCBteVRvQWRkOiBbJHtwcmludEV4dElkcyhteVRvQWRkKX1dLGApO1xuXHRcdH1cblx0XHRhd2FpdCBleHRlbnNpb25Ib3N0TWFuYWdlci5kZWx0YUV4dGVuc2lvbnMoeyB2ZXJzaW9uSWQsIHRvUmVtb3ZlLCB0b0FkZCwgYWRkQWN0aXZhdGlvbkV2ZW50cywgbXlUb1JlbW92ZSwgbXlUb0FkZDogbXlUb0FkZC5tYXAoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyKSB9KTtcblx0fVxuXG5cdHB1YmxpYyBjYW5BZGRFeHRlbnNpb24oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuQWRkRXh0ZW5zaW9uKGV4dGVuc2lvbiwgW10pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2FuQWRkRXh0ZW5zaW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBleHRlbnNpb25zQmVpbmdSZW1vdmVkOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSk6IGJvb2xlYW4ge1xuXHRcdC8vIChBbHNvIGNoZWNrIGZvciByZW5hbWVkIGV4dGVuc2lvbnMpXG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9yZWdpc3RyeS5nZXRFeHRlbnNpb25EZXNjcmlwdGlvbkJ5SWRPclVVSUQoZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZCk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHQvLyBUaGlzIGV4dGVuc2lvbiBpcyBhbHJlYWR5IGtub3duIChtb3N0IGxpa2VseSBhdCBhIGRpZmZlcmVudCB2ZXJzaW9uKVxuXHRcdFx0Ly8gc28gaXQgY2Fubm90IGJlIGFkZGVkIGFnYWluIHVubGVzcyBpdCBpcyByZW1vdmVkIGZpcnN0XG5cdFx0XHRjb25zdCBpc0JlaW5nUmVtb3ZlZCA9IGV4dGVuc2lvbnNCZWluZ1JlbW92ZWQuc29tZSgoZXh0ZW5zaW9uRGVzY3JpcHRpb24pID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRpZiAoIWlzQmVpbmdSZW1vdmVkKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25LaW5kcyA9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMucmVhZEV4dGVuc2lvbktpbmRzKGV4dGVuc2lvbik7XG5cdFx0Y29uc3QgaXNSZW1vdGUgPSBleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRjb25zdCBleHRlbnNpb25Ib3N0S2luZCA9IHRoaXMuX2V4dGVuc2lvbkhvc3RLaW5kUGlja2VyLnBpY2tFeHRlbnNpb25Ib3N0S2luZChleHRlbnNpb24uaWRlbnRpZmllciwgZXh0ZW5zaW9uS2luZHMsICFpc1JlbW90ZSwgaXNSZW1vdGUsIEV4dGVuc2lvblJ1bm5pbmdQcmVmZXJlbmNlLk5vbmUpO1xuXHRcdGlmIChleHRlbnNpb25Ib3N0S2luZCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGNhblJlbW92ZUV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkRlc2NyaXB0aW9uID0gdGhpcy5fcmVnaXN0cnkuZ2V0RXh0ZW5zaW9uRGVzY3JpcHRpb24oZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdGlmICghZXh0ZW5zaW9uRGVzY3JpcHRpb24pIHtcblx0XHRcdC8vIENhbid0IHJlbW92ZSBhbiBleHRlbnNpb24gdGhhdCBpcyB1bmtub3duIVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9leHRlbnNpb25TdGF0dXMuZ2V0KGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIpPy5hY3RpdmF0aW9uU3RhcnRlZCkge1xuXHRcdFx0Ly8gRXh0ZW5zaW9uIGlzIHJ1bm5pbmcsIGNhbm5vdCByZW1vdmUgaXQgc2FmZWx5XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hY3RpdmF0ZUFkZGVkRXh0ZW5zaW9uSWZOZWVkZWQoZXh0ZW5zaW9uRGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBzaG91bGRBY3RpdmF0ZSA9IGZhbHNlO1xuXHRcdGxldCBzaG91bGRBY3RpdmF0ZVJlYXNvbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IGhhc1dvcmtzcGFjZUNvbnRhaW5zID0gZmFsc2U7XG5cdFx0Y29uc3QgYWN0aXZhdGlvbkV2ZW50cyA9IHRoaXMuX2FjdGl2YXRpb25FdmVudFJlYWRlci5yZWFkQWN0aXZhdGlvbkV2ZW50cyhleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0Zm9yIChjb25zdCBhY3RpdmF0aW9uRXZlbnQgb2YgYWN0aXZhdGlvbkV2ZW50cykge1xuXHRcdFx0aWYgKHRoaXMuX2FsbFJlcXVlc3RlZEFjdGl2YXRlRXZlbnRzLmhhcyhhY3RpdmF0aW9uRXZlbnQpKSB7XG5cdFx0XHRcdC8vIFRoaXMgYWN0aXZhdGlvbiBldmVudCB3YXMgZmlyZWQgYmVmb3JlIHRoZSBleHRlbnNpb24gd2FzIGFkZGVkXG5cdFx0XHRcdHNob3VsZEFjdGl2YXRlID0gdHJ1ZTtcblx0XHRcdFx0c2hvdWxkQWN0aXZhdGVSZWFzb24gPSBhY3RpdmF0aW9uRXZlbnQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYWN0aXZhdGlvbkV2ZW50ID09PSAnKicpIHtcblx0XHRcdFx0c2hvdWxkQWN0aXZhdGUgPSB0cnVlO1xuXHRcdFx0XHRzaG91bGRBY3RpdmF0ZVJlYXNvbiA9IGFjdGl2YXRpb25FdmVudDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgvXndvcmtzcGFjZUNvbnRhaW5zLy50ZXN0KGFjdGl2YXRpb25FdmVudCkpIHtcblx0XHRcdFx0aGFzV29ya3NwYWNlQ29udGFpbnMgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYWN0aXZhdGlvbkV2ZW50ID09PSAnb25TdGFydHVwRmluaXNoZWQnKSB7XG5cdFx0XHRcdHNob3VsZEFjdGl2YXRlID0gdHJ1ZTtcblx0XHRcdFx0c2hvdWxkQWN0aXZhdGVSZWFzb24gPSBhY3RpdmF0aW9uRXZlbnQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzaG91bGRBY3RpdmF0ZSkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoXG5cdFx0XHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5tYXAoZXh0SG9zdE1hbmFnZXIgPT4gZXh0SG9zdE1hbmFnZXIuYWN0aXZhdGUoZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllciwgeyBzdGFydHVwOiBmYWxzZSwgZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIGFjdGl2YXRpb25FdmVudDogc2hvdWxkQWN0aXZhdGVSZWFzb24hIH0pKVxuXHRcdFx0KS50aGVuKCgpID0+IHsgfSk7XG5cdFx0fSBlbHNlIGlmIChoYXNXb3Jrc3BhY2VDb250YWlucykge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0Q29tcGxldGVXb3Jrc3BhY2UoKTtcblx0XHRcdGNvbnN0IGZvcmNlVXNpbmdTZWFyY2ggPSAhIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0XHRjb25zdCBob3N0OiBJV29ya3NwYWNlQ29udGFpbnNBY3RpdmF0aW9uSG9zdCA9IHtcblx0XHRcdFx0bG9nU2VydmljZTogdGhpcy5fbG9nU2VydmljZSxcblx0XHRcdFx0Zm9sZGVyczogd29ya3NwYWNlLmZvbGRlcnMubWFwKGZvbGRlciA9PiBmb2xkZXIudXJpKSxcblx0XHRcdFx0Zm9yY2VVc2luZ1NlYXJjaDogZm9yY2VVc2luZ1NlYXJjaCxcblx0XHRcdFx0ZXhpc3RzOiAodXJpKSA9PiB0aGlzLl9maWxlU2VydmljZS5leGlzdHModXJpKSxcblx0XHRcdFx0Y2hlY2tFeGlzdHM6IChmb2xkZXJzLCBpbmNsdWRlcywgdG9rZW4pID0+IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4gY2hlY2tHbG9iRmlsZUV4aXN0cyhhY2Nlc3NvciwgZm9sZGVycywgaW5jbHVkZXMsIHRva2VuKSlcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrQWN0aXZhdGVXb3Jrc3BhY2VDb250YWluc0V4dGVuc2lvbihob3N0LCBleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKFxuXHRcdFx0XHR0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMubWFwKGV4dEhvc3RNYW5hZ2VyID0+IGV4dEhvc3RNYW5hZ2VyLmFjdGl2YXRlKGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIHsgc3RhcnR1cDogZmFsc2UsIGV4dGVuc2lvbklkOiBleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBhY3RpdmF0aW9uRXZlbnQ6IHJlc3VsdC5hY3RpdmF0aW9uRXZlbnQgfSkpXG5cdFx0XHQpLnRoZW4oKCkgPT4geyB9KTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX2luaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cGVyZi5tYXJrKCdjb2RlL3dpbGxMb2FkRXh0ZW5zaW9ucycpO1xuXHRcdHRoaXMuX3N0YXJ0RXh0ZW5zaW9uSG9zdHNJZk5lY2Vzc2FyeSh0cnVlLCBbXSk7XG5cblx0XHRjb25zdCBsb2NrID0gYXdhaXQgdGhpcy5fcmVnaXN0cnkuYWNxdWlyZUxvY2soJ19pbml0aWFsaXplJyk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVBbmRQcm9jZXNzRXh0ZW5zaW9ucyhsb2NrKTtcblx0XHRcdC8vIFN0YXJ0IGV4dGVuc2lvbiBob3N0cyB3aGljaCBhcmUgbm90IGF1dG9tYXRpY2FsbHkgc3RhcnRlZFxuXHRcdFx0Y29uc3Qgc25hcHNob3QgPSB0aGlzLl9yZWdpc3RyeS5nZXRTbmFwc2hvdCgpO1xuXHRcdFx0Zm9yIChjb25zdCBleHRIb3N0TWFuYWdlciBvZiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMpIHtcblx0XHRcdFx0aWYgKGV4dEhvc3RNYW5hZ2VyLnN0YXJ0dXAgIT09IEV4dGVuc2lvbkhvc3RTdGFydHVwLkVhZ2VyQXV0b1N0YXJ0KSB7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlFeHRlbnNpb25Ib3N0TWFuYWdlcihzbmFwc2hvdC5leHRlbnNpb25zLCBleHRIb3N0TWFuYWdlcik7XG5cdFx0XHRcdFx0ZXh0SG9zdE1hbmFnZXIuc3RhcnQoc25hcHNob3QudmVyc2lvbklkLCBzbmFwc2hvdC5leHRlbnNpb25zLCBleHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRsb2NrLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWxlYXNlQmFycmllcigpO1xuXHRcdHBlcmYubWFyaygnY29kZS9kaWRMb2FkRXh0ZW5zaW9ucycpO1xuXHRcdGF3YWl0IHRoaXMuX2hhbmRsZUV4dGVuc2lvblRlc3RzKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlQW5kUHJvY2Vzc0V4dGVuc2lvbnMobG9jazogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeUxvY2ssKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHJlc29sdmVyRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXTtcblx0XHRsZXQgbG9jYWxFeHRlbnNpb25zOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSA9IFtdO1xuXHRcdGxldCByZW1vdGVFeHRlbnNpb25zOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSA9IFtdO1xuXG5cdFx0Zm9yIGF3YWl0IChjb25zdCBleHRlbnNpb25zIG9mIHRoaXMuX3Jlc29sdmVFeHRlbnNpb25zKCkpIHtcblx0XHRcdGlmIChleHRlbnNpb25zIGluc3RhbmNlb2YgUmVzb2x2ZXJFeHRlbnNpb25zKSB7XG5cdFx0XHRcdHJlc29sdmVyRXh0ZW5zaW9ucyA9IGNoZWNrRW5hYmxlZEFuZFByb3Bvc2VkQVBJKHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCB0aGlzLl9leHRlbnNpb25zUHJvcG9zZWRBcGksIGV4dGVuc2lvbnMuZXh0ZW5zaW9ucywgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RyeS5kZWx0YUV4dGVuc2lvbnMobG9jaywgcmVzb2x2ZXJFeHRlbnNpb25zLCBbXSk7XG5cdFx0XHRcdHRoaXMuX2RvSGFuZGxlRXh0ZW5zaW9uUG9pbnRzKHJlc29sdmVyRXh0ZW5zaW9ucywgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9ucyBpbnN0YW5jZW9mIExvY2FsRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRsb2NhbEV4dGVuc2lvbnMgPSBjaGVja0VuYWJsZWRBbmRQcm9wb3NlZEFQSSh0aGlzLl9sb2dTZXJ2aWNlLCB0aGlzLl9leHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgdGhpcy5fZXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLCBleHRlbnNpb25zLmV4dGVuc2lvbnMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25zIGluc3RhbmNlb2YgUmVtb3RlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRyZW1vdGVFeHRlbnNpb25zID0gY2hlY2tFbmFibGVkQW5kUHJvcG9zZWRBUEkodGhpcy5fbG9nU2VydmljZSwgdGhpcy5fZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIHRoaXMuX2V4dGVuc2lvbnNQcm9wb3NlZEFwaSwgZXh0ZW5zaW9ucy5leHRlbnNpb25zLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gYGluaXRpYWxpemVSdW5uaW5nTG9jYXRpb25gIHdpbGwgbG9vayBhdCB0aGUgY29tcGxldGUgcGljdHVyZSAoZS5nLiBhbiBleHRlbnNpb24gaW5zdGFsbGVkIG9uIGJvdGggc2lkZXMpLFxuXHRcdC8vIHRha2VzIGNhcmUgb2YgZHVwbGljYXRlcyBhbmQgcGlja3MgYSBydW5uaW5nIGxvY2F0aW9uIGZvciBlYWNoIGV4dGVuc2lvblxuXHRcdHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuaW5pdGlhbGl6ZVJ1bm5pbmdMb2NhdGlvbihsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMpO1xuXG5cdFx0dGhpcy5fc3RhcnRFeHRlbnNpb25Ib3N0c0lmTmVjZXNzYXJ5KHRydWUsIFtdKTtcblxuXHRcdC8vIFNvbWUgcmVtb3RlIGV4dGVuc2lvbnMgY291bGQgcnVuIGxvY2FsbHkgaW4gdGhlIHdlYiB3b3JrZXIsIHNvIHN0b3JlIHRoZW1cblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zVGhhdE5lZWRUb1J1bkxvY2FsbHkgPSAodGhpcy5fYWxsb3dSZW1vdGVFeHRlbnNpb25zSW5Mb2NhbFdlYldvcmtlciA/IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlFeHRlbnNpb25Ib3N0S2luZChyZW1vdGVFeHRlbnNpb25zLCBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFdlYldvcmtlcikgOiBbXSk7XG5cdFx0Y29uc3QgbG9jYWxQcm9jZXNzRXh0ZW5zaW9ucyA9ICh0aGlzLl9oYXNMb2NhbFByb2Nlc3MgPyB0aGlzLl9ydW5uaW5nTG9jYXRpb25zLmZpbHRlckJ5RXh0ZW5zaW9uSG9zdEtpbmQobG9jYWxFeHRlbnNpb25zLCBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3MpIDogW10pO1xuXHRcdGNvbnN0IGxvY2FsV2ViV29ya2VyRXh0ZW5zaW9ucyA9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuZmlsdGVyQnlFeHRlbnNpb25Ib3N0S2luZChsb2NhbEV4dGVuc2lvbnMsIEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsV2ViV29ya2VyKTtcblx0XHRyZW1vdGVFeHRlbnNpb25zID0gdGhpcy5fcnVubmluZ0xvY2F0aW9ucy5maWx0ZXJCeUV4dGVuc2lvbkhvc3RLaW5kKHJlbW90ZUV4dGVuc2lvbnMsIEV4dGVuc2lvbkhvc3RLaW5kLlJlbW90ZSk7XG5cblx0XHQvLyBBZGQgbG9jYWxseSB0aGUgcmVtb3RlIGV4dGVuc2lvbnMgdGhhdCBuZWVkIHRvIHJ1biBsb2NhbGx5IGluIHRoZSB3ZWIgd29ya2VyXG5cdFx0Zm9yIChjb25zdCBleHQgb2YgcmVtb3RlRXh0ZW5zaW9uc1RoYXROZWVkVG9SdW5Mb2NhbGx5KSB7XG5cdFx0XHRpZiAoIWluY2x1ZGVzKGxvY2FsV2ViV29ya2VyRXh0ZW5zaW9ucywgZXh0LmlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdGxvY2FsV2ViV29ya2VyRXh0ZW5zaW9ucy5wdXNoKGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsRXh0ZW5zaW9ucyA9IHJlbW90ZUV4dGVuc2lvbnMuY29uY2F0KGxvY2FsUHJvY2Vzc0V4dGVuc2lvbnMpLmNvbmNhdChsb2NhbFdlYldvcmtlckV4dGVuc2lvbnMpO1xuXHRcdGxldCB0b0FkZCA9IGFsbEV4dGVuc2lvbnM7XG5cblx0XHRpZiAocmVzb2x2ZXJFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0Ly8gQWRkIGV4dGVuc2lvbnMgdGhhdCBhcmUgbm90IHJlZ2lzdGVyZWQgYXMgcmVzb2x2ZXJzIGJ1dCBhcmUgaW4gdGhlIGZpbmFsIHJlc29sdmVkIHNldFxuXHRcdFx0dG9BZGQgPSBhbGxFeHRlbnNpb25zLmZpbHRlcihleHRlbnNpb24gPT4gIXJlc29sdmVyRXh0ZW5zaW9ucy5zb21lKGUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikgJiYgZS5leHRlbnNpb25Mb2NhdGlvbi50b1N0cmluZygpID09PSBleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24udG9TdHJpbmcoKSkpO1xuXHRcdFx0Ly8gUmVtb3ZlIGV4dGVuc2lvbnMgdGhhdCBhcmUgcmVnaXN0ZXJlZCBhcyByZXNvbHZlcnMgYnV0IGFyZSBub3QgaW4gdGhlIGZpbmFsIHJlc29sdmVkIHNldFxuXHRcdFx0aWYgKGFsbEV4dGVuc2lvbnMubGVuZ3RoIDwgdG9BZGQubGVuZ3RoICsgcmVzb2x2ZXJFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCB0b1JlbW92ZSA9IHJlc29sdmVyRXh0ZW5zaW9ucy5maWx0ZXIocmVnaXN0ZXJlZCA9PiAhYWxsRXh0ZW5zaW9ucy5zb21lKGUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5pZGVudGlmaWVyLCByZWdpc3RlcmVkLmlkZW50aWZpZXIpICYmIGUuZXh0ZW5zaW9uTG9jYXRpb24udG9TdHJpbmcoKSA9PT0gcmVnaXN0ZXJlZC5leHRlbnNpb25Mb2NhdGlvbi50b1N0cmluZygpKSk7XG5cdFx0XHRcdGlmICh0b1JlbW92ZS5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RyeS5kZWx0YUV4dGVuc2lvbnMobG9jaywgW10sIHRvUmVtb3ZlLm1hcChlID0+IGUuaWRlbnRpZmllcikpO1xuXHRcdFx0XHRcdHRoaXMuX2RvSGFuZGxlRXh0ZW5zaW9uUG9pbnRzKHRvUmVtb3ZlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX3JlZ2lzdHJ5LmRlbHRhRXh0ZW5zaW9ucyhsb2NrLCB0b0FkZCwgW10pO1xuXHRcdGlmIChyZXN1bHQucmVtb3ZlZER1ZVRvTG9vcGluZy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdsb29waW5nJywgXCJUaGUgZm9sbG93aW5nIGV4dGVuc2lvbnMgY29udGFpbiBkZXBlbmRlbmN5IGxvb3BzIGFuZCBoYXZlIGJlZW4gZGlzYWJsZWQ6IHswfVwiLCByZXN1bHQucmVtb3ZlZER1ZVRvTG9vcGluZy5tYXAoZSA9PiBgJyR7ZS5pZGVudGlmaWVyLnZhbHVlfSdgKS5qb2luKCcsICcpKVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZG9IYW5kbGVFeHRlbnNpb25Qb2ludHModGhpcy5fcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCksIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2hhbmRsZUV4dGVuc2lvblRlc3RzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQgfHwgIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uSG9zdE1hbmFnZXIgPSB0aGlzLmZpbmRUZXN0RXh0ZW5zaW9uSG9zdCh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSk7XG5cdFx0aWYgKCFleHRlbnNpb25Ib3N0TWFuYWdlcikge1xuXHRcdFx0Y29uc3QgbXNnID0gbmxzLmxvY2FsaXplKCdleHRlbnNpb25UZXN0RXJyb3InLCBcIk5vIGV4dGVuc2lvbiBob3N0IGZvdW5kIHRoYXQgY2FuIGxhdW5jaCB0aGUgdGVzdCBydW5uZXIgYXQgezB9LlwiLCB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSS50b1N0cmluZygpKTtcblx0XHRcdGNvbnNvbGUuZXJyb3IobXNnKTtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobXNnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblxuXHRcdGxldCBleGl0Q29kZTogbnVtYmVyO1xuXHRcdHRyeSB7XG5cdFx0XHRleGl0Q29kZSA9IGF3YWl0IGV4dGVuc2lvbkhvc3RNYW5hZ2VyLmV4dGVuc2lvblRlc3RzRXhlY3V0ZSgpO1xuXHRcdFx0aWYgKGlzQ0kpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb24gaG9zdCB0ZXN0IHJ1bm5lciBleGl0IGNvZGU6ICR7ZXhpdENvZGV9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoaXNDSSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gaG9zdCB0ZXN0IHJ1bm5lciBlcnJvcmAsIGVycik7XG5cdFx0XHR9XG5cdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRleGl0Q29kZSA9IDEgLyogRVJST1IgKi87XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25FeHRlbnNpb25Ib3N0RXhpdChleGl0Q29kZSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRUZXN0RXh0ZW5zaW9uSG9zdCh0ZXN0TG9jYXRpb246IFVSSSk6IElFeHRlbnNpb25Ib3N0TWFuYWdlciB8IG51bGwge1xuXHRcdGxldCBydW5uaW5nTG9jYXRpb246IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbiB8IG51bGwgPSBudWxsO1xuXG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgdGhpcy5fcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCkpIHtcblx0XHRcdGlmIChpc0VxdWFsT3JQYXJlbnQodGVzdExvY2F0aW9uLCBleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24pKSB7XG5cdFx0XHRcdHJ1bm5pbmdMb2NhdGlvbiA9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMuZ2V0UnVubmluZ0xvY2F0aW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChydW5uaW5nTG9jYXRpb24gPT09IG51bGwpIHtcblx0XHRcdC8vIG5vdCBzdXJlIGlmIHdlIHNob3VsZCBzdXBwb3J0IHRoYXQsIGJ1dCBpdCB3YXMgcG9zc2libGUgdG8gaGF2ZSBhbiB0ZXN0IG91dHNpZGUgYW4gZXh0ZW5zaW9uXG5cblx0XHRcdGlmICh0ZXN0TG9jYXRpb24uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXHRcdFx0XHRydW5uaW5nTG9jYXRpb24gPSBuZXcgUmVtb3RlUnVubmluZ0xvY2F0aW9uKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBXaGVuIGEgZGVidWdnZXIgYXR0YWNoZXMgdG8gdGhlIGV4dGVuc2lvbiBob3N0LCBpdCB3aWxsIHN1cmZhY2UgYWxsIGNvbnNvbGUubG9nIG1lc3NhZ2VzIGZyb20gdGhlIGV4dGVuc2lvbiBob3N0LFxuXHRcdFx0XHQvLyBidXQgbm90IG5lY2Vzc2FyaWx5IGZyb20gdGhlIHdpbmRvdy4gU28gaXQgd291bGQgYmUgYmVzdCBpZiBhbnkgZXJyb3JzIGdldCBwcmludGVkIHRvIHRoZSBjb25zb2xlIG9mIHRoZSBleHRlbnNpb24gaG9zdC5cblx0XHRcdFx0Ly8gVGhhdCBpcyB3aHkgaGVyZSB3ZSB1c2UgdGhlIGxvY2FsIHByb2Nlc3MgZXh0ZW5zaW9uIGhvc3QgZXZlbiBmb3Igbm9uLWZpbGUgVVJJc1xuXHRcdFx0XHRydW5uaW5nTG9jYXRpb24gPSBuZXcgTG9jYWxQcm9jZXNzUnVubmluZ0xvY2F0aW9uKDApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAocnVubmluZ0xvY2F0aW9uICE9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLmdldEJ5UnVubmluZ0xvY2F0aW9uKHJ1bm5pbmdMb2NhdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVsZWFzZUJhcnJpZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5faW5zdGFsbGVkRXh0ZW5zaW9uc1JlYWR5Lm9wZW4oKTtcblx0XHR0aGlzLl9vbkRpZFJlZ2lzdGVyRXh0ZW5zaW9ucy5maXJlKHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zU3RhdHVzLmZpcmUodGhpcy5fcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCkubWFwKGUgPT4gZS5pZGVudGlmaWVyKSk7XG5cdH1cblxuXHQvLyNyZWdpb24gcmVtb3RlIGF1dGhvcml0eSByZXNvbHZpbmdcblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3Jlc29sdmVBdXRob3JpdHlJbml0aWFsKHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxSZXNvbHZlclJlc3VsdD4ge1xuXHRcdGNvbnN0IE1BWF9BVFRFTVBUUyA9IDU7XG5cblx0XHRmb3IgKGxldCBhdHRlbXB0ID0gMTsgOyBhdHRlbXB0KyspIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9yZXNvbHZlQXV0aG9yaXR5V2l0aExvZ2dpbmcocmVtb3RlQXV0aG9yaXR5KTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRpZiAoUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvci5pc05vUmVzb2x2ZXJGb3VuZChlcnIpKSB7XG5cdFx0XHRcdFx0Ly8gVGhlcmUgaXMgbm8gcG9pbnQgaW4gcmV0cnlpbmcgaWYgdGhlcmUgaXMgbm8gcmVzb2x2ZXIgZm91bmRcblx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvci5pc05vdEF2YWlsYWJsZShlcnIpKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIHJlc29sdmVyIGlzIG5vdCBhdmFpbGFibGUgYW5kIGFza2VkIHVzIHRvIG5vdCByZXRyeVxuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhdHRlbXB0ID49IE1BWF9BVFRFTVBUUykge1xuXHRcdFx0XHRcdC8vIFRvbyBtYW55IGZhaWxlZCBhdHRlbXB0cywgZ2l2ZSB1cFxuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfcmVzb2x2ZUF1dGhvcml0eUFnYWluKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0aWYgKCFyZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuX2NsZWFyUmVzb2x2ZWRBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUF1dGhvcml0eVdpdGhMb2dnaW5nKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuX3NldFJlc29sdmVkQXV0aG9yaXR5KHJlc3VsdC5hdXRob3JpdHksIHJlc3VsdC5vcHRpb25zKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuX3JlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5fc2V0UmVzb2x2ZWRBdXRob3JpdHlFcnJvcihyZW1vdGVBdXRob3JpdHksIGVycik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZUF1dGhvcml0eVdpdGhMb2dnaW5nKHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxSZXNvbHZlclJlc3VsdD4ge1xuXHRcdGNvbnN0IGF1dGhvcml0eVByZWZpeCA9IGdldFJlbW90ZUF1dGhvcml0eVByZWZpeChyZW1vdGVBdXRob3JpdHkpO1xuXHRcdGNvbnN0IHN3ID0gU3RvcFdhdGNoLmNyZWF0ZShmYWxzZSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBJbnZva2luZyByZXNvbHZlQXV0aG9yaXR5KCR7YXV0aG9yaXR5UHJlZml4fSkuLi5gKTtcblx0XHR0cnkge1xuXHRcdFx0cGVyZi5tYXJrKGBjb2RlL3dpbGxSZXNvbHZlQXV0aG9yaXR5LyR7YXV0aG9yaXR5UHJlZml4fWApO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUF1dGhvcml0eShyZW1vdGVBdXRob3JpdHkpO1xuXHRcdFx0cGVyZi5tYXJrKGBjb2RlL2RpZFJlc29sdmVBdXRob3JpdHlPSy8ke2F1dGhvcml0eVByZWZpeH1gKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgcmVzb2x2ZUF1dGhvcml0eSgke2F1dGhvcml0eVByZWZpeH0pIHJldHVybmVkICcke3Jlc3VsdC5hdXRob3JpdHkuY29ubmVjdFRvfScgYWZ0ZXIgJHtzdy5lbGFwc2VkKCl9IG1zYCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0cGVyZi5tYXJrKGBjb2RlL2RpZFJlc29sdmVBdXRob3JpdHlFcnJvci8ke2F1dGhvcml0eVByZWZpeH1gKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYHJlc29sdmVBdXRob3JpdHkoJHthdXRob3JpdHlQcmVmaXh9KSByZXR1cm5lZCBhbiBlcnJvciBhZnRlciAke3N3LmVsYXBzZWQoKX0gbXNgLCBlcnIpO1xuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfcmVzb2x2ZUF1dGhvcml0eU9uRXh0ZW5zaW9uSG9zdHMoa2luZDogRXh0ZW5zaW9uSG9zdEtpbmQsIHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKTogUHJvbWlzZTxSZXNvbHZlclJlc3VsdD4ge1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uSG9zdHMgPSB0aGlzLl9nZXRFeHRlbnNpb25Ib3N0TWFuYWdlcnMoa2luZCk7XG5cdFx0aWYgKGV4dGVuc2lvbkhvc3RzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gbm8gbG9jYWwgcHJvY2VzcyBleHRlbnNpb24gaG9zdHNcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlc29sdmUgYXV0aG9yaXR5YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVzb2x2ZUF1dGhvcml0eUF0dGVtcHQrKztcblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoZXh0ZW5zaW9uSG9zdHMubWFwKGV4dEhvc3QgPT4gZXh0SG9zdC5yZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eSwgdGhpcy5fcmVzb2x2ZUF1dGhvcml0eUF0dGVtcHQpKSk7XG5cblx0XHRsZXQgYmVzdEVycm9yUmVzdWx0OiBJUmVzb2x2ZUF1dGhvcml0eUVycm9yUmVzdWx0IHwgbnVsbCA9IG51bGw7XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuXHRcdFx0aWYgKHJlc3VsdC50eXBlID09PSAnb2snKSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQudmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWJlc3RFcnJvclJlc3VsdCkge1xuXHRcdFx0XHRiZXN0RXJyb3JSZXN1bHQgPSByZXN1bHQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYmVzdEVycm9ySXNVbmtub3duID0gKGJlc3RFcnJvclJlc3VsdC5lcnJvci5jb2RlID09PSBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yQ29kZS5Vbmtub3duKTtcblx0XHRcdGNvbnN0IGVycm9ySXNVbmtub3duID0gKHJlc3VsdC5lcnJvci5jb2RlID09PSBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yQ29kZS5Vbmtub3duKTtcblx0XHRcdGlmIChiZXN0RXJyb3JJc1Vua25vd24gJiYgIWVycm9ySXNVbmtub3duKSB7XG5cdFx0XHRcdGJlc3RFcnJvclJlc3VsdCA9IHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB3ZSBjYW4gb25seSByZWFjaCB0aGlzIGlmIHRoZXJlIGlzIGFuIGVycm9yXG5cdFx0dGhyb3cgbmV3IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IoYmVzdEVycm9yUmVzdWx0IS5lcnJvci5tZXNzYWdlLCBiZXN0RXJyb3JSZXN1bHQhLmVycm9yLmNvZGUsIGJlc3RFcnJvclJlc3VsdCEuZXJyb3IuZGV0YWlsKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBTdG9wcGluZyAvIFN0YXJ0aW5nIC8gUmVzdGFydGluZ1xuXG5cdHB1YmxpYyBzdG9wRXh0ZW5zaW9uSG9zdHMocmVhc29uOiBzdHJpbmcsIGF1dG8/OiBib29sZWFuKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvU3RvcEV4dGVuc2lvbkhvc3RzV2l0aFZldG8ocmVhc29uLCBhdXRvKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfZG9TdG9wRXh0ZW5zaW9uSG9zdHMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJldmlvdXNseUFjdGl2YXRlZEV4dGVuc2lvbklkczogRXh0ZW5zaW9uSWRlbnRpZmllcltdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25TdGF0dXMgb2YgdGhpcy5fZXh0ZW5zaW9uU3RhdHVzLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uU3RhdHVzLmFjdGl2YXRpb25TdGFydGVkKSB7XG5cdFx0XHRcdHByZXZpb3VzbHlBY3RpdmF0ZWRFeHRlbnNpb25JZHMucHVzaChleHRlbnNpb25TdGF0dXMuaWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5zdG9wQWxsSW5SZXZlcnNlKCk7XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25TdGF0dXMgb2YgdGhpcy5fZXh0ZW5zaW9uU3RhdHVzLnZhbHVlcygpKSB7XG5cdFx0XHRleHRlbnNpb25TdGF0dXMuY2xlYXJSdW50aW1lU3RhdHVzKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHByZXZpb3VzbHlBY3RpdmF0ZWRFeHRlbnNpb25JZHMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zU3RhdHVzLmZpcmUocHJldmlvdXNseUFjdGl2YXRlZEV4dGVuc2lvbklkcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZG9TdG9wRXh0ZW5zaW9uSG9zdHNXaXRoVmV0byhyZWFzb246IHN0cmluZywgYXV0bzogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKGF1dG8gJiYgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB2ZXRvczogKGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KVtdID0gW107XG5cdFx0Y29uc3QgdmV0b1JlYXNvbnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRcdHRoaXMuX29uV2lsbFN0b3AuZmlyZSh7XG5cdFx0XHRyZWFzb24sXG5cdFx0XHRhdXRvLFxuXHRcdFx0dmV0byh2YWx1ZSwgcmVhc29uKSB7XG5cdFx0XHRcdHZldG9zLnB1c2godmFsdWUpO1xuXG5cdFx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdGlmICh2YWx1ZSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdFx0dmV0b1JlYXNvbnMuYWRkKHJlYXNvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdHZldG9SZWFzb25zLmFkZChyZWFzb24pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pLmNhdGNoKGVycm9yID0+IHtcblx0XHRcdFx0XHRcdHZldG9SZWFzb25zLmFkZChubHMubG9jYWxpemUoJ2V4dGVuc2lvblN0b3BWZXRvRXJyb3InLCBcInswfSAoRXJyb3I6IHsxfSlcIiwgcmVhc29uLCB0b0Vycm9yTWVzc2FnZShlcnJvcikpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IGhhbmRsZVZldG9zKHZldG9zLCBlcnJvciA9PiB0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycm9yKSk7XG5cdFx0aWYgKCF2ZXRvKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9kb1N0b3BFeHRlbnNpb25Ib3N0cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIWF1dG8pIHtcblx0XHRcdFx0Y29uc3QgdmV0b1JlYXNvbnNBcnJheSA9IEFycmF5LmZyb20odmV0b1JlYXNvbnMpO1xuXG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgRXh0ZW5zaW9uIGhvc3Qgd2FzIG5vdCBzdG9wcGVkIGJlY2F1c2Ugb2YgdmV0byAoc3RvcCByZWFzb246ICR7cmVhc29ufSwgdmV0byByZWFzb246ICR7dmV0b1JlYXNvbnNBcnJheS5qb2luKCcsICcpfSlgKTtcblxuXHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5fZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uU3RvcFZldG9NZXNzYWdlJywgXCJQbGVhc2UgY29uZmlybSByZXN0YXJ0IG9mIGV4dGVuc2lvbnMuXCIpLFxuXHRcdFx0XHRcdGRldGFpbDogdmV0b1JlYXNvbnNBcnJheS5sZW5ndGggPT09IDEgP1xuXHRcdFx0XHRcdFx0dmV0b1JlYXNvbnNBcnJheVswXSA6XG5cdFx0XHRcdFx0XHR2ZXRvUmVhc29uc0FycmF5LmpvaW4oJ1xcbiAtJyksXG5cdFx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbmxzLmxvY2FsaXplKCdwcm9jZWVkQW55d2F5cycsIFwiUmVzdGFydCBBbnl3YXlcIilcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gIXZldG87XG5cdH1cblxuXHRwcml2YXRlIF9zdGFydEV4dGVuc2lvbkhvc3RzSWZOZWNlc3NhcnkoaXNJbml0aWFsU3RhcnQ6IGJvb2xlYW4sIGluaXRpYWxBY3RpdmF0aW9uRXZlbnRzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGxvY2F0aW9uczogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uW10gPSBbXTtcblx0XHRmb3IgKGxldCBhZmZpbml0eSA9IDA7IGFmZmluaXR5IDw9IHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMubWF4TG9jYWxQcm9jZXNzQWZmaW5pdHk7IGFmZmluaXR5KyspIHtcblx0XHRcdGxvY2F0aW9ucy5wdXNoKG5ldyBMb2NhbFByb2Nlc3NSdW5uaW5nTG9jYXRpb24oYWZmaW5pdHkpKTtcblx0XHR9XG5cdFx0Zm9yIChsZXQgYWZmaW5pdHkgPSAwOyBhZmZpbml0eSA8PSB0aGlzLl9ydW5uaW5nTG9jYXRpb25zLm1heExvY2FsV2ViV29ya2VyQWZmaW5pdHk7IGFmZmluaXR5KyspIHtcblx0XHRcdGxvY2F0aW9ucy5wdXNoKG5ldyBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvbihhZmZpbml0eSkpO1xuXHRcdH1cblx0XHRsb2NhdGlvbnMucHVzaChuZXcgUmVtb3RlUnVubmluZ0xvY2F0aW9uKCkpO1xuXHRcdGZvciAoY29uc3QgbG9jYXRpb24gb2YgbG9jYXRpb25zKSB7XG5cdFx0XHRpZiAodGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLmdldEJ5UnVubmluZ0xvY2F0aW9uKGxvY2F0aW9uKSkge1xuXHRcdFx0XHQvLyBhbHJlYWR5IHJ1bm5pbmdcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXMgPSB0aGlzLl9jcmVhdGVFeHRlbnNpb25Ib3N0TWFuYWdlcihsb2NhdGlvbiwgaXNJbml0aWFsU3RhcnQsIGluaXRpYWxBY3RpdmF0aW9uRXZlbnRzKTtcblx0XHRcdGlmIChyZXMpIHtcblx0XHRcdFx0Y29uc3QgW2V4dEhvc3RNYW5hZ2VyLCBkaXNwb3NhYmxlU3RvcmVdID0gcmVzO1xuXHRcdFx0XHR0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMuYWRkKGV4dEhvc3RNYW5hZ2VyLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUV4dGVuc2lvbkhvc3RNYW5hZ2VyKHJ1bm5pbmdMb2NhdGlvbjogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uLCBpc0luaXRpYWxTdGFydDogYm9vbGVhbiwgaW5pdGlhbEFjdGl2YXRpb25FdmVudHM6IHN0cmluZ1tdKTogbnVsbCB8IFtJRXh0ZW5zaW9uSG9zdE1hbmFnZXIsIERpc3Bvc2FibGVTdG9yZV0ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkhvc3QgPSB0aGlzLl9leHRlbnNpb25Ib3N0RmFjdG9yeS5jcmVhdGVFeHRlbnNpb25Ib3N0KHRoaXMuX3J1bm5pbmdMb2NhdGlvbnMsIHJ1bm5pbmdMb2NhdGlvbiwgaXNJbml0aWFsU3RhcnQpO1xuXHRcdGlmICghZXh0ZW5zaW9uSG9zdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvY2Vzc01hbmFnZXI6IElFeHRlbnNpb25Ib3N0TWFuYWdlciA9IHRoaXMuX2RvQ3JlYXRlRXh0ZW5zaW9uSG9zdE1hbmFnZXIoZXh0ZW5zaW9uSG9zdCwgaW5pdGlhbEFjdGl2YXRpb25FdmVudHMpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHByb2Nlc3NNYW5hZ2VyLm9uRGlkRXhpdCgoW2NvZGUsIHNpZ25hbF0pID0+IHRoaXMuX29uRXh0ZW5zaW9uSG9zdENyYXNoT3JFeGl0KHByb2Nlc3NNYW5hZ2VyLCBjb2RlLCBzaWduYWwpKSk7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChwcm9jZXNzTWFuYWdlci5vbkRpZENoYW5nZVJlc3BvbnNpdmVTdGF0ZSgocmVzcG9uc2l2ZVN0YXRlKSA9PiB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oYEV4dGVuc2lvbiBob3N0ICgke3Byb2Nlc3NNYW5hZ2VyLmZyaWVuZHlOYW1lfSkgaXMgJHtyZXNwb25zaXZlU3RhdGUgPT09IFJlc3BvbnNpdmVTdGF0ZS5SZXNwb25zaXZlID8gJ3Jlc3BvbnNpdmUnIDogJ3VucmVzcG9uc2l2ZSd9LmApO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VSZXNwb25zaXZlQ2hhbmdlLmZpcmUoe1xuXHRcdFx0XHRleHRlbnNpb25Ib3N0S2luZDogcHJvY2Vzc01hbmFnZXIua2luZCxcblx0XHRcdFx0aXNSZXNwb25zaXZlOiByZXNwb25zaXZlU3RhdGUgPT09IFJlc3BvbnNpdmVTdGF0ZS5SZXNwb25zaXZlLFxuXHRcdFx0XHRnZXRJbnNwZWN0TGlzdGVuZXI6ICh0cnlFbmFibGVJbnNwZWN0b3I6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvY2Vzc01hbmFnZXIuZ2V0SW5zcGVjdFBvcnQodHJ5RW5hYmxlSW5zcGVjdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiBbcHJvY2Vzc01hbmFnZXIsIGRpc3Bvc2FibGVTdG9yZV07XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2RvQ3JlYXRlRXh0ZW5zaW9uSG9zdE1hbmFnZXIoZXh0ZW5zaW9uSG9zdDogSUV4dGVuc2lvbkhvc3QsIGluaXRpYWxBY3RpdmF0aW9uRXZlbnRzOiBzdHJpbmdbXSk6IElFeHRlbnNpb25Ib3N0TWFuYWdlciB7XG5cdFx0Y29uc3QgaW50ZXJuYWxFeHRlbnNpb25TZXJ2aWNlID0gdGhpcy5fYWNxdWlyZUludGVybmFsQVBJKGV4dGVuc2lvbkhvc3QpO1xuXHRcdGlmIChleHRlbnNpb25Ib3N0LnN0YXJ0dXAgPT09IEV4dGVuc2lvbkhvc3RTdGFydHVwLkxhenkgJiYgaW5pdGlhbEFjdGl2YXRpb25FdmVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGF6eUNyZWF0ZUV4dGVuc2lvbkhvc3RNYW5hZ2VyLCBleHRlbnNpb25Ib3N0LCBpbnRlcm5hbEV4dGVuc2lvblNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uSG9zdE1hbmFnZXIsIGV4dGVuc2lvbkhvc3QsIGluaXRpYWxBY3RpdmF0aW9uRXZlbnRzLCBpbnRlcm5hbEV4dGVuc2lvblNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25FeHRlbnNpb25Ib3N0Q3Jhc2hPckV4aXQoZXh0ZW5zaW9uSG9zdDogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyLCBjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuXG5cdFx0Ly8gVW5leHBlY3RlZCB0ZXJtaW5hdGlvblxuXHRcdGNvbnN0IGlzRXh0ZW5zaW9uRGV2SG9zdCA9IHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UpLmlzRXh0ZW5zaW9uRGV2SG9zdDtcblx0XHRpZiAoIWlzRXh0ZW5zaW9uRGV2SG9zdCkge1xuXHRcdFx0dGhpcy5fb25FeHRlbnNpb25Ib3N0Q3Jhc2hlZChleHRlbnNpb25Ib3N0LCBjb2RlLCBzaWduYWwpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRXh0ZW5zaW9uSG9zdEV4aXQoY29kZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX29uRXh0ZW5zaW9uSG9zdENyYXNoZWQoZXh0ZW5zaW9uSG9zdDogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyLCBjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnNvbGUuZXJyb3IoYEV4dGVuc2lvbiBob3N0ICgke2V4dGVuc2lvbkhvc3QuZnJpZW5keU5hbWV9KSB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseS4gQ29kZTogJHtjb2RlfSwgU2lnbmFsOiAke3NpZ25hbH1gKTtcblx0XHRpZiAoZXh0ZW5zaW9uSG9zdC5raW5kID09PSBFeHRlbnNpb25Ib3N0S2luZC5Mb2NhbFByb2Nlc3MpIHtcblx0XHRcdHRoaXMuX2RvU3RvcEV4dGVuc2lvbkhvc3RzKCk7XG5cdFx0fSBlbHNlIGlmIChleHRlbnNpb25Ib3N0LmtpbmQgPT09IEV4dGVuc2lvbkhvc3RLaW5kLlJlbW90ZSkge1xuXHRcdFx0aWYgKHNpZ25hbCkge1xuXHRcdFx0XHR0aGlzLl9vblJlbW90ZUV4dGVuc2lvbkhvc3RDcmFzaGVkKGV4dGVuc2lvbkhvc3QsIHNpZ25hbCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMuc3RvcE9uZShleHRlbnNpb25Ib3N0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFeHRlbnNpb25Ib3N0RXhpdEluZm9XaXRoVGltZW91dChyZWNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nKTogUHJvbWlzZTxJRXh0ZW5zaW9uSG9zdEV4aXRJbmZvIHwgbnVsbD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCB0aW1lb3V0SGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ2dldEV4dGVuc2lvbkhvc3RFeGl0SW5mbyB0aW1lZCBvdXQnKSk7XG5cdFx0XHR9LCAyMDAwKTtcblx0XHRcdHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRFeHRlbnNpb25Ib3N0RXhpdEluZm8ocmVjb25uZWN0aW9uVG9rZW4pLnRoZW4oXG5cdFx0XHRcdChyKSA9PiB7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuXHRcdFx0XHRcdHJlc29sdmUocik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlamVjdFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29uUmVtb3RlRXh0ZW5zaW9uSG9zdENyYXNoZWQoZXh0ZW5zaW9uSG9zdDogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyLCByZWNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluZm8gPSBhd2FpdCB0aGlzLl9nZXRFeHRlbnNpb25Ib3N0RXhpdEluZm9XaXRoVGltZW91dChyZWNvbm5lY3Rpb25Ub2tlbik7XG5cdFx0XHRpZiAoaW5mbykge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gaG9zdCAoJHtleHRlbnNpb25Ib3N0LmZyaWVuZHlOYW1lfSkgdGVybWluYXRlZCB1bmV4cGVjdGVkbHkgd2l0aCBjb2RlICR7aW5mby5jb2RlfS5gKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbG9nRXh0ZW5zaW9uSG9zdENyYXNoKGV4dGVuc2lvbkhvc3QpO1xuXHRcdFx0dGhpcy5fcmVtb3RlQ3Jhc2hUcmFja2VyLnJlZ2lzdGVyQ3Jhc2goKTtcblxuXHRcdFx0aWYgKHRoaXMuX3JlbW90ZUNyYXNoVHJhY2tlci5zaG91bGRBdXRvbWF0aWNhbGx5UmVzdGFydCgpKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgQXV0b21hdGljYWxseSByZXN0YXJ0aW5nIHRoZSByZW1vdGUgZXh0ZW5zaW9uIGhvc3QuYCk7XG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uuc3RhdHVzKG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uU2VydmljZS5hdXRvUmVzdGFydCcsIFwiVGhlIHJlbW90ZSBleHRlbnNpb24gaG9zdCB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseS4gUmVzdGFydGluZy4uLlwiKSwgeyBoaWRlQWZ0ZXI6IDUwMDAgfSk7XG5cdFx0XHRcdHRoaXMuX3N0YXJ0RXh0ZW5zaW9uSG9zdHNJZk5lY2Vzc2FyeShmYWxzZSwgQXJyYXkuZnJvbSh0aGlzLl9hbGxSZXF1ZXN0ZWRBY3RpdmF0ZUV2ZW50cy5rZXlzKCkpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkVycm9yLCBubHMubG9jYWxpemUoJ2V4dGVuc2lvblNlcnZpY2UuY3Jhc2gnLCBcIlJlbW90ZSBFeHRlbnNpb24gaG9zdCB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSAzIHRpbWVzIHdpdGhpbiB0aGUgbGFzdCA1IG1pbnV0ZXMuXCIpLFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZXN0YXJ0JywgXCJSZXN0YXJ0IFJlbW90ZSBFeHRlbnNpb24gSG9zdFwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdGFydEV4dGVuc2lvbkhvc3RzSWZOZWNlc3NhcnkoZmFsc2UsIEFycmF5LmZyb20odGhpcy5fYWxsUmVxdWVzdGVkQWN0aXZhdGVFdmVudHMua2V5cygpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdC8vIG1heWJlIHRoaXMgd2Fzbid0IGFuIGV4dGVuc2lvbiBob3N0IGNyYXNoIGFuZCBpdCB3YXMgYSBwZXJtYW5lbnQgZGlzY29ubmVjdGlvblxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfbG9nRXh0ZW5zaW9uSG9zdENyYXNoKGV4dGVuc2lvbkhvc3Q6IElFeHRlbnNpb25Ib3N0TWFuYWdlcik6IHZvaWQge1xuXG5cdFx0Y29uc3QgYWN0aXZhdGVkRXh0ZW5zaW9uczogRXh0ZW5zaW9uSWRlbnRpZmllcltdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25TdGF0dXMgb2YgdGhpcy5fZXh0ZW5zaW9uU3RhdHVzLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uU3RhdHVzLmFjdGl2YXRpb25TdGFydGVkICYmIGV4dGVuc2lvbkhvc3QuY29udGFpbnNFeHRlbnNpb24oZXh0ZW5zaW9uU3RhdHVzLmlkKSkge1xuXHRcdFx0XHRhY3RpdmF0ZWRFeHRlbnNpb25zLnB1c2goZXh0ZW5zaW9uU3RhdHVzLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYWN0aXZhdGVkRXh0ZW5zaW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gaG9zdCAoJHtleHRlbnNpb25Ib3N0LmZyaWVuZHlOYW1lfSkgdGVybWluYXRlZCB1bmV4cGVjdGVkbHkuIFRoZSBmb2xsb3dpbmcgZXh0ZW5zaW9ucyB3ZXJlIHJ1bm5pbmc6ICR7YWN0aXZhdGVkRXh0ZW5zaW9ucy5tYXAoaWQgPT4gaWQudmFsdWUpLmpvaW4oJywgJyl9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiBob3N0ICgke2V4dGVuc2lvbkhvc3QuZnJpZW5keU5hbWV9KSB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseS4gTm8gZXh0ZW5zaW9ucyB3ZXJlIGFjdGl2YXRlZC5gKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3RhcnRFeHRlbnNpb25Ib3N0cyh1cGRhdGVzPzogeyB0b0FkZDogSUV4dGVuc2lvbltdOyB0b1JlbW92ZTogc3RyaW5nW10gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2RvU3RvcEV4dGVuc2lvbkhvc3RzKCk7XG5cblx0XHRpZiAodXBkYXRlcykge1xuXHRcdFx0YXdhaXQgdGhpcy5faGFuZGxlRGVsdGFFeHRlbnNpb25zKG5ldyBEZWx0YUV4dGVuc2lvbnNRdWV1ZUl0ZW0odXBkYXRlcy50b0FkZCwgdXBkYXRlcy50b1JlbW92ZSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2sgPSBhd2FpdCB0aGlzLl9yZWdpc3RyeS5hY3F1aXJlTG9jaygnc3RhcnRFeHRlbnNpb25Ib3N0cycpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9zdGFydEV4dGVuc2lvbkhvc3RzSWZOZWNlc3NhcnkoZmFsc2UsIEFycmF5LmZyb20odGhpcy5fYWxsUmVxdWVzdGVkQWN0aXZhdGVFdmVudHMua2V5cygpKSk7XG5cblx0XHRcdGNvbnN0IGxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3RzID0gdGhpcy5fZ2V0RXh0ZW5zaW9uSG9zdE1hbmFnZXJzKEV4dGVuc2lvbkhvc3RLaW5kLkxvY2FsUHJvY2Vzcyk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChsb2NhbFByb2Nlc3NFeHRlbnNpb25Ib3N0cy5tYXAoZXh0SG9zdCA9PiBleHRIb3N0LnJlYWR5KCkpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0bG9jay5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIElFeHRlbnNpb25TZXJ2aWNlXG5cblx0cHVibGljIGFjdGl2YXRlQnlFdmVudChhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZywgYWN0aXZhdGlvbktpbmQ6IEFjdGl2YXRpb25LaW5kID0gQWN0aXZhdGlvbktpbmQuTm9ybWFsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX2luc3RhbGxlZEV4dGVuc2lvbnNSZWFkeS5pc09wZW4oKSkge1xuXHRcdFx0Ly8gRXh0ZW5zaW9ucyBoYXZlIGJlZW4gc2Nhbm5lZCBhbmQgaW50ZXJwcmV0ZWRcblxuXHRcdFx0Ly8gUmVjb3JkIHRoZSBmYWN0IHRoYXQgdGhpcyBhY3RpdmF0aW9uRXZlbnQgd2FzIHJlcXVlc3RlZCAoaW4gY2FzZSBvZiBhIHJlc3RhcnQpXG5cdFx0XHR0aGlzLl9hbGxSZXF1ZXN0ZWRBY3RpdmF0ZUV2ZW50cy5hZGQoYWN0aXZhdGlvbkV2ZW50KTtcblxuXHRcdFx0aWYgKCF0aGlzLl9yZWdpc3RyeS5jb250YWluc0FjdGl2YXRpb25FdmVudChhY3RpdmF0aW9uRXZlbnQpKSB7XG5cdFx0XHRcdC8vIFRoZXJlIGlzIG5vIGV4dGVuc2lvbiB0aGF0IGlzIGludGVyZXN0ZWQgaW4gdGhpcyBhY3RpdmF0aW9uIGV2ZW50XG5cdFx0XHRcdHJldHVybiBOT19PUF9WT0lEX1BST01JU0U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLl9hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50LCBhY3RpdmF0aW9uS2luZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEV4dGVuc2lvbnMgaGF2ZSBub3QgYmVlbiBzY2FubmVkIHlldC5cblxuXHRcdFx0Ly8gUmVjb3JkIHRoZSBmYWN0IHRoYXQgdGhpcyBhY3RpdmF0aW9uRXZlbnQgd2FzIHJlcXVlc3RlZCAoaW4gY2FzZSBvZiBhIHJlc3RhcnQpXG5cdFx0XHR0aGlzLl9hbGxSZXF1ZXN0ZWRBY3RpdmF0ZUV2ZW50cy5hZGQoYWN0aXZhdGlvbkV2ZW50KTtcblxuXHRcdFx0aWYgKGFjdGl2YXRpb25LaW5kID09PSBBY3RpdmF0aW9uS2luZC5JbW1lZGlhdGUpIHtcblx0XHRcdFx0Ly8gRG8gbm90IHdhaXQgZm9yIHRoZSBub3JtYWwgc3RhcnQtdXAgb2YgdGhlIGV4dGVuc2lvbiBob3N0KHMpXG5cdFx0XHRcdHJldHVybiB0aGlzLl9hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50LCBhY3RpdmF0aW9uS2luZCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLl9pbnN0YWxsZWRFeHRlbnNpb25zUmVhZHkud2FpdCgpLnRoZW4oKCkgPT4gdGhpcy5fYWN0aXZhdGVCeUV2ZW50KGFjdGl2YXRpb25FdmVudCwgYWN0aXZhdGlvbktpbmQpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50OiBzdHJpbmcsIGFjdGl2YXRpb25LaW5kOiBBY3RpdmF0aW9uS2luZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IFByb21pc2UuYWxsKFxuXHRcdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLm1hcChleHRIb3N0TWFuYWdlciA9PiBleHRIb3N0TWFuYWdlci5hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50LCBhY3RpdmF0aW9uS2luZCkpXG5cdFx0KS50aGVuKCgpID0+IHsgfSk7XG5cdFx0dGhpcy5fb25XaWxsQWN0aXZhdGVCeUV2ZW50LmZpcmUoe1xuXHRcdFx0ZXZlbnQ6IGFjdGl2YXRpb25FdmVudCxcblx0XHRcdGFjdGl2YXRpb246IHJlc3VsdFxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgYWN0aXZhdGVCeUlkKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCByZWFzb246IEV4dGVuc2lvbkFjdGl2YXRpb25SZWFzb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aXZhdGVCeUlkKGV4dGVuc2lvbklkLCByZWFzb24pO1xuXHR9XG5cblx0cHVibGljIGFjdGl2YXRpb25FdmVudElzRG9uZShhY3RpdmF0aW9uRXZlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5faW5zdGFsbGVkRXh0ZW5zaW9uc1JlYWR5LmlzT3BlbigpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fcmVnaXN0cnkuY29udGFpbnNBY3RpdmF0aW9uRXZlbnQoYWN0aXZhdGlvbkV2ZW50KSkge1xuXHRcdFx0Ly8gVGhlcmUgaXMgbm8gZXh0ZW5zaW9uIHRoYXQgaXMgaW50ZXJlc3RlZCBpbiB0aGlzIGFjdGl2YXRpb24gZXZlbnRcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLmV2ZXJ5KG1hbmFnZXIgPT4gbWFuYWdlci5hY3RpdmF0aW9uRXZlbnRJc0RvbmUoYWN0aXZhdGlvbkV2ZW50KSk7XG5cdH1cblxuXHRwdWJsaWMgd2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YWxsZWRFeHRlbnNpb25zUmVhZHkud2FpdCgpO1xuXHR9XG5cblx0Z2V0IGV4dGVuc2lvbnMoKTogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RyeS5nZXRBbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0RXh0ZW5zaW9uUmVnaXN0cnlTbmFwc2hvdFdoZW5SZWFkeSgpOiBQcm9taXNlPEV4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnlTbmFwc2hvdD4ge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YWxsZWRFeHRlbnNpb25zUmVhZHkud2FpdCgpLnRoZW4oKCkgPT4gdGhpcy5fcmVnaXN0cnkuZ2V0U25hcHNob3QoKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RXh0ZW5zaW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YWxsZWRFeHRlbnNpb25zUmVhZHkud2FpdCgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdHJ5LmdldEV4dGVuc2lvbkRlc2NyaXB0aW9uKGlkKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyByZWFkRXh0ZW5zaW9uUG9pbnRDb250cmlidXRpb25zPFQgZXh0ZW5kcyBJRXh0ZW5zaW9uQ29udHJpYnV0aW9uc1trZXlvZiBJRXh0ZW5zaW9uQ29udHJpYnV0aW9uc10+KGV4dFBvaW50OiBJRXh0ZW5zaW9uUG9pbnQ8VD4pOiBQcm9taXNlPEV4dGVuc2lvblBvaW50Q29udHJpYnV0aW9uPFQ+W10+IHtcblx0XHRyZXR1cm4gdGhpcy5faW5zdGFsbGVkRXh0ZW5zaW9uc1JlYWR5LndhaXQoKS50aGVuKCgpID0+IHtcblx0XHRcdGNvbnN0IGF2YWlsYWJsZUV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RyeS5nZXRBbGxFeHRlbnNpb25EZXNjcmlwdGlvbnMoKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBFeHRlbnNpb25Qb2ludENvbnRyaWJ1dGlvbjxUPltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgYXZhaWxhYmxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRpZiAoZGVzYy5jb250cmlidXRlcyAmJiBoYXNPd25Qcm9wZXJ0eS5jYWxsKGRlc2MuY29udHJpYnV0ZXMsIGV4dFBvaW50Lm5hbWUpKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2gobmV3IEV4dGVuc2lvblBvaW50Q29udHJpYnV0aW9uPFQ+KGRlc2MsIGRlc2MuY29udHJpYnV0ZXNbZXh0UG9pbnQubmFtZSBhcyBrZXlvZiB0eXBlb2YgZGVzYy5jb250cmlidXRlc10gYXMgVCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RXh0ZW5zaW9uc1N0YXR1cygpOiB7IFtpZDogc3RyaW5nXTogSUV4dGVuc2lvbnNTdGF0dXMgfSB7XG5cdFx0Y29uc3QgcmVzdWx0OiB7IFtpZDogc3RyaW5nXTogSUV4dGVuc2lvbnNTdGF0dXMgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0aWYgKHRoaXMuX3JlZ2lzdHJ5KSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5fcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblN0YXR1cyA9IHRoaXMuX2V4dGVuc2lvblN0YXR1cy5nZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0XHRyZXN1bHRbZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWVdID0ge1xuXHRcdFx0XHRcdGlkOiBleHRlbnNpb24uaWRlbnRpZmllcixcblx0XHRcdFx0XHRtZXNzYWdlczogZXh0ZW5zaW9uU3RhdHVzPy5tZXNzYWdlcyA/PyBbXSxcblx0XHRcdFx0XHRhY3RpdmF0aW9uU3RhcnRlZDogZXh0ZW5zaW9uU3RhdHVzPy5hY3RpdmF0aW9uU3RhcnRlZCA/PyBmYWxzZSxcblx0XHRcdFx0XHRhY3RpdmF0aW9uVGltZXM6IGV4dGVuc2lvblN0YXR1cz8uYWN0aXZhdGlvblRpbWVzID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRydW50aW1lRXJyb3JzOiBleHRlbnNpb25TdGF0dXM/LnJ1bnRpbWVFcnJvcnMgPz8gW10sXG5cdFx0XHRcdFx0cnVubmluZ0xvY2F0aW9uOiB0aGlzLl9ydW5uaW5nTG9jYXRpb25zLmdldFJ1bm5pbmdMb2NhdGlvbihleHRlbnNpb24uaWRlbnRpZmllciksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0SW5zcGVjdFBvcnRzKGV4dGVuc2lvbkhvc3RLaW5kOiBFeHRlbnNpb25Ib3N0S2luZCwgdHJ5RW5hYmxlSW5zcGVjdG9yOiBib29sZWFuKTogUHJvbWlzZTx7IHBvcnQ6IG51bWJlcjsgaG9zdDogc3RyaW5nIH1bXT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21pc2UuYWxsKFxuXHRcdFx0dGhpcy5fZ2V0RXh0ZW5zaW9uSG9zdE1hbmFnZXJzKGV4dGVuc2lvbkhvc3RLaW5kKS5tYXAoZXh0SG9zdCA9PiBleHRIb3N0LmdldEluc3BlY3RQb3J0KHRyeUVuYWJsZUluc3BlY3RvcikpXG5cdFx0KTtcblx0XHQvLyByZW1vdmUgMHM6XG5cdFx0cmV0dXJuIHJlc3VsdC5maWx0ZXIoaXNEZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRSZW1vdGVFbnZpcm9ubWVudChlbnY6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgbnVsbCB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzXG5cdFx0XHQubWFwKG1hbmFnZXIgPT4gbWFuYWdlci5zZXRSZW1vdGVFbnZpcm9ubWVudChlbnYpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vIC0tLSBpbXBsXG5cblx0cHJpdmF0ZSBfc2FmZUludm9rZUlzRW5hYmxlZChleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChleHRlbnNpb24pO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RvSGFuZGxlRXh0ZW5zaW9uUG9pbnRzKGFmZmVjdGVkRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIG9ubHlSZXNvbHZlckV4dGVuc2lvblBvaW50czogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGFmZmVjdGVkRXh0ZW5zaW9uUG9pbnRzOiB7IFtleHRQb2ludE5hbWU6IHN0cmluZ106IGJvb2xlYW4gfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25EZXNjcmlwdGlvbiBvZiBhZmZlY3RlZEV4dGVuc2lvbnMpIHtcblx0XHRcdGlmIChleHRlbnNpb25EZXNjcmlwdGlvbi5jb250cmlidXRlcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4dFBvaW50TmFtZSBpbiBleHRlbnNpb25EZXNjcmlwdGlvbi5jb250cmlidXRlcykge1xuXHRcdFx0XHRcdGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGV4dGVuc2lvbkRlc2NyaXB0aW9uLmNvbnRyaWJ1dGVzLCBleHRQb2ludE5hbWUpKSB7XG5cdFx0XHRcdFx0XHRhZmZlY3RlZEV4dGVuc2lvblBvaW50c1tleHRQb2ludE5hbWVdID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlSGFuZGxlciA9IChtc2c6IElNZXNzYWdlKSA9PiB0aGlzLl9oYW5kbGVFeHRlbnNpb25Qb2ludE1lc3NhZ2UobXNnKTtcblx0XHRjb25zdCBhdmFpbGFibGVFeHRlbnNpb25zID0gdGhpcy5fcmVnaXN0cnkuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uUG9pbnRzID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEV4dGVuc2lvblBvaW50cygpO1xuXHRcdHBlcmYubWFyayhvbmx5UmVzb2x2ZXJFeHRlbnNpb25Qb2ludHMgPyAnY29kZS93aWxsSGFuZGxlUmVzb2x2ZXJFeHRlbnNpb25Qb2ludHMnIDogJ2NvZGUvd2lsbEhhbmRsZUV4dGVuc2lvblBvaW50cycpO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uUG9pbnQgb2YgZXh0ZW5zaW9uUG9pbnRzKSB7XG5cdFx0XHRpZiAoYWZmZWN0ZWRFeHRlbnNpb25Qb2ludHNbZXh0ZW5zaW9uUG9pbnQubmFtZV0gJiYgKCFvbmx5UmVzb2x2ZXJFeHRlbnNpb25Qb2ludHMgfHwgZXh0ZW5zaW9uUG9pbnQuY2FuSGFuZGxlUmVzb2x2ZXIpKSB7XG5cdFx0XHRcdHBlcmYubWFyayhgY29kZS93aWxsSGFuZGxlRXh0ZW5zaW9uUG9pbnQvJHtleHRlbnNpb25Qb2ludC5uYW1lfWApO1xuXHRcdFx0XHRBYnN0cmFjdEV4dGVuc2lvblNlcnZpY2UuX2hhbmRsZUV4dGVuc2lvblBvaW50KGV4dGVuc2lvblBvaW50LCBhdmFpbGFibGVFeHRlbnNpb25zLCBtZXNzYWdlSGFuZGxlcik7XG5cdFx0XHRcdHBlcmYubWFyayhgY29kZS9kaWRIYW5kbGVFeHRlbnNpb25Qb2ludC8ke2V4dGVuc2lvblBvaW50Lm5hbWV9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHBlcmYubWFyayhvbmx5UmVzb2x2ZXJFeHRlbnNpb25Qb2ludHMgPyAnY29kZS9kaWRIYW5kbGVSZXNvbHZlckV4dGVuc2lvblBvaW50cycgOiAnY29kZS9kaWRIYW5kbGVFeHRlbnNpb25Qb2ludHMnKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE9yQ3JlYXRlRXh0ZW5zaW9uU3RhdHVzKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogRXh0ZW5zaW9uU3RhdHVzIHtcblx0XHRpZiAoIXRoaXMuX2V4dGVuc2lvblN0YXR1cy5oYXMoZXh0ZW5zaW9uSWQpKSB7XG5cdFx0XHR0aGlzLl9leHRlbnNpb25TdGF0dXMuc2V0KGV4dGVuc2lvbklkLCBuZXcgRXh0ZW5zaW9uU3RhdHVzKGV4dGVuc2lvbklkKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25TdGF0dXMuZ2V0KGV4dGVuc2lvbklkKSE7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVFeHRlbnNpb25Qb2ludE1lc3NhZ2UobXNnOiBJTWVzc2FnZSkge1xuXHRcdGNvbnN0IGV4dGVuc2lvblN0YXR1cyA9IHRoaXMuX2dldE9yQ3JlYXRlRXh0ZW5zaW9uU3RhdHVzKG1zZy5leHRlbnNpb25JZCk7XG5cdFx0ZXh0ZW5zaW9uU3RhdHVzLmFkZE1lc3NhZ2UobXNnKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuX3JlZ2lzdHJ5LmdldEV4dGVuc2lvbkRlc2NyaXB0aW9uKG1zZy5leHRlbnNpb25JZCk7XG5cdFx0Y29uc3Qgc3RyTXNnID0gYFske21zZy5leHRlbnNpb25JZC52YWx1ZX1dOiAke21zZy5tZXNzYWdlfWA7XG5cblx0XHRpZiAobXNnLnR5cGUgPT09IFNldmVyaXR5LkVycm9yKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uICYmIGV4dGVuc2lvbi5pc1VuZGVyRGV2ZWxvcG1lbnQpIHtcblx0XHRcdFx0Ly8gVGhpcyBtZXNzYWdlIGlzIGFib3V0IHRoZSBleHRlbnNpb24gY3VycmVudGx5IGJlaW5nIGRldmVsb3BlZFxuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7IHNldmVyaXR5OiBTZXZlcml0eS5FcnJvciwgbWVzc2FnZTogc3RyTXNnIH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihzdHJNc2cpO1xuXHRcdH0gZWxzZSBpZiAobXNnLnR5cGUgPT09IFNldmVyaXR5Lldhcm5pbmcpIHtcblx0XHRcdGlmIChleHRlbnNpb24gJiYgZXh0ZW5zaW9uLmlzVW5kZXJEZXZlbG9wbWVudCkge1xuXHRcdFx0XHQvLyBUaGlzIG1lc3NhZ2UgaXMgYWJvdXQgdGhlIGV4dGVuc2lvbiBjdXJyZW50bHkgYmVpbmcgZGV2ZWxvcGVkXG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHsgc2V2ZXJpdHk6IFNldmVyaXR5Lldhcm5pbmcsIG1lc3NhZ2U6IHN0ck1zZyB9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihzdHJNc2cpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oc3RyTXNnKTtcblx0XHR9XG5cblx0XHRpZiAobXNnLmV4dGVuc2lvbklkICYmIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0ICYmICF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNFeHRlbnNpb25EZXZlbG9wbWVudCkge1xuXHRcdFx0Y29uc3QgeyB0eXBlLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uUG9pbnRJZCwgbWVzc2FnZSB9ID0gbXNnO1xuXHRcdFx0dHlwZSBFeHRlbnNpb25zTWVzc2FnZUNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdFx0Y29tbWVudDogJ0EgdmFsaWRhdGlvbiBtZXNzYWdlIGZvciBhbiBleHRlbnNpb24nO1xuXHRcdFx0XHR0eXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnU2V2ZXJpdHkgb2YgcHJvYmxlbS4nIH07XG5cdFx0XHRcdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXIgb2YgdGhlIGV4dGVuc2lvbiB0aGF0IGhhcyBhIHByb2JsZW0uJyB9O1xuXHRcdFx0XHRleHRlbnNpb25Qb2ludElkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBwb2ludCB0aGF0IGhhcyBhIHByb2JsZW0uJyB9O1xuXHRcdFx0XHRtZXNzYWdlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG1lc3NhZ2Ugb2YgdGhlIHByb2JsZW0uJyB9O1xuXHRcdFx0fTtcblx0XHRcdHR5cGUgRXh0ZW5zaW9uc01lc3NhZ2VFdmVudCA9IHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHk7XG5cdFx0XHRcdGV4dGVuc2lvbklkOiBzdHJpbmc7XG5cdFx0XHRcdGV4dGVuc2lvblBvaW50SWQ6IHN0cmluZztcblx0XHRcdFx0bWVzc2FnZTogc3RyaW5nO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxFeHRlbnNpb25zTWVzc2FnZUV2ZW50LCBFeHRlbnNpb25zTWVzc2FnZUNsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uc01lc3NhZ2UnLCB7XG5cdFx0XHRcdHR5cGUsIGV4dGVuc2lvbklkOiBleHRlbnNpb25JZC52YWx1ZSwgZXh0ZW5zaW9uUG9pbnRJZCwgbWVzc2FnZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hhbmRsZUV4dGVuc2lvblBvaW50PFQgZXh0ZW5kcyBJRXh0ZW5zaW9uQ29udHJpYnV0aW9uc1trZXlvZiBJRXh0ZW5zaW9uQ29udHJpYnV0aW9uc10+KGV4dGVuc2lvblBvaW50OiBFeHRlbnNpb25Qb2ludDxUPiwgYXZhaWxhYmxlRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIG1lc3NhZ2VIYW5kbGVyOiAobXNnOiBJTWVzc2FnZSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHVzZXJzOiBJRXh0ZW5zaW9uUG9pbnRVc2VyPFQ+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgYXZhaWxhYmxlRXh0ZW5zaW9ucykge1xuXHRcdFx0aWYgKGRlc2MuY29udHJpYnV0ZXMgJiYgaGFzT3duUHJvcGVydHkuY2FsbChkZXNjLmNvbnRyaWJ1dGVzLCBleHRlbnNpb25Qb2ludC5uYW1lKSkge1xuXHRcdFx0XHR1c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogZGVzYyxcblx0XHRcdFx0XHR2YWx1ZTogZGVzYy5jb250cmlidXRlc1tleHRlbnNpb25Qb2ludC5uYW1lIGFzIGtleW9mIHR5cGVvZiBkZXNjLmNvbnRyaWJ1dGVzXSBhcyBULFxuXHRcdFx0XHRcdGNvbGxlY3RvcjogbmV3IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IobWVzc2FnZUhhbmRsZXIsIGRlc2MsIGV4dGVuc2lvblBvaW50Lm5hbWUpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRleHRlbnNpb25Qb2ludC5hY2NlcHRVc2Vycyh1c2Vycyk7XG5cdH1cblxuXHQvLyNyZWdpb24gQ2FsbGVkIGJ5IGV4dGVuc2lvbiBob3N0XG5cblx0cHJpdmF0ZSBfYWNxdWlyZUludGVybmFsQVBJKGV4dGVuc2lvbkhvc3Q6IElFeHRlbnNpb25Ib3N0KTogSUludGVybmFsRXh0ZW5zaW9uU2VydmljZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9hY3RpdmF0ZUJ5SWQ6IChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9hY3RpdmF0ZUJ5SWQoZXh0ZW5zaW9uSWQsIHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0X29uV2lsbEFjdGl2YXRlRXh0ZW5zaW9uOiAoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIpOiB2b2lkID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX29uV2lsbEFjdGl2YXRlRXh0ZW5zaW9uKGV4dGVuc2lvbklkLCBleHRlbnNpb25Ib3N0LnJ1bm5pbmdMb2NhdGlvbik7XG5cdFx0XHR9LFxuXHRcdFx0X29uRGlkQWN0aXZhdGVFeHRlbnNpb246IChleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgY29kZUxvYWRpbmdUaW1lOiBudW1iZXIsIGFjdGl2YXRlQ2FsbFRpbWU6IG51bWJlciwgYWN0aXZhdGVSZXNvbHZlZFRpbWU6IG51bWJlciwgYWN0aXZhdGlvblJlYXNvbjogRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbik6IHZvaWQgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fb25EaWRBY3RpdmF0ZUV4dGVuc2lvbihleHRlbnNpb25JZCwgY29kZUxvYWRpbmdUaW1lLCBhY3RpdmF0ZUNhbGxUaW1lLCBhY3RpdmF0ZVJlc29sdmVkVGltZSwgYWN0aXZhdGlvblJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0X29uRGlkQWN0aXZhdGVFeHRlbnNpb25FcnJvcjogKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBlcnJvcjogRXJyb3IpOiB2b2lkID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX29uRGlkQWN0aXZhdGVFeHRlbnNpb25FcnJvcihleHRlbnNpb25JZCwgZXJyb3IpO1xuXHRcdFx0fSxcblx0XHRcdF9vbkV4dGVuc2lvblJ1bnRpbWVFcnJvcjogKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBlcnI6IEVycm9yKTogdm9pZCA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9vbkV4dGVuc2lvblJ1bnRpbWVFcnJvcihleHRlbnNpb25JZCwgZXJyKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGFzeW5jIF9hY3RpdmF0ZUJ5SWQoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIHJlYXNvbjogRXh0ZW5zaW9uQWN0aXZhdGlvblJlYXNvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcblx0XHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5tYXAobWFuYWdlciA9PiBtYW5hZ2VyLmFjdGl2YXRlKGV4dGVuc2lvbklkLCByZWFzb24pKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0aXZhdGVkID0gcmVzdWx0cy5zb21lKGUgPT4gZSk7XG5cdFx0aWYgKCFhY3RpdmF0ZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBleHRlbnNpb24gJHtleHRlbnNpb25JZC52YWx1ZX1gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbldpbGxBY3RpdmF0ZUV4dGVuc2lvbihleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgcnVubmluZ0xvY2F0aW9uOiBFeHRlbnNpb25SdW5uaW5nTG9jYXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9ydW5uaW5nTG9jYXRpb25zLnNldChleHRlbnNpb25JZCwgcnVubmluZ0xvY2F0aW9uKTtcblx0XHRjb25zdCBleHRlbnNpb25TdGF0dXMgPSB0aGlzLl9nZXRPckNyZWF0ZUV4dGVuc2lvblN0YXR1cyhleHRlbnNpb25JZCk7XG5cdFx0ZXh0ZW5zaW9uU3RhdHVzLm9uV2lsbEFjdGl2YXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZEFjdGl2YXRlRXh0ZW5zaW9uKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBjb2RlTG9hZGluZ1RpbWU6IG51bWJlciwgYWN0aXZhdGVDYWxsVGltZTogbnVtYmVyLCBhY3RpdmF0ZVJlc29sdmVkVGltZTogbnVtYmVyLCBhY3RpdmF0aW9uUmVhc29uOiBFeHRlbnNpb25BY3RpdmF0aW9uUmVhc29uKTogdm9pZCB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uU3RhdHVzID0gdGhpcy5fZ2V0T3JDcmVhdGVFeHRlbnNpb25TdGF0dXMoZXh0ZW5zaW9uSWQpO1xuXHRcdGV4dGVuc2lvblN0YXR1cy5zZXRBY3RpdmF0aW9uVGltZXMobmV3IEFjdGl2YXRpb25UaW1lcyhjb2RlTG9hZGluZ1RpbWUsIGFjdGl2YXRlQ2FsbFRpbWUsIGFjdGl2YXRlUmVzb2x2ZWRUaW1lLCBhY3RpdmF0aW9uUmVhc29uKSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zU3RhdHVzLmZpcmUoW2V4dGVuc2lvbklkXSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZEFjdGl2YXRlRXh0ZW5zaW9uRXJyb3IoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGVycm9yOiBFcnJvcik6IHZvaWQge1xuXHRcdHR5cGUgRXh0ZW5zaW9uQWN0aXZhdGlvbkVycm9yQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdGNvbW1lbnQ6ICdBbiBleHRlbnNpb24gZmFpbGVkIHRvIGFjdGl2YXRlJztcblx0XHRcdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXIgb2YgdGhlIGV4dGVuc2lvbi4nIH07XG5cdFx0XHRlcnJvcjogeyBjbGFzc2lmaWNhdGlvbjogJ0NhbGxzdGFja09yRXhjZXB0aW9uJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBlcnJvciBtZXNzYWdlLicgfTtcblx0XHR9O1xuXHRcdHR5cGUgRXh0ZW5zaW9uQWN0aXZhdGlvbkVycm9yRXZlbnQgPSB7XG5cdFx0XHRleHRlbnNpb25JZDogc3RyaW5nO1xuXHRcdFx0ZXJyb3I6IHN0cmluZztcblx0XHR9O1xuXHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxFeHRlbnNpb25BY3RpdmF0aW9uRXJyb3JFdmVudCwgRXh0ZW5zaW9uQWN0aXZhdGlvbkVycm9yQ2xhc3NpZmljYXRpb24+KCdleHRlbnNpb25BY3RpdmF0aW9uRXJyb3InLCB7XG5cdFx0XHRleHRlbnNpb25JZDogZXh0ZW5zaW9uSWQudmFsdWUsXG5cdFx0XHRlcnJvcjogZXJyb3IubWVzc2FnZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25FeHRlbnNpb25SdW50aW1lRXJyb3IoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGVycjogRXJyb3IpOiB2b2lkIHtcblx0XHRjb25zdCBleHRlbnNpb25TdGF0dXMgPSB0aGlzLl9nZXRPckNyZWF0ZUV4dGVuc2lvblN0YXR1cyhleHRlbnNpb25JZCk7XG5cdFx0ZXh0ZW5zaW9uU3RhdHVzLmFkZFJ1bnRpbWVFcnJvcihlcnIpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9uc1N0YXR1cy5maXJlKFtleHRlbnNpb25JZF0pO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9yZXNvbHZlRXh0ZW5zaW9ucygpOiBBc3luY0l0ZXJhYmxlPFJlc29sdmVkRXh0ZW5zaW9ucz47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfb25FeHRlbnNpb25Ib3N0RXhpdChjb2RlOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3Jlc29sdmVBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcpOiBQcm9taXNlPFJlc29sdmVyUmVzdWx0Pjtcbn1cblxuY2xhc3MgRXh0ZW5zaW9uSG9zdENvbGxlY3Rpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9leHRlbnNpb25Ib3N0TWFuYWdlcnM6IEV4dGVuc2lvbkhvc3RNYW5hZ2VyRGF0YVtdID0gW107XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgbWFuYWdlciA9IHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vyc1tpXTtcblx0XHRcdG1hbmFnZXIuZXh0ZW5zaW9uSG9zdC5kaXNjb25uZWN0KCk7XG5cdFx0XHRtYW5hZ2VyLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzID0gW107XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIGFkZChleHRlbnNpb25Ib3N0TWFuYWdlcjogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyLCBkaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5wdXNoKG5ldyBFeHRlbnNpb25Ib3N0TWFuYWdlckRhdGEoZXh0ZW5zaW9uSG9zdE1hbmFnZXIsIGRpc3Bvc2FibGVTdG9yZSkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHN0b3BBbGxJblJldmVyc2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTIyMDRcblx0XHQvLyBEaXNwb3NlIGV4dGVuc2lvbiBob3N0cyBpbiByZXZlcnNlIGNyZWF0aW9uIG9yZGVyIGJlY2F1c2UgdGhlIGxvY2FsIGV4dGVuc2lvbiBob3N0XG5cdFx0Ly8gbWlnaHQgYmUgY3JpdGljYWwgaW4gc3VzdGFpbmluZyBhIGNvbm5lY3Rpb24gdG8gdGhlIHJlbW90ZSBleHRlbnNpb24gaG9zdFxuXHRcdGZvciAobGV0IGkgPSB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IG1hbmFnZXIgPSB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnNbaV07XG5cdFx0XHRhd2FpdCBtYW5hZ2VyLmV4dGVuc2lvbkhvc3QuZGlzY29ubmVjdCgpO1xuXHRcdFx0bWFuYWdlci5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2VycyA9IFtdO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHN0b3BPbmUoZXh0ZW5zaW9uSG9zdE1hbmFnZXI6IElFeHRlbnNpb25Ib3N0TWFuYWdlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLmZpbmRJbmRleChlbCA9PiBlbC5leHRlbnNpb25Ib3N0ID09PSBleHRlbnNpb25Ib3N0TWFuYWdlcik7XG5cdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RNYW5hZ2Vycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0YXdhaXQgZXh0ZW5zaW9uSG9zdE1hbmFnZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0ZXh0ZW5zaW9uSG9zdE1hbmFnZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRCeUtpbmQoa2luZDogRXh0ZW5zaW9uSG9zdEtpbmQpOiBJRXh0ZW5zaW9uSG9zdE1hbmFnZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVyKGVsID0+IGVsLmtpbmQgPT09IGtpbmQpO1xuXHR9XG5cblx0cHVibGljIGdldEJ5UnVubmluZ0xvY2F0aW9uKHJ1bm5pbmdMb2NhdGlvbjogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uKTogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyIHwgbnVsbCB7XG5cdFx0Zm9yIChjb25zdCBlbCBvZiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMpIHtcblx0XHRcdGlmIChlbC5leHRlbnNpb25Ib3N0LnJlcHJlc2VudHNSdW5uaW5nTG9jYXRpb24ocnVubmluZ0xvY2F0aW9uKSkge1xuXHRcdFx0XHRyZXR1cm4gZWwuZXh0ZW5zaW9uSG9zdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25Ib3N0TWFuYWdlciBvZiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMpIHtcblx0XHRcdHlpZWxkIGV4dGVuc2lvbkhvc3RNYW5hZ2VyLmV4dGVuc2lvbkhvc3Q7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG1hcDxUPihjYWxsYmFjazogKGV4dEhvc3RNYW5hZ2VyOiBJRXh0ZW5zaW9uSG9zdE1hbmFnZXIpID0+IFQpOiBUW10ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMubWFwKGVsID0+IGNhbGxiYWNrKGVsLmV4dGVuc2lvbkhvc3QpKTtcblx0fVxuXG5cdHB1YmxpYyBldmVyeShjYWxsYmFjazogKGV4dEhvc3RNYW5hZ2VyOiBJRXh0ZW5zaW9uSG9zdE1hbmFnZXIpID0+IHVua25vd24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdE1hbmFnZXJzLmV2ZXJ5KGVsID0+IGNhbGxiYWNrKGVsLmV4dGVuc2lvbkhvc3QpKTtcblx0fVxuXG5cdHB1YmxpYyBmaWx0ZXIoY2FsbGJhY2s6IChleHRIb3N0TWFuYWdlcjogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyKSA9PiB1bmtub3duKTogSUV4dGVuc2lvbkhvc3RNYW5hZ2VyW10ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0TWFuYWdlcnMuZmlsdGVyKGVsID0+IGNhbGxiYWNrKGVsLmV4dGVuc2lvbkhvc3QpKS5tYXAoZWwgPT4gZWwuZXh0ZW5zaW9uSG9zdCk7XG5cdH1cbn1cblxuY2xhc3MgRXh0ZW5zaW9uSG9zdE1hbmFnZXJEYXRhIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGV4dGVuc2lvbkhvc3Q6IElFeHRlbnNpb25Ib3N0TWFuYWdlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmVcblx0KSB7IH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVTdG9yZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5leHRlbnNpb25Ib3N0LmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzb2x2ZXJFeHRlbnNpb25zIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGV4dGVuc2lvbnM6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdLFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgTG9jYWxFeHRlbnNpb25zIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGV4dGVuc2lvbnM6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdLFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgUmVtb3RlRXh0ZW5zaW9ucyB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBleHRlbnNpb25zOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSxcblx0KSB7IH1cbn1cblxuZXhwb3J0IHR5cGUgUmVzb2x2ZWRFeHRlbnNpb25zID0gUmVzb2x2ZXJFeHRlbnNpb25zIHwgTG9jYWxFeHRlbnNpb25zIHwgUmVtb3RlRXh0ZW5zaW9ucztcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uSG9zdEZhY3Rvcnkge1xuXHRjcmVhdGVFeHRlbnNpb25Ib3N0KHJ1bm5pbmdMb2NhdGlvbnM6IEV4dGVuc2lvblJ1bm5pbmdMb2NhdGlvblRyYWNrZXIsIHJ1bm5pbmdMb2NhdGlvbjogRXh0ZW5zaW9uUnVubmluZ0xvY2F0aW9uLCBpc0luaXRpYWxTdGFydDogYm9vbGVhbik6IElFeHRlbnNpb25Ib3N0IHwgbnVsbDtcbn1cblxuY2xhc3MgRGVsdGFFeHRlbnNpb25zUXVldWVJdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRvQWRkOiBJRXh0ZW5zaW9uW10sXG5cdFx0cHVibGljIHJlYWRvbmx5IHRvUmVtb3ZlOiBzdHJpbmdbXSB8IElFeHRlbnNpb25bXVxuXHQpIHsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSZXNvbHZlckV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISFleHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cz8uc29tZShhY3RpdmF0aW9uRXZlbnQgPT4gYWN0aXZhdGlvbkV2ZW50LnN0YXJ0c1dpdGgoJ29uUmVzb2x2ZVJlbW90ZUF1dGhvcml0eTonKSk7XG59XG5cbi8qKlxuICogQGFyZ3VtZW50IGV4dGVuc2lvbnMgVGhlIGV4dGVuc2lvbnMgdG8gYmUgY2hlY2tlZC5cbiAqIEBhcmd1bWVudCBpZ25vcmVXb3Jrc3BhY2VUcnVzdCBEbyBub3QgdGFrZSB3b3Jrc3BhY2UgdHJ1c3QgaW50byBhY2NvdW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tFbmFibGVkQW5kUHJvcG9zZWRBUEkobG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGV4dGVuc2lvbnNQcm9wb3NlZEFwaTogRXh0ZW5zaW9uc1Byb3Bvc2VkQXBpLCBleHRlbnNpb25zOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSwgaWdub3JlV29ya3NwYWNlVHJ1c3Q6IGJvb2xlYW4pOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXSB7XG5cdC8vIGVuYWJsZSBvciBkaXNhYmxlIHByb3Bvc2VkIEFQSSBwZXIgZXh0ZW5zaW9uXG5cdGV4dGVuc2lvbnNQcm9wb3NlZEFwaS51cGRhdGVFbmFibGVkQXBpUHJvcG9zYWxzKGV4dGVuc2lvbnMpO1xuXG5cdC8vIGtlZXAgb25seSBlbmFibGVkIGV4dGVuc2lvbnNcblx0cmV0dXJuIGZpbHRlckVuYWJsZWRFeHRlbnNpb25zKGxvZ1NlcnZpY2UsIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBleHRlbnNpb25zLCBpZ25vcmVXb3Jrc3BhY2VUcnVzdCk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBzdWJzZXQgb2YgZXh0ZW5zaW9ucyB0aGF0IGFyZSBlbmFibGVkLlxuICogQGFyZ3VtZW50IGlnbm9yZVdvcmtzcGFjZVRydXN0IERvIG5vdCB0YWtlIHdvcmtzcGFjZSB0cnVzdCBpbnRvIGFjY291bnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWx0ZXJFbmFibGVkRXh0ZW5zaW9ucyhsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSwgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgZXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIGlnbm9yZVdvcmtzcGFjZVRydXN0OiBib29sZWFuKTogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10ge1xuXHRjb25zdCBlbmFibGVkRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXSwgZXh0ZW5zaW9uc1RvQ2hlY2s6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdID0gW10sIG1hcHBlZEV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0aWYgKGV4dGVuc2lvbi5pc1VuZGVyRGV2ZWxvcG1lbnQpIHtcblx0XHRcdC8vIE5ldmVyIGRpc2FibGUgZXh0ZW5zaW9ucyB1bmRlciBkZXZlbG9wbWVudFxuXHRcdFx0ZW5hYmxlZEV4dGVuc2lvbnMucHVzaChleHRlbnNpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRleHRlbnNpb25zVG9DaGVjay5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRtYXBwZWRFeHRlbnNpb25zLnB1c2godG9FeHRlbnNpb24oZXh0ZW5zaW9uKSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZW5hYmxlbWVudFN0YXRlcyA9IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmdldEVuYWJsZW1lbnRTdGF0ZXMobWFwcGVkRXh0ZW5zaW9ucywgaWdub3JlV29ya3NwYWNlVHJ1c3QgPyB7IHRydXN0ZWQ6IHRydWUgfSA6IHVuZGVmaW5lZCk7XG5cdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBlbmFibGVtZW50U3RhdGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdGlmIChleHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoZW5hYmxlbWVudFN0YXRlc1tpbmRleF0pKSB7XG5cdFx0XHRlbmFibGVkRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbnNUb0NoZWNrW2luZGV4XSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpc0NJKSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UuaW5mbyhgZmlsdGVyRW5hYmxlZEV4dGVuc2lvbnM6IGV4dGVuc2lvbiAnJHtleHRlbnNpb25zVG9DaGVja1tpbmRleF0uaWRlbnRpZmllci52YWx1ZX0nIGlzIGRpc2FibGVkYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGVuYWJsZWRFeHRlbnNpb25zO1xufVxuXG4vKipcbiAqIEBhcmd1bWVudCBleHRlbnNpb24gVGhlIGV4dGVuc2lvbiB0byBiZSBjaGVja2VkLlxuICogQGFyZ3VtZW50IGlnbm9yZVdvcmtzcGFjZVRydXN0IERvIG5vdCB0YWtlIHdvcmtzcGFjZSB0cnVzdCBpbnRvIGFjY291bnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRlbnNpb25Jc0VuYWJsZWQobG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZ25vcmVXb3Jrc3BhY2VUcnVzdDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZmlsdGVyRW5hYmxlZEV4dGVuc2lvbnMobG9nU2VydmljZSwgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIFtleHRlbnNpb25dLCBpZ25vcmVXb3Jrc3BhY2VUcnVzdCkuaW5jbHVkZXMoZXh0ZW5zaW9uKTtcbn1cblxuZnVuY3Rpb24gaW5jbHVkZXMoZXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIGlkZW50aWZpZXI6IEV4dGVuc2lvbklkZW50aWZpZXIpOiBib29sZWFuIHtcblx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdGlmIChFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyhleHRlbnNpb24uaWRlbnRpZmllciwgaWRlbnRpZmllcikpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25TdGF0dXMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21lc3NhZ2VzOiBJTWVzc2FnZVtdID0gW107XG5cdHB1YmxpYyBnZXQgbWVzc2FnZXMoKTogSU1lc3NhZ2VbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX21lc3NhZ2VzO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aXZhdGlvblRpbWVzOiBBY3RpdmF0aW9uVGltZXMgfCBudWxsID0gbnVsbDtcblx0cHVibGljIGdldCBhY3RpdmF0aW9uVGltZXMoKTogQWN0aXZhdGlvblRpbWVzIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2YXRpb25UaW1lcztcblx0fVxuXG5cdHByaXZhdGUgX3J1bnRpbWVFcnJvcnM6IEVycm9yW10gPSBbXTtcblx0cHVibGljIGdldCBydW50aW1lRXJyb3JzKCk6IEVycm9yW10ge1xuXHRcdHJldHVybiB0aGlzLl9ydW50aW1lRXJyb3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aXZhdGlvblN0YXJ0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGdldCBhY3RpdmF0aW9uU3RhcnRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aXZhdGlvblN0YXJ0ZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgaWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsXG5cdCkgeyB9XG5cblx0cHVibGljIGNsZWFyUnVudGltZVN0YXR1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3RpdmF0aW9uU3RhcnRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2FjdGl2YXRpb25UaW1lcyA9IG51bGw7XG5cdFx0dGhpcy5fcnVudGltZUVycm9ycyA9IFtdO1xuXHR9XG5cblx0cHVibGljIGFkZE1lc3NhZ2UobXNnOiBJTWVzc2FnZSk6IHZvaWQge1xuXHRcdHRoaXMuX21lc3NhZ2VzLnB1c2gobXNnKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRBY3RpdmF0aW9uVGltZXMoYWN0aXZhdGlvblRpbWVzOiBBY3RpdmF0aW9uVGltZXMpIHtcblx0XHR0aGlzLl9hY3RpdmF0aW9uVGltZXMgPSBhY3RpdmF0aW9uVGltZXM7XG5cdH1cblxuXHRwdWJsaWMgYWRkUnVudGltZUVycm9yKGVycjogRXJyb3IpOiB2b2lkIHtcblx0XHR0aGlzLl9ydW50aW1lRXJyb3JzLnB1c2goZXJyKTtcblx0fVxuXG5cdHB1YmxpYyBvbldpbGxBY3RpdmF0ZSgpIHtcblx0XHR0aGlzLl9hY3RpdmF0aW9uU3RhcnRlZCA9IHRydWU7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElFeHRlbnNpb25Ib3N0Q3Jhc2hJbmZvIHtcblx0dGltZXN0YW1wOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25Ib3N0Q3Jhc2hUcmFja2VyIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfVElNRV9MSU1JVCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgbWludXRlc1xuXHRwcml2YXRlIHN0YXRpYyBfQ1JBU0hfTElNSVQgPSAzO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlY2VudENyYXNoZXM6IElFeHRlbnNpb25Ib3N0Q3Jhc2hJbmZvW10gPSBbXTtcblxuXHRwcml2YXRlIF9yZW1vdmVPbGRDcmFzaGVzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxpbWl0ID0gRGF0ZS5ub3coKSAtIEV4dGVuc2lvbkhvc3RDcmFzaFRyYWNrZXIuX1RJTUVfTElNSVQ7XG5cdFx0d2hpbGUgKHRoaXMuX3JlY2VudENyYXNoZXMubGVuZ3RoID4gMCAmJiB0aGlzLl9yZWNlbnRDcmFzaGVzWzBdLnRpbWVzdGFtcCA8IGxpbWl0KSB7XG5cdFx0XHR0aGlzLl9yZWNlbnRDcmFzaGVzLnNoaWZ0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyQ3Jhc2goKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3ZlT2xkQ3Jhc2hlcygpO1xuXHRcdHRoaXMuX3JlY2VudENyYXNoZXMucHVzaCh7IHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcblx0fVxuXG5cdHB1YmxpYyBzaG91bGRBdXRvbWF0aWNhbGx5UmVzdGFydCgpOiBib29sZWFuIHtcblx0XHR0aGlzLl9yZW1vdmVPbGRDcmFzaGVzKCk7XG5cdFx0cmV0dXJuICh0aGlzLl9yZWNlbnRDcmFzaGVzLmxlbmd0aCA8IEV4dGVuc2lvbkhvc3RDcmFzaFRyYWNrZXIuX0NSQVNIX0xJTUlUKTtcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgY2FuIHJ1biBjb3JyZWN0bHkgb25seSBvbiB0aGUgcmVuZGVyZXIgcHJvY2VzcyBiZWNhdXNlIHRoYXQgaXMgdGhlIG9ubHkgcGxhY2VcbiAqIHdoZXJlIGFsbCBleHRlbnNpb24gcG9pbnRzIGFuZCBhbGwgaW1wbGljaXQgYWN0aXZhdGlvbiBldmVudHMgZ2VuZXJhdG9ycyBhcmUga25vd24uXG4gKi9cbmV4cG9ydCBjbGFzcyBJbXBsaWNpdEFjdGl2YXRpb25Bd2FyZVJlYWRlciBpbXBsZW1lbnRzIElBY3RpdmF0aW9uRXZlbnRzUmVhZGVyIHtcblx0cHVibGljIHJlYWRBY3RpdmF0aW9uRXZlbnRzKGV4dGVuc2lvbkRlc2NyaXB0aW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIEltcGxpY2l0QWN0aXZhdGlvbkV2ZW50cy5yZWFkQWN0aXZhdGlvbkV2ZW50cyhleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdH1cbn1cblxuY2xhc3MgQWN0aXZhdGlvbkZlYXR1cmVNYXJrZG93bmVSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uRmVhdHVyZU1hcmtkb3duUmVuZGVyZXIge1xuXG5cdHJlYWRvbmx5IHR5cGUgPSAnbWFya2Rvd24nO1xuXG5cdHNob3VsZFJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhbWFuaWZlc3QuYWN0aXZhdGlvbkV2ZW50cztcblx0fVxuXG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxJTWFya2Rvd25TdHJpbmc+IHtcblx0XHRjb25zdCBhY3RpdmF0aW9uRXZlbnRzID0gbWFuaWZlc3QuYWN0aXZhdGlvbkV2ZW50cyB8fCBbXTtcblx0XHRjb25zdCBkYXRhID0gbmV3IE1hcmtkb3duU3RyaW5nKCk7XG5cdFx0aWYgKGFjdGl2YXRpb25FdmVudHMubGVuZ3RoKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGFjdGl2YXRpb25FdmVudCBvZiBhY3RpdmF0aW9uRXZlbnRzKSB7XG5cdFx0XHRcdGRhdGEuYXBwZW5kTWFya2Rvd24oYC0gXFxgJHthY3RpdmF0aW9uRXZlbnR9XFxgXFxuYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9uRmVhdHVyZXNFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAnYWN0aXZhdGlvbkV2ZW50cycsXG5cdGxhYmVsOiBubHMubG9jYWxpemUoJ2FjdGl2YXRpb24nLCBcIkFjdGl2YXRpb24gRXZlbnRzXCIpLFxuXHRhY2Nlc3M6IHtcblx0XHRjYW5Ub2dnbGU6IGZhbHNlXG5cdH0sXG5cdHJlbmRlcmVyOiBuZXcgU3luY0Rlc2NyaXB0b3IoQWN0aXZhdGlvbkZlYXR1cmVNYXJrZG93bmVSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUEwQixzQkFBc0I7QUFDaEQsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGVBQWU7QUFDeEIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsWUFBWTtBQUNyQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGlCQUFpQjtBQUUxQixZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUIsOEJBQThHO0FBQzVJLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlDQUFpQyw4QkFBOEIsa0NBQWtELGdDQUFnQztBQUMxSixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9DQUFvQztBQUM3QyxTQUFxQyxjQUFjLG1DQUFzRjtBQUN6SSxTQUFTLHNDQUFzQyw0Q0FBNEM7QUFDM0YsU0FBMEcsNENBQTRDO0FBQ3RKLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsbUJBQW1CLGtDQUE0RDtBQUN4RixTQUFTLDRCQUE0QjtBQUdyQyxTQUFTLDJDQUEyQztBQUNwRCxTQUFtQyw2QkFBNkIsK0JBQStCLDZCQUE2QjtBQUM1SCxTQUFTLGlDQUFpQyxrQ0FBa0M7QUFDNUUsU0FBUyxnQkFBZ0IsaUJBQTRDLHNCQUFzQiw0QkFBcU0sYUFBYSw4QkFBOEI7QUFFM1UsU0FBUywyQkFBMkMsMEJBQWdFO0FBQ3BILFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQXVFLHlDQUF5QywyQkFBMkI7QUFDM0ksU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQWlDLDJCQUEyQjtBQUU1RCxNQUFNLGlCQUFpQixPQUFPO0FBQzlCLE1BQU0scUJBQXFCLFFBQVEsUUFBYyxNQUFTO0FBRW5ELElBQWUsMkJBQWYsY0FBZ0QsV0FBd0M7QUFBQSxFQXdDOUYsWUFDQyxTQUNpQix3QkFDQSx1QkFDQSwwQkFDeUIsdUJBQ0Qsc0JBQ1EscUJBQ1gsbUJBQ21CLDZCQUN4QixjQUNHLGlCQUNxQiw2QkFDZCxpQkFDRCx1QkFDWSxxQ0FDdEIsYUFDUSxxQkFDWSxpQ0FDaEIsbUJBQ2dCLGlDQUNuQixnQkFDaEM7QUFDRCxVQUFNO0FBckJXO0FBQ0E7QUFDQTtBQUN5QjtBQUNEO0FBQ1E7QUFDWDtBQUNtQjtBQUN4QjtBQUNHO0FBQ3FCO0FBQ2Q7QUFDRDtBQUNZO0FBQ3RCO0FBQ1E7QUFDWTtBQUNoQjtBQUNnQjtBQUNuQjtBQXREbEMsU0FBaUIsMkJBQTJCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUM5RSxTQUFnQiwwQkFBMEIsS0FBSyx5QkFBeUI7QUFFeEUsU0FBaUIsK0JBQStCLEtBQUssVUFBVSxJQUFJLFFBQStCLENBQUM7QUFDbkcsU0FBZ0IsOEJBQThCLEtBQUssNkJBQTZCO0FBRWhGLFNBQWlCLHlCQUF5QixLQUFLLFVBQVUsSUFBSSxRQUEwSCxFQUFFLHNCQUFzQixJQUFJLENBQUMsQ0FBQztBQUNyTixTQUFnQix3QkFBd0IsS0FBSyx1QkFBdUI7QUFFcEUsU0FBaUIseUJBQXlCLEtBQUssVUFBVSxJQUFJLFFBQTRCLENBQUM7QUFDMUYsU0FBZ0Isd0JBQXdCLEtBQUssdUJBQXVCO0FBRXBFLFNBQWlCLCtCQUErQixLQUFLLFVBQVUsSUFBSSxRQUFxQyxDQUFDO0FBQ3pHLFNBQWdCLDhCQUE4QixLQUFLLDZCQUE2QjtBQUVoRixTQUFpQixjQUFjLEtBQUssVUFBVSxJQUFJLFFBQXFDLENBQUM7QUFDeEYsU0FBZ0IsYUFBYSxLQUFLLFlBQVk7QUFFOUMsU0FBaUIseUJBQXlCLElBQUksOEJBQThCO0FBQzVFLFNBQWlCLFlBQVksSUFBSSxxQ0FBcUMsS0FBSyxzQkFBc0I7QUFDakcsU0FBaUIsNEJBQTRCLElBQUksUUFBUTtBQUN6RCxTQUFpQixtQkFBbUIsSUFBSSx1QkFBd0M7QUFDaEYsU0FBaUIsOEJBQThCLG9CQUFJLElBQVk7QUFFL0QsU0FBaUIsc0JBQXNCLElBQUksMEJBQTBCO0FBRXJFLFNBQVEsd0JBQW9ELENBQUM7QUFDN0QsU0FBUSwyQkFBMkI7QUFFbkMsU0FBaUIseUJBQXlCLEtBQUssVUFBVSxJQUFJLHdCQUF3QixDQUFDO0FBRXRGLFNBQVEsMkJBQW1DO0FBMkIxQyxTQUFLLG1CQUFtQixRQUFRO0FBQ2hDLFNBQUsseUNBQXlDLFFBQVE7QUFHdEQsU0FBSyxVQUFVLEtBQUssYUFBYSxpQ0FBaUMsT0FBSztBQUN0RSxVQUFJLEVBQUUsV0FBVyxRQUFRLGNBQWM7QUFDdEMsVUFBRSxLQUFLLEtBQUssZ0JBQWdCLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQUEsTUFDeEQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssb0JBQW9CLElBQUk7QUFBQSxNQUM1QixLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsSUFDTjtBQUVBLFNBQUssVUFBVSxLQUFLLDRCQUE0QixvQkFBb0IsQ0FBQyxlQUFlO0FBQ25GLFlBQU0sUUFBc0IsQ0FBQztBQUM3QixZQUFNLFdBQXlCLENBQUM7QUFDaEMsaUJBQVcsYUFBYSxZQUFZO0FBQ25DLFlBQUksS0FBSyxxQkFBcUIsU0FBUyxHQUFHO0FBRXpDLGdCQUFNLEtBQUssU0FBUztBQUFBLFFBQ3JCLE9BQU87QUFFTixtQkFBUyxLQUFLLFNBQVM7QUFBQSxRQUN4QjtBQUFBLE1BQ0Q7QUFDQSxVQUFJLE1BQU07QUFDVCxhQUFLLFlBQVksS0FBSywwREFBMEQsV0FBVyxJQUFJLE9BQUssRUFBRSxXQUFXLEVBQUUsRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQUEsTUFDbEk7QUFDQSxXQUFLLHVCQUF1QixJQUFJLHlCQUF5QixPQUFPLFFBQVEsQ0FBQztBQUFBLElBQzFFLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLDRCQUE0QixtQkFBbUIsQ0FBQyxFQUFFLE9BQU8sUUFBUSxNQUFNO0FBQzFGLFVBQUksTUFBTSxVQUFVLFFBQVEsUUFBUTtBQUNuQyxZQUFJLE1BQU07QUFDVCxlQUFLLFlBQVksS0FBSyxtREFBbUQ7QUFBQSxRQUMxRTtBQUNBLGFBQUssdUJBQXVCLElBQUkseUJBQXlCLE9BQU8sT0FBTyxDQUFDO0FBQUEsTUFDekU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLDRCQUE0QixzQkFBc0IsZ0JBQWM7QUFDbkYsVUFBSSxXQUFXLFFBQVE7QUFDdEIsWUFBSSxNQUFNO0FBQ1QsZUFBSyxZQUFZLEtBQUssc0RBQXNEO0FBQUEsUUFDN0U7QUFDQSxhQUFLLHVCQUF1QixJQUFJLHlCQUF5QixZQUFZLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDekU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLDRCQUE0Qix1QkFBdUIsQ0FBQyxXQUFXO0FBQ2xGLFlBQU0sYUFBMkIsQ0FBQztBQUNsQyxpQkFBVyxFQUFFLE9BQU8sVUFBVSxLQUFLLFFBQVE7QUFDMUMsWUFBSSxTQUFTLE1BQU0sV0FBVyxjQUFjLGlCQUFpQixXQUFXLEtBQUsscUJBQXFCLEtBQUssR0FBRztBQUN6RyxxQkFBVyxLQUFLLEtBQUs7QUFBQSxRQUN0QjtBQUFBLE1BQ0Q7QUFDQSxVQUFJLFdBQVcsUUFBUTtBQUN0QixZQUFJLE1BQU07QUFDVCxlQUFLLFlBQVksS0FBSyw2REFBNkQsV0FBVyxJQUFJLE9BQUssRUFBRSxXQUFXLEVBQUUsRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQUEsUUFDckk7QUFDQSxhQUFLLHVCQUF1QixJQUFJLHlCQUF5QixZQUFZLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDekU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLDRCQUE0Qix3QkFBd0IsQ0FBQyxVQUFVO0FBQ2xGLFVBQUksQ0FBQyxNQUFNLE9BQU87QUFFakIsWUFBSSxNQUFNO0FBQ1QsZUFBSyxZQUFZLEtBQUssOERBQThELE1BQU0sV0FBVyxFQUFFLEVBQUU7QUFBQSxRQUMxRztBQUNBLGFBQUssdUJBQXVCLElBQUkseUJBQXlCLENBQUMsR0FBRyxDQUFDLE1BQU0sV0FBVyxFQUFFLENBQUMsQ0FBQztBQUFBLE1BQ3BGO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxrQkFBa0IsZUFBZSxXQUFTO0FBQzdELFVBQUksS0FBSyxvQkFBb0IsY0FBYyxHQUFHO0FBQzdDLGNBQU0sS0FBSyxZQUFZO0FBSXRCLGNBQUk7QUFDSCxrQkFBTSxLQUFLLG9CQUFvQixjQUFjO0FBQzdDLGtCQUFNLEtBQUssc0JBQXNCO0FBQ2pDLGlCQUFLLG9CQUFvQixjQUFjLEdBQUcsUUFBUTtBQUFBLFVBQ25ELFFBQVE7QUFDUCxpQkFBSyxZQUFZLEtBQUssd0NBQXdDO0FBQUEsVUFDL0Q7QUFBQSxRQUNELEdBQUc7QUFBQSxVQUNGLElBQUk7QUFBQSxVQUNKLE9BQU8sSUFBSSxTQUFTLG9CQUFvQix5QkFBeUI7QUFBQSxVQUNqRSxPQUFPLHdCQUF3QjtBQUFBO0FBQUEsUUFDaEMsQ0FBQztBQUFBLE1BQ0YsT0FBTztBQUNOLGNBQU0sS0FBSyxLQUFLLHNCQUFzQixHQUFHO0FBQUEsVUFDeEMsSUFBSTtBQUFBLFVBQ0osT0FBTyxJQUFJLFNBQVMsc0JBQXNCLDBCQUEwQjtBQUFBLFFBQ3JFLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFVSwwQkFBMEIsTUFBa0Q7QUFDckYsV0FBTyxLQUFLLHVCQUF1QixVQUFVLElBQUk7QUFBQSxFQUNsRDtBQUFBO0FBQUEsRUFJQSxNQUFjLHVCQUF1QixNQUErQztBQUNuRixTQUFLLHNCQUFzQixLQUFLLElBQUk7QUFDcEMsUUFBSSxLQUFLLDBCQUEwQjtBQUVsQztBQUFBLElBQ0Q7QUFFQSxRQUFJLE9BQWdEO0FBQ3BELFFBQUk7QUFDSCxXQUFLLDJCQUEyQjtBQUdoQyxZQUFNLEtBQUssMEJBQTBCLEtBQUs7QUFFMUMsYUFBTyxNQUFNLEtBQUssVUFBVSxZQUFZLHVCQUF1QjtBQUMvRCxhQUFPLEtBQUssc0JBQXNCLFNBQVMsR0FBRztBQUM3QyxjQUFNQSxRQUFPLEtBQUssc0JBQXNCLE1BQU07QUFDOUMsY0FBTSxLQUFLLGlCQUFpQixNQUFNQSxNQUFLLE9BQU9BLE1BQUssUUFBUTtBQUFBLE1BQzVEO0FBQUEsSUFDRCxVQUFFO0FBQ0QsV0FBSywyQkFBMkI7QUFDaEMsWUFBTSxRQUFRO0FBQUEsSUFDZjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsaUJBQWlCLE1BQXdDLFFBQXNCLFdBQW1EO0FBQy9JLFFBQUksTUFBTTtBQUNULFdBQUssWUFBWSxLQUFLLHNEQUFzRCxPQUFPLElBQUksT0FBSyxFQUFFLFdBQVcsRUFBRSxFQUFFLEtBQUssR0FBRyxDQUFDLGdCQUFnQixVQUFVLElBQUksT0FBSyxPQUFPLE1BQU0sV0FBVyxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUUsS0FBSyxHQUFHLENBQUMsR0FBRztBQUFBLElBQ25OO0FBQ0EsUUFBSSxXQUFvQyxDQUFDO0FBQ3pDLGFBQVMsSUFBSSxHQUFHLE1BQU0sVUFBVSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3JELFlBQU0sZ0JBQWdCLFVBQVUsQ0FBQztBQUNqQyxZQUFNLGNBQWUsT0FBTyxrQkFBa0IsV0FBVyxnQkFBZ0IsY0FBYyxXQUFXO0FBQ2xHLFlBQU0sWUFBYSxPQUFPLGtCQUFrQixXQUFXLE9BQU87QUFDOUQsWUFBTSx1QkFBdUIsS0FBSyxVQUFVLHdCQUF3QixXQUFXO0FBQy9FLFVBQUksQ0FBQyxzQkFBc0I7QUFFMUI7QUFBQSxNQUNEO0FBRUEsVUFBSSxhQUFhLHFCQUFxQixrQkFBa0IsV0FBVyxVQUFVLFNBQVMsUUFBUTtBQUU3RjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsS0FBSyxtQkFBbUIsb0JBQW9CLEdBQUc7QUFFbkQ7QUFBQSxNQUNEO0FBRUEsZUFBUyxLQUFLLG9CQUFvQjtBQUFBLElBQ25DO0FBRUEsVUFBTSxRQUFpQyxDQUFDO0FBQ3hDLGFBQVMsSUFBSSxHQUFHLE1BQU0sT0FBTyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ2xELFlBQU0sWUFBWSxPQUFPLENBQUM7QUFFMUIsWUFBTSx1QkFBdUIsdUJBQXVCLFdBQVcsS0FBSztBQUNwRSxVQUFJLENBQUMsc0JBQXNCO0FBRTFCO0FBQUEsTUFDRDtBQUVBLFVBQUksQ0FBQyxLQUFLLGlCQUFpQixzQkFBc0IsUUFBUSxHQUFHO0FBQzNEO0FBQUEsTUFDRDtBQUVBLFlBQU0sS0FBSyxvQkFBb0I7QUFBQSxJQUNoQztBQUVBLFFBQUksTUFBTSxXQUFXLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEQ7QUFBQSxJQUNEO0FBR0EsVUFBTSxTQUFTLEtBQUssVUFBVSxnQkFBZ0IsTUFBTSxPQUFPLFNBQVMsSUFBSSxPQUFLLEVBQUUsVUFBVSxDQUFDO0FBQzFGLFNBQUssdUJBQXVCLEtBQUssRUFBRSxPQUFPLE9BQU8sU0FBUyxTQUFTLENBQUM7QUFFcEUsZUFBVyxTQUFTLE9BQU8sT0FBTyxtQkFBbUI7QUFDckQsUUFBSSxPQUFPLG9CQUFvQixTQUFTLEdBQUc7QUFDMUMsV0FBSyxxQkFBcUIsT0FBTztBQUFBLFFBQ2hDLFVBQVUsU0FBUztBQUFBLFFBQ25CLFNBQVMsSUFBSSxTQUFTLFdBQVcsaUZBQWlGLE9BQU8sb0JBQW9CLElBQUksT0FBSyxJQUFJLEVBQUUsV0FBVyxLQUFLLEdBQUcsRUFBRSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzVMLENBQUM7QUFBQSxJQUNGO0FBR0EsU0FBSyx1QkFBdUIsMEJBQTBCLEtBQUs7QUFHM0QsU0FBSyx5QkFBbUQsQ0FBQyxFQUFHLE9BQU8sS0FBSyxFQUFFLE9BQU8sUUFBUSxHQUFHLEtBQUs7QUFHakcsVUFBTSxLQUFLLDRCQUE0QixPQUFPLFdBQVcsT0FBTyxTQUFTLElBQUksT0FBSyxFQUFFLFVBQVUsQ0FBQztBQUUvRixhQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLFdBQUssZ0NBQWdDLE1BQU0sQ0FBQyxDQUFDO0FBQUEsSUFDOUM7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLDRCQUE0QixXQUFtQixPQUFnQyxVQUFnRDtBQUM1SSxVQUFNLHlCQUF5QixLQUFLLGtCQUFrQixnQkFBZ0IsT0FBTyxRQUFRO0FBQ3JGLFVBQU0sV0FBVyxLQUFLLHVCQUF1QjtBQUFBLE1BQzVDLG9CQUFrQixLQUFLLDJCQUEyQixnQkFBZ0IsV0FBVyxPQUFPLFVBQVUsc0JBQXNCO0FBQUEsSUFDckg7QUFDQSxVQUFNLFFBQVEsSUFBSSxRQUFRO0FBQUEsRUFDM0I7QUFBQSxFQUVBLE1BQWMsMkJBQTJCLHNCQUE2QyxXQUFtQixPQUFnQyxVQUFpQyx3QkFBZ0c7QUFDelEsVUFBTSxVQUFVLEtBQUssa0JBQWtCLDZCQUE2QixPQUFPLG9CQUFvQjtBQUMvRixVQUFNLGFBQWEsMkJBQTJCLFVBQVUsd0JBQXdCLHdCQUFzQixxQkFBcUIsMEJBQTBCLGtCQUFrQixDQUFDO0FBQ3hLLFVBQU0sc0JBQXNCLHlCQUF5QiwwQkFBMEIsS0FBSztBQUNwRixRQUFJLE1BQU07QUFDVCxZQUFNLGNBQWMsQ0FBQyxlQUF3QyxXQUFXLElBQUksT0FBSyxFQUFFLFdBQVcsS0FBSyxFQUFFLEtBQUssR0FBRztBQUM3RyxZQUFNLFdBQVcsQ0FBQyxlQUFzQyxXQUFXLElBQUksT0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEdBQUc7QUFDN0YsV0FBSyxZQUFZLEtBQUssaUVBQWlFLFNBQVMsUUFBUSxDQUFDLGNBQWMsWUFBWSxLQUFLLENBQUMsbUJBQW1CLFNBQVMsVUFBVSxDQUFDLGdCQUFnQixZQUFZLE9BQU8sQ0FBQyxJQUFJO0FBQUEsSUFDek47QUFDQSxVQUFNLHFCQUFxQixnQkFBZ0IsRUFBRSxXQUFXLFVBQVUsT0FBTyxxQkFBcUIsWUFBWSxTQUFTLFFBQVEsSUFBSSxlQUFhLFVBQVUsVUFBVSxFQUFFLENBQUM7QUFBQSxFQUNwSztBQUFBLEVBRU8sZ0JBQWdCLFdBQTJDO0FBQ2pFLFdBQU8sS0FBSyxpQkFBaUIsV0FBVyxDQUFDLENBQUM7QUFBQSxFQUMzQztBQUFBLEVBRVEsaUJBQWlCLFdBQWtDLHdCQUEwRDtBQUVwSCxVQUFNLFdBQVcsS0FBSyxVQUFVLGtDQUFrQyxVQUFVLFlBQVksVUFBVSxFQUFFO0FBQ3BHLFFBQUksVUFBVTtBQUdiLFlBQU0saUJBQWlCLHVCQUF1QixLQUFLLENBQUMseUJBQXlCLG9CQUFvQixPQUFPLFVBQVUsWUFBWSxxQkFBcUIsVUFBVSxDQUFDO0FBQzlKLFVBQUksQ0FBQyxnQkFBZ0I7QUFDcEIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsVUFBTSxpQkFBaUIsS0FBSyxrQkFBa0IsbUJBQW1CLFNBQVM7QUFDMUUsVUFBTSxXQUFXLFVBQVUsa0JBQWtCLFdBQVcsUUFBUTtBQUNoRSxVQUFNLG9CQUFvQixLQUFLLHlCQUF5QixzQkFBc0IsVUFBVSxZQUFZLGdCQUFnQixDQUFDLFVBQVUsVUFBVSwyQkFBMkIsSUFBSTtBQUN4SyxRQUFJLHNCQUFzQixNQUFNO0FBQy9CLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLG1CQUFtQixXQUEyQztBQUNwRSxVQUFNLHVCQUF1QixLQUFLLFVBQVUsd0JBQXdCLFVBQVUsVUFBVTtBQUN4RixRQUFJLENBQUMsc0JBQXNCO0FBRTFCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxLQUFLLGlCQUFpQixJQUFJLHFCQUFxQixVQUFVLEdBQUcsbUJBQW1CO0FBRWxGLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsZ0NBQWdDLHNCQUE0RDtBQUN6RyxRQUFJLGlCQUFpQjtBQUNyQixRQUFJLHVCQUFzQztBQUMxQyxRQUFJLHVCQUF1QjtBQUMzQixVQUFNLG1CQUFtQixLQUFLLHVCQUF1QixxQkFBcUIsb0JBQW9CO0FBQzlGLGVBQVcsbUJBQW1CLGtCQUFrQjtBQUMvQyxVQUFJLEtBQUssNEJBQTRCLElBQUksZUFBZSxHQUFHO0FBRTFELHlCQUFpQjtBQUNqQiwrQkFBdUI7QUFDdkI7QUFBQSxNQUNEO0FBRUEsVUFBSSxvQkFBb0IsS0FBSztBQUM1Qix5QkFBaUI7QUFDakIsK0JBQXVCO0FBQ3ZCO0FBQUEsTUFDRDtBQUVBLFVBQUkscUJBQXFCLEtBQUssZUFBZSxHQUFHO0FBQy9DLCtCQUF1QjtBQUFBLE1BQ3hCO0FBRUEsVUFBSSxvQkFBb0IscUJBQXFCO0FBQzVDLHlCQUFpQjtBQUNqQiwrQkFBdUI7QUFDdkI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksZ0JBQWdCO0FBQ25CLFlBQU0sUUFBUTtBQUFBLFFBQ2IsS0FBSyx1QkFBdUIsSUFBSSxvQkFBa0IsZUFBZSxTQUFTLHFCQUFxQixZQUFZLEVBQUUsU0FBUyxPQUFPLGFBQWEscUJBQXFCLFlBQVksaUJBQWlCLHFCQUFzQixDQUFDLENBQUM7QUFBQSxNQUNyTixFQUFFLEtBQUssTUFBTTtBQUFBLE1BQUUsQ0FBQztBQUFBLElBQ2pCLFdBQVcsc0JBQXNCO0FBQ2hDLFlBQU0sWUFBWSxNQUFNLEtBQUssZ0JBQWdCLHFCQUFxQjtBQUNsRSxZQUFNLG1CQUFtQixDQUFDLENBQUMsS0FBSyxvQkFBb0I7QUFDcEQsWUFBTSxPQUF5QztBQUFBLFFBQzlDLFlBQVksS0FBSztBQUFBLFFBQ2pCLFNBQVMsVUFBVSxRQUFRLElBQUksWUFBVSxPQUFPLEdBQUc7QUFBQSxRQUNuRDtBQUFBLFFBQ0EsUUFBUSxDQUFDLFFBQVEsS0FBSyxhQUFhLE9BQU8sR0FBRztBQUFBLFFBQzdDLGFBQWEsQ0FBQyxTQUFTQyxXQUFVLFVBQVUsS0FBSyxzQkFBc0IsZUFBZSxDQUFDLGFBQWEsb0JBQW9CLFVBQVUsU0FBU0EsV0FBVSxLQUFLLENBQUM7QUFBQSxNQUMzSjtBQUVBLFlBQU0sU0FBUyxNQUFNLHdDQUF3QyxNQUFNLG9CQUFvQjtBQUN2RixVQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsTUFDRDtBQUVBLFlBQU0sUUFBUTtBQUFBLFFBQ2IsS0FBSyx1QkFBdUIsSUFBSSxvQkFBa0IsZUFBZSxTQUFTLHFCQUFxQixZQUFZLEVBQUUsU0FBUyxPQUFPLGFBQWEscUJBQXFCLFlBQVksaUJBQWlCLE9BQU8sZ0JBQWdCLENBQUMsQ0FBQztBQUFBLE1BQ3ROLEVBQUUsS0FBSyxNQUFNO0FBQUEsTUFBRSxDQUFDO0FBQUEsSUFDakI7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLE1BQWdCLGNBQTZCO0FBQzVDLFNBQUssS0FBSyx5QkFBeUI7QUFDbkMsU0FBSyxnQ0FBZ0MsTUFBTSxDQUFDLENBQUM7QUFFN0MsVUFBTSxPQUFPLE1BQU0sS0FBSyxVQUFVLFlBQVksYUFBYTtBQUMzRCxRQUFJO0FBQ0gsWUFBTSxLQUFLLDZCQUE2QixJQUFJO0FBRTVDLFlBQU0sV0FBVyxLQUFLLFVBQVUsWUFBWTtBQUM1QyxpQkFBVyxrQkFBa0IsS0FBSyx3QkFBd0I7QUFDekQsWUFBSSxlQUFlLFlBQVkscUJBQXFCLGdCQUFnQjtBQUNuRSxnQkFBTSxhQUFhLEtBQUssa0JBQWtCLDZCQUE2QixTQUFTLFlBQVksY0FBYztBQUMxRyx5QkFBZSxNQUFNLFNBQVMsV0FBVyxTQUFTLFlBQVksV0FBVyxJQUFJLGVBQWEsVUFBVSxVQUFVLENBQUM7QUFBQSxRQUNoSDtBQUFBLE1BQ0Q7QUFBQSxJQUNELFVBQUU7QUFDRCxXQUFLLFFBQVE7QUFBQSxJQUNkO0FBRUEsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyxLQUFLLHdCQUF3QjtBQUNsQyxVQUFNLEtBQUssc0JBQXNCO0FBQUEsRUFDbEM7QUFBQSxFQUVBLE1BQWMsNkJBQTZCLE1BQXdEO0FBQ2xHLFFBQUkscUJBQThDLENBQUM7QUFDbkQsUUFBSSxrQkFBMkMsQ0FBQztBQUNoRCxRQUFJLG1CQUE0QyxDQUFDO0FBRWpELHFCQUFpQixjQUFjLEtBQUssbUJBQW1CLEdBQUc7QUFDekQsVUFBSSxzQkFBc0Isb0JBQW9CO0FBQzdDLDZCQUFxQiwyQkFBMkIsS0FBSyxhQUFhLEtBQUssNkJBQTZCLEtBQUssd0JBQXdCLFdBQVcsWUFBWSxLQUFLO0FBQzdKLGFBQUssVUFBVSxnQkFBZ0IsTUFBTSxvQkFBb0IsQ0FBQyxDQUFDO0FBQzNELGFBQUsseUJBQXlCLG9CQUFvQixJQUFJO0FBQUEsTUFDdkQ7QUFDQSxVQUFJLHNCQUFzQixpQkFBaUI7QUFDMUMsMEJBQWtCLDJCQUEyQixLQUFLLGFBQWEsS0FBSyw2QkFBNkIsS0FBSyx3QkFBd0IsV0FBVyxZQUFZLEtBQUs7QUFBQSxNQUMzSjtBQUNBLFVBQUksc0JBQXNCLGtCQUFrQjtBQUMzQywyQkFBbUIsMkJBQTJCLEtBQUssYUFBYSxLQUFLLDZCQUE2QixLQUFLLHdCQUF3QixXQUFXLFlBQVksS0FBSztBQUFBLE1BQzVKO0FBQUEsSUFDRDtBQUlBLFNBQUssa0JBQWtCLDBCQUEwQixpQkFBaUIsZ0JBQWdCO0FBRWxGLFNBQUssZ0NBQWdDLE1BQU0sQ0FBQyxDQUFDO0FBRzdDLFVBQU0sdUNBQXdDLEtBQUsseUNBQXlDLEtBQUssa0JBQWtCLDBCQUEwQixrQkFBa0Isa0JBQWtCLGNBQWMsSUFBSSxDQUFDO0FBQ3BNLFVBQU0seUJBQTBCLEtBQUssbUJBQW1CLEtBQUssa0JBQWtCLDBCQUEwQixpQkFBaUIsa0JBQWtCLFlBQVksSUFBSSxDQUFDO0FBQzdKLFVBQU0sMkJBQTJCLEtBQUssa0JBQWtCLDBCQUEwQixpQkFBaUIsa0JBQWtCLGNBQWM7QUFDbkksdUJBQW1CLEtBQUssa0JBQWtCLDBCQUEwQixrQkFBa0Isa0JBQWtCLE1BQU07QUFHOUcsZUFBVyxPQUFPLHNDQUFzQztBQUN2RCxVQUFJLENBQUMsU0FBUywwQkFBMEIsSUFBSSxVQUFVLEdBQUc7QUFDeEQsaUNBQXlCLEtBQUssR0FBRztBQUFBLE1BQ2xDO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLGlCQUFpQixPQUFPLHNCQUFzQixFQUFFLE9BQU8sd0JBQXdCO0FBQ3JHLFFBQUksUUFBUTtBQUVaLFFBQUksbUJBQW1CLFFBQVE7QUFFOUIsY0FBUSxjQUFjLE9BQU8sZUFBYSxDQUFDLG1CQUFtQixLQUFLLE9BQUssb0JBQW9CLE9BQU8sRUFBRSxZQUFZLFVBQVUsVUFBVSxLQUFLLEVBQUUsa0JBQWtCLFNBQVMsTUFBTSxVQUFVLGtCQUFrQixTQUFTLENBQUMsQ0FBQztBQUVwTixVQUFJLGNBQWMsU0FBUyxNQUFNLFNBQVMsbUJBQW1CLFFBQVE7QUFDcEUsY0FBTSxXQUFXLG1CQUFtQixPQUFPLGdCQUFjLENBQUMsY0FBYyxLQUFLLE9BQUssb0JBQW9CLE9BQU8sRUFBRSxZQUFZLFdBQVcsVUFBVSxLQUFLLEVBQUUsa0JBQWtCLFNBQVMsTUFBTSxXQUFXLGtCQUFrQixTQUFTLENBQUMsQ0FBQztBQUNoTyxZQUFJLFNBQVMsUUFBUTtBQUNwQixlQUFLLFVBQVUsZ0JBQWdCLE1BQU0sQ0FBQyxHQUFHLFNBQVMsSUFBSSxPQUFLLEVBQUUsVUFBVSxDQUFDO0FBQ3hFLGVBQUsseUJBQXlCLFVBQVUsSUFBSTtBQUFBLFFBQzdDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsS0FBSyxVQUFVLGdCQUFnQixNQUFNLE9BQU8sQ0FBQyxDQUFDO0FBQzdELFFBQUksT0FBTyxvQkFBb0IsU0FBUyxHQUFHO0FBQzFDLFdBQUsscUJBQXFCLE9BQU87QUFBQSxRQUNoQyxVQUFVLFNBQVM7QUFBQSxRQUNuQixTQUFTLElBQUksU0FBUyxXQUFXLGlGQUFpRixPQUFPLG9CQUFvQixJQUFJLE9BQUssSUFBSSxFQUFFLFdBQVcsS0FBSyxHQUFHLEVBQUUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUM1TCxDQUFDO0FBQUEsSUFDRjtBQUVBLFNBQUsseUJBQXlCLEtBQUssVUFBVSw0QkFBNEIsR0FBRyxLQUFLO0FBQUEsRUFDbEY7QUFBQSxFQUVBLE1BQWMsd0JBQXVDO0FBQ3BELFFBQUksQ0FBQyxLQUFLLG9CQUFvQiwwQkFBMEIsQ0FBQyxLQUFLLG9CQUFvQiwyQkFBMkI7QUFDNUc7QUFBQSxJQUNEO0FBRUEsVUFBTSx1QkFBdUIsS0FBSyxzQkFBc0IsS0FBSyxvQkFBb0IseUJBQXlCO0FBQzFHLFFBQUksQ0FBQyxzQkFBc0I7QUFDMUIsWUFBTSxNQUFNLElBQUksU0FBUyxzQkFBc0IsbUVBQW1FLEtBQUssb0JBQW9CLDBCQUEwQixTQUFTLENBQUM7QUFDL0ssY0FBUSxNQUFNLEdBQUc7QUFDakIsV0FBSyxxQkFBcUIsTUFBTSxHQUFHO0FBQ25DO0FBQUEsSUFDRDtBQUdBLFFBQUk7QUFDSixRQUFJO0FBQ0gsaUJBQVcsTUFBTSxxQkFBcUIsc0JBQXNCO0FBQzVELFVBQUksTUFBTTtBQUNULGFBQUssWUFBWSxLQUFLLHlDQUF5QyxRQUFRLEVBQUU7QUFBQSxNQUMxRTtBQUFBLElBQ0QsU0FBUyxLQUFLO0FBQ2IsVUFBSSxNQUFNO0FBQ1QsYUFBSyxZQUFZLE1BQU0sb0NBQW9DLEdBQUc7QUFBQSxNQUMvRDtBQUNBLGNBQVEsTUFBTSxHQUFHO0FBQ2pCLGlCQUFXO0FBQUEsSUFDWjtBQUVBLFNBQUsscUJBQXFCLFFBQVE7QUFBQSxFQUNuQztBQUFBLEVBRVEsc0JBQXNCLGNBQWlEO0FBQzlFLFFBQUksa0JBQW1EO0FBRXZELGVBQVcsYUFBYSxLQUFLLFVBQVUsNEJBQTRCLEdBQUc7QUFDckUsVUFBSSxnQkFBZ0IsY0FBYyxVQUFVLGlCQUFpQixHQUFHO0FBQy9ELDBCQUFrQixLQUFLLGtCQUFrQixtQkFBbUIsVUFBVSxVQUFVO0FBQ2hGO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxRQUFJLG9CQUFvQixNQUFNO0FBRzdCLFVBQUksYUFBYSxXQUFXLFFBQVEsY0FBYztBQUNqRCwwQkFBa0IsSUFBSSxzQkFBc0I7QUFBQSxNQUM3QyxPQUFPO0FBSU4sMEJBQWtCLElBQUksNEJBQTRCLENBQUM7QUFBQSxNQUNwRDtBQUFBLElBQ0Q7QUFDQSxRQUFJLG9CQUFvQixNQUFNO0FBQzdCLGFBQU8sS0FBSyx1QkFBdUIscUJBQXFCLGVBQWU7QUFBQSxJQUN4RTtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxrQkFBd0I7QUFDL0IsU0FBSywwQkFBMEIsS0FBSztBQUNwQyxTQUFLLHlCQUF5QixLQUFLLE1BQVM7QUFDNUMsU0FBSyw2QkFBNkIsS0FBSyxLQUFLLFVBQVUsNEJBQTRCLEVBQUUsSUFBSSxPQUFLLEVBQUUsVUFBVSxDQUFDO0FBQUEsRUFDM0c7QUFBQTtBQUFBLEVBSUEsTUFBZ0IseUJBQXlCLGlCQUFrRDtBQUMxRixVQUFNLGVBQWU7QUFFckIsYUFBUyxVQUFVLEtBQUssV0FBVztBQUNsQyxVQUFJO0FBQ0gsZUFBTyxLQUFLLDZCQUE2QixlQUFlO0FBQUEsTUFDekQsU0FBUyxLQUFLO0FBQ2IsWUFBSSw2QkFBNkIsa0JBQWtCLEdBQUcsR0FBRztBQUV4RCxnQkFBTTtBQUFBLFFBQ1A7QUFFQSxZQUFJLDZCQUE2QixlQUFlLEdBQUcsR0FBRztBQUVyRCxnQkFBTTtBQUFBLFFBQ1A7QUFFQSxZQUFJLFdBQVcsY0FBYztBQUU1QixnQkFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWdCLHlCQUF3QztBQUN2RCxVQUFNLGtCQUFrQixLQUFLLG9CQUFvQjtBQUNqRCxRQUFJLENBQUMsaUJBQWlCO0FBQ3JCO0FBQUEsSUFDRDtBQUVBLFNBQUssZ0NBQWdDLHdCQUF3QixlQUFlO0FBQzVFLFFBQUk7QUFDSCxZQUFNLFNBQVMsTUFBTSxLQUFLLDZCQUE2QixlQUFlO0FBQ3RFLFdBQUssZ0NBQWdDLHNCQUFzQixPQUFPLFdBQVcsT0FBTyxPQUFPO0FBQUEsSUFDNUYsU0FBUyxLQUFLO0FBQ2IsV0FBSyxnQ0FBZ0MsMkJBQTJCLGlCQUFpQixHQUFHO0FBQUEsSUFDckY7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLDZCQUE2QixpQkFBa0Q7QUFDNUYsVUFBTSxrQkFBa0IseUJBQXlCLGVBQWU7QUFDaEUsVUFBTSxLQUFLLFVBQVUsT0FBTyxLQUFLO0FBQ2pDLFNBQUssWUFBWSxLQUFLLDZCQUE2QixlQUFlLE1BQU07QUFDeEUsUUFBSTtBQUNILFdBQUssS0FBSyw2QkFBNkIsZUFBZSxFQUFFO0FBQ3hELFlBQU0sU0FBUyxNQUFNLEtBQUssa0JBQWtCLGVBQWU7QUFDM0QsV0FBSyxLQUFLLDhCQUE4QixlQUFlLEVBQUU7QUFDekQsV0FBSyxZQUFZLEtBQUssb0JBQW9CLGVBQWUsZUFBZSxPQUFPLFVBQVUsU0FBUyxXQUFXLEdBQUcsUUFBUSxDQUFDLEtBQUs7QUFDOUgsYUFBTztBQUFBLElBQ1IsU0FBUyxLQUFLO0FBQ2IsV0FBSyxLQUFLLGlDQUFpQyxlQUFlLEVBQUU7QUFDNUQsV0FBSyxZQUFZLE1BQU0sb0JBQW9CLGVBQWUsNkJBQTZCLEdBQUcsUUFBUSxDQUFDLE9BQU8sR0FBRztBQUM3RyxZQUFNO0FBQUEsSUFDUDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWdCLGtDQUFrQyxNQUF5QixpQkFBa0Q7QUFFNUgsVUFBTSxpQkFBaUIsS0FBSywwQkFBMEIsSUFBSTtBQUMxRCxRQUFJLGVBQWUsV0FBVyxHQUFHO0FBRWhDLFlBQU0sSUFBSSxNQUFNLDBCQUEwQjtBQUFBLElBQzNDO0FBRUEsU0FBSztBQUNMLFVBQU0sVUFBVSxNQUFNLFFBQVEsSUFBSSxlQUFlLElBQUksYUFBVyxRQUFRLGlCQUFpQixpQkFBaUIsS0FBSyx3QkFBd0IsQ0FBQyxDQUFDO0FBRXpJLFFBQUksa0JBQXVEO0FBQzNELGVBQVcsVUFBVSxTQUFTO0FBQzdCLFVBQUksT0FBTyxTQUFTLE1BQU07QUFDekIsZUFBTyxPQUFPO0FBQUEsTUFDZjtBQUNBLFVBQUksQ0FBQyxpQkFBaUI7QUFDckIsMEJBQWtCO0FBQ2xCO0FBQUEsTUFDRDtBQUNBLFlBQU0scUJBQXNCLGdCQUFnQixNQUFNLFNBQVMsaUNBQWlDO0FBQzVGLFlBQU0saUJBQWtCLE9BQU8sTUFBTSxTQUFTLGlDQUFpQztBQUMvRSxVQUFJLHNCQUFzQixDQUFDLGdCQUFnQjtBQUMxQywwQkFBa0I7QUFBQSxNQUNuQjtBQUFBLElBQ0Q7QUFHQSxVQUFNLElBQUksNkJBQTZCLGdCQUFpQixNQUFNLFNBQVMsZ0JBQWlCLE1BQU0sTUFBTSxnQkFBaUIsTUFBTSxNQUFNO0FBQUEsRUFDbEk7QUFBQTtBQUFBO0FBQUEsRUFNTyxtQkFBbUIsUUFBZ0IsTUFBa0M7QUFDM0UsV0FBTyxLQUFLLDhCQUE4QixRQUFRLElBQUk7QUFBQSxFQUN2RDtBQUFBLEVBRUEsTUFBZ0Isd0JBQXVDO0FBQ3RELFVBQU0sa0NBQXlELENBQUM7QUFDaEUsZUFBVyxtQkFBbUIsS0FBSyxpQkFBaUIsT0FBTyxHQUFHO0FBQzdELFVBQUksZ0JBQWdCLG1CQUFtQjtBQUN0Qyx3Q0FBZ0MsS0FBSyxnQkFBZ0IsRUFBRTtBQUFBLE1BQ3hEO0FBQUEsSUFDRDtBQUVBLFVBQU0sS0FBSyx1QkFBdUIsaUJBQWlCO0FBQ25ELGVBQVcsbUJBQW1CLEtBQUssaUJBQWlCLE9BQU8sR0FBRztBQUM3RCxzQkFBZ0IsbUJBQW1CO0FBQUEsSUFDcEM7QUFFQSxRQUFJLGdDQUFnQyxTQUFTLEdBQUc7QUFDL0MsV0FBSyw2QkFBNkIsS0FBSywrQkFBK0I7QUFBQSxJQUN2RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsOEJBQThCLFFBQWdCLE9BQWdCLE9BQXlCO0FBQ3BHLFFBQUksUUFBUSxLQUFLLG9CQUFvQix3QkFBd0I7QUFDNUQsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFFBQXdDLENBQUM7QUFDL0MsVUFBTSxjQUFjLG9CQUFJLElBQVk7QUFFcEMsU0FBSyxZQUFZLEtBQUs7QUFBQSxNQUNyQjtBQUFBLE1BQ0E7QUFBQSxNQUNBLEtBQUssT0FBT0MsU0FBUTtBQUNuQixjQUFNLEtBQUssS0FBSztBQUVoQixZQUFJLE9BQU8sVUFBVSxXQUFXO0FBQy9CLGNBQUksVUFBVSxNQUFNO0FBQ25CLHdCQUFZLElBQUlBLE9BQU07QUFBQSxVQUN2QjtBQUFBLFFBQ0QsT0FBTztBQUNOLGdCQUFNLEtBQUssQ0FBQUMsV0FBUztBQUNuQixnQkFBSUEsUUFBTztBQUNWLDBCQUFZLElBQUlELE9BQU07QUFBQSxZQUN2QjtBQUFBLFVBQ0QsQ0FBQyxFQUFFLE1BQU0sV0FBUztBQUNqQix3QkFBWSxJQUFJLElBQUksU0FBUywwQkFBMEIsb0JBQW9CQSxTQUFRLGVBQWUsS0FBSyxDQUFDLENBQUM7QUFBQSxVQUMxRyxDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLE9BQU8sTUFBTSxZQUFZLE9BQU8sV0FBUyxLQUFLLFlBQVksTUFBTSxLQUFLLENBQUM7QUFDNUUsUUFBSSxDQUFDLE1BQU07QUFDVixZQUFNLEtBQUssc0JBQXNCO0FBQUEsSUFDbEMsT0FBTztBQUNOLFVBQUksQ0FBQyxNQUFNO0FBQ1YsY0FBTSxtQkFBbUIsTUFBTSxLQUFLLFdBQVc7QUFFL0MsYUFBSyxZQUFZLEtBQUssZ0VBQWdFLE1BQU0sa0JBQWtCLGlCQUFpQixLQUFLLElBQUksQ0FBQyxHQUFHO0FBRTVJLGNBQU0sRUFBRSxVQUFVLElBQUksTUFBTSxLQUFLLGVBQWUsUUFBUTtBQUFBLFVBQ3ZELE1BQU0sU0FBUztBQUFBLFVBQ2YsU0FBUyxJQUFJLFNBQVMsNEJBQTRCLHVDQUF1QztBQUFBLFVBQ3pGLFFBQVEsaUJBQWlCLFdBQVcsSUFDbkMsaUJBQWlCLENBQUMsSUFDbEIsaUJBQWlCLEtBQUssTUFBTTtBQUFBLFVBQzdCLGVBQWUsSUFBSSxTQUFTLGtCQUFrQixnQkFBZ0I7QUFBQSxRQUMvRCxDQUFDO0FBRUQsWUFBSSxXQUFXO0FBQ2QsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBRUQ7QUFFQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFUSxnQ0FBZ0MsZ0JBQXlCLHlCQUF5QztBQUN6RyxVQUFNLFlBQXdDLENBQUM7QUFDL0MsYUFBUyxXQUFXLEdBQUcsWUFBWSxLQUFLLGtCQUFrQix5QkFBeUIsWUFBWTtBQUM5RixnQkFBVSxLQUFLLElBQUksNEJBQTRCLFFBQVEsQ0FBQztBQUFBLElBQ3pEO0FBQ0EsYUFBUyxXQUFXLEdBQUcsWUFBWSxLQUFLLGtCQUFrQiwyQkFBMkIsWUFBWTtBQUNoRyxnQkFBVSxLQUFLLElBQUksOEJBQThCLFFBQVEsQ0FBQztBQUFBLElBQzNEO0FBQ0EsY0FBVSxLQUFLLElBQUksc0JBQXNCLENBQUM7QUFDMUMsZUFBVyxZQUFZLFdBQVc7QUFDakMsVUFBSSxLQUFLLHVCQUF1QixxQkFBcUIsUUFBUSxHQUFHO0FBRS9EO0FBQUEsTUFDRDtBQUNBLFlBQU0sTUFBTSxLQUFLLDRCQUE0QixVQUFVLGdCQUFnQix1QkFBdUI7QUFDOUYsVUFBSSxLQUFLO0FBQ1IsY0FBTSxDQUFDLGdCQUFnQixlQUFlLElBQUk7QUFDMUMsYUFBSyx1QkFBdUIsSUFBSSxnQkFBZ0IsZUFBZTtBQUFBLE1BQ2hFO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDRCQUE0QixpQkFBMkMsZ0JBQXlCLHlCQUFvRjtBQUMzTCxVQUFNLGdCQUFnQixLQUFLLHNCQUFzQixvQkFBb0IsS0FBSyxtQkFBbUIsaUJBQWlCLGNBQWM7QUFDNUgsUUFBSSxDQUFDLGVBQWU7QUFDbkIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGlCQUF3QyxLQUFLLDhCQUE4QixlQUFlLHVCQUF1QjtBQUN2SCxVQUFNLGtCQUFrQixJQUFJLGdCQUFnQjtBQUM1QyxvQkFBZ0IsSUFBSSxlQUFlLFVBQVUsQ0FBQyxDQUFDLE1BQU0sTUFBTSxNQUFNLEtBQUssNEJBQTRCLGdCQUFnQixNQUFNLE1BQU0sQ0FBQyxDQUFDO0FBQ2hJLG9CQUFnQixJQUFJLGVBQWUsMkJBQTJCLENBQUMsb0JBQW9CO0FBQ2xGLFdBQUssWUFBWSxLQUFLLG1CQUFtQixlQUFlLFdBQVcsUUFBUSxvQkFBb0IsZ0JBQWdCLGFBQWEsZUFBZSxjQUFjLEdBQUc7QUFDNUosV0FBSyw2QkFBNkIsS0FBSztBQUFBLFFBQ3RDLG1CQUFtQixlQUFlO0FBQUEsUUFDbEMsY0FBYyxvQkFBb0IsZ0JBQWdCO0FBQUEsUUFDbEQsb0JBQW9CLENBQUMsdUJBQWdDO0FBQ3BELGlCQUFPLGVBQWUsZUFBZSxrQkFBa0I7QUFBQSxRQUN4RDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQyxDQUFDO0FBQ0YsV0FBTyxDQUFDLGdCQUFnQixlQUFlO0FBQUEsRUFDeEM7QUFBQSxFQUVVLDhCQUE4QixlQUErQix5QkFBMEQ7QUFDaEksVUFBTSwyQkFBMkIsS0FBSyxvQkFBb0IsYUFBYTtBQUN2RSxRQUFJLGNBQWMsWUFBWSxxQkFBcUIsUUFBUSx3QkFBd0IsV0FBVyxHQUFHO0FBQ2hHLGFBQU8sS0FBSyxzQkFBc0IsZUFBZSxnQ0FBZ0MsZUFBZSx3QkFBd0I7QUFBQSxJQUN6SDtBQUNBLFdBQU8sS0FBSyxzQkFBc0IsZUFBZSxzQkFBc0IsZUFBZSx5QkFBeUIsd0JBQXdCO0FBQUEsRUFDeEk7QUFBQSxFQUVRLDRCQUE0QixlQUFzQyxNQUFjLFFBQTZCO0FBR3BILFVBQU0scUJBQXFCLHlCQUF5QixLQUFLLG1CQUFtQixFQUFFO0FBQzlFLFFBQUksQ0FBQyxvQkFBb0I7QUFDeEIsV0FBSyx3QkFBd0IsZUFBZSxNQUFNLE1BQU07QUFDeEQ7QUFBQSxJQUNEO0FBRUEsU0FBSyxxQkFBcUIsSUFBSTtBQUFBLEVBQy9CO0FBQUEsRUFFVSx3QkFBd0IsZUFBc0MsTUFBYyxRQUE2QjtBQUNsSCxZQUFRLE1BQU0sbUJBQW1CLGNBQWMsV0FBVyxvQ0FBb0MsSUFBSSxhQUFhLE1BQU0sRUFBRTtBQUN2SCxRQUFJLGNBQWMsU0FBUyxrQkFBa0IsY0FBYztBQUMxRCxXQUFLLHNCQUFzQjtBQUFBLElBQzVCLFdBQVcsY0FBYyxTQUFTLGtCQUFrQixRQUFRO0FBQzNELFVBQUksUUFBUTtBQUNYLGFBQUssOEJBQThCLGVBQWUsTUFBTTtBQUFBLE1BQ3pEO0FBQ0EsV0FBSyx1QkFBdUIsUUFBUSxhQUFhO0FBQUEsSUFDbEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxxQ0FBcUMsbUJBQW1FO0FBQy9HLFdBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3ZDLFlBQU0sZ0JBQWdCLFdBQVcsTUFBTTtBQUN0QyxlQUFPLElBQUksTUFBTSxvQ0FBb0MsQ0FBQztBQUFBLE1BQ3ZELEdBQUcsR0FBSTtBQUNQLFdBQUssb0JBQW9CLHlCQUF5QixpQkFBaUIsRUFBRTtBQUFBLFFBQ3BFLENBQUMsTUFBTTtBQUNOLHVCQUFhLGFBQWE7QUFDMUIsa0JBQVEsQ0FBQztBQUFBLFFBQ1Y7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsOEJBQThCLGVBQXNDLG1CQUEwQztBQUMzSCxRQUFJO0FBQ0gsWUFBTSxPQUFPLE1BQU0sS0FBSyxxQ0FBcUMsaUJBQWlCO0FBQzlFLFVBQUksTUFBTTtBQUNULGFBQUssWUFBWSxNQUFNLG1CQUFtQixjQUFjLFdBQVcsdUNBQXVDLEtBQUssSUFBSSxHQUFHO0FBQUEsTUFDdkg7QUFFQSxXQUFLLHVCQUF1QixhQUFhO0FBQ3pDLFdBQUssb0JBQW9CLGNBQWM7QUFFdkMsVUFBSSxLQUFLLG9CQUFvQiwyQkFBMkIsR0FBRztBQUMxRCxhQUFLLFlBQVksS0FBSyxxREFBcUQ7QUFDM0UsYUFBSyxxQkFBcUIsT0FBTyxJQUFJLFNBQVMsZ0NBQWdDLGtFQUFrRSxHQUFHLEVBQUUsV0FBVyxJQUFLLENBQUM7QUFDdEssYUFBSyxnQ0FBZ0MsT0FBTyxNQUFNLEtBQUssS0FBSyw0QkFBNEIsS0FBSyxDQUFDLENBQUM7QUFBQSxNQUNoRyxPQUFPO0FBQ04sYUFBSyxxQkFBcUI7QUFBQSxVQUFPLFNBQVM7QUFBQSxVQUFPLElBQUksU0FBUywwQkFBMEIsa0ZBQWtGO0FBQUEsVUFDekssQ0FBQztBQUFBLFlBQ0EsT0FBTyxJQUFJLFNBQVMsV0FBVywrQkFBK0I7QUFBQSxZQUM5RCxLQUFLLE1BQU07QUFDVixtQkFBSyxnQ0FBZ0MsT0FBTyxNQUFNLEtBQUssS0FBSyw0QkFBNEIsS0FBSyxDQUFDLENBQUM7QUFBQSxZQUNoRztBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsSUFDRCxTQUFTLEtBQUs7QUFBQSxJQUVkO0FBQUEsRUFDRDtBQUFBLEVBRVUsdUJBQXVCLGVBQTRDO0FBRTVFLFVBQU0sc0JBQTZDLENBQUM7QUFDcEQsZUFBVyxtQkFBbUIsS0FBSyxpQkFBaUIsT0FBTyxHQUFHO0FBQzdELFVBQUksZ0JBQWdCLHFCQUFxQixjQUFjLGtCQUFrQixnQkFBZ0IsRUFBRSxHQUFHO0FBQzdGLDRCQUFvQixLQUFLLGdCQUFnQixFQUFFO0FBQUEsTUFDNUM7QUFBQSxJQUNEO0FBRUEsUUFBSSxvQkFBb0IsU0FBUyxHQUFHO0FBQ25DLFdBQUssWUFBWSxNQUFNLG1CQUFtQixjQUFjLFdBQVcscUVBQXFFLG9CQUFvQixJQUFJLFFBQU0sR0FBRyxLQUFLLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUFBLElBQzdMLE9BQU87QUFDTixXQUFLLFlBQVksTUFBTSxtQkFBbUIsY0FBYyxXQUFXLDBEQUEwRDtBQUFBLElBQzlIO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYSxvQkFBb0IsU0FBc0U7QUFDdEcsVUFBTSxLQUFLLHNCQUFzQjtBQUVqQyxRQUFJLFNBQVM7QUFDWixZQUFNLEtBQUssdUJBQXVCLElBQUkseUJBQXlCLFFBQVEsT0FBTyxRQUFRLFFBQVEsQ0FBQztBQUFBLElBQ2hHO0FBRUEsVUFBTSxPQUFPLE1BQU0sS0FBSyxVQUFVLFlBQVkscUJBQXFCO0FBQ25FLFFBQUk7QUFDSCxXQUFLLGdDQUFnQyxPQUFPLE1BQU0sS0FBSyxLQUFLLDRCQUE0QixLQUFLLENBQUMsQ0FBQztBQUUvRixZQUFNLDZCQUE2QixLQUFLLDBCQUEwQixrQkFBa0IsWUFBWTtBQUNoRyxZQUFNLFFBQVEsSUFBSSwyQkFBMkIsSUFBSSxhQUFXLFFBQVEsTUFBTSxDQUFDLENBQUM7QUFBQSxJQUM3RSxVQUFFO0FBQ0QsV0FBSyxRQUFRO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUEsRUFNTyxnQkFBZ0IsaUJBQXlCLGlCQUFpQyxlQUFlLFFBQXVCO0FBQ3RILFFBQUksS0FBSywwQkFBMEIsT0FBTyxHQUFHO0FBSTVDLFdBQUssNEJBQTRCLElBQUksZUFBZTtBQUVwRCxVQUFJLENBQUMsS0FBSyxVQUFVLHdCQUF3QixlQUFlLEdBQUc7QUFFN0QsZUFBTztBQUFBLE1BQ1I7QUFFQSxhQUFPLEtBQUssaUJBQWlCLGlCQUFpQixjQUFjO0FBQUEsSUFDN0QsT0FBTztBQUlOLFdBQUssNEJBQTRCLElBQUksZUFBZTtBQUVwRCxVQUFJLG1CQUFtQixlQUFlLFdBQVc7QUFFaEQsZUFBTyxLQUFLLGlCQUFpQixpQkFBaUIsY0FBYztBQUFBLE1BQzdEO0FBRUEsYUFBTyxLQUFLLDBCQUEwQixLQUFLLEVBQUUsS0FBSyxNQUFNLEtBQUssaUJBQWlCLGlCQUFpQixjQUFjLENBQUM7QUFBQSxJQUMvRztBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlCQUFpQixpQkFBeUIsZ0JBQStDO0FBQ2hHLFVBQU0sU0FBUyxRQUFRO0FBQUEsTUFDdEIsS0FBSyx1QkFBdUIsSUFBSSxvQkFBa0IsZUFBZSxnQkFBZ0IsaUJBQWlCLGNBQWMsQ0FBQztBQUFBLElBQ2xILEVBQUUsS0FBSyxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQ2hCLFNBQUssdUJBQXVCLEtBQUs7QUFBQSxNQUNoQyxPQUFPO0FBQUEsTUFDUCxZQUFZO0FBQUEsSUFDYixDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLGFBQWEsYUFBa0MsUUFBa0Q7QUFDdkcsV0FBTyxLQUFLLGNBQWMsYUFBYSxNQUFNO0FBQUEsRUFDOUM7QUFBQSxFQUVPLHNCQUFzQixpQkFBa0M7QUFDOUQsUUFBSSxDQUFDLEtBQUssMEJBQTBCLE9BQU8sR0FBRztBQUM3QyxhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUksQ0FBQyxLQUFLLFVBQVUsd0JBQXdCLGVBQWUsR0FBRztBQUU3RCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sS0FBSyx1QkFBdUIsTUFBTSxhQUFXLFFBQVEsc0JBQXNCLGVBQWUsQ0FBQztBQUFBLEVBQ25HO0FBQUEsRUFFTyxvQ0FBc0Q7QUFDNUQsV0FBTyxLQUFLLDBCQUEwQixLQUFLO0FBQUEsRUFDNUM7QUFBQSxFQUVBLElBQUksYUFBc0M7QUFDekMsV0FBTyxLQUFLLFVBQVUsNEJBQTRCO0FBQUEsRUFDbkQ7QUFBQSxFQUVVLHlDQUF3RjtBQUNqRyxXQUFPLEtBQUssMEJBQTBCLEtBQUssRUFBRSxLQUFLLE1BQU0sS0FBSyxVQUFVLFlBQVksQ0FBQztBQUFBLEVBQ3JGO0FBQUEsRUFFTyxhQUFhLElBQXdEO0FBQzNFLFdBQU8sS0FBSywwQkFBMEIsS0FBSyxFQUFFLEtBQUssTUFBTTtBQUN2RCxhQUFPLEtBQUssVUFBVSx3QkFBd0IsRUFBRTtBQUFBLElBQ2pELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFTyxnQ0FBa0csVUFBd0U7QUFDaEwsV0FBTyxLQUFLLDBCQUEwQixLQUFLLEVBQUUsS0FBSyxNQUFNO0FBQ3ZELFlBQU0sc0JBQXNCLEtBQUssVUFBVSw0QkFBNEI7QUFFdkUsWUFBTSxTQUEwQyxDQUFDO0FBQ2pELGlCQUFXLFFBQVEscUJBQXFCO0FBQ3ZDLFlBQUksS0FBSyxlQUFlLGVBQWUsS0FBSyxLQUFLLGFBQWEsU0FBUyxJQUFJLEdBQUc7QUFDN0UsaUJBQU8sS0FBSyxJQUFJLDJCQUE4QixNQUFNLEtBQUssWUFBWSxTQUFTLElBQXFDLENBQU0sQ0FBQztBQUFBLFFBQzNIO0FBQUEsTUFDRDtBQUVBLGFBQU87QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFTyxzQkFBMkQ7QUFDakUsVUFBTSxTQUE4Qyx1QkFBTyxPQUFPLElBQUk7QUFDdEUsUUFBSSxLQUFLLFdBQVc7QUFDbkIsWUFBTSxhQUFhLEtBQUssVUFBVSw0QkFBNEI7QUFDOUQsaUJBQVcsYUFBYSxZQUFZO0FBQ25DLGNBQU0sa0JBQWtCLEtBQUssaUJBQWlCLElBQUksVUFBVSxVQUFVO0FBQ3RFLGVBQU8sVUFBVSxXQUFXLEtBQUssSUFBSTtBQUFBLFVBQ3BDLElBQUksVUFBVTtBQUFBLFVBQ2QsVUFBVSxpQkFBaUIsWUFBWSxDQUFDO0FBQUEsVUFDeEMsbUJBQW1CLGlCQUFpQixxQkFBcUI7QUFBQSxVQUN6RCxpQkFBaUIsaUJBQWlCLG1CQUFtQjtBQUFBLFVBQ3JELGVBQWUsaUJBQWlCLGlCQUFpQixDQUFDO0FBQUEsVUFDbEQsaUJBQWlCLEtBQUssa0JBQWtCLG1CQUFtQixVQUFVLFVBQVU7QUFBQSxRQUNoRjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWEsZ0JBQWdCLG1CQUFzQyxvQkFBd0U7QUFDMUksVUFBTSxTQUFTLE1BQU0sUUFBUTtBQUFBLE1BQzVCLEtBQUssMEJBQTBCLGlCQUFpQixFQUFFLElBQUksYUFBVyxRQUFRLGVBQWUsa0JBQWtCLENBQUM7QUFBQSxJQUM1RztBQUVBLFdBQU8sT0FBTyxPQUFPLFNBQVM7QUFBQSxFQUMvQjtBQUFBLEVBRUEsTUFBYSxxQkFBcUIsS0FBc0Q7QUFDdkYsVUFBTSxLQUFLLHVCQUNULElBQUksYUFBVyxRQUFRLHFCQUFxQixHQUFHLENBQUM7QUFBQSxFQUNuRDtBQUFBO0FBQUE7QUFBQSxFQU1RLHFCQUFxQixXQUFnQztBQUM1RCxRQUFJO0FBQ0gsYUFBTyxLQUFLLDRCQUE0QixVQUFVLFNBQVM7QUFBQSxJQUM1RCxTQUFTLEtBQUs7QUFDYixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUF5QixvQkFBNkMsNkJBQTRDO0FBQ3pILFVBQU0sMEJBQStELHVCQUFPLE9BQU8sSUFBSTtBQUN2RixlQUFXLHdCQUF3QixvQkFBb0I7QUFDdEQsVUFBSSxxQkFBcUIsYUFBYTtBQUNyQyxtQkFBVyxnQkFBZ0IscUJBQXFCLGFBQWE7QUFDNUQsY0FBSSxlQUFlLEtBQUsscUJBQXFCLGFBQWEsWUFBWSxHQUFHO0FBQ3hFLG9DQUF3QixZQUFZLElBQUk7QUFBQSxVQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFVBQU0saUJBQWlCLENBQUMsUUFBa0IsS0FBSyw2QkFBNkIsR0FBRztBQUMvRSxVQUFNLHNCQUFzQixLQUFLLFVBQVUsNEJBQTRCO0FBQ3ZFLFVBQU0sa0JBQWtCLG1CQUFtQixtQkFBbUI7QUFDOUQsU0FBSyxLQUFLLDhCQUE4QiwyQ0FBMkMsZ0NBQWdDO0FBQ25ILGVBQVcsa0JBQWtCLGlCQUFpQjtBQUM3QyxVQUFJLHdCQUF3QixlQUFlLElBQUksTUFBTSxDQUFDLCtCQUErQixlQUFlLG9CQUFvQjtBQUN2SCxhQUFLLEtBQUssaUNBQWlDLGVBQWUsSUFBSSxFQUFFO0FBQ2hFLGlDQUF5QixzQkFBc0IsZ0JBQWdCLHFCQUFxQixjQUFjO0FBQ2xHLGFBQUssS0FBSyxnQ0FBZ0MsZUFBZSxJQUFJLEVBQUU7QUFBQSxNQUNoRTtBQUFBLElBQ0Q7QUFDQSxTQUFLLEtBQUssOEJBQThCLDBDQUEwQywrQkFBK0I7QUFBQSxFQUNsSDtBQUFBLEVBRVEsNEJBQTRCLGFBQW1EO0FBQ3RGLFFBQUksQ0FBQyxLQUFLLGlCQUFpQixJQUFJLFdBQVcsR0FBRztBQUM1QyxXQUFLLGlCQUFpQixJQUFJLGFBQWEsSUFBSSxnQkFBZ0IsV0FBVyxDQUFDO0FBQUEsSUFDeEU7QUFDQSxXQUFPLEtBQUssaUJBQWlCLElBQUksV0FBVztBQUFBLEVBQzdDO0FBQUEsRUFFUSw2QkFBNkIsS0FBZTtBQUNuRCxVQUFNLGtCQUFrQixLQUFLLDRCQUE0QixJQUFJLFdBQVc7QUFDeEUsb0JBQWdCLFdBQVcsR0FBRztBQUU5QixVQUFNLFlBQVksS0FBSyxVQUFVLHdCQUF3QixJQUFJLFdBQVc7QUFDeEUsVUFBTSxTQUFTLElBQUksSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLE9BQU87QUFFekQsUUFBSSxJQUFJLFNBQVMsU0FBUyxPQUFPO0FBQ2hDLFVBQUksYUFBYSxVQUFVLG9CQUFvQjtBQUU5QyxhQUFLLHFCQUFxQixPQUFPLEVBQUUsVUFBVSxTQUFTLE9BQU8sU0FBUyxPQUFPLENBQUM7QUFBQSxNQUMvRTtBQUNBLFdBQUssWUFBWSxNQUFNLE1BQU07QUFBQSxJQUM5QixXQUFXLElBQUksU0FBUyxTQUFTLFNBQVM7QUFDekMsVUFBSSxhQUFhLFVBQVUsb0JBQW9CO0FBRTlDLGFBQUsscUJBQXFCLE9BQU8sRUFBRSxVQUFVLFNBQVMsU0FBUyxTQUFTLE9BQU8sQ0FBQztBQUFBLE1BQ2pGO0FBQ0EsV0FBSyxZQUFZLEtBQUssTUFBTTtBQUFBLElBQzdCLE9BQU87QUFDTixXQUFLLFlBQVksS0FBSyxNQUFNO0FBQUEsSUFDN0I7QUFFQSxRQUFJLElBQUksZUFBZSxLQUFLLG9CQUFvQixXQUFXLENBQUMsS0FBSyxvQkFBb0Isd0JBQXdCO0FBQzVHLFlBQU0sRUFBRSxNQUFNLGFBQWEsa0JBQWtCLFFBQVEsSUFBSTtBQWV6RCxXQUFLLGtCQUFrQixXQUFvRSxxQkFBcUI7QUFBQSxRQUMvRztBQUFBLFFBQU0sYUFBYSxZQUFZO0FBQUEsUUFBTztBQUFBLFFBQWtCO0FBQUEsTUFDekQsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUEsRUFFQSxPQUFlLHNCQUF3RixnQkFBbUMscUJBQThDLGdCQUErQztBQUN0TyxVQUFNLFFBQWtDLENBQUM7QUFDekMsZUFBVyxRQUFRLHFCQUFxQjtBQUN2QyxVQUFJLEtBQUssZUFBZSxlQUFlLEtBQUssS0FBSyxhQUFhLGVBQWUsSUFBSSxHQUFHO0FBQ25GLGNBQU0sS0FBSztBQUFBLFVBQ1YsYUFBYTtBQUFBLFVBQ2IsT0FBTyxLQUFLLFlBQVksZUFBZSxJQUFxQztBQUFBLFVBQzVFLFdBQVcsSUFBSSwwQkFBMEIsZ0JBQWdCLE1BQU0sZUFBZSxJQUFJO0FBQUEsUUFDbkYsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQ0EsbUJBQWUsWUFBWSxLQUFLO0FBQUEsRUFDakM7QUFBQTtBQUFBLEVBSVEsb0JBQW9CLGVBQTBEO0FBQ3JGLFdBQU87QUFBQSxNQUNOLGVBQWUsQ0FBQyxhQUFrQyxXQUFxRDtBQUN0RyxlQUFPLEtBQUssY0FBYyxhQUFhLE1BQU07QUFBQSxNQUM5QztBQUFBLE1BQ0EsMEJBQTBCLENBQUMsZ0JBQTJDO0FBQ3JFLGVBQU8sS0FBSyx5QkFBeUIsYUFBYSxjQUFjLGVBQWU7QUFBQSxNQUNoRjtBQUFBLE1BQ0EseUJBQXlCLENBQUMsYUFBa0MsaUJBQXlCLGtCQUEwQixzQkFBOEIscUJBQXNEO0FBQ2xNLGVBQU8sS0FBSyx3QkFBd0IsYUFBYSxpQkFBaUIsa0JBQWtCLHNCQUFzQixnQkFBZ0I7QUFBQSxNQUMzSDtBQUFBLE1BQ0EsOEJBQThCLENBQUMsYUFBa0MsVUFBdUI7QUFDdkYsZUFBTyxLQUFLLDZCQUE2QixhQUFhLEtBQUs7QUFBQSxNQUM1RDtBQUFBLE1BQ0EsMEJBQTBCLENBQUMsYUFBa0MsUUFBcUI7QUFDakYsZUFBTyxLQUFLLHlCQUF5QixhQUFhLEdBQUc7QUFBQSxNQUN0RDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFhLGNBQWMsYUFBa0MsUUFBa0Q7QUFDOUcsVUFBTSxVQUFVLE1BQU0sUUFBUTtBQUFBLE1BQzdCLEtBQUssdUJBQXVCLElBQUksYUFBVyxRQUFRLFNBQVMsYUFBYSxNQUFNLENBQUM7QUFBQSxJQUNqRjtBQUNBLFVBQU0sWUFBWSxRQUFRLEtBQUssT0FBSyxDQUFDO0FBQ3JDLFFBQUksQ0FBQyxXQUFXO0FBQ2YsWUFBTSxJQUFJLE1BQU0scUJBQXFCLFlBQVksS0FBSyxFQUFFO0FBQUEsSUFDekQ7QUFBQSxFQUNEO0FBQUEsRUFFUSx5QkFBeUIsYUFBa0MsaUJBQWlEO0FBQ25ILFNBQUssa0JBQWtCLElBQUksYUFBYSxlQUFlO0FBQ3ZELFVBQU0sa0JBQWtCLEtBQUssNEJBQTRCLFdBQVc7QUFDcEUsb0JBQWdCLGVBQWU7QUFBQSxFQUNoQztBQUFBLEVBRVEsd0JBQXdCLGFBQWtDLGlCQUF5QixrQkFBMEIsc0JBQThCLGtCQUFtRDtBQUNyTSxVQUFNLGtCQUFrQixLQUFLLDRCQUE0QixXQUFXO0FBQ3BFLG9CQUFnQixtQkFBbUIsSUFBSSxnQkFBZ0IsaUJBQWlCLGtCQUFrQixzQkFBc0IsZ0JBQWdCLENBQUM7QUFDakksU0FBSyw2QkFBNkIsS0FBSyxDQUFDLFdBQVcsQ0FBQztBQUFBLEVBQ3JEO0FBQUEsRUFFUSw2QkFBNkIsYUFBa0MsT0FBb0I7QUFXMUYsU0FBSyxrQkFBa0IsV0FBa0YsNEJBQTRCO0FBQUEsTUFDcEksYUFBYSxZQUFZO0FBQUEsTUFDekIsT0FBTyxNQUFNO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEseUJBQXlCLGFBQWtDLEtBQWtCO0FBQ3BGLFVBQU0sa0JBQWtCLEtBQUssNEJBQTRCLFdBQVc7QUFDcEUsb0JBQWdCLGdCQUFnQixHQUFHO0FBQ25DLFNBQUssNkJBQTZCLEtBQUssQ0FBQyxXQUFXLENBQUM7QUFBQSxFQUNyRDtBQU9EO0FBenBDc0IsMkJBQWY7QUFBQSxFQTZDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTdEbUI7QUEycEN0QixNQUFNLGdDQUFnQyxXQUFXO0FBQUEsRUFBakQ7QUFBQTtBQUVDLFNBQVEseUJBQXFELENBQUM7QUFBQTtBQUFBLEVBRTlDLFVBQVU7QUFDekIsYUFBUyxJQUFJLEtBQUssdUJBQXVCLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUNqRSxZQUFNLFVBQVUsS0FBSyx1QkFBdUIsQ0FBQztBQUM3QyxjQUFRLGNBQWMsV0FBVztBQUNqQyxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUNBLFNBQUsseUJBQXlCLENBQUM7QUFDL0IsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUFBLEVBRU8sSUFBSSxzQkFBNkMsaUJBQXdDO0FBQy9GLFNBQUssdUJBQXVCLEtBQUssSUFBSSx5QkFBeUIsc0JBQXNCLGVBQWUsQ0FBQztBQUFBLEVBQ3JHO0FBQUEsRUFFQSxNQUFhLG1CQUFrQztBQUk5QyxhQUFTLElBQUksS0FBSyx1QkFBdUIsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ2pFLFlBQU0sVUFBVSxLQUFLLHVCQUF1QixDQUFDO0FBQzdDLFlBQU0sUUFBUSxjQUFjLFdBQVc7QUFDdkMsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFDQSxTQUFLLHlCQUF5QixDQUFDO0FBQUEsRUFDaEM7QUFBQSxFQUVBLE1BQWEsUUFBUSxzQkFBNEQ7QUFDaEYsVUFBTSxRQUFRLEtBQUssdUJBQXVCLFVBQVUsUUFBTSxHQUFHLGtCQUFrQixvQkFBb0I7QUFDbkcsUUFBSSxTQUFTLEdBQUc7QUFDZixXQUFLLHVCQUF1QixPQUFPLE9BQU8sQ0FBQztBQUMzQyxZQUFNLHFCQUFxQixXQUFXO0FBQ3RDLDJCQUFxQixRQUFRO0FBQUEsSUFDOUI7QUFBQSxFQUNEO0FBQUEsRUFFTyxVQUFVLE1BQWtEO0FBQ2xFLFdBQU8sS0FBSyxPQUFPLFFBQU0sR0FBRyxTQUFTLElBQUk7QUFBQSxFQUMxQztBQUFBLEVBRU8scUJBQXFCLGlCQUF5RTtBQUNwRyxlQUFXLE1BQU0sS0FBSyx3QkFBd0I7QUFDN0MsVUFBSSxHQUFHLGNBQWMsMEJBQTBCLGVBQWUsR0FBRztBQUNoRSxlQUFPLEdBQUc7QUFBQSxNQUNYO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxFQUFFLE9BQU8sUUFBUSxJQUFJO0FBQ3BCLGVBQVcsd0JBQXdCLEtBQUssd0JBQXdCO0FBQy9ELFlBQU0scUJBQXFCO0FBQUEsSUFDNUI7QUFBQSxFQUNEO0FBQUEsRUFFTyxJQUFPLFVBQTZEO0FBQzFFLFdBQU8sS0FBSyx1QkFBdUIsSUFBSSxRQUFNLFNBQVMsR0FBRyxhQUFhLENBQUM7QUFBQSxFQUN4RTtBQUFBLEVBRU8sTUFBTSxVQUF1RTtBQUNuRixXQUFPLEtBQUssdUJBQXVCLE1BQU0sUUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDO0FBQUEsRUFDMUU7QUFBQSxFQUVPLE9BQU8sVUFBdUY7QUFDcEcsV0FBTyxLQUFLLHVCQUF1QixPQUFPLFFBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxFQUFFLElBQUksUUFBTSxHQUFHLGFBQWE7QUFBQSxFQUN2RztBQUNEO0FBRUEsTUFBTSx5QkFBeUI7QUFBQSxFQUM5QixZQUNpQixlQUNBLGlCQUNmO0FBRmU7QUFDQTtBQUFBLEVBQ2I7QUFBQSxFQUVHLFVBQWdCO0FBQ3RCLFNBQUssZ0JBQWdCLFFBQVE7QUFDN0IsU0FBSyxjQUFjLFFBQVE7QUFBQSxFQUM1QjtBQUNEO0FBRU8sTUFBTSxtQkFBbUI7QUFBQSxFQUMvQixZQUNpQixZQUNmO0FBRGU7QUFBQSxFQUNiO0FBQ0w7QUFFTyxNQUFNLGdCQUFnQjtBQUFBLEVBQzVCLFlBQ2lCLFlBQ2Y7QUFEZTtBQUFBLEVBQ2I7QUFDTDtBQUVPLE1BQU0saUJBQWlCO0FBQUEsRUFDN0IsWUFDaUIsWUFDZjtBQURlO0FBQUEsRUFDYjtBQUNMO0FBUUEsTUFBTSx5QkFBeUI7QUFBQSxFQUM5QixZQUNpQixPQUNBLFVBQ2Y7QUFGZTtBQUNBO0FBQUEsRUFDYjtBQUNMO0FBRU8sU0FBUyxvQkFBb0IsV0FBMkM7QUFDOUUsU0FBTyxDQUFDLENBQUMsVUFBVSxrQkFBa0IsS0FBSyxxQkFBbUIsZ0JBQWdCLFdBQVcsMkJBQTJCLENBQUM7QUFDckg7QUFNTyxTQUFTLDJCQUEyQixZQUF5Qiw0QkFBa0UsdUJBQThDLFlBQXFDLHNCQUF3RDtBQUVoUix3QkFBc0IsMEJBQTBCLFVBQVU7QUFHMUQsU0FBTyx3QkFBd0IsWUFBWSw0QkFBNEIsWUFBWSxvQkFBb0I7QUFDeEc7QUFNTyxTQUFTLHdCQUF3QixZQUF5Qiw0QkFBa0UsWUFBcUMsc0JBQXdEO0FBQy9OLFFBQU0sb0JBQTZDLENBQUMsR0FBRyxvQkFBNkMsQ0FBQyxHQUFHLG1CQUFpQyxDQUFDO0FBQzFJLGFBQVcsYUFBYSxZQUFZO0FBQ25DLFFBQUksVUFBVSxvQkFBb0I7QUFFakMsd0JBQWtCLEtBQUssU0FBUztBQUFBLElBQ2pDLE9BQU87QUFDTix3QkFBa0IsS0FBSyxTQUFTO0FBQ2hDLHVCQUFpQixLQUFLLFlBQVksU0FBUyxDQUFDO0FBQUEsSUFDN0M7QUFBQSxFQUNEO0FBRUEsUUFBTSxtQkFBbUIsMkJBQTJCLG9CQUFvQixrQkFBa0IsdUJBQXVCLEVBQUUsU0FBUyxLQUFLLElBQUksTUFBUztBQUM5SSxXQUFTLFFBQVEsR0FBRyxRQUFRLGlCQUFpQixRQUFRLFNBQVM7QUFDN0QsUUFBSSwyQkFBMkIseUJBQXlCLGlCQUFpQixLQUFLLENBQUMsR0FBRztBQUNqRix3QkFBa0IsS0FBSyxrQkFBa0IsS0FBSyxDQUFDO0FBQUEsSUFDaEQsT0FBTztBQUNOLFVBQUksTUFBTTtBQUNULG1CQUFXLEtBQUssdUNBQXVDLGtCQUFrQixLQUFLLEVBQUUsV0FBVyxLQUFLLGVBQWU7QUFBQSxNQUNoSDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBTU8sU0FBUyxtQkFBbUIsWUFBeUIsNEJBQWtFLFdBQWtDLHNCQUF3QztBQUN2TSxTQUFPLHdCQUF3QixZQUFZLDRCQUE0QixDQUFDLFNBQVMsR0FBRyxvQkFBb0IsRUFBRSxTQUFTLFNBQVM7QUFDN0g7QUFFQSxTQUFTLFNBQVMsWUFBcUMsWUFBMEM7QUFDaEcsYUFBVyxhQUFhLFlBQVk7QUFDbkMsUUFBSSxvQkFBb0IsT0FBTyxVQUFVLFlBQVksVUFBVSxHQUFHO0FBQ2pFLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUNBLFNBQU87QUFDUjtBQUVPLE1BQU0sZ0JBQWdCO0FBQUEsRUFzQjVCLFlBQ2lCLElBQ2Y7QUFEZTtBQXJCakIsU0FBaUIsWUFBd0IsQ0FBQztBQUsxQyxTQUFRLG1CQUEyQztBQUtuRCxTQUFRLGlCQUEwQixDQUFDO0FBS25DLFNBQVEscUJBQThCO0FBQUEsRUFPbEM7QUFBQSxFQXJCSixJQUFXLFdBQXVCO0FBQ2pDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUdBLElBQVcsa0JBQTBDO0FBQ3BELFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUdBLElBQVcsZ0JBQXlCO0FBQ25DLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUdBLElBQVcsb0JBQTZCO0FBQ3ZDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQU1PLHFCQUEyQjtBQUNqQyxTQUFLLHFCQUFxQjtBQUMxQixTQUFLLG1CQUFtQjtBQUN4QixTQUFLLGlCQUFpQixDQUFDO0FBQUEsRUFDeEI7QUFBQSxFQUVPLFdBQVcsS0FBcUI7QUFDdEMsU0FBSyxVQUFVLEtBQUssR0FBRztBQUFBLEVBQ3hCO0FBQUEsRUFFTyxtQkFBbUIsaUJBQWtDO0FBQzNELFNBQUssbUJBQW1CO0FBQUEsRUFDekI7QUFBQSxFQUVPLGdCQUFnQixLQUFrQjtBQUN4QyxTQUFLLGVBQWUsS0FBSyxHQUFHO0FBQUEsRUFDN0I7QUFBQSxFQUVPLGlCQUFpQjtBQUN2QixTQUFLLHFCQUFxQjtBQUFBLEVBQzNCO0FBQ0Q7QUFNTyxNQUFNLDZCQUFOLE1BQU0sMkJBQTBCO0FBQUEsRUFBaEM7QUFLTixTQUFpQixpQkFBNEMsQ0FBQztBQUFBO0FBQUEsRUFFdEQsb0JBQTBCO0FBQ2pDLFVBQU0sUUFBUSxLQUFLLElBQUksSUFBSSwyQkFBMEI7QUFDckQsV0FBTyxLQUFLLGVBQWUsU0FBUyxLQUFLLEtBQUssZUFBZSxDQUFDLEVBQUUsWUFBWSxPQUFPO0FBQ2xGLFdBQUssZUFBZSxNQUFNO0FBQUEsSUFDM0I7QUFBQSxFQUNEO0FBQUEsRUFFTyxnQkFBc0I7QUFDNUIsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxlQUFlLEtBQUssRUFBRSxXQUFXLEtBQUssSUFBSSxFQUFFLENBQUM7QUFBQSxFQUNuRDtBQUFBLEVBRU8sNkJBQXNDO0FBQzVDLFNBQUssa0JBQWtCO0FBQ3ZCLFdBQVEsS0FBSyxlQUFlLFNBQVMsMkJBQTBCO0FBQUEsRUFDaEU7QUFDRDtBQXZCYSwyQkFFRyxjQUFjLElBQUksS0FBSztBQUFBO0FBRjFCLDJCQUdHLGVBQWU7QUFIeEIsSUFBTSw0QkFBTjtBQTZCQSxNQUFNLDhCQUFpRTtBQUFBLEVBQ3RFLHFCQUFxQixzQkFBdUQ7QUFDbEYsV0FBTyx5QkFBeUIscUJBQXFCLG9CQUFvQjtBQUFBLEVBQzFFO0FBQ0Q7QUFFQSxNQUFNLDJDQUEyQyxXQUF3RDtBQUFBLEVBQXpHO0FBQUE7QUFFQyxTQUFTLE9BQU87QUFBQTtBQUFBLEVBRWhCLGFBQWEsVUFBdUM7QUFDbkQsV0FBTyxDQUFDLENBQUMsU0FBUztBQUFBLEVBQ25CO0FBQUEsRUFFQSxPQUFPLFVBQThEO0FBQ3BFLFVBQU0sbUJBQW1CLFNBQVMsb0JBQW9CLENBQUM7QUFDdkQsVUFBTSxPQUFPLElBQUksZUFBZTtBQUNoQyxRQUFJLGlCQUFpQixRQUFRO0FBQzVCLGlCQUFXLG1CQUFtQixrQkFBa0I7QUFDL0MsYUFBSyxlQUFlLE9BQU8sZUFBZTtBQUFBLENBQU07QUFBQSxNQUNqRDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQUEsTUFBRTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUNEO0FBRUEsU0FBUyxHQUErQiw0QkFBNEIseUJBQXlCLEVBQUUseUJBQXlCO0FBQUEsRUFDdkgsSUFBSTtBQUFBLEVBQ0osT0FBTyxJQUFJLFNBQVMsY0FBYyxtQkFBbUI7QUFBQSxFQUNyRCxRQUFRO0FBQUEsSUFDUCxXQUFXO0FBQUEsRUFDWjtBQUFBLEVBQ0EsVUFBVSxJQUFJLGVBQWUsa0NBQWtDO0FBQ2hFLENBQUM7IiwKICAibmFtZXMiOiBbIml0ZW0iLCAiaW5jbHVkZXMiLCAicmVhc29uIiwgInZhbHVlIl0KfQo=
