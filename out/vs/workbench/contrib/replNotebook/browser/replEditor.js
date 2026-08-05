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
import "./media/interactive.css";
import * as DOM from "../../../../base/browser/dom.js";
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { EditorPaneSelectionChangeReason } from "../../../common/editor.js";
import { getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { NotebookEditorExtensionsRegistry } from "../../notebook/browser/notebookEditorExtensions.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { getDefaultNotebookCreationOptions, NotebookEditorWidget } from "../../notebook/browser/notebookEditorWidget.js";
import { GroupsOrder, IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { ExecutionStateCellStatusBarContrib, TimerCellStatusBarContrib } from "../../notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.js";
import { INotebookKernelService } from "../../notebook/common/notebookKernelService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ReplEditorSettings, INTERACTIVE_INPUT_CURSOR_BOUNDARY } from "../../interactive/browser/interactiveCommon.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { NotebookOptions } from "../../notebook/browser/notebookOptions.js";
import { ToolBar } from "../../../../base/browser/ui/toolbar/toolbar.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { createActionViewItem, getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { SelectionClipboardContributionID } from "../../codeEditor/browser/selectionClipboard.js";
import { ContextMenuController } from "../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { MarkerController } from "../../../../editor/contrib/gotoError/browser/gotoError.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { TextEditorSelectionSource } from "../../../../platform/editor/common/editor.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../notebook/common/notebookExecutionStateService.js";
import { NOTEBOOK_KERNEL } from "../../notebook/common/notebookContextKeys.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { isEqual } from "../../../../base/common/resources.js";
import { NotebookFindContrib } from "../../notebook/browser/contrib/find/notebookFindWidget.js";
import { REPL_EDITOR_ID } from "../../notebook/common/notebookCommon.js";
import "./interactiveEditor.css";
import { deepClone } from "../../../../base/common/objects.js";
import { GlyphHoverController } from "../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { ReplEditorInput } from "./replEditorInput.js";
import { ReplInputHintContentWidget } from "../../interactive/browser/replInputHintContentWidget.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
const INTERACTIVE_EDITOR_VIEW_STATE_PREFERENCE_KEY = "InteractiveEditorViewState";
const INPUT_CELL_VERTICAL_PADDING = 8;
const INPUT_CELL_HORIZONTAL_PADDING_RIGHT = 10;
const INPUT_EDITOR_PADDING = 8;
let ReplEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, notebookWidgetService, contextKeyService, notebookKernelService, languageService, keybindingService, configurationService, menuService, contextMenuService, editorGroupService, textResourceConfigurationService, notebookExecutionStateService, extensionService, _accessibilityService) {
    super(
      REPL_EDITOR_ID,
      group,
      telemetryService,
      themeService,
      storageService
    );
    this._accessibilityService = _accessibilityService;
    this._notebookWidget = { value: void 0 };
    this._widgetDisposableStore = this._register(new DisposableStore());
    this._groupListener = this._register(new MutableDisposable());
    this._onDidFocusWidget = this._register(new Emitter());
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onDidChangeScroll = this._register(new Emitter());
    this.onDidChangeScroll = this._onDidChangeScroll.event;
    this._notebookWidgetService = notebookWidgetService;
    this._configurationService = configurationService;
    this._notebookKernelService = notebookKernelService;
    this._languageService = languageService;
    this._keybindingService = keybindingService;
    this._menuService = menuService;
    this._contextMenuService = contextMenuService;
    this._editorGroupService = editorGroupService;
    this._extensionService = extensionService;
    this._rootElement = DOM.$(".interactive-editor");
    this._contextKeyService = this._register(contextKeyService.createScoped(this._rootElement));
    this._contextKeyService.createKey("isCompositeNotebook", true);
    this._instantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this._contextKeyService])));
    this._editorOptions = this._computeEditorOptions();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor") || e.affectsConfiguration("notebook")) {
        this._editorOptions = this._computeEditorOptions();
      }
    }));
    this._notebookOptions = instantiationService.createInstance(NotebookOptions, this.window, true, { cellToolbarInteraction: "hover", globalToolbar: true, stickyScrollEnabled: false, dragAndDropEnabled: false, disableRulers: true });
    this._editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, INTERACTIVE_EDITOR_VIEW_STATE_PREFERENCE_KEY);
    this._register(this._keybindingService.onDidUpdateKeybindings(this._updateInputHint, this));
    this._register(notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && isEqual(e.notebook, this._notebookWidget.value?.viewModel?.notebookDocument.uri)) {
        const cell = this._notebookWidget.value?.getCellByHandle(e.cellHandle);
        if (cell && e.changed?.state) {
          this._scrollIfNecessary(cell);
        }
      }
    }));
  }
  get onDidFocus() {
    return this._onDidFocusWidget.event;
  }
  get inputCellContainerHeight() {
    return 19 + 2 + INPUT_CELL_VERTICAL_PADDING * 2 + INPUT_EDITOR_PADDING * 2;
  }
  get inputCellEditorHeight() {
    return 19 + INPUT_EDITOR_PADDING * 2;
  }
  createEditor(parent) {
    DOM.append(parent, this._rootElement);
    this._rootElement.style.position = "relative";
    this._notebookEditorContainer = DOM.append(this._rootElement, DOM.$(".notebook-editor-container"));
    this._inputCellContainer = DOM.append(this._rootElement, DOM.$(".input-cell-container"));
    this._inputCellContainer.style.position = "absolute";
    this._inputCellContainer.style.height = `${this.inputCellContainerHeight}px`;
    this._inputFocusIndicator = DOM.append(this._inputCellContainer, DOM.$(".input-focus-indicator"));
    this._inputRunButtonContainer = DOM.append(this._inputCellContainer, DOM.$(".run-button-container"));
    this._setupRunButtonToolbar(this._inputRunButtonContainer);
    this._inputEditorContainer = DOM.append(this._inputCellContainer, DOM.$(".input-editor-container"));
    this._createLayoutStyles();
  }
  _setupRunButtonToolbar(runButtonContainer) {
    const menu = this._register(this._menuService.createMenu(MenuId.ReplInputExecute, this._contextKeyService));
    this._runbuttonToolbar = this._register(new ToolBar(runButtonContainer, this._contextMenuService, {
      getKeyBinding: (action) => this._keybindingService.lookupKeybinding(action.id),
      actionViewItemProvider: (action, options) => {
        return createActionViewItem(this._instantiationService, action, options);
      },
      renderDropdownAsChildElement: true
    }));
    const { primary, secondary } = getActionBarActions(menu.getActions({ shouldForwardArgs: true }));
    this._runbuttonToolbar.setActions([...primary, ...secondary]);
  }
  _createLayoutStyles() {
    this._styleElement = domStylesheets.createStyleSheet(this._rootElement);
    const styleSheets = [];
    const {
      codeCellLeftMargin,
      cellRunGutter
    } = this._notebookOptions.getLayoutConfiguration();
    const {
      focusIndicator
    } = this._notebookOptions.getDisplayOptions();
    const leftMargin = this._notebookOptions.getCellEditorContainerLeftMargin();
    styleSheets.push(`
			.interactive-editor .input-cell-container {
				padding: ${INPUT_CELL_VERTICAL_PADDING}px ${INPUT_CELL_HORIZONTAL_PADDING_RIGHT}px ${INPUT_CELL_VERTICAL_PADDING}px ${leftMargin}px;
			}
		`);
    if (focusIndicator === "gutter") {
      styleSheets.push(`
				.interactive-editor .input-cell-container:focus-within .input-focus-indicator::before {
					border-color: var(--vscode-notebook-focusedCellBorder) !important;
				}
				.interactive-editor .input-focus-indicator::before {
					border-color: var(--vscode-notebook-inactiveFocusedCellBorder) !important;
				}
				.interactive-editor .input-cell-container .input-focus-indicator {
					display: block;
					top: ${INPUT_CELL_VERTICAL_PADDING}px;
				}
				.interactive-editor .input-cell-container {
					border-top: 1px solid var(--vscode-notebook-inactiveFocusedCellBorder);
				}
			`);
    } else {
      styleSheets.push(`
				.interactive-editor .input-cell-container {
					border-top: 1px solid var(--vscode-notebook-inactiveFocusedCellBorder);
				}
				.interactive-editor .input-cell-container .input-focus-indicator {
					display: none;
				}
			`);
    }
    styleSheets.push(`
			.interactive-editor .input-cell-container .run-button-container {
				width: ${cellRunGutter}px;
				left: ${codeCellLeftMargin}px;
				margin-top: ${INPUT_EDITOR_PADDING - 2}px;
			}
		`);
    this._styleElement.textContent = styleSheets.join("\n");
  }
  _computeEditorOptions() {
    let overrideIdentifier = void 0;
    if (this._codeEditorWidget) {
      overrideIdentifier = this._codeEditorWidget.getModel()?.getLanguageId();
    }
    const editorOptions = deepClone(this._configurationService.getValue("editor", { overrideIdentifier }));
    const editorOptionsOverride = getSimpleEditorOptions(this._configurationService);
    const computed = Object.freeze({
      ...editorOptions,
      ...editorOptionsOverride,
      ...{
        ariaLabel: localize("replEditorInput", "REPL Input"),
        glyphMargin: true,
        padding: {
          top: INPUT_EDITOR_PADDING,
          bottom: INPUT_EDITOR_PADDING
        },
        hover: {
          enabled: true
        },
        rulers: []
      }
    });
    return computed;
  }
  saveState() {
    this._saveEditorViewState(this.input);
    super.saveState();
  }
  getViewState() {
    const input = this.input;
    if (!(input instanceof ReplEditorInput)) {
      return void 0;
    }
    this._saveEditorViewState(input);
    return this._loadNotebookEditorViewState(input);
  }
  _saveEditorViewState(input) {
    if (this._notebookWidget.value && input instanceof ReplEditorInput) {
      if (this._notebookWidget.value.isDisposed) {
        return;
      }
      const state = this._notebookWidget.value.getEditorViewState();
      const editorState = this._codeEditorWidget.saveViewState();
      this._editorMemento.saveEditorState(this.group, input.resource, {
        notebook: state,
        input: editorState
      });
    }
  }
  _loadNotebookEditorViewState(input) {
    const result = this._editorMemento.loadEditorState(this.group, input.resource);
    if (result) {
      return result;
    }
    for (const group of this._editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      if (group.activeEditorPane !== this && group.activeEditorPane === this && group.activeEditor?.matches(input)) {
        const notebook = this._notebookWidget.value?.getEditorViewState();
        const input2 = this._codeEditorWidget.saveViewState();
        return {
          notebook,
          input: input2
        };
      }
    }
    return;
  }
  async setInput(input, options, context, token) {
    this._notebookWidget.value?.onWillHide();
    this._codeEditorWidget?.dispose();
    this._widgetDisposableStore.clear();
    this._notebookWidget = this._instantiationService.invokeFunction(this._notebookWidgetService.retrieveWidget, this.group.id, input, {
      isReplHistory: true,
      isReadOnly: true,
      contributions: NotebookEditorExtensionsRegistry.getSomeEditorContributions([
        ExecutionStateCellStatusBarContrib.id,
        TimerCellStatusBarContrib.id,
        NotebookFindContrib.id
      ]),
      menuIds: {
        notebookToolbar: MenuId.InteractiveToolbar,
        cellTitleToolbar: MenuId.InteractiveCellTitle,
        cellDeleteToolbar: MenuId.InteractiveCellDelete,
        cellInsertToolbar: MenuId.NotebookCellBetween,
        cellTopInsertToolbar: MenuId.NotebookCellListTop,
        cellExecuteToolbar: MenuId.InteractiveCellExecute,
        cellExecutePrimary: void 0
      },
      cellEditorContributions: EditorExtensionsRegistry.getSomeEditorContributions([
        SelectionClipboardContributionID,
        ContextMenuController.ID,
        ContentHoverController.ID,
        GlyphHoverController.ID,
        MarkerController.ID
      ]),
      options: this._notebookOptions,
      codeWindow: this.window
    }, void 0, this.window);
    const skipContributions = [
      "workbench.notebook.cellToolbar",
      "editor.contrib.inlineCompletionsController"
    ];
    const inputContributions = getDefaultNotebookCreationOptions().cellEditorContributions?.filter((c) => skipContributions.indexOf(c.id) === -1);
    this._codeEditorWidget = this._instantiationService.createInstance(CodeEditorWidget, this._inputEditorContainer, this._editorOptions, {
      ...{
        isSimpleWidget: false,
        contributions: inputContributions
      }
    });
    if (this._lastLayoutDimensions) {
      this._notebookEditorContainer.style.height = `${this._lastLayoutDimensions.dimension.height - this.inputCellContainerHeight}px`;
      this._notebookWidget.value.layout(new DOM.Dimension(this._lastLayoutDimensions.dimension.width, this._lastLayoutDimensions.dimension.height - this.inputCellContainerHeight), this._notebookEditorContainer);
      const leftMargin = this._notebookOptions.getCellEditorContainerLeftMargin();
      const maxHeight = Math.min(this._lastLayoutDimensions.dimension.height / 2, this.inputCellEditorHeight);
      this._codeEditorWidget.layout(this._validateDimension(this._lastLayoutDimensions.dimension.width - leftMargin - INPUT_CELL_HORIZONTAL_PADDING_RIGHT, maxHeight));
      this._inputFocusIndicator.style.height = `${this.inputCellEditorHeight}px`;
      this._inputCellContainer.style.top = `${this._lastLayoutDimensions.dimension.height - this.inputCellContainerHeight}px`;
      this._inputCellContainer.style.width = `${this._lastLayoutDimensions.dimension.width}px`;
    }
    await super.setInput(input, options, context, token);
    const model = await input.resolve();
    if (this._runbuttonToolbar) {
      this._runbuttonToolbar.context = input.resource;
    }
    if (model === null) {
      throw new Error("The REPL model could not be resolved");
    }
    this._notebookWidget.value?.setParentContextKeyService(this._contextKeyService);
    const viewState = options?.viewState ?? this._loadNotebookEditorViewState(input);
    await this._extensionService.whenInstalledExtensionsRegistered();
    await this._notebookWidget.value.setModel(model.notebook, viewState?.notebook, void 0, "repl");
    model.notebook.setCellCollapseDefault(this._notebookOptions.getCellCollapseDefault());
    this._notebookWidget.value.setOptions({
      isReadOnly: true
    });
    this._widgetDisposableStore.add(this._notebookWidget.value.onDidResizeOutput((cvm) => {
      this._scrollIfNecessary(cvm);
    }));
    this._widgetDisposableStore.add(this._notebookWidget.value.onDidFocusWidget(() => this._onDidFocusWidget.fire()));
    this._widgetDisposableStore.add(this._notebookOptions.onDidChangeOptions((e) => {
      if (e.compactView || e.focusIndicator) {
        this._styleElement?.remove();
        this._createLayoutStyles();
      }
      if (this._lastLayoutDimensions && this.isVisible()) {
        this.layout(this._lastLayoutDimensions.dimension, this._lastLayoutDimensions.position);
      }
      if (e.interactiveWindowCollapseCodeCells) {
        model.notebook.setCellCollapseDefault(this._notebookOptions.getCellCollapseDefault());
      }
    }));
    const editorModel = await input.resolveInput(model.notebook);
    this._codeEditorWidget.setModel(editorModel);
    if (viewState?.input) {
      this._codeEditorWidget.restoreViewState(viewState.input);
    }
    this._editorOptions = this._computeEditorOptions();
    this._codeEditorWidget.updateOptions(this._editorOptions);
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidFocusEditorWidget(() => this._onDidFocusWidget.fire()));
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidContentSizeChange((e) => {
      if (!e.contentHeightChanged) {
        return;
      }
      if (this._lastLayoutDimensions) {
        this._layoutWidgets(this._lastLayoutDimensions.dimension, this._lastLayoutDimensions.position);
      }
    }));
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidChangeCursorPosition((e) => this._onDidChangeSelection.fire({ reason: this._toEditorPaneSelectionChangeReason(e) })));
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidChangeModelContent(() => this._onDidChangeSelection.fire({ reason: EditorPaneSelectionChangeReason.EDIT })));
    this._widgetDisposableStore.add(this._notebookKernelService.onDidChangeNotebookAffinity(this._syncWithKernel, this));
    this._widgetDisposableStore.add(this._notebookKernelService.onDidChangeSelectedNotebooks(this._syncWithKernel, this));
    this._widgetDisposableStore.add(this.themeService.onDidColorThemeChange(() => {
      if (this.isVisible()) {
        this._updateInputHint();
      }
    }));
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidChangeModelContent(() => {
      if (this.isVisible()) {
        this._updateInputHint();
      }
    }));
    this._codeEditorWidget.onDidChangeModelDecorations(() => {
      if (this.isVisible()) {
        this._updateInputHint();
      }
    });
    const cursorAtBoundaryContext = INTERACTIVE_INPUT_CURSOR_BOUNDARY.bindTo(this._contextKeyService);
    if (input.resource && input.historyService.has(input.resource)) {
      cursorAtBoundaryContext.set("top");
    } else {
      cursorAtBoundaryContext.set("none");
    }
    this._widgetDisposableStore.add(this._codeEditorWidget.onDidChangeCursorPosition(({ position }) => {
      const viewModel = this._codeEditorWidget._getViewModel();
      const lastLineNumber = viewModel.getLineCount();
      const lastLineCol = viewModel.getLineLength(lastLineNumber) + 1;
      const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
      const firstLine = viewPosition.lineNumber === 1 && viewPosition.column === 1;
      const lastLine = viewPosition.lineNumber === lastLineNumber && viewPosition.column === lastLineCol;
      if (firstLine) {
        if (lastLine) {
          cursorAtBoundaryContext.set("both");
        } else {
          cursorAtBoundaryContext.set("top");
        }
      } else {
        if (lastLine) {
          cursorAtBoundaryContext.set("bottom");
        } else {
          cursorAtBoundaryContext.set("none");
        }
      }
    }));
    this._widgetDisposableStore.add(editorModel.onDidChangeContent(() => {
      const value = editorModel.getValue();
      if (this.input?.resource && value !== "") {
        const historyService = this.input.historyService;
        if (!historyService.matchesCurrent(this.input.resource, value)) {
          historyService.replaceLast(this.input.resource, value);
        }
      }
    }));
    this._widgetDisposableStore.add(this._notebookWidget.value.onDidScroll(() => this._onDidChangeScroll.fire()));
    this._widgetDisposableStore.add(this._notebookWidget.value.onDidChangeViewCells(this.handleViewCellChange, this));
    this._updateInputHint();
    this._syncWithKernel();
  }
  handleViewCellChange(e) {
    const notebookWidget = this._notebookWidget.value;
    if (!notebookWidget) {
      return;
    }
    for (const splice of e.splices) {
      const [_start, _delete, addedCells] = splice;
      if (addedCells.length) {
        const viewModel = notebookWidget.viewModel;
        if (viewModel) {
          this.handleAppend(notebookWidget, viewModel);
          break;
        }
      }
    }
  }
  handleAppend(notebookWidget, viewModel) {
    this._notebookWidgetService.updateReplContextKey(viewModel.notebookDocument.uri.toString());
    const navigateToCell = this._configurationService.getValue("accessibility.replEditor.autoFocusReplExecution");
    if (this._accessibilityService.isScreenReaderOptimized()) {
      if (navigateToCell === "lastExecution") {
        setTimeout(() => {
          const lastCellIndex = viewModel.length - 1;
          if (lastCellIndex >= 0) {
            const cell = viewModel.viewCells[lastCellIndex];
            notebookWidget.focusNotebookCell(cell, "container");
          }
        }, 0);
      } else if (navigateToCell === "input") {
        this._codeEditorWidget.focus();
      }
    }
  }
  setOptions(options) {
    this._notebookWidget.value?.setOptions(options);
    super.setOptions(options);
  }
  _toEditorPaneSelectionChangeReason(e) {
    switch (e.source) {
      case TextEditorSelectionSource.PROGRAMMATIC:
        return EditorPaneSelectionChangeReason.PROGRAMMATIC;
      case TextEditorSelectionSource.NAVIGATION:
        return EditorPaneSelectionChangeReason.NAVIGATION;
      case TextEditorSelectionSource.JUMP:
        return EditorPaneSelectionChangeReason.JUMP;
      default:
        return EditorPaneSelectionChangeReason.USER;
    }
  }
  _cellAtBottom(cell) {
    const visibleRanges = this._notebookWidget.value?.visibleRanges || [];
    const cellIndex = this._notebookWidget.value?.getCellIndex(cell);
    if (cellIndex === Math.max(...visibleRanges.map((range) => range.end - 1))) {
      return true;
    }
    return false;
  }
  _scrollIfNecessary(cvm) {
    const index = this._notebookWidget.value.getCellIndex(cvm);
    if (index === this._notebookWidget.value.getLength() - 1) {
      if (this._configurationService.getValue(ReplEditorSettings.interactiveWindowAlwaysScrollOnNewCell) || this._cellAtBottom(cvm)) {
        this._notebookWidget.value.scrollToBottom();
      }
    }
  }
  _syncWithKernel() {
    const notebook = this._notebookWidget.value?.textModel;
    const textModel = this._codeEditorWidget.getModel();
    if (notebook && textModel) {
      const info = this._notebookKernelService.getMatchingKernel(notebook);
      const selectedOrSuggested = info.selected ?? (info.suggestions.length === 1 ? info.suggestions[0] : void 0) ?? (info.all.length === 1 ? info.all[0] : void 0);
      if (selectedOrSuggested) {
        const language = selectedOrSuggested.supportedLanguages[0];
        if (language && language !== "plaintext") {
          const newMode = this._languageService.createById(language).languageId;
          textModel.setLanguage(newMode);
        }
        NOTEBOOK_KERNEL.bindTo(this._contextKeyService).set(selectedOrSuggested.id);
      }
    }
  }
  layout(dimension, position) {
    this._rootElement.classList.toggle("mid-width", dimension.width < 1e3 && dimension.width >= 600);
    this._rootElement.classList.toggle("narrow-width", dimension.width < 600);
    const editorHeightChanged = dimension.height !== this._lastLayoutDimensions?.dimension.height;
    this._lastLayoutDimensions = { dimension, position };
    if (!this._notebookWidget.value) {
      return;
    }
    if (editorHeightChanged && this._codeEditorWidget) {
      SuggestController.get(this._codeEditorWidget)?.cancelSuggestWidget();
    }
    this._notebookEditorContainer.style.height = `${this._lastLayoutDimensions.dimension.height - this.inputCellContainerHeight}px`;
    this._layoutWidgets(dimension, position);
  }
  _layoutWidgets(dimension, position) {
    const contentHeight = this._codeEditorWidget.hasModel() ? this._codeEditorWidget.getContentHeight() : this.inputCellEditorHeight;
    const maxHeight = Math.min(dimension.height / 2, contentHeight);
    const leftMargin = this._notebookOptions.getCellEditorContainerLeftMargin();
    const inputCellContainerHeight = maxHeight + INPUT_CELL_VERTICAL_PADDING * 2;
    this._notebookEditorContainer.style.height = `${dimension.height - inputCellContainerHeight}px`;
    this._notebookWidget.value.layout(dimension.with(dimension.width, dimension.height - inputCellContainerHeight), this._notebookEditorContainer, position);
    this._codeEditorWidget.layout(this._validateDimension(dimension.width - leftMargin - INPUT_CELL_HORIZONTAL_PADDING_RIGHT, maxHeight));
    this._inputFocusIndicator.style.height = `${contentHeight}px`;
    this._inputCellContainer.style.top = `${dimension.height - inputCellContainerHeight}px`;
    this._inputCellContainer.style.width = `${dimension.width}px`;
  }
  _validateDimension(width, height) {
    return new DOM.Dimension(Math.max(0, width), Math.max(0, height));
  }
  _hasConflictingDecoration() {
    return Boolean(this._codeEditorWidget.getLineDecorations(1)?.find(
      (d) => d.options.beforeContentClassName || d.options.afterContentClassName || d.options.before?.content || d.options.after?.content
    ));
  }
  _updateInputHint() {
    if (!this._codeEditorWidget) {
      return;
    }
    const shouldHide = !this._codeEditorWidget.hasModel() || this._configurationService.getValue(ReplEditorSettings.showExecutionHint) === false || this._codeEditorWidget.getModel().getValueLength() !== 0 || this._hasConflictingDecoration();
    if (!this._hintElement && !shouldHide) {
      this._hintElement = this._instantiationService.createInstance(ReplInputHintContentWidget, this._codeEditorWidget);
    } else if (this._hintElement && shouldHide) {
      this._hintElement.dispose();
      this._hintElement = void 0;
    }
  }
  getScrollPosition() {
    return {
      scrollTop: this._notebookWidget.value?.scrollTop ?? 0,
      scrollLeft: 0
    };
  }
  setScrollPosition(position) {
    this._notebookWidget.value?.setScrollTop(position.scrollTop);
  }
  focus() {
    super.focus();
    this._notebookWidget.value?.onShow();
    this._codeEditorWidget.focus();
  }
  focusHistory() {
    this._notebookWidget.value.focus();
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    this._groupListener.value = this.group.onWillCloseEditor((e) => this._saveEditorViewState(e.editor));
    if (!visible) {
      this._saveEditorViewState(this.input);
      if (this.input && this._notebookWidget.value) {
        this._notebookWidget.value.onWillHide();
      }
    }
    this._updateInputHint();
  }
  clearInput() {
    if (this._notebookWidget.value) {
      this._saveEditorViewState(this.input);
      this._notebookWidget.value.onWillHide();
    }
    this._codeEditorWidget?.dispose();
    this._notebookWidget = { value: void 0 };
    this._widgetDisposableStore.clear();
    super.clearInput();
  }
  getControl() {
    return {
      notebookEditor: this._notebookWidget.value,
      activeCodeEditor: this.getActiveCodeEditor(),
      onDidChangeActiveEditor: Event.None
    };
  }
  getActiveCodeEditor() {
    if (!this._codeEditorWidget) {
      return void 0;
    }
    return this._codeEditorWidget.hasWidgetFocus() || !this._notebookWidget.value?.activeCodeEditor ? this._codeEditorWidget : this._notebookWidget.value.activeCodeEditor;
  }
};
ReplEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, INotebookEditorService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, INotebookKernelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, IContextMenuService),
  __decorateParam(13, IEditorGroupsService),
  __decorateParam(14, ITextResourceConfigurationService),
  __decorateParam(15, INotebookExecutionStateService),
  __decorateParam(16, IExtensionService),
  __decorateParam(17, IAccessibilityService)
], ReplEditor);
function isReplEditorControl(control) {
  const candidate = control;
  return candidate?.activeCodeEditor instanceof CodeEditorWidget && candidate?.notebookEditor instanceof NotebookEditorWidget;
}
export {
  ReplEditor,
  isReplEditorControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZXBsTm90ZWJvb2svYnJvd3Nlci9yZXBsRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2ludGVyYWN0aXZlLmNzcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yVmlld1N0YXRlLCBJQ29tcG9zaXRlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbiwgSUVkaXRvck1lbWVudG8sIElFZGl0b3JPcGVuQ29udGV4dCwgSUVkaXRvclBhbmVTY3JvbGxQb3NpdGlvbiwgSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCwgSUVkaXRvclBhbmVXaXRoU2Nyb2xsaW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBnZXRTaW1wbGVFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3NpbXBsZUVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNlbGxWaWV3TW9kZWwsIElOb3RlYm9va0VkaXRvck9wdGlvbnMsIElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSwgSU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tFZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElCb3Jyb3dWYWx1ZSwgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHROb3RlYm9va0NyZWF0aW9uT3B0aW9ucywgTm90ZWJvb2tFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEdyb3Vwc09yZGVyLCBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4ZWN1dGlvblN0YXRlQ2VsbFN0YXR1c0JhckNvbnRyaWIsIFRpbWVyQ2VsbFN0YXR1c0JhckNvbnRyaWIgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvY2VsbFN0YXR1c0Jhci9leGVjdXRpb25TdGF0dXNCYXJJdGVtQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rS2VybmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVwbEVkaXRvclNldHRpbmdzLCBJTlRFUkFDVElWRV9JTlBVVF9DVVJTT1JfQk9VTkRBUlkgfSBmcm9tICcuLi8uLi9pbnRlcmFjdGl2ZS9icm93c2VyL2ludGVyYWN0aXZlQ29tbW9uLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tPcHRpb25zIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b29sYmFyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgY3JlYXRlQWN0aW9uVmlld0l0ZW0sIGdldEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb25DbGlwYm9hcmRDb250cmlidXRpb25JRCB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9zZWxlY3Rpb25DbGlwYm9hcmQuanMnO1xuaW1wb3J0IHsgQ29udGV4dE1lbnVDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29udGV4dG1lbnUvYnJvd3Nlci9jb250ZXh0bWVudS5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBNYXJrZXJDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZ290b0Vycm9yL2Jyb3dzZXIvZ290b0Vycm9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JPcHRpb25zLCBUZXh0RWRpdG9yU2VsZWN0aW9uU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLCBOb3RlYm9va0V4ZWN1dGlvblR5cGUgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfS0VSTkVMIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jdXJzb3JFdmVudHMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tGaW5kQ29udHJpYiB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9maW5kL25vdGVib29rRmluZFdpZGdldC5qcyc7XG5pbXBvcnQgeyBSRVBMX0VESVRPUl9JRCB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgJy4vaW50ZXJhY3RpdmVFZGl0b3IuY3NzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IEdseXBoSG92ZXJDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9nbHlwaEhvdmVyQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDb250ZW50SG92ZXJDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9jb250ZW50SG92ZXJDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IFJlcGxFZGl0b3JJbnB1dCB9IGZyb20gJy4vcmVwbEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFJlcGxJbnB1dEhpbnRDb250ZW50V2lkZ2V0IH0gZnJvbSAnLi4vLi4vaW50ZXJhY3RpdmUvYnJvd3Nlci9yZXBsSW5wdXRIaW50Q29udGVudFdpZGdldC5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1ZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvdmlld01vZGVsL25vdGVib29rVmlld01vZGVsSW1wbC5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcblxuY29uc3QgSU5URVJBQ1RJVkVfRURJVE9SX1ZJRVdfU1RBVEVfUFJFRkVSRU5DRV9LRVkgPSAnSW50ZXJhY3RpdmVFZGl0b3JWaWV3U3RhdGUnO1xuXG5jb25zdCBJTlBVVF9DRUxMX1ZFUlRJQ0FMX1BBRERJTkcgPSA4O1xuY29uc3QgSU5QVVRfQ0VMTF9IT1JJWk9OVEFMX1BBRERJTkdfUklHSFQgPSAxMDtcbmNvbnN0IElOUFVUX0VESVRPUl9QQURESU5HID0gODtcblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGl2ZUVkaXRvclZpZXdTdGF0ZSB7XG5cdHJlYWRvbmx5IG5vdGVib29rPzogSU5vdGVib29rRWRpdG9yVmlld1N0YXRlO1xuXHRyZWFkb25seSBpbnB1dD86IElDb2RlRWRpdG9yVmlld1N0YXRlIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGl2ZUVkaXRvck9wdGlvbnMgZXh0ZW5kcyBJVGV4dEVkaXRvck9wdGlvbnMge1xuXHRyZWFkb25seSB2aWV3U3RhdGU/OiBJbnRlcmFjdGl2ZUVkaXRvclZpZXdTdGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIFJlcGxFZGl0b3IgZXh0ZW5kcyBFZGl0b3JQYW5lIGltcGxlbWVudHMgSUVkaXRvclBhbmVXaXRoU2Nyb2xsaW5nIHtcblx0cHJpdmF0ZSBfcm9vdEVsZW1lbnQhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfc3R5bGVFbGVtZW50ITogSFRNTFN0eWxlRWxlbWVudDtcblx0cHJpdmF0ZSBfbm90ZWJvb2tFZGl0b3JDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfbm90ZWJvb2tXaWRnZXQ6IElCb3Jyb3dWYWx1ZTxOb3RlYm9va0VkaXRvcldpZGdldD4gPSB7IHZhbHVlOiB1bmRlZmluZWQgfTtcblx0cHJpdmF0ZSBfaW5wdXRDZWxsQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2lucHV0Rm9jdXNJbmRpY2F0b3IhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfaW5wdXRSdW5CdXR0b25Db250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfaW5wdXRFZGl0b3JDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfY29kZUVkaXRvcldpZGdldCE6IENvZGVFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgX25vdGVib29rV2lkZ2V0U2VydmljZTogSU5vdGVib29rRWRpdG9yU2VydmljZTtcblx0cHJpdmF0ZSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblx0cHJpdmF0ZSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXHRwcml2YXRlIF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRwcml2YXRlIF9ub3RlYm9va0tlcm5lbFNlcnZpY2U6IElOb3RlYm9va0tlcm5lbFNlcnZpY2U7XG5cdHByaXZhdGUgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2U7XG5cdHByaXZhdGUgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2U7XG5cdHByaXZhdGUgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZTtcblx0cHJpdmF0ZSBfZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZTtcblx0cHJpdmF0ZSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dpZGdldERpc3Bvc2FibGVTdG9yZTogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfbGFzdExheW91dERpbWVuc2lvbnM/OiB7IHJlYWRvbmx5IGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbjsgcmVhZG9ubHkgcG9zaXRpb246IERPTS5JRG9tUG9zaXRpb24gfTtcblx0cHJpdmF0ZSBfZWRpdG9yT3B0aW9uczogSUVkaXRvck9wdGlvbnM7XG5cdHByaXZhdGUgX25vdGVib29rT3B0aW9uczogTm90ZWJvb2tPcHRpb25zO1xuXHRwcml2YXRlIF9lZGl0b3JNZW1lbnRvOiBJRWRpdG9yTWVtZW50bzxJbnRlcmFjdGl2ZUVkaXRvclZpZXdTdGF0ZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dyb3VwTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgX3J1bmJ1dHRvblRvb2xiYXI6IFRvb2xCYXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2hpbnRFbGVtZW50OiBSZXBsSW5wdXRIaW50Q29udGVudFdpZGdldCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9vbkRpZEZvY3VzV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdG92ZXJyaWRlIGdldCBvbkRpZEZvY3VzKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkRm9jdXNXaWRnZXQuZXZlbnQ7IH1cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTY3JvbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTY3JvbGwgPSB0aGlzLl9vbkRpZENoYW5nZVNjcm9sbC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yU2VydmljZSBub3RlYm9va1dpZGdldFNlcnZpY2U6IElOb3RlYm9va0VkaXRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIG5vdGVib29rS2VybmVsU2VydmljZTogSU5vdGVib29rS2VybmVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdFJFUExfRURJVE9SX0lELFxuXHRcdFx0Z3JvdXAsXG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdFx0dGhlbWVTZXJ2aWNlLFxuXHRcdFx0c3RvcmFnZVNlcnZpY2Vcblx0XHQpO1xuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0U2VydmljZSA9IG5vdGVib29rV2lkZ2V0U2VydmljZTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRcdHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZSA9IG5vdGVib29rS2VybmVsU2VydmljZTtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UgPSBsYW5ndWFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fa2V5YmluZGluZ1NlcnZpY2UgPSBrZXliaW5kaW5nU2VydmljZTtcblx0XHR0aGlzLl9tZW51U2VydmljZSA9IG1lbnVTZXJ2aWNlO1xuXHRcdHRoaXMuX2NvbnRleHRNZW51U2VydmljZSA9IGNvbnRleHRNZW51U2VydmljZTtcblx0XHR0aGlzLl9lZGl0b3JHcm91cFNlcnZpY2UgPSBlZGl0b3JHcm91cFNlcnZpY2U7XG5cdFx0dGhpcy5fZXh0ZW5zaW9uU2VydmljZSA9IGV4dGVuc2lvblNlcnZpY2U7XG5cblx0XHR0aGlzLl9yb290RWxlbWVudCA9IERPTS4kKCcuaW50ZXJhY3RpdmUtZWRpdG9yJyk7XG5cdFx0dGhpcy5fY29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy5fcm9vdEVsZW1lbnQpKTtcblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ2lzQ29tcG9zaXRlTm90ZWJvb2snLCB0cnVlKTtcblx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZV0pKSk7XG5cblx0XHR0aGlzLl9lZGl0b3JPcHRpb25zID0gdGhpcy5fY29tcHV0ZUVkaXRvck9wdGlvbnMoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yJykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbignbm90ZWJvb2snKSkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JPcHRpb25zID0gdGhpcy5fY29tcHV0ZUVkaXRvck9wdGlvbnMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tPcHRpb25zID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tPcHRpb25zLCB0aGlzLndpbmRvdywgdHJ1ZSwgeyBjZWxsVG9vbGJhckludGVyYWN0aW9uOiAnaG92ZXInLCBnbG9iYWxUb29sYmFyOiB0cnVlLCBzdGlja3lTY3JvbGxFbmFibGVkOiBmYWxzZSwgZHJhZ0FuZERyb3BFbmFibGVkOiBmYWxzZSwgZGlzYWJsZVJ1bGVyczogdHJ1ZSB9KTtcblx0XHR0aGlzLl9lZGl0b3JNZW1lbnRvID0gdGhpcy5nZXRFZGl0b3JNZW1lbnRvPEludGVyYWN0aXZlRWRpdG9yVmlld1N0YXRlPihlZGl0b3JHcm91cFNlcnZpY2UsIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJTlRFUkFDVElWRV9FRElUT1JfVklFV19TVEFURV9QUkVGRVJFTkNFX0tFWSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9rZXliaW5kaW5nU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzKHRoaXMuX3VwZGF0ZUlucHV0SGludCwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS50eXBlID09PSBOb3RlYm9va0V4ZWN1dGlvblR5cGUuY2VsbCAmJiBpc0VxdWFsKGUubm90ZWJvb2ssIHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy52aWV3TW9kZWw/Lm5vdGVib29rRG9jdW1lbnQudXJpKSkge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWU/LmdldENlbGxCeUhhbmRsZShlLmNlbGxIYW5kbGUpO1xuXHRcdFx0XHRpZiAoY2VsbCAmJiBlLmNoYW5nZWQ/LnN0YXRlKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2Nyb2xsSWZOZWNlc3NhcnkoY2VsbCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBpbnB1dENlbGxDb250YWluZXJIZWlnaHQoKSB7XG5cdFx0cmV0dXJuIDE5ICsgMiArIElOUFVUX0NFTExfVkVSVElDQUxfUEFERElORyAqIDIgKyBJTlBVVF9FRElUT1JfUEFERElORyAqIDI7XG5cdH1cblxuXHRwcml2YXRlIGdldCBpbnB1dENlbGxFZGl0b3JIZWlnaHQoKSB7XG5cdFx0cmV0dXJuIDE5ICsgSU5QVVRfRURJVE9SX1BBRERJTkcgKiAyO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0RE9NLmFwcGVuZChwYXJlbnQsIHRoaXMuX3Jvb3RFbGVtZW50KTtcblx0XHR0aGlzLl9yb290RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG5cdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3JDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX3Jvb3RFbGVtZW50LCBET00uJCgnLm5vdGVib29rLWVkaXRvci1jb250YWluZXInKSk7XG5cdFx0dGhpcy5faW5wdXRDZWxsQ29udGFpbmVyID0gRE9NLmFwcGVuZCh0aGlzLl9yb290RWxlbWVudCwgRE9NLiQoJy5pbnB1dC1jZWxsLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLl9pbnB1dENlbGxDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuX2lucHV0Q2VsbENvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmlucHV0Q2VsbENvbnRhaW5lckhlaWdodH1weGA7XG5cdFx0dGhpcy5faW5wdXRGb2N1c0luZGljYXRvciA9IERPTS5hcHBlbmQodGhpcy5faW5wdXRDZWxsQ29udGFpbmVyLCBET00uJCgnLmlucHV0LWZvY3VzLWluZGljYXRvcicpKTtcblx0XHR0aGlzLl9pbnB1dFJ1bkJ1dHRvbkNvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5faW5wdXRDZWxsQ29udGFpbmVyLCBET00uJCgnLnJ1bi1idXR0b24tY29udGFpbmVyJykpO1xuXHRcdHRoaXMuX3NldHVwUnVuQnV0dG9uVG9vbGJhcih0aGlzLl9pbnB1dFJ1bkJ1dHRvbkNvbnRhaW5lcik7XG5cdFx0dGhpcy5faW5wdXRFZGl0b3JDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX2lucHV0Q2VsbENvbnRhaW5lciwgRE9NLiQoJy5pbnB1dC1lZGl0b3ItY29udGFpbmVyJykpO1xuXHRcdHRoaXMuX2NyZWF0ZUxheW91dFN0eWxlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0dXBSdW5CdXR0b25Ub29sYmFyKHJ1bkJ1dHRvbkNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBtZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuUmVwbElucHV0RXhlY3V0ZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHR0aGlzLl9ydW5idXR0b25Ub29sYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRvb2xCYXIocnVuQnV0dG9uQ29udGFpbmVyLCB0aGlzLl9jb250ZXh0TWVudVNlcnZpY2UsIHtcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCksXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdHJldHVybiBjcmVhdGVBY3Rpb25WaWV3SXRlbSh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXJEcm9wZG93bkFzQ2hpbGRFbGVtZW50OiB0cnVlXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgeyBwcmltYXJ5LCBzZWNvbmRhcnkgfSA9IGdldEFjdGlvbkJhckFjdGlvbnMobWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSkpO1xuXHRcdHRoaXMuX3J1bmJ1dHRvblRvb2xiYXIuc2V0QWN0aW9ucyhbLi4ucHJpbWFyeSwgLi4uc2Vjb25kYXJ5XSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVMYXlvdXRTdHlsZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHMuY3JlYXRlU3R5bGVTaGVldCh0aGlzLl9yb290RWxlbWVudCk7XG5cdFx0Y29uc3Qgc3R5bGVTaGVldHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRjb25zdCB7XG5cdFx0XHRjb2RlQ2VsbExlZnRNYXJnaW4sXG5cdFx0XHRjZWxsUnVuR3V0dGVyXG5cdFx0fSA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5nZXRMYXlvdXRDb25maWd1cmF0aW9uKCk7XG5cdFx0Y29uc3Qge1xuXHRcdFx0Zm9jdXNJbmRpY2F0b3Jcblx0XHR9ID0gdGhpcy5fbm90ZWJvb2tPcHRpb25zLmdldERpc3BsYXlPcHRpb25zKCk7XG5cdFx0Y29uc3QgbGVmdE1hcmdpbiA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5nZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbigpO1xuXG5cdFx0c3R5bGVTaGVldHMucHVzaChgXG5cdFx0XHQuaW50ZXJhY3RpdmUtZWRpdG9yIC5pbnB1dC1jZWxsLWNvbnRhaW5lciB7XG5cdFx0XHRcdHBhZGRpbmc6ICR7SU5QVVRfQ0VMTF9WRVJUSUNBTF9QQURESU5HfXB4ICR7SU5QVVRfQ0VMTF9IT1JJWk9OVEFMX1BBRERJTkdfUklHSFR9cHggJHtJTlBVVF9DRUxMX1ZFUlRJQ0FMX1BBRERJTkd9cHggJHtsZWZ0TWFyZ2lufXB4O1xuXHRcdFx0fVxuXHRcdGApO1xuXHRcdGlmIChmb2N1c0luZGljYXRvciA9PT0gJ2d1dHRlcicpIHtcblx0XHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdFx0XHQuaW50ZXJhY3RpdmUtZWRpdG9yIC5pbnB1dC1jZWxsLWNvbnRhaW5lcjpmb2N1cy13aXRoaW4gLmlucHV0LWZvY3VzLWluZGljYXRvcjo6YmVmb3JlIHtcblx0XHRcdFx0XHRib3JkZXItY29sb3I6IHZhcigtLXZzY29kZS1ub3RlYm9vay1mb2N1c2VkQ2VsbEJvcmRlcikgIWltcG9ydGFudDtcblx0XHRcdFx0fVxuXHRcdFx0XHQuaW50ZXJhY3RpdmUtZWRpdG9yIC5pbnB1dC1mb2N1cy1pbmRpY2F0b3I6OmJlZm9yZSB7XG5cdFx0XHRcdFx0Ym9yZGVyLWNvbG9yOiB2YXIoLS12c2NvZGUtbm90ZWJvb2staW5hY3RpdmVGb2N1c2VkQ2VsbEJvcmRlcikgIWltcG9ydGFudDtcblx0XHRcdFx0fVxuXHRcdFx0XHQuaW50ZXJhY3RpdmUtZWRpdG9yIC5pbnB1dC1jZWxsLWNvbnRhaW5lciAuaW5wdXQtZm9jdXMtaW5kaWNhdG9yIHtcblx0XHRcdFx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRcdFx0XHR0b3A6ICR7SU5QVVRfQ0VMTF9WRVJUSUNBTF9QQURESU5HfXB4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdC5pbnRlcmFjdGl2ZS1lZGl0b3IgLmlucHV0LWNlbGwtY29udGFpbmVyIHtcblx0XHRcdFx0XHRib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tdnNjb2RlLW5vdGVib29rLWluYWN0aXZlRm9jdXNlZENlbGxCb3JkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHRgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYm9yZGVyXG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdFx0LmludGVyYWN0aXZlLWVkaXRvciAuaW5wdXQtY2VsbC1jb250YWluZXIge1xuXHRcdFx0XHRcdGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS12c2NvZGUtbm90ZWJvb2staW5hY3RpdmVGb2N1c2VkQ2VsbEJvcmRlcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0LmludGVyYWN0aXZlLWVkaXRvciAuaW5wdXQtY2VsbC1jb250YWluZXIgLmlucHV0LWZvY3VzLWluZGljYXRvciB7XG5cdFx0XHRcdFx0ZGlzcGxheTogbm9uZTtcblx0XHRcdFx0fVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0c3R5bGVTaGVldHMucHVzaChgXG5cdFx0XHQuaW50ZXJhY3RpdmUtZWRpdG9yIC5pbnB1dC1jZWxsLWNvbnRhaW5lciAucnVuLWJ1dHRvbi1jb250YWluZXIge1xuXHRcdFx0XHR3aWR0aDogJHtjZWxsUnVuR3V0dGVyfXB4O1xuXHRcdFx0XHRsZWZ0OiAke2NvZGVDZWxsTGVmdE1hcmdpbn1weDtcblx0XHRcdFx0bWFyZ2luLXRvcDogJHtJTlBVVF9FRElUT1JfUEFERElORyAtIDJ9cHg7XG5cdFx0XHR9XG5cdFx0YCk7XG5cblx0XHR0aGlzLl9zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBzdHlsZVNoZWV0cy5qb2luKCdcXG4nKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVFZGl0b3JPcHRpb25zKCk6IElFZGl0b3JPcHRpb25zIHtcblx0XHRsZXQgb3ZlcnJpZGVJZGVudGlmaWVyOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQpIHtcblx0XHRcdG92ZXJyaWRlSWRlbnRpZmllciA9IHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuZ2V0TW9kZWwoKT8uZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdH1cblx0XHRjb25zdCBlZGl0b3JPcHRpb25zID0gZGVlcENsb25lKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJywgeyBvdmVycmlkZUlkZW50aWZpZXIgfSkpO1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnNPdmVycmlkZSA9IGdldFNpbXBsZUVkaXRvck9wdGlvbnModGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbXB1dGVkID0gT2JqZWN0LmZyZWV6ZSh7XG5cdFx0XHQuLi5lZGl0b3JPcHRpb25zLFxuXHRcdFx0Li4uZWRpdG9yT3B0aW9uc092ZXJyaWRlLFxuXHRcdFx0Li4ue1xuXHRcdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdyZXBsRWRpdG9ySW5wdXQnLCBcIlJFUEwgSW5wdXRcIiksXG5cdFx0XHRcdGdseXBoTWFyZ2luOiB0cnVlLFxuXHRcdFx0XHRwYWRkaW5nOiB7XG5cdFx0XHRcdFx0dG9wOiBJTlBVVF9FRElUT1JfUEFERElORyxcblx0XHRcdFx0XHRib3R0b206IElOUFVUX0VESVRPUl9QQURESU5HXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGhvdmVyOiB7XG5cdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRydWxlcnM6IFtdXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gY29tcHV0ZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgc2F2ZVN0YXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NhdmVFZGl0b3JWaWV3U3RhdGUodGhpcy5pbnB1dCk7XG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRWaWV3U3RhdGUoKTogSW50ZXJhY3RpdmVFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5pbnB1dDtcblx0XHRpZiAoIShpbnB1dCBpbnN0YW5jZW9mIFJlcGxFZGl0b3JJbnB1dCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2F2ZUVkaXRvclZpZXdTdGF0ZShpbnB1dCk7XG5cdFx0cmV0dXJuIHRoaXMuX2xvYWROb3RlYm9va0VkaXRvclZpZXdTdGF0ZShpbnB1dCk7XG5cdH1cblxuXHRwcml2YXRlIF9zYXZlRWRpdG9yVmlld1N0YXRlKGlucHV0OiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZSAmJiBpbnB1dCBpbnN0YW5jZW9mIFJlcGxFZGl0b3JJbnB1dCkge1xuXHRcdFx0aWYgKHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlLmdldEVkaXRvclZpZXdTdGF0ZSgpO1xuXHRcdFx0Y29uc3QgZWRpdG9yU3RhdGUgPSB0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0LnNhdmVWaWV3U3RhdGUoKTtcblx0XHRcdHRoaXMuX2VkaXRvck1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRoaXMuZ3JvdXAsIGlucHV0LnJlc291cmNlLCB7XG5cdFx0XHRcdG5vdGVib29rOiBzdGF0ZSxcblx0XHRcdFx0aW5wdXQ6IGVkaXRvclN0YXRlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sb2FkTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUoaW5wdXQ6IFJlcGxFZGl0b3JJbnB1dCk6IEludGVyYWN0aXZlRWRpdG9yVmlld1N0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9lZGl0b3JNZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0aGlzLmdyb3VwLCBpbnB1dC5yZXNvdXJjZSk7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0Ly8gd2hlbiB3ZSBkb24ndCBoYXZlIGEgdmlldyBzdGF0ZSBmb3IgdGhlIGdyb3VwL2lucHV0LXR1cGxlIHRoZW4gd2UgdHJ5IHRvIHVzZSBhbiBleGlzdGluZ1xuXHRcdC8vIGVkaXRvciBmb3IgdGhlIHNhbWUgcmVzb3VyY2UuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLl9lZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKSkge1xuXHRcdFx0aWYgKGdyb3VwLmFjdGl2ZUVkaXRvclBhbmUgIT09IHRoaXMgJiYgZ3JvdXAuYWN0aXZlRWRpdG9yUGFuZSA9PT0gdGhpcyAmJiBncm91cC5hY3RpdmVFZGl0b3I/Lm1hdGNoZXMoaW5wdXQpKSB7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rID0gdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWU/LmdldEVkaXRvclZpZXdTdGF0ZSgpO1xuXHRcdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuc2F2ZVZpZXdTdGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5vdGVib29rLFxuXHRcdFx0XHRcdGlucHV0XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybjtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNldElucHV0KGlucHV0OiBSZXBsRWRpdG9ySW5wdXQsIG9wdGlvbnM6IEludGVyYWN0aXZlRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dDogSUVkaXRvck9wZW5Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyB0aGVyZSBjdXJyZW50bHkgaXMgYSB3aWRnZXQgd2hpY2ggd2Ugc3RpbGwgb3duIHNvXG5cdFx0Ly8gd2UgbmVlZCB0byBoaWRlIGl0IGJlZm9yZSBnZXR0aW5nIGEgbmV3IHdpZGdldFxuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy5vbldpbGxIaWRlKCk7XG5cblx0XHR0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0Py5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblxuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0ID0gPElCb3Jyb3dWYWx1ZTxOb3RlYm9va0VkaXRvcldpZGdldD4+dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24odGhpcy5fbm90ZWJvb2tXaWRnZXRTZXJ2aWNlLnJldHJpZXZlV2lkZ2V0LCB0aGlzLmdyb3VwLmlkLCBpbnB1dCwge1xuXHRcdFx0aXNSZXBsSGlzdG9yeTogdHJ1ZSxcblx0XHRcdGlzUmVhZE9ubHk6IHRydWUsXG5cdFx0XHRjb250cmlidXRpb25zOiBOb3RlYm9va0VkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRTb21lRWRpdG9yQ29udHJpYnV0aW9ucyhbXG5cdFx0XHRcdEV4ZWN1dGlvblN0YXRlQ2VsbFN0YXR1c0JhckNvbnRyaWIuaWQsXG5cdFx0XHRcdFRpbWVyQ2VsbFN0YXR1c0JhckNvbnRyaWIuaWQsXG5cdFx0XHRcdE5vdGVib29rRmluZENvbnRyaWIuaWRcblx0XHRcdF0pLFxuXHRcdFx0bWVudUlkczoge1xuXHRcdFx0XHRub3RlYm9va1Rvb2xiYXI6IE1lbnVJZC5JbnRlcmFjdGl2ZVRvb2xiYXIsXG5cdFx0XHRcdGNlbGxUaXRsZVRvb2xiYXI6IE1lbnVJZC5JbnRlcmFjdGl2ZUNlbGxUaXRsZSxcblx0XHRcdFx0Y2VsbERlbGV0ZVRvb2xiYXI6IE1lbnVJZC5JbnRlcmFjdGl2ZUNlbGxEZWxldGUsXG5cdFx0XHRcdGNlbGxJbnNlcnRUb29sYmFyOiBNZW51SWQuTm90ZWJvb2tDZWxsQmV0d2Vlbixcblx0XHRcdFx0Y2VsbFRvcEluc2VydFRvb2xiYXI6IE1lbnVJZC5Ob3RlYm9va0NlbGxMaXN0VG9wLFxuXHRcdFx0XHRjZWxsRXhlY3V0ZVRvb2xiYXI6IE1lbnVJZC5JbnRlcmFjdGl2ZUNlbGxFeGVjdXRlLFxuXHRcdFx0XHRjZWxsRXhlY3V0ZVByaW1hcnk6IHVuZGVmaW5lZFxuXHRcdFx0fSxcblx0XHRcdGNlbGxFZGl0b3JDb250cmlidXRpb25zOiBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0U29tZUVkaXRvckNvbnRyaWJ1dGlvbnMoW1xuXHRcdFx0XHRTZWxlY3Rpb25DbGlwYm9hcmRDb250cmlidXRpb25JRCxcblx0XHRcdFx0Q29udGV4dE1lbnVDb250cm9sbGVyLklELFxuXHRcdFx0XHRDb250ZW50SG92ZXJDb250cm9sbGVyLklELFxuXHRcdFx0XHRHbHlwaEhvdmVyQ29udHJvbGxlci5JRCxcblx0XHRcdFx0TWFya2VyQ29udHJvbGxlci5JRFxuXHRcdFx0XSksXG5cdFx0XHRvcHRpb25zOiB0aGlzLl9ub3RlYm9va09wdGlvbnMsXG5cdFx0XHRjb2RlV2luZG93OiB0aGlzLndpbmRvd1xuXHRcdH0sIHVuZGVmaW5lZCwgdGhpcy53aW5kb3cpO1xuXG5cdFx0Y29uc3Qgc2tpcENvbnRyaWJ1dGlvbnMgPSBbXG5cdFx0XHQnd29ya2JlbmNoLm5vdGVib29rLmNlbGxUb29sYmFyJyxcblx0XHRcdCdlZGl0b3IuY29udHJpYi5pbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXInXG5cdFx0XTtcblxuXHRcdGNvbnN0IGlucHV0Q29udHJpYnV0aW9ucyA9IGdldERlZmF1bHROb3RlYm9va0NyZWF0aW9uT3B0aW9ucygpLmNlbGxFZGl0b3JDb250cmlidXRpb25zPy5maWx0ZXIoYyA9PiBza2lwQ29udHJpYnV0aW9ucy5pbmRleE9mKGMuaWQpID09PSAtMSk7XG5cdFx0dGhpcy5fY29kZUVkaXRvcldpZGdldCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIHRoaXMuX2lucHV0RWRpdG9yQ29udGFpbmVyLCB0aGlzLl9lZGl0b3JPcHRpb25zLCB7XG5cdFx0XHQuLi57XG5cdFx0XHRcdGlzU2ltcGxlV2lkZ2V0OiBmYWxzZSxcblx0XHRcdFx0Y29udHJpYnV0aW9uczogaW5wdXRDb250cmlidXRpb25zLFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zKSB7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5kaW1lbnNpb24uaGVpZ2h0IC0gdGhpcy5pbnB1dENlbGxDb250YWluZXJIZWlnaHR9cHhgO1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLmxheW91dChuZXcgRE9NLkRpbWVuc2lvbih0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5kaW1lbnNpb24ud2lkdGgsIHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zLmRpbWVuc2lvbi5oZWlnaHQgLSB0aGlzLmlucHV0Q2VsbENvbnRhaW5lckhlaWdodCksIHRoaXMuX25vdGVib29rRWRpdG9yQ29udGFpbmVyKTtcblx0XHRcdGNvbnN0IGxlZnRNYXJnaW4gPSB0aGlzLl9ub3RlYm9va09wdGlvbnMuZ2V0Q2VsbEVkaXRvckNvbnRhaW5lckxlZnRNYXJnaW4oKTtcblx0XHRcdGNvbnN0IG1heEhlaWdodCA9IE1hdGgubWluKHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zLmRpbWVuc2lvbi5oZWlnaHQgLyAyLCB0aGlzLmlucHV0Q2VsbEVkaXRvckhlaWdodCk7XG5cdFx0XHR0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0LmxheW91dCh0aGlzLl92YWxpZGF0ZURpbWVuc2lvbih0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5kaW1lbnNpb24ud2lkdGggLSBsZWZ0TWFyZ2luIC0gSU5QVVRfQ0VMTF9IT1JJWk9OVEFMX1BBRERJTkdfUklHSFQsIG1heEhlaWdodCkpO1xuXHRcdFx0dGhpcy5faW5wdXRGb2N1c0luZGljYXRvci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmlucHV0Q2VsbEVkaXRvckhlaWdodH1weGA7XG5cdFx0XHR0aGlzLl9pbnB1dENlbGxDb250YWluZXIuc3R5bGUudG9wID0gYCR7dGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMuZGltZW5zaW9uLmhlaWdodCAtIHRoaXMuaW5wdXRDZWxsQ29udGFpbmVySGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMuX2lucHV0Q2VsbENvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAke3RoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zLmRpbWVuc2lvbi53aWR0aH1weGA7XG5cdFx0fVxuXG5cdFx0YXdhaXQgc3VwZXIuc2V0SW5wdXQoaW5wdXQsIG9wdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IGlucHV0LnJlc29sdmUoKTtcblx0XHRpZiAodGhpcy5fcnVuYnV0dG9uVG9vbGJhcikge1xuXHRcdFx0dGhpcy5fcnVuYnV0dG9uVG9vbGJhci5jb250ZXh0ID0gaW5wdXQucmVzb3VyY2U7XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsID09PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBSRVBMIG1vZGVsIGNvdWxkIG5vdCBiZSByZXNvbHZlZCcpO1xuXHRcdH1cblxuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy5zZXRQYXJlbnRDb250ZXh0S2V5U2VydmljZSh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCB2aWV3U3RhdGUgPSBvcHRpb25zPy52aWV3U3RhdGUgPz8gdGhpcy5fbG9hZE5vdGVib29rRWRpdG9yVmlld1N0YXRlKGlucHV0KTtcblx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGF3YWl0IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlIS5zZXRNb2RlbChtb2RlbC5ub3RlYm9vaywgdmlld1N0YXRlPy5ub3RlYm9vaywgdW5kZWZpbmVkLCAncmVwbCcpO1xuXHRcdG1vZGVsLm5vdGVib29rLnNldENlbGxDb2xsYXBzZURlZmF1bHQodGhpcy5fbm90ZWJvb2tPcHRpb25zLmdldENlbGxDb2xsYXBzZURlZmF1bHQoKSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLnNldE9wdGlvbnMoe1xuXHRcdFx0aXNSZWFkT25seTogdHJ1ZVxuXHRcdH0pO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLm9uRGlkUmVzaXplT3V0cHV0KChjdm0pID0+IHtcblx0XHRcdHRoaXMuX3Njcm9sbElmTmVjZXNzYXJ5KGN2bSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLm9uRGlkRm9jdXNXaWRnZXQoKCkgPT4gdGhpcy5fb25EaWRGb2N1c1dpZGdldC5maXJlKCkpKTtcblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX25vdGVib29rT3B0aW9ucy5vbkRpZENoYW5nZU9wdGlvbnMoZSA9PiB7XG5cdFx0XHRpZiAoZS5jb21wYWN0VmlldyB8fCBlLmZvY3VzSW5kaWNhdG9yKSB7XG5cdFx0XHRcdC8vIHVwZGF0ZSB0aGUgc3R5bGluZ1xuXHRcdFx0XHR0aGlzLl9zdHlsZUVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVMYXlvdXRTdHlsZXMoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zICYmIHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMuZGltZW5zaW9uLCB0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5wb3NpdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMpIHtcblx0XHRcdFx0bW9kZWwubm90ZWJvb2suc2V0Q2VsbENvbGxhcHNlRGVmYXVsdCh0aGlzLl9ub3RlYm9va09wdGlvbnMuZ2V0Q2VsbENvbGxhcHNlRGVmYXVsdCgpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IGF3YWl0IGlucHV0LnJlc29sdmVJbnB1dChtb2RlbC5ub3RlYm9vayk7XG5cdFx0dGhpcy5fY29kZUVkaXRvcldpZGdldC5zZXRNb2RlbChlZGl0b3JNb2RlbCk7XG5cdFx0aWYgKHZpZXdTdGF0ZT8uaW5wdXQpIHtcblx0XHRcdHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQucmVzdG9yZVZpZXdTdGF0ZSh2aWV3U3RhdGUuaW5wdXQpO1xuXHRcdH1cblx0XHR0aGlzLl9lZGl0b3JPcHRpb25zID0gdGhpcy5fY29tcHV0ZUVkaXRvck9wdGlvbnMoKTtcblx0XHR0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0LnVwZGF0ZU9wdGlvbnModGhpcy5fZWRpdG9yT3B0aW9ucyk7XG5cblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB0aGlzLl9vbkRpZEZvY3VzV2lkZ2V0LmZpcmUoKSkpO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fY29kZUVkaXRvcldpZGdldC5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKCFlLmNvbnRlbnRIZWlnaHRDaGFuZ2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zKSB7XG5cdFx0XHRcdHRoaXMuX2xheW91dFdpZGdldHModGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMuZGltZW5zaW9uLCB0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5wb3NpdGlvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fd2lkZ2V0RGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0Lm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oZSA9PiB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKHsgcmVhc29uOiB0aGlzLl90b0VkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24oZSkgfSkpKTtcblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZmlyZSh7IHJlYXNvbjogRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5FRElUIH0pKSk7XG5cblxuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlTm90ZWJvb2tBZmZpbml0eSh0aGlzLl9zeW5jV2l0aEtlcm5lbCwgdGhpcykpO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlU2VsZWN0ZWROb3RlYm9va3ModGhpcy5fc3luY1dpdGhLZXJuZWwsIHRoaXMpKTtcblxuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy50aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUlucHV0SGludCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fY29kZUVkaXRvcldpZGdldC5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVJbnB1dEhpbnQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0Lm9uRGlkQ2hhbmdlTW9kZWxEZWNvcmF0aW9ucygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVJbnB1dEhpbnQoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGN1cnNvckF0Qm91bmRhcnlDb250ZXh0ID0gSU5URVJBQ1RJVkVfSU5QVVRfQ1VSU09SX0JPVU5EQVJZLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aWYgKGlucHV0LnJlc291cmNlICYmIGlucHV0Lmhpc3RvcnlTZXJ2aWNlLmhhcyhpbnB1dC5yZXNvdXJjZSkpIHtcblx0XHRcdGN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgndG9wJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgnbm9uZScpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fY29kZUVkaXRvcldpZGdldC5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCh7IHBvc2l0aW9uIH0pID0+IHtcblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuX2dldFZpZXdNb2RlbCgpITtcblx0XHRcdGNvbnN0IGxhc3RMaW5lTnVtYmVyID0gdmlld01vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0Y29uc3QgbGFzdExpbmVDb2wgPSB2aWV3TW9kZWwuZ2V0TGluZUxlbmd0aChsYXN0TGluZU51bWJlcikgKyAxO1xuXHRcdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gdmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0Y29uc3QgZmlyc3RMaW5lID0gdmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IDEgJiYgdmlld1Bvc2l0aW9uLmNvbHVtbiA9PT0gMTtcblx0XHRcdGNvbnN0IGxhc3RMaW5lID0gdmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IGxhc3RMaW5lTnVtYmVyICYmIHZpZXdQb3NpdGlvbi5jb2x1bW4gPT09IGxhc3RMaW5lQ29sO1xuXG5cdFx0XHRpZiAoZmlyc3RMaW5lKSB7XG5cdFx0XHRcdGlmIChsYXN0TGluZSkge1xuXHRcdFx0XHRcdGN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgnYm90aCcpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgndG9wJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChsYXN0TGluZSkge1xuXHRcdFx0XHRcdGN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgnYm90dG9tJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y3Vyc29yQXRCb3VuZGFyeUNvbnRleHQuc2V0KCdub25lJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKGVkaXRvck1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGVkaXRvck1vZGVsLmdldFZhbHVlKCk7XG5cdFx0XHRpZiAodGhpcy5pbnB1dD8ucmVzb3VyY2UgJiYgdmFsdWUgIT09ICcnKSB7XG5cdFx0XHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gKHRoaXMuaW5wdXQgYXMgUmVwbEVkaXRvcklucHV0KS5oaXN0b3J5U2VydmljZTtcblx0XHRcdFx0aWYgKCFoaXN0b3J5U2VydmljZS5tYXRjaGVzQ3VycmVudCh0aGlzLmlucHV0LnJlc291cmNlLCB2YWx1ZSkpIHtcblx0XHRcdFx0XHRoaXN0b3J5U2VydmljZS5yZXBsYWNlTGFzdCh0aGlzLmlucHV0LnJlc291cmNlLCB2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlIS5vbkRpZFNjcm9sbCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZVNjcm9sbC5maXJlKCkpKTtcblxuXG5cdFx0dGhpcy5fd2lkZ2V0RGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZSEub25EaWRDaGFuZ2VWaWV3Q2VsbHModGhpcy5oYW5kbGVWaWV3Q2VsbENoYW5nZSwgdGhpcykpO1xuXG5cdFx0dGhpcy5fdXBkYXRlSW5wdXRIaW50KCk7XG5cdFx0dGhpcy5fc3luY1dpdGhLZXJuZWwoKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlVmlld0NlbGxDaGFuZ2UoZTogSU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQpIHtcblx0XHRjb25zdCBub3RlYm9va1dpZGdldCA9IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlO1xuXHRcdGlmICghbm90ZWJvb2tXaWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHNwbGljZSBvZiBlLnNwbGljZXMpIHtcblx0XHRcdGNvbnN0IFtfc3RhcnQsIF9kZWxldGUsIGFkZGVkQ2VsbHNdID0gc3BsaWNlO1xuXHRcdFx0aWYgKGFkZGVkQ2VsbHMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IG5vdGVib29rV2lkZ2V0LnZpZXdNb2RlbDtcblx0XHRcdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0XHRcdHRoaXMuaGFuZGxlQXBwZW5kKG5vdGVib29rV2lkZ2V0LCB2aWV3TW9kZWwpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVBcHBlbmQobm90ZWJvb2tXaWRnZXQ6IE5vdGVib29rRWRpdG9yV2lkZ2V0LCB2aWV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXRTZXJ2aWNlLnVwZGF0ZVJlcGxDb250ZXh0S2V5KHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50LnVyaS50b1N0cmluZygpKTtcblx0XHRjb25zdCBuYXZpZ2F0ZVRvQ2VsbCA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdhY2Nlc3NpYmlsaXR5LnJlcGxFZGl0b3IuYXV0b0ZvY3VzUmVwbEV4ZWN1dGlvbicpO1xuXHRcdGlmICh0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHRpZiAobmF2aWdhdGVUb0NlbGwgPT09ICdsYXN0RXhlY3V0aW9uJykge1xuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBsYXN0Q2VsbEluZGV4ID0gdmlld01vZGVsLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0aWYgKGxhc3RDZWxsSW5kZXggPj0gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHZpZXdNb2RlbC52aWV3Q2VsbHNbbGFzdENlbGxJbmRleF07XG5cdFx0XHRcdFx0XHRub3RlYm9va1dpZGdldC5mb2N1c05vdGVib29rQ2VsbChjZWxsLCAnY29udGFpbmVyJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwKTtcblx0XHRcdH0gZWxzZSBpZiAobmF2aWdhdGVUb0NlbGwgPT09ICdpbnB1dCcpIHtcblx0XHRcdFx0dGhpcy5fY29kZUVkaXRvcldpZGdldC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHNldE9wdGlvbnMob3B0aW9uczogSU5vdGVib29rRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy5zZXRPcHRpb25zKG9wdGlvbnMpO1xuXHRcdHN1cGVyLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF90b0VkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24oZTogSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50KTogRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbiB7XG5cdFx0c3dpdGNoIChlLnNvdXJjZSkge1xuXHRcdFx0Y2FzZSBUZXh0RWRpdG9yU2VsZWN0aW9uU291cmNlLlBST0dSQU1NQVRJQzogcmV0dXJuIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uUFJPR1JBTU1BVElDO1xuXHRcdFx0Y2FzZSBUZXh0RWRpdG9yU2VsZWN0aW9uU291cmNlLk5BVklHQVRJT046IHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLk5BVklHQVRJT047XG5cdFx0XHRjYXNlIFRleHRFZGl0b3JTZWxlY3Rpb25Tb3VyY2UuSlVNUDogcmV0dXJuIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uSlVNUDtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLlVTRVI7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2VsbEF0Qm90dG9tKGNlbGw6IElDZWxsVmlld01vZGVsKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy52aXNpYmxlUmFuZ2VzIHx8IFtdO1xuXHRcdGNvbnN0IGNlbGxJbmRleCA9IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy5nZXRDZWxsSW5kZXgoY2VsbCk7XG5cdFx0aWYgKGNlbGxJbmRleCA9PT0gTWF0aC5tYXgoLi4udmlzaWJsZVJhbmdlcy5tYXAocmFuZ2UgPT4gcmFuZ2UuZW5kIC0gMSkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2Nyb2xsSWZOZWNlc3NhcnkoY3ZtOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLmdldENlbGxJbmRleChjdm0pO1xuXHRcdGlmIChpbmRleCA9PT0gdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUhLmdldExlbmd0aCgpIC0gMSkge1xuXHRcdFx0Ly8gSWYgd2UncmUgYWxyZWFkeSBhdCB0aGUgYm90dG9tIG9yIGF1dG8gc2Nyb2xsIGlzIGVuYWJsZWQsIHNjcm9sbCB0byB0aGUgYm90dG9tXG5cdFx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oUmVwbEVkaXRvclNldHRpbmdzLmludGVyYWN0aXZlV2luZG93QWx3YXlzU2Nyb2xsT25OZXdDZWxsKSB8fCB0aGlzLl9jZWxsQXRCb3R0b20oY3ZtKSkge1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZSEuc2Nyb2xsVG9Cb3R0b20oKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zeW5jV2l0aEtlcm5lbCgpIHtcblx0XHRjb25zdCBub3RlYm9vayA9IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy50ZXh0TW9kZWw7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fY29kZUVkaXRvcldpZGdldC5nZXRNb2RlbCgpO1xuXG5cdFx0aWYgKG5vdGVib29rICYmIHRleHRNb2RlbCkge1xuXHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbChub3RlYm9vayk7XG5cdFx0XHRjb25zdCBzZWxlY3RlZE9yU3VnZ2VzdGVkID0gaW5mby5zZWxlY3RlZFxuXHRcdFx0XHQ/PyAoaW5mby5zdWdnZXN0aW9ucy5sZW5ndGggPT09IDEgPyBpbmZvLnN1Z2dlc3Rpb25zWzBdIDogdW5kZWZpbmVkKVxuXHRcdFx0XHQ/PyAoaW5mby5hbGwubGVuZ3RoID09PSAxID8gaW5mby5hbGxbMF0gOiB1bmRlZmluZWQpO1xuXG5cdFx0XHRpZiAoc2VsZWN0ZWRPclN1Z2dlc3RlZCkge1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZSA9IHNlbGVjdGVkT3JTdWdnZXN0ZWQuc3VwcG9ydGVkTGFuZ3VhZ2VzWzBdO1xuXHRcdFx0XHQvLyBBbGwga2VybmVscyB3aWxsIGluaXRpYWxseSBsaXN0IHBsYWludGV4dCBhcyB0aGUgc3VwcG9ydGVkIGxhbmd1YWdlIGJlZm9yZSB0aGV5IHByb3Blcmx5IGluaXRpYWxpemVkLlxuXHRcdFx0XHRpZiAobGFuZ3VhZ2UgJiYgbGFuZ3VhZ2UgIT09ICdwbGFpbnRleHQnKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV3TW9kZSA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKGxhbmd1YWdlKS5sYW5ndWFnZUlkO1xuXHRcdFx0XHRcdHRleHRNb2RlbC5zZXRMYW5ndWFnZShuZXdNb2RlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdE5PVEVCT09LX0tFUk5FTC5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpLnNldChzZWxlY3RlZE9yU3VnZ2VzdGVkLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBET00uRGltZW5zaW9uLCBwb3NpdGlvbjogRE9NLklEb21Qb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3RFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ21pZC13aWR0aCcsIGRpbWVuc2lvbi53aWR0aCA8IDEwMDAgJiYgZGltZW5zaW9uLndpZHRoID49IDYwMCk7XG5cdFx0dGhpcy5fcm9vdEVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbmFycm93LXdpZHRoJywgZGltZW5zaW9uLndpZHRoIDwgNjAwKTtcblx0XHRjb25zdCBlZGl0b3JIZWlnaHRDaGFuZ2VkID0gZGltZW5zaW9uLmhlaWdodCAhPT0gdGhpcy5fbGFzdExheW91dERpbWVuc2lvbnM/LmRpbWVuc2lvbi5oZWlnaHQ7XG5cdFx0dGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMgPSB7IGRpbWVuc2lvbiwgcG9zaXRpb24gfTtcblxuXHRcdGlmICghdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9ySGVpZ2h0Q2hhbmdlZCAmJiB0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0KSB7XG5cdFx0XHRTdWdnZXN0Q29udHJvbGxlci5nZXQodGhpcy5fY29kZUVkaXRvcldpZGdldCk/LmNhbmNlbFN1Z2dlc3RXaWRnZXQoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLl9sYXN0TGF5b3V0RGltZW5zaW9ucy5kaW1lbnNpb24uaGVpZ2h0IC0gdGhpcy5pbnB1dENlbGxDb250YWluZXJIZWlnaHR9cHhgO1xuXHRcdHRoaXMuX2xheW91dFdpZGdldHMoZGltZW5zaW9uLCBwb3NpdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIF9sYXlvdXRXaWRnZXRzKGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbiwgcG9zaXRpb246IERPTS5JRG9tUG9zaXRpb24pIHtcblx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGhpcy5fY29kZUVkaXRvcldpZGdldC5oYXNNb2RlbCgpID8gdGhpcy5fY29kZUVkaXRvcldpZGdldC5nZXRDb250ZW50SGVpZ2h0KCkgOiB0aGlzLmlucHV0Q2VsbEVkaXRvckhlaWdodDtcblx0XHRjb25zdCBtYXhIZWlnaHQgPSBNYXRoLm1pbihkaW1lbnNpb24uaGVpZ2h0IC8gMiwgY29udGVudEhlaWdodCk7XG5cdFx0Y29uc3QgbGVmdE1hcmdpbiA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5nZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbigpO1xuXG5cdFx0Y29uc3QgaW5wdXRDZWxsQ29udGFpbmVySGVpZ2h0ID0gbWF4SGVpZ2h0ICsgSU5QVVRfQ0VMTF9WRVJUSUNBTF9QQURESU5HICogMjtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtkaW1lbnNpb24uaGVpZ2h0IC0gaW5wdXRDZWxsQ29udGFpbmVySGVpZ2h0fXB4YDtcblxuXHRcdHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlIS5sYXlvdXQoZGltZW5zaW9uLndpdGgoZGltZW5zaW9uLndpZHRoLCBkaW1lbnNpb24uaGVpZ2h0IC0gaW5wdXRDZWxsQ29udGFpbmVySGVpZ2h0KSwgdGhpcy5fbm90ZWJvb2tFZGl0b3JDb250YWluZXIsIHBvc2l0aW9uKTtcblx0XHR0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0LmxheW91dCh0aGlzLl92YWxpZGF0ZURpbWVuc2lvbihkaW1lbnNpb24ud2lkdGggLSBsZWZ0TWFyZ2luIC0gSU5QVVRfQ0VMTF9IT1JJWk9OVEFMX1BBRERJTkdfUklHSFQsIG1heEhlaWdodCkpO1xuXHRcdHRoaXMuX2lucHV0Rm9jdXNJbmRpY2F0b3Iuc3R5bGUuaGVpZ2h0ID0gYCR7Y29udGVudEhlaWdodH1weGA7XG5cdFx0dGhpcy5faW5wdXRDZWxsQ29udGFpbmVyLnN0eWxlLnRvcCA9IGAke2RpbWVuc2lvbi5oZWlnaHQgLSBpbnB1dENlbGxDb250YWluZXJIZWlnaHR9cHhgO1xuXHRcdHRoaXMuX2lucHV0Q2VsbENvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAke2RpbWVuc2lvbi53aWR0aH1weGA7XG5cdH1cblxuXHRwcml2YXRlIF92YWxpZGF0ZURpbWVuc2lvbih3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuXHRcdHJldHVybiBuZXcgRE9NLkRpbWVuc2lvbihNYXRoLm1heCgwLCB3aWR0aCksIE1hdGgubWF4KDAsIGhlaWdodCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFzQ29uZmxpY3RpbmdEZWNvcmF0aW9uKCkge1xuXHRcdHJldHVybiBCb29sZWFuKHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuZ2V0TGluZURlY29yYXRpb25zKDEpPy5maW5kKChkKSA9PlxuXHRcdFx0ZC5vcHRpb25zLmJlZm9yZUNvbnRlbnRDbGFzc05hbWVcblx0XHRcdHx8IGQub3B0aW9ucy5hZnRlckNvbnRlbnRDbGFzc05hbWVcblx0XHRcdHx8IGQub3B0aW9ucy5iZWZvcmU/LmNvbnRlbnRcblx0XHRcdHx8IGQub3B0aW9ucy5hZnRlcj8uY29udGVudFxuXHRcdCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlSW5wdXRIaW50KCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fY29kZUVkaXRvcldpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNob3VsZEhpZGUgPVxuXHRcdFx0IXRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuaGFzTW9kZWwoKSB8fFxuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oUmVwbEVkaXRvclNldHRpbmdzLnNob3dFeGVjdXRpb25IaW50KSA9PT0gZmFsc2UgfHxcblx0XHRcdHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuZ2V0TW9kZWwoKSEuZ2V0VmFsdWVMZW5ndGgoKSAhPT0gMCB8fFxuXHRcdFx0dGhpcy5faGFzQ29uZmxpY3RpbmdEZWNvcmF0aW9uKCk7XG5cblx0XHRpZiAoIXRoaXMuX2hpbnRFbGVtZW50ICYmICFzaG91bGRIaWRlKSB7XG5cdFx0XHR0aGlzLl9oaW50RWxlbWVudCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxJbnB1dEhpbnRDb250ZW50V2lkZ2V0LCB0aGlzLl9jb2RlRWRpdG9yV2lkZ2V0KTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2hpbnRFbGVtZW50ICYmIHNob3VsZEhpZGUpIHtcblx0XHRcdHRoaXMuX2hpbnRFbGVtZW50LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX2hpbnRFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGdldFNjcm9sbFBvc2l0aW9uKCk6IElFZGl0b3JQYW5lU2Nyb2xsUG9zaXRpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzY3JvbGxUb3A6IHRoaXMuX25vdGVib29rV2lkZ2V0LnZhbHVlPy5zY3JvbGxUb3AgPz8gMCxcblx0XHRcdHNjcm9sbExlZnQ6IDBcblx0XHR9O1xuXHR9XG5cblx0c2V0U2Nyb2xsUG9zaXRpb24ocG9zaXRpb246IElFZGl0b3JQYW5lU2Nyb2xsUG9zaXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZT8uc2V0U2Nyb2xsVG9wKHBvc2l0aW9uLnNjcm9sbFRvcCk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXG5cdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWU/Lm9uU2hvdygpO1xuXHRcdHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuZm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzSGlzdG9yeSgpIHtcblx0XHR0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZSEuZm9jdXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzZXRFZGl0b3JWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5zZXRFZGl0b3JWaXNpYmxlKHZpc2libGUpO1xuXHRcdHRoaXMuX2dyb3VwTGlzdGVuZXIudmFsdWUgPSB0aGlzLmdyb3VwLm9uV2lsbENsb3NlRWRpdG9yKGUgPT4gdGhpcy5fc2F2ZUVkaXRvclZpZXdTdGF0ZShlLmVkaXRvcikpO1xuXG5cdFx0aWYgKCF2aXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9zYXZlRWRpdG9yVmlld1N0YXRlKHRoaXMuaW5wdXQpO1xuXHRcdFx0aWYgKHRoaXMuaW5wdXQgJiYgdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUpIHtcblx0XHRcdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUub25XaWxsSGlkZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3VwZGF0ZUlucHV0SGludCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgY2xlYXJJbnB1dCgpIHtcblx0XHRpZiAodGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWUpIHtcblx0XHRcdHRoaXMuX3NhdmVFZGl0b3JWaWV3U3RhdGUodGhpcy5pbnB1dCk7XG5cdFx0XHR0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZS5vbldpbGxIaWRlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29kZUVkaXRvcldpZGdldD8uZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fbm90ZWJvb2tXaWRnZXQgPSB7IHZhbHVlOiB1bmRlZmluZWQgfTtcblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblxuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldENvbnRyb2woKTogUmVwbEVkaXRvckNvbnRyb2wgJiBJQ29tcG9zaXRlQ29kZUVkaXRvciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5vdGVib29rRWRpdG9yOiB0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZSxcblx0XHRcdGFjdGl2ZUNvZGVFZGl0b3I6IHRoaXMuZ2V0QWN0aXZlQ29kZUVkaXRvcigpLFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVFZGl0b3I6IEV2ZW50Lk5vbmVcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBY3RpdmVDb2RlRWRpdG9yKCkge1xuXHRcdGlmICghdGhpcy5fY29kZUVkaXRvcldpZGdldCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvZGVFZGl0b3JXaWRnZXQuaGFzV2lkZ2V0Rm9jdXMoKSB8fCAhdGhpcy5fbm90ZWJvb2tXaWRnZXQudmFsdWU/LmFjdGl2ZUNvZGVFZGl0b3IgP1xuXHRcdFx0dGhpcy5fY29kZUVkaXRvcldpZGdldCA6XG5cdFx0XHR0aGlzLl9ub3RlYm9va1dpZGdldC52YWx1ZS5hY3RpdmVDb2RlRWRpdG9yO1xuXHR9XG59XG5cbmV4cG9ydCB0eXBlIFJlcGxFZGl0b3JDb250cm9sID0geyBhY3RpdmVDb2RlRWRpdG9yOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZDsgbm90ZWJvb2tFZGl0b3I6IE5vdGVib29rRWRpdG9yV2lkZ2V0IHwgdW5kZWZpbmVkIH07XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1JlcGxFZGl0b3JDb250cm9sKGNvbnRyb2w6IHVua25vd24pOiBjb250cm9sIGlzIFJlcGxFZGl0b3JDb250cm9sIHtcblx0Y29uc3QgY2FuZGlkYXRlID0gY29udHJvbCBhcyBSZXBsRWRpdG9yQ29udHJvbDtcblx0cmV0dXJuIGNhbmRpZGF0ZT8uYWN0aXZlQ29kZUVkaXRvciBpbnN0YW5jZW9mIENvZGVFZGl0b3JXaWRnZXQgJiYgY2FuZGlkYXRlPy5ub3RlYm9va0VkaXRvciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9yV2lkZ2V0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFlBQVksb0JBQW9CO0FBRWhDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsaUJBQWlCLHlCQUF5QjtBQUNuRCxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHVDQUFpSztBQUMxSyxTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLHdDQUF3QztBQUNqRCxTQUF1Qiw4QkFBOEI7QUFDckQsU0FBUyxtQ0FB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
