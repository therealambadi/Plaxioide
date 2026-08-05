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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILifecycleService, LifecyclePhase, ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { localize, localize2 } from "../../../../nls.js";
import { IEditSessionsStorageService, ChangeType, FileType, EDIT_SESSION_SYNC_CATEGORY, EDIT_SESSIONS_CONTAINER_ID, EditSessionSchemaVersion, IEditSessionsLogService, EDIT_SESSIONS_VIEW_ICON, EDIT_SESSIONS_TITLE, EDIT_SESSIONS_SHOW_VIEW, EDIT_SESSIONS_DATA_VIEW_ID, decodeEditSessionFileContent, hashedEditSessionId, editSessionsLogId, EDIT_SESSIONS_PENDING } from "../common/editSessions.js";
import { ISCMService } from "../../scm/common/scm.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { URI } from "../../../../base/common/uri.js";
import { basename, joinPath, relativePath } from "../../../../base/common/resources.js";
import { encodeBase64 } from "../../../../base/common/buffer.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { EditSessionsWorkbenchService } from "./editSessionsStorageService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { UserDataSyncErrorCode, UserDataSyncStoreError } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { getFileNamesMessage, IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { Schemas } from "../../../../base/common/network.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { EditSessionsLogService } from "../common/editSessionsLogService.js";
import { Extensions as ViewExtensions, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { EditSessionsDataViews } from "./editSessionsViews.js";
import { EditSessionsFileSystemProvider } from "./editSessionsFileSystemProvider.js";
import { isNative, isWeb } from "../../../../base/common/platform.js";
import { VirtualWorkspaceContext, WorkspaceFolderCountContext } from "../../../common/contextkeys.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { equals } from "../../../../base/common/objects.js";
import { EditSessionIdentityMatch, IEditSessionIdentityService } from "../../../../platform/workspace/common/editSessions.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { WorkspaceStateSynchroniser } from "../common/workspaceStateSync.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { EditSessionsStoreClient } from "../common/editSessionsStorageClient.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceIdentityService } from "../../../services/workspaces/common/workspaceIdentityService.js";
import { hashAsync } from "../../../../base/common/hash.js";
registerSingleton(IEditSessionsLogService, EditSessionsLogService, InstantiationType.Delayed);
registerSingleton(IEditSessionsStorageService, EditSessionsWorkbenchService, InstantiationType.Delayed);
const continueWorkingOnCommand = {
  id: "_workbench.editSessions.actions.continueEditSession",
  title: localize2("continue working on", "Continue Working On..."),
  precondition: WorkspaceFolderCountContext.notEqualsTo("0"),
  f1: true
};
const openLocalFolderCommand = {
  id: "_workbench.editSessions.actions.continueEditSession.openLocalFolder",
  title: localize2("continue edit session in local folder", "Open In Local Folder"),
  category: EDIT_SESSION_SYNC_CATEGORY,
  precondition: ContextKeyExpr.and(IsWebContext.toNegated(), VirtualWorkspaceContext)
};
const showOutputChannelCommand = {
  id: "workbench.editSessions.actions.showOutputChannel",
  title: localize2("show log", "Show Log"),
  category: EDIT_SESSION_SYNC_CATEGORY
};
const installAdditionalContinueOnOptionsCommand = {
  id: "workbench.action.continueOn.extensions",
  title: localize("continueOn.installAdditional", "Install additional development environment options")
};
registerAction2(class extends Action2 {
  constructor() {
    super({ ...installAdditionalContinueOnOptionsCommand, f1: false });
  }
  async run(accessor) {
    return accessor.get(IExtensionsWorkbenchService).openSearch("@tag:continueOn");
  }
});
const resumeProgressOptionsTitle = `[${localize("resuming working changes window", "Resuming working changes...")}](command:${showOutputChannelCommand.id})`;
const resumeProgressOptions = {
  location: ProgressLocation.Window,
  type: "syncing"
};
const queryParamName = "editSessionId";
const useEditSessionsWithContinueOn = "workbench.editSessions.continueOn";
let EditSessionsContribution = class extends Disposable {
  constructor(editSessionsStorageService, fileService, progressService, openerService, telemetryService, scmService, notificationService, dialogService, logService, environmentService, instantiationService, productService, configurationService, contextService, editSessionIdentityService, quickInputService, commandService, contextKeyService, fileDialogService, lifecycleService, storageService, activityService, editorService, remoteAgentService, extensionService, requestService, userDataProfilesService, uriIdentityService, workspaceIdentityService) {
    super();
    this.editSessionsStorageService = editSessionsStorageService;
    this.fileService = fileService;
    this.progressService = progressService;
    this.openerService = openerService;
    this.telemetryService = telemetryService;
    this.scmService = scmService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.productService = productService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.editSessionIdentityService = editSessionIdentityService;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.fileDialogService = fileDialogService;
    this.lifecycleService = lifecycleService;
    this.storageService = storageService;
    this.activityService = activityService;
    this.editorService = editorService;
    this.remoteAgentService = remoteAgentService;
    this.extensionService = extensionService;
    this.requestService = requestService;
    this.userDataProfilesService = userDataProfilesService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceIdentityService = workspaceIdentityService;
    this.continueEditSessionOptions = [];
    this.accountsMenuBadgeDisposable = this._register(new MutableDisposable());
    this.registeredCommands = /* @__PURE__ */ new Set();
    this.shouldShowViewsContext = EDIT_SESSIONS_SHOW_VIEW.bindTo(this.contextKeyService);
    this.pendingEditSessionsContext = EDIT_SESSIONS_PENDING.bindTo(this.contextKeyService);
    this.pendingEditSessionsContext.set(false);
    if (!this.productService["editSessions.store"]?.url) {
      return;
    }
    this.editSessionsStorageClient = new EditSessionsStoreClient(URI.parse(this.productService["editSessions.store"].url), this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService);
    this.editSessionsStorageService.storeClient = this.editSessionsStorageClient;
    this.workspaceStateSynchronizer = new WorkspaceStateSynchroniser(this.userDataProfilesService.defaultProfile, void 0, this.editSessionsStorageClient, this.logService, this.fileService, this.environmentService, this.telemetryService, this.configurationService, this.storageService, this.uriIdentityService, this.workspaceIdentityService, this.editSessionsStorageService);
    this.autoResumeEditSession();
    this.registerActions();
    this.registerViews();
    this.registerContributedEditSessionOptions();
    this._register(this.fileService.registerProvider(EditSessionsFileSystemProvider.SCHEMA, new EditSessionsFileSystemProvider(this.editSessionsStorageService)));
    this.lifecycleService.onWillShutdown((e) => {
      if (e.reason !== ShutdownReason.RELOAD && this.editSessionsStorageService.isSignedIn && this.configurationService.getValue("workbench.experimental.cloudChanges.autoStore") === "onShutdown" && !isWeb) {
        e.join(this.autoStoreEditSession(), { id: "autoStoreWorkingChanges", label: localize("autoStoreWorkingChanges", "Storing current working changes...") });
      }
    });
    this._register(this.editSessionsStorageService.onDidSignIn(() => this.updateAccountsMenuBadge()));
    this._register(this.editSessionsStorageService.onDidSignOut(() => this.updateAccountsMenuBadge()));
  }
  async autoResumeEditSession() {
    const shouldAutoResumeOnReload = this.configurationService.getValue("workbench.cloudChanges.autoResume") === "onReload";
    if (this.environmentService.editSessionId !== void 0) {
      this.logService.info(`Resuming cloud changes, reason: found editSessionId ${this.environmentService.editSessionId} in environment service...`);
      await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(this.environmentService.editSessionId, void 0, void 0, void 0, progress).finally(() => this.environmentService.editSessionId = void 0));
    } else if (shouldAutoResumeOnReload && this.editSessionsStorageService.isSignedIn) {
      this.logService.info("Resuming cloud changes, reason: cloud changes enabled...");
      await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
    } else if (shouldAutoResumeOnReload) {
      const hasApplicationLaunchedFromContinueOnFlow = this.storageService.getBoolean(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, StorageScope.APPLICATION, false);
      this.logService.info(`Prompting to enable cloud changes, has application previously launched from Continue On flow: ${hasApplicationLaunchedFromContinueOnFlow}`);
      const handlePendingEditSessions = () => {
        this.logService.info("Showing badge to enable cloud changes in accounts menu...");
        this.updateAccountsMenuBadge();
        this.pendingEditSessionsContext.set(true);
        const disposable = this.editSessionsStorageService.onDidSignIn(async () => {
          disposable.dispose();
          this.logService.info("Showing badge to enable cloud changes in accounts menu succeeded, resuming cloud changes...");
          await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
          this.storageService.remove(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, StorageScope.APPLICATION);
          this.environmentService.continueOn = void 0;
        });
      };
      if (this.environmentService.continueOn !== void 0 && !this.editSessionsStorageService.isSignedIn && // and user has not yet been prompted to sign in on this machine
      hasApplicationLaunchedFromContinueOnFlow === false) {
        this.storageService.store(EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        this.logService.info("Prompting to enable cloud changes...");
        await this.editSessionsStorageService.initialize("read");
        if (this.editSessionsStorageService.isSignedIn) {
          this.logService.info("Prompting to enable cloud changes succeeded, resuming cloud changes...");
          await this.progressService.withProgress(resumeProgressOptions, async (progress) => await this.resumeEditSession(void 0, true, void 0, void 0, progress));
        } else {
          handlePendingEditSessions();
        }
      } else if (!this.editSessionsStorageService.isSignedIn && // and user has been prompted to sign in on this machine
      hasApplicationLaunchedFromContinueOnFlow === true) {
        handlePendingEditSessions();
      }
    } else {
      this.logService.debug("Auto resuming cloud changes disabled.");
    }
  }
  updateAccountsMenuBadge() {
    if (this.editSessionsStorageService.isSignedIn) {
      return this.accountsMenuBadgeDisposable.clear();
    }
    const badge = new NumberBadge(1, () => localize("check for pending cloud changes", "Check for pending cloud changes"));
    this.accountsMenuBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
  }
  async autoStoreEditSession() {
    const cancellationTokenSource = new CancellationTokenSource();
    await this.progressService.withProgress({
      location: ProgressLocation.Window,
      type: "syncing",
      title: localize("store working changes", "Storing working changes...")
    }, async () => this.storeEditSession(false, cancellationTokenSource.token), () => {
      cancellationTokenSource.cancel();
      cancellationTokenSource.dispose();
    });
  }
  registerViews() {
    const container = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer(
      {
        id: EDIT_SESSIONS_CONTAINER_ID,
        title: EDIT_SESSIONS_TITLE,
        ctorDescriptor: new SyncDescriptor(
          ViewPaneContainer,
          [EDIT_SESSIONS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]
        ),
        icon: EDIT_SESSIONS_VIEW_ICON,
        hideIfEmpty: true
      },
      ViewContainerLocation.Sidebar,
      { doNotRegisterOpenCommand: true }
    );
    this._register(this.instantiationService.createInstance(EditSessionsDataViews, container));
  }
  registerActions() {
    this.registerContinueEditSessionAction();
    this.registerResumeLatestEditSessionAction();
    this.registerStoreLatestEditSessionAction();
    this.registerContinueInLocalFolderAction();
    this.registerShowEditSessionViewAction();
    this.registerShowEditSessionOutputChannelAction();
  }
  registerShowEditSessionOutputChannelAction() {
    this._register(registerAction2(class ShowEditSessionOutput extends Action2 {
      constructor() {
        super(showOutputChannelCommand);
      }
      run(accessor, ...args) {
        const outputChannel = accessor.get(IOutputService);
        void outputChannel.showChannel(editSessionsLogId);
      }
    }));
  }
  registerShowEditSessionViewAction() {
    const that = this;
    this._register(registerAction2(class ShowEditSessionView extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.showEditSessions",
          title: localize2("show cloud changes", "Show Cloud Changes"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        that.shouldShowViewsContext.set(true);
        const viewsService = accessor.get(IViewsService);
        await viewsService.openView(EDIT_SESSIONS_DATA_VIEW_ID);
      }
    }));
  }
  registerContinueEditSessionAction() {
    const that = this;
    this._register(registerAction2(class ContinueEditSessionAction extends Action2 {
      constructor() {
        super(continueWorkingOnCommand);
      }
      async run(accessor, workspaceUri, destination) {
        let uri = workspaceUri;
        if (!destination && !uri) {
          destination = await that.pickContinueEditSessionDestination();
          if (!destination) {
            that.telemetryService.publicLog2("continueOn.editSessions.pick.outcome", { outcome: "noSelection" });
            return;
          }
        }
        const shouldStoreEditSession = await that.shouldContinueOnWithEditSession();
        let ref;
        if (shouldStoreEditSession) {
          that.telemetryService.publicLog2("continueOn.editSessions.store");
          const cancellationTokenSource = new CancellationTokenSource();
          try {
            ref = await that.progressService.withProgress({
              location: ProgressLocation.Notification,
              cancellable: true,
              type: "syncing",
              title: localize("store your working changes", "Storing your working changes...")
            }, async () => {
              const ref2 = await that.storeEditSession(false, cancellationTokenSource.token);
              if (ref2 !== void 0) {
                that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeSucceeded", hashedId: hashedEditSessionId(ref2) });
              } else {
                that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeSkipped" });
              }
              return ref2;
            }, () => {
              cancellationTokenSource.cancel();
              cancellationTokenSource.dispose();
              that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeCancelledByUser" });
            });
          } catch (ex) {
            that.telemetryService.publicLog2("continueOn.editSessions.store.outcome", { outcome: "storeFailed" });
            throw ex;
          }
        }
        uri = destination ? await that.resolveDestination(destination) : uri;
        if (uri === void 0) {
          return;
        }
        if (ref !== void 0 && uri !== "noDestinationUri") {
          const encodedRef = encodeURIComponent(ref);
          uri = uri.with({
            query: uri.query.length > 0 ? uri.query + `&${queryParamName}=${encodedRef}&continueOn=1` : `${queryParamName}=${encodedRef}&continueOn=1`
          });
          that.logService.info(`Opening ${uri.toString()}`);
          await that.openerService.open(uri, { openExternal: true });
        } else if (!shouldStoreEditSession && uri !== "noDestinationUri") {
          that.logService.info(`Opening ${uri.toString()}`);
          await that.openerService.open(uri, { openExternal: true });
        } else if (ref === void 0 && shouldStoreEditSession) {
          that.logService.warn(`Failed to store working changes when invoking ${continueWorkingOnCommand.id}.`);
        }
      }
    }));
  }
  registerResumeLatestEditSessionAction() {
    const that = this;
    this._register(registerAction2(class ResumeLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.resumeLatest",
          title: localize2("resume latest cloud changes", "Resume Latest Changes from Cloud"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor, editSessionId, forceApplyUnrelatedChange) {
        await that.progressService.withProgress({ ...resumeProgressOptions, title: resumeProgressOptionsTitle }, async () => await that.resumeEditSession(editSessionId, void 0, forceApplyUnrelatedChange));
      }
    }));
    this._register(registerAction2(class ResumeLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.resumeFromSerializedPayload",
          title: localize2("resume cloud changes", "Resume Changes from Serialized Data"),
          category: "Developer",
          f1: true
        });
      }
      async run(accessor, editSessionId) {
        const data = await that.quickInputService.input({ prompt: "Enter serialized data" });
        if (data) {
          that.editSessionsStorageService.lastReadResources.set("editSessions", { content: data, ref: "" });
        }
        await that.progressService.withProgress({ ...resumeProgressOptions, title: resumeProgressOptionsTitle }, async () => await that.resumeEditSession(editSessionId, void 0, void 0, void 0, void 0, data));
      }
    }));
  }
  registerStoreLatestEditSessionAction() {
    const that = this;
    this._register(registerAction2(class StoreLatestEditSessionAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.storeCurrent",
          title: localize2("store working changes in cloud", "Store Working Changes in Cloud"),
          category: EDIT_SESSION_SYNC_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        const cancellationTokenSource = new CancellationTokenSource();
        await that.progressService.withProgress({
          location: ProgressLocation.Notification,
          title: localize("storing working changes", "Storing working changes...")
        }, async () => {
          that.telemetryService.publicLog2("editSessions.store");
          await that.storeEditSession(true, cancellationTokenSource.token);
        }, () => {
          cancellationTokenSource.cancel();
          cancellationTokenSource.dispose();
        });
      }
    }));
  }
  async resumeEditSession(ref, silent, forceApplyUnrelatedChange, applyPartialMatch, progress, serializedData) {
    await this.remoteAgentService.getEnvironment();
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    this.logService.info(ref !== void 0 ? `Resuming changes from cloud with ref ${ref}...` : "Checking for pending cloud changes...");
    if (silent && !await this.editSessionsStorageService.initialize("read", true)) {
      return;
    }
    this.telemetryService.publicLog2("editSessions.resume");
    performance.mark("code/willResumeEditSessionFromIdentifier");
    progress?.report({ message: localize("checkingForWorkingChanges", "Checking for pending cloud changes...") });
    const data = serializedData ? { content: serializedData, ref: "" } : await this.editSessionsStorageService.read("editSessions", ref);
    if (!data) {
      if (ref === void 0 && !silent) {
        this.notificationService.info(localize("no cloud changes", "There are no changes to resume from the cloud."));
      } else if (ref !== void 0) {
        this.notificationService.warn(localize("no cloud changes for ref", "Could not resume changes from the cloud for ID {0}.", ref));
      }
      this.logService.info(ref !== void 0 ? `Aborting resuming changes from cloud as no edit session content is available to be applied from ref ${ref}.` : `Aborting resuming edit session as no edit session content is available to be applied`);
      return;
    }
    progress?.report({ message: resumeProgressOptionsTitle });
    const editSession = JSON.parse(data.content);
    ref = data.ref;
    if (editSession.version > EditSessionSchemaVersion) {
      this.notificationService.error(localize("client too old", "Please upgrade to a newer version of {0} to resume your working changes from the cloud.", this.productService.nameLong));
      this.telemetryService.publicLog2("editSessions.resume.outcome", { hashedId: hashedEditSessionId(ref), outcome: "clientUpdateNeeded" });
      return;
    }
    try {
      const { changes, conflictingChanges } = await this.generateChanges(editSession, ref, forceApplyUnrelatedChange, applyPartialMatch);
      if (changes.length === 0) {
        return;
      }
      if (conflictingChanges.length > 0) {
        const { confirmed } = await this.dialogService.confirm({
          type: Severity.Warning,
          message: conflictingChanges.length > 1 ? localize("resume edit session warning many", "Resuming your working changes from the cloud will overwrite the following {0} files. Do you want to proceed?", conflictingChanges.length) : localize("resume edit session warning 1", "Resuming your working changes from the cloud will overwrite {0}. Do you want to proceed?", basename(conflictingChanges[0].uri)),
          detail: conflictingChanges.length > 1 ? getFileNamesMessage(conflictingChanges.map((c) => c.uri)) : void 0
        });
        if (!confirmed) {
          return;
        }
      }
      for (const { uri, type, contents } of changes) {
        if (type === ChangeType.Addition) {
          await this.fileService.writeFile(uri, decodeEditSessionFileContent(editSession.version, contents));
        } else if (type === ChangeType.Deletion && await this.fileService.exists(uri)) {
          await this.fileService.del(uri);
        }
      }
      await this.workspaceStateSynchronizer?.apply();
      this.logService.info(`Deleting edit session with ref ${ref} after successfully applying it to current workspace...`);
      await this.editSessionsStorageService.delete("editSessions", ref);
      this.logService.info(`Deleted edit session with ref ${ref}.`);
      this.telemetryService.publicLog2("editSessions.resume.outcome", { hashedId: hashedEditSessionId(ref), outcome: "resumeSucceeded" });
    } catch (ex) {
      this.logService.error("Failed to resume edit session, reason: ", ex.toString());
      this.notificationService.error(localize("resume failed", "Failed to resume your working changes from the cloud."));
    }
    performance.mark("code/didResumeEditSessionFromIdentifier");
  }
  async generateChanges(editSession, ref, forceApplyUnrelatedChange = false, applyPartialMatch = false) {
    const changes = [];
    const conflictingChanges = [];
    const workspaceFolders = this.contextService.getWorkspace().folders;
    const cancellationTokenSource = new CancellationTokenSource();
    for (const folder of editSession.folders) {
      let folderRoot;
      if (folder.canonicalIdentity) {
        for (const f of workspaceFolders) {
          const identity = await this.editSessionIdentityService.getEditSessionIdentifier(f, cancellationTokenSource.token);
          this.logService.info(`Matching identity ${identity} against edit session folder identity ${folder.canonicalIdentity}...`);
          if (equals(identity, folder.canonicalIdentity) || forceApplyUnrelatedChange) {
            folderRoot = f;
            break;
          }
          if (identity !== void 0) {
            const match = await this.editSessionIdentityService.provideEditSessionIdentityMatch(f, identity, folder.canonicalIdentity, cancellationTokenSource.token);
            if (match === EditSessionIdentityMatch.Complete) {
              folderRoot = f;
              break;
            } else if (match === EditSessionIdentityMatch.Partial && this.configurationService.getValue("workbench.experimental.cloudChanges.partialMatches.enabled") === true) {
              if (!applyPartialMatch) {
                this.notificationService.prompt(
                  Severity.Info,
                  localize("editSessionPartialMatch", "You have pending working changes in the cloud for this workspace. Would you like to resume them?"),
                  [{ label: localize("resume", "Resume"), run: () => this.resumeEditSession(ref, false, void 0, true) }]
                );
              } else {
                folderRoot = f;
                break;
              }
            }
          }
        }
      } else {
        folderRoot = workspaceFolders.find((f) => f.name === folder.name);
      }
      if (!folderRoot) {
        this.logService.info(`Skipping applying ${folder.workingChanges.length} changes from edit session with ref ${ref} as no matching workspace folder was found.`);
        return { changes: [], conflictingChanges: [], contributedStateHandlers: [] };
      }
      const localChanges = /* @__PURE__ */ new Set();
      for (const repository of this.scmService.repositories) {
        if (repository.provider.rootUri !== void 0 && this.contextService.getWorkspaceFolder(repository.provider.rootUri)?.name === folder.name) {
          const repositoryChanges = this.getChangedResources(repository);
          repositoryChanges.forEach((change) => localChanges.add(change.toString()));
        }
      }
      for (const change of folder.workingChanges) {
        const uri = joinPath(folderRoot.uri, change.relativeFilePath);
        changes.push({ uri, type: change.type, contents: change.contents });
        if (await this.willChangeLocalContents(localChanges, uri, change)) {
          conflictingChanges.push({ uri, type: change.type, contents: change.contents });
        }
      }
    }
    return { changes, conflictingChanges };
  }
  async willChangeLocalContents(localChanges, uriWithIncomingChanges, incomingChange) {
    if (!localChanges.has(uriWithIncomingChanges.toString())) {
      return false;
    }
    const { contents, type } = incomingChange;
    switch (type) {
      case ChangeType.Addition: {
        const [originalContents, incomingContents] = await Promise.all([
          hashAsync(contents),
          hashAsync(encodeBase64((await this.fileService.readFile(uriWithIncomingChanges)).value))
        ]);
        return originalContents !== incomingContents;
      }
      case ChangeType.Deletion: {
        return await this.fileService.exists(uriWithIncomingChanges);
      }
      default:
        throw new Error("Unhandled change type.");
    }
  }
  async storeEditSession(fromStoreCommand, cancellationToken) {
    const folders = [];
    let editSessionSize = 0;
    let hasEdits = false;
    await this.editorService.saveAll();
    for (const repository of this.scmService.repositories) {
      const trackedUris = this.getChangedResources(repository);
      const workingChanges = [];
      const { rootUri } = repository.provider;
      const workspaceFolder = rootUri ? this.contextService.getWorkspaceFolder(rootUri) : void 0;
      let name = workspaceFolder?.name;
      for (const uri of trackedUris) {
        const workspaceFolder2 = this.contextService.getWorkspaceFolder(uri);
        if (!workspaceFolder2) {
          this.logService.info(`Skipping working change ${uri.toString()} as no associated workspace folder was found.`);
          continue;
        }
        await this.editSessionIdentityService.onWillCreateEditSessionIdentity(workspaceFolder2, cancellationToken);
        name = name ?? workspaceFolder2.name;
        const relativeFilePath = relativePath(workspaceFolder2.uri, uri) ?? uri.path;
        try {
          if (!(await this.fileService.stat(uri)).isFile) {
            continue;
          }
        } catch {
        }
        hasEdits = true;
        if (await this.fileService.exists(uri)) {
          const contents = encodeBase64((await this.fileService.readFile(uri)).value);
          editSessionSize += contents.length;
          if (editSessionSize > this.editSessionsStorageService.SIZE_LIMIT) {
            this.notificationService.error(localize("payload too large", "Your working changes exceed the size limit and cannot be stored."));
            return void 0;
          }
          workingChanges.push({ type: ChangeType.Addition, fileType: FileType.File, contents, relativeFilePath });
        } else {
          workingChanges.push({ type: ChangeType.Deletion, fileType: FileType.File, contents: void 0, relativeFilePath });
        }
      }
      let canonicalIdentity = void 0;
      if (workspaceFolder !== null && workspaceFolder !== void 0) {
        canonicalIdentity = await this.editSessionIdentityService.getEditSessionIdentifier(workspaceFolder, cancellationToken);
      }
      folders.push({ workingChanges, name: name ?? "", canonicalIdentity: canonicalIdentity ?? void 0, absoluteUri: workspaceFolder?.uri.toString() });
    }
    await this.workspaceStateSynchronizer?.sync();
    if (!hasEdits) {
      this.logService.info("Skipped storing working changes in the cloud as there are no edits to store.");
      if (fromStoreCommand) {
        this.notificationService.info(localize("no working changes to store", "Skipped storing working changes in the cloud as there are no edits to store."));
      }
      return void 0;
    }
    const data = { folders, version: 2, workspaceStateId: this.editSessionsStorageService.lastWrittenResources.get("workspaceState")?.ref };
    try {
      this.logService.info(`Storing edit session...`);
      const ref = await this.editSessionsStorageService.write("editSessions", data);
      this.logService.info(`Stored edit session with ref ${ref}.`);
      return ref;
    } catch (ex) {
      this.logService.error(`Failed to store edit session, reason: `, ex.toString());
      if (ex instanceof UserDataSyncStoreError) {
        switch (ex.code) {
          case UserDataSyncErrorCode.TooLarge:
            this.telemetryService.publicLog2("editSessions.upload.failed", { reason: "TooLarge" });
            this.notificationService.error(localize("payload too large", "Your working changes exceed the size limit and cannot be stored."));
            break;
          default:
            this.telemetryService.publicLog2("editSessions.upload.failed", { reason: "unknown" });
            this.notificationService.error(localize("payload failed", "Your working changes cannot be stored."));
            break;
        }
      }
    }
    return void 0;
  }
  getChangedResources(repository) {
    return repository.provider.groups.reduce((resources, resourceGroups) => {
      resourceGroups.resources.forEach((resource) => resources.add(resource.sourceUri));
      return resources;
    }, /* @__PURE__ */ new Set());
  }
  hasEditSession() {
    for (const repository of this.scmService.repositories) {
      if (this.getChangedResources(repository).size > 0) {
        return true;
      }
    }
    return false;
  }
  async shouldContinueOnWithEditSession() {
    if (this.editSessionsStorageService.isSignedIn) {
      return this.hasEditSession();
    }
    if (this.configurationService.getValue(useEditSessionsWithContinueOn) === "off") {
      this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "disabledEditSessionsViaSetting" });
      return false;
    }
    if (this.hasEditSession()) {
      const disposables = new DisposableStore();
      const quickpick = disposables.add(this.quickInputService.createQuickPick());
      quickpick.placeholder = localize("continue with cloud changes", "Select whether to bring your working changes with you");
      quickpick.ok = false;
      quickpick.ignoreFocusOut = true;
      const withCloudChanges = { label: localize("with cloud changes", "Yes, continue with my working changes") };
      const withoutCloudChanges = { label: localize("without cloud changes", "No, continue without my working changes") };
      quickpick.items = [withCloudChanges, withoutCloudChanges];
      const continueWithCloudChanges = await new Promise((resolve, reject) => {
        disposables.add(quickpick.onDidAccept(() => {
          resolve(quickpick.selectedItems[0] === withCloudChanges);
          disposables.dispose();
        }));
        disposables.add(quickpick.onDidHide(() => {
          reject(new CancellationError());
          disposables.dispose();
        }));
        quickpick.show();
      });
      if (!continueWithCloudChanges) {
        this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "didNotEnableEditSessionsWhenPrompted" });
        return continueWithCloudChanges;
      }
      const initialized = await this.editSessionsStorageService.initialize("write");
      if (!initialized) {
        this.telemetryService.publicLog2("continueOn.editSessions.canStore.outcome", { outcome: "didNotEnableEditSessionsWhenPrompted" });
      }
      return initialized;
    }
    return false;
  }
  //#region Continue Edit Session extension contribution point
  registerContributedEditSessionOptions() {
    continueEditSessionExtPoint.setHandler((extensions) => {
      const continueEditSessionOptions = [];
      for (const extension of extensions) {
        if (!isProposedApiEnabled(extension.description, "contribEditSessions")) {
          continue;
        }
        if (!Array.isArray(extension.value)) {
          continue;
        }
        for (const contribution of extension.value) {
          const command = MenuRegistry.getCommand(contribution.command);
          if (!command) {
            return;
          }
          const icon = command.icon;
          const title = typeof command.title === "string" ? command.title : command.title.value;
          const when = ContextKeyExpr.deserialize(contribution.when);
          continueEditSessionOptions.push(new ContinueEditSessionItem(
            ThemeIcon.isThemeIcon(icon) ? `$(${icon.id}) ${title}` : title,
            command.id,
            command.source?.title,
            when,
            contribution.documentation
          ));
          if (contribution.qualifiedName) {
            this.generateStandaloneOptionCommand(command.id, contribution.qualifiedName, contribution.category ?? command.category, when, contribution.remoteGroup);
          }
        }
      }
      this.continueEditSessionOptions = continueEditSessionOptions;
    });
  }
  generateStandaloneOptionCommand(commandId, qualifiedName, category, when, remoteGroup) {
    const command = {
      id: `${continueWorkingOnCommand.id}.${commandId}`,
      title: { original: qualifiedName, value: qualifiedName },
      category: typeof category === "string" ? { original: category, value: category } : category,
      precondition: when,
      f1: true
    };
    if (!this.registeredCommands.has(command.id)) {
      this.registeredCommands.add(command.id);
      this._register(registerAction2(class StandaloneContinueOnOption extends Action2 {
        constructor() {
          super(command);
        }
        async run(accessor) {
          return accessor.get(ICommandService).executeCommand(continueWorkingOnCommand.id, void 0, commandId);
        }
      }));
      if (remoteGroup !== void 0) {
        MenuRegistry.appendMenuItem(MenuId.StatusBarRemoteIndicatorMenu, {
          group: remoteGroup,
          command,
          when: command.precondition
        });
      }
    }
  }
  registerContinueInLocalFolderAction() {
    const that = this;
    this._register(registerAction2(class ContinueInLocalFolderAction extends Action2 {
      constructor() {
        super(openLocalFolderCommand);
      }
      async run(accessor) {
        const selection = await that.fileDialogService.showOpenDialog({
          title: localize("continueEditSession.openLocalFolder.title.v2", "Select a local folder to continue working in"),
          canSelectFolders: true,
          canSelectMany: false,
          canSelectFiles: false,
          availableFileSystems: [Schemas.file]
        });
        return selection?.length !== 1 ? void 0 : URI.from({
          scheme: that.productService.urlProtocol,
          authority: Schemas.file,
          path: selection[0].path
        });
      }
    }));
    if (getVirtualWorkspaceLocation(this.contextService.getWorkspace()) !== void 0 && isNative) {
      this.generateStandaloneOptionCommand(openLocalFolderCommand.id, localize("continueWorkingOn.existingLocalFolder", "Continue Working in Existing Local Folder"), void 0, openLocalFolderCommand.precondition, void 0);
    }
  }
  async pickContinueEditSessionDestination() {
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const workspaceContext = this.contextService.getWorkbenchState() === WorkbenchState.FOLDER ? this.contextService.getWorkspace().folders[0].name : this.contextService.getWorkspace().folders.map((folder) => folder.name).join(", ");
    quickPick.placeholder = localize("continueEditSessionPick.title.v2", "Select a development environment to continue working on {0} in", `'${workspaceContext}'`);
    quickPick.items = this.createPickItems();
    this.extensionService.onDidChangeExtensions(() => {
      quickPick.items = this.createPickItems();
    });
    const command = await new Promise((resolve, reject) => {
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        resolve(void 0);
      }));
      disposables.add(quickPick.onDidAccept((e) => {
        const selection = quickPick.activeItems[0].command;
        if (selection === installAdditionalContinueOnOptionsCommand.id) {
          void this.commandService.executeCommand(installAdditionalContinueOnOptionsCommand.id);
        } else {
          resolve(selection);
          quickPick.hide();
        }
      }));
      quickPick.show();
      disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
        if (e.item.documentation !== void 0) {
          const uri = URI.isUri(e.item.documentation) ? URI.parse(e.item.documentation) : await this.commandService.executeCommand(e.item.documentation);
          void this.openerService.open(uri, { openExternal: true });
        }
      }));
    });
    quickPick.dispose();
    return command;
  }
  async resolveDestination(command) {
    try {
      const uri = await this.commandService.executeCommand(command);
      if (uri === void 0) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "noDestinationUri" });
        return "noDestinationUri";
      }
      if (URI.isUri(uri)) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "resolvedUri" });
        return uri;
      }
      this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "invalidDestination" });
      return void 0;
    } catch (ex) {
      if (ex instanceof CancellationError) {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "cancelled" });
      } else {
        this.telemetryService.publicLog2("continueOn.openDestination.outcome", { selection: command, outcome: "unknownError" });
      }
      return void 0;
    }
  }
  createPickItems() {
    const items = [...this.continueEditSessionOptions].filter((option) => option.when === void 0 || this.contextKeyService.contextMatchesRules(option.when));
    if (getVirtualWorkspaceLocation(this.contextService.getWorkspace()) !== void 0 && isNative) {
      items.push(new ContinueEditSessionItem(
        "$(folder) " + localize("continueEditSessionItem.openInLocalFolder.v2", "Open in Local Folder"),
        openLocalFolderCommand.id,
        localize("continueEditSessionItem.builtin", "Built-in")
      ));
    }
    const sortedItems = items.sort((item1, item2) => item1.label.localeCompare(item2.label));
    return sortedItems.concat({ type: "separator" }, new ContinueEditSessionItem(installAdditionalContinueOnOptionsCommand.title, installAdditionalContinueOnOptionsCommand.id));
  }
};
EditSessionsContribution.APPLICATION_LAUNCHED_VIA_CONTINUE_ON_STORAGE_KEY = "applicationLaunchedViaContinueOn";
EditSessionsContribution = __decorateClass([
  __decorateParam(0, IEditSessionsStorageService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IProgressService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, ISCMService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IEditSessionsLogService),
  __decorateParam(9, IEnvironmentService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IEditSessionIdentityService),
  __decorateParam(15, IQuickInputService),
  __decorateParam(16, ICommandService),
  __decorateParam(17, IContextKeyService),
  __decorateParam(18, IFileDialogService),
  __decorateParam(19, ILifecycleService),
  __decorateParam(20, IStorageService),
  __decorateParam(21, IActivityService),
  __decorateParam(22, IEditorService),
  __decorateParam(23, IRemoteAgentService),
  __decorateParam(24, IExtensionService),
  __decorateParam(25, IRequestService),
  __decorateParam(26, IUserDataProfilesService),
  __decorateParam(27, IUriIdentityService),
  __decorateParam(28, IWorkspaceIdentityService)
], EditSessionsContribution);
const infoButtonClass = ThemeIcon.asClassName(Codicon.info);
class ContinueEditSessionItem {
  constructor(label, command, description, when, documentation) {
    this.label = label;
    this.command = command;
    this.description = description;
    this.when = when;
    this.documentation = documentation;
    if (documentation !== void 0) {
      this.buttons = [{
        iconClass: infoButtonClass,
        tooltip: localize("learnMoreTooltip", "Learn More")
      }];
    }
  }
}
const continueEditSessionExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "continueEditSession",
  jsonSchema: {
    description: localize("continueEditSessionExtPoint", "Contributes options for continuing the current edit session in a different environment"),
    type: "array",
    items: {
      type: "object",
      properties: {
        command: {
          description: localize("continueEditSessionExtPoint.command", "Identifier of the command to execute. The command must be declared in the 'commands'-section and return a URI representing a different environment where the current edit session can be continued."),
          type: "string"
        },
        group: {
          description: localize("continueEditSessionExtPoint.group", "Group into which this item belongs."),
          type: "string"
        },
        qualifiedName: {
          description: localize("continueEditSessionExtPoint.qualifiedName", "A fully qualified name for this item which is used for display in menus."),
          type: "string"
        },
        description: {
          description: localize("continueEditSessionExtPoint.description", "The url, or a command that returns the url, to the option's documentation page."),
          type: "string"
        },
        remoteGroup: {
          description: localize("continueEditSessionExtPoint.remoteGroup", "Group into which this item belongs in the remote indicator."),
          type: "string"
        },
        when: {
          description: localize("continueEditSessionExtPoint.when", "Condition which must be true to show this item."),
          type: "string"
        }
      },
      required: ["command"]
    }
  }
});
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(EditSessionsContribution, LifecyclePhase.Restored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  "properties": {
    "workbench.experimental.cloudChanges.autoStore": {
      enum: ["onShutdown", "off"],
      enumDescriptions: [
        localize("autoStoreWorkingChanges.onShutdown", "Automatically store current working changes in the cloud on window close."),
        localize("autoStoreWorkingChanges.off", "Never attempt to automatically store working changes in the cloud.")
      ],
      "type": "string",
      "tags": ["experimental", "usesOnlineServices"],
      "default": "off",
      "markdownDescription": localize("autoStoreWorkingChangesDescription", "Controls whether to automatically store available working changes in the cloud for the current workspace. This setting has no effect in the web.")
    },
    "workbench.cloudChanges.autoResume": {
      enum: ["onReload", "off"],
      enumDescriptions: [
        localize("autoResumeWorkingChanges.onReload", "Automatically resume available working changes from the cloud on window reload."),
        localize("autoResumeWorkingChanges.off", "Never attempt to resume working changes from the cloud.")
      ],
      "type": "string",
      "tags": ["usesOnlineServices"],
      "default": "onReload",
      "markdownDescription": localize("autoResumeWorkingChanges", "Controls whether to automatically resume available working changes stored in the cloud for the current workspace.")
    },
    "workbench.cloudChanges.continueOn": {
      enum: ["prompt", "off"],
      enumDescriptions: [
        localize("continueOnCloudChanges.promptForAuth", "Prompt the user to sign in to store working changes in the cloud with Continue Working On."),
        localize("continueOnCloudChanges.off", "Do not store working changes in the cloud with Continue Working On unless the user has already turned on Cloud Changes.")
      ],
      type: "string",
      tags: ["usesOnlineServices"],
      default: "prompt",
      markdownDescription: localize("continueOnCloudChanges", "Controls whether to prompt the user to store working changes in the cloud when using Continue Working On.")
    },
    "workbench.experimental.cloudChanges.partialMatches.enabled": {
      "type": "boolean",
      "tags": ["experimental", "usesOnlineServices"],
      "default": false,
      "markdownDescription": localize("cloudChangesPartialMatchesEnabled", "Controls whether to surface cloud changes which partially match the current session.")
    }
  }
});
export {
  EditSessionsContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lZGl0U2Vzc2lvbnMvYnJvd3Nlci9lZGl0U2Vzc2lvbnMuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UsIFNodXRkb3duUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSUFjdGlvbjJPcHRpb25zLCBNZW51SWQsIE1lbnVSZWdpc3RyeSwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElFZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZSwgQ2hhbmdlLCBDaGFuZ2VUeXBlLCBGb2xkZXIsIEVkaXRTZXNzaW9uLCBGaWxlVHlwZSwgRURJVF9TRVNTSU9OX1NZTkNfQ0FURUdPUlksIEVESVRfU0VTU0lPTlNfQ09OVEFJTkVSX0lELCBFZGl0U2Vzc2lvblNjaGVtYVZlcnNpb24sIElFZGl0U2Vzc2lvbnNMb2dTZXJ2aWNlLCBFRElUX1NFU1NJT05TX1ZJRVdfSUNPTiwgRURJVF9TRVNTSU9OU19USVRMRSwgRURJVF9TRVNTSU9OU19TSE9XX1ZJRVcsIEVESVRfU0VTU0lPTlNfREFUQV9WSUVXX0lELCBkZWNvZGVFZGl0U2Vzc2lvbkZpbGVDb250ZW50LCBoYXNoZWRFZGl0U2Vzc2lvbklkLCBlZGl0U2Vzc2lvbnNMb2dJZCwgRURJVF9TRVNTSU9OU19QRU5ESU5HIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBJU0NNUmVwb3NpdG9yeSwgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgam9pblBhdGgsIHJlbGF0aXZlUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBlbmNvZGVCYXNlNjQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MsIElQcm9ncmVzc1NlcnZpY2UsIElQcm9ncmVzc1N0ZXAsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgRWRpdFNlc3Npb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4vZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNFcnJvckNvZGUsIFVzZXJEYXRhU3luY1N0b3JlRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGdldEZpbGVOYW1lc01lc3NhZ2UsIElEaWFsb2dTZXJ2aWNlLCBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0QnV0dG9uLCBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIENvbnRleHRLZXlFeHByZXNzaW9uLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZ2V0VmlydHVhbFdvcmtzcGFjZUxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi92aXJ0dWFsV29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElzV2ViQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdFNlc3Npb25zTG9nU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9lZGl0U2Vzc2lvbnNMb2dTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0U2Vzc2lvbnNEYXRhVmlld3MgfSBmcm9tICcuL2VkaXRTZXNzaW9uc1ZpZXdzLmpzJztcbmltcG9ydCB7IEVkaXRTZXNzaW9uc0ZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4vZWRpdFNlc3Npb25zRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGlzTmF0aXZlLCBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFZpcnR1YWxXb3Jrc3BhY2VDb250ZXh0LCBXb3Jrc3BhY2VGb2xkZXJDb3VudENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgRWRpdFNlc3Npb25JZGVudGl0eU1hdGNoLCBJRWRpdFNlc3Npb25JZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSU91dHB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgTnVtYmVyQmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hY3Rpdml0eS9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VTdGF0ZVN5bmNocm9uaXNlciB9IGZyb20gJy4uL2NvbW1vbi93b3Jrc3BhY2VTdGF0ZVN5bmMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBFZGl0U2Vzc2lvbnNTdG9yZUNsaWVudCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0U2Vzc2lvbnNTdG9yYWdlQ2xpZW50LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZUlkZW50aXR5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBoYXNoQXN5bmMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcblxucmVnaXN0ZXJTaW5nbGV0b24oSUVkaXRTZXNzaW9uc0xvZ1NlcnZpY2UsIEVkaXRTZXNzaW9uc0xvZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLCBFZGl0U2Vzc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuXG5jb25zdCBjb250aW51ZVdvcmtpbmdPbkNvbW1hbmQ6IElBY3Rpb24yT3B0aW9ucyA9IHtcblx0aWQ6ICdfd29ya2JlbmNoLmVkaXRTZXNzaW9ucy5hY3Rpb25zLmNvbnRpbnVlRWRpdFNlc3Npb24nLFxuXHR0aXRsZTogbG9jYWxpemUyKCdjb250aW51ZSB3b3JraW5nIG9uJywgJ0NvbnRpbnVlIFdvcmtpbmcgT24uLi4nKSxcblx0cHJlY29uZGl0aW9uOiBXb3Jrc3BhY2VGb2xkZXJDb3VudENvbnRleHQubm90RXF1YWxzVG8oJzAnKSxcblx0ZjE6IHRydWVcbn07XG5jb25zdCBvcGVuTG9jYWxGb2xkZXJDb21tYW5kOiBJQWN0aW9uMk9wdGlvbnMgPSB7XG5cdGlkOiAnX3dvcmtiZW5jaC5lZGl0U2Vzc2lvbnMuYWN0aW9ucy5jb250aW51ZUVkaXRTZXNzaW9uLm9wZW5Mb2NhbEZvbGRlcicsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ2NvbnRpbnVlIGVkaXQgc2Vzc2lvbiBpbiBsb2NhbCBmb2xkZXInLCAnT3BlbiBJbiBMb2NhbCBGb2xkZXInKSxcblx0Y2F0ZWdvcnk6IEVESVRfU0VTU0lPTl9TWU5DX0NBVEVHT1JZLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChJc1dlYkNvbnRleHQudG9OZWdhdGVkKCksIFZpcnR1YWxXb3Jrc3BhY2VDb250ZXh0KVxufTtcbmNvbnN0IHNob3dPdXRwdXRDaGFubmVsQ29tbWFuZDogSUFjdGlvbjJPcHRpb25zID0ge1xuXHRpZDogJ3dvcmtiZW5jaC5lZGl0U2Vzc2lvbnMuYWN0aW9ucy5zaG93T3V0cHV0Q2hhbm5lbCcsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3Nob3cgbG9nJywgXCJTaG93IExvZ1wiKSxcblx0Y2F0ZWdvcnk6IEVESVRfU0VTU0lPTl9TWU5DX0NBVEVHT1JZXG59O1xuY29uc3QgaW5zdGFsbEFkZGl0aW9uYWxDb250aW51ZU9uT3B0aW9uc0NvbW1hbmQgPSB7XG5cdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jb250aW51ZU9uLmV4dGVuc2lvbnMnLFxuXHR0aXRsZTogbG9jYWxpemUoJ2NvbnRpbnVlT24uaW5zdGFsbEFkZGl0aW9uYWwnLCAnSW5zdGFsbCBhZGRpdGlvbmFsIGRldmVsb3BtZW50IGVudmlyb25tZW50IG9wdGlvbnMnKSxcbn07XG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoeyAuLi5pbnN0YWxsQWRkaXRpb25hbENvbnRpbnVlT25PcHRpb25zQ29tbWFuZCwgZjE6IGZhbHNlIH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpLm9wZW5TZWFyY2goJ0B0YWc6Y29udGludWVPbicpO1xuXHR9XG59KTtcblxuY29uc3QgcmVzdW1lUHJvZ3Jlc3NPcHRpb25zVGl0bGUgPSBgWyR7bG9jYWxpemUoJ3Jlc3VtaW5nIHdvcmtpbmcgY2hhbmdlcyB3aW5kb3cnLCAnUmVzdW1pbmcgd29ya2luZyBjaGFuZ2VzLi4uJyl9XShjb21tYW5kOiR7c2hvd091dHB1dENoYW5uZWxDb21tYW5kLmlkfSlgO1xuY29uc3QgcmVzdW1lUHJvZ3Jlc3NPcHRpb25zID0ge1xuXHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3csXG5cdHR5cGU6ICdzeW5jaW5nJyxcbn07XG5jb25zdCBxdWVyeVBhcmFtTmFtZSA9ICdlZGl0U2Vzc2lvbklkJztcblxuY29uc3QgdXNlRWRpdFNlc3Npb25zV2l0aENvbnRpbnVlT24gPSAnd29ya2JlbmNoLmVkaXRTZXNzaW9ucy5jb250aW51ZU9uJztcbmV4cG9ydCBjbGFzcyBFZGl0U2Vzc2lvbnNDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSBjb250aW51ZUVkaXRTZXNzaW9uT3B0aW9uczogQ29udGludWVFZGl0U2Vzc2lvbkl0ZW1bXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2hvdWxkU2hvd1ZpZXdzQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgcGVuZGluZ0VkaXRTZXNzaW9uc0NvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgc3RhdGljIEFQUExJQ0FUSU9OX0xBVU5DSEVEX1ZJQV9DT05USU5VRV9PTl9TVE9SQUdFX0tFWSA9ICdhcHBsaWNhdGlvbkxhdW5jaGVkVmlhQ29udGludWVPbic7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWNjb3VudHNNZW51QmFkZ2VEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgcmVnaXN0ZXJlZENvbW1hbmRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSB3b3Jrc3BhY2VTdGF0ZVN5bmNocm9uaXplcjogV29ya3NwYWNlU3RhdGVTeW5jaHJvbmlzZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZWRpdFNlc3Npb25zU3RvcmFnZUNsaWVudDogRWRpdFNlc3Npb25zU3RvcmVDbGllbnQgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlOiBJRWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElTQ01TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtU2VydmljZTogSVNDTVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElFZGl0U2Vzc2lvbnNMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUVkaXRTZXNzaW9uc0xvZ1NlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFZGl0U2Vzc2lvbklkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRTZXNzaW9uSWRlbnRpdHlTZXJ2aWNlOiBJRWRpdFNlc3Npb25JZGVudGl0eVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcXVlc3RTZXJ2aWNlOiBJUmVxdWVzdFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VJZGVudGl0eVNlcnZpY2U6IElXb3Jrc3BhY2VJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnNob3VsZFNob3dWaWV3c0NvbnRleHQgPSBFRElUX1NFU1NJT05TX1NIT1dfVklFVy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5wZW5kaW5nRWRpdFNlc3Npb25zQ29udGV4dCA9IEVESVRfU0VTU0lPTlNfUEVORElORy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5wZW5kaW5nRWRpdFNlc3Npb25zQ29udGV4dC5zZXQoZmFsc2UpO1xuXG5cdFx0aWYgKCF0aGlzLnByb2R1Y3RTZXJ2aWNlWydlZGl0U2Vzc2lvbnMuc3RvcmUnXT8udXJsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlQ2xpZW50ID0gbmV3IEVkaXRTZXNzaW9uc1N0b3JlQ2xpZW50KFVSSS5wYXJzZSh0aGlzLnByb2R1Y3RTZXJ2aWNlWydlZGl0U2Vzc2lvbnMuc3RvcmUnXS51cmwpLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLCB0aGlzLnJlcXVlc3RTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLnN0b3JlQ2xpZW50ID0gdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlQ2xpZW50O1xuXHRcdHRoaXMud29ya3NwYWNlU3RhdGVTeW5jaHJvbml6ZXIgPSBuZXcgV29ya3NwYWNlU3RhdGVTeW5jaHJvbmlzZXIodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSwgdW5kZWZpbmVkLCB0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VDbGllbnQsIHRoaXMubG9nU2VydmljZSwgdGhpcy5maWxlU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsIHRoaXMudGVsZW1ldHJ5U2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5zdG9yYWdlU2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UsIHRoaXMud29ya3NwYWNlSWRlbnRpdHlTZXJ2aWNlLCB0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlKTtcblxuXHRcdHRoaXMuYXV0b1Jlc3VtZUVkaXRTZXNzaW9uKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyQWN0aW9ucygpO1xuXHRcdHRoaXMucmVnaXN0ZXJWaWV3cygpO1xuXHRcdHRoaXMucmVnaXN0ZXJDb250cmlidXRlZEVkaXRTZXNzaW9uT3B0aW9ucygpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKEVkaXRTZXNzaW9uc0ZpbGVTeXN0ZW1Qcm92aWRlci5TQ0hFTUEsIG5ldyBFZGl0U2Vzc2lvbnNGaWxlU3lzdGVtUHJvdmlkZXIodGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZSkpKTtcblx0XHR0aGlzLmxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24oKGUpID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiAhPT0gU2h1dGRvd25SZWFzb24uUkVMT0FEICYmIHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UuaXNTaWduZWRJbiAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3b3JrYmVuY2guZXhwZXJpbWVudGFsLmNsb3VkQ2hhbmdlcy5hdXRvU3RvcmUnKSA9PT0gJ29uU2h1dGRvd24nICYmICFpc1dlYikge1xuXHRcdFx0XHRlLmpvaW4odGhpcy5hdXRvU3RvcmVFZGl0U2Vzc2lvbigpLCB7IGlkOiAnYXV0b1N0b3JlV29ya2luZ0NoYW5nZXMnLCBsYWJlbDogbG9jYWxpemUoJ2F1dG9TdG9yZVdvcmtpbmdDaGFuZ2VzJywgJ1N0b3JpbmcgY3VycmVudCB3b3JraW5nIGNoYW5nZXMuLi4nKSB9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLm9uRGlkU2lnbkluKCgpID0+IHRoaXMudXBkYXRlQWNjb3VudHNNZW51QmFkZ2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2Uub25EaWRTaWduT3V0KCgpID0+IHRoaXMudXBkYXRlQWNjb3VudHNNZW51QmFkZ2UoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhdXRvUmVzdW1lRWRpdFNlc3Npb24oKSB7XG5cdFx0Y29uc3Qgc2hvdWxkQXV0b1Jlc3VtZU9uUmVsb2FkID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd29ya2JlbmNoLmNsb3VkQ2hhbmdlcy5hdXRvUmVzdW1lJykgPT09ICdvblJlbG9hZCc7XG5cblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZWRpdFNlc3Npb25JZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgUmVzdW1pbmcgY2xvdWQgY2hhbmdlcywgcmVhc29uOiBmb3VuZCBlZGl0U2Vzc2lvbklkICR7dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZWRpdFNlc3Npb25JZH0gaW4gZW52aXJvbm1lbnQgc2VydmljZS4uLmApO1xuXHRcdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHJlc3VtZVByb2dyZXNzT3B0aW9ucywgYXN5bmMgKHByb2dyZXNzKSA9PiBhd2FpdCB0aGlzLnJlc3VtZUVkaXRTZXNzaW9uKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmVkaXRTZXNzaW9uSWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHByb2dyZXNzKS5maW5hbGx5KCgpID0+IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmVkaXRTZXNzaW9uSWQgPSB1bmRlZmluZWQpKTtcblx0XHR9IGVsc2UgaWYgKHNob3VsZEF1dG9SZXN1bWVPblJlbG9hZCAmJiB0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLmlzU2lnbmVkSW4pIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdSZXN1bWluZyBjbG91ZCBjaGFuZ2VzLCByZWFzb246IGNsb3VkIGNoYW5nZXMgZW5hYmxlZC4uLicpO1xuXHRcdFx0Ly8gQXR0ZW1wdCB0byByZXN1bWUgZWRpdCBzZXNzaW9uIGJhc2VkIG9uIGVkaXQgd29ya3NwYWNlIGlkZW50aWZpZXJcblx0XHRcdC8vIE5vdGU6IGF0IHRoaXMgcG9pbnQgaWYgdGhlIHVzZXIgaXMgbm90IHNpZ25lZCBpbnRvIGVkaXQgc2Vzc2lvbnMsXG5cdFx0XHQvLyB3ZSBkb24ndCB3YW50IHRoZW0gdG8gYmUgcHJvbXB0ZWQgdG8gc2lnbiBpbiBhbmQgc2hvdWxkIGp1c3QgcmV0dXJuIGVhcmx5XG5cdFx0XHRhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MocmVzdW1lUHJvZ3Jlc3NPcHRpb25zLCBhc3luYyAocHJvZ3Jlc3MpID0+IGF3YWl0IHRoaXMucmVzdW1lRWRpdFNlc3Npb24odW5kZWZpbmVkLCB0cnVlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcHJvZ3Jlc3MpKTtcblx0XHR9IGVsc2UgaWYgKHNob3VsZEF1dG9SZXN1bWVPblJlbG9hZCkge1xuXHRcdFx0Ly8gVGhlIGFwcGxpY2F0aW9uIGhhcyBwcmV2aW91c2x5IGxhdW5jaGVkIHZpYSBhIHByb3RvY29sIFVSTCBDb250aW51ZSBPbiBmbG93XG5cdFx0XHRjb25zdCBoYXNBcHBsaWNhdGlvbkxhdW5jaGVkRnJvbUNvbnRpbnVlT25GbG93ID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKEVkaXRTZXNzaW9uc0NvbnRyaWJ1dGlvbi5BUFBMSUNBVElPTl9MQVVOQ0hFRF9WSUFfQ09OVElOVUVfT05fU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFByb21wdGluZyB0byBlbmFibGUgY2xvdWQgY2hhbmdlcywgaGFzIGFwcGxpY2F0aW9uIHByZXZpb3VzbHkgbGF1bmNoZWQgZnJvbSBDb250aW51ZSBPbiBmbG93OiAke2hhc0FwcGxpY2F0aW9uTGF1bmNoZWRGcm9tQ29udGludWVPbkZsb3d9YCk7XG5cblx0XHRcdGNvbnN0IGhhbmRsZVBlbmRpbmdFZGl0U2Vzc2lvbnMgPSAoKSA9PiB7XG5cdFx0XHRcdC8vIGRpc3BsYXkgYSBiYWRnZSBpbiB0aGUgYWNjb3VudHMgbWVudSBidXQgZG8gbm90IHByb21wdCB0aGUgdXNlciB0byBzaWduIGluIGFnYWluXG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTaG93aW5nIGJhZGdlIHRvIGVuYWJsZSBjbG91ZCBjaGFuZ2VzIGluIGFjY291bnRzIG1lbnUuLi4nKTtcblx0XHRcdFx0dGhpcy51cGRhdGVBY2NvdW50c01lbnVCYWRnZSgpO1xuXHRcdFx0XHR0aGlzLnBlbmRpbmdFZGl0U2Vzc2lvbnNDb250ZXh0LnNldCh0cnVlKTtcblx0XHRcdFx0Ly8gYXR0ZW1wdCBhIHJlc3VtZSBpZiB3ZSBhcmUgaW4gYSBwZW5kaW5nIHN0YXRlIGFuZCB0aGUgdXNlciBqdXN0IHNpZ25lZCBpblxuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5vbkRpZFNpZ25Jbihhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1Nob3dpbmcgYmFkZ2UgdG8gZW5hYmxlIGNsb3VkIGNoYW5nZXMgaW4gYWNjb3VudHMgbWVudSBzdWNjZWVkZWQsIHJlc3VtaW5nIGNsb3VkIGNoYW5nZXMuLi4nKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MocmVzdW1lUHJvZ3Jlc3NPcHRpb25zLCBhc3luYyAocHJvZ3Jlc3MpID0+IGF3YWl0IHRoaXMucmVzdW1lRWRpdFNlc3Npb24odW5kZWZpbmVkLCB0cnVlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcHJvZ3Jlc3MpKTtcblx0XHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShFZGl0U2Vzc2lvbnNDb250cmlidXRpb24uQVBQTElDQVRJT05fTEFVTkNIRURfVklBX0NPTlRJTlVFX09OX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdFx0XHRcdHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmNvbnRpbnVlT24gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCh0aGlzLmVudmlyb25tZW50U2VydmljZS5jb250aW51ZU9uICE9PSB1bmRlZmluZWQpICYmXG5cdFx0XHRcdCF0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLmlzU2lnbmVkSW4gJiZcblx0XHRcdFx0Ly8gYW5kIHVzZXIgaGFzIG5vdCB5ZXQgYmVlbiBwcm9tcHRlZCB0byBzaWduIGluIG9uIHRoaXMgbWFjaGluZVxuXHRcdFx0XHRoYXNBcHBsaWNhdGlvbkxhdW5jaGVkRnJvbUNvbnRpbnVlT25GbG93ID09PSBmYWxzZVxuXHRcdFx0KSB7XG5cdFx0XHRcdC8vIHN0b3JlIHRoZSBmYWN0IHRoYXQgd2UgcHJvbXB0ZWQgdGhlIHVzZXJcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFZGl0U2Vzc2lvbnNDb250cmlidXRpb24uQVBQTElDQVRJT05fTEFVTkNIRURfVklBX0NPTlRJTlVFX09OX1NUT1JBR0VfS0VZLCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdQcm9tcHRpbmcgdG8gZW5hYmxlIGNsb3VkIGNoYW5nZXMuLi4nKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5pbml0aWFsaXplKCdyZWFkJyk7XG5cdFx0XHRcdGlmICh0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLmlzU2lnbmVkSW4pIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnUHJvbXB0aW5nIHRvIGVuYWJsZSBjbG91ZCBjaGFuZ2VzIHN1Y2NlZWRlZCwgcmVzdW1pbmcgY2xvdWQgY2hhbmdlcy4uLicpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyhyZXN1bWVQcm9ncmVzc09wdGlvbnMsIGFzeW5jIChwcm9ncmVzcykgPT4gYXdhaXQgdGhpcy5yZXN1bWVFZGl0U2Vzc2lvbih1bmRlZmluZWQsIHRydWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBwcm9ncmVzcykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbmRsZVBlbmRpbmdFZGl0U2Vzc2lvbnMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICghdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5pc1NpZ25lZEluICYmXG5cdFx0XHRcdC8vIGFuZCB1c2VyIGhhcyBiZWVuIHByb21wdGVkIHRvIHNpZ24gaW4gb24gdGhpcyBtYWNoaW5lXG5cdFx0XHRcdGhhc0FwcGxpY2F0aW9uTGF1bmNoZWRGcm9tQ29udGludWVPbkZsb3cgPT09IHRydWVcblx0XHRcdCkge1xuXHRcdFx0XHRoYW5kbGVQZW5kaW5nRWRpdFNlc3Npb25zKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZygnQXV0byByZXN1bWluZyBjbG91ZCBjaGFuZ2VzIGRpc2FibGVkLicpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQWNjb3VudHNNZW51QmFkZ2UoKSB7XG5cdFx0aWYgKHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UuaXNTaWduZWRJbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuYWNjb3VudHNNZW51QmFkZ2VEaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmFkZ2UgPSBuZXcgTnVtYmVyQmFkZ2UoMSwgKCkgPT4gbG9jYWxpemUoJ2NoZWNrIGZvciBwZW5kaW5nIGNsb3VkIGNoYW5nZXMnLCAnQ2hlY2sgZm9yIHBlbmRpbmcgY2xvdWQgY2hhbmdlcycpKTtcblx0XHR0aGlzLmFjY291bnRzTWVudUJhZGdlRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMuYWN0aXZpdHlTZXJ2aWNlLnNob3dBY2NvdW50c0FjdGl2aXR5KHsgYmFkZ2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGF1dG9TdG9yZUVkaXRTZXNzaW9uKCkge1xuXHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyxcblx0XHRcdHR5cGU6ICdzeW5jaW5nJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc3RvcmUgd29ya2luZyBjaGFuZ2VzJywgJ1N0b3Jpbmcgd29ya2luZyBjaGFuZ2VzLi4uJylcblx0XHR9LCBhc3luYyAoKSA9PiB0aGlzLnN0b3JlRWRpdFNlc3Npb24oZmFsc2UsIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKSwgKCkgPT4ge1xuXHRcdFx0Y2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuY2FuY2VsKCk7XG5cdFx0XHRjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld3MoKSB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld0NvbnRhaW5lcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6IEVESVRfU0VTU0lPTlNfQ09OVEFJTkVSX0lELFxuXHRcdFx0XHR0aXRsZTogRURJVF9TRVNTSU9OU19USVRMRSxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihcblx0XHRcdFx0XHRWaWV3UGFuZUNvbnRhaW5lcixcblx0XHRcdFx0XHRbRURJVF9TRVNTSU9OU19DT05UQUlORVJfSUQsIHsgbWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiB0cnVlIH1dXG5cdFx0XHRcdCksXG5cdFx0XHRcdGljb246IEVESVRfU0VTU0lPTlNfVklFV19JQ09OLFxuXHRcdFx0XHRoaWRlSWZFbXB0eTogdHJ1ZVxuXHRcdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHsgZG9Ob3RSZWdpc3Rlck9wZW5Db21tYW5kOiB0cnVlIH1cblx0XHQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdFNlc3Npb25zRGF0YVZpZXdzLCBjb250YWluZXIpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJBY3Rpb25zKCkge1xuXHRcdHRoaXMucmVnaXN0ZXJDb250aW51ZUVkaXRTZXNzaW9uQWN0aW9uKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyUmVzdW1lTGF0ZXN0RWRpdFNlc3Npb25BY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyU3RvcmVMYXRlc3RFZGl0U2Vzc2lvbkFjdGlvbigpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckNvbnRpbnVlSW5Mb2NhbEZvbGRlckFjdGlvbigpO1xuXG5cdFx0dGhpcy5yZWdpc3RlclNob3dFZGl0U2Vzc2lvblZpZXdBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyU2hvd0VkaXRTZXNzaW9uT3V0cHV0Q2hhbm5lbEFjdGlvbigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNob3dFZGl0U2Vzc2lvbk91dHB1dENoYW5uZWxBY3Rpb24oKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNob3dFZGl0U2Vzc2lvbk91dHB1dCBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHNob3dPdXRwdXRDaGFubmVsQ29tbWFuZCk7XG5cdFx0XHR9XG5cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0Q2hhbm5lbCA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdHZvaWQgb3V0cHV0Q2hhbm5lbC5zaG93Q2hhbm5lbChlZGl0U2Vzc2lvbnNMb2dJZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNob3dFZGl0U2Vzc2lvblZpZXdBY3Rpb24oKSB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNob3dFZGl0U2Vzc2lvblZpZXcgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guZWRpdFNlc3Npb25zLmFjdGlvbnMuc2hvd0VkaXRTZXNzaW9ucycsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvdyBjbG91ZCBjaGFuZ2VzJywgJ1Nob3cgQ2xvdWQgQ2hhbmdlcycpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBFRElUX1NFU1NJT05fU1lOQ19DQVRFR09SWSxcblx0XHRcdFx0XHRmMTogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdHRoYXQuc2hvdWxkU2hvd1ZpZXdzQ29udGV4dC5zZXQodHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0YXdhaXQgdmlld3NTZXJ2aWNlLm9wZW5WaWV3KEVESVRfU0VTU0lPTlNfREFUQV9WSUVXX0lEKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQ29udGludWVFZGl0U2Vzc2lvbkFjdGlvbigpIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29udGludWVFZGl0U2Vzc2lvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKGNvbnRpbnVlV29ya2luZ09uQ29tbWFuZCk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgd29ya3NwYWNlVXJpOiBVUkkgfCB1bmRlZmluZWQsIGRlc3RpbmF0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0dHlwZSBDb250aW51ZU9uRXZlbnRPdXRjb21lID0geyBvdXRjb21lOiBzdHJpbmc7IGhhc2hlZElkPzogc3RyaW5nIH07XG5cdFx0XHRcdHR5cGUgQ29udGludWVPbkNsYXNzaWZpY2F0aW9uT3V0Y29tZSA9IHtcblx0XHRcdFx0XHRvd25lcjogJ2pveWNlZXJobCc7IGNvbW1lbnQ6ICdSZXBvcnRpbmcgdGhlIG91dGNvbWUgb2YgaW52b2tpbmcgdGhlIENvbnRpbnVlIE9uIGFjdGlvbi4nO1xuXHRcdFx0XHRcdG91dGNvbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgb3V0Y29tZSBvZiBpbnZva2luZyBjb250aW51ZSBlZGl0IHNlc3Npb24uJyB9O1xuXHRcdFx0XHRcdGhhc2hlZElkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBoYXNoIG9mIHRoZSBzdG9yZWQgZWRpdCBzZXNzaW9uIGlkLCBmb3IgY29ycmVsYXRpbmcgc3VjY2VzcyBvZiBzdG9yZXMgYW5kIHJlc3VtZXMuJyB9O1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vIEZpcnN0IGFzayB0aGUgdXNlciB0byBwaWNrIGEgZGVzdGluYXRpb24sIGlmIG5lY2Vzc2FyeVxuXHRcdFx0XHRsZXQgdXJpOiBVUkkgfCAnbm9EZXN0aW5hdGlvblVyaScgfCB1bmRlZmluZWQgPSB3b3Jrc3BhY2VVcmk7XG5cdFx0XHRcdGlmICghZGVzdGluYXRpb24gJiYgIXVyaSkge1xuXHRcdFx0XHRcdGRlc3RpbmF0aW9uID0gYXdhaXQgdGhhdC5waWNrQ29udGludWVFZGl0U2Vzc2lvbkRlc3RpbmF0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKCFkZXN0aW5hdGlvbikge1xuXHRcdFx0XHRcdFx0dGhhdC50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8Q29udGludWVPbkV2ZW50T3V0Y29tZSwgQ29udGludWVPbkNsYXNzaWZpY2F0aW9uT3V0Y29tZT4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLnBpY2sub3V0Y29tZScsIHsgb3V0Y29tZTogJ25vU2VsZWN0aW9uJyB9KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEZXRlcm1pbmUgaWYgd2UgbmVlZCB0byBzdG9yZSBhbiBlZGl0IHNlc3Npb24sIGFza2luZyBmb3IgZWRpdCBzZXNzaW9uIGF1dGggaWYgbmVjZXNzYXJ5XG5cdFx0XHRcdGNvbnN0IHNob3VsZFN0b3JlRWRpdFNlc3Npb24gPSBhd2FpdCB0aGF0LnNob3VsZENvbnRpbnVlT25XaXRoRWRpdFNlc3Npb24oKTtcblxuXHRcdFx0XHQvLyBSdW4gdGhlIHN0b3JlIGFjdGlvbiB0byBnZXQgYmFjayBhIHJlZlxuXHRcdFx0XHRsZXQgcmVmOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChzaG91bGRTdG9yZUVkaXRTZXNzaW9uKSB7XG5cdFx0XHRcdFx0dHlwZSBDb250aW51ZVdpdGhFZGl0U2Vzc2lvbkV2ZW50ID0ge307XG5cdFx0XHRcdFx0dHlwZSBDb250aW51ZVdpdGhFZGl0U2Vzc2lvbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdFx0b3duZXI6ICdqb3ljZWVyaGwnOyBjb21tZW50OiAnUmVwb3J0aW5nIHdoZW4gc3RvcmluZyBhbiBlZGl0IHNlc3Npb24gYXMgcGFydCBvZiB0aGUgQ29udGludWUgT24gZmxvdy4nO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dGhhdC50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8Q29udGludWVXaXRoRWRpdFNlc3Npb25FdmVudCwgQ29udGludWVXaXRoRWRpdFNlc3Npb25DbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLnN0b3JlJyk7XG5cblx0XHRcdFx0XHRjb25zdCBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZWYgPSBhd2FpdCB0aGF0LnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRcdFx0XHRcdGNhbmNlbGxhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3luY2luZycsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc3RvcmUgeW91ciB3b3JraW5nIGNoYW5nZXMnLCAnU3RvcmluZyB5b3VyIHdvcmtpbmcgY2hhbmdlcy4uLicpXG5cdFx0XHRcdFx0XHR9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoYXQuc3RvcmVFZGl0U2Vzc2lvbihmYWxzZSwgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4pO1xuXHRcdFx0XHRcdFx0XHRpZiAocmVmICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxDb250aW51ZU9uRXZlbnRPdXRjb21lLCBDb250aW51ZU9uQ2xhc3NpZmljYXRpb25PdXRjb21lPignY29udGludWVPbi5lZGl0U2Vzc2lvbnMuc3RvcmUub3V0Y29tZScsIHsgb3V0Y29tZTogJ3N0b3JlU3VjY2VlZGVkJywgaGFzaGVkSWQ6IGhhc2hlZEVkaXRTZXNzaW9uSWQocmVmKSB9KTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxDb250aW51ZU9uRXZlbnRPdXRjb21lLCBDb250aW51ZU9uQ2xhc3NpZmljYXRpb25PdXRjb21lPignY29udGludWVPbi5lZGl0U2Vzc2lvbnMuc3RvcmUub3V0Y29tZScsIHsgb3V0Y29tZTogJ3N0b3JlU2tpcHBlZCcgfSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlZjtcblx0XHRcdFx0XHRcdH0sICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHRcdGNhbmNlbGxhdGlvblRva2VuU291cmNlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0dGhhdC50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8Q29udGludWVPbkV2ZW50T3V0Y29tZSwgQ29udGludWVPbkNsYXNzaWZpY2F0aW9uT3V0Y29tZT4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLnN0b3JlLm91dGNvbWUnLCB7IG91dGNvbWU6ICdzdG9yZUNhbmNlbGxlZEJ5VXNlcicgfSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0XHRcdFx0dGhhdC50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8Q29udGludWVPbkV2ZW50T3V0Y29tZSwgQ29udGludWVPbkNsYXNzaWZpY2F0aW9uT3V0Y29tZT4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLnN0b3JlLm91dGNvbWUnLCB7IG91dGNvbWU6ICdzdG9yZUZhaWxlZCcgfSk7XG5cdFx0XHRcdFx0XHR0aHJvdyBleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBcHBlbmQgdGhlIHJlZiB0byB0aGUgVVJJXG5cdFx0XHRcdHVyaSA9IGRlc3RpbmF0aW9uID8gYXdhaXQgdGhhdC5yZXNvbHZlRGVzdGluYXRpb24oZGVzdGluYXRpb24pIDogdXJpO1xuXHRcdFx0XHRpZiAodXJpID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocmVmICE9PSB1bmRlZmluZWQgJiYgdXJpICE9PSAnbm9EZXN0aW5hdGlvblVyaScpIHtcblx0XHRcdFx0XHRjb25zdCBlbmNvZGVkUmVmID0gZW5jb2RlVVJJQ29tcG9uZW50KHJlZik7XG5cdFx0XHRcdFx0dXJpID0gdXJpLndpdGgoe1xuXHRcdFx0XHRcdFx0cXVlcnk6IHVyaS5xdWVyeS5sZW5ndGggPiAwID8gKHVyaS5xdWVyeSArIGAmJHtxdWVyeVBhcmFtTmFtZX09JHtlbmNvZGVkUmVmfSZjb250aW51ZU9uPTFgKSA6IGAke3F1ZXJ5UGFyYW1OYW1lfT0ke2VuY29kZWRSZWZ9JmNvbnRpbnVlT249MWBcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdC8vIE9wZW4gdGhlIFVSSVxuXHRcdFx0XHRcdHRoYXQubG9nU2VydmljZS5pbmZvKGBPcGVuaW5nICR7dXJpLnRvU3RyaW5nKCl9YCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhhdC5vcGVuZXJTZXJ2aWNlLm9wZW4odXJpLCB7IG9wZW5FeHRlcm5hbDogdHJ1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIGlmICghc2hvdWxkU3RvcmVFZGl0U2Vzc2lvbiAmJiB1cmkgIT09ICdub0Rlc3RpbmF0aW9uVXJpJykge1xuXHRcdFx0XHRcdC8vIE9wZW4gdGhlIFVSSSB3aXRob3V0IGFuIGVkaXQgc2Vzc2lvbiByZWZcblx0XHRcdFx0XHR0aGF0LmxvZ1NlcnZpY2UuaW5mbyhgT3BlbmluZyAke3VyaS50b1N0cmluZygpfWApO1xuXHRcdFx0XHRcdGF3YWl0IHRoYXQub3BlbmVyU2VydmljZS5vcGVuKHVyaSwgeyBvcGVuRXh0ZXJuYWw6IHRydWUgfSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmVmID09PSB1bmRlZmluZWQgJiYgc2hvdWxkU3RvcmVFZGl0U2Vzc2lvbikge1xuXHRcdFx0XHRcdHRoYXQubG9nU2VydmljZS53YXJuKGBGYWlsZWQgdG8gc3RvcmUgd29ya2luZyBjaGFuZ2VzIHdoZW4gaW52b2tpbmcgJHtjb250aW51ZVdvcmtpbmdPbkNvbW1hbmQuaWR9LmApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclJlc3VtZUxhdGVzdEVkaXRTZXNzaW9uQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZXN1bWVMYXRlc3RFZGl0U2Vzc2lvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5lZGl0U2Vzc2lvbnMuYWN0aW9ucy5yZXN1bWVMYXRlc3QnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Jlc3VtZSBsYXRlc3QgY2xvdWQgY2hhbmdlcycsICdSZXN1bWUgTGF0ZXN0IENoYW5nZXMgZnJvbSBDbG91ZCcpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBFRElUX1NFU1NJT05fU1lOQ19DQVRFR09SWSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdFNlc3Npb25JZD86IHN0cmluZywgZm9yY2VBcHBseVVucmVsYXRlZENoYW5nZT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0YXdhaXQgdGhhdC5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHsgLi4ucmVzdW1lUHJvZ3Jlc3NPcHRpb25zLCB0aXRsZTogcmVzdW1lUHJvZ3Jlc3NPcHRpb25zVGl0bGUgfSwgYXN5bmMgKCkgPT4gYXdhaXQgdGhhdC5yZXN1bWVFZGl0U2Vzc2lvbihlZGl0U2Vzc2lvbklkLCB1bmRlZmluZWQsIGZvcmNlQXBwbHlVbnJlbGF0ZWRDaGFuZ2UpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJlc3VtZUxhdGVzdEVkaXRTZXNzaW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmVkaXRTZXNzaW9ucy5hY3Rpb25zLnJlc3VtZUZyb21TZXJpYWxpemVkUGF5bG9hZCcsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVzdW1lIGNsb3VkIGNoYW5nZXMnLCAnUmVzdW1lIENoYW5nZXMgZnJvbSBTZXJpYWxpemVkIERhdGEnKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogJ0RldmVsb3BlcicsXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRTZXNzaW9uSWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoYXQucXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoeyBwcm9tcHQ6ICdFbnRlciBzZXJpYWxpemVkIGRhdGEnIH0pO1xuXHRcdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRcdHRoYXQuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UubGFzdFJlYWRSZXNvdXJjZXMuc2V0KCdlZGl0U2Vzc2lvbnMnLCB7IGNvbnRlbnQ6IGRhdGEsIHJlZjogJycgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgdGhhdC5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHsgLi4ucmVzdW1lUHJvZ3Jlc3NPcHRpb25zLCB0aXRsZTogcmVzdW1lUHJvZ3Jlc3NPcHRpb25zVGl0bGUgfSwgYXN5bmMgKCkgPT4gYXdhaXQgdGhhdC5yZXN1bWVFZGl0U2Vzc2lvbihlZGl0U2Vzc2lvbklkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGRhdGEpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU3RvcmVMYXRlc3RFZGl0U2Vzc2lvbkFjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgU3RvcmVMYXRlc3RFZGl0U2Vzc2lvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5lZGl0U2Vzc2lvbnMuYWN0aW9ucy5zdG9yZUN1cnJlbnQnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3N0b3JlIHdvcmtpbmcgY2hhbmdlcyBpbiBjbG91ZCcsICdTdG9yZSBXb3JraW5nIENoYW5nZXMgaW4gQ2xvdWQnKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogRURJVF9TRVNTSU9OX1NZTkNfQ0FURUdPUlksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdFx0YXdhaXQgdGhhdC5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzdG9yaW5nIHdvcmtpbmcgY2hhbmdlcycsICdTdG9yaW5nIHdvcmtpbmcgY2hhbmdlcy4uLicpXG5cdFx0XHRcdH0sIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0eXBlIFN0b3JlRXZlbnQgPSB7fTtcblx0XHRcdFx0XHR0eXBlIFN0b3JlQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0XHRvd25lcjogJ2pveWNlZXJobCc7IGNvbW1lbnQ6ICdSZXBvcnRpbmcgd2hlbiB0aGUgc3RvcmUgZWRpdCBzZXNzaW9uIGFjdGlvbiBpcyBpbnZva2VkLic7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGF0LnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTdG9yZUV2ZW50LCBTdG9yZUNsYXNzaWZpY2F0aW9uPignZWRpdFNlc3Npb25zLnN0b3JlJyk7XG5cblx0XHRcdFx0XHRhd2FpdCB0aGF0LnN0b3JlRWRpdFNlc3Npb24odHJ1ZSwgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4pO1xuXHRcdFx0XHR9LCAoKSA9PiB7XG5cdFx0XHRcdFx0Y2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuY2FuY2VsKCk7XG5cdFx0XHRcdFx0Y2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuZGlzcG9zZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyByZXN1bWVFZGl0U2Vzc2lvbihyZWY/OiBzdHJpbmcsIHNpbGVudD86IGJvb2xlYW4sIGZvcmNlQXBwbHlVbnJlbGF0ZWRDaGFuZ2U/OiBib29sZWFuLCBhcHBseVBhcnRpYWxNYXRjaD86IGJvb2xlYW4sIHByb2dyZXNzPzogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+LCBzZXJpYWxpemVkRGF0YT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFdhaXQgZm9yIHRoZSByZW1vdGUgZW52aXJvbm1lbnQgdG8gYmVjb21lIGF2YWlsYWJsZSwgaWYgYW55XG5cdFx0YXdhaXQgdGhpcy5yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKTtcblxuXHRcdC8vIEVkaXQgc2Vzc2lvbnMgYXJlIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkIGluIGVtcHR5IHdvcmtzcGFjZXNcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTU5MjIwXG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhyZWYgIT09IHVuZGVmaW5lZCA/IGBSZXN1bWluZyBjaGFuZ2VzIGZyb20gY2xvdWQgd2l0aCByZWYgJHtyZWZ9Li4uYCA6ICdDaGVja2luZyBmb3IgcGVuZGluZyBjbG91ZCBjaGFuZ2VzLi4uJyk7XG5cblx0XHRpZiAoc2lsZW50ICYmICEoYXdhaXQgdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5pbml0aWFsaXplKCdyZWFkJywgdHJ1ZSkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHlwZSBSZXN1bWVFdmVudCA9IHsgb3V0Y29tZTogc3RyaW5nOyBoYXNoZWRJZD86IHN0cmluZyB9O1xuXHRcdHR5cGUgUmVzdW1lQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ2pveWNlZXJobCc7IGNvbW1lbnQ6ICdSZXBvcnRpbmcgd2hlbiBhbiBlZGl0IHNlc3Npb24gaXMgcmVzdW1lZCBmcm9tIGFuIGVkaXQgc2Vzc2lvbiBpZGVudGlmaWVyLic7XG5cdFx0XHRvdXRjb21lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIG91dGNvbWUgb2YgcmVzdW1pbmcgdGhlIGVkaXQgc2Vzc2lvbi4nIH07XG5cdFx0XHRoYXNoZWRJZD86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaGFzaCBvZiB0aGUgc3RvcmVkIGVkaXQgc2Vzc2lvbiBpZCwgZm9yIGNvcnJlbGF0aW5nIHN1Y2Nlc3Mgb2Ygc3RvcmVzIGFuZCByZXN1bWVzLicgfTtcblx0XHR9O1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlc3VtZUV2ZW50LCBSZXN1bWVDbGFzc2lmaWNhdGlvbj4oJ2VkaXRTZXNzaW9ucy5yZXN1bWUnKTtcblxuXHRcdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvd2lsbFJlc3VtZUVkaXRTZXNzaW9uRnJvbUlkZW50aWZpZXInKTtcblxuXHRcdHByb2dyZXNzPy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgnY2hlY2tpbmdGb3JXb3JraW5nQ2hhbmdlcycsICdDaGVja2luZyBmb3IgcGVuZGluZyBjbG91ZCBjaGFuZ2VzLi4uJykgfSk7XG5cdFx0Y29uc3QgZGF0YSA9IHNlcmlhbGl6ZWREYXRhID8geyBjb250ZW50OiBzZXJpYWxpemVkRGF0YSwgcmVmOiAnJyB9IDogYXdhaXQgdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5yZWFkKCdlZGl0U2Vzc2lvbnMnLCByZWYpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0aWYgKHJlZiA9PT0gdW5kZWZpbmVkICYmICFzaWxlbnQpIHtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obG9jYWxpemUoJ25vIGNsb3VkIGNoYW5nZXMnLCAnVGhlcmUgYXJlIG5vIGNoYW5nZXMgdG8gcmVzdW1lIGZyb20gdGhlIGNsb3VkLicpKTtcblx0XHRcdH0gZWxzZSBpZiAocmVmICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obG9jYWxpemUoJ25vIGNsb3VkIGNoYW5nZXMgZm9yIHJlZicsICdDb3VsZCBub3QgcmVzdW1lIGNoYW5nZXMgZnJvbSB0aGUgY2xvdWQgZm9yIElEIHswfS4nLCByZWYpKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKHJlZiAhPT0gdW5kZWZpbmVkID8gYEFib3J0aW5nIHJlc3VtaW5nIGNoYW5nZXMgZnJvbSBjbG91ZCBhcyBubyBlZGl0IHNlc3Npb24gY29udGVudCBpcyBhdmFpbGFibGUgdG8gYmUgYXBwbGllZCBmcm9tIHJlZiAke3JlZn0uYCA6IGBBYm9ydGluZyByZXN1bWluZyBlZGl0IHNlc3Npb24gYXMgbm8gZWRpdCBzZXNzaW9uIGNvbnRlbnQgaXMgYXZhaWxhYmxlIHRvIGJlIGFwcGxpZWRgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwcm9ncmVzcz8ucmVwb3J0KHsgbWVzc2FnZTogcmVzdW1lUHJvZ3Jlc3NPcHRpb25zVGl0bGUgfSk7XG5cdFx0Y29uc3QgZWRpdFNlc3Npb24gPSBKU09OLnBhcnNlKGRhdGEuY29udGVudCk7XG5cdFx0cmVmID0gZGF0YS5yZWY7XG5cblx0XHRpZiAoZWRpdFNlc3Npb24udmVyc2lvbiA+IEVkaXRTZXNzaW9uU2NoZW1hVmVyc2lvbikge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGxvY2FsaXplKCdjbGllbnQgdG9vIG9sZCcsIFwiUGxlYXNlIHVwZ3JhZGUgdG8gYSBuZXdlciB2ZXJzaW9uIG9mIHswfSB0byByZXN1bWUgeW91ciB3b3JraW5nIGNoYW5nZXMgZnJvbSB0aGUgY2xvdWQuXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpKTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlc3VtZUV2ZW50LCBSZXN1bWVDbGFzc2lmaWNhdGlvbj4oJ2VkaXRTZXNzaW9ucy5yZXN1bWUub3V0Y29tZScsIHsgaGFzaGVkSWQ6IGhhc2hlZEVkaXRTZXNzaW9uSWQocmVmKSwgb3V0Y29tZTogJ2NsaWVudFVwZGF0ZU5lZWRlZCcgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgY2hhbmdlcywgY29uZmxpY3RpbmdDaGFuZ2VzIH0gPSBhd2FpdCB0aGlzLmdlbmVyYXRlQ2hhbmdlcyhlZGl0U2Vzc2lvbiwgcmVmLCBmb3JjZUFwcGx5VW5yZWxhdGVkQ2hhbmdlLCBhcHBseVBhcnRpYWxNYXRjaCk7XG5cdFx0XHRpZiAoY2hhbmdlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUT0RPQGpveWNlZXJobCBQcm92aWRlIHRoZSBvcHRpb24gdG8gZGlmZiBmaWxlcyB3aGljaCB3b3VsZCBiZSBvdmVyd3JpdHRlbiBieSBlZGl0IHNlc3Npb24gY29udGVudHNcblx0XHRcdGlmIChjb25mbGljdGluZ0NoYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHQvLyBBbGxvdyB0byBzaG93IGVkaXQgc2Vzc2lvbnNcblxuXHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdHR5cGU6IFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdFx0bWVzc2FnZTogY29uZmxpY3RpbmdDaGFuZ2VzLmxlbmd0aCA+IDEgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3Jlc3VtZSBlZGl0IHNlc3Npb24gd2FybmluZyBtYW55JywgJ1Jlc3VtaW5nIHlvdXIgd29ya2luZyBjaGFuZ2VzIGZyb20gdGhlIGNsb3VkIHdpbGwgb3ZlcndyaXRlIHRoZSBmb2xsb3dpbmcgezB9IGZpbGVzLiBEbyB5b3Ugd2FudCB0byBwcm9jZWVkPycsIGNvbmZsaWN0aW5nQ2hhbmdlcy5sZW5ndGgpIDpcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdyZXN1bWUgZWRpdCBzZXNzaW9uIHdhcm5pbmcgMScsICdSZXN1bWluZyB5b3VyIHdvcmtpbmcgY2hhbmdlcyBmcm9tIHRoZSBjbG91ZCB3aWxsIG92ZXJ3cml0ZSB7MH0uIERvIHlvdSB3YW50IHRvIHByb2NlZWQ/JywgYmFzZW5hbWUoY29uZmxpY3RpbmdDaGFuZ2VzWzBdLnVyaSkpLFxuXHRcdFx0XHRcdGRldGFpbDogY29uZmxpY3RpbmdDaGFuZ2VzLmxlbmd0aCA+IDEgPyBnZXRGaWxlTmFtZXNNZXNzYWdlKGNvbmZsaWN0aW5nQ2hhbmdlcy5tYXAoKGMpID0+IGMudXJpKSkgOiB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCB7IHVyaSwgdHlwZSwgY29udGVudHMgfSBvZiBjaGFuZ2VzKSB7XG5cdFx0XHRcdGlmICh0eXBlID09PSBDaGFuZ2VUeXBlLkFkZGl0aW9uKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodXJpLCBkZWNvZGVFZGl0U2Vzc2lvbkZpbGVDb250ZW50KGVkaXRTZXNzaW9uLnZlcnNpb24sIGNvbnRlbnRzISkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGUgPT09IENoYW5nZVR5cGUuRGVsZXRpb24gJiYgYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHModXJpKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHVyaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VTdGF0ZVN5bmNocm9uaXplcj8uYXBwbHkoKTtcblxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYERlbGV0aW5nIGVkaXQgc2Vzc2lvbiB3aXRoIHJlZiAke3JlZn0gYWZ0ZXIgc3VjY2Vzc2Z1bGx5IGFwcGx5aW5nIGl0IHRvIGN1cnJlbnQgd29ya3NwYWNlLi4uYCk7XG5cdFx0XHRhd2FpdCB0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLmRlbGV0ZSgnZWRpdFNlc3Npb25zJywgcmVmKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBEZWxldGVkIGVkaXQgc2Vzc2lvbiB3aXRoIHJlZiAke3JlZn0uYCk7XG5cblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlc3VtZUV2ZW50LCBSZXN1bWVDbGFzc2lmaWNhdGlvbj4oJ2VkaXRTZXNzaW9ucy5yZXN1bWUub3V0Y29tZScsIHsgaGFzaGVkSWQ6IGhhc2hlZEVkaXRTZXNzaW9uSWQocmVmKSwgb3V0Y29tZTogJ3Jlc3VtZVN1Y2NlZWRlZCcgfSk7XG5cdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignRmFpbGVkIHRvIHJlc3VtZSBlZGl0IHNlc3Npb24sIHJlYXNvbjogJywgKGV4IGFzIEVycm9yKS50b1N0cmluZygpKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgncmVzdW1lIGZhaWxlZCcsIFwiRmFpbGVkIHRvIHJlc3VtZSB5b3VyIHdvcmtpbmcgY2hhbmdlcyBmcm9tIHRoZSBjbG91ZC5cIikpO1xuXHRcdH1cblxuXHRcdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvZGlkUmVzdW1lRWRpdFNlc3Npb25Gcm9tSWRlbnRpZmllcicpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUNoYW5nZXMoZWRpdFNlc3Npb246IEVkaXRTZXNzaW9uLCByZWY6IHN0cmluZywgZm9yY2VBcHBseVVucmVsYXRlZENoYW5nZSA9IGZhbHNlLCBhcHBseVBhcnRpYWxNYXRjaCA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgY2hhbmdlczogKHsgdXJpOiBVUkk7IHR5cGU6IENoYW5nZVR5cGU7IGNvbnRlbnRzOiBzdHJpbmcgfCB1bmRlZmluZWQgfSlbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbmZsaWN0aW5nQ2hhbmdlcyA9IFtdO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlcnMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0Y29uc3QgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIGVkaXRTZXNzaW9uLmZvbGRlcnMpIHtcblx0XHRcdGxldCBmb2xkZXJSb290OiBJV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoZm9sZGVyLmNhbm9uaWNhbElkZW50aXR5KSB7XG5cdFx0XHRcdC8vIExvb2sgZm9yIGFuIGVkaXQgc2Vzc2lvbiBpZGVudGlmaWVyIHRoYXQgd2UgY2FuIHVzZVxuXHRcdFx0XHRmb3IgKGNvbnN0IGYgb2Ygd29ya3NwYWNlRm9sZGVycykge1xuXHRcdFx0XHRcdGNvbnN0IGlkZW50aXR5ID0gYXdhaXQgdGhpcy5lZGl0U2Vzc2lvbklkZW50aXR5U2VydmljZS5nZXRFZGl0U2Vzc2lvbklkZW50aWZpZXIoZiwgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4pO1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBNYXRjaGluZyBpZGVudGl0eSAke2lkZW50aXR5fSBhZ2FpbnN0IGVkaXQgc2Vzc2lvbiBmb2xkZXIgaWRlbnRpdHkgJHtmb2xkZXIuY2Fub25pY2FsSWRlbnRpdHl9Li4uYCk7XG5cblx0XHRcdFx0XHRpZiAoZXF1YWxzKGlkZW50aXR5LCBmb2xkZXIuY2Fub25pY2FsSWRlbnRpdHkpIHx8IGZvcmNlQXBwbHlVbnJlbGF0ZWRDaGFuZ2UpIHtcblx0XHRcdFx0XHRcdGZvbGRlclJvb3QgPSBmO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGlkZW50aXR5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gYXdhaXQgdGhpcy5lZGl0U2Vzc2lvbklkZW50aXR5U2VydmljZS5wcm92aWRlRWRpdFNlc3Npb25JZGVudGl0eU1hdGNoKGYsIGlkZW50aXR5LCBmb2xkZXIuY2Fub25pY2FsSWRlbnRpdHksIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0XHRcdFx0XHRcdGlmIChtYXRjaCA9PT0gRWRpdFNlc3Npb25JZGVudGl0eU1hdGNoLkNvbXBsZXRlKSB7XG5cdFx0XHRcdFx0XHRcdGZvbGRlclJvb3QgPSBmO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAobWF0Y2ggPT09IEVkaXRTZXNzaW9uSWRlbnRpdHlNYXRjaC5QYXJ0aWFsICYmXG5cdFx0XHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5leHBlcmltZW50YWwuY2xvdWRDaGFuZ2VzLnBhcnRpYWxNYXRjaGVzLmVuYWJsZWQnKSA9PT0gdHJ1ZVxuXHRcdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRcdGlmICghYXBwbHlQYXJ0aWFsTWF0Y2gpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBTdXJmYWNlIHBhcnRpYWxseSBtYXRjaGluZyBlZGl0IHNlc3Npb25cblx0XHRcdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRcdFx0XHRcdFx0U2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdlZGl0U2Vzc2lvblBhcnRpYWxNYXRjaCcsICdZb3UgaGF2ZSBwZW5kaW5nIHdvcmtpbmcgY2hhbmdlcyBpbiB0aGUgY2xvdWQgZm9yIHRoaXMgd29ya3NwYWNlLiBXb3VsZCB5b3UgbGlrZSB0byByZXN1bWUgdGhlbT8nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFt7IGxhYmVsOiBsb2NhbGl6ZSgncmVzdW1lJywgJ1Jlc3VtZScpLCBydW46ICgpID0+IHRoaXMucmVzdW1lRWRpdFNlc3Npb24ocmVmLCBmYWxzZSwgdW5kZWZpbmVkLCB0cnVlKSB9XVxuXHRcdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Zm9sZGVyUm9vdCA9IGY7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvbGRlclJvb3QgPSB3b3Jrc3BhY2VGb2xkZXJzLmZpbmQoKGYpID0+IGYubmFtZSA9PT0gZm9sZGVyLm5hbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWZvbGRlclJvb3QpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFNraXBwaW5nIGFwcGx5aW5nICR7Zm9sZGVyLndvcmtpbmdDaGFuZ2VzLmxlbmd0aH0gY2hhbmdlcyBmcm9tIGVkaXQgc2Vzc2lvbiB3aXRoIHJlZiAke3JlZn0gYXMgbm8gbWF0Y2hpbmcgd29ya3NwYWNlIGZvbGRlciB3YXMgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybiB7IGNoYW5nZXM6IFtdLCBjb25mbGljdGluZ0NoYW5nZXM6IFtdLCBjb250cmlidXRlZFN0YXRlSGFuZGxlcnM6IFtdIH07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxvY2FsQ2hhbmdlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0Zm9yIChjb25zdCByZXBvc2l0b3J5IG9mIHRoaXMuc2NtU2VydmljZS5yZXBvc2l0b3JpZXMpIHtcblx0XHRcdFx0aWYgKHJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaSAhPT0gdW5kZWZpbmVkICYmXG5cdFx0XHRcdFx0dGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIocmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpKT8ubmFtZSA9PT0gZm9sZGVyLm5hbWVcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVwb3NpdG9yeUNoYW5nZXMgPSB0aGlzLmdldENoYW5nZWRSZXNvdXJjZXMocmVwb3NpdG9yeSk7XG5cdFx0XHRcdFx0cmVwb3NpdG9yeUNoYW5nZXMuZm9yRWFjaCgoY2hhbmdlKSA9PiBsb2NhbENoYW5nZXMuYWRkKGNoYW5nZS50b1N0cmluZygpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgZm9sZGVyLndvcmtpbmdDaGFuZ2VzKSB7XG5cdFx0XHRcdGNvbnN0IHVyaSA9IGpvaW5QYXRoKGZvbGRlclJvb3QudXJpLCBjaGFuZ2UucmVsYXRpdmVGaWxlUGF0aCk7XG5cblx0XHRcdFx0Y2hhbmdlcy5wdXNoKHsgdXJpLCB0eXBlOiBjaGFuZ2UudHlwZSwgY29udGVudHM6IGNoYW5nZS5jb250ZW50cyB9KTtcblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMud2lsbENoYW5nZUxvY2FsQ29udGVudHMobG9jYWxDaGFuZ2VzLCB1cmksIGNoYW5nZSkpIHtcblx0XHRcdFx0XHRjb25mbGljdGluZ0NoYW5nZXMucHVzaCh7IHVyaSwgdHlwZTogY2hhbmdlLnR5cGUsIGNvbnRlbnRzOiBjaGFuZ2UuY29udGVudHMgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBjaGFuZ2VzLCBjb25mbGljdGluZ0NoYW5nZXMgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2lsbENoYW5nZUxvY2FsQ29udGVudHMobG9jYWxDaGFuZ2VzOiBTZXQ8c3RyaW5nPiwgdXJpV2l0aEluY29taW5nQ2hhbmdlczogVVJJLCBpbmNvbWluZ0NoYW5nZTogQ2hhbmdlKSB7XG5cdFx0aWYgKCFsb2NhbENoYW5nZXMuaGFzKHVyaVdpdGhJbmNvbWluZ0NoYW5nZXMudG9TdHJpbmcoKSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB7IGNvbnRlbnRzLCB0eXBlIH0gPSBpbmNvbWluZ0NoYW5nZTtcblxuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSAoQ2hhbmdlVHlwZS5BZGRpdGlvbik6IHtcblx0XHRcdFx0Y29uc3QgW29yaWdpbmFsQ29udGVudHMsIGluY29taW5nQ29udGVudHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdGhhc2hBc3luYyhjb250ZW50cyksXG5cdFx0XHRcdFx0aGFzaEFzeW5jKGVuY29kZUJhc2U2NCgoYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh1cmlXaXRoSW5jb21pbmdDaGFuZ2VzKSkudmFsdWUpKVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsQ29udGVudHMgIT09IGluY29taW5nQ29udGVudHM7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIChDaGFuZ2VUeXBlLkRlbGV0aW9uKToge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHModXJpV2l0aEluY29taW5nQ2hhbmdlcyk7XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuaGFuZGxlZCBjaGFuZ2UgdHlwZS4nKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzdG9yZUVkaXRTZXNzaW9uKGZyb21TdG9yZUNvbW1hbmQ6IGJvb2xlYW4sIGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZm9sZGVyczogRm9sZGVyW10gPSBbXTtcblx0XHRsZXQgZWRpdFNlc3Npb25TaXplID0gMDtcblx0XHRsZXQgaGFzRWRpdHMgPSBmYWxzZTtcblxuXHRcdC8vIFNhdmUgYWxsIHNhdmVhYmxlIGVkaXRvcnMgYmVmb3JlIGJ1aWxkaW5nIGVkaXQgc2Vzc2lvbiBjb250ZW50c1xuXHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5zYXZlQWxsKCk7XG5cblx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgdGhpcy5zY21TZXJ2aWNlLnJlcG9zaXRvcmllcykge1xuXHRcdFx0Ly8gTG9vayB0aHJvdWdoIGFsbCByZXNvdXJjZSBncm91cHMgYW5kIGNvbXB1dGUgd2hpY2ggZmlsZXMgd2VyZSBhZGRlZC9tb2RpZmllZC9kZWxldGVkXG5cdFx0XHRjb25zdCB0cmFja2VkVXJpcyA9IHRoaXMuZ2V0Q2hhbmdlZFJlc291cmNlcyhyZXBvc2l0b3J5KTsgLy8gQSBVUkkgbWlnaHQgYXBwZWFyIGluIG1vcmUgdGhhbiBvbmUgcmVzb3VyY2UgZ3JvdXBcblxuXHRcdFx0Y29uc3Qgd29ya2luZ0NoYW5nZXM6IENoYW5nZVtdID0gW107XG5cblx0XHRcdGNvbnN0IHsgcm9vdFVyaSB9ID0gcmVwb3NpdG9yeS5wcm92aWRlcjtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHJvb3RVcmkgPyB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihyb290VXJpKSA6IHVuZGVmaW5lZDtcblx0XHRcdGxldCBuYW1lID0gd29ya3NwYWNlRm9sZGVyPy5uYW1lO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiB0cmFja2VkVXJpcykge1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcih1cmkpO1xuXHRcdFx0XHRpZiAoIXdvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBTa2lwcGluZyB3b3JraW5nIGNoYW5nZSAke3VyaS50b1N0cmluZygpfSBhcyBubyBhc3NvY2lhdGVkIHdvcmtzcGFjZSBmb2xkZXIgd2FzIGZvdW5kLmApO1xuXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCB0aGlzLmVkaXRTZXNzaW9uSWRlbnRpdHlTZXJ2aWNlLm9uV2lsbENyZWF0ZUVkaXRTZXNzaW9uSWRlbnRpdHkod29ya3NwYWNlRm9sZGVyLCBjYW5jZWxsYXRpb25Ub2tlbik7XG5cblx0XHRcdFx0bmFtZSA9IG5hbWUgPz8gd29ya3NwYWNlRm9sZGVyLm5hbWU7XG5cdFx0XHRcdGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSByZWxhdGl2ZVBhdGgod29ya3NwYWNlRm9sZGVyLnVyaSwgdXJpKSA/PyB1cmkucGF0aDtcblxuXHRcdFx0XHQvLyBPbmx5IGRlYWwgd2l0aCBmaWxlIGNvbnRlbnRzIGZvciBub3dcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoIShhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQodXJpKSkuaXNGaWxlKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggeyB9XG5cblx0XHRcdFx0aGFzRWRpdHMgPSB0cnVlO1xuXG5cblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHVyaSkpIHtcblx0XHRcdFx0XHRjb25zdCBjb250ZW50cyA9IGVuY29kZUJhc2U2NCgoYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh1cmkpKS52YWx1ZSk7XG5cdFx0XHRcdFx0ZWRpdFNlc3Npb25TaXplICs9IGNvbnRlbnRzLmxlbmd0aDtcblx0XHRcdFx0XHRpZiAoZWRpdFNlc3Npb25TaXplID4gdGhpcy5lZGl0U2Vzc2lvbnNTdG9yYWdlU2VydmljZS5TSVpFX0xJTUlUKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ3BheWxvYWQgdG9vIGxhcmdlJywgJ1lvdXIgd29ya2luZyBjaGFuZ2VzIGV4Y2VlZCB0aGUgc2l6ZSBsaW1pdCBhbmQgY2Fubm90IGJlIHN0b3JlZC4nKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHdvcmtpbmdDaGFuZ2VzLnB1c2goeyB0eXBlOiBDaGFuZ2VUeXBlLkFkZGl0aW9uLCBmaWxlVHlwZTogRmlsZVR5cGUuRmlsZSwgY29udGVudHM6IGNvbnRlbnRzLCByZWxhdGl2ZUZpbGVQYXRoOiByZWxhdGl2ZUZpbGVQYXRoIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIEFzc3VtZSBpdCdzIGEgZGVsZXRpb25cblx0XHRcdFx0XHR3b3JraW5nQ2hhbmdlcy5wdXNoKHsgdHlwZTogQ2hhbmdlVHlwZS5EZWxldGlvbiwgZmlsZVR5cGU6IEZpbGVUeXBlLkZpbGUsIGNvbnRlbnRzOiB1bmRlZmluZWQsIHJlbGF0aXZlRmlsZVBhdGg6IHJlbGF0aXZlRmlsZVBhdGggfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IGNhbm9uaWNhbElkZW50aXR5ID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHdvcmtzcGFjZUZvbGRlciAhPT0gbnVsbCAmJiB3b3Jrc3BhY2VGb2xkZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjYW5vbmljYWxJZGVudGl0eSA9IGF3YWl0IHRoaXMuZWRpdFNlc3Npb25JZGVudGl0eVNlcnZpY2UuZ2V0RWRpdFNlc3Npb25JZGVudGlmaWVyKHdvcmtzcGFjZUZvbGRlciwgY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUT0RPQGpveWNlZXJobCBkZWJ0OiBkb24ndCBzdG9yZSB3b3JraW5nIGNoYW5nZXMgYXMgYSBjaGlsZCBvZiB0aGUgZm9sZGVyXG5cdFx0XHRmb2xkZXJzLnB1c2goeyB3b3JraW5nQ2hhbmdlcywgbmFtZTogbmFtZSA/PyAnJywgY2Fub25pY2FsSWRlbnRpdHk6IGNhbm9uaWNhbElkZW50aXR5ID8/IHVuZGVmaW5lZCwgYWJzb2x1dGVVcmk6IHdvcmtzcGFjZUZvbGRlcj8udXJpLnRvU3RyaW5nKCkgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RvcmUgY29udHJpYnV0ZWQgd29ya3NwYWNlIHN0YXRlXG5cdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VTdGF0ZVN5bmNocm9uaXplcj8uc3luYygpO1xuXG5cdFx0aWYgKCFoYXNFZGl0cykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1NraXBwZWQgc3RvcmluZyB3b3JraW5nIGNoYW5nZXMgaW4gdGhlIGNsb3VkIGFzIHRoZXJlIGFyZSBubyBlZGl0cyB0byBzdG9yZS4nKTtcblx0XHRcdGlmIChmcm9tU3RvcmVDb21tYW5kKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5pbmZvKGxvY2FsaXplKCdubyB3b3JraW5nIGNoYW5nZXMgdG8gc3RvcmUnLCAnU2tpcHBlZCBzdG9yaW5nIHdvcmtpbmcgY2hhbmdlcyBpbiB0aGUgY2xvdWQgYXMgdGhlcmUgYXJlIG5vIGVkaXRzIHRvIHN0b3JlLicpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YTogRWRpdFNlc3Npb24gPSB7IGZvbGRlcnMsIHZlcnNpb246IDIsIHdvcmtzcGFjZVN0YXRlSWQ6IHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UubGFzdFdyaXR0ZW5SZXNvdXJjZXMuZ2V0KCd3b3Jrc3BhY2VTdGF0ZScpPy5yZWYgfTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgU3RvcmluZyBlZGl0IHNlc3Npb24uLi5gKTtcblx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2Uud3JpdGUoJ2VkaXRTZXNzaW9ucycsIGRhdGEpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFN0b3JlZCBlZGl0IHNlc3Npb24gd2l0aCByZWYgJHtyZWZ9LmApO1xuXHRcdFx0cmV0dXJuIHJlZjtcblx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBGYWlsZWQgdG8gc3RvcmUgZWRpdCBzZXNzaW9uLCByZWFzb246IGAsIChleCBhcyBFcnJvcikudG9TdHJpbmcoKSk7XG5cblx0XHRcdHR5cGUgVXBsb2FkRmFpbGVkRXZlbnQgPSB7IHJlYXNvbjogc3RyaW5nIH07XG5cdFx0XHR0eXBlIFVwbG9hZEZhaWxlZENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ2pveWNlZXJobCc7IGNvbW1lbnQ6ICdSZXBvcnRpbmcgd2hlbiBDb250aW51ZSBPbiBzZXJ2ZXIgcmVxdWVzdCBmYWlscy4nO1xuXHRcdFx0XHRyZWFzb24/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHJlYXNvbiB0aGF0IHRoZSBzZXJ2ZXIgcmVxdWVzdCBmYWlsZWQuJyB9O1xuXHRcdFx0fTtcblxuXHRcdFx0aWYgKGV4IGluc3RhbmNlb2YgVXNlckRhdGFTeW5jU3RvcmVFcnJvcikge1xuXHRcdFx0XHRzd2l0Y2ggKGV4LmNvZGUpIHtcblx0XHRcdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Ub29MYXJnZTpcblx0XHRcdFx0XHRcdC8vIFVwbG9hZGluZyBhIHBheWxvYWQgY2FuIGZhaWwgZHVlIHRvIHNlcnZlciBzaXplIGxpbWl0c1xuXHRcdFx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8VXBsb2FkRmFpbGVkRXZlbnQsIFVwbG9hZEZhaWxlZENsYXNzaWZpY2F0aW9uPignZWRpdFNlc3Npb25zLnVwbG9hZC5mYWlsZWQnLCB7IHJlYXNvbjogJ1Rvb0xhcmdlJyB9KTtcblx0XHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgncGF5bG9hZCB0b28gbGFyZ2UnLCAnWW91ciB3b3JraW5nIGNoYW5nZXMgZXhjZWVkIHRoZSBzaXplIGxpbWl0IGFuZCBjYW5ub3QgYmUgc3RvcmVkLicpKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGxvYWRGYWlsZWRFdmVudCwgVXBsb2FkRmFpbGVkQ2xhc3NpZmljYXRpb24+KCdlZGl0U2Vzc2lvbnMudXBsb2FkLmZhaWxlZCcsIHsgcmVhc29uOiAndW5rbm93bicgfSk7XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ3BheWxvYWQgZmFpbGVkJywgJ1lvdXIgd29ya2luZyBjaGFuZ2VzIGNhbm5vdCBiZSBzdG9yZWQuJykpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDaGFuZ2VkUmVzb3VyY2VzKHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5KSB7XG5cdFx0cmV0dXJuIHJlcG9zaXRvcnkucHJvdmlkZXIuZ3JvdXBzLnJlZHVjZSgocmVzb3VyY2VzLCByZXNvdXJjZUdyb3VwcykgPT4ge1xuXHRcdFx0cmVzb3VyY2VHcm91cHMucmVzb3VyY2VzLmZvckVhY2goKHJlc291cmNlKSA9PiByZXNvdXJjZXMuYWRkKHJlc291cmNlLnNvdXJjZVVyaSkpO1xuXHRcdFx0cmV0dXJuIHJlc291cmNlcztcblx0XHR9LCBuZXcgU2V0PFVSST4oKSk7IC8vIEEgVVJJIG1pZ2h0IGFwcGVhciBpbiBtb3JlIHRoYW4gb25lIHJlc291cmNlIGdyb3VwXG5cdH1cblxuXHRwcml2YXRlIGhhc0VkaXRTZXNzaW9uKCkge1xuXHRcdGZvciAoY29uc3QgcmVwb3NpdG9yeSBvZiB0aGlzLnNjbVNlcnZpY2UucmVwb3NpdG9yaWVzKSB7XG5cdFx0XHRpZiAodGhpcy5nZXRDaGFuZ2VkUmVzb3VyY2VzKHJlcG9zaXRvcnkpLnNpemUgPiAwKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNob3VsZENvbnRpbnVlT25XaXRoRWRpdFNlc3Npb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHlwZSBFZGl0U2Vzc2lvbnNBdXRoQ2hlY2tFdmVudCA9IHsgb3V0Y29tZTogc3RyaW5nIH07XG5cdFx0dHlwZSBFZGl0U2Vzc2lvbnNBdXRoQ2hlY2tDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnam95Y2VlcmhsJzsgY29tbWVudDogJ1JlcG9ydGluZyB3aGV0aGVyIHdlIGNhbiBhbmQgc2hvdWxkIHN0b3JlIGVkaXQgc2Vzc2lvbiBhcyBwYXJ0IG9mIENvbnRpbnVlIE9uLic7XG5cdFx0XHRvdXRjb21lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIG91dGNvbWUgb2YgY2hlY2tpbmcgd2hldGhlciB3ZSBjYW4gc3RvcmUgYW4gZWRpdCBzZXNzaW9uIGFzIHBhcnQgb2YgdGhlIENvbnRpbnVlIE9uIGZsb3cuJyB9O1xuXHRcdH07XG5cblx0XHQvLyBJZiB0aGUgdXNlciBpcyBhbHJlYWR5IHNpZ25lZCBpbiwgd2Ugc2hvdWxkIHN0b3JlIGVkaXQgc2Vzc2lvblxuXHRcdGlmICh0aGlzLmVkaXRTZXNzaW9uc1N0b3JhZ2VTZXJ2aWNlLmlzU2lnbmVkSW4pIHtcblx0XHRcdHJldHVybiB0aGlzLmhhc0VkaXRTZXNzaW9uKCk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHVzZXIgaGFzIGJlZW4gYXNrZWQgYmVmb3JlIGFuZCBzYWlkIG5vLCBkb24ndCB1c2UgZWRpdCBzZXNzaW9uc1xuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHVzZUVkaXRTZXNzaW9uc1dpdGhDb250aW51ZU9uKSA9PT0gJ29mZicpIHtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEVkaXRTZXNzaW9uc0F1dGhDaGVja0V2ZW50LCBFZGl0U2Vzc2lvbnNBdXRoQ2hlY2tDbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLmNhblN0b3JlLm91dGNvbWUnLCB7IG91dGNvbWU6ICdkaXNhYmxlZEVkaXRTZXNzaW9uc1ZpYVNldHRpbmcnIH0pO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIFByb21wdCB0aGUgdXNlciB0byB1c2UgZWRpdCBzZXNzaW9ucyBpZiB0aGV5IGN1cnJlbnRseSBjb3VsZCBiZW5lZml0IGZyb20gdXNpbmcgaXRcblx0XHRpZiAodGhpcy5oYXNFZGl0U2Vzc2lvbigpKSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IHF1aWNrcGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxJUXVpY2tQaWNrSXRlbT4oKSk7XG5cdFx0XHRxdWlja3BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnY29udGludWUgd2l0aCBjbG91ZCBjaGFuZ2VzJywgXCJTZWxlY3Qgd2hldGhlciB0byBicmluZyB5b3VyIHdvcmtpbmcgY2hhbmdlcyB3aXRoIHlvdVwiKTtcblx0XHRcdHF1aWNrcGljay5vayA9IGZhbHNlO1xuXHRcdFx0cXVpY2twaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRcdGNvbnN0IHdpdGhDbG91ZENoYW5nZXMgPSB7IGxhYmVsOiBsb2NhbGl6ZSgnd2l0aCBjbG91ZCBjaGFuZ2VzJywgXCJZZXMsIGNvbnRpbnVlIHdpdGggbXkgd29ya2luZyBjaGFuZ2VzXCIpIH07XG5cdFx0XHRjb25zdCB3aXRob3V0Q2xvdWRDaGFuZ2VzID0geyBsYWJlbDogbG9jYWxpemUoJ3dpdGhvdXQgY2xvdWQgY2hhbmdlcycsIFwiTm8sIGNvbnRpbnVlIHdpdGhvdXQgbXkgd29ya2luZyBjaGFuZ2VzXCIpIH07XG5cdFx0XHRxdWlja3BpY2suaXRlbXMgPSBbd2l0aENsb3VkQ2hhbmdlcywgd2l0aG91dENsb3VkQ2hhbmdlc107XG5cblx0XHRcdGNvbnN0IGNvbnRpbnVlV2l0aENsb3VkQ2hhbmdlcyA9IGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRcdFx0cmVzb2x2ZShxdWlja3BpY2suc2VsZWN0ZWRJdGVtc1swXSA9PT0gd2l0aENsb3VkQ2hhbmdlcyk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0XHRyZWplY3QobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRxdWlja3BpY2suc2hvdygpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmICghY29udGludWVXaXRoQ2xvdWRDaGFuZ2VzKSB7XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEVkaXRTZXNzaW9uc0F1dGhDaGVja0V2ZW50LCBFZGl0U2Vzc2lvbnNBdXRoQ2hlY2tDbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24uZWRpdFNlc3Npb25zLmNhblN0b3JlLm91dGNvbWUnLCB7IG91dGNvbWU6ICdkaWROb3RFbmFibGVFZGl0U2Vzc2lvbnNXaGVuUHJvbXB0ZWQnIH0pO1xuXHRcdFx0XHRyZXR1cm4gY29udGludWVXaXRoQ2xvdWRDaGFuZ2VzO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbml0aWFsaXplZCA9IGF3YWl0IHRoaXMuZWRpdFNlc3Npb25zU3RvcmFnZVNlcnZpY2UuaW5pdGlhbGl6ZSgnd3JpdGUnKTtcblx0XHRcdGlmICghaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RWRpdFNlc3Npb25zQXV0aENoZWNrRXZlbnQsIEVkaXRTZXNzaW9uc0F1dGhDaGVja0NsYXNzaWZpY2F0aW9uPignY29udGludWVPbi5lZGl0U2Vzc2lvbnMuY2FuU3RvcmUub3V0Y29tZScsIHsgb3V0Y29tZTogJ2RpZE5vdEVuYWJsZUVkaXRTZXNzaW9uc1doZW5Qcm9tcHRlZCcgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5pdGlhbGl6ZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8jcmVnaW9uIENvbnRpbnVlIEVkaXQgU2Vzc2lvbiBleHRlbnNpb24gY29udHJpYnV0aW9uIHBvaW50XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbnRyaWJ1dGVkRWRpdFNlc3Npb25PcHRpb25zKCkge1xuXHRcdGNvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludC5zZXRIYW5kbGVyKGV4dGVuc2lvbnMgPT4ge1xuXHRcdFx0Y29uc3QgY29udGludWVFZGl0U2Vzc2lvbk9wdGlvbnM6IENvbnRpbnVlRWRpdFNlc3Npb25JdGVtW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdFx0aWYgKCFpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdjb250cmliRWRpdFNlc3Npb25zJykpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkoZXh0ZW5zaW9uLnZhbHVlKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgY29udHJpYnV0aW9uIG9mIGV4dGVuc2lvbi52YWx1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmQgPSBNZW51UmVnaXN0cnkuZ2V0Q29tbWFuZChjb250cmlidXRpb24uY29tbWFuZCk7XG5cdFx0XHRcdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgaWNvbiA9IGNvbW1hbmQuaWNvbjtcblx0XHRcdFx0XHRjb25zdCB0aXRsZSA9IHR5cGVvZiBjb21tYW5kLnRpdGxlID09PSAnc3RyaW5nJyA/IGNvbW1hbmQudGl0bGUgOiBjb21tYW5kLnRpdGxlLnZhbHVlO1xuXHRcdFx0XHRcdGNvbnN0IHdoZW4gPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShjb250cmlidXRpb24ud2hlbik7XG5cblx0XHRcdFx0XHRjb250aW51ZUVkaXRTZXNzaW9uT3B0aW9ucy5wdXNoKG5ldyBDb250aW51ZUVkaXRTZXNzaW9uSXRlbShcblx0XHRcdFx0XHRcdFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uKSA/IGAkKCR7aWNvbi5pZH0pICR7dGl0bGV9YCA6IHRpdGxlLFxuXHRcdFx0XHRcdFx0Y29tbWFuZC5pZCxcblx0XHRcdFx0XHRcdGNvbW1hbmQuc291cmNlPy50aXRsZSxcblx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRjb250cmlidXRpb24uZG9jdW1lbnRhdGlvblxuXHRcdFx0XHRcdCkpO1xuXG5cdFx0XHRcdFx0aWYgKGNvbnRyaWJ1dGlvbi5xdWFsaWZpZWROYW1lKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmdlbmVyYXRlU3RhbmRhbG9uZU9wdGlvbkNvbW1hbmQoY29tbWFuZC5pZCwgY29udHJpYnV0aW9uLnF1YWxpZmllZE5hbWUsIGNvbnRyaWJ1dGlvbi5jYXRlZ29yeSA/PyBjb21tYW5kLmNhdGVnb3J5LCB3aGVuLCBjb250cmlidXRpb24ucmVtb3RlR3JvdXApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5jb250aW51ZUVkaXRTZXNzaW9uT3B0aW9ucyA9IGNvbnRpbnVlRWRpdFNlc3Npb25PcHRpb25zO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZW5lcmF0ZVN0YW5kYWxvbmVPcHRpb25Db21tYW5kKGNvbW1hbmRJZDogc3RyaW5nLCBxdWFsaWZpZWROYW1lOiBzdHJpbmcsIGNhdGVnb3J5OiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nIHwgdW5kZWZpbmVkLCB3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCwgcmVtb3RlR3JvdXA6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IGNvbW1hbmQ6IElBY3Rpb24yT3B0aW9ucyA9IHtcblx0XHRcdGlkOiBgJHtjb250aW51ZVdvcmtpbmdPbkNvbW1hbmQuaWR9LiR7Y29tbWFuZElkfWAsXG5cdFx0XHR0aXRsZTogeyBvcmlnaW5hbDogcXVhbGlmaWVkTmFtZSwgdmFsdWU6IHF1YWxpZmllZE5hbWUgfSxcblx0XHRcdGNhdGVnb3J5OiB0eXBlb2YgY2F0ZWdvcnkgPT09ICdzdHJpbmcnID8geyBvcmlnaW5hbDogY2F0ZWdvcnksIHZhbHVlOiBjYXRlZ29yeSB9IDogY2F0ZWdvcnksXG5cdFx0XHRwcmVjb25kaXRpb246IHdoZW4sXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH07XG5cblx0XHRpZiAoIXRoaXMucmVnaXN0ZXJlZENvbW1hbmRzLmhhcyhjb21tYW5kLmlkKSkge1xuXHRcdFx0dGhpcy5yZWdpc3RlcmVkQ29tbWFuZHMuYWRkKGNvbW1hbmQuaWQpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgU3RhbmRhbG9uZUNvbnRpbnVlT25PcHRpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0c3VwZXIoY29tbWFuZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSkuZXhlY3V0ZUNvbW1hbmQoY29udGludWVXb3JraW5nT25Db21tYW5kLmlkLCB1bmRlZmluZWQsIGNvbW1hbmRJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0aWYgKHJlbW90ZUdyb3VwICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5TdGF0dXNCYXJSZW1vdGVJbmRpY2F0b3JNZW51LCB7XG5cdFx0XHRcdFx0Z3JvdXA6IHJlbW90ZUdyb3VwLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IGNvbW1hbmQsXG5cdFx0XHRcdFx0d2hlbjogY29tbWFuZC5wcmVjb25kaXRpb25cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbnRpbnVlSW5Mb2NhbEZvbGRlckFjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29udGludWVJbkxvY2FsRm9sZGVyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIob3BlbkxvY2FsRm9sZGVyQ29tbWFuZCk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGF3YWl0IHRoYXQuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29udGludWVFZGl0U2Vzc2lvbi5vcGVuTG9jYWxGb2xkZXIudGl0bGUudjInLCAnU2VsZWN0IGEgbG9jYWwgZm9sZGVyIHRvIGNvbnRpbnVlIHdvcmtpbmcgaW4nKSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGb2xkZXJzOiB0cnVlLFxuXHRcdFx0XHRcdGNhblNlbGVjdE1hbnk6IGZhbHNlLFxuXHRcdFx0XHRcdGNhblNlbGVjdEZpbGVzOiBmYWxzZSxcblx0XHRcdFx0XHRhdmFpbGFibGVGaWxlU3lzdGVtczogW1NjaGVtYXMuZmlsZV1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIHNlbGVjdGlvbj8ubGVuZ3RoICE9PSAxID8gdW5kZWZpbmVkIDogVVJJLmZyb20oe1xuXHRcdFx0XHRcdHNjaGVtZTogdGhhdC5wcm9kdWN0U2VydmljZS51cmxQcm90b2NvbCxcblx0XHRcdFx0XHRhdXRob3JpdHk6IFNjaGVtYXMuZmlsZSxcblx0XHRcdFx0XHRwYXRoOiBzZWxlY3Rpb25bMF0ucGF0aFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAoZ2V0VmlydHVhbFdvcmtzcGFjZUxvY2F0aW9uKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpICE9PSB1bmRlZmluZWQgJiYgaXNOYXRpdmUpIHtcblx0XHRcdHRoaXMuZ2VuZXJhdGVTdGFuZGFsb25lT3B0aW9uQ29tbWFuZChvcGVuTG9jYWxGb2xkZXJDb21tYW5kLmlkLCBsb2NhbGl6ZSgnY29udGludWVXb3JraW5nT24uZXhpc3RpbmdMb2NhbEZvbGRlcicsICdDb250aW51ZSBXb3JraW5nIGluIEV4aXN0aW5nIExvY2FsIEZvbGRlcicpLCB1bmRlZmluZWQsIG9wZW5Mb2NhbEZvbGRlckNvbW1hbmQucHJlY29uZGl0aW9uLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcGlja0NvbnRpbnVlRWRpdFNlc3Npb25EZXN0aW5hdGlvbigpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxDb250aW51ZUVkaXRTZXNzaW9uSXRlbT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbnRleHQgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkZPTERFUlxuXHRcdFx0PyB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF0ubmFtZVxuXHRcdFx0OiB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKChmb2xkZXIpID0+IGZvbGRlci5uYW1lKS5qb2luKCcsICcpO1xuXHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdjb250aW51ZUVkaXRTZXNzaW9uUGljay50aXRsZS52MicsIFwiU2VsZWN0IGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdG8gY29udGludWUgd29ya2luZyBvbiB7MH0gaW5cIiwgYCcke3dvcmtzcGFjZUNvbnRleHR9J2ApO1xuXHRcdHF1aWNrUGljay5pdGVtcyA9IHRoaXMuY3JlYXRlUGlja0l0ZW1zKCk7XG5cdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucygoKSA9PiB7XG5cdFx0XHRxdWlja1BpY2suaXRlbXMgPSB0aGlzLmNyZWF0ZVBpY2tJdGVtcygpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29tbWFuZCA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEFjY2VwdCgoZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBxdWlja1BpY2suYWN0aXZlSXRlbXNbMF0uY29tbWFuZDtcblxuXHRcdFx0XHRpZiAoc2VsZWN0aW9uID09PSBpbnN0YWxsQWRkaXRpb25hbENvbnRpbnVlT25PcHRpb25zQ29tbWFuZC5pZCkge1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChpbnN0YWxsQWRkaXRpb25hbENvbnRpbnVlT25PcHRpb25zQ29tbWFuZC5pZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzb2x2ZShzZWxlY3Rpb24pO1xuXHRcdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0cXVpY2tQaWNrLnNob3coKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLml0ZW0uZG9jdW1lbnRhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLmlzVXJpKGUuaXRlbS5kb2N1bWVudGF0aW9uKSA/IFVSSS5wYXJzZShlLml0ZW0uZG9jdW1lbnRhdGlvbikgOiBhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGUuaXRlbS5kb2N1bWVudGF0aW9uKTtcblx0XHRcdFx0XHR2b2lkIHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHVyaSwgeyBvcGVuRXh0ZXJuYWw6IHRydWUgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHF1aWNrUGljay5kaXNwb3NlKCk7XG5cblx0XHRyZXR1cm4gY29tbWFuZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZURlc3RpbmF0aW9uKGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8VVJJIHwgJ25vRGVzdGluYXRpb25VcmknIHwgdW5kZWZpbmVkPiB7XG5cdFx0dHlwZSBFdmFsdWF0ZUNvbnRpbnVlT25EZXN0aW5hdGlvbkV2ZW50ID0geyBvdXRjb21lOiBzdHJpbmc7IHNlbGVjdGlvbjogc3RyaW5nIH07XG5cdFx0dHlwZSBFdmFsdWF0ZUNvbnRpbnVlT25EZXN0aW5hdGlvbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdqb3ljZWVyaGwnOyBjb21tZW50OiAnUmVwb3J0aW5nIHRoZSBvdXRjb21lIG9mIGV2YWx1YXRpbmcgYSBzZWxlY3RlZCBDb250aW51ZSBPbiBkZXN0aW5hdGlvbiBvcHRpb24uJztcblx0XHRcdHNlbGVjdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBzZWxlY3RlZCBDb250aW51ZSBPbiBkZXN0aW5hdGlvbiBvcHRpb24uJyB9O1xuXHRcdFx0b3V0Y29tZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBvdXRjb21lIG9mIGV2YWx1YXRpbmcgdGhlIHNlbGVjdGVkIENvbnRpbnVlIE9uIGRlc3RpbmF0aW9uIG9wdGlvbi4nIH07XG5cdFx0fTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB1cmkgPSBhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmQpO1xuXG5cdFx0XHQvLyBTb21lIGNvbnRpbnVlIG9uIGNvbW1hbmRzIGRvIG5vdCByZXR1cm4gYSBVUklcblx0XHRcdC8vIHRvIHN1cHBvcnQgZXh0ZW5zaW9ucyB3aGljaCB3YW50IHRvIGJlIGluIGNvbnRyb2xcblx0XHRcdC8vIG9mIGhvdyB0aGUgZGVzdGluYXRpb24gaXMgb3BlbmVkXG5cdFx0XHRpZiAodXJpID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25FdmVudCwgRXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25DbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24ub3BlbkRlc3RpbmF0aW9uLm91dGNvbWUnLCB7IHNlbGVjdGlvbjogY29tbWFuZCwgb3V0Y29tZTogJ25vRGVzdGluYXRpb25VcmknIH0pO1xuXHRcdFx0XHRyZXR1cm4gJ25vRGVzdGluYXRpb25VcmknO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoVVJJLmlzVXJpKHVyaSkpIHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25FdmVudCwgRXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25DbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24ub3BlbkRlc3RpbmF0aW9uLm91dGNvbWUnLCB7IHNlbGVjdGlvbjogY29tbWFuZCwgb3V0Y29tZTogJ3Jlc29sdmVkVXJpJyB9KTtcblx0XHRcdFx0cmV0dXJuIHVyaTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25FdmVudCwgRXZhbHVhdGVDb250aW51ZU9uRGVzdGluYXRpb25DbGFzc2lmaWNhdGlvbj4oJ2NvbnRpbnVlT24ub3BlbkRlc3RpbmF0aW9uLm91dGNvbWUnLCB7IHNlbGVjdGlvbjogY29tbWFuZCwgb3V0Y29tZTogJ2ludmFsaWREZXN0aW5hdGlvbicgfSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRpZiAoZXggaW5zdGFuY2VvZiBDYW5jZWxsYXRpb25FcnJvcikge1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxFdmFsdWF0ZUNvbnRpbnVlT25EZXN0aW5hdGlvbkV2ZW50LCBFdmFsdWF0ZUNvbnRpbnVlT25EZXN0aW5hdGlvbkNsYXNzaWZpY2F0aW9uPignY29udGludWVPbi5vcGVuRGVzdGluYXRpb24ub3V0Y29tZScsIHsgc2VsZWN0aW9uOiBjb21tYW5kLCBvdXRjb21lOiAnY2FuY2VsbGVkJyB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEV2YWx1YXRlQ29udGludWVPbkRlc3RpbmF0aW9uRXZlbnQsIEV2YWx1YXRlQ29udGludWVPbkRlc3RpbmF0aW9uQ2xhc3NpZmljYXRpb24+KCdjb250aW51ZU9uLm9wZW5EZXN0aW5hdGlvbi5vdXRjb21lJywgeyBzZWxlY3Rpb246IGNvbW1hbmQsIG91dGNvbWU6ICd1bmtub3duRXJyb3InIH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVBpY2tJdGVtcygpOiAoQ29udGludWVFZGl0U2Vzc2lvbkl0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdIHtcblx0XHRjb25zdCBpdGVtcyA9IFsuLi50aGlzLmNvbnRpbnVlRWRpdFNlc3Npb25PcHRpb25zXS5maWx0ZXIoKG9wdGlvbikgPT4gb3B0aW9uLndoZW4gPT09IHVuZGVmaW5lZCB8fCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMob3B0aW9uLndoZW4pKTtcblxuXHRcdGlmIChnZXRWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24odGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSkgIT09IHVuZGVmaW5lZCAmJiBpc05hdGl2ZSkge1xuXHRcdFx0aXRlbXMucHVzaChuZXcgQ29udGludWVFZGl0U2Vzc2lvbkl0ZW0oXG5cdFx0XHRcdCckKGZvbGRlcikgJyArIGxvY2FsaXplKCdjb250aW51ZUVkaXRTZXNzaW9uSXRlbS5vcGVuSW5Mb2NhbEZvbGRlci52MicsICdPcGVuIGluIExvY2FsIEZvbGRlcicpLFxuXHRcdFx0XHRvcGVuTG9jYWxGb2xkZXJDb21tYW5kLmlkLFxuXHRcdFx0XHRsb2NhbGl6ZSgnY29udGludWVFZGl0U2Vzc2lvbkl0ZW0uYnVpbHRpbicsICdCdWlsdC1pbicpXG5cdFx0XHQpKTtcblx0XHR9XG5cblx0XHRjb25zdCBzb3J0ZWRJdGVtczogKENvbnRpbnVlRWRpdFNlc3Npb25JdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IGl0ZW1zLnNvcnQoKGl0ZW0xLCBpdGVtMikgPT4gaXRlbTEubGFiZWwubG9jYWxlQ29tcGFyZShpdGVtMi5sYWJlbCkpO1xuXHRcdHJldHVybiBzb3J0ZWRJdGVtcy5jb25jYXQoeyB0eXBlOiAnc2VwYXJhdG9yJyB9LCBuZXcgQ29udGludWVFZGl0U2Vzc2lvbkl0ZW0oaW5zdGFsbEFkZGl0aW9uYWxDb250aW51ZU9uT3B0aW9uc0NvbW1hbmQudGl0bGUsIGluc3RhbGxBZGRpdGlvbmFsQ29udGludWVPbk9wdGlvbnNDb21tYW5kLmlkKSk7XG5cdH1cbn1cblxuY29uc3QgaW5mb0J1dHRvbkNsYXNzID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uaW5mbyk7XG5jbGFzcyBDb250aW51ZUVkaXRTZXNzaW9uSXRlbSBpbXBsZW1lbnRzIElRdWlja1BpY2tJdGVtIHtcblx0cHVibGljIHJlYWRvbmx5IGJ1dHRvbnM6IElRdWlja0lucHV0QnV0dG9uW10gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGxhYmVsOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNvbW1hbmQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IHdoZW4/OiBDb250ZXh0S2V5RXhwcmVzc2lvbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZG9jdW1lbnRhdGlvbj86IHN0cmluZyxcblx0KSB7XG5cdFx0aWYgKGRvY3VtZW50YXRpb24gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5idXR0b25zID0gW3tcblx0XHRcdFx0aWNvbkNsYXNzOiBpbmZvQnV0dG9uQ2xhc3MsXG5cdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdsZWFybk1vcmVUb29sdGlwJywgJ0xlYXJuIE1vcmUnKSxcblx0XHRcdH1dO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSUNvbW1hbmQge1xuXHRjb21tYW5kOiBzdHJpbmc7XG5cdGdyb3VwOiBzdHJpbmc7XG5cdHdoZW46IHN0cmluZztcblx0ZG9jdW1lbnRhdGlvbj86IHN0cmluZztcblx0cXVhbGlmaWVkTmFtZT86IHN0cmluZztcblx0Y2F0ZWdvcnk/OiBzdHJpbmc7XG5cdHJlbW90ZUdyb3VwPzogc3RyaW5nO1xufVxuXG5jb25zdCBjb250aW51ZUVkaXRTZXNzaW9uRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJQ29tbWFuZFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnY29udGludWVFZGl0U2Vzc2lvbicsXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludCcsICdDb250cmlidXRlcyBvcHRpb25zIGZvciBjb250aW51aW5nIHRoZSBjdXJyZW50IGVkaXQgc2Vzc2lvbiBpbiBhIGRpZmZlcmVudCBlbnZpcm9ubWVudCcpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjb250aW51ZUVkaXRTZXNzaW9uRXh0UG9pbnQuY29tbWFuZCcsICdJZGVudGlmaWVyIG9mIHRoZSBjb21tYW5kIHRvIGV4ZWN1dGUuIFRoZSBjb21tYW5kIG11c3QgYmUgZGVjbGFyZWQgaW4gdGhlIFxcJ2NvbW1hbmRzXFwnLXNlY3Rpb24gYW5kIHJldHVybiBhIFVSSSByZXByZXNlbnRpbmcgYSBkaWZmZXJlbnQgZW52aXJvbm1lbnQgd2hlcmUgdGhlIGN1cnJlbnQgZWRpdCBzZXNzaW9uIGNhbiBiZSBjb250aW51ZWQuJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0Z3JvdXA6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludC5ncm91cCcsICdHcm91cCBpbnRvIHdoaWNoIHRoaXMgaXRlbSBiZWxvbmdzLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHF1YWxpZmllZE5hbWU6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludC5xdWFsaWZpZWROYW1lJywgJ0EgZnVsbHkgcXVhbGlmaWVkIG5hbWUgZm9yIHRoaXMgaXRlbSB3aGljaCBpcyB1c2VkIGZvciBkaXNwbGF5IGluIG1lbnVzLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjb250aW51ZUVkaXRTZXNzaW9uRXh0UG9pbnQuZGVzY3JpcHRpb24nLCBcIlRoZSB1cmwsIG9yIGEgY29tbWFuZCB0aGF0IHJldHVybnMgdGhlIHVybCwgdG8gdGhlIG9wdGlvbidzIGRvY3VtZW50YXRpb24gcGFnZS5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVtb3RlR3JvdXA6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludC5yZW1vdGVHcm91cCcsICdHcm91cCBpbnRvIHdoaWNoIHRoaXMgaXRlbSBiZWxvbmdzIGluIHRoZSByZW1vdGUgaW5kaWNhdG9yLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdoZW46IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbnRpbnVlRWRpdFNlc3Npb25FeHRQb2ludC53aGVuJywgJ0NvbmRpdGlvbiB3aGljaCBtdXN0IGJlIHRydWUgdG8gc2hvdyB0aGlzIGl0ZW0uJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHJlcXVpcmVkOiBbJ2NvbW1hbmQnXVxuXHRcdH1cblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG5jb25zdCB3b3JrYmVuY2hSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKEVkaXRTZXNzaW9uc0NvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHQuLi53b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdCdwcm9wZXJ0aWVzJzoge1xuXHRcdCd3b3JrYmVuY2guZXhwZXJpbWVudGFsLmNsb3VkQ2hhbmdlcy5hdXRvU3RvcmUnOiB7XG5cdFx0XHRlbnVtOiBbJ29uU2h1dGRvd24nLCAnb2ZmJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdhdXRvU3RvcmVXb3JraW5nQ2hhbmdlcy5vblNodXRkb3duJywgXCJBdXRvbWF0aWNhbGx5IHN0b3JlIGN1cnJlbnQgd29ya2luZyBjaGFuZ2VzIGluIHRoZSBjbG91ZCBvbiB3aW5kb3cgY2xvc2UuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnYXV0b1N0b3JlV29ya2luZ0NoYW5nZXMub2ZmJywgXCJOZXZlciBhdHRlbXB0IHRvIGF1dG9tYXRpY2FsbHkgc3RvcmUgd29ya2luZyBjaGFuZ2VzIGluIHRoZSBjbG91ZC5cIilcblx0XHRcdF0sXG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J3RhZ3MnOiBbJ2V4cGVyaW1lbnRhbCcsICd1c2VzT25saW5lU2VydmljZXMnXSxcblx0XHRcdCdkZWZhdWx0JzogJ29mZicsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhdXRvU3RvcmVXb3JraW5nQ2hhbmdlc0Rlc2NyaXB0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgc3RvcmUgYXZhaWxhYmxlIHdvcmtpbmcgY2hhbmdlcyBpbiB0aGUgY2xvdWQgZm9yIHRoZSBjdXJyZW50IHdvcmtzcGFjZS4gVGhpcyBzZXR0aW5nIGhhcyBubyBlZmZlY3QgaW4gdGhlIHdlYi5cIiksXG5cdFx0fSxcblx0XHQnd29ya2JlbmNoLmNsb3VkQ2hhbmdlcy5hdXRvUmVzdW1lJzoge1xuXHRcdFx0ZW51bTogWydvblJlbG9hZCcsICdvZmYnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ2F1dG9SZXN1bWVXb3JraW5nQ2hhbmdlcy5vblJlbG9hZCcsIFwiQXV0b21hdGljYWxseSByZXN1bWUgYXZhaWxhYmxlIHdvcmtpbmcgY2hhbmdlcyBmcm9tIHRoZSBjbG91ZCBvbiB3aW5kb3cgcmVsb2FkLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ2F1dG9SZXN1bWVXb3JraW5nQ2hhbmdlcy5vZmYnLCBcIk5ldmVyIGF0dGVtcHQgdG8gcmVzdW1lIHdvcmtpbmcgY2hhbmdlcyBmcm9tIHRoZSBjbG91ZC5cIilcblx0XHRcdF0sXG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J3RhZ3MnOiBbJ3VzZXNPbmxpbmVTZXJ2aWNlcyddLFxuXHRcdFx0J2RlZmF1bHQnOiAnb25SZWxvYWQnLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYXV0b1Jlc3VtZVdvcmtpbmdDaGFuZ2VzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgcmVzdW1lIGF2YWlsYWJsZSB3b3JraW5nIGNoYW5nZXMgc3RvcmVkIGluIHRoZSBjbG91ZCBmb3IgdGhlIGN1cnJlbnQgd29ya3NwYWNlLlwiKSxcblx0XHR9LFxuXHRcdCd3b3JrYmVuY2guY2xvdWRDaGFuZ2VzLmNvbnRpbnVlT24nOiB7XG5cdFx0XHRlbnVtOiBbJ3Byb21wdCcsICdvZmYnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ2NvbnRpbnVlT25DbG91ZENoYW5nZXMucHJvbXB0Rm9yQXV0aCcsICdQcm9tcHQgdGhlIHVzZXIgdG8gc2lnbiBpbiB0byBzdG9yZSB3b3JraW5nIGNoYW5nZXMgaW4gdGhlIGNsb3VkIHdpdGggQ29udGludWUgV29ya2luZyBPbi4nKSxcblx0XHRcdFx0bG9jYWxpemUoJ2NvbnRpbnVlT25DbG91ZENoYW5nZXMub2ZmJywgJ0RvIG5vdCBzdG9yZSB3b3JraW5nIGNoYW5nZXMgaW4gdGhlIGNsb3VkIHdpdGggQ29udGludWUgV29ya2luZyBPbiB1bmxlc3MgdGhlIHVzZXIgaGFzIGFscmVhZHkgdHVybmVkIG9uIENsb3VkIENoYW5nZXMuJylcblx0XHRcdF0sXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdHRhZ3M6IFsndXNlc09ubGluZVNlcnZpY2VzJ10sXG5cdFx0XHRkZWZhdWx0OiAncHJvbXB0Jyxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdjb250aW51ZU9uQ2xvdWRDaGFuZ2VzJywgJ0NvbnRyb2xzIHdoZXRoZXIgdG8gcHJvbXB0IHRoZSB1c2VyIHRvIHN0b3JlIHdvcmtpbmcgY2hhbmdlcyBpbiB0aGUgY2xvdWQgd2hlbiB1c2luZyBDb250aW51ZSBXb3JraW5nIE9uLicpXG5cdFx0fSxcblx0XHQnd29ya2JlbmNoLmV4cGVyaW1lbnRhbC5jbG91ZENoYW5nZXMucGFydGlhbE1hdGNoZXMuZW5hYmxlZCc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J3RhZ3MnOiBbJ2V4cGVyaW1lbnRhbCcsICd1c2VzT25saW5lU2VydmljZXMnXSxcblx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdjbG91ZENoYW5nZXNQYXJ0aWFsTWF0Y2hlc0VuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gc3VyZmFjZSBjbG91ZCBjaGFuZ2VzIHdoaWNoIHBhcnRpYWxseSBtYXRjaCB0aGUgY3VycmVudCBzZXNzaW9uLlwiKVxuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBWSxpQkFBaUIseUJBQXlCO0FBQy9ELFNBQTBDLGNBQWMsMkJBQW1EO0FBQzNHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CLGdCQUFn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
