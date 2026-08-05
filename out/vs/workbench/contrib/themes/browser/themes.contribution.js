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
import { localize, localize2 } from "../../../../nls.js";
import { KeyMod, KeyChord, KeyCode } from "../../../../base/common/keyCodes.js";
import { MenuRegistry, MenuId, Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IWorkbenchThemeService, ThemeSettings } from "../../../services/themes/common/workbenchThemeService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { IExtensionGalleryService, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { Extensions as ColorRegistryExtensions } from "../../../../platform/theme/common/colorRegistry.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Color } from "../../../../base/common/color.js";
import { ColorScheme, isHighContrast } from "../../../../platform/theme/common/theme.js";
import { colorThemeSchemaId } from "../../../services/themes/common/colorThemeSchema.js";
import { isCancellationError, onUnexpectedError } from "../../../../base/common/errors.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { DEFAULT_PRODUCT_ICON_THEME_ID, ProductIconThemeData } from "../../../services/themes/browser/productIconThemeData.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Emitter } from "../../../../base/common/event.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { FileIconThemeData } from "../../../services/themes/browser/fileIconThemeData.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
const manageExtensionIcon = registerIcon("theme-selection-manage-extension", Codicon.gear, localize("manageExtensionIcon", "Icon for the 'Manage' action in the theme selection quick pick."));
var ConfigureItem = /* @__PURE__ */ ((ConfigureItem2) => {
  ConfigureItem2["BROWSE_GALLERY"] = "marketplace";
  ConfigureItem2["EXTENSIONS_VIEW"] = "extensions";
  ConfigureItem2["CUSTOM_TOP_ENTRY"] = "customTopEntry";
  return ConfigureItem2;
})(ConfigureItem || {});
let MarketplaceThemesPicker = class {
  constructor(getMarketplaceColorThemes, marketplaceQuery, extensionGalleryService, extensionManagementService, quickInputService, logService, progressService, extensionsWorkbenchService, dialogService) {
    this.getMarketplaceColorThemes = getMarketplaceColorThemes;
    this.marketplaceQuery = marketplaceQuery;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionManagementService = extensionManagementService;
    this.quickInputService = quickInputService;
    this.logService = logService;
    this.progressService = progressService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.dialogService = dialogService;
    this._marketplaceExtensions = /* @__PURE__ */ new Set();
    this._marketplaceThemes = [];
    this._searchOngoing = false;
    this._searchError = void 0;
    this._onDidChange = new Emitter();
    this._queryDelayer = new ThrottledDelayer(200);
    this._installedExtensions = extensionManagementService.getInstalled().then((installed) => {
      const result = /* @__PURE__ */ new Set();
      for (const ext of installed) {
        result.add(ext.identifier.id);
      }
      return result;
    });
  }
  get themes() {
    return this._marketplaceThemes;
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  trigger(value) {
    if (this._tokenSource) {
      this._tokenSource.cancel();
      this._tokenSource = void 0;
    }
    this._queryDelayer.trigger(() => {
      this._tokenSource = new CancellationTokenSource();
      return this.doSearch(value, this._tokenSource.token);
    });
  }
  async doSearch(value, token) {
    this._searchOngoing = true;
    this._onDidChange.fire();
    try {
      const installedExtensions = await this._installedExtensions;
      const options = { text: `${this.marketplaceQuery} ${value}`, pageSize: 20 };
      const pager = await this.extensionGalleryService.query(options, token);
      for (let i = 0; i < pager.total && i < 1; i++) {
        if (token.isCancellationRequested) {
          break;
        }
        const nThemes = this._marketplaceThemes.length;
        const gallery = i === 0 ? pager.firstPage : await pager.getPage(i, token);
        const promises = [];
        const promisesGalleries = [];
        for (let i2 = 0; i2 < gallery.length; i2++) {
          if (token.isCancellationRequested) {
            break;
          }
          const ext = gallery[i2];
          if (!installedExtensions.has(ext.identifier.id) && !this._marketplaceExtensions.has(ext.identifier.id)) {
            this._marketplaceExtensions.add(ext.identifier.id);
            promises.push(this.getMarketplaceColorThemes(ext.publisher, ext.name, ext.version));
            promisesGalleries.push(ext);
          }
        }
        const allThemes = await Promise.all(promises);
        for (let i2 = 0; i2 < allThemes.length; i2++) {
          const ext = promisesGalleries[i2];
          for (const theme of allThemes[i2]) {
            this._marketplaceThemes.push({ id: theme.id, theme, label: theme.label, description: `${ext.displayName} \xB7 ${ext.publisherDisplayName}`, galleryExtension: ext, buttons: [configureButton] });
          }
        }
        if (nThemes !== this._marketplaceThemes.length) {
          this._marketplaceThemes.sort((t1, t2) => t1.label.localeCompare(t2.label));
          this._onDidChange.fire();
        }
      }
    } catch (e) {
      if (!isCancellationError(e)) {
        this.logService.error(`Error while searching for themes:`, e);
        this._searchError = "message" in e ? e.message : String(e);
      }
    } finally {
      this._searchOngoing = false;
      this._onDidChange.fire();
    }
  }
  openQuickPick(value, currentTheme, selectTheme) {
    let result = void 0;
    const disposables = new DisposableStore();
    return new Promise((s, _) => {
      const quickpick = disposables.add(this.quickInputService.createQuickPick());
      quickpick.items = [];
      quickpick.sortByLabel = false;
      quickpick.matchOnDescription = true;
      quickpick.buttons = [this.quickInputService.backButton];
      quickpick.title = "Marketplace Themes";
      quickpick.placeholder = localize("themes.selectMarketplaceTheme", "Type to Search More. Select to Install. Up/Down Keys to Preview");
      quickpick.canSelectMany = false;
      disposables.add(quickpick.onDidChangeValue(() => this.trigger(quickpick.value)));
      disposables.add(quickpick.onDidAccept(async (_2) => {
        const themeItem = quickpick.selectedItems[0];
        if (themeItem?.galleryExtension) {
          result = "selected";
          quickpick.hide();
          const success = await this.installExtension(themeItem.galleryExtension);
          if (success) {
            selectTheme(themeItem.theme, true);
          } else {
            selectTheme(currentTheme, true);
          }
        }
      }));
      disposables.add(quickpick.onDidTriggerItemButton((e) => {
        if (isItem(e.item)) {
          const extensionId = e.item.theme?.extensionData?.extensionId;
          if (extensionId) {
            this.extensionsWorkbenchService.openSearch(`@id:${extensionId}`);
          } else {
            this.extensionsWorkbenchService.openSearch(`${this.marketplaceQuery} ${quickpick.value}`);
          }
        }
      }));
      disposables.add(quickpick.onDidChangeActive((themes) => {
        if (result === void 0) {
          selectTheme(themes[0]?.theme, false);
        }
      }));
      disposables.add(quickpick.onDidHide(() => {
        if (result === void 0) {
          selectTheme(currentTheme, true);
          result = "cancelled";
        }
        s(result);
      }));
      disposables.add(quickpick.onDidTriggerButton((e) => {
        if (e === this.quickInputService.backButton) {
          result = "back";
          quickpick.hide();
        }
      }));
      disposables.add(this.onDidChange(() => {
        let items = this.themes;
        if (this._searchOngoing) {
          items = items.concat({ label: "$(loading~spin) Searching for themes...", id: void 0, alwaysShow: true });
        } else if (items.length === 0 && this._searchError) {
          items = [{ label: `$(error) ${localize("search.error", "Error while searching for themes: {0}", this._searchError)}`, id: void 0, alwaysShow: true }];
        }
        const activeItemId = quickpick.activeItems[0]?.id;
        const newActiveItem = activeItemId ? items.find((i) => isItem(i) && i.id === activeItemId) : void 0;
        quickpick.items = items;
        if (newActiveItem) {
          quickpick.activeItems = [newActiveItem];
        }
      }));
      this.trigger(value);
      quickpick.show();
    }).finally(() => {
      disposables.dispose();
    });
  }
  async installExtension(galleryExtension) {
    this.extensionsWorkbenchService.openSearch(`@id:${galleryExtension.identifier.id}`);
    const result = await this.dialogService.confirm({
      message: localize("installExtension.confirm", "This will install extension '{0}' published by '{1}'. Do you want to continue?", galleryExtension.displayName, galleryExtension.publisherDisplayName),
      primaryButton: localize("installExtension.button.ok", "OK")
    });
    if (!result.confirmed) {
      return false;
    }
    try {
      await this.progressService.withProgress({
        location: ProgressLocation.Notification,
        title: localize("installing extensions", "Installing Extension {0}...", galleryExtension.displayName)
      }, async () => {
        await this.extensionManagementService.installFromGallery(galleryExtension, {
          // Setting this to false is how you get the extension to be synced with Settings Sync (if enabled).
          isMachineScoped: false
        });
      });
      return true;
    } catch (e) {
      this.logService.error(`Problem installing extension ${galleryExtension.identifier.id}`, e);
      return false;
    }
  }
  dispose() {
    if (this._tokenSource) {
      this._tokenSource.cancel();
      this._tokenSource = void 0;
    }
    this._queryDelayer.dispose();
    this._marketplaceExtensions.clear();
    this._marketplaceThemes.length = 0;
  }
};
MarketplaceThemesPicker = __decorateClass([
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, IExtensionManagementService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, IExtensionsWorkbenchService),
  __decorateParam(8, IDialogService)
], MarketplaceThemesPicker);
let InstalledThemesPicker = class {
  constructor(options, setTheme, getMarketplaceColorThemes, quickInputService, extensionGalleryService, extensionsWorkbenchService, extensionResourceLoaderService, instantiationService) {
    this.options = options;
    this.setTheme = setTheme;
    this.getMarketplaceColorThemes = getMarketplaceColorThemes;
    this.quickInputService = quickInputService;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionResourceLoaderService = extensionResourceLoaderService;
    this.instantiationService = instantiationService;
  }
  async openQuickPick(picks, currentTheme) {
    let marketplaceThemePicker;
    if (this.extensionGalleryService.isEnabled()) {
      if (await this.extensionResourceLoaderService.supportsExtensionGalleryResources() && this.options.browseMessage) {
        marketplaceThemePicker = this.instantiationService.createInstance(MarketplaceThemesPicker, this.getMarketplaceColorThemes.bind(this), this.options.marketplaceTag);
        picks = [configurationEntry(this.options.browseMessage, "marketplace" /* BROWSE_GALLERY */), ...picks];
      } else {
        picks = [...picks, { type: "separator" }, configurationEntry(this.options.installMessage, "extensions" /* EXTENSIONS_VIEW */)];
      }
    }
    let selectThemeTimeout;
    const selectTheme = (theme, applyTheme) => {
      if (selectThemeTimeout) {
        clearTimeout(selectThemeTimeout);
      }
      selectThemeTimeout = mainWindow.setTimeout(() => {
        selectThemeTimeout = void 0;
        const newTheme = theme ?? currentTheme;
        this.setTheme(newTheme, applyTheme ? "auto" : "preview").then(
          void 0,
          (err) => {
            onUnexpectedError(err);
            this.setTheme(currentTheme, void 0);
          }
        );
      }, applyTheme ? 0 : 200);
    };
    const pickInstalledThemes = (activeItemId) => {
      const disposables = new DisposableStore();
      return new Promise((s, _) => {
        let isCompleted = false;
        const autoFocusIndex = picks.findIndex((p) => isItem(p) && p.id === activeItemId);
        const quickpick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
        quickpick.items = picks;
        quickpick.title = this.options.title;
        quickpick.description = this.options.description;
        quickpick.placeholder = this.options.placeholderMessage;
        quickpick.activeItems = [picks[autoFocusIndex]];
        quickpick.canSelectMany = false;
        quickpick.toggles = this.options.toggles;
        quickpick.toggles?.forEach((toggle) => {
          disposables.add(toggle.onChange(() => this.options.onToggle?.(toggle, quickpick)));
        });
        quickpick.matchOnDescription = true;
        disposables.add(quickpick.onDidAccept(async (_2) => {
          isCompleted = true;
          const theme = quickpick.selectedItems[0];
          if (!theme || theme.configureItem) {
            if (!theme || theme.configureItem === "extensions" /* EXTENSIONS_VIEW */) {
              this.extensionsWorkbenchService.openSearch(`${this.options.marketplaceTag} ${quickpick.value}`);
            } else if (theme.configureItem === "marketplace" /* BROWSE_GALLERY */) {
              if (marketplaceThemePicker) {
                const res = await marketplaceThemePicker.openQuickPick(quickpick.value, currentTheme, selectTheme);
                if (res === "back") {
                  await pickInstalledThemes(void 0);
                }
              }
            }
          } else {
            selectTheme(theme.theme, true);
          }
          quickpick.hide();
          s();
        }));
        disposables.add(quickpick.onDidChangeActive((themes) => selectTheme(themes[0]?.theme, false)));
        disposables.add(quickpick.onDidHide(() => {
          if (!isCompleted) {
            selectTheme(currentTheme, true);
            s();
          }
          quickpick.dispose();
        }));
        disposables.add(quickpick.onDidTriggerItemButton((e) => {
          if (isItem(e.item)) {
            const extensionId = e.item.theme?.extensionData?.extensionId;
            if (extensionId) {
              this.extensionsWorkbenchService.openSearch(`@id:${extensionId}`);
            } else {
              this.extensionsWorkbenchService.openSearch(`${this.options.marketplaceTag} ${quickpick.value}`);
            }
          }
        }));
        quickpick.show();
      }).finally(() => {
        disposables.dispose();
      });
    };
    await pickInstalledThemes(currentTheme.id);
    marketplaceThemePicker?.dispose();
  }
};
InstalledThemesPicker = __decorateClass([
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IExtensionResourceLoaderService),
  __decorateParam(7, IInstantiationService)
], InstalledThemesPicker);
const SelectColorThemeCommandId = "workbench.action.selectTheme";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SelectColorThemeCommandId,
      title: localize2("selectTheme.label", "Color Theme"),
      category: Categories.Preferences,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyT)
      }
    });
  }
  getTitle(colorScheme) {
    switch (colorScheme) {
      case ColorScheme.DARK:
        return localize("themes.selectTheme.darkScheme", "Select Color Theme for System Dark Mode");
      case ColorScheme.LIGHT:
        return localize("themes.selectTheme.lightScheme", "Select Color Theme for System Light Mode");
      case ColorScheme.HIGH_CONTRAST_DARK:
        return localize("themes.selectTheme.darkHC", "Select Color Theme for High Contrast Dark Mode");
      case ColorScheme.HIGH_CONTRAST_LIGHT:
        return localize("themes.selectTheme.lightHC", "Select Color Theme for High Contrast Light Mode");
      default:
        return localize("themes.selectTheme.default", "Select Color Theme (detect system color mode disabled)");
    }
  }
  async run(accessor) {
    const themeService = accessor.get(IWorkbenchThemeService);
    const preferencesService = accessor.get(IPreferencesService);
    const preferredColorScheme = themeService.getPreferredColorScheme();
    let modeConfigureToggle;
    if (preferredColorScheme) {
      modeConfigureToggle = new Toggle({
        title: localize("themes.configure.switchingEnabled", "Detect system color mode enabled. Click to configure."),
        icon: Codicon.colorMode,
        isChecked: false,
        ...defaultToggleStyles
      });
    } else {
      modeConfigureToggle = new Toggle({
        title: localize("themes.configure.switchingDisabled", "Detect system color mode disabled. Click to configure."),
        icon: Codicon.colorMode,
        isChecked: false,
        ...defaultToggleStyles
      });
    }
    const options = {
      installMessage: localize("installColorThemes", "Install Additional Color Themes..."),
      browseMessage: "$(plus) " + localize("browseColorThemes", "Browse Additional Color Themes..."),
      placeholderMessage: this.getTitle(preferredColorScheme),
      marketplaceTag: "category:themes",
      toggles: [modeConfigureToggle],
      onToggle: async (toggle, picker2) => {
        picker2.hide();
        await preferencesService.openSettings({ query: ThemeSettings.DETECT_COLOR_SCHEME });
      }
    };
    const setTheme = (theme, settingsTarget) => themeService.setColorTheme(theme, settingsTarget);
    const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceColorThemes(publisher, name, version);
    const instantiationService = accessor.get(IInstantiationService);
    const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
    const themes = await themeService.getColorThemes();
    const currentTheme = themeService.getColorTheme();
    const lightEntries = toEntries(themes.filter((t) => t.type === ColorScheme.LIGHT), localize("themes.category.light", "light themes"));
    const darkEntries = toEntries(themes.filter((t) => t.type === ColorScheme.DARK), localize("themes.category.dark", "dark themes"));
    const hcEntries = toEntries(themes.filter((t) => isHighContrast(t.type)), localize("themes.category.hc", "high contrast themes"));
    let picks;
    switch (preferredColorScheme) {
      case ColorScheme.DARK:
        picks = [...darkEntries, ...lightEntries, ...hcEntries];
        break;
      case ColorScheme.HIGH_CONTRAST_DARK:
      case ColorScheme.HIGH_CONTRAST_LIGHT:
        picks = [...hcEntries, ...lightEntries, ...darkEntries];
        break;
      case ColorScheme.LIGHT:
      default:
        picks = [...lightEntries, ...darkEntries, ...hcEntries];
        break;
    }
    await picker.openQuickPick(picks, currentTheme);
  }
});
const SelectFileIconThemeCommandId = "workbench.action.selectIconTheme";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SelectFileIconThemeCommandId,
      title: localize2("selectIconTheme.label", "File Icon Theme"),
      category: Categories.Preferences,
      f1: true
    });
  }
  async run(accessor) {
    const themeService = accessor.get(IWorkbenchThemeService);
    const options = {
      installMessage: localize("installIconThemes", "Install Additional File Icon Themes..."),
      placeholderMessage: localize("themes.selectIconTheme", "Select File Icon Theme (Up/Down Keys to Preview)"),
      marketplaceTag: "tag:icon-theme"
    };
    const setTheme = (theme, settingsTarget) => themeService.setFileIconTheme(theme, settingsTarget);
    const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceFileIconThemes(publisher, name, version);
    const instantiationService = accessor.get(IInstantiationService);
    const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
    const picks = [
      { type: "separator", label: localize("fileIconThemeCategory", "file icon themes") },
      { id: "", theme: FileIconThemeData.noIconTheme, label: localize("noIconThemeLabel", "None"), description: localize("noIconThemeDesc", "Disable File Icons") },
      ...toEntries(await themeService.getFileIconThemes())
    ];
    await picker.openQuickPick(picks, themeService.getFileIconTheme());
  }
});
const SelectProductIconThemeCommandId = "workbench.action.selectProductIconTheme";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SelectProductIconThemeCommandId,
      title: localize2("selectProductIconTheme.label", "Product Icon Theme"),
      category: Categories.Preferences,
      f1: true
    });
  }
  async run(accessor) {
    const themeService = accessor.get(IWorkbenchThemeService);
    const options = {
      installMessage: localize("installProductIconThemes", "Install Additional Product Icon Themes..."),
      browseMessage: "$(plus) " + localize("browseProductIconThemes", "Browse Additional Product Icon Themes..."),
      placeholderMessage: localize("themes.selectProductIconTheme", "Select Product Icon Theme (Up/Down Keys to Preview)"),
      marketplaceTag: "tag:product-icon-theme"
    };
    const setTheme = (theme, settingsTarget) => themeService.setProductIconTheme(theme, settingsTarget);
    const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceProductIconThemes(publisher, name, version);
    const instantiationService = accessor.get(IInstantiationService);
    const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
    const picks = [
      { type: "separator", label: localize("productIconThemeCategory", "product icon themes") },
      { id: DEFAULT_PRODUCT_ICON_THEME_ID, theme: ProductIconThemeData.defaultTheme, label: localize("defaultProductIconThemeLabel", "Default") },
      ...toEntries(await themeService.getProductIconThemes())
    ];
    await picker.openQuickPick(picks, themeService.getProductIconTheme());
  }
});
CommandsRegistry.registerCommand("workbench.action.previewColorTheme", async function(accessor, extension, themeSettingsId) {
  const themeService = accessor.get(IWorkbenchThemeService);
  let themes = findBuiltInThemes(await themeService.getColorThemes(), extension);
  if (themes.length === 0) {
    themes = await themeService.getMarketplaceColorThemes(extension.publisher, extension.name, extension.version);
  }
  for (const theme of themes) {
    if (!themeSettingsId || theme.settingsId === themeSettingsId) {
      await themeService.setColorTheme(theme, "preview");
      return theme.settingsId;
    }
  }
  return void 0;
});
function findBuiltInThemes(themes, extension) {
  return themes.filter(({ extensionData }) => extensionData && extensionData.extensionIsBuiltin && equalsIgnoreCase(extensionData.extensionPublisher, extension.publisher) && equalsIgnoreCase(extensionData.extensionName, extension.name));
}
function configurationEntry(label, configureItem) {
  return {
    id: void 0,
    label,
    alwaysShow: true,
    buttons: [configureButton],
    configureItem
  };
}
function isItem(i) {
  return i["type"] !== "separator";
}
function toEntry(theme) {
  const settingId = theme.settingsId ?? void 0;
  const item = {
    id: theme.id,
    theme,
    label: theme.label,
    description: theme.description || (theme.label === settingId ? void 0 : settingId)
  };
  if (theme.extensionData) {
    item.buttons = [configureButton];
  }
  return item;
}
function toEntries(themes, label) {
  const sorter = (t1, t2) => t1.label.localeCompare(t2.label);
  const entries = themes.map(toEntry).sort(sorter);
  if (entries.length > 0 && label) {
    entries.unshift({ type: "separator", label });
  }
  return entries;
}
const configureButton = {
  iconClass: ThemeIcon.asClassName(manageExtensionIcon),
  tooltip: localize("manage extension", "Manage Extension")
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.generateColorTheme",
      title: localize2("generateColorTheme.label", "Generate Color Theme From Current Settings"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const themeService = accessor.get(IWorkbenchThemeService);
    const theme = themeService.getColorTheme();
    const colors = Registry.as(ColorRegistryExtensions.ColorContribution).getColors();
    const colorIds = colors.filter((c) => !c.deprecationMessage).map((c) => c.id).sort();
    const resultingColors = {};
    const inherited = [];
    for (const colorId of colorIds) {
      const color = theme.getColor(colorId, false);
      if (color) {
        resultingColors[colorId] = Color.Format.CSS.formatHexA(color, true);
      } else {
        inherited.push(colorId);
      }
    }
    const nullDefaults = [];
    for (const id of inherited) {
      const color = theme.getColor(id);
      if (color) {
        resultingColors["__" + id] = Color.Format.CSS.formatHexA(color, true);
      } else {
        nullDefaults.push(id);
      }
    }
    for (const id of nullDefaults) {
      resultingColors["__" + id] = null;
    }
    let contents = JSON.stringify({
      "$schema": colorThemeSchemaId,
      type: theme.type,
      colors: resultingColors,
      tokenColors: theme.tokenColors.filter((t) => !!t.scope)
    }, null, "	");
    contents = contents.replace(/\"__/g, '//"');
    const editorService = accessor.get(IEditorService);
    return editorService.openEditor({ resource: void 0, contents, languageId: "jsonc", options: { pinned: true } });
  }
});
const toggleLightDarkThemesCommandId = "workbench.action.toggleLightDarkThemes";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: toggleLightDarkThemesCommandId,
      title: localize2("toggleLightDarkThemes.label", "Toggle between Light/Dark Themes"),
      category: Categories.Preferences,
      f1: true
    });
  }
  async run(accessor) {
    const themeService = accessor.get(IWorkbenchThemeService);
    const configurationService = accessor.get(IConfigurationService);
    const notificationService = accessor.get(INotificationService);
    const preferencesService = accessor.get(IPreferencesService);
    if (configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME)) {
      const message = localize({ key: "cannotToggle", comment: ["{0} is a setting name"] }, "Cannot toggle between light and dark themes when `{0}` is enabled in settings.", ThemeSettings.DETECT_COLOR_SCHEME);
      notificationService.prompt(Severity.Info, message, [
        {
          label: localize("goToSetting", "Open Settings"),
          run: () => {
            return preferencesService.openUserSettings({ query: ThemeSettings.DETECT_COLOR_SCHEME });
          }
        }
      ]);
      return;
    }
    const currentTheme = themeService.getColorTheme();
    let newSettingsId = ThemeSettings.PREFERRED_DARK_THEME;
    switch (currentTheme.type) {
      case ColorScheme.LIGHT:
        newSettingsId = ThemeSettings.PREFERRED_DARK_THEME;
        break;
      case ColorScheme.DARK:
        newSettingsId = ThemeSettings.PREFERRED_LIGHT_THEME;
        break;
      case ColorScheme.HIGH_CONTRAST_LIGHT:
        newSettingsId = ThemeSettings.PREFERRED_HC_DARK_THEME;
        break;
      case ColorScheme.HIGH_CONTRAST_DARK:
        newSettingsId = ThemeSettings.PREFERRED_HC_LIGHT_THEME;
        break;
    }
    const themeSettingId = configurationService.getValue(newSettingsId);
    if (themeSettingId && typeof themeSettingId === "string") {
      const theme = (await themeService.getColorThemes()).find((t) => t.settingsId === themeSettingId);
      if (theme) {
        themeService.setColorTheme(theme.id, "auto");
      }
    }
  }
});
const browseColorThemesInMarketplaceCommandId = "workbench.action.browseColorThemesInMarketplace";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: browseColorThemesInMarketplaceCommandId,
      title: localize2("browseColorThemeInMarketPlace.label", "Browse Color Themes in Marketplace"),
      category: Categories.Preferences,
      f1: true
    });
  }
  async run(accessor) {
    const marketplaceTag = "category:themes";
    const themeService = accessor.get(IWorkbenchThemeService);
    const extensionGalleryService = accessor.get(IExtensionGalleryService);
    const extensionResourceLoaderService = accessor.get(IExtensionResourceLoaderService);
    const instantiationService = accessor.get(IInstantiationService);
    if (!extensionGalleryService.isEnabled() || !await extensionResourceLoaderService.supportsExtensionGalleryResources()) {
      return;
    }
    const currentTheme = themeService.getColorTheme();
    const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceColorThemes(publisher, name, version);
    let selectThemeTimeout;
    const selectTheme = (theme, applyTheme) => {
      if (selectThemeTimeout) {
        clearTimeout(selectThemeTimeout);
      }
      selectThemeTimeout = mainWindow.setTimeout(() => {
        selectThemeTimeout = void 0;
        const newTheme = theme ?? currentTheme;
        themeService.setColorTheme(newTheme, applyTheme ? "auto" : "preview").then(
          void 0,
          (err) => {
            onUnexpectedError(err);
            themeService.setColorTheme(currentTheme, void 0);
          }
        );
      }, applyTheme ? 0 : 200);
    };
    const marketplaceThemePicker = instantiationService.createInstance(MarketplaceThemesPicker, getMarketplaceColorThemes, marketplaceTag);
    await marketplaceThemePicker.openQuickPick("", themeService.getColorTheme(), selectTheme).then(void 0, onUnexpectedError);
  }
});
const ThemesSubMenu = new MenuId("ThemesSubMenu");
MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
  title: localize("themes", "Themes"),
  submenu: ThemesSubMenu,
  group: "2_configuration",
  order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
  title: localize({ key: "miSelectTheme", comment: ["&& denotes a mnemonic"] }, "&&Themes"),
  submenu: ThemesSubMenu,
  group: "2_configuration",
  order: 7
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
  command: {
    id: SelectColorThemeCommandId,
    title: localize("selectTheme.label", "Color Theme")
  },
  order: 1
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
  command: {
    id: SelectFileIconThemeCommandId,
    title: localize("themes.selectIconTheme.label", "File Icon Theme")
  },
  order: 2
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
  command: {
    id: SelectProductIconThemeCommandId,
    title: localize("themes.selectProductIconTheme.label", "Product Icon Theme")
  },
  order: 3
});
export {
  manageExtensionIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90aGVtZXMvYnJvd3Nlci90aGVtZXMuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNob3JkLCBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgTWVudVJlZ2lzdHJ5LCBNZW51SWQsIEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiwgSVN1Ym1lbnVJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBlcXVhbHNJZ25vcmVDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UsIElXb3JrYmVuY2hUaGVtZSwgVGhlbWVTZXR0aW5nVGFyZ2V0LCBJV29ya2JlbmNoQ29sb3JUaGVtZSwgSVdvcmtiZW5jaEZpbGVJY29uVGhlbWUsIElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lLCBUaGVtZVNldHRpbmdzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGhlbWVzL2NvbW1vbi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUdhbGxlcnlFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IElDb2xvclJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbG9yUmVnaXN0cnlFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBDb2xvclNjaGVtZSwgaXNIaWdoQ29udHJhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgY29sb3JUaGVtZVNjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGhlbWVzL2NvbW1vbi9jb2xvclRoZW1lU2NoZW1hLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0QnV0dG9uLCBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja0lucHV0VG9nZ2xlLCBJUXVpY2tQaWNrLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IERFRkFVTFRfUFJPRFVDVF9JQ09OX1RIRU1FX0lELCBQcm9kdWN0SWNvblRoZW1lRGF0YSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RoZW1lcy9icm93c2VyL3Byb2R1Y3RJY29uVGhlbWVEYXRhLmpzJztcbmltcG9ydCB7IFRocm90dGxlZERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvblJlc291cmNlTG9hZGVyL2NvbW1vbi9leHRlbnNpb25SZXNvdXJjZUxvYWRlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRmlsZUljb25UaGVtZURhdGEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90aGVtZXMvYnJvd3Nlci9maWxlSWNvblRoZW1lRGF0YS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5cbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgVG9nZ2xlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RvZ2dsZS90b2dnbGUuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFRvZ2dsZVN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgY29uc3QgbWFuYWdlRXh0ZW5zaW9uSWNvbiA9IHJlZ2lzdGVySWNvbigndGhlbWUtc2VsZWN0aW9uLW1hbmFnZS1leHRlbnNpb24nLCBDb2RpY29uLmdlYXIsIGxvY2FsaXplKCdtYW5hZ2VFeHRlbnNpb25JY29uJywgJ0ljb24gZm9yIHRoZSBcXCdNYW5hZ2VcXCcgYWN0aW9uIGluIHRoZSB0aGVtZSBzZWxlY3Rpb24gcXVpY2sgcGljay4nKSk7XG5cbnR5cGUgUGlja2VyUmVzdWx0ID0gJ2JhY2snIHwgJ3NlbGVjdGVkJyB8ICdjYW5jZWxsZWQnO1xuXG5lbnVtIENvbmZpZ3VyZUl0ZW0ge1xuXHRCUk9XU0VfR0FMTEVSWSA9ICdtYXJrZXRwbGFjZScsXG5cdEVYVEVOU0lPTlNfVklFVyA9ICdleHRlbnNpb25zJyxcblx0Q1VTVE9NX1RPUF9FTlRSWSA9ICdjdXN0b21Ub3BFbnRyeSdcbn1cblxuY2xhc3MgTWFya2V0cGxhY2VUaGVtZXNQaWNrZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnN0YWxsZWRFeHRlbnNpb25zOiBQcm9taXNlPFNldDxzdHJpbmc+Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2V0cGxhY2VFeHRlbnNpb25zOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2V0cGxhY2VUaGVtZXM6IFRoZW1lSXRlbVtdID0gW107XG5cblx0cHJpdmF0ZSBfc2VhcmNoT25nb2luZzogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9zZWFyY2hFcnJvcjogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cblx0cHJpdmF0ZSBfdG9rZW5Tb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9xdWVyeURlbGF5ZXIgPSBuZXcgVGhyb3R0bGVkRGVsYXllcjx2b2lkPigyMDApO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lczogKHB1Ymxpc2hlcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZykgPT4gUHJvbWlzZTxJV29ya2JlbmNoVGhlbWVbXT4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYXJrZXRwbGFjZVF1ZXJ5OiBzdHJpbmcsXG5cblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9pbnN0YWxsZWRFeHRlbnNpb25zID0gZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCkudGhlbihpbnN0YWxsZWQgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dCBvZiBpbnN0YWxsZWQpIHtcblx0XHRcdFx0cmVzdWx0LmFkZChleHQuaWRlbnRpZmllci5pZCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldCB0aGVtZXMoKTogVGhlbWVJdGVtW10ge1xuXHRcdHJldHVybiB0aGlzLl9tYXJrZXRwbGFjZVRoZW1lcztcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25EaWRDaGFuZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIHRyaWdnZXIodmFsdWU6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl90b2tlblNvdXJjZSkge1xuXHRcdFx0dGhpcy5fdG9rZW5Tb3VyY2UuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl90b2tlblNvdXJjZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5fcXVlcnlEZWxheWVyLnRyaWdnZXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdHJldHVybiB0aGlzLmRvU2VhcmNoKHZhbHVlLCB0aGlzLl90b2tlblNvdXJjZS50b2tlbik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvU2VhcmNoKHZhbHVlOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3NlYXJjaE9uZ29pbmcgPSB0cnVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuX2luc3RhbGxlZEV4dGVuc2lvbnM7XG5cblx0XHRcdGNvbnN0IG9wdGlvbnMgPSB7IHRleHQ6IGAke3RoaXMubWFya2V0cGxhY2VRdWVyeX0gJHt2YWx1ZX1gLCBwYWdlU2l6ZTogMjAgfTtcblx0XHRcdGNvbnN0IHBhZ2VyID0gYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5xdWVyeShvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHBhZ2VyLnRvdGFsICYmIGkgPCAxOyBpKyspIHsgLy8gbG9hZGluZyBtdWx0aXBsZSBwYWdlcyBpcyB0dXJuZWQgb2YgZm9yIG5vdyB0byBhdm9pZCBmbGlja2VyaW5nXG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgblRoZW1lcyA9IHRoaXMuX21hcmtldHBsYWNlVGhlbWVzLmxlbmd0aDtcblx0XHRcdFx0Y29uc3QgZ2FsbGVyeSA9IGkgPT09IDAgPyBwYWdlci5maXJzdFBhZ2UgOiBhd2FpdCBwYWdlci5nZXRQYWdlKGksIHRva2VuKTtcblxuXHRcdFx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxJV29ya2JlbmNoVGhlbWVbXT5bXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBwcm9taXNlc0dhbGxlcmllcyA9IFtdO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGdhbGxlcnkubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBleHQgPSBnYWxsZXJ5W2ldO1xuXHRcdFx0XHRcdGlmICghaW5zdGFsbGVkRXh0ZW5zaW9ucy5oYXMoZXh0LmlkZW50aWZpZXIuaWQpICYmICF0aGlzLl9tYXJrZXRwbGFjZUV4dGVuc2lvbnMuaGFzKGV4dC5pZGVudGlmaWVyLmlkKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fbWFya2V0cGxhY2VFeHRlbnNpb25zLmFkZChleHQuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKHRoaXMuZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lcyhleHQucHVibGlzaGVyLCBleHQubmFtZSwgZXh0LnZlcnNpb24pKTtcblx0XHRcdFx0XHRcdHByb21pc2VzR2FsbGVyaWVzLnB1c2goZXh0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgYWxsVGhlbWVzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFsbFRoZW1lcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGV4dCA9IHByb21pc2VzR2FsbGVyaWVzW2ldO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdGhlbWUgb2YgYWxsVGhlbWVzW2ldKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9tYXJrZXRwbGFjZVRoZW1lcy5wdXNoKHsgaWQ6IHRoZW1lLmlkLCB0aGVtZTogdGhlbWUsIGxhYmVsOiB0aGVtZS5sYWJlbCwgZGVzY3JpcHRpb246IGAke2V4dC5kaXNwbGF5TmFtZX0gXHUwMEI3ICR7ZXh0LnB1Ymxpc2hlckRpc3BsYXlOYW1lfWAsIGdhbGxlcnlFeHRlbnNpb246IGV4dCwgYnV0dG9uczogW2NvbmZpZ3VyZUJ1dHRvbl0gfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG5UaGVtZXMgIT09IHRoaXMuX21hcmtldHBsYWNlVGhlbWVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuX21hcmtldHBsYWNlVGhlbWVzLnNvcnQoKHQxLCB0MikgPT4gdDEubGFiZWwubG9jYWxlQ29tcGFyZSh0Mi5sYWJlbCkpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHdoaWxlIHNlYXJjaGluZyBmb3IgdGhlbWVzOmAsIGUpO1xuXHRcdFx0XHR0aGlzLl9zZWFyY2hFcnJvciA9ICdtZXNzYWdlJyBpbiBlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9zZWFyY2hPbmdvaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0fVxuXG5cdH1cblxuXHRwdWJsaWMgb3BlblF1aWNrUGljayh2YWx1ZTogc3RyaW5nLCBjdXJyZW50VGhlbWU6IElXb3JrYmVuY2hUaGVtZSB8IHVuZGVmaW5lZCwgc2VsZWN0VGhlbWU6ICh0aGVtZTogSVdvcmtiZW5jaFRoZW1lIHwgdW5kZWZpbmVkLCBhcHBseVRoZW1lOiBib29sZWFuKSA9PiB2b2lkKTogUHJvbWlzZTxQaWNrZXJSZXN1bHQ+IHtcblx0XHRsZXQgcmVzdWx0OiBQaWNrZXJSZXN1bHQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPFBpY2tlclJlc3VsdD4oKHMsIF8pID0+IHtcblx0XHRcdGNvbnN0IHF1aWNrcGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxUaGVtZUl0ZW0+KCkpO1xuXHRcdFx0cXVpY2twaWNrLml0ZW1zID0gW107XG5cdFx0XHRxdWlja3BpY2suc29ydEJ5TGFiZWwgPSBmYWxzZTtcblx0XHRcdHF1aWNrcGljay5tYXRjaE9uRGVzY3JpcHRpb24gPSB0cnVlO1xuXHRcdFx0cXVpY2twaWNrLmJ1dHRvbnMgPSBbdGhpcy5xdWlja0lucHV0U2VydmljZS5iYWNrQnV0dG9uXTtcblx0XHRcdHF1aWNrcGljay50aXRsZSA9ICdNYXJrZXRwbGFjZSBUaGVtZXMnO1xuXHRcdFx0cXVpY2twaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3RoZW1lcy5zZWxlY3RNYXJrZXRwbGFjZVRoZW1lJywgXCJUeXBlIHRvIFNlYXJjaCBNb3JlLiBTZWxlY3QgdG8gSW5zdGFsbC4gVXAvRG93biBLZXlzIHRvIFByZXZpZXdcIik7XG5cdFx0XHRxdWlja3BpY2suY2FuU2VsZWN0TWFueSA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZENoYW5nZVZhbHVlKCgpID0+IHRoaXMudHJpZ2dlcihxdWlja3BpY2sudmFsdWUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2twaWNrLm9uRGlkQWNjZXB0KGFzeW5jIF8gPT4ge1xuXHRcdFx0XHRjb25zdCB0aGVtZUl0ZW0gPSBxdWlja3BpY2suc2VsZWN0ZWRJdGVtc1swXTtcblx0XHRcdFx0aWYgKHRoZW1lSXRlbT8uZ2FsbGVyeUV4dGVuc2lvbikge1xuXHRcdFx0XHRcdHJlc3VsdCA9ICdzZWxlY3RlZCc7XG5cdFx0XHRcdFx0cXVpY2twaWNrLmhpZGUoKTtcblx0XHRcdFx0XHRjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5pbnN0YWxsRXh0ZW5zaW9uKHRoZW1lSXRlbS5nYWxsZXJ5RXh0ZW5zaW9uKTtcblx0XHRcdFx0XHRpZiAoc3VjY2Vzcykge1xuXHRcdFx0XHRcdFx0c2VsZWN0VGhlbWUodGhlbWVJdGVtLnRoZW1lLCB0cnVlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c2VsZWN0VGhlbWUoY3VycmVudFRoZW1lLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoaXNJdGVtKGUuaXRlbSkpIHtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25JZCA9IGUuaXRlbS50aGVtZT8uZXh0ZW5zaW9uRGF0YT8uZXh0ZW5zaW9uSWQ7XG5cdFx0XHRcdFx0aWYgKGV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYEBpZDoke2V4dGVuc2lvbklkfWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYCR7dGhpcy5tYXJrZXRwbGFjZVF1ZXJ5fSAke3F1aWNrcGljay52YWx1ZX1gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRDaGFuZ2VBY3RpdmUodGhlbWVzID0+IHtcblx0XHRcdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0c2VsZWN0VGhlbWUodGhlbWVzWzBdPy50aGVtZSwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0c2VsZWN0VGhlbWUoY3VycmVudFRoZW1lLCB0cnVlKTtcblx0XHRcdFx0XHRyZXN1bHQgPSAnY2FuY2VsbGVkJztcblxuXHRcdFx0XHR9XG5cdFx0XHRcdHMocmVzdWx0KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZFRyaWdnZXJCdXR0b24oZSA9PiB7XG5cdFx0XHRcdGlmIChlID09PSB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmJhY2tCdXR0b24pIHtcblx0XHRcdFx0XHRyZXN1bHQgPSAnYmFjayc7XG5cdFx0XHRcdFx0cXVpY2twaWNrLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdGxldCBpdGVtcyA9IHRoaXMudGhlbWVzO1xuXHRcdFx0XHRpZiAodGhpcy5fc2VhcmNoT25nb2luZykge1xuXHRcdFx0XHRcdGl0ZW1zID0gaXRlbXMuY29uY2F0KHsgbGFiZWw6ICckKGxvYWRpbmd+c3BpbikgU2VhcmNoaW5nIGZvciB0aGVtZXMuLi4nLCBpZDogdW5kZWZpbmVkLCBhbHdheXNTaG93OiB0cnVlIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCAmJiB0aGlzLl9zZWFyY2hFcnJvcikge1xuXHRcdFx0XHRcdGl0ZW1zID0gW3sgbGFiZWw6IGAkKGVycm9yKSAke2xvY2FsaXplKCdzZWFyY2guZXJyb3InLCAnRXJyb3Igd2hpbGUgc2VhcmNoaW5nIGZvciB0aGVtZXM6IHswfScsIHRoaXMuX3NlYXJjaEVycm9yKX1gLCBpZDogdW5kZWZpbmVkLCBhbHdheXNTaG93OiB0cnVlIH1dO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUl0ZW1JZCA9IHF1aWNrcGljay5hY3RpdmVJdGVtc1swXT8uaWQ7XG5cdFx0XHRcdGNvbnN0IG5ld0FjdGl2ZUl0ZW0gPSBhY3RpdmVJdGVtSWQgPyBpdGVtcy5maW5kKGkgPT4gaXNJdGVtKGkpICYmIGkuaWQgPT09IGFjdGl2ZUl0ZW1JZCkgOiB1bmRlZmluZWQ7XG5cblx0XHRcdFx0cXVpY2twaWNrLml0ZW1zID0gaXRlbXM7XG5cdFx0XHRcdGlmIChuZXdBY3RpdmVJdGVtKSB7XG5cdFx0XHRcdFx0cXVpY2twaWNrLmFjdGl2ZUl0ZW1zID0gW25ld0FjdGl2ZUl0ZW0gYXMgVGhlbWVJdGVtXTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy50cmlnZ2VyKHZhbHVlKTtcblx0XHRcdHF1aWNrcGljay5zaG93KCk7XG5cdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxFeHRlbnNpb24oZ2FsbGVyeUV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24pIHtcblx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYEBpZDoke2dhbGxlcnlFeHRlbnNpb24uaWRlbnRpZmllci5pZH1gKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvbi5jb25maXJtJywgXCJUaGlzIHdpbGwgaW5zdGFsbCBleHRlbnNpb24gJ3swfScgcHVibGlzaGVkIGJ5ICd7MX0nLiBEbyB5b3Ugd2FudCB0byBjb250aW51ZT9cIiwgZ2FsbGVyeUV4dGVuc2lvbi5kaXNwbGF5TmFtZSwgZ2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSksXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvbi5idXR0b24ub2snLCBcIk9LXCIpXG5cdFx0fSk7XG5cdFx0aWYgKCFyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW5zdGFsbGluZyBleHRlbnNpb25zJywgXCJJbnN0YWxsaW5nIEV4dGVuc2lvbiB7MH0uLi5cIiwgZ2FsbGVyeUV4dGVuc2lvbi5kaXNwbGF5TmFtZSlcblx0XHRcdH0sIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsRnJvbUdhbGxlcnkoZ2FsbGVyeUV4dGVuc2lvbiwge1xuXHRcdFx0XHRcdC8vIFNldHRpbmcgdGhpcyB0byBmYWxzZSBpcyBob3cgeW91IGdldCB0aGUgZXh0ZW5zaW9uIHRvIGJlIHN5bmNlZCB3aXRoIFNldHRpbmdzIFN5bmMgKGlmIGVuYWJsZWQpLlxuXHRcdFx0XHRcdGlzTWFjaGluZVNjb3BlZDogZmFsc2UsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFByb2JsZW0gaW5zdGFsbGluZyBleHRlbnNpb24gJHtnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9YCwgZSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblxuXHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHRpZiAodGhpcy5fdG9rZW5Tb3VyY2UpIHtcblx0XHRcdHRoaXMuX3Rva2VuU291cmNlLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fdG9rZW5Tb3VyY2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMuX3F1ZXJ5RGVsYXllci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fbWFya2V0cGxhY2VFeHRlbnNpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy5fbWFya2V0cGxhY2VUaGVtZXMubGVuZ3RoID0gMDtcblx0fVxufVxuXG5pbnRlcmZhY2UgSW5zdGFsbGVkVGhlbWVzUGlja2VyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGluc3RhbGxNZXNzYWdlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGJyb3dzZU1lc3NhZ2U/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBsYWNlaG9sZGVyTWVzc2FnZTogc3RyaW5nO1xuXHRyZWFkb25seSBtYXJrZXRwbGFjZVRhZzogc3RyaW5nO1xuXHRyZWFkb25seSB0aXRsZT86IHN0cmluZztcblx0cmVhZG9ubHkgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHRvZ2dsZXM/OiBJUXVpY2tJbnB1dFRvZ2dsZVtdO1xuXHRyZWFkb25seSBvblRvZ2dsZT86ICh0b2dnbGU6IElRdWlja0lucHV0VG9nZ2xlLCBxdWlja0lucHV0OiBJUXVpY2tQaWNrPFRoZW1lSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiBib29sZWFuIH0+KSA9PiBQcm9taXNlPHZvaWQ+O1xufVxuXG5jbGFzcyBJbnN0YWxsZWRUaGVtZXNQaWNrZXIge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IEluc3RhbGxlZFRoZW1lc1BpY2tlck9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzZXRUaGVtZTogKHRoZW1lOiBJV29ya2JlbmNoVGhlbWUgfCB1bmRlZmluZWQsIHNldHRpbmdzVGFyZ2V0OiBUaGVtZVNldHRpbmdUYXJnZXQpID0+IFByb21pc2U8YW55Pixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXM6IChwdWJsaXNoZXI6IHN0cmluZywgbmFtZTogc3RyaW5nLCB2ZXJzaW9uOiBzdHJpbmcpID0+IFByb21pc2U8SVdvcmtiZW5jaFRoZW1lW10+LFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0cHVibGljIGFzeW5jIG9wZW5RdWlja1BpY2socGlja3M6IFF1aWNrUGlja0lucHV0PFRoZW1lSXRlbT5bXSwgY3VycmVudFRoZW1lOiBJV29ya2JlbmNoVGhlbWUpIHtcblxuXHRcdGxldCBtYXJrZXRwbGFjZVRoZW1lUGlja2VyOiBNYXJrZXRwbGFjZVRoZW1lc1BpY2tlciB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLnN1cHBvcnRzRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlcygpICYmIHRoaXMub3B0aW9ucy5icm93c2VNZXNzYWdlKSB7XG5cdFx0XHRcdG1hcmtldHBsYWNlVGhlbWVQaWNrZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtldHBsYWNlVGhlbWVzUGlja2VyLCB0aGlzLmdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXMuYmluZCh0aGlzKSwgdGhpcy5vcHRpb25zLm1hcmtldHBsYWNlVGFnKTtcblx0XHRcdFx0cGlja3MgPSBbY29uZmlndXJhdGlvbkVudHJ5KHRoaXMub3B0aW9ucy5icm93c2VNZXNzYWdlLCBDb25maWd1cmVJdGVtLkJST1dTRV9HQUxMRVJZKSwgLi4ucGlja3NdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGlja3MgPSBbLi4ucGlja3MsIHsgdHlwZTogJ3NlcGFyYXRvcicgfSwgY29uZmlndXJhdGlvbkVudHJ5KHRoaXMub3B0aW9ucy5pbnN0YWxsTWVzc2FnZSwgQ29uZmlndXJlSXRlbS5FWFRFTlNJT05TX1ZJRVcpXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgc2VsZWN0VGhlbWVUaW1lb3V0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBzZWxlY3RUaGVtZSA9ICh0aGVtZTogSVdvcmtiZW5jaFRoZW1lIHwgdW5kZWZpbmVkLCBhcHBseVRoZW1lOiBib29sZWFuKSA9PiB7XG5cdFx0XHRpZiAoc2VsZWN0VGhlbWVUaW1lb3V0KSB7XG5cdFx0XHRcdGNsZWFyVGltZW91dChzZWxlY3RUaGVtZVRpbWVvdXQpO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0VGhlbWVUaW1lb3V0ID0gbWFpbldpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0c2VsZWN0VGhlbWVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBuZXdUaGVtZSA9ICh0aGVtZSA/PyBjdXJyZW50VGhlbWUpIGFzIElXb3JrYmVuY2hUaGVtZTtcblx0XHRcdFx0dGhpcy5zZXRUaGVtZShuZXdUaGVtZSwgYXBwbHlUaGVtZSA/ICdhdXRvJyA6ICdwcmV2aWV3JykudGhlbih1bmRlZmluZWQsXG5cdFx0XHRcdFx0ZXJyID0+IHtcblx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHRcdFx0XHR0aGlzLnNldFRoZW1lKGN1cnJlbnRUaGVtZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9LCBhcHBseVRoZW1lID8gMCA6IDIwMCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHBpY2tJbnN0YWxsZWRUaGVtZXMgPSAoYWN0aXZlSXRlbUlkOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChzLCBfKSA9PiB7XG5cdFx0XHRcdGxldCBpc0NvbXBsZXRlZCA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBhdXRvRm9jdXNJbmRleCA9IHBpY2tzLmZpbmRJbmRleChwID0+IGlzSXRlbShwKSAmJiBwLmlkID09PSBhY3RpdmVJdGVtSWQpO1xuXHRcdFx0XHRjb25zdCBxdWlja3BpY2sgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8VGhlbWVJdGVtPih7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSkpO1xuXHRcdFx0XHRxdWlja3BpY2suaXRlbXMgPSBwaWNrcztcblx0XHRcdFx0cXVpY2twaWNrLnRpdGxlID0gdGhpcy5vcHRpb25zLnRpdGxlO1xuXHRcdFx0XHRxdWlja3BpY2suZGVzY3JpcHRpb24gPSB0aGlzLm9wdGlvbnMuZGVzY3JpcHRpb247XG5cdFx0XHRcdHF1aWNrcGljay5wbGFjZWhvbGRlciA9IHRoaXMub3B0aW9ucy5wbGFjZWhvbGRlck1lc3NhZ2U7XG5cdFx0XHRcdHF1aWNrcGljay5hY3RpdmVJdGVtcyA9IFtwaWNrc1thdXRvRm9jdXNJbmRleF0gYXMgVGhlbWVJdGVtXTtcblx0XHRcdFx0cXVpY2twaWNrLmNhblNlbGVjdE1hbnkgPSBmYWxzZTtcblx0XHRcdFx0cXVpY2twaWNrLnRvZ2dsZXMgPSB0aGlzLm9wdGlvbnMudG9nZ2xlcztcblx0XHRcdFx0cXVpY2twaWNrLnRvZ2dsZXM/LmZvckVhY2godG9nZ2xlID0+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9nZ2xlLm9uQ2hhbmdlKCgpID0+IHRoaXMub3B0aW9ucy5vblRvZ2dsZT8uKHRvZ2dsZSwgcXVpY2twaWNrKSkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cXVpY2twaWNrLm1hdGNoT25EZXNjcmlwdGlvbiA9IHRydWU7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRBY2NlcHQoYXN5bmMgXyA9PiB7XG5cdFx0XHRcdFx0aXNDb21wbGV0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGNvbnN0IHRoZW1lID0gcXVpY2twaWNrLnNlbGVjdGVkSXRlbXNbMF07XG5cdFx0XHRcdFx0aWYgKCF0aGVtZSB8fCB0aGVtZS5jb25maWd1cmVJdGVtKSB7IC8vICdwaWNrIGluIG1hcmtldHBsYWNlJyBlbnRyeVxuXHRcdFx0XHRcdFx0aWYgKCF0aGVtZSB8fCB0aGVtZS5jb25maWd1cmVJdGVtID09PSBDb25maWd1cmVJdGVtLkVYVEVOU0lPTlNfVklFVykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYCR7dGhpcy5vcHRpb25zLm1hcmtldHBsYWNlVGFnfSAke3F1aWNrcGljay52YWx1ZX1gKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodGhlbWUuY29uZmlndXJlSXRlbSA9PT0gQ29uZmlndXJlSXRlbS5CUk9XU0VfR0FMTEVSWSkge1xuXHRcdFx0XHRcdFx0XHRpZiAobWFya2V0cGxhY2VUaGVtZVBpY2tlcikge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJlcyA9IGF3YWl0IG1hcmtldHBsYWNlVGhlbWVQaWNrZXIub3BlblF1aWNrUGljayhxdWlja3BpY2sudmFsdWUsIGN1cnJlbnRUaGVtZSwgc2VsZWN0VGhlbWUpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChyZXMgPT09ICdiYWNrJykge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgcGlja0luc3RhbGxlZFRoZW1lcyh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzZWxlY3RUaGVtZSh0aGVtZS50aGVtZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cXVpY2twaWNrLmhpZGUoKTtcblx0XHRcdFx0XHRzKCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZENoYW5nZUFjdGl2ZSh0aGVtZXMgPT4gc2VsZWN0VGhlbWUodGhlbWVzWzBdPy50aGVtZSwgZmFsc2UpKSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0XHRpZiAoIWlzQ29tcGxldGVkKSB7XG5cdFx0XHRcdFx0XHRzZWxlY3RUaGVtZShjdXJyZW50VGhlbWUsIHRydWUpO1xuXHRcdFx0XHRcdFx0cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRxdWlja3BpY2suZGlzcG9zZSgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRUcmlnZ2VySXRlbUJ1dHRvbihlID0+IHtcblx0XHRcdFx0XHRpZiAoaXNJdGVtKGUuaXRlbSkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZS5pdGVtLnRoZW1lPy5leHRlbnNpb25EYXRhPy5leHRlbnNpb25JZDtcblx0XHRcdFx0XHRcdGlmIChleHRlbnNpb25JZCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYEBpZDoke2V4dGVuc2lvbklkfWApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKGAke3RoaXMub3B0aW9ucy5tYXJrZXRwbGFjZVRhZ30gJHtxdWlja3BpY2sudmFsdWV9YCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHF1aWNrcGljay5zaG93KCk7XG5cdFx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblx0XHRhd2FpdCBwaWNrSW5zdGFsbGVkVGhlbWVzKGN1cnJlbnRUaGVtZS5pZCk7XG5cblx0XHRtYXJrZXRwbGFjZVRoZW1lUGlja2VyPy5kaXNwb3NlKCk7XG5cblx0fVxufVxuXG5jb25zdCBTZWxlY3RDb2xvclRoZW1lQ29tbWFuZElkID0gJ3dvcmtiZW5jaC5hY3Rpb24uc2VsZWN0VGhlbWUnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VsZWN0Q29sb3JUaGVtZUNvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlbGVjdFRoZW1lLmxhYmVsJywgJ0NvbG9yIFRoZW1lJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5QcmVmZXJlbmNlcyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlUKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUaXRsZShjb2xvclNjaGVtZTogQ29sb3JTY2hlbWUgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAoY29sb3JTY2hlbWUpIHtcblx0XHRcdGNhc2UgQ29sb3JTY2hlbWUuREFSSzogcmV0dXJuIGxvY2FsaXplKCd0aGVtZXMuc2VsZWN0VGhlbWUuZGFya1NjaGVtZScsIFwiU2VsZWN0IENvbG9yIFRoZW1lIGZvciBTeXN0ZW0gRGFyayBNb2RlXCIpO1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5MSUdIVDogcmV0dXJuIGxvY2FsaXplKCd0aGVtZXMuc2VsZWN0VGhlbWUubGlnaHRTY2hlbWUnLCBcIlNlbGVjdCBDb2xvciBUaGVtZSBmb3IgU3lzdGVtIExpZ2h0IE1vZGVcIik7XG5cdFx0XHRjYXNlIENvbG9yU2NoZW1lLkhJR0hfQ09OVFJBU1RfREFSSzogcmV0dXJuIGxvY2FsaXplKCd0aGVtZXMuc2VsZWN0VGhlbWUuZGFya0hDJywgXCJTZWxlY3QgQ29sb3IgVGhlbWUgZm9yIEhpZ2ggQ29udHJhc3QgRGFyayBNb2RlXCIpO1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0xJR0hUOiByZXR1cm4gbG9jYWxpemUoJ3RoZW1lcy5zZWxlY3RUaGVtZS5saWdodEhDJywgXCJTZWxlY3QgQ29sb3IgVGhlbWUgZm9yIEhpZ2ggQ29udHJhc3QgTGlnaHQgTW9kZVwiKTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndGhlbWVzLnNlbGVjdFRoZW1lLmRlZmF1bHQnLCBcIlNlbGVjdCBDb2xvciBUaGVtZSAoZGV0ZWN0IHN5c3RlbSBjb2xvciBtb2RlIGRpc2FibGVkKVwiKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB0aGVtZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaFRoZW1lU2VydmljZSk7XG5cdFx0Y29uc3QgcHJlZmVyZW5jZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcHJlZmVycmVkQ29sb3JTY2hlbWUgPSB0aGVtZVNlcnZpY2UuZ2V0UHJlZmVycmVkQ29sb3JTY2hlbWUoKTtcblxuXHRcdGxldCBtb2RlQ29uZmlndXJlVG9nZ2xlO1xuXHRcdGlmIChwcmVmZXJyZWRDb2xvclNjaGVtZSkge1xuXHRcdFx0bW9kZUNvbmZpZ3VyZVRvZ2dsZSA9IG5ldyBUb2dnbGUoe1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3RoZW1lcy5jb25maWd1cmUuc3dpdGNoaW5nRW5hYmxlZCcsICdEZXRlY3Qgc3lzdGVtIGNvbG9yIG1vZGUgZW5hYmxlZC4gQ2xpY2sgdG8gY29uZmlndXJlLicpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNvbG9yTW9kZSxcblx0XHRcdFx0aXNDaGVja2VkOiBmYWxzZSxcblx0XHRcdFx0Li4uZGVmYXVsdFRvZ2dsZVN0eWxlc1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1vZGVDb25maWd1cmVUb2dnbGUgPSBuZXcgVG9nZ2xlKHtcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0aGVtZXMuY29uZmlndXJlLnN3aXRjaGluZ0Rpc2FibGVkJywgJ0RldGVjdCBzeXN0ZW0gY29sb3IgbW9kZSBkaXNhYmxlZC4gQ2xpY2sgdG8gY29uZmlndXJlLicpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNvbG9yTW9kZSxcblx0XHRcdFx0aXNDaGVja2VkOiBmYWxzZSxcblx0XHRcdFx0Li4uZGVmYXVsdFRvZ2dsZVN0eWxlc1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdGluc3RhbGxNZXNzYWdlOiBsb2NhbGl6ZSgnaW5zdGFsbENvbG9yVGhlbWVzJywgXCJJbnN0YWxsIEFkZGl0aW9uYWwgQ29sb3IgVGhlbWVzLi4uXCIpLFxuXHRcdFx0YnJvd3NlTWVzc2FnZTogJyQocGx1cykgJyArIGxvY2FsaXplKCdicm93c2VDb2xvclRoZW1lcycsIFwiQnJvd3NlIEFkZGl0aW9uYWwgQ29sb3IgVGhlbWVzLi4uXCIpLFxuXHRcdFx0cGxhY2Vob2xkZXJNZXNzYWdlOiB0aGlzLmdldFRpdGxlKHByZWZlcnJlZENvbG9yU2NoZW1lKSxcblx0XHRcdG1hcmtldHBsYWNlVGFnOiAnY2F0ZWdvcnk6dGhlbWVzJyxcblx0XHRcdHRvZ2dsZXM6IFttb2RlQ29uZmlndXJlVG9nZ2xlXSxcblx0XHRcdG9uVG9nZ2xlOiBhc3luYyAodG9nZ2xlLCBwaWNrZXIpID0+IHtcblx0XHRcdFx0cGlja2VyLmhpZGUoKTtcblx0XHRcdFx0YXdhaXQgcHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5TZXR0aW5ncyh7IHF1ZXJ5OiBUaGVtZVNldHRpbmdzLkRFVEVDVF9DT0xPUl9TQ0hFTUUgfSk7XG5cdFx0XHR9XG5cdFx0fSBzYXRpc2ZpZXMgSW5zdGFsbGVkVGhlbWVzUGlja2VyT3B0aW9ucztcblx0XHRjb25zdCBzZXRUaGVtZSA9ICh0aGVtZTogSVdvcmtiZW5jaFRoZW1lIHwgdW5kZWZpbmVkLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KSA9PiB0aGVtZVNlcnZpY2Uuc2V0Q29sb3JUaGVtZSh0aGVtZSBhcyBJV29ya2JlbmNoQ29sb3JUaGVtZSwgc2V0dGluZ3NUYXJnZXQpO1xuXHRcdGNvbnN0IGdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXMgPSAocHVibGlzaGVyOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKSA9PiB0aGVtZVNlcnZpY2UuZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lcyhwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24pO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBwaWNrZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsZWRUaGVtZXNQaWNrZXIsIG9wdGlvbnMsIHNldFRoZW1lLCBnZXRNYXJrZXRwbGFjZUNvbG9yVGhlbWVzKTtcblxuXHRcdGNvbnN0IHRoZW1lcyA9IGF3YWl0IHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lcygpO1xuXHRcdGNvbnN0IGN1cnJlbnRUaGVtZSA9IHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cblx0XHRjb25zdCBsaWdodEVudHJpZXMgPSB0b0VudHJpZXModGhlbWVzLmZpbHRlcih0ID0+IHQudHlwZSA9PT0gQ29sb3JTY2hlbWUuTElHSFQpLCBsb2NhbGl6ZSgndGhlbWVzLmNhdGVnb3J5LmxpZ2h0JywgXCJsaWdodCB0aGVtZXNcIikpO1xuXHRcdGNvbnN0IGRhcmtFbnRyaWVzID0gdG9FbnRyaWVzKHRoZW1lcy5maWx0ZXIodCA9PiB0LnR5cGUgPT09IENvbG9yU2NoZW1lLkRBUkspLCBsb2NhbGl6ZSgndGhlbWVzLmNhdGVnb3J5LmRhcmsnLCBcImRhcmsgdGhlbWVzXCIpKTtcblx0XHRjb25zdCBoY0VudHJpZXMgPSB0b0VudHJpZXModGhlbWVzLmZpbHRlcih0ID0+IGlzSGlnaENvbnRyYXN0KHQudHlwZSkpLCBsb2NhbGl6ZSgndGhlbWVzLmNhdGVnb3J5LmhjJywgXCJoaWdoIGNvbnRyYXN0IHRoZW1lc1wiKSk7XG5cblx0XHRsZXQgcGlja3M7XG5cdFx0c3dpdGNoIChwcmVmZXJyZWRDb2xvclNjaGVtZSkge1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5EQVJLOlxuXHRcdFx0XHRwaWNrcyA9IFsuLi5kYXJrRW50cmllcywgLi4ubGlnaHRFbnRyaWVzLCAuLi5oY0VudHJpZXNdO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9EQVJLOlxuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0xJR0hUOlxuXHRcdFx0XHRwaWNrcyA9IFsuLi5oY0VudHJpZXMsIC4uLmxpZ2h0RW50cmllcywgLi4uZGFya0VudHJpZXNdO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29sb3JTY2hlbWUuTElHSFQ6XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRwaWNrcyA9IFsuLi5saWdodEVudHJpZXMsIC4uLmRhcmtFbnRyaWVzLCAuLi5oY0VudHJpZXNdO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0YXdhaXQgcGlja2VyLm9wZW5RdWlja1BpY2socGlja3MsIGN1cnJlbnRUaGVtZSk7XG5cblx0fVxufSk7XG5cbmNvbnN0IFNlbGVjdEZpbGVJY29uVGhlbWVDb21tYW5kSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5zZWxlY3RJY29uVGhlbWUnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VsZWN0RmlsZUljb25UaGVtZUNvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlbGVjdEljb25UaGVtZS5sYWJlbCcsICdGaWxlIEljb24gVGhlbWUnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlByZWZlcmVuY2VzLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IHRoZW1lU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoVGhlbWVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRpbnN0YWxsTWVzc2FnZTogbG9jYWxpemUoJ2luc3RhbGxJY29uVGhlbWVzJywgXCJJbnN0YWxsIEFkZGl0aW9uYWwgRmlsZSBJY29uIFRoZW1lcy4uLlwiKSxcblx0XHRcdHBsYWNlaG9sZGVyTWVzc2FnZTogbG9jYWxpemUoJ3RoZW1lcy5zZWxlY3RJY29uVGhlbWUnLCBcIlNlbGVjdCBGaWxlIEljb24gVGhlbWUgKFVwL0Rvd24gS2V5cyB0byBQcmV2aWV3KVwiKSxcblx0XHRcdG1hcmtldHBsYWNlVGFnOiAndGFnOmljb24tdGhlbWUnXG5cdFx0fTtcblx0XHRjb25zdCBzZXRUaGVtZSA9ICh0aGVtZTogSVdvcmtiZW5jaFRoZW1lIHwgdW5kZWZpbmVkLCBzZXR0aW5nc1RhcmdldDogVGhlbWVTZXR0aW5nVGFyZ2V0KSA9PiB0aGVtZVNlcnZpY2Uuc2V0RmlsZUljb25UaGVtZSh0aGVtZSBhcyBJV29ya2JlbmNoRmlsZUljb25UaGVtZSwgc2V0dGluZ3NUYXJnZXQpO1xuXHRcdGNvbnN0IGdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXMgPSAocHVibGlzaGVyOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKSA9PiB0aGVtZVNlcnZpY2UuZ2V0TWFya2V0cGxhY2VGaWxlSWNvblRoZW1lcyhwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24pO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBwaWNrZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsZWRUaGVtZXNQaWNrZXIsIG9wdGlvbnMsIHNldFRoZW1lLCBnZXRNYXJrZXRwbGFjZUNvbG9yVGhlbWVzKTtcblxuXHRcdGNvbnN0IHBpY2tzOiBRdWlja1BpY2tJbnB1dDxUaGVtZUl0ZW0+W10gPSBbXG5cdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2ZpbGVJY29uVGhlbWVDYXRlZ29yeScsICdmaWxlIGljb24gdGhlbWVzJykgfSxcblx0XHRcdHsgaWQ6ICcnLCB0aGVtZTogRmlsZUljb25UaGVtZURhdGEubm9JY29uVGhlbWUsIGxhYmVsOiBsb2NhbGl6ZSgnbm9JY29uVGhlbWVMYWJlbCcsICdOb25lJyksIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbm9JY29uVGhlbWVEZXNjJywgJ0Rpc2FibGUgRmlsZSBJY29ucycpIH0sXG5cdFx0XHQuLi50b0VudHJpZXMoYXdhaXQgdGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWVzKCkpLFxuXHRcdF07XG5cblx0XHRhd2FpdCBwaWNrZXIub3BlblF1aWNrUGljayhwaWNrcywgdGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKSk7XG5cdH1cbn0pO1xuXG5jb25zdCBTZWxlY3RQcm9kdWN0SWNvblRoZW1lQ29tbWFuZElkID0gJ3dvcmtiZW5jaC5hY3Rpb24uc2VsZWN0UHJvZHVjdEljb25UaGVtZSc7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWxlY3RQcm9kdWN0SWNvblRoZW1lQ29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2VsZWN0UHJvZHVjdEljb25UaGVtZS5sYWJlbCcsICdQcm9kdWN0IEljb24gVGhlbWUnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlByZWZlcmVuY2VzLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IHRoZW1lU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoVGhlbWVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRpbnN0YWxsTWVzc2FnZTogbG9jYWxpemUoJ2luc3RhbGxQcm9kdWN0SWNvblRoZW1lcycsIFwiSW5zdGFsbCBBZGRpdGlvbmFsIFByb2R1Y3QgSWNvbiBUaGVtZXMuLi5cIiksXG5cdFx0XHRicm93c2VNZXNzYWdlOiAnJChwbHVzKSAnICsgbG9jYWxpemUoJ2Jyb3dzZVByb2R1Y3RJY29uVGhlbWVzJywgXCJCcm93c2UgQWRkaXRpb25hbCBQcm9kdWN0IEljb24gVGhlbWVzLi4uXCIpLFxuXHRcdFx0cGxhY2Vob2xkZXJNZXNzYWdlOiBsb2NhbGl6ZSgndGhlbWVzLnNlbGVjdFByb2R1Y3RJY29uVGhlbWUnLCBcIlNlbGVjdCBQcm9kdWN0IEljb24gVGhlbWUgKFVwL0Rvd24gS2V5cyB0byBQcmV2aWV3KVwiKSxcblx0XHRcdG1hcmtldHBsYWNlVGFnOiAndGFnOnByb2R1Y3QtaWNvbi10aGVtZSdcblx0XHR9O1xuXHRcdGNvbnN0IHNldFRoZW1lID0gKHRoZW1lOiBJV29ya2JlbmNoVGhlbWUgfCB1bmRlZmluZWQsIHNldHRpbmdzVGFyZ2V0OiBUaGVtZVNldHRpbmdUYXJnZXQpID0+IHRoZW1lU2VydmljZS5zZXRQcm9kdWN0SWNvblRoZW1lKHRoZW1lIGFzIElXb3JrYmVuY2hQcm9kdWN0SWNvblRoZW1lLCBzZXR0aW5nc1RhcmdldCk7XG5cdFx0Y29uc3QgZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lcyA9IChwdWJsaXNoZXI6IHN0cmluZywgbmFtZTogc3RyaW5nLCB2ZXJzaW9uOiBzdHJpbmcpID0+IHRoZW1lU2VydmljZS5nZXRNYXJrZXRwbGFjZVByb2R1Y3RJY29uVGhlbWVzKHB1Ymxpc2hlciwgbmFtZSwgdmVyc2lvbik7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHBpY2tlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxlZFRoZW1lc1BpY2tlciwgb3B0aW9ucywgc2V0VGhlbWUsIGdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXMpO1xuXG5cdFx0Y29uc3QgcGlja3M6IFF1aWNrUGlja0lucHV0PFRoZW1lSXRlbT5bXSA9IFtcblx0XHRcdHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgncHJvZHVjdEljb25UaGVtZUNhdGVnb3J5JywgJ3Byb2R1Y3QgaWNvbiB0aGVtZXMnKSB9LFxuXHRcdFx0eyBpZDogREVGQVVMVF9QUk9EVUNUX0lDT05fVEhFTUVfSUQsIHRoZW1lOiBQcm9kdWN0SWNvblRoZW1lRGF0YS5kZWZhdWx0VGhlbWUsIGxhYmVsOiBsb2NhbGl6ZSgnZGVmYXVsdFByb2R1Y3RJY29uVGhlbWVMYWJlbCcsICdEZWZhdWx0JykgfSxcblx0XHRcdC4uLnRvRW50cmllcyhhd2FpdCB0aGVtZVNlcnZpY2UuZ2V0UHJvZHVjdEljb25UaGVtZXMoKSksXG5cdFx0XTtcblxuXHRcdGF3YWl0IHBpY2tlci5vcGVuUXVpY2tQaWNrKHBpY2tzLCB0aGVtZVNlcnZpY2UuZ2V0UHJvZHVjdEljb25UaGVtZSgpKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnByZXZpZXdDb2xvclRoZW1lJywgYXN5bmMgZnVuY3Rpb24gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb246IHsgcHVibGlzaGVyOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgdmVyc2lvbjogc3RyaW5nIH0sIHRoZW1lU2V0dGluZ3NJZD86IHN0cmluZykge1xuXHRjb25zdCB0aGVtZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaFRoZW1lU2VydmljZSk7XG5cblx0bGV0IHRoZW1lcyA9IGZpbmRCdWlsdEluVGhlbWVzKGF3YWl0IHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lcygpLCBleHRlbnNpb24pO1xuXHRpZiAodGhlbWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRoZW1lcyA9IGF3YWl0IHRoZW1lU2VydmljZS5nZXRNYXJrZXRwbGFjZUNvbG9yVGhlbWVzKGV4dGVuc2lvbi5wdWJsaXNoZXIsIGV4dGVuc2lvbi5uYW1lLCBleHRlbnNpb24udmVyc2lvbik7XG5cdH1cblx0Zm9yIChjb25zdCB0aGVtZSBvZiB0aGVtZXMpIHtcblx0XHRpZiAoIXRoZW1lU2V0dGluZ3NJZCB8fCB0aGVtZS5zZXR0aW5nc0lkID09PSB0aGVtZVNldHRpbmdzSWQpIHtcblx0XHRcdGF3YWl0IHRoZW1lU2VydmljZS5zZXRDb2xvclRoZW1lKHRoZW1lLCAncHJldmlldycpO1xuXHRcdFx0cmV0dXJuIHRoZW1lLnNldHRpbmdzSWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59KTtcblxuZnVuY3Rpb24gZmluZEJ1aWx0SW5UaGVtZXModGhlbWVzOiBJV29ya2JlbmNoQ29sb3JUaGVtZVtdLCBleHRlbnNpb246IHsgcHVibGlzaGVyOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9KTogSVdvcmtiZW5jaENvbG9yVGhlbWVbXSB7XG5cdHJldHVybiB0aGVtZXMuZmlsdGVyKCh7IGV4dGVuc2lvbkRhdGEgfSkgPT4gZXh0ZW5zaW9uRGF0YSAmJiBleHRlbnNpb25EYXRhLmV4dGVuc2lvbklzQnVpbHRpbiAmJiBlcXVhbHNJZ25vcmVDYXNlKGV4dGVuc2lvbkRhdGEuZXh0ZW5zaW9uUHVibGlzaGVyLCBleHRlbnNpb24ucHVibGlzaGVyKSAmJiBlcXVhbHNJZ25vcmVDYXNlKGV4dGVuc2lvbkRhdGEuZXh0ZW5zaW9uTmFtZSwgZXh0ZW5zaW9uLm5hbWUpKTtcbn1cblxuZnVuY3Rpb24gY29uZmlndXJhdGlvbkVudHJ5KGxhYmVsOiBzdHJpbmcsIGNvbmZpZ3VyZUl0ZW06IENvbmZpZ3VyZUl0ZW0pOiBRdWlja1BpY2tJbnB1dDxUaGVtZUl0ZW0+IHtcblx0cmV0dXJuIHtcblx0XHRpZDogdW5kZWZpbmVkLFxuXHRcdGxhYmVsOiBsYWJlbCxcblx0XHRhbHdheXNTaG93OiB0cnVlLFxuXHRcdGJ1dHRvbnM6IFtjb25maWd1cmVCdXR0b25dLFxuXHRcdGNvbmZpZ3VyZUl0ZW06IGNvbmZpZ3VyZUl0ZW1cblx0fTtcbn1cblxuaW50ZXJmYWNlIFRoZW1lSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgdGhlbWU/OiBJV29ya2JlbmNoVGhlbWU7XG5cdHJlYWRvbmx5IGdhbGxlcnlFeHRlbnNpb24/OiBJR2FsbGVyeUV4dGVuc2lvbjtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0cmVhZG9ubHkgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGFsd2F5c1Nob3c/OiBib29sZWFuO1xuXHRyZWFkb25seSBjb25maWd1cmVJdGVtPzogQ29uZmlndXJlSXRlbTtcbn1cblxuZnVuY3Rpb24gaXNJdGVtKGk6IFF1aWNrUGlja0lucHV0PFRoZW1lSXRlbT4pOiBpIGlzIFRoZW1lSXRlbSB7XG5cdHJldHVybiAoPGFueT5pKVsndHlwZSddICE9PSAnc2VwYXJhdG9yJztcbn1cblxuZnVuY3Rpb24gdG9FbnRyeSh0aGVtZTogSVdvcmtiZW5jaFRoZW1lKTogVGhlbWVJdGVtIHtcblx0Y29uc3Qgc2V0dGluZ0lkID0gdGhlbWUuc2V0dGluZ3NJZCA/PyB1bmRlZmluZWQ7XG5cdGNvbnN0IGl0ZW06IFRoZW1lSXRlbSA9IHtcblx0XHRpZDogdGhlbWUuaWQsXG5cdFx0dGhlbWU6IHRoZW1lLFxuXHRcdGxhYmVsOiB0aGVtZS5sYWJlbCxcblx0XHRkZXNjcmlwdGlvbjogdGhlbWUuZGVzY3JpcHRpb24gfHwgKHRoZW1lLmxhYmVsID09PSBzZXR0aW5nSWQgPyB1bmRlZmluZWQgOiBzZXR0aW5nSWQpLFxuXHR9O1xuXHRpZiAodGhlbWUuZXh0ZW5zaW9uRGF0YSkge1xuXHRcdGl0ZW0uYnV0dG9ucyA9IFtjb25maWd1cmVCdXR0b25dO1xuXHR9XG5cdHJldHVybiBpdGVtO1xufVxuXG5mdW5jdGlvbiB0b0VudHJpZXModGhlbWVzOiBBcnJheTxJV29ya2JlbmNoVGhlbWU+LCBsYWJlbD86IHN0cmluZyk6IFF1aWNrUGlja0lucHV0PFRoZW1lSXRlbT5bXSB7XG5cdGNvbnN0IHNvcnRlciA9ICh0MTogVGhlbWVJdGVtLCB0MjogVGhlbWVJdGVtKSA9PiB0MS5sYWJlbC5sb2NhbGVDb21wYXJlKHQyLmxhYmVsKTtcblx0Y29uc3QgZW50cmllczogUXVpY2tQaWNrSW5wdXQ8VGhlbWVJdGVtPltdID0gdGhlbWVzLm1hcCh0b0VudHJ5KS5zb3J0KHNvcnRlcik7XG5cdGlmIChlbnRyaWVzLmxlbmd0aCA+IDAgJiYgbGFiZWwpIHtcblx0XHRlbnRyaWVzLnVuc2hpZnQoeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWwgfSk7XG5cdH1cblx0cmV0dXJuIGVudHJpZXM7XG59XG5cbmNvbnN0IGNvbmZpZ3VyZUJ1dHRvbjogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKG1hbmFnZUV4dGVuc2lvbkljb24pLFxuXHR0b29sdGlwOiBsb2NhbGl6ZSgnbWFuYWdlIGV4dGVuc2lvbicsIFwiTWFuYWdlIEV4dGVuc2lvblwiKSxcbn07XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZ2VuZXJhdGVDb2xvclRoZW1lJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2dlbmVyYXRlQ29sb3JUaGVtZS5sYWJlbCcsICdHZW5lcmF0ZSBDb2xvciBUaGVtZSBGcm9tIEN1cnJlbnQgU2V0dGluZ3MnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB0aGVtZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaFRoZW1lU2VydmljZSk7XG5cblx0XHRjb25zdCB0aGVtZSA9IHRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0Y29uc3QgY29sb3JzID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KENvbG9yUmVnaXN0cnlFeHRlbnNpb25zLkNvbG9yQ29udHJpYnV0aW9uKS5nZXRDb2xvcnMoKTtcblx0XHRjb25zdCBjb2xvcklkcyA9IGNvbG9ycy5maWx0ZXIoYyA9PiAhYy5kZXByZWNhdGlvbk1lc3NhZ2UpLm1hcChjID0+IGMuaWQpLnNvcnQoKTtcblx0XHRjb25zdCByZXN1bHRpbmdDb2xvcnM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgbnVsbCB9ID0ge307XG5cdFx0Y29uc3QgaW5oZXJpdGVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY29sb3JJZCBvZiBjb2xvcklkcykge1xuXHRcdFx0Y29uc3QgY29sb3IgPSB0aGVtZS5nZXRDb2xvcihjb2xvcklkLCBmYWxzZSk7XG5cdFx0XHRpZiAoY29sb3IpIHtcblx0XHRcdFx0cmVzdWx0aW5nQ29sb3JzW2NvbG9ySWRdID0gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKGNvbG9yLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluaGVyaXRlZC5wdXNoKGNvbG9ySWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBudWxsRGVmYXVsdHMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IGlkIG9mIGluaGVyaXRlZCkge1xuXHRcdFx0Y29uc3QgY29sb3IgPSB0aGVtZS5nZXRDb2xvcihpZCk7XG5cdFx0XHRpZiAoY29sb3IpIHtcblx0XHRcdFx0cmVzdWx0aW5nQ29sb3JzWydfXycgKyBpZF0gPSBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleEEoY29sb3IsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bnVsbERlZmF1bHRzLnB1c2goaWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGlkIG9mIG51bGxEZWZhdWx0cykge1xuXHRcdFx0cmVzdWx0aW5nQ29sb3JzWydfXycgKyBpZF0gPSBudWxsO1xuXHRcdH1cblx0XHRsZXQgY29udGVudHMgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnJHNjaGVtYSc6IGNvbG9yVGhlbWVTY2hlbWFJZCxcblx0XHRcdHR5cGU6IHRoZW1lLnR5cGUsXG5cdFx0XHRjb2xvcnM6IHJlc3VsdGluZ0NvbG9ycyxcblx0XHRcdHRva2VuQ29sb3JzOiB0aGVtZS50b2tlbkNvbG9ycy5maWx0ZXIodCA9PiAhIXQuc2NvcGUpXG5cdFx0fSwgbnVsbCwgJ1xcdCcpO1xuXHRcdGNvbnRlbnRzID0gY29udGVudHMucmVwbGFjZSgvXFxcIl9fL2csICcvL1wiJyk7XG5cblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRyZXR1cm4gZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IHVuZGVmaW5lZCwgY29udGVudHMsIGxhbmd1YWdlSWQ6ICdqc29uYycsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cdH1cbn0pO1xuXG5jb25zdCB0b2dnbGVMaWdodERhcmtUaGVtZXNDb21tYW5kSWQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVMaWdodERhcmtUaGVtZXMnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogdG9nZ2xlTGlnaHREYXJrVGhlbWVzQ29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlTGlnaHREYXJrVGhlbWVzLmxhYmVsJywgJ1RvZ2dsZSBiZXR3ZWVuIExpZ2h0L0RhcmsgVGhlbWVzJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5QcmVmZXJlbmNlcyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgdGhlbWVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hUaGVtZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgcHJlZmVyZW5jZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpO1xuXG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRoZW1lU2V0dGluZ3MuREVURUNUX0NPTE9SX1NDSEVNRSkpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBsb2NhbGl6ZSh7IGtleTogJ2Nhbm5vdFRvZ2dsZScsIGNvbW1lbnQ6IFsnezB9IGlzIGEgc2V0dGluZyBuYW1lJ10gfSwgXCJDYW5ub3QgdG9nZ2xlIGJldHdlZW4gbGlnaHQgYW5kIGRhcmsgdGhlbWVzIHdoZW4gYHswfWAgaXMgZW5hYmxlZCBpbiBzZXR0aW5ncy5cIiwgVGhlbWVTZXR0aW5ncy5ERVRFQ1RfQ09MT1JfU0NIRU1FKTtcblx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkluZm8sIG1lc3NhZ2UsIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZ29Ub1NldHRpbmcnLCBcIk9wZW4gU2V0dGluZ3NcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5Vc2VyU2V0dGluZ3MoeyBxdWVyeTogVGhlbWVTZXR0aW5ncy5ERVRFQ1RfQ09MT1JfU0NIRU1FIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudFRoZW1lID0gdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKTtcblx0XHRsZXQgbmV3U2V0dGluZ3NJZDogc3RyaW5nID0gVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfREFSS19USEVNRTtcblx0XHRzd2l0Y2ggKGN1cnJlbnRUaGVtZS50eXBlKSB7XG5cdFx0XHRjYXNlIENvbG9yU2NoZW1lLkxJR0hUOlxuXHRcdFx0XHRuZXdTZXR0aW5nc0lkID0gVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfREFSS19USEVNRTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbG9yU2NoZW1lLkRBUks6XG5cdFx0XHRcdG5ld1NldHRpbmdzSWQgPSBUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9MSUdIVF9USEVNRTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbG9yU2NoZW1lLkhJR0hfQ09OVFJBU1RfTElHSFQ6XG5cdFx0XHRcdG5ld1NldHRpbmdzSWQgPSBUaGVtZVNldHRpbmdzLlBSRUZFUlJFRF9IQ19EQVJLX1RIRU1FO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9EQVJLOlxuXHRcdFx0XHRuZXdTZXR0aW5nc0lkID0gVGhlbWVTZXR0aW5ncy5QUkVGRVJSRURfSENfTElHSFRfVEhFTUU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRoZW1lU2V0dGluZ0lkOiBzdHJpbmcgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShuZXdTZXR0aW5nc0lkKTtcblxuXHRcdGlmICh0aGVtZVNldHRpbmdJZCAmJiB0eXBlb2YgdGhlbWVTZXR0aW5nSWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb25zdCB0aGVtZSA9IChhd2FpdCB0aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZXMoKSkuZmluZCh0ID0+IHQuc2V0dGluZ3NJZCA9PT0gdGhlbWVTZXR0aW5nSWQpO1xuXHRcdFx0aWYgKHRoZW1lKSB7XG5cdFx0XHRcdHRoZW1lU2VydmljZS5zZXRDb2xvclRoZW1lKHRoZW1lLmlkLCAnYXV0bycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IGJyb3dzZUNvbG9yVGhlbWVzSW5NYXJrZXRwbGFjZUNvbW1hbmRJZCA9ICd3b3JrYmVuY2guYWN0aW9uLmJyb3dzZUNvbG9yVGhlbWVzSW5NYXJrZXRwbGFjZSc7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBicm93c2VDb2xvclRoZW1lc0luTWFya2V0cGxhY2VDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdicm93c2VDb2xvclRoZW1lSW5NYXJrZXRQbGFjZS5sYWJlbCcsICdCcm93c2UgQ29sb3IgVGhlbWVzIGluIE1hcmtldHBsYWNlJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5QcmVmZXJlbmNlcyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgbWFya2V0cGxhY2VUYWcgPSAnY2F0ZWdvcnk6dGhlbWVzJztcblx0XHRjb25zdCB0aGVtZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaFRoZW1lU2VydmljZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGlmICghZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkgfHwgIWF3YWl0IGV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5zdXBwb3J0c0V4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZXMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjdXJyZW50VGhlbWUgPSB0aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdGNvbnN0IGdldE1hcmtldHBsYWNlQ29sb3JUaGVtZXMgPSAocHVibGlzaGVyOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKSA9PiB0aGVtZVNlcnZpY2UuZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lcyhwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24pO1xuXG5cdFx0bGV0IHNlbGVjdFRoZW1lVGltZW91dDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgc2VsZWN0VGhlbWUgPSAodGhlbWU6IElXb3JrYmVuY2hUaGVtZSB8IHVuZGVmaW5lZCwgYXBwbHlUaGVtZTogYm9vbGVhbikgPT4ge1xuXHRcdFx0aWYgKHNlbGVjdFRoZW1lVGltZW91dCkge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoc2VsZWN0VGhlbWVUaW1lb3V0KTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdFRoZW1lVGltZW91dCA9IG1haW5XaW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHNlbGVjdFRoZW1lVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3QgbmV3VGhlbWUgPSAodGhlbWUgPz8gY3VycmVudFRoZW1lKSBhcyBJV29ya2JlbmNoVGhlbWU7XG5cdFx0XHRcdHRoZW1lU2VydmljZS5zZXRDb2xvclRoZW1lKG5ld1RoZW1lIGFzIElXb3JrYmVuY2hDb2xvclRoZW1lLCBhcHBseVRoZW1lID8gJ2F1dG8nIDogJ3ByZXZpZXcnKS50aGVuKHVuZGVmaW5lZCxcblx0XHRcdFx0XHRlcnIgPT4ge1xuXHRcdFx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdFx0XHRcdHRoZW1lU2VydmljZS5zZXRDb2xvclRoZW1lKGN1cnJlbnRUaGVtZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9LCBhcHBseVRoZW1lID8gMCA6IDIwMCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1hcmtldHBsYWNlVGhlbWVQaWNrZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZXRwbGFjZVRoZW1lc1BpY2tlciwgZ2V0TWFya2V0cGxhY2VDb2xvclRoZW1lcywgbWFya2V0cGxhY2VUYWcpO1xuXHRcdGF3YWl0IG1hcmtldHBsYWNlVGhlbWVQaWNrZXIub3BlblF1aWNrUGljaygnJywgdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSwgc2VsZWN0VGhlbWUpLnRoZW4odW5kZWZpbmVkLCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdH1cbn0pO1xuXG5jb25zdCBUaGVtZXNTdWJNZW51ID0gbmV3IE1lbnVJZCgnVGhlbWVzU3ViTWVudScpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5HbG9iYWxBY3Rpdml0eSwge1xuXHR0aXRsZTogbG9jYWxpemUoJ3RoZW1lcycsIFwiVGhlbWVzXCIpLFxuXHRzdWJtZW51OiBUaGVtZXNTdWJNZW51LFxuXHRncm91cDogJzJfY29uZmlndXJhdGlvbicsXG5cdG9yZGVyOiA3XG59IHNhdGlzZmllcyBJU3VibWVudUl0ZW0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyUHJlZmVyZW5jZXNNZW51LCB7XG5cdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pU2VsZWN0VGhlbWUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZUaGVtZXNcIiksXG5cdHN1Ym1lbnU6IFRoZW1lc1N1Yk1lbnUsXG5cdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0b3JkZXI6IDdcbn0gc2F0aXNmaWVzIElTdWJtZW51SXRlbSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShUaGVtZXNTdWJNZW51LCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogU2VsZWN0Q29sb3JUaGVtZUNvbW1hbmRJZCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ3NlbGVjdFRoZW1lLmxhYmVsJywgJ0NvbG9yIFRoZW1lJylcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oVGhlbWVzU3ViTWVudSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNlbGVjdEZpbGVJY29uVGhlbWVDb21tYW5kSWQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCd0aGVtZXMuc2VsZWN0SWNvblRoZW1lLmxhYmVsJywgXCJGaWxlIEljb24gVGhlbWVcIilcblx0fSxcblx0b3JkZXI6IDJcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oVGhlbWVzU3ViTWVudSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNlbGVjdFByb2R1Y3RJY29uVGhlbWVDb21tYW5kSWQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCd0aGVtZXMuc2VsZWN0UHJvZHVjdEljb25UaGVtZS5sYWJlbCcsIFwiUHJvZHVjdCBJY29uIFRoZW1lXCIpXG5cdH0sXG5cdG9yZGVyOiAzXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFFBQVEsVUFBVSxlQUFlO0FBQzFDLFNBQVMsY0FBYyxRQUFRLFNBQVMsdUJBQXFDO0FBQzdFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsd0JBQXdJLHFCQUFxQjtBQUN0SyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDBCQUEwQixtQ0FBc0Q7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QUFVO0FBQUEsRUFDeEYsU0FBUztBQUFBLEVBQ1QsT0FBTztBQUFBLEVBQ1AsT0FBTztBQUNSLENBQXdCO0FBRXhCLGFBQWEsZUFBZSxlQUFlO0FBQUEsRUFDMUMsU0FBUztBQUFBLElBQ1IsSUFBSTtBQUFBLElBQ0osT0FBTyxTQUFTLHFCQUFxQixhQUFhO0FBQUEsRUFDbkQ7QUFBQSxFQUNBLE9BQU87QUFDUixDQUFDO0FBRUQsYUFBYSxlQUFlLGVBQWU7QUFBQSxFQUMxQyxTQUFTO0FBQUEsSUFDUixJQUFJO0FBQUEsSUFDSixPQUFPLFNBQVMsZ0NBQWdDLGlCQUFpQjtBQUFBLEVBQ2xFO0FBQUEsRUFDQSxPQUFPO0FBQ1IsQ0FBQztBQUVELGFBQWEsZUFBZSxlQUFlO0FBQUEsRUFDMUMsU0FBUztBQUFBLElBQ1IsSUFBSTtBQUFBLElBQ0osT0FBTyxTQUFTLHVDQUF1QyxvQkFBb0I7QUFBQSxFQUM1RTtBQUFBLEVBQ0EsT0FBTztBQUNSLENBQUM7IiwKICAibmFtZXMiOiBbIkNvbmZpZ3VyZUl0ZW0iLCAiaSIsICJfIiwgInBpY2tlciJdCn0K
