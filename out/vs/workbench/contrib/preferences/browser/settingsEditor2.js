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
import * as DOM from "../../../../base/browser/dom.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Action } from "../../../../base/common/actions.js";
import { Delayer, raceTimeout } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { fromNow } from "../../../../base/common/date.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import "./media/settingsEditor2.css";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder, editorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IUserDataSyncEnablementService, IUserDataSyncService, SyncStatus } from "../../../../platform/userDataSync/common/userDataSync.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { SuggestEnabledInput } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { SettingsTargetsWidget } from "./preferencesWidgets.js";
import { getCommonlyUsedData, tocData } from "./settingsLayout.js";
import { AbstractSettingRenderer, resolveConfiguredUntrustedSettings, createTocTreeForExtensionSettings, resolveSettingsTree, SettingsTree, SettingTreeRenderers } from "./settingsTree.js";
import { parseQuery, SearchResultIdx, SearchResultModel, SettingsTreeGroupElement, SettingsTreeModel, SettingsTreeSettingElement } from "./settingsTreeModels.js";
import { createTOCIterator, TOCTree, TOCTreeModel } from "./tocTree.js";
import { CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, ENABLE_LANGUAGE_FILTER, EXTENSION_FETCH_TIMEOUT_MS, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, ID_SETTING_TAG, IPreferencesSearchService, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, WORKSPACE_TRUST_SETTING_TAG, getExperimentalExtensionToggleData } from "../common/preferences.js";
import { settingsHeaderBorder, settingsSashBorder, settingsTextInputBorder } from "../common/settingsEditorColorRegistry.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IPreferencesService, SettingMatchType, SettingValueType, validateSettingsEditorOptions } from "../../../services/preferences/common/preferences.js";
import { Settings2EditorModel, nullRange } from "../../../services/preferences/common/preferencesModels.js";
import { IUserDataSyncWorkbenchService } from "../../../services/userDataSync/common/userDataSync.js";
import { preferencesClearInputIcon, preferencesFilterIcon } from "./preferencesIcons.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { APPLICATION_SCOPES, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../base/common/color.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { SettingsSearchFilterDropdownMenuActionViewItem } from "./settingsSearchMenu.js";
import { IExtensionGalleryService, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
var SettingsFocusContext = /* @__PURE__ */ ((SettingsFocusContext2) => {
  SettingsFocusContext2[SettingsFocusContext2["Search"] = 0] = "Search";
  SettingsFocusContext2[SettingsFocusContext2["TableOfContents"] = 1] = "TableOfContents";
  SettingsFocusContext2[SettingsFocusContext2["SettingTree"] = 2] = "SettingTree";
  SettingsFocusContext2[SettingsFocusContext2["SettingControl"] = 3] = "SettingControl";
  return SettingsFocusContext2;
})(SettingsFocusContext || {});
function createGroupIterator(group) {
  return Iterable.map(group.children, (g) => {
    return {
      element: g,
      children: g instanceof SettingsTreeGroupElement ? createGroupIterator(g) : void 0
    };
  });
}
const $ = DOM.$;
const searchBoxLabel = localize("SearchSettings.AriaLabel", "Search settings");
const SEARCH_TOC_BEHAVIOR_KEY = "workbench.settings.settingsSearchTocBehavior";
const SETTINGS_EDITOR_STATE_KEY = "settingsEditorState";
let SettingsEditor2 = class extends EditorPane {
  constructor(group, telemetryService, configurationService, textResourceConfigurationService, themeService, preferencesService, instantiationService, preferencesSearchService, logService, contextKeyService, storageService, editorGroupService, userDataSyncWorkbenchService, userDataSyncEnablementService, workspaceTrustManagementService, extensionService, languageService, extensionManagementService, productService, extensionGalleryService, editorProgressService, userDataProfileService) {
    super(SettingsEditor2.ID, group, telemetryService, themeService, storageService);
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
    this.instantiationService = instantiationService;
    this.preferencesSearchService = preferencesSearchService;
    this.logService = logService;
    this.storageService = storageService;
    this.editorGroupService = editorGroupService;
    this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.extensionService = extensionService;
    this.languageService = languageService;
    this.extensionManagementService = extensionManagementService;
    this.productService = productService;
    this.extensionGalleryService = extensionGalleryService;
    this.editorProgressService = editorProgressService;
    this.settingsTreeModel = this._register(new MutableDisposable());
    this.searchInProgress = null;
    this.pendingSettingUpdate = null;
    this._searchResultModel = this._register(new MutableDisposable());
    this.searchResultLabel = null;
    this.lastSyncedLabel = null;
    this.settingsOrderByTocIndex = null;
    this._currentFocusContext = 0 /* Search */;
    /** Don't spam warnings */
    this.hasWarnedMissingSettings = false;
    this.tocTreeDisposed = false;
    this.tocFocusedElement = null;
    this.treeFocusedElement = null;
    this.settingsTreeScrollTop = 0;
    this.installedExtensionIds = [];
    this.dismissedExtensionSettings = [];
    this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY = "settingsEditor2.dismissedExtensionSettings";
    this.DISMISSED_EXTENSION_SETTINGS_DELIMITER = "	";
    this.searchDelayer = new Delayer(300);
    this.viewState = { settingsTarget: ConfigurationTarget.USER_LOCAL };
    this.settingFastUpdateDelayer = new Delayer(SettingsEditor2.SETTING_UPDATE_FAST_DEBOUNCE);
    this.settingSlowUpdateDelayer = new Delayer(SettingsEditor2.SETTING_UPDATE_SLOW_DEBOUNCE);
    this.searchInputDelayer = new Delayer(SettingsEditor2.SEARCH_DEBOUNCE);
    this.updatedConfigSchemaDelayer = new Delayer(SettingsEditor2.CONFIG_SCHEMA_UPDATE_DELAYER);
    this.inSettingsEditorContextKey = CONTEXT_SETTINGS_EDITOR.bindTo(contextKeyService);
    this.searchFocusContextKey = CONTEXT_SETTINGS_SEARCH_FOCUS.bindTo(contextKeyService);
    this.tocRowFocused = CONTEXT_TOC_ROW_FOCUS.bindTo(contextKeyService);
    this.settingRowFocused = CONTEXT_SETTINGS_ROW_FOCUS.bindTo(contextKeyService);
    this.scheduledRefreshes = /* @__PURE__ */ new Map();
    this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, SETTINGS_EDITOR_STATE_KEY);
    this.dismissedExtensionSettings = this.storageService.get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, StorageScope.PROFILE, "").split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.source !== ConfigurationTarget.DEFAULT) {
        this.onConfigUpdate(e.affectedKeys);
      }
    }));
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => {
      e.join(this.whenCurrentProfileChanged());
    }));
    this._register(workspaceTrustManagementService.onDidChangeTrust(() => {
      this.searchResultModel?.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
      if (this.settingsTreeModel.value) {
        this.settingsTreeModel.value.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
        this.renderTree();
      }
    }));
    this._register(configurationService.onDidChangeRestrictedSettings((e) => {
      if (e.default.length && this.currentSettingsModel) {
        this.updateElementsByKey(new Set(e.default));
      }
    }));
    this._register(extensionManagementService.onDidInstallExtensions(() => {
      this.refreshInstalledExtensionsList();
    }));
    this._register(extensionManagementService.onDidUninstallExtension(() => {
      this.refreshInstalledExtensionsList();
    }));
    this.modelDisposables = this._register(new DisposableStore());
    if (ENABLE_LANGUAGE_FILTER && !SettingsEditor2.SUGGESTIONS.includes(`@${LANGUAGE_SETTING_TAG}`)) {
      SettingsEditor2.SUGGESTIONS.push(`@${LANGUAGE_SETTING_TAG}`);
    }
    this.inputChangeListener = this._register(new MutableDisposable());
  }
  static shouldSettingUpdateFast(type) {
    if (Array.isArray(type)) {
      return false;
    }
    return type === SettingValueType.Enum || type === SettingValueType.Array || type === SettingValueType.BooleanObject || type === SettingValueType.Object || type === SettingValueType.Complex || type === SettingValueType.Boolean || type === SettingValueType.Exclude || type === SettingValueType.Include;
  }
  async whenCurrentProfileChanged() {
    this.updatedConfigSchemaDelayer.trigger(() => {
      this.dismissedExtensionSettings = this.storageService.get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, StorageScope.PROFILE, "").split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
      this.onConfigUpdate(void 0, true);
    });
  }
  get minimumWidth() {
    return SettingsEditor2.EDITOR_MIN_WIDTH;
  }
  get maximumWidth() {
    return Number.POSITIVE_INFINITY;
  }
  get minimumHeight() {
    return 180;
  }
  // these setters need to exist because this extends from EditorPane
  set minimumWidth(value) {
  }
  set maximumWidth(value) {
  }
  get currentSettingsModel() {
    return this.searchResultModel || this.settingsTreeModel.value;
  }
  get searchResultModel() {
    return this._searchResultModel.value ?? null;
  }
  set searchResultModel(value) {
    this._searchResultModel.value = value ?? void 0;
    this.rootElement.classList.toggle("search-mode", !!this._searchResultModel.value);
  }
  get focusedSettingDOMElement() {
    const focused = this.settingsTree.getFocus()[0];
    if (!(focused instanceof SettingsTreeSettingElement)) {
      return;
    }
    return this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), focused.setting.key)[0];
  }
  get currentFocusContext() {
    return this._currentFocusContext;
  }
  createEditor(parent) {
    parent.setAttribute("tabindex", "-1");
    this.rootElement = DOM.append(parent, $(".settings-editor", { tabindex: "-1" }));
    this.createHeader(this.rootElement);
    this.createBody(this.rootElement);
    this.addCtrlAInterceptor(this.rootElement);
    this.updateStyles();
    this._register(registerNavigableContainer({
      name: "settingsEditor2",
      focusNotifiers: [this],
      focusNextWidget: () => {
        if (this.searchWidget.inputWidget.hasWidgetFocus()) {
          this.focusTOC();
        }
      },
      focusPreviousWidget: () => {
        if (!this.searchWidget.inputWidget.hasWidgetFocus()) {
          this.focusSearch();
        }
      }
    }));
  }
  async setInput(input, options, context, token) {
    this.inSettingsEditorContextKey.set(true);
    await super.setInput(input, options, context, token);
    if (!this.input) {
      return;
    }
    const model = await this.input.resolve();
    if (token.isCancellationRequested || !(model instanceof Settings2EditorModel)) {
      return;
    }
    this.modelDisposables.clear();
    this.modelDisposables.add(model.onDidChangeGroups(() => {
      this.updatedConfigSchemaDelayer.trigger(() => {
        this.onConfigUpdate(void 0, false, true);
      });
    }));
    this.defaultSettingsEditorModel = model;
    options = options || validateSettingsEditorOptions({});
    if (!this.viewState.settingsTarget || !this.settingsTargetsWidget.settingsTarget) {
      const optionsHasViewStateTarget = options.viewState && options.viewState.settingsTarget;
      if (!options.target && !optionsHasViewStateTarget) {
        options.target = ConfigurationTarget.USER_LOCAL;
      }
    }
    this._setOptions(options);
    this.onConfigUpdate(void 0, true).then(() => {
      this.inputChangeListener.value = input.onWillDispose(() => {
        this.searchWidget.setValue("");
      });
      this.updateTreeScrollSync();
    });
    await this.refreshInstalledExtensionsList();
  }
  async refreshInstalledExtensionsList() {
    const installedExtensions = await this.extensionManagementService.getInstalled();
    this.installedExtensionIds = installedExtensions.filter((ext) => ext.manifest.contributes?.configuration).map((ext) => ext.identifier.id);
  }
  restoreCachedState() {
    const cachedState = this.input && this.editorMemento.loadEditorState(this.group, this.input);
    if (cachedState && typeof cachedState.target === "object") {
      cachedState.target = URI.revive(cachedState.target);
    }
    if (cachedState) {
      const settingsTarget = cachedState.target;
      this.settingsTargetsWidget.settingsTarget = settingsTarget;
      this.viewState.settingsTarget = settingsTarget;
      if (!this.searchWidget.getValue()) {
        this.searchWidget.setValue(cachedState.searchQuery);
      }
    }
    if (this.input) {
      this.editorMemento.clearEditorState(this.input, this.group);
    }
    return cachedState ?? null;
  }
  getViewState() {
    return this.viewState;
  }
  setOptions(options) {
    super.setOptions(options);
    if (options) {
      this._setOptions(options);
    }
  }
  _setOptions(options) {
    if (options.focusSearch && !platform.isIOS) {
      this.focusSearch();
    }
    const recoveredViewState = options.viewState ? options.viewState : void 0;
    const query = recoveredViewState?.query ?? options.query;
    if (query !== void 0) {
      this.searchWidget.setValue(query);
      this.viewState.query = query;
    }
    const target = options.folderUri ?? recoveredViewState?.settingsTarget ?? options.target;
    if (target) {
      this.settingsTargetsWidget.updateTarget(target);
    }
  }
  clearInput() {
    this.inSettingsEditorContextKey.set(false);
    super.clearInput();
  }
  layout(dimension) {
    this.dimension = dimension;
    if (!this.isVisible()) {
      return;
    }
    this.layoutSplitView(dimension);
    const innerWidth = Math.min(this.headerContainer.clientWidth, dimension.width) - 24 * 2;
    const monacoWidth = innerWidth - 10 - this.countElement.clientWidth - this.controlsElement.clientWidth - 12;
    this.searchWidget.layout(new DOM.Dimension(monacoWidth, 20));
    this.rootElement.classList.toggle("narrow-width", dimension.width < SettingsEditor2.NARROW_TOTAL_WIDTH);
  }
  focus() {
    super.focus();
    if (this._currentFocusContext === 0 /* Search */) {
      if (!platform.isIOS) {
        this.focusSearch();
      }
    } else if (this._currentFocusContext === 3 /* SettingControl */) {
      const element = this.focusedSettingDOMElement;
      if (element) {
        const control = element.querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
        if (control) {
          control.focus();
          return;
        }
      }
    } else if (this._currentFocusContext === 2 /* SettingTree */) {
      this.settingsTree.domFocus();
    } else if (this._currentFocusContext === 1 /* TableOfContents */) {
      this.tocTree.domFocus();
    }
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    if (!visible) {
      setTimeout(() => {
        this.searchWidget.onHide();
        this.settingRenderers.cancelSuggesters();
      }, 0);
    }
  }
  focusSettings(focusSettingInput = false) {
    const focused = this.settingsTree.getFocus();
    if (!focused.length) {
      this.settingsTree.focusFirst();
    }
    this.settingsTree.domFocus();
    if (focusSettingInput) {
      const controlInFocusedRow = this.settingsTree.getHTMLElement().querySelector(`.focused ${AbstractSettingRenderer.CONTROL_SELECTOR}`);
      if (controlInFocusedRow) {
        controlInFocusedRow.focus();
      }
    }
  }
  focusTOC() {
    this.tocTree.domFocus();
  }
  showContextMenu() {
    const focused = this.settingsTree.getFocus()[0];
    const rowElement = this.focusedSettingDOMElement;
    if (rowElement && focused instanceof SettingsTreeSettingElement) {
      this.settingRenderers.showContextMenu(focused, rowElement);
    }
  }
  focusSearch(filter, selectAll = true) {
    if (filter && this.searchWidget) {
      this.searchWidget.setValue(filter);
    }
    this.searchWidget.focus(selectAll && !this.searchInputDelayer.isTriggered);
  }
  clearSearchResults() {
    this.searchWidget.setValue("");
    this.focusSearch();
  }
  clearSearchFilters() {
    const query = this.searchWidget.getValue();
    const splitQuery = query.split(" ").filter((word) => {
      return word.length && !SettingsEditor2.SUGGESTIONS.some((suggestion) => word.startsWith(suggestion));
    });
    this.searchWidget.setValue(splitQuery.join(" "));
  }
  updateInputAriaLabel() {
    let label = searchBoxLabel;
    if (this.searchResultLabel) {
      label += `. ${this.searchResultLabel}`;
    }
    if (this.lastSyncedLabel) {
      label += `. ${this.lastSyncedLabel}`;
    }
    this.searchWidget.updateAriaLabel(label);
  }
  /**
   * Render the header of the Settings editor, which includes the content above the splitview.
   */
  createHeader(parent) {
    this.headerContainer = DOM.append(parent, $(".settings-header"));
    const searchContainer = DOM.append(this.headerContainer, $(".search-container"));
    const clearInputAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, localize("clearInput", "Clear Settings Search Input"), ThemeIcon.asClassName(preferencesClearInputIcon), false, async () => this.clearSearchResults()));
    const filterAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, localize("filterInput", "Filter Settings"), ThemeIcon.asClassName(preferencesFilterIcon)));
    this.searchWidget = this._register(this.instantiationService.createInstance(SuggestEnabledInput, `${SettingsEditor2.ID}.searchbox`, searchContainer, {
      triggerCharacters: ["@", ":"],
      provideResults: (query) => {
        const queryParts = query.split(/\s/g);
        if (queryParts[queryParts.length - 1].startsWith(`@${LANGUAGE_SETTING_TAG}`)) {
          const sortedLanguages = this.languageService.getRegisteredLanguageIds().map((languageId) => {
            return `@${LANGUAGE_SETTING_TAG}${languageId} `;
          }).sort();
          return sortedLanguages.filter((langFilter) => !query.includes(langFilter));
        } else if (queryParts[queryParts.length - 1].startsWith(`@${EXTENSION_SETTING_TAG}`)) {
          const installedExtensionsTags = this.installedExtensionIds.map((extensionId) => {
            return `@${EXTENSION_SETTING_TAG}${extensionId} `;
          }).sort();
          return installedExtensionsTags.filter((extFilter) => !query.includes(extFilter));
        } else if (queryParts[queryParts.length - 1].startsWith("@")) {
          return SettingsEditor2.SUGGESTIONS.filter((tag) => !query.includes(tag)).map((tag) => tag.endsWith(":") ? tag : tag + " ");
        }
        return [];
      }
    }, searchBoxLabel, "settingseditor:searchinput" + SettingsEditor2.NUM_INSTANCES++, {
      placeholderText: searchBoxLabel,
      focusContextKey: this.searchFocusContextKey,
      styleOverrides: {
        inputBorder: settingsTextInputBorder
      }
      // TODO: Aria-live
    }));
    this._register(this.searchWidget.onDidFocus(() => {
      this._currentFocusContext = 0 /* Search */;
    }));
    this.countElement = DOM.append(searchContainer, DOM.$(".settings-count-widget.monaco-count-badge.long"));
    this.countElement.style.backgroundColor = asCssVariable(badgeBackground);
    this.countElement.style.color = asCssVariable(badgeForeground);
    this.countElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    this._register(this.searchWidget.onInputDidChange(() => {
      const searchVal = this.searchWidget.getValue();
      clearInputAction.enabled = !!searchVal;
      this.searchInputDelayer.trigger(() => this.onSearchInputChanged());
    }));
    const headerControlsContainer = DOM.append(this.headerContainer, $(".settings-header-controls"));
    headerControlsContainer.style.borderColor = asCssVariable(settingsHeaderBorder);
    const targetWidgetContainer = DOM.append(headerControlsContainer, $(".settings-target-container"));
    this.settingsTargetsWidget = this._register(this.instantiationService.createInstance(SettingsTargetsWidget, targetWidgetContainer, { enableRemoteSettings: true }));
    this.settingsTargetsWidget.settingsTarget = ConfigurationTarget.USER_LOCAL;
    this._register(this.settingsTargetsWidget.onDidTargetChange((target) => this.onDidSettingsTargetChange(target)));
    this._register(DOM.addDisposableListener(targetWidgetContainer, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.DownArrow) {
        this.focusSettings();
      }
    }));
    if (this.userDataSyncWorkbenchService.enabled && this.userDataSyncEnablementService.canToggleEnablement()) {
      const syncControls = this._register(this.instantiationService.createInstance(SyncControls, this.window, headerControlsContainer));
      this._register(syncControls.onDidChangeLastSyncedLabel((lastSyncedLabel) => {
        this.lastSyncedLabel = lastSyncedLabel;
        this.updateInputAriaLabel();
      }));
    }
    this.controlsElement = DOM.append(searchContainer, DOM.$(".settings-clear-widget"));
    const actionBar = this._register(new ActionBar(this.controlsElement, {
      actionViewItemProvider: (action, options) => {
        if (action.id === filterAction.id) {
          return this.instantiationService.createInstance(SettingsSearchFilterDropdownMenuActionViewItem, action, options, this.actionRunner, this.searchWidget);
        }
        return void 0;
      }
    }));
    actionBar.push([clearInputAction, filterAction], { label: false, icon: true });
  }
  onDidSettingsTargetChange(target) {
    this.viewState.settingsTarget = target;
    this.onConfigUpdate(void 0, true);
  }
  onDidDismissExtensionSetting(extensionId) {
    if (!this.dismissedExtensionSettings.includes(extensionId)) {
      this.dismissedExtensionSettings.push(extensionId);
    }
    this.storageService.store(
      this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY,
      this.dismissedExtensionSettings.join(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    this.onConfigUpdate(void 0, true);
  }
  onDidClickSetting(evt, recursed) {
    const targetElement = this.currentSettingsModel?.getElementsByName(evt.targetKey)?.[0];
    let revealFailed = false;
    if (targetElement) {
      let sourceTop = 0.5;
      try {
        const _sourceTop = this.settingsTree.getRelativeTop(evt.source);
        if (_sourceTop !== null) {
          sourceTop = _sourceTop;
        }
      } catch {
      }
      if (this.viewState.filterToCategory && evt.source.displayCategory !== targetElement.displayCategory) {
        this.tocTree.setFocus([]);
      }
      try {
        this.settingsTree.reveal(targetElement, sourceTop);
      } catch (_) {
        revealFailed = true;
      }
      if (!revealFailed) {
        setTimeout(() => {
          this.settingsTree.setFocus([targetElement]);
        }, 50);
        const domElements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), evt.targetKey);
        if (domElements && domElements[0]) {
          const control = domElements[0].querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
          if (control) {
            control.focus();
          }
        }
      }
    }
    if (!recursed && (!targetElement || revealFailed)) {
      const p = this.triggerSearch("");
      p.then(() => {
        this.searchWidget.setValue("");
        this.onDidClickSetting(evt, true);
      });
    }
  }
  switchToSettingsFile() {
    const query = parseQuery(this.searchWidget.getValue()).query;
    return this.openSettingsFile({ query });
  }
  async openSettingsFile(options) {
    const currentSettingsTarget = this.settingsTargetsWidget.settingsTarget;
    const openOptions = { jsonEditor: true, groupId: this.group.id, ...options };
    if (currentSettingsTarget === ConfigurationTarget.USER_LOCAL) {
      if (options?.revealSetting) {
        const configurationProperties = Registry.as(Extensions.Configuration).getConfigurationProperties();
        const configurationScope = configurationProperties[options?.revealSetting.key]?.scope;
        if (configurationScope && APPLICATION_SCOPES.includes(configurationScope)) {
          return this.preferencesService.openApplicationSettings(openOptions);
        }
      }
      return this.preferencesService.openUserSettings(openOptions);
    } else if (currentSettingsTarget === ConfigurationTarget.USER_REMOTE) {
      return this.preferencesService.openRemoteSettings(openOptions);
    } else if (currentSettingsTarget === ConfigurationTarget.WORKSPACE) {
      return this.preferencesService.openWorkspaceSettings(openOptions);
    } else if (URI.isUri(currentSettingsTarget)) {
      return this.preferencesService.openFolderSettings({ folderUri: currentSettingsTarget, ...openOptions });
    }
    return void 0;
  }
  createBody(parent) {
    this.bodyContainer = DOM.append(parent, $(".settings-body"));
    this.noResultsMessage = DOM.append(this.bodyContainer, $(".no-results-message"));
    this.noResultsMessage.innerText = localize("noResults", "No Settings Found");
    this.clearFilterLinkContainer = $("span.clear-search-filters");
    this.clearFilterLinkContainer.textContent = " - ";
    const clearFilterLink = DOM.append(this.clearFilterLinkContainer, $("a.pointer.prominent", { tabindex: 0 }, localize("clearSearchFilters", "Clear Filters")));
    this._register(DOM.addDisposableListener(clearFilterLink, DOM.EventType.CLICK, (e) => {
      DOM.EventHelper.stop(e, false);
      this.clearSearchFilters();
    }));
    DOM.append(this.noResultsMessage, this.clearFilterLinkContainer);
    this.noResultsMessage.style.color = asCssVariable(editorForeground);
    this.tocTreeContainer = $(".settings-toc-container");
    this.settingsTreeContainer = $(".settings-tree-container");
    this.createTOC(this.tocTreeContainer);
    this.createSettingsTree(this.settingsTreeContainer);
    this.splitView = this._register(new SplitView(this.bodyContainer, {
      orientation: Orientation.HORIZONTAL,
      proportionalLayout: true
    }));
    const startingWidth = this.storageService.getNumber("settingsEditor2.splitViewWidth", StorageScope.PROFILE, SettingsEditor2.TOC_RESET_WIDTH);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.tocTreeContainer,
      minimumSize: SettingsEditor2.TOC_MIN_WIDTH,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        this.tocTreeContainer.style.width = `${width}px`;
        this.tocTree.layout(height, width);
      }
    }, startingWidth, void 0, true);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.settingsTreeContainer,
      minimumSize: SettingsEditor2.EDITOR_MIN_WIDTH,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        this.settingsTreeContainer.style.width = `${width}px`;
        this.settingsTree.layout(height, width);
      }
    }, Sizing.Distribute, void 0, true);
    this._register(this.splitView.onDidSashReset(() => {
      const totalSize = this.splitView.getViewSize(0) + this.splitView.getViewSize(1);
      this.splitView.resizeView(0, SettingsEditor2.TOC_RESET_WIDTH);
      this.splitView.resizeView(1, totalSize - SettingsEditor2.TOC_RESET_WIDTH);
    }));
    this._register(this.splitView.onDidSashChange(() => {
      const width = this.splitView.getViewSize(0);
      this.storageService.store("settingsEditor2.splitViewWidth", width, StorageScope.PROFILE, StorageTarget.USER);
    }));
    const borderColor = this.theme.getColor(settingsSashBorder);
    this.splitView.style({ separatorBorder: borderColor });
  }
  addCtrlAInterceptor(container) {
    this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_DOWN, (e) => {
      if (e.keyCode === KeyCode.KeyA && (platform.isMacintosh ? e.metaKey : e.ctrlKey) && !DOM.isEditableElement(e.target)) {
        e.browserEvent.stopPropagation();
        e.browserEvent.preventDefault();
      }
    }));
  }
  createTOC(container) {
    this.tocTreeModel = this.instantiationService.createInstance(TOCTreeModel, this.viewState);
    this.tocTree = this._register(this.instantiationService.createInstance(
      TOCTree,
      DOM.append(container, $(".settings-toc-wrapper", {
        "role": "navigation",
        "aria-label": localize("settings", "Settings")
      })),
      this.viewState
    ));
    this.tocTreeDisposed = false;
    this._register(this.tocTree.onDidFocus(() => {
      this._currentFocusContext = 1 /* TableOfContents */;
    }));
    this._register(this.tocTree.onDidChangeFocus((e) => {
      const element = e.elements?.[0] ?? null;
      if (this.tocFocusedElement === element) {
        return;
      }
      this.tocFocusedElement = element;
      this.tocTree.setSelection(element ? [element] : []);
      if (this.searchResultModel) {
        if (this.viewState.filterToCategory !== element) {
          this.viewState.filterToCategory = element ?? void 0;
          this.renderTree(void 0, true);
          this.settingsTree.scrollTop = 0;
        }
      } else if (element && (!e.browserEvent || !e.browserEvent.fromScroll)) {
        this.settingsTree.reveal(element, 0);
        this.settingsTree.setFocus([element]);
      }
    }));
    this._register(this.tocTree.onDidFocus(() => {
      this.tocRowFocused.set(true);
    }));
    this._register(this.tocTree.onDidBlur(() => {
      this.tocRowFocused.set(false);
    }));
    this._register(this.tocTree.onDidDispose(() => {
      this.tocTreeDisposed = true;
    }));
  }
  applyFilter(filter) {
    if (this.searchWidget && !this.searchWidget.getValue().includes(filter)) {
      const newQuery = `${filter} ${this.searchWidget.getValue().trimStart()}`;
      this.focusSearch(newQuery, false);
    }
  }
  removeLanguageFilters() {
    if (this.searchWidget && this.searchWidget.getValue().includes(`@${LANGUAGE_SETTING_TAG}`)) {
      const query = this.searchWidget.getValue().split(" ");
      const newQuery = query.filter((word) => !word.startsWith(`@${LANGUAGE_SETTING_TAG}`)).join(" ");
      this.focusSearch(newQuery, false);
    }
  }
  createSettingsTree(container) {
    this.settingRenderers = this._register(this.instantiationService.createInstance(SettingTreeRenderers));
    this._register(this.settingRenderers.onDidChangeSetting((e) => this.onDidChangeSetting(e.key, e.value, e.type, e.manualReset, e.scope)));
    this._register(this.settingRenderers.onDidDismissExtensionSetting((e) => this.onDidDismissExtensionSetting(e)));
    this._register(this.settingRenderers.onDidOpenSettings((settingKey) => {
      this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } });
    }));
    this._register(this.settingRenderers.onDidClickSettingLink((settingName) => this.onDidClickSetting(settingName)));
    this._register(this.settingRenderers.onDidFocusSetting((element) => {
      this.settingsTree.setFocus([element]);
      this._currentFocusContext = 3 /* SettingControl */;
      this.settingRowFocused.set(false);
    }));
    this._register(this.settingRenderers.onDidChangeSettingHeight((params) => {
      const { element, height } = params;
      try {
        this.settingsTree.updateElementHeight(element, height);
      } catch (e) {
      }
    }));
    this._register(this.settingRenderers.onApplyFilter((filter) => this.applyFilter(filter)));
    this._register(this.settingRenderers.onDidClickOverrideElement((element) => {
      this.removeLanguageFilters();
      if (element.language) {
        this.applyFilter(`@${LANGUAGE_SETTING_TAG}${element.language}`);
      }
      if (element.scope === "workspace") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.WORKSPACE);
      } else if (element.scope === "user") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.USER_LOCAL);
      } else if (element.scope === "remote") {
        this.settingsTargetsWidget.updateTarget(ConfigurationTarget.USER_REMOTE);
      }
      this.applyFilter(`@${ID_SETTING_TAG}${element.settingKey}`);
    }));
    this.settingsTree = this._register(this.instantiationService.createInstance(
      SettingsTree,
      container,
      this.viewState,
      this.settingRenderers.allRenderers
    ));
    this._register(this.settingsTree.onDidScroll(() => {
      if (this.settingsTree.scrollTop === this.settingsTreeScrollTop) {
        return;
      }
      this.settingsTreeScrollTop = this.settingsTree.scrollTop;
      setTimeout(() => {
        this.updateTreeScrollSync();
      }, 0);
    }));
    this._register(this.settingsTree.onDidFocus(() => {
      const classList = container.ownerDocument.activeElement?.classList;
      if (classList && classList.contains("monaco-list") && classList.contains("settings-editor-tree")) {
        this._currentFocusContext = 2 /* SettingTree */;
        this.settingRowFocused.set(true);
        this.treeFocusedElement ??= this.settingsTree.firstVisibleElement ?? null;
        if (this.treeFocusedElement) {
          this.treeFocusedElement.tabbable = true;
        }
      }
    }));
    this._register(this.settingsTree.onDidBlur(() => {
      this.settingRowFocused.set(false);
      this.treeFocusedElement = null;
    }));
    this._register(this.settingsTree.onDidChangeFocus((e) => {
      const element = e.elements[0];
      if (this.treeFocusedElement === element) {
        return;
      }
      if (this.treeFocusedElement) {
        this.treeFocusedElement.tabbable = false;
      }
      this.treeFocusedElement = element;
      if (this.treeFocusedElement) {
        this.treeFocusedElement.tabbable = true;
      }
      this.settingsTree.setSelection(element ? [element] : []);
    }));
  }
  onDidChangeSetting(key, value, type, manualReset, scope) {
    const parsedQuery = parseQuery(this.searchWidget.getValue());
    const languageFilter = parsedQuery.languageFilter;
    if (manualReset || this.pendingSettingUpdate && this.pendingSettingUpdate.key !== key) {
      this.updateChangedSetting(key, value, manualReset, languageFilter, scope);
    }
    this.pendingSettingUpdate = { key, value, languageFilter };
    if (SettingsEditor2.shouldSettingUpdateFast(type)) {
      this.settingFastUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
    } else {
      this.settingSlowUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
    }
  }
  updateTreeScrollSync() {
    this.settingRenderers.cancelSuggesters();
    if (this.searchResultModel) {
      return;
    }
    if (!this.tocTreeModel) {
      return;
    }
    const elementToSync = this.settingsTree.firstVisibleElement;
    const element = elementToSync instanceof SettingsTreeSettingElement ? elementToSync.parent : elementToSync instanceof SettingsTreeGroupElement ? elementToSync : null;
    let nodeExists = true;
    try {
      this.tocTree.getNode(element);
    } catch (e) {
      nodeExists = false;
    }
    if (!nodeExists) {
      return;
    }
    if (element && this.tocTree.getSelection()[0] !== element) {
      const ancestors = this.getAncestors(element);
      ancestors.forEach((e) => this.tocTree.expand(e));
      this.tocTree.reveal(element);
      const elementTop = this.tocTree.getRelativeTop(element);
      if (typeof elementTop !== "number") {
        return;
      }
      this.tocTree.collapseAll();
      ancestors.forEach((e) => this.tocTree.expand(e));
      if (elementTop < 0 || elementTop > 1) {
        this.tocTree.reveal(element);
      } else {
        this.tocTree.reveal(element, elementTop);
      }
      this.tocTree.expand(element);
      this.tocTree.setSelection([element]);
      const fakeKeyboardEvent = new KeyboardEvent("keydown");
      fakeKeyboardEvent.fromScroll = true;
      this.tocTree.setFocus([element], fakeKeyboardEvent);
    }
  }
  getAncestors(element) {
    const ancestors = [];
    while (element.parent) {
      if (element.parent.id !== "root") {
        ancestors.push(element.parent);
      }
      element = element.parent;
    }
    return ancestors.reverse();
  }
  updateChangedSetting(key, value, manualReset, languageFilter, scope) {
    const settingsTarget = this.settingsTargetsWidget.settingsTarget;
    const resource = URI.isUri(settingsTarget) ? settingsTarget : void 0;
    const configurationTarget = (resource ? ConfigurationTarget.WORKSPACE_FOLDER : settingsTarget) ?? ConfigurationTarget.USER_LOCAL;
    const overrides = { resource, overrideIdentifiers: languageFilter ? [languageFilter] : void 0 };
    const configurationTargetIsWorkspace = configurationTarget === ConfigurationTarget.WORKSPACE || configurationTarget === ConfigurationTarget.WORKSPACE_FOLDER;
    const userPassedInManualReset = configurationTargetIsWorkspace || !!languageFilter;
    const isManualReset = userPassedInManualReset ? manualReset : value === void 0;
    const inspected = this.configurationService.inspect(key, overrides);
    if (!userPassedInManualReset && inspected.defaultValue === value) {
      value = void 0;
    }
    return this.configurationService.updateValue(key, value, overrides, configurationTarget, { handleDirtyFile: "save" }).then(() => {
      const query = this.searchWidget.getValue();
      if (query.includes(`@${MODIFIED_SETTING_TAG}`)) {
        this.refreshTOCTree();
      }
      this.renderTree(key, isManualReset);
      this.pendingSettingUpdate = null;
      const reportModifiedProps = {
        key,
        query,
        searchResults: this.searchResultModel?.getUniqueResults() ?? null,
        rawResults: this.searchResultModel?.getRawResults() ?? null,
        showConfiguredOnly: !!this.viewState.tagFilters && this.viewState.tagFilters.has(MODIFIED_SETTING_TAG),
        isReset: typeof value === "undefined",
        settingsTarget: this.settingsTargetsWidget.settingsTarget
      };
      return this.reportModifiedSetting(reportModifiedProps);
    });
  }
  reportModifiedSetting(props) {
    let groupId = void 0;
    let nlpIndex = void 0;
    let displayIndex = void 0;
    if (props.searchResults) {
      displayIndex = props.searchResults.filterMatches.findIndex((m) => m.setting.key === props.key);
      if (this.searchResultModel) {
        const rawResults = this.searchResultModel.getRawResults();
        if (rawResults[SearchResultIdx.Local] && displayIndex >= 0) {
          const settingInLocalResults = rawResults[SearchResultIdx.Local].filterMatches.some((m) => m.setting.key === props.key);
          groupId = settingInLocalResults ? "local" : "remote";
        }
        if (rawResults[SearchResultIdx.Remote]) {
          const _nlpIndex = rawResults[SearchResultIdx.Remote].filterMatches.findIndex((m) => m.setting.key === props.key);
          nlpIndex = _nlpIndex >= 0 ? _nlpIndex : void 0;
        }
      }
    }
    const reportedTarget = props.settingsTarget === ConfigurationTarget.USER_LOCAL ? "user" : props.settingsTarget === ConfigurationTarget.USER_REMOTE ? "user_remote" : props.settingsTarget === ConfigurationTarget.WORKSPACE ? "workspace" : "folder";
    const data = {
      key: props.key,
      groupId,
      nlpIndex,
      displayIndex,
      showConfiguredOnly: props.showConfiguredOnly,
      isReset: props.isReset,
      target: reportedTarget
    };
    this.telemetryService.publicLog2("settingsEditor.settingModified", data);
  }
  scheduleRefresh(element, key = "") {
    if (key && this.scheduledRefreshes.has(key)) {
      return;
    }
    if (!key) {
      dispose(this.scheduledRefreshes.values());
      this.scheduledRefreshes.clear();
    }
    const store = new DisposableStore();
    const scheduledRefreshTracker = DOM.trackFocus(element);
    store.add(scheduledRefreshTracker);
    store.add(scheduledRefreshTracker.onDidBlur(() => {
      this.scheduledRefreshes.get(key)?.dispose();
      this.scheduledRefreshes.delete(key);
      this.onConfigUpdate(/* @__PURE__ */ new Set([key]));
    }));
    this.scheduledRefreshes.set(key, store);
  }
  createSettingsOrderByTocIndex(resolvedSettingsRoot) {
    const index = /* @__PURE__ */ new Map();
    function indexSettings(resolvedSettingsRoot2, counter = 0) {
      if (resolvedSettingsRoot2.settings) {
        for (const setting of resolvedSettingsRoot2.settings) {
          if (!index.has(setting.key)) {
            index.set(setting.key, counter++);
          }
        }
      }
      if (resolvedSettingsRoot2.children) {
        for (const child of resolvedSettingsRoot2.children) {
          counter = indexSettings(child, counter);
        }
      }
      return counter;
    }
    indexSettings(resolvedSettingsRoot);
    return index;
  }
  refreshModels(resolvedSettingsRoot) {
    this.settingsTreeModel.value.update(resolvedSettingsRoot);
    this.tocTreeModel.settingsTreeRoot = this.settingsTreeModel.value.root;
    this.settingsOrderByTocIndex = this.createSettingsOrderByTocIndex(resolvedSettingsRoot);
  }
  async onConfigUpdate(keys, forceRefresh = false, schemaChange = false) {
    if (keys && this.settingsTreeModel) {
      return this.updateElementsByKey(keys);
    }
    if (!this.defaultSettingsEditorModel) {
      return;
    }
    const groups = this.defaultSettingsEditorModel.settingsGroups.slice(1);
    const coreSettings = groups.filter((g) => !g.extensionInfo);
    const settingsResult = resolveSettingsTree(tocData, coreSettings, this.logService);
    const resolvedSettingsRoot = settingsResult.tree;
    if (settingsResult.leftoverSettings.size && !this.hasWarnedMissingSettings) {
      const settingKeyList = [];
      settingsResult.leftoverSettings.forEach((s) => {
        settingKeyList.push(s.key);
      });
      this.logService.warn(`SettingsEditor2: Settings not included in settingsLayout.ts: ${settingKeyList.join(", ")}`);
      this.hasWarnedMissingSettings = true;
    }
    const additionalGroups = [];
    let setAdditionalGroups = false;
    const toggleData = await getExperimentalExtensionToggleData(this.extensionGalleryService, this.productService);
    if (toggleData && groups.filter((g) => g.extensionInfo).length) {
      for (const key in toggleData.settingsEditorRecommendedExtensions) {
        const extension = toggleData.recommendedExtensionsGalleryInfo[key];
        if (!extension) {
          continue;
        }
        const extensionId = extension.identifier.id;
        await this.refreshInstalledExtensionsList();
        const extensionInstalled = this.installedExtensionIds.includes(extensionId);
        const matchingGroupIndex = groups.findIndex(
          (g) => g.extensionInfo && g.extensionInfo.id.toLowerCase() === extensionId.toLowerCase() && g.sections.length === 1 && g.sections[0].settings.length === 1 && g.sections[0].settings[0].displayExtensionId
        );
        if (extensionInstalled || this.dismissedExtensionSettings.includes(extensionId)) {
          if (matchingGroupIndex !== -1) {
            groups.splice(matchingGroupIndex, 1);
            setAdditionalGroups = true;
          }
          continue;
        }
        if (matchingGroupIndex !== -1) {
          continue;
        }
        let manifest = null;
        try {
          manifest = await raceTimeout(
            this.extensionGalleryService.getManifest(extension, CancellationToken.None),
            EXTENSION_FETCH_TIMEOUT_MS
          ) ?? null;
        } catch (e) {
          continue;
        }
        if (manifest === null) {
          continue;
        }
        const contributesConfiguration = manifest?.contributes?.configuration;
        let groupTitle;
        if (!Array.isArray(contributesConfiguration)) {
          groupTitle = contributesConfiguration?.title;
        } else if (contributesConfiguration.length === 1) {
          groupTitle = contributesConfiguration[0].title;
        }
        const recommendationInfo = toggleData.settingsEditorRecommendedExtensions[key];
        const extensionName = extension.displayName ?? extension.name ?? extensionId;
        const settingKey = `${key}.manageExtension`;
        const setting = {
          range: nullRange,
          key: settingKey,
          keyRange: nullRange,
          value: null,
          valueRange: nullRange,
          description: [recommendationInfo.onSettingsEditorOpen?.descriptionOverride ?? extension.description],
          descriptionIsMarkdown: false,
          descriptionRanges: [],
          scope: ConfigurationScope.WINDOW,
          type: "null",
          displayExtensionId: extensionId,
          extensionGroupTitle: groupTitle ?? extensionName,
          categoryLabel: "Extensions",
          title: extensionName
        };
        const additionalGroup = {
          sections: [{
            settings: [setting]
          }],
          id: extensionId,
          title: setting.extensionGroupTitle,
          titleRange: nullRange,
          range: nullRange,
          extensionInfo: {
            id: extensionId,
            displayName: extension.displayName
          }
        };
        groups.push(additionalGroup);
        additionalGroups.push(additionalGroup);
        setAdditionalGroups = true;
      }
    }
    resolvedSettingsRoot.children.push(await createTocTreeForExtensionSettings(this.extensionService, groups.filter((g) => g.extensionInfo)));
    const commonlyUsedDataToUse = getCommonlyUsedData(toggleData);
    const commonlyUsed = resolveSettingsTree(commonlyUsedDataToUse, groups, this.logService);
    resolvedSettingsRoot.children.unshift(commonlyUsed.tree);
    if (toggleData && setAdditionalGroups) {
      this.defaultSettingsEditorModel.setAdditionalGroups(additionalGroups);
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && (this.viewState.settingsTarget instanceof URI || this.viewState.settingsTarget === ConfigurationTarget.WORKSPACE)) {
      const configuredUntrustedWorkspaceSettings = resolveConfiguredUntrustedSettings(groups, this.viewState.settingsTarget, this.viewState.languageFilter, this.configurationService);
      if (configuredUntrustedWorkspaceSettings.length) {
        resolvedSettingsRoot.children.unshift({
          id: "workspaceTrust",
          label: localize("settings require trust", "Workspace Trust"),
          settings: configuredUntrustedWorkspaceSettings
        });
      }
    }
    this.searchResultModel?.updateChildren();
    if (this.settingsTreeModel.value) {
      this.refreshModels(resolvedSettingsRoot);
      if (schemaChange && this.searchResultModel) {
        return await this.onSearchInputChanged();
      }
      this.refreshTOCTree();
      this.renderTree(void 0, forceRefresh);
    } else {
      this.settingsTreeModel.value = this.instantiationService.createInstance(SettingsTreeModel, this.viewState, this.workspaceTrustManagementService.isWorkspaceTrusted());
      this.refreshModels(resolvedSettingsRoot);
      const cachedState = !this.viewState.query ? this.restoreCachedState() : void 0;
      if (cachedState?.searchQuery || this.searchWidget.getValue()) {
        await this.onSearchInputChanged();
      } else {
        this.refreshTOCTree();
        this.refreshTree();
        this.tocTree.collapseAll();
      }
    }
  }
  updateElementsByKey(keys) {
    if (keys.size) {
      if (this.searchResultModel) {
        keys.forEach((key) => this.searchResultModel.updateElementsByName(key));
      }
      if (this.settingsTreeModel.value) {
        keys.forEach((key) => this.settingsTreeModel.value.updateElementsByName(key));
      }
      keys.forEach((key) => this.renderTree(key));
    } else {
      this.renderTree();
    }
  }
  getActiveControlInSettingsTree() {
    const element = this.settingsTree.getHTMLElement();
    const activeElement = element.ownerDocument.activeElement;
    return activeElement && DOM.isAncestorOfActiveElement(element) ? activeElement : null;
  }
  renderTree(key, force = false) {
    if (!force && key && this.scheduledRefreshes.has(key)) {
      this.updateModifiedLabelForKey(key);
      return;
    }
    if (this.contextViewFocused()) {
      const element = this.window.document.querySelector(".context-view");
      if (element) {
        this.scheduleRefresh(element, key);
      }
      return;
    }
    const activeElement = this.getActiveControlInSettingsTree();
    const focusedSetting = activeElement && this.settingRenderers.getSettingDOMElementForDOMElement(activeElement);
    if (focusedSetting && !force) {
      if (key) {
        const focusedKey = focusedSetting.getAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR);
        if (focusedKey === key && // update `list`s live, as they have a separate "submit edit" step built in before this
        (focusedSetting.parentElement && !focusedSetting.parentElement.classList.contains("setting-item-list"))) {
          this.updateModifiedLabelForKey(key);
          this.scheduleRefresh(focusedSetting, key);
          return;
        }
      } else {
        this.scheduleRefresh(focusedSetting);
        return;
      }
    }
    this.renderResultCountMessages();
    if (key) {
      const elements = this.currentSettingsModel?.getElementsByName(key);
      if (elements?.length) {
        if (elements.length >= 2) {
          console.warn("More than one setting with key " + key + " found");
        }
        this.refreshSingleElement(elements[0]);
      } else {
        return;
      }
    } else {
      this.refreshTree();
    }
    return;
  }
  contextViewFocused() {
    return !!DOM.findParentWithClass(this.rootElement.ownerDocument.activeElement, "context-view");
  }
  refreshSingleElement(element) {
    if (this.isVisible()) {
      if (!element.setting.deprecationMessage || element.isConfigured) {
        this.settingsTree.rerender(element);
      }
    }
  }
  refreshTree() {
    if (this.isVisible() && this.currentSettingsModel) {
      this.settingsTree.setChildren(null, createGroupIterator(this.currentSettingsModel.root));
    }
  }
  refreshTOCTree() {
    if (this.isVisible()) {
      this.tocTreeModel.update();
      this.tocTree.setChildren(null, createTOCIterator(this.tocTreeModel, this.tocTree));
    }
  }
  updateModifiedLabelForKey(key) {
    if (!this.currentSettingsModel) {
      return;
    }
    const dataElements = this.currentSettingsModel.getElementsByName(key);
    const isModified = dataElements && dataElements[0] && dataElements[0].isConfigured;
    const elements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), key);
    if (elements && elements[0]) {
      elements[0].classList.toggle("is-configured", !!isModified);
    }
  }
  async onSearchInputChanged() {
    if (!this.currentSettingsModel) {
      return;
    }
    const query = this.searchWidget.getValue().trim();
    this.viewState.query = query;
    await this.triggerSearch(query.replace(/\u203A/g, " "));
  }
  parseSettingFromJSON(query) {
    const match = query.match(/"([a-zA-Z.]+)": /);
    return match && match[1];
  }
  /**
   * Toggles the visibility of the Settings editor table of contents during a search
   * depending on the behavior.
   */
  toggleTocBySearchBehaviorType() {
    const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
    const hideToc = tocBehavior === "hide";
    if (hideToc) {
      this.splitView.setViewVisible(0, false);
      this.splitView.style({
        separatorBorder: Color.transparent
      });
    } else {
      this.layoutSplitView(this.dimension);
    }
  }
  async triggerSearch(query) {
    const progressRunner = this.editorProgressService.show(true, 800);
    this.viewState.tagFilters = /* @__PURE__ */ new Set();
    this.viewState.extensionFilters = /* @__PURE__ */ new Set();
    this.viewState.featureFilters = /* @__PURE__ */ new Set();
    this.viewState.idFilters = /* @__PURE__ */ new Set();
    this.viewState.languageFilter = void 0;
    if (query) {
      const parsedQuery = parseQuery(query);
      query = parsedQuery.query;
      parsedQuery.tags.forEach((tag) => this.viewState.tagFilters.add(tag));
      parsedQuery.extensionFilters.forEach((extensionId) => this.viewState.extensionFilters.add(extensionId));
      parsedQuery.featureFilters.forEach((feature) => this.viewState.featureFilters.add(feature));
      parsedQuery.idFilters.forEach((id) => this.viewState.idFilters.add(id));
      this.viewState.languageFilter = parsedQuery.languageFilter;
    }
    this.settingsTargetsWidget.updateLanguageFilterIndicators(this.viewState.languageFilter);
    if (query && query !== "@") {
      query = this.parseSettingFromJSON(query) || query;
      await this.triggerFilterPreferences(query);
      this.toggleTocBySearchBehaviorType();
    } else {
      if (this.viewState.tagFilters.size || this.viewState.extensionFilters.size || this.viewState.featureFilters.size || this.viewState.idFilters.size || this.viewState.languageFilter) {
        this.searchResultModel = this.createFilterModel();
      } else {
        this.searchResultModel = null;
      }
      this.searchDelayer.cancel();
      if (this.searchInProgress) {
        this.searchInProgress.dispose(true);
        this.searchInProgress = null;
      }
      this.tocTree.setFocus([]);
      this.viewState.filterToCategory = void 0;
      this.tocTreeModel.currentSearchModel = this.searchResultModel;
      if (this.searchResultModel) {
        this.tocTree.setSelection([]);
        this.tocTree.expandAll();
        this.refreshTOCTree();
        this.renderResultCountMessages();
        this.refreshTree();
        this.toggleTocBySearchBehaviorType();
      } else if (!this.tocTreeDisposed) {
        this.tocTree.collapseAll();
        this.refreshTOCTree();
        this.renderResultCountMessages();
        this.refreshTree();
        this.layoutSplitView(this.dimension);
      }
    }
    progressRunner.done();
  }
  /**
   * Return a fake SearchResultModel which can hold a flat list of all settings, to be filtered (@modified etc)
   */
  createFilterModel() {
    const filterModel = this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
    const fullResult = {
      filterMatches: [],
      exactMatch: false
    };
    for (const g of this.defaultSettingsEditorModel.settingsGroups.slice(1)) {
      for (const sect of g.sections) {
        for (const setting of sect.settings) {
          fullResult.filterMatches.push({ setting, matches: [], matchType: SettingMatchType.None, keyMatchScore: 0, score: 0 });
        }
      }
    }
    filterModel.setResult(0, fullResult);
    return filterModel;
  }
  async triggerFilterPreferences(query) {
    if (this.searchInProgress) {
      this.searchInProgress.dispose(true);
      this.searchInProgress = null;
    }
    const searchInProgress = this.searchInProgress = new CancellationTokenSource();
    return this.searchDelayer.trigger(async () => {
      if (searchInProgress.token.isCancellationRequested) {
        return;
      }
      const localResults = await this.localFilterPreferences(query, searchInProgress.token);
      if (localResults && !localResults.exactMatch && !searchInProgress.token.isCancellationRequested) {
        await this.remoteSearchPreferences(query, searchInProgress.token);
      }
      this.onDidFinishSearch();
    });
  }
  onDidFinishSearch() {
    this.tocTreeModel.currentSearchModel = this.searchResultModel;
    this.tocTreeModel.update();
    this.tocTree.setFocus([]);
    this.viewState.filterToCategory = void 0;
    this.tocTree.expandAll();
    this.settingsTree.scrollTop = 0;
    this.refreshTOCTree();
    this.renderTree(void 0, true);
  }
  localFilterPreferences(query, token) {
    const localSearchProvider = this.preferencesSearchService.getLocalSearchProvider(query);
    return this.searchWithProvider(SearchResultIdx.Local, localSearchProvider, token);
  }
  remoteSearchPreferences(query, token) {
    const remoteSearchProvider = this.preferencesSearchService.getRemoteSearchProvider(query);
    if (!remoteSearchProvider) {
      return Promise.resolve(null);
    }
    return this.searchWithProvider(SearchResultIdx.Remote, remoteSearchProvider, token);
  }
  async searchWithProvider(type, searchProvider, token) {
    const result = await this._searchPreferencesModel(this.defaultSettingsEditorModel, searchProvider, token);
    if (token.isCancellationRequested) {
      return null;
    }
    this.searchResultModel ??= this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
    this.searchResultModel.setResult(type, result);
    return result;
  }
  renderResultCountMessages() {
    if (!this.currentSettingsModel) {
      return;
    }
    this.clearFilterLinkContainer.style.display = this.viewState.tagFilters && this.viewState.tagFilters.size > 0 ? "initial" : "none";
    if (!this.searchResultModel) {
      if (this.countElement.style.display !== "none") {
        this.searchResultLabel = null;
        this.updateInputAriaLabel();
        this.countElement.style.display = "none";
        this.countElement.innerText = "";
        this.layout(this.dimension);
      }
      this.rootElement.classList.remove("no-results");
      this.splitView.el.style.visibility = "visible";
      return;
    } else {
      const count = this.searchResultModel.getUniqueResultsCount();
      let resultString;
      switch (count) {
        case 0:
          resultString = localize("noResults", "No Settings Found");
          break;
        case 1:
          resultString = localize("oneResult", "1 Setting Found");
          break;
        default:
          resultString = localize("moreThanOneResult", "{0} Settings Found", count);
      }
      this.searchResultLabel = resultString;
      this.updateInputAriaLabel();
      this.countElement.innerText = resultString;
      aria.status(resultString);
      if (this.countElement.style.display !== "block") {
        this.countElement.style.display = "block";
        this.layout(this.dimension);
      }
      this.rootElement.classList.toggle("no-results", count === 0);
      this.splitView.el.style.visibility = count === 0 ? "hidden" : "visible";
    }
  }
  async _searchPreferencesModel(model, provider, token) {
    try {
      return await provider.searchModel(model, token);
    } catch (err) {
      if (isCancellationError(err)) {
        return Promise.reject(err);
      } else {
        return null;
      }
    }
  }
  layoutSplitView(dimension) {
    if (!this.isVisible()) {
      return;
    }
    const listHeight = dimension.height - (72 + 11 + 14);
    this.splitView.el.style.height = `${listHeight}px`;
    this.splitView.layout(this.bodyContainer.clientWidth, listHeight);
    const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
    const hideTocForSearch = tocBehavior === "hide" && this.searchResultModel;
    if (!hideTocForSearch) {
      const firstViewWasVisible = this.splitView.isViewVisible(0);
      const firstViewVisible = this.bodyContainer.clientWidth >= SettingsEditor2.NARROW_TOTAL_WIDTH;
      this.splitView.setViewVisible(0, firstViewVisible);
      if (!firstViewWasVisible && firstViewVisible && this.bodyContainer.clientWidth >= SettingsEditor2.EDITOR_MIN_WIDTH + SettingsEditor2.TOC_RESET_WIDTH) {
        this.splitView.resizeView(0, SettingsEditor2.TOC_RESET_WIDTH);
      }
      this.splitView.style({
        separatorBorder: firstViewVisible ? this.theme.getColor(settingsSashBorder) : Color.transparent
      });
    }
  }
  saveState() {
    if (this.isVisible()) {
      const searchQuery = this.searchWidget.getValue().trim();
      const target = this.settingsTargetsWidget.settingsTarget;
      if (this.input) {
        this.editorMemento.saveEditorState(this.group, this.input, { searchQuery, target });
      }
    } else if (this.input) {
      this.editorMemento.clearEditorState(this.input, this.group);
    }
    super.saveState();
  }
};
SettingsEditor2.ID = "workbench.editor.settings2";
SettingsEditor2.NUM_INSTANCES = 0;
SettingsEditor2.SEARCH_DEBOUNCE = 200;
SettingsEditor2.SETTING_UPDATE_FAST_DEBOUNCE = 200;
SettingsEditor2.SETTING_UPDATE_SLOW_DEBOUNCE = 1e3;
SettingsEditor2.CONFIG_SCHEMA_UPDATE_DELAYER = 500;
SettingsEditor2.TOC_MIN_WIDTH = 100;
SettingsEditor2.TOC_RESET_WIDTH = 200;
SettingsEditor2.EDITOR_MIN_WIDTH = 500;
// Below NARROW_TOTAL_WIDTH, we only render the editor rather than the ToC.
SettingsEditor2.NARROW_TOTAL_WIDTH = SettingsEditor2.TOC_RESET_WIDTH + SettingsEditor2.EDITOR_MIN_WIDTH;
SettingsEditor2.SUGGESTIONS = [
  `@${MODIFIED_SETTING_TAG}`,
  "@tag:notebookLayout",
  "@tag:notebookOutputLayout",
  `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}`,
  `@tag:${WORKSPACE_TRUST_SETTING_TAG}`,
  "@tag:sync",
  "@tag:usesOnlineServices",
  "@tag:telemetry",
  "@tag:accessibility",
  "@tag:preview",
  "@tag:experimental",
  `@${ID_SETTING_TAG}`,
  `@${EXTENSION_SETTING_TAG}`,
  `@${FEATURE_SETTING_TAG}scm`,
  `@${FEATURE_SETTING_TAG}explorer`,
  `@${FEATURE_SETTING_TAG}search`,
  `@${FEATURE_SETTING_TAG}debug`,
  `@${FEATURE_SETTING_TAG}extensions`,
  `@${FEATURE_SETTING_TAG}terminal`,
  `@${FEATURE_SETTING_TAG}task`,
  `@${FEATURE_SETTING_TAG}problems`,
  `@${FEATURE_SETTING_TAG}output`,
  `@${FEATURE_SETTING_TAG}comments`,
  `@${FEATURE_SETTING_TAG}remote`,
  `@${FEATURE_SETTING_TAG}timeline`,
  `@${FEATURE_SETTING_TAG}notebook`,
  `@${POLICY_SETTING_TAG}`
];
SettingsEditor2 = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, ITextResourceConfigurationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IPreferencesService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IPreferencesSearchService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IEditorGroupsService),
  __decorateParam(12, IUserDataSyncWorkbenchService),
  __decorateParam(13, IUserDataSyncEnablementService),
  __decorateParam(14, IWorkspaceTrustManagementService),
  __decorateParam(15, IExtensionService),
  __decorateParam(16, ILanguageService),
  __decorateParam(17, IExtensionManagementService),
  __decorateParam(18, IProductService),
  __decorateParam(19, IExtensionGalleryService),
  __decorateParam(20, IEditorProgressService),
  __decorateParam(21, IUserDataProfileService)
], SettingsEditor2);
let SyncControls = class extends Disposable {
  constructor(window, container, commandService, userDataSyncService, userDataSyncEnablementService, telemetryService) {
    super();
    this.commandService = commandService;
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this._onDidChangeLastSyncedLabel = this._register(new Emitter());
    this.onDidChangeLastSyncedLabel = this._onDidChangeLastSyncedLabel.event;
    const headerRightControlsContainer = DOM.append(container, $(".settings-right-controls"));
    const turnOnSyncButtonContainer = DOM.append(headerRightControlsContainer, $(".turn-on-sync"));
    this.turnOnSyncButton = this._register(new Button(turnOnSyncButtonContainer, { title: true, ...defaultButtonStyles }));
    this.lastSyncedLabel = DOM.append(headerRightControlsContainer, $(".last-synced-label"));
    DOM.hide(this.lastSyncedLabel);
    this.turnOnSyncButton.enabled = true;
    this.turnOnSyncButton.label = localize("turnOnSyncButton", "Backup and Sync Settings");
    DOM.hide(this.turnOnSyncButton.element);
    this._register(this.turnOnSyncButton.onDidClick(async () => {
      await this.commandService.executeCommand("workbench.userDataSync.actions.turnOn");
    }));
    this.updateLastSyncedTime();
    this._register(this.userDataSyncService.onDidChangeLastSyncTime(() => {
      this.updateLastSyncedTime();
    }));
    const updateLastSyncedTimer = this._register(new DOM.WindowIntervalTimer());
    updateLastSyncedTimer.cancelAndSet(() => this.updateLastSyncedTime(), 60 * 1e3, window);
    this.update();
    this._register(this.userDataSyncService.onDidChangeStatus(() => {
      this.update();
    }));
    this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
      this.update();
    }));
  }
  updateLastSyncedTime() {
    const last = this.userDataSyncService.lastSyncTime;
    let label;
    if (typeof last === "number") {
      const d = fromNow(last, true, void 0, true);
      label = localize("lastSyncedLabel", "Last synced: {0}", d);
    } else {
      label = "";
    }
    this.lastSyncedLabel.textContent = label;
    this._onDidChangeLastSyncedLabel.fire(label);
  }
  update() {
    if (this.userDataSyncService.status === SyncStatus.Uninitialized) {
      return;
    }
    if (this.userDataSyncEnablementService.isEnabled() || this.userDataSyncService.status !== SyncStatus.Idle) {
      DOM.show(this.lastSyncedLabel);
      DOM.hide(this.turnOnSyncButton.element);
    } else {
      DOM.hide(this.lastSyncedLabel);
      DOM.show(this.turnOnSyncButton.element);
    }
  }
};
SyncControls = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IUserDataSyncService),
  __decorateParam(4, IUserDataSyncEnablementService),
  __decorateParam(5, ITelemetryService)
], SyncControls);
export {
  SettingsEditor2,
  SettingsFocusContext,
  createGroupIterator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzRWRpdG9yMi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBJVHJlZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRGVsYXllciwgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZnJvbU5vdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGUuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgdHlwZSBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAnLi9tZWRpYS9zZXR0aW5nc0VkaXRvcjIuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblVwZGF0ZU92ZXJyaWRlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGJhZGdlQmFja2dyb3VuZCwgYmFkZ2VGb3JlZ3JvdW5kLCBjb250cmFzdEJvcmRlciwgZWRpdG9yRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsIElVc2VyRGF0YVN5bmNTZXJ2aWNlLCBTeW5jU3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvck1lbWVudG8sIElFZGl0b3JPcGVuQ29udGV4dCwgSUVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFN1Z2dlc3RFbmFibGVkSW5wdXQgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvc3VnZ2VzdEVuYWJsZWRJbnB1dC9zdWdnZXN0RW5hYmxlZElucHV0LmpzJztcbmltcG9ydCB7IFNldHRpbmdzVGFyZ2V0LCBTZXR0aW5nc1RhcmdldHNXaWRnZXQgfSBmcm9tICcuL3ByZWZlcmVuY2VzV2lkZ2V0cy5qcyc7XG5pbXBvcnQgeyBJVE9DRW50cnksIGdldENvbW1vbmx5VXNlZERhdGEsIHRvY0RhdGEgfSBmcm9tICcuL3NldHRpbmdzTGF5b3V0LmpzJztcbmltcG9ydCB7IEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLCBIZWlnaHRDaGFuZ2VQYXJhbXMsIElTZXR0aW5nTGlua0NsaWNrRXZlbnQsIHJlc29sdmVDb25maWd1cmVkVW50cnVzdGVkU2V0dGluZ3MsIGNyZWF0ZVRvY1RyZWVGb3JFeHRlbnNpb25TZXR0aW5ncywgcmVzb2x2ZVNldHRpbmdzVHJlZSwgU2V0dGluZ3NUcmVlLCBTZXR0aW5nVHJlZVJlbmRlcmVycyB9IGZyb20gJy4vc2V0dGluZ3NUcmVlLmpzJztcbmltcG9ydCB7IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSwgcGFyc2VRdWVyeSwgU2VhcmNoUmVzdWx0SWR4LCBTZWFyY2hSZXN1bHRNb2RlbCwgU2V0dGluZ3NUcmVlRWxlbWVudCwgU2V0dGluZ3NUcmVlR3JvdXBDaGlsZCwgU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50LCBTZXR0aW5nc1RyZWVNb2RlbCwgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQgfSBmcm9tICcuL3NldHRpbmdzVHJlZU1vZGVscy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUT0NJdGVyYXRvciwgVE9DVHJlZSwgVE9DVHJlZU1vZGVsIH0gZnJvbSAnLi90b2NUcmVlLmpzJztcbmltcG9ydCB7IENPTlRFWFRfU0VUVElOR1NfRURJVE9SLCBDT05URVhUX1NFVFRJTkdTX1JPV19GT0NVUywgQ09OVEVYVF9TRVRUSU5HU19TRUFSQ0hfRk9DVVMsIENPTlRFWFRfVE9DX1JPV19GT0NVUywgRU5BQkxFX0xBTkdVQUdFX0ZJTFRFUiwgRVhURU5TSU9OX0ZFVENIX1RJTUVPVVRfTVMsIEVYVEVOU0lPTl9TRVRUSU5HX1RBRywgRkVBVFVSRV9TRVRUSU5HX1RBRywgSURfU0VUVElOR19UQUcsIElQcmVmZXJlbmNlc1NlYXJjaFNlcnZpY2UsIElTZWFyY2hQcm92aWRlciwgTEFOR1VBR0VfU0VUVElOR19UQUcsIE1PRElGSUVEX1NFVFRJTkdfVEFHLCBQT0xJQ1lfU0VUVElOR19UQUcsIFJFUVVJUkVfVFJVU1RFRF9XT1JLU1BBQ0VfU0VUVElOR19UQUcsIFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9SRVNVTFRTLCBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9TVUdHRVNUX0ZJTFRFUlMsIFdPUktTUEFDRV9UUlVTVF9TRVRUSU5HX1RBRywgZ2V0RXhwZXJpbWVudGFsRXh0ZW5zaW9uVG9nZ2xlRGF0YSB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBzZXR0aW5nc0hlYWRlckJvcmRlciwgc2V0dGluZ3NTYXNoQm9yZGVyLCBzZXR0aW5nc1RleHRJbnB1dEJvcmRlciB9IGZyb20gJy4uL2NvbW1vbi9zZXR0aW5nc0VkaXRvckNvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3BlblNldHRpbmdzT3B0aW9ucywgSVByZWZlcmVuY2VzU2VydmljZSwgSVNlYXJjaFJlc3VsdCwgSVNldHRpbmcsIElTZXR0aW5nc0VkaXRvck1vZGVsLCBJU2V0dGluZ3NFZGl0b3JPcHRpb25zLCBJU2V0dGluZ3NHcm91cCwgU2V0dGluZ01hdGNoVHlwZSwgU2V0dGluZ1ZhbHVlVHlwZSwgdmFsaWRhdGVTZXR0aW5nc0VkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NFZGl0b3IySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXNFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nczJFZGl0b3JNb2RlbCwgbnVsbFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzTW9kZWxzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgcHJlZmVyZW5jZXNDbGVhcklucHV0SWNvbiwgcHJlZmVyZW5jZXNGaWx0ZXJJY29uIH0gZnJvbSAnLi9wcmVmZXJlbmNlc0ljb25zLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBBUFBMSUNBVElPTl9TQ09QRVMsIElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiwgU2l6aW5nLCBTcGxpdFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc1NlYXJjaEZpbHRlckRyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi9zZXR0aW5nc1NlYXJjaE1lbnUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIElHYWxsZXJ5RXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJU2V0dGluZ092ZXJyaWRlQ2xpY2tFdmVudCB9IGZyb20gJy4vc2V0dGluZ3NFZGl0b3JTZXR0aW5nSW5kaWNhdG9ycy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aWRnZXROYXZpZ2F0aW9uQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENvZGVXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuXG5cbmV4cG9ydCBjb25zdCBlbnVtIFNldHRpbmdzRm9jdXNDb250ZXh0IHtcblx0U2VhcmNoLFxuXHRUYWJsZU9mQ29udGVudHMsXG5cdFNldHRpbmdUcmVlLFxuXHRTZXR0aW5nQ29udHJvbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR3JvdXBJdGVyYXRvcihncm91cDogU2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50KTogSXRlcmFibGU8SVRyZWVFbGVtZW50PFNldHRpbmdzVHJlZUdyb3VwQ2hpbGQ+PiB7XG5cdHJldHVybiBJdGVyYWJsZS5tYXAoZ3JvdXAuY2hpbGRyZW4sIGcgPT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50OiBnLFxuXHRcdFx0Y2hpbGRyZW46IGcgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQgP1xuXHRcdFx0XHRjcmVhdGVHcm91cEl0ZXJhdG9yKGcpIDpcblx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0fTtcblx0fSk7XG59XG5cbmNvbnN0ICQgPSBET00uJDtcblxuaW50ZXJmYWNlIElGb2N1c0V2ZW50RnJvbVNjcm9sbCBleHRlbmRzIEtleWJvYXJkRXZlbnQge1xuXHRmcm9tU2Nyb2xsOiB0cnVlO1xufVxuXG5jb25zdCBzZWFyY2hCb3hMYWJlbCA9IGxvY2FsaXplKCdTZWFyY2hTZXR0aW5ncy5BcmlhTGFiZWwnLCBcIlNlYXJjaCBzZXR0aW5nc1wiKTtcbmNvbnN0IFNFQVJDSF9UT0NfQkVIQVZJT1JfS0VZID0gJ3dvcmtiZW5jaC5zZXR0aW5ncy5zZXR0aW5nc1NlYXJjaFRvY0JlaGF2aW9yJztcblxuY29uc3QgU0VUVElOR1NfRURJVE9SX1NUQVRFX0tFWSA9ICdzZXR0aW5nc0VkaXRvclN0YXRlJztcbmV4cG9ydCBjbGFzcyBTZXR0aW5nc0VkaXRvcjIgZXh0ZW5kcyBFZGl0b3JQYW5lIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2guZWRpdG9yLnNldHRpbmdzMic7XG5cdHByaXZhdGUgc3RhdGljIE5VTV9JTlNUQU5DRVM6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgc3RhdGljIFNFQVJDSF9ERUJPVU5DRTogbnVtYmVyID0gMjAwO1xuXHRwcml2YXRlIHN0YXRpYyBTRVRUSU5HX1VQREFURV9GQVNUX0RFQk9VTkNFOiBudW1iZXIgPSAyMDA7XG5cdHByaXZhdGUgc3RhdGljIFNFVFRJTkdfVVBEQVRFX1NMT1dfREVCT1VOQ0U6IG51bWJlciA9IDEwMDA7XG5cdHByaXZhdGUgc3RhdGljIENPTkZJR19TQ0hFTUFfVVBEQVRFX0RFTEFZRVIgPSA1MDA7XG5cdHByaXZhdGUgc3RhdGljIFRPQ19NSU5fV0lEVEg6IG51bWJlciA9IDEwMDtcblx0cHJpdmF0ZSBzdGF0aWMgVE9DX1JFU0VUX1dJRFRIOiBudW1iZXIgPSAyMDA7XG5cdHByaXZhdGUgc3RhdGljIEVESVRPUl9NSU5fV0lEVEg6IG51bWJlciA9IDUwMDtcblx0Ly8gQmVsb3cgTkFSUk9XX1RPVEFMX1dJRFRILCB3ZSBvbmx5IHJlbmRlciB0aGUgZWRpdG9yIHJhdGhlciB0aGFuIHRoZSBUb0MuXG5cdHByaXZhdGUgc3RhdGljIE5BUlJPV19UT1RBTF9XSURUSDogbnVtYmVyID0gdGhpcy5UT0NfUkVTRVRfV0lEVEggKyB0aGlzLkVESVRPUl9NSU5fV0lEVEg7XG5cblx0cHJpdmF0ZSBzdGF0aWMgU1VHR0VTVElPTlM6IHN0cmluZ1tdID0gW1xuXHRcdGBAJHtNT0RJRklFRF9TRVRUSU5HX1RBR31gLFxuXHRcdCdAdGFnOm5vdGVib29rTGF5b3V0Jyxcblx0XHQnQHRhZzpub3RlYm9va091dHB1dExheW91dCcsXG5cdFx0YEB0YWc6JHtSRVFVSVJFX1RSVVNURURfV09SS1NQQUNFX1NFVFRJTkdfVEFHfWAsXG5cdFx0YEB0YWc6JHtXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUd9YCxcblx0XHQnQHRhZzpzeW5jJyxcblx0XHQnQHRhZzp1c2VzT25saW5lU2VydmljZXMnLFxuXHRcdCdAdGFnOnRlbGVtZXRyeScsXG5cdFx0J0B0YWc6YWNjZXNzaWJpbGl0eScsXG5cdFx0J0B0YWc6cHJldmlldycsXG5cdFx0J0B0YWc6ZXhwZXJpbWVudGFsJyxcblx0XHRgQCR7SURfU0VUVElOR19UQUd9YCxcblx0XHRgQCR7RVhURU5TSU9OX1NFVFRJTkdfVEFHfWAsXG5cdFx0YEAke0ZFQVRVUkVfU0VUVElOR19UQUd9c2NtYCxcblx0XHRgQCR7RkVBVFVSRV9TRVRUSU5HX1RBR31leHBsb3JlcmAsXG5cdFx0YEAke0ZFQVRVUkVfU0VUVElOR19UQUd9c2VhcmNoYCxcblx0XHRgQCR7RkVBVFVSRV9TRVRUSU5HX1RBR31kZWJ1Z2AsXG5cdFx0YEAke0ZFQVRVUkVfU0VUVElOR19UQUd9ZXh0ZW5zaW9uc2AsXG5cdFx0YEAke0ZFQVRVUkVfU0VUVElOR19UQUd9dGVybWluYWxgLFxuXHRcdGBAJHtGRUFUVVJFX1NFVFRJTkdfVEFHfXRhc2tgLFxuXHRcdGBAJHtGRUFUVVJFX1NFVFRJTkdfVEFHfXByb2JsZW1zYCxcblx0XHRgQCR7RkVBVFVSRV9TRVRUSU5HX1RBR31vdXRwdXRgLFxuXHRcdGBAJHtGRUFUVVJFX1NFVFRJTkdfVEFHfWNvbW1lbnRzYCxcblx0XHRgQCR7RkVBVFVSRV9TRVRUSU5HX1RBR31yZW1vdGVgLFxuXHRcdGBAJHtGRUFUVVJFX1NFVFRJTkdfVEFHfXRpbWVsaW5lYCxcblx0XHRgQCR7RkVBVFVSRV9TRVRUSU5HX1RBR31ub3RlYm9va2AsXG5cdFx0YEAke1BPTElDWV9TRVRUSU5HX1RBR31gXG5cdF07XG5cblx0cHJpdmF0ZSBzdGF0aWMgc2hvdWxkU2V0dGluZ1VwZGF0ZUZhc3QodHlwZTogU2V0dGluZ1ZhbHVlVHlwZSB8IFNldHRpbmdWYWx1ZVR5cGVbXSk6IGJvb2xlYW4ge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHR5cGUpKSB7XG5cdFx0XHQvLyBudWxsYWJsZSBpbnRlZ2VyL251bWJlciBvciBjb21wbGV4XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLkVudW0gfHxcblx0XHRcdHR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuQXJyYXkgfHxcblx0XHRcdHR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuQm9vbGVhbk9iamVjdCB8fFxuXHRcdFx0dHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5PYmplY3QgfHxcblx0XHRcdHR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuQ29tcGxleCB8fFxuXHRcdFx0dHlwZSA9PT0gU2V0dGluZ1ZhbHVlVHlwZS5Cb29sZWFuIHx8XG5cdFx0XHR0eXBlID09PSBTZXR0aW5nVmFsdWVUeXBlLkV4Y2x1ZGUgfHxcblx0XHRcdHR5cGUgPT09IFNldHRpbmdWYWx1ZVR5cGUuSW5jbHVkZTtcblx0fVxuXG5cdC8vICghKSBMb3RzIG9mIHByb3BzIHRoYXQgYXJlIHNldCBvbmNlIG9uIHRoZSBmaXJzdCByZW5kZXJcblx0cHJpdmF0ZSBkZWZhdWx0U2V0dGluZ3NFZGl0b3JNb2RlbCE6IFNldHRpbmdzMkVkaXRvck1vZGVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblxuXHRwcml2YXRlIHJvb3RFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaGVhZGVyQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgYm9keUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNlYXJjaFdpZGdldCE6IFN1Z2dlc3RFbmFibGVkSW5wdXQ7XG5cdHByaXZhdGUgY291bnRFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgY29udHJvbHNFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc2V0dGluZ3NUYXJnZXRzV2lkZ2V0ITogU2V0dGluZ3NUYXJnZXRzV2lkZ2V0O1xuXG5cdHByaXZhdGUgc3BsaXRWaWV3ITogU3BsaXRWaWV3PG51bWJlcj47XG5cblx0cHJpdmF0ZSBzZXR0aW5nc1RyZWVDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBzZXR0aW5nc1RyZWUhOiBTZXR0aW5nc1RyZWU7XG5cdHByaXZhdGUgc2V0dGluZ1JlbmRlcmVycyE6IFNldHRpbmdUcmVlUmVuZGVyZXJzO1xuXHRwcml2YXRlIHRvY1RyZWVNb2RlbCE6IFRPQ1RyZWVNb2RlbDtcblx0cHJpdmF0ZSByZWFkb25seSBzZXR0aW5nc1RyZWVNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxTZXR0aW5nc1RyZWVNb2RlbD4oKSk7XG5cdHByaXZhdGUgbm9SZXN1bHRzTWVzc2FnZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGNsZWFyRmlsdGVyTGlua0NvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgdG9jVHJlZUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRvY1RyZWUhOiBUT0NUcmVlO1xuXG5cdHByaXZhdGUgc2VhcmNoRGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBzZWFyY2hJblByb2dyZXNzOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgc2VhcmNoSW5wdXREZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXHRwcml2YXRlIHVwZGF0ZWRDb25maWdTY2hlbWFEZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXG5cdHByaXZhdGUgc2V0dGluZ0Zhc3RVcGRhdGVEZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXHRwcml2YXRlIHNldHRpbmdTbG93VXBkYXRlRGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBwZW5kaW5nU2V0dGluZ1VwZGF0ZTogeyBrZXk6IHN0cmluZzsgdmFsdWU6IGFueTsgbGFuZ3VhZ2VGaWx0ZXI6IHN0cmluZyB8IHVuZGVmaW5lZCB9IHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aWV3U3RhdGU6IElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2VhcmNoUmVzdWx0TW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8U2VhcmNoUmVzdWx0TW9kZWw+KCkpO1xuXHRwcml2YXRlIHNlYXJjaFJlc3VsdExhYmVsOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBsYXN0U3luY2VkTGFiZWw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNldHRpbmdzT3JkZXJCeVRvY0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+IHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSB0b2NSb3dGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBzZXR0aW5nUm93Rm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaW5TZXR0aW5nc0VkaXRvckNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHNlYXJjaEZvY3VzQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBzY2hlZHVsZWRSZWZyZXNoZXM6IE1hcDxzdHJpbmcsIERpc3Bvc2FibGVTdG9yZT47XG5cdHByaXZhdGUgX2N1cnJlbnRGb2N1c0NvbnRleHQ6IFNldHRpbmdzRm9jdXNDb250ZXh0ID0gU2V0dGluZ3NGb2N1c0NvbnRleHQuU2VhcmNoO1xuXG5cdC8qKiBEb24ndCBzcGFtIHdhcm5pbmdzICovXG5cdHByaXZhdGUgaGFzV2FybmVkTWlzc2luZ1NldHRpbmdzID0gZmFsc2U7XG5cdHByaXZhdGUgdG9jVHJlZURpc3Bvc2VkID0gZmFsc2U7XG5cblx0LyoqIFBlcnNpc3QgdGhlIHNlYXJjaCBxdWVyeSB1cG9uIHJlbG9hZHMgKi9cblx0cHJpdmF0ZSBlZGl0b3JNZW1lbnRvOiBJRWRpdG9yTWVtZW50bzxJU2V0dGluZ3NFZGl0b3IyU3RhdGU+O1xuXG5cdHByaXZhdGUgdG9jRm9jdXNlZEVsZW1lbnQ6IFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHRyZWVGb2N1c2VkRWxlbWVudDogU2V0dGluZ3NUcmVlRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNldHRpbmdzVHJlZVNjcm9sbFRvcCA9IDA7XG5cdHByaXZhdGUgZGltZW5zaW9uITogRE9NLkRpbWVuc2lvbjtcblxuXHRwcml2YXRlIGluc3RhbGxlZEV4dGVuc2lvbklkczogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBkaXNtaXNzZWRFeHRlbnNpb25TZXR0aW5nczogc3RyaW5nW10gPSBbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IERJU01JU1NFRF9FWFRFTlNJT05fU0VUVElOR1NfU1RPUkFHRV9LRVkgPSAnc2V0dGluZ3NFZGl0b3IyLmRpc21pc3NlZEV4dGVuc2lvblNldHRpbmdzJztcblx0cHJpdmF0ZSByZWFkb25seSBESVNNSVNTRURfRVhURU5TSU9OX1NFVFRJTkdTX0RFTElNSVRFUiA9ICdcXHQnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXRDaGFuZ2VMaXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGdyb3VwOiBJRWRpdG9yR3JvdXAsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlYXJjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlYXJjaFNlcnZpY2U6IElQcmVmZXJlbmNlc1NlYXJjaFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcm90ZWN0ZWQgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNXb3JrYmVuY2hTZXJ2aWNlOiBJVXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASUVkaXRvclByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclByb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFNldHRpbmdzRWRpdG9yMi5JRCwgZ3JvdXAsIHRlbGVtZXRyeVNlcnZpY2UsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHRoaXMuc2VhcmNoRGVsYXllciA9IG5ldyBEZWxheWVyKDMwMCk7XG5cdFx0dGhpcy52aWV3U3RhdGUgPSB7IHNldHRpbmdzVGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwgfTtcblxuXHRcdHRoaXMuc2V0dGluZ0Zhc3RVcGRhdGVEZWxheWVyID0gbmV3IERlbGF5ZXI8dm9pZD4oU2V0dGluZ3NFZGl0b3IyLlNFVFRJTkdfVVBEQVRFX0ZBU1RfREVCT1VOQ0UpO1xuXHRcdHRoaXMuc2V0dGluZ1Nsb3dVcGRhdGVEZWxheWVyID0gbmV3IERlbGF5ZXI8dm9pZD4oU2V0dGluZ3NFZGl0b3IyLlNFVFRJTkdfVVBEQVRFX1NMT1dfREVCT1VOQ0UpO1xuXG5cdFx0dGhpcy5zZWFyY2hJbnB1dERlbGF5ZXIgPSBuZXcgRGVsYXllcjx2b2lkPihTZXR0aW5nc0VkaXRvcjIuU0VBUkNIX0RFQk9VTkNFKTtcblx0XHR0aGlzLnVwZGF0ZWRDb25maWdTY2hlbWFEZWxheWVyID0gbmV3IERlbGF5ZXI8dm9pZD4oU2V0dGluZ3NFZGl0b3IyLkNPTkZJR19TQ0hFTUFfVVBEQVRFX0RFTEFZRVIpO1xuXG5cdFx0dGhpcy5pblNldHRpbmdzRWRpdG9yQ29udGV4dEtleSA9IENPTlRFWFRfU0VUVElOR1NfRURJVE9SLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hGb2N1c0NvbnRleHRLZXkgPSBDT05URVhUX1NFVFRJTkdTX1NFQVJDSF9GT0NVUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudG9jUm93Rm9jdXNlZCA9IENPTlRFWFRfVE9DX1JPV19GT0NVUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2V0dGluZ1Jvd0ZvY3VzZWQgPSBDT05URVhUX1NFVFRJTkdTX1JPV19GT0NVUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5zY2hlZHVsZWRSZWZyZXNoZXMgPSBuZXcgTWFwPHN0cmluZywgRGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdFx0dGhpcy5lZGl0b3JNZW1lbnRvID0gdGhpcy5nZXRFZGl0b3JNZW1lbnRvPElTZXR0aW5nc0VkaXRvcjJTdGF0ZT4oZWRpdG9yR3JvdXBTZXJ2aWNlLCB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSwgU0VUVElOR1NfRURJVE9SX1NUQVRFX0tFWSk7XG5cblx0XHR0aGlzLmRpc21pc3NlZEV4dGVuc2lvblNldHRpbmdzID0gdGhpcy5zdG9yYWdlU2VydmljZVxuXHRcdFx0LmdldCh0aGlzLkRJU01JU1NFRF9FWFRFTlNJT05fU0VUVElOR1NfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnJylcblx0XHRcdC5zcGxpdCh0aGlzLkRJU01JU1NFRF9FWFRFTlNJT05fU0VUVElOR1NfREVMSU1JVEVSKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnNvdXJjZSAhPT0gQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUKSB7XG5cdFx0XHRcdHRoaXMub25Db25maWdVcGRhdGUoZS5hZmZlY3RlZEtleXMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZShlID0+IHtcblx0XHRcdGUuam9pbih0aGlzLndoZW5DdXJyZW50UHJvZmlsZUNoYW5nZWQoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIod29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KCgpID0+IHtcblx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0TW9kZWw/LnVwZGF0ZVdvcmtzcGFjZVRydXN0KHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpO1xuXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5nc1RyZWVNb2RlbC52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLnNldHRpbmdzVHJlZU1vZGVsLnZhbHVlLnVwZGF0ZVdvcmtzcGFjZVRydXN0KHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpO1xuXHRcdFx0XHR0aGlzLnJlbmRlclRyZWUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZVJlc3RyaWN0ZWRTZXR0aW5ncyhlID0+IHtcblx0XHRcdGlmIChlLmRlZmF1bHQubGVuZ3RoICYmIHRoaXMuY3VycmVudFNldHRpbmdzTW9kZWwpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVFbGVtZW50c0J5S2V5KG5ldyBTZXQoZS5kZWZhdWx0KSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRJbnN0YWxsRXh0ZW5zaW9ucygoKSA9PiB7XG5cdFx0XHR0aGlzLnJlZnJlc2hJbnN0YWxsZWRFeHRlbnNpb25zTGlzdCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbigoKSA9PiB7XG5cdFx0XHR0aGlzLnJlZnJlc2hJbnN0YWxsZWRFeHRlbnNpb25zTGlzdCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMubW9kZWxEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHRpZiAoRU5BQkxFX0xBTkdVQUdFX0ZJTFRFUiAmJiAhU2V0dGluZ3NFZGl0b3IyLlNVR0dFU1RJT05TLmluY2x1ZGVzKGBAJHtMQU5HVUFHRV9TRVRUSU5HX1RBR31gKSkge1xuXHRcdFx0U2V0dGluZ3NFZGl0b3IyLlNVR0dFU1RJT05TLnB1c2goYEAke0xBTkdVQUdFX1NFVFRJTkdfVEFHfWApO1xuXHRcdH1cblx0XHR0aGlzLmlucHV0Q2hhbmdlTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHdoZW5DdXJyZW50UHJvZmlsZUNoYW5nZWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy51cGRhdGVkQ29uZmlnU2NoZW1hRGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdHRoaXMuZGlzbWlzc2VkRXh0ZW5zaW9uU2V0dGluZ3MgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlXG5cdFx0XHRcdC5nZXQodGhpcy5ESVNNSVNTRURfRVhURU5TSU9OX1NFVFRJTkdTX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJycpXG5cdFx0XHRcdC5zcGxpdCh0aGlzLkRJU01JU1NFRF9FWFRFTlNJT05fU0VUVElOR1NfREVMSU1JVEVSKTtcblx0XHRcdHRoaXMub25Db25maWdVcGRhdGUodW5kZWZpbmVkLCB0cnVlKTtcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCBtaW5pbXVtV2lkdGgoKTogbnVtYmVyIHsgcmV0dXJuIFNldHRpbmdzRWRpdG9yMi5FRElUT1JfTUlOX1dJRFRIOyB9XG5cdG92ZXJyaWRlIGdldCBtYXhpbXVtV2lkdGgoKTogbnVtYmVyIHsgcmV0dXJuIE51bWJlci5QT1NJVElWRV9JTkZJTklUWTsgfVxuXHRvdmVycmlkZSBnZXQgbWluaW11bUhlaWdodCgpIHsgcmV0dXJuIDE4MDsgfVxuXG5cdC8vIHRoZXNlIHNldHRlcnMgbmVlZCB0byBleGlzdCBiZWNhdXNlIHRoaXMgZXh0ZW5kcyBmcm9tIEVkaXRvclBhbmVcblx0b3ZlcnJpZGUgc2V0IG1pbmltdW1XaWR0aCh2YWx1ZTogbnVtYmVyKSB7IC8qbm9vcCovIH1cblx0b3ZlcnJpZGUgc2V0IG1heGltdW1XaWR0aCh2YWx1ZTogbnVtYmVyKSB7IC8qbm9vcCovIH1cblxuXHRwcml2YXRlIGdldCBjdXJyZW50U2V0dGluZ3NNb2RlbCgpOiBTZXR0aW5nc1RyZWVNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwgfHwgdGhpcy5zZXR0aW5nc1RyZWVNb2RlbC52YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IHNlYXJjaFJlc3VsdE1vZGVsKCk6IFNlYXJjaFJlc3VsdE1vZGVsIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlYXJjaFJlc3VsdE1vZGVsLnZhbHVlID8/IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHNldCBzZWFyY2hSZXN1bHRNb2RlbCh2YWx1ZTogU2VhcmNoUmVzdWx0TW9kZWwgfCBudWxsKSB7XG5cdFx0dGhpcy5fc2VhcmNoUmVzdWx0TW9kZWwudmFsdWUgPSB2YWx1ZSA/PyB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLnJvb3RFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3NlYXJjaC1tb2RlJywgISF0aGlzLl9zZWFyY2hSZXN1bHRNb2RlbC52YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBmb2N1c2VkU2V0dGluZ0RPTUVsZW1lbnQoKTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLnNldHRpbmdzVHJlZS5nZXRGb2N1cygpWzBdO1xuXHRcdGlmICghKGZvY3VzZWQgaW5zdGFuY2VvZiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5nUmVuZGVyZXJzLmdldERPTUVsZW1lbnRzRm9yU2V0dGluZ0tleSh0aGlzLnNldHRpbmdzVHJlZS5nZXRIVE1MRWxlbWVudCgpLCBmb2N1c2VkLnNldHRpbmcua2V5KVswXTtcblx0fVxuXG5cdGdldCBjdXJyZW50Rm9jdXNDb250ZXh0KCkge1xuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50Rm9jdXNDb250ZXh0O1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0cGFyZW50LnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcblx0XHR0aGlzLnJvb3RFbGVtZW50ID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJy5zZXR0aW5ncy1lZGl0b3InLCB7IHRhYmluZGV4OiAnLTEnIH0pKTtcblxuXHRcdHRoaXMuY3JlYXRlSGVhZGVyKHRoaXMucm9vdEVsZW1lbnQpO1xuXHRcdHRoaXMuY3JlYXRlQm9keSh0aGlzLnJvb3RFbGVtZW50KTtcblx0XHR0aGlzLmFkZEN0cmxBSW50ZXJjZXB0b3IodGhpcy5yb290RWxlbWVudCk7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyTmF2aWdhYmxlQ29udGFpbmVyKHtcblx0XHRcdG5hbWU6ICdzZXR0aW5nc0VkaXRvcjInLFxuXHRcdFx0Zm9jdXNOb3RpZmllcnM6IFt0aGlzXSxcblx0XHRcdGZvY3VzTmV4dFdpZGdldDogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5zZWFyY2hXaWRnZXQuaW5wdXRXaWRnZXQuaGFzV2lkZ2V0Rm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXNUT0MoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZvY3VzUHJldmlvdXNXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLnNlYXJjaFdpZGdldC5pbnB1dFdpZGdldC5oYXNXaWRnZXRGb2N1cygpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c1NlYXJjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2V0SW5wdXQoaW5wdXQ6IFNldHRpbmdzRWRpdG9yMklucHV0LCBvcHRpb25zOiBJU2V0dGluZ3NFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuaW5TZXR0aW5nc0VkaXRvckNvbnRleHRLZXkuc2V0KHRydWUpO1xuXHRcdGF3YWl0IHN1cGVyLnNldElucHV0KGlucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cdFx0aWYgKCF0aGlzLmlucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmlucHV0LnJlc29sdmUoKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgIShtb2RlbCBpbnN0YW5jZW9mIFNldHRpbmdzMkVkaXRvck1vZGVsKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubW9kZWxEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMubW9kZWxEaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRDaGFuZ2VHcm91cHMoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVkQ29uZmlnU2NoZW1hRGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0dGhpcy5vbkNvbmZpZ1VwZGF0ZSh1bmRlZmluZWQsIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0XHR0aGlzLmRlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsID0gbW9kZWw7XG5cblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB2YWxpZGF0ZVNldHRpbmdzRWRpdG9yT3B0aW9ucyh7fSk7XG5cdFx0aWYgKCF0aGlzLnZpZXdTdGF0ZS5zZXR0aW5nc1RhcmdldCB8fCAhdGhpcy5zZXR0aW5nc1RhcmdldHNXaWRnZXQuc2V0dGluZ3NUYXJnZXQpIHtcblx0XHRcdGNvbnN0IG9wdGlvbnNIYXNWaWV3U3RhdGVUYXJnZXQgPSBvcHRpb25zLnZpZXdTdGF0ZSAmJiAob3B0aW9ucy52aWV3U3RhdGUgYXMgSVNldHRpbmdzRWRpdG9yVmlld1N0YXRlKS5zZXR0aW5nc1RhcmdldDtcblx0XHRcdGlmICghb3B0aW9ucy50YXJnZXQgJiYgIW9wdGlvbnNIYXNWaWV3U3RhdGVUYXJnZXQpIHtcblx0XHRcdFx0b3B0aW9ucy50YXJnZXQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3NldE9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHQvLyBEb24ndCBibG9jayBzZXRJbnB1dCBvbiByZW5kZXIgKHdoaWNoIGNhbiB0cmlnZ2VyIGFuIGFzeW5jIHNlYXJjaClcblx0XHR0aGlzLm9uQ29uZmlnVXBkYXRlKHVuZGVmaW5lZCwgdHJ1ZSkudGhlbigoKSA9PiB7XG5cdFx0XHQvLyBUaGlzIGV2ZW50IHJ1bnMgd2hlbiB0aGUgZWRpdG9yIGNsb3Nlcy5cblx0XHRcdHRoaXMuaW5wdXRDaGFuZ2VMaXN0ZW5lci52YWx1ZSA9IGlucHV0Lm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSgnJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gSW5pdCBUT0Mgc2VsZWN0aW9uXG5cdFx0XHR0aGlzLnVwZGF0ZVRyZWVTY3JvbGxTeW5jKCk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0aGlzLnJlZnJlc2hJbnN0YWxsZWRFeHRlbnNpb25zTGlzdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoSW5zdGFsbGVkRXh0ZW5zaW9uc0xpc3QoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCk7XG5cdFx0dGhpcy5pbnN0YWxsZWRFeHRlbnNpb25JZHMgPSBpbnN0YWxsZWRFeHRlbnNpb25zXG5cdFx0XHQuZmlsdGVyKGV4dCA9PiBleHQubWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbmZpZ3VyYXRpb24pXG5cdFx0XHQubWFwKGV4dCA9PiBleHQuaWRlbnRpZmllci5pZCk7XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVDYWNoZWRTdGF0ZSgpOiBJU2V0dGluZ3NFZGl0b3IyU3RhdGUgfCBudWxsIHtcblx0XHRjb25zdCBjYWNoZWRTdGF0ZSA9IHRoaXMuaW5wdXQgJiYgdGhpcy5lZGl0b3JNZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0aGlzLmdyb3VwLCB0aGlzLmlucHV0KTtcblx0XHRpZiAoY2FjaGVkU3RhdGUgJiYgdHlwZW9mIGNhY2hlZFN0YXRlLnRhcmdldCA9PT0gJ29iamVjdCcpIHtcblx0XHRcdGNhY2hlZFN0YXRlLnRhcmdldCA9IFVSSS5yZXZpdmUoY2FjaGVkU3RhdGUudGFyZ2V0KTtcblx0XHR9XG5cblx0XHRpZiAoY2FjaGVkU3RhdGUpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdzVGFyZ2V0ID0gY2FjaGVkU3RhdGUudGFyZ2V0O1xuXHRcdFx0dGhpcy5zZXR0aW5nc1RhcmdldHNXaWRnZXQuc2V0dGluZ3NUYXJnZXQgPSBzZXR0aW5nc1RhcmdldDtcblx0XHRcdHRoaXMudmlld1N0YXRlLnNldHRpbmdzVGFyZ2V0ID0gc2V0dGluZ3NUYXJnZXQ7XG5cdFx0XHRpZiAoIXRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkpIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUoY2FjaGVkU3RhdGUuc2VhcmNoUXVlcnkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlucHV0KSB7XG5cdFx0XHR0aGlzLmVkaXRvck1lbWVudG8uY2xlYXJFZGl0b3JTdGF0ZSh0aGlzLmlucHV0LCB0aGlzLmdyb3VwKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2FjaGVkU3RhdGUgPz8gbnVsbDtcblx0fVxuXG5cdG92ZXJyaWRlIGdldFZpZXdTdGF0ZSgpOiBvYmplY3QgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZpZXdTdGF0ZTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldE9wdGlvbnMob3B0aW9uczogSVNldHRpbmdzRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHN1cGVyLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0dGhpcy5fc2V0T3B0aW9ucyhvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZXRPcHRpb25zKG9wdGlvbnM6IElTZXR0aW5nc0VkaXRvck9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAob3B0aW9ucy5mb2N1c1NlYXJjaCAmJiAhcGxhdGZvcm0uaXNJT1MpIHtcblx0XHRcdC8vIGlzSU9TIC0gIzEyMjA0NFxuXHRcdFx0dGhpcy5mb2N1c1NlYXJjaCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlY292ZXJlZFZpZXdTdGF0ZSA9IG9wdGlvbnMudmlld1N0YXRlID9cblx0XHRcdG9wdGlvbnMudmlld1N0YXRlIGFzIElTZXR0aW5nc0VkaXRvclZpZXdTdGF0ZSA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHF1ZXJ5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSByZWNvdmVyZWRWaWV3U3RhdGU/LnF1ZXJ5ID8/IG9wdGlvbnMucXVlcnk7XG5cdFx0aWYgKHF1ZXJ5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnNldFZhbHVlKHF1ZXJ5KTtcblx0XHRcdHRoaXMudmlld1N0YXRlLnF1ZXJ5ID0gcXVlcnk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0OiBTZXR0aW5nc1RhcmdldCB8IHVuZGVmaW5lZCA9IG9wdGlvbnMuZm9sZGVyVXJpID8/IHJlY292ZXJlZFZpZXdTdGF0ZT8uc2V0dGluZ3NUYXJnZXQgPz8gPFNldHRpbmdzVGFyZ2V0IHwgdW5kZWZpbmVkPm9wdGlvbnMudGFyZ2V0O1xuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3NUYXJnZXRzV2lkZ2V0LnVwZGF0ZVRhcmdldCh0YXJnZXQpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGNsZWFySW5wdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5pblNldHRpbmdzRWRpdG9yQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERPTS5EaW1lbnNpb24pOiB2b2lkIHtcblx0XHR0aGlzLmRpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblxuXHRcdGlmICghdGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubGF5b3V0U3BsaXRWaWV3KGRpbWVuc2lvbik7XG5cblx0XHRjb25zdCBpbm5lcldpZHRoID0gTWF0aC5taW4odGhpcy5oZWFkZXJDb250YWluZXIuY2xpZW50V2lkdGgsIGRpbWVuc2lvbi53aWR0aCkgLSAyNCAqIDI7IC8vIDI0cHggcGFkZGluZyBvbiBsZWZ0IGFuZCByaWdodDtcblx0XHQvLyBtaW51cyBwYWRkaW5nIGluc2lkZSBpbnB1dGJveCwgY291bnRFbGVtZW50IHdpZHRoLCBjb250cm9scyB3aWR0aCwgZXh0cmEgcGFkZGluZyBiZWZvcmUgY291bnRFbGVtZW50XG5cdFx0Y29uc3QgbW9uYWNvV2lkdGggPSBpbm5lcldpZHRoIC0gMTAgLSB0aGlzLmNvdW50RWxlbWVudC5jbGllbnRXaWR0aCAtIHRoaXMuY29udHJvbHNFbGVtZW50LmNsaWVudFdpZHRoIC0gMTI7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQubGF5b3V0KG5ldyBET00uRGltZW5zaW9uKG1vbmFjb1dpZHRoLCAyMCkpO1xuXG5cdFx0dGhpcy5yb290RWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCduYXJyb3ctd2lkdGgnLCBkaW1lbnNpb24ud2lkdGggPCBTZXR0aW5nc0VkaXRvcjIuTkFSUk9XX1RPVEFMX1dJRFRIKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHRpZiAodGhpcy5fY3VycmVudEZvY3VzQ29udGV4dCA9PT0gU2V0dGluZ3NGb2N1c0NvbnRleHQuU2VhcmNoKSB7XG5cdFx0XHRpZiAoIXBsYXRmb3JtLmlzSU9TKSB7XG5cdFx0XHRcdC8vICMxMjIwNDRcblx0XHRcdFx0dGhpcy5mb2N1c1NlYXJjaCgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5fY3VycmVudEZvY3VzQ29udGV4dCA9PT0gU2V0dGluZ3NGb2N1c0NvbnRleHQuU2V0dGluZ0NvbnRyb2wpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLmZvY3VzZWRTZXR0aW5nRE9NRWxlbWVudDtcblx0XHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRyb2wgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuQ09OVFJPTF9TRUxFQ1RPUik7XG5cdFx0XHRcdGlmIChjb250cm9sKSB7XG5cdFx0XHRcdFx0KDxIVE1MRWxlbWVudD5jb250cm9sKS5mb2N1cygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5fY3VycmVudEZvY3VzQ29udGV4dCA9PT0gU2V0dGluZ3NGb2N1c0NvbnRleHQuU2V0dGluZ1RyZWUpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlLmRvbUZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jdXJyZW50Rm9jdXNDb250ZXh0ID09PSBTZXR0aW5nc0ZvY3VzQ29udGV4dC5UYWJsZU9mQ29udGVudHMpIHtcblx0XHRcdHRoaXMudG9jVHJlZS5kb21Gb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzZXRFZGl0b3JWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5zZXRFZGl0b3JWaXNpYmxlKHZpc2libGUpO1xuXG5cdFx0aWYgKCF2aXNpYmxlKSB7XG5cdFx0XHQvLyBXYWl0IGZvciBlZGl0b3IgdG8gYmUgcmVtb3ZlZCBmcm9tIERPTSAjMTA2MzAzXG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQub25IaWRlKCk7XG5cdFx0XHRcdHRoaXMuc2V0dGluZ1JlbmRlcmVycy5jYW5jZWxTdWdnZXN0ZXJzKCk7XG5cdFx0XHR9LCAwKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c1NldHRpbmdzKGZvY3VzU2V0dGluZ0lucHV0ID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1c2VkID0gdGhpcy5zZXR0aW5nc1RyZWUuZ2V0Rm9jdXMoKTtcblx0XHRpZiAoIWZvY3VzZWQubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzVHJlZS5mb2N1c0ZpcnN0KCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXR0aW5nc1RyZWUuZG9tRm9jdXMoKTtcblxuXHRcdGlmIChmb2N1c1NldHRpbmdJbnB1dCkge1xuXHRcdFx0Y29uc3QgY29udHJvbEluRm9jdXNlZFJvdyA9IHRoaXMuc2V0dGluZ3NUcmVlLmdldEhUTUxFbGVtZW50KCkucXVlcnlTZWxlY3RvcihgLmZvY3VzZWQgJHtBYnN0cmFjdFNldHRpbmdSZW5kZXJlci5DT05UUk9MX1NFTEVDVE9SfWApO1xuXHRcdFx0aWYgKGNvbnRyb2xJbkZvY3VzZWRSb3cpIHtcblx0XHRcdFx0KDxIVE1MRWxlbWVudD5jb250cm9sSW5Gb2N1c2VkUm93KS5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZvY3VzVE9DKCk6IHZvaWQge1xuXHRcdHRoaXMudG9jVHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0c2hvd0NvbnRleHRNZW51KCk6IHZvaWQge1xuXHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLnNldHRpbmdzVHJlZS5nZXRGb2N1cygpWzBdO1xuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSB0aGlzLmZvY3VzZWRTZXR0aW5nRE9NRWxlbWVudDtcblx0XHRpZiAocm93RWxlbWVudCAmJiBmb2N1c2VkIGluc3RhbmNlb2YgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpIHtcblx0XHRcdHRoaXMuc2V0dGluZ1JlbmRlcmVycy5zaG93Q29udGV4dE1lbnUoZm9jdXNlZCwgcm93RWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXNTZWFyY2goZmlsdGVyPzogc3RyaW5nLCBzZWxlY3RBbGwgPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKGZpbHRlciAmJiB0aGlzLnNlYXJjaFdpZGdldCkge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUoZmlsdGVyKTtcblx0XHR9XG5cblx0XHQvLyBEbyBub3Qgc2VsZWN0IGFsbCBpZiB0aGUgdXNlciBpcyBhbHJlYWR5IHNlYXJjaGluZy5cblx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1cyhzZWxlY3RBbGwgJiYgIXRoaXMuc2VhcmNoSW5wdXREZWxheWVyLmlzVHJpZ2dlcmVkKTtcblx0fVxuXG5cdGNsZWFyU2VhcmNoUmVzdWx0cygpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSgnJyk7XG5cdFx0dGhpcy5mb2N1c1NlYXJjaCgpO1xuXHR9XG5cblx0Y2xlYXJTZWFyY2hGaWx0ZXJzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHF1ZXJ5ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKTtcblxuXHRcdGNvbnN0IHNwbGl0UXVlcnkgPSBxdWVyeS5zcGxpdCgnICcpLmZpbHRlcih3b3JkID0+IHtcblx0XHRcdHJldHVybiB3b3JkLmxlbmd0aCAmJiAhU2V0dGluZ3NFZGl0b3IyLlNVR0dFU1RJT05TLnNvbWUoc3VnZ2VzdGlvbiA9PiB3b3JkLnN0YXJ0c1dpdGgoc3VnZ2VzdGlvbikpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUoc3BsaXRRdWVyeS5qb2luKCcgJykpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJbnB1dEFyaWFMYWJlbCgpIHtcblx0XHRsZXQgbGFiZWwgPSBzZWFyY2hCb3hMYWJlbDtcblx0XHRpZiAodGhpcy5zZWFyY2hSZXN1bHRMYWJlbCkge1xuXHRcdFx0bGFiZWwgKz0gYC4gJHt0aGlzLnNlYXJjaFJlc3VsdExhYmVsfWA7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubGFzdFN5bmNlZExhYmVsKSB7XG5cdFx0XHRsYWJlbCArPSBgLiAke3RoaXMubGFzdFN5bmNlZExhYmVsfWA7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQudXBkYXRlQXJpYUxhYmVsKGxhYmVsKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIGhlYWRlciBvZiB0aGUgU2V0dGluZ3MgZWRpdG9yLCB3aGljaCBpbmNsdWRlcyB0aGUgY29udGVudCBhYm92ZSB0aGUgc3BsaXR2aWV3LlxuXHQgKi9cblx0cHJpdmF0ZSBjcmVhdGVIZWFkZXIocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGVhZGVyQ29udGFpbmVyID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJy5zZXR0aW5ncy1oZWFkZXInKSk7XG5cblx0XHRjb25zdCBzZWFyY2hDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuaGVhZGVyQ29udGFpbmVyLCAkKCcuc2VhcmNoLWNvbnRhaW5lcicpKTtcblxuXHRcdGNvbnN0IGNsZWFySW5wdXRBY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uKFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9SRVNVTFRTLCBsb2NhbGl6ZSgnY2xlYXJJbnB1dCcsIFwiQ2xlYXIgU2V0dGluZ3MgU2VhcmNoIElucHV0XCIpLCBUaGVtZUljb24uYXNDbGFzc05hbWUocHJlZmVyZW5jZXNDbGVhcklucHV0SWNvbiksIGZhbHNlLCBhc3luYyAoKSA9PiB0aGlzLmNsZWFyU2VhcmNoUmVzdWx0cygpKSk7XG5cdFx0Y29uc3QgZmlsdGVyQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbihTRVRUSU5HU19FRElUT1JfQ09NTUFORF9TVUdHRVNUX0ZJTFRFUlMsIGxvY2FsaXplKCdmaWx0ZXJJbnB1dCcsIFwiRmlsdGVyIFNldHRpbmdzXCIpLCBUaGVtZUljb24uYXNDbGFzc05hbWUocHJlZmVyZW5jZXNGaWx0ZXJJY29uKSkpO1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdWdnZXN0RW5hYmxlZElucHV0LCBgJHtTZXR0aW5nc0VkaXRvcjIuSUR9LnNlYXJjaGJveGAsIHNlYXJjaENvbnRhaW5lciwge1xuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFsnQCcsICc6J10sXG5cdFx0XHRwcm92aWRlUmVzdWx0czogKHF1ZXJ5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Ly8gQmFzZWQgb24gdGVzdGluZywgdGhlIHRyaWdnZXIgY2hhcmFjdGVyIGlzIGFsd2F5cyBhdCB0aGUgZW5kIG9mIHRoZSBxdWVyeS5cblx0XHRcdFx0Ly8gZm9yIHRoZSAnOicgdHJpZ2dlciwgb25seSByZXR1cm4gc3VnZ2VzdGlvbnMgaWYgdGhlcmUgd2FzIGEgJ0AnIGJlZm9yZSBpdCBpbiB0aGUgc2FtZSB3b3JkLlxuXHRcdFx0XHRjb25zdCBxdWVyeVBhcnRzID0gcXVlcnkuc3BsaXQoL1xccy9nKTtcblx0XHRcdFx0aWYgKHF1ZXJ5UGFydHNbcXVlcnlQYXJ0cy5sZW5ndGggLSAxXS5zdGFydHNXaXRoKGBAJHtMQU5HVUFHRV9TRVRUSU5HX1RBR31gKSkge1xuXHRcdFx0XHRcdGNvbnN0IHNvcnRlZExhbmd1YWdlcyA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldFJlZ2lzdGVyZWRMYW5ndWFnZUlkcygpLm1hcChsYW5ndWFnZUlkID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBgQCR7TEFOR1VBR0VfU0VUVElOR19UQUd9JHtsYW5ndWFnZUlkfSBgO1xuXHRcdFx0XHRcdH0pLnNvcnQoKTtcblx0XHRcdFx0XHRyZXR1cm4gc29ydGVkTGFuZ3VhZ2VzLmZpbHRlcihsYW5nRmlsdGVyID0+ICFxdWVyeS5pbmNsdWRlcyhsYW5nRmlsdGVyKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocXVlcnlQYXJ0c1txdWVyeVBhcnRzLmxlbmd0aCAtIDFdLnN0YXJ0c1dpdGgoYEAke0VYVEVOU0lPTl9TRVRUSU5HX1RBR31gKSkge1xuXHRcdFx0XHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbnNUYWdzID0gdGhpcy5pbnN0YWxsZWRFeHRlbnNpb25JZHMubWFwKGV4dGVuc2lvbklkID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBgQCR7RVhURU5TSU9OX1NFVFRJTkdfVEFHfSR7ZXh0ZW5zaW9uSWR9IGA7XG5cdFx0XHRcdFx0fSkuc29ydCgpO1xuXHRcdFx0XHRcdHJldHVybiBpbnN0YWxsZWRFeHRlbnNpb25zVGFncy5maWx0ZXIoZXh0RmlsdGVyID0+ICFxdWVyeS5pbmNsdWRlcyhleHRGaWx0ZXIpKTtcblx0XHRcdFx0fSBlbHNlIGlmIChxdWVyeVBhcnRzW3F1ZXJ5UGFydHMubGVuZ3RoIC0gMV0uc3RhcnRzV2l0aCgnQCcpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFNldHRpbmdzRWRpdG9yMi5TVUdHRVNUSU9OUy5maWx0ZXIodGFnID0+ICFxdWVyeS5pbmNsdWRlcyh0YWcpKS5tYXAodGFnID0+IHRhZy5lbmRzV2l0aCgnOicpID8gdGFnIDogdGFnICsgJyAnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0fSwgc2VhcmNoQm94TGFiZWwsICdzZXR0aW5nc2VkaXRvcjpzZWFyY2hpbnB1dCcgKyBTZXR0aW5nc0VkaXRvcjIuTlVNX0lOU1RBTkNFUysrLCB7XG5cdFx0XHRwbGFjZWhvbGRlclRleHQ6IHNlYXJjaEJveExhYmVsLFxuXHRcdFx0Zm9jdXNDb250ZXh0S2V5OiB0aGlzLnNlYXJjaEZvY3VzQ29udGV4dEtleSxcblx0XHRcdHN0eWxlT3ZlcnJpZGVzOiB7XG5cdFx0XHRcdGlucHV0Qm9yZGVyOiBzZXR0aW5nc1RleHRJbnB1dEJvcmRlclxuXHRcdFx0fVxuXHRcdFx0Ly8gVE9ETzogQXJpYS1saXZlXG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoV2lkZ2V0Lm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudEZvY3VzQ29udGV4dCA9IFNldHRpbmdzRm9jdXNDb250ZXh0LlNlYXJjaDtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmNvdW50RWxlbWVudCA9IERPTS5hcHBlbmQoc2VhcmNoQ29udGFpbmVyLCBET00uJCgnLnNldHRpbmdzLWNvdW50LXdpZGdldC5tb25hY28tY291bnQtYmFkZ2UubG9uZycpKTtcblxuXHRcdHRoaXMuY291bnRFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGFzQ3NzVmFyaWFibGUoYmFkZ2VCYWNrZ3JvdW5kKTtcblx0XHR0aGlzLmNvdW50RWxlbWVudC5zdHlsZS5jb2xvciA9IGFzQ3NzVmFyaWFibGUoYmFkZ2VGb3JlZ3JvdW5kKTtcblx0XHR0aGlzLmNvdW50RWxlbWVudC5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShjb250cmFzdEJvcmRlcil9YDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoV2lkZ2V0Lm9uSW5wdXREaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VhcmNoVmFsID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKTtcblx0XHRcdGNsZWFySW5wdXRBY3Rpb24uZW5hYmxlZCA9ICEhc2VhcmNoVmFsO1xuXHRcdFx0dGhpcy5zZWFyY2hJbnB1dERlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLm9uU2VhcmNoSW5wdXRDaGFuZ2VkKCkpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGhlYWRlckNvbnRyb2xzQ29udGFpbmVyID0gRE9NLmFwcGVuZCh0aGlzLmhlYWRlckNvbnRhaW5lciwgJCgnLnNldHRpbmdzLWhlYWRlci1jb250cm9scycpKTtcblx0XHRoZWFkZXJDb250cm9sc0NvbnRhaW5lci5zdHlsZS5ib3JkZXJDb2xvciA9IGFzQ3NzVmFyaWFibGUoc2V0dGluZ3NIZWFkZXJCb3JkZXIpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0V2lkZ2V0Q29udGFpbmVyID0gRE9NLmFwcGVuZChoZWFkZXJDb250cm9sc0NvbnRhaW5lciwgJCgnLnNldHRpbmdzLXRhcmdldC1jb250YWluZXInKSk7XG5cdFx0dGhpcy5zZXR0aW5nc1RhcmdldHNXaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHRpbmdzVGFyZ2V0c1dpZGdldCwgdGFyZ2V0V2lkZ2V0Q29udGFpbmVyLCB7IGVuYWJsZVJlbW90ZVNldHRpbmdzOiB0cnVlIH0pKTtcblx0XHR0aGlzLnNldHRpbmdzVGFyZ2V0c1dpZGdldC5zZXR0aW5nc1RhcmdldCA9IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdzVGFyZ2V0c1dpZGdldC5vbkRpZFRhcmdldENoYW5nZSh0YXJnZXQgPT4gdGhpcy5vbkRpZFNldHRpbmdzVGFyZ2V0Q2hhbmdlKHRhcmdldCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhcmdldFdpZGdldENvbnRhaW5lciwgRE9NLkV2ZW50VHlwZS5LRVlfRE9XTiwgZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5Eb3duQXJyb3cpIHtcblx0XHRcdFx0dGhpcy5mb2N1c1NldHRpbmdzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jV29ya2JlbmNoU2VydmljZS5lbmFibGVkICYmIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuY2FuVG9nZ2xlRW5hYmxlbWVudCgpKSB7XG5cdFx0XHRjb25zdCBzeW5jQ29udHJvbHMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN5bmNDb250cm9scywgdGhpcy53aW5kb3csIGhlYWRlckNvbnRyb2xzQ29udGFpbmVyKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihzeW5jQ29udHJvbHMub25EaWRDaGFuZ2VMYXN0U3luY2VkTGFiZWwobGFzdFN5bmNlZExhYmVsID0+IHtcblx0XHRcdFx0dGhpcy5sYXN0U3luY2VkTGFiZWwgPSBsYXN0U3luY2VkTGFiZWw7XG5cdFx0XHRcdHRoaXMudXBkYXRlSW5wdXRBcmlhTGFiZWwoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRyb2xzRWxlbWVudCA9IERPTS5hcHBlbmQoc2VhcmNoQ29udGFpbmVyLCBET00uJCgnLnNldHRpbmdzLWNsZWFyLXdpZGdldCcpKTtcblxuXHRcdGNvbnN0IGFjdGlvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIodGhpcy5jb250cm9sc0VsZW1lbnQsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gZmlsdGVyQWN0aW9uLmlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NTZWFyY2hGaWx0ZXJEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCBvcHRpb25zLCB0aGlzLmFjdGlvblJ1bm5lciwgdGhpcy5zZWFyY2hXaWRnZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YWN0aW9uQmFyLnB1c2goW2NsZWFySW5wdXRBY3Rpb24sIGZpbHRlckFjdGlvbl0sIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFNldHRpbmdzVGFyZ2V0Q2hhbmdlKHRhcmdldDogU2V0dGluZ3NUYXJnZXQpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdTdGF0ZS5zZXR0aW5nc1RhcmdldCA9IHRhcmdldDtcblxuXHRcdC8vIFRPRE8gSW5zdGVhZCBvZiByZWJ1aWxkaW5nIHRoZSB3aG9sZSBtb2RlbCwgcmVmcmVzaCBhbmQgdW5jYWNoZSB0aGUgaW5zcGVjdGVkIHNldHRpbmcgdmFsdWVcblx0XHR0aGlzLm9uQ29uZmlnVXBkYXRlKHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRGlzbWlzc0V4dGVuc2lvblNldHRpbmcoZXh0ZW5zaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5kaXNtaXNzZWRFeHRlbnNpb25TZXR0aW5ncy5pbmNsdWRlcyhleHRlbnNpb25JZCkpIHtcblx0XHRcdHRoaXMuZGlzbWlzc2VkRXh0ZW5zaW9uU2V0dGluZ3MucHVzaChleHRlbnNpb25JZCk7XG5cdFx0fVxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoXG5cdFx0XHR0aGlzLkRJU01JU1NFRF9FWFRFTlNJT05fU0VUVElOR1NfU1RPUkFHRV9LRVksXG5cdFx0XHR0aGlzLmRpc21pc3NlZEV4dGVuc2lvblNldHRpbmdzLmpvaW4odGhpcy5ESVNNSVNTRURfRVhURU5TSU9OX1NFVFRJTkdTX0RFTElNSVRFUiksXG5cdFx0XHRTdG9yYWdlU2NvcGUuUFJPRklMRSxcblx0XHRcdFN0b3JhZ2VUYXJnZXQuVVNFUlxuXHRcdCk7XG5cdFx0dGhpcy5vbkNvbmZpZ1VwZGF0ZSh1bmRlZmluZWQsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENsaWNrU2V0dGluZyhldnQ6IElTZXR0aW5nTGlua0NsaWNrRXZlbnQsIHJlY3Vyc2VkPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHRhcmdldEVsZW1lbnQgPSB0aGlzLmN1cnJlbnRTZXR0aW5nc01vZGVsPy5nZXRFbGVtZW50c0J5TmFtZShldnQudGFyZ2V0S2V5KT8uWzBdO1xuXHRcdGxldCByZXZlYWxGYWlsZWQgPSBmYWxzZTtcblx0XHRpZiAodGFyZ2V0RWxlbWVudCkge1xuXHRcdFx0bGV0IHNvdXJjZVRvcCA9IDAuNTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IF9zb3VyY2VUb3AgPSB0aGlzLnNldHRpbmdzVHJlZS5nZXRSZWxhdGl2ZVRvcChldnQuc291cmNlKTtcblx0XHRcdFx0aWYgKF9zb3VyY2VUb3AgIT09IG51bGwpIHtcblx0XHRcdFx0XHRzb3VyY2VUb3AgPSBfc291cmNlVG9wO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gZS5nLiBjbGlja2VkIGEgc2VhcmNoZWQgZWxlbWVudCwgbm93IHRoZSBzZWFyY2ggaGFzIGJlZW4gY2xlYXJlZFxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB3ZSBzZWFyY2ggZm9yIHNvbWV0aGluZyBhbmQgZm9jdXMgb24gYSBjYXRlZ29yeSwgdGhlIHNldHRpbmdzIHRyZWVcblx0XHRcdC8vIG9ubHkgcmVuZGVycyBzZXR0aW5ncyBpbiB0aGF0IGNhdGVnb3J5LlxuXHRcdFx0Ly8gSWYgdGhlIHRhcmdldCBkaXNwbGF5IGNhdGVnb3J5IGlzIGRpZmZlcmVudCB0aGFuIHRoZSBzb3VyY2UncywgdW5mb2N1cyB0aGUgY2F0ZWdvcnlcblx0XHRcdC8vIHNvIHRoYXQgd2UgY2FuIHJlbmRlciBhbGwgZm91bmQgc2V0dGluZ3MgYWdhaW4uXG5cdFx0XHQvLyBUaGVuLCB0aGUgcmV2ZWFsIGNhbGwgd2lsbCBjb3JyZWN0bHkgZmluZCB0aGUgdGFyZ2V0IHNldHRpbmcuXG5cdFx0XHRpZiAodGhpcy52aWV3U3RhdGUuZmlsdGVyVG9DYXRlZ29yeSAmJiBldnQuc291cmNlLmRpc3BsYXlDYXRlZ29yeSAhPT0gdGFyZ2V0RWxlbWVudC5kaXNwbGF5Q2F0ZWdvcnkpIHtcblx0XHRcdFx0dGhpcy50b2NUcmVlLnNldEZvY3VzKFtdKTtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlLnJldmVhbCh0YXJnZXRFbGVtZW50LCBzb3VyY2VUb3ApO1xuXHRcdFx0fSBjYXRjaCAoXykge1xuXHRcdFx0XHQvLyBUaGUgbGlzdHdpZGdldCBjb3VsZG4ndCBmaW5kIHRoZSBzZXR0aW5nIHRvIHJldmVhbCxcblx0XHRcdFx0Ly8gZXZlbiB0aG91Z2ggaXQncyBpbiB0aGUgbW9kZWwsIG1lYW5pbmcgdGhlcmUgbWlnaHQgYmUgYSBmaWx0ZXJcblx0XHRcdFx0Ly8gcHJldmVudGluZyBpdCBmcm9tIHNob3dpbmcgdXAuXG5cdFx0XHRcdHJldmVhbEZhaWxlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghcmV2ZWFsRmFpbGVkKSB7XG5cdFx0XHRcdC8vIFdlIG5lZWQgdG8gc2hpZnQgZm9jdXMgZnJvbSB0aGUgc2V0dGluZyB0aGF0IGNvbnRhaW5zIHRoZSBsaW5rIHRvIHRoZSBzZXR0aW5nIHRoYXQnc1xuXHRcdFx0XHQvLyBsaW5rZWQuIENsaWNraW5nIG9uIHRoZSBsaW5rIHNldHMgZm9jdXMgb24gdGhlIHNldHRpbmcgdGhhdCBjb250YWlucyB0aGUgbGluayxcblx0XHRcdFx0Ly8gd2hpY2ggaXMgd2h5IHdlIG5lZWQgdGhlIHNldFRpbWVvdXQuXG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlLnNldEZvY3VzKFt0YXJnZXRFbGVtZW50XSk7XG5cdFx0XHRcdH0sIDUwKTtcblxuXHRcdFx0XHRjb25zdCBkb21FbGVtZW50cyA9IHRoaXMuc2V0dGluZ1JlbmRlcmVycy5nZXRET01FbGVtZW50c0ZvclNldHRpbmdLZXkodGhpcy5zZXR0aW5nc1RyZWUuZ2V0SFRNTEVsZW1lbnQoKSwgZXZ0LnRhcmdldEtleSk7XG5cdFx0XHRcdGlmIChkb21FbGVtZW50cyAmJiBkb21FbGVtZW50c1swXSkge1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRyb2wgPSBkb21FbGVtZW50c1swXS5xdWVyeVNlbGVjdG9yKEFic3RyYWN0U2V0dGluZ1JlbmRlcmVyLkNPTlRST0xfU0VMRUNUT1IpO1xuXHRcdFx0XHRcdGlmIChjb250cm9sKSB7XG5cdFx0XHRcdFx0XHQoPEhUTUxFbGVtZW50PmNvbnRyb2wpLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFyZWN1cnNlZCAmJiAoIXRhcmdldEVsZW1lbnQgfHwgcmV2ZWFsRmFpbGVkKSkge1xuXHRcdFx0Ly8gV2UnbGwgY2FsbCB0aGlzIGV2ZW50IGhhbmRsZXIgYWdhaW4gYWZ0ZXIgY2xlYXJpbmcgdGhlIHNlYXJjaCBxdWVyeSxcblx0XHRcdC8vIHNvIHRoYXQgbW9yZSBzZXR0aW5ncyBzaG93IHVwIGluIHRoZSBsaXN0LlxuXHRcdFx0Y29uc3QgcCA9IHRoaXMudHJpZ2dlclNlYXJjaCgnJyk7XG5cdFx0XHRwLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSgnJyk7XG5cdFx0XHRcdHRoaXMub25EaWRDbGlja1NldHRpbmcoZXZ0LCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHN3aXRjaFRvU2V0dGluZ3NGaWxlKCk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBxdWVyeSA9IHBhcnNlUXVlcnkodGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKSkucXVlcnk7XG5cdFx0cmV0dXJuIHRoaXMub3BlblNldHRpbmdzRmlsZSh7IHF1ZXJ5IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuU2V0dGluZ3NGaWxlKG9wdGlvbnM/OiBJU2V0dGluZ3NFZGl0b3JPcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGN1cnJlbnRTZXR0aW5nc1RhcmdldCA9IHRoaXMuc2V0dGluZ3NUYXJnZXRzV2lkZ2V0LnNldHRpbmdzVGFyZ2V0O1xuXG5cdFx0Y29uc3Qgb3Blbk9wdGlvbnM6IElPcGVuU2V0dGluZ3NPcHRpb25zID0geyBqc29uRWRpdG9yOiB0cnVlLCBncm91cElkOiB0aGlzLmdyb3VwLmlkLCAuLi5vcHRpb25zIH07XG5cdFx0aWYgKGN1cnJlbnRTZXR0aW5nc1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSB7XG5cdFx0XHRpZiAob3B0aW9ucz8ucmV2ZWFsU2V0dGluZykge1xuXHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uUHJvcGVydGllcyA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNjb3BlID0gY29uZmlndXJhdGlvblByb3BlcnRpZXNbb3B0aW9ucz8ucmV2ZWFsU2V0dGluZy5rZXldPy5zY29wZTtcblx0XHRcdFx0aWYgKGNvbmZpZ3VyYXRpb25TY29wZSAmJiBBUFBMSUNBVElPTl9TQ09QRVMuaW5jbHVkZXMoY29uZmlndXJhdGlvblNjb3BlKSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuQXBwbGljYXRpb25TZXR0aW5ncyhvcGVuT3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuVXNlclNldHRpbmdzKG9wZW5PcHRpb25zKTtcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnRTZXR0aW5nc1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5SZW1vdGVTZXR0aW5ncyhvcGVuT3B0aW9ucyk7XG5cdFx0fSBlbHNlIGlmIChjdXJyZW50U2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlbldvcmtzcGFjZVNldHRpbmdzKG9wZW5PcHRpb25zKTtcblx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaShjdXJyZW50U2V0dGluZ3NUYXJnZXQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlbkZvbGRlclNldHRpbmdzKHsgZm9sZGVyVXJpOiBjdXJyZW50U2V0dGluZ3NUYXJnZXQsIC4uLm9wZW5PcHRpb25zIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUJvZHkocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuYm9keUNvbnRhaW5lciA9IERPTS5hcHBlbmQocGFyZW50LCAkKCcuc2V0dGluZ3MtYm9keScpKTtcblxuXHRcdHRoaXMubm9SZXN1bHRzTWVzc2FnZSA9IERPTS5hcHBlbmQodGhpcy5ib2R5Q29udGFpbmVyLCAkKCcubm8tcmVzdWx0cy1tZXNzYWdlJykpO1xuXG5cdFx0dGhpcy5ub1Jlc3VsdHNNZXNzYWdlLmlubmVyVGV4dCA9IGxvY2FsaXplKCdub1Jlc3VsdHMnLCBcIk5vIFNldHRpbmdzIEZvdW5kXCIpO1xuXG5cdFx0dGhpcy5jbGVhckZpbHRlckxpbmtDb250YWluZXIgPSAkKCdzcGFuLmNsZWFyLXNlYXJjaC1maWx0ZXJzJyk7XG5cblx0XHR0aGlzLmNsZWFyRmlsdGVyTGlua0NvbnRhaW5lci50ZXh0Q29udGVudCA9ICcgLSAnO1xuXHRcdGNvbnN0IGNsZWFyRmlsdGVyTGluayA9IERPTS5hcHBlbmQodGhpcy5jbGVhckZpbHRlckxpbmtDb250YWluZXIsICQoJ2EucG9pbnRlci5wcm9taW5lbnQnLCB7IHRhYmluZGV4OiAwIH0sIGxvY2FsaXplKCdjbGVhclNlYXJjaEZpbHRlcnMnLCAnQ2xlYXIgRmlsdGVycycpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihjbGVhckZpbHRlckxpbmssIERPTS5FdmVudFR5cGUuQ0xJQ0ssIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRET00uRXZlbnRIZWxwZXIuc3RvcChlLCBmYWxzZSk7XG5cdFx0XHR0aGlzLmNsZWFyU2VhcmNoRmlsdGVycygpO1xuXHRcdH0pKTtcblxuXHRcdERPTS5hcHBlbmQodGhpcy5ub1Jlc3VsdHNNZXNzYWdlLCB0aGlzLmNsZWFyRmlsdGVyTGlua0NvbnRhaW5lcik7XG5cblx0XHR0aGlzLm5vUmVzdWx0c01lc3NhZ2Uuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKGVkaXRvckZvcmVncm91bmQpO1xuXG5cdFx0dGhpcy50b2NUcmVlQ29udGFpbmVyID0gJCgnLnNldHRpbmdzLXRvYy1jb250YWluZXInKTtcblx0XHR0aGlzLnNldHRpbmdzVHJlZUNvbnRhaW5lciA9ICQoJy5zZXR0aW5ncy10cmVlLWNvbnRhaW5lcicpO1xuXG5cdFx0dGhpcy5jcmVhdGVUT0ModGhpcy50b2NUcmVlQ29udGFpbmVyKTtcblx0XHR0aGlzLmNyZWF0ZVNldHRpbmdzVHJlZSh0aGlzLnNldHRpbmdzVHJlZUNvbnRhaW5lcik7XG5cblx0XHR0aGlzLnNwbGl0VmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTcGxpdFZpZXcodGhpcy5ib2R5Q29udGFpbmVyLCB7XG5cdFx0XHRvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdHByb3BvcnRpb25hbExheW91dDogdHJ1ZVxuXHRcdH0pKTtcblx0XHRjb25zdCBzdGFydGluZ1dpZHRoID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXROdW1iZXIoJ3NldHRpbmdzRWRpdG9yMi5zcGxpdFZpZXdXaWR0aCcsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTZXR0aW5nc0VkaXRvcjIuVE9DX1JFU0VUX1dJRFRIKTtcblx0XHR0aGlzLnNwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogdGhpcy50b2NUcmVlQ29udGFpbmVyLFxuXHRcdFx0bWluaW11bVNpemU6IFNldHRpbmdzRWRpdG9yMi5UT0NfTUlOX1dJRFRILFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdGxheW91dDogKHdpZHRoLCBfLCBoZWlnaHQpID0+IHtcblx0XHRcdFx0dGhpcy50b2NUcmVlQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0XHR0aGlzLnRvY1RyZWUubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHRcdFx0fVxuXHRcdH0sIHN0YXJ0aW5nV2lkdGgsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0dGhpcy5zcGxpdFZpZXcuYWRkVmlldyh7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGVsZW1lbnQ6IHRoaXMuc2V0dGluZ3NUcmVlQ29udGFpbmVyLFxuXHRcdFx0bWluaW11bVNpemU6IFNldHRpbmdzRWRpdG9yMi5FRElUT1JfTUlOX1dJRFRILFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdGxheW91dDogKHdpZHRoLCBfLCBoZWlnaHQpID0+IHtcblx0XHRcdFx0dGhpcy5zZXR0aW5nc1RyZWVDb250YWluZXIuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG5cdFx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0XHRcdH1cblx0XHR9LCBTaXppbmcuRGlzdHJpYnV0ZSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNwbGl0Vmlldy5vbkRpZFNhc2hSZXNldCgoKSA9PiB7XG5cdFx0XHRjb25zdCB0b3RhbFNpemUgPSB0aGlzLnNwbGl0Vmlldy5nZXRWaWV3U2l6ZSgwKSArIHRoaXMuc3BsaXRWaWV3LmdldFZpZXdTaXplKDEpO1xuXHRcdFx0dGhpcy5zcGxpdFZpZXcucmVzaXplVmlldygwLCBTZXR0aW5nc0VkaXRvcjIuVE9DX1JFU0VUX1dJRFRIKTtcblx0XHRcdHRoaXMuc3BsaXRWaWV3LnJlc2l6ZVZpZXcoMSwgdG90YWxTaXplIC0gU2V0dGluZ3NFZGl0b3IyLlRPQ19SRVNFVF9XSURUSCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3BsaXRWaWV3Lm9uRGlkU2FzaENoYW5nZSgoKSA9PiB7XG5cdFx0XHRjb25zdCB3aWR0aCA9IHRoaXMuc3BsaXRWaWV3LmdldFZpZXdTaXplKDApO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgnc2V0dGluZ3NFZGl0b3IyLnNwbGl0Vmlld1dpZHRoJywgd2lkdGgsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdH0pKTtcblx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMudGhlbWUuZ2V0Q29sb3Ioc2V0dGluZ3NTYXNoQm9yZGVyKSE7XG5cdFx0dGhpcy5zcGxpdFZpZXcuc3R5bGUoeyBzZXBhcmF0b3JCb3JkZXI6IGJvcmRlckNvbG9yIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRDdHJsQUludGVyY2VwdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoY29udGFpbmVyLCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogU3RhbmRhcmRLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGUua2V5Q29kZSA9PT0gS2V5Q29kZS5LZXlBICYmXG5cdFx0XHRcdChwbGF0Zm9ybS5pc01hY2ludG9zaCA/IGUubWV0YUtleSA6IGUuY3RybEtleSkgJiZcblx0XHRcdFx0IURPTS5pc0VkaXRhYmxlRWxlbWVudChlLnRhcmdldClcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBBdm9pZCBicm93c2VyIGN0cmwrYVxuXHRcdFx0XHRlLmJyb3dzZXJFdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0ZS5icm93c2VyRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRPQyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy50b2NUcmVlTW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRPQ1RyZWVNb2RlbCwgdGhpcy52aWV3U3RhdGUpO1xuXG5cdFx0dGhpcy50b2NUcmVlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUT0NUcmVlLFxuXHRcdFx0RE9NLmFwcGVuZChjb250YWluZXIsICQoJy5zZXR0aW5ncy10b2Mtd3JhcHBlcicsIHtcblx0XHRcdFx0J3JvbGUnOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdCdhcmlhLWxhYmVsJzogbG9jYWxpemUoJ3NldHRpbmdzJywgXCJTZXR0aW5nc1wiKSxcblx0XHRcdH0pKSxcblx0XHRcdHRoaXMudmlld1N0YXRlKSk7XG5cdFx0dGhpcy50b2NUcmVlRGlzcG9zZWQgPSBmYWxzZTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudG9jVHJlZS5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuX2N1cnJlbnRGb2N1c0NvbnRleHQgPSBTZXR0aW5nc0ZvY3VzQ29udGV4dC5UYWJsZU9mQ29udGVudHM7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50b2NUcmVlLm9uRGlkQ2hhbmdlRm9jdXMoZSA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50OiBTZXR0aW5nc1RyZWVHcm91cEVsZW1lbnQgfCBudWxsID0gZS5lbGVtZW50cz8uWzBdID8/IG51bGw7XG5cdFx0XHRpZiAodGhpcy50b2NGb2N1c2VkRWxlbWVudCA9PT0gZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudG9jRm9jdXNlZEVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0dGhpcy50b2NUcmVlLnNldFNlbGVjdGlvbihlbGVtZW50ID8gW2VsZW1lbnRdIDogW10pO1xuXHRcdFx0aWYgKHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwpIHtcblx0XHRcdFx0aWYgKHRoaXMudmlld1N0YXRlLmZpbHRlclRvQ2F0ZWdvcnkgIT09IGVsZW1lbnQpIHtcblx0XHRcdFx0XHR0aGlzLnZpZXdTdGF0ZS5maWx0ZXJUb0NhdGVnb3J5ID0gZWxlbWVudCA/PyB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Ly8gRm9yY2UgcmVuZGVyIGluIHRoaXMgY2FzZSwgYmVjYXVzZVxuXHRcdFx0XHRcdC8vIG9uRGlkQ2xpY2tTZXR0aW5nIHJlbGllcyBvbiB0aGUgdXBkYXRlZCB2aWV3LlxuXHRcdFx0XHRcdHRoaXMucmVuZGVyVHJlZSh1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlLnNjcm9sbFRvcCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudCAmJiAoIWUuYnJvd3NlckV2ZW50IHx8ICEoPElGb2N1c0V2ZW50RnJvbVNjcm9sbD5lLmJyb3dzZXJFdmVudCkuZnJvbVNjcm9sbCkpIHtcblx0XHRcdFx0dGhpcy5zZXR0aW5nc1RyZWUucmV2ZWFsKGVsZW1lbnQsIDApO1xuXHRcdFx0XHR0aGlzLnNldHRpbmdzVHJlZS5zZXRGb2N1cyhbZWxlbWVudF0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudG9jVHJlZS5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMudG9jUm93Rm9jdXNlZC5zZXQodHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50b2NUcmVlLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHR0aGlzLnRvY1Jvd0ZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRvY1RyZWUub25EaWREaXNwb3NlKCgpID0+IHtcblx0XHRcdHRoaXMudG9jVHJlZURpc3Bvc2VkID0gdHJ1ZTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5RmlsdGVyKGZpbHRlcjogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0ICYmICF0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpLmluY2x1ZGVzKGZpbHRlcikpIHtcblx0XHRcdC8vIFByZXBlbmQgdGhlIGZpbHRlciB0byB0aGUgcXVlcnkuXG5cdFx0XHRjb25zdCBuZXdRdWVyeSA9IGAke2ZpbHRlcn0gJHt0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpLnRyaW1TdGFydCgpfWA7XG5cdFx0XHR0aGlzLmZvY3VzU2VhcmNoKG5ld1F1ZXJ5LCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVMYW5ndWFnZUZpbHRlcnMoKSB7XG5cdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0ICYmIHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkuaW5jbHVkZXMoYEAke0xBTkdVQUdFX1NFVFRJTkdfVEFHfWApKSB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkuc3BsaXQoJyAnKTtcblx0XHRcdGNvbnN0IG5ld1F1ZXJ5ID0gcXVlcnkuZmlsdGVyKHdvcmQgPT4gIXdvcmQuc3RhcnRzV2l0aChgQCR7TEFOR1VBR0VfU0VUVElOR19UQUd9YCkpLmpvaW4oJyAnKTtcblx0XHRcdHRoaXMuZm9jdXNTZWFyY2gobmV3UXVlcnksIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVNldHRpbmdzVHJlZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5zZXR0aW5nUmVuZGVyZXJzID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nVHJlZVJlbmRlcmVycykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2V0dGluZ1JlbmRlcmVycy5vbkRpZENoYW5nZVNldHRpbmcoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlU2V0dGluZyhlLmtleSwgZS52YWx1ZSwgZS50eXBlLCBlLm1hbnVhbFJlc2V0LCBlLnNjb3BlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2V0dGluZ1JlbmRlcmVycy5vbkRpZERpc21pc3NFeHRlbnNpb25TZXR0aW5nKChlKSA9PiB0aGlzLm9uRGlkRGlzbWlzc0V4dGVuc2lvblNldHRpbmcoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdSZW5kZXJlcnMub25EaWRPcGVuU2V0dGluZ3Moc2V0dGluZ0tleSA9PiB7XG5cdFx0XHR0aGlzLm9wZW5TZXR0aW5nc0ZpbGUoeyByZXZlYWxTZXR0aW5nOiB7IGtleTogc2V0dGluZ0tleSwgZWRpdDogdHJ1ZSB9IH0pO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdSZW5kZXJlcnMub25EaWRDbGlja1NldHRpbmdMaW5rKHNldHRpbmdOYW1lID0+IHRoaXMub25EaWRDbGlja1NldHRpbmcoc2V0dGluZ05hbWUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nUmVuZGVyZXJzLm9uRGlkRm9jdXNTZXR0aW5nKGVsZW1lbnQgPT4ge1xuXHRcdFx0dGhpcy5zZXR0aW5nc1RyZWUuc2V0Rm9jdXMoW2VsZW1lbnRdKTtcblx0XHRcdHRoaXMuX2N1cnJlbnRGb2N1c0NvbnRleHQgPSBTZXR0aW5nc0ZvY3VzQ29udGV4dC5TZXR0aW5nQ29udHJvbDtcblx0XHRcdHRoaXMuc2V0dGluZ1Jvd0ZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nUmVuZGVyZXJzLm9uRGlkQ2hhbmdlU2V0dGluZ0hlaWdodCgocGFyYW1zOiBIZWlnaHRDaGFuZ2VQYXJhbXMpID0+IHtcblx0XHRcdGNvbnN0IHsgZWxlbWVudCwgaGVpZ2h0IH0gPSBwYXJhbXM7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLnNldHRpbmdzVHJlZS51cGRhdGVFbGVtZW50SGVpZ2h0KGVsZW1lbnQsIGhlaWdodCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIHRoZSBlbGVtZW50IHdhcyBub3QgZm91bmRcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nUmVuZGVyZXJzLm9uQXBwbHlGaWx0ZXIoKGZpbHRlcikgPT4gdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nUmVuZGVyZXJzLm9uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQoKGVsZW1lbnQ6IElTZXR0aW5nT3ZlcnJpZGVDbGlja0V2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLnJlbW92ZUxhbmd1YWdlRmlsdGVycygpO1xuXHRcdFx0aWYgKGVsZW1lbnQubGFuZ3VhZ2UpIHtcblx0XHRcdFx0dGhpcy5hcHBseUZpbHRlcihgQCR7TEFOR1VBR0VfU0VUVElOR19UQUd9JHtlbGVtZW50Lmxhbmd1YWdlfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWxlbWVudC5zY29wZSA9PT0gJ3dvcmtzcGFjZScpIHtcblx0XHRcdFx0dGhpcy5zZXR0aW5nc1RhcmdldHNXaWRnZXQudXBkYXRlVGFyZ2V0KENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5zY29wZSA9PT0gJ3VzZXInKSB7XG5cdFx0XHRcdHRoaXMuc2V0dGluZ3NUYXJnZXRzV2lkZ2V0LnVwZGF0ZVRhcmdldChDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50LnNjb3BlID09PSAncmVtb3RlJykge1xuXHRcdFx0XHR0aGlzLnNldHRpbmdzVGFyZ2V0c1dpZGdldC51cGRhdGVUYXJnZXQoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmFwcGx5RmlsdGVyKGBAJHtJRF9TRVRUSU5HX1RBR30ke2VsZW1lbnQuc2V0dGluZ0tleX1gKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnNldHRpbmdzVHJlZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0dGluZ3NUcmVlLFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0dGhpcy52aWV3U3RhdGUsXG5cdFx0XHR0aGlzLnNldHRpbmdSZW5kZXJlcnMuYWxsUmVuZGVyZXJzKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdzVHJlZS5vbkRpZFNjcm9sbCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5nc1RyZWUuc2Nyb2xsVG9wID09PSB0aGlzLnNldHRpbmdzVHJlZVNjcm9sbFRvcCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2V0dGluZ3NUcmVlU2Nyb2xsVG9wID0gdGhpcy5zZXR0aW5nc1RyZWUuc2Nyb2xsVG9wO1xuXG5cdFx0XHQvLyBzZXRUaW1lb3V0IGJlY2F1c2UgY2FsbGluZyBzZXRDaGlsZHJlbiBvbiB0aGUgc2V0dGluZ3NUcmVlIGNhbiB0cmlnZ2VyIG9uRGlkU2Nyb2xsLCBzbyBpdCBmaXJlcyB3aGVuXG5cdFx0XHQvLyBzZXRDaGlsZHJlbiBoYXMgY2FsbGVkIG9uIHRoZSBzZXR0aW5ncyB0cmVlIGJ1dCBub3QgdGhlIHRvYyB0cmVlIHlldCwgc28gdGhlaXIgcmVuZGVyZWQgZWxlbWVudHMgYXJlIG91dCBvZiBzeW5jXG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVUcmVlU2Nyb2xsU3luYygpO1xuXHRcdFx0fSwgMCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nc1RyZWUub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHRjb25zdCBjbGFzc0xpc3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50Py5jbGFzc0xpc3Q7XG5cdFx0XHRpZiAoY2xhc3NMaXN0ICYmIGNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLWxpc3QnKSAmJiBjbGFzc0xpc3QuY29udGFpbnMoJ3NldHRpbmdzLWVkaXRvci10cmVlJykpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudEZvY3VzQ29udGV4dCA9IFNldHRpbmdzRm9jdXNDb250ZXh0LlNldHRpbmdUcmVlO1xuXHRcdFx0XHR0aGlzLnNldHRpbmdSb3dGb2N1c2VkLnNldCh0cnVlKTtcblx0XHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQgPz89IHRoaXMuc2V0dGluZ3NUcmVlLmZpcnN0VmlzaWJsZUVsZW1lbnQgPz8gbnVsbDtcblx0XHRcdFx0aWYgKHRoaXMudHJlZUZvY3VzZWRFbGVtZW50KSB7XG5cdFx0XHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQudGFiYmFibGUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXR0aW5nc1RyZWUub25EaWRCbHVyKCgpID0+IHtcblx0XHRcdHRoaXMuc2V0dGluZ1Jvd0ZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHRcdC8vIENsZWFyIG91dCB0aGUgZm9jdXNlZCBlbGVtZW50LCBvdGhlcndpc2UgaXQgY291bGQgYmVcblx0XHRcdC8vIG91dCBvZiBkYXRlIGR1cmluZyB0aGUgbmV4dCBvbkRpZEZvY3VzIGV2ZW50LlxuXHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQgPSBudWxsO1xuXHRcdH0pKTtcblxuXHRcdC8vIFRoZXJlIGlzIG5vIGRpZmZlcmVudCBzZWxlY3Qgc3RhdGUgaW4gdGhlIHNldHRpbmdzIHRyZWVcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNldHRpbmdzVHJlZS5vbkRpZENoYW5nZUZvY3VzKGUgPT4ge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudHNbMF07XG5cdFx0XHRpZiAodGhpcy50cmVlRm9jdXNlZEVsZW1lbnQgPT09IGVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy50cmVlRm9jdXNlZEVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQudGFiYmFibGUgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQgPSBlbGVtZW50O1xuXG5cdFx0XHRpZiAodGhpcy50cmVlRm9jdXNlZEVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy50cmVlRm9jdXNlZEVsZW1lbnQudGFiYmFibGUgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldHRpbmdzVHJlZS5zZXRTZWxlY3Rpb24oZWxlbWVudCA/IFtlbGVtZW50XSA6IFtdKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlU2V0dGluZyhrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgdHlwZTogU2V0dGluZ1ZhbHVlVHlwZSB8IFNldHRpbmdWYWx1ZVR5cGVbXSwgbWFudWFsUmVzZXQ6IGJvb2xlYW4sIHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBwYXJzZWRRdWVyeSA9IHBhcnNlUXVlcnkodGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VGaWx0ZXIgPSBwYXJzZWRRdWVyeS5sYW5ndWFnZUZpbHRlcjtcblx0XHRpZiAobWFudWFsUmVzZXQgfHwgKHRoaXMucGVuZGluZ1NldHRpbmdVcGRhdGUgJiYgdGhpcy5wZW5kaW5nU2V0dGluZ1VwZGF0ZS5rZXkgIT09IGtleSkpIHtcblx0XHRcdHRoaXMudXBkYXRlQ2hhbmdlZFNldHRpbmcoa2V5LCB2YWx1ZSwgbWFudWFsUmVzZXQsIGxhbmd1YWdlRmlsdGVyLCBzY29wZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wZW5kaW5nU2V0dGluZ1VwZGF0ZSA9IHsga2V5LCB2YWx1ZSwgbGFuZ3VhZ2VGaWx0ZXIgfTtcblx0XHRpZiAoU2V0dGluZ3NFZGl0b3IyLnNob3VsZFNldHRpbmdVcGRhdGVGYXN0KHR5cGUpKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdGYXN0VXBkYXRlRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlQ2hhbmdlZFNldHRpbmcoa2V5LCB2YWx1ZSwgbWFudWFsUmVzZXQsIGxhbmd1YWdlRmlsdGVyLCBzY29wZSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldHRpbmdTbG93VXBkYXRlRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlQ2hhbmdlZFNldHRpbmcoa2V5LCB2YWx1ZSwgbWFudWFsUmVzZXQsIGxhbmd1YWdlRmlsdGVyLCBzY29wZSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVHJlZVNjcm9sbFN5bmMoKTogdm9pZCB7XG5cdFx0dGhpcy5zZXR0aW5nUmVuZGVyZXJzLmNhbmNlbFN1Z2dlc3RlcnMoKTtcblx0XHRpZiAodGhpcy5zZWFyY2hSZXN1bHRNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy50b2NUcmVlTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50VG9TeW5jID0gdGhpcy5zZXR0aW5nc1RyZWUuZmlyc3RWaXNpYmxlRWxlbWVudDtcblx0XHRjb25zdCBlbGVtZW50ID0gZWxlbWVudFRvU3luYyBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50ID8gZWxlbWVudFRvU3luYy5wYXJlbnQgOlxuXHRcdFx0ZWxlbWVudFRvU3luYyBpbnN0YW5jZW9mIFNldHRpbmdzVHJlZUdyb3VwRWxlbWVudCA/IGVsZW1lbnRUb1N5bmMgOlxuXHRcdFx0XHRudWxsO1xuXG5cdFx0Ly8gSXQncyBwb3NzaWJsZSBmb3IgdGhpcyB0byBiZSBjYWxsZWQgd2hlbiB0aGUgVE9DIGFuZCBzZXR0aW5ncyB0cmVlIGFyZSBvdXQgb2Ygc3luYyAtIGUuZy4gd2hlbiB0aGUgc2V0dGluZ3MgdHJlZSBoYXMgZGVmZXJyZWQgYSByZWZyZXNoIGJlY2F1c2Vcblx0XHQvLyBpdCBpcyBmb2N1c2VkLiBTbywgYmFpbCBpZiBlbGVtZW50IGRvZXNuJ3QgZXhpc3QgaW4gdGhlIFRPQy5cblx0XHRsZXQgbm9kZUV4aXN0cyA9IHRydWU7XG5cdFx0dHJ5IHsgdGhpcy50b2NUcmVlLmdldE5vZGUoZWxlbWVudCk7IH0gY2F0Y2ggKGUpIHsgbm9kZUV4aXN0cyA9IGZhbHNlOyB9XG5cdFx0aWYgKCFub2RlRXhpc3RzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgJiYgdGhpcy50b2NUcmVlLmdldFNlbGVjdGlvbigpWzBdICE9PSBlbGVtZW50KSB7XG5cdFx0XHRjb25zdCBhbmNlc3RvcnMgPSB0aGlzLmdldEFuY2VzdG9ycyhlbGVtZW50KTtcblx0XHRcdGFuY2VzdG9ycy5mb3JFYWNoKGUgPT4gdGhpcy50b2NUcmVlLmV4cGFuZCg8U2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50PmUpKTtcblxuXHRcdFx0dGhpcy50b2NUcmVlLnJldmVhbChlbGVtZW50KTtcblx0XHRcdGNvbnN0IGVsZW1lbnRUb3AgPSB0aGlzLnRvY1RyZWUuZ2V0UmVsYXRpdmVUb3AoZWxlbWVudCk7XG5cdFx0XHRpZiAodHlwZW9mIGVsZW1lbnRUb3AgIT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50b2NUcmVlLmNvbGxhcHNlQWxsKCk7XG5cblx0XHRcdGFuY2VzdG9ycy5mb3JFYWNoKGUgPT4gdGhpcy50b2NUcmVlLmV4cGFuZCg8U2V0dGluZ3NUcmVlR3JvdXBFbGVtZW50PmUpKTtcblx0XHRcdGlmIChlbGVtZW50VG9wIDwgMCB8fCBlbGVtZW50VG9wID4gMSkge1xuXHRcdFx0XHR0aGlzLnRvY1RyZWUucmV2ZWFsKGVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy50b2NUcmVlLnJldmVhbChlbGVtZW50LCBlbGVtZW50VG9wKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50b2NUcmVlLmV4cGFuZChlbGVtZW50KTtcblxuXHRcdFx0dGhpcy50b2NUcmVlLnNldFNlbGVjdGlvbihbZWxlbWVudF0pO1xuXG5cdFx0XHRjb25zdCBmYWtlS2V5Ym9hcmRFdmVudCA9IG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJyk7XG5cdFx0XHQoPElGb2N1c0V2ZW50RnJvbVNjcm9sbD5mYWtlS2V5Ym9hcmRFdmVudCkuZnJvbVNjcm9sbCA9IHRydWU7XG5cdFx0XHR0aGlzLnRvY1RyZWUuc2V0Rm9jdXMoW2VsZW1lbnRdLCBmYWtlS2V5Ym9hcmRFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRBbmNlc3RvcnMoZWxlbWVudDogU2V0dGluZ3NUcmVlRWxlbWVudCk6IFNldHRpbmdzVHJlZUVsZW1lbnRbXSB7XG5cdFx0Y29uc3QgYW5jZXN0b3JzOiBhbnlbXSA9IFtdO1xuXG5cdFx0d2hpbGUgKGVsZW1lbnQucGFyZW50KSB7XG5cdFx0XHRpZiAoZWxlbWVudC5wYXJlbnQuaWQgIT09ICdyb290Jykge1xuXHRcdFx0XHRhbmNlc3RvcnMucHVzaChlbGVtZW50LnBhcmVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYW5jZXN0b3JzLnJldmVyc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ2hhbmdlZFNldHRpbmcoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIG1hbnVhbFJlc2V0OiBib29sZWFuLCBsYW5ndWFnZUZpbHRlcjogc3RyaW5nIHwgdW5kZWZpbmVkLCBzY29wZTogQ29uZmlndXJhdGlvblNjb3BlIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQ29uZmlndXJhdGlvblNlcnZpY2UgZGlzcGxheXMgdGhlIGVycm9yIGlmIHRoaXMgZmFpbHMuXG5cdFx0Ly8gRm9yY2UgYSByZW5kZXIgYWZ0ZXJ3YXJkcyBiZWNhdXNlIG9uRGlkQ29uZmlndXJhdGlvblVwZGF0ZSBkb2Vzbid0IGZpcmUgaWYgdGhlIHVwZGF0ZSBkb2Vzbid0IHJlc3VsdCBpbiBhbiBlZmZlY3RpdmUgc2V0dGluZyB2YWx1ZSBjaGFuZ2UuXG5cdFx0Y29uc3Qgc2V0dGluZ3NUYXJnZXQgPSB0aGlzLnNldHRpbmdzVGFyZ2V0c1dpZGdldC5zZXR0aW5nc1RhcmdldDtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5pc1VyaShzZXR0aW5nc1RhcmdldCkgPyBzZXR0aW5nc1RhcmdldCA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uVGFyZ2V0ID0gPENvbmZpZ3VyYXRpb25UYXJnZXQgfCBudWxsPihyZXNvdXJjZSA/IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUiA6IHNldHRpbmdzVGFyZ2V0KSA/PyBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzOiBJQ29uZmlndXJhdGlvblVwZGF0ZU92ZXJyaWRlcyA9IHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcnM6IGxhbmd1YWdlRmlsdGVyID8gW2xhbmd1YWdlRmlsdGVyXSA6IHVuZGVmaW5lZCB9O1xuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblRhcmdldElzV29ya3NwYWNlID0gY29uZmlndXJhdGlvblRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UgfHwgY29uZmlndXJhdGlvblRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSO1xuXG5cdFx0Y29uc3QgdXNlclBhc3NlZEluTWFudWFsUmVzZXQgPSBjb25maWd1cmF0aW9uVGFyZ2V0SXNXb3Jrc3BhY2UgfHwgISFsYW5ndWFnZUZpbHRlcjtcblx0XHRjb25zdCBpc01hbnVhbFJlc2V0ID0gdXNlclBhc3NlZEluTWFudWFsUmVzZXQgPyBtYW51YWxSZXNldCA6IHZhbHVlID09PSB1bmRlZmluZWQ7XG5cblx0XHQvLyBJZiB0aGUgdXNlciBpcyBjaGFuZ2luZyB0aGUgdmFsdWUgYmFjayB0byB0aGUgZGVmYXVsdCwgYW5kIHdlJ3JlIG5vdCB0YXJnZXRpbmcgYSB3b3Jrc3BhY2Ugc2NvcGUsIGRvIGEgJ3Jlc2V0JyBpbnN0ZWFkXG5cdFx0Y29uc3QgaW5zcGVjdGVkID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGtleSwgb3ZlcnJpZGVzKTtcblx0XHRpZiAoIXVzZXJQYXNzZWRJbk1hbnVhbFJlc2V0ICYmIGluc3BlY3RlZC5kZWZhdWx0VmFsdWUgPT09IHZhbHVlKSB7XG5cdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShrZXksIHZhbHVlLCBvdmVycmlkZXMsIGNvbmZpZ3VyYXRpb25UYXJnZXQsIHsgaGFuZGxlRGlydHlGaWxlOiAnc2F2ZScgfSlcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgcXVlcnkgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpO1xuXHRcdFx0XHRpZiAocXVlcnkuaW5jbHVkZXMoYEAke01PRElGSUVEX1NFVFRJTkdfVEFHfWApKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIHVzZXIgbWlnaHQgaGF2ZSByZXNldCBhIHNldHRpbmcuXG5cdFx0XHRcdFx0dGhpcy5yZWZyZXNoVE9DVHJlZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJlZShrZXksIGlzTWFudWFsUmVzZXQpO1xuXHRcdFx0XHR0aGlzLnBlbmRpbmdTZXR0aW5nVXBkYXRlID0gbnVsbDtcblxuXHRcdFx0XHRjb25zdCByZXBvcnRNb2RpZmllZFByb3BzID0ge1xuXHRcdFx0XHRcdGtleSxcblx0XHRcdFx0XHRxdWVyeSxcblx0XHRcdFx0XHRzZWFyY2hSZXN1bHRzOiB0aGlzLnNlYXJjaFJlc3VsdE1vZGVsPy5nZXRVbmlxdWVSZXN1bHRzKCkgPz8gbnVsbCxcblx0XHRcdFx0XHRyYXdSZXN1bHRzOiB0aGlzLnNlYXJjaFJlc3VsdE1vZGVsPy5nZXRSYXdSZXN1bHRzKCkgPz8gbnVsbCxcblx0XHRcdFx0XHRzaG93Q29uZmlndXJlZE9ubHk6ICEhdGhpcy52aWV3U3RhdGUudGFnRmlsdGVycyAmJiB0aGlzLnZpZXdTdGF0ZS50YWdGaWx0ZXJzLmhhcyhNT0RJRklFRF9TRVRUSU5HX1RBRyksXG5cdFx0XHRcdFx0aXNSZXNldDogdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJyxcblx0XHRcdFx0XHRzZXR0aW5nc1RhcmdldDogdGhpcy5zZXR0aW5nc1RhcmdldHNXaWRnZXQuc2V0dGluZ3NUYXJnZXQgYXMgU2V0dGluZ3NUYXJnZXRcblx0XHRcdFx0fTtcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVwb3J0TW9kaWZpZWRTZXR0aW5nKHJlcG9ydE1vZGlmaWVkUHJvcHMpO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydE1vZGlmaWVkU2V0dGluZyhwcm9wczogeyBrZXk6IHN0cmluZzsgcXVlcnk6IHN0cmluZzsgc2VhcmNoUmVzdWx0czogSVNlYXJjaFJlc3VsdCB8IG51bGw7IHJhd1Jlc3VsdHM6IElTZWFyY2hSZXN1bHRbXSB8IG51bGw7IHNob3dDb25maWd1cmVkT25seTogYm9vbGVhbjsgaXNSZXNldDogYm9vbGVhbjsgc2V0dGluZ3NUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0IH0pOiB2b2lkIHtcblx0XHR0eXBlIFNldHRpbmdzRWRpdG9yTW9kaWZpZWRTZXR0aW5nRXZlbnQgPSB7XG5cdFx0XHRrZXk6IHN0cmluZztcblx0XHRcdGdyb3VwSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdG5scEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRkaXNwbGF5SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRcdHNob3dDb25maWd1cmVkT25seTogYm9vbGVhbjtcblx0XHRcdGlzUmVzZXQ6IGJvb2xlYW47XG5cdFx0XHR0YXJnZXQ6IHN0cmluZztcblx0XHR9O1xuXHRcdHR5cGUgU2V0dGluZ3NFZGl0b3JNb2RpZmllZFNldHRpbmdDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdGtleTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBzZXR0aW5nIHRoYXQgaXMgYmVpbmcgbW9kaWZpZWQuJyB9O1xuXHRcdFx0Z3JvdXBJZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHNldHRpbmcgaXMgZnJvbSB0aGUgbG9jYWwgc2VhcmNoIG9yIHJlbW90ZSBzZWFyY2ggcHJvdmlkZXIsIGlmIGFwcGxpY2FibGUuJyB9O1xuXHRcdFx0bmxwSW5kZXg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaW5kZXggb2YgdGhlIHNldHRpbmcgaW4gdGhlIHJlbW90ZSBzZWFyY2ggcHJvdmlkZXIgcmVzdWx0cywgaWYgYXBwbGljYWJsZS4nIH07XG5cdFx0XHRkaXNwbGF5SW5kZXg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaW5kZXggb2YgdGhlIHNldHRpbmcgaW4gdGhlIGNvbWJpbmVkIHNlYXJjaCByZXN1bHRzLCBpZiBhcHBsaWNhYmxlLicgfTtcblx0XHRcdHNob3dDb25maWd1cmVkT25seTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHVzZXIgaXMgaW4gdGhlIG1vZGlmaWVkIHZpZXcsIHdoaWNoIHNob3dzIGNvbmZpZ3VyZWQgc2V0dGluZ3Mgb25seS4nIH07XG5cdFx0XHRpc1Jlc2V0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSWRlbnRpZmllcyB3aGV0aGVyIGEgc2V0dGluZyB3YXMgcmVzZXQgdG8gaXRzIGRlZmF1bHQgdmFsdWUuJyB9O1xuXHRcdFx0dGFyZ2V0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHNjb3BlIG9mIHRoZSBzZXR0aW5nLCBzdWNoIGFzIHVzZXIgb3Igd29ya3NwYWNlLicgfTtcblx0XHRcdG93bmVyOiAncnpoYW8yNzEnO1xuXHRcdFx0Y29tbWVudDogJ0V2ZW50IGVtaXR0ZWQgd2hlbiB0aGUgdXNlciBtb2RpZmllcyBhIHNldHRpbmcgaW4gdGhlIFNldHRpbmdzIGVkaXRvcic7XG5cdFx0fTtcblxuXHRcdGxldCBncm91cElkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IG5scEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGRpc3BsYXlJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChwcm9wcy5zZWFyY2hSZXN1bHRzKSB7XG5cdFx0XHRkaXNwbGF5SW5kZXggPSBwcm9wcy5zZWFyY2hSZXN1bHRzLmZpbHRlck1hdGNoZXMuZmluZEluZGV4KG0gPT4gbS5zZXR0aW5nLmtleSA9PT0gcHJvcHMua2V5KTtcblxuXHRcdFx0aWYgKHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwpIHtcblx0XHRcdFx0Y29uc3QgcmF3UmVzdWx0cyA9IHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwuZ2V0UmF3UmVzdWx0cygpO1xuXHRcdFx0XHRpZiAocmF3UmVzdWx0c1tTZWFyY2hSZXN1bHRJZHguTG9jYWxdICYmIGRpc3BsYXlJbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2V0dGluZ0luTG9jYWxSZXN1bHRzID0gcmF3UmVzdWx0c1tTZWFyY2hSZXN1bHRJZHguTG9jYWxdLmZpbHRlck1hdGNoZXMuc29tZShtID0+IG0uc2V0dGluZy5rZXkgPT09IHByb3BzLmtleSk7XG5cdFx0XHRcdFx0Z3JvdXBJZCA9IHNldHRpbmdJbkxvY2FsUmVzdWx0cyA/ICdsb2NhbCcgOiAncmVtb3RlJztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocmF3UmVzdWx0c1tTZWFyY2hSZXN1bHRJZHguUmVtb3RlXSkge1xuXHRcdFx0XHRcdGNvbnN0IF9ubHBJbmRleCA9IHJhd1Jlc3VsdHNbU2VhcmNoUmVzdWx0SWR4LlJlbW90ZV0uZmlsdGVyTWF0Y2hlcy5maW5kSW5kZXgobSA9PiBtLnNldHRpbmcua2V5ID09PSBwcm9wcy5rZXkpO1xuXHRcdFx0XHRcdG5scEluZGV4ID0gX25scEluZGV4ID49IDAgPyBfbmxwSW5kZXggOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXBvcnRlZFRhcmdldCA9IHByb3BzLnNldHRpbmdzVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwgPyAndXNlcicgOlxuXHRcdFx0cHJvcHMuc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUgPyAndXNlcl9yZW1vdGUnIDpcblx0XHRcdFx0cHJvcHMuc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFID8gJ3dvcmtzcGFjZScgOlxuXHRcdFx0XHRcdCdmb2xkZXInO1xuXG5cdFx0Y29uc3QgZGF0YSA9IHtcblx0XHRcdGtleTogcHJvcHMua2V5LFxuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdG5scEluZGV4LFxuXHRcdFx0ZGlzcGxheUluZGV4LFxuXHRcdFx0c2hvd0NvbmZpZ3VyZWRPbmx5OiBwcm9wcy5zaG93Q29uZmlndXJlZE9ubHksXG5cdFx0XHRpc1Jlc2V0OiBwcm9wcy5pc1Jlc2V0LFxuXHRcdFx0dGFyZ2V0OiByZXBvcnRlZFRhcmdldFxuXHRcdH07XG5cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTZXR0aW5nc0VkaXRvck1vZGlmaWVkU2V0dGluZ0V2ZW50LCBTZXR0aW5nc0VkaXRvck1vZGlmaWVkU2V0dGluZ0NsYXNzaWZpY2F0aW9uPignc2V0dGluZ3NFZGl0b3Iuc2V0dGluZ01vZGlmaWVkJywgZGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlUmVmcmVzaChlbGVtZW50OiBIVE1MRWxlbWVudCwga2V5ID0gJycpOiB2b2lkIHtcblx0XHRpZiAoa2V5ICYmIHRoaXMuc2NoZWR1bGVkUmVmcmVzaGVzLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCFrZXkpIHtcblx0XHRcdGRpc3Bvc2UodGhpcy5zY2hlZHVsZWRSZWZyZXNoZXMudmFsdWVzKCkpO1xuXHRcdFx0dGhpcy5zY2hlZHVsZWRSZWZyZXNoZXMuY2xlYXIoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBzY2hlZHVsZWRSZWZyZXNoVHJhY2tlciA9IERPTS50cmFja0ZvY3VzKGVsZW1lbnQpO1xuXHRcdHN0b3JlLmFkZChzY2hlZHVsZWRSZWZyZXNoVHJhY2tlcik7XG5cdFx0c3RvcmUuYWRkKHNjaGVkdWxlZFJlZnJlc2hUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHR0aGlzLnNjaGVkdWxlZFJlZnJlc2hlcy5nZXQoa2V5KT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5zY2hlZHVsZWRSZWZyZXNoZXMuZGVsZXRlKGtleSk7XG5cdFx0XHR0aGlzLm9uQ29uZmlnVXBkYXRlKG5ldyBTZXQoW2tleV0pKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5zY2hlZHVsZWRSZWZyZXNoZXMuc2V0KGtleSwgc3RvcmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTZXR0aW5nc09yZGVyQnlUb2NJbmRleChyZXNvbHZlZFNldHRpbmdzUm9vdDogSVRPQ0VudHJ5PElTZXR0aW5nPik6IE1hcDxzdHJpbmcsIG51bWJlcj4ge1xuXHRcdGNvbnN0IGluZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRmdW5jdGlvbiBpbmRleFNldHRpbmdzKHJlc29sdmVkU2V0dGluZ3NSb290OiBJVE9DRW50cnk8SVNldHRpbmc+LCBjb3VudGVyID0gMCk6IG51bWJlciB7XG5cdFx0XHRpZiAocmVzb2x2ZWRTZXR0aW5nc1Jvb3Quc2V0dGluZ3MpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHJlc29sdmVkU2V0dGluZ3NSb290LnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0aWYgKCFpbmRleC5oYXMoc2V0dGluZy5rZXkpKSB7XG5cdFx0XHRcdFx0XHRpbmRleC5zZXQoc2V0dGluZy5rZXksIGNvdW50ZXIrKyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzb2x2ZWRTZXR0aW5nc1Jvb3QuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiByZXNvbHZlZFNldHRpbmdzUm9vdC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdGNvdW50ZXIgPSBpbmRleFNldHRpbmdzKGNoaWxkLCBjb3VudGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNvdW50ZXI7XG5cdFx0fVxuXHRcdGluZGV4U2V0dGluZ3MocmVzb2x2ZWRTZXR0aW5nc1Jvb3QpO1xuXHRcdHJldHVybiBpbmRleDtcblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaE1vZGVscyhyZXNvbHZlZFNldHRpbmdzUm9vdDogSVRPQ0VudHJ5PElTZXR0aW5nPikge1xuXHRcdC8vIEJvdGggY2FsbHMgdG8gcmVmcmVzaE1vZGVscyByZXF1aXJlIGEgdmFsaWQgc2V0dGluZ3NUcmVlTW9kZWwuXG5cdFx0dGhpcy5zZXR0aW5nc1RyZWVNb2RlbC52YWx1ZSEudXBkYXRlKHJlc29sdmVkU2V0dGluZ3NSb290KTtcblx0XHR0aGlzLnRvY1RyZWVNb2RlbC5zZXR0aW5nc1RyZWVSb290ID0gdGhpcy5zZXR0aW5nc1RyZWVNb2RlbC52YWx1ZSEucm9vdDtcblx0XHR0aGlzLnNldHRpbmdzT3JkZXJCeVRvY0luZGV4ID0gdGhpcy5jcmVhdGVTZXR0aW5nc09yZGVyQnlUb2NJbmRleChyZXNvbHZlZFNldHRpbmdzUm9vdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uQ29uZmlnVXBkYXRlKGtleXM/OiBSZWFkb25seVNldDxzdHJpbmc+LCBmb3JjZVJlZnJlc2ggPSBmYWxzZSwgc2NoZW1hQ2hhbmdlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoa2V5cyAmJiB0aGlzLnNldHRpbmdzVHJlZU1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy51cGRhdGVFbGVtZW50c0J5S2V5KGtleXMpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5kZWZhdWx0U2V0dGluZ3NFZGl0b3JNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGdyb3VwcyA9IHRoaXMuZGVmYXVsdFNldHRpbmdzRWRpdG9yTW9kZWwuc2V0dGluZ3NHcm91cHMuc2xpY2UoMSk7IC8vIFdpdGhvdXQgY29tbW9ubHlVc2VkXG5cblx0XHRjb25zdCBjb3JlU2V0dGluZ3MgPSBncm91cHMuZmlsdGVyKGcgPT4gIWcuZXh0ZW5zaW9uSW5mbyk7XG5cdFx0Y29uc3Qgc2V0dGluZ3NSZXN1bHQgPSByZXNvbHZlU2V0dGluZ3NUcmVlKHRvY0RhdGEsIGNvcmVTZXR0aW5ncywgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRjb25zdCByZXNvbHZlZFNldHRpbmdzUm9vdCA9IHNldHRpbmdzUmVzdWx0LnRyZWU7XG5cblx0XHQvLyBXYXJuIGZvciBzZXR0aW5ncyBub3QgaW5jbHVkZWQgaW4gbGF5b3V0XG5cdFx0aWYgKHNldHRpbmdzUmVzdWx0LmxlZnRvdmVyU2V0dGluZ3Muc2l6ZSAmJiAhdGhpcy5oYXNXYXJuZWRNaXNzaW5nU2V0dGluZ3MpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdLZXlMaXN0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0c2V0dGluZ3NSZXN1bHQubGVmdG92ZXJTZXR0aW5ncy5mb3JFYWNoKHMgPT4ge1xuXHRcdFx0XHRzZXR0aW5nS2V5TGlzdC5wdXNoKHMua2V5KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgU2V0dGluZ3NFZGl0b3IyOiBTZXR0aW5ncyBub3QgaW5jbHVkZWQgaW4gc2V0dGluZ3NMYXlvdXQudHM6ICR7c2V0dGluZ0tleUxpc3Quam9pbignLCAnKX1gKTtcblx0XHRcdHRoaXMuaGFzV2FybmVkTWlzc2luZ1NldHRpbmdzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBhZGRpdGlvbmFsR3JvdXBzOiBJU2V0dGluZ3NHcm91cFtdID0gW107XG5cdFx0bGV0IHNldEFkZGl0aW9uYWxHcm91cHMgPSBmYWxzZTtcblx0XHRjb25zdCB0b2dnbGVEYXRhID0gYXdhaXQgZ2V0RXhwZXJpbWVudGFsRXh0ZW5zaW9uVG9nZ2xlRGF0YSh0aGlzLmV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCB0aGlzLnByb2R1Y3RTZXJ2aWNlKTtcblx0XHRpZiAodG9nZ2xlRGF0YSAmJiBncm91cHMuZmlsdGVyKGcgPT4gZy5leHRlbnNpb25JbmZvKS5sZW5ndGgpIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IGluIHRvZ2dsZURhdGEuc2V0dGluZ3NFZGl0b3JSZWNvbW1lbmRlZEV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiA9IHRvZ2dsZURhdGEucmVjb21tZW5kZWRFeHRlbnNpb25zR2FsbGVyeUluZm9ba2V5XTtcblx0XHRcdFx0aWYgKCFleHRlbnNpb24pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQ7XG5cdFx0XHRcdC8vIHByZXZlbnQgcmFjZSBiZXR3ZWVuIGV4dGVuc2lvbiB1cGRhdGUgaGFuZGxlciBhbmQgdGhpcyAob25Db25maWdVcGRhdGUpIGhhbmRsZXJcblx0XHRcdFx0YXdhaXQgdGhpcy5yZWZyZXNoSW5zdGFsbGVkRXh0ZW5zaW9uc0xpc3QoKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uSW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWRFeHRlbnNpb25JZHMuaW5jbHVkZXMoZXh0ZW5zaW9uSWQpO1xuXG5cdFx0XHRcdC8vIERyaWxsIGRvd24gdG8gc2VlIHdoZXRoZXIgdGhlIGdyb3VwIGFuZCBzZXR0aW5nIGFscmVhZHkgZXhpc3Rcblx0XHRcdFx0Ly8gYW5kIG5lZWQgdG8gYmUgcmVtb3ZlZC5cblx0XHRcdFx0Y29uc3QgbWF0Y2hpbmdHcm91cEluZGV4ID0gZ3JvdXBzLmZpbmRJbmRleChnID0+XG5cdFx0XHRcdFx0Zy5leHRlbnNpb25JbmZvICYmIGcuZXh0ZW5zaW9uSW5mbyEuaWQudG9Mb3dlckNhc2UoKSA9PT0gZXh0ZW5zaW9uSWQudG9Mb3dlckNhc2UoKSAmJlxuXHRcdFx0XHRcdGcuc2VjdGlvbnMubGVuZ3RoID09PSAxICYmIGcuc2VjdGlvbnNbMF0uc2V0dGluZ3MubGVuZ3RoID09PSAxICYmIGcuc2VjdGlvbnNbMF0uc2V0dGluZ3NbMF0uZGlzcGxheUV4dGVuc2lvbklkXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25JbnN0YWxsZWQgfHwgdGhpcy5kaXNtaXNzZWRFeHRlbnNpb25TZXR0aW5ncy5pbmNsdWRlcyhleHRlbnNpb25JZCkpIHtcblx0XHRcdFx0XHRpZiAobWF0Y2hpbmdHcm91cEluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Z3JvdXBzLnNwbGljZShtYXRjaGluZ0dyb3VwSW5kZXgsIDEpO1xuXHRcdFx0XHRcdFx0c2V0QWRkaXRpb25hbEdyb3VwcyA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1hdGNoaW5nR3JvdXBJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENyZWF0ZSB0aGUgZW50cnkuIGV4dGVuc2lvbkluc3RhbGxlZCBpcyBmYWxzZSBpbiB0aGlzIGNhc2UuXG5cdFx0XHRcdGxldCBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0IHwgbnVsbCA9IG51bGw7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0bWFuaWZlc3QgPSBhd2FpdCByYWNlVGltZW91dChcblx0XHRcdFx0XHRcdHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QoZXh0ZW5zaW9uLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSxcblx0XHRcdFx0XHRcdEVYVEVOU0lPTl9GRVRDSF9USU1FT1VUX01TXG5cdFx0XHRcdFx0KSA/PyBudWxsO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Ly8gTGlrZWx5IGEgbmV0d29ya2luZyBpc3N1ZS5cblx0XHRcdFx0XHQvLyBTa2lwIGFkZGluZyBhIGJ1dHRvbiBmb3IgdGhpcyBleHRlbnNpb24gdG8gdGhlIFNldHRpbmdzIGVkaXRvci5cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtYW5pZmVzdCA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29udHJpYnV0ZXNDb25maWd1cmF0aW9uID0gbWFuaWZlc3Q/LmNvbnRyaWJ1dGVzPy5jb25maWd1cmF0aW9uO1xuXG5cdFx0XHRcdGxldCBncm91cFRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheShjb250cmlidXRlc0NvbmZpZ3VyYXRpb24pKSB7XG5cdFx0XHRcdFx0Z3JvdXBUaXRsZSA9IGNvbnRyaWJ1dGVzQ29uZmlndXJhdGlvbj8udGl0bGU7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY29udHJpYnV0ZXNDb25maWd1cmF0aW9uLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGdyb3VwVGl0bGUgPSBjb250cmlidXRlc0NvbmZpZ3VyYXRpb25bMF0udGl0bGU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbkluZm8gPSB0b2dnbGVEYXRhLnNldHRpbmdzRWRpdG9yUmVjb21tZW5kZWRFeHRlbnNpb25zW2tleV07XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbk5hbWUgPSBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUgPz8gZXh0ZW5zaW9uSWQ7XG5cdFx0XHRcdGNvbnN0IHNldHRpbmdLZXkgPSBgJHtrZXl9Lm1hbmFnZUV4dGVuc2lvbmA7XG5cdFx0XHRcdGNvbnN0IHNldHRpbmc6IElTZXR0aW5nID0ge1xuXHRcdFx0XHRcdHJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0a2V5OiBzZXR0aW5nS2V5LFxuXHRcdFx0XHRcdGtleVJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0dmFsdWU6IG51bGwsXG5cdFx0XHRcdFx0dmFsdWVSYW5nZTogbnVsbFJhbmdlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBbcmVjb21tZW5kYXRpb25JbmZvLm9uU2V0dGluZ3NFZGl0b3JPcGVuPy5kZXNjcmlwdGlvbk92ZXJyaWRlID8/IGV4dGVuc2lvbi5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25Jc01hcmtkb3duOiBmYWxzZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvblJhbmdlczogW10sXG5cdFx0XHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1csXG5cdFx0XHRcdFx0dHlwZTogJ251bGwnLFxuXHRcdFx0XHRcdGRpc3BsYXlFeHRlbnNpb25JZDogZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uR3JvdXBUaXRsZTogZ3JvdXBUaXRsZSA/PyBleHRlbnNpb25OYW1lLFxuXHRcdFx0XHRcdGNhdGVnb3J5TGFiZWw6ICdFeHRlbnNpb25zJyxcblx0XHRcdFx0XHR0aXRsZTogZXh0ZW5zaW9uTmFtZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBhZGRpdGlvbmFsR3JvdXA6IElTZXR0aW5nc0dyb3VwID0ge1xuXHRcdFx0XHRcdHNlY3Rpb25zOiBbe1xuXHRcdFx0XHRcdFx0c2V0dGluZ3M6IFtzZXR0aW5nXSxcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRpZDogZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdFx0dGl0bGU6IHNldHRpbmcuZXh0ZW5zaW9uR3JvdXBUaXRsZSEsXG5cdFx0XHRcdFx0dGl0bGVSYW5nZTogbnVsbFJhbmdlLFxuXHRcdFx0XHRcdHJhbmdlOiBudWxsUmFuZ2UsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSW5mbzoge1xuXHRcdFx0XHRcdFx0aWQ6IGV4dGVuc2lvbklkLFxuXHRcdFx0XHRcdFx0ZGlzcGxheU5hbWU6IGV4dGVuc2lvbi5kaXNwbGF5TmFtZSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGdyb3Vwcy5wdXNoKGFkZGl0aW9uYWxHcm91cCk7XG5cdFx0XHRcdGFkZGl0aW9uYWxHcm91cHMucHVzaChhZGRpdGlvbmFsR3JvdXApO1xuXHRcdFx0XHRzZXRBZGRpdGlvbmFsR3JvdXBzID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXNvbHZlZFNldHRpbmdzUm9vdC5jaGlsZHJlbiEucHVzaChhd2FpdCBjcmVhdGVUb2NUcmVlRm9yRXh0ZW5zaW9uU2V0dGluZ3ModGhpcy5leHRlbnNpb25TZXJ2aWNlLCBncm91cHMuZmlsdGVyKGcgPT4gZy5leHRlbnNpb25JbmZvKSkpO1xuXG5cdFx0Y29uc3QgY29tbW9ubHlVc2VkRGF0YVRvVXNlID0gZ2V0Q29tbW9ubHlVc2VkRGF0YSh0b2dnbGVEYXRhKTtcblx0XHRjb25zdCBjb21tb25seVVzZWQgPSByZXNvbHZlU2V0dGluZ3NUcmVlKGNvbW1vbmx5VXNlZERhdGFUb1VzZSwgZ3JvdXBzLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdHJlc29sdmVkU2V0dGluZ3NSb290LmNoaWxkcmVuIS51bnNoaWZ0KGNvbW1vbmx5VXNlZC50cmVlKTtcblxuXHRcdGlmICh0b2dnbGVEYXRhICYmIHNldEFkZGl0aW9uYWxHcm91cHMpIHtcblx0XHRcdC8vIEFkZCB0aGUgYWRkaXRpb25hbCBncm91cHMgdG8gdGhlIG1vZGVsIHRvIGhlbHAgd2l0aCBzZWFyY2hpbmcuXG5cdFx0XHR0aGlzLmRlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsLnNldEFkZGl0aW9uYWxHcm91cHMoYWRkaXRpb25hbEdyb3Vwcyk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkgJiYgKHRoaXMudmlld1N0YXRlLnNldHRpbmdzVGFyZ2V0IGluc3RhbmNlb2YgVVJJIHx8IHRoaXMudmlld1N0YXRlLnNldHRpbmdzVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSkpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyZWRVbnRydXN0ZWRXb3Jrc3BhY2VTZXR0aW5ncyA9IHJlc29sdmVDb25maWd1cmVkVW50cnVzdGVkU2V0dGluZ3MoZ3JvdXBzLCB0aGlzLnZpZXdTdGF0ZS5zZXR0aW5nc1RhcmdldCwgdGhpcy52aWV3U3RhdGUubGFuZ3VhZ2VGaWx0ZXIsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0aWYgKGNvbmZpZ3VyZWRVbnRydXN0ZWRXb3Jrc3BhY2VTZXR0aW5ncy5sZW5ndGgpIHtcblx0XHRcdFx0cmVzb2x2ZWRTZXR0aW5nc1Jvb3QuY2hpbGRyZW4hLnVuc2hpZnQoe1xuXHRcdFx0XHRcdGlkOiAnd29ya3NwYWNlVHJ1c3QnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2V0dGluZ3MgcmVxdWlyZSB0cnVzdCcsIFwiV29ya3NwYWNlIFRydXN0XCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBjb25maWd1cmVkVW50cnVzdGVkV29ya3NwYWNlU2V0dGluZ3Ncblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRNb2RlbD8udXBkYXRlQ2hpbGRyZW4oKTtcblxuXHRcdGlmICh0aGlzLnNldHRpbmdzVHJlZU1vZGVsLnZhbHVlKSB7XG5cdFx0XHR0aGlzLnJlZnJlc2hNb2RlbHMocmVzb2x2ZWRTZXR0aW5nc1Jvb3QpO1xuXG5cdFx0XHRpZiAoc2NoZW1hQ2hhbmdlICYmIHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwpIHtcblx0XHRcdFx0Ly8gSWYgYW4gZXh0ZW5zaW9uJ3Mgc2V0dGluZ3Mgd2VyZSBqdXN0IGxvYWRlZCBhbmQgYSBzZWFyY2ggaXMgYWN0aXZlLCByZXRyaWdnZXIgdGhlIHNlYXJjaCBzbyBpdCBzaG93cyB1cFxuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5vblNlYXJjaElucHV0Q2hhbmdlZCgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlZnJlc2hUT0NUcmVlKCk7XG5cdFx0XHR0aGlzLnJlbmRlclRyZWUodW5kZWZpbmVkLCBmb3JjZVJlZnJlc2gpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzVHJlZU1vZGVsLnZhbHVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc1RyZWVNb2RlbCwgdGhpcy52aWV3U3RhdGUsIHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSk7XG5cdFx0XHR0aGlzLnJlZnJlc2hNb2RlbHMocmVzb2x2ZWRTZXR0aW5nc1Jvb3QpO1xuXG5cdFx0XHQvLyBEb24ndCByZXN0b3JlIHRoZSBjYWNoZWQgc3RhdGUgaWYgd2UgYWxyZWFkeSBoYXZlIGEgcXVlcnkgdmFsdWUgZnJvbSBjYWxsaW5nIF9zZXRPcHRpb25zKCkuXG5cdFx0XHRjb25zdCBjYWNoZWRTdGF0ZSA9ICF0aGlzLnZpZXdTdGF0ZS5xdWVyeSA/IHRoaXMucmVzdG9yZUNhY2hlZFN0YXRlKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoY2FjaGVkU3RhdGU/LnNlYXJjaFF1ZXJ5IHx8IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vblNlYXJjaElucHV0Q2hhbmdlZCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoVE9DVHJlZSgpO1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hUcmVlKCk7XG5cdFx0XHRcdHRoaXMudG9jVHJlZS5jb2xsYXBzZUFsbCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRWxlbWVudHNCeUtleShrZXlzOiBSZWFkb25seVNldDxzdHJpbmc+KTogdm9pZCB7XG5cdFx0aWYgKGtleXMuc2l6ZSkge1xuXHRcdFx0aWYgKHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwpIHtcblx0XHRcdFx0a2V5cy5mb3JFYWNoKGtleSA9PiB0aGlzLnNlYXJjaFJlc3VsdE1vZGVsIS51cGRhdGVFbGVtZW50c0J5TmFtZShrZXkpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3NUcmVlTW9kZWwudmFsdWUpIHtcblx0XHRcdFx0a2V5cy5mb3JFYWNoKGtleSA9PiB0aGlzLnNldHRpbmdzVHJlZU1vZGVsLnZhbHVlIS51cGRhdGVFbGVtZW50c0J5TmFtZShrZXkpKTtcblx0XHRcdH1cblxuXHRcdFx0a2V5cy5mb3JFYWNoKGtleSA9PiB0aGlzLnJlbmRlclRyZWUoa2V5KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVuZGVyVHJlZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aXZlQ29udHJvbEluU2V0dGluZ3NUcmVlKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuc2V0dGluZ3NUcmVlLmdldEhUTUxFbGVtZW50KCk7XG5cdFx0Y29uc3QgYWN0aXZlRWxlbWVudCA9IGVsZW1lbnQub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJldHVybiAoYWN0aXZlRWxlbWVudCAmJiBET00uaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudChlbGVtZW50KSkgP1xuXHRcdFx0PEhUTUxFbGVtZW50PmFjdGl2ZUVsZW1lbnQgOlxuXHRcdFx0bnVsbDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVHJlZShrZXk/OiBzdHJpbmcsIGZvcmNlID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoIWZvcmNlICYmIGtleSAmJiB0aGlzLnNjaGVkdWxlZFJlZnJlc2hlcy5oYXMoa2V5KSkge1xuXHRcdFx0dGhpcy51cGRhdGVNb2RpZmllZExhYmVsRm9yS2V5KGtleSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGNvbnRleHQgdmlldyBpcyBmb2N1c2VkLCBkZWxheSByZW5kZXJpbmcgc2V0dGluZ3Ncblx0XHRpZiAodGhpcy5jb250ZXh0Vmlld0ZvY3VzZWQoKSkge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMud2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZXh0LXZpZXcnKTtcblx0XHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVSZWZyZXNoKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQsIGtleSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSWYgYSBzZXR0aW5nIGNvbnRyb2wgaXMgY3VycmVudGx5IGZvY3VzZWQsIHNjaGVkdWxlIGEgcmVmcmVzaCBmb3IgbGF0ZXJcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gdGhpcy5nZXRBY3RpdmVDb250cm9sSW5TZXR0aW5nc1RyZWUoKTtcblx0XHRjb25zdCBmb2N1c2VkU2V0dGluZyA9IGFjdGl2ZUVsZW1lbnQgJiYgdGhpcy5zZXR0aW5nUmVuZGVyZXJzLmdldFNldHRpbmdET01FbGVtZW50Rm9yRE9NRWxlbWVudChhY3RpdmVFbGVtZW50KTtcblx0XHRpZiAoZm9jdXNlZFNldHRpbmcgJiYgIWZvcmNlKSB7XG5cdFx0XHQvLyBJZiBhIHNpbmdsZSBzZXR0aW5nIGlzIGJlaW5nIHJlZnJlc2hlZCwgaXQncyBvayB0byByZWZyZXNoIG5vdyBpZiB0aGF0IGlzIG5vdCB0aGUgZm9jdXNlZCBzZXR0aW5nXG5cdFx0XHRpZiAoa2V5KSB7XG5cdFx0XHRcdGNvbnN0IGZvY3VzZWRLZXkgPSBmb2N1c2VkU2V0dGluZy5nZXRBdHRyaWJ1dGUoQWJzdHJhY3RTZXR0aW5nUmVuZGVyZXIuU0VUVElOR19LRVlfQVRUUik7XG5cdFx0XHRcdGlmIChmb2N1c2VkS2V5ID09PSBrZXkgJiZcblx0XHRcdFx0XHQvLyB1cGRhdGUgYGxpc3RgcyBsaXZlLCBhcyB0aGV5IGhhdmUgYSBzZXBhcmF0ZSBcInN1Ym1pdCBlZGl0XCIgc3RlcCBidWlsdCBpbiBiZWZvcmUgdGhpc1xuXHRcdFx0XHRcdChmb2N1c2VkU2V0dGluZy5wYXJlbnRFbGVtZW50ICYmICFmb2N1c2VkU2V0dGluZy5wYXJlbnRFbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnc2V0dGluZy1pdGVtLWxpc3QnKSlcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVNb2RpZmllZExhYmVsRm9yS2V5KGtleSk7XG5cdFx0XHRcdFx0dGhpcy5zY2hlZHVsZVJlZnJlc2goZm9jdXNlZFNldHRpbmcsIGtleSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlUmVmcmVzaChmb2N1c2VkU2V0dGluZyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlclJlc3VsdENvdW50TWVzc2FnZXMoKTtcblxuXHRcdGlmIChrZXkpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnRzID0gdGhpcy5jdXJyZW50U2V0dGluZ3NNb2RlbD8uZ2V0RWxlbWVudHNCeU5hbWUoa2V5KTtcblx0XHRcdGlmIChlbGVtZW50cz8ubGVuZ3RoKSB7XG5cdFx0XHRcdGlmIChlbGVtZW50cy5sZW5ndGggPj0gMikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignTW9yZSB0aGFuIG9uZSBzZXR0aW5nIHdpdGgga2V5ICcgKyBrZXkgKyAnIGZvdW5kJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5yZWZyZXNoU2luZ2xlRWxlbWVudChlbGVtZW50c1swXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBSZWZyZXNoIHJlcXVlc3RlZCBmb3IgYSBrZXkgdGhhdCB3ZSBkb24ndCBrbm93IGFib3V0XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZWZyZXNoVHJlZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fVxuXG5cdHByaXZhdGUgY29udGV4dFZpZXdGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIURPTS5maW5kUGFyZW50V2l0aENsYXNzKDxIVE1MRWxlbWVudD50aGlzLnJvb3RFbGVtZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCwgJ2NvbnRleHQtdmlldycpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoU2luZ2xlRWxlbWVudChlbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRpZiAoIWVsZW1lbnQuc2V0dGluZy5kZXByZWNhdGlvbk1lc3NhZ2UgfHwgZWxlbWVudC5pc0NvbmZpZ3VyZWQpIHtcblx0XHRcdFx0dGhpcy5zZXR0aW5nc1RyZWUucmVyZW5kZXIoZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoVHJlZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSAmJiB0aGlzLmN1cnJlbnRTZXR0aW5nc01vZGVsKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzVHJlZS5zZXRDaGlsZHJlbihudWxsLCBjcmVhdGVHcm91cEl0ZXJhdG9yKHRoaXMuY3VycmVudFNldHRpbmdzTW9kZWwucm9vdCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaFRPQ1RyZWUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdHRoaXMudG9jVHJlZU1vZGVsLnVwZGF0ZSgpO1xuXHRcdFx0dGhpcy50b2NUcmVlLnNldENoaWxkcmVuKG51bGwsIGNyZWF0ZVRPQ0l0ZXJhdG9yKHRoaXMudG9jVHJlZU1vZGVsLCB0aGlzLnRvY1RyZWUpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1vZGlmaWVkTGFiZWxGb3JLZXkoa2V5OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY3VycmVudFNldHRpbmdzTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGF0YUVsZW1lbnRzID0gdGhpcy5jdXJyZW50U2V0dGluZ3NNb2RlbC5nZXRFbGVtZW50c0J5TmFtZShrZXkpO1xuXHRcdGNvbnN0IGlzTW9kaWZpZWQgPSBkYXRhRWxlbWVudHMgJiYgZGF0YUVsZW1lbnRzWzBdICYmIGRhdGFFbGVtZW50c1swXS5pc0NvbmZpZ3VyZWQ7IC8vIGFsbCBlbGVtZW50cyBhcmUgZWl0aGVyIGNvbmZpZ3VyZWQgb3Igbm90XG5cdFx0Y29uc3QgZWxlbWVudHMgPSB0aGlzLnNldHRpbmdSZW5kZXJlcnMuZ2V0RE9NRWxlbWVudHNGb3JTZXR0aW5nS2V5KHRoaXMuc2V0dGluZ3NUcmVlLmdldEhUTUxFbGVtZW50KCksIGtleSk7XG5cdFx0aWYgKGVsZW1lbnRzICYmIGVsZW1lbnRzWzBdKSB7XG5cdFx0XHRlbGVtZW50c1swXS5jbGFzc0xpc3QudG9nZ2xlKCdpcy1jb25maWd1cmVkJywgISFpc01vZGlmaWVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uU2VhcmNoSW5wdXRDaGFuZ2VkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5jdXJyZW50U2V0dGluZ3NNb2RlbCkge1xuXHRcdFx0Ly8gSW5pdGlhbGl6aW5nIHNlYXJjaCB3aWRnZXQgdmFsdWVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBxdWVyeSA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkudHJpbSgpO1xuXHRcdHRoaXMudmlld1N0YXRlLnF1ZXJ5ID0gcXVlcnk7XG5cdFx0YXdhaXQgdGhpcy50cmlnZ2VyU2VhcmNoKHF1ZXJ5LnJlcGxhY2UoL1xcdTIwM0EvZywgJyAnKSk7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlU2V0dGluZ0Zyb21KU09OKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBtYXRjaCA9IHF1ZXJ5Lm1hdGNoKC9cIihbYS16QS1aLl0rKVwiOiAvKTtcblx0XHRyZXR1cm4gbWF0Y2ggJiYgbWF0Y2hbMV07XG5cdH1cblxuXHQvKipcblx0ICogVG9nZ2xlcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgU2V0dGluZ3MgZWRpdG9yIHRhYmxlIG9mIGNvbnRlbnRzIGR1cmluZyBhIHNlYXJjaFxuXHQgKiBkZXBlbmRpbmcgb24gdGhlIGJlaGF2aW9yLlxuXHQgKi9cblx0cHJpdmF0ZSB0b2dnbGVUb2NCeVNlYXJjaEJlaGF2aW9yVHlwZSgpIHtcblx0XHRjb25zdCB0b2NCZWhhdmlvciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2ZpbHRlcicgfCAnaGlkZSc+KFNFQVJDSF9UT0NfQkVIQVZJT1JfS0VZKTtcblx0XHRjb25zdCBoaWRlVG9jID0gdG9jQmVoYXZpb3IgPT09ICdoaWRlJztcblx0XHRpZiAoaGlkZVRvYykge1xuXHRcdFx0dGhpcy5zcGxpdFZpZXcuc2V0Vmlld1Zpc2libGUoMCwgZmFsc2UpO1xuXHRcdFx0dGhpcy5zcGxpdFZpZXcuc3R5bGUoe1xuXHRcdFx0XHRzZXBhcmF0b3JCb3JkZXI6IENvbG9yLnRyYW5zcGFyZW50XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sYXlvdXRTcGxpdFZpZXcodGhpcy5kaW1lbnNpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJpZ2dlclNlYXJjaChxdWVyeTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvZ3Jlc3NSdW5uZXIgPSB0aGlzLmVkaXRvclByb2dyZXNzU2VydmljZS5zaG93KHRydWUsIDgwMCk7XG5cdFx0dGhpcy52aWV3U3RhdGUudGFnRmlsdGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMudmlld1N0YXRlLmV4dGVuc2lvbkZpbHRlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLnZpZXdTdGF0ZS5mZWF0dXJlRmlsdGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMudmlld1N0YXRlLmlkRmlsdGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMudmlld1N0YXRlLmxhbmd1YWdlRmlsdGVyID0gdW5kZWZpbmVkO1xuXHRcdGlmIChxdWVyeSkge1xuXHRcdFx0Y29uc3QgcGFyc2VkUXVlcnkgPSBwYXJzZVF1ZXJ5KHF1ZXJ5KTtcblx0XHRcdHF1ZXJ5ID0gcGFyc2VkUXVlcnkucXVlcnk7XG5cdFx0XHRwYXJzZWRRdWVyeS50YWdzLmZvckVhY2godGFnID0+IHRoaXMudmlld1N0YXRlLnRhZ0ZpbHRlcnMhLmFkZCh0YWcpKTtcblx0XHRcdHBhcnNlZFF1ZXJ5LmV4dGVuc2lvbkZpbHRlcnMuZm9yRWFjaChleHRlbnNpb25JZCA9PiB0aGlzLnZpZXdTdGF0ZS5leHRlbnNpb25GaWx0ZXJzIS5hZGQoZXh0ZW5zaW9uSWQpKTtcblx0XHRcdHBhcnNlZFF1ZXJ5LmZlYXR1cmVGaWx0ZXJzLmZvckVhY2goZmVhdHVyZSA9PiB0aGlzLnZpZXdTdGF0ZS5mZWF0dXJlRmlsdGVycyEuYWRkKGZlYXR1cmUpKTtcblx0XHRcdHBhcnNlZFF1ZXJ5LmlkRmlsdGVycy5mb3JFYWNoKGlkID0+IHRoaXMudmlld1N0YXRlLmlkRmlsdGVycyEuYWRkKGlkKSk7XG5cdFx0XHR0aGlzLnZpZXdTdGF0ZS5sYW5ndWFnZUZpbHRlciA9IHBhcnNlZFF1ZXJ5Lmxhbmd1YWdlRmlsdGVyO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0dGluZ3NUYXJnZXRzV2lkZ2V0LnVwZGF0ZUxhbmd1YWdlRmlsdGVySW5kaWNhdG9ycyh0aGlzLnZpZXdTdGF0ZS5sYW5ndWFnZUZpbHRlcik7XG5cblx0XHRpZiAocXVlcnkgJiYgcXVlcnkgIT09ICdAJykge1xuXHRcdFx0cXVlcnkgPSB0aGlzLnBhcnNlU2V0dGluZ0Zyb21KU09OKHF1ZXJ5KSB8fCBxdWVyeTtcblx0XHRcdGF3YWl0IHRoaXMudHJpZ2dlckZpbHRlclByZWZlcmVuY2VzKHF1ZXJ5KTtcblx0XHRcdHRoaXMudG9nZ2xlVG9jQnlTZWFyY2hCZWhhdmlvclR5cGUoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMudmlld1N0YXRlLnRhZ0ZpbHRlcnMuc2l6ZSB8fCB0aGlzLnZpZXdTdGF0ZS5leHRlbnNpb25GaWx0ZXJzLnNpemUgfHwgdGhpcy52aWV3U3RhdGUuZmVhdHVyZUZpbHRlcnMuc2l6ZSB8fCB0aGlzLnZpZXdTdGF0ZS5pZEZpbHRlcnMuc2l6ZSB8fCB0aGlzLnZpZXdTdGF0ZS5sYW5ndWFnZUZpbHRlcikge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdE1vZGVsID0gdGhpcy5jcmVhdGVGaWx0ZXJNb2RlbCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hSZXN1bHRNb2RlbCA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2VhcmNoRGVsYXllci5jYW5jZWwoKTtcblx0XHRcdGlmICh0aGlzLnNlYXJjaEluUHJvZ3Jlc3MpIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hJblByb2dyZXNzLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHRcdHRoaXMuc2VhcmNoSW5Qcm9ncmVzcyA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudG9jVHJlZS5zZXRGb2N1cyhbXSk7XG5cdFx0XHR0aGlzLnZpZXdTdGF0ZS5maWx0ZXJUb0NhdGVnb3J5ID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy50b2NUcmVlTW9kZWwuY3VycmVudFNlYXJjaE1vZGVsID0gdGhpcy5zZWFyY2hSZXN1bHRNb2RlbDtcblxuXHRcdFx0aWYgKHRoaXMuc2VhcmNoUmVzdWx0TW9kZWwpIHtcblx0XHRcdFx0Ly8gQWRkZWQgYSBmaWx0ZXIgbW9kZWxcblx0XHRcdFx0dGhpcy50b2NUcmVlLnNldFNlbGVjdGlvbihbXSk7XG5cdFx0XHRcdHRoaXMudG9jVHJlZS5leHBhbmRBbGwoKTtcblx0XHRcdFx0dGhpcy5yZWZyZXNoVE9DVHJlZSgpO1xuXHRcdFx0XHR0aGlzLnJlbmRlclJlc3VsdENvdW50TWVzc2FnZXMoKTtcblx0XHRcdFx0dGhpcy5yZWZyZXNoVHJlZSgpO1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVRvY0J5U2VhcmNoQmVoYXZpb3JUeXBlKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCF0aGlzLnRvY1RyZWVEaXNwb3NlZCkge1xuXHRcdFx0XHQvLyBMZWF2aW5nIHNlYXJjaCBtb2RlXG5cdFx0XHRcdHRoaXMudG9jVHJlZS5jb2xsYXBzZUFsbCgpO1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hUT0NUcmVlKCk7XG5cdFx0XHRcdHRoaXMucmVuZGVyUmVzdWx0Q291bnRNZXNzYWdlcygpO1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hUcmVlKCk7XG5cdFx0XHRcdHRoaXMubGF5b3V0U3BsaXRWaWV3KHRoaXMuZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cHJvZ3Jlc3NSdW5uZXIuZG9uZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIGZha2UgU2VhcmNoUmVzdWx0TW9kZWwgd2hpY2ggY2FuIGhvbGQgYSBmbGF0IGxpc3Qgb2YgYWxsIHNldHRpbmdzLCB0byBiZSBmaWx0ZXJlZCAoQG1vZGlmaWVkIGV0Yylcblx0ICovXG5cdHByaXZhdGUgY3JlYXRlRmlsdGVyTW9kZWwoKTogU2VhcmNoUmVzdWx0TW9kZWwge1xuXHRcdGNvbnN0IGZpbHRlck1vZGVsID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hSZXN1bHRNb2RlbCwgdGhpcy52aWV3U3RhdGUsIHRoaXMuc2V0dGluZ3NPcmRlckJ5VG9jSW5kZXgsIHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSk7XG5cblx0XHRjb25zdCBmdWxsUmVzdWx0OiBJU2VhcmNoUmVzdWx0ID0ge1xuXHRcdFx0ZmlsdGVyTWF0Y2hlczogW10sXG5cdFx0XHRleGFjdE1hdGNoOiBmYWxzZSxcblx0XHR9O1xuXHRcdGZvciAoY29uc3QgZyBvZiB0aGlzLmRlZmF1bHRTZXR0aW5nc0VkaXRvck1vZGVsLnNldHRpbmdzR3JvdXBzLnNsaWNlKDEpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHNlY3Qgb2YgZy5zZWN0aW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2VjdC5zZXR0aW5ncykge1xuXHRcdFx0XHRcdGZ1bGxSZXN1bHQuZmlsdGVyTWF0Y2hlcy5wdXNoKHsgc2V0dGluZywgbWF0Y2hlczogW10sIG1hdGNoVHlwZTogU2V0dGluZ01hdGNoVHlwZS5Ob25lLCBrZXlNYXRjaFNjb3JlOiAwLCBzY29yZTogMCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZpbHRlck1vZGVsLnNldFJlc3VsdCgwLCBmdWxsUmVzdWx0KTtcblx0XHRyZXR1cm4gZmlsdGVyTW9kZWw7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRyaWdnZXJGaWx0ZXJQcmVmZXJlbmNlcyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuc2VhcmNoSW5Qcm9ncmVzcykge1xuXHRcdFx0dGhpcy5zZWFyY2hJblByb2dyZXNzLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHR0aGlzLnNlYXJjaEluUHJvZ3Jlc3MgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8vIFRyaWdnZXIgdGhlIGxvY2FsIHNlYXJjaC4gSWYgaXQgZGlkbid0IGZpbmQgYW4gZXhhY3QgbWF0Y2gsIHRyaWdnZXIgdGhlIHJlbW90ZSBzZWFyY2guXG5cdFx0Y29uc3Qgc2VhcmNoSW5Qcm9ncmVzcyA9IHRoaXMuc2VhcmNoSW5Qcm9ncmVzcyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHJldHVybiB0aGlzLnNlYXJjaERlbGF5ZXIudHJpZ2dlcihhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoc2VhcmNoSW5Qcm9ncmVzcy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBsb2NhbFJlc3VsdHMgPSBhd2FpdCB0aGlzLmxvY2FsRmlsdGVyUHJlZmVyZW5jZXMocXVlcnksIHNlYXJjaEluUHJvZ3Jlc3MudG9rZW4pO1xuXHRcdFx0aWYgKGxvY2FsUmVzdWx0cyAmJiAhbG9jYWxSZXN1bHRzLmV4YWN0TWF0Y2ggJiYgIXNlYXJjaEluUHJvZ3Jlc3MudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5yZW1vdGVTZWFyY2hQcmVmZXJlbmNlcyhxdWVyeSwgc2VhcmNoSW5Qcm9ncmVzcy50b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVwZGF0ZSBVSSBvbmx5IGFmdGVyIGFsbCB0aGUgc2VhcmNoIHJlc3VsdHMgYXJlIGluXG5cdFx0XHQvLyByZWYgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIyNDk0NlxuXHRcdFx0dGhpcy5vbkRpZEZpbmlzaFNlYXJjaCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEZpbmlzaFNlYXJjaCgpIHtcblx0XHR0aGlzLnRvY1RyZWVNb2RlbC5jdXJyZW50U2VhcmNoTW9kZWwgPSB0aGlzLnNlYXJjaFJlc3VsdE1vZGVsO1xuXHRcdHRoaXMudG9jVHJlZU1vZGVsLnVwZGF0ZSgpO1xuXHRcdHRoaXMudG9jVHJlZS5zZXRGb2N1cyhbXSk7XG5cdFx0dGhpcy52aWV3U3RhdGUuZmlsdGVyVG9DYXRlZ29yeSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLnRvY1RyZWUuZXhwYW5kQWxsKCk7XG5cdFx0dGhpcy5zZXR0aW5nc1RyZWUuc2Nyb2xsVG9wID0gMDtcblx0XHR0aGlzLnJlZnJlc2hUT0NUcmVlKCk7XG5cdFx0dGhpcy5yZW5kZXJUcmVlKHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGxvY2FsRmlsdGVyUHJlZmVyZW5jZXMocXVlcnk6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0IHwgbnVsbD4ge1xuXHRcdGNvbnN0IGxvY2FsU2VhcmNoUHJvdmlkZXIgPSB0aGlzLnByZWZlcmVuY2VzU2VhcmNoU2VydmljZS5nZXRMb2NhbFNlYXJjaFByb3ZpZGVyKHF1ZXJ5KTtcblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hXaXRoUHJvdmlkZXIoU2VhcmNoUmVzdWx0SWR4LkxvY2FsLCBsb2NhbFNlYXJjaFByb3ZpZGVyLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIHJlbW90ZVNlYXJjaFByZWZlcmVuY2VzKHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaFJlc3VsdCB8IG51bGw+IHtcblx0XHRjb25zdCByZW1vdGVTZWFyY2hQcm92aWRlciA9IHRoaXMucHJlZmVyZW5jZXNTZWFyY2hTZXJ2aWNlLmdldFJlbW90ZVNlYXJjaFByb3ZpZGVyKHF1ZXJ5KTtcblx0XHRpZiAoIXJlbW90ZVNlYXJjaFByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hXaXRoUHJvdmlkZXIoU2VhcmNoUmVzdWx0SWR4LlJlbW90ZSwgcmVtb3RlU2VhcmNoUHJvdmlkZXIsIHRva2VuKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VhcmNoV2l0aFByb3ZpZGVyKHR5cGU6IFNlYXJjaFJlc3VsdElkeCwgc2VhcmNoUHJvdmlkZXI6IElTZWFyY2hQcm92aWRlciwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0IHwgbnVsbD4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3NlYXJjaFByZWZlcmVuY2VzTW9kZWwodGhpcy5kZWZhdWx0U2V0dGluZ3NFZGl0b3JNb2RlbCwgc2VhcmNoUHJvdmlkZXIsIHRva2VuKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdC8vIEhhbmRsZSBjYW5jZWxsYXRpb24gbGlrZSB0aGlzIGJlY2F1c2UgY2FuY2VsbGF0aW9uIGlzIGxvc3QgaW5zaWRlIHRoZSBzZWFyY2ggcHJvdmlkZXIgZHVlIHRvIGFzeW5jL2F3YWl0XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRNb2RlbCA/Pz0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hSZXN1bHRNb2RlbCwgdGhpcy52aWV3U3RhdGUsIHRoaXMuc2V0dGluZ3NPcmRlckJ5VG9jSW5kZXgsIHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSk7XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRNb2RlbC5zZXRSZXN1bHQodHlwZSwgcmVzdWx0KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXN1bHRDb3VudE1lc3NhZ2VzKCkge1xuXHRcdGlmICghdGhpcy5jdXJyZW50U2V0dGluZ3NNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY2xlYXJGaWx0ZXJMaW5rQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSB0aGlzLnZpZXdTdGF0ZS50YWdGaWx0ZXJzICYmIHRoaXMudmlld1N0YXRlLnRhZ0ZpbHRlcnMuc2l6ZSA+IDBcblx0XHRcdD8gJ2luaXRpYWwnXG5cdFx0XHQ6ICdub25lJztcblxuXHRcdGlmICghdGhpcy5zZWFyY2hSZXN1bHRNb2RlbCkge1xuXHRcdFx0aWYgKHRoaXMuY291bnRFbGVtZW50LnN0eWxlLmRpc3BsYXkgIT09ICdub25lJykge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdExhYmVsID0gbnVsbDtcblx0XHRcdFx0dGhpcy51cGRhdGVJbnB1dEFyaWFMYWJlbCgpO1xuXHRcdFx0XHR0aGlzLmNvdW50RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHR0aGlzLmNvdW50RWxlbWVudC5pbm5lclRleHQgPSAnJztcblx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5kaW1lbnNpb24pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJvb3RFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ25vLXJlc3VsdHMnKTtcblx0XHRcdHRoaXMuc3BsaXRWaWV3LmVsLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGNvdW50ID0gdGhpcy5zZWFyY2hSZXN1bHRNb2RlbC5nZXRVbmlxdWVSZXN1bHRzQ291bnQoKTtcblx0XHRcdGxldCByZXN1bHRTdHJpbmc6IHN0cmluZztcblx0XHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdFx0Y2FzZSAwOiByZXN1bHRTdHJpbmcgPSBsb2NhbGl6ZSgnbm9SZXN1bHRzJywgXCJObyBTZXR0aW5ncyBGb3VuZFwiKTsgYnJlYWs7XG5cdFx0XHRcdGNhc2UgMTogcmVzdWx0U3RyaW5nID0gbG9jYWxpemUoJ29uZVJlc3VsdCcsIFwiMSBTZXR0aW5nIEZvdW5kXCIpOyBicmVhaztcblx0XHRcdFx0ZGVmYXVsdDogcmVzdWx0U3RyaW5nID0gbG9jYWxpemUoJ21vcmVUaGFuT25lUmVzdWx0JywgXCJ7MH0gU2V0dGluZ3MgRm91bmRcIiwgY291bnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNlYXJjaFJlc3VsdExhYmVsID0gcmVzdWx0U3RyaW5nO1xuXHRcdFx0dGhpcy51cGRhdGVJbnB1dEFyaWFMYWJlbCgpO1xuXHRcdFx0dGhpcy5jb3VudEVsZW1lbnQuaW5uZXJUZXh0ID0gcmVzdWx0U3RyaW5nO1xuXHRcdFx0YXJpYS5zdGF0dXMocmVzdWx0U3RyaW5nKTtcblxuXHRcdFx0aWYgKHRoaXMuY291bnRFbGVtZW50LnN0eWxlLmRpc3BsYXkgIT09ICdibG9jaycpIHtcblx0XHRcdFx0dGhpcy5jb3VudEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucm9vdEVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbm8tcmVzdWx0cycsIGNvdW50ID09PSAwKTtcblx0XHRcdHRoaXMuc3BsaXRWaWV3LmVsLnN0eWxlLnZpc2liaWxpdHkgPSBjb3VudCA9PT0gMCA/ICdoaWRkZW4nIDogJ3Zpc2libGUnO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NlYXJjaFByZWZlcmVuY2VzTW9kZWwobW9kZWw6IElTZXR0aW5nc0VkaXRvck1vZGVsLCBwcm92aWRlcjogSVNlYXJjaFByb3ZpZGVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hSZXN1bHQgfCBudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBwcm92aWRlci5zZWFyY2hNb2RlbChtb2RlbCwgdG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0U3BsaXRWaWV3KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsaXN0SGVpZ2h0ID0gZGltZW5zaW9uLmhlaWdodCAtICg3MiArIDExICsgMTQgLyogaGVhZGVyIGhlaWdodCArIGVkaXRvciBwYWRkaW5nICovKTtcblxuXHRcdHRoaXMuc3BsaXRWaWV3LmVsLnN0eWxlLmhlaWdodCA9IGAke2xpc3RIZWlnaHR9cHhgO1xuXG5cdFx0Ly8gV2UgY2FsbCBsYXlvdXQgZmlyc3Qgc28gdGhlIHNwbGl0VmlldyBoYXMgYW4gaWRlYSBvZiBob3cgbXVjaFxuXHRcdC8vIHNwYWNlIGl0IGhhcywgb3RoZXJ3aXNlIHNldFZpZXdWaXNpYmxlIHJlc3VsdHMgaW4gdGhlIGZpcnN0IHBhbmVsXG5cdFx0Ly8gc2hvd2luZyB1cCBhdCB0aGUgbWluaW11bSBzaXplIHdoZW5ldmVyIHRoZSBTZXR0aW5ncyBlZGl0b3Jcblx0XHQvLyBvcGVucyBmb3IgdGhlIGZpcnN0IHRpbWUuXG5cdFx0dGhpcy5zcGxpdFZpZXcubGF5b3V0KHRoaXMuYm9keUNvbnRhaW5lci5jbGllbnRXaWR0aCwgbGlzdEhlaWdodCk7XG5cblx0XHRjb25zdCB0b2NCZWhhdmlvciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2ZpbHRlcicgfCAnaGlkZSc+KFNFQVJDSF9UT0NfQkVIQVZJT1JfS0VZKTtcblx0XHRjb25zdCBoaWRlVG9jRm9yU2VhcmNoID0gdG9jQmVoYXZpb3IgPT09ICdoaWRlJyAmJiB0aGlzLnNlYXJjaFJlc3VsdE1vZGVsO1xuXHRcdGlmICghaGlkZVRvY0ZvclNlYXJjaCkge1xuXHRcdFx0Y29uc3QgZmlyc3RWaWV3V2FzVmlzaWJsZSA9IHRoaXMuc3BsaXRWaWV3LmlzVmlld1Zpc2libGUoMCk7XG5cdFx0XHRjb25zdCBmaXJzdFZpZXdWaXNpYmxlID0gdGhpcy5ib2R5Q29udGFpbmVyLmNsaWVudFdpZHRoID49IFNldHRpbmdzRWRpdG9yMi5OQVJST1dfVE9UQUxfV0lEVEg7XG5cblx0XHRcdHRoaXMuc3BsaXRWaWV3LnNldFZpZXdWaXNpYmxlKDAsIGZpcnN0Vmlld1Zpc2libGUpO1xuXHRcdFx0Ly8gSWYgdGhlIGZpcnN0IHZpZXcgaXMgYWdhaW4gdmlzaWJsZSwgYW5kIHdlIGhhdmUgZW5vdWdoIHNwYWNlLCBpbW1lZGlhdGVseSBzZXQgdGhlXG5cdFx0XHQvLyBlZGl0b3IgdG8gdXNlIHRoZSByZXNldCB3aWR0aCByYXRoZXIgdGhhbiB0aGUgY2FjaGVkIG1pbiB3aWR0aFxuXHRcdFx0aWYgKCFmaXJzdFZpZXdXYXNWaXNpYmxlICYmIGZpcnN0Vmlld1Zpc2libGUgJiYgdGhpcy5ib2R5Q29udGFpbmVyLmNsaWVudFdpZHRoID49IFNldHRpbmdzRWRpdG9yMi5FRElUT1JfTUlOX1dJRFRIICsgU2V0dGluZ3NFZGl0b3IyLlRPQ19SRVNFVF9XSURUSCkge1xuXHRcdFx0XHR0aGlzLnNwbGl0Vmlldy5yZXNpemVWaWV3KDAsIFNldHRpbmdzRWRpdG9yMi5UT0NfUkVTRVRfV0lEVEgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zcGxpdFZpZXcuc3R5bGUoe1xuXHRcdFx0XHRzZXBhcmF0b3JCb3JkZXI6IGZpcnN0Vmlld1Zpc2libGUgPyB0aGlzLnRoZW1lLmdldENvbG9yKHNldHRpbmdzU2FzaEJvcmRlcikhIDogQ29sb3IudHJhbnNwYXJlbnRcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdGNvbnN0IHNlYXJjaFF1ZXJ5ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKS50cmltKCk7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLnNldHRpbmdzVGFyZ2V0c1dpZGdldC5zZXR0aW5nc1RhcmdldCBhcyBTZXR0aW5nc1RhcmdldDtcblx0XHRcdGlmICh0aGlzLmlucHV0KSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yTWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGhpcy5ncm91cCwgdGhpcy5pbnB1dCwgeyBzZWFyY2hRdWVyeSwgdGFyZ2V0IH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5pbnB1dCkge1xuXHRcdFx0dGhpcy5lZGl0b3JNZW1lbnRvLmNsZWFyRWRpdG9yU3RhdGUodGhpcy5pbnB1dCwgdGhpcy5ncm91cCk7XG5cdFx0fVxuXG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cbn1cblxuY2xhc3MgU3luY0NvbnRyb2xzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGFzdFN5bmNlZExhYmVsITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgdHVybk9uU3luY0J1dHRvbiE6IEJ1dHRvbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUxhc3RTeW5jZWRMYWJlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUxhc3RTeW5jZWRMYWJlbCA9IHRoaXMuX29uRGlkQ2hhbmdlTGFzdFN5bmNlZExhYmVsLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHdpbmRvdzogQ29kZVdpbmRvdyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZTogSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGhlYWRlclJpZ2h0Q29udHJvbHNDb250YWluZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmdzLXJpZ2h0LWNvbnRyb2xzJykpO1xuXHRcdGNvbnN0IHR1cm5PblN5bmNCdXR0b25Db250YWluZXIgPSBET00uYXBwZW5kKGhlYWRlclJpZ2h0Q29udHJvbHNDb250YWluZXIsICQoJy50dXJuLW9uLXN5bmMnKSk7XG5cdFx0dGhpcy50dXJuT25TeW5jQnV0dG9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJ1dHRvbih0dXJuT25TeW5jQnV0dG9uQ29udGFpbmVyLCB7IHRpdGxlOiB0cnVlLCAuLi5kZWZhdWx0QnV0dG9uU3R5bGVzIH0pKTtcblx0XHR0aGlzLmxhc3RTeW5jZWRMYWJlbCA9IERPTS5hcHBlbmQoaGVhZGVyUmlnaHRDb250cm9sc0NvbnRhaW5lciwgJCgnLmxhc3Qtc3luY2VkLWxhYmVsJykpO1xuXHRcdERPTS5oaWRlKHRoaXMubGFzdFN5bmNlZExhYmVsKTtcblxuXHRcdHRoaXMudHVybk9uU3luY0J1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLnR1cm5PblN5bmNCdXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgndHVybk9uU3luY0J1dHRvbicsIFwiQmFja3VwIGFuZCBTeW5jIFNldHRpbmdzXCIpO1xuXHRcdERPTS5oaWRlKHRoaXMudHVybk9uU3luY0J1dHRvbi5lbGVtZW50KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHVybk9uU3luY0J1dHRvbi5vbkRpZENsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC51c2VyRGF0YVN5bmMuYWN0aW9ucy50dXJuT24nKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnVwZGF0ZUxhc3RTeW5jZWRUaW1lKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLm9uRGlkQ2hhbmdlTGFzdFN5bmNUaW1lKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlTGFzdFN5bmNlZFRpbWUoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB1cGRhdGVMYXN0U3luY2VkVGltZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRE9NLldpbmRvd0ludGVydmFsVGltZXIoKSk7XG5cdFx0dXBkYXRlTGFzdFN5bmNlZFRpbWVyLmNhbmNlbEFuZFNldCgoKSA9PiB0aGlzLnVwZGF0ZUxhc3RTeW5jZWRUaW1lKCksIDYwICogMTAwMCwgd2luZG93KTtcblxuXHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLm9uRGlkQ2hhbmdlU3RhdHVzKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5vbkRpZENoYW5nZUVuYWJsZW1lbnQoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxhc3RTeW5jZWRUaW1lKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxhc3QgPSB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UubGFzdFN5bmNUaW1lO1xuXHRcdGxldCBsYWJlbDogc3RyaW5nO1xuXHRcdGlmICh0eXBlb2YgbGFzdCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IGQgPSBmcm9tTm93KGxhc3QsIHRydWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRsYWJlbCA9IGxvY2FsaXplKCdsYXN0U3luY2VkTGFiZWwnLCBcIkxhc3Qgc3luY2VkOiB7MH1cIiwgZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxhYmVsID0gJyc7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0U3luY2VkTGFiZWwudGV4dENvbnRlbnQgPSBsYWJlbDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUxhc3RTeW5jZWRMYWJlbC5maXJlKGxhYmVsKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uuc3RhdHVzID09PSBTeW5jU3RhdHVzLlVuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSB8fCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2Uuc3RhdHVzICE9PSBTeW5jU3RhdHVzLklkbGUpIHtcblx0XHRcdERPTS5zaG93KHRoaXMubGFzdFN5bmNlZExhYmVsKTtcblx0XHRcdERPTS5oaWRlKHRoaXMudHVybk9uU3luY0J1dHRvbi5lbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0RE9NLmhpZGUodGhpcy5sYXN0U3luY2VkTGFiZWwpO1xuXHRcdFx0RE9NLnNob3codGhpcy50dXJuT25TeW5jQnV0dG9uLmVsZW1lbnQpO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSVNldHRpbmdzRWRpdG9yMlN0YXRlIHtcblx0c2VhcmNoUXVlcnk6IHN0cmluZztcblx0dGFyZ2V0OiBTZXR0aW5nc1RhcmdldDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksVUFBVTtBQUN0QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGNBQWM7QUFFdkIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsU0FBUyxtQkFBbUI7QUFDckMsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLGlCQUFpQixTQUEyQix5QkFBeUI7QUFDMUYsWUFBWSxjQUFjO0FBQzFCLFNBQVMsV0FBVztBQUNwQixPQUFPO0FBQ1AsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywyQkFBMEQ7QUFDbkUsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZSxpQkFBaUIsaUJBQWlCLGdCQUFnQix3QkFBd0I7QUFDbEcsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQ0FBZ0Msc0JBQXNCLGtCQUFrQjtBQUNqRixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLDJCQUEyQjtBQUNwQyxTQUF5Qiw2QkFBNkI7QUFDdEQsU0FBb0IscUJBQXFCLGVBQWU7QUFDeEQsU0FBUyx5QkFBcUUsb0NBQW9DLG1DQUFtQyxx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aUJBQWlCLFdBQVcsWUFBWTtBQUMzRCxZQUFNLEtBQUssZUFBZSxlQUFlLHVDQUF1QztBQUFBLElBQ2pGLENBQUMsQ0FBQztBQUVGLFNBQUsscUJBQXFCO0FBQzFCLFNBQUssVUFBVSxLQUFLLG9CQUFvQix3QkFBd0IsTUFBTTtBQUNyRSxXQUFLLHFCQUFxQjtBQUFBLElBQzNCLENBQUMsQ0FBQztBQUVGLFVBQU0sd0JBQXdCLEtBQUssVUFBVSxJQUFJLElBQUksb0JBQW9CLENBQUM7QUFDMUUsMEJBQXNCLGFBQWEsTUFBTSxLQUFLLHFCQUFxQixHQUFHLEtBQUssS0FBTSxNQUFNO0FBRXZGLFNBQUssT0FBTztBQUNaLFNBQUssVUFBVSxLQUFLLG9CQUFvQixrQkFBa0IsTUFBTTtBQUMvRCxXQUFLLE9BQU87QUFBQSxJQUNiLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLDhCQUE4QixzQkFBc0IsTUFBTTtBQUM3RSxXQUFLLE9BQU87QUFBQSxJQUNiLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLHVCQUE2QjtBQUNwQyxVQUFNLE9BQU8sS0FBSyxvQkFBb0I7QUFDdEMsUUFBSTtBQUNKLFFBQUksT0FBTyxTQUFTLFVBQVU7QUFDN0IsWUFBTSxJQUFJLFFBQVEsTUFBTSxNQUFNLFFBQVcsSUFBSTtBQUM3QyxjQUFRLFNBQVMsbUJBQW1CLG9CQUFvQixDQUFDO0FBQUEsSUFDMUQsT0FBTztBQUNOLGNBQVE7QUFBQSxJQUNUO0FBRUEsU0FBSyxnQkFBZ0IsY0FBYztBQUNuQyxTQUFLLDRCQUE0QixLQUFLLEtBQUs7QUFBQSxFQUM1QztBQUFBLEVBRVEsU0FBZTtBQUN0QixRQUFJLEtBQUssb0JBQW9CLFdBQVcsV0FBVyxlQUFlO0FBQ2pFO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyw4QkFBOEIsVUFBVSxLQUFLLEtBQUssb0JBQW9CLFdBQVcsV0FBVyxNQUFNO0FBQzFHLFVBQUksS0FBSyxLQUFLLGVBQWU7QUFDN0IsVUFBSSxLQUFLLEtBQUssaUJBQWlCLE9BQU87QUFBQSxJQUN2QyxPQUFPO0FBQ04sVUFBSSxLQUFLLEtBQUssZUFBZTtBQUM3QixVQUFJLEtBQUssS0FBSyxpQkFBaUIsT0FBTztBQUFBLElBQ3ZDO0FBQUEsRUFDRDtBQUNEO0FBNUVNLGVBQU47QUFBQSxFQVVHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FiRzsiLAogICJuYW1lcyI6IFsiU2V0dGluZ3NGb2N1c0NvbnRleHQiLCAicmVzb2x2ZWRTZXR0aW5nc1Jvb3QiXQp9Cg==
