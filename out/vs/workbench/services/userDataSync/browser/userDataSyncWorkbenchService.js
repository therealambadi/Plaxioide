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
import { IUserDataSyncService, isAuthenticationProvider, IUserDataAutoSyncService, IUserDataSyncStoreManagementService, SyncStatus, IUserDataSyncEnablementService, USER_DATA_SYNC_SCHEME, USER_DATA_SYNC_LOG_ID } from "../../../../platform/userDataSync/common/userDataSync.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IUserDataSyncWorkbenchService, AccountStatus, CONTEXT_SYNC_ENABLEMENT, CONTEXT_SYNC_STATE, CONTEXT_ACCOUNT_STATE, SHOW_SYNC_LOG_COMMAND_ID, CONTEXT_ENABLE_ACTIVITY_VIEWS, SYNC_VIEW_CONTAINER_ID, SYNC_TITLE, SYNC_CONFLICTS_VIEW_ID, CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW, CONTEXT_HAS_CONFLICTS, getSyncAreaLabel } from "../common/userDataSync.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { getCurrentAuthenticationSessionInfo } from "../../authentication/browser/authenticationService.js";
import { IAuthenticationService } from "../../authentication/common/authentication.js";
import { IUserDataSyncAccountService } from "../../../../platform/userDataSync/common/userDataSyncAccount.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { localize } from "../../../../nls.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { URI } from "../../../../base/common/uri.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../views/common/viewsService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { UserDataSyncStoreClient } from "../../../../platform/userDataSync/common/userDataSyncStoreService.js";
import { UserDataSyncStoreTypeSynchronizer } from "../../../../platform/userDataSync/common/globalStateSync.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { raceCancellationError } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isDiffEditorInput } from "../../../common/editor.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IUserDataInitializationService } from "../../userData/browser/userDataInit.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { IUserDataSyncMachinesService } from "../../../../platform/userDataSync/common/userDataSyncMachines.js";
import { equals } from "../../../../base/common/arrays.js";
class UserDataSyncAccount {
  constructor(authenticationProviderId, session) {
    this.authenticationProviderId = authenticationProviderId;
    this.session = session;
  }
  get sessionId() {
    return this.session.id;
  }
  get accountName() {
    return this.session.account.label;
  }
  get accountId() {
    return this.session.account.id;
  }
  get token() {
    return this.session.idToken || this.session.accessToken;
  }
}
function isMergeEditorInput(editor) {
  const candidate = editor;
  return URI.isUri(candidate?.base) && URI.isUri(candidate?.input1?.uri) && URI.isUri(candidate?.input2?.uri) && URI.isUri(candidate?.result);
}
let UserDataSyncWorkbenchService = class extends Disposable {
  constructor(userDataSyncService, uriIdentityService, authenticationService, userDataSyncAccountService, quickInputService, storageService, userDataSyncEnablementService, userDataAutoSyncService, logService, productService, extensionService, environmentService, secretStorageService, notificationService, progressService, dialogService, contextKeyService, viewsService, viewDescriptorService, userDataSyncStoreManagementService, lifecycleService, instantiationService, editorService, userDataInitializationService, fileService, fileDialogService, userDataSyncMachinesService) {
    super();
    this.userDataSyncService = userDataSyncService;
    this.uriIdentityService = uriIdentityService;
    this.authenticationService = authenticationService;
    this.userDataSyncAccountService = userDataSyncAccountService;
    this.quickInputService = quickInputService;
    this.storageService = storageService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataAutoSyncService = userDataAutoSyncService;
    this.logService = logService;
    this.productService = productService;
    this.extensionService = extensionService;
    this.environmentService = environmentService;
    this.secretStorageService = secretStorageService;
    this.notificationService = notificationService;
    this.progressService = progressService;
    this.dialogService = dialogService;
    this.viewsService = viewsService;
    this.viewDescriptorService = viewDescriptorService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.lifecycleService = lifecycleService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.userDataInitializationService = userDataInitializationService;
    this.fileService = fileService;
    this.fileDialogService = fileDialogService;
    this.userDataSyncMachinesService = userDataSyncMachinesService;
    this._authenticationProviders = [];
    this._accountStatus = AccountStatus.Uninitialized;
    this._onDidChangeAccountStatus = this._register(new Emitter());
    this.onDidChangeAccountStatus = this._onDidChangeAccountStatus.event;
    this._onDidTurnOnSync = this._register(new Emitter());
    this.onDidTurnOnSync = this._onDidTurnOnSync.event;
    this.turnOnSyncCancellationToken = void 0;
    this._cachedCurrentAuthenticationProviderId = null;
    this._cachedCurrentSessionId = null;
    this.syncEnablementContext = CONTEXT_SYNC_ENABLEMENT.bindTo(contextKeyService);
    this.syncStatusContext = CONTEXT_SYNC_STATE.bindTo(contextKeyService);
    this.accountStatusContext = CONTEXT_ACCOUNT_STATE.bindTo(contextKeyService);
    this.activityViewsEnablementContext = CONTEXT_ENABLE_ACTIVITY_VIEWS.bindTo(contextKeyService);
    this.hasConflicts = CONTEXT_HAS_CONFLICTS.bindTo(contextKeyService);
    this.enableConflictsViewContext = CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW.bindTo(contextKeyService);
    if (this.userDataSyncStoreManagementService.userDataSyncStore) {
      this.syncStatusContext.set(this.userDataSyncService.status);
      this._register(userDataSyncService.onDidChangeStatus((status) => this.syncStatusContext.set(status)));
      this.syncEnablementContext.set(userDataSyncEnablementService.isEnabled());
      this._register(userDataSyncEnablementService.onDidChangeEnablement((enabled) => this.syncEnablementContext.set(enabled)));
      this.waitAndInitialize();
    }
  }
  get enabled() {
    return !!this.userDataSyncStoreManagementService.userDataSyncStore;
  }
  get authenticationProviders() {
    return this._authenticationProviders;
  }
  get accountStatus() {
    return this._accountStatus;
  }
  get current() {
    return this._current;
  }
  updateAuthenticationProviders() {
    const oldValue = this._authenticationProviders;
    this._authenticationProviders = (this.userDataSyncStoreManagementService.userDataSyncStore?.authenticationProviders || []).filter(({ id }) => this.authenticationService.declaredProviders.some((provider) => provider.id === id));
    this.logService.trace("Settings Sync: Authentication providers updated", this._authenticationProviders.map(({ id }) => id));
    return equals(oldValue, this._authenticationProviders, (a, b) => a.id === b.id);
  }
  isSupportedAuthenticationProviderId(authenticationProviderId) {
    return this.authenticationProviders.some(({ id }) => id === authenticationProviderId);
  }
  async waitAndInitialize() {
    try {
      await Promise.all([this.extensionService.whenInstalledExtensionsRegistered(), this.userDataInitializationService.whenInitializationFinished()]);
      await this.initialize();
    } catch (error) {
      if (!this.environmentService.extensionTestsLocationURI) {
        this.logService.error(error);
      }
    }
  }
  async initialize() {
    if (isWeb) {
      const authenticationSession = await getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService);
      if (this.currentSessionId === void 0 && authenticationSession?.id) {
        if (this.environmentService.options?.settingsSyncOptions?.authenticationProvider && this.environmentService.options.settingsSyncOptions.enabled) {
          this.currentSessionId = authenticationSession.id;
        } else if (this.useWorkbenchSessionId) {
          this.currentSessionId = authenticationSession.id;
        }
        this.useWorkbenchSessionId = false;
      }
    }
    const initPromise = this.update("initialize");
    this._register(this.authenticationService.onDidChangeDeclaredProviders(() => {
      if (this.updateAuthenticationProviders()) {
        initPromise.finally(() => this.update("declared authentication providers changed"));
      }
    }));
    await initPromise;
    this._register(Event.filter(
      Event.any(
        this.authenticationService.onDidRegisterAuthenticationProvider,
        this.authenticationService.onDidUnregisterAuthenticationProvider
      ),
      (info) => this.isSupportedAuthenticationProviderId(info.id)
    )(() => this.update("authentication provider change")));
    this._register(Event.filter(this.userDataSyncAccountService.onTokenFailed, (isSuccessive) => !isSuccessive)(() => this.update("token failure")));
    this._register(Event.filter(this.authenticationService.onDidChangeSessions, (e) => this.isSupportedAuthenticationProviderId(e.providerId))(({ event }) => this.onDidChangeSessions(event)));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, UserDataSyncWorkbenchService.CACHED_SESSION_STORAGE_KEY, this._store)(() => this.onDidChangeStorage()));
    this._register(Event.filter(this.userDataSyncAccountService.onTokenFailed, (bailout) => bailout)(() => this.onDidAuthFailure()));
    this.hasConflicts.set(this.userDataSyncService.conflicts.length > 0);
    this._register(this.userDataSyncService.onDidChangeConflicts((conflicts) => {
      this.hasConflicts.set(conflicts.length > 0);
      if (!conflicts.length) {
        this.enableConflictsViewContext.reset();
      }
      this.editorService.editors.filter((input) => {
        const remoteResource = isDiffEditorInput(input) ? input.original.resource : isMergeEditorInput(input) ? input.input1.uri : void 0;
        if (remoteResource?.scheme !== USER_DATA_SYNC_SCHEME) {
          return false;
        }
        return !this.userDataSyncService.conflicts.some(({ conflicts: conflicts2 }) => conflicts2.some(({ previewResource }) => this.uriIdentityService.extUri.isEqual(previewResource, input.resource)));
      }).forEach((input) => input.dispose());
    }));
  }
  async update(reason) {
    this.logService.trace(`Settings Sync: Updating due to ${reason}`);
    this.updateAuthenticationProviders();
    await this.updateCurrentAccount();
    if (this._current) {
      this.currentAuthenticationProviderId = this._current.authenticationProviderId;
    }
    await this.updateToken(this._current);
    this.updateAccountStatus(this._current ? AccountStatus.Available : AccountStatus.Unavailable);
  }
  async updateCurrentAccount() {
    this.logService.trace("Settings Sync: Updating the current account");
    const currentSessionId = this.currentSessionId;
    const currentAuthenticationProviderId = this.currentAuthenticationProviderId;
    if (currentSessionId) {
      const authenticationProviders = currentAuthenticationProviderId ? this.authenticationProviders.filter(({ id }) => id === currentAuthenticationProviderId) : this.authenticationProviders;
      for (const { id, scopes } of authenticationProviders) {
        const sessions = await this.authenticationService.getSessions(id, scopes) || [];
        for (const session of sessions) {
          if (session.id === currentSessionId) {
            this._current = new UserDataSyncAccount(id, session);
            this.logService.trace("Settings Sync: Updated the current account", this._current.accountName);
            return;
          }
        }
      }
    }
    this._current = void 0;
  }
  async updateToken(current) {
    let value = void 0;
    if (current) {
      try {
        this.logService.trace("Settings Sync: Updating the token for the account", current.accountName);
        const token = current.token;
        this.traceOrInfo("Settings Sync: Token updated for the account", current.accountName);
        value = { token, authenticationProviderId: current.authenticationProviderId };
      } catch (e) {
        this.logService.error(e);
      }
    }
    await this.userDataSyncAccountService.updateAccount(value);
  }
  traceOrInfo(msg, ...args) {
    if (this.environmentService.isBuilt) {
      this.logService.info(msg, ...args);
    } else {
      this.logService.trace(msg, ...args);
    }
  }
  updateAccountStatus(accountStatus) {
    this.logService.trace(`Settings Sync: Updating the account status to ${accountStatus}`);
    if (this._accountStatus !== accountStatus) {
      const previous = this._accountStatus;
      this.traceOrInfo(`Settings Sync: Account status changed from ${previous} to ${accountStatus}`);
      this._accountStatus = accountStatus;
      this.accountStatusContext.set(accountStatus);
      this._onDidChangeAccountStatus.fire(accountStatus);
    }
  }
  async turnOn() {
    if (!this.authenticationProviders.length) {
      throw new Error(localize("no authentication providers", "Settings sync cannot be turned on because there are no authentication providers available."));
    }
    if (this.userDataSyncEnablementService.isEnabled()) {
      return;
    }
    if (this.userDataSyncService.status !== SyncStatus.Idle) {
      throw new Error("Cannot turn on sync while syncing");
    }
    const picked = await this.pick();
    if (!picked) {
      throw new CancellationError();
    }
    if (this.accountStatus !== AccountStatus.Available) {
      throw new Error(localize("no account", "No account available"));
    }
    const turnOnSyncCancellationToken = this.turnOnSyncCancellationToken = new CancellationTokenSource();
    const disposable = isWeb ? Disposable.None : this.lifecycleService.onBeforeShutdown((e) => e.veto((async () => {
      const { confirmed } = await this.dialogService.confirm({
        type: "warning",
        message: localize("sync in progress", "Settings Sync is being turned on. Would you like to cancel it?"),
        title: localize("settings sync", "Settings Sync"),
        primaryButton: localize({ key: "yes", comment: ["&& denotes a mnemonic"] }, "&&Yes"),
        cancelButton: localize("no", "No")
      });
      if (confirmed) {
        turnOnSyncCancellationToken.cancel();
      }
      return !confirmed;
    })(), "veto.settingsSync"));
    try {
      await this.doTurnOnSync(turnOnSyncCancellationToken.token);
    } finally {
      disposable.dispose();
      this.turnOnSyncCancellationToken = void 0;
    }
    await this.userDataAutoSyncService.turnOn();
    if (this.userDataSyncStoreManagementService.userDataSyncStore?.canSwitch) {
      await this.synchroniseUserDataSyncStoreType();
    }
    this.currentAuthenticationProviderId = this.current?.authenticationProviderId;
    if (this.environmentService.options?.settingsSyncOptions?.enablementHandler && this.currentAuthenticationProviderId) {
      this.environmentService.options.settingsSyncOptions.enablementHandler(true, this.currentAuthenticationProviderId);
    }
    this.notificationService.info(localize("sync turned on", "{0} is turned on", SYNC_TITLE.value));
    this._onDidTurnOnSync.fire();
  }
  async turnoff(everywhere) {
    if (this.userDataSyncEnablementService.isEnabled()) {
      await this.userDataAutoSyncService.turnOff(everywhere);
      if (this.environmentService.options?.settingsSyncOptions?.enablementHandler && this.currentAuthenticationProviderId) {
        this.environmentService.options.settingsSyncOptions.enablementHandler(false, this.currentAuthenticationProviderId);
      }
    }
    if (this.turnOnSyncCancellationToken) {
      this.turnOnSyncCancellationToken.cancel();
    }
  }
  async synchroniseUserDataSyncStoreType() {
    if (!this.userDataSyncAccountService.account) {
      throw new Error("Cannot update because you are signed out from settings sync. Please sign in and try again.");
    }
    if (!isWeb || !this.userDataSyncStoreManagementService.userDataSyncStore) {
      return;
    }
    const userDataSyncStoreUrl = this.userDataSyncStoreManagementService.userDataSyncStore.type === "insiders" ? this.userDataSyncStoreManagementService.userDataSyncStore.stableUrl : this.userDataSyncStoreManagementService.userDataSyncStore.insidersUrl;
    const userDataSyncStoreClient = this.instantiationService.createInstance(UserDataSyncStoreClient, userDataSyncStoreUrl);
    userDataSyncStoreClient.setAuthToken(this.userDataSyncAccountService.account.token, this.userDataSyncAccountService.account.authenticationProviderId);
    await this.instantiationService.createInstance(UserDataSyncStoreTypeSynchronizer, userDataSyncStoreClient).sync(this.userDataSyncStoreManagementService.userDataSyncStore.type);
  }
  syncNow() {
    return this.userDataAutoSyncService.triggerSync(["Sync Now"], { immediately: true, disableCache: true });
  }
  async doTurnOnSync(token) {
    const disposables = new DisposableStore();
    const manualSyncTask = await this.userDataSyncService.createManualSyncTask();
    try {
      await this.progressService.withProgress({
        location: ProgressLocation.Window,
        title: SYNC_TITLE.value,
        command: SHOW_SYNC_LOG_COMMAND_ID,
        delay: 500
      }, async (progress) => {
        progress.report({ message: localize("turning on", "Turning on...") });
        disposables.add(this.userDataSyncService.onDidChangeStatus((status) => {
          if (status === SyncStatus.HasConflicts) {
            progress.report({ message: localize("resolving conflicts", "Resolving conflicts...") });
          } else {
            progress.report({ message: localize("syncing...", "Turning on...") });
          }
        }));
        await manualSyncTask.merge();
        if (this.userDataSyncService.status === SyncStatus.HasConflicts) {
          await this.handleConflictsWhileTurningOn(token);
        }
        await manualSyncTask.apply();
      });
    } catch (error) {
      await manualSyncTask.stop();
      throw error;
    } finally {
      disposables.dispose();
    }
  }
  async handleConflictsWhileTurningOn(token) {
    const conflicts = this.userDataSyncService.conflicts;
    const andSeparator = localize("and", " and ");
    let conflictsText = "";
    for (let i = 0; i < conflicts.length; i++) {
      if (i === conflicts.length - 1 && i !== 0) {
        conflictsText += andSeparator;
      } else if (i !== 0) {
        conflictsText += ", ";
      }
      conflictsText += getSyncAreaLabel(conflicts[i].syncResource);
    }
    const singleConflictResource = conflicts.length === 1 ? getSyncAreaLabel(conflicts[0].syncResource) : void 0;
    await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("conflicts detected", "Conflicts Detected in {0}", conflictsText),
      detail: localize("resolve", "Please resolve conflicts to turn on..."),
      buttons: [
        {
          label: localize({ key: "show conflicts", comment: ["&& denotes a mnemonic"] }, "&&Show Conflicts"),
          run: async () => {
            const waitUntilConflictsAreResolvedPromise = raceCancellationError(Event.toPromise(Event.filter(this.userDataSyncService.onDidChangeConflicts, (conficts) => conficts.length === 0)), token);
            await this.showConflicts(this.userDataSyncService.conflicts[0]?.conflicts[0]);
            await waitUntilConflictsAreResolvedPromise;
          }
        },
        {
          label: singleConflictResource ? localize({ key: "replace local single", comment: ["&& denotes a mnemonic"] }, "Accept &&Remote {0}", singleConflictResource) : localize({ key: "replace local", comment: ["&& denotes a mnemonic"] }, "Accept &&Remote"),
          run: async () => this.replace(true)
        },
        {
          label: singleConflictResource ? localize({ key: "replace remote single", comment: ["&& denotes a mnemonic"] }, "Accept &&Local {0}", singleConflictResource) : localize({ key: "replace remote", comment: ["&& denotes a mnemonic"] }, "Accept &&Local"),
          run: () => this.replace(false)
        }
      ],
      cancelButton: {
        run: () => {
          throw new CancellationError();
        }
      }
    });
  }
  async replace(local) {
    for (const conflict of this.userDataSyncService.conflicts) {
      for (const preview of conflict.conflicts) {
        await this.accept({ syncResource: conflict.syncResource, profile: conflict.profile }, local ? preview.remoteResource : preview.localResource, void 0, { force: true });
      }
    }
  }
  async accept(resource, conflictResource, content, apply) {
    return this.userDataSyncService.accept(resource, conflictResource, content, apply);
  }
  async showConflicts(conflictToOpen) {
    if (!this.userDataSyncService.conflicts.length) {
      return;
    }
    this.enableConflictsViewContext.set(true);
    const view = await this.viewsService.openView(SYNC_CONFLICTS_VIEW_ID);
    if (view && conflictToOpen) {
      await view.open(conflictToOpen);
    }
  }
  async resetSyncedData() {
    const { confirmed } = await this.dialogService.confirm({
      type: "info",
      message: localize("reset", "This will clear your data in the cloud and stop sync on all your devices."),
      title: localize("reset title", "Clear"),
      primaryButton: localize({ key: "resetButton", comment: ["&& denotes a mnemonic"] }, "&&Reset")
    });
    if (confirmed) {
      await this.userDataSyncService.resetRemote();
    }
  }
  async getAllLogResources() {
    const logsFolders = [];
    const stat = await this.fileService.resolve(this.uriIdentityService.extUri.dirname(this.environmentService.logsHome));
    if (stat.children) {
      logsFolders.push(...stat.children.filter((stat2) => stat2.isDirectory && /^\d{8}T\d{6}$/.test(stat2.name)).sort().reverse().map((d) => d.resource));
    }
    const result = [];
    for (const logFolder of logsFolders) {
      const folderStat = await this.fileService.resolve(logFolder);
      const childStat = folderStat.children?.find((stat2) => this.uriIdentityService.extUri.basename(stat2.resource).startsWith(`${USER_DATA_SYNC_LOG_ID}.`));
      if (childStat) {
        result.push(childStat.resource);
      }
    }
    return result;
  }
  async showSyncActivity() {
    this.activityViewsEnablementContext.set(true);
    await this.waitForActiveSyncViews();
    await this.viewsService.openViewContainer(SYNC_VIEW_CONTAINER_ID);
  }
  async downloadSyncActivity() {
    const result = await this.fileDialogService.showOpenDialog({
      title: localize("download sync activity dialog title", "Select folder to download Settings Sync activity"),
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: localize("download sync activity dialog open label", "Save")
    });
    if (!result?.[0]) {
      return;
    }
    return this.progressService.withProgress({ location: ProgressLocation.Window }, async () => {
      const machines = await this.userDataSyncMachinesService.getMachines();
      const currentMachine = machines.find((m) => m.isCurrent);
      const name = (currentMachine ? currentMachine.name + " - " : "") + "Settings Sync Activity";
      const stat = await this.fileService.resolve(result[0]);
      const nameRegEx = new RegExp(`${escapeRegExpCharacters(name)}\\s(\\d+)`);
      const indexes = [];
      for (const child of stat.children ?? []) {
        if (child.name === name) {
          indexes.push(0);
        } else {
          const matches = nameRegEx.exec(child.name);
          if (matches) {
            indexes.push(parseInt(matches[1]));
          }
        }
      }
      indexes.sort((a, b) => a - b);
      const folder = this.uriIdentityService.extUri.joinPath(result[0], indexes[0] !== 0 ? name : `${name} ${indexes[indexes.length - 1] + 1}`);
      await Promise.all([
        this.userDataSyncService.saveRemoteActivityData(this.uriIdentityService.extUri.joinPath(folder, "remoteActivity.json")),
        (async () => {
          const logResources = await this.getAllLogResources();
          await Promise.all(logResources.map(async (logResource) => this.fileService.copy(logResource, this.uriIdentityService.extUri.joinPath(folder, "logs", `${this.uriIdentityService.extUri.basename(this.uriIdentityService.extUri.dirname(logResource))}.log`))));
        })(),
        this.fileService.copy(this.environmentService.userDataSyncHome, this.uriIdentityService.extUri.joinPath(folder, "localActivity"))
      ]);
      return folder;
    });
  }
  async waitForActiveSyncViews() {
    const viewContainer = this.viewDescriptorService.getViewContainerById(SYNC_VIEW_CONTAINER_ID);
    if (viewContainer) {
      const model = this.viewDescriptorService.getViewContainerModel(viewContainer);
      if (!model.activeViewDescriptors.length) {
        await Event.toPromise(Event.filter(model.onDidChangeActiveViewDescriptors, (e) => model.activeViewDescriptors.length > 0));
      }
    }
  }
  async signIn() {
    const currentAuthenticationProviderId = this.currentAuthenticationProviderId;
    const authenticationProvider = currentAuthenticationProviderId ? this.authenticationProviders.find((p) => p.id === currentAuthenticationProviderId) : void 0;
    if (authenticationProvider) {
      await this.doSignIn(authenticationProvider);
    } else {
      if (!this.authenticationProviders.length) {
        throw new Error(localize("no authentication providers during signin", "Cannot sign in because there are no authentication providers available."));
      }
      await this.pick();
    }
  }
  async pick() {
    const result = await this.doPick();
    if (!result) {
      return false;
    }
    await this.doSignIn(result);
    return true;
  }
  async doPick() {
    if (this.authenticationProviders.length === 0) {
      return void 0;
    }
    const authenticationProviders = [...this.authenticationProviders].sort(({ id }) => id === this.currentAuthenticationProviderId ? -1 : 1);
    const allAccounts = /* @__PURE__ */ new Map();
    if (authenticationProviders.length === 1) {
      const accounts = await this.getAccounts(authenticationProviders[0].id, authenticationProviders[0].scopes);
      if (accounts.length) {
        allAccounts.set(authenticationProviders[0].id, accounts);
      } else {
        return authenticationProviders[0];
      }
    }
    let result;
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const promise = new Promise((c) => {
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        c(result);
      }));
    });
    quickPick.title = SYNC_TITLE.value;
    quickPick.ok = false;
    quickPick.ignoreFocusOut = true;
    quickPick.placeholder = localize("choose account placeholder", "Select an account to sign in");
    quickPick.show();
    if (authenticationProviders.length > 1) {
      quickPick.busy = true;
      for (const { id, scopes } of authenticationProviders) {
        const accounts = await this.getAccounts(id, scopes);
        if (accounts.length) {
          allAccounts.set(id, accounts);
        }
      }
      quickPick.busy = false;
    }
    quickPick.items = this.createQuickpickItems(authenticationProviders, allAccounts);
    disposables.add(quickPick.onDidAccept(() => {
      result = quickPick.selectedItems[0]?.account ? quickPick.selectedItems[0]?.account : quickPick.selectedItems[0]?.authenticationProvider;
      quickPick.hide();
    }));
    return promise;
  }
  async getAccounts(authenticationProviderId, scopes) {
    const accounts = /* @__PURE__ */ new Map();
    let currentAccount = null;
    const sessions = await this.authenticationService.getSessions(authenticationProviderId, scopes) || [];
    for (const session of sessions) {
      const account = new UserDataSyncAccount(authenticationProviderId, session);
      accounts.set(account.accountId, account);
      if (account.sessionId === this.currentSessionId) {
        currentAccount = account;
      }
    }
    if (currentAccount) {
      accounts.set(currentAccount.accountId, currentAccount);
    }
    return currentAccount ? [...accounts.values()] : [...accounts.values()].sort(({ sessionId }) => sessionId === this.currentSessionId ? -1 : 1);
  }
  createQuickpickItems(authenticationProviders, allAccounts) {
    const quickPickItems = [];
    if (allAccounts.size) {
      quickPickItems.push({ type: "separator", label: localize("signed in", "Signed in") });
      for (const authenticationProvider of authenticationProviders) {
        const accounts = (allAccounts.get(authenticationProvider.id) || []).sort(({ sessionId }) => sessionId === this.currentSessionId ? -1 : 1);
        const providerName = this.authenticationService.getProvider(authenticationProvider.id).label;
        for (const account of accounts) {
          quickPickItems.push({
            label: `${account.accountName} (${providerName})`,
            description: account.sessionId === this.current?.sessionId ? localize("last used", "Last Used with Sync") : void 0,
            account,
            authenticationProvider
          });
        }
      }
      quickPickItems.push({ type: "separator", label: localize("others", "Others") });
    }
    for (const authenticationProvider of authenticationProviders) {
      const provider = this.authenticationService.getProvider(authenticationProvider.id);
      if (!allAccounts.has(authenticationProvider.id) || provider.supportsMultipleAccounts) {
        const providerName = provider.label;
        quickPickItems.push({ label: localize("sign in using account", "Sign in with {0}", providerName), authenticationProvider });
      }
    }
    return quickPickItems;
  }
  async doSignIn(accountOrAuthProvider) {
    let sessionId;
    if (isAuthenticationProvider(accountOrAuthProvider)) {
      if (this.environmentService.options?.settingsSyncOptions?.authenticationProvider?.id === accountOrAuthProvider.id) {
        sessionId = await this.environmentService.options?.settingsSyncOptions?.authenticationProvider?.signIn();
      } else {
        sessionId = (await this.authenticationService.createSession(accountOrAuthProvider.id, accountOrAuthProvider.scopes)).id;
      }
      this.currentAuthenticationProviderId = accountOrAuthProvider.id;
    } else {
      if (this.environmentService.options?.settingsSyncOptions?.authenticationProvider?.id === accountOrAuthProvider.authenticationProviderId) {
        sessionId = await this.environmentService.options?.settingsSyncOptions?.authenticationProvider?.signIn();
      } else {
        sessionId = accountOrAuthProvider.sessionId;
      }
      this.currentAuthenticationProviderId = accountOrAuthProvider.authenticationProviderId;
    }
    this.currentSessionId = sessionId;
    await this.update("sign in");
  }
  async onDidAuthFailure() {
    this.currentSessionId = void 0;
    await this.update("auth failure");
  }
  onDidChangeSessions(e) {
    if (this.currentSessionId && e.removed?.find((session) => session.id === this.currentSessionId)) {
      this.currentSessionId = void 0;
    }
    this.update("change in sessions");
  }
  onDidChangeStorage() {
    if (this.currentSessionId !== this.getStoredCachedSessionId()) {
      this._cachedCurrentSessionId = null;
      this.update("change in storage");
    }
  }
  get currentAuthenticationProviderId() {
    if (this._cachedCurrentAuthenticationProviderId === null) {
      this._cachedCurrentAuthenticationProviderId = this.storageService.get(UserDataSyncWorkbenchService.CACHED_AUTHENTICATION_PROVIDER_KEY, StorageScope.APPLICATION);
    }
    return this._cachedCurrentAuthenticationProviderId;
  }
  set currentAuthenticationProviderId(currentAuthenticationProviderId) {
    if (this._cachedCurrentAuthenticationProviderId !== currentAuthenticationProviderId) {
      this._cachedCurrentAuthenticationProviderId = currentAuthenticationProviderId;
      if (currentAuthenticationProviderId === void 0) {
        this.storageService.remove(UserDataSyncWorkbenchService.CACHED_AUTHENTICATION_PROVIDER_KEY, StorageScope.APPLICATION);
      } else {
        this.storageService.store(UserDataSyncWorkbenchService.CACHED_AUTHENTICATION_PROVIDER_KEY, currentAuthenticationProviderId, StorageScope.APPLICATION, StorageTarget.MACHINE);
      }
    }
  }
  get currentSessionId() {
    if (this._cachedCurrentSessionId === null) {
      this._cachedCurrentSessionId = this.getStoredCachedSessionId();
    }
    return this._cachedCurrentSessionId;
  }
  set currentSessionId(cachedSessionId) {
    if (this._cachedCurrentSessionId !== cachedSessionId) {
      this._cachedCurrentSessionId = cachedSessionId;
      if (cachedSessionId === void 0) {
        this.logService.info("Settings Sync: Reset current session");
        this.storageService.remove(UserDataSyncWorkbenchService.CACHED_SESSION_STORAGE_KEY, StorageScope.APPLICATION);
      } else {
        this.logService.info("Settings Sync: Updated current session", cachedSessionId);
        this.storageService.store(UserDataSyncWorkbenchService.CACHED_SESSION_STORAGE_KEY, cachedSessionId, StorageScope.APPLICATION, StorageTarget.MACHINE);
      }
    }
  }
  getStoredCachedSessionId() {
    return this.storageService.get(UserDataSyncWorkbenchService.CACHED_SESSION_STORAGE_KEY, StorageScope.APPLICATION);
  }
  get useWorkbenchSessionId() {
    return !this.storageService.getBoolean(UserDataSyncWorkbenchService.DONOT_USE_WORKBENCH_SESSION_STORAGE_KEY, StorageScope.APPLICATION, false);
  }
  set useWorkbenchSessionId(useWorkbenchSession) {
    this.storageService.store(UserDataSyncWorkbenchService.DONOT_USE_WORKBENCH_SESSION_STORAGE_KEY, !useWorkbenchSession, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
};
UserDataSyncWorkbenchService.DONOT_USE_WORKBENCH_SESSION_STORAGE_KEY = "userDataSyncAccount.donotUseWorkbenchSession";
UserDataSyncWorkbenchService.CACHED_AUTHENTICATION_PROVIDER_KEY = "userDataSyncAccountProvider";
UserDataSyncWorkbenchService.CACHED_SESSION_STORAGE_KEY = "userDataSyncAccountPreference";
UserDataSyncWorkbenchService = __decorateClass([
  __decorateParam(0, IUserDataSyncService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IAuthenticationService),
  __decorateParam(3, IUserDataSyncAccountService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IUserDataSyncEnablementService),
  __decorateParam(7, IUserDataAutoSyncService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IBrowserWorkbenchEnvironmentService),
  __decorateParam(12, ISecretStorageService),
  __decorateParam(13, INotificationService),
  __decorateParam(14, IProgressService),
  __decorateParam(15, IDialogService),
  __decorateParam(16, IContextKeyService),
  __decorateParam(17, IViewsService),
  __decorateParam(18, IViewDescriptorService),
  __decorateParam(19, IUserDataSyncStoreManagementService),
  __decorateParam(20, ILifecycleService),
  __decorateParam(21, IInstantiationService),
  __decorateParam(22, IEditorService),
  __decorateParam(23, IUserDataInitializationService),
  __decorateParam(24, IFileService),
  __decorateParam(25, IFileDialogService),
  __decorateParam(26, IUserDataSyncMachinesService)
], UserDataSyncWorkbenchService);
registerSingleton(
  IUserDataSyncWorkbenchService,
  UserDataSyncWorkbenchService,
  InstantiationType.Eager
  /* Eager because it initializes settings sync accounts */
);
export {
  UserDataSyncWorkbenchService,
  isMergeEditorInput
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFTeW5jL2Jyb3dzZXIvdXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElVc2VyRGF0YVN5bmNTZXJ2aWNlLCBJQXV0aGVudGljYXRpb25Qcm92aWRlciwgaXNBdXRoZW50aWNhdGlvblByb3ZpZGVyLCBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCBTeW5jU3RhdHVzLCBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsIElVc2VyRGF0YVN5bmNSZXNvdXJjZSwgSVJlc291cmNlUHJldmlldywgVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBVU0VSX0RBVEFfU1lOQ19MT0dfSUQsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgSVVzZXJEYXRhU3luY0FjY291bnQsIEFjY291bnRTdGF0dXMsIENPTlRFWFRfU1lOQ19FTkFCTEVNRU5ULCBDT05URVhUX1NZTkNfU1RBVEUsIENPTlRFWFRfQUNDT1VOVF9TVEFURSwgU0hPV19TWU5DX0xPR19DT01NQU5EX0lELCBDT05URVhUX0VOQUJMRV9BQ1RJVklUWV9WSUVXUywgU1lOQ19WSUVXX0NPTlRBSU5FUl9JRCwgU1lOQ19USVRMRSwgU1lOQ19DT05GTElDVFNfVklFV19JRCwgQ09OVEVYVF9FTkFCTEVfU1lOQ19DT05GTElDVFNfVklFVywgQ09OVEVYVF9IQVNfQ09ORkxJQ1RTLCBJVXNlckRhdGFTeW5jQ29uZmxpY3RzVmlldywgZ2V0U3luY0FyZWFMYWJlbCB9IGZyb20gJy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZ2V0Q3VycmVudEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkluZm8gfSBmcm9tICcuLi8uLi9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvblNlc3Npb24sIEF1dGhlbnRpY2F0aW9uU2Vzc2lvbnNDaGFuZ2VFdmVudCwgSUF1dGhlbnRpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2F1dGhlbnRpY2F0aW9uL2NvbW1vbi9hdXRoZW50aWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY0FjY291bnQuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UsIElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhU3luY1N0b3JlVHlwZVN5bmNocm9uaXplciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vZ2xvYmFsU3RhdGVTeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IGlzRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhL2Jyb3dzZXIvdXNlckRhdGFJbml0LmpzJztcbmltcG9ydCB7IElTZWNyZXRTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvY29tbW9uL3NlY3JldHMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY01hY2hpbmVzLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbnR5cGUgQWNjb3VudFF1aWNrUGlja0l0ZW0gPSB7IGxhYmVsOiBzdHJpbmc7IGF1dGhlbnRpY2F0aW9uUHJvdmlkZXI6IElBdXRoZW50aWNhdGlvblByb3ZpZGVyOyBhY2NvdW50PzogVXNlckRhdGFTeW5jQWNjb3VudDsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfTtcblxuY2xhc3MgVXNlckRhdGFTeW5jQWNjb3VudCBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNBY2NvdW50IHtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBhdXRoZW50aWNhdGlvblByb3ZpZGVySWQ6IHN0cmluZywgcHJpdmF0ZSByZWFkb25seSBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24pIHsgfVxuXG5cdGdldCBzZXNzaW9uSWQoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc2Vzc2lvbi5pZDsgfVxuXHRnZXQgYWNjb3VudE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc2Vzc2lvbi5hY2NvdW50LmxhYmVsOyB9XG5cdGdldCBhY2NvdW50SWQoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc2Vzc2lvbi5hY2NvdW50LmlkOyB9XG5cdGdldCB0b2tlbigpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5zZXNzaW9uLmlkVG9rZW4gfHwgdGhpcy5zZXNzaW9uLmFjY2Vzc1Rva2VuOyB9XG59XG5cbnR5cGUgTWVyZ2VFZGl0b3JJbnB1dCA9IHsgYmFzZTogVVJJOyBpbnB1dDE6IHsgdXJpOiBVUkkgfTsgaW5wdXQyOiB7IHVyaTogVVJJIH07IHJlc3VsdDogVVJJIH07XG5leHBvcnQgZnVuY3Rpb24gaXNNZXJnZUVkaXRvcklucHV0KGVkaXRvcjogdW5rbm93bik6IGVkaXRvciBpcyBNZXJnZUVkaXRvcklucHV0IHtcblx0Y29uc3QgY2FuZGlkYXRlID0gZWRpdG9yIGFzIE1lcmdlRWRpdG9ySW5wdXQ7XG5cdHJldHVybiBVUkkuaXNVcmkoY2FuZGlkYXRlPy5iYXNlKSAmJiBVUkkuaXNVcmkoY2FuZGlkYXRlPy5pbnB1dDE/LnVyaSkgJiYgVVJJLmlzVXJpKGNhbmRpZGF0ZT8uaW5wdXQyPy51cmkpICYmIFVSSS5pc1VyaShjYW5kaWRhdGU/LnJlc3VsdCk7XG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlIHtcblxuXHRfc2VydmljZUJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgRE9OT1RfVVNFX1dPUktCRU5DSF9TRVNTSU9OX1NUT1JBR0VfS0VZID0gJ3VzZXJEYXRhU3luY0FjY291bnQuZG9ub3RVc2VXb3JrYmVuY2hTZXNzaW9uJztcblx0cHJpdmF0ZSBzdGF0aWMgQ0FDSEVEX0FVVEhFTlRJQ0FUSU9OX1BST1ZJREVSX0tFWSA9ICd1c2VyRGF0YVN5bmNBY2NvdW50UHJvdmlkZXInO1xuXHRwcml2YXRlIHN0YXRpYyBDQUNIRURfU0VTU0lPTl9TVE9SQUdFX0tFWSA9ICd1c2VyRGF0YVN5bmNBY2NvdW50UHJlZmVyZW5jZSc7XG5cblx0Z2V0IGVuYWJsZWQoKSB7IHJldHVybiAhIXRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZTsgfVxuXG5cdHByaXZhdGUgX2F1dGhlbnRpY2F0aW9uUHJvdmlkZXJzOiBJQXV0aGVudGljYXRpb25Qcm92aWRlcltdID0gW107XG5cdGdldCBhdXRoZW50aWNhdGlvblByb3ZpZGVycygpIHsgcmV0dXJuIHRoaXMuX2F1dGhlbnRpY2F0aW9uUHJvdmlkZXJzOyB9XG5cblx0cHJpdmF0ZSBfYWNjb3VudFN0YXR1czogQWNjb3VudFN0YXR1cyA9IEFjY291bnRTdGF0dXMuVW5pbml0aWFsaXplZDtcblx0Z2V0IGFjY291bnRTdGF0dXMoKTogQWNjb3VudFN0YXR1cyB7IHJldHVybiB0aGlzLl9hY2NvdW50U3RhdHVzOyB9XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQWNjb3VudFN0YXR1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEFjY291bnRTdGF0dXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjY291bnRTdGF0dXMgPSB0aGlzLl9vbkRpZENoYW5nZUFjY291bnRTdGF0dXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUdXJuT25TeW5jID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkVHVybk9uU3luYyA9IHRoaXMuX29uRGlkVHVybk9uU3luYy5ldmVudDtcblxuXHRwcml2YXRlIF9jdXJyZW50OiBVc2VyRGF0YVN5bmNBY2NvdW50IHwgdW5kZWZpbmVkO1xuXHRnZXQgY3VycmVudCgpOiBVc2VyRGF0YVN5bmNBY2NvdW50IHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2N1cnJlbnQ7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHN5bmNFbmFibGVtZW50Q29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgc3luY1N0YXR1c0NvbnRleHQ6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgcmVhZG9ubHkgYWNjb3VudFN0YXR1c0NvbnRleHQ6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgcmVhZG9ubHkgZW5hYmxlQ29uZmxpY3RzVmlld0NvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGhhc0NvbmZsaWN0czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZpdHlWaWV3c0VuYWJsZW1lbnRDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHR1cm5PblN5bmNDYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVN5bmNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU2VydmljZTogSVVzZXJEYXRhU3luY1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElBdXRoZW50aWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXRoZW50aWNhdGlvblNlcnZpY2U6IElBdXRoZW50aWNhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNBY2NvdW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlOiBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVNlY3JldFN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2VjcmV0U3RvcmFnZVNlcnZpY2U6IElTZWNyZXRTdG9yYWdlU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlOiBJVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2U6IElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5zeW5jRW5hYmxlbWVudENvbnRleHQgPSBDT05URVhUX1NZTkNfRU5BQkxFTUVOVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc3luY1N0YXR1c0NvbnRleHQgPSBDT05URVhUX1NZTkNfU1RBVEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmFjY291bnRTdGF0dXNDb250ZXh0ID0gQ09OVEVYVF9BQ0NPVU5UX1NUQVRFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5hY3Rpdml0eVZpZXdzRW5hYmxlbWVudENvbnRleHQgPSBDT05URVhUX0VOQUJMRV9BQ1RJVklUWV9WSUVXUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaGFzQ29uZmxpY3RzID0gQ09OVEVYVF9IQVNfQ09ORkxJQ1RTLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5lbmFibGVDb25mbGljdHNWaWV3Q29udGV4dCA9IENPTlRFWFRfRU5BQkxFX1NZTkNfQ09ORkxJQ1RTX1ZJRVcuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmUpIHtcblx0XHRcdHRoaXMuc3luY1N0YXR1c0NvbnRleHQuc2V0KHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5zdGF0dXMpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFTeW5jU2VydmljZS5vbkRpZENoYW5nZVN0YXR1cyhzdGF0dXMgPT4gdGhpcy5zeW5jU3RhdHVzQ29udGV4dC5zZXQoc3RhdHVzKSkpO1xuXHRcdFx0dGhpcy5zeW5jRW5hYmxlbWVudENvbnRleHQuc2V0KHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlRW5hYmxlbWVudChlbmFibGVkID0+IHRoaXMuc3luY0VuYWJsZW1lbnRDb250ZXh0LnNldChlbmFibGVkKSkpO1xuXG5cdFx0XHR0aGlzLndhaXRBbmRJbml0aWFsaXplKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBdXRoZW50aWNhdGlvblByb3ZpZGVycygpOiBib29sZWFuIHtcblx0XHRjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX2F1dGhlbnRpY2F0aW9uUHJvdmlkZXJzO1xuXHRcdHRoaXMuX2F1dGhlbnRpY2F0aW9uUHJvdmlkZXJzID0gKHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZT8uYXV0aGVudGljYXRpb25Qcm92aWRlcnMgfHwgW10pLmZpbHRlcigoeyBpZCB9KSA9PiB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5kZWNsYXJlZFByb3ZpZGVycy5zb21lKHByb3ZpZGVyID0+IHByb3ZpZGVyLmlkID09PSBpZCkpO1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnU2V0dGluZ3MgU3luYzogQXV0aGVudGljYXRpb24gcHJvdmlkZXJzIHVwZGF0ZWQnLCB0aGlzLl9hdXRoZW50aWNhdGlvblByb3ZpZGVycy5tYXAoKHsgaWQgfSkgPT4gaWQpKTtcblx0XHRyZXR1cm4gZXF1YWxzKG9sZFZhbHVlLCB0aGlzLl9hdXRoZW50aWNhdGlvblByb3ZpZGVycywgKGEsIGIpID0+IGEuaWQgPT09IGIuaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1N1cHBvcnRlZEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZChhdXRoZW50aWNhdGlvblByb3ZpZGVySWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLnNvbWUoKHsgaWQgfSkgPT4gaWQgPT09IGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHdhaXRBbmRJbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvKiB3YWl0ICovXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpLCB0aGlzLnVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLndoZW5Jbml0aWFsaXphdGlvbkZpbmlzaGVkKCldKTtcblxuXHRcdFx0LyogaW5pdGlhbGl6ZSAqL1xuXHRcdFx0YXdhaXQgdGhpcy5pbml0aWFsaXplKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIERvIG5vdCBsb2cgaWYgdGhlIGN1cnJlbnQgd2luZG93IGlzIHJ1bm5pbmcgZXh0ZW5zaW9uIHRlc3RzXG5cdFx0XHRpZiAoIXRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzV2ViKSB7XG5cdFx0XHRjb25zdCBhdXRoZW50aWNhdGlvblNlc3Npb24gPSBhd2FpdCBnZXRDdXJyZW50QXV0aGVudGljYXRpb25TZXNzaW9uSW5mbyh0aGlzLnNlY3JldFN0b3JhZ2VTZXJ2aWNlLCB0aGlzLnByb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdGlmICh0aGlzLmN1cnJlbnRTZXNzaW9uSWQgPT09IHVuZGVmaW5lZCAmJiBhdXRoZW50aWNhdGlvblNlc3Npb24/LmlkKSB7XG5cdFx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5zZXR0aW5nc1N5bmNPcHRpb25zPy5hdXRoZW50aWNhdGlvblByb3ZpZGVyICYmIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMuc2V0dGluZ3NTeW5jT3B0aW9ucy5lbmFibGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50U2Vzc2lvbklkID0gYXV0aGVudGljYXRpb25TZXNzaW9uLmlkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuXHRcdFx0XHRlbHNlIGlmICh0aGlzLnVzZVdvcmtiZW5jaFNlc3Npb25JZCkge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudFNlc3Npb25JZCA9IGF1dGhlbnRpY2F0aW9uU2Vzc2lvbi5pZDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVzZVdvcmtiZW5jaFNlc3Npb25JZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGluaXRQcm9taXNlID0gdGhpcy51cGRhdGUoJ2luaXRpYWxpemUnKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5vbkRpZENoYW5nZURlY2xhcmVkUHJvdmlkZXJzKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnVwZGF0ZUF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzKCkpIHtcblx0XHRcdFx0Ly8gVHJpZ2dlciB1cGRhdGUgb25seSBhZnRlciB0aGUgaW5pdGlhbGl6YXRpb24gaXMgZG9uZVxuXHRcdFx0XHRpbml0UHJvbWlzZS5maW5hbGx5KCgpID0+IHRoaXMudXBkYXRlKCdkZWNsYXJlZCBhdXRoZW50aWNhdGlvbiBwcm92aWRlcnMgY2hhbmdlZCcpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0YXdhaXQgaW5pdFByb21pc2U7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIoXG5cdFx0XHRFdmVudC5hbnkoXG5cdFx0XHRcdHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyLFxuXHRcdFx0XHR0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5vbkRpZFVucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyLFxuXHRcdFx0KSwgaW5mbyA9PiB0aGlzLmlzU3VwcG9ydGVkQXV0aGVudGljYXRpb25Qcm92aWRlcklkKGluZm8uaWQpKSgoKSA9PiB0aGlzLnVwZGF0ZSgnYXV0aGVudGljYXRpb24gcHJvdmlkZXIgY2hhbmdlJykpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcih0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLm9uVG9rZW5GYWlsZWQsIGlzU3VjY2Vzc2l2ZSA9PiAhaXNTdWNjZXNzaXZlKSgoKSA9PiB0aGlzLnVwZGF0ZSgndG9rZW4gZmFpbHVyZScpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9ucywgZSA9PiB0aGlzLmlzU3VwcG9ydGVkQXV0aGVudGljYXRpb25Qcm92aWRlcklkKGUucHJvdmlkZXJJZCkpKCh7IGV2ZW50IH0pID0+IHRoaXMub25EaWRDaGFuZ2VTZXNzaW9ucyhldmVudCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLkNBQ0hFRF9TRVNTSU9OX1NUT1JBR0VfS0VZLCB0aGlzLl9zdG9yZSkoKCkgPT4gdGhpcy5vbkRpZENoYW5nZVN0b3JhZ2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcih0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLm9uVG9rZW5GYWlsZWQsIGJhaWxvdXQgPT4gYmFpbG91dCkoKCkgPT4gdGhpcy5vbkRpZEF1dGhGYWlsdXJlKCkpKTtcblx0XHR0aGlzLmhhc0NvbmZsaWN0cy5zZXQodGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNvbmZsaWN0cy5sZW5ndGggPiAwKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRDaGFuZ2VDb25mbGljdHMoY29uZmxpY3RzID0+IHtcblx0XHRcdHRoaXMuaGFzQ29uZmxpY3RzLnNldChjb25mbGljdHMubGVuZ3RoID4gMCk7XG5cdFx0XHRpZiAoIWNvbmZsaWN0cy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5lbmFibGVDb25mbGljdHNWaWV3Q29udGV4dC5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQ2xvc2UgbWVyZ2UgZWRpdG9ycyB3aXRoIG5vIGNvbmZsaWN0c1xuXHRcdFx0dGhpcy5lZGl0b3JTZXJ2aWNlLmVkaXRvcnMuZmlsdGVyKGlucHV0ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVtb3RlUmVzb3VyY2UgPSBpc0RpZmZFZGl0b3JJbnB1dChpbnB1dCkgPyBpbnB1dC5vcmlnaW5hbC5yZXNvdXJjZSA6IGlzTWVyZ2VFZGl0b3JJbnB1dChpbnB1dCkgPyBpbnB1dC5pbnB1dDEudXJpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocmVtb3RlUmVzb3VyY2U/LnNjaGVtZSAhPT0gVVNFUl9EQVRBX1NZTkNfU0NIRU1FKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAhdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNvbmZsaWN0cy5zb21lKCh7IGNvbmZsaWN0cyB9KSA9PiBjb25mbGljdHMuc29tZSgoeyBwcmV2aWV3UmVzb3VyY2UgfSkgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwocHJldmlld1Jlc291cmNlLCBpbnB1dC5yZXNvdXJjZSkpKTtcblx0XHRcdH0pLmZvckVhY2goaW5wdXQgPT4gaW5wdXQuZGlzcG9zZSgpKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZShyZWFzb246IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgU2V0dGluZ3MgU3luYzogVXBkYXRpbmcgZHVlIHRvICR7cmVhc29ufWApO1xuXG5cdFx0dGhpcy51cGRhdGVBdXRoZW50aWNhdGlvblByb3ZpZGVycygpO1xuXHRcdGF3YWl0IHRoaXMudXBkYXRlQ3VycmVudEFjY291bnQoKTtcblxuXHRcdGlmICh0aGlzLl9jdXJyZW50KSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSB0aGlzLl9jdXJyZW50LmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnVwZGF0ZVRva2VuKHRoaXMuX2N1cnJlbnQpO1xuXHRcdHRoaXMudXBkYXRlQWNjb3VudFN0YXR1cyh0aGlzLl9jdXJyZW50ID8gQWNjb3VudFN0YXR1cy5BdmFpbGFibGUgOiBBY2NvdW50U3RhdHVzLlVuYXZhaWxhYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlQ3VycmVudEFjY291bnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdTZXR0aW5ncyBTeW5jOiBVcGRhdGluZyB0aGUgY3VycmVudCBhY2NvdW50Jyk7XG5cdFx0Y29uc3QgY3VycmVudFNlc3Npb25JZCA9IHRoaXMuY3VycmVudFNlc3Npb25JZDtcblx0XHRjb25zdCBjdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkID0gdGhpcy5jdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkO1xuXHRcdGlmIChjdXJyZW50U2Vzc2lvbklkKSB7XG5cdFx0XHRjb25zdCBhdXRoZW50aWNhdGlvblByb3ZpZGVycyA9IGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPyB0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLmZpbHRlcigoeyBpZCB9KSA9PiBpZCA9PT0gY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCkgOiB0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzO1xuXHRcdFx0Zm9yIChjb25zdCB7IGlkLCBzY29wZXMgfSBvZiBhdXRoZW50aWNhdGlvblByb3ZpZGVycykge1xuXHRcdFx0XHRjb25zdCBzZXNzaW9ucyA9IChhd2FpdCB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRTZXNzaW9ucyhpZCwgc2NvcGVzKSkgfHwgW107XG5cdFx0XHRcdGZvciAoY29uc3Qgc2Vzc2lvbiBvZiBzZXNzaW9ucykge1xuXHRcdFx0XHRcdGlmIChzZXNzaW9uLmlkID09PSBjdXJyZW50U2Vzc2lvbklkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jdXJyZW50ID0gbmV3IFVzZXJEYXRhU3luY0FjY291bnQoaWQsIHNlc3Npb24pO1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdTZXR0aW5ncyBTeW5jOiBVcGRhdGVkIHRoZSBjdXJyZW50IGFjY291bnQnLCB0aGlzLl9jdXJyZW50LmFjY291bnROYW1lKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlVG9rZW4oY3VycmVudDogVXNlckRhdGFTeW5jQWNjb3VudCB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCB2YWx1ZTogeyB0b2tlbjogc3RyaW5nOyBhdXRoZW50aWNhdGlvblByb3ZpZGVySWQ6IHN0cmluZyB9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChjdXJyZW50KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1NldHRpbmdzIFN5bmM6IFVwZGF0aW5nIHRoZSB0b2tlbiBmb3IgdGhlIGFjY291bnQnLCBjdXJyZW50LmFjY291bnROYW1lKTtcblx0XHRcdFx0Y29uc3QgdG9rZW4gPSBjdXJyZW50LnRva2VuO1xuXHRcdFx0XHR0aGlzLnRyYWNlT3JJbmZvKCdTZXR0aW5ncyBTeW5jOiBUb2tlbiB1cGRhdGVkIGZvciB0aGUgYWNjb3VudCcsIGN1cnJlbnQuYWNjb3VudE5hbWUpO1xuXHRcdFx0XHR2YWx1ZSA9IHsgdG9rZW4sIGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDogY3VycmVudC5hdXRoZW50aWNhdGlvblByb3ZpZGVySWQgfTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLnVwZGF0ZUFjY291bnQodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZU9ySW5mbyhtc2c6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8obXNnLCAuLi5hcmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKG1zZywgLi4uYXJncyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBY2NvdW50U3RhdHVzKGFjY291bnRTdGF0dXM6IEFjY291bnRTdGF0dXMpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFNldHRpbmdzIFN5bmM6IFVwZGF0aW5nIHRoZSBhY2NvdW50IHN0YXR1cyB0byAke2FjY291bnRTdGF0dXN9YCk7XG5cdFx0aWYgKHRoaXMuX2FjY291bnRTdGF0dXMgIT09IGFjY291bnRTdGF0dXMpIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5fYWNjb3VudFN0YXR1cztcblx0XHRcdHRoaXMudHJhY2VPckluZm8oYFNldHRpbmdzIFN5bmM6IEFjY291bnQgc3RhdHVzIGNoYW5nZWQgZnJvbSAke3ByZXZpb3VzfSB0byAke2FjY291bnRTdGF0dXN9YCk7XG5cblx0XHRcdHRoaXMuX2FjY291bnRTdGF0dXMgPSBhY2NvdW50U3RhdHVzO1xuXHRcdFx0dGhpcy5hY2NvdW50U3RhdHVzQ29udGV4dC5zZXQoYWNjb3VudFN0YXR1cyk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjY291bnRTdGF0dXMuZmlyZShhY2NvdW50U3RhdHVzKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB0dXJuT24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdubyBhdXRoZW50aWNhdGlvbiBwcm92aWRlcnMnLCBcIlNldHRpbmdzIHN5bmMgY2Fubm90IGJlIHR1cm5lZCBvbiBiZWNhdXNlIHRoZXJlIGFyZSBubyBhdXRoZW50aWNhdGlvbiBwcm92aWRlcnMgYXZhaWxhYmxlLlwiKSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uuc3RhdHVzICE9PSBTeW5jU3RhdHVzLklkbGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHR1cm4gb24gc3luYyB3aGlsZSBzeW5jaW5nJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlja2VkID0gYXdhaXQgdGhpcy5waWNrKCk7XG5cdFx0aWYgKCFwaWNrZWQpIHtcblx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdH1cblxuXHRcdC8vIFVzZXIgZGlkIG5vdCBwaWNrIGFuIGFjY291bnQgb3IgbG9naW4gZmFpbGVkXG5cdFx0aWYgKHRoaXMuYWNjb3VudFN0YXR1cyAhPT0gQWNjb3VudFN0YXR1cy5BdmFpbGFibGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm8gYWNjb3VudCcsIFwiTm8gYWNjb3VudCBhdmFpbGFibGVcIikpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHR1cm5PblN5bmNDYW5jZWxsYXRpb25Ub2tlbiA9IHRoaXMudHVybk9uU3luY0NhbmNlbGxhdGlvblRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGlzV2ViID8gRGlzcG9zYWJsZS5Ob25lIDogdGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oZSA9PiBlLnZldG8oKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3N5bmMgaW4gcHJvZ3Jlc3MnLCBcIlNldHRpbmdzIFN5bmMgaXMgYmVpbmcgdHVybmVkIG9uLiBXb3VsZCB5b3UgbGlrZSB0byBjYW5jZWwgaXQ/XCIpLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3NldHRpbmdzIHN5bmMnLCBcIlNldHRpbmdzIFN5bmNcIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAneWVzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmWWVzXCIpLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IGxvY2FsaXplKCdubycsIFwiTm9cIilcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHR0dXJuT25TeW5jQ2FuY2VsbGF0aW9uVG9rZW4uY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gIWNvbmZpcm1lZDtcblx0XHR9KSgpLCAndmV0by5zZXR0aW5nc1N5bmMnKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZG9UdXJuT25TeW5jKHR1cm5PblN5bmNDYW5jZWxsYXRpb25Ub2tlbi50b2tlbik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy50dXJuT25TeW5jQ2FuY2VsbGF0aW9uVG9rZW4gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMudXNlckRhdGFBdXRvU3luY1NlcnZpY2UudHVybk9uKCk7XG5cblx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlPy5jYW5Td2l0Y2gpIHtcblx0XHRcdGF3YWl0IHRoaXMuc3luY2hyb25pc2VVc2VyRGF0YVN5bmNTdG9yZVR5cGUoKTtcblx0XHR9XG5cblx0XHR0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSB0aGlzLmN1cnJlbnQ/LmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDtcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8uc2V0dGluZ3NTeW5jT3B0aW9ucz8uZW5hYmxlbWVudEhhbmRsZXIgJiYgdGhpcy5jdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkKSB7XG5cdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zLnNldHRpbmdzU3luY09wdGlvbnMuZW5hYmxlbWVudEhhbmRsZXIodHJ1ZSwgdGhpcy5jdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkKTtcblx0XHR9XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuaW5mbyhsb2NhbGl6ZSgnc3luYyB0dXJuZWQgb24nLCBcInswfSBpcyB0dXJuZWQgb25cIiwgU1lOQ19USVRMRS52YWx1ZSkpO1xuXHRcdHRoaXMuX29uRGlkVHVybk9uU3luYy5maXJlKCk7XG5cdH1cblxuXHRhc3luYyB0dXJub2ZmKGV2ZXJ5d2hlcmU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YUF1dG9TeW5jU2VydmljZS50dXJuT2ZmKGV2ZXJ5d2hlcmUpO1xuXHRcdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LnNldHRpbmdzU3luY09wdGlvbnM/LmVuYWJsZW1lbnRIYW5kbGVyICYmIHRoaXMuY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCkge1xuXHRcdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zLnNldHRpbmdzU3luY09wdGlvbnMuZW5hYmxlbWVudEhhbmRsZXIoZmFsc2UsIHRoaXMuY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLnR1cm5PblN5bmNDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdFx0dGhpcy50dXJuT25TeW5jQ2FuY2VsbGF0aW9uVG9rZW4uY2FuY2VsKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc3luY2hyb25pc2VVc2VyRGF0YVN5bmNTdG9yZVR5cGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLmFjY291bnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVwZGF0ZSBiZWNhdXNlIHlvdSBhcmUgc2lnbmVkIG91dCBmcm9tIHNldHRpbmdzIHN5bmMuIFBsZWFzZSBzaWduIGluIGFuZCB0cnkgYWdhaW4uJyk7XG5cdFx0fVxuXHRcdGlmICghaXNXZWIgfHwgIXRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZSkge1xuXHRcdFx0Ly8gTm90IHN1cHBvcnRlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlVXJsID0gdGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlLnR5cGUgPT09ICdpbnNpZGVycycgPyB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmUuc3RhYmxlVXJsIDogdGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlLmluc2lkZXJzVXJsO1xuXHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCwgdXNlckRhdGFTeW5jU3RvcmVVcmwpO1xuXHRcdHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50LnNldEF1dGhUb2tlbih0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLmFjY291bnQudG9rZW4sIHRoaXMudXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UuYWNjb3VudC5hdXRoZW50aWNhdGlvblByb3ZpZGVySWQpO1xuXHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jU3RvcmVUeXBlU3luY2hyb25pemVyLCB1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCkuc3luYyh0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmUudHlwZSk7XG5cdH1cblxuXHRzeW5jTm93KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLnRyaWdnZXJTeW5jKFsnU3luYyBOb3cnXSwgeyBpbW1lZGlhdGVseTogdHJ1ZSwgZGlzYWJsZUNhY2hlOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1R1cm5PblN5bmModG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbWFudWFsU3luY1Rhc2sgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuY3JlYXRlTWFudWFsU3luY1Rhc2soKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LFxuXHRcdFx0XHR0aXRsZTogU1lOQ19USVRMRS52YWx1ZSxcblx0XHRcdFx0Y29tbWFuZDogU0hPV19TWU5DX0xPR19DT01NQU5EX0lELFxuXHRcdFx0XHRkZWxheTogNTAwLFxuXHRcdFx0fSwgYXN5bmMgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgndHVybmluZyBvbicsIFwiVHVybmluZyBvbi4uLlwiKSB9KTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5vbkRpZENoYW5nZVN0YXR1cyhzdGF0dXMgPT4ge1xuXHRcdFx0XHRcdGlmIChzdGF0dXMgPT09IFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKSB7XG5cdFx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgncmVzb2x2aW5nIGNvbmZsaWN0cycsIFwiUmVzb2x2aW5nIGNvbmZsaWN0cy4uLlwiKSB9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbG9jYWxpemUoJ3N5bmNpbmcuLi4nLCBcIlR1cm5pbmcgb24uLi5cIikgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGF3YWl0IG1hbnVhbFN5bmNUYXNrLm1lcmdlKCk7XG5cdFx0XHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uuc3RhdHVzID09PSBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cykge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuaGFuZGxlQ29uZmxpY3RzV2hpbGVUdXJuaW5nT24odG9rZW4pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IG1hbnVhbFN5bmNUYXNrLmFwcGx5KCk7XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0YXdhaXQgbWFudWFsU3luY1Rhc2suc3RvcCgpO1xuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZUNvbmZsaWN0c1doaWxlVHVybmluZ09uKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZsaWN0cyA9IHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5jb25mbGljdHM7XG5cdFx0Y29uc3QgYW5kU2VwYXJhdG9yID0gbG9jYWxpemUoJ2FuZCcsICcgYW5kICcpO1xuXHRcdGxldCBjb25mbGljdHNUZXh0ID0gJyc7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb25mbGljdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChpID09PSBjb25mbGljdHMubGVuZ3RoIC0gMSAmJiBpICE9PSAwKSB7XG5cdFx0XHRcdGNvbmZsaWN0c1RleHQgKz0gYW5kU2VwYXJhdG9yO1xuXHRcdFx0fSBlbHNlIGlmIChpICE9PSAwKSB7XG5cdFx0XHRcdGNvbmZsaWN0c1RleHQgKz0gJywgJztcblx0XHRcdH1cblx0XHRcdGNvbmZsaWN0c1RleHQgKz0gZ2V0U3luY0FyZWFMYWJlbChjb25mbGljdHNbaV0uc3luY1Jlc291cmNlKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2luZ2xlQ29uZmxpY3RSZXNvdXJjZSA9IGNvbmZsaWN0cy5sZW5ndGggPT09IDEgPyBnZXRTeW5jQXJlYUxhYmVsKGNvbmZsaWN0c1swXS5zeW5jUmVzb3VyY2UpIDogdW5kZWZpbmVkO1xuXHRcdGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdjb25mbGljdHMgZGV0ZWN0ZWQnLCBcIkNvbmZsaWN0cyBEZXRlY3RlZCBpbiB7MH1cIiwgY29uZmxpY3RzVGV4dCksXG5cdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdyZXNvbHZlJywgXCJQbGVhc2UgcmVzb2x2ZSBjb25mbGljdHMgdG8gdHVybiBvbi4uLlwiKSxcblx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ3Nob3cgY29uZmxpY3RzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2hvdyBDb25mbGljdHNcIiksXG5cdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB3YWl0VW50aWxDb25mbGljdHNBcmVSZXNvbHZlZFByb21pc2UgPSByYWNlQ2FuY2VsbGF0aW9uRXJyb3IoRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZpbHRlcih0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRDaGFuZ2VDb25mbGljdHMsIGNvbmZpY3RzID0+IGNvbmZpY3RzLmxlbmd0aCA9PT0gMCkpLCB0b2tlbik7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnNob3dDb25mbGljdHModGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNvbmZsaWN0c1swXT8uY29uZmxpY3RzWzBdKTtcblx0XHRcdFx0XHRcdGF3YWl0IHdhaXRVbnRpbENvbmZsaWN0c0FyZVJlc29sdmVkUHJvbWlzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogc2luZ2xlQ29uZmxpY3RSZXNvdXJjZSA/IGxvY2FsaXplKHsga2V5OiAncmVwbGFjZSBsb2NhbCBzaW5nbGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQWNjZXB0ICYmUmVtb3RlIHswfVwiLCBzaW5nbGVDb25mbGljdFJlc291cmNlKSA6IGxvY2FsaXplKHsga2V5OiAncmVwbGFjZSBsb2NhbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJBY2NlcHQgJiZSZW1vdGVcIiksXG5cdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB0aGlzLnJlcGxhY2UodHJ1ZSlcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBzaW5nbGVDb25mbGljdFJlc291cmNlID8gbG9jYWxpemUoeyBrZXk6ICdyZXBsYWNlIHJlbW90ZSBzaW5nbGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQWNjZXB0ICYmTG9jYWwgezB9XCIsIHNpbmdsZUNvbmZsaWN0UmVzb3VyY2UpIDogbG9jYWxpemUoeyBrZXk6ICdyZXBsYWNlIHJlbW90ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJBY2NlcHQgJiZMb2NhbFwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMucmVwbGFjZShmYWxzZSlcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVwbGFjZShsb2NhbDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZvciAoY29uc3QgY29uZmxpY3Qgb2YgdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNvbmZsaWN0cykge1xuXHRcdFx0Zm9yIChjb25zdCBwcmV2aWV3IG9mIGNvbmZsaWN0LmNvbmZsaWN0cykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFjY2VwdCh7IHN5bmNSZXNvdXJjZTogY29uZmxpY3Quc3luY1Jlc291cmNlLCBwcm9maWxlOiBjb25mbGljdC5wcm9maWxlIH0sIGxvY2FsID8gcHJldmlldy5yZW1vdGVSZXNvdXJjZSA6IHByZXZpZXcubG9jYWxSZXNvdXJjZSwgdW5kZWZpbmVkLCB7IGZvcmNlOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGFjY2VwdChyZXNvdXJjZTogSVVzZXJEYXRhU3luY1Jlc291cmNlLCBjb25mbGljdFJlc291cmNlOiBVUkksIGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGFwcGx5OiBib29sZWFuIHwgeyBmb3JjZTogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5hY2NlcHQocmVzb3VyY2UsIGNvbmZsaWN0UmVzb3VyY2UsIGNvbnRlbnQsIGFwcGx5KTtcblx0fVxuXG5cdGFzeW5jIHNob3dDb25mbGljdHMoY29uZmxpY3RUb09wZW4/OiBJUmVzb3VyY2VQcmV2aWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuY29uZmxpY3RzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmVuYWJsZUNvbmZsaWN0c1ZpZXdDb250ZXh0LnNldCh0cnVlKTtcblx0XHRjb25zdCB2aWV3ID0gYXdhaXQgdGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXc8SVVzZXJEYXRhU3luY0NvbmZsaWN0c1ZpZXc+KFNZTkNfQ09ORkxJQ1RTX1ZJRVdfSUQpO1xuXHRcdGlmICh2aWV3ICYmIGNvbmZsaWN0VG9PcGVuKSB7XG5cdFx0XHRhd2FpdCB2aWV3Lm9wZW4oY29uZmxpY3RUb09wZW4pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlc2V0U3luY2VkRGF0YSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Jlc2V0JywgXCJUaGlzIHdpbGwgY2xlYXIgeW91ciBkYXRhIGluIHRoZSBjbG91ZCBhbmQgc3RvcCBzeW5jIG9uIGFsbCB5b3VyIGRldmljZXMuXCIpLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZXNldCB0aXRsZScsIFwiQ2xlYXJcIiksXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3Jlc2V0QnV0dG9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVzZXRcIiksXG5cdFx0fSk7XG5cdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLnJlc2V0UmVtb3RlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0QWxsTG9nUmVzb3VyY2VzKCk6IFByb21pc2U8VVJJW10+IHtcblx0XHRjb25zdCBsb2dzRm9sZGVyczogVVJJW10gPSBbXTtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5kaXJuYW1lKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmxvZ3NIb21lKSk7XG5cdFx0aWYgKHN0YXQuY2hpbGRyZW4pIHtcblx0XHRcdGxvZ3NGb2xkZXJzLnB1c2goLi4uc3RhdC5jaGlsZHJlblxuXHRcdFx0XHQuZmlsdGVyKHN0YXQgPT4gc3RhdC5pc0RpcmVjdG9yeSAmJiAvXlxcZHs4fVRcXGR7Nn0kLy50ZXN0KHN0YXQubmFtZSkpXG5cdFx0XHRcdC5zb3J0KClcblx0XHRcdFx0LnJldmVyc2UoKVxuXHRcdFx0XHQubWFwKGQgPT4gZC5yZXNvdXJjZSkpO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IFVSSVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBsb2dGb2xkZXIgb2YgbG9nc0ZvbGRlcnMpIHtcblx0XHRcdGNvbnN0IGZvbGRlclN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUobG9nRm9sZGVyKTtcblx0XHRcdGNvbnN0IGNoaWxkU3RhdCA9IGZvbGRlclN0YXQuY2hpbGRyZW4/LmZpbmQoc3RhdCA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuYmFzZW5hbWUoc3RhdC5yZXNvdXJjZSkuc3RhcnRzV2l0aChgJHtVU0VSX0RBVEFfU1lOQ19MT0dfSUR9LmApKTtcblx0XHRcdGlmIChjaGlsZFN0YXQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goY2hpbGRTdGF0LnJlc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jIHNob3dTeW5jQWN0aXZpdHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5hY3Rpdml0eVZpZXdzRW5hYmxlbWVudENvbnRleHQuc2V0KHRydWUpO1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvckFjdGl2ZVN5bmNWaWV3cygpO1xuXHRcdGF3YWl0IHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3Q29udGFpbmVyKFNZTkNfVklFV19DT05UQUlORVJfSUQpO1xuXHR9XG5cblx0YXN5bmMgZG93bmxvYWRTeW5jQWN0aXZpdHkoKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHtcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZG93bmxvYWQgc3luYyBhY3Rpdml0eSBkaWFsb2cgdGl0bGUnLCBcIlNlbGVjdCBmb2xkZXIgdG8gZG93bmxvYWQgU2V0dGluZ3MgU3luYyBhY3Rpdml0eVwiKSxcblx0XHRcdGNhblNlbGVjdEZpbGVzOiBmYWxzZSxcblx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IHRydWUsXG5cdFx0XHRjYW5TZWxlY3RNYW55OiBmYWxzZSxcblx0XHRcdG9wZW5MYWJlbDogbG9jYWxpemUoJ2Rvd25sb2FkIHN5bmMgYWN0aXZpdHkgZGlhbG9nIG9wZW4gbGFiZWwnLCBcIlNhdmVcIiksXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3VsdD8uWzBdKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtYWNoaW5lcyA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLmdldE1hY2hpbmVzKCk7XG5cdFx0XHRjb25zdCBjdXJyZW50TWFjaGluZSA9IG1hY2hpbmVzLmZpbmQobSA9PiBtLmlzQ3VycmVudCk7XG5cdFx0XHRjb25zdCBuYW1lID0gKGN1cnJlbnRNYWNoaW5lID8gY3VycmVudE1hY2hpbmUubmFtZSArICcgLSAnIDogJycpICsgJ1NldHRpbmdzIFN5bmMgQWN0aXZpdHknO1xuXHRcdFx0Y29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZShyZXN1bHRbMF0pO1xuXG5cdFx0XHRjb25zdCBuYW1lUmVnRXggPSBuZXcgUmVnRXhwKGAke2VzY2FwZVJlZ0V4cENoYXJhY3RlcnMobmFtZSl9XFxcXHMoXFxcXGQrKWApO1xuXHRcdFx0Y29uc3QgaW5kZXhlczogbnVtYmVyW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygc3RhdC5jaGlsZHJlbiA/PyBbXSkge1xuXHRcdFx0XHRpZiAoY2hpbGQubmFtZSA9PT0gbmFtZSkge1xuXHRcdFx0XHRcdGluZGV4ZXMucHVzaCgwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBtYXRjaGVzID0gbmFtZVJlZ0V4LmV4ZWMoY2hpbGQubmFtZSk7XG5cdFx0XHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0XHRcdGluZGV4ZXMucHVzaChwYXJzZUludChtYXRjaGVzWzFdKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpbmRleGVzLnNvcnQoKGEsIGIpID0+IGEgLSBiKTtcblxuXHRcdFx0Y29uc3QgZm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmpvaW5QYXRoKHJlc3VsdFswXSwgaW5kZXhlc1swXSAhPT0gMCA/IG5hbWUgOiBgJHtuYW1lfSAke2luZGV4ZXNbaW5kZXhlcy5sZW5ndGggLSAxXSArIDF9YCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5zYXZlUmVtb3RlQWN0aXZpdHlEYXRhKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aChmb2xkZXIsICdyZW1vdGVBY3Rpdml0eS5qc29uJykpLFxuXHRcdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGxvZ1Jlc291cmNlcyA9IGF3YWl0IHRoaXMuZ2V0QWxsTG9nUmVzb3VyY2VzKCk7XG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwobG9nUmVzb3VyY2VzLm1hcChhc3luYyBsb2dSZXNvdXJjZSA9PiB0aGlzLmZpbGVTZXJ2aWNlLmNvcHkobG9nUmVzb3VyY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aChmb2xkZXIsICdsb2dzJywgYCR7dGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmJhc2VuYW1lKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5kaXJuYW1lKGxvZ1Jlc291cmNlKSl9LmxvZ2ApKSkpO1xuXHRcdFx0XHR9KSgpLFxuXHRcdFx0XHR0aGlzLmZpbGVTZXJ2aWNlLmNvcHkodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmpvaW5QYXRoKGZvbGRlciwgJ2xvY2FsQWN0aXZpdHknKSksXG5cdFx0XHRdKTtcblx0XHRcdHJldHVybiBmb2xkZXI7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHdhaXRGb3JBY3RpdmVTeW5jVmlld3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKFNZTkNfVklFV19DT05UQUlORVJfSUQpO1xuXHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRcdGlmICghbW9kZWwuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKG1vZGVsLm9uRGlkQ2hhbmdlQWN0aXZlVmlld0Rlc2NyaXB0b3JzLCBlID0+IG1vZGVsLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGggPiAwKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc2lnbkluKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSB0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQ7XG5cdFx0Y29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlciA9IGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPyB0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLmZpbmQocCA9PiBwLmlkID09PSBjdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoYXV0aGVudGljYXRpb25Qcm92aWRlcikge1xuXHRcdFx0YXdhaXQgdGhpcy5kb1NpZ25JbihhdXRoZW50aWNhdGlvblByb3ZpZGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKCF0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLmxlbmd0aCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vIGF1dGhlbnRpY2F0aW9uIHByb3ZpZGVycyBkdXJpbmcgc2lnbmluJywgXCJDYW5ub3Qgc2lnbiBpbiBiZWNhdXNlIHRoZXJlIGFyZSBubyBhdXRoZW50aWNhdGlvbiBwcm92aWRlcnMgYXZhaWxhYmxlLlwiKSk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnBpY2soKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHBpY2soKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kb1BpY2soKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLmRvU2lnbkluKHJlc3VsdCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUGljaygpOiBQcm9taXNlPFVzZXJEYXRhU3luY0FjY291bnQgfCBJQXV0aGVudGljYXRpb25Qcm92aWRlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRoZW50aWNhdGlvblByb3ZpZGVycyA9IFsuLi50aGlzLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzXS5zb3J0KCh7IGlkIH0pID0+IGlkID09PSB0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPyAtMSA6IDEpO1xuXHRcdGNvbnN0IGFsbEFjY291bnRzID0gbmV3IE1hcDxzdHJpbmcsIFVzZXJEYXRhU3luY0FjY291bnRbXT4oKTtcblxuXHRcdGlmIChhdXRoZW50aWNhdGlvblByb3ZpZGVycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbnN0IGFjY291bnRzID0gYXdhaXQgdGhpcy5nZXRBY2NvdW50cyhhdXRoZW50aWNhdGlvblByb3ZpZGVyc1swXS5pZCwgYXV0aGVudGljYXRpb25Qcm92aWRlcnNbMF0uc2NvcGVzKTtcblx0XHRcdGlmIChhY2NvdW50cy5sZW5ndGgpIHtcblx0XHRcdFx0YWxsQWNjb3VudHMuc2V0KGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzWzBdLmlkLCBhY2NvdW50cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBTaW5nbGUgYXV0aCBwcm92aWRlciBhbmQgbm8gYWNjb3VudHNcblx0XHRcdFx0cmV0dXJuIGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzWzBdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ6IFVzZXJEYXRhU3luY0FjY291bnQgfCBJQXV0aGVudGljYXRpb25Qcm92aWRlciB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxBY2NvdW50UXVpY2tQaWNrSXRlbT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pKTtcblxuXHRcdGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZTxVc2VyRGF0YVN5bmNBY2NvdW50IHwgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXIgfCB1bmRlZmluZWQ+KGMgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGMocmVzdWx0KTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHF1aWNrUGljay50aXRsZSA9IFNZTkNfVElUTEUudmFsdWU7XG5cdFx0cXVpY2tQaWNrLm9rID0gZmFsc2U7XG5cdFx0cXVpY2tQaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnY2hvb3NlIGFjY291bnQgcGxhY2Vob2xkZXInLCBcIlNlbGVjdCBhbiBhY2NvdW50IHRvIHNpZ24gaW5cIik7XG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblxuXHRcdGlmIChhdXRoZW50aWNhdGlvblByb3ZpZGVycy5sZW5ndGggPiAxKSB7XG5cdFx0XHRxdWlja1BpY2suYnVzeSA9IHRydWU7XG5cdFx0XHRmb3IgKGNvbnN0IHsgaWQsIHNjb3BlcyB9IG9mIGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IGFjY291bnRzID0gYXdhaXQgdGhpcy5nZXRBY2NvdW50cyhpZCwgc2NvcGVzKTtcblx0XHRcdFx0aWYgKGFjY291bnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGFsbEFjY291bnRzLnNldChpZCwgYWNjb3VudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRxdWlja1BpY2suYnVzeSA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdHF1aWNrUGljay5pdGVtcyA9IHRoaXMuY3JlYXRlUXVpY2twaWNrSXRlbXMoYXV0aGVudGljYXRpb25Qcm92aWRlcnMsIGFsbEFjY291bnRzKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdHJlc3VsdCA9IHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdPy5hY2NvdW50ID8gcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0/LmFjY291bnQgOiBxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXT8uYXV0aGVudGljYXRpb25Qcm92aWRlcjtcblx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEFjY291bnRzKGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxVc2VyRGF0YVN5bmNBY2NvdW50W10+IHtcblx0XHRjb25zdCBhY2NvdW50czogTWFwPHN0cmluZywgVXNlckRhdGFTeW5jQWNjb3VudD4gPSBuZXcgTWFwPHN0cmluZywgVXNlckRhdGFTeW5jQWNjb3VudD4oKTtcblx0XHRsZXQgY3VycmVudEFjY291bnQ6IFVzZXJEYXRhU3luY0FjY291bnQgfCBudWxsID0gbnVsbDtcblxuXHRcdGNvbnN0IHNlc3Npb25zID0gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0U2Vzc2lvbnMoYXV0aGVudGljYXRpb25Qcm92aWRlcklkLCBzY29wZXMpIHx8IFtdO1xuXHRcdGZvciAoY29uc3Qgc2Vzc2lvbiBvZiBzZXNzaW9ucykge1xuXHRcdFx0Y29uc3QgYWNjb3VudDogVXNlckRhdGFTeW5jQWNjb3VudCA9IG5ldyBVc2VyRGF0YVN5bmNBY2NvdW50KGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCwgc2Vzc2lvbik7XG5cdFx0XHRhY2NvdW50cy5zZXQoYWNjb3VudC5hY2NvdW50SWQsIGFjY291bnQpO1xuXHRcdFx0aWYgKGFjY291bnQuc2Vzc2lvbklkID09PSB0aGlzLmN1cnJlbnRTZXNzaW9uSWQpIHtcblx0XHRcdFx0Y3VycmVudEFjY291bnQgPSBhY2NvdW50O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChjdXJyZW50QWNjb3VudCkge1xuXHRcdFx0Ly8gQWx3YXlzIHVzZSBjdXJyZW50IGFjY291bnQgaWYgYXZhaWxhYmxlXG5cdFx0XHRhY2NvdW50cy5zZXQoY3VycmVudEFjY291bnQuYWNjb3VudElkLCBjdXJyZW50QWNjb3VudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN1cnJlbnRBY2NvdW50ID8gWy4uLmFjY291bnRzLnZhbHVlcygpXSA6IFsuLi5hY2NvdW50cy52YWx1ZXMoKV0uc29ydCgoeyBzZXNzaW9uSWQgfSkgPT4gc2Vzc2lvbklkID09PSB0aGlzLmN1cnJlbnRTZXNzaW9uSWQgPyAtMSA6IDEpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVRdWlja3BpY2tJdGVtcyhhdXRoZW50aWNhdGlvblByb3ZpZGVyczogSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXJbXSwgYWxsQWNjb3VudHM6IE1hcDxzdHJpbmcsIFVzZXJEYXRhU3luY0FjY291bnRbXT4pOiAoQWNjb3VudFF1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdIHtcblx0XHRjb25zdCBxdWlja1BpY2tJdGVtczogKEFjY291bnRRdWlja1BpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IFtdO1xuXG5cdFx0Ly8gU2lnbmVkIGluIEFjY291bnRzXG5cdFx0aWYgKGFsbEFjY291bnRzLnNpemUpIHtcblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdzaWduZWQgaW4nLCBcIlNpZ25lZCBpblwiKSB9KTtcblx0XHRcdGZvciAoY29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlciBvZiBhdXRoZW50aWNhdGlvblByb3ZpZGVycykge1xuXHRcdFx0XHRjb25zdCBhY2NvdW50cyA9IChhbGxBY2NvdW50cy5nZXQoYXV0aGVudGljYXRpb25Qcm92aWRlci5pZCkgfHwgW10pLnNvcnQoKHsgc2Vzc2lvbklkIH0pID0+IHNlc3Npb25JZCA9PT0gdGhpcy5jdXJyZW50U2Vzc2lvbklkID8gLTEgOiAxKTtcblx0XHRcdFx0Y29uc3QgcHJvdmlkZXJOYW1lID0gdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIoYXV0aGVudGljYXRpb25Qcm92aWRlci5pZCkubGFiZWw7XG5cdFx0XHRcdGZvciAoY29uc3QgYWNjb3VudCBvZiBhY2NvdW50cykge1xuXHRcdFx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0bGFiZWw6IGAke2FjY291bnQuYWNjb3VudE5hbWV9ICgke3Byb3ZpZGVyTmFtZX0pYCxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBhY2NvdW50LnNlc3Npb25JZCA9PT0gdGhpcy5jdXJyZW50Py5zZXNzaW9uSWQgPyBsb2NhbGl6ZSgnbGFzdCB1c2VkJywgXCJMYXN0IFVzZWQgd2l0aCBTeW5jXCIpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0YWNjb3VudCxcblx0XHRcdFx0XHRcdGF1dGhlbnRpY2F0aW9uUHJvdmlkZXIsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdvdGhlcnMnLCBcIk90aGVyc1wiKSB9KTtcblx0XHR9XG5cblx0XHQvLyBBY2NvdW50IFByb3ZpZGVyc1xuXHRcdGZvciAoY29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlciBvZiBhdXRoZW50aWNhdGlvblByb3ZpZGVycykge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRQcm92aWRlcihhdXRoZW50aWNhdGlvblByb3ZpZGVyLmlkKTtcblx0XHRcdGlmICghYWxsQWNjb3VudHMuaGFzKGF1dGhlbnRpY2F0aW9uUHJvdmlkZXIuaWQpIHx8IHByb3ZpZGVyLnN1cHBvcnRzTXVsdGlwbGVBY2NvdW50cykge1xuXHRcdFx0XHRjb25zdCBwcm92aWRlck5hbWUgPSBwcm92aWRlci5sYWJlbDtcblx0XHRcdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7IGxhYmVsOiBsb2NhbGl6ZSgnc2lnbiBpbiB1c2luZyBhY2NvdW50JywgXCJTaWduIGluIHdpdGggezB9XCIsIHByb3ZpZGVyTmFtZSksIGF1dGhlbnRpY2F0aW9uUHJvdmlkZXIgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHF1aWNrUGlja0l0ZW1zO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1NpZ25JbihhY2NvdW50T3JBdXRoUHJvdmlkZXI6IFVzZXJEYXRhU3luY0FjY291bnQgfCBJQXV0aGVudGljYXRpb25Qcm92aWRlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBzZXNzaW9uSWQ6IHN0cmluZztcblx0XHRpZiAoaXNBdXRoZW50aWNhdGlvblByb3ZpZGVyKGFjY291bnRPckF1dGhQcm92aWRlcikpIHtcblx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5zZXR0aW5nc1N5bmNPcHRpb25zPy5hdXRoZW50aWNhdGlvblByb3ZpZGVyPy5pZCA9PT0gYWNjb3VudE9yQXV0aFByb3ZpZGVyLmlkKSB7XG5cdFx0XHRcdHNlc3Npb25JZCA9IGF3YWl0IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LnNldHRpbmdzU3luY09wdGlvbnM/LmF1dGhlbnRpY2F0aW9uUHJvdmlkZXI/LnNpZ25JbigpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2Vzc2lvbklkID0gKGF3YWl0IHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oYWNjb3VudE9yQXV0aFByb3ZpZGVyLmlkLCBhY2NvdW50T3JBdXRoUHJvdmlkZXIuc2NvcGVzKSkuaWQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSBhY2NvdW50T3JBdXRoUHJvdmlkZXIuaWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5zZXR0aW5nc1N5bmNPcHRpb25zPy5hdXRoZW50aWNhdGlvblByb3ZpZGVyPy5pZCA9PT0gYWNjb3VudE9yQXV0aFByb3ZpZGVyLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCkge1xuXHRcdFx0XHRzZXNzaW9uSWQgPSBhd2FpdCB0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5zZXR0aW5nc1N5bmNPcHRpb25zPy5hdXRoZW50aWNhdGlvblByb3ZpZGVyPy5zaWduSW4oKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNlc3Npb25JZCA9IGFjY291bnRPckF1dGhQcm92aWRlci5zZXNzaW9uSWQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSBhY2NvdW50T3JBdXRoUHJvdmlkZXIuYXV0aGVudGljYXRpb25Qcm92aWRlcklkO1xuXHRcdH1cblx0XHR0aGlzLmN1cnJlbnRTZXNzaW9uSWQgPSBzZXNzaW9uSWQ7XG5cdFx0YXdhaXQgdGhpcy51cGRhdGUoJ3NpZ24gaW4nKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25EaWRBdXRoRmFpbHVyZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmN1cnJlbnRTZXNzaW9uSWQgPSB1bmRlZmluZWQ7XG5cdFx0YXdhaXQgdGhpcy51cGRhdGUoJ2F1dGggZmFpbHVyZScpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVNlc3Npb25zKGU6IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbnNDaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmN1cnJlbnRTZXNzaW9uSWQgJiYgZS5yZW1vdmVkPy5maW5kKHNlc3Npb24gPT4gc2Vzc2lvbi5pZCA9PT0gdGhpcy5jdXJyZW50U2Vzc2lvbklkKSkge1xuXHRcdFx0dGhpcy5jdXJyZW50U2Vzc2lvbklkID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZSgnY2hhbmdlIGluIHNlc3Npb25zJyk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlU3RvcmFnZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jdXJyZW50U2Vzc2lvbklkICE9PSB0aGlzLmdldFN0b3JlZENhY2hlZFNlc3Npb25JZCgpIC8qIFRoaXMgY2hlY2tzIGlmIGN1cnJlbnQgd2luZG93IGNoYW5nZWQgdGhlIHZhbHVlIG9yIG5vdCAqLykge1xuXHRcdFx0dGhpcy5fY2FjaGVkQ3VycmVudFNlc3Npb25JZCA9IG51bGw7XG5cdFx0XHR0aGlzLnVwZGF0ZSgnY2hhbmdlIGluIHN0b3JhZ2UnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jYWNoZWRDdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBnZXQgY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9jYWNoZWRDdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9jYWNoZWRDdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5DQUNIRURfQVVUSEVOVElDQVRJT05fUFJPVklERVJfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY2FjaGVkQ3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDtcblx0fVxuXG5cdHByaXZhdGUgc2V0IGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQoY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX2NhY2hlZEN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgIT09IGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQpIHtcblx0XHRcdHRoaXMuX2NhY2hlZEN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPSBjdXJyZW50QXV0aGVudGljYXRpb25Qcm92aWRlcklkO1xuXHRcdFx0aWYgKGN1cnJlbnRBdXRoZW50aWNhdGlvblByb3ZpZGVySWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLkNBQ0hFRF9BVVRIRU5USUNBVElPTl9QUk9WSURFUl9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UuQ0FDSEVEX0FVVEhFTlRJQ0FUSU9OX1BST1ZJREVSX0tFWSwgY3VycmVudEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZCwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NhY2hlZEN1cnJlbnRTZXNzaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGdldCBjdXJyZW50U2Vzc2lvbklkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2NhY2hlZEN1cnJlbnRTZXNzaW9uSWQgPT09IG51bGwpIHtcblx0XHRcdHRoaXMuX2NhY2hlZEN1cnJlbnRTZXNzaW9uSWQgPSB0aGlzLmdldFN0b3JlZENhY2hlZFNlc3Npb25JZCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY2FjaGVkQ3VycmVudFNlc3Npb25JZDtcblx0fVxuXG5cdHByaXZhdGUgc2V0IGN1cnJlbnRTZXNzaW9uSWQoY2FjaGVkU2Vzc2lvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fY2FjaGVkQ3VycmVudFNlc3Npb25JZCAhPT0gY2FjaGVkU2Vzc2lvbklkKSB7XG5cdFx0XHR0aGlzLl9jYWNoZWRDdXJyZW50U2Vzc2lvbklkID0gY2FjaGVkU2Vzc2lvbklkO1xuXHRcdFx0aWYgKGNhY2hlZFNlc3Npb25JZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTZXR0aW5ncyBTeW5jOiBSZXNldCBjdXJyZW50IHNlc3Npb24nKTtcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5DQUNIRURfU0VTU0lPTl9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTZXR0aW5ncyBTeW5jOiBVcGRhdGVkIGN1cnJlbnQgc2Vzc2lvbicsIGNhY2hlZFNlc3Npb25JZCk7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5DQUNIRURfU0VTU0lPTl9TVE9SQUdFX0tFWSwgY2FjaGVkU2Vzc2lvbklkLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdG9yZWRDYWNoZWRTZXNzaW9uSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5DQUNIRURfU0VTU0lPTl9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IHVzZVdvcmtiZW5jaFNlc3Npb25JZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLkRPTk9UX1VTRV9XT1JLQkVOQ0hfU0VTU0lPTl9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIHNldCB1c2VXb3JrYmVuY2hTZXNzaW9uSWQodXNlV29ya2JlbmNoU2Vzc2lvbjogYm9vbGVhbikge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5ET05PVF9VU0VfV09SS0JFTkNIX1NFU1NJT05fU1RPUkFHRV9LRVksICF1c2VXb3JrYmVuY2hTZXNzaW9uLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIgLyogRWFn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
