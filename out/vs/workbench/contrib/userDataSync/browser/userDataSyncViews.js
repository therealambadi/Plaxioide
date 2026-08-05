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
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions, TreeItemCollapsibleState } from "../../../common/views.js";
import { localize, localize2 } from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { TreeView, TreeViewPane } from "../../../browser/parts/views/treeView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ALL_SYNC_RESOURCES, IUserDataSyncService, SyncStatus, IUserDataSyncEnablementService, IUserDataAutoSyncService, UserDataSyncError, UserDataSyncErrorCode, getLastSyncResourceUri, SyncResource, IUserDataSyncResourceProviderService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { registerAction2, Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { URI } from "../../../../base/common/uri.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { FolderThemeIcon } from "../../../../platform/theme/common/themeService.js";
import { fromNow } from "../../../../base/common/date.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { toAction } from "../../../../base/common/actions.js";
import { IUserDataSyncWorkbenchService, CONTEXT_SYNC_STATE, getSyncAreaLabel, CONTEXT_ACCOUNT_STATE, AccountStatus, CONTEXT_ENABLE_ACTIVITY_VIEWS, SYNC_TITLE, SYNC_CONFLICTS_VIEW_ID, CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW, CONTEXT_HAS_CONFLICTS } from "../../../services/userDataSync/common/userDataSync.js";
import { IUserDataSyncMachinesService, isWebPlatform } from "../../../../platform/userDataSync/common/userDataSyncMachines.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { basename } from "../../../../base/common/resources.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { UserDataSyncConflictsViewPane } from "./userDataSyncConflictsView.js";
let UserDataSyncDataViews = class extends Disposable {
  constructor(container, instantiationService, userDataSyncEnablementService, userDataSyncMachinesService, userDataSyncService) {
    super();
    this.instantiationService = instantiationService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataSyncMachinesService = userDataSyncMachinesService;
    this.userDataSyncService = userDataSyncService;
    this.registerViews(container);
  }
  registerViews(container) {
    this.registerConflictsView(container);
    this.registerActivityView(container, true);
    this.registerMachinesView(container);
    this.registerActivityView(container, false);
    this.registerTroubleShootView(container);
    this.registerExternalActivityView(container);
  }
  registerConflictsView(container) {
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    const viewName = localize2("conflicts", "Conflicts");
    const viewDescriptor = {
      id: SYNC_CONFLICTS_VIEW_ID,
      name: viewName,
      ctorDescriptor: new SyncDescriptor(UserDataSyncConflictsViewPane),
      when: ContextKeyExpr.and(CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW, CONTEXT_HAS_CONFLICTS),
      canToggleVisibility: false,
      canMoveView: false,
      treeView: this.instantiationService.createInstance(TreeView, SYNC_CONFLICTS_VIEW_ID, viewName.value),
      collapsed: false,
      order: 100
    };
    viewsRegistry.registerViews([viewDescriptor], container);
  }
  registerMachinesView(container) {
    const id = `workbench.views.sync.machines`;
    const name = localize2("synced machines", "Synced Machines");
    const treeView = this.instantiationService.createInstance(TreeView, id, name.value);
    const dataProvider = this.instantiationService.createInstance(UserDataSyncMachinesViewDataProvider, treeView);
    treeView.showRefreshAction = true;
    treeView.canSelectMany = true;
    treeView.dataProvider = dataProvider;
    this._register(Event.any(this.userDataSyncMachinesService.onDidChange, this.userDataSyncService.onDidResetRemote)(() => treeView.refresh()));
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    const viewDescriptor = {
      id,
      name,
      ctorDescriptor: new SyncDescriptor(TreeViewPane),
      when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_ENABLE_ACTIVITY_VIEWS),
      canToggleVisibility: true,
      canMoveView: false,
      treeView,
      collapsed: false,
      order: 300
    };
    viewsRegistry.registerViews([viewDescriptor], container);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.editMachineName`,
          title: localize("workbench.actions.sync.editMachineName", "Edit Name"),
          icon: Codicon.edit,
          menu: {
            id: MenuId.ViewItemContext,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", id)),
            group: "inline"
          }
        });
      }
      async run(accessor, handle) {
        const changed = await dataProvider.rename(handle.$treeItemHandle);
        if (changed) {
          await treeView.refresh();
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.turnOffSyncOnMachine`,
          title: localize("workbench.actions.sync.turnOffSyncOnMachine", "Turn off Settings Sync"),
          menu: {
            id: MenuId.ViewItemContext,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", id), ContextKeyExpr.equals("viewItem", "sync-machine"))
          }
        });
      }
      async run(accessor, handle, selected) {
        if (await dataProvider.disable((selected || [handle]).map((handle2) => handle2.$treeItemHandle))) {
          await treeView.refresh();
        }
      }
    }));
  }
  registerActivityView(container, remote) {
    const id = `workbench.views.sync.${remote ? "remote" : "local"}Activity`;
    const name = remote ? localize2("remote sync activity title", "Sync Activity (Remote)") : localize2("local sync activity title", "Sync Activity (Local)");
    const treeView = this.instantiationService.createInstance(TreeView, id, name.value);
    treeView.showCollapseAllAction = true;
    treeView.showRefreshAction = true;
    treeView.dataProvider = remote ? this.instantiationService.createInstance(RemoteUserDataSyncActivityViewDataProvider) : this.instantiationService.createInstance(LocalUserDataSyncActivityViewDataProvider);
    this._register(Event.any(
      this.userDataSyncEnablementService.onDidChangeResourceEnablement,
      this.userDataSyncEnablementService.onDidChangeEnablement,
      this.userDataSyncService.onDidResetLocal,
      this.userDataSyncService.onDidResetRemote
    )(() => treeView.refresh()));
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    const viewDescriptor = {
      id,
      name,
      ctorDescriptor: new SyncDescriptor(TreeViewPane),
      when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_ENABLE_ACTIVITY_VIEWS),
      canToggleVisibility: true,
      canMoveView: false,
      treeView,
      collapsed: false,
      order: remote ? 200 : 400,
      hideByDefault: !remote
    };
    viewsRegistry.registerViews([viewDescriptor], container);
    this.registerDataViewActions(id);
  }
  registerExternalActivityView(container) {
    const id = `workbench.views.sync.externalActivity`;
    const name = localize2("downloaded sync activity title", "Sync Activity (Developer)");
    const dataProvider = this.instantiationService.createInstance(ExtractedUserDataSyncActivityViewDataProvider, void 0);
    const treeView = this.instantiationService.createInstance(TreeView, id, name.value);
    treeView.showCollapseAllAction = false;
    treeView.showRefreshAction = false;
    treeView.dataProvider = dataProvider;
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    const viewDescriptor = {
      id,
      name,
      ctorDescriptor: new SyncDescriptor(TreeViewPane),
      when: CONTEXT_ENABLE_ACTIVITY_VIEWS,
      canToggleVisibility: true,
      canMoveView: false,
      treeView,
      collapsed: false,
      hideByDefault: false
    };
    viewsRegistry.registerViews([viewDescriptor], container);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.loadActivity`,
          title: localize("workbench.actions.sync.loadActivity", "Load Sync Activity"),
          icon: Codicon.cloudUpload,
          menu: {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", id),
            group: "navigation"
          }
        });
      }
      async run(accessor) {
        const fileDialogService = accessor.get(IFileDialogService);
        const result = await fileDialogService.showOpenDialog({
          title: localize("select sync activity file", "Select Sync Activity File or Folder"),
          canSelectFiles: true,
          canSelectFolders: true,
          canSelectMany: false
        });
        if (!result?.[0]) {
          return;
        }
        dataProvider.activityDataResource = result[0];
        await treeView.refresh();
      }
    }));
  }
  registerDataViewActions(viewId) {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.${viewId}.resolveResource`,
          title: localize("workbench.actions.sync.resolveResourceRef", "Show raw JSON sync data"),
          menu: {
            id: MenuId.ViewItemContext,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", viewId), ContextKeyExpr.regex("viewItem", /sync-resource-.*/i))
          }
        });
      }
      async run(accessor, handle) {
        const { resource } = JSON.parse(handle.$treeItemHandle);
        const editorService = accessor.get(IEditorService);
        await editorService.openEditor({ resource: URI.parse(resource), options: { pinned: true } });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.${viewId}.compareWithLocal`,
          title: localize("workbench.actions.sync.compareWithLocal", "Compare with Local"),
          menu: {
            id: MenuId.ViewItemContext,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", viewId), ContextKeyExpr.regex("viewItem", /sync-associatedResource-.*/i))
          }
        });
      }
      async run(accessor, handle) {
        const commandService = accessor.get(ICommandService);
        const { resource, comparableResource } = JSON.parse(handle.$treeItemHandle);
        const remoteResource = URI.parse(resource);
        const localResource = URI.parse(comparableResource);
        return commandService.executeCommand(
          API_OPEN_DIFF_EDITOR_COMMAND_ID,
          remoteResource,
          localResource,
          localize("remoteToLocalDiff", "{0} \u2194 {1}", localize({ key: "leftResourceName", comment: ["remote as in file in cloud"] }, "{0} (Remote)", basename(remoteResource)), localize({ key: "rightResourceName", comment: ["local as in file in disk"] }, "{0} (Local)", basename(localResource))),
          void 0
        );
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.sync.${viewId}.replaceCurrent`,
          title: localize("workbench.actions.sync.replaceCurrent", "Restore"),
          icon: Codicon.discard,
          menu: {
            id: MenuId.ViewItemContext,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", viewId), ContextKeyExpr.regex("viewItem", /sync-resource-.*/i), ContextKeyExpr.notEquals("viewItem", `sync-resource-${SyncResource.Profiles}`)),
            group: "inline"
          }
        });
      }
      async run(accessor, handle) {
        const dialogService = accessor.get(IDialogService);
        const userDataSyncService = accessor.get(IUserDataSyncService);
        const { syncResourceHandle, syncResource } = JSON.parse(handle.$treeItemHandle);
        const result = await dialogService.confirm({
          message: localize({ key: "confirm replace", comment: ["A confirmation message to replace current user data (settings, extensions, keybindings, snippets) with selected version"] }, "Would you like to replace your current {0} with selected?", getSyncAreaLabel(syncResource)),
          type: "info",
          title: SYNC_TITLE.value
        });
        if (result.confirmed) {
          return userDataSyncService.replace({ created: syncResourceHandle.created, uri: URI.revive(syncResourceHandle.uri) });
        }
      }
    }));
  }
  registerTroubleShootView(container) {
    const id = `workbench.views.sync.troubleshoot`;
    const name = localize2("troubleshoot", "Troubleshoot");
    const treeView = this.instantiationService.createInstance(TreeView, id, name.value);
    const dataProvider = this.instantiationService.createInstance(UserDataSyncTroubleshootViewDataProvider);
    treeView.showRefreshAction = true;
    treeView.dataProvider = dataProvider;
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    const viewDescriptor = {
      id,
      name,
      ctorDescriptor: new SyncDescriptor(TreeViewPane),
      when: CONTEXT_ENABLE_ACTIVITY_VIEWS,
      canToggleVisibility: true,
      canMoveView: false,
      treeView,
      collapsed: false,
      order: 500,
      hideByDefault: true
    };
    viewsRegistry.registerViews([viewDescriptor], container);
  }
};
UserDataSyncDataViews = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUserDataSyncEnablementService),
  __decorateParam(3, IUserDataSyncMachinesService),
  __decorateParam(4, IUserDataSyncService)
], UserDataSyncDataViews);
let UserDataSyncActivityViewDataProvider = class {
  constructor(userDataSyncService, userDataSyncResourceProviderService, userDataAutoSyncService, userDataSyncWorkbenchService, notificationService, userDataProfilesService) {
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncResourceProviderService = userDataSyncResourceProviderService;
    this.userDataAutoSyncService = userDataAutoSyncService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
    this.notificationService = notificationService;
    this.userDataProfilesService = userDataProfilesService;
    this.syncResourceHandlesByProfile = /* @__PURE__ */ new Map();
  }
  async getChildren(element) {
    try {
      if (!element) {
        return await this.getRoots();
      }
      if (element.profile || element.handle === this.userDataProfilesService.defaultProfile.id) {
        let promise = this.syncResourceHandlesByProfile.get(element.handle);
        if (!promise) {
          this.syncResourceHandlesByProfile.set(element.handle, promise = this.getSyncResourceHandles(element.profile));
        }
        return await promise;
      }
      if (element.syncResourceHandle) {
        return await this.getChildrenForSyncResourceTreeItem(element);
      }
      return [];
    } catch (error) {
      if (!(error instanceof UserDataSyncError)) {
        error = UserDataSyncError.toUserDataSyncError(error);
      }
      if (error instanceof UserDataSyncError && error.code === UserDataSyncErrorCode.IncompatibleRemoteContent) {
        this.notificationService.notify({
          severity: Severity.Error,
          message: error.message,
          actions: {
            primary: [
              toAction({
                id: "reset",
                label: localize("reset", "Reset Synced Data"),
                run: () => this.userDataSyncWorkbenchService.resetSyncedData()
              })
            ]
          }
        });
      } else {
        this.notificationService.error(error);
      }
      throw error;
    }
  }
  async getRoots() {
    this.syncResourceHandlesByProfile.clear();
    const roots = [];
    const profiles = await this.getProfiles();
    if (profiles.length) {
      const profileTreeItem = {
        handle: this.userDataProfilesService.defaultProfile.id,
        label: { label: this.userDataProfilesService.defaultProfile.name },
        collapsibleState: TreeItemCollapsibleState.Expanded
      };
      roots.push(profileTreeItem);
    } else {
      const defaultSyncResourceHandles = await this.getSyncResourceHandles();
      roots.push(...defaultSyncResourceHandles);
    }
    for (const profile of profiles) {
      const profileTreeItem = {
        handle: profile.id,
        label: { label: profile.name },
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        profile
      };
      roots.push(profileTreeItem);
    }
    return roots;
  }
  async getChildrenForSyncResourceTreeItem(element) {
    const syncResourceHandle = element.syncResourceHandle;
    const associatedResources = await this.userDataSyncResourceProviderService.getAssociatedResources(syncResourceHandle);
    const previousAssociatedResources = syncResourceHandle.previous ? await this.userDataSyncResourceProviderService.getAssociatedResources(syncResourceHandle.previous) : [];
    return associatedResources.map(({ resource, comparableResource }) => {
      const handle = JSON.stringify({ resource: resource.toString(), comparableResource: comparableResource.toString() });
      const previousResource = previousAssociatedResources.find((previous) => basename(previous.resource) === basename(resource))?.resource;
      return {
        handle,
        collapsibleState: TreeItemCollapsibleState.None,
        resourceUri: resource,
        command: previousResource ? {
          id: API_OPEN_DIFF_EDITOR_COMMAND_ID,
          title: "",
          arguments: [
            previousResource,
            resource,
            localize("sideBySideLabels", "{0} \u2194 {1}", `${basename(resource)} (${fromNow(syncResourceHandle.previous.created, true)})`, `${basename(resource)} (${fromNow(syncResourceHandle.created, true)})`),
            void 0
          ]
        } : {
          id: API_OPEN_EDITOR_COMMAND_ID,
          title: "",
          arguments: [resource, void 0, void 0]
        },
        contextValue: `sync-associatedResource-${syncResourceHandle.syncResource}`
      };
    });
  }
  async getSyncResourceHandles(profile) {
    const treeItems = [];
    const result = await Promise.all(ALL_SYNC_RESOURCES.map(async (syncResource) => {
      const resourceHandles = await this.getResourceHandles(syncResource, profile);
      return resourceHandles.map((resourceHandle, index) => ({ ...resourceHandle, syncResource, previous: resourceHandles[index + 1] }));
    }));
    const syncResourceHandles = result.flat().sort((a, b) => b.created - a.created);
    for (const syncResourceHandle of syncResourceHandles) {
      const handle = JSON.stringify({ syncResourceHandle, syncResource: syncResourceHandle.syncResource });
      treeItems.push({
        handle,
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        label: { label: getSyncAreaLabel(syncResourceHandle.syncResource) },
        description: fromNow(syncResourceHandle.created, true),
        tooltip: new Date(syncResourceHandle.created).toLocaleString(),
        themeIcon: FolderThemeIcon,
        syncResourceHandle,
        contextValue: `sync-resource-${syncResourceHandle.syncResource}`
      });
    }
    return treeItems;
  }
};
UserDataSyncActivityViewDataProvider = __decorateClass([
  __decorateParam(0, IUserDataSyncService),
  __decorateParam(1, IUserDataSyncResourceProviderService),
  __decorateParam(2, IUserDataAutoSyncService),
  __decorateParam(3, IUserDataSyncWorkbenchService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IUserDataProfilesService)
], UserDataSyncActivityViewDataProvider);
class LocalUserDataSyncActivityViewDataProvider extends UserDataSyncActivityViewDataProvider {
  getResourceHandles(syncResource, profile) {
    return this.userDataSyncResourceProviderService.getLocalSyncResourceHandles(syncResource, profile);
  }
  async getProfiles() {
    return this.userDataProfilesService.profiles.filter((p) => !p.isDefault).map((p) => ({
      id: p.id,
      collection: p.id,
      name: p.name
    }));
  }
}
let RemoteUserDataSyncActivityViewDataProvider = class extends UserDataSyncActivityViewDataProvider {
  constructor(userDataSyncService, userDataSyncResourceProviderService, userDataAutoSyncService, userDataSyncMachinesService, userDataSyncWorkbenchService, notificationService, userDataProfilesService) {
    super(userDataSyncService, userDataSyncResourceProviderService, userDataAutoSyncService, userDataSyncWorkbenchService, notificationService, userDataProfilesService);
    this.userDataSyncMachinesService = userDataSyncMachinesService;
  }
  async getChildren(element) {
    if (!element) {
      this.machinesPromise = void 0;
    }
    return super.getChildren(element);
  }
  getMachines() {
    if (this.machinesPromise === void 0) {
      this.machinesPromise = this.userDataSyncMachinesService.getMachines();
    }
    return this.machinesPromise;
  }
  getResourceHandles(syncResource, profile) {
    return this.userDataSyncResourceProviderService.getRemoteSyncResourceHandles(syncResource, profile);
  }
  getProfiles() {
    return this.userDataSyncResourceProviderService.getRemoteSyncedProfiles();
  }
  async getChildrenForSyncResourceTreeItem(element) {
    const children = await super.getChildrenForSyncResourceTreeItem(element);
    if (children.length) {
      const machineId = await this.userDataSyncResourceProviderService.getMachineId(element.syncResourceHandle);
      if (machineId) {
        const machines = await this.getMachines();
        const machine = machines.find(({ id }) => id === machineId);
        children[0].description = machine?.isCurrent ? localize({ key: "current", comment: ["Represents current machine"] }, "Current") : machine?.name;
      }
    }
    return children;
  }
};
RemoteUserDataSyncActivityViewDataProvider = __decorateClass([
  __decorateParam(0, IUserDataSyncService),
  __decorateParam(1, IUserDataSyncResourceProviderService),
  __decorateParam(2, IUserDataAutoSyncService),
  __decorateParam(3, IUserDataSyncMachinesService),
  __decorateParam(4, IUserDataSyncWorkbenchService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IUserDataProfilesService)
], RemoteUserDataSyncActivityViewDataProvider);
let ExtractedUserDataSyncActivityViewDataProvider = class extends UserDataSyncActivityViewDataProvider {
  constructor(activityDataResource, userDataSyncService, userDataSyncResourceProviderService, userDataAutoSyncService, userDataSyncWorkbenchService, notificationService, userDataProfilesService, fileService, uriIdentityService) {
    super(userDataSyncService, userDataSyncResourceProviderService, userDataAutoSyncService, userDataSyncWorkbenchService, notificationService, userDataProfilesService);
    this.activityDataResource = activityDataResource;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
  }
  async getChildren(element) {
    if (!element) {
      this.machinesPromise = void 0;
      if (!this.activityDataResource) {
        return [];
      }
      const stat = await this.fileService.resolve(this.activityDataResource);
      if (stat.isDirectory) {
        this.activityDataLocation = this.activityDataResource;
      } else {
        this.activityDataLocation = this.uriIdentityService.extUri.joinPath(this.uriIdentityService.extUri.dirname(this.activityDataResource), "remoteActivity");
        try {
          await this.fileService.del(this.activityDataLocation, { recursive: true });
        } catch (e) {
        }
        await this.userDataSyncService.extractActivityData(this.activityDataResource, this.activityDataLocation);
      }
    }
    return super.getChildren(element);
  }
  getResourceHandles(syncResource, profile) {
    return this.userDataSyncResourceProviderService.getLocalSyncResourceHandles(syncResource, profile, this.activityDataLocation);
  }
  async getProfiles() {
    return this.userDataSyncResourceProviderService.getLocalSyncedProfiles(this.activityDataLocation);
  }
  async getChildrenForSyncResourceTreeItem(element) {
    const children = await super.getChildrenForSyncResourceTreeItem(element);
    if (children.length) {
      const machineId = await this.userDataSyncResourceProviderService.getMachineId(element.syncResourceHandle);
      if (machineId) {
        const machines = await this.getMachines();
        const machine = machines.find(({ id }) => id === machineId);
        children[0].description = machine?.isCurrent ? localize({ key: "current", comment: ["Represents current machine"] }, "Current") : machine?.name;
      }
    }
    return children;
  }
  getMachines() {
    if (this.machinesPromise === void 0) {
      this.machinesPromise = this.userDataSyncResourceProviderService.getLocalSyncedMachines(this.activityDataLocation);
    }
    return this.machinesPromise;
  }
};
ExtractedUserDataSyncActivityViewDataProvider = __decorateClass([
  __decorateParam(1, IUserDataSyncService),
  __decorateParam(2, IUserDataSyncResourceProviderService),
  __decorateParam(3, IUserDataAutoSyncService),
  __decorateParam(4, IUserDataSyncWorkbenchService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IUserDataProfilesService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IUriIdentityService)
], ExtractedUserDataSyncActivityViewDataProvider);
let UserDataSyncMachinesViewDataProvider = class {
  constructor(treeView, userDataSyncMachinesService, quickInputService, notificationService, dialogService, userDataSyncWorkbenchService) {
    this.treeView = treeView;
    this.userDataSyncMachinesService = userDataSyncMachinesService;
    this.quickInputService = quickInputService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
  }
  async getChildren(element) {
    if (!element) {
      this.machinesPromise = void 0;
    }
    try {
      let machines = await this.getMachines();
      machines = machines.filter((m) => !m.disabled).sort((m1, m2) => m1.isCurrent ? -1 : 1);
      this.treeView.message = machines.length ? void 0 : localize("no machines", "No Machines");
      return machines.map(({ id, name, isCurrent, platform }) => ({
        handle: id,
        collapsibleState: TreeItemCollapsibleState.None,
        label: { label: name },
        description: isCurrent ? localize({ key: "current", comment: ["Current machine"] }, "Current") : void 0,
        themeIcon: platform && isWebPlatform(platform) ? Codicon.globe : Codicon.vm,
        contextValue: "sync-machine"
      }));
    } catch (error) {
      this.notificationService.error(error);
      return [];
    }
  }
  getMachines() {
    if (this.machinesPromise === void 0) {
      this.machinesPromise = this.userDataSyncMachinesService.getMachines();
    }
    return this.machinesPromise;
  }
  async disable(machineIds) {
    const machines = await this.getMachines();
    const machinesToDisable = machines.filter(({ id }) => machineIds.includes(id));
    if (!machinesToDisable.length) {
      throw new Error(localize("not found", "machine not found with id: {0}", machineIds.join(",")));
    }
    const result = await this.dialogService.confirm({
      type: "info",
      message: machinesToDisable.length > 1 ? localize("turn off sync on multiple machines", "Are you sure you want to turn off sync on selected machines?") : localize("turn off sync on machine", "Are you sure you want to turn off sync on {0}?", machinesToDisable[0].name),
      primaryButton: localize({ key: "turn off", comment: ["&& denotes a mnemonic"] }, "&&Turn off")
    });
    if (!result.confirmed) {
      return false;
    }
    if (machinesToDisable.some((machine) => machine.isCurrent)) {
      await this.userDataSyncWorkbenchService.turnoff(false);
    }
    const otherMachinesToDisable = machinesToDisable.filter((machine) => !machine.isCurrent).map((machine) => [machine.id, false]);
    if (otherMachinesToDisable.length) {
      await this.userDataSyncMachinesService.setEnablements(otherMachinesToDisable);
    }
    return true;
  }
  async rename(machineId) {
    const disposableStore = new DisposableStore();
    const inputBox = disposableStore.add(this.quickInputService.createInputBox());
    inputBox.placeholder = localize("placeholder", "Enter the name of the machine");
    inputBox.busy = true;
    inputBox.show();
    const machines = await this.getMachines();
    const machine = machines.find(({ id }) => id === machineId);
    const enabledMachines = machines.filter(({ disabled }) => !disabled);
    if (!machine) {
      inputBox.hide();
      disposableStore.dispose();
      throw new Error(localize("not found", "machine not found with id: {0}", machineId));
    }
    inputBox.busy = false;
    inputBox.value = machine.name;
    const validateMachineName = (machineName) => {
      machineName = machineName.trim();
      return machineName && !enabledMachines.some((m) => m.id !== machineId && m.name === machineName) ? machineName : null;
    };
    disposableStore.add(inputBox.onDidChangeValue(() => inputBox.validationMessage = validateMachineName(inputBox.value) ? "" : localize("valid message", "Machine name should be unique and not empty")));
    return new Promise((c, e) => {
      disposableStore.add(inputBox.onDidAccept(async () => {
        const machineName = validateMachineName(inputBox.value);
        disposableStore.dispose();
        if (machineName && machineName !== machine.name) {
          try {
            await this.userDataSyncMachinesService.renameMachine(machineId, machineName);
            c(true);
          } catch (error) {
            e(error);
          }
        } else {
          c(false);
        }
      }));
    });
  }
};
UserDataSyncMachinesViewDataProvider = __decorateClass([
  __decorateParam(1, IUserDataSyncMachinesService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IUserDataSyncWorkbenchService)
], UserDataSyncMachinesViewDataProvider);
let UserDataSyncTroubleshootViewDataProvider = class {
  constructor(fileService, userDataSyncWorkbenchService, environmentService, uriIdentityService) {
    this.fileService = fileService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
    this.environmentService = environmentService;
    this.uriIdentityService = uriIdentityService;
  }
  async getChildren(element) {
    if (!element) {
      return [{
        handle: "SYNC_LOGS",
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        label: { label: localize("sync logs", "Logs") },
        themeIcon: Codicon.folder
      }, {
        handle: "LAST_SYNC_STATES",
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        label: { label: localize("last sync states", "Last Synced Remotes") },
        themeIcon: Codicon.folder
      }];
    }
    if (element.handle === "LAST_SYNC_STATES") {
      return this.getLastSyncStates();
    }
    if (element.handle === "SYNC_LOGS") {
      return this.getSyncLogs();
    }
    return [];
  }
  async getLastSyncStates() {
    const result = [];
    for (const syncResource of ALL_SYNC_RESOURCES) {
      const resource = getLastSyncResourceUri(void 0, syncResource, this.environmentService, this.uriIdentityService.extUri);
      if (await this.fileService.exists(resource)) {
        result.push({
          handle: resource.toString(),
          label: { label: getSyncAreaLabel(syncResource) },
          collapsibleState: TreeItemCollapsibleState.None,
          resourceUri: resource,
          command: { id: API_OPEN_EDITOR_COMMAND_ID, title: "", arguments: [resource, void 0, void 0] }
        });
      }
    }
    return result;
  }
  async getSyncLogs() {
    const logResources = await this.userDataSyncWorkbenchService.getAllLogResources();
    const result = [];
    for (const syncLogResource of logResources) {
      const logFolder = this.uriIdentityService.extUri.dirname(syncLogResource);
      result.push({
        handle: syncLogResource.toString(),
        collapsibleState: TreeItemCollapsibleState.None,
        resourceUri: syncLogResource,
        label: { label: this.uriIdentityService.extUri.basename(logFolder) },
        description: this.uriIdentityService.extUri.isEqual(logFolder, this.environmentService.logsHome) ? localize({ key: "current", comment: ["Represents current log file"] }, "Current") : void 0,
        command: { id: API_OPEN_EDITOR_COMMAND_ID, title: "", arguments: [syncLogResource, void 0, void 0] }
      });
    }
    return result;
  }
};
UserDataSyncTroubleshootViewDataProvider = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUserDataSyncWorkbenchService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, IUriIdentityService)
], UserDataSyncTroubleshootViewDataProvider);
export {
  UserDataSyncDataViews
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVN5bmMvYnJvd3Nlci91c2VyRGF0YVN5bmNWaWV3cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElWaWV3c1JlZ2lzdHJ5LCBFeHRlbnNpb25zLCBJVHJlZVZpZXdEZXNjcmlwdG9yLCBJVHJlZVZpZXdEYXRhUHJvdmlkZXIsIElUcmVlSXRlbSwgVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLCBUcmVlVmlld0l0ZW1IYW5kbGVBcmcsIFZpZXdDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IFRyZWVWaWV3LCBUcmVlVmlld1BhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3RyZWVWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQUxMX1NZTkNfUkVTT1VSQ0VTLCBJVXNlckRhdGFTeW5jU2VydmljZSwgSVN5bmNSZXNvdXJjZUhhbmRsZSBhcyBJUmVzb3VyY2VIYW5kbGUsIFN5bmNTdGF0dXMsIElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLCBVc2VyRGF0YVN5bmNFcnJvciwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLCBnZXRMYXN0U3luY1Jlc291cmNlVXJpLCBTeW5jUmVzb3VyY2UsIElTeW5jVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFVSSSwgVXJpRHRvIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZvbGRlclRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZnJvbU5vdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGUuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UsIElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgQ09OVEVYVF9TWU5DX1NUQVRFLCBnZXRTeW5jQXJlYUxhYmVsLCBDT05URVhUX0FDQ09VTlRfU1RBVEUsIEFjY291bnRTdGF0dXMsIENPTlRFWFRfRU5BQkxFX0FDVElWSVRZX1ZJRVdTLCBTWU5DX1RJVExFLCBTWU5DX0NPTkZMSUNUU19WSUVXX0lELCBDT05URVhUX0VOQUJMRV9TWU5DX0NPTkZMSUNUU19WSUVXLCBDT05URVhUX0hBU19DT05GTElDVFMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLCBJVXNlckRhdGFTeW5jTWFjaGluZSwgaXNXZWJQbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jTWFjaGluZXMuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lELCBBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhU3luY0NvbmZsaWN0c1ZpZXdQYW5lIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNDb25mbGljdHNWaWV3LmpzJztcblxuZXhwb3J0IGNsYXNzIFVzZXJEYXRhU3luY0RhdGFWaWV3cyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZTogSVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyVmlld3MoY29udGFpbmVyKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJWaWV3cyhjb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHR0aGlzLnJlZ2lzdGVyQ29uZmxpY3RzVmlldyhjb250YWluZXIpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckFjdGl2aXR5Vmlldyhjb250YWluZXIsIHRydWUpO1xuXHRcdHRoaXMucmVnaXN0ZXJNYWNoaW5lc1ZpZXcoY29udGFpbmVyKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJBY3Rpdml0eVZpZXcoY29udGFpbmVyLCBmYWxzZSk7XG5cdFx0dGhpcy5yZWdpc3RlclRyb3VibGVTaG9vdFZpZXcoY29udGFpbmVyKTtcblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZXJuYWxBY3Rpdml0eVZpZXcoY29udGFpbmVyKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDb25mbGljdHNWaWV3KGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KTtcblx0XHRjb25zdCB2aWV3TmFtZSA9IGxvY2FsaXplMignY29uZmxpY3RzJywgXCJDb25mbGljdHNcIik7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElUcmVlVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogU1lOQ19DT05GTElDVFNfVklFV19JRCxcblx0XHRcdG5hbWU6IHZpZXdOYW1lLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihVc2VyRGF0YVN5bmNDb25mbGljdHNWaWV3UGFuZSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9FTkFCTEVfU1lOQ19DT05GTElDVFNfVklFVywgQ09OVEVYVF9IQVNfQ09ORkxJQ1RTKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IGZhbHNlLFxuXHRcdFx0Y2FuTW92ZVZpZXc6IGZhbHNlLFxuXHRcdFx0dHJlZVZpZXc6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVZpZXcsIFNZTkNfQ09ORkxJQ1RTX1ZJRVdfSUQsIHZpZXdOYW1lLnZhbHVlKSxcblx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHRvcmRlcjogMTAwLFxuXHRcdH07XG5cdFx0dmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTWFjaGluZXNWaWV3KGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IHZvaWQge1xuXHRcdGNvbnN0IGlkID0gYHdvcmtiZW5jaC52aWV3cy5zeW5jLm1hY2hpbmVzYDtcblx0XHRjb25zdCBuYW1lID0gbG9jYWxpemUyKCdzeW5jZWQgbWFjaGluZXMnLCBcIlN5bmNlZCBNYWNoaW5lc1wiKTtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVZpZXcsIGlkLCBuYW1lLnZhbHVlKTtcblx0XHRjb25zdCBkYXRhUHJvdmlkZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhU3luY01hY2hpbmVzVmlld0RhdGFQcm92aWRlciwgdHJlZVZpZXcpO1xuXHRcdHRyZWVWaWV3LnNob3dSZWZyZXNoQWN0aW9uID0gdHJ1ZTtcblx0XHR0cmVlVmlldy5jYW5TZWxlY3RNYW55ID0gdHJ1ZTtcblx0XHR0cmVlVmlldy5kYXRhUHJvdmlkZXIgPSBkYXRhUHJvdmlkZXI7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkodGhpcy51c2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2Uub25EaWRDaGFuZ2UsIHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5vbkRpZFJlc2V0UmVtb3RlKSgoKSA9PiB0cmVlVmlldy5yZWZyZXNoKCkpKTtcblx0XHRjb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElUcmVlVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZCxcblx0XHRcdG5hbWUsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFRyZWVWaWV3UGFuZSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TWU5DX1NUQVRFLm5vdEVxdWFsc1RvKFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZCksIENPTlRFWFRfQUNDT1VOVF9TVEFURS5pc0VxdWFsVG8oQWNjb3VudFN0YXR1cy5BdmFpbGFibGUpLCBDT05URVhUX0VOQUJMRV9BQ1RJVklUWV9WSUVXUyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRcdFx0Y2FuTW92ZVZpZXc6IGZhbHNlLFxuXHRcdFx0dHJlZVZpZXcsXG5cdFx0XHRjb2xsYXBzZWQ6IGZhbHNlLFxuXHRcdFx0b3JkZXI6IDMwMCxcblx0XHR9O1xuXHRcdHZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3JdLCBjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuc3luYy5lZGl0TWFjaGluZU5hbWVgLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbnMuc3luYy5lZGl0TWFjaGluZU5hbWUnLCBcIkVkaXQgTmFtZVwiKSxcblx0XHRcdFx0XHRpY29uOiBDb2RpY29uLmVkaXQsXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3SXRlbUNvbnRleHQsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgaWQpKSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaGFuZGxlOiBUcmVlVmlld0l0ZW1IYW5kbGVBcmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgY2hhbmdlZCA9IGF3YWl0IGRhdGFQcm92aWRlci5yZW5hbWUoaGFuZGxlLiR0cmVlSXRlbUhhbmRsZSk7XG5cdFx0XHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHRcdFx0YXdhaXQgdHJlZVZpZXcucmVmcmVzaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuc3luYy50dXJuT2ZmU3luY09uTWFjaGluZWAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9ucy5zeW5jLnR1cm5PZmZTeW5jT25NYWNoaW5lJywgXCJUdXJuIG9mZiBTZXR0aW5ncyBTeW5jXCIpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld0l0ZW1Db250ZXh0LFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIGlkKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3SXRlbScsICdzeW5jLW1hY2hpbmUnKSksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGhhbmRsZTogVHJlZVZpZXdJdGVtSGFuZGxlQXJnLCBzZWxlY3RlZD86IFRyZWVWaWV3SXRlbUhhbmRsZUFyZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGlmIChhd2FpdCBkYXRhUHJvdmlkZXIuZGlzYWJsZSgoc2VsZWN0ZWQgfHwgW2hhbmRsZV0pLm1hcChoYW5kbGUgPT4gaGFuZGxlLiR0cmVlSXRlbUhhbmRsZSkpKSB7XG5cdFx0XHRcdFx0YXdhaXQgdHJlZVZpZXcucmVmcmVzaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWN0aXZpdHlWaWV3KGNvbnRhaW5lcjogVmlld0NvbnRhaW5lciwgcmVtb3RlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgaWQgPSBgd29ya2JlbmNoLnZpZXdzLnN5bmMuJHtyZW1vdGUgPyAncmVtb3RlJyA6ICdsb2NhbCd9QWN0aXZpdHlgO1xuXHRcdGNvbnN0IG5hbWUgPSByZW1vdGUgPyBsb2NhbGl6ZTIoJ3JlbW90ZSBzeW5jIGFjdGl2aXR5IHRpdGxlJywgXCJTeW5jIEFjdGl2aXR5IChSZW1vdGUpXCIpIDogbG9jYWxpemUyKCdsb2NhbCBzeW5jIGFjdGl2aXR5IHRpdGxlJywgXCJTeW5jIEFjdGl2aXR5IChMb2NhbClcIik7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVWaWV3LCBpZCwgbmFtZS52YWx1ZSk7XG5cdFx0dHJlZVZpZXcuc2hvd0NvbGxhcHNlQWxsQWN0aW9uID0gdHJ1ZTtcblx0XHR0cmVlVmlldy5zaG93UmVmcmVzaEFjdGlvbiA9IHRydWU7XG5cdFx0dHJlZVZpZXcuZGF0YVByb3ZpZGVyID0gcmVtb3RlID8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZW1vdGVVc2VyRGF0YVN5bmNBY3Rpdml0eVZpZXdEYXRhUHJvdmlkZXIpXG5cdFx0XHQ6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9jYWxVc2VyRGF0YVN5bmNBY3Rpdml0eVZpZXdEYXRhUHJvdmlkZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VSZXNvdXJjZUVuYWJsZW1lbnQsXG5cdFx0XHR0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlRW5hYmxlbWVudCxcblx0XHRcdHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5vbkRpZFJlc2V0TG9jYWwsXG5cdFx0XHR0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uub25EaWRSZXNldFJlbW90ZSkoKCkgPT4gdHJlZVZpZXcucmVmcmVzaCgpKSk7XG5cdFx0Y29uc3Qgdmlld3NSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yOiBJVHJlZVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQsXG5cdFx0XHRuYW1lLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihUcmVlVmlld1BhbmUpLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU1lOQ19TVEFURS5ub3RFcXVhbHNUbyhTeW5jU3RhdHVzLlVuaW5pdGlhbGl6ZWQpLCBDT05URVhUX0FDQ09VTlRfU1RBVEUuaXNFcXVhbFRvKEFjY291bnRTdGF0dXMuQXZhaWxhYmxlKSwgQ09OVEVYVF9FTkFCTEVfQUNUSVZJVFlfVklFV1MpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdGNhbk1vdmVWaWV3OiBmYWxzZSxcblx0XHRcdHRyZWVWaWV3LFxuXHRcdFx0Y29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdG9yZGVyOiByZW1vdGUgPyAyMDAgOiA0MDAsXG5cdFx0XHRoaWRlQnlEZWZhdWx0OiAhcmVtb3RlLFxuXHRcdH07XG5cdFx0dmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRGF0YVZpZXdBY3Rpb25zKGlkKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJFeHRlcm5hbEFjdGl2aXR5Vmlldyhjb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHRjb25zdCBpZCA9IGB3b3JrYmVuY2gudmlld3Muc3luYy5leHRlcm5hbEFjdGl2aXR5YDtcblx0XHRjb25zdCBuYW1lID0gbG9jYWxpemUyKCdkb3dubG9hZGVkIHN5bmMgYWN0aXZpdHkgdGl0bGUnLCBcIlN5bmMgQWN0aXZpdHkgKERldmVsb3BlcilcIik7XG5cdFx0Y29uc3QgZGF0YVByb3ZpZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRyYWN0ZWRVc2VyRGF0YVN5bmNBY3Rpdml0eVZpZXdEYXRhUHJvdmlkZXIsIHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVWaWV3LCBpZCwgbmFtZS52YWx1ZSk7XG5cdFx0dHJlZVZpZXcuc2hvd0NvbGxhcHNlQWxsQWN0aW9uID0gZmFsc2U7XG5cdFx0dHJlZVZpZXcuc2hvd1JlZnJlc2hBY3Rpb24gPSBmYWxzZTtcblx0XHR0cmVlVmlldy5kYXRhUHJvdmlkZXIgPSBkYXRhUHJvdmlkZXI7XG5cblx0XHRjb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElUcmVlVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZCxcblx0XHRcdG5hbWUsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFRyZWVWaWV3UGFuZSksXG5cdFx0XHR3aGVuOiBDT05URVhUX0VOQUJMRV9BQ1RJVklUWV9WSUVXUyxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWUsXG5cdFx0XHRjYW5Nb3ZlVmlldzogZmFsc2UsXG5cdFx0XHR0cmVlVmlldyxcblx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHRoaWRlQnlEZWZhdWx0OiBmYWxzZSxcblx0XHR9O1xuXHRcdHZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3JdLCBjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuc3luYy5sb2FkQWN0aXZpdHlgLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbnMuc3luYy5sb2FkQWN0aXZpdHknLCBcIkxvYWQgU3luYyBBY3Rpdml0eVwiKSxcblx0XHRcdFx0XHRpY29uOiBDb2RpY29uLmNsb3VkVXBsb2FkLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgaWQpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCBmaWxlRGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBmaWxlRGlhbG9nU2VydmljZS5zaG93T3BlbkRpYWxvZyh7XG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZWxlY3Qgc3luYyBhY3Rpdml0eSBmaWxlJywgXCJTZWxlY3QgU3luYyBBY3Rpdml0eSBGaWxlIG9yIEZvbGRlclwiKSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGaWxlczogdHJ1ZSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGb2xkZXJzOiB0cnVlLFxuXHRcdFx0XHRcdGNhblNlbGVjdE1hbnk6IGZhbHNlLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFyZXN1bHQ/LlswXSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRkYXRhUHJvdmlkZXIuYWN0aXZpdHlEYXRhUmVzb3VyY2UgPSByZXN1bHRbMF07XG5cdFx0XHRcdGF3YWl0IHRyZWVWaWV3LnJlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyRGF0YVZpZXdBY3Rpb25zKHZpZXdJZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuc3luYy4ke3ZpZXdJZH0ucmVzb2x2ZVJlc291cmNlYCxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb25zLnN5bmMucmVzb2x2ZVJlc291cmNlUmVmJywgXCJTaG93IHJhdyBKU09OIHN5bmMgZGF0YVwiKSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdJdGVtQ29udGV4dCxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCB2aWV3SWQpLCBDb250ZXh0S2V5RXhwci5yZWdleCgndmlld0l0ZW0nLCAvc3luYy1yZXNvdXJjZS0uKi9pKSlcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaGFuZGxlOiBUcmVlVmlld0l0ZW1IYW5kbGVBcmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgeyByZXNvdXJjZSB9ID0gPHsgcmVzb3VyY2U6IHN0cmluZyB9PkpTT04ucGFyc2UoaGFuZGxlLiR0cmVlSXRlbUhhbmRsZSk7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogVVJJLnBhcnNlKHJlc291cmNlKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy5zeW5jLiR7dmlld0lkfS5jb21wYXJlV2l0aExvY2FsYCxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb25zLnN5bmMuY29tcGFyZVdpdGhMb2NhbCcsIFwiQ29tcGFyZSB3aXRoIExvY2FsXCIpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld0l0ZW1Db250ZXh0LFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIHZpZXdJZCksIENvbnRleHRLZXlFeHByLnJlZ2V4KCd2aWV3SXRlbScsIC9zeW5jLWFzc29jaWF0ZWRSZXNvdXJjZS0uKi9pKSlcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaGFuZGxlOiBUcmVlVmlld0l0ZW1IYW5kbGVBcmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH0gPSA8eyByZXNvdXJjZTogc3RyaW5nOyBjb21wYXJhYmxlUmVzb3VyY2U6IHN0cmluZyB9PkpTT04ucGFyc2UoaGFuZGxlLiR0cmVlSXRlbUhhbmRsZSk7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZVJlc291cmNlID0gVVJJLnBhcnNlKHJlc291cmNlKTtcblx0XHRcdFx0Y29uc3QgbG9jYWxSZXNvdXJjZSA9IFVSSS5wYXJzZShjb21wYXJhYmxlUmVzb3VyY2UpO1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQVBJX09QRU5fRElGRl9FRElUT1JfQ09NTUFORF9JRCxcblx0XHRcdFx0XHRyZW1vdGVSZXNvdXJjZSxcblx0XHRcdFx0XHRsb2NhbFJlc291cmNlLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdyZW1vdGVUb0xvY2FsRGlmZicsIFwiezB9IFx1MjE5NCB7MX1cIiwgbG9jYWxpemUoeyBrZXk6ICdsZWZ0UmVzb3VyY2VOYW1lJywgY29tbWVudDogWydyZW1vdGUgYXMgaW4gZmlsZSBpbiBjbG91ZCddIH0sIFwiezB9IChSZW1vdGUpXCIsIGJhc2VuYW1lKHJlbW90ZVJlc291cmNlKSksIGxvY2FsaXplKHsga2V5OiAncmlnaHRSZXNvdXJjZU5hbWUnLCBjb21tZW50OiBbJ2xvY2FsIGFzIGluIGZpbGUgaW4gZGlzayddIH0sIFwiezB9IChMb2NhbClcIiwgYmFzZW5hbWUobG9jYWxSZXNvdXJjZSkpKSxcblx0XHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy5zeW5jLiR7dmlld0lkfS5yZXBsYWNlQ3VycmVudGAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9ucy5zeW5jLnJlcGxhY2VDdXJyZW50JywgXCJSZXN0b3JlXCIpLFxuXHRcdFx0XHRcdGljb246IENvZGljb24uZGlzY2FyZCxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdJdGVtQ29udGV4dCxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCB2aWV3SWQpLCBDb250ZXh0S2V5RXhwci5yZWdleCgndmlld0l0ZW0nLCAvc3luYy1yZXNvdXJjZS0uKi9pKSwgQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCd2aWV3SXRlbScsIGBzeW5jLXJlc291cmNlLSR7U3luY1Jlc291cmNlLlByb2ZpbGVzfWApKSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaGFuZGxlOiBUcmVlVmlld0l0ZW1IYW5kbGVBcmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCB7IHN5bmNSZXNvdXJjZUhhbmRsZSwgc3luY1Jlc291cmNlIH0gPSA8eyBzeW5jUmVzb3VyY2VIYW5kbGU6IFVyaUR0bzxJU3luY1Jlc291cmNlSGFuZGxlPjsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UgfT5KU09OLnBhcnNlKGhhbmRsZS4kdHJlZUl0ZW1IYW5kbGUpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKHsga2V5OiAnY29uZmlybSByZXBsYWNlJywgY29tbWVudDogWydBIGNvbmZpcm1hdGlvbiBtZXNzYWdlIHRvIHJlcGxhY2UgY3VycmVudCB1c2VyIGRhdGEgKHNldHRpbmdzLCBleHRlbnNpb25zLCBrZXliaW5kaW5ncywgc25pcHBldHMpIHdpdGggc2VsZWN0ZWQgdmVyc2lvbiddIH0sIFwiV291bGQgeW91IGxpa2UgdG8gcmVwbGFjZSB5b3VyIGN1cnJlbnQgezB9IHdpdGggc2VsZWN0ZWQ/XCIsIGdldFN5bmNBcmVhTGFiZWwoc3luY1Jlc291cmNlKSksXG5cdFx0XHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0XHRcdHRpdGxlOiBTWU5DX1RJVExFLnZhbHVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAocmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdHJldHVybiB1c2VyRGF0YVN5bmNTZXJ2aWNlLnJlcGxhY2UoeyBjcmVhdGVkOiBzeW5jUmVzb3VyY2VIYW5kbGUuY3JlYXRlZCwgdXJpOiBVUkkucmV2aXZlKHN5bmNSZXNvdXJjZUhhbmRsZS51cmkpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVHJvdWJsZVNob290Vmlldyhjb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHRjb25zdCBpZCA9IGB3b3JrYmVuY2gudmlld3Muc3luYy50cm91Ymxlc2hvb3RgO1xuXHRcdGNvbnN0IG5hbWUgPSBsb2NhbGl6ZTIoJ3Ryb3VibGVzaG9vdCcsIFwiVHJvdWJsZXNob290XCIpO1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUcmVlVmlldywgaWQsIG5hbWUudmFsdWUpO1xuXHRcdGNvbnN0IGRhdGFQcm92aWRlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jVHJvdWJsZXNob290Vmlld0RhdGFQcm92aWRlcik7XG5cdFx0dHJlZVZpZXcuc2hvd1JlZnJlc2hBY3Rpb24gPSB0cnVlO1xuXHRcdHRyZWVWaWV3LmRhdGFQcm92aWRlciA9IGRhdGFQcm92aWRlcjtcblxuXHRcdGNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSVRyZWVWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkLFxuXHRcdFx0bmFtZSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVHJlZVZpZXdQYW5lKSxcblx0XHRcdHdoZW46IENPTlRFWFRfRU5BQkxFX0FDVElWSVRZX1ZJRVdTLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdGNhbk1vdmVWaWV3OiBmYWxzZSxcblx0XHRcdHRyZWVWaWV3LFxuXHRcdFx0Y29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdG9yZGVyOiA1MDAsXG5cdFx0XHRoaWRlQnlEZWZhdWx0OiB0cnVlXG5cdFx0fTtcblx0XHR2aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHR9XG5cbn1cblxudHlwZSBQcm9maWxlID0gSVVzZXJEYXRhUHJvZmlsZSB8IElTeW5jVXNlckRhdGFQcm9maWxlO1xuXG5pbnRlcmZhY2UgSVN5bmNSZXNvdXJjZUhhbmRsZSBleHRlbmRzIElSZXNvdXJjZUhhbmRsZSB7XG5cdHByb2ZpbGVJZD86IHN0cmluZztcblx0c3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2U7XG5cdHByZXZpb3VzPzogSVJlc291cmNlSGFuZGxlO1xufVxuXG5pbnRlcmZhY2UgU3luY1Jlc291cmNlSGFuZGxlVHJlZUl0ZW0gZXh0ZW5kcyBJVHJlZUl0ZW0ge1xuXHRzeW5jUmVzb3VyY2VIYW5kbGU6IElTeW5jUmVzb3VyY2VIYW5kbGU7XG59XG5cbmludGVyZmFjZSBQcm9maWxlVHJlZUl0ZW0gZXh0ZW5kcyBJVHJlZUl0ZW0ge1xuXHRwcm9maWxlOiBQcm9maWxlO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBVc2VyRGF0YVN5bmNBY3Rpdml0eVZpZXdEYXRhUHJvdmlkZXI8VCA9IFByb2ZpbGU+IGltcGxlbWVudHMgSVRyZWVWaWV3RGF0YVByb3ZpZGVyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN5bmNSZXNvdXJjZUhhbmRsZXNCeVByb2ZpbGUgPSBuZXcgTWFwPHN0cmluZywgUHJvbWlzZTxTeW5jUmVzb3VyY2VIYW5kbGVUcmVlSXRlbVtdPj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVzZXJEYXRhU3luY1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlOiBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdXNlckRhdGFBdXRvU3luY1NlcnZpY2U6IElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlOiBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGFzeW5jIGdldENoaWxkcmVuKGVsZW1lbnQ/OiBJVHJlZUl0ZW0pOiBQcm9taXNlPElUcmVlSXRlbVtdPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5nZXRSb290cygpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCg8UHJvZmlsZVRyZWVJdGVtPmVsZW1lbnQpLnByb2ZpbGUgfHwgZWxlbWVudC5oYW5kbGUgPT09IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuaWQpIHtcblx0XHRcdFx0bGV0IHByb21pc2UgPSB0aGlzLnN5bmNSZXNvdXJjZUhhbmRsZXNCeVByb2ZpbGUuZ2V0KGVsZW1lbnQuaGFuZGxlKTtcblx0XHRcdFx0aWYgKCFwcm9taXNlKSB7XG5cdFx0XHRcdFx0dGhpcy5zeW5jUmVzb3VyY2VIYW5kbGVzQnlQcm9maWxlLnNldChlbGVtZW50LmhhbmRsZSwgcHJvbWlzZSA9IHRoaXMuZ2V0U3luY1Jlc291cmNlSGFuZGxlcyg8VD4oPFByb2ZpbGVUcmVlSXRlbT5lbGVtZW50KS5wcm9maWxlKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGF3YWl0IHByb21pc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoKDxTeW5jUmVzb3VyY2VIYW5kbGVUcmVlSXRlbT5lbGVtZW50KS5zeW5jUmVzb3VyY2VIYW5kbGUpIHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuZ2V0Q2hpbGRyZW5Gb3JTeW5jUmVzb3VyY2VUcmVlSXRlbSg8U3luY1Jlc291cmNlSGFuZGxlVHJlZUl0ZW0+ZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghKGVycm9yIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IpKSB7XG5cdFx0XHRcdGVycm9yID0gVXNlckRhdGFTeW5jRXJyb3IudG9Vc2VyRGF0YVN5bmNFcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBVc2VyRGF0YVN5bmNFcnJvciAmJiBlcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuSW5jb21wYXRpYmxlUmVtb3RlQ29udGVudCkge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogZXJyb3IubWVzc2FnZSxcblx0XHRcdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBbXG5cdFx0XHRcdFx0XHRcdHRvQWN0aW9uKHtcblx0XHRcdFx0XHRcdFx0XHRpZDogJ3Jlc2V0Jyxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Jlc2V0JywgXCJSZXNldCBTeW5jZWQgRGF0YVwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5yZXNldFN5bmNlZERhdGEoKVxuXHRcdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0Um9vdHMoKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdHRoaXMuc3luY1Jlc291cmNlSGFuZGxlc0J5UHJvZmlsZS5jbGVhcigpO1xuXG5cdFx0Y29uc3Qgcm9vdHM6IElUcmVlSXRlbVtdID0gW107XG5cblx0XHRjb25zdCBwcm9maWxlcyA9IGF3YWl0IHRoaXMuZ2V0UHJvZmlsZXMoKTtcblx0XHRpZiAocHJvZmlsZXMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBwcm9maWxlVHJlZUl0ZW0gPSB7XG5cdFx0XHRcdGhhbmRsZTogdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5pZCxcblx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUubmFtZSB9LFxuXHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuRXhwYW5kZWQsXG5cdFx0XHR9O1xuXHRcdFx0cm9vdHMucHVzaChwcm9maWxlVHJlZUl0ZW0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0U3luY1Jlc291cmNlSGFuZGxlcyA9IGF3YWl0IHRoaXMuZ2V0U3luY1Jlc291cmNlSGFuZGxlcygpO1xuXHRcdFx0cm9vdHMucHVzaCguLi5kZWZhdWx0U3luY1Jlc291cmNlSGFuZGxlcyk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHByb2ZpbGVzKSB7XG5cdFx0XHRjb25zdCBwcm9maWxlVHJlZUl0ZW06IFByb2ZpbGVUcmVlSXRlbSA9IHtcblx0XHRcdFx0aGFuZGxlOiBwcm9maWxlLmlkLFxuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogcHJvZmlsZS5uYW1lIH0sXG5cdFx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQsXG5cdFx0XHRcdHByb2ZpbGUsXG5cdFx0XHR9O1xuXHRcdFx0cm9vdHMucHVzaChwcm9maWxlVHJlZUl0ZW0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByb290cztcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRDaGlsZHJlbkZvclN5bmNSZXNvdXJjZVRyZWVJdGVtKGVsZW1lbnQ6IFN5bmNSZXNvdXJjZUhhbmRsZVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdGNvbnN0IHN5bmNSZXNvdXJjZUhhbmRsZSA9ICg8U3luY1Jlc291cmNlSGFuZGxlVHJlZUl0ZW0+ZWxlbWVudCkuc3luY1Jlc291cmNlSGFuZGxlO1xuXHRcdGNvbnN0IGFzc29jaWF0ZWRSZXNvdXJjZXMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldEFzc29jaWF0ZWRSZXNvdXJjZXMoc3luY1Jlc291cmNlSGFuZGxlKTtcblx0XHRjb25zdCBwcmV2aW91c0Fzc29jaWF0ZWRSZXNvdXJjZXMgPSBzeW5jUmVzb3VyY2VIYW5kbGUucHJldmlvdXMgPyBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldEFzc29jaWF0ZWRSZXNvdXJjZXMoc3luY1Jlc291cmNlSGFuZGxlLnByZXZpb3VzKSA6IFtdO1xuXHRcdHJldHVybiBhc3NvY2lhdGVkUmVzb3VyY2VzLm1hcCgoeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH0pID0+IHtcblx0XHRcdGNvbnN0IGhhbmRsZSA9IEpTT04uc3RyaW5naWZ5KHsgcmVzb3VyY2U6IHJlc291cmNlLnRvU3RyaW5nKCksIGNvbXBhcmFibGVSZXNvdXJjZTogY29tcGFyYWJsZVJlc291cmNlLnRvU3RyaW5nKCkgfSk7XG5cdFx0XHRjb25zdCBwcmV2aW91c1Jlc291cmNlID0gcHJldmlvdXNBc3NvY2lhdGVkUmVzb3VyY2VzLmZpbmQocHJldmlvdXMgPT4gYmFzZW5hbWUocHJldmlvdXMucmVzb3VyY2UpID09PSBiYXNlbmFtZShyZXNvdXJjZSkpPy5yZXNvdXJjZTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGhhbmRsZSxcblx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsXG5cdFx0XHRcdHJlc291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdFx0Y29tbWFuZDogcHJldmlvdXNSZXNvdXJjZSA/IHtcblx0XHRcdFx0XHRpZDogQVBJX09QRU5fRElGRl9FRElUT1JfQ09NTUFORF9JRCxcblx0XHRcdFx0XHR0aXRsZTogJycsXG5cdFx0XHRcdFx0YXJndW1lbnRzOiBbXG5cdFx0XHRcdFx0XHRwcmV2aW91c1Jlc291cmNlLFxuXHRcdFx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnc2lkZUJ5U2lkZUxhYmVscycsIFwiezB9IFx1MjE5NCB7MX1cIiwgYCR7YmFzZW5hbWUocmVzb3VyY2UpfSAoJHtmcm9tTm93KHN5bmNSZXNvdXJjZUhhbmRsZS5wcmV2aW91cyEuY3JlYXRlZCwgdHJ1ZSl9KWAsIGAke2Jhc2VuYW1lKHJlc291cmNlKX0gKCR7ZnJvbU5vdyhzeW5jUmVzb3VyY2VIYW5kbGUuY3JlYXRlZCwgdHJ1ZSl9KWApLFxuXHRcdFx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9IDoge1xuXHRcdFx0XHRcdGlkOiBBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCxcblx0XHRcdFx0XHR0aXRsZTogJycsXG5cdFx0XHRcdFx0YXJndW1lbnRzOiBbcmVzb3VyY2UsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb250ZXh0VmFsdWU6IGBzeW5jLWFzc29jaWF0ZWRSZXNvdXJjZS0ke3N5bmNSZXNvdXJjZUhhbmRsZS5zeW5jUmVzb3VyY2V9YFxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0U3luY1Jlc291cmNlSGFuZGxlcyhwcm9maWxlPzogVCk6IFByb21pc2U8U3luY1Jlc291cmNlSGFuZGxlVHJlZUl0ZW1bXT4ge1xuXHRcdGNvbnN0IHRyZWVJdGVtczogU3luY1Jlc291cmNlSGFuZGxlVHJlZUl0ZW1bXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21pc2UuYWxsKEFMTF9TWU5DX1JFU09VUkNFUy5tYXAoYXN5bmMgc3luY1Jlc291cmNlID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlSGFuZGxlcyA9IGF3YWl0IHRoaXMuZ2V0UmVzb3VyY2VIYW5kbGVzKHN5bmNSZXNvdXJjZSwgcHJvZmlsZSk7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VIYW5kbGVzLm1hcCgocmVzb3VyY2VIYW5kbGUsIGluZGV4KSA9PiAoeyAuLi5yZXNvdXJjZUhhbmRsZSwgc3luY1Jlc291cmNlLCBwcmV2aW91czogcmVzb3VyY2VIYW5kbGVzW2luZGV4ICsgMV0gfSkpO1xuXHRcdH0pKTtcblx0XHRjb25zdCBzeW5jUmVzb3VyY2VIYW5kbGVzID0gcmVzdWx0LmZsYXQoKS5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWQgLSBhLmNyZWF0ZWQpO1xuXHRcdGZvciAoY29uc3Qgc3luY1Jlc291cmNlSGFuZGxlIG9mIHN5bmNSZXNvdXJjZUhhbmRsZXMpIHtcblx0XHRcdGNvbnN0IGhhbmRsZSA9IEpTT04uc3RyaW5naWZ5KHsgc3luY1Jlc291cmNlSGFuZGxlLCBzeW5jUmVzb3VyY2U6IHN5bmNSZXNvdXJjZUhhbmRsZS5zeW5jUmVzb3VyY2UgfSk7XG5cdFx0XHR0cmVlSXRlbXMucHVzaCh7XG5cdFx0XHRcdGhhbmRsZSxcblx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZCxcblx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IGdldFN5bmNBcmVhTGFiZWwoc3luY1Jlc291cmNlSGFuZGxlLnN5bmNSZXNvdXJjZSkgfSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGZyb21Ob3coc3luY1Jlc291cmNlSGFuZGxlLmNyZWF0ZWQsIHRydWUpLFxuXHRcdFx0XHR0b29sdGlwOiBuZXcgRGF0ZShzeW5jUmVzb3VyY2VIYW5kbGUuY3JlYXRlZCkudG9Mb2NhbGVTdHJpbmcoKSxcblx0XHRcdFx0dGhlbWVJY29uOiBGb2xkZXJUaGVtZUljb24sXG5cdFx0XHRcdHN5bmNSZXNvdXJjZUhhbmRsZSxcblx0XHRcdFx0Y29udGV4dFZhbHVlOiBgc3luYy1yZXNvdXJjZS0ke3N5bmNSZXNvdXJjZUhhbmRsZS5zeW5jUmVzb3VyY2V9YFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cmVlSXRlbXM7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0UHJvZmlsZXMoKTogUHJvbWlzZTxQcm9maWxlW10+O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0UmVzb3VyY2VIYW5kbGVzKHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLCBwcm9maWxlPzogVCk6IFByb21pc2U8SVJlc291cmNlSGFuZGxlW10+O1xufVxuXG5jbGFzcyBMb2NhbFVzZXJEYXRhU3luY0FjdGl2aXR5Vmlld0RhdGFQcm92aWRlciBleHRlbmRzIFVzZXJEYXRhU3luY0FjdGl2aXR5Vmlld0RhdGFQcm92aWRlcjxJU3luY1VzZXJEYXRhUHJvZmlsZT4ge1xuXG5cdHByb3RlY3RlZCBnZXRSZXNvdXJjZUhhbmRsZXMoc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UsIHByb2ZpbGU6IElTeW5jVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJUmVzb3VyY2VIYW5kbGVbXT4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldExvY2FsU3luY1Jlc291cmNlSGFuZGxlcyhzeW5jUmVzb3VyY2UsIHByb2ZpbGUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGdldFByb2ZpbGVzKCk6IFByb21pc2U8SVN5bmNVc2VyRGF0YVByb2ZpbGVbXT4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzXG5cdFx0XHQuZmlsdGVyKHAgPT4gIXAuaXNEZWZhdWx0KVxuXHRcdFx0Lm1hcChwID0+ICh7XG5cdFx0XHRcdGlkOiBwLmlkLFxuXHRcdFx0XHRjb2xsZWN0aW9uOiBwLmlkLFxuXHRcdFx0XHRuYW1lOiBwLm5hbWUsXG5cdFx0XHR9KSk7XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlVXNlckRhdGFTeW5jQWN0aXZpdHlWaWV3RGF0YVByb3ZpZGVyIGV4dGVuZHMgVXNlckRhdGFTeW5jQWN0aXZpdHlWaWV3RGF0YVByb3ZpZGVyPElTeW5jVXNlckRhdGFQcm9maWxlPiB7XG5cblx0cHJpdmF0ZSBtYWNoaW5lc1Byb21pc2U6IFByb21pc2U8SVVzZXJEYXRhU3luY01hY2hpbmVbXT4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVN5bmNTZXJ2aWNlIHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UgdXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2U6IElVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZSxcblx0XHRASVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlIHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlOiBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2U6IElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlIHVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2U6IElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHVzZXJEYXRhU3luY1NlcnZpY2UsIHVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLCB1c2VyRGF0YUF1dG9TeW5jU2VydmljZSwgdXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgZ2V0Q2hpbGRyZW4oZWxlbWVudD86IElUcmVlSXRlbSk6IFByb21pc2U8SVRyZWVJdGVtW10+IHtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHRoaXMubWFjaGluZXNQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gc3VwZXIuZ2V0Q2hpbGRyZW4oZWxlbWVudCk7XG5cdH1cblxuXHRwcml2YXRlIGdldE1hY2hpbmVzKCk6IFByb21pc2U8SVVzZXJEYXRhU3luY01hY2hpbmVbXT4ge1xuXHRcdGlmICh0aGlzLm1hY2hpbmVzUHJvbWlzZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLm1hY2hpbmVzUHJvbWlzZSA9IHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLmdldE1hY2hpbmVzKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLm1hY2hpbmVzUHJvbWlzZTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRSZXNvdXJjZUhhbmRsZXMoc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UsIHByb2ZpbGU/OiBJU3luY1VzZXJEYXRhUHJvZmlsZSk6IFByb21pc2U8SVJlc291cmNlSGFuZGxlW10+IHtcblx0XHRyZXR1cm4gdGhpcy51c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5nZXRSZW1vdGVTeW5jUmVzb3VyY2VIYW5kbGVzKHN5bmNSZXNvdXJjZSwgcHJvZmlsZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0UHJvZmlsZXMoKTogUHJvbWlzZTxJU3luY1VzZXJEYXRhUHJvZmlsZVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuZ2V0UmVtb3RlU3luY2VkUHJvZmlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBnZXRDaGlsZHJlbkZvclN5bmNSZXNvdXJjZVRyZWVJdGVtKGVsZW1lbnQ6IFN5bmNSZXNvdXJjZUhhbmRsZVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgc3VwZXIuZ2V0Q2hpbGRyZW5Gb3JTeW5jUmVzb3VyY2VUcmVlSXRlbShlbGVtZW50KTtcblx0XHRpZiAoY2hpbGRyZW4ubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBtYWNoaW5lSWQgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldE1hY2hpbmVJZChlbGVtZW50LnN5bmNSZXNvdXJjZUhhbmRsZSk7XG5cdFx0XHRpZiAobWFjaGluZUlkKSB7XG5cdFx0XHRcdGNvbnN0IG1hY2hpbmVzID0gYXdhaXQgdGhpcy5nZXRNYWNoaW5lcygpO1xuXHRcdFx0XHRjb25zdCBtYWNoaW5lID0gbWFjaGluZXMuZmluZCgoeyBpZCB9KSA9PiBpZCA9PT0gbWFjaGluZUlkKTtcblx0XHRcdFx0Y2hpbGRyZW5bMF0uZGVzY3JpcHRpb24gPSBtYWNoaW5lPy5pc0N1cnJlbnQgPyBsb2NhbGl6ZSh7IGtleTogJ2N1cnJlbnQnLCBjb21tZW50OiBbJ1JlcHJlc2VudHMgY3VycmVudCBtYWNoaW5lJ10gfSwgXCJDdXJyZW50XCIpIDogbWFjaGluZT8ubmFtZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNoaWxkcmVuO1xuXHR9XG59XG5cbmNsYXNzIEV4dHJhY3RlZFVzZXJEYXRhU3luY0FjdGl2aXR5Vmlld0RhdGFQcm92aWRlciBleHRlbmRzIFVzZXJEYXRhU3luY0FjdGl2aXR5Vmlld0RhdGFQcm92aWRlcjxJU3luY1VzZXJEYXRhUHJvZmlsZT4ge1xuXG5cdHByaXZhdGUgbWFjaGluZXNQcm9taXNlOiBQcm9taXNlPElVc2VyRGF0YVN5bmNNYWNoaW5lW10+IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgYWN0aXZpdHlEYXRhTG9jYXRpb246IFVSSSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgYWN0aXZpdHlEYXRhUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRASVVzZXJEYXRhU3luY1NlcnZpY2UgdXNlckRhdGFTeW5jU2VydmljZTogSVVzZXJEYXRhU3luY1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZSB1c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZTogSVVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UgdXNlckRhdGFBdXRvU3luY1NlcnZpY2U6IElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgdXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZTogSVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodXNlckRhdGFTeW5jU2VydmljZSwgdXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UsIHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLCB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50PzogSVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0dGhpcy5tYWNoaW5lc1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoIXRoaXMuYWN0aXZpdHlEYXRhUmVzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZSh0aGlzLmFjdGl2aXR5RGF0YVJlc291cmNlKTtcblx0XHRcdGlmIChzdGF0LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRoaXMuYWN0aXZpdHlEYXRhTG9jYXRpb24gPSB0aGlzLmFjdGl2aXR5RGF0YVJlc291cmNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5hY3Rpdml0eURhdGFMb2NhdGlvbiA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZSh0aGlzLmFjdGl2aXR5RGF0YVJlc291cmNlKSwgJ3JlbW90ZUFjdGl2aXR5Jyk7XG5cdFx0XHRcdHRyeSB7IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHRoaXMuYWN0aXZpdHlEYXRhTG9jYXRpb24sIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9IGNhdGNoIChlKSB7LyogaWdub3JlICovIH1cblx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmV4dHJhY3RBY3Rpdml0eURhdGEodGhpcy5hY3Rpdml0eURhdGFSZXNvdXJjZSwgdGhpcy5hY3Rpdml0eURhdGFMb2NhdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5nZXRDaGlsZHJlbihlbGVtZW50KTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRSZXNvdXJjZUhhbmRsZXMoc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UsIHByb2ZpbGU6IElTeW5jVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJUmVzb3VyY2VIYW5kbGVbXT4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldExvY2FsU3luY1Jlc291cmNlSGFuZGxlcyhzeW5jUmVzb3VyY2UsIHByb2ZpbGUsIHRoaXMuYWN0aXZpdHlEYXRhTG9jYXRpb24pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGdldFByb2ZpbGVzKCk6IFByb21pc2U8SVN5bmNVc2VyRGF0YVByb2ZpbGVbXT4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldExvY2FsU3luY2VkUHJvZmlsZXModGhpcy5hY3Rpdml0eURhdGFMb2NhdGlvbik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgZ2V0Q2hpbGRyZW5Gb3JTeW5jUmVzb3VyY2VUcmVlSXRlbShlbGVtZW50OiBTeW5jUmVzb3VyY2VIYW5kbGVUcmVlSXRlbSk6IFByb21pc2U8SVRyZWVJdGVtW10+IHtcblx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHN1cGVyLmdldENoaWxkcmVuRm9yU3luY1Jlc291cmNlVHJlZUl0ZW0oZWxlbWVudCk7XG5cdFx0aWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbWFjaGluZUlkID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5nZXRNYWNoaW5lSWQoZWxlbWVudC5zeW5jUmVzb3VyY2VIYW5kbGUpO1xuXHRcdFx0aWYgKG1hY2hpbmVJZCkge1xuXHRcdFx0XHRjb25zdCBtYWNoaW5lcyA9IGF3YWl0IHRoaXMuZ2V0TWFjaGluZXMoKTtcblx0XHRcdFx0Y29uc3QgbWFjaGluZSA9IG1hY2hpbmVzLmZpbmQoKHsgaWQgfSkgPT4gaWQgPT09IG1hY2hpbmVJZCk7XG5cdFx0XHRcdGNoaWxkcmVuWzBdLmRlc2NyaXB0aW9uID0gbWFjaGluZT8uaXNDdXJyZW50ID8gbG9jYWxpemUoeyBrZXk6ICdjdXJyZW50JywgY29tbWVudDogWydSZXByZXNlbnRzIGN1cnJlbnQgbWFjaGluZSddIH0sIFwiQ3VycmVudFwiKSA6IG1hY2hpbmU/Lm5hbWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjaGlsZHJlbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWFjaGluZXMoKTogUHJvbWlzZTxJVXNlckRhdGFTeW5jTWFjaGluZVtdPiB7XG5cdFx0aWYgKHRoaXMubWFjaGluZXNQcm9taXNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMubWFjaGluZXNQcm9taXNlID0gdGhpcy51c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5nZXRMb2NhbFN5bmNlZE1hY2hpbmVzKHRoaXMuYWN0aXZpdHlEYXRhTG9jYXRpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5tYWNoaW5lc1Byb21pc2U7XG5cdH1cbn1cblxuY2xhc3MgVXNlckRhdGFTeW5jTWFjaGluZXNWaWV3RGF0YVByb3ZpZGVyIGltcGxlbWVudHMgSVRyZWVWaWV3RGF0YVByb3ZpZGVyIHtcblxuXHRwcml2YXRlIG1hY2hpbmVzUHJvbWlzZTogUHJvbWlzZTxJVXNlckRhdGFTeW5jTWFjaGluZVtdPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRyZWVWaWV3OiBUcmVlVmlldyxcblx0XHRASVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZTogSVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlOiBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50PzogSVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0dGhpcy5tYWNoaW5lc1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRsZXQgbWFjaGluZXMgPSBhd2FpdCB0aGlzLmdldE1hY2hpbmVzKCk7XG5cdFx0XHRtYWNoaW5lcyA9IG1hY2hpbmVzLmZpbHRlcihtID0+ICFtLmRpc2FibGVkKS5zb3J0KChtMSwgbTIpID0+IG0xLmlzQ3VycmVudCA/IC0xIDogMSk7XG5cdFx0XHR0aGlzLnRyZWVWaWV3Lm1lc3NhZ2UgPSBtYWNoaW5lcy5sZW5ndGggPyB1bmRlZmluZWQgOiBsb2NhbGl6ZSgnbm8gbWFjaGluZXMnLCBcIk5vIE1hY2hpbmVzXCIpO1xuXHRcdFx0cmV0dXJuIG1hY2hpbmVzLm1hcCgoeyBpZCwgbmFtZSwgaXNDdXJyZW50LCBwbGF0Zm9ybSB9KSA9PiAoe1xuXHRcdFx0XHRoYW5kbGU6IGlkLFxuXHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZSxcblx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IG5hbWUgfSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGlzQ3VycmVudCA/IGxvY2FsaXplKHsga2V5OiAnY3VycmVudCcsIGNvbW1lbnQ6IFsnQ3VycmVudCBtYWNoaW5lJ10gfSwgXCJDdXJyZW50XCIpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHR0aGVtZUljb246IHBsYXRmb3JtICYmIGlzV2ViUGxhdGZvcm0ocGxhdGZvcm0pID8gQ29kaWNvbi5nbG9iZSA6IENvZGljb24udm0sXG5cdFx0XHRcdGNvbnRleHRWYWx1ZTogJ3N5bmMtbWFjaGluZSdcblx0XHRcdH0pKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE1hY2hpbmVzKCk6IFByb21pc2U8SVVzZXJEYXRhU3luY01hY2hpbmVbXT4ge1xuXHRcdGlmICh0aGlzLm1hY2hpbmVzUHJvbWlzZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLm1hY2hpbmVzUHJvbWlzZSA9IHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLmdldE1hY2hpbmVzKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLm1hY2hpbmVzUHJvbWlzZTtcblx0fVxuXG5cdGFzeW5jIGRpc2FibGUobWFjaGluZUlkczogc3RyaW5nW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBtYWNoaW5lcyA9IGF3YWl0IHRoaXMuZ2V0TWFjaGluZXMoKTtcblx0XHRjb25zdCBtYWNoaW5lc1RvRGlzYWJsZSA9IG1hY2hpbmVzLmZpbHRlcigoeyBpZCB9KSA9PiBtYWNoaW5lSWRzLmluY2x1ZGVzKGlkKSk7XG5cdFx0aWYgKCFtYWNoaW5lc1RvRGlzYWJsZS5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm90IGZvdW5kJywgXCJtYWNoaW5lIG5vdCBmb3VuZCB3aXRoIGlkOiB7MH1cIiwgbWFjaGluZUlkcy5qb2luKCcsJykpKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHR0eXBlOiAnaW5mbycsXG5cdFx0XHRtZXNzYWdlOiBtYWNoaW5lc1RvRGlzYWJsZS5sZW5ndGggPiAxID8gbG9jYWxpemUoJ3R1cm4gb2ZmIHN5bmMgb24gbXVsdGlwbGUgbWFjaGluZXMnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byB0dXJuIG9mZiBzeW5jIG9uIHNlbGVjdGVkIG1hY2hpbmVzP1wiKVxuXHRcdFx0XHQ6IGxvY2FsaXplKCd0dXJuIG9mZiBzeW5jIG9uIG1hY2hpbmUnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byB0dXJuIG9mZiBzeW5jIG9uIHswfT9cIiwgbWFjaGluZXNUb0Rpc2FibGVbMF0ubmFtZSksXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3R1cm4gb2ZmJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVHVybiBvZmZcIiksXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3VsdC5jb25maXJtZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAobWFjaGluZXNUb0Rpc2FibGUuc29tZShtYWNoaW5lID0+IG1hY2hpbmUuaXNDdXJyZW50KSkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlLnR1cm5vZmYoZmFsc2UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG90aGVyTWFjaGluZXNUb0Rpc2FibGU6IFtzdHJpbmcsIGJvb2xlYW5dW10gPSBtYWNoaW5lc1RvRGlzYWJsZS5maWx0ZXIobWFjaGluZSA9PiAhbWFjaGluZS5pc0N1cnJlbnQpXG5cdFx0XHQubWFwKG1hY2hpbmUgPT4gKFttYWNoaW5lLmlkLCBmYWxzZV0pKTtcblx0XHRpZiAob3RoZXJNYWNoaW5lc1RvRGlzYWJsZS5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLnNldEVuYWJsZW1lbnRzKG90aGVyTWFjaGluZXNUb0Rpc2FibGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgcmVuYW1lKG1hY2hpbmVJZDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGlucHV0Qm94ID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZUlucHV0Qm94KCkpO1xuXHRcdGlucHV0Qm94LnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3BsYWNlaG9sZGVyJywgXCJFbnRlciB0aGUgbmFtZSBvZiB0aGUgbWFjaGluZVwiKTtcblx0XHRpbnB1dEJveC5idXN5ID0gdHJ1ZTtcblx0XHRpbnB1dEJveC5zaG93KCk7XG5cdFx0Y29uc3QgbWFjaGluZXMgPSBhd2FpdCB0aGlzLmdldE1hY2hpbmVzKCk7XG5cdFx0Y29uc3QgbWFjaGluZSA9IG1hY2hpbmVzLmZpbmQoKHsgaWQgfSkgPT4gaWQgPT09IG1hY2hpbmVJZCk7XG5cdFx0Y29uc3QgZW5hYmxlZE1hY2hpbmVzID0gbWFjaGluZXMuZmlsdGVyKCh7IGRpc2FibGVkIH0pID0+ICFkaXNhYmxlZCk7XG5cdFx0aWYgKCFtYWNoaW5lKSB7XG5cdFx0XHRpbnB1dEJveC5oaWRlKCk7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdub3QgZm91bmQnLCBcIm1hY2hpbmUgbm90IGZvdW5kIHdpdGggaWQ6IHswfVwiLCBtYWNoaW5lSWQpKTtcblx0XHR9XG5cdFx0aW5wdXRCb3guYnVzeSA9IGZhbHNlO1xuXHRcdGlucHV0Qm94LnZhbHVlID0gbWFjaGluZS5uYW1lO1xuXHRcdGNvbnN0IHZhbGlkYXRlTWFjaGluZU5hbWUgPSAobWFjaGluZU5hbWU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwgPT4ge1xuXHRcdFx0bWFjaGluZU5hbWUgPSBtYWNoaW5lTmFtZS50cmltKCk7XG5cdFx0XHRyZXR1cm4gbWFjaGluZU5hbWUgJiYgIWVuYWJsZWRNYWNoaW5lcy5zb21lKG0gPT4gbS5pZCAhPT0gbWFjaGluZUlkICYmIG0ubmFtZSA9PT0gbWFjaGluZU5hbWUpID8gbWFjaGluZU5hbWUgOiBudWxsO1xuXHRcdH07XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChpbnB1dEJveC5vbkRpZENoYW5nZVZhbHVlKCgpID0+XG5cdFx0XHRpbnB1dEJveC52YWxpZGF0aW9uTWVzc2FnZSA9IHZhbGlkYXRlTWFjaGluZU5hbWUoaW5wdXRCb3gudmFsdWUpID8gJycgOiBsb2NhbGl6ZSgndmFsaWQgbWVzc2FnZScsIFwiTWFjaGluZSBuYW1lIHNob3VsZCBiZSB1bmlxdWUgYW5kIG5vdCBlbXB0eVwiKSkpO1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPigoYywgZSkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChpbnB1dEJveC5vbkRpZEFjY2VwdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1hY2hpbmVOYW1lID0gdmFsaWRhdGVNYWNoaW5lTmFtZShpbnB1dEJveC52YWx1ZSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVTdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRcdGlmIChtYWNoaW5lTmFtZSAmJiBtYWNoaW5lTmFtZSAhPT0gbWFjaGluZS5uYW1lKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLnJlbmFtZU1hY2hpbmUobWFjaGluZUlkLCBtYWNoaW5lTmFtZSk7XG5cdFx0XHRcdFx0XHRjKHRydWUpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRlKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YyhmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBVc2VyRGF0YVN5bmNUcm91Ymxlc2hvb3RWaWV3RGF0YVByb3ZpZGVyIGltcGxlbWVudHMgSVRyZWVWaWV3RGF0YVByb3ZpZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlOiBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50PzogSVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXT4ge1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGhhbmRsZTogJ1NZTkNfTE9HUycsXG5cdFx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQsXG5cdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiBsb2NhbGl6ZSgnc3luYyBsb2dzJywgXCJMb2dzXCIpIH0sXG5cdFx0XHRcdHRoZW1lSWNvbjogQ29kaWNvbi5mb2xkZXIsXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGhhbmRsZTogJ0xBU1RfU1lOQ19TVEFURVMnLFxuXHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkLFxuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogbG9jYWxpemUoJ2xhc3Qgc3luYyBzdGF0ZXMnLCBcIkxhc3QgU3luY2VkIFJlbW90ZXNcIikgfSxcblx0XHRcdFx0dGhlbWVJY29uOiBDb2RpY29uLmZvbGRlcixcblx0XHRcdH1dO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50LmhhbmRsZSA9PT0gJ0xBU1RfU1lOQ19TVEFURVMnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRMYXN0U3luY1N0YXRlcygpO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50LmhhbmRsZSA9PT0gJ1NZTkNfTE9HUycpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldFN5bmNMb2dzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRMYXN0U3luY1N0YXRlcygpOiBQcm9taXNlPElUcmVlSXRlbVtdPiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJVHJlZUl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc3luY1Jlc291cmNlIG9mIEFMTF9TWU5DX1JFU09VUkNFUykge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBnZXRMYXN0U3luY1Jlc291cmNlVXJpKHVuZGVmaW5lZCwgc3luY1Jlc291cmNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpKTtcblx0XHRcdGlmIChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhyZXNvdXJjZSkpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdGhhbmRsZTogcmVzb3VyY2UudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogZ2V0U3luY0FyZWFMYWJlbChzeW5jUmVzb3VyY2UpIH0sXG5cdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsXG5cdFx0XHRcdFx0cmVzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IEFQSV9PUEVOX0VESVRPUl9DT01NQU5EX0lELCB0aXRsZTogJycsIGFyZ3VtZW50czogW3Jlc291cmNlLCB1bmRlZmluZWQsIHVuZGVmaW5lZF0gfSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFN5bmNMb2dzKCk6IFByb21pc2U8SVRyZWVJdGVtW10+IHtcblx0XHRjb25zdCBsb2dSZXNvdXJjZXMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UuZ2V0QWxsTG9nUmVzb3VyY2VzKCk7XG5cdFx0Y29uc3QgcmVzdWx0OiBJVHJlZUl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc3luY0xvZ1Jlc291cmNlIG9mIGxvZ1Jlc291cmNlcykge1xuXHRcdFx0Y29uc3QgbG9nRm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUoc3luY0xvZ1Jlc291cmNlKTtcblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0aGFuZGxlOiBzeW5jTG9nUmVzb3VyY2UudG9TdHJpbmcoKSxcblx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsXG5cdFx0XHRcdHJlc291cmNlVXJpOiBzeW5jTG9nUmVzb3VyY2UsXG5cdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuYmFzZW5hbWUobG9nRm9sZGVyKSB9LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwobG9nRm9sZGVyLCB0aGlzLmVudmlyb25tZW50U2VydmljZS5sb2dzSG9tZSkgPyBsb2NhbGl6ZSh7IGtleTogJ2N1cnJlbnQnLCBjb21tZW50OiBbJ1JlcHJlc2VudHMgY3VycmVudCBsb2cgZmlsZSddIH0sIFwiQ3VycmVudFwiKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0Y29tbWFuZDogeyBpZDogQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQsIHRpdGxlOiAnJywgYXJndW1lbnRzOiBbc3luY0xvZ1Jlc291cmNlLCB1bmRlZmluZWQsIHVuZGVmaW5lZF0gfSxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBeUIsWUFBbUUsZ0NBQXNFO0FBQ2xLLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxVQUFVLG9CQUFvQjtBQUN2QyxTQUFTLDZCQUErQztBQUN4RCxTQUFTLG9CQUFvQixzQkFBOEQsWUFBWSxnQ0FBZ0MsMEJBQTBCLG1CQUFtQix1QkFBdUIsd0JBQXdCLGNBQW9DLDRDQUE0QztBQUNuVCxTQUFTLGlCQUFpQixTQUFTLGNBQWM7QUFDakQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxXQUFtQjtBQUM1QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBQ25ELFNBQVMsYUFBYTtBQUN0QixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQixvQkFBb0Isa0JBQWtCLHVCQUF1QixlQUFlLCtCQUErQixZQUFZLHdCQUF3QixvQ0FBb0MsNkJBQTZCO0FBQ3hQLFNBQVMsOEJBQW9ELHFCQUFxQjtBQUNsRixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQixnQkFBZ0I7QUFDL0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQ0FBaUMsa0NBQWtDO0FBQzVFLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQTJCLGdDQUFnQztBQUMzRCxTQUFTLHFDQUFxQztBQUV2QyxJQUFNLHdCQUFOLGNBQW9DLFdBQVc7QUFBQSxFQUVyRCxZQUNDLFdBQ3dDLHNCQUNTLCtCQUNGLDZCQUNSLHFCQUN0QztBQUNELFVBQU07QUFMa0M7QUFDUztBQUNGO0FBQ1I7QUFHdkMsU0FBSyxjQUFjLFNBQVM7QUFBQSxFQUM3QjtBQUFBLEVBRVEsY0FBYyxXQUFnQztBQUNyRCxTQUFLLHNCQUFzQixTQUFTO0FBRXBDLFNBQUsscUJBQXFCLFdBQVcsSUFBSTtBQUN6QyxTQUFLLHFCQUFxQixTQUFTO0FBRW5DLFNBQUsscUJBQXFCLFdBQVcsS0FBSztBQUMxQyxTQUFLLHlCQUF5QixTQUFTO0FBQ3ZDLFNBQUssNkJBQTZCLFNBQVM7QUFBQSxFQUM1QztBQUFBLEVBRVEsc0JBQXNCLFdBQWdDO0FBQzdELFVBQU0sZ0JBQWdCLFNBQVMsR0FBbUIsV0FBVyxhQUFhO0FBQzFFLFVBQU0sV0FBVyxVQUFVLGFBQWEsV0FBVztBQUNuRCxVQUFNLGlCQUFzQztBQUFBLE1BQzNDLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLGdCQUFnQixJQUFJLGVBQWUsNkJBQTZCO0FBQUEsTUFDaEUsTUFBTSxlQUFlLElBQUksb0NBQW9DLHFCQUFxQjtBQUFBLE1BQ2xGLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxNQUNiLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSxVQUFVLHdCQUF3QixTQUFTLEtBQUs7QUFBQSxNQUNuRyxXQUFXO0FBQUEsTUFDWCxPQUFPO0FBQUEsSUFDUjtBQUNBLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUFBLEVBQ3hEO0FBQUEsRUFFUSxxQkFBcUIsV0FBZ0M7QUFDNUQsVUFBTSxLQUFLO0FBQ1gsVUFBTSxPQUFPLFVBQVUsbUJBQW1CLGlCQUFpQjtBQUMzRCxVQUFNLFdBQVcsS0FBSyxxQkFBcUIsZUFBZSxVQUFVLElBQUksS0FBSyxLQUFLO0FBQ2xGLFVBQU0sZUFBZSxLQUFLLHFCQUFxQixlQUFlLHNDQUFzQyxRQUFRO0FBQzVHLGFBQVMsb0JBQW9CO0FBQzdCLGFBQVMsZ0JBQWdCO0FBQ3pCLGFBQVMsZUFBZTtBQUV4QixTQUFLLFVBQVUsTUFBTSxJQUFJLEtBQUssNEJBQTRCLGFBQWEsS0FBSyxvQkFBb0IsZ0JBQWdCLEVBQUUsTUFBTSxTQUFTLFFBQVEsQ0FBQyxDQUFDO0FBQzNJLFVBQU0sZ0JBQWdCLFNBQVMsR0FBbUIsV0FBVyxhQUFhO0FBQzFFLFVBQU0saUJBQXNDO0FBQUEsTUFDM0M7QUFBQSxNQUNBO0FBQUEsTUFDQSxnQkFBZ0IsSUFBSSxlQUFlLFlBQVk7QUFBQSxNQUMvQyxNQUFNLGVBQWUsSUFBSSxtQkFBbUIsWUFBWSxXQUFXLGFBQWEsR0FBRyxzQkFBc0IsVUFBVSxjQUFjLFNBQVMsR0FBRyw2QkFBNkI7QUFBQSxNQUMxSyxxQkFBcUI7QUFBQSxNQUNyQixhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsT0FBTztBQUFBLElBQ1I7QUFDQSxrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFFdkQsU0FBSyxVQUFVLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxNQUNwRCxjQUFjO0FBQ2IsY0FBTTtBQUFBLFVBQ0wsSUFBSTtBQUFBLFVBQ0osT0FBTyxTQUFTLDBDQUEwQyxXQUFXO0FBQUEsVUFDckUsTUFBTSxRQUFRO0FBQUEsVUFDZCxNQUFNO0FBQUEsWUFDTCxJQUFJLE9BQU87QUFBQSxZQUNYLE1BQU0sZUFBZSxJQUFJLGVBQWUsT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUFBLFlBQzFELE9BQU87QUFBQSxVQUNSO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsTUFBTSxJQUFJLFVBQTRCLFFBQThDO0FBQ25GLGNBQU0sVUFBVSxNQUFNLGFBQWEsT0FBTyxPQUFPLGVBQWU7QUFDaEUsWUFBSSxTQUFTO0FBQ1osZ0JBQU0sU0FBUyxRQUFRO0FBQUEsUUFDeEI7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLE1BQ3BELGNBQWM7QUFDYixjQUFNO0FBQUEsVUFDTCxJQUFJO0FBQUEsVUFDSixPQUFPLFNBQVMsK0NBQStDLHdCQUF3QjtBQUFBLFVBQ3ZGLE1BQU07QUFBQSxZQUNMLElBQUksT0FBTztBQUFBLFlBQ1gsTUFBTSxlQUFlLElBQUksZUFBZSxPQUFPLFFBQVEsRUFBRSxHQUFHLGVBQWUsT0FBTyxZQUFZLGNBQWMsQ0FBQztBQUFBLFVBQzlHO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsTUFBTSxJQUFJLFVBQTRCLFFBQStCLFVBQW1EO0FBQ3ZILFlBQUksTUFBTSxhQUFhLFNBQVMsWUFBWSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUFBLFlBQVVBLFFBQU8sZUFBZSxDQUFDLEdBQUc7QUFDN0YsZ0JBQU0sU0FBUyxRQUFRO0FBQUEsUUFDeEI7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUVIO0FBQUEsRUFFUSxxQkFBcUIsV0FBMEIsUUFBdUI7QUFDN0UsVUFBTSxLQUFLLHdCQUF3QixTQUFTLFdBQVcsT0FBTztBQUM5RCxVQUFNLE9BQU8sU0FBUyxVQUFVLDhCQUE4Qix3QkFBd0IsSUFBSSxVQUFVLDZCQUE2Qix1QkFBdUI7QUFDeEosVUFBTSxXQUFXLEtBQUsscUJBQXFCLGVBQWUsVUFBVSxJQUFJLEtBQUssS0FBSztBQUNsRixhQUFTLHdCQUF3QjtBQUNqQyxhQUFTLG9CQUFvQjtBQUM3QixhQUFTLGVBQWUsU0FBUyxLQUFLLHFCQUFxQixlQUFlLDBDQUEwQyxJQUNqSCxLQUFLLHFCQUFxQixlQUFlLHlDQUF5QztBQUVyRixTQUFLLFVBQVUsTUFBTTtBQUFBLE1BQUksS0FBSyw4QkFBOEI7QUFBQSxNQUMzRCxLQUFLLDhCQUE4QjtBQUFBLE1BQ25DLEtBQUssb0JBQW9CO0FBQUEsTUFDekIsS0FBSyxvQkFBb0I7QUFBQSxJQUFnQixFQUFFLE1BQU0sU0FBUyxRQUFRLENBQUMsQ0FBQztBQUNyRSxVQUFNLGdCQUFnQixTQUFTLEdBQW1CLFdBQVcsYUFBYTtBQUMxRSxVQUFNLGlCQUFzQztBQUFBLE1BQzNDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsZ0JBQWdCLElBQUksZUFBZSxZQUFZO0FBQUEsTUFDL0MsTUFBTSxlQUFlLElBQUksbUJBQW1CLFlBQVksV0FBVyxhQUFhLEdBQUcsc0JBQXNCLFVBQVUsY0FBYyxTQUFTLEdBQUcsNkJBQTZCO0FBQUEsTUFDMUsscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLE1BQ2I7QUFBQSxNQUNBLFdBQVc7QUFBQSxNQUNYLE9BQU8sU0FBUyxNQUFNO0FBQUEsTUFDdEIsZUFBZSxDQUFDO0FBQUEsSUFDakI7QUFDQSxrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFFdkQsU0FBSyx3QkFBd0IsRUFBRTtBQUFBLEVBQ2hDO0FBQUEsRUFFUSw2QkFBNkIsV0FBZ0M7QUFDcEUsVUFBTSxLQUFLO0FBQ1gsVUFBTSxPQUFPLFVBQVUsa0NBQWtDLDJCQUEyQjtBQUNwRixVQUFNLGVBQWUsS0FBSyxxQkFBcUIsZUFBZSwrQ0FBK0MsTUFBUztBQUN0SCxVQUFNLFdBQVcsS0FBSyxxQkFBcUIsZUFBZSxVQUFVLElBQUksS0FBSyxLQUFLO0FBQ2xGLGFBQVMsd0JBQXdCO0FBQ2pDLGFBQVMsb0JBQW9CO0FBQzdCLGFBQVMsZUFBZTtBQUV4QixVQUFNLGdCQUFnQixTQUFTLEdBQW1CLFdBQVcsYUFBYTtBQUMxRSxVQUFNLGlCQUFzQztBQUFBLE1BQzNDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsZ0JBQWdCLElBQUksZUFBZSxZQUFZO0FBQUEsTUFDL0MsTUFBTTtBQUFBLE1BQ04scUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLE1BQ2I7QUFBQSxNQUNBLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxJQUNoQjtBQUNBLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV2RCxTQUFLLFVBQVUsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLE1BQ3BELGNBQWM7QUFDYixjQUFNO0FBQUEsVUFDTCxJQUFJO0FBQUEsVUFDSixPQUFPLFNBQVMsdUNBQXVDLG9CQUFvQjtBQUFBLFVBQzNFLE1BQU0sUUFBUTtBQUFBLFVBQ2QsTUFBTTtBQUFBLFlBQ0wsSUFBSSxPQUFPO0FBQUEsWUFDWCxNQUFNLGVBQWUsT0FBTyxRQUFRLEVBQUU7QUFBQSxZQUN0QyxPQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sSUFBSSxVQUEyQztBQUNwRCxjQUFNLG9CQUFvQixTQUFTLElBQUksa0JBQWtCO0FBQ3pELGNBQU0sU0FBUyxNQUFNLGtCQUFrQixlQUFlO0FBQUEsVUFDckQsT0FBTyxTQUFTLDZCQUE2QixxQ0FBcUM7QUFBQSxVQUNsRixnQkFBZ0I7QUFBQSxVQUNoQixrQkFBa0I7QUFBQSxVQUNsQixlQUFlO0FBQUEsUUFDaEIsQ0FBQztBQUNELFlBQUksQ0FBQyxTQUFTLENBQUMsR0FBRztBQUNqQjtBQUFBLFFBQ0Q7QUFDQSxxQkFBYSx1QkFBdUIsT0FBTyxDQUFDO0FBQzVDLGNBQU0sU0FBUyxRQUFRO0FBQUEsTUFDeEI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLHdCQUF3QixRQUFnQjtBQUMvQyxTQUFLLFVBQVUsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLE1BQ3BELGNBQWM7QUFDYixjQUFNO0FBQUEsVUFDTCxJQUFJLDBCQUEwQixNQUFNO0FBQUEsVUFDcEMsT0FBTyxTQUFTLDZDQUE2Qyx5QkFBeUI7QUFBQSxVQUN0RixNQUFNO0FBQUEsWUFDTCxJQUFJLE9BQU87QUFBQSxZQUNYLE1BQU0sZUFBZSxJQUFJLGVBQWUsT0FBTyxRQUFRLE1BQU0sR0FBRyxlQUFlLE1BQU0sWUFBWSxtQkFBbUIsQ0FBQztBQUFBLFVBQ3RIO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsTUFBTSxJQUFJLFVBQTRCLFFBQThDO0FBQ25GLGNBQU0sRUFBRSxTQUFTLElBQTBCLEtBQUssTUFBTSxPQUFPLGVBQWU7QUFDNUUsY0FBTSxnQkFBZ0IsU0FBUyxJQUFJLGNBQWM7QUFDakQsY0FBTSxjQUFjLFdBQVcsRUFBRSxVQUFVLElBQUksTUFBTSxRQUFRLEdBQUcsU0FBUyxFQUFFLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFBQSxNQUM1RjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxNQUNwRCxjQUFjO0FBQ2IsY0FBTTtBQUFBLFVBQ0wsSUFBSSwwQkFBMEIsTUFBTTtBQUFBLFVBQ3BDLE9BQU8sU0FBUywyQ0FBMkMsb0JBQW9CO0FBQUEsVUFDL0UsTUFBTTtBQUFBLFlBQ0wsSUFBSSxPQUFPO0FBQUEsWUFDWCxNQUFNLGVBQWUsSUFBSSxlQUFlLE9BQU8sUUFBUSxNQUFNLEdBQUcsZUFBZSxNQUFNLFlBQVksNkJBQTZCLENBQUM7QUFBQSxVQUNoSTtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sSUFBSSxVQUE0QixRQUE4QztBQUNuRixjQUFNLGlCQUFpQixTQUFTLElBQUksZUFBZTtBQUNuRCxjQUFNLEVBQUUsVUFBVSxtQkFBbUIsSUFBc0QsS0FBSyxNQUFNLE9BQU8sZUFBZTtBQUM1SCxjQUFNLGlCQUFpQixJQUFJLE1BQU0sUUFBUTtBQUN6QyxjQUFNLGdCQUFnQixJQUFJLE1BQU0sa0JBQWtCO0FBQ2xELGVBQU8sZUFBZTtBQUFBLFVBQWU7QUFBQSxVQUNwQztBQUFBLFVBQ0E7QUFBQSxVQUNBLFNBQVMscUJBQXFCLGtCQUFhLFNBQVMsRUFBRSxLQUFLLG9CQUFvQixTQUFTLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxnQkFBZ0IsU0FBUyxjQUFjLENBQUMsR0FBRyxTQUFTLEVBQUUsS0FBSyxxQkFBcUIsU0FBUyxDQUFDLDBCQUEwQixFQUFFLEdBQUcsZUFBZSxTQUFTLGFBQWEsQ0FBQyxDQUFDO0FBQUEsVUFDMVI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxNQUNwRCxjQUFjO0FBQ2IsY0FBTTtBQUFBLFVBQ0wsSUFBSSwwQkFBMEIsTUFBTTtBQUFBLFVBQ3BDLE9BQU8sU0FBUyx5Q0FBeUMsU0FBUztBQUFBLFVBQ2xFLE1BQU0sUUFBUTtBQUFBLFVBQ2QsTUFBTTtBQUFBLFlBQ0wsSUFBSSxPQUFPO0FBQUEsWUFDWCxNQUFNLGVBQWUsSUFBSSxlQUFlLE9BQU8sUUFBUSxNQUFNLEdBQUcsZUFBZSxNQUFNLFlBQVksbUJBQW1CLEdBQUcsZUFBZSxVQUFVLFlBQVksaUJBQWlCLGFBQWEsUUFBUSxFQUFFLENBQUM7QUFBQSxZQUNyTSxPQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sSUFBSSxVQUE0QixRQUE4QztBQUNuRixjQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxjQUFNLHNCQUFzQixTQUFTLElBQUksb0JBQW9CO0FBQzdELGNBQU0sRUFBRSxvQkFBb0IsYUFBYSxJQUFxRixLQUFLLE1BQU0sT0FBTyxlQUFlO0FBQy9KLGNBQU0sU0FBUyxNQUFNLGNBQWMsUUFBUTtBQUFBLFVBQzFDLFNBQVMsU0FBUyxFQUFFLEtBQUssbUJBQW1CLFNBQVMsQ0FBQyx5SEFBeUgsRUFBRSxHQUFHLDZEQUE2RCxpQkFBaUIsWUFBWSxDQUFDO0FBQUEsVUFDL1EsTUFBTTtBQUFBLFVBQ04sT0FBTyxXQUFXO0FBQUEsUUFDbkIsQ0FBQztBQUNELFlBQUksT0FBTyxXQUFXO0FBQ3JCLGlCQUFPLG9CQUFvQixRQUFRLEVBQUUsU0FBUyxtQkFBbUIsU0FBUyxLQUFLLElBQUksT0FBTyxtQkFBbUIsR0FBRyxFQUFFLENBQUM7QUFBQSxRQUNwSDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBRUg7QUFBQSxFQUVRLHlCQUF5QixXQUFnQztBQUNoRSxVQUFNLEtBQUs7QUFDWCxVQUFNLE9BQU8sVUFBVSxnQkFBZ0IsY0FBYztBQUNyRCxVQUFNLFdBQVcsS0FBSyxxQkFBcUIsZUFBZSxVQUFVLElBQUksS0FBSyxLQUFLO0FBQ2xGLFVBQU0sZUFBZSxLQUFLLHFCQUFxQixlQUFlLHdDQUF3QztBQUN0RyxhQUFTLG9CQUFvQjtBQUM3QixhQUFTLGVBQWU7QUFFeEIsVUFBTSxnQkFBZ0IsU0FBUyxHQUFtQixXQUFXLGFBQWE7QUFDMUUsVUFBTSxpQkFBc0M7QUFBQSxNQUMzQztBQUFBLE1BQ0E7QUFBQSxNQUNBLGdCQUFnQixJQUFJLGVBQWUsWUFBWTtBQUFBLE1BQy9DLE1BQU07QUFBQSxNQUNOLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxNQUNiO0FBQUEsTUFDQSxXQUFXO0FBQUEsTUFDWCxPQUFPO0FBQUEsTUFDUCxlQUFlO0FBQUEsSUFDaEI7QUFDQSxrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFBQSxFQUV4RDtBQUVEO0FBalNhLHdCQUFOO0FBQUEsRUFJSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7QUFtVGIsSUFBZSx1Q0FBZixNQUFrRztBQUFBLEVBSWpHLFlBQzBDLHFCQUNnQixxQ0FDWix5QkFDRyw4QkFDVCxxQkFDTSx5QkFDNUM7QUFOd0M7QUFDZ0I7QUFDWjtBQUNHO0FBQ1Q7QUFDTTtBQVI5QyxTQUFpQiwrQkFBK0Isb0JBQUksSUFBbUQ7QUFBQSxFQVNuRztBQUFBLEVBRUosTUFBTSxZQUFZLFNBQTJDO0FBQzVELFFBQUk7QUFDSCxVQUFJLENBQUMsU0FBUztBQUNiLGVBQU8sTUFBTSxLQUFLLFNBQVM7QUFBQSxNQUM1QjtBQUNBLFVBQXNCLFFBQVMsV0FBVyxRQUFRLFdBQVcsS0FBSyx3QkFBd0IsZUFBZSxJQUFJO0FBQzVHLFlBQUksVUFBVSxLQUFLLDZCQUE2QixJQUFJLFFBQVEsTUFBTTtBQUNsRSxZQUFJLENBQUMsU0FBUztBQUNiLGVBQUssNkJBQTZCLElBQUksUUFBUSxRQUFRLFVBQVUsS0FBSyx1QkFBNEMsUUFBUyxPQUFPLENBQUM7QUFBQSxRQUNuSTtBQUNBLGVBQU8sTUFBTTtBQUFBLE1BQ2Q7QUFDQSxVQUFpQyxRQUFTLG9CQUFvQjtBQUM3RCxlQUFPLE1BQU0sS0FBSyxtQ0FBK0QsT0FBTztBQUFBLE1BQ3pGO0FBQ0EsYUFBTyxDQUFDO0FBQUEsSUFDVCxTQUFTLE9BQU87QUFDZixVQUFJLEVBQUUsaUJBQWlCLG9CQUFvQjtBQUMxQyxnQkFBUSxrQkFBa0Isb0JBQW9CLEtBQUs7QUFBQSxNQUNwRDtBQUNBLFVBQUksaUJBQWlCLHFCQUFxQixNQUFNLFNBQVMsc0JBQXNCLDJCQUEyQjtBQUN6RyxhQUFLLG9CQUFvQixPQUFPO0FBQUEsVUFDL0IsVUFBVSxTQUFTO0FBQUEsVUFDbkIsU0FBUyxNQUFNO0FBQUEsVUFDZixTQUFTO0FBQUEsWUFDUixTQUFTO0FBQUEsY0FDUixTQUFTO0FBQUEsZ0JBQ1IsSUFBSTtBQUFBLGdCQUNKLE9BQU8sU0FBUyxTQUFTLG1CQUFtQjtBQUFBLGdCQUM1QyxLQUFLLE1BQU0sS0FBSyw2QkFBNkIsZ0JBQWdCO0FBQUEsY0FDOUQsQ0FBQztBQUFBLFlBQ0Y7QUFBQSxVQUNEO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRixPQUFPO0FBQ04sYUFBSyxvQkFBb0IsTUFBTSxLQUFLO0FBQUEsTUFDckM7QUFDQSxZQUFNO0FBQUEsSUFDUDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsV0FBaUM7QUFDOUMsU0FBSyw2QkFBNkIsTUFBTTtBQUV4QyxVQUFNLFFBQXFCLENBQUM7QUFFNUIsVUFBTSxXQUFXLE1BQU0sS0FBSyxZQUFZO0FBQ3hDLFFBQUksU0FBUyxRQUFRO0FBQ3BCLFlBQU0sa0JBQWtCO0FBQUEsUUFDdkIsUUFBUSxLQUFLLHdCQUF3QixlQUFlO0FBQUEsUUFDcEQsT0FBTyxFQUFFLE9BQU8sS0FBSyx3QkFBd0IsZUFBZSxLQUFLO0FBQUEsUUFDakUsa0JBQWtCLHlCQUF5QjtBQUFBLE1BQzVDO0FBQ0EsWUFBTSxLQUFLLGVBQWU7QUFBQSxJQUMzQixPQUFPO0FBQ04sWUFBTSw2QkFBNkIsTUFBTSxLQUFLLHVCQUF1QjtBQUNyRSxZQUFNLEtBQUssR0FBRywwQkFBMEI7QUFBQSxJQUN6QztBQUVBLGVBQVcsV0FBVyxVQUFVO0FBQy9CLFlBQU0sa0JBQW1DO0FBQUEsUUFDeEMsUUFBUSxRQUFRO0FBQUEsUUFDaEIsT0FBTyxFQUFFLE9BQU8sUUFBUSxLQUFLO0FBQUEsUUFDN0Isa0JBQWtCLHlCQUF5QjtBQUFBLFFBQzNDO0FBQUEsTUFDRDtBQUNBLFlBQU0sS0FBSyxlQUFlO0FBQUEsSUFDM0I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBZ0IsbUNBQW1DLFNBQTJEO0FBQzdHLFVBQU0scUJBQWtELFFBQVM7QUFDakUsVUFBTSxzQkFBc0IsTUFBTSxLQUFLLG9DQUFvQyx1QkFBdUIsa0JBQWtCO0FBQ3BILFVBQU0sOEJBQThCLG1CQUFtQixXQUFXLE1BQU0sS0FBSyxvQ0FBb0MsdUJBQXVCLG1CQUFtQixRQUFRLElBQUksQ0FBQztBQUN4SyxXQUFPLG9CQUFvQixJQUFJLENBQUMsRUFBRSxVQUFVLG1CQUFtQixNQUFNO0FBQ3BFLFlBQU0sU0FBUyxLQUFLLFVBQVUsRUFBRSxVQUFVLFNBQVMsU0FBUyxHQUFHLG9CQUFvQixtQkFBbUIsU0FBUyxFQUFFLENBQUM7QUFDbEgsWUFBTSxtQkFBbUIsNEJBQTRCLEtBQUssY0FBWSxTQUFTLFNBQVMsUUFBUSxNQUFNLFNBQVMsUUFBUSxDQUFDLEdBQUc7QUFDM0gsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBLGtCQUFrQix5QkFBeUI7QUFBQSxRQUMzQyxhQUFhO0FBQUEsUUFDYixTQUFTLG1CQUFtQjtBQUFBLFVBQzNCLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFdBQVc7QUFBQSxZQUNWO0FBQUEsWUFDQTtBQUFBLFlBQ0EsU0FBUyxvQkFBb0Isa0JBQWEsR0FBRyxTQUFTLFFBQVEsQ0FBQyxLQUFLLFFBQVEsbUJBQW1CLFNBQVUsU0FBUyxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsUUFBUSxDQUFDLEtBQUssUUFBUSxtQkFBbUIsU0FBUyxJQUFJLENBQUMsR0FBRztBQUFBLFlBQ2xNO0FBQUEsVUFDRDtBQUFBLFFBQ0QsSUFBSTtBQUFBLFVBQ0gsSUFBSTtBQUFBLFVBQ0osT0FBTztBQUFBLFVBQ1AsV0FBVyxDQUFDLFVBQVUsUUFBVyxNQUFTO0FBQUEsUUFDM0M7QUFBQSxRQUNBLGNBQWMsMkJBQTJCLG1CQUFtQixZQUFZO0FBQUEsTUFDekU7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLHVCQUF1QixTQUFvRDtBQUN4RixVQUFNLFlBQTBDLENBQUM7QUFDakQsVUFBTSxTQUFTLE1BQU0sUUFBUSxJQUFJLG1CQUFtQixJQUFJLE9BQU0saUJBQWdCO0FBQzdFLFlBQU0sa0JBQWtCLE1BQU0sS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBQzNFLGFBQU8sZ0JBQWdCLElBQUksQ0FBQyxnQkFBZ0IsV0FBVyxFQUFFLEdBQUcsZ0JBQWdCLGNBQWMsVUFBVSxnQkFBZ0IsUUFBUSxDQUFDLEVBQUUsRUFBRTtBQUFBLElBQ2xJLENBQUMsQ0FBQztBQUNGLFVBQU0sc0JBQXNCLE9BQU8sS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTztBQUM5RSxlQUFXLHNCQUFzQixxQkFBcUI7QUFDckQsWUFBTSxTQUFTLEtBQUssVUFBVSxFQUFFLG9CQUFvQixjQUFjLG1CQUFtQixhQUFhLENBQUM7QUFDbkcsZ0JBQVUsS0FBSztBQUFBLFFBQ2Q7QUFBQSxRQUNBLGtCQUFrQix5QkFBeUI7QUFBQSxRQUMzQyxPQUFPLEVBQUUsT0FBTyxpQkFBaUIsbUJBQW1CLFlBQVksRUFBRTtBQUFBLFFBQ2xFLGFBQWEsUUFBUSxtQkFBbUIsU0FBUyxJQUFJO0FBQUEsUUFDckQsU0FBUyxJQUFJLEtBQUssbUJBQW1CLE9BQU8sRUFBRSxlQUFlO0FBQUEsUUFDN0QsV0FBVztBQUFBLFFBQ1g7QUFBQSxRQUNBLGNBQWMsaUJBQWlCLG1CQUFtQixZQUFZO0FBQUEsTUFDL0QsQ0FBQztBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUlEO0FBNUllLHVDQUFmO0FBQUEsRUFLRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FWWTtBQThJZixNQUFNLGtEQUFrRCxxQ0FBMkQ7QUFBQSxFQUV4RyxtQkFBbUIsY0FBNEIsU0FBdUU7QUFDL0gsV0FBTyxLQUFLLG9DQUFvQyw0QkFBNEIsY0FBYyxPQUFPO0FBQUEsRUFDbEc7QUFBQSxFQUVBLE1BQWdCLGNBQStDO0FBQzlELFdBQU8sS0FBSyx3QkFBd0IsU0FDbEMsT0FBTyxPQUFLLENBQUMsRUFBRSxTQUFTLEVBQ3hCLElBQUksUUFBTTtBQUFBLE1BQ1YsSUFBSSxFQUFFO0FBQUEsTUFDTixZQUFZLEVBQUU7QUFBQSxNQUNkLE1BQU0sRUFBRTtBQUFBLElBQ1QsRUFBRTtBQUFBLEVBQ0o7QUFDRDtBQUVBLElBQU0sNkNBQU4sY0FBeUQscUNBQTJEO0FBQUEsRUFJbkgsWUFDdUIscUJBQ2dCLHFDQUNaLHlCQUNxQiw2QkFDaEIsOEJBQ1QscUJBQ0kseUJBQ3pCO0FBQ0QsVUFBTSxxQkFBcUIscUNBQXFDLHlCQUF5Qiw4QkFBOEIscUJBQXFCLHVCQUF1QjtBQUxwSDtBQUFBLEVBTWhEO0FBQUEsRUFFQSxNQUFlLFlBQVksU0FBMkM7QUFDckUsUUFBSSxDQUFDLFNBQVM7QUFDYixXQUFLLGtCQUFrQjtBQUFBLElBQ3hCO0FBQ0EsV0FBTyxNQUFNLFlBQVksT0FBTztBQUFBLEVBQ2pDO0FBQUEsRUFFUSxjQUErQztBQUN0RCxRQUFJLEtBQUssb0JBQW9CLFFBQVc7QUFDdkMsV0FBSyxrQkFBa0IsS0FBSyw0QkFBNEIsWUFBWTtBQUFBLElBQ3JFO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVUsbUJBQW1CLGNBQTRCLFNBQTREO0FBQ3BILFdBQU8sS0FBSyxvQ0FBb0MsNkJBQTZCLGNBQWMsT0FBTztBQUFBLEVBQ25HO0FBQUEsRUFFVSxjQUErQztBQUN4RCxXQUFPLEtBQUssb0NBQW9DLHdCQUF3QjtBQUFBLEVBQ3pFO0FBQUEsRUFFQSxNQUF5QixtQ0FBbUMsU0FBMkQ7QUFDdEgsVUFBTSxXQUFXLE1BQU0sTUFBTSxtQ0FBbUMsT0FBTztBQUN2RSxRQUFJLFNBQVMsUUFBUTtBQUNwQixZQUFNLFlBQVksTUFBTSxLQUFLLG9DQUFvQyxhQUFhLFFBQVEsa0JBQWtCO0FBQ3hHLFVBQUksV0FBVztBQUNkLGNBQU0sV0FBVyxNQUFNLEtBQUssWUFBWTtBQUN4QyxjQUFNLFVBQVUsU0FBUyxLQUFLLENBQUMsRUFBRSxHQUFHLE1BQU0sT0FBTyxTQUFTO0FBQzFELGlCQUFTLENBQUMsRUFBRSxjQUFjLFNBQVMsWUFBWSxTQUFTLEVBQUUsS0FBSyxXQUFXLFNBQVMsQ0FBQyw0QkFBNEIsRUFBRSxHQUFHLFNBQVMsSUFBSSxTQUFTO0FBQUEsTUFDNUk7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQWxETSw2Q0FBTjtBQUFBLEVBS0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVhHO0FBb0ROLElBQU0sZ0RBQU4sY0FBNEQscUNBQTJEO0FBQUEsRUFNdEgsWUFDUSxzQkFDZSxxQkFDZ0IscUNBQ1oseUJBQ0ssOEJBQ1QscUJBQ0kseUJBQ0ssYUFDTyxvQkFDckM7QUFDRCxVQUFNLHFCQUFxQixxQ0FBcUMseUJBQXlCLDhCQUE4QixxQkFBcUIsdUJBQXVCO0FBVjVKO0FBT3dCO0FBQ087QUFBQSxFQUd2QztBQUFBLEVBRUEsTUFBZSxZQUFZLFNBQTJDO0FBQ3JFLFFBQUksQ0FBQyxTQUFTO0FBQ2IsV0FBSyxrQkFBa0I7QUFDdkIsVUFBSSxDQUFDLEtBQUssc0JBQXNCO0FBQy9CLGVBQU8sQ0FBQztBQUFBLE1BQ1Q7QUFDQSxZQUFNLE9BQU8sTUFBTSxLQUFLLFlBQVksUUFBUSxLQUFLLG9CQUFvQjtBQUNyRSxVQUFJLEtBQUssYUFBYTtBQUNyQixhQUFLLHVCQUF1QixLQUFLO0FBQUEsTUFDbEMsT0FBTztBQUNOLGFBQUssdUJBQXVCLEtBQUssbUJBQW1CLE9BQU8sU0FBUyxLQUFLLG1CQUFtQixPQUFPLFFBQVEsS0FBSyxvQkFBb0IsR0FBRyxnQkFBZ0I7QUFDdkosWUFBSTtBQUFFLGdCQUFNLEtBQUssWUFBWSxJQUFJLEtBQUssc0JBQXNCLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxRQUFHLFNBQVMsR0FBRztBQUFBLFFBQWM7QUFDNUcsY0FBTSxLQUFLLG9CQUFvQixvQkFBb0IsS0FBSyxzQkFBc0IsS0FBSyxvQkFBb0I7QUFBQSxNQUN4RztBQUFBLElBQ0Q7QUFDQSxXQUFPLE1BQU0sWUFBWSxPQUFPO0FBQUEsRUFDakM7QUFBQSxFQUVVLG1CQUFtQixjQUE0QixTQUF1RTtBQUMvSCxXQUFPLEtBQUssb0NBQW9DLDRCQUE0QixjQUFjLFNBQVMsS0FBSyxvQkFBb0I7QUFBQSxFQUM3SDtBQUFBLEVBRUEsTUFBeUIsY0FBK0M7QUFDdkUsV0FBTyxLQUFLLG9DQUFvQyx1QkFBdUIsS0FBSyxvQkFBb0I7QUFBQSxFQUNqRztBQUFBLEVBRUEsTUFBeUIsbUNBQW1DLFNBQTJEO0FBQ3RILFVBQU0sV0FBVyxNQUFNLE1BQU0sbUNBQW1DLE9BQU87QUFDdkUsUUFBSSxTQUFTLFFBQVE7QUFDcEIsWUFBTSxZQUFZLE1BQU0sS0FBSyxvQ0FBb0MsYUFBYSxRQUFRLGtCQUFrQjtBQUN4RyxVQUFJLFdBQVc7QUFDZCxjQUFNLFdBQVcsTUFBTSxLQUFLLFlBQVk7QUFDeEMsY0FBTSxVQUFVLFNBQVMsS0FBSyxDQUFDLEVBQUUsR0FBRyxNQUFNLE9BQU8sU0FBUztBQUMxRCxpQkFBUyxDQUFDLEVBQUUsY0FBYyxTQUFTLFlBQVksU0FBUyxFQUFFLEtBQUssV0FBVyxTQUFTLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxTQUFTLElBQUksU0FBUztBQUFBLE1BQzVJO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxjQUErQztBQUN0RCxRQUFJLEtBQUssb0JBQW9CLFFBQVc7QUFDdkMsV0FBSyxrQkFBa0IsS0FBSyxvQ0FBb0MsdUJBQXVCLEtBQUssb0JBQW9CO0FBQUEsSUFDakg7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUFqRU0sZ0RBQU47QUFBQSxFQVFHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZkc7QUFtRU4sSUFBTSx1Q0FBTixNQUE0RTtBQUFBLEVBSTNFLFlBQ2tCLFVBQzhCLDZCQUNWLG1CQUNFLHFCQUNOLGVBQ2UsOEJBQy9DO0FBTmdCO0FBQzhCO0FBQ1Y7QUFDRTtBQUNOO0FBQ2U7QUFBQSxFQUVqRDtBQUFBLEVBRUEsTUFBTSxZQUFZLFNBQTJDO0FBQzVELFFBQUksQ0FBQyxTQUFTO0FBQ2IsV0FBSyxrQkFBa0I7QUFBQSxJQUN4QjtBQUNBLFFBQUk7QUFDSCxVQUFJLFdBQVcsTUFBTSxLQUFLLFlBQVk7QUFDdEMsaUJBQVcsU0FBUyxPQUFPLE9BQUssQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxPQUFPLEdBQUcsWUFBWSxLQUFLLENBQUM7QUFDbkYsV0FBSyxTQUFTLFVBQVUsU0FBUyxTQUFTLFNBQVksU0FBUyxlQUFlLGFBQWE7QUFDM0YsYUFBTyxTQUFTLElBQUksQ0FBQyxFQUFFLElBQUksTUFBTSxXQUFXLFNBQVMsT0FBTztBQUFBLFFBQzNELFFBQVE7QUFBQSxRQUNSLGtCQUFrQix5QkFBeUI7QUFBQSxRQUMzQyxPQUFPLEVBQUUsT0FBTyxLQUFLO0FBQUEsUUFDckIsYUFBYSxZQUFZLFNBQVMsRUFBRSxLQUFLLFdBQVcsU0FBUyxDQUFDLGlCQUFpQixFQUFFLEdBQUcsU0FBUyxJQUFJO0FBQUEsUUFDakcsV0FBVyxZQUFZLGNBQWMsUUFBUSxJQUFJLFFBQVEsUUFBUSxRQUFRO0FBQUEsUUFDekUsY0FBYztBQUFBLE1BQ2YsRUFBRTtBQUFBLElBQ0gsU0FBUyxPQUFPO0FBQ2YsV0FBSyxvQkFBb0IsTUFBTSxLQUFLO0FBQ3BDLGFBQU8sQ0FBQztBQUFBLElBQ1Q7QUFBQSxFQUNEO0FBQUEsRUFFUSxjQUErQztBQUN0RCxRQUFJLEtBQUssb0JBQW9CLFFBQVc7QUFDdkMsV0FBSyxrQkFBa0IsS0FBSyw0QkFBNEIsWUFBWTtBQUFBLElBQ3JFO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsTUFBTSxRQUFRLFlBQXdDO0FBQ3JELFVBQU0sV0FBVyxNQUFNLEtBQUssWUFBWTtBQUN4QyxVQUFNLG9CQUFvQixTQUFTLE9BQU8sQ0FBQyxFQUFFLEdBQUcsTUFBTSxXQUFXLFNBQVMsRUFBRSxDQUFDO0FBQzdFLFFBQUksQ0FBQyxrQkFBa0IsUUFBUTtBQUM5QixZQUFNLElBQUksTUFBTSxTQUFTLGFBQWEsa0NBQWtDLFdBQVcsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQzlGO0FBRUEsVUFBTSxTQUFTLE1BQU0sS0FBSyxjQUFjLFFBQVE7QUFBQSxNQUMvQyxNQUFNO0FBQUEsTUFDTixTQUFTLGtCQUFrQixTQUFTLElBQUksU0FBUyxzQ0FBc0MsOERBQThELElBQ2xKLFNBQVMsNEJBQTRCLGtEQUFrRCxrQkFBa0IsQ0FBQyxFQUFFLElBQUk7QUFBQSxNQUNuSCxlQUFlLFNBQVMsRUFBRSxLQUFLLFlBQVksU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsWUFBWTtBQUFBLElBQzlGLENBQUM7QUFFRCxRQUFJLENBQUMsT0FBTyxXQUFXO0FBQ3RCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxrQkFBa0IsS0FBSyxhQUFXLFFBQVEsU0FBUyxHQUFHO0FBQ3pELFlBQU0sS0FBSyw2QkFBNkIsUUFBUSxLQUFLO0FBQUEsSUFDdEQ7QUFFQSxVQUFNLHlCQUE4QyxrQkFBa0IsT0FBTyxhQUFXLENBQUMsUUFBUSxTQUFTLEVBQ3hHLElBQUksYUFBWSxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUU7QUFDdEMsUUFBSSx1QkFBdUIsUUFBUTtBQUNsQyxZQUFNLEtBQUssNEJBQTRCLGVBQWUsc0JBQXNCO0FBQUEsSUFDN0U7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxPQUFPLFdBQXFDO0FBQ2pELFVBQU0sa0JBQWtCLElBQUksZ0JBQWdCO0FBQzVDLFVBQU0sV0FBVyxnQkFBZ0IsSUFBSSxLQUFLLGtCQUFrQixlQUFlLENBQUM7QUFDNUUsYUFBUyxjQUFjLFNBQVMsZUFBZSwrQkFBK0I7QUFDOUUsYUFBUyxPQUFPO0FBQ2hCLGFBQVMsS0FBSztBQUNkLFVBQU0sV0FBVyxNQUFNLEtBQUssWUFBWTtBQUN4QyxVQUFNLFVBQVUsU0FBUyxLQUFLLENBQUMsRUFBRSxHQUFHLE1BQU0sT0FBTyxTQUFTO0FBQzFELFVBQU0sa0JBQWtCLFNBQVMsT0FBTyxDQUFDLEVBQUUsU0FBUyxNQUFNLENBQUMsUUFBUTtBQUNuRSxRQUFJLENBQUMsU0FBUztBQUNiLGVBQVMsS0FBSztBQUNkLHNCQUFnQixRQUFRO0FBQ3hCLFlBQU0sSUFBSSxNQUFNLFNBQVMsYUFBYSxrQ0FBa0MsU0FBUyxDQUFDO0FBQUEsSUFDbkY7QUFDQSxhQUFTLE9BQU87QUFDaEIsYUFBUyxRQUFRLFFBQVE7QUFDekIsVUFBTSxzQkFBc0IsQ0FBQyxnQkFBdUM7QUFDbkUsb0JBQWMsWUFBWSxLQUFLO0FBQy9CLGFBQU8sZUFBZSxDQUFDLGdCQUFnQixLQUFLLE9BQUssRUFBRSxPQUFPLGFBQWEsRUFBRSxTQUFTLFdBQVcsSUFBSSxjQUFjO0FBQUEsSUFDaEg7QUFDQSxvQkFBZ0IsSUFBSSxTQUFTLGlCQUFpQixNQUM3QyxTQUFTLG9CQUFvQixvQkFBb0IsU0FBUyxLQUFLLElBQUksS0FBSyxTQUFTLGlCQUFpQiw2Q0FBNkMsQ0FBQyxDQUFDO0FBQ2xKLFdBQU8sSUFBSSxRQUFpQixDQUFDLEdBQUcsTUFBTTtBQUNyQyxzQkFBZ0IsSUFBSSxTQUFTLFlBQVksWUFBWTtBQUNwRCxjQUFNLGNBQWMsb0JBQW9CLFNBQVMsS0FBSztBQUN0RCx3QkFBZ0IsUUFBUTtBQUN4QixZQUFJLGVBQWUsZ0JBQWdCLFFBQVEsTUFBTTtBQUNoRCxjQUFJO0FBQ0gsa0JBQU0sS0FBSyw0QkFBNEIsY0FBYyxXQUFXLFdBQVc7QUFDM0UsY0FBRSxJQUFJO0FBQUEsVUFDUCxTQUFTLE9BQU87QUFDZixjQUFFLEtBQUs7QUFBQSxVQUNSO0FBQUEsUUFDRCxPQUFPO0FBQ04sWUFBRSxLQUFLO0FBQUEsUUFDUjtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBakhNLHVDQUFOO0FBQUEsRUFNRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZHO0FBbUhOLElBQU0sMkNBQU4sTUFBZ0Y7QUFBQSxFQUUvRSxZQUNnQyxhQUNpQiw4QkFDVixvQkFDQSxvQkFDckM7QUFKOEI7QUFDaUI7QUFDVjtBQUNBO0FBQUEsRUFFdkM7QUFBQSxFQUVBLE1BQU0sWUFBWSxTQUEyQztBQUM1RCxRQUFJLENBQUMsU0FBUztBQUNiLGFBQU8sQ0FBQztBQUFBLFFBQ1AsUUFBUTtBQUFBLFFBQ1Isa0JBQWtCLHlCQUF5QjtBQUFBLFFBQzNDLE9BQU8sRUFBRSxPQUFPLFNBQVMsYUFBYSxNQUFNLEVBQUU7QUFBQSxRQUM5QyxXQUFXLFFBQVE7QUFBQSxNQUNwQixHQUFHO0FBQUEsUUFDRixRQUFRO0FBQUEsUUFDUixrQkFBa0IseUJBQXlCO0FBQUEsUUFDM0MsT0FBTyxFQUFFLE9BQU8sU0FBUyxvQkFBb0IscUJBQXFCLEVBQUU7QUFBQSxRQUNwRSxXQUFXLFFBQVE7QUFBQSxNQUNwQixDQUFDO0FBQUEsSUFDRjtBQUVBLFFBQUksUUFBUSxXQUFXLG9CQUFvQjtBQUMxQyxhQUFPLEtBQUssa0JBQWtCO0FBQUEsSUFDL0I7QUFFQSxRQUFJLFFBQVEsV0FBVyxhQUFhO0FBQ25DLGFBQU8sS0FBSyxZQUFZO0FBQUEsSUFDekI7QUFFQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFjLG9CQUEwQztBQUN2RCxVQUFNLFNBQXNCLENBQUM7QUFDN0IsZUFBVyxnQkFBZ0Isb0JBQW9CO0FBQzlDLFlBQU0sV0FBVyx1QkFBdUIsUUFBVyxjQUFjLEtBQUssb0JBQW9CLEtBQUssbUJBQW1CLE1BQU07QUFDeEgsVUFBSSxNQUFNLEtBQUssWUFBWSxPQUFPLFFBQVEsR0FBRztBQUM1QyxlQUFPLEtBQUs7QUFBQSxVQUNYLFFBQVEsU0FBUyxTQUFTO0FBQUEsVUFDMUIsT0FBTyxFQUFFLE9BQU8saUJBQWlCLFlBQVksRUFBRTtBQUFBLFVBQy9DLGtCQUFrQix5QkFBeUI7QUFBQSxVQUMzQyxhQUFhO0FBQUEsVUFDYixTQUFTLEVBQUUsSUFBSSw0QkFBNEIsT0FBTyxJQUFJLFdBQVcsQ0FBQyxVQUFVLFFBQVcsTUFBUyxFQUFFO0FBQUEsUUFDbkcsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsY0FBb0M7QUFDakQsVUFBTSxlQUFlLE1BQU0sS0FBSyw2QkFBNkIsbUJBQW1CO0FBQ2hGLFVBQU0sU0FBc0IsQ0FBQztBQUM3QixlQUFXLG1CQUFtQixjQUFjO0FBQzNDLFlBQU0sWUFBWSxLQUFLLG1CQUFtQixPQUFPLFFBQVEsZUFBZTtBQUN4RSxhQUFPLEtBQUs7QUFBQSxRQUNYLFFBQVEsZ0JBQWdCLFNBQVM7QUFBQSxRQUNqQyxrQkFBa0IseUJBQXlCO0FBQUEsUUFDM0MsYUFBYTtBQUFBLFFBQ2IsT0FBTyxFQUFFLE9BQU8sS0FBSyxtQkFBbUIsT0FBTyxTQUFTLFNBQVMsRUFBRTtBQUFBLFFBQ25FLGFBQWEsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLFdBQVcsS0FBSyxtQkFBbUIsUUFBUSxJQUFJLFNBQVMsRUFBRSxLQUFLLFdBQVcsU0FBUyxDQUFDLDZCQUE2QixFQUFFLEdBQUcsU0FBUyxJQUFJO0FBQUEsUUFDdkwsU0FBUyxFQUFFLElBQUksNEJBQTRCLE9BQU8sSUFBSSxXQUFXLENBQUMsaUJBQWlCLFFBQVcsTUFBUyxFQUFFO0FBQUEsTUFDMUcsQ0FBQztBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUVEO0FBdEVNLDJDQUFOO0FBQUEsRUFHRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBTkc7IiwKICAibmFtZXMiOiBbImhhbmRsZSJdCn0K
