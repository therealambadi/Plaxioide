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
import { Action, Separator, toAction } from "../../../../base/common/actions.js";
import { Emitter } from "../../../../base/common/event.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isUserDataProfile, IUserDataProfilesService, ProfileResourceType, toUserDataProfile } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { isProfileURL, IUserDataProfileImportExportService, IUserDataProfileManagementService, IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import * as arrays from "../../../../base/common/arrays.js";
import { equals } from "../../../../base/common/objects.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { ExtensionsResourceExportTreeItem, ExtensionsResourceImportTreeItem } from "../../../services/userDataProfile/browser/extensionsResource.js";
import { SettingsResource, SettingsResourceTreeItem } from "../../../services/userDataProfile/browser/settingsResource.js";
import { KeybindingsResource, KeybindingsResourceTreeItem } from "../../../services/userDataProfile/browser/keybindingsResource.js";
import { TasksResource, TasksResourceTreeItem } from "../../../services/userDataProfile/browser/tasksResource.js";
import { SnippetsResource, SnippetsResourceTreeItem } from "../../../services/userDataProfile/browser/snippetsResource.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InMemoryFileSystemProvider } from "../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { createCancelablePromise, RunOnceScheduler } from "../../../../base/common/async.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { CONFIG_NEW_WINDOW_PROFILE } from "../../../common/configuration.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IWorkspaceContextService, WORKSPACE_SUFFIX } from "../../../../platform/workspace/common/workspace.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isString } from "../../../../base/common/types.js";
import { IWorkbenchExtensionManagementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
function isProfileResourceTypeElement(element) {
  return element.resourceType !== void 0;
}
function isProfileResourceChildElement(element) {
  return element.label !== void 0;
}
let AbstractUserDataProfileElement = class extends Disposable {
  constructor(name, icon, flags, workspaces, isActive, userDataProfileManagementService, userDataProfilesService, commandService, workspaceContextService, hostService, uriIdentityService, fileService, extensionManagementService, instantiationService) {
    super();
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.userDataProfilesService = userDataProfilesService;
    this.commandService = commandService;
    this.workspaceContextService = workspaceContextService;
    this.hostService = hostService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.extensionManagementService = extensionManagementService;
    this.instantiationService = instantiationService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.saveScheduler = this._register(new RunOnceScheduler(() => this.doSave(), 500));
    this._name = "";
    this._active = false;
    this._disabled = false;
    this._name = name;
    this._icon = icon;
    this._flags = flags;
    this._workspaces = workspaces;
    this._active = isActive;
    this._register(this.onDidChange((e) => {
      if (!e.message) {
        this.validate();
      }
      this.save();
    }));
    this._register(this.extensionManagementService.onProfileAwareDidInstallExtensions((results) => {
      const profile = this.getProfileToWatch();
      if (profile && results.some((r) => !r.error && (r.applicationScoped || this.uriIdentityService.extUri.isEqual(r.profileLocation, profile.extensionsResource)))) {
        this._onDidChange.fire({ extensions: true });
      }
    }));
    this._register(this.extensionManagementService.onProfileAwareDidUninstallExtension((e) => {
      const profile = this.getProfileToWatch();
      if (profile && !e.error && (e.applicationScoped || this.uriIdentityService.extUri.isEqual(e.profileLocation, profile.extensionsResource))) {
        this._onDidChange.fire({ extensions: true });
      }
    }));
    this._register(this.extensionManagementService.onProfileAwareDidUpdateExtensionMetadata((e) => {
      const profile = this.getProfileToWatch();
      if (profile && e.local.isApplicationScoped || this.uriIdentityService.extUri.isEqual(e.profileLocation, profile?.extensionsResource)) {
        this._onDidChange.fire({ extensions: true });
      }
    }));
  }
  get name() {
    return this._name;
  }
  set name(name) {
    name = name.trim();
    if (this._name !== name) {
      this._name = name;
      this._onDidChange.fire({ name: true });
    }
  }
  get icon() {
    return this._icon;
  }
  set icon(icon) {
    if (this._icon !== icon) {
      this._icon = icon;
      this._onDidChange.fire({ icon: true });
    }
  }
  get workspaces() {
    return this._workspaces;
  }
  set workspaces(workspaces) {
    if (!arrays.equals(this._workspaces, workspaces, (a, b) => a.toString() === b.toString())) {
      this._workspaces = workspaces;
      this._onDidChange.fire({ workspaces: true });
    }
  }
  get flags() {
    return this._flags;
  }
  set flags(flags) {
    if (!equals(this._flags, flags)) {
      this._flags = flags;
      this._onDidChange.fire({ flags: true });
    }
  }
  get active() {
    return this._active;
  }
  set active(active) {
    if (this._active !== active) {
      this._active = active;
      this._onDidChange.fire({ active: true });
    }
  }
  get message() {
    return this._message;
  }
  set message(message) {
    if (this._message !== message) {
      this._message = message;
      this._onDidChange.fire({ message: true });
    }
  }
  get disabled() {
    return this._disabled;
  }
  set disabled(saving) {
    if (this._disabled !== saving) {
      this._disabled = saving;
      this._onDidChange.fire({ disabled: true });
    }
  }
  getFlag(key) {
    return this.flags?.[key] ?? false;
  }
  setFlag(key, value) {
    const flags = this.flags ? { ...this.flags } : {};
    if (value) {
      flags[key] = true;
    } else {
      delete flags[key];
    }
    this.flags = flags;
  }
  validate() {
    if (!this.name) {
      this.message = localize("name required", "Profile name is required and must be a non-empty value.");
      return;
    }
    if (this.shouldValidateName() && this.name !== this.getInitialName() && this.userDataProfilesService.profiles.some((p) => p.name === this.name)) {
      this.message = localize("profileExists", "Profile with name {0} already exists.", this.name);
      return;
    }
    if (this.flags && this.flags.settings && this.flags.keybindings && this.flags.tasks && this.flags.snippets && this.flags.extensions) {
      this.message = localize("invalid configurations", "The profile should contain at least one configuration.");
      return;
    }
    this.message = void 0;
  }
  async getChildren(resourceType) {
    if (resourceType === void 0) {
      const resourceTypes = [
        ProfileResourceType.Settings,
        ProfileResourceType.Keybindings,
        ProfileResourceType.Tasks,
        ProfileResourceType.Snippets,
        ProfileResourceType.Extensions
      ];
      return Promise.all(resourceTypes.map(async (r) => {
        const children = r === ProfileResourceType.Settings || r === ProfileResourceType.Keybindings || r === ProfileResourceType.Tasks ? await this.getChildrenForResourceType(r) : [];
        return {
          handle: r,
          checkbox: void 0,
          resourceType: r,
          openAction: children.length ? toAction({
            id: "_open",
            label: localize("open", "Open to the Side"),
            class: ThemeIcon.asClassName(Codicon.goToFile),
            run: () => children[0]?.openAction?.run()
          }) : void 0
        };
      }));
    }
    return this.getChildrenForResourceType(resourceType);
  }
  async getChildrenForResourceType(resourceType) {
    return [];
  }
  async getChildrenFromProfile(profile, resourceType) {
    profile = this.getFlag(resourceType) ? this.userDataProfilesService.defaultProfile : profile;
    let children = [];
    switch (resourceType) {
      case ProfileResourceType.Settings:
        children = await this.instantiationService.createInstance(SettingsResourceTreeItem, profile).getChildren();
        break;
      case ProfileResourceType.Keybindings:
        children = await this.instantiationService.createInstance(KeybindingsResourceTreeItem, profile).getChildren();
        break;
      case ProfileResourceType.Snippets:
        children = await this.instantiationService.createInstance(SnippetsResourceTreeItem, profile).getChildren() ?? [];
        break;
      case ProfileResourceType.Tasks:
        children = await this.instantiationService.createInstance(TasksResourceTreeItem, profile).getChildren();
        break;
      case ProfileResourceType.Extensions:
        children = await this.instantiationService.createInstance(ExtensionsResourceExportTreeItem, profile).getChildren();
        break;
    }
    return children.map((child) => this.toUserDataProfileResourceChildElement(child));
  }
  toUserDataProfileResourceChildElement(child, primaryActions, contextMenuActions) {
    return {
      handle: child.handle,
      checkbox: child.checkbox,
      label: child.label?.label ?? "",
      description: isString(child.description) ? child.description : void 0,
      resource: URI.revive(child.resourceUri),
      icon: child.themeIcon,
      openAction: toAction({
        id: "_openChild",
        label: localize("open", "Open to the Side"),
        class: ThemeIcon.asClassName(Codicon.goToFile),
        run: async () => {
          if (child.parent.type === ProfileResourceType.Extensions) {
            await this.commandService.executeCommand("extension.open", child.handle, void 0, true, void 0, true);
          } else if (child.resourceUri) {
            await this.commandService.executeCommand(API_OPEN_EDITOR_COMMAND_ID, child.resourceUri, [SIDE_GROUP], void 0);
          }
        }
      }),
      actions: {
        primary: primaryActions,
        contextMenu: contextMenuActions
      }
    };
  }
  getInitialName() {
    return "";
  }
  shouldValidateName() {
    return true;
  }
  getCurrentWorkspace() {
    const workspace = this.workspaceContextService.getWorkspace();
    return workspace.configuration ?? workspace.folders[0]?.uri;
  }
  openWorkspace(workspace) {
    if (this.uriIdentityService.extUri.extname(workspace) === WORKSPACE_SUFFIX) {
      this.hostService.openWindow([{ workspaceUri: workspace }], { forceNewWindow: true });
    } else {
      this.hostService.openWindow([{ folderUri: workspace }], { forceNewWindow: true });
    }
  }
  save() {
    this.saveScheduler.schedule();
  }
  hasUnsavedChanges(profile) {
    if (this.name !== profile.name) {
      return true;
    }
    if (this.icon !== profile.icon) {
      return true;
    }
    if (!equals(this.flags ?? {}, profile.useDefaultFlags ?? {})) {
      return true;
    }
    if (!arrays.equals(this.workspaces ?? [], profile.workspaces ?? [], (a, b) => a.toString() === b.toString())) {
      return true;
    }
    return false;
  }
  async saveProfile(profile) {
    if (!this.hasUnsavedChanges(profile)) {
      return;
    }
    this.validate();
    if (this.message) {
      return;
    }
    const useDefaultFlags = this.flags ? this.flags.settings && this.flags.keybindings && this.flags.tasks && this.flags.globalState && this.flags.extensions ? void 0 : this.flags : void 0;
    return await this.userDataProfileManagementService.updateProfile(profile, {
      name: this.name,
      icon: this.icon,
      useDefaultFlags: profile.useDefaultFlags && !useDefaultFlags ? {} : useDefaultFlags,
      workspaces: this.workspaces
    });
  }
};
AbstractUserDataProfileElement = __decorateClass([
  __decorateParam(5, IUserDataProfileManagementService),
  __decorateParam(6, IUserDataProfilesService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IUriIdentityService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IWorkbenchExtensionManagementService),
  __decorateParam(13, IInstantiationService)
], AbstractUserDataProfileElement);
let UserDataProfileElement = class extends AbstractUserDataProfileElement {
  constructor(_profile, titleButtons, actions, userDataProfileService, configurationService, userDataProfileManagementService, userDataProfilesService, commandService, workspaceContextService, hostService, uriIdentityService, fileService, extensionManagementService, instantiationService) {
    super(
      _profile.name,
      _profile.icon,
      _profile.useDefaultFlags,
      _profile.workspaces,
      userDataProfileService.currentProfile.id === _profile.id,
      userDataProfileManagementService,
      userDataProfilesService,
      commandService,
      workspaceContextService,
      hostService,
      uriIdentityService,
      fileService,
      extensionManagementService,
      instantiationService
    );
    this._profile = _profile;
    this.titleButtons = titleButtons;
    this.actions = actions;
    this.userDataProfileService = userDataProfileService;
    this.configurationService = configurationService;
    this._isNewWindowProfile = false;
    this._isNewWindowProfile = this.configurationService.getValue(CONFIG_NEW_WINDOW_PROFILE) === this.profile.name;
    this._register(configurationService.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration(CONFIG_NEW_WINDOW_PROFILE)) {
          this.isNewWindowProfile = this.configurationService.getValue(CONFIG_NEW_WINDOW_PROFILE) === this.profile.name;
        }
      }
    ));
    this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => this.active = this.userDataProfileService.currentProfile.id === this.profile.id));
    this._register(this.userDataProfilesService.onDidChangeProfiles(({ updated }) => {
      const profile = updated.find((p) => p.id === this.profile.id);
      if (profile) {
        this._profile = profile;
        this.reset();
        this._onDidChange.fire({ profile: true });
      }
    }));
    this._register(fileService.watch(this.profile.snippetsHome));
    this._register(fileService.onDidFilesChange((e) => {
      if (e.affects(this.profile.snippetsHome)) {
        this._onDidChange.fire({ snippets: true });
      }
    }));
  }
  get profile() {
    return this._profile;
  }
  getProfileToWatch() {
    return this.profile;
  }
  reset() {
    this.name = this._profile.name;
    this.icon = this._profile.icon;
    this.flags = this._profile.useDefaultFlags;
    this.workspaces = this._profile.workspaces;
  }
  updateWorkspaces(toAdd, toRemove) {
    const workspaces = new ResourceSet(this.workspaces ?? []);
    for (const workspace of toAdd) {
      workspaces.add(workspace);
    }
    for (const workspace of toRemove) {
      workspaces.delete(workspace);
    }
    this.workspaces = [...workspaces.values()];
  }
  async toggleNewWindowProfile() {
    if (this._isNewWindowProfile) {
      await this.configurationService.updateValue(CONFIG_NEW_WINDOW_PROFILE, null);
    } else {
      await this.configurationService.updateValue(CONFIG_NEW_WINDOW_PROFILE, this.profile.name);
    }
  }
  get isNewWindowProfile() {
    return this._isNewWindowProfile;
  }
  set isNewWindowProfile(isNewWindowProfile) {
    if (this._isNewWindowProfile !== isNewWindowProfile) {
      this._isNewWindowProfile = isNewWindowProfile;
      this._onDidChange.fire({ newWindowProfile: true });
    }
  }
  async toggleCurrentWindowProfile() {
    if (this.userDataProfileService.currentProfile.id === this.profile.id) {
      await this.userDataProfileManagementService.switchProfile(this.userDataProfilesService.defaultProfile);
    } else {
      await this.userDataProfileManagementService.switchProfile(this.profile);
    }
  }
  async doSave() {
    await this.saveProfile(this.profile);
  }
  async getChildrenForResourceType(resourceType) {
    if (resourceType === ProfileResourceType.Extensions) {
      const children = await this.instantiationService.createInstance(ExtensionsResourceExportTreeItem, this.profile).getChildren();
      return children.map((child) => this.toUserDataProfileResourceChildElement(
        child,
        void 0,
        [{
          id: "applyToAllProfiles",
          label: localize("applyToAllProfiles", "Apply Extension to all Profiles"),
          checked: child.applicationScoped,
          enabled: true,
          class: "",
          tooltip: "",
          run: async () => {
            const extensions = await this.extensionManagementService.getInstalled(void 0, this.profile.extensionsResource);
            const extension = extensions.find((e) => areSameExtensions(e.identifier, child.identifier));
            if (extension) {
              await this.extensionManagementService.toggleAppliationScope(extension, this.profile.extensionsResource);
            }
          }
        }]
      ));
    }
    return this.getChildrenFromProfile(this.profile, resourceType);
  }
  getInitialName() {
    return this.profile.name;
  }
};
UserDataProfileElement = __decorateClass([
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IUserDataProfileManagementService),
  __decorateParam(6, IUserDataProfilesService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IUriIdentityService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IWorkbenchExtensionManagementService),
  __decorateParam(13, IInstantiationService)
], UserDataProfileElement);
const USER_DATA_PROFILE_TEMPLATE_PREVIEW_SCHEME = "userdataprofiletemplatepreview";
let NewProfileElement = class extends AbstractUserDataProfileElement {
  constructor(name, copyFrom, titleButtons, actions, userDataProfileImportExportService, userDataProfileManagementService, userDataProfilesService, commandService, workspaceContextService, hostService, uriIdentityService, fileService, extensionManagementService, instantiationService) {
    super(
      name,
      void 0,
      void 0,
      void 0,
      false,
      userDataProfileManagementService,
      userDataProfilesService,
      commandService,
      workspaceContextService,
      hostService,
      uriIdentityService,
      fileService,
      extensionManagementService,
      instantiationService
    );
    this.titleButtons = titleButtons;
    this.actions = actions;
    this.userDataProfileImportExportService = userDataProfileImportExportService;
    this._copyFromTemplates = new ResourceMap();
    this.template = null;
    this.previewProfileWatchDisposables = this._register(new DisposableStore());
    this.defaultName = name;
    this._copyFrom = copyFrom;
    this._copyFlags = this.getCopyFlagsFrom(copyFrom);
    this.initialize();
    this._register(this.fileService.registerProvider(USER_DATA_PROFILE_TEMPLATE_PREVIEW_SCHEME, this._register(new InMemoryFileSystemProvider())));
    this._register(toDisposable(() => {
      if (this.previewProfile) {
        this.userDataProfilesService.removeProfile(this.previewProfile);
      }
    }));
  }
  get copyFromTemplates() {
    return this._copyFromTemplates;
  }
  get copyFrom() {
    return this._copyFrom;
  }
  set copyFrom(copyFrom) {
    if (this._copyFrom !== copyFrom) {
      this._copyFrom = copyFrom;
      this._onDidChange.fire({ copyFrom: true });
      this.flags = void 0;
      this.copyFlags = this.getCopyFlagsFrom(copyFrom);
      if (copyFrom instanceof URI) {
        this.templatePromise?.cancel();
        this.templatePromise = void 0;
      }
      this.initialize();
    }
  }
  get copyFlags() {
    return this._copyFlags;
  }
  set copyFlags(flags) {
    if (!equals(this._copyFlags, flags)) {
      this._copyFlags = flags;
      this._onDidChange.fire({ copyFlags: true });
    }
  }
  get previewProfile() {
    return this._previewProfile;
  }
  set previewProfile(profile) {
    if (this._previewProfile !== profile) {
      this._previewProfile = profile;
      this._onDidChange.fire({ preview: true });
      this.previewProfileWatchDisposables.clear();
      if (this._previewProfile) {
        this.previewProfileWatchDisposables.add(this.fileService.watch(this._previewProfile.snippetsHome));
        this.previewProfileWatchDisposables.add(this.fileService.onDidFilesChange((e) => {
          if (!this._previewProfile) {
            return;
          }
          if (e.affects(this._previewProfile.snippetsHome)) {
            this._onDidChange.fire({ snippets: true });
          }
        }));
      }
    }
  }
  getProfileToWatch() {
    return this.previewProfile;
  }
  getCopyFlagsFrom(copyFrom) {
    return copyFrom ? {
      settings: true,
      keybindings: true,
      snippets: true,
      tasks: true,
      extensions: true
    } : void 0;
  }
  async initialize() {
    this.disabled = true;
    try {
      if (this.copyFrom instanceof URI) {
        await this.resolveTemplate(this.copyFrom);
        if (this.template) {
          this.copyFromTemplates.set(this.copyFrom, this.template.name);
          if (this.defaultName === this.name) {
            this.name = this.defaultName = this.template.name ?? "";
          }
          if (this.defaultIcon === this.icon) {
            this.icon = this.defaultIcon = this.template.icon;
          }
          this.setCopyFlag(ProfileResourceType.Settings, !!this.template.settings);
          this.setCopyFlag(ProfileResourceType.Keybindings, !!this.template.keybindings);
          this.setCopyFlag(ProfileResourceType.Tasks, !!this.template.tasks);
          this.setCopyFlag(ProfileResourceType.Snippets, !!this.template.snippets);
          this.setCopyFlag(ProfileResourceType.Extensions, !!this.template.extensions);
          this._onDidChange.fire({ copyFromInfo: true });
        }
        return;
      }
      if (isUserDataProfile(this.copyFrom)) {
        if (this.defaultName === this.name) {
          this.name = this.defaultName = localize("copy from", "{0} (Copy)", this.copyFrom.name);
        }
        if (this.defaultIcon === this.icon) {
          this.icon = this.defaultIcon = this.copyFrom.icon;
        }
        this.setCopyFlag(ProfileResourceType.Settings, true);
        this.setCopyFlag(ProfileResourceType.Keybindings, true);
        this.setCopyFlag(ProfileResourceType.Tasks, true);
        this.setCopyFlag(ProfileResourceType.Snippets, true);
        this.setCopyFlag(ProfileResourceType.Extensions, true);
        this._onDidChange.fire({ copyFromInfo: true });
        return;
      }
      if (this.defaultName === this.name) {
        this.name = this.defaultName = localize("untitled", "Untitled");
      }
      if (this.defaultIcon === this.icon) {
        this.icon = this.defaultIcon = void 0;
      }
      this.setCopyFlag(ProfileResourceType.Settings, false);
      this.setCopyFlag(ProfileResourceType.Keybindings, false);
      this.setCopyFlag(ProfileResourceType.Tasks, false);
      this.setCopyFlag(ProfileResourceType.Snippets, false);
      this.setCopyFlag(ProfileResourceType.Extensions, false);
      this._onDidChange.fire({ copyFromInfo: true });
    } finally {
      this.disabled = false;
    }
  }
  async resolveTemplate(uri) {
    if (!this.templatePromise) {
      this.templatePromise = createCancelablePromise(async (token) => {
        const template = await this.userDataProfileImportExportService.resolveProfileTemplate(uri);
        if (!token.isCancellationRequested) {
          this.template = template;
        }
      });
    }
    await this.templatePromise;
    return this.template;
  }
  hasResource(resourceType) {
    if (this.template) {
      switch (resourceType) {
        case ProfileResourceType.Settings:
          return !!this.template.settings;
        case ProfileResourceType.Keybindings:
          return !!this.template.keybindings;
        case ProfileResourceType.Snippets:
          return !!this.template.snippets;
        case ProfileResourceType.Tasks:
          return !!this.template.tasks;
        case ProfileResourceType.Extensions:
          return !!this.template.extensions;
      }
    }
    return true;
  }
  getCopyFlag(key) {
    return this.copyFlags?.[key] ?? false;
  }
  setCopyFlag(key, value) {
    const flags = this.copyFlags ? { ...this.copyFlags } : {};
    flags[key] = value;
    this.copyFlags = flags;
  }
  getCopyFromName() {
    if (isUserDataProfile(this.copyFrom)) {
      return this.copyFrom.name;
    }
    if (this.copyFrom instanceof URI) {
      return this.copyFromTemplates.get(this.copyFrom);
    }
    return void 0;
  }
  async getChildrenForResourceType(resourceType) {
    if (this.getFlag(resourceType)) {
      return this.getChildrenFromProfile(this.userDataProfilesService.defaultProfile, resourceType);
    }
    if (!this.getCopyFlag(resourceType)) {
      return [];
    }
    if (this.previewProfile) {
      return this.getChildrenFromProfile(this.previewProfile, resourceType);
    }
    if (this.copyFrom instanceof URI) {
      await this.resolveTemplate(this.copyFrom);
      if (!this.template) {
        return [];
      }
      return this.getChildrenFromProfileTemplate(this.template, resourceType);
    }
    if (this.copyFrom) {
      return this.getChildrenFromProfile(this.copyFrom, resourceType);
    }
    return [];
  }
  async getChildrenFromProfileTemplate(profileTemplate, resourceType) {
    const location = URI.from({ scheme: USER_DATA_PROFILE_TEMPLATE_PREVIEW_SCHEME, path: `/root/profiles/${profileTemplate.name}` });
    const cacheLocation = URI.from({ scheme: USER_DATA_PROFILE_TEMPLATE_PREVIEW_SCHEME, path: `/root/cache/${profileTemplate.name}` });
    const profile = toUserDataProfile(generateUuid(), this.name, location, cacheLocation);
    switch (resourceType) {
      case ProfileResourceType.Settings:
        if (profileTemplate.settings) {
          await this.instantiationService.createInstance(SettingsResource).apply(profileTemplate.settings, profile);
          return this.getChildrenFromProfile(profile, resourceType);
        }
        return [];
      case ProfileResourceType.Keybindings:
        if (profileTemplate.keybindings) {
          await this.instantiationService.createInstance(KeybindingsResource).apply(profileTemplate.keybindings, profile);
          return this.getChildrenFromProfile(profile, resourceType);
        }
        return [];
      case ProfileResourceType.Snippets:
        if (profileTemplate.snippets) {
          await this.instantiationService.createInstance(SnippetsResource).apply(profileTemplate.snippets, profile);
          return this.getChildrenFromProfile(profile, resourceType);
        }
        return [];
      case ProfileResourceType.Tasks:
        if (profileTemplate.tasks) {
          await this.instantiationService.createInstance(TasksResource).apply(profileTemplate.tasks, profile);
          return this.getChildrenFromProfile(profile, resourceType);
        }
        return [];
      case ProfileResourceType.Extensions:
        if (profileTemplate.extensions) {
          const children = await this.instantiationService.createInstance(ExtensionsResourceImportTreeItem, profileTemplate.extensions).getChildren();
          return children.map((child) => this.toUserDataProfileResourceChildElement(child));
        }
        return [];
    }
    return [];
  }
  shouldValidateName() {
    return !this.copyFrom;
  }
  getInitialName() {
    return this.previewProfile?.name ?? "";
  }
  async doSave() {
    if (this.previewProfile) {
      const profile = await this.saveProfile(this.previewProfile);
      if (profile) {
        this.previewProfile = profile;
      }
    }
  }
};
NewProfileElement = __decorateClass([
  __decorateParam(4, IUserDataProfileImportExportService),
  __decorateParam(5, IUserDataProfileManagementService),
  __decorateParam(6, IUserDataProfilesService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IUriIdentityService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IWorkbenchExtensionManagementService),
  __decorateParam(13, IInstantiationService)
], NewProfileElement);
let UserDataProfilesEditorModel = class extends EditorModel {
  constructor(userDataProfileService, userDataProfilesService, userDataProfileManagementService, userDataProfileImportExportService, dialogService, telemetryService, hostService, productService, openerService, instantiationService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.userDataProfileImportExportService = userDataProfileImportExportService;
    this.dialogService = dialogService;
    this.telemetryService = telemetryService;
    this.hostService = hostService;
    this.productService = productService;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this._profiles = [];
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    for (const profile of userDataProfilesService.profiles) {
      if (!profile.isTransient) {
        this._profiles.push(this.createProfileElement(profile));
      }
    }
    this._register(toDisposable(() => this._profiles.splice(0, this._profiles.length).map(([, disposables]) => disposables.dispose())));
    this._register(userDataProfilesService.onDidChangeProfiles((e) => this.onDidChangeProfiles(e)));
  }
  static getInstance(instantiationService) {
    if (!UserDataProfilesEditorModel.INSTANCE) {
      UserDataProfilesEditorModel.INSTANCE = instantiationService.createInstance(UserDataProfilesEditorModel);
    }
    return UserDataProfilesEditorModel.INSTANCE;
  }
  get profiles() {
    return this._profiles.map(([profile]) => profile).sort((a, b) => {
      if (a instanceof NewProfileElement) {
        return 1;
      }
      if (b instanceof NewProfileElement) {
        return -1;
      }
      if (a instanceof UserDataProfileElement && a.profile.isDefault) {
        return -1;
      }
      if (b instanceof UserDataProfileElement && b.profile.isDefault) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
  onDidChangeProfiles(e) {
    let changed = false;
    for (const profile of e.added) {
      if (!profile.isTransient && profile.name !== this.newProfileElement?.name) {
        changed = true;
        this._profiles.push(this.createProfileElement(profile));
      }
    }
    for (const profile of e.removed) {
      if (profile.id === this.newProfileElement?.previewProfile?.id) {
        this.newProfileElement.previewProfile = void 0;
      }
      const index = this._profiles.findIndex(([p]) => p instanceof UserDataProfileElement && p.profile.id === profile.id);
      if (index !== -1) {
        changed = true;
        this._profiles.splice(index, 1).map(([, disposables]) => disposables.dispose());
      }
    }
    if (changed) {
      this._onDidChange.fire(void 0);
    }
  }
  getTemplates() {
    if (!this.templates) {
      this.templates = this.userDataProfileManagementService.getBuiltinProfileTemplates();
    }
    return this.templates;
  }
  createProfileElement(profile) {
    const disposables = new DisposableStore();
    const activateAction = disposables.add(new Action(
      "userDataProfile.activate",
      localize("active", "Use this Profile for Current Window"),
      ThemeIcon.asClassName(Codicon.check),
      true,
      () => this.userDataProfileManagementService.switchProfile(profileElement.profile)
    ));
    const copyFromProfileAction = disposables.add(new Action(
      "userDataProfile.copyFromProfile",
      localize("copyFromProfile", "Duplicate..."),
      ThemeIcon.asClassName(Codicon.copy),
      true,
      () => this.createNewProfile(profileElement.profile)
    ));
    const exportAction = disposables.add(new Action(
      "userDataProfile.export",
      localize("export", "Export..."),
      ThemeIcon.asClassName(Codicon.export),
      true,
      () => this.userDataProfileImportExportService.exportProfile(profile)
    ));
    const deleteAction = disposables.add(new Action(
      "userDataProfile.delete",
      localize("delete", "Delete"),
      ThemeIcon.asClassName(Codicon.trash),
      true,
      () => this.removeProfile(profileElement.profile)
    ));
    const newWindowAction = disposables.add(new Action(
      "userDataProfile.newWindow",
      localize("open new window", "Open New Window with this Profile"),
      ThemeIcon.asClassName(Codicon.emptyWindow),
      true,
      () => this.openWindow(profileElement.profile)
    ));
    const primaryActions = [];
    primaryActions.push(activateAction);
    primaryActions.push(newWindowAction);
    const secondaryActions = [];
    secondaryActions.push(copyFromProfileAction);
    secondaryActions.push(exportAction);
    if (!profile.isDefault) {
      secondaryActions.push(new Separator());
      secondaryActions.push(deleteAction);
    }
    const profileElement = disposables.add(this.instantiationService.createInstance(
      UserDataProfileElement,
      profile,
      [[], []],
      [primaryActions, secondaryActions]
    ));
    activateAction.enabled = this.userDataProfileService.currentProfile.id !== profileElement.profile.id;
    disposables.add(this.userDataProfileService.onDidChangeCurrentProfile(() => activateAction.enabled = this.userDataProfileService.currentProfile.id !== profileElement.profile.id));
    return [profileElement, disposables];
  }
  async createNewProfile(copyFrom) {
    if (this.newProfileElement) {
      const result = await this.dialogService.confirm({
        type: "info",
        message: localize("new profile exists", "A new profile is already being created. Do you want to discard it and create a new one?"),
        primaryButton: localize("discard", "Discard & Create"),
        cancelButton: localize("cancel", "Cancel")
      });
      if (!result.confirmed) {
        return;
      }
      this.revert();
    }
    if (copyFrom instanceof URI) {
      try {
        await this.userDataProfileImportExportService.resolveProfileTemplate(copyFrom);
      } catch (error) {
        this.dialogService.error(getErrorMessage(error));
        return;
      }
    }
    if (!this.newProfileElement) {
      const disposables = new DisposableStore();
      const cancellationTokenSource = new CancellationTokenSource();
      disposables.add(toDisposable(() => cancellationTokenSource.dispose(true)));
      const primaryActions = [];
      const secondaryActions = [];
      const createAction = disposables.add(new Action(
        "userDataProfile.create",
        localize("create", "Create"),
        void 0,
        true,
        () => this.saveNewProfile(false, cancellationTokenSource.token)
      ));
      primaryActions.push(createAction);
      if (isWeb && copyFrom instanceof URI && isProfileURL(copyFrom)) {
        primaryActions.push(disposables.add(new Action(
          "userDataProfile.createInDesktop",
          localize("import in desktop", "Create in {0}", this.productService.nameLong),
          void 0,
          true,
          () => this.openerService.open(copyFrom, { openExternal: true })
        )));
      }
      const cancelAction = disposables.add(new Action(
        "userDataProfile.cancel",
        localize("cancel", "Cancel"),
        ThemeIcon.asClassName(Codicon.trash),
        true,
        () => this.discardNewProfile()
      ));
      secondaryActions.push(cancelAction);
      const previewProfileAction = disposables.add(new Action(
        "userDataProfile.preview",
        localize("preview", "Preview"),
        ThemeIcon.asClassName(Codicon.openPreview),
        true,
        () => this.previewNewProfile(cancellationTokenSource.token)
      ));
      secondaryActions.push(previewProfileAction);
      const exportAction = disposables.add(new Action(
        "userDataProfile.export",
        localize("export", "Export..."),
        ThemeIcon.asClassName(Codicon.export),
        isUserDataProfile(copyFrom),
        () => this.exportNewProfile(cancellationTokenSource.token)
      ));
      this.newProfileElement = disposables.add(this.instantiationService.createInstance(
        NewProfileElement,
        copyFrom ? "" : localize("untitled", "Untitled"),
        copyFrom,
        [primaryActions, secondaryActions],
        [[cancelAction], [exportAction]]
      ));
      const updateCreateActionLabel = () => {
        if (createAction.enabled) {
          if (this.newProfileElement?.copyFrom && this.userDataProfilesService.profiles.some((p) => !p.isTransient && p.name === this.newProfileElement?.name)) {
            createAction.label = localize("replace", "Replace");
          } else {
            createAction.label = localize("create", "Create");
          }
        }
      };
      updateCreateActionLabel();
      disposables.add(this.newProfileElement.onDidChange((e) => {
        if (e.preview || e.disabled || e.message) {
          createAction.enabled = !this.newProfileElement?.disabled && !this.newProfileElement?.message;
          previewProfileAction.enabled = !this.newProfileElement?.previewProfile && !this.newProfileElement?.disabled && !this.newProfileElement?.message;
        }
        if (e.name || e.copyFrom) {
          updateCreateActionLabel();
          exportAction.enabled = isUserDataProfile(this.newProfileElement?.copyFrom);
        }
      }));
      disposables.add(this.userDataProfilesService.onDidChangeProfiles((e) => {
        updateCreateActionLabel();
        this.newProfileElement?.validate();
      }));
      this._profiles.push([this.newProfileElement, disposables]);
      this._onDidChange.fire(this.newProfileElement);
    }
    return this.newProfileElement;
  }
  revert() {
    this.removeNewProfile();
    this._onDidChange.fire(void 0);
  }
  removeNewProfile() {
    if (this.newProfileElement) {
      const index = this._profiles.findIndex(([p]) => p === this.newProfileElement);
      if (index !== -1) {
        this._profiles.splice(index, 1).map(([, disposables]) => disposables.dispose());
      }
      this.newProfileElement = void 0;
    }
  }
  async previewNewProfile(token) {
    if (!this.newProfileElement) {
      return;
    }
    if (this.newProfileElement.previewProfile) {
      return;
    }
    const profile = await this.saveNewProfile(true, token);
    if (profile) {
      this.newProfileElement.previewProfile = profile;
      if (isWeb) {
        await this.userDataProfileManagementService.switchProfile(profile);
      } else {
        await this.openWindow(profile);
      }
    }
  }
  async exportNewProfile(token) {
    if (!this.newProfileElement) {
      return;
    }
    if (!isUserDataProfile(this.newProfileElement.copyFrom)) {
      return;
    }
    const profile = toUserDataProfile(
      generateUuid(),
      this.newProfileElement.name,
      this.newProfileElement.copyFrom.location,
      this.newProfileElement.copyFrom.cacheHome,
      {
        icon: this.newProfileElement.icon,
        useDefaultFlags: this.newProfileElement.flags
      },
      this.userDataProfilesService.defaultProfile
    );
    await this.userDataProfileImportExportService.exportProfile(profile, this.newProfileElement.copyFlags);
  }
  async saveNewProfile(transient, token) {
    if (!this.newProfileElement) {
      return void 0;
    }
    this.newProfileElement.validate();
    if (this.newProfileElement.message) {
      return void 0;
    }
    this.newProfileElement.disabled = true;
    let profile;
    try {
      if (this.newProfileElement.previewProfile) {
        if (!transient) {
          profile = await this.userDataProfileManagementService.updateProfile(this.newProfileElement.previewProfile, { transient: false });
        }
      } else {
        const { flags, icon, name, copyFrom } = this.newProfileElement;
        const useDefaultFlags = flags ? flags.settings && flags.keybindings && flags.tasks && flags.globalState && flags.extensions ? void 0 : flags : void 0;
        const createProfileTelemetryData = { source: copyFrom instanceof URI ? "template" : isUserDataProfile(copyFrom) ? "profile" : copyFrom ? "external" : void 0 };
        if (copyFrom instanceof URI) {
          const template = await this.newProfileElement.resolveTemplate(copyFrom);
          if (template) {
            this.telemetryService.publicLog2("userDataProfile.createFromTemplate", createProfileTelemetryData);
            profile = await this.userDataProfileImportExportService.createProfileFromTemplate(
              template,
              {
                name,
                useDefaultFlags,
                icon,
                resourceTypeFlags: this.newProfileElement.copyFlags,
                transient
              },
              token ?? CancellationToken.None
            );
          }
        } else if (isUserDataProfile(copyFrom)) {
          profile = await this.userDataProfileImportExportService.createFromProfile(
            copyFrom,
            {
              name,
              useDefaultFlags,
              icon,
              resourceTypeFlags: this.newProfileElement.copyFlags,
              transient
            },
            token ?? CancellationToken.None
          );
        } else {
          profile = await this.userDataProfileManagementService.createProfile(name, { useDefaultFlags, icon, transient });
        }
      }
    } finally {
      if (this.newProfileElement) {
        this.newProfileElement.disabled = false;
      }
    }
    if (token?.isCancellationRequested) {
      if (profile) {
        try {
          await this.userDataProfileManagementService.removeProfile(profile);
        } catch (error) {
        }
      }
      return;
    }
    if (profile && !profile.isTransient && this.newProfileElement) {
      this.removeNewProfile();
      const existing = this._profiles.find(([p]) => p.name === profile.name);
      if (existing) {
        this._onDidChange.fire(existing[0]);
      } else {
        this.onDidChangeProfiles({ added: [profile], removed: [], updated: [], all: this.userDataProfilesService.profiles });
      }
    }
    return profile;
  }
  async discardNewProfile() {
    if (!this.newProfileElement) {
      return;
    }
    if (this.newProfileElement.previewProfile) {
      await this.userDataProfileManagementService.removeProfile(this.newProfileElement.previewProfile);
      return;
    }
    this.removeNewProfile();
    this._onDidChange.fire(void 0);
  }
  async removeProfile(profile) {
    const result = await this.dialogService.confirm({
      type: "info",
      message: localize("deleteProfile", "Are you sure you want to delete the profile '{0}'?", profile.name),
      primaryButton: localize("delete", "Delete"),
      cancelButton: localize("cancel", "Cancel")
    });
    if (result.confirmed) {
      await this.userDataProfileManagementService.removeProfile(profile);
    }
  }
  async openWindow(profile) {
    await this.hostService.openWindow({ forceProfile: profile.name });
  }
};
UserDataProfilesEditorModel = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IUserDataProfileManagementService),
  __decorateParam(3, IUserDataProfileImportExportService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IInstantiationService)
], UserDataProfilesEditorModel);
export {
  AbstractUserDataProfileElement,
  NewProfileElement,
  UserDataProfileElement,
  UserDataProfilesEditorModel,
  isProfileResourceChildElement,
  isProfileResourceTypeElement
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci91c2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciwgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IERpZENoYW5nZVByb2ZpbGVzRXZlbnQsIGlzVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIFByb2ZpbGVSZXNvdXJjZVR5cGUsIFByb2ZpbGVSZXNvdXJjZVR5cGVGbGFncywgdG9Vc2VyRGF0YVByb2ZpbGUsIFVzZURlZmF1bHRQcm9maWxlRmxhZ3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUHJvZmlsZVJlc291cmNlQ2hpbGRUcmVlSXRlbSwgSVByb2ZpbGVUZW1wbGF0ZUluZm8sIGlzUHJvZmlsZVVSTCwgSVVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UsIElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSwgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsIElVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBhcnJheXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZXNvdXJjZUV4cG9ydFRyZWVJdGVtLCBFeHRlbnNpb25zUmVzb3VyY2VJbXBvcnRUcmVlSXRlbSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9icm93c2VyL2V4dGVuc2lvbnNSZXNvdXJjZS5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc1Jlc291cmNlLCBTZXR0aW5nc1Jlc291cmNlVHJlZUl0ZW0gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci9zZXR0aW5nc1Jlc291cmNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVzb3VyY2UsIEtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9icm93c2VyL2tleWJpbmRpbmdzUmVzb3VyY2UuanMnO1xuaW1wb3J0IHsgVGFza3NSZXNvdXJjZSwgVGFza3NSZXNvdXJjZVRyZWVJdGVtIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvdGFza3NSZXNvdXJjZS5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0c1Jlc291cmNlLCBTbmlwcGV0c1Jlc291cmNlVHJlZUl0ZW0gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci9zbmlwcGV0c1Jlc291cmNlLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElUcmVlSXRlbUNoZWNrYm94U3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENPTkZJR19ORVdfV0lORE9XX1BST0ZJTEUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCwgUmVzb3VyY2VTZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdPUktTUEFDRV9TVUZGSVggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcblxuZXhwb3J0IHR5cGUgQ2hhbmdlRXZlbnQgPSB7XG5cdHJlYWRvbmx5IG5hbWU/OiBib29sZWFuO1xuXHRyZWFkb25seSBpY29uPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZmxhZ3M/OiBib29sZWFuO1xuXHRyZWFkb25seSB3b3Jrc3BhY2VzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWN0aXZlPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgbWVzc2FnZT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvcHlGcm9tPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29weUZyb21JbmZvPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29weUZsYWdzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgcHJldmlldz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHByb2ZpbGU/OiBib29sZWFuO1xuXHRyZWFkb25seSBleHRlbnNpb25zPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc25pcHBldHM/OiBib29sZWFuO1xuXHRyZWFkb25seSBkaXNhYmxlZD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG5ld1dpbmRvd1Byb2ZpbGU/OiBib29sZWFuO1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBJUHJvZmlsZUNoaWxkRWxlbWVudCB7XG5cdHJlYWRvbmx5IGhhbmRsZTogc3RyaW5nO1xuXHRyZWFkb25seSBvcGVuQWN0aW9uPzogSUFjdGlvbjtcblx0cmVhZG9ubHkgYWN0aW9ucz86IHtcblx0XHRyZWFkb25seSBwcmltYXJ5PzogSUFjdGlvbltdO1xuXHRcdHJlYWRvbmx5IGNvbnRleHRNZW51PzogSUFjdGlvbltdO1xuXHR9O1xuXHRyZWFkb25seSBjaGVja2JveD86IElUcmVlSXRlbUNoZWNrYm94U3RhdGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50IGV4dGVuZHMgSVByb2ZpbGVDaGlsZEVsZW1lbnQge1xuXHRyZWFkb25seSByZXNvdXJjZVR5cGU6IFByb2ZpbGVSZXNvdXJjZVR5cGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2ZpbGVSZXNvdXJjZVR5cGVDaGlsZEVsZW1lbnQgZXh0ZW5kcyBJUHJvZmlsZUNoaWxkRWxlbWVudCB7XG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSByZXNvdXJjZT86IFVSSTtcblx0cmVhZG9ubHkgaWNvbj86IFRoZW1lSWNvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQoZWxlbWVudDogSVByb2ZpbGVDaGlsZEVsZW1lbnQpOiBlbGVtZW50IGlzIElQcm9maWxlUmVzb3VyY2VUeXBlRWxlbWVudCB7XG5cdHJldHVybiAoZWxlbWVudCBhcyBJUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQpLnJlc291cmNlVHlwZSAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9maWxlUmVzb3VyY2VDaGlsZEVsZW1lbnQoZWxlbWVudDogSVByb2ZpbGVDaGlsZEVsZW1lbnQpOiBlbGVtZW50IGlzIElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50IHtcblx0cmV0dXJuIChlbGVtZW50IGFzIElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50KS5sYWJlbCAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPENoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNhdmVTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmRvU2F2ZSgpLCA1MDApKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRuYW1lOiBzdHJpbmcsXG5cdFx0aWNvbjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdGZsYWdzOiBVc2VEZWZhdWx0UHJvZmlsZUZsYWdzIHwgdW5kZWZpbmVkLFxuXHRcdHdvcmtzcGFjZXM6IHJlYWRvbmx5IFVSSVtdIHwgdW5kZWZpbmVkLFxuXHRcdGlzQWN0aXZlOiBib29sZWFuLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX25hbWUgPSBuYW1lO1xuXHRcdHRoaXMuX2ljb24gPSBpY29uO1xuXHRcdHRoaXMuX2ZsYWdzID0gZmxhZ3M7XG5cdFx0dGhpcy5fd29ya3NwYWNlcyA9IHdvcmtzcGFjZXM7XG5cdFx0dGhpcy5fYWN0aXZlID0gaXNBY3RpdmU7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmICghZS5tZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGUoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2F2ZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uUHJvZmlsZUF3YXJlRGlkSW5zdGFsbEV4dGVuc2lvbnMocmVzdWx0cyA9PiB7XG5cdFx0XHRjb25zdCBwcm9maWxlID0gdGhpcy5nZXRQcm9maWxlVG9XYXRjaCgpO1xuXHRcdFx0aWYgKHByb2ZpbGUgJiYgcmVzdWx0cy5zb21lKHIgPT4gIXIuZXJyb3IgJiYgKHIuYXBwbGljYXRpb25TY29wZWQgfHwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoci5wcm9maWxlTG9jYXRpb24sIHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKSkpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBleHRlbnNpb25zOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uUHJvZmlsZUF3YXJlRGlkVW5pbnN0YWxsRXh0ZW5zaW9uKGUgPT4ge1xuXHRcdFx0Y29uc3QgcHJvZmlsZSA9IHRoaXMuZ2V0UHJvZmlsZVRvV2F0Y2goKTtcblx0XHRcdGlmIChwcm9maWxlICYmICFlLmVycm9yICYmIChlLmFwcGxpY2F0aW9uU2NvcGVkIHx8IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGUucHJvZmlsZUxvY2F0aW9uLCBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSkpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBleHRlbnNpb25zOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uUHJvZmlsZUF3YXJlRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEoZSA9PiB7XG5cdFx0XHRjb25zdCBwcm9maWxlID0gdGhpcy5nZXRQcm9maWxlVG9XYXRjaCgpO1xuXHRcdFx0aWYgKHByb2ZpbGUgJiYgZS5sb2NhbC5pc0FwcGxpY2F0aW9uU2NvcGVkIHx8IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGUucHJvZmlsZUxvY2F0aW9uLCBwcm9maWxlPy5leHRlbnNpb25zUmVzb3VyY2UpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBleHRlbnNpb25zOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX25hbWUgPSAnJztcblx0Z2V0IG5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX25hbWU7IH1cblx0c2V0IG5hbWUobmFtZTogc3RyaW5nKSB7XG5cdFx0bmFtZSA9IG5hbWUudHJpbSgpO1xuXHRcdGlmICh0aGlzLl9uYW1lICE9PSBuYW1lKSB7XG5cdFx0XHR0aGlzLl9uYW1lID0gbmFtZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBuYW1lOiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ljb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IGljb24oKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2ljb247IH1cblx0c2V0IGljb24oaWNvbjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX2ljb24gIT09IGljb24pIHtcblx0XHRcdHRoaXMuX2ljb24gPSBpY29uO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGljb246IHRydWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfd29ya3NwYWNlczogcmVhZG9ubHkgVVJJW10gfCB1bmRlZmluZWQ7XG5cdGdldCB3b3Jrc3BhY2VzKCk6IHJlYWRvbmx5IFVSSVtdIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3dvcmtzcGFjZXM7IH1cblx0c2V0IHdvcmtzcGFjZXMod29ya3NwYWNlczogcmVhZG9ubHkgVVJJW10gfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoIWFycmF5cy5lcXVhbHModGhpcy5fd29ya3NwYWNlcywgd29ya3NwYWNlcywgKGEsIGIpID0+IGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpKSkge1xuXHRcdFx0dGhpcy5fd29ya3NwYWNlcyA9IHdvcmtzcGFjZXM7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgd29ya3NwYWNlczogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9mbGFnczogVXNlRGVmYXVsdFByb2ZpbGVGbGFncyB8IHVuZGVmaW5lZDtcblx0Z2V0IGZsYWdzKCk6IFVzZURlZmF1bHRQcm9maWxlRmxhZ3MgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fZmxhZ3M7IH1cblx0c2V0IGZsYWdzKGZsYWdzOiBVc2VEZWZhdWx0UHJvZmlsZUZsYWdzIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKCFlcXVhbHModGhpcy5fZmxhZ3MsIGZsYWdzKSkge1xuXHRcdFx0dGhpcy5fZmxhZ3MgPSBmbGFncztcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBmbGFnczogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hY3RpdmU6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGFjdGl2ZSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZTsgfVxuXHRzZXQgYWN0aXZlKGFjdGl2ZTogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9hY3RpdmUgIT09IGFjdGl2ZSkge1xuXHRcdFx0dGhpcy5fYWN0aXZlID0gYWN0aXZlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9tZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldCBtZXNzYWdlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9tZXNzYWdlOyB9XG5cdHNldCBtZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLl9tZXNzYWdlICE9PSBtZXNzYWdlKSB7XG5cdFx0XHR0aGlzLl9tZXNzYWdlID0gbWVzc2FnZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBtZXNzYWdlOiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2Rpc2FibGVkOiBib29sZWFuID0gZmFsc2U7XG5cdGdldCBkaXNhYmxlZCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2Rpc2FibGVkOyB9XG5cdHNldCBkaXNhYmxlZChzYXZpbmc6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fZGlzYWJsZWQgIT09IHNhdmluZykge1xuXHRcdFx0dGhpcy5fZGlzYWJsZWQgPSBzYXZpbmc7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgZGlzYWJsZWQ6IHRydWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0RmxhZyhrZXk6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5mbGFncz8uW2tleV0gPz8gZmFsc2U7XG5cdH1cblxuXHRzZXRGbGFnKGtleTogUHJvZmlsZVJlc291cmNlVHlwZSwgdmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBmbGFncyA9IHRoaXMuZmxhZ3MgPyB7IC4uLnRoaXMuZmxhZ3MgfSA6IHt9O1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0ZmxhZ3Nba2V5XSA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlbGV0ZSBmbGFnc1trZXldO1xuXHRcdH1cblx0XHR0aGlzLmZsYWdzID0gZmxhZ3M7XG5cdH1cblxuXHR2YWxpZGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubmFtZSkge1xuXHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ25hbWUgcmVxdWlyZWQnLCBcIlByb2ZpbGUgbmFtZSBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIG5vbi1lbXB0eSB2YWx1ZS5cIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLnNob3VsZFZhbGlkYXRlTmFtZSgpICYmIHRoaXMubmFtZSAhPT0gdGhpcy5nZXRJbml0aWFsTmFtZSgpICYmIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuc29tZShwID0+IHAubmFtZSA9PT0gdGhpcy5uYW1lKSkge1xuXHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ3Byb2ZpbGVFeGlzdHMnLCBcIlByb2ZpbGUgd2l0aCBuYW1lIHswfSBhbHJlYWR5IGV4aXN0cy5cIiwgdGhpcy5uYW1lKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5mbGFncyAmJiB0aGlzLmZsYWdzLnNldHRpbmdzICYmIHRoaXMuZmxhZ3Mua2V5YmluZGluZ3MgJiYgdGhpcy5mbGFncy50YXNrcyAmJiB0aGlzLmZsYWdzLnNuaXBwZXRzICYmIHRoaXMuZmxhZ3MuZXh0ZW5zaW9uc1xuXHRcdCkge1xuXHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ2ludmFsaWQgY29uZmlndXJhdGlvbnMnLCBcIlRoZSBwcm9maWxlIHNob3VsZCBjb250YWluIGF0IGxlYXN0IG9uZSBjb25maWd1cmF0aW9uLlwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5tZXNzYWdlID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgZ2V0Q2hpbGRyZW4ocmVzb3VyY2VUeXBlPzogUHJvZmlsZVJlc291cmNlVHlwZSk6IFByb21pc2U8SVByb2ZpbGVDaGlsZEVsZW1lbnRbXT4ge1xuXHRcdGlmIChyZXNvdXJjZVR5cGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VUeXBlcyA9IFtcblx0XHRcdFx0UHJvZmlsZVJlc291cmNlVHlwZS5TZXR0aW5ncyxcblx0XHRcdFx0UHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5ncyxcblx0XHRcdFx0UHJvZmlsZVJlc291cmNlVHlwZS5UYXNrcyxcblx0XHRcdFx0UHJvZmlsZVJlc291cmNlVHlwZS5TbmlwcGV0cyxcblx0XHRcdFx0UHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zXG5cdFx0XHRdO1xuXHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKHJlc291cmNlVHlwZXMubWFwPFByb21pc2U8SVByb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50Pj4oYXN5bmMgciA9PiB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkcmVuID0gKHIgPT09IFByb2ZpbGVSZXNvdXJjZVR5cGUuU2V0dGluZ3Ncblx0XHRcdFx0XHR8fCByID09PSBQcm9maWxlUmVzb3VyY2VUeXBlLktleWJpbmRpbmdzXG5cdFx0XHRcdFx0fHwgciA9PT0gUHJvZmlsZVJlc291cmNlVHlwZS5UYXNrcykgPyBhd2FpdCB0aGlzLmdldENoaWxkcmVuRm9yUmVzb3VyY2VUeXBlKHIpIDogW107XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aGFuZGxlOiByLFxuXHRcdFx0XHRcdGNoZWNrYm94OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0cmVzb3VyY2VUeXBlOiByLFxuXHRcdFx0XHRcdG9wZW5BY3Rpb246IGNoaWxkcmVuLmxlbmd0aFxuXHRcdFx0XHRcdFx0PyB0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdGlkOiAnX29wZW4nLFxuXHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ29wZW4nLCBcIk9wZW4gdG8gdGhlIFNpZGVcIiksXG5cdFx0XHRcdFx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5nb1RvRmlsZSksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gY2hpbGRyZW5bMF0/Lm9wZW5BY3Rpb24/LnJ1bigpXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0OiB1bmRlZmluZWRcblx0XHRcdFx0fTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW5Gb3JSZXNvdXJjZVR5cGUocmVzb3VyY2VUeXBlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRDaGlsZHJlbkZvclJlc291cmNlVHlwZShyZXNvdXJjZVR5cGU6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBQcm9taXNlPElQcm9maWxlQ2hpbGRFbGVtZW50W10+IHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0Q2hpbGRyZW5Gcm9tUHJvZmlsZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLCByZXNvdXJjZVR5cGU6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBQcm9taXNlPElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50W10+IHtcblx0XHRwcm9maWxlID0gdGhpcy5nZXRGbGFnKHJlc291cmNlVHlwZSkgPyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlIDogcHJvZmlsZTtcblx0XHRsZXQgY2hpbGRyZW46IElQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtW10gPSBbXTtcblx0XHRzd2l0Y2ggKHJlc291cmNlVHlwZSkge1xuXHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlNldHRpbmdzOlxuXHRcdFx0XHRjaGlsZHJlbiA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NSZXNvdXJjZVRyZWVJdGVtLCBwcm9maWxlKS5nZXRDaGlsZHJlbigpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5nczpcblx0XHRcdFx0Y2hpbGRyZW4gPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSwgcHJvZmlsZSkuZ2V0Q2hpbGRyZW4oKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuU25pcHBldHM6XG5cdFx0XHRcdGNoaWxkcmVuID0gKGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldHNSZXNvdXJjZVRyZWVJdGVtLCBwcm9maWxlKS5nZXRDaGlsZHJlbigpKSA/PyBbXTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuVGFza3M6XG5cdFx0XHRcdGNoaWxkcmVuID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXNrc1Jlc291cmNlVHJlZUl0ZW0sIHByb2ZpbGUpLmdldENoaWxkcmVuKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLkV4dGVuc2lvbnM6XG5cdFx0XHRcdGNoaWxkcmVuID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2VFeHBvcnRUcmVlSXRlbSwgcHJvZmlsZSkuZ2V0Q2hpbGRyZW4oKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiBjaGlsZHJlbi5tYXA8SVByb2ZpbGVSZXNvdXJjZVR5cGVDaGlsZEVsZW1lbnQ+KGNoaWxkID0+IHRoaXMudG9Vc2VyRGF0YVByb2ZpbGVSZXNvdXJjZUNoaWxkRWxlbWVudChjaGlsZCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHRvVXNlckRhdGFQcm9maWxlUmVzb3VyY2VDaGlsZEVsZW1lbnQoY2hpbGQ6IElQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtLCBwcmltYXJ5QWN0aW9ucz86IElBY3Rpb25bXSwgY29udGV4dE1lbnVBY3Rpb25zPzogSUFjdGlvbltdKTogSVByb2ZpbGVSZXNvdXJjZVR5cGVDaGlsZEVsZW1lbnQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRoYW5kbGU6IGNoaWxkLmhhbmRsZSxcblx0XHRcdGNoZWNrYm94OiBjaGlsZC5jaGVja2JveCxcblx0XHRcdGxhYmVsOiBjaGlsZC5sYWJlbD8ubGFiZWwgPz8gJycsXG5cdFx0XHRkZXNjcmlwdGlvbjogaXNTdHJpbmcoY2hpbGQuZGVzY3JpcHRpb24pID8gY2hpbGQuZGVzY3JpcHRpb24gOiB1bmRlZmluZWQsXG5cdFx0XHRyZXNvdXJjZTogVVJJLnJldml2ZShjaGlsZC5yZXNvdXJjZVVyaSksXG5cdFx0XHRpY29uOiBjaGlsZC50aGVtZUljb24sXG5cdFx0XHRvcGVuQWN0aW9uOiB0b0FjdGlvbih7XG5cdFx0XHRcdGlkOiAnX29wZW5DaGlsZCcsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3BlbicsIFwiT3BlbiB0byB0aGUgU2lkZVwiKSxcblx0XHRcdFx0Y2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmdvVG9GaWxlKSxcblx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNoaWxkLnBhcmVudC50eXBlID09PSBQcm9maWxlUmVzb3VyY2VUeXBlLkV4dGVuc2lvbnMpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2V4dGVuc2lvbi5vcGVuJywgY2hpbGQuaGFuZGxlLCB1bmRlZmluZWQsIHRydWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjaGlsZC5yZXNvdXJjZVVyaSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCwgY2hpbGQucmVzb3VyY2VVcmksIFtTSURFX0dST1VQXSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRwcmltYXJ5OiBwcmltYXJ5QWN0aW9ucyxcblx0XHRcdFx0Y29udGV4dE1lbnU6IGNvbnRleHRNZW51QWN0aW9ucyxcblx0XHRcdH1cblx0XHR9O1xuXG5cdH1cblxuXHRnZXRJbml0aWFsTmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHNob3VsZFZhbGlkYXRlTmFtZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGdldEN1cnJlbnRXb3Jrc3BhY2UoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdHJldHVybiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/PyB3b3Jrc3BhY2UuZm9sZGVyc1swXT8udXJpO1xuXHR9XG5cblx0b3BlbldvcmtzcGFjZSh3b3Jrc3BhY2U6IFVSSSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZXh0bmFtZSh3b3Jrc3BhY2UpID09PSBXT1JLU1BBQ0VfU1VGRklYKSB7XG5cdFx0XHR0aGlzLmhvc3RTZXJ2aWNlLm9wZW5XaW5kb3coW3sgd29ya3NwYWNlVXJpOiB3b3Jrc3BhY2UgfV0sIHsgZm9yY2VOZXdXaW5kb3c6IHRydWUgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyBmb2xkZXJVcmk6IHdvcmtzcGFjZSB9XSwgeyBmb3JjZU5ld1dpbmRvdzogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRzYXZlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2F2ZVNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYXNVbnNhdmVkQ2hhbmdlcyhwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMubmFtZSAhPT0gcHJvZmlsZS5uYW1lKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaWNvbiAhPT0gcHJvZmlsZS5pY29uKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFlcXVhbHModGhpcy5mbGFncyA/PyB7fSwgcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3MgPz8ge30pKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFhcnJheXMuZXF1YWxzKHRoaXMud29ya3NwYWNlcyA/PyBbXSwgcHJvZmlsZS53b3Jrc3BhY2VzID8/IFtdLCAoYSwgYikgPT4gYS50b1N0cmluZygpID09PSBiLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHNhdmVQcm9maWxlKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuaGFzVW5zYXZlZENoYW5nZXMocHJvZmlsZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy52YWxpZGF0ZSgpO1xuXHRcdGlmICh0aGlzLm1lc3NhZ2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdXNlRGVmYXVsdEZsYWdzOiBVc2VEZWZhdWx0UHJvZmlsZUZsYWdzIHwgdW5kZWZpbmVkID0gdGhpcy5mbGFnc1xuXHRcdFx0PyB0aGlzLmZsYWdzLnNldHRpbmdzICYmIHRoaXMuZmxhZ3Mua2V5YmluZGluZ3MgJiYgdGhpcy5mbGFncy50YXNrcyAmJiB0aGlzLmZsYWdzLmdsb2JhbFN0YXRlICYmIHRoaXMuZmxhZ3MuZXh0ZW5zaW9ucyA/IHVuZGVmaW5lZCA6IHRoaXMuZmxhZ3Ncblx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UudXBkYXRlUHJvZmlsZShwcm9maWxlLCB7XG5cdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRpY29uOiB0aGlzLmljb24sXG5cdFx0XHR1c2VEZWZhdWx0RmxhZ3M6IHByb2ZpbGUudXNlRGVmYXVsdEZsYWdzICYmICF1c2VEZWZhdWx0RmxhZ3MgPyB7fSA6IHVzZURlZmF1bHRGbGFncyxcblx0XHRcdHdvcmtzcGFjZXM6IHRoaXMud29ya3NwYWNlc1xuXHRcdH0pO1xuXHR9XG5cblx0YWJzdHJhY3QgcmVhZG9ubHkgdGl0bGVCdXR0b25zOiBbQWN0aW9uW10sIEFjdGlvbltdXTtcblx0YWJzdHJhY3QgcmVhZG9ubHkgYWN0aW9uczogW0lBY3Rpb25bXSwgSUFjdGlvbltdXTtcblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZG9TYXZlKCk6IFByb21pc2U8dm9pZD47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRQcm9maWxlVG9XYXRjaCgpOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlRWxlbWVudCBleHRlbmRzIEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCB7XG5cblx0Z2V0IHByb2ZpbGUoKTogSVVzZXJEYXRhUHJvZmlsZSB7IHJldHVybiB0aGlzLl9wcm9maWxlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSxcblx0XHRyZWFkb25seSB0aXRsZUJ1dHRvbnM6IFtBY3Rpb25bXSwgQWN0aW9uW11dLFxuXHRcdHJlYWRvbmx5IGFjdGlvbnM6IFtJQWN0aW9uW10sIElBY3Rpb25bXV0sXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSB1c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0X3Byb2ZpbGUubmFtZSxcblx0XHRcdF9wcm9maWxlLmljb24sXG5cdFx0XHRfcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3MsXG5cdFx0XHRfcHJvZmlsZS53b3Jrc3BhY2VzLFxuXHRcdFx0dXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pZCA9PT0gX3Byb2ZpbGUuaWQsXG5cdFx0XHR1c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRcdHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdFx0Y29tbWFuZFNlcnZpY2UsXG5cdFx0XHR3b3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRcdGhvc3RTZXJ2aWNlLFxuXHRcdFx0dXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdCk7XG5cdFx0dGhpcy5faXNOZXdXaW5kb3dQcm9maWxlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShDT05GSUdfTkVXX1dJTkRPV19QUk9GSUxFKSA9PT0gdGhpcy5wcm9maWxlLm5hbWU7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQ09ORklHX05FV19XSU5ET1dfUFJPRklMRSkpIHtcblx0XHRcdFx0dGhpcy5pc05ld1dpbmRvd1Byb2ZpbGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKENPTkZJR19ORVdfV0lORE9XX1BST0ZJTEUpID09PSB0aGlzLnByb2ZpbGUubmFtZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQ3VycmVudFByb2ZpbGUoKCkgPT4gdGhpcy5hY3RpdmUgPSB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWQgPT09IHRoaXMucHJvZmlsZS5pZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2Uub25EaWRDaGFuZ2VQcm9maWxlcygoeyB1cGRhdGVkIH0pID0+IHtcblx0XHRcdGNvbnN0IHByb2ZpbGUgPSB1cGRhdGVkLmZpbmQocCA9PiBwLmlkID09PSB0aGlzLnByb2ZpbGUuaWQpO1xuXHRcdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy5fcHJvZmlsZSA9IHByb2ZpbGU7XG5cdFx0XHRcdHRoaXMucmVzZXQoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IHByb2ZpbGU6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZpbGVTZXJ2aWNlLndhdGNoKHRoaXMucHJvZmlsZS5zbmlwcGV0c0hvbWUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihmaWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0cyh0aGlzLnByb2ZpbGUuc25pcHBldHNIb21lKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgc25pcHBldHM6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldFByb2ZpbGVUb1dhdGNoKCk6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnByb2ZpbGU7XG5cdH1cblxuXHRyZXNldCgpOiB2b2lkIHtcblx0XHR0aGlzLm5hbWUgPSB0aGlzLl9wcm9maWxlLm5hbWU7XG5cdFx0dGhpcy5pY29uID0gdGhpcy5fcHJvZmlsZS5pY29uO1xuXHRcdHRoaXMuZmxhZ3MgPSB0aGlzLl9wcm9maWxlLnVzZURlZmF1bHRGbGFncztcblx0XHR0aGlzLndvcmtzcGFjZXMgPSB0aGlzLl9wcm9maWxlLndvcmtzcGFjZXM7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlV29ya3NwYWNlcyh0b0FkZDogVVJJW10sIHRvUmVtb3ZlOiBVUklbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHdvcmtzcGFjZXMgPSBuZXcgUmVzb3VyY2VTZXQodGhpcy53b3Jrc3BhY2VzID8/IFtdKTtcblx0XHRmb3IgKGNvbnN0IHdvcmtzcGFjZSBvZiB0b0FkZCkge1xuXHRcdFx0d29ya3NwYWNlcy5hZGQod29ya3NwYWNlKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2Ugb2YgdG9SZW1vdmUpIHtcblx0XHRcdHdvcmtzcGFjZXMuZGVsZXRlKHdvcmtzcGFjZSk7XG5cdFx0fVxuXHRcdHRoaXMud29ya3NwYWNlcyA9IFsuLi53b3Jrc3BhY2VzLnZhbHVlcygpXTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB0b2dnbGVOZXdXaW5kb3dQcm9maWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9pc05ld1dpbmRvd1Byb2ZpbGUpIHtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoQ09ORklHX05FV19XSU5ET1dfUFJPRklMRSwgbnVsbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoQ09ORklHX05FV19XSU5ET1dfUFJPRklMRSwgdGhpcy5wcm9maWxlLm5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2lzTmV3V2luZG93UHJvZmlsZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgaXNOZXdXaW5kb3dQcm9maWxlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5faXNOZXdXaW5kb3dQcm9maWxlOyB9XG5cdHNldCBpc05ld1dpbmRvd1Byb2ZpbGUoaXNOZXdXaW5kb3dQcm9maWxlOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX2lzTmV3V2luZG93UHJvZmlsZSAhPT0gaXNOZXdXaW5kb3dQcm9maWxlKSB7XG5cdFx0XHR0aGlzLl9pc05ld1dpbmRvd1Byb2ZpbGUgPSBpc05ld1dpbmRvd1Byb2ZpbGU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgbmV3V2luZG93UHJvZmlsZTogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdG9nZ2xlQ3VycmVudFdpbmRvd1Byb2ZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pZCA9PT0gdGhpcy5wcm9maWxlLmlkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLnN3aXRjaFByb2ZpbGUodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2Uuc3dpdGNoUHJvZmlsZSh0aGlzLnByb2ZpbGUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBkb1NhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlUHJvZmlsZSh0aGlzLnByb2ZpbGUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGdldENoaWxkcmVuRm9yUmVzb3VyY2VUeXBlKHJlc291cmNlVHlwZTogUHJvZmlsZVJlc291cmNlVHlwZSk6IFByb21pc2U8SVByb2ZpbGVDaGlsZEVsZW1lbnRbXT4ge1xuXHRcdGlmIChyZXNvdXJjZVR5cGUgPT09IFByb2ZpbGVSZXNvdXJjZVR5cGUuRXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNSZXNvdXJjZUV4cG9ydFRyZWVJdGVtLCB0aGlzLnByb2ZpbGUpLmdldENoaWxkcmVuKCk7XG5cdFx0XHRyZXR1cm4gY2hpbGRyZW4ubWFwPElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50PihjaGlsZCA9PlxuXHRcdFx0XHR0aGlzLnRvVXNlckRhdGFQcm9maWxlUmVzb3VyY2VDaGlsZEVsZW1lbnQoXG5cdFx0XHRcdFx0Y2hpbGQsXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRpZDogJ2FwcGx5VG9BbGxQcm9maWxlcycsXG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2FwcGx5VG9BbGxQcm9maWxlcycsIFwiQXBwbHkgRXh0ZW5zaW9uIHRvIGFsbCBQcm9maWxlc1wiKSxcblx0XHRcdFx0XHRcdGNoZWNrZWQ6IGNoaWxkLmFwcGxpY2F0aW9uU2NvcGVkLFxuXHRcdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdGNsYXNzOiAnJyxcblx0XHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCh1bmRlZmluZWQsIHRoaXMucHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBleHRlbnNpb25zLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGNoaWxkLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudG9nZ2xlQXBwbGlhdGlvblNjb3BlKGV4dGVuc2lvbiwgdGhpcy5wcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHQpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW5Gcm9tUHJvZmlsZSh0aGlzLnByb2ZpbGUsIHJlc291cmNlVHlwZSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRJbml0aWFsTmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnByb2ZpbGUubmFtZTtcblx0fVxuXG59XG5cbmNvbnN0IFVTRVJfREFUQV9QUk9GSUxFX1RFTVBMQVRFX1BSRVZJRVdfU0NIRU1FID0gJ3VzZXJkYXRhcHJvZmlsZXRlbXBsYXRlcHJldmlldyc7XG5cbmV4cG9ydCBjbGFzcyBOZXdQcm9maWxlRWxlbWVudCBleHRlbmRzIEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCB7XG5cblx0cHJpdmF0ZSBfY29weUZyb21UZW1wbGF0ZXMgPSBuZXcgUmVzb3VyY2VNYXA8c3RyaW5nPigpO1xuXHRnZXQgY29weUZyb21UZW1wbGF0ZXMoKTogUmVzb3VyY2VNYXA8c3RyaW5nPiB7IHJldHVybiB0aGlzLl9jb3B5RnJvbVRlbXBsYXRlczsgfVxuXG5cdHByaXZhdGUgdGVtcGxhdGVQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0ZW1wbGF0ZTogSVVzZXJEYXRhUHJvZmlsZVRlbXBsYXRlIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSBkZWZhdWx0TmFtZTogc3RyaW5nO1xuXHRwcml2YXRlIGRlZmF1bHRJY29uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bmFtZTogc3RyaW5nLFxuXHRcdGNvcHlGcm9tOiBVUkkgfCBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkLFxuXHRcdHJlYWRvbmx5IHRpdGxlQnV0dG9uczogW0FjdGlvbltdLCBBY3Rpb25bXV0sXG5cdFx0cmVhZG9ubHkgYWN0aW9uczogW0lBY3Rpb25bXSwgSUFjdGlvbltdXSxcblxuXHRcdEBJVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UgdXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdG5hbWUsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdFx0dXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0XHRjb21tYW5kU2VydmljZSxcblx0XHRcdHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdFx0aG9zdFNlcnZpY2UsXG5cdFx0XHR1cmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0XHRmaWxlU2VydmljZSxcblx0XHRcdGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0KTtcblx0XHR0aGlzLmRlZmF1bHROYW1lID0gbmFtZTtcblx0XHR0aGlzLl9jb3B5RnJvbSA9IGNvcHlGcm9tO1xuXHRcdHRoaXMuX2NvcHlGbGFncyA9IHRoaXMuZ2V0Q29weUZsYWdzRnJvbShjb3B5RnJvbSk7XG5cdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFVTRVJfREFUQV9QUk9GSUxFX1RFTVBMQVRFX1BSRVZJRVdfU0NIRU1FLCB0aGlzLl9yZWdpc3RlcihuZXcgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMucHJldmlld1Byb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5yZW1vdmVQcm9maWxlKHRoaXMucHJldmlld1Byb2ZpbGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvcHlGcm9tOiBJVXNlckRhdGFQcm9maWxlIHwgVVJJIHwgdW5kZWZpbmVkO1xuXHRnZXQgY29weUZyb20oKTogSVVzZXJEYXRhUHJvZmlsZSB8IFVSSSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9jb3B5RnJvbTsgfVxuXHRzZXQgY29weUZyb20oY29weUZyb206IElVc2VyRGF0YVByb2ZpbGUgfCBVUkkgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fY29weUZyb20gIT09IGNvcHlGcm9tKSB7XG5cdFx0XHR0aGlzLl9jb3B5RnJvbSA9IGNvcHlGcm9tO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGNvcHlGcm9tOiB0cnVlIH0pO1xuXHRcdFx0dGhpcy5mbGFncyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuY29weUZsYWdzID0gdGhpcy5nZXRDb3B5RmxhZ3NGcm9tKGNvcHlGcm9tKTtcblx0XHRcdGlmIChjb3B5RnJvbSBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0XHR0aGlzLnRlbXBsYXRlUHJvbWlzZT8uY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMudGVtcGxhdGVQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY29weUZsYWdzOiBQcm9maWxlUmVzb3VyY2VUeXBlRmxhZ3MgfCB1bmRlZmluZWQ7XG5cdGdldCBjb3B5RmxhZ3MoKTogUHJvZmlsZVJlc291cmNlVHlwZUZsYWdzIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2NvcHlGbGFnczsgfVxuXHRzZXQgY29weUZsYWdzKGZsYWdzOiBQcm9maWxlUmVzb3VyY2VUeXBlRmxhZ3MgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoIWVxdWFscyh0aGlzLl9jb3B5RmxhZ3MsIGZsYWdzKSkge1xuXHRcdFx0dGhpcy5fY29weUZsYWdzID0gZmxhZ3M7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgY29weUZsYWdzOiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJldmlld1Byb2ZpbGVXYXRjaERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfcHJldmlld1Byb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQ7XG5cdGdldCBwcmV2aWV3UHJvZmlsZSgpOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3ByZXZpZXdQcm9maWxlOyB9XG5cdHNldCBwcmV2aWV3UHJvZmlsZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX3ByZXZpZXdQcm9maWxlICE9PSBwcm9maWxlKSB7XG5cdFx0XHR0aGlzLl9wcmV2aWV3UHJvZmlsZSA9IHByb2ZpbGU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgcHJldmlldzogdHJ1ZSB9KTtcblx0XHRcdHRoaXMucHJldmlld1Byb2ZpbGVXYXRjaERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRpZiAodGhpcy5fcHJldmlld1Byb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy5wcmV2aWV3UHJvZmlsZVdhdGNoRGlzcG9zYWJsZXMuYWRkKHRoaXMuZmlsZVNlcnZpY2Uud2F0Y2godGhpcy5fcHJldmlld1Byb2ZpbGUuc25pcHBldHNIb21lKSk7XG5cdFx0XHRcdHRoaXMucHJldmlld1Byb2ZpbGVXYXRjaERpc3Bvc2FibGVzLmFkZCh0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl9wcmV2aWV3UHJvZmlsZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZS5hZmZlY3RzKHRoaXMuX3ByZXZpZXdQcm9maWxlLnNuaXBwZXRzSG9tZSkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBzbmlwcGV0czogdHJ1ZSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0UHJvZmlsZVRvV2F0Y2goKTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucHJldmlld1Byb2ZpbGU7XG5cdH1cblxuXHRwcml2YXRlIGdldENvcHlGbGFnc0Zyb20oY29weUZyb206IFVSSSB8IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQpOiBQcm9maWxlUmVzb3VyY2VUeXBlRmxhZ3MgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBjb3B5RnJvbSA/IHtcblx0XHRcdHNldHRpbmdzOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZ3M6IHRydWUsXG5cdFx0XHRzbmlwcGV0czogdHJ1ZSxcblx0XHRcdHRhc2tzOiB0cnVlLFxuXHRcdFx0ZXh0ZW5zaW9uczogdHJ1ZVxuXHRcdH0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0aGlzLmNvcHlGcm9tIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucmVzb2x2ZVRlbXBsYXRlKHRoaXMuY29weUZyb20pO1xuXHRcdFx0XHRpZiAodGhpcy50ZW1wbGF0ZSkge1xuXHRcdFx0XHRcdHRoaXMuY29weUZyb21UZW1wbGF0ZXMuc2V0KHRoaXMuY29weUZyb20sIHRoaXMudGVtcGxhdGUubmFtZSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZGVmYXVsdE5hbWUgPT09IHRoaXMubmFtZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5uYW1lID0gdGhpcy5kZWZhdWx0TmFtZSA9IHRoaXMudGVtcGxhdGUubmFtZSA/PyAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoaXMuZGVmYXVsdEljb24gPT09IHRoaXMuaWNvbikge1xuXHRcdFx0XHRcdFx0dGhpcy5pY29uID0gdGhpcy5kZWZhdWx0SWNvbiA9IHRoaXMudGVtcGxhdGUuaWNvbjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5zZXRDb3B5RmxhZyhQcm9maWxlUmVzb3VyY2VUeXBlLlNldHRpbmdzLCAhIXRoaXMudGVtcGxhdGUuc2V0dGluZ3MpO1xuXHRcdFx0XHRcdHRoaXMuc2V0Q29weUZsYWcoUHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5ncywgISF0aGlzLnRlbXBsYXRlLmtleWJpbmRpbmdzKTtcblx0XHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuVGFza3MsICEhdGhpcy50ZW1wbGF0ZS50YXNrcyk7XG5cdFx0XHRcdFx0dGhpcy5zZXRDb3B5RmxhZyhQcm9maWxlUmVzb3VyY2VUeXBlLlNuaXBwZXRzLCAhIXRoaXMudGVtcGxhdGUuc25pcHBldHMpO1xuXHRcdFx0XHRcdHRoaXMuc2V0Q29weUZsYWcoUHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zLCAhIXRoaXMudGVtcGxhdGUuZXh0ZW5zaW9ucyk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGNvcHlGcm9tSW5mbzogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc1VzZXJEYXRhUHJvZmlsZSh0aGlzLmNvcHlGcm9tKSkge1xuXHRcdFx0XHRpZiAodGhpcy5kZWZhdWx0TmFtZSA9PT0gdGhpcy5uYW1lKSB7XG5cdFx0XHRcdFx0dGhpcy5uYW1lID0gdGhpcy5kZWZhdWx0TmFtZSA9IGxvY2FsaXplKCdjb3B5IGZyb20nLCBcInswfSAoQ29weSlcIiwgdGhpcy5jb3B5RnJvbS5uYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5kZWZhdWx0SWNvbiA9PT0gdGhpcy5pY29uKSB7XG5cdFx0XHRcdFx0dGhpcy5pY29uID0gdGhpcy5kZWZhdWx0SWNvbiA9IHRoaXMuY29weUZyb20uaWNvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuU2V0dGluZ3MsIHRydWUpO1xuXHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuS2V5YmluZGluZ3MsIHRydWUpO1xuXHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuVGFza3MsIHRydWUpO1xuXHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuU25pcHBldHMsIHRydWUpO1xuXHRcdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuRXh0ZW5zaW9ucywgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBjb3B5RnJvbUluZm86IHRydWUgfSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZGVmYXVsdE5hbWUgPT09IHRoaXMubmFtZSkge1xuXHRcdFx0XHR0aGlzLm5hbWUgPSB0aGlzLmRlZmF1bHROYW1lID0gbG9jYWxpemUoJ3VudGl0bGVkJywgXCJVbnRpdGxlZFwiKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmRlZmF1bHRJY29uID09PSB0aGlzLmljb24pIHtcblx0XHRcdFx0dGhpcy5pY29uID0gdGhpcy5kZWZhdWx0SWNvbiA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2V0Q29weUZsYWcoUHJvZmlsZVJlc291cmNlVHlwZS5TZXR0aW5ncywgZmFsc2UpO1xuXHRcdFx0dGhpcy5zZXRDb3B5RmxhZyhQcm9maWxlUmVzb3VyY2VUeXBlLktleWJpbmRpbmdzLCBmYWxzZSk7XG5cdFx0XHR0aGlzLnNldENvcHlGbGFnKFByb2ZpbGVSZXNvdXJjZVR5cGUuVGFza3MsIGZhbHNlKTtcblx0XHRcdHRoaXMuc2V0Q29weUZsYWcoUHJvZmlsZVJlc291cmNlVHlwZS5TbmlwcGV0cywgZmFsc2UpO1xuXHRcdFx0dGhpcy5zZXRDb3B5RmxhZyhQcm9maWxlUmVzb3VyY2VUeXBlLkV4dGVuc2lvbnMsIGZhbHNlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBjb3B5RnJvbUluZm86IHRydWUgfSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXNvbHZlVGVtcGxhdGUodXJpOiBVUkkpOiBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSB8IG51bGw+IHtcblx0XHRpZiAoIXRoaXMudGVtcGxhdGVQcm9taXNlKSB7XG5cdFx0XHR0aGlzLnRlbXBsYXRlUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIHRva2VuID0+IHtcblx0XHRcdFx0Y29uc3QgdGVtcGxhdGUgPSBhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UucmVzb2x2ZVByb2ZpbGVUZW1wbGF0ZSh1cmkpO1xuXHRcdFx0XHRpZiAoIXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0dGhpcy50ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0YXdhaXQgdGhpcy50ZW1wbGF0ZVByb21pc2U7XG5cdFx0cmV0dXJuIHRoaXMudGVtcGxhdGU7XG5cdH1cblxuXHRoYXNSZXNvdXJjZShyZXNvdXJjZVR5cGU6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy50ZW1wbGF0ZSkge1xuXHRcdFx0c3dpdGNoIChyZXNvdXJjZVR5cGUpIHtcblx0XHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlNldHRpbmdzOlxuXHRcdFx0XHRcdHJldHVybiAhIXRoaXMudGVtcGxhdGUuc2V0dGluZ3M7XG5cdFx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5nczpcblx0XHRcdFx0XHRyZXR1cm4gISF0aGlzLnRlbXBsYXRlLmtleWJpbmRpbmdzO1xuXHRcdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuU25pcHBldHM6XG5cdFx0XHRcdFx0cmV0dXJuICEhdGhpcy50ZW1wbGF0ZS5zbmlwcGV0cztcblx0XHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlRhc2tzOlxuXHRcdFx0XHRcdHJldHVybiAhIXRoaXMudGVtcGxhdGUudGFza3M7XG5cdFx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zOlxuXHRcdFx0XHRcdHJldHVybiAhIXRoaXMudGVtcGxhdGUuZXh0ZW5zaW9ucztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRnZXRDb3B5RmxhZyhrZXk6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb3B5RmxhZ3M/LltrZXldID8/IGZhbHNlO1xuXHR9XG5cblx0c2V0Q29weUZsYWcoa2V5OiBQcm9maWxlUmVzb3VyY2VUeXBlLCB2YWx1ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGZsYWdzID0gdGhpcy5jb3B5RmxhZ3MgPyB7IC4uLnRoaXMuY29weUZsYWdzIH0gOiB7fTtcblx0XHRmbGFnc1trZXldID0gdmFsdWU7XG5cdFx0dGhpcy5jb3B5RmxhZ3MgPSBmbGFncztcblx0fVxuXG5cdGdldENvcHlGcm9tTmFtZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmIChpc1VzZXJEYXRhUHJvZmlsZSh0aGlzLmNvcHlGcm9tKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29weUZyb20ubmFtZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29weUZyb20gaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdHJldHVybiB0aGlzLmNvcHlGcm9tVGVtcGxhdGVzLmdldCh0aGlzLmNvcHlGcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBnZXRDaGlsZHJlbkZvclJlc291cmNlVHlwZShyZXNvdXJjZVR5cGU6IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBQcm9taXNlPElQcm9maWxlQ2hpbGRFbGVtZW50W10+IHtcblx0XHRpZiAodGhpcy5nZXRGbGFnKHJlc291cmNlVHlwZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldENoaWxkcmVuRnJvbVByb2ZpbGUodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSwgcmVzb3VyY2VUeXBlKTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmdldENvcHlGbGFnKHJlc291cmNlVHlwZSkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0aWYgKHRoaXMucHJldmlld1Byb2ZpbGUpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldENoaWxkcmVuRnJvbVByb2ZpbGUodGhpcy5wcmV2aWV3UHJvZmlsZSwgcmVzb3VyY2VUeXBlKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29weUZyb20gaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdGF3YWl0IHRoaXMucmVzb2x2ZVRlbXBsYXRlKHRoaXMuY29weUZyb20pO1xuXHRcdFx0aWYgKCF0aGlzLnRlbXBsYXRlKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLmdldENoaWxkcmVuRnJvbVByb2ZpbGVUZW1wbGF0ZSh0aGlzLnRlbXBsYXRlLCByZXNvdXJjZVR5cGUpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5jb3B5RnJvbSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW5Gcm9tUHJvZmlsZSh0aGlzLmNvcHlGcm9tLCByZXNvdXJjZVR5cGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldENoaWxkcmVuRnJvbVByb2ZpbGVUZW1wbGF0ZShwcm9maWxlVGVtcGxhdGU6IElVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSwgcmVzb3VyY2VUeXBlOiBQcm9maWxlUmVzb3VyY2VUeXBlKTogUHJvbWlzZTxJUHJvZmlsZVJlc291cmNlVHlwZUNoaWxkRWxlbWVudFtdPiB7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSBVUkkuZnJvbSh7IHNjaGVtZTogVVNFUl9EQVRBX1BST0ZJTEVfVEVNUExBVEVfUFJFVklFV19TQ0hFTUUsIHBhdGg6IGAvcm9vdC9wcm9maWxlcy8ke3Byb2ZpbGVUZW1wbGF0ZS5uYW1lfWAgfSk7XG5cdFx0Y29uc3QgY2FjaGVMb2NhdGlvbiA9IFVSSS5mcm9tKHsgc2NoZW1lOiBVU0VSX0RBVEFfUFJPRklMRV9URU1QTEFURV9QUkVWSUVXX1NDSEVNRSwgcGF0aDogYC9yb290L2NhY2hlLyR7cHJvZmlsZVRlbXBsYXRlLm5hbWV9YCB9KTtcblx0XHRjb25zdCBwcm9maWxlID0gdG9Vc2VyRGF0YVByb2ZpbGUoZ2VuZXJhdGVVdWlkKCksIHRoaXMubmFtZSwgbG9jYXRpb24sIGNhY2hlTG9jYXRpb24pO1xuXHRcdHN3aXRjaCAocmVzb3VyY2VUeXBlKSB7XG5cdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuU2V0dGluZ3M6XG5cdFx0XHRcdGlmIChwcm9maWxlVGVtcGxhdGUuc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5zZXR0aW5ncywgcHJvZmlsZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW5Gcm9tUHJvZmlsZShwcm9maWxlLCByZXNvdXJjZVR5cGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5nczpcblx0XHRcdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5rZXliaW5kaW5ncykge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoS2V5YmluZGluZ3NSZXNvdXJjZSkuYXBwbHkocHJvZmlsZVRlbXBsYXRlLmtleWJpbmRpbmdzLCBwcm9maWxlKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRDaGlsZHJlbkZyb21Qcm9maWxlKHByb2ZpbGUsIHJlc291cmNlVHlwZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlNuaXBwZXRzOlxuXHRcdFx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLnNuaXBwZXRzKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0c1Jlc291cmNlKS5hcHBseShwcm9maWxlVGVtcGxhdGUuc25pcHBldHMsIHByb2ZpbGUpO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmdldENoaWxkcmVuRnJvbVByb2ZpbGUocHJvZmlsZSwgcmVzb3VyY2VUeXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuVGFza3M6XG5cdFx0XHRcdGlmIChwcm9maWxlVGVtcGxhdGUudGFza3MpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRhc2tzUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS50YXNrcywgcHJvZmlsZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW5Gcm9tUHJvZmlsZShwcm9maWxlLCByZXNvdXJjZVR5cGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zOlxuXHRcdFx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLmV4dGVuc2lvbnMpIHtcblx0XHRcdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1Jlc291cmNlSW1wb3J0VHJlZUl0ZW0sIHByb2ZpbGVUZW1wbGF0ZS5leHRlbnNpb25zKS5nZXRDaGlsZHJlbigpO1xuXHRcdFx0XHRcdHJldHVybiBjaGlsZHJlbi5tYXAoY2hpbGQgPT4gdGhpcy50b1VzZXJEYXRhUHJvZmlsZVJlc291cmNlQ2hpbGRFbGVtZW50KGNoaWxkKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRvdmVycmlkZSBzaG91bGRWYWxpZGF0ZU5hbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmNvcHlGcm9tO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0SW5pdGlhbE5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5wcmV2aWV3UHJvZmlsZT8ubmFtZSA/PyAnJztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBkb1NhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMucHJldmlld1Byb2ZpbGUpIHtcblx0XHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCB0aGlzLnNhdmVQcm9maWxlKHRoaXMucHJldmlld1Byb2ZpbGUpO1xuXHRcdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy5wcmV2aWV3UHJvZmlsZSA9IHByb2ZpbGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwgZXh0ZW5kcyBFZGl0b3JNb2RlbCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgSU5TVEFOQ0U6IFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JNb2RlbCB8IHVuZGVmaW5lZDtcblx0c3RhdGljIGdldEluc3RhbmNlKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwge1xuXHRcdGlmICghVXNlckRhdGFQcm9maWxlc0VkaXRvck1vZGVsLklOU1RBTkNFKSB7XG5cdFx0XHRVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwuSU5TVEFOQ0UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwpO1xuXHRcdH1cblx0XHRyZXR1cm4gVXNlckRhdGFQcm9maWxlc0VkaXRvck1vZGVsLklOU1RBTkNFO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJvZmlsZXM6IFtBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIERpc3Bvc2FibGVTdG9yZV1bXSA9IFtdO1xuXHRnZXQgcHJvZmlsZXMoKTogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50W10ge1xuXHRcdHJldHVybiB0aGlzLl9wcm9maWxlc1xuXHRcdFx0Lm1hcCgoW3Byb2ZpbGVdKSA9PiBwcm9maWxlKVxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdFx0aWYgKGEgaW5zdGFuY2VvZiBOZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChiIGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGEgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIGEucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGIgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIGIucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBuZXdQcm9maWxlRWxlbWVudDogTmV3UHJvZmlsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQgfCB1bmRlZmluZWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgdGVtcGxhdGVzOiBQcm9taXNlPHJlYWRvbmx5IElQcm9maWxlVGVtcGxhdGVJbmZvW10+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcykge1xuXHRcdFx0aWYgKCFwcm9maWxlLmlzVHJhbnNpZW50KSB7XG5cdFx0XHRcdHRoaXMuX3Byb2ZpbGVzLnB1c2godGhpcy5jcmVhdGVQcm9maWxlRWxlbWVudChwcm9maWxlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9wcm9maWxlcy5zcGxpY2UoMCwgdGhpcy5fcHJvZmlsZXMubGVuZ3RoKS5tYXAoKFssIGRpc3Bvc2FibGVzXSkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZXMoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlUHJvZmlsZXMoZSkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VQcm9maWxlcyhlOiBEaWRDaGFuZ2VQcm9maWxlc0V2ZW50KTogdm9pZCB7XG5cdFx0bGV0IGNoYW5nZWQgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgZS5hZGRlZCkge1xuXHRcdFx0aWYgKCFwcm9maWxlLmlzVHJhbnNpZW50ICYmIHByb2ZpbGUubmFtZSAhPT0gdGhpcy5uZXdQcm9maWxlRWxlbWVudD8ubmFtZSkge1xuXHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fcHJvZmlsZXMucHVzaCh0aGlzLmNyZWF0ZVByb2ZpbGVFbGVtZW50KHByb2ZpbGUpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIGUucmVtb3ZlZCkge1xuXHRcdFx0aWYgKHByb2ZpbGUuaWQgPT09IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQ/LnByZXZpZXdQcm9maWxlPy5pZCkge1xuXHRcdFx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LnByZXZpZXdQcm9maWxlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9wcm9maWxlcy5maW5kSW5kZXgoKFtwXSkgPT4gcCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQgJiYgcC5wcm9maWxlLmlkID09PSBwcm9maWxlLmlkKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3Byb2ZpbGVzLnNwbGljZShpbmRleCwgMSkubWFwKChbLCBkaXNwb3NhYmxlc10pID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0VGVtcGxhdGVzKCk6IFByb21pc2U8cmVhZG9ubHkgSVByb2ZpbGVUZW1wbGF0ZUluZm9bXT4ge1xuXHRcdGlmICghdGhpcy50ZW1wbGF0ZXMpIHtcblx0XHRcdHRoaXMudGVtcGxhdGVzID0gdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5nZXRCdWlsdGluUHJvZmlsZVRlbXBsYXRlcygpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50ZW1wbGF0ZXM7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVByb2ZpbGVFbGVtZW50KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBbVXNlckRhdGFQcm9maWxlRWxlbWVudCwgRGlzcG9zYWJsZVN0b3JlXSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBhY3RpdmF0ZUFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0J3VzZXJEYXRhUHJvZmlsZS5hY3RpdmF0ZScsXG5cdFx0XHRsb2NhbGl6ZSgnYWN0aXZlJywgXCJVc2UgdGhpcyBQcm9maWxlIGZvciBDdXJyZW50IFdpbmRvd1wiKSxcblx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmNoZWNrKSxcblx0XHRcdHRydWUsXG5cdFx0XHQoKSA9PiB0aGlzLnVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLnN3aXRjaFByb2ZpbGUocHJvZmlsZUVsZW1lbnQucHJvZmlsZSlcblx0XHQpKTtcblxuXHRcdGNvbnN0IGNvcHlGcm9tUHJvZmlsZUFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0J3VzZXJEYXRhUHJvZmlsZS5jb3B5RnJvbVByb2ZpbGUnLFxuXHRcdFx0bG9jYWxpemUoJ2NvcHlGcm9tUHJvZmlsZScsIFwiRHVwbGljYXRlLi4uXCIpLFxuXHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uY29weSksXG5cdFx0XHR0cnVlLCAoKSA9PiB0aGlzLmNyZWF0ZU5ld1Byb2ZpbGUocHJvZmlsZUVsZW1lbnQucHJvZmlsZSlcblx0XHQpKTtcblxuXHRcdGNvbnN0IGV4cG9ydEFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0J3VzZXJEYXRhUHJvZmlsZS5leHBvcnQnLFxuXHRcdFx0bG9jYWxpemUoJ2V4cG9ydCcsIFwiRXhwb3J0Li4uXCIpLFxuXHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uZXhwb3J0KSxcblx0XHRcdHRydWUsXG5cdFx0XHQoKSA9PiB0aGlzLnVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UuZXhwb3J0UHJvZmlsZShwcm9maWxlKVxuXHRcdCkpO1xuXG5cdFx0Y29uc3QgZGVsZXRlQWN0aW9uID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb24oXG5cdFx0XHQndXNlckRhdGFQcm9maWxlLmRlbGV0ZScsXG5cdFx0XHRsb2NhbGl6ZSgnZGVsZXRlJywgXCJEZWxldGVcIiksXG5cdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi50cmFzaCksXG5cdFx0XHR0cnVlLFxuXHRcdFx0KCkgPT4gdGhpcy5yZW1vdmVQcm9maWxlKHByb2ZpbGVFbGVtZW50LnByb2ZpbGUpXG5cdFx0KSk7XG5cblx0XHRjb25zdCBuZXdXaW5kb3dBY3Rpb24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbihcblx0XHRcdCd1c2VyRGF0YVByb2ZpbGUubmV3V2luZG93Jyxcblx0XHRcdGxvY2FsaXplKCdvcGVuIG5ldyB3aW5kb3cnLCBcIk9wZW4gTmV3IFdpbmRvdyB3aXRoIHRoaXMgUHJvZmlsZVwiKSxcblx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmVtcHR5V2luZG93KSxcblx0XHRcdHRydWUsXG5cdFx0XHQoKSA9PiB0aGlzLm9wZW5XaW5kb3cocHJvZmlsZUVsZW1lbnQucHJvZmlsZSlcblx0XHQpKTtcblxuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKGFjdGl2YXRlQWN0aW9uKTtcblx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKG5ld1dpbmRvd0FjdGlvbik7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5QWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0c2Vjb25kYXJ5QWN0aW9ucy5wdXNoKGNvcHlGcm9tUHJvZmlsZUFjdGlvbik7XG5cdFx0c2Vjb25kYXJ5QWN0aW9ucy5wdXNoKGV4cG9ydEFjdGlvbik7XG5cdFx0aWYgKCFwcm9maWxlLmlzRGVmYXVsdCkge1xuXHRcdFx0c2Vjb25kYXJ5QWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRzZWNvbmRhcnlBY3Rpb25zLnB1c2goZGVsZXRlQWN0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9maWxlRWxlbWVudCA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsXG5cdFx0XHRwcm9maWxlLFxuXHRcdFx0W1tdLCBbXV0sXG5cdFx0XHRbcHJpbWFyeUFjdGlvbnMsIHNlY29uZGFyeUFjdGlvbnNdXG5cdFx0KSk7XG5cblx0XHRhY3RpdmF0ZUFjdGlvbi5lbmFibGVkID0gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlkICE9PSBwcm9maWxlRWxlbWVudC5wcm9maWxlLmlkO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZSgoKSA9PlxuXHRcdFx0YWN0aXZhdGVBY3Rpb24uZW5hYmxlZCA9IHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pZCAhPT0gcHJvZmlsZUVsZW1lbnQucHJvZmlsZS5pZCkpO1xuXG5cdFx0cmV0dXJuIFtwcm9maWxlRWxlbWVudCwgZGlzcG9zYWJsZXNdO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlTmV3UHJvZmlsZShjb3B5RnJvbT86IFVSSSB8IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLm5ld1Byb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6ICdpbmZvJyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ25ldyBwcm9maWxlIGV4aXN0cycsIFwiQSBuZXcgcHJvZmlsZSBpcyBhbHJlYWR5IGJlaW5nIGNyZWF0ZWQuIERvIHlvdSB3YW50IHRvIGRpc2NhcmQgaXQgYW5kIGNyZWF0ZSBhIG5ldyBvbmU/XCIpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgnZGlzY2FyZCcsIFwiRGlzY2FyZCAmIENyZWF0ZVwiKSxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIilcblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucmV2ZXJ0KCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvcHlGcm9tIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UucmVzb2x2ZVByb2ZpbGVUZW1wbGF0ZShjb3B5RnJvbSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmRpYWxvZ1NlcnZpY2UuZXJyb3IoZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMubmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuZGlzcG9zZSh0cnVlKSkpO1xuXHRcdFx0Y29uc3QgcHJpbWFyeUFjdGlvbnM6IEFjdGlvbltdID0gW107XG5cdFx0XHRjb25zdCBzZWNvbmRhcnlBY3Rpb25zOiBBY3Rpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgY3JlYXRlQWN0aW9uID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCd1c2VyRGF0YVByb2ZpbGUuY3JlYXRlJyxcblx0XHRcdFx0bG9jYWxpemUoJ2NyZWF0ZScsIFwiQ3JlYXRlXCIpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdCgpID0+IHRoaXMuc2F2ZU5ld1Byb2ZpbGUoZmFsc2UsIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKVxuXHRcdFx0KSk7XG5cdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKGNyZWF0ZUFjdGlvbik7XG5cdFx0XHRpZiAoaXNXZWIgJiYgY29weUZyb20gaW5zdGFuY2VvZiBVUkkgJiYgaXNQcm9maWxlVVJMKGNvcHlGcm9tKSkge1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0XHRcdCd1c2VyRGF0YVByb2ZpbGUuY3JlYXRlSW5EZXNrdG9wJyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnaW1wb3J0IGluIGRlc2t0b3AnLCBcIkNyZWF0ZSBpbiB7MH1cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdHRydWUsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oY29weUZyb20sIHsgb3BlbkV4dGVybmFsOiB0cnVlIH0pXG5cdFx0XHRcdCkpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNhbmNlbEFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0XHQndXNlckRhdGFQcm9maWxlLmNhbmNlbCcsXG5cdFx0XHRcdGxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKSxcblx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24udHJhc2gpLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmRpc2NhcmROZXdQcm9maWxlKClcblx0XHRcdCkpO1xuXHRcdFx0c2Vjb25kYXJ5QWN0aW9ucy5wdXNoKGNhbmNlbEFjdGlvbik7XG5cdFx0XHRjb25zdCBwcmV2aWV3UHJvZmlsZUFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKFxuXHRcdFx0XHQndXNlckRhdGFQcm9maWxlLnByZXZpZXcnLFxuXHRcdFx0XHRsb2NhbGl6ZSgncHJldmlldycsIFwiUHJldmlld1wiKSxcblx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ub3BlblByZXZpZXcpLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHQoKSA9PiB0aGlzLnByZXZpZXdOZXdQcm9maWxlKGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKVxuXHRcdFx0KSk7XG5cdFx0XHRzZWNvbmRhcnlBY3Rpb25zLnB1c2gocHJldmlld1Byb2ZpbGVBY3Rpb24pO1xuXHRcdFx0Y29uc3QgZXhwb3J0QWN0aW9uID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCd1c2VyRGF0YVByb2ZpbGUuZXhwb3J0Jyxcblx0XHRcdFx0bG9jYWxpemUoJ2V4cG9ydCcsIFwiRXhwb3J0Li4uXCIpLFxuXHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5leHBvcnQpLFxuXHRcdFx0XHRpc1VzZXJEYXRhUHJvZmlsZShjb3B5RnJvbSksXG5cdFx0XHRcdCgpID0+IHRoaXMuZXhwb3J0TmV3UHJvZmlsZShjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS50b2tlbilcblx0XHRcdCkpO1xuXHRcdFx0dGhpcy5uZXdQcm9maWxlRWxlbWVudCA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5ld1Byb2ZpbGVFbGVtZW50LFxuXHRcdFx0XHRjb3B5RnJvbSA/ICcnIDogbG9jYWxpemUoJ3VudGl0bGVkJywgXCJVbnRpdGxlZFwiKSxcblx0XHRcdFx0Y29weUZyb20sXG5cdFx0XHRcdFtwcmltYXJ5QWN0aW9ucywgc2Vjb25kYXJ5QWN0aW9uc10sXG5cdFx0XHRcdFtbY2FuY2VsQWN0aW9uXSwgW2V4cG9ydEFjdGlvbl1dLFxuXHRcdFx0KSk7XG5cdFx0XHRjb25zdCB1cGRhdGVDcmVhdGVBY3Rpb25MYWJlbCA9ICgpID0+IHtcblx0XHRcdFx0aWYgKGNyZWF0ZUFjdGlvbi5lbmFibGVkKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMubmV3UHJvZmlsZUVsZW1lbnQ/LmNvcHlGcm9tICYmIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuc29tZShwID0+ICFwLmlzVHJhbnNpZW50ICYmIHAubmFtZSA9PT0gdGhpcy5uZXdQcm9maWxlRWxlbWVudD8ubmFtZSkpIHtcblx0XHRcdFx0XHRcdGNyZWF0ZUFjdGlvbi5sYWJlbCA9IGxvY2FsaXplKCdyZXBsYWNlJywgXCJSZXBsYWNlXCIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjcmVhdGVBY3Rpb24ubGFiZWwgPSBsb2NhbGl6ZSgnY3JlYXRlJywgXCJDcmVhdGVcIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dXBkYXRlQ3JlYXRlQWN0aW9uTGFiZWwoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLm5ld1Byb2ZpbGVFbGVtZW50Lm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5wcmV2aWV3IHx8IGUuZGlzYWJsZWQgfHwgZS5tZXNzYWdlKSB7XG5cdFx0XHRcdFx0Y3JlYXRlQWN0aW9uLmVuYWJsZWQgPSAhdGhpcy5uZXdQcm9maWxlRWxlbWVudD8uZGlzYWJsZWQgJiYgIXRoaXMubmV3UHJvZmlsZUVsZW1lbnQ/Lm1lc3NhZ2U7XG5cdFx0XHRcdFx0cHJldmlld1Byb2ZpbGVBY3Rpb24uZW5hYmxlZCA9ICF0aGlzLm5ld1Byb2ZpbGVFbGVtZW50Py5wcmV2aWV3UHJvZmlsZSAmJiAhdGhpcy5uZXdQcm9maWxlRWxlbWVudD8uZGlzYWJsZWQgJiYgIXRoaXMubmV3UHJvZmlsZUVsZW1lbnQ/Lm1lc3NhZ2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUubmFtZSB8fCBlLmNvcHlGcm9tKSB7XG5cdFx0XHRcdFx0dXBkYXRlQ3JlYXRlQWN0aW9uTGFiZWwoKTtcblx0XHRcdFx0XHRleHBvcnRBY3Rpb24uZW5hYmxlZCA9IGlzVXNlckRhdGFQcm9maWxlKHRoaXMubmV3UHJvZmlsZUVsZW1lbnQ/LmNvcHlGcm9tKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2Uub25EaWRDaGFuZ2VQcm9maWxlcygoZSkgPT4ge1xuXHRcdFx0XHR1cGRhdGVDcmVhdGVBY3Rpb25MYWJlbCgpO1xuXHRcdFx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50Py52YWxpZGF0ZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcHJvZmlsZXMucHVzaChbdGhpcy5uZXdQcm9maWxlRWxlbWVudCwgZGlzcG9zYWJsZXNdKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodGhpcy5uZXdQcm9maWxlRWxlbWVudCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLm5ld1Byb2ZpbGVFbGVtZW50O1xuXHR9XG5cblx0cmV2ZXJ0KCk6IHZvaWQge1xuXHRcdHRoaXMucmVtb3ZlTmV3UHJvZmlsZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlTmV3UHJvZmlsZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5uZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9wcm9maWxlcy5maW5kSW5kZXgoKFtwXSkgPT4gcCA9PT0gdGhpcy5uZXdQcm9maWxlRWxlbWVudCk7XG5cdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHRoaXMuX3Byb2ZpbGVzLnNwbGljZShpbmRleCwgMSkubWFwKChbLCBkaXNwb3NhYmxlc10pID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcHJldmlld05ld1Byb2ZpbGUodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLm5ld1Byb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LnByZXZpZXdQcm9maWxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCB0aGlzLnNhdmVOZXdQcm9maWxlKHRydWUsIHRva2VuKTtcblx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0dGhpcy5uZXdQcm9maWxlRWxlbWVudC5wcmV2aWV3UHJvZmlsZSA9IHByb2ZpbGU7XG5cdFx0XHRpZiAoaXNXZWIpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2hQcm9maWxlKHByb2ZpbGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vcGVuV2luZG93KHByb2ZpbGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXhwb3J0TmV3UHJvZmlsZSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMubmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFpc1VzZXJEYXRhUHJvZmlsZSh0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LmNvcHlGcm9tKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwcm9maWxlID0gdG9Vc2VyRGF0YVByb2ZpbGUoXG5cdFx0XHRnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdHRoaXMubmV3UHJvZmlsZUVsZW1lbnQubmFtZSxcblx0XHRcdHRoaXMubmV3UHJvZmlsZUVsZW1lbnQuY29weUZyb20ubG9jYXRpb24sXG5cdFx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LmNvcHlGcm9tLmNhY2hlSG9tZSxcblx0XHRcdHtcblx0XHRcdFx0aWNvbjogdGhpcy5uZXdQcm9maWxlRWxlbWVudC5pY29uLFxuXHRcdFx0XHR1c2VEZWZhdWx0RmxhZ3M6IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQuZmxhZ3MsXG5cdFx0XHR9LFxuXHRcdFx0dGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZVxuXHRcdCk7XG5cdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLmV4cG9ydFByb2ZpbGUocHJvZmlsZSwgdGhpcy5uZXdQcm9maWxlRWxlbWVudC5jb3B5RmxhZ3MpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZU5ld1Byb2ZpbGUodHJhbnNpZW50PzogYm9vbGVhbiwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5uZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LnZhbGlkYXRlKCk7XG5cdFx0aWYgKHRoaXMubmV3UHJvZmlsZUVsZW1lbnQubWVzc2FnZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLm5ld1Byb2ZpbGVFbGVtZW50LmRpc2FibGVkID0gdHJ1ZTtcblx0XHRsZXQgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZDtcblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAodGhpcy5uZXdQcm9maWxlRWxlbWVudC5wcmV2aWV3UHJvZmlsZSkge1xuXHRcdFx0XHRpZiAoIXRyYW5zaWVudCkge1xuXHRcdFx0XHRcdHByb2ZpbGUgPSBhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUodGhpcy5uZXdQcm9maWxlRWxlbWVudC5wcmV2aWV3UHJvZmlsZSwgeyB0cmFuc2llbnQ6IGZhbHNlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgeyBmbGFncywgaWNvbiwgbmFtZSwgY29weUZyb20gfSA9IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQ7XG5cdFx0XHRcdGNvbnN0IHVzZURlZmF1bHRGbGFnczogVXNlRGVmYXVsdFByb2ZpbGVGbGFncyB8IHVuZGVmaW5lZCA9IGZsYWdzXG5cdFx0XHRcdFx0PyBmbGFncy5zZXR0aW5ncyAmJiBmbGFncy5rZXliaW5kaW5ncyAmJiBmbGFncy50YXNrcyAmJiBmbGFncy5nbG9iYWxTdGF0ZSAmJiBmbGFncy5leHRlbnNpb25zID8gdW5kZWZpbmVkIDogZmxhZ3Ncblx0XHRcdFx0XHQ6IHVuZGVmaW5lZDtcblxuXHRcdFx0XHR0eXBlIENyZWF0ZVByb2ZpbGVJbmZvQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1JlcG9ydCB3aGVuIHByb2ZpbGUgaXMgYWJvdXQgdG8gYmUgY3JlYXRlZCc7XG5cdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVHlwZSBvZiBwcm9maWxlIHNvdXJjZScgfTtcblx0XHRcdFx0fTtcblx0XHRcdFx0dHlwZSBDcmVhdGVQcm9maWxlSW5mb0V2ZW50ID0ge1xuXHRcdFx0XHRcdHNvdXJjZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBjcmVhdGVQcm9maWxlVGVsZW1ldHJ5RGF0YTogQ3JlYXRlUHJvZmlsZUluZm9FdmVudCA9IHsgc291cmNlOiBjb3B5RnJvbSBpbnN0YW5jZW9mIFVSSSA/ICd0ZW1wbGF0ZScgOiBpc1VzZXJEYXRhUHJvZmlsZShjb3B5RnJvbSkgPyAncHJvZmlsZScgOiBjb3B5RnJvbSA/ICdleHRlcm5hbCcgOiB1bmRlZmluZWQgfTtcblxuXHRcdFx0XHRpZiAoY29weUZyb20gaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdFx0XHRjb25zdCB0ZW1wbGF0ZSA9IGF3YWl0IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQucmVzb2x2ZVRlbXBsYXRlKGNvcHlGcm9tKTtcblx0XHRcdFx0XHRpZiAodGVtcGxhdGUpIHtcblx0XHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPENyZWF0ZVByb2ZpbGVJbmZvRXZlbnQsIENyZWF0ZVByb2ZpbGVJbmZvQ2xhc3NpZmljYXRpb24+KCd1c2VyRGF0YVByb2ZpbGUuY3JlYXRlRnJvbVRlbXBsYXRlJywgY3JlYXRlUHJvZmlsZVRlbGVtZXRyeURhdGEpO1xuXHRcdFx0XHRcdFx0cHJvZmlsZSA9IGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZS5jcmVhdGVQcm9maWxlRnJvbVRlbXBsYXRlKFxuXHRcdFx0XHRcdFx0XHR0ZW1wbGF0ZSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdG5hbWUsXG5cdFx0XHRcdFx0XHRcdFx0dXNlRGVmYXVsdEZsYWdzLFxuXHRcdFx0XHRcdFx0XHRcdGljb24sXG5cdFx0XHRcdFx0XHRcdFx0cmVzb3VyY2VUeXBlRmxhZ3M6IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQuY29weUZsYWdzLFxuXHRcdFx0XHRcdFx0XHRcdHRyYW5zaWVudFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR0b2tlbiA/PyBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpc1VzZXJEYXRhUHJvZmlsZShjb3B5RnJvbSkpIHtcblx0XHRcdFx0XHRwcm9maWxlID0gYXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLmNyZWF0ZUZyb21Qcm9maWxlKFxuXHRcdFx0XHRcdFx0Y29weUZyb20sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdG5hbWUsXG5cdFx0XHRcdFx0XHRcdHVzZURlZmF1bHRGbGFncyxcblx0XHRcdFx0XHRcdFx0aWNvbjogaWNvbixcblx0XHRcdFx0XHRcdFx0cmVzb3VyY2VUeXBlRmxhZ3M6IHRoaXMubmV3UHJvZmlsZUVsZW1lbnQuY29weUZsYWdzLFxuXHRcdFx0XHRcdFx0XHR0cmFuc2llbnRcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR0b2tlbiA/PyBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm9maWxlID0gYXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5jcmVhdGVQcm9maWxlKG5hbWUsIHsgdXNlRGVmYXVsdEZsYWdzLCBpY29uLCB0cmFuc2llbnQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYgKHRoaXMubmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5uZXdQcm9maWxlRWxlbWVudC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0b2tlbj8uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdGlmIChwcm9maWxlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5yZW1vdmVQcm9maWxlKHByb2ZpbGUpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHByb2ZpbGUgJiYgIXByb2ZpbGUuaXNUcmFuc2llbnQgJiYgdGhpcy5uZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0dGhpcy5yZW1vdmVOZXdQcm9maWxlKCk7XG5cdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX3Byb2ZpbGVzLmZpbmQoKFtwXSkgPT4gcC5uYW1lID09PSBwcm9maWxlLm5hbWUpO1xuXHRcdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZXhpc3RpbmdbMF0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZVByb2ZpbGVzKHsgYWRkZWQ6IFtwcm9maWxlXSwgcmVtb3ZlZDogW10sIHVwZGF0ZWQ6IFtdLCBhbGw6IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb2ZpbGU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRpc2NhcmROZXdQcm9maWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5uZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5uZXdQcm9maWxlRWxlbWVudC5wcmV2aWV3UHJvZmlsZSkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5yZW1vdmVQcm9maWxlKHRoaXMubmV3UHJvZmlsZUVsZW1lbnQucHJldmlld1Byb2ZpbGUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJlbW92ZU5ld1Byb2ZpbGUoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlbW92ZVByb2ZpbGUocHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdHR5cGU6ICdpbmZvJyxcblx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdkZWxldGVQcm9maWxlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoZSBwcm9maWxlICd7MH0nP1wiLCBwcm9maWxlLm5hbWUpLFxuXHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ2RlbGV0ZScsIFwiRGVsZXRlXCIpLFxuXHRcdFx0Y2FuY2VsQnV0dG9uOiBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIilcblx0XHR9KTtcblx0XHRpZiAocmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZS5yZW1vdmVQcm9maWxlKHByb2ZpbGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbldpbmRvdyhwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KHsgZm9yY2VQcm9maWxlOiBwcm9maWxlLm5hbWUgfSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxRQUFpQixXQUFXLGdCQUFnQjtBQUNyRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBaUMsbUJBQXFDLDBCQUEwQixxQkFBK0MseUJBQWlEO0FBQ2hNLFNBQThELGNBQWMscUNBQXFDLG1DQUFtQywrQkFBeUQ7QUFDN00sU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBUyxXQUFXO0FBQ3BCLFlBQVksWUFBWTtBQUN4QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxrQ0FBa0Msd0NBQXdDO0FBQ25GLFNBQVMsa0JBQWtCLGdDQUFnQztBQUMzRCxTQUFTLHFCQUFxQixtQ0FBbUM7QUFDakUsU0FBUyxlQUFlLDZCQUE2QjtBQUNyRCxTQUFTLGtCQUFrQixnQ0FBZ0M7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQTRCLHlCQUF5Qix3QkFBd0I7QUFDN0UsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIsK0JBQStCO0FBRTNELFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsYUFBYSxtQkFBbUI7QUFDekMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0JB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
