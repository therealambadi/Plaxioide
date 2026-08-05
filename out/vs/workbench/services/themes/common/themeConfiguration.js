import * as nls from "../../../../nls.js";
import * as types from "../../../../base/common/types.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { textmateColorsSchemaId, textmateColorGroupSchemaId } from "./colorThemeSchema.js";
import { workbenchColorsSchemaId } from "../../../../platform/theme/common/colorRegistry.js";
import { tokenStylingSchemaId } from "../../../../platform/theme/common/tokenClassificationRegistry.js";
import { ThemeSettings, ThemeSettingDefaults } from "./workbenchThemeService.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { isWeb } from "../../../../base/common/platform.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
const colorThemeSettingEnum = [];
const colorThemeSettingEnumItemLabels = [];
const colorThemeSettingEnumDescriptions = [];
function formatSettingAsLink(str) {
  return `\`#${str}#\``;
}
const COLOR_THEME_CONFIGURATION_SETTINGS_TAG = "colorThemeConfiguration";
const colorThemeSettingSchema = {
  type: "string",
  markdownDescription: nls.localize({ key: "colorTheme", comment: ["{0} will become a link to another setting."] }, "Specifies the color theme used in the workbench when {0} is not enabled.", formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
  default: isWeb ? ThemeSettingDefaults.COLOR_THEME_LIGHT : ThemeSettingDefaults.COLOR_THEME_DARK,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
  enum: colorThemeSettingEnum,
  enumDescriptions: colorThemeSettingEnumDescriptions,
  enumItemLabels: colorThemeSettingEnumItemLabels,
  errorMessage: nls.localize("colorThemeError", "Theme is unknown or not installed.")
};
const preferredDarkThemeSettingSchema = {
  type: "string",
  //
  markdownDescription: nls.localize({ key: "preferredDarkColorTheme", comment: ["{0} will become a link to another setting."] }, "Specifies the color theme when system color mode is dark and {0} is enabled.", formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
  default: ThemeSettingDefaults.COLOR_THEME_DARK,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
  enum: colorThemeSettingEnum,
  enumDescriptions: colorThemeSettingEnumDescriptions,
  enumItemLabels: colorThemeSettingEnumItemLabels,
  errorMessage: nls.localize("colorThemeError", "Theme is unknown or not installed.")
};
const preferredLightThemeSettingSchema = {
  type: "string",
  markdownDescription: nls.localize({ key: "preferredLightColorTheme", comment: ["{0} will become a link to another setting."] }, "Specifies the color theme when system color mode is light and {0} is enabled.", formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
  default: ThemeSettingDefaults.COLOR_THEME_LIGHT,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
  enum: colorThemeSettingEnum,
  enumDescriptions: colorThemeSettingEnumDescriptions,
  enumItemLabels: colorThemeSettingEnumItemLabels,
  errorMessage: nls.localize("colorThemeError", "Theme is unknown or not installed.")
};
const preferredHCDarkThemeSettingSchema = {
  type: "string",
  markdownDescription: nls.localize({ key: "preferredHCDarkColorTheme", comment: ["{0} will become a link to another setting."] }, "Specifies the color theme when in high contrast dark mode and {0} is enabled.", formatSettingAsLink(ThemeSettings.DETECT_HC)),
  default: ThemeSettingDefaults.COLOR_THEME_HC_DARK,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
  enum: colorThemeSettingEnum,
  enumDescriptions: colorThemeSettingEnumDescriptions,
  enumItemLabels: colorThemeSettingEnumItemLabels,
  errorMessage: nls.localize("colorThemeError", "Theme is unknown or not installed.")
};
const preferredHCLightThemeSettingSchema = {
  type: "string",
  markdownDescription: nls.localize({ key: "preferredHCLightColorTheme", comment: ["{0} will become a link to another setting."] }, "Specifies the color theme when in high contrast light mode and {0} is enabled.", formatSettingAsLink(ThemeSettings.DETECT_HC)),
  default: ThemeSettingDefaults.COLOR_THEME_HC_LIGHT,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
  enum: colorThemeSettingEnum,
  enumDescriptions: colorThemeSettingEnumDescriptions,
  enumItemLabels: colorThemeSettingEnumItemLabels,
  errorMessage: nls.localize("colorThemeError", "Theme is unknown or not installed.")
};
const detectColorSchemeSettingSchema = {
  type: "boolean",
  markdownDescription: nls.localize({ key: "detectColorScheme", comment: ["{0} and {1} will become links to other settings."] }, "If enabled, will automatically select a color theme based on the system color mode. If the system color mode is dark, {0} is used, else {1}.", formatSettingAsLink(ThemeSettings.PREFERRED_DARK_THEME), formatSettingAsLink(ThemeSettings.PREFERRED_LIGHT_THEME)),
  default: false,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG]
};
const colorCustomizationsSchema = {
  type: "object",
  description: nls.localize("workbenchColors", "Overrides colors from the currently selected color theme."),
  allOf: [{ $ref: workbenchColorsSchemaId }],
  default: {},
  defaultSnippets: [{
    body: {}
  }]
};
const fileIconThemeSettingSchema = {
  type: ["string", "null"],
  default: ThemeSettingDefaults.FILE_ICON_THEME,
  description: nls.localize("iconTheme", "Specifies the file icon theme used in the workbench or 'null' to not show any file icons."),
  enum: [null],
  enumItemLabels: [nls.localize("noIconThemeLabel", "None")],
  enumDescriptions: [nls.localize("noIconThemeDesc", "No file icons")],
  errorMessage: nls.localize("iconThemeError", "File icon theme is unknown or not installed.")
};
const productIconThemeSettingSchema = {
  type: ["string", "null"],
  default: ThemeSettingDefaults.PRODUCT_ICON_THEME,
  description: nls.localize("productIconTheme", "Specifies the product icon theme used."),
  enum: [ThemeSettingDefaults.PRODUCT_ICON_THEME],
  enumItemLabels: [nls.localize("defaultProductIconThemeLabel", "Default")],
  enumDescriptions: [nls.localize("defaultProductIconThemeDesc", "Default")],
  errorMessage: nls.localize("productIconThemeError", "Product icon theme is unknown or not installed.")
};
const detectHCSchemeSettingSchema = {
  type: "boolean",
  default: true,
  markdownDescription: nls.localize({ key: "autoDetectHighContrast", comment: ["{0} and {1} will become links to other settings."] }, "If enabled, will automatically change to high contrast theme if the OS is using a high contrast theme. The high contrast theme to use is specified by {0} and {1}.", formatSettingAsLink(ThemeSettings.PREFERRED_HC_DARK_THEME), formatSettingAsLink(ThemeSettings.PREFERRED_HC_LIGHT_THEME)),
  scope: ConfigurationScope.APPLICATION,
  tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG]
};
const themeSettingsConfiguration = {
  id: "workbench",
  order: 7.1,
  type: "object",
  properties: {
    [ThemeSettings.COLOR_THEME]: colorThemeSettingSchema,
    [ThemeSettings.PREFERRED_DARK_THEME]: preferredDarkThemeSettingSchema,
    [ThemeSettings.PREFERRED_LIGHT_THEME]: preferredLightThemeSettingSchema,
    [ThemeSettings.PREFERRED_HC_DARK_THEME]: preferredHCDarkThemeSettingSchema,
    [ThemeSettings.PREFERRED_HC_LIGHT_THEME]: preferredHCLightThemeSettingSchema,
    [ThemeSettings.FILE_ICON_THEME]: fileIconThemeSettingSchema,
    [ThemeSettings.COLOR_CUSTOMIZATIONS]: colorCustomizationsSchema,
    [ThemeSettings.PRODUCT_ICON_THEME]: productIconThemeSettingSchema
  }
};
configurationRegistry.registerConfiguration(themeSettingsConfiguration);
const themeSettingsWindowConfiguration = {
  id: "window",
  order: 8.1,
  type: "object",
  properties: {
    [ThemeSettings.DETECT_HC]: detectHCSchemeSettingSchema,
    [ThemeSettings.DETECT_COLOR_SCHEME]: detectColorSchemeSettingSchema
  }
};
configurationRegistry.registerConfiguration(themeSettingsWindowConfiguration);
function tokenGroupSettings(description) {
  return {
    description,
    $ref: textmateColorGroupSchemaId
  };
}
const themeSpecificSettingKey = "^\\[[^\\]]*(\\]\\s*\\[[^\\]]*)*\\]$";
const tokenColorSchema = {
  type: "object",
  properties: {
    comments: tokenGroupSettings(nls.localize("editorColors.comments", "Sets the colors and styles for comments")),
    strings: tokenGroupSettings(nls.localize("editorColors.strings", "Sets the colors and styles for strings literals.")),
    keywords: tokenGroupSettings(nls.localize("editorColors.keywords", "Sets the colors and styles for keywords.")),
    numbers: tokenGroupSettings(nls.localize("editorColors.numbers", "Sets the colors and styles for number literals.")),
    types: tokenGroupSettings(nls.localize("editorColors.types", "Sets the colors and styles for type declarations and references.")),
    functions: tokenGroupSettings(nls.localize("editorColors.functions", "Sets the colors and styles for functions declarations and references.")),
    variables: tokenGroupSettings(nls.localize("editorColors.variables", "Sets the colors and styles for variables declarations and references.")),
    textMateRules: {
      description: nls.localize("editorColors.textMateRules", "Sets colors and styles using textmate theming rules (advanced)."),
      $ref: textmateColorsSchemaId
    },
    semanticHighlighting: {
      description: nls.localize("editorColors.semanticHighlighting", "Whether semantic highlighting should be enabled for this theme."),
      deprecationMessage: nls.localize("editorColors.semanticHighlighting.deprecationMessage", "Use `enabled` in `editor.semanticTokenColorCustomizations` setting instead."),
      markdownDeprecationMessage: nls.localize({ key: "editorColors.semanticHighlighting.deprecationMessageMarkdown", comment: ["{0} will become a link to another setting."] }, "Use `enabled` in {0} setting instead.", formatSettingAsLink("editor.semanticTokenColorCustomizations")),
      type: "boolean"
    }
  },
  additionalProperties: false
};
const tokenColorCustomizationSchema = {
  description: nls.localize("editorColors", "Overrides editor syntax colors and font style from the currently selected color theme."),
  default: {},
  allOf: [{ ...tokenColorSchema, patternProperties: { "^\\[": {} } }]
};
const semanticTokenColorSchema = {
  type: "object",
  properties: {
    enabled: {
      type: "boolean",
      description: nls.localize("editorColors.semanticHighlighting.enabled", "Whether semantic highlighting is enabled or disabled for this theme"),
      suggestSortText: "0_enabled"
    },
    rules: {
      $ref: tokenStylingSchemaId,
      description: nls.localize("editorColors.semanticHighlighting.rules", "Semantic token styling rules for this theme."),
      suggestSortText: "0_rules"
    }
  },
  additionalProperties: false
};
const semanticTokenColorCustomizationSchema = {
  description: nls.localize("semanticTokenColors", "Overrides editor semantic token color and styles from the currently selected color theme."),
  default: {},
  allOf: [{ ...semanticTokenColorSchema, patternProperties: { "^\\[": {} } }]
};
const tokenColorCustomizationConfiguration = {
  id: "editor",
  order: 7.2,
  type: "object",
  properties: {
    [ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS]: tokenColorCustomizationSchema,
    [ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS]: semanticTokenColorCustomizationSchema
  }
};
configurationRegistry.registerConfiguration(tokenColorCustomizationConfiguration);
function updateColorThemeConfigurationSchemas(themes) {
  themes.sort((a, b) => a.label.localeCompare(b.label));
  colorThemeSettingEnum.splice(0, colorThemeSettingEnum.length, ...themes.map((t) => t.settingsId));
  colorThemeSettingEnumDescriptions.splice(0, colorThemeSettingEnumDescriptions.length, ...themes.map((t) => t.description || ""));
  colorThemeSettingEnumItemLabels.splice(0, colorThemeSettingEnumItemLabels.length, ...themes.map((t) => t.label || ""));
  const themeSpecificWorkbenchColors = { properties: {} };
  const themeSpecificTokenColors = { properties: {} };
  const themeSpecificSemanticTokenColors = { properties: {} };
  const workbenchColors = { $ref: workbenchColorsSchemaId, additionalProperties: false };
  const tokenColors = { properties: tokenColorSchema.properties, additionalProperties: false };
  for (const t of themes) {
    const themeId = `[${t.settingsId}]`;
    themeSpecificWorkbenchColors.properties[themeId] = workbenchColors;
    themeSpecificTokenColors.properties[themeId] = tokenColors;
    themeSpecificSemanticTokenColors.properties[themeId] = semanticTokenColorSchema;
  }
  themeSpecificWorkbenchColors.patternProperties = { [themeSpecificSettingKey]: workbenchColors };
  themeSpecificTokenColors.patternProperties = { [themeSpecificSettingKey]: tokenColors };
  themeSpecificSemanticTokenColors.patternProperties = { [themeSpecificSettingKey]: semanticTokenColorSchema };
  colorCustomizationsSchema.allOf[1] = themeSpecificWorkbenchColors;
  tokenColorCustomizationSchema.allOf[1] = themeSpecificTokenColors;
  semanticTokenColorCustomizationSchema.allOf[1] = themeSpecificSemanticTokenColors;
  configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration, tokenColorCustomizationConfiguration);
}
function updateFileIconThemeConfigurationSchemas(themes) {
  fileIconThemeSettingSchema.enum.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.settingsId));
  fileIconThemeSettingSchema.enumItemLabels.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.label));
  fileIconThemeSettingSchema.enumDescriptions.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.description || ""));
  configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration);
}
function updateProductIconThemeConfigurationSchemas(themes) {
  productIconThemeSettingSchema.enum.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.settingsId));
  productIconThemeSettingSchema.enumItemLabels.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.label));
  productIconThemeSettingSchema.enumDescriptions.splice(1, Number.MAX_VALUE, ...themes.map((t) => t.description || ""));
  configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration);
}
const colorSchemeToPreferred = {
  [ColorScheme.DARK]: ThemeSettings.PREFERRED_DARK_THEME,
  [ColorScheme.LIGHT]: ThemeSettings.PREFERRED_LIGHT_THEME,
  [ColorScheme.HIGH_CONTRAST_DARK]: ThemeSettings.PREFERRED_HC_DARK_THEME,
  [ColorScheme.HIGH_CONTRAST_LIGHT]: ThemeSettings.PREFERRED_HC_LIGHT_THEME
};
class ThemeConfiguration {
  constructor(configurationService, hostColorService) {
    this.configurationService = configurationService;
    this.hostColorService = hostColorService;
  }
  get colorTheme() {
    return this.configurationService.getValue(this.getColorThemeSettingId());
  }
  get fileIconTheme() {
    return this.configurationService.getValue(ThemeSettings.FILE_ICON_THEME);
  }
  get productIconTheme() {
    return this.configurationService.getValue(ThemeSettings.PRODUCT_ICON_THEME);
  }
  get colorCustomizations() {
    return this.configurationService.getValue(ThemeSettings.COLOR_CUSTOMIZATIONS) || {};
  }
  get tokenColorCustomizations() {
    return this.configurationService.getValue(ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS) || {};
  }
  get semanticTokenColorCustomizations() {
    return this.configurationService.getValue(ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS);
  }
  getPreferredColorScheme() {
    if (this.configurationService.getValue(ThemeSettings.DETECT_HC) && this.hostColorService.highContrast) {
      return this.hostColorService.dark ? ColorScheme.HIGH_CONTRAST_DARK : ColorScheme.HIGH_CONTRAST_LIGHT;
    }
    if (this.configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME)) {
      return this.hostColorService.dark ? ColorScheme.DARK : ColorScheme.LIGHT;
    }
    return void 0;
  }
  isDetectingColorScheme() {
    return this.configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME);
  }
  getColorThemeSettingId() {
    const preferredScheme = this.getPreferredColorScheme();
    return preferredScheme ? colorSchemeToPreferred[preferredScheme] : ThemeSettings.COLOR_THEME;
  }
  async setColorTheme(theme, settingsTarget) {
    await this.writeConfiguration(this.getColorThemeSettingId(), theme.settingsId, settingsTarget);
    return theme;
  }
  async setFileIconTheme(theme, settingsTarget) {
    await this.writeConfiguration(ThemeSettings.FILE_ICON_THEME, theme.settingsId, settingsTarget);
    return theme;
  }
  async setProductIconTheme(theme, settingsTarget) {
    await this.writeConfiguration(ThemeSettings.PRODUCT_ICON_THEME, theme.settingsId, settingsTarget);
    return theme;
  }
  isDefaultColorTheme() {
    const settings = this.configurationService.inspect(this.getColorThemeSettingId());
    return settings && settings.default?.value === settings.value;
  }
  findAutoConfigurationTarget(key) {
    const settings = this.configurationService.inspect(key);
    if (!types.isUndefined(settings.workspaceFolderValue)) {
      return ConfigurationTarget.WORKSPACE_FOLDER;
    } else if (!types.isUndefined(settings.workspaceValue)) {
      return ConfigurationTarget.WORKSPACE;
    } else if (!types.isUndefined(settings.userRemote)) {
      return ConfigurationTarget.USER_REMOTE;
    }
    return ConfigurationTarget.USER;
  }
  async writeConfiguration(key, value, settingsTarget) {
    if (settingsTarget === void 0 || settingsTarget === "preview") {
      return;
    }
    const settings = this.configurationService.inspect(key);
    if (settingsTarget === "auto") {
      return this.configurationService.updateValue(key, value);
    }
    if (settingsTarget === ConfigurationTarget.USER) {
      if (value === settings.userValue) {
        return Promise.resolve(void 0);
      } else if (value === settings.defaultValue) {
        if (types.isUndefined(settings.userValue)) {
          return Promise.resolve(void 0);
        }
        value = void 0;
      }
    } else if (settingsTarget === ConfigurationTarget.WORKSPACE || settingsTarget === ConfigurationTarget.WORKSPACE_FOLDER || settingsTarget === ConfigurationTarget.USER_REMOTE) {
      if (value === settings.value) {
        return Promise.resolve(void 0);
      }
    }
    return this.configurationService.updateValue(key, value, settingsTarget);
  }
}
export {
  COLOR_THEME_CONFIGURATION_SETTINGS_TAG,
  ThemeConfiguration,
  formatSettingAsLink,
  updateColorThemeConfigurationSchemas,
  updateFileIconThemeConfigurationSchemas,
  updateProductIconThemeConfigurationSchemas
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi90aGVtZUNvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIElDb25maWd1cmF0aW9uTm9kZSwgQ29uZmlndXJhdGlvblNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcblxuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IHRleHRtYXRlQ29sb3JzU2NoZW1hSWQsIHRleHRtYXRlQ29sb3JHcm91cFNjaGVtYUlkIH0gZnJvbSAnLi9jb2xvclRoZW1lU2NoZW1hLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaENvbG9yc1NjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgdG9rZW5TdHlsaW5nU2NoZW1hSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRoZW1lU2V0dGluZ3MsIElXb3JrYmVuY2hDb2xvclRoZW1lLCBJV29ya2JlbmNoRmlsZUljb25UaGVtZSwgSUNvbG9yQ3VzdG9taXphdGlvbnMsIElUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnMsIElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lLCBJU2VtYW50aWNUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnMsIFRoZW1lU2V0dGluZ1RhcmdldCwgVGhlbWVTZXR0aW5nRGVmYXVsdHMgfSBmcm9tICcuL3dvcmtiZW5jaFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UsIENvbmZpZ3VyYXRpb25UYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSUhvc3RDb2xvclNjaGVtZVNlcnZpY2UgfSBmcm9tICcuL2hvc3RDb2xvclNjaGVtZVNlcnZpY2UuanMnO1xuXG4vLyBDb25maWd1cmF0aW9uOiBUaGVtZXNcbmNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXG5jb25zdCBjb2xvclRoZW1lU2V0dGluZ0VudW06IHN0cmluZ1tdID0gW107XG5jb25zdCBjb2xvclRoZW1lU2V0dGluZ0VudW1JdGVtTGFiZWxzOiBzdHJpbmdbXSA9IFtdO1xuY29uc3QgY29sb3JUaGVtZVNldHRpbmdFbnVtRGVzY3JpcHRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0U2V0dGluZ0FzTGluayhzdHI6IHN0cmluZykge1xuXHRyZXR1cm4gYFxcYCMke3N0cn0jXFxgYDtcbn1cblxuZXhwb3J0IGNvbnN0IENPTE9SX1RIRU1FX0NPTkZJR1VSQVRJT05fU0VUVElOR1NfVEFHID0gJ2NvbG9yVGhlbWVDb25maWd1cmF0aW9uJztcblxuY29uc3QgY29sb3JUaGVtZVNldHRpbmdTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6ICdzdHJpbmcnLFxuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdjb2xvclRoZW1lJywgY29tbWVudDogWyd7MH0gd2lsbCBiZWNvbWUgYSBsaW5rIHRvIGFub3RoZXIgc2V0dGluZy4nXSB9LCBcIlNwZWNpZmllcyB0aGUgY29sb3IgdGhlbWUgdXNlZCBpbiB0aGUgd29ya2JlbmNoIHdoZW4gezB9IGlzIG5vdCBlbmFibGVkLlwiLCBmb3JtYXRTZXR0aW5nQXNMaW5rKFRoZW1lU2V0dGluZ3MuREVURUNUX0NPTE9SX1NDSEVNRSkpLFxuXHRkZWZhdWx0OiBpc1dlYiA/IFRoZW1lU2V0dGluZ0RlZmF1bHRzLkNPTE9SX1RIRU1FX0xJR0hUIDogVGhlbWVTZXR0aW5nRGVmYXVsdHMuQ09MT1JfVEhFTUVfREFSSyxcblx0dGFnczogW0NPTE9SX1RIRU1FX0NPTkZJR1VSQVRJT05fU0VUVElOR1NfVEFHXSxcblx0ZW51bTogY29sb3JUaGVtZVNldHRpbmdFbnVtLFxuXHRlbnVtRGVzY3JpcHRpb25zOiBjb2xvclRoZW1lU2V0dGluZ0VudW1EZXNjcmlwdGlvbnMsXG5cdGVudW1JdGVtTGFiZWxzOiBjb2xvclRoZW1lU2V0dGluZ0VudW1JdGVtTGFiZWxzLFxuXHRlcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29sb3JUaGVtZUVycm9yJywgXCJUaGVtZSBpcyB1bmtub3duIG9yIG5vdCBpbnN0YWxsZWQuXCIpLFxufTtcbmNvbnN0IHByZWZlcnJlZERhcmtUaGVtZVNldHRpbmdTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6ICdzdHJpbmcnLCAvL1xuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdwcmVmZXJyZWREYXJrQ29sb3JUaGVtZScsIGNvbW1lbnQ6IFsnezB9IHdpbGwgYmVjb21lIGEgbGluayB0byBhbm90aGVyIHNldHRpbmcuJ10gfSwgJ1NwZWNpZmllcyB0aGUgY29sb3IgdGhlbWUgd2hlbiBzeXN0ZW0gY29sb3IgbW9kZSBpcyBkYXJrIGFuZCB7MH0gaXMgZW5hYmxlZC4nLCBmb3JtYXRTZXR0aW5nQXNMaW5rKFRoZW1lU2V0dGluZ3MuREVURUNUX0NPTE9SX1NDSEVNRSkpLFxuXHRkZWZhdWx0OiBUaGVtZVNldHRpbmdEZWZhdWx0cy5DT0xPUl9USEVNRV9EQVJLLFxuXHR0YWdzOiBbQ09MT1JfVEhFTUVfQ09ORklHVVJBVElPTl9TRVRUSU5HU19UQUddLFxuXHRlbnVtOiBjb2xvclRoZW1lU2V0dGluZ0VudW0sXG5cdGVudW1EZXNjcmlwdGlvbnM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bURlc2NyaXB0aW9ucyxcblx0ZW51bUl0ZW1MYWJlbHM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bUl0ZW1MYWJlbHMsXG5cdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb2xvclRoZW1lRXJyb3InLCBcIlRoZW1lIGlzIHVua25vd24gb3Igbm90IGluc3RhbGxlZC5cIiksXG59O1xuY29uc3QgcHJlZmVycmVkTGlnaHRUaGVtZVNldHRpbmdTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6ICdzdHJpbmcnLFxuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdwcmVmZXJyZWRMaWdodENvbG9yVGhlbWUnLCBjb21tZW50OiBbJ3swfSB3aWxsIGJlY29tZSBhIGxpbmsgdG8gYW5vdGhlciBzZXR0aW5nLiddIH0sICdTcGVjaWZpZXMgdGhlIGNvbG9yIHRoZW1lIHdoZW4gc3lzdGVtIGNvbG9yIG1vZGUgaXMgbGlnaHQgYW5kIHswfSBpcyBlbmFibGVkLicsIGZvcm1hdFNldHRpbmdBc0xpbmsoVGhlbWVTZXR0aW5ncy5ERVRFQ1RfQ09MT1JfU0NIRU1FKSksXG5cdGRlZmF1bHQ6IFRoZW1lU2V0dGluZ0RlZmF1bHRzLkNPTE9SX1RIRU1FX0xJR0hULFxuXHR0YWdzOiBbQ09MT1JfVEhFTUVfQ09ORklHVVJBVElPTl9TRVRUSU5HU19UQUddLFxuXHRlbnVtOiBjb2xvclRoZW1lU2V0dGluZ0VudW0sXG5cdGVudW1EZXNjcmlwdGlvbnM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bURlc2NyaXB0aW9ucyxcblx0ZW51bUl0ZW1MYWJlbHM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bUl0ZW1MYWJlbHMsXG5cdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb2xvclRoZW1lRXJyb3InLCBcIlRoZW1lIGlzIHVua25vd24gb3Igbm90IGluc3RhbGxlZC5cIiksXG59O1xuY29uc3QgcHJlZmVycmVkSENEYXJrVGhlbWVTZXR0aW5nU2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKHsga2V5OiAncHJlZmVycmVkSENEYXJrQ29sb3JUaGVtZScsIGNvbW1lbnQ6IFsnezB9IHdpbGwgYmVjb21lIGEgbGluayB0byBhbm90aGVyIHNldHRpbmcuJ10gfSwgJ1NwZWNpZmllcyB0aGUgY29sb3IgdGhlbWUgd2hlbiBpbiBoaWdoIGNvbnRyYXN0IGRhcmsgbW9kZSBhbmQgezB9IGlzIGVuYWJsZWQuJywgZm9ybWF0U2V0dGluZ0FzTGluayhUaGVtZVNldHRpbmdzLkRFVEVDVF9IQykpLFxuXHRkZWZhdWx0OiBUaGVtZVNldHRpbmdEZWZhdWx0cy5DT0xPUl9USEVNRV9IQ19EQVJLLFxuXHR0YWdzOiBbQ09MT1JfVEhFTUVfQ09ORklHVVJBVElPTl9TRVRUSU5HU19UQUddLFxuXHRlbnVtOiBjb2xvclRoZW1lU2V0dGluZ0VudW0sXG5cdGVudW1EZXNjcmlwdGlvbnM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bURlc2NyaXB0aW9ucyxcblx0ZW51bUl0ZW1MYWJlbHM6IGNvbG9yVGhlbWVTZXR0aW5nRW51bUl0ZW1MYWJlbHMsXG5cdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb2xvclRoZW1lRXJyb3InLCBcIlRoZW1lIGlzIHVua25vd24gb3Igbm90IGluc3RhbGxlZC5cIiksXG59O1xuY29uc3QgcHJlZmVycmVkSENMaWdodFRoZW1lU2V0dGluZ1NjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0dHlwZTogJ3N0cmluZycsXG5cdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSh7IGtleTogJ3ByZWZlcnJlZEhDTGlnaHRDb2xvclRoZW1lJywgY29tbWVudDogWyd7MH0gd2lsbCBiZWNvbWUgYSBsaW5rIHRvIGFub3RoZXIgc2V0dGluZy4nXSB9LCAnU3BlY2lmaWVzIHRoZSBjb2xvciB0aGVtZSB3aGVuIGluIGhpZ2ggY29udHJhc3QgbGlnaHQgbW9kZSBhbmQgezB9IGlzIGVuYWJsZWQuJywgZm9ybWF0U2V0dGluZ0FzTGluayhUaGVtZVNldHRpbmdzLkRFVEVDVF9IQykpLFxuXHRkZWZhdWx0OiBUaGVtZVNldHRpbmdEZWZhdWx0cy5DT0xPUl9USEVNRV9IQ19MSUdIVCxcblx0dGFnczogW0NPTE9SX1RIRU1FX0NPTkZJR1VSQVRJT05fU0VUVElOR1NfVEFHXSxcblx0ZW51bTogY29sb3JUaGVtZVNldHRpbmdFbnVtLFxuXHRlbnVtRGVzY3JpcHRpb25zOiBjb2xvclRoZW1lU2V0dGluZ0VudW1EZXNjcmlwdGlvbnMsXG5cdGVudW1JdGVtTGFiZWxzOiBjb2xvclRoZW1lU2V0dGluZ0VudW1JdGVtTGFiZWxzLFxuXHRlcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29sb3JUaGVtZUVycm9yJywgXCJUaGVtZSBpcyB1bmtub3duIG9yIG5vdCBpbnN0YWxsZWQuXCIpLFxufTtcbmNvbnN0IGRldGVjdENvbG9yU2NoZW1lU2V0dGluZ1NjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdkZXRlY3RDb2xvclNjaGVtZScsIGNvbW1lbnQ6IFsnezB9IGFuZCB7MX0gd2lsbCBiZWNvbWUgbGlua3MgdG8gb3RoZXIgc2V0dGluZ3MuJ10gfSwgJ0lmIGVuYWJsZWQsIHdpbGwgYXV0b21hdGljYWxseSBzZWxlY3QgYSBjb2xvciB0aGVtZSBiYXNlZCBvbiB0aGUgc3lzdGVtIGNvbG9yIG1vZGUuIElmIHRoZSBzeXN0ZW0gY29sb3IgbW9kZSBpcyBkYXJrLCB7MH0gaXMgdXNlZCwgZWxzZSB7MX0uJywgZm9ybWF0U2V0dGluZ0FzTGluayhUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9EQVJLX1RIRU1FKSwgZm9ybWF0U2V0dGluZ0FzTGluayhUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9MSUdIVF9USEVNRSkpLFxuXHRkZWZhdWx0OiBmYWxzZSxcblx0dGFnczogW0NPTE9SX1RIRU1FX0NPTkZJR1VSQVRJT05fU0VUVElOR1NfVEFHXSxcbn07XG5cbmNvbnN0IGNvbG9yQ3VzdG9taXphdGlvbnNTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd3b3JrYmVuY2hDb2xvcnMnLCBcIk92ZXJyaWRlcyBjb2xvcnMgZnJvbSB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGNvbG9yIHRoZW1lLlwiKSxcblx0YWxsT2Y6IFt7ICRyZWY6IHdvcmtiZW5jaENvbG9yc1NjaGVtYUlkIH1dLFxuXHRkZWZhdWx0OiB7fSxcblx0ZGVmYXVsdFNuaXBwZXRzOiBbe1xuXHRcdGJvZHk6IHtcblx0XHR9XG5cdH1dXG59O1xuY29uc3QgZmlsZUljb25UaGVtZVNldHRpbmdTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0ZGVmYXVsdDogVGhlbWVTZXR0aW5nRGVmYXVsdHMuRklMRV9JQ09OX1RIRU1FLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpY29uVGhlbWUnLCBcIlNwZWNpZmllcyB0aGUgZmlsZSBpY29uIHRoZW1lIHVzZWQgaW4gdGhlIHdvcmtiZW5jaCBvciAnbnVsbCcgdG8gbm90IHNob3cgYW55IGZpbGUgaWNvbnMuXCIpLFxuXHRlbnVtOiBbbnVsbF0sXG5cdGVudW1JdGVtTGFiZWxzOiBbbmxzLmxvY2FsaXplKCdub0ljb25UaGVtZUxhYmVsJywgJ05vbmUnKV0sXG5cdGVudW1EZXNjcmlwdGlvbnM6IFtubHMubG9jYWxpemUoJ25vSWNvblRoZW1lRGVzYycsICdObyBmaWxlIGljb25zJyldLFxuXHRlcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnaWNvblRoZW1lRXJyb3InLCBcIkZpbGUgaWNvbiB0aGVtZSBpcyB1bmtub3duIG9yIG5vdCBpbnN0YWxsZWQuXCIpXG59O1xuY29uc3QgcHJvZHVjdEljb25UaGVtZVNldHRpbmdTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0ZGVmYXVsdDogVGhlbWVTZXR0aW5nRGVmYXVsdHMuUFJPRFVDVF9JQ09OX1RIRU1FLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwcm9kdWN0SWNvblRoZW1lJywgXCJTcGVjaWZpZXMgdGhlIHByb2R1Y3QgaWNvbiB0aGVtZSB1c2VkLlwiKSxcblx0ZW51bTogW1RoZW1lU2V0dGluZ0RlZmF1bHRzLlBST0RVQ1RfSUNPTl9USEVNRV0sXG5cdGVudW1JdGVtTGFiZWxzOiBbbmxzLmxvY2FsaXplKCdkZWZhdWx0UHJvZHVjdEljb25UaGVtZUxhYmVsJywgJ0RlZmF1bHQnKV0sXG5cdGVudW1EZXNjcmlwdGlvbnM6IFtubHMubG9jYWxpemUoJ2RlZmF1bHRQcm9kdWN0SWNvblRoZW1lRGVzYycsICdEZWZhdWx0JyldLFxuXHRlcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgncHJvZHVjdEljb25UaGVtZUVycm9yJywgXCJQcm9kdWN0IGljb24gdGhlbWUgaXMgdW5rbm93biBvciBub3QgaW5zdGFsbGVkLlwiKVxufTtcblxuY29uc3QgZGV0ZWN0SENTY2hlbWVTZXR0aW5nU2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hID0ge1xuXHR0eXBlOiAnYm9vbGVhbicsXG5cdGRlZmF1bHQ6IHRydWUsXG5cdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSh7IGtleTogJ2F1dG9EZXRlY3RIaWdoQ29udHJhc3QnLCBjb21tZW50OiBbJ3swfSBhbmQgezF9IHdpbGwgYmVjb21lIGxpbmtzIHRvIG90aGVyIHNldHRpbmdzLiddIH0sIFwiSWYgZW5hYmxlZCwgd2lsbCBhdXRvbWF0aWNhbGx5IGNoYW5nZSB0byBoaWdoIGNvbnRyYXN0IHRoZW1lIGlmIHRoZSBPUyBpcyB1c2luZyBhIGhpZ2ggY29udHJhc3QgdGhlbWUuIFRoZSBoaWdoIGNvbnRyYXN0IHRoZW1lIHRvIHVzZSBpcyBzcGVjaWZpZWQgYnkgezB9IGFuZCB7MX0uXCIsIGZvcm1hdFNldHRpbmdBc0xpbmsoVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfREFSS19USEVNRSksIGZvcm1hdFNldHRpbmdBc0xpbmsoVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfTElHSFRfVEhFTUUpKSxcblx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0dGFnczogW0NPTE9SX1RIRU1FX0NPTkZJR1VSQVRJT05fU0VUVElOR1NfVEFHXSxcbn07XG5cbmNvbnN0IHRoZW1lU2V0dGluZ3NDb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUgPSB7XG5cdGlkOiAnd29ya2JlbmNoJyxcblx0b3JkZXI6IDcuMSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRbVGhlbWVTZXR0aW5ncy5DT0xPUl9USEVNRV06IGNvbG9yVGhlbWVTZXR0aW5nU2NoZW1hLFxuXHRcdFtUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9EQVJLX1RIRU1FXTogcHJlZmVycmVkRGFya1RoZW1lU2V0dGluZ1NjaGVtYSxcblx0XHRbVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfTElHSFRfVEhFTUVdOiBwcmVmZXJyZWRMaWdodFRoZW1lU2V0dGluZ1NjaGVtYSxcblx0XHRbVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfREFSS19USEVNRV06IHByZWZlcnJlZEhDRGFya1RoZW1lU2V0dGluZ1NjaGVtYSxcblx0XHRbVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfTElHSFRfVEhFTUVdOiBwcmVmZXJyZWRIQ0xpZ2h0VGhlbWVTZXR0aW5nU2NoZW1hLFxuXHRcdFtUaGVtZVNldHRpbmdzLkZJTEVfSUNPTl9USEVNRV06IGZpbGVJY29uVGhlbWVTZXR0aW5nU2NoZW1hLFxuXHRcdFtUaGVtZVNldHRpbmdzLkNPTE9SX0NVU1RPTUlaQVRJT05TXTogY29sb3JDdXN0b21pemF0aW9uc1NjaGVtYSxcblx0XHRbVGhlbWVTZXR0aW5ncy5QUk9EVUNUX0lDT05fVEhFTUVdOiBwcm9kdWN0SWNvblRoZW1lU2V0dGluZ1NjaGVtYVxuXHR9XG59O1xuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih0aGVtZVNldHRpbmdzQ29uZmlndXJhdGlvbik7XG5cbmNvbnN0IHRoZW1lU2V0dGluZ3NXaW5kb3dDb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUgPSB7XG5cdGlkOiAnd2luZG93Jyxcblx0b3JkZXI6IDguMSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRbVGhlbWVTZXR0aW5ncy5ERVRFQ1RfSENdOiBkZXRlY3RIQ1NjaGVtZVNldHRpbmdTY2hlbWEsXG5cdFx0W1RoZW1lU2V0dGluZ3MuREVURUNUX0NPTE9SX1NDSEVNRV06IGRldGVjdENvbG9yU2NoZW1lU2V0dGluZ1NjaGVtYSxcblx0fVxufTtcbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24odGhlbWVTZXR0aW5nc1dpbmRvd0NvbmZpZ3VyYXRpb24pO1xuXG5mdW5jdGlvbiB0b2tlbkdyb3VwU2V0dGluZ3MoZGVzY3JpcHRpb246IHN0cmluZyk6IElKU09OU2NoZW1hIHtcblx0cmV0dXJuIHtcblx0XHRkZXNjcmlwdGlvbixcblx0XHQkcmVmOiB0ZXh0bWF0ZUNvbG9yR3JvdXBTY2hlbWFJZFxuXHR9O1xufVxuXG5jb25zdCB0aGVtZVNwZWNpZmljU2V0dGluZ0tleSA9ICdeXFxcXFtbXlxcXFxdXSooXFxcXF1cXFxccypcXFxcW1teXFxcXF1dKikqXFxcXF0kJztcblxuY29uc3QgdG9rZW5Db2xvclNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0Y29tbWVudHM6IHRva2VuR3JvdXBTZXR0aW5ncyhubHMubG9jYWxpemUoJ2VkaXRvckNvbG9ycy5jb21tZW50cycsIFwiU2V0cyB0aGUgY29sb3JzIGFuZCBzdHlsZXMgZm9yIGNvbW1lbnRzXCIpKSxcblx0XHRzdHJpbmdzOiB0b2tlbkdyb3VwU2V0dGluZ3MobmxzLmxvY2FsaXplKCdlZGl0b3JDb2xvcnMuc3RyaW5ncycsIFwiU2V0cyB0aGUgY29sb3JzIGFuZCBzdHlsZXMgZm9yIHN0cmluZ3MgbGl0ZXJhbHMuXCIpKSxcblx0XHRrZXl3b3JkczogdG9rZW5Hcm91cFNldHRpbmdzKG5scy5sb2NhbGl6ZSgnZWRpdG9yQ29sb3JzLmtleXdvcmRzJywgXCJTZXRzIHRoZSBjb2xvcnMgYW5kIHN0eWxlcyBmb3Iga2V5d29yZHMuXCIpKSxcblx0XHRudW1iZXJzOiB0b2tlbkdyb3VwU2V0dGluZ3MobmxzLmxvY2FsaXplKCdlZGl0b3JDb2xvcnMubnVtYmVycycsIFwiU2V0cyB0aGUgY29sb3JzIGFuZCBzdHlsZXMgZm9yIG51bWJlciBsaXRlcmFscy5cIikpLFxuXHRcdHR5cGVzOiB0b2tlbkdyb3VwU2V0dGluZ3MobmxzLmxvY2FsaXplKCdlZGl0b3JDb2xvcnMudHlwZXMnLCBcIlNldHMgdGhlIGNvbG9ycyBhbmQgc3R5bGVzIGZvciB0eXBlIGRlY2xhcmF0aW9ucyBhbmQgcmVmZXJlbmNlcy5cIikpLFxuXHRcdGZ1bmN0aW9uczogdG9rZW5Hcm91cFNldHRpbmdzKG5scy5sb2NhbGl6ZSgnZWRpdG9yQ29sb3JzLmZ1bmN0aW9ucycsIFwiU2V0cyB0aGUgY29sb3JzIGFuZCBzdHlsZXMgZm9yIGZ1bmN0aW9ucyBkZWNsYXJhdGlvbnMgYW5kIHJlZmVyZW5jZXMuXCIpKSxcblx0XHR2YXJpYWJsZXM6IHRva2VuR3JvdXBTZXR0aW5ncyhubHMubG9jYWxpemUoJ2VkaXRvckNvbG9ycy52YXJpYWJsZXMnLCBcIlNldHMgdGhlIGNvbG9ycyBhbmQgc3R5bGVzIGZvciB2YXJpYWJsZXMgZGVjbGFyYXRpb25zIGFuZCByZWZlcmVuY2VzLlwiKSksXG5cdFx0dGV4dE1hdGVSdWxlczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yQ29sb3JzLnRleHRNYXRlUnVsZXMnLCAnU2V0cyBjb2xvcnMgYW5kIHN0eWxlcyB1c2luZyB0ZXh0bWF0ZSB0aGVtaW5nIHJ1bGVzIChhZHZhbmNlZCkuJyksXG5cdFx0XHQkcmVmOiB0ZXh0bWF0ZUNvbG9yc1NjaGVtYUlkXG5cdFx0fSxcblx0XHRzZW1hbnRpY0hpZ2hsaWdodGluZzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yQ29sb3JzLnNlbWFudGljSGlnaGxpZ2h0aW5nJywgJ1doZXRoZXIgc2VtYW50aWMgaGlnaGxpZ2h0aW5nIHNob3VsZCBiZSBlbmFibGVkIGZvciB0aGlzIHRoZW1lLicpLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ2VkaXRvckNvbG9ycy5zZW1hbnRpY0hpZ2hsaWdodGluZy5kZXByZWNhdGlvbk1lc3NhZ2UnLCAnVXNlIGBlbmFibGVkYCBpbiBgZWRpdG9yLnNlbWFudGljVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zYCBzZXR0aW5nIGluc3RlYWQuJyksXG5cdFx0XHRtYXJrZG93bkRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKHsga2V5OiAnZWRpdG9yQ29sb3JzLnNlbWFudGljSGlnaGxpZ2h0aW5nLmRlcHJlY2F0aW9uTWVzc2FnZU1hcmtkb3duJywgY29tbWVudDogWyd7MH0gd2lsbCBiZWNvbWUgYSBsaW5rIHRvIGFub3RoZXIgc2V0dGluZy4nXSB9LCAnVXNlIGBlbmFibGVkYCBpbiB7MH0gc2V0dGluZyBpbnN0ZWFkLicsIGZvcm1hdFNldHRpbmdBc0xpbmsoJ2VkaXRvci5zZW1hbnRpY1Rva2VuQ29sb3JDdXN0b21pemF0aW9ucycpKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdH1cblx0fSxcblx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlXG59O1xuXG5jb25zdCB0b2tlbkNvbG9yQ3VzdG9taXphdGlvblNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZWRpdG9yQ29sb3JzJywgXCJPdmVycmlkZXMgZWRpdG9yIHN5bnRheCBjb2xvcnMgYW5kIGZvbnQgc3R5bGUgZnJvbSB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGNvbG9yIHRoZW1lLlwiKSxcblx0ZGVmYXVsdDoge30sXG5cdGFsbE9mOiBbeyAuLi50b2tlbkNvbG9yU2NoZW1hLCBwYXR0ZXJuUHJvcGVydGllczogeyAnXlxcXFxbJzoge30gfSB9XVxufTtcblxuY29uc3Qgc2VtYW50aWNUb2tlbkNvbG9yU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRlbmFibGVkOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3JDb2xvcnMuc2VtYW50aWNIaWdobGlnaHRpbmcuZW5hYmxlZCcsICdXaGV0aGVyIHNlbWFudGljIGhpZ2hsaWdodGluZyBpcyBlbmFibGVkIG9yIGRpc2FibGVkIGZvciB0aGlzIHRoZW1lJyksXG5cdFx0XHRzdWdnZXN0U29ydFRleHQ6ICcwX2VuYWJsZWQnXG5cdFx0fSxcblx0XHRydWxlczoge1xuXHRcdFx0JHJlZjogdG9rZW5TdHlsaW5nU2NoZW1hSWQsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdlZGl0b3JDb2xvcnMuc2VtYW50aWNIaWdobGlnaHRpbmcucnVsZXMnLCAnU2VtYW50aWMgdG9rZW4gc3R5bGluZyBydWxlcyBmb3IgdGhpcyB0aGVtZS4nKSxcblx0XHRcdHN1Z2dlc3RTb3J0VGV4dDogJzBfcnVsZXMnXG5cdFx0fVxuXHR9LFxuXHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2Vcbn07XG5cbmNvbnN0IHNlbWFudGljVG9rZW5Db2xvckN1c3RvbWl6YXRpb25TY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlbWFudGljVG9rZW5Db2xvcnMnLCBcIk92ZXJyaWRlcyBlZGl0b3Igc2VtYW50aWMgdG9rZW4gY29sb3IgYW5kIHN0eWxlcyBmcm9tIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgY29sb3IgdGhlbWUuXCIpLFxuXHRkZWZhdWx0OiB7fSxcblx0YWxsT2Y6IFt7IC4uLnNlbWFudGljVG9rZW5Db2xvclNjaGVtYSwgcGF0dGVyblByb3BlcnRpZXM6IHsgJ15cXFxcWyc6IHt9IH0gfV1cbn07XG5cbmNvbnN0IHRva2VuQ29sb3JDdXN0b21pemF0aW9uQ29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Ob2RlID0ge1xuXHRpZDogJ2VkaXRvcicsXG5cdG9yZGVyOiA3LjIsXG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0W1RoZW1lU2V0dGluZ3MuVE9LRU5fQ09MT1JfQ1VTVE9NSVpBVElPTlNdOiB0b2tlbkNvbG9yQ3VzdG9taXphdGlvblNjaGVtYSxcblx0XHRbVGhlbWVTZXR0aW5ncy5TRU1BTlRJQ19UT0tFTl9DT0xPUl9DVVNUT01JWkFUSU9OU106IHNlbWFudGljVG9rZW5Db2xvckN1c3RvbWl6YXRpb25TY2hlbWFcblx0fVxufTtcblxuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih0b2tlbkNvbG9yQ3VzdG9taXphdGlvbkNvbmZpZ3VyYXRpb24pO1xuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlQ29sb3JUaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzKHRoZW1lczogSVdvcmtiZW5jaENvbG9yVGhlbWVbXSkge1xuXHQvLyB1cGRhdGVzIGVudW0gZm9yIHRoZSAnd29ya2JlbmNoLmNvbG9yVGhlbWVgIHNldHRpbmdcblx0dGhlbWVzLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSk7XG5cdGNvbG9yVGhlbWVTZXR0aW5nRW51bS5zcGxpY2UoMCwgY29sb3JUaGVtZVNldHRpbmdFbnVtLmxlbmd0aCwgLi4udGhlbWVzLm1hcCh0ID0+IHQuc2V0dGluZ3NJZCkpO1xuXHRjb2xvclRoZW1lU2V0dGluZ0VudW1EZXNjcmlwdGlvbnMuc3BsaWNlKDAsIGNvbG9yVGhlbWVTZXR0aW5nRW51bURlc2NyaXB0aW9ucy5sZW5ndGgsIC4uLnRoZW1lcy5tYXAodCA9PiB0LmRlc2NyaXB0aW9uIHx8ICcnKSk7XG5cdGNvbG9yVGhlbWVTZXR0aW5nRW51bUl0ZW1MYWJlbHMuc3BsaWNlKDAsIGNvbG9yVGhlbWVTZXR0aW5nRW51bUl0ZW1MYWJlbHMubGVuZ3RoLCAuLi50aGVtZXMubWFwKHQgPT4gdC5sYWJlbCB8fCAnJykpO1xuXG5cdGNvbnN0IHRoZW1lU3BlY2lmaWNXb3JrYmVuY2hDb2xvcnM6IElKU09OU2NoZW1hID0geyBwcm9wZXJ0aWVzOiB7fSB9O1xuXHRjb25zdCB0aGVtZVNwZWNpZmljVG9rZW5Db2xvcnM6IElKU09OU2NoZW1hID0geyBwcm9wZXJ0aWVzOiB7fSB9O1xuXHRjb25zdCB0aGVtZVNwZWNpZmljU2VtYW50aWNUb2tlbkNvbG9yczogSUpTT05TY2hlbWEgPSB7IHByb3BlcnRpZXM6IHt9IH07XG5cblx0Y29uc3Qgd29ya2JlbmNoQ29sb3JzID0geyAkcmVmOiB3b3JrYmVuY2hDb2xvcnNTY2hlbWFJZCwgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlIH07XG5cdGNvbnN0IHRva2VuQ29sb3JzID0geyBwcm9wZXJ0aWVzOiB0b2tlbkNvbG9yU2NoZW1hLnByb3BlcnRpZXMsIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSB9O1xuXHRmb3IgKGNvbnN0IHQgb2YgdGhlbWVzKSB7XG5cdFx0Ly8gYWRkIHRoZW1lIHNwZWNpZmljIGNvbG9yIGN1c3RvbWl6YXRpb24gKFwiW0FieXNzXVwiOnsgLi4uIH0pXG5cdFx0Y29uc3QgdGhlbWVJZCA9IGBbJHt0LnNldHRpbmdzSWR9XWA7XG5cdFx0dGhlbWVTcGVjaWZpY1dvcmtiZW5jaENvbG9ycy5wcm9wZXJ0aWVzIVt0aGVtZUlkXSA9IHdvcmtiZW5jaENvbG9ycztcblx0XHR0aGVtZVNwZWNpZmljVG9rZW5Db2xvcnMucHJvcGVydGllcyFbdGhlbWVJZF0gPSB0b2tlbkNvbG9ycztcblx0XHR0aGVtZVNwZWNpZmljU2VtYW50aWNUb2tlbkNvbG9ycy5wcm9wZXJ0aWVzIVt0aGVtZUlkXSA9IHNlbWFudGljVG9rZW5Db2xvclNjaGVtYTtcblx0fVxuXHR0aGVtZVNwZWNpZmljV29ya2JlbmNoQ29sb3JzLnBhdHRlcm5Qcm9wZXJ0aWVzID0geyBbdGhlbWVTcGVjaWZpY1NldHRpbmdLZXldOiB3b3JrYmVuY2hDb2xvcnMgfTtcblx0dGhlbWVTcGVjaWZpY1Rva2VuQ29sb3JzLnBhdHRlcm5Qcm9wZXJ0aWVzID0geyBbdGhlbWVTcGVjaWZpY1NldHRpbmdLZXldOiB0b2tlbkNvbG9ycyB9O1xuXHR0aGVtZVNwZWNpZmljU2VtYW50aWNUb2tlbkNvbG9ycy5wYXR0ZXJuUHJvcGVydGllcyA9IHsgW3RoZW1lU3BlY2lmaWNTZXR0aW5nS2V5XTogc2VtYW50aWNUb2tlbkNvbG9yU2NoZW1hIH07XG5cblx0Y29sb3JDdXN0b21pemF0aW9uc1NjaGVtYS5hbGxPZiFbMV0gPSB0aGVtZVNwZWNpZmljV29ya2JlbmNoQ29sb3JzO1xuXHR0b2tlbkNvbG9yQ3VzdG9taXphdGlvblNjaGVtYS5hbGxPZiFbMV0gPSB0aGVtZVNwZWNpZmljVG9rZW5Db2xvcnM7XG5cdHNlbWFudGljVG9rZW5Db2xvckN1c3RvbWl6YXRpb25TY2hlbWEuYWxsT2YhWzFdID0gdGhlbWVTcGVjaWZpY1NlbWFudGljVG9rZW5Db2xvcnM7XG5cblx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5Lm5vdGlmeUNvbmZpZ3VyYXRpb25TY2hlbWFVcGRhdGVkKHRoZW1lU2V0dGluZ3NDb25maWd1cmF0aW9uLCB0b2tlbkNvbG9yQ3VzdG9taXphdGlvbkNvbmZpZ3VyYXRpb24pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlRmlsZUljb25UaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzKHRoZW1lczogSVdvcmtiZW5jaEZpbGVJY29uVGhlbWVbXSkge1xuXHRmaWxlSWNvblRoZW1lU2V0dGluZ1NjaGVtYS5lbnVtIS5zcGxpY2UoMSwgTnVtYmVyLk1BWF9WQUxVRSwgLi4udGhlbWVzLm1hcCh0ID0+IHQuc2V0dGluZ3NJZCkpO1xuXHRmaWxlSWNvblRoZW1lU2V0dGluZ1NjaGVtYS5lbnVtSXRlbUxhYmVscyEuc3BsaWNlKDEsIE51bWJlci5NQVhfVkFMVUUsIC4uLnRoZW1lcy5tYXAodCA9PiB0LmxhYmVsKSk7XG5cdGZpbGVJY29uVGhlbWVTZXR0aW5nU2NoZW1hLmVudW1EZXNjcmlwdGlvbnMhLnNwbGljZSgxLCBOdW1iZXIuTUFYX1ZBTFVFLCAuLi50aGVtZXMubWFwKHQgPT4gdC5kZXNjcmlwdGlvbiB8fCAnJykpO1xuXG5cdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5ub3RpZnlDb25maWd1cmF0aW9uU2NoZW1hVXBkYXRlZCh0aGVtZVNldHRpbmdzQ29uZmlndXJhdGlvbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVQcm9kdWN0SWNvblRoZW1lQ29uZmlndXJhdGlvblNjaGVtYXModGhlbWVzOiBJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZVtdKSB7XG5cdHByb2R1Y3RJY29uVGhlbWVTZXR0aW5nU2NoZW1hLmVudW0hLnNwbGljZSgxLCBOdW1iZXIuTUFYX1ZBTFVFLCAuLi50aGVtZXMubWFwKHQgPT4gdC5zZXR0aW5nc0lkKSk7XG5cdHByb2R1Y3RJY29uVGhlbWVTZXR0aW5nU2NoZW1hLmVudW1JdGVtTGFiZWxzIS5zcGxpY2UoMSwgTnVtYmVyLk1BWF9WQUxVRSwgLi4udGhlbWVzLm1hcCh0ID0+IHQubGFiZWwpKTtcblx0cHJvZHVjdEljb25UaGVtZVNldHRpbmdTY2hlbWEuZW51bURlc2NyaXB0aW9ucyEuc3BsaWNlKDEsIE51bWJlci5NQVhfVkFMVUUsIC4uLnRoZW1lcy5tYXAodCA9PiB0LmRlc2NyaXB0aW9uIHx8ICcnKSk7XG5cblx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5Lm5vdGlmeUNvbmZpZ3VyYXRpb25TY2hlbWFVcGRhdGVkKHRoZW1lU2V0dGluZ3NDb25maWd1cmF0aW9uKTtcbn1cblxuY29uc3QgY29sb3JTY2hlbWVUb1ByZWZlcnJlZCA9IHtcblx0W0NvbG9yU2NoZW1lLkRBUktdOiBUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9EQVJLX1RIRU1FLFxuXHRbQ29sb3JTY2hlbWUuTElHSFRdOiBUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9MSUdIVF9USEVNRSxcblx0W0NvbG9yU2NoZW1lLkhJR0hfQ09OVFJBU1RfREFSS106IFRoZW1lU2V0dGluZ3MuUFJFRkVSUkVEX0hDX0RBUktfVEhFTUUsXG5cdFtDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0xJR0hUXTogVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfTElHSFRfVEhFTUVcbn07XG5cbmV4cG9ydCBjbGFzcyBUaGVtZUNvbmZpZ3VyYXRpb24ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIHByaXZhdGUgaG9zdENvbG9yU2VydmljZTogSUhvc3RDb2xvclNjaGVtZVNlcnZpY2UpIHtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY29sb3JUaGVtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4odGhpcy5nZXRDb2xvclRoZW1lU2V0dGluZ0lkKCkpO1xuXHR9XG5cblx0cHVibGljIGdldCBmaWxlSWNvblRoZW1lKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZyB8IG51bGw+KFRoZW1lU2V0dGluZ3MuRklMRV9JQ09OX1RIRU1FKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgcHJvZHVjdEljb25UaGVtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oVGhlbWVTZXR0aW5ncy5QUk9EVUNUX0lDT05fVEhFTUUpO1xuXHR9XG5cblx0cHVibGljIGdldCBjb2xvckN1c3RvbWl6YXRpb25zKCk6IElDb2xvckN1c3RvbWl6YXRpb25zIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJQ29sb3JDdXN0b21pemF0aW9ucz4oVGhlbWVTZXR0aW5ncy5DT0xPUl9DVVNUT01JWkFUSU9OUykgfHwge307XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHRva2VuQ29sb3JDdXN0b21pemF0aW9ucygpOiBJVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zPihUaGVtZVNldHRpbmdzLlRPS0VOX0NPTE9SX0NVU1RPTUlaQVRJT05TKSB8fCB7fTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc2VtYW50aWNUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnMoKTogSVNlbWFudGljVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VtYW50aWNUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnM+KFRoZW1lU2V0dGluZ3MuU0VNQU5USUNfVE9LRU5fQ09MT1JfQ1VTVE9NSVpBVElPTlMpO1xuXHR9XG5cblx0cHVibGljIGdldFByZWZlcnJlZENvbG9yU2NoZW1lKCk6IENvbG9yU2NoZW1lIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUaGVtZVNldHRpbmdzLkRFVEVDVF9IQykgJiYgdGhpcy5ob3N0Q29sb3JTZXJ2aWNlLmhpZ2hDb250cmFzdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaG9zdENvbG9yU2VydmljZS5kYXJrID8gQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9EQVJLIDogQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9MSUdIVDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGhlbWVTZXR0aW5ncy5ERVRFQ1RfQ09MT1JfU0NIRU1FKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaG9zdENvbG9yU2VydmljZS5kYXJrID8gQ29sb3JTY2hlbWUuREFSSyA6IENvbG9yU2NoZW1lLkxJR0hUO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGlzRGV0ZWN0aW5nQ29sb3JTY2hlbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGhlbWVTZXR0aW5ncy5ERVRFQ1RfQ09MT1JfU0NIRU1FKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb2xvclRoZW1lU2V0dGluZ0lkKCk6IFRoZW1lU2V0dGluZ3Mge1xuXHRcdGNvbnN0IHByZWZlcnJlZFNjaGVtZSA9IHRoaXMuZ2V0UHJlZmVycmVkQ29sb3JTY2hlbWUoKTtcblx0XHRyZXR1cm4gcHJlZmVycmVkU2NoZW1lID8gY29sb3JTY2hlbWVUb1ByZWZlcnJlZFtwcmVmZXJyZWRTY2hlbWVdIDogVGhlbWVTZXR0aW5ncy5DT0xPUl9USEVNRTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRDb2xvclRoZW1lKHRoZW1lOiBJV29ya2JlbmNoQ29sb3JUaGVtZSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCk6IFByb21pc2U8SVdvcmtiZW5jaENvbG9yVGhlbWU+IHtcblx0XHRhd2FpdCB0aGlzLndyaXRlQ29uZmlndXJhdGlvbih0aGlzLmdldENvbG9yVGhlbWVTZXR0aW5nSWQoKSwgdGhlbWUuc2V0dGluZ3NJZCwgc2V0dGluZ3NUYXJnZXQpO1xuXHRcdHJldHVybiB0aGVtZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRGaWxlSWNvblRoZW1lKHRoZW1lOiBJV29ya2JlbmNoRmlsZUljb25UaGVtZSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCk6IFByb21pc2U8SVdvcmtiZW5jaEZpbGVJY29uVGhlbWU+IHtcblx0XHRhd2FpdCB0aGlzLndyaXRlQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLkZJTEVfSUNPTl9USEVNRSwgdGhlbWUuc2V0dGluZ3NJZCwgc2V0dGluZ3NUYXJnZXQpO1xuXHRcdHJldHVybiB0aGVtZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRQcm9kdWN0SWNvblRoZW1lKHRoZW1lOiBJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCk6IFByb21pc2U8SVdvcmtiZW5jaFByb2R1Y3RJY29uVGhlbWU+IHtcblx0XHRhd2FpdCB0aGlzLndyaXRlQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLlBST0RVQ1RfSUNPTl9USEVNRSwgdGhlbWUuc2V0dGluZ3NJZCwgc2V0dGluZ3NUYXJnZXQpO1xuXHRcdHJldHVybiB0aGVtZTtcblx0fVxuXG5cdHB1YmxpYyBpc0RlZmF1bHRDb2xvclRoZW1lKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHNldHRpbmdzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KHRoaXMuZ2V0Q29sb3JUaGVtZVNldHRpbmdJZCgpKTtcblx0XHRyZXR1cm4gc2V0dGluZ3MgJiYgc2V0dGluZ3MuZGVmYXVsdD8udmFsdWUgPT09IHNldHRpbmdzLnZhbHVlO1xuXHR9XG5cblx0cHVibGljIGZpbmRBdXRvQ29uZmlndXJhdGlvblRhcmdldChrZXk6IHN0cmluZykge1xuXHRcdGNvbnN0IHNldHRpbmdzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGtleSk7XG5cdFx0aWYgKCF0eXBlcy5pc1VuZGVmaW5lZChzZXR0aW5ncy53b3Jrc3BhY2VGb2xkZXJWYWx1ZSkpIHtcblx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI7XG5cdFx0fSBlbHNlIGlmICghdHlwZXMuaXNVbmRlZmluZWQoc2V0dGluZ3Mud29ya3NwYWNlVmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0U7XG5cdFx0fSBlbHNlIGlmICghdHlwZXMuaXNVbmRlZmluZWQoc2V0dGluZ3MudXNlclJlbW90ZSkpIHtcblx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFO1xuXHRcdH1cblx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUNvbmZpZ3VyYXRpb24oa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHNldHRpbmdzVGFyZ2V0OiBUaGVtZVNldHRpbmdUYXJnZXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoc2V0dGluZ3NUYXJnZXQgPT09IHVuZGVmaW5lZCB8fCBzZXR0aW5nc1RhcmdldCA9PT0gJ3ByZXZpZXcnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Qoa2V5KTtcblx0XHRpZiAoc2V0dGluZ3NUYXJnZXQgPT09ICdhdXRvJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoa2V5LCB2YWx1ZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNldHRpbmdzVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gc2V0dGluZ3MudXNlclZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTsgLy8gbm90aGluZyB0byBkb1xuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gc2V0dGluZ3MuZGVmYXVsdFZhbHVlKSB7XG5cdFx0XHRcdGlmICh0eXBlcy5pc1VuZGVmaW5lZChzZXR0aW5ncy51c2VyVmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpOyAvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHRcdH1cblx0XHRcdFx0dmFsdWUgPSB1bmRlZmluZWQ7IC8vIHJlbW92ZSBjb25maWd1cmF0aW9uIGZyb20gdXNlciBzZXR0aW5nc1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFIHx8IHNldHRpbmdzVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIgfHwgc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUpIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gc2V0dGluZ3MudmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpOyAvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgdmFsdWUsIHNldHRpbmdzVGFyZ2V0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLGdCQUFnQjtBQUN6QixTQUFpQyxjQUFjLHlCQUEyRSwwQkFBMEI7QUFHcEosU0FBUyx3QkFBd0Isa0NBQWtDO0FBQ25FLFNBQVMsK0JBQStCO0FBQ3hDLFNB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
