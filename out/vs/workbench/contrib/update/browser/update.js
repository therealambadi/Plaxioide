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
import * as nls from "../../../../nls.js";
import severity from "../../../../base/common/severity.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IActivityService, NumberBadge, ProgressBadge } from "../../../services/activity/common/activity.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUpdateService, StateType, DisablementReason } from "../../../../platform/update/common/update.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { ReleaseNotesManager } from "./releaseNotesEditor.js";
import { isMacintosh, isWeb, isWindows } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuRegistry, MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService, SyncStatus } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { Promises } from "../../../../base/common/async.js";
import { IUserDataSyncWorkbenchService } from "../../../services/userDataSync/common/userDataSync.js";
import { Event } from "../../../../base/common/event.js";
import { toAction } from "../../../../base/common/actions.js";
const CONTEXT_UPDATE_STATE = new RawContextKey("updateState", StateType.Uninitialized);
const MAJOR_MINOR_UPDATE_AVAILABLE = new RawContextKey("majorMinorUpdateAvailable", false);
const RELEASE_NOTES_URL = new RawContextKey("releaseNotesUrl", "");
const DOWNLOAD_URL = new RawContextKey("downloadUrl", "");
let releaseNotesManager = void 0;
function showReleaseNotesInEditor(instantiationService, version, useCurrentFile) {
  if (!releaseNotesManager) {
    releaseNotesManager = instantiationService.createInstance(ReleaseNotesManager);
  }
  return releaseNotesManager.show(version, useCurrentFile);
}
async function openLatestReleaseNotesInBrowser(accessor) {
  const openerService = accessor.get(IOpenerService);
  const productService = accessor.get(IProductService);
  if (productService.releaseNotesUrl) {
    const uri = URI.parse(productService.releaseNotesUrl);
    await openerService.open(uri);
  } else {
    throw new Error(nls.localize("update.noReleaseNotesOnline", "This version of {0} does not have release notes online", productService.nameLong));
  }
}
async function showReleaseNotes(accessor, version) {
  const instantiationService = accessor.get(IInstantiationService);
  try {
    await showReleaseNotesInEditor(instantiationService, version, false);
  } catch (err) {
    try {
      await instantiationService.invokeFunction(openLatestReleaseNotesInBrowser);
    } catch (err2) {
      throw new Error(`${err.message} and ${err2.message}`);
    }
  }
}
function parseVersion(version) {
  const match = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(version);
  if (!match) {
    return void 0;
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}
function isMajorMinorUpdate(before, after) {
  return before.major < after.major || before.minor < after.minor;
}
let ProductContribution = class {
  constructor(storageService, instantiationService, notificationService, environmentService, openerService, configurationService, hostService, productService, contextKeyService) {
    if (productService.releaseNotesUrl) {
      const releaseNotesUrlKey = RELEASE_NOTES_URL.bindTo(contextKeyService);
      releaseNotesUrlKey.set(productService.releaseNotesUrl);
    }
    if (productService.downloadUrl) {
      const downloadUrlKey = DOWNLOAD_URL.bindTo(contextKeyService);
      downloadUrlKey.set(productService.downloadUrl);
    }
    if (isWeb) {
      return;
    }
    hostService.hadLastFocus().then(async (hadLastFocus) => {
      if (!hadLastFocus) {
        return;
      }
      const lastVersion = parseVersion(storageService.get(ProductContribution.KEY, StorageScope.APPLICATION, ""));
      const currentVersion = parseVersion(productService.version);
      const shouldShowReleaseNotes = configurationService.getValue("update.showReleaseNotes");
      const releaseNotesUrl = productService.releaseNotesUrl;
      if (shouldShowReleaseNotes && !environmentService.skipReleaseNotes && releaseNotesUrl && lastVersion && currentVersion && isMajorMinorUpdate(lastVersion, currentVersion)) {
        showReleaseNotesInEditor(instantiationService, productService.version, false).then(void 0, () => {
          notificationService.prompt(
            severity.Info,
            nls.localize("read the release notes", "Welcome to {0} v{1}! Would you like to read the Release Notes?", productService.nameLong, productService.version),
            [{
              label: nls.localize("releaseNotes", "Release Notes"),
              run: () => {
                const uri = URI.parse(releaseNotesUrl);
                openerService.open(uri);
              }
            }]
          );
        });
      }
      storageService.store(ProductContribution.KEY, productService.version, StorageScope.APPLICATION, StorageTarget.MACHINE);
    });
  }
};
ProductContribution.KEY = "releaseNotes/lastVersion";
ProductContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IBrowserWorkbenchEnvironmentService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IContextKeyService)
], ProductContribution);
let UpdateContribution = class extends Disposable {
  constructor(storageService, instantiationService, notificationService, dialogService, updateService, activityService, contextKeyService, productService, openerService, configurationService, hostService) {
    super();
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.updateService = updateService;
    this.activityService = activityService;
    this.contextKeyService = contextKeyService;
    this.productService = productService;
    this.openerService = openerService;
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.badgeDisposable = this._register(new MutableDisposable());
    this.state = updateService.state;
    this.updateStateContextKey = CONTEXT_UPDATE_STATE.bindTo(this.contextKeyService);
    this.majorMinorUpdateAvailableContextKey = MAJOR_MINOR_UPDATE_AVAILABLE.bindTo(this.contextKeyService);
    this._register(updateService.onStateChange(this.onUpdateStateChange, this));
    this.onUpdateStateChange(this.updateService.state);
    const currentVersion = this.productService.commit;
    const lastKnownVersion = this.storageService.get("update/lastKnownVersion", StorageScope.APPLICATION);
    if (currentVersion !== lastKnownVersion) {
      this.storageService.remove("update/lastKnownVersion", StorageScope.APPLICATION);
      this.storageService.remove("update/updateNotificationTime", StorageScope.APPLICATION);
    }
    this.registerGlobalActivityActions();
  }
  async onUpdateStateChange(state) {
    this.updateStateContextKey.set(state.type);
    switch (state.type) {
      case StateType.Disabled:
        if (state.reason === DisablementReason.RunningAsAdmin) {
          this.notificationService.notify({
            severity: Severity.Info,
            message: nls.localize("update service disabled", "Updates are disabled because you are running the user-scope installation of {0} as Administrator.", this.productService.nameLong),
            actions: {
              primary: [
                toAction({
                  id: "",
                  label: nls.localize("learn more", "Learn More"),
                  run: () => this.openerService.open("https://aka.ms/vscode-windows-setup")
                })
              ]
            },
            neverShowAgain: { id: "no-updates-running-as-admin" }
          });
        }
        break;
      case StateType.Idle:
        if (state.error) {
          this.onError(state.error);
        } else if (this.state.type === StateType.CheckingForUpdates && this.state.explicit && await this.hostService.hadLastFocus()) {
          this.onUpdateNotAvailable();
        }
        break;
      case StateType.AvailableForDownload:
        this.onUpdateAvailable(state.update);
        break;
      case StateType.Downloaded:
        this.onUpdateDownloaded(state.update);
        break;
      case StateType.Ready: {
        const productVersion = state.update.productVersion;
        if (productVersion) {
          const currentVersion = parseVersion(this.productService.version);
          const nextVersion = parseVersion(productVersion);
          this.majorMinorUpdateAvailableContextKey.set(Boolean(currentVersion && nextVersion && isMajorMinorUpdate(currentVersion, nextVersion)));
          this.onUpdateReady(state.update);
        }
        break;
      }
    }
    let badge = void 0;
    if (state.type === StateType.AvailableForDownload || state.type === StateType.Downloaded || state.type === StateType.Ready) {
      badge = new NumberBadge(1, () => nls.localize("updateIsReady", "New {0} update available.", this.productService.nameShort));
    } else if (state.type === StateType.CheckingForUpdates) {
      badge = new ProgressBadge(() => nls.localize("checkingForUpdates", "Checking for {0} updates...", this.productService.nameShort));
    } else if (state.type === StateType.Downloading) {
      badge = new ProgressBadge(() => nls.localize("downloading", "Downloading {0} update...", this.productService.nameShort));
    } else if (state.type === StateType.Updating) {
      badge = new ProgressBadge(() => nls.localize("updating", "Updating {0}...", this.productService.nameShort));
    }
    this.badgeDisposable.clear();
    if (badge) {
      this.badgeDisposable.value = this.activityService.showGlobalActivity({ badge });
    }
    this.state = state;
  }
  onError(error) {
    if (/The request timed out|The network connection was lost/i.test(error)) {
      return;
    }
    error = error.replace(/See https:\/\/github\.com\/Squirrel\/Squirrel\.Mac\/issues\/182 for more information/, "This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information");
    this.notificationService.notify({
      severity: Severity.Error,
      message: error,
      source: nls.localize("update service", "Update Service")
    });
  }
  onUpdateNotAvailable() {
    this.dialogService.info(nls.localize("noUpdatesAvailable", "There are currently no updates available."));
  }
  // linux
  onUpdateAvailable(update) {
    if (!this.shouldShowNotification()) {
      return;
    }
    const productVersion = update.productVersion;
    if (!productVersion) {
      return;
    }
    this.notificationService.prompt(
      severity.Info,
      nls.localize("thereIsUpdateAvailable", "There is an available update."),
      [{
        label: nls.localize("download update", "Download Update"),
        run: () => this.updateService.downloadUpdate()
      }, {
        label: nls.localize("later", "Later"),
        run: () => {
        }
      }, {
        label: nls.localize("releaseNotes", "Release Notes"),
        run: () => {
          this.instantiationService.invokeFunction((accessor) => showReleaseNotes(accessor, productVersion));
        }
      }]
    );
  }
  // windows fast updates
  onUpdateDownloaded(update) {
    if (isMacintosh) {
      return;
    }
    if (this.configurationService.getValue("update.enableWindowsBackgroundUpdates") && this.productService.target === "user") {
      return;
    }
    if (!this.shouldShowNotification()) {
      return;
    }
    const productVersion = update.productVersion;
    if (!productVersion) {
      return;
    }
    this.notificationService.prompt(
      severity.Info,
      nls.localize("updateAvailable", "There's an update available: {0} {1}", this.productService.nameLong, productVersion),
      [{
        label: nls.localize("installUpdate", "Install Update"),
        run: () => this.updateService.applyUpdate()
      }, {
        label: nls.localize("later", "Later"),
        run: () => {
        }
      }, {
        label: nls.localize("releaseNotes", "Release Notes"),
        run: () => {
          this.instantiationService.invokeFunction((accessor) => showReleaseNotes(accessor, productVersion));
        }
      }]
    );
  }
  // windows and mac
  onUpdateReady(update) {
    if (!(isWindows && this.productService.target !== "user") && !this.shouldShowNotification()) {
      return;
    }
    const actions = [{
      label: nls.localize("updateNow", "Update Now"),
      run: () => this.updateService.quitAndInstall()
    }, {
      label: nls.localize("later", "Later"),
      run: () => {
      }
    }];
    const productVersion = update.productVersion;
    if (productVersion) {
      actions.push({
        label: nls.localize("releaseNotes", "Release Notes"),
        run: () => {
          this.instantiationService.invokeFunction((accessor) => showReleaseNotes(accessor, productVersion));
        }
      });
    }
    this.notificationService.prompt(
      severity.Info,
      nls.localize("updateAvailableAfterRestart", "Restart {0} to apply the latest update.", this.productService.nameLong),
      actions,
      { sticky: true }
    );
  }
  shouldShowNotification() {
    const currentVersion = this.productService.commit;
    const currentMillis = (/* @__PURE__ */ new Date()).getTime();
    const lastKnownVersion = this.storageService.get("update/lastKnownVersion", StorageScope.APPLICATION);
    if (currentVersion !== lastKnownVersion) {
      this.storageService.store("update/lastKnownVersion", currentVersion, StorageScope.APPLICATION, StorageTarget.MACHINE);
      this.storageService.store("update/updateNotificationTime", currentMillis, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    const updateNotificationMillis = this.storageService.getNumber("update/updateNotificationTime", StorageScope.APPLICATION, currentMillis);
    const diffDays = (currentMillis - updateNotificationMillis) / (1e3 * 60 * 60 * 24);
    return diffDays > 5;
  }
  registerGlobalActivityActions() {
    CommandsRegistry.registerCommand("update.check", () => this.updateService.checkForUpdates(true));
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.check",
        title: nls.localize("checkForUpdates", "Check for Updates...")
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Idle)
    });
    CommandsRegistry.registerCommand("update.checking", () => {
    });
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.checking",
        title: nls.localize("checkingForUpdates2", "Checking for Updates..."),
        precondition: ContextKeyExpr.false()
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.CheckingForUpdates)
    });
    CommandsRegistry.registerCommand("update.downloadNow", () => this.updateService.downloadUpdate());
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.downloadNow",
        title: nls.localize("download update_1", "Download Update (1)")
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.AvailableForDownload)
    });
    CommandsRegistry.registerCommand("update.downloading", () => {
    });
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.downloading",
        title: nls.localize("DownloadingUpdate", "Downloading Update..."),
        precondition: ContextKeyExpr.false()
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloading)
    });
    CommandsRegistry.registerCommand("update.install", () => this.updateService.applyUpdate());
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.install",
        title: nls.localize("installUpdate...", "Install Update... (1)")
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloaded)
    });
    CommandsRegistry.registerCommand("update.updating", () => {
    });
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      command: {
        id: "update.updating",
        title: nls.localize("installingUpdate", "Installing Update..."),
        precondition: ContextKeyExpr.false()
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Updating)
    });
    if (this.productService.quality === "stable") {
      CommandsRegistry.registerCommand("update.showUpdateReleaseNotes", () => {
        if (this.updateService.state.type !== StateType.Ready) {
          return;
        }
        const productVersion = this.updateService.state.update.productVersion;
        if (productVersion) {
          this.instantiationService.invokeFunction((accessor) => showReleaseNotes(accessor, productVersion));
        }
      });
      MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
        group: "7_update",
        order: 1,
        command: {
          id: "update.showUpdateReleaseNotes",
          title: nls.localize("showUpdateReleaseNotes", "Show Update Release Notes")
        },
        when: ContextKeyExpr.and(CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready), MAJOR_MINOR_UPDATE_AVAILABLE)
      });
    }
    CommandsRegistry.registerCommand("update.restart", () => this.updateService.quitAndInstall());
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      group: "7_update",
      order: 2,
      command: {
        id: "update.restart",
        title: nls.localize("restartToUpdate", "Restart to Update (1)")
      },
      when: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready)
    });
    CommandsRegistry.registerCommand("_update.state", () => {
      return this.state;
    });
  }
};
UpdateContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IUpdateService),
  __decorateParam(5, IActivityService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IHostService)
], UpdateContribution);
let SwitchProductQualityContribution = class extends Disposable {
  constructor(productService, environmentService) {
    super();
    this.productService = productService;
    this.environmentService = environmentService;
    this.registerGlobalActivityActions();
  }
  registerGlobalActivityActions() {
    const quality = this.productService.quality;
    const productQualityChangeHandler = this.environmentService.options?.productQualityChangeHandler;
    if (productQualityChangeHandler && (quality === "stable" || quality === "insider")) {
      const newQuality = quality === "stable" ? "insider" : "stable";
      const commandId = `update.switchQuality.${newQuality}`;
      const isSwitchingToInsiders = newQuality === "insider";
      this._register(registerAction2(class SwitchQuality extends Action2 {
        constructor() {
          super({
            id: commandId,
            title: isSwitchingToInsiders ? nls.localize("switchToInsiders", "Switch to Insiders Version...") : nls.localize("switchToStable", "Switch to Stable Version..."),
            precondition: IsWebContext,
            menu: {
              id: MenuId.GlobalActivity,
              when: IsWebContext,
              group: "7_update"
            }
          });
        }
        async run(accessor) {
          const dialogService = accessor.get(IDialogService);
          const userDataSyncEnablementService = accessor.get(IUserDataSyncEnablementService);
          const userDataSyncStoreManagementService = accessor.get(IUserDataSyncStoreManagementService);
          const storageService = accessor.get(IStorageService);
          const userDataSyncWorkbenchService = accessor.get(IUserDataSyncWorkbenchService);
          const userDataSyncService = accessor.get(IUserDataSyncService);
          const notificationService = accessor.get(INotificationService);
          try {
            const selectSettingsSyncServiceDialogShownKey = "switchQuality.selectSettingsSyncServiceDialogShown";
            const userDataSyncStore = userDataSyncStoreManagementService.userDataSyncStore;
            let userDataSyncStoreType;
            if (userDataSyncStore && isSwitchingToInsiders && userDataSyncEnablementService.isEnabled() && !storageService.getBoolean(selectSettingsSyncServiceDialogShownKey, StorageScope.APPLICATION, false)) {
              userDataSyncStoreType = await this.selectSettingsSyncService(dialogService);
              if (!userDataSyncStoreType) {
                return;
              }
              storageService.store(selectSettingsSyncServiceDialogShownKey, true, StorageScope.APPLICATION, StorageTarget.USER);
              if (userDataSyncStoreType === "stable") {
                await userDataSyncStoreManagementService.switch(userDataSyncStoreType);
              }
            }
            const res = await dialogService.confirm({
              type: "info",
              message: nls.localize("relaunchMessage", "Changing the version requires a reload to take effect"),
              detail: newQuality === "insider" ? nls.localize("relaunchDetailInsiders", "Press the reload button to switch to the Insiders version of VS Code.") : nls.localize("relaunchDetailStable", "Press the reload button to switch to the Stable version of VS Code."),
              primaryButton: nls.localize({ key: "reload", comment: ["&& denotes a mnemonic"] }, "&&Reload")
            });
            if (res.confirmed) {
              const promises = [];
              if (userDataSyncService.status === SyncStatus.Syncing) {
                promises.push(Event.toPromise(Event.filter(userDataSyncService.onDidChangeStatus, (status) => status !== SyncStatus.Syncing)));
              }
              if (isSwitchingToInsiders && userDataSyncStoreType) {
                promises.push(userDataSyncWorkbenchService.synchroniseUserDataSyncStoreType());
              }
              await Promises.settled(promises);
              productQualityChangeHandler(newQuality);
            } else {
              if (userDataSyncStoreType) {
                storageService.remove(selectSettingsSyncServiceDialogShownKey, StorageScope.APPLICATION);
              }
            }
          } catch (error) {
            notificationService.error(error);
          }
        }
        async selectSettingsSyncService(dialogService) {
          const { result } = await dialogService.prompt({
            type: Severity.Info,
            message: nls.localize("selectSyncService.message", "Choose the settings sync service to use after changing the version"),
            detail: nls.localize("selectSyncService.detail", "The Insiders version of VS Code will synchronize your settings, keybindings, extensions, snippets and UI State using separate insiders settings sync service by default."),
            buttons: [
              {
                label: nls.localize({ key: "use insiders", comment: ["&& denotes a mnemonic"] }, "&&Insiders"),
                run: () => "insiders"
              },
              {
                label: nls.localize({ key: "use stable", comment: ["&& denotes a mnemonic"] }, "&&Stable (current)"),
                run: () => "stable"
              }
            ],
            cancelButton: true
          });
          return result;
        }
      }));
    }
  }
};
SwitchProductQualityContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService)
], SwitchProductQualityContribution);
export {
  CONTEXT_UPDATE_STATE,
  DOWNLOAD_URL,
  MAJOR_MINOR_UPDATE_AVAILABLE,
  ProductContribution,
  RELEASE_NOTES_URL,
  SwitchProductQualityContribution,
  UpdateContribution,
  showReleaseNotesInEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91cGRhdGUvYnJvd3Nlci91cGRhdGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCBzZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgTnVtYmVyQmFkZ2UsIElCYWRnZSwgUHJvZ3Jlc3NCYWRnZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVXBkYXRlU2VydmljZSwgU3RhdGUgYXMgVXBkYXRlU3RhdGUsIFN0YXRlVHlwZSwgSVVwZGF0ZSwgRGlzYWJsZW1lbnRSZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cGRhdGUvY29tbW9uL3VwZGF0ZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9icm93c2VyL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZWxlYXNlTm90ZXNNYW5hZ2VyIH0gZnJvbSAnLi9yZWxlYXNlTm90ZXNFZGl0b3IuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2ViLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFJhd0NvbnRleHRLZXksIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBNZW51UmVnaXN0cnksIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCBTeW5jU3RhdHVzLCBVc2VyRGF0YVN5bmNTdG9yZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJc1dlYkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuXG5leHBvcnQgY29uc3QgQ09OVEVYVF9VUERBVEVfU1RBVEUgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCd1cGRhdGVTdGF0ZScsIFN0YXRlVHlwZS5VbmluaXRpYWxpemVkKTtcbmV4cG9ydCBjb25zdCBNQUpPUl9NSU5PUl9VUERBVEVfQVZBSUxBQkxFID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ21ham9yTWlub3JVcGRhdGVBdmFpbGFibGUnLCBmYWxzZSk7XG5leHBvcnQgY29uc3QgUkVMRUFTRV9OT1RFU19VUkwgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCdyZWxlYXNlTm90ZXNVcmwnLCAnJyk7XG5leHBvcnQgY29uc3QgRE9XTkxPQURfVVJMID0gbmV3IFJhd0NvbnRleHRLZXk8c3RyaW5nPignZG93bmxvYWRVcmwnLCAnJyk7XG5cbmxldCByZWxlYXNlTm90ZXNNYW5hZ2VyOiBSZWxlYXNlTm90ZXNNYW5hZ2VyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1JlbGVhc2VOb3Rlc0luRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHZlcnNpb246IHN0cmluZywgdXNlQ3VycmVudEZpbGU6IGJvb2xlYW4pIHtcblx0aWYgKCFyZWxlYXNlTm90ZXNNYW5hZ2VyKSB7XG5cdFx0cmVsZWFzZU5vdGVzTWFuYWdlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbGVhc2VOb3Rlc01hbmFnZXIpO1xuXHR9XG5cblx0cmV0dXJuIHJlbGVhc2VOb3Rlc01hbmFnZXIuc2hvdyh2ZXJzaW9uLCB1c2VDdXJyZW50RmlsZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW5MYXRlc3RSZWxlYXNlTm90ZXNJbkJyb3dzZXIoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0Y29uc3Qgb3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG5cdGNvbnN0IHByb2R1Y3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcm9kdWN0U2VydmljZSk7XG5cblx0aWYgKHByb2R1Y3RTZXJ2aWNlLnJlbGVhc2VOb3Rlc1VybCkge1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShwcm9kdWN0U2VydmljZS5yZWxlYXNlTm90ZXNVcmwpO1xuXHRcdGF3YWl0IG9wZW5lclNlcnZpY2Uub3Blbih1cmkpO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoJ3VwZGF0ZS5ub1JlbGVhc2VOb3Rlc09ubGluZScsIFwiVGhpcyB2ZXJzaW9uIG9mIHswfSBkb2VzIG5vdCBoYXZlIHJlbGVhc2Ugbm90ZXMgb25saW5lXCIsIHByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvd1JlbGVhc2VOb3RlcyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmVyc2lvbjogc3RyaW5nKSB7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdHRyeSB7XG5cdFx0YXdhaXQgc2hvd1JlbGVhc2VOb3Rlc0luRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlLCB2ZXJzaW9uLCBmYWxzZSk7XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihvcGVuTGF0ZXN0UmVsZWFzZU5vdGVzSW5Ccm93c2VyKTtcblx0XHR9IGNhdGNoIChlcnIyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYCR7ZXJyLm1lc3NhZ2V9IGFuZCAke2VycjIubWVzc2FnZX1gKTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIElWZXJzaW9uIHtcblx0bWFqb3I6IG51bWJlcjtcblx0bWlub3I6IG51bWJlcjtcblx0cGF0Y2g6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gcGFyc2VWZXJzaW9uKHZlcnNpb246IHN0cmluZyk6IElWZXJzaW9uIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgbWF0Y2ggPSAvKFswLTldKylcXC4oWzAtOV0rKVxcLihbMC05XSspLy5leGVjKHZlcnNpb24pO1xuXG5cdGlmICghbWF0Y2gpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRtYWpvcjogcGFyc2VJbnQobWF0Y2hbMV0pLFxuXHRcdG1pbm9yOiBwYXJzZUludChtYXRjaFsyXSksXG5cdFx0cGF0Y2g6IHBhcnNlSW50KG1hdGNoWzNdKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBpc01ham9yTWlub3JVcGRhdGUoYmVmb3JlOiBJVmVyc2lvbiwgYWZ0ZXI6IElWZXJzaW9uKTogYm9vbGVhbiB7XG5cdHJldHVybiBiZWZvcmUubWFqb3IgPCBhZnRlci5tYWpvciB8fCBiZWZvcmUubWlub3IgPCBhZnRlci5taW5vcjtcbn1cblxuZXhwb3J0IGNsYXNzIFByb2R1Y3RDb250cmlidXRpb24gaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBLRVkgPSAncmVsZWFzZU5vdGVzL2xhc3RWZXJzaW9uJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHRpZiAocHJvZHVjdFNlcnZpY2UucmVsZWFzZU5vdGVzVXJsKSB7XG5cdFx0XHRjb25zdCByZWxlYXNlTm90ZXNVcmxLZXkgPSBSRUxFQVNFX05PVEVTX1VSTC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0cmVsZWFzZU5vdGVzVXJsS2V5LnNldChwcm9kdWN0U2VydmljZS5yZWxlYXNlTm90ZXNVcmwpO1xuXHRcdH1cblx0XHRpZiAocHJvZHVjdFNlcnZpY2UuZG93bmxvYWRVcmwpIHtcblx0XHRcdGNvbnN0IGRvd25sb2FkVXJsS2V5ID0gRE9XTkxPQURfVVJMLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRkb3dubG9hZFVybEtleS5zZXQocHJvZHVjdFNlcnZpY2UuZG93bmxvYWRVcmwpO1xuXHRcdH1cblxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGhvc3RTZXJ2aWNlLmhhZExhc3RGb2N1cygpLnRoZW4oYXN5bmMgaGFkTGFzdEZvY3VzID0+IHtcblx0XHRcdGlmICghaGFkTGFzdEZvY3VzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGFzdFZlcnNpb24gPSBwYXJzZVZlcnNpb24oc3RvcmFnZVNlcnZpY2UuZ2V0KFByb2R1Y3RDb250cmlidXRpb24uS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sICcnKSk7XG5cdFx0XHRjb25zdCBjdXJyZW50VmVyc2lvbiA9IHBhcnNlVmVyc2lvbihwcm9kdWN0U2VydmljZS52ZXJzaW9uKTtcblx0XHRcdGNvbnN0IHNob3VsZFNob3dSZWxlYXNlTm90ZXMgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPigndXBkYXRlLnNob3dSZWxlYXNlTm90ZXMnKTtcblx0XHRcdGNvbnN0IHJlbGVhc2VOb3Rlc1VybCA9IHByb2R1Y3RTZXJ2aWNlLnJlbGVhc2VOb3Rlc1VybDtcblxuXHRcdFx0Ly8gd2FzIHRoZXJlIGEgbWFqb3IvbWlub3IgdXBkYXRlPyBpZiBzbywgb3BlbiByZWxlYXNlIG5vdGVzXG5cdFx0XHRpZiAoc2hvdWxkU2hvd1JlbGVhc2VOb3RlcyAmJiAhZW52aXJvbm1lbnRTZXJ2aWNlLnNraXBSZWxlYXNlTm90ZXMgJiYgcmVsZWFzZU5vdGVzVXJsICYmIGxhc3RWZXJzaW9uICYmIGN1cnJlbnRWZXJzaW9uICYmIGlzTWFqb3JNaW5vclVwZGF0ZShsYXN0VmVyc2lvbiwgY3VycmVudFZlcnNpb24pKSB7XG5cdFx0XHRcdHNob3dSZWxlYXNlTm90ZXNJbkVkaXRvcihpbnN0YW50aWF0aW9uU2VydmljZSwgcHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgZmFsc2UpXG5cdFx0XHRcdFx0LnRoZW4odW5kZWZpbmVkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRcdFx0c2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZWFkIHRoZSByZWxlYXNlIG5vdGVzJywgXCJXZWxjb21lIHRvIHswfSB2ezF9ISBXb3VsZCB5b3UgbGlrZSB0byByZWFkIHRoZSBSZWxlYXNlIE5vdGVzP1wiLCBwcm9kdWN0U2VydmljZS5uYW1lTG9uZywgcHJvZHVjdFNlcnZpY2UudmVyc2lvbiksXG5cdFx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVsZWFzZU5vdGVzJywgXCJSZWxlYXNlIE5vdGVzXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKHJlbGVhc2VOb3Rlc1VybCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRvcGVuZXJTZXJ2aWNlLm9wZW4odXJpKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShQcm9kdWN0Q29udHJpYnV0aW9uLktFWSwgcHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVcGRhdGVDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSBzdGF0ZTogVXBkYXRlU3RhdGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgYmFkZ2VEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHVwZGF0ZVN0YXRlQ29udGV4dEtleTogSUNvbnRleHRLZXk8c3RyaW5nPjtcblx0cHJpdmF0ZSBtYWpvck1pbm9yVXBkYXRlQXZhaWxhYmxlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElVcGRhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnN0YXRlID0gdXBkYXRlU2VydmljZS5zdGF0ZTtcblx0XHR0aGlzLnVwZGF0ZVN0YXRlQ29udGV4dEtleSA9IENPTlRFWFRfVVBEQVRFX1NUQVRFLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLm1ham9yTWlub3JVcGRhdGVBdmFpbGFibGVDb250ZXh0S2V5ID0gTUFKT1JfTUlOT1JfVVBEQVRFX0FWQUlMQUJMRS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih1cGRhdGVTZXJ2aWNlLm9uU3RhdGVDaGFuZ2UodGhpcy5vblVwZGF0ZVN0YXRlQ2hhbmdlLCB0aGlzKSk7XG5cdFx0dGhpcy5vblVwZGF0ZVN0YXRlQ2hhbmdlKHRoaXMudXBkYXRlU2VydmljZS5zdGF0ZSk7XG5cblx0XHQvKlxuXHRcdFRoZSBgdXBkYXRlL2xhc3RLbm93blZlcnNpb25gIGFuZCBgdXBkYXRlL3VwZGF0ZU5vdGlmaWNhdGlvblRpbWVgIHN0b3JhZ2Uga2V5cyBhcmUgdXNlZCBpblxuXHRcdGNvbWJpbmF0aW9uIHRvIGZpZ3VyZSBvdXQgd2hlbiB0byBzaG93IGEgbWVzc2FnZSB0byB0aGUgdXNlciB0aGF0IGhlIHNob3VsZCB1cGRhdGUuXG5cblx0XHRUaGlzIG1lc3NhZ2Ugc2hvdWxkIGFwcGVhciBpZiB0aGUgdXNlciBoYXMgcmVjZWl2ZWQgYW4gdXBkYXRlIG5vdGlmaWNhdGlvbiBidXQgaGFzbid0XG5cdFx0dXBkYXRlZCBzaW5jZSA1IGRheXMuXG5cdFx0Ki9cblxuXHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gdGhpcy5wcm9kdWN0U2VydmljZS5jb21taXQ7XG5cdFx0Y29uc3QgbGFzdEtub3duVmVyc2lvbiA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KCd1cGRhdGUvbGFzdEtub3duVmVyc2lvbicsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cblx0XHQvLyBpZiBjdXJyZW50IHZlcnNpb24gIT0gc3RvcmVkIHZlcnNpb24sIGNsZWFyIGJvdGggZmllbGRzXG5cdFx0aWYgKGN1cnJlbnRWZXJzaW9uICE9PSBsYXN0S25vd25WZXJzaW9uKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZSgndXBkYXRlL2xhc3RLbm93blZlcnNpb24nLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoJ3VwZGF0ZS91cGRhdGVOb3RpZmljYXRpb25UaW1lJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlZ2lzdGVyR2xvYmFsQWN0aXZpdHlBY3Rpb25zKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uVXBkYXRlU3RhdGVDaGFuZ2Uoc3RhdGU6IFVwZGF0ZVN0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy51cGRhdGVTdGF0ZUNvbnRleHRLZXkuc2V0KHN0YXRlLnR5cGUpO1xuXG5cdFx0c3dpdGNoIChzdGF0ZS50eXBlKSB7XG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5EaXNhYmxlZDpcblx0XHRcdFx0aWYgKHN0YXRlLnJlYXNvbiA9PT0gRGlzYWJsZW1lbnRSZWFzb24uUnVubmluZ0FzQWRtaW4pIHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1cGRhdGUgc2VydmljZSBkaXNhYmxlZCcsIFwiVXBkYXRlcyBhcmUgZGlzYWJsZWQgYmVjYXVzZSB5b3UgYXJlIHJ1bm5pbmcgdGhlIHVzZXItc2NvcGUgaW5zdGFsbGF0aW9uIG9mIHswfSBhcyBBZG1pbmlzdHJhdG9yLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHRcdHRvQWN0aW9uKHtcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiAnJyxcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2xlYXJuIG1vcmUnLCBcIkxlYXJuIE1vcmVcIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKCdodHRwczovL2FrYS5tcy92c2NvZGUtd2luZG93cy1zZXR1cCcpXG5cdFx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdG5ldmVyU2hvd0FnYWluOiB7IGlkOiAnbm8tdXBkYXRlcy1ydW5uaW5nLWFzLWFkbWluJywgfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5JZGxlOlxuXHRcdFx0XHRpZiAoc3RhdGUuZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLm9uRXJyb3Ioc3RhdGUuZXJyb3IpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkNoZWNraW5nRm9yVXBkYXRlcyAmJiB0aGlzLnN0YXRlLmV4cGxpY2l0ICYmIGF3YWl0IHRoaXMuaG9zdFNlcnZpY2UuaGFkTGFzdEZvY3VzKCkpIHtcblx0XHRcdFx0XHR0aGlzLm9uVXBkYXRlTm90QXZhaWxhYmxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgU3RhdGVUeXBlLkF2YWlsYWJsZUZvckRvd25sb2FkOlxuXHRcdFx0XHR0aGlzLm9uVXBkYXRlQXZhaWxhYmxlKHN0YXRlLnVwZGF0ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5Eb3dubG9hZGVkOlxuXHRcdFx0XHR0aGlzLm9uVXBkYXRlRG93bmxvYWRlZChzdGF0ZS51cGRhdGUpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBTdGF0ZVR5cGUuUmVhZHk6IHtcblx0XHRcdFx0Y29uc3QgcHJvZHVjdFZlcnNpb24gPSBzdGF0ZS51cGRhdGUucHJvZHVjdFZlcnNpb247XG5cdFx0XHRcdGlmIChwcm9kdWN0VmVyc2lvbikge1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gcGFyc2VWZXJzaW9uKHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbik7XG5cdFx0XHRcdFx0Y29uc3QgbmV4dFZlcnNpb24gPSBwYXJzZVZlcnNpb24ocHJvZHVjdFZlcnNpb24pO1xuXHRcdFx0XHRcdHRoaXMubWFqb3JNaW5vclVwZGF0ZUF2YWlsYWJsZUNvbnRleHRLZXkuc2V0KEJvb2xlYW4oY3VycmVudFZlcnNpb24gJiYgbmV4dFZlcnNpb24gJiYgaXNNYWpvck1pbm9yVXBkYXRlKGN1cnJlbnRWZXJzaW9uLCBuZXh0VmVyc2lvbikpKTtcblx0XHRcdFx0XHR0aGlzLm9uVXBkYXRlUmVhZHkoc3RhdGUudXBkYXRlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgYmFkZ2U6IElCYWRnZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGlmIChzdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuQXZhaWxhYmxlRm9yRG93bmxvYWQgfHwgc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkRvd25sb2FkZWQgfHwgc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLlJlYWR5KSB7XG5cdFx0XHRiYWRnZSA9IG5ldyBOdW1iZXJCYWRnZSgxLCAoKSA9PiBubHMubG9jYWxpemUoJ3VwZGF0ZUlzUmVhZHknLCBcIk5ldyB7MH0gdXBkYXRlIGF2YWlsYWJsZS5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpKTtcblx0XHR9IGVsc2UgaWYgKHN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5DaGVja2luZ0ZvclVwZGF0ZXMpIHtcblx0XHRcdGJhZGdlID0gbmV3IFByb2dyZXNzQmFkZ2UoKCkgPT4gbmxzLmxvY2FsaXplKCdjaGVja2luZ0ZvclVwZGF0ZXMnLCBcIkNoZWNraW5nIGZvciB7MH0gdXBkYXRlcy4uLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCkpO1xuXHRcdH0gZWxzZSBpZiAoc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkRvd25sb2FkaW5nKSB7XG5cdFx0XHRiYWRnZSA9IG5ldyBQcm9ncmVzc0JhZGdlKCgpID0+IG5scy5sb2NhbGl6ZSgnZG93bmxvYWRpbmcnLCBcIkRvd25sb2FkaW5nIHswfSB1cGRhdGUuLi5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpKTtcblx0XHR9IGVsc2UgaWYgKHN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5VcGRhdGluZykge1xuXHRcdFx0YmFkZ2UgPSBuZXcgUHJvZ3Jlc3NCYWRnZSgoKSA9PiBubHMubG9jYWxpemUoJ3VwZGF0aW5nJywgXCJVcGRhdGluZyB7MH0uLi5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpKTtcblx0XHR9XG5cblx0XHR0aGlzLmJhZGdlRGlzcG9zYWJsZS5jbGVhcigpO1xuXG5cdFx0aWYgKGJhZGdlKSB7XG5cdFx0XHR0aGlzLmJhZGdlRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMuYWN0aXZpdHlTZXJ2aWNlLnNob3dHbG9iYWxBY3Rpdml0eSh7IGJhZGdlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdGUgPSBzdGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgb25FcnJvcihlcnJvcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKC9UaGUgcmVxdWVzdCB0aW1lZCBvdXR8VGhlIG5ldHdvcmsgY29ubmVjdGlvbiB3YXMgbG9zdC9pLnRlc3QoZXJyb3IpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZXJyb3IgPSBlcnJvci5yZXBsYWNlKC9TZWUgaHR0cHM6XFwvXFwvZ2l0aHViXFwuY29tXFwvU3F1aXJyZWxcXC9TcXVpcnJlbFxcLk1hY1xcL2lzc3Vlc1xcLzE4MiBmb3IgbW9yZSBpbmZvcm1hdGlvbi8sICdUaGlzIG1pZ2h0IG1lYW4gdGhlIGFwcGxpY2F0aW9uIHdhcyBwdXQgb24gcXVhcmFudGluZSBieSBtYWNPUy4gU2VlIFt0aGlzIGxpbmtdKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83NDI2I2lzc3VlY29tbWVudC00MjUwOTM0NjkpIGZvciBtb3JlIGluZm9ybWF0aW9uJyk7XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdG1lc3NhZ2U6IGVycm9yLFxuXHRcdFx0c291cmNlOiBubHMubG9jYWxpemUoJ3VwZGF0ZSBzZXJ2aWNlJywgXCJVcGRhdGUgU2VydmljZVwiKSxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25VcGRhdGVOb3RBdmFpbGFibGUoKTogdm9pZCB7XG5cdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdub1VwZGF0ZXNBdmFpbGFibGUnLCBcIlRoZXJlIGFyZSBjdXJyZW50bHkgbm8gdXBkYXRlcyBhdmFpbGFibGUuXCIpKTtcblx0fVxuXG5cdC8vIGxpbnV4XG5cdHByaXZhdGUgb25VcGRhdGVBdmFpbGFibGUodXBkYXRlOiBJVXBkYXRlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnNob3VsZFNob3dOb3RpZmljYXRpb24oKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2R1Y3RWZXJzaW9uID0gdXBkYXRlLnByb2R1Y3RWZXJzaW9uO1xuXHRcdGlmICghcHJvZHVjdFZlcnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0c2V2ZXJpdHkuSW5mbyxcblx0XHRcdG5scy5sb2NhbGl6ZSgndGhlcmVJc1VwZGF0ZUF2YWlsYWJsZScsIFwiVGhlcmUgaXMgYW4gYXZhaWxhYmxlIHVwZGF0ZS5cIiksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdkb3dubG9hZCB1cGRhdGUnLCBcIkRvd25sb2FkIFVwZGF0ZVwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLnVwZGF0ZVNlcnZpY2UuZG93bmxvYWRVcGRhdGUoKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdsYXRlcicsIFwiTGF0ZXJcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4geyB9XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JlbGVhc2VOb3RlcycsIFwiUmVsZWFzZSBOb3Rlc1wiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBzaG93UmVsZWFzZU5vdGVzKGFjY2Vzc29yLCBwcm9kdWN0VmVyc2lvbikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdCk7XG5cdH1cblxuXHQvLyB3aW5kb3dzIGZhc3QgdXBkYXRlc1xuXHRwcml2YXRlIG9uVXBkYXRlRG93bmxvYWRlZCh1cGRhdGU6IElVcGRhdGUpOiB2b2lkIHtcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3VwZGF0ZS5lbmFibGVXaW5kb3dzQmFja2dyb3VuZFVwZGF0ZXMnKSAmJiB0aGlzLnByb2R1Y3RTZXJ2aWNlLnRhcmdldCA9PT0gJ3VzZXInKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnNob3VsZFNob3dOb3RpZmljYXRpb24oKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2R1Y3RWZXJzaW9uID0gdXBkYXRlLnByb2R1Y3RWZXJzaW9uO1xuXHRcdGlmICghcHJvZHVjdFZlcnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0c2V2ZXJpdHkuSW5mbyxcblx0XHRcdG5scy5sb2NhbGl6ZSgndXBkYXRlQXZhaWxhYmxlJywgXCJUaGVyZSdzIGFuIHVwZGF0ZSBhdmFpbGFibGU6IHswfSB7MX1cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZywgcHJvZHVjdFZlcnNpb24pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnaW5zdGFsbFVwZGF0ZScsIFwiSW5zdGFsbCBVcGRhdGVcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy51cGRhdGVTZXJ2aWNlLmFwcGx5VXBkYXRlKClcblx0XHRcdH0sIHtcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnbGF0ZXInLCBcIkxhdGVyXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHsgfVxuXHRcdFx0fSwge1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZWxlYXNlTm90ZXMnLCBcIlJlbGVhc2UgTm90ZXNcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gc2hvd1JlbGVhc2VOb3RlcyhhY2Nlc3NvciwgcHJvZHVjdFZlcnNpb24pKTtcblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9XG5cblx0Ly8gd2luZG93cyBhbmQgbWFjXG5cdHByaXZhdGUgb25VcGRhdGVSZWFkeSh1cGRhdGU6IElVcGRhdGUpOiB2b2lkIHtcblx0XHRpZiAoIShpc1dpbmRvd3MgJiYgdGhpcy5wcm9kdWN0U2VydmljZS50YXJnZXQgIT09ICd1c2VyJykgJiYgIXRoaXMuc2hvdWxkU2hvd05vdGlmaWNhdGlvbigpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IFt7XG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCd1cGRhdGVOb3cnLCBcIlVwZGF0ZSBOb3dcIiksXG5cdFx0XHRydW46ICgpID0+IHRoaXMudXBkYXRlU2VydmljZS5xdWl0QW5kSW5zdGFsbCgpXG5cdFx0fSwge1xuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnbGF0ZXInLCBcIkxhdGVyXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB7IH1cblx0XHR9XTtcblxuXHRcdGNvbnN0IHByb2R1Y3RWZXJzaW9uID0gdXBkYXRlLnByb2R1Y3RWZXJzaW9uO1xuXHRcdGlmIChwcm9kdWN0VmVyc2lvbikge1xuXHRcdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVsZWFzZU5vdGVzJywgXCJSZWxlYXNlIE5vdGVzXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHNob3dSZWxlYXNlTm90ZXMoYWNjZXNzb3IsIHByb2R1Y3RWZXJzaW9uKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIHdpbmRvd3MgdXNlciBmYXN0IHVwZGF0ZXMgYW5kIG1hY1xuXHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRzZXZlcml0eS5JbmZvLFxuXHRcdFx0bmxzLmxvY2FsaXplKCd1cGRhdGVBdmFpbGFibGVBZnRlclJlc3RhcnQnLCBcIlJlc3RhcnQgezB9IHRvIGFwcGx5IHRoZSBsYXRlc3QgdXBkYXRlLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdGFjdGlvbnMsXG5cdFx0XHR7IHN0aWNreTogdHJ1ZSB9XG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkU2hvd05vdGlmaWNhdGlvbigpOiBib29sZWFuIHtcblx0XHRjb25zdCBjdXJyZW50VmVyc2lvbiA9IHRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0O1xuXHRcdGNvbnN0IGN1cnJlbnRNaWxsaXMgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRjb25zdCBsYXN0S25vd25WZXJzaW9uID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoJ3VwZGF0ZS9sYXN0S25vd25WZXJzaW9uJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblxuXHRcdC8vIGlmIHZlcnNpb24gIT0gc3RvcmVkIHZlcnNpb24sIHNhdmUgdmVyc2lvbiBhbmQgZGF0ZVxuXHRcdGlmIChjdXJyZW50VmVyc2lvbiAhPT0gbGFzdEtub3duVmVyc2lvbikge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgndXBkYXRlL2xhc3RLbm93blZlcnNpb24nLCBjdXJyZW50VmVyc2lvbiwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgndXBkYXRlL3VwZGF0ZU5vdGlmaWNhdGlvblRpbWUnLCBjdXJyZW50TWlsbGlzLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXBkYXRlTm90aWZpY2F0aW9uTWlsbGlzID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXROdW1iZXIoJ3VwZGF0ZS91cGRhdGVOb3RpZmljYXRpb25UaW1lJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBjdXJyZW50TWlsbGlzKTtcblx0XHRjb25zdCBkaWZmRGF5cyA9IChjdXJyZW50TWlsbGlzIC0gdXBkYXRlTm90aWZpY2F0aW9uTWlsbGlzKSAvICgxMDAwICogNjAgKiA2MCAqIDI0KTtcblxuXHRcdHJldHVybiBkaWZmRGF5cyA+IDU7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyR2xvYmFsQWN0aXZpdHlBY3Rpb25zKCk6IHZvaWQge1xuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd1cGRhdGUuY2hlY2snLCAoKSA9PiB0aGlzLnVwZGF0ZVNlcnZpY2UuY2hlY2tGb3JVcGRhdGVzKHRydWUpKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRncm91cDogJzdfdXBkYXRlJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6ICd1cGRhdGUuY2hlY2snLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdjaGVja0ZvclVwZGF0ZXMnLCBcIkNoZWNrIGZvciBVcGRhdGVzLi4uXCIpXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ09OVEVYVF9VUERBVEVfU1RBVEUuaXNFcXVhbFRvKFN0YXRlVHlwZS5JZGxlKVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3VwZGF0ZS5jaGVja2luZycsICgpID0+IHsgfSk7XG5cdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5HbG9iYWxBY3Rpdml0eSwge1xuXHRcdFx0Z3JvdXA6ICc3X3VwZGF0ZScsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAndXBkYXRlLmNoZWNraW5nJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnY2hlY2tpbmdGb3JVcGRhdGVzMicsIFwiQ2hlY2tpbmcgZm9yIFVwZGF0ZXMuLi5cIiksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZmFsc2UoKVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENPTlRFWFRfVVBEQVRFX1NUQVRFLmlzRXF1YWxUbyhTdGF0ZVR5cGUuQ2hlY2tpbmdGb3JVcGRhdGVzKVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3VwZGF0ZS5kb3dubG9hZE5vdycsICgpID0+IHRoaXMudXBkYXRlU2VydmljZS5kb3dubG9hZFVwZGF0ZSgpKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRncm91cDogJzdfdXBkYXRlJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6ICd1cGRhdGUuZG93bmxvYWROb3cnLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdkb3dubG9hZCB1cGRhdGVfMScsIFwiRG93bmxvYWQgVXBkYXRlICgxKVwiKVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENPTlRFWFRfVVBEQVRFX1NUQVRFLmlzRXF1YWxUbyhTdGF0ZVR5cGUuQXZhaWxhYmxlRm9yRG93bmxvYWQpXG5cdFx0fSk7XG5cblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgndXBkYXRlLmRvd25sb2FkaW5nJywgKCkgPT4geyB9KTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRncm91cDogJzdfdXBkYXRlJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6ICd1cGRhdGUuZG93bmxvYWRpbmcnLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdEb3dubG9hZGluZ1VwZGF0ZScsIFwiRG93bmxvYWRpbmcgVXBkYXRlLi4uXCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmZhbHNlKClcblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBDT05URVhUX1VQREFURV9TVEFURS5pc0VxdWFsVG8oU3RhdGVUeXBlLkRvd25sb2FkaW5nKVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3VwZGF0ZS5pbnN0YWxsJywgKCkgPT4gdGhpcy51cGRhdGVTZXJ2aWNlLmFwcGx5VXBkYXRlKCkpO1xuXHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuR2xvYmFsQWN0aXZpdHksIHtcblx0XHRcdGdyb3VwOiAnN191cGRhdGUnLFxuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogJ3VwZGF0ZS5pbnN0YWxsJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnaW5zdGFsbFVwZGF0ZS4uLicsIFwiSW5zdGFsbCBVcGRhdGUuLi4gKDEpXCIpXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ09OVEVYVF9VUERBVEVfU1RBVEUuaXNFcXVhbFRvKFN0YXRlVHlwZS5Eb3dubG9hZGVkKVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3VwZGF0ZS51cGRhdGluZycsICgpID0+IHsgfSk7XG5cdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5HbG9iYWxBY3Rpdml0eSwge1xuXHRcdFx0Z3JvdXA6ICc3X3VwZGF0ZScsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAndXBkYXRlLnVwZGF0aW5nJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnaW5zdGFsbGluZ1VwZGF0ZScsIFwiSW5zdGFsbGluZyBVcGRhdGUuLi5cIiksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZmFsc2UoKVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENPTlRFWFRfVVBEQVRFX1NUQVRFLmlzRXF1YWxUbyhTdGF0ZVR5cGUuVXBkYXRpbmcpXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJykge1xuXHRcdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3VwZGF0ZS5zaG93VXBkYXRlUmVsZWFzZU5vdGVzJywgKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy51cGRhdGVTZXJ2aWNlLnN0YXRlLnR5cGUgIT09IFN0YXRlVHlwZS5SZWFkeSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHByb2R1Y3RWZXJzaW9uID0gdGhpcy51cGRhdGVTZXJ2aWNlLnN0YXRlLnVwZGF0ZS5wcm9kdWN0VmVyc2lvbjtcblx0XHRcdFx0aWYgKHByb2R1Y3RWZXJzaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBzaG93UmVsZWFzZU5vdGVzKGFjY2Vzc29yLCBwcm9kdWN0VmVyc2lvbikpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXHRcdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5HbG9iYWxBY3Rpdml0eSwge1xuXHRcdFx0XHRncm91cDogJzdfdXBkYXRlJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRpZDogJ3VwZGF0ZS5zaG93VXBkYXRlUmVsZWFzZU5vdGVzJyxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdzaG93VXBkYXRlUmVsZWFzZU5vdGVzJywgXCJTaG93IFVwZGF0ZSBSZWxlYXNlIE5vdGVzXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1VQREFURV9TVEFURS5pc0VxdWFsVG8oU3RhdGVUeXBlLlJlYWR5KSwgTUFKT1JfTUlOT1JfVVBEQVRFX0FWQUlMQUJMRSlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd1cGRhdGUucmVzdGFydCcsICgpID0+IHRoaXMudXBkYXRlU2VydmljZS5xdWl0QW5kSW5zdGFsbCgpKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRncm91cDogJzdfdXBkYXRlJyxcblx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogJ3VwZGF0ZS5yZXN0YXJ0Jyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgncmVzdGFydFRvVXBkYXRlJywgXCJSZXN0YXJ0IHRvIFVwZGF0ZSAoMSlcIilcblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBDT05URVhUX1VQREFURV9TVEFURS5pc0VxdWFsVG8oU3RhdGVUeXBlLlJlYWR5KVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ191cGRhdGUuc3RhdGUnLCAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zdGF0ZTtcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3dpdGNoUHJvZHVjdFF1YWxpdHlDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckdsb2JhbEFjdGl2aXR5QWN0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckdsb2JhbEFjdGl2aXR5QWN0aW9ucygpOiB2b2lkIHtcblx0XHRjb25zdCBxdWFsaXR5ID0gdGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5O1xuXHRcdGNvbnN0IHByb2R1Y3RRdWFsaXR5Q2hhbmdlSGFuZGxlciA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LnByb2R1Y3RRdWFsaXR5Q2hhbmdlSGFuZGxlcjtcblx0XHRpZiAocHJvZHVjdFF1YWxpdHlDaGFuZ2VIYW5kbGVyICYmIChxdWFsaXR5ID09PSAnc3RhYmxlJyB8fCBxdWFsaXR5ID09PSAnaW5zaWRlcicpKSB7XG5cdFx0XHRjb25zdCBuZXdRdWFsaXR5ID0gcXVhbGl0eSA9PT0gJ3N0YWJsZScgPyAnaW5zaWRlcicgOiAnc3RhYmxlJztcblx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9IGB1cGRhdGUuc3dpdGNoUXVhbGl0eS4ke25ld1F1YWxpdHl9YDtcblx0XHRcdGNvbnN0IGlzU3dpdGNoaW5nVG9JbnNpZGVycyA9IG5ld1F1YWxpdHkgPT09ICdpbnNpZGVyJztcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBTd2l0Y2hRdWFsaXR5IGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkOiBjb21tYW5kSWQsXG5cdFx0XHRcdFx0XHR0aXRsZTogaXNTd2l0Y2hpbmdUb0luc2lkZXJzID8gbmxzLmxvY2FsaXplKCdzd2l0Y2hUb0luc2lkZXJzJywgXCJTd2l0Y2ggdG8gSW5zaWRlcnMgVmVyc2lvbi4uLlwiKSA6IG5scy5sb2NhbGl6ZSgnc3dpdGNoVG9TdGFibGUnLCBcIlN3aXRjaCB0byBTdGFibGUgVmVyc2lvbi4uLlwiKSxcblx0XHRcdFx0XHRcdHByZWNvbmRpdGlvbjogSXNXZWJDb250ZXh0LFxuXHRcdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0XHRpZDogTWVudUlkLkdsb2JhbEFjdGl2aXR5LFxuXHRcdFx0XHRcdFx0XHR3aGVuOiBJc1dlYkNvbnRleHQsXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnN191cGRhdGUnLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdFNldHRpbmdzU3luY1NlcnZpY2VEaWFsb2dTaG93bktleSA9ICdzd2l0Y2hRdWFsaXR5LnNlbGVjdFNldHRpbmdzU3luY1NlcnZpY2VEaWFsb2dTaG93bic7XG5cdFx0XHRcdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZSA9IHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU7XG5cdFx0XHRcdFx0XHRsZXQgdXNlckRhdGFTeW5jU3RvcmVUeXBlOiBVc2VyRGF0YVN5bmNTdG9yZVR5cGUgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAodXNlckRhdGFTeW5jU3RvcmUgJiYgaXNTd2l0Y2hpbmdUb0luc2lkZXJzICYmIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpXG5cdFx0XHRcdFx0XHRcdCYmICFzdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKHNlbGVjdFNldHRpbmdzU3luY1NlcnZpY2VEaWFsb2dTaG93bktleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBmYWxzZSkpIHtcblx0XHRcdFx0XHRcdFx0dXNlckRhdGFTeW5jU3RvcmVUeXBlID0gYXdhaXQgdGhpcy5zZWxlY3RTZXR0aW5nc1N5bmNTZXJ2aWNlKGRpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIXVzZXJEYXRhU3luY1N0b3JlVHlwZSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShzZWxlY3RTZXR0aW5nc1N5bmNTZXJ2aWNlRGlhbG9nU2hvd25LZXksIHRydWUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdFx0XHRcdFx0aWYgKHVzZXJEYXRhU3luY1N0b3JlVHlwZSA9PT0gJ3N0YWJsZScpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBVcGRhdGUgdGhlIHN0YWJsZSBzZXJ2aWNlIHR5cGUgaW4gdGhlIGN1cnJlbnQgd2luZG93LCBzbyB0aGF0IGl0IHVzZXMgc3RhYmxlIHNlcnZpY2UgYWZ0ZXIgc3dpdGNoZWQgdG8gaW5zaWRlcnMgdmVyc2lvbiAoYWZ0ZXIgcmVsb2FkKS5cblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnN3aXRjaCh1c2VyRGF0YVN5bmNTdG9yZVR5cGUpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IHJlcyA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdpbmZvJyxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdyZWxhdW5jaE1lc3NhZ2UnLCBcIkNoYW5naW5nIHRoZSB2ZXJzaW9uIHJlcXVpcmVzIGEgcmVsb2FkIHRvIHRha2UgZWZmZWN0XCIpLFxuXHRcdFx0XHRcdFx0XHRkZXRhaWw6IG5ld1F1YWxpdHkgPT09ICdpbnNpZGVyJyA/XG5cdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZWxhdW5jaERldGFpbEluc2lkZXJzJywgXCJQcmVzcyB0aGUgcmVsb2FkIGJ1dHRvbiB0byBzd2l0Y2ggdG8gdGhlIEluc2lkZXJzIHZlcnNpb24gb2YgVlMgQ29kZS5cIikgOlxuXHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgncmVsYXVuY2hEZXRhaWxTdGFibGUnLCBcIlByZXNzIHRoZSByZWxvYWQgYnV0dG9uIHRvIHN3aXRjaCB0byB0aGUgU3RhYmxlIHZlcnNpb24gb2YgVlMgQ29kZS5cIiksXG5cdFx0XHRcdFx0XHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSh7IGtleTogJ3JlbG9hZCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlJlbG9hZFwiKVxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdGlmIChyZXMuY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXG5cdFx0XHRcdFx0XHRcdC8vIElmIHN5bmMgaXMgaGFwcGVuaW5nIHdhaXQgdW50aWwgaXQgaXMgZmluaXNoZWQgYmVmb3JlIHJlbG9hZFxuXHRcdFx0XHRcdFx0XHRpZiAodXNlckRhdGFTeW5jU2VydmljZS5zdGF0dXMgPT09IFN5bmNTdGF0dXMuU3luY2luZykge1xuXHRcdFx0XHRcdFx0XHRcdHByb21pc2VzLnB1c2goRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZpbHRlcih1c2VyRGF0YVN5bmNTZXJ2aWNlLm9uRGlkQ2hhbmdlU3RhdHVzLCBzdGF0dXMgPT4gc3RhdHVzICE9PSBTeW5jU3RhdHVzLlN5bmNpbmcpKSk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHQvLyBJZiB1c2VyIGNob3NlIHRoZSBzeW5jIHNlcnZpY2UgdGhlbiBzeW5jaHJvbmlzZSB0aGUgc3RvcmUgdHlwZSBvcHRpb24gaW4gaW5zaWRlcnMgc2VydmljZSwgc28gdGhhdCBvdGhlciBjbGllbnRzIHVzaW5nIGluc2lkZXJzIHNlcnZpY2UgYXJlIGFsc28gdXBkYXRlZC5cblx0XHRcdFx0XHRcdFx0aWYgKGlzU3dpdGNoaW5nVG9JbnNpZGVycyAmJiB1c2VyRGF0YVN5bmNTdG9yZVR5cGUpIHtcblx0XHRcdFx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKHVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2Uuc3luY2hyb25pc2VVc2VyRGF0YVN5bmNTdG9yZVR5cGUoKSk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKHByb21pc2VzKTtcblxuXHRcdFx0XHRcdFx0XHRwcm9kdWN0UXVhbGl0eUNoYW5nZUhhbmRsZXIobmV3UXVhbGl0eSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvLyBSZXNldFxuXHRcdFx0XHRcdFx0XHRpZiAodXNlckRhdGFTeW5jU3RvcmVUeXBlKSB7XG5cdFx0XHRcdFx0XHRcdFx0c3RvcmFnZVNlcnZpY2UucmVtb3ZlKHNlbGVjdFNldHRpbmdzU3luY1NlcnZpY2VEaWFsb2dTaG93bktleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcml2YXRlIGFzeW5jIHNlbGVjdFNldHRpbmdzU3luY1NlcnZpY2UoZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UpOiBQcm9taXNlPFVzZXJEYXRhU3luY1N0b3JlVHlwZSB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0XHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLnByb21wdDxVc2VyRGF0YVN5bmNTdG9yZVR5cGU+KHtcblx0XHRcdFx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3NlbGVjdFN5bmNTZXJ2aWNlLm1lc3NhZ2UnLCBcIkNob29zZSB0aGUgc2V0dGluZ3Mgc3luYyBzZXJ2aWNlIHRvIHVzZSBhZnRlciBjaGFuZ2luZyB0aGUgdmVyc2lvblwiKSxcblx0XHRcdFx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdzZWxlY3RTeW5jU2VydmljZS5kZXRhaWwnLCBcIlRoZSBJbnNpZGVycyB2ZXJzaW9uIG9mIFZTIENvZGUgd2lsbCBzeW5jaHJvbml6ZSB5b3VyIHNldHRpbmdzLCBrZXliaW5kaW5ncywgZXh0ZW5zaW9ucywgc25pcHBldHMgYW5kIFVJIFN0YXRlIHVzaW5nIHNlcGFyYXRlIGluc2lkZXJzIHNldHRpbmdzIHN5bmMgc2VydmljZSBieSBkZWZhdWx0LlwiKSxcblx0XHRcdFx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoeyBrZXk6ICd1c2UgaW5zaWRlcnMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZJbnNpZGVyc1wiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+ICdpbnNpZGVycydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoeyBrZXk6ICd1c2Ugc3RhYmxlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU3RhYmxlIChjdXJyZW50KVwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+ICdzdGFibGUnXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRjYW5jZWxCdXR0b246IHRydWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixPQUFPLGNBQWM7QUFDckIsU0FBUyxZQUFZLHlCQUF5QjtBQUM5QyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxrQkFBa0IsYUFBcUIscUJBQXFCO0FBQ3JFLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsZ0JBQXNDLFdBQW9CLHlCQUF5QjtBQUM1RixTQUFTLHNCQUFzQixnQkFBZ0I7QUFDL0MsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxhQUFhLE9BQU8saUJBQWlCO0FBQzlDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZUFBNEIsb0JBQW9CLHNCQUFzQjtBQUMvRSxTQUFTLGNBQWMsUUFBUSxpQkFBaUIsZUFBZTtBQUMvRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUFnQyxzQkFBc0IscUNBQXFDLGtCQUF5QztBQUM3SSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0I7QUFFbEIsTUFB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
