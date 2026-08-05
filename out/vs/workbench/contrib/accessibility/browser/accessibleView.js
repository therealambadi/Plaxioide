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
import { EventType, addDisposableListener, getActiveWindow, isActiveElement } from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as marked from "../../../../base/common/marked/marked.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { Position } from "../../../../editor/common/core/position.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { AccessibilityHelpNLS } from "../../../../editor/common/standaloneStrings.js";
import { CodeActionController } from "../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { localize } from "../../../../nls.js";
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider, ExtensionContentProvider, isIAccessibleViewContentProvider } from "../../../../platform/accessibility/browser/accessibleView.js";
import { ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX, IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResultKind } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { AccessibilityWorkbenchSettingId, accessibilityHelpIsShown, accessibleViewContainsCodeBlocks, accessibleViewCurrentProviderId, accessibleViewGoToSymbolSupported, accessibleViewHasAssignedKeybindings, accessibleViewHasUnassignedKeybindings, accessibleViewInCodeBlock, accessibleViewIsShown, accessibleViewOnLastLine, accessibleViewSupportsNavigation, accessibleViewVerbosityEnabled } from "./accessibilityConfiguration.js";
import { resolveContentAndKeybindingItems } from "./accessibleViewKeybindingResolver.js";
import { AccessibilityCommandId } from "../common/accessibilityCommands.js";
import { IChatCodeBlockContextProviderService } from "../../chat/browser/chat.js";
import { getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { Schemas } from "../../../../base/common/network.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
var DIMENSIONS = /* @__PURE__ */ ((DIMENSIONS2) => {
  DIMENSIONS2[DIMENSIONS2["MAX_WIDTH"] = 600] = "MAX_WIDTH";
  return DIMENSIONS2;
})(DIMENSIONS || {});
let AccessibleView = class extends Disposable {
  constructor(_openerService, _instantiationService, _configurationService, _modelService, _contextViewService, _contextKeyService, _accessibilityService, _keybindingService, _layoutService, _menuService, _commandService, _codeBlockContextProviderService, _storageService, textModelResolverService, _quickInputService) {
    super();
    this._openerService = _openerService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._modelService = _modelService;
    this._contextViewService = _contextViewService;
    this._contextKeyService = _contextKeyService;
    this._accessibilityService = _accessibilityService;
    this._keybindingService = _keybindingService;
    this._layoutService = _layoutService;
    this._menuService = _menuService;
    this._commandService = _commandService;
    this._codeBlockContextProviderService = _codeBlockContextProviderService;
    this._storageService = _storageService;
    this.textModelResolverService = textModelResolverService;
    this._quickInputService = _quickInputService;
    this._isInQuickPick = false;
    this._accessiblityHelpIsShown = accessibilityHelpIsShown.bindTo(this._contextKeyService);
    this._accessibleViewIsShown = accessibleViewIsShown.bindTo(this._contextKeyService);
    this._accessibleViewSupportsNavigation = accessibleViewSupportsNavigation.bindTo(this._contextKeyService);
    this._accessibleViewVerbosityEnabled = accessibleViewVerbosityEnabled.bindTo(this._contextKeyService);
    this._accessibleViewGoToSymbolSupported = accessibleViewGoToSymbolSupported.bindTo(this._contextKeyService);
    this._accessibleViewCurrentProviderId = accessibleViewCurrentProviderId.bindTo(this._contextKeyService);
    this._accessibleViewInCodeBlock = accessibleViewInCodeBlock.bindTo(this._contextKeyService);
    this._accessibleViewContainsCodeBlocks = accessibleViewContainsCodeBlocks.bindTo(this._contextKeyService);
    this._onLastLine = accessibleViewOnLastLine.bindTo(this._contextKeyService);
    this._hasUnassignedKeybindings = accessibleViewHasUnassignedKeybindings.bindTo(this._contextKeyService);
    this._hasAssignedKeybindings = accessibleViewHasAssignedKeybindings.bindTo(this._contextKeyService);
    this._container = document.createElement("div");
    this._container.classList.add("accessible-view");
    if (this._configurationService.getValue(AccessibilityWorkbenchSettingId.HideAccessibleView)) {
      this._container.classList.add("hide");
    }
    const codeEditorWidgetOptions = {
      contributions: EditorExtensionsRegistry.getEditorContributions().filter((c) => c.id !== CodeActionController.ID)
    };
    const titleBar = document.createElement("div");
    titleBar.classList.add("accessible-view-title-bar");
    this._title = document.createElement("div");
    this._title.classList.add("accessible-view-title");
    titleBar.appendChild(this._title);
    const actionBar = document.createElement("div");
    actionBar.classList.add("accessible-view-action-bar");
    titleBar.appendChild(actionBar);
    this._container.appendChild(titleBar);
    this._toolbar = this._register(_instantiationService.createInstance(WorkbenchToolBar, actionBar, { orientation: ActionsOrientation.HORIZONTAL }));
    this._toolbar.context = { viewId: "accessibleView" };
    const toolbarElt = this._toolbar.getElement();
    toolbarElt.tabIndex = 0;
    const editorOptions = {
      ...getSimpleEditorOptions(this._configurationService),
      lineDecorationsWidth: 6,
      dragAndDrop: false,
      cursorWidth: 1,
      wordWrap: "off",
      wrappingStrategy: "advanced",
      wrappingIndent: "none",
      padding: { top: 2, bottom: 2 },
      quickSuggestions: false,
      renderWhitespace: "none",
      dropIntoEditor: { enabled: false },
      readOnly: true,
      fontFamily: "var(--monaco-monospace-font)"
    };
    this.textModelResolverService.registerTextModelContentProvider(Schemas.accessibleView, this);
    this._editorWidget = this._register(this._instantiationService.createInstance(CodeEditorWidget, this._container, editorOptions, codeEditorWidgetOptions));
    this._register(this._accessibilityService.onDidChangeScreenReaderOptimized(() => {
      if (this._currentProvider && this._accessiblityHelpIsShown.get()) {
        this.show(this._currentProvider);
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (isIAccessibleViewContentProvider(this._currentProvider) && e.affectsConfiguration(this._currentProvider.verbositySettingKey)) {
        if (this._accessiblityHelpIsShown.get()) {
          this.show(this._currentProvider);
        }
        this._accessibleViewVerbosityEnabled.set(this._configurationService.getValue(this._currentProvider.verbositySettingKey));
        this._updateToolbar(this._currentProvider.actions, this._currentProvider.options.type);
      }
      if (e.affectsConfiguration(AccessibilityWorkbenchSettingId.HideAccessibleView)) {
        this._container.classList.toggle("hide", this._configurationService.getValue(AccessibilityWorkbenchSettingId.HideAccessibleView));
      }
    }));
    this._register(this._editorWidget.onDidDispose(() => this._resetContextKeys()));
    this._register(this._editorWidget.onDidChangeCursorPosition(() => {
      this._onLastLine.set(this._editorWidget.getPosition()?.lineNumber === this._editorWidget.getModel()?.getLineCount());
    }));
    this._register(this._editorWidget.onDidChangeCursorPosition(() => {
      const cursorPosition = this._editorWidget.getPosition()?.lineNumber;
      if (this._codeBlocks && cursorPosition !== void 0) {
        const inCodeBlock = this._codeBlocks.find((c) => c.startLine <= cursorPosition && c.endLine >= cursorPosition) !== void 0;
        this._accessibleViewInCodeBlock.set(inCodeBlock);
      }
    }));
  }
  get editorWidget() {
    return this._editorWidget;
  }
  provideTextContent(resource) {
    return this._getTextModel(resource);
  }
  _resetContextKeys() {
    this._accessiblityHelpIsShown.reset();
    this._accessibleViewIsShown.reset();
    this._accessibleViewSupportsNavigation.reset();
    this._accessibleViewVerbosityEnabled.reset();
    this._accessibleViewGoToSymbolSupported.reset();
    this._accessibleViewCurrentProviderId.reset();
    this._hasAssignedKeybindings.reset();
    this._hasUnassignedKeybindings.reset();
  }
  getPosition(id) {
    if (!id || !this._lastProvider || this._lastProvider.id !== id) {
      return void 0;
    }
    return this._editorWidget.getPosition() || void 0;
  }
  setPosition(position, reveal, select) {
    this._editorWidget.setPosition(position);
    if (reveal) {
      this._editorWidget.revealPosition(position);
    }
    if (select) {
      const lineLength = this._editorWidget.getModel()?.getLineLength(position.lineNumber) ?? 0;
      if (lineLength) {
        this._editorWidget.setSelection({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: lineLength + 1 });
      }
    }
  }
  getCodeBlockContext() {
    const position = this._editorWidget.getPosition();
    if (!this._codeBlocks?.length || !position) {
      return;
    }
    const codeBlockIndex = this._codeBlocks?.findIndex((c) => c.startLine <= position?.lineNumber && c.endLine >= position?.lineNumber);
    const codeBlock = codeBlockIndex !== void 0 && codeBlockIndex > -1 ? this._codeBlocks[codeBlockIndex] : void 0;
    if (!codeBlock || codeBlockIndex === void 0) {
      return;
    }
    return { code: codeBlock.code, languageId: codeBlock.languageId, codeBlockIndex, element: void 0 };
  }
  navigateToCodeBlock(type) {
    const position = this._editorWidget.getPosition();
    if (!this._codeBlocks?.length || !position) {
      return;
    }
    let codeBlock;
    const codeBlocks = this._codeBlocks.slice();
    if (type === "previous") {
      codeBlock = codeBlocks.reverse().find((c) => c.endLine < position.lineNumber);
    } else {
      codeBlock = codeBlocks.find((c) => c.startLine > position.lineNumber);
    }
    if (!codeBlock) {
      return;
    }
    this.setPosition(new Position(codeBlock.startLine, 1), true);
  }
  showLastProvider(id) {
    if (!this._lastProvider || this._lastProvider.options.id !== id) {
      return;
    }
    this.show(this._lastProvider);
  }
  show(provider, symbol, showAccessibleViewHelp, position) {
    provider = provider ?? this._currentProvider;
    if (!provider) {
      return;
    }
    provider.onOpen?.();
    const delegate = {
      getAnchor: () => {
        return { x: getActiveWindow().innerWidth / 2 - Math.min(this._layoutService.activeContainerDimension.width * 0.62, 600 /* MAX_WIDTH */) / 2, y: this._layoutService.activeContainerOffset.quickPickTop };
      },
      render: (container) => {
        this._viewContainer = container;
        this._viewContainer.classList.add("accessible-view-container");
        return this._render(provider, container, showAccessibleViewHelp);
      },
      onHide: () => {
        if (!showAccessibleViewHelp) {
          this._updateLastProvider();
          this._currentProvider?.dispose();
          this._currentProvider = void 0;
          this._resetContextKeys();
        }
      }
    };
    this._contextViewService.showContextView(delegate);
    if (position) {
      queueMicrotask(() => {
        this._editorWidget.revealLine(position.lineNumber);
        this._editorWidget.setSelection({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column });
      });
    }
    if (symbol && this._currentProvider) {
      this.showSymbol(this._currentProvider, symbol);
    }
    if (provider instanceof AccessibleContentProvider && provider.onDidRequestClearLastProvider) {
      this._register(provider.onDidRequestClearLastProvider((id) => {
        if (this._lastProvider?.options.id === id) {
          this._lastProvider = void 0;
        }
      }));
    }
    if (provider.options.id) {
      this._lastProvider = provider;
    }
    if (provider.id === AccessibleViewProviderId.PanelChat || provider.id === AccessibleViewProviderId.QuickChat) {
      this._register(this._codeBlockContextProviderService.registerProvider({ getCodeBlockContext: () => this.getCodeBlockContext() }, "accessibleView"));
    }
    if (provider instanceof ExtensionContentProvider) {
      this._storageService.store(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${provider.id}`, true, StorageScope.APPLICATION, StorageTarget.USER);
    }
    if (provider.onDidChangeContent) {
      this._register(provider.onDidChangeContent(() => {
        if (this._viewContainer) {
          this._render(provider, this._viewContainer, showAccessibleViewHelp);
        }
      }));
    }
  }
  previous() {
    const newContent = this._currentProvider?.providePreviousContent?.();
    if (!this._currentProvider || !this._viewContainer || !newContent) {
      return;
    }
    this._render(this._currentProvider, this._viewContainer, void 0, newContent);
  }
  next() {
    const newContent = this._currentProvider?.provideNextContent?.();
    if (!this._currentProvider || !this._viewContainer || !newContent) {
      return;
    }
    this._render(this._currentProvider, this._viewContainer, void 0, newContent);
  }
  _verbosityEnabled() {
    if (!this._currentProvider) {
      return false;
    }
    return isIAccessibleViewContentProvider(this._currentProvider) ? this._configurationService.getValue(this._currentProvider.verbositySettingKey) === true : this._storageService.getBoolean(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${this._currentProvider.id}`, StorageScope.APPLICATION, false);
  }
  goToSymbol() {
    if (!this._currentProvider) {
      return;
    }
    this._isInQuickPick = true;
    this._instantiationService.createInstance(AccessibleViewSymbolQuickPick, this).show(this._currentProvider);
  }
  calculateCodeBlocks(markdown) {
    if (!markdown) {
      return;
    }
    if (this._currentProvider?.id !== AccessibleViewProviderId.PanelChat && this._currentProvider?.id !== AccessibleViewProviderId.QuickChat) {
      return;
    }
    if (this._currentProvider.options.language && this._currentProvider.options.language !== "markdown") {
      return;
    }
    const lines = markdown.split("\n");
    this._codeBlocks = [];
    let inBlock = false;
    let startLine = 0;
    let languageId;
    lines.forEach((line, i) => {
      if (!inBlock && line.startsWith("```")) {
        inBlock = true;
        startLine = i + 1;
        languageId = line.substring(3).trim();
      } else if (inBlock && line.endsWith("```")) {
        inBlock = false;
        const endLine = i;
        const code = lines.slice(startLine, endLine).join("\n");
        this._codeBlocks?.push({ startLine, endLine, code, languageId });
      }
    });
    this._accessibleViewContainsCodeBlocks.set(this._codeBlocks.length > 0);
  }
  getSymbols() {
    const provider = this._currentProvider ? this._currentProvider : void 0;
    if (!this._currentContent || !provider) {
      return;
    }
    const symbols = "getSymbols" in provider ? provider.getSymbols?.() || [] : [];
    if (symbols?.length) {
      return symbols;
    }
    if (provider.options.language && provider.options.language !== "markdown") {
      return;
    }
    const markdownTokens = marked.marked.lexer(this._currentContent);
    if (!markdownTokens) {
      return;
    }
    this._convertTokensToSymbols(markdownTokens, symbols);
    return symbols.length ? symbols : void 0;
  }
  openHelpLink() {
    if (!this._currentProvider?.options.readMoreUrl) {
      return;
    }
    this._openerService.open(URI.parse(this._currentProvider.options.readMoreUrl));
  }
  configureKeybindings(unassigned) {
    this._isInQuickPick = true;
    const provider = this._updateLastProvider();
    const items = unassigned ? provider?.options?.configureKeybindingItems : provider?.options?.configuredKeybindingItems;
    if (!items) {
      return;
    }
    const disposables = this._register(new DisposableStore());
    const quickPick = disposables.add(this._quickInputService.createQuickPick());
    quickPick.items = items;
    quickPick.title = localize("keybindings", "Configure keybindings");
    quickPick.placeholder = localize("selectKeybinding", "Select a command ID to configure a keybinding for it");
    quickPick.show();
    disposables.add(quickPick.onDidAccept(async () => {
      const item = quickPick.selectedItems[0];
      if (item) {
        await this._commandService.executeCommand("workbench.action.openGlobalKeybindings", item.id);
      }
      quickPick.dispose();
    }));
    disposables.add(quickPick.onDidHide(() => {
      if (!quickPick.selectedItems.length && provider) {
        this.show(provider);
      }
      disposables.dispose();
      this._isInQuickPick = false;
    }));
  }
  _convertTokensToSymbols(tokens, symbols) {
    let firstListItem;
    for (const token of tokens) {
      let label = void 0;
      if ("type" in token) {
        switch (token.type) {
          case "heading":
          case "paragraph":
          case "code":
            label = token.text;
            break;
          case "list": {
            const firstItem = token.items[0];
            if (!firstItem) {
              break;
            }
            firstListItem = `- ${firstItem.text}`;
            label = token.items.map((i) => i.text).join(", ");
            break;
          }
        }
      }
      if (label) {
        symbols.push({ markdownToParse: label, label: localize("symbolLabel", "({0}) {1}", token.type, label), ariaLabel: localize("symbolLabelAria", "({0}) {1}", token.type, label), firstListItem });
        firstListItem = void 0;
      }
    }
  }
  showSymbol(provider, symbol) {
    if (!this._currentContent) {
      return;
    }
    let lineNumber = symbol.lineNumber;
    const markdownToParse = symbol.markdownToParse;
    if (lineNumber === void 0 && markdownToParse === void 0) {
      return;
    }
    if (lineNumber === void 0 && markdownToParse) {
      const index = this._currentContent.split("\n").findIndex((line) => line.includes(markdownToParse.split("\n")[0]) || symbol.firstListItem && line.includes(symbol.firstListItem)) ?? -1;
      if (index >= 0) {
        lineNumber = index + 1;
      }
    }
    if (lineNumber === void 0) {
      return;
    }
    this._isInQuickPick = false;
    this.show(provider, void 0, void 0, { lineNumber, column: 1 });
    this._updateContextKeys(provider, true);
  }
  disableHint() {
    if (!isIAccessibleViewContentProvider(this._currentProvider)) {
      return;
    }
    this._configurationService.updateValue(this._currentProvider?.verbositySettingKey, false);
    alert(localize("disableAccessibilityHelp", "{0} accessibility verbosity is now disabled", this._currentProvider.verbositySettingKey));
  }
  _updateContextKeys(provider, shown) {
    if (provider.options.type === AccessibleViewType.Help) {
      this._accessiblityHelpIsShown.set(shown);
      this._accessibleViewIsShown.reset();
    } else {
      this._accessibleViewIsShown.set(shown);
      this._accessiblityHelpIsShown.reset();
    }
    this._accessibleViewSupportsNavigation.set(provider.provideNextContent !== void 0 || provider.providePreviousContent !== void 0);
    this._accessibleViewVerbosityEnabled.set(this._verbosityEnabled());
    this._accessibleViewGoToSymbolSupported.set(this._goToSymbolsSupported() ? this.getSymbols()?.length > 0 : false);
  }
  _updateContent(provider, updatedContent) {
    let content = updatedContent ?? provider.provideContent();
    if (provider.options.type === AccessibleViewType.View) {
      this._currentContent = content;
      this._hasUnassignedKeybindings.reset();
      this._hasAssignedKeybindings.reset();
      return;
    }
    const readMoreLinkHint = this._readMoreHint(provider);
    const disableHelpHint = this._disableVerbosityHint(provider);
    const screenReaderModeHint = this._screenReaderModeHint(provider);
    const exitThisDialogHint = this._exitDialogHint(provider);
    let configureKbHint = "";
    let configureAssignedKbHint = "";
    const resolvedContent = resolveContentAndKeybindingItems(this._keybindingService, screenReaderModeHint + content + readMoreLinkHint + disableHelpHint + exitThisDialogHint);
    if (resolvedContent) {
      content = resolvedContent.content.value;
      if (resolvedContent.configureKeybindingItems) {
        provider.options.configureKeybindingItems = resolvedContent.configureKeybindingItems;
        this._hasUnassignedKeybindings.set(true);
        configureKbHint = this._configureUnassignedKbHint();
      } else {
        this._hasAssignedKeybindings.reset();
      }
      if (resolvedContent.configuredKeybindingItems) {
        provider.options.configuredKeybindingItems = resolvedContent.configuredKeybindingItems;
        this._hasAssignedKeybindings.set(true);
        configureAssignedKbHint = this._configureAssignedKbHint();
      } else {
        this._hasAssignedKeybindings.reset();
      }
    }
    this._currentContent = content + configureKbHint + configureAssignedKbHint;
  }
  _render(provider, container, showAccessibleViewHelp, updatedContent) {
    this._currentProvider = provider;
    this._accessibleViewCurrentProviderId.set(provider.id);
    const verbose = this._verbosityEnabled();
    this._updateContent(provider, updatedContent);
    this.calculateCodeBlocks(this._currentContent);
    this._updateContextKeys(provider, true);
    const widgetIsFocused = this._editorWidget.hasTextFocus() || this._editorWidget.hasWidgetFocus();
    this._getTextModel(URI.from({ path: `accessible-view-${provider.id}`, scheme: Schemas.accessibleView, fragment: this._currentContent })).then((model) => {
      if (!model) {
        return;
      }
      this._editorWidget.setModel(model);
      const domNode = this._editorWidget.getDomNode();
      if (!domNode) {
        return;
      }
      model.setLanguage(provider.options.language ?? "markdown");
      container.appendChild(this._container);
      let actionsHint = "";
      const hasActions = this._accessibleViewSupportsNavigation.get() || this._accessibleViewVerbosityEnabled.get() || this._accessibleViewGoToSymbolSupported.get() || provider.actions?.length;
      if (verbose && !showAccessibleViewHelp && hasActions) {
        actionsHint = provider.options.position ? localize("ariaAccessibleViewActionsBottom", "Explore actions such as disabling this hint (Shift+Tab), use Escape to exit this dialog.") : localize("ariaAccessibleViewActions", "Explore actions such as disabling this hint (Shift+Tab).");
      }
      let ariaLabel = provider.options.type === AccessibleViewType.Help ? localize("accessibility-help", "Accessibility Help") : localize("accessible-view", "Accessible View");
      this._title.textContent = ariaLabel;
      if (actionsHint && provider.options.type === AccessibleViewType.View) {
        ariaLabel = localize("accessible-view-hint", "Accessible View, {0}", actionsHint);
      } else if (actionsHint) {
        ariaLabel = localize("accessibility-help-hint", "Accessibility Help, {0}", actionsHint);
      }
      if (isWindows && widgetIsFocused) {
        ariaLabel = "";
      }
      this._editorWidget.updateOptions({ ariaLabel });
      this._editorWidget.focus();
      if (this._currentProvider?.options.position) {
        const position = this._editorWidget.getPosition();
        const isDefaultPosition = position?.lineNumber === 1 && position.column === 1;
        if (this._currentProvider.options.position === "bottom" || this._currentProvider.options.position === "initial-bottom" && isDefaultPosition) {
          const lastLine = this.editorWidget.getModel()?.getLineCount();
          const position2 = lastLine !== void 0 && lastLine > 0 ? new Position(lastLine, 1) : void 0;
          if (position2) {
            this._editorWidget.setPosition(position2);
            this._editorWidget.revealLine(position2.lineNumber);
          }
        }
      }
    });
    this._updateToolbar(this._currentProvider.actions, provider.options.type);
    const hide = (e) => {
      if (!this._isInQuickPick) {
        provider.onClose();
      }
      e?.stopPropagation();
      this._contextViewService.hideContextView();
      if (this._isInQuickPick) {
        return;
      }
      this._updateContextKeys(provider, false);
      this._lastProvider = void 0;
      this._currentContent = void 0;
      this._currentProvider?.dispose();
      this._currentProvider = void 0;
    };
    const disposableStore = new DisposableStore();
    disposableStore.add(this._editorWidget.onKeyDown((e) => {
      if (e.keyCode === KeyCode.Enter) {
        this._commandService.executeCommand("editor.action.openLink");
      } else if (e.keyCode === KeyCode.Escape || shouldHide(e.browserEvent, this._keybindingService, this._configurationService)) {
        hide(e);
      } else if (e.keyCode === KeyCode.KeyH && provider.options.readMoreUrl) {
        const url = provider.options.readMoreUrl;
        alert(AccessibilityHelpNLS.openingDocs);
        this._openerService.open(URI.parse(url));
        e.preventDefault();
        e.stopPropagation();
      }
      if (provider instanceof AccessibleContentProvider) {
        provider.onKeyDown?.(e);
      }
    }));
    disposableStore.add(addDisposableListener(this._toolbar.getElement(), EventType.KEY_DOWN, (e) => {
      const keyboardEvent = new StandardKeyboardEvent(e);
      if (keyboardEvent.equals(KeyCode.Escape)) {
        hide(e);
      }
    }));
    disposableStore.add(this._editorWidget.onDidBlurEditorWidget(() => {
      if (!isActiveElement(this._toolbar.getElement())) {
        hide();
      }
    }));
    disposableStore.add(this._editorWidget.onDidContentSizeChange(() => this._layout()));
    disposableStore.add(this._layoutService.onDidLayoutActiveContainer(() => this._layout()));
    return disposableStore;
  }
  _updateToolbar(providedActions, type) {
    this._toolbar.setAriaLabel(type === AccessibleViewType.Help ? localize("accessibleHelpToolbar", "Accessibility Help") : localize("accessibleViewToolbar", "Accessible View"));
    const toolbarMenu = this._register(this._menuService.createMenu(MenuId.AccessibleView, this._contextKeyService));
    const menuActions = getFlatActionBarActions(toolbarMenu.getActions({}));
    if (providedActions) {
      for (const providedAction of providedActions) {
        providedAction.class = providedAction.class || ThemeIcon.asClassName(Codicon.primitiveSquare);
        providedAction.checked = void 0;
      }
      this._toolbar.setActions([...providedActions, ...menuActions]);
    } else {
      this._toolbar.setActions(menuActions);
    }
  }
  _layout() {
    const dimension = this._layoutService.activeContainerDimension;
    const maxHeight = dimension.height && dimension.height * 0.4;
    const height = Math.min(maxHeight, this._editorWidget.getContentHeight());
    const width = Math.min(dimension.width * 0.62, 600 /* MAX_WIDTH */);
    this._editorWidget.layout({ width, height });
  }
  async _getTextModel(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    return this._modelService.createModel(resource.fragment, null, resource, false);
  }
  _goToSymbolsSupported() {
    if (!this._currentProvider) {
      return false;
    }
    return this._currentProvider.options.type === AccessibleViewType.Help || this._currentProvider.options.language === "markdown" || this._currentProvider.options.language === void 0 || this._currentProvider instanceof AccessibleContentProvider && !!this._currentProvider.getSymbols?.();
  }
  _updateLastProvider() {
    const provider = this._currentProvider;
    if (!provider) {
      return;
    }
    const lastProvider = provider instanceof AccessibleContentProvider ? new AccessibleContentProvider(
      provider.id,
      provider.options,
      provider.provideContent.bind(provider),
      provider.onClose.bind(provider),
      provider.verbositySettingKey,
      provider.onOpen?.bind(provider),
      provider.actions,
      provider.provideNextContent?.bind(provider),
      provider.providePreviousContent?.bind(provider),
      provider.onDidChangeContent?.bind(provider),
      provider.onKeyDown?.bind(provider),
      provider.getSymbols?.bind(provider)
    ) : new ExtensionContentProvider(
      provider.id,
      provider.options,
      provider.provideContent.bind(provider),
      provider.onClose.bind(provider),
      provider.onOpen?.bind(provider),
      provider.provideNextContent?.bind(provider),
      provider.providePreviousContent?.bind(provider),
      provider.actions,
      provider.onDidChangeContent?.bind(provider)
    );
    return lastProvider;
  }
  showAccessibleViewHelp() {
    const lastProvider = this._updateLastProvider();
    if (!lastProvider) {
      return;
    }
    let accessibleViewHelpProvider;
    if (lastProvider instanceof AccessibleContentProvider) {
      accessibleViewHelpProvider = new AccessibleContentProvider(
        lastProvider.id,
        { type: AccessibleViewType.Help },
        () => lastProvider.options.customHelp ? lastProvider?.options.customHelp() : this._accessibleViewHelpDialogContent(this._goToSymbolsSupported()),
        () => {
          this._contextViewService.hideContextView();
          queueMicrotask(() => this.show(lastProvider));
        },
        lastProvider.verbositySettingKey
      );
    } else {
      accessibleViewHelpProvider = new ExtensionContentProvider(
        lastProvider.id,
        { type: AccessibleViewType.Help },
        () => lastProvider.options.customHelp ? lastProvider?.options.customHelp() : this._accessibleViewHelpDialogContent(this._goToSymbolsSupported()),
        () => {
          this._contextViewService.hideContextView();
          queueMicrotask(() => this.show(lastProvider));
        }
      );
    }
    this._contextViewService.hideContextView();
    if (accessibleViewHelpProvider) {
      queueMicrotask(() => this.show(accessibleViewHelpProvider, void 0, true));
    }
  }
  _accessibleViewHelpDialogContent(providerHasSymbols) {
    const navigationHint = this._navigationHint();
    const goToSymbolHint = this._goToSymbolHint(providerHasSymbols);
    const toolbarHint = localize("toolbar", "Navigate to the toolbar (Shift+Tab).");
    const chatHints = this._getChatHints();
    let hint = localize("intro", "In the accessible view, you can:\n");
    if (navigationHint) {
      hint += " - " + navigationHint + "\n";
    }
    if (goToSymbolHint) {
      hint += " - " + goToSymbolHint + "\n";
    }
    if (toolbarHint) {
      hint += " - " + toolbarHint + "\n";
    }
    if (chatHints) {
      hint += chatHints;
    }
    return hint;
  }
  _getChatHints() {
    if (this._currentProvider?.id !== AccessibleViewProviderId.PanelChat && this._currentProvider?.id !== AccessibleViewProviderId.QuickChat) {
      return;
    }
    return [
      localize("insertAtCursor", " - Insert the code block at the cursor{0}.", "<keybinding:workbench.action.chat.insertCodeBlock>"),
      localize("insertIntoNewFile", " - Insert the code block into a new file{0}.", "<keybinding:workbench.action.chat.insertIntoNewFile>"),
      localize("runInTerminal", " - Run the code block in the terminal{0}.\n", "<keybinding:workbench.action.chat.runInTerminal>")
    ].join("\n");
  }
  _navigationHint() {
    return localize("accessibleViewNextPreviousHint", "Show the next item{0} or previous item{1}.", `<keybinding:${AccessibilityCommandId.ShowNext}`, `<keybinding:${AccessibilityCommandId.ShowPrevious}>`);
  }
  _disableVerbosityHint(provider) {
    if (provider.options.type === AccessibleViewType.Help && this._verbosityEnabled()) {
      return localize("acessibleViewDisableHint", "\nDisable accessibility verbosity for this feature{0}.", `<keybinding:${AccessibilityCommandId.DisableVerbosityHint}>`);
    }
    return "";
  }
  _goToSymbolHint(providerHasSymbols) {
    if (!providerHasSymbols) {
      return;
    }
    return localize("goToSymbolHint", "Go to a symbol{0}.", `<keybinding:${AccessibilityCommandId.GoToSymbol}>`);
  }
  _configureUnassignedKbHint() {
    const configureKb = this._keybindingService.lookupKeybinding(AccessibilityCommandId.AccessibilityHelpConfigureKeybindings)?.getAriaLabel();
    const keybindingToConfigureQuickPick = configureKb ? "(" + configureKb + ")" : "by assigning a keybinding to the command Accessibility Help Configure Unassigned Keybindings.";
    return localize("configureKb", "\nConfigure keybindings for commands that lack them {0}.", keybindingToConfigureQuickPick);
  }
  _configureAssignedKbHint() {
    const configureKb = this._keybindingService.lookupKeybinding(AccessibilityCommandId.AccessibilityHelpConfigureAssignedKeybindings)?.getAriaLabel();
    const keybindingToConfigureQuickPick = configureKb ? "(" + configureKb + ")" : "by assigning a keybinding to the command Accessibility Help Configure Assigned Keybindings.";
    return localize("configureKbAssigned", "\nConfigure keybindings for commands that already have assignments {0}.", keybindingToConfigureQuickPick);
  }
  _screenReaderModeHint(provider) {
    const accessibilitySupport = this._accessibilityService.isScreenReaderOptimized();
    let screenReaderModeHint = "";
    const turnOnMessage = isMacintosh ? AccessibilityHelpNLS.changeConfigToOnMac : AccessibilityHelpNLS.changeConfigToOnWinLinux;
    if (accessibilitySupport && provider.id === AccessibleViewProviderId.Editor) {
      screenReaderModeHint = AccessibilityHelpNLS.auto_on;
      screenReaderModeHint += "\n";
    } else if (!accessibilitySupport) {
      screenReaderModeHint = AccessibilityHelpNLS.auto_off + "\n" + turnOnMessage;
      screenReaderModeHint += "\n";
    }
    return screenReaderModeHint;
  }
  _exitDialogHint(provider) {
    return this._verbosityEnabled() && !provider.options.position ? localize("exit", "\nExit this dialog (Escape).") : "";
  }
  _readMoreHint(provider) {
    return provider.options.readMoreUrl ? localize("openDoc", "\nOpen a browser window with more information related to accessibility{0}.", `<keybinding:${AccessibilityCommandId.AccessibilityHelpOpenHelpLink}>`) : "";
  }
};
AccessibleView = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IAccessibilityService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ILayoutService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IChatCodeBlockContextProviderService),
  __decorateParam(12, IStorageService),
  __decorateParam(13, ITextModelService),
  __decorateParam(14, IQuickInputService)
], AccessibleView);
let AccessibleViewService = class extends Disposable {
  constructor(_instantiationService, _configurationService, _keybindingService) {
    super();
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._keybindingService = _keybindingService;
  }
  show(provider, position) {
    if (!this._accessibleView) {
      this._accessibleView = this._register(this._instantiationService.createInstance(AccessibleView));
    }
    this._accessibleView.show(provider, void 0, void 0, position);
  }
  configureKeybindings(unassigned) {
    this._accessibleView?.configureKeybindings(unassigned);
  }
  openHelpLink() {
    this._accessibleView?.openHelpLink();
  }
  showLastProvider(id) {
    this._accessibleView?.showLastProvider(id);
  }
  next() {
    this._accessibleView?.next();
  }
  previous() {
    this._accessibleView?.previous();
  }
  goToSymbol() {
    this._accessibleView?.goToSymbol();
  }
  getOpenAriaHint(verbositySettingKey) {
    if (!this._configurationService.getValue(verbositySettingKey)) {
      return null;
    }
    const keybinding = this._keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibleView)?.getAriaLabel();
    let hint = null;
    if (keybinding) {
      hint = localize("acessibleViewHint", "Inspect this in the accessible view with {0}", keybinding);
    } else {
      hint = localize("acessibleViewHintNoKbEither", "Inspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.");
    }
    return hint;
  }
  disableHint() {
    this._accessibleView?.disableHint();
  }
  showAccessibleViewHelp() {
    this._accessibleView?.showAccessibleViewHelp();
  }
  getPosition(id) {
    return this._accessibleView?.getPosition(id) ?? void 0;
  }
  getLastPosition() {
    const lastLine = this._accessibleView?.editorWidget.getModel()?.getLineCount();
    return lastLine !== void 0 && lastLine > 0 ? new Position(lastLine, 1) : void 0;
  }
  setPosition(position, reveal, select) {
    this._accessibleView?.setPosition(position, reveal, select);
  }
  getCodeBlockContext() {
    return this._accessibleView?.getCodeBlockContext();
  }
  navigateToCodeBlock(type) {
    this._accessibleView?.navigateToCodeBlock(type);
  }
};
AccessibleViewService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IKeybindingService)
], AccessibleViewService);
let AccessibleViewSymbolQuickPick = class {
  constructor(_accessibleView, _quickInputService) {
    this._accessibleView = _accessibleView;
    this._quickInputService = _quickInputService;
  }
  show(provider) {
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this._quickInputService.createQuickPick());
    quickPick.placeholder = localize("accessibleViewSymbolQuickPickPlaceholder", "Type to search symbols");
    quickPick.title = localize("accessibleViewSymbolQuickPickTitle", "Go to Symbol Accessible View");
    const picks = [];
    const symbols = this._accessibleView.getSymbols();
    if (!symbols) {
      return;
    }
    for (const symbol of symbols) {
      picks.push({
        label: symbol.label,
        ariaLabel: symbol.ariaLabel,
        firstListItem: symbol.firstListItem,
        lineNumber: symbol.lineNumber,
        endLineNumber: symbol.endLineNumber,
        markdownToParse: symbol.markdownToParse
      });
    }
    quickPick.canSelectMany = false;
    quickPick.items = picks;
    quickPick.show();
    disposables.add(quickPick.onDidAccept(() => {
      this._accessibleView.showSymbol(provider, quickPick.selectedItems[0]);
      quickPick.hide();
    }));
    disposables.add(quickPick.onDidHide(() => {
      if (quickPick.selectedItems.length === 0) {
        this._accessibleView.show(provider);
      }
      disposables.dispose();
    }));
  }
};
AccessibleViewSymbolQuickPick = __decorateClass([
  __decorateParam(1, IQuickInputService)
], AccessibleViewSymbolQuickPick);
function shouldHide(event, keybindingService, configurationService) {
  if (!configurationService.getValue(AccessibilityWorkbenchSettingId.AccessibleViewCloseOnKeyPress)) {
    return false;
  }
  const standardKeyboardEvent = new StandardKeyboardEvent(event);
  const resolveResult = keybindingService.softDispatch(standardKeyboardEvent, standardKeyboardEvent.target);
  const isValidChord = resolveResult.kind === ResultKind.MoreChordsNeeded;
  if (keybindingService.inChordMode || isValidChord) {
    return false;
  }
  return shouldHandleKey(event) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}
function shouldHandleKey(event) {
  return !!event.code.match(/^(Key[A-Z]|Digit[0-9]|Equal|Comma|Period|Slash|Quote|Backquote|Backslash|Minus|Semicolon|Space|Enter)$/);
}
export {
  AccessibleView,
  AccessibleViewService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudFR5cGUsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgZ2V0QWN0aXZlV2luZG93LCBpc0FjdGl2ZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50LCBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25zT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBhbGVydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG1hcmtlZCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJrZWQvbWFya2VkLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0LCBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiwgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUhlbHBOTFMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3N0YW5kYWxvbmVTdHJpbmdzLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25Db250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29kZUFjdGlvbi9icm93c2VyL2NvZGVBY3Rpb25Db250cm9sbGVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCwgQWNjZXNzaWJsZVZpZXdUeXBlLCBBY2Nlc3NpYmxlQ29udGVudFByb3ZpZGVyLCBFeHRlbnNpb25Db250ZW50UHJvdmlkZXIsIElBY2Nlc3NpYmxlVmlld1NlcnZpY2UsIElBY2Nlc3NpYmxlVmlld1N5bWJvbCwgaXNJQWNjZXNzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQUNDRVNTSUJMRV9WSUVXX1NIT1dOX1NUT1JBR0VfUFJFRklYLCBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3RGVsZWdhdGUsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBSZXN1bHRLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ1Jlc29sdmVyLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGljaywgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLCBBY2Nlc3NpYmlsaXR5V29ya2JlbmNoU2V0dGluZ0lkLCBhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24sIGFjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzLCBhY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLCBhY2Nlc3NpYmxlVmlld0dvVG9TeW1ib2xTdXBwb3J0ZWQsIGFjY2Vzc2libGVWaWV3SGFzQXNzaWduZWRLZXliaW5kaW5ncywgYWNjZXNzaWJsZVZpZXdIYXNVbmFzc2lnbmVkS2V5YmluZGluZ3MsIGFjY2Vzc2libGVWaWV3SW5Db2RlQmxvY2ssIGFjY2Vzc2libGVWaWV3SXNTaG93biwgYWNjZXNzaWJsZVZpZXdPbkxhc3RMaW5lLCBhY2Nlc3NpYmxlVmlld1N1cHBvcnRzTmF2aWdhdGlvbiwgYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkIH0gZnJvbSAnLi9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29udGVudEFuZEtleWJpbmRpbmdJdGVtcyB9IGZyb20gJy4vYWNjZXNzaWJsZVZpZXdLZXliaW5kaW5nUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uL2NvbW1vbi9hY2Nlc3NpYmlsaXR5Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNoYXRDb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY2hhdC9icm93c2VyL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvY29kZUJsb2NrUGFydC5qcyc7XG5pbXBvcnQgeyBnZXRTaW1wbGVFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3NpbXBsZUVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5cbmNvbnN0IGVudW0gRElNRU5TSU9OUyB7XG5cdE1BWF9XSURUSCA9IDYwMFxufVxuXG5leHBvcnQgdHlwZSBBY2Nlc2libGVWaWV3Q29udGVudFByb3ZpZGVyID0gQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlciB8IEV4dGVuc2lvbkNvbnRlbnRQcm92aWRlcjtcblxuaW50ZXJmYWNlIElDb2RlQmxvY2sge1xuXHRzdGFydExpbmU6IG51bWJlcjtcblx0ZW5kTGluZTogbnVtYmVyO1xuXHRjb2RlOiBzdHJpbmc7XG5cdGxhbmd1YWdlSWQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBY2Nlc3NpYmxlVmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIHtcblx0cHJpdmF0ZSBfZWRpdG9yV2lkZ2V0OiBDb2RlRWRpdG9yV2lkZ2V0O1xuXG5cdHByaXZhdGUgX2FjY2Vzc2libGl0eUhlbHBJc1Nob3duOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfb25MYXN0TGluZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2FjY2Vzc2libGVWaWV3SXNTaG93bjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2FjY2Vzc2libGVWaWV3U3VwcG9ydHNOYXZpZ2F0aW9uOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfYWNjZXNzaWJsZVZpZXdHb1RvU3ltYm9sU3VwcG9ydGVkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZDogSUNvbnRleHRLZXk8c3RyaW5nPjtcblx0cHJpdmF0ZSBfYWNjZXNzaWJsZVZpZXdJbkNvZGVCbG9jazogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2FjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfaGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfaGFzQXNzaWduZWRLZXliaW5kaW5nczogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBfY29kZUJsb2Nrcz86IElDb2RlQmxvY2tbXTtcblx0cHJpdmF0ZSBfaXNJblF1aWNrUGljazogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGdldCBlZGl0b3JXaWRnZXQoKSB7IHJldHVybiB0aGlzLl9lZGl0b3JXaWRnZXQ7IH1cblx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfdGl0bGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b29sYmFyOiBXb3JrYmVuY2hUb29sQmFyO1xuXG5cdHByaXZhdGUgX2N1cnJlbnRQcm92aWRlcjogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VycmVudENvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9sYXN0UHJvdmlkZXI6IEFjY2VzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfdmlld0NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ2hhdENvZGVCbG9ja0NvbnRleHRQcm92aWRlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29kZUJsb2NrQ29udGV4dFByb3ZpZGVyU2VydmljZTogSUNoYXRDb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fYWNjZXNzaWJsaXR5SGVscElzU2hvd24gPSBhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24uYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0lzU2hvd24gPSBhY2Nlc3NpYmxlVmlld0lzU2hvd24uYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld1N1cHBvcnRzTmF2aWdhdGlvbiA9IGFjY2Vzc2libGVWaWV3U3VwcG9ydHNOYXZpZ2F0aW9uLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkID0gYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdHb1RvU3ltYm9sU3VwcG9ydGVkID0gYWNjZXNzaWJsZVZpZXdHb1RvU3ltYm9sU3VwcG9ydGVkLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZCA9IGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0luQ29kZUJsb2NrID0gYWNjZXNzaWJsZVZpZXdJbkNvZGVCbG9jay5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzID0gYWNjZXNzaWJsZVZpZXdDb250YWluc0NvZGVCbG9ja3MuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9vbkxhc3RMaW5lID0gYWNjZXNzaWJsZVZpZXdPbkxhc3RMaW5lLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzID0gYWNjZXNzaWJsZVZpZXdIYXNVbmFzc2lnbmVkS2V5YmluZGluZ3MuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNBc3NpZ25lZEtleWJpbmRpbmdzID0gYWNjZXNzaWJsZVZpZXdIYXNBc3NpZ25lZEtleWJpbmRpbmdzLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnYWNjZXNzaWJsZS12aWV3Jyk7XG5cdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuSGlkZUFjY2Vzc2libGVWaWV3KSkge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHR9XG5cdFx0Y29uc3QgY29kZUVkaXRvcldpZGdldE9wdGlvbnM6IElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyA9IHtcblx0XHRcdGNvbnRyaWJ1dGlvbnM6IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRFZGl0b3JDb250cmlidXRpb25zKCkuZmlsdGVyKGMgPT4gYy5pZCAhPT0gQ29kZUFjdGlvbkNvbnRyb2xsZXIuSUQpXG5cdFx0fTtcblx0XHRjb25zdCB0aXRsZUJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRpdGxlQmFyLmNsYXNzTGlzdC5hZGQoJ2FjY2Vzc2libGUtdmlldy10aXRsZS1iYXInKTtcblx0XHR0aGlzLl90aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX3RpdGxlLmNsYXNzTGlzdC5hZGQoJ2FjY2Vzc2libGUtdmlldy10aXRsZScpO1xuXHRcdHRpdGxlQmFyLmFwcGVuZENoaWxkKHRoaXMuX3RpdGxlKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRhY3Rpb25CYXIuY2xhc3NMaXN0LmFkZCgnYWNjZXNzaWJsZS12aWV3LWFjdGlvbi1iYXInKTtcblx0XHR0aXRsZUJhci5hcHBlbmRDaGlsZChhY3Rpb25CYXIpO1xuXHRcdHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aXRsZUJhcik7XG5cdFx0dGhpcy5fdG9vbGJhciA9IHRoaXMuX3JlZ2lzdGVyKF9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLCBhY3Rpb25CYXIsIHsgb3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMIH0pKTtcblx0XHR0aGlzLl90b29sYmFyLmNvbnRleHQgPSB7IHZpZXdJZDogJ2FjY2Vzc2libGVWaWV3JyB9O1xuXHRcdGNvbnN0IHRvb2xiYXJFbHQgPSB0aGlzLl90b29sYmFyLmdldEVsZW1lbnQoKTtcblx0XHR0b29sYmFyRWx0LnRhYkluZGV4ID0gMDtcblxuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnM6IElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zID0ge1xuXHRcdFx0Li4uZ2V0U2ltcGxlRWRpdG9yT3B0aW9ucyh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSksXG5cdFx0XHRsaW5lRGVjb3JhdGlvbnNXaWR0aDogNixcblx0XHRcdGRyYWdBbmREcm9wOiBmYWxzZSxcblx0XHRcdGN1cnNvcldpZHRoOiAxLFxuXHRcdFx0d29yZFdyYXA6ICdvZmYnLFxuXHRcdFx0d3JhcHBpbmdTdHJhdGVneTogJ2FkdmFuY2VkJyxcblx0XHRcdHdyYXBwaW5nSW5kZW50OiAnbm9uZScsXG5cdFx0XHRwYWRkaW5nOiB7IHRvcDogMiwgYm90dG9tOiAyIH0sXG5cdFx0XHRxdWlja1N1Z2dlc3Rpb25zOiBmYWxzZSxcblx0XHRcdHJlbmRlcldoaXRlc3BhY2U6ICdub25lJyxcblx0XHRcdGRyb3BJbnRvRWRpdG9yOiB7IGVuYWJsZWQ6IGZhbHNlIH0sXG5cdFx0XHRyZWFkT25seTogdHJ1ZSxcblx0XHRcdGZvbnRGYW1pbHk6ICd2YXIoLS1tb25hY28tbW9ub3NwYWNlLWZvbnQpJ1xuXHRcdH07XG5cdFx0dGhpcy50ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoU2NoZW1hcy5hY2Nlc3NpYmxlVmlldywgdGhpcyk7XG5cblx0XHR0aGlzLl9lZGl0b3JXaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlRWRpdG9yV2lkZ2V0LCB0aGlzLl9jb250YWluZXIsIGVkaXRvck9wdGlvbnMsIGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2Uub25EaWRDaGFuZ2VTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRQcm92aWRlciAmJiB0aGlzLl9hY2Nlc3NpYmxpdHlIZWxwSXNTaG93bi5nZXQoKSkge1xuXHRcdFx0XHR0aGlzLnNob3codGhpcy5fY3VycmVudFByb3ZpZGVyKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGlzSUFjY2Vzc2libGVWaWV3Q29udGVudFByb3ZpZGVyKHRoaXMuX2N1cnJlbnRQcm92aWRlcikgJiYgZS5hZmZlY3RzQ29uZmlndXJhdGlvbih0aGlzLl9jdXJyZW50UHJvdmlkZXIudmVyYm9zaXR5U2V0dGluZ0tleSkpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2FjY2Vzc2libGl0eUhlbHBJc1Nob3duLmdldCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93KHRoaXMuX2N1cnJlbnRQcm92aWRlcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkLnNldCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSh0aGlzLl9jdXJyZW50UHJvdmlkZXIudmVyYm9zaXR5U2V0dGluZ0tleSkpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVUb29sYmFyKHRoaXMuX2N1cnJlbnRQcm92aWRlci5hY3Rpb25zLCB0aGlzLl9jdXJyZW50UHJvdmlkZXIub3B0aW9ucy50eXBlKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuSGlkZUFjY2Vzc2libGVWaWV3KSkge1xuXHRcdFx0XHR0aGlzLl9jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuSGlkZUFjY2Vzc2libGVWaWV3KSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcldpZGdldC5vbkRpZERpc3Bvc2UoKCkgPT4gdGhpcy5fcmVzZXRDb250ZXh0S2V5cygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yV2lkZ2V0Lm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25MYXN0TGluZS5zZXQodGhpcy5fZWRpdG9yV2lkZ2V0LmdldFBvc2l0aW9uKCk/LmxpbmVOdW1iZXIgPT09IHRoaXMuX2VkaXRvcldpZGdldC5nZXRNb2RlbCgpPy5nZXRMaW5lQ291bnQoKSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcldpZGdldC5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCgpID0+IHtcblx0XHRcdGNvbnN0IGN1cnNvclBvc2l0aW9uID0gdGhpcy5fZWRpdG9yV2lkZ2V0LmdldFBvc2l0aW9uKCk/LmxpbmVOdW1iZXI7XG5cdFx0XHRpZiAodGhpcy5fY29kZUJsb2NrcyAmJiBjdXJzb3JQb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGluQ29kZUJsb2NrID0gdGhpcy5fY29kZUJsb2Nrcy5maW5kKGMgPT4gYy5zdGFydExpbmUgPD0gY3Vyc29yUG9zaXRpb24gJiYgYy5lbmRMaW5lID49IGN1cnNvclBvc2l0aW9uKSAhPT0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0luQ29kZUJsb2NrLnNldChpbkNvZGVCbG9jayk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cdHByb3ZpZGVUZXh0Q29udGVudChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJVGV4dE1vZGVsIHwgbnVsbD4gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0VGV4dE1vZGVsKHJlc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc2V0Q29udGV4dEtleXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsaXR5SGVscElzU2hvd24ucmVzZXQoKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0lzU2hvd24ucmVzZXQoKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld1N1cHBvcnRzTmF2aWdhdGlvbi5yZXNldCgpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3VmVyYm9zaXR5RW5hYmxlZC5yZXNldCgpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3R29Ub1N5bWJvbFN1cHBvcnRlZC5yZXNldCgpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQucmVzZXQoKTtcblx0XHR0aGlzLl9oYXNBc3NpZ25lZEtleWJpbmRpbmdzLnJlc2V0KCk7XG5cdFx0dGhpcy5faGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzLnJlc2V0KCk7XG5cdH1cblxuXHRnZXRQb3NpdGlvbihpZD86IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCk6IFBvc2l0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWlkIHx8ICF0aGlzLl9sYXN0UHJvdmlkZXIgfHwgdGhpcy5fbGFzdFByb3ZpZGVyLmlkICE9PSBpZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvcldpZGdldC5nZXRQb3NpdGlvbigpIHx8IHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldFBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbiwgcmV2ZWFsPzogYm9vbGVhbiwgc2VsZWN0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvcldpZGdldC5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0aWYgKHJldmVhbCkge1xuXHRcdFx0dGhpcy5fZWRpdG9yV2lkZ2V0LnJldmVhbFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHR9XG5cdFx0aWYgKHNlbGVjdCkge1xuXHRcdFx0Y29uc3QgbGluZUxlbmd0aCA9IHRoaXMuX2VkaXRvcldpZGdldC5nZXRNb2RlbCgpPy5nZXRMaW5lTGVuZ3RoKHBvc2l0aW9uLmxpbmVOdW1iZXIpID8/IDA7XG5cdFx0XHRpZiAobGluZUxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JXaWRnZXQuc2V0U2VsZWN0aW9uKHsgc3RhcnRMaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciwgZW5kQ29sdW1uOiBsaW5lTGVuZ3RoICsgMSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRDb2RlQmxvY2tDb250ZXh0KCk6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX2VkaXRvcldpZGdldC5nZXRQb3NpdGlvbigpO1xuXHRcdGlmICghdGhpcy5fY29kZUJsb2Nrcz8ubGVuZ3RoIHx8ICFwb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjb2RlQmxvY2tJbmRleCA9IHRoaXMuX2NvZGVCbG9ja3M/LmZpbmRJbmRleChjID0+IGMuc3RhcnRMaW5lIDw9IHBvc2l0aW9uPy5saW5lTnVtYmVyICYmIGMuZW5kTGluZSA+PSBwb3NpdGlvbj8ubGluZU51bWJlcik7XG5cdFx0Y29uc3QgY29kZUJsb2NrID0gY29kZUJsb2NrSW5kZXggIT09IHVuZGVmaW5lZCAmJiBjb2RlQmxvY2tJbmRleCA+IC0xID8gdGhpcy5fY29kZUJsb2Nrc1tjb2RlQmxvY2tJbmRleF0gOiB1bmRlZmluZWQ7XG5cdFx0aWYgKCFjb2RlQmxvY2sgfHwgY29kZUJsb2NrSW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4geyBjb2RlOiBjb2RlQmxvY2suY29kZSwgbGFuZ3VhZ2VJZDogY29kZUJsb2NrLmxhbmd1YWdlSWQsIGNvZGVCbG9ja0luZGV4LCBlbGVtZW50OiB1bmRlZmluZWQgfTtcblx0fVxuXG5cdG5hdmlnYXRlVG9Db2RlQmxvY2sodHlwZTogJ25leHQnIHwgJ3ByZXZpb3VzJyk6IHZvaWQge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fZWRpdG9yV2lkZ2V0LmdldFBvc2l0aW9uKCk7XG5cdFx0aWYgKCF0aGlzLl9jb2RlQmxvY2tzPy5sZW5ndGggfHwgIXBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBjb2RlQmxvY2s7XG5cdFx0Y29uc3QgY29kZUJsb2NrcyA9IHRoaXMuX2NvZGVCbG9ja3Muc2xpY2UoKTtcblx0XHRpZiAodHlwZSA9PT0gJ3ByZXZpb3VzJykge1xuXHRcdFx0Y29kZUJsb2NrID0gY29kZUJsb2Nrcy5yZXZlcnNlKCkuZmluZChjID0+IGMuZW5kTGluZSA8IHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb2RlQmxvY2sgPSBjb2RlQmxvY2tzLmZpbmQoYyA9PiBjLnN0YXJ0TGluZSA+IHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdH1cblx0XHRpZiAoIWNvZGVCbG9jaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbihjb2RlQmxvY2suc3RhcnRMaW5lLCAxKSwgdHJ1ZSk7XG5cdH1cblxuXHRzaG93TGFzdFByb3ZpZGVyKGlkOiBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2xhc3RQcm92aWRlciB8fCB0aGlzLl9sYXN0UHJvdmlkZXIub3B0aW9ucy5pZCAhPT0gaWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5zaG93KHRoaXMuX2xhc3RQcm92aWRlcik7XG5cdH1cblxuXHRzaG93KHByb3ZpZGVyPzogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlciwgc3ltYm9sPzogSUFjY2Vzc2libGVWaWV3U3ltYm9sLCBzaG93QWNjZXNzaWJsZVZpZXdIZWxwPzogYm9vbGVhbiwgcG9zaXRpb24/OiBJUG9zaXRpb24pOiB2b2lkIHtcblx0XHRwcm92aWRlciA9IHByb3ZpZGVyID8/IHRoaXMuX2N1cnJlbnRQcm92aWRlcjtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHByb3ZpZGVyLm9uT3Blbj8uKCk7XG5cdFx0Y29uc3QgZGVsZWdhdGU6IElDb250ZXh0Vmlld0RlbGVnYXRlID0ge1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB7IHJldHVybiB7IHg6IChnZXRBY3RpdmVXaW5kb3coKS5pbm5lcldpZHRoIC8gMikgLSAoKE1hdGgubWluKHRoaXMuX2xheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyRGltZW5zaW9uLndpZHRoICogMC42MiAvKiBnb2xkZW4gY3V0ICovLCBESU1FTlNJT05TLk1BWF9XSURUSCkpIC8gMiksIHk6IHRoaXMuX2xheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyT2Zmc2V0LnF1aWNrUGlja1RvcCB9OyB9LFxuXHRcdFx0cmVuZGVyOiAoY29udGFpbmVyKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3ZpZXdDb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0XHRcdHRoaXMuX3ZpZXdDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnYWNjZXNzaWJsZS12aWV3LWNvbnRhaW5lcicpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyKHByb3ZpZGVyLCBjb250YWluZXIsIHNob3dBY2Nlc3NpYmxlVmlld0hlbHApO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXNob3dBY2Nlc3NpYmxlVmlld0hlbHApIHtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVMYXN0UHJvdmlkZXIoKTtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50UHJvdmlkZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50UHJvdmlkZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0dGhpcy5fcmVzZXRDb250ZXh0S2V5cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2Uuc2hvd0NvbnRleHRWaWV3KGRlbGVnYXRlKTtcblxuXHRcdGlmIChwb3NpdGlvbikge1xuXHRcdFx0Ly8gQ29udGV4dCB2aWV3IHRha2VzIHRpbWUgdG8gc2hvdyB1cCwgc28gd2UgbmVlZCB0byB3YWl0IGZvciBpdCB0byBzaG93IHVwIGJlZm9yZSB3ZSBjYW4gc2V0IHRoZSBwb3NpdGlvblxuXHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JXaWRnZXQucmV2ZWFsTGluZShwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yV2lkZ2V0LnNldFNlbGVjdGlvbih7IHN0YXJ0TGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciwgc3RhcnRDb2x1bW46IHBvc2l0aW9uLmNvbHVtbiwgZW5kTGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlciwgZW5kQ29sdW1uOiBwb3NpdGlvbi5jb2x1bW4gfSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoc3ltYm9sICYmIHRoaXMuX2N1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0dGhpcy5zaG93U3ltYm9sKHRoaXMuX2N1cnJlbnRQcm92aWRlciwgc3ltYm9sKTtcblx0XHR9XG5cdFx0aWYgKHByb3ZpZGVyIGluc3RhbmNlb2YgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlciAmJiBwcm92aWRlci5vbkRpZFJlcXVlc3RDbGVhckxhc3RQcm92aWRlcikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocHJvdmlkZXIub25EaWRSZXF1ZXN0Q2xlYXJMYXN0UHJvdmlkZXIoKGlkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2xhc3RQcm92aWRlcj8ub3B0aW9ucy5pZCA9PT0gaWQpIHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0UHJvdmlkZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0aWYgKHByb3ZpZGVyLm9wdGlvbnMuaWQpIHtcblx0XHRcdC8vIG9ubHkgY2FjaGUgYSBwcm92aWRlciB3aXRoIGFuIElEIHNvIHRoYXQgaXQgd2lsbCBldmVudHVhbGx5IGJlIGNsZWFyZWQuXG5cdFx0XHR0aGlzLl9sYXN0UHJvdmlkZXIgPSBwcm92aWRlcjtcblx0XHR9XG5cdFx0aWYgKHByb3ZpZGVyLmlkID09PSBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuUGFuZWxDaGF0IHx8IHByb3ZpZGVyLmlkID09PSBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuUXVpY2tDaGF0KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoeyBnZXRDb2RlQmxvY2tDb250ZXh0OiAoKSA9PiB0aGlzLmdldENvZGVCbG9ja0NvbnRleHQoKSB9LCAnYWNjZXNzaWJsZVZpZXcnKSk7XG5cdFx0fVxuXHRcdGlmIChwcm92aWRlciBpbnN0YW5jZW9mIEV4dGVuc2lvbkNvbnRlbnRQcm92aWRlcikge1xuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoYCR7QUNDRVNTSUJMRV9WSUVXX1NIT1dOX1NUT1JBR0VfUFJFRklYfSR7cHJvdmlkZXIuaWR9YCwgdHJ1ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdH1cblx0XHRpZiAocHJvdmlkZXIub25EaWRDaGFuZ2VDb250ZW50KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihwcm92aWRlci5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fdmlld0NvbnRhaW5lcikgeyB0aGlzLl9yZW5kZXIocHJvdmlkZXIsIHRoaXMuX3ZpZXdDb250YWluZXIsIHNob3dBY2Nlc3NpYmxlVmlld0hlbHApOyB9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJldmlvdXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3Q29udGVudCA9IHRoaXMuX2N1cnJlbnRQcm92aWRlcj8ucHJvdmlkZVByZXZpb3VzQ29udGVudD8uKCk7XG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50UHJvdmlkZXIgfHwgIXRoaXMuX3ZpZXdDb250YWluZXIgfHwgIW5ld0NvbnRlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmVuZGVyKHRoaXMuX2N1cnJlbnRQcm92aWRlciwgdGhpcy5fdmlld0NvbnRhaW5lciwgdW5kZWZpbmVkLCBuZXdDb250ZW50KTtcblx0fVxuXG5cdG5leHQoKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3Q29udGVudCA9IHRoaXMuX2N1cnJlbnRQcm92aWRlcj8ucHJvdmlkZU5leHRDb250ZW50Py4oKTtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRQcm92aWRlciB8fCAhdGhpcy5fdmlld0NvbnRhaW5lciB8fCAhbmV3Q29udGVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9yZW5kZXIodGhpcy5fY3VycmVudFByb3ZpZGVyLCB0aGlzLl92aWV3Q29udGFpbmVyLCB1bmRlZmluZWQsIG5ld0NvbnRlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdmVyYm9zaXR5RW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gaXNJQWNjZXNzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIodGhpcy5fY3VycmVudFByb3ZpZGVyKSA/IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHRoaXMuX2N1cnJlbnRQcm92aWRlci52ZXJib3NpdHlTZXR0aW5nS2V5KSA9PT0gdHJ1ZSA6IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oYCR7QUNDRVNTSUJMRV9WSUVXX1NIT1dOX1NUT1JBR0VfUFJFRklYfSR7dGhpcy5fY3VycmVudFByb3ZpZGVyLmlkfWAsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpO1xuXHR9XG5cblx0Z29Ub1N5bWJvbCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRQcm92aWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc0luUXVpY2tQaWNrID0gdHJ1ZTtcblx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBY2Nlc3NpYmxlVmlld1N5bWJvbFF1aWNrUGljaywgdGhpcykuc2hvdyh0aGlzLl9jdXJyZW50UHJvdmlkZXIpO1xuXHR9XG5cblx0Y2FsY3VsYXRlQ29kZUJsb2NrcyhtYXJrZG93bj86IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghbWFya2Rvd24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRQcm92aWRlcj8uaWQgIT09IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5QYW5lbENoYXQgJiYgdGhpcy5fY3VycmVudFByb3ZpZGVyPy5pZCAhPT0gQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLlF1aWNrQ2hhdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY3VycmVudFByb3ZpZGVyLm9wdGlvbnMubGFuZ3VhZ2UgJiYgdGhpcy5fY3VycmVudFByb3ZpZGVyLm9wdGlvbnMubGFuZ3VhZ2UgIT09ICdtYXJrZG93bicpIHtcblx0XHRcdC8vIFN5bWJvbHMgaGF2ZW4ndCBiZWVuIHByb3ZpZGVkIGFuZCB3ZSBjYW5ub3QgcGFyc2UgdGhpcyBsYW5ndWFnZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lcyA9IG1hcmtkb3duLnNwbGl0KCdcXG4nKTtcblx0XHR0aGlzLl9jb2RlQmxvY2tzID0gW107XG5cdFx0bGV0IGluQmxvY2sgPSBmYWxzZTtcblx0XHRsZXQgc3RhcnRMaW5lID0gMDtcblxuXHRcdGxldCBsYW5ndWFnZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGluZXMuZm9yRWFjaCgobGluZSwgaSkgPT4ge1xuXHRcdFx0aWYgKCFpbkJsb2NrICYmIGxpbmUuc3RhcnRzV2l0aCgnYGBgJykpIHtcblx0XHRcdFx0aW5CbG9jayA9IHRydWU7XG5cdFx0XHRcdHN0YXJ0TGluZSA9IGkgKyAxO1xuXHRcdFx0XHRsYW5ndWFnZUlkID0gbGluZS5zdWJzdHJpbmcoMykudHJpbSgpO1xuXHRcdFx0fSBlbHNlIGlmIChpbkJsb2NrICYmIGxpbmUuZW5kc1dpdGgoJ2BgYCcpKSB7XG5cdFx0XHRcdGluQmxvY2sgPSBmYWxzZTtcblx0XHRcdFx0Y29uc3QgZW5kTGluZSA9IGk7XG5cdFx0XHRcdGNvbnN0IGNvZGUgPSBsaW5lcy5zbGljZShzdGFydExpbmUsIGVuZExpbmUpLmpvaW4oJ1xcbicpO1xuXHRcdFx0XHR0aGlzLl9jb2RlQmxvY2tzPy5wdXNoKHsgc3RhcnRMaW5lLCBlbmRMaW5lLCBjb2RlLCBsYW5ndWFnZUlkIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzLnNldCh0aGlzLl9jb2RlQmxvY2tzLmxlbmd0aCA+IDApO1xuXHR9XG5cblx0Z2V0U3ltYm9scygpOiBJQWNjZXNzaWJsZVZpZXdTeW1ib2xbXSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jdXJyZW50UHJvdmlkZXIgPyB0aGlzLl9jdXJyZW50UHJvdmlkZXIgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50Q29udGVudCB8fCAhcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc3ltYm9sczogSUFjY2Vzc2libGVWaWV3U3ltYm9sW10gPSAnZ2V0U3ltYm9scycgaW4gcHJvdmlkZXIgPyBwcm92aWRlci5nZXRTeW1ib2xzPy4oKSB8fCBbXSA6IFtdO1xuXHRcdGlmIChzeW1ib2xzPy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBzeW1ib2xzO1xuXHRcdH1cblx0XHRpZiAocHJvdmlkZXIub3B0aW9ucy5sYW5ndWFnZSAmJiBwcm92aWRlci5vcHRpb25zLmxhbmd1YWdlICE9PSAnbWFya2Rvd24nKSB7XG5cdFx0XHQvLyBTeW1ib2xzIGhhdmVuJ3QgYmVlbiBwcm92aWRlZCBhbmQgd2UgY2Fubm90IHBhcnNlIHRoaXMgbGFuZ3VhZ2Vcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbWFya2Rvd25Ub2tlbnM6IG1hcmtlZC5Ub2tlbnNMaXN0IHwgdW5kZWZpbmVkID0gbWFya2VkLm1hcmtlZC5sZXhlcih0aGlzLl9jdXJyZW50Q29udGVudCk7XG5cdFx0aWYgKCFtYXJrZG93blRva2Vucykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jb252ZXJ0VG9rZW5zVG9TeW1ib2xzKG1hcmtkb3duVG9rZW5zLCBzeW1ib2xzKTtcblx0XHRyZXR1cm4gc3ltYm9scy5sZW5ndGggPyBzeW1ib2xzIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0b3BlbkhlbHBMaW5rKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fY3VycmVudFByb3ZpZGVyPy5vcHRpb25zLnJlYWRNb3JlVXJsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UodGhpcy5fY3VycmVudFByb3ZpZGVyLm9wdGlvbnMucmVhZE1vcmVVcmwpKTtcblx0fVxuXG5cdGNvbmZpZ3VyZUtleWJpbmRpbmdzKHVuYXNzaWduZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9pc0luUXVpY2tQaWNrID0gdHJ1ZTtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3VwZGF0ZUxhc3RQcm92aWRlcigpO1xuXHRcdGNvbnN0IGl0ZW1zID0gdW5hc3NpZ25lZCA/IHByb3ZpZGVyPy5vcHRpb25zPy5jb25maWd1cmVLZXliaW5kaW5nSXRlbXMgOiBwcm92aWRlcj8ub3B0aW9ucz8uY29uZmlndXJlZEtleWJpbmRpbmdJdGVtcztcblx0XHRpZiAoIWl0ZW1zKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBxdWlja1BpY2s6IElRdWlja1BpY2s8SVF1aWNrUGlja0l0ZW0+ID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljaygpKTtcblx0XHRxdWlja1BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRxdWlja1BpY2sudGl0bGUgPSBsb2NhbGl6ZSgna2V5YmluZGluZ3MnLCAnQ29uZmlndXJlIGtleWJpbmRpbmdzJyk7XG5cdFx0cXVpY2tQaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3NlbGVjdEtleWJpbmRpbmcnLCAnU2VsZWN0IGEgY29tbWFuZCBJRCB0byBjb25maWd1cmUgYSBrZXliaW5kaW5nIGZvciBpdCcpO1xuXHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEFjY2VwdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpdGVtID0gcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF07XG5cdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuR2xvYmFsS2V5YmluZGluZ3MnLCBpdGVtLmlkKTtcblx0XHRcdH1cblx0XHRcdHF1aWNrUGljay5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdGlmICghcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMubGVuZ3RoICYmIHByb3ZpZGVyKSB7XG5cdFx0XHRcdHRoaXMuc2hvdyhwcm92aWRlcik7XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9pc0luUXVpY2tQaWNrID0gZmFsc2U7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udmVydFRva2Vuc1RvU3ltYm9scyh0b2tlbnM6IG1hcmtlZC5Ub2tlbnNMaXN0LCBzeW1ib2xzOiBJQWNjZXNzaWJsZVZpZXdTeW1ib2xbXSk6IHZvaWQge1xuXHRcdGxldCBmaXJzdExpc3RJdGVtOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCB0b2tlbiBvZiB0b2tlbnMpIHtcblx0XHRcdGxldCBsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKCd0eXBlJyBpbiB0b2tlbikge1xuXHRcdFx0XHRzd2l0Y2ggKHRva2VuLnR5cGUpIHtcblx0XHRcdFx0XHRjYXNlICdoZWFkaW5nJzpcblx0XHRcdFx0XHRjYXNlICdwYXJhZ3JhcGgnOlxuXHRcdFx0XHRcdGNhc2UgJ2NvZGUnOlxuXHRcdFx0XHRcdFx0bGFiZWwgPSB0b2tlbi50ZXh0O1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnbGlzdCc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IGZpcnN0SXRlbSA9ICh0b2tlbiBhcyBtYXJrZWQuVG9rZW5zLkxpc3QpLml0ZW1zWzBdO1xuXHRcdFx0XHRcdFx0aWYgKCFmaXJzdEl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRmaXJzdExpc3RJdGVtID0gYC0gJHtmaXJzdEl0ZW0udGV4dH1gO1xuXHRcdFx0XHRcdFx0bGFiZWwgPSAodG9rZW4gYXMgbWFya2VkLlRva2Vucy5MaXN0KS5pdGVtcy5tYXAoaSA9PiBpLnRleHQpLmpvaW4oJywgJyk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChsYWJlbCkge1xuXHRcdFx0XHRzeW1ib2xzLnB1c2goeyBtYXJrZG93blRvUGFyc2U6IGxhYmVsLCBsYWJlbDogbG9jYWxpemUoJ3N5bWJvbExhYmVsJywgXCIoezB9KSB7MX1cIiwgdG9rZW4udHlwZSwgbGFiZWwpLCBhcmlhTGFiZWw6IGxvY2FsaXplKCdzeW1ib2xMYWJlbEFyaWEnLCBcIih7MH0pIHsxfVwiLCB0b2tlbi50eXBlLCBsYWJlbCksIGZpcnN0TGlzdEl0ZW0gfSk7XG5cdFx0XHRcdGZpcnN0TGlzdEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0c2hvd1N5bWJvbChwcm92aWRlcjogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlciwgc3ltYm9sOiBJQWNjZXNzaWJsZVZpZXdTeW1ib2wpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRDb250ZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBsaW5lTnVtYmVyOiBudW1iZXIgfCB1bmRlZmluZWQgPSBzeW1ib2wubGluZU51bWJlcjtcblx0XHRjb25zdCBtYXJrZG93blRvUGFyc2UgPSBzeW1ib2wubWFya2Rvd25Ub1BhcnNlO1xuXHRcdGlmIChsaW5lTnVtYmVyID09PSB1bmRlZmluZWQgJiYgbWFya2Rvd25Ub1BhcnNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIE5vIHN5bWJvbHMgcHJvdmlkZWQgYW5kIHdlIGNhbm5vdCBwYXJzZSB0aGlzIGxhbmd1YWdlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IHVuZGVmaW5lZCAmJiBtYXJrZG93blRvUGFyc2UpIHtcblx0XHRcdC8vIE5vdGUgdGhhdCB0aGlzIHNjYWxlcyBwb29ybHksIHRodXMgaXNuJ3QgdXNlZCBmb3Igd29yc3QgY2FzZSBzY2VuYXJpb3MgbGlrZSB0aGUgdGVybWluYWwsIGZvciB3aGljaCBhIGxpbmUgbnVtYmVyIHdpbGwgYWx3YXlzIGJlIHByb3ZpZGVkLlxuXHRcdFx0Ly8gUGFyc2UgdGhlIG1hcmtkb3duIHRvIGZpbmQgdGhlIGxpbmUgbnVtYmVyXG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2N1cnJlbnRDb250ZW50LnNwbGl0KCdcXG4nKS5maW5kSW5kZXgobGluZSA9PiBsaW5lLmluY2x1ZGVzKG1hcmtkb3duVG9QYXJzZS5zcGxpdCgnXFxuJylbMF0pIHx8IChzeW1ib2wuZmlyc3RMaXN0SXRlbSAmJiBsaW5lLmluY2x1ZGVzKHN5bWJvbC5maXJzdExpc3RJdGVtKSkpID8/IC0xO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0bGluZU51bWJlciA9IGluZGV4ICsgMTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGxpbmVOdW1iZXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc0luUXVpY2tQaWNrID0gZmFsc2U7XG5cdFx0dGhpcy5zaG93KHByb3ZpZGVyLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgeyBsaW5lTnVtYmVyLCBjb2x1bW46IDEgfSk7XG5cdFx0dGhpcy5fdXBkYXRlQ29udGV4dEtleXMocHJvdmlkZXIsIHRydWUpO1xuXHR9XG5cblx0ZGlzYWJsZUhpbnQoKTogdm9pZCB7XG5cdFx0aWYgKCFpc0lBY2Nlc3NpYmxlVmlld0NvbnRlbnRQcm92aWRlcih0aGlzLl9jdXJyZW50UHJvdmlkZXIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHRoaXMuX2N1cnJlbnRQcm92aWRlcj8udmVyYm9zaXR5U2V0dGluZ0tleSwgZmFsc2UpO1xuXHRcdGFsZXJ0KGxvY2FsaXplKCdkaXNhYmxlQWNjZXNzaWJpbGl0eUhlbHAnLCAnezB9IGFjY2Vzc2liaWxpdHkgdmVyYm9zaXR5IGlzIG5vdyBkaXNhYmxlZCcsIHRoaXMuX2N1cnJlbnRQcm92aWRlci52ZXJib3NpdHlTZXR0aW5nS2V5KSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb250ZXh0S2V5cyhwcm92aWRlcjogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlciwgc2hvd246IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAocHJvdmlkZXIub3B0aW9ucy50eXBlID09PSBBY2Nlc3NpYmxlVmlld1R5cGUuSGVscCkge1xuXHRcdFx0dGhpcy5fYWNjZXNzaWJsaXR5SGVscElzU2hvd24uc2V0KHNob3duKTtcblx0XHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3SXNTaG93bi5yZXNldCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0lzU2hvd24uc2V0KHNob3duKTtcblx0XHRcdHRoaXMuX2FjY2Vzc2libGl0eUhlbHBJc1Nob3duLnJlc2V0KCk7XG5cdFx0fVxuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3U3VwcG9ydHNOYXZpZ2F0aW9uLnNldChwcm92aWRlci5wcm92aWRlTmV4dENvbnRlbnQgIT09IHVuZGVmaW5lZCB8fCBwcm92aWRlci5wcm92aWRlUHJldmlvdXNDb250ZW50ICE9PSB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3VmVyYm9zaXR5RW5hYmxlZC5zZXQodGhpcy5fdmVyYm9zaXR5RW5hYmxlZCgpKTtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0dvVG9TeW1ib2xTdXBwb3J0ZWQuc2V0KHRoaXMuX2dvVG9TeW1ib2xzU3VwcG9ydGVkKCkgPyB0aGlzLmdldFN5bWJvbHMoKT8ubGVuZ3RoISA+IDAgOiBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb250ZW50KHByb3ZpZGVyOiBBY2Nlc2libGVWaWV3Q29udGVudFByb3ZpZGVyLCB1cGRhdGVkQ29udGVudD86IHN0cmluZyk6IHZvaWQge1xuXHRcdGxldCBjb250ZW50ID0gdXBkYXRlZENvbnRlbnQgPz8gcHJvdmlkZXIucHJvdmlkZUNvbnRlbnQoKTtcblx0XHRpZiAocHJvdmlkZXIub3B0aW9ucy50eXBlID09PSBBY2Nlc3NpYmxlVmlld1R5cGUuVmlldykge1xuXHRcdFx0dGhpcy5fY3VycmVudENvbnRlbnQgPSBjb250ZW50O1xuXHRcdFx0dGhpcy5faGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNBc3NpZ25lZEtleWJpbmRpbmdzLnJlc2V0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHJlYWRNb3JlTGlua0hpbnQgPSB0aGlzLl9yZWFkTW9yZUhpbnQocHJvdmlkZXIpO1xuXHRcdGNvbnN0IGRpc2FibGVIZWxwSGludCA9IHRoaXMuX2Rpc2FibGVWZXJib3NpdHlIaW50KHByb3ZpZGVyKTtcblx0XHRjb25zdCBzY3JlZW5SZWFkZXJNb2RlSGludCA9IHRoaXMuX3NjcmVlblJlYWRlck1vZGVIaW50KHByb3ZpZGVyKTtcblx0XHRjb25zdCBleGl0VGhpc0RpYWxvZ0hpbnQgPSB0aGlzLl9leGl0RGlhbG9nSGludChwcm92aWRlcik7XG5cdFx0bGV0IGNvbmZpZ3VyZUtiSGludCA9ICcnO1xuXHRcdGxldCBjb25maWd1cmVBc3NpZ25lZEtiSGludCA9ICcnO1xuXHRcdGNvbnN0IHJlc29sdmVkQ29udGVudCA9IHJlc29sdmVDb250ZW50QW5kS2V5YmluZGluZ0l0ZW1zKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCBzY3JlZW5SZWFkZXJNb2RlSGludCArIGNvbnRlbnQgKyByZWFkTW9yZUxpbmtIaW50ICsgZGlzYWJsZUhlbHBIaW50ICsgZXhpdFRoaXNEaWFsb2dIaW50KTtcblx0XHRpZiAocmVzb2x2ZWRDb250ZW50KSB7XG5cdFx0XHRjb250ZW50ID0gcmVzb2x2ZWRDb250ZW50LmNvbnRlbnQudmFsdWU7XG5cdFx0XHRpZiAocmVzb2x2ZWRDb250ZW50LmNvbmZpZ3VyZUtleWJpbmRpbmdJdGVtcykge1xuXHRcdFx0XHRwcm92aWRlci5vcHRpb25zLmNvbmZpZ3VyZUtleWJpbmRpbmdJdGVtcyA9IHJlc29sdmVkQ29udGVudC5jb25maWd1cmVLZXliaW5kaW5nSXRlbXM7XG5cdFx0XHRcdHRoaXMuX2hhc1VuYXNzaWduZWRLZXliaW5kaW5ncy5zZXQodHJ1ZSk7XG5cdFx0XHRcdGNvbmZpZ3VyZUtiSGludCA9IHRoaXMuX2NvbmZpZ3VyZVVuYXNzaWduZWRLYkhpbnQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2hhc0Fzc2lnbmVkS2V5YmluZGluZ3MucmVzZXQoKTtcblx0XHRcdH1cblx0XHRcdGlmIChyZXNvbHZlZENvbnRlbnQuY29uZmlndXJlZEtleWJpbmRpbmdJdGVtcykge1xuXHRcdFx0XHRwcm92aWRlci5vcHRpb25zLmNvbmZpZ3VyZWRLZXliaW5kaW5nSXRlbXMgPSByZXNvbHZlZENvbnRlbnQuY29uZmlndXJlZEtleWJpbmRpbmdJdGVtcztcblx0XHRcdFx0dGhpcy5faGFzQXNzaWduZWRLZXliaW5kaW5ncy5zZXQodHJ1ZSk7XG5cdFx0XHRcdGNvbmZpZ3VyZUFzc2lnbmVkS2JIaW50ID0gdGhpcy5fY29uZmlndXJlQXNzaWduZWRLYkhpbnQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2hhc0Fzc2lnbmVkS2V5YmluZGluZ3MucmVzZXQoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudENvbnRlbnQgPSBjb250ZW50ICsgY29uZmlndXJlS2JIaW50ICsgY29uZmlndXJlQXNzaWduZWRLYkhpbnQ7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXIocHJvdmlkZXI6IEFjY2VzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHNob3dBY2Nlc3NpYmxlVmlld0hlbHA/OiBib29sZWFuLCB1cGRhdGVkQ29udGVudD86IHN0cmluZyk6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLl9jdXJyZW50UHJvdmlkZXIgPSBwcm92aWRlcjtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld0N1cnJlbnRQcm92aWRlcklkLnNldChwcm92aWRlci5pZCk7XG5cdFx0Y29uc3QgdmVyYm9zZSA9IHRoaXMuX3ZlcmJvc2l0eUVuYWJsZWQoKTtcblx0XHR0aGlzLl91cGRhdGVDb250ZW50KHByb3ZpZGVyLCB1cGRhdGVkQ29udGVudCk7XG5cdFx0dGhpcy5jYWxjdWxhdGVDb2RlQmxvY2tzKHRoaXMuX2N1cnJlbnRDb250ZW50KTtcblx0XHR0aGlzLl91cGRhdGVDb250ZXh0S2V5cyhwcm92aWRlciwgdHJ1ZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0SXNGb2N1c2VkID0gdGhpcy5fZWRpdG9yV2lkZ2V0Lmhhc1RleHRGb2N1cygpIHx8IHRoaXMuX2VkaXRvcldpZGdldC5oYXNXaWRnZXRGb2N1cygpO1xuXHRcdHRoaXMuX2dldFRleHRNb2RlbChVUkkuZnJvbSh7IHBhdGg6IGBhY2Nlc3NpYmxlLXZpZXctJHtwcm92aWRlci5pZH1gLCBzY2hlbWU6IFNjaGVtYXMuYWNjZXNzaWJsZVZpZXcsIGZyYWdtZW50OiB0aGlzLl9jdXJyZW50Q29udGVudCB9KSkudGhlbigobW9kZWwpID0+IHtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZWRpdG9yV2lkZ2V0LnNldE1vZGVsKG1vZGVsKTtcblx0XHRcdGNvbnN0IGRvbU5vZGUgPSB0aGlzLl9lZGl0b3JXaWRnZXQuZ2V0RG9tTm9kZSgpO1xuXHRcdFx0aWYgKCFkb21Ob2RlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1vZGVsLnNldExhbmd1YWdlKHByb3ZpZGVyLm9wdGlvbnMubGFuZ3VhZ2UgPz8gJ21hcmtkb3duJyk7XG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcblx0XHRcdGxldCBhY3Rpb25zSGludCA9ICcnO1xuXHRcdFx0Y29uc3QgaGFzQWN0aW9ucyA9IHRoaXMuX2FjY2Vzc2libGVWaWV3U3VwcG9ydHNOYXZpZ2F0aW9uLmdldCgpIHx8IHRoaXMuX2FjY2Vzc2libGVWaWV3VmVyYm9zaXR5RW5hYmxlZC5nZXQoKSB8fCB0aGlzLl9hY2Nlc3NpYmxlVmlld0dvVG9TeW1ib2xTdXBwb3J0ZWQuZ2V0KCkgfHwgcHJvdmlkZXIuYWN0aW9ucz8ubGVuZ3RoO1xuXHRcdFx0aWYgKHZlcmJvc2UgJiYgIXNob3dBY2Nlc3NpYmxlVmlld0hlbHAgJiYgaGFzQWN0aW9ucykge1xuXHRcdFx0XHRhY3Rpb25zSGludCA9IHByb3ZpZGVyLm9wdGlvbnMucG9zaXRpb24gPyBsb2NhbGl6ZSgnYXJpYUFjY2Vzc2libGVWaWV3QWN0aW9uc0JvdHRvbScsICdFeHBsb3JlIGFjdGlvbnMgc3VjaCBhcyBkaXNhYmxpbmcgdGhpcyBoaW50IChTaGlmdCtUYWIpLCB1c2UgRXNjYXBlIHRvIGV4aXQgdGhpcyBkaWFsb2cuJykgOiBsb2NhbGl6ZSgnYXJpYUFjY2Vzc2libGVWaWV3QWN0aW9ucycsICdFeHBsb3JlIGFjdGlvbnMgc3VjaCBhcyBkaXNhYmxpbmcgdGhpcyBoaW50IChTaGlmdCtUYWIpLicpO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGFyaWFMYWJlbCA9IHByb3ZpZGVyLm9wdGlvbnMudHlwZSA9PT0gQWNjZXNzaWJsZVZpZXdUeXBlLkhlbHAgPyBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS1oZWxwJywgXCJBY2Nlc3NpYmlsaXR5IEhlbHBcIikgOiBsb2NhbGl6ZSgnYWNjZXNzaWJsZS12aWV3JywgXCJBY2Nlc3NpYmxlIFZpZXdcIik7XG5cdFx0XHR0aGlzLl90aXRsZS50ZXh0Q29udGVudCA9IGFyaWFMYWJlbDtcblx0XHRcdGlmIChhY3Rpb25zSGludCAmJiBwcm92aWRlci5vcHRpb25zLnR5cGUgPT09IEFjY2Vzc2libGVWaWV3VHlwZS5WaWV3KSB7XG5cdFx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdhY2Nlc3NpYmxlLXZpZXctaGludCcsIFwiQWNjZXNzaWJsZSBWaWV3LCB7MH1cIiwgYWN0aW9uc0hpbnQpO1xuXHRcdFx0fSBlbHNlIGlmIChhY3Rpb25zSGludCkge1xuXHRcdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS1oZWxwLWhpbnQnLCBcIkFjY2Vzc2liaWxpdHkgSGVscCwgezB9XCIsIGFjdGlvbnNIaW50KTtcblx0XHRcdH1cblx0XHRcdGlmIChpc1dpbmRvd3MgJiYgd2lkZ2V0SXNGb2N1c2VkKSB7XG5cdFx0XHRcdC8vIHByZXZlbnQgdGhlIHNjcmVlbiByZWFkZXIgb24gd2luZG93cyBmcm9tIHJlYWRpbmdcblx0XHRcdFx0Ly8gdGhlIGFyaWEgbGFiZWwgYWdhaW4gd2hlbiBpdCdzIHJlZm9jdXNlZFxuXHRcdFx0XHRhcmlhTGFiZWwgPSAnJztcblx0XHRcdH1cblx0XHRcdHRoaXMuX2VkaXRvcldpZGdldC51cGRhdGVPcHRpb25zKHsgYXJpYUxhYmVsIH0pO1xuXHRcdFx0dGhpcy5fZWRpdG9yV2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudFByb3ZpZGVyPy5vcHRpb25zLnBvc2l0aW9uKSB7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fZWRpdG9yV2lkZ2V0LmdldFBvc2l0aW9uKCk7XG5cdFx0XHRcdGNvbnN0IGlzRGVmYXVsdFBvc2l0aW9uID0gcG9zaXRpb24/LmxpbmVOdW1iZXIgPT09IDEgJiYgcG9zaXRpb24uY29sdW1uID09PSAxO1xuXHRcdFx0XHRpZiAodGhpcy5fY3VycmVudFByb3ZpZGVyLm9wdGlvbnMucG9zaXRpb24gPT09ICdib3R0b20nIHx8IHRoaXMuX2N1cnJlbnRQcm92aWRlci5vcHRpb25zLnBvc2l0aW9uID09PSAnaW5pdGlhbC1ib3R0b20nICYmIGlzRGVmYXVsdFBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFzdExpbmUgPSB0aGlzLmVkaXRvcldpZGdldC5nZXRNb2RlbCgpPy5nZXRMaW5lQ291bnQoKTtcblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGxhc3RMaW5lICE9PSB1bmRlZmluZWQgJiYgbGFzdExpbmUgPiAwID8gbmV3IFBvc2l0aW9uKGxhc3RMaW5lLCAxKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAocG9zaXRpb24pIHtcblx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvcldpZGdldC5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0XHRcdFx0XHR0aGlzLl9lZGl0b3JXaWRnZXQucmV2ZWFsTGluZShwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl91cGRhdGVUb29sYmFyKHRoaXMuX2N1cnJlbnRQcm92aWRlci5hY3Rpb25zLCBwcm92aWRlci5vcHRpb25zLnR5cGUpO1xuXG5cdFx0Y29uc3QgaGlkZSA9IChlPzogS2V5Ym9hcmRFdmVudCB8IElLZXlib2FyZEV2ZW50KTogdm9pZCA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lzSW5RdWlja1BpY2spIHtcblx0XHRcdFx0cHJvdmlkZXIub25DbG9zZSgpO1xuXHRcdFx0fVxuXHRcdFx0ZT8uc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UuaGlkZUNvbnRleHRWaWV3KCk7XG5cdFx0XHRpZiAodGhpcy5faXNJblF1aWNrUGljaykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl91cGRhdGVDb250ZXh0S2V5cyhwcm92aWRlciwgZmFsc2UpO1xuXHRcdFx0dGhpcy5fbGFzdFByb3ZpZGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fY3VycmVudENvbnRlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9jdXJyZW50UHJvdmlkZXI/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX2N1cnJlbnRQcm92aWRlciA9IHVuZGVmaW5lZDtcblx0XHR9O1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2VkaXRvcldpZGdldC5vbktleURvd24oKGUpID0+IHtcblx0XHRcdGlmIChlLmtleUNvZGUgPT09IEtleUNvZGUuRW50ZXIpIHtcblx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2VkaXRvci5hY3Rpb24ub3BlbkxpbmsnKTtcblx0XHRcdH0gZWxzZSBpZiAoZS5rZXlDb2RlID09PSBLZXlDb2RlLkVzY2FwZSB8fCBzaG91bGRIaWRlKGUuYnJvd3NlckV2ZW50LCB0aGlzLl9rZXliaW5kaW5nU2VydmljZSwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpKSB7XG5cdFx0XHRcdGhpZGUoZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGUua2V5Q29kZSA9PT0gS2V5Q29kZS5LZXlIICYmIHByb3ZpZGVyLm9wdGlvbnMucmVhZE1vcmVVcmwpIHtcblx0XHRcdFx0Y29uc3QgdXJsOiBzdHJpbmcgPSBwcm92aWRlci5vcHRpb25zLnJlYWRNb3JlVXJsO1xuXHRcdFx0XHRhbGVydChBY2Nlc3NpYmlsaXR5SGVscE5MUy5vcGVuaW5nRG9jcyk7XG5cdFx0XHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UodXJsKSk7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHRcdGlmIChwcm92aWRlciBpbnN0YW5jZW9mIEFjY2Vzc2libGVDb250ZW50UHJvdmlkZXIpIHtcblx0XHRcdFx0cHJvdmlkZXIub25LZXlEb3duPy4oZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3Rvb2xiYXIuZ2V0RWxlbWVudCgpLCBFdmVudFR5cGUuS0VZX0RPV04sIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBrZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0aGlkZShlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLl9lZGl0b3JXaWRnZXQub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHtcblx0XHRcdGlmICghaXNBY3RpdmVFbGVtZW50KHRoaXMuX3Rvb2xiYXIuZ2V0RWxlbWVudCgpKSkge1xuXHRcdFx0XHRoaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fZWRpdG9yV2lkZ2V0Lm9uRGlkQ29udGVudFNpemVDaGFuZ2UoKCkgPT4gdGhpcy5fbGF5b3V0KCkpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2xheW91dFNlcnZpY2Uub25EaWRMYXlvdXRBY3RpdmVDb250YWluZXIoKCkgPT4gdGhpcy5fbGF5b3V0KCkpKTtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZVN0b3JlO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlVG9vbGJhcihwcm92aWRlZEFjdGlvbnM/OiBJQWN0aW9uW10sIHR5cGU/OiBBY2Nlc3NpYmxlVmlld1R5cGUpOiB2b2lkIHtcblx0XHR0aGlzLl90b29sYmFyLnNldEFyaWFMYWJlbCh0eXBlID09PSBBY2Nlc3NpYmxlVmlld1R5cGUuSGVscCA/IGxvY2FsaXplKCdhY2Nlc3NpYmxlSGVscFRvb2xiYXInLCAnQWNjZXNzaWJpbGl0eSBIZWxwJykgOiBsb2NhbGl6ZSgnYWNjZXNzaWJsZVZpZXdUb29sYmFyJywgXCJBY2Nlc3NpYmxlIFZpZXdcIikpO1xuXHRcdGNvbnN0IHRvb2xiYXJNZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuQWNjZXNzaWJsZVZpZXcsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgbWVudUFjdGlvbnMgPSBnZXRGbGF0QWN0aW9uQmFyQWN0aW9ucyh0b29sYmFyTWVudS5nZXRBY3Rpb25zKHt9KSk7XG5cdFx0aWYgKHByb3ZpZGVkQWN0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBwcm92aWRlZEFjdGlvbiBvZiBwcm92aWRlZEFjdGlvbnMpIHtcblx0XHRcdFx0cHJvdmlkZWRBY3Rpb24uY2xhc3MgPSBwcm92aWRlZEFjdGlvbi5jbGFzcyB8fCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5wcmltaXRpdmVTcXVhcmUpO1xuXHRcdFx0XHRwcm92aWRlZEFjdGlvbi5jaGVja2VkID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdG9vbGJhci5zZXRBY3Rpb25zKFsuLi5wcm92aWRlZEFjdGlvbnMsIC4uLm1lbnVBY3Rpb25zXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Rvb2xiYXIuc2V0QWN0aW9ucyhtZW51QWN0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbGF5b3V0KCk6IHZvaWQge1xuXHRcdGNvbnN0IGRpbWVuc2lvbiA9IHRoaXMuX2xheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyRGltZW5zaW9uO1xuXHRcdGNvbnN0IG1heEhlaWdodCA9IGRpbWVuc2lvbi5oZWlnaHQgJiYgZGltZW5zaW9uLmhlaWdodCAqIC40O1xuXHRcdGNvbnN0IGhlaWdodCA9IE1hdGgubWluKG1heEhlaWdodCwgdGhpcy5fZWRpdG9yV2lkZ2V0LmdldENvbnRlbnRIZWlnaHQoKSk7XG5cdFx0Y29uc3Qgd2lkdGggPSBNYXRoLm1pbihkaW1lbnNpb24ud2lkdGggKiAwLjYyIC8qIGdvbGRlbiBjdXQgKi8sIERJTUVOU0lPTlMuTUFYX1dJRFRIKTtcblx0XHR0aGlzLl9lZGl0b3JXaWRnZXQubGF5b3V0KHsgd2lkdGgsIGhlaWdodCB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldFRleHRNb2RlbChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJVGV4dE1vZGVsIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKTtcblx0XHRpZiAoZXhpc3RpbmcgJiYgIWV4aXN0aW5nLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKHJlc291cmNlLmZyYWdtZW50LCBudWxsLCByZXNvdXJjZSwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ29Ub1N5bWJvbHNTdXBwb3J0ZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50UHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnRQcm92aWRlci5vcHRpb25zLnR5cGUgPT09IEFjY2Vzc2libGVWaWV3VHlwZS5IZWxwIHx8IHRoaXMuX2N1cnJlbnRQcm92aWRlci5vcHRpb25zLmxhbmd1YWdlID09PSAnbWFya2Rvd24nIHx8IHRoaXMuX2N1cnJlbnRQcm92aWRlci5vcHRpb25zLmxhbmd1YWdlID09PSB1bmRlZmluZWQgfHwgKHRoaXMuX2N1cnJlbnRQcm92aWRlciBpbnN0YW5jZW9mIEFjY2Vzc2libGVDb250ZW50UHJvdmlkZXIgJiYgISF0aGlzLl9jdXJyZW50UHJvdmlkZXIuZ2V0U3ltYm9scz8uKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlTGFzdFByb3ZpZGVyKCk6IEFjY2VzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fY3VycmVudFByb3ZpZGVyO1xuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbGFzdFByb3ZpZGVyID0gcHJvdmlkZXIgaW5zdGFuY2VvZiBBY2Nlc3NpYmxlQ29udGVudFByb3ZpZGVyID8gbmV3IEFjY2Vzc2libGVDb250ZW50UHJvdmlkZXIoXG5cdFx0XHRwcm92aWRlci5pZCxcblx0XHRcdHByb3ZpZGVyLm9wdGlvbnMsXG5cdFx0XHRwcm92aWRlci5wcm92aWRlQ29udGVudC5iaW5kKHByb3ZpZGVyKSxcblx0XHRcdHByb3ZpZGVyLm9uQ2xvc2UuYmluZChwcm92aWRlciksXG5cdFx0XHRwcm92aWRlci52ZXJib3NpdHlTZXR0aW5nS2V5LFxuXHRcdFx0cHJvdmlkZXIub25PcGVuPy5iaW5kKHByb3ZpZGVyKSxcblx0XHRcdHByb3ZpZGVyLmFjdGlvbnMsXG5cdFx0XHRwcm92aWRlci5wcm92aWRlTmV4dENvbnRlbnQ/LmJpbmQocHJvdmlkZXIpLFxuXHRcdFx0cHJvdmlkZXIucHJvdmlkZVByZXZpb3VzQ29udGVudD8uYmluZChwcm92aWRlciksXG5cdFx0XHRwcm92aWRlci5vbkRpZENoYW5nZUNvbnRlbnQ/LmJpbmQocHJvdmlkZXIpLFxuXHRcdFx0cHJvdmlkZXIub25LZXlEb3duPy5iaW5kKHByb3ZpZGVyKSxcblx0XHRcdHByb3ZpZGVyLmdldFN5bWJvbHM/LmJpbmQocHJvdmlkZXIpLFxuXHRcdCkgOiBuZXcgRXh0ZW5zaW9uQ29udGVudFByb3ZpZGVyKFxuXHRcdFx0cHJvdmlkZXIuaWQsXG5cdFx0XHRwcm92aWRlci5vcHRpb25zLFxuXHRcdFx0cHJvdmlkZXIucHJvdmlkZUNvbnRlbnQuYmluZChwcm92aWRlciksXG5cdFx0XHRwcm92aWRlci5vbkNsb3NlLmJpbmQocHJvdmlkZXIpLFxuXHRcdFx0cHJvdmlkZXIub25PcGVuPy5iaW5kKHByb3ZpZGVyKSxcblx0XHRcdHByb3ZpZGVyLnByb3ZpZGVOZXh0Q29udGVudD8uYmluZChwcm92aWRlciksXG5cdFx0XHRwcm92aWRlci5wcm92aWRlUHJldmlvdXNDb250ZW50Py5iaW5kKHByb3ZpZGVyKSxcblx0XHRcdHByb3ZpZGVyLmFjdGlvbnMsXG5cdFx0XHRwcm92aWRlci5vbkRpZENoYW5nZUNvbnRlbnQ/LmJpbmQocHJvdmlkZXIpLFxuXHRcdCk7XG5cdFx0cmV0dXJuIGxhc3RQcm92aWRlcjtcblx0fVxuXG5cdHB1YmxpYyBzaG93QWNjZXNzaWJsZVZpZXdIZWxwKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxhc3RQcm92aWRlciA9IHRoaXMuX3VwZGF0ZUxhc3RQcm92aWRlcigpO1xuXHRcdGlmICghbGFzdFByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBhY2Nlc3NpYmxlVmlld0hlbHBQcm92aWRlcjtcblx0XHRpZiAobGFzdFByb3ZpZGVyIGluc3RhbmNlb2YgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlcikge1xuXHRcdFx0YWNjZXNzaWJsZVZpZXdIZWxwUHJvdmlkZXIgPSBuZXcgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlcihcblx0XHRcdFx0bGFzdFByb3ZpZGVyLmlkLFxuXHRcdFx0XHR7IHR5cGU6IEFjY2Vzc2libGVWaWV3VHlwZS5IZWxwIH0sXG5cdFx0XHRcdCgpID0+IGxhc3RQcm92aWRlci5vcHRpb25zLmN1c3RvbUhlbHAgPyBsYXN0UHJvdmlkZXI/Lm9wdGlvbnMuY3VzdG9tSGVscCgpIDogdGhpcy5fYWNjZXNzaWJsZVZpZXdIZWxwRGlhbG9nQ29udGVudCh0aGlzLl9nb1RvU3ltYm9sc1N1cHBvcnRlZCgpKSxcblx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoKTtcblx0XHRcdFx0XHQvLyBIQUNLOiBEZWxheSB0byBhbGxvdyB0aGUgY29udGV4dCB2aWV3IHRvIGhpZGUgIzIwNzYzOFxuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHRoaXMuc2hvdyhsYXN0UHJvdmlkZXIpKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0bGFzdFByb3ZpZGVyLnZlcmJvc2l0eVNldHRpbmdLZXlcblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFjY2Vzc2libGVWaWV3SGVscFByb3ZpZGVyID0gbmV3IEV4dGVuc2lvbkNvbnRlbnRQcm92aWRlcihcblx0XHRcdFx0bGFzdFByb3ZpZGVyLmlkLFxuXHRcdFx0XHR7IHR5cGU6IEFjY2Vzc2libGVWaWV3VHlwZS5IZWxwIH0sXG5cdFx0XHRcdCgpID0+IGxhc3RQcm92aWRlci5vcHRpb25zLmN1c3RvbUhlbHAgPyBsYXN0UHJvdmlkZXI/Lm9wdGlvbnMuY3VzdG9tSGVscCgpIDogdGhpcy5fYWNjZXNzaWJsZVZpZXdIZWxwRGlhbG9nQ29udGVudCh0aGlzLl9nb1RvU3ltYm9sc1N1cHBvcnRlZCgpKSxcblx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoKTtcblx0XHRcdFx0XHQvLyBIQUNLOiBEZWxheSB0byBhbGxvdyB0aGUgY29udGV4dCB2aWV3IHRvIGhpZGUgIzIwNzYzOFxuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHRoaXMuc2hvdyhsYXN0UHJvdmlkZXIpKTtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoKTtcblx0XHQvLyBIQUNLOiBEZWxheSB0byBhbGxvdyB0aGUgY29udGV4dCB2aWV3IHRvIGhpZGUgIzE4NjUxNFxuXHRcdGlmIChhY2Nlc3NpYmxlVmlld0hlbHBQcm92aWRlcikge1xuXHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4gdGhpcy5zaG93KGFjY2Vzc2libGVWaWV3SGVscFByb3ZpZGVyLCB1bmRlZmluZWQsIHRydWUpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hY2Nlc3NpYmxlVmlld0hlbHBEaWFsb2dDb250ZW50KHByb3ZpZGVySGFzU3ltYm9scz86IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdGNvbnN0IG5hdmlnYXRpb25IaW50ID0gdGhpcy5fbmF2aWdhdGlvbkhpbnQoKTtcblx0XHRjb25zdCBnb1RvU3ltYm9sSGludCA9IHRoaXMuX2dvVG9TeW1ib2xIaW50KHByb3ZpZGVySGFzU3ltYm9scyk7XG5cdFx0Y29uc3QgdG9vbGJhckhpbnQgPSBsb2NhbGl6ZSgndG9vbGJhcicsIFwiTmF2aWdhdGUgdG8gdGhlIHRvb2xiYXIgKFNoaWZ0K1RhYikuXCIpO1xuXHRcdGNvbnN0IGNoYXRIaW50cyA9IHRoaXMuX2dldENoYXRIaW50cygpO1xuXG5cdFx0bGV0IGhpbnQgPSBsb2NhbGl6ZSgnaW50cm8nLCBcIkluIHRoZSBhY2Nlc3NpYmxlIHZpZXcsIHlvdSBjYW46XFxuXCIpO1xuXHRcdGlmIChuYXZpZ2F0aW9uSGludCkge1xuXHRcdFx0aGludCArPSAnIC0gJyArIG5hdmlnYXRpb25IaW50ICsgJ1xcbic7XG5cdFx0fVxuXHRcdGlmIChnb1RvU3ltYm9sSGludCkge1xuXHRcdFx0aGludCArPSAnIC0gJyArIGdvVG9TeW1ib2xIaW50ICsgJ1xcbic7XG5cdFx0fVxuXHRcdGlmICh0b29sYmFySGludCkge1xuXHRcdFx0aGludCArPSAnIC0gJyArIHRvb2xiYXJIaW50ICsgJ1xcbic7XG5cdFx0fVxuXHRcdGlmIChjaGF0SGludHMpIHtcblx0XHRcdGhpbnQgKz0gY2hhdEhpbnRzO1xuXHRcdH1cblx0XHRyZXR1cm4gaGludDtcblx0fVxuXG5cdHByaXZhdGUgX2dldENoYXRIaW50cygpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9jdXJyZW50UHJvdmlkZXI/LmlkICE9PSBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuUGFuZWxDaGF0ICYmIHRoaXMuX2N1cnJlbnRQcm92aWRlcj8uaWQgIT09IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5RdWlja0NoYXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIFtsb2NhbGl6ZSgnaW5zZXJ0QXRDdXJzb3InLCBcIiAtIEluc2VydCB0aGUgY29kZSBibG9jayBhdCB0aGUgY3Vyc29yezB9LlwiLCAnPGtleWJpbmRpbmc6d29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc2VydENvZGVCbG9jaz4nKSxcblx0XHRsb2NhbGl6ZSgnaW5zZXJ0SW50b05ld0ZpbGUnLCBcIiAtIEluc2VydCB0aGUgY29kZSBibG9jayBpbnRvIGEgbmV3IGZpbGV7MH0uXCIsICc8a2V5YmluZGluZzp3b3JrYmVuY2guYWN0aW9uLmNoYXQuaW5zZXJ0SW50b05ld0ZpbGU+JyksXG5cdFx0bG9jYWxpemUoJ3J1bkluVGVybWluYWwnLCBcIiAtIFJ1biB0aGUgY29kZSBibG9jayBpbiB0aGUgdGVybWluYWx7MH0uXFxuXCIsICc8a2V5YmluZGluZzp3b3JrYmVuY2guYWN0aW9uLmNoYXQucnVuSW5UZXJtaW5hbD4nKV0uam9pbignXFxuJyk7XG5cdH1cblxuXHRwcml2YXRlIF9uYXZpZ2F0aW9uSGludCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnYWNjZXNzaWJsZVZpZXdOZXh0UHJldmlvdXNIaW50JywgXCJTaG93IHRoZSBuZXh0IGl0ZW17MH0gb3IgcHJldmlvdXMgaXRlbXsxfS5cIiwgYDxrZXliaW5kaW5nOiR7QWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5TaG93TmV4dH1gLCBgPGtleWJpbmRpbmc6JHtBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLlNob3dQcmV2aW91c30+YCk7XG5cdH1cblxuXHRwcml2YXRlIF9kaXNhYmxlVmVyYm9zaXR5SGludChwcm92aWRlcjogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlcik6IHN0cmluZyB7XG5cdFx0aWYgKHByb3ZpZGVyLm9wdGlvbnMudHlwZSA9PT0gQWNjZXNzaWJsZVZpZXdUeXBlLkhlbHAgJiYgdGhpcy5fdmVyYm9zaXR5RW5hYmxlZCgpKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2FjZXNzaWJsZVZpZXdEaXNhYmxlSGludCcsIFwiXFxuRGlzYWJsZSBhY2Nlc3NpYmlsaXR5IHZlcmJvc2l0eSBmb3IgdGhpcyBmZWF0dXJlezB9LlwiLCBgPGtleWJpbmRpbmc6JHtBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLkRpc2FibGVWZXJib3NpdHlIaW50fT5gKTtcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ29Ub1N5bWJvbEhpbnQocHJvdmlkZXJIYXNTeW1ib2xzPzogYm9vbGVhbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFwcm92aWRlckhhc1N5bWJvbHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdnb1RvU3ltYm9sSGludCcsICdHbyB0byBhIHN5bWJvbHswfS4nLCBgPGtleWJpbmRpbmc6JHtBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLkdvVG9TeW1ib2x9PmApO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29uZmlndXJlVW5hc3NpZ25lZEtiSGludCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGNvbmZpZ3VyZUtiID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLkFjY2Vzc2liaWxpdHlIZWxwQ29uZmlndXJlS2V5YmluZGluZ3MpPy5nZXRBcmlhTGFiZWwoKTtcblx0XHRjb25zdCBrZXliaW5kaW5nVG9Db25maWd1cmVRdWlja1BpY2sgPSBjb25maWd1cmVLYiA/ICcoJyArIGNvbmZpZ3VyZUtiICsgJyknIDogJ2J5IGFzc2lnbmluZyBhIGtleWJpbmRpbmcgdG8gdGhlIGNvbW1hbmQgQWNjZXNzaWJpbGl0eSBIZWxwIENvbmZpZ3VyZSBVbmFzc2lnbmVkIEtleWJpbmRpbmdzLic7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdjb25maWd1cmVLYicsICdcXG5Db25maWd1cmUga2V5YmluZGluZ3MgZm9yIGNvbW1hbmRzIHRoYXQgbGFjayB0aGVtIHswfS4nLCBrZXliaW5kaW5nVG9Db25maWd1cmVRdWlja1BpY2spO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29uZmlndXJlQXNzaWduZWRLYkhpbnQoKTogc3RyaW5nIHtcblx0XHRjb25zdCBjb25maWd1cmVLYiA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5BY2Nlc3NpYmlsaXR5SGVscENvbmZpZ3VyZUFzc2lnbmVkS2V5YmluZGluZ3MpPy5nZXRBcmlhTGFiZWwoKTtcblx0XHRjb25zdCBrZXliaW5kaW5nVG9Db25maWd1cmVRdWlja1BpY2sgPSBjb25maWd1cmVLYiA/ICcoJyArIGNvbmZpZ3VyZUtiICsgJyknIDogJ2J5IGFzc2lnbmluZyBhIGtleWJpbmRpbmcgdG8gdGhlIGNvbW1hbmQgQWNjZXNzaWJpbGl0eSBIZWxwIENvbmZpZ3VyZSBBc3NpZ25lZCBLZXliaW5kaW5ncy4nO1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnY29uZmlndXJlS2JBc3NpZ25lZCcsICdcXG5Db25maWd1cmUga2V5YmluZGluZ3MgZm9yIGNvbW1hbmRzIHRoYXQgYWxyZWFkeSBoYXZlIGFzc2lnbm1lbnRzIHswfS4nLCBrZXliaW5kaW5nVG9Db25maWd1cmVRdWlja1BpY2spO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2NyZWVuUmVhZGVyTW9kZUhpbnQocHJvdmlkZXI6IEFjY2VzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTdXBwb3J0ID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0XHRsZXQgc2NyZWVuUmVhZGVyTW9kZUhpbnQgPSAnJztcblx0XHRjb25zdCB0dXJuT25NZXNzYWdlID0gKFxuXHRcdFx0aXNNYWNpbnRvc2hcblx0XHRcdFx0PyBBY2Nlc3NpYmlsaXR5SGVscE5MUy5jaGFuZ2VDb25maWdUb09uTWFjXG5cdFx0XHRcdDogQWNjZXNzaWJpbGl0eUhlbHBOTFMuY2hhbmdlQ29uZmlnVG9PbldpbkxpbnV4XG5cdFx0KTtcblx0XHRpZiAoYWNjZXNzaWJpbGl0eVN1cHBvcnQgJiYgcHJvdmlkZXIuaWQgPT09IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5FZGl0b3IpIHtcblx0XHRcdHNjcmVlblJlYWRlck1vZGVIaW50ID0gQWNjZXNzaWJpbGl0eUhlbHBOTFMuYXV0b19vbjtcblx0XHRcdHNjcmVlblJlYWRlck1vZGVIaW50ICs9ICdcXG4nO1xuXHRcdH0gZWxzZSBpZiAoIWFjY2Vzc2liaWxpdHlTdXBwb3J0KSB7XG5cdFx0XHRzY3JlZW5SZWFkZXJNb2RlSGludCA9IEFjY2Vzc2liaWxpdHlIZWxwTkxTLmF1dG9fb2ZmICsgJ1xcbicgKyB0dXJuT25NZXNzYWdlO1xuXHRcdFx0c2NyZWVuUmVhZGVyTW9kZUhpbnQgKz0gJ1xcbic7XG5cdFx0fVxuXHRcdHJldHVybiBzY3JlZW5SZWFkZXJNb2RlSGludDtcblx0fVxuXG5cdHByaXZhdGUgX2V4aXREaWFsb2dIaW50KHByb3ZpZGVyOiBBY2Nlc2libGVWaWV3Q29udGVudFByb3ZpZGVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fdmVyYm9zaXR5RW5hYmxlZCgpICYmICFwcm92aWRlci5vcHRpb25zLnBvc2l0aW9uID8gbG9jYWxpemUoJ2V4aXQnLCAnXFxuRXhpdCB0aGlzIGRpYWxvZyAoRXNjYXBlKS4nKSA6ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVhZE1vcmVIaW50KHByb3ZpZGVyOiBBY2Nlc2libGVWaWV3Q29udGVudFByb3ZpZGVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gcHJvdmlkZXIub3B0aW9ucy5yZWFkTW9yZVVybCA/IGxvY2FsaXplKFwib3BlbkRvY1wiLCBcIlxcbk9wZW4gYSBicm93c2VyIHdpbmRvdyB3aXRoIG1vcmUgaW5mb3JtYXRpb24gcmVsYXRlZCB0byBhY2Nlc3NpYmlsaXR5ezB9LlwiLCBgPGtleWJpbmRpbmc6JHtBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLkFjY2Vzc2liaWxpdHlIZWxwT3BlbkhlbHBMaW5rfT5gKSA6ICcnO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBY2Nlc3NpYmxlVmlld1NlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUFjY2Vzc2libGVWaWV3U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9hY2Nlc3NpYmxlVmlldzogQWNjZXNzaWJsZVZpZXcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHNob3cocHJvdmlkZXI6IEFjY2VzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIsIHBvc2l0aW9uPzogUG9zaXRpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2FjY2Vzc2libGVWaWV3KSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlldyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEFjY2Vzc2libGVWaWV3KSk7XG5cdFx0fVxuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3LnNob3cocHJvdmlkZXIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBwb3NpdGlvbik7XG5cdH1cblx0Y29uZmlndXJlS2V5YmluZGluZ3ModW5hc3NpZ25lZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Py5jb25maWd1cmVLZXliaW5kaW5ncyh1bmFzc2lnbmVkKTtcblx0fVxuXHRvcGVuSGVscExpbmsoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXc/Lm9wZW5IZWxwTGluaygpO1xuXHR9XG5cdHNob3dMYXN0UHJvdmlkZXIoaWQ6IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCk6IHZvaWQge1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Py5zaG93TGFzdFByb3ZpZGVyKGlkKTtcblx0fVxuXHRuZXh0KCk6IHZvaWQge1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3Py5uZXh0KCk7XG5cdH1cblx0cHJldmlvdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXc/LnByZXZpb3VzKCk7XG5cdH1cblx0Z29Ub1N5bWJvbCgpOiB2b2lkIHtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlldz8uZ29Ub1N5bWJvbCgpO1xuXHR9XG5cdGdldE9wZW5BcmlhSGludCh2ZXJib3NpdHlTZXR0aW5nS2V5OiBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSh2ZXJib3NpdHlTZXR0aW5nS2V5KSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEFjY2Vzc2liaWxpdHlDb21tYW5kSWQuT3BlbkFjY2Vzc2libGVWaWV3KT8uZ2V0QXJpYUxhYmVsKCk7XG5cdFx0bGV0IGhpbnQgPSBudWxsO1xuXHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRoaW50ID0gbG9jYWxpemUoJ2FjZXNzaWJsZVZpZXdIaW50JywgXCJJbnNwZWN0IHRoaXMgaW4gdGhlIGFjY2Vzc2libGUgdmlldyB3aXRoIHswfVwiLCBrZXliaW5kaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGludCA9IGxvY2FsaXplKCdhY2Vzc2libGVWaWV3SGludE5vS2JFaXRoZXInLCBcIkluc3BlY3QgdGhpcyBpbiB0aGUgYWNjZXNzaWJsZSB2aWV3IHZpYSB0aGUgY29tbWFuZCBPcGVuIEFjY2Vzc2libGUgVmlldyB3aGljaCBpcyBjdXJyZW50bHkgbm90IHRyaWdnZXJhYmxlIHZpYSBrZXliaW5kaW5nLlwiKTtcblx0XHR9XG5cdFx0cmV0dXJuIGhpbnQ7XG5cdH1cblx0ZGlzYWJsZUhpbnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXc/LmRpc2FibGVIaW50KCk7XG5cdH1cblx0c2hvd0FjY2Vzc2libGVWaWV3SGVscCgpOiB2b2lkIHtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlldz8uc2hvd0FjY2Vzc2libGVWaWV3SGVscCgpO1xuXHR9XG5cdGdldFBvc2l0aW9uKGlkOiBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQpOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjY2Vzc2libGVWaWV3Py5nZXRQb3NpdGlvbihpZCkgPz8gdW5kZWZpbmVkO1xuXHR9XG5cdGdldExhc3RQb3NpdGlvbigpOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbGFzdExpbmUgPSB0aGlzLl9hY2Nlc3NpYmxlVmlldz8uZWRpdG9yV2lkZ2V0LmdldE1vZGVsKCk/LmdldExpbmVDb3VudCgpO1xuXHRcdHJldHVybiBsYXN0TGluZSAhPT0gdW5kZWZpbmVkICYmIGxhc3RMaW5lID4gMCA/IG5ldyBQb3NpdGlvbihsYXN0TGluZSwgMSkgOiB1bmRlZmluZWQ7XG5cdH1cblx0c2V0UG9zaXRpb24ocG9zaXRpb246IFBvc2l0aW9uLCByZXZlYWw/OiBib29sZWFuLCBzZWxlY3Q/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXc/LnNldFBvc2l0aW9uKHBvc2l0aW9uLCByZXZlYWwsIHNlbGVjdCk7XG5cdH1cblx0Z2V0Q29kZUJsb2NrQ29udGV4dCgpOiBJQ29kZUJsb2NrQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjY2Vzc2libGVWaWV3Py5nZXRDb2RlQmxvY2tDb250ZXh0KCk7XG5cdH1cblx0bmF2aWdhdGVUb0NvZGVCbG9jayh0eXBlOiAnbmV4dCcgfCAncHJldmlvdXMnKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXc/Lm5hdmlnYXRlVG9Db2RlQmxvY2sodHlwZSk7XG5cdH1cbn1cblxuY2xhc3MgQWNjZXNzaWJsZVZpZXdTeW1ib2xRdWlja1BpY2sge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIF9hY2Nlc3NpYmxlVmlldzogQWNjZXNzaWJsZVZpZXcsIEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSkge1xuXG5cdH1cblx0c2hvdyhwcm92aWRlcjogQWNjZXNpYmxlVmlld0NvbnRlbnRQcm92aWRlcik6IHZvaWQge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLl9xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8SUFjY2Vzc2libGVWaWV3U3ltYm9sPigpKTtcblx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnYWNjZXNzaWJsZVZpZXdTeW1ib2xRdWlja1BpY2tQbGFjZWhvbGRlcicsIFwiVHlwZSB0byBzZWFyY2ggc3ltYm9sc1wiKTtcblx0XHRxdWlja1BpY2sudGl0bGUgPSBsb2NhbGl6ZSgnYWNjZXNzaWJsZVZpZXdTeW1ib2xRdWlja1BpY2tUaXRsZScsIFwiR28gdG8gU3ltYm9sIEFjY2Vzc2libGUgVmlld1wiKTtcblx0XHRjb25zdCBwaWNrcyA9IFtdO1xuXHRcdGNvbnN0IHN5bWJvbHMgPSB0aGlzLl9hY2Nlc3NpYmxlVmlldy5nZXRTeW1ib2xzKCk7XG5cdFx0aWYgKCFzeW1ib2xzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvciAoY29uc3Qgc3ltYm9sIG9mIHN5bWJvbHMpIHtcblx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogc3ltYm9sLmxhYmVsLFxuXHRcdFx0XHRhcmlhTGFiZWw6IHN5bWJvbC5hcmlhTGFiZWwsXG5cdFx0XHRcdGZpcnN0TGlzdEl0ZW06IHN5bWJvbC5maXJzdExpc3RJdGVtLFxuXHRcdFx0XHRsaW5lTnVtYmVyOiBzeW1ib2wubGluZU51bWJlcixcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogc3ltYm9sLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdG1hcmtkb3duVG9QYXJzZTogc3ltYm9sLm1hcmtkb3duVG9QYXJzZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHF1aWNrUGljay5jYW5TZWxlY3RNYW55ID0gZmFsc2U7XG5cdFx0cXVpY2tQaWNrLml0ZW1zID0gcGlja3M7XG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3LnNob3dTeW1ib2wocHJvdmlkZXIsIHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdKTtcblx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdGlmIChxdWlja1BpY2suc2VsZWN0ZWRJdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Ly8gdGhpcyB3YXMgZXNjYXBlZCwgc28gcmVmb2N1cyB0aGUgYWNjZXNzaWJsZSB2aWV3XG5cdFx0XHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3LnNob3cocHJvdmlkZXIpO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0fVxufVxuXG5cbmZ1bmN0aW9uIHNob3VsZEhpZGUoZXZlbnQ6IEtleWJvYXJkRXZlbnQsIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBib29sZWFuIHtcblx0aWYgKCFjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBY2Nlc3NpYmlsaXR5V29ya2JlbmNoU2V0dGluZ0lkLkFjY2Vzc2libGVWaWV3Q2xvc2VPbktleVByZXNzKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCBzdGFuZGFyZEtleWJvYXJkRXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGV2ZW50KTtcblx0Y29uc3QgcmVzb2x2ZVJlc3VsdCA9IGtleWJpbmRpbmdTZXJ2aWNlLnNvZnREaXNwYXRjaChzdGFuZGFyZEtleWJvYXJkRXZlbnQsIHN0YW5kYXJkS2V5Ym9hcmRFdmVudC50YXJnZXQpO1xuXG5cdGNvbnN0IGlzVmFsaWRDaG9yZCA9IHJlc29sdmVSZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5Nb3JlQ2hvcmRzTmVlZGVkO1xuXHRpZiAoa2V5YmluZGluZ1NlcnZpY2UuaW5DaG9yZE1vZGUgfHwgaXNWYWxpZENob3JkKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBzaG91bGRIYW5kbGVLZXkoZXZlbnQpICYmICFldmVudC5jdHJsS2V5ICYmICFldmVudC5hbHRLZXkgJiYgIWV2ZW50Lm1ldGFLZXkgJiYgIWV2ZW50LnNoaWZ0S2V5O1xufVxuXG5mdW5jdGlvbiBzaG91bGRIYW5kbGVLZXkoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcblx0cmV0dXJuICEhZXZlbnQuY29kZS5tYXRjaCgvXihLZXlbQS1aXXxEaWdpdFswLTldfEVxdWFsfENvbW1hfFBlcmlvZHxTbGFzaHxRdW90ZXxCYWNrcXVvdGV8QmFja3NsYXNofE1pbnVzfFNlbWljb2xvbnxTcGFjZXxFbnRlcikkLyk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsV0FBVyx1QkFBdUIsaUJBQWlCLHVCQUF1QjtBQUNuRixTQUF5Qiw2QkFBNkI7QUFDdEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxhQUFhO0FBRXRCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLHVCQUFvQztBQUN6RCxZQUFZLFlBQVk7QUFDeEIsU0FBUyxhQUFhLGlCQUFpQjtBQUN2QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQVc7QUFFcEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx3QkFBa0Q7QUFDM0QsU0FBb0IsZ0JBQWdCO0FBRXBDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMEJBQTBCLG9CQUFvQiwyQkFBMkIsMEJBQXlFLHdDQUF3QztBQUNuTSxTQUFTLHNDQUFzQyw2QkFBNkI7QUFDNUUsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxjQUFjLGNBQWM7QUFDckMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQStCLDJCQUEyQjtBQUMxRCxTQUFTLDZC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QjtBQUMvRixVQUFNLFFBQVEsQ0FBQztBQUNmLFVBQU0sVUFBVSxLQUFLLGdCQUFnQixXQUFXO0FBQ2hELFFBQUksQ0FBQyxTQUFTO0FBQ2I7QUFBQSxJQUNEO0FBQ0EsZUFBVyxVQUFVLFNBQVM7QUFDN0IsWUFBTSxLQUFLO0FBQUEsUUFDVixPQUFPLE9BQU87QUFBQSxRQUNkLFdBQVcsT0FBTztBQUFBLFFBQ2xCLGVBQWUsT0FBTztBQUFBLFFBQ3RCLFlBQVksT0FBTztBQUFBLFFBQ25CLGVBQWUsT0FBTztBQUFBLFFBQ3RCLGlCQUFpQixPQUFPO0FBQUEsTUFDekIsQ0FBQztBQUFBLElBQ0Y7QUFDQSxjQUFVLGdCQUFnQjtBQUMxQixjQUFVLFFBQVE7QUFDbEIsY0FBVSxLQUFLO0FBQ2YsZ0JBQVksSUFBSSxVQUFVLFlBQVksTUFBTTtBQUMzQyxXQUFLLGdCQUFnQixXQUFXLFVBQVUsVUFBVSxjQUFjLENBQUMsQ0FBQztBQUNwRSxnQkFBVSxLQUFLO0FBQUEsSUFDaEIsQ0FBQyxDQUFDO0FBQ0YsZ0JBQVksSUFBSSxVQUFVLFVBQVUsTUFBTTtBQUN6QyxVQUFJLFVBQVUsY0FBYyxXQUFXLEdBQUc7QUFFekMsYUFBSyxnQkFBZ0IsS0FBSyxRQUFRO0FBQUEsTUFDbkM7QUFDQSxrQkFBWSxRQUFRO0FBQUEsSUFDckIsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBdkNNLGdDQUFOO0FBQUEsRUFDdUQ7QUFBQSxHQURqRDtBQTBDTixTQUFTLFdBQVcsT0FBc0IsbUJBQXVDLHNCQUFzRDtBQUN0SSxNQUFJLENBQUMscUJBQXFCLFNBQVMsZ0NBQWdDLDZCQUE2QixHQUFHO0FBQ2xHLFdBQU87QUFBQSxFQUNSO0FBQ0EsUUFBTSx3QkFBd0IsSUFBSSxzQkFBc0IsS0FBSztBQUM3RCxRQUFNLGdCQUFnQixrQkFBa0IsYUFBYSx1QkFBdUIsc0JBQXNCLE1BQU07QUFFeEcsUUFBTSxlQUFlLGNBQWMsU0FBUyxXQUFXO0FBQ3ZELE1BQUksa0JBQWtCLGVBQWUsY0FBYztBQUNsRCxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU8sZ0JBQWdCLEtBQUssS0FBSyxDQUFDLE1BQU0sV0FBVyxDQUFDLE1BQU0sVUFBVSxDQUFDLE1BQU0sV0FBVyxDQUFDLE1BQU07QUFDOUY7QUFFQSxTQUFTLGdCQUFnQixPQUErQjtBQUN2RCxTQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTSx3R0FBd0c7QUFDbkk7IiwKICAibmFtZXMiOiBbIkRJTUVOU0lPTlMiLCAicG9zaXRpb24iXQp9Cg==
