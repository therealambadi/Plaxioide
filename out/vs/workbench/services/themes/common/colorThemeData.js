import { basename } from "../../../../base/common/path.js";
import * as Json from "../../../../base/common/json.js";
import { Color } from "../../../../base/common/color.js";
import { ExtensionData, THEME_SCOPE_CLOSE_PAREN, THEME_SCOPE_OPEN_PAREN, themeScopeRegex, THEME_SCOPE_WILDCARD } from "./workbenchThemeService.js";
import { convertSettings } from "./themeCompatibility.js";
import * as nls from "../../../../nls.js";
import * as types from "../../../../base/common/types.js";
import * as resources from "../../../../base/common/resources.js";
import { Extensions as ColorRegistryExtensions, editorBackground, editorForeground, DEFAULT_COLOR_CONFIG_VALUE } from "../../../../platform/theme/common/colorRegistry.js";
import { getThemeTypeSelector } from "../../../../platform/theme/common/themeService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { getParseErrorMessage } from "../../../../base/common/jsonErrorMessages.js";
import { parse as parsePList } from "./plistParser.js";
import { TokenStyle, SemanticTokenRule, getTokenClassificationRegistry, parseClassifierString } from "../../../../platform/theme/common/tokenClassificationRegistry.js";
import { createMatchers } from "./textMateScopeMatcher.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ColorScheme, ThemeTypeSelector } from "../../../../platform/theme/common/theme.js";
import { ColorId, FontStyle, MetadataConsts } from "../../../../editor/common/encodedTokenAttributes.js";
import { toStandardTokenType } from "../../../../editor/common/languages/supports/tokenization.js";
const colorRegistry = Registry.as(ColorRegistryExtensions.ColorContribution);
const tokenClassificationRegistry = getTokenClassificationRegistry();
const tokenGroupToScopesMap = {
  comments: ["comment", "punctuation.definition.comment"],
  strings: ["string", "meta.embedded.assembly"],
  keywords: ["keyword - keyword.operator", "keyword.control", "storage", "storage.type"],
  numbers: ["constant.numeric"],
  types: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
  functions: ["entity.name.function", "support.function"],
  variables: ["variable", "entity.name.variable"]
};
const _ColorThemeData = class _ColorThemeData {
  // created on demand
  constructor(id, label, settingsId) {
    this.themeTokenColors = [];
    this.customTokenColors = [];
    this.colorMap = {};
    this.customColorMap = {};
    this.semanticTokenRules = [];
    this.customSemanticTokenRules = [];
    this.textMateThemingRules = void 0;
    // created on demand
    this.tokenColorIndex = void 0;
    this.id = id;
    this.label = label;
    this.settingsId = settingsId;
    this.isLoaded = false;
  }
  get semanticHighlighting() {
    if (this.customSemanticHighlighting !== void 0) {
      return this.customSemanticHighlighting;
    }
    if (this.customSemanticHighlightingDeprecated !== void 0) {
      return this.customSemanticHighlightingDeprecated;
    }
    return !!this.themeSemanticHighlighting;
  }
  get tokenColors() {
    if (!this.textMateThemingRules) {
      let addRule2 = function(rule) {
        if (rule.scope && rule.settings) {
          if (rule.scope === "token.info-token") {
            hasDefaultTokens = true;
          }
          result.push({ scope: rule.scope, settings: { foreground: normalizeColor(rule.settings.foreground), background: normalizeColor(rule.settings.background), fontStyle: rule.settings.fontStyle } });
        }
      };
      var addRule = addRule2;
      const result = [];
      const foreground = this.getColor(editorForeground) || this.getDefault(editorForeground);
      const background = this.getColor(editorBackground) || this.getDefault(editorBackground);
      result.push({
        settings: {
          foreground: normalizeColor(foreground),
          background: normalizeColor(background)
        }
      });
      let hasDefaultTokens = false;
      this.themeTokenColors.forEach(addRule2);
      this.customTokenColors.forEach(addRule2);
      if (!hasDefaultTokens) {
        defaultThemeColors[this.type].forEach(addRule2);
      }
      this.textMateThemingRules = result;
    }
    return this.textMateThemingRules;
  }
  getColor(colorId, useDefault) {
    const customColor = this.customColorMap[colorId];
    if (customColor instanceof Color) {
      return customColor;
    }
    if (customColor === void 0) {
      const color = this.colorMap[colorId];
      if (color !== void 0) {
        return color;
      }
    }
    if (useDefault !== false) {
      return this.getDefault(colorId);
    }
    return void 0;
  }
  getTokenStyle(type, modifiers, language, useDefault = true, definitions = {}) {
    const result = {
      foreground: void 0,
      bold: void 0,
      underline: void 0,
      strikethrough: void 0,
      italic: void 0
    };
    const score = {
      foreground: -1,
      bold: -1,
      underline: -1,
      strikethrough: -1,
      italic: -1
    };
    function _processStyle(matchScore, style, definition) {
      if (style.foreground && score.foreground <= matchScore) {
        score.foreground = matchScore;
        result.foreground = style.foreground;
        definitions.foreground = definition;
      }
      for (const p of ["bold", "underline", "strikethrough", "italic"]) {
        const property = p;
        const info = style[property];
        if (info !== void 0) {
          if (score[property] <= matchScore) {
            score[property] = matchScore;
            result[property] = info;
            definitions[property] = definition;
          }
        }
      }
    }
    function _processSemanticTokenRule(rule) {
      const matchScore = rule.selector.match(type, modifiers, language);
      if (matchScore >= 0) {
        _processStyle(matchScore, rule.style, rule);
      }
    }
    this.semanticTokenRules.forEach(_processSemanticTokenRule);
    this.customSemanticTokenRules.forEach(_processSemanticTokenRule);
    let hasUndefinedStyleProperty = false;
    for (const k in score) {
      const key = k;
      if (score[key] === -1) {
        hasUndefinedStyleProperty = true;
      } else {
        score[key] = Number.MAX_VALUE;
      }
    }
    if (hasUndefinedStyleProperty) {
      for (const rule of tokenClassificationRegistry.getTokenStylingDefaultRules()) {
        const matchScore = rule.selector.match(type, modifiers, language);
        if (matchScore >= 0) {
          let style;
          if (rule.defaults.scopesToProbe) {
            style = this.resolveScopes(rule.defaults.scopesToProbe);
            if (style) {
              _processStyle(matchScore, style, rule.defaults.scopesToProbe);
            }
          }
          if (!style && useDefault !== false) {
            const tokenStyleValue = rule.defaults[this.type];
            style = this.resolveTokenStyleValue(tokenStyleValue);
            if (style) {
              _processStyle(matchScore, style, tokenStyleValue);
            }
          }
        }
      }
    }
    return TokenStyle.fromData(result);
  }
  /**
   * @param tokenStyleValue Resolve a tokenStyleValue in the context of a theme
   */
  resolveTokenStyleValue(tokenStyleValue) {
    if (tokenStyleValue === void 0) {
      return void 0;
    } else if (typeof tokenStyleValue === "string") {
      const { type, modifiers, language } = parseClassifierString(tokenStyleValue, "");
      return this.getTokenStyle(type, modifiers, language);
    } else if (typeof tokenStyleValue === "object") {
      return tokenStyleValue;
    }
    return void 0;
  }
  getTokenColorIndex() {
    if (!this.tokenColorIndex) {
      const index = new TokenColorIndex();
      this.tokenColors.forEach((rule) => {
        index.add(rule.settings.foreground);
        index.add(rule.settings.background);
      });
      this.semanticTokenRules.forEach((r) => index.add(r.style.foreground));
      tokenClassificationRegistry.getTokenStylingDefaultRules().forEach((r) => {
        const defaultColor = r.defaults[this.type];
        if (defaultColor && typeof defaultColor === "object") {
          index.add(defaultColor.foreground);
        }
      });
      this.customSemanticTokenRules.forEach((r) => index.add(r.style.foreground));
      this.tokenColorIndex = index;
    }
    return this.tokenColorIndex;
  }
  get tokenColorMap() {
    return this.getTokenColorIndex().asArray();
  }
  getTokenStyleMetadata(typeWithLanguage, modifiers, defaultLanguage, useDefault = true, definitions = {}) {
    const { type, language } = parseClassifierString(typeWithLanguage, defaultLanguage);
    const style = this.getTokenStyle(type, modifiers, language, useDefault, definitions);
    if (!style) {
      return void 0;
    }
    return {
      foreground: this.getTokenColorIndex().get(style.foreground),
      bold: style.bold,
      underline: style.underline,
      strikethrough: style.strikethrough,
      italic: style.italic
    };
  }
  getTokenStylingRuleScope(rule) {
    if (this.customSemanticTokenRules.indexOf(rule) !== -1) {
      return "setting";
    }
    if (this.semanticTokenRules.indexOf(rule) !== -1) {
      return "theme";
    }
    return void 0;
  }
  getDefault(colorId) {
    return colorRegistry.resolveDefaultColor(colorId, this);
  }
  resolveScopes(scopes, definitions) {
    if (!this.themeTokenScopeMatchers) {
      this.themeTokenScopeMatchers = this.themeTokenColors.map(getScopeMatcher);
    }
    if (!this.customTokenScopeMatchers) {
      this.customTokenScopeMatchers = this.customTokenColors.map(getScopeMatcher);
    }
    for (const scope of scopes) {
      let findTokenStyleForScopeInScopes2 = function(scopeMatchers, themingRules) {
        for (let i = 0; i < scopeMatchers.length; i++) {
          const score = scopeMatchers[i](scope);
          if (score >= 0) {
            const themingRule = themingRules[i];
            const settings = themingRules[i].settings;
            if (score >= foregroundScore && settings.foreground) {
              foreground = settings.foreground;
              foregroundScore = score;
              foregroundThemingRule = themingRule;
            }
            if (score >= fontStyleScore && types.isString(settings.fontStyle)) {
              fontStyle = settings.fontStyle;
              fontStyleScore = score;
              fontStyleThemingRule = themingRule;
            }
          }
        }
      };
      var findTokenStyleForScopeInScopes = findTokenStyleForScopeInScopes2;
      let foreground = void 0;
      let fontStyle = void 0;
      let foregroundScore = -1;
      let fontStyleScore = -1;
      let fontStyleThemingRule = void 0;
      let foregroundThemingRule = void 0;
      findTokenStyleForScopeInScopes2(this.themeTokenScopeMatchers, this.themeTokenColors);
      findTokenStyleForScopeInScopes2(this.customTokenScopeMatchers, this.customTokenColors);
      if (foreground !== void 0 || fontStyle !== void 0) {
        if (definitions) {
          definitions.foreground = foregroundThemingRule;
          definitions.bold = definitions.italic = definitions.underline = definitions.strikethrough = fontStyleThemingRule;
          definitions.scope = scope;
        }
        return TokenStyle.fromSettings(foreground, fontStyle);
      }
    }
    return void 0;
  }
  defines(colorId) {
    const customColor = this.customColorMap[colorId];
    if (customColor instanceof Color) {
      return true;
    }
    return customColor === void 0 && this.colorMap.hasOwnProperty(colorId);
  }
  setCustomizations(settings) {
    this.setCustomColors(settings.colorCustomizations);
    this.setCustomTokenColors(settings.tokenColorCustomizations);
    this.setCustomSemanticTokenColors(settings.semanticTokenColorCustomizations);
  }
  setCustomColors(colors) {
    this.customColorMap = {};
    this.overwriteCustomColors(colors);
    const themeSpecificColors = this.getThemeSpecificColors(colors);
    if (types.isObject(themeSpecificColors)) {
      this.overwriteCustomColors(themeSpecificColors);
    }
    this.tokenColorIndex = void 0;
    this.textMateThemingRules = void 0;
    this.customTokenScopeMatchers = void 0;
  }
  overwriteCustomColors(colors) {
    for (const id in colors) {
      const colorVal = colors[id];
      if (colorVal === DEFAULT_COLOR_CONFIG_VALUE) {
        this.customColorMap[id] = DEFAULT_COLOR_CONFIG_VALUE;
      } else if (typeof colorVal === "string") {
        this.customColorMap[id] = Color.fromHex(colorVal);
      }
    }
  }
  setCustomTokenColors(customTokenColors) {
    this.customTokenColors = [];
    this.customSemanticHighlightingDeprecated = void 0;
    this.addCustomTokenColors(customTokenColors);
    const themeSpecificTokenColors = this.getThemeSpecificColors(customTokenColors);
    if (types.isObject(themeSpecificTokenColors)) {
      this.addCustomTokenColors(themeSpecificTokenColors);
    }
    this.tokenColorIndex = void 0;
    this.textMateThemingRules = void 0;
    this.customTokenScopeMatchers = void 0;
  }
  setCustomSemanticTokenColors(semanticTokenColors) {
    this.customSemanticTokenRules = [];
    this.customSemanticHighlighting = void 0;
    if (semanticTokenColors) {
      this.customSemanticHighlighting = semanticTokenColors.enabled;
      if (semanticTokenColors.rules) {
        this.readSemanticTokenRules(semanticTokenColors.rules);
      }
      const themeSpecificColors = this.getThemeSpecificColors(semanticTokenColors);
      if (types.isObject(themeSpecificColors)) {
        if (themeSpecificColors.enabled !== void 0) {
          this.customSemanticHighlighting = themeSpecificColors.enabled;
        }
        if (themeSpecificColors.rules) {
          this.readSemanticTokenRules(themeSpecificColors.rules);
        }
      }
    }
    this.tokenColorIndex = void 0;
    this.textMateThemingRules = void 0;
  }
  isThemeScope(key) {
    return key.charAt(0) === THEME_SCOPE_OPEN_PAREN && key.charAt(key.length - 1) === THEME_SCOPE_CLOSE_PAREN;
  }
  isThemeScopeMatch(themeId) {
    const themeIdFirstChar = themeId.charAt(0);
    const themeIdLastChar = themeId.charAt(themeId.length - 1);
    const themeIdPrefix = themeId.slice(0, -1);
    const themeIdInfix = themeId.slice(1, -1);
    const themeIdSuffix = themeId.slice(1);
    return themeId === this.settingsId || this.settingsId.includes(themeIdInfix) && themeIdFirstChar === THEME_SCOPE_WILDCARD && themeIdLastChar === THEME_SCOPE_WILDCARD || this.settingsId.startsWith(themeIdPrefix) && themeIdLastChar === THEME_SCOPE_WILDCARD || this.settingsId.endsWith(themeIdSuffix) && themeIdFirstChar === THEME_SCOPE_WILDCARD;
  }
  getThemeSpecificColors(colors) {
    let themeSpecificColors;
    for (const key in colors) {
      const scopedColors = colors[key];
      if (this.isThemeScope(key) && scopedColors instanceof Object && !Array.isArray(scopedColors)) {
        const themeScopeList = key.match(themeScopeRegex) || [];
        for (const themeScope of themeScopeList) {
          const themeId = themeScope.substring(1, themeScope.length - 1);
          if (this.isThemeScopeMatch(themeId)) {
            if (!themeSpecificColors) {
              themeSpecificColors = {};
            }
            const scopedThemeSpecificColors = scopedColors;
            for (const subkey in scopedThemeSpecificColors) {
              const originalColors = themeSpecificColors[subkey];
              const overrideColors = scopedThemeSpecificColors[subkey];
              if (Array.isArray(originalColors) && Array.isArray(overrideColors)) {
                themeSpecificColors[subkey] = originalColors.concat(overrideColors);
              } else if (overrideColors) {
                themeSpecificColors[subkey] = overrideColors;
              }
            }
          }
        }
      }
    }
    return themeSpecificColors;
  }
  readSemanticTokenRules(tokenStylingRuleSection) {
    for (const key in tokenStylingRuleSection) {
      if (!this.isThemeScope(key)) {
        try {
          const rule = readSemanticTokenRule(key, tokenStylingRuleSection[key]);
          if (rule) {
            this.customSemanticTokenRules.push(rule);
          }
        } catch (e) {
        }
      }
    }
  }
  addCustomTokenColors(customTokenColors) {
    for (const tokenGroup in tokenGroupToScopesMap) {
      const group = tokenGroup;
      const value = customTokenColors[group];
      if (value) {
        const settings = typeof value === "string" ? { foreground: value } : value;
        const scopes = tokenGroupToScopesMap[group];
        for (const scope of scopes) {
          this.customTokenColors.push({ scope, settings });
        }
      }
    }
    if (Array.isArray(customTokenColors.textMateRules)) {
      for (const rule of customTokenColors.textMateRules) {
        if (rule.scope && rule.settings) {
          this.customTokenColors.push(rule);
        }
      }
    }
    if (customTokenColors.semanticHighlighting !== void 0) {
      this.customSemanticHighlightingDeprecated = customTokenColors.semanticHighlighting;
    }
  }
  ensureLoaded(extensionResourceLoaderService) {
    return !this.isLoaded ? this.load(extensionResourceLoaderService) : Promise.resolve(void 0);
  }
  reload(extensionResourceLoaderService) {
    return this.load(extensionResourceLoaderService);
  }
  load(extensionResourceLoaderService) {
    if (!this.location) {
      return Promise.resolve(void 0);
    }
    this.themeTokenColors = [];
    this.clearCaches();
    const result = {
      colors: {},
      textMateRules: [],
      semanticTokenRules: [],
      semanticHighlighting: false
    };
    return _loadColorTheme(extensionResourceLoaderService, this.location, result).then((_) => {
      this.isLoaded = true;
      this.semanticTokenRules = result.semanticTokenRules;
      this.colorMap = result.colors;
      this.themeTokenColors = result.textMateRules;
      this.themeSemanticHighlighting = result.semanticHighlighting;
    });
  }
  clearCaches() {
    this.tokenColorIndex = void 0;
    this.textMateThemingRules = void 0;
    this.themeTokenScopeMatchers = void 0;
    this.customTokenScopeMatchers = void 0;
  }
  toStorage(storageService) {
    const colorMapData = {};
    for (const key in this.colorMap) {
      colorMapData[key] = Color.Format.CSS.formatHexA(this.colorMap[key], true);
    }
    const value = JSON.stringify({
      id: this.id,
      label: this.label,
      settingsId: this.settingsId,
      themeTokenColors: this.themeTokenColors.map((tc) => ({ settings: tc.settings, scope: tc.scope })),
      // don't persist names
      semanticTokenRules: this.semanticTokenRules.map(SemanticTokenRule.toJSONObject),
      extensionData: ExtensionData.toJSONObject(this.extensionData),
      themeSemanticHighlighting: this.themeSemanticHighlighting,
      colorMap: colorMapData,
      watch: this.watch
    });
    storageService.store(_ColorThemeData.STORAGE_KEY, value, StorageScope.PROFILE, StorageTarget.USER);
  }
  get themeTypeSelector() {
    return this.classNames[0];
  }
  get classNames() {
    return this.id.split(" ");
  }
  get type() {
    switch (this.themeTypeSelector) {
      case ThemeTypeSelector.VS:
        return ColorScheme.LIGHT;
      case ThemeTypeSelector.HC_BLACK:
        return ColorScheme.HIGH_CONTRAST_DARK;
      case ThemeTypeSelector.HC_LIGHT:
        return ColorScheme.HIGH_CONTRAST_LIGHT;
      default:
        return ColorScheme.DARK;
    }
  }
  // constructors
  static createUnloadedThemeForThemeType(themeType, colorMap) {
    return _ColorThemeData.createUnloadedTheme(getThemeTypeSelector(themeType), colorMap);
  }
  static createUnloadedTheme(id, colorMap) {
    const themeData = new _ColorThemeData(id, "", "__" + id);
    themeData.isLoaded = false;
    themeData.themeTokenColors = [];
    themeData.watch = false;
    if (colorMap) {
      for (const id2 in colorMap) {
        themeData.colorMap[id2] = Color.fromHex(colorMap[id2]);
      }
    }
    return themeData;
  }
  static createLoadedEmptyTheme(id, settingsId) {
    const themeData = new _ColorThemeData(id, "", settingsId);
    themeData.isLoaded = true;
    themeData.themeTokenColors = [];
    themeData.watch = false;
    return themeData;
  }
  static fromStorageData(storageService) {
    const input = storageService.get(_ColorThemeData.STORAGE_KEY, StorageScope.PROFILE);
    if (!input) {
      return void 0;
    }
    try {
      const data = JSON.parse(input);
      const theme = new _ColorThemeData("", "", "");
      for (const key in data) {
        switch (key) {
          case "colorMap": {
            const colorMapData = data[key];
            for (const id in colorMapData) {
              theme.colorMap[id] = Color.fromHex(colorMapData[id]);
            }
            break;
          }
          case "themeTokenColors":
          case "id":
          case "label":
          case "settingsId":
          case "watch":
          case "themeSemanticHighlighting":
            theme[key] = data[key];
            break;
          case "semanticTokenRules": {
            const rulesData = data[key];
            if (Array.isArray(rulesData)) {
              for (const d of rulesData) {
                const rule = SemanticTokenRule.fromJSONObject(tokenClassificationRegistry, d);
                if (rule) {
                  theme.semanticTokenRules.push(rule);
                }
              }
            }
            break;
          }
          case "location":
            break;
          case "extensionData":
            theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
            break;
        }
      }
      if (!theme.id || !theme.settingsId) {
        return void 0;
      }
      return theme;
    } catch (e) {
      return void 0;
    }
  }
  static fromExtensionTheme(theme, colorThemeLocation, extensionData) {
    const baseTheme = theme["uiTheme"] || "vs-dark";
    const themeSelector = toCSSSelector(extensionData.extensionId, theme.path);
    const id = `${baseTheme} ${themeSelector}`;
    const label = theme.label || basename(theme.path);
    const settingsId = theme.id || label;
    const themeData = new _ColorThemeData(id, label, settingsId);
    themeData.description = theme.description;
    themeData.watch = theme._watch === true;
    themeData.location = colorThemeLocation;
    themeData.extensionData = extensionData;
    themeData.isLoaded = false;
    return themeData;
  }
};
_ColorThemeData.STORAGE_KEY = "colorThemeData";
let ColorThemeData = _ColorThemeData;
function toCSSSelector(extensionId, path) {
  if (path.startsWith("./")) {
    path = path.substr(2);
  }
  let str = `${extensionId}-${path}`;
  str = str.replace(/[^_a-zA-Z0-9-]/g, "-");
  if (str.charAt(0).match(/[0-9-]/)) {
    str = "_" + str;
  }
  return str;
}
async function _loadColorTheme(extensionResourceLoaderService, themeLocation, result) {
  if (resources.extname(themeLocation) === ".json") {
    const content = await extensionResourceLoaderService.readExtensionResource(themeLocation);
    const errors = [];
    const contentValue = Json.parse(content, errors);
    if (errors.length > 0) {
      return Promise.reject(new Error(nls.localize("error.cannotparsejson", "Problems parsing JSON theme file: {0}", errors.map((e) => getParseErrorMessage(e.error)).join(", "))));
    } else if (Json.getNodeType(contentValue) !== "object") {
      return Promise.reject(new Error(nls.localize("error.invalidformat", "Invalid format for JSON theme file: Object expected.")));
    }
    if (contentValue.include) {
      await _loadColorTheme(extensionResourceLoaderService, resources.joinPath(resources.dirname(themeLocation), contentValue.include), result);
    }
    if (Array.isArray(contentValue.settings)) {
      convertSettings(contentValue.settings, result);
      return null;
    }
    result.semanticHighlighting = result.semanticHighlighting || contentValue.semanticHighlighting;
    const colors = contentValue.colors;
    if (colors) {
      if (typeof colors !== "object") {
        return Promise.reject(new Error(nls.localize({ key: "error.invalidformat.colors", comment: ["{0} will be replaced by a path. Values in quotes should not be translated."] }, "Problem parsing color theme file: {0}. Property 'colors' is not of type 'object'.", themeLocation.toString())));
      }
      for (const colorId in colors) {
        const colorVal = colors[colorId];
        if (colorVal === DEFAULT_COLOR_CONFIG_VALUE) {
          delete result.colors[colorId];
        } else if (typeof colorVal === "string") {
          result.colors[colorId] = Color.fromHex(colors[colorId]);
        }
      }
    }
    const tokenColors = contentValue.tokenColors;
    if (tokenColors) {
      if (Array.isArray(tokenColors)) {
        result.textMateRules.push(...tokenColors);
      } else if (typeof tokenColors === "string") {
        await _loadSyntaxTokens(extensionResourceLoaderService, resources.joinPath(resources.dirname(themeLocation), tokenColors), result);
      } else {
        return Promise.reject(new Error(nls.localize({ key: "error.invalidformat.tokenColors", comment: ["{0} will be replaced by a path. Values in quotes should not be translated."] }, "Problem parsing color theme file: {0}. Property 'tokenColors' should be either an array specifying colors or a path to a TextMate theme file", themeLocation.toString())));
      }
    }
    const semanticTokenColors = contentValue.semanticTokenColors;
    if (semanticTokenColors && typeof semanticTokenColors === "object") {
      for (const key in semanticTokenColors) {
        try {
          const rule = readSemanticTokenRule(key, semanticTokenColors[key]);
          if (rule) {
            result.semanticTokenRules.push(rule);
          }
        } catch (e) {
          return Promise.reject(new Error(nls.localize({ key: "error.invalidformat.semanticTokenColors", comment: ["{0} will be replaced by a path. Values in quotes should not be translated."] }, "Problem parsing color theme file: {0}. Property 'semanticTokenColors' contains a invalid selector", themeLocation.toString())));
        }
      }
    }
  } else {
    return _loadSyntaxTokens(extensionResourceLoaderService, themeLocation, result);
  }
}
function _loadSyntaxTokens(extensionResourceLoaderService, themeLocation, result) {
  return extensionResourceLoaderService.readExtensionResource(themeLocation).then((content) => {
    try {
      const contentValue = parsePList(content);
      const settings = contentValue.settings;
      if (!Array.isArray(settings)) {
        return Promise.reject(new Error(nls.localize("error.plist.invalidformat", "Problem parsing tmTheme file: {0}. 'settings' is not array.")));
      }
      convertSettings(settings, result);
      return Promise.resolve(null);
    } catch (e) {
      return Promise.reject(new Error(nls.localize("error.cannotparse", "Problems parsing tmTheme file: {0}", e.message)));
    }
  }, (error) => {
    return Promise.reject(new Error(nls.localize("error.cannotload", "Problems loading tmTheme file {0}: {1}", themeLocation.toString(), error.message)));
  });
}
const defaultThemeColors = {
  "light": [
    { scope: "token.info-token", settings: { foreground: "#316bcd" } },
    { scope: "token.warn-token", settings: { foreground: "#cd9731" } },
    { scope: "token.error-token", settings: { foreground: "#cd3131" } },
    { scope: "token.debug-token", settings: { foreground: "#800080" } }
  ],
  "dark": [
    { scope: "token.info-token", settings: { foreground: "#6796e6" } },
    { scope: "token.warn-token", settings: { foreground: "#cd9731" } },
    { scope: "token.error-token", settings: { foreground: "#f44747" } },
    { scope: "token.debug-token", settings: { foreground: "#b267e6" } }
  ],
  "hcLight": [
    { scope: "token.info-token", settings: { foreground: "#316bcd" } },
    { scope: "token.warn-token", settings: { foreground: "#cd9731" } },
    { scope: "token.error-token", settings: { foreground: "#cd3131" } },
    { scope: "token.debug-token", settings: { foreground: "#800080" } }
  ],
  "hcDark": [
    { scope: "token.info-token", settings: { foreground: "#6796e6" } },
    { scope: "token.warn-token", settings: { foreground: "#008000" } },
    { scope: "token.error-token", settings: { foreground: "#FF0000" } },
    { scope: "token.debug-token", settings: { foreground: "#b267e6" } }
  ]
};
const noMatch = (_scope) => -1;
function nameMatcher(identifiers, scopes) {
  if (scopes.length < identifiers.length) {
    return -1;
  }
  let score = void 0;
  const every = identifiers.every((identifier) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopesAreMatching(scopes[i], identifier)) {
        score = (i + 1) * 65536 + identifier.length;
        return true;
      }
    }
    return false;
  });
  return every && score !== void 0 ? score : -1;
}
function scopesAreMatching(thisScopeName, scopeName) {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === ".";
}
function getScopeMatcher(rule) {
  const ruleScope = rule.scope;
  if (!ruleScope || !rule.settings) {
    return noMatch;
  }
  const matchers = [];
  if (Array.isArray(ruleScope)) {
    for (const rs of ruleScope) {
      createMatchers(rs, nameMatcher, matchers);
    }
  } else {
    createMatchers(ruleScope, nameMatcher, matchers);
  }
  if (matchers.length === 0) {
    return noMatch;
  }
  return (scope) => {
    let max = matchers[0].matcher(scope);
    for (let i = 1; i < matchers.length; i++) {
      max = Math.max(max, matchers[i].matcher(scope));
    }
    return max;
  };
}
function readSemanticTokenRule(selectorString, settings) {
  const selector = tokenClassificationRegistry.parseTokenSelector(selectorString);
  let style;
  if (typeof settings === "string") {
    style = TokenStyle.fromSettings(settings, void 0);
  } else if (isSemanticTokenColorizationSetting(settings)) {
    style = TokenStyle.fromSettings(settings.foreground, settings.fontStyle, settings.bold, settings.underline, settings.strikethrough, settings.italic);
  }
  if (style) {
    return { selector, style };
  }
  return void 0;
}
function isSemanticTokenColorizationSetting(style) {
  return style && (types.isString(style.foreground) || types.isString(style.fontStyle) || types.isBoolean(style.italic) || types.isBoolean(style.underline) || types.isBoolean(style.strikethrough) || types.isBoolean(style.bold));
}
function findMetadata(colorThemeData, captureNames, languageId, bracket) {
  let metadata = 0;
  metadata |= languageId << MetadataConsts.LANGUAGEID_OFFSET;
  const definitions = {};
  const tokenStyle = colorThemeData.resolveScopes([captureNames], definitions);
  if (captureNames.length > 0) {
    const standardToken = toStandardTokenType(captureNames[captureNames.length - 1]);
    metadata |= standardToken << MetadataConsts.TOKEN_TYPE_OFFSET;
  }
  const fontStyle = definitions.foreground?.settings.fontStyle || definitions.bold?.settings.fontStyle;
  if (fontStyle?.includes("italic")) {
    metadata |= FontStyle.Italic | MetadataConsts.ITALIC_MASK;
  }
  if (fontStyle?.includes("bold")) {
    metadata |= FontStyle.Bold | MetadataConsts.BOLD_MASK;
  }
  if (fontStyle?.includes("underline")) {
    metadata |= FontStyle.Underline | MetadataConsts.UNDERLINE_MASK;
  }
  if (fontStyle?.includes("strikethrough")) {
    metadata |= FontStyle.Strikethrough | MetadataConsts.STRIKETHROUGH_MASK;
  }
  const foreground = tokenStyle?.foreground;
  const tokenStyleForeground = foreground !== void 0 ? colorThemeData.getTokenColorIndex().get(foreground) : ColorId.DefaultForeground;
  metadata |= tokenStyleForeground << MetadataConsts.FOREGROUND_OFFSET;
  if (bracket) {
    metadata |= MetadataConsts.BALANCED_BRACKETS_MASK;
  }
  return metadata;
}
class TokenColorIndex {
  constructor() {
    this._lastColorId = 0;
    this._id2color = [];
    this._color2id = /* @__PURE__ */ Object.create(null);
  }
  add(color) {
    color = normalizeColor(color);
    if (color === void 0) {
      return 0;
    }
    let value = this._color2id[color];
    if (value) {
      return value;
    }
    value = ++this._lastColorId;
    this._color2id[color] = value;
    this._id2color[value] = color;
    return value;
  }
  get(color) {
    color = normalizeColor(color);
    if (color === void 0) {
      return 0;
    }
    const value = this._color2id[color];
    if (value) {
      return value;
    }
    console.log(`Color ${color} not in index.`);
    return 0;
  }
  asArray() {
    return this._id2color.slice(0);
  }
}
function normalizeColor(color) {
  if (!color) {
    return void 0;
  }
  if (typeof color !== "string") {
    color = Color.Format.CSS.formatHexA(color, true);
  }
  const len = color.length;
  if (color.charCodeAt(0) !== CharCode.Hash || len !== 4 && len !== 5 && len !== 7 && len !== 9) {
    return void 0;
  }
  const result = [CharCode.Hash];
  for (let i = 1; i < len; i++) {
    const upper = hexUpper(color.charCodeAt(i));
    if (!upper) {
      return void 0;
    }
    result.push(upper);
    if (len === 4 || len === 5) {
      result.push(upper);
    }
  }
  if (result.length === 9 && result[7] === CharCode.F && result[8] === CharCode.F) {
    result.length = 7;
  }
  return String.fromCharCode(...result);
}
function hexUpper(charCode) {
  if (charCode >= CharCode.Digit0 && charCode <= CharCode.Digit9 || charCode >= CharCode.A && charCode <= CharCode.F) {
    return charCode;
  } else if (charCode >= CharCode.a && charCode <= CharCode.f) {
    return charCode - CharCode.a + CharCode.A;
  }
  return 0;
}
export {
  ColorThemeData,
  findMetadata
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi9jb2xvclRoZW1lRGF0YS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBKc29uIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25EYXRhLCBJVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zLCBJVGV4dE1hdGVUaGVtaW5nUnVsZSwgSVdvcmtiZW5jaENvbG9yVGhlbWUsIElDb2xvck1hcCwgSVRoZW1lRXh0ZW5zaW9uUG9pbnQsIElDb2xvckN1c3RvbWl6YXRpb25zLCBJU2VtYW50aWNUb2tlblJ1bGVzLCBJU2VtYW50aWNUb2tlbkNvbG9yaXphdGlvblNldHRpbmcsIElTZW1hbnRpY1Rva2VuQ29sb3JDdXN0b21pemF0aW9ucywgSVRoZW1lU2NvcGFibGVDdXN0b21pemF0aW9ucywgSVRoZW1lU2NvcGVkQ3VzdG9taXphdGlvbnMsIFRIRU1FX1NDT1BFX0NMT1NFX1BBUkVOLCBUSEVNRV9TQ09QRV9PUEVOX1BBUkVOLCB0aGVtZVNjb3BlUmVnZXgsIFRIRU1FX1NDT1BFX1dJTERDQVJEIH0gZnJvbSAnLi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY29udmVydFNldHRpbmdzIH0gZnJvbSAnLi90aGVtZUNvbXBhdGliaWxpdHkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgQ29sb3JSZWdpc3RyeUV4dGVuc2lvbnMsIElDb2xvclJlZ2lzdHJ5LCBDb2xvcklkZW50aWZpZXIsIGVkaXRvckJhY2tncm91bmQsIGVkaXRvckZvcmVncm91bmQsIERFRkFVTFRfQ09MT1JfQ09ORklHX1ZBTFVFIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRva2VuU3R5bGUsIGdldFRoZW1lVHlwZVNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBnZXRQYXJzZUVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25FcnJvck1lc3NhZ2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZVBMaXN0IH0gZnJvbSAnLi9wbGlzdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBUb2tlblN0eWxlLCBTZW1hbnRpY1Rva2VuUnVsZSwgUHJvYmVTY29wZSwgZ2V0VG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LCBUb2tlblN0eWxlVmFsdWUsIFRva2VuU3R5bGVEYXRhLCBwYXJzZUNsYXNzaWZpZXJTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE1hdGNoZXJXaXRoUHJpb3JpdHksIE1hdGNoZXIsIGNyZWF0ZU1hdGNoZXJzIH0gZnJvbSAnLi90ZXh0TWF0ZVNjb3BlTWF0Y2hlci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIvY29tbW9uL2V4dGVuc2lvblJlc291cmNlTG9hZGVyLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgU3RvcmFnZVNjb3BlLCBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFRoZW1lQ29uZmlndXJhdGlvbiB9IGZyb20gJy4vdGhlbWVDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lLCBUaGVtZVR5cGVTZWxlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBDb2xvcklkLCBGb250U3R5bGUsIE1ldGFkYXRhQ29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IHRvU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9zdXBwb3J0cy90b2tlbml6YXRpb24uanMnO1xuXG5jb25zdCBjb2xvclJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KENvbG9yUmVnaXN0cnlFeHRlbnNpb25zLkNvbG9yQ29udHJpYnV0aW9uKTtcblxuY29uc3QgdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5ID0gZ2V0VG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5KCk7XG5cbmNvbnN0IHRva2VuR3JvdXBUb1Njb3Blc01hcCA9IHtcblx0Y29tbWVudHM6IFsnY29tbWVudCcsICdwdW5jdHVhdGlvbi5kZWZpbml0aW9uLmNvbW1lbnQnXSxcblx0c3RyaW5nczogWydzdHJpbmcnLCAnbWV0YS5lbWJlZGRlZC5hc3NlbWJseSddLFxuXHRrZXl3b3JkczogWydrZXl3b3JkIC0ga2V5d29yZC5vcGVyYXRvcicsICdrZXl3b3JkLmNvbnRyb2wnLCAnc3RvcmFnZScsICdzdG9yYWdlLnR5cGUnXSxcblx0bnVtYmVyczogWydjb25zdGFudC5udW1lcmljJ10sXG5cdHR5cGVzOiBbJ2VudGl0eS5uYW1lLnR5cGUnLCAnZW50aXR5Lm5hbWUuY2xhc3MnLCAnc3VwcG9ydC50eXBlJywgJ3N1cHBvcnQuY2xhc3MnXSxcblx0ZnVuY3Rpb25zOiBbJ2VudGl0eS5uYW1lLmZ1bmN0aW9uJywgJ3N1cHBvcnQuZnVuY3Rpb24nXSxcblx0dmFyaWFibGVzOiBbJ3ZhcmlhYmxlJywgJ2VudGl0eS5uYW1lLnZhcmlhYmxlJ11cbn07XG5cblxuZXhwb3J0IHR5cGUgVG9rZW5TdHlsZURlZmluaXRpb24gPSBTZW1hbnRpY1Rva2VuUnVsZSB8IFByb2JlU2NvcGVbXSB8IFRva2VuU3R5bGVWYWx1ZTtcbmV4cG9ydCB0eXBlIFRva2VuU3R5bGVEZWZpbml0aW9ucyA9IHsgW1AgaW4ga2V5b2YgVG9rZW5TdHlsZURhdGFdPzogVG9rZW5TdHlsZURlZmluaXRpb24gfCB1bmRlZmluZWQgfTtcblxuZXhwb3J0IHR5cGUgVGV4dE1hdGVUaGVtaW5nUnVsZURlZmluaXRpb25zID0geyBbUCBpbiBrZXlvZiBUb2tlblN0eWxlRGF0YV0/OiBJVGV4dE1hdGVUaGVtaW5nUnVsZSB8IHVuZGVmaW5lZDsgfSAmIHsgc2NvcGU/OiBQcm9iZVNjb3BlIH07XG5cbmludGVyZmFjZSBJQ29sb3JPckRlZmF1bHRNYXAge1xuXHRbaWQ6IHN0cmluZ106IENvbG9yIHwgdHlwZW9mIERFRkFVTFRfQ09MT1JfQ09ORklHX1ZBTFVFO1xufVxuXG5leHBvcnQgY2xhc3MgQ29sb3JUaGVtZURhdGEgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29sb3JUaGVtZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFNUT1JBR0VfS0VZID0gJ2NvbG9yVGhlbWVEYXRhJztcblxuXHRpZDogc3RyaW5nO1xuXHRsYWJlbDogc3RyaW5nO1xuXHRzZXR0aW5nc0lkOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRpc0xvYWRlZDogYm9vbGVhbjtcblx0bG9jYXRpb24/OiBVUkk7IC8vIG9ubHkgc2V0IGZvciBleHRlbnNpb24gZnJvbSB0aGUgcmVnaXN0cnksIG5vdCBmb3IgdGhlbWVzIHJlc3RvcmVkIGZyb20gdGhlIHN0b3JhZ2Vcblx0d2F0Y2g/OiBib29sZWFuO1xuXHRleHRlbnNpb25EYXRhPzogRXh0ZW5zaW9uRGF0YTtcblxuXHRwcml2YXRlIHRoZW1lU2VtYW50aWNIaWdobGlnaHRpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY3VzdG9tU2VtYW50aWNIaWdobGlnaHRpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY3VzdG9tU2VtYW50aWNIaWdobGlnaHRpbmdEZXByZWNhdGVkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgdGhlbWVUb2tlbkNvbG9yczogSVRleHRNYXRlVGhlbWluZ1J1bGVbXSA9IFtdO1xuXHRwcml2YXRlIGN1c3RvbVRva2VuQ29sb3JzOiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdID0gW107XG5cdHByaXZhdGUgY29sb3JNYXA6IElDb2xvck1hcCA9IHt9O1xuXHRwcml2YXRlIGN1c3RvbUNvbG9yTWFwOiBJQ29sb3JPckRlZmF1bHRNYXAgPSB7fTtcblxuXHRwcml2YXRlIHNlbWFudGljVG9rZW5SdWxlczogU2VtYW50aWNUb2tlblJ1bGVbXSA9IFtdO1xuXHRwcml2YXRlIGN1c3RvbVNlbWFudGljVG9rZW5SdWxlczogU2VtYW50aWNUb2tlblJ1bGVbXSA9IFtdO1xuXG5cdHByaXZhdGUgdGhlbWVUb2tlblNjb3BlTWF0Y2hlcnM6IE1hdGNoZXI8UHJvYmVTY29wZT5bXSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXN0b21Ub2tlblNjb3BlTWF0Y2hlcnM6IE1hdGNoZXI8UHJvYmVTY29wZT5bXSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHRleHRNYXRlVGhlbWluZ1J1bGVzOiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkOyAvLyBjcmVhdGVkIG9uIGRlbWFuZFxuXHRwcml2YXRlIHRva2VuQ29sb3JJbmRleDogVG9rZW5Db2xvckluZGV4IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkOyAvLyBjcmVhdGVkIG9uIGRlbWFuZFxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZywgc2V0dGluZ3NJZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5pZCA9IGlkO1xuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLnNldHRpbmdzSWQgPSBzZXR0aW5nc0lkO1xuXHRcdHRoaXMuaXNMb2FkZWQgPSBmYWxzZTtcblx0fVxuXG5cdGdldCBzZW1hbnRpY0hpZ2hsaWdodGluZygpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5jdXN0b21TZW1hbnRpY0hpZ2hsaWdodGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jdXN0b21TZW1hbnRpY0hpZ2hsaWdodGluZztcblx0XHR9XG5cdFx0aWYgKHRoaXMuY3VzdG9tU2VtYW50aWNIaWdobGlnaHRpbmdEZXByZWNhdGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLmN1c3RvbVNlbWFudGljSGlnaGxpZ2h0aW5nRGVwcmVjYXRlZDtcblx0XHR9XG5cdFx0cmV0dXJuICEhdGhpcy50aGVtZVNlbWFudGljSGlnaGxpZ2h0aW5nO1xuXHR9XG5cblx0Z2V0IHRva2VuQ29sb3JzKCk6IElUZXh0TWF0ZVRoZW1pbmdSdWxlW10ge1xuXHRcdGlmICghdGhpcy50ZXh0TWF0ZVRoZW1pbmdSdWxlcykge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdID0gW107XG5cblx0XHRcdC8vIHRoZSBkZWZhdWx0IHJ1bGUgKHNjb3BlIGVtcHR5KSBpcyBhbHdheXMgdGhlIGZpcnN0IHJ1bGUuIElnbm9yZSBhbGwgb3RoZXIgZGVmYXVsdCBydWxlcy5cblx0XHRcdGNvbnN0IGZvcmVncm91bmQgPSB0aGlzLmdldENvbG9yKGVkaXRvckZvcmVncm91bmQpIHx8IHRoaXMuZ2V0RGVmYXVsdChlZGl0b3JGb3JlZ3JvdW5kKSE7XG5cdFx0XHRjb25zdCBiYWNrZ3JvdW5kID0gdGhpcy5nZXRDb2xvcihlZGl0b3JCYWNrZ3JvdW5kKSB8fCB0aGlzLmdldERlZmF1bHQoZWRpdG9yQmFja2dyb3VuZCkhO1xuXHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRzZXR0aW5nczoge1xuXHRcdFx0XHRcdGZvcmVncm91bmQ6IG5vcm1hbGl6ZUNvbG9yKGZvcmVncm91bmQpLFxuXHRcdFx0XHRcdGJhY2tncm91bmQ6IG5vcm1hbGl6ZUNvbG9yKGJhY2tncm91bmQpXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRsZXQgaGFzRGVmYXVsdFRva2VucyA9IGZhbHNlO1xuXG5cdFx0XHRmdW5jdGlvbiBhZGRSdWxlKHJ1bGU6IElUZXh0TWF0ZVRoZW1pbmdSdWxlKSB7XG5cdFx0XHRcdGlmIChydWxlLnNjb3BlICYmIHJ1bGUuc2V0dGluZ3MpIHtcblx0XHRcdFx0XHRpZiAocnVsZS5zY29wZSA9PT0gJ3Rva2VuLmluZm8tdG9rZW4nKSB7XG5cdFx0XHRcdFx0XHRoYXNEZWZhdWx0VG9rZW5zID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goeyBzY29wZTogcnVsZS5zY29wZSwgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogbm9ybWFsaXplQ29sb3IocnVsZS5zZXR0aW5ncy5mb3JlZ3JvdW5kKSwgYmFja2dyb3VuZDogbm9ybWFsaXplQ29sb3IocnVsZS5zZXR0aW5ncy5iYWNrZ3JvdW5kKSwgZm9udFN0eWxlOiBydWxlLnNldHRpbmdzLmZvbnRTdHlsZSB9IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudGhlbWVUb2tlbkNvbG9ycy5mb3JFYWNoKGFkZFJ1bGUpO1xuXHRcdFx0Ly8gQWRkIHRoZSBjdXN0b20gY29sb3JzIGFmdGVyIHRoZSB0aGVtZSBjb2xvcnNcblx0XHRcdC8vIHNvIHRoYXQgdGhleSB3aWxsIG92ZXJyaWRlIHRoZW1cblx0XHRcdHRoaXMuY3VzdG9tVG9rZW5Db2xvcnMuZm9yRWFjaChhZGRSdWxlKTtcblxuXHRcdFx0aWYgKCFoYXNEZWZhdWx0VG9rZW5zKSB7XG5cdFx0XHRcdGRlZmF1bHRUaGVtZUNvbG9yc1t0aGlzLnR5cGVdLmZvckVhY2goYWRkUnVsZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRleHRNYXRlVGhlbWluZ1J1bGVzID0gcmVzdWx0O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50ZXh0TWF0ZVRoZW1pbmdSdWxlcztcblx0fVxuXG5cdHB1YmxpYyBnZXRDb2xvcihjb2xvcklkOiBDb2xvcklkZW50aWZpZXIsIHVzZURlZmF1bHQ/OiBib29sZWFuKTogQ29sb3IgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGN1c3RvbUNvbG9yID0gdGhpcy5jdXN0b21Db2xvck1hcFtjb2xvcklkXTtcblx0XHRpZiAoY3VzdG9tQ29sb3IgaW5zdGFuY2VvZiBDb2xvcikge1xuXHRcdFx0cmV0dXJuIGN1c3RvbUNvbG9yO1xuXHRcdH1cblx0XHRpZiAoY3VzdG9tQ29sb3IgPT09IHVuZGVmaW5lZCkgeyAvKiAhPT0gREVGQVVMVF9DT0xPUl9DT05GSUdfVkFMVUUgKi9cblx0XHRcdGNvbnN0IGNvbG9yID0gdGhpcy5jb2xvck1hcFtjb2xvcklkXTtcblx0XHRcdGlmIChjb2xvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiBjb2xvcjtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHVzZURlZmF1bHQgIT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXREZWZhdWx0KGNvbG9ySWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUb2tlblN0eWxlKHR5cGU6IHN0cmluZywgbW9kaWZpZXJzOiBzdHJpbmdbXSwgbGFuZ3VhZ2U6IHN0cmluZywgdXNlRGVmYXVsdCA9IHRydWUsIGRlZmluaXRpb25zOiBUb2tlblN0eWxlRGVmaW5pdGlvbnMgPSB7fSk6IFRva2VuU3R5bGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlc3VsdDogYW55ID0ge1xuXHRcdFx0Zm9yZWdyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0Ym9sZDogdW5kZWZpbmVkLFxuXHRcdFx0dW5kZXJsaW5lOiB1bmRlZmluZWQsXG5cdFx0XHRzdHJpa2V0aHJvdWdoOiB1bmRlZmluZWQsXG5cdFx0XHRpdGFsaWM6IHVuZGVmaW5lZFxuXHRcdH07XG5cdFx0Y29uc3Qgc2NvcmUgPSB7XG5cdFx0XHRmb3JlZ3JvdW5kOiAtMSxcblx0XHRcdGJvbGQ6IC0xLFxuXHRcdFx0dW5kZXJsaW5lOiAtMSxcblx0XHRcdHN0cmlrZXRocm91Z2g6IC0xLFxuXHRcdFx0aXRhbGljOiAtMVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBfcHJvY2Vzc1N0eWxlKG1hdGNoU2NvcmU6IG51bWJlciwgc3R5bGU6IFRva2VuU3R5bGUsIGRlZmluaXRpb246IFRva2VuU3R5bGVEZWZpbml0aW9uKSB7XG5cdFx0XHRpZiAoc3R5bGUuZm9yZWdyb3VuZCAmJiBzY29yZS5mb3JlZ3JvdW5kIDw9IG1hdGNoU2NvcmUpIHtcblx0XHRcdFx0c2NvcmUuZm9yZWdyb3VuZCA9IG1hdGNoU2NvcmU7XG5cdFx0XHRcdHJlc3VsdC5mb3JlZ3JvdW5kID0gc3R5bGUuZm9yZWdyb3VuZDtcblx0XHRcdFx0ZGVmaW5pdGlvbnMuZm9yZWdyb3VuZCA9IGRlZmluaXRpb247XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHAgb2YgWydib2xkJywgJ3VuZGVybGluZScsICdzdHJpa2V0aHJvdWdoJywgJ2l0YWxpYyddKSB7XG5cdFx0XHRcdGNvbnN0IHByb3BlcnR5ID0gcCBhcyBrZXlvZiBUb2tlblN0eWxlO1xuXHRcdFx0XHRjb25zdCBpbmZvID0gc3R5bGVbcHJvcGVydHldO1xuXHRcdFx0XHRpZiAoaW5mbyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0aWYgKHNjb3JlW3Byb3BlcnR5XSA8PSBtYXRjaFNjb3JlKSB7XG5cdFx0XHRcdFx0XHRzY29yZVtwcm9wZXJ0eV0gPSBtYXRjaFNjb3JlO1xuXHRcdFx0XHRcdFx0cmVzdWx0W3Byb3BlcnR5XSA9IGluZm87XG5cdFx0XHRcdFx0XHRkZWZpbml0aW9uc1twcm9wZXJ0eV0gPSBkZWZpbml0aW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRmdW5jdGlvbiBfcHJvY2Vzc1NlbWFudGljVG9rZW5SdWxlKHJ1bGU6IFNlbWFudGljVG9rZW5SdWxlKSB7XG5cdFx0XHRjb25zdCBtYXRjaFNjb3JlID0gcnVsZS5zZWxlY3Rvci5tYXRjaCh0eXBlLCBtb2RpZmllcnMsIGxhbmd1YWdlKTtcblx0XHRcdGlmIChtYXRjaFNjb3JlID49IDApIHtcblx0XHRcdFx0X3Byb2Nlc3NTdHlsZShtYXRjaFNjb3JlLCBydWxlLnN0eWxlLCBydWxlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnNlbWFudGljVG9rZW5SdWxlcy5mb3JFYWNoKF9wcm9jZXNzU2VtYW50aWNUb2tlblJ1bGUpO1xuXHRcdHRoaXMuY3VzdG9tU2VtYW50aWNUb2tlblJ1bGVzLmZvckVhY2goX3Byb2Nlc3NTZW1hbnRpY1Rva2VuUnVsZSk7XG5cblx0XHRsZXQgaGFzVW5kZWZpbmVkU3R5bGVQcm9wZXJ0eSA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgayBpbiBzY29yZSkge1xuXHRcdFx0Y29uc3Qga2V5ID0gayBhcyBrZXlvZiBUb2tlblN0eWxlO1xuXHRcdFx0aWYgKHNjb3JlW2tleV0gPT09IC0xKSB7XG5cdFx0XHRcdGhhc1VuZGVmaW5lZFN0eWxlUHJvcGVydHkgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2NvcmVba2V5XSA9IE51bWJlci5NQVhfVkFMVUU7IC8vIHNldCBpdCB0byB0aGUgbWF4LCBzbyBpdCB3b24ndCBiZSByZXBsYWNlZCBieSBhIGRlZmF1bHRcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGhhc1VuZGVmaW5lZFN0eWxlUHJvcGVydHkpIHtcblx0XHRcdGZvciAoY29uc3QgcnVsZSBvZiB0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkuZ2V0VG9rZW5TdHlsaW5nRGVmYXVsdFJ1bGVzKCkpIHtcblx0XHRcdFx0Y29uc3QgbWF0Y2hTY29yZSA9IHJ1bGUuc2VsZWN0b3IubWF0Y2godHlwZSwgbW9kaWZpZXJzLCBsYW5ndWFnZSk7XG5cdFx0XHRcdGlmIChtYXRjaFNjb3JlID49IDApIHtcblx0XHRcdFx0XHRsZXQgc3R5bGU6IFRva2VuU3R5bGUgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKHJ1bGUuZGVmYXVsdHMuc2NvcGVzVG9Qcm9iZSkge1xuXHRcdFx0XHRcdFx0c3R5bGUgPSB0aGlzLnJlc29sdmVTY29wZXMocnVsZS5kZWZhdWx0cy5zY29wZXNUb1Byb2JlKTtcblx0XHRcdFx0XHRcdGlmIChzdHlsZSkge1xuXHRcdFx0XHRcdFx0XHRfcHJvY2Vzc1N0eWxlKG1hdGNoU2NvcmUsIHN0eWxlLCBydWxlLmRlZmF1bHRzLnNjb3Blc1RvUHJvYmUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIXN0eWxlICYmIHVzZURlZmF1bHQgIT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0b2tlblN0eWxlVmFsdWUgPSBydWxlLmRlZmF1bHRzW3RoaXMudHlwZV07XG5cdFx0XHRcdFx0XHRzdHlsZSA9IHRoaXMucmVzb2x2ZVRva2VuU3R5bGVWYWx1ZSh0b2tlblN0eWxlVmFsdWUpO1xuXHRcdFx0XHRcdFx0aWYgKHN0eWxlKSB7XG5cdFx0XHRcdFx0XHRcdF9wcm9jZXNzU3R5bGUobWF0Y2hTY29yZSwgc3R5bGUsIHRva2VuU3R5bGVWYWx1ZSEpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gVG9rZW5TdHlsZS5mcm9tRGF0YShyZXN1bHQpO1xuXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHRva2VuU3R5bGVWYWx1ZSBSZXNvbHZlIGEgdG9rZW5TdHlsZVZhbHVlIGluIHRoZSBjb250ZXh0IG9mIGEgdGhlbWVcblx0ICovXG5cdHB1YmxpYyByZXNvbHZlVG9rZW5TdHlsZVZhbHVlKHRva2VuU3R5bGVWYWx1ZTogVG9rZW5TdHlsZVZhbHVlIHwgdW5kZWZpbmVkKTogVG9rZW5TdHlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRva2VuU3R5bGVWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHRva2VuU3R5bGVWYWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbnN0IHsgdHlwZSwgbW9kaWZpZXJzLCBsYW5ndWFnZSB9ID0gcGFyc2VDbGFzc2lmaWVyU3RyaW5nKHRva2VuU3R5bGVWYWx1ZSwgJycpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0VG9rZW5TdHlsZSh0eXBlLCBtb2RpZmllcnMsIGxhbmd1YWdlKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0b2tlblN0eWxlVmFsdWUgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gdG9rZW5TdHlsZVZhbHVlO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGdldFRva2VuQ29sb3JJbmRleCgpOiBUb2tlbkNvbG9ySW5kZXgge1xuXHRcdC8vIGNvbGxlY3QgYWxsIGNvbG9ycyB0aGF0IHRva2VucyBjYW4gaGF2ZVxuXHRcdGlmICghdGhpcy50b2tlbkNvbG9ySW5kZXgpIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gbmV3IFRva2VuQ29sb3JJbmRleCgpO1xuXHRcdFx0dGhpcy50b2tlbkNvbG9ycy5mb3JFYWNoKHJ1bGUgPT4ge1xuXHRcdFx0XHRpbmRleC5hZGQocnVsZS5zZXR0aW5ncy5mb3JlZ3JvdW5kKTtcblx0XHRcdFx0aW5kZXguYWRkKHJ1bGUuc2V0dGluZ3MuYmFja2dyb3VuZCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5zZW1hbnRpY1Rva2VuUnVsZXMuZm9yRWFjaChyID0+IGluZGV4LmFkZChyLnN0eWxlLmZvcmVncm91bmQpKTtcblx0XHRcdHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeS5nZXRUb2tlblN0eWxpbmdEZWZhdWx0UnVsZXMoKS5mb3JFYWNoKHIgPT4ge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0Q29sb3IgPSByLmRlZmF1bHRzW3RoaXMudHlwZV07XG5cdFx0XHRcdGlmIChkZWZhdWx0Q29sb3IgJiYgdHlwZW9mIGRlZmF1bHRDb2xvciA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRpbmRleC5hZGQoZGVmYXVsdENvbG9yLmZvcmVncm91bmQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuY3VzdG9tU2VtYW50aWNUb2tlblJ1bGVzLmZvckVhY2gociA9PiBpbmRleC5hZGQoci5zdHlsZS5mb3JlZ3JvdW5kKSk7XG5cblx0XHRcdHRoaXMudG9rZW5Db2xvckluZGV4ID0gaW5kZXg7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnRva2VuQ29sb3JJbmRleDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdG9rZW5Db2xvck1hcCgpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VG9rZW5Db2xvckluZGV4KCkuYXNBcnJheSgpO1xuXHR9XG5cblx0cHVibGljIGdldFRva2VuU3R5bGVNZXRhZGF0YSh0eXBlV2l0aExhbmd1YWdlOiBzdHJpbmcsIG1vZGlmaWVyczogc3RyaW5nW10sIGRlZmF1bHRMYW5ndWFnZTogc3RyaW5nLCB1c2VEZWZhdWx0ID0gdHJ1ZSwgZGVmaW5pdGlvbnM6IFRva2VuU3R5bGVEZWZpbml0aW9ucyA9IHt9KTogSVRva2VuU3R5bGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsgdHlwZSwgbGFuZ3VhZ2UgfSA9IHBhcnNlQ2xhc3NpZmllclN0cmluZyh0eXBlV2l0aExhbmd1YWdlLCBkZWZhdWx0TGFuZ3VhZ2UpO1xuXHRcdGNvbnN0IHN0eWxlID0gdGhpcy5nZXRUb2tlblN0eWxlKHR5cGUsIG1vZGlmaWVycywgbGFuZ3VhZ2UsIHVzZURlZmF1bHQsIGRlZmluaXRpb25zKTtcblx0XHRpZiAoIXN0eWxlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRmb3JlZ3JvdW5kOiB0aGlzLmdldFRva2VuQ29sb3JJbmRleCgpLmdldChzdHlsZS5mb3JlZ3JvdW5kKSxcblx0XHRcdGJvbGQ6IHN0eWxlLmJvbGQsXG5cdFx0XHR1bmRlcmxpbmU6IHN0eWxlLnVuZGVybGluZSxcblx0XHRcdHN0cmlrZXRocm91Z2g6IHN0eWxlLnN0cmlrZXRocm91Z2gsXG5cdFx0XHRpdGFsaWM6IHN0eWxlLml0YWxpYyxcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldFRva2VuU3R5bGluZ1J1bGVTY29wZShydWxlOiBTZW1hbnRpY1Rva2VuUnVsZSk6ICdzZXR0aW5nJyB8ICd0aGVtZScgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmN1c3RvbVNlbWFudGljVG9rZW5SdWxlcy5pbmRleE9mKHJ1bGUpICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuICdzZXR0aW5nJztcblx0XHR9XG5cdFx0aWYgKHRoaXMuc2VtYW50aWNUb2tlblJ1bGVzLmluZGV4T2YocnVsZSkgIT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gJ3RoZW1lJztcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBnZXREZWZhdWx0KGNvbG9ySWQ6IENvbG9ySWRlbnRpZmllcik6IENvbG9yIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gY29sb3JSZWdpc3RyeS5yZXNvbHZlRGVmYXVsdENvbG9yKGNvbG9ySWQsIHRoaXMpO1xuXHR9XG5cblxuXHRwdWJsaWMgcmVzb2x2ZVNjb3BlcyhzY29wZXM6IFByb2JlU2NvcGVbXSwgZGVmaW5pdGlvbnM/OiBUZXh0TWF0ZVRoZW1pbmdSdWxlRGVmaW5pdGlvbnMpOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkIHtcblxuXHRcdGlmICghdGhpcy50aGVtZVRva2VuU2NvcGVNYXRjaGVycykge1xuXHRcdFx0dGhpcy50aGVtZVRva2VuU2NvcGVNYXRjaGVycyA9IHRoaXMudGhlbWVUb2tlbkNvbG9ycy5tYXAoZ2V0U2NvcGVNYXRjaGVyKTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmN1c3RvbVRva2VuU2NvcGVNYXRjaGVycykge1xuXHRcdFx0dGhpcy5jdXN0b21Ub2tlblNjb3BlTWF0Y2hlcnMgPSB0aGlzLmN1c3RvbVRva2VuQ29sb3JzLm1hcChnZXRTY29wZU1hdGNoZXIpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgc2NvcGUgb2Ygc2NvcGVzKSB7XG5cdFx0XHRsZXQgZm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGZvbnRTdHlsZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGZvcmVncm91bmRTY29yZSA9IC0xO1xuXHRcdFx0bGV0IGZvbnRTdHlsZVNjb3JlID0gLTE7XG5cdFx0XHRsZXQgZm9udFN0eWxlVGhlbWluZ1J1bGU6IElUZXh0TWF0ZVRoZW1pbmdSdWxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGZvcmVncm91bmRUaGVtaW5nUnVsZTogSVRleHRNYXRlVGhlbWluZ1J1bGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGZ1bmN0aW9uIGZpbmRUb2tlblN0eWxlRm9yU2NvcGVJblNjb3BlcyhzY29wZU1hdGNoZXJzOiBNYXRjaGVyPFByb2JlU2NvcGU+W10sIHRoZW1pbmdSdWxlczogSVRleHRNYXRlVGhlbWluZ1J1bGVbXSkge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNjb3BlTWF0Y2hlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBzY29yZSA9IHNjb3BlTWF0Y2hlcnNbaV0oc2NvcGUpO1xuXHRcdFx0XHRcdGlmIChzY29yZSA+PSAwKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0aGVtaW5nUnVsZSA9IHRoZW1pbmdSdWxlc1tpXTtcblx0XHRcdFx0XHRcdGNvbnN0IHNldHRpbmdzID0gdGhlbWluZ1J1bGVzW2ldLnNldHRpbmdzO1xuXHRcdFx0XHRcdFx0aWYgKHNjb3JlID49IGZvcmVncm91bmRTY29yZSAmJiBzZXR0aW5ncy5mb3JlZ3JvdW5kKSB7XG5cdFx0XHRcdFx0XHRcdGZvcmVncm91bmQgPSBzZXR0aW5ncy5mb3JlZ3JvdW5kO1xuXHRcdFx0XHRcdFx0XHRmb3JlZ3JvdW5kU2NvcmUgPSBzY29yZTtcblx0XHRcdFx0XHRcdFx0Zm9yZWdyb3VuZFRoZW1pbmdSdWxlID0gdGhlbWluZ1J1bGU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoc2NvcmUgPj0gZm9udFN0eWxlU2NvcmUgJiYgdHlwZXMuaXNTdHJpbmcoc2V0dGluZ3MuZm9udFN0eWxlKSkge1xuXHRcdFx0XHRcdFx0XHRmb250U3R5bGUgPSBzZXR0aW5ncy5mb250U3R5bGU7XG5cdFx0XHRcdFx0XHRcdGZvbnRTdHlsZVNjb3JlID0gc2NvcmU7XG5cdFx0XHRcdFx0XHRcdGZvbnRTdHlsZVRoZW1pbmdSdWxlID0gdGhlbWluZ1J1bGU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmaW5kVG9rZW5TdHlsZUZvclNjb3BlSW5TY29wZXModGhpcy50aGVtZVRva2VuU2NvcGVNYXRjaGVycywgdGhpcy50aGVtZVRva2VuQ29sb3JzKTtcblx0XHRcdGZpbmRUb2tlblN0eWxlRm9yU2NvcGVJblNjb3Blcyh0aGlzLmN1c3RvbVRva2VuU2NvcGVNYXRjaGVycywgdGhpcy5jdXN0b21Ub2tlbkNvbG9ycyk7XG5cdFx0XHRpZiAoZm9yZWdyb3VuZCAhPT0gdW5kZWZpbmVkIHx8IGZvbnRTdHlsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGlmIChkZWZpbml0aW9ucykge1xuXHRcdFx0XHRcdGRlZmluaXRpb25zLmZvcmVncm91bmQgPSBmb3JlZ3JvdW5kVGhlbWluZ1J1bGU7XG5cdFx0XHRcdFx0ZGVmaW5pdGlvbnMuYm9sZCA9IGRlZmluaXRpb25zLml0YWxpYyA9IGRlZmluaXRpb25zLnVuZGVybGluZSA9IGRlZmluaXRpb25zLnN0cmlrZXRocm91Z2ggPSBmb250U3R5bGVUaGVtaW5nUnVsZTtcblx0XHRcdFx0XHRkZWZpbml0aW9ucy5zY29wZSA9IHNjb3BlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIFRva2VuU3R5bGUuZnJvbVNldHRpbmdzKGZvcmVncm91bmQsIGZvbnRTdHlsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZGVmaW5lcyhjb2xvcklkOiBDb2xvcklkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCBjdXN0b21Db2xvciA9IHRoaXMuY3VzdG9tQ29sb3JNYXBbY29sb3JJZF07XG5cdFx0aWYgKGN1c3RvbUNvbG9yIGluc3RhbmNlb2YgQ29sb3IpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gY3VzdG9tQ29sb3IgPT09IHVuZGVmaW5lZCAvKiAhPT0gREVGQVVMVF9DT0xPUl9DT05GSUdfVkFMVUUgKi8gJiYgdGhpcy5jb2xvck1hcC5oYXNPd25Qcm9wZXJ0eShjb2xvcklkKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDdXN0b21pemF0aW9ucyhzZXR0aW5nczogVGhlbWVDb25maWd1cmF0aW9uKSB7XG5cdFx0dGhpcy5zZXRDdXN0b21Db2xvcnMoc2V0dGluZ3MuY29sb3JDdXN0b21pemF0aW9ucyk7XG5cdFx0dGhpcy5zZXRDdXN0b21Ub2tlbkNvbG9ycyhzZXR0aW5ncy50b2tlbkNvbG9yQ3VzdG9taXphdGlvbnMpO1xuXHRcdHRoaXMuc2V0Q3VzdG9tU2VtYW50aWNUb2tlbkNvbG9ycyhzZXR0aW5ncy5zZW1hbnRpY1Rva2VuQ29sb3JDdXN0b21pemF0aW9ucyk7XG5cdH1cblxuXHRwdWJsaWMgc2V0Q3VzdG9tQ29sb3JzKGNvbG9yczogSUNvbG9yQ3VzdG9taXphdGlvbnMpIHtcblx0XHR0aGlzLmN1c3RvbUNvbG9yTWFwID0ge307XG5cdFx0dGhpcy5vdmVyd3JpdGVDdXN0b21Db2xvcnMoY29sb3JzKTtcblxuXHRcdGNvbnN0IHRoZW1lU3BlY2lmaWNDb2xvcnMgPSB0aGlzLmdldFRoZW1lU3BlY2lmaWNDb2xvcnMoY29sb3JzKSBhcyBJQ29sb3JDdXN0b21pemF0aW9ucztcblx0XHRpZiAodHlwZXMuaXNPYmplY3QodGhlbWVTcGVjaWZpY0NvbG9ycykpIHtcblx0XHRcdHRoaXMub3ZlcndyaXRlQ3VzdG9tQ29sb3JzKHRoZW1lU3BlY2lmaWNDb2xvcnMpO1xuXHRcdH1cblxuXHRcdHRoaXMudG9rZW5Db2xvckluZGV4ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudGV4dE1hdGVUaGVtaW5nUnVsZXMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jdXN0b21Ub2tlblNjb3BlTWF0Y2hlcnMgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIG92ZXJ3cml0ZUN1c3RvbUNvbG9ycyhjb2xvcnM6IElDb2xvckN1c3RvbWl6YXRpb25zKSB7XG5cdFx0Zm9yIChjb25zdCBpZCBpbiBjb2xvcnMpIHtcblx0XHRcdGNvbnN0IGNvbG9yVmFsID0gY29sb3JzW2lkXTtcblx0XHRcdGlmIChjb2xvclZhbCA9PT0gREVGQVVMVF9DT0xPUl9DT05GSUdfVkFMVUUpIHtcblx0XHRcdFx0dGhpcy5jdXN0b21Db2xvck1hcFtpZF0gPSBERUZBVUxUX0NPTE9SX0NPTkZJR19WQUxVRTtcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yVmFsID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aGlzLmN1c3RvbUNvbG9yTWFwW2lkXSA9IENvbG9yLmZyb21IZXgoY29sb3JWYWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzZXRDdXN0b21Ub2tlbkNvbG9ycyhjdXN0b21Ub2tlbkNvbG9yczogSVRva2VuQ29sb3JDdXN0b21pemF0aW9ucykge1xuXHRcdHRoaXMuY3VzdG9tVG9rZW5Db2xvcnMgPSBbXTtcblx0XHR0aGlzLmN1c3RvbVNlbWFudGljSGlnaGxpZ2h0aW5nRGVwcmVjYXRlZCA9IHVuZGVmaW5lZDtcblxuXHRcdC8vIGZpcnN0IGFkZCB0aGUgbm9uLXRoZW1lIHNwZWNpZmljIHNldHRpbmdzXG5cdFx0dGhpcy5hZGRDdXN0b21Ub2tlbkNvbG9ycyhjdXN0b21Ub2tlbkNvbG9ycyk7XG5cblx0XHQvLyBhcHBlbmQgdGhlbWUgc3BlY2lmaWMgc2V0dGluZ3MuIExhc3QgcnVsZXMgd2lsbCB3aW4uXG5cdFx0Y29uc3QgdGhlbWVTcGVjaWZpY1Rva2VuQ29sb3JzID0gdGhpcy5nZXRUaGVtZVNwZWNpZmljQ29sb3JzKGN1c3RvbVRva2VuQ29sb3JzKSBhcyBJVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zO1xuXHRcdGlmICh0eXBlcy5pc09iamVjdCh0aGVtZVNwZWNpZmljVG9rZW5Db2xvcnMpKSB7XG5cdFx0XHR0aGlzLmFkZEN1c3RvbVRva2VuQ29sb3JzKHRoZW1lU3BlY2lmaWNUb2tlbkNvbG9ycyk7XG5cdFx0fVxuXG5cdFx0dGhpcy50b2tlbkNvbG9ySW5kZXggPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy50ZXh0TWF0ZVRoZW1pbmdSdWxlcyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmN1c3RvbVRva2VuU2NvcGVNYXRjaGVycyA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBzZXRDdXN0b21TZW1hbnRpY1Rva2VuQ29sb3JzKHNlbWFudGljVG9rZW5Db2xvcnM6IElTZW1hbnRpY1Rva2VuQ29sb3JDdXN0b21pemF0aW9ucyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuY3VzdG9tU2VtYW50aWNUb2tlblJ1bGVzID0gW107XG5cdFx0dGhpcy5jdXN0b21TZW1hbnRpY0hpZ2hsaWdodGluZyA9IHVuZGVmaW5lZDtcblxuXHRcdGlmIChzZW1hbnRpY1Rva2VuQ29sb3JzKSB7XG5cdFx0XHR0aGlzLmN1c3RvbVNlbWFudGljSGlnaGxpZ2h0aW5nID0gc2VtYW50aWNUb2tlbkNvbG9ycy5lbmFibGVkO1xuXHRcdFx0aWYgKHNlbWFudGljVG9rZW5Db2xvcnMucnVsZXMpIHtcblx0XHRcdFx0dGhpcy5yZWFkU2VtYW50aWNUb2tlblJ1bGVzKHNlbWFudGljVG9rZW5Db2xvcnMucnVsZXMpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdGhlbWVTcGVjaWZpY0NvbG9ycyA9IHRoaXMuZ2V0VGhlbWVTcGVjaWZpY0NvbG9ycyhzZW1hbnRpY1Rva2VuQ29sb3JzKSBhcyBJU2VtYW50aWNUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnM7XG5cdFx0XHRpZiAodHlwZXMuaXNPYmplY3QodGhlbWVTcGVjaWZpY0NvbG9ycykpIHtcblx0XHRcdFx0aWYgKHRoZW1lU3BlY2lmaWNDb2xvcnMuZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXN0b21TZW1hbnRpY0hpZ2hsaWdodGluZyA9IHRoZW1lU3BlY2lmaWNDb2xvcnMuZW5hYmxlZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhlbWVTcGVjaWZpY0NvbG9ycy5ydWxlcykge1xuXHRcdFx0XHRcdHRoaXMucmVhZFNlbWFudGljVG9rZW5SdWxlcyh0aGVtZVNwZWNpZmljQ29sb3JzLnJ1bGVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudG9rZW5Db2xvckluZGV4ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudGV4dE1hdGVUaGVtaW5nUnVsZXMgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgaXNUaGVtZVNjb3BlKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGtleS5jaGFyQXQoMCkgPT09IFRIRU1FX1NDT1BFX09QRU5fUEFSRU4gJiYga2V5LmNoYXJBdChrZXkubGVuZ3RoIC0gMSkgPT09IFRIRU1FX1NDT1BFX0NMT1NFX1BBUkVOO1xuXHR9XG5cblx0cHVibGljIGlzVGhlbWVTY29wZU1hdGNoKHRoZW1lSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRoZW1lSWRGaXJzdENoYXIgPSB0aGVtZUlkLmNoYXJBdCgwKTtcblx0XHRjb25zdCB0aGVtZUlkTGFzdENoYXIgPSB0aGVtZUlkLmNoYXJBdCh0aGVtZUlkLmxlbmd0aCAtIDEpO1xuXHRcdGNvbnN0IHRoZW1lSWRQcmVmaXggPSB0aGVtZUlkLnNsaWNlKDAsIC0xKTtcblx0XHRjb25zdCB0aGVtZUlkSW5maXggPSB0aGVtZUlkLnNsaWNlKDEsIC0xKTtcblx0XHRjb25zdCB0aGVtZUlkU3VmZml4ID0gdGhlbWVJZC5zbGljZSgxKTtcblx0XHRyZXR1cm4gdGhlbWVJZCA9PT0gdGhpcy5zZXR0aW5nc0lkXG5cdFx0XHR8fCAodGhpcy5zZXR0aW5nc0lkLmluY2x1ZGVzKHRoZW1lSWRJbmZpeCkgJiYgdGhlbWVJZEZpcnN0Q2hhciA9PT0gVEhFTUVfU0NPUEVfV0lMRENBUkQgJiYgdGhlbWVJZExhc3RDaGFyID09PSBUSEVNRV9TQ09QRV9XSUxEQ0FSRClcblx0XHRcdHx8ICh0aGlzLnNldHRpbmdzSWQuc3RhcnRzV2l0aCh0aGVtZUlkUHJlZml4KSAmJiB0aGVtZUlkTGFzdENoYXIgPT09IFRIRU1FX1NDT1BFX1dJTERDQVJEKVxuXHRcdFx0fHwgKHRoaXMuc2V0dGluZ3NJZC5lbmRzV2l0aCh0aGVtZUlkU3VmZml4KSAmJiB0aGVtZUlkRmlyc3RDaGFyID09PSBUSEVNRV9TQ09QRV9XSUxEQ0FSRCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGhlbWVTcGVjaWZpY0NvbG9ycyhjb2xvcnM6IElUaGVtZVNjb3BhYmxlQ3VzdG9taXphdGlvbnMpOiBJVGhlbWVTY29wZWRDdXN0b21pemF0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHRoZW1lU3BlY2lmaWNDb2xvcnM6IElUaGVtZVNjb3BlZEN1c3RvbWl6YXRpb25zIHwgdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3Qga2V5IGluIGNvbG9ycykge1xuXHRcdFx0Y29uc3Qgc2NvcGVkQ29sb3JzID0gY29sb3JzW2tleV07XG5cdFx0XHRpZiAodGhpcy5pc1RoZW1lU2NvcGUoa2V5KSAmJiBzY29wZWRDb2xvcnMgaW5zdGFuY2VvZiBPYmplY3QgJiYgIUFycmF5LmlzQXJyYXkoc2NvcGVkQ29sb3JzKSkge1xuXHRcdFx0XHRjb25zdCB0aGVtZVNjb3BlTGlzdCA9IGtleS5tYXRjaCh0aGVtZVNjb3BlUmVnZXgpIHx8IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHRoZW1lU2NvcGUgb2YgdGhlbWVTY29wZUxpc3QpIHtcblx0XHRcdFx0XHRjb25zdCB0aGVtZUlkID0gdGhlbWVTY29wZS5zdWJzdHJpbmcoMSwgdGhlbWVTY29wZS5sZW5ndGggLSAxKTtcblx0XHRcdFx0XHRpZiAodGhpcy5pc1RoZW1lU2NvcGVNYXRjaCh0aGVtZUlkKSkge1xuXHRcdFx0XHRcdFx0aWYgKCF0aGVtZVNwZWNpZmljQ29sb3JzKSB7XG5cdFx0XHRcdFx0XHRcdHRoZW1lU3BlY2lmaWNDb2xvcnMgPSB7fTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IHNjb3BlZFRoZW1lU3BlY2lmaWNDb2xvcnMgPSBzY29wZWRDb2xvcnMgYXMgSVRoZW1lU2NvcGVkQ3VzdG9taXphdGlvbnM7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHN1YmtleSBpbiBzY29wZWRUaGVtZVNwZWNpZmljQ29sb3JzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsQ29sb3JzID0gdGhlbWVTcGVjaWZpY0NvbG9yc1tzdWJrZXldO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvdmVycmlkZUNvbG9ycyA9IHNjb3BlZFRoZW1lU3BlY2lmaWNDb2xvcnNbc3Via2V5XTtcblx0XHRcdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkob3JpZ2luYWxDb2xvcnMpICYmIEFycmF5LmlzQXJyYXkob3ZlcnJpZGVDb2xvcnMpKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhlbWVTcGVjaWZpY0NvbG9yc1tzdWJrZXldID0gb3JpZ2luYWxDb2xvcnMuY29uY2F0KG92ZXJyaWRlQ29sb3JzKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChvdmVycmlkZUNvbG9ycykge1xuXHRcdFx0XHRcdFx0XHRcdHRoZW1lU3BlY2lmaWNDb2xvcnNbc3Via2V5XSA9IG92ZXJyaWRlQ29sb3JzO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGVtZVNwZWNpZmljQ29sb3JzO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkU2VtYW50aWNUb2tlblJ1bGVzKHRva2VuU3R5bGluZ1J1bGVTZWN0aW9uOiBJU2VtYW50aWNUb2tlblJ1bGVzKSB7XG5cdFx0Zm9yIChjb25zdCBrZXkgaW4gdG9rZW5TdHlsaW5nUnVsZVNlY3Rpb24pIHtcblx0XHRcdGlmICghdGhpcy5pc1RoZW1lU2NvcGUoa2V5KSkgeyAvLyBzdGlsbCBkbyB0aGlzIHRlc3QgdW50aWwgZXhwZXJpbWVudGFsIHNldHRpbmdzIGFyZSBnb25lXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcnVsZSA9IHJlYWRTZW1hbnRpY1Rva2VuUnVsZShrZXksIHRva2VuU3R5bGluZ1J1bGVTZWN0aW9uW2tleV0pO1xuXHRcdFx0XHRcdGlmIChydWxlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmN1c3RvbVNlbWFudGljVG9rZW5SdWxlcy5wdXNoKHJ1bGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdC8vIGludmFsaWQgc2VsZWN0b3IsIGlnbm9yZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhZGRDdXN0b21Ub2tlbkNvbG9ycyhjdXN0b21Ub2tlbkNvbG9yczogSVRva2VuQ29sb3JDdXN0b21pemF0aW9ucykge1xuXHRcdC8vIFB1dCB0aGUgZ2VuZXJhbCBjdXN0b21pemF0aW9ucyBzdWNoIGFzIGNvbW1lbnRzLCBzdHJpbmdzLCBldGMuIGZpcnN0IHNvIHRoYXRcblx0XHQvLyB0aGV5IGNhbiBiZSBvdmVycmlkZGVuIGJ5IHNwZWNpZmljIGN1c3RvbWl6YXRpb25zIGxpa2UgXCJzdHJpbmcuaW50ZXJwb2xhdGVkXCJcblx0XHRmb3IgKGNvbnN0IHRva2VuR3JvdXAgaW4gdG9rZW5Hcm91cFRvU2NvcGVzTWFwKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IDxrZXlvZiB0eXBlb2YgdG9rZW5Hcm91cFRvU2NvcGVzTWFwPnRva2VuR3JvdXA7IC8vIFRTIGRvZXNuJ3QgdHlwZSAndG9rZW5Hcm91cCcgcHJvcGVybHlcblx0XHRcdGNvbnN0IHZhbHVlID0gY3VzdG9tVG9rZW5Db2xvcnNbZ3JvdXBdO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdGNvbnN0IHNldHRpbmdzID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHsgZm9yZWdyb3VuZDogdmFsdWUgfSA6IHZhbHVlO1xuXHRcdFx0XHRjb25zdCBzY29wZXMgPSB0b2tlbkdyb3VwVG9TY29wZXNNYXBbZ3JvdXBdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNjb3BlIG9mIHNjb3Blcykge1xuXHRcdFx0XHRcdHRoaXMuY3VzdG9tVG9rZW5Db2xvcnMucHVzaCh7IHNjb3BlLCBzZXR0aW5ncyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNwZWNpZmljIGN1c3RvbWl6YXRpb25zXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY3VzdG9tVG9rZW5Db2xvcnMudGV4dE1hdGVSdWxlcykpIHtcblx0XHRcdGZvciAoY29uc3QgcnVsZSBvZiBjdXN0b21Ub2tlbkNvbG9ycy50ZXh0TWF0ZVJ1bGVzKSB7XG5cdFx0XHRcdGlmIChydWxlLnNjb3BlICYmIHJ1bGUuc2V0dGluZ3MpIHtcblx0XHRcdFx0XHR0aGlzLmN1c3RvbVRva2VuQ29sb3JzLnB1c2gocnVsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGN1c3RvbVRva2VuQ29sb3JzLnNlbWFudGljSGlnaGxpZ2h0aW5nICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuY3VzdG9tU2VtYW50aWNIaWdobGlnaHRpbmdEZXByZWNhdGVkID0gY3VzdG9tVG9rZW5Db2xvcnMuc2VtYW50aWNIaWdobGlnaHRpbmc7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGVuc3VyZUxvYWRlZChleHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2U6IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gIXRoaXMuaXNMb2FkZWQgPyB0aGlzLmxvYWQoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlKSA6IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHVibGljIHJlbG9hZChleHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2U6IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5sb2FkKGV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGxvYWQoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmxvY2F0aW9uKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMudGhlbWVUb2tlbkNvbG9ycyA9IFtdO1xuXHRcdHRoaXMuY2xlYXJDYWNoZXMoKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHtcblx0XHRcdGNvbG9yczoge30sXG5cdFx0XHR0ZXh0TWF0ZVJ1bGVzOiBbXSxcblx0XHRcdHNlbWFudGljVG9rZW5SdWxlczogW10sXG5cdFx0XHRzZW1hbnRpY0hpZ2hsaWdodGluZzogZmFsc2Vcblx0XHR9O1xuXHRcdHJldHVybiBfbG9hZENvbG9yVGhlbWUoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCB0aGlzLmxvY2F0aW9uLCByZXN1bHQpLnRoZW4oXyA9PiB7XG5cdFx0XHR0aGlzLmlzTG9hZGVkID0gdHJ1ZTtcblx0XHRcdHRoaXMuc2VtYW50aWNUb2tlblJ1bGVzID0gcmVzdWx0LnNlbWFudGljVG9rZW5SdWxlcztcblx0XHRcdHRoaXMuY29sb3JNYXAgPSByZXN1bHQuY29sb3JzO1xuXHRcdFx0dGhpcy50aGVtZVRva2VuQ29sb3JzID0gcmVzdWx0LnRleHRNYXRlUnVsZXM7XG5cdFx0XHR0aGlzLnRoZW1lU2VtYW50aWNIaWdobGlnaHRpbmcgPSByZXN1bHQuc2VtYW50aWNIaWdobGlnaHRpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJDYWNoZXMoKSB7XG5cdFx0dGhpcy50b2tlbkNvbG9ySW5kZXggPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy50ZXh0TWF0ZVRoZW1pbmdSdWxlcyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLnRoZW1lVG9rZW5TY29wZU1hdGNoZXJzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuY3VzdG9tVG9rZW5TY29wZU1hdGNoZXJzID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0dG9TdG9yYWdlKHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpIHtcblx0XHRjb25zdCBjb2xvck1hcERhdGE6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiB0aGlzLmNvbG9yTWFwKSB7XG5cdFx0XHRjb2xvck1hcERhdGFba2V5XSA9IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4QSh0aGlzLmNvbG9yTWFwW2tleV0sIHRydWUpO1xuXHRcdH1cblx0XHQvLyBubyBuZWVkIHRvIHBlcnNpc3QgY3VzdG9tIGNvbG9ycywgdGhleSB3aWxsIGJlIHRha2VuIGZyb20gdGhlIHNldHRpbmdzXG5cdFx0Y29uc3QgdmFsdWUgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRpZDogdGhpcy5pZCxcblx0XHRcdGxhYmVsOiB0aGlzLmxhYmVsLFxuXHRcdFx0c2V0dGluZ3NJZDogdGhpcy5zZXR0aW5nc0lkLFxuXHRcdFx0dGhlbWVUb2tlbkNvbG9yczogdGhpcy50aGVtZVRva2VuQ29sb3JzLm1hcCh0YyA9PiAoeyBzZXR0aW5nczogdGMuc2V0dGluZ3MsIHNjb3BlOiB0Yy5zY29wZSB9KSksIC8vIGRvbid0IHBlcnNpc3QgbmFtZXNcblx0XHRcdHNlbWFudGljVG9rZW5SdWxlczogdGhpcy5zZW1hbnRpY1Rva2VuUnVsZXMubWFwKFNlbWFudGljVG9rZW5SdWxlLnRvSlNPTk9iamVjdCksXG5cdFx0XHRleHRlbnNpb25EYXRhOiBFeHRlbnNpb25EYXRhLnRvSlNPTk9iamVjdCh0aGlzLmV4dGVuc2lvbkRhdGEpLFxuXHRcdFx0dGhlbWVTZW1hbnRpY0hpZ2hsaWdodGluZzogdGhpcy50aGVtZVNlbWFudGljSGlnaGxpZ2h0aW5nLFxuXHRcdFx0Y29sb3JNYXA6IGNvbG9yTWFwRGF0YSxcblx0XHRcdHdhdGNoOiB0aGlzLndhdGNoXG5cdFx0fSk7XG5cblx0XHQvLyByb2FtIHBlcnNpc3RlZCBjb2xvciB0aGVtZSBjb2xvcnMuIERvbid0IGVuYWJsZSBmb3IgaWNvbnMgYXMgdGhleSBjb250YWluIHJlZmVyZW5jZXMgdG8gZm9udHMgYW5kIGltYWdlcy5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShDb2xvclRoZW1lRGF0YS5TVE9SQUdFX0tFWSwgdmFsdWUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0Z2V0IHRoZW1lVHlwZVNlbGVjdG9yKCk6IFRoZW1lVHlwZVNlbGVjdG9yIHtcblx0XHRyZXR1cm4gdGhpcy5jbGFzc05hbWVzWzBdIGFzIFRoZW1lVHlwZVNlbGVjdG9yO1xuXHR9XG5cblx0Z2V0IGNsYXNzTmFtZXMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLmlkLnNwbGl0KCcgJyk7XG5cdH1cblxuXHRnZXQgdHlwZSgpOiBDb2xvclNjaGVtZSB7XG5cdFx0c3dpdGNoICh0aGlzLnRoZW1lVHlwZVNlbGVjdG9yKSB7XG5cdFx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLlZTOiByZXR1cm4gQ29sb3JTY2hlbWUuTElHSFQ7XG5cdFx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLkhDX0JMQUNLOiByZXR1cm4gQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9EQVJLO1xuXHRcdFx0Y2FzZSBUaGVtZVR5cGVTZWxlY3Rvci5IQ19MSUdIVDogcmV0dXJuIENvbG9yU2NoZW1lLkhJR0hfQ09OVFJBU1RfTElHSFQ7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gQ29sb3JTY2hlbWUuREFSSztcblx0XHR9XG5cdH1cblxuXHQvLyBjb25zdHJ1Y3RvcnNcblxuXHRzdGF0aWMgY3JlYXRlVW5sb2FkZWRUaGVtZUZvclRoZW1lVHlwZSh0aGVtZVR5cGU6IENvbG9yU2NoZW1lLCBjb2xvck1hcD86IHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfSk6IENvbG9yVGhlbWVEYXRhIHtcblx0XHRyZXR1cm4gQ29sb3JUaGVtZURhdGEuY3JlYXRlVW5sb2FkZWRUaGVtZShnZXRUaGVtZVR5cGVTZWxlY3Rvcih0aGVtZVR5cGUpLCBjb2xvck1hcCk7XG5cdH1cblxuXHRzdGF0aWMgY3JlYXRlVW5sb2FkZWRUaGVtZShpZDogc3RyaW5nLCBjb2xvck1hcD86IHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfSk6IENvbG9yVGhlbWVEYXRhIHtcblx0XHRjb25zdCB0aGVtZURhdGEgPSBuZXcgQ29sb3JUaGVtZURhdGEoaWQsICcnLCAnX18nICsgaWQpO1xuXHRcdHRoZW1lRGF0YS5pc0xvYWRlZCA9IGZhbHNlO1xuXHRcdHRoZW1lRGF0YS50aGVtZVRva2VuQ29sb3JzID0gW107XG5cdFx0dGhlbWVEYXRhLndhdGNoID0gZmFsc2U7XG5cdFx0aWYgKGNvbG9yTWFwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGlkIGluIGNvbG9yTWFwKSB7XG5cdFx0XHRcdHRoZW1lRGF0YS5jb2xvck1hcFtpZF0gPSBDb2xvci5mcm9tSGV4KGNvbG9yTWFwW2lkXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGVtZURhdGE7XG5cdH1cblxuXHRzdGF0aWMgY3JlYXRlTG9hZGVkRW1wdHlUaGVtZShpZDogc3RyaW5nLCBzZXR0aW5nc0lkOiBzdHJpbmcpOiBDb2xvclRoZW1lRGF0YSB7XG5cdFx0Y29uc3QgdGhlbWVEYXRhID0gbmV3IENvbG9yVGhlbWVEYXRhKGlkLCAnJywgc2V0dGluZ3NJZCk7XG5cdFx0dGhlbWVEYXRhLmlzTG9hZGVkID0gdHJ1ZTtcblx0XHR0aGVtZURhdGEudGhlbWVUb2tlbkNvbG9ycyA9IFtdO1xuXHRcdHRoZW1lRGF0YS53YXRjaCA9IGZhbHNlO1xuXHRcdHJldHVybiB0aGVtZURhdGE7XG5cdH1cblxuXHRzdGF0aWMgZnJvbVN0b3JhZ2VEYXRhKHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpOiBDb2xvclRoZW1lRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yYWdlU2VydmljZS5nZXQoQ29sb3JUaGVtZURhdGEuU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRpZiAoIWlucHV0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IEpTT04ucGFyc2UoaW5wdXQpO1xuXHRcdFx0Y29uc3QgdGhlbWUgPSBuZXcgQ29sb3JUaGVtZURhdGEoJycsICcnLCAnJyk7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBkYXRhKSB7XG5cdFx0XHRcdHN3aXRjaCAoa2V5KSB7XG5cdFx0XHRcdFx0Y2FzZSAnY29sb3JNYXAnOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb2xvck1hcERhdGEgPSBkYXRhW2tleV07XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGlkIGluIGNvbG9yTWFwRGF0YSkge1xuXHRcdFx0XHRcdFx0XHR0aGVtZS5jb2xvck1hcFtpZF0gPSBDb2xvci5mcm9tSGV4KGNvbG9yTWFwRGF0YVtpZF0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJ3RoZW1lVG9rZW5Db2xvcnMnOlxuXHRcdFx0XHRcdGNhc2UgJ2lkJzogY2FzZSAnbGFiZWwnOiBjYXNlICdzZXR0aW5nc0lkJzogY2FzZSAnd2F0Y2gnOiBjYXNlICd0aGVtZVNlbWFudGljSGlnaGxpZ2h0aW5nJzpcblx0XHRcdFx0XHRcdCh0aGVtZSBhcyBhbnkpW2tleV0gPSBkYXRhW2tleV07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdzZW1hbnRpY1Rva2VuUnVsZXMnOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBydWxlc0RhdGEgPSBkYXRhW2tleV07XG5cdFx0XHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShydWxlc0RhdGEpKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgZCBvZiBydWxlc0RhdGEpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBydWxlID0gU2VtYW50aWNUb2tlblJ1bGUuZnJvbUpTT05PYmplY3QodG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LCBkKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAocnVsZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhlbWUuc2VtYW50aWNUb2tlblJ1bGVzLnB1c2gocnVsZSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2FzZSAnbG9jYXRpb24nOlxuXHRcdFx0XHRcdFx0Ly8gaWdub3JlLCBubyBsb25nZXIgcmVzdG9yZVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnZXh0ZW5zaW9uRGF0YSc6XG5cdFx0XHRcdFx0XHR0aGVtZS5leHRlbnNpb25EYXRhID0gRXh0ZW5zaW9uRGF0YS5mcm9tSlNPTk9iamVjdChkYXRhLmV4dGVuc2lvbkRhdGEpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghdGhlbWUuaWQgfHwgIXRoZW1lLnNldHRpbmdzSWQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGVtZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBmcm9tRXh0ZW5zaW9uVGhlbWUodGhlbWU6IElUaGVtZUV4dGVuc2lvblBvaW50LCBjb2xvclRoZW1lTG9jYXRpb246IFVSSSwgZXh0ZW5zaW9uRGF0YTogRXh0ZW5zaW9uRGF0YSk6IENvbG9yVGhlbWVEYXRhIHtcblx0XHRjb25zdCBiYXNlVGhlbWU6IHN0cmluZyA9IHRoZW1lWyd1aVRoZW1lJ10gfHwgJ3ZzLWRhcmsnO1xuXHRcdGNvbnN0IHRoZW1lU2VsZWN0b3IgPSB0b0NTU1NlbGVjdG9yKGV4dGVuc2lvbkRhdGEuZXh0ZW5zaW9uSWQsIHRoZW1lLnBhdGgpO1xuXHRcdGNvbnN0IGlkID0gYCR7YmFzZVRoZW1lfSAke3RoZW1lU2VsZWN0b3J9YDtcblx0XHRjb25zdCBsYWJlbCA9IHRoZW1lLmxhYmVsIHx8IGJhc2VuYW1lKHRoZW1lLnBhdGgpO1xuXHRcdGNvbnN0IHNldHRpbmdzSWQgPSB0aGVtZS5pZCB8fCBsYWJlbDtcblx0XHRjb25zdCB0aGVtZURhdGEgPSBuZXcgQ29sb3JUaGVtZURhdGEoaWQsIGxhYmVsLCBzZXR0aW5nc0lkKTtcblx0XHR0aGVtZURhdGEuZGVzY3JpcHRpb24gPSB0aGVtZS5kZXNjcmlwdGlvbjtcblx0XHR0aGVtZURhdGEud2F0Y2ggPSB0aGVtZS5fd2F0Y2ggPT09IHRydWU7XG5cdFx0dGhlbWVEYXRhLmxvY2F0aW9uID0gY29sb3JUaGVtZUxvY2F0aW9uO1xuXHRcdHRoZW1lRGF0YS5leHRlbnNpb25EYXRhID0gZXh0ZW5zaW9uRGF0YTtcblx0XHR0aGVtZURhdGEuaXNMb2FkZWQgPSBmYWxzZTtcblx0XHRyZXR1cm4gdGhlbWVEYXRhO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHRvQ1NTU2VsZWN0b3IoZXh0ZW5zaW9uSWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKSB7XG5cdGlmIChwYXRoLnN0YXJ0c1dpdGgoJy4vJykpIHtcblx0XHRwYXRoID0gcGF0aC5zdWJzdHIoMik7XG5cdH1cblx0bGV0IHN0ciA9IGAke2V4dGVuc2lvbklkfS0ke3BhdGh9YDtcblxuXHQvL3JlbW92ZSBhbGwgY2hhcmFjdGVycyB0aGF0IGFyZSBub3QgYWxsb3dlZCBpbiBjc3Ncblx0c3RyID0gc3RyLnJlcGxhY2UoL1teX2EtekEtWjAtOS1dL2csICctJyk7XG5cdGlmIChzdHIuY2hhckF0KDApLm1hdGNoKC9bMC05LV0vKSkge1xuXHRcdHN0ciA9ICdfJyArIHN0cjtcblx0fVxuXHRyZXR1cm4gc3RyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZENvbG9yVGhlbWUoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCB0aGVtZUxvY2F0aW9uOiBVUkksIHJlc3VsdDogeyB0ZXh0TWF0ZVJ1bGVzOiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdOyBjb2xvcnM6IElDb2xvck1hcDsgc2VtYW50aWNUb2tlblJ1bGVzOiBTZW1hbnRpY1Rva2VuUnVsZVtdOyBzZW1hbnRpY0hpZ2hsaWdodGluZzogYm9vbGVhbiB9KTogUHJvbWlzZTxhbnk+IHtcblx0aWYgKHJlc291cmNlcy5leHRuYW1lKHRoZW1lTG9jYXRpb24pID09PSAnLmpzb24nKSB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5yZWFkRXh0ZW5zaW9uUmVzb3VyY2UodGhlbWVMb2NhdGlvbik7XG5cdFx0Y29uc3QgZXJyb3JzOiBKc29uLlBhcnNlRXJyb3JbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbnRlbnRWYWx1ZSA9IEpzb24ucGFyc2UoY29udGVudCwgZXJyb3JzKTtcblx0XHRpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IobmxzLmxvY2FsaXplKCdlcnJvci5jYW5ub3RwYXJzZWpzb24nLCBcIlByb2JsZW1zIHBhcnNpbmcgSlNPTiB0aGVtZSBmaWxlOiB7MH1cIiwgZXJyb3JzLm1hcChlID0+IGdldFBhcnNlRXJyb3JNZXNzYWdlKGUuZXJyb3IpKS5qb2luKCcsICcpKSkpO1xuXHRcdH0gZWxzZSBpZiAoSnNvbi5nZXROb2RlVHlwZShjb250ZW50VmFsdWUpICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2Vycm9yLmludmFsaWRmb3JtYXQnLCBcIkludmFsaWQgZm9ybWF0IGZvciBKU09OIHRoZW1lIGZpbGU6IE9iamVjdCBleHBlY3RlZC5cIikpKTtcblx0XHR9XG5cdFx0aWYgKGNvbnRlbnRWYWx1ZS5pbmNsdWRlKSB7XG5cdFx0XHRhd2FpdCBfbG9hZENvbG9yVGhlbWUoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCByZXNvdXJjZXMuam9pblBhdGgocmVzb3VyY2VzLmRpcm5hbWUodGhlbWVMb2NhdGlvbiksIGNvbnRlbnRWYWx1ZS5pbmNsdWRlKSwgcmVzdWx0KTtcblx0XHR9XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY29udGVudFZhbHVlLnNldHRpbmdzKSkge1xuXHRcdFx0Y29udmVydFNldHRpbmdzKGNvbnRlbnRWYWx1ZS5zZXR0aW5ncywgcmVzdWx0KTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXN1bHQuc2VtYW50aWNIaWdobGlnaHRpbmcgPSByZXN1bHQuc2VtYW50aWNIaWdobGlnaHRpbmcgfHwgY29udGVudFZhbHVlLnNlbWFudGljSGlnaGxpZ2h0aW5nO1xuXHRcdGNvbnN0IGNvbG9ycyA9IGNvbnRlbnRWYWx1ZS5jb2xvcnM7XG5cdFx0aWYgKGNvbG9ycykge1xuXHRcdFx0aWYgKHR5cGVvZiBjb2xvcnMgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IobmxzLmxvY2FsaXplKHsga2V5OiAnZXJyb3IuaW52YWxpZGZvcm1hdC5jb2xvcnMnLCBjb21tZW50OiBbJ3swfSB3aWxsIGJlIHJlcGxhY2VkIGJ5IGEgcGF0aC4gVmFsdWVzIGluIHF1b3RlcyBzaG91bGQgbm90IGJlIHRyYW5zbGF0ZWQuJ10gfSwgXCJQcm9ibGVtIHBhcnNpbmcgY29sb3IgdGhlbWUgZmlsZTogezB9LiBQcm9wZXJ0eSAnY29sb3JzJyBpcyBub3Qgb2YgdHlwZSAnb2JqZWN0Jy5cIiwgdGhlbWVMb2NhdGlvbi50b1N0cmluZygpKSkpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gbmV3IEpTT04gY29sb3IgdGhlbWVzIGZvcm1hdFxuXHRcdFx0Zm9yIChjb25zdCBjb2xvcklkIGluIGNvbG9ycykge1xuXHRcdFx0XHRjb25zdCBjb2xvclZhbCA9IGNvbG9yc1tjb2xvcklkXTtcblx0XHRcdFx0aWYgKGNvbG9yVmFsID09PSBERUZBVUxUX0NPTE9SX0NPTkZJR19WQUxVRSkgeyAvLyBpZ25vcmUgY29sb3JzIHRoYXQgYXJlIHNldCB0byB0byBkZWZhdWx0XG5cdFx0XHRcdFx0ZGVsZXRlIHJlc3VsdC5jb2xvcnNbY29sb3JJZF07XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yVmFsID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHJlc3VsdC5jb2xvcnNbY29sb3JJZF0gPSBDb2xvci5mcm9tSGV4KGNvbG9yc1tjb2xvcklkXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgdG9rZW5Db2xvcnMgPSBjb250ZW50VmFsdWUudG9rZW5Db2xvcnM7XG5cdFx0aWYgKHRva2VuQ29sb3JzKSB7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh0b2tlbkNvbG9ycykpIHtcblx0XHRcdFx0cmVzdWx0LnRleHRNYXRlUnVsZXMucHVzaCguLi50b2tlbkNvbG9ycyk7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0b2tlbkNvbG9ycyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0YXdhaXQgX2xvYWRTeW50YXhUb2tlbnMoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCByZXNvdXJjZXMuam9pblBhdGgocmVzb3VyY2VzLmRpcm5hbWUodGhlbWVMb2NhdGlvbiksIHRva2VuQ29sb3JzKSwgcmVzdWx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IobmxzLmxvY2FsaXplKHsga2V5OiAnZXJyb3IuaW52YWxpZGZvcm1hdC50b2tlbkNvbG9ycycsIGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgcmVwbGFjZWQgYnkgYSBwYXRoLiBWYWx1ZXMgaW4gcXVvdGVzIHNob3VsZCBub3QgYmUgdHJhbnNsYXRlZC4nXSB9LCBcIlByb2JsZW0gcGFyc2luZyBjb2xvciB0aGVtZSBmaWxlOiB7MH0uIFByb3BlcnR5ICd0b2tlbkNvbG9ycycgc2hvdWxkIGJlIGVpdGhlciBhbiBhcnJheSBzcGVjaWZ5aW5nIGNvbG9ycyBvciBhIHBhdGggdG8gYSBUZXh0TWF0ZSB0aGVtZSBmaWxlXCIsIHRoZW1lTG9jYXRpb24udG9TdHJpbmcoKSkpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgc2VtYW50aWNUb2tlbkNvbG9ycyA9IGNvbnRlbnRWYWx1ZS5zZW1hbnRpY1Rva2VuQ29sb3JzO1xuXHRcdGlmIChzZW1hbnRpY1Rva2VuQ29sb3JzICYmIHR5cGVvZiBzZW1hbnRpY1Rva2VuQ29sb3JzID09PSAnb2JqZWN0Jykge1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gc2VtYW50aWNUb2tlbkNvbG9ycykge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJ1bGUgPSByZWFkU2VtYW50aWNUb2tlblJ1bGUoa2V5LCBzZW1hbnRpY1Rva2VuQ29sb3JzW2tleV0pO1xuXHRcdFx0XHRcdGlmIChydWxlKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQuc2VtYW50aWNUb2tlblJ1bGVzLnB1c2gocnVsZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoeyBrZXk6ICdlcnJvci5pbnZhbGlkZm9ybWF0LnNlbWFudGljVG9rZW5Db2xvcnMnLCBjb21tZW50OiBbJ3swfSB3aWxsIGJlIHJlcGxhY2VkIGJ5IGEgcGF0aC4gVmFsdWVzIGluIHF1b3RlcyBzaG91bGQgbm90IGJlIHRyYW5zbGF0ZWQuJ10gfSwgXCJQcm9ibGVtIHBhcnNpbmcgY29sb3IgdGhlbWUgZmlsZTogezB9LiBQcm9wZXJ0eSAnc2VtYW50aWNUb2tlbkNvbG9ycycgY29udGFpbnMgYSBpbnZhbGlkIHNlbGVjdG9yXCIsIHRoZW1lTG9jYXRpb24udG9TdHJpbmcoKSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gX2xvYWRTeW50YXhUb2tlbnMoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCB0aGVtZUxvY2F0aW9uLCByZXN1bHQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIF9sb2FkU3ludGF4VG9rZW5zKGV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZTogSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSwgdGhlbWVMb2NhdGlvbjogVVJJLCByZXN1bHQ6IHsgdGV4dE1hdGVSdWxlczogSVRleHRNYXRlVGhlbWluZ1J1bGVbXTsgY29sb3JzOiBJQ29sb3JNYXAgfSk6IFByb21pc2U8YW55PiB7XG5cdHJldHVybiBleHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UucmVhZEV4dGVuc2lvblJlc291cmNlKHRoZW1lTG9jYXRpb24pLnRoZW4oY29udGVudCA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRWYWx1ZSA9IHBhcnNlUExpc3QoY29udGVudCk7XG5cdFx0XHRjb25zdCBzZXR0aW5nczogSVRleHRNYXRlVGhlbWluZ1J1bGVbXSA9IGNvbnRlbnRWYWx1ZS5zZXR0aW5ncztcblx0XHRcdGlmICghQXJyYXkuaXNBcnJheShzZXR0aW5ncykpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2Vycm9yLnBsaXN0LmludmFsaWRmb3JtYXQnLCBcIlByb2JsZW0gcGFyc2luZyB0bVRoZW1lIGZpbGU6IHswfS4gJ3NldHRpbmdzJyBpcyBub3QgYXJyYXkuXCIpKSk7XG5cdFx0XHR9XG5cdFx0XHRjb252ZXJ0U2V0dGluZ3Moc2V0dGluZ3MsIHJlc3VsdCk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IobmxzLmxvY2FsaXplKCdlcnJvci5jYW5ub3RwYXJzZScsIFwiUHJvYmxlbXMgcGFyc2luZyB0bVRoZW1lIGZpbGU6IHswfVwiLCBlLm1lc3NhZ2UpKSk7XG5cdFx0fVxuXHR9LCBlcnJvciA9PiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2Vycm9yLmNhbm5vdGxvYWQnLCBcIlByb2JsZW1zIGxvYWRpbmcgdG1UaGVtZSBmaWxlIHswfTogezF9XCIsIHRoZW1lTG9jYXRpb24udG9TdHJpbmcoKSwgZXJyb3IubWVzc2FnZSkpKTtcblx0fSk7XG59XG5cbmNvbnN0IGRlZmF1bHRUaGVtZUNvbG9yczogeyBbYmFzZVRoZW1lOiBzdHJpbmddOiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdIH0gPSB7XG5cdCdsaWdodCc6IFtcblx0XHR7IHNjb3BlOiAndG9rZW4uaW5mby10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjMzE2YmNkJyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLndhcm4tdG9rZW4nLCBzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2NkOTczMScgfSB9LFxuXHRcdHsgc2NvcGU6ICd0b2tlbi5lcnJvci10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjY2QzMTMxJyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLmRlYnVnLXRva2VuJywgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogJyM4MDAwODAnIH0gfVxuXHRdLFxuXHQnZGFyayc6IFtcblx0XHR7IHNjb3BlOiAndG9rZW4uaW5mby10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjNjc5NmU2JyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLndhcm4tdG9rZW4nLCBzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2NkOTczMScgfSB9LFxuXHRcdHsgc2NvcGU6ICd0b2tlbi5lcnJvci10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjZjQ0NzQ3JyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLmRlYnVnLXRva2VuJywgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogJyNiMjY3ZTYnIH0gfVxuXHRdLFxuXHQnaGNMaWdodCc6IFtcblx0XHR7IHNjb3BlOiAndG9rZW4uaW5mby10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjMzE2YmNkJyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLndhcm4tdG9rZW4nLCBzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2NkOTczMScgfSB9LFxuXHRcdHsgc2NvcGU6ICd0b2tlbi5lcnJvci10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjY2QzMTMxJyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLmRlYnVnLXRva2VuJywgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogJyM4MDAwODAnIH0gfVxuXHRdLFxuXHQnaGNEYXJrJzogW1xuXHRcdHsgc2NvcGU6ICd0b2tlbi5pbmZvLXRva2VuJywgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogJyM2Nzk2ZTYnIH0gfSxcblx0XHR7IHNjb3BlOiAndG9rZW4ud2Fybi10b2tlbicsIHNldHRpbmdzOiB7IGZvcmVncm91bmQ6ICcjMDA4MDAwJyB9IH0sXG5cdFx0eyBzY29wZTogJ3Rva2VuLmVycm9yLXRva2VuJywgc2V0dGluZ3M6IHsgZm9yZWdyb3VuZDogJyNGRjAwMDAnIH0gfSxcblx0XHR7IHNjb3BlOiAndG9rZW4uZGVidWctdG9rZW4nLCBzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2IyNjdlNicgfSB9XG5cdF1cbn07XG5cbmNvbnN0IG5vTWF0Y2ggPSAoX3Njb3BlOiBQcm9iZVNjb3BlKSA9PiAtMTtcblxuZnVuY3Rpb24gbmFtZU1hdGNoZXIoaWRlbnRpZmllcnM6IHN0cmluZ1tdLCBzY29wZXM6IFByb2JlU2NvcGUpOiBudW1iZXIge1xuXHRpZiAoc2NvcGVzLmxlbmd0aCA8IGlkZW50aWZpZXJzLmxlbmd0aCkge1xuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdGxldCBzY29yZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRjb25zdCBldmVyeSA9IGlkZW50aWZpZXJzLmV2ZXJ5KChpZGVudGlmaWVyKSA9PiB7XG5cdFx0Zm9yIChsZXQgaSA9IHNjb3Blcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0aWYgKHNjb3Blc0FyZU1hdGNoaW5nKHNjb3Blc1tpXSwgaWRlbnRpZmllcikpIHtcblx0XHRcdFx0c2NvcmUgPSAoaSArIDEpICogMHgxMDAwMCArIGlkZW50aWZpZXIubGVuZ3RoO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9KTtcblx0cmV0dXJuIGV2ZXJ5ICYmIHNjb3JlICE9PSB1bmRlZmluZWQgPyBzY29yZSA6IC0xO1xufVxuZnVuY3Rpb24gc2NvcGVzQXJlTWF0Y2hpbmcodGhpc1Njb3BlTmFtZTogc3RyaW5nLCBzY29wZU5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRpZiAoIXRoaXNTY29wZU5hbWUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKHRoaXNTY29wZU5hbWUgPT09IHNjb3BlTmFtZSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGNvbnN0IGxlbiA9IHNjb3BlTmFtZS5sZW5ndGg7XG5cdHJldHVybiB0aGlzU2NvcGVOYW1lLmxlbmd0aCA+IGxlbiAmJiB0aGlzU2NvcGVOYW1lLnN1YnN0cigwLCBsZW4pID09PSBzY29wZU5hbWUgJiYgdGhpc1Njb3BlTmFtZVtsZW5dID09PSAnLic7XG59XG5cbmZ1bmN0aW9uIGdldFNjb3BlTWF0Y2hlcihydWxlOiBJVGV4dE1hdGVUaGVtaW5nUnVsZSk6IE1hdGNoZXI8UHJvYmVTY29wZT4ge1xuXHRjb25zdCBydWxlU2NvcGUgPSBydWxlLnNjb3BlO1xuXHRpZiAoIXJ1bGVTY29wZSB8fCAhcnVsZS5zZXR0aW5ncykge1xuXHRcdHJldHVybiBub01hdGNoO1xuXHR9XG5cdGNvbnN0IG1hdGNoZXJzOiBNYXRjaGVyV2l0aFByaW9yaXR5PFByb2JlU2NvcGU+W10gPSBbXTtcblx0aWYgKEFycmF5LmlzQXJyYXkocnVsZVNjb3BlKSkge1xuXHRcdGZvciAoY29uc3QgcnMgb2YgcnVsZVNjb3BlKSB7XG5cdFx0XHRjcmVhdGVNYXRjaGVycyhycywgbmFtZU1hdGNoZXIsIG1hdGNoZXJzKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Y3JlYXRlTWF0Y2hlcnMocnVsZVNjb3BlLCBuYW1lTWF0Y2hlciwgbWF0Y2hlcnMpO1xuXHR9XG5cblx0aWYgKG1hdGNoZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBub01hdGNoO1xuXHR9XG5cdHJldHVybiAoc2NvcGU6IFByb2JlU2NvcGUpID0+IHtcblx0XHRsZXQgbWF4ID0gbWF0Y2hlcnNbMF0ubWF0Y2hlcihzY29wZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBtYXRjaGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCBtYXRjaGVyc1tpXS5tYXRjaGVyKHNjb3BlKSk7XG5cdFx0fVxuXHRcdHJldHVybiBtYXg7XG5cdH07XG59XG5cbmZ1bmN0aW9uIHJlYWRTZW1hbnRpY1Rva2VuUnVsZShzZWxlY3RvclN0cmluZzogc3RyaW5nLCBzZXR0aW5nczogSVNlbWFudGljVG9rZW5Db2xvcml6YXRpb25TZXR0aW5nIHwgc3RyaW5nIHwgYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFNlbWFudGljVG9rZW5SdWxlIHwgdW5kZWZpbmVkIHtcblx0Y29uc3Qgc2VsZWN0b3IgPSB0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkucGFyc2VUb2tlblNlbGVjdG9yKHNlbGVjdG9yU3RyaW5nKTtcblx0bGV0IHN0eWxlOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkO1xuXHRpZiAodHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJykge1xuXHRcdHN0eWxlID0gVG9rZW5TdHlsZS5mcm9tU2V0dGluZ3Moc2V0dGluZ3MsIHVuZGVmaW5lZCk7XG5cdH0gZWxzZSBpZiAoaXNTZW1hbnRpY1Rva2VuQ29sb3JpemF0aW9uU2V0dGluZyhzZXR0aW5ncykpIHtcblx0XHRzdHlsZSA9IFRva2VuU3R5bGUuZnJvbVNldHRpbmdzKHNldHRpbmdzLmZvcmVncm91bmQsIHNldHRpbmdzLmZvbnRTdHlsZSwgc2V0dGluZ3MuYm9sZCwgc2V0dGluZ3MudW5kZXJsaW5lLCBzZXR0aW5ncy5zdHJpa2V0aHJvdWdoLCBzZXR0aW5ncy5pdGFsaWMpO1xuXHR9XG5cdGlmIChzdHlsZSkge1xuXHRcdHJldHVybiB7IHNlbGVjdG9yLCBzdHlsZSB9O1xuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzU2VtYW50aWNUb2tlbkNvbG9yaXphdGlvblNldHRpbmcoc3R5bGU6IGFueSk6IHN0eWxlIGlzIElTZW1hbnRpY1Rva2VuQ29sb3JpemF0aW9uU2V0dGluZyB7XG5cdHJldHVybiBzdHlsZSAmJiAodHlwZXMuaXNTdHJpbmcoc3R5bGUuZm9yZWdyb3VuZCkgfHwgdHlwZXMuaXNTdHJpbmcoc3R5bGUuZm9udFN0eWxlKSB8fCB0eXBlcy5pc0Jvb2xlYW4oc3R5bGUuaXRhbGljKVxuXHRcdHx8IHR5cGVzLmlzQm9vbGVhbihzdHlsZS51bmRlcmxpbmUpIHx8IHR5cGVzLmlzQm9vbGVhbihzdHlsZS5zdHJpa2V0aHJvdWdoKSB8fCB0eXBlcy5pc0Jvb2xlYW4oc3R5bGUuYm9sZCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZE1ldGFkYXRhKGNvbG9yVGhlbWVEYXRhOiBDb2xvclRoZW1lRGF0YSwgY2FwdHVyZU5hbWVzOiBzdHJpbmdbXSwgbGFuZ3VhZ2VJZDogbnVtYmVyLCBicmFja2V0OiBib29sZWFuKTogbnVtYmVyIHtcblx0bGV0IG1ldGFkYXRhID0gMDtcblxuXHRtZXRhZGF0YSB8PSAobGFuZ3VhZ2VJZCA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVCk7XG5cblx0Y29uc3QgZGVmaW5pdGlvbnM6IFRleHRNYXRlVGhlbWluZ1J1bGVEZWZpbml0aW9ucyA9IHt9O1xuXHRjb25zdCB0b2tlblN0eWxlID0gY29sb3JUaGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbY2FwdHVyZU5hbWVzXSwgZGVmaW5pdGlvbnMpO1xuXG5cdGlmIChjYXB0dXJlTmFtZXMubGVuZ3RoID4gMCkge1xuXHRcdGNvbnN0IHN0YW5kYXJkVG9rZW4gPSB0b1N0YW5kYXJkVG9rZW5UeXBlKGNhcHR1cmVOYW1lc1tjYXB0dXJlTmFtZXMubGVuZ3RoIC0gMV0pO1xuXHRcdG1ldGFkYXRhIHw9IChzdGFuZGFyZFRva2VuIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKTtcblx0fVxuXG5cdGNvbnN0IGZvbnRTdHlsZSA9IGRlZmluaXRpb25zLmZvcmVncm91bmQ/LnNldHRpbmdzLmZvbnRTdHlsZSB8fCBkZWZpbml0aW9ucy5ib2xkPy5zZXR0aW5ncy5mb250U3R5bGU7XG5cdGlmIChmb250U3R5bGU/LmluY2x1ZGVzKCdpdGFsaWMnKSkge1xuXHRcdG1ldGFkYXRhIHw9IEZvbnRTdHlsZS5JdGFsaWMgfCBNZXRhZGF0YUNvbnN0cy5JVEFMSUNfTUFTSztcblx0fVxuXHRpZiAoZm9udFN0eWxlPy5pbmNsdWRlcygnYm9sZCcpKSB7XG5cdFx0bWV0YWRhdGEgfD0gRm9udFN0eWxlLkJvbGQgfCBNZXRhZGF0YUNvbnN0cy5CT0xEX01BU0s7XG5cdH1cblx0aWYgKGZvbnRTdHlsZT8uaW5jbHVkZXMoJ3VuZGVybGluZScpKSB7XG5cdFx0bWV0YWRhdGEgfD0gRm9udFN0eWxlLlVuZGVybGluZSB8IE1ldGFkYXRhQ29uc3RzLlVOREVSTElORV9NQVNLO1xuXHR9XG5cdGlmIChmb250U3R5bGU/LmluY2x1ZGVzKCdzdHJpa2V0aHJvdWdoJykpIHtcblx0XHRtZXRhZGF0YSB8PSBGb250U3R5bGUuU3RyaWtldGhyb3VnaCB8IE1ldGFkYXRhQ29uc3RzLlNUUklLRVRIUk9VR0hfTUFTSztcblx0fVxuXG5cdGNvbnN0IGZvcmVncm91bmQgPSB0b2tlblN0eWxlPy5mb3JlZ3JvdW5kO1xuXHRjb25zdCB0b2tlblN0eWxlRm9yZWdyb3VuZCA9IChmb3JlZ3JvdW5kICE9PSB1bmRlZmluZWQpID8gY29sb3JUaGVtZURhdGEuZ2V0VG9rZW5Db2xvckluZGV4KCkuZ2V0KGZvcmVncm91bmQpIDogQ29sb3JJZC5EZWZhdWx0Rm9yZWdyb3VuZDtcblx0bWV0YWRhdGEgfD0gdG9rZW5TdHlsZUZvcmVncm91bmQgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVQ7XG5cblx0aWYgKGJyYWNrZXQpIHtcblx0XHRtZXRhZGF0YSB8PSBNZXRhZGF0YUNvbnN0cy5CQUxBTkNFRF9CUkFDS0VUU19NQVNLO1xuXHR9XG5cblx0cmV0dXJuIG1ldGFkYXRhO1xufVxuXG5jbGFzcyBUb2tlbkNvbG9ySW5kZXgge1xuXG5cdHByaXZhdGUgX2xhc3RDb2xvcklkOiBudW1iZXI7XG5cdHByaXZhdGUgX2lkMmNvbG9yOiBzdHJpbmdbXTtcblx0cHJpdmF0ZSBfY29sb3IyaWQ6IHsgW2NvbG9yOiBzdHJpbmddOiBudW1iZXIgfTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9sYXN0Q29sb3JJZCA9IDA7XG5cdFx0dGhpcy5faWQyY29sb3IgPSBbXTtcblx0XHR0aGlzLl9jb2xvcjJpZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgYWRkKGNvbG9yOiBzdHJpbmcgfCBDb2xvciB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG5cdFx0Y29sb3IgPSBub3JtYWxpemVDb2xvcihjb2xvcik7XG5cdFx0aWYgKGNvbG9yID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGxldCB2YWx1ZSA9IHRoaXMuX2NvbG9yMmlkW2NvbG9yXTtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0dmFsdWUgPSArK3RoaXMuX2xhc3RDb2xvcklkO1xuXHRcdHRoaXMuX2NvbG9yMmlkW2NvbG9yXSA9IHZhbHVlO1xuXHRcdHRoaXMuX2lkMmNvbG9yW3ZhbHVlXSA9IGNvbG9yO1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQoY29sb3I6IHN0cmluZyB8IENvbG9yIHwgdW5kZWZpbmVkKTogbnVtYmVyIHtcblx0XHRjb2xvciA9IG5vcm1hbGl6ZUNvbG9yKGNvbG9yKTtcblx0XHRpZiAoY29sb3IgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fY29sb3IyaWRbY29sb3JdO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZyhgQ29sb3IgJHtjb2xvcn0gbm90IGluIGluZGV4LmApO1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHVibGljIGFzQXJyYXkoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLl9pZDJjb2xvci5zbGljZSgwKTtcblx0fVxuXG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbG9yKGNvbG9yOiBzdHJpbmcgfCBDb2xvciB8IHVuZGVmaW5lZCB8IG51bGwpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRpZiAoIWNvbG9yKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRpZiAodHlwZW9mIGNvbG9yICE9PSAnc3RyaW5nJykge1xuXHRcdGNvbG9yID0gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKGNvbG9yLCB0cnVlKTtcblx0fVxuXHRjb25zdCBsZW4gPSBjb2xvci5sZW5ndGg7XG5cdGlmIChjb2xvci5jaGFyQ29kZUF0KDApICE9PSBDaGFyQ29kZS5IYXNoIHx8IChsZW4gIT09IDQgJiYgbGVuICE9PSA1ICYmIGxlbiAhPT0gNyAmJiBsZW4gIT09IDkpKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCByZXN1bHQgPSBbQ2hhckNvZGUuSGFzaF07XG5cblx0Zm9yIChsZXQgaSA9IDE7IGkgPCBsZW47IGkrKykge1xuXHRcdGNvbnN0IHVwcGVyID0gaGV4VXBwZXIoY29sb3IuY2hhckNvZGVBdChpKSk7XG5cdFx0aWYgKCF1cHBlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmVzdWx0LnB1c2godXBwZXIpO1xuXHRcdGlmIChsZW4gPT09IDQgfHwgbGVuID09PSA1KSB7XG5cdFx0XHRyZXN1bHQucHVzaCh1cHBlcik7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHJlc3VsdC5sZW5ndGggPT09IDkgJiYgcmVzdWx0WzddID09PSBDaGFyQ29kZS5GICYmIHJlc3VsdFs4XSA9PT0gQ2hhckNvZGUuRikge1xuXHRcdHJlc3VsdC5sZW5ndGggPSA3O1xuXHR9XG5cdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLnJlc3VsdCk7XG59XG5cbmZ1bmN0aW9uIGhleFVwcGVyKGNoYXJDb2RlOiBDaGFyQ29kZSk6IG51bWJlciB7XG5cdGlmIChjaGFyQ29kZSA+PSBDaGFyQ29kZS5EaWdpdDAgJiYgY2hhckNvZGUgPD0gQ2hhckNvZGUuRGlnaXQ5IHx8IGNoYXJDb2RlID49IENoYXJDb2RlLkEgJiYgY2hhckNvZGUgPD0gQ2hhckNvZGUuRikge1xuXHRcdHJldHVybiBjaGFyQ29kZTtcblx0fSBlbHNlIGlmIChjaGFyQ29kZSA+PSBDaGFyQ29kZS5hICYmIGNoYXJDb2RlIDw9IENoYXJDb2RlLmYpIHtcblx0XHRyZXR1cm4gY2hhckNvZGUgLSBDaGFyQ29kZS5hICsgQ2hhckNvZGUuQTtcblx0fVxuXHRyZXR1cm4gMDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFlBQVksVUFBVTtBQUN0QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFrUyx5QkFBeUIsd0JBQXdCLGlCQUFpQiw0QkFBNEI7QUFDelksU0FBUyx1QkFBdUI7QUFDaEMsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixZQUFZLGVBQWU7QUFDM0IsU0FBUyxjQUFjLHlCQUEwRCxrQkFBa0Isa0JBQWtCLGtDQUFrQztBQUN2SixTQUFzQiw0QkFBNEI7QUFDbEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyxTQUFTLGtCQUFrQjtBQUNwQyxTQUFTLFlBQVksbUJBQStCLGdDQUFpRSw2QkFBNkI7QUFDbEosU0FBdUMsc0JBQXNCO0FBRTdELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBK0IscUJBQXFCO0FBRTdELFNBQVMsYUFBYSx5QkFBeUI7QUFDL0MsU0FBUyxTQUFTLFdBQVcsc0JBQXNCO0FBQ25ELFNBQVMsMkJBQTJCO0FBRXBDLE1BQU0sZ0JBQWdCLFNBQVMsR0FBbUIsd0JBQXdCLGlCQUFpQjtBQUUzRixNQUFNLDhCQUE4QiwrQkFBK0I7QUFFbkUsTUFBTSx3QkFBd0I7QUFBQSxFQUM3QixVQUFVLENBQUMsV0FBVyxnQ0FBZ0M7QUFBQSxFQUN0RCxTQUFTLENBQUMsVUFBVSx3QkFBd0I7QUFBQSxFQUM1QyxVQUFVLENBQUMsOEJBQThCLG1CQUFtQixXQUFXLGNBQWM7QUFBQSxFQUNyRixTQUFTLENBQUMsa0JBQWtCO0FBQUEs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
