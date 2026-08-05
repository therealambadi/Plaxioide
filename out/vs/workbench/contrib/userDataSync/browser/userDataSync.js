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
import { toAction } from "../../../../base/common/actions.js";
import { getErrorMessage, isCancellationError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize, localize2 } from "../../../../nls.js";
import { MenuId, MenuRegistry, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, ContextKeyTrueExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import {
  IUserDataAutoSyncService,
  IUserDataSyncService,
  registerConfiguration,
  SyncResource,
  SyncStatus,
  UserDataSyncError,
  UserDataSyncErrorCode,
  USER_DATA_SYNC_SCHEME,
  IUserDataSyncEnablementService,
  IUserDataSyncStoreManagementService,
  USER_DATA_SYNC_LOG_ID
} from "../../../../platform/userDataSync/common/userDataSync.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { IActivityService, NumberBadge, ProgressBadge } from "../../../services/activity/common/activity.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { fromNow } from "../../../../base/common/date.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ViewContainerLocation, Extensions } from "../../../common/views.js";
import { UserDataSyncDataViews } from "./userDataSyncViews.js";
import { IUserDataSyncWorkbenchService, getSyncAreaLabel, AccountStatus, CONTEXT_SYNC_STATE, CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE, CONFIGURE_SYNC_COMMAND_ID, SHOW_SYNC_LOG_COMMAND_ID, SYNC_VIEW_CONTAINER_ID, SYNC_TITLE, SYNC_VIEW_ICON, CONTEXT_HAS_CONFLICTS, DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR } from "../../../services/userDataSync/common/userDataSync.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ctxIsMergeResultEditor, ctxMergeBaseUri } from "../../mergeEditor/common/mergeEditor.js";
import { IWorkbenchIssueService } from "../../issue/common/issue.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { isWeb } from "../../../../base/common/platform.js";
import { PromptsConfig } from "../../../../platform/prompts/common/config.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
const turnOffSyncCommand = { id: "workbench.userDataSync.actions.turnOff", title: localize2("stop sync", "Turn Off") };
const configureSyncCommand = { id: CONFIGURE_SYNC_COMMAND_ID, title: localize2("configure sync", "Configure...") };
const showConflictsCommandId = "workbench.userDataSync.actions.showConflicts";
const syncNowCommand = {
  id: "workbench.userDataSync.actions.syncNow",
  title: localize2("sync now", "Sync Now"),
  description(userDataSyncService) {
    if (userDataSyncService.status === SyncStatus.Syncing) {
      return localize("syncing", "syncing");
    }
    if (userDataSyncService.lastSyncTime) {
      return localize("synced with time", "synced {0}", fromNow(userDataSyncService.lastSyncTime, true));
    }
    return void 0;
  }
};
const showSyncSettingsCommand = { id: "workbench.userDataSync.actions.settings", title: localize2("sync settings", "Show Settings") };
const showSyncedDataCommand = { id: "workbench.userDataSync.actions.showSyncedData", title: localize2("show synced data", "Show Synced Data") };
const CONTEXT_TURNING_ON_STATE = new RawContextKey("userDataSyncTurningOn", false);
let UserDataSyncWorkbenchContribution = class extends Disposable {
  constructor(userDataSyncEnablementService, userDataSyncService, userDataSyncWorkbenchService, contextKeyService, activityService, notificationService, editorService, userDataProfileService, dialogService, quickInputService, instantiationService, outputService, userDataAutoSyncService, textModelResolverService, preferencesService, telemetryService, productService, openerService, authenticationService, userDataSyncStoreManagementService, hostService, commandService, workbenchIssueService, configService) {
    super();
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
    this.activityService = activityService;
    this.notificationService = notificationService;
    this.editorService = editorService;
    this.userDataProfileService = userDataProfileService;
    this.dialogService = dialogService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.outputService = outputService;
    this.preferencesService = preferencesService;
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.openerService = openerService;
    this.authenticationService = authenticationService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.hostService = hostService;
    this.commandService = commandService;
    this.workbenchIssueService = workbenchIssueService;
    this.configService = configService;
    this.globalActivityBadgeDisposable = this._register(new MutableDisposable());
    this.accountBadgeDisposable = this._register(new MutableDisposable());
    this.conflictsDisposables = /* @__PURE__ */ new Map();
    this.invalidContentErrorDisposables = /* @__PURE__ */ new Map();
    this.conflictsActionDisposable = this._register(new MutableDisposable());
    this.turningOnSyncContext = CONTEXT_TURNING_ON_STATE.bindTo(contextKeyService);
    if (userDataSyncWorkbenchService.enabled) {
      registerConfiguration();
      this.updateAccountBadge();
      this.updateGlobalActivityBadge();
      this.onDidChangeConflicts(this.userDataSyncService.conflicts);
      this._register(Event.any(
        Event.debounce(userDataSyncService.onDidChangeStatus, () => void 0, 500),
        this.userDataSyncEnablementService.onDidChangeEnablement,
        this.userDataSyncWorkbenchService.onDidChangeAccountStatus
      )(() => {
        this.updateAccountBadge();
        this.updateGlobalActivityBadge();
      }));
      this._register(userDataSyncService.onDidChangeConflicts(() => this.onDidChangeConflicts(this.userDataSyncService.conflicts)));
      this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.onDidChangeConflicts(this.userDataSyncService.conflicts)));
      this._register(userDataSyncService.onSyncErrors((errors) => this.onSynchronizerErrors(errors)));
      this._register(userDataAutoSyncService.onError((error) => this.onAutoSyncError(error)));
      this.registerActions();
      this.registerViews();
      textModelResolverService.registerTextModelContentProvider(USER_DATA_SYNC_SCHEME, instantiationService.createInstance(UserDataRemoteContentProvider));
      this._register(Event.any(userDataSyncService.onDidChangeStatus, userDataSyncEnablementService.onDidChangeEnablement)(() => this.turningOnSync = !userDataSyncEnablementService.isEnabled() && userDataSyncService.status !== SyncStatus.Idle));
    }
  }
  get turningOnSync() {
    return !!this.turningOnSyncContext.get();
  }
  set turningOnSync(turningOn) {
    this.turningOnSyncContext.set(turningOn);
    this.updateGlobalActivityBadge();
  }
  toKey({ syncResource: resource, profile }) {
    return `${profile.id}:${resource}`;
  }
  onDidChangeConflicts(conflicts) {
    this.updateGlobalActivityBadge();
    this.registerShowConflictsAction();
    if (!this.userDataSyncEnablementService.isEnabled()) {
      return;
    }
    if (conflicts.length) {
      for (const [key, disposable] of this.conflictsDisposables.entries()) {
        if (!conflicts.some((conflict) => this.toKey(conflict) === key)) {
          disposable.dispose();
          this.conflictsDisposables.delete(key);
        }
      }
      for (const conflict of this.userDataSyncService.conflicts) {
        const key = this.toKey(conflict);
        if (!this.conflictsDisposables.has(key)) {
          const conflictsArea = getSyncAreaLabel(conflict.syncResource);
          const handle = this.notificationService.prompt(
            Severity.Warning,
            localize("conflicts detected", "Unable to sync due to conflicts in {0}. Please resolve them to continue.", conflictsArea.toLowerCase()),
            [
              {
                label: localize("replace remote", "Replace Remote"),
                run: () => {
                  this.acceptLocal(conflict, conflict.conflicts[0]);
                }
              },
              {
                label: localize("replace local", "Replace Local"),
                run: () => {
                  this.acceptRemote(conflict, conflict.conflicts[0]);
                }
              },
              {
                label: localize("show conflicts", "Show Conflicts"),
                run: () => {
                  this.telemetryService.publicLog2("sync/showConflicts", { source: conflict.syncResource });
                  this.userDataSyncWorkbenchService.showConflicts(conflict.conflicts[0]);
                }
              }
            ],
            {
              sticky: true
            }
          );
          this.conflictsDisposables.set(key, toDisposable(() => {
            handle.close();
            this.conflictsDisposables.delete(key);
          }));
        }
      }
    } else {
      this.conflictsDisposables.forEach((disposable) => disposable.dispose());
      this.conflictsDisposables.clear();
    }
  }
  async acceptRemote(syncResource, conflict) {
    try {
      await this.userDataSyncService.accept(syncResource, conflict.remoteResource, void 0, this.userDataSyncEnablementService.isEnabled());
    } catch (e) {
      this.notificationService.error(localize("accept failed", "Error while accepting changes. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
    }
  }
  async acceptLocal(syncResource, conflict) {
    try {
      await this.userDataSyncService.accept(syncResource, conflict.localResource, void 0, this.userDataSyncEnablementService.isEnabled());
    } catch (e) {
      this.notificationService.error(localize("accept failed", "Error while accepting changes. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
    }
  }
  onAutoSyncError(error) {
    switch (error.code) {
      case UserDataSyncErrorCode.SessionExpired:
        this.notificationService.notify({
          severity: Severity.Info,
          message: localize("session expired", "Settings sync was turned off because current session is expired, please sign in again to turn on sync."),
          actions: {
            primary: [toAction({
              id: "turn on sync",
              label: localize("turn on sync", "Turn on Settings Sync..."),
              run: () => this.turnOn()
            })]
          }
        });
        break;
      case UserDataSyncErrorCode.TurnedOff:
        this.notificationService.notify({
          severity: Severity.Info,
          message: localize("turned off", "Settings sync was turned off from another device, please turn on sync again."),
          actions: {
            primary: [toAction({
              id: "turn on sync",
              label: localize("turn on sync", "Turn on Settings Sync..."),
              run: () => this.turnOn()
            })]
          }
        });
        break;
      case UserDataSyncErrorCode.TooLarge:
        if (error.resource === SyncResource.Keybindings || error.resource === SyncResource.Settings || error.resource === SyncResource.Tasks) {
          this.disableSync(error.resource);
          const sourceArea = getSyncAreaLabel(error.resource);
          this.handleTooLargeError(error.resource, localize("too large", "Disabled syncing {0} because size of the {1} file to sync is larger than {2}. Please open the file and reduce the size and enable sync", sourceArea.toLowerCase(), sourceArea.toLowerCase(), "100kb"), error);
        }
        break;
      case UserDataSyncErrorCode.LocalTooManyProfiles:
        this.disableSync(SyncResource.Profiles);
        this.notificationService.error(localize("too many profiles", "Disabled syncing profiles because there are too many profiles to sync. Settings Sync supports syncing maximum 20 profiles. Please reduce the number of profiles and enable sync"));
        break;
      case UserDataSyncErrorCode.IncompatibleLocalContent:
      case UserDataSyncErrorCode.Gone:
      case UserDataSyncErrorCode.UpgradeRequired: {
        const message = localize("error upgrade required", "Settings sync is disabled because the current version ({0}, {1}) is not compatible with the sync service. Please update before turning on sync.", this.productService.version, this.productService.commit);
        const operationId = error.operationId ? localize("operationId", "Operation Id: {0}", error.operationId) : void 0;
        this.notificationService.notify({
          severity: Severity.Error,
          message: operationId ? `${message} ${operationId}` : message
        });
        break;
      }
      case UserDataSyncErrorCode.MethodNotFound: {
        const message = localize("method not found", "Settings sync is disabled because the client is making invalid requests. Please report an issue with the logs.");
        const operationId = error.operationId ? localize("operationId", "Operation Id: {0}", error.operationId) : void 0;
        this.notificationService.notify({
          severity: Severity.Error,
          message: operationId ? `${message} ${operationId}` : message,
          actions: {
            primary: [
              toAction({
                id: "Show Sync Logs",
                label: localize("show sync logs", "Show Log"),
                run: () => this.commandService.executeCommand(SHOW_SYNC_LOG_COMMAND_ID)
              }),
              toAction({
                id: "Report Issue",
                label: localize("report issue", "Report Issue"),
                run: () => this.workbenchIssueService.openReporter()
              })
            ]
          }
        });
        break;
      }
      case UserDataSyncErrorCode.IncompatibleRemoteContent:
        this.notificationService.notify({
          severity: Severity.Error,
          message: localize("error reset required", "Settings sync is disabled because your data in the cloud is older than that of the client. Please clear your data in the cloud before turning on sync."),
          actions: {
            primary: [
              toAction({
                id: "reset",
                label: localize("reset", "Clear Data in Cloud..."),
                run: () => this.userDataSyncWorkbenchService.resetSyncedData()
              }),
              toAction({
                id: "show synced data",
                label: localize("show synced data action", "Show Synced Data"),
                run: () => this.userDataSyncWorkbenchService.showSyncActivity()
              })
            ]
          }
        });
        return;
      case UserDataSyncErrorCode.ServiceChanged:
        this.notificationService.notify({
          severity: Severity.Info,
          message: this.userDataSyncStoreManagementService.userDataSyncStore?.type === "insiders" ? localize("service switched to insiders", "Settings Sync has been switched to insiders service") : localize("service switched to stable", "Settings Sync has been switched to stable service")
        });
        return;
      case UserDataSyncErrorCode.DefaultServiceChanged:
        if (this.userDataSyncEnablementService.isEnabled()) {
          this.notificationService.notify({
            severity: Severity.Info,
            message: localize("using separate service", "Settings sync now uses a separate service, more information is available in the [Settings Sync Documentation](https://aka.ms/vscode-settings-sync-help#_syncing-stable-versus-insiders).")
          });
        } else {
          this.notificationService.notify({
            severity: Severity.Info,
            message: localize("service changed and turned off", "Settings sync was turned off because {0} now uses a separate service. Please turn on sync again.", this.productService.nameLong),
            actions: {
              primary: [toAction({
                id: "turn on sync",
                label: localize("turn on sync", "Turn on Settings Sync..."),
                run: () => this.turnOn()
              })]
            }
          });
        }
        return;
    }
  }
  handleTooLargeError(resource, message, error) {
    const operationId = error.operationId ? localize("operationId", "Operation Id: {0}", error.operationId) : void 0;
    this.notificationService.notify({
      severity: Severity.Error,
      message: operationId ? `${message} ${operationId}` : message,
      actions: {
        primary: [toAction({
          id: "open sync file",
          label: localize("open file", "Open {0} File", getSyncAreaLabel(resource)),
          run: () => resource === SyncResource.Settings ? this.preferencesService.openUserSettings({ jsonEditor: true }) : this.preferencesService.openGlobalKeybindingSettings(true)
        })]
      }
    });
  }
  onSynchronizerErrors(errors) {
    if (errors.length) {
      for (const { profile, syncResource: resource, error } of errors) {
        switch (error.code) {
          case UserDataSyncErrorCode.LocalInvalidContent:
            this.handleInvalidContentError({ profile, syncResource: resource });
            break;
          default: {
            const key = `${profile.id}:${resource}`;
            const disposable = this.invalidContentErrorDisposables.get(key);
            if (disposable) {
              disposable.dispose();
              this.invalidContentErrorDisposables.delete(key);
            }
          }
        }
      }
    } else {
      this.invalidContentErrorDisposables.forEach((disposable) => disposable.dispose());
      this.invalidContentErrorDisposables.clear();
    }
  }
  handleInvalidContentError({ profile, syncResource: source }) {
    if (this.userDataProfileService.currentProfile.id !== profile.id) {
      return;
    }
    const key = `${profile.id}:${source}`;
    if (this.invalidContentErrorDisposables.has(key)) {
      return;
    }
    if (source !== SyncResource.Settings && source !== SyncResource.Keybindings && source !== SyncResource.Tasks) {
      return;
    }
    if (!this.hostService.hasFocus) {
      return;
    }
    const resource = source === SyncResource.Settings ? this.userDataProfileService.currentProfile.settingsResource : source === SyncResource.Keybindings ? this.userDataProfileService.currentProfile.keybindingsResource : this.userDataProfileService.currentProfile.tasksResource;
    const editorUri = EditorResourceAccessor.getCanonicalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (isEqual(resource, editorUri)) {
      return;
    }
    const errorArea = getSyncAreaLabel(source);
    const handle = this.notificationService.notify({
      severity: Severity.Error,
      message: localize("errorInvalidConfiguration", "Unable to sync {0} because the content in the file is not valid. Please open the file and correct it.", errorArea.toLowerCase()),
      actions: {
        primary: [toAction({
          id: "open sync file",
          label: localize("open file", "Open {0} File", errorArea),
          run: () => source === SyncResource.Settings ? this.preferencesService.openUserSettings({ jsonEditor: true }) : this.preferencesService.openGlobalKeybindingSettings(true)
        })]
      }
    });
    this.invalidContentErrorDisposables.set(key, toDisposable(() => {
      handle.close();
      this.invalidContentErrorDisposables.delete(key);
    }));
  }
  getConflictsCount() {
    return this.userDataSyncService.conflicts.reduce((result, { conflicts }) => {
      return result + conflicts.length;
    }, 0);
  }
  async updateGlobalActivityBadge() {
    this.globalActivityBadgeDisposable.clear();
    let badge = void 0;
    if (this.userDataSyncService.conflicts.length && this.userDataSyncEnablementService.isEnabled()) {
      badge = new NumberBadge(this.getConflictsCount(), () => localize("has conflicts", "{0}: Conflicts Detected", SYNC_TITLE.value));
    } else if (this.turningOnSync) {
      badge = new ProgressBadge(() => localize("turning on syncing", "Turning on Settings Sync..."));
    }
    if (badge) {
      this.globalActivityBadgeDisposable.value = this.activityService.showGlobalActivity({ badge });
    }
  }
  async updateAccountBadge() {
    this.accountBadgeDisposable.clear();
    let badge = void 0;
    if (this.userDataSyncService.status !== SyncStatus.Uninitialized && this.userDataSyncEnablementService.isEnabled() && this.userDataSyncWorkbenchService.accountStatus === AccountStatus.Unavailable) {
      badge = new NumberBadge(1, () => localize("sign in to sync", "Sign in to Sync Settings"));
    }
    if (badge) {
      this.accountBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
    }
  }
  async turnOn() {
    try {
      if (!this.userDataSyncWorkbenchService.authenticationProviders.length) {
        throw new Error(localize("no authentication providers", "No authentication providers are available."));
      }
      const turnOn = await this.askToConfigure();
      if (!turnOn) {
        return;
      }
      if (this.userDataSyncStoreManagementService.userDataSyncStore?.canSwitch) {
        await this.selectSettingsSyncService(this.userDataSyncStoreManagementService.userDataSyncStore);
      }
      await this.userDataSyncWorkbenchService.turnOn();
    } catch (e) {
      if (isCancellationError(e)) {
        return;
      }
      if (e instanceof UserDataSyncError) {
        switch (e.code) {
          case UserDataSyncErrorCode.TooLarge:
            if (e.resource === SyncResource.Keybindings || e.resource === SyncResource.Settings || e.resource === SyncResource.Tasks) {
              this.handleTooLargeError(e.resource, localize("too large while starting sync", "Settings sync cannot be turned on because size of the {0} file to sync is larger than {1}. Please open the file and reduce the size and turn on sync", getSyncAreaLabel(e.resource).toLowerCase(), "100kb"), e);
              return;
            }
            break;
          case UserDataSyncErrorCode.IncompatibleLocalContent:
          case UserDataSyncErrorCode.Gone:
          case UserDataSyncErrorCode.UpgradeRequired: {
            const message = localize("error upgrade required while starting sync", "Settings sync cannot be turned on because the current version ({0}, {1}) is not compatible with the sync service. Please update before turning on sync.", this.productService.version, this.productService.commit);
            const operationId = e.operationId ? localize("operationId", "Operation Id: {0}", e.operationId) : void 0;
            this.notificationService.notify({
              severity: Severity.Error,
              message: operationId ? `${message} ${operationId}` : message
            });
            return;
          }
          case UserDataSyncErrorCode.IncompatibleRemoteContent:
            this.notificationService.notify({
              severity: Severity.Error,
              message: localize("error reset required while starting sync", "Settings sync cannot be turned on because your data in the cloud is older than that of the client. Please clear your data in the cloud before turning on sync."),
              actions: {
                primary: [
                  toAction({
                    id: "reset",
                    label: localize("reset", "Clear Data in Cloud..."),
                    run: () => this.userDataSyncWorkbenchService.resetSyncedData()
                  }),
                  toAction({
                    id: "show synced data",
                    label: localize("show synced data action", "Show Synced Data"),
                    run: () => this.userDataSyncWorkbenchService.showSyncActivity()
                  })
                ]
              }
            });
            return;
          case UserDataSyncErrorCode.Unauthorized:
          case UserDataSyncErrorCode.Forbidden:
            this.notificationService.error(localize("auth failed", "Error while turning on Settings Sync: Authentication failed."));
            return;
        }
        this.notificationService.error(localize("turn on failed with user data sync error", "Error while turning on Settings Sync. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
      } else {
        this.notificationService.error(localize({ key: "turn on failed", comment: ["Substitution is for error reason"] }, "Error while turning on Settings Sync. {0}", getErrorMessage(e)));
      }
    }
  }
  async askToConfigure() {
    return new Promise((c, e) => {
      const disposables = new DisposableStore();
      const quickPick = this.quickInputService.createQuickPick();
      disposables.add(quickPick);
      quickPick.title = SYNC_TITLE.value;
      quickPick.ok = false;
      quickPick.customButton = true;
      quickPick.customLabel = localize("sign in and turn on", "Sign in");
      quickPick.description = localize("configure and turn on sync detail", "Please sign in to backup and sync your data across devices.");
      quickPick.canSelectMany = true;
      quickPick.ignoreFocusOut = true;
      quickPick.hideInput = true;
      quickPick.hideCheckAll = true;
      const items = this.getConfigureSyncQuickPickItems();
      quickPick.items = items;
      quickPick.selectedItems = items.filter((item) => this.userDataSyncEnablementService.isResourceEnabled(item.id, true));
      let accepted = false;
      disposables.add(Event.any(quickPick.onDidAccept, quickPick.onDidCustom)(() => {
        accepted = true;
        quickPick.hide();
      }));
      disposables.add(quickPick.onDidHide(() => {
        try {
          if (accepted) {
            this.updateConfiguration(items, quickPick.selectedItems);
          }
          c(accepted);
        } catch (error) {
          e(error);
        } finally {
          disposables.dispose();
        }
      }));
      quickPick.show();
    });
  }
  getConfigureSyncQuickPickItems() {
    const result = [{
      id: SyncResource.Settings,
      label: getSyncAreaLabel(SyncResource.Settings)
    }, {
      id: SyncResource.Keybindings,
      label: getSyncAreaLabel(SyncResource.Keybindings)
    }, {
      id: SyncResource.Snippets,
      label: getSyncAreaLabel(SyncResource.Snippets)
    }, {
      id: SyncResource.Tasks,
      label: getSyncAreaLabel(SyncResource.Tasks)
    }, {
      id: SyncResource.GlobalState,
      label: getSyncAreaLabel(SyncResource.GlobalState)
    }, {
      id: SyncResource.Extensions,
      label: getSyncAreaLabel(SyncResource.Extensions)
    }, {
      id: SyncResource.Profiles,
      label: getSyncAreaLabel(SyncResource.Profiles)
    }];
    if (PromptsConfig.enabled(this.configService) === true) {
      result.push({
        id: SyncResource.Prompts,
        label: getSyncAreaLabel(SyncResource.Prompts)
      });
    }
    return result;
  }
  updateConfiguration(items, selectedItems) {
    for (const item of items) {
      const wasEnabled = this.userDataSyncEnablementService.isResourceEnabled(item.id);
      const isEnabled = !!selectedItems.filter((selected) => selected.id === item.id)[0];
      if (wasEnabled !== isEnabled) {
        this.userDataSyncEnablementService.setResourceEnablement(item.id, isEnabled);
      }
    }
  }
  async configureSyncOptions() {
    return new Promise((c, e) => {
      const disposables = new DisposableStore();
      const quickPick = this.quickInputService.createQuickPick();
      disposables.add(quickPick);
      quickPick.title = localize("configure sync title", "{0}: Configure...", SYNC_TITLE.value);
      quickPick.placeholder = localize("configure sync placeholder", "Choose what to sync");
      quickPick.canSelectMany = true;
      quickPick.ignoreFocusOut = true;
      quickPick.ok = true;
      const items = this.getConfigureSyncQuickPickItems();
      quickPick.items = items;
      quickPick.selectedItems = items.filter((item) => this.userDataSyncEnablementService.isResourceEnabled(item.id));
      disposables.add(quickPick.onDidAccept(async () => {
        if (quickPick.selectedItems.length) {
          this.updateConfiguration(items, quickPick.selectedItems);
          quickPick.hide();
        }
      }));
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        c();
      }));
      quickPick.show();
    });
  }
  async turnOff() {
    const result = await this.dialogService.confirm({
      message: localize("turn off sync confirmation", "Do you want to turn off sync?"),
      detail: localize("turn off sync detail", "Your settings, keybindings, extensions, snippets and UI State will no longer be synced."),
      primaryButton: localize({ key: "turn off", comment: ["&& denotes a mnemonic"] }, "&&Turn off"),
      checkbox: this.userDataSyncWorkbenchService.accountStatus === AccountStatus.Available ? {
        label: localize("turn off sync everywhere", "Turn off sync on all your devices and clear the data from the cloud.")
      } : void 0
    });
    if (result.confirmed) {
      return this.userDataSyncWorkbenchService.turnoff(!!result.checkboxChecked);
    }
  }
  disableSync(source) {
    switch (source) {
      case SyncResource.Settings:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Settings, false);
      case SyncResource.Keybindings:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Keybindings, false);
      case SyncResource.Snippets:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Snippets, false);
      case SyncResource.Tasks:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Tasks, false);
      case SyncResource.Extensions:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Extensions, false);
      case SyncResource.GlobalState:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.GlobalState, false);
      case SyncResource.Profiles:
        return this.userDataSyncEnablementService.setResourceEnablement(SyncResource.Profiles, false);
    }
  }
  showSyncActivity() {
    return this.outputService.showChannel(USER_DATA_SYNC_LOG_ID);
  }
  async selectSettingsSyncService(userDataSyncStore) {
    return new Promise((c, e) => {
      const disposables = new DisposableStore();
      const quickPick = disposables.add(this.quickInputService.createQuickPick());
      quickPick.title = localize("switchSyncService.title", "{0}: Select Service", SYNC_TITLE.value);
      quickPick.description = localize("switchSyncService.description", "Ensure you are using the same settings sync service when syncing with multiple environments");
      quickPick.hideInput = true;
      quickPick.ignoreFocusOut = true;
      const getDescription = (url) => {
        const isDefault = isEqual(url, userDataSyncStore.defaultUrl);
        if (isDefault) {
          return localize("default", "Default");
        }
        return void 0;
      };
      quickPick.items = [
        {
          id: "insiders",
          label: localize("insiders", "Insiders"),
          description: getDescription(userDataSyncStore.insidersUrl)
        },
        {
          id: "stable",
          label: localize("stable", "Stable"),
          description: getDescription(userDataSyncStore.stableUrl)
        }
      ];
      disposables.add(quickPick.onDidAccept(async () => {
        try {
          await this.userDataSyncStoreManagementService.switch(quickPick.selectedItems[0].id);
          c();
        } catch (error) {
          e(error);
        } finally {
          quickPick.hide();
        }
      }));
      disposables.add(quickPick.onDidHide(() => disposables.dispose()));
      quickPick.show();
    });
  }
  registerActions() {
    if (this.userDataSyncEnablementService.canToggleEnablement()) {
      this.registerTurnOnSyncAction();
      this.registerTurnOffSyncAction();
    }
    this.registerTurningOnSyncAction();
    this.registerCancelTurnOnSyncAction();
    this.registerSignInAction();
    this.registerShowConflictsAction();
    this.registerEnableSyncViewsAction();
    this.registerManageSyncAction();
    this.registerSyncNowAction();
    this.registerConfigureSyncAction();
    this.registerShowSettingsAction();
    this.registerHelpAction();
    this.registerShowLogAction();
    this.registerResetSyncDataAction();
    this.registerAcceptMergesAction();
    if (isWeb) {
      this.registerDownloadSyncActivityAction();
    }
  }
  registerTurnOnSyncAction() {
    const that = this;
    const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_SYNC_ENABLEMENT.toNegated(), CONTEXT_TURNING_ON_STATE.negate());
    this._register(registerAction2(class TurningOnSyncAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userDataSync.actions.turnOn",
          title: localize2("global activity turn on sync", "Backup and Sync Settings..."),
          category: SYNC_TITLE,
          f1: true,
          precondition: when,
          menu: [{
            group: "3_configuration",
            id: MenuId.GlobalActivity,
            when,
            order: 2
          }, {
            group: "3_configuration",
            id: MenuId.MenubarPreferencesMenu,
            when,
            order: 2
          }, {
            group: "1_settings",
            id: MenuId.AccountsContext,
            when,
            order: 2
          }]
        });
      }
      async run() {
        return that.turnOn();
      }
    }));
  }
  registerTurningOnSyncAction() {
    const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_SYNC_ENABLEMENT.toNegated(), CONTEXT_TURNING_ON_STATE);
    this._register(registerAction2(class TurningOnSyncAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userData.actions.turningOn",
          title: localize("turning on sync", "Turning on Settings Sync..."),
          precondition: ContextKeyExpr.false(),
          menu: [{
            group: "3_configuration",
            id: MenuId.GlobalActivity,
            when,
            order: 2
          }, {
            group: "1_settings",
            id: MenuId.AccountsContext,
            when
          }]
        });
      }
      async run() {
      }
    }));
  }
  registerCancelTurnOnSyncAction() {
    const that = this;
    this._register(registerAction2(class TurningOnSyncAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userData.actions.cancelTurnOn",
          title: localize("cancel turning on sync", "Cancel"),
          icon: Codicon.stopCircle,
          menu: {
            id: MenuId.ViewContainerTitle,
            when: ContextKeyExpr.and(CONTEXT_TURNING_ON_STATE, ContextKeyExpr.equals("viewContainer", SYNC_VIEW_CONTAINER_ID)),
            group: "navigation",
            order: 1
          }
        });
      }
      async run() {
        return that.userDataSyncWorkbenchService.turnoff(false);
      }
    }));
  }
  registerSignInAction() {
    const that = this;
    const id = "workbench.userData.actions.signin";
    const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Unavailable));
    this._register(registerAction2(class StopSyncAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userData.actions.signin",
          title: localize("sign in global", "Sign in to Sync Settings"),
          menu: {
            group: "3_configuration",
            id: MenuId.GlobalActivity,
            when,
            order: 2
          }
        });
      }
      async run() {
        try {
          await that.userDataSyncWorkbenchService.signIn();
        } catch (e) {
          that.notificationService.error(e);
        }
      }
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
      group: "1_settings",
      command: {
        id,
        title: localize("sign in accounts", "Sign in to Sync Settings (1)")
      },
      when
    }));
  }
  getShowConflictsTitle() {
    return localize2("resolveConflicts_global", "Show Conflicts ({0})", this.getConflictsCount());
  }
  registerShowConflictsAction() {
    this.conflictsActionDisposable.value = void 0;
    const that = this;
    this.conflictsActionDisposable.value = registerAction2(class TurningOnSyncAction extends Action2 {
      constructor() {
        super({
          id: showConflictsCommandId,
          get title() {
            return that.getShowConflictsTitle();
          },
          category: SYNC_TITLE,
          f1: true,
          precondition: CONTEXT_HAS_CONFLICTS,
          menu: [{
            group: "3_configuration",
            id: MenuId.GlobalActivity,
            when: CONTEXT_HAS_CONFLICTS,
            order: 2
          }, {
            group: "3_configuration",
            id: MenuId.MenubarPreferencesMenu,
            when: CONTEXT_HAS_CONFLICTS,
            order: 2
          }]
        });
      }
      async run() {
        return that.userDataSyncWorkbenchService.showConflicts();
      }
    });
  }
  registerManageSyncAction() {
    const that = this;
    const when = ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.notEqualsTo(AccountStatus.Unavailable), CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized));
    this._register(registerAction2(class SyncStatusAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userDataSync.actions.manage",
          title: localize("sync is on", "Settings Sync is On"),
          toggled: ContextKeyTrueExpr.INSTANCE,
          menu: [
            {
              id: MenuId.GlobalActivity,
              group: "3_configuration",
              when,
              order: 2
            },
            {
              id: MenuId.MenubarPreferencesMenu,
              group: "3_configuration",
              when,
              order: 2
            },
            {
              id: MenuId.AccountsContext,
              group: "1_settings",
              when
            }
          ]
        });
      }
      run(accessor) {
        return new Promise((c, e) => {
          const quickInputService = accessor.get(IQuickInputService);
          const commandService = accessor.get(ICommandService);
          const disposables = new DisposableStore();
          const quickPick = quickInputService.createQuickPick({ useSeparators: true });
          disposables.add(quickPick);
          const items = [];
          if (that.userDataSyncService.conflicts.length) {
            items.push({ id: showConflictsCommandId, label: `${SYNC_TITLE.value}: ${that.getShowConflictsTitle().original}` });
            items.push({ type: "separator" });
          }
          items.push({ id: configureSyncCommand.id, label: `${SYNC_TITLE.value}: ${configureSyncCommand.title.original}` });
          items.push({ id: showSyncSettingsCommand.id, label: `${SYNC_TITLE.value}: ${showSyncSettingsCommand.title.original}` });
          items.push({ id: showSyncedDataCommand.id, label: `${SYNC_TITLE.value}: ${showSyncedDataCommand.title.original}` });
          items.push({ type: "separator" });
          items.push({ id: syncNowCommand.id, label: `${SYNC_TITLE.value}: ${syncNowCommand.title.original}`, description: syncNowCommand.description(that.userDataSyncService) });
          if (that.userDataSyncEnablementService.canToggleEnablement()) {
            const account = that.userDataSyncWorkbenchService.current;
            items.push({ id: turnOffSyncCommand.id, label: `${SYNC_TITLE.value}: ${turnOffSyncCommand.title.original}`, description: account ? `${account.accountName} (${that.authenticationService.getProvider(account.authenticationProviderId).label})` : void 0 });
          }
          quickPick.items = items;
          disposables.add(quickPick.onDidAccept(() => {
            if (quickPick.selectedItems[0] && quickPick.selectedItems[0].id) {
              commandService.executeCommand(quickPick.selectedItems[0].id);
            }
            quickPick.hide();
          }));
          disposables.add(quickPick.onDidHide(() => {
            disposables.dispose();
            c();
          }));
          quickPick.show();
        });
      }
    }));
  }
  registerEnableSyncViewsAction() {
    const that = this;
    const when = ContextKeyExpr.and(CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized));
    this._register(registerAction2(class SyncStatusAction extends Action2 {
      constructor() {
        super({
          id: showSyncedDataCommand.id,
          title: showSyncedDataCommand.title,
          category: SYNC_TITLE,
          precondition: when,
          menu: {
            id: MenuId.CommandPalette,
            when
          }
        });
      }
      run(accessor) {
        return that.userDataSyncWorkbenchService.showSyncActivity();
      }
    }));
  }
  registerSyncNowAction() {
    const that = this;
    this._register(registerAction2(class SyncNowAction extends Action2 {
      constructor() {
        super({
          id: syncNowCommand.id,
          title: syncNowCommand.title,
          category: SYNC_TITLE,
          menu: {
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized))
          }
        });
      }
      run(accessor) {
        return that.userDataSyncWorkbenchService.syncNow();
      }
    }));
  }
  registerTurnOffSyncAction() {
    const that = this;
    this._register(registerAction2(class StopSyncAction extends Action2 {
      constructor() {
        super({
          id: turnOffSyncCommand.id,
          title: turnOffSyncCommand.title,
          category: SYNC_TITLE,
          menu: {
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_SYNC_ENABLEMENT)
          }
        });
      }
      async run() {
        try {
          await that.turnOff();
        } catch (e) {
          if (!isCancellationError(e)) {
            that.notificationService.error(localize("turn off failed", "Error while turning off Settings Sync. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
          }
        }
      }
    }));
  }
  registerConfigureSyncAction() {
    const that = this;
    const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_SYNC_ENABLEMENT);
    this._register(registerAction2(class ConfigureSyncAction extends Action2 {
      constructor() {
        super({
          id: configureSyncCommand.id,
          title: configureSyncCommand.title,
          category: SYNC_TITLE,
          icon: Codicon.settingsGear,
          tooltip: localize("configure", "Configure..."),
          menu: [{
            id: MenuId.CommandPalette,
            when
          }, {
            id: MenuId.ViewContainerTitle,
            when: ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, ContextKeyExpr.equals("viewContainer", SYNC_VIEW_CONTAINER_ID)),
            group: "navigation",
            order: 2
          }]
        });
      }
      run() {
        return that.configureSyncOptions();
      }
    }));
  }
  registerShowLogAction() {
    const that = this;
    this._register(registerAction2(class ShowSyncActivityAction extends Action2 {
      constructor() {
        super({
          id: SHOW_SYNC_LOG_COMMAND_ID,
          title: localize("show sync log title", "{0}: Show Log", SYNC_TITLE.value),
          tooltip: localize("show sync log toolrip", "Show Log"),
          icon: Codicon.output,
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized))
          }, {
            id: MenuId.ViewContainerTitle,
            when: ContextKeyExpr.equals("viewContainer", SYNC_VIEW_CONTAINER_ID),
            group: "navigation",
            order: 1
          }]
        });
      }
      run() {
        return that.showSyncActivity();
      }
    }));
  }
  registerShowSettingsAction() {
    this._register(registerAction2(class ShowSyncSettingsAction extends Action2 {
      constructor() {
        super({
          id: showSyncSettingsCommand.id,
          title: showSyncSettingsCommand.title,
          category: SYNC_TITLE,
          menu: {
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized))
          }
        });
      }
      run(accessor) {
        accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: "@tag:sync" });
      }
    }));
  }
  registerHelpAction() {
    const that = this;
    this._register(registerAction2(class HelpAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userDataSync.actions.help",
          title: SYNC_TITLE,
          category: Categories.Help,
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized))
          }]
        });
      }
      run() {
        return that.openerService.open(URI.parse("https://aka.ms/vscode-settings-sync-help"));
      }
    }));
    MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
      command: {
        id: "workbench.userDataSync.actions.help",
        title: Categories.Help.value
      },
      when: ContextKeyExpr.equals("viewContainer", SYNC_VIEW_CONTAINER_ID),
      group: "1_help"
    });
  }
  registerAcceptMergesAction() {
    const that = this;
    this._register(registerAction2(class AcceptMergesAction extends Action2 {
      constructor() {
        super({
          id: "workbench.userDataSync.actions.acceptMerges",
          title: localize("complete merges title", "Complete Merge"),
          menu: [{
            id: MenuId.EditorContent,
            when: ContextKeyExpr.and(ctxIsMergeResultEditor, ContextKeyExpr.regex(ctxMergeBaseUri.key, new RegExp(`^${USER_DATA_SYNC_SCHEME}:`)))
          }]
        });
      }
      async run(accessor, previewResource) {
        const textFileService = accessor.get(ITextFileService);
        await textFileService.save(previewResource);
        const content = await textFileService.read(previewResource);
        await that.userDataSyncService.accept(this.getSyncResource(previewResource), previewResource, content.value, true);
      }
      getSyncResource(previewResource) {
        const conflict = that.userDataSyncService.conflicts.find(({ conflicts }) => conflicts.some((conflict2) => isEqual(conflict2.previewResource, previewResource)));
        if (conflict) {
          return conflict;
        }
        throw new Error(`Unknown resource: ${previewResource.toString()}`);
      }
    }));
  }
  registerDownloadSyncActivityAction() {
    this._register(registerAction2(class DownloadSyncActivityAction extends Action2 {
      constructor() {
        super(DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR);
      }
      async run(accessor) {
        const userDataSyncWorkbenchService = accessor.get(IUserDataSyncWorkbenchService);
        const notificationService = accessor.get(INotificationService);
        const folder = await userDataSyncWorkbenchService.downloadSyncActivity();
        if (folder) {
          notificationService.info(localize("download sync activity complete", "Successfully downloaded Settings Sync activity."));
        }
      }
    }));
  }
  registerViews() {
    const container = this.registerViewContainer();
    this.registerDataViews(container);
  }
  registerViewContainer() {
    return Registry.as(Extensions.ViewContainersRegistry).registerViewContainer(
      {
        id: SYNC_VIEW_CONTAINER_ID,
        title: SYNC_TITLE,
        ctorDescriptor: new SyncDescriptor(
          ViewPaneContainer,
          [SYNC_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]
        ),
        icon: SYNC_VIEW_ICON,
        hideIfEmpty: true
      },
      ViewContainerLocation.Sidebar
    );
  }
  registerResetSyncDataAction() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.actions.syncData.reset",
          title: localize("workbench.actions.syncData.reset", "Clear Data in Cloud..."),
          menu: [{
            id: MenuId.ViewContainerTitle,
            when: ContextKeyExpr.equals("viewContainer", SYNC_VIEW_CONTAINER_ID),
            group: "0_configure"
          }]
        });
      }
      run() {
        return that.userDataSyncWorkbenchService.resetSyncedData();
      }
    }));
  }
  registerDataViews(container) {
    this._register(this.instantiationService.createInstance(UserDataSyncDataViews, container));
  }
};
UserDataSyncWorkbenchContribution = __decorateClass([
  __decorateParam(0, IUserDataSyncEnablementService),
  __decorateParam(1, IUserDataSyncService),
  __decorateParam(2, IUserDataSyncWorkbenchService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IActivityService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IUserDataProfileService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IQuickInputService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IOutputService),
  __decorateParam(12, IUserDataAutoSyncService),
  __decorateParam(13, ITextModelService),
  __decorateParam(14, IPreferencesService),
  __decorateParam(15, ITelemetryService),
  __decorateParam(16, IProductService),
  __decorateParam(17, IOpenerService),
  __decorateParam(18, IAuthenticationService),
  __decorateParam(19, IUserDataSyncStoreManagementService),
  __decorateParam(20, IHostService),
  __decorateParam(21, ICommandService),
  __decorateParam(22, IWorkbenchIssueService),
  __decorateParam(23, IConfigurationService)
], UserDataSyncWorkbenchContribution);
let UserDataRemoteContentProvider = class {
  constructor(userDataSyncService, modelService, languageService) {
    this.userDataSyncService = userDataSyncService;
    this.modelService = modelService;
    this.languageService = languageService;
  }
  provideTextContent(uri) {
    if (uri.scheme === USER_DATA_SYNC_SCHEME) {
      return this.userDataSyncService.resolveContent(uri).then((content) => this.modelService.createModel(content || "", this.languageService.createById("jsonc"), uri));
    }
    return null;
  }
};
UserDataRemoteContentProvider = __decorateClass([
  __decorateParam(0, IUserDataSyncService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService)
], UserDataRemoteContentProvider);
export {
  UserDataSyncWorkbenchContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVN5bmMvYnJvd3Nlci91c2VyRGF0YVN5bmMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgdHlwZSB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiwgQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5VHJ1ZUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFF1aWNrUGlja0l0ZW0sIElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQge1xuXHRJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTZXJ2aWNlLCByZWdpc3RlckNvbmZpZ3VyYXRpb24sXG5cdFN5bmNSZXNvdXJjZSwgU3luY1N0YXR1cywgVXNlckRhdGFTeW5jRXJyb3IsIFVzZXJEYXRhU3luY0Vycm9yQ29kZSwgVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdElSZXNvdXJjZVByZXZpZXcsIElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCBVc2VyRGF0YVN5bmNTdG9yZVR5cGUsIElVc2VyRGF0YVN5bmNTdG9yZSwgSVVzZXJEYXRhU3luY1Jlc291cmNlQ29uZmxpY3RzLCBJVXNlckRhdGFTeW5jUmVzb3VyY2UsIElVc2VyRGF0YVN5bmNSZXNvdXJjZUVycm9yLCBVU0VSX0RBVEFfU1lOQ19MT0dfSURcbn0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIFNpZGVCeVNpZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgSUJhZGdlLCBOdW1iZXJCYWRnZSwgUHJvZ3Jlc3NCYWRnZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IGZyb21Ob3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSUF1dGhlbnRpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2NvbW1vbi9hdXRoZW50aWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXJMb2NhdGlvbiwgSVZpZXdDb250YWluZXJzUmVnaXN0cnksIEV4dGVuc2lvbnMsIFZpZXdDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jRGF0YVZpZXdzIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNWaWV3cy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgZ2V0U3luY0FyZWFMYWJlbCwgQWNjb3VudFN0YXR1cywgQ09OVEVYVF9TWU5DX1NUQVRFLCBDT05URVhUX1NZTkNfRU5BQkxFTUVOVCwgQ09OVEVYVF9BQ0NPVU5UX1NUQVRFLCBDT05GSUdVUkVfU1lOQ19DT01NQU5EX0lELCBTSE9XX1NZTkNfTE9HX0NPTU1BTkRfSUQsIFNZTkNfVklFV19DT05UQUlORVJfSUQsIFNZTkNfVElUTEUsIFNZTkNfVklFV19JQ09OLCBDT05URVhUX0hBU19DT05GTElDVFMsIERPV05MT0FEX0FDVElWSVRZX0FDVElPTl9ERVNDUklQVE9SIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IGN0eElzTWVyZ2VSZXN1bHRFZGl0b3IsIGN0eE1lcmdlQmFzZVVyaSB9IGZyb20gJy4uLy4uL21lcmdlRWRpdG9yL2NvbW1vbi9tZXJnZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoSXNzdWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaXNzdWUvY29tbW9uL2lzc3VlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgUHJvbXB0c0NvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb21wdHMvY29tbW9uL2NvbmZpZy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcblxudHlwZSBDb25maWd1cmVTeW5jUXVpY2tQaWNrSXRlbSA9IHsgaWQ6IFN5bmNSZXNvdXJjZTsgbGFiZWw6IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfTtcblxudHlwZSBTeW5jQ29uZmxpY3RzQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnc2FuZHkwODEnO1xuXHRjb21tZW50OiAnUmVzcG9uc2UgaW5mb3JtYXRpb24gd2hlbiBjb25mbGljdCBoYXBwZW5zIGR1cmluZyBzZXR0aW5ncyBzeW5jJztcblx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc2V0dGluZ3Mgc3luYyByZXNvdXJjZS4gZWcuLCBzZXR0aW5ncywga2V5YmluZGluZ3MuLi4nIH07XG5cdGFjdGlvbj86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdhY3Rpb24gdGFrZW4gd2hpbGUgcmVzb2x2aW5nIGNvbmZsaWN0cy4gRWc6IGFjY2VwdExvY2FsLCBhY2NlcHRSZW1vdGUnIH07XG59O1xuXG5jb25zdCB0dXJuT2ZmU3luY0NvbW1hbmQgPSB7IGlkOiAnd29ya2JlbmNoLnVzZXJEYXRhU3luYy5hY3Rpb25zLnR1cm5PZmYnLCB0aXRsZTogbG9jYWxpemUyKCdzdG9wIHN5bmMnLCAnVHVybiBPZmYnKSB9O1xuY29uc3QgY29uZmlndXJlU3luY0NvbW1hbmQgPSB7IGlkOiBDT05GSUdVUkVfU1lOQ19DT01NQU5EX0lELCB0aXRsZTogbG9jYWxpemUyKCdjb25maWd1cmUgc3luYycsICdDb25maWd1cmUuLi4nKSB9O1xuY29uc3Qgc2hvd0NvbmZsaWN0c0NvbW1hbmRJZCA9ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMuc2hvd0NvbmZsaWN0cyc7XG5jb25zdCBzeW5jTm93Q29tbWFuZCA9IHtcblx0aWQ6ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMuc3luY05vdycsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3N5bmMgbm93JywgJ1N5bmMgTm93JyksXG5cdGRlc2NyaXB0aW9uKHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodXNlckRhdGFTeW5jU2VydmljZS5zdGF0dXMgPT09IFN5bmNTdGF0dXMuU3luY2luZykge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzeW5jaW5nJywgXCJzeW5jaW5nXCIpO1xuXHRcdH1cblx0XHRpZiAodXNlckRhdGFTeW5jU2VydmljZS5sYXN0U3luY1RpbWUpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc3luY2VkIHdpdGggdGltZScsIFwic3luY2VkIHswfVwiLCBmcm9tTm93KHVzZXJEYXRhU3luY1NlcnZpY2UubGFzdFN5bmNUaW1lLCB0cnVlKSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn07XG5jb25zdCBzaG93U3luY1NldHRpbmdzQ29tbWFuZCA9IHsgaWQ6ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMuc2V0dGluZ3MnLCB0aXRsZTogbG9jYWxpemUyKCdzeW5jIHNldHRpbmdzJywgJ1Nob3cgU2V0dGluZ3MnKSwgfTtcbmNvbnN0IHNob3dTeW5jZWREYXRhQ29tbWFuZCA9IHsgaWQ6ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMuc2hvd1N5bmNlZERhdGEnLCB0aXRsZTogbG9jYWxpemUyKCdzaG93IHN5bmNlZCBkYXRhJywgJ1Nob3cgU3luY2VkIERhdGEnKSwgfTtcblxuY29uc3QgQ09OVEVYVF9UVVJOSU5HX09OX1NUQVRFID0gbmV3IFJhd0NvbnRleHRLZXk8ZmFsc2U+KCd1c2VyRGF0YVN5bmNUdXJuaW5nT24nLCBmYWxzZSk7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNXb3JrYmVuY2hDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0dXJuaW5nT25TeW5jQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBnbG9iYWxBY3Rpdml0eUJhZGdlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBhY2NvdW50QmFkZ2VEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZTogSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2U6IElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUFjdGl2aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5U2VydmljZTogSUFjdGl2aXR5U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU91dHB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvdXRwdXRTZXJ2aWNlOiBJT3V0cHV0U2VydmljZSxcblx0XHRASVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlIHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlOiBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElBdXRoZW50aWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXRoZW50aWNhdGlvblNlcnZpY2U6IElBdXRoZW50aWNhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JrYmVuY2hJc3N1ZVNlcnZpY2U6IElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudHVybmluZ09uU3luY0NvbnRleHQgPSBDT05URVhUX1RVUk5JTkdfT05fU1RBVEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGlmICh1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLmVuYWJsZWQpIHtcblx0XHRcdHJlZ2lzdGVyQ29uZmlndXJhdGlvbigpO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZUFjY291bnRCYWRnZSgpO1xuXHRcdFx0dGhpcy51cGRhdGVHbG9iYWxBY3Rpdml0eUJhZGdlKCk7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlQ29uZmxpY3RzKHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5jb25mbGljdHMpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoXG5cdFx0XHRcdEV2ZW50LmRlYm91bmNlKHVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRDaGFuZ2VTdGF0dXMsICgpID0+IHVuZGVmaW5lZCwgNTAwKSxcblx0XHRcdFx0dGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5vbkRpZENoYW5nZUVuYWJsZW1lbnQsXG5cdFx0XHRcdHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5vbkRpZENoYW5nZUFjY291bnRTdGF0dXNcblx0XHRcdCkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUFjY291bnRCYWRnZSgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUdsb2JhbEFjdGl2aXR5QmFkZ2UoKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRDaGFuZ2VDb25mbGljdHMoKCkgPT4gdGhpcy5vbkRpZENoYW5nZUNvbmZsaWN0cyh0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuY29uZmxpY3RzKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VFbmFibGVtZW50KCgpID0+IHRoaXMub25EaWRDaGFuZ2VDb25mbGljdHModGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNvbmZsaWN0cykpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhU3luY1NlcnZpY2Uub25TeW5jRXJyb3JzKGVycm9ycyA9PiB0aGlzLm9uU3luY2hyb25pemVyRXJyb3JzKGVycm9ycykpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLm9uRXJyb3IoZXJyb3IgPT4gdGhpcy5vbkF1dG9TeW5jRXJyb3IoZXJyb3IpKSk7XG5cblx0XHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVmlld3MoKTtcblxuXHRcdFx0dGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKFVTRVJfREFUQV9TWU5DX1NDSEVNRSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFSZW1vdGVDb250ZW50UHJvdmlkZXIpKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KHVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRDaGFuZ2VTdGF0dXMsIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlRW5hYmxlbWVudClcblx0XHRcdFx0KCgpID0+IHRoaXMudHVybmluZ09uU3luYyA9ICF1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSAmJiB1c2VyRGF0YVN5bmNTZXJ2aWNlLnN0YXR1cyAhPT0gU3luY1N0YXR1cy5JZGxlKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgdHVybmluZ09uU3luYygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnR1cm5pbmdPblN5bmNDb250ZXh0LmdldCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgdHVybmluZ09uU3luYyh0dXJuaW5nT246IGJvb2xlYW4pIHtcblx0XHR0aGlzLnR1cm5pbmdPblN5bmNDb250ZXh0LnNldCh0dXJuaW5nT24pO1xuXHRcdHRoaXMudXBkYXRlR2xvYmFsQWN0aXZpdHlCYWRnZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0tleSh7IHN5bmNSZXNvdXJjZTogcmVzb3VyY2UsIHByb2ZpbGUgfTogSVVzZXJEYXRhU3luY1Jlc291cmNlKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7cHJvZmlsZS5pZH06JHtyZXNvdXJjZX1gO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb25mbGljdHNEaXNwb3NhYmxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSBvbkRpZENoYW5nZUNvbmZsaWN0cyhjb25mbGljdHM6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUNvbmZsaWN0c1tdKSB7XG5cdFx0dGhpcy51cGRhdGVHbG9iYWxBY3Rpdml0eUJhZGdlKCk7XG5cdFx0dGhpcy5yZWdpc3RlclNob3dDb25mbGljdHNBY3Rpb24oKTtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcblx0XHRcdC8vIENsZWFyIGFuZCBkaXNwb3NlIGNvbmZsaWN0cyB0aG9zZSB3ZXJlIGNsZWFyZWRcblx0XHRcdGZvciAoY29uc3QgW2tleSwgZGlzcG9zYWJsZV0gb2YgdGhpcy5jb25mbGljdHNEaXNwb3NhYmxlcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0aWYgKCFjb25mbGljdHMuc29tZShjb25mbGljdCA9PiB0aGlzLnRvS2V5KGNvbmZsaWN0KSA9PT0ga2V5KSkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuY29uZmxpY3RzRGlzcG9zYWJsZXMuZGVsZXRlKGtleSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBjb25mbGljdCBvZiB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuY29uZmxpY3RzKSB7XG5cdFx0XHRcdGNvbnN0IGtleSA9IHRoaXMudG9LZXkoY29uZmxpY3QpO1xuXHRcdFx0XHQvLyBTaG93IGNvbmZsaWN0cyBub3RpZmljYXRpb24gaWYgbm90IHNob3duIGJlZm9yZVxuXHRcdFx0XHRpZiAoIXRoaXMuY29uZmxpY3RzRGlzcG9zYWJsZXMuaGFzKGtleSkpIHtcblx0XHRcdFx0XHRjb25zdCBjb25mbGljdHNBcmVhID0gZ2V0U3luY0FyZWFMYWJlbChjb25mbGljdC5zeW5jUmVzb3VyY2UpO1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuV2FybmluZywgbG9jYWxpemUoJ2NvbmZsaWN0cyBkZXRlY3RlZCcsIFwiVW5hYmxlIHRvIHN5bmMgZHVlIHRvIGNvbmZsaWN0cyBpbiB7MH0uIFBsZWFzZSByZXNvbHZlIHRoZW0gdG8gY29udGludWUuXCIsIGNvbmZsaWN0c0FyZWEudG9Mb3dlckNhc2UoKSksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3JlcGxhY2UgcmVtb3RlJywgXCJSZXBsYWNlIFJlbW90ZVwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuYWNjZXB0TG9jYWwoY29uZmxpY3QsIGNvbmZsaWN0LmNvbmZsaWN0c1swXSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXBsYWNlIGxvY2FsJywgXCJSZXBsYWNlIExvY2FsXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5hY2NlcHRSZW1vdGUoY29uZmxpY3QsIGNvbmZsaWN0LmNvbmZsaWN0c1swXSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzaG93IGNvbmZsaWN0cycsIFwiU2hvdyBDb25mbGljdHNcIiksXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjx7IHNvdXJjZTogc3RyaW5nOyBhY3Rpb24/OiBzdHJpbmcgfSwgU3luY0NvbmZsaWN0c0NsYXNzaWZpY2F0aW9uPignc3luYy9zaG93Q29uZmxpY3RzJywgeyBzb3VyY2U6IGNvbmZsaWN0LnN5bmNSZXNvdXJjZSB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5zaG93Q29uZmxpY3RzKGNvbmZsaWN0LmNvbmZsaWN0c1swXSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRzdGlja3k6IHRydWVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdHRoaXMuY29uZmxpY3RzRGlzcG9zYWJsZXMuc2V0KGtleSwgdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0XHRcdC8vIGNsb3NlIHRoZSBjb25mbGljdHMgd2FybmluZyBub3RpZmljYXRpb25cblx0XHRcdFx0XHRcdGhhbmRsZS5jbG9zZSgpO1xuXHRcdFx0XHRcdFx0dGhpcy5jb25mbGljdHNEaXNwb3NhYmxlcy5kZWxldGUoa2V5KTtcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jb25mbGljdHNEaXNwb3NhYmxlcy5mb3JFYWNoKGRpc3Bvc2FibGUgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXHRcdFx0dGhpcy5jb25mbGljdHNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWNjZXB0UmVtb3RlKHN5bmNSZXNvdXJjZTogSVVzZXJEYXRhU3luY1Jlc291cmNlLCBjb25mbGljdDogSVJlc291cmNlUHJldmlldykge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuYWNjZXB0KHN5bmNSZXNvdXJjZSwgY29uZmxpY3QucmVtb3RlUmVzb3VyY2UsIHVuZGVmaW5lZCwgdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGxvY2FsaXplKCdhY2NlcHQgZmFpbGVkJywgXCJFcnJvciB3aGlsZSBhY2NlcHRpbmcgY2hhbmdlcy4gUGxlYXNlIGNoZWNrIFtsb2dzXSh7MH0pIGZvciBtb3JlIGRldGFpbHMuXCIsIGBjb21tYW5kOiR7U0hPV19TWU5DX0xPR19DT01NQU5EX0lEfWApKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFjY2VwdExvY2FsKHN5bmNSZXNvdXJjZTogSVVzZXJEYXRhU3luY1Jlc291cmNlLCBjb25mbGljdDogSVJlc291cmNlUHJldmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuYWNjZXB0KHN5bmNSZXNvdXJjZSwgY29uZmxpY3QubG9jYWxSZXNvdXJjZSwgdW5kZWZpbmVkLCB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ2FjY2VwdCBmYWlsZWQnLCBcIkVycm9yIHdoaWxlIGFjY2VwdGluZyBjaGFuZ2VzLiBQbGVhc2UgY2hlY2sgW2xvZ3NdKHswfSkgZm9yIG1vcmUgZGV0YWlscy5cIiwgYGNvbW1hbmQ6JHtTSE9XX1NZTkNfTE9HX0NPTU1BTkRfSUR9YCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25BdXRvU3luY0Vycm9yKGVycm9yOiBVc2VyRGF0YVN5bmNFcnJvcik6IHZvaWQge1xuXHRcdHN3aXRjaCAoZXJyb3IuY29kZSkge1xuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuU2Vzc2lvbkV4cGlyZWQ6XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdzZXNzaW9uIGV4cGlyZWQnLCBcIlNldHRpbmdzIHN5bmMgd2FzIHR1cm5lZCBvZmYgYmVjYXVzZSBjdXJyZW50IHNlc3Npb24gaXMgZXhwaXJlZCwgcGxlYXNlIHNpZ24gaW4gYWdhaW4gdG8gdHVybiBvbiBzeW5jLlwiKSxcblx0XHRcdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBbdG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRpZDogJ3R1cm4gb24gc3luYycsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndHVybiBvbiBzeW5jJywgXCJUdXJuIG9uIFNldHRpbmdzIFN5bmMuLi5cIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy50dXJuT24oKVxuXHRcdFx0XHRcdFx0fSldXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5UdXJuZWRPZmY6XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd0dXJuZWQgb2ZmJywgXCJTZXR0aW5ncyBzeW5jIHdhcyB0dXJuZWQgb2ZmIGZyb20gYW5vdGhlciBkZXZpY2UsIHBsZWFzZSB0dXJuIG9uIHN5bmMgYWdhaW4uXCIpLFxuXHRcdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IFt0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdGlkOiAndHVybiBvbiBzeW5jJyxcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd0dXJuIG9uIHN5bmMnLCBcIlR1cm4gb24gU2V0dGluZ3MgU3luYy4uLlwiKSxcblx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLnR1cm5PbigpXG5cdFx0XHRcdFx0XHR9KV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlRvb0xhcmdlOlxuXHRcdFx0XHRpZiAoZXJyb3IucmVzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5LZXliaW5kaW5ncyB8fCBlcnJvci5yZXNvdXJjZSA9PT0gU3luY1Jlc291cmNlLlNldHRpbmdzIHx8IGVycm9yLnJlc291cmNlID09PSBTeW5jUmVzb3VyY2UuVGFza3MpIHtcblx0XHRcdFx0XHR0aGlzLmRpc2FibGVTeW5jKGVycm9yLnJlc291cmNlKTtcblx0XHRcdFx0XHRjb25zdCBzb3VyY2VBcmVhID0gZ2V0U3luY0FyZWFMYWJlbChlcnJvci5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVUb29MYXJnZUVycm9yKGVycm9yLnJlc291cmNlLCBsb2NhbGl6ZSgndG9vIGxhcmdlJywgXCJEaXNhYmxlZCBzeW5jaW5nIHswfSBiZWNhdXNlIHNpemUgb2YgdGhlIHsxfSBmaWxlIHRvIHN5bmMgaXMgbGFyZ2VyIHRoYW4gezJ9LiBQbGVhc2Ugb3BlbiB0aGUgZmlsZSBhbmQgcmVkdWNlIHRoZSBzaXplIGFuZCBlbmFibGUgc3luY1wiLCBzb3VyY2VBcmVhLnRvTG93ZXJDYXNlKCksIHNvdXJjZUFyZWEudG9Mb3dlckNhc2UoKSwgJzEwMGtiJyksIGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsVG9vTWFueVByb2ZpbGVzOlxuXHRcdFx0XHR0aGlzLmRpc2FibGVTeW5jKFN5bmNSZXNvdXJjZS5Qcm9maWxlcyk7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgndG9vIG1hbnkgcHJvZmlsZXMnLCBcIkRpc2FibGVkIHN5bmNpbmcgcHJvZmlsZXMgYmVjYXVzZSB0aGVyZSBhcmUgdG9vIG1hbnkgcHJvZmlsZXMgdG8gc3luYy4gU2V0dGluZ3MgU3luYyBzdXBwb3J0cyBzeW5jaW5nIG1heGltdW0gMjAgcHJvZmlsZXMuIFBsZWFzZSByZWR1Y2UgdGhlIG51bWJlciBvZiBwcm9maWxlcyBhbmQgZW5hYmxlIHN5bmNcIikpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkluY29tcGF0aWJsZUxvY2FsQ29udGVudDpcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkdvbmU6XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5VcGdyYWRlUmVxdWlyZWQ6IHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdlcnJvciB1cGdyYWRlIHJlcXVpcmVkJywgXCJTZXR0aW5ncyBzeW5jIGlzIGRpc2FibGVkIGJlY2F1c2UgdGhlIGN1cnJlbnQgdmVyc2lvbiAoezB9LCB7MX0pIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIHN5bmMgc2VydmljZS4gUGxlYXNlIHVwZGF0ZSBiZWZvcmUgdHVybmluZyBvbiBzeW5jLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLnZlcnNpb24sIHRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0KTtcblx0XHRcdFx0Y29uc3Qgb3BlcmF0aW9uSWQgPSBlcnJvci5vcGVyYXRpb25JZCA/IGxvY2FsaXplKCdvcGVyYXRpb25JZCcsIFwiT3BlcmF0aW9uIElkOiB7MH1cIiwgZXJyb3Iub3BlcmF0aW9uSWQpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogb3BlcmF0aW9uSWQgPyBgJHttZXNzYWdlfSAke29wZXJhdGlvbklkfWAgOiBtZXNzYWdlLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5NZXRob2ROb3RGb3VuZDoge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbG9jYWxpemUoJ21ldGhvZCBub3QgZm91bmQnLCBcIlNldHRpbmdzIHN5bmMgaXMgZGlzYWJsZWQgYmVjYXVzZSB0aGUgY2xpZW50IGlzIG1ha2luZyBpbnZhbGlkIHJlcXVlc3RzLiBQbGVhc2UgcmVwb3J0IGFuIGlzc3VlIHdpdGggdGhlIGxvZ3MuXCIpO1xuXHRcdFx0XHRjb25zdCBvcGVyYXRpb25JZCA9IGVycm9yLm9wZXJhdGlvbklkID8gbG9jYWxpemUoJ29wZXJhdGlvbklkJywgXCJPcGVyYXRpb24gSWQ6IHswfVwiLCBlcnJvci5vcGVyYXRpb25JZCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiBvcGVyYXRpb25JZCA/IGAke21lc3NhZ2V9ICR7b3BlcmF0aW9uSWR9YCA6IG1lc3NhZ2UsXG5cdFx0XHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6ICdTaG93IFN5bmMgTG9ncycsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzaG93IHN5bmMgbG9ncycsIFwiU2hvdyBMb2dcIiksXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFNIT1dfU1lOQ19MT0dfQ09NTUFORF9JRClcblx0XHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0XHRcdHRvQWN0aW9uKHtcblx0XHRcdFx0XHRcdFx0XHRpZDogJ1JlcG9ydCBJc3N1ZScsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXBvcnQgaXNzdWUnLCBcIlJlcG9ydCBJc3N1ZVwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMud29ya2JlbmNoSXNzdWVTZXJ2aWNlLm9wZW5SZXBvcnRlcigpXG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5JbmNvbXBhdGlibGVSZW1vdGVDb250ZW50OlxuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2Vycm9yIHJlc2V0IHJlcXVpcmVkJywgXCJTZXR0aW5ncyBzeW5jIGlzIGRpc2FibGVkIGJlY2F1c2UgeW91ciBkYXRhIGluIHRoZSBjbG91ZCBpcyBvbGRlciB0aGFuIHRoYXQgb2YgdGhlIGNsaWVudC4gUGxlYXNlIGNsZWFyIHlvdXIgZGF0YSBpbiB0aGUgY2xvdWQgYmVmb3JlIHR1cm5pbmcgb24gc3luYy5cIiksXG5cdFx0XHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6ICdyZXNldCcsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXNldCcsIFwiQ2xlYXIgRGF0YSBpbiBDbG91ZC4uLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5yZXNldFN5bmNlZERhdGEoKVxuXHRcdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHRcdFx0dG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiAnc2hvdyBzeW5jZWQgZGF0YScsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzaG93IHN5bmNlZCBkYXRhIGFjdGlvbicsIFwiU2hvdyBTeW5jZWQgRGF0YVwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5zaG93U3luY0FjdGl2aXR5KClcblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlNlcnZpY2VDaGFuZ2VkOlxuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRtZXNzYWdlOiB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU/LnR5cGUgPT09ICdpbnNpZGVycycgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3NlcnZpY2Ugc3dpdGNoZWQgdG8gaW5zaWRlcnMnLCBcIlNldHRpbmdzIFN5bmMgaGFzIGJlZW4gc3dpdGNoZWQgdG8gaW5zaWRlcnMgc2VydmljZVwiKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnc2VydmljZSBzd2l0Y2hlZCB0byBzdGFibGUnLCBcIlNldHRpbmdzIFN5bmMgaGFzIGJlZW4gc3dpdGNoZWQgdG8gc3RhYmxlIHNlcnZpY2VcIiksXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRGVmYXVsdFNlcnZpY2VDaGFuZ2VkOlxuXHRcdFx0XHQvLyBTZXR0aW5ncyBzeW5jIGlzIHVzaW5nIHNlcGFyYXRlIHNlcnZpY2Vcblx0XHRcdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3VzaW5nIHNlcGFyYXRlIHNlcnZpY2UnLCBcIlNldHRpbmdzIHN5bmMgbm93IHVzZXMgYSBzZXBhcmF0ZSBzZXJ2aWNlLCBtb3JlIGluZm9ybWF0aW9uIGlzIGF2YWlsYWJsZSBpbiB0aGUgW1NldHRpbmdzIFN5bmMgRG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXNldHRpbmdzLXN5bmMtaGVscCNfc3luY2luZy1zdGFibGUtdmVyc3VzLWluc2lkZXJzKS5cIiksXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiBzZXR0aW5ncyBzeW5jIGdvdCB0dXJuZWQgb2ZmIHRoZW4gYXNrIHVzZXIgdG8gdHVybiBvbiBzeW5jIGFnYWluLlxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3NlcnZpY2UgY2hhbmdlZCBhbmQgdHVybmVkIG9mZicsIFwiU2V0dGluZ3Mgc3luYyB3YXMgdHVybmVkIG9mZiBiZWNhdXNlIHswfSBub3cgdXNlcyBhIHNlcGFyYXRlIHNlcnZpY2UuIFBsZWFzZSB0dXJuIG9uIHN5bmMgYWdhaW4uXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpLFxuXHRcdFx0XHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRwcmltYXJ5OiBbdG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiAndHVybiBvbiBzeW5jJyxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3R1cm4gb24gc3luYycsIFwiVHVybiBvbiBTZXR0aW5ncyBTeW5jLi4uXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy50dXJuT24oKVxuXHRcdFx0XHRcdFx0XHR9KV1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVUb29MYXJnZUVycm9yKHJlc291cmNlOiBTeW5jUmVzb3VyY2UsIG1lc3NhZ2U6IHN0cmluZywgZXJyb3I6IFVzZXJEYXRhU3luY0Vycm9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3BlcmF0aW9uSWQgPSBlcnJvci5vcGVyYXRpb25JZCA/IGxvY2FsaXplKCdvcGVyYXRpb25JZCcsIFwiT3BlcmF0aW9uIElkOiB7MH1cIiwgZXJyb3Iub3BlcmF0aW9uSWQpIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0bWVzc2FnZTogb3BlcmF0aW9uSWQgPyBgJHttZXNzYWdlfSAke29wZXJhdGlvbklkfWAgOiBtZXNzYWdlLFxuXHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRwcmltYXJ5OiBbdG9BY3Rpb24oe1xuXHRcdFx0XHRcdGlkOiAnb3BlbiBzeW5jIGZpbGUnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3BlbiBmaWxlJywgXCJPcGVuIHswfSBGaWxlXCIsIGdldFN5bmNBcmVhTGFiZWwocmVzb3VyY2UpKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHJlc291cmNlID09PSBTeW5jUmVzb3VyY2UuU2V0dGluZ3MgPyB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuVXNlclNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSB9KSA6IHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5HbG9iYWxLZXliaW5kaW5nU2V0dGluZ3ModHJ1ZSlcblx0XHRcdFx0fSldXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGludmFsaWRDb250ZW50RXJyb3JEaXNwb3NhYmxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSBvblN5bmNocm9uaXplckVycm9ycyhlcnJvcnM6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUVycm9yW10pOiB2b2lkIHtcblx0XHRpZiAoZXJyb3JzLmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCB7IHByb2ZpbGUsIHN5bmNSZXNvdXJjZTogcmVzb3VyY2UsIGVycm9yIH0gb2YgZXJyb3JzKSB7XG5cdFx0XHRcdHN3aXRjaCAoZXJyb3IuY29kZSkge1xuXHRcdFx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsSW52YWxpZENvbnRlbnQ6XG5cdFx0XHRcdFx0XHR0aGlzLmhhbmRsZUludmFsaWRDb250ZW50RXJyb3IoeyBwcm9maWxlLCBzeW5jUmVzb3VyY2U6IHJlc291cmNlIH0pO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRcdFx0Y29uc3Qga2V5ID0gYCR7cHJvZmlsZS5pZH06JHtyZXNvdXJjZX1gO1xuXHRcdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuaW52YWxpZENvbnRlbnRFcnJvckRpc3Bvc2FibGVzLmdldChrZXkpO1xuXHRcdFx0XHRcdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaW52YWxpZENvbnRlbnRFcnJvckRpc3Bvc2FibGVzLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmludmFsaWRDb250ZW50RXJyb3JEaXNwb3NhYmxlcy5mb3JFYWNoKGRpc3Bvc2FibGUgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXHRcdFx0dGhpcy5pbnZhbGlkQ29udGVudEVycm9yRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUludmFsaWRDb250ZW50RXJyb3IoeyBwcm9maWxlLCBzeW5jUmVzb3VyY2U6IHNvdXJjZSB9OiBJVXNlckRhdGFTeW5jUmVzb3VyY2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlkICE9PSBwcm9maWxlLmlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGtleSA9IGAke3Byb2ZpbGUuaWR9OiR7c291cmNlfWA7XG5cdFx0aWYgKHRoaXMuaW52YWxpZENvbnRlbnRFcnJvckRpc3Bvc2FibGVzLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChzb3VyY2UgIT09IFN5bmNSZXNvdXJjZS5TZXR0aW5ncyAmJiBzb3VyY2UgIT09IFN5bmNSZXNvdXJjZS5LZXliaW5kaW5ncyAmJiBzb3VyY2UgIT09IFN5bmNSZXNvdXJjZS5UYXNrcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuaG9zdFNlcnZpY2UuaGFzRm9jdXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5TZXR0aW5ncyA/IHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlXG5cdFx0XHQ6IHNvdXJjZSA9PT0gU3luY1Jlc291cmNlLktleWJpbmRpbmdzID8gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2Vcblx0XHRcdFx0OiB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRjb25zdCBlZGl0b3JVcmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaSh0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIGVkaXRvclVyaSkpIHtcblx0XHRcdC8vIERvIG5vdCBzaG93IG5vdGlmaWNhdGlvbiBpZiB0aGUgZmlsZSBpbiBlcnJvciBpcyBhY3RpdmVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZXJyb3JBcmVhID0gZ2V0U3luY0FyZWFMYWJlbChzb3VyY2UpO1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2Vycm9ySW52YWxpZENvbmZpZ3VyYXRpb24nLCBcIlVuYWJsZSB0byBzeW5jIHswfSBiZWNhdXNlIHRoZSBjb250ZW50IGluIHRoZSBmaWxlIGlzIG5vdCB2YWxpZC4gUGxlYXNlIG9wZW4gdGhlIGZpbGUgYW5kIGNvcnJlY3QgaXQuXCIsIGVycm9yQXJlYS50b0xvd2VyQ2FzZSgpKSxcblx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0cHJpbWFyeTogW3RvQWN0aW9uKHtcblx0XHRcdFx0XHRpZDogJ29wZW4gc3luYyBmaWxlJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ29wZW4gZmlsZScsIFwiT3BlbiB7MH0gRmlsZVwiLCBlcnJvckFyZWEpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gc291cmNlID09PSBTeW5jUmVzb3VyY2UuU2V0dGluZ3MgPyB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuVXNlclNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSB9KSA6IHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5HbG9iYWxLZXliaW5kaW5nU2V0dGluZ3ModHJ1ZSlcblx0XHRcdFx0fSldXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5pbnZhbGlkQ29udGVudEVycm9yRGlzcG9zYWJsZXMuc2V0KGtleSwgdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdC8vIGNsb3NlIHRoZSBlcnJvciB3YXJuaW5nIG5vdGlmaWNhdGlvblxuXHRcdFx0aGFuZGxlLmNsb3NlKCk7XG5cdFx0XHR0aGlzLmludmFsaWRDb250ZW50RXJyb3JEaXNwb3NhYmxlcy5kZWxldGUoa2V5KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbmZsaWN0c0NvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5jb25mbGljdHMucmVkdWNlKChyZXN1bHQsIHsgY29uZmxpY3RzIH0pID0+IHsgcmV0dXJuIHJlc3VsdCArIGNvbmZsaWN0cy5sZW5ndGg7IH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVHbG9iYWxBY3Rpdml0eUJhZGdlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuZ2xvYmFsQWN0aXZpdHlCYWRnZURpc3Bvc2FibGUuY2xlYXIoKTtcblxuXHRcdGxldCBiYWRnZTogSUJhZGdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuY29uZmxpY3RzLmxlbmd0aCAmJiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRiYWRnZSA9IG5ldyBOdW1iZXJCYWRnZSh0aGlzLmdldENvbmZsaWN0c0NvdW50KCksICgpID0+IGxvY2FsaXplKCdoYXMgY29uZmxpY3RzJywgXCJ7MH06IENvbmZsaWN0cyBEZXRlY3RlZFwiLCBTWU5DX1RJVExFLnZhbHVlKSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnR1cm5pbmdPblN5bmMpIHtcblx0XHRcdGJhZGdlID0gbmV3IFByb2dyZXNzQmFkZ2UoKCkgPT4gbG9jYWxpemUoJ3R1cm5pbmcgb24gc3luY2luZycsIFwiVHVybmluZyBvbiBTZXR0aW5ncyBTeW5jLi4uXCIpKTtcblx0XHR9XG5cblx0XHRpZiAoYmFkZ2UpIHtcblx0XHRcdHRoaXMuZ2xvYmFsQWN0aXZpdHlCYWRnZURpc3Bvc2FibGUudmFsdWUgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93R2xvYmFsQWN0aXZpdHkoeyBiYWRnZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUFjY291bnRCYWRnZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmFjY291bnRCYWRnZURpc3Bvc2FibGUuY2xlYXIoKTtcblxuXHRcdGxldCBiYWRnZTogSUJhZGdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5zdGF0dXMgIT09IFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCAmJiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpICYmIHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5hY2NvdW50U3RhdHVzID09PSBBY2NvdW50U3RhdHVzLlVuYXZhaWxhYmxlKSB7XG5cdFx0XHRiYWRnZSA9IG5ldyBOdW1iZXJCYWRnZSgxLCAoKSA9PiBsb2NhbGl6ZSgnc2lnbiBpbiB0byBzeW5jJywgXCJTaWduIGluIHRvIFN5bmMgU2V0dGluZ3NcIikpO1xuXHRcdH1cblxuXHRcdGlmIChiYWRnZSkge1xuXHRcdFx0dGhpcy5hY2NvdW50QmFkZ2VEaXNwb3NhYmxlLnZhbHVlID0gdGhpcy5hY3Rpdml0eVNlcnZpY2Uuc2hvd0FjY291bnRzQWN0aXZpdHkoeyBiYWRnZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHR1cm5PbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UuYXV0aGVudGljYXRpb25Qcm92aWRlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm8gYXV0aGVudGljYXRpb24gcHJvdmlkZXJzJywgXCJObyBhdXRoZW50aWNhdGlvbiBwcm92aWRlcnMgYXJlIGF2YWlsYWJsZS5cIikpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdHVybk9uID0gYXdhaXQgdGhpcy5hc2tUb0NvbmZpZ3VyZSgpO1xuXHRcdFx0aWYgKCF0dXJuT24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZT8uY2FuU3dpdGNoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VsZWN0U2V0dGluZ3NTeW5jU2VydmljZSh0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmUpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLnR1cm5PbigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChlIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IpIHtcblx0XHRcdFx0c3dpdGNoIChlLmNvZGUpIHtcblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Ub29MYXJnZTpcblx0XHRcdFx0XHRcdGlmIChlLnJlc291cmNlID09PSBTeW5jUmVzb3VyY2UuS2V5YmluZGluZ3MgfHwgZS5yZXNvdXJjZSA9PT0gU3luY1Jlc291cmNlLlNldHRpbmdzIHx8IGUucmVzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5UYXNrcykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmhhbmRsZVRvb0xhcmdlRXJyb3IoZS5yZXNvdXJjZSwgbG9jYWxpemUoJ3RvbyBsYXJnZSB3aGlsZSBzdGFydGluZyBzeW5jJywgXCJTZXR0aW5ncyBzeW5jIGNhbm5vdCBiZSB0dXJuZWQgb24gYmVjYXVzZSBzaXplIG9mIHRoZSB7MH0gZmlsZSB0byBzeW5jIGlzIGxhcmdlciB0aGFuIHsxfS4gUGxlYXNlIG9wZW4gdGhlIGZpbGUgYW5kIHJlZHVjZSB0aGUgc2l6ZSBhbmQgdHVybiBvbiBzeW5jXCIsIGdldFN5bmNBcmVhTGFiZWwoZS5yZXNvdXJjZSkudG9Mb3dlckNhc2UoKSwgJzEwMGtiJyksIGUpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5JbmNvbXBhdGlibGVMb2NhbENvbnRlbnQ6XG5cdFx0XHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuR29uZTpcblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5VcGdyYWRlUmVxdWlyZWQ6IHtcblx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBsb2NhbGl6ZSgnZXJyb3IgdXBncmFkZSByZXF1aXJlZCB3aGlsZSBzdGFydGluZyBzeW5jJywgXCJTZXR0aW5ncyBzeW5jIGNhbm5vdCBiZSB0dXJuZWQgb24gYmVjYXVzZSB0aGUgY3VycmVudCB2ZXJzaW9uICh7MH0sIHsxfSkgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgc3luYyBzZXJ2aWNlLiBQbGVhc2UgdXBkYXRlIGJlZm9yZSB0dXJuaW5nIG9uIHN5bmMuXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgdGhpcy5wcm9kdWN0U2VydmljZS5jb21taXQpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3BlcmF0aW9uSWQgPSBlLm9wZXJhdGlvbklkID8gbG9jYWxpemUoJ29wZXJhdGlvbklkJywgXCJPcGVyYXRpb24gSWQ6IHswfVwiLCBlLm9wZXJhdGlvbklkKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG9wZXJhdGlvbklkID8gYCR7bWVzc2FnZX0gJHtvcGVyYXRpb25JZH1gIDogbWVzc2FnZSxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5JbmNvbXBhdGlibGVSZW1vdGVDb250ZW50OlxuXHRcdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2Vycm9yIHJlc2V0IHJlcXVpcmVkIHdoaWxlIHN0YXJ0aW5nIHN5bmMnLCBcIlNldHRpbmdzIHN5bmMgY2Fubm90IGJlIHR1cm5lZCBvbiBiZWNhdXNlIHlvdXIgZGF0YSBpbiB0aGUgY2xvdWQgaXMgb2xkZXIgdGhhbiB0aGF0IG9mIHRoZSBjbGllbnQuIFBsZWFzZSBjbGVhciB5b3VyIGRhdGEgaW4gdGhlIGNsb3VkIGJlZm9yZSB0dXJuaW5nIG9uIHN5bmMuXCIpLFxuXHRcdFx0XHRcdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHRcdFx0dG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZDogJ3Jlc2V0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXNldCcsIFwiQ2xlYXIgRGF0YSBpbiBDbG91ZC4uLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UucmVzZXRTeW5jZWREYXRhKClcblx0XHRcdFx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0dG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZDogJ3Nob3cgc3luY2VkIGRhdGEnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Nob3cgc3luY2VkIGRhdGEgYWN0aW9uJywgXCJTaG93IFN5bmNlZCBEYXRhXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5zaG93U3luY0FjdGl2aXR5KClcblx0XHRcdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5VbmF1dGhvcml6ZWQ6XG5cdFx0XHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRm9yYmlkZGVuOlxuXHRcdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGxvY2FsaXplKCdhdXRoIGZhaWxlZCcsIFwiRXJyb3Igd2hpbGUgdHVybmluZyBvbiBTZXR0aW5ncyBTeW5jOiBBdXRoZW50aWNhdGlvbiBmYWlsZWQuXCIpKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ3R1cm4gb24gZmFpbGVkIHdpdGggdXNlciBkYXRhIHN5bmMgZXJyb3InLCBcIkVycm9yIHdoaWxlIHR1cm5pbmcgb24gU2V0dGluZ3MgU3luYy4gUGxlYXNlIGNoZWNrIFtsb2dzXSh7MH0pIGZvciBtb3JlIGRldGFpbHMuXCIsIGBjb21tYW5kOiR7U0hPV19TWU5DX0xPR19DT01NQU5EX0lEfWApKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSh7IGtleTogJ3R1cm4gb24gZmFpbGVkJywgY29tbWVudDogWydTdWJzdGl0dXRpb24gaXMgZm9yIGVycm9yIHJlYXNvbiddIH0sIFwiRXJyb3Igd2hpbGUgdHVybmluZyBvbiBTZXR0aW5ncyBTeW5jLiB7MH1cIiwgZ2V0RXJyb3JNZXNzYWdlKGUpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhc2tUb0NvbmZpZ3VyZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oKGMsIGUpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCBxdWlja1BpY2sgPSB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxDb25maWd1cmVTeW5jUXVpY2tQaWNrSXRlbT4oKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2spO1xuXHRcdFx0cXVpY2tQaWNrLnRpdGxlID0gU1lOQ19USVRMRS52YWx1ZTtcblx0XHRcdHF1aWNrUGljay5vayA9IGZhbHNlO1xuXHRcdFx0cXVpY2tQaWNrLmN1c3RvbUJ1dHRvbiA9IHRydWU7XG5cdFx0XHRxdWlja1BpY2suY3VzdG9tTGFiZWwgPSBsb2NhbGl6ZSgnc2lnbiBpbiBhbmQgdHVybiBvbicsIFwiU2lnbiBpblwiKTtcblx0XHRcdHF1aWNrUGljay5kZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdjb25maWd1cmUgYW5kIHR1cm4gb24gc3luYyBkZXRhaWwnLCBcIlBsZWFzZSBzaWduIGluIHRvIGJhY2t1cCBhbmQgc3luYyB5b3VyIGRhdGEgYWNyb3NzIGRldmljZXMuXCIpO1xuXHRcdFx0cXVpY2tQaWNrLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdFx0cXVpY2tQaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRcdHF1aWNrUGljay5oaWRlSW5wdXQgPSB0cnVlO1xuXHRcdFx0cXVpY2tQaWNrLmhpZGVDaGVja0FsbCA9IHRydWU7XG5cblx0XHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5nZXRDb25maWd1cmVTeW5jUXVpY2tQaWNrSXRlbXMoKTtcblx0XHRcdHF1aWNrUGljay5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0cXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMgPSBpdGVtcy5maWx0ZXIoaXRlbSA9PiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzUmVzb3VyY2VFbmFibGVkKGl0ZW0uaWQsIHRydWUpKTtcblx0XHRcdGxldCBhY2NlcHRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKEV2ZW50LmFueShxdWlja1BpY2sub25EaWRBY2NlcHQsIHF1aWNrUGljay5vbkRpZEN1c3RvbSkoKCkgPT4ge1xuXHRcdFx0XHRhY2NlcHRlZCA9IHRydWU7XG5cdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKGFjY2VwdGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUNvbmZpZ3VyYXRpb24oaXRlbXMsIHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YyhhY2NlcHRlZCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0ZShlcnJvcik7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRxdWlja1BpY2suc2hvdygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb25maWd1cmVTeW5jUXVpY2tQaWNrSXRlbXMoKTogQ29uZmlndXJlU3luY1F1aWNrUGlja0l0ZW1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gW3tcblx0XHRcdGlkOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsXG5cdFx0XHRsYWJlbDogZ2V0U3luY0FyZWFMYWJlbChTeW5jUmVzb3VyY2UuU2V0dGluZ3MpXG5cdFx0fSwge1xuXHRcdFx0aWQ6IFN5bmNSZXNvdXJjZS5LZXliaW5kaW5ncyxcblx0XHRcdGxhYmVsOiBnZXRTeW5jQXJlYUxhYmVsKFN5bmNSZXNvdXJjZS5LZXliaW5kaW5ncyksXG5cdFx0fSwge1xuXHRcdFx0aWQ6IFN5bmNSZXNvdXJjZS5TbmlwcGV0cyxcblx0XHRcdGxhYmVsOiBnZXRTeW5jQXJlYUxhYmVsKFN5bmNSZXNvdXJjZS5TbmlwcGV0cylcblx0XHR9LCB7XG5cdFx0XHRpZDogU3luY1Jlc291cmNlLlRhc2tzLFxuXHRcdFx0bGFiZWw6IGdldFN5bmNBcmVhTGFiZWwoU3luY1Jlc291cmNlLlRhc2tzKVxuXHRcdH0sIHtcblx0XHRcdGlkOiBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGUsXG5cdFx0XHRsYWJlbDogZ2V0U3luY0FyZWFMYWJlbChTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGUpLFxuXHRcdH0sIHtcblx0XHRcdGlkOiBTeW5jUmVzb3VyY2UuRXh0ZW5zaW9ucyxcblx0XHRcdGxhYmVsOiBnZXRTeW5jQXJlYUxhYmVsKFN5bmNSZXNvdXJjZS5FeHRlbnNpb25zKVxuXHRcdH0sIHtcblx0XHRcdGlkOiBTeW5jUmVzb3VyY2UuUHJvZmlsZXMsXG5cdFx0XHRsYWJlbDogZ2V0U3luY0FyZWFMYWJlbChTeW5jUmVzb3VyY2UuUHJvZmlsZXMpLFxuXHRcdH1dO1xuXG5cdFx0Ly8gaWYgdGhlIGByZXVzYWJsZSBwcm9tcHRgIGZlYXR1cmUgaXMgZW5hYmxlZCBhbmQgaW4gdnNjb2RlXG5cdFx0Ly8gaW5zaWRlcnMsIGFkZCB0aGUgYFByb21wdHNgIHJlc291cmNlIGl0ZW0gdG8gdGhlIGxpc3Rcblx0XHRpZiAoUHJvbXB0c0NvbmZpZy5lbmFibGVkKHRoaXMuY29uZmlnU2VydmljZSkgPT09IHRydWUpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0aWQ6IFN5bmNSZXNvdXJjZS5Qcm9tcHRzLFxuXHRcdFx0XHRsYWJlbDogZ2V0U3luY0FyZWFMYWJlbChTeW5jUmVzb3VyY2UuUHJvbXB0cylcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZpZ3VyYXRpb24oaXRlbXM6IENvbmZpZ3VyZVN5bmNRdWlja1BpY2tJdGVtW10sIHNlbGVjdGVkSXRlbXM6IFJlYWRvbmx5QXJyYXk8Q29uZmlndXJlU3luY1F1aWNrUGlja0l0ZW0+KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG5cdFx0XHRjb25zdCB3YXNFbmFibGVkID0gdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc1Jlc291cmNlRW5hYmxlZChpdGVtLmlkKTtcblx0XHRcdGNvbnN0IGlzRW5hYmxlZCA9ICEhc2VsZWN0ZWRJdGVtcy5maWx0ZXIoc2VsZWN0ZWQgPT4gc2VsZWN0ZWQuaWQgPT09IGl0ZW0uaWQpWzBdO1xuXHRcdFx0aWYgKHdhc0VuYWJsZWQgIT09IGlzRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLnNldFJlc291cmNlRW5hYmxlbWVudChpdGVtLmlkLCBpc0VuYWJsZWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY29uZmlndXJlU3luY09wdGlvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChjLCBlKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgcXVpY2tQaWNrID0gdGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8Q29uZmlndXJlU3luY1F1aWNrUGlja0l0ZW0+KCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrKTtcblx0XHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCdjb25maWd1cmUgc3luYyB0aXRsZScsIFwiezB9OiBDb25maWd1cmUuLi5cIiwgU1lOQ19USVRMRS52YWx1ZSk7XG5cdFx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnY29uZmlndXJlIHN5bmMgcGxhY2Vob2xkZXInLCBcIkNob29zZSB3aGF0IHRvIHN5bmNcIik7XG5cdFx0XHRxdWlja1BpY2suY2FuU2VsZWN0TWFueSA9IHRydWU7XG5cdFx0XHRxdWlja1BpY2suaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXHRcdFx0cXVpY2tQaWNrLm9rID0gdHJ1ZTtcblx0XHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5nZXRDb25maWd1cmVTeW5jUXVpY2tQaWNrSXRlbXMoKTtcblx0XHRcdHF1aWNrUGljay5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0cXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMgPSBpdGVtcy5maWx0ZXIoaXRlbSA9PiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzUmVzb3VyY2VFbmFibGVkKGl0ZW0uaWQpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVDb25maWd1cmF0aW9uKGl0ZW1zLCBxdWlja1BpY2suc2VsZWN0ZWRJdGVtcyk7XG5cdFx0XHRcdFx0cXVpY2tQaWNrLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGMoKTtcblx0XHRcdH0pKTtcblx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHR1cm5PZmYoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3R1cm4gb2ZmIHN5bmMgY29uZmlybWF0aW9uJywgXCJEbyB5b3Ugd2FudCB0byB0dXJuIG9mZiBzeW5jP1wiKSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ3R1cm4gb2ZmIHN5bmMgZGV0YWlsJywgXCJZb3VyIHNldHRpbmdzLCBrZXliaW5kaW5ncywgZXh0ZW5zaW9ucywgc25pcHBldHMgYW5kIFVJIFN0YXRlIHdpbGwgbm8gbG9uZ2VyIGJlIHN5bmNlZC5cIiksXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3R1cm4gb2ZmJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVHVybiBvZmZcIiksXG5cdFx0XHRjaGVja2JveDogdGhpcy51c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLmFjY291bnRTdGF0dXMgPT09IEFjY291bnRTdGF0dXMuQXZhaWxhYmxlID8ge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3R1cm4gb2ZmIHN5bmMgZXZlcnl3aGVyZScsIFwiVHVybiBvZmYgc3luYyBvbiBhbGwgeW91ciBkZXZpY2VzIGFuZCBjbGVhciB0aGUgZGF0YSBmcm9tIHRoZSBjbG91ZC5cIilcblx0XHRcdH0gOiB1bmRlZmluZWRcblx0XHR9KTtcblx0XHRpZiAocmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS50dXJub2ZmKCEhcmVzdWx0LmNoZWNrYm94Q2hlY2tlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkaXNhYmxlU3luYyhzb3VyY2U6IFN5bmNSZXNvdXJjZSk6IHZvaWQge1xuXHRcdHN3aXRjaCAoc291cmNlKSB7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TZXR0aW5nczogcmV0dXJuIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uuc2V0UmVzb3VyY2VFbmFibGVtZW50KFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgZmFsc2UpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuS2V5YmluZGluZ3M6IHJldHVybiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLnNldFJlc291cmNlRW5hYmxlbWVudChTeW5jUmVzb3VyY2UuS2V5YmluZGluZ3MsIGZhbHNlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlNuaXBwZXRzOiByZXR1cm4gdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5zZXRSZXNvdXJjZUVuYWJsZW1lbnQoU3luY1Jlc291cmNlLlNuaXBwZXRzLCBmYWxzZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5UYXNrczogcmV0dXJuIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uuc2V0UmVzb3VyY2VFbmFibGVtZW50KFN5bmNSZXNvdXJjZS5UYXNrcywgZmFsc2UpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuRXh0ZW5zaW9uczogcmV0dXJuIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uuc2V0UmVzb3VyY2VFbmFibGVtZW50KFN5bmNSZXNvdXJjZS5FeHRlbnNpb25zLCBmYWxzZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5HbG9iYWxTdGF0ZTogcmV0dXJuIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uuc2V0UmVzb3VyY2VFbmFibGVtZW50KFN5bmNSZXNvdXJjZS5HbG9iYWxTdGF0ZSwgZmFsc2UpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuUHJvZmlsZXM6IHJldHVybiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLnNldFJlc291cmNlRW5hYmxlbWVudChTeW5jUmVzb3VyY2UuUHJvZmlsZXMsIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3dTeW5jQWN0aXZpdHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMub3V0cHV0U2VydmljZS5zaG93Q2hhbm5lbChVU0VSX0RBVEFfU1lOQ19MT0dfSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZWxlY3RTZXR0aW5nc1N5bmNTZXJ2aWNlKHVzZXJEYXRhU3luY1N0b3JlOiBJVXNlckRhdGFTeW5jU3RvcmUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCBxdWlja1BpY2sgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8eyBpZDogVXNlckRhdGFTeW5jU3RvcmVUeXBlOyBsYWJlbDogc3RyaW5nOyBkZXNjcmlwdGlvbj86IHN0cmluZyB9PigpKTtcblx0XHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCdzd2l0Y2hTeW5jU2VydmljZS50aXRsZScsIFwiezB9OiBTZWxlY3QgU2VydmljZVwiLCBTWU5DX1RJVExFLnZhbHVlKTtcblx0XHRcdHF1aWNrUGljay5kZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdzd2l0Y2hTeW5jU2VydmljZS5kZXNjcmlwdGlvbicsIFwiRW5zdXJlIHlvdSBhcmUgdXNpbmcgdGhlIHNhbWUgc2V0dGluZ3Mgc3luYyBzZXJ2aWNlIHdoZW4gc3luY2luZyB3aXRoIG11bHRpcGxlIGVudmlyb25tZW50c1wiKTtcblx0XHRcdHF1aWNrUGljay5oaWRlSW5wdXQgPSB0cnVlO1xuXHRcdFx0cXVpY2tQaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRcdGNvbnN0IGdldERlc2NyaXB0aW9uID0gKHVybDogVVJJKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0Y29uc3QgaXNEZWZhdWx0ID0gaXNFcXVhbCh1cmwsIHVzZXJEYXRhU3luY1N0b3JlLmRlZmF1bHRVcmwpO1xuXHRcdFx0XHRpZiAoaXNEZWZhdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdkZWZhdWx0JywgXCJEZWZhdWx0XCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9O1xuXHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdpbnNpZGVycycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdpbnNpZGVycycsIFwiSW5zaWRlcnNcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGdldERlc2NyaXB0aW9uKHVzZXJEYXRhU3luY1N0b3JlLmluc2lkZXJzVXJsKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdzdGFibGUnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc3RhYmxlJywgXCJTdGFibGVcIiksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGdldERlc2NyaXB0aW9uKHVzZXJEYXRhU3luY1N0b3JlLnN0YWJsZVVybClcblx0XHRcdFx0fVxuXHRcdFx0XTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2gocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0uaWQpO1xuXHRcdFx0XHRcdGMoKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRlKGVycm9yKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWN0aW9ucygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5jYW5Ub2dnbGVFbmFibGVtZW50KCkpIHtcblx0XHRcdHRoaXMucmVnaXN0ZXJUdXJuT25TeW5jQWN0aW9uKCk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVHVybk9mZlN5bmNBY3Rpb24oKTtcblx0XHR9XG5cdFx0dGhpcy5yZWdpc3RlclR1cm5pbmdPblN5bmNBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyQ2FuY2VsVHVybk9uU3luY0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJTaWduSW5BY3Rpb24oKTsgLy8gV2hlbiBTeW5jIGlzIHR1cm5lZCBvbiBmcm9tIENMSVxuXHRcdHRoaXMucmVnaXN0ZXJTaG93Q29uZmxpY3RzQWN0aW9uKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRW5hYmxlU3luY1ZpZXdzQWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3Rlck1hbmFnZVN5bmNBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyU3luY05vd0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJDb25maWd1cmVTeW5jQWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3RlclNob3dTZXR0aW5nc0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJIZWxwQWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3RlclNob3dMb2dBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyUmVzZXRTeW5jRGF0YUFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJBY2NlcHRNZXJnZXNBY3Rpb24oKTtcblxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0dGhpcy5yZWdpc3RlckRvd25sb2FkU3luY0FjdGl2aXR5QWN0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclR1cm5PblN5bmNBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0Y29uc3Qgd2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NZTkNfU1RBVEUubm90RXF1YWxzVG8oU3luY1N0YXR1cy5VbmluaXRpYWxpemVkKSwgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQudG9OZWdhdGVkKCksIENPTlRFWFRfVFVSTklOR19PTl9TVEFURS5uZWdhdGUoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFR1cm5pbmdPblN5bmNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMudHVybk9uJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdnbG9iYWwgYWN0aXZpdHkgdHVybiBvbiBzeW5jJywgJ0JhY2t1cCBhbmQgU3luYyBTZXR0aW5ncy4uLicpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBTWU5DX1RJVExFLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogd2hlbixcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0Z3JvdXA6ICczX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5HbG9iYWxBY3Rpdml0eSxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGdyb3VwOiAnM19jb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhclByZWZlcmVuY2VzTWVudSxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGdyb3VwOiAnMV9zZXR0aW5ncycsXG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkFjY291bnRzQ29udGV4dCxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnR1cm5PbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJUdXJuaW5nT25TeW5jQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHdoZW4gPSBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TWU5DX1NUQVRFLm5vdEVxdWFsc1RvKFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCksIENPTlRFWFRfU1lOQ19FTkFCTEVNRU5ULnRvTmVnYXRlZCgpLCBDT05URVhUX1RVUk5JTkdfT05fU1RBVEUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUdXJuaW5nT25TeW5jQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnVzZXJEYXRhLmFjdGlvbnMudHVybmluZ09uJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3R1cm5pbmcgb24gc3luYycsIFwiVHVybmluZyBvbiBTZXR0aW5ncyBTeW5jLi4uXCIpLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZmFsc2UoKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0Z3JvdXA6ICczX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5HbG9iYWxBY3Rpdml0eSxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGdyb3VwOiAnMV9zZXR0aW5ncycsXG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkFjY291bnRzQ29udGV4dCxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHsgfVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDYW5jZWxUdXJuT25TeW5jQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUdXJuaW5nT25TeW5jQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnVzZXJEYXRhLmFjdGlvbnMuY2FuY2VsVHVybk9uJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NhbmNlbCB0dXJuaW5nIG9uIHN5bmMnLCBcIkNhbmNlbFwiKSxcblx0XHRcdFx0XHRpY29uOiBDb2RpY29uLnN0b3BDaXJjbGUsXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9UVVJOSU5HX09OX1NUQVRFLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBTWU5DX1ZJRVdfQ09OVEFJTkVSX0lEKSksXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UudHVybm9mZihmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNpZ25JbkFjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBpZCA9ICd3b3JrYmVuY2gudXNlckRhdGEuYWN0aW9ucy5zaWduaW4nO1xuXHRcdGNvbnN0IHdoZW4gPSBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TWU5DX1NUQVRFLm5vdEVxdWFsc1RvKFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCksIENPTlRFWFRfU1lOQ19FTkFCTEVNRU5ULCBDT05URVhUX0FDQ09VTlRfU1RBVEUuaXNFcXVhbFRvKEFjY291bnRTdGF0dXMuVW5hdmFpbGFibGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgU3RvcFN5bmNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gudXNlckRhdGEuYWN0aW9ucy5zaWduaW4nLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2lnbiBpbiBnbG9iYWwnLCBcIlNpZ24gaW4gdG8gU3luYyBTZXR0aW5nc1wiKSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRncm91cDogJzNfY29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkdsb2JhbEFjdGl2aXR5LFxuXHRcdFx0XHRcdFx0d2hlbixcblx0XHRcdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoYXQudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5zaWduSW4oKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoYXQubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkFjY291bnRzQ29udGV4dCwge1xuXHRcdFx0Z3JvdXA6ICcxX3NldHRpbmdzJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2lnbiBpbiBhY2NvdW50cycsIFwiU2lnbiBpbiB0byBTeW5jIFNldHRpbmdzICgxKVwiKSxcblx0XHRcdH0sXG5cdFx0XHR3aGVuXG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTaG93Q29uZmxpY3RzVGl0bGUoKTogSUxvY2FsaXplZFN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplMigncmVzb2x2ZUNvbmZsaWN0c19nbG9iYWwnLCBcIlNob3cgQ29uZmxpY3RzICh7MH0pXCIsIHRoaXMuZ2V0Q29uZmxpY3RzQ291bnQoKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZsaWN0c0FjdGlvbkRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVnaXN0ZXJTaG93Q29uZmxpY3RzQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuY29uZmxpY3RzQWN0aW9uRGlzcG9zYWJsZS52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLmNvbmZsaWN0c0FjdGlvbkRpc3Bvc2FibGUudmFsdWUgPSByZWdpc3RlckFjdGlvbjIoY2xhc3MgVHVybmluZ09uU3luY0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogc2hvd0NvbmZsaWN0c0NvbW1hbmRJZCxcblx0XHRcdFx0XHRnZXQgdGl0bGUoKSB7IHJldHVybiB0aGF0LmdldFNob3dDb25mbGljdHNUaXRsZSgpOyB9LFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBTWU5DX1RJVExFLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9IQVNfQ09ORkxJQ1RTLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRncm91cDogJzNfY29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkdsb2JhbEFjdGl2aXR5LFxuXHRcdFx0XHRcdFx0d2hlbjogQ09OVEVYVF9IQVNfQ09ORkxJQ1RTLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRncm91cDogJzNfY29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJQcmVmZXJlbmNlc01lbnUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDT05URVhUX0hBU19DT05GTElDVFMsXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2Uuc2hvd0NvbmZsaWN0cygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck1hbmFnZVN5bmNBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0Y29uc3Qgd2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NZTkNfRU5BQkxFTUVOVCwgQ09OVEVYVF9BQ0NPVU5UX1NUQVRFLm5vdEVxdWFsc1RvKEFjY291bnRTdGF0dXMuVW5hdmFpbGFibGUpLCBDT05URVhUX1NZTkNfU1RBVEUubm90RXF1YWxzVG8oU3luY1N0YXR1cy5VbmluaXRpYWxpemVkKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFN5bmNTdGF0dXNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gudXNlckRhdGFTeW5jLmFjdGlvbnMubWFuYWdlJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3N5bmMgaXMgb24nLCBcIlNldHRpbmdzIFN5bmMgaXMgT25cIiksXG5cdFx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleVRydWVFeHByLklOU1RBTkNFLFxuXHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5HbG9iYWxBY3Rpdml0eSxcblx0XHRcdFx0XHRcdFx0Z3JvdXA6ICczX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHR3aGVuLFxuXHRcdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyUHJlZmVyZW5jZXNNZW51LFxuXHRcdFx0XHRcdFx0XHRncm91cDogJzNfY29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5BY2NvdW50c0NvbnRleHQsXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMV9zZXR0aW5ncycsXG5cdFx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB1bmtub3duIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChjLCBlKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRcdGNvbnN0IHF1aWNrUGljayA9IHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljayh7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljayk7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbXM6IEFycmF5PFF1aWNrUGlja0l0ZW0+ID0gW107XG5cdFx0XHRcdFx0aWYgKHRoYXQudXNlckRhdGFTeW5jU2VydmljZS5jb25mbGljdHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKHsgaWQ6IHNob3dDb25mbGljdHNDb21tYW5kSWQsIGxhYmVsOiBgJHtTWU5DX1RJVExFLnZhbHVlfTogJHt0aGF0LmdldFNob3dDb25mbGljdHNUaXRsZSgpLm9yaWdpbmFsfWAgfSk7XG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBpZDogY29uZmlndXJlU3luY0NvbW1hbmQuaWQsIGxhYmVsOiBgJHtTWU5DX1RJVExFLnZhbHVlfTogJHtjb25maWd1cmVTeW5jQ29tbWFuZC50aXRsZS5vcmlnaW5hbH1gIH0pO1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBpZDogc2hvd1N5bmNTZXR0aW5nc0NvbW1hbmQuaWQsIGxhYmVsOiBgJHtTWU5DX1RJVExFLnZhbHVlfTogJHtzaG93U3luY1NldHRpbmdzQ29tbWFuZC50aXRsZS5vcmlnaW5hbH1gIH0pO1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBpZDogc2hvd1N5bmNlZERhdGFDb21tYW5kLmlkLCBsYWJlbDogYCR7U1lOQ19USVRMRS52YWx1ZX06ICR7c2hvd1N5bmNlZERhdGFDb21tYW5kLnRpdGxlLm9yaWdpbmFsfWAgfSk7XG5cdFx0XHRcdFx0aXRlbXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InIH0pO1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBpZDogc3luY05vd0NvbW1hbmQuaWQsIGxhYmVsOiBgJHtTWU5DX1RJVExFLnZhbHVlfTogJHtzeW5jTm93Q29tbWFuZC50aXRsZS5vcmlnaW5hbH1gLCBkZXNjcmlwdGlvbjogc3luY05vd0NvbW1hbmQuZGVzY3JpcHRpb24odGhhdC51c2VyRGF0YVN5bmNTZXJ2aWNlKSB9KTtcblx0XHRcdFx0XHRpZiAodGhhdC51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5jYW5Ub2dnbGVFbmFibGVtZW50KCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFjY291bnQgPSB0aGF0LnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UuY3VycmVudDtcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBpZDogdHVybk9mZlN5bmNDb21tYW5kLmlkLCBsYWJlbDogYCR7U1lOQ19USVRMRS52YWx1ZX06ICR7dHVybk9mZlN5bmNDb21tYW5kLnRpdGxlLm9yaWdpbmFsfWAsIGRlc2NyaXB0aW9uOiBhY2NvdW50ID8gYCR7YWNjb3VudC5hY2NvdW50TmFtZX0gKCR7dGhhdC5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIoYWNjb3VudC5hdXRoZW50aWNhdGlvblByb3ZpZGVySWQpLmxhYmVsfSlgIDogdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRxdWlja1BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0XHRcdGlmIChxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXSAmJiBxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXS5pZCkge1xuXHRcdFx0XHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXS5pZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRjKCk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJFbmFibGVTeW5jVmlld3NBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0Y29uc3Qgd2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0FDQ09VTlRfU1RBVEUuaXNFcXVhbFRvKEFjY291bnRTdGF0dXMuQXZhaWxhYmxlKSwgQ09OVEVYVF9TWU5DX1NUQVRFLm5vdEVxdWFsc1RvKFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTeW5jU3RhdHVzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBzaG93U3luY2VkRGF0YUNvbW1hbmQuaWQsXG5cdFx0XHRcdFx0dGl0bGU6IHNob3dTeW5jZWREYXRhQ29tbWFuZC50aXRsZSxcblx0XHRcdFx0XHRjYXRlZ29yeTogU1lOQ19USVRMRSxcblx0XHRcdFx0XHRwcmVjb25kaXRpb246IHdoZW4sXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2Uuc2hvd1N5bmNBY3Rpdml0eSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTeW5jTm93QWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTeW5jTm93QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBzeW5jTm93Q29tbWFuZC5pZCxcblx0XHRcdFx0XHR0aXRsZTogc3luY05vd0NvbW1hbmQudGl0bGUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFNZTkNfVElUTEUsXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NZTkNfRU5BQkxFTUVOVCwgQ09OVEVYVF9BQ0NPVU5UX1NUQVRFLmlzRXF1YWxUbyhBY2NvdW50U3RhdHVzLkF2YWlsYWJsZSksIENPTlRFWFRfU1lOQ19TVEFURS5ub3RFcXVhbHNUbyhTeW5jU3RhdHVzLlVuaW5pdGlhbGl6ZWQpKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC51c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLnN5bmNOb3coKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVHVybk9mZlN5bmNBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFN0b3BTeW5jQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiB0dXJuT2ZmU3luY0NvbW1hbmQuaWQsXG5cdFx0XHRcdFx0dGl0bGU6IHR1cm5PZmZTeW5jQ29tbWFuZC50aXRsZSxcblx0XHRcdFx0XHRjYXRlZ29yeTogU1lOQ19USVRMRSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU1lOQ19TVEFURS5ub3RFcXVhbHNUbyhTeW5jU3RhdHVzLlVuaW5pdGlhbGl6ZWQpLCBDT05URVhUX1NZTkNfRU5BQkxFTUVOVCksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCB0aGF0LnR1cm5PZmYoKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0XHRcdFx0dGhhdC5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGxvY2FsaXplKCd0dXJuIG9mZiBmYWlsZWQnLCBcIkVycm9yIHdoaWxlIHR1cm5pbmcgb2ZmIFNldHRpbmdzIFN5bmMuIFBsZWFzZSBjaGVjayBbbG9nc10oezB9KSBmb3IgbW9yZSBkZXRhaWxzLlwiLCBgY29tbWFuZDoke1NIT1dfU1lOQ19MT0dfQ09NTUFORF9JRH1gKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbmZpZ3VyZVN5bmNBY3Rpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0Y29uc3Qgd2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NZTkNfU1RBVEUubm90RXF1YWxzVG8oU3luY1N0YXR1cy5VbmluaXRpYWxpemVkKSwgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDb25maWd1cmVTeW5jQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBjb25maWd1cmVTeW5jQ29tbWFuZC5pZCxcblx0XHRcdFx0XHR0aXRsZTogY29uZmlndXJlU3luY0NvbW1hbmQudGl0bGUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFNZTkNfVElUTEUsXG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5zZXR0aW5nc0dlYXIsXG5cdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2NvbmZpZ3VyZScsIFwiQ29uZmlndXJlLi4uXCIpLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlblxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU1lOQ19FTkFCTEVNRU5ULCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBTWU5DX1ZJRVdfQ09OVEFJTkVSX0lEKSksXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bigpOiB1bmtub3duIHsgcmV0dXJuIHRoYXQuY29uZmlndXJlU3luY09wdGlvbnMoKTsgfVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTaG93TG9nQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTaG93U3luY0FjdGl2aXR5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBTSE9XX1NZTkNfTE9HX0NPTU1BTkRfSUQsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzaG93IHN5bmMgbG9nIHRpdGxlJywgXCJ7MH06IFNob3cgTG9nXCIsIFNZTkNfVElUTEUudmFsdWUpLFxuXHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdzaG93IHN5bmMgbG9nIHRvb2xyaXAnLCBcIlNob3cgTG9nXCIpLFxuXHRcdFx0XHRcdGljb246IENvZGljb24ub3V0cHV0LFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU1lOQ19TVEFURS5ub3RFcXVhbHNUbyhTeW5jU3RhdHVzLlVuaW5pdGlhbGl6ZWQpKSxcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFNZTkNfVklFV19DT05UQUlORVJfSUQpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKCk6IHVua25vd24geyByZXR1cm4gdGhhdC5zaG93U3luY0FjdGl2aXR5KCk7IH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU2hvd1NldHRpbmdzQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTaG93U3luY1NldHRpbmdzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBzaG93U3luY1NldHRpbmdzQ29tbWFuZC5pZCxcblx0XHRcdFx0XHR0aXRsZTogc2hvd1N5bmNTZXR0aW5nc0NvbW1hbmQudGl0bGUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFNZTkNfVElUTEUsXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NZTkNfU1RBVEUubm90RXF1YWxzVG8oU3luY1N0YXR1cy5VbmluaXRpYWxpemVkKSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5Vc2VyU2V0dGluZ3MoeyBqc29uRWRpdG9yOiBmYWxzZSwgcXVlcnk6ICdAdGFnOnN5bmMnIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJIZWxwQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBIZWxwQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnVzZXJEYXRhU3luYy5hY3Rpb25zLmhlbHAnLFxuXHRcdFx0XHRcdHRpdGxlOiBTWU5DX1RJVExFLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHAsXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TWU5DX1NUQVRFLm5vdEVxdWFsc1RvKFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCkpLFxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bigpOiB1bmtub3duIHsgcmV0dXJuIHRoYXQub3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSgnaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXNldHRpbmdzLXN5bmMtaGVscCcpKTsgfVxuXHRcdH0pKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSwge1xuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC51c2VyRGF0YVN5bmMuYWN0aW9ucy5oZWxwJyxcblx0XHRcdFx0dGl0bGU6IENhdGVnb3JpZXMuSGVscC52YWx1ZVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFNZTkNfVklFV19DT05UQUlORVJfSUQpLFxuXHRcdFx0Z3JvdXA6ICcxX2hlbHAnLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFjY2VwdE1lcmdlc0FjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgQWNjZXB0TWVyZ2VzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLnVzZXJEYXRhU3luYy5hY3Rpb25zLmFjY2VwdE1lcmdlcycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjb21wbGV0ZSBtZXJnZXMgdGl0bGUnLCBcIkNvbXBsZXRlIE1lcmdlXCIpLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRlbnQsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4SXNNZXJnZVJlc3VsdEVkaXRvciwgQ29udGV4dEtleUV4cHIucmVnZXgoY3R4TWVyZ2VCYXNlVXJpLmtleSwgbmV3IFJlZ0V4cChgXiR7VVNFUl9EQVRBX1NZTkNfU0NIRU1FfTpgKSkpLFxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBwcmV2aWV3UmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0RmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRGaWxlU2VydmljZSk7XG5cdFx0XHRcdGF3YWl0IHRleHRGaWxlU2VydmljZS5zYXZlKHByZXZpZXdSZXNvdXJjZSk7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0ZXh0RmlsZVNlcnZpY2UucmVhZChwcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0XHRhd2FpdCB0aGF0LnVzZXJEYXRhU3luY1NlcnZpY2UuYWNjZXB0KHRoaXMuZ2V0U3luY1Jlc291cmNlKHByZXZpZXdSZXNvdXJjZSksIHByZXZpZXdSZXNvdXJjZSwgY29udGVudC52YWx1ZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHByaXZhdGUgZ2V0U3luY1Jlc291cmNlKHByZXZpZXdSZXNvdXJjZTogVVJJKTogSVVzZXJEYXRhU3luY1Jlc291cmNlIHtcblx0XHRcdFx0Y29uc3QgY29uZmxpY3QgPSB0aGF0LnVzZXJEYXRhU3luY1NlcnZpY2UuY29uZmxpY3RzLmZpbmQoKHsgY29uZmxpY3RzIH0pID0+IGNvbmZsaWN0cy5zb21lKGNvbmZsaWN0ID0+IGlzRXF1YWwoY29uZmxpY3QucHJldmlld1Jlc291cmNlLCBwcmV2aWV3UmVzb3VyY2UpKSk7XG5cdFx0XHRcdGlmIChjb25mbGljdCkge1xuXHRcdFx0XHRcdHJldHVybiBjb25mbGljdDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcmVzb3VyY2U6ICR7cHJldmlld1Jlc291cmNlLnRvU3RyaW5nKCl9YCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckRvd25sb2FkU3luY0FjdGl2aXR5QWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBEb3dubG9hZFN5bmNBY3Rpdml0eUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKERPV05MT0FEX0FDVElWSVRZX0FDVElPTl9ERVNDUklQVE9SKTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGZvbGRlciA9IGF3YWl0IHVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UuZG93bmxvYWRTeW5jQWN0aXZpdHkoKTtcblx0XHRcdFx0aWYgKGZvbGRlcikge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuaW5mbyhsb2NhbGl6ZSgnZG93bmxvYWQgc3luYyBhY3Rpdml0eSBjb21wbGV0ZScsIFwiU3VjY2Vzc2Z1bGx5IGRvd25sb2FkZWQgU2V0dGluZ3MgU3luYyBhY3Rpdml0eS5cIikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld3MoKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5yZWdpc3RlclZpZXdDb250YWluZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyRGF0YVZpZXdzKGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld0NvbnRhaW5lcigpOiBWaWV3Q29udGFpbmVyIHtcblx0XHRyZXR1cm4gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogU1lOQ19WSUVXX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IFNZTkNfVElUTEUsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoXG5cdFx0XHRcdFx0Vmlld1BhbmVDb250YWluZXIsXG5cdFx0XHRcdFx0W1NZTkNfVklFV19DT05UQUlORVJfSUQsIHsgbWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiB0cnVlIH1dXG5cdFx0XHRcdCksXG5cdFx0XHRcdGljb246IFNZTkNfVklFV19JQ09OLFxuXHRcdFx0XHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0XHRcdH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJSZXNldFN5bmNEYXRhQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb25zLnN5bmNEYXRhLnJlc2V0Jyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb25zLnN5bmNEYXRhLnJlc2V0JywgXCJDbGVhciBEYXRhIGluIENsb3VkLi4uXCIpLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFNZTkNfVklFV19DT05UQUlORVJfSUQpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcwX2NvbmZpZ3VyZScsXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKCk6IHVua25vd24geyByZXR1cm4gdGhhdC51c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLnJlc2V0U3luY2VkRGF0YSgpOyB9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckRhdGFWaWV3cyhjb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhU3luY0RhdGFWaWV3cywgY29udGFpbmVyKSk7XG5cdH1cblxufVxuXG5jbGFzcyBVc2VyRGF0YVJlbW90ZUNvbnRlbnRQcm92aWRlciBpbXBsZW1lbnRzIElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFTeW5jU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdHByb3ZpZGVUZXh0Q29udGVudCh1cmk6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbD4gfCBudWxsIHtcblx0XHRpZiAodXJpLnNjaGVtZSA9PT0gVVNFUl9EQVRBX1NZTkNfU0NIRU1FKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLnJlc29sdmVDb250ZW50KHVyaSkudGhlbihjb250ZW50ID0+IHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKGNvbnRlbnQgfHwgJycsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb25jJyksIHVyaSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlCQUFpQiwyQkFBMkI7QUFDckQsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsWUFBWSxpQkFBaUIsbUJBQW1CLG9CQUFpQztBQUMxRixTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBR3BCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQW9DLHlCQUF5QjtBQUM3RCxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsUUFBUSxjQUFjLGlCQUFpQixlQUFlO0FBQy9ELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCLG9CQUFpQyxvQkFBb0IscUJBQXFCO0FBQ25HLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCLGdCQUFn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
