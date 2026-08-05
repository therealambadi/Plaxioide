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
import * as nls from "../../../../nls.js";
import * as types from "../../../../base/common/types.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IWorkbenchThemeService, ExtensionData, ThemeSettings, ThemeSettingDefaults, COLOR_THEME_DARK_INITIAL_COLORS, COLOR_THEME_LIGHT_INITIAL_COLORS } from "../common/workbenchThemeService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import * as errors from "../../../../base/common/errors.js";
import { IConfigurationService, ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { ColorThemeData } from "../common/colorThemeData.js";
import { Extensions as ThemingExtensions } from "../../../../platform/theme/common/themeService.js";
import { Emitter } from "../../../../base/common/event.js";
import { registerFileIconThemeSchemas } from "../common/fileIconThemeSchema.js";
import { dispose, Disposable } from "../../../../base/common/lifecycle.js";
import { FileIconThemeData, FileIconThemeLoader } from "./fileIconThemeData.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IFileService, FileChangeType } from "../../../../platform/files/common/files.js";
import * as resources from "../../../../base/common/resources.js";
import { registerColorThemeSchemas } from "../common/colorThemeSchema.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { getRemoteAuthority } from "../../../../platform/remote/common/remoteHosts.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { ThemeRegistry, registerColorThemeExtensionPoint, registerFileIconThemeExtensionPoint, registerProductIconThemeExtensionPoint } from "../common/themeExtensionPoints.js";
import { updateColorThemeConfigurationSchemas, updateFileIconThemeConfigurationSchemas, ThemeConfiguration, updateProductIconThemeConfigurationSchemas } from "../common/themeConfiguration.js";
import { ProductIconThemeData, DEFAULT_PRODUCT_ICON_THEME_ID } from "./productIconThemeData.js";
import { registerProductIconThemeSchemas } from "../common/productIconThemeSchema.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { isWeb } from "../../../../base/common/platform.js";
import { ColorScheme, ThemeTypeSelector } from "../../../../platform/theme/common/theme.js";
import { IHostColorSchemeService } from "../common/hostColorSchemeService.js";
import { RunOnceScheduler, Sequencer } from "../../../../base/common/async.js";
import { IUserDataInitializationService } from "../../userData/browser/userDataInit.js";
import { getIconsStyleSheet } from "../../../../platform/theme/browser/iconsStyleSheet.js";
import { asCssVariableName, getColorRegistry } from "../../../../platform/theme/common/colorRegistry.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { mainWindow } from "../../../../base/browser/window.js";
const defaultThemeExtensionId = "vscode-theme-defaults";
const DEFAULT_FILE_ICON_THEME_ID = "vscode.vscode-theme-seti-vs-seti";
const fileIconsEnabledClass = "file-icons-enabled";
const colorThemeRulesClassName = "contributedColorTheme";
const fileIconThemeRulesClassName = "contributedFileIconTheme";
const productIconThemeRulesClassName = "contributedProductIconTheme";
const themingRegistry = Registry.as(ThemingExtensions.ThemingContribution);
function validateThemeId(theme) {
  switch (theme) {
    case ThemeTypeSelector.VS:
      return `vs ${defaultThemeExtensionId}-themes-light_vs-json`;
    case ThemeTypeSelector.VS_DARK:
      return `vs-dark ${defaultThemeExtensionId}-themes-dark_vs-json`;
    case ThemeTypeSelector.HC_BLACK:
      return `hc-black ${defaultThemeExtensionId}-themes-hc_black-json`;
    case ThemeTypeSelector.HC_LIGHT:
      return `hc-light ${defaultThemeExtensionId}-themes-hc_light-json`;
  }
  return theme;
}
const colorThemesExtPoint = registerColorThemeExtensionPoint();
const fileIconThemesExtPoint = registerFileIconThemeExtensionPoint();
const productIconThemesExtPoint = registerProductIconThemeExtensionPoint();
let WorkbenchThemeService = class extends Disposable {
  constructor(extensionService, storageService, configurationService, telemetryService, environmentService, fileService, extensionResourceLoaderService, layoutService, logService, hostColorService, userDataInitializationService, languageService) {
    super();
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.environmentService = environmentService;
    this.extensionResourceLoaderService = extensionResourceLoaderService;
    this.logService = logService;
    this.hostColorService = hostColorService;
    this.userDataInitializationService = userDataInitializationService;
    this.languageService = languageService;
    this.themeExtensionsActivated = /* @__PURE__ */ new Map();
    this.container = layoutService.mainContainer;
    this.settings = new ThemeConfiguration(configurationService, hostColorService);
    this.colorThemeRegistry = this._register(new ThemeRegistry(colorThemesExtPoint, ColorThemeData.fromExtensionTheme));
    this.colorThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentColorTheme.bind(this)));
    this.onColorThemeChange = new Emitter({ leakWarningThreshold: 400 });
    this.currentColorTheme = ColorThemeData.createUnloadedTheme("");
    this.colorThemeSequencer = new Sequencer();
    this.fileIconThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentFileIconTheme.bind(this)));
    this.fileIconThemeRegistry = this._register(new ThemeRegistry(fileIconThemesExtPoint, FileIconThemeData.fromExtensionTheme, true, FileIconThemeData.noIconTheme));
    this.fileIconThemeLoader = new FileIconThemeLoader(extensionResourceLoaderService, languageService);
    this.onFileIconThemeChange = new Emitter({ leakWarningThreshold: 400 });
    this.currentFileIconTheme = FileIconThemeData.createUnloadedTheme("");
    this.fileIconThemeSequencer = new Sequencer();
    this.productIconThemeWatcher = this._register(new ThemeFileWatcher(fileService, environmentService, this.reloadCurrentProductIconTheme.bind(this)));
    this.productIconThemeRegistry = this._register(new ThemeRegistry(productIconThemesExtPoint, ProductIconThemeData.fromExtensionTheme, true, ProductIconThemeData.defaultTheme));
    this.onProductIconThemeChange = new Emitter();
    this.currentProductIconTheme = ProductIconThemeData.createUnloadedTheme("");
    this.productIconThemeSequencer = new Sequencer();
    this._register(this.onDidColorThemeChange((theme) => getColorRegistry().notifyThemeUpdate(theme)));
    let themeData = ColorThemeData.fromStorageData(this.storageService);
    const colorThemeSetting = this.settings.colorTheme;
    if (themeData && colorThemeSetting !== themeData.settingsId) {
      themeData = void 0;
    }
    const defaultColorMap = colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_LIGHT ? COLOR_THEME_LIGHT_INITIAL_COLORS : colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_DARK ? COLOR_THEME_DARK_INITIAL_COLORS : void 0;
    if (!themeData) {
      const initialColorTheme = environmentService.options?.initialColorTheme;
      if (initialColorTheme) {
        themeData = ColorThemeData.createUnloadedThemeForThemeType(initialColorTheme.themeType, initialColorTheme.colors ?? defaultColorMap);
      }
    }
    if (!themeData) {
      const colorScheme = this.settings.getPreferredColorScheme() ?? (isWeb ? ColorScheme.LIGHT : ColorScheme.DARK);
      themeData = ColorThemeData.createUnloadedThemeForThemeType(colorScheme, defaultColorMap);
    }
    themeData.setCustomizations(this.settings);
    this.applyTheme(themeData, void 0, true);
    const fileIconData = FileIconThemeData.fromStorageData(this.storageService);
    if (fileIconData) {
      this.applyAndSetFileIconTheme(fileIconData, true);
    }
    const productIconData = ProductIconThemeData.fromStorageData(this.storageService);
    if (productIconData) {
      this.applyAndSetProductIconTheme(productIconData, true);
    }
    extensionService.whenInstalledExtensionsRegistered().then((_) => {
      this.installConfigurationListener();
      this.installPreferredSchemeListener();
      this.installRegistryListeners();
      this.initialize().catch(errors.onUnexpectedError);
    });
    const codiconStyleSheet = createStyleSheet();
    codiconStyleSheet.id = "codiconStyles";
    const iconsStyleSheet = this._register(getIconsStyleSheet(this));
    function updateAll() {
      codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
    }
    const delayer = this._register(new RunOnceScheduler(updateAll, 0));
    this._register(iconsStyleSheet.onDidChange(() => delayer.schedule()));
    delayer.schedule();
  }
  initialize() {
    const extDevLocs = this.environmentService.extensionDevelopmentLocationURI;
    const extDevLoc = extDevLocs && extDevLocs.length === 1 ? extDevLocs[0] : void 0;
    const initializeColorTheme = async () => {
      const devThemes = this.colorThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        const matchedColorTheme = devThemes.find((theme2) => theme2.type === this.currentColorTheme.type);
        return this.setColorTheme(matchedColorTheme ? matchedColorTheme.id : devThemes[0].id, void 0);
      }
      let theme = this.colorThemeRegistry.findThemeBySettingsId(this.settings.colorTheme, void 0);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        const fallbackTheme = this.currentColorTheme.type === ColorScheme.LIGHT ? ThemeSettingDefaults.COLOR_THEME_LIGHT : ThemeSettingDefaults.COLOR_THEME_DARK;
        theme = this.colorThemeRegistry.findThemeBySettingsId(this.settings.colorTheme, fallbackTheme);
      }
      return this.setColorTheme(theme && theme.id, void 0);
    };
    const initializeFileIconTheme = async () => {
      const devThemes = this.fileIconThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        return this.setFileIconTheme(devThemes[0].id, ConfigurationTarget.MEMORY);
      }
      let theme = this.fileIconThemeRegistry.findThemeBySettingsId(this.settings.fileIconTheme);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        theme = this.fileIconThemeRegistry.findThemeBySettingsId(this.settings.fileIconTheme);
      }
      return this.setFileIconTheme(theme ? theme.id : DEFAULT_FILE_ICON_THEME_ID, void 0);
    };
    const initializeProductIconTheme = async () => {
      const devThemes = this.productIconThemeRegistry.findThemeByExtensionLocation(extDevLoc);
      if (devThemes.length) {
        return this.setProductIconTheme(devThemes[0].id, ConfigurationTarget.MEMORY);
      }
      let theme = this.productIconThemeRegistry.findThemeBySettingsId(this.settings.productIconTheme);
      if (!theme) {
        await this.userDataInitializationService.whenInitializationFinished();
        theme = this.productIconThemeRegistry.findThemeBySettingsId(this.settings.productIconTheme);
      }
      return this.setProductIconTheme(theme ? theme.id : DEFAULT_PRODUCT_ICON_THEME_ID, void 0);
    };
    return Promise.all([initializeColorTheme(), initializeFileIconTheme(), initializeProductIconTheme()]);
  }
  installConfigurationListener() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ThemeSettings.COLOR_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_DARK_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_LIGHT_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_HC_DARK_THEME) || e.affectsConfiguration(ThemeSettings.PREFERRED_HC_LIGHT_THEME) || e.affectsConfiguration(ThemeSettings.DETECT_COLOR_SCHEME) || e.affectsConfiguration(ThemeSettings.DETECT_HC) || e.affectsConfiguration(ThemeSettings.SYSTEM_COLOR_THEME)) {
        this.restoreColorTheme();
      }
      if (e.affectsConfiguration(ThemeSettings.FILE_ICON_THEME)) {
        this.restoreFileIconTheme();
      }
      if (e.affectsConfiguration(ThemeSettings.PRODUCT_ICON_THEME)) {
        this.restoreProductIconTheme();
      }
      if (this.currentColorTheme) {
        let hasColorChanges = false;
        if (e.affectsConfiguration(ThemeSettings.COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomColors(this.settings.colorCustomizations);
          hasColorChanges = true;
        }
        if (e.affectsConfiguration(ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomTokenColors(this.settings.tokenColorCustomizations);
          hasColorChanges = true;
        }
        if (e.affectsConfiguration(ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS)) {
          this.currentColorTheme.setCustomSemanticTokenColors(this.settings.semanticTokenColorCustomizations);
          hasColorChanges = true;
        }
        if (hasColorChanges) {
          this.updateDynamicCSSRules(this.currentColorTheme);
          this.onColorThemeChange.fire(this.currentColorTheme);
        }
      }
    }));
  }
  installRegistryListeners() {
    let prevColorId = void 0;
    this._register(this.colorThemeRegistry.onDidChange(async (event) => {
      updateColorThemeConfigurationSchemas(event.themes);
      if (await this.restoreColorTheme()) {
        if (this.currentColorTheme.settingsId === ThemeSettingDefaults.COLOR_THEME_DARK && !types.isUndefined(prevColorId) && await this.colorThemeRegistry.findThemeById(prevColorId)) {
          await this.setColorTheme(prevColorId, "auto");
          prevColorId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentColorTheme.settingsId)) {
          await this.reloadCurrentColorTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentColorTheme.settingsId)) {
        prevColorId = this.currentColorTheme.id;
        const defaultTheme = this.colorThemeRegistry.findThemeBySettingsId(ThemeSettingDefaults.COLOR_THEME_DARK);
        await this.setColorTheme(defaultTheme, "auto");
      }
    }));
    let prevFileIconId = void 0;
    this._register(this._register(this.fileIconThemeRegistry.onDidChange(async (event) => {
      updateFileIconThemeConfigurationSchemas(event.themes);
      if (await this.restoreFileIconTheme()) {
        if (this.currentFileIconTheme.id === DEFAULT_FILE_ICON_THEME_ID && !types.isUndefined(prevFileIconId) && this.fileIconThemeRegistry.findThemeById(prevFileIconId)) {
          await this.setFileIconTheme(prevFileIconId, "auto");
          prevFileIconId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentFileIconTheme.settingsId)) {
          await this.reloadCurrentFileIconTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentFileIconTheme.settingsId)) {
        prevFileIconId = this.currentFileIconTheme.id;
        await this.setFileIconTheme(DEFAULT_FILE_ICON_THEME_ID, "auto");
      }
    })));
    let prevProductIconId = void 0;
    this._register(this.productIconThemeRegistry.onDidChange(async (event) => {
      updateProductIconThemeConfigurationSchemas(event.themes);
      if (await this.restoreProductIconTheme()) {
        if (this.currentProductIconTheme.id === DEFAULT_PRODUCT_ICON_THEME_ID && !types.isUndefined(prevProductIconId) && this.productIconThemeRegistry.findThemeById(prevProductIconId)) {
          await this.setProductIconTheme(prevProductIconId, "auto");
          prevProductIconId = void 0;
        } else if (event.added.some((t) => t.settingsId === this.currentProductIconTheme.settingsId)) {
          await this.reloadCurrentProductIconTheme();
        }
      } else if (event.removed.some((t) => t.settingsId === this.currentProductIconTheme.settingsId)) {
        prevProductIconId = this.currentProductIconTheme.id;
        await this.setProductIconTheme(DEFAULT_PRODUCT_ICON_THEME_ID, "auto");
      }
    }));
    this._register(this.languageService.onDidChange(() => this.reloadCurrentFileIconTheme()));
    return Promise.all([this.getColorThemes(), this.getFileIconThemes(), this.getProductIconThemes()]).then(([ct, fit, pit]) => {
      updateColorThemeConfigurationSchemas(ct);
      updateFileIconThemeConfigurationSchemas(fit);
      updateProductIconThemeConfigurationSchemas(pit);
    });
  }
  // preferred scheme handling
  installPreferredSchemeListener() {
    this._register(this.hostColorService.onDidChangeColorScheme(() => {
      if (this.settings.isDetectingColorScheme()) {
        this.restoreColorTheme();
      }
    }));
  }
  getColorTheme() {
    return this.currentColorTheme;
  }
  async getColorThemes() {
    return this.colorThemeRegistry.getThemes();
  }
  getPreferredColorScheme() {
    return this.settings.getPreferredColorScheme();
  }
  async getMarketplaceColorThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.colorThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  get onDidColorThemeChange() {
    return this.onColorThemeChange.event;
  }
  setColorTheme(themeIdOrTheme, settingsTarget) {
    return this.colorThemeSequencer.queue(async () => {
      return this.internalSetColorTheme(themeIdOrTheme, settingsTarget);
    });
  }
  async internalSetColorTheme(themeIdOrTheme, settingsTarget) {
    if (!themeIdOrTheme) {
      return null;
    }
    const themeId = types.isString(themeIdOrTheme) ? validateThemeId(themeIdOrTheme) : themeIdOrTheme.id;
    if (this.currentColorTheme.isLoaded && themeId === this.currentColorTheme.id) {
      if (settingsTarget !== "preview") {
        this.currentColorTheme.toStorage(this.storageService);
      }
      return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
    }
    let themeData = this.colorThemeRegistry.findThemeById(themeId);
    if (!themeData) {
      if (themeIdOrTheme instanceof ColorThemeData) {
        themeData = themeIdOrTheme;
      } else {
        return null;
      }
    }
    try {
      await themeData.ensureLoaded(this.extensionResourceLoaderService);
      themeData.setCustomizations(this.settings);
      return this.applyTheme(themeData, settingsTarget);
    } catch (error) {
      throw new Error(nls.localize("error.cannotloadtheme", "Unable to load {0}: {1}", themeData.location?.toString(), error.message));
    }
  }
  reloadCurrentColorTheme() {
    return this.colorThemeSequencer.queue(async () => {
      try {
        const theme = this.colorThemeRegistry.findThemeBySettingsId(this.currentColorTheme.settingsId) || this.currentColorTheme;
        await theme.reload(this.extensionResourceLoaderService);
        theme.setCustomizations(this.settings);
        await this.applyTheme(theme, void 0, false);
      } catch (error) {
        this.logService.info("Unable to reload {0}: {1}", this.currentColorTheme.location?.toString());
      }
    });
  }
  async restoreColorTheme() {
    return this.colorThemeSequencer.queue(async () => {
      const settingId = this.settings.colorTheme;
      const theme = this.colorThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentColorTheme.settingsId) {
          await this.internalSetColorTheme(theme.id, void 0);
        } else if (theme !== this.currentColorTheme) {
          await theme.ensureLoaded(this.extensionResourceLoaderService);
          theme.setCustomizations(this.settings);
          await this.applyTheme(theme, void 0, true);
        }
        return true;
      }
      return false;
    });
  }
  updateDynamicCSSRules(themeData) {
    const cssRules = /* @__PURE__ */ new Set();
    const ruleCollector = {
      addRule: (rule) => {
        if (!cssRules.has(rule)) {
          cssRules.add(rule);
        }
      }
    };
    ruleCollector.addRule(`.monaco-workbench { forced-color-adjust: none; }`);
    themingRegistry.getThemingParticipants().forEach((p) => p(themeData, ruleCollector, this.environmentService));
    const colorVariables = [];
    for (const item of getColorRegistry().getColors()) {
      const color = themeData.getColor(item.id, true);
      if (color) {
        colorVariables.push(`${asCssVariableName(item.id)}: ${color.toString()};`);
      }
    }
    ruleCollector.addRule(`.monaco-workbench { ${colorVariables.join("\n")} }`);
    _applyRules([...cssRules].join("\n"), colorThemeRulesClassName);
  }
  applyTheme(newTheme, settingsTarget, silent = false) {
    this.updateDynamicCSSRules(newTheme);
    if (this.currentColorTheme.id) {
      this.container.classList.remove(...this.currentColorTheme.classNames);
    } else {
      this.container.classList.remove(ThemeTypeSelector.VS, ThemeTypeSelector.VS_DARK, ThemeTypeSelector.HC_BLACK, ThemeTypeSelector.HC_LIGHT);
    }
    this.container.classList.add(...newTheme.classNames);
    this.currentColorTheme.clearCaches();
    this.currentColorTheme = newTheme;
    if (!this.colorThemingParticipantChangeListener) {
      this.colorThemingParticipantChangeListener = themingRegistry.onThemingParticipantAdded((_) => this.updateDynamicCSSRules(this.currentColorTheme));
    }
    this.colorThemeWatcher.update(newTheme);
    this.sendTelemetry(newTheme.id, newTheme.extensionData, "color");
    if (silent) {
      return Promise.resolve(null);
    }
    this.onColorThemeChange.fire(this.currentColorTheme);
    if (newTheme.isLoaded && settingsTarget !== "preview") {
      newTheme.toStorage(this.storageService);
    }
    return this.settings.setColorTheme(this.currentColorTheme, settingsTarget);
  }
  sendTelemetry(themeId, themeData, themeType) {
    if (themeData) {
      const key = themeType + themeData.extensionId;
      if (!this.themeExtensionsActivated.get(key)) {
        this.telemetryService.publicLog2("activatePlugin", {
          id: themeData.extensionId,
          name: themeData.extensionName,
          isBuiltin: themeData.extensionIsBuiltin,
          publisherDisplayName: themeData.extensionPublisher,
          themeId
        });
        this.themeExtensionsActivated.set(key, true);
      }
    }
  }
  async getFileIconThemes() {
    return this.fileIconThemeRegistry.getThemes();
  }
  getFileIconTheme() {
    return this.currentFileIconTheme;
  }
  get onDidFileIconThemeChange() {
    return this.onFileIconThemeChange.event;
  }
  async setFileIconTheme(iconThemeOrId, settingsTarget) {
    return this.fileIconThemeSequencer.queue(async () => {
      return this.internalSetFileIconTheme(iconThemeOrId, settingsTarget);
    });
  }
  async internalSetFileIconTheme(iconThemeOrId, settingsTarget) {
    if (iconThemeOrId === void 0) {
      iconThemeOrId = "";
    }
    const themeId = types.isString(iconThemeOrId) ? iconThemeOrId : iconThemeOrId.id;
    if (themeId !== this.currentFileIconTheme.id || !this.currentFileIconTheme.isLoaded) {
      let newThemeData = this.fileIconThemeRegistry.findThemeById(themeId);
      if (!newThemeData && iconThemeOrId instanceof FileIconThemeData) {
        newThemeData = iconThemeOrId;
      }
      if (!newThemeData) {
        newThemeData = FileIconThemeData.noIconTheme;
      }
      await newThemeData.ensureLoaded(this.fileIconThemeLoader);
      this.applyAndSetFileIconTheme(newThemeData);
    }
    const themeData = this.currentFileIconTheme;
    if (themeData.isLoaded && settingsTarget !== "preview" && (!themeData.location || !getRemoteAuthority(themeData.location))) {
      themeData.toStorage(this.storageService);
    }
    await this.settings.setFileIconTheme(this.currentFileIconTheme, settingsTarget);
    return themeData;
  }
  async getMarketplaceFileIconThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.fileIconThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  async reloadCurrentFileIconTheme() {
    return this.fileIconThemeSequencer.queue(async () => {
      await this.currentFileIconTheme.reload(this.fileIconThemeLoader);
      this.applyAndSetFileIconTheme(this.currentFileIconTheme);
    });
  }
  async restoreFileIconTheme() {
    return this.fileIconThemeSequencer.queue(async () => {
      const settingId = this.settings.fileIconTheme;
      const theme = this.fileIconThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentFileIconTheme.settingsId) {
          await this.internalSetFileIconTheme(theme.id, void 0);
        } else if (theme !== this.currentFileIconTheme) {
          await theme.ensureLoaded(this.fileIconThemeLoader);
          this.applyAndSetFileIconTheme(theme, true);
        }
        return true;
      }
      return false;
    });
  }
  applyAndSetFileIconTheme(iconThemeData, silent = false) {
    this.currentFileIconTheme = iconThemeData;
    _applyRules(iconThemeData.styleSheetContent, fileIconThemeRulesClassName);
    if (iconThemeData.id) {
      this.container.classList.add(fileIconsEnabledClass);
    } else {
      this.container.classList.remove(fileIconsEnabledClass);
    }
    this.fileIconThemeWatcher.update(iconThemeData);
    if (iconThemeData.id) {
      this.sendTelemetry(iconThemeData.id, iconThemeData.extensionData, "fileIcon");
    }
    if (!silent) {
      this.onFileIconThemeChange.fire(this.currentFileIconTheme);
    }
  }
  async getProductIconThemes() {
    return this.productIconThemeRegistry.getThemes();
  }
  getProductIconTheme() {
    return this.currentProductIconTheme;
  }
  get onDidProductIconThemeChange() {
    return this.onProductIconThemeChange.event;
  }
  async setProductIconTheme(iconThemeOrId, settingsTarget) {
    return this.productIconThemeSequencer.queue(async () => {
      return this.internalSetProductIconTheme(iconThemeOrId, settingsTarget);
    });
  }
  async internalSetProductIconTheme(iconThemeOrId, settingsTarget) {
    if (iconThemeOrId === void 0) {
      iconThemeOrId = "";
    }
    const themeId = types.isString(iconThemeOrId) ? iconThemeOrId : iconThemeOrId.id;
    if (themeId !== this.currentProductIconTheme.id || !this.currentProductIconTheme.isLoaded) {
      let newThemeData = this.productIconThemeRegistry.findThemeById(themeId);
      if (!newThemeData && iconThemeOrId instanceof ProductIconThemeData) {
        newThemeData = iconThemeOrId;
      }
      if (!newThemeData) {
        newThemeData = ProductIconThemeData.defaultTheme;
      }
      await newThemeData.ensureLoaded(this.extensionResourceLoaderService, this.logService);
      this.applyAndSetProductIconTheme(newThemeData);
    }
    const themeData = this.currentProductIconTheme;
    if (themeData.isLoaded && settingsTarget !== "preview" && (!themeData.location || !getRemoteAuthority(themeData.location))) {
      themeData.toStorage(this.storageService);
    }
    await this.settings.setProductIconTheme(this.currentProductIconTheme, settingsTarget);
    return themeData;
  }
  async getMarketplaceProductIconThemes(publisher, name, version) {
    const extensionLocation = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({ publisher, name, version }, "extension");
    if (extensionLocation) {
      try {
        const manifestContent = await this.extensionResourceLoaderService.readExtensionResource(resources.joinPath(extensionLocation, "package.json"));
        return this.productIconThemeRegistry.getMarketplaceThemes(JSON.parse(manifestContent), extensionLocation, ExtensionData.fromName(publisher, name));
      } catch (e) {
        this.logService.error("Problem loading themes from marketplace", e);
      }
    }
    return [];
  }
  async reloadCurrentProductIconTheme() {
    return this.productIconThemeSequencer.queue(async () => {
      await this.currentProductIconTheme.reload(this.extensionResourceLoaderService, this.logService);
      this.applyAndSetProductIconTheme(this.currentProductIconTheme);
    });
  }
  async restoreProductIconTheme() {
    return this.productIconThemeSequencer.queue(async () => {
      const settingId = this.settings.productIconTheme;
      const theme = this.productIconThemeRegistry.findThemeBySettingsId(settingId);
      if (theme) {
        if (settingId !== this.currentProductIconTheme.settingsId) {
          await this.internalSetProductIconTheme(theme.id, void 0);
        } else if (theme !== this.currentProductIconTheme) {
          await theme.ensureLoaded(this.extensionResourceLoaderService, this.logService);
          this.applyAndSetProductIconTheme(theme, true);
        }
        return true;
      }
      return false;
    });
  }
  applyAndSetProductIconTheme(iconThemeData, silent = false) {
    this.currentProductIconTheme = iconThemeData;
    _applyRules(iconThemeData.styleSheetContent, productIconThemeRulesClassName);
    this.productIconThemeWatcher.update(iconThemeData);
    if (iconThemeData.id) {
      this.sendTelemetry(iconThemeData.id, iconThemeData.extensionData, "productIcon");
    }
    if (!silent) {
      this.onProductIconThemeChange.fire(this.currentProductIconTheme);
    }
  }
};
WorkbenchThemeService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IBrowserWorkbenchEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IExtensionResourceLoaderService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IHostColorSchemeService),
  __decorateParam(10, IUserDataInitializationService),
  __decorateParam(11, ILanguageService)
], WorkbenchThemeService);
class ThemeFileWatcher {
  constructor(fileService, environmentService, onUpdate) {
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.onUpdate = onUpdate;
  }
  update(theme) {
    if (!resources.isEqual(theme.location, this.watchedLocation)) {
      this.dispose();
      if (theme.location && (theme.watch || this.environmentService.isExtensionDevelopment)) {
        this.watchedLocation = theme.location;
        this.watcherDisposable = this.fileService.watch(theme.location);
        this.fileService.onDidFilesChange((e) => {
          if (this.watchedLocation && e.contains(this.watchedLocation, FileChangeType.UPDATED)) {
            this.onUpdate();
          }
        });
      }
    }
  }
  dispose() {
    this.watcherDisposable = dispose(this.watcherDisposable);
    this.fileChangeListener = dispose(this.fileChangeListener);
    this.watchedLocation = void 0;
  }
}
function _applyRules(styleSheetContent, rulesClassName) {
  const themeStyles = mainWindow.document.head.getElementsByClassName(rulesClassName);
  if (themeStyles.length === 0) {
    const elStyle = createStyleSheet();
    elStyle.className = rulesClassName;
    elStyle.textContent = styleSheetContent;
  } else {
    themeStyles[0].textContent = styleSheetContent;
  }
}
registerColorThemeSchemas();
registerFileIconThemeSchemas();
registerProductIconThemeSchemas();
registerSingleton(IWorkbenchThemeService, WorkbenchThemeService, InstantiationType.Eager);
export {
  WorkbenchThemeService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2Jyb3dzZXIvd29ya2JlbmNoVGhlbWVTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaFRoZW1lU2VydmljZSwgSVdvcmtiZW5jaENvbG9yVGhlbWUsIElXb3JrYmVuY2hGaWxlSWNvblRoZW1lLCBFeHRlbnNpb25EYXRhLCBUaGVtZVNldHRpbmdzLCBJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZSwgVGhlbWVTZXR0aW5nVGFyZ2V0LCBUaGVtZVNldHRpbmdEZWZhdWx0cywgQ09MT1JfVEhFTUVfREFSS19JTklUSUFMX0NPTE9SUywgQ09MT1JfVEhFTUVfTElHSFRfSU5JVElBTF9DT0xPUlMgfSBmcm9tICcuLi9jb21tb24vd29ya2JlbmNoVGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBlcnJvcnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSwgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29sb3JUaGVtZURhdGEgfSBmcm9tICcuLi9jb21tb24vY29sb3JUaGVtZURhdGEuanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUsIEV4dGVuc2lvbnMgYXMgVGhlbWluZ0V4dGVuc2lvbnMsIElUaGVtaW5nUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJGaWxlSWNvblRoZW1lU2NoZW1hcyB9IGZyb20gJy4uL2NvbW1vbi9maWxlSWNvblRoZW1lU2NoZW1hLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEZpbGVJY29uVGhlbWVEYXRhLCBGaWxlSWNvblRoZW1lTG9hZGVyIH0gZnJvbSAnLi9maWxlSWNvblRoZW1lRGF0YS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlLCBGaWxlQ2hhbmdlVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbG9yVGhlbWVTY2hlbWFzIH0gZnJvbSAnLi4vY29tbW9uL2NvbG9yVGhlbWVTY2hlbWEuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBnZXRSZW1vdGVBdXRob3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIvY29tbW9uL2V4dGVuc2lvblJlc291cmNlTG9hZGVyLmpzJztcbmltcG9ydCB7IFRoZW1lUmVnaXN0cnksIHJlZ2lzdGVyQ29sb3JUaGVtZUV4dGVuc2lvblBvaW50LCByZWdpc3RlckZpbGVJY29uVGhlbWVFeHRlbnNpb25Qb2ludCwgcmVnaXN0ZXJQcm9kdWN0SWNvblRoZW1lRXh0ZW5zaW9uUG9pbnQgfSBmcm9tICcuLi9jb21tb24vdGhlbWVFeHRlbnNpb25Qb2ludHMuanMnO1xuaW1wb3J0IHsgdXBkYXRlQ29sb3JUaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzLCB1cGRhdGVGaWxlSWNvblRoZW1lQ29uZmlndXJhdGlvblNjaGVtYXMsIFRoZW1lQ29uZmlndXJhdGlvbiwgdXBkYXRlUHJvZHVjdEljb25UaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzIH0gZnJvbSAnLi4vY29tbW9uL3RoZW1lQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQcm9kdWN0SWNvblRoZW1lRGF0YSwgREVGQVVMVF9QUk9EVUNUX0lDT05fVEhFTUVfSUQgfSBmcm9tICcuL3Byb2R1Y3RJY29uVGhlbWVEYXRhLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyUHJvZHVjdEljb25UaGVtZVNjaGVtYXMgfSBmcm9tICcuLi9jb21tb24vcHJvZHVjdEljb25UaGVtZVNjaGVtYS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUsIFRoZW1lVHlwZVNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElIb3N0Q29sb3JTY2hlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2hvc3RDb2xvclNjaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciwgU2VxdWVuY2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGEvYnJvd3Nlci91c2VyRGF0YUluaXQuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbnNTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9pY29uc1N0eWxlU2hlZXQuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZU5hbWUsIGdldENvbG9yUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuXG4vLyBpbXBsZW1lbnRhdGlvblxuXG5jb25zdCBkZWZhdWx0VGhlbWVFeHRlbnNpb25JZCA9ICd2c2NvZGUtdGhlbWUtZGVmYXVsdHMnO1xuXG5jb25zdCBERUZBVUxUX0ZJTEVfSUNPTl9USEVNRV9JRCA9ICd2c2NvZGUudnNjb2RlLXRoZW1lLXNldGktdnMtc2V0aSc7XG5jb25zdCBmaWxlSWNvbnNFbmFibGVkQ2xhc3MgPSAnZmlsZS1pY29ucy1lbmFibGVkJztcblxuY29uc3QgY29sb3JUaGVtZVJ1bGVzQ2xhc3NOYW1lID0gJ2NvbnRyaWJ1dGVkQ29sb3JUaGVtZSc7XG5jb25zdCBmaWxlSWNvblRoZW1lUnVsZXNDbGFzc05hbWUgPSAnY29udHJpYnV0ZWRGaWxlSWNvblRoZW1lJztcbmNvbnN0IHByb2R1Y3RJY29uVGhlbWVSdWxlc0NsYXNzTmFtZSA9ICdjb250cmlidXRlZFByb2R1Y3RJY29uVGhlbWUnO1xuXG5jb25zdCB0aGVtaW5nUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVGhlbWluZ1JlZ2lzdHJ5PihUaGVtaW5nRXh0ZW5zaW9ucy5UaGVtaW5nQ29udHJpYnV0aW9uKTtcblxuZnVuY3Rpb24gdmFsaWRhdGVUaGVtZUlkKHRoZW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHQvLyBtaWdyYXRpb25zXG5cdHN3aXRjaCAodGhlbWUpIHtcblx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLlZTOiByZXR1cm4gYHZzICR7ZGVmYXVsdFRoZW1lRXh0ZW5zaW9uSWR9LXRoZW1lcy1saWdodF92cy1qc29uYDtcblx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLlZTX0RBUks6IHJldHVybiBgdnMtZGFyayAke2RlZmF1bHRUaGVtZUV4dGVuc2lvbklkfS10aGVtZXMtZGFya192cy1qc29uYDtcblx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLkhDX0JMQUNLOiByZXR1cm4gYGhjLWJsYWNrICR7ZGVmYXVsdFRoZW1lRXh0ZW5zaW9uSWR9LXRoZW1lcy1oY19ibGFjay1qc29uYDtcblx0XHRjYXNlIFRoZW1lVHlwZVNlbGVjdG9yLkhDX0xJR0hUOiByZXR1cm4gYGhjLWxpZ2h0ICR7ZGVmYXVsdFRoZW1lRXh0ZW5zaW9uSWR9LXRoZW1lcy1oY19saWdodC1qc29uYDtcblx0fVxuXHRyZXR1cm4gdGhlbWU7XG59XG5cbmNvbnN0IGNvbG9yVGhlbWVzRXh0UG9pbnQgPSByZWdpc3RlckNvbG9yVGhlbWVFeHRlbnNpb25Qb2ludCgpO1xuY29uc3QgZmlsZUljb25UaGVtZXNFeHRQb2ludCA9IHJlZ2lzdGVyRmlsZUljb25UaGVtZUV4dGVuc2lvblBvaW50KCk7XG5jb25zdCBwcm9kdWN0SWNvblRoZW1lc0V4dFBvaW50ID0gcmVnaXN0ZXJQcm9kdWN0SWNvblRoZW1lRXh0ZW5zaW9uUG9pbnQoKTtcblxuZXhwb3J0IGNsYXNzIFdvcmtiZW5jaFRoZW1lU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNldHRpbmdzOiBUaGVtZUNvbmZpZ3VyYXRpb247XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb2xvclRoZW1lUmVnaXN0cnk6IFRoZW1lUmVnaXN0cnk8Q29sb3JUaGVtZURhdGE+O1xuXHRwcml2YXRlIGN1cnJlbnRDb2xvclRoZW1lOiBDb2xvclRoZW1lRGF0YTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkNvbG9yVGhlbWVDaGFuZ2U6IEVtaXR0ZXI8SVdvcmtiZW5jaENvbG9yVGhlbWU+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbG9yVGhlbWVXYXRjaGVyOiBUaGVtZUZpbGVXYXRjaGVyO1xuXHRwcml2YXRlIGNvbG9yVGhlbWluZ1BhcnRpY2lwYW50Q2hhbmdlTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbG9yVGhlbWVTZXF1ZW5jZXI6IFNlcXVlbmNlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGZpbGVJY29uVGhlbWVSZWdpc3RyeTogVGhlbWVSZWdpc3RyeTxGaWxlSWNvblRoZW1lRGF0YT47XG5cdHByaXZhdGUgY3VycmVudEZpbGVJY29uVGhlbWU6IEZpbGVJY29uVGhlbWVEYXRhO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRmlsZUljb25UaGVtZUNoYW5nZTogRW1pdHRlcjxJV29ya2JlbmNoRmlsZUljb25UaGVtZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZUljb25UaGVtZUxvYWRlcjogRmlsZUljb25UaGVtZUxvYWRlcjtcblx0cHJpdmF0ZSByZWFkb25seSBmaWxlSWNvblRoZW1lV2F0Y2hlcjogVGhlbWVGaWxlV2F0Y2hlcjtcblx0cHJpdmF0ZSByZWFkb25seSBmaWxlSWNvblRoZW1lU2VxdWVuY2VyOiBTZXF1ZW5jZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwcm9kdWN0SWNvblRoZW1lUmVnaXN0cnk6IFRoZW1lUmVnaXN0cnk8UHJvZHVjdEljb25UaGVtZURhdGE+O1xuXHRwcml2YXRlIGN1cnJlbnRQcm9kdWN0SWNvblRoZW1lOiBQcm9kdWN0SWNvblRoZW1lRGF0YTtcblx0cHJpdmF0ZSByZWFkb25seSBvblByb2R1Y3RJY29uVGhlbWVDaGFuZ2U6IEVtaXR0ZXI8SVdvcmtiZW5jaFByb2R1Y3RJY29uVGhlbWU+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RJY29uVGhlbWVXYXRjaGVyOiBUaGVtZUZpbGVXYXRjaGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RJY29uVGhlbWVTZXF1ZW5jZXI6IFNlcXVlbmNlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2U6IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJSG9zdENvbG9yU2NoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RDb2xvclNlcnZpY2U6IElIb3N0Q29sb3JTY2hlbWVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YUluaXRpYWxpemF0aW9uU2VydmljZTogSVVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5jb250YWluZXIgPSBsYXlvdXRTZXJ2aWNlLm1haW5Db250YWluZXI7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IG5ldyBUaGVtZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvblNlcnZpY2UsIGhvc3RDb2xvclNlcnZpY2UpO1xuXG5cdFx0dGhpcy5jb2xvclRoZW1lUmVnaXN0cnkgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhlbWVSZWdpc3RyeShjb2xvclRoZW1lc0V4dFBvaW50LCBDb2xvclRoZW1lRGF0YS5mcm9tRXh0ZW5zaW9uVGhlbWUpKTtcblx0XHR0aGlzLmNvbG9yVGhlbWVXYXRjaGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRoZW1lRmlsZVdhdGNoZXIoZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgdGhpcy5yZWxvYWRDdXJyZW50Q29sb3JUaGVtZS5iaW5kKHRoaXMpKSk7XG5cdFx0dGhpcy5vbkNvbG9yVGhlbWVDaGFuZ2UgPSBuZXcgRW1pdHRlcjxJV29ya2JlbmNoQ29sb3JUaGVtZT4oeyBsZWFrV2FybmluZ1RocmVzaG9sZDogNDAwIH0pO1xuXHRcdHRoaXMuY3VycmVudENvbG9yVGhlbWUgPSBDb2xvclRoZW1lRGF0YS5jcmVhdGVVbmxvYWRlZFRoZW1lKCcnKTtcblx0XHR0aGlzLmNvbG9yVGhlbWVTZXF1ZW5jZXIgPSBuZXcgU2VxdWVuY2VyKCk7XG5cblx0XHR0aGlzLmZpbGVJY29uVGhlbWVXYXRjaGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRoZW1lRmlsZVdhdGNoZXIoZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgdGhpcy5yZWxvYWRDdXJyZW50RmlsZUljb25UaGVtZS5iaW5kKHRoaXMpKSk7XG5cdFx0dGhpcy5maWxlSWNvblRoZW1lUmVnaXN0cnkgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhlbWVSZWdpc3RyeShmaWxlSWNvblRoZW1lc0V4dFBvaW50LCBGaWxlSWNvblRoZW1lRGF0YS5mcm9tRXh0ZW5zaW9uVGhlbWUsIHRydWUsIEZpbGVJY29uVGhlbWVEYXRhLm5vSWNvblRoZW1lKSk7XG5cdFx0dGhpcy5maWxlSWNvblRoZW1lTG9hZGVyID0gbmV3IEZpbGVJY29uVGhlbWVMb2FkZXIoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UpO1xuXHRcdHRoaXMub25GaWxlSWNvblRoZW1lQ2hhbmdlID0gbmV3IEVtaXR0ZXI8SVdvcmtiZW5jaEZpbGVJY29uVGhlbWU+KHsgbGVha1dhcm5pbmdUaHJlc2hvbGQ6IDQwMCB9KTtcblx0XHR0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lID0gRmlsZUljb25UaGVtZURhdGEuY3JlYXRlVW5sb2FkZWRUaGVtZSgnJyk7XG5cdFx0dGhpcy5maWxlSWNvblRoZW1lU2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXG5cdFx0dGhpcy5wcm9kdWN0SWNvblRoZW1lV2F0Y2hlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaGVtZUZpbGVXYXRjaGVyKGZpbGVTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIHRoaXMucmVsb2FkQ3VycmVudFByb2R1Y3RJY29uVGhlbWUuYmluZCh0aGlzKSkpO1xuXHRcdHRoaXMucHJvZHVjdEljb25UaGVtZVJlZ2lzdHJ5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRoZW1lUmVnaXN0cnkocHJvZHVjdEljb25UaGVtZXNFeHRQb2ludCwgUHJvZHVjdEljb25UaGVtZURhdGEuZnJvbUV4dGVuc2lvblRoZW1lLCB0cnVlLCBQcm9kdWN0SWNvblRoZW1lRGF0YS5kZWZhdWx0VGhlbWUpKTtcblx0XHR0aGlzLm9uUHJvZHVjdEljb25UaGVtZUNoYW5nZSA9IG5ldyBFbWl0dGVyPElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lPigpO1xuXHRcdHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUgPSBQcm9kdWN0SWNvblRoZW1lRGF0YS5jcmVhdGVVbmxvYWRlZFRoZW1lKCcnKTtcblx0XHR0aGlzLnByb2R1Y3RJY29uVGhlbWVTZXF1ZW5jZXIgPSBuZXcgU2VxdWVuY2VyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSh0aGVtZSA9PiBnZXRDb2xvclJlZ2lzdHJ5KCkubm90aWZ5VGhlbWVVcGRhdGUodGhlbWUpKSk7XG5cblx0XHQvLyBJbiBvcmRlciB0byBhdm9pZCBwYWludCBmbGFzaGluZyBmb3IgdG9rZW5zLCBiZWNhdXNlXG5cdFx0Ly8gdGhlbWVzIGFyZSBsb2FkZWQgYXN5bmNocm9ub3VzbHksIHdlIG5lZWQgdG8gaW5pdGlhbGl6ZVxuXHRcdC8vIGEgY29sb3IgdGhlbWUgZG9jdW1lbnQgd2l0aCBnb29kIGRlZmF1bHRzIHVudGlsIHRoZSB0aGVtZSBpcyBsb2FkZWRcblx0XHRsZXQgdGhlbWVEYXRhOiBDb2xvclRoZW1lRGF0YSB8IHVuZGVmaW5lZCA9IENvbG9yVGhlbWVEYXRhLmZyb21TdG9yYWdlRGF0YSh0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCBjb2xvclRoZW1lU2V0dGluZyA9IHRoaXMuc2V0dGluZ3MuY29sb3JUaGVtZTtcblx0XHRpZiAodGhlbWVEYXRhICYmIGNvbG9yVGhlbWVTZXR0aW5nICE9PSB0aGVtZURhdGEuc2V0dGluZ3NJZCkge1xuXHRcdFx0dGhlbWVEYXRhID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmF1bHRDb2xvck1hcCA9IGNvbG9yVGhlbWVTZXR0aW5nID09PSBUaGVtZVNldHRpbmdEZWZhdWx0cy5DT0xPUl9USEVNRV9MSUdIVCA/IENPTE9SX1RIRU1FX0xJR0hUX0lOSVRJQUxfQ09MT1JTIDogY29sb3JUaGVtZVNldHRpbmcgPT09IFRoZW1lU2V0dGluZ0RlZmF1bHRzLkNPTE9SX1RIRU1FX0RBUksgPyBDT0xPUl9USEVNRV9EQVJLX0lOSVRJQUxfQ09MT1JTIDogdW5kZWZpbmVkO1xuXHRcdGlmICghdGhlbWVEYXRhKSB7XG5cdFx0XHRjb25zdCBpbml0aWFsQ29sb3JUaGVtZSA9IGVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5pbml0aWFsQ29sb3JUaGVtZTtcblx0XHRcdGlmIChpbml0aWFsQ29sb3JUaGVtZSkge1xuXHRcdFx0XHR0aGVtZURhdGEgPSBDb2xvclRoZW1lRGF0YS5jcmVhdGVVbmxvYWRlZFRoZW1lRm9yVGhlbWVUeXBlKGluaXRpYWxDb2xvclRoZW1lLnRoZW1lVHlwZSwgaW5pdGlhbENvbG9yVGhlbWUuY29sb3JzID8/IGRlZmF1bHRDb2xvck1hcCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghdGhlbWVEYXRhKSB7XG5cdFx0XHRjb25zdCBjb2xvclNjaGVtZSA9IHRoaXMuc2V0dGluZ3MuZ2V0UHJlZmVycmVkQ29sb3JTY2hlbWUoKSA/PyAoaXNXZWIgPyBDb2xvclNjaGVtZS5MSUdIVCA6IENvbG9yU2NoZW1lLkRBUkspO1xuXHRcdFx0dGhlbWVEYXRhID0gQ29sb3JUaGVtZURhdGEuY3JlYXRlVW5sb2FkZWRUaGVtZUZvclRoZW1lVHlwZShjb2xvclNjaGVtZSwgZGVmYXVsdENvbG9yTWFwKTtcblx0XHR9XG5cdFx0dGhlbWVEYXRhLnNldEN1c3RvbWl6YXRpb25zKHRoaXMuc2V0dGluZ3MpO1xuXHRcdHRoaXMuYXBwbHlUaGVtZSh0aGVtZURhdGEsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRjb25zdCBmaWxlSWNvbkRhdGEgPSBGaWxlSWNvblRoZW1lRGF0YS5mcm9tU3RvcmFnZURhdGEodGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0aWYgKGZpbGVJY29uRGF0YSkge1xuXHRcdFx0dGhpcy5hcHBseUFuZFNldEZpbGVJY29uVGhlbWUoZmlsZUljb25EYXRhLCB0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9kdWN0SWNvbkRhdGEgPSBQcm9kdWN0SWNvblRoZW1lRGF0YS5mcm9tU3RvcmFnZURhdGEodGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0aWYgKHByb2R1Y3RJY29uRGF0YSkge1xuXHRcdFx0dGhpcy5hcHBseUFuZFNldFByb2R1Y3RJY29uVGhlbWUocHJvZHVjdEljb25EYXRhLCB0cnVlKTtcblx0XHR9XG5cblx0XHRleHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpLnRoZW4oXyA9PiB7XG5cdFx0XHR0aGlzLmluc3RhbGxDb25maWd1cmF0aW9uTGlzdGVuZXIoKTtcblx0XHRcdHRoaXMuaW5zdGFsbFByZWZlcnJlZFNjaGVtZUxpc3RlbmVyKCk7XG5cdFx0XHR0aGlzLmluc3RhbGxSZWdpc3RyeUxpc3RlbmVycygpO1xuXHRcdFx0dGhpcy5pbml0aWFsaXplKCkuY2F0Y2goZXJyb3JzLm9uVW5leHBlY3RlZEVycm9yKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvZGljb25TdHlsZVNoZWV0ID0gY3JlYXRlU3R5bGVTaGVldCgpO1xuXHRcdGNvZGljb25TdHlsZVNoZWV0LmlkID0gJ2NvZGljb25TdHlsZXMnO1xuXG5cdFx0Y29uc3QgaWNvbnNTdHlsZVNoZWV0ID0gdGhpcy5fcmVnaXN0ZXIoZ2V0SWNvbnNTdHlsZVNoZWV0KHRoaXMpKTtcblx0XHRmdW5jdGlvbiB1cGRhdGVBbGwoKSB7XG5cdFx0XHRjb2RpY29uU3R5bGVTaGVldC50ZXh0Q29udGVudCA9IGljb25zU3R5bGVTaGVldC5nZXRDU1MoKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIodXBkYXRlQWxsLCAwKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoaWNvbnNTdHlsZVNoZWV0Lm9uRGlkQ2hhbmdlKCgpID0+IGRlbGF5ZXIuc2NoZWR1bGUoKSkpO1xuXHRcdGRlbGF5ZXIuc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPFtJV29ya2JlbmNoQ29sb3JUaGVtZSB8IG51bGwsIElXb3JrYmVuY2hGaWxlSWNvblRoZW1lIHwgbnVsbCwgSVdvcmtiZW5jaFByb2R1Y3RJY29uVGhlbWUgfCBudWxsXT4ge1xuXHRcdGNvbnN0IGV4dERldkxvY3MgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5leHRlbnNpb25EZXZlbG9wbWVudExvY2F0aW9uVVJJO1xuXHRcdGNvbnN0IGV4dERldkxvYyA9IGV4dERldkxvY3MgJiYgZXh0RGV2TG9jcy5sZW5ndGggPT09IDEgPyBleHREZXZMb2NzWzBdIDogdW5kZWZpbmVkOyAvLyBpbiBkZXYgbW9kZSwgc3dpdGNoIHRvIGEgdGhlbWUgcHJvdmlkZWQgYnkgdGhlIGV4dGVuc2lvbiB1bmRlciBkZXYuXG5cblx0XHRjb25zdCBpbml0aWFsaXplQ29sb3JUaGVtZSA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGRldlRoZW1lcyA9IHRoaXMuY29sb3JUaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5RXh0ZW5zaW9uTG9jYXRpb24oZXh0RGV2TG9jKTtcblx0XHRcdGlmIChkZXZUaGVtZXMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoZWRDb2xvclRoZW1lID0gZGV2VGhlbWVzLmZpbmQodGhlbWUgPT4gdGhlbWUudHlwZSA9PT0gdGhpcy5jdXJyZW50Q29sb3JUaGVtZS50eXBlKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0Q29sb3JUaGVtZShtYXRjaGVkQ29sb3JUaGVtZSA/IG1hdGNoZWRDb2xvclRoZW1lLmlkIDogZGV2VGhlbWVzWzBdLmlkLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdFx0bGV0IHRoZW1lID0gdGhpcy5jb2xvclRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlTZXR0aW5nc0lkKHRoaXMuc2V0dGluZ3MuY29sb3JUaGVtZSwgdW5kZWZpbmVkKTtcblx0XHRcdGlmICghdGhlbWUpIHtcblx0XHRcdFx0Ly8gSWYgdGhlIGN1cnJlbnQgdGhlbWUgaXMgbm90IGF2YWlsYWJsZSwgZmlyc3QgbWFrZSBzdXJlIHNldHRpbmcgc3luYyBpcyBjb21wbGV0ZVxuXHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLndoZW5Jbml0aWFsaXphdGlvbkZpbmlzaGVkKCk7XG5cdFx0XHRcdC8vIHRyeSB0byBnZXQgdGhlIHRoZW1lIGFnYWluLCBub3cgd2l0aCBhIGZhbGxiYWNrIHRvIHRoZSBkZWZhdWx0IHRoZW1lc1xuXHRcdFx0XHRjb25zdCBmYWxsYmFja1RoZW1lID0gdGhpcy5jdXJyZW50Q29sb3JUaGVtZS50eXBlID09PSBDb2xvclNjaGVtZS5MSUdIVCA/IFRoZW1lU2V0dGluZ0RlZmF1bHRzLkNPTE9SX1RIRU1FX0xJR0hUIDogVGhlbWVTZXR0aW5nRGVmYXVsdHMuQ09MT1JfVEhFTUVfREFSSztcblx0XHRcdFx0dGhlbWUgPSB0aGlzLmNvbG9yVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeVNldHRpbmdzSWQodGhpcy5zZXR0aW5ncy5jb2xvclRoZW1lLCBmYWxsYmFja1RoZW1lKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLnNldENvbG9yVGhlbWUodGhlbWUgJiYgdGhlbWUuaWQsIHVuZGVmaW5lZCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGluaXRpYWxpemVGaWxlSWNvblRoZW1lID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGV2VGhlbWVzID0gdGhpcy5maWxlSWNvblRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlFeHRlbnNpb25Mb2NhdGlvbihleHREZXZMb2MpO1xuXHRcdFx0aWYgKGRldlRoZW1lcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0RmlsZUljb25UaGVtZShkZXZUaGVtZXNbMF0uaWQsIENvbmZpZ3VyYXRpb25UYXJnZXQuTUVNT1JZKTtcblx0XHRcdH1cblx0XHRcdGxldCB0aGVtZSA9IHRoaXMuZmlsZUljb25UaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5U2V0dGluZ3NJZCh0aGlzLnNldHRpbmdzLmZpbGVJY29uVGhlbWUpO1xuXHRcdFx0aWYgKCF0aGVtZSkge1xuXHRcdFx0XHQvLyBJZiB0aGUgY3VycmVudCB0aGVtZSBpcyBub3QgYXZhaWxhYmxlLCBmaXJzdCBtYWtlIHN1cmUgc2V0dGluZyBzeW5jIGlzIGNvbXBsZXRlXG5cdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2Uud2hlbkluaXRpYWxpemF0aW9uRmluaXNoZWQoKTtcblx0XHRcdFx0dGhlbWUgPSB0aGlzLmZpbGVJY29uVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeVNldHRpbmdzSWQodGhpcy5zZXR0aW5ncy5maWxlSWNvblRoZW1lKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLnNldEZpbGVJY29uVGhlbWUodGhlbWUgPyB0aGVtZS5pZCA6IERFRkFVTFRfRklMRV9JQ09OX1RIRU1FX0lELCB1bmRlZmluZWQpO1xuXHRcdH07XG5cblx0XHRjb25zdCBpbml0aWFsaXplUHJvZHVjdEljb25UaGVtZSA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGRldlRoZW1lcyA9IHRoaXMucHJvZHVjdEljb25UaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5RXh0ZW5zaW9uTG9jYXRpb24oZXh0RGV2TG9jKTtcblx0XHRcdGlmIChkZXZUaGVtZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNldFByb2R1Y3RJY29uVGhlbWUoZGV2VGhlbWVzWzBdLmlkLCBDb25maWd1cmF0aW9uVGFyZ2V0Lk1FTU9SWSk7XG5cdFx0XHR9XG5cdFx0XHRsZXQgdGhlbWUgPSB0aGlzLnByb2R1Y3RJY29uVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeVNldHRpbmdzSWQodGhpcy5zZXR0aW5ncy5wcm9kdWN0SWNvblRoZW1lKTtcblx0XHRcdGlmICghdGhlbWUpIHtcblx0XHRcdFx0Ly8gSWYgdGhlIGN1cnJlbnQgdGhlbWUgaXMgbm90IGF2YWlsYWJsZSwgZmlyc3QgbWFrZSBzdXJlIHNldHRpbmcgc3luYyBpcyBjb21wbGV0ZVxuXHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhSW5pdGlhbGl6YXRpb25TZXJ2aWNlLndoZW5Jbml0aWFsaXphdGlvbkZpbmlzaGVkKCk7XG5cdFx0XHRcdHRoZW1lID0gdGhpcy5wcm9kdWN0SWNvblRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlTZXR0aW5nc0lkKHRoaXMuc2V0dGluZ3MucHJvZHVjdEljb25UaGVtZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9kdWN0SWNvblRoZW1lKHRoZW1lID8gdGhlbWUuaWQgOiBERUZBVUxUX1BST0RVQ1RfSUNPTl9USEVNRV9JRCwgdW5kZWZpbmVkKTtcblx0XHR9O1xuXG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW2luaXRpYWxpemVDb2xvclRoZW1lKCksIGluaXRpYWxpemVGaWxlSWNvblRoZW1lKCksIGluaXRpYWxpemVQcm9kdWN0SWNvblRoZW1lKCldKTtcblx0fVxuXG5cdHByaXZhdGUgaW5zdGFsbENvbmZpZ3VyYXRpb25MaXN0ZW5lcigpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRoZW1lU2V0dGluZ3MuQ09MT1JfVEhFTUUpXG5cdFx0XHRcdHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfREFSS19USEVNRSlcblx0XHRcdFx0fHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9MSUdIVF9USEVNRSlcblx0XHRcdFx0fHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9IQ19EQVJLX1RIRU1FKVxuXHRcdFx0XHR8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRoZW1lU2V0dGluZ3MuUFJFRkVSUkVEX0hDX0xJR0hUX1RIRU1FKVxuXHRcdFx0XHR8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRoZW1lU2V0dGluZ3MuREVURUNUX0NPTE9SX1NDSEVNRSlcblx0XHRcdFx0fHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLkRFVEVDVF9IQylcblx0XHRcdFx0fHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLlNZU1RFTV9DT0xPUl9USEVNRSlcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLnJlc3RvcmVDb2xvclRoZW1lKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUaGVtZVNldHRpbmdzLkZJTEVfSUNPTl9USEVNRSkpIHtcblx0XHRcdFx0dGhpcy5yZXN0b3JlRmlsZUljb25UaGVtZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGhlbWVTZXR0aW5ncy5QUk9EVUNUX0lDT05fVEhFTUUpKSB7XG5cdFx0XHRcdHRoaXMucmVzdG9yZVByb2R1Y3RJY29uVGhlbWUoKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmN1cnJlbnRDb2xvclRoZW1lKSB7XG5cdFx0XHRcdGxldCBoYXNDb2xvckNoYW5nZXMgPSBmYWxzZTtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGhlbWVTZXR0aW5ncy5DT0xPUl9DVVNUT01JWkFUSU9OUykpIHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRDb2xvclRoZW1lLnNldEN1c3RvbUNvbG9ycyh0aGlzLnNldHRpbmdzLmNvbG9yQ3VzdG9taXphdGlvbnMpO1xuXHRcdFx0XHRcdGhhc0NvbG9yQ2hhbmdlcyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGhlbWVTZXR0aW5ncy5UT0tFTl9DT0xPUl9DVVNUT01JWkFUSU9OUykpIHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRDb2xvclRoZW1lLnNldEN1c3RvbVRva2VuQ29sb3JzKHRoaXMuc2V0dGluZ3MudG9rZW5Db2xvckN1c3RvbWl6YXRpb25zKTtcblx0XHRcdFx0XHRoYXNDb2xvckNoYW5nZXMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRoZW1lU2V0dGluZ3MuU0VNQU5USUNfVE9LRU5fQ09MT1JfQ1VTVE9NSVpBVElPTlMpKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50Q29sb3JUaGVtZS5zZXRDdXN0b21TZW1hbnRpY1Rva2VuQ29sb3JzKHRoaXMuc2V0dGluZ3Muc2VtYW50aWNUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnMpO1xuXHRcdFx0XHRcdGhhc0NvbG9yQ2hhbmdlcyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGhhc0NvbG9yQ2hhbmdlcykge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlRHluYW1pY0NTU1J1bGVzKHRoaXMuY3VycmVudENvbG9yVGhlbWUpO1xuXHRcdFx0XHRcdHRoaXMub25Db2xvclRoZW1lQ2hhbmdlLmZpcmUodGhpcy5jdXJyZW50Q29sb3JUaGVtZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGluc3RhbGxSZWdpc3RyeUxpc3RlbmVycygpOiBQcm9taXNlPGFueT4ge1xuXG5cdFx0bGV0IHByZXZDb2xvcklkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyB1cGRhdGUgc2V0dGluZ3Mgc2NoZW1hIHNldHRpbmcgZm9yIHRoZW1lIHNwZWNpZmljIHNldHRpbmdzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb2xvclRoZW1lUmVnaXN0cnkub25EaWRDaGFuZ2UoYXN5bmMgZXZlbnQgPT4ge1xuXHRcdFx0dXBkYXRlQ29sb3JUaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzKGV2ZW50LnRoZW1lcyk7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5yZXN0b3JlQ29sb3JUaGVtZSgpKSB7IC8vIGNoZWNrcyBpZiB0aGVtZSBmcm9tIHNldHRpbmdzIGV4aXN0cyBhbmQgaXMgc2V0XG5cdFx0XHRcdC8vIHJlc3RvcmUgdGhlbWVcblx0XHRcdFx0aWYgKHRoaXMuY3VycmVudENvbG9yVGhlbWUuc2V0dGluZ3NJZCA9PT0gVGhlbWVTZXR0aW5nRGVmYXVsdHMuQ09MT1JfVEhFTUVfREFSSyAmJiAhdHlwZXMuaXNVbmRlZmluZWQocHJldkNvbG9ySWQpICYmIGF3YWl0IHRoaXMuY29sb3JUaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5SWQocHJldkNvbG9ySWQpKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zZXRDb2xvclRoZW1lKHByZXZDb2xvcklkLCAnYXV0bycpO1xuXHRcdFx0XHRcdHByZXZDb2xvcklkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmFkZGVkLnNvbWUodCA9PiB0LnNldHRpbmdzSWQgPT09IHRoaXMuY3VycmVudENvbG9yVGhlbWUuc2V0dGluZ3NJZCkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlbG9hZEN1cnJlbnRDb2xvclRoZW1lKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQucmVtb3ZlZC5zb21lKHQgPT4gdC5zZXR0aW5nc0lkID09PSB0aGlzLmN1cnJlbnRDb2xvclRoZW1lLnNldHRpbmdzSWQpKSB7XG5cdFx0XHRcdC8vIGN1cnJlbnQgdGhlbWUgaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZVxuXHRcdFx0XHRwcmV2Q29sb3JJZCA9IHRoaXMuY3VycmVudENvbG9yVGhlbWUuaWQ7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRUaGVtZSA9IHRoaXMuY29sb3JUaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5U2V0dGluZ3NJZChUaGVtZVNldHRpbmdEZWZhdWx0cy5DT0xPUl9USEVNRV9EQVJLKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5zZXRDb2xvclRoZW1lKGRlZmF1bHRUaGVtZSwgJ2F1dG8nKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgcHJldkZpbGVJY29uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVJY29uVGhlbWVSZWdpc3RyeS5vbkRpZENoYW5nZShhc3luYyBldmVudCA9PiB7XG5cdFx0XHR1cGRhdGVGaWxlSWNvblRoZW1lQ29uZmlndXJhdGlvblNjaGVtYXMoZXZlbnQudGhlbWVzKTtcblx0XHRcdGlmIChhd2FpdCB0aGlzLnJlc3RvcmVGaWxlSWNvblRoZW1lKCkpIHsgLy8gY2hlY2tzIGlmIHRoZW1lIGZyb20gc2V0dGluZ3MgZXhpc3RzIGFuZCBpcyBzZXRcblx0XHRcdFx0Ly8gcmVzdG9yZSB0aGVtZVxuXHRcdFx0XHRpZiAodGhpcy5jdXJyZW50RmlsZUljb25UaGVtZS5pZCA9PT0gREVGQVVMVF9GSUxFX0lDT05fVEhFTUVfSUQgJiYgIXR5cGVzLmlzVW5kZWZpbmVkKHByZXZGaWxlSWNvbklkKSAmJiB0aGlzLmZpbGVJY29uVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeUlkKHByZXZGaWxlSWNvbklkKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc2V0RmlsZUljb25UaGVtZShwcmV2RmlsZUljb25JZCwgJ2F1dG8nKTtcblx0XHRcdFx0XHRwcmV2RmlsZUljb25JZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fSBlbHNlIGlmIChldmVudC5hZGRlZC5zb21lKHQgPT4gdC5zZXR0aW5nc0lkID09PSB0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lLnNldHRpbmdzSWQpKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZWxvYWRDdXJyZW50RmlsZUljb25UaGVtZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LnJlbW92ZWQuc29tZSh0ID0+IHQuc2V0dGluZ3NJZCA9PT0gdGhpcy5jdXJyZW50RmlsZUljb25UaGVtZS5zZXR0aW5nc0lkKSkge1xuXHRcdFx0XHQvLyBjdXJyZW50IHRoZW1lIGlzIG5vIGxvbmdlciBhdmFpbGFibGVcblx0XHRcdFx0cHJldkZpbGVJY29uSWQgPSB0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lLmlkO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNldEZpbGVJY29uVGhlbWUoREVGQVVMVF9GSUxFX0lDT05fVEhFTUVfSUQsICdhdXRvJyk7XG5cdFx0XHR9XG5cblx0XHR9KSkpO1xuXG5cdFx0bGV0IHByZXZQcm9kdWN0SWNvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wcm9kdWN0SWNvblRoZW1lUmVnaXN0cnkub25EaWRDaGFuZ2UoYXN5bmMgZXZlbnQgPT4ge1xuXHRcdFx0dXBkYXRlUHJvZHVjdEljb25UaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzKGV2ZW50LnRoZW1lcyk7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5yZXN0b3JlUHJvZHVjdEljb25UaGVtZSgpKSB7IC8vIGNoZWNrcyBpZiB0aGVtZSBmcm9tIHNldHRpbmdzIGV4aXN0cyBhbmQgaXMgc2V0XG5cdFx0XHRcdC8vIHJlc3RvcmUgdGhlbWVcblx0XHRcdFx0aWYgKHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUuaWQgPT09IERFRkFVTFRfUFJPRFVDVF9JQ09OX1RIRU1FX0lEICYmICF0eXBlcy5pc1VuZGVmaW5lZChwcmV2UHJvZHVjdEljb25JZCkgJiYgdGhpcy5wcm9kdWN0SWNvblRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlJZChwcmV2UHJvZHVjdEljb25JZCkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNldFByb2R1Y3RJY29uVGhlbWUocHJldlByb2R1Y3RJY29uSWQsICdhdXRvJyk7XG5cdFx0XHRcdFx0cHJldlByb2R1Y3RJY29uSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZXZlbnQuYWRkZWQuc29tZSh0ID0+IHQuc2V0dGluZ3NJZCA9PT0gdGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZS5zZXR0aW5nc0lkKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmVsb2FkQ3VycmVudFByb2R1Y3RJY29uVGhlbWUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChldmVudC5yZW1vdmVkLnNvbWUodCA9PiB0LnNldHRpbmdzSWQgPT09IHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUuc2V0dGluZ3NJZCkpIHtcblx0XHRcdFx0Ly8gY3VycmVudCB0aGVtZSBpcyBubyBsb25nZXIgYXZhaWxhYmxlXG5cdFx0XHRcdHByZXZQcm9kdWN0SWNvbklkID0gdGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZS5pZDtcblx0XHRcdFx0YXdhaXQgdGhpcy5zZXRQcm9kdWN0SWNvblRoZW1lKERFRkFVTFRfUFJPRFVDVF9JQ09OX1RIRU1FX0lELCAnYXV0bycpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxhbmd1YWdlU2VydmljZS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnJlbG9hZEN1cnJlbnRGaWxlSWNvblRoZW1lKCkpKTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChbdGhpcy5nZXRDb2xvclRoZW1lcygpLCB0aGlzLmdldEZpbGVJY29uVGhlbWVzKCksIHRoaXMuZ2V0UHJvZHVjdEljb25UaGVtZXMoKV0pLnRoZW4oKFtjdCwgZml0LCBwaXRdKSA9PiB7XG5cdFx0XHR1cGRhdGVDb2xvclRoZW1lQ29uZmlndXJhdGlvblNjaGVtYXMoY3QpO1xuXHRcdFx0dXBkYXRlRmlsZUljb25UaGVtZUNvbmZpZ3VyYXRpb25TY2hlbWFzKGZpdCk7XG5cdFx0XHR1cGRhdGVQcm9kdWN0SWNvblRoZW1lQ29uZmlndXJhdGlvblNjaGVtYXMocGl0KTtcblx0XHR9KTtcblx0fVxuXG5cblx0Ly8gcHJlZmVycmVkIHNjaGVtZSBoYW5kbGluZ1xuXG5cdHByaXZhdGUgaW5zdGFsbFByZWZlcnJlZFNjaGVtZUxpc3RlbmVyKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG9zdENvbG9yU2VydmljZS5vbkRpZENoYW5nZUNvbG9yU2NoZW1lKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLmlzRGV0ZWN0aW5nQ29sb3JTY2hlbWUoKSkge1xuXHRcdFx0XHR0aGlzLnJlc3RvcmVDb2xvclRoZW1lKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIGdldENvbG9yVGhlbWUoKTogSVdvcmtiZW5jaENvbG9yVGhlbWUge1xuXHRcdHJldHVybiB0aGlzLmN1cnJlbnRDb2xvclRoZW1lO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldENvbG9yVGhlbWVzKCk6IFByb21pc2U8SVdvcmtiZW5jaENvbG9yVGhlbWVbXT4ge1xuXHRcdHJldHVybiB0aGlzLmNvbG9yVGhlbWVSZWdpc3RyeS5nZXRUaGVtZXMoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQcmVmZXJyZWRDb2xvclNjaGVtZSgpOiBDb2xvclNjaGVtZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuZ2V0UHJlZmVycmVkQ29sb3JTY2hlbWUoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRNYXJrZXRwbGFjZUNvbG9yVGhlbWVzKHB1Ymxpc2hlcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZyk6IFByb21pc2U8SVdvcmtiZW5jaENvbG9yVGhlbWVbXT4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkxvY2F0aW9uID0gYXdhaXQgdGhpcy5leHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVVJMKHsgcHVibGlzaGVyLCBuYW1lLCB2ZXJzaW9uIH0sICdleHRlbnNpb24nKTtcblx0XHRpZiAoZXh0ZW5zaW9uTG9jYXRpb24pIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IG1hbmlmZXN0Q29udGVudCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLnJlYWRFeHRlbnNpb25SZXNvdXJjZShyZXNvdXJjZXMuam9pblBhdGgoZXh0ZW5zaW9uTG9jYXRpb24sICdwYWNrYWdlLmpzb24nKSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNvbG9yVGhlbWVSZWdpc3RyeS5nZXRNYXJrZXRwbGFjZVRoZW1lcyhKU09OLnBhcnNlKG1hbmlmZXN0Q29udGVudCksIGV4dGVuc2lvbkxvY2F0aW9uLCBFeHRlbnNpb25EYXRhLmZyb21OYW1lKHB1Ymxpc2hlciwgbmFtZSkpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ1Byb2JsZW0gbG9hZGluZyB0aGVtZXMgZnJvbSBtYXJrZXRwbGFjZScsIGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkQ29sb3JUaGVtZUNoYW5nZSgpOiBFdmVudDxJV29ya2JlbmNoQ29sb3JUaGVtZT4ge1xuXHRcdHJldHVybiB0aGlzLm9uQ29sb3JUaGVtZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb2xvclRoZW1lKHRoZW1lSWRPclRoZW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBJV29ya2JlbmNoQ29sb3JUaGVtZSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCk6IFByb21pc2U8SVdvcmtiZW5jaENvbG9yVGhlbWUgfCBudWxsPiB7XG5cdFx0cmV0dXJuIHRoaXMuY29sb3JUaGVtZVNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnRlcm5hbFNldENvbG9yVGhlbWUodGhlbWVJZE9yVGhlbWUsIHNldHRpbmdzVGFyZ2V0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW50ZXJuYWxTZXRDb2xvclRoZW1lKHRoZW1lSWRPclRoZW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBJV29ya2JlbmNoQ29sb3JUaGVtZSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCk6IFByb21pc2U8SVdvcmtiZW5jaENvbG9yVGhlbWUgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGVtZUlkT3JUaGVtZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IHRoZW1lSWQgPSB0eXBlcy5pc1N0cmluZyh0aGVtZUlkT3JUaGVtZSkgPyB2YWxpZGF0ZVRoZW1lSWQodGhlbWVJZE9yVGhlbWUpIDogdGhlbWVJZE9yVGhlbWUuaWQ7XG5cdFx0aWYgKHRoaXMuY3VycmVudENvbG9yVGhlbWUuaXNMb2FkZWQgJiYgdGhlbWVJZCA9PT0gdGhpcy5jdXJyZW50Q29sb3JUaGVtZS5pZCkge1xuXHRcdFx0aWYgKHNldHRpbmdzVGFyZ2V0ICE9PSAncHJldmlldycpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50Q29sb3JUaGVtZS50b1N0b3JhZ2UodGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5zZXRDb2xvclRoZW1lKHRoaXMuY3VycmVudENvbG9yVGhlbWUsIHNldHRpbmdzVGFyZ2V0KTtcblx0XHR9XG5cblx0XHRsZXQgdGhlbWVEYXRhID0gdGhpcy5jb2xvclRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlJZCh0aGVtZUlkKTtcblx0XHRpZiAoIXRoZW1lRGF0YSkge1xuXHRcdFx0aWYgKHRoZW1lSWRPclRoZW1lIGluc3RhbmNlb2YgQ29sb3JUaGVtZURhdGEpIHtcblx0XHRcdFx0dGhlbWVEYXRhID0gdGhlbWVJZE9yVGhlbWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoZW1lRGF0YS5lbnN1cmVMb2FkZWQodGhpcy5leHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UpO1xuXHRcdFx0dGhlbWVEYXRhLnNldEN1c3RvbWl6YXRpb25zKHRoaXMuc2V0dGluZ3MpO1xuXHRcdFx0cmV0dXJuIHRoaXMuYXBwbHlUaGVtZSh0aGVtZURhdGEsIHNldHRpbmdzVGFyZ2V0KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnZXJyb3IuY2Fubm90bG9hZHRoZW1lJywgXCJVbmFibGUgdG8gbG9hZCB7MH06IHsxfVwiLCB0aGVtZURhdGEubG9jYXRpb24/LnRvU3RyaW5nKCksIGVycm9yLm1lc3NhZ2UpKTtcblx0XHR9XG5cblx0fVxuXG5cdHByaXZhdGUgcmVsb2FkQ3VycmVudENvbG9yVGhlbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY29sb3JUaGVtZVNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB0aGVtZSA9IHRoaXMuY29sb3JUaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5U2V0dGluZ3NJZCh0aGlzLmN1cnJlbnRDb2xvclRoZW1lLnNldHRpbmdzSWQpIHx8IHRoaXMuY3VycmVudENvbG9yVGhlbWU7XG5cdFx0XHRcdGF3YWl0IHRoZW1lLnJlbG9hZCh0aGlzLmV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSk7XG5cdFx0XHRcdHRoZW1lLnNldEN1c3RvbWl6YXRpb25zKHRoaXMuc2V0dGluZ3MpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcGx5VGhlbWUodGhlbWUsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1VuYWJsZSB0byByZWxvYWQgezB9OiB7MX0nLCB0aGlzLmN1cnJlbnRDb2xvclRoZW1lLmxvY2F0aW9uPy50b1N0cmluZygpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyByZXN0b3JlQ29sb3JUaGVtZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5jb2xvclRoZW1lU2VxdWVuY2VyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHNldHRpbmdJZCA9IHRoaXMuc2V0dGluZ3MuY29sb3JUaGVtZTtcblx0XHRcdGNvbnN0IHRoZW1lID0gdGhpcy5jb2xvclRoZW1lUmVnaXN0cnkuZmluZFRoZW1lQnlTZXR0aW5nc0lkKHNldHRpbmdJZCk7XG5cdFx0XHRpZiAodGhlbWUpIHtcblx0XHRcdFx0aWYgKHNldHRpbmdJZCAhPT0gdGhpcy5jdXJyZW50Q29sb3JUaGVtZS5zZXR0aW5nc0lkKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5pbnRlcm5hbFNldENvbG9yVGhlbWUodGhlbWUuaWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhlbWUgIT09IHRoaXMuY3VycmVudENvbG9yVGhlbWUpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGVtZS5lbnN1cmVMb2FkZWQodGhpcy5leHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UpO1xuXHRcdFx0XHRcdHRoZW1lLnNldEN1c3RvbWl6YXRpb25zKHRoaXMuc2V0dGluZ3MpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwbHlUaGVtZSh0aGVtZSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRHluYW1pY0NTU1J1bGVzKHRoZW1lRGF0YTogSUNvbG9yVGhlbWUpIHtcblx0XHRjb25zdCBjc3NSdWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGNvbnN0IHJ1bGVDb2xsZWN0b3IgPSB7XG5cdFx0XHRhZGRSdWxlOiAocnVsZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmICghY3NzUnVsZXMuaGFzKHJ1bGUpKSB7XG5cdFx0XHRcdFx0Y3NzUnVsZXMuYWRkKHJ1bGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRydWxlQ29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28td29ya2JlbmNoIHsgZm9yY2VkLWNvbG9yLWFkanVzdDogbm9uZTsgfWApO1xuXHRcdHRoZW1pbmdSZWdpc3RyeS5nZXRUaGVtaW5nUGFydGljaXBhbnRzKCkuZm9yRWFjaChwID0+IHAodGhlbWVEYXRhLCBydWxlQ29sbGVjdG9yLCB0aGlzLmVudmlyb25tZW50U2VydmljZSkpO1xuXG5cdFx0Y29uc3QgY29sb3JWYXJpYWJsZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGdldENvbG9yUmVnaXN0cnkoKS5nZXRDb2xvcnMoKSkge1xuXHRcdFx0Y29uc3QgY29sb3IgPSB0aGVtZURhdGEuZ2V0Q29sb3IoaXRlbS5pZCwgdHJ1ZSk7XG5cdFx0XHRpZiAoY29sb3IpIHtcblx0XHRcdFx0Y29sb3JWYXJpYWJsZXMucHVzaChgJHthc0Nzc1ZhcmlhYmxlTmFtZShpdGVtLmlkKX06ICR7Y29sb3IudG9TdHJpbmcoKX07YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJ1bGVDb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggeyAke2NvbG9yVmFyaWFibGVzLmpvaW4oJ1xcbicpfSB9YCk7XG5cblx0XHRfYXBwbHlSdWxlcyhbLi4uY3NzUnVsZXNdLmpvaW4oJ1xcbicpLCBjb2xvclRoZW1lUnVsZXNDbGFzc05hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseVRoZW1lKG5ld1RoZW1lOiBDb2xvclRoZW1lRGF0YSwgc2V0dGluZ3NUYXJnZXQ6IFRoZW1lU2V0dGluZ1RhcmdldCwgc2lsZW50ID0gZmFsc2UpOiBQcm9taXNlPElXb3JrYmVuY2hDb2xvclRoZW1lIHwgbnVsbD4ge1xuXHRcdHRoaXMudXBkYXRlRHluYW1pY0NTU1J1bGVzKG5ld1RoZW1lKTtcblxuXHRcdGlmICh0aGlzLmN1cnJlbnRDb2xvclRoZW1lLmlkKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKC4uLnRoaXMuY3VycmVudENvbG9yVGhlbWUuY2xhc3NOYW1lcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoVGhlbWVUeXBlU2VsZWN0b3IuVlMsIFRoZW1lVHlwZVNlbGVjdG9yLlZTX0RBUkssIFRoZW1lVHlwZVNlbGVjdG9yLkhDX0JMQUNLLCBUaGVtZVR5cGVTZWxlY3Rvci5IQ19MSUdIVCk7XG5cdFx0fVxuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoLi4ubmV3VGhlbWUuY2xhc3NOYW1lcyk7XG5cblx0XHR0aGlzLmN1cnJlbnRDb2xvclRoZW1lLmNsZWFyQ2FjaGVzKCk7XG5cdFx0dGhpcy5jdXJyZW50Q29sb3JUaGVtZSA9IG5ld1RoZW1lO1xuXHRcdGlmICghdGhpcy5jb2xvclRoZW1pbmdQYXJ0aWNpcGFudENoYW5nZUxpc3RlbmVyKSB7XG5cdFx0XHR0aGlzLmNvbG9yVGhlbWluZ1BhcnRpY2lwYW50Q2hhbmdlTGlzdGVuZXIgPSB0aGVtaW5nUmVnaXN0cnkub25UaGVtaW5nUGFydGljaXBhbnRBZGRlZChfID0+IHRoaXMudXBkYXRlRHluYW1pY0NTU1J1bGVzKHRoaXMuY3VycmVudENvbG9yVGhlbWUpKTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbG9yVGhlbWVXYXRjaGVyLnVwZGF0ZShuZXdUaGVtZSk7XG5cblx0XHR0aGlzLnNlbmRUZWxlbWV0cnkobmV3VGhlbWUuaWQsIG5ld1RoZW1lLmV4dGVuc2lvbkRhdGEsICdjb2xvcicpO1xuXG5cdFx0aWYgKHNpbGVudCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQ29sb3JUaGVtZUNoYW5nZS5maXJlKHRoaXMuY3VycmVudENvbG9yVGhlbWUpO1xuXG5cdFx0Ly8gcmVtZW1iZXIgdGhlbWUgZGF0YSBmb3IgYSBxdWljayByZXN0b3JlXG5cdFx0aWYgKG5ld1RoZW1lLmlzTG9hZGVkICYmIHNldHRpbmdzVGFyZ2V0ICE9PSAncHJldmlldycpIHtcblx0XHRcdG5ld1RoZW1lLnRvU3RvcmFnZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5zZXRDb2xvclRoZW1lKHRoaXMuY3VycmVudENvbG9yVGhlbWUsIHNldHRpbmdzVGFyZ2V0KTtcblx0fVxuXG5cblx0cHJpdmF0ZSB0aGVtZUV4dGVuc2lvbnNBY3RpdmF0ZWQgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcblx0cHJpdmF0ZSBzZW5kVGVsZW1ldHJ5KHRoZW1lSWQ6IHN0cmluZywgdGhlbWVEYXRhOiBFeHRlbnNpb25EYXRhIHwgdW5kZWZpbmVkLCB0aGVtZVR5cGU6IHN0cmluZykge1xuXHRcdGlmICh0aGVtZURhdGEpIHtcblx0XHRcdGNvbnN0IGtleSA9IHRoZW1lVHlwZSArIHRoZW1lRGF0YS5leHRlbnNpb25JZDtcblx0XHRcdGlmICghdGhpcy50aGVtZUV4dGVuc2lvbnNBY3RpdmF0ZWQuZ2V0KGtleSkpIHtcblx0XHRcdFx0dHlwZSBBY3RpdmF0ZVBsdWdpbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdG93bmVyOiAnYWVzY2hsaSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ0FuIGV2ZW50IGlzIGZpcmVkIHdoZW4gYW4gY29sb3IgdGhlbWUgZXh0ZW5zaW9uIGlzIGZpcnN0IHVzZWQgYXMgaXQgcHJvdmlkZXMgdGhlIGN1cnJlbnRseSBzaG93biBjb2xvciB0aGVtZS4nO1xuXHRcdFx0XHRcdGlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnUHVibGljTm9uUGVyc29uYWxEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBleHRlbnNpb24gaWQuJyB9O1xuXHRcdFx0XHRcdG5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBuYW1lLicgfTtcblx0XHRcdFx0XHRpc0J1aWx0aW46IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSBleHRlbnNpb24gaXMgYSBidWlsdC1pbiBleHRlbnNpb24uJyB9O1xuXHRcdFx0XHRcdHB1Ymxpc2hlckRpc3BsYXlOYW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBwdWJsaXNoZXIgaWQuJyB9O1xuXHRcdFx0XHRcdHRoZW1lSWQ6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkIG9mIHRoZSB0aGVtZSB0aGF0IHRyaWdnZXJlZCB0aGUgZmlyc3QgZXh0ZW5zaW9uIHVzZS4nIH07XG5cdFx0XHRcdH07XG5cdFx0XHRcdHR5cGUgQWN0aXZhdGVQbHVnaW5FdmVudCA9IHtcblx0XHRcdFx0XHRpZDogc3RyaW5nO1xuXHRcdFx0XHRcdG5hbWU6IHN0cmluZztcblx0XHRcdFx0XHRpc0J1aWx0aW46IGJvb2xlYW47XG5cdFx0XHRcdFx0cHVibGlzaGVyRGlzcGxheU5hbWU6IHN0cmluZztcblx0XHRcdFx0XHR0aGVtZUlkOiBzdHJpbmc7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEFjdGl2YXRlUGx1Z2luRXZlbnQsIEFjdGl2YXRlUGx1Z2luQ2xhc3NpZmljYXRpb24+KCdhY3RpdmF0ZVBsdWdpbicsIHtcblx0XHRcdFx0XHRpZDogdGhlbWVEYXRhLmV4dGVuc2lvbklkLFxuXHRcdFx0XHRcdG5hbWU6IHRoZW1lRGF0YS5leHRlbnNpb25OYW1lLFxuXHRcdFx0XHRcdGlzQnVpbHRpbjogdGhlbWVEYXRhLmV4dGVuc2lvbklzQnVpbHRpbixcblx0XHRcdFx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogdGhlbWVEYXRhLmV4dGVuc2lvblB1Ymxpc2hlcixcblx0XHRcdFx0XHR0aGVtZUlkOiB0aGVtZUlkXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnRoZW1lRXh0ZW5zaW9uc0FjdGl2YXRlZC5zZXQoa2V5LCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0RmlsZUljb25UaGVtZXMoKTogUHJvbWlzZTxJV29ya2JlbmNoRmlsZUljb25UaGVtZVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZUljb25UaGVtZVJlZ2lzdHJ5LmdldFRoZW1lcygpO1xuXHR9XG5cblx0cHVibGljIGdldEZpbGVJY29uVGhlbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudEZpbGVJY29uVGhlbWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkRmlsZUljb25UaGVtZUNoYW5nZSgpOiBFdmVudDxJV29ya2JlbmNoRmlsZUljb25UaGVtZT4ge1xuXHRcdHJldHVybiB0aGlzLm9uRmlsZUljb25UaGVtZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRGaWxlSWNvblRoZW1lKGljb25UaGVtZU9ySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB8IElXb3JrYmVuY2hGaWxlSWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KTogUHJvbWlzZTxJV29ya2JlbmNoRmlsZUljb25UaGVtZT4ge1xuXHRcdHJldHVybiB0aGlzLmZpbGVJY29uVGhlbWVTZXF1ZW5jZXIucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW50ZXJuYWxTZXRGaWxlSWNvblRoZW1lKGljb25UaGVtZU9ySWQsIHNldHRpbmdzVGFyZ2V0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW50ZXJuYWxTZXRGaWxlSWNvblRoZW1lKGljb25UaGVtZU9ySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB8IElXb3JrYmVuY2hGaWxlSWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KTogUHJvbWlzZTxJV29ya2JlbmNoRmlsZUljb25UaGVtZT4ge1xuXHRcdGlmIChpY29uVGhlbWVPcklkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGljb25UaGVtZU9ySWQgPSAnJztcblx0XHR9XG5cdFx0Y29uc3QgdGhlbWVJZCA9IHR5cGVzLmlzU3RyaW5nKGljb25UaGVtZU9ySWQpID8gaWNvblRoZW1lT3JJZCA6IGljb25UaGVtZU9ySWQuaWQ7XG5cdFx0aWYgKHRoZW1lSWQgIT09IHRoaXMuY3VycmVudEZpbGVJY29uVGhlbWUuaWQgfHwgIXRoaXMuY3VycmVudEZpbGVJY29uVGhlbWUuaXNMb2FkZWQpIHtcblxuXHRcdFx0bGV0IG5ld1RoZW1lRGF0YSA9IHRoaXMuZmlsZUljb25UaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5SWQodGhlbWVJZCk7XG5cdFx0XHRpZiAoIW5ld1RoZW1lRGF0YSAmJiBpY29uVGhlbWVPcklkIGluc3RhbmNlb2YgRmlsZUljb25UaGVtZURhdGEpIHtcblx0XHRcdFx0bmV3VGhlbWVEYXRhID0gaWNvblRoZW1lT3JJZDtcblx0XHRcdH1cblx0XHRcdGlmICghbmV3VGhlbWVEYXRhKSB7XG5cdFx0XHRcdG5ld1RoZW1lRGF0YSA9IEZpbGVJY29uVGhlbWVEYXRhLm5vSWNvblRoZW1lO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgbmV3VGhlbWVEYXRhLmVuc3VyZUxvYWRlZCh0aGlzLmZpbGVJY29uVGhlbWVMb2FkZXIpO1xuXG5cdFx0XHR0aGlzLmFwcGx5QW5kU2V0RmlsZUljb25UaGVtZShuZXdUaGVtZURhdGEpOyAvLyB1cGRhdGVzIHRoaXMuY3VycmVudEZpbGVJY29uVGhlbWVcblx0XHR9XG5cblx0XHRjb25zdCB0aGVtZURhdGEgPSB0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lO1xuXG5cdFx0Ly8gcmVtZW1iZXIgdGhlbWUgZGF0YSBmb3IgYSBxdWljayByZXN0b3JlXG5cdFx0aWYgKHRoZW1lRGF0YS5pc0xvYWRlZCAmJiBzZXR0aW5nc1RhcmdldCAhPT0gJ3ByZXZpZXcnICYmICghdGhlbWVEYXRhLmxvY2F0aW9uIHx8ICFnZXRSZW1vdGVBdXRob3JpdHkodGhlbWVEYXRhLmxvY2F0aW9uKSkpIHtcblx0XHRcdHRoZW1lRGF0YS50b1N0b3JhZ2UodGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuc2V0dGluZ3Muc2V0RmlsZUljb25UaGVtZSh0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldCk7XG5cblx0XHRyZXR1cm4gdGhlbWVEYXRhO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldE1hcmtldHBsYWNlRmlsZUljb25UaGVtZXMocHVibGlzaGVyOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKTogUHJvbWlzZTxJV29ya2JlbmNoRmlsZUljb25UaGVtZVtdPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uTG9jYXRpb24gPSBhd2FpdCB0aGlzLmV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5nZXRFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VVUkwoeyBwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24gfSwgJ2V4dGVuc2lvbicpO1xuXHRcdGlmIChleHRlbnNpb25Mb2NhdGlvbikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbWFuaWZlc3RDb250ZW50ID0gYXdhaXQgdGhpcy5leHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UucmVhZEV4dGVuc2lvblJlc291cmNlKHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb25Mb2NhdGlvbiwgJ3BhY2thZ2UuanNvbicpKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZmlsZUljb25UaGVtZVJlZ2lzdHJ5LmdldE1hcmtldHBsYWNlVGhlbWVzKEpTT04ucGFyc2UobWFuaWZlc3RDb250ZW50KSwgZXh0ZW5zaW9uTG9jYXRpb24sIEV4dGVuc2lvbkRhdGEuZnJvbU5hbWUocHVibGlzaGVyLCBuYW1lKSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignUHJvYmxlbSBsb2FkaW5nIHRoZW1lcyBmcm9tIG1hcmtldHBsYWNlJywgZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVsb2FkQ3VycmVudEZpbGVJY29uVGhlbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZUljb25UaGVtZVNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lLnJlbG9hZCh0aGlzLmZpbGVJY29uVGhlbWVMb2FkZXIpO1xuXHRcdFx0dGhpcy5hcHBseUFuZFNldEZpbGVJY29uVGhlbWUodGhpcy5jdXJyZW50RmlsZUljb25UaGVtZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVzdG9yZUZpbGVJY29uVGhlbWUoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZUljb25UaGVtZVNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzZXR0aW5nSWQgPSB0aGlzLnNldHRpbmdzLmZpbGVJY29uVGhlbWU7XG5cdFx0XHRjb25zdCB0aGVtZSA9IHRoaXMuZmlsZUljb25UaGVtZVJlZ2lzdHJ5LmZpbmRUaGVtZUJ5U2V0dGluZ3NJZChzZXR0aW5nSWQpO1xuXHRcdFx0aWYgKHRoZW1lKSB7XG5cdFx0XHRcdGlmIChzZXR0aW5nSWQgIT09IHRoaXMuY3VycmVudEZpbGVJY29uVGhlbWUuc2V0dGluZ3NJZCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuaW50ZXJuYWxTZXRGaWxlSWNvblRoZW1lKHRoZW1lLmlkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoZW1lICE9PSB0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhlbWUuZW5zdXJlTG9hZGVkKHRoaXMuZmlsZUljb25UaGVtZUxvYWRlcik7XG5cdFx0XHRcdFx0dGhpcy5hcHBseUFuZFNldEZpbGVJY29uVGhlbWUodGhlbWUsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUFuZFNldEZpbGVJY29uVGhlbWUoaWNvblRoZW1lRGF0YTogRmlsZUljb25UaGVtZURhdGEsIHNpbGVudCA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy5jdXJyZW50RmlsZUljb25UaGVtZSA9IGljb25UaGVtZURhdGE7XG5cblx0XHRfYXBwbHlSdWxlcyhpY29uVGhlbWVEYXRhLnN0eWxlU2hlZXRDb250ZW50ISwgZmlsZUljb25UaGVtZVJ1bGVzQ2xhc3NOYW1lKTtcblxuXHRcdGlmIChpY29uVGhlbWVEYXRhLmlkKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKGZpbGVJY29uc0VuYWJsZWRDbGFzcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoZmlsZUljb25zRW5hYmxlZENsYXNzKTtcblx0XHR9XG5cblx0XHR0aGlzLmZpbGVJY29uVGhlbWVXYXRjaGVyLnVwZGF0ZShpY29uVGhlbWVEYXRhKTtcblxuXHRcdGlmIChpY29uVGhlbWVEYXRhLmlkKSB7XG5cdFx0XHR0aGlzLnNlbmRUZWxlbWV0cnkoaWNvblRoZW1lRGF0YS5pZCwgaWNvblRoZW1lRGF0YS5leHRlbnNpb25EYXRhLCAnZmlsZUljb24nKTtcblx0XHR9XG5cblx0XHRpZiAoIXNpbGVudCkge1xuXHRcdFx0dGhpcy5vbkZpbGVJY29uVGhlbWVDaGFuZ2UuZmlyZSh0aGlzLmN1cnJlbnRGaWxlSWNvblRoZW1lKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0UHJvZHVjdEljb25UaGVtZXMoKTogUHJvbWlzZTxJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMucHJvZHVjdEljb25UaGVtZVJlZ2lzdHJ5LmdldFRoZW1lcygpO1xuXHR9XG5cblx0cHVibGljIGdldFByb2R1Y3RJY29uVGhlbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkUHJvZHVjdEljb25UaGVtZUNoYW5nZSgpOiBFdmVudDxJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZT4ge1xuXHRcdHJldHVybiB0aGlzLm9uUHJvZHVjdEljb25UaGVtZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzZXRQcm9kdWN0SWNvblRoZW1lKGljb25UaGVtZU9ySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB8IElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KTogUHJvbWlzZTxJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZT4ge1xuXHRcdHJldHVybiB0aGlzLnByb2R1Y3RJY29uVGhlbWVTZXF1ZW5jZXIucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW50ZXJuYWxTZXRQcm9kdWN0SWNvblRoZW1lKGljb25UaGVtZU9ySWQsIHNldHRpbmdzVGFyZ2V0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW50ZXJuYWxTZXRQcm9kdWN0SWNvblRoZW1lKGljb25UaGVtZU9ySWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB8IElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KTogUHJvbWlzZTxJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZT4ge1xuXHRcdGlmIChpY29uVGhlbWVPcklkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGljb25UaGVtZU9ySWQgPSAnJztcblx0XHR9XG5cdFx0Y29uc3QgdGhlbWVJZCA9IHR5cGVzLmlzU3RyaW5nKGljb25UaGVtZU9ySWQpID8gaWNvblRoZW1lT3JJZCA6IGljb25UaGVtZU9ySWQuaWQ7XG5cdFx0aWYgKHRoZW1lSWQgIT09IHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUuaWQgfHwgIXRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUuaXNMb2FkZWQpIHtcblx0XHRcdGxldCBuZXdUaGVtZURhdGEgPSB0aGlzLnByb2R1Y3RJY29uVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeUlkKHRoZW1lSWQpO1xuXHRcdFx0aWYgKCFuZXdUaGVtZURhdGEgJiYgaWNvblRoZW1lT3JJZCBpbnN0YW5jZW9mIFByb2R1Y3RJY29uVGhlbWVEYXRhKSB7XG5cdFx0XHRcdG5ld1RoZW1lRGF0YSA9IGljb25UaGVtZU9ySWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW5ld1RoZW1lRGF0YSkge1xuXHRcdFx0XHRuZXdUaGVtZURhdGEgPSBQcm9kdWN0SWNvblRoZW1lRGF0YS5kZWZhdWx0VGhlbWU7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBuZXdUaGVtZURhdGEuZW5zdXJlTG9hZGVkKHRoaXMuZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXG5cdFx0XHR0aGlzLmFwcGx5QW5kU2V0UHJvZHVjdEljb25UaGVtZShuZXdUaGVtZURhdGEpOyAvLyB1cGRhdGVzIHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWVcblx0XHR9XG5cdFx0Y29uc3QgdGhlbWVEYXRhID0gdGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZTtcblxuXHRcdC8vIHJlbWVtYmVyIHRoZW1lIGRhdGEgZm9yIGEgcXVpY2sgcmVzdG9yZVxuXHRcdGlmICh0aGVtZURhdGEuaXNMb2FkZWQgJiYgc2V0dGluZ3NUYXJnZXQgIT09ICdwcmV2aWV3JyAmJiAoIXRoZW1lRGF0YS5sb2NhdGlvbiB8fCAhZ2V0UmVtb3RlQXV0aG9yaXR5KHRoZW1lRGF0YS5sb2NhdGlvbikpKSB7XG5cdFx0XHR0aGVtZURhdGEudG9TdG9yYWdlKHRoaXMuc3RvcmFnZVNlcnZpY2UpO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLnNldHRpbmdzLnNldFByb2R1Y3RJY29uVGhlbWUodGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZSwgc2V0dGluZ3NUYXJnZXQpO1xuXG5cdFx0cmV0dXJuIHRoZW1lRGF0YTtcblxuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldE1hcmtldHBsYWNlUHJvZHVjdEljb25UaGVtZXMocHVibGlzaGVyOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKTogUHJvbWlzZTxJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZVtdPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uTG9jYXRpb24gPSBhd2FpdCB0aGlzLmV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5nZXRFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VVUkwoeyBwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24gfSwgJ2V4dGVuc2lvbicpO1xuXHRcdGlmIChleHRlbnNpb25Mb2NhdGlvbikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbWFuaWZlc3RDb250ZW50ID0gYXdhaXQgdGhpcy5leHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UucmVhZEV4dGVuc2lvblJlc291cmNlKHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb25Mb2NhdGlvbiwgJ3BhY2thZ2UuanNvbicpKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMucHJvZHVjdEljb25UaGVtZVJlZ2lzdHJ5LmdldE1hcmtldHBsYWNlVGhlbWVzKEpTT04ucGFyc2UobWFuaWZlc3RDb250ZW50KSwgZXh0ZW5zaW9uTG9jYXRpb24sIEV4dGVuc2lvbkRhdGEuZnJvbU5hbWUocHVibGlzaGVyLCBuYW1lKSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignUHJvYmxlbSBsb2FkaW5nIHRoZW1lcyBmcm9tIG1hcmtldHBsYWNlJywgZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVsb2FkQ3VycmVudFByb2R1Y3RJY29uVGhlbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMucHJvZHVjdEljb25UaGVtZVNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmN1cnJlbnRQcm9kdWN0SWNvblRoZW1lLnJlbG9hZCh0aGlzLmV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdHRoaXMuYXBwbHlBbmRTZXRQcm9kdWN0SWNvblRoZW1lKHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlc3RvcmVQcm9kdWN0SWNvblRoZW1lKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLnByb2R1Y3RJY29uVGhlbWVTZXF1ZW5jZXIucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2V0dGluZ0lkID0gdGhpcy5zZXR0aW5ncy5wcm9kdWN0SWNvblRoZW1lO1xuXHRcdFx0Y29uc3QgdGhlbWUgPSB0aGlzLnByb2R1Y3RJY29uVGhlbWVSZWdpc3RyeS5maW5kVGhlbWVCeVNldHRpbmdzSWQoc2V0dGluZ0lkKTtcblx0XHRcdGlmICh0aGVtZSkge1xuXHRcdFx0XHRpZiAoc2V0dGluZ0lkICE9PSB0aGlzLmN1cnJlbnRQcm9kdWN0SWNvblRoZW1lLnNldHRpbmdzSWQpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmludGVybmFsU2V0UHJvZHVjdEljb25UaGVtZSh0aGVtZS5pZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGVtZSAhPT0gdGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoZW1lLmVuc3VyZUxvYWRlZCh0aGlzLmV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdFx0XHR0aGlzLmFwcGx5QW5kU2V0UHJvZHVjdEljb25UaGVtZSh0aGVtZSwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5QW5kU2V0UHJvZHVjdEljb25UaGVtZShpY29uVGhlbWVEYXRhOiBQcm9kdWN0SWNvblRoZW1lRGF0YSwgc2lsZW50ID0gZmFsc2UpOiB2b2lkIHtcblxuXHRcdHRoaXMuY3VycmVudFByb2R1Y3RJY29uVGhlbWUgPSBpY29uVGhlbWVEYXRhO1xuXG5cdFx0X2FwcGx5UnVsZXMoaWNvblRoZW1lRGF0YS5zdHlsZVNoZWV0Q29udGVudCEsIHByb2R1Y3RJY29uVGhlbWVSdWxlc0NsYXNzTmFtZSk7XG5cblx0XHR0aGlzLnByb2R1Y3RJY29uVGhlbWVXYXRjaGVyLnVwZGF0ZShpY29uVGhlbWVEYXRhKTtcblxuXHRcdGlmIChpY29uVGhlbWVEYXRhLmlkKSB7XG5cdFx0XHR0aGlzLnNlbmRUZWxlbWV0cnkoaWNvblRoZW1lRGF0YS5pZCwgaWNvblRoZW1lRGF0YS5leHRlbnNpb25EYXRhLCAncHJvZHVjdEljb24nKTtcblx0XHR9XG5cdFx0aWYgKCFzaWxlbnQpIHtcblx0XHRcdHRoaXMub25Qcm9kdWN0SWNvblRoZW1lQ2hhbmdlLmZpcmUodGhpcy5jdXJyZW50UHJvZHVjdEljb25UaGVtZSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFRoZW1lRmlsZVdhdGNoZXIge1xuXG5cdHByaXZhdGUgd2F0Y2hlZExvY2F0aW9uOiBVUkkgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgd2F0Y2hlckRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGZpbGVDaGFuZ2VMaXN0ZW5lcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLCBwcml2YXRlIGVudmlyb25tZW50U2VydmljZTogSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIHByaXZhdGUgb25VcGRhdGU6ICgpID0+IHZvaWQpIHtcblx0fVxuXG5cdHVwZGF0ZSh0aGVtZTogeyBsb2NhdGlvbj86IFVSSTsgd2F0Y2g/OiBib29sZWFuIH0pIHtcblx0XHRpZiAoIXJlc291cmNlcy5pc0VxdWFsKHRoZW1lLmxvY2F0aW9uLCB0aGlzLndhdGNoZWRMb2NhdGlvbikpIHtcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0aWYgKHRoZW1lLmxvY2F0aW9uICYmICh0aGVtZS53YXRjaCB8fCB0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0V4dGVuc2lvbkRldmVsb3BtZW50KSkge1xuXHRcdFx0XHR0aGlzLndhdGNoZWRMb2NhdGlvbiA9IHRoZW1lLmxvY2F0aW9uO1xuXHRcdFx0XHR0aGlzLndhdGNoZXJEaXNwb3NhYmxlID0gdGhpcy5maWxlU2VydmljZS53YXRjaCh0aGVtZS5sb2NhdGlvbik7XG5cdFx0XHRcdHRoaXMuZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy53YXRjaGVkTG9jYXRpb24gJiYgZS5jb250YWlucyh0aGlzLndhdGNoZWRMb2NhdGlvbiwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkpIHtcblx0XHRcdFx0XHRcdHRoaXMub25VcGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy53YXRjaGVyRGlzcG9zYWJsZSA9IGRpc3Bvc2UodGhpcy53YXRjaGVyRGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5maWxlQ2hhbmdlTGlzdGVuZXIgPSBkaXNwb3NlKHRoaXMuZmlsZUNoYW5nZUxpc3RlbmVyKTtcblx0XHR0aGlzLndhdGNoZWRMb2NhdGlvbiA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBfYXBwbHlSdWxlcyhzdHlsZVNoZWV0Q29udGVudDogc3RyaW5nLCBydWxlc0NsYXNzTmFtZTogc3RyaW5nKSB7XG5cdGNvbnN0IHRoZW1lU3R5bGVzID0gbWFpbldpbmRvdy5kb2N1bWVudC5oZWFkLmdldEVsZW1lbnRzQnlDbGFzc05hbWUocnVsZXNDbGFzc05hbWUpO1xuXHRpZiAodGhlbWVTdHlsZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0Y29uc3QgZWxTdHlsZSA9IGNyZWF0ZVN0eWxlU2hlZXQoKTtcblx0XHRlbFN0eWxlLmNsYXNzTmFtZSA9IHJ1bGVzQ2xhc3NOYW1lO1xuXHRcdGVsU3R5bGUudGV4dENvbnRlbnQgPSBzdHlsZVNoZWV0Q29udGVudDtcblx0fSBlbHNlIHtcblx0XHQoPEhUTUxTdHlsZUVsZW1lbnQ+dGhlbWVTdHlsZXNbMF0pLnRleHRDb250ZW50ID0gc3R5bGVTaGVldENvbnRlbnQ7XG5cdH1cbn1cblxucmVnaXN0ZXJDb2xvclRoZW1lU2NoZW1hcygpO1xucmVnaXN0ZXJGaWxlSWNvblRoZW1lU2NoZW1hcygpO1xucmVnaXN0ZXJQcm9kdWN0SWNvblRoZW1lU2NoZW1hcygpO1xuXG4vLyBUaGUgV29ya2JlbmNoVGhlbWVTZXJ2aWNlIHNob3VsZCBzdGF5IGVhZ2VyIGFzIHRoZSBjb25zdHJ1Y3RvciByZXN0b3JlcyB0aGVcbi8vIGxhc3QgdXNlZCBjb2xvcnMgLyBpY29ucyBmcm9tIHN0b3JhZ2UuIFRoaXMgbmVlZHMgdG8gaGFwcGVuIGFzIHF1aWNrbHkgYXMgcG9zc2libGVcbi8vIGZvciBhIGZsaWNrZXItZnJlZSBzdGFydHVwIGV4cGVyaWVuY2UuXG5yZWdpc3RlclNpbmdsZXRvbihJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLCBXb3JrYmVuY2hUaGVtZVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUF1RSxlQUFlLGVBQStELHNCQUFzQixpQ0FBaUMsd0NBQXdDO0FBQzdQLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCO0FBQ3pCLFlBQVksWUFBWTtBQUN4QixTQUFTLHVCQUF1QiwyQkFBMkI7QUFDM0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBc0IsY0FBYyx5QkFBMkM7QUFDL0UsU0FBZ0IsZUFBZTtBQUMvQixTQUFTLG9DQUFvQztBQUM3QyxTQUFzQixTQUFTLGtCQUFrQjtBQUNqRCxTQUFTLG1C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
