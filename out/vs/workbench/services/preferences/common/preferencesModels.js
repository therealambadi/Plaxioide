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
import { coalesce } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { visit } from "../../../../base/common/json.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ConfigurationScope, Extensions, OVERRIDE_PROPERTY_REGEX } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { SettingMatchType } from "./preferences.js";
import { FOLDER_SCOPES, WORKSPACE_SCOPES } from "../../configuration/common/configuration.js";
import { createValidator } from "./preferencesValidation.js";
const nullRange = { startLineNumber: -1, startColumn: -1, endLineNumber: -1, endColumn: -1 };
function isNullRange(range) {
  return range.startLineNumber === -1 && range.startColumn === -1 && range.endLineNumber === -1 && range.endColumn === -1;
}
class AbstractSettingsModel extends EditorModel {
  constructor() {
    super(...arguments);
    this._currentResultGroups = /* @__PURE__ */ new Map();
  }
  updateResultGroup(id, resultGroup) {
    if (resultGroup) {
      this._currentResultGroups.set(id, resultGroup);
    } else {
      this._currentResultGroups.delete(id);
    }
    this.removeDuplicateResults();
    return this.update();
  }
  /**
   * Remove duplicates between result groups, preferring results in earlier groups
   */
  removeDuplicateResults() {
    const settingKeys = /* @__PURE__ */ new Set();
    [...this._currentResultGroups.keys()].sort((a, b) => this._currentResultGroups.get(a).order - this._currentResultGroups.get(b).order).forEach((groupId) => {
      const group = this._currentResultGroups.get(groupId);
      group.result.filterMatches = group.result.filterMatches.filter((s) => !settingKeys.has(s.setting.key));
      group.result.filterMatches.forEach((s) => settingKeys.add(s.setting.key));
    });
  }
  filterSettings(filter, groupFilter, settingMatcher) {
    const allGroups = this.filterGroups;
    const filterMatches = [];
    for (const group of allGroups) {
      const groupMatched = groupFilter(group);
      for (const section of group.sections) {
        for (const setting of section.settings) {
          const settingMatchResult = settingMatcher(setting, group);
          if (groupMatched || settingMatchResult) {
            filterMatches.push({
              setting,
              matches: settingMatchResult && settingMatchResult.matches,
              matchType: settingMatchResult?.matchType ?? SettingMatchType.None,
              keyMatchScore: settingMatchResult?.keyMatchScore ?? 0,
              score: settingMatchResult?.score ?? 0
            });
          }
        }
      }
    }
    return filterMatches;
  }
  getPreference(key) {
    for (const group of this.settingsGroups) {
      for (const section of group.sections) {
        for (const setting of section.settings) {
          if (key === setting.key) {
            return setting;
          }
        }
      }
    }
    return void 0;
  }
  collectMetadata(groups) {
    const metadata = /* @__PURE__ */ Object.create(null);
    let hasMetadata = false;
    groups.forEach((g) => {
      if (g.result.metadata) {
        metadata[g.id] = g.result.metadata;
        hasMetadata = true;
      }
    });
    return hasMetadata ? metadata : null;
  }
  get filterGroups() {
    return this.settingsGroups;
  }
}
class SettingsEditorModel extends AbstractSettingsModel {
  constructor(reference, _configurationTarget) {
    super();
    this._configurationTarget = _configurationTarget;
    this._onDidChangeGroups = this._register(new Emitter());
    this.onDidChangeGroups = this._onDidChangeGroups.event;
    this.settingsModel = reference.object.textEditorModel;
    this._register(this.onWillDispose(() => reference.dispose()));
    this._register(this.settingsModel.onDidChangeContent(() => {
      this._settingsGroups = void 0;
      this._onDidChangeGroups.fire();
    }));
  }
  get uri() {
    return this.settingsModel.uri;
  }
  get configurationTarget() {
    return this._configurationTarget;
  }
  get settingsGroups() {
    if (!this._settingsGroups) {
      this.parse();
    }
    return this._settingsGroups;
  }
  get content() {
    return this.settingsModel.getValue();
  }
  isSettingsProperty(property, previousParents) {
    return previousParents.length === 0;
  }
  parse() {
    this._settingsGroups = parse(this.settingsModel, (property, previousParents) => this.isSettingsProperty(property, previousParents));
  }
  update() {
    const resultGroups = [...this._currentResultGroups.values()];
    if (!resultGroups.length) {
      return void 0;
    }
    const filteredSettings = [];
    const matches = [];
    resultGroups.forEach((group) => {
      group.result.filterMatches.forEach((filterMatch) => {
        filteredSettings.push(filterMatch.setting);
        if (filterMatch.matches) {
          matches.push(...filterMatch.matches);
        }
      });
    });
    let filteredGroup;
    const modelGroup = this.settingsGroups[0];
    if (modelGroup) {
      filteredGroup = {
        id: modelGroup.id,
        range: modelGroup.range,
        sections: [{
          settings: filteredSettings
        }],
        title: modelGroup.title,
        titleRange: modelGroup.titleRange,
        order: modelGroup.order,
        extensionInfo: modelGroup.extensionInfo
      };
    }
    const metadata = this.collectMetadata(resultGroups);
    return {
      allGroups: this.settingsGroups,
      filteredGroups: filteredGroup ? [filteredGroup] : [],
      matches,
      metadata: metadata ?? void 0
    };
  }
}
let Settings2EditorModel = class extends AbstractSettingsModel {
  constructor(_defaultSettings, configurationService) {
    super();
    this._defaultSettings = _defaultSettings;
    this._onDidChangeGroups = this._register(new Emitter());
    this.onDidChangeGroups = this._onDidChangeGroups.event;
    this.additionalGroups = [];
    this.dirty = false;
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.source === ConfigurationTarget.DEFAULT) {
        this.dirty = true;
        this._onDidChangeGroups.fire();
      }
    }));
    this._register(Registry.as(Extensions.Configuration).onDidSchemaChange((e) => {
      this.dirty = true;
      this._onDidChangeGroups.fire();
    }));
  }
  /** Doesn't include the "Commonly Used" group */
  get filterGroups() {
    return this.settingsGroups.slice(1);
  }
  get settingsGroups() {
    const groups = this._defaultSettings.getSettingsGroups(this.dirty);
    this.dirty = false;
    return [...groups, ...this.additionalGroups];
  }
  /** For programmatically added groups outside of registered configurations */
  setAdditionalGroups(groups) {
    this.additionalGroups = groups;
  }
  update() {
    throw new Error("Not supported");
  }
};
Settings2EditorModel = __decorateClass([
  __decorateParam(1, IConfigurationService)
], Settings2EditorModel);
function parse(model, isSettingsProperty) {
  const settings = [];
  let overrideSetting = null;
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  let settingsPropertyIndex = -1;
  const range = {
    startLineNumber: 0,
    startColumn: 0,
    endLineNumber: 0,
    endColumn: 0
  };
  function onValue(value, offset, length) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty) {
      currentParent[currentProperty] = value;
    }
    if (previousParents.length === settingsPropertyIndex + 1 || previousParents.length === settingsPropertyIndex + 2 && overrideSetting !== null) {
      const setting = previousParents.length === settingsPropertyIndex + 1 ? settings[settings.length - 1] : overrideSetting.overrides[overrideSetting.overrides.length - 1];
      if (setting) {
        const valueStartPosition = model.getPositionAt(offset);
        const valueEndPosition = model.getPositionAt(offset + length);
        setting.value = value;
        setting.valueRange = {
          startLineNumber: valueStartPosition.lineNumber,
          startColumn: valueStartPosition.column,
          endLineNumber: valueEndPosition.lineNumber,
          endColumn: valueEndPosition.column
        };
        setting.range = Object.assign(setting.range, {
          endLineNumber: valueEndPosition.lineNumber,
          endColumn: valueEndPosition.column
        });
      }
    }
  }
  const visitor = {
    onObjectBegin: (offset, length) => {
      if (isSettingsProperty(currentProperty, previousParents)) {
        settingsPropertyIndex = previousParents.length;
        const position = model.getPositionAt(offset);
        range.startLineNumber = position.lineNumber;
        range.startColumn = position.column;
      }
      const object = {};
      onValue(object, offset, length);
      currentParent = object;
      currentProperty = null;
      previousParents.push(currentParent);
    },
    onObjectProperty: (name, offset, length) => {
      currentProperty = name;
      if (previousParents.length === settingsPropertyIndex + 1 || previousParents.length === settingsPropertyIndex + 2 && overrideSetting !== null) {
        const settingStartPosition = model.getPositionAt(offset);
        const setting = {
          description: [],
          descriptionIsMarkdown: false,
          key: name,
          keyRange: {
            startLineNumber: settingStartPosition.lineNumber,
            startColumn: settingStartPosition.column + 1,
            endLineNumber: settingStartPosition.lineNumber,
            endColumn: settingStartPosition.column + length
          },
          range: {
            startLineNumber: settingStartPosition.lineNumber,
            startColumn: settingStartPosition.column,
            endLineNumber: 0,
            endColumn: 0
          },
          value: null,
          valueRange: nullRange,
          descriptionRanges: [],
          overrides: [],
          overrideOf: overrideSetting ?? void 0
        };
        if (previousParents.length === settingsPropertyIndex + 1) {
          settings.push(setting);
          if (OVERRIDE_PROPERTY_REGEX.test(name)) {
            overrideSetting = setting;
          }
        } else {
          overrideSetting.overrides.push(setting);
        }
      }
    },
    onObjectEnd: (offset, length) => {
      currentParent = previousParents.pop();
      if (settingsPropertyIndex !== -1 && (previousParents.length === settingsPropertyIndex + 1 || previousParents.length === settingsPropertyIndex + 2 && overrideSetting !== null)) {
        const setting = previousParents.length === settingsPropertyIndex + 1 ? settings[settings.length - 1] : overrideSetting.overrides[overrideSetting.overrides.length - 1];
        if (setting) {
          const valueEndPosition = model.getPositionAt(offset + length);
          setting.valueRange = Object.assign(setting.valueRange, {
            endLineNumber: valueEndPosition.lineNumber,
            endColumn: valueEndPosition.column
          });
          setting.range = Object.assign(setting.range, {
            endLineNumber: valueEndPosition.lineNumber,
            endColumn: valueEndPosition.column
          });
        }
        if (previousParents.length === settingsPropertyIndex + 1) {
          overrideSetting = null;
        }
      }
      if (previousParents.length === settingsPropertyIndex) {
        const position = model.getPositionAt(offset);
        range.endLineNumber = position.lineNumber;
        range.endColumn = position.column;
        settingsPropertyIndex = -1;
      }
    },
    onArrayBegin: (offset, length) => {
      const array = [];
      onValue(array, offset, length);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: (offset, length) => {
      currentParent = previousParents.pop();
      if (previousParents.length === settingsPropertyIndex + 1 || previousParents.length === settingsPropertyIndex + 2 && overrideSetting !== null) {
        const setting = previousParents.length === settingsPropertyIndex + 1 ? settings[settings.length - 1] : overrideSetting.overrides[overrideSetting.overrides.length - 1];
        if (setting) {
          const valueEndPosition = model.getPositionAt(offset + length);
          setting.valueRange = Object.assign(setting.valueRange, {
            endLineNumber: valueEndPosition.lineNumber,
            endColumn: valueEndPosition.column
          });
          setting.range = Object.assign(setting.range, {
            endLineNumber: valueEndPosition.lineNumber,
            endColumn: valueEndPosition.column
          });
        }
      }
    },
    onLiteralValue: onValue,
    onError: (error) => {
      const setting = settings[settings.length - 1];
      if (setting && (isNullRange(setting.range) || isNullRange(setting.keyRange) || isNullRange(setting.valueRange))) {
        settings.pop();
      }
    }
  };
  if (!model.isDisposed()) {
    visit(model.getValue(), visitor);
  }
  return settings.length > 0 ? [{
    id: model.isDisposed() ? "" : model.id,
    sections: [
      {
        settings
      }
    ],
    title: "",
    titleRange: nullRange,
    range
  }] : [];
}
class WorkspaceConfigurationEditorModel extends SettingsEditorModel {
  constructor() {
    super(...arguments);
    this._configurationGroups = [];
  }
  get configurationGroups() {
    return this._configurationGroups;
  }
  parse() {
    super.parse();
    this._configurationGroups = parse(this.settingsModel, (property, previousParents) => previousParents.length === 0);
  }
  isSettingsProperty(property, previousParents) {
    return property === "settings" && previousParents.length === 1;
  }
}
class DefaultSettings extends Disposable {
  constructor(_mostCommonlyUsedSettingsKeys, target, configurationService) {
    super();
    this._mostCommonlyUsedSettingsKeys = _mostCommonlyUsedSettingsKeys;
    this.target = target;
    this.configurationService = configurationService;
    this._settingsByName = /* @__PURE__ */ new Map();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.source === ConfigurationTarget.DEFAULT) {
        this.reset();
        this._onDidChange.fire();
      }
    }));
  }
  getContent(forceUpdate = false) {
    if (!this._content || forceUpdate) {
      this.initialize();
    }
    return this._content;
  }
  getContentWithoutMostCommonlyUsed(forceUpdate = false) {
    if (!this._contentWithoutMostCommonlyUsed || forceUpdate) {
      this.initialize();
    }
    return this._contentWithoutMostCommonlyUsed;
  }
  getSettingsGroups(forceUpdate = false) {
    if (!this._allSettingsGroups || forceUpdate) {
      this.initialize();
    }
    return this._allSettingsGroups;
  }
  initialize() {
    this._allSettingsGroups = this.parse();
    this._content = this.toContent(this._allSettingsGroups, 0);
    this._contentWithoutMostCommonlyUsed = this.toContent(this._allSettingsGroups, 1);
  }
  reset() {
    this._content = void 0;
    this._contentWithoutMostCommonlyUsed = void 0;
    this._allSettingsGroups = void 0;
  }
  parse() {
    const settingsGroups = this.getRegisteredGroups();
    this.initAllSettingsMap(settingsGroups);
    const mostCommonlyUsed = this.getMostCommonlyUsedSettings();
    return [mostCommonlyUsed, ...settingsGroups];
  }
  getRegisteredGroups() {
    const configurations = Registry.as(Extensions.Configuration).getConfigurations().slice();
    const groups = this.removeEmptySettingsGroups(configurations.sort(this.compareConfigurationNodes).reduce((result, config, index, array) => this.parseConfig(config, result, array), []));
    return this.sortGroups(groups);
  }
  sortGroups(groups) {
    groups.forEach((group) => {
      group.sections.forEach((section) => {
        section.settings.sort((a, b) => a.key.localeCompare(b.key));
      });
    });
    return groups;
  }
  initAllSettingsMap(allSettingsGroups) {
    this._settingsByName = /* @__PURE__ */ new Map();
    for (const group of allSettingsGroups) {
      for (const section of group.sections) {
        for (const setting of section.settings) {
          this._settingsByName.set(setting.key, setting);
        }
      }
    }
  }
  getMostCommonlyUsedSettings() {
    const settings = coalesce(this._mostCommonlyUsedSettingsKeys.map((key) => {
      const setting = this._settingsByName.get(key);
      if (setting) {
        return {
          description: setting.description,
          key: setting.key,
          value: setting.value,
          keyRange: nullRange,
          range: nullRange,
          valueRange: nullRange,
          overrides: [],
          scope: ConfigurationScope.RESOURCE,
          type: setting.type,
          enum: setting.enum,
          enumDescriptions: setting.enumDescriptions,
          descriptionRanges: []
        };
      }
      return null;
    }));
    return {
      id: "mostCommonlyUsed",
      range: nullRange,
      title: nls.localize("commonlyUsed", "Commonly Used"),
      titleRange: nullRange,
      sections: [
        {
          settings
        }
      ]
    };
  }
  parseConfig(config, result, configurations, settingsGroup, seenSettings) {
    seenSettings = seenSettings ? seenSettings : {};
    let title = config.title;
    if (!title) {
      const configWithTitleAndSameId = configurations.find((c) => c.id === config.id && c.title);
      if (configWithTitleAndSameId) {
        title = configWithTitleAndSameId.title;
      }
    }
    if (title) {
      if (!settingsGroup) {
        settingsGroup = result.find((g) => g.title === title && g.extensionInfo?.id === config.extensionInfo?.id);
        if (!settingsGroup) {
          settingsGroup = { sections: [{ settings: [] }], id: config.id || "", title: title || "", titleRange: nullRange, order: config.order, range: nullRange, extensionInfo: config.extensionInfo };
          result.push(settingsGroup);
        }
      } else {
        settingsGroup.sections[settingsGroup.sections.length - 1].title = title;
      }
    }
    if (config.properties) {
      if (!settingsGroup) {
        settingsGroup = { sections: [{ settings: [] }], id: config.id || "", title: config.id || "", titleRange: nullRange, order: config.order, range: nullRange, extensionInfo: config.extensionInfo };
        result.push(settingsGroup);
      }
      const configurationSettings = [];
      for (const setting of [...settingsGroup.sections[settingsGroup.sections.length - 1].settings, ...this.parseSettings(config)]) {
        if (!seenSettings[setting.key]) {
          configurationSettings.push(setting);
          seenSettings[setting.key] = true;
        }
      }
      if (configurationSettings.length) {
        settingsGroup.sections[settingsGroup.sections.length - 1].settings = configurationSettings;
      }
    }
    config.allOf?.forEach((c) => this.parseConfig(c, result, configurations, settingsGroup, seenSettings));
    return result;
  }
  removeEmptySettingsGroups(settingsGroups) {
    const result = [];
    for (const settingsGroup of settingsGroups) {
      settingsGroup.sections = settingsGroup.sections.filter((section) => section.settings.length > 0);
      if (settingsGroup.sections.length) {
        result.push(settingsGroup);
      }
    }
    return result;
  }
  parseSettings(config) {
    const result = [];
    const settingsObject = config.properties;
    const extensionInfo = config.extensionInfo;
    const categoryLabel = config.extensionInfo?.id === config.id ? config.title : config.id;
    for (const key in settingsObject) {
      const prop = settingsObject[key];
      if (this.matchesScope(prop)) {
        const value = prop.default;
        let description = prop.markdownDescription || prop.description || "";
        if (typeof description !== "string") {
          description = "";
        }
        const descriptionLines = description.split("\n");
        const overrides = OVERRIDE_PROPERTY_REGEX.test(key) ? this.parseOverrideSettings(prop.default) : [];
        let listItemType;
        if (prop.type === "array" && prop.items && !Array.isArray(prop.items) && prop.items.type) {
          if (prop.items.enum) {
            listItemType = "enum";
          } else if (!Array.isArray(prop.items.type)) {
            listItemType = prop.items.type;
          }
        }
        const objectProperties = prop.type === "object" ? prop.properties : void 0;
        const objectPatternProperties = prop.type === "object" ? prop.patternProperties : void 0;
        const objectAdditionalProperties = prop.type === "object" ? prop.additionalProperties : void 0;
        let enumToUse = prop.enum;
        let enumDescriptions = prop.markdownEnumDescriptions ?? prop.enumDescriptions;
        let enumDescriptionsAreMarkdown = !!prop.markdownEnumDescriptions;
        if (listItemType === "enum" && !Array.isArray(prop.items)) {
          enumToUse = prop.items.enum;
          enumDescriptions = prop.items.markdownEnumDescriptions ?? prop.items.enumDescriptions;
          enumDescriptionsAreMarkdown = !!prop.items.markdownEnumDescriptions;
        }
        let allKeysAreBoolean = false;
        if (prop.type === "object" && !prop.additionalProperties && prop.properties && Object.keys(prop.properties).length) {
          allKeysAreBoolean = Object.keys(prop.properties).every((key2) => {
            return prop.properties[key2].type === "boolean";
          });
        }
        let isLanguageTagSetting = false;
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
          isLanguageTagSetting = true;
        }
        let defaultValueSource;
        if (!isLanguageTagSetting) {
          const registeredConfigurationProp = prop;
          if (registeredConfigurationProp && registeredConfigurationProp.defaultValueSource) {
            defaultValueSource = registeredConfigurationProp.defaultValueSource;
          }
        }
        if (!enumToUse && (prop.enumItemLabels || enumDescriptions || enumDescriptionsAreMarkdown)) {
          console.error(`The setting ${key} has enum-related fields, but doesn't have an enum field. This setting may render improperly in the Settings editor.`);
        }
        result.push({
          key,
          value,
          description: descriptionLines,
          descriptionIsMarkdown: !!prop.markdownDescription,
          range: nullRange,
          keyRange: nullRange,
          valueRange: nullRange,
          descriptionRanges: [],
          overrides,
          scope: prop.scope,
          type: prop.type,
          arrayItemType: listItemType,
          objectProperties,
          objectPatternProperties,
          objectAdditionalProperties,
          enum: enumToUse,
          enumDescriptions,
          enumDescriptionsAreMarkdown,
          enumItemLabels: prop.enumItemLabels,
          uniqueItems: prop.uniqueItems,
          tags: prop.tags,
          disallowSyncIgnore: prop.disallowSyncIgnore,
          restricted: prop.restricted,
          extensionInfo,
          deprecationMessage: prop.markdownDeprecationMessage || prop.deprecationMessage,
          deprecationMessageIsMarkdown: !!prop.markdownDeprecationMessage,
          validator: createValidator(prop),
          allKeysAreBoolean,
          editPresentation: prop.editPresentation,
          order: prop.order,
          nonLanguageSpecificDefaultValueSource: defaultValueSource,
          isLanguageTagSetting,
          categoryLabel
        });
      }
    }
    return result;
  }
  parseOverrideSettings(overrideSettings) {
    return Object.keys(overrideSettings).map((key) => ({
      key,
      value: overrideSettings[key],
      description: [],
      descriptionIsMarkdown: false,
      range: nullRange,
      keyRange: nullRange,
      valueRange: nullRange,
      descriptionRanges: [],
      overrides: []
    }));
  }
  matchesScope(property) {
    if (!property.scope) {
      return true;
    }
    if (this.target === ConfigurationTarget.WORKSPACE_FOLDER) {
      return FOLDER_SCOPES.indexOf(property.scope) !== -1;
    }
    if (this.target === ConfigurationTarget.WORKSPACE) {
      return WORKSPACE_SCOPES.indexOf(property.scope) !== -1;
    }
    return true;
  }
  compareConfigurationNodes(c1, c2) {
    if (typeof c1.order !== "number") {
      return 1;
    }
    if (typeof c2.order !== "number") {
      return -1;
    }
    if (c1.order === c2.order) {
      const title1 = c1.title || "";
      const title2 = c2.title || "";
      return title1.localeCompare(title2);
    }
    return c1.order - c2.order;
  }
  toContent(settingsGroups, startIndex) {
    const builder = new SettingsContentBuilder();
    for (let i = startIndex; i < settingsGroups.length; i++) {
      builder.pushGroup(settingsGroups[i], i === startIndex, i === settingsGroups.length - 1);
    }
    return builder.getContent();
  }
}
class DefaultSettingsEditorModel extends AbstractSettingsModel {
  constructor(_uri, reference, defaultSettings) {
    super();
    this._uri = _uri;
    this.defaultSettings = defaultSettings;
    this._onDidChangeGroups = this._register(new Emitter());
    this.onDidChangeGroups = this._onDidChangeGroups.event;
    this._register(defaultSettings.onDidChange(() => this._onDidChangeGroups.fire()));
    this._model = reference.object.textEditorModel;
    this._register(this.onWillDispose(() => reference.dispose()));
  }
  get uri() {
    return this._uri;
  }
  get target() {
    return this.defaultSettings.target;
  }
  get settingsGroups() {
    return this.defaultSettings.getSettingsGroups();
  }
  get filterGroups() {
    return this.settingsGroups.slice(1);
  }
  update() {
    if (this._model.isDisposed()) {
      return void 0;
    }
    const resultGroups = [...this._currentResultGroups.values()].sort((a, b) => a.order - b.order);
    const nonEmptyResultGroups = resultGroups.filter((group) => group.result.filterMatches.length);
    const startLine = this.settingsGroups.at(-1).range.endLineNumber + 2;
    const { settingsGroups: filteredGroups, matches } = this.writeResultGroups(nonEmptyResultGroups, startLine);
    const metadata = this.collectMetadata(resultGroups);
    return resultGroups.length ? {
      allGroups: this.settingsGroups,
      filteredGroups,
      matches,
      metadata: metadata ?? void 0
    } : void 0;
  }
  /**
   * Translate the ISearchResultGroups to text, and write it to the editor model
   */
  writeResultGroups(groups, startLine) {
    const contentBuilderOffset = startLine - 1;
    const builder = new SettingsContentBuilder(contentBuilderOffset);
    const settingsGroups = [];
    const matches = [];
    if (groups.length) {
      builder.pushLine(",");
      groups.forEach((resultGroup) => {
        const settingsGroup = this.getGroup(resultGroup);
        settingsGroups.push(settingsGroup);
        matches.push(...this.writeSettingsGroupToBuilder(builder, settingsGroup, resultGroup.result.filterMatches));
      });
    }
    const groupContent = builder.getContent() + "\n";
    const groupEndLine = this._model.getLineCount();
    const cursorPosition = new Selection(startLine, 1, startLine, 1);
    const edit = {
      text: groupContent,
      forceMoveMarkers: true,
      range: new Range(startLine, 1, groupEndLine, 1)
    };
    this._model.pushEditOperations([cursorPosition], [edit], () => [cursorPosition]);
    const tokenizeTo = Math.min(startLine + 60, this._model.getLineCount());
    this._model.tokenization.forceTokenization(tokenizeTo);
    return { matches, settingsGroups };
  }
  writeSettingsGroupToBuilder(builder, settingsGroup, filterMatches) {
    filterMatches = filterMatches.map((filteredMatch) => {
      return {
        setting: filteredMatch.setting,
        score: filteredMatch.score,
        matchType: filteredMatch.matchType,
        keyMatchScore: filteredMatch.keyMatchScore,
        matches: filteredMatch.matches && filteredMatch.matches.map((match) => {
          return new Range(
            match.startLineNumber - filteredMatch.setting.range.startLineNumber,
            match.startColumn,
            match.endLineNumber - filteredMatch.setting.range.startLineNumber,
            match.endColumn
          );
        })
      };
    });
    builder.pushGroup(settingsGroup);
    const fixedMatches = filterMatches.map((m) => m.matches || []).flatMap((settingMatches, i) => {
      const setting = settingsGroup.sections[0].settings[i];
      return settingMatches.map((range) => {
        return new Range(
          range.startLineNumber + setting.range.startLineNumber,
          range.startColumn,
          range.endLineNumber + setting.range.startLineNumber,
          range.endColumn
        );
      });
    });
    return fixedMatches;
  }
  copySetting(setting) {
    return {
      description: setting.description,
      scope: setting.scope,
      type: setting.type,
      enum: setting.enum,
      enumDescriptions: setting.enumDescriptions,
      key: setting.key,
      value: setting.value,
      range: setting.range,
      overrides: [],
      overrideOf: setting.overrideOf,
      tags: setting.tags,
      deprecationMessage: setting.deprecationMessage,
      keyRange: nullRange,
      valueRange: nullRange,
      descriptionIsMarkdown: void 0,
      descriptionRanges: []
    };
  }
  getPreference(key) {
    for (const group of this.settingsGroups) {
      for (const section of group.sections) {
        for (const setting of section.settings) {
          if (setting.key === key) {
            return setting;
          }
        }
      }
    }
    return void 0;
  }
  getGroup(resultGroup) {
    return {
      id: resultGroup.id,
      range: nullRange,
      title: resultGroup.label,
      titleRange: nullRange,
      sections: [
        {
          settings: resultGroup.result.filterMatches.map((m) => this.copySetting(m.setting))
        }
      ]
    };
  }
}
class SettingsContentBuilder {
  constructor(_rangeOffset = 0) {
    this._rangeOffset = _rangeOffset;
    this._contentByLines = [];
  }
  get lineCountWithOffset() {
    return this._contentByLines.length + this._rangeOffset;
  }
  get lastLine() {
    return this._contentByLines[this._contentByLines.length - 1] || "";
  }
  pushLine(...lineText) {
    this._contentByLines.push(...lineText);
  }
  pushGroup(settingsGroups, isFirst, isLast) {
    this._contentByLines.push(isFirst ? "[{" : "{");
    const lastSetting = this._pushGroup(settingsGroups, "  ");
    if (lastSetting) {
      const lineIdx = lastSetting.range.endLineNumber - this._rangeOffset;
      const content = this._contentByLines[lineIdx - 2];
      this._contentByLines[lineIdx - 2] = content.substring(0, content.length - 1);
    }
    this._contentByLines.push(isLast ? "}]" : "},");
  }
  _pushGroup(group, indent) {
    let lastSetting = null;
    const groupStart = this.lineCountWithOffset + 1;
    for (const section of group.sections) {
      if (section.title) {
        const sectionTitleStart = this.lineCountWithOffset + 1;
        this.addDescription([section.title], indent, this._contentByLines);
        section.titleRange = { startLineNumber: sectionTitleStart, startColumn: 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length };
      }
      if (section.settings.length) {
        for (const setting of section.settings) {
          this.pushSetting(setting, indent);
          lastSetting = setting;
        }
      }
    }
    group.range = { startLineNumber: groupStart, startColumn: 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length };
    return lastSetting;
  }
  getContent() {
    return this._contentByLines.join("\n");
  }
  pushSetting(setting, indent) {
    const settingStart = this.lineCountWithOffset + 1;
    this.pushSettingDescription(setting, indent);
    let preValueContent = indent;
    const keyString = JSON.stringify(setting.key);
    preValueContent += keyString;
    setting.keyRange = { startLineNumber: this.lineCountWithOffset + 1, startColumn: preValueContent.indexOf(setting.key) + 1, endLineNumber: this.lineCountWithOffset + 1, endColumn: setting.key.length };
    preValueContent += ": ";
    const valueStart = this.lineCountWithOffset + 1;
    this.pushValue(setting, preValueContent, indent);
    setting.valueRange = { startLineNumber: valueStart, startColumn: preValueContent.length + 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length + 1 };
    this._contentByLines[this._contentByLines.length - 1] += ",";
    this._contentByLines.push("");
    setting.range = { startLineNumber: settingStart, startColumn: 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length };
  }
  pushSettingDescription(setting, indent) {
    const fixSettingLink = (line) => line.replace(/`#(.*)#`/g, (match, settingName) => `\`${settingName}\``);
    setting.descriptionRanges = [];
    const descriptionPreValue = indent + "// ";
    const deprecationMessageLines = setting.deprecationMessage?.split(/\n/g) ?? [];
    for (let line of [...deprecationMessageLines, ...setting.description]) {
      line = fixSettingLink(line);
      this._contentByLines.push(descriptionPreValue + line);
      setting.descriptionRanges.push({ startLineNumber: this.lineCountWithOffset, startColumn: this.lastLine.indexOf(line) + 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length });
    }
    if (setting.enum && setting.enumDescriptions?.some((desc) => !!desc)) {
      setting.enumDescriptions.forEach((desc, i) => {
        const displayEnum = escapeInvisibleChars(String(setting.enum[i]));
        const line = desc ? `${displayEnum}: ${fixSettingLink(desc)}` : displayEnum;
        const lines = line.split(/\n/g);
        lines[0] = " - " + lines[0];
        this._contentByLines.push(...lines.map((l) => `${indent}// ${l}`));
        setting.descriptionRanges.push({ startLineNumber: this.lineCountWithOffset, startColumn: this.lastLine.indexOf(line) + 1, endLineNumber: this.lineCountWithOffset, endColumn: this.lastLine.length });
      });
    }
  }
  pushValue(setting, preValueConent, indent) {
    const valueString = JSON.stringify(setting.value, null, indent);
    if (valueString && typeof setting.value === "object") {
      if (setting.overrides && setting.overrides.length) {
        this._contentByLines.push(preValueConent + " {");
        for (const subSetting of setting.overrides) {
          this.pushSetting(subSetting, indent + indent);
          this._contentByLines.pop();
        }
        const lastSetting = setting.overrides[setting.overrides.length - 1];
        const content = this._contentByLines[lastSetting.range.endLineNumber - 2];
        this._contentByLines[lastSetting.range.endLineNumber - 2] = content.substring(0, content.length - 1);
        this._contentByLines.push(indent + "}");
      } else {
        const mulitLineValue = valueString.split("\n");
        this._contentByLines.push(preValueConent + mulitLineValue[0]);
        for (let i = 1; i < mulitLineValue.length; i++) {
          this._contentByLines.push(indent + mulitLineValue[i]);
        }
      }
    } else {
      this._contentByLines.push(preValueConent + valueString);
    }
  }
  addDescription(description, indent, result) {
    for (const line of description) {
      result.push(indent + "// " + line);
    }
  }
}
class RawSettingsContentBuilder extends SettingsContentBuilder {
  constructor(indent = "	") {
    super(0);
    this.indent = indent;
  }
  pushGroup(settingsGroups) {
    this._pushGroup(settingsGroups, this.indent);
  }
}
class DefaultRawSettingsEditorModel extends Disposable {
  constructor(defaultSettings) {
    super();
    this.defaultSettings = defaultSettings;
    this._content = null;
    this._onDidContentChanged = this._register(new Emitter());
    this.onDidContentChanged = this._onDidContentChanged.event;
    this._register(defaultSettings.onDidChange(() => {
      this._content = null;
      this._onDidContentChanged.fire();
    }));
  }
  get content() {
    if (this._content === null) {
      const builder = new RawSettingsContentBuilder();
      builder.pushLine("{");
      for (const settingsGroup of this.defaultSettings.getRegisteredGroups()) {
        builder.pushGroup(settingsGroup);
      }
      builder.pushLine("}");
      this._content = builder.getContent();
    }
    return this._content;
  }
}
function escapeInvisibleChars(enumValue) {
  return enumValue && enumValue.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
function defaultKeybindingsContents(keybindingService) {
  const defaultsHeader = "// " + nls.localize("defaultKeybindingsHeader", "Override key bindings by placing them into your key bindings file.");
  return defaultsHeader + "\n" + keybindingService.getDefaultKeybindingsContent();
}
let DefaultKeybindingsEditorModel = class {
  constructor(_uri, keybindingService) {
    this._uri = _uri;
    this.keybindingService = keybindingService;
  }
  get uri() {
    return this._uri;
  }
  get content() {
    if (!this._content) {
      this._content = defaultKeybindingsContents(this.keybindingService);
    }
    return this._content;
  }
  getPreference() {
    return null;
  }
  dispose() {
  }
};
DefaultKeybindingsEditorModel = __decorateClass([
  __decorateParam(1, IKeybindingService)
], DefaultKeybindingsEditorModel);
export {
  DefaultKeybindingsEditorModel,
  DefaultRawSettingsEditorModel,
  DefaultSettings,
  DefaultSettingsEditorModel,
  Settings2EditorModel,
  SettingsEditorModel,
  WorkspaceConfigurationEditorModel,
  defaultKeybindingsContents,
  nullRange
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzTW9kZWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEpTT05WaXNpdG9yLCB2aXNpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uRGVmYXVsdFZhbHVlU291cmNlLCBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgSVJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIE9WRVJSSURFX1BST1BFUlRZX1JFR0VYIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IElGaWx0ZXJNZXRhZGF0YSwgSUZpbHRlclJlc3VsdCwgSUdyb3VwRmlsdGVyLCBJS2V5YmluZGluZ3NFZGl0b3JNb2RlbCwgSVNlYXJjaFJlc3VsdEdyb3VwLCBJU2V0dGluZywgSVNldHRpbmdNYXRjaCwgSVNldHRpbmdNYXRjaGVyLCBJU2V0dGluZ3NFZGl0b3JNb2RlbCwgSVNldHRpbmdzR3JvdXAsIFNldHRpbmdNYXRjaFR5cGUgfSBmcm9tICcuL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IEZPTERFUl9TQ09QRVMsIFdPUktTUEFDRV9TQ09QRVMgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZVZhbGlkYXRvciB9IGZyb20gJy4vcHJlZmVyZW5jZXNWYWxpZGF0aW9uLmpzJztcblxuZXhwb3J0IGNvbnN0IG51bGxSYW5nZTogSVJhbmdlID0geyBzdGFydExpbmVOdW1iZXI6IC0xLCBzdGFydENvbHVtbjogLTEsIGVuZExpbmVOdW1iZXI6IC0xLCBlbmRDb2x1bW46IC0xIH07XG5mdW5jdGlvbiBpc051bGxSYW5nZShyYW5nZTogSVJhbmdlKTogYm9vbGVhbiB7IHJldHVybiByYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IC0xICYmIHJhbmdlLnN0YXJ0Q29sdW1uID09PSAtMSAmJiByYW5nZS5lbmRMaW5lTnVtYmVyID09PSAtMSAmJiByYW5nZS5lbmRDb2x1bW4gPT09IC0xOyB9XG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0U2V0dGluZ3NNb2RlbCBleHRlbmRzIEVkaXRvck1vZGVsIHtcblxuXHRwcm90ZWN0ZWQgX2N1cnJlbnRSZXN1bHRHcm91cHMgPSBuZXcgTWFwPHN0cmluZywgSVNlYXJjaFJlc3VsdEdyb3VwPigpO1xuXG5cdHVwZGF0ZVJlc3VsdEdyb3VwKGlkOiBzdHJpbmcsIHJlc3VsdEdyb3VwOiBJU2VhcmNoUmVzdWx0R3JvdXAgfCB1bmRlZmluZWQpOiBJRmlsdGVyUmVzdWx0IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAocmVzdWx0R3JvdXApIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMuc2V0KGlkLCByZXN1bHRHcm91cCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMuZGVsZXRlKGlkKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbW92ZUR1cGxpY2F0ZVJlc3VsdHMoKTtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgZHVwbGljYXRlcyBiZXR3ZWVuIHJlc3VsdCBncm91cHMsIHByZWZlcnJpbmcgcmVzdWx0cyBpbiBlYXJsaWVyIGdyb3Vwc1xuXHQgKi9cblx0cHJpdmF0ZSByZW1vdmVEdXBsaWNhdGVSZXN1bHRzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNldHRpbmdLZXlzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Wy4uLnRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMua2V5cygpXVxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IHRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMuZ2V0KGEpIS5vcmRlciAtIHRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMuZ2V0KGIpIS5vcmRlcilcblx0XHRcdC5mb3JFYWNoKGdyb3VwSWQgPT4ge1xuXHRcdFx0XHRjb25zdCBncm91cCA9IHRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMuZ2V0KGdyb3VwSWQpITtcblx0XHRcdFx0Z3JvdXAucmVzdWx0LmZpbHRlck1hdGNoZXMgPSBncm91cC5yZXN1bHQuZmlsdGVyTWF0Y2hlcy5maWx0ZXIocyA9PiAhc2V0dGluZ0tleXMuaGFzKHMuc2V0dGluZy5rZXkpKTtcblx0XHRcdFx0Z3JvdXAucmVzdWx0LmZpbHRlck1hdGNoZXMuZm9yRWFjaChzID0+IHNldHRpbmdLZXlzLmFkZChzLnNldHRpbmcua2V5KSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdGZpbHRlclNldHRpbmdzKGZpbHRlcjogc3RyaW5nLCBncm91cEZpbHRlcjogSUdyb3VwRmlsdGVyLCBzZXR0aW5nTWF0Y2hlcjogSVNldHRpbmdNYXRjaGVyKTogSVNldHRpbmdNYXRjaFtdIHtcblx0XHRjb25zdCBhbGxHcm91cHMgPSB0aGlzLmZpbHRlckdyb3VwcztcblxuXHRcdGNvbnN0IGZpbHRlck1hdGNoZXM6IElTZXR0aW5nTWF0Y2hbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgYWxsR3JvdXBzKSB7XG5cdFx0XHRjb25zdCBncm91cE1hdGNoZWQgPSBncm91cEZpbHRlcihncm91cCk7XG5cdFx0XHRmb3IgKGNvbnN0IHNlY3Rpb24gb2YgZ3JvdXAuc2VjdGlvbnMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHNlY3Rpb24uc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRjb25zdCBzZXR0aW5nTWF0Y2hSZXN1bHQgPSBzZXR0aW5nTWF0Y2hlcihzZXR0aW5nLCBncm91cCk7XG5cblx0XHRcdFx0XHRpZiAoZ3JvdXBNYXRjaGVkIHx8IHNldHRpbmdNYXRjaFJlc3VsdCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyTWF0Y2hlcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0c2V0dGluZyxcblx0XHRcdFx0XHRcdFx0bWF0Y2hlczogc2V0dGluZ01hdGNoUmVzdWx0ICYmIHNldHRpbmdNYXRjaFJlc3VsdC5tYXRjaGVzLFxuXHRcdFx0XHRcdFx0XHRtYXRjaFR5cGU6IHNldHRpbmdNYXRjaFJlc3VsdD8ubWF0Y2hUeXBlID8/IFNldHRpbmdNYXRjaFR5cGUuTm9uZSxcblx0XHRcdFx0XHRcdFx0a2V5TWF0Y2hTY29yZTogc2V0dGluZ01hdGNoUmVzdWx0Py5rZXlNYXRjaFNjb3JlID8/IDAsXG5cdFx0XHRcdFx0XHRcdHNjb3JlOiBzZXR0aW5nTWF0Y2hSZXN1bHQ/LnNjb3JlID8/IDBcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmaWx0ZXJNYXRjaGVzO1xuXHR9XG5cblx0Z2V0UHJlZmVyZW5jZShrZXk6IHN0cmluZyk6IElTZXR0aW5nIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuc2V0dGluZ3NHcm91cHMpIHtcblx0XHRcdGZvciAoY29uc3Qgc2VjdGlvbiBvZiBncm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2VjdGlvbi5zZXR0aW5ncykge1xuXHRcdFx0XHRcdGlmIChrZXkgPT09IHNldHRpbmcua2V5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2V0dGluZztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNvbGxlY3RNZXRhZGF0YShncm91cHM6IElTZWFyY2hSZXN1bHRHcm91cFtdKTogSVN0cmluZ0RpY3Rpb25hcnk8SUZpbHRlck1ldGFkYXRhPiB8IG51bGwge1xuXHRcdGNvbnN0IG1ldGFkYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRsZXQgaGFzTWV0YWRhdGEgPSBmYWxzZTtcblx0XHRncm91cHMuZm9yRWFjaChnID0+IHtcblx0XHRcdGlmIChnLnJlc3VsdC5tZXRhZGF0YSkge1xuXHRcdFx0XHRtZXRhZGF0YVtnLmlkXSA9IGcucmVzdWx0Lm1ldGFkYXRhO1xuXHRcdFx0XHRoYXNNZXRhZGF0YSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gaGFzTWV0YWRhdGEgPyBtZXRhZGF0YSA6IG51bGw7XG5cdH1cblxuXG5cdHByb3RlY3RlZCBnZXQgZmlsdGVyR3JvdXBzKCk6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRcdHJldHVybiB0aGlzLnNldHRpbmdzR3JvdXBzO1xuXHR9XG5cblx0YWJzdHJhY3Qgc2V0dGluZ3NHcm91cHM6IElTZXR0aW5nc0dyb3VwW107XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IHVwZGF0ZSgpOiBJRmlsdGVyUmVzdWx0IHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NFZGl0b3JNb2RlbCBleHRlbmRzIEFic3RyYWN0U2V0dGluZ3NNb2RlbCBpbXBsZW1lbnRzIElTZXR0aW5nc0VkaXRvck1vZGVsIHtcblxuXHRwcml2YXRlIF9zZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXBbXSB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHNldHRpbmdzTW9kZWw6IElUZXh0TW9kZWw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VHcm91cHM6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VHcm91cHM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VHcm91cHMuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocmVmZXJlbmNlOiBJUmVmZXJlbmNlPElUZXh0RWRpdG9yTW9kZWw+LCBwcml2YXRlIF9jb25maWd1cmF0aW9uVGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnNldHRpbmdzTW9kZWwgPSByZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbCE7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbldpbGxEaXNwb3NlKCgpID0+IHJlZmVyZW5jZS5kaXNwb3NlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdzTW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdHRoaXMuX3NldHRpbmdzR3JvdXBzID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VHcm91cHMuZmlyZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGdldCB1cmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5nc01vZGVsLnVyaTtcblx0fVxuXG5cdGdldCBjb25maWd1cmF0aW9uVGFyZ2V0KCk6IENvbmZpZ3VyYXRpb25UYXJnZXQge1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uVGFyZ2V0O1xuXHR9XG5cblx0Z2V0IHNldHRpbmdzR3JvdXBzKCk6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRcdGlmICghdGhpcy5fc2V0dGluZ3NHcm91cHMpIHtcblx0XHRcdHRoaXMucGFyc2UoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3NldHRpbmdzR3JvdXBzITtcblx0fVxuXG5cdGdldCBjb250ZW50KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3NNb2RlbC5nZXRWYWx1ZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGlzU2V0dGluZ3NQcm9wZXJ0eShwcm9wZXJ0eTogc3RyaW5nLCBwcmV2aW91c1BhcmVudHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHByZXZpb3VzUGFyZW50cy5sZW5ndGggPT09IDA7IC8vIFNldHRpbmdzIGlzIHJvb3Rcblx0fVxuXG5cdHByb3RlY3RlZCBwYXJzZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXR0aW5nc0dyb3VwcyA9IHBhcnNlKHRoaXMuc2V0dGluZ3NNb2RlbCwgKHByb3BlcnR5OiBzdHJpbmcsIHByZXZpb3VzUGFyZW50czogc3RyaW5nW10pOiBib29sZWFuID0+IHRoaXMuaXNTZXR0aW5nc1Byb3BlcnR5KHByb3BlcnR5LCBwcmV2aW91c1BhcmVudHMpKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGUoKTogSUZpbHRlclJlc3VsdCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0R3JvdXBzID0gWy4uLnRoaXMuX2N1cnJlbnRSZXN1bHRHcm91cHMudmFsdWVzKCldO1xuXHRcdGlmICghcmVzdWx0R3JvdXBzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBUcmFuc2Zvcm0gcmVzdWx0R3JvdXBzIGludG8gSUZpbHRlclJlc3VsdCAtIElTZXR0aW5nIHJhbmdlcyBhcmUgYWxyZWFkeSBjb3JyZWN0IGhlcmVcblx0XHRjb25zdCBmaWx0ZXJlZFNldHRpbmdzOiBJU2V0dGluZ1tdID0gW107XG5cdFx0Y29uc3QgbWF0Y2hlczogSVJhbmdlW10gPSBbXTtcblx0XHRyZXN1bHRHcm91cHMuZm9yRWFjaChncm91cCA9PiB7XG5cdFx0XHRncm91cC5yZXN1bHQuZmlsdGVyTWF0Y2hlcy5mb3JFYWNoKGZpbHRlck1hdGNoID0+IHtcblx0XHRcdFx0ZmlsdGVyZWRTZXR0aW5ncy5wdXNoKGZpbHRlck1hdGNoLnNldHRpbmcpO1xuXHRcdFx0XHRpZiAoZmlsdGVyTWF0Y2gubWF0Y2hlcykge1xuXHRcdFx0XHRcdG1hdGNoZXMucHVzaCguLi5maWx0ZXJNYXRjaC5tYXRjaGVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRsZXQgZmlsdGVyZWRHcm91cDogSVNldHRpbmdzR3JvdXAgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbW9kZWxHcm91cCA9IHRoaXMuc2V0dGluZ3NHcm91cHNbMF07IC8vIEVkaXRhYmxlIG1vZGVsIGhhcyBvbmUgb3IgemVybyBncm91cHNcblx0XHRpZiAobW9kZWxHcm91cCkge1xuXHRcdFx0ZmlsdGVyZWRHcm91cCA9IHtcblx0XHRcdFx0aWQ6IG1vZGVsR3JvdXAuaWQsXG5cdFx0XHRcdHJhbmdlOiBtb2RlbEdyb3VwLnJhbmdlLFxuXHRcdFx0XHRzZWN0aW9uczogW3tcblx0XHRcdFx0XHRzZXR0aW5nczogZmlsdGVyZWRTZXR0aW5nc1xuXHRcdFx0XHR9XSxcblx0XHRcdFx0dGl0bGU6IG1vZGVsR3JvdXAudGl0bGUsXG5cdFx0XHRcdHRpdGxlUmFuZ2U6IG1vZGVsR3JvdXAudGl0bGVSYW5nZSxcblx0XHRcdFx0b3JkZXI6IG1vZGVsR3JvdXAub3JkZXIsXG5cdFx0XHRcdGV4dGVuc2lvbkluZm86IG1vZGVsR3JvdXAuZXh0ZW5zaW9uSW5mb1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXRhZGF0YSA9IHRoaXMuY29sbGVjdE1ldGFkYXRhKHJlc3VsdEdyb3Vwcyk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGFsbEdyb3VwczogdGhpcy5zZXR0aW5nc0dyb3Vwcyxcblx0XHRcdGZpbHRlcmVkR3JvdXBzOiBmaWx0ZXJlZEdyb3VwID8gW2ZpbHRlcmVkR3JvdXBdIDogW10sXG5cdFx0XHRtYXRjaGVzLFxuXHRcdFx0bWV0YWRhdGE6IG1ldGFkYXRhID8/IHVuZGVmaW5lZFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzMkVkaXRvck1vZGVsIGV4dGVuZHMgQWJzdHJhY3RTZXR0aW5nc01vZGVsIGltcGxlbWVudHMgSVNldHRpbmdzRWRpdG9yTW9kZWwge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUdyb3VwczogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUdyb3VwczogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUdyb3Vwcy5ldmVudDtcblxuXHRwcml2YXRlIGFkZGl0aW9uYWxHcm91cHM6IElTZXR0aW5nc0dyb3VwW10gPSBbXTtcblx0cHJpdmF0ZSBkaXJ0eSA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2RlZmF1bHRTZXR0aW5nczogRGVmYXVsdFNldHRpbmdzLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnNvdXJjZSA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUKSB7XG5cdFx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUdyb3Vwcy5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikub25EaWRTY2hlbWFDaGFuZ2UoZSA9PiB7XG5cdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBzLmZpcmUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKiogRG9lc24ndCBpbmNsdWRlIHRoZSBcIkNvbW1vbmx5IFVzZWRcIiBncm91cCAqL1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0IGZpbHRlckdyb3VwcygpOiBJU2V0dGluZ3NHcm91cFtdIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5nc0dyb3Vwcy5zbGljZSgxKTtcblx0fVxuXG5cdGdldCBzZXR0aW5nc0dyb3VwcygpOiBJU2V0dGluZ3NHcm91cFtdIHtcblx0XHRjb25zdCBncm91cHMgPSB0aGlzLl9kZWZhdWx0U2V0dGluZ3MuZ2V0U2V0dGluZ3NHcm91cHModGhpcy5kaXJ0eSk7XG5cdFx0dGhpcy5kaXJ0eSA9IGZhbHNlO1xuXHRcdHJldHVybiBbLi4uZ3JvdXBzLCAuLi50aGlzLmFkZGl0aW9uYWxHcm91cHNdO1xuXHR9XG5cblx0LyoqIEZvciBwcm9ncmFtbWF0aWNhbGx5IGFkZGVkIGdyb3VwcyBvdXRzaWRlIG9mIHJlZ2lzdGVyZWQgY29uZmlndXJhdGlvbnMgKi9cblx0c2V0QWRkaXRpb25hbEdyb3Vwcyhncm91cHM6IElTZXR0aW5nc0dyb3VwW10pIHtcblx0XHR0aGlzLmFkZGl0aW9uYWxHcm91cHMgPSBncm91cHM7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlKCk6IElGaWx0ZXJSZXN1bHQge1xuXHRcdHRocm93IG5ldyBFcnJvcignTm90IHN1cHBvcnRlZCcpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHBhcnNlKG1vZGVsOiBJVGV4dE1vZGVsLCBpc1NldHRpbmdzUHJvcGVydHk6IChjdXJyZW50UHJvcGVydHk6IHN0cmluZywgcHJldmlvdXNQYXJlbnRzOiBzdHJpbmdbXSkgPT4gYm9vbGVhbik6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRjb25zdCBzZXR0aW5nczogSVNldHRpbmdbXSA9IFtdO1xuXHRsZXQgb3ZlcnJpZGVTZXR0aW5nOiBJU2V0dGluZyB8IG51bGwgPSBudWxsO1xuXG5cdGxldCBjdXJyZW50UHJvcGVydHk6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRsZXQgY3VycmVudFBhcmVudDogYW55ID0gW107XG5cdGNvbnN0IHByZXZpb3VzUGFyZW50czogYW55W10gPSBbXTtcblx0bGV0IHNldHRpbmdzUHJvcGVydHlJbmRleDogbnVtYmVyID0gLTE7XG5cdGNvbnN0IHJhbmdlID0ge1xuXHRcdHN0YXJ0TGluZU51bWJlcjogMCxcblx0XHRzdGFydENvbHVtbjogMCxcblx0XHRlbmRMaW5lTnVtYmVyOiAwLFxuXHRcdGVuZENvbHVtbjogMFxuXHR9O1xuXG5cdGZ1bmN0aW9uIG9uVmFsdWUodmFsdWU6IGFueSwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSB7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY3VycmVudFBhcmVudCkpIHtcblx0XHRcdCg8YW55W10+Y3VycmVudFBhcmVudCkucHVzaCh2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmIChjdXJyZW50UHJvcGVydHkpIHtcblx0XHRcdGN1cnJlbnRQYXJlbnRbY3VycmVudFByb3BlcnR5XSA9IHZhbHVlO1xuXHRcdH1cblx0XHRpZiAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSB8fCAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMiAmJiBvdmVycmlkZVNldHRpbmcgIT09IG51bGwpKSB7XG5cdFx0XHQvLyBzZXR0aW5ncyB2YWx1ZSBzdGFydGVkXG5cdFx0XHRjb25zdCBzZXR0aW5nID0gcHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSA/IHNldHRpbmdzW3NldHRpbmdzLmxlbmd0aCAtIDFdIDogb3ZlcnJpZGVTZXR0aW5nIS5vdmVycmlkZXMhW292ZXJyaWRlU2V0dGluZyEub3ZlcnJpZGVzIS5sZW5ndGggLSAxXTtcblx0XHRcdGlmIChzZXR0aW5nKSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlU3RhcnRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0KTtcblx0XHRcdFx0Y29uc3QgdmFsdWVFbmRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0ICsgbGVuZ3RoKTtcblx0XHRcdFx0c2V0dGluZy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRzZXR0aW5nLnZhbHVlUmFuZ2UgPSB7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiB2YWx1ZVN0YXJ0UG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0XHRzdGFydENvbHVtbjogdmFsdWVTdGFydFBvc2l0aW9uLmNvbHVtbixcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB2YWx1ZUVuZFBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiB2YWx1ZUVuZFBvc2l0aW9uLmNvbHVtblxuXHRcdFx0XHR9O1xuXHRcdFx0XHRzZXR0aW5nLnJhbmdlID0gT2JqZWN0LmFzc2lnbihzZXR0aW5nLnJhbmdlLCB7XG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdmFsdWVFbmRQb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdGVuZENvbHVtbjogdmFsdWVFbmRQb3NpdGlvbi5jb2x1bW5cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGNvbnN0IHZpc2l0b3I6IEpTT05WaXNpdG9yID0ge1xuXHRcdG9uT2JqZWN0QmVnaW46IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGlmIChpc1NldHRpbmdzUHJvcGVydHkoY3VycmVudFByb3BlcnR5ISwgcHJldmlvdXNQYXJlbnRzKSkge1xuXHRcdFx0XHQvLyBTZXR0aW5ncyBzdGFydGVkXG5cdFx0XHRcdHNldHRpbmdzUHJvcGVydHlJbmRleCA9IHByZXZpb3VzUGFyZW50cy5sZW5ndGg7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gbW9kZWwuZ2V0UG9zaXRpb25BdChvZmZzZXQpO1xuXHRcdFx0XHRyYW5nZS5zdGFydExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRyYW5nZS5zdGFydENvbHVtbiA9IHBvc2l0aW9uLmNvbHVtbjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG9iamVjdCA9IHt9O1xuXHRcdFx0b25WYWx1ZShvYmplY3QsIG9mZnNldCwgbGVuZ3RoKTtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvYmplY3Q7XG5cdFx0XHRjdXJyZW50UHJvcGVydHkgPSBudWxsO1xuXHRcdFx0cHJldmlvdXNQYXJlbnRzLnB1c2goY3VycmVudFBhcmVudCk7XG5cdFx0fSxcblx0XHRvbk9iamVjdFByb3BlcnR5OiAobmFtZTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQcm9wZXJ0eSA9IG5hbWU7XG5cdFx0XHRpZiAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSB8fCAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMiAmJiBvdmVycmlkZVNldHRpbmcgIT09IG51bGwpKSB7XG5cdFx0XHRcdC8vIHNldHRpbmcgc3RhcnRlZFxuXHRcdFx0XHRjb25zdCBzZXR0aW5nU3RhcnRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0KTtcblx0XHRcdFx0Y29uc3Qgc2V0dGluZzogSVNldHRpbmcgPSB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IFtdLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uSXNNYXJrZG93bjogZmFsc2UsXG5cdFx0XHRcdFx0a2V5OiBuYW1lLFxuXHRcdFx0XHRcdGtleVJhbmdlOiB7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHNldHRpbmdTdGFydFBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogc2V0dGluZ1N0YXJ0UG9zaXRpb24uY29sdW1uICsgMSxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHNldHRpbmdTdGFydFBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHNldHRpbmdTdGFydFBvc2l0aW9uLmNvbHVtbiArIGxlbmd0aFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogc2V0dGluZ1N0YXJ0UG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiBzZXR0aW5nU3RhcnRQb3NpdGlvbi5jb2x1bW4sXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAwLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAwXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR2YWx1ZTogbnVsbCxcblx0XHRcdFx0XHR2YWx1ZVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25SYW5nZXM6IFtdLFxuXHRcdFx0XHRcdG92ZXJyaWRlczogW10sXG5cdFx0XHRcdFx0b3ZlcnJpZGVPZjogb3ZlcnJpZGVTZXR0aW5nID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKHByZXZpb3VzUGFyZW50cy5sZW5ndGggPT09IHNldHRpbmdzUHJvcGVydHlJbmRleCArIDEpIHtcblx0XHRcdFx0XHRzZXR0aW5ncy5wdXNoKHNldHRpbmcpO1xuXHRcdFx0XHRcdGlmIChPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KG5hbWUpKSB7XG5cdFx0XHRcdFx0XHRvdmVycmlkZVNldHRpbmcgPSBzZXR0aW5nO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvdmVycmlkZVNldHRpbmchLm92ZXJyaWRlcyEucHVzaChzZXR0aW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0b25PYmplY3RFbmQ6IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBwcmV2aW91c1BhcmVudHMucG9wKCk7XG5cdFx0XHRpZiAoc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICE9PSAtMSAmJiAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSB8fCAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMiAmJiBvdmVycmlkZVNldHRpbmcgIT09IG51bGwpKSkge1xuXHRcdFx0XHQvLyBzZXR0aW5nIGVuZGVkXG5cdFx0XHRcdGNvbnN0IHNldHRpbmcgPSBwcmV2aW91c1BhcmVudHMubGVuZ3RoID09PSBzZXR0aW5nc1Byb3BlcnR5SW5kZXggKyAxID8gc2V0dGluZ3Nbc2V0dGluZ3MubGVuZ3RoIC0gMV0gOiBvdmVycmlkZVNldHRpbmchLm92ZXJyaWRlcyFbb3ZlcnJpZGVTZXR0aW5nIS5vdmVycmlkZXMhLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRpZiAoc2V0dGluZykge1xuXHRcdFx0XHRcdGNvbnN0IHZhbHVlRW5kUG9zaXRpb24gPSBtb2RlbC5nZXRQb3NpdGlvbkF0KG9mZnNldCArIGxlbmd0aCk7XG5cdFx0XHRcdFx0c2V0dGluZy52YWx1ZVJhbmdlID0gT2JqZWN0LmFzc2lnbihzZXR0aW5nLnZhbHVlUmFuZ2UsIHtcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHZhbHVlRW5kUG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdmFsdWVFbmRQb3NpdGlvbi5jb2x1bW5cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRzZXR0aW5nLnJhbmdlID0gT2JqZWN0LmFzc2lnbihzZXR0aW5nLnJhbmdlLCB7XG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiB2YWx1ZUVuZFBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHZhbHVlRW5kUG9zaXRpb24uY29sdW1uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSkge1xuXHRcdFx0XHRcdG92ZXJyaWRlU2V0dGluZyA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChwcmV2aW91c1BhcmVudHMubGVuZ3RoID09PSBzZXR0aW5nc1Byb3BlcnR5SW5kZXgpIHtcblx0XHRcdFx0Ly8gc2V0dGluZ3MgZW5kZWRcblx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBtb2RlbC5nZXRQb3NpdGlvbkF0KG9mZnNldCk7XG5cdFx0XHRcdHJhbmdlLmVuZExpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRyYW5nZS5lbmRDb2x1bW4gPSBwb3NpdGlvbi5jb2x1bW47XG5cdFx0XHRcdHNldHRpbmdzUHJvcGVydHlJbmRleCA9IC0xO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0b25BcnJheUJlZ2luOiAob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSA9PiB7XG5cdFx0XHRjb25zdCBhcnJheTogYW55W10gPSBbXTtcblx0XHRcdG9uVmFsdWUoYXJyYXksIG9mZnNldCwgbGVuZ3RoKTtcblx0XHRcdHByZXZpb3VzUGFyZW50cy5wdXNoKGN1cnJlbnRQYXJlbnQpO1xuXHRcdFx0Y3VycmVudFBhcmVudCA9IGFycmF5O1xuXHRcdFx0Y3VycmVudFByb3BlcnR5ID0gbnVsbDtcblx0XHR9LFxuXHRcdG9uQXJyYXlFbmQ6IChvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpID0+IHtcblx0XHRcdGN1cnJlbnRQYXJlbnQgPSBwcmV2aW91c1BhcmVudHMucG9wKCk7XG5cdFx0XHRpZiAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMSB8fCAocHJldmlvdXNQYXJlbnRzLmxlbmd0aCA9PT0gc2V0dGluZ3NQcm9wZXJ0eUluZGV4ICsgMiAmJiBvdmVycmlkZVNldHRpbmcgIT09IG51bGwpKSB7XG5cdFx0XHRcdC8vIHNldHRpbmcgdmFsdWUgZW5kZWRcblx0XHRcdFx0Y29uc3Qgc2V0dGluZyA9IHByZXZpb3VzUGFyZW50cy5sZW5ndGggPT09IHNldHRpbmdzUHJvcGVydHlJbmRleCArIDEgPyBzZXR0aW5nc1tzZXR0aW5ncy5sZW5ndGggLSAxXSA6IG92ZXJyaWRlU2V0dGluZyEub3ZlcnJpZGVzIVtvdmVycmlkZVNldHRpbmchLm92ZXJyaWRlcyEubGVuZ3RoIC0gMV07XG5cdFx0XHRcdGlmIChzZXR0aW5nKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFsdWVFbmRQb3NpdGlvbiA9IG1vZGVsLmdldFBvc2l0aW9uQXQob2Zmc2V0ICsgbGVuZ3RoKTtcblx0XHRcdFx0XHRzZXR0aW5nLnZhbHVlUmFuZ2UgPSBPYmplY3QuYXNzaWduKHNldHRpbmcudmFsdWVSYW5nZSwge1xuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdmFsdWVFbmRQb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiB2YWx1ZUVuZFBvc2l0aW9uLmNvbHVtblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHNldHRpbmcucmFuZ2UgPSBPYmplY3QuYXNzaWduKHNldHRpbmcucmFuZ2UsIHtcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHZhbHVlRW5kUG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogdmFsdWVFbmRQb3NpdGlvbi5jb2x1bW5cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0b25MaXRlcmFsVmFsdWU6IG9uVmFsdWUsXG5cdFx0b25FcnJvcjogKGVycm9yKSA9PiB7XG5cdFx0XHRjb25zdCBzZXR0aW5nID0gc2V0dGluZ3Nbc2V0dGluZ3MubGVuZ3RoIC0gMV07XG5cdFx0XHRpZiAoc2V0dGluZyAmJiAoaXNOdWxsUmFuZ2Uoc2V0dGluZy5yYW5nZSkgfHwgaXNOdWxsUmFuZ2Uoc2V0dGluZy5rZXlSYW5nZSkgfHwgaXNOdWxsUmFuZ2Uoc2V0dGluZy52YWx1ZVJhbmdlKSkpIHtcblx0XHRcdFx0c2V0dGluZ3MucG9wKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXHRpZiAoIW1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdHZpc2l0KG1vZGVsLmdldFZhbHVlKCksIHZpc2l0b3IpO1xuXHR9XG5cdHJldHVybiBzZXR0aW5ncy5sZW5ndGggPiAwID8gW3tcblx0XHRpZDogbW9kZWwuaXNEaXNwb3NlZCgpID8gJycgOiBtb2RlbC5pZCxcblx0XHRzZWN0aW9uczogW1xuXHRcdFx0e1xuXHRcdFx0XHRzZXR0aW5nc1xuXHRcdFx0fVxuXHRcdF0sXG5cdFx0dGl0bGU6ICcnLFxuXHRcdHRpdGxlUmFuZ2U6IG51bGxSYW5nZSxcblx0XHRyYW5nZVxuXHR9IHNhdGlzZmllcyBJU2V0dGluZ3NHcm91cF0gOiBbXTtcbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25FZGl0b3JNb2RlbCBleHRlbmRzIFNldHRpbmdzRWRpdG9yTW9kZWwge1xuXG5cdHByaXZhdGUgX2NvbmZpZ3VyYXRpb25Hcm91cHM6IElTZXR0aW5nc0dyb3VwW10gPSBbXTtcblxuXHRnZXQgY29uZmlndXJhdGlvbkdyb3VwcygpOiBJU2V0dGluZ3NHcm91cFtdIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbkdyb3Vwcztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBwYXJzZSgpOiB2b2lkIHtcblx0XHRzdXBlci5wYXJzZSgpO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25Hcm91cHMgPSBwYXJzZSh0aGlzLnNldHRpbmdzTW9kZWwsIChwcm9wZXJ0eTogc3RyaW5nLCBwcmV2aW91c1BhcmVudHM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PiBwcmV2aW91c1BhcmVudHMubGVuZ3RoID09PSAwKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBpc1NldHRpbmdzUHJvcGVydHkocHJvcGVydHk6IHN0cmluZywgcHJldmlvdXNQYXJlbnRzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBwcm9wZXJ0eSA9PT0gJ3NldHRpbmdzJyAmJiBwcmV2aW91c1BhcmVudHMubGVuZ3RoID09PSAxO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRTZXR0aW5ncyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2FsbFNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NvbnRlbnRXaXRob3V0TW9zdENvbW1vbmx5VXNlZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zZXR0aW5nc0J5TmFtZSA9IG5ldyBNYXA8c3RyaW5nLCBJU2V0dGluZz4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZTogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9tb3N0Q29tbW9ubHlVc2VkU2V0dGluZ3NLZXlzOiBzdHJpbmdbXSxcblx0XHRyZWFkb25seSB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQsXG5cdFx0cmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnNvdXJjZSA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUKSB7XG5cdFx0XHRcdHRoaXMucmVzZXQoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGdldENvbnRlbnQoZm9yY2VVcGRhdGUgPSBmYWxzZSk6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9jb250ZW50IHx8IGZvcmNlVXBkYXRlKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fY29udGVudCE7XG5cdH1cblxuXHRnZXRDb250ZW50V2l0aG91dE1vc3RDb21tb25seVVzZWQoZm9yY2VVcGRhdGUgPSBmYWxzZSk6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9jb250ZW50V2l0aG91dE1vc3RDb21tb25seVVzZWQgfHwgZm9yY2VVcGRhdGUpIHtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9jb250ZW50V2l0aG91dE1vc3RDb21tb25seVVzZWQhO1xuXHR9XG5cblx0Z2V0U2V0dGluZ3NHcm91cHMoZm9yY2VVcGRhdGUgPSBmYWxzZSk6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRcdGlmICghdGhpcy5fYWxsU2V0dGluZ3NHcm91cHMgfHwgZm9yY2VVcGRhdGUpIHtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hbGxTZXR0aW5nc0dyb3VwcyE7XG5cdH1cblxuXHRwcml2YXRlIGluaXRpYWxpemUoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWxsU2V0dGluZ3NHcm91cHMgPSB0aGlzLnBhcnNlKCk7XG5cdFx0dGhpcy5fY29udGVudCA9IHRoaXMudG9Db250ZW50KHRoaXMuX2FsbFNldHRpbmdzR3JvdXBzLCAwKTtcblx0XHR0aGlzLl9jb250ZW50V2l0aG91dE1vc3RDb21tb25seVVzZWQgPSB0aGlzLnRvQ29udGVudCh0aGlzLl9hbGxTZXR0aW5nc0dyb3VwcywgMSk7XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0KCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fY29udGVudFdpdGhvdXRNb3N0Q29tbW9ubHlVc2VkID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2FsbFNldHRpbmdzR3JvdXBzID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZSgpOiBJU2V0dGluZ3NHcm91cFtdIHtcblx0XHRjb25zdCBzZXR0aW5nc0dyb3VwcyA9IHRoaXMuZ2V0UmVnaXN0ZXJlZEdyb3VwcygpO1xuXHRcdHRoaXMuaW5pdEFsbFNldHRpbmdzTWFwKHNldHRpbmdzR3JvdXBzKTtcblx0XHRjb25zdCBtb3N0Q29tbW9ubHlVc2VkID0gdGhpcy5nZXRNb3N0Q29tbW9ubHlVc2VkU2V0dGluZ3MoKTtcblx0XHRyZXR1cm4gW21vc3RDb21tb25seVVzZWQsIC4uLnNldHRpbmdzR3JvdXBzXTtcblx0fVxuXG5cdGdldFJlZ2lzdGVyZWRHcm91cHMoKTogSVNldHRpbmdzR3JvdXBbXSB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbnMgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLmdldENvbmZpZ3VyYXRpb25zKCkuc2xpY2UoKTtcblx0XHRjb25zdCBncm91cHMgPSB0aGlzLnJlbW92ZUVtcHR5U2V0dGluZ3NHcm91cHMoY29uZmlndXJhdGlvbnMuc29ydCh0aGlzLmNvbXBhcmVDb25maWd1cmF0aW9uTm9kZXMpXG5cdFx0XHQucmVkdWNlPElTZXR0aW5nc0dyb3VwW10+KChyZXN1bHQsIGNvbmZpZywgaW5kZXgsIGFycmF5KSA9PiB0aGlzLnBhcnNlQ29uZmlnKGNvbmZpZywgcmVzdWx0LCBhcnJheSksIFtdKSk7XG5cblx0XHRyZXR1cm4gdGhpcy5zb3J0R3JvdXBzKGdyb3Vwcyk7XG5cdH1cblxuXHRwcml2YXRlIHNvcnRHcm91cHMoZ3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdKTogSVNldHRpbmdzR3JvdXBbXSB7XG5cdFx0Z3JvdXBzLmZvckVhY2goZ3JvdXAgPT4ge1xuXHRcdFx0Z3JvdXAuc2VjdGlvbnMuZm9yRWFjaChzZWN0aW9uID0+IHtcblx0XHRcdFx0c2VjdGlvbi5zZXR0aW5ncy5zb3J0KChhLCBiKSA9PiBhLmtleS5sb2NhbGVDb21wYXJlKGIua2V5KSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBncm91cHM7XG5cdH1cblxuXHRwcml2YXRlIGluaXRBbGxTZXR0aW5nc01hcChhbGxTZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXBbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3NldHRpbmdzQnlOYW1lID0gbmV3IE1hcDxzdHJpbmcsIElTZXR0aW5nPigpO1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgYWxsU2V0dGluZ3NHcm91cHMpIHtcblx0XHRcdGZvciAoY29uc3Qgc2VjdGlvbiBvZiBncm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2VjdGlvbi5zZXR0aW5ncykge1xuXHRcdFx0XHRcdHRoaXMuX3NldHRpbmdzQnlOYW1lLnNldChzZXR0aW5nLmtleSwgc2V0dGluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE1vc3RDb21tb25seVVzZWRTZXR0aW5ncygpOiBJU2V0dGluZ3NHcm91cCB7XG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBjb2FsZXNjZSh0aGlzLl9tb3N0Q29tbW9ubHlVc2VkU2V0dGluZ3NLZXlzLm1hcChrZXkgPT4ge1xuXHRcdFx0Y29uc3Qgc2V0dGluZyA9IHRoaXMuX3NldHRpbmdzQnlOYW1lLmdldChrZXkpO1xuXHRcdFx0aWYgKHNldHRpbmcpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogc2V0dGluZy5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRrZXk6IHNldHRpbmcua2V5LFxuXHRcdFx0XHRcdHZhbHVlOiBzZXR0aW5nLnZhbHVlLFxuXHRcdFx0XHRcdGtleVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0cmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdFx0XHR2YWx1ZVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0b3ZlcnJpZGVzOiBbXSxcblx0XHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFLFxuXHRcdFx0XHRcdHR5cGU6IHNldHRpbmcudHlwZSxcblx0XHRcdFx0XHRlbnVtOiBzZXR0aW5nLmVudW0sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogc2V0dGluZy5lbnVtRGVzY3JpcHRpb25zLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uUmFuZ2VzOiBbXVxuXHRcdFx0XHR9IHNhdGlzZmllcyBJU2V0dGluZztcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogJ21vc3RDb21tb25seVVzZWQnLFxuXHRcdFx0cmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2NvbW1vbmx5VXNlZCcsIFwiQ29tbW9ubHkgVXNlZFwiKSxcblx0XHRcdHRpdGxlUmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdHNlY3Rpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzZXR0aW5nc1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSBzYXRpc2ZpZXMgSVNldHRpbmdzR3JvdXA7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlQ29uZmlnKGNvbmZpZzogSUNvbmZpZ3VyYXRpb25Ob2RlLCByZXN1bHQ6IElTZXR0aW5nc0dyb3VwW10sIGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSwgc2V0dGluZ3NHcm91cD86IElTZXR0aW5nc0dyb3VwLCBzZWVuU2V0dGluZ3M/OiB7IFtrZXk6IHN0cmluZ106IGJvb2xlYW4gfSk6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRcdHNlZW5TZXR0aW5ncyA9IHNlZW5TZXR0aW5ncyA/IHNlZW5TZXR0aW5ncyA6IHt9O1xuXHRcdGxldCB0aXRsZSA9IGNvbmZpZy50aXRsZTtcblx0XHRpZiAoIXRpdGxlKSB7XG5cdFx0XHRjb25zdCBjb25maWdXaXRoVGl0bGVBbmRTYW1lSWQgPSBjb25maWd1cmF0aW9ucy5maW5kKGMgPT4gKGMuaWQgPT09IGNvbmZpZy5pZCkgJiYgYy50aXRsZSk7XG5cdFx0XHRpZiAoY29uZmlnV2l0aFRpdGxlQW5kU2FtZUlkKSB7XG5cdFx0XHRcdHRpdGxlID0gY29uZmlnV2l0aFRpdGxlQW5kU2FtZUlkLnRpdGxlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdGlmICghc2V0dGluZ3NHcm91cCkge1xuXHRcdFx0XHRzZXR0aW5nc0dyb3VwID0gcmVzdWx0LmZpbmQoZyA9PiBnLnRpdGxlID09PSB0aXRsZSAmJiBnLmV4dGVuc2lvbkluZm8/LmlkID09PSBjb25maWcuZXh0ZW5zaW9uSW5mbz8uaWQpO1xuXHRcdFx0XHRpZiAoIXNldHRpbmdzR3JvdXApIHtcblx0XHRcdFx0XHRzZXR0aW5nc0dyb3VwID0geyBzZWN0aW9uczogW3sgc2V0dGluZ3M6IFtdIH1dLCBpZDogY29uZmlnLmlkIHx8ICcnLCB0aXRsZTogdGl0bGUgfHwgJycsIHRpdGxlUmFuZ2U6IG51bGxSYW5nZSwgb3JkZXI6IGNvbmZpZy5vcmRlciwgcmFuZ2U6IG51bGxSYW5nZSwgZXh0ZW5zaW9uSW5mbzogY29uZmlnLmV4dGVuc2lvbkluZm8gfTtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChzZXR0aW5nc0dyb3VwKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2V0dGluZ3NHcm91cC5zZWN0aW9uc1tzZXR0aW5nc0dyb3VwLnNlY3Rpb25zLmxlbmd0aCAtIDFdLnRpdGxlID0gdGl0bGU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjb25maWcucHJvcGVydGllcykge1xuXHRcdFx0aWYgKCFzZXR0aW5nc0dyb3VwKSB7XG5cdFx0XHRcdHNldHRpbmdzR3JvdXAgPSB7IHNlY3Rpb25zOiBbeyBzZXR0aW5nczogW10gfV0sIGlkOiBjb25maWcuaWQgfHwgJycsIHRpdGxlOiBjb25maWcuaWQgfHwgJycsIHRpdGxlUmFuZ2U6IG51bGxSYW5nZSwgb3JkZXI6IGNvbmZpZy5vcmRlciwgcmFuZ2U6IG51bGxSYW5nZSwgZXh0ZW5zaW9uSW5mbzogY29uZmlnLmV4dGVuc2lvbkluZm8gfTtcblx0XHRcdFx0cmVzdWx0LnB1c2goc2V0dGluZ3NHcm91cCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2V0dGluZ3M6IElTZXR0aW5nW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBbLi4uc2V0dGluZ3NHcm91cC5zZWN0aW9uc1tzZXR0aW5nc0dyb3VwLnNlY3Rpb25zLmxlbmd0aCAtIDFdLnNldHRpbmdzLCAuLi50aGlzLnBhcnNlU2V0dGluZ3MoY29uZmlnKV0pIHtcblx0XHRcdFx0aWYgKCFzZWVuU2V0dGluZ3Nbc2V0dGluZy5rZXldKSB7XG5cdFx0XHRcdFx0Y29uZmlndXJhdGlvblNldHRpbmdzLnB1c2goc2V0dGluZyk7XG5cdFx0XHRcdFx0c2VlblNldHRpbmdzW3NldHRpbmcua2V5XSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChjb25maWd1cmF0aW9uU2V0dGluZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdHNldHRpbmdzR3JvdXAuc2VjdGlvbnNbc2V0dGluZ3NHcm91cC5zZWN0aW9ucy5sZW5ndGggLSAxXS5zZXR0aW5ncyA9IGNvbmZpZ3VyYXRpb25TZXR0aW5ncztcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uZmlnLmFsbE9mPy5mb3JFYWNoKGMgPT4gdGhpcy5wYXJzZUNvbmZpZyhjLCByZXN1bHQsIGNvbmZpZ3VyYXRpb25zLCBzZXR0aW5nc0dyb3VwLCBzZWVuU2V0dGluZ3MpKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVFbXB0eVNldHRpbmdzR3JvdXBzKHNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdKTogSVNldHRpbmdzR3JvdXBbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJU2V0dGluZ3NHcm91cFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBzZXR0aW5nc0dyb3VwIG9mIHNldHRpbmdzR3JvdXBzKSB7XG5cdFx0XHRzZXR0aW5nc0dyb3VwLnNlY3Rpb25zID0gc2V0dGluZ3NHcm91cC5zZWN0aW9ucy5maWx0ZXIoc2VjdGlvbiA9PiBzZWN0aW9uLnNldHRpbmdzLmxlbmd0aCA+IDApO1xuXHRcdFx0aWYgKHNldHRpbmdzR3JvdXAuc2VjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHNldHRpbmdzR3JvdXApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZVNldHRpbmdzKGNvbmZpZzogSUNvbmZpZ3VyYXRpb25Ob2RlKTogSVNldHRpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJU2V0dGluZ1tdID0gW107XG5cblx0XHRjb25zdCBzZXR0aW5nc09iamVjdCA9IGNvbmZpZy5wcm9wZXJ0aWVzO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkluZm8gPSBjb25maWcuZXh0ZW5zaW9uSW5mbztcblxuXHRcdC8vIFRyeSB1c2luZyB0aGUgdGl0bGUgaWYgdGhlIGNhdGVnb3J5IGlkIHdhc24ndCBnaXZlblxuXHRcdC8vIChpbiB3aGljaCBjYXNlIHRoZSBjYXRlZ29yeSBpZCBpcyB0aGUgc2FtZSBhcyB0aGUgZXh0ZW5zaW9uIGlkKVxuXHRcdGNvbnN0IGNhdGVnb3J5TGFiZWwgPSBjb25maWcuZXh0ZW5zaW9uSW5mbz8uaWQgPT09IGNvbmZpZy5pZCA/IGNvbmZpZy50aXRsZSA6IGNvbmZpZy5pZDtcblxuXHRcdGZvciAoY29uc3Qga2V5IGluIHNldHRpbmdzT2JqZWN0KSB7XG5cdFx0XHRjb25zdCBwcm9wOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hID0gc2V0dGluZ3NPYmplY3Rba2V5XTtcblx0XHRcdGlmICh0aGlzLm1hdGNoZXNTY29wZShwcm9wKSkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHByb3AuZGVmYXVsdDtcblx0XHRcdFx0bGV0IGRlc2NyaXB0aW9uID0gKHByb3AubWFya2Rvd25EZXNjcmlwdGlvbiB8fCBwcm9wLmRlc2NyaXB0aW9uIHx8ICcnKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBkZXNjcmlwdGlvbiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbiA9ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uTGluZXMgPSBkZXNjcmlwdGlvbi5zcGxpdCgnXFxuJyk7XG5cdFx0XHRcdGNvbnN0IG92ZXJyaWRlcyA9IE9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSA/IHRoaXMucGFyc2VPdmVycmlkZVNldHRpbmdzKHByb3AuZGVmYXVsdCkgOiBbXTtcblx0XHRcdFx0bGV0IGxpc3RJdGVtVHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocHJvcC50eXBlID09PSAnYXJyYXknICYmIHByb3AuaXRlbXMgJiYgIUFycmF5LmlzQXJyYXkocHJvcC5pdGVtcykgJiYgcHJvcC5pdGVtcy50eXBlKSB7XG5cdFx0XHRcdFx0aWYgKHByb3AuaXRlbXMuZW51bSkge1xuXHRcdFx0XHRcdFx0bGlzdEl0ZW1UeXBlID0gJ2VudW0nO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkocHJvcC5pdGVtcy50eXBlKSkge1xuXHRcdFx0XHRcdFx0bGlzdEl0ZW1UeXBlID0gcHJvcC5pdGVtcy50eXBlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG9iamVjdFByb3BlcnRpZXMgPSBwcm9wLnR5cGUgPT09ICdvYmplY3QnID8gcHJvcC5wcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBvYmplY3RQYXR0ZXJuUHJvcGVydGllcyA9IHByb3AudHlwZSA9PT0gJ29iamVjdCcgPyBwcm9wLnBhdHRlcm5Qcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyA9IHByb3AudHlwZSA9PT0gJ29iamVjdCcgPyBwcm9wLmFkZGl0aW9uYWxQcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGxldCBlbnVtVG9Vc2UgPSBwcm9wLmVudW07XG5cdFx0XHRcdGxldCBlbnVtRGVzY3JpcHRpb25zID0gcHJvcC5tYXJrZG93bkVudW1EZXNjcmlwdGlvbnMgPz8gcHJvcC5lbnVtRGVzY3JpcHRpb25zO1xuXHRcdFx0XHRsZXQgZW51bURlc2NyaXB0aW9uc0FyZU1hcmtkb3duID0gISFwcm9wLm1hcmtkb3duRW51bURlc2NyaXB0aW9ucztcblx0XHRcdFx0aWYgKGxpc3RJdGVtVHlwZSA9PT0gJ2VudW0nICYmICFBcnJheS5pc0FycmF5KHByb3AuaXRlbXMpKSB7XG5cdFx0XHRcdFx0ZW51bVRvVXNlID0gcHJvcC5pdGVtcyEuZW51bTtcblx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zID0gcHJvcC5pdGVtcyEubWFya2Rvd25FbnVtRGVzY3JpcHRpb25zID8/IHByb3AuaXRlbXMhLmVudW1EZXNjcmlwdGlvbnM7XG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uc0FyZU1hcmtkb3duID0gISFwcm9wLml0ZW1zIS5tYXJrZG93bkVudW1EZXNjcmlwdGlvbnM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgYWxsS2V5c0FyZUJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdFx0aWYgKHByb3AudHlwZSA9PT0gJ29iamVjdCcgJiYgIXByb3AuYWRkaXRpb25hbFByb3BlcnRpZXMgJiYgcHJvcC5wcm9wZXJ0aWVzICYmIE9iamVjdC5rZXlzKHByb3AucHJvcGVydGllcykubGVuZ3RoKSB7XG5cdFx0XHRcdFx0YWxsS2V5c0FyZUJvb2xlYW4gPSBPYmplY3Qua2V5cyhwcm9wLnByb3BlcnRpZXMpLmV2ZXJ5KGtleSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcC5wcm9wZXJ0aWVzIVtrZXldLnR5cGUgPT09ICdib29sZWFuJztcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBpc0xhbmd1YWdlVGFnU2V0dGluZyA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoT1ZFUlJJREVfUFJPUEVSVFlfUkVHRVgudGVzdChrZXkpKSB7XG5cdFx0XHRcdFx0aXNMYW5ndWFnZVRhZ1NldHRpbmcgPSB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IGRlZmF1bHRWYWx1ZVNvdXJjZTogQ29uZmlndXJhdGlvbkRlZmF1bHRWYWx1ZVNvdXJjZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKCFpc0xhbmd1YWdlVGFnU2V0dGluZykge1xuXHRcdFx0XHRcdGNvbnN0IHJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcCA9IHByb3AgYXMgSVJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE7XG5cdFx0XHRcdFx0aWYgKHJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcCAmJiByZWdpc3RlcmVkQ29uZmlndXJhdGlvblByb3AuZGVmYXVsdFZhbHVlU291cmNlKSB7XG5cdFx0XHRcdFx0XHRkZWZhdWx0VmFsdWVTb3VyY2UgPSByZWdpc3RlcmVkQ29uZmlndXJhdGlvblByb3AuZGVmYXVsdFZhbHVlU291cmNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghZW51bVRvVXNlICYmIChwcm9wLmVudW1JdGVtTGFiZWxzIHx8IGVudW1EZXNjcmlwdGlvbnMgfHwgZW51bURlc2NyaXB0aW9uc0FyZU1hcmtkb3duKSkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFRoZSBzZXR0aW5nICR7a2V5fSBoYXMgZW51bS1yZWxhdGVkIGZpZWxkcywgYnV0IGRvZXNuJ3QgaGF2ZSBhbiBlbnVtIGZpZWxkLiBUaGlzIHNldHRpbmcgbWF5IHJlbmRlciBpbXByb3Blcmx5IGluIHRoZSBTZXR0aW5ncyBlZGl0b3IuYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdFx0a2V5LFxuXHRcdFx0XHRcdHZhbHVlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbkxpbmVzLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uSXNNYXJrZG93bjogISFwcm9wLm1hcmtkb3duRGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0cmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdFx0XHRrZXlSYW5nZTogbnVsbFJhbmdlLFxuXHRcdFx0XHRcdHZhbHVlUmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvblJhbmdlczogW10sXG5cdFx0XHRcdFx0b3ZlcnJpZGVzLFxuXHRcdFx0XHRcdHNjb3BlOiBwcm9wLnNjb3BlLFxuXHRcdFx0XHRcdHR5cGU6IHByb3AudHlwZSxcblx0XHRcdFx0XHRhcnJheUl0ZW1UeXBlOiBsaXN0SXRlbVR5cGUsXG5cdFx0XHRcdFx0b2JqZWN0UHJvcGVydGllcyxcblx0XHRcdFx0XHRvYmplY3RQYXR0ZXJuUHJvcGVydGllcyxcblx0XHRcdFx0XHRvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyxcblx0XHRcdFx0XHRlbnVtOiBlbnVtVG9Vc2UsXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogZW51bURlc2NyaXB0aW9ucyxcblx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zQXJlTWFya2Rvd246IGVudW1EZXNjcmlwdGlvbnNBcmVNYXJrZG93bixcblx0XHRcdFx0XHRlbnVtSXRlbUxhYmVsczogcHJvcC5lbnVtSXRlbUxhYmVscyxcblx0XHRcdFx0XHR1bmlxdWVJdGVtczogcHJvcC51bmlxdWVJdGVtcyxcblx0XHRcdFx0XHR0YWdzOiBwcm9wLnRhZ3MsXG5cdFx0XHRcdFx0ZGlzYWxsb3dTeW5jSWdub3JlOiBwcm9wLmRpc2FsbG93U3luY0lnbm9yZSxcblx0XHRcdFx0XHRyZXN0cmljdGVkOiBwcm9wLnJlc3RyaWN0ZWQsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSW5mbzogZXh0ZW5zaW9uSW5mbyxcblx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IHByb3AubWFya2Rvd25EZXByZWNhdGlvbk1lc3NhZ2UgfHwgcHJvcC5kZXByZWNhdGlvbk1lc3NhZ2UsXG5cdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlSXNNYXJrZG93bjogISFwcm9wLm1hcmtkb3duRGVwcmVjYXRpb25NZXNzYWdlLFxuXHRcdFx0XHRcdHZhbGlkYXRvcjogY3JlYXRlVmFsaWRhdG9yKHByb3ApLFxuXHRcdFx0XHRcdGFsbEtleXNBcmVCb29sZWFuLFxuXHRcdFx0XHRcdGVkaXRQcmVzZW50YXRpb246IHByb3AuZWRpdFByZXNlbnRhdGlvbixcblx0XHRcdFx0XHRvcmRlcjogcHJvcC5vcmRlcixcblx0XHRcdFx0XHRub25MYW5ndWFnZVNwZWNpZmljRGVmYXVsdFZhbHVlU291cmNlOiBkZWZhdWx0VmFsdWVTb3VyY2UsXG5cdFx0XHRcdFx0aXNMYW5ndWFnZVRhZ1NldHRpbmcsXG5cdFx0XHRcdFx0Y2F0ZWdvcnlMYWJlbFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VPdmVycmlkZVNldHRpbmdzKG92ZXJyaWRlU2V0dGluZ3M6IGFueSk6IElTZXR0aW5nW10ge1xuXHRcdHJldHVybiBPYmplY3Qua2V5cyhvdmVycmlkZVNldHRpbmdzKS5tYXAoKGtleSkgPT4gKHtcblx0XHRcdGtleSxcblx0XHRcdHZhbHVlOiBvdmVycmlkZVNldHRpbmdzW2tleV0sXG5cdFx0XHRkZXNjcmlwdGlvbjogW10sXG5cdFx0XHRkZXNjcmlwdGlvbklzTWFya2Rvd246IGZhbHNlLFxuXHRcdFx0cmFuZ2U6IG51bGxSYW5nZSxcblx0XHRcdGtleVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHR2YWx1ZVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRkZXNjcmlwdGlvblJhbmdlczogW10sXG5cdFx0XHRvdmVycmlkZXM6IFtdXG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaGVzU2NvcGUocHJvcGVydHk6IElDb25maWd1cmF0aW9uTm9kZSk6IGJvb2xlYW4ge1xuXHRcdGlmICghcHJvcGVydHkuc2NvcGUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy50YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUikge1xuXHRcdFx0cmV0dXJuIEZPTERFUl9TQ09QRVMuaW5kZXhPZihwcm9wZXJ0eS5zY29wZSkgIT09IC0xO1xuXHRcdH1cblx0XHRpZiAodGhpcy50YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKSB7XG5cdFx0XHRyZXR1cm4gV09SS1NQQUNFX1NDT1BFUy5pbmRleE9mKHByb3BlcnR5LnNjb3BlKSAhPT0gLTE7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlQ29uZmlndXJhdGlvbk5vZGVzKGMxOiBJQ29uZmlndXJhdGlvbk5vZGUsIGMyOiBJQ29uZmlndXJhdGlvbk5vZGUpOiBudW1iZXIge1xuXHRcdGlmICh0eXBlb2YgYzEub3JkZXIgIT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBjMi5vcmRlciAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0aWYgKGMxLm9yZGVyID09PSBjMi5vcmRlcikge1xuXHRcdFx0Y29uc3QgdGl0bGUxID0gYzEudGl0bGUgfHwgJyc7XG5cdFx0XHRjb25zdCB0aXRsZTIgPSBjMi50aXRsZSB8fCAnJztcblx0XHRcdHJldHVybiB0aXRsZTEubG9jYWxlQ29tcGFyZSh0aXRsZTIpO1xuXHRcdH1cblx0XHRyZXR1cm4gYzEub3JkZXIgLSBjMi5vcmRlcjtcblx0fVxuXG5cdHByaXZhdGUgdG9Db250ZW50KHNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdLCBzdGFydEluZGV4OiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgU2V0dGluZ3NDb250ZW50QnVpbGRlcigpO1xuXHRcdGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgc2V0dGluZ3NHcm91cHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGJ1aWxkZXIucHVzaEdyb3VwKHNldHRpbmdzR3JvdXBzW2ldLCBpID09PSBzdGFydEluZGV4LCBpID09PSBzZXR0aW5nc0dyb3Vwcy5sZW5ndGggLSAxKTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1aWxkZXIuZ2V0Q29udGVudCgpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsIGV4dGVuZHMgQWJzdHJhY3RTZXR0aW5nc01vZGVsIGltcGxlbWVudHMgSVNldHRpbmdzRWRpdG9yTW9kZWwge1xuXG5cdHByaXZhdGUgX21vZGVsOiBJVGV4dE1vZGVsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlR3JvdXBzOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlR3JvdXBzOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3VyaTogVVJJLFxuXHRcdHJlZmVyZW5jZTogSVJlZmVyZW5jZTxJVGV4dEVkaXRvck1vZGVsPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRTZXR0aW5nczogRGVmYXVsdFNldHRpbmdzXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihkZWZhdWx0U2V0dGluZ3Mub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VHcm91cHMuZmlyZSgpKSk7XG5cdFx0dGhpcy5fbW9kZWwgPSByZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbCE7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbldpbGxEaXNwb3NlKCgpID0+IHJlZmVyZW5jZS5kaXNwb3NlKCkpKTtcblx0fVxuXG5cdGdldCB1cmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5fdXJpO1xuXHR9XG5cblx0Z2V0IHRhcmdldCgpOiBDb25maWd1cmF0aW9uVGFyZ2V0IHtcblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0U2V0dGluZ3MudGFyZ2V0O1xuXHR9XG5cblx0Z2V0IHNldHRpbmdzR3JvdXBzKCk6IElTZXR0aW5nc0dyb3VwW10ge1xuXHRcdHJldHVybiB0aGlzLmRlZmF1bHRTZXR0aW5ncy5nZXRTZXR0aW5nc0dyb3VwcygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldCBmaWx0ZXJHcm91cHMoKTogSVNldHRpbmdzR3JvdXBbXSB7XG5cdFx0Ly8gRG9uJ3QgbG9vayBhdCBcImNvbW1vbmx5IHVzZWRcIiBmb3IgZmlsdGVyXG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3NHcm91cHMuc2xpY2UoMSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlKCk6IElGaWx0ZXJSZXN1bHQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9tb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gR3JhYiBjdXJyZW50IHJlc3VsdCBncm91cHMsIG9ubHkgcmVuZGVyIG5vbi1lbXB0eSBncm91cHNcblx0XHRjb25zdCByZXN1bHRHcm91cHMgPSBbLi4udGhpcy5fY3VycmVudFJlc3VsdEdyb3Vwcy52YWx1ZXMoKV1cblx0XHRcdC5zb3J0KChhLCBiKSA9PiBhLm9yZGVyIC0gYi5vcmRlcik7XG5cdFx0Y29uc3Qgbm9uRW1wdHlSZXN1bHRHcm91cHMgPSByZXN1bHRHcm91cHMuZmlsdGVyKGdyb3VwID0+IGdyb3VwLnJlc3VsdC5maWx0ZXJNYXRjaGVzLmxlbmd0aCk7XG5cblx0XHRjb25zdCBzdGFydExpbmUgPSB0aGlzLnNldHRpbmdzR3JvdXBzLmF0KC0xKSEucmFuZ2UuZW5kTGluZU51bWJlciArIDI7XG5cdFx0Y29uc3QgeyBzZXR0aW5nc0dyb3VwczogZmlsdGVyZWRHcm91cHMsIG1hdGNoZXMgfSA9IHRoaXMud3JpdGVSZXN1bHRHcm91cHMobm9uRW1wdHlSZXN1bHRHcm91cHMsIHN0YXJ0TGluZSk7XG5cblx0XHRjb25zdCBtZXRhZGF0YSA9IHRoaXMuY29sbGVjdE1ldGFkYXRhKHJlc3VsdEdyb3Vwcyk7XG5cdFx0cmV0dXJuIHJlc3VsdEdyb3Vwcy5sZW5ndGggP1xuXHRcdFx0e1xuXHRcdFx0XHRhbGxHcm91cHM6IHRoaXMuc2V0dGluZ3NHcm91cHMsXG5cdFx0XHRcdGZpbHRlcmVkR3JvdXBzLFxuXHRcdFx0XHRtYXRjaGVzLFxuXHRcdFx0XHRtZXRhZGF0YTogbWV0YWRhdGEgPz8gdW5kZWZpbmVkXG5cdFx0XHR9IDpcblx0XHRcdHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUcmFuc2xhdGUgdGhlIElTZWFyY2hSZXN1bHRHcm91cHMgdG8gdGV4dCwgYW5kIHdyaXRlIGl0IHRvIHRoZSBlZGl0b3IgbW9kZWxcblx0ICovXG5cdHByaXZhdGUgd3JpdGVSZXN1bHRHcm91cHMoZ3JvdXBzOiBJU2VhcmNoUmVzdWx0R3JvdXBbXSwgc3RhcnRMaW5lOiBudW1iZXIpOiB7IG1hdGNoZXM6IElSYW5nZVtdOyBzZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXBbXSB9IHtcblx0XHRjb25zdCBjb250ZW50QnVpbGRlck9mZnNldCA9IHN0YXJ0TGluZSAtIDE7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBTZXR0aW5nc0NvbnRlbnRCdWlsZGVyKGNvbnRlbnRCdWlsZGVyT2Zmc2V0KTtcblxuXHRcdGNvbnN0IHNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdID0gW107XG5cdFx0Y29uc3QgbWF0Y2hlczogSVJhbmdlW10gPSBbXTtcblx0XHRpZiAoZ3JvdXBzLmxlbmd0aCkge1xuXHRcdFx0YnVpbGRlci5wdXNoTGluZSgnLCcpO1xuXHRcdFx0Z3JvdXBzLmZvckVhY2gocmVzdWx0R3JvdXAgPT4ge1xuXHRcdFx0XHRjb25zdCBzZXR0aW5nc0dyb3VwID0gdGhpcy5nZXRHcm91cChyZXN1bHRHcm91cCk7XG5cdFx0XHRcdHNldHRpbmdzR3JvdXBzLnB1c2goc2V0dGluZ3NHcm91cCk7XG5cdFx0XHRcdG1hdGNoZXMucHVzaCguLi50aGlzLndyaXRlU2V0dGluZ3NHcm91cFRvQnVpbGRlcihidWlsZGVyLCBzZXR0aW5nc0dyb3VwLCByZXN1bHRHcm91cC5yZXN1bHQuZmlsdGVyTWF0Y2hlcykpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gbm90ZTogMS1pbmRleGVkIGxpbmUgbnVtYmVycyBoZXJlXG5cdFx0Y29uc3QgZ3JvdXBDb250ZW50ID0gYnVpbGRlci5nZXRDb250ZW50KCkgKyAnXFxuJztcblx0XHRjb25zdCBncm91cEVuZExpbmUgPSB0aGlzLl9tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBjdXJzb3JQb3NpdGlvbiA9IG5ldyBTZWxlY3Rpb24oc3RhcnRMaW5lLCAxLCBzdGFydExpbmUsIDEpO1xuXHRcdGNvbnN0IGVkaXQ6IElTaW5nbGVFZGl0T3BlcmF0aW9uID0ge1xuXHRcdFx0dGV4dDogZ3JvdXBDb250ZW50LFxuXHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogdHJ1ZSxcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc3RhcnRMaW5lLCAxLCBncm91cEVuZExpbmUsIDEpXG5cdFx0fTtcblxuXHRcdHRoaXMuX21vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhbY3Vyc29yUG9zaXRpb25dLCBbZWRpdF0sICgpID0+IFtjdXJzb3JQb3NpdGlvbl0pO1xuXG5cdFx0Ly8gRm9yY2UgdG9rZW5pemF0aW9uIG5vdyAtIG90aGVyd2lzZSBpdCBtYXkgYmUgc2xpZ2h0bHkgZGVsYXllZCwgY2F1c2luZyBhIGZsYXNoIG9mIHdoaXRlIHRleHRcblx0XHRjb25zdCB0b2tlbml6ZVRvID0gTWF0aC5taW4oc3RhcnRMaW5lICsgNjAsIHRoaXMuX21vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHR0aGlzLl9tb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24odG9rZW5pemVUbyk7XG5cblx0XHRyZXR1cm4geyBtYXRjaGVzLCBzZXR0aW5nc0dyb3VwcyB9O1xuXHR9XG5cblx0cHJpdmF0ZSB3cml0ZVNldHRpbmdzR3JvdXBUb0J1aWxkZXIoYnVpbGRlcjogU2V0dGluZ3NDb250ZW50QnVpbGRlciwgc2V0dGluZ3NHcm91cDogSVNldHRpbmdzR3JvdXAsIGZpbHRlck1hdGNoZXM6IElTZXR0aW5nTWF0Y2hbXSk6IElSYW5nZVtdIHtcblx0XHRmaWx0ZXJNYXRjaGVzID0gZmlsdGVyTWF0Y2hlc1xuXHRcdFx0Lm1hcChmaWx0ZXJlZE1hdGNoID0+IHtcblx0XHRcdFx0Ly8gRml4IG1hdGNoIHJhbmdlcyB0byBvZmZzZXQgZnJvbSBzZXR0aW5nIHN0YXJ0IGxpbmVcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzZXR0aW5nOiBmaWx0ZXJlZE1hdGNoLnNldHRpbmcsXG5cdFx0XHRcdFx0c2NvcmU6IGZpbHRlcmVkTWF0Y2guc2NvcmUsXG5cdFx0XHRcdFx0bWF0Y2hUeXBlOiBmaWx0ZXJlZE1hdGNoLm1hdGNoVHlwZSxcblx0XHRcdFx0XHRrZXlNYXRjaFNjb3JlOiBmaWx0ZXJlZE1hdGNoLmtleU1hdGNoU2NvcmUsXG5cdFx0XHRcdFx0bWF0Y2hlczogZmlsdGVyZWRNYXRjaC5tYXRjaGVzICYmIGZpbHRlcmVkTWF0Y2gubWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBSYW5nZShcblx0XHRcdFx0XHRcdFx0bWF0Y2guc3RhcnRMaW5lTnVtYmVyIC0gZmlsdGVyZWRNYXRjaC5zZXR0aW5nLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0bWF0Y2guc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRcdG1hdGNoLmVuZExpbmVOdW1iZXIgLSBmaWx0ZXJlZE1hdGNoLnNldHRpbmcucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0XHRtYXRjaC5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdGJ1aWxkZXIucHVzaEdyb3VwKHNldHRpbmdzR3JvdXApO1xuXG5cdFx0Ly8gYnVpbGRlciBoYXMgcmV3cml0dGVuIHNldHRpbmdzIHJhbmdlcywgZml4IG1hdGNoIHJhbmdlc1xuXHRcdGNvbnN0IGZpeGVkTWF0Y2hlcyA9IGZpbHRlck1hdGNoZXNcblx0XHRcdC5tYXAobSA9PiBtLm1hdGNoZXMgfHwgW10pXG5cdFx0XHQuZmxhdE1hcCgoc2V0dGluZ01hdGNoZXMsIGkpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2V0dGluZyA9IHNldHRpbmdzR3JvdXAuc2VjdGlvbnNbMF0uc2V0dGluZ3NbaV07XG5cdFx0XHRcdHJldHVybiBzZXR0aW5nTWF0Y2hlcy5tYXAocmFuZ2UgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUmFuZ2UoXG5cdFx0XHRcdFx0XHRyYW5nZS5zdGFydExpbmVOdW1iZXIgKyBzZXR0aW5nLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdHJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRcdFx0cmFuZ2UuZW5kTGluZU51bWJlciArIHNldHRpbmcucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0cmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiBmaXhlZE1hdGNoZXM7XG5cdH1cblxuXHRwcml2YXRlIGNvcHlTZXR0aW5nKHNldHRpbmc6IElTZXR0aW5nKTogSVNldHRpbmcge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogc2V0dGluZy5kZXNjcmlwdGlvbixcblx0XHRcdHNjb3BlOiBzZXR0aW5nLnNjb3BlLFxuXHRcdFx0dHlwZTogc2V0dGluZy50eXBlLFxuXHRcdFx0ZW51bTogc2V0dGluZy5lbnVtLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogc2V0dGluZy5lbnVtRGVzY3JpcHRpb25zLFxuXHRcdFx0a2V5OiBzZXR0aW5nLmtleSxcblx0XHRcdHZhbHVlOiBzZXR0aW5nLnZhbHVlLFxuXHRcdFx0cmFuZ2U6IHNldHRpbmcucmFuZ2UsXG5cdFx0XHRvdmVycmlkZXM6IFtdLFxuXHRcdFx0b3ZlcnJpZGVPZjogc2V0dGluZy5vdmVycmlkZU9mLFxuXHRcdFx0dGFnczogc2V0dGluZy50YWdzLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBzZXR0aW5nLmRlcHJlY2F0aW9uTWVzc2FnZSxcblx0XHRcdGtleVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHR2YWx1ZVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRkZXNjcmlwdGlvbklzTWFya2Rvd246IHVuZGVmaW5lZCxcblx0XHRcdGRlc2NyaXB0aW9uUmFuZ2VzOiBbXVxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBnZXRQcmVmZXJlbmNlKGtleTogc3RyaW5nKTogSVNldHRpbmcgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5zZXR0aW5nc0dyb3Vwcykge1xuXHRcdFx0Zm9yIChjb25zdCBzZWN0aW9uIG9mIGdyb3VwLnNlY3Rpb25zKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0aWYgKHNldHRpbmcua2V5ID09PSBrZXkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBzZXR0aW5nO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRHcm91cChyZXN1bHRHcm91cDogSVNlYXJjaFJlc3VsdEdyb3VwKTogSVNldHRpbmdzR3JvdXAge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogcmVzdWx0R3JvdXAuaWQsXG5cdFx0XHRyYW5nZTogbnVsbFJhbmdlLFxuXHRcdFx0dGl0bGU6IHJlc3VsdEdyb3VwLmxhYmVsLFxuXHRcdFx0dGl0bGVSYW5nZTogbnVsbFJhbmdlLFxuXHRcdFx0c2VjdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNldHRpbmdzOiByZXN1bHRHcm91cC5yZXN1bHQuZmlsdGVyTWF0Y2hlcy5tYXAobSA9PiB0aGlzLmNvcHlTZXR0aW5nKG0uc2V0dGluZykpXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdzQ29udGVudEJ1aWxkZXIge1xuXHRwcml2YXRlIF9jb250ZW50QnlMaW5lczogc3RyaW5nW107XG5cblx0cHJpdmF0ZSBnZXQgbGluZUNvdW50V2l0aE9mZnNldCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZW50QnlMaW5lcy5sZW5ndGggKyB0aGlzLl9yYW5nZU9mZnNldDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGxhc3RMaW5lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRCeUxpbmVzW3RoaXMuX2NvbnRlbnRCeUxpbmVzLmxlbmd0aCAtIDFdIHx8ICcnO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBfcmFuZ2VPZmZzZXQgPSAwKSB7XG5cdFx0dGhpcy5fY29udGVudEJ5TGluZXMgPSBbXTtcblx0fVxuXG5cdHB1c2hMaW5lKC4uLmxpbmVUZXh0OiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnB1c2goLi4ubGluZVRleHQpO1xuXHR9XG5cblx0cHVzaEdyb3VwKHNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cCwgaXNGaXJzdD86IGJvb2xlYW4sIGlzTGFzdD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50QnlMaW5lcy5wdXNoKGlzRmlyc3QgPyAnW3snIDogJ3snKTtcblx0XHRjb25zdCBsYXN0U2V0dGluZyA9IHRoaXMuX3B1c2hHcm91cChzZXR0aW5nc0dyb3VwcywgJyAgJyk7XG5cblx0XHRpZiAobGFzdFNldHRpbmcpIHtcblx0XHRcdC8vIFN0cmlwIHRoZSBjb21tYSBmcm9tIHRoZSBsYXN0IHNldHRpbmdcblx0XHRcdGNvbnN0IGxpbmVJZHggPSBsYXN0U2V0dGluZy5yYW5nZS5lbmRMaW5lTnVtYmVyIC0gdGhpcy5fcmFuZ2VPZmZzZXQ7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gdGhpcy5fY29udGVudEJ5TGluZXNbbGluZUlkeCAtIDJdO1xuXHRcdFx0dGhpcy5fY29udGVudEJ5TGluZXNbbGluZUlkeCAtIDJdID0gY29udGVudC5zdWJzdHJpbmcoMCwgY29udGVudC5sZW5ndGggLSAxKTtcblx0XHR9XG5cblx0XHR0aGlzLl9jb250ZW50QnlMaW5lcy5wdXNoKGlzTGFzdCA/ICd9XScgOiAnfSwnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfcHVzaEdyb3VwKGdyb3VwOiBJU2V0dGluZ3NHcm91cCwgaW5kZW50OiBzdHJpbmcpOiBJU2V0dGluZyB8IG51bGwge1xuXHRcdGxldCBsYXN0U2V0dGluZzogSVNldHRpbmcgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBncm91cFN0YXJ0ID0gdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0ICsgMTtcblx0XHRmb3IgKGNvbnN0IHNlY3Rpb24gb2YgZ3JvdXAuc2VjdGlvbnMpIHtcblx0XHRcdGlmIChzZWN0aW9uLnRpdGxlKSB7XG5cdFx0XHRcdGNvbnN0IHNlY3Rpb25UaXRsZVN0YXJ0ID0gdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0ICsgMTtcblx0XHRcdFx0dGhpcy5hZGREZXNjcmlwdGlvbihbc2VjdGlvbi50aXRsZV0sIGluZGVudCwgdGhpcy5fY29udGVudEJ5TGluZXMpO1xuXHRcdFx0XHRzZWN0aW9uLnRpdGxlUmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogc2VjdGlvblRpdGxlU3RhcnQsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQsIGVuZENvbHVtbjogdGhpcy5sYXN0TGluZS5sZW5ndGggfTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlY3Rpb24uc2V0dGluZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0dGhpcy5wdXNoU2V0dGluZyhzZXR0aW5nLCBpbmRlbnQpO1xuXHRcdFx0XHRcdGxhc3RTZXR0aW5nID0gc2V0dGluZztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fVxuXHRcdGdyb3VwLnJhbmdlID0geyBzdGFydExpbmVOdW1iZXI6IGdyb3VwU3RhcnQsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQsIGVuZENvbHVtbjogdGhpcy5sYXN0TGluZS5sZW5ndGggfTtcblx0XHRyZXR1cm4gbGFzdFNldHRpbmc7XG5cdH1cblxuXHRnZXRDb250ZW50KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRCeUxpbmVzLmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBwdXNoU2V0dGluZyhzZXR0aW5nOiBJU2V0dGluZywgaW5kZW50OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBzZXR0aW5nU3RhcnQgPSB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQgKyAxO1xuXG5cdFx0dGhpcy5wdXNoU2V0dGluZ0Rlc2NyaXB0aW9uKHNldHRpbmcsIGluZGVudCk7XG5cblx0XHRsZXQgcHJlVmFsdWVDb250ZW50ID0gaW5kZW50O1xuXHRcdGNvbnN0IGtleVN0cmluZyA9IEpTT04uc3RyaW5naWZ5KHNldHRpbmcua2V5KTtcblx0XHRwcmVWYWx1ZUNvbnRlbnQgKz0ga2V5U3RyaW5nO1xuXHRcdHNldHRpbmcua2V5UmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0ICsgMSwgc3RhcnRDb2x1bW46IHByZVZhbHVlQ29udGVudC5pbmRleE9mKHNldHRpbmcua2V5KSArIDEsIGVuZExpbmVOdW1iZXI6IHRoaXMubGluZUNvdW50V2l0aE9mZnNldCArIDEsIGVuZENvbHVtbjogc2V0dGluZy5rZXkubGVuZ3RoIH07XG5cblx0XHRwcmVWYWx1ZUNvbnRlbnQgKz0gJzogJztcblx0XHRjb25zdCB2YWx1ZVN0YXJ0ID0gdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0ICsgMTtcblx0XHR0aGlzLnB1c2hWYWx1ZShzZXR0aW5nLCBwcmVWYWx1ZUNvbnRlbnQsIGluZGVudCk7XG5cblx0XHRzZXR0aW5nLnZhbHVlUmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogdmFsdWVTdGFydCwgc3RhcnRDb2x1bW46IHByZVZhbHVlQ29udGVudC5sZW5ndGggKyAxLCBlbmRMaW5lTnVtYmVyOiB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQsIGVuZENvbHVtbjogdGhpcy5sYXN0TGluZS5sZW5ndGggKyAxIH07XG5cdFx0dGhpcy5fY29udGVudEJ5TGluZXNbdGhpcy5fY29udGVudEJ5TGluZXMubGVuZ3RoIC0gMV0gKz0gJywnO1xuXHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnB1c2goJycpO1xuXHRcdHNldHRpbmcucmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogc2V0dGluZ1N0YXJ0LCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0LCBlbmRDb2x1bW46IHRoaXMubGFzdExpbmUubGVuZ3RoIH07XG5cdH1cblxuXHRwcml2YXRlIHB1c2hTZXR0aW5nRGVzY3JpcHRpb24oc2V0dGluZzogSVNldHRpbmcsIGluZGVudDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZml4U2V0dGluZ0xpbmsgPSAobGluZTogc3RyaW5nKSA9PiBsaW5lLnJlcGxhY2UoL2AjKC4qKSNgL2csIChtYXRjaCwgc2V0dGluZ05hbWUpID0+IGBcXGAke3NldHRpbmdOYW1lfVxcYGApO1xuXG5cdFx0c2V0dGluZy5kZXNjcmlwdGlvblJhbmdlcyA9IFtdO1xuXHRcdGNvbnN0IGRlc2NyaXB0aW9uUHJlVmFsdWUgPSBpbmRlbnQgKyAnLy8gJztcblx0XHRjb25zdCBkZXByZWNhdGlvbk1lc3NhZ2VMaW5lcyA9IHNldHRpbmcuZGVwcmVjYXRpb25NZXNzYWdlPy5zcGxpdCgvXFxuL2cpID8/IFtdO1xuXHRcdGZvciAobGV0IGxpbmUgb2YgWy4uLmRlcHJlY2F0aW9uTWVzc2FnZUxpbmVzLCAuLi5zZXR0aW5nLmRlc2NyaXB0aW9uXSkge1xuXHRcdFx0bGluZSA9IGZpeFNldHRpbmdMaW5rKGxpbmUpO1xuXG5cdFx0XHR0aGlzLl9jb250ZW50QnlMaW5lcy5wdXNoKGRlc2NyaXB0aW9uUHJlVmFsdWUgKyBsaW5lKTtcblx0XHRcdHNldHRpbmcuZGVzY3JpcHRpb25SYW5nZXMucHVzaCh7IHN0YXJ0TGluZU51bWJlcjogdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0LCBzdGFydENvbHVtbjogdGhpcy5sYXN0TGluZS5pbmRleE9mKGxpbmUpICsgMSwgZW5kTGluZU51bWJlcjogdGhpcy5saW5lQ291bnRXaXRoT2Zmc2V0LCBlbmRDb2x1bW46IHRoaXMubGFzdExpbmUubGVuZ3RoIH0pO1xuXHRcdH1cblxuXHRcdGlmIChzZXR0aW5nLmVudW0gJiYgc2V0dGluZy5lbnVtRGVzY3JpcHRpb25zPy5zb21lKGRlc2MgPT4gISFkZXNjKSkge1xuXHRcdFx0c2V0dGluZy5lbnVtRGVzY3JpcHRpb25zLmZvckVhY2goKGRlc2MsIGkpID0+IHtcblx0XHRcdFx0Y29uc3QgZGlzcGxheUVudW0gPSBlc2NhcGVJbnZpc2libGVDaGFycyhTdHJpbmcoc2V0dGluZy5lbnVtIVtpXSkpO1xuXHRcdFx0XHRjb25zdCBsaW5lID0gZGVzYyA/XG5cdFx0XHRcdFx0YCR7ZGlzcGxheUVudW19OiAke2ZpeFNldHRpbmdMaW5rKGRlc2MpfWAgOlxuXHRcdFx0XHRcdGRpc3BsYXlFbnVtO1xuXG5cdFx0XHRcdGNvbnN0IGxpbmVzID0gbGluZS5zcGxpdCgvXFxuL2cpO1xuXHRcdFx0XHRsaW5lc1swXSA9ICcgLSAnICsgbGluZXNbMF07XG5cdFx0XHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnB1c2goLi4ubGluZXMubWFwKGwgPT4gYCR7aW5kZW50fS8vICR7bH1gKSk7XG5cblx0XHRcdFx0c2V0dGluZy5kZXNjcmlwdGlvblJhbmdlcy5wdXNoKHsgc3RhcnRMaW5lTnVtYmVyOiB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQsIHN0YXJ0Q29sdW1uOiB0aGlzLmxhc3RMaW5lLmluZGV4T2YobGluZSkgKyAxLCBlbmRMaW5lTnVtYmVyOiB0aGlzLmxpbmVDb3VudFdpdGhPZmZzZXQsIGVuZENvbHVtbjogdGhpcy5sYXN0TGluZS5sZW5ndGggfSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHB1c2hWYWx1ZShzZXR0aW5nOiBJU2V0dGluZywgcHJlVmFsdWVDb25lbnQ6IHN0cmluZywgaW5kZW50OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZVN0cmluZyA9IEpTT04uc3RyaW5naWZ5KHNldHRpbmcudmFsdWUsIG51bGwsIGluZGVudCk7XG5cdFx0aWYgKHZhbHVlU3RyaW5nICYmICh0eXBlb2Ygc2V0dGluZy52YWx1ZSA9PT0gJ29iamVjdCcpKSB7XG5cdFx0XHRpZiAoc2V0dGluZy5vdmVycmlkZXMgJiYgc2V0dGluZy5vdmVycmlkZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnB1c2gocHJlVmFsdWVDb25lbnQgKyAnIHsnKTtcblx0XHRcdFx0Zm9yIChjb25zdCBzdWJTZXR0aW5nIG9mIHNldHRpbmcub3ZlcnJpZGVzKSB7XG5cdFx0XHRcdFx0dGhpcy5wdXNoU2V0dGluZyhzdWJTZXR0aW5nLCBpbmRlbnQgKyBpbmRlbnQpO1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnBvcCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGxhc3RTZXR0aW5nID0gc2V0dGluZy5vdmVycmlkZXNbc2V0dGluZy5vdmVycmlkZXMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSB0aGlzLl9jb250ZW50QnlMaW5lc1tsYXN0U2V0dGluZy5yYW5nZS5lbmRMaW5lTnVtYmVyIC0gMl07XG5cdFx0XHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzW2xhc3RTZXR0aW5nLnJhbmdlLmVuZExpbmVOdW1iZXIgLSAyXSA9IGNvbnRlbnQuc3Vic3RyaW5nKDAsIGNvbnRlbnQubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdHRoaXMuX2NvbnRlbnRCeUxpbmVzLnB1c2goaW5kZW50ICsgJ30nKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG11bGl0TGluZVZhbHVlID0gdmFsdWVTdHJpbmcuc3BsaXQoJ1xcbicpO1xuXHRcdFx0XHR0aGlzLl9jb250ZW50QnlMaW5lcy5wdXNoKHByZVZhbHVlQ29uZW50ICsgbXVsaXRMaW5lVmFsdWVbMF0pO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IG11bGl0TGluZVZhbHVlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29udGVudEJ5TGluZXMucHVzaChpbmRlbnQgKyBtdWxpdExpbmVWYWx1ZVtpXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY29udGVudEJ5TGluZXMucHVzaChwcmVWYWx1ZUNvbmVudCArIHZhbHVlU3RyaW5nKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkZERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmdbXSwgaW5kZW50OiBzdHJpbmcsIHJlc3VsdDogc3RyaW5nW10pIHtcblx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgZGVzY3JpcHRpb24pIHtcblx0XHRcdHJlc3VsdC5wdXNoKGluZGVudCArICcvLyAnICsgbGluZSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFJhd1NldHRpbmdzQ29udGVudEJ1aWxkZXIgZXh0ZW5kcyBTZXR0aW5nc0NvbnRlbnRCdWlsZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGluZGVudDogc3RyaW5nID0gJ1xcdCcpIHtcblx0XHRzdXBlcigwKTtcblx0fVxuXG5cdG92ZXJyaWRlIHB1c2hHcm91cChzZXR0aW5nc0dyb3VwczogSVNldHRpbmdzR3JvdXApOiB2b2lkIHtcblx0XHR0aGlzLl9wdXNoR3JvdXAoc2V0dGluZ3NHcm91cHMsIHRoaXMuaW5kZW50KTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0UmF3U2V0dGluZ3NFZGl0b3JNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2NvbnRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ29udGVudENoYW5nZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDb250ZW50Q2hhbmdlZCA9IHRoaXMuX29uRGlkQ29udGVudENoYW5nZWQuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBkZWZhdWx0U2V0dGluZ3M6IERlZmF1bHRTZXR0aW5ncykge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGVmYXVsdFNldHRpbmdzLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX2NvbnRlbnQgPSBudWxsO1xuXHRcdFx0dGhpcy5fb25EaWRDb250ZW50Q2hhbmdlZC5maXJlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0IGNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5fY29udGVudCA9PT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBSYXdTZXR0aW5nc0NvbnRlbnRCdWlsZGVyKCk7XG5cdFx0XHRidWlsZGVyLnB1c2hMaW5lKCd7Jyk7XG5cdFx0XHRmb3IgKGNvbnN0IHNldHRpbmdzR3JvdXAgb2YgdGhpcy5kZWZhdWx0U2V0dGluZ3MuZ2V0UmVnaXN0ZXJlZEdyb3VwcygpKSB7XG5cdFx0XHRcdGJ1aWxkZXIucHVzaEdyb3VwKHNldHRpbmdzR3JvdXApO1xuXHRcdFx0fVxuXHRcdFx0YnVpbGRlci5wdXNoTGluZSgnfScpO1xuXHRcdFx0dGhpcy5fY29udGVudCA9IGJ1aWxkZXIuZ2V0Q29udGVudCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY29udGVudDtcblx0fVxufVxuXG5mdW5jdGlvbiBlc2NhcGVJbnZpc2libGVDaGFycyhlbnVtVmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBlbnVtVmFsdWUgJiYgZW51bVZhbHVlXG5cdFx0LnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuXHRcdC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0S2V5YmluZGluZ3NDb250ZW50cyhrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlKTogc3RyaW5nIHtcblx0Y29uc3QgZGVmYXVsdHNIZWFkZXIgPSAnLy8gJyArIG5scy5sb2NhbGl6ZSgnZGVmYXVsdEtleWJpbmRpbmdzSGVhZGVyJywgXCJPdmVycmlkZSBrZXkgYmluZGluZ3MgYnkgcGxhY2luZyB0aGVtIGludG8geW91ciBrZXkgYmluZGluZ3MgZmlsZS5cIik7XG5cdHJldHVybiBkZWZhdWx0c0hlYWRlciArICdcXG4nICsga2V5YmluZGluZ1NlcnZpY2UuZ2V0RGVmYXVsdEtleWJpbmRpbmdzQ29udGVudCgpO1xufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdEtleWJpbmRpbmdzRWRpdG9yTW9kZWwgaW1wbGVtZW50cyBJS2V5YmluZGluZ3NFZGl0b3JNb2RlbDxhbnk+IHtcblxuXHRwcml2YXRlIF9jb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBfdXJpOiBVUkksXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UpIHtcblx0fVxuXG5cdGdldCB1cmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5fdXJpO1xuXHR9XG5cblx0Z2V0IGNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX2NvbnRlbnQpIHtcblx0XHRcdHRoaXMuX2NvbnRlbnQgPSBkZWZhdWx0S2V5YmluZGluZ3NDb250ZW50cyh0aGlzLmtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnQ7XG5cdH1cblxuXHRnZXRQcmVmZXJlbmNlKCk6IGFueSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdC8vIE5vdCBkaXNwb3NhYmxlXG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxlQUFzQjtBQUMvQixTQUFzQixhQUFhO0FBQ25DLFNBQVMsa0JBQThCO0FBRXZDLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxpQkFBaUI7QUFJMUIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMscUJBQXFCLDZCQUE2QjtBQUMzRCxTQUEwQyxvQkFBb0IsWUFBOEgsK0JBQStCO0FBQzNOLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQW9MLHdCQUF3QjtBQUM1TSxTQUFTLGVBQWUsd0JBQXdCO0FBQ2hELFNBQVMsdUJBQXVCO0FBRXpCLE1BQU0sWUFBb0IsRUFBRSxpQkFBaUIsSUFBSSxhQUFhLElBQUksZUFBZSxJQUFJLFdBQVcsR0FBRztBQUMxRyxTQUFTLFlBQVksT0FBd0I7QUFBRSxTQUFPLE1BQU0sb0JBQW9CLE1BQU0sTUFBTSxnQkFBZ0IsTUFBTSxNQUFNLGtCQUFrQixNQUFNLE1BQU0sY0FBYztBQUFJO0FBRXhLLE1BQWUsOEJBQThCLFlBQVk7QUFBQSxFQUF6RDtBQUFBO0FBRUMsU0FBVSx1QkFBdUIsb0JBQUksSUFBZ0M7QUFBQTtBQUFBLEVBRXJFLGtCQUFrQixJQUFZLGFBQXdFO0FBQ3JHLFFBQUksYUFBYTtBQUNoQixXQUFLLHFCQUFxQixJQUFJLElBQUksV0FBVztBQUFBLElBQzlDLE9BQU87QUFDTixXQUFLLHFCQUFxQixPQUFPLEVBQUU7QUFBQSxJQUNwQztBQUVBLFNBQUssdUJBQXVCO0FBQzVCLFdBQU8sS0FBSyxPQUFPO0FBQUEsRUFDcEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtRLHlCQUErQjtBQUN0QyxVQUFNLGNBQWMsb0JBQUksSUFBWTtBQUNwQyxLQUFDLEdBQUcsS0FBSyxxQkFBcUIsS0FBSyxDQUFDLEVBQ2xD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Z0IsS0FBSyxNQUFNO0FBQUEsRUFDNUM7QUFFRDtBQUVPLE1BQU0sc0NBQXNDLFdBQVc7QUFBQSxFQU83RCxZQUFvQixpQkFBa0M7QUFDckQsVUFBTTtBQURhO0FBTHBCLFNBQVEsV0FBMEI7QUFFbEMsU0FBaUIsdUJBQXVCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUMxRSxTQUFTLHNCQUFzQixLQUFLLHFCQUFxQjtBQUl4RCxTQUFLLFVBQVUsZ0JBQWdCLFlBQVksTUFBTTtBQUNoRCxXQUFLLFdBQVc7QUFDaEIsV0FBSyxxQkFBcUIsS0FBSztBQUFBLElBQ2hDLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLElBQUksVUFBa0I7QUFDckIsUUFBSSxLQUFLLGFBQWEsTUFBTTtBQUMzQixZQUFNLFVBQVUsSUFBSSwwQkFBMEI7QUFDOUMsY0FBUSxTQUFTLEdBQUc7QUFDcEIsaUJBQVcsaUJBQWlCLEtBQUssZ0JBQWdCLG9CQUFvQixHQUFHO0FBQ3ZFLGdCQUFRLFVBQVUsYUFBYTtBQUFBLE1BQ2hDO0FBQ0EsY0FBUSxTQUFTLEdBQUc7QUFDcEIsV0FBSyxXQUFXLFFBQVEsV0FBVztBQUFBLElBQ3BDO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUNEO0FBRUEsU0FBUyxxQkFBcUIsV0FBMkI7QUFDeEQsU0FBTyxhQUFhLFVBQ2xCLFFBQVEsT0FBTyxLQUFLLEVBQ3BCLFFBQVEsT0FBTyxLQUFLO0FBQ3ZCO0FBRU8sU0FBUywyQkFBMkIsbUJBQStDO0FBQ3pGLFFBQU0saUJBQWlCLFFBQVEsSUFBSSxTQUFTLDRCQUE0QixvRUFBb0U7QUFDNUksU0FBTyxpQkFBaUIsT0FBTyxrQkFBa0IsNkJBQTZCO0FBQy9FO0FBRU8sSUFBTSxnQ0FBTixNQUE0RTtBQUFBLEVBSWxGLFlBQW9CLE1BQ2tCLG1CQUF1QztBQUR6RDtBQUNrQjtBQUFBLEVBQ3RDO0FBQUEsRUFFQSxJQUFJLE1BQVc7QUFDZCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFVBQWtCO0FBQ3JCLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsV0FBSyxXQUFXLDJCQUEyQixLQUFLLGlCQUFpQjtBQUFBLElBQ2xFO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsZ0JBQXFCO0FBQ3BCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxVQUFnQjtBQUFBLEVBRWhCO0FBQ0Q7QUExQmEsZ0NBQU47QUFBQSxFQUtKO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFsia2V5Il0KfQo=
