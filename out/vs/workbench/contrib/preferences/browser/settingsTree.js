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
import { BrowserFeatures } from "../../../../base/browser/canIUse.js";
import * as DOM from "../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { renderMarkdownAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { SimpleIconLabel } from "../../../../base/browser/ui/iconLabel/simpleIconLabel.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { CachedListVirtualDelegate } from "../../../../base/browser/ui/list/list.js";
import { DefaultStyleController } from "../../../../base/browser/ui/list/listWidget.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { Toggle, unthemedToggleStyles } from "../../../../base/browser/ui/toggle/toggle.js";
import { ToolBar } from "../../../../base/browser/ui/toolbar/toolbar.js";
import { RenderIndentGuides } from "../../../../base/browser/ui/tree/abstractTree.js";
import { ObjectTreeModel } from "../../../../base/browser/ui/tree/objectTreeModel.js";
import { TreeVisibility } from "../../../../base/browser/ui/tree/tree.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { distinct } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, isDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isIOS } from "../../../../base/common/platform.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { isDefined, isUndefinedOrNull } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService, getLanguageTagSettingPlainKey } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IListService, WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles, getInputBoxStyle, getListStyles, getSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorBackground, foreground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { getIgnoredSettings } from "../../../../platform/userDataSync/common/settingsMerge.js";
import { IUserDataSyncEnablementService, getDefaultIgnoredSettings } from "../../../../platform/userDataSync/common/userDataSync.js";
import { APPLICATION_SCOPES, APPLY_ALL_PROFILES_SETTING, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { SETTINGS_AUTHORITY, SettingValueType } from "../../../services/preferences/common/preferences.js";
import { getInvalidTypeError } from "../../../services/preferences/common/preferencesValidation.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { LANGUAGE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU, compareTwoNullableNumbers } from "../common/preferences.js";
import { settingsNumberInputBackground, settingsNumberInputBorder, settingsNumberInputForeground, settingsSelectBackground, settingsSelectBorder, settingsSelectForeground, settingsSelectListBorder, settingsTextInputBackground, settingsTextInputBorder, settingsTextInputForeground } from "../common/settingsEditorColorRegistry.js";
import { settingsMoreActionIcon } from "./preferencesIcons.js";
import { SettingsTreeIndicatorsLabel, getIndicatorsLabelAriaLabel } from "./settingsEditorSettingIndicators.js";
import { SettingsTreeGroupElement, SettingsTreeNewExtensionsElement, SettingsTreeSettingElement, inspectSetting, objectSettingSupportsRemoveDefaultValue, settingKeyToDisplayFormat } from "./settingsTreeModels.js";
import { ExcludeSettingWidget, IncludeSettingWidget, ListSettingWidget, ObjectSettingCheckboxWidget, ObjectSettingDropdownWidget } from "./settingsWidgets.js";
const $ = DOM.$;
function getIncludeExcludeDisplayValue(element) {
  const elementDefaultValue = typeof element.defaultValue === "object" ? element.defaultValue ?? {} : {};
  const data = element.isConfigured ? { ...elementDefaultValue, ...element.scopeValue } : elementDefaultValue;
  return Object.keys(data).filter((key) => !!data[key]).map((key) => {
    const defaultValue = elementDefaultValue[key];
    let source;
    if (defaultValue === data[key] && element.setting.type === "object" && element.defaultValueSource instanceof Map) {
      const defaultSource = element.defaultValueSource.get(`${element.setting.key}.${key}`);
      source = typeof defaultSource === "string" ? defaultSource : defaultSource?.displayName;
    }
    const value = data[key];
    const sibling = typeof value === "boolean" ? void 0 : value.when;
    return {
      value: {
        type: "string",
        data: key
      },
      sibling,
      elementType: element.valueType,
      source
    };
  });
}
function areAllPropertiesDefined(properties, itemsToDisplay) {
  const staticProperties = new Set(properties);
  itemsToDisplay.forEach(({ key }) => staticProperties.delete(key.data));
  return staticProperties.size === 0;
}
function getEnumOptionsFromSchema(schema) {
  if (schema.anyOf) {
    return schema.anyOf.map(getEnumOptionsFromSchema).flat();
  }
  const enumDescriptions = schema.enumDescriptions ?? [];
  return (schema.enum ?? []).map((value, idx) => {
    const description = idx < enumDescriptions.length ? enumDescriptions[idx] : void 0;
    return { value, description };
  });
}
function getObjectValueType(schema) {
  if (schema.anyOf) {
    const subTypes = schema.anyOf.map(getObjectValueType);
    if (subTypes.some((type) => type === "enum")) {
      return "enum";
    }
    return "string";
  }
  if (schema.type === "boolean") {
    return "boolean";
  } else if (schema.type === "string" && isDefined(schema.enum) && schema.enum.length > 0) {
    return "enum";
  } else {
    return "string";
  }
}
function getObjectEntryValueDisplayValue(type, data, options) {
  if (type === "boolean") {
    return { type, data: !!data };
  } else if (type === "enum") {
    return { type, data: "" + data, options };
  } else {
    return { type, data: "" + data };
  }
}
function getObjectDisplayValue(element) {
  const elementDefaultValue = typeof element.defaultValue === "object" ? element.defaultValue ?? {} : {};
  const elementScopeValue = typeof element.scopeValue === "object" ? element.scopeValue ?? {} : {};
  const data = element.isConfigured ? { ...elementDefaultValue, ...elementScopeValue } : element.hasPolicyValue ? element.scopeValue : elementDefaultValue;
  const { objectProperties, objectPatternProperties, objectAdditionalProperties } = element.setting;
  const patternsAndSchemas = Object.entries(objectPatternProperties ?? {}).map(([pattern, schema]) => ({
    pattern: new RegExp(pattern),
    schema
  }));
  const wellDefinedKeyEnumOptions = Object.entries(objectProperties ?? {}).map(
    ([key, schema]) => ({ value: key, description: schema.description })
  );
  return Object.keys(data).map((key) => {
    const defaultValue = elementDefaultValue[key];
    let source;
    if (defaultValue === data[key] && element.setting.type === "object" && element.defaultValueSource instanceof Map) {
      const defaultSource = element.defaultValueSource.get(`${element.setting.key}.${key}`);
      source = typeof defaultSource === "string" ? defaultSource : defaultSource?.displayName;
    }
    if (isDefined(objectProperties) && key in objectProperties) {
      const valueEnumOptions = getEnumOptionsFromSchema(objectProperties[key]);
      return {
        key: {
          type: "enum",
          data: key,
          options: wellDefinedKeyEnumOptions
        },
        value: getObjectEntryValueDisplayValue(getObjectValueType(objectProperties[key]), data[key], valueEnumOptions),
        keyDescription: objectProperties[key].description,
        removable: isUndefinedOrNull(defaultValue),
        resetable: !isUndefinedOrNull(defaultValue),
        source
      };
    }
    const removable = defaultValue === void 0 || objectSettingSupportsRemoveDefaultValue(element.setting.key);
    const resetable = !!defaultValue && defaultValue !== data[key];
    const schema = patternsAndSchemas.find(({ pattern }) => pattern.test(key))?.schema;
    if (schema) {
      const valueEnumOptions = getEnumOptionsFromSchema(schema);
      return {
        key: { type: "string", data: key },
        value: getObjectEntryValueDisplayValue(getObjectValueType(schema), data[key], valueEnumOptions),
        keyDescription: schema.description,
        removable,
        resetable,
        source
      };
    }
    const additionalValueEnums = getEnumOptionsFromSchema(
      typeof objectAdditionalProperties === "boolean" ? {} : objectAdditionalProperties ?? {}
    );
    return {
      key: { type: "string", data: key },
      value: getObjectEntryValueDisplayValue(
        typeof objectAdditionalProperties === "object" ? getObjectValueType(objectAdditionalProperties) : "string",
        data[key],
        additionalValueEnums
      ),
      keyDescription: typeof objectAdditionalProperties === "object" ? objectAdditionalProperties.description : void 0,
      removable,
      resetable,
      source
    };
  }).filter((item) => !isUndefinedOrNull(item.value.data));
}
function getBoolObjectDisplayValue(element) {
  const elementDefaultValue = typeof element.defaultValue === "object" ? element.defaultValue ?? {} : {};
  const elementScopeValue = typeof element.scopeValue === "object" ? element.scopeValue ?? {} : {};
  const data = element.isConfigured ? { ...elementDefaultValue, ...elementScopeValue } : elementDefaultValue;
  const { objectProperties } = element.setting;
  const displayValues = [];
  for (const key in objectProperties) {
    const defaultValue = elementDefaultValue[key];
    let source;
    if (defaultValue === data[key] && element.setting.type === "object" && element.defaultValueSource instanceof Map) {
      const defaultSource = element.defaultValueSource.get(key);
      source = typeof defaultSource === "string" ? defaultSource : defaultSource?.displayName;
    }
    displayValues.push({
      key: {
        type: "string",
        data: key
      },
      value: {
        type: "boolean",
        data: !!data[key]
      },
      keyDescription: objectProperties[key].description,
      removable: false,
      resetable: true,
      source
    });
  }
  return displayValues;
}
function createArraySuggester(element) {
  return (keys, idx) => {
    const enumOptions = [];
    if (element.setting.enum) {
      element.setting.enum.forEach((key, i) => {
        if (!element.setting.uniqueItems || idx !== void 0 && key === keys[idx] || !keys.includes(key)) {
          const description = element.setting.enumDescriptions?.[i];
          enumOptions.push({ value: key, description });
        }
      });
    }
    return enumOptions.length > 0 ? { type: "enum", data: enumOptions[0].value, options: enumOptions } : void 0;
  };
}
function createObjectKeySuggester(element) {
  const { objectProperties } = element.setting;
  const allStaticKeys = Object.keys(objectProperties ?? {});
  return (keys) => {
    const existingKeys = new Set(keys);
    const enumOptions = [];
    allStaticKeys.forEach((staticKey) => {
      if (!existingKeys.has(staticKey)) {
        enumOptions.push({ value: staticKey, description: objectProperties[staticKey].description });
      }
    });
    return enumOptions.length > 0 ? { type: "enum", data: enumOptions[0].value, options: enumOptions } : void 0;
  };
}
function createObjectValueSuggester(element) {
  const { objectProperties, objectPatternProperties, objectAdditionalProperties } = element.setting;
  const patternsAndSchemas = Object.entries(objectPatternProperties ?? {}).map(([pattern, schema]) => ({
    pattern: new RegExp(pattern),
    schema
  }));
  return (key) => {
    let suggestedSchema;
    if (isDefined(objectProperties) && key in objectProperties) {
      suggestedSchema = objectProperties[key];
    }
    const patternSchema = suggestedSchema ?? patternsAndSchemas.find(({ pattern }) => pattern.test(key))?.schema;
    if (isDefined(patternSchema)) {
      suggestedSchema = patternSchema;
    } else if (isDefined(objectAdditionalProperties) && typeof objectAdditionalProperties === "object") {
      suggestedSchema = objectAdditionalProperties;
    }
    if (isDefined(suggestedSchema)) {
      const type = getObjectValueType(suggestedSchema);
      if (type === "boolean") {
        return { type, data: suggestedSchema.default ?? true };
      } else if (type === "enum") {
        const options = getEnumOptionsFromSchema(suggestedSchema);
        return { type, data: suggestedSchema.default ?? options[0].value, options };
      } else {
        return { type, data: suggestedSchema.default ?? "" };
      }
    }
    return;
  };
}
function isNonNullableNumericType(type) {
  return type === "number" || type === "integer";
}
function parseNumericObjectValues(dataElement, v) {
  const newRecord = {};
  for (const key in v) {
    let keyMatchesNumericProperty;
    const patternProperties = dataElement.setting.objectPatternProperties;
    const properties = dataElement.setting.objectProperties;
    const additionalProperties = dataElement.setting.objectAdditionalProperties;
    if (properties) {
      for (const propKey in properties) {
        if (propKey === key) {
          keyMatchesNumericProperty = isNonNullableNumericType(properties[propKey].type);
          break;
        }
      }
    }
    if (keyMatchesNumericProperty === void 0 && patternProperties) {
      for (const patternKey in patternProperties) {
        if (key.match(patternKey)) {
          keyMatchesNumericProperty = isNonNullableNumericType(patternProperties[patternKey].type);
          break;
        }
      }
    }
    if (keyMatchesNumericProperty === void 0 && additionalProperties && typeof additionalProperties !== "boolean") {
      if (isNonNullableNumericType(additionalProperties.type)) {
        keyMatchesNumericProperty = true;
      }
    }
    newRecord[key] = keyMatchesNumericProperty ? Number(v[key]) : v[key];
  }
  return newRecord;
}
function getListDisplayValue(element) {
  if (!element.value || !Array.isArray(element.value)) {
    return [];
  }
  if (element.setting.arrayItemType === "enum") {
    let enumOptions = [];
    if (element.setting.enum) {
      enumOptions = element.setting.enum.map((setting, i) => {
        return {
          value: setting,
          description: element.setting.enumDescriptions?.[i]
        };
      });
    }
    return element.value.map((key) => {
      return {
        value: {
          type: "enum",
          data: key,
          options: enumOptions
        }
      };
    });
  } else {
    return element.value.map((key) => {
      return {
        value: {
          type: "string",
          data: key
        }
      };
    });
  }
}
function getShowAddButtonList(dataElement, listDisplayValue) {
  if (dataElement.setting.enum && dataElement.setting.uniqueItems) {
    return dataElement.setting.enum.length - listDisplayValue.length > 0;
  } else {
    return true;
  }
}
function resolveSettingsTree(tocData, coreSettingsGroups, logService) {
  const allSettings = getFlatSettings(coreSettingsGroups);
  return {
    tree: _resolveSettingsTree(tocData, allSettings, logService),
    leftoverSettings: allSettings
  };
}
function resolveConfiguredUntrustedSettings(groups, target, languageFilter, configurationService) {
  const allSettings = getFlatSettings(groups);
  return [...allSettings].filter((setting) => setting.restricted && inspectSetting(setting.key, target, languageFilter, configurationService).isConfigured);
}
async function createTocTreeForExtensionSettings(extensionService, groups) {
  const extGroupTree = /* @__PURE__ */ new Map();
  const addEntryToTree = (extensionId, extensionName, childEntry) => {
    if (!extGroupTree.has(extensionId)) {
      const rootEntry = {
        id: extensionId,
        label: extensionName,
        children: []
      };
      extGroupTree.set(extensionId, rootEntry);
    }
    extGroupTree.get(extensionId).children.push(childEntry);
  };
  const processGroupEntry = async (group) => {
    const flatSettings = group.sections.map((section) => section.settings).flat();
    const extensionId = group.extensionInfo.id;
    const extension = await extensionService.getExtension(extensionId);
    const extensionName = extension?.displayName ?? extension?.name ?? extensionId;
    const settingGroupId = group.id && group.id !== extensionId ? group.id : group.title;
    const childEntry = {
      id: settingGroupId,
      label: group.title,
      order: group.order,
      settings: flatSettings
    };
    addEntryToTree(extensionId, extensionName, childEntry);
  };
  const processPromises = groups.map((g) => processGroupEntry(g));
  return Promise.all(processPromises).then(() => {
    const extGroups = [];
    for (const extensionRootEntry of extGroupTree.values()) {
      for (const child of extensionRootEntry.children) {
        child.settings?.sort((a, b) => {
          return compareTwoNullableNumbers(a.order, b.order);
        });
      }
      if (extensionRootEntry.children.length === 1) {
        extGroups.push({
          id: extensionRootEntry.id,
          label: extensionRootEntry.children[0].label,
          settings: extensionRootEntry.children[0].settings
        });
      } else {
        extensionRootEntry.children.sort((a, b) => {
          return compareTwoNullableNumbers(a.order, b.order);
        });
        const ungroupedChild = extensionRootEntry.children.find((child) => child.label === extensionRootEntry.label);
        if (ungroupedChild && !ungroupedChild.children) {
          const groupedChildren = extensionRootEntry.children.filter((child) => child !== ungroupedChild);
          extGroups.push({
            id: extensionRootEntry.id,
            label: extensionRootEntry.label,
            settings: ungroupedChild.settings,
            children: groupedChildren
          });
        } else {
          extGroups.push(extensionRootEntry);
        }
      }
    }
    extGroups.sort((a, b) => a.label.localeCompare(b.label));
    return {
      id: "extensions",
      label: localize("extensions", "Extensions"),
      children: extGroups
    };
  });
}
function _resolveSettingsTree(tocData, allSettings, logService) {
  let children;
  if (tocData.children) {
    children = tocData.children.filter((child) => child.hide !== true).map((child) => _resolveSettingsTree(child, allSettings, logService)).filter((child) => child.children?.length || child.settings?.length);
  }
  let settings;
  if (tocData.settings) {
    settings = tocData.settings.map((pattern) => getMatchingSettings(allSettings, pattern, logService)).flat();
  }
  if (!children && !settings) {
    throw new Error(`TOC node has no child groups or settings: ${tocData.id}`);
  }
  return {
    id: tocData.id,
    label: tocData.label,
    children,
    settings
  };
}
const knownDynamicSettingGroups = [
  /^settingsSync\..*/,
  /^sync\..*/,
  /^workbench.fontAliasing$/
];
function getMatchingSettings(allSettings, pattern, logService) {
  const result = [];
  allSettings.forEach((s) => {
    if (settingMatches(s, pattern)) {
      result.push(s);
      allSettings.delete(s);
    }
  });
  if (!result.length && !knownDynamicSettingGroups.some((r) => r.test(pattern))) {
    logService.warn(`Settings pattern "${pattern}" doesn't match any settings`);
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}
const settingPatternCache = /* @__PURE__ */ new Map();
function createSettingMatchRegExp(pattern) {
  pattern = escapeRegExpCharacters(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${pattern}$`, "i");
}
function settingMatches(s, pattern) {
  let regExp = settingPatternCache.get(pattern);
  if (!regExp) {
    regExp = createSettingMatchRegExp(pattern);
    settingPatternCache.set(pattern, regExp);
  }
  return regExp.test(s.key);
}
function getFlatSettings(settingsGroups) {
  const result = /* @__PURE__ */ new Set();
  for (const group of settingsGroups) {
    for (const section of group.sections) {
      for (const s of section.settings) {
        if (!s.overrides || !s.overrides.length) {
          result.add(s);
        }
      }
    }
  }
  return result;
}
const SETTINGS_TEXT_TEMPLATE_ID = "settings.text.template";
const SETTINGS_MULTILINE_TEXT_TEMPLATE_ID = "settings.multilineText.template";
const SETTINGS_NUMBER_TEMPLATE_ID = "settings.number.template";
const SETTINGS_ENUM_TEMPLATE_ID = "settings.enum.template";
const SETTINGS_BOOL_TEMPLATE_ID = "settings.bool.template";
const SETTINGS_ARRAY_TEMPLATE_ID = "settings.array.template";
const SETTINGS_EXCLUDE_TEMPLATE_ID = "settings.exclude.template";
const SETTINGS_INCLUDE_TEMPLATE_ID = "settings.include.template";
const SETTINGS_OBJECT_TEMPLATE_ID = "settings.object.template";
const SETTINGS_BOOL_OBJECT_TEMPLATE_ID = "settings.boolObject.template";
const SETTINGS_COMPLEX_TEMPLATE_ID = "settings.complex.template";
const SETTINGS_COMPLEX_OBJECT_TEMPLATE_ID = "settings.complexObject.template";
const SETTINGS_NEW_EXTENSIONS_TEMPLATE_ID = "settings.newExtensions.template";
const SETTINGS_ELEMENT_TEMPLATE_ID = "settings.group.template";
const SETTINGS_EXTENSION_TOGGLE_TEMPLATE_ID = "settings.extensionToggle.template";
function removeChildrenFromTabOrder(node) {
  const focusableElements = node.querySelectorAll(`
		[tabindex="0"],
		input:not([tabindex="-1"]),
		select:not([tabindex="-1"]),
		textarea:not([tabindex="-1"]),
		a:not([tabindex="-1"]),
		button:not([tabindex="-1"]),
		area:not([tabindex="-1"])
	`);
  focusableElements.forEach((element) => {
    element.setAttribute(AbstractSettingRenderer.ELEMENT_FOCUSABLE_ATTR, "true");
    element.setAttribute("tabindex", "-1");
  });
}
function addChildrenToTabOrder(node) {
  const focusableElements = node.querySelectorAll(
    `[${AbstractSettingRenderer.ELEMENT_FOCUSABLE_ATTR}="true"]`
  );
  focusableElements.forEach((element) => {
    element.removeAttribute(AbstractSettingRenderer.ELEMENT_FOCUSABLE_ATTR);
    element.setAttribute("tabindex", "0");
  });
}
let AbstractSettingRenderer = class extends Disposable {
  constructor(settingActions, disposableActionFactory, _themeService, _contextViewService, _openerService, _instantiationService, _commandService, _contextMenuService, _keybindingService, _configService, _extensionsService, _extensionsWorkbenchService, _productService, _telemetryService, _hoverService) {
    super();
    this.settingActions = settingActions;
    this.disposableActionFactory = disposableActionFactory;
    this._themeService = _themeService;
    this._contextViewService = _contextViewService;
    this._openerService = _openerService;
    this._instantiationService = _instantiationService;
    this._commandService = _commandService;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._configService = _configService;
    this._extensionsService = _extensionsService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._productService = _productService;
    this._telemetryService = _telemetryService;
    this._hoverService = _hoverService;
    this._onDidClickOverrideElement = this._register(new Emitter());
    this.onDidClickOverrideElement = this._onDidClickOverrideElement.event;
    this._onDidChangeSetting = this._register(new Emitter());
    this.onDidChangeSetting = this._onDidChangeSetting.event;
    this._onDidOpenSettings = this._register(new Emitter());
    this.onDidOpenSettings = this._onDidOpenSettings.event;
    this._onDidClickSettingLink = this._register(new Emitter());
    this.onDidClickSettingLink = this._onDidClickSettingLink.event;
    this._onDidFocusSetting = this._register(new Emitter());
    this.onDidFocusSetting = this._onDidFocusSetting.event;
    this._onDidChangeIgnoredSettings = this._register(new Emitter());
    this.onDidChangeIgnoredSettings = this._onDidChangeIgnoredSettings.event;
    this._onDidChangeSettingHeight = this._register(new Emitter());
    this.onDidChangeSettingHeight = this._onDidChangeSettingHeight.event;
    this._onApplyFilter = this._register(new Emitter());
    this.onApplyFilter = this._onApplyFilter.event;
    this.markdownRenderer = _instantiationService.createInstance(MarkdownRenderer, {});
    this.ignoredSettings = getIgnoredSettings(getDefaultIgnoredSettings(), this._configService);
    this._register(this._configService.onDidChangeConfiguration((e) => {
      this.ignoredSettings = getIgnoredSettings(getDefaultIgnoredSettings(), this._configService);
      this._onDidChangeIgnoredSettings.fire();
    }));
  }
  renderCommonTemplate(tree, _container, typeClass) {
    _container.classList.add("setting-item");
    _container.classList.add("setting-item-" + typeClass);
    const toDispose = new DisposableStore();
    const container = DOM.append(_container, $(AbstractSettingRenderer.CONTENTS_SELECTOR));
    container.classList.add("settings-row-inner-container");
    const titleElement = DOM.append(container, $(".setting-item-title"));
    const labelCategoryContainer = DOM.append(titleElement, $(".setting-item-cat-label-container"));
    const categoryElement = DOM.append(labelCategoryContainer, $("span.setting-item-category"));
    const labelElementContainer = DOM.append(labelCategoryContainer, $("span.setting-item-label"));
    const labelElement = toDispose.add(new SimpleIconLabel(labelElementContainer));
    const indicatorsLabel = toDispose.add(this._instantiationService.createInstance(SettingsTreeIndicatorsLabel, titleElement));
    const descriptionElement = DOM.append(container, $(".setting-item-description"));
    const modifiedIndicatorElement = DOM.append(container, $(".setting-item-modified-indicator"));
    toDispose.add(this._hoverService.setupDelayedHover(modifiedIndicatorElement, {
      content: localize("modified", "The setting has been configured in the current scope.")
    }));
    const valueElement = DOM.append(container, $(".setting-item-value"));
    const controlElement = DOM.append(valueElement, $("div.setting-item-control"));
    const deprecationWarningElement = DOM.append(container, $(".setting-item-deprecation-message"));
    const toolbarContainer = DOM.append(container, $(".setting-toolbar-container"));
    const toolbar = this.renderSettingToolbar(toolbarContainer);
    const template = {
      toDispose,
      elementDisposables: toDispose.add(new DisposableStore()),
      containerElement: container,
      categoryElement,
      labelElement,
      descriptionElement,
      controlElement,
      deprecationWarningElement,
      indicatorsLabel,
      toolbar
    };
    toDispose.add(DOM.addDisposableListener(controlElement, DOM.EventType.MOUSE_DOWN, (e) => e.stopPropagation()));
    toDispose.add(DOM.addDisposableListener(titleElement, DOM.EventType.MOUSE_ENTER, (e) => container.classList.add("mouseover")));
    toDispose.add(DOM.addDisposableListener(titleElement, DOM.EventType.MOUSE_LEAVE, (e) => container.classList.remove("mouseover")));
    return template;
  }
  addSettingElementFocusHandler(template) {
    const focusTracker = DOM.trackFocus(template.containerElement);
    template.toDispose.add(focusTracker);
    template.toDispose.add(focusTracker.onDidBlur(() => {
      if (template.containerElement.classList.contains("focused")) {
        template.containerElement.classList.remove("focused");
      }
    }));
    template.toDispose.add(focusTracker.onDidFocus(() => {
      template.containerElement.classList.add("focused");
      if (template.context) {
        this._onDidFocusSetting.fire(template.context);
      }
    }));
  }
  renderSettingToolbar(container) {
    const toggleMenuKeybinding = this._keybindingService.lookupKeybinding(SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU);
    let toggleMenuTitle = localize("settingsContextMenuTitle", "More Actions... ");
    if (toggleMenuKeybinding) {
      toggleMenuTitle += ` (${toggleMenuKeybinding && toggleMenuKeybinding.getLabel()})`;
    }
    const toolbar = new ToolBar(container, this._contextMenuService, {
      toggleMenuTitle,
      renderDropdownAsChildElement: !isIOS,
      moreIcon: settingsMoreActionIcon
    });
    return toolbar;
  }
  renderSettingElement(node, index, template) {
    const element = node.element;
    element.inspectSelf();
    template.context = element;
    template.toolbar.context = element;
    const actions = this.disposableActionFactory(element.setting, element.settingsTarget);
    actions.forEach((a) => isDisposable(a) && template.elementDisposables.add(a));
    template.toolbar.setActions([], [...this.settingActions, ...actions]);
    const setting = element.setting;
    template.containerElement.classList.toggle("is-configured", element.isConfigured);
    template.containerElement.setAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR, element.setting.key);
    template.containerElement.setAttribute(AbstractSettingRenderer.SETTING_ID_ATTR, element.id);
    const titleTooltip = setting.key + (element.isConfigured ? " - Modified" : "");
    template.categoryElement.textContent = element.displayCategory ? element.displayCategory + ": " : "";
    template.elementDisposables.add(this._hoverService.setupDelayedHover(template.categoryElement, { content: titleTooltip }));
    template.labelElement.text = element.displayLabel;
    template.labelElement.title = titleTooltip;
    template.descriptionElement.innerText = "";
    if (element.setting.descriptionIsMarkdown) {
      const renderedDescription = this.renderSettingMarkdown(element, template.containerElement, element.description, template.elementDisposables);
      template.descriptionElement.appendChild(renderedDescription);
    } else {
      template.descriptionElement.innerText = element.description;
    }
    template.indicatorsLabel.updateScopeOverrides(element, this._onDidClickOverrideElement, this._onApplyFilter);
    template.elementDisposables.add(this._configService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(APPLY_ALL_PROFILES_SETTING)) {
        template.indicatorsLabel.updateScopeOverrides(element, this._onDidClickOverrideElement, this._onApplyFilter);
      }
    }));
    const onChange = (value) => this._onDidChangeSetting.fire({
      key: element.setting.key,
      value,
      type: template.context.valueType,
      manualReset: false,
      scope: element.setting.scope
    });
    const deprecationText = element.setting.deprecationMessage || "";
    if (deprecationText && element.setting.deprecationMessageIsMarkdown) {
      template.deprecationWarningElement.innerText = "";
      template.deprecationWarningElement.appendChild(this.renderSettingMarkdown(element, template.containerElement, element.setting.deprecationMessage, template.elementDisposables));
    } else {
      template.deprecationWarningElement.innerText = deprecationText;
    }
    template.deprecationWarningElement.prepend($(".codicon.codicon-error"));
    template.containerElement.classList.toggle("is-deprecated", !!deprecationText);
    this.renderValue(element, template, onChange);
    template.indicatorsLabel.updateWorkspaceTrust(element);
    template.indicatorsLabel.updateSyncIgnored(element, this.ignoredSettings);
    template.indicatorsLabel.updateDefaultOverrideIndicator(element);
    template.indicatorsLabel.updatePreviewIndicator(element);
    template.elementDisposables.add(this.onDidChangeIgnoredSettings(() => {
      template.indicatorsLabel.updateSyncIgnored(element, this.ignoredSettings);
    }));
    this.updateSettingTabbable(element, template);
    template.elementDisposables.add(element.onDidChangeTabbable(() => {
      this.updateSettingTabbable(element, template);
    }));
  }
  updateSettingTabbable(element, template) {
    if (element.tabbable) {
      addChildrenToTabOrder(template.containerElement);
    } else {
      removeChildrenFromTabOrder(template.containerElement);
    }
  }
  renderSettingMarkdown(element, container, text, disposables) {
    text = fixSettingLinks(text);
    const renderedMarkdown = this.markdownRenderer.render({ value: text, isTrusted: true }, {
      actionHandler: {
        callback: (content) => {
          if (content.startsWith("#")) {
            const e = {
              source: element,
              targetKey: content.substring(1)
            };
            this._onDidClickSettingLink.fire(e);
          } else {
            this._openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);
          }
        },
        disposables
      },
      asyncRenderCallback: () => {
        const height = container.clientHeight;
        if (height) {
          this._onDidChangeSettingHeight.fire({ element, height });
        }
      }
    });
    disposables.add(renderedMarkdown);
    renderedMarkdown.element.classList.add("setting-item-markdown");
    cleanRenderedMarkdown(renderedMarkdown.element);
    return renderedMarkdown.element;
  }
  disposeTemplate(template) {
    template.toDispose.dispose();
  }
  disposeElement(_element, _index, template, _height) {
    template.elementDisposables?.clear();
  }
};
AbstractSettingRenderer.CONTROL_CLASS = "setting-control-focus-target";
AbstractSettingRenderer.CONTROL_SELECTOR = "." + AbstractSettingRenderer.CONTROL_CLASS;
AbstractSettingRenderer.CONTENTS_CLASS = "setting-item-contents";
AbstractSettingRenderer.CONTENTS_SELECTOR = "." + AbstractSettingRenderer.CONTENTS_CLASS;
AbstractSettingRenderer.ALL_ROWS_SELECTOR = ".monaco-list-row";
AbstractSettingRenderer.SETTING_KEY_ATTR = "data-key";
AbstractSettingRenderer.SETTING_ID_ATTR = "data-id";
AbstractSettingRenderer.ELEMENT_FOCUSABLE_ATTR = "data-focusable";
AbstractSettingRenderer = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IExtensionsWorkbenchService),
  __decorateParam(12, IProductService),
  __decorateParam(13, ITelemetryService),
  __decorateParam(14, IHoverService)
], AbstractSettingRenderer);
class SettingGroupRenderer {
  constructor() {
    this.templateId = SETTINGS_ELEMENT_TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.classList.add("group-title");
    const template = {
      parent: container,
      toDispose: new DisposableStore()
    };
    return template;
  }
  renderElement(element, index, templateData) {
    templateData.parent.innerText = "";
    const labelElement = DOM.append(templateData.parent, $("div.settings-group-title-label.settings-row-inner-container"));
    labelElement.classList.add(`settings-group-level-${element.element.level}`);
    labelElement.textContent = element.element.label;
    if (element.element.isFirstGroup) {
      labelElement.classList.add("settings-group-first");
    }
  }
  disposeTemplate(templateData) {
    templateData.toDispose.dispose();
  }
}
let SettingNewExtensionsRenderer = class {
  constructor(_commandService) {
    this._commandService = _commandService;
    this.templateId = SETTINGS_NEW_EXTENSIONS_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const toDispose = new DisposableStore();
    container.classList.add("setting-item-new-extensions");
    const button = new Button(container, { title: true, ...defaultButtonStyles });
    toDispose.add(button);
    toDispose.add(button.onDidClick(() => {
      if (template.context) {
        this._commandService.executeCommand("workbench.extensions.action.showExtensionsWithIds", template.context.extensionIds);
      }
    }));
    button.label = localize("newExtensionsButtonLabel", "Show matching extensions");
    button.element.classList.add("settings-new-extensions-button");
    const template = {
      button,
      toDispose
    };
    return template;
  }
  renderElement(element, index, templateData) {
    templateData.context = element.element;
  }
  disposeTemplate(template) {
    template.toDispose.dispose();
  }
};
SettingNewExtensionsRenderer = __decorateClass([
  __decorateParam(0, ICommandService)
], SettingNewExtensionsRenderer);
const _SettingComplexRenderer = class _SettingComplexRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_COMPLEX_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "complex");
    const openSettingsButton = DOM.append(common.controlElement, $("a.edit-in-settings-button"));
    openSettingsButton.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    openSettingsButton.role = "button";
    const validationErrorMessageElement = $(".setting-item-validation-message");
    common.containerElement.appendChild(validationErrorMessageElement);
    const template = {
      ...common,
      button: openSettingsButton,
      validationErrorMessageElement
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    const plainKey = getLanguageTagSettingPlainKey(dataElement.setting.key);
    const editLanguageSettingLabel = localize("editLanguageSettingLabel", "Edit settings for {0}", plainKey);
    const isLanguageTagSetting = dataElement.setting.isLanguageTagSetting;
    template.button.textContent = isLanguageTagSetting ? editLanguageSettingLabel : _SettingComplexRenderer.EDIT_IN_JSON_LABEL;
    const onClickOrKeydown = (e) => {
      if (isLanguageTagSetting) {
        this._onApplyFilter.fire(`@${LANGUAGE_SETTING_TAG}${plainKey}`);
      } else {
        this._onDidOpenSettings.fire(dataElement.setting.key);
      }
      e.preventDefault();
      e.stopPropagation();
    };
    template.elementDisposables.add(DOM.addDisposableListener(template.button, DOM.EventType.CLICK, (e) => {
      onClickOrKeydown(e);
    }));
    template.elementDisposables.add(DOM.addDisposableListener(template.button, DOM.EventType.KEY_DOWN, (e) => {
      const ev = new StandardKeyboardEvent(e);
      if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
        onClickOrKeydown(e);
      }
    }));
    this.renderValidations(dataElement, template);
    if (isLanguageTagSetting) {
      template.button.setAttribute("aria-label", editLanguageSettingLabel);
    } else {
      template.button.setAttribute("aria-label", `${_SettingComplexRenderer.EDIT_IN_JSON_LABEL}: ${dataElement.setting.key}`);
    }
  }
  renderValidations(dataElement, template) {
    const errMsg = dataElement.isConfigured && getInvalidTypeError(dataElement.value, dataElement.setting.type);
    if (errMsg) {
      template.containerElement.classList.add("invalid-input");
      template.validationErrorMessageElement.innerText = errMsg;
      return;
    }
    template.containerElement.classList.remove("invalid-input");
  }
};
_SettingComplexRenderer.EDIT_IN_JSON_LABEL = localize("editInSettingsJson", "Edit in settings.json");
let SettingComplexRenderer = _SettingComplexRenderer;
class SettingComplexObjectRenderer extends SettingComplexRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_COMPLEX_OBJECT_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "list");
    const objectSettingWidget = common.toDispose.add(this._instantiationService.createInstance(ObjectSettingDropdownWidget, common.controlElement));
    objectSettingWidget.domNode.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    const openSettingsButton = DOM.append(DOM.append(common.controlElement, $(".complex-object-edit-in-settings-button-container")), $("a.complex-object.edit-in-settings-button"));
    openSettingsButton.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    openSettingsButton.role = "button";
    const validationErrorMessageElement = $(".setting-item-validation-message");
    common.containerElement.appendChild(validationErrorMessageElement);
    const template = {
      ...common,
      button: openSettingsButton,
      validationErrorMessageElement,
      objectSettingWidget
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderValue(dataElement, template, onChange) {
    const items = getObjectDisplayValue(dataElement);
    template.objectSettingWidget.setValue(items, {
      settingKey: dataElement.setting.key,
      showAddButton: false,
      isReadOnly: true
    });
    template.button.parentElement?.classList.toggle("hide", dataElement.hasPolicyValue);
    super.renderValue(dataElement, template, onChange);
  }
}
class SettingArrayRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_ARRAY_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "list");
    const descriptionElement = common.containerElement.querySelector(".setting-item-description");
    const validationErrorMessageElement = $(".setting-item-validation-message");
    descriptionElement.after(validationErrorMessageElement);
    const listWidget = this._instantiationService.createInstance(ListSettingWidget, common.controlElement);
    listWidget.domNode.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    common.toDispose.add(listWidget);
    const template = {
      ...common,
      listWidget,
      validationErrorMessageElement
    };
    this.addSettingElementFocusHandler(template);
    common.toDispose.add(
      listWidget.onDidChangeList((e) => {
        const newList = this.computeNewList(template, e);
        template.onChange?.(newList);
      })
    );
    return template;
  }
  computeNewList(template, e) {
    if (template.context) {
      let newValue = [];
      if (Array.isArray(template.context.scopeValue)) {
        newValue = [...template.context.scopeValue];
      } else if (Array.isArray(template.context.value)) {
        newValue = [...template.context.value];
      }
      if (e.type === "move") {
        const sourceIndex = e.sourceIndex;
        const targetIndex = e.targetIndex;
        const splicedElem = newValue.splice(sourceIndex, 1)[0];
        newValue.splice(targetIndex, 0, splicedElem);
      } else if (e.type === "remove" || e.type === "reset") {
        newValue.splice(e.targetIndex, 1);
      } else if (e.type === "change") {
        const itemValueData = e.newItem.value.data.toString();
        if (e.targetIndex > -1) {
          newValue[e.targetIndex] = itemValueData;
        } else {
          newValue.push(itemValueData);
        }
      } else if (e.type === "add") {
        newValue.push(e.newItem.value.data.toString());
      }
      if (template.context.defaultValue && Array.isArray(template.context.defaultValue) && template.context.defaultValue.length === newValue.length && template.context.defaultValue.join() === newValue.join()) {
        return void 0;
      }
      return newValue;
    }
    return void 0;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    const value = getListDisplayValue(dataElement);
    const keySuggester = dataElement.setting.enum ? createArraySuggester(dataElement) : void 0;
    template.listWidget.setValue(value, {
      showAddButton: getShowAddButtonList(dataElement, value),
      keySuggester
    });
    template.context = dataElement;
    template.elementDisposables.add(toDisposable(() => {
      template.listWidget.cancelEdit();
    }));
    template.onChange = (v) => {
      if (v && !renderArrayValidations(dataElement, template, v, false)) {
        const itemType = dataElement.setting.arrayItemType;
        const arrToSave = isNonNullableNumericType(itemType) ? v.map((a) => +a) : v;
        onChange(arrToSave);
      } else {
        onChange(v);
      }
    };
    renderArrayValidations(dataElement, template, value.map((v) => v.value.data.toString()), true);
  }
}
class AbstractSettingObjectRenderer extends AbstractSettingRenderer {
  renderTemplateWithWidget(common, widget) {
    widget.domNode.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    common.toDispose.add(widget);
    const descriptionElement = common.containerElement.querySelector(".setting-item-description");
    const validationErrorMessageElement = $(".setting-item-validation-message");
    descriptionElement.after(validationErrorMessageElement);
    const template = {
      ...common,
      validationErrorMessageElement
    };
    if (widget instanceof ObjectSettingCheckboxWidget) {
      template.objectCheckboxWidget = widget;
    } else {
      template.objectDropdownWidget = widget;
    }
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
}
class SettingObjectRenderer extends AbstractSettingObjectRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_OBJECT_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "list");
    const widget = this._instantiationService.createInstance(ObjectSettingDropdownWidget, common.controlElement);
    const template = this.renderTemplateWithWidget(common, widget);
    common.toDispose.add(widget.onDidChangeList((e) => {
      this.onDidChangeObject(template, e);
    }));
    return template;
  }
  onDidChangeObject(template, e) {
    const widget = template.objectDropdownWidget;
    if (template.context) {
      const settingSupportsRemoveDefault = objectSettingSupportsRemoveDefaultValue(template.context.setting.key);
      const defaultValue = typeof template.context.defaultValue === "object" ? template.context.defaultValue ?? {} : {};
      const scopeValue = typeof template.context.scopeValue === "object" ? template.context.scopeValue ?? {} : {};
      const newValue = { ...template.context.scopeValue };
      const newItems = [];
      widget.items.forEach((item, idx) => {
        if ((e.type === "change" || e.type === "move") && e.targetIndex === idx) {
          if (e.originalItem.key.data !== e.newItem.key.data && settingSupportsRemoveDefault && e.originalItem.key.data in defaultValue) {
            newValue[e.originalItem.key.data] = null;
          } else {
            delete newValue[e.originalItem.key.data];
          }
          newValue[e.newItem.key.data] = e.newItem.value.data;
          newItems.push(e.newItem);
        } else if (e.type !== "change" && e.type !== "move" || e.newItem.key.data !== item.key.data) {
          newValue[item.key.data] = item.value.data;
          newItems.push(item);
        }
      });
      if (e.type === "remove" || e.type === "reset") {
        const objectKey = e.originalItem.key.data;
        const removingDefaultValue = e.type === "remove" && settingSupportsRemoveDefault && defaultValue[objectKey] === e.originalItem.value.data;
        if (removingDefaultValue) {
          newValue[objectKey] = null;
        } else {
          delete newValue[objectKey];
        }
        const itemToDelete = newItems.findIndex((item) => item.key.data === objectKey);
        const defaultItemValue = defaultValue[objectKey];
        if (removingDefaultValue || isUndefinedOrNull(defaultValue[objectKey]) && itemToDelete > -1) {
          newItems.splice(itemToDelete, 1);
        } else if (!removingDefaultValue && itemToDelete > -1) {
          newItems[itemToDelete].value.data = defaultItemValue;
        }
      } else if (e.type === "add") {
        newValue[e.newItem.key.data] = e.newItem.value.data;
        newItems.push(e.newItem);
      }
      Object.entries(newValue).forEach(([key, value]) => {
        if (scopeValue[key] !== value && defaultValue[key] === value && !(settingSupportsRemoveDefault && value === null)) {
          delete newValue[key];
        }
      });
      const newObject = Object.keys(newValue).length === 0 ? void 0 : newValue;
      template.objectDropdownWidget.setValue(newItems);
      template.onChange?.(newObject);
    }
  }
  renderValue(dataElement, template, onChange) {
    const items = getObjectDisplayValue(dataElement);
    const { key, objectProperties, objectPatternProperties, objectAdditionalProperties } = dataElement.setting;
    template.objectDropdownWidget.setValue(items, {
      settingKey: key,
      showAddButton: objectAdditionalProperties === false ? !areAllPropertiesDefined(Object.keys(objectProperties ?? {}), items) || isDefined(objectPatternProperties) : true,
      keySuggester: createObjectKeySuggester(dataElement),
      valueSuggester: createObjectValueSuggester(dataElement)
    });
    template.context = dataElement;
    template.elementDisposables.add(toDisposable(() => {
      template.objectDropdownWidget.cancelEdit();
    }));
    template.onChange = (v) => {
      if (v && !renderArrayValidations(dataElement, template, v, false)) {
        const parsedRecord = parseNumericObjectValues(dataElement, v);
        onChange(parsedRecord);
      } else {
        onChange(v);
      }
    };
    renderArrayValidations(dataElement, template, dataElement.value, true);
  }
}
class SettingBoolObjectRenderer extends AbstractSettingObjectRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_BOOL_OBJECT_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "list");
    const widget = this._instantiationService.createInstance(ObjectSettingCheckboxWidget, common.controlElement);
    const template = this.renderTemplateWithWidget(common, widget);
    common.toDispose.add(widget.onDidChangeList((e) => {
      this.onDidChangeObject(template, e);
    }));
    return template;
  }
  onDidChangeObject(template, e) {
    if (template.context) {
      const widget = template.objectCheckboxWidget;
      const defaultValue = typeof template.context.defaultValue === "object" ? template.context.defaultValue ?? {} : {};
      const scopeValue = typeof template.context.scopeValue === "object" ? template.context.scopeValue ?? {} : {};
      const newValue = { ...template.context.scopeValue };
      const newItems = [];
      if (e.type !== "change") {
        console.warn("Unexpected event type", e.type, "for bool object setting", template.context.setting.key);
        return;
      }
      widget.items.forEach((item, idx) => {
        if (e.targetIndex === idx) {
          newValue[e.newItem.key.data] = e.newItem.value.data;
          newItems.push(e.newItem);
        } else if (e.newItem.key.data !== item.key.data) {
          newValue[item.key.data] = item.value.data;
          newItems.push(item);
        }
      });
      Object.entries(newValue).forEach(([key, value]) => {
        if (scopeValue[key] !== value && defaultValue[key] === value) {
          delete newValue[key];
        }
      });
      const newObject = Object.keys(newValue).length === 0 ? void 0 : newValue;
      template.objectCheckboxWidget.setValue(newItems);
      template.onChange?.(newObject);
      this._onDidFocusSetting.fire(template.context);
    }
  }
  renderValue(dataElement, template, onChange) {
    const items = getBoolObjectDisplayValue(dataElement);
    const { key } = dataElement.setting;
    template.objectCheckboxWidget.setValue(items, {
      settingKey: key
    });
    template.context = dataElement;
    template.onChange = (v) => {
      onChange(v);
    };
  }
}
class SettingIncludeExcludeRenderer extends AbstractSettingRenderer {
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "list");
    const includeExcludeWidget = this._instantiationService.createInstance(this.isExclude() ? ExcludeSettingWidget : IncludeSettingWidget, common.controlElement);
    includeExcludeWidget.domNode.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    common.toDispose.add(includeExcludeWidget);
    const template = {
      ...common,
      includeExcludeWidget
    };
    this.addSettingElementFocusHandler(template);
    common.toDispose.add(includeExcludeWidget.onDidChangeList((e) => this.onDidChangeIncludeExclude(template, e)));
    return template;
  }
  onDidChangeIncludeExclude(template, e) {
    if (template.context) {
      let sortKeys2 = function(obj) {
        const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
        const retVal = {};
        for (const key of sortedKeys) {
          retVal[key] = obj[key];
        }
        return retVal;
      };
      var sortKeys = sortKeys2;
      const newValue = { ...template.context.scopeValue };
      if (e.type !== "add") {
        if (e.originalItem.value.data.toString() in template.context.defaultValue) {
          newValue[e.originalItem.value.data.toString()] = false;
        } else {
          delete newValue[e.originalItem.value.data.toString()];
        }
      }
      if (e.type === "change" || e.type === "add" || e.type === "move") {
        if (e.newItem.value.data.toString() in template.context.defaultValue && !e.newItem.sibling) {
          delete newValue[e.newItem.value.data.toString()];
        } else {
          newValue[e.newItem.value.data.toString()] = e.newItem.sibling ? { when: e.newItem.sibling } : true;
        }
      }
      this._onDidChangeSetting.fire({
        key: template.context.setting.key,
        value: Object.keys(newValue).length === 0 ? void 0 : sortKeys2(newValue),
        type: template.context.valueType,
        manualReset: false,
        scope: template.context.setting.scope
      });
    }
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    const value = getIncludeExcludeDisplayValue(dataElement);
    template.includeExcludeWidget.setValue(value);
    template.context = dataElement;
    template.elementDisposables.add(toDisposable(() => {
      template.includeExcludeWidget.cancelEdit();
    }));
  }
}
class SettingExcludeRenderer extends SettingIncludeExcludeRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_EXCLUDE_TEMPLATE_ID;
  }
  isExclude() {
    return true;
  }
}
class SettingIncludeRenderer extends SettingIncludeExcludeRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_INCLUDE_TEMPLATE_ID;
  }
  isExclude() {
    return false;
  }
}
const settingsInputBoxStyles = getInputBoxStyle({
  inputBackground: settingsTextInputBackground,
  inputForeground: settingsTextInputForeground,
  inputBorder: settingsTextInputBorder
});
class AbstractSettingTextRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.MULTILINE_MAX_HEIGHT = 150;
  }
  renderTemplate(_container, useMultiline) {
    const common = this.renderCommonTemplate(null, _container, "text");
    const validationErrorMessageElement = DOM.append(common.containerElement, $(".setting-item-validation-message"));
    const inputBoxOptions = {
      flexibleHeight: useMultiline,
      flexibleWidth: false,
      flexibleMaxHeight: this.MULTILINE_MAX_HEIGHT,
      inputBoxStyles: settingsInputBoxStyles
    };
    const inputBox = new InputBox(common.controlElement, this._contextViewService, inputBoxOptions);
    common.toDispose.add(inputBox);
    common.toDispose.add(
      inputBox.onDidChange((e) => {
        template.onChange?.(e);
      })
    );
    common.toDispose.add(inputBox);
    inputBox.inputElement.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    inputBox.inputElement.tabIndex = 0;
    const template = {
      ...common,
      inputBox,
      validationErrorMessageElement
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    template.onChange = void 0;
    template.inputBox.value = dataElement.value;
    template.inputBox.setAriaLabel(dataElement.setting.key);
    template.onChange = (value) => {
      if (!renderValidations(dataElement, template, false)) {
        onChange(value);
      }
    };
    renderValidations(dataElement, template, true);
  }
}
class SettingTextRenderer extends AbstractSettingTextRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_TEXT_TEMPLATE_ID;
  }
  renderTemplate(_container) {
    const template = super.renderTemplate(_container, false);
    template.toDispose.add(DOM.addStandardDisposableListener(template.inputBox.inputElement, DOM.EventType.KEY_DOWN, (e) => {
      if (e.equals(KeyCode.UpArrow) || e.equals(KeyCode.DownArrow)) {
        e.preventDefault();
      }
    }));
    return template;
  }
}
class SettingMultilineTextRenderer extends AbstractSettingTextRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_MULTILINE_TEXT_TEMPLATE_ID;
  }
  renderTemplate(_container) {
    return super.renderTemplate(_container, true);
  }
  renderValue(dataElement, template, onChange) {
    const onChangeOverride = (value) => {
      dataElement.value = value;
      onChange(value);
    };
    super.renderValue(dataElement, template, onChangeOverride);
    template.elementDisposables.add(
      template.inputBox.onDidHeightChange((e) => {
        const height = template.containerElement.clientHeight;
        if (height) {
          this._onDidChangeSettingHeight.fire({
            element: dataElement,
            height: template.containerElement.clientHeight
          });
        }
      })
    );
    template.inputBox.layout();
  }
}
class SettingEnumRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_ENUM_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const common = this.renderCommonTemplate(null, container, "enum");
    const styles = getSelectBoxStyles({
      selectBackground: settingsSelectBackground,
      selectForeground: settingsSelectForeground,
      selectBorder: settingsSelectBorder,
      selectListBorder: settingsSelectListBorder
    });
    const selectBox = new SelectBox([], 0, this._contextViewService, styles, {
      useCustomDrawn: !(isIOS && BrowserFeatures.pointerEvents)
    });
    common.toDispose.add(selectBox);
    selectBox.render(common.controlElement);
    const selectElement = common.controlElement.querySelector("select");
    if (selectElement) {
      selectElement.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
      selectElement.tabIndex = 0;
    }
    common.toDispose.add(
      selectBox.onDidSelect((e) => {
        template.onChange?.(e.index);
      })
    );
    const enumDescriptionElement = common.containerElement.insertBefore($(".setting-item-enumDescription"), common.descriptionElement.nextSibling);
    const template = {
      ...common,
      selectBox,
      selectElement,
      enumDescriptionElement
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    const enumItemLabels = dataElement.setting.enumItemLabels ? [...dataElement.setting.enumItemLabels] : [];
    const enumDescriptions = dataElement.setting.enumDescriptions ? [...dataElement.setting.enumDescriptions] : [];
    const settingEnum = [...dataElement.setting.enum];
    const enumDescriptionsAreMarkdown = dataElement.setting.enumDescriptionsAreMarkdown;
    const disposables = new DisposableStore();
    template.elementDisposables.add(disposables);
    let createdDefault = false;
    if (!settingEnum.includes(dataElement.defaultValue)) {
      settingEnum.unshift(dataElement.defaultValue);
      enumDescriptions.unshift("");
      enumItemLabels.unshift("");
      createdDefault = true;
    }
    const stringifiedDefaultValue = escapeInvisibleChars(String(dataElement.defaultValue));
    const displayOptions = settingEnum.map(String).map(escapeInvisibleChars).map((data, index) => {
      const description = enumDescriptions[index] && (enumDescriptionsAreMarkdown ? fixSettingLinks(enumDescriptions[index], false) : enumDescriptions[index]);
      return {
        text: enumItemLabels[index] ? enumItemLabels[index] : data,
        detail: enumItemLabels[index] ? data : "",
        description,
        descriptionIsMarkdown: enumDescriptionsAreMarkdown,
        descriptionMarkdownActionHandler: {
          callback: (content) => {
            this._openerService.open(content).catch(onUnexpectedError);
          },
          disposables
        },
        decoratorRight: data === stringifiedDefaultValue || createdDefault && index === 0 ? localize("settings.Default", "default") : ""
      };
    });
    template.selectBox.setOptions(displayOptions);
    template.selectBox.setAriaLabel(dataElement.setting.key);
    let idx = settingEnum.indexOf(dataElement.value);
    if (idx === -1) {
      idx = 0;
    }
    template.onChange = void 0;
    template.selectBox.select(idx);
    template.onChange = (idx2) => {
      if (createdDefault && idx2 === 0) {
        onChange(dataElement.defaultValue);
      } else {
        onChange(settingEnum[idx2]);
      }
    };
    template.enumDescriptionElement.innerText = "";
  }
}
const settingsNumberInputBoxStyles = getInputBoxStyle({
  inputBackground: settingsNumberInputBackground,
  inputForeground: settingsNumberInputForeground,
  inputBorder: settingsNumberInputBorder
});
class SettingNumberRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_NUMBER_TEMPLATE_ID;
  }
  renderTemplate(_container) {
    const common = super.renderCommonTemplate(null, _container, "number");
    const validationErrorMessageElement = DOM.append(common.containerElement, $(".setting-item-validation-message"));
    const inputBox = new InputBox(common.controlElement, this._contextViewService, { type: "number", inputBoxStyles: settingsNumberInputBoxStyles });
    common.toDispose.add(inputBox);
    common.toDispose.add(
      inputBox.onDidChange((e) => {
        template.onChange?.(e);
      })
    );
    common.toDispose.add(inputBox);
    inputBox.inputElement.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    inputBox.inputElement.tabIndex = 0;
    const template = {
      ...common,
      inputBox,
      validationErrorMessageElement
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    const numParseFn = dataElement.valueType === "integer" || dataElement.valueType === "nullable-integer" ? parseInt : parseFloat;
    const nullNumParseFn = dataElement.valueType === "nullable-integer" || dataElement.valueType === "nullable-number" ? (v) => v === "" ? null : numParseFn(v) : numParseFn;
    template.onChange = void 0;
    template.inputBox.value = typeof dataElement.value === "number" ? dataElement.value.toString() : "";
    template.inputBox.step = dataElement.valueType.includes("integer") ? "1" : "any";
    template.inputBox.setAriaLabel(dataElement.setting.key);
    template.onChange = (value) => {
      if (!renderValidations(dataElement, template, false)) {
        onChange(nullNumParseFn(value));
      }
    };
    renderValidations(dataElement, template, true);
  }
}
class SettingBoolRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_BOOL_TEMPLATE_ID;
  }
  renderTemplate(_container) {
    _container.classList.add("setting-item");
    _container.classList.add("setting-item-bool");
    const toDispose = new DisposableStore();
    const container = DOM.append(_container, $(AbstractSettingRenderer.CONTENTS_SELECTOR));
    container.classList.add("settings-row-inner-container");
    const titleElement = DOM.append(container, $(".setting-item-title"));
    const categoryElement = DOM.append(titleElement, $("span.setting-item-category"));
    const labelElementContainer = DOM.append(titleElement, $("span.setting-item-label"));
    const labelElement = toDispose.add(new SimpleIconLabel(labelElementContainer));
    const indicatorsLabel = this._instantiationService.createInstance(SettingsTreeIndicatorsLabel, titleElement);
    const descriptionAndValueElement = DOM.append(container, $(".setting-item-value-description"));
    const controlElement = DOM.append(descriptionAndValueElement, $(".setting-item-bool-control"));
    const descriptionElement = DOM.append(descriptionAndValueElement, $(".setting-item-description"));
    const modifiedIndicatorElement = DOM.append(container, $(".setting-item-modified-indicator"));
    toDispose.add(this._hoverService.setupDelayedHover(modifiedIndicatorElement, {
      content: localize("modified", "The setting has been configured in the current scope.")
    }));
    const deprecationWarningElement = DOM.append(container, $(".setting-item-deprecation-message"));
    const checkbox = new Toggle({ icon: Codicon.check, actionClassName: "setting-value-checkbox", isChecked: true, title: "", ...unthemedToggleStyles });
    controlElement.appendChild(checkbox.domNode);
    toDispose.add(checkbox);
    toDispose.add(checkbox.onChange(() => {
      template.onChange(checkbox.checked);
    }));
    toDispose.add(DOM.addDisposableListener(descriptionElement, DOM.EventType.MOUSE_DOWN, (e) => {
      const targetElement = e.target;
      if (targetElement.tagName.toLowerCase() !== "a") {
        template.checkbox.checked = !template.checkbox.checked;
        template.onChange(checkbox.checked);
      }
      DOM.EventHelper.stop(e);
    }));
    checkbox.domNode.classList.add(AbstractSettingRenderer.CONTROL_CLASS);
    const toolbarContainer = DOM.append(container, $(".setting-toolbar-container"));
    const toolbar = this.renderSettingToolbar(toolbarContainer);
    toDispose.add(toolbar);
    const template = {
      toDispose,
      elementDisposables: toDispose.add(new DisposableStore()),
      containerElement: container,
      categoryElement,
      labelElement,
      controlElement,
      checkbox,
      descriptionElement,
      deprecationWarningElement,
      indicatorsLabel,
      toolbar
    };
    this.addSettingElementFocusHandler(template);
    toDispose.add(DOM.addDisposableListener(controlElement, "mousedown", (e) => e.stopPropagation()));
    toDispose.add(DOM.addDisposableListener(titleElement, DOM.EventType.MOUSE_ENTER, (e) => container.classList.add("mouseover")));
    toDispose.add(DOM.addDisposableListener(titleElement, DOM.EventType.MOUSE_LEAVE, (e) => container.classList.remove("mouseover")));
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    template.onChange = void 0;
    template.checkbox.checked = dataElement.value;
    template.checkbox.setTitle(dataElement.setting.key);
    template.onChange = onChange;
  }
}
class SettingsExtensionToggleRenderer extends AbstractSettingRenderer {
  constructor() {
    super(...arguments);
    this.templateId = SETTINGS_EXTENSION_TOGGLE_TEMPLATE_ID;
    this._onDidDismissExtensionSetting = this._register(new Emitter());
    this.onDidDismissExtensionSetting = this._onDidDismissExtensionSetting.event;
  }
  renderTemplate(_container) {
    const common = super.renderCommonTemplate(null, _container, "extension-toggle");
    const actionButton = new Button(common.containerElement, {
      title: false,
      ...defaultButtonStyles
    });
    actionButton.element.classList.add("setting-item-extension-toggle-button");
    actionButton.label = localize("showExtension", "Show Extension");
    const dismissButton = new Button(common.containerElement, {
      title: false,
      secondary: true,
      ...defaultButtonStyles
    });
    dismissButton.element.classList.add("setting-item-extension-dismiss-button");
    dismissButton.label = localize("dismiss", "Dismiss");
    const template = {
      ...common,
      actionButton,
      dismissButton
    };
    this.addSettingElementFocusHandler(template);
    return template;
  }
  renderElement(element, index, templateData) {
    super.renderSettingElement(element, index, templateData);
  }
  renderValue(dataElement, template, onChange) {
    template.elementDisposables.clear();
    const extensionId = dataElement.setting.displayExtensionId;
    template.elementDisposables.add(template.actionButton.onDidClick(async () => {
      this._telemetryService.publicLog2("ManageExtensionClick", { extensionId });
      this._commandService.executeCommand("extension.open", extensionId);
    }));
    template.elementDisposables.add(template.dismissButton.onDidClick(async () => {
      this._telemetryService.publicLog2("DismissExtensionClick", { extensionId });
      this._onDidDismissExtensionSetting.fire(extensionId);
    }));
  }
}
let SettingTreeRenderers = class extends Disposable {
  constructor(_instantiationService, _contextMenuService, _contextViewService, _userDataSyncEnablementService) {
    super();
    this._instantiationService = _instantiationService;
    this._contextMenuService = _contextMenuService;
    this._contextViewService = _contextViewService;
    this._userDataSyncEnablementService = _userDataSyncEnablementService;
    this._onDidChangeSetting = this._register(new Emitter());
    this.settingActions = [
      new Action("settings.resetSetting", localize("resetSettingLabel", "Reset Setting"), void 0, void 0, async (context) => {
        if (context instanceof SettingsTreeSettingElement) {
          if (!context.isUntrusted) {
            this._onDidChangeSetting.fire({
              key: context.setting.key,
              value: void 0,
              type: context.setting.type,
              manualReset: true,
              scope: context.setting.scope
            });
          }
        }
      }),
      new Separator(),
      this._instantiationService.createInstance(CopySettingIdAction),
      this._instantiationService.createInstance(CopySettingAsJSONAction),
      this._instantiationService.createInstance(CopySettingAsURLAction)
    ];
    const actionFactory = (setting, settingTarget) => this.getActionsForSetting(setting, settingTarget);
    const emptyActionFactory = (_) => [];
    const extensionRenderer = this._instantiationService.createInstance(SettingsExtensionToggleRenderer, [], emptyActionFactory);
    const settingRenderers = [
      this._instantiationService.createInstance(SettingBoolRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingNumberRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingArrayRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingComplexRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingComplexObjectRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingTextRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingMultilineTextRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingExcludeRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingIncludeRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingEnumRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingObjectRenderer, this.settingActions, actionFactory),
      this._instantiationService.createInstance(SettingBoolObjectRenderer, this.settingActions, actionFactory),
      extensionRenderer
    ];
    this.onDidClickOverrideElement = Event.any(...settingRenderers.map((r) => r.onDidClickOverrideElement));
    this.onDidChangeSetting = Event.any(
      ...settingRenderers.map((r) => r.onDidChangeSetting),
      this._onDidChangeSetting.event
    );
    this.onDidDismissExtensionSetting = extensionRenderer.onDidDismissExtensionSetting;
    this.onDidOpenSettings = Event.any(...settingRenderers.map((r) => r.onDidOpenSettings));
    this.onDidClickSettingLink = Event.any(...settingRenderers.map((r) => r.onDidClickSettingLink));
    this.onDidFocusSetting = Event.any(...settingRenderers.map((r) => r.onDidFocusSetting));
    this.onDidChangeSettingHeight = Event.any(...settingRenderers.map((r) => r.onDidChangeSettingHeight));
    this.onApplyFilter = Event.any(...settingRenderers.map((r) => r.onApplyFilter));
    this.allRenderers = [
      ...settingRenderers,
      this._instantiationService.createInstance(SettingGroupRenderer),
      this._instantiationService.createInstance(SettingNewExtensionsRenderer)
    ];
  }
  getActionsForSetting(setting, settingTarget) {
    const actions = [];
    if (!(setting.scope && APPLICATION_SCOPES.includes(setting.scope)) && settingTarget === ConfigurationTarget.USER_LOCAL) {
      actions.push(this._instantiationService.createInstance(ApplySettingToAllProfilesAction, setting));
    }
    if (this._userDataSyncEnablementService.isEnabled() && !setting.disallowSyncIgnore) {
      actions.push(this._instantiationService.createInstance(SyncSettingAction, setting));
    }
    if (actions.length) {
      actions.splice(0, 0, new Separator());
    }
    return actions;
  }
  cancelSuggesters() {
    this._contextViewService.hideContextView();
  }
  showContextMenu(element, settingDOMElement) {
    const toolbarElement = settingDOMElement.querySelector(".monaco-toolbar");
    if (toolbarElement) {
      this._contextMenuService.showContextMenu({
        getActions: () => this.settingActions,
        getAnchor: () => toolbarElement,
        getActionsContext: () => element
      });
    }
  }
  getSettingDOMElementForDOMElement(domElement) {
    const parent = DOM.findParentWithClass(domElement, AbstractSettingRenderer.CONTENTS_CLASS);
    if (parent) {
      return parent;
    }
    return null;
  }
  getDOMElementsForSettingKey(treeContainer, key) {
    return treeContainer.querySelectorAll(`[${AbstractSettingRenderer.SETTING_KEY_ATTR}="${key}"]`);
  }
  getKeyForDOMElementInSetting(element) {
    const settingElement = this.getSettingDOMElementForDOMElement(element);
    return settingElement && settingElement.getAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR);
  }
  getIdForDOMElementInSetting(element) {
    const settingElement = this.getSettingDOMElementForDOMElement(element);
    return settingElement && settingElement.getAttribute(AbstractSettingRenderer.SETTING_ID_ATTR);
  }
  dispose() {
    super.dispose();
    this.settingActions.forEach((action) => {
      if (isDisposable(action)) {
        action.dispose();
      }
    });
    this.allRenderers.forEach((renderer) => {
      if (isDisposable(renderer)) {
        renderer.dispose();
      }
    });
  }
};
SettingTreeRenderers = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IUserDataSyncEnablementService)
], SettingTreeRenderers);
function renderValidations(dataElement, template, calledOnStartup) {
  if (dataElement.setting.validator) {
    const errMsg = dataElement.setting.validator(template.inputBox.value);
    if (errMsg) {
      template.containerElement.classList.add("invalid-input");
      template.validationErrorMessageElement.innerText = errMsg;
      const validationError = localize("validationError", "Validation Error.");
      template.inputBox.inputElement.parentElement.setAttribute("aria-label", [validationError, errMsg].join(" "));
      if (!calledOnStartup) {
        aria.status(validationError + " " + errMsg);
      }
      return true;
    } else {
      template.inputBox.inputElement.parentElement.removeAttribute("aria-label");
    }
  }
  template.containerElement.classList.remove("invalid-input");
  return false;
}
function renderArrayValidations(dataElement, template, value, calledOnStartup) {
  template.containerElement.classList.add("invalid-input");
  if (dataElement.setting.validator) {
    const errMsg = dataElement.setting.validator(value);
    if (errMsg && errMsg !== "") {
      template.containerElement.classList.add("invalid-input");
      template.validationErrorMessageElement.innerText = errMsg;
      const validationError = localize("validationError", "Validation Error.");
      template.containerElement.setAttribute("aria-label", [dataElement.setting.key, validationError, errMsg].join(" "));
      if (!calledOnStartup) {
        aria.status(validationError + " " + errMsg);
      }
      return true;
    } else {
      template.containerElement.setAttribute("aria-label", dataElement.setting.key);
      template.containerElement.classList.remove("invalid-input");
    }
  }
  return false;
}
function cleanRenderedMarkdown(element) {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes.item(i);
    const tagName = child.tagName && child.tagName.toLowerCase();
    if (tagName === "img") {
      child.remove();
    } else {
      cleanRenderedMarkdown(child);
    }
  }
}
function fixSettingLinks(text, linkify = true) {
  return text.replace(/`#([^#\s`]+)#`|'#([^#\s']+)#'/g, (match, backticksGroup, quotesGroup) => {
    const settingKey = backticksGroup ?? quotesGroup;
    const targetDisplayFormat = settingKeyToDisplayFormat(settingKey);
    const targetName = `${targetDisplayFormat.category}: ${targetDisplayFormat.label}`;
    return linkify ? `[${targetName}](#${settingKey} "${settingKey}")` : `"${targetName}"`;
  });
}
function escapeInvisibleChars(enumValue) {
  return enumValue && enumValue.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
let SettingsTreeFilter = class {
  constructor(viewState, environmentService) {
    this.viewState = viewState;
    this.environmentService = environmentService;
  }
  filter(element, parentVisibility) {
    if (this.viewState.filterToCategory && element instanceof SettingsTreeSettingElement) {
      if (!this.settingContainedInGroup(element.setting, this.viewState.filterToCategory)) {
        return false;
      }
    }
    if (element instanceof SettingsTreeSettingElement && this.viewState.settingsTarget !== ConfigurationTarget.USER_LOCAL) {
      const isRemote = !!this.environmentService.remoteAuthority;
      if (!element.matchesScope(this.viewState.settingsTarget, isRemote)) {
        return false;
      }
    }
    if (element instanceof SettingsTreeGroupElement) {
      if (typeof element.count === "number") {
        return element.count > 0;
      }
      return TreeVisibility.Recurse;
    }
    if (element instanceof SettingsTreeNewExtensionsElement) {
      if (this.viewState.tagFilters?.size || this.viewState.filterToCategory) {
        return false;
      }
    }
    return true;
  }
  settingContainedInGroup(setting, group) {
    return group.children.some((child) => {
      if (child instanceof SettingsTreeGroupElement) {
        return this.settingContainedInGroup(setting, child);
      } else if (child instanceof SettingsTreeSettingElement) {
        return child.setting.key === setting.key;
      } else {
        return false;
      }
    });
  }
};
SettingsTreeFilter = __decorateClass([
  __decorateParam(1, IWorkbenchEnvironmentService)
], SettingsTreeFilter);
class SettingsTreeDelegate extends CachedListVirtualDelegate {
  getTemplateId(element) {
    if (element instanceof SettingsTreeGroupElement) {
      return SETTINGS_ELEMENT_TEMPLATE_ID;
    }
    if (element instanceof SettingsTreeSettingElement) {
      if (element.valueType === SettingValueType.ExtensionToggle) {
        return SETTINGS_EXTENSION_TOGGLE_TEMPLATE_ID;
      }
      const invalidTypeError = element.isConfigured && getInvalidTypeError(element.value, element.setting.type);
      if (invalidTypeError) {
        return SETTINGS_COMPLEX_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Boolean) {
        return SETTINGS_BOOL_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Integer || element.valueType === SettingValueType.Number || element.valueType === SettingValueType.NullableInteger || element.valueType === SettingValueType.NullableNumber) {
        return SETTINGS_NUMBER_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.MultilineString) {
        return SETTINGS_MULTILINE_TEXT_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.String) {
        return SETTINGS_TEXT_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Enum) {
        return SETTINGS_ENUM_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Array) {
        return SETTINGS_ARRAY_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Exclude) {
        return SETTINGS_EXCLUDE_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Include) {
        return SETTINGS_INCLUDE_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.Object) {
        return SETTINGS_OBJECT_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.BooleanObject) {
        return SETTINGS_BOOL_OBJECT_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.ComplexObject) {
        return SETTINGS_COMPLEX_OBJECT_TEMPLATE_ID;
      }
      if (element.valueType === SettingValueType.LanguageTag) {
        return SETTINGS_COMPLEX_TEMPLATE_ID;
      }
      return SETTINGS_COMPLEX_TEMPLATE_ID;
    }
    if (element instanceof SettingsTreeNewExtensionsElement) {
      return SETTINGS_NEW_EXTENSIONS_TEMPLATE_ID;
    }
    throw new Error("unknown element type: " + element);
  }
  hasDynamicHeight(element) {
    return !(element instanceof SettingsTreeGroupElement);
  }
  estimateHeight(element) {
    if (element instanceof SettingsTreeGroupElement) {
      return 42;
    }
    return element instanceof SettingsTreeSettingElement && element.valueType === SettingValueType.Boolean ? 78 : 104;
  }
}
class NonCollapsibleObjectTreeModel extends ObjectTreeModel {
  isCollapsible(element) {
    return false;
  }
  setCollapsed(element, collapsed, recursive) {
    return false;
  }
}
class SettingsTreeAccessibilityProvider {
  constructor(configurationService, languageService, userDataProfilesService) {
    this.configurationService = configurationService;
    this.languageService = languageService;
    this.userDataProfilesService = userDataProfilesService;
  }
  getAriaLabel(element) {
    if (element instanceof SettingsTreeSettingElement) {
      const ariaLabelSections = [];
      ariaLabelSections.push(`${element.displayCategory} ${element.displayLabel}.`);
      if (element.isConfigured) {
        const modifiedText = localize("settings.Modified", "Modified.");
        ariaLabelSections.push(modifiedText);
      }
      const indicatorsLabelAriaLabel = getIndicatorsLabelAriaLabel(element, this.configurationService, this.userDataProfilesService, this.languageService);
      if (indicatorsLabelAriaLabel.length) {
        ariaLabelSections.push(`${indicatorsLabelAriaLabel}.`);
      }
      const descriptionWithoutSettingLinks = renderMarkdownAsPlaintext({ value: fixSettingLinks(element.description, false) });
      if (descriptionWithoutSettingLinks.length) {
        ariaLabelSections.push(descriptionWithoutSettingLinks);
      }
      return ariaLabelSections.join(" ");
    } else if (element instanceof SettingsTreeGroupElement) {
      return element.label;
    } else {
      return element.id;
    }
  }
  getWidgetAriaLabel() {
    return localize("settings", "Settings");
  }
}
let SettingsTree = class extends WorkbenchObjectTree {
  constructor(container, viewState, renderers, contextKeyService, listService, configurationService, instantiationService, languageService, userDataProfilesService) {
    super(
      "SettingsTree",
      container,
      new SettingsTreeDelegate(),
      renderers,
      {
        horizontalScrolling: false,
        supportDynamicHeights: true,
        scrollToActiveElement: true,
        identityProvider: {
          getId(e) {
            return e.id;
          }
        },
        accessibilityProvider: new SettingsTreeAccessibilityProvider(configurationService, languageService, userDataProfilesService),
        styleController: (id) => new DefaultStyleController(domStylesheetsJs.createStyleSheet(container), id),
        filter: instantiationService.createInstance(SettingsTreeFilter, viewState),
        smoothScrolling: configurationService.getValue("workbench.list.smoothScrolling"),
        multipleSelectionSupport: false,
        findWidgetEnabled: false,
        renderIndentGuides: RenderIndentGuides.None,
        transformOptimization: false
        // Disable transform optimization #177470
      },
      instantiationService,
      contextKeyService,
      listService,
      configurationService
    );
    this.getHTMLElement().classList.add("settings-editor-tree");
    this.style(getListStyles({
      listBackground: editorBackground,
      listActiveSelectionBackground: editorBackground,
      listActiveSelectionForeground: foreground,
      listFocusAndSelectionBackground: editorBackground,
      listFocusAndSelectionForeground: foreground,
      listFocusBackground: editorBackground,
      listFocusForeground: foreground,
      listHoverForeground: foreground,
      listHoverBackground: editorBackground,
      listHoverOutline: editorBackground,
      listFocusOutline: editorBackground,
      listInactiveSelectionBackground: editorBackground,
      listInactiveSelectionForeground: foreground,
      listInactiveFocusBackground: editorBackground,
      listInactiveFocusOutline: editorBackground,
      treeIndentGuidesStroke: void 0,
      treeInactiveIndentGuidesStroke: void 0
    }));
    this.disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.list.smoothScrolling")) {
        this.updateOptions({
          smoothScrolling: configurationService.getValue("workbench.list.smoothScrolling")
        });
      }
    }));
  }
  createModel(user, options) {
    return new NonCollapsibleObjectTreeModel(user, options);
  }
};
SettingsTree = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IListService),
  __decorateParam(5, IWorkbenchConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IUserDataProfilesService)
], SettingsTree);
let CopySettingIdAction = class extends Action {
  constructor(clipboardService) {
    super(CopySettingIdAction.ID, CopySettingIdAction.LABEL);
    this.clipboardService = clipboardService;
  }
  async run(context) {
    if (context) {
      await this.clipboardService.writeText(context.setting.key);
    }
    return Promise.resolve(void 0);
  }
};
CopySettingIdAction.ID = "settings.copySettingId";
CopySettingIdAction.LABEL = localize("copySettingIdLabel", "Copy Setting ID");
CopySettingIdAction = __decorateClass([
  __decorateParam(0, IClipboardService)
], CopySettingIdAction);
let CopySettingAsJSONAction = class extends Action {
  constructor(clipboardService) {
    super(CopySettingAsJSONAction.ID, CopySettingAsJSONAction.LABEL);
    this.clipboardService = clipboardService;
  }
  async run(context) {
    if (context) {
      const jsonResult = `"${context.setting.key}": ${JSON.stringify(context.value, void 0, "  ")}`;
      await this.clipboardService.writeText(jsonResult);
    }
    return Promise.resolve(void 0);
  }
};
CopySettingAsJSONAction.ID = "settings.copySettingAsJSON";
CopySettingAsJSONAction.LABEL = localize("copySettingAsJSONLabel", "Copy Setting as JSON");
CopySettingAsJSONAction = __decorateClass([
  __decorateParam(0, IClipboardService)
], CopySettingAsJSONAction);
let CopySettingAsURLAction = class extends Action {
  constructor(clipboardService, productService) {
    super(CopySettingAsURLAction.ID, CopySettingAsURLAction.LABEL);
    this.clipboardService = clipboardService;
    this.productService = productService;
  }
  async run(context) {
    if (context) {
      const settingKey = context.setting.key;
      const product = this.productService.urlProtocol;
      const uri = URI.from({ scheme: product, authority: SETTINGS_AUTHORITY, path: `/${settingKey}` }, true);
      await this.clipboardService.writeText(uri.toString());
    }
    return Promise.resolve(void 0);
  }
};
CopySettingAsURLAction.ID = "settings.copySettingAsURL";
CopySettingAsURLAction.LABEL = localize("copySettingAsURLLabel", "Copy Setting as URL");
CopySettingAsURLAction = __decorateClass([
  __decorateParam(0, IClipboardService),
  __decorateParam(1, IProductService)
], CopySettingAsURLAction);
let SyncSettingAction = class extends Action {
  constructor(setting, configService) {
    super(SyncSettingAction.ID, SyncSettingAction.LABEL);
    this.setting = setting;
    this.configService = configService;
    this._register(Event.filter(configService.onDidChangeConfiguration, (e) => e.affectsConfiguration("settingsSync.ignoredSettings"))(() => this.update()));
    this.update();
  }
  async update() {
    const ignoredSettings = getIgnoredSettings(getDefaultIgnoredSettings(), this.configService);
    this.checked = !ignoredSettings.includes(this.setting.key);
  }
  async run() {
    let currentValue = [...this.configService.getValue("settingsSync.ignoredSettings")];
    currentValue = currentValue.filter((v) => v !== this.setting.key && v !== `-${this.setting.key}`);
    const defaultIgnoredSettings = getDefaultIgnoredSettings();
    const isDefaultIgnored = defaultIgnoredSettings.includes(this.setting.key);
    const askedToSync = !this.checked;
    if (askedToSync && isDefaultIgnored) {
      currentValue.push(`-${this.setting.key}`);
    }
    if (!askedToSync && !isDefaultIgnored) {
      currentValue.push(this.setting.key);
    }
    this.configService.updateValue("settingsSync.ignoredSettings", currentValue.length ? currentValue : void 0, ConfigurationTarget.USER);
    return Promise.resolve(void 0);
  }
};
SyncSettingAction.ID = "settings.stopSyncingSetting";
SyncSettingAction.LABEL = localize("stopSyncingSetting", "Sync This Setting");
SyncSettingAction = __decorateClass([
  __decorateParam(1, IConfigurationService)
], SyncSettingAction);
let ApplySettingToAllProfilesAction = class extends Action {
  constructor(setting, configService) {
    super(ApplySettingToAllProfilesAction.ID, ApplySettingToAllProfilesAction.LABEL);
    this.setting = setting;
    this.configService = configService;
    this._register(Event.filter(configService.onDidChangeConfiguration, (e) => e.affectsConfiguration(APPLY_ALL_PROFILES_SETTING))(() => this.update()));
    this.update();
  }
  update() {
    const allProfilesSettings = this.configService.getValue(APPLY_ALL_PROFILES_SETTING);
    this.checked = allProfilesSettings.includes(this.setting.key);
  }
  async run() {
    const value = this.configService.getValue(APPLY_ALL_PROFILES_SETTING) ?? [];
    if (this.checked) {
      value.splice(value.indexOf(this.setting.key), 1);
    } else {
      value.push(this.setting.key);
    }
    const newValue = distinct(value);
    if (this.checked) {
      await this.configService.updateValue(this.setting.key, this.configService.inspect(this.setting.key).application?.value, ConfigurationTarget.USER_LOCAL);
      await this.configService.updateValue(APPLY_ALL_PROFILES_SETTING, newValue.length ? newValue : void 0, ConfigurationTarget.USER_LOCAL);
    } else {
      await this.configService.updateValue(APPLY_ALL_PROFILES_SETTING, newValue.length ? newValue : void 0, ConfigurationTarget.USER_LOCAL);
      await this.configService.updateValue(this.setting.key, this.configService.inspect(this.setting.key).userLocal?.value, ConfigurationTarget.USER_LOCAL);
    }
  }
};
ApplySettingToAllProfilesAction.ID = "settings.applyToAllProfiles";
ApplySettingToAllProfilesAction.LABEL = localize("applyToAllProfiles", "Apply Setting to all Profiles");
ApplySettingToAllProfilesAction = __decorateClass([
  __decorateParam(1, IWorkbenchConfigurationService)
], ApplySettingToAllProfilesAction);
export {
  AbstractSettingRenderer,
  NonCollapsibleObjectTreeModel,
  SettingComplexRenderer,
  SettingNewExtensionsRenderer,
  SettingTreeRenderers,
  SettingsTree,
  SettingsTreeFilter,
  createSettingMatchRegExp,
  createTocTreeForExtensionSettings,
  resolveConfiguredUntrustedSettings,
  resolveSettingsTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzVHJlZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEJyb3dzZXJGZWF0dXJlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jYW5JVXNlLmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGRvbVN0eWxlc2hlZXRzSnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duQXNQbGFpbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBTaW1wbGVJY29uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL3NpbXBsZUljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBJSW5wdXRPcHRpb25zLCBJbnB1dEJveCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pbnB1dGJveC9pbnB1dEJveC5qcyc7XG5pbXBvcnQgeyBDYWNoZWRMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0U3R5bGVDb250cm9sbGVyLCBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVNlbGVjdE9wdGlvbkl0ZW0sIFNlbGVjdEJveCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZWxlY3RCb3gvc2VsZWN0Qm94LmpzJztcbmltcG9ydCB7IFRvZ2dsZSwgdW50aGVtZWRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Rvb2xiYXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBSZW5kZXJJbmRlbnRHdWlkZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuaW1wb3J0IHsgSU9iamVjdFRyZWVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvb2JqZWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBPYmplY3RUcmVlTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSVRyZWVGaWx0ZXIsIElUcmVlTW9kZWwsIElUcmVlTm9kZSwgSVRyZWVSZW5kZXJlciwgVHJlZUZpbHRlclJlc3VsdCwgVHJlZVZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiwgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgaXNEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNJT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQsIGlzVW5kZWZpbmVkT3JOdWxsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGdldExhbmd1YWdlVGFnU2V0dGluZ1BsYWluS2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlLCBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBXb3JrYmVuY2hPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGdldElucHV0Qm94U3R5bGUsIGdldExpc3RTdHlsZXMsIGdldFNlbGVjdEJveFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kLCBmb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgZ2V0SWdub3JlZFNldHRpbmdzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi9zZXR0aW5nc01lcmdlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgZ2V0RGVmYXVsdElnbm9yZWRTZXR0aW5ncyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IEFQUExJQ0FUSU9OX1NDT1BFUywgQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcsIElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTZXR0aW5nLCBJU2V0dGluZ3NHcm91cCwgU0VUVElOR1NfQVVUSE9SSVRZLCBTZXR0aW5nVmFsdWVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IGdldEludmFsaWRUeXBlRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXNWYWxpZGF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgTEFOR1VBR0VfU0VUVElOR19UQUcsIFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX1NIT1dfQ09OVEVYVF9NRU5VLCBjb21wYXJlVHdvTnVsbGFibGVOdW1iZXJzIH0gZnJvbSAnLi4vY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IHNldHRpbmdzTnVtYmVySW5wdXRCYWNrZ3JvdW5kLCBzZXR0aW5nc051bWJlcklucHV0Qm9yZGVyLCBzZXR0aW5nc051bWJlcklucHV0Rm9yZWdyb3VuZCwgc2V0dGluZ3NTZWxlY3RCYWNrZ3JvdW5kLCBzZXR0aW5nc1NlbGVjdEJvcmRlciwgc2V0dGluZ3NTZWxlY3RGb3JlZ3JvdW5kLCBzZXR0aW5nc1NlbGVjdExpc3RCb3JkZXIsIHNldHRpbmdzVGV4dElucHV0QmFja2dyb3VuZCwgc2V0dGluZ3NUZXh0SW5wdXRCb3JkZXIsIHNldHRpbmdzVGV4dElucHV0Rm9yZWdyb3VuZCB9IGZyb20gJy4uL2NvbW1vbi9zZXR0aW5nc0VkaXRvckNvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgc2V0dGluZ3NNb3JlQWN0aW9uSWNvbiB9IGZyb20gJy4vcHJlZmVyZW5jZXNJY29ucy5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc1RhcmdldCB9IGZyb20gJy4vcHJlZmVyZW5jZXNXaWRnZXRzLmpzJztcbmltcG9ydCB7IElTZXR0aW5nT3ZlcnJpZGVDbGlja0V2ZW50LCBTZXR0aW5nc1RyZWVJbmRpY2F0b3JzTGFiZWwsIGdldEluZGljYXRvcnNMYWJlbEFyaWFMYWJlbCB9IGZyb20gJy4vc2V0dGluZ3NFZGl0b3JTZXR0aW5nSW5kaWNhdG9ycy5qcyc7XG5pbXBvcnQgeyBJVE9DRW50cnkgfSBmcm9tICcuL3NldHRpbmdzTGF5b3V0LmpzJztcbmltcG9ydCB7IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSwgU2V0dGluZ3NUcmVlRWxlbWVudCwgU2V0dGluZ3NUcmVlR3JvdXBDaGlsZCwgU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50LCBTZXR0aW5nc1RyZWVOZXdFeHRlbnNpb25zRWxlbWVudCwgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIGluc3BlY3RTZXR0aW5nLCBvYmplY3RTZXR0aW5nU3VwcG9ydHNSZW1vdmVEZWZhdWx0VmFsdWUsIHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQgfSBmcm9tICcuL3NldHRpbmdzVHJlZU1vZGVscy5qcyc7XG5pbXBvcnQgeyBFeGNsdWRlU2V0dGluZ1dpZGdldCwgSUJvb2xPYmplY3REYXRhSXRlbSwgSUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0sIElMaXN0RGF0YUl0ZW0sIElPYmplY3REYXRhSXRlbSwgSU9iamVjdEVudW1PcHRpb24sIElPYmplY3RLZXlTdWdnZXN0ZXIsIElPYmplY3RWYWx1ZVN1Z2dlc3RlciwgSW5jbHVkZVNldHRpbmdXaWRnZXQsIExpc3RTZXR0aW5nV2lkZ2V0LCBPYmplY3RTZXR0aW5nQ2hlY2tib3hXaWRnZXQsIE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldCwgT2JqZWN0VmFsdWUsIFNldHRpbmdMaXN0RXZlbnQgfSBmcm9tICcuL3NldHRpbmdzV2lkZ2V0cy5qcyc7XG5cbmNvbnN0ICQgPSBET00uJDtcblxuZnVuY3Rpb24gZ2V0SW5jbHVkZUV4Y2x1ZGVEaXNwbGF5VmFsdWUoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpOiBJSW5jbHVkZUV4Y2x1ZGVEYXRhSXRlbVtdIHtcblx0Y29uc3QgZWxlbWVudERlZmF1bHRWYWx1ZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB0eXBlb2YgZWxlbWVudC5kZWZhdWx0VmFsdWUgPT09ICdvYmplY3QnXG5cdFx0PyBlbGVtZW50LmRlZmF1bHRWYWx1ZSA/PyB7fVxuXHRcdDoge307XG5cblx0Y29uc3QgZGF0YSA9IGVsZW1lbnQuaXNDb25maWd1cmVkID9cblx0XHR7IC4uLmVsZW1lbnREZWZhdWx0VmFsdWUsIC4uLmVsZW1lbnQuc2NvcGVWYWx1ZSB9IDpcblx0XHRlbGVtZW50RGVmYXVsdFZhbHVlO1xuXG5cdHJldHVybiBPYmplY3Qua2V5cyhkYXRhKVxuXHRcdC5maWx0ZXIoa2V5ID0+ICEhZGF0YVtrZXldKVxuXHRcdC5tYXAoa2V5ID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRWYWx1ZSA9IGVsZW1lbnREZWZhdWx0VmFsdWVba2V5XTtcblxuXHRcdFx0Ly8gR2V0IHNvdXJjZSBpZiBpdCdzIGEgZGVmYXVsdCB2YWx1ZVxuXHRcdFx0bGV0IHNvdXJjZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGRlZmF1bHRWYWx1ZSA9PT0gZGF0YVtrZXldICYmIGVsZW1lbnQuc2V0dGluZy50eXBlID09PSAnb2JqZWN0JyAmJiBlbGVtZW50LmRlZmF1bHRWYWx1ZVNvdXJjZSBpbnN0YW5jZW9mIE1hcCkge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0U291cmNlID0gZWxlbWVudC5kZWZhdWx0VmFsdWVTb3VyY2UuZ2V0KGAke2VsZW1lbnQuc2V0dGluZy5rZXl9LiR7a2V5fWApO1xuXHRcdFx0XHRzb3VyY2UgPSB0eXBlb2YgZGVmYXVsdFNvdXJjZSA9PT0gJ3N0cmluZycgPyBkZWZhdWx0U291cmNlIDogZGVmYXVsdFNvdXJjZT8uZGlzcGxheU5hbWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZhbHVlID0gZGF0YVtrZXldO1xuXHRcdFx0Y29uc3Qgc2libGluZyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nID8gdW5kZWZpbmVkIDogdmFsdWUud2hlbjtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGF0YToga2V5XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNpYmxpbmcsXG5cdFx0XHRcdGVsZW1lbnRUeXBlOiBlbGVtZW50LnZhbHVlVHlwZSxcblx0XHRcdFx0c291cmNlXG5cdFx0XHR9O1xuXHRcdH0pO1xufVxuXG5mdW5jdGlvbiBhcmVBbGxQcm9wZXJ0aWVzRGVmaW5lZChwcm9wZXJ0aWVzOiBzdHJpbmdbXSwgaXRlbXNUb0Rpc3BsYXk6IElPYmplY3REYXRhSXRlbVtdKTogYm9vbGVhbiB7XG5cdGNvbnN0IHN0YXRpY1Byb3BlcnRpZXMgPSBuZXcgU2V0KHByb3BlcnRpZXMpO1xuXHRpdGVtc1RvRGlzcGxheS5mb3JFYWNoKCh7IGtleSB9KSA9PiBzdGF0aWNQcm9wZXJ0aWVzLmRlbGV0ZShrZXkuZGF0YSkpO1xuXHRyZXR1cm4gc3RhdGljUHJvcGVydGllcy5zaXplID09PSAwO1xufVxuXG5mdW5jdGlvbiBnZXRFbnVtT3B0aW9uc0Zyb21TY2hlbWEoc2NoZW1hOiBJSlNPTlNjaGVtYSk6IElPYmplY3RFbnVtT3B0aW9uW10ge1xuXHRpZiAoc2NoZW1hLmFueU9mKSB7XG5cdFx0cmV0dXJuIHNjaGVtYS5hbnlPZi5tYXAoZ2V0RW51bU9wdGlvbnNGcm9tU2NoZW1hKS5mbGF0KCk7XG5cdH1cblxuXHRjb25zdCBlbnVtRGVzY3JpcHRpb25zID0gc2NoZW1hLmVudW1EZXNjcmlwdGlvbnMgPz8gW107XG5cblx0cmV0dXJuIChzY2hlbWEuZW51bSA/PyBbXSkubWFwKCh2YWx1ZSwgaWR4KSA9PiB7XG5cdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBpZHggPCBlbnVtRGVzY3JpcHRpb25zLmxlbmd0aFxuXHRcdFx0PyBlbnVtRGVzY3JpcHRpb25zW2lkeF1cblx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0cmV0dXJuIHsgdmFsdWUsIGRlc2NyaXB0aW9uIH07XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBnZXRPYmplY3RWYWx1ZVR5cGUoc2NoZW1hOiBJSlNPTlNjaGVtYSk6IE9iamVjdFZhbHVlWyd0eXBlJ10ge1xuXHRpZiAoc2NoZW1hLmFueU9mKSB7XG5cdFx0Y29uc3Qgc3ViVHlwZXMgPSBzY2hlbWEuYW55T2YubWFwKGdldE9iamVjdFZhbHVlVHlwZSk7XG5cdFx0aWYgKHN1YlR5cGVzLnNvbWUodHlwZSA9PiB0eXBlID09PSAnZW51bScpKSB7XG5cdFx0XHRyZXR1cm4gJ2VudW0nO1xuXHRcdH1cblx0XHRyZXR1cm4gJ3N0cmluZyc7XG5cdH1cblxuXHRpZiAoc2NoZW1hLnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdHJldHVybiAnYm9vbGVhbic7XG5cdH0gZWxzZSBpZiAoc2NoZW1hLnR5cGUgPT09ICdzdHJpbmcnICYmIGlzRGVmaW5lZChzY2hlbWEuZW51bSkgJiYgc2NoZW1hLmVudW0ubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiAnZW51bSc7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuICdzdHJpbmcnO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdEVudHJ5VmFsdWVEaXNwbGF5VmFsdWUodHlwZTogT2JqZWN0VmFsdWVbJ3R5cGUnXSwgZGF0YTogdW5rbm93biwgb3B0aW9uczogSU9iamVjdEVudW1PcHRpb25bXSk6IE9iamVjdFZhbHVlIHtcblx0aWYgKHR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdHJldHVybiB7IHR5cGUsIGRhdGE6ICEhZGF0YSB9O1xuXHR9IGVsc2UgaWYgKHR5cGUgPT09ICdlbnVtJykge1xuXHRcdHJldHVybiB7IHR5cGUsIGRhdGE6ICcnICsgZGF0YSwgb3B0aW9ucyB9O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB7IHR5cGUsIGRhdGE6ICcnICsgZGF0YSB9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdERpc3BsYXlWYWx1ZShlbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCk6IElPYmplY3REYXRhSXRlbVtdIHtcblx0Y29uc3QgZWxlbWVudERlZmF1bHRWYWx1ZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB0eXBlb2YgZWxlbWVudC5kZWZhdWx0VmFsdWUgPT09ICdvYmplY3QnXG5cdFx0PyBlbGVtZW50LmRlZmF1bHRWYWx1ZSA/PyB7fVxuXHRcdDoge307XG5cblx0Y29uc3QgZWxlbWVudFNjb3BlVmFsdWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0gdHlwZW9mIGVsZW1lbnQuc2NvcGVWYWx1ZSA9PT0gJ29iamVjdCdcblx0XHQ/IGVsZW1lbnQuc2NvcGVWYWx1ZSA/PyB7fVxuXHRcdDoge307XG5cblx0Y29uc3QgZGF0YSA9IGVsZW1lbnQuaXNDb25maWd1cmVkID9cblx0XHR7IC4uLmVsZW1lbnREZWZhdWx0VmFsdWUsIC4uLmVsZW1lbnRTY29wZVZhbHVlIH0gOlxuXHRcdGVsZW1lbnQuaGFzUG9saWN5VmFsdWUgPyBlbGVtZW50LnNjb3BlVmFsdWUgOlxuXHRcdFx0ZWxlbWVudERlZmF1bHRWYWx1ZTtcblxuXHRjb25zdCB7IG9iamVjdFByb3BlcnRpZXMsIG9iamVjdFBhdHRlcm5Qcm9wZXJ0aWVzLCBvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyB9ID0gZWxlbWVudC5zZXR0aW5nO1xuXHRjb25zdCBwYXR0ZXJuc0FuZFNjaGVtYXMgPSBPYmplY3Rcblx0XHQuZW50cmllcyhvYmplY3RQYXR0ZXJuUHJvcGVydGllcyA/PyB7fSlcblx0XHQubWFwKChbcGF0dGVybiwgc2NoZW1hXSkgPT4gKHtcblx0XHRcdHBhdHRlcm46IG5ldyBSZWdFeHAocGF0dGVybiksXG5cdFx0XHRzY2hlbWFcblx0XHR9KSk7XG5cblx0Y29uc3Qgd2VsbERlZmluZWRLZXlFbnVtT3B0aW9ucyA9IE9iamVjdC5lbnRyaWVzKG9iamVjdFByb3BlcnRpZXMgPz8ge30pLm1hcChcblx0XHQoW2tleSwgc2NoZW1hXSkgPT4gKHsgdmFsdWU6IGtleSwgZGVzY3JpcHRpb246IHNjaGVtYS5kZXNjcmlwdGlvbiB9KVxuXHQpO1xuXG5cdHJldHVybiBPYmplY3Qua2V5cyhkYXRhKS5tYXAoa2V5ID0+IHtcblx0XHRjb25zdCBkZWZhdWx0VmFsdWUgPSBlbGVtZW50RGVmYXVsdFZhbHVlW2tleV07XG5cblx0XHQvLyBHZXQgc291cmNlIGlmIGl0J3MgYSBkZWZhdWx0IHZhbHVlXG5cdFx0bGV0IHNvdXJjZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChkZWZhdWx0VmFsdWUgPT09IGRhdGFba2V5XSAmJiBlbGVtZW50LnNldHRpbmcudHlwZSA9PT0gJ29iamVjdCcgJiYgZWxlbWVudC5kZWZhdWx0VmFsdWVTb3VyY2UgaW5zdGFuY2VvZiBNYXApIHtcblx0XHRcdGNvbnN0IGRlZmF1bHRTb3VyY2UgPSBlbGVtZW50LmRlZmF1bHRWYWx1ZVNvdXJjZS5nZXQoYCR7ZWxlbWVudC5zZXR0aW5nLmtleX0uJHtrZXl9YCk7XG5cdFx0XHRzb3VyY2UgPSB0eXBlb2YgZGVmYXVsdFNvdXJjZSA9PT0gJ3N0cmluZycgPyBkZWZhdWx0U291cmNlIDogZGVmYXVsdFNvdXJjZT8uZGlzcGxheU5hbWU7XG5cdFx0fVxuXG5cdFx0aWYgKGlzRGVmaW5lZChvYmplY3RQcm9wZXJ0aWVzKSAmJiBrZXkgaW4gb2JqZWN0UHJvcGVydGllcykge1xuXHRcdFx0Y29uc3QgdmFsdWVFbnVtT3B0aW9ucyA9IGdldEVudW1PcHRpb25zRnJvbVNjaGVtYShvYmplY3RQcm9wZXJ0aWVzW2tleV0pO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2V5OiB7XG5cdFx0XHRcdFx0dHlwZTogJ2VudW0nLFxuXHRcdFx0XHRcdGRhdGE6IGtleSxcblx0XHRcdFx0XHRvcHRpb25zOiB3ZWxsRGVmaW5lZEtleUVudW1PcHRpb25zLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR2YWx1ZTogZ2V0T2JqZWN0RW50cnlWYWx1ZURpc3BsYXlWYWx1ZShnZXRPYmplY3RWYWx1ZVR5cGUob2JqZWN0UHJvcGVydGllc1trZXldKSwgZGF0YVtrZXldLCB2YWx1ZUVudW1PcHRpb25zKSxcblx0XHRcdFx0a2V5RGVzY3JpcHRpb246IG9iamVjdFByb3BlcnRpZXNba2V5XS5kZXNjcmlwdGlvbixcblx0XHRcdFx0cmVtb3ZhYmxlOiBpc1VuZGVmaW5lZE9yTnVsbChkZWZhdWx0VmFsdWUpLFxuXHRcdFx0XHRyZXNldGFibGU6ICFpc1VuZGVmaW5lZE9yTnVsbChkZWZhdWx0VmFsdWUpLFxuXHRcdFx0XHRzb3VyY2Vcblx0XHRcdH0gc2F0aXNmaWVzIElPYmplY3REYXRhSXRlbTtcblx0XHR9XG5cblx0XHQvLyBUaGUgcm93IGlzIHJlbW92YWJsZSBpZiBpdCBkb2Vzbid0IGhhdmUgYSBkZWZhdWx0IHZhbHVlIGFzc2lnbmVkIG9yIHRoZSBzZXR0aW5nIHN1cHBvcnRzIHJlbW92aW5nIHRoZSBkZWZhdWx0IHZhbHVlLlxuXHRcdC8vIElmIGEgZGVmYXVsdCB2YWx1ZSBpcyBhc3NpZ25lZCBhbmQgdGhlIHVzZXIgbW9kaWZpZWQgdGhlIGRlZmF1bHQsIGl0IGNhbiBiZSByZXNldCBiYWNrIHRvIHRoZSBkZWZhdWx0LlxuXHRcdGNvbnN0IHJlbW92YWJsZSA9IGRlZmF1bHRWYWx1ZSA9PT0gdW5kZWZpbmVkIHx8IG9iamVjdFNldHRpbmdTdXBwb3J0c1JlbW92ZURlZmF1bHRWYWx1ZShlbGVtZW50LnNldHRpbmcua2V5KTtcblx0XHRjb25zdCByZXNldGFibGUgPSAhIWRlZmF1bHRWYWx1ZSAmJiBkZWZhdWx0VmFsdWUgIT09IGRhdGFba2V5XTtcblx0XHRjb25zdCBzY2hlbWEgPSBwYXR0ZXJuc0FuZFNjaGVtYXMuZmluZCgoeyBwYXR0ZXJuIH0pID0+IHBhdHRlcm4udGVzdChrZXkpKT8uc2NoZW1hO1xuXHRcdGlmIChzY2hlbWEpIHtcblx0XHRcdGNvbnN0IHZhbHVlRW51bU9wdGlvbnMgPSBnZXRFbnVtT3B0aW9uc0Zyb21TY2hlbWEoc2NoZW1hKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtleTogeyB0eXBlOiAnc3RyaW5nJywgZGF0YToga2V5IH0sXG5cdFx0XHRcdHZhbHVlOiBnZXRPYmplY3RFbnRyeVZhbHVlRGlzcGxheVZhbHVlKGdldE9iamVjdFZhbHVlVHlwZShzY2hlbWEpLCBkYXRhW2tleV0sIHZhbHVlRW51bU9wdGlvbnMpLFxuXHRcdFx0XHRrZXlEZXNjcmlwdGlvbjogc2NoZW1hLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRyZW1vdmFibGUsXG5cdFx0XHRcdHJlc2V0YWJsZSxcblx0XHRcdFx0c291cmNlXG5cdFx0XHR9IHNhdGlzZmllcyBJT2JqZWN0RGF0YUl0ZW07XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWRkaXRpb25hbFZhbHVlRW51bXMgPSBnZXRFbnVtT3B0aW9uc0Zyb21TY2hlbWEoXG5cdFx0XHR0eXBlb2Ygb2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMgPT09ICdib29sZWFuJ1xuXHRcdFx0XHQ/IHt9XG5cdFx0XHRcdDogb2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMgPz8ge31cblx0XHQpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGtleTogeyB0eXBlOiAnc3RyaW5nJywgZGF0YToga2V5IH0sXG5cdFx0XHR2YWx1ZTogZ2V0T2JqZWN0RW50cnlWYWx1ZURpc3BsYXlWYWx1ZShcblx0XHRcdFx0dHlwZW9mIG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzID09PSAnb2JqZWN0JyA/IGdldE9iamVjdFZhbHVlVHlwZShvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcykgOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGF0YVtrZXldLFxuXHRcdFx0XHRhZGRpdGlvbmFsVmFsdWVFbnVtcyxcblx0XHRcdCksXG5cdFx0XHRrZXlEZXNjcmlwdGlvbjogdHlwZW9mIG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzID09PSAnb2JqZWN0JyA/IG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzLmRlc2NyaXB0aW9uIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVtb3ZhYmxlLFxuXHRcdFx0cmVzZXRhYmxlLFxuXHRcdFx0c291cmNlXG5cdFx0fSBzYXRpc2ZpZXMgSU9iamVjdERhdGFJdGVtO1xuXHR9KS5maWx0ZXIoaXRlbSA9PiAhaXNVbmRlZmluZWRPck51bGwoaXRlbS52YWx1ZS5kYXRhKSk7XG59XG5cbmZ1bmN0aW9uIGdldEJvb2xPYmplY3REaXNwbGF5VmFsdWUoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpOiBJQm9vbE9iamVjdERhdGFJdGVtW10ge1xuXHRjb25zdCBlbGVtZW50RGVmYXVsdFZhbHVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHR5cGVvZiBlbGVtZW50LmRlZmF1bHRWYWx1ZSA9PT0gJ29iamVjdCdcblx0XHQ/IGVsZW1lbnQuZGVmYXVsdFZhbHVlID8/IHt9XG5cdFx0OiB7fTtcblxuXHRjb25zdCBlbGVtZW50U2NvcGVWYWx1ZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB0eXBlb2YgZWxlbWVudC5zY29wZVZhbHVlID09PSAnb2JqZWN0J1xuXHRcdD8gZWxlbWVudC5zY29wZVZhbHVlID8/IHt9XG5cdFx0OiB7fTtcblxuXHRjb25zdCBkYXRhID0gZWxlbWVudC5pc0NvbmZpZ3VyZWQgP1xuXHRcdHsgLi4uZWxlbWVudERlZmF1bHRWYWx1ZSwgLi4uZWxlbWVudFNjb3BlVmFsdWUgfSA6XG5cdFx0ZWxlbWVudERlZmF1bHRWYWx1ZTtcblxuXHRjb25zdCB7IG9iamVjdFByb3BlcnRpZXMgfSA9IGVsZW1lbnQuc2V0dGluZztcblx0Y29uc3QgZGlzcGxheVZhbHVlczogSUJvb2xPYmplY3REYXRhSXRlbVtdID0gW107XG5cdGZvciAoY29uc3Qga2V5IGluIG9iamVjdFByb3BlcnRpZXMpIHtcblx0XHRjb25zdCBkZWZhdWx0VmFsdWUgPSBlbGVtZW50RGVmYXVsdFZhbHVlW2tleV07XG5cblx0XHQvLyBHZXQgc291cmNlIGlmIGl0J3MgYSBkZWZhdWx0IHZhbHVlXG5cdFx0bGV0IHNvdXJjZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChkZWZhdWx0VmFsdWUgPT09IGRhdGFba2V5XSAmJiBlbGVtZW50LnNldHRpbmcudHlwZSA9PT0gJ29iamVjdCcgJiYgZWxlbWVudC5kZWZhdWx0VmFsdWVTb3VyY2UgaW5zdGFuY2VvZiBNYXApIHtcblx0XHRcdGNvbnN0IGRlZmF1bHRTb3VyY2UgPSBlbGVtZW50LmRlZmF1bHRWYWx1ZVNvdXJjZS5nZXQoa2V5KTtcblx0XHRcdHNvdXJjZSA9IHR5cGVvZiBkZWZhdWx0U291cmNlID09PSAnc3RyaW5nJyA/IGRlZmF1bHRTb3VyY2UgOiBkZWZhdWx0U291cmNlPy5kaXNwbGF5TmFtZTtcblx0XHR9XG5cblx0XHRkaXNwbGF5VmFsdWVzLnB1c2goe1xuXHRcdFx0a2V5OiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkYXRhOiBrZXlcblx0XHRcdH0sXG5cdFx0XHR2YWx1ZToge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRhdGE6ICEhZGF0YVtrZXldXG5cdFx0XHR9LFxuXHRcdFx0a2V5RGVzY3JpcHRpb246IG9iamVjdFByb3BlcnRpZXNba2V5XS5kZXNjcmlwdGlvbixcblx0XHRcdHJlbW92YWJsZTogZmFsc2UsXG5cdFx0XHRyZXNldGFibGU6IHRydWUsXG5cdFx0XHRzb3VyY2Vcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gZGlzcGxheVZhbHVlcztcbn1cblxuZnVuY3Rpb24gY3JlYXRlQXJyYXlTdWdnZXN0ZXIoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpOiBJT2JqZWN0S2V5U3VnZ2VzdGVyIHtcblx0cmV0dXJuIChrZXlzLCBpZHgpID0+IHtcblx0XHRjb25zdCBlbnVtT3B0aW9uczogSU9iamVjdEVudW1PcHRpb25bXSA9IFtdO1xuXG5cdFx0aWYgKGVsZW1lbnQuc2V0dGluZy5lbnVtKSB7XG5cdFx0XHRlbGVtZW50LnNldHRpbmcuZW51bS5mb3JFYWNoKChrZXksIGkpID0+IHtcblx0XHRcdFx0Ly8gaW5jbHVkZSB0aGUgY3VycmVudGx5IHNlbGVjdGVkIHZhbHVlLCBldmVuIGlmIHVuaXF1ZUl0ZW1zIGlzIHRydWVcblx0XHRcdFx0aWYgKCFlbGVtZW50LnNldHRpbmcudW5pcXVlSXRlbXMgfHwgKGlkeCAhPT0gdW5kZWZpbmVkICYmIGtleSA9PT0ga2V5c1tpZHhdKSB8fCAha2V5cy5pbmNsdWRlcyhrZXkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBlbGVtZW50LnNldHRpbmcuZW51bURlc2NyaXB0aW9ucz8uW2ldO1xuXHRcdFx0XHRcdGVudW1PcHRpb25zLnB1c2goeyB2YWx1ZToga2V5LCBkZXNjcmlwdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVudW1PcHRpb25zLmxlbmd0aCA+IDBcblx0XHRcdD8geyB0eXBlOiAnZW51bScsIGRhdGE6IGVudW1PcHRpb25zWzBdLnZhbHVlLCBvcHRpb25zOiBlbnVtT3B0aW9ucyB9XG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0fTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT2JqZWN0S2V5U3VnZ2VzdGVyKGVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KTogSU9iamVjdEtleVN1Z2dlc3RlciB7XG5cdGNvbnN0IHsgb2JqZWN0UHJvcGVydGllcyB9ID0gZWxlbWVudC5zZXR0aW5nO1xuXHRjb25zdCBhbGxTdGF0aWNLZXlzID0gT2JqZWN0LmtleXMob2JqZWN0UHJvcGVydGllcyA/PyB7fSk7XG5cblx0cmV0dXJuIGtleXMgPT4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nS2V5cyA9IG5ldyBTZXQoa2V5cyk7XG5cdFx0Y29uc3QgZW51bU9wdGlvbnM6IElPYmplY3RFbnVtT3B0aW9uW10gPSBbXTtcblxuXHRcdGFsbFN0YXRpY0tleXMuZm9yRWFjaChzdGF0aWNLZXkgPT4ge1xuXHRcdFx0aWYgKCFleGlzdGluZ0tleXMuaGFzKHN0YXRpY0tleSkpIHtcblx0XHRcdFx0ZW51bU9wdGlvbnMucHVzaCh7IHZhbHVlOiBzdGF0aWNLZXksIGRlc2NyaXB0aW9uOiBvYmplY3RQcm9wZXJ0aWVzIVtzdGF0aWNLZXldLmRlc2NyaXB0aW9uIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGVudW1PcHRpb25zLmxlbmd0aCA+IDBcblx0XHRcdD8geyB0eXBlOiAnZW51bScsIGRhdGE6IGVudW1PcHRpb25zWzBdLnZhbHVlLCBvcHRpb25zOiBlbnVtT3B0aW9ucyB9XG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0fTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT2JqZWN0VmFsdWVTdWdnZXN0ZXIoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpOiBJT2JqZWN0VmFsdWVTdWdnZXN0ZXIge1xuXHRjb25zdCB7IG9iamVjdFByb3BlcnRpZXMsIG9iamVjdFBhdHRlcm5Qcm9wZXJ0aWVzLCBvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcyB9ID0gZWxlbWVudC5zZXR0aW5nO1xuXG5cdGNvbnN0IHBhdHRlcm5zQW5kU2NoZW1hcyA9IE9iamVjdFxuXHRcdC5lbnRyaWVzKG9iamVjdFBhdHRlcm5Qcm9wZXJ0aWVzID8/IHt9KVxuXHRcdC5tYXAoKFtwYXR0ZXJuLCBzY2hlbWFdKSA9PiAoe1xuXHRcdFx0cGF0dGVybjogbmV3IFJlZ0V4cChwYXR0ZXJuKSxcblx0XHRcdHNjaGVtYVxuXHRcdH0pKTtcblxuXHRyZXR1cm4gKGtleTogc3RyaW5nKSA9PiB7XG5cdFx0bGV0IHN1Z2dlc3RlZFNjaGVtYTogSUpTT05TY2hlbWEgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAoaXNEZWZpbmVkKG9iamVjdFByb3BlcnRpZXMpICYmIGtleSBpbiBvYmplY3RQcm9wZXJ0aWVzKSB7XG5cdFx0XHRzdWdnZXN0ZWRTY2hlbWEgPSBvYmplY3RQcm9wZXJ0aWVzW2tleV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGF0dGVyblNjaGVtYSA9IHN1Z2dlc3RlZFNjaGVtYSA/PyBwYXR0ZXJuc0FuZFNjaGVtYXMuZmluZCgoeyBwYXR0ZXJuIH0pID0+IHBhdHRlcm4udGVzdChrZXkpKT8uc2NoZW1hO1xuXG5cdFx0aWYgKGlzRGVmaW5lZChwYXR0ZXJuU2NoZW1hKSkge1xuXHRcdFx0c3VnZ2VzdGVkU2NoZW1hID0gcGF0dGVyblNjaGVtYTtcblx0XHR9IGVsc2UgaWYgKGlzRGVmaW5lZChvYmplY3RBZGRpdGlvbmFsUHJvcGVydGllcykgJiYgdHlwZW9mIG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuXHRcdFx0c3VnZ2VzdGVkU2NoZW1hID0gb2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXM7XG5cdFx0fVxuXG5cdFx0aWYgKGlzRGVmaW5lZChzdWdnZXN0ZWRTY2hlbWEpKSB7XG5cdFx0XHRjb25zdCB0eXBlID0gZ2V0T2JqZWN0VmFsdWVUeXBlKHN1Z2dlc3RlZFNjaGVtYSk7XG5cblx0XHRcdGlmICh0eXBlID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0cmV0dXJuIHsgdHlwZSwgZGF0YTogc3VnZ2VzdGVkU2NoZW1hLmRlZmF1bHQgPz8gdHJ1ZSB9O1xuXHRcdFx0fSBlbHNlIGlmICh0eXBlID09PSAnZW51bScpIHtcblx0XHRcdFx0Y29uc3Qgb3B0aW9ucyA9IGdldEVudW1PcHRpb25zRnJvbVNjaGVtYShzdWdnZXN0ZWRTY2hlbWEpO1xuXHRcdFx0XHRyZXR1cm4geyB0eXBlLCBkYXRhOiBzdWdnZXN0ZWRTY2hlbWEuZGVmYXVsdCA/PyBvcHRpb25zWzBdLnZhbHVlLCBvcHRpb25zIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4geyB0eXBlLCBkYXRhOiBzdWdnZXN0ZWRTY2hlbWEuZGVmYXVsdCA/PyAnJyB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fTtcbn1cblxuZnVuY3Rpb24gaXNOb25OdWxsYWJsZU51bWVyaWNUeXBlKHR5cGU6IHVua25vd24pOiB0eXBlIGlzICdudW1iZXInIHwgJ2ludGVnZXInIHtcblx0cmV0dXJuIHR5cGUgPT09ICdudW1iZXInIHx8IHR5cGUgPT09ICdpbnRlZ2VyJztcbn1cblxuZnVuY3Rpb24gcGFyc2VOdW1lcmljT2JqZWN0VmFsdWVzKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG5cdGNvbnN0IG5ld1JlY29yZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcblx0Zm9yIChjb25zdCBrZXkgaW4gdikge1xuXHRcdC8vIFNldCB0byB0cnVlL2ZhbHNlIG9uY2Ugd2UncmUgc3VyZSBvZiB0aGUgYW5zd2VyXG5cdFx0bGV0IGtleU1hdGNoZXNOdW1lcmljUHJvcGVydHk6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGF0dGVyblByb3BlcnRpZXMgPSBkYXRhRWxlbWVudC5zZXR0aW5nLm9iamVjdFBhdHRlcm5Qcm9wZXJ0aWVzO1xuXHRcdGNvbnN0IHByb3BlcnRpZXMgPSBkYXRhRWxlbWVudC5zZXR0aW5nLm9iamVjdFByb3BlcnRpZXM7XG5cdFx0Y29uc3QgYWRkaXRpb25hbFByb3BlcnRpZXMgPSBkYXRhRWxlbWVudC5zZXR0aW5nLm9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzO1xuXG5cdFx0Ly8gTWF0Y2ggdGhlIGN1cnJlbnQgcmVjb3JkIGtleSBhZ2FpbnN0IHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3Rcblx0XHRpZiAocHJvcGVydGllcykge1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wS2V5IGluIHByb3BlcnRpZXMpIHtcblx0XHRcdFx0aWYgKHByb3BLZXkgPT09IGtleSkge1xuXHRcdFx0XHRcdGtleU1hdGNoZXNOdW1lcmljUHJvcGVydHkgPSBpc05vbk51bGxhYmxlTnVtZXJpY1R5cGUocHJvcGVydGllc1twcm9wS2V5XS50eXBlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoa2V5TWF0Y2hlc051bWVyaWNQcm9wZXJ0eSA9PT0gdW5kZWZpbmVkICYmIHBhdHRlcm5Qcm9wZXJ0aWVzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHBhdHRlcm5LZXkgaW4gcGF0dGVyblByb3BlcnRpZXMpIHtcblx0XHRcdFx0aWYgKGtleS5tYXRjaChwYXR0ZXJuS2V5KSkge1xuXHRcdFx0XHRcdGtleU1hdGNoZXNOdW1lcmljUHJvcGVydHkgPSBpc05vbk51bGxhYmxlTnVtZXJpY1R5cGUocGF0dGVyblByb3BlcnRpZXNbcGF0dGVybktleV0udHlwZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGtleU1hdGNoZXNOdW1lcmljUHJvcGVydHkgPT09IHVuZGVmaW5lZCAmJiBhZGRpdGlvbmFsUHJvcGVydGllcyAmJiB0eXBlb2YgYWRkaXRpb25hbFByb3BlcnRpZXMgIT09ICdib29sZWFuJykge1xuXHRcdFx0aWYgKGlzTm9uTnVsbGFibGVOdW1lcmljVHlwZShhZGRpdGlvbmFsUHJvcGVydGllcy50eXBlKSkge1xuXHRcdFx0XHRrZXlNYXRjaGVzTnVtZXJpY1Byb3BlcnR5ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0bmV3UmVjb3JkW2tleV0gPSBrZXlNYXRjaGVzTnVtZXJpY1Byb3BlcnR5ID8gTnVtYmVyKHZba2V5XSkgOiB2W2tleV07XG5cdH1cblx0cmV0dXJuIG5ld1JlY29yZDtcbn1cblxuZnVuY3Rpb24gZ2V0TGlzdERpc3BsYXlWYWx1ZShlbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCk6IElMaXN0RGF0YUl0ZW1bXSB7XG5cdGlmICghZWxlbWVudC52YWx1ZSB8fCAhQXJyYXkuaXNBcnJheShlbGVtZW50LnZhbHVlKSkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGlmIChlbGVtZW50LnNldHRpbmcuYXJyYXlJdGVtVHlwZSA9PT0gJ2VudW0nKSB7XG5cdFx0bGV0IGVudW1PcHRpb25zOiBJT2JqZWN0RW51bU9wdGlvbltdID0gW107XG5cdFx0aWYgKGVsZW1lbnQuc2V0dGluZy5lbnVtKSB7XG5cdFx0XHRlbnVtT3B0aW9ucyA9IGVsZW1lbnQuc2V0dGluZy5lbnVtLm1hcCgoc2V0dGluZywgaSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHZhbHVlOiBzZXR0aW5nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBlbGVtZW50LnNldHRpbmcuZW51bURlc2NyaXB0aW9ucz8uW2ldXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGVsZW1lbnQudmFsdWUubWFwKChrZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHR0eXBlOiAnZW51bScsXG5cdFx0XHRcdFx0ZGF0YToga2V5LFxuXHRcdFx0XHRcdG9wdGlvbnM6IGVudW1PcHRpb25zXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQudmFsdWUubWFwKChrZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkYXRhOiBrZXlcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRTaG93QWRkQnV0dG9uTGlzdChkYXRhRWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIGxpc3REaXNwbGF5VmFsdWU6IElMaXN0RGF0YUl0ZW1bXSk6IGJvb2xlYW4ge1xuXHRpZiAoZGF0YUVsZW1lbnQuc2V0dGluZy5lbnVtICYmIGRhdGFFbGVtZW50LnNldHRpbmcudW5pcXVlSXRlbXMpIHtcblx0XHRyZXR1cm4gZGF0YUVsZW1lbnQuc2V0dGluZy5lbnVtLmxlbmd0aCAtIGxpc3REaXNwbGF5VmFsdWUubGVuZ3RoID4gMDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNldHRpbmdzVHJlZSh0b2NEYXRhOiBJVE9DRW50cnk8c3RyaW5nPiwgY29yZVNldHRpbmdzR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdLCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSk6IHsgdHJlZTogSVRPQ0VudHJ5PElTZXR0aW5nPjsgbGVmdG92ZXJTZXR0aW5nczogU2V0PElTZXR0aW5nPiB9IHtcblx0Y29uc3QgYWxsU2V0dGluZ3MgPSBnZXRGbGF0U2V0dGluZ3MoY29yZVNldHRpbmdzR3JvdXBzKTtcblx0cmV0dXJuIHtcblx0XHR0cmVlOiBfcmVzb2x2ZVNldHRpbmdzVHJlZSh0b2NEYXRhLCBhbGxTZXR0aW5ncywgbG9nU2VydmljZSksXG5cdFx0bGVmdG92ZXJTZXR0aW5nczogYWxsU2V0dGluZ3Ncblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb25maWd1cmVkVW50cnVzdGVkU2V0dGluZ3MoZ3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdLCB0YXJnZXQ6IFNldHRpbmdzVGFyZ2V0LCBsYW5ndWFnZUZpbHRlcjogc3RyaW5nIHwgdW5kZWZpbmVkLCBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlKTogSVNldHRpbmdbXSB7XG5cdGNvbnN0IGFsbFNldHRpbmdzID0gZ2V0RmxhdFNldHRpbmdzKGdyb3Vwcyk7XG5cdHJldHVybiBbLi4uYWxsU2V0dGluZ3NdLmZpbHRlcihzZXR0aW5nID0+IHNldHRpbmcucmVzdHJpY3RlZCAmJiBpbnNwZWN0U2V0dGluZyhzZXR0aW5nLmtleSwgdGFyZ2V0LCBsYW5ndWFnZUZpbHRlciwgY29uZmlndXJhdGlvblNlcnZpY2UpLmlzQ29uZmlndXJlZCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVUb2NUcmVlRm9yRXh0ZW5zaW9uU2V0dGluZ3MoZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsIGdyb3VwczogSVNldHRpbmdzR3JvdXBbXSk6IFByb21pc2U8SVRPQ0VudHJ5PElTZXR0aW5nPj4ge1xuXHRjb25zdCBleHRHcm91cFRyZWUgPSBuZXcgTWFwPHN0cmluZywgSVRPQ0VudHJ5PElTZXR0aW5nPj4oKTtcblx0Y29uc3QgYWRkRW50cnlUb1RyZWUgPSAoZXh0ZW5zaW9uSWQ6IHN0cmluZywgZXh0ZW5zaW9uTmFtZTogc3RyaW5nLCBjaGlsZEVudHJ5OiBJVE9DRW50cnk8SVNldHRpbmc+KSA9PiB7XG5cdFx0aWYgKCFleHRHcm91cFRyZWUuaGFzKGV4dGVuc2lvbklkKSkge1xuXHRcdFx0Y29uc3Qgcm9vdEVudHJ5ID0ge1xuXHRcdFx0XHRpZDogZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdGxhYmVsOiBleHRlbnNpb25OYW1lLFxuXHRcdFx0XHRjaGlsZHJlbjogW11cblx0XHRcdH07XG5cdFx0XHRleHRHcm91cFRyZWUuc2V0KGV4dGVuc2lvbklkLCByb290RW50cnkpO1xuXHRcdH1cblx0XHRleHRHcm91cFRyZWUuZ2V0KGV4dGVuc2lvbklkKSEuY2hpbGRyZW4hLnB1c2goY2hpbGRFbnRyeSk7XG5cdH07XG5cdGNvbnN0IHByb2Nlc3NHcm91cEVudHJ5ID0gYXN5bmMgKGdyb3VwOiBJU2V0dGluZ3NHcm91cCkgPT4ge1xuXHRcdGNvbnN0IGZsYXRTZXR0aW5ncyA9IGdyb3VwLnNlY3Rpb25zLm1hcChzZWN0aW9uID0+IHNlY3Rpb24uc2V0dGluZ3MpLmZsYXQoKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZ3JvdXAuZXh0ZW5zaW9uSW5mbyEuaWQ7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gYXdhaXQgZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb24oZXh0ZW5zaW9uSWQpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbk5hbWUgPSBleHRlbnNpb24/LmRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbj8ubmFtZSA/PyBleHRlbnNpb25JZDtcblxuXHRcdC8vIFRoZXJlIGNvdWxkIGJlIG11bHRpcGxlIGdyb3VwcyB3aXRoIHRoZSBzYW1lIGV4dGVuc2lvbiBpZCB0aGF0IGFsbCBiZWxvbmcgdG8gdGhlIHNhbWUgZXh0ZW5zaW9uLlxuXHRcdC8vIFRvIGF2b2lkIGhpZ2hsaWdodGluZyBhbGwgZ3JvdXBzIHVwb24gZXhwYW5kaW5nIHRoZSBleHRlbnNpb24ncyBUb0MgZW50cnksXG5cdFx0Ly8gdXNlIHRoZSBncm91cCBJRCBvbmx5IGlmIGl0IGlzIG5vbi1lbXB0eSBhbmQgaXNuJ3QgdGhlIGV4dGVuc2lvbiBJRC5cblx0XHQvLyBSZWYgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI0MTUyMS5cblx0XHRjb25zdCBzZXR0aW5nR3JvdXBJZCA9IChncm91cC5pZCAmJiBncm91cC5pZCAhPT0gZXh0ZW5zaW9uSWQpID8gZ3JvdXAuaWQgOiBncm91cC50aXRsZTtcblxuXHRcdGNvbnN0IGNoaWxkRW50cnk6IElUT0NFbnRyeTxJU2V0dGluZz4gPSB7XG5cdFx0XHRpZDogc2V0dGluZ0dyb3VwSWQsXG5cdFx0XHRsYWJlbDogZ3JvdXAudGl0bGUsXG5cdFx0XHRvcmRlcjogZ3JvdXAub3JkZXIsXG5cdFx0XHRzZXR0aW5nczogZmxhdFNldHRpbmdzXG5cdFx0fTtcblx0XHRhZGRFbnRyeVRvVHJlZShleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSwgY2hpbGRFbnRyeSk7XG5cdH07XG5cblx0Y29uc3QgcHJvY2Vzc1Byb21pc2VzID0gZ3JvdXBzLm1hcChnID0+IHByb2Nlc3NHcm91cEVudHJ5KGcpKTtcblx0cmV0dXJuIFByb21pc2UuYWxsKHByb2Nlc3NQcm9taXNlcykudGhlbigoKSA9PiB7XG5cdFx0Y29uc3QgZXh0R3JvdXBzOiBJVE9DRW50cnk8SVNldHRpbmc+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvblJvb3RFbnRyeSBvZiBleHRHcm91cFRyZWUudmFsdWVzKCkpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZXh0ZW5zaW9uUm9vdEVudHJ5LmNoaWxkcmVuISkge1xuXHRcdFx0XHQvLyBTb3J0IHRoZSBpbmRpdmlkdWFsIHNldHRpbmdzIG9mIHRoZSBjaGlsZCBieSBvcmRlci5cblx0XHRcdFx0Ly8gTGVhdmUgdGhlIHVuZGVmaW5lZCBvcmRlciBzZXR0aW5ncyB1bnRvdWNoZWQuXG5cdFx0XHRcdGNoaWxkLnNldHRpbmdzPy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbXBhcmVUd29OdWxsYWJsZU51bWJlcnMoYS5vcmRlciwgYi5vcmRlcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZXh0ZW5zaW9uUm9vdEVudHJ5LmNoaWxkcmVuIS5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Ly8gVGhlcmUgaXMgYSBzaW5nbGUgY2F0ZWdvcnkgZm9yIHRoaXMgZXh0ZW5zaW9uLlxuXHRcdFx0XHQvLyBQdXNoIGEgZmxhdHRlbmVkIHNldHRpbmcuXG5cdFx0XHRcdGV4dEdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRpZDogZXh0ZW5zaW9uUm9vdEVudHJ5LmlkLFxuXHRcdFx0XHRcdGxhYmVsOiBleHRlbnNpb25Sb290RW50cnkuY2hpbGRyZW4hWzBdLmxhYmVsLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBleHRlbnNpb25Sb290RW50cnkuY2hpbGRyZW4hWzBdLnNldHRpbmdzXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU29ydCB0aGUgY2F0ZWdvcmllcy5cblx0XHRcdFx0Ly8gTGVhdmUgdGhlIHVuZGVmaW5lZCBvcmRlciBjYXRlZ29yaWVzIHVudG91Y2hlZC5cblx0XHRcdFx0ZXh0ZW5zaW9uUm9vdEVudHJ5LmNoaWxkcmVuIS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbXBhcmVUd29OdWxsYWJsZU51bWJlcnMoYS5vcmRlciwgYi5vcmRlcik7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdC8vIElmIHRoZXJlIGlzIGEgY2F0ZWdvcnkgdGhhdCBtYXRjaGVzIHRoZSBzZXR0aW5nIG5hbWUsXG5cdFx0XHRcdC8vIGFkZCB0aGUgc2V0dGluZ3MgaW4gbWFudWFsbHkgYXMgXCJ1bmdyb3VwZWRcIiBzZXR0aW5ncy5cblx0XHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNzI1OVxuXHRcdFx0XHRjb25zdCB1bmdyb3VwZWRDaGlsZCA9IGV4dGVuc2lvblJvb3RFbnRyeS5jaGlsZHJlbiEuZmluZChjaGlsZCA9PiBjaGlsZC5sYWJlbCA9PT0gZXh0ZW5zaW9uUm9vdEVudHJ5LmxhYmVsKTtcblx0XHRcdFx0aWYgKHVuZ3JvdXBlZENoaWxkICYmICF1bmdyb3VwZWRDaGlsZC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdGNvbnN0IGdyb3VwZWRDaGlsZHJlbiA9IGV4dGVuc2lvblJvb3RFbnRyeS5jaGlsZHJlbiEuZmlsdGVyKGNoaWxkID0+IGNoaWxkICE9PSB1bmdyb3VwZWRDaGlsZCk7XG5cdFx0XHRcdFx0ZXh0R3JvdXBzLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IGV4dGVuc2lvblJvb3RFbnRyeS5pZCxcblx0XHRcdFx0XHRcdGxhYmVsOiBleHRlbnNpb25Sb290RW50cnkubGFiZWwsXG5cdFx0XHRcdFx0XHRzZXR0aW5nczogdW5ncm91cGVkQ2hpbGQuc2V0dGluZ3MsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogZ3JvdXBlZENoaWxkcmVuXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gUHVzaCBhbGwgdGhlIGdyb3VwcyBhcy1pcy5cblx0XHRcdFx0XHRleHRHcm91cHMucHVzaChleHRlbnNpb25Sb290RW50cnkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU29ydCB0aGUgb3V0ZXJtb3N0IHNldHRpbmdzLlxuXHRcdGV4dEdyb3Vwcy5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiAnZXh0ZW5zaW9ucycsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2V4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnNcIiksXG5cdFx0XHRjaGlsZHJlbjogZXh0R3JvdXBzXG5cdFx0fTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIF9yZXNvbHZlU2V0dGluZ3NUcmVlKHRvY0RhdGE6IElUT0NFbnRyeTxzdHJpbmc+LCBhbGxTZXR0aW5nczogU2V0PElTZXR0aW5nPiwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpOiBJVE9DRW50cnk8SVNldHRpbmc+IHtcblx0bGV0IGNoaWxkcmVuOiBJVE9DRW50cnk8SVNldHRpbmc+W10gfCB1bmRlZmluZWQ7XG5cdGlmICh0b2NEYXRhLmNoaWxkcmVuKSB7XG5cdFx0Y2hpbGRyZW4gPSB0b2NEYXRhLmNoaWxkcmVuXG5cdFx0XHQuZmlsdGVyKGNoaWxkID0+IGNoaWxkLmhpZGUgIT09IHRydWUpXG5cdFx0XHQubWFwKGNoaWxkID0+IF9yZXNvbHZlU2V0dGluZ3NUcmVlKGNoaWxkLCBhbGxTZXR0aW5ncywgbG9nU2VydmljZSkpXG5cdFx0XHQuZmlsdGVyKGNoaWxkID0+IGNoaWxkLmNoaWxkcmVuPy5sZW5ndGggfHwgY2hpbGQuc2V0dGluZ3M/Lmxlbmd0aCk7XG5cdH1cblxuXHRsZXQgc2V0dGluZ3M6IElTZXR0aW5nW10gfCB1bmRlZmluZWQ7XG5cdGlmICh0b2NEYXRhLnNldHRpbmdzKSB7XG5cdFx0c2V0dGluZ3MgPSB0b2NEYXRhLnNldHRpbmdzLm1hcChwYXR0ZXJuID0+IGdldE1hdGNoaW5nU2V0dGluZ3MoYWxsU2V0dGluZ3MsIHBhdHRlcm4sIGxvZ1NlcnZpY2UpKS5mbGF0KCk7XG5cdH1cblxuXHRpZiAoIWNoaWxkcmVuICYmICFzZXR0aW5ncykge1xuXHRcdHRocm93IG5ldyBFcnJvcihgVE9DIG5vZGUgaGFzIG5vIGNoaWxkIGdyb3VwcyBvciBzZXR0aW5nczogJHt0b2NEYXRhLmlkfWApO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRpZDogdG9jRGF0YS5pZCxcblx0XHRsYWJlbDogdG9jRGF0YS5sYWJlbCxcblx0XHRjaGlsZHJlbixcblx0XHRzZXR0aW5nc1xuXHR9O1xufVxuXG5jb25zdCBrbm93bkR5bmFtaWNTZXR0aW5nR3JvdXBzID0gW1xuXHQvXnNldHRpbmdzU3luY1xcLi4qLyxcblx0L15zeW5jXFwuLiovLFxuXHQvXndvcmtiZW5jaC5mb250QWxpYXNpbmckLyxcbl07XG5cbmZ1bmN0aW9uIGdldE1hdGNoaW5nU2V0dGluZ3MoYWxsU2V0dGluZ3M6IFNldDxJU2V0dGluZz4sIHBhdHRlcm46IHN0cmluZywgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpOiBJU2V0dGluZ1tdIHtcblx0Y29uc3QgcmVzdWx0OiBJU2V0dGluZ1tdID0gW107XG5cblx0YWxsU2V0dGluZ3MuZm9yRWFjaChzID0+IHtcblx0XHRpZiAoc2V0dGluZ01hdGNoZXMocywgcGF0dGVybikpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHMpO1xuXHRcdFx0YWxsU2V0dGluZ3MuZGVsZXRlKHMpO1xuXHRcdH1cblx0fSk7XG5cblx0aWYgKCFyZXN1bHQubGVuZ3RoICYmICFrbm93bkR5bmFtaWNTZXR0aW5nR3JvdXBzLnNvbWUociA9PiByLnRlc3QocGF0dGVybikpKSB7XG5cdFx0bG9nU2VydmljZS53YXJuKGBTZXR0aW5ncyBwYXR0ZXJuIFwiJHtwYXR0ZXJufVwiIGRvZXNuJ3QgbWF0Y2ggYW55IHNldHRpbmdzYCk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IGEua2V5LmxvY2FsZUNvbXBhcmUoYi5rZXkpKTtcbn1cblxuY29uc3Qgc2V0dGluZ1BhdHRlcm5DYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBSZWdFeHA+KCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXR0aW5nTWF0Y2hSZWdFeHAocGF0dGVybjogc3RyaW5nKTogUmVnRXhwIHtcblx0cGF0dGVybiA9IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMocGF0dGVybilcblx0XHQucmVwbGFjZSgvXFxcXFxcKi9nLCAnLionKTtcblxuXHRyZXR1cm4gbmV3IFJlZ0V4cChgXiR7cGF0dGVybn0kYCwgJ2knKTtcbn1cblxuZnVuY3Rpb24gc2V0dGluZ01hdGNoZXMoczogSVNldHRpbmcsIHBhdHRlcm46IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRsZXQgcmVnRXhwID0gc2V0dGluZ1BhdHRlcm5DYWNoZS5nZXQocGF0dGVybik7XG5cdGlmICghcmVnRXhwKSB7XG5cdFx0cmVnRXhwID0gY3JlYXRlU2V0dGluZ01hdGNoUmVnRXhwKHBhdHRlcm4pO1xuXHRcdHNldHRpbmdQYXR0ZXJuQ2FjaGUuc2V0KHBhdHRlcm4sIHJlZ0V4cCk7XG5cdH1cblxuXHRyZXR1cm4gcmVnRXhwLnRlc3Qocy5rZXkpO1xufVxuXG5mdW5jdGlvbiBnZXRGbGF0U2V0dGluZ3Moc2V0dGluZ3NHcm91cHM6IElTZXR0aW5nc0dyb3VwW10pIHtcblx0Y29uc3QgcmVzdWx0OiBTZXQ8SVNldHRpbmc+ID0gbmV3IFNldCgpO1xuXG5cdGZvciAoY29uc3QgZ3JvdXAgb2Ygc2V0dGluZ3NHcm91cHMpIHtcblx0XHRmb3IgKGNvbnN0IHNlY3Rpb24gb2YgZ3JvdXAuc2VjdGlvbnMpIHtcblx0XHRcdGZvciAoY29uc3QgcyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdGlmICghcy5vdmVycmlkZXMgfHwgIXMub3ZlcnJpZGVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJlc3VsdC5hZGQocyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5pbnRlcmZhY2UgSURpc3Bvc2FibGVUZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IHRvRGlzcG9zZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5pbnRlcmZhY2UgSVNldHRpbmdJdGVtVGVtcGxhdGU8VCA9IGFueT4gZXh0ZW5kcyBJRGlzcG9zYWJsZVRlbXBsYXRlIHtcblx0b25DaGFuZ2U/OiAodmFsdWU6IFQpID0+IHZvaWQ7XG5cblx0Y29udGV4dD86IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50O1xuXHRjb250YWluZXJFbGVtZW50OiBIVE1MRWxlbWVudDtcblx0Y2F0ZWdvcnlFbGVtZW50OiBIVE1MRWxlbWVudDtcblx0bGFiZWxFbGVtZW50OiBTaW1wbGVJY29uTGFiZWw7XG5cdGRlc2NyaXB0aW9uRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdGNvbnRyb2xFbGVtZW50OiBIVE1MRWxlbWVudDtcblx0ZGVwcmVjYXRpb25XYXJuaW5nRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdGluZGljYXRvcnNMYWJlbDogU2V0dGluZ3NUcmVlSW5kaWNhdG9yc0xhYmVsO1xuXHR0b29sYmFyOiBUb29sQmFyO1xuXHRyZWFkb25seSBlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuaW50ZXJmYWNlIElTZXR0aW5nQm9vbEl0ZW1UZW1wbGF0ZSBleHRlbmRzIElTZXR0aW5nSXRlbVRlbXBsYXRlPGJvb2xlYW4+IHtcblx0Y2hlY2tib3g6IFRvZ2dsZTtcbn1cblxuaW50ZXJmYWNlIElTZXR0aW5nRXh0ZW5zaW9uVG9nZ2xlSXRlbVRlbXBsYXRlIGV4dGVuZHMgSVNldHRpbmdJdGVtVGVtcGxhdGU8dW5kZWZpbmVkPiB7XG5cdGFjdGlvbkJ1dHRvbjogQnV0dG9uO1xuXHRkaXNtaXNzQnV0dG9uOiBCdXR0b247XG59XG5cbmludGVyZmFjZSBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGUgZXh0ZW5kcyBJU2V0dGluZ0l0ZW1UZW1wbGF0ZTxzdHJpbmc+IHtcblx0aW5wdXRCb3g6IElucHV0Qm94O1xuXHR2YWxpZGF0aW9uRXJyb3JNZXNzYWdlRWxlbWVudDogSFRNTEVsZW1lbnQ7XG59XG5cbnR5cGUgSVNldHRpbmdOdW1iZXJJdGVtVGVtcGxhdGUgPSBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGU7XG5cbmludGVyZmFjZSBJU2V0dGluZ0VudW1JdGVtVGVtcGxhdGUgZXh0ZW5kcyBJU2V0dGluZ0l0ZW1UZW1wbGF0ZTxudW1iZXI+IHtcblx0c2VsZWN0Qm94OiBTZWxlY3RCb3g7XG5cdHNlbGVjdEVsZW1lbnQ6IEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcblx0ZW51bURlc2NyaXB0aW9uRWxlbWVudDogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJU2V0dGluZ0NvbXBsZXhJdGVtVGVtcGxhdGUgZXh0ZW5kcyBJU2V0dGluZ0l0ZW1UZW1wbGF0ZTx2b2lkPiB7XG5cdGJ1dHRvbjogSFRNTEVsZW1lbnQ7XG5cdHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50OiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElTZXR0aW5nQ29tcGxleE9iamVjdEl0ZW1UZW1wbGF0ZSBleHRlbmRzIElTZXR0aW5nQ29tcGxleEl0ZW1UZW1wbGF0ZSB7XG5cdG9iamVjdFNldHRpbmdXaWRnZXQ6IE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldDtcbn1cblxuaW50ZXJmYWNlIElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSBleHRlbmRzIElTZXR0aW5nSXRlbVRlbXBsYXRlPHN0cmluZ1tdIHwgdW5kZWZpbmVkPiB7XG5cdGxpc3RXaWRnZXQ6IExpc3RTZXR0aW5nV2lkZ2V0PElMaXN0RGF0YUl0ZW0+O1xuXHR2YWxpZGF0aW9uRXJyb3JNZXNzYWdlRWxlbWVudDogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJU2V0dGluZ0luY2x1ZGVFeGNsdWRlSXRlbVRlbXBsYXRlIGV4dGVuZHMgSVNldHRpbmdJdGVtVGVtcGxhdGU8dm9pZD4ge1xuXHRpbmNsdWRlRXhjbHVkZVdpZGdldDogTGlzdFNldHRpbmdXaWRnZXQ8SUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0+O1xufVxuXG5pbnRlcmZhY2UgSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGUgZXh0ZW5kcyBJU2V0dGluZ0l0ZW1UZW1wbGF0ZTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZD4ge1xuXHRvYmplY3REcm9wZG93bldpZGdldD86IE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldDtcblx0b2JqZWN0Q2hlY2tib3hXaWRnZXQ/OiBPYmplY3RTZXR0aW5nQ2hlY2tib3hXaWRnZXQ7XG5cdHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50OiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElTZXR0aW5nTmV3RXh0ZW5zaW9uc1RlbXBsYXRlIGV4dGVuZHMgSURpc3Bvc2FibGVUZW1wbGF0ZSB7XG5cdGJ1dHRvbjogQnV0dG9uO1xuXHRjb250ZXh0PzogU2V0dGluZ3NUcmVlTmV3RXh0ZW5zaW9uc0VsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJR3JvdXBUaXRsZVRlbXBsYXRlIGV4dGVuZHMgSURpc3Bvc2FibGVUZW1wbGF0ZSB7XG5cdGNvbnRleHQ/OiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQ7XG5cdHBhcmVudDogSFRNTEVsZW1lbnQ7XG59XG5cbmNvbnN0IFNFVFRJTkdTX1RFWFRfVEVNUExBVEVfSUQgPSAnc2V0dGluZ3MudGV4dC50ZW1wbGF0ZSc7XG5jb25zdCBTRVRUSU5HU19NVUxUSUxJTkVfVEVYVF9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5tdWx0aWxpbmVUZXh0LnRlbXBsYXRlJztcbmNvbnN0IFNFVFRJTkdTX05VTUJFUl9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5udW1iZXIudGVtcGxhdGUnO1xuY29uc3QgU0VUVElOR1NfRU5VTV9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5lbnVtLnRlbXBsYXRlJztcbmNvbnN0IFNFVFRJTkdTX0JPT0xfVEVNUExBVEVfSUQgPSAnc2V0dGluZ3MuYm9vbC50ZW1wbGF0ZSc7XG5jb25zdCBTRVRUSU5HU19BUlJBWV9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5hcnJheS50ZW1wbGF0ZSc7XG5jb25zdCBTRVRUSU5HU19FWENMVURFX1RFTVBMQVRFX0lEID0gJ3NldHRpbmdzLmV4Y2x1ZGUudGVtcGxhdGUnO1xuY29uc3QgU0VUVElOR1NfSU5DTFVERV9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5pbmNsdWRlLnRlbXBsYXRlJztcbmNvbnN0IFNFVFRJTkdTX09CSkVDVF9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5vYmplY3QudGVtcGxhdGUnO1xuY29uc3QgU0VUVElOR1NfQk9PTF9PQkpFQ1RfVEVNUExBVEVfSUQgPSAnc2V0dGluZ3MuYm9vbE9iamVjdC50ZW1wbGF0ZSc7XG5jb25zdCBTRVRUSU5HU19DT01QTEVYX1RFTVBMQVRFX0lEID0gJ3NldHRpbmdzLmNvbXBsZXgudGVtcGxhdGUnO1xuY29uc3QgU0VUVElOR1NfQ09NUExFWF9PQkpFQ1RfVEVNUExBVEVfSUQgPSAnc2V0dGluZ3MuY29tcGxleE9iamVjdC50ZW1wbGF0ZSc7XG5jb25zdCBTRVRUSU5HU19ORVdfRVhURU5TSU9OU19URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5uZXdFeHRlbnNpb25zLnRlbXBsYXRlJztcbmNvbnN0IFNFVFRJTkdTX0VMRU1FTlRfVEVNUExBVEVfSUQgPSAnc2V0dGluZ3MuZ3JvdXAudGVtcGxhdGUnO1xuY29uc3QgU0VUVElOR1NfRVhURU5TSU9OX1RPR0dMRV9URU1QTEFURV9JRCA9ICdzZXR0aW5ncy5leHRlbnNpb25Ub2dnbGUudGVtcGxhdGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTZXR0aW5nQ2hhbmdlRXZlbnQge1xuXHRrZXk6IHN0cmluZztcblx0dmFsdWU6IGFueTsgLy8gdW5kZWZpbmVkID0+IHJlc2V0L3VuY29uZmlndXJlXG5cdHR5cGU6IFNldHRpbmdWYWx1ZVR5cGUgfCBTZXR0aW5nVmFsdWVUeXBlW107XG5cdG1hbnVhbFJlc2V0OiBib29sZWFuO1xuXHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXR0aW5nTGlua0NsaWNrRXZlbnQge1xuXHRzb3VyY2U6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50O1xuXHR0YXJnZXRLZXk6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGRyZW5Gcm9tVGFiT3JkZXIobm9kZTogRWxlbWVudCk6IHZvaWQge1xuXHRjb25zdCBmb2N1c2FibGVFbGVtZW50cyA9IG5vZGUucXVlcnlTZWxlY3RvckFsbChgXG5cdFx0W3RhYmluZGV4PVwiMFwiXSxcblx0XHRpbnB1dDpub3QoW3RhYmluZGV4PVwiLTFcIl0pLFxuXHRcdHNlbGVjdDpub3QoW3RhYmluZGV4PVwiLTFcIl0pLFxuXHRcdHRleHRhcmVhOm5vdChbdGFiaW5kZXg9XCItMVwiXSksXG5cdFx0YTpub3QoW3RhYmluZGV4PVwiLTFcIl0pLFxuXHRcdGJ1dHRvbjpub3QoW3RhYmluZGV4PVwiLTFcIl0pLFxuXHRcdGFyZWE6bm90KFt0YWJpbmRleD1cIi0xXCJdKVxuXHRgKTtcblxuXHRmb2N1c2FibGVFbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkVMRU1FTlRfRk9DVVNBQkxFX0FUVFIsICd0cnVlJyk7XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJy0xJyk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBhZGRDaGlsZHJlblRvVGFiT3JkZXIobm9kZTogRWxlbWVudCk6IHZvaWQge1xuXHRjb25zdCBmb2N1c2FibGVFbGVtZW50cyA9IG5vZGUucXVlcnlTZWxlY3RvckFsbChcblx0XHRgWyR7QWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuRUxFTUVOVF9GT0NVU0FCTEVfQVRUUn09XCJ0cnVlXCJdYFxuXHQpO1xuXG5cdGZvY3VzYWJsZUVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0ZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuRUxFTUVOVF9GT0NVU0FCTEVfQVRUUik7XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVpZ2h0Q2hhbmdlUGFyYW1zIHtcblx0ZWxlbWVudDogU2V0dGluZ3NUcmVlRWxlbWVudDtcblx0aGVpZ2h0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFNldHRpbmdSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZUVsZW1lbnQsIG5ldmVyLCBhbnk+IHtcblx0LyoqIFRvIG92ZXJyaWRlICovXG5cdGFic3RyYWN0IGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZztcblxuXHRzdGF0aWMgcmVhZG9ubHkgQ09OVFJPTF9DTEFTUyA9ICdzZXR0aW5nLWNvbnRyb2wtZm9jdXMtdGFyZ2V0Jztcblx0c3RhdGljIHJlYWRvbmx5IENPTlRST0xfU0VMRUNUT1IgPSAnLicgKyB0aGlzLkNPTlRST0xfQ0xBU1M7XG5cdHN0YXRpYyByZWFkb25seSBDT05URU5UU19DTEFTUyA9ICdzZXR0aW5nLWl0ZW0tY29udGVudHMnO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ09OVEVOVFNfU0VMRUNUT1IgPSAnLicgKyB0aGlzLkNPTlRFTlRTX0NMQVNTO1xuXHRzdGF0aWMgcmVhZG9ubHkgQUxMX1JPV1NfU0VMRUNUT1IgPSAnLm1vbmFjby1saXN0LXJvdyc7XG5cblx0c3RhdGljIHJlYWRvbmx5IFNFVFRJTkdfS0VZX0FUVFIgPSAnZGF0YS1rZXknO1xuXHRzdGF0aWMgcmVhZG9ubHkgU0VUVElOR19JRF9BVFRSID0gJ2RhdGEtaWQnO1xuXHRzdGF0aWMgcmVhZG9ubHkgRUxFTUVOVF9GT0NVU0FCTEVfQVRUUiA9ICdkYXRhLWZvY3VzYWJsZSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGlja092ZXJyaWRlRWxlbWVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTZXR0aW5nT3ZlcnJpZGVDbGlja0V2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDbGlja092ZXJyaWRlRWxlbWVudDogRXZlbnQ8SVNldHRpbmdPdmVycmlkZUNsaWNrRXZlbnQ+ID0gdGhpcy5fb25EaWRDbGlja092ZXJyaWRlRWxlbWVudC5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2V0dGluZyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTZXR0aW5nQ2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVNldHRpbmc6IEV2ZW50PElTZXR0aW5nQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VTZXR0aW5nLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRPcGVuU2V0dGluZ3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRpZE9wZW5TZXR0aW5nczogRXZlbnQ8c3RyaW5nPiA9IHRoaXMuX29uRGlkT3BlblNldHRpbmdzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2xpY2tTZXR0aW5nTGluayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTZXR0aW5nTGlua0NsaWNrRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsaWNrU2V0dGluZ0xpbms6IEV2ZW50PElTZXR0aW5nTGlua0NsaWNrRXZlbnQ+ID0gdGhpcy5fb25EaWRDbGlja1NldHRpbmdMaW5rLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRGb2N1c1NldHRpbmcgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXNTZXR0aW5nOiBFdmVudDxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudD4gPSB0aGlzLl9vbkRpZEZvY3VzU2V0dGluZy5ldmVudDtcblxuXHRwcml2YXRlIGlnbm9yZWRTZXR0aW5nczogc3RyaW5nW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSWdub3JlZFNldHRpbmdzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlSWdub3JlZFNldHRpbmdzOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlSWdub3JlZFNldHRpbmdzLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VTZXR0aW5nSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SGVpZ2h0Q2hhbmdlUGFyYW1zPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZXR0aW5nSGVpZ2h0OiBFdmVudDxIZWlnaHRDaGFuZ2VQYXJhbXM+ID0gdGhpcy5fb25EaWRDaGFuZ2VTZXR0aW5nSGVpZ2h0LmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25BcHBseUZpbHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uQXBwbHlGaWx0ZXI6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkFwcGx5RmlsdGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNldHRpbmdBY3Rpb25zOiBJQWN0aW9uW10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlQWN0aW9uRmFjdG9yeTogKHNldHRpbmc6IElTZXR0aW5nLCBzZXR0aW5nVGFyZ2V0OiBTZXR0aW5nc1RhcmdldCkgPT4gSUFjdGlvbltdLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX29wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfZXh0ZW5zaW9uc1NlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9leHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5tYXJrZG93blJlbmRlcmVyID0gX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtkb3duUmVuZGVyZXIsIHt9KTtcblxuXHRcdHRoaXMuaWdub3JlZFNldHRpbmdzID0gZ2V0SWdub3JlZFNldHRpbmdzKGdldERlZmF1bHRJZ25vcmVkU2V0dGluZ3MoKSwgdGhpcy5fY29uZmlnU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlnU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHR0aGlzLmlnbm9yZWRTZXR0aW5ncyA9IGdldElnbm9yZWRTZXR0aW5ncyhnZXREZWZhdWx0SWdub3JlZFNldHRpbmdzKCksIHRoaXMuX2NvbmZpZ1NlcnZpY2UpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJZ25vcmVkU2V0dGluZ3MuZmlyZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGFic3RyYWN0IHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBhbnk7XG5cblx0YWJzdHJhY3QgcmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBhbnkpOiB2b2lkO1xuXG5cdHByb3RlY3RlZCByZW5kZXJDb21tb25UZW1wbGF0ZSh0cmVlOiBhbnksIF9jb250YWluZXI6IEhUTUxFbGVtZW50LCB0eXBlQ2xhc3M6IHN0cmluZyk6IElTZXR0aW5nSXRlbVRlbXBsYXRlIHtcblx0XHRfY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctaXRlbScpO1xuXHRcdF9jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy1pdGVtLScgKyB0eXBlQ2xhc3MpO1xuXG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyID0gRE9NLmFwcGVuZChfY29udGFpbmVyLCAkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRFTlRTX1NFTEVDVE9SKSk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3NldHRpbmdzLXJvdy1pbm5lci1jb250YWluZXInKTtcblx0XHRjb25zdCB0aXRsZUVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctaXRlbS10aXRsZScpKTtcblx0XHRjb25zdCBsYWJlbENhdGVnb3J5Q29udGFpbmVyID0gRE9NLmFwcGVuZCh0aXRsZUVsZW1lbnQsICQoJy5zZXR0aW5nLWl0ZW0tY2F0LWxhYmVsLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBjYXRlZ29yeUVsZW1lbnQgPSBET00uYXBwZW5kKGxhYmVsQ2F0ZWdvcnlDb250YWluZXIsICQoJ3NwYW4uc2V0dGluZy1pdGVtLWNhdGVnb3J5JykpO1xuXHRcdGNvbnN0IGxhYmVsRWxlbWVudENvbnRhaW5lciA9IERPTS5hcHBlbmQobGFiZWxDYXRlZ29yeUNvbnRhaW5lciwgJCgnc3Bhbi5zZXR0aW5nLWl0ZW0tbGFiZWwnKSk7XG5cdFx0Y29uc3QgbGFiZWxFbGVtZW50ID0gdG9EaXNwb3NlLmFkZChuZXcgU2ltcGxlSWNvbkxhYmVsKGxhYmVsRWxlbWVudENvbnRhaW5lcikpO1xuXHRcdGNvbnN0IGluZGljYXRvcnNMYWJlbCA9IHRvRGlzcG9zZS5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NUcmVlSW5kaWNhdG9yc0xhYmVsLCB0aXRsZUVsZW1lbnQpKTtcblxuXHRcdGNvbnN0IGRlc2NyaXB0aW9uRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJykpO1xuXHRcdGNvbnN0IG1vZGlmaWVkSW5kaWNhdG9yRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc2V0dGluZy1pdGVtLW1vZGlmaWVkLWluZGljYXRvcicpKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKHRoaXMuX2hvdmVyU2VydmljZS5zZXR1cERlbGF5ZWRIb3Zlcihtb2RpZmllZEluZGljYXRvckVsZW1lbnQsIHtcblx0XHRcdGNvbnRlbnQ6IGxvY2FsaXplKCdtb2RpZmllZCcsIFwiVGhlIHNldHRpbmcgaGFzIGJlZW4gY29uZmlndXJlZCBpbiB0aGUgY3VycmVudCBzY29wZS5cIilcblx0XHR9KSk7XG5cblx0XHRjb25zdCB2YWx1ZUVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctaXRlbS12YWx1ZScpKTtcblx0XHRjb25zdCBjb250cm9sRWxlbWVudCA9IERPTS5hcHBlbmQodmFsdWVFbGVtZW50LCAkKCdkaXYuc2V0dGluZy1pdGVtLWNvbnRyb2wnKSk7XG5cblx0XHRjb25zdCBkZXByZWNhdGlvbldhcm5pbmdFbGVtZW50ID0gRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5zZXR0aW5nLWl0ZW0tZGVwcmVjYXRpb24tbWVzc2FnZScpKTtcblxuXHRcdGNvbnN0IHRvb2xiYXJDb250YWluZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctdG9vbGJhci1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgdG9vbGJhciA9IHRoaXMucmVuZGVyU2V0dGluZ1Rvb2xiYXIodG9vbGJhckNvbnRhaW5lcik7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZTogSVNldHRpbmdJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHR0b0Rpc3Bvc2UsXG5cdFx0XHRlbGVtZW50RGlzcG9zYWJsZXM6IHRvRGlzcG9zZS5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSxcblxuXHRcdFx0Y29udGFpbmVyRWxlbWVudDogY29udGFpbmVyLFxuXHRcdFx0Y2F0ZWdvcnlFbGVtZW50LFxuXHRcdFx0bGFiZWxFbGVtZW50LFxuXHRcdFx0ZGVzY3JpcHRpb25FbGVtZW50LFxuXHRcdFx0Y29udHJvbEVsZW1lbnQsXG5cdFx0XHRkZXByZWNhdGlvbldhcm5pbmdFbGVtZW50LFxuXHRcdFx0aW5kaWNhdG9yc0xhYmVsLFxuXHRcdFx0dG9vbGJhclxuXHRcdH07XG5cblx0XHQvLyBQcmV2ZW50IGNsaWNrcyBmcm9tIGJlaW5nIGhhbmRsZWQgYnkgbGlzdFxuXHRcdHRvRGlzcG9zZS5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb250cm9sRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCBlID0+IGUuc3RvcFByb3BhZ2F0aW9uKCkpKTtcblxuXHRcdHRvRGlzcG9zZS5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aXRsZUVsZW1lbnQsIERPTS5FdmVudFR5cGUuTU9VU0VfRU5URVIsIGUgPT4gY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vdXNlb3ZlcicpKSk7XG5cdFx0dG9EaXNwb3NlLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRpdGxlRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgZSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnbW91c2VvdmVyJykpKTtcblxuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBhZGRTZXR0aW5nRWxlbWVudEZvY3VzSGFuZGxlcih0ZW1wbGF0ZTogSVNldHRpbmdJdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1c1RyYWNrZXIgPSBET00udHJhY2tGb2N1cyh0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50KTtcblx0XHR0ZW1wbGF0ZS50b0Rpc3Bvc2UuYWRkKGZvY3VzVHJhY2tlcik7XG5cdFx0dGVtcGxhdGUudG9EaXNwb3NlLmFkZChmb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHtcblx0XHRcdGlmICh0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9jdXNlZCcpKSB7XG5cdFx0XHRcdHRlbXBsYXRlLmNvbnRhaW5lckVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZm9jdXNlZCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRlbXBsYXRlLnRvRGlzcG9zZS5hZGQoZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdmb2N1c2VkJyk7XG5cblx0XHRcdGlmICh0ZW1wbGF0ZS5jb250ZXh0KSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkRm9jdXNTZXR0aW5nLmZpcmUodGVtcGxhdGUuY29udGV4dCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclNldHRpbmdUb29sYmFyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBUb29sQmFyIHtcblx0XHRjb25zdCB0b2dnbGVNZW51S2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfU0hPV19DT05URVhUX01FTlUpO1xuXHRcdGxldCB0b2dnbGVNZW51VGl0bGUgPSBsb2NhbGl6ZSgnc2V0dGluZ3NDb250ZXh0TWVudVRpdGxlJywgXCJNb3JlIEFjdGlvbnMuLi4gXCIpO1xuXHRcdGlmICh0b2dnbGVNZW51S2V5YmluZGluZykge1xuXHRcdFx0dG9nZ2xlTWVudVRpdGxlICs9IGAgKCR7dG9nZ2xlTWVudUtleWJpbmRpbmcgJiYgdG9nZ2xlTWVudUtleWJpbmRpbmcuZ2V0TGFiZWwoKX0pYDtcblx0XHR9XG5cblx0XHRjb25zdCB0b29sYmFyID0gbmV3IFRvb2xCYXIoY29udGFpbmVyLCB0aGlzLl9jb250ZXh0TWVudVNlcnZpY2UsIHtcblx0XHRcdHRvZ2dsZU1lbnVUaXRsZSxcblx0XHRcdHJlbmRlckRyb3Bkb3duQXNDaGlsZEVsZW1lbnQ6ICFpc0lPUyxcblx0XHRcdG1vcmVJY29uOiBzZXR0aW5nc01vcmVBY3Rpb25JY29uXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRvb2xiYXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyU2V0dGluZ0VsZW1lbnQobm9kZTogSVRyZWVOb2RlPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlcj4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBJU2V0dGluZ0l0ZW1UZW1wbGF0ZSB8IElTZXR0aW5nQm9vbEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBub2RlLmVsZW1lbnQ7XG5cblx0XHQvLyBUaGUgZWxlbWVudCBtdXN0IGluc3BlY3QgaXRzZWxmIHRvIGdldCBpbmZvcm1hdGlvbiBmb3Jcblx0XHQvLyB0aGUgbW9kaWZpZWQgaW5kaWNhdG9yIGFuZCB0aGUgb3ZlcnJpZGRlbiBTZXR0aW5ncyBpbmRpY2F0b3JzLlxuXHRcdGVsZW1lbnQuaW5zcGVjdFNlbGYoKTtcblxuXHRcdHRlbXBsYXRlLmNvbnRleHQgPSBlbGVtZW50O1xuXHRcdHRlbXBsYXRlLnRvb2xiYXIuY29udGV4dCA9IGVsZW1lbnQ7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IHRoaXMuZGlzcG9zYWJsZUFjdGlvbkZhY3RvcnkoZWxlbWVudC5zZXR0aW5nLCBlbGVtZW50LnNldHRpbmdzVGFyZ2V0KTtcblx0XHRhY3Rpb25zLmZvckVhY2goYSA9PiBpc0Rpc3Bvc2FibGUoYSkgJiYgdGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZChhKSk7XG5cdFx0dGVtcGxhdGUudG9vbGJhci5zZXRBY3Rpb25zKFtdLCBbLi4udGhpcy5zZXR0aW5nQWN0aW9ucywgLi4uYWN0aW9uc10pO1xuXG5cdFx0Y29uc3Qgc2V0dGluZyA9IGVsZW1lbnQuc2V0dGluZztcblxuXHRcdHRlbXBsYXRlLmNvbnRhaW5lckVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtY29uZmlndXJlZCcsIGVsZW1lbnQuaXNDb25maWd1cmVkKTtcblx0XHR0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LnNldEF0dHJpYnV0ZShBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5TRVRUSU5HX0tFWV9BVFRSLCBlbGVtZW50LnNldHRpbmcua2V5KTtcblx0XHR0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LnNldEF0dHJpYnV0ZShBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5TRVRUSU5HX0lEX0FUVFIsIGVsZW1lbnQuaWQpO1xuXG5cdFx0Y29uc3QgdGl0bGVUb29sdGlwID0gc2V0dGluZy5rZXkgKyAoZWxlbWVudC5pc0NvbmZpZ3VyZWQgPyAnIC0gTW9kaWZpZWQnIDogJycpO1xuXHRcdHRlbXBsYXRlLmNhdGVnb3J5RWxlbWVudC50ZXh0Q29udGVudCA9IGVsZW1lbnQuZGlzcGxheUNhdGVnb3J5ID8gKGVsZW1lbnQuZGlzcGxheUNhdGVnb3J5ICsgJzogJykgOiAnJztcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuX2hvdmVyU2VydmljZS5zZXR1cERlbGF5ZWRIb3Zlcih0ZW1wbGF0ZS5jYXRlZ29yeUVsZW1lbnQsIHsgY29udGVudDogdGl0bGVUb29sdGlwIH0pKTtcblxuXHRcdHRlbXBsYXRlLmxhYmVsRWxlbWVudC50ZXh0ID0gZWxlbWVudC5kaXNwbGF5TGFiZWw7XG5cdFx0dGVtcGxhdGUubGFiZWxFbGVtZW50LnRpdGxlID0gdGl0bGVUb29sdGlwO1xuXG5cdFx0dGVtcGxhdGUuZGVzY3JpcHRpb25FbGVtZW50LmlubmVyVGV4dCA9ICcnO1xuXHRcdGlmIChlbGVtZW50LnNldHRpbmcuZGVzY3JpcHRpb25Jc01hcmtkb3duKSB7XG5cdFx0XHRjb25zdCByZW5kZXJlZERlc2NyaXB0aW9uID0gdGhpcy5yZW5kZXJTZXR0aW5nTWFya2Rvd24oZWxlbWVudCwgdGVtcGxhdGUuY29udGFpbmVyRWxlbWVudCwgZWxlbWVudC5kZXNjcmlwdGlvbiwgdGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzKTtcblx0XHRcdHRlbXBsYXRlLmRlc2NyaXB0aW9uRWxlbWVudC5hcHBlbmRDaGlsZChyZW5kZXJlZERlc2NyaXB0aW9uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGUuZGVzY3JpcHRpb25FbGVtZW50LmlubmVyVGV4dCA9IGVsZW1lbnQuZGVzY3JpcHRpb247XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUuaW5kaWNhdG9yc0xhYmVsLnVwZGF0ZVNjb3BlT3ZlcnJpZGVzKGVsZW1lbnQsIHRoaXMuX29uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQsIHRoaXMuX29uQXBwbHlGaWx0ZXIpO1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5fY29uZmlnU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihBUFBMWV9BTExfUFJPRklMRVNfU0VUVElORykpIHtcblx0XHRcdFx0dGVtcGxhdGUuaW5kaWNhdG9yc0xhYmVsLnVwZGF0ZVNjb3BlT3ZlcnJpZGVzKGVsZW1lbnQsIHRoaXMuX29uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQsIHRoaXMuX29uQXBwbHlGaWx0ZXIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG9uQ2hhbmdlID0gKHZhbHVlOiBhbnkpID0+IHRoaXMuX29uRGlkQ2hhbmdlU2V0dGluZy5maXJlKHtcblx0XHRcdGtleTogZWxlbWVudC5zZXR0aW5nLmtleSxcblx0XHRcdHZhbHVlLFxuXHRcdFx0dHlwZTogdGVtcGxhdGUuY29udGV4dCEudmFsdWVUeXBlLFxuXHRcdFx0bWFudWFsUmVzZXQ6IGZhbHNlLFxuXHRcdFx0c2NvcGU6IGVsZW1lbnQuc2V0dGluZy5zY29wZVxuXHRcdH0pO1xuXHRcdGNvbnN0IGRlcHJlY2F0aW9uVGV4dCA9IGVsZW1lbnQuc2V0dGluZy5kZXByZWNhdGlvbk1lc3NhZ2UgfHwgJyc7XG5cdFx0aWYgKGRlcHJlY2F0aW9uVGV4dCAmJiBlbGVtZW50LnNldHRpbmcuZGVwcmVjYXRpb25NZXNzYWdlSXNNYXJrZG93bikge1xuXHRcdFx0dGVtcGxhdGUuZGVwcmVjYXRpb25XYXJuaW5nRWxlbWVudC5pbm5lclRleHQgPSAnJztcblx0XHRcdHRlbXBsYXRlLmRlcHJlY2F0aW9uV2FybmluZ0VsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5yZW5kZXJTZXR0aW5nTWFya2Rvd24oZWxlbWVudCwgdGVtcGxhdGUuY29udGFpbmVyRWxlbWVudCwgZWxlbWVudC5zZXR0aW5nLmRlcHJlY2F0aW9uTWVzc2FnZSEsIHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZS5kZXByZWNhdGlvbldhcm5pbmdFbGVtZW50LmlubmVyVGV4dCA9IGRlcHJlY2F0aW9uVGV4dDtcblx0XHR9XG5cdFx0dGVtcGxhdGUuZGVwcmVjYXRpb25XYXJuaW5nRWxlbWVudC5wcmVwZW5kKCQoJy5jb2RpY29uLmNvZGljb24tZXJyb3InKSk7XG5cdFx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdpcy1kZXByZWNhdGVkJywgISFkZXByZWNhdGlvblRleHQpO1xuXG5cdFx0dGhpcy5yZW5kZXJWYWx1ZShlbGVtZW50LCA8SVNldHRpbmdJdGVtVGVtcGxhdGU+dGVtcGxhdGUsIG9uQ2hhbmdlKTtcblxuXHRcdHRlbXBsYXRlLmluZGljYXRvcnNMYWJlbC51cGRhdGVXb3Jrc3BhY2VUcnVzdChlbGVtZW50KTtcblx0XHR0ZW1wbGF0ZS5pbmRpY2F0b3JzTGFiZWwudXBkYXRlU3luY0lnbm9yZWQoZWxlbWVudCwgdGhpcy5pZ25vcmVkU2V0dGluZ3MpO1xuXHRcdHRlbXBsYXRlLmluZGljYXRvcnNMYWJlbC51cGRhdGVEZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3IoZWxlbWVudCk7XG5cdFx0dGVtcGxhdGUuaW5kaWNhdG9yc0xhYmVsLnVwZGF0ZVByZXZpZXdJbmRpY2F0b3IoZWxlbWVudCk7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLm9uRGlkQ2hhbmdlSWdub3JlZFNldHRpbmdzKCgpID0+IHtcblx0XHRcdHRlbXBsYXRlLmluZGljYXRvcnNMYWJlbC51cGRhdGVTeW5jSWdub3JlZChlbGVtZW50LCB0aGlzLmlnbm9yZWRTZXR0aW5ncyk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51cGRhdGVTZXR0aW5nVGFiYmFibGUoZWxlbWVudCwgdGVtcGxhdGUpO1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoZWxlbWVudC5vbkRpZENoYW5nZVRhYmJhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlU2V0dGluZ1RhYmJhYmxlKGVsZW1lbnQsIHRlbXBsYXRlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNldHRpbmdUYWJiYWJsZShlbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nSXRlbVRlbXBsYXRlIHwgSVNldHRpbmdCb29sSXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0aWYgKGVsZW1lbnQudGFiYmFibGUpIHtcblx0XHRcdGFkZENoaWxkcmVuVG9UYWJPcmRlcih0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVtb3ZlQ2hpbGRyZW5Gcm9tVGFiT3JkZXIodGVtcGxhdGUuY29udGFpbmVyRWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTZXR0aW5nTWFya2Rvd24oZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRleHQ6IHN0cmluZywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblx0XHQvLyBSZXdyaXRlIGAjZWRpdG9yLmZvbnRTaXplI2AgdG8gbGluayBmb3JtYXRcblx0XHR0ZXh0ID0gZml4U2V0dGluZ0xpbmtzKHRleHQpO1xuXG5cdFx0Y29uc3QgcmVuZGVyZWRNYXJrZG93biA9IHRoaXMubWFya2Rvd25SZW5kZXJlci5yZW5kZXIoeyB2YWx1ZTogdGV4dCwgaXNUcnVzdGVkOiB0cnVlIH0sIHtcblx0XHRcdGFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0Y2FsbGJhY2s6IChjb250ZW50OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRpZiAoY29udGVudC5zdGFydHNXaXRoKCcjJykpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGU6IElTZXR0aW5nTGlua0NsaWNrRXZlbnQgPSB7XG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogZWxlbWVudCxcblx0XHRcdFx0XHRcdFx0dGFyZ2V0S2V5OiBjb250ZW50LnN1YnN0cmluZygxKVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2xpY2tTZXR0aW5nTGluay5maXJlKGUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oY29udGVudCwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRpc3Bvc2FibGVzXG5cdFx0XHR9LFxuXHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBoZWlnaHQgPSBjb250YWluZXIuY2xpZW50SGVpZ2h0O1xuXHRcdFx0XHRpZiAoaGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXR0aW5nSGVpZ2h0LmZpcmUoeyBlbGVtZW50LCBoZWlnaHQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlbmRlcmVkTWFya2Rvd24pO1xuXG5cdFx0cmVuZGVyZWRNYXJrZG93bi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctaXRlbS1tYXJrZG93bicpO1xuXHRcdGNsZWFuUmVuZGVyZWRNYXJrZG93bihyZW5kZXJlZE1hcmtkb3duLmVsZW1lbnQpO1xuXHRcdHJldHVybiByZW5kZXJlZE1hcmtkb3duLmVsZW1lbnQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcmVuZGVyVmFsdWUoZGF0YUVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCB0ZW1wbGF0ZTogSVNldHRpbmdJdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IGFueSkgPT4gdm9pZCk6IHZvaWQ7XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlOiBJRGlzcG9zYWJsZVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUudG9EaXNwb3NlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KF9lbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlRWxlbWVudD4sIF9pbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogSURpc3Bvc2FibGVUZW1wbGF0ZSwgX2hlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0KHRlbXBsYXRlIGFzIElTZXR0aW5nSXRlbVRlbXBsYXRlKS5lbGVtZW50RGlzcG9zYWJsZXM/LmNsZWFyKCk7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ0dyb3VwUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCwgbmV2ZXIsIElHcm91cFRpdGxlVGVtcGxhdGU+IHtcblx0dGVtcGxhdGVJZCA9IFNFVFRJTkdTX0VMRU1FTlRfVEVNUExBVEVfSUQ7XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElHcm91cFRpdGxlVGVtcGxhdGUge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdncm91cC10aXRsZScpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElHcm91cFRpdGxlVGVtcGxhdGUgPSB7XG5cdFx0XHRwYXJlbnQ6IGNvbnRhaW5lcixcblx0XHRcdHRvRGlzcG9zZTogbmV3IERpc3Bvc2FibGVTdG9yZSgpXG5cdFx0fTtcblxuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCwgbmV2ZXI+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElHcm91cFRpdGxlVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEucGFyZW50LmlubmVyVGV4dCA9ICcnO1xuXHRcdGNvbnN0IGxhYmVsRWxlbWVudCA9IERPTS5hcHBlbmQodGVtcGxhdGVEYXRhLnBhcmVudCwgJCgnZGl2LnNldHRpbmdzLWdyb3VwLXRpdGxlLWxhYmVsLnNldHRpbmdzLXJvdy1pbm5lci1jb250YWluZXInKSk7XG5cdFx0bGFiZWxFbGVtZW50LmNsYXNzTGlzdC5hZGQoYHNldHRpbmdzLWdyb3VwLWxldmVsLSR7ZWxlbWVudC5lbGVtZW50LmxldmVsfWApO1xuXHRcdGxhYmVsRWxlbWVudC50ZXh0Q29udGVudCA9IGVsZW1lbnQuZWxlbWVudC5sYWJlbDtcblxuXHRcdGlmIChlbGVtZW50LmVsZW1lbnQuaXNGaXJzdEdyb3VwKSB7XG5cdFx0XHRsYWJlbEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2V0dGluZ3MtZ3JvdXAtZmlyc3QnKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJR3JvdXBUaXRsZVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdOZXdFeHRlbnNpb25zUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZU5ld0V4dGVuc2lvbnNFbGVtZW50LCBuZXZlciwgSVNldHRpbmdOZXdFeHRlbnNpb25zVGVtcGxhdGU+IHtcblx0dGVtcGxhdGVJZCA9IFNFVFRJTkdTX05FV19FWFRFTlNJT05TX1RFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdOZXdFeHRlbnNpb25zVGVtcGxhdGUge1xuXHRcdGNvbnN0IHRvRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWl0ZW0tbmV3LWV4dGVuc2lvbnMnKTtcblxuXHRcdGNvbnN0IGJ1dHRvbiA9IG5ldyBCdXR0b24oY29udGFpbmVyLCB7IHRpdGxlOiB0cnVlLCAuLi5kZWZhdWx0QnV0dG9uU3R5bGVzIH0pO1xuXHRcdHRvRGlzcG9zZS5hZGQoYnV0dG9uKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKGJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHtcblx0XHRcdGlmICh0ZW1wbGF0ZS5jb250ZXh0KSB7XG5cdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd0V4dGVuc2lvbnNXaXRoSWRzJywgdGVtcGxhdGUuY29udGV4dC5leHRlbnNpb25JZHMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRidXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgnbmV3RXh0ZW5zaW9uc0J1dHRvbkxhYmVsJywgXCJTaG93IG1hdGNoaW5nIGV4dGVuc2lvbnNcIik7XG5cdFx0YnV0dG9uLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2V0dGluZ3MtbmV3LWV4dGVuc2lvbnMtYnV0dG9uJyk7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZTogSVNldHRpbmdOZXdFeHRlbnNpb25zVGVtcGxhdGUgPSB7XG5cdFx0XHRidXR0b24sXG5cdFx0XHR0b0Rpc3Bvc2Vcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlTmV3RXh0ZW5zaW9uc0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ05ld0V4dGVuc2lvbnNUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5jb250ZXh0ID0gZWxlbWVudC5lbGVtZW50O1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlOiBJRGlzcG9zYWJsZVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUudG9EaXNwb3NlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ0NvbXBsZXhSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nQ29tcGxleEl0ZW1UZW1wbGF0ZT4ge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFRElUX0lOX0pTT05fTEFCRUwgPSBsb2NhbGl6ZSgnZWRpdEluU2V0dGluZ3NKc29uJywgXCJFZGl0IGluIHNldHRpbmdzLmpzb25cIik7XG5cblx0dGVtcGxhdGVJZCA9IFNFVFRJTkdTX0NPTVBMRVhfVEVNUExBVEVfSUQ7XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXR0aW5nQ29tcGxleEl0ZW1UZW1wbGF0ZSB7XG5cdFx0Y29uc3QgY29tbW9uID0gdGhpcy5yZW5kZXJDb21tb25UZW1wbGF0ZShudWxsLCBjb250YWluZXIsICdjb21wbGV4Jyk7XG5cblx0XHRjb25zdCBvcGVuU2V0dGluZ3NCdXR0b24gPSBET00uYXBwZW5kKGNvbW1vbi5jb250cm9sRWxlbWVudCwgJCgnYS5lZGl0LWluLXNldHRpbmdzLWJ1dHRvbicpKTtcblx0XHRvcGVuU2V0dGluZ3NCdXR0b24uY2xhc3NMaXN0LmFkZChBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5DT05UUk9MX0NMQVNTKTtcblx0XHRvcGVuU2V0dGluZ3NCdXR0b24ucm9sZSA9ICdidXR0b24nO1xuXG5cdFx0Y29uc3QgdmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQgPSAkKCcuc2V0dGluZy1pdGVtLXZhbGlkYXRpb24tbWVzc2FnZScpO1xuXHRcdGNvbW1vbi5jb250YWluZXJFbGVtZW50LmFwcGVuZENoaWxkKHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50KTtcblxuXHRcdGNvbnN0IHRlbXBsYXRlOiBJU2V0dGluZ0NvbXBsZXhJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHQuLi5jb21tb24sXG5cdFx0XHRidXR0b246IG9wZW5TZXR0aW5nc0J1dHRvbixcblx0XHRcdHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50XG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ0NvbXBsZXhJdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJTZXR0aW5nRWxlbWVudChlbGVtZW50LCBpbmRleCwgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJWYWx1ZShkYXRhRWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIHRlbXBsYXRlOiBJU2V0dGluZ0NvbXBsZXhJdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHBsYWluS2V5ID0gZ2V0TGFuZ3VhZ2VUYWdTZXR0aW5nUGxhaW5LZXkoZGF0YUVsZW1lbnQuc2V0dGluZy5rZXkpO1xuXHRcdGNvbnN0IGVkaXRMYW5ndWFnZVNldHRpbmdMYWJlbCA9IGxvY2FsaXplKCdlZGl0TGFuZ3VhZ2VTZXR0aW5nTGFiZWwnLCBcIkVkaXQgc2V0dGluZ3MgZm9yIHswfVwiLCBwbGFpbktleSk7XG5cdFx0Y29uc3QgaXNMYW5ndWFnZVRhZ1NldHRpbmcgPSBkYXRhRWxlbWVudC5zZXR0aW5nLmlzTGFuZ3VhZ2VUYWdTZXR0aW5nO1xuXHRcdHRlbXBsYXRlLmJ1dHRvbi50ZXh0Q29udGVudCA9IGlzTGFuZ3VhZ2VUYWdTZXR0aW5nXG5cdFx0XHQ/IGVkaXRMYW5ndWFnZVNldHRpbmdMYWJlbFxuXHRcdFx0OiBTZXR0aW5nQ29tcGxleFJlbmRlcmVyLkVESVRfSU5fSlNPTl9MQUJFTDtcblxuXHRcdGNvbnN0IG9uQ2xpY2tPcktleWRvd24gPSAoZTogVUlFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGlzTGFuZ3VhZ2VUYWdTZXR0aW5nKSB7XG5cdFx0XHRcdHRoaXMuX29uQXBwbHlGaWx0ZXIuZmlyZShgQCR7TEFOR1VBR0VfU0VUVElOR19UQUd9JHtwbGFpbktleX1gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkT3BlblNldHRpbmdzLmZpcmUoZGF0YUVsZW1lbnQuc2V0dGluZy5rZXkpO1xuXHRcdFx0fVxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9O1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0ZW1wbGF0ZS5idXR0b24sIERPTS5FdmVudFR5cGUuQ0xJQ0ssIChlKSA9PiB7XG5cdFx0XHRvbkNsaWNrT3JLZXlkb3duKGUpO1xuXHRcdH0pKTtcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGVtcGxhdGUuYnV0dG9uLCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0Y29uc3QgZXYgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldi5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0b25DbGlja09yS2V5ZG93bihlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnJlbmRlclZhbGlkYXRpb25zKGRhdGFFbGVtZW50LCB0ZW1wbGF0ZSk7XG5cblx0XHRpZiAoaXNMYW5ndWFnZVRhZ1NldHRpbmcpIHtcblx0XHRcdHRlbXBsYXRlLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlZGl0TGFuZ3VhZ2VTZXR0aW5nTGFiZWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZS5idXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYCR7U2V0dGluZ0NvbXBsZXhSZW5kZXJlci5FRElUX0lOX0pTT05fTEFCRUx9OiAke2RhdGFFbGVtZW50LnNldHRpbmcua2V5fWApO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCB0ZW1wbGF0ZTogSVNldHRpbmdDb21wbGV4SXRlbVRlbXBsYXRlKSB7XG5cdFx0Y29uc3QgZXJyTXNnID0gZGF0YUVsZW1lbnQuaXNDb25maWd1cmVkICYmIGdldEludmFsaWRUeXBlRXJyb3IoZGF0YUVsZW1lbnQudmFsdWUsIGRhdGFFbGVtZW50LnNldHRpbmcudHlwZSk7XG5cdFx0aWYgKGVyck1zZykge1xuXHRcdFx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpbnZhbGlkLWlucHV0Jyk7XG5cdFx0XHR0ZW1wbGF0ZS52YWxpZGF0aW9uRXJyb3JNZXNzYWdlRWxlbWVudC5pbm5lclRleHQgPSBlcnJNc2c7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdpbnZhbGlkLWlucHV0Jyk7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ0NvbXBsZXhPYmplY3RSZW5kZXJlciBleHRlbmRzIFNldHRpbmdDb21wbGV4UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdDb21wbGV4T2JqZWN0SXRlbVRlbXBsYXRlPiB7XG5cblx0b3ZlcnJpZGUgdGVtcGxhdGVJZCA9IFNFVFRJTkdTX0NPTVBMRVhfT0JKRUNUX1RFTVBMQVRFX0lEO1xuXG5cdG92ZXJyaWRlIHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJU2V0dGluZ0NvbXBsZXhPYmplY3RJdGVtVGVtcGxhdGUge1xuXHRcdGNvbnN0IGNvbW1vbiA9IHRoaXMucmVuZGVyQ29tbW9uVGVtcGxhdGUobnVsbCwgY29udGFpbmVyLCAnbGlzdCcpO1xuXG5cdFx0Y29uc3Qgb2JqZWN0U2V0dGluZ1dpZGdldCA9IGNvbW1vbi50b0Rpc3Bvc2UuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldCwgY29tbW9uLmNvbnRyb2xFbGVtZW50KSk7XG5cdFx0b2JqZWN0U2V0dGluZ1dpZGdldC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuQ09OVFJPTF9DTEFTUyk7XG5cblx0XHRjb25zdCBvcGVuU2V0dGluZ3NCdXR0b24gPSBET00uYXBwZW5kKERPTS5hcHBlbmQoY29tbW9uLmNvbnRyb2xFbGVtZW50LCAkKCcuY29tcGxleC1vYmplY3QtZWRpdC1pbi1zZXR0aW5ncy1idXR0b24tY29udGFpbmVyJykpLCAkKCdhLmNvbXBsZXgtb2JqZWN0LmVkaXQtaW4tc2V0dGluZ3MtYnV0dG9uJykpO1xuXHRcdG9wZW5TZXR0aW5nc0J1dHRvbi5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdG9wZW5TZXR0aW5nc0J1dHRvbi5yb2xlID0gJ2J1dHRvbic7XG5cblx0XHRjb25zdCB2YWxpZGF0aW9uRXJyb3JNZXNzYWdlRWxlbWVudCA9ICQoJy5zZXR0aW5nLWl0ZW0tdmFsaWRhdGlvbi1tZXNzYWdlJyk7XG5cdFx0Y29tbW9uLmNvbnRhaW5lckVsZW1lbnQuYXBwZW5kQ2hpbGQodmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElTZXR0aW5nQ29tcGxleE9iamVjdEl0ZW1UZW1wbGF0ZSA9IHtcblx0XHRcdC4uLmNvbW1vbixcblx0XHRcdGJ1dHRvbjogb3BlblNldHRpbmdzQnV0dG9uLFxuXHRcdFx0dmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQsXG5cdFx0XHRvYmplY3RTZXR0aW5nV2lkZ2V0XG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nQ29tcGxleE9iamVjdEl0ZW1UZW1wbGF0ZSwgb25DaGFuZ2U6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlbXMgPSBnZXRPYmplY3REaXNwbGF5VmFsdWUoZGF0YUVsZW1lbnQpO1xuXHRcdHRlbXBsYXRlLm9iamVjdFNldHRpbmdXaWRnZXQuc2V0VmFsdWUoaXRlbXMsIHtcblx0XHRcdHNldHRpbmdLZXk6IGRhdGFFbGVtZW50LnNldHRpbmcua2V5LFxuXHRcdFx0c2hvd0FkZEJ1dHRvbjogZmFsc2UsXG5cdFx0XHRpc1JlYWRPbmx5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRlbXBsYXRlLmJ1dHRvbi5wYXJlbnRFbGVtZW50Py5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJywgZGF0YUVsZW1lbnQuaGFzUG9saWN5VmFsdWUpO1xuXHRcdHN1cGVyLnJlbmRlclZhbHVlKGRhdGFFbGVtZW50LCB0ZW1wbGF0ZSwgb25DaGFuZ2UpO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdBcnJheVJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdMaXN0SXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19BUlJBWV9URU1QTEFURV9JRDtcblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdMaXN0SXRlbVRlbXBsYXRlIHtcblx0XHRjb25zdCBjb21tb24gPSB0aGlzLnJlbmRlckNvbW1vblRlbXBsYXRlKG51bGwsIGNvbnRhaW5lciwgJ2xpc3QnKTtcblx0XHRjb25zdCBkZXNjcmlwdGlvbkVsZW1lbnQgPSBjb21tb24uY29udGFpbmVyRWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJykhO1xuXHRcdGNvbnN0IHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50ID0gJCgnLnNldHRpbmctaXRlbS12YWxpZGF0aW9uLW1lc3NhZ2UnKTtcblx0XHRkZXNjcmlwdGlvbkVsZW1lbnQuYWZ0ZXIodmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgbGlzdFdpZGdldCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExpc3RTZXR0aW5nV2lkZ2V0LCBjb21tb24uY29udHJvbEVsZW1lbnQpO1xuXHRcdGxpc3RXaWRnZXQuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdGNvbW1vbi50b0Rpc3Bvc2UuYWRkKGxpc3RXaWRnZXQpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSA9IHtcblx0XHRcdC4uLmNvbW1vbixcblx0XHRcdGxpc3RXaWRnZXQsXG5cdFx0XHR2YWxpZGF0aW9uRXJyb3JNZXNzYWdlRWxlbWVudFxuXHRcdH07XG5cblx0XHR0aGlzLmFkZFNldHRpbmdFbGVtZW50Rm9jdXNIYW5kbGVyKHRlbXBsYXRlKTtcblxuXHRcdGNvbW1vbi50b0Rpc3Bvc2UuYWRkKFxuXHRcdFx0bGlzdFdpZGdldC5vbkRpZENoYW5nZUxpc3QoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IG5ld0xpc3QgPSB0aGlzLmNvbXB1dGVOZXdMaXN0KHRlbXBsYXRlLCBlKTtcblx0XHRcdFx0dGVtcGxhdGUub25DaGFuZ2U/LihuZXdMaXN0KTtcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZU5ld0xpc3QodGVtcGxhdGU6IElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSwgZTogU2V0dGluZ0xpc3RFdmVudDxJTGlzdERhdGFJdGVtPik6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGVtcGxhdGUuY29udGV4dCkge1xuXHRcdFx0bGV0IG5ld1ZhbHVlOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodGVtcGxhdGUuY29udGV4dC5zY29wZVZhbHVlKSkge1xuXHRcdFx0XHRuZXdWYWx1ZSA9IFsuLi50ZW1wbGF0ZS5jb250ZXh0LnNjb3BlVmFsdWVdO1xuXHRcdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHRlbXBsYXRlLmNvbnRleHQudmFsdWUpKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0gWy4uLnRlbXBsYXRlLmNvbnRleHQudmFsdWVdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS50eXBlID09PSAnbW92ZScpIHtcblx0XHRcdFx0Ly8gQSBkcmFnIGFuZCBkcm9wIG9jY3VycmVkXG5cdFx0XHRcdGNvbnN0IHNvdXJjZUluZGV4ID0gZS5zb3VyY2VJbmRleDtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0SW5kZXggPSBlLnRhcmdldEluZGV4O1xuXHRcdFx0XHRjb25zdCBzcGxpY2VkRWxlbSA9IG5ld1ZhbHVlLnNwbGljZShzb3VyY2VJbmRleCwgMSlbMF07XG5cdFx0XHRcdG5ld1ZhbHVlLnNwbGljZSh0YXJnZXRJbmRleCwgMCwgc3BsaWNlZEVsZW0pO1xuXHRcdFx0fSBlbHNlIGlmIChlLnR5cGUgPT09ICdyZW1vdmUnIHx8IGUudHlwZSA9PT0gJ3Jlc2V0Jykge1xuXHRcdFx0XHRuZXdWYWx1ZS5zcGxpY2UoZS50YXJnZXRJbmRleCwgMSk7XG5cdFx0XHR9IGVsc2UgaWYgKGUudHlwZSA9PT0gJ2NoYW5nZScpIHtcblx0XHRcdFx0Y29uc3QgaXRlbVZhbHVlRGF0YSA9IGUubmV3SXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCk7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIHZhbHVlXG5cdFx0XHRcdGlmIChlLnRhcmdldEluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRuZXdWYWx1ZVtlLnRhcmdldEluZGV4XSA9IGl0ZW1WYWx1ZURhdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gRm9yIHNvbWUgcmVhc29uLCB3ZSBhcmUgdXBkYXRpbmcgYW5kIGNhbm5vdCBmaW5kIG9yaWdpbmFsIHZhbHVlXG5cdFx0XHRcdC8vIEp1c3QgYXBwZW5kIHRoZSB2YWx1ZSBpbiB0aGlzIGNhc2Vcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0bmV3VmFsdWUucHVzaChpdGVtVmFsdWVEYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChlLnR5cGUgPT09ICdhZGQnKSB7XG5cdFx0XHRcdG5ld1ZhbHVlLnB1c2goZS5uZXdJdGVtLnZhbHVlLmRhdGEudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0dGVtcGxhdGUuY29udGV4dC5kZWZhdWx0VmFsdWUgJiZcblx0XHRcdFx0QXJyYXkuaXNBcnJheSh0ZW1wbGF0ZS5jb250ZXh0LmRlZmF1bHRWYWx1ZSkgJiZcblx0XHRcdFx0dGVtcGxhdGUuY29udGV4dC5kZWZhdWx0VmFsdWUubGVuZ3RoID09PSBuZXdWYWx1ZS5sZW5ndGggJiZcblx0XHRcdFx0dGVtcGxhdGUuY29udGV4dC5kZWZhdWx0VmFsdWUuam9pbigpID09PSBuZXdWYWx1ZS5qb2luKClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ld1ZhbHVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXI+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlclNldHRpbmdFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSwgb25DaGFuZ2U6ICh2YWx1ZTogc3RyaW5nW10gfCBudW1iZXJbXSB8IHVuZGVmaW5lZCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHZhbHVlID0gZ2V0TGlzdERpc3BsYXlWYWx1ZShkYXRhRWxlbWVudCk7XG5cdFx0Y29uc3Qga2V5U3VnZ2VzdGVyID0gZGF0YUVsZW1lbnQuc2V0dGluZy5lbnVtID8gY3JlYXRlQXJyYXlTdWdnZXN0ZXIoZGF0YUVsZW1lbnQpIDogdW5kZWZpbmVkO1xuXHRcdHRlbXBsYXRlLmxpc3RXaWRnZXQuc2V0VmFsdWUodmFsdWUsIHtcblx0XHRcdHNob3dBZGRCdXR0b246IGdldFNob3dBZGRCdXR0b25MaXN0KGRhdGFFbGVtZW50LCB2YWx1ZSksXG5cdFx0XHRrZXlTdWdnZXN0ZXJcblx0XHR9KTtcblx0XHR0ZW1wbGF0ZS5jb250ZXh0ID0gZGF0YUVsZW1lbnQ7XG5cblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0ZW1wbGF0ZS5saXN0V2lkZ2V0LmNhbmNlbEVkaXQoKTtcblx0XHR9KSk7XG5cblx0XHR0ZW1wbGF0ZS5vbkNoYW5nZSA9ICh2OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0aWYgKHYgJiYgIXJlbmRlckFycmF5VmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQsIHRlbXBsYXRlLCB2LCBmYWxzZSkpIHtcblx0XHRcdFx0Y29uc3QgaXRlbVR5cGUgPSBkYXRhRWxlbWVudC5zZXR0aW5nLmFycmF5SXRlbVR5cGU7XG5cdFx0XHRcdGNvbnN0IGFyclRvU2F2ZSA9IGlzTm9uTnVsbGFibGVOdW1lcmljVHlwZShpdGVtVHlwZSkgPyB2Lm1hcChhID0+ICthKSA6IHY7XG5cdFx0XHRcdG9uQ2hhbmdlKGFyclRvU2F2ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBTYXZlIHRoZSBzZXR0aW5nIHVucGFyc2VkIGFuZCBjb250YWluaW5nIHRoZSBlcnJvcnMuXG5cdFx0XHRcdC8vIHJlbmRlckFycmF5VmFsaWRhdGlvbnMgd2lsbCByZW5kZXIgcmVsZXZhbnQgZXJyb3IgbWVzc2FnZXMuXG5cdFx0XHRcdG9uQ2hhbmdlKHYpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZW5kZXJBcnJheVZhbGlkYXRpb25zKGRhdGFFbGVtZW50LCB0ZW1wbGF0ZSwgdmFsdWUubWFwKHYgPT4gdi52YWx1ZS5kYXRhLnRvU3RyaW5nKCkpLCB0cnVlKTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFNldHRpbmdPYmplY3RSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlPiB7XG5cblx0cHJvdGVjdGVkIHJlbmRlclRlbXBsYXRlV2l0aFdpZGdldChjb21tb246IElTZXR0aW5nSXRlbVRlbXBsYXRlLCB3aWRnZXQ6IE9iamVjdFNldHRpbmdDaGVja2JveFdpZGdldCB8IE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldCk6IElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlIHtcblx0XHR3aWRnZXQuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdGNvbW1vbi50b0Rpc3Bvc2UuYWRkKHdpZGdldCk7XG5cblx0XHRjb25zdCBkZXNjcmlwdGlvbkVsZW1lbnQgPSBjb21tb24uY29udGFpbmVyRWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJykhO1xuXHRcdGNvbnN0IHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50ID0gJCgnLnNldHRpbmctaXRlbS12YWxpZGF0aW9uLW1lc3NhZ2UnKTtcblx0XHRkZXNjcmlwdGlvbkVsZW1lbnQuYWZ0ZXIodmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlID0ge1xuXHRcdFx0Li4uY29tbW9uLFxuXHRcdFx0dmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnRcblx0XHR9O1xuXHRcdGlmICh3aWRnZXQgaW5zdGFuY2VvZiBPYmplY3RTZXR0aW5nQ2hlY2tib3hXaWRnZXQpIHtcblx0XHRcdHRlbXBsYXRlLm9iamVjdENoZWNrYm94V2lkZ2V0ID0gd2lkZ2V0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZS5vYmplY3REcm9wZG93bldpZGdldCA9IHdpZGdldDtcblx0XHR9XG5cblx0XHR0aGlzLmFkZFNldHRpbmdFbGVtZW50Rm9jdXNIYW5kbGVyKHRlbXBsYXRlKTtcblx0XHRyZXR1cm4gdGVtcGxhdGU7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXI+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyU2V0dGluZ0VsZW1lbnQoZWxlbWVudCwgaW5kZXgsIHRlbXBsYXRlRGF0YSk7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ09iamVjdFJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RTZXR0aW5nT2JqZWN0UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGU+IHtcblx0b3ZlcnJpZGUgdGVtcGxhdGVJZCA9IFNFVFRJTkdTX09CSkVDVF9URU1QTEFURV9JRDtcblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGUge1xuXHRcdGNvbnN0IGNvbW1vbiA9IHRoaXMucmVuZGVyQ29tbW9uVGVtcGxhdGUobnVsbCwgY29udGFpbmVyLCAnbGlzdCcpO1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldCwgY29tbW9uLmNvbnRyb2xFbGVtZW50KTtcblx0XHRjb25zdCB0ZW1wbGF0ZSA9IHRoaXMucmVuZGVyVGVtcGxhdGVXaXRoV2lkZ2V0KGNvbW1vbiwgd2lkZ2V0KTtcblx0XHRjb21tb24udG9EaXNwb3NlLmFkZCh3aWRnZXQub25EaWRDaGFuZ2VMaXN0KGUgPT4ge1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZU9iamVjdCh0ZW1wbGF0ZSwgZSk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VPYmplY3QodGVtcGxhdGU6IElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlLCBlOiBTZXR0aW5nTGlzdEV2ZW50PElPYmplY3REYXRhSXRlbT4pOiB2b2lkIHtcblx0XHRjb25zdCB3aWRnZXQgPSB0ZW1wbGF0ZS5vYmplY3REcm9wZG93bldpZGdldCE7XG5cdFx0aWYgKHRlbXBsYXRlLmNvbnRleHQpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdTdXBwb3J0c1JlbW92ZURlZmF1bHQgPSBvYmplY3RTZXR0aW5nU3VwcG9ydHNSZW1vdmVEZWZhdWx0VmFsdWUodGVtcGxhdGUuY29udGV4dC5zZXR0aW5nLmtleSk7XG5cdFx0XHRjb25zdCBkZWZhdWx0VmFsdWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0gdHlwZW9mIHRlbXBsYXRlLmNvbnRleHQuZGVmYXVsdFZhbHVlID09PSAnb2JqZWN0J1xuXHRcdFx0XHQ/IHRlbXBsYXRlLmNvbnRleHQuZGVmYXVsdFZhbHVlID8/IHt9XG5cdFx0XHRcdDoge307XG5cblx0XHRcdGNvbnN0IHNjb3BlVmFsdWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0gdHlwZW9mIHRlbXBsYXRlLmNvbnRleHQuc2NvcGVWYWx1ZSA9PT0gJ29iamVjdCdcblx0XHRcdFx0PyB0ZW1wbGF0ZS5jb250ZXh0LnNjb3BlVmFsdWUgPz8ge31cblx0XHRcdFx0OiB7fTtcblxuXHRcdFx0Y29uc3QgbmV3VmFsdWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0geyAuLi50ZW1wbGF0ZS5jb250ZXh0LnNjb3BlVmFsdWUgfTsgLy8gSW5pdGlhbGl6ZSB3aXRoIHNjb3BlZCB2YWx1ZXMgYXMgcmVtb3ZlZCBkZWZhdWx0IHZhbHVlcyBhcmUgbm90IHJlbmRlcmVkXG5cdFx0XHRjb25zdCBuZXdJdGVtczogSU9iamVjdERhdGFJdGVtW10gPSBbXTtcblxuXHRcdFx0d2lkZ2V0Lml0ZW1zLmZvckVhY2goKGl0ZW0sIGlkeCkgPT4ge1xuXHRcdFx0XHQvLyBJdGVtIHdhcyB1cGRhdGVkXG5cdFx0XHRcdGlmICgoZS50eXBlID09PSAnY2hhbmdlJyB8fCBlLnR5cGUgPT09ICdtb3ZlJykgJiYgZS50YXJnZXRJbmRleCA9PT0gaWR4KSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIGtleSBvZiB0aGUgZGVmYXVsdCB2YWx1ZSBpcyBjaGFuZ2VkLCByZW1vdmUgdGhlIGRlZmF1bHQgdmFsdWVcblx0XHRcdFx0XHRpZiAoZS5vcmlnaW5hbEl0ZW0ua2V5LmRhdGEgIT09IGUubmV3SXRlbS5rZXkuZGF0YSAmJiBzZXR0aW5nU3VwcG9ydHNSZW1vdmVEZWZhdWx0ICYmIGUub3JpZ2luYWxJdGVtLmtleS5kYXRhIGluIGRlZmF1bHRWYWx1ZSkge1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbZS5vcmlnaW5hbEl0ZW0ua2V5LmRhdGFdID0gbnVsbDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIG5ld1ZhbHVlW2Uub3JpZ2luYWxJdGVtLmtleS5kYXRhXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV3VmFsdWVbZS5uZXdJdGVtLmtleS5kYXRhXSA9IGUubmV3SXRlbS52YWx1ZS5kYXRhO1xuXHRcdFx0XHRcdG5ld0l0ZW1zLnB1c2goZS5uZXdJdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBBbGwgcmVtYWluaW5nIGl0ZW1zLCBidXQgc2tpcCB0aGUgb25lIHRoYXQgd2UganVzdCB1cGRhdGVkXG5cdFx0XHRcdGVsc2UgaWYgKChlLnR5cGUgIT09ICdjaGFuZ2UnICYmIGUudHlwZSAhPT0gJ21vdmUnKSB8fCBlLm5ld0l0ZW0ua2V5LmRhdGEgIT09IGl0ZW0ua2V5LmRhdGEpIHtcblx0XHRcdFx0XHRuZXdWYWx1ZVtpdGVtLmtleS5kYXRhXSA9IGl0ZW0udmFsdWUuZGF0YTtcblx0XHRcdFx0XHRuZXdJdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gSXRlbSB3YXMgZGVsZXRlZFxuXHRcdFx0aWYgKGUudHlwZSA9PT0gJ3JlbW92ZScgfHwgZS50eXBlID09PSAncmVzZXQnKSB7XG5cdFx0XHRcdGNvbnN0IG9iamVjdEtleSA9IGUub3JpZ2luYWxJdGVtLmtleS5kYXRhO1xuXHRcdFx0XHRjb25zdCByZW1vdmluZ0RlZmF1bHRWYWx1ZSA9IGUudHlwZSA9PT0gJ3JlbW92ZScgJiYgc2V0dGluZ1N1cHBvcnRzUmVtb3ZlRGVmYXVsdCAmJiBkZWZhdWx0VmFsdWVbb2JqZWN0S2V5XSA9PT0gZS5vcmlnaW5hbEl0ZW0udmFsdWUuZGF0YTtcblx0XHRcdFx0aWYgKHJlbW92aW5nRGVmYXVsdFZhbHVlKSB7XG5cdFx0XHRcdFx0bmV3VmFsdWVbb2JqZWN0S2V5XSA9IG51bGw7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVsZXRlIG5ld1ZhbHVlW29iamVjdEtleV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBpdGVtVG9EZWxldGUgPSBuZXdJdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLmtleS5kYXRhID09PSBvYmplY3RLZXkpO1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0SXRlbVZhbHVlID0gZGVmYXVsdFZhbHVlW29iamVjdEtleV0gYXMgc3RyaW5nIHwgYm9vbGVhbjtcblxuXHRcdFx0XHQvLyBJdGVtIGRvZXMgbm90IGhhdmUgYSBkZWZhdWx0IG9yIGRlZmF1bHQgaXMgYmluZyByZW1vdmVkXG5cdFx0XHRcdGlmIChyZW1vdmluZ0RlZmF1bHRWYWx1ZSB8fCBpc1VuZGVmaW5lZE9yTnVsbChkZWZhdWx0VmFsdWVbb2JqZWN0S2V5XSkgJiYgaXRlbVRvRGVsZXRlID4gLTEpIHtcblx0XHRcdFx0XHRuZXdJdGVtcy5zcGxpY2UoaXRlbVRvRGVsZXRlLCAxKTtcblx0XHRcdFx0fSBlbHNlIGlmICghcmVtb3ZpbmdEZWZhdWx0VmFsdWUgJiYgaXRlbVRvRGVsZXRlID4gLTEpIHtcblx0XHRcdFx0XHRuZXdJdGVtc1tpdGVtVG9EZWxldGVdLnZhbHVlLmRhdGEgPSBkZWZhdWx0SXRlbVZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBOZXcgaXRlbSB3YXMgYWRkZWRcblx0XHRcdGVsc2UgaWYgKGUudHlwZSA9PT0gJ2FkZCcpIHtcblx0XHRcdFx0bmV3VmFsdWVbZS5uZXdJdGVtLmtleS5kYXRhXSA9IGUubmV3SXRlbS52YWx1ZS5kYXRhO1xuXHRcdFx0XHRuZXdJdGVtcy5wdXNoKGUubmV3SXRlbSk7XG5cdFx0XHR9XG5cblx0XHRcdE9iamVjdC5lbnRyaWVzKG5ld1ZhbHVlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0Ly8gdmFsdWUgZnJvbSB0aGUgc2NvcGUgaGFzIGNoYW5nZWQgYmFjayB0byB0aGUgZGVmYXVsdFxuXHRcdFx0XHRpZiAoc2NvcGVWYWx1ZVtrZXldICE9PSB2YWx1ZSAmJiBkZWZhdWx0VmFsdWVba2V5XSA9PT0gdmFsdWUgJiYgIShzZXR0aW5nU3VwcG9ydHNSZW1vdmVEZWZhdWx0ICYmIHZhbHVlID09PSBudWxsKSkge1xuXHRcdFx0XHRcdGRlbGV0ZSBuZXdWYWx1ZVtrZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgbmV3T2JqZWN0ID0gT2JqZWN0LmtleXMobmV3VmFsdWUpLmxlbmd0aCA9PT0gMCA/IHVuZGVmaW5lZCA6IG5ld1ZhbHVlO1xuXHRcdFx0dGVtcGxhdGUub2JqZWN0RHJvcGRvd25XaWRnZXQhLnNldFZhbHVlKG5ld0l0ZW1zKTtcblx0XHRcdHRlbXBsYXRlLm9uQ2hhbmdlPy4obmV3T2JqZWN0KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyVmFsdWUoZGF0YUVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCB0ZW1wbGF0ZTogSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlbXMgPSBnZXRPYmplY3REaXNwbGF5VmFsdWUoZGF0YUVsZW1lbnQpO1xuXHRcdGNvbnN0IHsga2V5LCBvYmplY3RQcm9wZXJ0aWVzLCBvYmplY3RQYXR0ZXJuUHJvcGVydGllcywgb2JqZWN0QWRkaXRpb25hbFByb3BlcnRpZXMgfSA9IGRhdGFFbGVtZW50LnNldHRpbmc7XG5cblx0XHR0ZW1wbGF0ZS5vYmplY3REcm9wZG93bldpZGdldCEuc2V0VmFsdWUoaXRlbXMsIHtcblx0XHRcdHNldHRpbmdLZXk6IGtleSxcblx0XHRcdHNob3dBZGRCdXR0b246IG9iamVjdEFkZGl0aW9uYWxQcm9wZXJ0aWVzID09PSBmYWxzZVxuXHRcdFx0XHQ/IChcblx0XHRcdFx0XHQhYXJlQWxsUHJvcGVydGllc0RlZmluZWQoT2JqZWN0LmtleXMob2JqZWN0UHJvcGVydGllcyA/PyB7fSksIGl0ZW1zKSB8fFxuXHRcdFx0XHRcdGlzRGVmaW5lZChvYmplY3RQYXR0ZXJuUHJvcGVydGllcylcblx0XHRcdFx0KVxuXHRcdFx0XHQ6IHRydWUsXG5cdFx0XHRrZXlTdWdnZXN0ZXI6IGNyZWF0ZU9iamVjdEtleVN1Z2dlc3RlcihkYXRhRWxlbWVudCksXG5cdFx0XHR2YWx1ZVN1Z2dlc3RlcjogY3JlYXRlT2JqZWN0VmFsdWVTdWdnZXN0ZXIoZGF0YUVsZW1lbnQpXG5cdFx0fSk7XG5cblx0XHR0ZW1wbGF0ZS5jb250ZXh0ID0gZGF0YUVsZW1lbnQ7XG5cblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0ZW1wbGF0ZS5vYmplY3REcm9wZG93bldpZGdldCEuY2FuY2VsRWRpdCgpO1xuXHRcdH0pKTtcblxuXHRcdHRlbXBsYXRlLm9uQ2hhbmdlID0gKHY6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRpZiAodiAmJiAhcmVuZGVyQXJyYXlWYWxpZGF0aW9ucyhkYXRhRWxlbWVudCwgdGVtcGxhdGUsIHYsIGZhbHNlKSkge1xuXHRcdFx0XHRjb25zdCBwYXJzZWRSZWNvcmQgPSBwYXJzZU51bWVyaWNPYmplY3RWYWx1ZXMoZGF0YUVsZW1lbnQsIHYpO1xuXHRcdFx0XHRvbkNoYW5nZShwYXJzZWRSZWNvcmQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU2F2ZSB0aGUgc2V0dGluZyB1bnBhcnNlZCBhbmQgY29udGFpbmluZyB0aGUgZXJyb3JzLlxuXHRcdFx0XHQvLyByZW5kZXJBcnJheVZhbGlkYXRpb25zIHdpbGwgcmVuZGVyIHJlbGV2YW50IGVycm9yIG1lc3NhZ2VzLlxuXHRcdFx0XHRvbkNoYW5nZSh2KTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlbmRlckFycmF5VmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQsIHRlbXBsYXRlLCBkYXRhRWxlbWVudC52YWx1ZSwgdHJ1ZSk7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ0Jvb2xPYmplY3RSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ09iamVjdFJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlPiB7XG5cdG92ZXJyaWRlIHRlbXBsYXRlSWQgPSBTRVRUSU5HU19CT09MX09CSkVDVF9URU1QTEFURV9JRDtcblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGUge1xuXHRcdGNvbnN0IGNvbW1vbiA9IHRoaXMucmVuZGVyQ29tbW9uVGVtcGxhdGUobnVsbCwgY29udGFpbmVyLCAnbGlzdCcpO1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE9iamVjdFNldHRpbmdDaGVja2JveFdpZGdldCwgY29tbW9uLmNvbnRyb2xFbGVtZW50KTtcblx0XHRjb25zdCB0ZW1wbGF0ZSA9IHRoaXMucmVuZGVyVGVtcGxhdGVXaXRoV2lkZ2V0KGNvbW1vbiwgd2lkZ2V0KTtcblx0XHRjb21tb24udG9EaXNwb3NlLmFkZCh3aWRnZXQub25EaWRDaGFuZ2VMaXN0KGUgPT4ge1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZU9iamVjdCh0ZW1wbGF0ZSwgZSk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbkRpZENoYW5nZU9iamVjdCh0ZW1wbGF0ZTogSVNldHRpbmdPYmplY3RJdGVtVGVtcGxhdGUsIGU6IFNldHRpbmdMaXN0RXZlbnQ8SUJvb2xPYmplY3REYXRhSXRlbT4pOiB2b2lkIHtcblx0XHRpZiAodGVtcGxhdGUuY29udGV4dCkge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGVtcGxhdGUub2JqZWN0Q2hlY2tib3hXaWRnZXQhO1xuXHRcdFx0Y29uc3QgZGVmYXVsdFZhbHVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHR5cGVvZiB0ZW1wbGF0ZS5jb250ZXh0LmRlZmF1bHRWYWx1ZSA9PT0gJ29iamVjdCdcblx0XHRcdFx0PyB0ZW1wbGF0ZS5jb250ZXh0LmRlZmF1bHRWYWx1ZSA/PyB7fVxuXHRcdFx0XHQ6IHt9O1xuXG5cdFx0XHRjb25zdCBzY29wZVZhbHVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHR5cGVvZiB0ZW1wbGF0ZS5jb250ZXh0LnNjb3BlVmFsdWUgPT09ICdvYmplY3QnXG5cdFx0XHRcdD8gdGVtcGxhdGUuY29udGV4dC5zY29wZVZhbHVlID8/IHt9XG5cdFx0XHRcdDoge307XG5cblx0XHRcdGNvbnN0IG5ld1ZhbHVlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgLi4udGVtcGxhdGUuY29udGV4dC5zY29wZVZhbHVlIH07IC8vIEluaXRpYWxpemUgd2l0aCBzY29wZWQgdmFsdWVzIGFzIHJlbW92ZWQgZGVmYXVsdCB2YWx1ZXMgYXJlIG5vdCByZW5kZXJlZFxuXHRcdFx0Y29uc3QgbmV3SXRlbXM6IElCb29sT2JqZWN0RGF0YUl0ZW1bXSA9IFtdO1xuXG5cdFx0XHRpZiAoZS50eXBlICE9PSAnY2hhbmdlJykge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ1VuZXhwZWN0ZWQgZXZlbnQgdHlwZScsIGUudHlwZSwgJ2ZvciBib29sIG9iamVjdCBzZXR0aW5nJywgdGVtcGxhdGUuY29udGV4dC5zZXR0aW5nLmtleSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0d2lkZ2V0Lml0ZW1zLmZvckVhY2goKGl0ZW0sIGlkeCkgPT4ge1xuXHRcdFx0XHQvLyBJdGVtIHdhcyB1cGRhdGVkXG5cdFx0XHRcdGlmIChlLnRhcmdldEluZGV4ID09PSBpZHgpIHtcblx0XHRcdFx0XHRuZXdWYWx1ZVtlLm5ld0l0ZW0ua2V5LmRhdGFdID0gZS5uZXdJdGVtLnZhbHVlLmRhdGE7XG5cdFx0XHRcdFx0bmV3SXRlbXMucHVzaChlLm5ld0l0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIEFsbCByZW1haW5pbmcgaXRlbXMsIGJ1dCBza2lwIHRoZSBvbmUgdGhhdCB3ZSBqdXN0IHVwZGF0ZWRcblx0XHRcdFx0ZWxzZSBpZiAoZS5uZXdJdGVtLmtleS5kYXRhICE9PSBpdGVtLmtleS5kYXRhKSB7XG5cdFx0XHRcdFx0bmV3VmFsdWVbaXRlbS5rZXkuZGF0YV0gPSBpdGVtLnZhbHVlLmRhdGE7XG5cdFx0XHRcdFx0bmV3SXRlbXMucHVzaChpdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdE9iamVjdC5lbnRyaWVzKG5ld1ZhbHVlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0Ly8gdmFsdWUgZnJvbSB0aGUgc2NvcGUgaGFzIGNoYW5nZWQgYmFjayB0byB0aGUgZGVmYXVsdFxuXHRcdFx0XHRpZiAoc2NvcGVWYWx1ZVtrZXldICE9PSB2YWx1ZSAmJiBkZWZhdWx0VmFsdWVba2V5XSA9PT0gdmFsdWUpIHtcblx0XHRcdFx0XHRkZWxldGUgbmV3VmFsdWVba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG5ld09iamVjdCA9IE9iamVjdC5rZXlzKG5ld1ZhbHVlKS5sZW5ndGggPT09IDAgPyB1bmRlZmluZWQgOiBuZXdWYWx1ZTtcblx0XHRcdHRlbXBsYXRlLm9iamVjdENoZWNrYm94V2lkZ2V0IS5zZXRWYWx1ZShuZXdJdGVtcyk7XG5cdFx0XHR0ZW1wbGF0ZS5vbkNoYW5nZT8uKG5ld09iamVjdCk7XG5cblx0XHRcdC8vIEZvY3VzIHRoaXMgc2V0dGluZyBleHBsaWNpdGx5LCBpbiBjYXNlIHdlIHdlcmUgcHJldmlvdXNseVxuXHRcdFx0Ly8gZm9jdXNlZCBvbiBhbm90aGVyIHNldHRpbmcgYW5kIGNsaWNrZWQgYSBjaGVja2JveC92YWx1ZSBjb250YWluZXJcblx0XHRcdC8vIGZvciB0aGlzIHNldHRpbmcuXG5cdFx0XHR0aGlzLl9vbkRpZEZvY3VzU2V0dGluZy5maXJlKHRlbXBsYXRlLmNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJWYWx1ZShkYXRhRWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIHRlbXBsYXRlOiBJU2V0dGluZ09iamVjdEl0ZW1UZW1wbGF0ZSwgb25DaGFuZ2U6ICh2YWx1ZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRjb25zdCBpdGVtcyA9IGdldEJvb2xPYmplY3REaXNwbGF5VmFsdWUoZGF0YUVsZW1lbnQpO1xuXHRcdGNvbnN0IHsga2V5IH0gPSBkYXRhRWxlbWVudC5zZXR0aW5nO1xuXG5cdFx0dGVtcGxhdGUub2JqZWN0Q2hlY2tib3hXaWRnZXQhLnNldFZhbHVlKGl0ZW1zLCB7XG5cdFx0XHRzZXR0aW5nS2V5OiBrZXlcblx0XHR9KTtcblxuXHRcdHRlbXBsYXRlLmNvbnRleHQgPSBkYXRhRWxlbWVudDtcblx0XHR0ZW1wbGF0ZS5vbkNoYW5nZSA9ICh2OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0b25DaGFuZ2Uodik7XG5cdFx0fTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVJdGVtVGVtcGxhdGU+IHtcblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgaXNFeGNsdWRlKCk6IGJvb2xlYW47XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVJdGVtVGVtcGxhdGUge1xuXHRcdGNvbnN0IGNvbW1vbiA9IHRoaXMucmVuZGVyQ29tbW9uVGVtcGxhdGUobnVsbCwgY29udGFpbmVyLCAnbGlzdCcpO1xuXG5cdFx0Y29uc3QgaW5jbHVkZUV4Y2x1ZGVXaWRnZXQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZSh0aGlzLmlzRXhjbHVkZSgpID8gRXhjbHVkZVNldHRpbmdXaWRnZXQgOiBJbmNsdWRlU2V0dGluZ1dpZGdldCwgY29tbW9uLmNvbnRyb2xFbGVtZW50KTtcblx0XHRpbmNsdWRlRXhjbHVkZVdpZGdldC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuQ09OVFJPTF9DTEFTUyk7XG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoaW5jbHVkZUV4Y2x1ZGVXaWRnZXQpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHQuLi5jb21tb24sXG5cdFx0XHRpbmNsdWRlRXhjbHVkZVdpZGdldFxuXHRcdH07XG5cblx0XHR0aGlzLmFkZFNldHRpbmdFbGVtZW50Rm9jdXNIYW5kbGVyKHRlbXBsYXRlKTtcblxuXHRcdGNvbW1vbi50b0Rpc3Bvc2UuYWRkKGluY2x1ZGVFeGNsdWRlV2lkZ2V0Lm9uRGlkQ2hhbmdlTGlzdChlID0+IHRoaXMub25EaWRDaGFuZ2VJbmNsdWRlRXhjbHVkZSh0ZW1wbGF0ZSwgZSkpKTtcblxuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VJbmNsdWRlRXhjbHVkZSh0ZW1wbGF0ZTogSVNldHRpbmdJbmNsdWRlRXhjbHVkZUl0ZW1UZW1wbGF0ZSwgZTogU2V0dGluZ0xpc3RFdmVudDxJTGlzdERhdGFJdGVtPik6IHZvaWQge1xuXHRcdGlmICh0ZW1wbGF0ZS5jb250ZXh0KSB7XG5cdFx0XHRjb25zdCBuZXdWYWx1ZSA9IHsgLi4udGVtcGxhdGUuY29udGV4dC5zY29wZVZhbHVlIH07XG5cblx0XHRcdC8vIGZpcnN0IGRlbGV0ZSB0aGUgZXhpc3RpbmcgZW50cnksIGlmIHByZXNlbnRcblx0XHRcdGlmIChlLnR5cGUgIT09ICdhZGQnKSB7XG5cdFx0XHRcdGlmIChlLm9yaWdpbmFsSXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCkgaW4gdGVtcGxhdGUuY29udGV4dC5kZWZhdWx0VmFsdWUpIHtcblx0XHRcdFx0XHQvLyBkZWxldGUgYSBkZWZhdWx0IGJ5IG92ZXJyaWRpbmcgaXRcblx0XHRcdFx0XHRuZXdWYWx1ZVtlLm9yaWdpbmFsSXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCldID0gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVsZXRlIG5ld1ZhbHVlW2Uub3JpZ2luYWxJdGVtLnZhbHVlLmRhdGEudG9TdHJpbmcoKV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gdGhlbiBhZGQgdGhlIG5ldyBvciB1cGRhdGVkIGVudHJ5LCBpZiBwcmVzZW50XG5cdFx0XHRpZiAoZS50eXBlID09PSAnY2hhbmdlJyB8fCBlLnR5cGUgPT09ICdhZGQnIHx8IGUudHlwZSA9PT0gJ21vdmUnKSB7XG5cdFx0XHRcdGlmIChlLm5ld0l0ZW0udmFsdWUuZGF0YS50b1N0cmluZygpIGluIHRlbXBsYXRlLmNvbnRleHQuZGVmYXVsdFZhbHVlICYmICFlLm5ld0l0ZW0uc2libGluZykge1xuXHRcdFx0XHRcdC8vIGFkZCBhIGRlZmF1bHQgYnkgZGVsZXRpbmcgaXRzIG92ZXJyaWRlXG5cdFx0XHRcdFx0ZGVsZXRlIG5ld1ZhbHVlW2UubmV3SXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCldO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ld1ZhbHVlW2UubmV3SXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCldID0gZS5uZXdJdGVtLnNpYmxpbmcgPyB7IHdoZW46IGUubmV3SXRlbS5zaWJsaW5nIH0gOiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIHNvcnRLZXlzPFQgZXh0ZW5kcyBvYmplY3Q+KG9iajogVCkge1xuXHRcdFx0XHRjb25zdCBzb3J0ZWRLZXlzID0gT2JqZWN0LmtleXMob2JqKVxuXHRcdFx0XHRcdC5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpIGFzIEFycmF5PGtleW9mIFQ+O1xuXG5cdFx0XHRcdGNvbnN0IHJldFZhbDogUGFydGlhbDxUPiA9IHt9O1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBzb3J0ZWRLZXlzKSB7XG5cdFx0XHRcdFx0cmV0VmFsW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmV0VmFsO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNldHRpbmcuZmlyZSh7XG5cdFx0XHRcdGtleTogdGVtcGxhdGUuY29udGV4dC5zZXR0aW5nLmtleSxcblx0XHRcdFx0dmFsdWU6IE9iamVjdC5rZXlzKG5ld1ZhbHVlKS5sZW5ndGggPT09IDAgPyB1bmRlZmluZWQgOiBzb3J0S2V5cyhuZXdWYWx1ZSksXG5cdFx0XHRcdHR5cGU6IHRlbXBsYXRlLmNvbnRleHQudmFsdWVUeXBlLFxuXHRcdFx0XHRtYW51YWxSZXNldDogZmFsc2UsXG5cdFx0XHRcdHNjb3BlOiB0ZW1wbGF0ZS5jb250ZXh0LnNldHRpbmcuc2NvcGVcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlcj4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVNldHRpbmdJbmNsdWRlRXhjbHVkZUl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlclNldHRpbmdFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVJdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHZhbHVlID0gZ2V0SW5jbHVkZUV4Y2x1ZGVEaXNwbGF5VmFsdWUoZGF0YUVsZW1lbnQpO1xuXHRcdHRlbXBsYXRlLmluY2x1ZGVFeGNsdWRlV2lkZ2V0LnNldFZhbHVlKHZhbHVlKTtcblx0XHR0ZW1wbGF0ZS5jb250ZXh0ID0gZGF0YUVsZW1lbnQ7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGVtcGxhdGUuaW5jbHVkZUV4Y2x1ZGVXaWRnZXQuY2FuY2VsRWRpdCgpO1xuXHRcdH0pKTtcblx0fVxufVxuXG5jbGFzcyBTZXR0aW5nRXhjbHVkZVJlbmRlcmVyIGV4dGVuZHMgU2V0dGluZ0luY2x1ZGVFeGNsdWRlUmVuZGVyZXIge1xuXHR0ZW1wbGF0ZUlkID0gU0VUVElOR1NfRVhDTFVERV9URU1QTEFURV9JRDtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgaXNFeGNsdWRlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdJbmNsdWRlUmVuZGVyZXIgZXh0ZW5kcyBTZXR0aW5nSW5jbHVkZUV4Y2x1ZGVSZW5kZXJlciB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19JTkNMVURFX1RFTVBMQVRFX0lEO1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBpc0V4Y2x1ZGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmNvbnN0IHNldHRpbmdzSW5wdXRCb3hTdHlsZXMgPSBnZXRJbnB1dEJveFN0eWxlKHtcblx0aW5wdXRCYWNrZ3JvdW5kOiBzZXR0aW5nc1RleHRJbnB1dEJhY2tncm91bmQsXG5cdGlucHV0Rm9yZWdyb3VuZDogc2V0dGluZ3NUZXh0SW5wdXRGb3JlZ3JvdW5kLFxuXHRpbnB1dEJvcmRlcjogc2V0dGluZ3NUZXh0SW5wdXRCb3JkZXJcbn0pO1xuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFNldHRpbmdUZXh0UmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdFNldHRpbmdSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyLCBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGU+IHtcblx0cHJpdmF0ZSByZWFkb25seSBNVUxUSUxJTkVfTUFYX0hFSUdIVCA9IDE1MDtcblxuXHRyZW5kZXJUZW1wbGF0ZShfY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdXNlTXVsdGlsaW5lPzogYm9vbGVhbik6IElTZXR0aW5nVGV4dEl0ZW1UZW1wbGF0ZSB7XG5cdFx0Y29uc3QgY29tbW9uID0gdGhpcy5yZW5kZXJDb21tb25UZW1wbGF0ZShudWxsLCBfY29udGFpbmVyLCAndGV4dCcpO1xuXHRcdGNvbnN0IHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50ID0gRE9NLmFwcGVuZChjb21tb24uY29udGFpbmVyRWxlbWVudCwgJCgnLnNldHRpbmctaXRlbS12YWxpZGF0aW9uLW1lc3NhZ2UnKSk7XG5cblx0XHRjb25zdCBpbnB1dEJveE9wdGlvbnM6IElJbnB1dE9wdGlvbnMgPSB7XG5cdFx0XHRmbGV4aWJsZUhlaWdodDogdXNlTXVsdGlsaW5lLFxuXHRcdFx0ZmxleGlibGVXaWR0aDogZmFsc2UsXG5cdFx0XHRmbGV4aWJsZU1heEhlaWdodDogdGhpcy5NVUxUSUxJTkVfTUFYX0hFSUdIVCxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBzZXR0aW5nc0lucHV0Qm94U3R5bGVzXG5cdFx0fTtcblx0XHRjb25zdCBpbnB1dEJveCA9IG5ldyBJbnB1dEJveChjb21tb24uY29udHJvbEVsZW1lbnQsIHRoaXMuX2NvbnRleHRWaWV3U2VydmljZSwgaW5wdXRCb3hPcHRpb25zKTtcblx0XHRjb21tb24udG9EaXNwb3NlLmFkZChpbnB1dEJveCk7XG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoXG5cdFx0XHRpbnB1dEJveC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0dGVtcGxhdGUub25DaGFuZ2U/LihlKTtcblx0XHRcdH0pKTtcblx0XHRjb21tb24udG9EaXNwb3NlLmFkZChpbnB1dEJveCk7XG5cdFx0aW5wdXRCb3guaW5wdXRFbGVtZW50LmNsYXNzTGlzdC5hZGQoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuQ09OVFJPTF9DTEFTUyk7XG5cdFx0aW5wdXRCb3guaW5wdXRFbGVtZW50LnRhYkluZGV4ID0gMDtcblxuXHRcdGNvbnN0IHRlbXBsYXRlOiBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHQuLi5jb21tb24sXG5cdFx0XHRpbnB1dEJveCxcblx0XHRcdHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50XG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJTZXR0aW5nRWxlbWVudChlbGVtZW50LCBpbmRleCwgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJWYWx1ZShkYXRhRWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIHRlbXBsYXRlOiBJU2V0dGluZ1RleHRJdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLm9uQ2hhbmdlID0gdW5kZWZpbmVkO1xuXHRcdHRlbXBsYXRlLmlucHV0Qm94LnZhbHVlID0gZGF0YUVsZW1lbnQudmFsdWU7XG5cdFx0dGVtcGxhdGUuaW5wdXRCb3guc2V0QXJpYUxhYmVsKGRhdGFFbGVtZW50LnNldHRpbmcua2V5KTtcblx0XHR0ZW1wbGF0ZS5vbkNoYW5nZSA9IHZhbHVlID0+IHtcblx0XHRcdGlmICghcmVuZGVyVmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQsIHRlbXBsYXRlLCBmYWxzZSkpIHtcblx0XHRcdFx0b25DaGFuZ2UodmFsdWUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZW5kZXJWYWxpZGF0aW9ucyhkYXRhRWxlbWVudCwgdGVtcGxhdGUsIHRydWUpO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdUZXh0UmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdFNldHRpbmdUZXh0UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdUZXh0SXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19URVhUX1RFTVBMQVRFX0lEO1xuXG5cdG92ZXJyaWRlIHJlbmRlclRlbXBsYXRlKF9jb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdUZXh0SXRlbVRlbXBsYXRlIHtcblx0XHRjb25zdCB0ZW1wbGF0ZSA9IHN1cGVyLnJlbmRlclRlbXBsYXRlKF9jb250YWluZXIsIGZhbHNlKTtcblxuXHRcdC8vIFRPRE9AOWF0ODogbGlzdFdpZGdldCBmaWx0ZXJzIG91dCBhbGwga2V5IGV2ZW50cyBmcm9tIGlucHV0IGJveGVzLCBzbyB3ZSBuZWVkIHRvIGNvbWUgdXAgd2l0aCBhIGJldHRlciB3YXlcblx0XHQvLyBEaXNhYmxlIEFycm93VXAgYW5kIEFycm93RG93biBiZWhhdmlvdXIgaW4gZmF2b3Igb2YgbGlzdCBuYXZpZ2F0aW9uXG5cdFx0dGVtcGxhdGUudG9EaXNwb3NlLmFkZChET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGVtcGxhdGUuaW5wdXRCb3guaW5wdXRFbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpIHx8IGUuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdNdWx0aWxpbmVUZXh0UmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdFNldHRpbmdUZXh0UmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdUZXh0SXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19NVUxUSUxJTkVfVEVYVF9URU1QTEFURV9JRDtcblxuXHRvdmVycmlkZSByZW5kZXJUZW1wbGF0ZShfY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXR0aW5nVGV4dEl0ZW1UZW1wbGF0ZSB7XG5cdFx0cmV0dXJuIHN1cGVyLnJlbmRlclRlbXBsYXRlKF9jb250YWluZXIsIHRydWUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nVGV4dEl0ZW1UZW1wbGF0ZSwgb25DaGFuZ2U6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3Qgb25DaGFuZ2VPdmVycmlkZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG5cdFx0XHQvLyBFbnN1cmUgdGhlIG1vZGVsIGlzIHVwIHRvIGRhdGUgc2luY2UgYSBkaWZmZXJlbnQgdmFsdWUgd2lsbCBiZSByZW5kZXJlZCBhcyBkaWZmZXJlbnQgaGVpZ2h0IHdoZW4gcHJvYmluZyB0aGUgaGVpZ2h0LlxuXHRcdFx0ZGF0YUVsZW1lbnQudmFsdWUgPSB2YWx1ZTtcblx0XHRcdG9uQ2hhbmdlKHZhbHVlKTtcblx0XHR9O1xuXHRcdHN1cGVyLnJlbmRlclZhbHVlKGRhdGFFbGVtZW50LCB0ZW1wbGF0ZSwgb25DaGFuZ2VPdmVycmlkZSk7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZChcblx0XHRcdHRlbXBsYXRlLmlucHV0Qm94Lm9uRGlkSGVpZ2h0Q2hhbmdlKGUgPT4ge1xuXHRcdFx0XHRjb25zdCBoZWlnaHQgPSB0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LmNsaWVudEhlaWdodDtcblx0XHRcdFx0Ly8gRG9uJ3QgZmlyZSBldmVudCBpZiBoZWlnaHQgaXMgcmVwb3J0ZWQgYXMgMCxcblx0XHRcdFx0Ly8gd2hpY2ggc29tZXRpbWVzIGhhcHBlbnMgd2hlbiBjbGlja2luZyBvbnRvIGEgbmV3IHNldHRpbmcuXG5cdFx0XHRcdGlmIChoZWlnaHQpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNldHRpbmdIZWlnaHQuZmlyZSh7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiBkYXRhRWxlbWVudCxcblx0XHRcdFx0XHRcdGhlaWdodDogdGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGllbnRIZWlnaHRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXHRcdHRlbXBsYXRlLmlucHV0Qm94LmxheW91dCgpO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdFbnVtUmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdFNldHRpbmdSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyLCBJU2V0dGluZ0VudW1JdGVtVGVtcGxhdGU+IHtcblx0dGVtcGxhdGVJZCA9IFNFVFRJTkdTX0VOVU1fVEVNUExBVEVfSUQ7XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXR0aW5nRW51bUl0ZW1UZW1wbGF0ZSB7XG5cdFx0Y29uc3QgY29tbW9uID0gdGhpcy5yZW5kZXJDb21tb25UZW1wbGF0ZShudWxsLCBjb250YWluZXIsICdlbnVtJyk7XG5cblx0XHRjb25zdCBzdHlsZXMgPSBnZXRTZWxlY3RCb3hTdHlsZXMoe1xuXHRcdFx0c2VsZWN0QmFja2dyb3VuZDogc2V0dGluZ3NTZWxlY3RCYWNrZ3JvdW5kLFxuXHRcdFx0c2VsZWN0Rm9yZWdyb3VuZDogc2V0dGluZ3NTZWxlY3RGb3JlZ3JvdW5kLFxuXHRcdFx0c2VsZWN0Qm9yZGVyOiBzZXR0aW5nc1NlbGVjdEJvcmRlcixcblx0XHRcdHNlbGVjdExpc3RCb3JkZXI6IHNldHRpbmdzU2VsZWN0TGlzdEJvcmRlclxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc2VsZWN0Qm94ID0gbmV3IFNlbGVjdEJveChbXSwgMCwgdGhpcy5fY29udGV4dFZpZXdTZXJ2aWNlLCBzdHlsZXMsIHtcblx0XHRcdHVzZUN1c3RvbURyYXduOiAhKGlzSU9TICYmIEJyb3dzZXJGZWF0dXJlcy5wb2ludGVyRXZlbnRzKVxuXHRcdH0pO1xuXG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoc2VsZWN0Qm94KTtcblx0XHRzZWxlY3RCb3gucmVuZGVyKGNvbW1vbi5jb250cm9sRWxlbWVudCk7XG5cdFx0Y29uc3Qgc2VsZWN0RWxlbWVudCA9IGNvbW1vbi5jb250cm9sRWxlbWVudC5xdWVyeVNlbGVjdG9yKCdzZWxlY3QnKTtcblx0XHRpZiAoc2VsZWN0RWxlbWVudCkge1xuXHRcdFx0c2VsZWN0RWxlbWVudC5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdFx0c2VsZWN0RWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0fVxuXG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoXG5cdFx0XHRzZWxlY3RCb3gub25EaWRTZWxlY3QoZSA9PiB7XG5cdFx0XHRcdHRlbXBsYXRlLm9uQ2hhbmdlPy4oZS5pbmRleCk7XG5cdFx0XHR9KSk7XG5cblx0XHRjb25zdCBlbnVtRGVzY3JpcHRpb25FbGVtZW50ID0gY29tbW9uLmNvbnRhaW5lckVsZW1lbnQuaW5zZXJ0QmVmb3JlKCQoJy5zZXR0aW5nLWl0ZW0tZW51bURlc2NyaXB0aW9uJyksIGNvbW1vbi5kZXNjcmlwdGlvbkVsZW1lbnQubmV4dFNpYmxpbmcpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGU6IElTZXR0aW5nRW51bUl0ZW1UZW1wbGF0ZSA9IHtcblx0XHRcdC4uLmNvbW1vbixcblx0XHRcdHNlbGVjdEJveCxcblx0XHRcdHNlbGVjdEVsZW1lbnQsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25FbGVtZW50XG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ0VudW1JdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJTZXR0aW5nRWxlbWVudChlbGVtZW50LCBpbmRleCwgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJWYWx1ZShkYXRhRWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIHRlbXBsYXRlOiBJU2V0dGluZ0VudW1JdGVtVGVtcGxhdGUsIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdC8vIE1ha2Ugc2hhbGxvdyBjb3BpZXMgaGVyZSBzbyB0aGF0IHdlIGRvbid0IG1vZGlmeSB0aGUgYWN0dWFsIGRhdGFFbGVtZW50IGxhdGVyXG5cdFx0Y29uc3QgZW51bUl0ZW1MYWJlbHMgPSBkYXRhRWxlbWVudC5zZXR0aW5nLmVudW1JdGVtTGFiZWxzID8gWy4uLmRhdGFFbGVtZW50LnNldHRpbmcuZW51bUl0ZW1MYWJlbHNdIDogW107XG5cdFx0Y29uc3QgZW51bURlc2NyaXB0aW9ucyA9IGRhdGFFbGVtZW50LnNldHRpbmcuZW51bURlc2NyaXB0aW9ucyA/IFsuLi5kYXRhRWxlbWVudC5zZXR0aW5nLmVudW1EZXNjcmlwdGlvbnNdIDogW107XG5cdFx0Y29uc3Qgc2V0dGluZ0VudW0gPSBbLi4uZGF0YUVsZW1lbnQuc2V0dGluZy5lbnVtIV07XG5cdFx0Y29uc3QgZW51bURlc2NyaXB0aW9uc0FyZU1hcmtkb3duID0gZGF0YUVsZW1lbnQuc2V0dGluZy5lbnVtRGVzY3JpcHRpb25zQXJlTWFya2Rvd247XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGVzKTtcblxuXHRcdGxldCBjcmVhdGVkRGVmYXVsdCA9IGZhbHNlO1xuXHRcdGlmICghc2V0dGluZ0VudW0uaW5jbHVkZXMoZGF0YUVsZW1lbnQuZGVmYXVsdFZhbHVlKSkge1xuXHRcdFx0Ly8gQWRkIGEgbmV3IHBvdGVudGlhbGx5IGJsYW5rIGRlZmF1bHQgc2V0dGluZ1xuXHRcdFx0c2V0dGluZ0VudW0udW5zaGlmdChkYXRhRWxlbWVudC5kZWZhdWx0VmFsdWUpO1xuXHRcdFx0ZW51bURlc2NyaXB0aW9ucy51bnNoaWZ0KCcnKTtcblx0XHRcdGVudW1JdGVtTGFiZWxzLnVuc2hpZnQoJycpO1xuXHRcdFx0Y3JlYXRlZERlZmF1bHQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFVzZSBTdHJpbmcgY29uc3RydWN0b3IgaW4gY2FzZSBvZiBudWxsIG9yIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRjb25zdCBzdHJpbmdpZmllZERlZmF1bHRWYWx1ZSA9IGVzY2FwZUludmlzaWJsZUNoYXJzKFN0cmluZyhkYXRhRWxlbWVudC5kZWZhdWx0VmFsdWUpKTtcblx0XHRjb25zdCBkaXNwbGF5T3B0aW9uczogSVNlbGVjdE9wdGlvbkl0ZW1bXSA9IHNldHRpbmdFbnVtXG5cdFx0XHQubWFwKFN0cmluZylcblx0XHRcdC5tYXAoZXNjYXBlSW52aXNpYmxlQ2hhcnMpXG5cdFx0XHQubWFwKChkYXRhLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IChlbnVtRGVzY3JpcHRpb25zW2luZGV4XSAmJiAoZW51bURlc2NyaXB0aW9uc0FyZU1hcmtkb3duID8gZml4U2V0dGluZ0xpbmtzKGVudW1EZXNjcmlwdGlvbnNbaW5kZXhdLCBmYWxzZSkgOiBlbnVtRGVzY3JpcHRpb25zW2luZGV4XSkpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHRleHQ6IGVudW1JdGVtTGFiZWxzW2luZGV4XSA/IGVudW1JdGVtTGFiZWxzW2luZGV4XSA6IGRhdGEsXG5cdFx0XHRcdFx0ZGV0YWlsOiBlbnVtSXRlbUxhYmVsc1tpbmRleF0gPyBkYXRhIDogJycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25Jc01hcmtkb3duOiBlbnVtRGVzY3JpcHRpb25zQXJlTWFya2Rvd24sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25NYXJrZG93bkFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrOiAoY29udGVudCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oY29udGVudCkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzOiBkaXNwb3NhYmxlc1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGVjb3JhdG9yUmlnaHQ6ICgoKGRhdGEgPT09IHN0cmluZ2lmaWVkRGVmYXVsdFZhbHVlKSB8fCAoY3JlYXRlZERlZmF1bHQgJiYgaW5kZXggPT09IDApKSA/IGxvY2FsaXplKCdzZXR0aW5ncy5EZWZhdWx0JywgXCJkZWZhdWx0XCIpIDogJycpXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTZWxlY3RPcHRpb25JdGVtO1xuXHRcdFx0fSk7XG5cblx0XHR0ZW1wbGF0ZS5zZWxlY3RCb3guc2V0T3B0aW9ucyhkaXNwbGF5T3B0aW9ucyk7XG5cdFx0dGVtcGxhdGUuc2VsZWN0Qm94LnNldEFyaWFMYWJlbChkYXRhRWxlbWVudC5zZXR0aW5nLmtleSk7XG5cblx0XHRsZXQgaWR4ID0gc2V0dGluZ0VudW0uaW5kZXhPZihkYXRhRWxlbWVudC52YWx1ZSk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdGlkeCA9IDA7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUub25DaGFuZ2UgPSB1bmRlZmluZWQ7XG5cdFx0dGVtcGxhdGUuc2VsZWN0Qm94LnNlbGVjdChpZHgpO1xuXHRcdHRlbXBsYXRlLm9uQ2hhbmdlID0gKGlkeCkgPT4ge1xuXHRcdFx0aWYgKGNyZWF0ZWREZWZhdWx0ICYmIGlkeCA9PT0gMCkge1xuXHRcdFx0XHRvbkNoYW5nZShkYXRhRWxlbWVudC5kZWZhdWx0VmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b25DaGFuZ2Uoc2V0dGluZ0VudW1baWR4XSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRlbXBsYXRlLmVudW1EZXNjcmlwdGlvbkVsZW1lbnQuaW5uZXJUZXh0ID0gJyc7XG5cdH1cbn1cblxuY29uc3Qgc2V0dGluZ3NOdW1iZXJJbnB1dEJveFN0eWxlcyA9IGdldElucHV0Qm94U3R5bGUoe1xuXHRpbnB1dEJhY2tncm91bmQ6IHNldHRpbmdzTnVtYmVySW5wdXRCYWNrZ3JvdW5kLFxuXHRpbnB1dEZvcmVncm91bmQ6IHNldHRpbmdzTnVtYmVySW5wdXRGb3JlZ3JvdW5kLFxuXHRpbnB1dEJvcmRlcjogc2V0dGluZ3NOdW1iZXJJbnB1dEJvcmRlclxufSk7XG5cbmNsYXNzIFNldHRpbmdOdW1iZXJSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nTnVtYmVySXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19OVU1CRVJfVEVNUExBVEVfSUQ7XG5cblx0cmVuZGVyVGVtcGxhdGUoX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJU2V0dGluZ051bWJlckl0ZW1UZW1wbGF0ZSB7XG5cdFx0Y29uc3QgY29tbW9uID0gc3VwZXIucmVuZGVyQ29tbW9uVGVtcGxhdGUobnVsbCwgX2NvbnRhaW5lciwgJ251bWJlcicpO1xuXHRcdGNvbnN0IHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50ID0gRE9NLmFwcGVuZChjb21tb24uY29udGFpbmVyRWxlbWVudCwgJCgnLnNldHRpbmctaXRlbS12YWxpZGF0aW9uLW1lc3NhZ2UnKSk7XG5cblx0XHRjb25zdCBpbnB1dEJveCA9IG5ldyBJbnB1dEJveChjb21tb24uY29udHJvbEVsZW1lbnQsIHRoaXMuX2NvbnRleHRWaWV3U2VydmljZSwgeyB0eXBlOiAnbnVtYmVyJywgaW5wdXRCb3hTdHlsZXM6IHNldHRpbmdzTnVtYmVySW5wdXRCb3hTdHlsZXMgfSk7XG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoaW5wdXRCb3gpO1xuXHRcdGNvbW1vbi50b0Rpc3Bvc2UuYWRkKFxuXHRcdFx0aW5wdXRCb3gub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdHRlbXBsYXRlLm9uQ2hhbmdlPy4oZSk7XG5cdFx0XHR9KSk7XG5cdFx0Y29tbW9uLnRvRGlzcG9zZS5hZGQoaW5wdXRCb3gpO1xuXHRcdGlucHV0Qm94LmlucHV0RWxlbWVudC5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdGlucHV0Qm94LmlucHV0RWxlbWVudC50YWJJbmRleCA9IDA7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZTogSVNldHRpbmdOdW1iZXJJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHQuLi5jb21tb24sXG5cdFx0XHRpbnB1dEJveCxcblx0XHRcdHZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50XG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ051bWJlckl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlclNldHRpbmdFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nTnVtYmVySXRlbVRlbXBsYXRlLCBvbkNoYW5nZTogKHZhbHVlOiBudW1iZXIgfCBudWxsKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgbnVtUGFyc2VGbiA9IChkYXRhRWxlbWVudC52YWx1ZVR5cGUgPT09ICdpbnRlZ2VyJyB8fCBkYXRhRWxlbWVudC52YWx1ZVR5cGUgPT09ICdudWxsYWJsZS1pbnRlZ2VyJylcblx0XHRcdD8gcGFyc2VJbnQgOiBwYXJzZUZsb2F0O1xuXG5cdFx0Y29uc3QgbnVsbE51bVBhcnNlRm4gPSAoZGF0YUVsZW1lbnQudmFsdWVUeXBlID09PSAnbnVsbGFibGUtaW50ZWdlcicgfHwgZGF0YUVsZW1lbnQudmFsdWVUeXBlID09PSAnbnVsbGFibGUtbnVtYmVyJylcblx0XHRcdD8gKCh2OiBzdHJpbmcpID0+IHYgPT09ICcnID8gbnVsbCA6IG51bVBhcnNlRm4odikpIDogbnVtUGFyc2VGbjtcblxuXHRcdHRlbXBsYXRlLm9uQ2hhbmdlID0gdW5kZWZpbmVkO1xuXHRcdHRlbXBsYXRlLmlucHV0Qm94LnZhbHVlID0gdHlwZW9mIGRhdGFFbGVtZW50LnZhbHVlID09PSAnbnVtYmVyJyA/XG5cdFx0XHRkYXRhRWxlbWVudC52YWx1ZS50b1N0cmluZygpIDogJyc7XG5cdFx0dGVtcGxhdGUuaW5wdXRCb3guc3RlcCA9IGRhdGFFbGVtZW50LnZhbHVlVHlwZS5pbmNsdWRlcygnaW50ZWdlcicpID8gJzEnIDogJ2FueSc7XG5cdFx0dGVtcGxhdGUuaW5wdXRCb3guc2V0QXJpYUxhYmVsKGRhdGFFbGVtZW50LnNldHRpbmcua2V5KTtcblx0XHR0ZW1wbGF0ZS5vbkNoYW5nZSA9IHZhbHVlID0+IHtcblx0XHRcdGlmICghcmVuZGVyVmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQsIHRlbXBsYXRlLCBmYWxzZSkpIHtcblx0XHRcdFx0b25DaGFuZ2UobnVsbE51bVBhcnNlRm4odmFsdWUpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmVuZGVyVmFsaWRhdGlvbnMoZGF0YUVsZW1lbnQsIHRlbXBsYXRlLCB0cnVlKTtcblx0fVxufVxuXG5jbGFzcyBTZXR0aW5nQm9vbFJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBuZXZlciwgSVNldHRpbmdCb29sSXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19CT09MX1RFTVBMQVRFX0lEO1xuXG5cdHJlbmRlclRlbXBsYXRlKF9jb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNldHRpbmdCb29sSXRlbVRlbXBsYXRlIHtcblx0XHRfY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctaXRlbScpO1xuXHRcdF9jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy1pdGVtLWJvb2wnKTtcblxuXHRcdGNvbnN0IHRvRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IERPTS5hcHBlbmQoX2NvbnRhaW5lciwgJChBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5DT05URU5UU19TRUxFQ1RPUikpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdzZXR0aW5ncy1yb3ctaW5uZXItY29udGFpbmVyJyk7XG5cblx0XHRjb25zdCB0aXRsZUVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctaXRlbS10aXRsZScpKTtcblx0XHRjb25zdCBjYXRlZ29yeUVsZW1lbnQgPSBET00uYXBwZW5kKHRpdGxlRWxlbWVudCwgJCgnc3Bhbi5zZXR0aW5nLWl0ZW0tY2F0ZWdvcnknKSk7XG5cdFx0Y29uc3QgbGFiZWxFbGVtZW50Q29udGFpbmVyID0gRE9NLmFwcGVuZCh0aXRsZUVsZW1lbnQsICQoJ3NwYW4uc2V0dGluZy1pdGVtLWxhYmVsJykpO1xuXHRcdGNvbnN0IGxhYmVsRWxlbWVudCA9IHRvRGlzcG9zZS5hZGQobmV3IFNpbXBsZUljb25MYWJlbChsYWJlbEVsZW1lbnRDb250YWluZXIpKTtcblx0XHRjb25zdCBpbmRpY2F0b3JzTGFiZWwgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc1RyZWVJbmRpY2F0b3JzTGFiZWwsIHRpdGxlRWxlbWVudCk7XG5cblx0XHRjb25zdCBkZXNjcmlwdGlvbkFuZFZhbHVlRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc2V0dGluZy1pdGVtLXZhbHVlLWRlc2NyaXB0aW9uJykpO1xuXHRcdGNvbnN0IGNvbnRyb2xFbGVtZW50ID0gRE9NLmFwcGVuZChkZXNjcmlwdGlvbkFuZFZhbHVlRWxlbWVudCwgJCgnLnNldHRpbmctaXRlbS1ib29sLWNvbnRyb2wnKSk7XG5cdFx0Y29uc3QgZGVzY3JpcHRpb25FbGVtZW50ID0gRE9NLmFwcGVuZChkZXNjcmlwdGlvbkFuZFZhbHVlRWxlbWVudCwgJCgnLnNldHRpbmctaXRlbS1kZXNjcmlwdGlvbicpKTtcblx0XHRjb25zdCBtb2RpZmllZEluZGljYXRvckVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctaXRlbS1tb2RpZmllZC1pbmRpY2F0b3InKSk7XG5cdFx0dG9EaXNwb3NlLmFkZCh0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBEZWxheWVkSG92ZXIobW9kaWZpZWRJbmRpY2F0b3JFbGVtZW50LCB7XG5cdFx0XHRjb250ZW50OiBsb2NhbGl6ZSgnbW9kaWZpZWQnLCBcIlRoZSBzZXR0aW5nIGhhcyBiZWVuIGNvbmZpZ3VyZWQgaW4gdGhlIGN1cnJlbnQgc2NvcGUuXCIpXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZGVwcmVjYXRpb25XYXJuaW5nRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc2V0dGluZy1pdGVtLWRlcHJlY2F0aW9uLW1lc3NhZ2UnKSk7XG5cblx0XHRjb25zdCBjaGVja2JveCA9IG5ldyBUb2dnbGUoeyBpY29uOiBDb2RpY29uLmNoZWNrLCBhY3Rpb25DbGFzc05hbWU6ICdzZXR0aW5nLXZhbHVlLWNoZWNrYm94JywgaXNDaGVja2VkOiB0cnVlLCB0aXRsZTogJycsIC4uLnVudGhlbWVkVG9nZ2xlU3R5bGVzIH0pO1xuXHRcdGNvbnRyb2xFbGVtZW50LmFwcGVuZENoaWxkKGNoZWNrYm94LmRvbU5vZGUpO1xuXHRcdHRvRGlzcG9zZS5hZGQoY2hlY2tib3gpO1xuXHRcdHRvRGlzcG9zZS5hZGQoY2hlY2tib3gub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGVtcGxhdGUub25DaGFuZ2UhKGNoZWNrYm94LmNoZWNrZWQpO1xuXHRcdH0pKTtcblxuXHRcdC8vIE5lZWQgdG8gbGlzdGVuIGZvciBtb3VzZSBjbGlja3Mgb24gZGVzY3JpcHRpb24gYW5kIHRvZ2dsZSBjaGVja2JveCAtIHVzZSB0YXJnZXQgSUQgZm9yIHNhZmV0eVxuXHRcdC8vIEFsc28gaGF2ZSB0byBpZ25vcmUgZW1iZWRkZWQgbGlua3MgLSB0b28gYnVyaWVkIHRvIHN0b3AgcHJvcGFnYXRpb25cblx0XHR0b0Rpc3Bvc2UuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZGVzY3JpcHRpb25FbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX0RPV04sIChlKSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXRFbGVtZW50ID0gPEhUTUxFbGVtZW50PmUudGFyZ2V0O1xuXG5cdFx0XHQvLyBUb2dnbGUgdGFyZ2V0IGNoZWNrYm94XG5cdFx0XHRpZiAodGFyZ2V0RWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgIT09ICdhJykge1xuXHRcdFx0XHR0ZW1wbGF0ZS5jaGVja2JveC5jaGVja2VkID0gIXRlbXBsYXRlLmNoZWNrYm94LmNoZWNrZWQ7XG5cdFx0XHRcdHRlbXBsYXRlLm9uQ2hhbmdlIShjaGVja2JveC5jaGVja2VkKTtcblx0XHRcdH1cblx0XHRcdERPTS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdH0pKTtcblxuXG5cdFx0Y2hlY2tib3guZG9tTm9kZS5jbGFzc0xpc3QuYWRkKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfQ0xBU1MpO1xuXHRcdGNvbnN0IHRvb2xiYXJDb250YWluZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctdG9vbGJhci1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgdG9vbGJhciA9IHRoaXMucmVuZGVyU2V0dGluZ1Rvb2xiYXIodG9vbGJhckNvbnRhaW5lcik7XG5cdFx0dG9EaXNwb3NlLmFkZCh0b29sYmFyKTtcblxuXHRcdGNvbnN0IHRlbXBsYXRlOiBJU2V0dGluZ0Jvb2xJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHR0b0Rpc3Bvc2UsXG5cdFx0XHRlbGVtZW50RGlzcG9zYWJsZXM6IHRvRGlzcG9zZS5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSxcblxuXHRcdFx0Y29udGFpbmVyRWxlbWVudDogY29udGFpbmVyLFxuXHRcdFx0Y2F0ZWdvcnlFbGVtZW50LFxuXHRcdFx0bGFiZWxFbGVtZW50LFxuXHRcdFx0Y29udHJvbEVsZW1lbnQsXG5cdFx0XHRjaGVja2JveCxcblx0XHRcdGRlc2NyaXB0aW9uRWxlbWVudCxcblx0XHRcdGRlcHJlY2F0aW9uV2FybmluZ0VsZW1lbnQsXG5cdFx0XHRpbmRpY2F0b3JzTGFiZWwsXG5cdFx0XHR0b29sYmFyXG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0Ly8gUHJldmVudCBjbGlja3MgZnJvbSBiZWluZyBoYW5kbGVkIGJ5IGxpc3Rcblx0XHR0b0Rpc3Bvc2UuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoY29udHJvbEVsZW1lbnQsICdtb3VzZWRvd24nLCAoZTogSU1vdXNlRXZlbnQpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCkpKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGl0bGVFbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX0VOVEVSLCBlID0+IGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtb3VzZW92ZXInKSkpO1xuXHRcdHRvRGlzcG9zZS5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aXRsZUVsZW1lbnQsIERPTS5FdmVudFR5cGUuTU9VU0VfTEVBVkUsIGUgPT4gY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ21vdXNlb3ZlcicpKSk7XG5cblx0XHRyZXR1cm4gdGVtcGxhdGU7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXI+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElTZXR0aW5nQm9vbEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlclNldHRpbmdFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nQm9vbEl0ZW1UZW1wbGF0ZSwgb25DaGFuZ2U6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLm9uQ2hhbmdlID0gdW5kZWZpbmVkO1xuXHRcdHRlbXBsYXRlLmNoZWNrYm94LmNoZWNrZWQgPSBkYXRhRWxlbWVudC52YWx1ZTtcblx0XHR0ZW1wbGF0ZS5jaGVja2JveC5zZXRUaXRsZShkYXRhRWxlbWVudC5zZXR0aW5nLmtleSk7XG5cdFx0dGVtcGxhdGUub25DaGFuZ2UgPSBvbkNoYW5nZTtcblx0fVxufVxuXG50eXBlIE1hbmFnZUV4dGVuc2lvbkNsaWNrVGVsZW1ldHJ5Q2xhc3NpZmljYXRpb24gPSB7XG5cdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiB0aGUgdXNlciB3ZW50IHRvIG1hbmFnZS4nIH07XG5cdG93bmVyOiAncnpoYW8yNzEnO1xuXHRjb21tZW50OiAnRXZlbnQgdXNlZCB0byBnYWluIGluc2lnaHRzIGludG8gd2hlbiB1c2VycyBpbnRlcmFjdCB3aXRoIGFuIGV4dGVuc2lvbiBtYW5hZ2VtZW50IHNldHRpbmcnO1xufTtcblxuY2xhc3MgU2V0dGluZ3NFeHRlbnNpb25Ub2dnbGVSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgbmV2ZXIsIElTZXR0aW5nRXh0ZW5zaW9uVG9nZ2xlSXRlbVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSBTRVRUSU5HU19FWFRFTlNJT05fVE9HR0xFX1RFTVBMQVRFX0lEO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzbWlzc0V4dGVuc2lvblNldHRpbmcgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRpZERpc21pc3NFeHRlbnNpb25TZXR0aW5nID0gdGhpcy5fb25EaWREaXNtaXNzRXh0ZW5zaW9uU2V0dGluZy5ldmVudDtcblxuXHRyZW5kZXJUZW1wbGF0ZShfY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXR0aW5nRXh0ZW5zaW9uVG9nZ2xlSXRlbVRlbXBsYXRlIHtcblx0XHRjb25zdCBjb21tb24gPSBzdXBlci5yZW5kZXJDb21tb25UZW1wbGF0ZShudWxsLCBfY29udGFpbmVyLCAnZXh0ZW5zaW9uLXRvZ2dsZScpO1xuXG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gbmV3IEJ1dHRvbihjb21tb24uY29udGFpbmVyRWxlbWVudCwge1xuXHRcdFx0dGl0bGU6IGZhbHNlLFxuXHRcdFx0Li4uZGVmYXVsdEJ1dHRvblN0eWxlc1xuXHRcdH0pO1xuXHRcdGFjdGlvbkJ1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctaXRlbS1leHRlbnNpb24tdG9nZ2xlLWJ1dHRvbicpO1xuXHRcdGFjdGlvbkJ1dHRvbi5sYWJlbCA9IGxvY2FsaXplKCdzaG93RXh0ZW5zaW9uJywgXCJTaG93IEV4dGVuc2lvblwiKTtcblxuXHRcdGNvbnN0IGRpc21pc3NCdXR0b24gPSBuZXcgQnV0dG9uKGNvbW1vbi5jb250YWluZXJFbGVtZW50LCB7XG5cdFx0XHR0aXRsZTogZmFsc2UsXG5cdFx0XHRzZWNvbmRhcnk6IHRydWUsXG5cdFx0XHQuLi5kZWZhdWx0QnV0dG9uU3R5bGVzXG5cdFx0fSk7XG5cdFx0ZGlzbWlzc0J1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctaXRlbS1leHRlbnNpb24tZGlzbWlzcy1idXR0b24nKTtcblx0XHRkaXNtaXNzQnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ2Rpc21pc3MnLCBcIkRpc21pc3NcIik7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZTogSVNldHRpbmdFeHRlbnNpb25Ub2dnbGVJdGVtVGVtcGxhdGUgPSB7XG5cdFx0XHQuLi5jb21tb24sXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRkaXNtaXNzQnV0dG9uXG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU2V0dGluZ0VsZW1lbnRGb2N1c0hhbmRsZXIodGVtcGxhdGUpO1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG5ldmVyPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2V0dGluZ0V4dGVuc2lvblRvZ2dsZUl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlclNldHRpbmdFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlclZhbHVlKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nRXh0ZW5zaW9uVG9nZ2xlSXRlbVRlbXBsYXRlLCBvbkNoYW5nZTogKF86IHVuZGVmaW5lZCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBkYXRhRWxlbWVudC5zZXR0aW5nLmRpc3BsYXlFeHRlbnNpb25JZCE7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0ZW1wbGF0ZS5hY3Rpb25CdXR0b24ub25EaWRDbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8eyBleHRlbnNpb25JZDogU3RyaW5nIH0sIE1hbmFnZUV4dGVuc2lvbkNsaWNrVGVsZW1ldHJ5Q2xhc3NpZmljYXRpb24+KCdNYW5hZ2VFeHRlbnNpb25DbGljaycsIHsgZXh0ZW5zaW9uSWQgfSk7XG5cdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZXh0ZW5zaW9uLm9wZW4nLCBleHRlbnNpb25JZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0ZW1wbGF0ZS5kaXNtaXNzQnV0dG9uLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHsgZXh0ZW5zaW9uSWQ6IFN0cmluZyB9LCBNYW5hZ2VFeHRlbnNpb25DbGlja1RlbGVtZXRyeUNsYXNzaWZpY2F0aW9uPignRGlzbWlzc0V4dGVuc2lvbkNsaWNrJywgeyBleHRlbnNpb25JZCB9KTtcblx0XHRcdHRoaXMuX29uRGlkRGlzbWlzc0V4dGVuc2lvblNldHRpbmcuZmlyZShleHRlbnNpb25JZCk7XG5cdFx0fSkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nVHJlZVJlbmRlcmVycyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRyZWFkb25seSBvbkRpZENsaWNrT3ZlcnJpZGVFbGVtZW50OiBFdmVudDxJU2V0dGluZ092ZXJyaWRlQ2xpY2tFdmVudD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZXR0aW5nID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVNldHRpbmdDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2V0dGluZzogRXZlbnQ8SVNldHRpbmdDaGFuZ2VFdmVudD47XG5cblx0cmVhZG9ubHkgb25EaWREaXNtaXNzRXh0ZW5zaW9uU2V0dGluZzogRXZlbnQ8c3RyaW5nPjtcblxuXHRyZWFkb25seSBvbkRpZE9wZW5TZXR0aW5nczogRXZlbnQ8c3RyaW5nPjtcblxuXHRyZWFkb25seSBvbkRpZENsaWNrU2V0dGluZ0xpbms6IEV2ZW50PElTZXR0aW5nTGlua0NsaWNrRXZlbnQ+O1xuXG5cdHJlYWRvbmx5IG9uRGlkRm9jdXNTZXR0aW5nOiBFdmVudDxTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudD47XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZXR0aW5nSGVpZ2h0OiBFdmVudDxIZWlnaHRDaGFuZ2VQYXJhbXM+O1xuXG5cdHJlYWRvbmx5IG9uQXBwbHlGaWx0ZXI6IEV2ZW50PHN0cmluZz47XG5cblx0cmVhZG9ubHkgYWxsUmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPFNldHRpbmdzVHJlZUVsZW1lbnQsIG5ldmVyLCBhbnk+W107XG5cblx0cHJpdmF0ZSByZWFkb25seSBzZXR0aW5nQWN0aW9uczogSUFjdGlvbltdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnNldHRpbmdBY3Rpb25zID0gW1xuXHRcdFx0bmV3IEFjdGlvbignc2V0dGluZ3MucmVzZXRTZXR0aW5nJywgbG9jYWxpemUoJ3Jlc2V0U2V0dGluZ0xhYmVsJywgXCJSZXNldCBTZXR0aW5nXCIpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgYXN5bmMgY29udGV4dCA9PiB7XG5cdFx0XHRcdGlmIChjb250ZXh0IGluc3RhbmNlb2YgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpIHtcblx0XHRcdFx0XHRpZiAoIWNvbnRleHQuaXNVbnRydXN0ZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2V0dGluZy5maXJlKHtcblx0XHRcdFx0XHRcdFx0a2V5OiBjb250ZXh0LnNldHRpbmcua2V5LFxuXHRcdFx0XHRcdFx0XHR2YWx1ZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiBjb250ZXh0LnNldHRpbmcudHlwZSBhcyBTZXR0aW5nVmFsdWVUeXBlLFxuXHRcdFx0XHRcdFx0XHRtYW51YWxSZXNldDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0c2NvcGU6IGNvbnRleHQuc2V0dGluZy5zY29wZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvcHlTZXR0aW5nSWRBY3Rpb24pLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29weVNldHRpbmdBc0pTT05BY3Rpb24pLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29weVNldHRpbmdBc1VSTEFjdGlvbiksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdGlvbkZhY3RvcnkgPSAoc2V0dGluZzogSVNldHRpbmcsIHNldHRpbmdUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0KSA9PiB0aGlzLmdldEFjdGlvbnNGb3JTZXR0aW5nKHNldHRpbmcsIHNldHRpbmdUYXJnZXQpO1xuXHRcdGNvbnN0IGVtcHR5QWN0aW9uRmFjdG9yeSA9IChfOiBJU2V0dGluZykgPT4gW107XG5cdFx0Y29uc3QgZXh0ZW5zaW9uUmVuZGVyZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc0V4dGVuc2lvblRvZ2dsZVJlbmRlcmVyLCBbXSwgZW1wdHlBY3Rpb25GYWN0b3J5KTtcblx0XHRjb25zdCBzZXR0aW5nUmVuZGVyZXJzID0gW1xuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0Jvb2xSZW5kZXJlciwgdGhpcy5zZXR0aW5nQWN0aW9ucywgYWN0aW9uRmFjdG9yeSksXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nTnVtYmVyUmVuZGVyZXIsIHRoaXMuc2V0dGluZ0FjdGlvbnMsIGFjdGlvbkZhY3RvcnkpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0FycmF5UmVuZGVyZXIsIHRoaXMuc2V0dGluZ0FjdGlvbnMsIGFjdGlvbkZhY3RvcnkpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0NvbXBsZXhSZW5kZXJlciwgdGhpcy5zZXR0aW5nQWN0aW9ucywgYWN0aW9uRmFjdG9yeSksXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nQ29tcGxleE9iamVjdFJlbmRlcmVyLCB0aGlzLnNldHRpbmdBY3Rpb25zLCBhY3Rpb25GYWN0b3J5KSxcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdUZXh0UmVuZGVyZXIsIHRoaXMuc2V0dGluZ0FjdGlvbnMsIGFjdGlvbkZhY3RvcnkpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ011bHRpbGluZVRleHRSZW5kZXJlciwgdGhpcy5zZXR0aW5nQWN0aW9ucywgYWN0aW9uRmFjdG9yeSksXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nRXhjbHVkZVJlbmRlcmVyLCB0aGlzLnNldHRpbmdBY3Rpb25zLCBhY3Rpb25GYWN0b3J5KSxcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdJbmNsdWRlUmVuZGVyZXIsIHRoaXMuc2V0dGluZ0FjdGlvbnMsIGFjdGlvbkZhY3RvcnkpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0VudW1SZW5kZXJlciwgdGhpcy5zZXR0aW5nQWN0aW9ucywgYWN0aW9uRmFjdG9yeSksXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nT2JqZWN0UmVuZGVyZXIsIHRoaXMuc2V0dGluZ0FjdGlvbnMsIGFjdGlvbkZhY3RvcnkpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0Jvb2xPYmplY3RSZW5kZXJlciwgdGhpcy5zZXR0aW5nQWN0aW9ucywgYWN0aW9uRmFjdG9yeSksXG5cdFx0XHRleHRlbnNpb25SZW5kZXJlclxuXHRcdF07XG5cblx0XHR0aGlzLm9uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQgPSBFdmVudC5hbnkoLi4uc2V0dGluZ1JlbmRlcmVycy5tYXAociA9PiByLm9uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQpKTtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlU2V0dGluZyA9IEV2ZW50LmFueShcblx0XHRcdC4uLnNldHRpbmdSZW5kZXJlcnMubWFwKHIgPT4gci5vbkRpZENoYW5nZVNldHRpbmcpLFxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXR0aW5nLmV2ZW50XG5cdFx0KTtcblx0XHR0aGlzLm9uRGlkRGlzbWlzc0V4dGVuc2lvblNldHRpbmcgPSBleHRlbnNpb25SZW5kZXJlci5vbkRpZERpc21pc3NFeHRlbnNpb25TZXR0aW5nO1xuXHRcdHRoaXMub25EaWRPcGVuU2V0dGluZ3MgPSBFdmVudC5hbnkoLi4uc2V0dGluZ1JlbmRlcmVycy5tYXAociA9PiByLm9uRGlkT3BlblNldHRpbmdzKSk7XG5cdFx0dGhpcy5vbkRpZENsaWNrU2V0dGluZ0xpbmsgPSBFdmVudC5hbnkoLi4uc2V0dGluZ1JlbmRlcmVycy5tYXAociA9PiByLm9uRGlkQ2xpY2tTZXR0aW5nTGluaykpO1xuXHRcdHRoaXMub25EaWRGb2N1c1NldHRpbmcgPSBFdmVudC5hbnkoLi4uc2V0dGluZ1JlbmRlcmVycy5tYXAociA9PiByLm9uRGlkRm9jdXNTZXR0aW5nKSk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZVNldHRpbmdIZWlnaHQgPSBFdmVudC5hbnkoLi4uc2V0dGluZ1JlbmRlcmVycy5tYXAociA9PiByLm9uRGlkQ2hhbmdlU2V0dGluZ0hlaWdodCkpO1xuXHRcdHRoaXMub25BcHBseUZpbHRlciA9IEV2ZW50LmFueSguLi5zZXR0aW5nUmVuZGVyZXJzLm1hcChyID0+IHIub25BcHBseUZpbHRlcikpO1xuXG5cdFx0dGhpcy5hbGxSZW5kZXJlcnMgPSBbXG5cdFx0XHQuLi5zZXR0aW5nUmVuZGVyZXJzLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ0dyb3VwUmVuZGVyZXIpLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ05ld0V4dGVuc2lvbnNSZW5kZXJlciksXG5cdFx0XTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aW9uc0ZvclNldHRpbmcoc2V0dGluZzogSVNldHRpbmcsIHNldHRpbmdUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0KTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRpZiAoIShzZXR0aW5nLnNjb3BlICYmIEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyhzZXR0aW5nLnNjb3BlKSkgJiYgc2V0dGluZ1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2godGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQXBwbHlTZXR0aW5nVG9BbGxQcm9maWxlc0FjdGlvbiwgc2V0dGluZykpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkgJiYgIXNldHRpbmcuZGlzYWxsb3dTeW5jSWdub3JlKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2godGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3luY1NldHRpbmdBY3Rpb24sIHNldHRpbmcpKTtcblx0XHR9XG5cdFx0aWYgKGFjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRhY3Rpb25zLnNwbGljZSgwLCAwLCBuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdGNhbmNlbFN1Z2dlc3RlcnMoKSB7XG5cdFx0dGhpcy5fY29udGV4dFZpZXdTZXJ2aWNlLmhpZGVDb250ZXh0VmlldygpO1xuXHR9XG5cblx0c2hvd0NvbnRleHRNZW51KGVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50LCBzZXR0aW5nRE9NRWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCB0b29sYmFyRWxlbWVudCA9IHNldHRpbmdET01FbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tdG9vbGJhcicpO1xuXHRcdGlmICh0b29sYmFyRWxlbWVudCkge1xuXHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuc2V0dGluZ0FjdGlvbnMsXG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gPEhUTUxFbGVtZW50PnRvb2xiYXJFbGVtZW50LFxuXHRcdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gZWxlbWVudFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0U2V0dGluZ0RPTUVsZW1lbnRGb3JET01FbGVtZW50KGRvbUVsZW1lbnQ6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHRjb25zdCBwYXJlbnQgPSBET00uZmluZFBhcmVudFdpdGhDbGFzcyhkb21FbGVtZW50LCBBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5DT05URU5UU19DTEFTUyk7XG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0cmV0dXJuIHBhcmVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGdldERPTUVsZW1lbnRzRm9yU2V0dGluZ0tleSh0cmVlQ29udGFpbmVyOiBIVE1MRWxlbWVudCwga2V5OiBzdHJpbmcpOiBOb2RlTGlzdE9mPEhUTUxFbGVtZW50PiB7XG5cdFx0cmV0dXJuIHRyZWVDb250YWluZXIucXVlcnlTZWxlY3RvckFsbChgWyR7QWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuU0VUVElOR19LRVlfQVRUUn09XCIke2tleX1cIl1gKTtcblx0fVxuXG5cdGdldEtleUZvckRPTUVsZW1lbnRJblNldHRpbmcoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBzZXR0aW5nRWxlbWVudCA9IHRoaXMuZ2V0U2V0dGluZ0RPTUVsZW1lbnRGb3JET01FbGVtZW50KGVsZW1lbnQpO1xuXHRcdHJldHVybiBzZXR0aW5nRWxlbWVudCAmJiBzZXR0aW5nRWxlbWVudC5nZXRBdHRyaWJ1dGUoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuU0VUVElOR19LRVlfQVRUUik7XG5cdH1cblxuXHRnZXRJZEZvckRPTUVsZW1lbnRJblNldHRpbmcoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBzZXR0aW5nRWxlbWVudCA9IHRoaXMuZ2V0U2V0dGluZ0RPTUVsZW1lbnRGb3JET01FbGVtZW50KGVsZW1lbnQpO1xuXHRcdHJldHVybiBzZXR0aW5nRWxlbWVudCAmJiBzZXR0aW5nRWxlbWVudC5nZXRBdHRyaWJ1dGUoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuU0VUVElOR19JRF9BVFRSKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuc2V0dGluZ0FjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4ge1xuXHRcdFx0aWYgKGlzRGlzcG9zYWJsZShhY3Rpb24pKSB7XG5cdFx0XHRcdGFjdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5hbGxSZW5kZXJlcnMuZm9yRWFjaChyZW5kZXJlciA9PiB7XG5cdFx0XHRpZiAoaXNEaXNwb3NhYmxlKHJlbmRlcmVyKSkge1xuXHRcdFx0XHRyZW5kZXJlci5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSBhbmQgcmVuZGVyIGFueSBlcnJvciBtZXNzYWdlLiBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIGlzIGludmFsaWQuXG4gKi9cbmZ1bmN0aW9uIHJlbmRlclZhbGlkYXRpb25zKGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCwgdGVtcGxhdGU6IElTZXR0aW5nVGV4dEl0ZW1UZW1wbGF0ZSwgY2FsbGVkT25TdGFydHVwOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdGlmIChkYXRhRWxlbWVudC5zZXR0aW5nLnZhbGlkYXRvcikge1xuXHRcdGNvbnN0IGVyck1zZyA9IGRhdGFFbGVtZW50LnNldHRpbmcudmFsaWRhdG9yKHRlbXBsYXRlLmlucHV0Qm94LnZhbHVlKTtcblx0XHRpZiAoZXJyTXNnKSB7XG5cdFx0XHR0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdHRlbXBsYXRlLnZhbGlkYXRpb25FcnJvck1lc3NhZ2VFbGVtZW50LmlubmVyVGV4dCA9IGVyck1zZztcblx0XHRcdGNvbnN0IHZhbGlkYXRpb25FcnJvciA9IGxvY2FsaXplKCd2YWxpZGF0aW9uRXJyb3InLCBcIlZhbGlkYXRpb24gRXJyb3IuXCIpO1xuXHRcdFx0dGVtcGxhdGUuaW5wdXRCb3guaW5wdXRFbGVtZW50LnBhcmVudEVsZW1lbnQhLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIFt2YWxpZGF0aW9uRXJyb3IsIGVyck1zZ10uam9pbignICcpKTtcblx0XHRcdGlmICghY2FsbGVkT25TdGFydHVwKSB7IGFyaWEuc3RhdHVzKHZhbGlkYXRpb25FcnJvciArICcgJyArIGVyck1zZyk7IH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZS5pbnB1dEJveC5pbnB1dEVsZW1lbnQucGFyZW50RWxlbWVudCEucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG5cdFx0fVxuXHR9XG5cdHRlbXBsYXRlLmNvbnRhaW5lckVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW52YWxpZC1pbnB1dCcpO1xuXHRyZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogVmFsaWRhdGUgYW5kIHJlbmRlciBhbnkgZXJyb3IgbWVzc2FnZSBmb3IgYXJyYXlzLiBSZXR1cm5zIHRydWUgaWYgdGhlIHZhbHVlIGlzIGludmFsaWQuXG4gKi9cbmZ1bmN0aW9uIHJlbmRlckFycmF5VmFsaWRhdGlvbnMoXG5cdGRhdGFFbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCxcblx0dGVtcGxhdGU6IElTZXR0aW5nTGlzdEl0ZW1UZW1wbGF0ZSB8IElTZXR0aW5nT2JqZWN0SXRlbVRlbXBsYXRlLFxuXHR2YWx1ZTogc3RyaW5nW10gfCBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCxcblx0Y2FsbGVkT25TdGFydHVwOiBib29sZWFuXG4pOiBib29sZWFuIHtcblx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpbnZhbGlkLWlucHV0Jyk7XG5cdGlmIChkYXRhRWxlbWVudC5zZXR0aW5nLnZhbGlkYXRvcikge1xuXHRcdGNvbnN0IGVyck1zZyA9IGRhdGFFbGVtZW50LnNldHRpbmcudmFsaWRhdG9yKHZhbHVlKTtcblx0XHRpZiAoZXJyTXNnICYmIGVyck1zZyAhPT0gJycpIHtcblx0XHRcdHRlbXBsYXRlLmNvbnRhaW5lckVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0dGVtcGxhdGUudmFsaWRhdGlvbkVycm9yTWVzc2FnZUVsZW1lbnQuaW5uZXJUZXh0ID0gZXJyTXNnO1xuXHRcdFx0Y29uc3QgdmFsaWRhdGlvbkVycm9yID0gbG9jYWxpemUoJ3ZhbGlkYXRpb25FcnJvcicsIFwiVmFsaWRhdGlvbiBFcnJvci5cIik7XG5cdFx0XHR0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIFtkYXRhRWxlbWVudC5zZXR0aW5nLmtleSwgdmFsaWRhdGlvbkVycm9yLCBlcnJNc2ddLmpvaW4oJyAnKSk7XG5cdFx0XHRpZiAoIWNhbGxlZE9uU3RhcnR1cCkgeyBhcmlhLnN0YXR1cyh2YWxpZGF0aW9uRXJyb3IgKyAnICcgKyBlcnJNc2cpOyB9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGUuY29udGFpbmVyRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBkYXRhRWxlbWVudC5zZXR0aW5nLmtleSk7XG5cdFx0XHR0ZW1wbGF0ZS5jb250YWluZXJFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBjbGVhblJlbmRlcmVkTWFya2Rvd24oZWxlbWVudDogTm9kZSk6IHZvaWQge1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNoaWxkID0gZWxlbWVudC5jaGlsZE5vZGVzLml0ZW0oaSk7XG5cblx0XHRjb25zdCB0YWdOYW1lID0gKDxFbGVtZW50PmNoaWxkKS50YWdOYW1lICYmICg8RWxlbWVudD5jaGlsZCkudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdGlmICh0YWdOYW1lID09PSAnaW1nJykge1xuXHRcdFx0Y2hpbGQucmVtb3ZlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNsZWFuUmVuZGVyZWRNYXJrZG93bihjaGlsZCk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGZpeFNldHRpbmdMaW5rcyh0ZXh0OiBzdHJpbmcsIGxpbmtpZnkgPSB0cnVlKTogc3RyaW5nIHtcblx0cmV0dXJuIHRleHQucmVwbGFjZSgvYCMoW14jXFxzYF0rKSNgfCcjKFteI1xccyddKykjJy9nLCAobWF0Y2gsIGJhY2t0aWNrc0dyb3VwLCBxdW90ZXNHcm91cCkgPT4ge1xuXHRcdGNvbnN0IHNldHRpbmdLZXk6IHN0cmluZyA9IGJhY2t0aWNrc0dyb3VwID8/IHF1b3Rlc0dyb3VwO1xuXHRcdGNvbnN0IHRhcmdldERpc3BsYXlGb3JtYXQgPSBzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KHNldHRpbmdLZXkpO1xuXHRcdGNvbnN0IHRhcmdldE5hbWUgPSBgJHt0YXJnZXREaXNwbGF5Rm9ybWF0LmNhdGVnb3J5fTogJHt0YXJnZXREaXNwbGF5Rm9ybWF0LmxhYmVsfWA7XG5cdFx0cmV0dXJuIGxpbmtpZnkgP1xuXHRcdFx0YFske3RhcmdldE5hbWV9XSgjJHtzZXR0aW5nS2V5fSBcIiR7c2V0dGluZ0tleX1cIilgIDpcblx0XHRcdGBcIiR7dGFyZ2V0TmFtZX1cImA7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVJbnZpc2libGVDaGFycyhlbnVtVmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBlbnVtVmFsdWUgJiYgZW51bVZhbHVlXG5cdFx0LnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuXHRcdC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJyk7XG59XG5cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVHJlZUZpbHRlciBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPFNldHRpbmdzVHJlZUVsZW1lbnQ+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB2aWV3U3RhdGU6IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0KSB7IH1cblxuXHRmaWx0ZXIoZWxlbWVudDogU2V0dGluZ3NUcmVlRWxlbWVudCwgcGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHkpOiBUcmVlRmlsdGVyUmVzdWx0PHZvaWQ+IHtcblx0XHQvLyBGaWx0ZXIgZHVyaW5nIHNlYXJjaFxuXHRcdGlmICh0aGlzLnZpZXdTdGF0ZS5maWx0ZXJUb0NhdGVnb3J5ICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCkge1xuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdDb250YWluZWRJbkdyb3VwKGVsZW1lbnQuc2V0dGluZywgdGhpcy52aWV3U3RhdGUuZmlsdGVyVG9DYXRlZ29yeSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE5vbi11c2VyIHNjb3BlIHNlbGVjdGVkXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCAmJiB0aGlzLnZpZXdTdGF0ZS5zZXR0aW5nc1RhcmdldCAhPT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSB7XG5cdFx0XHRjb25zdCBpc1JlbW90ZSA9ICEhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdFx0aWYgKCFlbGVtZW50Lm1hdGNoZXNTY29wZSh0aGlzLnZpZXdTdGF0ZS5zZXR0aW5nc1RhcmdldCwgaXNSZW1vdGUpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBHcm91cCB3aXRoIG5vIHZpc2libGUgY2hpbGRyZW5cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCkge1xuXHRcdFx0aWYgKHR5cGVvZiBlbGVtZW50LmNvdW50ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5jb3VudCA+IDA7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlO1xuXHRcdH1cblxuXHRcdC8vIEZpbHRlcmVkIFwibmV3IGV4dGVuc2lvbnNcIiBidXR0b25cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZU5ld0V4dGVuc2lvbnNFbGVtZW50KSB7XG5cdFx0XHRpZiAodGhpcy52aWV3U3RhdGUudGFnRmlsdGVycz8uc2l6ZSB8fCB0aGlzLnZpZXdTdGF0ZS5maWx0ZXJUb0NhdGVnb3J5KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0dGluZ0NvbnRhaW5lZEluR3JvdXAoc2V0dGluZzogSVNldHRpbmcsIGdyb3VwOiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZ3JvdXAuY2hpbGRyZW4uc29tZShjaGlsZCA9PiB7XG5cdFx0XHRpZiAoY2hpbGQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0dGluZ0NvbnRhaW5lZEluR3JvdXAoc2V0dGluZywgY2hpbGQpO1xuXHRcdFx0fSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybiBjaGlsZC5zZXR0aW5nLmtleSA9PT0gc2V0dGluZy5rZXk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ3NUcmVlRGVsZWdhdGUgZXh0ZW5kcyBDYWNoZWRMaXN0VmlydHVhbERlbGVnYXRlPFNldHRpbmdzVHJlZUdyb3VwQ2hpbGQ+IHtcblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCB8IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50IHwgU2V0dGluZ3NUcmVlTmV3RXh0ZW5zaW9uc0VsZW1lbnQpOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gU0VUVElOR1NfRUxFTUVOVF9URU1QTEFURV9JRDtcblx0XHR9XG5cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KSB7XG5cdFx0XHRpZiAoZWxlbWVudC52YWx1ZVR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuRXh0ZW5zaW9uVG9nZ2xlKSB7XG5cdFx0XHRcdHJldHVybiBTRVRUSU5HU19FWFRFTlNJT05fVE9HR0xFX1RFTVBMQVRFX0lEO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbnZhbGlkVHlwZUVycm9yID0gZWxlbWVudC5pc0NvbmZpZ3VyZWQgJiYgZ2V0SW52YWxpZFR5cGVFcnJvcihlbGVtZW50LnZhbHVlLCBlbGVtZW50LnNldHRpbmcudHlwZSk7XG5cdFx0XHRpZiAoaW52YWxpZFR5cGVFcnJvcikge1xuXHRcdFx0XHRyZXR1cm4gU0VUVElOR1NfQ09NUExFWF9URU1QTEFURV9JRDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVsZW1lbnQudmFsdWVUeXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLkJvb2xlYW4pIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX0JPT0xfVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5JbnRlZ2VyIHx8XG5cdFx0XHRcdGVsZW1lbnQudmFsdWVUeXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLk51bWJlciB8fFxuXHRcdFx0XHRlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5OdWxsYWJsZUludGVnZXIgfHxcblx0XHRcdFx0ZWxlbWVudC52YWx1ZVR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuTnVsbGFibGVOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX05VTUJFUl9URU1QTEFURV9JRDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVsZW1lbnQudmFsdWVUeXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLk11bHRpbGluZVN0cmluZykge1xuXHRcdFx0XHRyZXR1cm4gU0VUVElOR1NfTVVMVElMSU5FX1RFWFRfVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5TdHJpbmcpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX1RFWFRfVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5FbnVtKSB7XG5cdFx0XHRcdHJldHVybiBTRVRUSU5HU19FTlVNX1RFTVBMQVRFX0lEO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWxlbWVudC52YWx1ZVR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuQXJyYXkpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX0FSUkFZX1RFTVBMQVRFX0lEO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWxlbWVudC52YWx1ZVR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuRXhjbHVkZSkge1xuXHRcdFx0XHRyZXR1cm4gU0VUVElOR1NfRVhDTFVERV9URU1QTEFURV9JRDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVsZW1lbnQudmFsdWVUeXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLkluY2x1ZGUpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX0lOQ0xVREVfVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5PYmplY3QpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX09CSkVDVF9URU1QTEFURV9JRDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVsZW1lbnQudmFsdWVUeXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLkJvb2xlYW5PYmplY3QpIHtcblx0XHRcdFx0cmV0dXJuIFNFVFRJTkdTX0JPT0xfT0JKRUNUX1RFTVBMQVRFX0lEO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWxlbWVudC52YWx1ZVR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuQ29tcGxleE9iamVjdCkge1xuXHRcdFx0XHRyZXR1cm4gU0VUVElOR1NfQ09NUExFWF9PQkpFQ1RfVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5MYW5ndWFnZVRhZykge1xuXHRcdFx0XHRyZXR1cm4gU0VUVElOR1NfQ09NUExFWF9URU1QTEFURV9JRDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFNFVFRJTkdTX0NPTVBMRVhfVEVNUExBVEVfSUQ7XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVOZXdFeHRlbnNpb25zRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFNFVFRJTkdTX05FV19FWFRFTlNJT05TX1RFTVBMQVRFX0lEO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcigndW5rbm93biBlbGVtZW50IHR5cGU6ICcgKyBlbGVtZW50KTtcblx0fVxuXG5cdGhhc0R5bmFtaWNIZWlnaHQoZWxlbWVudDogU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50IHwgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQgfCBTZXR0aW5nc1RyZWVOZXdFeHRlbnNpb25zRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhKGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGVzdGltYXRlSGVpZ2h0KGVsZW1lbnQ6IFNldHRpbmdzVHJlZUdyb3VwQ2hpbGQpOiBudW1iZXIge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gNDI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCAmJiBlbGVtZW50LnZhbHVlVHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5Cb29sZWFuID8gNzggOiAxMDQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vbkNvbGxhcHNpYmxlT2JqZWN0VHJlZU1vZGVsPFQ+IGV4dGVuZHMgT2JqZWN0VHJlZU1vZGVsPFQ+IHtcblx0b3ZlcnJpZGUgaXNDb2xsYXBzaWJsZShlbGVtZW50OiBUKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0Q29sbGFwc2VkKGVsZW1lbnQ6IFQsIGNvbGxhcHNlZD86IGJvb2xlYW4sIHJlY3Vyc2l2ZT86IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ3NUcmVlQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8U2V0dGluZ3NUcmVlRWxlbWVudD4ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UsIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLCBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpIHtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBTZXR0aW5nc1RyZWVFbGVtZW50KSB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCkge1xuXHRcdFx0Y29uc3QgYXJpYUxhYmVsU2VjdGlvbnM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGAke2VsZW1lbnQuZGlzcGxheUNhdGVnb3J5fSAke2VsZW1lbnQuZGlzcGxheUxhYmVsfS5gKTtcblxuXHRcdFx0aWYgKGVsZW1lbnQuaXNDb25maWd1cmVkKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGlmaWVkVGV4dCA9IGxvY2FsaXplKCdzZXR0aW5ncy5Nb2RpZmllZCcsICdNb2RpZmllZC4nKTtcblx0XHRcdFx0YXJpYUxhYmVsU2VjdGlvbnMucHVzaChtb2RpZmllZFRleHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbmRpY2F0b3JzTGFiZWxBcmlhTGFiZWwgPSBnZXRJbmRpY2F0b3JzTGFiZWxBcmlhTGFiZWwoZWxlbWVudCwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UpO1xuXHRcdFx0aWYgKGluZGljYXRvcnNMYWJlbEFyaWFMYWJlbC5sZW5ndGgpIHtcblx0XHRcdFx0YXJpYUxhYmVsU2VjdGlvbnMucHVzaChgJHtpbmRpY2F0b3JzTGFiZWxBcmlhTGFiZWx9LmApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZXNjcmlwdGlvbldpdGhvdXRTZXR0aW5nTGlua3MgPSByZW5kZXJNYXJrZG93bkFzUGxhaW50ZXh0KHsgdmFsdWU6IGZpeFNldHRpbmdMaW5rcyhlbGVtZW50LmRlc2NyaXB0aW9uLCBmYWxzZSkgfSk7XG5cdFx0XHRpZiAoZGVzY3JpcHRpb25XaXRob3V0U2V0dGluZ0xpbmtzLmxlbmd0aCkge1xuXHRcdFx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGRlc2NyaXB0aW9uV2l0aG91dFNldHRpbmdMaW5rcyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXJpYUxhYmVsU2VjdGlvbnMuam9pbignICcpO1xuXHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQubGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmlkO1xuXHRcdH1cblx0fVxuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ3NldHRpbmdzJywgXCJTZXR0aW5nc1wiKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUcmVlIGV4dGVuZHMgV29ya2JlbmNoT2JqZWN0VHJlZTxTZXR0aW5nc1RyZWVFbGVtZW50PiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0dmlld1N0YXRlOiBJU2V0dGluZ3NFZGl0b3JWaWV3U3RhdGUsXG5cdFx0cmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPGFueSwgdm9pZCwgYW55PltdLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxpc3RTZXJ2aWNlIGxpc3RTZXJ2aWNlOiBJTGlzdFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCdTZXR0aW5nc1RyZWUnLCBjb250YWluZXIsXG5cdFx0XHRuZXcgU2V0dGluZ3NUcmVlRGVsZWdhdGUoKSxcblx0XHRcdHJlbmRlcmVycyxcblx0XHRcdHtcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRcdHN1cHBvcnREeW5hbWljSGVpZ2h0czogdHJ1ZSxcblx0XHRcdFx0c2Nyb2xsVG9BY3RpdmVFbGVtZW50OiB0cnVlLFxuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0SWQoZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGUuaWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IG5ldyBTZXR0aW5nc1RyZWVBY2Nlc3NpYmlsaXR5UHJvdmlkZXIoY29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLFxuXHRcdFx0XHRzdHlsZUNvbnRyb2xsZXI6IGlkID0+IG5ldyBEZWZhdWx0U3R5bGVDb250cm9sbGVyKGRvbVN0eWxlc2hlZXRzSnMuY3JlYXRlU3R5bGVTaGVldChjb250YWluZXIpLCBpZCksXG5cdFx0XHRcdGZpbHRlcjogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NUcmVlRmlsdGVyLCB2aWV3U3RhdGUpLFxuXHRcdFx0XHRzbW9vdGhTY3JvbGxpbmc6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCd3b3JrYmVuY2gubGlzdC5zbW9vdGhTY3JvbGxpbmcnKSxcblx0XHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdFx0ZmluZFdpZGdldEVuYWJsZWQ6IGZhbHNlLFxuXHRcdFx0XHRyZW5kZXJJbmRlbnRHdWlkZXM6IFJlbmRlckluZGVudEd1aWRlcy5Ob25lLFxuXHRcdFx0XHR0cmFuc2Zvcm1PcHRpbWl6YXRpb246IGZhbHNlIC8vIERpc2FibGUgdHJhbnNmb3JtIG9wdGltaXphdGlvbiAjMTc3NDcwXG5cdFx0XHR9LFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGxpc3RTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0KTtcblxuXHRcdHRoaXMuZ2V0SFRNTEVsZW1lbnQoKS5jbGFzc0xpc3QuYWRkKCdzZXR0aW5ncy1lZGl0b3ItdHJlZScpO1xuXG5cdFx0dGhpcy5zdHlsZShnZXRMaXN0U3R5bGVzKHtcblx0XHRcdGxpc3RCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRcdFx0bGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmQsXG5cdFx0XHRsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdGxpc3RGb2N1c0FuZFNlbGVjdGlvbkJhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmQsXG5cdFx0XHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25Gb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRcdFx0bGlzdEZvY3VzQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdGxpc3RGb2N1c0ZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRsaXN0SG92ZXJGb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRcdFx0bGlzdEhvdmVyQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdGxpc3RIb3Zlck91dGxpbmU6IGVkaXRvckJhY2tncm91bmQsXG5cdFx0XHRsaXN0Rm9jdXNPdXRsaW5lOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRcdFx0bGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmQsXG5cdFx0XHRsaXN0SW5hY3RpdmVGb2N1c091dGxpbmU6IGVkaXRvckJhY2tncm91bmQsXG5cdFx0XHR0cmVlSW5kZW50R3VpZGVzU3Ryb2tlOiB1bmRlZmluZWQsXG5cdFx0XHR0cmVlSW5hY3RpdmVJbmRlbnRHdWlkZXNTdHJva2U6IHVuZGVmaW5lZCxcblx0XHR9KSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignd29ya2JlbmNoLmxpc3Quc21vb3RoU2Nyb2xsaW5nJykpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0XHRzbW9vdGhTY3JvbGxpbmc6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCd3b3JrYmVuY2gubGlzdC5zbW9vdGhTY3JvbGxpbmcnKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlTW9kZWwodXNlcjogc3RyaW5nLCBvcHRpb25zOiBJT2JqZWN0VHJlZU9wdGlvbnM8U2V0dGluZ3NUcmVlR3JvdXBDaGlsZD4pOiBJVHJlZU1vZGVsPFNldHRpbmdzVHJlZUdyb3VwQ2hpbGQgfCBudWxsLCB2b2lkLCBTZXR0aW5nc1RyZWVHcm91cENoaWxkIHwgbnVsbD4ge1xuXHRcdHJldHVybiBuZXcgTm9uQ29sbGFwc2libGVPYmplY3RUcmVlTW9kZWw8U2V0dGluZ3NUcmVlR3JvdXBDaGlsZD4odXNlciwgb3B0aW9ucyk7XG5cdH1cbn1cblxuY2xhc3MgQ29weVNldHRpbmdJZEFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdzZXR0aW5ncy5jb3B5U2V0dGluZ0lkJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2NvcHlTZXR0aW5nSWRMYWJlbCcsIFwiQ29weSBTZXR0aW5nIElEXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKENvcHlTZXR0aW5nSWRBY3Rpb24uSUQsIENvcHlTZXR0aW5nSWRBY3Rpb24uTEFCRUwpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGNvbnRleHQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGNvbnRleHQpIHtcblx0XHRcdGF3YWl0IHRoaXMuY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoY29udGV4dC5zZXR0aW5nLmtleSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG59XG5cbmNsYXNzIENvcHlTZXR0aW5nQXNKU09OQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3NldHRpbmdzLmNvcHlTZXR0aW5nQXNKU09OJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2NvcHlTZXR0aW5nQXNKU09OTGFiZWwnLCBcIkNvcHkgU2V0dGluZyBhcyBKU09OXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKENvcHlTZXR0aW5nQXNKU09OQWN0aW9uLklELCBDb3B5U2V0dGluZ0FzSlNPTkFjdGlvbi5MQUJFTCk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oY29udGV4dDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0Y29uc3QganNvblJlc3VsdCA9IGBcIiR7Y29udGV4dC5zZXR0aW5nLmtleX1cIjogJHtKU09OLnN0cmluZ2lmeShjb250ZXh0LnZhbHVlLCB1bmRlZmluZWQsICcgICcpfWA7XG5cdFx0XHRhd2FpdCB0aGlzLmNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGpzb25SZXN1bHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxufVxuXG5jbGFzcyBDb3B5U2V0dGluZ0FzVVJMQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3NldHRpbmdzLmNvcHlTZXR0aW5nQXNVUkwnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnY29weVNldHRpbmdBc1VSTExhYmVsJywgXCJDb3B5IFNldHRpbmcgYXMgVVJMXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihDb3B5U2V0dGluZ0FzVVJMQWN0aW9uLklELCBDb3B5U2V0dGluZ0FzVVJMQWN0aW9uLkxBQkVMKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihjb250ZXh0OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChjb250ZXh0KSB7XG5cdFx0XHRjb25zdCBzZXR0aW5nS2V5ID0gY29udGV4dC5zZXR0aW5nLmtleTtcblx0XHRcdGNvbnN0IHByb2R1Y3QgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLnVybFByb3RvY29sO1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IHByb2R1Y3QsIGF1dGhvcml0eTogU0VUVElOR1NfQVVUSE9SSVRZLCBwYXRoOiBgLyR7c2V0dGluZ0tleX1gIH0sIHRydWUpO1xuXHRcdFx0YXdhaXQgdGhpcy5jbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dCh1cmkudG9TdHJpbmcoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG59XG5cbmNsYXNzIFN5bmNTZXR0aW5nQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3NldHRpbmdzLnN0b3BTeW5jaW5nU2V0dGluZyc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdzdG9wU3luY2luZ1NldHRpbmcnLCBcIlN5bmMgVGhpcyBTZXR0aW5nXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2V0dGluZzogSVNldHRpbmcsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoU3luY1NldHRpbmdBY3Rpb24uSUQsIFN5bmNTZXR0aW5nQWN0aW9uLkxBQkVMKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIoY29uZmlnU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2V0dGluZ3NTeW5jLmlnbm9yZWRTZXR0aW5ncycpKSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZSgpIHtcblx0XHRjb25zdCBpZ25vcmVkU2V0dGluZ3MgPSBnZXRJZ25vcmVkU2V0dGluZ3MoZ2V0RGVmYXVsdElnbm9yZWRTZXR0aW5ncygpLCB0aGlzLmNvbmZpZ1NlcnZpY2UpO1xuXHRcdHRoaXMuY2hlY2tlZCA9ICFpZ25vcmVkU2V0dGluZ3MuaW5jbHVkZXModGhpcy5zZXR0aW5nLmtleSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gZmlyc3QgcmVtb3ZlIHRoZSBjdXJyZW50IHNldHRpbmcgY29tcGxldGVseSBmcm9tIGlnbm9yZWQgc2V0dGluZ3Ncblx0XHRsZXQgY3VycmVudFZhbHVlID0gWy4uLnRoaXMuY29uZmlnU2VydmljZS5nZXRWYWx1ZTxzdHJpbmdbXT4oJ3NldHRpbmdzU3luYy5pZ25vcmVkU2V0dGluZ3MnKV07XG5cdFx0Y3VycmVudFZhbHVlID0gY3VycmVudFZhbHVlLmZpbHRlcih2ID0+IHYgIT09IHRoaXMuc2V0dGluZy5rZXkgJiYgdiAhPT0gYC0ke3RoaXMuc2V0dGluZy5rZXl9YCk7XG5cblx0XHRjb25zdCBkZWZhdWx0SWdub3JlZFNldHRpbmdzID0gZ2V0RGVmYXVsdElnbm9yZWRTZXR0aW5ncygpO1xuXHRcdGNvbnN0IGlzRGVmYXVsdElnbm9yZWQgPSBkZWZhdWx0SWdub3JlZFNldHRpbmdzLmluY2x1ZGVzKHRoaXMuc2V0dGluZy5rZXkpO1xuXHRcdGNvbnN0IGFza2VkVG9TeW5jID0gIXRoaXMuY2hlY2tlZDtcblxuXHRcdC8vIElmIGFza2VkIHRvIHN5bmMsIHRoZW4gYWRkIG9ubHkgaWYgaXQgaXMgaWdub3JlZCBieSBkZWZhdWx0XG5cdFx0aWYgKGFza2VkVG9TeW5jICYmIGlzRGVmYXVsdElnbm9yZWQpIHtcblx0XHRcdGN1cnJlbnRWYWx1ZS5wdXNoKGAtJHt0aGlzLnNldHRpbmcua2V5fWApO1xuXHRcdH1cblxuXHRcdC8vIElmIGFza2VkIG5vdCB0byBzeW5jLCB0aGVuIGFkZCBvbmx5IGlmIGl0IGlzIG5vdCBpZ25vcmVkIGJ5IGRlZmF1bHRcblx0XHRpZiAoIWFza2VkVG9TeW5jICYmICFpc0RlZmF1bHRJZ25vcmVkKSB7XG5cdFx0XHRjdXJyZW50VmFsdWUucHVzaCh0aGlzLnNldHRpbmcua2V5KTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbmZpZ1NlcnZpY2UudXBkYXRlVmFsdWUoJ3NldHRpbmdzU3luYy5pZ25vcmVkU2V0dGluZ3MnLCBjdXJyZW50VmFsdWUubGVuZ3RoID8gY3VycmVudFZhbHVlIDogdW5kZWZpbmVkLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cbn1cblxuY2xhc3MgQXBwbHlTZXR0aW5nVG9BbGxQcm9maWxlc0FjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdzZXR0aW5ncy5hcHBseVRvQWxsUHJvZmlsZXMnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnYXBwbHlUb0FsbFByb2ZpbGVzJywgXCJBcHBseSBTZXR0aW5nIHRvIGFsbCBQcm9maWxlc1wiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNldHRpbmc6IElTZXR0aW5nLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWdTZXJ2aWNlOiBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKEFwcGx5U2V0dGluZ1RvQWxsUHJvZmlsZXNBY3Rpb24uSUQsIEFwcGx5U2V0dGluZ1RvQWxsUHJvZmlsZXNBY3Rpb24uTEFCRUwpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcihjb25maWdTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgZSA9PiBlLmFmZmVjdHNDb25maWd1cmF0aW9uKEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HKSkoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKSB7XG5cdFx0Y29uc3QgYWxsUHJvZmlsZXNTZXR0aW5ncyA9IHRoaXMuY29uZmlnU2VydmljZS5nZXRWYWx1ZTxzdHJpbmdbXT4oQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcpO1xuXHRcdHRoaXMuY2hlY2tlZCA9IGFsbFByb2ZpbGVzU2V0dGluZ3MuaW5jbHVkZXModGhpcy5zZXR0aW5nLmtleSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gZmlyc3QgcmVtb3ZlIHRoZSBjdXJyZW50IHNldHRpbmcgY29tcGxldGVseSBmcm9tIGlnbm9yZWQgc2V0dGluZ3Ncblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuY29uZmlnU2VydmljZS5nZXRWYWx1ZTxzdHJpbmdbXT4oQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcpID8/IFtdO1xuXG5cdFx0aWYgKHRoaXMuY2hlY2tlZCkge1xuXHRcdFx0dmFsdWUuc3BsaWNlKHZhbHVlLmluZGV4T2YodGhpcy5zZXR0aW5nLmtleSksIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YWx1ZS5wdXNoKHRoaXMuc2V0dGluZy5rZXkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld1ZhbHVlID0gZGlzdGluY3QodmFsdWUpO1xuXHRcdGlmICh0aGlzLmNoZWNrZWQpIHtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlnU2VydmljZS51cGRhdGVWYWx1ZSh0aGlzLnNldHRpbmcua2V5LCB0aGlzLmNvbmZpZ1NlcnZpY2UuaW5zcGVjdCh0aGlzLnNldHRpbmcua2V5KS5hcHBsaWNhdGlvbj8udmFsdWUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCk7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ1NlcnZpY2UudXBkYXRlVmFsdWUoQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcsIG5ld1ZhbHVlLmxlbmd0aCA/IG5ld1ZhbHVlIDogdW5kZWZpbmVkLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ1NlcnZpY2UudXBkYXRlVmFsdWUoQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcsIG5ld1ZhbHVlLmxlbmd0aCA/IG5ld1ZhbHVlIDogdW5kZWZpbmVkLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpO1xuXHRcdFx0YXdhaXQgdGhpcy5jb25maWdTZXJ2aWNlLnVwZGF0ZVZhbHVlKHRoaXMuc2V0dGluZy5rZXksIHRoaXMuY29uZmlnU2VydmljZS5pbnNwZWN0KHRoaXMuc2V0dGluZy5rZXkpLnVzZXJMb2NhbD8udmFsdWUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCk7XG5cdFx0fVxuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1QkFBdUI7QUFDaEMsWUFBWSxTQUFTO0FBQ3JCLFlBQVksc0JBQXNCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUNBQWlDO0FBRTFDLFlBQVksVUFBVTtBQUN0QixTQUFTLGNBQWM7QUFDdkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBd0IsZ0JBQWdCO0FBQ3hDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsOEJBQTBEO0FBQ25FLFNBQTRCLGlCQUFpQjtBQUM3QyxTQUFTLFFBQVEsNEJBQTRCO0FBQzdDLFNBQVMsZUFBZTtBQUN4QixTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUE4RSxz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
