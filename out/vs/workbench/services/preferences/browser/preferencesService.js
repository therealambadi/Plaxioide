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
import { getErrorMessage } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { parse } from "../../../../base/common/json.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as network from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { CoreEditingCommands } from "../../../../editor/browser/coreCommands.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions, getDefaultValue, OVERRIDE_PROPERTY_REGEX } from "../../../../platform/configuration/common/configurationRegistry.js";
import { FileOperationResult } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { GroupDirection, IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { IEditorService, SIDE_GROUP } from "../../editor/common/editorService.js";
import { KeybindingsEditorInput } from "./keybindingsEditorInput.js";
import { DEFAULT_SETTINGS_EDITOR_SETTING, FOLDER_SETTINGS_PATH, IPreferencesService, SETTINGS_AUTHORITY, USE_SPLIT_JSON_SETTING, validateSettingsEditorOptions } from "../common/preferences.js";
import { SettingsEditor2Input } from "../common/preferencesEditorInput.js";
import { defaultKeybindingsContents, DefaultKeybindingsEditorModel, DefaultRawSettingsEditorModel, DefaultSettings, DefaultSettingsEditorModel, Settings2EditorModel, SettingsEditorModel, WorkspaceConfigurationEditorModel } from "../common/preferencesModels.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { ITextEditorService } from "../../textfile/common/textEditorService.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { isObject } from "../../../../base/common/types.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { compareIgnoreCase } from "../../../../base/common/strings.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { findGroup } from "../../editor/common/editorGroupFinder.js";
const emptyEditableSettingsContent = "{\n}";
let PreferencesService = class extends Disposable {
  constructor(editorService, editorGroupService, textFileService, configurationService, notificationService, contextService, instantiationService, userDataProfileService, userDataProfilesService, textModelResolverService, keybindingService, modelService, jsonEditingService, labelService, remoteAgentService, textEditorService, urlService, extensionService, progressService) {
    super();
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.textFileService = textFileService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.textModelResolverService = textModelResolverService;
    this.jsonEditingService = jsonEditingService;
    this.labelService = labelService;
    this.remoteAgentService = remoteAgentService;
    this.textEditorService = textEditorService;
    this.extensionService = extensionService;
    this.progressService = progressService;
    this._onDispose = this._register(new Emitter());
    this._onDidDefaultSettingsContentChanged = this._register(new Emitter());
    this.onDidDefaultSettingsContentChanged = this._onDidDefaultSettingsContentChanged.event;
    this._requestedDefaultSettings = new ResourceSet();
    this._settingsGroups = void 0;
    this._cachedSettingsEditor2Input = void 0;
    this.defaultKeybindingsResource = URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: "/keybindings.json" });
    this.defaultSettingsRawResource = URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: "/defaultSettings.json" });
    this._register(keybindingService.onDidUpdateKeybindings(() => {
      const model = modelService.getModel(this.defaultKeybindingsResource);
      if (!model) {
        return;
      }
      modelService.updateModel(model, defaultKeybindingsContents(keybindingService));
    }));
    this._register(urlService.registerHandler(this));
  }
  get userSettingsResource() {
    return this.userDataProfileService.currentProfile.settingsResource;
  }
  get workspaceSettingsResource() {
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return null;
    }
    const workspace = this.contextService.getWorkspace();
    return workspace.configuration || workspace.folders[0].toResource(FOLDER_SETTINGS_PATH);
  }
  createOrGetCachedSettingsEditor2Input() {
    if (!this._cachedSettingsEditor2Input || this._cachedSettingsEditor2Input.isDisposed()) {
      this._cachedSettingsEditor2Input = new SettingsEditor2Input(this);
    }
    return this._cachedSettingsEditor2Input;
  }
  getFolderSettingsResource(resource) {
    const folder = this.contextService.getWorkspaceFolder(resource);
    return folder ? folder.toResource(FOLDER_SETTINGS_PATH) : null;
  }
  hasDefaultSettingsContent(uri) {
    return this.isDefaultSettingsResource(uri) || isEqual(uri, this.defaultSettingsRawResource) || isEqual(uri, this.defaultKeybindingsResource);
  }
  getDefaultSettingsContent(uri) {
    if (this.isDefaultSettingsResource(uri)) {
      const target = this.getConfigurationTargetFromDefaultSettingsResource(uri);
      const defaultSettings = this.getDefaultSettings(target);
      if (!this._requestedDefaultSettings.has(uri)) {
        this._register(defaultSettings.onDidChange(() => this._onDidDefaultSettingsContentChanged.fire(uri)));
        this._requestedDefaultSettings.add(uri);
      }
      return defaultSettings.getContentWithoutMostCommonlyUsed(true);
    }
    if (isEqual(uri, this.defaultSettingsRawResource)) {
      if (!this._defaultRawSettingsEditorModel) {
        this._defaultRawSettingsEditorModel = this._register(this.instantiationService.createInstance(DefaultRawSettingsEditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL)));
        this._register(this._defaultRawSettingsEditorModel.onDidContentChanged(() => this._onDidDefaultSettingsContentChanged.fire(uri)));
      }
      return this._defaultRawSettingsEditorModel.content;
    }
    if (isEqual(uri, this.defaultKeybindingsResource)) {
      const defaultKeybindingsEditorModel = this.instantiationService.createInstance(DefaultKeybindingsEditorModel, uri);
      return defaultKeybindingsEditorModel.content;
    }
    return void 0;
  }
  async createPreferencesEditorModel(uri) {
    if (this.isDefaultSettingsResource(uri)) {
      return this.createDefaultSettingsEditorModel(uri);
    }
    if (this.userSettingsResource.toString() === uri.toString() || this.userDataProfilesService.defaultProfile.settingsResource.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_LOCAL, uri);
    }
    const workspaceSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE);
    if (workspaceSettingsUri && workspaceSettingsUri.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE, workspaceSettingsUri);
    }
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const settingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, uri);
      if (settingsUri && settingsUri.toString() === uri.toString()) {
        return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE_FOLDER, uri);
      }
    }
    const remoteEnvironment = await this.remoteAgentService.getEnvironment();
    const remoteSettingsUri = remoteEnvironment ? remoteEnvironment.settingsPath : null;
    if (remoteSettingsUri && remoteSettingsUri.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_REMOTE, uri);
    }
    return null;
  }
  openRawDefaultSettings() {
    return this.editorService.openEditor({ resource: this.defaultSettingsRawResource });
  }
  openRawUserSettings() {
    return this.editorService.openEditor({ resource: this.userSettingsResource });
  }
  shouldOpenJsonByDefault() {
    return this.configurationService.getValue("workbench.settings.editor") === "json";
  }
  openSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    if (options.query) {
      options.jsonEditor = false;
    }
    return this.open(this.userSettingsResource, options);
  }
  openLanguageSpecificSettings(languageId, options = {}) {
    if (this.shouldOpenJsonByDefault()) {
      options.query = void 0;
      options.revealSetting = { key: `[${languageId}]`, edit: true };
    } else {
      options.query = `@lang:${languageId}${options.query ? ` ${options.query}` : ""}`;
    }
    options.target = options.target ?? ConfigurationTarget.USER_LOCAL;
    return this.open(this.userSettingsResource, options);
  }
  open(settingsResource, options) {
    options = {
      ...options,
      jsonEditor: options.jsonEditor ?? this.shouldOpenJsonByDefault()
    };
    return options.jsonEditor ? this.openSettingsJson(settingsResource, options) : this.openSettings2(options);
  }
  async openSettings2(options) {
    const input = this.createOrGetCachedSettingsEditor2Input();
    options = {
      ...options,
      focusSearch: true
    };
    const group = await this.getEditorGroupFromOptions(options);
    return group.openEditor(input, validateSettingsEditorOptions(options));
  }
  openApplicationSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    return this.open(this.userDataProfilesService.defaultProfile.settingsResource, options);
  }
  openUserSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    return this.open(this.userSettingsResource, options);
  }
  async openRemoteSettings(options = {}) {
    const environment = await this.remoteAgentService.getEnvironment();
    if (environment) {
      options = {
        ...options,
        target: ConfigurationTarget.USER_REMOTE
      };
      this.open(environment.settingsPath, options);
    }
    return void 0;
  }
  openWorkspaceSettings(options = {}) {
    if (!this.workspaceSettingsResource) {
      this.notificationService.info(nls.localize("openFolderFirst", "Open a folder or workspace first to create workspace or folder settings."));
      return Promise.reject(null);
    }
    options = {
      ...options,
      target: ConfigurationTarget.WORKSPACE
    };
    return this.open(this.workspaceSettingsResource, options);
  }
  async openFolderSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.WORKSPACE_FOLDER
    };
    if (!options.folderUri) {
      throw new Error(`Missing folder URI`);
    }
    const folderSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, options.folderUri);
    if (!folderSettingsUri) {
      throw new Error(`Invalid folder URI - ${options.folderUri.toString()}`);
    }
    return this.open(folderSettingsUri, options);
  }
  async openGlobalKeybindingSettings(textual, options) {
    options = { pinned: true, revealIfOpened: true, ...options };
    if (textual) {
      const emptyContents = "// " + nls.localize("emptyKeybindingsHeader", "Place your key bindings in this file to override the defaults") + "\n[\n]";
      const editableKeybindings = this.userDataProfileService.currentProfile.keybindingsResource;
      const openDefaultKeybindings = !!this.configurationService.getValue("workbench.settings.openDefaultKeybindings");
      await this.createIfNotExists(editableKeybindings, emptyContents);
      if (openDefaultKeybindings) {
        const sourceGroupId = options.groupId ?? this.editorGroupService.activeGroup.id;
        const sideEditorGroup = this.editorGroupService.addGroup(sourceGroupId, GroupDirection.RIGHT);
        await Promise.all([
          this.editorService.openEditor({ resource: this.defaultKeybindingsResource, options: { pinned: true, preserveFocus: true, revealIfOpened: true, override: DEFAULT_EDITOR_ASSOCIATION.id }, label: nls.localize("defaultKeybindings", "Default Keybindings"), description: "" }, sourceGroupId),
          this.editorService.openEditor({ resource: editableKeybindings, options }, sideEditorGroup.id)
        ]);
      } else {
        await this.editorService.openEditor({ resource: editableKeybindings, options }, options.groupId);
      }
    } else {
      const editor = await this.editorService.openEditor(this.instantiationService.createInstance(KeybindingsEditorInput), { ...options }, options.groupId);
      if (options.query) {
        editor.search(options.query);
      }
    }
  }
  openDefaultKeybindingsFile() {
    return this.editorService.openEditor({ resource: this.defaultKeybindingsResource, label: nls.localize("defaultKeybindings", "Default Keybindings") });
  }
  async getEditorGroupFromOptions(options) {
    let group = options?.groupId !== void 0 ? this.editorGroupService.getGroup(options.groupId) ?? this.editorGroupService.activeGroup : this.editorGroupService.activeGroup;
    if (options.openToSide) {
      group = (await this.instantiationService.invokeFunction(findGroup, {}, SIDE_GROUP))[0];
    }
    return group;
  }
  async openSettingsJson(resource, options) {
    const group = await this.getEditorGroupFromOptions(options);
    const editor = await this.doOpenSettingsJson(resource, options, group);
    if (editor && options?.revealSetting) {
      await this.revealSetting(options.revealSetting.key, !!options.revealSetting.edit, editor, resource);
    }
    return editor;
  }
  async doOpenSettingsJson(resource, options, group) {
    const openSplitJSON = !!this.configurationService.getValue(USE_SPLIT_JSON_SETTING);
    const openDefaultSettings = !!this.configurationService.getValue(DEFAULT_SETTINGS_EDITOR_SETTING);
    if (openSplitJSON || openDefaultSettings) {
      return this.doOpenSplitJSON(resource, options, group);
    }
    const configurationTarget = options?.target ?? ConfigurationTarget.USER;
    const editableSettingsEditorInput = await this.getOrCreateEditableSettingsEditorInput(configurationTarget, resource);
    options = { ...options, pinned: true };
    return await group.openEditor(editableSettingsEditorInput, { ...validateSettingsEditorOptions(options) });
  }
  async doOpenSplitJSON(resource, options = {}, group) {
    const configurationTarget = options.target ?? ConfigurationTarget.USER;
    await this.createSettingsIfNotExists(configurationTarget, resource);
    const preferencesEditorInput = this.createSplitJsonEditorInput(configurationTarget, resource);
    options = { ...options, pinned: true };
    return group.openEditor(preferencesEditorInput, validateSettingsEditorOptions(options));
  }
  createSplitJsonEditorInput(configurationTarget, resource) {
    const editableSettingsEditorInput = this.textEditorService.createTextEditor({ resource });
    const defaultPreferencesEditorInput = this.textEditorService.createTextEditor({ resource: this.getDefaultSettingsResource(configurationTarget) });
    return this.instantiationService.createInstance(SideBySideEditorInput, editableSettingsEditorInput.getName(), void 0, defaultPreferencesEditorInput, editableSettingsEditorInput);
  }
  createSettings2EditorModel() {
    return this.instantiationService.createInstance(Settings2EditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL));
  }
  getConfigurationTargetFromDefaultSettingsResource(uri) {
    return this.isDefaultWorkspaceSettingsResource(uri) ? ConfigurationTarget.WORKSPACE : this.isDefaultFolderSettingsResource(uri) ? ConfigurationTarget.WORKSPACE_FOLDER : ConfigurationTarget.USER_LOCAL;
  }
  isDefaultSettingsResource(uri) {
    return this.isDefaultUserSettingsResource(uri) || this.isDefaultWorkspaceSettingsResource(uri) || this.isDefaultFolderSettingsResource(uri);
  }
  isDefaultUserSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?settings\.json$/);
  }
  isDefaultWorkspaceSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?workspaceSettings\.json$/);
  }
  isDefaultFolderSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?resourceSettings\.json$/);
  }
  getDefaultSettingsResource(configurationTarget) {
    switch (configurationTarget) {
      case ConfigurationTarget.WORKSPACE:
        return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/workspaceSettings.json` });
      case ConfigurationTarget.WORKSPACE_FOLDER:
        return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/resourceSettings.json` });
    }
    return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/settings.json` });
  }
  async getOrCreateEditableSettingsEditorInput(target, resource) {
    await this.createSettingsIfNotExists(target, resource);
    return this.textEditorService.createTextEditor({ resource });
  }
  async createEditableSettingsEditorModel(configurationTarget, settingsUri) {
    const workspace = this.contextService.getWorkspace();
    if (workspace.configuration && workspace.configuration.toString() === settingsUri.toString()) {
      const reference2 = await this.textModelResolverService.createModelReference(settingsUri);
      return this.instantiationService.createInstance(WorkspaceConfigurationEditorModel, reference2, configurationTarget);
    }
    const reference = await this.textModelResolverService.createModelReference(settingsUri);
    return this.instantiationService.createInstance(SettingsEditorModel, reference, configurationTarget);
  }
  async createDefaultSettingsEditorModel(defaultSettingsUri) {
    const reference = await this.textModelResolverService.createModelReference(defaultSettingsUri);
    const target = this.getConfigurationTargetFromDefaultSettingsResource(defaultSettingsUri);
    return this.instantiationService.createInstance(DefaultSettingsEditorModel, defaultSettingsUri, reference, this.getDefaultSettings(target));
  }
  getDefaultSettings(target) {
    if (target === ConfigurationTarget.WORKSPACE) {
      this._defaultWorkspaceSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
      return this._defaultWorkspaceSettingsContentModel;
    }
    if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
      this._defaultFolderSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
      return this._defaultFolderSettingsContentModel;
    }
    this._defaultUserSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
    return this._defaultUserSettingsContentModel;
  }
  async getEditableSettingsURI(configurationTarget, resource) {
    switch (configurationTarget) {
      case ConfigurationTarget.APPLICATION:
        return this.userDataProfilesService.defaultProfile.settingsResource;
      case ConfigurationTarget.USER:
      case ConfigurationTarget.USER_LOCAL:
        return this.userSettingsResource;
      case ConfigurationTarget.USER_REMOTE: {
        const remoteEnvironment = await this.remoteAgentService.getEnvironment();
        return remoteEnvironment ? remoteEnvironment.settingsPath : null;
      }
      case ConfigurationTarget.WORKSPACE:
        return this.workspaceSettingsResource;
      case ConfigurationTarget.WORKSPACE_FOLDER:
        if (resource) {
          return this.getFolderSettingsResource(resource);
        }
    }
    return null;
  }
  async createSettingsIfNotExists(target, resource) {
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && target === ConfigurationTarget.WORKSPACE) {
      const workspaceConfig = this.contextService.getWorkspace().configuration;
      if (!workspaceConfig) {
        return;
      }
      const content = await this.textFileService.read(workspaceConfig);
      if (Object.keys(parse(content.value)).indexOf("settings") === -1) {
        await this.jsonEditingService.write(resource, [{ path: ["settings"], value: {} }], true);
      }
      return void 0;
    }
    await this.createIfNotExists(resource, emptyEditableSettingsContent);
  }
  async createIfNotExists(resource, contents) {
    try {
      await this.textFileService.read(resource, { acceptTextOnly: true });
    } catch (error) {
      if (error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
        try {
          await this.textFileService.write(resource, contents);
          return;
        } catch (error2) {
          throw new Error(nls.localize("fail.createSettings", "Unable to create '{0}' ({1}).", this.labelService.getUriLabel(resource, { relative: true }), getErrorMessage(error2)));
        }
      } else {
        throw error;
      }
    }
  }
  getMostCommonlyUsedSettings() {
    return [
      "files.autoSave",
      "editor.fontSize",
      "editor.fontFamily",
      "editor.tabSize",
      "editor.renderWhitespace",
      "editor.cursorStyle",
      "editor.multiCursorModifier",
      "editor.insertSpaces",
      "editor.wordWrap",
      "files.exclude",
      "files.associations",
      "workbench.editor.enablePreview"
    ];
  }
  async revealSetting(settingKey, edit, editor, settingsResource) {
    const codeEditor = editor ? getCodeEditor(editor.getControl()) : null;
    if (!codeEditor) {
      return;
    }
    const settingsModel = await this.createPreferencesEditorModel(settingsResource);
    if (!settingsModel) {
      return;
    }
    const position = await this.getPositionToReveal(settingKey, edit, settingsModel, codeEditor);
    if (position) {
      codeEditor.setPosition(position);
      codeEditor.revealPositionNearTop(position);
      codeEditor.focus();
      if (edit) {
        SuggestController.get(codeEditor)?.triggerSuggest();
      }
    }
  }
  async getPositionToReveal(settingKey, edit, settingsModel, codeEditor) {
    const model = codeEditor.getModel();
    if (!model) {
      return null;
    }
    const schema = Registry.as(Extensions.Configuration).getConfigurationProperties()[settingKey];
    const isOverrideProperty = OVERRIDE_PROPERTY_REGEX.test(settingKey);
    if (!schema && !isOverrideProperty) {
      return null;
    }
    let position = null;
    const type = schema?.type ?? "object";
    let setting = settingsModel.getPreference(settingKey);
    if (!setting && edit) {
      let defaultValue = type === "object" || type === "array" ? this.configurationService.inspect(settingKey).defaultValue : getDefaultValue(type);
      defaultValue = defaultValue === void 0 && isOverrideProperty ? {} : defaultValue;
      if (defaultValue !== void 0) {
        const key = settingsModel instanceof WorkspaceConfigurationEditorModel ? ["settings", settingKey] : [settingKey];
        await this.jsonEditingService.write(settingsModel.uri, [{ path: key, value: defaultValue }], false);
        setting = settingsModel.getPreference(settingKey);
      }
    }
    if (setting) {
      if (edit) {
        if (isObject(setting.value) || Array.isArray(setting.value)) {
          position = { lineNumber: setting.valueRange.startLineNumber, column: setting.valueRange.startColumn + 1 };
          codeEditor.setPosition(position);
          await CoreEditingCommands.LineBreakInsert.runEditorCommand(null, codeEditor, null);
          position = { lineNumber: position.lineNumber + 1, column: model.getLineMaxColumn(position.lineNumber + 1) };
          const firstNonWhiteSpaceColumn = model.getLineFirstNonWhitespaceColumn(position.lineNumber);
          if (firstNonWhiteSpaceColumn) {
            codeEditor.setPosition({ lineNumber: position.lineNumber, column: firstNonWhiteSpaceColumn });
            await CoreEditingCommands.LineBreakInsert.runEditorCommand(null, codeEditor, null);
            position = { lineNumber: position.lineNumber, column: model.getLineMaxColumn(position.lineNumber) };
          }
        } else {
          position = { lineNumber: setting.valueRange.startLineNumber, column: setting.valueRange.endColumn };
        }
      } else {
        position = { lineNumber: setting.keyRange.startLineNumber, column: setting.keyRange.startColumn };
      }
    }
    return position;
  }
  getSetting(settingId) {
    if (!this._settingsGroups) {
      const defaultSettings = this.getDefaultSettings(ConfigurationTarget.USER);
      const defaultsChangedDisposable = this._register(new MutableDisposable());
      defaultsChangedDisposable.value = defaultSettings.onDidChange(() => {
        this._settingsGroups = void 0;
        defaultsChangedDisposable.clear();
      });
      this._settingsGroups = defaultSettings.getSettingsGroups();
    }
    for (const group of this._settingsGroups) {
      for (const section of group.sections) {
        for (const setting of section.settings) {
          if (compareIgnoreCase(setting.key, settingId) === 0) {
            return setting;
          }
        }
      }
    }
    return void 0;
  }
  /**
   * Should be of the format:
   * 	code://settings/settingName
   * Examples:
   * 	code://settings/files.autoSave
   *
   */
  async handleURL(uri) {
    if (compareIgnoreCase(uri.authority, SETTINGS_AUTHORITY) !== 0) {
      return false;
    }
    const settingInfo = uri.path.split("/").filter((part) => !!part);
    const settingId = settingInfo.length > 0 ? settingInfo[0] : void 0;
    if (!settingId) {
      this.openSettings();
      return true;
    }
    let setting = this.getSetting(settingId);
    if (!setting && this.extensionService.extensions.length === 0) {
      await this.progressService.withProgress({ location: ProgressLocation.Window }, () => Event.toPromise(this.extensionService.onDidRegisterExtensions));
      setting = this.getSetting(settingId);
    }
    const openSettingsOptions = {};
    if (setting) {
      openSettingsOptions.query = settingId;
    }
    this.openSettings(openSettingsOptions);
    return true;
  }
  dispose() {
    if (this._cachedSettingsEditor2Input && !this._cachedSettingsEditor2Input.isDisposed()) {
      this._cachedSettingsEditor2Input.dispose();
    }
    this._onDispose.fire();
    super.dispose();
  }
};
PreferencesService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, ITextFileService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IUserDataProfileService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IModelService),
  __decorateParam(12, IJSONEditingService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, IRemoteAgentService),
  __decorateParam(15, ITextEditorService),
  __decorateParam(16, IURLService),
  __decorateParam(17, IExtensionService),
  __decorateParam(18, IProgressService)
], PreferencesService);
registerSingleton(IPreferencesService, PreferencesService, InstantiationType.Delayed);
export {
  PreferencesService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvYnJvd3Nlci9wcmVmZXJlbmNlc1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG5ldHdvcmsgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBnZXRDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIGdldERlZmF1bHRWYWx1ZSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgT1ZFUlJJREVfUFJPUEVSVFlfUkVHRVggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04sIElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUpTT05FZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2pzb25FZGl0aW5nLmpzJztcbmltcG9ydCB7IEdyb3VwRGlyZWN0aW9uLCBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzRWRpdG9ySW5wdXQgfSBmcm9tICcuL2tleWJpbmRpbmdzRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9TRVRUSU5HU19FRElUT1JfU0VUVElORywgRk9MREVSX1NFVFRJTkdTX1BBVEgsIElLZXliaW5kaW5nc0VkaXRvclBhbmUsIElPcGVuS2V5YmluZGluZ3NFZGl0b3JPcHRpb25zLCBJT3BlblNldHRpbmdzT3B0aW9ucywgSVByZWZlcmVuY2VzRWRpdG9yTW9kZWwsIElQcmVmZXJlbmNlc1NlcnZpY2UsIElTZXR0aW5nLCBJU2V0dGluZ3NFZGl0b3JPcHRpb25zLCBJU2V0dGluZ3NHcm91cCwgU0VUVElOR1NfQVVUSE9SSVRZLCBVU0VfU1BMSVRfSlNPTl9TRVRUSU5HLCB2YWxpZGF0ZVNldHRpbmdzRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc0VkaXRvcjJJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlc0VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IGRlZmF1bHRLZXliaW5kaW5nc0NvbnRlbnRzLCBEZWZhdWx0S2V5YmluZGluZ3NFZGl0b3JNb2RlbCwgRGVmYXVsdFJhd1NldHRpbmdzRWRpdG9yTW9kZWwsIERlZmF1bHRTZXR0aW5ncywgRGVmYXVsdFNldHRpbmdzRWRpdG9yTW9kZWwsIFNldHRpbmdzMkVkaXRvck1vZGVsLCBTZXR0aW5nc0VkaXRvck1vZGVsLCBXb3Jrc3BhY2VDb25maWd1cmF0aW9uRWRpdG9yTW9kZWwgfSBmcm9tICcuLi9jb21tb24vcHJlZmVyZW5jZXNNb2RlbHMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3RleHRmaWxlL2NvbW1vbi90ZXh0RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBpc09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFN1Z2dlc3RDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3RDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VTZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJVVJMU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsLmpzJztcbmltcG9ydCB7IGNvbXBhcmVJZ25vcmVDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBmaW5kR3JvdXAgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwRmluZGVyLmpzJztcblxuY29uc3QgZW1wdHlFZGl0YWJsZVNldHRpbmdzQ29udGVudCA9ICd7XFxufSc7XG5cbmV4cG9ydCBjbGFzcyBQcmVmZXJlbmNlc1NlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVByZWZlcmVuY2VzU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREZWZhdWx0U2V0dGluZ3NDb250ZW50Q2hhbmdlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFVSST4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRGVmYXVsdFNldHRpbmdzQ29udGVudENoYW5nZWQgPSB0aGlzLl9vbkRpZERlZmF1bHRTZXR0aW5nc0NvbnRlbnRDaGFuZ2VkLmV2ZW50O1xuXG5cdHByaXZhdGUgX2RlZmF1bHRVc2VyU2V0dGluZ3NDb250ZW50TW9kZWw6IERlZmF1bHRTZXR0aW5ncyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZGVmYXVsdFdvcmtzcGFjZVNldHRpbmdzQ29udGVudE1vZGVsOiBEZWZhdWx0U2V0dGluZ3MgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2RlZmF1bHRGb2xkZXJTZXR0aW5nc0NvbnRlbnRNb2RlbDogRGVmYXVsdFNldHRpbmdzIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2RlZmF1bHRSYXdTZXR0aW5nc0VkaXRvck1vZGVsOiBEZWZhdWx0UmF3U2V0dGluZ3NFZGl0b3JNb2RlbCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0ZWREZWZhdWx0U2V0dGluZ3MgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblxuXHRwcml2YXRlIF9zZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXBbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY2FjaGVkU2V0dGluZ3NFZGl0b3IySW5wdXQ6IFNldHRpbmdzRWRpdG9yMklucHV0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJSlNPTkVkaXRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkganNvbkVkaXRpbmdTZXJ2aWNlOiBJSlNPTkVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVGV4dEVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RWRpdG9yU2VydmljZTogSVRleHRFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVVJMU2VydmljZSB1cmxTZXJ2aWNlOiBJVVJMU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdC8vIFRoZSBkZWZhdWx0IGtleWJpbmRpbmdzLmpzb24gdXBkYXRlcyBiYXNlZCBvbiBrZXlib2FyZCBsYXlvdXRzLCBzbyBoZXJlIHdlIG1ha2Ugc3VyZVxuXHRcdC8vIGlmIGEgbW9kZWwgaGFzIGJlZW4gZ2l2ZW4gb3V0IHdlIHVwZGF0ZSBpdCBhY2NvcmRpbmdseS5cblx0XHR0aGlzLl9yZWdpc3RlcihrZXliaW5kaW5nU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzKCgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHRoaXMuZGVmYXVsdEtleWJpbmRpbmdzUmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0XHQvLyBtb2RlbCBoYXMgbm90IGJlZW4gZ2l2ZW4gb3V0ID0+IG5vdGhpbmcgdG8gZG9cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW9kZWxTZXJ2aWNlLnVwZGF0ZU1vZGVsKG1vZGVsLCBkZWZhdWx0S2V5YmluZGluZ3NDb250ZW50cyhrZXliaW5kaW5nU2VydmljZSkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpKTtcblx0fVxuXG5cdHJlYWRvbmx5IGRlZmF1bHRLZXliaW5kaW5nc1Jlc291cmNlID0gVVJJLmZyb20oeyBzY2hlbWU6IG5ldHdvcmsuU2NoZW1hcy52c2NvZGUsIGF1dGhvcml0eTogJ2RlZmF1bHRzZXR0aW5ncycsIHBhdGg6ICcva2V5YmluZGluZ3MuanNvbicgfSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVmYXVsdFNldHRpbmdzUmF3UmVzb3VyY2UgPSBVUkkuZnJvbSh7IHNjaGVtZTogbmV0d29yay5TY2hlbWFzLnZzY29kZSwgYXV0aG9yaXR5OiAnZGVmYXVsdHNldHRpbmdzJywgcGF0aDogJy9kZWZhdWx0U2V0dGluZ3MuanNvbicgfSk7XG5cblx0Z2V0IHVzZXJTZXR0aW5nc1Jlc291cmNlKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZVNldHRpbmdzUmVzb3VyY2UoKTogVVJJIHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdHJldHVybiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiB8fCB3b3Jrc3BhY2UuZm9sZGVyc1swXS50b1Jlc291cmNlKEZPTERFUl9TRVRUSU5HU19QQVRIKTtcblx0fVxuXG5cdGNyZWF0ZU9yR2V0Q2FjaGVkU2V0dGluZ3NFZGl0b3IySW5wdXQoKTogU2V0dGluZ3NFZGl0b3IySW5wdXQge1xuXHRcdGlmICghdGhpcy5fY2FjaGVkU2V0dGluZ3NFZGl0b3IySW5wdXQgfHwgdGhpcy5fY2FjaGVkU2V0dGluZ3NFZGl0b3IySW5wdXQuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHQvLyBSZWNyZWF0ZSB0aGUgaW5wdXQgaWYgdGhlIHVzZXIgbmV2ZXIgb3BlbmVkIHRoZSBTZXR0aW5ncyBlZGl0b3IsXG5cdFx0XHQvLyBvciBpZiB0aGV5IGNsb3NlZCBpdCBhbmQgd2FudCB0byByZW9wZW4gaXQuXG5cdFx0XHR0aGlzLl9jYWNoZWRTZXR0aW5nc0VkaXRvcjJJbnB1dCA9IG5ldyBTZXR0aW5nc0VkaXRvcjJJbnB1dCh0aGlzKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlZFNldHRpbmdzRWRpdG9yMklucHV0O1xuXHR9XG5cblx0Z2V0Rm9sZGVyU2V0dGluZ3NSZXNvdXJjZShyZXNvdXJjZTogVVJJKTogVVJJIHwgbnVsbCB7XG5cdFx0Y29uc3QgZm9sZGVyID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIocmVzb3VyY2UpO1xuXHRcdHJldHVybiBmb2xkZXIgPyBmb2xkZXIudG9SZXNvdXJjZShGT0xERVJfU0VUVElOR1NfUEFUSCkgOiBudWxsO1xuXHR9XG5cblx0aGFzRGVmYXVsdFNldHRpbmdzQ29udGVudCh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlzRGVmYXVsdFNldHRpbmdzUmVzb3VyY2UodXJpKSB8fCBpc0VxdWFsKHVyaSwgdGhpcy5kZWZhdWx0U2V0dGluZ3NSYXdSZXNvdXJjZSkgfHwgaXNFcXVhbCh1cmksIHRoaXMuZGVmYXVsdEtleWJpbmRpbmdzUmVzb3VyY2UpO1xuXHR9XG5cblx0Z2V0RGVmYXVsdFNldHRpbmdzQ29udGVudCh1cmk6IFVSSSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuaXNEZWZhdWx0U2V0dGluZ3NSZXNvdXJjZSh1cmkpKSB7XG5cdFx0XHQvLyBXZSBvcGVuZWQgYSBzcGxpdCBqc29uIGVkaXRvciBpbiB0aGlzIGNhc2UsXG5cdFx0XHQvLyBhbmQgdGhpcyBoYWxmIHNob3dzIHRoZSBkZWZhdWx0IHNldHRpbmdzLlxuXG5cdFx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLmdldENvbmZpZ3VyYXRpb25UYXJnZXRGcm9tRGVmYXVsdFNldHRpbmdzUmVzb3VyY2UodXJpKTtcblx0XHRcdGNvbnN0IGRlZmF1bHRTZXR0aW5ncyA9IHRoaXMuZ2V0RGVmYXVsdFNldHRpbmdzKHRhcmdldCk7XG5cblx0XHRcdGlmICghdGhpcy5fcmVxdWVzdGVkRGVmYXVsdFNldHRpbmdzLmhhcyh1cmkpKSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGRlZmF1bHRTZXR0aW5ncy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLl9vbkRpZERlZmF1bHRTZXR0aW5nc0NvbnRlbnRDaGFuZ2VkLmZpcmUodXJpKSkpO1xuXHRcdFx0XHR0aGlzLl9yZXF1ZXN0ZWREZWZhdWx0U2V0dGluZ3MuYWRkKHVyaSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGVmYXVsdFNldHRpbmdzLmdldENvbnRlbnRXaXRob3V0TW9zdENvbW1vbmx5VXNlZCh0cnVlKTtcblx0XHR9XG5cblx0XHRpZiAoaXNFcXVhbCh1cmksIHRoaXMuZGVmYXVsdFNldHRpbmdzUmF3UmVzb3VyY2UpKSB7XG5cdFx0XHRpZiAoIXRoaXMuX2RlZmF1bHRSYXdTZXR0aW5nc0VkaXRvck1vZGVsKSB7XG5cdFx0XHRcdHRoaXMuX2RlZmF1bHRSYXdTZXR0aW5nc0VkaXRvck1vZGVsID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWZhdWx0UmF3U2V0dGluZ3NFZGl0b3JNb2RlbCwgdGhpcy5nZXREZWZhdWx0U2V0dGluZ3MoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSkpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWZhdWx0UmF3U2V0dGluZ3NFZGl0b3JNb2RlbC5vbkRpZENvbnRlbnRDaGFuZ2VkKCgpID0+IHRoaXMuX29uRGlkRGVmYXVsdFNldHRpbmdzQ29udGVudENoYW5nZWQuZmlyZSh1cmkpKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdFJhd1NldHRpbmdzRWRpdG9yTW9kZWwuY29udGVudDtcblx0XHR9XG5cblx0XHRpZiAoaXNFcXVhbCh1cmksIHRoaXMuZGVmYXVsdEtleWJpbmRpbmdzUmVzb3VyY2UpKSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0S2V5YmluZGluZ3NFZGl0b3JNb2RlbCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVmYXVsdEtleWJpbmRpbmdzRWRpdG9yTW9kZWwsIHVyaSk7XG5cdFx0XHRyZXR1cm4gZGVmYXVsdEtleWJpbmRpbmdzRWRpdG9yTW9kZWwuY29udGVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNyZWF0ZVByZWZlcmVuY2VzRWRpdG9yTW9kZWwodXJpOiBVUkkpOiBQcm9taXNlPElQcmVmZXJlbmNlc0VkaXRvck1vZGVsPElTZXR0aW5nPiB8IG51bGw+IHtcblx0XHRpZiAodGhpcy5pc0RlZmF1bHRTZXR0aW5nc1Jlc291cmNlKHVyaSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZURlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsKHVyaSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudXNlclNldHRpbmdzUmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkgfHwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLnRvU3RyaW5nKCkgPT09IHVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVFZGl0YWJsZVNldHRpbmdzRWRpdG9yTW9kZWwoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMLCB1cmkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmtzcGFjZVNldHRpbmdzVXJpID0gYXdhaXQgdGhpcy5nZXRFZGl0YWJsZVNldHRpbmdzVVJJKENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHRpZiAod29ya3NwYWNlU2V0dGluZ3NVcmkgJiYgd29ya3NwYWNlU2V0dGluZ3NVcmkudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZUVkaXRhYmxlU2V0dGluZ3NFZGl0b3JNb2RlbChDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSwgd29ya3NwYWNlU2V0dGluZ3NVcmkpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0Y29uc3Qgc2V0dGluZ3NVcmkgPSBhd2FpdCB0aGlzLmdldEVkaXRhYmxlU2V0dGluZ3NVUkkoQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSLCB1cmkpO1xuXHRcdFx0aWYgKHNldHRpbmdzVXJpICYmIHNldHRpbmdzVXJpLnRvU3RyaW5nKCkgPT09IHVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZUVkaXRhYmxlU2V0dGluZ3NFZGl0b3JNb2RlbChDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIsIHVyaSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVtb3RlRW52aXJvbm1lbnQgPSBhd2FpdCB0aGlzLnJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRcdGNvbnN0IHJlbW90ZVNldHRpbmdzVXJpID0gcmVtb3RlRW52aXJvbm1lbnQgPyByZW1vdGVFbnZpcm9ubWVudC5zZXR0aW5nc1BhdGggOiBudWxsO1xuXHRcdGlmIChyZW1vdGVTZXR0aW5nc1VyaSAmJiByZW1vdGVTZXR0aW5nc1VyaS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlRWRpdGFibGVTZXR0aW5nc0VkaXRvck1vZGVsKENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUsIHVyaSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRvcGVuUmF3RGVmYXVsdFNldHRpbmdzKCk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdGhpcy5kZWZhdWx0U2V0dGluZ3NSYXdSZXNvdXJjZSB9KTtcblx0fVxuXG5cdG9wZW5SYXdVc2VyU2V0dGluZ3MoKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB0aGlzLnVzZXJTZXR0aW5nc1Jlc291cmNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRPcGVuSnNvbkJ5RGVmYXVsdCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd29ya2JlbmNoLnNldHRpbmdzLmVkaXRvcicpID09PSAnanNvbic7XG5cdH1cblxuXHRvcGVuU2V0dGluZ3Mob3B0aW9uczogSU9wZW5TZXR0aW5nc09wdGlvbnMgPSB7fSk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRvcHRpb25zID0ge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMLFxuXHRcdH07XG5cdFx0aWYgKG9wdGlvbnMucXVlcnkpIHtcblx0XHRcdG9wdGlvbnMuanNvbkVkaXRvciA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm9wZW4odGhpcy51c2VyU2V0dGluZ3NSZXNvdXJjZSwgb3B0aW9ucyk7XG5cdH1cblxuXHRvcGVuTGFuZ3VhZ2VTcGVjaWZpY1NldHRpbmdzKGxhbmd1YWdlSWQ6IHN0cmluZywgb3B0aW9uczogSU9wZW5TZXR0aW5nc09wdGlvbnMgPSB7fSk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5zaG91bGRPcGVuSnNvbkJ5RGVmYXVsdCgpKSB7XG5cdFx0XHRvcHRpb25zLnF1ZXJ5ID0gdW5kZWZpbmVkO1xuXHRcdFx0b3B0aW9ucy5yZXZlYWxTZXR0aW5nID0geyBrZXk6IGBbJHtsYW5ndWFnZUlkfV1gLCBlZGl0OiB0cnVlIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9wdGlvbnMucXVlcnkgPSBgQGxhbmc6JHtsYW5ndWFnZUlkfSR7b3B0aW9ucy5xdWVyeSA/IGAgJHtvcHRpb25zLnF1ZXJ5fWAgOiAnJ31gO1xuXHRcdH1cblx0XHRvcHRpb25zLnRhcmdldCA9IG9wdGlvbnMudGFyZ2V0ID8/IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDtcblxuXHRcdHJldHVybiB0aGlzLm9wZW4odGhpcy51c2VyU2V0dGluZ3NSZXNvdXJjZSwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW4oc2V0dGluZ3NSZXNvdXJjZTogVVJJLCBvcHRpb25zOiBJT3BlblNldHRpbmdzT3B0aW9ucyk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRvcHRpb25zID0ge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdGpzb25FZGl0b3I6IG9wdGlvbnMuanNvbkVkaXRvciA/PyB0aGlzLnNob3VsZE9wZW5Kc29uQnlEZWZhdWx0KClcblx0XHR9O1xuXG5cdFx0cmV0dXJuIG9wdGlvbnMuanNvbkVkaXRvciA/XG5cdFx0XHR0aGlzLm9wZW5TZXR0aW5nc0pzb24oc2V0dGluZ3NSZXNvdXJjZSwgb3B0aW9ucykgOlxuXHRcdFx0dGhpcy5vcGVuU2V0dGluZ3MyKG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuU2V0dGluZ3MyKG9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5jcmVhdGVPckdldENhY2hlZFNldHRpbmdzRWRpdG9yMklucHV0KCk7XG5cdFx0b3B0aW9ucyA9IHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRmb2N1c1NlYXJjaDogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3QgZ3JvdXAgPSBhd2FpdCB0aGlzLmdldEVkaXRvckdyb3VwRnJvbU9wdGlvbnMob3B0aW9ucyk7XG5cdFx0cmV0dXJuIGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQsIHZhbGlkYXRlU2V0dGluZ3NFZGl0b3JPcHRpb25zKG9wdGlvbnMpKTtcblx0fVxuXG5cdG9wZW5BcHBsaWNhdGlvblNldHRpbmdzKG9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zID0ge30pOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0b3B0aW9ucyA9IHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHR0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCxcblx0XHR9O1xuXHRcdHJldHVybiB0aGlzLm9wZW4odGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCBvcHRpb25zKTtcblx0fVxuXG5cdG9wZW5Vc2VyU2V0dGluZ3Mob3B0aW9uczogSU9wZW5TZXR0aW5nc09wdGlvbnMgPSB7fSk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRvcHRpb25zID0ge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMLFxuXHRcdH07XG5cdFx0cmV0dXJuIHRoaXMub3Blbih0aGlzLnVzZXJTZXR0aW5nc1Jlc291cmNlLCBvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIG9wZW5SZW1vdGVTZXR0aW5ncyhvcHRpb25zOiBJT3BlblNldHRpbmdzT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGVudmlyb25tZW50ID0gYXdhaXQgdGhpcy5yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKTtcblx0XHRpZiAoZW52aXJvbm1lbnQpIHtcblx0XHRcdG9wdGlvbnMgPSB7XG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSxcblx0XHRcdH07XG5cblx0XHRcdHRoaXMub3BlbihlbnZpcm9ubWVudC5zZXR0aW5nc1BhdGgsIG9wdGlvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3BlbldvcmtzcGFjZVNldHRpbmdzKG9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zID0ge30pOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLndvcmtzcGFjZVNldHRpbmdzUmVzb3VyY2UpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5pbmZvKG5scy5sb2NhbGl6ZSgnb3BlbkZvbGRlckZpcnN0JywgXCJPcGVuIGEgZm9sZGVyIG9yIHdvcmtzcGFjZSBmaXJzdCB0byBjcmVhdGUgd29ya3NwYWNlIG9yIGZvbGRlciBzZXR0aW5ncy5cIikpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG51bGwpO1xuXHRcdH1cblxuXHRcdG9wdGlvbnMgPSB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0dGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRVxuXHRcdH07XG5cdFx0cmV0dXJuIHRoaXMub3Blbih0aGlzLndvcmtzcGFjZVNldHRpbmdzUmVzb3VyY2UsIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgb3BlbkZvbGRlclNldHRpbmdzKG9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zID0ge30pOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0b3B0aW9ucyA9IHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHR0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUlxuXHRcdH07XG5cblx0XHRpZiAoIW9wdGlvbnMuZm9sZGVyVXJpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgZm9sZGVyIFVSSWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbGRlclNldHRpbmdzVXJpID0gYXdhaXQgdGhpcy5nZXRFZGl0YWJsZVNldHRpbmdzVVJJKENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUiwgb3B0aW9ucy5mb2xkZXJVcmkpO1xuXHRcdGlmICghZm9sZGVyU2V0dGluZ3NVcmkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBmb2xkZXIgVVJJIC0gJHtvcHRpb25zLmZvbGRlclVyaS50b1N0cmluZygpfWApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm9wZW4oZm9sZGVyU2V0dGluZ3NVcmksIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgb3Blbkdsb2JhbEtleWJpbmRpbmdTZXR0aW5ncyh0ZXh0dWFsOiBib29sZWFuLCBvcHRpb25zPzogSU9wZW5LZXliaW5kaW5nc0VkaXRvck9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRvcHRpb25zID0geyBwaW5uZWQ6IHRydWUsIHJldmVhbElmT3BlbmVkOiB0cnVlLCAuLi5vcHRpb25zIH07XG5cdFx0aWYgKHRleHR1YWwpIHtcblx0XHRcdGNvbnN0IGVtcHR5Q29udGVudHMgPSAnLy8gJyArIG5scy5sb2NhbGl6ZSgnZW1wdHlLZXliaW5kaW5nc0hlYWRlcicsIFwiUGxhY2UgeW91ciBrZXkgYmluZGluZ3MgaW4gdGhpcyBmaWxlIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0c1wiKSArICdcXG5bXFxuXSc7XG5cdFx0XHRjb25zdCBlZGl0YWJsZUtleWJpbmRpbmdzID0gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2U7XG5cdFx0XHRjb25zdCBvcGVuRGVmYXVsdEtleWJpbmRpbmdzID0gISF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3b3JrYmVuY2guc2V0dGluZ3Mub3BlbkRlZmF1bHRLZXliaW5kaW5ncycpO1xuXG5cdFx0XHQvLyBDcmVhdGUgYXMgbmVlZGVkIGFuZCBvcGVuIGluIGVkaXRvclxuXHRcdFx0YXdhaXQgdGhpcy5jcmVhdGVJZk5vdEV4aXN0cyhlZGl0YWJsZUtleWJpbmRpbmdzLCBlbXB0eUNvbnRlbnRzKTtcblx0XHRcdGlmIChvcGVuRGVmYXVsdEtleWJpbmRpbmdzKSB7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZUdyb3VwSWQgPSBvcHRpb25zLmdyb3VwSWQgPz8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuaWQ7XG5cdFx0XHRcdGNvbnN0IHNpZGVFZGl0b3JHcm91cCA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFkZEdyb3VwKHNvdXJjZUdyb3VwSWQsIEdyb3VwRGlyZWN0aW9uLlJJR0hUKTtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IHRoaXMuZGVmYXVsdEtleWJpbmRpbmdzUmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCByZXZlYWxJZk9wZW5lZDogdHJ1ZSwgb3ZlcnJpZGU6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkIH0sIGxhYmVsOiBubHMubG9jYWxpemUoJ2RlZmF1bHRLZXliaW5kaW5ncycsIFwiRGVmYXVsdCBLZXliaW5kaW5nc1wiKSwgZGVzY3JpcHRpb246ICcnIH0sIHNvdXJjZUdyb3VwSWQpLFxuXHRcdFx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IGVkaXRhYmxlS2V5YmluZGluZ3MsIG9wdGlvbnMgfSwgc2lkZUVkaXRvckdyb3VwLmlkKVxuXHRcdFx0XHRdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IGVkaXRhYmxlS2V5YmluZGluZ3MsIG9wdGlvbnMgfSwgb3B0aW9ucy5ncm91cElkKTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSAoYXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShLZXliaW5kaW5nc0VkaXRvcklucHV0KSwgeyAuLi5vcHRpb25zIH0sIG9wdGlvbnMuZ3JvdXBJZCkpIGFzIElLZXliaW5kaW5nc0VkaXRvclBhbmU7XG5cdFx0XHRpZiAob3B0aW9ucy5xdWVyeSkge1xuXHRcdFx0XHRlZGl0b3Iuc2VhcmNoKG9wdGlvbnMucXVlcnkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHR9XG5cblx0b3BlbkRlZmF1bHRLZXliaW5kaW5nc0ZpbGUoKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB0aGlzLmRlZmF1bHRLZXliaW5kaW5nc1Jlc291cmNlLCBsYWJlbDogbmxzLmxvY2FsaXplKCdkZWZhdWx0S2V5YmluZGluZ3MnLCBcIkRlZmF1bHQgS2V5YmluZGluZ3NcIikgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEVkaXRvckdyb3VwRnJvbU9wdGlvbnMob3B0aW9uczogSU9wZW5TZXR0aW5nc09wdGlvbnMpOiBQcm9taXNlPElFZGl0b3JHcm91cD4ge1xuXHRcdGxldCBncm91cCA9IG9wdGlvbnM/Lmdyb3VwSWQgIT09IHVuZGVmaW5lZCA/IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwKG9wdGlvbnMuZ3JvdXBJZCkgPz8gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAgOiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cDtcblx0XHRpZiAob3B0aW9ucy5vcGVuVG9TaWRlKSB7XG5cdFx0XHRncm91cCA9IChhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZpbmRHcm91cCwge30sIFNJREVfR1JPVVApKVswXTtcblx0XHR9XG5cdFx0cmV0dXJuIGdyb3VwO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuU2V0dGluZ3NKc29uKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGdyb3VwID0gYXdhaXQgdGhpcy5nZXRFZGl0b3JHcm91cEZyb21PcHRpb25zKG9wdGlvbnMpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHRoaXMuZG9PcGVuU2V0dGluZ3NKc29uKHJlc291cmNlLCBvcHRpb25zLCBncm91cCk7XG5cdFx0aWYgKGVkaXRvciAmJiBvcHRpb25zPy5yZXZlYWxTZXR0aW5nKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJldmVhbFNldHRpbmcob3B0aW9ucy5yZXZlYWxTZXR0aW5nLmtleSwgISFvcHRpb25zLnJldmVhbFNldHRpbmcuZWRpdCwgZWRpdG9yLCByZXNvdXJjZSk7XG5cdFx0fVxuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvT3BlblNldHRpbmdzSnNvbihyZXNvdXJjZTogVVJJLCBvcHRpb25zOiBJU2V0dGluZ3NFZGl0b3JPcHRpb25zLCBncm91cDogSUVkaXRvckdyb3VwKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IG9wZW5TcGxpdEpTT04gPSAhIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVVNFX1NQTElUX0pTT05fU0VUVElORyk7XG5cdFx0Y29uc3Qgb3BlbkRlZmF1bHRTZXR0aW5ncyA9ICEhdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShERUZBVUxUX1NFVFRJTkdTX0VESVRPUl9TRVRUSU5HKTtcblx0XHRpZiAob3BlblNwbGl0SlNPTiB8fCBvcGVuRGVmYXVsdFNldHRpbmdzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb09wZW5TcGxpdEpTT04ocmVzb3VyY2UsIG9wdGlvbnMsIGdyb3VwKTtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uVGFyZ2V0ID0gb3B0aW9ucz8udGFyZ2V0ID8/IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjtcblx0XHRjb25zdCBlZGl0YWJsZVNldHRpbmdzRWRpdG9ySW5wdXQgPSBhd2FpdCB0aGlzLmdldE9yQ3JlYXRlRWRpdGFibGVTZXR0aW5nc0VkaXRvcklucHV0KGNvbmZpZ3VyYXRpb25UYXJnZXQsIHJlc291cmNlKTtcblx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBwaW5uZWQ6IHRydWUgfTtcblx0XHRyZXR1cm4gYXdhaXQgZ3JvdXAub3BlbkVkaXRvcihlZGl0YWJsZVNldHRpbmdzRWRpdG9ySW5wdXQsIHsgLi4udmFsaWRhdGVTZXR0aW5nc0VkaXRvck9wdGlvbnMob3B0aW9ucykgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvT3BlblNwbGl0SlNPTihyZXNvdXJjZTogVVJJLCBvcHRpb25zOiBJU2V0dGluZ3NFZGl0b3JPcHRpb25zID0ge30sIGdyb3VwOiBJRWRpdG9yR3JvdXAsKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25UYXJnZXQgPSBvcHRpb25zLnRhcmdldCA/PyBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVI7XG5cdFx0YXdhaXQgdGhpcy5jcmVhdGVTZXR0aW5nc0lmTm90RXhpc3RzKGNvbmZpZ3VyYXRpb25UYXJnZXQsIHJlc291cmNlKTtcblx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvcklucHV0ID0gdGhpcy5jcmVhdGVTcGxpdEpzb25FZGl0b3JJbnB1dChjb25maWd1cmF0aW9uVGFyZ2V0LCByZXNvdXJjZSk7XG5cdFx0b3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgcGlubmVkOiB0cnVlIH07XG5cdFx0cmV0dXJuIGdyb3VwLm9wZW5FZGl0b3IocHJlZmVyZW5jZXNFZGl0b3JJbnB1dCwgdmFsaWRhdGVTZXR0aW5nc0VkaXRvck9wdGlvbnMob3B0aW9ucykpO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZVNwbGl0SnNvbkVkaXRvcklucHV0KGNvbmZpZ3VyYXRpb25UYXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQsIHJlc291cmNlOiBVUkkpOiBFZGl0b3JJbnB1dCB7XG5cdFx0Y29uc3QgZWRpdGFibGVTZXR0aW5nc0VkaXRvcklucHV0ID0gdGhpcy50ZXh0RWRpdG9yU2VydmljZS5jcmVhdGVUZXh0RWRpdG9yKHsgcmVzb3VyY2UgfSk7XG5cdFx0Y29uc3QgZGVmYXVsdFByZWZlcmVuY2VzRWRpdG9ySW5wdXQgPSB0aGlzLnRleHRFZGl0b3JTZXJ2aWNlLmNyZWF0ZVRleHRFZGl0b3IoeyByZXNvdXJjZTogdGhpcy5nZXREZWZhdWx0U2V0dGluZ3NSZXNvdXJjZShjb25maWd1cmF0aW9uVGFyZ2V0KSB9KTtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaWRlQnlTaWRlRWRpdG9ySW5wdXQsIGVkaXRhYmxlU2V0dGluZ3NFZGl0b3JJbnB1dC5nZXROYW1lKCksIHVuZGVmaW5lZCwgZGVmYXVsdFByZWZlcmVuY2VzRWRpdG9ySW5wdXQsIGVkaXRhYmxlU2V0dGluZ3NFZGl0b3JJbnB1dCk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlU2V0dGluZ3MyRWRpdG9yTW9kZWwoKTogU2V0dGluZ3MyRWRpdG9yTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzMkVkaXRvck1vZGVsLCB0aGlzLmdldERlZmF1bHRTZXR0aW5ncyhDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29uZmlndXJhdGlvblRhcmdldEZyb21EZWZhdWx0U2V0dGluZ3NSZXNvdXJjZSh1cmk6IFVSSSkge1xuXHRcdHJldHVybiB0aGlzLmlzRGVmYXVsdFdvcmtzcGFjZVNldHRpbmdzUmVzb3VyY2UodXJpKSA/XG5cdFx0XHRDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSA6XG5cdFx0XHR0aGlzLmlzRGVmYXVsdEZvbGRlclNldHRpbmdzUmVzb3VyY2UodXJpKSA/XG5cdFx0XHRcdENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUiA6XG5cdFx0XHRcdENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDtcblx0fVxuXG5cdHByaXZhdGUgaXNEZWZhdWx0U2V0dGluZ3NSZXNvdXJjZSh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlzRGVmYXVsdFVzZXJTZXR0aW5nc1Jlc291cmNlKHVyaSkgfHwgdGhpcy5pc0RlZmF1bHRXb3Jrc3BhY2VTZXR0aW5nc1Jlc291cmNlKHVyaSkgfHwgdGhpcy5pc0RlZmF1bHRGb2xkZXJTZXR0aW5nc1Jlc291cmNlKHVyaSk7XG5cdH1cblxuXHRwcml2YXRlIGlzRGVmYXVsdFVzZXJTZXR0aW5nc1Jlc291cmNlKHVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHVyaS5hdXRob3JpdHkgPT09ICdkZWZhdWx0c2V0dGluZ3MnICYmIHVyaS5zY2hlbWUgPT09IG5ldHdvcmsuU2NoZW1hcy52c2NvZGUgJiYgISF1cmkucGF0aC5tYXRjaCgvXFwvKFxcZCtcXC8pP3NldHRpbmdzXFwuanNvbiQvKTtcblx0fVxuXG5cdHByaXZhdGUgaXNEZWZhdWx0V29ya3NwYWNlU2V0dGluZ3NSZXNvdXJjZSh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB1cmkuYXV0aG9yaXR5ID09PSAnZGVmYXVsdHNldHRpbmdzJyAmJiB1cmkuc2NoZW1lID09PSBuZXR3b3JrLlNjaGVtYXMudnNjb2RlICYmICEhdXJpLnBhdGgubWF0Y2goL1xcLyhcXGQrXFwvKT93b3Jrc3BhY2VTZXR0aW5nc1xcLmpzb24kLyk7XG5cdH1cblxuXHRwcml2YXRlIGlzRGVmYXVsdEZvbGRlclNldHRpbmdzUmVzb3VyY2UodXJpOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdXJpLmF1dGhvcml0eSA9PT0gJ2RlZmF1bHRzZXR0aW5ncycgJiYgdXJpLnNjaGVtZSA9PT0gbmV0d29yay5TY2hlbWFzLnZzY29kZSAmJiAhIXVyaS5wYXRoLm1hdGNoKC9cXC8oXFxkK1xcLyk/cmVzb3VyY2VTZXR0aW5nc1xcLmpzb24kLyk7XG5cdH1cblxuXHRwcml2YXRlIGdldERlZmF1bHRTZXR0aW5nc1Jlc291cmNlKGNvbmZpZ3VyYXRpb25UYXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQpOiBVUkkge1xuXHRcdHN3aXRjaCAoY29uZmlndXJhdGlvblRhcmdldCkge1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTpcblx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHsgc2NoZW1lOiBuZXR3b3JrLlNjaGVtYXMudnNjb2RlLCBhdXRob3JpdHk6ICdkZWZhdWx0c2V0dGluZ3MnLCBwYXRoOiBgL3dvcmtzcGFjZVNldHRpbmdzLmpzb25gIH0pO1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI6XG5cdFx0XHRcdHJldHVybiBVUkkuZnJvbSh7IHNjaGVtZTogbmV0d29yay5TY2hlbWFzLnZzY29kZSwgYXV0aG9yaXR5OiAnZGVmYXVsdHNldHRpbmdzJywgcGF0aDogYC9yZXNvdXJjZVNldHRpbmdzLmpzb25gIH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gVVJJLmZyb20oeyBzY2hlbWU6IG5ldHdvcmsuU2NoZW1hcy52c2NvZGUsIGF1dGhvcml0eTogJ2RlZmF1bHRzZXR0aW5ncycsIHBhdGg6IGAvc2V0dGluZ3MuanNvbmAgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldE9yQ3JlYXRlRWRpdGFibGVTZXR0aW5nc0VkaXRvcklucHV0KHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCwgcmVzb3VyY2U6IFVSSSk6IFByb21pc2U8RWRpdG9ySW5wdXQ+IHtcblx0XHRhd2FpdCB0aGlzLmNyZWF0ZVNldHRpbmdzSWZOb3RFeGlzdHModGFyZ2V0LCByZXNvdXJjZSk7XG5cdFx0cmV0dXJuIHRoaXMudGV4dEVkaXRvclNlcnZpY2UuY3JlYXRlVGV4dEVkaXRvcih7IHJlc291cmNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVFZGl0YWJsZVNldHRpbmdzRWRpdG9yTW9kZWwoY29uZmlndXJhdGlvblRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCwgc2V0dGluZ3NVcmk6IFVSSSk6IFByb21pc2U8U2V0dGluZ3NFZGl0b3JNb2RlbD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0aWYgKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uICYmIHdvcmtzcGFjZS5jb25maWd1cmF0aW9uLnRvU3RyaW5nKCkgPT09IHNldHRpbmdzVXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdGNvbnN0IHJlZmVyZW5jZSA9IGF3YWl0IHRoaXMudGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHNldHRpbmdzVXJpKTtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25FZGl0b3JNb2RlbCwgcmVmZXJlbmNlLCBjb25maWd1cmF0aW9uVGFyZ2V0KTtcblx0XHR9XG5cblx0XHRjb25zdCByZWZlcmVuY2UgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShzZXR0aW5nc1VyaSk7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NFZGl0b3JNb2RlbCwgcmVmZXJlbmNlLCBjb25maWd1cmF0aW9uVGFyZ2V0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlRGVmYXVsdFNldHRpbmdzRWRpdG9yTW9kZWwoZGVmYXVsdFNldHRpbmdzVXJpOiBVUkkpOiBQcm9taXNlPERlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsPiB7XG5cdFx0Y29uc3QgcmVmZXJlbmNlID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoZGVmYXVsdFNldHRpbmdzVXJpKTtcblx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLmdldENvbmZpZ3VyYXRpb25UYXJnZXRGcm9tRGVmYXVsdFNldHRpbmdzUmVzb3VyY2UoZGVmYXVsdFNldHRpbmdzVXJpKTtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWZhdWx0U2V0dGluZ3NFZGl0b3JNb2RlbCwgZGVmYXVsdFNldHRpbmdzVXJpLCByZWZlcmVuY2UsIHRoaXMuZ2V0RGVmYXVsdFNldHRpbmdzKHRhcmdldCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWZhdWx0U2V0dGluZ3ModGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0KTogRGVmYXVsdFNldHRpbmdzIHtcblx0XHRpZiAodGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSkge1xuXHRcdFx0dGhpcy5fZGVmYXVsdFdvcmtzcGFjZVNldHRpbmdzQ29udGVudE1vZGVsID8/PSB0aGlzLl9yZWdpc3RlcihuZXcgRGVmYXVsdFNldHRpbmdzKHRoaXMuZ2V0TW9zdENvbW1vbmx5VXNlZFNldHRpbmdzKCksIHRhcmdldCwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2RlZmF1bHRXb3Jrc3BhY2VTZXR0aW5nc0NvbnRlbnRNb2RlbDtcblx0XHR9XG5cdFx0aWYgKHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSKSB7XG5cdFx0XHR0aGlzLl9kZWZhdWx0Rm9sZGVyU2V0dGluZ3NDb250ZW50TW9kZWwgPz89IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWZhdWx0U2V0dGluZ3ModGhpcy5nZXRNb3N0Q29tbW9ubHlVc2VkU2V0dGluZ3MoKSwgdGFyZ2V0LCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdEZvbGRlclNldHRpbmdzQ29udGVudE1vZGVsO1xuXHRcdH1cblx0XHR0aGlzLl9kZWZhdWx0VXNlclNldHRpbmdzQ29udGVudE1vZGVsID8/PSB0aGlzLl9yZWdpc3RlcihuZXcgRGVmYXVsdFNldHRpbmdzKHRoaXMuZ2V0TW9zdENvbW1vbmx5VXNlZFNldHRpbmdzKCksIHRhcmdldCwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdHJldHVybiB0aGlzLl9kZWZhdWx0VXNlclNldHRpbmdzQ29udGVudE1vZGVsO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldEVkaXRhYmxlU2V0dGluZ3NVUkkoY29uZmlndXJhdGlvblRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCwgcmVzb3VyY2U/OiBVUkkpOiBQcm9taXNlPFVSSSB8IG51bGw+IHtcblx0XHRzd2l0Y2ggKGNvbmZpZ3VyYXRpb25UYXJnZXQpIHtcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTjpcblx0XHRcdFx0cmV0dXJuIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZTtcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSOlxuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw6XG5cdFx0XHRcdHJldHVybiB0aGlzLnVzZXJTZXR0aW5nc1Jlc291cmNlO1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFOiB7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZUVudmlyb25tZW50ID0gYXdhaXQgdGhpcy5yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKTtcblx0XHRcdFx0cmV0dXJuIHJlbW90ZUVudmlyb25tZW50ID8gcmVtb3RlRW52aXJvbm1lbnQuc2V0dGluZ3NQYXRoIDogbnVsbDtcblx0XHRcdH1cblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0U6XG5cdFx0XHRcdHJldHVybiB0aGlzLndvcmtzcGFjZVNldHRpbmdzUmVzb3VyY2U7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjpcblx0XHRcdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0Rm9sZGVyU2V0dGluZ3NSZXNvdXJjZShyZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZVNldHRpbmdzSWZOb3RFeGlzdHModGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LCByZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFICYmIHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUNvbmZpZyA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuY29uZmlndXJhdGlvbjtcblx0XHRcdGlmICghd29ya3NwYWNlQ29uZmlnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLnJlYWQod29ya3NwYWNlQ29uZmlnKTtcblx0XHRcdGlmIChPYmplY3Qua2V5cyhwYXJzZShjb250ZW50LnZhbHVlKSkuaW5kZXhPZignc2V0dGluZ3MnKSA9PT0gLTEpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5qc29uRWRpdGluZ1NlcnZpY2Uud3JpdGUocmVzb3VyY2UsIFt7IHBhdGg6IFsnc2V0dGluZ3MnXSwgdmFsdWU6IHt9IH1dLCB0cnVlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5jcmVhdGVJZk5vdEV4aXN0cyhyZXNvdXJjZSwgZW1wdHlFZGl0YWJsZVNldHRpbmdzQ29udGVudCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZUlmTm90RXhpc3RzKHJlc291cmNlOiBVUkksIGNvbnRlbnRzOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2UucmVhZChyZXNvdXJjZSwgeyBhY2NlcHRUZXh0T25seTogdHJ1ZSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKCg8RmlsZU9wZXJhdGlvbkVycm9yPmVycm9yKS5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2Uud3JpdGUocmVzb3VyY2UsIGNvbnRlbnRzKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yMikge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2ZhaWwuY3JlYXRlU2V0dGluZ3MnLCBcIlVuYWJsZSB0byBjcmVhdGUgJ3swfScgKHsxfSkuXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlc291cmNlLCB7IHJlbGF0aXZlOiB0cnVlIH0pLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IyKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0TW9zdENvbW1vbmx5VXNlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0J2ZpbGVzLmF1dG9TYXZlJyxcblx0XHRcdCdlZGl0b3IuZm9udFNpemUnLFxuXHRcdFx0J2VkaXRvci5mb250RmFtaWx5Jyxcblx0XHRcdCdlZGl0b3IudGFiU2l6ZScsXG5cdFx0XHQnZWRpdG9yLnJlbmRlcldoaXRlc3BhY2UnLFxuXHRcdFx0J2VkaXRvci5jdXJzb3JTdHlsZScsXG5cdFx0XHQnZWRpdG9yLm11bHRpQ3Vyc29yTW9kaWZpZXInLFxuXHRcdFx0J2VkaXRvci5pbnNlcnRTcGFjZXMnLFxuXHRcdFx0J2VkaXRvci53b3JkV3JhcCcsXG5cdFx0XHQnZmlsZXMuZXhjbHVkZScsXG5cdFx0XHQnZmlsZXMuYXNzb2NpYXRpb25zJyxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmVuYWJsZVByZXZpZXcnXG5cdFx0XTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmV2ZWFsU2V0dGluZyhzZXR0aW5nS2V5OiBzdHJpbmcsIGVkaXQ6IGJvb2xlYW4sIGVkaXRvcjogSUVkaXRvclBhbmUsIHNldHRpbmdzUmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvZGVFZGl0b3IgPSBlZGl0b3IgPyBnZXRDb2RlRWRpdG9yKGVkaXRvci5nZXRDb250cm9sKCkpIDogbnVsbDtcblx0XHRpZiAoIWNvZGVFZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2V0dGluZ3NNb2RlbCA9IGF3YWl0IHRoaXMuY3JlYXRlUHJlZmVyZW5jZXNFZGl0b3JNb2RlbChzZXR0aW5nc1Jlc291cmNlKTtcblx0XHRpZiAoIXNldHRpbmdzTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcG9zaXRpb24gPSBhd2FpdCB0aGlzLmdldFBvc2l0aW9uVG9SZXZlYWwoc2V0dGluZ0tleSwgZWRpdCwgc2V0dGluZ3NNb2RlbCwgY29kZUVkaXRvcik7XG5cdFx0aWYgKHBvc2l0aW9uKSB7XG5cdFx0XHRjb2RlRWRpdG9yLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGNvZGVFZGl0b3IucmV2ZWFsUG9zaXRpb25OZWFyVG9wKHBvc2l0aW9uKTtcblx0XHRcdGNvZGVFZGl0b3IuZm9jdXMoKTtcblx0XHRcdGlmIChlZGl0KSB7XG5cdFx0XHRcdFN1Z2dlc3RDb250cm9sbGVyLmdldChjb2RlRWRpdG9yKT8udHJpZ2dlclN1Z2dlc3QoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFBvc2l0aW9uVG9SZXZlYWwoc2V0dGluZ0tleTogc3RyaW5nLCBlZGl0OiBib29sZWFuLCBzZXR0aW5nc01vZGVsOiBJUHJlZmVyZW5jZXNFZGl0b3JNb2RlbDxJU2V0dGluZz4sIGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTxJUG9zaXRpb24gfCBudWxsPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjb2RlRWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IHNjaGVtYSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVtzZXR0aW5nS2V5XTtcblx0XHRjb25zdCBpc092ZXJyaWRlUHJvcGVydHkgPSBPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KHNldHRpbmdLZXkpO1xuXHRcdGlmICghc2NoZW1hICYmICFpc092ZXJyaWRlUHJvcGVydHkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBwb3NpdGlvbiA9IG51bGw7XG5cdFx0Y29uc3QgdHlwZSA9IHNjaGVtYT8udHlwZSA/PyAnb2JqZWN0JyAvKiBUeXBlIG5vdCBkZWZpbmVkIG9yIGlzIGFuIE92ZXJyaWRlIElkZW50aWZpZXIgKi87XG5cdFx0bGV0IHNldHRpbmcgPSBzZXR0aW5nc01vZGVsLmdldFByZWZlcmVuY2Uoc2V0dGluZ0tleSk7XG5cdFx0aWYgKCFzZXR0aW5nICYmIGVkaXQpIHtcblx0XHRcdGxldCBkZWZhdWx0VmFsdWUgPSAodHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2FycmF5JykgPyB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Qoc2V0dGluZ0tleSkuZGVmYXVsdFZhbHVlIDogZ2V0RGVmYXVsdFZhbHVlKHR5cGUpO1xuXHRcdFx0ZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlID09PSB1bmRlZmluZWQgJiYgaXNPdmVycmlkZVByb3BlcnR5ID8ge30gOiBkZWZhdWx0VmFsdWU7XG5cdFx0XHRpZiAoZGVmYXVsdFZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gc2V0dGluZ3NNb2RlbCBpbnN0YW5jZW9mIFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25FZGl0b3JNb2RlbCA/IFsnc2V0dGluZ3MnLCBzZXR0aW5nS2V5XSA6IFtzZXR0aW5nS2V5XTtcblx0XHRcdFx0YXdhaXQgdGhpcy5qc29uRWRpdGluZ1NlcnZpY2Uud3JpdGUoc2V0dGluZ3NNb2RlbC51cmkhLCBbeyBwYXRoOiBrZXksIHZhbHVlOiBkZWZhdWx0VmFsdWUgfV0sIGZhbHNlKTtcblx0XHRcdFx0c2V0dGluZyA9IHNldHRpbmdzTW9kZWwuZ2V0UHJlZmVyZW5jZShzZXR0aW5nS2V5KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc2V0dGluZykge1xuXHRcdFx0aWYgKGVkaXQpIHtcblx0XHRcdFx0aWYgKGlzT2JqZWN0KHNldHRpbmcudmFsdWUpIHx8IEFycmF5LmlzQXJyYXkoc2V0dGluZy52YWx1ZSkpIHtcblx0XHRcdFx0XHRwb3NpdGlvbiA9IHsgbGluZU51bWJlcjogc2V0dGluZy52YWx1ZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiBzZXR0aW5nLnZhbHVlUmFuZ2Uuc3RhcnRDb2x1bW4gKyAxIH07XG5cdFx0XHRcdFx0Y29kZUVkaXRvci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0XHRcdFx0YXdhaXQgQ29yZUVkaXRpbmdDb21tYW5kcy5MaW5lQnJlYWtJbnNlcnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBjb2RlRWRpdG9yLCBudWxsKTtcblx0XHRcdFx0XHRwb3NpdGlvbiA9IHsgbGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciArIDEsIGNvbHVtbjogbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyICsgMSkgfTtcblx0XHRcdFx0XHRjb25zdCBmaXJzdE5vbldoaXRlU3BhY2VDb2x1bW4gPSBtb2RlbC5nZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChmaXJzdE5vbldoaXRlU3BhY2VDb2x1bW4pIHtcblx0XHRcdFx0XHRcdC8vIExpbmUgaGFzIHNvbWUgdGV4dC4gSW5zZXJ0IGFub3RoZXIgbmV3IGxpbmUuXG5cdFx0XHRcdFx0XHRjb2RlRWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciwgY29sdW1uOiBmaXJzdE5vbldoaXRlU3BhY2VDb2x1bW4gfSk7XG5cdFx0XHRcdFx0XHRhd2FpdCBDb3JlRWRpdGluZ0NvbW1hbmRzLkxpbmVCcmVha0luc2VydC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGNvZGVFZGl0b3IsIG51bGwpO1xuXHRcdFx0XHRcdFx0cG9zaXRpb24gPSB7IGxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsIGNvbHVtbjogbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyKSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwb3NpdGlvbiA9IHsgbGluZU51bWJlcjogc2V0dGluZy52YWx1ZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiBzZXR0aW5nLnZhbHVlUmFuZ2UuZW5kQ29sdW1uIH07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBvc2l0aW9uID0geyBsaW5lTnVtYmVyOiBzZXR0aW5nLmtleVJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiBzZXR0aW5nLmtleVJhbmdlLnN0YXJ0Q29sdW1uIH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xuXHR9XG5cblx0Z2V0U2V0dGluZyhzZXR0aW5nSWQ6IHN0cmluZyk6IElTZXR0aW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX3NldHRpbmdzR3JvdXBzKSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0U2V0dGluZ3MgPSB0aGlzLmdldERlZmF1bHRTZXR0aW5ncyhDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdFx0Y29uc3QgZGVmYXVsdHNDaGFuZ2VkRGlzcG9zYWJsZTogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRcdFx0ZGVmYXVsdHNDaGFuZ2VkRGlzcG9zYWJsZS52YWx1ZSA9IGRlZmF1bHRTZXR0aW5ncy5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3NldHRpbmdzR3JvdXBzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRkZWZhdWx0c0NoYW5nZWREaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3NldHRpbmdzR3JvdXBzID0gZGVmYXVsdFNldHRpbmdzLmdldFNldHRpbmdzR3JvdXBzKCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLl9zZXR0aW5nc0dyb3Vwcykge1xuXHRcdFx0Zm9yIChjb25zdCBzZWN0aW9uIG9mIGdyb3VwLnNlY3Rpb25zKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0aWYgKGNvbXBhcmVJZ25vcmVDYXNlKHNldHRpbmcua2V5LCBzZXR0aW5nSWQpID09PSAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2V0dGluZztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBTaG91bGQgYmUgb2YgdGhlIGZvcm1hdDpcblx0ICogXHRjb2RlOi8vc2V0dGluZ3Mvc2V0dGluZ05hbWVcblx0ICogRXhhbXBsZXM6XG5cdCAqIFx0Y29kZTovL3NldHRpbmdzL2ZpbGVzLmF1dG9TYXZlXG5cdCAqXG5cdCAqL1xuXHRhc3luYyBoYW5kbGVVUkwodXJpOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoY29tcGFyZUlnbm9yZUNhc2UodXJpLmF1dGhvcml0eSwgU0VUVElOR1NfQVVUSE9SSVRZKSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNldHRpbmdJbmZvID0gdXJpLnBhdGguc3BsaXQoJy8nKS5maWx0ZXIocGFydCA9PiAhIXBhcnQpO1xuXHRcdGNvbnN0IHNldHRpbmdJZCA9ICgoc2V0dGluZ0luZm8ubGVuZ3RoID4gMCkgPyBzZXR0aW5nSW5mb1swXSA6IHVuZGVmaW5lZCk7XG5cdFx0aWYgKCFzZXR0aW5nSWQpIHtcblx0XHRcdHRoaXMub3BlblNldHRpbmdzKCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRsZXQgc2V0dGluZyA9IHRoaXMuZ2V0U2V0dGluZyhzZXR0aW5nSWQpO1xuXG5cdFx0aWYgKCFzZXR0aW5nICYmIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gd2FpdCBmb3IgZXh0ZW5zaW9uIHBvaW50cyB0byBiZSBwcm9jZXNzZWRcblx0XHRcdGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyB9LCAoKSA9PiBFdmVudC50b1Byb21pc2UodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJFeHRlbnNpb25zKSk7XG5cdFx0XHRzZXR0aW5nID0gdGhpcy5nZXRTZXR0aW5nKHNldHRpbmdJZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3BlblNldHRpbmdzT3B0aW9uczogSU9wZW5TZXR0aW5nc09wdGlvbnMgPSB7fTtcblx0XHRpZiAoc2V0dGluZykge1xuXHRcdFx0b3BlblNldHRpbmdzT3B0aW9ucy5xdWVyeSA9IHNldHRpbmdJZDtcblx0XHR9XG5cblx0XHR0aGlzLm9wZW5TZXR0aW5ncyhvcGVuU2V0dGluZ3NPcHRpb25zKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9jYWNoZWRTZXR0aW5nc0VkaXRvcjJJbnB1dCAmJiAhdGhpcy5fY2FjaGVkU2V0dGluZ3NFZGl0b3IySW5wdXQuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHR0aGlzLl9jYWNoZWRTZXR0aW5nc0VkaXRvcjJJbnB1dC5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlzcG9zZS5maXJlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElQcmVmZXJlbmNlc1NlcnZpY2UsIFByZWZlcmVuY2VzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsU0FB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
