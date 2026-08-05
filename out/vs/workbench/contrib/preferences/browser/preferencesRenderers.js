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
import { EventHelper, getDomNodePagePosition } from "../../../../base/browser/dom.js";
import { SubmenuAction } from "../../../../base/common/actions.js";
import { Delayer } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import * as editorCommon from "../../../../editor/common/editorCommon.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { CodeActionKind } from "../../../../editor/contrib/codeAction/common/types.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope, OVERRIDE_PROPERTY_REGEX, overrideIdentifiersFromKey } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService, MarkerSeverity, MarkerTag } from "../../../../platform/markers/common/markers.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { RangeHighlightDecorations } from "../../../browser/codeeditor.js";
import { settingsEditIcon } from "./preferencesIcons.js";
import { EditPreferenceWidget } from "./preferencesWidgets.js";
import { APPLICATION_SCOPES, APPLY_ALL_PROFILES_SETTING, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { DefaultSettingsEditorModel, WorkspaceConfigurationEditorModel } from "../../../services/preferences/common/preferencesModels.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { EXPERIMENTAL_INDICATOR_DESCRIPTION, PREVIEW_INDICATOR_DESCRIPTION } from "../common/preferences.js";
let UserSettingsRenderer = class extends Disposable {
  constructor(editor, preferencesModel, preferencesService, configurationService, instantiationService) {
    super();
    this.editor = editor;
    this.preferencesModel = preferencesModel;
    this.preferencesService = preferencesService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.modelChangeDelayer = new Delayer(200);
    this.settingHighlighter = this._register(instantiationService.createInstance(SettingHighlighter, editor));
    this.editSettingActionRenderer = this._register(this.instantiationService.createInstance(EditSettingRenderer, this.editor, this.preferencesModel, this.settingHighlighter));
    this._register(this.editSettingActionRenderer.onUpdateSetting(({ key, value, source }) => this.updatePreference(key, value, source)));
    this._register(this.editor.getModel().onDidChangeContent(() => this.modelChangeDelayer.trigger(() => this.onModelChanged())));
    this.unsupportedSettingsRenderer = this._register(instantiationService.createInstance(UnsupportedSettingsRenderer, editor, preferencesModel));
  }
  render() {
    this.editSettingActionRenderer.render(this.preferencesModel.settingsGroups, this.associatedPreferencesModel);
    this.unsupportedSettingsRenderer.render();
  }
  updatePreference(key, value, source) {
    const overrideIdentifiers = source.overrideOf ? overrideIdentifiersFromKey(source.overrideOf.key) : null;
    const resource = this.preferencesModel.uri;
    this.configurationService.updateValue(key, value, { overrideIdentifiers, resource }, this.preferencesModel.configurationTarget).then(() => this.onSettingUpdated(source));
  }
  onModelChanged() {
    if (!this.editor.hasModel()) {
      return;
    }
    this.render();
  }
  onSettingUpdated(setting) {
    this.editor.focus();
    setting = this.getSetting(setting);
    if (setting) {
      this.editor.setSelection(setting.valueRange);
      this.settingHighlighter.highlight(setting, true);
    }
  }
  getSetting(setting) {
    const { key, overrideOf } = setting;
    if (overrideOf) {
      const setting2 = this.getSetting(overrideOf);
      for (const override of setting2.overrides) {
        if (override.key === key) {
          return override;
        }
      }
      return void 0;
    }
    return this.preferencesModel.getPreference(key);
  }
  focusPreference(setting) {
    const s = this.getSetting(setting);
    if (s) {
      this.settingHighlighter.highlight(s, true);
      this.editor.setPosition({ lineNumber: s.keyRange.startLineNumber, column: s.keyRange.startColumn });
    } else {
      this.settingHighlighter.clear(true);
    }
  }
  clearFocus(setting) {
    this.settingHighlighter.clear(true);
  }
  editPreference(setting) {
    const editableSetting = this.getSetting(setting);
    return !!(editableSetting && this.editSettingActionRenderer.activateOnSetting(editableSetting));
  }
};
UserSettingsRenderer = __decorateClass([
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService)
], UserSettingsRenderer);
let WorkspaceSettingsRenderer = class extends UserSettingsRenderer {
  constructor(editor, preferencesModel, preferencesService, configurationService, instantiationService) {
    super(editor, preferencesModel, preferencesService, configurationService, instantiationService);
    this.workspaceConfigurationRenderer = this._register(instantiationService.createInstance(WorkspaceConfigurationRenderer, editor, preferencesModel));
  }
  render() {
    super.render();
    this.workspaceConfigurationRenderer.render();
  }
};
WorkspaceSettingsRenderer = __decorateClass([
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService)
], WorkspaceSettingsRenderer);
let EditSettingRenderer = class extends Disposable {
  constructor(editor, primarySettingsModel, settingHighlighter, configurationService, instantiationService, contextMenuService) {
    super();
    this.editor = editor;
    this.primarySettingsModel = primarySettingsModel;
    this.settingHighlighter = settingHighlighter;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.settingsGroups = [];
    this._onUpdateSetting = this._register(new Emitter());
    this.onUpdateSetting = this._onUpdateSetting.event;
    this.editPreferenceWidgetForCursorPosition = this._register(this.instantiationService.createInstance(EditPreferenceWidget, editor));
    this.editPreferenceWidgetForMouseMove = this._register(this.instantiationService.createInstance(EditPreferenceWidget, editor));
    this.toggleEditPreferencesForMouseMoveDelayer = new Delayer(75);
    this._register(this.editPreferenceWidgetForCursorPosition.onClick((e) => this.onEditSettingClicked(this.editPreferenceWidgetForCursorPosition, e)));
    this._register(this.editPreferenceWidgetForMouseMove.onClick((e) => this.onEditSettingClicked(this.editPreferenceWidgetForMouseMove, e)));
    this._register(this.editor.onDidChangeCursorPosition((positionChangeEvent) => this.onPositionChanged(positionChangeEvent)));
    this._register(this.editor.onMouseMove((mouseMoveEvent) => this.onMouseMoved(mouseMoveEvent)));
    this._register(this.editor.onDidChangeConfiguration(() => this.onConfigurationChanged()));
  }
  render(settingsGroups, associatedPreferencesModel) {
    this.editPreferenceWidgetForCursorPosition.hide();
    this.editPreferenceWidgetForMouseMove.hide();
    this.settingsGroups = settingsGroups;
    this.associatedPreferencesModel = associatedPreferencesModel;
    const settings = this.getSettings(this.editor.getPosition().lineNumber);
    if (settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForCursorPosition, settings);
    }
  }
  isDefaultSettings() {
    return this.primarySettingsModel instanceof DefaultSettingsEditorModel;
  }
  onConfigurationChanged() {
    if (!this.editor.getOption(EditorOption.glyphMargin)) {
      this.editPreferenceWidgetForCursorPosition.hide();
      this.editPreferenceWidgetForMouseMove.hide();
    }
  }
  onPositionChanged(positionChangeEvent) {
    this.editPreferenceWidgetForMouseMove.hide();
    const settings = this.getSettings(positionChangeEvent.position.lineNumber);
    if (settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForCursorPosition, settings);
    } else {
      this.editPreferenceWidgetForCursorPosition.hide();
    }
  }
  onMouseMoved(mouseMoveEvent) {
    const editPreferenceWidget = this.getEditPreferenceWidgetUnderMouse(mouseMoveEvent);
    if (editPreferenceWidget) {
      this.onMouseOver(editPreferenceWidget);
      return;
    }
    this.settingHighlighter.clear();
    this.toggleEditPreferencesForMouseMoveDelayer.trigger(() => this.toggleEditPreferenceWidgetForMouseMove(mouseMoveEvent));
  }
  getEditPreferenceWidgetUnderMouse(mouseMoveEvent) {
    if (mouseMoveEvent.target.type === MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const line = mouseMoveEvent.target.position.lineNumber;
      if (this.editPreferenceWidgetForMouseMove.getLine() === line && this.editPreferenceWidgetForMouseMove.isVisible()) {
        return this.editPreferenceWidgetForMouseMove;
      }
      if (this.editPreferenceWidgetForCursorPosition.getLine() === line && this.editPreferenceWidgetForCursorPosition.isVisible()) {
        return this.editPreferenceWidgetForCursorPosition;
      }
    }
    return void 0;
  }
  toggleEditPreferenceWidgetForMouseMove(mouseMoveEvent) {
    const settings = mouseMoveEvent.target.position ? this.getSettings(mouseMoveEvent.target.position.lineNumber) : null;
    if (settings && settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForMouseMove, settings);
    } else {
      this.editPreferenceWidgetForMouseMove.hide();
    }
  }
  showEditPreferencesWidget(editPreferencesWidget, settings) {
    const line = settings[0].valueRange.startLineNumber;
    if (this.editor.getOption(EditorOption.glyphMargin) && this.marginFreeFromOtherDecorations(line)) {
      editPreferencesWidget.show(line, nls.localize("editTtile", "Edit"), settings);
      const editPreferenceWidgetToHide = editPreferencesWidget === this.editPreferenceWidgetForCursorPosition ? this.editPreferenceWidgetForMouseMove : this.editPreferenceWidgetForCursorPosition;
      editPreferenceWidgetToHide.hide();
    }
  }
  marginFreeFromOtherDecorations(line) {
    const decorations = this.editor.getLineDecorations(line);
    if (decorations) {
      for (const { options } of decorations) {
        if (options.glyphMarginClassName && options.glyphMarginClassName.indexOf(ThemeIcon.asClassName(settingsEditIcon)) === -1) {
          return false;
        }
      }
    }
    return true;
  }
  getSettings(lineNumber) {
    const configurationMap = this.getConfigurationsMap();
    return this.getSettingsAtLineNumber(lineNumber).filter((setting) => {
      const configurationNode = configurationMap[setting.key];
      if (configurationNode) {
        if (configurationNode.policy && this.configurationService.inspect(setting.key).policyValue !== void 0) {
          return false;
        }
        if (this.isDefaultSettings()) {
          if (setting.key === "launch") {
            return false;
          }
          return true;
        }
        if (configurationNode.type === "boolean" || configurationNode.enum) {
          if (this.primarySettingsModel.configurationTarget !== ConfigurationTarget.WORKSPACE_FOLDER) {
            return true;
          }
          if (configurationNode.scope === ConfigurationScope.RESOURCE || configurationNode.scope === ConfigurationScope.LANGUAGE_OVERRIDABLE) {
            return true;
          }
        }
      }
      return false;
    });
  }
  getSettingsAtLineNumber(lineNumber) {
    let index = 0;
    const settings = [];
    for (const group of this.settingsGroups) {
      if (group.range.startLineNumber > lineNumber) {
        break;
      }
      if (lineNumber >= group.range.startLineNumber && lineNumber <= group.range.endLineNumber) {
        for (const section of group.sections) {
          for (const setting of section.settings) {
            if (setting.range.startLineNumber > lineNumber) {
              break;
            }
            if (lineNumber >= setting.range.startLineNumber && lineNumber <= setting.range.endLineNumber) {
              if (!this.isDefaultSettings() && setting.overrides.length) {
                for (const overrideSetting of setting.overrides) {
                  if (lineNumber >= overrideSetting.range.startLineNumber && lineNumber <= overrideSetting.range.endLineNumber) {
                    settings.push({ ...overrideSetting, index, groupId: group.id });
                  }
                }
              } else {
                settings.push({ ...setting, index, groupId: group.id });
              }
            }
            index++;
          }
        }
      }
    }
    return settings;
  }
  onMouseOver(editPreferenceWidget) {
    this.settingHighlighter.highlight(editPreferenceWidget.preferences[0]);
  }
  onEditSettingClicked(editPreferenceWidget, e) {
    EventHelper.stop(e.event, true);
    const actions = this.getSettings(editPreferenceWidget.getLine()).length === 1 ? this.getActions(editPreferenceWidget.preferences[0], this.getConfigurationsMap()[editPreferenceWidget.preferences[0].key]) : editPreferenceWidget.preferences.map((setting) => new SubmenuAction(`preferences.submenu.${setting.key}`, setting.key, this.getActions(setting, this.getConfigurationsMap()[setting.key])));
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.event,
      getActions: () => actions
    });
  }
  activateOnSetting(setting) {
    const startLine = setting.keyRange.startLineNumber;
    const settings = this.getSettings(startLine);
    if (!settings.length) {
      return false;
    }
    this.editPreferenceWidgetForMouseMove.show(startLine, "", settings);
    const actions = this.getActions(this.editPreferenceWidgetForMouseMove.preferences[0], this.getConfigurationsMap()[this.editPreferenceWidgetForMouseMove.preferences[0].key]);
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.toAbsoluteCoords(new Position(startLine, 1)),
      getActions: () => actions
    });
    return true;
  }
  toAbsoluteCoords(position) {
    const positionCoords = this.editor.getScrolledVisiblePosition(position);
    const editorCoords = getDomNodePagePosition(this.editor.getDomNode());
    const x = editorCoords.left + positionCoords.left;
    const y = editorCoords.top + positionCoords.top + positionCoords.height;
    return { x, y: y + 10 };
  }
  getConfigurationsMap() {
    return Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
  }
  getActions(setting, jsonSchema) {
    if (jsonSchema.type === "boolean") {
      return [{
        id: "truthyValue",
        label: "true",
        tooltip: "true",
        enabled: true,
        run: () => this.updateSetting(setting.key, true, setting),
        class: void 0
      }, {
        id: "falsyValue",
        label: "false",
        tooltip: "false",
        enabled: true,
        run: () => this.updateSetting(setting.key, false, setting),
        class: void 0
      }];
    }
    if (jsonSchema.enum) {
      return jsonSchema.enum.map((value) => {
        return {
          id: value,
          label: JSON.stringify(value),
          tooltip: JSON.stringify(value),
          enabled: true,
          run: () => this.updateSetting(setting.key, value, setting),
          class: void 0
        };
      });
    }
    return this.getDefaultActions(setting);
  }
  getDefaultActions(setting) {
    if (this.isDefaultSettings()) {
      const settingInOtherModel = this.associatedPreferencesModel.getPreference(setting.key);
      return [{
        id: "setDefaultValue",
        label: settingInOtherModel ? nls.localize("replaceDefaultValue", "Replace in Settings") : nls.localize("copyDefaultValue", "Copy to Settings"),
        tooltip: settingInOtherModel ? nls.localize("replaceDefaultValue", "Replace in Settings") : nls.localize("copyDefaultValue", "Copy to Settings"),
        enabled: true,
        run: () => this.updateSetting(setting.key, setting.value, setting),
        class: void 0
      }];
    }
    return [];
  }
  updateSetting(key, value, source) {
    this._onUpdateSetting.fire({ key, value, source });
  }
};
EditSettingRenderer = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextMenuService)
], EditSettingRenderer);
let SettingHighlighter = class extends Disposable {
  constructor(editor, instantiationService) {
    super();
    this.editor = editor;
    this.fixedHighlighter = this._register(instantiationService.createInstance(RangeHighlightDecorations));
    this.volatileHighlighter = this._register(instantiationService.createInstance(RangeHighlightDecorations));
  }
  highlight(setting, fix = false) {
    this.volatileHighlighter.removeHighlightRange();
    this.fixedHighlighter.removeHighlightRange();
    const highlighter = fix ? this.fixedHighlighter : this.volatileHighlighter;
    highlighter.highlightRange({
      range: setting.valueRange,
      resource: this.editor.getModel().uri
    }, this.editor);
    this.editor.revealLineInCenterIfOutsideViewport(setting.valueRange.startLineNumber, editorCommon.ScrollType.Smooth);
  }
  clear(fix = false) {
    this.volatileHighlighter.removeHighlightRange();
    if (fix) {
      this.fixedHighlighter.removeHighlightRange();
    }
  }
};
SettingHighlighter = __decorateClass([
  __decorateParam(1, IInstantiationService)
], SettingHighlighter);
let UnsupportedSettingsRenderer = class extends Disposable {
  constructor(editor, settingsEditorModel, markerService, environmentService, configurationService, workspaceTrustManagementService, uriIdentityService, languageFeaturesService, userDataProfileService, userDataProfilesService) {
    super();
    this.editor = editor;
    this.settingsEditorModel = settingsEditorModel;
    this.markerService = markerService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.uriIdentityService = uriIdentityService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.renderingDelayer = new Delayer(200);
    this.codeActions = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
    this._register(this.editor.getModel().onDidChangeContent(() => this.delayedRender()));
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.source === ConfigurationTarget.DEFAULT)(() => this.delayedRender()));
    this._register(languageFeaturesService.codeActionProvider.register({ pattern: settingsEditorModel.uri.path }, this));
    this._register(userDataProfileService.onDidChangeCurrentProfile(() => this.delayedRender()));
  }
  delayedRender() {
    this.renderingDelayer.trigger(() => this.render());
  }
  render() {
    this.codeActions.clear();
    const markerData = this.generateMarkerData();
    if (markerData.length) {
      this.markerService.changeOne("UnsupportedSettingsRenderer", this.settingsEditorModel.uri, markerData);
    } else {
      this.markerService.remove("UnsupportedSettingsRenderer", [this.settingsEditorModel.uri]);
    }
  }
  async provideCodeActions(model, range, context, token) {
    const actions = [];
    const codeActionsByRange = this.codeActions.get(model.uri);
    if (codeActionsByRange) {
      for (const [codeActionsRange, codeActions] of codeActionsByRange) {
        if (codeActionsRange.containsRange(range)) {
          actions.push(...codeActions);
        }
      }
    }
    return {
      actions,
      dispose: () => {
      }
    };
  }
  generateMarkerData() {
    const markerData = [];
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
    for (const settingsGroup of this.settingsEditorModel.settingsGroups) {
      for (const section of settingsGroup.sections) {
        for (const setting of section.settings) {
          if (OVERRIDE_PROPERTY_REGEX.test(setting.key)) {
            if (setting.overrides) {
              this.handleOverrides(setting.overrides, configurationRegistry, markerData);
            }
            continue;
          }
          const configuration = configurationRegistry[setting.key];
          if (configuration) {
            this.handleUnstableSettingConfiguration(setting, configuration, markerData);
            if (this.handlePolicyConfiguration(setting, configuration, markerData)) {
              continue;
            }
            switch (this.settingsEditorModel.configurationTarget) {
              case ConfigurationTarget.USER_LOCAL:
                this.handleLocalUserConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.USER_REMOTE:
                this.handleRemoteUserConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.WORKSPACE:
                this.handleWorkspaceConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.WORKSPACE_FOLDER:
                this.handleWorkspaceFolderConfiguration(setting, configuration, markerData);
                break;
            }
          } else {
            markerData.push(this.generateUnknownConfigurationMarker(setting));
          }
        }
      }
    }
    return markerData;
  }
  handlePolicyConfiguration(setting, configuration, markerData) {
    if (!configuration.policy) {
      return false;
    }
    if (this.configurationService.inspect(setting.key).policyValue === void 0) {
      return false;
    }
    if (this.settingsEditorModel.configurationTarget === ConfigurationTarget.DEFAULT) {
      return false;
    }
    markerData.push({
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedPolicySetting", "This setting cannot be applied because it is configured in the system policy.")
    });
    return true;
  }
  handleOverrides(overrides, configurationRegistry, markerData) {
    for (const setting of overrides || []) {
      const configuration = configurationRegistry[setting.key];
      if (configuration) {
        if (configuration.scope !== ConfigurationScope.LANGUAGE_OVERRIDABLE) {
          markerData.push({
            severity: MarkerSeverity.Hint,
            tags: [MarkerTag.Unnecessary],
            ...setting.range,
            message: nls.localize("unsupportLanguageOverrideSetting", "This setting cannot be applied because it is not registered as language override setting.")
          });
        }
      } else {
        markerData.push(this.generateUnknownConfigurationMarker(setting));
      }
    }
  }
  handleLocalUserConfiguration(setting, configuration, markerData) {
    if (!this.userDataProfileService.currentProfile.isDefault && !this.userDataProfileService.currentProfile.useDefaultFlags?.settings) {
      if (isEqual(this.userDataProfilesService.defaultProfile.settingsResource, this.settingsEditorModel.uri) && !this.configurationService.isSettingAppliedForAllProfiles(setting.key)) {
        markerData.push({
          severity: MarkerSeverity.Hint,
          tags: [MarkerTag.Unnecessary],
          ...setting.range,
          message: nls.localize("defaultProfileSettingWhileNonDefaultActive", "This setting cannot be applied while a non-default profile is active. It will be applied when the default profile is active.")
        });
      } else if (isEqual(this.userDataProfileService.currentProfile.settingsResource, this.settingsEditorModel.uri)) {
        if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
          markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
        } else if (this.configurationService.isSettingAppliedForAllProfiles(setting.key)) {
          markerData.push({
            severity: MarkerSeverity.Hint,
            tags: [MarkerTag.Unnecessary],
            ...setting.range,
            message: nls.localize("allProfileSettingWhileInNonDefaultProfileSetting", "This setting cannot be applied because it is configured to be applied in all profiles using setting {0}. Value from the default profile will be used instead.", APPLY_ALL_PROFILES_SETTING)
          });
        }
      }
    }
    if (this.environmentService.remoteAuthority && (configuration.scope === ConfigurationScope.MACHINE || configuration.scope === ConfigurationScope.APPLICATION_MACHINE || configuration.scope === ConfigurationScope.MACHINE_OVERRIDABLE)) {
      markerData.push({
        severity: MarkerSeverity.Hint,
        tags: [MarkerTag.Unnecessary],
        ...setting.range,
        message: nls.localize("unsupportedRemoteMachineSetting", "This setting cannot be applied in this window. It will be applied when you open a local window.")
      });
    }
  }
  handleRemoteUserConfiguration(setting, configuration, markerData) {
    if (configuration.scope === ConfigurationScope.APPLICATION) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
  }
  handleWorkspaceConfiguration(setting, configuration, markerData) {
    if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.MACHINE) {
      markerData.push(this.generateUnsupportedMachineSettingMarker(setting));
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && configuration.restricted) {
      const marker = this.generateUntrustedSettingMarker(setting);
      markerData.push(marker);
      const codeActions = this.generateUntrustedSettingCodeActions([marker]);
      this.addCodeActions(marker, codeActions);
    }
  }
  handleWorkspaceFolderConfiguration(setting, configuration, markerData) {
    if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.MACHINE) {
      markerData.push(this.generateUnsupportedMachineSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.WINDOW) {
      markerData.push({
        severity: MarkerSeverity.Hint,
        tags: [MarkerTag.Unnecessary],
        ...setting.range,
        message: nls.localize("unsupportedWindowSetting", "This setting cannot be applied in this workspace. It will be applied when you open the containing workspace folder directly.")
      });
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && configuration.restricted) {
      const marker = this.generateUntrustedSettingMarker(setting);
      markerData.push(marker);
      const codeActions = this.generateUntrustedSettingCodeActions([marker]);
      this.addCodeActions(marker, codeActions);
    }
  }
  handleUnstableSettingConfiguration(setting, configuration, markerData) {
    if (configuration.tags?.includes("preview")) {
      markerData.push(this.generatePreviewSettingMarker(setting));
    } else if (configuration.tags?.includes("experimental")) {
      markerData.push(this.generateExperimentalSettingMarker(setting));
    }
  }
  generateUnsupportedApplicationSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedApplicationSetting", "This setting has an application scope and can be set only in the user settings file.")
    };
  }
  generateUnsupportedMachineSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedMachineSetting", "This setting can only be applied in user settings in local window or in remote settings in remote window.")
    };
  }
  generateUntrustedSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Warning,
      ...setting.range,
      message: nls.localize("untrustedSetting", "This setting can only be applied in a trusted workspace.")
    };
  }
  generateUnknownConfigurationMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unknown configuration setting", "Unknown Configuration Setting")
    };
  }
  generateUntrustedSettingCodeActions(diagnostics) {
    return [{
      title: nls.localize("manage workspace trust", "Manage Workspace Trust"),
      command: {
        id: "workbench.trust.manage",
        title: nls.localize("manage workspace trust", "Manage Workspace Trust")
      },
      diagnostics,
      kind: CodeActionKind.QuickFix.value
    }];
  }
  generatePreviewSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      ...setting.range,
      message: PREVIEW_INDICATOR_DESCRIPTION
    };
  }
  generateExperimentalSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      ...setting.range,
      message: EXPERIMENTAL_INDICATOR_DESCRIPTION
    };
  }
  addCodeActions(range, codeActions) {
    let actions = this.codeActions.get(this.settingsEditorModel.uri);
    if (!actions) {
      actions = [];
      this.codeActions.set(this.settingsEditorModel.uri, actions);
    }
    actions.push([Range.lift(range), codeActions]);
  }
  dispose() {
    this.markerService.remove("UnsupportedSettingsRenderer", [this.settingsEditorModel.uri]);
    this.codeActions.clear();
    super.dispose();
  }
};
UnsupportedSettingsRenderer = __decorateClass([
  __decorateParam(2, IMarkerService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IWorkbenchConfigurationService),
  __decorateParam(5, IWorkspaceTrustManagementService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, IUserDataProfileService),
  __decorateParam(9, IUserDataProfilesService)
], UnsupportedSettingsRenderer);
let WorkspaceConfigurationRenderer = class extends Disposable {
  constructor(editor, workspaceSettingsEditorModel, workspaceContextService, markerService) {
    super();
    this.editor = editor;
    this.workspaceSettingsEditorModel = workspaceSettingsEditorModel;
    this.workspaceContextService = workspaceContextService;
    this.markerService = markerService;
    this.renderingDelayer = new Delayer(200);
    this.decorations = this.editor.createDecorationsCollection();
    this._register(this.editor.getModel().onDidChangeContent(() => this.renderingDelayer.trigger(() => this.render())));
  }
  render() {
    const markerData = [];
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.WORKSPACE && this.workspaceSettingsEditorModel instanceof WorkspaceConfigurationEditorModel) {
      const ranges = [];
      for (const settingsGroup of this.workspaceSettingsEditorModel.configurationGroups) {
        for (const section of settingsGroup.sections) {
          for (const setting of section.settings) {
            if (!WorkspaceConfigurationRenderer.supportedKeys.includes(setting.key)) {
              markerData.push({
                severity: MarkerSeverity.Hint,
                tags: [MarkerTag.Unnecessary],
                ...setting.range,
                message: nls.localize("unsupportedProperty", "Unsupported Property")
              });
            }
          }
        }
      }
      this.decorations.set(ranges.map((range) => this.createDecoration(range)));
    }
    if (markerData.length) {
      this.markerService.changeOne("WorkspaceConfigurationRenderer", this.workspaceSettingsEditorModel.uri, markerData);
    } else {
      this.markerService.remove("WorkspaceConfigurationRenderer", [this.workspaceSettingsEditorModel.uri]);
    }
  }
  createDecoration(range) {
    return {
      range,
      options: WorkspaceConfigurationRenderer._DIM_CONFIGURATION_
    };
  }
  dispose() {
    this.markerService.remove("WorkspaceConfigurationRenderer", [this.workspaceSettingsEditorModel.uri]);
    this.decorations.clear();
    super.dispose();
  }
};
WorkspaceConfigurationRenderer.supportedKeys = ["folders", "tasks", "launch", "extensions", "settings", "remoteAuthority", "transient"];
WorkspaceConfigurationRenderer._DIM_CONFIGURATION_ = ModelDecorationOptions.register({
  description: "dim-configuration",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  inlineClassName: "dim-configuration"
});
WorkspaceConfigurationRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IMarkerService)
], WorkspaceConfigurationRenderer);
export {
  UserSettingsRenderer,
  WorkspaceSettingsRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzUmVuZGVyZXJzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnRIZWxwZXIsIGdldERvbU5vZGVQYWdlUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRWRpdG9yTW91c2VFdmVudCwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ3Vyc29yUG9zaXRpb25DaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvZGVBY3Rpb24vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUsIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIElDb25maWd1cmF0aW9uUmVnaXN0cnksIElSZWdpc3RlcmVkQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hLCBPVkVSUklERV9QUk9QRVJUWV9SRUdFWCwgb3ZlcnJpZGVJZGVudGlmaWVyc0Zyb21LZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWFya2VyRGF0YSwgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5LCBNYXJrZXJUYWcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9jb2RlZWRpdG9yLmpzJztcbmltcG9ydCB7IHNldHRpbmdzRWRpdEljb24gfSBmcm9tICcuL3ByZWZlcmVuY2VzSWNvbnMuanMnO1xuaW1wb3J0IHsgRWRpdFByZWZlcmVuY2VXaWRnZXQgfSBmcm9tICcuL3ByZWZlcmVuY2VzV2lkZ2V0cy5qcyc7XG5pbXBvcnQgeyBBUFBMSUNBVElPTl9TQ09QRVMsIEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HLCBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc0VkaXRvck1vZGVsLCBJUHJlZmVyZW5jZXNTZXJ2aWNlLCBJU2V0dGluZywgSVNldHRpbmdzRWRpdG9yTW9kZWwsIElTZXR0aW5nc0dyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IERlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsLCBTZXR0aW5nc0VkaXRvck1vZGVsLCBXb3Jrc3BhY2VDb25maWd1cmF0aW9uRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXNNb2RlbHMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBFWFBFUklNRU5UQUxfSU5ESUNBVE9SX0RFU0NSSVBUSU9OLCBQUkVWSUVXX0lORElDQVRPUl9ERVNDUklQVElPTiB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByZWZlcmVuY2VzUmVuZGVyZXIgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdHJlbmRlcigpOiB2b2lkO1xuXHR1cGRhdGVQcmVmZXJlbmNlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBzb3VyY2U6IElTZXR0aW5nKTogdm9pZDtcblx0Zm9jdXNQcmVmZXJlbmNlKHNldHRpbmc6IElTZXR0aW5nKTogdm9pZDtcblx0Y2xlYXJGb2N1cyhzZXR0aW5nOiBJU2V0dGluZyk6IHZvaWQ7XG5cdGVkaXRQcmVmZXJlbmNlKHNldHRpbmc6IElTZXR0aW5nKTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIFVzZXJTZXR0aW5nc1JlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQcmVmZXJlbmNlc1JlbmRlcmVyIHtcblxuXHRwcml2YXRlIHNldHRpbmdIaWdobGlnaHRlcjogU2V0dGluZ0hpZ2hsaWdodGVyO1xuXHRwcml2YXRlIGVkaXRTZXR0aW5nQWN0aW9uUmVuZGVyZXI6IEVkaXRTZXR0aW5nUmVuZGVyZXI7XG5cdHByaXZhdGUgbW9kZWxDaGFuZ2VEZWxheWVyOiBEZWxheWVyPHZvaWQ+ID0gbmV3IERlbGF5ZXI8dm9pZD4oMjAwKTtcblx0cHJpdmF0ZSBhc3NvY2lhdGVkUHJlZmVyZW5jZXNNb2RlbCE6IElQcmVmZXJlbmNlc0VkaXRvck1vZGVsPElTZXR0aW5nPjtcblxuXHRwcml2YXRlIHVuc3VwcG9ydGVkU2V0dGluZ3NSZW5kZXJlcjogVW5zdXBwb3J0ZWRTZXR0aW5nc1JlbmRlcmVyO1xuXG5cdGNvbnN0cnVjdG9yKHByb3RlY3RlZCBlZGl0b3I6IElDb2RlRWRpdG9yLCByZWFkb25seSBwcmVmZXJlbmNlc01vZGVsOiBTZXR0aW5nc0VkaXRvck1vZGVsLFxuXHRcdEBJUHJlZmVyZW5jZXNTZXJ2aWNlIHByb3RlY3RlZCBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuc2V0dGluZ0hpZ2hsaWdodGVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0hpZ2hsaWdodGVyLCBlZGl0b3IpKTtcblx0XHR0aGlzLmVkaXRTZXR0aW5nQWN0aW9uUmVuZGVyZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRTZXR0aW5nUmVuZGVyZXIsIHRoaXMuZWRpdG9yLCB0aGlzLnByZWZlcmVuY2VzTW9kZWwsIHRoaXMuc2V0dGluZ0hpZ2hsaWdodGVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0U2V0dGluZ0FjdGlvblJlbmRlcmVyLm9uVXBkYXRlU2V0dGluZygoeyBrZXksIHZhbHVlLCBzb3VyY2UgfSkgPT4gdGhpcy51cGRhdGVQcmVmZXJlbmNlKGtleSwgdmFsdWUsIHNvdXJjZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5nZXRNb2RlbCgpIS5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gdGhpcy5tb2RlbENoYW5nZURlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLm9uTW9kZWxDaGFuZ2VkKCkpKSk7XG5cdFx0dGhpcy51bnN1cHBvcnRlZFNldHRpbmdzUmVuZGVyZXIgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbnN1cHBvcnRlZFNldHRpbmdzUmVuZGVyZXIsIGVkaXRvciwgcHJlZmVyZW5jZXNNb2RlbCkpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdFNldHRpbmdBY3Rpb25SZW5kZXJlci5yZW5kZXIodGhpcy5wcmVmZXJlbmNlc01vZGVsLnNldHRpbmdzR3JvdXBzLCB0aGlzLmFzc29jaWF0ZWRQcmVmZXJlbmNlc01vZGVsKTtcblx0XHR0aGlzLnVuc3VwcG9ydGVkU2V0dGluZ3NSZW5kZXJlci5yZW5kZXIoKTtcblx0fVxuXG5cdHVwZGF0ZVByZWZlcmVuY2Uoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHNvdXJjZTogSUluZGV4ZWRTZXR0aW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVJZGVudGlmaWVycyA9IHNvdXJjZS5vdmVycmlkZU9mID8gb3ZlcnJpZGVJZGVudGlmaWVyc0Zyb21LZXkoc291cmNlLm92ZXJyaWRlT2Yua2V5KSA6IG51bGw7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLnByZWZlcmVuY2VzTW9kZWwudXJpO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoa2V5LCB2YWx1ZSwgeyBvdmVycmlkZUlkZW50aWZpZXJzLCByZXNvdXJjZSB9LCB0aGlzLnByZWZlcmVuY2VzTW9kZWwuY29uZmlndXJhdGlvblRhcmdldClcblx0XHRcdC50aGVuKCgpID0+IHRoaXMub25TZXR0aW5nVXBkYXRlZChzb3VyY2UpKTtcblx0fVxuXG5cdHByaXZhdGUgb25Nb2RlbENoYW5nZWQoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBtb2RlbCBjb3VsZCBoYXZlIGJlZW4gZGlzcG9zZWQgZHVyaW5nIHRoZSBkZWxheVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNldHRpbmdVcGRhdGVkKHNldHRpbmc6IElTZXR0aW5nKSB7XG5cdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHRzZXR0aW5nID0gdGhpcy5nZXRTZXR0aW5nKHNldHRpbmcpITtcblx0XHRpZiAoc2V0dGluZykge1xuXHRcdFx0Ly8gVE9ETzpAc2FuZHkgU2VsZWN0aW9uIHJhbmdlIHNob3VsZCBiZSB0ZW1wbGF0ZSByYW5nZVxuXHRcdFx0dGhpcy5lZGl0b3Iuc2V0U2VsZWN0aW9uKHNldHRpbmcudmFsdWVSYW5nZSk7XG5cdFx0XHR0aGlzLnNldHRpbmdIaWdobGlnaHRlci5oaWdobGlnaHQoc2V0dGluZywgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZXR0aW5nKHNldHRpbmc6IElTZXR0aW5nKTogSVNldHRpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsga2V5LCBvdmVycmlkZU9mIH0gPSBzZXR0aW5nO1xuXHRcdGlmIChvdmVycmlkZU9mKSB7XG5cdFx0XHRjb25zdCBzZXR0aW5nID0gdGhpcy5nZXRTZXR0aW5nKG92ZXJyaWRlT2YpO1xuXHRcdFx0Zm9yIChjb25zdCBvdmVycmlkZSBvZiBzZXR0aW5nIS5vdmVycmlkZXMhKSB7XG5cdFx0XHRcdGlmIChvdmVycmlkZS5rZXkgPT09IGtleSkge1xuXHRcdFx0XHRcdHJldHVybiBvdmVycmlkZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc01vZGVsLmdldFByZWZlcmVuY2Uoa2V5KTtcblx0fVxuXG5cdGZvY3VzUHJlZmVyZW5jZShzZXR0aW5nOiBJU2V0dGluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHMgPSB0aGlzLmdldFNldHRpbmcoc2V0dGluZyk7XG5cdFx0aWYgKHMpIHtcblx0XHRcdHRoaXMuc2V0dGluZ0hpZ2hsaWdodGVyLmhpZ2hsaWdodChzLCB0cnVlKTtcblx0XHRcdHRoaXMuZWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogcy5rZXlSYW5nZS5zdGFydExpbmVOdW1iZXIsIGNvbHVtbjogcy5rZXlSYW5nZS5zdGFydENvbHVtbiB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXR0aW5nSGlnaGxpZ2h0ZXIuY2xlYXIodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXJGb2N1cyhzZXR0aW5nOiBJU2V0dGluZyk6IHZvaWQge1xuXHRcdHRoaXMuc2V0dGluZ0hpZ2hsaWdodGVyLmNsZWFyKHRydWUpO1xuXHR9XG5cblx0ZWRpdFByZWZlcmVuY2Uoc2V0dGluZzogSVNldHRpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBlZGl0YWJsZVNldHRpbmcgPSB0aGlzLmdldFNldHRpbmcoc2V0dGluZyk7XG5cdFx0cmV0dXJuICEhKGVkaXRhYmxlU2V0dGluZyAmJiB0aGlzLmVkaXRTZXR0aW5nQWN0aW9uUmVuZGVyZXIuYWN0aXZhdGVPblNldHRpbmcoZWRpdGFibGVTZXR0aW5nKSk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlU2V0dGluZ3NSZW5kZXJlciBleHRlbmRzIFVzZXJTZXR0aW5nc1JlbmRlcmVyIGltcGxlbWVudHMgSVByZWZlcmVuY2VzUmVuZGVyZXIge1xuXG5cdHByaXZhdGUgd29ya3NwYWNlQ29uZmlndXJhdGlvblJlbmRlcmVyOiBXb3Jrc3BhY2VDb25maWd1cmF0aW9uUmVuZGVyZXI7XG5cblx0Y29uc3RydWN0b3IoZWRpdG9yOiBJQ29kZUVkaXRvciwgcHJlZmVyZW5jZXNNb2RlbDogU2V0dGluZ3NFZGl0b3JNb2RlbCxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihlZGl0b3IsIHByZWZlcmVuY2VzTW9kZWwsIHByZWZlcmVuY2VzU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25SZW5kZXJlciA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25SZW5kZXJlciwgZWRpdG9yLCBwcmVmZXJlbmNlc01vZGVsKSk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoKTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKCk7XG5cdFx0dGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uUmVuZGVyZXIucmVuZGVyKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5kZXhlZFNldHRpbmcgZXh0ZW5kcyBJU2V0dGluZyB7XG5cdGluZGV4OiBudW1iZXI7XG5cdGdyb3VwSWQ6IHN0cmluZztcbn1cblxuY2xhc3MgRWRpdFNldHRpbmdSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbjogRWRpdFByZWZlcmVuY2VXaWRnZXQ8SUluZGV4ZWRTZXR0aW5nPjtcblx0cHJpdmF0ZSBlZGl0UHJlZmVyZW5jZVdpZGdldEZvck1vdXNlTW92ZTogRWRpdFByZWZlcmVuY2VXaWRnZXQ8SUluZGV4ZWRTZXR0aW5nPjtcblxuXHRwcml2YXRlIHNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdID0gW107XG5cdGFzc29jaWF0ZWRQcmVmZXJlbmNlc01vZGVsITogSVByZWZlcmVuY2VzRWRpdG9yTW9kZWw8SVNldHRpbmc+O1xuXHRwcml2YXRlIHRvZ2dsZUVkaXRQcmVmZXJlbmNlc0Zvck1vdXNlTW92ZURlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25VcGRhdGVTZXR0aW5nOiBFbWl0dGVyPHsga2V5OiBzdHJpbmc7IHZhbHVlOiBhbnk7IHNvdXJjZTogSUluZGV4ZWRTZXR0aW5nIH0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBrZXk6IHN0cmluZzsgdmFsdWU6IGFueTsgc291cmNlOiBJSW5kZXhlZFNldHRpbmcgfT4oKSk7XG5cdHJlYWRvbmx5IG9uVXBkYXRlU2V0dGluZzogRXZlbnQ8eyBrZXk6IHN0cmluZzsgdmFsdWU6IGFueTsgc291cmNlOiBJSW5kZXhlZFNldHRpbmcgfT4gPSB0aGlzLl9vblVwZGF0ZVNldHRpbmcuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBlZGl0b3I6IElDb2RlRWRpdG9yLCBwcml2YXRlIHByaW1hcnlTZXR0aW5nc01vZGVsOiBJU2V0dGluZ3NFZGl0b3JNb2RlbCxcblx0XHRwcml2YXRlIHNldHRpbmdIaWdobGlnaHRlcjogU2V0dGluZ0hpZ2hsaWdodGVyLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yQ3Vyc29yUG9zaXRpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRQcmVmZXJlbmNlV2lkZ2V0PElJbmRleGVkU2V0dGluZz4sIGVkaXRvcikpO1xuXHRcdHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRQcmVmZXJlbmNlV2lkZ2V0PElJbmRleGVkU2V0dGluZz4sIGVkaXRvcikpO1xuXHRcdHRoaXMudG9nZ2xlRWRpdFByZWZlcmVuY2VzRm9yTW91c2VNb3ZlRGVsYXllciA9IG5ldyBEZWxheWVyPHZvaWQ+KDc1KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbi5vbkNsaWNrKGUgPT4gdGhpcy5vbkVkaXRTZXR0aW5nQ2xpY2tlZCh0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yQ3Vyc29yUG9zaXRpb24sIGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvck1vdXNlTW92ZS5vbkNsaWNrKGUgPT4gdGhpcy5vbkVkaXRTZXR0aW5nQ2xpY2tlZCh0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yTW91c2VNb3ZlLCBlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbihwb3NpdGlvbkNoYW5nZUV2ZW50ID0+IHRoaXMub25Qb3NpdGlvbkNoYW5nZWQocG9zaXRpb25DaGFuZ2VFdmVudCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbk1vdXNlTW92ZShtb3VzZU1vdmVFdmVudCA9PiB0aGlzLm9uTW91c2VNb3ZlZChtb3VzZU1vdmVFdmVudCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKCkgPT4gdGhpcy5vbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKCkpKTtcblx0fVxuXG5cdHJlbmRlcihzZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXBbXSwgYXNzb2NpYXRlZFByZWZlcmVuY2VzTW9kZWw6IElQcmVmZXJlbmNlc0VkaXRvck1vZGVsPElTZXR0aW5nPik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbi5oaWRlKCk7XG5cdFx0dGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvck1vdXNlTW92ZS5oaWRlKCk7XG5cdFx0dGhpcy5zZXR0aW5nc0dyb3VwcyA9IHNldHRpbmdzR3JvdXBzO1xuXHRcdHRoaXMuYXNzb2NpYXRlZFByZWZlcmVuY2VzTW9kZWwgPSBhc3NvY2lhdGVkUHJlZmVyZW5jZXNNb2RlbDtcblxuXHRcdGNvbnN0IHNldHRpbmdzID0gdGhpcy5nZXRTZXR0aW5ncyh0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpIS5saW5lTnVtYmVyKTtcblx0XHRpZiAoc2V0dGluZ3MubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnNob3dFZGl0UHJlZmVyZW5jZXNXaWRnZXQodGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvckN1cnNvclBvc2l0aW9uLCBzZXR0aW5ncyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0RlZmF1bHRTZXR0aW5ncygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wcmltYXJ5U2V0dGluZ3NNb2RlbCBpbnN0YW5jZW9mIERlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5nbHlwaE1hcmdpbikpIHtcblx0XHRcdHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbi5oaWRlKCk7XG5cdFx0XHR0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yTW91c2VNb3ZlLmhpZGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUG9zaXRpb25DaGFuZ2VkKHBvc2l0aW9uQ2hhbmdlRXZlbnQ6IElDdXJzb3JQb3NpdGlvbkNoYW5nZWRFdmVudCkge1xuXHRcdHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUuaGlkZSgpO1xuXHRcdGNvbnN0IHNldHRpbmdzID0gdGhpcy5nZXRTZXR0aW5ncyhwb3NpdGlvbkNoYW5nZUV2ZW50LnBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGlmIChzZXR0aW5ncy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc2hvd0VkaXRQcmVmZXJlbmNlc1dpZGdldCh0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yQ3Vyc29yUG9zaXRpb24sIHNldHRpbmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvckN1cnNvclBvc2l0aW9uLmhpZGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uTW91c2VNb3ZlZChtb3VzZU1vdmVFdmVudDogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0UHJlZmVyZW5jZVdpZGdldCA9IHRoaXMuZ2V0RWRpdFByZWZlcmVuY2VXaWRnZXRVbmRlck1vdXNlKG1vdXNlTW92ZUV2ZW50KTtcblx0XHRpZiAoZWRpdFByZWZlcmVuY2VXaWRnZXQpIHtcblx0XHRcdHRoaXMub25Nb3VzZU92ZXIoZWRpdFByZWZlcmVuY2VXaWRnZXQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnNldHRpbmdIaWdobGlnaHRlci5jbGVhcigpO1xuXHRcdHRoaXMudG9nZ2xlRWRpdFByZWZlcmVuY2VzRm9yTW91c2VNb3ZlRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudG9nZ2xlRWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUobW91c2VNb3ZlRXZlbnQpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RWRpdFByZWZlcmVuY2VXaWRnZXRVbmRlck1vdXNlKG1vdXNlTW92ZUV2ZW50OiBJRWRpdG9yTW91c2VFdmVudCk6IEVkaXRQcmVmZXJlbmNlV2lkZ2V0PElTZXR0aW5nPiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKG1vdXNlTW92ZUV2ZW50LnRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0dMWVBIX01BUkdJTikge1xuXHRcdFx0Y29uc3QgbGluZSA9IG1vdXNlTW92ZUV2ZW50LnRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0aWYgKHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUuZ2V0TGluZSgpID09PSBsaW5lICYmIHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUuaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvckN1cnNvclBvc2l0aW9uLmdldExpbmUoKSA9PT0gbGluZSAmJiB0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yQ3Vyc29yUG9zaXRpb24uaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlRWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUobW91c2VNb3ZlRXZlbnQ6IElFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBtb3VzZU1vdmVFdmVudC50YXJnZXQucG9zaXRpb24gPyB0aGlzLmdldFNldHRpbmdzKG1vdXNlTW92ZUV2ZW50LnRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyKSA6IG51bGw7XG5cdFx0aWYgKHNldHRpbmdzICYmIHNldHRpbmdzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5zaG93RWRpdFByZWZlcmVuY2VzV2lkZ2V0KHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUsIHNldHRpbmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvck1vdXNlTW92ZS5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93RWRpdFByZWZlcmVuY2VzV2lkZ2V0KGVkaXRQcmVmZXJlbmNlc1dpZGdldDogRWRpdFByZWZlcmVuY2VXaWRnZXQ8SVNldHRpbmc+LCBzZXR0aW5nczogSUluZGV4ZWRTZXR0aW5nW10pIHtcblx0XHRjb25zdCBsaW5lID0gc2V0dGluZ3NbMF0udmFsdWVSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0aWYgKHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZ2x5cGhNYXJnaW4pICYmIHRoaXMubWFyZ2luRnJlZUZyb21PdGhlckRlY29yYXRpb25zKGxpbmUpKSB7XG5cdFx0XHRlZGl0UHJlZmVyZW5jZXNXaWRnZXQuc2hvdyhsaW5lLCBubHMubG9jYWxpemUoJ2VkaXRUdGlsZScsIFwiRWRpdFwiKSwgc2V0dGluZ3MpO1xuXHRcdFx0Y29uc3QgZWRpdFByZWZlcmVuY2VXaWRnZXRUb0hpZGUgPSBlZGl0UHJlZmVyZW5jZXNXaWRnZXQgPT09IHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JDdXJzb3JQb3NpdGlvbiA/IHRoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUgOiB0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yQ3Vyc29yUG9zaXRpb247XG5cdFx0XHRlZGl0UHJlZmVyZW5jZVdpZGdldFRvSGlkZS5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtYXJnaW5GcmVlRnJvbU90aGVyRGVjb3JhdGlvbnMobGluZTogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRMaW5lRGVjb3JhdGlvbnMobGluZSk7XG5cdFx0aWYgKGRlY29yYXRpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHsgb3B0aW9ucyB9IG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRcdGlmIChvcHRpb25zLmdseXBoTWFyZ2luQ2xhc3NOYW1lICYmIG9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUuaW5kZXhPZihUaGVtZUljb24uYXNDbGFzc05hbWUoc2V0dGluZ3NFZGl0SWNvbikpID09PSAtMSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2V0dGluZ3MobGluZU51bWJlcjogbnVtYmVyKTogSUluZGV4ZWRTZXR0aW5nW10ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25NYXAgPSB0aGlzLmdldENvbmZpZ3VyYXRpb25zTWFwKCk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U2V0dGluZ3NBdExpbmVOdW1iZXIobGluZU51bWJlcikuZmlsdGVyKHNldHRpbmcgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbk5vZGUgPSBjb25maWd1cmF0aW9uTWFwW3NldHRpbmcua2V5XTtcblx0XHRcdGlmIChjb25maWd1cmF0aW9uTm9kZSkge1xuXHRcdFx0XHRpZiAoY29uZmlndXJhdGlvbk5vZGUucG9saWN5ICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdChzZXR0aW5nLmtleSkucG9saWN5VmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5pc0RlZmF1bHRTZXR0aW5ncygpKSB7XG5cdFx0XHRcdFx0aWYgKHNldHRpbmcua2V5ID09PSAnbGF1bmNoJykge1xuXHRcdFx0XHRcdFx0Ly8gRG8gbm90IHNob3cgYmVjYXVzZSBvZiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzI1OTNcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNvbmZpZ3VyYXRpb25Ob2RlLnR5cGUgPT09ICdib29sZWFuJyB8fCBjb25maWd1cmF0aW9uTm9kZS5lbnVtKSB7XG5cdFx0XHRcdFx0aWYgKCg8U2V0dGluZ3NFZGl0b3JNb2RlbD50aGlzLnByaW1hcnlTZXR0aW5nc01vZGVsKS5jb25maWd1cmF0aW9uVGFyZ2V0ICE9PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY29uZmlndXJhdGlvbk5vZGUuc2NvcGUgPT09IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRSB8fCBjb25maWd1cmF0aW9uTm9kZS5zY29wZSA9PT0gQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2V0dGluZ3NBdExpbmVOdW1iZXIobGluZU51bWJlcjogbnVtYmVyKTogSUluZGV4ZWRTZXR0aW5nW10ge1xuXHRcdC8vIGluZGV4IG9mIHNldHRpbmcsIGFjcm9zcyBhbGwgZ3JvdXBzL3NlY3Rpb25zXG5cdFx0bGV0IGluZGV4ID0gMDtcblxuXHRcdGNvbnN0IHNldHRpbmdzOiBJSW5kZXhlZFNldHRpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5zZXR0aW5nc0dyb3Vwcykge1xuXHRcdFx0aWYgKGdyb3VwLnJhbmdlLnN0YXJ0TGluZU51bWJlciA+IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAobGluZU51bWJlciA+PSBncm91cC5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgbGluZU51bWJlciA8PSBncm91cC5yYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2VjdGlvbiBvZiBncm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHRpZiAoc2V0dGluZy5yYW5nZS5zdGFydExpbmVOdW1iZXIgPiBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPj0gc2V0dGluZy5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgbGluZU51bWJlciA8PSBzZXR0aW5nLnJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCF0aGlzLmlzRGVmYXVsdFNldHRpbmdzKCkgJiYgc2V0dGluZy5vdmVycmlkZXMhLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIE9ubHkgb25lIGxldmVsIGJlY2F1c2Ugb3ZlcnJpZGUgc2V0dGluZ3MgY2Fubm90IGhhdmUgb3ZlcnJpZGUgc2V0dGluZ3Ncblx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlU2V0dGluZyBvZiBzZXR0aW5nLm92ZXJyaWRlcyEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID49IG92ZXJyaWRlU2V0dGluZy5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgbGluZU51bWJlciA8PSBvdmVycmlkZVNldHRpbmcucmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRzZXR0aW5ncy5wdXNoKHsgLi4ub3ZlcnJpZGVTZXR0aW5nLCBpbmRleCwgZ3JvdXBJZDogZ3JvdXAuaWQgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHNldHRpbmdzLnB1c2goeyAuLi5zZXR0aW5nLCBpbmRleCwgZ3JvdXBJZDogZ3JvdXAuaWQgfSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHNldHRpbmdzO1xuXHR9XG5cblx0cHJpdmF0ZSBvbk1vdXNlT3ZlcihlZGl0UHJlZmVyZW5jZVdpZGdldDogRWRpdFByZWZlcmVuY2VXaWRnZXQ8SVNldHRpbmc+KTogdm9pZCB7XG5cdFx0dGhpcy5zZXR0aW5nSGlnaGxpZ2h0ZXIuaGlnaGxpZ2h0KGVkaXRQcmVmZXJlbmNlV2lkZ2V0LnByZWZlcmVuY2VzWzBdKTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0U2V0dGluZ0NsaWNrZWQoZWRpdFByZWZlcmVuY2VXaWRnZXQ6IEVkaXRQcmVmZXJlbmNlV2lkZ2V0PElJbmRleGVkU2V0dGluZz4sIGU6IElFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0RXZlbnRIZWxwZXIuc3RvcChlLmV2ZW50LCB0cnVlKTtcblxuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldFNldHRpbmdzKGVkaXRQcmVmZXJlbmNlV2lkZ2V0LmdldExpbmUoKSkubGVuZ3RoID09PSAxID8gdGhpcy5nZXRBY3Rpb25zKGVkaXRQcmVmZXJlbmNlV2lkZ2V0LnByZWZlcmVuY2VzWzBdLCB0aGlzLmdldENvbmZpZ3VyYXRpb25zTWFwKClbZWRpdFByZWZlcmVuY2VXaWRnZXQucHJlZmVyZW5jZXNbMF0ua2V5XSlcblx0XHRcdDogZWRpdFByZWZlcmVuY2VXaWRnZXQucHJlZmVyZW5jZXMubWFwKHNldHRpbmcgPT4gbmV3IFN1Ym1lbnVBY3Rpb24oYHByZWZlcmVuY2VzLnN1Ym1lbnUuJHtzZXR0aW5nLmtleX1gLCBzZXR0aW5nLmtleSwgdGhpcy5nZXRBY3Rpb25zKHNldHRpbmcsIHRoaXMuZ2V0Q29uZmlndXJhdGlvbnNNYXAoKVtzZXR0aW5nLmtleV0pKSk7XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5ldmVudCxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnNcblx0XHR9KTtcblx0fVxuXG5cdGFjdGl2YXRlT25TZXR0aW5nKHNldHRpbmc6IElTZXR0aW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lID0gc2V0dGluZy5rZXlSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSB0aGlzLmdldFNldHRpbmdzKHN0YXJ0TGluZSk7XG5cdFx0aWYgKCFzZXR0aW5ncy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLmVkaXRQcmVmZXJlbmNlV2lkZ2V0Rm9yTW91c2VNb3ZlLnNob3coc3RhcnRMaW5lLCAnJywgc2V0dGluZ3MpO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldEFjdGlvbnModGhpcy5lZGl0UHJlZmVyZW5jZVdpZGdldEZvck1vdXNlTW92ZS5wcmVmZXJlbmNlc1swXSwgdGhpcy5nZXRDb25maWd1cmF0aW9uc01hcCgpW3RoaXMuZWRpdFByZWZlcmVuY2VXaWRnZXRGb3JNb3VzZU1vdmUucHJlZmVyZW5jZXNbMF0ua2V5XSk7XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gdGhpcy50b0Fic29sdXRlQ29vcmRzKG5ldyBQb3NpdGlvbihzdGFydExpbmUsIDEpKSxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnNcblx0XHR9KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0Fic29sdXRlQ29vcmRzKHBvc2l0aW9uOiBQb3NpdGlvbik6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG5cdFx0Y29uc3QgcG9zaXRpb25Db29yZHMgPSB0aGlzLmVkaXRvci5nZXRTY3JvbGxlZFZpc2libGVQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0Y29uc3QgZWRpdG9yQ29vcmRzID0gZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLmVkaXRvci5nZXREb21Ob2RlKCkhKTtcblx0XHRjb25zdCB4ID0gZWRpdG9yQ29vcmRzLmxlZnQgKyBwb3NpdGlvbkNvb3JkcyEubGVmdDtcblx0XHRjb25zdCB5ID0gZWRpdG9yQ29vcmRzLnRvcCArIHBvc2l0aW9uQ29vcmRzIS50b3AgKyBwb3NpdGlvbkNvb3JkcyEuaGVpZ2h0O1xuXG5cdFx0cmV0dXJuIHsgeCwgeTogeSArIDEwIH07XG5cdH1cblxuXHRwcml2YXRlIGdldENvbmZpZ3VyYXRpb25zTWFwKCk6IHsgW3F1YWxpZmllZEtleTogc3RyaW5nXTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB9IHtcblx0XHRyZXR1cm4gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aW9ucyhzZXR0aW5nOiBJSW5kZXhlZFNldHRpbmcsIGpzb25TY2hlbWE6IElKU09OU2NoZW1hKTogSUFjdGlvbltdIHtcblx0XHRpZiAoanNvblNjaGVtYS50eXBlID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRpZDogJ3RydXRoeVZhbHVlJyxcblx0XHRcdFx0bGFiZWw6ICd0cnVlJyxcblx0XHRcdFx0dG9vbHRpcDogJ3RydWUnLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRydW46ICgpID0+IHRoaXMudXBkYXRlU2V0dGluZyhzZXR0aW5nLmtleSwgdHJ1ZSwgc2V0dGluZyksXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWRcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6ICdmYWxzeVZhbHVlJyxcblx0XHRcdFx0bGFiZWw6ICdmYWxzZScsXG5cdFx0XHRcdHRvb2x0aXA6ICdmYWxzZScsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy51cGRhdGVTZXR0aW5nKHNldHRpbmcua2V5LCBmYWxzZSwgc2V0dGluZyksXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWRcblx0XHRcdH1dO1xuXHRcdH1cblx0XHRpZiAoanNvblNjaGVtYS5lbnVtKSB7XG5cdFx0XHRyZXR1cm4ganNvblNjaGVtYS5lbnVtLm1hcCh2YWx1ZSA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6IHZhbHVlLFxuXHRcdFx0XHRcdGxhYmVsOiBKU09OLnN0cmluZ2lmeSh2YWx1ZSksXG5cdFx0XHRcdFx0dG9vbHRpcDogSlNPTi5zdHJpbmdpZnkodmFsdWUpLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLnVwZGF0ZVNldHRpbmcoc2V0dGluZy5rZXksIHZhbHVlLCBzZXR0aW5nKSxcblx0XHRcdFx0XHRjbGFzczogdW5kZWZpbmVkXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0RGVmYXVsdEFjdGlvbnMoc2V0dGluZyk7XG5cdH1cblxuXHRwcml2YXRlIGdldERlZmF1bHRBY3Rpb25zKHNldHRpbmc6IElJbmRleGVkU2V0dGluZyk6IElBY3Rpb25bXSB7XG5cdFx0aWYgKHRoaXMuaXNEZWZhdWx0U2V0dGluZ3MoKSkge1xuXHRcdFx0Y29uc3Qgc2V0dGluZ0luT3RoZXJNb2RlbCA9IHRoaXMuYXNzb2NpYXRlZFByZWZlcmVuY2VzTW9kZWwuZ2V0UHJlZmVyZW5jZShzZXR0aW5nLmtleSk7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0aWQ6ICdzZXREZWZhdWx0VmFsdWUnLFxuXHRcdFx0XHRsYWJlbDogc2V0dGluZ0luT3RoZXJNb2RlbCA/IG5scy5sb2NhbGl6ZSgncmVwbGFjZURlZmF1bHRWYWx1ZScsIFwiUmVwbGFjZSBpbiBTZXR0aW5nc1wiKSA6IG5scy5sb2NhbGl6ZSgnY29weURlZmF1bHRWYWx1ZScsIFwiQ29weSB0byBTZXR0aW5nc1wiKSxcblx0XHRcdFx0dG9vbHRpcDogc2V0dGluZ0luT3RoZXJNb2RlbCA/IG5scy5sb2NhbGl6ZSgncmVwbGFjZURlZmF1bHRWYWx1ZScsIFwiUmVwbGFjZSBpbiBTZXR0aW5nc1wiKSA6IG5scy5sb2NhbGl6ZSgnY29weURlZmF1bHRWYWx1ZScsIFwiQ29weSB0byBTZXR0aW5nc1wiKSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLnVwZGF0ZVNldHRpbmcoc2V0dGluZy5rZXksIHNldHRpbmcudmFsdWUsIHNldHRpbmcpLFxuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkXG5cdFx0XHR9XTtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTZXR0aW5nKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBzb3VyY2U6IElJbmRleGVkU2V0dGluZyk6IHZvaWQge1xuXHRcdHRoaXMuX29uVXBkYXRlU2V0dGluZy5maXJlKHsga2V5LCB2YWx1ZSwgc291cmNlIH0pO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdIaWdobGlnaHRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgZml4ZWRIaWdobGlnaHRlcjogUmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucztcblx0cHJpdmF0ZSB2b2xhdGlsZUhpZ2hsaWdodGVyOiBSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZWRpdG9yOiBJQ29kZUVkaXRvciwgQElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmZpeGVkSGlnaGxpZ2h0ZXIgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zKSk7XG5cdFx0dGhpcy52b2xhdGlsZUhpZ2hsaWdodGVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucykpO1xuXHR9XG5cblx0aGlnaGxpZ2h0KHNldHRpbmc6IElTZXR0aW5nLCBmaXg6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdHRoaXMudm9sYXRpbGVIaWdobGlnaHRlci5yZW1vdmVIaWdobGlnaHRSYW5nZSgpO1xuXHRcdHRoaXMuZml4ZWRIaWdobGlnaHRlci5yZW1vdmVIaWdobGlnaHRSYW5nZSgpO1xuXG5cdFx0Y29uc3QgaGlnaGxpZ2h0ZXIgPSBmaXggPyB0aGlzLmZpeGVkSGlnaGxpZ2h0ZXIgOiB0aGlzLnZvbGF0aWxlSGlnaGxpZ2h0ZXI7XG5cdFx0aGlnaGxpZ2h0ZXIuaGlnaGxpZ2h0UmFuZ2Uoe1xuXHRcdFx0cmFuZ2U6IHNldHRpbmcudmFsdWVSYW5nZSxcblx0XHRcdHJlc291cmNlOiB0aGlzLmVkaXRvci5nZXRNb2RlbCgpIS51cmlcblx0XHR9LCB0aGlzLmVkaXRvcik7XG5cblx0XHR0aGlzLmVkaXRvci5yZXZlYWxMaW5lSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChzZXR0aW5nLnZhbHVlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHR9XG5cblx0Y2xlYXIoZml4OiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHR0aGlzLnZvbGF0aWxlSGlnaGxpZ2h0ZXIucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHRpZiAoZml4KSB7XG5cdFx0XHR0aGlzLmZpeGVkSGlnaGxpZ2h0ZXIucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVW5zdXBwb3J0ZWRTZXR0aW5nc1JlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Db2RlQWN0aW9uUHJvdmlkZXIge1xuXG5cdHByaXZhdGUgcmVuZGVyaW5nRGVsYXllcjogRGVsYXllcjx2b2lkPiA9IG5ldyBEZWxheWVyPHZvaWQ+KDIwMCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb2RlQWN0aW9ucyA9IG5ldyBSZXNvdXJjZU1hcDxbUmFuZ2UsIGxhbmd1YWdlcy5Db2RlQWN0aW9uW11dW10+KHVyaSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZ2V0Q29tcGFyaXNvbktleSh1cmkpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzZXR0aW5nc0VkaXRvck1vZGVsOiBTZXR0aW5nc0VkaXRvck1vZGVsLFxuXHRcdEBJTWFya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5nZXRNb2RlbCgpIS5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gdGhpcy5kZWxheWVkUmVuZGVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5zb3VyY2UgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuREVGQVVMVCkoKCkgPT4gdGhpcy5kZWxheWVkUmVuZGVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlQWN0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBwYXR0ZXJuOiBzZXR0aW5nc0VkaXRvck1vZGVsLnVyaS5wYXRoIH0sIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQ3VycmVudFByb2ZpbGUoKCkgPT4gdGhpcy5kZWxheWVkUmVuZGVyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgZGVsYXllZFJlbmRlcigpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcmluZ0RlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLnJlbmRlcigpKTtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jb2RlQWN0aW9ucy5jbGVhcigpO1xuXHRcdGNvbnN0IG1hcmtlckRhdGE6IElNYXJrZXJEYXRhW10gPSB0aGlzLmdlbmVyYXRlTWFya2VyRGF0YSgpO1xuXHRcdGlmIChtYXJrZXJEYXRhLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5tYXJrZXJTZXJ2aWNlLmNoYW5nZU9uZSgnVW5zdXBwb3J0ZWRTZXR0aW5nc1JlbmRlcmVyJywgdGhpcy5zZXR0aW5nc0VkaXRvck1vZGVsLnVyaSwgbWFya2VyRGF0YSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubWFya2VyU2VydmljZS5yZW1vdmUoJ1Vuc3VwcG9ydGVkU2V0dGluZ3NSZW5kZXJlcicsIFt0aGlzLnNldHRpbmdzRWRpdG9yTW9kZWwudXJpXSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcHJvdmlkZUNvZGVBY3Rpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UgfCBTZWxlY3Rpb24sIGNvbnRleHQ6IGxhbmd1YWdlcy5Db2RlQWN0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuQ29kZUFjdGlvbkxpc3Q+IHtcblx0XHRjb25zdCBhY3Rpb25zOiBsYW5ndWFnZXMuQ29kZUFjdGlvbltdID0gW107XG5cdFx0Y29uc3QgY29kZUFjdGlvbnNCeVJhbmdlID0gdGhpcy5jb2RlQWN0aW9ucy5nZXQobW9kZWwudXJpKTtcblx0XHRpZiAoY29kZUFjdGlvbnNCeVJhbmdlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IFtjb2RlQWN0aW9uc1JhbmdlLCBjb2RlQWN0aW9uc10gb2YgY29kZUFjdGlvbnNCeVJhbmdlKSB7XG5cdFx0XHRcdGlmIChjb2RlQWN0aW9uc1JhbmdlLmNvbnRhaW5zUmFuZ2UocmFuZ2UpKSB7XG5cdFx0XHRcdFx0YWN0aW9ucy5wdXNoKC4uLmNvZGVBY3Rpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0YWN0aW9ucyxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGdlbmVyYXRlTWFya2VyRGF0YSgpOiBJTWFya2VyRGF0YVtdIHtcblx0XHRjb25zdCBtYXJrZXJEYXRhOiBJTWFya2VyRGF0YVtdID0gW107XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRmb3IgKGNvbnN0IHNldHRpbmdzR3JvdXAgb2YgdGhpcy5zZXR0aW5nc0VkaXRvck1vZGVsLnNldHRpbmdzR3JvdXBzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHNlY3Rpb24gb2Ygc2V0dGluZ3NHcm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2VjdGlvbi5zZXR0aW5ncykge1xuXHRcdFx0XHRcdGlmIChPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KHNldHRpbmcua2V5KSkge1xuXHRcdFx0XHRcdFx0aWYgKHNldHRpbmcub3ZlcnJpZGVzKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaGFuZGxlT3ZlcnJpZGVzKHNldHRpbmcub3ZlcnJpZGVzLCBjb25maWd1cmF0aW9uUmVnaXN0cnksIG1hcmtlckRhdGEpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uUmVnaXN0cnlbc2V0dGluZy5rZXldO1xuXHRcdFx0XHRcdGlmIChjb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmhhbmRsZVVuc3RhYmxlU2V0dGluZ0NvbmZpZ3VyYXRpb24oc2V0dGluZywgY29uZmlndXJhdGlvbiwgbWFya2VyRGF0YSk7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5oYW5kbGVQb2xpY3lDb25maWd1cmF0aW9uKHNldHRpbmcsIGNvbmZpZ3VyYXRpb24sIG1hcmtlckRhdGEpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0c3dpdGNoICh0aGlzLnNldHRpbmdzRWRpdG9yTW9kZWwuY29uZmlndXJhdGlvblRhcmdldCkge1xuXHRcdFx0XHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDpcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmhhbmRsZUxvY2FsVXNlckNvbmZpZ3VyYXRpb24oc2V0dGluZywgY29uZmlndXJhdGlvbiwgbWFya2VyRGF0YSk7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URTpcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmhhbmRsZVJlbW90ZVVzZXJDb25maWd1cmF0aW9uKHNldHRpbmcsIGNvbmZpZ3VyYXRpb24sIG1hcmtlckRhdGEpO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFOlxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuaGFuZGxlV29ya3NwYWNlQ29uZmlndXJhdGlvbihzZXR0aW5nLCBjb25maWd1cmF0aW9uLCBtYXJrZXJEYXRhKTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI6XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5oYW5kbGVXb3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uKHNldHRpbmcsIGNvbmZpZ3VyYXRpb24sIG1hcmtlckRhdGEpO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtYXJrZXJEYXRhLnB1c2godGhpcy5nZW5lcmF0ZVVua25vd25Db25maWd1cmF0aW9uTWFya2VyKHNldHRpbmcpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG1hcmtlckRhdGE7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVBvbGljeUNvbmZpZ3VyYXRpb24oc2V0dGluZzogSVNldHRpbmcsIGNvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIG1hcmtlckRhdGE6IElNYXJrZXJEYXRhW10pOiBib29sZWFuIHtcblx0XHRpZiAoIWNvbmZpZ3VyYXRpb24ucG9saWN5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Qoc2V0dGluZy5rZXkpLnBvbGljeVZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3NFZGl0b3JNb2RlbC5jb25maWd1cmF0aW9uVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LkRFRkFVTFQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0bWFya2VyRGF0YS5wdXNoKHtcblx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0dGFnczogW01hcmtlclRhZy5Vbm5lY2Vzc2FyeV0sXG5cdFx0XHQuLi5zZXR0aW5nLnJhbmdlLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bnN1cHBvcnRlZFBvbGljeVNldHRpbmcnLCBcIlRoaXMgc2V0dGluZyBjYW5ub3QgYmUgYXBwbGllZCBiZWNhdXNlIGl0IGlzIGNvbmZpZ3VyZWQgaW4gdGhlIHN5c3RlbSBwb2xpY3kuXCIpXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZU92ZXJyaWRlcyhvdmVycmlkZXM6IElTZXR0aW5nW10sIGNvbmZpZ3VyYXRpb25SZWdpc3RyeTogSVN0cmluZ0RpY3Rpb25hcnk8SVJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+LCBtYXJrZXJEYXRhOiBJTWFya2VyRGF0YVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIG92ZXJyaWRlcyB8fCBbXSkge1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb25SZWdpc3RyeVtzZXR0aW5nLmtleV07XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRpZiAoY29uZmlndXJhdGlvbi5zY29wZSAhPT0gQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFKSB7XG5cdFx0XHRcdFx0bWFya2VyRGF0YS5wdXNoKHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0XHRcdFx0dGFnczogW01hcmtlclRhZy5Vbm5lY2Vzc2FyeV0sXG5cdFx0XHRcdFx0XHQuLi5zZXR0aW5nLnJhbmdlLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bnN1cHBvcnRMYW5ndWFnZU92ZXJyaWRlU2V0dGluZycsIFwiVGhpcyBzZXR0aW5nIGNhbm5vdCBiZSBhcHBsaWVkIGJlY2F1c2UgaXQgaXMgbm90IHJlZ2lzdGVyZWQgYXMgbGFuZ3VhZ2Ugb3ZlcnJpZGUgc2V0dGluZy5cIilcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bWFya2VyRGF0YS5wdXNoKHRoaXMuZ2VuZXJhdGVVbmtub3duQ29uZmlndXJhdGlvbk1hcmtlcihzZXR0aW5nKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVMb2NhbFVzZXJDb25maWd1cmF0aW9uKHNldHRpbmc6IElTZXR0aW5nLCBjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hLCBtYXJrZXJEYXRhOiBJTWFya2VyRGF0YVtdKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNEZWZhdWx0ICYmICF0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5zZXR0aW5ncykge1xuXHRcdFx0aWYgKGlzRXF1YWwodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCB0aGlzLnNldHRpbmdzRWRpdG9yTW9kZWwudXJpKSAmJiAhdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pc1NldHRpbmdBcHBsaWVkRm9yQWxsUHJvZmlsZXMoc2V0dGluZy5rZXkpKSB7XG5cdFx0XHRcdC8vIElmIHdlJ3JlIGluIHRoZSBkZWZhdWx0IHByb2ZpbGUgc2V0dGluZyBmaWxlLCBhbmQgdGhlIHNldHRpbmcgY2Fubm90IGJlIGFwcGxpZWQgaW4gYWxsIHByb2ZpbGVzXG5cdFx0XHRcdG1hcmtlckRhdGEucHVzaCh7XG5cdFx0XHRcdFx0c2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5LkhpbnQsXG5cdFx0XHRcdFx0dGFnczogW01hcmtlclRhZy5Vbm5lY2Vzc2FyeV0sXG5cdFx0XHRcdFx0Li4uc2V0dGluZy5yYW5nZSxcblx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2RlZmF1bHRQcm9maWxlU2V0dGluZ1doaWxlTm9uRGVmYXVsdEFjdGl2ZScsIFwiVGhpcyBzZXR0aW5nIGNhbm5vdCBiZSBhcHBsaWVkIHdoaWxlIGEgbm9uLWRlZmF1bHQgcHJvZmlsZSBpcyBhY3RpdmUuIEl0IHdpbGwgYmUgYXBwbGllZCB3aGVuIHRoZSBkZWZhdWx0IHByb2ZpbGUgaXMgYWN0aXZlLlwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoaXNFcXVhbCh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZSwgdGhpcy5zZXR0aW5nc0VkaXRvck1vZGVsLnVyaSkpIHtcblx0XHRcdFx0aWYgKGNvbmZpZ3VyYXRpb24uc2NvcGUgJiYgQVBQTElDQVRJT05fU0NPUEVTLmluY2x1ZGVzKGNvbmZpZ3VyYXRpb24uc2NvcGUpKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UncmUgaW4gYSBwcm9maWxlIHNldHRpbmcgZmlsZSwgYW5kIHRoZSBzZXR0aW5nIGlzIGFwcGxpY2F0aW9uLXNjb3BlZCwgZmFkZSBpdCBvdXQuXG5cdFx0XHRcdFx0bWFya2VyRGF0YS5wdXNoKHRoaXMuZ2VuZXJhdGVVbnN1cHBvcnRlZEFwcGxpY2F0aW9uU2V0dGluZ01hcmtlcihzZXR0aW5nKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pc1NldHRpbmdBcHBsaWVkRm9yQWxsUHJvZmlsZXMoc2V0dGluZy5rZXkpKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UncmUgaW4gdGhlIG5vbi1kZWZhdWx0IHByb2ZpbGUgc2V0dGluZyBmaWxlLCBhbmQgdGhlIHNldHRpbmcgY2FuIGJlIGFwcGxpZWQgaW4gYWxsIHByb2ZpbGVzLCBmYWRlIGl0IG91dC5cblx0XHRcdFx0XHRtYXJrZXJEYXRhLnB1c2goe1xuXHRcdFx0XHRcdFx0c2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5LkhpbnQsXG5cdFx0XHRcdFx0XHR0YWdzOiBbTWFya2VyVGFnLlVubmVjZXNzYXJ5XSxcblx0XHRcdFx0XHRcdC4uLnNldHRpbmcucmFuZ2UsXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2FsbFByb2ZpbGVTZXR0aW5nV2hpbGVJbk5vbkRlZmF1bHRQcm9maWxlU2V0dGluZycsIFwiVGhpcyBzZXR0aW5nIGNhbm5vdCBiZSBhcHBsaWVkIGJlY2F1c2UgaXQgaXMgY29uZmlndXJlZCB0byBiZSBhcHBsaWVkIGluIGFsbCBwcm9maWxlcyB1c2luZyBzZXR0aW5nIHswfS4gVmFsdWUgZnJvbSB0aGUgZGVmYXVsdCBwcm9maWxlIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLlwiLCBBUFBMWV9BTExfUFJPRklMRVNfU0VUVElORylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmIChjb25maWd1cmF0aW9uLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORSB8fCBjb25maWd1cmF0aW9uLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT05fTUFDSElORSB8fCBjb25maWd1cmF0aW9uLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORV9PVkVSUklEQUJMRSkpIHtcblx0XHRcdG1hcmtlckRhdGEucHVzaCh7XG5cdFx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0XHR0YWdzOiBbTWFya2VyVGFnLlVubmVjZXNzYXJ5XSxcblx0XHRcdFx0Li4uc2V0dGluZy5yYW5nZSxcblx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bnN1cHBvcnRlZFJlbW90ZU1hY2hpbmVTZXR0aW5nJywgXCJUaGlzIHNldHRpbmcgY2Fubm90IGJlIGFwcGxpZWQgaW4gdGhpcyB3aW5kb3cuIEl0IHdpbGwgYmUgYXBwbGllZCB3aGVuIHlvdSBvcGVuIGEgbG9jYWwgd2luZG93LlwiKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVSZW1vdGVVc2VyQ29uZmlndXJhdGlvbihzZXR0aW5nOiBJU2V0dGluZywgY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgbWFya2VyRGF0YTogSU1hcmtlckRhdGFbXSk6IHZvaWQge1xuXHRcdGlmIChjb25maWd1cmF0aW9uLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04pIHtcblx0XHRcdG1hcmtlckRhdGEucHVzaCh0aGlzLmdlbmVyYXRlVW5zdXBwb3J0ZWRBcHBsaWNhdGlvblNldHRpbmdNYXJrZXIoc2V0dGluZykpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlV29ya3NwYWNlQ29uZmlndXJhdGlvbihzZXR0aW5nOiBJU2V0dGluZywgY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgbWFya2VyRGF0YTogSU1hcmtlckRhdGFbXSk6IHZvaWQge1xuXHRcdGlmIChjb25maWd1cmF0aW9uLnNjb3BlICYmIEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyhjb25maWd1cmF0aW9uLnNjb3BlKSkge1xuXHRcdFx0bWFya2VyRGF0YS5wdXNoKHRoaXMuZ2VuZXJhdGVVbnN1cHBvcnRlZEFwcGxpY2F0aW9uU2V0dGluZ01hcmtlcihzZXR0aW5nKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uc2NvcGUgPT09IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FKSB7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2godGhpcy5nZW5lcmF0ZVVuc3VwcG9ydGVkTWFjaGluZVNldHRpbmdNYXJrZXIoc2V0dGluZykpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpICYmIGNvbmZpZ3VyYXRpb24ucmVzdHJpY3RlZCkge1xuXHRcdFx0Y29uc3QgbWFya2VyID0gdGhpcy5nZW5lcmF0ZVVudHJ1c3RlZFNldHRpbmdNYXJrZXIoc2V0dGluZyk7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2gobWFya2VyKTtcblx0XHRcdGNvbnN0IGNvZGVBY3Rpb25zID0gdGhpcy5nZW5lcmF0ZVVudHJ1c3RlZFNldHRpbmdDb2RlQWN0aW9ucyhbbWFya2VyXSk7XG5cdFx0XHR0aGlzLmFkZENvZGVBY3Rpb25zKG1hcmtlciwgY29kZUFjdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlV29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbihzZXR0aW5nOiBJU2V0dGluZywgY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgbWFya2VyRGF0YTogSU1hcmtlckRhdGFbXSk6IHZvaWQge1xuXHRcdGlmIChjb25maWd1cmF0aW9uLnNjb3BlICYmIEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyhjb25maWd1cmF0aW9uLnNjb3BlKSkge1xuXHRcdFx0bWFya2VyRGF0YS5wdXNoKHRoaXMuZ2VuZXJhdGVVbnN1cHBvcnRlZEFwcGxpY2F0aW9uU2V0dGluZ01hcmtlcihzZXR0aW5nKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uc2NvcGUgPT09IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FKSB7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2godGhpcy5nZW5lcmF0ZVVuc3VwcG9ydGVkTWFjaGluZVNldHRpbmdNYXJrZXIoc2V0dGluZykpO1xuXHRcdH1cblxuXHRcdGlmIChjb25maWd1cmF0aW9uLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuV0lORE9XKSB7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2goe1xuXHRcdFx0XHRzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuSGludCxcblx0XHRcdFx0dGFnczogW01hcmtlclRhZy5Vbm5lY2Vzc2FyeV0sXG5cdFx0XHRcdC4uLnNldHRpbmcucmFuZ2UsXG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndW5zdXBwb3J0ZWRXaW5kb3dTZXR0aW5nJywgXCJUaGlzIHNldHRpbmcgY2Fubm90IGJlIGFwcGxpZWQgaW4gdGhpcyB3b3Jrc3BhY2UuIEl0IHdpbGwgYmUgYXBwbGllZCB3aGVuIHlvdSBvcGVuIHRoZSBjb250YWluaW5nIHdvcmtzcGFjZSBmb2xkZXIgZGlyZWN0bHkuXCIpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSAmJiBjb25maWd1cmF0aW9uLnJlc3RyaWN0ZWQpIHtcblx0XHRcdGNvbnN0IG1hcmtlciA9IHRoaXMuZ2VuZXJhdGVVbnRydXN0ZWRTZXR0aW5nTWFya2VyKHNldHRpbmcpO1xuXHRcdFx0bWFya2VyRGF0YS5wdXNoKG1hcmtlcik7XG5cdFx0XHRjb25zdCBjb2RlQWN0aW9ucyA9IHRoaXMuZ2VuZXJhdGVVbnRydXN0ZWRTZXR0aW5nQ29kZUFjdGlvbnMoW21hcmtlcl0pO1xuXHRcdFx0dGhpcy5hZGRDb2RlQWN0aW9ucyhtYXJrZXIsIGNvZGVBY3Rpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVVuc3RhYmxlU2V0dGluZ0NvbmZpZ3VyYXRpb24oc2V0dGluZzogSVNldHRpbmcsIGNvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIG1hcmtlckRhdGE6IElNYXJrZXJEYXRhW10pOiB2b2lkIHtcblx0XHRpZiAoY29uZmlndXJhdGlvbi50YWdzPy5pbmNsdWRlcygncHJldmlldycpKSB7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2godGhpcy5nZW5lcmF0ZVByZXZpZXdTZXR0aW5nTWFya2VyKHNldHRpbmcpKTtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZ3VyYXRpb24udGFncz8uaW5jbHVkZXMoJ2V4cGVyaW1lbnRhbCcpKSB7XG5cdFx0XHRtYXJrZXJEYXRhLnB1c2godGhpcy5nZW5lcmF0ZUV4cGVyaW1lbnRhbFNldHRpbmdNYXJrZXIoc2V0dGluZykpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2VuZXJhdGVVbnN1cHBvcnRlZEFwcGxpY2F0aW9uU2V0dGluZ01hcmtlcihzZXR0aW5nOiBJU2V0dGluZyk6IElNYXJrZXJEYXRhIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5LkhpbnQsXG5cdFx0XHR0YWdzOiBbTWFya2VyVGFnLlVubmVjZXNzYXJ5XSxcblx0XHRcdC4uLnNldHRpbmcucmFuZ2UsXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3Vuc3VwcG9ydGVkQXBwbGljYXRpb25TZXR0aW5nJywgXCJUaGlzIHNldHRpbmcgaGFzIGFuIGFwcGxpY2F0aW9uIHNjb3BlIGFuZCBjYW4gYmUgc2V0IG9ubHkgaW4gdGhlIHVzZXIgc2V0dGluZ3MgZmlsZS5cIilcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZW5lcmF0ZVVuc3VwcG9ydGVkTWFjaGluZVNldHRpbmdNYXJrZXIoc2V0dGluZzogSVNldHRpbmcpOiBJTWFya2VyRGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0dGFnczogW01hcmtlclRhZy5Vbm5lY2Vzc2FyeV0sXG5cdFx0XHQuLi5zZXR0aW5nLnJhbmdlLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bnN1cHBvcnRlZE1hY2hpbmVTZXR0aW5nJywgXCJUaGlzIHNldHRpbmcgY2FuIG9ubHkgYmUgYXBwbGllZCBpbiB1c2VyIHNldHRpbmdzIGluIGxvY2FsIHdpbmRvdyBvciBpbiByZW1vdGUgc2V0dGluZ3MgaW4gcmVtb3RlIHdpbmRvdy5cIilcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZW5lcmF0ZVVudHJ1c3RlZFNldHRpbmdNYXJrZXIoc2V0dGluZzogSVNldHRpbmcpOiBJTWFya2VyRGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0Li4uc2V0dGluZy5yYW5nZSxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndW50cnVzdGVkU2V0dGluZycsIFwiVGhpcyBzZXR0aW5nIGNhbiBvbmx5IGJlIGFwcGxpZWQgaW4gYSB0cnVzdGVkIHdvcmtzcGFjZS5cIilcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZW5lcmF0ZVVua25vd25Db25maWd1cmF0aW9uTWFya2VyKHNldHRpbmc6IElTZXR0aW5nKTogSU1hcmtlckRhdGEge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuSGludCxcblx0XHRcdHRhZ3M6IFtNYXJrZXJUYWcuVW5uZWNlc3NhcnldLFxuXHRcdFx0Li4uc2V0dGluZy5yYW5nZSxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndW5rbm93biBjb25maWd1cmF0aW9uIHNldHRpbmcnLCBcIlVua25vd24gQ29uZmlndXJhdGlvbiBTZXR0aW5nXCIpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2VuZXJhdGVVbnRydXN0ZWRTZXR0aW5nQ29kZUFjdGlvbnMoZGlhZ25vc3RpY3M6IElNYXJrZXJEYXRhW10pOiBsYW5ndWFnZXMuQ29kZUFjdGlvbltdIHtcblx0XHRyZXR1cm4gW3tcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ21hbmFnZSB3b3Jrc3BhY2UgdHJ1c3QnLCBcIk1hbmFnZSBXb3Jrc3BhY2UgVHJ1c3RcIiksXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLnRydXN0Lm1hbmFnZScsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ21hbmFnZSB3b3Jrc3BhY2UgdHJ1c3QnLCBcIk1hbmFnZSBXb3Jrc3BhY2UgVHJ1c3RcIilcblx0XHRcdH0sXG5cdFx0XHRkaWFnbm9zdGljcyxcblx0XHRcdGtpbmQ6IENvZGVBY3Rpb25LaW5kLlF1aWNrRml4LnZhbHVlXG5cdFx0fV07XG5cdH1cblxuXHRwcml2YXRlIGdlbmVyYXRlUHJldmlld1NldHRpbmdNYXJrZXIoc2V0dGluZzogSVNldHRpbmcpOiBJTWFya2VyRGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0Li4uc2V0dGluZy5yYW5nZSxcblx0XHRcdG1lc3NhZ2U6IFBSRVZJRVdfSU5ESUNBVE9SX0RFU0NSSVBUSU9OXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2VuZXJhdGVFeHBlcmltZW50YWxTZXR0aW5nTWFya2VyKHNldHRpbmc6IElTZXR0aW5nKTogSU1hcmtlckRhdGEge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuSGludCxcblx0XHRcdC4uLnNldHRpbmcucmFuZ2UsXG5cdFx0XHRtZXNzYWdlOiBFWFBFUklNRU5UQUxfSU5ESUNBVE9SX0RFU0NSSVBUSU9OXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYWRkQ29kZUFjdGlvbnMocmFuZ2U6IElSYW5nZSwgY29kZUFjdGlvbnM6IGxhbmd1YWdlcy5Db2RlQWN0aW9uW10pOiB2b2lkIHtcblx0XHRsZXQgYWN0aW9ucyA9IHRoaXMuY29kZUFjdGlvbnMuZ2V0KHRoaXMuc2V0dGluZ3NFZGl0b3JNb2RlbC51cmkpO1xuXHRcdGlmICghYWN0aW9ucykge1xuXHRcdFx0YWN0aW9ucyA9IFtdO1xuXHRcdFx0dGhpcy5jb2RlQWN0aW9ucy5zZXQodGhpcy5zZXR0aW5nc0VkaXRvck1vZGVsLnVyaSwgYWN0aW9ucyk7XG5cdFx0fVxuXHRcdGFjdGlvbnMucHVzaChbUmFuZ2UubGlmdChyYW5nZSksIGNvZGVBY3Rpb25zXSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLm1hcmtlclNlcnZpY2UucmVtb3ZlKCdVbnN1cHBvcnRlZFNldHRpbmdzUmVuZGVyZXInLCBbdGhpcy5zZXR0aW5nc0VkaXRvck1vZGVsLnVyaV0pO1xuXHRcdHRoaXMuY29kZUFjdGlvbnMuY2xlYXIoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxufVxuXG5jbGFzcyBXb3Jrc3BhY2VDb25maWd1cmF0aW9uUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgc3VwcG9ydGVkS2V5cyA9IFsnZm9sZGVycycsICd0YXNrcycsICdsYXVuY2gnLCAnZXh0ZW5zaW9ucycsICdzZXR0aW5ncycsICdyZW1vdGVBdXRob3JpdHknLCAndHJhbnNpZW50J107XG5cblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uczogZWRpdG9yQ29tbW9uLklFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cdHByaXZhdGUgcmVuZGVyaW5nRGVsYXllcjogRGVsYXllcjx2b2lkPiA9IG5ldyBEZWxheWVyPHZvaWQ+KDIwMCk7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBlZGl0b3I6IElDb2RlRWRpdG9yLCBwcml2YXRlIHdvcmtzcGFjZVNldHRpbmdzRWRpdG9yTW9kZWw6IFNldHRpbmdzRWRpdG9yTW9kZWwsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmRlY29yYXRpb25zID0gdGhpcy5lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3IuZ2V0TW9kZWwoKSEub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMucmVuZGVyaW5nRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMucmVuZGVyKCkpKSk7XG5cdH1cblxuXHRyZW5kZXIoKTogdm9pZCB7XG5cdFx0Y29uc3QgbWFya2VyRGF0YTogSU1hcmtlckRhdGFbXSA9IFtdO1xuXHRcdGlmICh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSAmJiB0aGlzLndvcmtzcGFjZVNldHRpbmdzRWRpdG9yTW9kZWwgaW5zdGFuY2VvZiBXb3Jrc3BhY2VDb25maWd1cmF0aW9uRWRpdG9yTW9kZWwpIHtcblx0XHRcdGNvbnN0IHJhbmdlczogSVJhbmdlW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3Qgc2V0dGluZ3NHcm91cCBvZiB0aGlzLndvcmtzcGFjZVNldHRpbmdzRWRpdG9yTW9kZWwuY29uZmlndXJhdGlvbkdyb3Vwcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlY3Rpb24gb2Ygc2V0dGluZ3NHcm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHRpZiAoIVdvcmtzcGFjZUNvbmZpZ3VyYXRpb25SZW5kZXJlci5zdXBwb3J0ZWRLZXlzLmluY2x1ZGVzKHNldHRpbmcua2V5KSkge1xuXHRcdFx0XHRcdFx0XHRtYXJrZXJEYXRhLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5IaW50LFxuXHRcdFx0XHRcdFx0XHRcdHRhZ3M6IFtNYXJrZXJUYWcuVW5uZWNlc3NhcnldLFxuXHRcdFx0XHRcdFx0XHRcdC4uLnNldHRpbmcucmFuZ2UsXG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bnN1cHBvcnRlZFByb3BlcnR5JywgXCJVbnN1cHBvcnRlZCBQcm9wZXJ0eVwiKVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuZGVjb3JhdGlvbnMuc2V0KHJhbmdlcy5tYXAocmFuZ2UgPT4gdGhpcy5jcmVhdGVEZWNvcmF0aW9uKHJhbmdlKSkpO1xuXHRcdH1cblx0XHRpZiAobWFya2VyRGF0YS5sZW5ndGgpIHtcblx0XHRcdHRoaXMubWFya2VyU2VydmljZS5jaGFuZ2VPbmUoJ1dvcmtzcGFjZUNvbmZpZ3VyYXRpb25SZW5kZXJlcicsIHRoaXMud29ya3NwYWNlU2V0dGluZ3NFZGl0b3JNb2RlbC51cmksIG1hcmtlckRhdGEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1hcmtlclNlcnZpY2UucmVtb3ZlKCdXb3Jrc3BhY2VDb25maWd1cmF0aW9uUmVuZGVyZXInLCBbdGhpcy53b3Jrc3BhY2VTZXR0aW5nc0VkaXRvck1vZGVsLnVyaV0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9ESU1fQ09ORklHVVJBVElPTl8gPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ2RpbS1jb25maWd1cmF0aW9uJyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRpbmxpbmVDbGFzc05hbWU6ICdkaW0tY29uZmlndXJhdGlvbidcblx0fSk7XG5cblx0cHJpdmF0ZSBjcmVhdGVEZWNvcmF0aW9uKHJhbmdlOiBJUmFuZ2UpOiBJTW9kZWxEZWx0YURlY29yYXRpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyYW5nZSxcblx0XHRcdG9wdGlvbnM6IFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25SZW5kZXJlci5fRElNX0NPTkZJR1VSQVRJT05fXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrZXJTZXJ2aWNlLnJlbW92ZSgnV29ya3NwYWNlQ29uZmlndXJhdGlvblJlbmRlcmVyJywgW3RoaXMud29ya3NwYWNlU2V0dGluZ3NFZGl0b3JNb2RlbC51cmldKTtcblx0XHR0aGlzLmRlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAi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
