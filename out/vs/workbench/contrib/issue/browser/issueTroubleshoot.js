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
import { localize, localize2 } from "../../../../nls.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IWorkbenchIssueService } from "../common/issue.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IUserDataProfileImportExportService, IUserDataProfileManagementService, IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IExtensionBisectService } from "../../../services/extensionManagement/browser/extensionBisect.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import { RemoteNameContext } from "../../../common/contextkeys.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
const ITroubleshootIssueService = createDecorator("ITroubleshootIssueService");
var TroubleshootStage = /* @__PURE__ */ ((TroubleshootStage2) => {
  TroubleshootStage2[TroubleshootStage2["EXTENSIONS"] = 1] = "EXTENSIONS";
  TroubleshootStage2[TroubleshootStage2["WORKBENCH"] = 2] = "WORKBENCH";
  return TroubleshootStage2;
})(TroubleshootStage || {});
class TroubleShootState {
  constructor(stage, profile) {
    this.stage = stage;
    this.profile = profile;
  }
  static fromJSON(raw) {
    if (!raw) {
      return void 0;
    }
    try {
      const data = JSON.parse(raw);
      if ((data.stage === 1 /* EXTENSIONS */ || data.stage === 2 /* WORKBENCH */) && typeof data.profile === "string") {
        return new TroubleShootState(data.stage, data.profile);
      }
    } catch {
    }
    return void 0;
  }
}
let TroubleshootIssueService = class extends Disposable {
  constructor(userDataProfileService, userDataProfilesService, userDataProfileManagementService, userDataProfileImportExportService, dialogService, extensionBisectService, notificationService, extensionManagementService, extensionEnablementService, issueService, productService, hostService, storageService, openerService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.userDataProfileImportExportService = userDataProfileImportExportService;
    this.dialogService = dialogService;
    this.extensionBisectService = extensionBisectService;
    this.notificationService = notificationService;
    this.extensionManagementService = extensionManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this.issueService = issueService;
    this.productService = productService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.openerService = openerService;
  }
  isActive() {
    return this.state !== void 0;
  }
  async start() {
    if (this.isActive()) {
      throw new Error("invalid state");
    }
    const res = await this.dialogService.confirm({
      message: localize("troubleshoot issue", "Troubleshoot Issue"),
      detail: localize("detail.start", "Issue troubleshooting is a process to help you identify the cause for an issue. The cause for an issue can be a misconfiguration, due to an extension, or be {0} itself.\n\nDuring the process the window reloads repeatedly. Each time you must confirm if you are still seeing the issue.", this.productService.nameLong),
      primaryButton: localize({ key: "msg", comment: ["&& denotes a mnemonic"] }, "&&Troubleshoot Issue"),
      custom: true
    });
    if (!res.confirmed) {
      return;
    }
    const originalProfile = this.userDataProfileService.currentProfile;
    await this.userDataProfileImportExportService.createTroubleshootProfile();
    this.state = new TroubleShootState(1 /* EXTENSIONS */, originalProfile.id);
    await this.resume();
  }
  async resume() {
    if (!this.isActive()) {
      return;
    }
    if (this.state?.stage === 1 /* EXTENSIONS */ && !this.extensionBisectService.isActive) {
      await this.reproduceIssueWithExtensionsDisabled();
    }
    if (this.state?.stage === 2 /* WORKBENCH */) {
      await this.reproduceIssueWithEmptyProfile();
    }
    await this.stop();
  }
  async stop() {
    if (!this.isActive()) {
      return;
    }
    if (this.notificationHandle) {
      this.notificationHandle.close();
      this.notificationHandle = void 0;
    }
    if (this.extensionBisectService.isActive) {
      await this.extensionBisectService.reset();
    }
    const profile = this.userDataProfilesService.profiles.find((p) => p.id === this.state?.profile) ?? this.userDataProfilesService.defaultProfile;
    this.state = void 0;
    await this.userDataProfileManagementService.switchProfile(profile);
  }
  async reproduceIssueWithExtensionsDisabled() {
    if (!(await this.extensionManagementService.getInstalled(ExtensionType.User)).length) {
      this.state = new TroubleShootState(2 /* WORKBENCH */, this.state.profile);
      return;
    }
    const result = await this.askToReproduceIssue(localize("profile.extensions.disabled", "Issue troubleshooting is active and has temporarily disabled all installed extensions. Check if you can still reproduce the problem and proceed by selecting from these options."));
    if (result === "good") {
      const profile = this.userDataProfilesService.profiles.find((p) => p.id === this.state.profile) ?? this.userDataProfilesService.defaultProfile;
      await this.reproduceIssueWithExtensionsBisect(profile);
    }
    if (result === "bad") {
      this.state = new TroubleShootState(2 /* WORKBENCH */, this.state.profile);
    }
    if (result === "stop") {
      await this.stop();
    }
  }
  async reproduceIssueWithEmptyProfile() {
    await this.userDataProfileManagementService.createAndEnterTransientProfile();
    this.updateState(this.state);
    const result = await this.askToReproduceIssue(localize("empty.profile", "Issue troubleshooting is active and has temporarily reset your configurations to defaults. Check if you can still reproduce the problem and proceed by selecting from these options."));
    if (result === "stop") {
      await this.stop();
    }
    if (result === "good") {
      await this.askToReportIssue(localize("issue is with configuration", 'Issue troubleshooting has identified that the issue is caused by your configurations. Please report the issue by exporting your configurations using "Export Profile" command and share the file in the issue report.'));
    }
    if (result === "bad") {
      await this.askToReportIssue(localize("issue is in core", "Issue troubleshooting has identified that the issue is with {0}.", this.productService.nameLong));
    }
  }
  async reproduceIssueWithExtensionsBisect(profile) {
    await this.userDataProfileManagementService.switchProfile(profile);
    const extensions = (await this.extensionManagementService.getInstalled(ExtensionType.User)).filter((ext) => this.extensionEnablementService.isEnabled(ext));
    await this.extensionBisectService.start(extensions);
    await this.hostService.reload();
  }
  askToReproduceIssue(message) {
    return new Promise((c, e) => {
      const goodPrompt = {
        label: localize("I cannot reproduce", "I Can't Reproduce"),
        run: () => c("good")
      };
      const badPrompt = {
        label: localize("This is Bad", "I Can Reproduce"),
        run: () => c("bad")
      };
      const stop = {
        label: localize("Stop", "Stop"),
        run: () => c("stop")
      };
      this.notificationHandle = this.notificationService.prompt(
        Severity.Info,
        message,
        [goodPrompt, badPrompt, stop],
        { sticky: true, priority: NotificationPriority.URGENT }
      );
    });
  }
  async askToReportIssue(message) {
    let isCheckedInInsiders = false;
    if (this.productService.quality === "stable") {
      const res = await this.askToReproduceIssueWithInsiders();
      if (res === "good") {
        await this.dialogService.prompt({
          type: Severity.Info,
          message: localize("troubleshoot issue", "Troubleshoot Issue"),
          detail: localize("use insiders", "This likely means that the issue has been addressed already and will be available in an upcoming release. You can safely use {0} insiders until the new stable version is available.", this.productService.nameLong),
          custom: true
        });
        return;
      }
      if (res === "stop") {
        await this.stop();
        return;
      }
      if (res === "bad") {
        isCheckedInInsiders = true;
      }
    }
    await this.issueService.openReporter({
      issueBody: `> ${message} ${isCheckedInInsiders ? `It is confirmed that the issue exists in ${this.productService.nameLong} Insiders` : ""}`
    });
  }
  async askToReproduceIssueWithInsiders() {
    const confirmRes = await this.dialogService.confirm({
      type: "info",
      message: localize("troubleshoot issue", "Troubleshoot Issue"),
      primaryButton: localize("download insiders", "Download {0} Insiders", this.productService.nameLong),
      cancelButton: localize("report anyway", "Report Issue Anyway"),
      detail: localize("ask to download insiders", "Please try to download and reproduce the issue in {0} insiders.", this.productService.nameLong),
      custom: {
        disableCloseAction: true
      }
    });
    if (!confirmRes.confirmed) {
      return void 0;
    }
    const opened = await this.openerService.open(URI.parse("https://aka.ms/vscode-insiders"));
    if (!opened) {
      return void 0;
    }
    const res = await this.dialogService.prompt({
      type: "info",
      message: localize("troubleshoot issue", "Troubleshoot Issue"),
      buttons: [{
        label: localize("good", "I can't reproduce"),
        run: () => "good"
      }, {
        label: localize("bad", "I can reproduce"),
        run: () => "bad"
      }],
      cancelButton: {
        label: localize("stop", "Stop"),
        run: () => "stop"
      },
      detail: localize("ask to reproduce issue", "Please try to reproduce the issue in {0} insiders and confirm if the issue exists there.", this.productService.nameLong),
      custom: {
        disableCloseAction: true
      }
    });
    return res.result;
  }
  get state() {
    if (this._state === void 0) {
      const raw = this.storageService.get(TroubleshootIssueService.storageKey, StorageScope.PROFILE);
      this._state = TroubleShootState.fromJSON(raw);
    }
    return this._state || void 0;
  }
  set state(state) {
    this._state = state ?? null;
    this.updateState(state);
  }
  updateState(state) {
    if (state) {
      this.storageService.store(TroubleshootIssueService.storageKey, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(TroubleshootIssueService.storageKey, StorageScope.PROFILE);
    }
  }
};
TroubleshootIssueService.storageKey = "issueTroubleshootState";
TroubleshootIssueService = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IUserDataProfileManagementService),
  __decorateParam(3, IUserDataProfileImportExportService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IExtensionBisectService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IExtensionManagementService),
  __decorateParam(8, IWorkbenchExtensionEnablementService),
  __decorateParam(9, IWorkbenchIssueService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IStorageService),
  __decorateParam(13, IOpenerService)
], TroubleshootIssueService);
let IssueTroubleshootUi = class extends Disposable {
  constructor(contextKeyService, troubleshootIssueService, storageService) {
    super();
    this.contextKeyService = contextKeyService;
    this.troubleshootIssueService = troubleshootIssueService;
    this.updateContext();
    if (troubleshootIssueService.isActive()) {
      troubleshootIssueService.resume();
    }
    this._register(storageService.onDidChangeValue(StorageScope.PROFILE, TroubleshootIssueService.storageKey, this._store)(() => {
      this.updateContext();
    }));
  }
  updateContext() {
    IssueTroubleshootUi.ctxIsTroubleshootActive.bindTo(this.contextKeyService).set(this.troubleshootIssueService.isActive());
  }
};
IssueTroubleshootUi.ctxIsTroubleshootActive = new RawContextKey("isIssueTroubleshootActive", false);
IssueTroubleshootUi = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ITroubleshootIssueService),
  __decorateParam(2, IStorageService)
], IssueTroubleshootUi);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(IssueTroubleshootUi, LifecyclePhase.Restored);
registerAction2(class TroubleshootIssueAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.troubleshootIssue.start",
      title: localize2("troubleshootIssue", "Troubleshoot Issue..."),
      category: Categories.Help,
      f1: true,
      precondition: ContextKeyExpr.and(IssueTroubleshootUi.ctxIsTroubleshootActive.negate(), RemoteNameContext.isEqualTo(""), IsWebContext.negate())
    });
  }
  run(accessor) {
    return accessor.get(ITroubleshootIssueService).start();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.troubleshootIssue.stop",
      title: localize2("title.stop", "Stop Troubleshoot Issue"),
      category: Categories.Help,
      f1: true,
      precondition: IssueTroubleshootUi.ctxIsTroubleshootActive
    });
  }
  async run(accessor) {
    return accessor.get(ITroubleshootIssueService).stop();
  }
});
registerSingleton(ITroubleshootIssueService, TroubleshootIssueService, InstantiationType.Delayed);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2lzc3VlVHJvdWJsZXNob290LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vaXNzdWUuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLCBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UsIElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25CaXNlY3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9icm93c2VyL2V4dGVuc2lvbkJpc2VjdC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uSGFuZGxlLCBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSwgTm90aWZpY2F0aW9uUHJpb3JpdHksIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yLCBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUmVtb3RlTmFtZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSXNXZWJDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuXG5jb25zdCBJVHJvdWJsZXNob290SXNzdWVTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2U+KCdJVHJvdWJsZXNob290SXNzdWVTZXJ2aWNlJyk7XG5cbmludGVyZmFjZSBJVHJvdWJsZXNob290SXNzdWVTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRpc0FjdGl2ZSgpOiBib29sZWFuO1xuXHRzdGFydCgpOiBQcm9taXNlPHZvaWQ+O1xuXHRyZXN1bWUoKTogUHJvbWlzZTx2b2lkPjtcblx0c3RvcCgpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5lbnVtIFRyb3VibGVzaG9vdFN0YWdlIHtcblx0RVhURU5TSU9OUyA9IDEsXG5cdFdPUktCRU5DSCxcbn1cblxudHlwZSBUcm91YmxlU2hvb3RSZXN1bHQgPSAnZ29vZCcgfCAnYmFkJyB8ICdzdG9wJztcblxuY2xhc3MgVHJvdWJsZVNob290U3RhdGUge1xuXG5cdHN0YXRpYyBmcm9tSlNPTihyYXc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFRyb3VibGVTaG9vdFN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXJhdykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGludGVyZmFjZSBSYXcgZXh0ZW5kcyBUcm91YmxlU2hvb3RTdGF0ZSB7IH1cblx0XHRcdGNvbnN0IGRhdGE6IFJhdyA9IEpTT04ucGFyc2UocmF3KTtcblx0XHRcdGlmIChcblx0XHRcdFx0KGRhdGEuc3RhZ2UgPT09IFRyb3VibGVzaG9vdFN0YWdlLkVYVEVOU0lPTlMgfHwgZGF0YS5zdGFnZSA9PT0gVHJvdWJsZXNob290U3RhZ2UuV09SS0JFTkNIKVxuXHRcdFx0XHQmJiB0eXBlb2YgZGF0YS5wcm9maWxlID09PSAnc3RyaW5nJ1xuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBuZXcgVHJvdWJsZVNob290U3RhdGUoZGF0YS5zdGFnZSwgZGF0YS5wcm9maWxlKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHsgLyogaWdub3JlICovIH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgc3RhZ2U6IFRyb3VibGVzaG9vdFN0YWdlLFxuXHRcdHJlYWRvbmx5IHByb2ZpbGU6IHN0cmluZyxcblx0KSB7IH1cbn1cblxuY2xhc3MgVHJvdWJsZXNob290SXNzdWVTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgc3RvcmFnZUtleSA9ICdpc3N1ZVRyb3VibGVzaG9vdFN0YXRlJztcblxuXHRwcml2YXRlIG5vdGlmaWNhdGlvbkhhbmRsZTogSU5vdGlmaWNhdGlvbkhhbmRsZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25CaXNlY3RTZXJ2aWNlOiBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaElzc3VlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGlzc3VlU2VydmljZTogSVdvcmtiZW5jaElzc3VlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGlzQWN0aXZlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pc0FjdGl2ZSgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc3RhdGUnKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndHJvdWJsZXNob290IGlzc3VlJywgXCJUcm91Ymxlc2hvb3QgSXNzdWVcIiksXG5cdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdkZXRhaWwuc3RhcnQnLCBcIklzc3VlIHRyb3VibGVzaG9vdGluZyBpcyBhIHByb2Nlc3MgdG8gaGVscCB5b3UgaWRlbnRpZnkgdGhlIGNhdXNlIGZvciBhbiBpc3N1ZS4gVGhlIGNhdXNlIGZvciBhbiBpc3N1ZSBjYW4gYmUgYSBtaXNjb25maWd1cmF0aW9uLCBkdWUgdG8gYW4gZXh0ZW5zaW9uLCBvciBiZSB7MH0gaXRzZWxmLlxcblxcbkR1cmluZyB0aGUgcHJvY2VzcyB0aGUgd2luZG93IHJlbG9hZHMgcmVwZWF0ZWRseS4gRWFjaCB0aW1lIHlvdSBtdXN0IGNvbmZpcm0gaWYgeW91IGFyZSBzdGlsbCBzZWVpbmcgdGhlIGlzc3VlLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbXNnJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVHJvdWJsZXNob290IElzc3VlXCIpLFxuXHRcdFx0Y3VzdG9tOiB0cnVlXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlcy5jb25maXJtZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbFByb2ZpbGUgPSB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGU7XG5cdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLmNyZWF0ZVRyb3VibGVzaG9vdFByb2ZpbGUoKTtcblx0XHR0aGlzLnN0YXRlID0gbmV3IFRyb3VibGVTaG9vdFN0YXRlKFRyb3VibGVzaG9vdFN0YWdlLkVYVEVOU0lPTlMsIG9yaWdpbmFsUHJvZmlsZS5pZCk7XG5cdFx0YXdhaXQgdGhpcy5yZXN1bWUoKTtcblx0fVxuXG5cdGFzeW5jIHJlc3VtZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaXNBY3RpdmUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnN0YXRlPy5zdGFnZSA9PT0gVHJvdWJsZXNob290U3RhZ2UuRVhURU5TSU9OUyAmJiAhdGhpcy5leHRlbnNpb25CaXNlY3RTZXJ2aWNlLmlzQWN0aXZlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlcHJvZHVjZUlzc3VlV2l0aEV4dGVuc2lvbnNEaXNhYmxlZCgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnN0YXRlPy5zdGFnZSA9PT0gVHJvdWJsZXNob290U3RhZ2UuV09SS0JFTkNIKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlcHJvZHVjZUlzc3VlV2l0aEVtcHR5UHJvZmlsZSgpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuc3RvcCgpO1xuXHR9XG5cblx0YXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaXNBY3RpdmUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm5vdGlmaWNhdGlvbkhhbmRsZSkge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25IYW5kbGUuY2xvc2UoKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uSGFuZGxlID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbkJpc2VjdFNlcnZpY2UuaXNBY3RpdmUpIHtcblx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uQmlzZWN0U2VydmljZS5yZXNldCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2ZpbGUgPSB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSB0aGlzLnN0YXRlPy5wcm9maWxlKSA/PyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlO1xuXHRcdHRoaXMuc3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2hQcm9maWxlKHByb2ZpbGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXByb2R1Y2VJc3N1ZVdpdGhFeHRlbnNpb25zRGlzYWJsZWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCEoYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyKSkubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnN0YXRlID0gbmV3IFRyb3VibGVTaG9vdFN0YXRlKFRyb3VibGVzaG9vdFN0YWdlLldPUktCRU5DSCwgdGhpcy5zdGF0ZSEucHJvZmlsZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5hc2tUb1JlcHJvZHVjZUlzc3VlKGxvY2FsaXplKCdwcm9maWxlLmV4dGVuc2lvbnMuZGlzYWJsZWQnLCBcIklzc3VlIHRyb3VibGVzaG9vdGluZyBpcyBhY3RpdmUgYW5kIGhhcyB0ZW1wb3JhcmlseSBkaXNhYmxlZCBhbGwgaW5zdGFsbGVkIGV4dGVuc2lvbnMuIENoZWNrIGlmIHlvdSBjYW4gc3RpbGwgcmVwcm9kdWNlIHRoZSBwcm9ibGVtIGFuZCBwcm9jZWVkIGJ5IHNlbGVjdGluZyBmcm9tIHRoZXNlIG9wdGlvbnMuXCIpKTtcblx0XHRpZiAocmVzdWx0ID09PSAnZ29vZCcpIHtcblx0XHRcdGNvbnN0IHByb2ZpbGUgPSB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSB0aGlzLnN0YXRlIS5wcm9maWxlKSA/PyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlO1xuXHRcdFx0YXdhaXQgdGhpcy5yZXByb2R1Y2VJc3N1ZVdpdGhFeHRlbnNpb25zQmlzZWN0KHByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAocmVzdWx0ID09PSAnYmFkJykge1xuXHRcdFx0dGhpcy5zdGF0ZSA9IG5ldyBUcm91YmxlU2hvb3RTdGF0ZShUcm91Ymxlc2hvb3RTdGFnZS5XT1JLQkVOQ0gsIHRoaXMuc3RhdGUhLnByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAocmVzdWx0ID09PSAnc3RvcCcpIHtcblx0XHRcdGF3YWl0IHRoaXMuc3RvcCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVwcm9kdWNlSXNzdWVXaXRoRW1wdHlQcm9maWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UuY3JlYXRlQW5kRW50ZXJUcmFuc2llbnRQcm9maWxlKCk7XG5cdFx0dGhpcy51cGRhdGVTdGF0ZSh0aGlzLnN0YXRlKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmFza1RvUmVwcm9kdWNlSXNzdWUobG9jYWxpemUoJ2VtcHR5LnByb2ZpbGUnLCBcIklzc3VlIHRyb3VibGVzaG9vdGluZyBpcyBhY3RpdmUgYW5kIGhhcyB0ZW1wb3JhcmlseSByZXNldCB5b3VyIGNvbmZpZ3VyYXRpb25zIHRvIGRlZmF1bHRzLiBDaGVjayBpZiB5b3UgY2FuIHN0aWxsIHJlcHJvZHVjZSB0aGUgcHJvYmxlbSBhbmQgcHJvY2VlZCBieSBzZWxlY3RpbmcgZnJvbSB0aGVzZSBvcHRpb25zLlwiKSk7XG5cdFx0aWYgKHJlc3VsdCA9PT0gJ3N0b3AnKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnN0b3AoKTtcblx0XHR9XG5cdFx0aWYgKHJlc3VsdCA9PT0gJ2dvb2QnKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFza1RvUmVwb3J0SXNzdWUobG9jYWxpemUoJ2lzc3VlIGlzIHdpdGggY29uZmlndXJhdGlvbicsIFwiSXNzdWUgdHJvdWJsZXNob290aW5nIGhhcyBpZGVudGlmaWVkIHRoYXQgdGhlIGlzc3VlIGlzIGNhdXNlZCBieSB5b3VyIGNvbmZpZ3VyYXRpb25zLiBQbGVhc2UgcmVwb3J0IHRoZSBpc3N1ZSBieSBleHBvcnRpbmcgeW91ciBjb25maWd1cmF0aW9ucyB1c2luZyBcXFwiRXhwb3J0IFByb2ZpbGVcXFwiIGNvbW1hbmQgYW5kIHNoYXJlIHRoZSBmaWxlIGluIHRoZSBpc3N1ZSByZXBvcnQuXCIpKTtcblx0XHR9XG5cdFx0aWYgKHJlc3VsdCA9PT0gJ2JhZCcpIHtcblx0XHRcdGF3YWl0IHRoaXMuYXNrVG9SZXBvcnRJc3N1ZShsb2NhbGl6ZSgnaXNzdWUgaXMgaW4gY29yZScsIFwiSXNzdWUgdHJvdWJsZXNob290aW5nIGhhcyBpZGVudGlmaWVkIHRoYXQgdGhlIGlzc3VlIGlzIHdpdGggezB9LlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXByb2R1Y2VJc3N1ZVdpdGhFeHRlbnNpb25zQmlzZWN0KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLnN3aXRjaFByb2ZpbGUocHJvZmlsZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IChhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZChFeHRlbnNpb25UeXBlLlVzZXIpKS5maWx0ZXIoZXh0ID0+IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGV4dCkpO1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uQmlzZWN0U2VydmljZS5zdGFydChleHRlbnNpb25zKTtcblx0XHRhd2FpdCB0aGlzLmhvc3RTZXJ2aWNlLnJlbG9hZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc2tUb1JlcHJvZHVjZUlzc3VlKG1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8VHJvdWJsZVNob290UmVzdWx0PiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChjLCBlKSA9PiB7XG5cdFx0XHRjb25zdCBnb29kUHJvbXB0OiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ0kgY2Fubm90IHJlcHJvZHVjZScsIFwiSSBDYW4ndCBSZXByb2R1Y2VcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gYygnZ29vZCcpXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgYmFkUHJvbXB0OiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ1RoaXMgaXMgQmFkJywgXCJJIENhbiBSZXByb2R1Y2VcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gYygnYmFkJylcblx0XHRcdH07XG5cdFx0XHRjb25zdCBzdG9wOiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ1N0b3AnLCBcIlN0b3BcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gYygnc3RvcCcpXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25IYW5kbGUgPSB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRbZ29vZFByb21wdCwgYmFkUHJvbXB0LCBzdG9wXSxcblx0XHRcdFx0eyBzdGlja3k6IHRydWUsIHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlQgfVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYXNrVG9SZXBvcnRJc3N1ZShtZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgaXNDaGVja2VkSW5JbnNpZGVycyA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgPT09ICdzdGFibGUnKSB7XG5cdFx0XHRjb25zdCByZXMgPSBhd2FpdCB0aGlzLmFza1RvUmVwcm9kdWNlSXNzdWVXaXRoSW5zaWRlcnMoKTtcblx0XHRcdGlmIChyZXMgPT09ICdnb29kJykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd0cm91Ymxlc2hvb3QgaXNzdWUnLCBcIlRyb3VibGVzaG9vdCBJc3N1ZVwiKSxcblx0XHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCd1c2UgaW5zaWRlcnMnLCBcIlRoaXMgbGlrZWx5IG1lYW5zIHRoYXQgdGhlIGlzc3VlIGhhcyBiZWVuIGFkZHJlc3NlZCBhbHJlYWR5IGFuZCB3aWxsIGJlIGF2YWlsYWJsZSBpbiBhbiB1cGNvbWluZyByZWxlYXNlLiBZb3UgY2FuIHNhZmVseSB1c2UgezB9IGluc2lkZXJzIHVudGlsIHRoZSBuZXcgc3RhYmxlIHZlcnNpb24gaXMgYXZhaWxhYmxlLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdFx0XHRjdXN0b206IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChyZXMgPT09ICdzdG9wJykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnN0b3AoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlcyA9PT0gJ2JhZCcpIHtcblx0XHRcdFx0aXNDaGVja2VkSW5JbnNpZGVycyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5pc3N1ZVNlcnZpY2Uub3BlblJlcG9ydGVyKHtcblx0XHRcdGlzc3VlQm9keTogYD4gJHttZXNzYWdlfSAke2lzQ2hlY2tlZEluSW5zaWRlcnMgPyBgSXQgaXMgY29uZmlybWVkIHRoYXQgdGhlIGlzc3VlIGV4aXN0cyBpbiAke3RoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmd9IEluc2lkZXJzYCA6ICcnfWAsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFza1RvUmVwcm9kdWNlSXNzdWVXaXRoSW5zaWRlcnMoKTogUHJvbWlzZTxUcm91YmxlU2hvb3RSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjb25maXJtUmVzID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Ryb3VibGVzaG9vdCBpc3N1ZScsIFwiVHJvdWJsZXNob290IElzc3VlXCIpLFxuXHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ2Rvd25sb2FkIGluc2lkZXJzJywgXCJEb3dubG9hZCB7MH0gSW5zaWRlcnNcIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRjYW5jZWxCdXR0b246IGxvY2FsaXplKCdyZXBvcnQgYW55d2F5JywgXCJSZXBvcnQgSXNzdWUgQW55d2F5XCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnYXNrIHRvIGRvd25sb2FkIGluc2lkZXJzJywgXCJQbGVhc2UgdHJ5IHRvIGRvd25sb2FkIGFuZCByZXByb2R1Y2UgdGhlIGlzc3VlIGluIHswfSBpbnNpZGVycy5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRjdXN0b206IHtcblx0XHRcdFx0ZGlzYWJsZUNsb3NlQWN0aW9uOiB0cnVlLFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKCFjb25maXJtUmVzLmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBvcGVuZWQgPSBhd2FpdCB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UoJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS1pbnNpZGVycycpKTtcblx0XHRpZiAoIW9wZW5lZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0PFRyb3VibGVTaG9vdFJlc3VsdD4oe1xuXHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Ryb3VibGVzaG9vdCBpc3N1ZScsIFwiVHJvdWJsZXNob290IElzc3VlXCIpLFxuXHRcdFx0YnV0dG9uczogW3tcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdnb29kJywgXCJJIGNhbid0IHJlcHJvZHVjZVwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiAnZ29vZCdcblx0XHRcdH0sIHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdiYWQnLCBcIkkgY2FuIHJlcHJvZHVjZVwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiAnYmFkJ1xuXHRcdFx0fV0sXG5cdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzdG9wJywgXCJTdG9wXCIpLFxuXHRcdFx0XHRydW46ICgpID0+ICdzdG9wJ1xuXHRcdFx0fSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2FzayB0byByZXByb2R1Y2UgaXNzdWUnLCBcIlBsZWFzZSB0cnkgdG8gcmVwcm9kdWNlIHRoZSBpc3N1ZSBpbiB7MH0gaW5zaWRlcnMgYW5kIGNvbmZpcm0gaWYgdGhlIGlzc3VlIGV4aXN0cyB0aGVyZS5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRjdXN0b206IHtcblx0XHRcdFx0ZGlzYWJsZUNsb3NlQWN0aW9uOiB0cnVlLFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlcy5yZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9zdGF0ZTogVHJvdWJsZVNob290U3RhdGUgfCB1bmRlZmluZWQgfCBudWxsO1xuXHRnZXQgc3RhdGUoKTogVHJvdWJsZVNob290U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCByYXcgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2Uuc3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdFx0dGhpcy5fc3RhdGUgPSBUcm91YmxlU2hvb3RTdGF0ZS5mcm9tSlNPTihyYXcpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc3RhdGUgfHwgdW5kZWZpbmVkO1xuXHR9XG5cblx0c2V0IHN0YXRlKHN0YXRlOiBUcm91YmxlU2hvb3RTdGF0ZSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3N0YXRlID0gc3RhdGUgPz8gbnVsbDtcblx0XHR0aGlzLnVwZGF0ZVN0YXRlKHN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3RhdGUoc3RhdGU6IFRyb3VibGVTaG9vdFN0YXRlIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFRyb3VibGVzaG9vdElzc3VlU2VydmljZS5zdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShzdGF0ZSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2Uuc3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBJc3N1ZVRyb3VibGVzaG9vdFVpIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0c3RhdGljIGN0eElzVHJvdWJsZXNob290QWN0aXZlID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2lzSXNzdWVUcm91Ymxlc2hvb3RBY3RpdmUnLCBmYWxzZSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0cm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2U6IElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMudXBkYXRlQ29udGV4dCgpO1xuXHRcdGlmICh0cm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UuaXNBY3RpdmUoKSkge1xuXHRcdFx0dHJvdWJsZXNob290SXNzdWVTZXJ2aWNlLnJlc3VtZSgpO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3RlcihzdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2Uuc3RvcmFnZUtleSwgdGhpcy5fc3RvcmUpKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlQ29udGV4dCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29udGV4dCgpOiB2b2lkIHtcblx0XHRJc3N1ZVRyb3VibGVzaG9vdFVpLmN0eElzVHJvdWJsZXNob290QWN0aXZlLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQodGhpcy50cm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UuaXNBY3RpdmUoKSk7XG5cdH1cblxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihFeHRlbnNpb25zLldvcmtiZW5jaCkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oSXNzdWVUcm91Ymxlc2hvb3RVaSwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVHJvdWJsZXNob290SXNzdWVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRyb3VibGVzaG9vdElzc3VlLnN0YXJ0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Ryb3VibGVzaG9vdElzc3VlJywgJ1Ryb3VibGVzaG9vdCBJc3N1ZS4uLicpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuSGVscCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoSXNzdWVUcm91Ymxlc2hvb3RVaS5jdHhJc1Ryb3VibGVzaG9vdEFjdGl2ZS5uZWdhdGUoKSwgUmVtb3RlTmFtZUNvbnRleHQuaXNFcXVhbFRvKCcnKSwgSXNXZWJDb250ZXh0Lm5lZ2F0ZSgpKSxcblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UpLnN0YXJ0KCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRyb3VibGVzaG9vdElzc3VlLnN0b3AnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGl0bGUuc3RvcCcsICdTdG9wIFRyb3VibGVzaG9vdCBJc3N1ZScpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuSGVscCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc3N1ZVRyb3VibGVzaG9vdFVpLmN0eElzVHJvdWJsZXNob290QWN0aXZlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElUcm91Ymxlc2hvb3RJc3N1ZVNlcnZpY2UpLnN0b3AoKTtcblx0fVxufSk7XG5cblxucmVnaXN0ZXJTaW5nbGV0b24oSVRyb3VibGVzaG9vdElzc3VlU2VydmljZSwgVHJvdWJsZXNob290SXNzdWVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMscUNBQXFDLG1DQUFtQywrQkFBK0I7QUFDaEgsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBOEIsc0JBQXFDLHNCQUFzQixnQkFBZ0I7QUFD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
