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
import "./media/keybindingsEditor.css";
import { localize } from "../../../../nls.js";
import { Delayer } from "../../../../base/common/async.js";
import * as DOM from "../../../../base/browser/dom.js";
import { isIOS, OS } from "../../../../base/common/platform.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { ToggleActionViewItem } from "../../../../base/browser/ui/toggle/toggle.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { KEYBINDING_ENTRY_TEMPLATE_ID } from "../../../services/preferences/browser/keybindingsEditorModel.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { DefineKeybindingWidget, KeybindingsSearchWidget } from "./keybindingWidgets.js";
import { CONTEXT_KEYBINDING_FOCUS, CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS, KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS, KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE, KEYBINDINGS_EDITOR_COMMAND_DEFINE, KEYBINDINGS_EDITOR_COMMAND_REMOVE, KEYBINDINGS_EDITOR_COMMAND_RESET, KEYBINDINGS_EDITOR_COMMAND_COPY, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND, KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN, KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR, KEYBINDINGS_EDITOR_COMMAND_ADD, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE, CONTEXT_WHEN_FOCUS } from "../common/preferences.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingEditingService } from "../../../services/keybinding/common/keybindingEditing.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { badgeBackground, contrastBorder, badgeForeground, listActiveSelectionForeground, listInactiveSelectionForeground, listHoverForeground, listFocusForeground, editorBackground, foreground, listActiveSelectionBackground, listInactiveSelectionBackground, listFocusBackground, listHoverBackground, registerColor, tableOddRowsBackgroundColor, asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MenuRegistry, MenuId, isIMenuItem } from "../../../../platform/actions/common/actions.js";
import { WORKBENCH_BACKGROUND } from "../../../common/theme.js";
import { keybindingsRecordKeysIcon, keybindingsSortIcon, keybindingsAddIcon, preferencesClearInputIcon, keybindingsEditIcon } from "./preferencesIcons.js";
import { ToolBar } from "../../../../base/browser/ui/toolbar/toolbar.js";
import { defaultKeybindingLabelStyles, defaultToggleStyles, getInputBoxStyle } from "../../../../platform/theme/browser/defaultStyles.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { isString } from "../../../../base/common/types.js";
import { SuggestEnabledInput } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { settingsTextInputBorder } from "../common/settingsEditorColorRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
const $ = DOM.$;
let KeybindingsEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, keybindingsService, contextMenuService, keybindingEditingService, contextKeyService, notificationService, clipboardService, instantiationService, editorService, storageService, configurationService, accessibilityService) {
    super(KeybindingsEditor.ID, group, telemetryService, themeService, storageService);
    this.keybindingsService = keybindingsService;
    this.contextMenuService = contextMenuService;
    this.keybindingEditingService = keybindingEditingService;
    this.contextKeyService = contextKeyService;
    this.notificationService = notificationService;
    this.clipboardService = clipboardService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this._onDefineWhenExpression = this._register(new Emitter());
    this.onDefineWhenExpression = this._onDefineWhenExpression.event;
    this._onRejectWhenExpression = this._register(new Emitter());
    this.onRejectWhenExpression = this._onRejectWhenExpression.event;
    this._onAcceptWhenExpression = this._register(new Emitter());
    this.onAcceptWhenExpression = this._onAcceptWhenExpression.event;
    this._onLayout = this._register(new Emitter());
    this.onLayout = this._onLayout.event;
    this.keybindingsEditorModel = null;
    this.unAssignedKeybindingItemToRevealAndFocus = null;
    this.tableEntries = [];
    this.dimension = null;
    this.latestEmptyFilters = [];
    this.delayedFiltering = new Delayer(300);
    this._register(keybindingsService.onDidUpdateKeybindings(() => this.render(!!this.keybindingFocusContextKey.get())));
    this.keybindingsEditorContextKey = CONTEXT_KEYBINDINGS_EDITOR.bindTo(this.contextKeyService);
    this.searchFocusContextKey = CONTEXT_KEYBINDINGS_SEARCH_FOCUS.bindTo(this.contextKeyService);
    this.keybindingFocusContextKey = CONTEXT_KEYBINDING_FOCUS.bindTo(this.contextKeyService);
    this.searchHistoryDelayer = new Delayer(500);
    this.recordKeysAction = new Action(KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS, localize("recordKeysLabel", "Record Keys"), ThemeIcon.asClassName(keybindingsRecordKeysIcon));
    this.recordKeysAction.checked = false;
    this.sortByPrecedenceAction = new Action(KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE, localize("sortByPrecedeneLabel", "Sort by Precedence (Highest first)"), ThemeIcon.asClassName(keybindingsSortIcon));
    this.sortByPrecedenceAction.checked = false;
    this.overflowWidgetsDomNode = $(".keybindings-overflow-widgets-container.monaco-editor");
  }
  create(parent) {
    super.create(parent);
    this._register(registerNavigableContainer({
      name: "keybindingsEditor",
      focusNotifiers: [this],
      focusNextWidget: () => {
        if (this.searchWidget.hasFocus()) {
          this.focusKeybindings();
        }
      },
      focusPreviousWidget: () => {
        if (!this.searchWidget.hasFocus()) {
          this.focusSearch();
        }
      }
    }));
  }
  createEditor(parent) {
    const keybindingsEditorElement = DOM.append(parent, $("div", { class: "keybindings-editor" }));
    this.createAriaLabelElement(keybindingsEditorElement);
    this.createOverlayContainer(keybindingsEditorElement);
    this.createHeader(keybindingsEditorElement);
    this.createBody(keybindingsEditorElement);
  }
  setInput(input, options, context, token) {
    this.keybindingsEditorContextKey.set(true);
    return super.setInput(input, options, context, token).then(() => this.render(!!(options && options.preserveFocus)));
  }
  clearInput() {
    super.clearInput();
    this.keybindingsEditorContextKey.reset();
    this.keybindingFocusContextKey.reset();
  }
  layout(dimension) {
    this.dimension = dimension;
    this.layoutSearchWidget(dimension);
    this.overlayContainer.style.width = dimension.width + "px";
    this.overlayContainer.style.height = dimension.height + "px";
    this.defineKeybindingWidget.layout(this.dimension);
    this.layoutKeybindingsTable();
    this._onLayout.fire();
  }
  focus() {
    super.focus();
    const activeKeybindingEntry = this.activeKeybindingEntry;
    if (activeKeybindingEntry) {
      this.selectEntry(activeKeybindingEntry);
    } else if (!isIOS) {
      this.searchWidget.focus();
    }
  }
  get activeKeybindingEntry() {
    const focusedElement = this.keybindingsTable.getFocusedElements()[0];
    return focusedElement && focusedElement.templateId === KEYBINDING_ENTRY_TEMPLATE_ID ? focusedElement : null;
  }
  async defineKeybinding(keybindingEntry, add) {
    this.selectEntry(keybindingEntry);
    this.showOverlayContainer();
    try {
      const key = await this.defineKeybindingWidget.define();
      if (key) {
        await this.updateKeybinding(keybindingEntry, key, keybindingEntry.keybindingItem.when, add);
      }
    } catch (error) {
      this.onKeybindingEditingError(error);
    } finally {
      this.hideOverlayContainer();
      this.selectEntry(keybindingEntry);
    }
  }
  defineWhenExpression(keybindingEntry) {
    if (keybindingEntry.keybindingItem.keybinding) {
      this.selectEntry(keybindingEntry);
      this._onDefineWhenExpression.fire(keybindingEntry);
    }
  }
  rejectWhenExpression(keybindingEntry) {
    this._onRejectWhenExpression.fire(keybindingEntry);
  }
  acceptWhenExpression(keybindingEntry) {
    this._onAcceptWhenExpression.fire(keybindingEntry);
  }
  async updateKeybinding(keybindingEntry, key, when, add) {
    const currentKey = keybindingEntry.keybindingItem.keybinding ? keybindingEntry.keybindingItem.keybinding.getUserSettingsLabel() : "";
    if (currentKey !== key || keybindingEntry.keybindingItem.when !== when) {
      if (add) {
        await this.keybindingEditingService.addKeybinding(keybindingEntry.keybindingItem.keybindingItem, key, when || void 0);
      } else {
        await this.keybindingEditingService.editKeybinding(keybindingEntry.keybindingItem.keybindingItem, key, when || void 0);
      }
      if (!keybindingEntry.keybindingItem.keybinding) {
        this.unAssignedKeybindingItemToRevealAndFocus = keybindingEntry;
      }
    }
  }
  async removeKeybinding(keybindingEntry) {
    this.selectEntry(keybindingEntry);
    if (keybindingEntry.keybindingItem.keybinding) {
      try {
        await this.keybindingEditingService.removeKeybinding(keybindingEntry.keybindingItem.keybindingItem);
        this.focus();
      } catch (error) {
        this.onKeybindingEditingError(error);
        this.selectEntry(keybindingEntry);
      }
    }
  }
  async resetKeybinding(keybindingEntry) {
    this.selectEntry(keybindingEntry);
    try {
      await this.keybindingEditingService.resetKeybinding(keybindingEntry.keybindingItem.keybindingItem);
      if (!keybindingEntry.keybindingItem.keybinding) {
        this.unAssignedKeybindingItemToRevealAndFocus = keybindingEntry;
      }
      this.selectEntry(keybindingEntry);
    } catch (error) {
      this.onKeybindingEditingError(error);
      this.selectEntry(keybindingEntry);
    }
  }
  async copyKeybinding(keybinding) {
    this.selectEntry(keybinding);
    const userFriendlyKeybinding = {
      key: keybinding.keybindingItem.keybinding ? keybinding.keybindingItem.keybinding.getUserSettingsLabel() || "" : "",
      command: keybinding.keybindingItem.command
    };
    if (keybinding.keybindingItem.when) {
      userFriendlyKeybinding.when = keybinding.keybindingItem.when;
    }
    await this.clipboardService.writeText(JSON.stringify(userFriendlyKeybinding, null, "  "));
  }
  async copyKeybindingCommand(keybinding) {
    this.selectEntry(keybinding);
    await this.clipboardService.writeText(keybinding.keybindingItem.command);
  }
  async copyKeybindingCommandTitle(keybinding) {
    this.selectEntry(keybinding);
    await this.clipboardService.writeText(keybinding.keybindingItem.commandLabel);
  }
  focusSearch() {
    this.searchWidget.focus();
  }
  search(filter) {
    this.focusSearch();
    this.searchWidget.setValue(filter);
    this.selectEntry(0);
  }
  clearSearchResults() {
    this.searchWidget.clear();
  }
  showSimilarKeybindings(keybindingEntry) {
    const value = `"${keybindingEntry.keybindingItem.keybinding.getAriaLabel()}"`;
    if (value !== this.searchWidget.getValue()) {
      this.searchWidget.setValue(value);
    }
  }
  createAriaLabelElement(parent) {
    this.ariaLabelElement = DOM.append(parent, DOM.$(""));
    this.ariaLabelElement.setAttribute("id", "keybindings-editor-aria-label-element");
    this.ariaLabelElement.setAttribute("aria-live", "assertive");
  }
  createOverlayContainer(parent) {
    this.overlayContainer = DOM.append(parent, $(".overlay-container"));
    this.overlayContainer.style.position = "absolute";
    this.overlayContainer.style.zIndex = "40";
    this.defineKeybindingWidget = this._register(this.instantiationService.createInstance(DefineKeybindingWidget, this.overlayContainer));
    this._register(this.defineKeybindingWidget.onDidChange((keybindingStr) => this.defineKeybindingWidget.printExisting(this.keybindingsEditorModel.fetch(`"${keybindingStr}"`).length)));
    this._register(this.defineKeybindingWidget.onShowExistingKeybidings((keybindingStr) => this.searchWidget.setValue(`"${keybindingStr}"`)));
    this.hideOverlayContainer();
  }
  showOverlayContainer() {
    this.overlayContainer.style.display = "block";
  }
  hideOverlayContainer() {
    this.overlayContainer.style.display = "none";
  }
  createHeader(parent) {
    this.headerContainer = DOM.append(parent, $(".keybindings-header"));
    const fullTextSearchPlaceholder = localize("SearchKeybindings.FullTextSearchPlaceholder", "Type to search in keybindings");
    const keybindingsSearchPlaceholder = localize("SearchKeybindings.KeybindingsSearchPlaceholder", "Recording Keys. Press Escape to exit");
    const clearInputAction = new Action(KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, localize("clearInput", "Clear Keybindings Search Input"), ThemeIcon.asClassName(preferencesClearInputIcon), false, async () => this.clearSearchResults());
    const searchContainer = DOM.append(this.headerContainer, $(".search-container"));
    this.searchWidget = this._register(this.instantiationService.createInstance(KeybindingsSearchWidget, searchContainer, {
      ariaLabel: fullTextSearchPlaceholder,
      placeholder: fullTextSearchPlaceholder,
      focusKey: this.searchFocusContextKey,
      ariaLabelledBy: "keybindings-editor-aria-label-element",
      recordEnter: true,
      quoteRecordedKeys: true,
      history: new Set(this.getMemento(StorageScope.PROFILE, StorageTarget.USER)["searchHistory"] ?? []),
      inputBoxStyles: getInputBoxStyle({
        inputBorder: settingsTextInputBorder
      })
    }));
    this._register(this.searchWidget.onDidChange((searchValue) => {
      clearInputAction.enabled = !!searchValue;
      this.delayedFiltering.trigger(() => this.filterKeybindings());
      this.updateSearchOptions();
    }));
    this._register(this.searchWidget.onEscape(() => this.recordKeysAction.checked = false));
    this.actionsContainer = DOM.append(searchContainer, DOM.$(".keybindings-search-actions-container"));
    const recordingBadge = this.createRecordingBadge(this.actionsContainer);
    this._register(this.sortByPrecedenceAction.onDidChange((e) => {
      if (e.checked !== void 0) {
        this.renderKeybindingsEntries(false);
      }
      this.updateSearchOptions();
    }));
    this._register(this.recordKeysAction.onDidChange((e) => {
      if (e.checked !== void 0) {
        recordingBadge.classList.toggle("disabled", !e.checked);
        if (e.checked) {
          this.searchWidget.inputBox.setPlaceHolder(keybindingsSearchPlaceholder);
          this.searchWidget.inputBox.setAriaLabel(keybindingsSearchPlaceholder);
          this.searchWidget.startRecordingKeys();
          this.searchWidget.focus();
        } else {
          this.searchWidget.inputBox.setPlaceHolder(fullTextSearchPlaceholder);
          this.searchWidget.inputBox.setAriaLabel(fullTextSearchPlaceholder);
          this.searchWidget.stopRecordingKeys();
          this.searchWidget.focus();
        }
        this.updateSearchOptions();
      }
    }));
    const actions = [this.recordKeysAction, this.sortByPrecedenceAction, clearInputAction];
    const toolBar = this._register(new ToolBar(this.actionsContainer, this.contextMenuService, {
      actionViewItemProvider: (action, options) => {
        if (action.id === this.sortByPrecedenceAction.id || action.id === this.recordKeysAction.id) {
          return new ToggleActionViewItem(null, action, { ...options, keybinding: this.keybindingsService.lookupKeybinding(action.id)?.getLabel(), toggleStyles: defaultToggleStyles });
        }
        return void 0;
      },
      getKeyBinding: (action) => this.keybindingsService.lookupKeybinding(action.id)
    }));
    toolBar.setActions(actions);
    this._register(this.keybindingsService.onDidUpdateKeybindings(() => toolBar.setActions(actions)));
  }
  updateSearchOptions() {
    const keybindingsEditorInput = this.input;
    if (keybindingsEditorInput) {
      keybindingsEditorInput.searchOptions = {
        searchValue: this.searchWidget.getValue(),
        recordKeybindings: !!this.recordKeysAction.checked,
        sortByPrecedence: !!this.sortByPrecedenceAction.checked
      };
    }
  }
  createRecordingBadge(container) {
    const recordingBadge = DOM.append(container, DOM.$(".recording-badge.monaco-count-badge.long.disabled"));
    recordingBadge.textContent = localize("recording", "Recording Keys");
    recordingBadge.style.backgroundColor = asCssVariable(badgeBackground);
    recordingBadge.style.color = asCssVariable(badgeForeground);
    recordingBadge.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    return recordingBadge;
  }
  layoutSearchWidget(dimension) {
    this.searchWidget.layout(dimension);
    this.headerContainer.classList.toggle("small", dimension.width < 400);
    this.searchWidget.inputBox.inputElement.style.paddingRight = `${DOM.getTotalWidth(this.actionsContainer) + 12}px`;
  }
  createBody(parent) {
    const bodyContainer = DOM.append(parent, $(".keybindings-body"));
    this.createTable(bodyContainer);
  }
  createTable(parent) {
    this.keybindingsTableContainer = DOM.append(parent, $(".keybindings-table-container"));
    this.keybindingsTable = this._register(this.instantiationService.createInstance(
      WorkbenchTable,
      "KeybindingsEditor",
      this.keybindingsTableContainer,
      new Delegate(),
      [
        {
          label: "",
          tooltip: "",
          weight: 0,
          minimumWidth: 40,
          maximumWidth: 40,
          templateId: ActionsColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("command", "Command"),
          tooltip: "",
          weight: 0.3,
          templateId: CommandColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("keybinding", "Keybinding"),
          tooltip: "",
          weight: 0.2,
          templateId: KeybindingColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("when", "When"),
          tooltip: "",
          weight: 0.35,
          templateId: WhenColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("source", "Source"),
          tooltip: "",
          weight: 0.15,
          templateId: SourceColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        this.instantiationService.createInstance(ActionsColumnRenderer, this),
        this.instantiationService.createInstance(CommandColumnRenderer),
        this.instantiationService.createInstance(KeybindingColumnRenderer),
        this.instantiationService.createInstance(WhenColumnRenderer, this),
        this.instantiationService.createInstance(SourceColumnRenderer)
      ],
      {
        identityProvider: { getId: (e) => e.id },
        horizontalScrolling: false,
        accessibilityProvider: new AccessibilityProvider(this.configurationService),
        keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => e.keybindingItem.commandLabel || e.keybindingItem.command },
        overrideStyles: {
          listBackground: editorBackground
        },
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        openOnSingleClick: false,
        transformOptimization: false
        // disable transform optimization as it causes the editor overflow widgets to be mispositioned
      }
    ));
    this._register(this.keybindingsTable.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.keybindingsTable.onDidChangeFocus((e) => this.onFocusChange()));
    this._register(this.keybindingsTable.onDidFocus(() => {
      this.keybindingsTable.getHTMLElement().classList.add("focused");
      this.onFocusChange();
    }));
    this._register(this.keybindingsTable.onDidBlur(() => {
      this.keybindingsTable.getHTMLElement().classList.remove("focused");
      this.keybindingFocusContextKey.reset();
    }));
    this._register(this.keybindingsTable.onDidOpen((e) => {
      if (e.browserEvent?.defaultPrevented) {
        return;
      }
      const activeKeybindingEntry = this.activeKeybindingEntry;
      if (activeKeybindingEntry) {
        this.defineKeybinding(activeKeybindingEntry, false);
      }
    }));
    DOM.append(this.keybindingsTableContainer, this.overflowWidgetsDomNode);
  }
  async render(preserveFocus) {
    if (this.input) {
      const input = this.input;
      this.keybindingsEditorModel = await input.resolve();
      await this.keybindingsEditorModel.resolve(this.getActionsLabels());
      this.renderKeybindingsEntries(false, preserveFocus);
      if (input.searchOptions) {
        this.recordKeysAction.checked = input.searchOptions.recordKeybindings;
        this.sortByPrecedenceAction.checked = input.searchOptions.sortByPrecedence;
        this.searchWidget.setValue(input.searchOptions.searchValue);
      } else {
        this.updateSearchOptions();
      }
    }
  }
  getActionsLabels() {
    const actionsLabels = /* @__PURE__ */ new Map();
    for (const editorAction of EditorExtensionsRegistry.getEditorActions()) {
      actionsLabels.set(editorAction.id, editorAction.label);
    }
    for (const menuItem of MenuRegistry.getMenuItems(MenuId.CommandPalette)) {
      if (isIMenuItem(menuItem)) {
        const title = typeof menuItem.command.title === "string" ? menuItem.command.title : menuItem.command.title.value;
        const category = menuItem.command.category ? typeof menuItem.command.category === "string" ? menuItem.command.category : menuItem.command.category.value : void 0;
        actionsLabels.set(menuItem.command.id, category ? `${category}: ${title}` : title);
      }
    }
    return actionsLabels;
  }
  filterKeybindings() {
    this.renderKeybindingsEntries(this.searchWidget.hasFocus());
    this.searchHistoryDelayer.trigger(() => {
      this.searchWidget.inputBox.addToHistory();
      this.getMemento(StorageScope.PROFILE, StorageTarget.USER)["searchHistory"] = this.searchWidget.inputBox.getHistory();
      this.saveState();
    });
  }
  clearKeyboardShortcutSearchHistory() {
    this.searchWidget.inputBox.clearHistory();
    this.getMemento(StorageScope.PROFILE, StorageTarget.USER)["searchHistory"] = this.searchWidget.inputBox.getHistory();
    this.saveState();
  }
  renderKeybindingsEntries(reset, preserveFocus) {
    if (this.keybindingsEditorModel) {
      const filter = this.searchWidget.getValue();
      const keybindingsEntries = this.keybindingsEditorModel.fetch(filter, this.sortByPrecedenceAction.checked);
      this.accessibilityService.alert(localize("foundResults", "{0} results", keybindingsEntries.length));
      this.ariaLabelElement.setAttribute("aria-label", this.getAriaLabel(keybindingsEntries));
      if (keybindingsEntries.length === 0) {
        this.latestEmptyFilters.push(filter);
      }
      const currentSelectedIndex = this.keybindingsTable.getSelection()[0];
      this.tableEntries = keybindingsEntries;
      this.keybindingsTable.splice(0, this.keybindingsTable.length, this.tableEntries);
      this.layoutKeybindingsTable();
      if (reset) {
        this.keybindingsTable.setSelection([]);
        this.keybindingsTable.setFocus([]);
      } else {
        if (this.unAssignedKeybindingItemToRevealAndFocus) {
          const index = this.getNewIndexOfUnassignedKeybinding(this.unAssignedKeybindingItemToRevealAndFocus);
          if (index !== -1) {
            this.keybindingsTable.reveal(index, 0.2);
            this.selectEntry(index);
          }
          this.unAssignedKeybindingItemToRevealAndFocus = null;
        } else if (currentSelectedIndex !== -1 && currentSelectedIndex < this.tableEntries.length) {
          this.selectEntry(currentSelectedIndex, preserveFocus);
        } else if (this.editorService.activeEditorPane === this && !preserveFocus) {
          this.focus();
        }
      }
    }
  }
  getAriaLabel(keybindingsEntries) {
    if (this.sortByPrecedenceAction.checked) {
      return localize("show sorted keybindings", "Showing {0} Keybindings in precedence order", keybindingsEntries.length);
    } else {
      return localize("show keybindings", "Showing {0} Keybindings in alphabetical order", keybindingsEntries.length);
    }
  }
  layoutKeybindingsTable() {
    if (!this.dimension) {
      return;
    }
    const tableHeight = this.dimension.height - (DOM.getDomNodePagePosition(this.headerContainer).height + 12);
    this.keybindingsTableContainer.style.height = `${tableHeight}px`;
    this.keybindingsTable.layout(tableHeight);
  }
  getIndexOf(listEntry) {
    const index = this.tableEntries.indexOf(listEntry);
    if (index === -1) {
      for (let i = 0; i < this.tableEntries.length; i++) {
        if (this.tableEntries[i].id === listEntry.id) {
          return i;
        }
      }
    }
    return index;
  }
  getNewIndexOfUnassignedKeybinding(unassignedKeybinding) {
    for (let index = 0; index < this.tableEntries.length; index++) {
      const entry = this.tableEntries[index];
      if (entry.templateId === KEYBINDING_ENTRY_TEMPLATE_ID) {
        const keybindingItemEntry = entry;
        if (keybindingItemEntry.keybindingItem.command === unassignedKeybinding.keybindingItem.command) {
          return index;
        }
      }
    }
    return -1;
  }
  selectEntry(keybindingItemEntry, focus = true) {
    const index = typeof keybindingItemEntry === "number" ? keybindingItemEntry : this.getIndexOf(keybindingItemEntry);
    if (index !== -1 && index < this.keybindingsTable.length) {
      if (focus) {
        this.keybindingsTable.domFocus();
        this.keybindingsTable.setFocus([index]);
      }
      this.keybindingsTable.setSelection([index]);
    }
  }
  focusKeybindings() {
    this.keybindingsTable.domFocus();
    const currentFocusIndices = this.keybindingsTable.getFocus();
    this.keybindingsTable.setFocus([currentFocusIndices.length ? currentFocusIndices[0] : 0]);
  }
  selectKeybinding(keybindingItemEntry) {
    this.selectEntry(keybindingItemEntry);
  }
  recordSearchKeys() {
    this.recordKeysAction.checked = true;
  }
  toggleSortByPrecedence() {
    this.sortByPrecedenceAction.checked = !this.sortByPrecedenceAction.checked;
  }
  onContextMenu(e) {
    if (!e.element) {
      return;
    }
    if (e.element.templateId === KEYBINDING_ENTRY_TEMPLATE_ID) {
      const keybindingItemEntry = e.element;
      this.selectEntry(keybindingItemEntry);
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => [
          this.createCopyAction(keybindingItemEntry),
          this.createCopyCommandAction(keybindingItemEntry),
          this.createCopyCommandTitleAction(keybindingItemEntry),
          new Separator(),
          ...keybindingItemEntry.keybindingItem.keybinding ? [this.createDefineKeybindingAction(keybindingItemEntry), this.createAddKeybindingAction(keybindingItemEntry)] : [this.createDefineKeybindingAction(keybindingItemEntry)],
          new Separator(),
          this.createRemoveAction(keybindingItemEntry),
          this.createResetAction(keybindingItemEntry),
          new Separator(),
          this.createDefineWhenExpressionAction(keybindingItemEntry),
          new Separator(),
          this.createShowConflictsAction(keybindingItemEntry)
        ]
      });
    }
  }
  onFocusChange() {
    this.keybindingFocusContextKey.reset();
    const element = this.keybindingsTable.getFocusedElements()[0];
    if (!element) {
      return;
    }
    if (element.templateId === KEYBINDING_ENTRY_TEMPLATE_ID) {
      this.keybindingFocusContextKey.set(true);
    }
  }
  createDefineKeybindingAction(keybindingItemEntry) {
    return {
      label: keybindingItemEntry.keybindingItem.keybinding ? localize("changeLabel", "Change Keybinding...") : localize("addLabel", "Add Keybinding..."),
      enabled: true,
      id: KEYBINDINGS_EDITOR_COMMAND_DEFINE,
      run: () => this.defineKeybinding(keybindingItemEntry, false)
    };
  }
  createAddKeybindingAction(keybindingItemEntry) {
    return {
      label: localize("addLabel", "Add Keybinding..."),
      enabled: true,
      id: KEYBINDINGS_EDITOR_COMMAND_ADD,
      run: () => this.defineKeybinding(keybindingItemEntry, true)
    };
  }
  createDefineWhenExpressionAction(keybindingItemEntry) {
    return {
      label: localize("editWhen", "Change When Expression"),
      enabled: !!keybindingItemEntry.keybindingItem.keybinding,
      id: KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN,
      run: () => this.defineWhenExpression(keybindingItemEntry)
    };
  }
  createRemoveAction(keybindingItem) {
    return {
      label: localize("removeLabel", "Remove Keybinding"),
      enabled: !!keybindingItem.keybindingItem.keybinding,
      id: KEYBINDINGS_EDITOR_COMMAND_REMOVE,
      run: () => this.removeKeybinding(keybindingItem)
    };
  }
  createResetAction(keybindingItem) {
    return {
      label: localize("resetLabel", "Reset Keybinding"),
      enabled: !keybindingItem.keybindingItem.keybindingItem.isDefault,
      id: KEYBINDINGS_EDITOR_COMMAND_RESET,
      run: () => this.resetKeybinding(keybindingItem)
    };
  }
  createShowConflictsAction(keybindingItem) {
    return {
      label: localize("showSameKeybindings", "Show Same Keybindings"),
      enabled: !!keybindingItem.keybindingItem.keybinding,
      id: KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR,
      run: () => this.showSimilarKeybindings(keybindingItem)
    };
  }
  createCopyAction(keybindingItem) {
    return {
      label: localize("copyLabel", "Copy"),
      enabled: true,
      id: KEYBINDINGS_EDITOR_COMMAND_COPY,
      run: () => this.copyKeybinding(keybindingItem)
    };
  }
  createCopyCommandAction(keybinding) {
    return {
      label: localize("copyCommandLabel", "Copy Command ID"),
      enabled: true,
      id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND,
      run: () => this.copyKeybindingCommand(keybinding)
    };
  }
  createCopyCommandTitleAction(keybinding) {
    return {
      label: localize("copyCommandTitleLabel", "Copy Command Title"),
      enabled: !!keybinding.keybindingItem.commandLabel,
      id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE,
      run: () => this.copyKeybindingCommandTitle(keybinding)
    };
  }
  onKeybindingEditingError(error) {
    this.notificationService.error(typeof error === "string" ? error : localize("error", "Error '{0}' while editing the keybinding. Please open 'keybindings.json' file and check for errors.", `${error}`));
  }
};
KeybindingsEditor.ID = "workbench.editor.keybindings";
KeybindingsEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingEditingService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IClipboardService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IEditorService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IAccessibilityService)
], KeybindingsEditor);
class Delegate {
  constructor() {
    this.headerRowHeight = 30;
  }
  getHeight(element) {
    if (element.templateId === KEYBINDING_ENTRY_TEMPLATE_ID) {
      const commandIdMatched = element.keybindingItem.commandLabel && element.commandIdMatches;
      const commandDefaultLabelMatched = !!element.commandDefaultLabelMatches;
      const extensionIdMatched = !!element.extensionIdMatches;
      if (commandIdMatched && commandDefaultLabelMatched) {
        return 60;
      }
      if (extensionIdMatched || commandIdMatched || commandDefaultLabelMatched) {
        return 40;
      }
    }
    return 24;
  }
}
let ActionsColumnRenderer = class {
  constructor(keybindingsEditor, keybindingsService) {
    this.keybindingsEditor = keybindingsEditor;
    this.keybindingsService = keybindingsService;
    this.templateId = ActionsColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = DOM.append(container, $(".actions"));
    const actionBar = new ActionBar(element);
    return { actionBar };
  }
  renderElement(keybindingItemEntry, index, templateData, height) {
    templateData.actionBar.clear();
    const actions = [];
    if (keybindingItemEntry.keybindingItem.keybinding) {
      actions.push(this.createEditAction(keybindingItemEntry));
    } else {
      actions.push(this.createAddAction(keybindingItemEntry));
    }
    templateData.actionBar.push(actions, { icon: true });
  }
  createEditAction(keybindingItemEntry) {
    const keybinding = this.keybindingsService.lookupKeybinding(KEYBINDINGS_EDITOR_COMMAND_DEFINE);
    return {
      class: ThemeIcon.asClassName(keybindingsEditIcon),
      enabled: true,
      id: "editKeybinding",
      tooltip: keybinding ? localize("editKeybindingLabelWithKey", "Change Keybinding {0}", `(${keybinding.getLabel()})`) : localize("editKeybindingLabel", "Change Keybinding"),
      run: () => this.keybindingsEditor.defineKeybinding(keybindingItemEntry, false)
    };
  }
  createAddAction(keybindingItemEntry) {
    const keybinding = this.keybindingsService.lookupKeybinding(KEYBINDINGS_EDITOR_COMMAND_DEFINE);
    return {
      class: ThemeIcon.asClassName(keybindingsAddIcon),
      enabled: true,
      id: "addKeybinding",
      tooltip: keybinding ? localize("addKeybindingLabelWithKey", "Add Keybinding {0}", `(${keybinding.getLabel()})`) : localize("addKeybindingLabel", "Add Keybinding"),
      run: () => this.keybindingsEditor.defineKeybinding(keybindingItemEntry, false)
    };
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
  }
};
ActionsColumnRenderer.TEMPLATE_ID = "actions";
ActionsColumnRenderer = __decorateClass([
  __decorateParam(1, IKeybindingService)
], ActionsColumnRenderer);
let CommandColumnRenderer = class {
  constructor(_hoverService) {
    this._hoverService = _hoverService;
    this.templateId = CommandColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const commandColumn = DOM.append(container, $(".command"));
    const commandColumnHover = this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), commandColumn, "");
    const commandLabelContainer = DOM.append(commandColumn, $(".command-label"));
    const commandLabel = new HighlightedLabel(commandLabelContainer);
    const commandDefaultLabelContainer = DOM.append(commandColumn, $(".command-default-label"));
    const commandDefaultLabel = new HighlightedLabel(commandDefaultLabelContainer);
    const commandIdLabelContainer = DOM.append(commandColumn, $(".command-id.code"));
    const commandIdLabel = new HighlightedLabel(commandIdLabelContainer);
    return { commandColumn, commandColumnHover, commandLabelContainer, commandLabel, commandDefaultLabelContainer, commandDefaultLabel, commandIdLabelContainer, commandIdLabel };
  }
  renderElement(keybindingItemEntry, index, templateData, height) {
    const keybindingItem = keybindingItemEntry.keybindingItem;
    const commandIdMatched = !!(keybindingItem.commandLabel && keybindingItemEntry.commandIdMatches);
    const commandDefaultLabelMatched = !!keybindingItemEntry.commandDefaultLabelMatches;
    templateData.commandColumn.classList.toggle("vertical-align-column", commandIdMatched || commandDefaultLabelMatched);
    const title = keybindingItem.commandLabel ? localize("title", "{0} ({1})", keybindingItem.commandLabel, keybindingItem.command) : keybindingItem.command;
    templateData.commandColumn.setAttribute("aria-label", title);
    templateData.commandColumnHover.update(title);
    if (keybindingItem.commandLabel) {
      templateData.commandLabelContainer.classList.remove("hide");
      templateData.commandLabel.set(keybindingItem.commandLabel, keybindingItemEntry.commandLabelMatches);
    } else {
      templateData.commandLabelContainer.classList.add("hide");
      templateData.commandLabel.set(void 0);
    }
    if (keybindingItemEntry.commandDefaultLabelMatches) {
      templateData.commandDefaultLabelContainer.classList.remove("hide");
      templateData.commandDefaultLabel.set(keybindingItem.commandDefaultLabel, keybindingItemEntry.commandDefaultLabelMatches);
    } else {
      templateData.commandDefaultLabelContainer.classList.add("hide");
      templateData.commandDefaultLabel.set(void 0);
    }
    if (keybindingItemEntry.commandIdMatches || !keybindingItem.commandLabel) {
      templateData.commandIdLabelContainer.classList.remove("hide");
      templateData.commandIdLabel.set(keybindingItem.command, keybindingItemEntry.commandIdMatches);
    } else {
      templateData.commandIdLabelContainer.classList.add("hide");
      templateData.commandIdLabel.set(void 0);
    }
  }
  disposeTemplate(templateData) {
    templateData.commandColumnHover.dispose();
    templateData.commandDefaultLabel.dispose();
    templateData.commandIdLabel.dispose();
    templateData.commandLabel.dispose();
  }
};
CommandColumnRenderer.TEMPLATE_ID = "commands";
CommandColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService)
], CommandColumnRenderer);
const _KeybindingColumnRenderer = class _KeybindingColumnRenderer {
  constructor() {
    this.templateId = _KeybindingColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = DOM.append(container, $(".keybinding"));
    const keybindingLabel = new KeybindingLabel(DOM.append(element, $("div.keybinding-label")), OS, defaultKeybindingLabelStyles);
    return { keybindingLabel };
  }
  renderElement(keybindingItemEntry, index, templateData, height) {
    if (keybindingItemEntry.keybindingItem.keybinding) {
      templateData.keybindingLabel.set(keybindingItemEntry.keybindingItem.keybinding, keybindingItemEntry.keybindingMatches);
    } else {
      templateData.keybindingLabel.set(void 0, void 0);
    }
  }
  disposeTemplate(templateData) {
    templateData.keybindingLabel.dispose();
  }
};
_KeybindingColumnRenderer.TEMPLATE_ID = "keybindings";
let KeybindingColumnRenderer = _KeybindingColumnRenderer;
function onClick(element, callback) {
  const disposables = new DisposableStore();
  disposables.add(DOM.addDisposableListener(element, DOM.EventType.CLICK, DOM.finalHandler(callback)));
  disposables.add(DOM.addDisposableListener(element, DOM.EventType.KEY_UP, (e) => {
    const keyboardEvent = new StandardKeyboardEvent(e);
    if (keyboardEvent.equals(KeyCode.Space) || keyboardEvent.equals(KeyCode.Enter)) {
      e.preventDefault();
      e.stopPropagation();
      callback();
    }
  }));
  return disposables;
}
let SourceColumnRenderer = class {
  constructor(extensionsWorkbenchService, hoverService) {
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.hoverService = hoverService;
    this.templateId = SourceColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const sourceColumn = DOM.append(container, $(".source"));
    const sourceColumnHover = this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), sourceColumn, "");
    const sourceLabel = new HighlightedLabel(DOM.append(sourceColumn, $(".source-label")));
    const extensionContainer = DOM.append(sourceColumn, $(".extension-container"));
    const extensionLabel = DOM.append(extensionContainer, $("a.extension-label", { tabindex: 0 }));
    const extensionId = new HighlightedLabel(DOM.append(extensionContainer, $(".extension-id-container.code")));
    return { sourceColumn, sourceColumnHover, sourceLabel, extensionLabel, extensionContainer, extensionId, disposables: new DisposableStore() };
  }
  renderElement(keybindingItemEntry, index, templateData, height) {
    templateData.disposables.clear();
    if (isString(keybindingItemEntry.keybindingItem.source)) {
      templateData.extensionContainer.classList.add("hide");
      templateData.sourceLabel.element.classList.remove("hide");
      templateData.sourceColumnHover.update("");
      templateData.sourceLabel.set(keybindingItemEntry.keybindingItem.source || "-", keybindingItemEntry.sourceMatches);
    } else {
      templateData.extensionContainer.classList.remove("hide");
      templateData.sourceLabel.element.classList.add("hide");
      const extension = keybindingItemEntry.keybindingItem.source;
      const extensionLabel = extension.displayName ?? extension.identifier.value;
      templateData.sourceColumnHover.update(localize("extension label", "Extension ({0})", extensionLabel));
      templateData.extensionLabel.textContent = extensionLabel;
      templateData.disposables.add(onClick(templateData.extensionLabel, () => {
        this.extensionsWorkbenchService.open(extension.identifier.value);
      }));
      if (keybindingItemEntry.extensionIdMatches) {
        templateData.extensionId.element.classList.remove("hide");
        templateData.extensionId.set(extension.identifier.value, keybindingItemEntry.extensionIdMatches);
      } else {
        templateData.extensionId.element.classList.add("hide");
        templateData.extensionId.set(void 0);
      }
    }
  }
  disposeTemplate(templateData) {
    templateData.sourceColumnHover.dispose();
    templateData.disposables.dispose();
    templateData.sourceLabel.dispose();
    templateData.extensionId.dispose();
  }
};
SourceColumnRenderer.TEMPLATE_ID = "source";
SourceColumnRenderer = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IHoverService)
], SourceColumnRenderer);
let WhenInputWidget = class extends Disposable {
  constructor(parent, keybindingsEditor, instantiationService, contextKeyService) {
    super();
    this._onDidAccept = this._register(new Emitter());
    this.onDidAccept = this._onDidAccept.event;
    this._onDidReject = this._register(new Emitter());
    this.onDidReject = this._onDidReject.event;
    const focusContextKey = CONTEXT_WHEN_FOCUS.bindTo(contextKeyService);
    this.input = this._register(instantiationService.createInstance(SuggestEnabledInput, "keyboardshortcutseditor#wheninput", parent, {
      provideResults: () => {
        const result = [];
        for (const contextKey of RawContextKey.all()) {
          result.push({ label: contextKey.key, documentation: contextKey.description, detail: contextKey.type, kind: CompletionItemKind.Constant });
        }
        return result;
      },
      triggerCharacters: ["!", " "],
      wordDefinition: /[a-zA-Z.]+/,
      alwaysShowSuggestions: true
    }, "", `keyboardshortcutseditor#wheninput`, { focusContextKey, overflowWidgetsDomNode: keybindingsEditor.overflowWidgetsDomNode }));
    this._register(DOM.addDisposableListener(this.input.element, DOM.EventType.DBLCLICK, (e) => DOM.EventHelper.stop(e)));
    this._register(toDisposable(() => focusContextKey.reset()));
    this._register(keybindingsEditor.onAcceptWhenExpression(() => this._onDidAccept.fire(this.input.getValue())));
    this._register(Event.any(keybindingsEditor.onRejectWhenExpression, this.input.onDidBlur)(() => this._onDidReject.fire()));
  }
  layout(dimension) {
    this.input.layout(dimension);
  }
  show(value) {
    this.input.setValue(value);
    this.input.focus(true);
  }
};
WhenInputWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService)
], WhenInputWidget);
let WhenColumnRenderer = class {
  constructor(keybindingsEditor, hoverService, instantiationService) {
    this.keybindingsEditor = keybindingsEditor;
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.templateId = WhenColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = DOM.append(container, $(".when"));
    const whenLabelContainer = DOM.append(element, $("div.when-label"));
    const whenLabel = new HighlightedLabel(whenLabelContainer);
    const whenInputContainer = DOM.append(element, $("div.when-input-container"));
    return {
      element,
      whenLabelContainer,
      whenLabel,
      whenInputContainer,
      disposables: new DisposableStore()
    };
  }
  renderElement(keybindingItemEntry, index, templateData, height) {
    templateData.disposables.clear();
    const whenInputDisposables = templateData.disposables.add(new DisposableStore());
    templateData.disposables.add(this.keybindingsEditor.onDefineWhenExpression((e) => {
      if (keybindingItemEntry === e) {
        templateData.element.classList.add("input-mode");
        const inputWidget = whenInputDisposables.add(this.instantiationService.createInstance(WhenInputWidget, templateData.whenInputContainer, this.keybindingsEditor));
        inputWidget.layout(new DOM.Dimension(templateData.element.parentElement.clientWidth, 18));
        inputWidget.show(keybindingItemEntry.keybindingItem.when || "");
        const hideInputWidget = () => {
          whenInputDisposables.clear();
          templateData.element.classList.remove("input-mode");
          templateData.element.parentElement.style.paddingLeft = "10px";
          DOM.clearNode(templateData.whenInputContainer);
        };
        whenInputDisposables.add(inputWidget.onDidAccept((value) => {
          hideInputWidget();
          this.keybindingsEditor.updateKeybinding(keybindingItemEntry, keybindingItemEntry.keybindingItem.keybinding ? keybindingItemEntry.keybindingItem.keybinding.getUserSettingsLabel() || "" : "", value);
          this.keybindingsEditor.selectKeybinding(keybindingItemEntry);
        }));
        whenInputDisposables.add(inputWidget.onDidReject(() => {
          hideInputWidget();
          this.keybindingsEditor.selectKeybinding(keybindingItemEntry);
        }));
        templateData.element.parentElement.style.paddingLeft = "0px";
      }
    }));
    templateData.whenLabelContainer.classList.toggle("code", !!keybindingItemEntry.keybindingItem.when);
    templateData.whenLabelContainer.classList.toggle("empty", !keybindingItemEntry.keybindingItem.when);
    if (keybindingItemEntry.keybindingItem.when) {
      templateData.whenLabel.set(keybindingItemEntry.keybindingItem.when, keybindingItemEntry.whenMatches, keybindingItemEntry.keybindingItem.when);
      templateData.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), templateData.element, keybindingItemEntry.keybindingItem.when));
    } else {
      templateData.whenLabel.set("-");
    }
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
    templateData.whenLabel.dispose();
  }
};
WhenColumnRenderer.TEMPLATE_ID = "when";
WhenColumnRenderer = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IInstantiationService)
], WhenColumnRenderer);
class AccessibilityProvider {
  constructor(configurationService) {
    this.configurationService = configurationService;
  }
  getWidgetAriaLabel() {
    return localize("keybindingsLabel", "Keybindings");
  }
  getAriaLabel({ keybindingItem }) {
    const ariaLabel = [
      keybindingItem.commandLabel ? keybindingItem.commandLabel : keybindingItem.command,
      keybindingItem.keybinding?.getAriaLabel() || localize("noKeybinding", "No keybinding assigned"),
      keybindingItem.when ? keybindingItem.when : localize("noWhen", "No when context"),
      isString(keybindingItem.source) ? keybindingItem.source : keybindingItem.source.description ?? keybindingItem.source.identifier.value
    ];
    if (this.configurationService.getValue(AccessibilityVerbositySettingId.KeybindingsEditor)) {
      const kbEditorAriaLabel = localize("keyboard shortcuts aria label", "use space or enter to change the keybinding.");
      ariaLabel.push(kbEditorAriaLabel);
    }
    return ariaLabel.join(", ");
  }
}
registerColor("keybindingTable.headerBackground", tableOddRowsBackgroundColor, "Background color for the keyboard shortcuts table header.");
registerColor("keybindingTable.rowsBackground", tableOddRowsBackgroundColor, "Background color for the keyboard shortcuts table alternating rows.");
registerThemingParticipant((theme, collector) => {
  const foregroundColor = theme.getColor(foreground);
  if (foregroundColor) {
    const whenForegroundColor = foregroundColor.transparent(0.8).makeOpaque(WORKBENCH_BACKGROUND(theme));
    collector.addRule(`.keybindings-editor > .keybindings-body > .keybindings-table-container .monaco-table .monaco-table-tr .monaco-table-td .code { color: ${whenForegroundColor}; }`);
  }
  const listActiveSelectionForegroundColor = theme.getColor(listActiveSelectionForeground);
  const listActiveSelectionBackgroundColor = theme.getColor(listActiveSelectionBackground);
  if (listActiveSelectionForegroundColor && listActiveSelectionBackgroundColor) {
    const whenForegroundColor = listActiveSelectionForegroundColor.transparent(0.8).makeOpaque(listActiveSelectionBackgroundColor);
    collector.addRule(`.keybindings-editor > .keybindings-body > .keybindings-table-container .monaco-table.focused .monaco-list-row.selected .monaco-table-tr .monaco-table-td .code { color: ${whenForegroundColor}; }`);
  }
  const listInactiveSelectionForegroundColor = theme.getColor(listInactiveSelectionForeground);
  const listInactiveSelectionBackgroundColor = theme.getColor(listInactiveSelectionBackground);
  if (listInactiveSelectionForegroundColor && listInactiveSelectionBackgroundColor) {
    const whenForegroundColor = listInactiveSelectionForegroundColor.transparent(0.8).makeOpaque(listInactiveSelectionBackgroundColor);
    collector.addRule(`.keybindings-editor > .keybindings-body > .keybindings-table-container .monaco-table .monaco-list-row.selected .monaco-table-tr .monaco-table-td .code { color: ${whenForegroundColor}; }`);
  }
  const listFocusForegroundColor = theme.getColor(listFocusForeground);
  const listFocusBackgroundColor = theme.getColor(listFocusBackground);
  if (listFocusForegroundColor && listFocusBackgroundColor) {
    const whenForegroundColor = listFocusForegroundColor.transparent(0.8).makeOpaque(listFocusBackgroundColor);
    collector.addRule(`.keybindings-editor > .keybindings-body > .keybindings-table-container .monaco-table.focused .monaco-list-row.focused .monaco-table-tr .monaco-table-td .code { color: ${whenForegroundColor}; }`);
  }
  const listHoverForegroundColor = theme.getColor(listHoverForeground);
  const listHoverBackgroundColor = theme.getColor(listHoverBackground);
  if (listHoverForegroundColor && listHoverBackgroundColor) {
    const whenForegroundColor = listHoverForegroundColor.transparent(0.8).makeOpaque(listHoverBackgroundColor);
    collector.addRule(`.keybindings-editor > .keybindings-body > .keybindings-table-container .monaco-table.focused .monaco-list-row:hover:not(.focused):not(.selected) .monaco-table-tr .monaco-table-td .code { color: ${whenForegroundColor}; }`);
  }
});
export {
  KeybindingsEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJpbmRpbmdzRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qIGVzbGludC1kaXNhYmxlIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9ucyAqL1xuXG5pbXBvcnQgJy4vbWVkaWEva2V5YmluZGluZ3NFZGl0b3IuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBpc0lPUywgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVG9nZ2xlQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBIaWdobGlnaHRlZExhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wZW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzRWRpdG9yTW9kZWwsIEtFWUJJTkRJTkdfRU5UUllfVEVNUExBVEVfSUQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJpbmRpbmdzRWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UsIElVc2VyRnJpZW5kbHlLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBEZWZpbmVLZXliaW5kaW5nV2lkZ2V0LCBLZXliaW5kaW5nc1NlYXJjaFdpZGdldCB9IGZyb20gJy4va2V5YmluZGluZ1dpZGdldHMuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9LRVlCSU5ESU5HX0ZPQ1VTLCBDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiwgQ09OVEVYVF9LRVlCSU5ESU5HU19TRUFSQ0hfRk9DVVMsIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1JFQ09SRF9TRUFSQ0hfS0VZUywgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfU09SVEJZX1BSRUNFREVOQ0UsIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0RFRklORSwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVNT1ZFLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9SRVNFVCwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQ09QWSwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQ09QWV9DT01NQU5ELCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DTEVBUl9TRUFSQ0hfUkVTVUxUUywgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfREVGSU5FX1dIRU4sIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1NIT1dfU0lNSUxBUiwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQURELCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DT1BZX0NPTU1BTkRfVElUTEUsIENPTlRFWFRfV0hFTl9GT0NVUyB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ0VkaXRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMva2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ0VkaXRpbmcuanMnO1xuaW1wb3J0IHsgSUxpc3RDb250ZXh0TWVudUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCwgSUNvbG9yVGhlbWUsIElDc3NTdHlsZUNvbGxlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgSUNvbnRleHRLZXksIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBiYWRnZUJhY2tncm91bmQsIGNvbnRyYXN0Qm9yZGVyLCBiYWRnZUZvcmVncm91bmQsIGxpc3RBY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kLCBsaXN0SW5hY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kLCBsaXN0SG92ZXJGb3JlZ3JvdW5kLCBsaXN0Rm9jdXNGb3JlZ3JvdW5kLCBlZGl0b3JCYWNrZ3JvdW5kLCBmb3JlZ3JvdW5kLCBsaXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgbGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgbGlzdEZvY3VzQmFja2dyb3VuZCwgbGlzdEhvdmVyQmFja2dyb3VuZCwgcmVnaXN0ZXJDb2xvciwgdGFibGVPZGRSb3dzQmFja2dyb3VuZENvbG9yLCBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE1lbnVSZWdpc3RyeSwgTWVudUlkLCBpc0lNZW51SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IFdPUktCRU5DSF9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nSXRlbUVudHJ5LCBJS2V5YmluZGluZ3NFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IGtleWJpbmRpbmdzUmVjb3JkS2V5c0ljb24sIGtleWJpbmRpbmdzU29ydEljb24sIGtleWJpbmRpbmdzQWRkSWNvbiwgcHJlZmVyZW5jZXNDbGVhcklucHV0SWNvbiwga2V5YmluZGluZ3NFZGl0SWNvbiB9IGZyb20gJy4vcHJlZmVyZW5jZXNJY29ucy5qcyc7XG5pbXBvcnQgeyBJVGFibGVSZW5kZXJlciwgSVRhYmxlVmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9icm93c2VyL2tleWJpbmRpbmdzRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Rvb2xiYXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0S2V5YmluZGluZ0xhYmVsU3R5bGVzLCBkZWZhdWx0VG9nZ2xlU3R5bGVzLCBnZXRJbnB1dEJveFN0eWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0RW5hYmxlZElucHV0IH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3N1Z2dlc3RFbmFibGVkSW5wdXQvc3VnZ2VzdEVuYWJsZWRJbnB1dC5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uSXRlbUtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBzZXR0aW5nc1RleHRJbnB1dEJvcmRlciB9IGZyb20gJy4uL2NvbW1vbi9zZXR0aW5nc0VkaXRvckNvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyTmF2aWdhYmxlQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dpZGdldE5hdmlnYXRpb25Db21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB0eXBlIHsgSU1hbmFnZWRIb3ZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcblxuY29uc3QgJCA9IERPTS4kO1xuXG5leHBvcnQgY2xhc3MgS2V5YmluZGluZ3NFZGl0b3IgZXh0ZW5kcyBFZGl0b3JQYW5lIGltcGxlbWVudHMgSUtleWJpbmRpbmdzRWRpdG9yUGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmVkaXRvci5rZXliaW5kaW5ncyc7XG5cblx0cHJpdmF0ZSBfb25EZWZpbmVXaGVuRXhwcmVzc2lvbjogRW1pdHRlcjxJS2V5YmluZGluZ0l0ZW1FbnRyeT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJS2V5YmluZGluZ0l0ZW1FbnRyeT4oKSk7XG5cdHJlYWRvbmx5IG9uRGVmaW5lV2hlbkV4cHJlc3Npb246IEV2ZW50PElLZXliaW5kaW5nSXRlbUVudHJ5PiA9IHRoaXMuX29uRGVmaW5lV2hlbkV4cHJlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25SZWplY3RXaGVuRXhwcmVzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElLZXliaW5kaW5nSXRlbUVudHJ5PigpKTtcblx0cmVhZG9ubHkgb25SZWplY3RXaGVuRXhwcmVzc2lvbiA9IHRoaXMuX29uUmVqZWN0V2hlbkV4cHJlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25BY2NlcHRXaGVuRXhwcmVzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElLZXliaW5kaW5nSXRlbUVudHJ5PigpKTtcblx0cmVhZG9ubHkgb25BY2NlcHRXaGVuRXhwcmVzc2lvbiA9IHRoaXMuX29uQWNjZXB0V2hlbkV4cHJlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25MYXlvdXQ6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25MYXlvdXQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25MYXlvdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBrZXliaW5kaW5nc0VkaXRvck1vZGVsOiBLZXliaW5kaW5nc0VkaXRvck1vZGVsIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSBoZWFkZXJDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBhY3Rpb25zQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc2VhcmNoV2lkZ2V0ITogS2V5YmluZGluZ3NTZWFyY2hXaWRnZXQ7XG5cdHByaXZhdGUgc2VhcmNoSGlzdG9yeURlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cblx0cHJpdmF0ZSBvdmVybGF5Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgZGVmaW5lS2V5YmluZGluZ1dpZGdldCE6IERlZmluZUtleWJpbmRpbmdXaWRnZXQ7XG5cblx0cHJpdmF0ZSB1bkFzc2lnbmVkS2V5YmluZGluZ0l0ZW1Ub1JldmVhbEFuZEZvY3VzOiBJS2V5YmluZGluZ0l0ZW1FbnRyeSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHRhYmxlRW50cmllczogSUtleWJpbmRpbmdJdGVtRW50cnlbXSA9IFtdO1xuXHRwcml2YXRlIGtleWJpbmRpbmdzVGFibGVDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBrZXliaW5kaW5nc1RhYmxlITogV29ya2JlbmNoVGFibGU8SUtleWJpbmRpbmdJdGVtRW50cnk+O1xuXG5cdHByaXZhdGUgZGltZW5zaW9uOiBET00uRGltZW5zaW9uIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgZGVsYXllZEZpbHRlcmluZzogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBsYXRlc3RFbXB0eUZpbHRlcnM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUga2V5YmluZGluZ3NFZGl0b3JDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBrZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBzZWFyY2hGb2N1c0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc29ydEJ5UHJlY2VkZW5jZUFjdGlvbjogQWN0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlY29yZEtleXNBY3Rpb246IEFjdGlvbjtcblxuXHRwcml2YXRlIGFyaWFMYWJlbEVsZW1lbnQhOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Z3JvdXA6IElFZGl0b3JHcm91cCxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nc1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdFZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdFZGl0aW5nU2VydmljZTogSUtleWJpbmRpbmdFZGl0aW5nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoS2V5YmluZGluZ3NFZGl0b3IuSUQsIGdyb3VwLCB0ZWxlbWV0cnlTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLmRlbGF5ZWRGaWx0ZXJpbmcgPSBuZXcgRGVsYXllcjx2b2lkPigzMDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGtleWJpbmRpbmdzU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzKCgpID0+IHRoaXMucmVuZGVyKCEhdGhpcy5rZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5LmdldCgpKSkpO1xuXG5cdFx0dGhpcy5rZXliaW5kaW5nc0VkaXRvckNvbnRleHRLZXkgPSBDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hGb2N1c0NvbnRleHRLZXkgPSBDT05URVhUX0tFWUJJTkRJTkdTX1NFQVJDSF9GT0NVUy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5rZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5ID0gQ09OVEVYVF9LRVlCSU5ESU5HX0ZPQ1VTLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaEhpc3RvcnlEZWxheWVyID0gbmV3IERlbGF5ZXI8dm9pZD4oNTAwKTtcblxuXHRcdHRoaXMucmVjb3JkS2V5c0FjdGlvbiA9IG5ldyBBY3Rpb24oS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVDT1JEX1NFQVJDSF9LRVlTLCBsb2NhbGl6ZSgncmVjb3JkS2V5c0xhYmVsJywgXCJSZWNvcmQgS2V5c1wiKSwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGtleWJpbmRpbmdzUmVjb3JkS2V5c0ljb24pKTtcblx0XHR0aGlzLnJlY29yZEtleXNBY3Rpb24uY2hlY2tlZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5zb3J0QnlQcmVjZWRlbmNlQWN0aW9uID0gbmV3IEFjdGlvbihLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9TT1JUQllfUFJFQ0VERU5DRSwgbG9jYWxpemUoJ3NvcnRCeVByZWNlZGVuZUxhYmVsJywgXCJTb3J0IGJ5IFByZWNlZGVuY2UgKEhpZ2hlc3QgZmlyc3QpXCIpLCBUaGVtZUljb24uYXNDbGFzc05hbWUoa2V5YmluZGluZ3NTb3J0SWNvbikpO1xuXHRcdHRoaXMuc29ydEJ5UHJlY2VkZW5jZUFjdGlvbi5jaGVja2VkID0gZmFsc2U7XG5cdFx0dGhpcy5vdmVyZmxvd1dpZGdldHNEb21Ob2RlID0gJCgnLmtleWJpbmRpbmdzLW92ZXJmbG93LXdpZGdldHMtY29udGFpbmVyLm1vbmFjby1lZGl0b3InKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIuY3JlYXRlKHBhcmVudCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJOYXZpZ2FibGVDb250YWluZXIoe1xuXHRcdFx0bmFtZTogJ2tleWJpbmRpbmdzRWRpdG9yJyxcblx0XHRcdGZvY3VzTm90aWZpZXJzOiBbdGhpc10sXG5cdFx0XHRmb2N1c05leHRXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0Lmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzS2V5YmluZGluZ3MoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZvY3VzUHJldmlvdXNXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLnNlYXJjaFdpZGdldC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c1NlYXJjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5YmluZGluZ3NFZGl0b3JFbGVtZW50ID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJ2RpdicsIHsgY2xhc3M6ICdrZXliaW5kaW5ncy1lZGl0b3InIH0pKTtcblxuXHRcdHRoaXMuY3JlYXRlQXJpYUxhYmVsRWxlbWVudChrZXliaW5kaW5nc0VkaXRvckVsZW1lbnQpO1xuXHRcdHRoaXMuY3JlYXRlT3ZlcmxheUNvbnRhaW5lcihrZXliaW5kaW5nc0VkaXRvckVsZW1lbnQpO1xuXHRcdHRoaXMuY3JlYXRlSGVhZGVyKGtleWJpbmRpbmdzRWRpdG9yRWxlbWVudCk7XG5cdFx0dGhpcy5jcmVhdGVCb2R5KGtleWJpbmRpbmdzRWRpdG9yRWxlbWVudCk7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRJbnB1dChpbnB1dDogS2V5YmluZGluZ3NFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5rZXliaW5kaW5nc0VkaXRvckNvbnRleHRLZXkuc2V0KHRydWUpO1xuXHRcdHJldHVybiBzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pXG5cdFx0XHQudGhlbigoKSA9PiB0aGlzLnJlbmRlcighIShvcHRpb25zICYmIG9wdGlvbnMucHJlc2VydmVGb2N1cykpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNsZWFySW5wdXQoKTogdm9pZCB7XG5cdFx0c3VwZXIuY2xlYXJJbnB1dCgpO1xuXHRcdHRoaXMua2V5YmluZGluZ3NFZGl0b3JDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0dGhpcy5rZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5LnJlc2V0KCk7XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBET00uRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb247XG5cdFx0dGhpcy5sYXlvdXRTZWFyY2hXaWRnZXQoZGltZW5zaW9uKTtcblxuXHRcdHRoaXMub3ZlcmxheUNvbnRhaW5lci5zdHlsZS53aWR0aCA9IGRpbWVuc2lvbi53aWR0aCArICdweCc7XG5cdFx0dGhpcy5vdmVybGF5Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGRpbWVuc2lvbi5oZWlnaHQgKyAncHgnO1xuXHRcdHRoaXMuZGVmaW5lS2V5YmluZGluZ1dpZGdldC5sYXlvdXQodGhpcy5kaW1lbnNpb24pO1xuXG5cdFx0dGhpcy5sYXlvdXRLZXliaW5kaW5nc1RhYmxlKCk7XG5cdFx0dGhpcy5fb25MYXlvdXQuZmlyZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblxuXHRcdGNvbnN0IGFjdGl2ZUtleWJpbmRpbmdFbnRyeSA9IHRoaXMuYWN0aXZlS2V5YmluZGluZ0VudHJ5O1xuXHRcdGlmIChhY3RpdmVLZXliaW5kaW5nRW50cnkpIHtcblx0XHRcdHRoaXMuc2VsZWN0RW50cnkoYWN0aXZlS2V5YmluZGluZ0VudHJ5KTtcblx0XHR9IGVsc2UgaWYgKCFpc0lPUykge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgYWN0aXZlS2V5YmluZGluZ0VudHJ5KCk6IElLZXliaW5kaW5nSXRlbUVudHJ5IHwgbnVsbCB7XG5cdFx0Y29uc3QgZm9jdXNlZEVsZW1lbnQgPSB0aGlzLmtleWJpbmRpbmdzVGFibGUuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF07XG5cdFx0cmV0dXJuIGZvY3VzZWRFbGVtZW50ICYmIGZvY3VzZWRFbGVtZW50LnRlbXBsYXRlSWQgPT09IEtFWUJJTkRJTkdfRU5UUllfVEVNUExBVEVfSUQgPyA8SUtleWJpbmRpbmdJdGVtRW50cnk+Zm9jdXNlZEVsZW1lbnQgOiBudWxsO1xuXHR9XG5cblx0YXN5bmMgZGVmaW5lS2V5YmluZGluZyhrZXliaW5kaW5nRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5LCBhZGQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnNlbGVjdEVudHJ5KGtleWJpbmRpbmdFbnRyeSk7XG5cdFx0dGhpcy5zaG93T3ZlcmxheUNvbnRhaW5lcigpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBrZXkgPSBhd2FpdCB0aGlzLmRlZmluZUtleWJpbmRpbmdXaWRnZXQuZGVmaW5lKCk7XG5cdFx0XHRpZiAoa2V5KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlS2V5YmluZGluZyhrZXliaW5kaW5nRW50cnksIGtleSwga2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLndoZW4sIGFkZCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMub25LZXliaW5kaW5nRWRpdGluZ0Vycm9yKGVycm9yKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5oaWRlT3ZlcmxheUNvbnRhaW5lcigpO1xuXHRcdFx0dGhpcy5zZWxlY3RFbnRyeShrZXliaW5kaW5nRW50cnkpO1xuXHRcdH1cblx0fVxuXG5cdGRlZmluZVdoZW5FeHByZXNzaW9uKGtleWJpbmRpbmdFbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiB2b2lkIHtcblx0XHRpZiAoa2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcpIHtcblx0XHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZ0VudHJ5KTtcblx0XHRcdHRoaXMuX29uRGVmaW5lV2hlbkV4cHJlc3Npb24uZmlyZShrZXliaW5kaW5nRW50cnkpO1xuXHRcdH1cblx0fVxuXG5cdHJlamVjdFdoZW5FeHByZXNzaW9uKGtleWJpbmRpbmdFbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiB2b2lkIHtcblx0XHR0aGlzLl9vblJlamVjdFdoZW5FeHByZXNzaW9uLmZpcmUoa2V5YmluZGluZ0VudHJ5KTtcblx0fVxuXG5cdGFjY2VwdFdoZW5FeHByZXNzaW9uKGtleWJpbmRpbmdFbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkFjY2VwdFdoZW5FeHByZXNzaW9uLmZpcmUoa2V5YmluZGluZ0VudHJ5KTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUtleWJpbmRpbmcoa2V5YmluZGluZ0VudHJ5OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSwga2V5OiBzdHJpbmcsIHdoZW46IHN0cmluZyB8IHVuZGVmaW5lZCwgYWRkPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN1cnJlbnRLZXkgPSBrZXliaW5kaW5nRW50cnkua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZyA/IGtleWJpbmRpbmdFbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nLmdldFVzZXJTZXR0aW5nc0xhYmVsKCkgOiAnJztcblx0XHRpZiAoY3VycmVudEtleSAhPT0ga2V5IHx8IGtleWJpbmRpbmdFbnRyeS5rZXliaW5kaW5nSXRlbS53aGVuICE9PSB3aGVuKSB7XG5cdFx0XHRpZiAoYWRkKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMua2V5YmluZGluZ0VkaXRpbmdTZXJ2aWNlLmFkZEtleWJpbmRpbmcoa2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmdJdGVtLCBrZXksIHdoZW4gfHwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMua2V5YmluZGluZ0VkaXRpbmdTZXJ2aWNlLmVkaXRLZXliaW5kaW5nKGtleWJpbmRpbmdFbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nSXRlbSwga2V5LCB3aGVuIHx8IHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWtleWJpbmRpbmdFbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nKSB7IC8vIHJldmVhbCBvbmx5IGlmIGtleWJpbmRpbmcgd2FzIGFkZGVkIHRvIHVuYXNzaW5nZWQuIEJlY2F1c2UgdGhlIGVudHJ5IHdpbGwgYmUgcGxhY2VkIGluIGRpZmZlcmVudCBwb3NpdGlvbiBhZnRlciByZW5kZXJpbmdcblx0XHRcdFx0dGhpcy51bkFzc2lnbmVkS2V5YmluZGluZ0l0ZW1Ub1JldmVhbEFuZEZvY3VzID0ga2V5YmluZGluZ0VudHJ5O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlbW92ZUtleWJpbmRpbmcoa2V5YmluZGluZ0VudHJ5OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZ0VudHJ5KTtcblx0XHRpZiAoa2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcpIHsgLy8gVGhpcyBzaG91bGQgYmUgYSBwcmUtY29uZGl0aW9uXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmtleWJpbmRpbmdFZGl0aW5nU2VydmljZS5yZW1vdmVLZXliaW5kaW5nKGtleWJpbmRpbmdFbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nSXRlbSk7XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMub25LZXliaW5kaW5nRWRpdGluZ0Vycm9yKGVycm9yKTtcblx0XHRcdFx0dGhpcy5zZWxlY3RFbnRyeShrZXliaW5kaW5nRW50cnkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlc2V0S2V5YmluZGluZyhrZXliaW5kaW5nRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zZWxlY3RFbnRyeShrZXliaW5kaW5nRW50cnkpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmtleWJpbmRpbmdFZGl0aW5nU2VydmljZS5yZXNldEtleWJpbmRpbmcoa2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmdJdGVtKTtcblx0XHRcdGlmICgha2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcpIHsgLy8gcmV2ZWFsIG9ubHkgaWYga2V5YmluZGluZyB3YXMgYWRkZWQgdG8gdW5hc3NpbmdlZC4gQmVjYXVzZSB0aGUgZW50cnkgd2lsbCBiZSBwbGFjZWQgaW4gZGlmZmVyZW50IHBvc2l0aW9uIGFmdGVyIHJlbmRlcmluZ1xuXHRcdFx0XHR0aGlzLnVuQXNzaWduZWRLZXliaW5kaW5nSXRlbVRvUmV2ZWFsQW5kRm9jdXMgPSBrZXliaW5kaW5nRW50cnk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNlbGVjdEVudHJ5KGtleWJpbmRpbmdFbnRyeSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMub25LZXliaW5kaW5nRWRpdGluZ0Vycm9yKGVycm9yKTtcblx0XHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZ0VudHJ5KTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjb3B5S2V5YmluZGluZyhrZXliaW5kaW5nOiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZyk7XG5cdFx0Y29uc3QgdXNlckZyaWVuZGx5S2V5YmluZGluZzogSVVzZXJGcmllbmRseUtleWJpbmRpbmcgPSB7XG5cdFx0XHRrZXk6IGtleWJpbmRpbmcua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZyA/IGtleWJpbmRpbmcua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZy5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpIHx8ICcnIDogJycsXG5cdFx0XHRjb21tYW5kOiBrZXliaW5kaW5nLmtleWJpbmRpbmdJdGVtLmNvbW1hbmRcblx0XHR9O1xuXHRcdGlmIChrZXliaW5kaW5nLmtleWJpbmRpbmdJdGVtLndoZW4pIHtcblx0XHRcdHVzZXJGcmllbmRseUtleWJpbmRpbmcud2hlbiA9IGtleWJpbmRpbmcua2V5YmluZGluZ0l0ZW0ud2hlbjtcblx0XHR9XG5cdFx0YXdhaXQgdGhpcy5jbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChKU09OLnN0cmluZ2lmeSh1c2VyRnJpZW5kbHlLZXliaW5kaW5nLCBudWxsLCAnICAnKSk7XG5cdH1cblxuXHRhc3luYyBjb3B5S2V5YmluZGluZ0NvbW1hbmQoa2V5YmluZGluZzogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnNlbGVjdEVudHJ5KGtleWJpbmRpbmcpO1xuXHRcdGF3YWl0IHRoaXMuY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoa2V5YmluZGluZy5rZXliaW5kaW5nSXRlbS5jb21tYW5kKTtcblx0fVxuXG5cdGFzeW5jIGNvcHlLZXliaW5kaW5nQ29tbWFuZFRpdGxlKGtleWJpbmRpbmc6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zZWxlY3RFbnRyeShrZXliaW5kaW5nKTtcblx0XHRhd2FpdCB0aGlzLmNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGtleWJpbmRpbmcua2V5YmluZGluZ0l0ZW0uY29tbWFuZExhYmVsKTtcblx0fVxuXG5cdGZvY3VzU2VhcmNoKCk6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHRzZWFyY2goZmlsdGVyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmZvY3VzU2VhcmNoKCk7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUoZmlsdGVyKTtcblx0XHR0aGlzLnNlbGVjdEVudHJ5KDApO1xuXHR9XG5cblx0Y2xlYXJTZWFyY2hSZXN1bHRzKCk6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmNsZWFyKCk7XG5cdH1cblxuXHRzaG93U2ltaWxhcktleWJpbmRpbmdzKGtleWJpbmRpbmdFbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IGBcIiR7a2V5YmluZGluZ0VudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcuZ2V0QXJpYUxhYmVsKCl9XCJgO1xuXHRcdGlmICh2YWx1ZSAhPT0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKSkge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUodmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQXJpYUxhYmVsRWxlbWVudChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5hcmlhTGFiZWxFbGVtZW50ID0gRE9NLmFwcGVuZChwYXJlbnQsIERPTS4kKCcnKSk7XG5cdFx0dGhpcy5hcmlhTGFiZWxFbGVtZW50LnNldEF0dHJpYnV0ZSgnaWQnLCAna2V5YmluZGluZ3MtZWRpdG9yLWFyaWEtbGFiZWwtZWxlbWVudCcpO1xuXHRcdHRoaXMuYXJpYUxhYmVsRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGl2ZScsICdhc3NlcnRpdmUnKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT3ZlcmxheUNvbnRhaW5lcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5vdmVybGF5Q29udGFpbmVyID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJy5vdmVybGF5LWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLm92ZXJsYXlDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMub3ZlcmxheUNvbnRhaW5lci5zdHlsZS56SW5kZXggPSAnNDAnOyAvLyBoYXMgdG8gZ3JlYXRlciB0aGFuIHNhc2ggei1pbmRleCB3aGljaCBpcyAzNVxuXHRcdHRoaXMuZGVmaW5lS2V5YmluZGluZ1dpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVmaW5lS2V5YmluZGluZ1dpZGdldCwgdGhpcy5vdmVybGF5Q29udGFpbmVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWZpbmVLZXliaW5kaW5nV2lkZ2V0Lm9uRGlkQ2hhbmdlKGtleWJpbmRpbmdTdHIgPT4gdGhpcy5kZWZpbmVLZXliaW5kaW5nV2lkZ2V0LnByaW50RXhpc3RpbmcodGhpcy5rZXliaW5kaW5nc0VkaXRvck1vZGVsIS5mZXRjaChgXCIke2tleWJpbmRpbmdTdHJ9XCJgKS5sZW5ndGgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWZpbmVLZXliaW5kaW5nV2lkZ2V0Lm9uU2hvd0V4aXN0aW5nS2V5YmlkaW5ncyhrZXliaW5kaW5nU3RyID0+IHRoaXMuc2VhcmNoV2lkZ2V0LnNldFZhbHVlKGBcIiR7a2V5YmluZGluZ1N0cn1cImApKSk7XG5cdFx0dGhpcy5oaWRlT3ZlcmxheUNvbnRhaW5lcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93T3ZlcmxheUNvbnRhaW5lcigpIHtcblx0XHR0aGlzLm92ZXJsYXlDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdH1cblxuXHRwcml2YXRlIGhpZGVPdmVybGF5Q29udGFpbmVyKCkge1xuXHRcdHRoaXMub3ZlcmxheUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVIZWFkZXIocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGVhZGVyQ29udGFpbmVyID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJy5rZXliaW5kaW5ncy1oZWFkZXInKSk7XG5cdFx0Y29uc3QgZnVsbFRleHRTZWFyY2hQbGFjZWhvbGRlciA9IGxvY2FsaXplKCdTZWFyY2hLZXliaW5kaW5ncy5GdWxsVGV4dFNlYXJjaFBsYWNlaG9sZGVyJywgXCJUeXBlIHRvIHNlYXJjaCBpbiBrZXliaW5kaW5nc1wiKTtcblx0XHRjb25zdCBrZXliaW5kaW5nc1NlYXJjaFBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ1NlYXJjaEtleWJpbmRpbmdzLktleWJpbmRpbmdzU2VhcmNoUGxhY2Vob2xkZXInLCBcIlJlY29yZGluZyBLZXlzLiBQcmVzcyBFc2NhcGUgdG8gZXhpdFwiKTtcblxuXHRcdGNvbnN0IGNsZWFySW5wdXRBY3Rpb24gPSBuZXcgQWN0aW9uKEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9SRVNVTFRTLCBsb2NhbGl6ZSgnY2xlYXJJbnB1dCcsIFwiQ2xlYXIgS2V5YmluZGluZ3MgU2VhcmNoIElucHV0XCIpLCBUaGVtZUljb24uYXNDbGFzc05hbWUocHJlZmVyZW5jZXNDbGVhcklucHV0SWNvbiksIGZhbHNlLCBhc3luYyAoKSA9PiB0aGlzLmNsZWFyU2VhcmNoUmVzdWx0cygpKTtcblxuXHRcdGNvbnN0IHNlYXJjaENvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5oZWFkZXJDb250YWluZXIsICQoJy5zZWFyY2gtY29udGFpbmVyJykpO1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShLZXliaW5kaW5nc1NlYXJjaFdpZGdldCwgc2VhcmNoQ29udGFpbmVyLCB7XG5cdFx0XHRhcmlhTGFiZWw6IGZ1bGxUZXh0U2VhcmNoUGxhY2Vob2xkZXIsXG5cdFx0XHRwbGFjZWhvbGRlcjogZnVsbFRleHRTZWFyY2hQbGFjZWhvbGRlcixcblx0XHRcdGZvY3VzS2V5OiB0aGlzLnNlYXJjaEZvY3VzQ29udGV4dEtleSxcblx0XHRcdGFyaWFMYWJlbGxlZEJ5OiAna2V5YmluZGluZ3MtZWRpdG9yLWFyaWEtbGFiZWwtZWxlbWVudCcsXG5cdFx0XHRyZWNvcmRFbnRlcjogdHJ1ZSxcblx0XHRcdHF1b3RlUmVjb3JkZWRLZXlzOiB0cnVlLFxuXHRcdFx0aGlzdG9yeTogbmV3IFNldDxzdHJpbmc+KHRoaXMuZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKVsnc2VhcmNoSGlzdG9yeSddID8/IFtdKSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBnZXRJbnB1dEJveFN0eWxlKHtcblx0XHRcdFx0aW5wdXRCb3JkZXI6IHNldHRpbmdzVGV4dElucHV0Qm9yZGVyXG5cdFx0XHR9KVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vbkRpZENoYW5nZShzZWFyY2hWYWx1ZSA9PiB7XG5cdFx0XHRjbGVhcklucHV0QWN0aW9uLmVuYWJsZWQgPSAhIXNlYXJjaFZhbHVlO1xuXHRcdFx0dGhpcy5kZWxheWVkRmlsdGVyaW5nLnRyaWdnZXIoKCkgPT4gdGhpcy5maWx0ZXJLZXliaW5kaW5ncygpKTtcblx0XHRcdHRoaXMudXBkYXRlU2VhcmNoT3B0aW9ucygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vbkVzY2FwZSgoKSA9PiB0aGlzLnJlY29yZEtleXNBY3Rpb24uY2hlY2tlZCA9IGZhbHNlKSk7XG5cblx0XHR0aGlzLmFjdGlvbnNDb250YWluZXIgPSBET00uYXBwZW5kKHNlYXJjaENvbnRhaW5lciwgRE9NLiQoJy5rZXliaW5kaW5ncy1zZWFyY2gtYWN0aW9ucy1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgcmVjb3JkaW5nQmFkZ2UgPSB0aGlzLmNyZWF0ZVJlY29yZGluZ0JhZGdlKHRoaXMuYWN0aW9uc0NvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNvcnRCeVByZWNlZGVuY2VBY3Rpb24ub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZS5jaGVja2VkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJLZXliaW5kaW5nc0VudHJpZXMoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVTZWFyY2hPcHRpb25zKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZWNvcmRLZXlzQWN0aW9uLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuY2hlY2tlZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJlY29yZGluZ0JhZGdlLmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgIWUuY2hlY2tlZCk7XG5cdFx0XHRcdGlmIChlLmNoZWNrZWQpIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5zZXRQbGFjZUhvbGRlcihrZXliaW5kaW5nc1NlYXJjaFBsYWNlaG9sZGVyKTtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5zZXRBcmlhTGFiZWwoa2V5YmluZGluZ3NTZWFyY2hQbGFjZWhvbGRlcik7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc3RhcnRSZWNvcmRpbmdLZXlzKCk7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuZm9jdXMoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5zZXRQbGFjZUhvbGRlcihmdWxsVGV4dFNlYXJjaFBsYWNlaG9sZGVyKTtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5zZXRBcmlhTGFiZWwoZnVsbFRleHRTZWFyY2hQbGFjZWhvbGRlcik7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc3RvcFJlY29yZGluZ0tleXMoKTtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRlU2VhcmNoT3B0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGFjdGlvbnMgPSBbdGhpcy5yZWNvcmRLZXlzQWN0aW9uLCB0aGlzLnNvcnRCeVByZWNlZGVuY2VBY3Rpb24sIGNsZWFySW5wdXRBY3Rpb25dO1xuXHRcdGNvbnN0IHRvb2xCYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVG9vbEJhcih0aGlzLmFjdGlvbnNDb250YWluZXIsIHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IHRoaXMuc29ydEJ5UHJlY2VkZW5jZUFjdGlvbi5pZCB8fCBhY3Rpb24uaWQgPT09IHRoaXMucmVjb3JkS2V5c0FjdGlvbi5pZCkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgVG9nZ2xlQWN0aW9uVmlld0l0ZW0obnVsbCwgYWN0aW9uLCB7IC4uLm9wdGlvbnMsIGtleWJpbmRpbmc6IHRoaXMua2V5YmluZGluZ3NTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKT8uZ2V0TGFiZWwoKSwgdG9nZ2xlU3R5bGVzOiBkZWZhdWx0VG9nZ2xlU3R5bGVzIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0S2V5QmluZGluZzogYWN0aW9uID0+IHRoaXMua2V5YmluZGluZ3NTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKVxuXHRcdH0pKTtcblx0XHR0b29sQmFyLnNldEFjdGlvbnMoYWN0aW9ucyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5rZXliaW5kaW5nc1NlcnZpY2Uub25EaWRVcGRhdGVLZXliaW5kaW5ncygoKSA9PiB0b29sQmFyLnNldEFjdGlvbnMoYWN0aW9ucykpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2VhcmNoT3B0aW9ucygpOiB2b2lkIHtcblx0XHRjb25zdCBrZXliaW5kaW5nc0VkaXRvcklucHV0ID0gdGhpcy5pbnB1dCBhcyBLZXliaW5kaW5nc0VkaXRvcklucHV0O1xuXHRcdGlmIChrZXliaW5kaW5nc0VkaXRvcklucHV0KSB7XG5cdFx0XHRrZXliaW5kaW5nc0VkaXRvcklucHV0LnNlYXJjaE9wdGlvbnMgPSB7XG5cdFx0XHRcdHNlYXJjaFZhbHVlOiB0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRyZWNvcmRLZXliaW5kaW5nczogISF0aGlzLnJlY29yZEtleXNBY3Rpb24uY2hlY2tlZCxcblx0XHRcdFx0c29ydEJ5UHJlY2VkZW5jZTogISF0aGlzLnNvcnRCeVByZWNlZGVuY2VBY3Rpb24uY2hlY2tlZFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVJlY29yZGluZ0JhZGdlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgcmVjb3JkaW5nQmFkZ2UgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5yZWNvcmRpbmctYmFkZ2UubW9uYWNvLWNvdW50LWJhZGdlLmxvbmcuZGlzYWJsZWQnKSk7XG5cdFx0cmVjb3JkaW5nQmFkZ2UudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgncmVjb3JkaW5nJywgXCJSZWNvcmRpbmcgS2V5c1wiKTtcblxuXHRcdHJlY29yZGluZ0JhZGdlLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGFzQ3NzVmFyaWFibGUoYmFkZ2VCYWNrZ3JvdW5kKTtcblx0XHRyZWNvcmRpbmdCYWRnZS5zdHlsZS5jb2xvciA9IGFzQ3NzVmFyaWFibGUoYmFkZ2VGb3JlZ3JvdW5kKTtcblx0XHRyZWNvcmRpbmdCYWRnZS5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShjb250cmFzdEJvcmRlcil9YDtcblxuXHRcdHJldHVybiByZWNvcmRpbmdCYWRnZTtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0U2VhcmNoV2lkZ2V0KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmxheW91dChkaW1lbnNpb24pO1xuXHRcdHRoaXMuaGVhZGVyQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3NtYWxsJywgZGltZW5zaW9uLndpZHRoIDwgNDAwKTtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5pbnB1dEVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gYCR7RE9NLmdldFRvdGFsV2lkdGgodGhpcy5hY3Rpb25zQ29udGFpbmVyKSArIDEyfXB4YDtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgYm9keUNvbnRhaW5lciA9IERPTS5hcHBlbmQocGFyZW50LCAkKCcua2V5YmluZGluZ3MtYm9keScpKTtcblx0XHR0aGlzLmNyZWF0ZVRhYmxlKGJvZHlDb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUYWJsZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5rZXliaW5kaW5nc1RhYmxlQ29udGFpbmVyID0gRE9NLmFwcGVuZChwYXJlbnQsICQoJy5rZXliaW5kaW5ncy10YWJsZS1jb250YWluZXInKSk7XG5cdFx0dGhpcy5rZXliaW5kaW5nc1RhYmxlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUYWJsZSxcblx0XHRcdCdLZXliaW5kaW5nc0VkaXRvcicsXG5cdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGVDb250YWluZXIsXG5cdFx0XHRuZXcgRGVsZWdhdGUoKSxcblx0XHRcdFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDAsXG5cdFx0XHRcdFx0bWluaW11bVdpZHRoOiA0MCxcblx0XHRcdFx0XHRtYXhpbXVtV2lkdGg6IDQwLFxuXHRcdFx0XHRcdHRlbXBsYXRlSWQ6IEFjdGlvbnNDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRCxcblx0XHRcdFx0XHRwcm9qZWN0KHJvdzogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBJS2V5YmluZGluZ0l0ZW1FbnRyeSB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY29tbWFuZCcsIFwiQ29tbWFuZFwiKSxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDAuMyxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBDb21tYW5kQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUtleWJpbmRpbmdJdGVtRW50cnkgeyByZXR1cm4gcm93OyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2tleWJpbmRpbmcnLCBcIktleWJpbmRpbmdcIiksXG5cdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0d2VpZ2h0OiAwLjIsXG5cdFx0XHRcdFx0dGVtcGxhdGVJZDogS2V5YmluZGluZ0NvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IElLZXliaW5kaW5nSXRlbUVudHJ5IHsgcmV0dXJuIHJvdzsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd3aGVuJywgXCJXaGVuXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogMC4zNSxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBXaGVuQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUtleWJpbmRpbmdJdGVtRW50cnkgeyByZXR1cm4gcm93OyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3NvdXJjZScsIFwiU291cmNlXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogMC4xNSxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBTb3VyY2VDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRCxcblx0XHRcdFx0XHRwcm9qZWN0KHJvdzogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBJS2V5YmluZGluZ0l0ZW1FbnRyeSB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aW9uc0NvbHVtblJlbmRlcmVyLCB0aGlzKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21tYW5kQ29sdW1uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdDb2x1bW5SZW5kZXJlciksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2hlbkNvbHVtblJlbmRlcmVyLCB0aGlzKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VDb2x1bW5SZW5kZXJlciksXG5cdFx0XHRdLFxuXHRcdFx0e1xuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7IGdldElkOiAoZTogSUtleWJpbmRpbmdJdGVtRW50cnkpID0+IGUuaWQgfSxcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IEFjY2Vzc2liaWxpdHlQcm92aWRlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSxcblx0XHRcdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjogeyBnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbDogKGU6IElLZXliaW5kaW5nSXRlbUVudHJ5KSA9PiBlLmtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCB8fCBlLmtleWJpbmRpbmdJdGVtLmNvbW1hbmQgfSxcblx0XHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0XHRsaXN0QmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0b3Blbk9uU2luZ2xlQ2xpY2s6IGZhbHNlLFxuXHRcdFx0XHR0cmFuc2Zvcm1PcHRpbWl6YXRpb246IGZhbHNlIC8vIGRpc2FibGUgdHJhbnNmb3JtIG9wdGltaXphdGlvbiBhcyBpdCBjYXVzZXMgdGhlIGVkaXRvciBvdmVyZmxvdyB3aWRnZXRzIHRvIGJlIG1pc3Bvc2l0aW9uZWRcblx0XHRcdH1cblx0XHQpKSBhcyBXb3JrYmVuY2hUYWJsZTxJS2V5YmluZGluZ0l0ZW1FbnRyeT47XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmtleWJpbmRpbmdzVGFibGUub25Db250ZXh0TWVudShlID0+IHRoaXMub25Db250ZXh0TWVudShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMua2V5YmluZGluZ3NUYWJsZS5vbkRpZENoYW5nZUZvY3VzKGUgPT4gdGhpcy5vbkZvY3VzQ2hhbmdlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmtleWJpbmRpbmdzVGFibGUub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGUuZ2V0SFRNTEVsZW1lbnQoKS5jbGFzc0xpc3QuYWRkKCdmb2N1c2VkJyk7XG5cdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5rZXliaW5kaW5nc1RhYmxlLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGUuZ2V0SFRNTEVsZW1lbnQoKS5jbGFzc0xpc3QucmVtb3ZlKCdmb2N1c2VkJyk7XG5cdFx0XHR0aGlzLmtleWJpbmRpbmdGb2N1c0NvbnRleHRLZXkucmVzZXQoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5rZXliaW5kaW5nc1RhYmxlLm9uRGlkT3BlbigoZSkgPT4ge1xuXHRcdFx0Ly8gc3RvcCBkb3VibGUgY2xpY2sgYWN0aW9uIG9uIHRoZSBpbnB1dCAjMTQ4NDkzXG5cdFx0XHRpZiAoZS5icm93c2VyRXZlbnQ/LmRlZmF1bHRQcmV2ZW50ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWN0aXZlS2V5YmluZGluZ0VudHJ5ID0gdGhpcy5hY3RpdmVLZXliaW5kaW5nRW50cnk7XG5cdFx0XHRpZiAoYWN0aXZlS2V5YmluZGluZ0VudHJ5KSB7XG5cdFx0XHRcdHRoaXMuZGVmaW5lS2V5YmluZGluZyhhY3RpdmVLZXliaW5kaW5nRW50cnksIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRET00uYXBwZW5kKHRoaXMua2V5YmluZGluZ3NUYWJsZUNvbnRhaW5lciwgdGhpcy5vdmVyZmxvd1dpZGdldHNEb21Ob2RlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyKHByZXNlcnZlRm9jdXM6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pbnB1dCkge1xuXHRcdFx0Y29uc3QgaW5wdXQ6IEtleWJpbmRpbmdzRWRpdG9ySW5wdXQgPSB0aGlzLmlucHV0IGFzIEtleWJpbmRpbmdzRWRpdG9ySW5wdXQ7XG5cdFx0XHR0aGlzLmtleWJpbmRpbmdzRWRpdG9yTW9kZWwgPSBhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCB0aGlzLmtleWJpbmRpbmdzRWRpdG9yTW9kZWwucmVzb2x2ZSh0aGlzLmdldEFjdGlvbnNMYWJlbHMoKSk7XG5cdFx0XHR0aGlzLnJlbmRlcktleWJpbmRpbmdzRW50cmllcyhmYWxzZSwgcHJlc2VydmVGb2N1cyk7XG5cdFx0XHRpZiAoaW5wdXQuc2VhcmNoT3B0aW9ucykge1xuXHRcdFx0XHR0aGlzLnJlY29yZEtleXNBY3Rpb24uY2hlY2tlZCA9IGlucHV0LnNlYXJjaE9wdGlvbnMucmVjb3JkS2V5YmluZGluZ3M7XG5cdFx0XHRcdHRoaXMuc29ydEJ5UHJlY2VkZW5jZUFjdGlvbi5jaGVja2VkID0gaW5wdXQuc2VhcmNoT3B0aW9ucy5zb3J0QnlQcmVjZWRlbmNlO1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZShpbnB1dC5zZWFyY2hPcHRpb25zLnNlYXJjaFZhbHVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU2VhcmNoT3B0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aW9uc0xhYmVscygpOiBNYXA8c3RyaW5nLCBzdHJpbmc+IHtcblx0XHRjb25zdCBhY3Rpb25zTGFiZWxzOiBNYXA8c3RyaW5nLCBzdHJpbmc+ID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRmb3IgKGNvbnN0IGVkaXRvckFjdGlvbiBvZiBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0RWRpdG9yQWN0aW9ucygpKSB7XG5cdFx0XHRhY3Rpb25zTGFiZWxzLnNldChlZGl0b3JBY3Rpb24uaWQsIGVkaXRvckFjdGlvbi5sYWJlbCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgbWVudUl0ZW0gb2YgTWVudVJlZ2lzdHJ5LmdldE1lbnVJdGVtcyhNZW51SWQuQ29tbWFuZFBhbGV0dGUpKSB7XG5cdFx0XHRpZiAoaXNJTWVudUl0ZW0obWVudUl0ZW0pKSB7XG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gdHlwZW9mIG1lbnVJdGVtLmNvbW1hbmQudGl0bGUgPT09ICdzdHJpbmcnID8gbWVudUl0ZW0uY29tbWFuZC50aXRsZSA6IG1lbnVJdGVtLmNvbW1hbmQudGl0bGUudmFsdWU7XG5cdFx0XHRcdGNvbnN0IGNhdGVnb3J5ID0gbWVudUl0ZW0uY29tbWFuZC5jYXRlZ29yeSA/IHR5cGVvZiBtZW51SXRlbS5jb21tYW5kLmNhdGVnb3J5ID09PSAnc3RyaW5nJyA/IG1lbnVJdGVtLmNvbW1hbmQuY2F0ZWdvcnkgOiBtZW51SXRlbS5jb21tYW5kLmNhdGVnb3J5LnZhbHVlIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRhY3Rpb25zTGFiZWxzLnNldChtZW51SXRlbS5jb21tYW5kLmlkLCBjYXRlZ29yeSA/IGAke2NhdGVnb3J5fTogJHt0aXRsZX1gIDogdGl0bGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gYWN0aW9uc0xhYmVscztcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyS2V5YmluZGluZ3MoKTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJLZXliaW5kaW5nc0VudHJpZXModGhpcy5zZWFyY2hXaWRnZXQuaGFzRm9jdXMoKSk7XG5cdFx0dGhpcy5zZWFyY2hIaXN0b3J5RGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmlucHV0Qm94LmFkZFRvSGlzdG9yeSgpO1xuXHRcdFx0dGhpcy5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpWydzZWFyY2hIaXN0b3J5J10gPSB0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5nZXRIaXN0b3J5KCk7XG5cdFx0XHR0aGlzLnNhdmVTdGF0ZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGNsZWFyS2V5Ym9hcmRTaG9ydGN1dFNlYXJjaEhpc3RvcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuaW5wdXRCb3guY2xlYXJIaXN0b3J5KCk7XG5cdFx0dGhpcy5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpWydzZWFyY2hIaXN0b3J5J10gPSB0aGlzLnNlYXJjaFdpZGdldC5pbnB1dEJveC5nZXRIaXN0b3J5KCk7XG5cdFx0dGhpcy5zYXZlU3RhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyS2V5YmluZGluZ3NFbnRyaWVzKHJlc2V0OiBib29sZWFuLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmtleWJpbmRpbmdzRWRpdG9yTW9kZWwpIHtcblx0XHRcdGNvbnN0IGZpbHRlciA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCk7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nc0VudHJpZXM6IElLZXliaW5kaW5nSXRlbUVudHJ5W10gPSB0aGlzLmtleWJpbmRpbmdzRWRpdG9yTW9kZWwuZmV0Y2goZmlsdGVyLCB0aGlzLnNvcnRCeVByZWNlZGVuY2VBY3Rpb24uY2hlY2tlZCk7XG5cdFx0XHR0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmFsZXJ0KGxvY2FsaXplKCdmb3VuZFJlc3VsdHMnLCBcInswfSByZXN1bHRzXCIsIGtleWJpbmRpbmdzRW50cmllcy5sZW5ndGgpKTtcblx0XHRcdHRoaXMuYXJpYUxhYmVsRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aGlzLmdldEFyaWFMYWJlbChrZXliaW5kaW5nc0VudHJpZXMpKTtcblxuXHRcdFx0aWYgKGtleWJpbmRpbmdzRW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5sYXRlc3RFbXB0eUZpbHRlcnMucHVzaChmaWx0ZXIpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY3VycmVudFNlbGVjdGVkSW5kZXggPSB0aGlzLmtleWJpbmRpbmdzVGFibGUuZ2V0U2VsZWN0aW9uKClbMF07XG5cdFx0XHR0aGlzLnRhYmxlRW50cmllcyA9IGtleWJpbmRpbmdzRW50cmllcztcblx0XHRcdHRoaXMua2V5YmluZGluZ3NUYWJsZS5zcGxpY2UoMCwgdGhpcy5rZXliaW5kaW5nc1RhYmxlLmxlbmd0aCwgdGhpcy50YWJsZUVudHJpZXMpO1xuXHRcdFx0dGhpcy5sYXlvdXRLZXliaW5kaW5nc1RhYmxlKCk7XG5cblx0XHRcdGlmIChyZXNldCkge1xuXHRcdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGUuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHRcdFx0dGhpcy5rZXliaW5kaW5nc1RhYmxlLnNldEZvY3VzKFtdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLnVuQXNzaWduZWRLZXliaW5kaW5nSXRlbVRvUmV2ZWFsQW5kRm9jdXMpIHtcblx0XHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0TmV3SW5kZXhPZlVuYXNzaWduZWRLZXliaW5kaW5nKHRoaXMudW5Bc3NpZ25lZEtleWJpbmRpbmdJdGVtVG9SZXZlYWxBbmRGb2N1cyk7XG5cdFx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0dGhpcy5rZXliaW5kaW5nc1RhYmxlLnJldmVhbChpbmRleCwgMC4yKTtcblx0XHRcdFx0XHRcdHRoaXMuc2VsZWN0RW50cnkoaW5kZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnVuQXNzaWduZWRLZXliaW5kaW5nSXRlbVRvUmV2ZWFsQW5kRm9jdXMgPSBudWxsO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGN1cnJlbnRTZWxlY3RlZEluZGV4ICE9PSAtMSAmJiBjdXJyZW50U2VsZWN0ZWRJbmRleCA8IHRoaXMudGFibGVFbnRyaWVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0RW50cnkoY3VycmVudFNlbGVjdGVkSW5kZXgsIHByZXNlcnZlRm9jdXMpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lID09PSB0aGlzICYmICFwcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRBcmlhTGFiZWwoa2V5YmluZGluZ3NFbnRyaWVzOiBJS2V5YmluZGluZ0l0ZW1FbnRyeVtdKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5zb3J0QnlQcmVjZWRlbmNlQWN0aW9uLmNoZWNrZWQpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc2hvdyBzb3J0ZWQga2V5YmluZGluZ3MnLCBcIlNob3dpbmcgezB9IEtleWJpbmRpbmdzIGluIHByZWNlZGVuY2Ugb3JkZXJcIiwga2V5YmluZGluZ3NFbnRyaWVzLmxlbmd0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc2hvdyBrZXliaW5kaW5ncycsIFwiU2hvd2luZyB7MH0gS2V5YmluZGluZ3MgaW4gYWxwaGFiZXRpY2FsIG9yZGVyXCIsIGtleWJpbmRpbmdzRW50cmllcy5sZW5ndGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0S2V5YmluZGluZ3NUYWJsZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFibGVIZWlnaHQgPSB0aGlzLmRpbWVuc2lvbi5oZWlnaHQgLSAoRE9NLmdldERvbU5vZGVQYWdlUG9zaXRpb24odGhpcy5oZWFkZXJDb250YWluZXIpLmhlaWdodCArIDEyIC8qcGFkZGluZyovKTtcblx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGVDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGFibGVIZWlnaHR9cHhgO1xuXHRcdHRoaXMua2V5YmluZGluZ3NUYWJsZS5sYXlvdXQodGFibGVIZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbmRleE9mKGxpc3RFbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBudW1iZXIge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy50YWJsZUVudHJpZXMuaW5kZXhPZihsaXN0RW50cnkpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy50YWJsZUVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMudGFibGVFbnRyaWVzW2ldLmlkID09PSBsaXN0RW50cnkuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gaW5kZXg7XG5cdH1cblxuXHRwcml2YXRlIGdldE5ld0luZGV4T2ZVbmFzc2lnbmVkS2V5YmluZGluZyh1bmFzc2lnbmVkS2V5YmluZGluZzogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBudW1iZXIge1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnRhYmxlRW50cmllcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy50YWJsZUVudHJpZXNbaW5kZXhdO1xuXHRcdFx0aWYgKGVudHJ5LnRlbXBsYXRlSWQgPT09IEtFWUJJTkRJTkdfRU5UUllfVEVNUExBVEVfSUQpIHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZ0l0ZW1FbnRyeSA9ICg8SUtleWJpbmRpbmdJdGVtRW50cnk+ZW50cnkpO1xuXHRcdFx0XHRpZiAoa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS5jb21tYW5kID09PSB1bmFzc2lnbmVkS2V5YmluZGluZy5rZXliaW5kaW5nSXRlbS5jb21tYW5kKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdHByaXZhdGUgc2VsZWN0RW50cnkoa2V5YmluZGluZ0l0ZW1FbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkgfCBudW1iZXIsIGZvY3VzOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdHlwZW9mIGtleWJpbmRpbmdJdGVtRW50cnkgPT09ICdudW1iZXInID8ga2V5YmluZGluZ0l0ZW1FbnRyeSA6IHRoaXMuZ2V0SW5kZXhPZihrZXliaW5kaW5nSXRlbUVudHJ5KTtcblx0XHRpZiAoaW5kZXggIT09IC0xICYmIGluZGV4IDwgdGhpcy5rZXliaW5kaW5nc1RhYmxlLmxlbmd0aCkge1xuXHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdHRoaXMua2V5YmluZGluZ3NUYWJsZS5kb21Gb2N1cygpO1xuXHRcdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGUuc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmtleWJpbmRpbmdzVGFibGUuc2V0U2VsZWN0aW9uKFtpbmRleF0pO1xuXHRcdH1cblx0fVxuXG5cdGZvY3VzS2V5YmluZGluZ3MoKTogdm9pZCB7XG5cdFx0dGhpcy5rZXliaW5kaW5nc1RhYmxlLmRvbUZvY3VzKCk7XG5cdFx0Y29uc3QgY3VycmVudEZvY3VzSW5kaWNlcyA9IHRoaXMua2V5YmluZGluZ3NUYWJsZS5nZXRGb2N1cygpO1xuXHRcdHRoaXMua2V5YmluZGluZ3NUYWJsZS5zZXRGb2N1cyhbY3VycmVudEZvY3VzSW5kaWNlcy5sZW5ndGggPyBjdXJyZW50Rm9jdXNJbmRpY2VzWzBdIDogMF0pO1xuXHR9XG5cblx0c2VsZWN0S2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZ0l0ZW1FbnRyeSk7XG5cdH1cblxuXHRyZWNvcmRTZWFyY2hLZXlzKCk6IHZvaWQge1xuXHRcdHRoaXMucmVjb3JkS2V5c0FjdGlvbi5jaGVja2VkID0gdHJ1ZTtcblx0fVxuXG5cdHRvZ2dsZVNvcnRCeVByZWNlZGVuY2UoKTogdm9pZCB7XG5cdFx0dGhpcy5zb3J0QnlQcmVjZWRlbmNlQWN0aW9uLmNoZWNrZWQgPSAhdGhpcy5zb3J0QnlQcmVjZWRlbmNlQWN0aW9uLmNoZWNrZWQ7XG5cdH1cblxuXHRwcml2YXRlIG9uQ29udGV4dE1lbnUoZTogSUxpc3RDb250ZXh0TWVudUV2ZW50PElLZXliaW5kaW5nSXRlbUVudHJ5Pik6IHZvaWQge1xuXHRcdGlmICghZS5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGUuZWxlbWVudC50ZW1wbGF0ZUlkID09PSBLRVlCSU5ESU5HX0VOVFJZX1RFTVBMQVRFX0lEKSB7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nSXRlbUVudHJ5ID0gPElLZXliaW5kaW5nSXRlbUVudHJ5PmUuZWxlbWVudDtcblx0XHRcdHRoaXMuc2VsZWN0RW50cnkoa2V5YmluZGluZ0l0ZW1FbnRyeSk7XG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBbXG5cdFx0XHRcdFx0dGhpcy5jcmVhdGVDb3B5QWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpLFxuXHRcdFx0XHRcdHRoaXMuY3JlYXRlQ29weUNvbW1hbmRBY3Rpb24oa2V5YmluZGluZ0l0ZW1FbnRyeSksXG5cdFx0XHRcdFx0dGhpcy5jcmVhdGVDb3B5Q29tbWFuZFRpdGxlQWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpLFxuXHRcdFx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdFx0XHQuLi4oa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nXG5cdFx0XHRcdFx0XHQ/IFt0aGlzLmNyZWF0ZURlZmluZUtleWJpbmRpbmdBY3Rpb24oa2V5YmluZGluZ0l0ZW1FbnRyeSksIHRoaXMuY3JlYXRlQWRkS2V5YmluZGluZ0FjdGlvbihrZXliaW5kaW5nSXRlbUVudHJ5KV1cblx0XHRcdFx0XHRcdDogW3RoaXMuY3JlYXRlRGVmaW5lS2V5YmluZGluZ0FjdGlvbihrZXliaW5kaW5nSXRlbUVudHJ5KV0pLFxuXHRcdFx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZVJlbW92ZUFjdGlvbihrZXliaW5kaW5nSXRlbUVudHJ5KSxcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZVJlc2V0QWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpLFxuXHRcdFx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZURlZmluZVdoZW5FeHByZXNzaW9uQWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpLFxuXHRcdFx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZVNob3dDb25mbGljdHNBY3Rpb24oa2V5YmluZGluZ0l0ZW1FbnRyeSldXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRm9jdXNDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5rZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMua2V5YmluZGluZ3NUYWJsZS5nZXRGb2N1c2VkRWxlbWVudHMoKVswXTtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQudGVtcGxhdGVJZCA9PT0gS0VZQklORElOR19FTlRSWV9URU1QTEFURV9JRCkge1xuXHRcdFx0dGhpcy5rZXliaW5kaW5nRm9jdXNDb250ZXh0S2V5LnNldCh0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZURlZmluZUtleWJpbmRpbmdBY3Rpb24oa2V5YmluZGluZ0l0ZW1FbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBJQWN0aW9uIHtcblx0XHRyZXR1cm4gPElBY3Rpb24+e1xuXHRcdFx0bGFiZWw6IGtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZyA/IGxvY2FsaXplKCdjaGFuZ2VMYWJlbCcsIFwiQ2hhbmdlIEtleWJpbmRpbmcuLi5cIikgOiBsb2NhbGl6ZSgnYWRkTGFiZWwnLCBcIkFkZCBLZXliaW5kaW5nLi4uXCIpLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9ERUZJTkUsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZGVmaW5lS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5LCBmYWxzZSlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVBZGRLZXliaW5kaW5nQWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnYWRkTGFiZWwnLCBcIkFkZCBLZXliaW5kaW5nLi4uXCIpLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9BREQsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZGVmaW5lS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5LCB0cnVlKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZURlZmluZVdoZW5FeHByZXNzaW9uQWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZWRpdFdoZW4nLCBcIkNoYW5nZSBXaGVuIEV4cHJlc3Npb25cIiksXG5cdFx0XHRlbmFibGVkOiAhIWtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZyxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9ERUZJTkVfV0hFTixcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5kZWZpbmVXaGVuRXhwcmVzc2lvbihrZXliaW5kaW5nSXRlbUVudHJ5KVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVJlbW92ZUFjdGlvbihrZXliaW5kaW5nSXRlbTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBJQWN0aW9uIHtcblx0XHRyZXR1cm4gPElBY3Rpb24+e1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZW1vdmVMYWJlbCcsIFwiUmVtb3ZlIEtleWJpbmRpbmdcIiksXG5cdFx0XHRlbmFibGVkOiAhIWtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcsXG5cdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVNT1ZFLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLnJlbW92ZUtleWJpbmRpbmcoa2V5YmluZGluZ0l0ZW0pXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVzZXRBY3Rpb24oa2V5YmluZGluZ0l0ZW06IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncmVzZXRMYWJlbCcsIFwiUmVzZXQgS2V5YmluZGluZ1wiKSxcblx0XHRcdGVuYWJsZWQ6ICFrZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nSXRlbS5pc0RlZmF1bHQsXG5cdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVTRVQsXG5cdFx0XHRydW46ICgpID0+IHRoaXMucmVzZXRLZXliaW5kaW5nKGtleWJpbmRpbmdJdGVtKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVNob3dDb25mbGljdHNBY3Rpb24oa2V5YmluZGluZ0l0ZW06IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2hvd1NhbWVLZXliaW5kaW5ncycsIFwiU2hvdyBTYW1lIEtleWJpbmRpbmdzXCIpLFxuXHRcdFx0ZW5hYmxlZDogISFrZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nLFxuXHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1NIT1dfU0lNSUxBUixcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5zaG93U2ltaWxhcktleWJpbmRpbmdzKGtleWJpbmRpbmdJdGVtKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvcHlBY3Rpb24oa2V5YmluZGluZ0l0ZW06IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY29weUxhYmVsJywgXCJDb3B5XCIpLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DT1BZLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvcHlLZXliaW5kaW5nKGtleWJpbmRpbmdJdGVtKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvcHlDb21tYW5kQWN0aW9uKGtleWJpbmRpbmc6IElLZXliaW5kaW5nSXRlbUVudHJ5KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY29weUNvbW1hbmRMYWJlbCcsIFwiQ29weSBDb21tYW5kIElEXCIpLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DT1BZX0NPTU1BTkQsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuY29weUtleWJpbmRpbmdDb21tYW5kKGtleWJpbmRpbmcpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ29weUNvbW1hbmRUaXRsZUFjdGlvbihrZXliaW5kaW5nOiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IElBY3Rpb24ge1xuXHRcdHJldHVybiA8SUFjdGlvbj57XG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NvcHlDb21tYW5kVGl0bGVMYWJlbCcsIFwiQ29weSBDb21tYW5kIFRpdGxlXCIpLFxuXHRcdFx0ZW5hYmxlZDogISFrZXliaW5kaW5nLmtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCxcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DT1BZX0NPTU1BTkRfVElUTEUsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuY29weUtleWJpbmRpbmdDb21tYW5kVGl0bGUoa2V5YmluZGluZylcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBvbktleWJpbmRpbmdFZGl0aW5nRXJyb3IoZXJyb3I6IGFueSk6IHZvaWQge1xuXHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcih0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnID8gZXJyb3IgOiBsb2NhbGl6ZSgnZXJyb3InLCBcIkVycm9yICd7MH0nIHdoaWxlIGVkaXRpbmcgdGhlIGtleWJpbmRpbmcuIFBsZWFzZSBvcGVuICdrZXliaW5kaW5ncy5qc29uJyBmaWxlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlwiLCBgJHtlcnJvcn1gKSk7XG5cdH1cbn1cblxuY2xhc3MgRGVsZWdhdGUgaW1wbGVtZW50cyBJVGFibGVWaXJ0dWFsRGVsZWdhdGU8SUtleWJpbmRpbmdJdGVtRW50cnk+IHtcblxuXHRyZWFkb25seSBoZWFkZXJSb3dIZWlnaHQgPSAzMDtcblxuXHRnZXRIZWlnaHQoZWxlbWVudDogSUtleWJpbmRpbmdJdGVtRW50cnkpIHtcblx0XHRpZiAoZWxlbWVudC50ZW1wbGF0ZUlkID09PSBLRVlCSU5ESU5HX0VOVFJZX1RFTVBMQVRFX0lEKSB7XG5cdFx0XHRjb25zdCBjb21tYW5kSWRNYXRjaGVkID0gKDxJS2V5YmluZGluZ0l0ZW1FbnRyeT5lbGVtZW50KS5rZXliaW5kaW5nSXRlbS5jb21tYW5kTGFiZWwgJiYgKDxJS2V5YmluZGluZ0l0ZW1FbnRyeT5lbGVtZW50KS5jb21tYW5kSWRNYXRjaGVzO1xuXHRcdFx0Y29uc3QgY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZWQgPSAhISg8SUtleWJpbmRpbmdJdGVtRW50cnk+ZWxlbWVudCkuY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZXM7XG5cdFx0XHRjb25zdCBleHRlbnNpb25JZE1hdGNoZWQgPSAhISg8SUtleWJpbmRpbmdJdGVtRW50cnk+ZWxlbWVudCkuZXh0ZW5zaW9uSWRNYXRjaGVzO1xuXHRcdFx0aWYgKGNvbW1hbmRJZE1hdGNoZWQgJiYgY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZWQpIHtcblx0XHRcdFx0cmV0dXJuIDYwO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbklkTWF0Y2hlZCB8fCBjb21tYW5kSWRNYXRjaGVkIHx8IGNvbW1hbmREZWZhdWx0TGFiZWxNYXRjaGVkKSB7XG5cdFx0XHRcdHJldHVybiA0MDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIDI0O1xuXHR9XG5cbn1cblxuaW50ZXJmYWNlIElBY3Rpb25zQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgYWN0aW9uQmFyOiBBY3Rpb25CYXI7XG59XG5cbmNsYXNzIEFjdGlvbnNDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPElLZXliaW5kaW5nSXRlbUVudHJ5LCBJQWN0aW9uc0NvbHVtblRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdhY3Rpb25zJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSBBY3Rpb25zQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nc0VkaXRvcjogS2V5YmluZGluZ3NFZGl0b3IsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdzU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElBY3Rpb25zQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBlbGVtZW50ID0gRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5hY3Rpb25zJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IG5ldyBBY3Rpb25CYXIoZWxlbWVudCk7XG5cdFx0cmV0dXJuIHsgYWN0aW9uQmFyIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGtleWJpbmRpbmdJdGVtRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25zQ29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRpZiAoa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2godGhpcy5jcmVhdGVFZGl0QWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWN0aW9ucy5wdXNoKHRoaXMuY3JlYXRlQWRkQWN0aW9uKGtleWJpbmRpbmdJdGVtRW50cnkpKTtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5wdXNoKGFjdGlvbnMsIHsgaWNvbjogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRWRpdEFjdGlvbihrZXliaW5kaW5nSXRlbUVudHJ5OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSk6IElBY3Rpb24ge1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdzU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0RFRklORSk7XG5cdFx0cmV0dXJuIDxJQWN0aW9uPntcblx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoa2V5YmluZGluZ3NFZGl0SWNvbiksXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdlZGl0S2V5YmluZGluZycsXG5cdFx0XHR0b29sdGlwOiBrZXliaW5kaW5nID8gbG9jYWxpemUoJ2VkaXRLZXliaW5kaW5nTGFiZWxXaXRoS2V5JywgXCJDaGFuZ2UgS2V5YmluZGluZyB7MH1cIiwgYCgke2tleWJpbmRpbmcuZ2V0TGFiZWwoKX0pYCkgOiBsb2NhbGl6ZSgnZWRpdEtleWJpbmRpbmdMYWJlbCcsIFwiQ2hhbmdlIEtleWJpbmRpbmdcIiksXG5cdFx0XHRydW46ICgpID0+IHRoaXMua2V5YmluZGluZ3NFZGl0b3IuZGVmaW5lS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5LCBmYWxzZSlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVBZGRBY3Rpb24oa2V5YmluZGluZ0l0ZW1FbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBJQWN0aW9uIHtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nc1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9ERUZJTkUpO1xuXHRcdHJldHVybiA8SUFjdGlvbj57XG5cdFx0XHRjbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGtleWJpbmRpbmdzQWRkSWNvbiksXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdhZGRLZXliaW5kaW5nJyxcblx0XHRcdHRvb2x0aXA6IGtleWJpbmRpbmcgPyBsb2NhbGl6ZSgnYWRkS2V5YmluZGluZ0xhYmVsV2l0aEtleScsIFwiQWRkIEtleWJpbmRpbmcgezB9XCIsIGAoJHtrZXliaW5kaW5nLmdldExhYmVsKCl9KWApIDogbG9jYWxpemUoJ2FkZEtleWJpbmRpbmdMYWJlbCcsIFwiQWRkIEtleWJpbmRpbmdcIiksXG5cdFx0XHRydW46ICgpID0+IHRoaXMua2V5YmluZGluZ3NFZGl0b3IuZGVmaW5lS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5LCBmYWxzZSlcblx0XHR9O1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUFjdGlvbnNDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cbmludGVyZmFjZSBJQ29tbWFuZENvbHVtblRlbXBsYXRlRGF0YSB7XG5cdGNvbW1hbmRDb2x1bW46IEhUTUxFbGVtZW50O1xuXHRjb21tYW5kQ29sdW1uSG92ZXI6IElNYW5hZ2VkSG92ZXI7XG5cdGNvbW1hbmRMYWJlbENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGNvbW1hbmRMYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblx0Y29tbWFuZERlZmF1bHRMYWJlbENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGNvbW1hbmREZWZhdWx0TGFiZWw6IEhpZ2hsaWdodGVkTGFiZWw7XG5cdGNvbW1hbmRJZExhYmVsQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0Y29tbWFuZElkTGFiZWw6IEhpZ2hsaWdodGVkTGFiZWw7XG59XG5cbmNsYXNzIENvbW1hbmRDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPElLZXliaW5kaW5nSXRlbUVudHJ5LCBJQ29tbWFuZENvbHVtblRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdjb21tYW5kcyc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gQ29tbWFuZENvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJQ29tbWFuZENvbHVtblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgY29tbWFuZENvbHVtbiA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY29tbWFuZCcpKTtcblx0XHRjb25zdCBjb21tYW5kQ29sdW1uSG92ZXIgPSB0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGNvbW1hbmRDb2x1bW4sICcnKTtcblx0XHRjb25zdCBjb21tYW5kTGFiZWxDb250YWluZXIgPSBET00uYXBwZW5kKGNvbW1hbmRDb2x1bW4sICQoJy5jb21tYW5kLWxhYmVsJykpO1xuXHRcdGNvbnN0IGNvbW1hbmRMYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKGNvbW1hbmRMYWJlbENvbnRhaW5lcik7XG5cdFx0Y29uc3QgY29tbWFuZERlZmF1bHRMYWJlbENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29tbWFuZENvbHVtbiwgJCgnLmNvbW1hbmQtZGVmYXVsdC1sYWJlbCcpKTtcblx0XHRjb25zdCBjb21tYW5kRGVmYXVsdExhYmVsID0gbmV3IEhpZ2hsaWdodGVkTGFiZWwoY29tbWFuZERlZmF1bHRMYWJlbENvbnRhaW5lcik7XG5cdFx0Y29uc3QgY29tbWFuZElkTGFiZWxDb250YWluZXIgPSBET00uYXBwZW5kKGNvbW1hbmRDb2x1bW4sICQoJy5jb21tYW5kLWlkLmNvZGUnKSk7XG5cdFx0Y29uc3QgY29tbWFuZElkTGFiZWwgPSBuZXcgSGlnaGxpZ2h0ZWRMYWJlbChjb21tYW5kSWRMYWJlbENvbnRhaW5lcik7XG5cdFx0cmV0dXJuIHsgY29tbWFuZENvbHVtbiwgY29tbWFuZENvbHVtbkhvdmVyLCBjb21tYW5kTGFiZWxDb250YWluZXIsIGNvbW1hbmRMYWJlbCwgY29tbWFuZERlZmF1bHRMYWJlbENvbnRhaW5lciwgY29tbWFuZERlZmF1bHRMYWJlbCwgY29tbWFuZElkTGFiZWxDb250YWluZXIsIGNvbW1hbmRJZExhYmVsIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGtleWJpbmRpbmdJdGVtRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElDb21tYW5kQ29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGtleWJpbmRpbmdJdGVtID0ga2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbTtcblx0XHRjb25zdCBjb21tYW5kSWRNYXRjaGVkID0gISEoa2V5YmluZGluZ0l0ZW0uY29tbWFuZExhYmVsICYmIGtleWJpbmRpbmdJdGVtRW50cnkuY29tbWFuZElkTWF0Y2hlcyk7XG5cdFx0Y29uc3QgY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZWQgPSAhIWtleWJpbmRpbmdJdGVtRW50cnkuY29tbWFuZERlZmF1bHRMYWJlbE1hdGNoZXM7XG5cblx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZENvbHVtbi5jbGFzc0xpc3QudG9nZ2xlKCd2ZXJ0aWNhbC1hbGlnbi1jb2x1bW4nLCBjb21tYW5kSWRNYXRjaGVkIHx8IGNvbW1hbmREZWZhdWx0TGFiZWxNYXRjaGVkKTtcblx0XHRjb25zdCB0aXRsZSA9IGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCA/IGxvY2FsaXplKCd0aXRsZScsIFwiezB9ICh7MX0pXCIsIGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCwga2V5YmluZGluZ0l0ZW0uY29tbWFuZCkgOiBrZXliaW5kaW5nSXRlbS5jb21tYW5kO1xuXHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kQ29sdW1uLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRpdGxlKTtcblx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZENvbHVtbkhvdmVyLnVwZGF0ZSh0aXRsZSk7XG5cblx0XHRpZiAoa2V5YmluZGluZ0l0ZW0uY29tbWFuZExhYmVsKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZExhYmVsQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kTGFiZWwuc2V0KGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCwga2V5YmluZGluZ0l0ZW1FbnRyeS5jb21tYW5kTGFiZWxNYXRjaGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNvbW1hbmRMYWJlbENvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZExhYmVsLnNldCh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGlmIChrZXliaW5kaW5nSXRlbUVudHJ5LmNvbW1hbmREZWZhdWx0TGFiZWxNYXRjaGVzKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZERlZmF1bHRMYWJlbENvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZERlZmF1bHRMYWJlbC5zZXQoa2V5YmluZGluZ0l0ZW0uY29tbWFuZERlZmF1bHRMYWJlbCwga2V5YmluZGluZ0l0ZW1FbnRyeS5jb21tYW5kRGVmYXVsdExhYmVsTWF0Y2hlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kRGVmYXVsdExhYmVsQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kRGVmYXVsdExhYmVsLnNldCh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGlmIChrZXliaW5kaW5nSXRlbUVudHJ5LmNvbW1hbmRJZE1hdGNoZXMgfHwgIWtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNvbW1hbmRJZExhYmVsQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kSWRMYWJlbC5zZXQoa2V5YmluZGluZ0l0ZW0uY29tbWFuZCwga2V5YmluZGluZ0l0ZW1FbnRyeS5jb21tYW5kSWRNYXRjaGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNvbW1hbmRJZExhYmVsQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kSWRMYWJlbC5zZXQodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJQ29tbWFuZENvbHVtblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kQ29sdW1uSG92ZXIuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kRGVmYXVsdExhYmVsLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuY29tbWFuZElkTGFiZWwuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5jb21tYW5kTGFiZWwuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJS2V5YmluZGluZ0NvbHVtblRlbXBsYXRlRGF0YSB7XG5cdGtleWJpbmRpbmdMYWJlbDogS2V5YmluZGluZ0xhYmVsO1xufVxuXG5jbGFzcyBLZXliaW5kaW5nQ29sdW1uUmVuZGVyZXIgaW1wbGVtZW50cyBJVGFibGVSZW5kZXJlcjxJS2V5YmluZGluZ0l0ZW1FbnRyeSwgSUtleWJpbmRpbmdDb2x1bW5UZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAna2V5YmluZGluZ3MnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IEtleWJpbmRpbmdDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRjb25zdHJ1Y3RvcigpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJS2V5YmluZGluZ0NvbHVtblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcua2V5YmluZGluZycpKTtcblx0XHRjb25zdCBrZXliaW5kaW5nTGFiZWwgPSBuZXcgS2V5YmluZGluZ0xhYmVsKERPTS5hcHBlbmQoZWxlbWVudCwgJCgnZGl2LmtleWJpbmRpbmctbGFiZWwnKSksIE9TLCBkZWZhdWx0S2V5YmluZGluZ0xhYmVsU3R5bGVzKTtcblx0XHRyZXR1cm4geyBrZXliaW5kaW5nTGFiZWwgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoa2V5YmluZGluZ0l0ZW1FbnRyeTogSUtleWJpbmRpbmdJdGVtRW50cnksIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUtleWJpbmRpbmdDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKGtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZykge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmtleWJpbmRpbmdMYWJlbC5zZXQoa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nLCBrZXliaW5kaW5nSXRlbUVudHJ5LmtleWJpbmRpbmdNYXRjaGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmtleWJpbmRpbmdMYWJlbC5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElLZXliaW5kaW5nQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmtleWJpbmRpbmdMYWJlbC5kaXNwb3NlKCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElTb3VyY2VDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRzb3VyY2VDb2x1bW46IEhUTUxFbGVtZW50O1xuXHRzb3VyY2VDb2x1bW5Ib3ZlcjogSU1hbmFnZWRIb3Zlcjtcblx0c291cmNlTGFiZWw6IEhpZ2hsaWdodGVkTGFiZWw7XG5cdGV4dGVuc2lvbkNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGV4dGVuc2lvbkxhYmVsOiBIVE1MQW5jaG9yRWxlbWVudDtcblx0ZXh0ZW5zaW9uSWQ6IEhpZ2hsaWdodGVkTGFiZWw7XG5cdGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmZ1bmN0aW9uIG9uQ2xpY2soZWxlbWVudDogSFRNTEVsZW1lbnQsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0ZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgRE9NLkV2ZW50VHlwZS5DTElDSywgRE9NLmZpbmFsSGFuZGxlcihjYWxsYmFjaykpKTtcblx0ZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgRE9NLkV2ZW50VHlwZS5LRVlfVVAsIGUgPT4ge1xuXHRcdGNvbnN0IGtleWJvYXJkRXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fVxuXHR9KSk7XG5cdHJldHVybiBkaXNwb3NhYmxlcztcbn1cblxuY2xhc3MgU291cmNlQ29sdW1uUmVuZGVyZXIgaW1wbGVtZW50cyBJVGFibGVSZW5kZXJlcjxJS2V5YmluZGluZ0l0ZW1FbnRyeSwgSVNvdXJjZUNvbHVtblRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdzb3VyY2UnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFNvdXJjZUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJU291cmNlQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBzb3VyY2VDb2x1bW4gPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNvdXJjZScpKTtcblx0XHRjb25zdCBzb3VyY2VDb2x1bW5Ib3ZlciA9IHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBzb3VyY2VDb2x1bW4sICcnKTtcblx0XHRjb25zdCBzb3VyY2VMYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKERPTS5hcHBlbmQoc291cmNlQ29sdW1uLCAkKCcuc291cmNlLWxhYmVsJykpKTtcblx0XHRjb25zdCBleHRlbnNpb25Db250YWluZXIgPSBET00uYXBwZW5kKHNvdXJjZUNvbHVtbiwgJCgnLmV4dGVuc2lvbi1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uTGFiZWwgPSBET00uYXBwZW5kPEhUTUxBbmNob3JFbGVtZW50PihleHRlbnNpb25Db250YWluZXIsICQoJ2EuZXh0ZW5zaW9uLWxhYmVsJywgeyB0YWJpbmRleDogMCB9KSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBuZXcgSGlnaGxpZ2h0ZWRMYWJlbChET00uYXBwZW5kKGV4dGVuc2lvbkNvbnRhaW5lciwgJCgnLmV4dGVuc2lvbi1pZC1jb250YWluZXIuY29kZScpKSk7XG5cdFx0cmV0dXJuIHsgc291cmNlQ29sdW1uLCBzb3VyY2VDb2x1bW5Ib3Zlciwgc291cmNlTGFiZWwsIGV4dGVuc2lvbkxhYmVsLCBleHRlbnNpb25Db250YWluZXIsIGV4dGVuc2lvbklkLCBkaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGtleWJpbmRpbmdJdGVtRW50cnk6IElLZXliaW5kaW5nSXRlbUVudHJ5LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElTb3VyY2VDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0aWYgKGlzU3RyaW5nKGtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0uc291cmNlKSkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmV4dGVuc2lvbkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuc291cmNlTGFiZWwuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuc291cmNlQ29sdW1uSG92ZXIudXBkYXRlKCcnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5zb3VyY2VMYWJlbC5zZXQoa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS5zb3VyY2UgfHwgJy0nLCBrZXliaW5kaW5nSXRlbUVudHJ5LnNvdXJjZU1hdGNoZXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZXh0ZW5zaW9uQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5zb3VyY2VMYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0uc291cmNlO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uTGFiZWwgPSBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWU7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuc291cmNlQ29sdW1uSG92ZXIudXBkYXRlKGxvY2FsaXplKCdleHRlbnNpb24gbGFiZWwnLCBcIkV4dGVuc2lvbiAoezB9KVwiLCBleHRlbnNpb25MYWJlbCkpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmV4dGVuc2lvbkxhYmVsLnRleHRDb250ZW50ID0gZXh0ZW5zaW9uTGFiZWw7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuYWRkKG9uQ2xpY2sodGVtcGxhdGVEYXRhLmV4dGVuc2lvbkxhYmVsLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlbihleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRpZiAoa2V5YmluZGluZ0l0ZW1FbnRyeS5leHRlbnNpb25JZE1hdGNoZXMpIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmV4dGVuc2lvbklkLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZXh0ZW5zaW9uSWQuc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlLCBrZXliaW5kaW5nSXRlbUVudHJ5LmV4dGVuc2lvbklkTWF0Y2hlcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZXh0ZW5zaW9uSWQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5leHRlbnNpb25JZC5zZXQodW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJU291cmNlQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnNvdXJjZUNvbHVtbkhvdmVyLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5zb3VyY2VMYWJlbC5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmV4dGVuc2lvbklkLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBXaGVuSW5wdXRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGlucHV0OiBTdWdnZXN0RW5hYmxlZElucHV0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWNjZXB0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25EaWRBY2NlcHQgPSB0aGlzLl9vbkRpZEFjY2VwdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlamVjdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlamVjdCA9IHRoaXMuX29uRGlkUmVqZWN0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHBhcmVudDogSFRNTEVsZW1lbnQsXG5cdFx0a2V5YmluZGluZ3NFZGl0b3I6IEtleWJpbmRpbmdzRWRpdG9yLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y29uc3QgZm9jdXNDb250ZXh0S2V5ID0gQ09OVEVYVF9XSEVOX0ZPQ1VTLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5pbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Z2dlc3RFbmFibGVkSW5wdXQsICdrZXlib2FyZHNob3J0Y3V0c2VkaXRvciN3aGVuaW5wdXQnLCBwYXJlbnQsIHtcblx0XHRcdHByb3ZpZGVSZXN1bHRzOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbnRleHRLZXkgb2YgUmF3Q29udGV4dEtleS5hbGwoKSkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHsgbGFiZWw6IGNvbnRleHRLZXkua2V5LCBkb2N1bWVudGF0aW9uOiBjb250ZXh0S2V5LmRlc2NyaXB0aW9uLCBkZXRhaWw6IGNvbnRleHRLZXkudHlwZSwga2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkNvbnN0YW50IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFsnIScsICcgJ10sXG5cdFx0XHR3b3JkRGVmaW5pdGlvbjogL1thLXpBLVouXSsvLFxuXHRcdFx0YWx3YXlzU2hvd1N1Z2dlc3Rpb25zOiB0cnVlLFxuXHRcdH0sICcnLCBga2V5Ym9hcmRzaG9ydGN1dHNlZGl0b3Ijd2hlbmlucHV0YCwgeyBmb2N1c0NvbnRleHRLZXksIG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IGtleWJpbmRpbmdzRWRpdG9yLm92ZXJmbG93V2lkZ2V0c0RvbU5vZGUgfSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5pbnB1dC5lbGVtZW50LCBET00uRXZlbnRUeXBlLkRCTENMSUNLLCBlID0+IERPTS5FdmVudEhlbHBlci5zdG9wKGUpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBmb2N1c0NvbnRleHRLZXkucmVzZXQoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoa2V5YmluZGluZ3NFZGl0b3Iub25BY2NlcHRXaGVuRXhwcmVzc2lvbigoKSA9PiB0aGlzLl9vbkRpZEFjY2VwdC5maXJlKHRoaXMuaW5wdXQuZ2V0VmFsdWUoKSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoa2V5YmluZGluZ3NFZGl0b3Iub25SZWplY3RXaGVuRXhwcmVzc2lvbiwgdGhpcy5pbnB1dC5vbkRpZEJsdXIpKCgpID0+IHRoaXMuX29uRGlkUmVqZWN0LmZpcmUoKSkpO1xuXHR9XG5cblx0bGF5b3V0KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXQubGF5b3V0KGRpbWVuc2lvbik7XG5cdH1cblxuXHRzaG93KHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0LnNldFZhbHVlKHZhbHVlKTtcblx0XHR0aGlzLmlucHV0LmZvY3VzKHRydWUpO1xuXHR9XG5cbn1cblxuaW50ZXJmYWNlIElXaGVuQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHdoZW5MYWJlbENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHdoZW5JbnB1dENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHdoZW5MYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY2xhc3MgV2hlbkNvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8SUtleWJpbmRpbmdJdGVtRW50cnksIElXaGVuQ29sdW1uVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ3doZW4nO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFdoZW5Db2x1bW5SZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdzRWRpdG9yOiBLZXliaW5kaW5nc0VkaXRvcixcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVdoZW5Db2x1bW5UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLndoZW4nKSk7XG5cblx0XHRjb25zdCB3aGVuTGFiZWxDb250YWluZXIgPSBET00uYXBwZW5kKGVsZW1lbnQsICQoJ2Rpdi53aGVuLWxhYmVsJykpO1xuXHRcdGNvbnN0IHdoZW5MYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKHdoZW5MYWJlbENvbnRhaW5lcik7XG5cblx0XHRjb25zdCB3aGVuSW5wdXRDb250YWluZXIgPSBET00uYXBwZW5kKGVsZW1lbnQsICQoJ2Rpdi53aGVuLWlucHV0LWNvbnRhaW5lcicpKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50LFxuXHRcdFx0d2hlbkxhYmVsQ29udGFpbmVyLFxuXHRcdFx0d2hlbkxhYmVsLFxuXHRcdFx0d2hlbklucHV0Q29udGFpbmVyLFxuXHRcdFx0ZGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSxcblx0XHR9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChrZXliaW5kaW5nSXRlbUVudHJ5OiBJS2V5YmluZGluZ0l0ZW1FbnRyeSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJV2hlbkNvbHVtblRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRjb25zdCB3aGVuSW5wdXREaXNwb3NhYmxlcyA9IHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuYWRkKHRoaXMua2V5YmluZGluZ3NFZGl0b3Iub25EZWZpbmVXaGVuRXhwcmVzc2lvbihlID0+IHtcblx0XHRcdGlmIChrZXliaW5kaW5nSXRlbUVudHJ5ID09PSBlKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2lucHV0LW1vZGUnKTtcblxuXHRcdFx0XHRjb25zdCBpbnB1dFdpZGdldCA9IHdoZW5JbnB1dERpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdoZW5JbnB1dFdpZGdldCwgdGVtcGxhdGVEYXRhLndoZW5JbnB1dENvbnRhaW5lciwgdGhpcy5rZXliaW5kaW5nc0VkaXRvcikpO1xuXHRcdFx0XHRpbnB1dFdpZGdldC5sYXlvdXQobmV3IERPTS5EaW1lbnNpb24odGVtcGxhdGVEYXRhLmVsZW1lbnQucGFyZW50RWxlbWVudCEuY2xpZW50V2lkdGgsIDE4KSk7XG5cdFx0XHRcdGlucHV0V2lkZ2V0LnNob3coa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS53aGVuIHx8ICcnKTtcblxuXHRcdFx0XHRjb25zdCBoaWRlSW5wdXRXaWRnZXQgPSAoKSA9PiB7XG5cdFx0XHRcdFx0d2hlbklucHV0RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdpbnB1dC1tb2RlJyk7XG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQucGFyZW50RWxlbWVudCEuc3R5bGUucGFkZGluZ0xlZnQgPSAnMTBweCc7XG5cdFx0XHRcdFx0RE9NLmNsZWFyTm9kZSh0ZW1wbGF0ZURhdGEud2hlbklucHV0Q29udGFpbmVyKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR3aGVuSW5wdXREaXNwb3NhYmxlcy5hZGQoaW5wdXRXaWRnZXQub25EaWRBY2NlcHQodmFsdWUgPT4ge1xuXHRcdFx0XHRcdGhpZGVJbnB1dFdpZGdldCgpO1xuXHRcdFx0XHRcdHRoaXMua2V5YmluZGluZ3NFZGl0b3IudXBkYXRlS2V5YmluZGluZyhrZXliaW5kaW5nSXRlbUVudHJ5LCBrZXliaW5kaW5nSXRlbUVudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcgPyBrZXliaW5kaW5nSXRlbUVudHJ5LmtleWJpbmRpbmdJdGVtLmtleWJpbmRpbmcuZ2V0VXNlclNldHRpbmdzTGFiZWwoKSB8fCAnJyA6ICcnLCB2YWx1ZSk7XG5cdFx0XHRcdFx0dGhpcy5rZXliaW5kaW5nc0VkaXRvci5zZWxlY3RLZXliaW5kaW5nKGtleWJpbmRpbmdJdGVtRW50cnkpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0d2hlbklucHV0RGlzcG9zYWJsZXMuYWRkKGlucHV0V2lkZ2V0Lm9uRGlkUmVqZWN0KCgpID0+IHtcblx0XHRcdFx0XHRoaWRlSW5wdXRXaWRnZXQoKTtcblx0XHRcdFx0XHR0aGlzLmtleWJpbmRpbmdzRWRpdG9yLnNlbGVjdEtleWJpbmRpbmcoa2V5YmluZGluZ0l0ZW1FbnRyeSk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudC5wYXJlbnRFbGVtZW50IS5zdHlsZS5wYWRkaW5nTGVmdCA9ICcwcHgnO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRlbXBsYXRlRGF0YS53aGVuTGFiZWxDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY29kZScsICEha2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS53aGVuKTtcblx0XHR0ZW1wbGF0ZURhdGEud2hlbkxhYmVsQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2VtcHR5JywgIWtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0ud2hlbik7XG5cblx0XHRpZiAoa2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS53aGVuKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEud2hlbkxhYmVsLnNldChrZXliaW5kaW5nSXRlbUVudHJ5LmtleWJpbmRpbmdJdGVtLndoZW4sIGtleWJpbmRpbmdJdGVtRW50cnkud2hlbk1hdGNoZXMsIGtleWJpbmRpbmdJdGVtRW50cnkua2V5YmluZGluZ0l0ZW0ud2hlbik7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0ZW1wbGF0ZURhdGEuZWxlbWVudCwga2V5YmluZGluZ0l0ZW1FbnRyeS5rZXliaW5kaW5nSXRlbS53aGVuKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS53aGVuTGFiZWwuc2V0KCctJyk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVdoZW5Db2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS53aGVuTGFiZWwuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPElLZXliaW5kaW5nSXRlbUVudHJ5PiB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7IH1cblxuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2tleWJpbmRpbmdzTGFiZWwnLCBcIktleWJpbmRpbmdzXCIpO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKHsga2V5YmluZGluZ0l0ZW0gfTogSUtleWJpbmRpbmdJdGVtRW50cnkpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IFtcblx0XHRcdGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCA/IGtleWJpbmRpbmdJdGVtLmNvbW1hbmRMYWJlbCA6IGtleWJpbmRpbmdJdGVtLmNvbW1hbmQsXG5cdFx0XHRrZXliaW5kaW5nSXRlbS5rZXliaW5kaW5nPy5nZXRBcmlhTGFiZWwoKSB8fCBsb2NhbGl6ZSgnbm9LZXliaW5kaW5nJywgXCJObyBrZXliaW5kaW5nIGFzc2lnbmVkXCIpLFxuXHRcdFx0a2V5YmluZGluZ0l0ZW0ud2hlbiA/IGtleWJpbmRpbmdJdGVtLndoZW4gOiBsb2NhbGl6ZSgnbm9XaGVuJywgXCJObyB3aGVuIGNvbnRleHRcIiksXG5cdFx0XHRpc1N0cmluZyhrZXliaW5kaW5nSXRlbS5zb3VyY2UpID8ga2V5YmluZGluZ0l0ZW0uc291cmNlIDoga2V5YmluZGluZ0l0ZW0uc291cmNlLmRlc2NyaXB0aW9uID8/IGtleWJpbmRpbmdJdGVtLnNvdXJjZS5pZGVudGlmaWVyLnZhbHVlLFxuXHRcdF07XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5LZXliaW5kaW5nc0VkaXRvcikpIHtcblx0XHRcdGNvbnN0IGtiRWRpdG9yQXJpYUxhYmVsID0gbG9jYWxpemUoJ2tleWJvYXJkIHNob3J0Y3V0cyBhcmlhIGxhYmVsJywgXCJ1c2Ugc3BhY2Ugb3IgZW50ZXIgdG8gY2hhbmdlIHRoZSBrZXliaW5kaW5nLlwiKTtcblx0XHRcdGFyaWFMYWJlbC5wdXNoKGtiRWRpdG9yQXJpYUxhYmVsKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFyaWFMYWJlbC5qb2luKCcsICcpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQ29sb3IoJ2tleWJpbmRpbmdUYWJsZS5oZWFkZXJCYWNrZ3JvdW5kJywgdGFibGVPZGRSb3dzQmFja2dyb3VuZENvbG9yLCAnQmFja2dyb3VuZCBjb2xvciBmb3IgdGhlIGtleWJvYXJkIHNob3J0Y3V0cyB0YWJsZSBoZWFkZXIuJyk7XG5yZWdpc3RlckNvbG9yKCdrZXliaW5kaW5nVGFibGUucm93c0JhY2tncm91bmQnLCB0YWJsZU9kZFJvd3NCYWNrZ3JvdW5kQ29sb3IsICdCYWNrZ3JvdW5kIGNvbG9yIGZvciB0aGUga2V5Ym9hcmQgc2hvcnRjdXRzIHRhYmxlIGFsdGVybmF0aW5nIHJvd3MuJyk7XG5cbnJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50KCh0aGVtZTogSUNvbG9yVGhlbWUsIGNvbGxlY3RvcjogSUNzc1N0eWxlQ29sbGVjdG9yKSA9PiB7XG5cdGNvbnN0IGZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGZvcmVncm91bmQpO1xuXHRpZiAoZm9yZWdyb3VuZENvbG9yKSB7XG5cdFx0Y29uc3Qgd2hlbkZvcmVncm91bmRDb2xvciA9IGZvcmVncm91bmRDb2xvci50cmFuc3BhcmVudCguOCkubWFrZU9wYXF1ZShXT1JLQkVOQ0hfQkFDS0dST1VORCh0aGVtZSkpO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAua2V5YmluZGluZ3MtZWRpdG9yID4gLmtleWJpbmRpbmdzLWJvZHkgPiAua2V5YmluZGluZ3MtdGFibGUtY29udGFpbmVyIC5tb25hY28tdGFibGUgLm1vbmFjby10YWJsZS10ciAubW9uYWNvLXRhYmxlLXRkIC5jb2RlIHsgY29sb3I6ICR7d2hlbkZvcmVncm91bmRDb2xvcn07IH1gKTtcblx0fVxuXG5cdGNvbnN0IGxpc3RBY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZCk7XG5cdGNvbnN0IGxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihsaXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCk7XG5cdGlmIChsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZENvbG9yICYmIGxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRjb25zdCB3aGVuRm9yZWdyb3VuZENvbG9yID0gbGlzdEFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmRDb2xvci50cmFuc3BhcmVudCguOCkubWFrZU9wYXF1ZShsaXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZENvbG9yKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmtleWJpbmRpbmdzLWVkaXRvciA+IC5rZXliaW5kaW5ncy1ib2R5ID4gLmtleWJpbmRpbmdzLXRhYmxlLWNvbnRhaW5lciAubW9uYWNvLXRhYmxlLmZvY3VzZWQgLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCAubW9uYWNvLXRhYmxlLXRyIC5tb25hY28tdGFibGUtdGQgLmNvZGUgeyBjb2xvcjogJHt3aGVuRm9yZWdyb3VuZENvbG9yfTsgfWApO1xuXHR9XG5cblx0Y29uc3QgbGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IobGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZCk7XG5cdGNvbnN0IGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQpO1xuXHRpZiAobGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZENvbG9yICYmIGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmRDb2xvcikge1xuXHRcdGNvbnN0IHdoZW5Gb3JlZ3JvdW5kQ29sb3IgPSBsaXN0SW5hY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IudHJhbnNwYXJlbnQoLjgpLm1ha2VPcGFxdWUobGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZENvbG9yKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmtleWJpbmRpbmdzLWVkaXRvciA+IC5rZXliaW5kaW5ncy1ib2R5ID4gLmtleWJpbmRpbmdzLXRhYmxlLWNvbnRhaW5lciAubW9uYWNvLXRhYmxlIC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgLm1vbmFjby10YWJsZS10ciAubW9uYWNvLXRhYmxlLXRkIC5jb2RlIHsgY29sb3I6ICR7d2hlbkZvcmVncm91bmRDb2xvcn07IH1gKTtcblx0fVxuXG5cdGNvbnN0IGxpc3RGb2N1c0ZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGxpc3RGb2N1c0ZvcmVncm91bmQpO1xuXHRjb25zdCBsaXN0Rm9jdXNCYWNrZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihsaXN0Rm9jdXNCYWNrZ3JvdW5kKTtcblx0aWYgKGxpc3RGb2N1c0ZvcmVncm91bmRDb2xvciAmJiBsaXN0Rm9jdXNCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRjb25zdCB3aGVuRm9yZWdyb3VuZENvbG9yID0gbGlzdEZvY3VzRm9yZWdyb3VuZENvbG9yLnRyYW5zcGFyZW50KC44KS5tYWtlT3BhcXVlKGxpc3RGb2N1c0JhY2tncm91bmRDb2xvcik7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5rZXliaW5kaW5ncy1lZGl0b3IgPiAua2V5YmluZGluZ3MtYm9keSA+IC5rZXliaW5kaW5ncy10YWJsZS1jb250YWluZXIgLm1vbmFjby10YWJsZS5mb2N1c2VkIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCAubW9uYWNvLXRhYmxlLXRyIC5tb25hY28tdGFibGUtdGQgLmNvZGUgeyBjb2xvcjogJHt3aGVuRm9yZWdyb3VuZENvbG9yfTsgfWApO1xuXHR9XG5cblx0Y29uc3QgbGlzdEhvdmVyRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IobGlzdEhvdmVyRm9yZWdyb3VuZCk7XG5cdGNvbnN0IGxpc3RIb3ZlckJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGxpc3RIb3ZlckJhY2tncm91bmQpO1xuXHRpZiAobGlzdEhvdmVyRm9yZWdyb3VuZENvbG9yICYmIGxpc3RIb3ZlckJhY2tncm91bmRDb2xvcikge1xuXHRcdGNvbnN0IHdoZW5Gb3JlZ3JvdW5kQ29sb3IgPSBsaXN0SG92ZXJGb3JlZ3JvdW5kQ29sb3IudHJhbnNwYXJlbnQoLjgpLm1ha2VPcGFxdWUobGlzdEhvdmVyQmFja2dyb3VuZENvbG9yKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmtleWJpbmRpbmdzLWVkaXRvciA+IC5rZXliaW5kaW5ncy1ib2R5ID4gLmtleWJpbmRpbmdzLXRhYmxlLWNvbnRhaW5lciAubW9uYWNvLXRhYmxlLmZvY3VzZWQgLm1vbmFjby1saXN0LXJvdzpob3Zlcjpub3QoLmZvY3VzZWQpOm5vdCguc2VsZWN0ZWQpIC5tb25hY28tdGFibGUtdHIgLm1vbmFjby10YWJsZS10ZCAuY29kZSB7IGNvbG9yOiAke3doZW5Gb3JlZ3JvdW5kQ29sb3J9OyB9YCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxPQUFPO0FBQ1AsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFlBQVksU0FBUztBQUNyQixTQUFTLE9BQU8sVUFBVTtBQUMxQixTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFrQixRQUFRLGlCQUFpQjtBQUMzQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFpQyxvQ0FBb0M7QUFDckUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBbUQ7QUFDNUQsU0FBUyx3QkFBd0IsK0JBQStCO0FBQ2hFLFNBQVMsMEJBQTBCLDRCQUE0QixrQ0FBa0MsK0NBQStDLDhDQUE4QyxtQ0FBbUMsbUNBQW1DLGtDQUFrQyxpQ0FBaUMseUNBQXlDLGlEQUFpRCx3Q0FBd0MseUNBQXlDLGdDQUFnQywrQ0FBK0MsMEJBQTBCO0FBQzNsQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGlDQUFpQztBQUUxQyxTQUFTLGVBQWUsa0NBQW1FO0FBQzNGLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsb0JBQWlDLHFCQUFxQjtBQUMvRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsZ0JBQWdCLGlCQUFpQiwrQkFBK0Is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
