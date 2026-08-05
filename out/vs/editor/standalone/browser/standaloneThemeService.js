import * as dom from "../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../base/browser/domStylesheets.js";
import { addMatchMediaChangeListener } from "../../../base/browser/browser.js";
import { Color } from "../../../base/common/color.js";
import { Emitter } from "../../../base/common/event.js";
import { TokenizationRegistry } from "../../common/languages.js";
import { FontStyle, TokenMetadata } from "../../common/encodedTokenAttributes.js";
import { TokenTheme, generateTokensCSSForColorMap } from "../../common/languages/supports/tokenization.js";
import { hc_black, hc_light, vs, vs_dark } from "../common/themes.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { asCssVariableName, Extensions } from "../../../platform/theme/common/colorRegistry.js";
import { Extensions as ThemingExtensions } from "../../../platform/theme/common/themeService.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ColorScheme, isDark, isHighContrast } from "../../../platform/theme/common/theme.js";
import { getIconsStyleSheet, UnthemedProductIconTheme } from "../../../platform/theme/browser/iconsStyleSheet.js";
import { mainWindow } from "../../../base/browser/window.js";
const VS_LIGHT_THEME_NAME = "vs";
const VS_DARK_THEME_NAME = "vs-dark";
const HC_BLACK_THEME_NAME = "hc-black";
const HC_LIGHT_THEME_NAME = "hc-light";
const colorRegistry = Registry.as(Extensions.ColorContribution);
const themingRegistry = Registry.as(ThemingExtensions.ThemingContribution);
class StandaloneTheme {
  constructor(name, standaloneThemeData) {
    this.semanticHighlighting = false;
    this.themeData = standaloneThemeData;
    const base = standaloneThemeData.base;
    if (name.length > 0) {
      if (isBuiltinTheme(name)) {
        this.id = name;
      } else {
        this.id = base + " " + name;
      }
      this.themeName = name;
    } else {
      this.id = base;
      this.themeName = base;
    }
    this.colors = null;
    this.defaultColors = /* @__PURE__ */ Object.create(null);
    this._tokenTheme = null;
  }
  get label() {
    return this.themeName;
  }
  get base() {
    return this.themeData.base;
  }
  notifyBaseUpdated() {
    if (this.themeData.inherit) {
      this.colors = null;
      this._tokenTheme = null;
    }
  }
  getColors() {
    if (!this.colors) {
      const colors = /* @__PURE__ */ new Map();
      for (const id in this.themeData.colors) {
        colors.set(id, Color.fromHex(this.themeData.colors[id]));
      }
      if (this.themeData.inherit) {
        const baseData = getBuiltinRules(this.themeData.base);
        for (const id in baseData.colors) {
          if (!colors.has(id)) {
            colors.set(id, Color.fromHex(baseData.colors[id]));
          }
        }
      }
      this.colors = colors;
    }
    return this.colors;
  }
  getColor(colorId, useDefault) {
    const color = this.getColors().get(colorId);
    if (color) {
      return color;
    }
    if (useDefault !== false) {
      return this.getDefault(colorId);
    }
    return void 0;
  }
  getDefault(colorId) {
    let color = this.defaultColors[colorId];
    if (color) {
      return color;
    }
    color = colorRegistry.resolveDefaultColor(colorId, this);
    this.defaultColors[colorId] = color;
    return color;
  }
  defines(colorId) {
    return this.getColors().has(colorId);
  }
  get type() {
    switch (this.base) {
      case VS_LIGHT_THEME_NAME:
        return ColorScheme.LIGHT;
      case HC_BLACK_THEME_NAME:
        return ColorScheme.HIGH_CONTRAST_DARK;
      case HC_LIGHT_THEME_NAME:
        return ColorScheme.HIGH_CONTRAST_LIGHT;
      default:
        return ColorScheme.DARK;
    }
  }
  get tokenTheme() {
    if (!this._tokenTheme) {
      let rules = [];
      let encodedTokensColors = [];
      if (this.themeData.inherit) {
        const baseData = getBuiltinRules(this.themeData.base);
        rules = baseData.rules;
        if (baseData.encodedTokensColors) {
          encodedTokensColors = baseData.encodedTokensColors;
        }
      }
      const editorForeground = this.themeData.colors["editor.foreground"];
      const editorBackground = this.themeData.colors["editor.background"];
      if (editorForeground || editorBackground) {
        const rule = { token: "" };
        if (editorForeground) {
          rule.foreground = editorForeground;
        }
        if (editorBackground) {
          rule.background = editorBackground;
        }
        rules.push(rule);
      }
      rules = rules.concat(this.themeData.rules);
      if (this.themeData.encodedTokensColors) {
        encodedTokensColors = this.themeData.encodedTokensColors;
      }
      this._tokenTheme = TokenTheme.createFromRawTokenTheme(rules, encodedTokensColors);
    }
    return this._tokenTheme;
  }
  getTokenStyleMetadata(type, modifiers, modelLanguage) {
    const style = this.tokenTheme._match([type].concat(modifiers).join("."));
    const metadata = style.metadata;
    const foreground = TokenMetadata.getForeground(metadata);
    const fontStyle = TokenMetadata.getFontStyle(metadata);
    return {
      foreground,
      italic: Boolean(fontStyle & FontStyle.Italic),
      bold: Boolean(fontStyle & FontStyle.Bold),
      underline: Boolean(fontStyle & FontStyle.Underline),
      strikethrough: Boolean(fontStyle & FontStyle.Strikethrough)
    };
  }
  get tokenColorMap() {
    return [];
  }
}
function isBuiltinTheme(themeName) {
  return themeName === VS_LIGHT_THEME_NAME || themeName === VS_DARK_THEME_NAME || themeName === HC_BLACK_THEME_NAME || themeName === HC_LIGHT_THEME_NAME;
}
function getBuiltinRules(builtinTheme) {
  switch (builtinTheme) {
    case VS_LIGHT_THEME_NAME:
      return vs;
    case VS_DARK_THEME_NAME:
      return vs_dark;
    case HC_BLACK_THEME_NAME:
      return hc_black;
    case HC_LIGHT_THEME_NAME:
      return hc_light;
  }
}
function newBuiltInTheme(builtinTheme) {
  const themeData = getBuiltinRules(builtinTheme);
  return new StandaloneTheme(builtinTheme, themeData);
}
class StandaloneThemeService extends Disposable {
  constructor() {
    super();
    this._onColorThemeChange = this._register(new Emitter());
    this.onDidColorThemeChange = this._onColorThemeChange.event;
    this._onFileIconThemeChange = this._register(new Emitter());
    this.onDidFileIconThemeChange = this._onFileIconThemeChange.event;
    this._onProductIconThemeChange = this._register(new Emitter());
    this.onDidProductIconThemeChange = this._onProductIconThemeChange.event;
    this._environment = /* @__PURE__ */ Object.create(null);
    this._builtInProductIconTheme = new UnthemedProductIconTheme();
    this._autoDetectHighContrast = true;
    this._knownThemes = /* @__PURE__ */ new Map();
    this._knownThemes.set(VS_LIGHT_THEME_NAME, newBuiltInTheme(VS_LIGHT_THEME_NAME));
    this._knownThemes.set(VS_DARK_THEME_NAME, newBuiltInTheme(VS_DARK_THEME_NAME));
    this._knownThemes.set(HC_BLACK_THEME_NAME, newBuiltInTheme(HC_BLACK_THEME_NAME));
    this._knownThemes.set(HC_LIGHT_THEME_NAME, newBuiltInTheme(HC_LIGHT_THEME_NAME));
    const iconsStyleSheet = this._register(getIconsStyleSheet(this));
    this._codiconCSS = iconsStyleSheet.getCSS();
    this._themeCSS = "";
    this._allCSS = `${this._codiconCSS}
${this._themeCSS}`;
    this._globalStyleElement = null;
    this._styleElements = [];
    this._colorMapOverride = null;
    this.setTheme(VS_LIGHT_THEME_NAME);
    this._onOSSchemeChanged();
    this._register(iconsStyleSheet.onDidChange(() => {
      this._codiconCSS = iconsStyleSheet.getCSS();
      this._updateCSS();
    }));
    addMatchMediaChangeListener(mainWindow, "(forced-colors: active)", () => {
      this._onOSSchemeChanged();
    });
  }
  registerEditorContainer(domNode) {
    if (dom.isInShadowDOM(domNode)) {
      return this._registerShadowDomContainer(domNode);
    }
    return this._registerRegularEditorContainer();
  }
  _registerRegularEditorContainer() {
    if (!this._globalStyleElement) {
      this._globalStyleElement = domStylesheetsJs.createStyleSheet(void 0, (style) => {
        style.className = "monaco-colors";
        style.textContent = this._allCSS;
      });
      this._styleElements.push(this._globalStyleElement);
    }
    return Disposable.None;
  }
  _registerShadowDomContainer(domNode) {
    const styleElement = domStylesheetsJs.createStyleSheet(domNode, (style) => {
      style.className = "monaco-colors";
      style.textContent = this._allCSS;
    });
    this._styleElements.push(styleElement);
    return {
      dispose: () => {
        for (let i = 0; i < this._styleElements.length; i++) {
          if (this._styleElements[i] === styleElement) {
            this._styleElements.splice(i, 1);
            return;
          }
        }
      }
    };
  }
  defineTheme(themeName, themeData) {
    if (!/^[a-z0-9\-]+$/i.test(themeName)) {
      throw new Error("Illegal theme name!");
    }
    if (!isBuiltinTheme(themeData.base) && !isBuiltinTheme(themeName)) {
      throw new Error("Illegal theme base!");
    }
    this._knownThemes.set(themeName, new StandaloneTheme(themeName, themeData));
    if (isBuiltinTheme(themeName)) {
      this._knownThemes.forEach((theme) => {
        if (theme.base === themeName) {
          theme.notifyBaseUpdated();
        }
      });
    }
    if (this._theme.themeName === themeName) {
      this.setTheme(themeName);
    }
  }
  getColorTheme() {
    return this._theme;
  }
  setColorMapOverride(colorMapOverride) {
    this._colorMapOverride = colorMapOverride;
    this._updateThemeOrColorMap();
  }
  setTheme(themeName) {
    let theme;
    if (this._knownThemes.has(themeName)) {
      theme = this._knownThemes.get(themeName);
    } else {
      theme = this._knownThemes.get(VS_LIGHT_THEME_NAME);
    }
    this._updateActualTheme(theme);
  }
  _updateActualTheme(desiredTheme) {
    if (!desiredTheme || this._theme === desiredTheme) {
      return;
    }
    this._theme = desiredTheme;
    this._updateThemeOrColorMap();
  }
  _onOSSchemeChanged() {
    if (this._autoDetectHighContrast) {
      const wantsHighContrast = mainWindow.matchMedia(`(forced-colors: active)`).matches;
      if (wantsHighContrast !== isHighContrast(this._theme.type)) {
        let newThemeName;
        if (isDark(this._theme.type)) {
          newThemeName = wantsHighContrast ? HC_BLACK_THEME_NAME : VS_DARK_THEME_NAME;
        } else {
          newThemeName = wantsHighContrast ? HC_LIGHT_THEME_NAME : VS_LIGHT_THEME_NAME;
        }
        this._updateActualTheme(this._knownThemes.get(newThemeName));
      }
    }
  }
  setAutoDetectHighContrast(autoDetectHighContrast) {
    this._autoDetectHighContrast = autoDetectHighContrast;
    this._onOSSchemeChanged();
  }
  _updateThemeOrColorMap() {
    const cssRules = [];
    const hasRule = {};
    const ruleCollector = {
      addRule: (rule) => {
        if (!hasRule[rule]) {
          cssRules.push(rule);
          hasRule[rule] = true;
        }
      }
    };
    themingRegistry.getThemingParticipants().forEach((p) => p(this._theme, ruleCollector, this._environment));
    const colorVariables = [];
    for (const item of colorRegistry.getColors()) {
      const color = this._theme.getColor(item.id, true);
      if (color) {
        colorVariables.push(`${asCssVariableName(item.id)}: ${color.toString()};`);
      }
    }
    ruleCollector.addRule(`.monaco-editor, .monaco-diff-editor, .monaco-component { ${colorVariables.join("\n")} }`);
    const colorMap = this._colorMapOverride || this._theme.tokenTheme.getColorMap();
    ruleCollector.addRule(generateTokensCSSForColorMap(colorMap));
    this._themeCSS = cssRules.join("\n");
    this._updateCSS();
    TokenizationRegistry.setColorMap(colorMap);
    this._onColorThemeChange.fire(this._theme);
  }
  _updateCSS() {
    this._allCSS = `${this._codiconCSS}
${this._themeCSS}`;
    this._styleElements.forEach((styleElement) => styleElement.textContent = this._allCSS);
  }
  getFileIconTheme() {
    return {
      hasFileIcons: false,
      hasFolderIcons: false,
      hidesExplorerArrows: false
    };
  }
  getProductIconTheme() {
    return this._builtInProductIconTheme;
  }
}
export {
  HC_BLACK_THEME_NAME,
  HC_LIGHT_THEME_NAME,
  StandaloneThemeService,
  VS_DARK_THEME_NAME,
  VS_LIGHT_THEME_NAME
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3N0YW5kYWxvbmVUaGVtZVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0c0pzIGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBhZGRNYXRjaE1lZGlhQ2hhbmdlTGlzdGVuZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRm9udFN0eWxlLCBUb2tlbk1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSVRva2VuVGhlbWVSdWxlLCBUb2tlblRoZW1lLCBnZW5lcmF0ZVRva2Vuc0NTU0ZvckNvbG9yTWFwIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9zdXBwb3J0cy90b2tlbml6YXRpb24uanMnO1xuaW1wb3J0IHsgQnVpbHRpblRoZW1lLCBJU3RhbmRhbG9uZVRoZW1lLCBJU3RhbmRhbG9uZVRoZW1lRGF0YSwgSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc3RhbmRhbG9uZVRoZW1lLmpzJztcbmltcG9ydCB7IGhjX2JsYWNrLCBoY19saWdodCwgdnMsIHZzX2RhcmsgfSBmcm9tICcuLi9jb21tb24vdGhlbWVzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZU5hbWUsIENvbG9ySWRlbnRpZmllciwgRXh0ZW5zaW9ucywgSUNvbG9yUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFRoZW1pbmdFeHRlbnNpb25zLCBJQ3NzU3R5bGVDb2xsZWN0b3IsIElGaWxlSWNvblRoZW1lLCBJUHJvZHVjdEljb25UaGVtZSwgSVRoZW1pbmdSZWdpc3RyeSwgSVRva2VuU3R5bGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lLCBpc0RhcmssIGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGdldEljb25zU3R5bGVTaGVldCwgVW50aGVtZWRQcm9kdWN0SWNvblRoZW1lIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9pY29uc1N0eWxlU2hlZXQuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuXG5leHBvcnQgY29uc3QgVlNfTElHSFRfVEhFTUVfTkFNRSA9ICd2cyc7XG5leHBvcnQgY29uc3QgVlNfREFSS19USEVNRV9OQU1FID0gJ3ZzLWRhcmsnO1xuZXhwb3J0IGNvbnN0IEhDX0JMQUNLX1RIRU1FX05BTUUgPSAnaGMtYmxhY2snO1xuZXhwb3J0IGNvbnN0IEhDX0xJR0hUX1RIRU1FX05BTUUgPSAnaGMtbGlnaHQnO1xuXG5jb25zdCBjb2xvclJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29sb3JDb250cmlidXRpb24pO1xuY29uc3QgdGhlbWluZ1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVRoZW1pbmdSZWdpc3RyeT4oVGhlbWluZ0V4dGVuc2lvbnMuVGhlbWluZ0NvbnRyaWJ1dGlvbik7XG5cbmNsYXNzIFN0YW5kYWxvbmVUaGVtZSBpbXBsZW1lbnRzIElTdGFuZGFsb25lVGhlbWUge1xuXG5cdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgdGhlbWVOYW1lOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0aGVtZURhdGE6IElTdGFuZGFsb25lVGhlbWVEYXRhO1xuXHRwcml2YXRlIGNvbG9yczogTWFwPHN0cmluZywgQ29sb3I+IHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0Q29sb3JzOiB7IFtjb2xvcklkOiBzdHJpbmddOiBDb2xvciB8IHVuZGVmaW5lZCB9O1xuXHRwcml2YXRlIF90b2tlblRoZW1lOiBUb2tlblRoZW1lIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHN0YW5kYWxvbmVUaGVtZURhdGE6IElTdGFuZGFsb25lVGhlbWVEYXRhKSB7XG5cdFx0dGhpcy50aGVtZURhdGEgPSBzdGFuZGFsb25lVGhlbWVEYXRhO1xuXHRcdGNvbnN0IGJhc2UgPSBzdGFuZGFsb25lVGhlbWVEYXRhLmJhc2U7XG5cdFx0aWYgKG5hbWUubGVuZ3RoID4gMCkge1xuXHRcdFx0aWYgKGlzQnVpbHRpblRoZW1lKG5hbWUpKSB7XG5cdFx0XHRcdHRoaXMuaWQgPSBuYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5pZCA9IGJhc2UgKyAnICcgKyBuYW1lO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50aGVtZU5hbWUgPSBuYW1lO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmlkID0gYmFzZTtcblx0XHRcdHRoaXMudGhlbWVOYW1lID0gYmFzZTtcblx0XHR9XG5cdFx0dGhpcy5jb2xvcnMgPSBudWxsO1xuXHRcdHRoaXMuZGVmYXVsdENvbG9ycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy5fdG9rZW5UaGVtZSA9IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMudGhlbWVOYW1lO1xuXHR9XG5cblx0cHVibGljIGdldCBiYXNlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMudGhlbWVEYXRhLmJhc2U7XG5cdH1cblxuXHRwdWJsaWMgbm90aWZ5QmFzZVVwZGF0ZWQoKSB7XG5cdFx0aWYgKHRoaXMudGhlbWVEYXRhLmluaGVyaXQpIHtcblx0XHRcdHRoaXMuY29sb3JzID0gbnVsbDtcblx0XHRcdHRoaXMuX3Rva2VuVGhlbWUgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29sb3JzKCk6IE1hcDxzdHJpbmcsIENvbG9yPiB7XG5cdFx0aWYgKCF0aGlzLmNvbG9ycykge1xuXHRcdFx0Y29uc3QgY29sb3JzID0gbmV3IE1hcDxzdHJpbmcsIENvbG9yPigpO1xuXHRcdFx0Zm9yIChjb25zdCBpZCBpbiB0aGlzLnRoZW1lRGF0YS5jb2xvcnMpIHtcblx0XHRcdFx0Y29sb3JzLnNldChpZCwgQ29sb3IuZnJvbUhleCh0aGlzLnRoZW1lRGF0YS5jb2xvcnNbaWRdKSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy50aGVtZURhdGEuaW5oZXJpdCkge1xuXHRcdFx0XHRjb25zdCBiYXNlRGF0YSA9IGdldEJ1aWx0aW5SdWxlcyh0aGlzLnRoZW1lRGF0YS5iYXNlKTtcblx0XHRcdFx0Zm9yIChjb25zdCBpZCBpbiBiYXNlRGF0YS5jb2xvcnMpIHtcblx0XHRcdFx0XHRpZiAoIWNvbG9ycy5oYXMoaWQpKSB7XG5cdFx0XHRcdFx0XHRjb2xvcnMuc2V0KGlkLCBDb2xvci5mcm9tSGV4KGJhc2VEYXRhLmNvbG9yc1tpZF0pKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuY29sb3JzID0gY29sb3JzO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5jb2xvcnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29sb3IoY29sb3JJZDogQ29sb3JJZGVudGlmaWVyLCB1c2VEZWZhdWx0PzogYm9vbGVhbik6IENvbG9yIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb2xvciA9IHRoaXMuZ2V0Q29sb3JzKCkuZ2V0KGNvbG9ySWQpO1xuXHRcdGlmIChjb2xvcikge1xuXHRcdFx0cmV0dXJuIGNvbG9yO1xuXHRcdH1cblx0XHRpZiAodXNlRGVmYXVsdCAhPT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldERlZmF1bHQoY29sb3JJZCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldERlZmF1bHQoY29sb3JJZDogQ29sb3JJZGVudGlmaWVyKTogQ29sb3IgfCB1bmRlZmluZWQge1xuXHRcdGxldCBjb2xvciA9IHRoaXMuZGVmYXVsdENvbG9yc1tjb2xvcklkXTtcblx0XHRpZiAoY29sb3IpIHtcblx0XHRcdHJldHVybiBjb2xvcjtcblx0XHR9XG5cdFx0Y29sb3IgPSBjb2xvclJlZ2lzdHJ5LnJlc29sdmVEZWZhdWx0Q29sb3IoY29sb3JJZCwgdGhpcyk7XG5cdFx0dGhpcy5kZWZhdWx0Q29sb3JzW2NvbG9ySWRdID0gY29sb3I7XG5cdFx0cmV0dXJuIGNvbG9yO1xuXHR9XG5cblx0cHVibGljIGRlZmluZXMoY29sb3JJZDogQ29sb3JJZGVudGlmaWVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q29sb3JzKCkuaGFzKGNvbG9ySWQpO1xuXHR9XG5cblx0cHVibGljIGdldCB0eXBlKCk6IENvbG9yU2NoZW1lIHtcblx0XHRzd2l0Y2ggKHRoaXMuYmFzZSkge1xuXHRcdFx0Y2FzZSBWU19MSUdIVF9USEVNRV9OQU1FOiByZXR1cm4gQ29sb3JTY2hlbWUuTElHSFQ7XG5cdFx0XHRjYXNlIEhDX0JMQUNLX1RIRU1FX05BTUU6IHJldHVybiBDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0RBUks7XG5cdFx0XHRjYXNlIEhDX0xJR0hUX1RIRU1FX05BTUU6IHJldHVybiBDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0xJR0hUO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIENvbG9yU2NoZW1lLkRBUks7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCB0b2tlblRoZW1lKCk6IFRva2VuVGhlbWUge1xuXHRcdGlmICghdGhpcy5fdG9rZW5UaGVtZSkge1xuXHRcdFx0bGV0IHJ1bGVzOiBJVG9rZW5UaGVtZVJ1bGVbXSA9IFtdO1xuXHRcdFx0bGV0IGVuY29kZWRUb2tlbnNDb2xvcnM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRpZiAodGhpcy50aGVtZURhdGEuaW5oZXJpdCkge1xuXHRcdFx0XHRjb25zdCBiYXNlRGF0YSA9IGdldEJ1aWx0aW5SdWxlcyh0aGlzLnRoZW1lRGF0YS5iYXNlKTtcblx0XHRcdFx0cnVsZXMgPSBiYXNlRGF0YS5ydWxlcztcblx0XHRcdFx0aWYgKGJhc2VEYXRhLmVuY29kZWRUb2tlbnNDb2xvcnMpIHtcblx0XHRcdFx0XHRlbmNvZGVkVG9rZW5zQ29sb3JzID0gYmFzZURhdGEuZW5jb2RlZFRva2Vuc0NvbG9ycztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gUGljayB1cCBkZWZhdWx0IGNvbG9ycyBmcm9tIGBlZGl0b3IuZm9yZWdyb3VuZGAgYW5kIGBlZGl0b3IuYmFja2dyb3VuZGAgaWYgYXZhaWxhYmxlXG5cdFx0XHRjb25zdCBlZGl0b3JGb3JlZ3JvdW5kID0gdGhpcy50aGVtZURhdGEuY29sb3JzWydlZGl0b3IuZm9yZWdyb3VuZCddO1xuXHRcdFx0Y29uc3QgZWRpdG9yQmFja2dyb3VuZCA9IHRoaXMudGhlbWVEYXRhLmNvbG9yc1snZWRpdG9yLmJhY2tncm91bmQnXTtcblx0XHRcdGlmIChlZGl0b3JGb3JlZ3JvdW5kIHx8IGVkaXRvckJhY2tncm91bmQpIHtcblx0XHRcdFx0Y29uc3QgcnVsZTogSVRva2VuVGhlbWVSdWxlID0geyB0b2tlbjogJycgfTtcblx0XHRcdFx0aWYgKGVkaXRvckZvcmVncm91bmQpIHtcblx0XHRcdFx0XHRydWxlLmZvcmVncm91bmQgPSBlZGl0b3JGb3JlZ3JvdW5kO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlZGl0b3JCYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdFx0cnVsZS5iYWNrZ3JvdW5kID0gZWRpdG9yQmFja2dyb3VuZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRydWxlcy5wdXNoKHJ1bGUpO1xuXHRcdFx0fVxuXHRcdFx0cnVsZXMgPSBydWxlcy5jb25jYXQodGhpcy50aGVtZURhdGEucnVsZXMpO1xuXHRcdFx0aWYgKHRoaXMudGhlbWVEYXRhLmVuY29kZWRUb2tlbnNDb2xvcnMpIHtcblx0XHRcdFx0ZW5jb2RlZFRva2Vuc0NvbG9ycyA9IHRoaXMudGhlbWVEYXRhLmVuY29kZWRUb2tlbnNDb2xvcnM7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl90b2tlblRoZW1lID0gVG9rZW5UaGVtZS5jcmVhdGVGcm9tUmF3VG9rZW5UaGVtZShydWxlcywgZW5jb2RlZFRva2Vuc0NvbG9ycyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90b2tlblRoZW1lO1xuXHR9XG5cblx0cHVibGljIGdldFRva2VuU3R5bGVNZXRhZGF0YSh0eXBlOiBzdHJpbmcsIG1vZGlmaWVyczogc3RyaW5nW10sIG1vZGVsTGFuZ3VhZ2U6IHN0cmluZyk6IElUb2tlblN0eWxlIHwgdW5kZWZpbmVkIHtcblx0XHQvLyB1c2UgdGhlbWUgcnVsZXMgbWF0Y2hcblx0XHRjb25zdCBzdHlsZSA9IHRoaXMudG9rZW5UaGVtZS5fbWF0Y2goW3R5cGVdLmNvbmNhdChtb2RpZmllcnMpLmpvaW4oJy4nKSk7XG5cdFx0Y29uc3QgbWV0YWRhdGEgPSBzdHlsZS5tZXRhZGF0YTtcblx0XHRjb25zdCBmb3JlZ3JvdW5kID0gVG9rZW5NZXRhZGF0YS5nZXRGb3JlZ3JvdW5kKG1ldGFkYXRhKTtcblx0XHRjb25zdCBmb250U3R5bGUgPSBUb2tlbk1ldGFkYXRhLmdldEZvbnRTdHlsZShtZXRhZGF0YSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRpdGFsaWM6IEJvb2xlYW4oZm9udFN0eWxlICYgRm9udFN0eWxlLkl0YWxpYyksXG5cdFx0XHRib2xkOiBCb29sZWFuKGZvbnRTdHlsZSAmIEZvbnRTdHlsZS5Cb2xkKSxcblx0XHRcdHVuZGVybGluZTogQm9vbGVhbihmb250U3R5bGUgJiBGb250U3R5bGUuVW5kZXJsaW5lKSxcblx0XHRcdHN0cmlrZXRocm91Z2g6IEJvb2xlYW4oZm9udFN0eWxlICYgRm9udFN0eWxlLlN0cmlrZXRocm91Z2gpXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdG9rZW5Db2xvck1hcCgpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IHNlbWFudGljSGlnaGxpZ2h0aW5nID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGlzQnVpbHRpblRoZW1lKHRoZW1lTmFtZTogc3RyaW5nKTogdGhlbWVOYW1lIGlzIEJ1aWx0aW5UaGVtZSB7XG5cdHJldHVybiAoXG5cdFx0dGhlbWVOYW1lID09PSBWU19MSUdIVF9USEVNRV9OQU1FXG5cdFx0fHwgdGhlbWVOYW1lID09PSBWU19EQVJLX1RIRU1FX05BTUVcblx0XHR8fCB0aGVtZU5hbWUgPT09IEhDX0JMQUNLX1RIRU1FX05BTUVcblx0XHR8fCB0aGVtZU5hbWUgPT09IEhDX0xJR0hUX1RIRU1FX05BTUVcblx0KTtcbn1cblxuZnVuY3Rpb24gZ2V0QnVpbHRpblJ1bGVzKGJ1aWx0aW5UaGVtZTogQnVpbHRpblRoZW1lKTogSVN0YW5kYWxvbmVUaGVtZURhdGEge1xuXHRzd2l0Y2ggKGJ1aWx0aW5UaGVtZSkge1xuXHRcdGNhc2UgVlNfTElHSFRfVEhFTUVfTkFNRTpcblx0XHRcdHJldHVybiB2cztcblx0XHRjYXNlIFZTX0RBUktfVEhFTUVfTkFNRTpcblx0XHRcdHJldHVybiB2c19kYXJrO1xuXHRcdGNhc2UgSENfQkxBQ0tfVEhFTUVfTkFNRTpcblx0XHRcdHJldHVybiBoY19ibGFjaztcblx0XHRjYXNlIEhDX0xJR0hUX1RIRU1FX05BTUU6XG5cdFx0XHRyZXR1cm4gaGNfbGlnaHQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gbmV3QnVpbHRJblRoZW1lKGJ1aWx0aW5UaGVtZTogQnVpbHRpblRoZW1lKTogU3RhbmRhbG9uZVRoZW1lIHtcblx0Y29uc3QgdGhlbWVEYXRhID0gZ2V0QnVpbHRpblJ1bGVzKGJ1aWx0aW5UaGVtZSk7XG5cdHJldHVybiBuZXcgU3RhbmRhbG9uZVRoZW1lKGJ1aWx0aW5UaGVtZSwgdGhlbWVEYXRhKTtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YW5kYWxvbmVUaGVtZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ29sb3JUaGVtZUNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTdGFuZGFsb25lVGhlbWU+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDb2xvclRoZW1lQ2hhbmdlID0gdGhpcy5fb25Db2xvclRoZW1lQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRmlsZUljb25UaGVtZUNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElGaWxlSWNvblRoZW1lPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkRmlsZUljb25UaGVtZUNoYW5nZSA9IHRoaXMuX29uRmlsZUljb25UaGVtZUNoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2R1Y3RJY29uVGhlbWVDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvZHVjdEljb25UaGVtZT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFByb2R1Y3RJY29uVGhlbWVDaGFuZ2UgPSB0aGlzLl9vblByb2R1Y3RJY29uVGhlbWVDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnQ6IElFbnZpcm9ubWVudFNlcnZpY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9rbm93blRoZW1lczogTWFwPHN0cmluZywgU3RhbmRhbG9uZVRoZW1lPjtcblx0cHJpdmF0ZSBfYXV0b0RldGVjdEhpZ2hDb250cmFzdDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfY29kaWNvbkNTUzogc3RyaW5nO1xuXHRwcml2YXRlIF90aGVtZUNTUzogc3RyaW5nO1xuXHRwcml2YXRlIF9hbGxDU1M6IHN0cmluZztcblx0cHJpdmF0ZSBfZ2xvYmFsU3R5bGVFbGVtZW50OiBIVE1MU3R5bGVFbGVtZW50IHwgbnVsbDtcblx0cHJpdmF0ZSBfc3R5bGVFbGVtZW50czogSFRNTFN0eWxlRWxlbWVudFtdO1xuXHRwcml2YXRlIF9jb2xvck1hcE92ZXJyaWRlOiBDb2xvcltdIHwgbnVsbDtcblx0cHJpdmF0ZSBfdGhlbWUhOiBJU3RhbmRhbG9uZVRoZW1lO1xuXG5cdHByaXZhdGUgX2J1aWx0SW5Qcm9kdWN0SWNvblRoZW1lID0gbmV3IFVudGhlbWVkUHJvZHVjdEljb25UaGVtZSgpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9hdXRvRGV0ZWN0SGlnaENvbnRyYXN0ID0gdHJ1ZTtcblxuXHRcdHRoaXMuX2tub3duVGhlbWVzID0gbmV3IE1hcDxzdHJpbmcsIFN0YW5kYWxvbmVUaGVtZT4oKTtcblx0XHR0aGlzLl9rbm93blRoZW1lcy5zZXQoVlNfTElHSFRfVEhFTUVfTkFNRSwgbmV3QnVpbHRJblRoZW1lKFZTX0xJR0hUX1RIRU1FX05BTUUpKTtcblx0XHR0aGlzLl9rbm93blRoZW1lcy5zZXQoVlNfREFSS19USEVNRV9OQU1FLCBuZXdCdWlsdEluVGhlbWUoVlNfREFSS19USEVNRV9OQU1FKSk7XG5cdFx0dGhpcy5fa25vd25UaGVtZXMuc2V0KEhDX0JMQUNLX1RIRU1FX05BTUUsIG5ld0J1aWx0SW5UaGVtZShIQ19CTEFDS19USEVNRV9OQU1FKSk7XG5cdFx0dGhpcy5fa25vd25UaGVtZXMuc2V0KEhDX0xJR0hUX1RIRU1FX05BTUUsIG5ld0J1aWx0SW5UaGVtZShIQ19MSUdIVF9USEVNRV9OQU1FKSk7XG5cblx0XHRjb25zdCBpY29uc1N0eWxlU2hlZXQgPSB0aGlzLl9yZWdpc3RlcihnZXRJY29uc1N0eWxlU2hlZXQodGhpcykpO1xuXG5cdFx0dGhpcy5fY29kaWNvbkNTUyA9IGljb25zU3R5bGVTaGVldC5nZXRDU1MoKTtcblx0XHR0aGlzLl90aGVtZUNTUyA9ICcnO1xuXHRcdHRoaXMuX2FsbENTUyA9IGAke3RoaXMuX2NvZGljb25DU1N9XFxuJHt0aGlzLl90aGVtZUNTU31gO1xuXHRcdHRoaXMuX2dsb2JhbFN0eWxlRWxlbWVudCA9IG51bGw7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50cyA9IFtdO1xuXHRcdHRoaXMuX2NvbG9yTWFwT3ZlcnJpZGUgPSBudWxsO1xuXHRcdHRoaXMuc2V0VGhlbWUoVlNfTElHSFRfVEhFTUVfTkFNRSk7XG5cdFx0dGhpcy5fb25PU1NjaGVtZUNoYW5nZWQoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGljb25zU3R5bGVTaGVldC5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb2RpY29uQ1NTID0gaWNvbnNTdHlsZVNoZWV0LmdldENTUygpO1xuXHRcdFx0dGhpcy5fdXBkYXRlQ1NTKCk7XG5cdFx0fSkpO1xuXG5cdFx0YWRkTWF0Y2hNZWRpYUNoYW5nZUxpc3RlbmVyKG1haW5XaW5kb3csICcoZm9yY2VkLWNvbG9yczogYWN0aXZlKScsICgpID0+IHtcblx0XHRcdHRoaXMuX29uT1NTY2hlbWVDaGFuZ2VkKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJFZGl0b3JDb250YWluZXIoZG9tTm9kZTogSFRNTEVsZW1lbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKGRvbS5pc0luU2hhZG93RE9NKGRvbU5vZGUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVnaXN0ZXJTaGFkb3dEb21Db250YWluZXIoZG9tTm9kZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZWdpc3RlclJlZ3VsYXJFZGl0b3JDb250YWluZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyUmVndWxhckVkaXRvckNvbnRhaW5lcigpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKCF0aGlzLl9nbG9iYWxTdHlsZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX2dsb2JhbFN0eWxlRWxlbWVudCA9IGRvbVN0eWxlc2hlZXRzSnMuY3JlYXRlU3R5bGVTaGVldCh1bmRlZmluZWQsIHN0eWxlID0+IHtcblx0XHRcdFx0c3R5bGUuY2xhc3NOYW1lID0gJ21vbmFjby1jb2xvcnMnO1xuXHRcdFx0XHRzdHlsZS50ZXh0Q29udGVudCA9IHRoaXMuX2FsbENTUztcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fc3R5bGVFbGVtZW50cy5wdXNoKHRoaXMuX2dsb2JhbFN0eWxlRWxlbWVudCk7XG5cdFx0fVxuXHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3RlclNoYWRvd0RvbUNvbnRhaW5lcihkb21Ob2RlOiBIVE1MRWxlbWVudCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBzdHlsZUVsZW1lbnQgPSBkb21TdHlsZXNoZWV0c0pzLmNyZWF0ZVN0eWxlU2hlZXQoZG9tTm9kZSwgc3R5bGUgPT4ge1xuXHRcdFx0c3R5bGUuY2xhc3NOYW1lID0gJ21vbmFjby1jb2xvcnMnO1xuXHRcdFx0c3R5bGUudGV4dENvbnRlbnQgPSB0aGlzLl9hbGxDU1M7XG5cdFx0fSk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50cy5wdXNoKHN0eWxlRWxlbWVudCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9zdHlsZUVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3N0eWxlRWxlbWVudHNbaV0gPT09IHN0eWxlRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fc3R5bGVFbGVtZW50cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBkZWZpbmVUaGVtZSh0aGVtZU5hbWU6IHN0cmluZywgdGhlbWVEYXRhOiBJU3RhbmRhbG9uZVRoZW1lRGF0YSk6IHZvaWQge1xuXHRcdGlmICghL15bYS16MC05XFwtXSskL2kudGVzdCh0aGVtZU5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgdGhlbWUgbmFtZSEnKTtcblx0XHR9XG5cdFx0aWYgKCFpc0J1aWx0aW5UaGVtZSh0aGVtZURhdGEuYmFzZSkgJiYgIWlzQnVpbHRpblRoZW1lKHRoZW1lTmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSWxsZWdhbCB0aGVtZSBiYXNlIScpO1xuXHRcdH1cblx0XHQvLyBzZXQgb3IgcmVwbGFjZSB0aGVtZVxuXHRcdHRoaXMuX2tub3duVGhlbWVzLnNldCh0aGVtZU5hbWUsIG5ldyBTdGFuZGFsb25lVGhlbWUodGhlbWVOYW1lLCB0aGVtZURhdGEpKTtcblxuXHRcdGlmIChpc0J1aWx0aW5UaGVtZSh0aGVtZU5hbWUpKSB7XG5cdFx0XHR0aGlzLl9rbm93blRoZW1lcy5mb3JFYWNoKHRoZW1lID0+IHtcblx0XHRcdFx0aWYgKHRoZW1lLmJhc2UgPT09IHRoZW1lTmFtZSkge1xuXHRcdFx0XHRcdHRoZW1lLm5vdGlmeUJhc2VVcGRhdGVkKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fdGhlbWUudGhlbWVOYW1lID09PSB0aGVtZU5hbWUpIHtcblx0XHRcdHRoaXMuc2V0VGhlbWUodGhlbWVOYW1lKTsgLy8gcmVmcmVzaCB0aGVtZVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRDb2xvclRoZW1lKCk6IElTdGFuZGFsb25lVGhlbWUge1xuXHRcdHJldHVybiB0aGlzLl90aGVtZTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb2xvck1hcE92ZXJyaWRlKGNvbG9yTWFwT3ZlcnJpZGU6IENvbG9yW10gfCBudWxsKTogdm9pZCB7XG5cdFx0dGhpcy5fY29sb3JNYXBPdmVycmlkZSA9IGNvbG9yTWFwT3ZlcnJpZGU7XG5cdFx0dGhpcy5fdXBkYXRlVGhlbWVPckNvbG9yTWFwKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0VGhlbWUodGhlbWVOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRsZXQgdGhlbWU6IFN0YW5kYWxvbmVUaGVtZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5fa25vd25UaGVtZXMuaGFzKHRoZW1lTmFtZSkpIHtcblx0XHRcdHRoZW1lID0gdGhpcy5fa25vd25UaGVtZXMuZ2V0KHRoZW1lTmFtZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoZW1lID0gdGhpcy5fa25vd25UaGVtZXMuZ2V0KFZTX0xJR0hUX1RIRU1FX05BTUUpO1xuXHRcdH1cblx0XHR0aGlzLl91cGRhdGVBY3R1YWxUaGVtZSh0aGVtZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVBY3R1YWxUaGVtZShkZXNpcmVkVGhlbWU6IElTdGFuZGFsb25lVGhlbWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIWRlc2lyZWRUaGVtZSB8fCB0aGlzLl90aGVtZSA9PT0gZGVzaXJlZFRoZW1lKSB7XG5cdFx0XHQvLyBOb3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3RoZW1lID0gZGVzaXJlZFRoZW1lO1xuXHRcdHRoaXMuX3VwZGF0ZVRoZW1lT3JDb2xvck1hcCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25PU1NjaGVtZUNoYW5nZWQoKSB7XG5cdFx0aWYgKHRoaXMuX2F1dG9EZXRlY3RIaWdoQ29udHJhc3QpIHtcblx0XHRcdGNvbnN0IHdhbnRzSGlnaENvbnRyYXN0ID0gbWFpbldpbmRvdy5tYXRjaE1lZGlhKGAoZm9yY2VkLWNvbG9yczogYWN0aXZlKWApLm1hdGNoZXM7XG5cdFx0XHRpZiAod2FudHNIaWdoQ29udHJhc3QgIT09IGlzSGlnaENvbnRyYXN0KHRoaXMuX3RoZW1lLnR5cGUpKSB7XG5cdFx0XHRcdC8vIHN3aXRjaCB0byBoaWdoIGNvbnRyYXN0IG9yIG5vbi1oaWdoIGNvbnRyYXN0IGJ1dCBzdGljayB0byBkYXJrIG9yIGxpZ2h0XG5cdFx0XHRcdGxldCBuZXdUaGVtZU5hbWU7XG5cdFx0XHRcdGlmIChpc0RhcmsodGhpcy5fdGhlbWUudHlwZSkpIHtcblx0XHRcdFx0XHRuZXdUaGVtZU5hbWUgPSB3YW50c0hpZ2hDb250cmFzdCA/IEhDX0JMQUNLX1RIRU1FX05BTUUgOiBWU19EQVJLX1RIRU1FX05BTUU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3VGhlbWVOYW1lID0gd2FudHNIaWdoQ29udHJhc3QgPyBIQ19MSUdIVF9USEVNRV9OQU1FIDogVlNfTElHSFRfVEhFTUVfTkFNRTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl91cGRhdGVBY3R1YWxUaGVtZSh0aGlzLl9rbm93blRoZW1lcy5nZXQobmV3VGhlbWVOYW1lKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldEF1dG9EZXRlY3RIaWdoQ29udHJhc3QoYXV0b0RldGVjdEhpZ2hDb250cmFzdDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2F1dG9EZXRlY3RIaWdoQ29udHJhc3QgPSBhdXRvRGV0ZWN0SGlnaENvbnRyYXN0O1xuXHRcdHRoaXMuX29uT1NTY2hlbWVDaGFuZ2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVUaGVtZU9yQ29sb3JNYXAoKTogdm9pZCB7XG5cdFx0Y29uc3QgY3NzUnVsZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgaGFzUnVsZTogeyBbcnVsZTogc3RyaW5nXTogYm9vbGVhbiB9ID0ge307XG5cdFx0Y29uc3QgcnVsZUNvbGxlY3RvcjogSUNzc1N0eWxlQ29sbGVjdG9yID0ge1xuXHRcdFx0YWRkUnVsZTogKHJ1bGU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAoIWhhc1J1bGVbcnVsZV0pIHtcblx0XHRcdFx0XHRjc3NSdWxlcy5wdXNoKHJ1bGUpO1xuXHRcdFx0XHRcdGhhc1J1bGVbcnVsZV0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGVtaW5nUmVnaXN0cnkuZ2V0VGhlbWluZ1BhcnRpY2lwYW50cygpLmZvckVhY2gocCA9PiBwKHRoaXMuX3RoZW1lLCBydWxlQ29sbGVjdG9yLCB0aGlzLl9lbnZpcm9ubWVudCkpO1xuXG5cdFx0Y29uc3QgY29sb3JWYXJpYWJsZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGNvbG9yUmVnaXN0cnkuZ2V0Q29sb3JzKCkpIHtcblx0XHRcdGNvbnN0IGNvbG9yID0gdGhpcy5fdGhlbWUuZ2V0Q29sb3IoaXRlbS5pZCwgdHJ1ZSk7XG5cdFx0XHRpZiAoY29sb3IpIHtcblx0XHRcdFx0Y29sb3JWYXJpYWJsZXMucHVzaChgJHthc0Nzc1ZhcmlhYmxlTmFtZShpdGVtLmlkKX06ICR7Y29sb3IudG9TdHJpbmcoKX07YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJ1bGVDb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IsIC5tb25hY28tZGlmZi1lZGl0b3IsIC5tb25hY28tY29tcG9uZW50IHsgJHtjb2xvclZhcmlhYmxlcy5qb2luKCdcXG4nKX0gfWApO1xuXG5cdFx0Y29uc3QgY29sb3JNYXAgPSB0aGlzLl9jb2xvck1hcE92ZXJyaWRlIHx8IHRoaXMuX3RoZW1lLnRva2VuVGhlbWUuZ2V0Q29sb3JNYXAoKTtcblx0XHRydWxlQ29sbGVjdG9yLmFkZFJ1bGUoZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcChjb2xvck1hcCkpO1xuXG5cdFx0dGhpcy5fdGhlbWVDU1MgPSBjc3NSdWxlcy5qb2luKCdcXG4nKTtcblx0XHR0aGlzLl91cGRhdGVDU1MoKTtcblxuXHRcdFRva2VuaXphdGlvblJlZ2lzdHJ5LnNldENvbG9yTWFwKGNvbG9yTWFwKTtcblx0XHR0aGlzLl9vbkNvbG9yVGhlbWVDaGFuZ2UuZmlyZSh0aGlzLl90aGVtZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDU1MoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWxsQ1NTID0gYCR7dGhpcy5fY29kaWNvbkNTU31cXG4ke3RoaXMuX3RoZW1lQ1NTfWA7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50cy5mb3JFYWNoKHN0eWxlRWxlbWVudCA9PiBzdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLl9hbGxDU1MpO1xuXHR9XG5cblx0cHVibGljIGdldEZpbGVJY29uVGhlbWUoKTogSUZpbGVJY29uVGhlbWUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRoYXNGaWxlSWNvbnM6IGZhbHNlLFxuXHRcdFx0aGFzRm9sZGVySWNvbnM6IGZhbHNlLFxuXHRcdFx0aGlkZXNFeHBsb3JlckFycm93czogZmFsc2Vcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldFByb2R1Y3RJY29uVGhlbWUoKTogSVByb2R1Y3RJY29uVGhlbWUge1xuXHRcdHJldHVybiB0aGlzLl9idWlsdEluUHJvZHVjdEljb25UaGVtZTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxzQkFBc0I7QUFDbEMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFdBQVcscUJBQXFCO0FBQ3pDLFNBQTBCLFlBQVksb0NBQW9DO0FBRTFFLFNBQVMsVUFBVSxVQUFVLElBQUksZUFBZTtBQUVoRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFvQyxrQkFBa0M7QUFDL0UsU0FBUyxjQUFjLHlCQUErRztBQUN0SSxTQUFzQixrQkFBa0I7QUFDeEMsU0FBUyxhQUFhLFFBQVEsc0JBQXNCO0FBQ3BELFNBQVMsb0JBQW9CLGdDQUFnQztBQUM3RCxTQUFTLGtCQUFrQjtBQUVwQixNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHFCQUFxQjtBQUMzQixNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHNCQUFzQjtBQUVuQyxNQUFNLGdCQUFnQixTQUFTLEdBQW1CLFdB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
