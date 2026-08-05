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
import * as arrays from "../../../../base/common/arrays.js";
import { escapeRegExpCharacters, isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { isUndefinedOrNull } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { knownAcronyms, knownTermMappings, tocData } from "./settingsLayout.js";
import { ENABLE_EXTENSION_TOGGLE_SETTINGS, ENABLE_LANGUAGE_FILTER, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, compareTwoNullableNumbers } from "../common/preferences.js";
import { SettingMatchType, SettingValueType } from "../../../services/preferences/common/preferences.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { FOLDER_SCOPES, WORKSPACE_SCOPES, REMOTE_MACHINE_SCOPES, LOCAL_MACHINE_SCOPES, IWorkbenchConfigurationService, APPLICATION_SCOPES } from "../../../services/configuration/common/configuration.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { ConfigurationScope, EditPresentationTypes, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { USER_LOCAL_AND_REMOTE_SETTINGS } from "../../../../platform/request/common/request.js";
const ONLINE_SERVICES_SETTING_TAG = "usesOnlineServices";
class SettingsTreeElement extends Disposable {
  constructor(_id) {
    super();
    this._tabbable = false;
    this._onDidChangeTabbable = this._register(new Emitter());
    this.onDidChangeTabbable = this._onDidChangeTabbable.event;
    this.id = _id;
  }
  get tabbable() {
    return this._tabbable;
  }
  set tabbable(value) {
    this._tabbable = value;
    this._onDidChangeTabbable.fire();
  }
}
class SettingsTreeGroupElement extends SettingsTreeElement {
  constructor(_id, count, label, level, isFirstGroup) {
    super(_id);
    this._childSettingKeys = /* @__PURE__ */ new Set();
    this._children = [];
    this.count = count;
    this.label = label;
    this.level = level;
    this.isFirstGroup = isFirstGroup;
  }
  get children() {
    return this._children;
  }
  set children(newChildren) {
    this._children = newChildren;
    this._childSettingKeys = /* @__PURE__ */ new Set();
    this._children.forEach((child) => {
      if (child instanceof SettingsTreeSettingElement) {
        this._childSettingKeys.add(child.setting.key);
      }
    });
  }
  /**
   * Returns whether this group contains the given child key (to a depth of 1 only)
   */
  containsSetting(key) {
    return this._childSettingKeys.has(key);
  }
}
class SettingsTreeNewExtensionsElement extends SettingsTreeElement {
  constructor(_id, extensionIds) {
    super(_id);
    this.extensionIds = extensionIds;
  }
}
const _SettingsTreeSettingElement = class _SettingsTreeSettingElement extends SettingsTreeElement {
  constructor(setting, parent, settingsTarget, isWorkspaceTrusted, languageFilter, languageService, productService, userDataProfileService, configurationService) {
    super(sanitizeId(parent.id + "_" + setting.key));
    this.settingsTarget = settingsTarget;
    this.isWorkspaceTrusted = isWorkspaceTrusted;
    this.languageFilter = languageFilter;
    this.languageService = languageService;
    this.productService = productService;
    this.userDataProfileService = userDataProfileService;
    this.configurationService = configurationService;
    this._displayCategory = null;
    this._displayLabel = null;
    /**
     * Whether the setting is configured in the selected scope.
     */
    this.isConfigured = false;
    /**
     * Whether the setting requires trusted target
     */
    this.isUntrusted = false;
    /**
     * Whether the setting is under a policy that blocks all changes.
     */
    this.hasPolicyValue = false;
    this.overriddenScopeList = [];
    this.overriddenDefaultsLanguageList = [];
    /**
     * For each language that contributes setting values or default overrides, we can see those values here.
     */
    this.languageOverrideValues = /* @__PURE__ */ new Map();
    this.setting = setting;
    this.parent = parent;
    this.initSettingDescription();
    this.initSettingValueType();
  }
  get displayCategory() {
    if (!this._displayCategory) {
      this.initLabels();
    }
    return this._displayCategory;
  }
  get displayLabel() {
    if (!this._displayLabel) {
      this.initLabels();
    }
    return this._displayLabel;
  }
  initLabels() {
    if (this.setting.title) {
      this._displayLabel = this.setting.title;
      this._displayCategory = this.setting.categoryLabel ?? null;
      return;
    }
    const displayKeyFormat = settingKeyToDisplayFormat(this.setting.key, this.parent.id, this.setting.isLanguageTagSetting);
    this._displayLabel = displayKeyFormat.label;
    this._displayCategory = displayKeyFormat.category;
  }
  initSettingDescription() {
    if (this.setting.description.length > _SettingsTreeSettingElement.MAX_DESC_LINES) {
      const truncatedDescLines = this.setting.description.slice(0, _SettingsTreeSettingElement.MAX_DESC_LINES);
      truncatedDescLines.push("[...]");
      this.description = truncatedDescLines.join("\n");
    } else {
      this.description = this.setting.description.join("\n");
    }
  }
  initSettingValueType() {
    if (isExtensionToggleSetting(this.setting, this.productService)) {
      this.valueType = SettingValueType.ExtensionToggle;
    } else if (this.setting.enum && (!this.setting.type || settingTypeEnumRenderable(this.setting.type))) {
      this.valueType = SettingValueType.Enum;
    } else if (this.setting.type === "string") {
      if (this.setting.editPresentation === EditPresentationTypes.Multiline) {
        this.valueType = SettingValueType.MultilineString;
      } else {
        this.valueType = SettingValueType.String;
      }
    } else if (isExcludeSetting(this.setting)) {
      this.valueType = SettingValueType.Exclude;
    } else if (isIncludeSetting(this.setting)) {
      this.valueType = SettingValueType.Include;
    } else if (this.setting.type === "integer") {
      this.valueType = SettingValueType.Integer;
    } else if (this.setting.type === "number") {
      this.valueType = SettingValueType.Number;
    } else if (this.setting.type === "boolean") {
      this.valueType = SettingValueType.Boolean;
    } else if (this.setting.type === "array" && this.setting.arrayItemType && ["string", "enum", "number", "integer"].includes(this.setting.arrayItemType)) {
      this.valueType = SettingValueType.Array;
    } else if (Array.isArray(this.setting.type) && this.setting.type.includes(SettingValueType.Null) && this.setting.type.length === 2) {
      if (this.setting.type.includes(SettingValueType.Integer)) {
        this.valueType = SettingValueType.NullableInteger;
      } else if (this.setting.type.includes(SettingValueType.Number)) {
        this.valueType = SettingValueType.NullableNumber;
      } else {
        this.valueType = SettingValueType.Complex;
      }
    } else {
      const schemaType = getObjectSettingSchemaType(this.setting);
      if (schemaType) {
        if (this.setting.allKeysAreBoolean) {
          this.valueType = SettingValueType.BooleanObject;
        } else if (schemaType === "simple") {
          this.valueType = SettingValueType.Object;
        } else {
          this.valueType = SettingValueType.ComplexObject;
        }
      } else if (this.setting.isLanguageTagSetting) {
        this.valueType = SettingValueType.LanguageTag;
      } else {
        this.valueType = SettingValueType.Complex;
      }
    }
  }
  inspectSelf() {
    const targetToInspect = this.getTargetToInspect(this.setting);
    const inspectResult = inspectSetting(this.setting.key, targetToInspect, this.languageFilter, this.configurationService);
    this.update(inspectResult, this.isWorkspaceTrusted);
  }
  getTargetToInspect(setting) {
    if (!this.userDataProfileService.currentProfile.isDefault && !this.userDataProfileService.currentProfile.useDefaultFlags?.settings) {
      if (setting.scope === ConfigurationScope.APPLICATION) {
        return ConfigurationTarget.APPLICATION;
      }
      if (this.configurationService.isSettingAppliedForAllProfiles(setting.key) && this.settingsTarget === ConfigurationTarget.USER_LOCAL) {
        return ConfigurationTarget.APPLICATION;
      }
    }
    return this.settingsTarget;
  }
  update(inspectResult, isWorkspaceTrusted) {
    let { isConfigured, inspected, targetSelector, inspectedLanguageOverrides, languageSelector } = inspectResult;
    switch (targetSelector) {
      case "workspaceFolderValue":
      case "workspaceValue":
        this.isUntrusted = !!this.setting.restricted && !isWorkspaceTrusted;
        break;
    }
    let displayValue = isConfigured ? inspected[targetSelector] : inspected.defaultValue;
    const overriddenScopeList = [];
    const overriddenDefaultsLanguageList = [];
    if ((languageSelector || targetSelector !== "workspaceValue") && typeof inspected.workspaceValue !== "undefined") {
      overriddenScopeList.push("workspace:");
    }
    if ((languageSelector || targetSelector !== "userRemoteValue") && typeof inspected.userRemoteValue !== "undefined") {
      overriddenScopeList.push("remote:");
    }
    if ((languageSelector || targetSelector !== "userLocalValue") && typeof inspected.userLocalValue !== "undefined") {
      overriddenScopeList.push("user:");
    }
    if (inspected.overrideIdentifiers) {
      for (const overrideIdentifier of inspected.overrideIdentifiers) {
        const inspectedOverride = inspectedLanguageOverrides.get(overrideIdentifier);
        if (inspectedOverride) {
          if (this.languageService.isRegisteredLanguageId(overrideIdentifier)) {
            if (languageSelector !== overrideIdentifier && typeof inspectedOverride.default?.override !== "undefined") {
              overriddenDefaultsLanguageList.push(overrideIdentifier);
            }
            if ((languageSelector !== overrideIdentifier || targetSelector !== "workspaceValue") && typeof inspectedOverride.workspace?.override !== "undefined") {
              overriddenScopeList.push(`workspace:${overrideIdentifier}`);
            }
            if ((languageSelector !== overrideIdentifier || targetSelector !== "userRemoteValue") && typeof inspectedOverride.userRemote?.override !== "undefined") {
              overriddenScopeList.push(`remote:${overrideIdentifier}`);
            }
            if ((languageSelector !== overrideIdentifier || targetSelector !== "userLocalValue") && typeof inspectedOverride.userLocal?.override !== "undefined") {
              overriddenScopeList.push(`user:${overrideIdentifier}`);
            }
          }
          this.languageOverrideValues.set(overrideIdentifier, inspectedOverride);
        }
      }
    }
    this.overriddenScopeList = overriddenScopeList;
    this.overriddenDefaultsLanguageList = overriddenDefaultsLanguageList;
    this.defaultValueSource = this.setting.nonLanguageSpecificDefaultValueSource;
    if (inspected.policyValue !== void 0) {
      this.hasPolicyValue = true;
      isConfigured = false;
      displayValue = inspected.policyValue;
      this.scopeValue = inspected.policyValue;
      this.defaultValue = inspected.defaultValue;
    } else if (languageSelector && this.languageOverrideValues.has(languageSelector)) {
      const overrideValues = this.languageOverrideValues.get(languageSelector);
      displayValue = (isConfigured ? overrideValues[targetSelector] : overrideValues.defaultValue) ?? displayValue;
      this.scopeValue = isConfigured && overrideValues[targetSelector];
      this.defaultValue = overrideValues.defaultValue ?? inspected.defaultValue;
      const registryValues = Registry.as(Extensions.Configuration).getConfigurationDefaultsOverrides();
      const source = registryValues.get(`[${languageSelector}]`)?.source;
      const overrideValueSource = source instanceof Map ? source.get(this.setting.key) : void 0;
      if (overrideValueSource) {
        this.defaultValueSource = overrideValueSource;
      }
    } else {
      this.scopeValue = isConfigured && inspected[targetSelector];
      this.defaultValue = inspected.defaultValue;
    }
    this.value = displayValue;
    this.isConfigured = isConfigured;
    if (isConfigured || this.setting.tags || this.tags || this.setting.restricted || this.hasPolicyValue) {
      this.tags = /* @__PURE__ */ new Set();
      if (isConfigured) {
        this.tags.add(MODIFIED_SETTING_TAG);
      }
      this.setting.tags?.forEach((tag) => this.tags.add(tag));
      if (this.setting.restricted) {
        this.tags.add(REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG);
      }
      if (this.hasPolicyValue) {
        this.tags.add(POLICY_SETTING_TAG);
      }
    }
  }
  matchesAllTags(tagFilters) {
    if (!tagFilters?.size) {
      return true;
    }
    if (!this.tags) {
      this.inspectSelf();
    }
    return !!this.tags?.size && Array.from(tagFilters).every((tag) => this.tags.has(tag));
  }
  matchesScope(scope, isRemote) {
    const configTarget = URI.isUri(scope) ? ConfigurationTarget.WORKSPACE_FOLDER : scope;
    if (!this.setting.scope) {
      return true;
    }
    if (configTarget === ConfigurationTarget.APPLICATION) {
      return APPLICATION_SCOPES.includes(this.setting.scope);
    }
    if (configTarget === ConfigurationTarget.WORKSPACE_FOLDER) {
      return FOLDER_SCOPES.includes(this.setting.scope);
    }
    if (configTarget === ConfigurationTarget.WORKSPACE) {
      return WORKSPACE_SCOPES.includes(this.setting.scope);
    }
    if (configTarget === ConfigurationTarget.USER_REMOTE) {
      return REMOTE_MACHINE_SCOPES.includes(this.setting.scope) || USER_LOCAL_AND_REMOTE_SETTINGS.includes(this.setting.key);
    }
    if (configTarget === ConfigurationTarget.USER_LOCAL) {
      if (isRemote) {
        return LOCAL_MACHINE_SCOPES.includes(this.setting.scope) || USER_LOCAL_AND_REMOTE_SETTINGS.includes(this.setting.key);
      }
    }
    return true;
  }
  matchesAnyExtension(extensionFilters) {
    if (!extensionFilters || !extensionFilters.size) {
      return true;
    }
    if (!this.setting.extensionInfo) {
      return false;
    }
    return Array.from(extensionFilters).some((extensionId) => extensionId.toLowerCase() === this.setting.extensionInfo.id.toLowerCase());
  }
  matchesAnyFeature(featureFilters) {
    if (!featureFilters || !featureFilters.size) {
      return true;
    }
    const features = tocData.children.find((child) => child.id === "features");
    return Array.from(featureFilters).some((filter) => {
      if (features && features.children) {
        const feature = features.children.find((feature2) => "features/" + filter === feature2.id);
        if (feature) {
          const patterns = feature.settings?.map((setting) => createSettingMatchRegExp(setting));
          return patterns && !this.setting.extensionInfo && patterns.some((pattern) => pattern.test(this.setting.key.toLowerCase()));
        } else {
          return false;
        }
      } else {
        return false;
      }
    });
  }
  matchesAnyId(idFilters) {
    if (!idFilters || !idFilters.size) {
      return true;
    }
    return idFilters.has(this.setting.key);
  }
  matchesAllLanguages(languageFilter) {
    if (!languageFilter) {
      return true;
    }
    if (!this.languageService.isRegisteredLanguageId(languageFilter)) {
      return false;
    }
    if (this.setting.scope === ConfigurationScope.LANGUAGE_OVERRIDABLE) {
      return true;
    }
    return false;
  }
};
_SettingsTreeSettingElement.MAX_DESC_LINES = 20;
let SettingsTreeSettingElement = _SettingsTreeSettingElement;
function createSettingMatchRegExp(pattern) {
  pattern = escapeRegExpCharacters(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${pattern}$`, "i");
}
let SettingsTreeModel = class {
  constructor(_viewState, _isWorkspaceTrusted, _configurationService, _languageService, _userDataProfileService, _productService) {
    this._viewState = _viewState;
    this._isWorkspaceTrusted = _isWorkspaceTrusted;
    this._configurationService = _configurationService;
    this._languageService = _languageService;
    this._userDataProfileService = _userDataProfileService;
    this._productService = _productService;
    this._treeElementsBySettingName = /* @__PURE__ */ new Map();
  }
  get root() {
    return this._root;
  }
  update(newTocRoot = this._tocRoot) {
    this._treeElementsBySettingName.clear();
    const newRoot = this.createSettingsTreeGroupElement(newTocRoot);
    if (newRoot.children[0] instanceof SettingsTreeGroupElement) {
      newRoot.children[0].isFirstGroup = true;
    }
    if (this._root) {
      this.disposeChildren(this._root.children);
      this._root.children = newRoot.children;
      newRoot.dispose();
    } else {
      this._root = newRoot;
    }
  }
  updateWorkspaceTrust(workspaceTrusted) {
    this._isWorkspaceTrusted = workspaceTrusted;
    this.updateRequireTrustedTargetElements();
  }
  disposeChildren(children) {
    for (const child of children) {
      this.disposeChildAndRecurse(child);
    }
  }
  disposeChildAndRecurse(element) {
    if (element instanceof SettingsTreeGroupElement) {
      this.disposeChildren(element.children);
    }
    element.dispose();
  }
  getElementsByName(name) {
    return this._treeElementsBySettingName.get(name) ?? null;
  }
  updateElementsByName(name) {
    if (!this._treeElementsBySettingName.has(name)) {
      return;
    }
    this.reinspectSettings(this._treeElementsBySettingName.get(name));
  }
  updateRequireTrustedTargetElements() {
    this.reinspectSettings([...this._treeElementsBySettingName.values()].flat().filter((s) => s.isUntrusted));
  }
  reinspectSettings(settings) {
    for (const element of settings) {
      element.inspectSelf();
    }
  }
  createSettingsTreeGroupElement(tocEntry, parent) {
    const depth = parent ? this.getDepth(parent) + 1 : 0;
    const element = new SettingsTreeGroupElement(tocEntry.id, void 0, tocEntry.label, depth, false);
    element.parent = parent;
    const children = [];
    if (tocEntry.settings) {
      const settingChildren = tocEntry.settings.map((s) => this.createSettingsTreeSettingElement(s, element));
      for (const child of settingChildren) {
        if (!child.setting.deprecationMessage) {
          children.push(child);
        } else {
          child.inspectSelf();
          if (child.isConfigured) {
            children.push(child);
          } else {
            child.dispose();
          }
        }
      }
    }
    if (tocEntry.children) {
      const groupChildren = tocEntry.children.map((child) => this.createSettingsTreeGroupElement(child, element));
      children.push(...groupChildren);
    }
    element.children = children;
    return element;
  }
  getDepth(element) {
    if (element.parent) {
      return 1 + this.getDepth(element.parent);
    } else {
      return 0;
    }
  }
  createSettingsTreeSettingElement(setting, parent) {
    const element = new SettingsTreeSettingElement(
      setting,
      parent,
      this._viewState.settingsTarget,
      this._isWorkspaceTrusted,
      this._viewState.languageFilter,
      this._languageService,
      this._productService,
      this._userDataProfileService,
      this._configurationService
    );
    const nameElements = this._treeElementsBySettingName.get(setting.key) ?? [];
    nameElements.push(element);
    this._treeElementsBySettingName.set(setting.key, nameElements);
    return element;
  }
  dispose() {
    this._treeElementsBySettingName.clear();
    this.disposeChildAndRecurse(this._root);
  }
};
SettingsTreeModel = __decorateClass([
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IUserDataProfileService),
  __decorateParam(5, IProductService)
], SettingsTreeModel);
function inspectSetting(key, target, languageFilter, configurationService) {
  const inspectOverrides = URI.isUri(target) ? { resource: target } : void 0;
  const inspected = configurationService.inspect(key, inspectOverrides);
  const targetSelector = target === ConfigurationTarget.APPLICATION ? "applicationValue" : target === ConfigurationTarget.USER_LOCAL ? "userLocalValue" : target === ConfigurationTarget.USER_REMOTE ? "userRemoteValue" : target === ConfigurationTarget.WORKSPACE ? "workspaceValue" : "workspaceFolderValue";
  const targetOverrideSelector = target === ConfigurationTarget.APPLICATION ? "application" : target === ConfigurationTarget.USER_LOCAL ? "userLocal" : target === ConfigurationTarget.USER_REMOTE ? "userRemote" : target === ConfigurationTarget.WORKSPACE ? "workspace" : "workspaceFolder";
  let isConfigured = typeof inspected[targetSelector] !== "undefined";
  const overrideIdentifiers = inspected.overrideIdentifiers;
  const inspectedLanguageOverrides = /* @__PURE__ */ new Map();
  if (languageFilter) {
    isConfigured = false;
  }
  if (overrideIdentifiers) {
    for (const overrideIdentifier of overrideIdentifiers) {
      inspectedLanguageOverrides.set(overrideIdentifier, configurationService.inspect(key, { overrideIdentifier }));
    }
    if (languageFilter) {
      if (inspectedLanguageOverrides.has(languageFilter)) {
        const overrideValue = inspectedLanguageOverrides.get(languageFilter)[targetOverrideSelector]?.override;
        if (typeof overrideValue !== "undefined") {
          isConfigured = true;
        }
      }
    }
  }
  return { isConfigured, inspected, targetSelector, inspectedLanguageOverrides, languageSelector: languageFilter };
}
function sanitizeId(id) {
  return id.replace(/[\.\/]/, "_");
}
function settingKeyToDisplayFormat(key, groupId = "", isLanguageTagSetting = false) {
  const lastDotIdx = key.lastIndexOf(".");
  let category = "";
  if (lastDotIdx >= 0) {
    category = key.substring(0, lastDotIdx);
    key = key.substring(lastDotIdx + 1);
  }
  groupId = groupId.replace(/\//g, ".");
  category = trimCategoryForGroup(category, groupId);
  category = wordifyKey(category);
  if (isLanguageTagSetting) {
    key = key.replace(/[\[\]]/g, "");
    key = "$(bracket) " + key;
  }
  const label = wordifyKey(key);
  return { category, label };
}
function wordifyKey(key) {
  key = key.replace(/\.([a-z0-9])/g, (_, p1) => ` \u203A ${p1.toUpperCase()}`).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^[a-z]/g, (match) => match.toUpperCase()).replace(/\b\w+\b/g, (match) => {
    return knownAcronyms.has(match.toLowerCase()) ? match.toUpperCase() : match;
  });
  for (const [k, v] of knownTermMappings) {
    key = key.replace(new RegExp(`\\b${k}\\b`, "gi"), v);
  }
  return key;
}
function trimCategoryForGroup(category, groupId) {
  const doTrim = (forward) => {
    if (!/insiders$/i.test(category)) {
      groupId = groupId.replace(/-?insiders$/i, "");
    }
    const parts = groupId.split(".").map((part) => {
      if (part.replace(/-/g, "").toLowerCase() === category.toLowerCase()) {
        return part.replace(/-/g, "");
      } else {
        return part;
      }
    });
    while (parts.length) {
      const reg = new RegExp(`^${parts.join("\\.")}(\\.|$)`, "i");
      if (reg.test(category)) {
        return category.replace(reg, "");
      }
      if (forward) {
        parts.pop();
      } else {
        parts.shift();
      }
    }
    return null;
  };
  let trimmed = doTrim(true);
  if (trimmed === null) {
    trimmed = doTrim(false);
  }
  if (trimmed === null) {
    trimmed = category;
  }
  return trimmed;
}
function isExtensionToggleSetting(setting, productService) {
  return ENABLE_EXTENSION_TOGGLE_SETTINGS && !!productService.extensionRecommendations && !!setting.displayExtensionId;
}
function isExcludeSetting(setting) {
  return setting.key === "files.exclude" || setting.key === "search.exclude" || setting.key === "workbench.localHistory.exclude" || setting.key === "explorer.autoRevealExclude" || setting.key === "files.readonlyExclude" || setting.key === "files.watcherExclude";
}
function isIncludeSetting(setting) {
  return setting.key === "files.readonlyInclude";
}
function objectSettingSupportsRemoveDefaultValue(key) {
  return key === "workbench.editor.customLabels.patterns";
}
function isSimpleType(type) {
  return type === "string" || type === "boolean" || type === "integer" || type === "number";
}
function getObjectRenderableSchemaType(schema, key) {
  const { type } = schema;
  if (Array.isArray(type)) {
    if (objectSettingSupportsRemoveDefaultValue(key) && type.length === 2) {
      if (type.includes("null") && (type.includes("string") || type.includes("boolean") || type.includes("integer") || type.includes("number"))) {
        return "simple";
      }
    }
    for (const t of type) {
      if (!isSimpleType(t)) {
        return false;
      }
    }
    return "complex";
  }
  if (isSimpleType(type)) {
    return "simple";
  }
  if (type === "array") {
    if (schema.items) {
      const itemSchemas = Array.isArray(schema.items) ? schema.items : [schema.items];
      for (const { type: type2 } of itemSchemas) {
        if (Array.isArray(type2)) {
          for (const t of type2) {
            if (!isSimpleType(t)) {
              return false;
            }
          }
          return "complex";
        }
        if (!isSimpleType(type2)) {
          return false;
        }
        return "complex";
      }
    }
    return false;
  }
  return false;
}
function getObjectSettingSchemaType({
  key,
  type,
  objectProperties,
  objectPatternProperties,
  objectAdditionalProperties
}) {
  if (type !== "object") {
    return false;
  }
  if (isUndefinedOrNull(objectProperties) && isUndefinedOrNull(objectPatternProperties) && isUndefinedOrNull(objectAdditionalProperties)) {
    return false;
  }
  if ((objectAdditionalProperties === true || objectAdditionalProperties === void 0) && !Object.keys(objectPatternProperties ?? {}).includes(".*")) {
    return false;
  }
  const schemas = [...Object.values(objectProperties ?? {}), ...Object.values(objectPatternProperties ?? {})];
  if (objectAdditionalProperties && typeof objectAdditionalProperties === "object") {
    schemas.push(objectAdditionalProperties);
  }
  let schemaType = "simple";
  for (const schema of schemas) {
    for (const subSchema of Array.isArray(schema.anyOf) ? schema.anyOf : [schema]) {
      const subSchemaType = getObjectRenderableSchemaType(subSchema, key);
      if (subSchemaType === false) {
        return false;
      }
      if (subSchemaType === "complex") {
        schemaType = "complex";
      }
    }
  }
  return schemaType;
}
function settingTypeEnumRenderable(_type) {
  const enumRenderableSettingTypes = ["string", "boolean", "null", "integer", "number"];
  const type = Array.isArray(_type) ? _type : [_type];
  return type.every((type2) => enumRenderableSettingTypes.includes(type2));
}
var SearchResultIdx = /* @__PURE__ */ ((SearchResultIdx2) => {
  SearchResultIdx2[SearchResultIdx2["Local"] = 0] = "Local";
  SearchResultIdx2[SearchResultIdx2["Remote"] = 1] = "Remote";
  SearchResultIdx2[SearchResultIdx2["NewExtensions"] = 2] = "NewExtensions";
  return SearchResultIdx2;
})(SearchResultIdx || {});
let SearchResultModel = class extends SettingsTreeModel {
  constructor(viewState, settingsOrderByTocIndex, isWorkspaceTrusted, configurationService, environmentService, languageService, userDataProfileService, productService) {
    super(viewState, isWorkspaceTrusted, configurationService, languageService, userDataProfileService, productService);
    this.environmentService = environmentService;
    this.rawSearchResults = null;
    this.cachedUniqueSearchResults = null;
    this.newExtensionSearchResults = null;
    this.searchResultCount = null;
    this.id = "searchResultModel";
    this.settingsOrderByTocIndex = settingsOrderByTocIndex;
    this.update({ id: "searchResultModel", label: "" });
  }
  sortResults(filterMatches) {
    if (this.settingsOrderByTocIndex) {
      for (const match of filterMatches) {
        match.setting.internalOrder = this.settingsOrderByTocIndex.get(match.setting.key);
      }
    }
    if (!this._viewState.query) {
      return filterMatches.sort((a, b) => compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder));
    }
    filterMatches.sort((a, b) => {
      if (a.matchType !== b.matchType) {
        return b.matchType - a.matchType;
      } else if (a.matchType & SettingMatchType.NonContiguousWordsInSettingsLabel || a.matchType & SettingMatchType.ContiguousWordsInSettingsLabel) {
        return b.keyMatchScore - a.keyMatchScore || compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder);
      } else if (a.matchType === SettingMatchType.RemoteMatch) {
        return b.score - a.score;
      } else {
        return compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder);
      }
    });
    return arrays.distinct(filterMatches, (match) => match.setting.key);
  }
  getUniqueResults() {
    if (this.cachedUniqueSearchResults) {
      return this.cachedUniqueSearchResults;
    }
    if (!this.rawSearchResults) {
      return null;
    }
    let combinedFilterMatches = [];
    const localMatchKeys = /* @__PURE__ */ new Set();
    const localResult = this.rawSearchResults[0 /* Local */];
    if (localResult) {
      localResult.filterMatches.forEach((m) => localMatchKeys.add(m.setting.key));
      combinedFilterMatches = localResult.filterMatches;
    }
    const remoteResult = this.rawSearchResults[1 /* Remote */];
    if (remoteResult) {
      remoteResult.filterMatches = remoteResult.filterMatches.filter((m) => !localMatchKeys.has(m.setting.key));
      combinedFilterMatches = combinedFilterMatches.concat(remoteResult.filterMatches);
      this.newExtensionSearchResults = this.rawSearchResults[2 /* NewExtensions */];
    }
    combinedFilterMatches = this.sortResults(combinedFilterMatches);
    this.cachedUniqueSearchResults = {
      filterMatches: combinedFilterMatches,
      exactMatch: localResult.exactMatch
      // remote results should never have an exact match
    };
    return this.cachedUniqueSearchResults;
  }
  getRawResults() {
    return this.rawSearchResults ?? [];
  }
  setResult(order, result) {
    this.cachedUniqueSearchResults = null;
    this.newExtensionSearchResults = null;
    this.rawSearchResults ??= [];
    if (!result) {
      delete this.rawSearchResults[order];
      return;
    }
    this.rawSearchResults[order] = result;
    this.updateChildren();
  }
  updateChildren() {
    this.update({
      id: "searchResultModel",
      label: "searchResultModel",
      settings: this.getFlatSettings()
    });
    const isRemote = !!this.environmentService.remoteAuthority;
    const newChildren = [];
    for (const child of this.root.children) {
      if (child instanceof SettingsTreeSettingElement && child.matchesAllTags(this._viewState.tagFilters) && child.matchesScope(this._viewState.settingsTarget, isRemote) && child.matchesAnyExtension(this._viewState.extensionFilters) && child.matchesAnyId(this._viewState.idFilters) && child.matchesAnyFeature(this._viewState.featureFilters) && child.matchesAllLanguages(this._viewState.languageFilter)) {
        newChildren.push(child);
      } else {
        child.dispose();
      }
    }
    this.root.children = newChildren;
    this.searchResultCount = this.root.children.length;
    if (this.newExtensionSearchResults?.filterMatches.length) {
      let resultExtensionIds = this.newExtensionSearchResults.filterMatches.map((result) => result.setting).filter((setting) => setting.extensionName && setting.extensionPublisher).map((setting) => `${setting.extensionPublisher}.${setting.extensionName}`);
      resultExtensionIds = arrays.distinct(resultExtensionIds);
      if (resultExtensionIds.length) {
        const newExtElement = new SettingsTreeNewExtensionsElement("newExtensions", resultExtensionIds);
        newExtElement.parent = this._root;
        this._root.children.push(newExtElement);
      }
    }
  }
  getUniqueResultsCount() {
    return this.searchResultCount ?? 0;
  }
  getFlatSettings() {
    return this.getUniqueResults()?.filterMatches.map((m) => m.setting) ?? [];
  }
};
SearchResultModel = __decorateClass([
  __decorateParam(3, IWorkbenchConfigurationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IUserDataProfileService),
  __decorateParam(7, IProductService)
], SearchResultModel);
const tagRegex = /(^|\s)@tag:("([^"]*)"|[^"]\S*)/g;
const extensionRegex = /(^|\s)@ext:("([^"]*)"|[^"]\S*)?/g;
const featureRegex = /(^|\s)@feature:("([^"]*)"|[^"]\S*)?/g;
const idRegex = /(^|\s)@id:("([^"]*)"|[^"]\S*)?/g;
const languageRegex = /(^|\s)@lang:("([^"]*)"|[^"]\S*)?/g;
function parseQuery(query) {
  function getTagsForType(query2, filterRegex, parsedParts) {
    return query2.replace(filterRegex, (_, __, quotedParsedElement, unquotedParsedElement) => {
      const parsedElement = unquotedParsedElement || quotedParsedElement;
      if (parsedElement) {
        parsedParts.push(...parsedElement.split(",").map((s) => s.trim()).filter((s) => !isFalsyOrWhitespace(s)));
      }
      return "";
    });
  }
  const tags = [];
  query = query.replace(tagRegex, (_, __, quotedTag, tag) => {
    tags.push(tag || quotedTag);
    return "";
  });
  query = query.replace(`@${MODIFIED_SETTING_TAG}`, () => {
    tags.push(MODIFIED_SETTING_TAG);
    return "";
  });
  query = query.replace(`@${POLICY_SETTING_TAG}`, () => {
    tags.push(POLICY_SETTING_TAG);
    return "";
  });
  const extensions = [];
  const features = [];
  const ids = [];
  const langs = [];
  query = getTagsForType(query, extensionRegex, extensions);
  query = getTagsForType(query, featureRegex, features);
  query = getTagsForType(query, idRegex, ids);
  if (ENABLE_LANGUAGE_FILTER) {
    query = getTagsForType(query, languageRegex, langs);
  }
  query = query.trim();
  return {
    tags,
    extensionFilters: extensions,
    featureFilters: features,
    idFilters: ids,
    languageFilter: langs.length ? langs[0] : void 0,
    query
  };
}
export {
  ONLINE_SERVICES_SETTING_TAG,
  SearchResultIdx,
  SearchResultModel,
  SettingsTreeElement,
  SettingsTreeGroupElement,
  SettingsTreeModel,
  SettingsTreeNewExtensionsElement,
  SettingsTreeSettingElement,
  inspectSetting,
  objectSettingSupportsRemoveDefaultValue,
  parseQuery,
  settingKeyToDisplayFormat
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzVHJlZU1vZGVscy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFycmF5cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgZXNjYXBlUmVnRXhwQ2hhcmFjdGVycywgaXNGYWxzeU9yV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWRPck51bGwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25WYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NUYXJnZXQgfSBmcm9tICcuL3ByZWZlcmVuY2VzV2lkZ2V0cy5qcyc7XG5pbXBvcnQgeyBJVE9DRW50cnksIGtub3duQWNyb255bXMsIGtub3duVGVybU1hcHBpbmdzLCB0b2NEYXRhIH0gZnJvbSAnLi9zZXR0aW5nc0xheW91dC5qcyc7XG5pbXBvcnQgeyBFTkFCTEVfRVhURU5TSU9OX1RPR0dMRV9TRVRUSU5HUywgRU5BQkxFX0xBTkdVQUdFX0ZJTFRFUiwgTU9ESUZJRURfU0VUVElOR19UQUcsIFBPTElDWV9TRVRUSU5HX1RBRywgUkVRVUlSRV9UUlVTVEVEX1dPUktTUEFDRV9TRVRUSU5HX1RBRywgY29tcGFyZVR3b051bGxhYmxlTnVtYmVycyB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2V0dGluZywgSVNlYXJjaFJlc3VsdCwgSVNldHRpbmcsIElTZXR0aW5nTWF0Y2gsIFNldHRpbmdNYXRjaFR5cGUsIFNldHRpbmdWYWx1ZVR5cGUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRk9MREVSX1NDT1BFUywgV09SS1NQQUNFX1NDT1BFUywgUkVNT1RFX01BQ0hJTkVfU0NPUEVTLCBMT0NBTF9NQUNISU5FX1NDT1BFUywgSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBBUFBMSUNBVElPTl9TQ09QRVMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbkRlZmF1bHRWYWx1ZVNvdXJjZSwgQ29uZmlndXJhdGlvblNjb3BlLCBFZGl0UHJlc2VudGF0aW9uVHlwZXMsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVNFUl9MT0NBTF9BTkRfUkVNT1RFX1NFVFRJTkdTIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5cbmV4cG9ydCBjb25zdCBPTkxJTkVfU0VSVklDRVNfU0VUVElOR19UQUcgPSAndXNlc09ubGluZVNlcnZpY2VzJztcblxuZXhwb3J0IGludGVyZmFjZSBJU2V0dGluZ3NFZGl0b3JWaWV3U3RhdGUge1xuXHRzZXR0aW5nc1RhcmdldDogU2V0dGluZ3NUYXJnZXQ7XG5cdHF1ZXJ5Pzogc3RyaW5nOyAvLyB1c2VkIHRvIGtlZXAgdHJhY2sgb2YgbG9hZGluZyBmcm9tIHNldElucHV0IHZzIGxvYWRpbmcgZnJvbSBjYWNoZVxuXHR0YWdGaWx0ZXJzPzogU2V0PHN0cmluZz47XG5cdGV4dGVuc2lvbkZpbHRlcnM/OiBTZXQ8c3RyaW5nPjtcblx0ZmVhdHVyZUZpbHRlcnM/OiBTZXQ8c3RyaW5nPjtcblx0aWRGaWx0ZXJzPzogU2V0PHN0cmluZz47XG5cdGxhbmd1YWdlRmlsdGVyPzogc3RyaW5nO1xuXHRmaWx0ZXJUb0NhdGVnb3J5PzogU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50O1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgU2V0dGluZ3NUcmVlRWxlbWVudCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRpZDogc3RyaW5nO1xuXHRwYXJlbnQ/OiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfdGFiYmFibGUgPSBmYWxzZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRhYmJhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGFiYmFibGUgPSB0aGlzLl9vbkRpZENoYW5nZVRhYmJhYmxlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKF9pZDogc3RyaW5nKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmlkID0gX2lkO1xuXHR9XG5cblx0Z2V0IHRhYmJhYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl90YWJiYWJsZTtcblx0fVxuXG5cdHNldCB0YWJiYWJsZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX3RhYmJhYmxlID0gdmFsdWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUYWJiYWJsZS5maXJlKCk7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgU2V0dGluZ3NUcmVlR3JvdXBDaGlsZCA9IChTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQgfCBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCB8IFNldHRpbmdzVHJlZU5ld0V4dGVuc2lvbnNFbGVtZW50KTtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCBleHRlbmRzIFNldHRpbmdzVHJlZUVsZW1lbnQge1xuXHRjb3VudD86IG51bWJlcjtcblx0bGFiZWw6IHN0cmluZztcblx0bGV2ZWw6IG51bWJlcjtcblx0aXNGaXJzdEdyb3VwOiBib29sZWFuO1xuXG5cdHByaXZhdGUgX2NoaWxkU2V0dGluZ0tleXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRwcml2YXRlIF9jaGlsZHJlbjogU2V0dGluZ3NUcmVlR3JvdXBDaGlsZFtdID0gW107XG5cblx0Z2V0IGNoaWxkcmVuKCk6IFNldHRpbmdzVHJlZUdyb3VwQ2hpbGRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuO1xuXHR9XG5cblx0c2V0IGNoaWxkcmVuKG5ld0NoaWxkcmVuOiBTZXR0aW5nc1RyZWVHcm91cENoaWxkW10pIHtcblx0XHR0aGlzLl9jaGlsZHJlbiA9IG5ld0NoaWxkcmVuO1xuXG5cdFx0dGhpcy5fY2hpbGRTZXR0aW5nS2V5cyA9IG5ldyBTZXQoKTtcblx0XHR0aGlzLl9jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcblx0XHRcdGlmIChjaGlsZCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMuX2NoaWxkU2V0dGluZ0tleXMuYWRkKGNoaWxkLnNldHRpbmcua2V5KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKF9pZDogc3RyaW5nLCBjb3VudDogbnVtYmVyIHwgdW5kZWZpbmVkLCBsYWJlbDogc3RyaW5nLCBsZXZlbDogbnVtYmVyLCBpc0ZpcnN0R3JvdXA6IGJvb2xlYW4pIHtcblx0XHRzdXBlcihfaWQpO1xuXG5cdFx0dGhpcy5jb3VudCA9IGNvdW50O1xuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLmxldmVsID0gbGV2ZWw7XG5cdFx0dGhpcy5pc0ZpcnN0R3JvdXAgPSBpc0ZpcnN0R3JvdXA7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB3aGV0aGVyIHRoaXMgZ3JvdXAgY29udGFpbnMgdGhlIGdpdmVuIGNoaWxkIGtleSAodG8gYSBkZXB0aCBvZiAxIG9ubHkpXG5cdCAqL1xuXHRjb250YWluc1NldHRpbmcoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hpbGRTZXR0aW5nS2V5cy5oYXMoa2V5KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUcmVlTmV3RXh0ZW5zaW9uc0VsZW1lbnQgZXh0ZW5kcyBTZXR0aW5nc1RyZWVFbGVtZW50IHtcblx0Y29uc3RydWN0b3IoX2lkOiBzdHJpbmcsIHB1YmxpYyByZWFkb25seSBleHRlbnNpb25JZHM6IHN0cmluZ1tdKSB7XG5cdFx0c3VwZXIoX2lkKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQgZXh0ZW5kcyBTZXR0aW5nc1RyZWVFbGVtZW50IHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUFYX0RFU0NfTElORVMgPSAyMDtcblxuXHRzZXR0aW5nOiBJU2V0dGluZztcblxuXHRwcml2YXRlIF9kaXNwbGF5Q2F0ZWdvcnk6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9kaXNwbGF5TGFiZWw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdC8qKlxuXHQgKiBzY29wZVZhbHVlIHx8IGRlZmF1bHRWYWx1ZSwgZm9yIHJlbmRlcmluZyBjb252ZW5pZW5jZS5cblx0ICovXG5cdHZhbHVlOiBhbnk7XG5cblx0LyoqXG5cdCAqIFRoZSB2YWx1ZSBpbiB0aGUgY3VycmVudCBzZXR0aW5ncyBzY29wZS5cblx0ICovXG5cdHNjb3BlVmFsdWU6IGFueTtcblxuXHQvKipcblx0ICogVGhlIGRlZmF1bHQgdmFsdWVcblx0ICovXG5cdGRlZmF1bHRWYWx1ZT86IGFueTtcblxuXHQvKipcblx0ICogVGhlIHNvdXJjZSBvZiB0aGUgZGVmYXVsdCB2YWx1ZSB0byBkaXNwbGF5LlxuXHQgKiBUaGlzIHZhbHVlIGFsc28gYWNjb3VudHMgZm9yIGV4dGVuc2lvbi1jb250cmlidXRlZCBsYW5ndWFnZS1zcGVjaWZpYyBkZWZhdWx0IHZhbHVlIG92ZXJyaWRlcy5cblx0ICovXG5cdGRlZmF1bHRWYWx1ZVNvdXJjZTogQ29uZmlndXJhdGlvbkRlZmF1bHRWYWx1ZVNvdXJjZSB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgc2V0dGluZyBpcyBjb25maWd1cmVkIGluIHRoZSBzZWxlY3RlZCBzY29wZS5cblx0ICovXG5cdGlzQ29uZmlndXJlZCA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSBzZXR0aW5nIHJlcXVpcmVzIHRydXN0ZWQgdGFyZ2V0XG5cdCAqL1xuXHRpc1VudHJ1c3RlZCA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSBzZXR0aW5nIGlzIHVuZGVyIGEgcG9saWN5IHRoYXQgYmxvY2tzIGFsbCBjaGFuZ2VzLlxuXHQgKi9cblx0aGFzUG9saWN5VmFsdWUgPSBmYWxzZTtcblxuXHR0YWdzPzogU2V0PHN0cmluZz47XG5cdG92ZXJyaWRkZW5TY29wZUxpc3Q6IHN0cmluZ1tdID0gW107XG5cdG92ZXJyaWRkZW5EZWZhdWx0c0xhbmd1YWdlTGlzdDogc3RyaW5nW10gPSBbXTtcblxuXHQvKipcblx0ICogRm9yIGVhY2ggbGFuZ3VhZ2UgdGhhdCBjb250cmlidXRlcyBzZXR0aW5nIHZhbHVlcyBvciBkZWZhdWx0IG92ZXJyaWRlcywgd2UgY2FuIHNlZSB0aG9zZSB2YWx1ZXMgaGVyZS5cblx0ICovXG5cdGxhbmd1YWdlT3ZlcnJpZGVWYWx1ZXM6IE1hcDxzdHJpbmcsIElDb25maWd1cmF0aW9uVmFsdWU8dW5rbm93bj4+ID0gbmV3IE1hcDxzdHJpbmcsIElDb25maWd1cmF0aW9uVmFsdWU8dW5rbm93bj4+KCk7XG5cblx0ZGVzY3JpcHRpb24hOiBzdHJpbmc7XG5cdHZhbHVlVHlwZSE6IFNldHRpbmdWYWx1ZVR5cGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0c2V0dGluZzogSVNldHRpbmcsXG5cdFx0cGFyZW50OiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgc2V0dGluZ3NUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaXNXb3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGaWx0ZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHNhbml0aXplSWQocGFyZW50LmlkICsgJ18nICsgc2V0dGluZy5rZXkpKTtcblx0XHR0aGlzLnNldHRpbmcgPSBzZXR0aW5nO1xuXHRcdHRoaXMucGFyZW50ID0gcGFyZW50O1xuXG5cdFx0Ly8gTWFrZSBzdXJlIGRlc2NyaXB0aW9uIGFuZCB2YWx1ZVR5cGUgYXJlIGluaXRpYWxpemVkXG5cdFx0dGhpcy5pbml0U2V0dGluZ0Rlc2NyaXB0aW9uKCk7XG5cdFx0dGhpcy5pbml0U2V0dGluZ1ZhbHVlVHlwZSgpO1xuXHR9XG5cblx0Z2V0IGRpc3BsYXlDYXRlZ29yeSgpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5fZGlzcGxheUNhdGVnb3J5KSB7XG5cdFx0XHR0aGlzLmluaXRMYWJlbHMoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZGlzcGxheUNhdGVnb3J5ITtcblx0fVxuXG5cdGdldCBkaXNwbGF5TGFiZWwoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX2Rpc3BsYXlMYWJlbCkge1xuXHRcdFx0dGhpcy5pbml0TGFiZWxzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2Rpc3BsYXlMYWJlbCE7XG5cdH1cblxuXHRwcml2YXRlIGluaXRMYWJlbHMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2V0dGluZy50aXRsZSkge1xuXHRcdFx0dGhpcy5fZGlzcGxheUxhYmVsID0gdGhpcy5zZXR0aW5nLnRpdGxlO1xuXHRcdFx0dGhpcy5fZGlzcGxheUNhdGVnb3J5ID0gdGhpcy5zZXR0aW5nLmNhdGVnb3J5TGFiZWwgPz8gbnVsbDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGlzcGxheUtleUZvcm1hdCA9IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQodGhpcy5zZXR0aW5nLmtleSwgdGhpcy5wYXJlbnQhLmlkLCB0aGlzLnNldHRpbmcuaXNMYW5ndWFnZVRhZ1NldHRpbmcpO1xuXHRcdHRoaXMuX2Rpc3BsYXlMYWJlbCA9IGRpc3BsYXlLZXlGb3JtYXQubGFiZWw7XG5cdFx0dGhpcy5fZGlzcGxheUNhdGVnb3J5ID0gZGlzcGxheUtleUZvcm1hdC5jYXRlZ29yeTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdFNldHRpbmdEZXNjcmlwdGlvbigpIHtcblx0XHRpZiAodGhpcy5zZXR0aW5nLmRlc2NyaXB0aW9uLmxlbmd0aCA+IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50Lk1BWF9ERVNDX0xJTkVTKSB7XG5cdFx0XHRjb25zdCB0cnVuY2F0ZWREZXNjTGluZXMgPSB0aGlzLnNldHRpbmcuZGVzY3JpcHRpb24uc2xpY2UoMCwgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQuTUFYX0RFU0NfTElORVMpO1xuXHRcdFx0dHJ1bmNhdGVkRGVzY0xpbmVzLnB1c2goJ1suLi5dJyk7XG5cdFx0XHR0aGlzLmRlc2NyaXB0aW9uID0gdHJ1bmNhdGVkRGVzY0xpbmVzLmpvaW4oJ1xcbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRlc2NyaXB0aW9uID0gdGhpcy5zZXR0aW5nLmRlc2NyaXB0aW9uLmpvaW4oJ1xcbicpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaW5pdFNldHRpbmdWYWx1ZVR5cGUoKSB7XG5cdFx0aWYgKGlzRXh0ZW5zaW9uVG9nZ2xlU2V0dGluZyh0aGlzLnNldHRpbmcsIHRoaXMucHJvZHVjdFNlcnZpY2UpKSB7XG5cdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuRXh0ZW5zaW9uVG9nZ2xlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zZXR0aW5nLmVudW0gJiYgKCF0aGlzLnNldHRpbmcudHlwZSB8fCBzZXR0aW5nVHlwZUVudW1SZW5kZXJhYmxlKHRoaXMuc2V0dGluZy50eXBlKSkpIHtcblx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5FbnVtO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zZXR0aW5nLnR5cGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5nLmVkaXRQcmVzZW50YXRpb24gPT09IEVkaXRQcmVzZW50YXRpb25UeXBlcy5NdWx0aWxpbmUpIHtcblx0XHRcdFx0dGhpcy52YWx1ZVR5cGUgPSBTZXR0aW5nVmFsdWVUeXBlLk11bHRpbGluZVN0cmluZztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5TdHJpbmc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChpc0V4Y2x1ZGVTZXR0aW5nKHRoaXMuc2V0dGluZykpIHtcblx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5FeGNsdWRlO1xuXHRcdH0gZWxzZSBpZiAoaXNJbmNsdWRlU2V0dGluZyh0aGlzLnNldHRpbmcpKSB7XG5cdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuSW5jbHVkZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuc2V0dGluZy50eXBlID09PSAnaW50ZWdlcicpIHtcblx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5JbnRlZ2VyO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zZXR0aW5nLnR5cGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuTnVtYmVyO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zZXR0aW5nLnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy52YWx1ZVR5cGUgPSBTZXR0aW5nVmFsdWVUeXBlLkJvb2xlYW47XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNldHRpbmcudHlwZSA9PT0gJ2FycmF5JyAmJiB0aGlzLnNldHRpbmcuYXJyYXlJdGVtVHlwZSAmJlxuXHRcdFx0WydzdHJpbmcnLCAnZW51bScsICdudW1iZXInLCAnaW50ZWdlciddLmluY2x1ZGVzKHRoaXMuc2V0dGluZy5hcnJheUl0ZW1UeXBlKSkge1xuXHRcdFx0dGhpcy52YWx1ZVR5cGUgPSBTZXR0aW5nVmFsdWVUeXBlLkFycmF5O1xuXHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLnNldHRpbmcudHlwZSkgJiYgdGhpcy5zZXR0aW5nLnR5cGUuaW5jbHVkZXMoU2V0dGluZ1ZhbHVlVHlwZS5OdWxsKSAmJiB0aGlzLnNldHRpbmcudHlwZS5sZW5ndGggPT09IDIpIHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmcudHlwZS5pbmNsdWRlcyhTZXR0aW5nVmFsdWVUeXBlLkludGVnZXIpKSB7XG5cdFx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5OdWxsYWJsZUludGVnZXI7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuc2V0dGluZy50eXBlLmluY2x1ZGVzKFNldHRpbmdWYWx1ZVR5cGUuTnVtYmVyKSkge1xuXHRcdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuTnVsbGFibGVOdW1iZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuQ29tcGxleDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgc2NoZW1hVHlwZSA9IGdldE9iamVjdFNldHRpbmdTY2hlbWFUeXBlKHRoaXMuc2V0dGluZyk7XG5cdFx0XHRpZiAoc2NoZW1hVHlwZSkge1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5nLmFsbEtleXNBcmVCb29sZWFuKSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZVR5cGUgPSBTZXR0aW5nVmFsdWVUeXBlLkJvb2xlYW5PYmplY3Q7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2NoZW1hVHlwZSA9PT0gJ3NpbXBsZScpIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuT2JqZWN0O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudmFsdWVUeXBlID0gU2V0dGluZ1ZhbHVlVHlwZS5Db21wbGV4T2JqZWN0O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuc2V0dGluZy5pc0xhbmd1YWdlVGFnU2V0dGluZykge1xuXHRcdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuTGFuZ3VhZ2VUYWc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnZhbHVlVHlwZSA9IFNldHRpbmdWYWx1ZVR5cGUuQ29tcGxleDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpbnNwZWN0U2VsZigpIHtcblx0XHRjb25zdCB0YXJnZXRUb0luc3BlY3QgPSB0aGlzLmdldFRhcmdldFRvSW5zcGVjdCh0aGlzLnNldHRpbmcpO1xuXHRcdGNvbnN0IGluc3BlY3RSZXN1bHQgPSBpbnNwZWN0U2V0dGluZyh0aGlzLnNldHRpbmcua2V5LCB0YXJnZXRUb0luc3BlY3QsIHRoaXMubGFuZ3VhZ2VGaWx0ZXIsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMudXBkYXRlKGluc3BlY3RSZXN1bHQsIHRoaXMuaXNXb3Jrc3BhY2VUcnVzdGVkKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGFyZ2V0VG9JbnNwZWN0KHNldHRpbmc6IElTZXR0aW5nKTogU2V0dGluZ3NUYXJnZXQge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlzRGVmYXVsdCAmJiAhdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnVzZURlZmF1bHRGbGFncz8uc2V0dGluZ3MpIHtcblx0XHRcdGlmIChzZXR0aW5nLnNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04pIHtcblx0XHRcdFx0cmV0dXJuIENvbmZpZ3VyYXRpb25UYXJnZXQuQVBQTElDQVRJT047XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pc1NldHRpbmdBcHBsaWVkRm9yQWxsUHJvZmlsZXMoc2V0dGluZy5rZXkpICYmIHRoaXMuc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCkge1xuXHRcdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3NUYXJnZXQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZShpbnNwZWN0UmVzdWx0OiBJSW5zcGVjdFJlc3VsdCwgaXNXb3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0bGV0IHsgaXNDb25maWd1cmVkLCBpbnNwZWN0ZWQsIHRhcmdldFNlbGVjdG9yLCBpbnNwZWN0ZWRMYW5ndWFnZU92ZXJyaWRlcywgbGFuZ3VhZ2VTZWxlY3RvciB9ID0gaW5zcGVjdFJlc3VsdDtcblxuXHRcdHN3aXRjaCAodGFyZ2V0U2VsZWN0b3IpIHtcblx0XHRcdGNhc2UgJ3dvcmtzcGFjZUZvbGRlclZhbHVlJzpcblx0XHRcdGNhc2UgJ3dvcmtzcGFjZVZhbHVlJzpcblx0XHRcdFx0dGhpcy5pc1VudHJ1c3RlZCA9ICEhdGhpcy5zZXR0aW5nLnJlc3RyaWN0ZWQgJiYgIWlzV29ya3NwYWNlVHJ1c3RlZDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0bGV0IGRpc3BsYXlWYWx1ZSA9IGlzQ29uZmlndXJlZCA/IGluc3BlY3RlZFt0YXJnZXRTZWxlY3Rvcl0gOiBpbnNwZWN0ZWQuZGVmYXVsdFZhbHVlO1xuXHRcdGNvbnN0IG92ZXJyaWRkZW5TY29wZUxpc3Q6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgb3ZlcnJpZGRlbkRlZmF1bHRzTGFuZ3VhZ2VMaXN0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGlmICgobGFuZ3VhZ2VTZWxlY3RvciB8fCB0YXJnZXRTZWxlY3RvciAhPT0gJ3dvcmtzcGFjZVZhbHVlJykgJiYgdHlwZW9mIGluc3BlY3RlZC53b3Jrc3BhY2VWYWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdG92ZXJyaWRkZW5TY29wZUxpc3QucHVzaCgnd29ya3NwYWNlOicpO1xuXHRcdH1cblx0XHRpZiAoKGxhbmd1YWdlU2VsZWN0b3IgfHwgdGFyZ2V0U2VsZWN0b3IgIT09ICd1c2VyUmVtb3RlVmFsdWUnKSAmJiB0eXBlb2YgaW5zcGVjdGVkLnVzZXJSZW1vdGVWYWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdG92ZXJyaWRkZW5TY29wZUxpc3QucHVzaCgncmVtb3RlOicpO1xuXHRcdH1cblx0XHRpZiAoKGxhbmd1YWdlU2VsZWN0b3IgfHwgdGFyZ2V0U2VsZWN0b3IgIT09ICd1c2VyTG9jYWxWYWx1ZScpICYmIHR5cGVvZiBpbnNwZWN0ZWQudXNlckxvY2FsVmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRvdmVycmlkZGVuU2NvcGVMaXN0LnB1c2goJ3VzZXI6Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKGluc3BlY3RlZC5vdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlSWRlbnRpZmllciBvZiBpbnNwZWN0ZWQub3ZlcnJpZGVJZGVudGlmaWVycykge1xuXHRcdFx0XHRjb25zdCBpbnNwZWN0ZWRPdmVycmlkZSA9IGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzLmdldChvdmVycmlkZUlkZW50aWZpZXIpO1xuXHRcdFx0XHRpZiAoaW5zcGVjdGVkT3ZlcnJpZGUpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChvdmVycmlkZUlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdFx0XHRpZiAobGFuZ3VhZ2VTZWxlY3RvciAhPT0gb3ZlcnJpZGVJZGVudGlmaWVyICYmIHR5cGVvZiBpbnNwZWN0ZWRPdmVycmlkZS5kZWZhdWx0Py5vdmVycmlkZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdFx0b3ZlcnJpZGRlbkRlZmF1bHRzTGFuZ3VhZ2VMaXN0LnB1c2gob3ZlcnJpZGVJZGVudGlmaWVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgobGFuZ3VhZ2VTZWxlY3RvciAhPT0gb3ZlcnJpZGVJZGVudGlmaWVyIHx8IHRhcmdldFNlbGVjdG9yICE9PSAnd29ya3NwYWNlVmFsdWUnKSAmJiB0eXBlb2YgaW5zcGVjdGVkT3ZlcnJpZGUud29ya3NwYWNlPy5vdmVycmlkZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdFx0b3ZlcnJpZGRlblNjb3BlTGlzdC5wdXNoKGB3b3Jrc3BhY2U6JHtvdmVycmlkZUlkZW50aWZpZXJ9YCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoKGxhbmd1YWdlU2VsZWN0b3IgIT09IG92ZXJyaWRlSWRlbnRpZmllciB8fCB0YXJnZXRTZWxlY3RvciAhPT0gJ3VzZXJSZW1vdGVWYWx1ZScpICYmIHR5cGVvZiBpbnNwZWN0ZWRPdmVycmlkZS51c2VyUmVtb3RlPy5vdmVycmlkZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdFx0b3ZlcnJpZGRlblNjb3BlTGlzdC5wdXNoKGByZW1vdGU6JHtvdmVycmlkZUlkZW50aWZpZXJ9YCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoKGxhbmd1YWdlU2VsZWN0b3IgIT09IG92ZXJyaWRlSWRlbnRpZmllciB8fCB0YXJnZXRTZWxlY3RvciAhPT0gJ3VzZXJMb2NhbFZhbHVlJykgJiYgdHlwZW9mIGluc3BlY3RlZE92ZXJyaWRlLnVzZXJMb2NhbD8ub3ZlcnJpZGUgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdFx0XHRcdG92ZXJyaWRkZW5TY29wZUxpc3QucHVzaChgdXNlcjoke292ZXJyaWRlSWRlbnRpZmllcn1gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5sYW5ndWFnZU92ZXJyaWRlVmFsdWVzLnNldChvdmVycmlkZUlkZW50aWZpZXIsIGluc3BlY3RlZE92ZXJyaWRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLm92ZXJyaWRkZW5TY29wZUxpc3QgPSBvdmVycmlkZGVuU2NvcGVMaXN0O1xuXHRcdHRoaXMub3ZlcnJpZGRlbkRlZmF1bHRzTGFuZ3VhZ2VMaXN0ID0gb3ZlcnJpZGRlbkRlZmF1bHRzTGFuZ3VhZ2VMaXN0O1xuXG5cdFx0Ly8gVGhlIHVzZXIgbWlnaHQgaGF2ZSBhZGRlZCwgcmVtb3ZlZCwgb3IgbW9kaWZpZWQgYSBsYW5ndWFnZSBmaWx0ZXIsXG5cdFx0Ly8gc28gd2UgcmVzZXQgdGhlIGRlZmF1bHQgdmFsdWUgc291cmNlIHRvIHRoZSBub24tbGFuZ3VhZ2Utc3BlY2lmaWMgZGVmYXVsdCB2YWx1ZSBzb3VyY2UgZm9yIG5vdy5cblx0XHR0aGlzLmRlZmF1bHRWYWx1ZVNvdXJjZSA9IHRoaXMuc2V0dGluZy5ub25MYW5ndWFnZVNwZWNpZmljRGVmYXVsdFZhbHVlU291cmNlO1xuXG5cdFx0aWYgKGluc3BlY3RlZC5wb2xpY3lWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmhhc1BvbGljeVZhbHVlID0gdHJ1ZTtcblx0XHRcdGlzQ29uZmlndXJlZCA9IGZhbHNlOyAvLyBUaGUgdXNlciBkaWQgbm90IG1hbnVhbGx5IGNvbmZpZ3VyZSB0aGUgc2V0dGluZyB0aGVtc2VsdmVzLlxuXHRcdFx0ZGlzcGxheVZhbHVlID0gaW5zcGVjdGVkLnBvbGljeVZhbHVlO1xuXHRcdFx0dGhpcy5zY29wZVZhbHVlID0gaW5zcGVjdGVkLnBvbGljeVZhbHVlO1xuXHRcdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBpbnNwZWN0ZWQuZGVmYXVsdFZhbHVlO1xuXHRcdH0gZWxzZSBpZiAobGFuZ3VhZ2VTZWxlY3RvciAmJiB0aGlzLmxhbmd1YWdlT3ZlcnJpZGVWYWx1ZXMuaGFzKGxhbmd1YWdlU2VsZWN0b3IpKSB7XG5cdFx0XHRjb25zdCBvdmVycmlkZVZhbHVlcyA9IHRoaXMubGFuZ3VhZ2VPdmVycmlkZVZhbHVlcy5nZXQobGFuZ3VhZ2VTZWxlY3RvcikhO1xuXHRcdFx0Ly8gSW4gdGhlIHdvcnN0IGNhc2UsIGdvIGJhY2sgdG8gdXNpbmcgdGhlIHByZXZpb3VzIGRpc3BsYXkgdmFsdWUuXG5cdFx0XHQvLyBBbHNvLCBzb21ldGltZXMgdGhlIG92ZXJyaWRlIGlzIGluIHRoZSBmb3JtIG9mIGEgZGVmYXVsdCB2YWx1ZSBvdmVycmlkZSwgc28gY29uc2lkZXIgdGhhdCBzZWNvbmQuXG5cdFx0XHRkaXNwbGF5VmFsdWUgPSAoaXNDb25maWd1cmVkID8gb3ZlcnJpZGVWYWx1ZXNbdGFyZ2V0U2VsZWN0b3JdIDogb3ZlcnJpZGVWYWx1ZXMuZGVmYXVsdFZhbHVlKSA/PyBkaXNwbGF5VmFsdWU7XG5cdFx0XHR0aGlzLnNjb3BlVmFsdWUgPSBpc0NvbmZpZ3VyZWQgJiYgb3ZlcnJpZGVWYWx1ZXNbdGFyZ2V0U2VsZWN0b3JdO1xuXHRcdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBvdmVycmlkZVZhbHVlcy5kZWZhdWx0VmFsdWUgPz8gaW5zcGVjdGVkLmRlZmF1bHRWYWx1ZTtcblxuXHRcdFx0Y29uc3QgcmVnaXN0cnlWYWx1ZXMgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLmdldENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpO1xuXHRcdFx0Y29uc3Qgc291cmNlID0gcmVnaXN0cnlWYWx1ZXMuZ2V0KGBbJHtsYW5ndWFnZVNlbGVjdG9yfV1gKT8uc291cmNlO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVWYWx1ZVNvdXJjZSA9IHNvdXJjZSBpbnN0YW5jZW9mIE1hcCA/IHNvdXJjZS5nZXQodGhpcy5zZXR0aW5nLmtleSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAob3ZlcnJpZGVWYWx1ZVNvdXJjZSkge1xuXHRcdFx0XHR0aGlzLmRlZmF1bHRWYWx1ZVNvdXJjZSA9IG92ZXJyaWRlVmFsdWVTb3VyY2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2NvcGVWYWx1ZSA9IGlzQ29uZmlndXJlZCAmJiBpbnNwZWN0ZWRbdGFyZ2V0U2VsZWN0b3JdO1xuXHRcdFx0dGhpcy5kZWZhdWx0VmFsdWUgPSBpbnNwZWN0ZWQuZGVmYXVsdFZhbHVlO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsdWUgPSBkaXNwbGF5VmFsdWU7XG5cdFx0dGhpcy5pc0NvbmZpZ3VyZWQgPSBpc0NvbmZpZ3VyZWQ7XG5cdFx0aWYgKGlzQ29uZmlndXJlZCB8fCB0aGlzLnNldHRpbmcudGFncyB8fCB0aGlzLnRhZ3MgfHwgdGhpcy5zZXR0aW5nLnJlc3RyaWN0ZWQgfHwgdGhpcy5oYXNQb2xpY3lWYWx1ZSkge1xuXHRcdFx0Ly8gRG9uJ3QgY3JlYXRlIGFuIGVtcHR5IFNldCBmb3IgYWxsIDEwMDAgc2V0dGluZ3MsIG9ubHkgaWYgbmVlZGVkXG5cdFx0XHR0aGlzLnRhZ3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRcdGlmIChpc0NvbmZpZ3VyZWQpIHtcblx0XHRcdFx0dGhpcy50YWdzLmFkZChNT0RJRklFRF9TRVRUSU5HX1RBRyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2V0dGluZy50YWdzPy5mb3JFYWNoKHRhZyA9PiB0aGlzLnRhZ3MhLmFkZCh0YWcpKTtcblxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZy5yZXN0cmljdGVkKSB7XG5cdFx0XHRcdHRoaXMudGFncy5hZGQoUkVRVUlSRV9UUlVTVEVEX1dPUktTUEFDRV9TRVRUSU5HX1RBRyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmhhc1BvbGljeVZhbHVlKSB7XG5cdFx0XHRcdHRoaXMudGFncy5hZGQoUE9MSUNZX1NFVFRJTkdfVEFHKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRtYXRjaGVzQWxsVGFncyh0YWdGaWx0ZXJzPzogU2V0PHN0cmluZz4pOiBib29sZWFuIHtcblx0XHRpZiAoIXRhZ0ZpbHRlcnM/LnNpemUpIHtcblx0XHRcdC8vIFRoaXMgc2V0dGluZywgd2hpY2ggbWF5IGhhdmUgdGFncyxcblx0XHRcdC8vIG1hdGNoZXMgYWdhaW5zdCBhIHF1ZXJ5IHdpdGggbm8gdGFncy5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy50YWdzKSB7XG5cdFx0XHQvLyBUaGUgc2V0dGluZyBtdXN0IGluc3BlY3QgaXRzZWxmIHRvIGdldCB0YWcgaW5mb3JtYXRpb25cblx0XHRcdC8vIGluY2x1ZGluZyBmb3IgdGhlIGhhc1BvbGljeSB0YWcuXG5cdFx0XHR0aGlzLmluc3BlY3RTZWxmKCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgZmlsdGVyIHRhZ3MgYXJlIGEgc3Vic2V0IG9mIHRoaXMgc2V0dGluZydzIHRhZ3Ncblx0XHRyZXR1cm4gISF0aGlzLnRhZ3M/LnNpemUgJiZcblx0XHRcdEFycmF5LmZyb20odGFnRmlsdGVycykuZXZlcnkodGFnID0+IHRoaXMudGFncyEuaGFzKHRhZykpO1xuXHR9XG5cblx0bWF0Y2hlc1Njb3BlKHNjb3BlOiBTZXR0aW5nc1RhcmdldCwgaXNSZW1vdGU6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBjb25maWdUYXJnZXQgPSBVUkkuaXNVcmkoc2NvcGUpID8gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSIDogc2NvcGU7XG5cblx0XHRpZiAoIXRoaXMuc2V0dGluZy5zY29wZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbmZpZ1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTikge1xuXHRcdFx0cmV0dXJuIEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyh0aGlzLnNldHRpbmcuc2NvcGUpO1xuXHRcdH1cblxuXHRcdGlmIChjb25maWdUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUikge1xuXHRcdFx0cmV0dXJuIEZPTERFUl9TQ09QRVMuaW5jbHVkZXModGhpcy5zZXR0aW5nLnNjb3BlKTtcblx0XHR9XG5cblx0XHRpZiAoY29uZmlnVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSkge1xuXHRcdFx0cmV0dXJuIFdPUktTUEFDRV9TQ09QRVMuaW5jbHVkZXModGhpcy5zZXR0aW5nLnNjb3BlKTtcblx0XHR9XG5cblx0XHRpZiAoY29uZmlnVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFKSB7XG5cdFx0XHRyZXR1cm4gUkVNT1RFX01BQ0hJTkVfU0NPUEVTLmluY2x1ZGVzKHRoaXMuc2V0dGluZy5zY29wZSkgfHwgVVNFUl9MT0NBTF9BTkRfUkVNT1RFX1NFVFRJTkdTLmluY2x1ZGVzKHRoaXMuc2V0dGluZy5rZXkpO1xuXHRcdH1cblxuXHRcdGlmIChjb25maWdUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCkge1xuXHRcdFx0aWYgKGlzUmVtb3RlKSB7XG5cdFx0XHRcdHJldHVybiBMT0NBTF9NQUNISU5FX1NDT1BFUy5pbmNsdWRlcyh0aGlzLnNldHRpbmcuc2NvcGUpIHx8IFVTRVJfTE9DQUxfQU5EX1JFTU9URV9TRVRUSU5HUy5pbmNsdWRlcyh0aGlzLnNldHRpbmcua2V5KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdG1hdGNoZXNBbnlFeHRlbnNpb24oZXh0ZW5zaW9uRmlsdGVycz86IFNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0aWYgKCFleHRlbnNpb25GaWx0ZXJzIHx8ICFleHRlbnNpb25GaWx0ZXJzLnNpemUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5zZXR0aW5nLmV4dGVuc2lvbkluZm8pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gQXJyYXkuZnJvbShleHRlbnNpb25GaWx0ZXJzKS5zb21lKGV4dGVuc2lvbklkID0+IGV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCkgPT09IHRoaXMuc2V0dGluZy5leHRlbnNpb25JbmZvIS5pZC50b0xvd2VyQ2FzZSgpKTtcblx0fVxuXG5cdG1hdGNoZXNBbnlGZWF0dXJlKGZlYXR1cmVGaWx0ZXJzPzogU2V0PHN0cmluZz4pOiBib29sZWFuIHtcblx0XHRpZiAoIWZlYXR1cmVGaWx0ZXJzIHx8ICFmZWF0dXJlRmlsdGVycy5zaXplKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBmZWF0dXJlcyA9IHRvY0RhdGEuY2hpbGRyZW4hLmZpbmQoY2hpbGQgPT4gY2hpbGQuaWQgPT09ICdmZWF0dXJlcycpO1xuXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oZmVhdHVyZUZpbHRlcnMpLnNvbWUoZmlsdGVyID0+IHtcblx0XHRcdGlmIChmZWF0dXJlcyAmJiBmZWF0dXJlcy5jaGlsZHJlbikge1xuXHRcdFx0XHRjb25zdCBmZWF0dXJlID0gZmVhdHVyZXMuY2hpbGRyZW4uZmluZChmZWF0dXJlID0+ICdmZWF0dXJlcy8nICsgZmlsdGVyID09PSBmZWF0dXJlLmlkKTtcblx0XHRcdFx0aWYgKGZlYXR1cmUpIHtcblx0XHRcdFx0XHRjb25zdCBwYXR0ZXJucyA9IGZlYXR1cmUuc2V0dGluZ3M/Lm1hcChzZXR0aW5nID0+IGNyZWF0ZVNldHRpbmdNYXRjaFJlZ0V4cChzZXR0aW5nKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHBhdHRlcm5zICYmICF0aGlzLnNldHRpbmcuZXh0ZW5zaW9uSW5mbyAmJiBwYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4gcGF0dGVybi50ZXN0KHRoaXMuc2V0dGluZy5rZXkudG9Mb3dlckNhc2UoKSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0bWF0Y2hlc0FueUlkKGlkRmlsdGVycz86IFNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0aWYgKCFpZEZpbHRlcnMgfHwgIWlkRmlsdGVycy5zaXplKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGlkRmlsdGVycy5oYXModGhpcy5zZXR0aW5nLmtleSk7XG5cdH1cblxuXHRtYXRjaGVzQWxsTGFuZ3VhZ2VzKGxhbmd1YWdlRmlsdGVyPzogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFsYW5ndWFnZUZpbHRlcikge1xuXHRcdFx0Ly8gV2UncmUgbm90IGZpbHRlcmluZyBieSBsYW5ndWFnZS5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUZpbHRlcikpIHtcblx0XHRcdC8vIFdlJ3JlIHRyeWluZyB0byBmaWx0ZXIgYnkgYW4gaW52YWxpZCBsYW5ndWFnZS5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBXZSBoYXZlIGEgbGFuZ3VhZ2UgZmlsdGVyIGluIHRoZSBzZWFyY2ggd2lkZ2V0IGF0IHRoaXMgcG9pbnQuXG5cdFx0Ly8gV2UgZGVjaWRlIHRvIHNob3cgYWxsIGxhbmd1YWdlIG92ZXJyaWRhYmxlIHNldHRpbmdzIHRvIG1ha2UgdGhlXG5cdFx0Ly8gbGFuZyBmaWx0ZXIgYWN0IG1vcmUgbGlrZSBhIHNjb3BlIGZpbHRlcixcblx0XHQvLyByYXRoZXIgdGhhbiBhZGRpbmcgb24gYW4gaW1wbGljaXQgQG1vZGlmaWVkIGFzIHdlbGwuXG5cdFx0aWYgKHRoaXMuc2V0dGluZy5zY29wZSA9PT0gQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuXG5mdW5jdGlvbiBjcmVhdGVTZXR0aW5nTWF0Y2hSZWdFeHAocGF0dGVybjogc3RyaW5nKTogUmVnRXhwIHtcblx0cGF0dGVybiA9IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMocGF0dGVybilcblx0XHQucmVwbGFjZSgvXFxcXFxcKi9nLCAnLionKTtcblxuXHRyZXR1cm4gbmV3IFJlZ0V4cChgXiR7cGF0dGVybn0kYCwgJ2knKTtcbn1cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVHJlZU1vZGVsIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXHRwcm90ZWN0ZWQgX3Jvb3QhOiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQ7XG5cdHByaXZhdGUgX3RvY1Jvb3QhOiBJVE9DRW50cnk8SVNldHRpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmVlRWxlbWVudHNCeVNldHRpbmdOYW1lID0gbmV3IE1hcDxzdHJpbmcsIFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50W10+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF92aWV3U3RhdGU6IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSxcblx0XHRwcml2YXRlIF9pc1dvcmtzcGFjZVRydXN0ZWQ6IGJvb2xlYW4sXG5cdFx0QElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0Z2V0IHJvb3QoKTogU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdDtcblx0fVxuXG5cdHVwZGF0ZShuZXdUb2NSb290ID0gdGhpcy5fdG9jUm9vdCk6IHZvaWQge1xuXHRcdHRoaXMuX3RyZWVFbGVtZW50c0J5U2V0dGluZ05hbWUuY2xlYXIoKTtcblxuXHRcdGNvbnN0IG5ld1Jvb3QgPSB0aGlzLmNyZWF0ZVNldHRpbmdzVHJlZUdyb3VwRWxlbWVudChuZXdUb2NSb290KTtcblx0XHRpZiAobmV3Um9vdC5jaGlsZHJlblswXSBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCkge1xuXHRcdFx0KDxTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQ+bmV3Um9vdC5jaGlsZHJlblswXSkuaXNGaXJzdEdyb3VwID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcm9vdCkge1xuXHRcdFx0dGhpcy5kaXNwb3NlQ2hpbGRyZW4odGhpcy5fcm9vdC5jaGlsZHJlbik7XG5cdFx0XHR0aGlzLl9yb290LmNoaWxkcmVuID0gbmV3Um9vdC5jaGlsZHJlbjtcblx0XHRcdG5ld1Jvb3QuZGlzcG9zZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yb290ID0gbmV3Um9vdDtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVXb3Jrc3BhY2VUcnVzdCh3b3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5faXNXb3Jrc3BhY2VUcnVzdGVkID0gd29ya3NwYWNlVHJ1c3RlZDtcblx0XHR0aGlzLnVwZGF0ZVJlcXVpcmVUcnVzdGVkVGFyZ2V0RWxlbWVudHMoKTtcblx0fVxuXG5cdHByaXZhdGUgZGlzcG9zZUNoaWxkcmVuKGNoaWxkcmVuOiBTZXR0aW5nc1RyZWVHcm91cENoaWxkW10pIHtcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHR0aGlzLmRpc3Bvc2VDaGlsZEFuZFJlY3Vyc2UoY2hpbGQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZGlzcG9zZUNoaWxkQW5kUmVjdXJzZShlbGVtZW50OiBTZXR0aW5nc1RyZWVFbGVtZW50KSB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQpIHtcblx0XHRcdHRoaXMuZGlzcG9zZUNoaWxkcmVuKGVsZW1lbnQuY2hpbGRyZW4pO1xuXHRcdH1cblxuXHRcdGVsZW1lbnQuZGlzcG9zZSgpO1xuXHR9XG5cblx0Z2V0RWxlbWVudHNCeU5hbWUobmFtZTogc3RyaW5nKTogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnRbXSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl90cmVlRWxlbWVudHNCeVNldHRpbmdOYW1lLmdldChuYW1lKSA/PyBudWxsO1xuXHR9XG5cblx0dXBkYXRlRWxlbWVudHNCeU5hbWUobmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90cmVlRWxlbWVudHNCeVNldHRpbmdOYW1lLmhhcyhuYW1lKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucmVpbnNwZWN0U2V0dGluZ3ModGhpcy5fdHJlZUVsZW1lbnRzQnlTZXR0aW5nTmFtZS5nZXQobmFtZSkhKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUmVxdWlyZVRydXN0ZWRUYXJnZXRFbGVtZW50cygpOiB2b2lkIHtcblx0XHR0aGlzLnJlaW5zcGVjdFNldHRpbmdzKFsuLi50aGlzLl90cmVlRWxlbWVudHNCeVNldHRpbmdOYW1lLnZhbHVlcygpXS5mbGF0KCkuZmlsdGVyKHMgPT4gcy5pc1VudHJ1c3RlZCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWluc3BlY3RTZXR0aW5ncyhzZXR0aW5nczogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnRbXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBzZXR0aW5ncykge1xuXHRcdFx0ZWxlbWVudC5pbnNwZWN0U2VsZigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KHRvY0VudHJ5OiBJVE9DRW50cnk8SVNldHRpbmc+LCBwYXJlbnQ/OiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQpOiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQge1xuXHRcdGNvbnN0IGRlcHRoID0gcGFyZW50ID8gdGhpcy5nZXREZXB0aChwYXJlbnQpICsgMSA6IDA7XG5cdFx0Y29uc3QgZWxlbWVudCA9IG5ldyBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQodG9jRW50cnkuaWQsIHVuZGVmaW5lZCwgdG9jRW50cnkubGFiZWwsIGRlcHRoLCBmYWxzZSk7XG5cdFx0ZWxlbWVudC5wYXJlbnQgPSBwYXJlbnQ7XG5cblx0XHRjb25zdCBjaGlsZHJlbjogU2V0dGluZ3NUcmVlR3JvdXBDaGlsZFtdID0gW107XG5cdFx0aWYgKHRvY0VudHJ5LnNldHRpbmdzKSB7XG5cdFx0XHRjb25zdCBzZXR0aW5nQ2hpbGRyZW4gPSB0b2NFbnRyeS5zZXR0aW5ncy5tYXAocyA9PiB0aGlzLmNyZWF0ZVNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KHMsIGVsZW1lbnQpKTtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygc2V0dGluZ0NoaWxkcmVuKSB7XG5cdFx0XHRcdGlmICghY2hpbGQuc2V0dGluZy5kZXByZWNhdGlvbk1lc3NhZ2UpIHtcblx0XHRcdFx0XHRjaGlsZHJlbi5wdXNoKGNoaWxkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjaGlsZC5pbnNwZWN0U2VsZigpO1xuXHRcdFx0XHRcdGlmIChjaGlsZC5pc0NvbmZpZ3VyZWQpIHtcblx0XHRcdFx0XHRcdGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjaGlsZC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRvY0VudHJ5LmNoaWxkcmVuKSB7XG5cdFx0XHRjb25zdCBncm91cENoaWxkcmVuID0gdG9jRW50cnkuY2hpbGRyZW4ubWFwKGNoaWxkID0+IHRoaXMuY3JlYXRlU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KGNoaWxkLCBlbGVtZW50KSk7XG5cdFx0XHRjaGlsZHJlbi5wdXNoKC4uLmdyb3VwQ2hpbGRyZW4pO1xuXHRcdH1cblxuXHRcdGVsZW1lbnQuY2hpbGRyZW4gPSBjaGlsZHJlbjtcblxuXHRcdHJldHVybiBlbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZXB0aChlbGVtZW50OiBTZXR0aW5nc1RyZWVFbGVtZW50KTogbnVtYmVyIHtcblx0XHRpZiAoZWxlbWVudC5wYXJlbnQpIHtcblx0XHRcdHJldHVybiAxICsgdGhpcy5nZXREZXB0aChlbGVtZW50LnBhcmVudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQoc2V0dGluZzogSVNldHRpbmcsIHBhcmVudDogU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KTogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBuZXcgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQoXG5cdFx0XHRzZXR0aW5nLFxuXHRcdFx0cGFyZW50LFxuXHRcdFx0dGhpcy5fdmlld1N0YXRlLnNldHRpbmdzVGFyZ2V0LFxuXHRcdFx0dGhpcy5faXNXb3Jrc3BhY2VUcnVzdGVkLFxuXHRcdFx0dGhpcy5fdmlld1N0YXRlLmxhbmd1YWdlRmlsdGVyLFxuXHRcdFx0dGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fcHJvZHVjdFNlcnZpY2UsXG5cdFx0XHR0aGlzLl91c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbmFtZUVsZW1lbnRzID0gdGhpcy5fdHJlZUVsZW1lbnRzQnlTZXR0aW5nTmFtZS5nZXQoc2V0dGluZy5rZXkpID8/IFtdO1xuXHRcdG5hbWVFbGVtZW50cy5wdXNoKGVsZW1lbnQpO1xuXHRcdHRoaXMuX3RyZWVFbGVtZW50c0J5U2V0dGluZ05hbWUuc2V0KHNldHRpbmcua2V5LCBuYW1lRWxlbWVudHMpO1xuXHRcdHJldHVybiBlbGVtZW50O1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl90cmVlRWxlbWVudHNCeVNldHRpbmdOYW1lLmNsZWFyKCk7XG5cdFx0dGhpcy5kaXNwb3NlQ2hpbGRBbmRSZWN1cnNlKHRoaXMuX3Jvb3QpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJSW5zcGVjdFJlc3VsdCB7XG5cdGlzQ29uZmlndXJlZDogYm9vbGVhbjtcblx0aW5zcGVjdGVkOiBJQ29uZmlndXJhdGlvblZhbHVlPHVua25vd24+O1xuXHR0YXJnZXRTZWxlY3RvcjogJ2FwcGxpY2F0aW9uVmFsdWUnIHwgJ3VzZXJMb2NhbFZhbHVlJyB8ICd1c2VyUmVtb3RlVmFsdWUnIHwgJ3dvcmtzcGFjZVZhbHVlJyB8ICd3b3Jrc3BhY2VGb2xkZXJWYWx1ZSc7XG5cdGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzOiBNYXA8c3RyaW5nLCBJQ29uZmlndXJhdGlvblZhbHVlPHVua25vd24+Pjtcblx0bGFuZ3VhZ2VTZWxlY3Rvcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5zcGVjdFNldHRpbmcoa2V5OiBzdHJpbmcsIHRhcmdldDogU2V0dGluZ3NUYXJnZXQsIGxhbmd1YWdlRmlsdGVyOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UpOiBJSW5zcGVjdFJlc3VsdCB7XG5cdGNvbnN0IGluc3BlY3RPdmVycmlkZXMgPSBVUkkuaXNVcmkodGFyZ2V0KSA/IHsgcmVzb3VyY2U6IHRhcmdldCB9IDogdW5kZWZpbmVkO1xuXHRjb25zdCBpbnNwZWN0ZWQgPSBjb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGtleSwgaW5zcGVjdE92ZXJyaWRlcyk7XG5cdGNvbnN0IHRhcmdldFNlbGVjdG9yID0gdGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LkFQUExJQ0FUSU9OID8gJ2FwcGxpY2F0aW9uVmFsdWUnIDpcblx0XHR0YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCA/ICd1c2VyTG9jYWxWYWx1ZScgOlxuXHRcdFx0dGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFID8gJ3VzZXJSZW1vdGVWYWx1ZScgOlxuXHRcdFx0XHR0YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFID8gJ3dvcmtzcGFjZVZhbHVlJyA6XG5cdFx0XHRcdFx0J3dvcmtzcGFjZUZvbGRlclZhbHVlJztcblx0Y29uc3QgdGFyZ2V0T3ZlcnJpZGVTZWxlY3RvciA9IHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTiA/ICdhcHBsaWNhdGlvbicgOlxuXHRcdHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMID8gJ3VzZXJMb2NhbCcgOlxuXHRcdFx0dGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFID8gJ3VzZXJSZW1vdGUnIDpcblx0XHRcdFx0dGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSA/ICd3b3Jrc3BhY2UnIDpcblx0XHRcdFx0XHQnd29ya3NwYWNlRm9sZGVyJztcblx0bGV0IGlzQ29uZmlndXJlZCA9IHR5cGVvZiBpbnNwZWN0ZWRbdGFyZ2V0U2VsZWN0b3JdICE9PSAndW5kZWZpbmVkJztcblxuXHRjb25zdCBvdmVycmlkZUlkZW50aWZpZXJzID0gaW5zcGVjdGVkLm92ZXJyaWRlSWRlbnRpZmllcnM7XG5cdGNvbnN0IGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzID0gbmV3IE1hcDxzdHJpbmcsIElDb25maWd1cmF0aW9uVmFsdWU8dW5rbm93bj4+KCk7XG5cblx0Ly8gV2UgbXVzdCByZXNldCBpc0NvbmZpZ3VyZWQgdG8gYmUgZmFsc2UgaWYgbGFuZ3VhZ2VGaWx0ZXIgaXMgc2V0LCBhbmQgbWFudWFsbHlcblx0Ly8gZGV0ZXJtaW5lIHdoZXRoZXIgaXQgY2FuIGJlIHNldCB0byB0cnVlIGxhdGVyLlxuXHRpZiAobGFuZ3VhZ2VGaWx0ZXIpIHtcblx0XHRpc0NvbmZpZ3VyZWQgPSBmYWxzZTtcblx0fVxuXHRpZiAob3ZlcnJpZGVJZGVudGlmaWVycykge1xuXHRcdC8vIFRoZSBzZXR0aW5nIHdlJ3JlIGxvb2tpbmcgYXQgaGFzIGxhbmd1YWdlIG92ZXJyaWRlcy5cblx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlSWRlbnRpZmllciBvZiBvdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHRpbnNwZWN0ZWRMYW5ndWFnZU92ZXJyaWRlcy5zZXQob3ZlcnJpZGVJZGVudGlmaWVyLCBjb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGtleSwgeyBvdmVycmlkZUlkZW50aWZpZXIgfSkpO1xuXHRcdH1cblxuXHRcdC8vIEZvciBhbGwgbGFuZ3VhZ2UgZmlsdGVycywgc2VlIGlmIHRoZXJlJ3MgYW4gb3ZlcnJpZGUgZm9yIHRoYXQgZmlsdGVyLlxuXHRcdGlmIChsYW5ndWFnZUZpbHRlcikge1xuXHRcdFx0aWYgKGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzLmhhcyhsYW5ndWFnZUZpbHRlcikpIHtcblx0XHRcdFx0Y29uc3Qgb3ZlcnJpZGVWYWx1ZSA9IGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzLmdldChsYW5ndWFnZUZpbHRlcikhW3RhcmdldE92ZXJyaWRlU2VsZWN0b3JdPy5vdmVycmlkZTtcblx0XHRcdFx0aWYgKHR5cGVvZiBvdmVycmlkZVZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdGlzQ29uZmlndXJlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBpc0NvbmZpZ3VyZWQsIGluc3BlY3RlZCwgdGFyZ2V0U2VsZWN0b3IsIGluc3BlY3RlZExhbmd1YWdlT3ZlcnJpZGVzLCBsYW5ndWFnZVNlbGVjdG9yOiBsYW5ndWFnZUZpbHRlciB9O1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZUlkKGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gaWQucmVwbGFjZSgvW1xcLlxcL10vLCAnXycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdChrZXk6IHN0cmluZywgZ3JvdXBJZDogc3RyaW5nID0gJycsIGlzTGFuZ3VhZ2VUYWdTZXR0aW5nOiBib29sZWFuID0gZmFsc2UpOiB7IGNhdGVnb3J5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfSB7XG5cdGNvbnN0IGxhc3REb3RJZHggPSBrZXkubGFzdEluZGV4T2YoJy4nKTtcblx0bGV0IGNhdGVnb3J5ID0gJyc7XG5cdGlmIChsYXN0RG90SWR4ID49IDApIHtcblx0XHRjYXRlZ29yeSA9IGtleS5zdWJzdHJpbmcoMCwgbGFzdERvdElkeCk7XG5cdFx0a2V5ID0ga2V5LnN1YnN0cmluZyhsYXN0RG90SWR4ICsgMSk7XG5cdH1cblxuXHRncm91cElkID0gZ3JvdXBJZC5yZXBsYWNlKC9cXC8vZywgJy4nKTtcblx0Y2F0ZWdvcnkgPSB0cmltQ2F0ZWdvcnlGb3JHcm91cChjYXRlZ29yeSwgZ3JvdXBJZCk7XG5cdGNhdGVnb3J5ID0gd29yZGlmeUtleShjYXRlZ29yeSk7XG5cblx0aWYgKGlzTGFuZ3VhZ2VUYWdTZXR0aW5nKSB7XG5cdFx0a2V5ID0ga2V5LnJlcGxhY2UoL1tcXFtcXF1dL2csICcnKTtcblx0XHRrZXkgPSAnJChicmFja2V0KSAnICsga2V5O1xuXHR9XG5cblx0Y29uc3QgbGFiZWwgPSB3b3JkaWZ5S2V5KGtleSk7XG5cdHJldHVybiB7IGNhdGVnb3J5LCBsYWJlbCB9O1xufVxuXG5mdW5jdGlvbiB3b3JkaWZ5S2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcblx0a2V5ID0ga2V5XG5cdFx0LnJlcGxhY2UoL1xcLihbYS16MC05XSkvZywgKF8sIHAxKSA9PiBgIFxcdTIwM0EgJHtwMS50b1VwcGVyQ2FzZSgpfWApIC8vIFJlcGxhY2UgZG90IHdpdGggc3BhY2VkICc+J1xuXHRcdC5yZXBsYWNlKC8oW2EtejAtOV0pKFtBLVpdKS9nLCAnJDEgJDInKSAvLyBDYW1lbCBjYXNlIHRvIHNwYWNpbmcsIGZvb0JhciA9PiBmb28gQmFyXG5cdFx0LnJlcGxhY2UoL15bYS16XS9nLCBtYXRjaCA9PiBtYXRjaC50b1VwcGVyQ2FzZSgpKSAvLyBVcHBlciBjYXNpbmcgYWxsIGZpcnN0IGxldHRlcnMsIGZvbyA9PiBGb29cblx0XHQucmVwbGFjZSgvXFxiXFx3K1xcYi9nLCBtYXRjaCA9PiB7IC8vIFVwcGVyIGNhc2luZyBrbm93biBhY3Jvbnltc1xuXHRcdFx0cmV0dXJuIGtub3duQWNyb255bXMuaGFzKG1hdGNoLnRvTG93ZXJDYXNlKCkpID9cblx0XHRcdFx0bWF0Y2gudG9VcHBlckNhc2UoKSA6XG5cdFx0XHRcdG1hdGNoO1xuXHRcdH0pO1xuXG5cdGZvciAoY29uc3QgW2ssIHZdIG9mIGtub3duVGVybU1hcHBpbmdzKSB7XG5cdFx0a2V5ID0ga2V5LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxcXGIke2t9XFxcXGJgLCAnZ2knKSwgdik7XG5cdH1cblxuXHRyZXR1cm4ga2V5O1xufVxuXG4vKipcbiAqIFJlbW92ZXMgcmVkdW5kYW50IHNlY3Rpb25zIG9mIHRoZSBjYXRlZ29yeSBsYWJlbC5cbiAqIEEgcmVkdW5kYW50IHNlY3Rpb24gaXMgYSBzZWN0aW9uIGFscmVhZHkgcmVmbGVjdGVkIGluIHRoZSBncm91cElkLlxuICpcbiAqIEBwYXJhbSBjYXRlZ29yeSBUaGUgY2F0ZWdvcnkgb2YgdGhlIHNwZWNpZmljIHNldHRpbmcuXG4gKiBAcGFyYW0gZ3JvdXBJZCBUaGUgYXV0aG9yICsgZXh0ZW5zaW9uIElELlxuICogQHJldHVybnMgVGhlIG5ldyBjYXRlZ29yeSBsYWJlbCB0byB1c2UuXG4gKi9cbmZ1bmN0aW9uIHRyaW1DYXRlZ29yeUZvckdyb3VwKGNhdGVnb3J5OiBzdHJpbmcsIGdyb3VwSWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IGRvVHJpbSA9IChmb3J3YXJkOiBib29sZWFuKSA9PiB7XG5cdFx0Ly8gUmVtb3ZlIHRoZSBJbnNpZGVycyBwb3J0aW9uIGlmIHRoZSBjYXRlZ29yeSBkb2Vzbid0IHVzZSBpdC5cblx0XHRpZiAoIS9pbnNpZGVycyQvaS50ZXN0KGNhdGVnb3J5KSkge1xuXHRcdFx0Z3JvdXBJZCA9IGdyb3VwSWQucmVwbGFjZSgvLT9pbnNpZGVycyQvaSwgJycpO1xuXHRcdH1cblx0XHRjb25zdCBwYXJ0cyA9IGdyb3VwSWQuc3BsaXQoJy4nKVxuXHRcdFx0Lm1hcChwYXJ0ID0+IHtcblx0XHRcdFx0Ly8gUmVtb3ZlIGh5cGhlbnMsIGJ1dCBvbmx5IGlmIHRoYXQgcmVzdWx0cyBpbiBhIG1hdGNoIHdpdGggdGhlIGNhdGVnb3J5LlxuXHRcdFx0XHRpZiAocGFydC5yZXBsYWNlKC8tL2csICcnKS50b0xvd2VyQ2FzZSgpID09PSBjYXRlZ29yeS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHBhcnQucmVwbGFjZSgvLS9nLCAnJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdHdoaWxlIChwYXJ0cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHJlZyA9IG5ldyBSZWdFeHAoYF4ke3BhcnRzLmpvaW4oJ1xcXFwuJyl9KFxcXFwufCQpYCwgJ2knKTtcblx0XHRcdGlmIChyZWcudGVzdChjYXRlZ29yeSkpIHtcblx0XHRcdFx0cmV0dXJuIGNhdGVnb3J5LnJlcGxhY2UocmVnLCAnJyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChmb3J3YXJkKSB7XG5cdFx0XHRcdHBhcnRzLnBvcCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGFydHMuc2hpZnQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fTtcblxuXHRsZXQgdHJpbW1lZCA9IGRvVHJpbSh0cnVlKTtcblx0aWYgKHRyaW1tZWQgPT09IG51bGwpIHtcblx0XHR0cmltbWVkID0gZG9UcmltKGZhbHNlKTtcblx0fVxuXG5cdGlmICh0cmltbWVkID09PSBudWxsKSB7XG5cdFx0dHJpbW1lZCA9IGNhdGVnb3J5O1xuXHR9XG5cblx0cmV0dXJuIHRyaW1tZWQ7XG59XG5cbmZ1bmN0aW9uIGlzRXh0ZW5zaW9uVG9nZ2xlU2V0dGluZyhzZXR0aW5nOiBJU2V0dGluZywgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gRU5BQkxFX0VYVEVOU0lPTl9UT0dHTEVfU0VUVElOR1MgJiZcblx0XHQhIXByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvblJlY29tbWVuZGF0aW9ucyAmJlxuXHRcdCEhc2V0dGluZy5kaXNwbGF5RXh0ZW5zaW9uSWQ7XG59XG5cbmZ1bmN0aW9uIGlzRXhjbHVkZVNldHRpbmcoc2V0dGluZzogSVNldHRpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIHNldHRpbmcua2V5ID09PSAnZmlsZXMuZXhjbHVkZScgfHxcblx0XHRzZXR0aW5nLmtleSA9PT0gJ3NlYXJjaC5leGNsdWRlJyB8fFxuXHRcdHNldHRpbmcua2V5ID09PSAnd29ya2JlbmNoLmxvY2FsSGlzdG9yeS5leGNsdWRlJyB8fFxuXHRcdHNldHRpbmcua2V5ID09PSAnZXhwbG9yZXIuYXV0b1JldmVhbEV4Y2x1ZGUnIHx8XG5cdFx0c2V0dGluZy5rZXkgPT09ICdmaWxlcy5yZWFkb25seUV4Y2x1ZGUnIHx8XG5cdFx0c2V0dGluZy5rZXkgPT09ICdmaWxlcy53YXRjaGVyRXhjbHVkZSc7XG59XG5cbmZ1bmN0aW9uIGlzSW5jbHVkZVNldHRpbmcoc2V0dGluZzogSVNldHRpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIHNldHRpbmcua2V5ID09PSAnZmlsZXMucmVhZG9ubHlJbmNsdWRlJztcbn1cblxuLy8gVGhlIHZhbHVlcyBvZiB0aGUgZm9sbG93aW5nIHNldHRpbmdzIHdoZW4gYSBkZWZhdWx0IHZhbHVlcyBoYXMgYmVlbiByZW1vdmVkXG5leHBvcnQgZnVuY3Rpb24gb2JqZWN0U2V0dGluZ1N1cHBvcnRzUmVtb3ZlRGVmYXVsdFZhbHVlKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBrZXkgPT09ICd3b3JrYmVuY2guZWRpdG9yLmN1c3RvbUxhYmVscy5wYXR0ZXJucyc7XG59XG5cbmZ1bmN0aW9uIGlzU2ltcGxlVHlwZSh0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0cmV0dXJuIHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGUgPT09ICdib29sZWFuJyB8fCB0eXBlID09PSAnaW50ZWdlcicgfHwgdHlwZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdFJlbmRlcmFibGVTY2hlbWFUeXBlKHNjaGVtYTogSUpTT05TY2hlbWEsIGtleTogc3RyaW5nKTogJ3NpbXBsZScgfCAnY29tcGxleCcgfCBmYWxzZSB7XG5cdGNvbnN0IHsgdHlwZSB9ID0gc2NoZW1hO1xuXG5cdGlmIChBcnJheS5pc0FycmF5KHR5cGUpKSB7XG5cdFx0aWYgKG9iamVjdFNldHRpbmdTdXBwb3J0c1JlbW92ZURlZmF1bHRWYWx1ZShrZXkpICYmIHR5cGUubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRpZiAodHlwZS5pbmNsdWRlcygnbnVsbCcpICYmICh0eXBlLmluY2x1ZGVzKCdzdHJpbmcnKSB8fCB0eXBlLmluY2x1ZGVzKCdib29sZWFuJykgfHwgdHlwZS5pbmNsdWRlcygnaW50ZWdlcicpIHx8IHR5cGUuaW5jbHVkZXMoJ251bWJlcicpKSkge1xuXHRcdFx0XHRyZXR1cm4gJ3NpbXBsZSc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCB0IG9mIHR5cGUpIHtcblx0XHRcdGlmICghaXNTaW1wbGVUeXBlKHQpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuICdjb21wbGV4Jztcblx0fVxuXG5cdGlmIChpc1NpbXBsZVR5cGUodHlwZSkpIHtcblx0XHRyZXR1cm4gJ3NpbXBsZSc7XG5cdH1cblxuXHRpZiAodHlwZSA9PT0gJ2FycmF5Jykge1xuXHRcdGlmIChzY2hlbWEuaXRlbXMpIHtcblx0XHRcdGNvbnN0IGl0ZW1TY2hlbWFzID0gQXJyYXkuaXNBcnJheShzY2hlbWEuaXRlbXMpID8gc2NoZW1hLml0ZW1zIDogW3NjaGVtYS5pdGVtc107XG5cdFx0XHRmb3IgKGNvbnN0IHsgdHlwZSB9IG9mIGl0ZW1TY2hlbWFzKSB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHR5cGUpKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB0IG9mIHR5cGUpIHtcblx0XHRcdFx0XHRcdGlmICghaXNTaW1wbGVUeXBlKHQpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuICdjb21wbGV4Jztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWlzU2ltcGxlVHlwZSh0eXBlKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gJ2NvbXBsZXgnO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdFNldHRpbmdTY2hlbWFUeXBlKHtcblx0a2V5LFxuXHR0eXBlLFxuXHRvYmplY3RQcm9wZXJ0aWVzLFxuXHRvYmplY3RQYXR0ZXJuUHJvcGVydGllcyxcblx0b2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXNcbn06IElTZXR0aW5nKTogJ3NpbXBsZScgfCAnY29tcGxleCcgfCBmYWxzZSB7XG5cdGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIG9iamVjdCBjYW4gaGF2ZSBhbnkgc2hhcGVcblx0aWYgKFxuXHRcdGlzVW5kZWZpbmVkT3JOdWxsKG9iamVjdFByb3BlcnRpZXMpICYmXG5cdFx0aXNVbmRlZmluZWRPck51bGwob2JqZWN0UGF0dGVyblByb3BlcnRpZXMpICYmXG5cdFx0aXNVbmRlZmluZWRPck51bGwob2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMpXG5cdCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzIGFsbG93IHRoZSBzZXR0aW5nIHRvIGhhdmUgYW55IHNoYXBlLFxuXHQvLyBidXQgaWYgdGhlcmUncyBhIHBhdHRlcm4gcHJvcGVydHkgdGhhdCBoYW5kbGVzIGV2ZXJ5dGhpbmcsIHRoZW4gZXZlcnlcblx0Ly8gcHJvcGVydHkgd2lsbCBtYXRjaCB0aGF0IHBhdHRlcm5Qcm9wZXJ0eSwgc28gd2UgZG9uJ3QgbmVlZCB0byBsb29rIGF0XG5cdC8vIHRoZSB2YWx1ZSBvZiBvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyBpbiB0aGF0IGNhc2UuXG5cdGlmICgob2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMgPT09IHRydWUgfHwgb2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMgPT09IHVuZGVmaW5lZClcblx0XHQmJiAhT2JqZWN0LmtleXMob2JqZWN0UGF0dGVyblByb3BlcnRpZXMgPz8ge30pLmluY2x1ZGVzKCcuKicpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y29uc3Qgc2NoZW1hcyA9IFsuLi5PYmplY3QudmFsdWVzKG9iamVjdFByb3BlcnRpZXMgPz8ge30pLCAuLi5PYmplY3QudmFsdWVzKG9iamVjdFBhdHRlcm5Qcm9wZXJ0aWVzID8/IHt9KV07XG5cblx0aWYgKG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzICYmIHR5cGVvZiBvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyA9PT0gJ29iamVjdCcpIHtcblx0XHRzY2hlbWFzLnB1c2gob2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMpO1xuXHR9XG5cblx0bGV0IHNjaGVtYVR5cGU6ICdzaW1wbGUnIHwgJ2NvbXBsZXgnIHwgZmFsc2UgPSAnc2ltcGxlJztcblx0Zm9yIChjb25zdCBzY2hlbWEgb2Ygc2NoZW1hcykge1xuXHRcdGZvciAoY29uc3Qgc3ViU2NoZW1hIG9mIEFycmF5LmlzQXJyYXkoc2NoZW1hLmFueU9mKSA/IHNjaGVtYS5hbnlPZiA6IFtzY2hlbWFdKSB7XG5cdFx0XHRjb25zdCBzdWJTY2hlbWFUeXBlID0gZ2V0T2JqZWN0UmVuZGVyYWJsZVNjaGVtYVR5cGUoc3ViU2NoZW1hLCBrZXkpO1xuXHRcdFx0aWYgKHN1YlNjaGVtYVR5cGUgPT09IGZhbHNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChzdWJTY2hlbWFUeXBlID09PSAnY29tcGxleCcpIHtcblx0XHRcdFx0c2NoZW1hVHlwZSA9ICdjb21wbGV4Jztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gc2NoZW1hVHlwZTtcbn1cblxuZnVuY3Rpb24gc2V0dGluZ1R5cGVFbnVtUmVuZGVyYWJsZShfdHlwZTogc3RyaW5nIHwgc3RyaW5nW10pIHtcblx0Y29uc3QgZW51bVJlbmRlcmFibGVTZXR0aW5nVHlwZXMgPSBbJ3N0cmluZycsICdib29sZWFuJywgJ251bGwnLCAnaW50ZWdlcicsICdudW1iZXInXTtcblx0Y29uc3QgdHlwZSA9IEFycmF5LmlzQXJyYXkoX3R5cGUpID8gX3R5cGUgOiBbX3R5cGVdO1xuXHRyZXR1cm4gdHlwZS5ldmVyeSh0eXBlID0+IGVudW1SZW5kZXJhYmxlU2V0dGluZ1R5cGVzLmluY2x1ZGVzKHR5cGUpKTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gU2VhcmNoUmVzdWx0SWR4IHtcblx0TG9jYWwgPSAwLFxuXHRSZW1vdGUgPSAxLFxuXHROZXdFeHRlbnNpb25zID0gMlxufVxuXG5leHBvcnQgY2xhc3MgU2VhcmNoUmVzdWx0TW9kZWwgZXh0ZW5kcyBTZXR0aW5nc1RyZWVNb2RlbCB7XG5cdHByaXZhdGUgcmF3U2VhcmNoUmVzdWx0czogSVNlYXJjaFJlc3VsdFtdIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY2FjaGVkVW5pcXVlU2VhcmNoUmVzdWx0czogSVNlYXJjaFJlc3VsdCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIG5ld0V4dGVuc2lvblNlYXJjaFJlc3VsdHM6IElTZWFyY2hSZXN1bHQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBzZWFyY2hSZXN1bHRDb3VudDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgc2V0dGluZ3NPcmRlckJ5VG9jSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj4gfCBudWxsO1xuXG5cdHJlYWRvbmx5IGlkID0gJ3NlYXJjaFJlc3VsdE1vZGVsJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR2aWV3U3RhdGU6IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSxcblx0XHRzZXR0aW5nc09yZGVyQnlUb2NJbmRleDogTWFwPHN0cmluZywgbnVtYmVyPiB8IG51bGwsXG5cdFx0aXNXb3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih2aWV3U3RhdGUsIGlzV29ya3NwYWNlVHJ1c3RlZCwgY29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZSwgcHJvZHVjdFNlcnZpY2UpO1xuXHRcdHRoaXMuc2V0dGluZ3NPcmRlckJ5VG9jSW5kZXggPSBzZXR0aW5nc09yZGVyQnlUb2NJbmRleDtcblx0XHR0aGlzLnVwZGF0ZSh7IGlkOiAnc2VhcmNoUmVzdWx0TW9kZWwnLCBsYWJlbDogJycgfSk7XG5cdH1cblxuXHRwcml2YXRlIHNvcnRSZXN1bHRzKGZpbHRlck1hdGNoZXM6IElTZXR0aW5nTWF0Y2hbXSk6IElTZXR0aW5nTWF0Y2hbXSB7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3NPcmRlckJ5VG9jSW5kZXgpIHtcblx0XHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgZmlsdGVyTWF0Y2hlcykge1xuXHRcdFx0XHRtYXRjaC5zZXR0aW5nLmludGVybmFsT3JkZXIgPSB0aGlzLnNldHRpbmdzT3JkZXJCeVRvY0luZGV4LmdldChtYXRjaC5zZXR0aW5nLmtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVGhlIHNlYXJjaCBvbmx5IGhhcyBmaWx0ZXJzLCBzbyB3ZSBjYW4gc29ydCBieSB0aGUgb3JkZXIgaW4gdGhlIFRPQy5cblx0XHRpZiAoIXRoaXMuX3ZpZXdTdGF0ZS5xdWVyeSkge1xuXHRcdFx0cmV0dXJuIGZpbHRlck1hdGNoZXMuc29ydCgoYSwgYikgPT4gY29tcGFyZVR3b051bGxhYmxlTnVtYmVycyhhLnNldHRpbmcuaW50ZXJuYWxPcmRlciwgYi5zZXR0aW5nLmludGVybmFsT3JkZXIpKTtcblx0XHR9XG5cblx0XHQvLyBTb3J0IHRoZSBzZXR0aW5ncyBhY2NvcmRpbmcgdG8gdGhlaXIgcmVsZXZhbmN5LlxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTc3NzNcblx0XHRmaWx0ZXJNYXRjaGVzLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChhLm1hdGNoVHlwZSAhPT0gYi5tYXRjaFR5cGUpIHtcblx0XHRcdFx0Ly8gU29ydCBieSBtYXRjaCB0eXBlIGlmIHRoZSBtYXRjaCB0eXBlcyBhcmUgbm90IHRoZSBzYW1lLlxuXHRcdFx0XHQvLyBUaGUgcHJpb3JpdHkgb2YgdGhlIG1hdGNoIHR5cGUgaXMgZ2l2ZW4gYnkgdGhlIFNldHRpbmdNYXRjaFR5cGUgZW51bS5cblx0XHRcdFx0cmV0dXJuIGIubWF0Y2hUeXBlIC0gYS5tYXRjaFR5cGU7XG5cdFx0XHR9IGVsc2UgaWYgKChhLm1hdGNoVHlwZSAmIFNldHRpbmdNYXRjaFR5cGUuTm9uQ29udGlndW91c1dvcmRzSW5TZXR0aW5nc0xhYmVsKSB8fCAoYS5tYXRjaFR5cGUgJiBTZXR0aW5nTWF0Y2hUeXBlLkNvbnRpZ3VvdXNXb3Jkc0luU2V0dGluZ3NMYWJlbCkpIHtcblx0XHRcdFx0Ly8gVGhlIG1hdGNoIHR5cGVzIG9mIGEgYW5kIGIgYXJlIHRoZSBzYW1lIGFuZCBjYW4gYmUgc29ydGVkIGJ5IHRoZWlyIG51bWJlciBvZiBtYXRjaGVkIHdvcmRzLlxuXHRcdFx0XHQvLyBJZiB0aG9zZSBudW1iZXJzIGFyZSB0aGUgc2FtZSwgc29ydCBieSB0aGUgb3JkZXIgaW4gdGhlIHRhYmxlIG9mIGNvbnRlbnRzLlxuXHRcdFx0XHRyZXR1cm4gKGIua2V5TWF0Y2hTY29yZSAtIGEua2V5TWF0Y2hTY29yZSkgfHwgY29tcGFyZVR3b051bGxhYmxlTnVtYmVycyhhLnNldHRpbmcuaW50ZXJuYWxPcmRlciwgYi5zZXR0aW5nLmludGVybmFsT3JkZXIpO1xuXHRcdFx0fSBlbHNlIGlmIChhLm1hdGNoVHlwZSA9PT0gU2V0dGluZ01hdGNoVHlwZS5SZW1vdGVNYXRjaCkge1xuXHRcdFx0XHQvLyBUaGUgbWF0Y2ggdHlwZXMgYXJlIHRoZSBzYW1lIGFuZCBhcmUgUmVtb3RlTWF0Y2guXG5cdFx0XHRcdC8vIFNvcnQgYnkgc2NvcmUuXG5cdFx0XHRcdHJldHVybiBiLnNjb3JlIC0gYS5zY29yZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRoZSBtYXRjaCB0eXBlcyBhcmUgdGhlIHNhbWUgYnV0IGFyZSBub3QgUmVtb3RlTWF0Y2guXG5cdFx0XHRcdC8vIFNvcnQgYnkgdGhlaXIgb3JkZXIgaW4gdGhlIHRhYmxlIG9mIGNvbnRlbnRzLlxuXHRcdFx0XHRyZXR1cm4gY29tcGFyZVR3b051bGxhYmxlTnVtYmVycyhhLnNldHRpbmcuaW50ZXJuYWxPcmRlciwgYi5zZXR0aW5nLmludGVybmFsT3JkZXIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gUmVtb3ZlIGR1cGxpY2F0ZXMsIHdoaWNoIHNvbWV0aW1lcyBvY2N1ciB3aXRoIHNldHRpbmdzXG5cdFx0Ly8gc3VjaCBhcyB0aGUgZXhwZXJpbWVudGFsIHRvZ2dsZSBzZXR0aW5nLlxuXHRcdHJldHVybiBhcnJheXMuZGlzdGluY3QoZmlsdGVyTWF0Y2hlcywgKG1hdGNoKSA9PiBtYXRjaC5zZXR0aW5nLmtleSk7XG5cdH1cblxuXHRnZXRVbmlxdWVSZXN1bHRzKCk6IElTZWFyY2hSZXN1bHQgfCBudWxsIHtcblx0XHRpZiAodGhpcy5jYWNoZWRVbmlxdWVTZWFyY2hSZXN1bHRzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jYWNoZWRVbmlxdWVTZWFyY2hSZXN1bHRzO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5yYXdTZWFyY2hSZXN1bHRzKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRsZXQgY29tYmluZWRGaWx0ZXJNYXRjaGVzOiBJU2V0dGluZ01hdGNoW10gPSBbXTtcblxuXHRcdGNvbnN0IGxvY2FsTWF0Y2hLZXlzID0gbmV3IFNldCgpO1xuXHRcdGNvbnN0IGxvY2FsUmVzdWx0ID0gdGhpcy5yYXdTZWFyY2hSZXN1bHRzW1NlYXJjaFJlc3VsdElkeC5Mb2NhbF07XG5cdFx0aWYgKGxvY2FsUmVzdWx0KSB7XG5cdFx0XHRsb2NhbFJlc3VsdC5maWx0ZXJNYXRjaGVzLmZvckVhY2gobSA9PiBsb2NhbE1hdGNoS2V5cy5hZGQobS5zZXR0aW5nLmtleSkpO1xuXHRcdFx0Y29tYmluZWRGaWx0ZXJNYXRjaGVzID0gbG9jYWxSZXN1bHQuZmlsdGVyTWF0Y2hlcztcblx0XHR9XG5cblx0XHRjb25zdCByZW1vdGVSZXN1bHQgPSB0aGlzLnJhd1NlYXJjaFJlc3VsdHNbU2VhcmNoUmVzdWx0SWR4LlJlbW90ZV07XG5cdFx0aWYgKHJlbW90ZVJlc3VsdCkge1xuXHRcdFx0cmVtb3RlUmVzdWx0LmZpbHRlck1hdGNoZXMgPSByZW1vdGVSZXN1bHQuZmlsdGVyTWF0Y2hlcy5maWx0ZXIobSA9PiAhbG9jYWxNYXRjaEtleXMuaGFzKG0uc2V0dGluZy5rZXkpKTtcblx0XHRcdGNvbWJpbmVkRmlsdGVyTWF0Y2hlcyA9IGNvbWJpbmVkRmlsdGVyTWF0Y2hlcy5jb25jYXQocmVtb3RlUmVzdWx0LmZpbHRlck1hdGNoZXMpO1xuXG5cdFx0XHR0aGlzLm5ld0V4dGVuc2lvblNlYXJjaFJlc3VsdHMgPSB0aGlzLnJhd1NlYXJjaFJlc3VsdHNbU2VhcmNoUmVzdWx0SWR4Lk5ld0V4dGVuc2lvbnNdO1xuXHRcdH1cblxuXHRcdGNvbWJpbmVkRmlsdGVyTWF0Y2hlcyA9IHRoaXMuc29ydFJlc3VsdHMoY29tYmluZWRGaWx0ZXJNYXRjaGVzKTtcblxuXHRcdHRoaXMuY2FjaGVkVW5pcXVlU2VhcmNoUmVzdWx0cyA9IHtcblx0XHRcdGZpbHRlck1hdGNoZXM6IGNvbWJpbmVkRmlsdGVyTWF0Y2hlcyxcblx0XHRcdGV4YWN0TWF0Y2g6IGxvY2FsUmVzdWx0LmV4YWN0TWF0Y2ggLy8gcmVtb3RlIHJlc3VsdHMgc2hvdWxkIG5ldmVyIGhhdmUgYW4gZXhhY3QgbWF0Y2hcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuY2FjaGVkVW5pcXVlU2VhcmNoUmVzdWx0cztcblx0fVxuXG5cdGdldFJhd1Jlc3VsdHMoKTogSVNlYXJjaFJlc3VsdFtdIHtcblx0XHRyZXR1cm4gdGhpcy5yYXdTZWFyY2hSZXN1bHRzID8/IFtdO1xuXHR9XG5cblx0c2V0UmVzdWx0KG9yZGVyOiBTZWFyY2hSZXN1bHRJZHgsIHJlc3VsdDogSVNlYXJjaFJlc3VsdCB8IG51bGwpOiB2b2lkIHtcblx0XHR0aGlzLmNhY2hlZFVuaXF1ZVNlYXJjaFJlc3VsdHMgPSBudWxsO1xuXHRcdHRoaXMubmV3RXh0ZW5zaW9uU2VhcmNoUmVzdWx0cyA9IG51bGw7XG5cblx0XHR0aGlzLnJhd1NlYXJjaFJlc3VsdHMgPz89IFtdO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRkZWxldGUgdGhpcy5yYXdTZWFyY2hSZXN1bHRzW29yZGVyXTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJhd1NlYXJjaFJlc3VsdHNbb3JkZXJdID0gcmVzdWx0O1xuXHRcdHRoaXMudXBkYXRlQ2hpbGRyZW4oKTtcblx0fVxuXG5cdHVwZGF0ZUNoaWxkcmVuKCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlKHtcblx0XHRcdGlkOiAnc2VhcmNoUmVzdWx0TW9kZWwnLFxuXHRcdFx0bGFiZWw6ICdzZWFyY2hSZXN1bHRNb2RlbCcsXG5cdFx0XHRzZXR0aW5nczogdGhpcy5nZXRGbGF0U2V0dGluZ3MoKVxuXHRcdH0pO1xuXG5cdFx0Ly8gU2F2ZSB0aW1lIGJ5IGZpbHRlcmluZyBjaGlsZHJlbiBpbiB0aGUgc2VhcmNoIG1vZGVsIGluc3RlYWQgb2YgcmVseWluZyBvbiB0aGUgdHJlZSBmaWx0ZXIsIHdoaWNoIHN0aWxsIHJlcXVpcmVzIGhlaWdodHMgdG8gYmUgY2FsY3VsYXRlZC5cblx0XHRjb25zdCBpc1JlbW90ZSA9ICEhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXG5cdFx0Y29uc3QgbmV3Q2hpbGRyZW4gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMucm9vdC5jaGlsZHJlbikge1xuXHRcdFx0aWYgKGNoaWxkIGluc3RhbmNlb2YgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnRcblx0XHRcdFx0JiYgY2hpbGQubWF0Y2hlc0FsbFRhZ3ModGhpcy5fdmlld1N0YXRlLnRhZ0ZpbHRlcnMpXG5cdFx0XHRcdCYmIGNoaWxkLm1hdGNoZXNTY29wZSh0aGlzLl92aWV3U3RhdGUuc2V0dGluZ3NUYXJnZXQsIGlzUmVtb3RlKVxuXHRcdFx0XHQmJiBjaGlsZC5tYXRjaGVzQW55RXh0ZW5zaW9uKHRoaXMuX3ZpZXdTdGF0ZS5leHRlbnNpb25GaWx0ZXJzKVxuXHRcdFx0XHQmJiBjaGlsZC5tYXRjaGVzQW55SWQodGhpcy5fdmlld1N0YXRlLmlkRmlsdGVycylcblx0XHRcdFx0JiYgY2hpbGQubWF0Y2hlc0FueUZlYXR1cmUodGhpcy5fdmlld1N0YXRlLmZlYXR1cmVGaWx0ZXJzKVxuXHRcdFx0XHQmJiBjaGlsZC5tYXRjaGVzQWxsTGFuZ3VhZ2VzKHRoaXMuX3ZpZXdTdGF0ZS5sYW5ndWFnZUZpbHRlcikpIHtcblx0XHRcdFx0bmV3Q2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjaGlsZC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMucm9vdC5jaGlsZHJlbiA9IG5ld0NoaWxkcmVuO1xuXHRcdHRoaXMuc2VhcmNoUmVzdWx0Q291bnQgPSB0aGlzLnJvb3QuY2hpbGRyZW4ubGVuZ3RoO1xuXG5cdFx0aWYgKHRoaXMubmV3RXh0ZW5zaW9uU2VhcmNoUmVzdWx0cz8uZmlsdGVyTWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdGxldCByZXN1bHRFeHRlbnNpb25JZHMgPSB0aGlzLm5ld0V4dGVuc2lvblNlYXJjaFJlc3VsdHMuZmlsdGVyTWF0Y2hlc1xuXHRcdFx0XHQubWFwKHJlc3VsdCA9PiAoPElFeHRlbnNpb25TZXR0aW5nPnJlc3VsdC5zZXR0aW5nKSlcblx0XHRcdFx0LmZpbHRlcihzZXR0aW5nID0+IHNldHRpbmcuZXh0ZW5zaW9uTmFtZSAmJiBzZXR0aW5nLmV4dGVuc2lvblB1Ymxpc2hlcilcblx0XHRcdFx0Lm1hcChzZXR0aW5nID0+IGAke3NldHRpbmcuZXh0ZW5zaW9uUHVibGlzaGVyfS4ke3NldHRpbmcuZXh0ZW5zaW9uTmFtZX1gKTtcblx0XHRcdHJlc3VsdEV4dGVuc2lvbklkcyA9IGFycmF5cy5kaXN0aW5jdChyZXN1bHRFeHRlbnNpb25JZHMpO1xuXG5cdFx0XHRpZiAocmVzdWx0RXh0ZW5zaW9uSWRzLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBuZXdFeHRFbGVtZW50ID0gbmV3IFNldHRpbmdzVHJlZU5ld0V4dGVuc2lvbnNFbGVtZW50KCduZXdFeHRlbnNpb25zJywgcmVzdWx0RXh0ZW5zaW9uSWRzKTtcblx0XHRcdFx0bmV3RXh0RWxlbWVudC5wYXJlbnQgPSB0aGlzLl9yb290O1xuXHRcdFx0XHR0aGlzLl9yb290LmNoaWxkcmVuLnB1c2gobmV3RXh0RWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0VW5pcXVlUmVzdWx0c0NvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuc2VhcmNoUmVzdWx0Q291bnQgPz8gMDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RmxhdFNldHRpbmdzKCk6IElTZXR0aW5nW10ge1xuXHRcdHJldHVybiB0aGlzLmdldFVuaXF1ZVJlc3VsdHMoKT8uZmlsdGVyTWF0Y2hlcy5tYXAobSA9PiBtLnNldHRpbmcpID8/IFtdO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhcnNlZFF1ZXJ5IHtcblx0dGFnczogc3RyaW5nW107XG5cdHF1ZXJ5OiBzdHJpbmc7XG5cdGV4dGVuc2lvbkZpbHRlcnM6IHN0cmluZ1tdO1xuXHRpZEZpbHRlcnM6IHN0cmluZ1tdO1xuXHRmZWF0dXJlRmlsdGVyczogc3RyaW5nW107XG5cdGxhbmd1YWdlRmlsdGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmNvbnN0IHRhZ1JlZ2V4ID0gLyhefFxccylAdGFnOihcIihbXlwiXSopXCJ8W15cIl1cXFMqKS9nO1xuY29uc3QgZXh0ZW5zaW9uUmVnZXggPSAvKF58XFxzKUBleHQ6KFwiKFteXCJdKilcInxbXlwiXVxcUyopPy9nO1xuY29uc3QgZmVhdHVyZVJlZ2V4ID0gLyhefFxccylAZmVhdHVyZTooXCIoW15cIl0qKVwifFteXCJdXFxTKik/L2c7XG5jb25zdCBpZFJlZ2V4ID0gLyhefFxccylAaWQ6KFwiKFteXCJdKilcInxbXlwiXVxcUyopPy9nO1xuY29uc3QgbGFuZ3VhZ2VSZWdleCA9IC8oXnxcXHMpQGxhbmc6KFwiKFteXCJdKilcInxbXlwiXVxcUyopPy9nO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VRdWVyeShxdWVyeTogc3RyaW5nKTogSVBhcnNlZFF1ZXJ5IHtcblx0LyoqXG5cdCAqIEEgaGVscGVyIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSBxdWVyeSBvbiBvbmUgdHlwZSBvZiByZWdleC5cblx0ICpcblx0ICogQHBhcmFtIHF1ZXJ5IFRoZSBzZWFyY2ggcXVlcnlcblx0ICogQHBhcmFtIGZpbHRlclJlZ2V4IFRoZSByZWdleCB0byB1c2Ugb24gdGhlIHF1ZXJ5XG5cdCAqIEBwYXJhbSBwYXJzZWRQYXJ0cyBUaGUgcGFydHMgdGhhdCB0aGUgcmVnZXggcGFyc2VzIG91dCB3aWxsIGJlIGFwcGVuZGVkIHRvIHRoZSBhcnJheSBwYXNzZWQgaW4gaGVyZS5cblx0ICogQHJldHVybnMgVGhlIHF1ZXJ5IHdpdGggdGhlIHBhcnNlZCBwYXJ0cyByZW1vdmVkXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRUYWdzRm9yVHlwZShxdWVyeTogc3RyaW5nLCBmaWx0ZXJSZWdleDogUmVnRXhwLCBwYXJzZWRQYXJ0czogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRcdHJldHVybiBxdWVyeS5yZXBsYWNlKGZpbHRlclJlZ2V4LCAoXywgX18sIHF1b3RlZFBhcnNlZEVsZW1lbnQsIHVucXVvdGVkUGFyc2VkRWxlbWVudCkgPT4ge1xuXHRcdFx0Y29uc3QgcGFyc2VkRWxlbWVudDogc3RyaW5nID0gdW5xdW90ZWRQYXJzZWRFbGVtZW50IHx8IHF1b3RlZFBhcnNlZEVsZW1lbnQ7XG5cdFx0XHRpZiAocGFyc2VkRWxlbWVudCkge1xuXHRcdFx0XHRwYXJzZWRQYXJ0cy5wdXNoKC4uLnBhcnNlZEVsZW1lbnQuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKHMgPT4gIWlzRmFsc3lPcldoaXRlc3BhY2UocykpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHR9KTtcblx0fVxuXG5cdGNvbnN0IHRhZ3M6IHN0cmluZ1tdID0gW107XG5cdHF1ZXJ5ID0gcXVlcnkucmVwbGFjZSh0YWdSZWdleCwgKF8sIF9fLCBxdW90ZWRUYWcsIHRhZykgPT4ge1xuXHRcdHRhZ3MucHVzaCh0YWcgfHwgcXVvdGVkVGFnKTtcblx0XHRyZXR1cm4gJyc7XG5cdH0pO1xuXG5cdHF1ZXJ5ID0gcXVlcnkucmVwbGFjZShgQCR7TU9ESUZJRURfU0VUVElOR19UQUd9YCwgKCkgPT4ge1xuXHRcdHRhZ3MucHVzaChNT0RJRklFRF9TRVRUSU5HX1RBRyk7XG5cdFx0cmV0dXJuICcnO1xuXHR9KTtcblxuXHRxdWVyeSA9IHF1ZXJ5LnJlcGxhY2UoYEAke1BPTElDWV9TRVRUSU5HX1RBR31gLCAoKSA9PiB7XG5cdFx0dGFncy5wdXNoKFBPTElDWV9TRVRUSU5HX1RBRyk7XG5cdFx0cmV0dXJuICcnO1xuXHR9KTtcblxuXHRjb25zdCBleHRlbnNpb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCBmZWF0dXJlczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgaWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCBsYW5nczogc3RyaW5nW10gPSBbXTtcblx0cXVlcnkgPSBnZXRUYWdzRm9yVHlwZShxdWVyeSwgZXh0ZW5zaW9uUmVnZXgsIGV4dGVuc2lvbnMpO1xuXHRxdWVyeSA9IGdldFRhZ3NGb3JUeXBlKHF1ZXJ5LCBmZWF0dXJlUmVnZXgsIGZlYXR1cmVzKTtcblx0cXVlcnkgPSBnZXRUYWdzRm9yVHlwZShxdWVyeSwgaWRSZWdleCwgaWRzKTtcblxuXHRpZiAoRU5BQkxFX0xBTkdVQUdFX0ZJTFRFUikge1xuXHRcdHF1ZXJ5ID0gZ2V0VGFnc0ZvclR5cGUocXVlcnksIGxhbmd1YWdlUmVnZXgsIGxhbmdzKTtcblx0fVxuXG5cdHF1ZXJ5ID0gcXVlcnkudHJpbSgpO1xuXG5cdC8vIEZvciBub3csIG9ubHkgcmV0dXJuIHRoZSBmaXJzdCBmb3VuZCBsYW5ndWFnZSBmaWx0ZXJcblx0cmV0dXJuIHtcblx0XHR0YWdzLFxuXHRcdGV4dGVuc2lvbkZpbHRlcnM6IGV4dGVuc2lvbnMsXG5cdFx0ZmVhdHVyZUZpbHRlcnM6IGZlYXR1cmVzLFxuXHRcdGlkRmlsdGVyczogaWRzLFxuXHRcdGxhbmd1YWdlRmlsdGVyOiBsYW5ncy5sZW5ndGggPyBsYW5nc1swXSA6IHVuZGVmaW5lZCxcblx0XHRxdWVyeSxcblx0fTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsd0JBQXdCLDJCQUEyQjtBQUM1RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywyQkFBZ0Q7QUFFekQsU0FBb0IsZUFBZSxtQkFBbUIsZUFBZTtBQUNyRSxTQUFTLGtDQUFrQyx3QkFBd0Isc0JBQXNCLG9CQUFvQix1Q0FBdUMsaUNBQWlDO0FBQ3JMLFNBQW9FLGtCQUFrQix3QkFBd0I7QUFDOUcsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxlQUFlLGtCQUFrQix1QkFBdUIsc0JBQXNCLGdDQUFnQywwQkFBMEI7QUFFakosU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxlQUFlO0FBQ3hCLFNBQTBDLG9CQUFvQix1QkFBdUIsa0JBQTBDO0FBQy9ILFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0NBQXNDO0FBRXhDLE1BQU0sOEJBQThCO0FBYXBDLE1BQWUsNEJBQTRCLFdBQVc7QUFBQSxFQVE1RCxZQUFZLEtBQWE7QUFDeEIsVUFBTTtBQUxQLFNBQVEsWUFBWTtBQUNwQixTQUFtQix1QkFBdUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQzVFLFNBQVMsc0JBQXNCLEtBQUsscUJBQXFCO0FBSXhELFNBQUssS0FBSztBQUFBLEVBQ1g7QUFBQSxFQUVBLElBQUksV0FBb0I7QUFDdkIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxTQUFTLE9BQWdCO0FBQzVCLFNBQUssWUFBWTtBQUNqQixTQUFLLHFCQUFxQixLQUFLO0FBQUEsRUFDaEM7QUFDRDtBQUlPLE1BQU0saUNBQWlDLG9CQUFvQjtBQUFBLEVBd0JqRSxZQUFZLEtB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dkU7QUFDRDtBQXRLYSxvQkFBTjtBQUFBLEVBYUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FqQlU7QUFpTGIsTUFBTSxXQUFXO0FBQ2pCLE1BQU0saUJBQWlCO0FBQ3ZCLE1BQU0sZUFBZTtBQUNyQixNQUFNLFVBQVU7QUFDaEIsTUFBTSxnQkFBZ0I7QUFFZixTQUFTLFdBQVcsT0FBNkI7QUFTdkQsV0FBUyxlQUFlQyxRQUFlLGFBQXFCLGFBQStCO0FBQzFGLFdBQU9BLE9BQU0sUUFBUSxhQUFhLENBQUMsR0FBRyxJQUFJLHFCQUFxQiwwQkFBMEI7QUFDeEYsWUFBTSxnQkFBd0IseUJBQXlCO0FBQ3ZELFVBQUksZUFBZTtBQUNsQixvQkFBWSxLQUFLLEdBQUcsY0FBYyxNQUFNLEdBQUcsRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUNyRztBQUNBLGFBQU87QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNGO0FBRUEsUUFBTSxPQUFpQixDQUFDO0FBQ3hCLFVBQVEsTUFBTSxRQUFRLFVBQVUsQ0FBQyxHQUFHLElBQUksV0FBVyxRQUFRO0FBQzFELFNBQUssS0FBSyxPQUFPLFNBQVM7QUFDMUIsV0FBTztBQUFBLEVBQ1IsQ0FBQztBQUVELFVBQVEsTUFBTSxRQUFRLElBQUksb0JBQW9CLElBQUksTUFBTTtBQUN2RCxTQUFLLEtBQUssb0JBQW9CO0FBQzlCLFdBQU87QUFBQSxFQUNSLENBQUM7QUFFRCxVQUFRLE1BQU0sUUFBUSxJQUFJLGtCQUFrQixJQUFJLE1BQU07QUFDckQsU0FBSyxLQUFLLGtCQUFrQjtBQUM1QixXQUFPO0FBQUEsRUFDUixDQUFDO0FBRUQsUUFBTSxhQUF1QixDQUFDO0FBQzlCLFFBQU0sV0FBcUIsQ0FBQztBQUM1QixRQUFNLE1BQWdCLENBQUM7QUFDdkIsUUFBTSxRQUFrQixDQUFDO0FBQ3pCLFVBQVEsZUFBZSxPQUFPLGdCQUFnQixVQUFVO0FBQ3hELFVBQVEsZUFBZSxPQUFPLGNBQWMsUUFBUTtBQUNwRCxVQUFRLGVBQWUsT0FBTyxTQUFTLEdBQUc7QUFFMUMsTUFBSSx3QkFBd0I7QUFDM0IsWUFBUSxlQUFlLE9BQU8sZUFBZSxLQUFLO0FBQUEsRUFDbkQ7QUFFQSxVQUFRLE1BQU0sS0FBSztBQUduQixTQUFPO0FBQUEsSUFDTjtBQUFBLElBQ0Esa0JBQWtCO0FBQUEsSUFDbEIsZ0JBQWdCO0FBQUEsSUFDaEIsV0FBVztBQUFBLElBQ1gsZ0JBQWdCLE1BQU0sU0FBUyxNQUFNLENBQUMsSUFBSTtBQUFBLElBQzFDO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJmZWF0dXJlIiwgInR5cGUiLCAiU2VhcmNoUmVzdWx0SWR4IiwgInF1ZXJ5Il0KfQo=
