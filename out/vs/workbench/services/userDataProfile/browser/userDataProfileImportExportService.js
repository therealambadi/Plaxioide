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
import "./media/userDataProfileView.css";
import { localize } from "../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter } from "../../../../base/common/event.js";
import { IUserDataProfileImportExportService, PROFILE_FILTER, PROFILE_EXTENSION, IUserDataProfileService, PROFILES_CATEGORY, IUserDataProfileManagementService, PROFILE_URL_AUTHORITY, toUserDataProfileUri, isProfileURL, PROFILE_URL_AUTHORITY_PREFIX } from "../common/userDataProfile.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { URI } from "../../../../base/common/uri.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { SettingsResource, SettingsResourceTreeItem } from "./settingsResource.js";
import { KeybindingsResource, KeybindingsResourceTreeItem } from "./keybindingsResource.js";
import { SnippetsResource, SnippetsResourceTreeItem } from "./snippetsResource.js";
import { TasksResource, TasksResourceTreeItem } from "./tasksResource.js";
import { ExtensionsResource, ExtensionsResourceExportTreeItem, ExtensionsResourceTreeItem } from "./extensionsResource.js";
import { GlobalStateResource, GlobalStateResourceExportTreeItem, GlobalStateResourceTreeItem } from "./globalStateResource.js";
import { InMemoryFileSystemProvider } from "../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { joinPath } from "../../../../base/common/resources.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { Schemas } from "../../../../base/common/network.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import Severity from "../../../../base/common/severity.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { asText, IRequestService } from "../../../../platform/request/common/request.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { isUndefined } from "../../../../base/common/types.js";
import { createCancelablePromise } from "../../../../base/common/async.js";
function isUserDataProfileTemplate(thing) {
  const candidate = thing;
  return !!(candidate && typeof candidate === "object" && (candidate.name && typeof candidate.name === "string") && (isUndefined(candidate.icon) || typeof candidate.icon === "string") && (isUndefined(candidate.settings) || typeof candidate.settings === "string") && (isUndefined(candidate.globalState) || typeof candidate.globalState === "string") && (isUndefined(candidate.extensions) || typeof candidate.extensions === "string"));
}
let UserDataProfileImportExportService = class extends Disposable {
  constructor(instantiationService, userDataProfileService, userDataProfileManagementService, userDataProfilesService, extensionService, quickInputService, progressService, dialogService, clipboardService, openerService, requestService, productService, uriIdentityService) {
    super();
    this.instantiationService = instantiationService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.userDataProfilesService = userDataProfilesService;
    this.extensionService = extensionService;
    this.quickInputService = quickInputService;
    this.progressService = progressService;
    this.dialogService = dialogService;
    this.clipboardService = clipboardService;
    this.openerService = openerService;
    this.requestService = requestService;
    this.productService = productService;
    this.uriIdentityService = uriIdentityService;
    this.profileContentHandlers = /* @__PURE__ */ new Map();
    this.registerProfileContentHandler(Schemas.file, this.fileUserDataProfileContentHandler = instantiationService.createInstance(FileUserDataProfileContentHandler));
  }
  registerProfileContentHandler(id, profileContentHandler) {
    if (this.profileContentHandlers.has(id)) {
      throw new Error(`Profile content handler with id '${id}' already registered.`);
    }
    this.profileContentHandlers.set(id, profileContentHandler);
    return toDisposable(() => this.unregisterProfileContentHandler(id));
  }
  unregisterProfileContentHandler(id) {
    this.profileContentHandlers.delete(id);
  }
  async createFromProfile(from, options, token) {
    const disposables = new DisposableStore();
    let creationPromise;
    disposables.add(token.onCancellationRequested(() => creationPromise.cancel()));
    let profile;
    return this.progressService.withProgress({
      location: ProgressLocation.Notification,
      delay: 500,
      sticky: true,
      cancellable: true
    }, async (progress) => {
      const reportProgress = (message) => progress.report({ message: localize("create from profile", "Create Profile: {0}", message) });
      creationPromise = createCancelablePromise(async (token2) => {
        const userDataProfilesExportState = disposables.add(this.instantiationService.createInstance(UserDataProfileExportState, from, { ...options?.resourceTypeFlags, extensions: false }));
        const profileTemplate = await userDataProfilesExportState.getProfileTemplate(options.name ?? from.name, options?.icon);
        profile = await this.getProfileToImport({ ...profileTemplate, name: options.name ?? profileTemplate.name }, !!options.transient, options);
        if (!profile) {
          return;
        }
        if (token2.isCancellationRequested) {
          return;
        }
        await this.applyProfileTemplate(profileTemplate, profile, options, reportProgress, token2);
      });
      try {
        await creationPromise;
        if (profile && (options?.resourceTypeFlags?.extensions ?? true)) {
          reportProgress(localize("installing extensions", "Installing Extensions..."));
          await this.instantiationService.createInstance(ExtensionsResource).copy(from, profile, false);
        }
      } catch (error) {
        if (profile) {
          await this.userDataProfilesService.removeProfile(profile);
          profile = void 0;
        }
      }
      return profile;
    }, () => creationPromise.cancel()).finally(() => disposables.dispose());
  }
  async createProfileFromTemplate(profileTemplate, options, token) {
    const disposables = new DisposableStore();
    let creationPromise;
    disposables.add(token.onCancellationRequested(() => creationPromise.cancel()));
    let profile;
    return this.progressService.withProgress({
      location: ProgressLocation.Notification,
      delay: 500,
      sticky: true,
      cancellable: true
    }, async (progress) => {
      const reportProgress = (message) => progress.report({ message: localize("create from profile", "Create Profile: {0}", message) });
      creationPromise = createCancelablePromise(async (token2) => {
        profile = await this.getProfileToImport({ ...profileTemplate, name: options.name ?? profileTemplate.name }, !!options.transient, options);
        if (!profile) {
          return;
        }
        if (token2.isCancellationRequested) {
          return;
        }
        await this.applyProfileTemplate(profileTemplate, profile, options, reportProgress, token2);
      });
      try {
        await creationPromise;
      } catch (error) {
        if (profile) {
          await this.userDataProfilesService.removeProfile(profile);
          profile = void 0;
        }
      }
      return profile;
    }, () => creationPromise.cancel()).finally(() => disposables.dispose());
  }
  async applyProfileTemplate(profileTemplate, profile, options, reportProgress, token) {
    if (profileTemplate.settings && (options.resourceTypeFlags?.settings ?? true) && !profile.useDefaultFlags?.settings) {
      reportProgress(localize("creating settings", "Creating Settings..."));
      await this.instantiationService.createInstance(SettingsResource).apply(profileTemplate.settings, profile);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (profileTemplate.keybindings && (options.resourceTypeFlags?.keybindings ?? true) && !profile.useDefaultFlags?.keybindings) {
      reportProgress(localize("create keybindings", "Creating Keyboard Shortcuts..."));
      await this.instantiationService.createInstance(KeybindingsResource).apply(profileTemplate.keybindings, profile);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (profileTemplate.tasks && (options.resourceTypeFlags?.tasks ?? true) && !profile.useDefaultFlags?.tasks) {
      reportProgress(localize("create tasks", "Creating Tasks..."));
      await this.instantiationService.createInstance(TasksResource).apply(profileTemplate.tasks, profile);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (profileTemplate.snippets && (options.resourceTypeFlags?.snippets ?? true) && !profile.useDefaultFlags?.snippets) {
      reportProgress(localize("create snippets", "Creating Snippets..."));
      await this.instantiationService.createInstance(SnippetsResource).apply(profileTemplate.snippets, profile);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (profileTemplate.globalState && !profile.useDefaultFlags?.globalState) {
      reportProgress(localize("applying global state", "Applying UI State..."));
      await this.instantiationService.createInstance(GlobalStateResource).apply(profileTemplate.globalState, profile);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (profileTemplate.extensions && (options.resourceTypeFlags?.extensions ?? true) && !profile.useDefaultFlags?.extensions) {
      reportProgress(localize("installing extensions", "Installing Extensions..."));
      await this.instantiationService.createInstance(ExtensionsResource).apply(profileTemplate.extensions, profile, reportProgress, token);
    }
  }
  async exportProfile(profile, exportFlags) {
    const disposables = new DisposableStore();
    try {
      const userDataProfilesExportState = disposables.add(this.instantiationService.createInstance(UserDataProfileExportState, profile, exportFlags));
      await this.doExportProfile(userDataProfilesExportState, ProgressLocation.Notification);
    } finally {
      disposables.dispose();
    }
  }
  async createTroubleshootProfile() {
    const userDataProfilesExportState = this.instantiationService.createInstance(UserDataProfileExportState, this.userDataProfileService.currentProfile, void 0);
    try {
      const profileTemplate = await userDataProfilesExportState.getProfileTemplate(localize("troubleshoot issue", "Troubleshoot Issue"), void 0);
      await this.progressService.withProgress({
        location: ProgressLocation.Notification,
        delay: 1e3,
        sticky: true
      }, async (progress) => {
        const reportProgress = (message) => progress.report({ message: localize("troubleshoot profile progress", "Setting up Troubleshoot Profile: {0}", message) });
        const profile = await this.doCreateProfile(profileTemplate, true, false, { useDefaultFlags: this.userDataProfileService.currentProfile.useDefaultFlags }, reportProgress);
        if (profile) {
          reportProgress(localize("progress extensions", "Applying Extensions..."));
          await this.instantiationService.createInstance(ExtensionsResource).copy(this.userDataProfileService.currentProfile, profile, true);
          reportProgress(localize("switching profile", "Switching Profile..."));
          await this.userDataProfileManagementService.switchProfile(profile);
        }
      });
    } finally {
      userDataProfilesExportState.dispose();
    }
  }
  async doExportProfile(userDataProfilesExportState, location) {
    const profile = await userDataProfilesExportState.getProfileToExport();
    if (!profile) {
      return;
    }
    const disposables = new DisposableStore();
    try {
      await this.progressService.withProgress({
        location,
        title: localize("profiles.exporting", "{0}: Exporting...", PROFILES_CATEGORY.value)
      }, async (progress) => {
        const id = await this.pickProfileContentHandler(profile.name);
        if (!id) {
          return;
        }
        const profileContentHandler = this.profileContentHandlers.get(id);
        if (!profileContentHandler) {
          return;
        }
        const saveResult = await profileContentHandler.saveProfile(profile.name.replace("/", "-"), JSON.stringify(profile), CancellationToken.None);
        if (!saveResult) {
          return;
        }
        const message = localize("export success", "Profile '{0}' was exported successfully.", profile.name);
        if (profileContentHandler.extensionId) {
          const buttons = [];
          const link = this.productService.webUrl ? `${this.productService.webUrl}/${PROFILE_URL_AUTHORITY}/${id}/${saveResult.id}` : toUserDataProfileUri(`/${id}/${saveResult.id}`, this.productService).toString();
          buttons.push({
            label: localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy Link"),
            run: () => this.clipboardService.writeText(link)
          });
          if (this.productService.webUrl) {
            buttons.push({
              label: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open Link"),
              run: async () => {
                await this.openerService.open(link);
              }
            });
          } else {
            buttons.push({
              label: localize({ key: "open in", comment: ["&& denotes a mnemonic"] }, "&&Open in {0}", profileContentHandler.name),
              run: async () => {
                await this.openerService.open(saveResult.link.toString());
              }
            });
          }
          await this.dialogService.prompt({
            type: Severity.Info,
            message,
            buttons,
            cancelButton: localize("close", "Close")
          });
        } else {
          await this.dialogService.info(message);
        }
      });
    } finally {
      disposables.dispose();
    }
  }
  async resolveProfileTemplate(uri, options) {
    const profileContent = await this.resolveProfileContent(uri);
    if (profileContent === null) {
      return null;
    }
    let profileTemplate;
    try {
      profileTemplate = JSON.parse(profileContent);
    } catch (error) {
      throw new Error(localize("invalid profile content", "This profile is not valid."));
    }
    if (!isUserDataProfileTemplate(profileTemplate)) {
      throw new Error(localize("invalid profile content", "This profile is not valid."));
    }
    if (options?.name) {
      profileTemplate.name = options.name;
    }
    if (options?.icon) {
      profileTemplate.icon = options.icon;
    }
    if (options?.resourceTypeFlags?.settings === false) {
      profileTemplate.settings = void 0;
    }
    if (options?.resourceTypeFlags?.keybindings === false) {
      profileTemplate.keybindings = void 0;
    }
    if (options?.resourceTypeFlags?.snippets === false) {
      profileTemplate.snippets = void 0;
    }
    if (options?.resourceTypeFlags?.tasks === false) {
      profileTemplate.tasks = void 0;
    }
    if (options?.resourceTypeFlags?.globalState === false) {
      profileTemplate.globalState = void 0;
    }
    if (options?.resourceTypeFlags?.extensions === false) {
      profileTemplate.extensions = void 0;
    }
    return profileTemplate;
  }
  async doCreateProfile(profileTemplate, temporaryProfile, extensions, options, progress) {
    const profile = await this.getProfileToImport(profileTemplate, temporaryProfile, options);
    if (!profile) {
      return void 0;
    }
    if (profileTemplate.settings && !profile.useDefaultFlags?.settings) {
      progress(localize("progress settings", "Applying Settings..."));
      await this.instantiationService.createInstance(SettingsResource).apply(profileTemplate.settings, profile);
    }
    if (profileTemplate.keybindings && !profile.useDefaultFlags?.keybindings) {
      progress(localize("progress keybindings", "Applying Keyboard Shortcuts..."));
      await this.instantiationService.createInstance(KeybindingsResource).apply(profileTemplate.keybindings, profile);
    }
    if (profileTemplate.tasks && !profile.useDefaultFlags?.tasks) {
      progress(localize("progress tasks", "Applying Tasks..."));
      await this.instantiationService.createInstance(TasksResource).apply(profileTemplate.tasks, profile);
    }
    if (profileTemplate.snippets && !profile.useDefaultFlags?.snippets) {
      progress(localize("progress snippets", "Applying Snippets..."));
      await this.instantiationService.createInstance(SnippetsResource).apply(profileTemplate.snippets, profile);
    }
    if (profileTemplate.globalState && !profile.useDefaultFlags?.globalState) {
      progress(localize("progress global state", "Applying State..."));
      await this.instantiationService.createInstance(GlobalStateResource).apply(profileTemplate.globalState, profile);
    }
    if (profileTemplate.extensions && extensions && !profile.useDefaultFlags?.extensions) {
      progress(localize("progress extensions", "Applying Extensions..."));
      await this.instantiationService.createInstance(ExtensionsResource).apply(profileTemplate.extensions, profile);
    }
    return profile;
  }
  async resolveProfileContent(resource) {
    if (await this.fileUserDataProfileContentHandler.canHandle(resource)) {
      return this.fileUserDataProfileContentHandler.readProfile(resource, CancellationToken.None);
    }
    if (isProfileURL(resource)) {
      let handlerId, idOrUri;
      if (resource.authority === PROFILE_URL_AUTHORITY) {
        idOrUri = this.uriIdentityService.extUri.basename(resource);
        handlerId = this.uriIdentityService.extUri.basename(this.uriIdentityService.extUri.dirname(resource));
      } else {
        handlerId = resource.authority.substring(PROFILE_URL_AUTHORITY_PREFIX.length);
        idOrUri = URI.parse(resource.path.substring(1));
      }
      await this.extensionService.activateByEvent(`onProfile:${handlerId}`);
      const profileContentHandler = this.profileContentHandlers.get(handlerId);
      if (profileContentHandler) {
        return profileContentHandler.readProfile(idOrUri, CancellationToken.None);
      }
    }
    await this.extensionService.activateByEvent("onProfile");
    for (const profileContentHandler of this.profileContentHandlers.values()) {
      const content = await profileContentHandler.readProfile(resource, CancellationToken.None);
      if (content !== null) {
        return content;
      }
    }
    const context = await this.requestService.request({ type: "GET", url: resource.toString(true) }, CancellationToken.None);
    if (context.res.statusCode === 200) {
      return await asText(context);
    } else {
      const message = await asText(context);
      throw new Error(`Failed to get profile from URL: ${resource.toString()}. Status code: ${context.res.statusCode}. Message: ${message}`);
    }
  }
  async pickProfileContentHandler(name) {
    await this.extensionService.activateByEvent("onProfile");
    if (this.profileContentHandlers.size === 1) {
      return this.profileContentHandlers.keys().next().value;
    }
    const options = [];
    for (const [id, profileContentHandler] of this.profileContentHandlers) {
      options.push({ id, label: profileContentHandler.name, description: profileContentHandler.description });
    }
    const result = await this.quickInputService.pick(
      options.reverse(),
      {
        title: localize("select profile content handler", "Export '{0}' profile as...", name),
        hideInput: true
      }
    );
    return result?.id;
  }
  async getProfileToImport(profileTemplate, temp, options) {
    const profileName = profileTemplate.name;
    const profile = this.userDataProfilesService.profiles.find((p) => p.name === profileName);
    if (profile) {
      if (temp) {
        return this.userDataProfilesService.createNamedProfile(`${profileName} ${this.getProfileNameIndex(profileName)}`, { ...options, transient: temp });
      }
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Info,
        message: localize("profile already exists", "Profile with name '{0}' already exists. Do you want to replace its contents?", profileName),
        primaryButton: localize({ key: "overwrite", comment: ["&& denotes a mnemonic"] }, "&&Replace")
      });
      if (!confirmed) {
        return void 0;
      }
      return profile.isDefault ? profile : this.userDataProfilesService.updateProfile(profile, options);
    } else {
      return this.userDataProfilesService.createNamedProfile(profileName, { ...options, transient: temp });
    }
  }
  getProfileNameIndex(name) {
    const nameRegEx = new RegExp(`${escapeRegExpCharacters(name)}\\s(\\d+)`);
    let nameIndex = 0;
    for (const profile of this.userDataProfilesService.profiles) {
      const matches = nameRegEx.exec(profile.name);
      const index = matches ? parseInt(matches[1]) : 0;
      nameIndex = index > nameIndex ? index : nameIndex;
    }
    return nameIndex + 1;
  }
};
UserDataProfileImportExportService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, IUserDataProfileManagementService),
  __decorateParam(3, IUserDataProfilesService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IClipboardService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IRequestService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IUriIdentityService)
], UserDataProfileImportExportService);
let FileUserDataProfileContentHandler = class {
  constructor(fileDialogService, uriIdentityService, fileService, productService, textFileService) {
    this.fileDialogService = fileDialogService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.productService = productService;
    this.textFileService = textFileService;
    this.name = localize("local", "Local");
    this.description = localize("file", "file");
  }
  async saveProfile(name, content, token) {
    const link = await this.fileDialogService.showSaveDialog({
      title: localize("export profile dialog", "Save Profile"),
      filters: PROFILE_FILTER,
      defaultUri: this.uriIdentityService.extUri.joinPath(await this.fileDialogService.defaultFilePath(), `${name}.${PROFILE_EXTENSION}`)
    });
    if (!link) {
      return null;
    }
    await this.textFileService.create([{ resource: link, value: content, options: { overwrite: true } }]);
    return { link, id: link.toString() };
  }
  async canHandle(uri) {
    return uri.scheme !== Schemas.http && uri.scheme !== Schemas.https && uri.scheme !== this.productService.urlProtocol && await this.fileService.canHandleResource(uri);
  }
  async readProfile(uri, token) {
    if (await this.canHandle(uri)) {
      return (await this.fileService.readFile(uri, void 0, token)).value.toString();
    }
    return null;
  }
  async selectProfile() {
    const profileLocation = await this.fileDialogService.showOpenDialog({
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
      filters: PROFILE_FILTER,
      title: localize("select profile", "Select Profile")
    });
    return profileLocation ? profileLocation[0] : null;
  }
};
FileUserDataProfileContentHandler = __decorateClass([
  __decorateParam(0, IFileDialogService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IProductService),
  __decorateParam(4, ITextFileService)
], FileUserDataProfileContentHandler);
const USER_DATA_PROFILE_EXPORT_SCHEME = "userdataprofileexport";
const USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME = "userdataprofileexportpreview";
let UserDataProfileImportExportState = class extends Disposable {
  constructor(quickInputService) {
    super();
    this.quickInputService = quickInputService;
    this._onDidChangeRoots = this._register(new Emitter());
    this.onDidChangeRoots = this._onDidChangeRoots.event;
    this.roots = [];
  }
  async getChildren(element) {
    if (element) {
      const children = await element.getChildren();
      if (children) {
        for (const child of children) {
          if (child.parent.checkbox && child.checkbox) {
            child.checkbox.isChecked = child.parent.checkbox.isChecked && child.checkbox.isChecked;
          }
        }
      }
      return children;
    } else {
      this.rootsPromise = void 0;
      this._onDidChangeRoots.fire();
      return this.getRoots();
    }
  }
  getRoots() {
    if (!this.rootsPromise) {
      this.rootsPromise = (async () => {
        this.roots = await this.fetchRoots();
        for (const root of this.roots) {
          root.checkbox = {
            isChecked: !root.isFromDefaultProfile(),
            tooltip: localize("select", "Select {0}", root.label.label),
            accessibilityInformation: {
              label: localize("select", "Select {0}", root.label.label)
            }
          };
          if (root.isFromDefaultProfile()) {
            root.description = localize("from default", "From Default Profile");
          }
        }
        return this.roots;
      })();
    }
    return this.rootsPromise;
  }
  isEnabled(resourceType) {
    if (resourceType !== void 0) {
      return this.roots.some((root) => root.type === resourceType && this.isSelected(root));
    }
    return this.roots.some((root) => this.isSelected(root));
  }
  async getProfileTemplate(name, icon) {
    const roots = await this.getRoots();
    let settings;
    let keybindings;
    let tasks;
    let snippets;
    let extensions;
    let globalState;
    for (const root of roots) {
      if (!this.isSelected(root)) {
        continue;
      }
      if (root instanceof SettingsResourceTreeItem) {
        settings = await root.getContent();
      } else if (root instanceof KeybindingsResourceTreeItem) {
        keybindings = await root.getContent();
      } else if (root instanceof TasksResourceTreeItem) {
        tasks = await root.getContent();
      } else if (root instanceof SnippetsResourceTreeItem) {
        snippets = await root.getContent();
      } else if (root instanceof ExtensionsResourceTreeItem) {
        extensions = await root.getContent();
      } else if (root instanceof GlobalStateResourceTreeItem) {
        globalState = await root.getContent();
      }
    }
    return {
      name,
      icon,
      settings,
      keybindings,
      tasks,
      snippets,
      extensions,
      globalState
    };
  }
  isSelected(treeItem) {
    if (treeItem.checkbox) {
      return treeItem.checkbox.isChecked || !!treeItem.children?.some((child) => child.checkbox?.isChecked);
    }
    return true;
  }
};
UserDataProfileImportExportState = __decorateClass([
  __decorateParam(0, IQuickInputService)
], UserDataProfileImportExportState);
let UserDataProfileExportState = class extends UserDataProfileImportExportState {
  constructor(profile, exportFlags, quickInputService, fileService, instantiationService) {
    super(quickInputService);
    this.profile = profile;
    this.exportFlags = exportFlags;
    this.fileService = fileService;
    this.instantiationService = instantiationService;
    this.disposables = this._register(new DisposableStore());
  }
  async fetchRoots() {
    this.disposables.clear();
    this.disposables.add(this.fileService.registerProvider(USER_DATA_PROFILE_EXPORT_SCHEME, this._register(new InMemoryFileSystemProvider())));
    const previewFileSystemProvider = this._register(new InMemoryFileSystemProvider());
    this.disposables.add(this.fileService.registerProvider(USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME, previewFileSystemProvider));
    const roots = [];
    const exportPreviewProfle = this.createExportPreviewProfile(this.profile);
    if (this.exportFlags?.settings ?? true) {
      const settingsResource = this.instantiationService.createInstance(SettingsResource);
      const settingsContent = await settingsResource.getContent(this.profile);
      await settingsResource.apply(settingsContent, exportPreviewProfle);
      const settingsResourceTreeItem = this.instantiationService.createInstance(SettingsResourceTreeItem, exportPreviewProfle);
      if (await settingsResourceTreeItem.hasContent()) {
        roots.push(settingsResourceTreeItem);
      }
    }
    if (this.exportFlags?.keybindings ?? true) {
      const keybindingsResource = this.instantiationService.createInstance(KeybindingsResource);
      const keybindingsContent = await keybindingsResource.getContent(this.profile);
      await keybindingsResource.apply(keybindingsContent, exportPreviewProfle);
      const keybindingsResourceTreeItem = this.instantiationService.createInstance(KeybindingsResourceTreeItem, exportPreviewProfle);
      if (await keybindingsResourceTreeItem.hasContent()) {
        roots.push(keybindingsResourceTreeItem);
      }
    }
    if (this.exportFlags?.snippets ?? true) {
      const snippetsResource = this.instantiationService.createInstance(SnippetsResource);
      const snippetsContent = await snippetsResource.getContent(this.profile);
      await snippetsResource.apply(snippetsContent, exportPreviewProfle);
      const snippetsResourceTreeItem = this.instantiationService.createInstance(SnippetsResourceTreeItem, exportPreviewProfle);
      if (await snippetsResourceTreeItem.hasContent()) {
        roots.push(snippetsResourceTreeItem);
      }
    }
    if (this.exportFlags?.tasks ?? true) {
      const tasksResource = this.instantiationService.createInstance(TasksResource);
      const tasksContent = await tasksResource.getContent(this.profile);
      await tasksResource.apply(tasksContent, exportPreviewProfle);
      const tasksResourceTreeItem = this.instantiationService.createInstance(TasksResourceTreeItem, exportPreviewProfle);
      if (await tasksResourceTreeItem.hasContent()) {
        roots.push(tasksResourceTreeItem);
      }
    }
    if (this.exportFlags?.globalState ?? true) {
      const globalStateResource = joinPath(exportPreviewProfle.globalStorageHome, "globalState.json").with({ scheme: USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME });
      const globalStateResourceTreeItem = this.instantiationService.createInstance(GlobalStateResourceExportTreeItem, exportPreviewProfle, globalStateResource);
      const content = await globalStateResourceTreeItem.getContent();
      if (content) {
        await this.fileService.writeFile(globalStateResource, VSBuffer.fromString(JSON.stringify(JSON.parse(content), null, "	")));
        roots.push(globalStateResourceTreeItem);
      }
    }
    if (this.exportFlags?.extensions ?? true) {
      const extensionsResourceTreeItem = this.instantiationService.createInstance(ExtensionsResourceExportTreeItem, exportPreviewProfle);
      if (await extensionsResourceTreeItem.hasContent()) {
        roots.push(extensionsResourceTreeItem);
      }
    }
    previewFileSystemProvider.setReadOnly(true);
    return roots;
  }
  createExportPreviewProfile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      location: profile.location,
      isDefault: profile.isDefault,
      icon: profile.icon,
      globalStorageHome: profile.globalStorageHome,
      settingsResource: profile.settingsResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
      keybindingsResource: profile.keybindingsResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
      tasksResource: profile.tasksResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
      snippetsHome: profile.snippetsHome.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
      promptsHome: profile.promptsHome.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
      extensionsResource: profile.extensionsResource,
      cacheHome: profile.cacheHome,
      useDefaultFlags: profile.useDefaultFlags,
      isTransient: profile.isTransient
    };
  }
  async getProfileToExport() {
    let name = this.profile.name;
    if (this.profile.isDefault) {
      name = await this.quickInputService.input({
        placeHolder: localize("export profile name", "Name the profile"),
        title: localize("export profile title", "Export Profile"),
        async validateInput(input) {
          if (!input.trim()) {
            return localize("profile name required", "Profile name must be provided.");
          }
          return void 0;
        }
      });
      if (!name) {
        return null;
      }
    }
    return super.getProfileTemplate(name, this.profile.icon);
  }
};
UserDataProfileExportState = __decorateClass([
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService)
], UserDataProfileExportState);
registerSingleton(IUserDataProfileImportExportService, UserDataProfileImportExportService, InstantiationType.Delayed);
export {
  UserDataProfileImportExportService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvdXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS91c2VyRGF0YVByb2ZpbGVWaWV3LmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVJbXBvcnRFeHBvcnRTZXJ2aWNlLCBQUk9GSUxFX0ZJTFRFUiwgUFJPRklMRV9FWFRFTlNJT04sIElVc2VyRGF0YVByb2ZpbGVDb250ZW50SGFuZGxlciwgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsIElQcm9maWxlUmVzb3VyY2VUcmVlSXRlbSwgUFJPRklMRVNfQ0FURUdPUlksIElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSwgSVNhdmVQcm9maWxlUmVzdWx0LCBJUHJvZmlsZUltcG9ydE9wdGlvbnMsIFBST0ZJTEVfVVJMX0FVVEhPUklUWSwgdG9Vc2VyRGF0YVByb2ZpbGVVcmksIElVc2VyRGF0YVByb2ZpbGVDcmVhdGVPcHRpb25zLCBpc1Byb2ZpbGVVUkwsIFBST0ZJTEVfVVJMX0FVVEhPUklUWV9QUkVGSVggfSBmcm9tICcuLi9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSUZpbGVEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVRyZWVJdGVtLCBJVHJlZVZpZXdEYXRhUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhUHJvZmlsZU9wdGlvbnMsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgUHJvZmlsZVJlc291cmNlVHlwZSwgUHJvZmlsZVJlc291cmNlVHlwZUZsYWdzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NSZXNvdXJjZSwgU2V0dGluZ3NSZXNvdXJjZVRyZWVJdGVtIH0gZnJvbSAnLi9zZXR0aW5nc1Jlc291cmNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVzb3VyY2UsIEtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSB9IGZyb20gJy4va2V5YmluZGluZ3NSZXNvdXJjZS5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0c1Jlc291cmNlLCBTbmlwcGV0c1Jlc291cmNlVHJlZUl0ZW0gfSBmcm9tICcuL3NuaXBwZXRzUmVzb3VyY2UuanMnO1xuaW1wb3J0IHsgVGFza3NSZXNvdXJjZSwgVGFza3NSZXNvdXJjZVRyZWVJdGVtIH0gZnJvbSAnLi90YXNrc1Jlc291cmNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZXNvdXJjZSwgRXh0ZW5zaW9uc1Jlc291cmNlRXhwb3J0VHJlZUl0ZW0sIEV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtIH0gZnJvbSAnLi9leHRlbnNpb25zUmVzb3VyY2UuanMnO1xuaW1wb3J0IHsgR2xvYmFsU3RhdGVSZXNvdXJjZSwgR2xvYmFsU3RhdGVSZXNvdXJjZUV4cG9ydFRyZWVJdGVtLCBHbG9iYWxTdGF0ZVJlc291cmNlVHJlZUl0ZW0gfSBmcm9tICcuL2dsb2JhbFN0YXRlUmVzb3VyY2UuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBhc1RleHQsIElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTXV0YWJsZSwgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5cbmludGVyZmFjZSBJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUge1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGljb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNldHRpbmdzPzogc3RyaW5nO1xuXHRyZWFkb25seSBrZXliaW5kaW5ncz86IHN0cmluZztcblx0cmVhZG9ubHkgdGFza3M/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNuaXBwZXRzPzogc3RyaW5nO1xuXHRyZWFkb25seSBnbG9iYWxTdGF0ZT86IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9ucz86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gaXNVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSh0aGluZzogdW5rbm93bik6IHRoaW5nIGlzIElVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IHRoaW5nIGFzIElVc2VyRGF0YVByb2ZpbGVUZW1wbGF0ZSB8IHVuZGVmaW5lZDtcblxuXHRyZXR1cm4gISEoY2FuZGlkYXRlICYmIHR5cGVvZiBjYW5kaWRhdGUgPT09ICdvYmplY3QnXG5cdFx0JiYgKGNhbmRpZGF0ZS5uYW1lICYmIHR5cGVvZiBjYW5kaWRhdGUubmFtZSA9PT0gJ3N0cmluZycpXG5cdFx0JiYgKGlzVW5kZWZpbmVkKGNhbmRpZGF0ZS5pY29uKSB8fCB0eXBlb2YgY2FuZGlkYXRlLmljb24gPT09ICdzdHJpbmcnKVxuXHRcdCYmIChpc1VuZGVmaW5lZChjYW5kaWRhdGUuc2V0dGluZ3MpIHx8IHR5cGVvZiBjYW5kaWRhdGUuc2V0dGluZ3MgPT09ICdzdHJpbmcnKVxuXHRcdCYmIChpc1VuZGVmaW5lZChjYW5kaWRhdGUuZ2xvYmFsU3RhdGUpIHx8IHR5cGVvZiBjYW5kaWRhdGUuZ2xvYmFsU3RhdGUgPT09ICdzdHJpbmcnKVxuXHRcdCYmIChpc1VuZGVmaW5lZChjYW5kaWRhdGUuZXh0ZW5zaW9ucykgfHwgdHlwZW9mIGNhbmRpZGF0ZS5leHRlbnNpb25zID09PSAnc3RyaW5nJykpO1xufVxuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcHJvZmlsZUNvbnRlbnRIYW5kbGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJVXNlckRhdGFQcm9maWxlQ29udGVudEhhbmRsZXI+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBmaWxlVXNlckRhdGFQcm9maWxlQ29udGVudEhhbmRsZXI6IEZpbGVVc2VyRGF0YVByb2ZpbGVDb250ZW50SGFuZGxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyUHJvZmlsZUNvbnRlbnRIYW5kbGVyKFNjaGVtYXMuZmlsZSwgdGhpcy5maWxlVXNlckRhdGFQcm9maWxlQ29udGVudEhhbmRsZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlVXNlckRhdGFQcm9maWxlQ29udGVudEhhbmRsZXIpKTtcblx0fVxuXG5cdHJlZ2lzdGVyUHJvZmlsZUNvbnRlbnRIYW5kbGVyKGlkOiBzdHJpbmcsIHByb2ZpbGVDb250ZW50SGFuZGxlcjogSVVzZXJEYXRhUHJvZmlsZUNvbnRlbnRIYW5kbGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLnByb2ZpbGVDb250ZW50SGFuZGxlcnMuaGFzKGlkKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBQcm9maWxlIGNvbnRlbnQgaGFuZGxlciB3aXRoIGlkICcke2lkfScgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuXHRcdH1cblx0XHR0aGlzLnByb2ZpbGVDb250ZW50SGFuZGxlcnMuc2V0KGlkLCBwcm9maWxlQ29udGVudEhhbmRsZXIpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy51bnJlZ2lzdGVyUHJvZmlsZUNvbnRlbnRIYW5kbGVyKGlkKSk7XG5cdH1cblxuXHR1bnJlZ2lzdGVyUHJvZmlsZUNvbnRlbnRIYW5kbGVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnByb2ZpbGVDb250ZW50SGFuZGxlcnMuZGVsZXRlKGlkKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZUZyb21Qcm9maWxlKGZyb206IElVc2VyRGF0YVByb2ZpbGUsIG9wdGlvbnM6IElVc2VyRGF0YVByb2ZpbGVDcmVhdGVPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsZXQgY3JlYXRpb25Qcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPjtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gY3JlYXRpb25Qcm9taXNlLmNhbmNlbCgpKSk7XG5cdFx0bGV0IHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRkZWxheTogNTAwLFxuXHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0Y2FuY2VsbGFibGU6IHRydWUsXG5cdFx0fSwgYXN5bmMgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0Y29uc3QgcmVwb3J0UHJvZ3Jlc3MgPSAobWVzc2FnZTogc3RyaW5nKSA9PiBwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgnY3JlYXRlIGZyb20gcHJvZmlsZScsIFwiQ3JlYXRlIFByb2ZpbGU6IHswfVwiLCBtZXNzYWdlKSB9KTtcblx0XHRcdGNyZWF0aW9uUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIHRva2VuID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFQcm9maWxlRXhwb3J0U3RhdGUsIGZyb20sIHsgLi4ub3B0aW9ucz8ucmVzb3VyY2VUeXBlRmxhZ3MsIGV4dGVuc2lvbnM6IGZhbHNlIH0pKTtcblx0XHRcdFx0Y29uc3QgcHJvZmlsZVRlbXBsYXRlID0gYXdhaXQgdXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlLmdldFByb2ZpbGVUZW1wbGF0ZShvcHRpb25zLm5hbWUgPz8gZnJvbS5uYW1lLCBvcHRpb25zPy5pY29uKTtcblx0XHRcdFx0cHJvZmlsZSA9IGF3YWl0IHRoaXMuZ2V0UHJvZmlsZVRvSW1wb3J0KHsgLi4ucHJvZmlsZVRlbXBsYXRlLCBuYW1lOiBvcHRpb25zLm5hbWUgPz8gcHJvZmlsZVRlbXBsYXRlLm5hbWUgfSwgISFvcHRpb25zLnRyYW5zaWVudCwgb3B0aW9ucyk7XG5cdFx0XHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgdGhpcy5hcHBseVByb2ZpbGVUZW1wbGF0ZShwcm9maWxlVGVtcGxhdGUsIHByb2ZpbGUsIG9wdGlvbnMsIHJlcG9ydFByb2dyZXNzLCB0b2tlbik7XG5cdFx0XHR9KTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGNyZWF0aW9uUHJvbWlzZTtcblx0XHRcdFx0aWYgKHByb2ZpbGUgJiYgKG9wdGlvbnM/LnJlc291cmNlVHlwZUZsYWdzPy5leHRlbnNpb25zID8/IHRydWUpKSB7XG5cdFx0XHRcdFx0cmVwb3J0UHJvZ3Jlc3MobG9jYWxpemUoJ2luc3RhbGxpbmcgZXh0ZW5zaW9ucycsIFwiSW5zdGFsbGluZyBFeHRlbnNpb25zLi4uXCIpKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNSZXNvdXJjZSkuY29weShmcm9tLCBwcm9maWxlLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmIChwcm9maWxlKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5yZW1vdmVQcm9maWxlKHByb2ZpbGUpO1xuXHRcdFx0XHRcdHByb2ZpbGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9maWxlO1xuXG5cdFx0fSwgKCkgPT4gY3JlYXRpb25Qcm9taXNlLmNhbmNlbCgpKS5maW5hbGx5KCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVQcm9maWxlRnJvbVRlbXBsYXRlKHByb2ZpbGVUZW1wbGF0ZTogSVVzZXJEYXRhUHJvZmlsZVRlbXBsYXRlLCBvcHRpb25zOiBJVXNlckRhdGFQcm9maWxlQ3JlYXRlT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0bGV0IGNyZWF0aW9uUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD47XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGNyZWF0aW9uUHJvbWlzZS5jYW5jZWwoKSkpO1xuXHRcdGxldCBwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkO1xuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uLFxuXHRcdFx0ZGVsYXk6IDUwMCxcblx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdGNhbmNlbGxhYmxlOiB0cnVlLFxuXHRcdH0sIGFzeW5jIHByb2dyZXNzID0+IHtcblx0XHRcdGNvbnN0IHJlcG9ydFByb2dyZXNzID0gKG1lc3NhZ2U6IHN0cmluZykgPT4gcHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbG9jYWxpemUoJ2NyZWF0ZSBmcm9tIHByb2ZpbGUnLCBcIkNyZWF0ZSBQcm9maWxlOiB7MH1cIiwgbWVzc2FnZSkgfSk7XG5cdFx0XHRjcmVhdGlvblByb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShhc3luYyB0b2tlbiA9PiB7XG5cdFx0XHRcdHByb2ZpbGUgPSBhd2FpdCB0aGlzLmdldFByb2ZpbGVUb0ltcG9ydCh7IC4uLnByb2ZpbGVUZW1wbGF0ZSwgbmFtZTogb3B0aW9ucy5uYW1lID8/IHByb2ZpbGVUZW1wbGF0ZS5uYW1lIH0sICEhb3B0aW9ucy50cmFuc2llbnQsIG9wdGlvbnMpO1xuXHRcdFx0XHRpZiAoIXByb2ZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwbHlQcm9maWxlVGVtcGxhdGUocHJvZmlsZVRlbXBsYXRlLCBwcm9maWxlLCBvcHRpb25zLCByZXBvcnRQcm9ncmVzcywgdG9rZW4pO1xuXHRcdFx0fSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBjcmVhdGlvblByb21pc2U7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucmVtb3ZlUHJvZmlsZShwcm9maWxlKTtcblx0XHRcdFx0XHRwcm9maWxlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvZmlsZTtcblx0XHR9LCAoKSA9PiBjcmVhdGlvblByb21pc2UuY2FuY2VsKCkpLmZpbmFsbHkoKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYXBwbHlQcm9maWxlVGVtcGxhdGUocHJvZmlsZVRlbXBsYXRlOiBJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUsIHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsIG9wdGlvbnM6IElVc2VyRGF0YVByb2ZpbGVDcmVhdGVPcHRpb25zLCByZXBvcnRQcm9ncmVzczogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5zZXR0aW5ncyAmJiAob3B0aW9ucy5yZXNvdXJjZVR5cGVGbGFncz8uc2V0dGluZ3MgPz8gdHJ1ZSkgJiYgIXByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5zZXR0aW5ncykge1xuXHRcdFx0cmVwb3J0UHJvZ3Jlc3MobG9jYWxpemUoJ2NyZWF0aW5nIHNldHRpbmdzJywgXCJDcmVhdGluZyBTZXR0aW5ncy4uLlwiKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5zZXR0aW5ncywgcHJvZmlsZSk7XG5cdFx0fVxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLmtleWJpbmRpbmdzICYmIChvcHRpb25zLnJlc291cmNlVHlwZUZsYWdzPy5rZXliaW5kaW5ncyA/PyB0cnVlKSAmJiAhcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3M/LmtleWJpbmRpbmdzKSB7XG5cdFx0XHRyZXBvcnRQcm9ncmVzcyhsb2NhbGl6ZSgnY3JlYXRlIGtleWJpbmRpbmdzJywgXCJDcmVhdGluZyBLZXlib2FyZCBTaG9ydGN1dHMuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShLZXliaW5kaW5nc1Jlc291cmNlKS5hcHBseShwcm9maWxlVGVtcGxhdGUua2V5YmluZGluZ3MsIHByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS50YXNrcyAmJiAob3B0aW9ucy5yZXNvdXJjZVR5cGVGbGFncz8udGFza3MgPz8gdHJ1ZSkgJiYgIXByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy50YXNrcykge1xuXHRcdFx0cmVwb3J0UHJvZ3Jlc3MobG9jYWxpemUoJ2NyZWF0ZSB0YXNrcycsIFwiQ3JlYXRpbmcgVGFza3MuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXNrc1Jlc291cmNlKS5hcHBseShwcm9maWxlVGVtcGxhdGUudGFza3MsIHByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5zbmlwcGV0cyAmJiAob3B0aW9ucy5yZXNvdXJjZVR5cGVGbGFncz8uc25pcHBldHMgPz8gdHJ1ZSkgJiYgIXByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5zbmlwcGV0cykge1xuXHRcdFx0cmVwb3J0UHJvZ3Jlc3MobG9jYWxpemUoJ2NyZWF0ZSBzbmlwcGV0cycsIFwiQ3JlYXRpbmcgU25pcHBldHMuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0c1Jlc291cmNlKS5hcHBseShwcm9maWxlVGVtcGxhdGUuc25pcHBldHMsIHByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5nbG9iYWxTdGF0ZSAmJiAhcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3M/Lmdsb2JhbFN0YXRlKSB7XG5cdFx0XHRyZXBvcnRQcm9ncmVzcyhsb2NhbGl6ZSgnYXBwbHlpbmcgZ2xvYmFsIHN0YXRlJywgXCJBcHBseWluZyBVSSBTdGF0ZS4uLlwiKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEdsb2JhbFN0YXRlUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5nbG9iYWxTdGF0ZSwgcHJvZmlsZSk7XG5cdFx0fVxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLmV4dGVuc2lvbnMgJiYgKG9wdGlvbnMucmVzb3VyY2VUeXBlRmxhZ3M/LmV4dGVuc2lvbnMgPz8gdHJ1ZSkgJiYgIXByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5leHRlbnNpb25zKSB7XG5cdFx0XHRyZXBvcnRQcm9ncmVzcyhsb2NhbGl6ZSgnaW5zdGFsbGluZyBleHRlbnNpb25zJywgXCJJbnN0YWxsaW5nIEV4dGVuc2lvbnMuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5leHRlbnNpb25zLCBwcm9maWxlLCByZXBvcnRQcm9ncmVzcywgdG9rZW4pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGV4cG9ydFByb2ZpbGUocHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSwgZXhwb3J0RmxhZ3M/OiBQcm9maWxlUmVzb3VyY2VUeXBlRmxhZ3MpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFQcm9maWxlRXhwb3J0U3RhdGUsIHByb2ZpbGUsIGV4cG9ydEZsYWdzKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmRvRXhwb3J0UHJvZmlsZSh1c2VyRGF0YVByb2ZpbGVzRXhwb3J0U3RhdGUsIFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNyZWF0ZVRyb3VibGVzaG9vdFByb2ZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VyRGF0YVByb2ZpbGVFeHBvcnRTdGF0ZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLCB1bmRlZmluZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwcm9maWxlVGVtcGxhdGUgPSBhd2FpdCB1c2VyRGF0YVByb2ZpbGVzRXhwb3J0U3RhdGUuZ2V0UHJvZmlsZVRlbXBsYXRlKGxvY2FsaXplKCd0cm91Ymxlc2hvb3QgaXNzdWUnLCBcIlRyb3VibGVzaG9vdCBJc3N1ZVwiKSwgdW5kZWZpbmVkKTtcblx0XHRcdGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbixcblx0XHRcdFx0ZGVsYXk6IDEwMDAsXG5cdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdH0sIGFzeW5jIHByb2dyZXNzID0+IHtcblx0XHRcdFx0Y29uc3QgcmVwb3J0UHJvZ3Jlc3MgPSAobWVzc2FnZTogc3RyaW5nKSA9PiBwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgndHJvdWJsZXNob290IHByb2ZpbGUgcHJvZ3Jlc3MnLCBcIlNldHRpbmcgdXAgVHJvdWJsZXNob290IFByb2ZpbGU6IHswfVwiLCBtZXNzYWdlKSB9KTtcblx0XHRcdFx0Y29uc3QgcHJvZmlsZSA9IGF3YWl0IHRoaXMuZG9DcmVhdGVQcm9maWxlKHByb2ZpbGVUZW1wbGF0ZSwgdHJ1ZSwgZmFsc2UsIHsgdXNlRGVmYXVsdEZsYWdzOiB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUudXNlRGVmYXVsdEZsYWdzIH0sIHJlcG9ydFByb2dyZXNzKTtcblx0XHRcdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdFx0XHRyZXBvcnRQcm9ncmVzcyhsb2NhbGl6ZSgncHJvZ3Jlc3MgZXh0ZW5zaW9ucycsIFwiQXBwbHlpbmcgRXh0ZW5zaW9ucy4uLlwiKSk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2UpLmNvcHkodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLCBwcm9maWxlLCB0cnVlKTtcblxuXHRcdFx0XHRcdHJlcG9ydFByb2dyZXNzKGxvY2FsaXplKCdzd2l0Y2hpbmcgcHJvZmlsZScsIFwiU3dpdGNoaW5nIFByb2ZpbGUuLi5cIikpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2Uuc3dpdGNoUHJvZmlsZShwcm9maWxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHVzZXJEYXRhUHJvZmlsZXNFeHBvcnRTdGF0ZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0V4cG9ydFByb2ZpbGUodXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlOiBVc2VyRGF0YVByb2ZpbGVFeHBvcnRTdGF0ZSwgbG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24gfCBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwcm9maWxlID0gYXdhaXQgdXNlckRhdGFQcm9maWxlc0V4cG9ydFN0YXRlLmdldFByb2ZpbGVUb0V4cG9ydCgpO1xuXHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRcdGxvY2F0aW9uLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Byb2ZpbGVzLmV4cG9ydGluZycsIFwiezB9OiBFeHBvcnRpbmcuLi5cIiwgUFJPRklMRVNfQ0FURUdPUlkudmFsdWUpLFxuXHRcdFx0fSwgYXN5bmMgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0XHRjb25zdCBpZCA9IGF3YWl0IHRoaXMucGlja1Byb2ZpbGVDb250ZW50SGFuZGxlcihwcm9maWxlLm5hbWUpO1xuXHRcdFx0XHRpZiAoIWlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVDb250ZW50SGFuZGxlciA9IHRoaXMucHJvZmlsZUNvbnRlbnRIYW5kbGVycy5nZXQoaWQpO1xuXHRcdFx0XHRpZiAoIXByb2ZpbGVDb250ZW50SGFuZGxlcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgcHJvZmlsZUNvbnRlbnRIYW5kbGVyLnNhdmVQcm9maWxlKHByb2ZpbGUubmFtZS5yZXBsYWNlKCcvJywgJy0nKSwgSlNPTi5zdHJpbmdpZnkocHJvZmlsZSksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRpZiAoIXNhdmVSZXN1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdleHBvcnQgc3VjY2VzcycsIFwiUHJvZmlsZSAnezB9JyB3YXMgZXhwb3J0ZWQgc3VjY2Vzc2Z1bGx5LlwiLCBwcm9maWxlLm5hbWUpO1xuXHRcdFx0XHRpZiAocHJvZmlsZUNvbnRlbnRIYW5kbGVyLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0Y29uc3QgYnV0dG9uczogSVByb21wdEJ1dHRvbjx2b2lkPltdID0gW107XG5cdFx0XHRcdFx0Y29uc3QgbGluayA9IHRoaXMucHJvZHVjdFNlcnZpY2Uud2ViVXJsID8gYCR7dGhpcy5wcm9kdWN0U2VydmljZS53ZWJVcmx9LyR7UFJPRklMRV9VUkxfQVVUSE9SSVRZfS8ke2lkfS8ke3NhdmVSZXN1bHQuaWR9YCA6IHRvVXNlckRhdGFQcm9maWxlVXJpKGAvJHtpZH0vJHtzYXZlUmVzdWx0LmlkfWAsIHRoaXMucHJvZHVjdFNlcnZpY2UpLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0YnV0dG9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ2NvcHknLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDb3B5IExpbmtcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQobGluaylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS53ZWJVcmwpIHtcblx0XHRcdFx0XHRcdGJ1dHRvbnMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ29wZW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZPcGVuIExpbmtcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGxpbmspO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YnV0dG9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnb3BlbiBpbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW4gaW4gezB9XCIsIHByb2ZpbGVDb250ZW50SGFuZGxlci5uYW1lKSxcblx0XHRcdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oc2F2ZVJlc3VsdC5saW5rLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRcdFx0XHRjYW5jZWxCdXR0b246IGxvY2FsaXplKCdjbG9zZScsIFwiQ2xvc2VcIilcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuaW5mbyhtZXNzYWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXNvbHZlUHJvZmlsZVRlbXBsYXRlKHVyaTogVVJJLCBvcHRpb25zPzogSVByb2ZpbGVJbXBvcnRPcHRpb25zKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUgfCBudWxsPiB7XG5cdFx0Y29uc3QgcHJvZmlsZUNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcm9maWxlQ29udGVudCh1cmkpO1xuXHRcdGlmIChwcm9maWxlQ29udGVudCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0bGV0IHByb2ZpbGVUZW1wbGF0ZTogTXV0YWJsZTxJVXNlckRhdGFQcm9maWxlVGVtcGxhdGU+O1xuXG5cdFx0dHJ5IHtcblx0XHRcdHByb2ZpbGVUZW1wbGF0ZSA9IEpTT04ucGFyc2UocHJvZmlsZUNvbnRlbnQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2ludmFsaWQgcHJvZmlsZSBjb250ZW50JywgXCJUaGlzIHByb2ZpbGUgaXMgbm90IHZhbGlkLlwiKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFpc1VzZXJEYXRhUHJvZmlsZVRlbXBsYXRlKHByb2ZpbGVUZW1wbGF0ZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnaW52YWxpZCBwcm9maWxlIGNvbnRlbnQnLCBcIlRoaXMgcHJvZmlsZSBpcyBub3QgdmFsaWQuXCIpKTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucz8ubmFtZSkge1xuXHRcdFx0cHJvZmlsZVRlbXBsYXRlLm5hbWUgPSBvcHRpb25zLm5hbWU7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/Lmljb24pIHtcblx0XHRcdHByb2ZpbGVUZW1wbGF0ZS5pY29uID0gb3B0aW9ucy5pY29uO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy5yZXNvdXJjZVR5cGVGbGFncz8uc2V0dGluZ3MgPT09IGZhbHNlKSB7XG5cdFx0XHRwcm9maWxlVGVtcGxhdGUuc2V0dGluZ3MgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LnJlc291cmNlVHlwZUZsYWdzPy5rZXliaW5kaW5ncyA9PT0gZmFsc2UpIHtcblx0XHRcdHByb2ZpbGVUZW1wbGF0ZS5rZXliaW5kaW5ncyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucz8ucmVzb3VyY2VUeXBlRmxhZ3M/LnNuaXBwZXRzID09PSBmYWxzZSkge1xuXHRcdFx0cHJvZmlsZVRlbXBsYXRlLnNuaXBwZXRzID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy5yZXNvdXJjZVR5cGVGbGFncz8udGFza3MgPT09IGZhbHNlKSB7XG5cdFx0XHRwcm9maWxlVGVtcGxhdGUudGFza3MgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LnJlc291cmNlVHlwZUZsYWdzPy5nbG9iYWxTdGF0ZSA9PT0gZmFsc2UpIHtcblx0XHRcdHByb2ZpbGVUZW1wbGF0ZS5nbG9iYWxTdGF0ZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucz8ucmVzb3VyY2VUeXBlRmxhZ3M/LmV4dGVuc2lvbnMgPT09IGZhbHNlKSB7XG5cdFx0XHRwcm9maWxlVGVtcGxhdGUuZXh0ZW5zaW9ucyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvZmlsZVRlbXBsYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0NyZWF0ZVByb2ZpbGUocHJvZmlsZVRlbXBsYXRlOiBJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUsIHRlbXBvcmFyeVByb2ZpbGU6IGJvb2xlYW4sIGV4dGVuc2lvbnM6IGJvb2xlYW4sIG9wdGlvbnM6IElVc2VyRGF0YVByb2ZpbGVPcHRpb25zIHwgdW5kZWZpbmVkLCBwcm9ncmVzczogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCB0aGlzLmdldFByb2ZpbGVUb0ltcG9ydChwcm9maWxlVGVtcGxhdGUsIHRlbXBvcmFyeVByb2ZpbGUsIG9wdGlvbnMpO1xuXHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLnNldHRpbmdzICYmICFwcm9maWxlLnVzZURlZmF1bHRGbGFncz8uc2V0dGluZ3MpIHtcblx0XHRcdHByb2dyZXNzKGxvY2FsaXplKCdwcm9ncmVzcyBzZXR0aW5ncycsIFwiQXBwbHlpbmcgU2V0dGluZ3MuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc1Jlc291cmNlKS5hcHBseShwcm9maWxlVGVtcGxhdGUuc2V0dGluZ3MsIHByb2ZpbGUpO1xuXHRcdH1cblx0XHRpZiAocHJvZmlsZVRlbXBsYXRlLmtleWJpbmRpbmdzICYmICFwcm9maWxlLnVzZURlZmF1bHRGbGFncz8ua2V5YmluZGluZ3MpIHtcblx0XHRcdHByb2dyZXNzKGxvY2FsaXplKCdwcm9ncmVzcyBrZXliaW5kaW5ncycsIFwiQXBwbHlpbmcgS2V5Ym9hcmQgU2hvcnRjdXRzLi4uXCIpKTtcblx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoS2V5YmluZGluZ3NSZXNvdXJjZSkuYXBwbHkocHJvZmlsZVRlbXBsYXRlLmtleWJpbmRpbmdzLCBwcm9maWxlKTtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS50YXNrcyAmJiAhcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3M/LnRhc2tzKSB7XG5cdFx0XHRwcm9ncmVzcyhsb2NhbGl6ZSgncHJvZ3Jlc3MgdGFza3MnLCBcIkFwcGx5aW5nIFRhc2tzLi4uXCIpKTtcblx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGFza3NSZXNvdXJjZSkuYXBwbHkocHJvZmlsZVRlbXBsYXRlLnRhc2tzLCBwcm9maWxlKTtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5zbmlwcGV0cyAmJiAhcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3M/LnNuaXBwZXRzKSB7XG5cdFx0XHRwcm9ncmVzcyhsb2NhbGl6ZSgncHJvZ3Jlc3Mgc25pcHBldHMnLCBcIkFwcGx5aW5nIFNuaXBwZXRzLi4uXCIpKTtcblx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldHNSZXNvdXJjZSkuYXBwbHkocHJvZmlsZVRlbXBsYXRlLnNuaXBwZXRzLCBwcm9maWxlKTtcblx0XHR9XG5cdFx0aWYgKHByb2ZpbGVUZW1wbGF0ZS5nbG9iYWxTdGF0ZSAmJiAhcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3M/Lmdsb2JhbFN0YXRlKSB7XG5cdFx0XHRwcm9ncmVzcyhsb2NhbGl6ZSgncHJvZ3Jlc3MgZ2xvYmFsIHN0YXRlJywgXCJBcHBseWluZyBTdGF0ZS4uLlwiKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEdsb2JhbFN0YXRlUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5nbG9iYWxTdGF0ZSwgcHJvZmlsZSk7XG5cdFx0fVxuXHRcdGlmIChwcm9maWxlVGVtcGxhdGUuZXh0ZW5zaW9ucyAmJiBleHRlbnNpb25zICYmICFwcm9maWxlLnVzZURlZmF1bHRGbGFncz8uZXh0ZW5zaW9ucykge1xuXHRcdFx0cHJvZ3Jlc3MobG9jYWxpemUoJ3Byb2dyZXNzIGV4dGVuc2lvbnMnLCBcIkFwcGx5aW5nIEV4dGVuc2lvbnMuLi5cIikpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2UpLmFwcGx5KHByb2ZpbGVUZW1wbGF0ZS5leHRlbnNpb25zLCBwcm9maWxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvZmlsZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZVByb2ZpbGVDb250ZW50KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRpZiAoYXdhaXQgdGhpcy5maWxlVXNlckRhdGFQcm9maWxlQ29udGVudEhhbmRsZXIuY2FuSGFuZGxlKHJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsZVVzZXJEYXRhUHJvZmlsZUNvbnRlbnRIYW5kbGVyLnJlYWRQcm9maWxlKHJlc291cmNlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9XG5cblx0XHRpZiAoaXNQcm9maWxlVVJMKHJlc291cmNlKSkge1xuXHRcdFx0bGV0IGhhbmRsZXJJZDogc3RyaW5nLCBpZE9yVXJpOiBzdHJpbmcgfCBVUkk7XG5cdFx0XHRpZiAocmVzb3VyY2UuYXV0aG9yaXR5ID09PSBQUk9GSUxFX1VSTF9BVVRIT1JJVFkpIHtcblx0XHRcdFx0aWRPclVyaSA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5iYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0XHRcdGhhbmRsZXJJZCA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5iYXNlbmFtZSh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZShyZXNvdXJjZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGFuZGxlcklkID0gcmVzb3VyY2UuYXV0aG9yaXR5LnN1YnN0cmluZyhQUk9GSUxFX1VSTF9BVVRIT1JJVFlfUFJFRklYLmxlbmd0aCk7XG5cdFx0XHRcdGlkT3JVcmkgPSBVUkkucGFyc2UocmVzb3VyY2UucGF0aC5zdWJzdHJpbmcoMSkpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudChgb25Qcm9maWxlOiR7aGFuZGxlcklkfWApO1xuXHRcdFx0Y29uc3QgcHJvZmlsZUNvbnRlbnRIYW5kbGVyID0gdGhpcy5wcm9maWxlQ29udGVudEhhbmRsZXJzLmdldChoYW5kbGVySWQpO1xuXHRcdFx0aWYgKHByb2ZpbGVDb250ZW50SGFuZGxlcikge1xuXHRcdFx0XHRyZXR1cm4gcHJvZmlsZUNvbnRlbnRIYW5kbGVyLnJlYWRQcm9maWxlKGlkT3JVcmksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoJ29uUHJvZmlsZScpO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZUNvbnRlbnRIYW5kbGVyIG9mIHRoaXMucHJvZmlsZUNvbnRlbnRIYW5kbGVycy52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHByb2ZpbGVDb250ZW50SGFuZGxlci5yZWFkUHJvZmlsZShyZXNvdXJjZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoY29udGVudCAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHsgdHlwZTogJ0dFVCcsIHVybDogcmVzb3VyY2UudG9TdHJpbmcodHJ1ZSkgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IGFzVGV4dChjb250ZXh0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGF3YWl0IGFzVGV4dChjb250ZXh0KTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGdldCBwcm9maWxlIGZyb20gVVJMOiAke3Jlc291cmNlLnRvU3RyaW5nKCl9LiBTdGF0dXMgY29kZTogJHtjb250ZXh0LnJlcy5zdGF0dXNDb2RlfS4gTWVzc2FnZTogJHttZXNzYWdlfWApO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcGlja1Byb2ZpbGVDb250ZW50SGFuZGxlcihuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoJ29uUHJvZmlsZScpO1xuXHRcdGlmICh0aGlzLnByb2ZpbGVDb250ZW50SGFuZGxlcnMuc2l6ZSA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucHJvZmlsZUNvbnRlbnRIYW5kbGVycy5rZXlzKCkubmV4dCgpLnZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBvcHRpb25zOiBRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtpZCwgcHJvZmlsZUNvbnRlbnRIYW5kbGVyXSBvZiB0aGlzLnByb2ZpbGVDb250ZW50SGFuZGxlcnMpIHtcblx0XHRcdG9wdGlvbnMucHVzaCh7IGlkLCBsYWJlbDogcHJvZmlsZUNvbnRlbnRIYW5kbGVyLm5hbWUsIGRlc2NyaXB0aW9uOiBwcm9maWxlQ29udGVudEhhbmRsZXIuZGVzY3JpcHRpb24gfSk7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhvcHRpb25zLnJldmVyc2UoKSxcblx0XHRcdHtcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZWxlY3QgcHJvZmlsZSBjb250ZW50IGhhbmRsZXInLCBcIkV4cG9ydCAnezB9JyBwcm9maWxlIGFzLi4uXCIsIG5hbWUpLFxuXHRcdFx0XHRoaWRlSW5wdXQ6IHRydWVcblx0XHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ/LmlkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRQcm9maWxlVG9JbXBvcnQocHJvZmlsZVRlbXBsYXRlOiBJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUsIHRlbXA6IGJvb2xlYW4sIG9wdGlvbnM6IElVc2VyRGF0YVByb2ZpbGVPcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcHJvZmlsZU5hbWUgPSBwcm9maWxlVGVtcGxhdGUubmFtZTtcblx0XHRjb25zdCBwcm9maWxlID0gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5maW5kKHAgPT4gcC5uYW1lID09PSBwcm9maWxlTmFtZSk7XG5cdFx0aWYgKHByb2ZpbGUpIHtcblx0XHRcdGlmICh0ZW1wKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmNyZWF0ZU5hbWVkUHJvZmlsZShgJHtwcm9maWxlTmFtZX0gJHt0aGlzLmdldFByb2ZpbGVOYW1lSW5kZXgocHJvZmlsZU5hbWUpfWAsIHsgLi4ub3B0aW9ucywgdHJhbnNpZW50OiB0ZW1wIH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Byb2ZpbGUgYWxyZWFkeSBleGlzdHMnLCBcIlByb2ZpbGUgd2l0aCBuYW1lICd7MH0nIGFscmVhZHkgZXhpc3RzLiBEbyB5b3Ugd2FudCB0byByZXBsYWNlIGl0cyBjb250ZW50cz9cIiwgcHJvZmlsZU5hbWUpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ292ZXJ3cml0ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlJlcGxhY2VcIilcblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9maWxlLmlzRGVmYXVsdCA/IHByb2ZpbGUgOiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUocHJvZmlsZSwgb3B0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmNyZWF0ZU5hbWVkUHJvZmlsZShwcm9maWxlTmFtZSwgeyAuLi5vcHRpb25zLCB0cmFuc2llbnQ6IHRlbXAgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRQcm9maWxlTmFtZUluZGV4KG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0Y29uc3QgbmFtZVJlZ0V4ID0gbmV3IFJlZ0V4cChgJHtlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKG5hbWUpfVxcXFxzKFxcXFxkKylgKTtcblx0XHRsZXQgbmFtZUluZGV4ID0gMDtcblx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcykge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IG5hbWVSZWdFeC5leGVjKHByb2ZpbGUubmFtZSk7XG5cdFx0XHRjb25zdCBpbmRleCA9IG1hdGNoZXMgPyBwYXJzZUludChtYXRjaGVzWzFdKSA6IDA7XG5cdFx0XHRuYW1lSW5kZXggPSBpbmRleCA+IG5hbWVJbmRleCA/IGluZGV4IDogbmFtZUluZGV4O1xuXHRcdH1cblx0XHRyZXR1cm4gbmFtZUluZGV4ICsgMTtcblx0fVxuXG59XG5cbmNsYXNzIEZpbGVVc2VyRGF0YVByb2ZpbGVDb250ZW50SGFuZGxlciBpbXBsZW1lbnRzIElVc2VyRGF0YVByb2ZpbGVDb250ZW50SGFuZGxlciB7XG5cblx0cmVhZG9ubHkgbmFtZSA9IGxvY2FsaXplKCdsb2NhbCcsIFwiTG9jYWxcIik7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ2ZpbGUnLCBcImZpbGVcIik7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgc2F2ZVByb2ZpbGUobmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNhdmVQcm9maWxlUmVzdWx0IHwgbnVsbD4ge1xuXHRcdGNvbnN0IGxpbmsgPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dTYXZlRGlhbG9nKHtcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZXhwb3J0IHByb2ZpbGUgZGlhbG9nJywgXCJTYXZlIFByb2ZpbGVcIiksXG5cdFx0XHRmaWx0ZXJzOiBQUk9GSUxFX0ZJTFRFUixcblx0XHRcdGRlZmF1bHRVcmk6IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aChhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aCgpLCBgJHtuYW1lfS4ke1BST0ZJTEVfRVhURU5TSU9OfWApLFxuXHRcdH0pO1xuXHRcdGlmICghbGluaykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZTogbGluaywgdmFsdWU6IGNvbnRlbnQsIG9wdGlvbnM6IHsgb3ZlcndyaXRlOiB0cnVlIH0gfV0pO1xuXHRcdHJldHVybiB7IGxpbmssIGlkOiBsaW5rLnRvU3RyaW5nKCkgfTtcblx0fVxuXG5cdGFzeW5jIGNhbkhhbmRsZSh1cmk6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB1cmkuc2NoZW1lICE9PSBTY2hlbWFzLmh0dHAgJiYgdXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5odHRwcyAmJiB1cmkuc2NoZW1lICE9PSB0aGlzLnByb2R1Y3RTZXJ2aWNlLnVybFByb3RvY29sICYmIGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuY2FuSGFuZGxlUmVzb3VyY2UodXJpKTtcblx0fVxuXG5cdGFzeW5jIHJlYWRQcm9maWxlKHVyaTogVVJJLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRpZiAoYXdhaXQgdGhpcy5jYW5IYW5kbGUodXJpKSkge1xuXHRcdFx0cmV0dXJuIChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHVyaSwgdW5kZWZpbmVkLCB0b2tlbikpLnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0YXN5bmMgc2VsZWN0UHJvZmlsZSgpOiBQcm9taXNlPFVSSSB8IG51bGw+IHtcblx0XHRjb25zdCBwcm9maWxlTG9jYXRpb24gPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHtcblx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IGZhbHNlLFxuXHRcdFx0Y2FuU2VsZWN0RmlsZXM6IHRydWUsXG5cdFx0XHRjYW5TZWxlY3RNYW55OiBmYWxzZSxcblx0XHRcdGZpbHRlcnM6IFBST0ZJTEVfRklMVEVSLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZWxlY3QgcHJvZmlsZScsIFwiU2VsZWN0IFByb2ZpbGVcIiksXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHByb2ZpbGVMb2NhdGlvbiA/IHByb2ZpbGVMb2NhdGlvblswXSA6IG51bGw7XG5cdH1cblxufVxuXG5jb25zdCBVU0VSX0RBVEFfUFJPRklMRV9FWFBPUlRfU0NIRU1FID0gJ3VzZXJkYXRhcHJvZmlsZWV4cG9ydCc7XG5jb25zdCBVU0VSX0RBVEFfUFJPRklMRV9FWFBPUlRfUFJFVklFV19TQ0hFTUUgPSAndXNlcmRhdGFwcm9maWxlZXhwb3J0cHJldmlldyc7XG5cbmFic3RyYWN0IGNsYXNzIFVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFN0YXRlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUcmVlVmlld0RhdGFQcm92aWRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSb290cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVJvb3RzID0gdGhpcy5fb25EaWRDaGFuZ2VSb290cy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YXN5bmMgZ2V0Q2hpbGRyZW4oZWxlbWVudD86IElUcmVlSXRlbSk6IFByb21pc2U8SVRyZWVJdGVtW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBhd2FpdCAoPElQcm9maWxlUmVzb3VyY2VUcmVlSXRlbT5lbGVtZW50KS5nZXRDaGlsZHJlbigpO1xuXHRcdFx0aWYgKGNoaWxkcmVuKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRpZiAoY2hpbGQucGFyZW50LmNoZWNrYm94ICYmIGNoaWxkLmNoZWNrYm94KSB7XG5cdFx0XHRcdFx0XHRjaGlsZC5jaGVja2JveC5pc0NoZWNrZWQgPSBjaGlsZC5wYXJlbnQuY2hlY2tib3guaXNDaGVja2VkICYmIGNoaWxkLmNoZWNrYm94LmlzQ2hlY2tlZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yb290c1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJvb3RzLmZpcmUoKTtcblx0XHRcdHJldHVybiB0aGlzLmdldFJvb3RzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByb290czogSVByb2ZpbGVSZXNvdXJjZVRyZWVJdGVtW10gPSBbXTtcblx0cHJpdmF0ZSByb290c1Byb21pc2U6IFByb21pc2U8SVByb2ZpbGVSZXNvdXJjZVRyZWVJdGVtW10+IHwgdW5kZWZpbmVkO1xuXHRnZXRSb290cygpOiBQcm9taXNlPElQcm9maWxlUmVzb3VyY2VUcmVlSXRlbVtdPiB7XG5cdFx0aWYgKCF0aGlzLnJvb3RzUHJvbWlzZSkge1xuXHRcdFx0dGhpcy5yb290c1Byb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJvb3RzID0gYXdhaXQgdGhpcy5mZXRjaFJvb3RzKCk7XG5cdFx0XHRcdGZvciAoY29uc3Qgcm9vdCBvZiB0aGlzLnJvb3RzKSB7XG5cdFx0XHRcdFx0cm9vdC5jaGVja2JveCA9IHtcblx0XHRcdFx0XHRcdGlzQ2hlY2tlZDogIXJvb3QuaXNGcm9tRGVmYXVsdFByb2ZpbGUoKSxcblx0XHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdzZWxlY3QnLCBcIlNlbGVjdCB7MH1cIiwgcm9vdC5sYWJlbC5sYWJlbCksXG5cdFx0XHRcdFx0XHRhY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb246IHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzZWxlY3QnLCBcIlNlbGVjdCB7MH1cIiwgcm9vdC5sYWJlbC5sYWJlbCksXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRpZiAocm9vdC5pc0Zyb21EZWZhdWx0UHJvZmlsZSgpKSB7XG5cdFx0XHRcdFx0XHRyb290LmRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ2Zyb20gZGVmYXVsdCcsIFwiRnJvbSBEZWZhdWx0IFByb2ZpbGVcIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnJvb3RzO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucm9vdHNQcm9taXNlO1xuXHR9XG5cblx0aXNFbmFibGVkKHJlc291cmNlVHlwZT86IFByb2ZpbGVSZXNvdXJjZVR5cGUpOiBib29sZWFuIHtcblx0XHRpZiAocmVzb3VyY2VUeXBlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLnJvb3RzLnNvbWUocm9vdCA9PiByb290LnR5cGUgPT09IHJlc291cmNlVHlwZSAmJiB0aGlzLmlzU2VsZWN0ZWQocm9vdCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5yb290cy5zb21lKHJvb3QgPT4gdGhpcy5pc1NlbGVjdGVkKHJvb3QpKTtcblx0fVxuXG5cdGFzeW5jIGdldFByb2ZpbGVUZW1wbGF0ZShuYW1lOiBzdHJpbmcsIGljb246IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZVRlbXBsYXRlPiB7XG5cdFx0Y29uc3Qgcm9vdHMgPSBhd2FpdCB0aGlzLmdldFJvb3RzKCk7XG5cdFx0bGV0IHNldHRpbmdzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGtleWJpbmRpbmdzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHRhc2tzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHNuaXBwZXRzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGV4dGVuc2lvbnM6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZ2xvYmFsU3RhdGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IHJvb3Qgb2Ygcm9vdHMpIHtcblx0XHRcdGlmICghdGhpcy5pc1NlbGVjdGVkKHJvb3QpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJvb3QgaW5zdGFuY2VvZiBTZXR0aW5nc1Jlc291cmNlVHJlZUl0ZW0pIHtcblx0XHRcdFx0c2V0dGluZ3MgPSBhd2FpdCByb290LmdldENvbnRlbnQoKTtcblx0XHRcdH0gZWxzZSBpZiAocm9vdCBpbnN0YW5jZW9mIEtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSkge1xuXHRcdFx0XHRrZXliaW5kaW5ncyA9IGF3YWl0IHJvb3QuZ2V0Q29udGVudCgpO1xuXHRcdFx0fSBlbHNlIGlmIChyb290IGluc3RhbmNlb2YgVGFza3NSZXNvdXJjZVRyZWVJdGVtKSB7XG5cdFx0XHRcdHRhc2tzID0gYXdhaXQgcm9vdC5nZXRDb250ZW50KCk7XG5cdFx0XHR9IGVsc2UgaWYgKHJvb3QgaW5zdGFuY2VvZiBTbmlwcGV0c1Jlc291cmNlVHJlZUl0ZW0pIHtcblx0XHRcdFx0c25pcHBldHMgPSBhd2FpdCByb290LmdldENvbnRlbnQoKTtcblx0XHRcdH0gZWxzZSBpZiAocm9vdCBpbnN0YW5jZW9mIEV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtKSB7XG5cdFx0XHRcdGV4dGVuc2lvbnMgPSBhd2FpdCByb290LmdldENvbnRlbnQoKTtcblx0XHRcdH0gZWxzZSBpZiAocm9vdCBpbnN0YW5jZW9mIEdsb2JhbFN0YXRlUmVzb3VyY2VUcmVlSXRlbSkge1xuXHRcdFx0XHRnbG9iYWxTdGF0ZSA9IGF3YWl0IHJvb3QuZ2V0Q29udGVudCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lLFxuXHRcdFx0aWNvbixcblx0XHRcdHNldHRpbmdzLFxuXHRcdFx0a2V5YmluZGluZ3MsXG5cdFx0XHR0YXNrcyxcblx0XHRcdHNuaXBwZXRzLFxuXHRcdFx0ZXh0ZW5zaW9ucyxcblx0XHRcdGdsb2JhbFN0YXRlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgaXNTZWxlY3RlZCh0cmVlSXRlbTogSVByb2ZpbGVSZXNvdXJjZVRyZWVJdGVtKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRyZWVJdGVtLmNoZWNrYm94KSB7XG5cdFx0XHRyZXR1cm4gdHJlZUl0ZW0uY2hlY2tib3guaXNDaGVja2VkIHx8ICEhdHJlZUl0ZW0uY2hpbGRyZW4/LnNvbWUoY2hpbGQgPT4gY2hpbGQuY2hlY2tib3g/LmlzQ2hlY2tlZCk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGZldGNoUm9vdHMoKTogUHJvbWlzZTxJUHJvZmlsZVJlc291cmNlVHJlZUl0ZW1bXT47XG59XG5cbmNsYXNzIFVzZXJEYXRhUHJvZmlsZUV4cG9ydFN0YXRlIGV4dGVuZHMgVXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U3RhdGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHBvcnRGbGFnczogUHJvZmlsZVJlc291cmNlVHlwZUZsYWdzIHwgdW5kZWZpbmVkLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihxdWlja0lucHV0U2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZmV0Y2hSb290cygpOiBQcm9taXNlPElQcm9maWxlUmVzb3VyY2VUcmVlSXRlbVtdPiB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihVU0VSX0RBVEFfUFJPRklMRV9FWFBPUlRfU0NIRU1FLCB0aGlzLl9yZWdpc3RlcihuZXcgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSkpKTtcblx0XHRjb25zdCBwcmV2aWV3RmlsZVN5c3RlbVByb3ZpZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihVU0VSX0RBVEFfUFJPRklMRV9FWFBPUlRfUFJFVklFV19TQ0hFTUUsIHByZXZpZXdGaWxlU3lzdGVtUHJvdmlkZXIpKTtcblx0XHRjb25zdCByb290czogSVByb2ZpbGVSZXNvdXJjZVRyZWVJdGVtW10gPSBbXTtcblx0XHRjb25zdCBleHBvcnRQcmV2aWV3UHJvZmxlID0gdGhpcy5jcmVhdGVFeHBvcnRQcmV2aWV3UHJvZmlsZSh0aGlzLnByb2ZpbGUpO1xuXG5cdFx0aWYgKHRoaXMuZXhwb3J0RmxhZ3M/LnNldHRpbmdzID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdzUmVzb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3Qgc2V0dGluZ3NDb250ZW50ID0gYXdhaXQgc2V0dGluZ3NSZXNvdXJjZS5nZXRDb250ZW50KHRoaXMucHJvZmlsZSk7XG5cdFx0XHRhd2FpdCBzZXR0aW5nc1Jlc291cmNlLmFwcGx5KHNldHRpbmdzQ29udGVudCwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRjb25zdCBzZXR0aW5nc1Jlc291cmNlVHJlZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzUmVzb3VyY2VUcmVlSXRlbSwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRpZiAoYXdhaXQgc2V0dGluZ3NSZXNvdXJjZVRyZWVJdGVtLmhhc0NvbnRlbnQoKSkge1xuXHRcdFx0XHRyb290cy5wdXNoKHNldHRpbmdzUmVzb3VyY2VUcmVlSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXhwb3J0RmxhZ3M/LmtleWJpbmRpbmdzID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IGtleWJpbmRpbmdzUmVzb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdzUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZ3NDb250ZW50ID0gYXdhaXQga2V5YmluZGluZ3NSZXNvdXJjZS5nZXRDb250ZW50KHRoaXMucHJvZmlsZSk7XG5cdFx0XHRhd2FpdCBrZXliaW5kaW5nc1Jlc291cmNlLmFwcGx5KGtleWJpbmRpbmdzQ29udGVudCwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nc1Jlc291cmNlVHJlZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRpZiAoYXdhaXQga2V5YmluZGluZ3NSZXNvdXJjZVRyZWVJdGVtLmhhc0NvbnRlbnQoKSkge1xuXHRcdFx0XHRyb290cy5wdXNoKGtleWJpbmRpbmdzUmVzb3VyY2VUcmVlSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXhwb3J0RmxhZ3M/LnNuaXBwZXRzID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IHNuaXBwZXRzUmVzb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRzUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3Qgc25pcHBldHNDb250ZW50ID0gYXdhaXQgc25pcHBldHNSZXNvdXJjZS5nZXRDb250ZW50KHRoaXMucHJvZmlsZSk7XG5cdFx0XHRhd2FpdCBzbmlwcGV0c1Jlc291cmNlLmFwcGx5KHNuaXBwZXRzQ29udGVudCwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRjb25zdCBzbmlwcGV0c1Jlc291cmNlVHJlZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRzUmVzb3VyY2VUcmVlSXRlbSwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRpZiAoYXdhaXQgc25pcHBldHNSZXNvdXJjZVRyZWVJdGVtLmhhc0NvbnRlbnQoKSkge1xuXHRcdFx0XHRyb290cy5wdXNoKHNuaXBwZXRzUmVzb3VyY2VUcmVlSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXhwb3J0RmxhZ3M/LnRhc2tzID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRhc2tzUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgdGFza3NDb250ZW50ID0gYXdhaXQgdGFza3NSZXNvdXJjZS5nZXRDb250ZW50KHRoaXMucHJvZmlsZSk7XG5cdFx0XHRhd2FpdCB0YXNrc1Jlc291cmNlLmFwcGx5KHRhc2tzQ29udGVudCwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlVHJlZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRhc2tzUmVzb3VyY2VUcmVlSXRlbSwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRpZiAoYXdhaXQgdGFza3NSZXNvdXJjZVRyZWVJdGVtLmhhc0NvbnRlbnQoKSkge1xuXHRcdFx0XHRyb290cy5wdXNoKHRhc2tzUmVzb3VyY2VUcmVlSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXhwb3J0RmxhZ3M/Lmdsb2JhbFN0YXRlID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IGdsb2JhbFN0YXRlUmVzb3VyY2UgPSBqb2luUGF0aChleHBvcnRQcmV2aWV3UHJvZmxlLmdsb2JhbFN0b3JhZ2VIb21lLCAnZ2xvYmFsU3RhdGUuanNvbicpLndpdGgoeyBzY2hlbWU6IFVTRVJfREFUQV9QUk9GSUxFX0VYUE9SVF9QUkVWSUVXX1NDSEVNRSB9KTtcblx0XHRcdGNvbnN0IGdsb2JhbFN0YXRlUmVzb3VyY2VUcmVlSXRlbSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoR2xvYmFsU3RhdGVSZXNvdXJjZUV4cG9ydFRyZWVJdGVtLCBleHBvcnRQcmV2aWV3UHJvZmxlLCBnbG9iYWxTdGF0ZVJlc291cmNlKTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBnbG9iYWxTdGF0ZVJlc291cmNlVHJlZUl0ZW0uZ2V0Q29udGVudCgpO1xuXHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUoZ2xvYmFsU3RhdGVSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShKU09OLnBhcnNlKGNvbnRlbnQpLCBudWxsLCAnXFx0JykpKTtcblx0XHRcdFx0cm9vdHMucHVzaChnbG9iYWxTdGF0ZVJlc291cmNlVHJlZUl0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4cG9ydEZsYWdzPy5leHRlbnNpb25zID8/IHRydWUpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2VFeHBvcnRUcmVlSXRlbSwgZXhwb3J0UHJldmlld1Byb2ZsZSk7XG5cdFx0XHRpZiAoYXdhaXQgZXh0ZW5zaW9uc1Jlc291cmNlVHJlZUl0ZW0uaGFzQ29udGVudCgpKSB7XG5cdFx0XHRcdHJvb3RzLnB1c2goZXh0ZW5zaW9uc1Jlc291cmNlVHJlZUl0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByZXZpZXdGaWxlU3lzdGVtUHJvdmlkZXIuc2V0UmVhZE9ubHkodHJ1ZSk7XG5cblx0XHRyZXR1cm4gcm9vdHM7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUV4cG9ydFByZXZpZXdQcm9maWxlKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBJVXNlckRhdGFQcm9maWxlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHByb2ZpbGUuaWQsXG5cdFx0XHRuYW1lOiBwcm9maWxlLm5hbWUsXG5cdFx0XHRsb2NhdGlvbjogcHJvZmlsZS5sb2NhdGlvbixcblx0XHRcdGlzRGVmYXVsdDogcHJvZmlsZS5pc0RlZmF1bHQsXG5cdFx0XHRpY29uOiBwcm9maWxlLmljb24sXG5cdFx0XHRnbG9iYWxTdG9yYWdlSG9tZTogcHJvZmlsZS5nbG9iYWxTdG9yYWdlSG9tZSxcblx0XHRcdHNldHRpbmdzUmVzb3VyY2U6IHByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBVU0VSX0RBVEFfUFJPRklMRV9FWFBPUlRfU0NIRU1FIH0pLFxuXHRcdFx0a2V5YmluZGluZ3NSZXNvdXJjZTogcHJvZmlsZS5rZXliaW5kaW5nc1Jlc291cmNlLndpdGgoeyBzY2hlbWU6IFVTRVJfREFUQV9QUk9GSUxFX0VYUE9SVF9TQ0hFTUUgfSksXG5cdFx0XHR0YXNrc1Jlc291cmNlOiBwcm9maWxlLnRhc2tzUmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1BST0ZJTEVfRVhQT1JUX1NDSEVNRSB9KSxcblx0XHRcdHNuaXBwZXRzSG9tZTogcHJvZmlsZS5zbmlwcGV0c0hvbWUud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1BST0ZJTEVfRVhQT1JUX1NDSEVNRSB9KSxcblx0XHRcdHByb21wdHNIb21lOiBwcm9maWxlLnByb21wdHNIb21lLndpdGgoeyBzY2hlbWU6IFVTRVJfREFUQV9QUk9GSUxFX0VYUE9SVF9TQ0hFTUUgfSksXG5cdFx0XHRleHRlbnNpb25zUmVzb3VyY2U6IHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLFxuXHRcdFx0Y2FjaGVIb21lOiBwcm9maWxlLmNhY2hlSG9tZSxcblx0XHRcdHVzZURlZmF1bHRGbGFnczogcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3MsXG5cdFx0XHRpc1RyYW5zaWVudDogcHJvZmlsZS5pc1RyYW5zaWVudFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBnZXRQcm9maWxlVG9FeHBvcnQoKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlVGVtcGxhdGUgfCBudWxsPiB7XG5cdFx0bGV0IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHRoaXMucHJvZmlsZS5uYW1lO1xuXHRcdGlmICh0aGlzLnByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRuYW1lID0gYXdhaXQgdGhpcy5xdWlja0lucHV0U2VydmljZS5pbnB1dCh7XG5cdFx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnZXhwb3J0IHByb2ZpbGUgbmFtZScsIFwiTmFtZSB0aGUgcHJvZmlsZVwiKSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdleHBvcnQgcHJvZmlsZSB0aXRsZScsIFwiRXhwb3J0IFByb2ZpbGVcIiksXG5cdFx0XHRcdGFzeW5jIHZhbGlkYXRlSW5wdXQoaW5wdXQpIHtcblx0XHRcdFx0XHRpZiAoIWlucHV0LnRyaW0oKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdwcm9maWxlIG5hbWUgcmVxdWlyZWQnLCBcIlByb2ZpbGUgbmFtZSBtdXN0IGJlIHByb3ZpZGVkLlwiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFuYW1lKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5nZXRQcm9maWxlVGVtcGxhdGUobmFtZSwgdGhpcy5wcm9maWxlLmljb24pO1xuXHR9XG5cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2UsIFVzZXJEYXRhUHJvZmlsZUltcG9ydEV4cG9ydFNlcnZpY2Us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
