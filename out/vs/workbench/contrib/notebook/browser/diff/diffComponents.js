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
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { getFormattedOutputJSON, OutputComparison, outputEqual, OUTPUT_EDITOR_HEIGHT_MAGIC, PropertyFoldingState, SideBySideDiffElementViewModel, NotebookDocumentMetadataViewModel } from "./diffElementViewModel.js";
import { DiffSide, DIFF_CELL_MARGIN, NOTEBOOK_DIFF_CELL_INPUT, NOTEBOOK_DIFF_CELL_PROPERTY, NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED, NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE, NOTEBOOK_DIFF_METADATA } from "./notebookDiffEditorBrowser.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { CellEditType, CellUri } from "../../common/notebookCommon.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { getFlatActionBarActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { CodiconActionViewItem } from "../view/cellParts/cellActionView.js";
import { collapsedIcon, expandedIcon } from "../notebookIcons.js";
import { OutputContainer } from "./diffElementOutputs.js";
import { EditorExtensionsRegistry } from "../../../../../editor/browser/editorExtensions.js";
import { ContextMenuController } from "../../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SuggestController } from "../../../../../editor/contrib/suggest/browser/suggestController.js";
import { MenuPreventer } from "../../../codeEditor/browser/menuPreventer.js";
import { SelectionClipboardContributionID } from "../../../codeEditor/browser/selectionClipboard.js";
import { TabCompletionController } from "../../../snippets/browser/tabCompletion.js";
import { renderIcon, renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { WorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { fixedDiffEditorOptions, fixedEditorOptions, getEditorPadding } from "./diffCellEditorOptions.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { DiffEditorWidget } from "../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { localize } from "../../../../../nls.js";
import { Emitter } from "../../../../../base/common/event.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { getFormattedMetadataJSON } from "../../common/model/notebookCellTextModel.js";
import { getUnchangedRegionSettings } from "./unchangedEditorRegions.js";
function getOptimizedNestedCodeEditorWidgetOptions() {
  return {
    isSimpleWidget: false,
    contributions: EditorExtensionsRegistry.getSomeEditorContributions([
      MenuPreventer.ID,
      SelectionClipboardContributionID,
      ContextMenuController.ID,
      SuggestController.ID,
      SnippetController2.ID,
      TabCompletionController.ID
    ])
  };
}
class CellDiffPlaceholderElement extends Disposable {
  constructor(placeholder, templateData) {
    super();
    templateData.body.classList.remove("left", "right", "full");
    const text = placeholder.hiddenCells.length === 1 ? localize("hiddenCell", "{0} hidden cell", placeholder.hiddenCells.length) : localize("hiddenCells", "{0} hidden cells", placeholder.hiddenCells.length);
    templateData.placeholder.innerText = text;
    this._register(DOM.addDisposableListener(templateData.placeholder, "dblclick", (e) => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault();
      placeholder.showHiddenCells();
    }));
    this._register(templateData.marginOverlay.onAction(() => placeholder.showHiddenCells()));
    templateData.marginOverlay.show();
  }
}
let PropertyHeader = class extends Disposable {
  constructor(cell, propertyHeaderContainer, notebookEditor, accessor, contextMenuService, keybindingService, commandService, notificationService, menuService, contextKeyService, themeService, telemetryService, accessibilityService) {
    super();
    this.cell = cell;
    this.propertyHeaderContainer = propertyHeaderContainer;
    this.notebookEditor = notebookEditor;
    this.accessor = accessor;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.commandService = commandService;
    this.notificationService = notificationService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.themeService = themeService;
    this.telemetryService = telemetryService;
    this.accessibilityService = accessibilityService;
  }
  buildHeader() {
    this._foldingIndicator = DOM.append(this.propertyHeaderContainer, DOM.$(".property-folding-indicator"));
    this._foldingIndicator.classList.add(this.accessor.prefix);
    const metadataStatus = DOM.append(this.propertyHeaderContainer, DOM.$("div.property-status"));
    this._statusSpan = DOM.append(metadataStatus, DOM.$("span"));
    this._description = DOM.append(metadataStatus, DOM.$("span.property-description"));
    const cellToolbarContainer = DOM.append(this.propertyHeaderContainer, DOM.$("div.property-toolbar"));
    this._toolbar = this._register(new WorkbenchToolBar(cellToolbarContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction) {
          const item = new CodiconActionViewItem(action, { hoverDelegate: options.hoverDelegate }, this.keybindingService, this.notificationService, this.contextKeyService, this.themeService, this.contextMenuService, this.accessibilityService);
          return item;
        }
        return void 0;
      }
    }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService));
    this._toolbar.context = this.cell;
    const scopedContextKeyService = this.contextKeyService.createScoped(cellToolbarContainer);
    this._register(scopedContextKeyService);
    this._propertyChanged = NOTEBOOK_DIFF_CELL_PROPERTY.bindTo(scopedContextKeyService);
    this._propertyExpanded = NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED.bindTo(scopedContextKeyService);
    this._menu = this._register(this.menuService.createMenu(this.accessor.menuId, scopedContextKeyService));
    this._register(this._menu.onDidChange(() => this.updateMenu()));
    this._register(this.notebookEditor.onMouseUp((e) => {
      if (!e.event.target || e.target !== this.cell) {
        return;
      }
      const target = e.event.target;
      if (target === this.propertyHeaderContainer || target === this._foldingIndicator || this._foldingIndicator.contains(target) || target === metadataStatus || metadataStatus.contains(target)) {
        const oldFoldingState = this.accessor.getFoldingState();
        this.accessor.updateFoldingState(oldFoldingState === PropertyFoldingState.Expanded ? PropertyFoldingState.Collapsed : PropertyFoldingState.Expanded);
        this._updateFoldingIcon();
        this.accessor.updateInfoRendering(this.cell.renderOutput);
      }
    }));
    this.refresh();
    this.accessor.updateInfoRendering(this.cell.renderOutput);
  }
  refresh() {
    this.updateMenu();
    this._updateFoldingIcon();
    const metadataChanged = this.accessor.checkIfModified();
    if (this._propertyChanged) {
      this._propertyChanged.set(!!metadataChanged);
    }
    if (metadataChanged) {
      this._statusSpan.textContent = this.accessor.changedLabel;
      this._statusSpan.style.fontWeight = "bold";
      if (metadataChanged.reason) {
        this._description.textContent = metadataChanged.reason;
      }
      this.propertyHeaderContainer.classList.add("modified");
    } else {
      this._statusSpan.textContent = this.accessor.unChangedLabel;
      this._statusSpan.style.fontWeight = "normal";
      this._description.textContent = "";
      this.propertyHeaderContainer.classList.remove("modified");
    }
  }
  updateMenu() {
    const metadataChanged = this.accessor.checkIfModified();
    if (metadataChanged) {
      const actions = getFlatActionBarActions(this._menu.getActions({ shouldForwardArgs: true }));
      this._toolbar.setActions(actions);
    } else {
      this._toolbar.setActions([]);
    }
  }
  _updateFoldingIcon() {
    if (this.accessor.getFoldingState() === PropertyFoldingState.Collapsed) {
      DOM.reset(this._foldingIndicator, renderIcon(collapsedIcon));
      this._propertyExpanded?.set(false);
    } else {
      DOM.reset(this._foldingIndicator, renderIcon(expandedIcon));
      this._propertyExpanded?.set(true);
    }
  }
};
PropertyHeader = __decorateClass([
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IAccessibilityService)
], PropertyHeader);
let NotebookDocumentMetadataElement = class extends Disposable {
  constructor(notebookEditor, viewModel, templateData, instantiationService, textModelService, menuService, contextKeyService, textConfigurationService, configurationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.viewModel = viewModel;
    this.templateData = templateData;
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.textConfigurationService = textConfigurationService;
    this.configurationService = configurationService;
    this._editor = templateData.sourceEditor;
    this._cellHeaderContainer = this.templateData.cellHeaderContainer;
    this._editorContainer = this.templateData.editorContainer;
    this._diffEditorContainer = this.templateData.diffEditorContainer;
    this._editorViewStateChanged = false;
    this._register(viewModel.onDidLayoutChange((e) => {
      this.layout(e);
      this.updateBorders();
    }));
    this.buildBody();
    this.updateBorders();
  }
  buildBody() {
    const body = this.templateData.body;
    body.classList.remove("full");
    body.classList.add("full");
    this.updateSourceEditor();
    if (this.viewModel instanceof NotebookDocumentMetadataViewModel) {
      this._register(this.viewModel.modifiedMetadata.onDidChange((e) => {
        this._cellHeader.refresh();
      }));
    }
  }
  layoutNotebookCell() {
    this.notebookEditor.layoutNotebookCell(
      this.viewModel,
      this.viewModel.layoutInfo.totalHeight
    );
  }
  updateBorders() {
    this.templateData.leftBorder.style.height = `${this.viewModel.layoutInfo.totalHeight - 32}px`;
    this.templateData.rightBorder.style.height = `${this.viewModel.layoutInfo.totalHeight - 32}px`;
    this.templateData.bottomBorder.style.top = `${this.viewModel.layoutInfo.totalHeight - 32}px`;
  }
  updateSourceEditor() {
    this._cellHeaderContainer.style.display = "flex";
    this._cellHeaderContainer.innerText = "";
    this._editorContainer.classList.add("diff");
    const updateSourceEditor = () => {
      if (this.viewModel.cellFoldingState === PropertyFoldingState.Collapsed) {
        this._editorContainer.style.display = "none";
        this.viewModel.editorHeight = 0;
        return;
      }
      const lineHeight = this.notebookEditor.getLayoutInfo().fontInfo.lineHeight || 17;
      const editorHeight = this.viewModel.layoutInfo.editorHeight !== 0 ? this.viewModel.layoutInfo.editorHeight : this.viewModel.computeInputEditorHeight(lineHeight);
      this._editorContainer.style.height = `${editorHeight}px`;
      this._editorContainer.style.display = "block";
      const contentHeight = this._editor.getContentHeight();
      if (contentHeight >= 0) {
        this.viewModel.editorHeight = contentHeight;
      }
      return editorHeight;
    };
    const renderSourceEditor = () => {
      const editorHeight = updateSourceEditor();
      if (!editorHeight) {
        return;
      }
      const lineCount = this.viewModel.modifiedMetadata.textBuffer.getLineCount();
      const options = {
        padding: getEditorPadding(lineCount)
      };
      const unchangedRegions = this._register(getUnchangedRegionSettings(this.configurationService));
      if (unchangedRegions.options.enabled) {
        options.hideUnchangedRegions = unchangedRegions.options;
      }
      this._editor.updateOptions(options);
      this._register(unchangedRegions.onDidChangeEnablement(() => {
        options.hideUnchangedRegions = unchangedRegions.options;
        this._editor.updateOptions(options);
      }));
      this._editor.layout({
        width: this.notebookEditor.getLayoutInfo().width - 2 * DIFF_CELL_MARGIN,
        height: editorHeight
      });
      this._register(this._editor.onDidContentSizeChange((e) => {
        if (this.viewModel.cellFoldingState === PropertyFoldingState.Expanded && e.contentHeightChanged && this.viewModel.layoutInfo.editorHeight !== e.contentHeight) {
          this.viewModel.editorHeight = e.contentHeight;
        }
      }));
      this._initializeSourceDiffEditor();
    };
    this._cellHeader = this._register(this.instantiationService.createInstance(
      PropertyHeader,
      this.viewModel,
      this._cellHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: () => renderSourceEditor(),
        checkIfModified: () => {
          return this.viewModel.originalMetadata.getHash() !== this.viewModel.modifiedMetadata.getHash() ? { reason: void 0 } : false;
        },
        getFoldingState: () => this.viewModel.cellFoldingState,
        updateFoldingState: (state) => this.viewModel.cellFoldingState = state,
        unChangedLabel: "Notebook Metadata",
        changedLabel: "Notebook Metadata changed",
        prefix: "metadata",
        menuId: MenuId.NotebookDiffDocumentMetadata
      }
    ));
    this._cellHeader.buildHeader();
    renderSourceEditor();
    const scopedContextKeyService = this.contextKeyService.createScoped(this.templateData.inputToolbarContainer);
    this._register(scopedContextKeyService);
    const inputChanged = NOTEBOOK_DIFF_METADATA.bindTo(scopedContextKeyService);
    inputChanged.set(this.viewModel.originalMetadata.getHash() !== this.viewModel.modifiedMetadata.getHash());
    this._toolbar = this.templateData.toolbar;
    this._toolbar.context = this.viewModel;
    const refreshToolbar = () => {
      const hasChanges = this.viewModel.originalMetadata.getHash() !== this.viewModel.modifiedMetadata.getHash();
      inputChanged.set(hasChanges);
      if (hasChanges) {
        const menu = this.menuService.getMenuActions(MenuId.NotebookDiffDocumentMetadata, scopedContextKeyService, { shouldForwardArgs: true });
        const actions = getFlatActionBarActions(menu);
        this._toolbar.setActions(actions);
      } else {
        this._toolbar.setActions([]);
      }
    };
    this._register(this.viewModel.modifiedMetadata.onDidChange(() => {
      refreshToolbar();
    }));
    refreshToolbar();
  }
  async _initializeSourceDiffEditor() {
    const [originalRef, modifiedRef] = await Promise.all([
      this.textModelService.createModelReference(this.viewModel.originalMetadata.uri),
      this.textModelService.createModelReference(this.viewModel.modifiedMetadata.uri)
    ]);
    if (this._store.isDisposed) {
      originalRef.dispose();
      modifiedRef.dispose();
      return;
    }
    this._register(originalRef);
    this._register(modifiedRef);
    const vm = this._register(this._editor.createViewModel({
      original: originalRef.object.textEditorModel,
      modified: modifiedRef.object.textEditorModel
    }));
    await vm.waitForDiff();
    this._editor.setModel(vm);
    const handleViewStateChange = () => {
      this._editorViewStateChanged = true;
    };
    const handleScrollChange = (e) => {
      if (e.scrollTopChanged || e.scrollLeftChanged) {
        this._editorViewStateChanged = true;
      }
    };
    this.updateEditorOptionsForWhitespace();
    this._register(this._editor.getOriginalEditor().onDidChangeCursorSelection(handleViewStateChange));
    this._register(this._editor.getOriginalEditor().onDidScrollChange(handleScrollChange));
    this._register(this._editor.getModifiedEditor().onDidChangeCursorSelection(handleViewStateChange));
    this._register(this._editor.getModifiedEditor().onDidScrollChange(handleScrollChange));
    const editorViewState = this.viewModel.getSourceEditorViewState();
    if (editorViewState) {
      this._editor.restoreViewState(editorViewState);
    }
    const contentHeight = this._editor.getContentHeight();
    this.viewModel.editorHeight = contentHeight;
  }
  updateEditorOptionsForWhitespace() {
    const editor = this._editor;
    const uri = editor.getModel()?.modified.uri || editor.getModel()?.original.uri;
    if (!uri) {
      return;
    }
    const ignoreTrimWhitespace = this.textConfigurationService.getValue(uri, "diffEditor.ignoreTrimWhitespace");
    editor.updateOptions({ ignoreTrimWhitespace });
    this._register(this.textConfigurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(uri, "diffEditor") && e.affectedKeys.has("diffEditor.ignoreTrimWhitespace")) {
        const ignoreTrimWhitespace2 = this.textConfigurationService.getValue(uri, "diffEditor.ignoreTrimWhitespace");
        editor.updateOptions({ ignoreTrimWhitespace: ignoreTrimWhitespace2 });
      }
    }));
  }
  layout(state) {
    DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this._diffEditorContainer), () => {
      if (state.editorHeight) {
        this._editorContainer.style.height = `${this.viewModel.layoutInfo.editorHeight}px`;
        this._editor.layout({
          width: this._editor.getViewWidth(),
          height: this.viewModel.layoutInfo.editorHeight
        });
      }
      if (state.outerWidth) {
        this._editorContainer.style.height = `${this.viewModel.layoutInfo.editorHeight}px`;
        this._editor.layout();
      }
      this.layoutNotebookCell();
    });
  }
  dispose() {
    this._editor.setModel(null);
    if (this._editorViewStateChanged) {
      this.viewModel.saveSpirceEditorViewState(this._editor.saveViewState());
    }
    super.dispose();
  }
};
NotebookDocumentMetadataElement = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ITextResourceConfigurationService),
  __decorateParam(8, IConfigurationService)
], NotebookDocumentMetadataElement);
class AbstractElementRenderer extends Disposable {
  constructor(notebookEditor, cell, templateData, style, instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.cell = cell;
    this.templateData = templateData;
    this.style = style;
    this.instantiationService = instantiationService;
    this.languageService = languageService;
    this.modelService = modelService;
    this.textModelService = textModelService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.textConfigurationService = textConfigurationService;
    this._metadataLocalDisposable = this._register(new DisposableStore());
    this._outputLocalDisposable = this._register(new DisposableStore());
    this._ignoreMetadata = false;
    this._ignoreOutputs = false;
    this._isDisposed = false;
    this._metadataEditorDisposeStore = this._register(new DisposableStore());
    this._outputEditorDisposeStore = this._register(new DisposableStore());
    this._register(cell.onDidLayoutChange((e) => {
      this.layout(e);
    }));
    this._register(cell.onDidLayoutChange((e) => this.updateBorders()));
    this.init();
    this.buildBody();
    this._register(cell.onDidStateChange(() => {
      this.updateOutputRendering(this.cell.renderOutput);
    }));
  }
  buildBody() {
    const body = this.templateData.body;
    this._diffEditorContainer = this.templateData.diffEditorContainer;
    body.classList.remove("left", "right", "full");
    switch (this.style) {
      case "left":
        body.classList.add("left");
        break;
      case "right":
        body.classList.add("right");
        break;
      default:
        body.classList.add("full");
        break;
    }
    this.styleContainer(this._diffEditorContainer);
    this.updateSourceEditor();
    if (this.cell.modified) {
      this._register(this.cell.modified.textModel.onDidChangeContent(() => this._cellHeader.refresh()));
    }
    this._ignoreMetadata = this.configurationService.getValue("notebook.diff.ignoreMetadata");
    if (this._ignoreMetadata) {
      this._disposeMetadata();
    } else {
      this._buildMetadata();
    }
    this._ignoreOutputs = this.configurationService.getValue("notebook.diff.ignoreOutputs") || !!this.notebookEditor.textModel?.transientOptions.transientOutputs;
    if (this._ignoreOutputs) {
      this._disposeOutput();
    } else {
      this._buildOutput();
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      let metadataLayoutChange = false;
      let outputLayoutChange = false;
      if (e.affectsConfiguration("notebook.diff.ignoreMetadata")) {
        const newValue = this.configurationService.getValue("notebook.diff.ignoreMetadata");
        if (newValue !== void 0 && this._ignoreMetadata !== newValue) {
          this._ignoreMetadata = newValue;
          this._metadataLocalDisposable.clear();
          if (this.configurationService.getValue("notebook.diff.ignoreMetadata")) {
            this._disposeMetadata();
          } else {
            this.cell.metadataStatusHeight = 25;
            this._buildMetadata();
            this.updateMetadataRendering();
            metadataLayoutChange = true;
          }
        }
      }
      if (e.affectsConfiguration("notebook.diff.ignoreOutputs")) {
        const newValue = this.configurationService.getValue("notebook.diff.ignoreOutputs");
        if (newValue !== void 0 && this._ignoreOutputs !== (newValue || this.notebookEditor.textModel?.transientOptions.transientOutputs)) {
          this._ignoreOutputs = newValue || !!this.notebookEditor.textModel?.transientOptions.transientOutputs;
          this._outputLocalDisposable.clear();
          if (this._ignoreOutputs) {
            this._disposeOutput();
            this.cell.layoutChange();
          } else {
            this.cell.outputStatusHeight = 25;
            this._buildOutput();
            outputLayoutChange = true;
          }
        }
      }
      if (metadataLayoutChange || outputLayoutChange) {
        this.layout({ metadataHeight: metadataLayoutChange, outputTotalHeight: outputLayoutChange });
      }
    }));
  }
  updateMetadataRendering() {
    if (this.cell.metadataFoldingState === PropertyFoldingState.Expanded) {
      this._metadataInfoContainer.style.display = "block";
      if (!this._metadataEditorContainer || !this._metadataEditor) {
        this._metadataEditorContainer = DOM.append(this._metadataInfoContainer, DOM.$(".metadata-editor-container"));
        this._buildMetadataEditor();
      } else {
        this.cell.metadataHeight = this._metadataEditor.getContentHeight();
      }
    } else {
      this._metadataInfoContainer.style.display = "none";
      this.cell.metadataHeight = 0;
    }
  }
  updateOutputRendering(renderRichOutput) {
    if (this.cell.outputFoldingState === PropertyFoldingState.Expanded) {
      this._outputInfoContainer.style.display = "block";
      if (renderRichOutput) {
        this._hideOutputsRaw();
        this._buildOutputRendererContainer();
        this._showOutputsRenderer();
        this._showOutputsEmptyView();
      } else {
        this._hideOutputsRenderer();
        this._buildOutputRawContainer();
        this._showOutputsRaw();
      }
    } else {
      this._outputInfoContainer.style.display = "none";
      this._hideOutputsRaw();
      this._hideOutputsRenderer();
      this._hideOutputsEmptyView();
    }
  }
  _buildOutputRawContainer() {
    if (!this._outputEditorContainer) {
      this._outputEditorContainer = DOM.append(this._outputInfoContainer, DOM.$(".output-editor-container"));
      this._buildOutputEditor();
    }
  }
  _showOutputsRaw() {
    if (this._outputEditorContainer) {
      this._outputEditorContainer.style.display = "block";
      this.cell.rawOutputHeight = this._outputEditor.getContentHeight();
    }
  }
  _showOutputsEmptyView() {
    this.cell.layoutChange();
  }
  _hideOutputsRaw() {
    if (this._outputEditorContainer) {
      this._outputEditorContainer.style.display = "none";
      this.cell.rawOutputHeight = 0;
    }
  }
  _hideOutputsEmptyView() {
    this.cell.layoutChange();
  }
  _applySanitizedMetadataChanges(currentMetadata, newMetadata) {
    const result = {};
    try {
      const newMetadataObj = JSON.parse(newMetadata);
      const keys = /* @__PURE__ */ new Set([...Object.keys(newMetadataObj)]);
      for (const key of keys) {
        switch (key) {
          case "inputCollapsed":
          case "outputCollapsed":
            if (typeof newMetadataObj[key] === "boolean") {
              result[key] = newMetadataObj[key];
            } else {
              result[key] = currentMetadata[key];
            }
            break;
          default:
            result[key] = newMetadataObj[key];
            break;
        }
      }
      const index = this.notebookEditor.textModel.cells.indexOf(this.cell.modified.textModel);
      if (index < 0) {
        return;
      }
      this.notebookEditor.textModel.applyEdits([
        { editType: CellEditType.Metadata, index, metadata: result }
      ], true, void 0, () => void 0, void 0, true);
    } catch {
    }
  }
  async _buildMetadataEditor() {
    this._metadataEditorDisposeStore.clear();
    if (this.cell instanceof SideBySideDiffElementViewModel) {
      this._metadataEditor = this.instantiationService.createInstance(DiffEditorWidget, this._metadataEditorContainer, {
        ...fixedDiffEditorOptions,
        overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode(),
        readOnly: false,
        originalEditable: false,
        ignoreTrimWhitespace: false,
        automaticLayout: false,
        dimension: {
          height: this.cell.layoutInfo.metadataHeight,
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), true, true)
        }
      }, {
        originalEditor: getOptimizedNestedCodeEditorWidgetOptions(),
        modifiedEditor: getOptimizedNestedCodeEditorWidgetOptions()
      });
      const unchangedRegions = this._register(getUnchangedRegionSettings(this.configurationService));
      if (unchangedRegions.options.enabled) {
        this._metadataEditor.updateOptions({ hideUnchangedRegions: unchangedRegions.options });
      }
      this._metadataEditorDisposeStore.add(unchangedRegions.onDidChangeEnablement(() => {
        if (this._metadataEditor) {
          this._metadataEditor.updateOptions({ hideUnchangedRegions: unchangedRegions.options });
        }
      }));
      this.layout({ metadataHeight: true });
      this._metadataEditorDisposeStore.add(this._metadataEditor);
      this._metadataEditorContainer?.classList.add("diff");
      const [originalMetadataModel, modifiedMetadataModel] = await Promise.all([
        this.textModelService.createModelReference(CellUri.generateCellPropertyUri(this.cell.originalDocument.uri, this.cell.original.handle, Schemas.vscodeNotebookCellMetadata)),
        this.textModelService.createModelReference(CellUri.generateCellPropertyUri(this.cell.modifiedDocument.uri, this.cell.modified.handle, Schemas.vscodeNotebookCellMetadata))
      ]);
      if (this._isDisposed) {
        originalMetadataModel.dispose();
        modifiedMetadataModel.dispose();
        return;
      }
      this._metadataEditorDisposeStore.add(originalMetadataModel);
      this._metadataEditorDisposeStore.add(modifiedMetadataModel);
      const vm = this._metadataEditor.createViewModel({
        original: originalMetadataModel.object.textEditorModel,
        modified: modifiedMetadataModel.object.textEditorModel
      });
      this._metadataEditor.setModel(vm);
      await vm.waitForDiff();
      if (this._isDisposed) {
        return;
      }
      this.cell.metadataHeight = this._metadataEditor.getContentHeight();
      this._metadataEditorDisposeStore.add(this._metadataEditor.onDidContentSizeChange((e) => {
        if (e.contentHeightChanged && this.cell.metadataFoldingState === PropertyFoldingState.Expanded) {
          this.cell.metadataHeight = e.contentHeight;
        }
      }));
      let respondingToContentChange = false;
      this._metadataEditorDisposeStore.add(modifiedMetadataModel.object.textEditorModel.onDidChangeContent(() => {
        respondingToContentChange = true;
        const value = modifiedMetadataModel.object.textEditorModel.getValue();
        this._applySanitizedMetadataChanges(this.cell.modified.metadata, value);
        this._metadataHeader.refresh();
        respondingToContentChange = false;
      }));
      this._metadataEditorDisposeStore.add(this.cell.modified.textModel.onDidChangeMetadata(() => {
        if (respondingToContentChange) {
          return;
        }
        const modifiedMetadataSource = getFormattedMetadataJSON(this.notebookEditor.textModel?.transientOptions.transientCellMetadata, this.cell.modified?.metadata || {}, this.cell.modified?.language, true);
        modifiedMetadataModel.object.textEditorModel.setValue(modifiedMetadataSource);
      }));
      return;
    } else {
      this._metadataEditor = this.instantiationService.createInstance(CodeEditorWidget, this._metadataEditorContainer, {
        ...fixedEditorOptions,
        dimension: {
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
          height: this.cell.layoutInfo.metadataHeight
        },
        overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode(),
        readOnly: false
      }, {});
      this.layout({ metadataHeight: true });
      this._metadataEditorDisposeStore.add(this._metadataEditor);
      const mode = this.languageService.createById("jsonc");
      const originalMetadataSource = getFormattedMetadataJSON(
        this.notebookEditor.textModel?.transientOptions.transientCellMetadata,
        this.cell.type === "insert" ? this.cell.modified.metadata || {} : this.cell.original.metadata || {},
        void 0,
        true
      );
      const uri = this.cell.type === "insert" ? this.cell.modified.uri : this.cell.original.uri;
      const handle = this.cell.type === "insert" ? this.cell.modified.handle : this.cell.original.handle;
      const modelUri = CellUri.generateCellPropertyUri(uri, handle, Schemas.vscodeNotebookCellMetadata);
      const metadataModel = this.modelService.createModel(originalMetadataSource, mode, modelUri, false);
      this._metadataEditor.setModel(metadataModel);
      this._metadataEditorDisposeStore.add(metadataModel);
      this.cell.metadataHeight = this._metadataEditor.getContentHeight();
      this._metadataEditorDisposeStore.add(this._metadataEditor.onDidContentSizeChange((e) => {
        if (e.contentHeightChanged && this.cell.metadataFoldingState === PropertyFoldingState.Expanded) {
          this.cell.metadataHeight = e.contentHeight;
        }
      }));
    }
  }
  _buildOutputEditor() {
    this._outputEditorDisposeStore.clear();
    if ((this.cell.type === "modified" || this.cell.type === "unchanged") && !this.notebookEditor.textModel.transientOptions.transientOutputs) {
      const originalOutputsSource = getFormattedOutputJSON(this.cell.original?.outputs || []);
      const modifiedOutputsSource = getFormattedOutputJSON(this.cell.modified?.outputs || []);
      if (originalOutputsSource !== modifiedOutputsSource) {
        const mode2 = this.languageService.createById("json");
        const originalModel = this.modelService.createModel(originalOutputsSource, mode2, void 0, true);
        const modifiedModel = this.modelService.createModel(modifiedOutputsSource, mode2, void 0, true);
        this._outputEditorDisposeStore.add(originalModel);
        this._outputEditorDisposeStore.add(modifiedModel);
        const lineHeight = this.notebookEditor.getLayoutInfo().fontInfo.lineHeight || 17;
        const lineCount = Math.max(originalModel.getLineCount(), modifiedModel.getLineCount());
        this._outputEditor = this.instantiationService.createInstance(DiffEditorWidget, this._outputEditorContainer, {
          ...fixedDiffEditorOptions,
          overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode(),
          readOnly: true,
          ignoreTrimWhitespace: false,
          automaticLayout: false,
          dimension: {
            height: Math.min(OUTPUT_EDITOR_HEIGHT_MAGIC, this.cell.layoutInfo.rawOutputHeight || lineHeight * lineCount),
            width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true)
          },
          accessibilityVerbose: this.configurationService.getValue(AccessibilityVerbositySettingId.DiffEditor) ?? false
        }, {
          originalEditor: getOptimizedNestedCodeEditorWidgetOptions(),
          modifiedEditor: getOptimizedNestedCodeEditorWidgetOptions()
        });
        this._outputEditorDisposeStore.add(this._outputEditor);
        this._outputEditorContainer?.classList.add("diff");
        this._outputEditor.setModel({
          original: originalModel,
          modified: modifiedModel
        });
        this._outputEditor.restoreViewState(this.cell.getOutputEditorViewState());
        this.cell.rawOutputHeight = this._outputEditor.getContentHeight();
        this._outputEditorDisposeStore.add(this._outputEditor.onDidContentSizeChange((e) => {
          if (e.contentHeightChanged && this.cell.outputFoldingState === PropertyFoldingState.Expanded) {
            this.cell.rawOutputHeight = e.contentHeight;
          }
        }));
        this._outputEditorDisposeStore.add(this.cell.modified.textModel.onDidChangeOutputs(() => {
          const modifiedOutputsSource2 = getFormattedOutputJSON(this.cell.modified?.outputs || []);
          modifiedModel.setValue(modifiedOutputsSource2);
          this._outputHeader.refresh();
        }));
        return;
      }
    }
    this._outputEditor = this.instantiationService.createInstance(CodeEditorWidget, this._outputEditorContainer, {
      ...fixedEditorOptions,
      dimension: {
        width: Math.min(OUTPUT_EDITOR_HEIGHT_MAGIC, this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, this.cell.type === "unchanged" || this.cell.type === "modified") - 32),
        height: this.cell.layoutInfo.rawOutputHeight
      },
      overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode()
    }, {});
    this._outputEditorDisposeStore.add(this._outputEditor);
    const mode = this.languageService.createById("json");
    const originaloutputSource = getFormattedOutputJSON(
      this.notebookEditor.textModel.transientOptions.transientOutputs ? [] : this.cell.type === "insert" ? this.cell.modified?.outputs || [] : this.cell.original?.outputs || []
    );
    const outputModel = this.modelService.createModel(originaloutputSource, mode, void 0, true);
    this._outputEditorDisposeStore.add(outputModel);
    this._outputEditor.setModel(outputModel);
    this._outputEditor.restoreViewState(this.cell.getOutputEditorViewState());
    this.cell.rawOutputHeight = this._outputEditor.getContentHeight();
    this._outputEditorDisposeStore.add(this._outputEditor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged && this.cell.outputFoldingState === PropertyFoldingState.Expanded) {
        this.cell.rawOutputHeight = e.contentHeight;
      }
    }));
  }
  layoutNotebookCell() {
    this.notebookEditor.layoutNotebookCell(
      this.cell,
      this.cell.layoutInfo.totalHeight
    );
  }
  updateBorders() {
    this.templateData.leftBorder.style.height = `${this.cell.layoutInfo.totalHeight - 32}px`;
    this.templateData.rightBorder.style.height = `${this.cell.layoutInfo.totalHeight - 32}px`;
    this.templateData.bottomBorder.style.top = `${this.cell.layoutInfo.totalHeight - 32}px`;
  }
  dispose() {
    if (this._outputEditor) {
      this.cell.saveOutputEditorViewState(this._outputEditor.saveViewState());
    }
    if (this._metadataEditor) {
      this.cell.saveMetadataEditorViewState(this._metadataEditor.saveViewState());
    }
    this._metadataEditorDisposeStore.dispose();
    this._outputEditorDisposeStore.dispose();
    this._isDisposed = true;
    super.dispose();
  }
}
class SingleSideDiffElement extends AbstractElementRenderer {
  constructor(notebookEditor, cell, templateData, style, instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService) {
    super(
      notebookEditor,
      cell,
      templateData,
      style,
      instantiationService,
      languageService,
      modelService,
      textModelService,
      contextMenuService,
      keybindingService,
      notificationService,
      menuService,
      contextKeyService,
      configurationService,
      textConfigurationService
    );
    this.cell = cell;
    this.templateData = templateData;
    this.updateBorders();
  }
  init() {
    this._diagonalFill = this.templateData.diagonalFill;
  }
  buildBody() {
    const body = this.templateData.body;
    this._diffEditorContainer = this.templateData.diffEditorContainer;
    body.classList.remove("left", "right", "full");
    switch (this.style) {
      case "left":
        body.classList.add("left");
        break;
      case "right":
        body.classList.add("right");
        break;
      default:
        body.classList.add("full");
        break;
    }
    this.styleContainer(this._diffEditorContainer);
    this.updateSourceEditor();
    if (this.configurationService.getValue("notebook.diff.ignoreMetadata")) {
      this._disposeMetadata();
    } else {
      this._buildMetadata();
    }
    if (this.configurationService.getValue("notebook.diff.ignoreOutputs") || this.notebookEditor.textModel?.transientOptions.transientOutputs) {
      this._disposeOutput();
    } else {
      this._buildOutput();
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      let metadataLayoutChange = false;
      let outputLayoutChange = false;
      if (e.affectsConfiguration("notebook.diff.ignoreMetadata")) {
        this._metadataLocalDisposable.clear();
        if (this.configurationService.getValue("notebook.diff.ignoreMetadata")) {
          this._disposeMetadata();
        } else {
          this.cell.metadataStatusHeight = 25;
          this._buildMetadata();
          this.updateMetadataRendering();
          metadataLayoutChange = true;
        }
      }
      if (e.affectsConfiguration("notebook.diff.ignoreOutputs")) {
        this._outputLocalDisposable.clear();
        if (this.configurationService.getValue("notebook.diff.ignoreOutputs") || this.notebookEditor.textModel?.transientOptions.transientOutputs) {
          this._disposeOutput();
        } else {
          this.cell.outputStatusHeight = 25;
          this._buildOutput();
          outputLayoutChange = true;
        }
      }
      if (metadataLayoutChange || outputLayoutChange) {
        this.layout({ metadataHeight: metadataLayoutChange, outputTotalHeight: outputLayoutChange });
      }
    }));
  }
  updateSourceEditor() {
    this._cellHeaderContainer = this.templateData.cellHeaderContainer;
    this._cellHeaderContainer.style.display = "flex";
    this._cellHeaderContainer.innerText = "";
    this._editorContainer = this.templateData.editorContainer;
    this._editorContainer.classList.add("diff");
    const renderSourceEditor = () => {
      if (this.cell.cellFoldingState === PropertyFoldingState.Collapsed) {
        this._editorContainer.style.display = "none";
        this.cell.editorHeight = 0;
        return;
      }
      const lineHeight = this.notebookEditor.getLayoutInfo().fontInfo.lineHeight || 17;
      const editorHeight = this.cell.computeInputEditorHeight(lineHeight);
      this._editorContainer.style.height = `${editorHeight}px`;
      this._editorContainer.style.display = "block";
      if (this._editor) {
        const contentHeight = this._editor.getContentHeight();
        if (contentHeight >= 0) {
          this.cell.editorHeight = contentHeight;
        }
        return;
      }
      this._editor = this.templateData.sourceEditor;
      this._editor.layout(
        {
          width: (this.notebookEditor.getLayoutInfo().width - 2 * DIFF_CELL_MARGIN) / 2 - 18,
          height: editorHeight
        }
      );
      this._editor.updateOptions({ readOnly: this.readonly });
      this.cell.editorHeight = editorHeight;
      this._register(this._editor.onDidContentSizeChange((e) => {
        if (this.cell.cellFoldingState === PropertyFoldingState.Expanded && e.contentHeightChanged && this.cell.layoutInfo.editorHeight !== e.contentHeight) {
          this.cell.editorHeight = e.contentHeight;
        }
      }));
      this._initializeSourceDiffEditor(this.nestedCellViewModel);
    };
    this._cellHeader = this._register(this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._cellHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: () => renderSourceEditor(),
        checkIfModified: () => ({ reason: void 0 }),
        getFoldingState: () => this.cell.cellFoldingState,
        updateFoldingState: (state) => this.cell.cellFoldingState = state,
        unChangedLabel: "Input",
        changedLabel: "Input",
        prefix: "input",
        menuId: MenuId.NotebookDiffCellInputTitle
      }
    ));
    this._cellHeader.buildHeader();
    renderSourceEditor();
    this._initializeSourceDiffEditor(this.nestedCellViewModel);
  }
  calculateDiagonalFillHeight() {
    return this.cell.layoutInfo.cellStatusHeight + this.cell.layoutInfo.editorHeight + this.cell.layoutInfo.editorMargin + this.cell.layoutInfo.metadataStatusHeight + this.cell.layoutInfo.metadataHeight + this.cell.layoutInfo.outputTotalHeight + this.cell.layoutInfo.outputStatusHeight;
  }
  async _initializeSourceDiffEditor(modifiedCell) {
    const modifiedRef = await this.textModelService.createModelReference(modifiedCell.uri);
    if (this._isDisposed) {
      return;
    }
    const modifiedTextModel = modifiedRef.object.textEditorModel;
    this._register(modifiedRef);
    this._editor.setModel(modifiedTextModel);
    const editorViewState = this.cell.getSourceEditorViewState();
    if (editorViewState) {
      this._editor.restoreViewState(editorViewState);
    }
    const contentHeight = this._editor.getContentHeight();
    this.cell.editorHeight = contentHeight;
    const height = `${this.calculateDiagonalFillHeight()}px`;
    if (this._diagonalFill.style.height !== height) {
      this._diagonalFill.style.height = height;
    }
  }
  _disposeMetadata() {
    this.cell.metadataStatusHeight = 0;
    this.cell.metadataHeight = 0;
    this.templateData.cellHeaderContainer.style.display = "none";
    this.templateData.metadataHeaderContainer.style.display = "none";
    this.templateData.metadataInfoContainer.style.display = "none";
    this._metadataEditor = void 0;
  }
  _buildMetadata() {
    this._metadataHeaderContainer = this.templateData.metadataHeaderContainer;
    this._metadataInfoContainer = this.templateData.metadataInfoContainer;
    this._metadataHeaderContainer.style.display = "flex";
    this._metadataInfoContainer.style.display = "block";
    this._metadataHeaderContainer.innerText = "";
    this._metadataInfoContainer.innerText = "";
    this._metadataHeader = this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._metadataHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: this.updateMetadataRendering.bind(this),
        checkIfModified: () => {
          return this.cell.checkMetadataIfModified();
        },
        getFoldingState: () => {
          return this.cell.metadataFoldingState;
        },
        updateFoldingState: (state) => {
          this.cell.metadataFoldingState = state;
        },
        unChangedLabel: "Metadata",
        changedLabel: "Metadata changed",
        prefix: "metadata",
        menuId: MenuId.NotebookDiffCellMetadataTitle
      }
    );
    this._metadataLocalDisposable.add(this._metadataHeader);
    this._metadataHeader.buildHeader();
  }
  _buildOutput() {
    this.templateData.outputHeaderContainer.style.display = "flex";
    this.templateData.outputInfoContainer.style.display = "block";
    this._outputHeaderContainer = this.templateData.outputHeaderContainer;
    this._outputInfoContainer = this.templateData.outputInfoContainer;
    this._outputHeaderContainer.innerText = "";
    this._outputInfoContainer.innerText = "";
    this._outputHeader = this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._outputHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: this.updateOutputRendering.bind(this),
        checkIfModified: () => {
          return this.cell.checkIfOutputsModified();
        },
        getFoldingState: () => {
          return this.cell.outputFoldingState;
        },
        updateFoldingState: (state) => {
          this.cell.outputFoldingState = state;
        },
        unChangedLabel: "Outputs",
        changedLabel: "Outputs changed",
        prefix: "output",
        menuId: MenuId.NotebookDiffCellOutputsTitle
      }
    );
    this._outputLocalDisposable.add(this._outputHeader);
    this._outputHeader.buildHeader();
  }
  _disposeOutput() {
    this._hideOutputsRaw();
    this._hideOutputsRenderer();
    this._hideOutputsEmptyView();
    this.cell.rawOutputHeight = 0;
    this.cell.outputMetadataHeight = 0;
    this.cell.outputStatusHeight = 0;
    this.templateData.outputHeaderContainer.style.display = "none";
    this.templateData.outputInfoContainer.style.display = "none";
    this._outputViewContainer = void 0;
  }
}
let DeletedElement = class extends SingleSideDiffElement {
  constructor(notebookEditor, cell, templateData, languageService, modelService, textModelService, instantiationService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService) {
    super(notebookEditor, cell, templateData, "left", instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService);
  }
  get nestedCellViewModel() {
    return this.cell.original;
  }
  get readonly() {
    return true;
  }
  styleContainer(container) {
    container.classList.remove("inserted");
    container.classList.add("removed");
  }
  layout(state) {
    DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this._diffEditorContainer), () => {
      if ((state.editorHeight || state.outerWidth) && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, false),
          height: this.cell.layoutInfo.editorHeight
        });
      }
      if (state.outerWidth && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout();
      }
      if (state.metadataHeight || state.outerWidth) {
        this._metadataEditor?.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, false),
          height: this.cell.layoutInfo.metadataHeight
        });
      }
      if (state.outputTotalHeight || state.outerWidth) {
        this._outputEditor?.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, false),
          height: this.cell.layoutInfo.outputTotalHeight
        });
      }
      if (this._diagonalFill) {
        this._diagonalFill.style.height = `${this.calculateDiagonalFillHeight()}px`;
      }
      this.layoutNotebookCell();
    });
  }
  _buildOutputRendererContainer() {
    if (!this._outputViewContainer) {
      this._outputViewContainer = DOM.append(this._outputInfoContainer, DOM.$(".output-view-container"));
      this._outputEmptyElement = DOM.append(this._outputViewContainer, DOM.$(".output-empty-view"));
      const span = DOM.append(this._outputEmptyElement, DOM.$("span"));
      span.innerText = "No outputs to render";
      if (!this.cell.original?.outputs.length) {
        this._outputEmptyElement.style.display = "block";
      } else {
        this._outputEmptyElement.style.display = "none";
      }
      this.cell.layoutChange();
      this._outputLeftView = this.instantiationService.createInstance(OutputContainer, this.notebookEditor, this.notebookEditor.textModel, this.cell, this.cell.original, DiffSide.Original, this._outputViewContainer);
      this._register(this._outputLeftView);
      this._outputLeftView.render();
      const removedOutputRenderListener = this.notebookEditor.onDidDynamicOutputRendered((e) => {
        if (e.cell.uri.toString() === this.cell.original.uri.toString()) {
          this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Original, this.cell.original.id, ["nb-cellDeleted"], []);
          removedOutputRenderListener.dispose();
        }
      });
      this._register(removedOutputRenderListener);
    }
    this._outputViewContainer.style.display = "block";
  }
  _decorate() {
    this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Original, this.cell.original.id, ["nb-cellDeleted"], []);
  }
  _showOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "block";
      this._outputLeftView?.showOutputs();
      this._decorate();
    }
  }
  _hideOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "none";
      this._outputLeftView?.hideOutputs();
    }
  }
  dispose() {
    if (this._editor) {
      this.cell.saveSpirceEditorViewState(this._editor.saveViewState());
    }
    super.dispose();
  }
};
DeletedElement = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ITextModelService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IMenuService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ITextResourceConfigurationService)
], DeletedElement);
let InsertElement = class extends SingleSideDiffElement {
  constructor(notebookEditor, cell, templateData, instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService) {
    super(notebookEditor, cell, templateData, "right", instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService);
  }
  get nestedCellViewModel() {
    return this.cell.modified;
  }
  get readonly() {
    return false;
  }
  styleContainer(container) {
    container.classList.remove("removed");
    container.classList.add("inserted");
  }
  _buildOutputRendererContainer() {
    if (!this._outputViewContainer) {
      this._outputViewContainer = DOM.append(this._outputInfoContainer, DOM.$(".output-view-container"));
      this._outputEmptyElement = DOM.append(this._outputViewContainer, DOM.$(".output-empty-view"));
      this._outputEmptyElement.innerText = "No outputs to render";
      if (!this.cell.modified?.outputs.length) {
        this._outputEmptyElement.style.display = "block";
      } else {
        this._outputEmptyElement.style.display = "none";
      }
      this.cell.layoutChange();
      this._outputRightView = this.instantiationService.createInstance(OutputContainer, this.notebookEditor, this.notebookEditor.textModel, this.cell, this.cell.modified, DiffSide.Modified, this._outputViewContainer);
      this._register(this._outputRightView);
      this._outputRightView.render();
      const insertOutputRenderListener = this.notebookEditor.onDidDynamicOutputRendered((e) => {
        if (e.cell.uri.toString() === this.cell.modified.uri.toString()) {
          this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Modified, this.cell.modified.id, ["nb-cellAdded"], []);
          insertOutputRenderListener.dispose();
        }
      });
      this._register(insertOutputRenderListener);
    }
    this._outputViewContainer.style.display = "block";
  }
  _decorate() {
    this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Modified, this.cell.modified.id, ["nb-cellAdded"], []);
  }
  _showOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "block";
      this._outputRightView?.showOutputs();
      this._decorate();
    }
  }
  _hideOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "none";
      this._outputRightView?.hideOutputs();
    }
  }
  layout(state) {
    DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this._diffEditorContainer), () => {
      if ((state.editorHeight || state.outerWidth) && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, false),
          height: this.cell.layoutInfo.editorHeight
        });
      }
      if (state.outerWidth && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout();
      }
      if (state.metadataHeight || state.outerWidth) {
        this._metadataEditor?.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
          height: this.cell.layoutInfo.metadataHeight
        });
      }
      if (state.outputTotalHeight || state.outerWidth) {
        this._outputEditor?.layout({
          width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, false),
          height: this.cell.layoutInfo.outputTotalHeight
        });
      }
      this.layoutNotebookCell();
      if (this._diagonalFill) {
        this._diagonalFill.style.height = `${this.calculateDiagonalFillHeight()}px`;
      }
    });
  }
  dispose() {
    if (this._editor) {
      this.cell.saveSpirceEditorViewState(this._editor.saveViewState());
    }
    super.dispose();
  }
};
InsertElement = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILanguageService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IMenuService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ITextResourceConfigurationService)
], InsertElement);
let ModifiedElement = class extends AbstractElementRenderer {
  constructor(notebookEditor, cell, templateData, instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService) {
    super(notebookEditor, cell, templateData, "full", instantiationService, languageService, modelService, textModelService, contextMenuService, keybindingService, notificationService, menuService, contextKeyService, configurationService, textConfigurationService);
    this.cell = cell;
    this.templateData = templateData;
    this._editorViewStateChanged = false;
    this.updateBorders();
  }
  init() {
  }
  styleContainer(container) {
    container.classList.remove("inserted", "removed");
  }
  buildBody() {
    super.buildBody();
    if (this.cell.displayIconToHideUnmodifiedCells) {
      this._register(this.templateData.marginOverlay.onAction(() => this.cell.hideUnchangedCells()));
      this.templateData.marginOverlay.show();
    } else {
      this.templateData.marginOverlay.hide();
    }
  }
  _disposeMetadata() {
    this.cell.metadataStatusHeight = 0;
    this.cell.metadataHeight = 0;
    this.templateData.metadataHeaderContainer.style.display = "none";
    this.templateData.metadataInfoContainer.style.display = "none";
    this._metadataEditor = void 0;
  }
  _buildMetadata() {
    this._metadataHeaderContainer = this.templateData.metadataHeaderContainer;
    this._metadataInfoContainer = this.templateData.metadataInfoContainer;
    this._metadataHeaderContainer.style.display = "flex";
    this._metadataInfoContainer.style.display = "block";
    this._metadataHeaderContainer.innerText = "";
    this._metadataInfoContainer.innerText = "";
    this._metadataHeader = this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._metadataHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: this.updateMetadataRendering.bind(this),
        checkIfModified: () => {
          return this.cell.checkMetadataIfModified();
        },
        getFoldingState: () => {
          return this.cell.metadataFoldingState;
        },
        updateFoldingState: (state) => {
          this.cell.metadataFoldingState = state;
        },
        unChangedLabel: "Metadata",
        changedLabel: "Metadata changed",
        prefix: "metadata",
        menuId: MenuId.NotebookDiffCellMetadataTitle
      }
    );
    this._metadataLocalDisposable.add(this._metadataHeader);
    this._metadataHeader.buildHeader();
  }
  _disposeOutput() {
    this._hideOutputsRaw();
    this._hideOutputsRenderer();
    this._hideOutputsEmptyView();
    this.cell.rawOutputHeight = 0;
    this.cell.outputMetadataHeight = 0;
    this.cell.outputStatusHeight = 0;
    this.templateData.outputHeaderContainer.style.display = "none";
    this.templateData.outputInfoContainer.style.display = "none";
    this._outputViewContainer = void 0;
  }
  _buildOutput() {
    this.templateData.outputHeaderContainer.style.display = "flex";
    this.templateData.outputInfoContainer.style.display = "block";
    this._outputHeaderContainer = this.templateData.outputHeaderContainer;
    this._outputInfoContainer = this.templateData.outputInfoContainer;
    this._outputHeaderContainer.innerText = "";
    this._outputInfoContainer.innerText = "";
    if (this.cell.checkIfOutputsModified()) {
      this._outputInfoContainer.classList.add("modified");
    } else {
      this._outputInfoContainer.classList.remove("modified");
    }
    this._outputHeader = this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._outputHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: this.updateOutputRendering.bind(this),
        checkIfModified: () => {
          return this.cell.checkIfOutputsModified();
        },
        getFoldingState: () => {
          return this.cell.outputFoldingState;
        },
        updateFoldingState: (state) => {
          this.cell.outputFoldingState = state;
        },
        unChangedLabel: "Outputs",
        changedLabel: "Outputs changed",
        prefix: "output",
        menuId: MenuId.NotebookDiffCellOutputsTitle
      }
    );
    this._outputLocalDisposable.add(this._outputHeader);
    this._outputHeader.buildHeader();
  }
  _buildOutputRendererContainer() {
    if (!this._outputViewContainer) {
      this._outputViewContainer = DOM.append(this._outputInfoContainer, DOM.$(".output-view-container"));
      this._outputEmptyElement = DOM.append(this._outputViewContainer, DOM.$(".output-empty-view"));
      this._outputEmptyElement.innerText = "No outputs to render";
      if (!this.cell.checkIfOutputsModified() && this.cell.modified.outputs.length === 0) {
        this._outputEmptyElement.style.display = "block";
      } else {
        this._outputEmptyElement.style.display = "none";
      }
      this.cell.layoutChange();
      this._register(this.cell.modified.textModel.onDidChangeOutputs(() => {
        if (!this.cell.checkIfOutputsModified() && this.cell.modified.outputs.length === 0) {
          this._outputEmptyElement.style.display = "block";
        } else {
          this._outputEmptyElement.style.display = "none";
        }
        this._decorate();
      }));
      this._outputLeftContainer = DOM.append(this._outputViewContainer, DOM.$(".output-view-container-left"));
      this._outputRightContainer = DOM.append(this._outputViewContainer, DOM.$(".output-view-container-right"));
      this._outputMetadataContainer = DOM.append(this._outputViewContainer, DOM.$(".output-view-container-metadata"));
      const outputModified = this.cell.checkIfOutputsModified();
      const outputMetadataChangeOnly = outputModified && outputModified.kind === OutputComparison.Metadata && this.cell.original.outputs.length === 1 && this.cell.modified.outputs.length === 1 && outputEqual(this.cell.original.outputs[0], this.cell.modified.outputs[0]) === OutputComparison.Metadata;
      if (outputModified && !outputMetadataChangeOnly) {
        const originalOutputRenderListener = this.notebookEditor.onDidDynamicOutputRendered((e) => {
          if (e.cell.uri.toString() === this.cell.original.uri.toString() && this.cell.checkIfOutputsModified()) {
            this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Original, this.cell.original.id, ["nb-cellDeleted"], []);
            originalOutputRenderListener.dispose();
          }
        });
        const modifiedOutputRenderListener = this.notebookEditor.onDidDynamicOutputRendered((e) => {
          if (e.cell.uri.toString() === this.cell.modified.uri.toString() && this.cell.checkIfOutputsModified()) {
            this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Modified, this.cell.modified.id, ["nb-cellAdded"], []);
            modifiedOutputRenderListener.dispose();
          }
        });
        this._register(originalOutputRenderListener);
        this._register(modifiedOutputRenderListener);
      }
      this._outputLeftView = this.instantiationService.createInstance(OutputContainer, this.notebookEditor, this.notebookEditor.textModel, this.cell, this.cell.original, DiffSide.Original, this._outputLeftContainer);
      this._outputLeftView.render();
      this._register(this._outputLeftView);
      this._outputRightView = this.instantiationService.createInstance(OutputContainer, this.notebookEditor, this.notebookEditor.textModel, this.cell, this.cell.modified, DiffSide.Modified, this._outputRightContainer);
      this._outputRightView.render();
      this._register(this._outputRightView);
      if (outputModified && !outputMetadataChangeOnly) {
        this._decorate();
      }
      if (outputMetadataChangeOnly) {
        this._outputMetadataContainer.style.top = `${this.cell.layoutInfo.rawOutputHeight}px`;
        this._outputMetadataEditor = this.instantiationService.createInstance(DiffEditorWidget, this._outputMetadataContainer, {
          ...fixedDiffEditorOptions,
          overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode(),
          readOnly: true,
          ignoreTrimWhitespace: false,
          automaticLayout: false,
          dimension: {
            height: OUTPUT_EDITOR_HEIGHT_MAGIC,
            width: this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true)
          }
        }, {
          originalEditor: getOptimizedNestedCodeEditorWidgetOptions(),
          modifiedEditor: getOptimizedNestedCodeEditorWidgetOptions()
        });
        this._register(this._outputMetadataEditor);
        const originalOutputMetadataSource = JSON.stringify(this.cell.original.outputs[0].metadata ?? {}, void 0, "	");
        const modifiedOutputMetadataSource = JSON.stringify(this.cell.modified.outputs[0].metadata ?? {}, void 0, "	");
        const mode = this.languageService.createById("json");
        const originalModel = this.modelService.createModel(originalOutputMetadataSource, mode, void 0, true);
        const modifiedModel = this.modelService.createModel(modifiedOutputMetadataSource, mode, void 0, true);
        this._outputMetadataEditor.setModel({
          original: originalModel,
          modified: modifiedModel
        });
        this.cell.outputMetadataHeight = this._outputMetadataEditor.getContentHeight();
        this._register(this._outputMetadataEditor.onDidContentSizeChange((e) => {
          this.cell.outputMetadataHeight = e.contentHeight;
        }));
      }
    }
    this._outputViewContainer.style.display = "block";
  }
  _decorate() {
    if (this.cell.checkIfOutputsModified()) {
      this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Original, this.cell.original.id, ["nb-cellDeleted"], []);
      this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Modified, this.cell.modified.id, ["nb-cellAdded"], []);
    } else {
      this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Original, this.cell.original.id, [], ["nb-cellDeleted"]);
      this.notebookEditor.deltaCellOutputContainerClassNames(DiffSide.Modified, this.cell.modified.id, [], ["nb-cellAdded"]);
    }
  }
  _showOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "block";
      this._outputLeftView?.showOutputs();
      this._outputRightView?.showOutputs();
      this._outputMetadataEditor?.layout({
        width: this._editor?.getViewWidth() || this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
        height: this.cell.layoutInfo.outputMetadataHeight
      });
      this._decorate();
    }
  }
  _hideOutputsRenderer() {
    if (this._outputViewContainer) {
      this._outputViewContainer.style.display = "none";
      this._outputLeftView?.hideOutputs();
      this._outputRightView?.hideOutputs();
    }
  }
  updateSourceEditor() {
    this._cellHeaderContainer = this.templateData.cellHeaderContainer;
    this._cellHeaderContainer.style.display = "flex";
    this._cellHeaderContainer.innerText = "";
    const modifiedCell = this.cell.modified;
    this._editorContainer = this.templateData.editorContainer;
    this._editorContainer.classList.add("diff");
    const renderSourceEditor = () => {
      if (this.cell.cellFoldingState === PropertyFoldingState.Collapsed) {
        this._editorContainer.style.display = "none";
        this.cell.editorHeight = 0;
        return;
      }
      const lineCount = modifiedCell.textModel.textBuffer.getLineCount();
      const lineHeight = this.notebookEditor.getLayoutInfo().fontInfo.lineHeight || 17;
      const editorHeight = this.cell.layoutInfo.editorHeight !== 0 ? this.cell.layoutInfo.editorHeight : this.cell.computeInputEditorHeight(lineHeight);
      this._editorContainer.style.height = `${editorHeight}px`;
      this._editorContainer.style.display = "block";
      if (this._editor) {
        const contentHeight = this._editor.getContentHeight();
        if (contentHeight >= 0) {
          this.cell.editorHeight = contentHeight;
        }
        return;
      }
      this._editor = this.templateData.sourceEditor;
      const options = {
        padding: getEditorPadding(lineCount)
      };
      const unchangedRegions = this._register(getUnchangedRegionSettings(this.configurationService));
      if (unchangedRegions.options.enabled) {
        options.hideUnchangedRegions = unchangedRegions.options;
      }
      this._editor.updateOptions(options);
      this._register(unchangedRegions.onDidChangeEnablement(() => {
        options.hideUnchangedRegions = unchangedRegions.options;
        this._editor?.updateOptions(options);
      }));
      this._editor.layout({
        width: this.notebookEditor.getLayoutInfo().width - 2 * DIFF_CELL_MARGIN,
        height: editorHeight
      });
      this._register(this._editor.onDidContentSizeChange((e) => {
        if (this.cell.cellFoldingState === PropertyFoldingState.Expanded && e.contentHeightChanged && this.cell.layoutInfo.editorHeight !== e.contentHeight) {
          this.cell.editorHeight = e.contentHeight;
        }
      }));
      this._initializeSourceDiffEditor();
    };
    this._cellHeader = this._register(this.instantiationService.createInstance(
      PropertyHeader,
      this.cell,
      this._cellHeaderContainer,
      this.notebookEditor,
      {
        updateInfoRendering: () => renderSourceEditor(),
        checkIfModified: () => {
          return this.cell.modified?.textModel.getTextBufferHash() !== this.cell.original?.textModel.getTextBufferHash() ? { reason: void 0 } : false;
        },
        getFoldingState: () => this.cell.cellFoldingState,
        updateFoldingState: (state) => this.cell.cellFoldingState = state,
        unChangedLabel: "Input",
        changedLabel: "Input changed",
        prefix: "input",
        menuId: MenuId.NotebookDiffCellInputTitle
      }
    ));
    this._cellHeader.buildHeader();
    renderSourceEditor();
    const scopedContextKeyService = this.contextKeyService.createScoped(this.templateData.inputToolbarContainer);
    this._register(scopedContextKeyService);
    const inputChanged = NOTEBOOK_DIFF_CELL_INPUT.bindTo(scopedContextKeyService);
    inputChanged.set(this.cell.modified.textModel.getTextBufferHash() !== this.cell.original.textModel.getTextBufferHash());
    const ignoreWhitespace = NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE.bindTo(scopedContextKeyService);
    const ignore = this.textConfigurationService.getValue(this.cell.modified.uri, "diffEditor.ignoreTrimWhitespace");
    ignoreWhitespace.set(ignore);
    this._toolbar = this.templateData.toolbar;
    this._toolbar.context = this.cell;
    const refreshToolbar = () => {
      const ignore2 = this.textConfigurationService.getValue(this.cell.modified.uri, "diffEditor.ignoreTrimWhitespace");
      ignoreWhitespace.set(ignore2);
      const hasChanges = this.cell.modified.textModel.getTextBufferHash() !== this.cell.original.textModel.getTextBufferHash();
      inputChanged.set(hasChanges);
      if (hasChanges) {
        const menu = this.menuService.getMenuActions(MenuId.NotebookDiffCellInputTitle, scopedContextKeyService, { shouldForwardArgs: true });
        const actions = getFlatActionBarActions(menu);
        this._toolbar.setActions(actions);
      } else {
        this._toolbar.setActions([]);
      }
    };
    this._register(this.cell.modified.textModel.onDidChangeContent(() => refreshToolbar()));
    this._register(this.textConfigurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(this.cell.modified.uri, "diffEditor") && e.affectedKeys.has("diffEditor.ignoreTrimWhitespace")) {
        refreshToolbar();
      }
    }));
    refreshToolbar();
  }
  async _initializeSourceDiffEditor() {
    const [originalRef, modifiedRef] = await Promise.all([
      this.textModelService.createModelReference(this.cell.original.uri),
      this.textModelService.createModelReference(this.cell.modified.uri)
    ]);
    this._register(originalRef);
    this._register(modifiedRef);
    if (this._isDisposed) {
      originalRef.dispose();
      modifiedRef.dispose();
      return;
    }
    const vm = this._register(this._editor.createViewModel({
      original: originalRef.object.textEditorModel,
      modified: modifiedRef.object.textEditorModel
    }));
    await vm.waitForDiff();
    this._editor.setModel(vm);
    const handleViewStateChange = () => {
      this._editorViewStateChanged = true;
    };
    const handleScrollChange = (e) => {
      if (e.scrollTopChanged || e.scrollLeftChanged) {
        this._editorViewStateChanged = true;
      }
    };
    this.updateEditorOptionsForWhitespace();
    this._register(this._editor.getOriginalEditor().onDidChangeCursorSelection(handleViewStateChange));
    this._register(this._editor.getOriginalEditor().onDidScrollChange(handleScrollChange));
    this._register(this._editor.getModifiedEditor().onDidChangeCursorSelection(handleViewStateChange));
    this._register(this._editor.getModifiedEditor().onDidScrollChange(handleScrollChange));
    const editorViewState = this.cell.getSourceEditorViewState();
    if (editorViewState) {
      this._editor.restoreViewState(editorViewState);
    }
    const contentHeight = this._editor.getContentHeight();
    this.cell.editorHeight = contentHeight;
  }
  updateEditorOptionsForWhitespace() {
    const editor = this._editor;
    if (!editor) {
      return;
    }
    const uri = editor.getModel()?.modified.uri || editor.getModel()?.original.uri;
    if (!uri) {
      return;
    }
    const ignoreTrimWhitespace = this.textConfigurationService.getValue(uri, "diffEditor.ignoreTrimWhitespace");
    editor.updateOptions({ ignoreTrimWhitespace });
    this._register(this.textConfigurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(uri, "diffEditor") && e.affectedKeys.has("diffEditor.ignoreTrimWhitespace")) {
        const ignoreTrimWhitespace2 = this.textConfigurationService.getValue(uri, "diffEditor.ignoreTrimWhitespace");
        editor.updateOptions({ ignoreTrimWhitespace: ignoreTrimWhitespace2 });
      }
    }));
  }
  layout(state) {
    DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this._diffEditorContainer), () => {
      if (state.editorHeight && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout({
          width: this._editor.getViewWidth(),
          height: this.cell.layoutInfo.editorHeight
        });
      }
      if (state.outerWidth && this._editor) {
        this._editorContainer.style.height = `${this.cell.layoutInfo.editorHeight}px`;
        this._editor.layout();
      }
      if (state.metadataHeight || state.outerWidth) {
        if (this._metadataEditorContainer) {
          this._metadataEditorContainer.style.height = `${this.cell.layoutInfo.metadataHeight}px`;
          this._metadataEditor?.layout({
            width: this._editor?.getViewWidth() || this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
            height: this.cell.layoutInfo.metadataHeight
          });
        }
      }
      if (state.outputTotalHeight || state.outerWidth) {
        if (this._outputEditorContainer) {
          this._outputEditorContainer.style.height = `${this.cell.layoutInfo.outputTotalHeight}px`;
          this._outputEditor?.layout({
            width: this._editor?.getViewWidth() || this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
            height: this.cell.layoutInfo.outputTotalHeight
          });
        }
        if (this._outputMetadataContainer) {
          this._outputMetadataContainer.style.height = `${this.cell.layoutInfo.outputMetadataHeight}px`;
          this._outputMetadataContainer.style.top = `${this.cell.layoutInfo.outputTotalHeight - this.cell.layoutInfo.outputMetadataHeight}px`;
          this._outputMetadataEditor?.layout({
            width: this._editor?.getViewWidth() || this.cell.getComputedCellContainerWidth(this.notebookEditor.getLayoutInfo(), false, true),
            height: this.cell.layoutInfo.outputMetadataHeight
          });
        }
      }
      this.layoutNotebookCell();
    });
  }
  dispose() {
    if (this._editor) {
      this._editor.setModel(null);
    }
    if (this._editor && this._editorViewStateChanged) {
      this.cell.saveSpirceEditorViewState(this._editor.saveViewState());
    }
    super.dispose();
  }
};
ModifiedElement = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILanguageService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IMenuService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ITextResourceConfigurationService)
], ModifiedElement);
class CollapsedCellOverlayWidget extends Disposable {
  constructor(container) {
    super();
    this.container = container;
    this._nodes = DOM.h("div.diff-hidden-cells", [
      DOM.h(
        "div.center@content",
        { style: { display: "flex" } },
        [
          DOM.$(
            "a",
            {
              title: localize("showUnchangedCells", "Show Unchanged Cells"),
              role: "button",
              onclick: () => {
                this._action.fire();
              }
            },
            ...renderLabelWithIcons("$(unfold)")
          )
        ]
      )
    ]);
    this._action = this._register(new Emitter());
    this.onAction = this._action.event;
    this._nodes.root.style.display = "none";
    container.appendChild(this._nodes.root);
  }
  show() {
    this._nodes.root.style.display = "block";
  }
  hide() {
    this._nodes.root.style.display = "none";
  }
  dispose() {
    this.hide();
    this.container.removeChild(this._nodes.root);
    DOM.reset(this._nodes.root);
    super.dispose();
  }
}
class UnchangedCellOverlayWidget extends Disposable {
  constructor(container) {
    super();
    this.container = container;
    this._nodes = DOM.h("div.diff-hidden-cells", [
      DOM.h(
        "div.center@content",
        { style: { display: "flex" } },
        [
          DOM.$(
            "a",
            {
              title: localize("hideUnchangedCells", "Hide Unchanged Cells"),
              role: "button",
              onclick: () => {
                this._action.fire();
              }
            },
            ...renderLabelWithIcons("$(fold)")
          )
        ]
      )
    ]);
    this._action = this._register(new Emitter());
    this.onAction = this._action.event;
    this._nodes.root.style.display = "none";
    container.appendChild(this._nodes.root);
  }
  show() {
    this._nodes.root.style.display = "block";
  }
  hide() {
    this._nodes.root.style.display = "none";
  }
  dispose() {
    this.hide();
    this.container.removeChild(this._nodes.root);
    DOM.reset(this._nodes.root);
    super.dispose();
  }
}
export {
  CellDiffPlaceholderElement,
  CollapsedCellOverlayWidget,
  DeletedElement,
  InsertElement,
  ModifiedElement,
  NotebookDocumentMetadataElement,
  UnchangedCellOverlayWidget,
  getOptimizedNestedCodeEditorWidgetOptions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2RpZmYvZGlmZkNvbXBvbmVudHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaWZmRWxlbWVudENlbGxWaWV3TW9kZWxCYXNlLCBnZXRGb3JtYXR0ZWRPdXRwdXRKU09OLCBPdXRwdXRDb21wYXJpc29uLCBvdXRwdXRFcXVhbCwgT1VUUFVUX0VESVRPUl9IRUlHSFRfTUFHSUMsIFByb3BlcnR5Rm9sZGluZ1N0YXRlLCBTaWRlQnlTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwsIFNpbmdsZVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbCwgRGlmZkVsZW1lbnRQbGFjZWhvbGRlclZpZXdNb2RlbCwgSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZSwgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVmlld01vZGVsIH0gZnJvbSAnLi9kaWZmRWxlbWVudFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRGlmZlNpZGVCeVNpZGVSZW5kZXJUZW1wbGF0ZSwgQ2VsbERpZmZTaW5nbGVTaWRlUmVuZGVyVGVtcGxhdGUsIERpZmZTaWRlLCBESUZGX0NFTExfTUFSR0lOLCBJTm90ZWJvb2tUZXh0RGlmZkVkaXRvciwgTk9URUJPT0tfRElGRl9DRUxMX0lOUFVULCBOT1RFQk9PS19ESUZGX0NFTExfUFJPUEVSVFksIE5PVEVCT09LX0RJRkZfQ0VMTF9QUk9QRVJUWV9FWFBBTkRFRCwgQ2VsbERpZmZQbGFjZWhvbGRlclJlbmRlclRlbXBsYXRlLCBJRGlmZkNlbGxNYXJnaW5PdmVybGF5LCBOT1RFQk9PS19ESUZGX0NFTExfSUdOT1JFX1dISVRFU1BBQ0UsIE5vdGVib29rRG9jdW1lbnREaWZmRWxlbWVudFJlbmRlclRlbXBsYXRlLCBOT1RFQk9PS19ESUZGX01FVEFEQVRBIH0gZnJvbSAnLi9ub3RlYm9va0RpZmZFZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQsIElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IENlbGxFZGl0VHlwZSwgQ2VsbFVyaSwgTm90ZWJvb2tDZWxsTWV0YWRhdGEgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b29sYmFyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSU1lbnUsIElNZW51U2VydmljZSwgTWVudUlkLCBNZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IENvZGljb25BY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uL3ZpZXcvY2VsbFBhcnRzL2NlbGxBY3Rpb25WaWV3LmpzJztcbmltcG9ydCB7IGNvbGxhcHNlZEljb24sIGV4cGFuZGVkSWNvbiB9IGZyb20gJy4uL25vdGVib29rSWNvbnMuanMnO1xuaW1wb3J0IHsgT3V0cHV0Q29udGFpbmVyIH0gZnJvbSAnLi9kaWZmRWxlbWVudE91dHB1dHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0TWVudUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb250ZXh0bWVudS9icm93c2VyL2NvbnRleHRtZW51LmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgTWVudVByZXZlbnRlciB9IGZyb20gJy4uLy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9tZW51UHJldmVudGVyLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbkNsaXBib2FyZENvbnRyaWJ1dGlvbklEIH0gZnJvbSAnLi4vLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3NlbGVjdGlvbkNsaXBib2FyZC5qcyc7XG5pbXBvcnQgeyBUYWJDb21wbGV0aW9uQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uL3NuaXBwZXRzL2Jyb3dzZXIvdGFiQ29tcGxldGlvbi5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uLCByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGZpeGVkRGlmZkVkaXRvck9wdGlvbnMsIGZpeGVkRWRpdG9yT3B0aW9ucywgZ2V0RWRpdG9yUGFkZGluZyB9IGZyb20gJy4vZGlmZkNlbGxFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZkVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRGlmZk5lc3RlZENlbGxWaWV3TW9kZWwgfSBmcm9tICcuL2RpZmZOZXN0ZWRDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0Rm9ybWF0dGVkTWV0YWRhdGFKU09OIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rQ2VsbFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IGdldFVuY2hhbmdlZFJlZ2lvblNldHRpbmdzIH0gZnJvbSAnLi91bmNoYW5nZWRFZGl0b3JSZWdpb25zLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9wdGltaXplZE5lc3RlZENvZGVFZGl0b3JXaWRnZXRPcHRpb25zKCk6IElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aXNTaW1wbGVXaWRnZXQ6IGZhbHNlLFxuXHRcdGNvbnRyaWJ1dGlvbnM6IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRTb21lRWRpdG9yQ29udHJpYnV0aW9ucyhbXG5cdFx0XHRNZW51UHJldmVudGVyLklELFxuXHRcdFx0U2VsZWN0aW9uQ2xpcGJvYXJkQ29udHJpYnV0aW9uSUQsXG5cdFx0XHRDb250ZXh0TWVudUNvbnRyb2xsZXIuSUQsXG5cdFx0XHRTdWdnZXN0Q29udHJvbGxlci5JRCxcblx0XHRcdFNuaXBwZXRDb250cm9sbGVyMi5JRCxcblx0XHRcdFRhYkNvbXBsZXRpb25Db250cm9sbGVyLklELFxuXHRcdF0pXG5cdH07XG59XG5cbmV4cG9ydCBjbGFzcyBDZWxsRGlmZlBsYWNlaG9sZGVyRWxlbWVudCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwbGFjZWhvbGRlcjogRGlmZkVsZW1lbnRQbGFjZWhvbGRlclZpZXdNb2RlbCxcblx0XHR0ZW1wbGF0ZURhdGE6IENlbGxEaWZmUGxhY2Vob2xkZXJSZW5kZXJUZW1wbGF0ZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdsZWZ0JywgJ3JpZ2h0JywgJ2Z1bGwnKTtcblx0XHRjb25zdCB0ZXh0ID0gKHBsYWNlaG9sZGVyLmhpZGRlbkNlbGxzLmxlbmd0aCA9PT0gMSkgP1xuXHRcdFx0bG9jYWxpemUoJ2hpZGRlbkNlbGwnLCAnezB9IGhpZGRlbiBjZWxsJywgcGxhY2Vob2xkZXIuaGlkZGVuQ2VsbHMubGVuZ3RoKSA6XG5cdFx0XHRsb2NhbGl6ZSgnaGlkZGVuQ2VsbHMnLCAnezB9IGhpZGRlbiBjZWxscycsIHBsYWNlaG9sZGVyLmhpZGRlbkNlbGxzLmxlbmd0aCk7XG5cdFx0dGVtcGxhdGVEYXRhLnBsYWNlaG9sZGVyLmlubmVyVGV4dCA9IHRleHQ7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlRGF0YS5wbGFjZWhvbGRlciwgJ2RibGNsaWNrJywgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiAhPT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRwbGFjZWhvbGRlci5zaG93SGlkZGVuQ2VsbHMoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGVtcGxhdGVEYXRhLm1hcmdpbk92ZXJsYXkub25BY3Rpb24oKCkgPT4gcGxhY2Vob2xkZXIuc2hvd0hpZGRlbkNlbGxzKCkpKTtcblx0XHR0ZW1wbGF0ZURhdGEubWFyZ2luT3ZlcmxheS5zaG93KCk7XG5cdH1cbn1cblxuY2xhc3MgUHJvcGVydHlIZWFkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJvdGVjdGVkIF9mb2xkaW5nSW5kaWNhdG9yITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfc3RhdHVzU3BhbiE6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX2Rlc2NyaXB0aW9uITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfdG9vbGJhciE6IFdvcmtiZW5jaFRvb2xCYXI7XG5cdHByb3RlY3RlZCBfbWVudSE6IElNZW51O1xuXHRwcm90ZWN0ZWQgX3Byb3BlcnR5RXhwYW5kZWQ/OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJvdGVjdGVkIF9wcm9wZXJ0eUNoYW5nZWQ/OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBjZWxsOiBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlLFxuXHRcdHJlYWRvbmx5IHByb3BlcnR5SGVhZGVyQ29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRyZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rVGV4dERpZmZFZGl0b3IsXG5cdFx0cmVhZG9ubHkgYWNjZXNzb3I6IHtcblx0XHRcdHVwZGF0ZUluZm9SZW5kZXJpbmc6IChyZW5kZXJPdXRwdXQ6IGJvb2xlYW4pID0+IHZvaWQ7XG5cdFx0XHRjaGVja0lmTW9kaWZpZWQ6ICgpID0+IGZhbHNlIHwgeyByZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXHRcdFx0Z2V0Rm9sZGluZ1N0YXRlOiAoKSA9PiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZTtcblx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZTogKG5ld1N0YXRlOiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZSkgPT4gdm9pZDtcblx0XHRcdHVuQ2hhbmdlZExhYmVsOiBzdHJpbmc7XG5cdFx0XHRjaGFuZ2VkTGFiZWw6IHN0cmluZztcblx0XHRcdHByZWZpeDogc3RyaW5nO1xuXHRcdFx0bWVudUlkOiBNZW51SWQ7XG5cdFx0fSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YnVpbGRIZWFkZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fZm9sZGluZ0luZGljYXRvciA9IERPTS5hcHBlbmQodGhpcy5wcm9wZXJ0eUhlYWRlckNvbnRhaW5lciwgRE9NLiQoJy5wcm9wZXJ0eS1mb2xkaW5nLWluZGljYXRvcicpKTtcblx0XHR0aGlzLl9mb2xkaW5nSW5kaWNhdG9yLmNsYXNzTGlzdC5hZGQodGhpcy5hY2Nlc3Nvci5wcmVmaXgpO1xuXHRcdGNvbnN0IG1ldGFkYXRhU3RhdHVzID0gRE9NLmFwcGVuZCh0aGlzLnByb3BlcnR5SGVhZGVyQ29udGFpbmVyLCBET00uJCgnZGl2LnByb3BlcnR5LXN0YXR1cycpKTtcblx0XHR0aGlzLl9zdGF0dXNTcGFuID0gRE9NLmFwcGVuZChtZXRhZGF0YVN0YXR1cywgRE9NLiQoJ3NwYW4nKSk7XG5cdFx0dGhpcy5fZGVzY3JpcHRpb24gPSBET00uYXBwZW5kKG1ldGFkYXRhU3RhdHVzLCBET00uJCgnc3Bhbi5wcm9wZXJ0eS1kZXNjcmlwdGlvbicpKTtcblxuXHRcdGNvbnN0IGNlbGxUb29sYmFyQ29udGFpbmVyID0gRE9NLmFwcGVuZCh0aGlzLnByb3BlcnR5SGVhZGVyQ29udGFpbmVyLCBET00uJCgnZGl2LnByb3BlcnR5LXRvb2xiYXInKSk7XG5cdFx0dGhpcy5fdG9vbGJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXb3JrYmVuY2hUb29sQmFyKGNlbGxUb29sYmFyQ29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IGl0ZW0gPSBuZXcgQ29kaWNvbkFjdGlvblZpZXdJdGVtKGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSwgdGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLnRoZW1lU2VydmljZSwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UpO1xuXHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9LCB0aGlzLm1lbnVTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwgdGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5jb21tYW5kU2VydmljZSwgdGhpcy50ZWxlbWV0cnlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fdG9vbGJhci5jb250ZXh0ID0gdGhpcy5jZWxsO1xuXG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChjZWxsVG9vbGJhckNvbnRhaW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Byb3BlcnR5Q2hhbmdlZCA9IE5PVEVCT09LX0RJRkZfQ0VMTF9QUk9QRVJUWS5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Byb3BlcnR5RXhwYW5kZWQgPSBOT1RFQk9PS19ESUZGX0NFTExfUFJPUEVSVFlfRVhQQU5ERUQuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX21lbnUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUodGhpcy5hY2Nlc3Nvci5tZW51SWQsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbWVudS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZU1lbnUoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0VkaXRvci5vbk1vdXNlVXAoZSA9PiB7XG5cdFx0XHRpZiAoIWUuZXZlbnQudGFyZ2V0IHx8IGUudGFyZ2V0ICE9PSB0aGlzLmNlbGwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0YXJnZXQgPSBlLmV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR0YXJnZXQgPT09IHRoaXMucHJvcGVydHlIZWFkZXJDb250YWluZXIgfHxcblx0XHRcdFx0dGFyZ2V0ID09PSB0aGlzLl9mb2xkaW5nSW5kaWNhdG9yIHx8IHRoaXMuX2ZvbGRpbmdJbmRpY2F0b3IuY29udGFpbnModGFyZ2V0KSB8fFxuXHRcdFx0XHR0YXJnZXQgPT09IG1ldGFkYXRhU3RhdHVzIHx8IG1ldGFkYXRhU3RhdHVzLmNvbnRhaW5zKHRhcmdldClcblx0XHRcdCkge1xuXHRcdFx0XHRjb25zdCBvbGRGb2xkaW5nU3RhdGUgPSB0aGlzLmFjY2Vzc29yLmdldEZvbGRpbmdTdGF0ZSgpO1xuXHRcdFx0XHR0aGlzLmFjY2Vzc29yLnVwZGF0ZUZvbGRpbmdTdGF0ZShvbGRGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkID8gUHJvcGVydHlGb2xkaW5nU3RhdGUuQ29sbGFwc2VkIDogUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVGb2xkaW5nSWNvbigpO1xuXHRcdFx0XHR0aGlzLmFjY2Vzc29yLnVwZGF0ZUluZm9SZW5kZXJpbmcodGhpcy5jZWxsLnJlbmRlck91dHB1dCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0dGhpcy5hY2Nlc3Nvci51cGRhdGVJbmZvUmVuZGVyaW5nKHRoaXMuY2VsbC5yZW5kZXJPdXRwdXQpO1xuXHR9XG5cdHJlZnJlc2goKSB7XG5cdFx0dGhpcy51cGRhdGVNZW51KCk7XG5cdFx0dGhpcy5fdXBkYXRlRm9sZGluZ0ljb24oKTtcblxuXHRcdGNvbnN0IG1ldGFkYXRhQ2hhbmdlZCA9IHRoaXMuYWNjZXNzb3IuY2hlY2tJZk1vZGlmaWVkKCk7XG5cdFx0aWYgKHRoaXMuX3Byb3BlcnR5Q2hhbmdlZCkge1xuXHRcdFx0dGhpcy5fcHJvcGVydHlDaGFuZ2VkLnNldCghIW1ldGFkYXRhQ2hhbmdlZCk7XG5cdFx0fVxuXHRcdGlmIChtZXRhZGF0YUNoYW5nZWQpIHtcblx0XHRcdHRoaXMuX3N0YXR1c1NwYW4udGV4dENvbnRlbnQgPSB0aGlzLmFjY2Vzc29yLmNoYW5nZWRMYWJlbDtcblx0XHRcdHRoaXMuX3N0YXR1c1NwYW4uc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcblx0XHRcdGlmIChtZXRhZGF0YUNoYW5nZWQucmVhc29uKSB7XG5cdFx0XHRcdHRoaXMuX2Rlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gbWV0YWRhdGFDaGFuZ2VkLnJlYXNvbjtcblx0XHRcdH1cblx0XHRcdHRoaXMucHJvcGVydHlIZWFkZXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9kaWZpZWQnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3RhdHVzU3Bhbi50ZXh0Q29udGVudCA9IHRoaXMuYWNjZXNzb3IudW5DaGFuZ2VkTGFiZWw7XG5cdFx0XHR0aGlzLl9zdGF0dXNTcGFuLnN0eWxlLmZvbnRXZWlnaHQgPSAnbm9ybWFsJztcblx0XHRcdHRoaXMuX2Rlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHR0aGlzLnByb3BlcnR5SGVhZGVyQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ21vZGlmaWVkJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVNZW51KCkge1xuXHRcdGNvbnN0IG1ldGFkYXRhQ2hhbmdlZCA9IHRoaXMuYWNjZXNzb3IuY2hlY2tJZk1vZGlmaWVkKCk7XG5cdFx0aWYgKG1ldGFkYXRhQ2hhbmdlZCkge1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKHRoaXMuX21lbnUuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pKTtcblx0XHRcdHRoaXMuX3Rvb2xiYXIuc2V0QWN0aW9ucyhhY3Rpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdG9vbGJhci5zZXRBY3Rpb25zKFtdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVGb2xkaW5nSWNvbigpIHtcblx0XHRpZiAodGhpcy5hY2Nlc3Nvci5nZXRGb2xkaW5nU3RhdGUoKSA9PT0gUHJvcGVydHlGb2xkaW5nU3RhdGUuQ29sbGFwc2VkKSB7XG5cdFx0XHRET00ucmVzZXQodGhpcy5fZm9sZGluZ0luZGljYXRvciwgcmVuZGVySWNvbihjb2xsYXBzZWRJY29uKSk7XG5cdFx0XHR0aGlzLl9wcm9wZXJ0eUV4cGFuZGVkPy5zZXQoZmFsc2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRET00ucmVzZXQodGhpcy5fZm9sZGluZ0luZGljYXRvciwgcmVuZGVySWNvbihleHBhbmRlZEljb24pKTtcblx0XHRcdHRoaXMuX3Byb3BlcnR5RXhwYW5kZWQ/LnNldCh0cnVlKTtcblx0XHR9XG5cblx0fVxufVxuXG5pbnRlcmZhY2UgSURpZmZFbGVtZW50TGF5b3V0U3RhdGUge1xuXHRvdXRlcldpZHRoPzogYm9vbGVhbjtcblx0ZWRpdG9ySGVpZ2h0PzogYm9vbGVhbjtcblx0bWV0YWRhdGFFZGl0b3I/OiBib29sZWFuO1xuXHRtZXRhZGF0YUhlaWdodD86IGJvb2xlYW47XG5cdG91dHB1dFRvdGFsSGVpZ2h0PzogYm9vbGVhbjtcbn1cblxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhRWxlbWVudCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IERpZmZFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX3Rvb2xiYXIhOiBUb29sQmFyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jZWxsSGVhZGVyQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfY2VsbEhlYWRlciE6IFByb3BlcnR5SGVhZGVyO1xuXHRwcml2YXRlIF9kaWZmRWRpdG9yQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va1RleHREaWZmRWRpdG9yLFxuXHRcdHJlYWRvbmx5IHZpZXdNb2RlbDogTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVmlld01vZGVsLFxuXHRcdHJlYWRvbmx5IHRlbXBsYXRlRGF0YTogTm90ZWJvb2tEb2N1bWVudERpZmZFbGVtZW50UmVuZGVyVGVtcGxhdGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2VkaXRvciA9IHRlbXBsYXRlRGF0YS5zb3VyY2VFZGl0b3I7XG5cdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLmNlbGxIZWFkZXJDb250YWluZXI7XG5cdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yQ29udGFpbmVyO1xuXHRcdHRoaXMuX2RpZmZFZGl0b3JDb250YWluZXIgPSB0aGlzLnRlbXBsYXRlRGF0YS5kaWZmRWRpdG9yQ29udGFpbmVyO1xuXG5cdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlQ2hhbmdlZCA9IGZhbHNlO1xuXHRcdC8vIGluaXRcblx0XHR0aGlzLl9yZWdpc3Rlcih2aWV3TW9kZWwub25EaWRMYXlvdXRDaGFuZ2UoZSA9PiB7XG5cdFx0XHR0aGlzLmxheW91dChlKTtcblx0XHRcdHRoaXMudXBkYXRlQm9yZGVycygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmJ1aWxkQm9keSgpO1xuXHRcdHRoaXMudXBkYXRlQm9yZGVycygpO1xuXHR9XG5cblx0YnVpbGRCb2R5KCk6IHZvaWQge1xuXHRcdGNvbnN0IGJvZHkgPSB0aGlzLnRlbXBsYXRlRGF0YS5ib2R5O1xuXHRcdGJvZHkuY2xhc3NMaXN0LnJlbW92ZSgnZnVsbCcpO1xuXHRcdGJvZHkuY2xhc3NMaXN0LmFkZCgnZnVsbCcpO1xuXG5cdFx0dGhpcy51cGRhdGVTb3VyY2VFZGl0b3IoKTtcblxuXHRcdGlmICh0aGlzLnZpZXdNb2RlbCBpbnN0YW5jZW9mIE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YVZpZXdNb2RlbCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3TW9kZWwubW9kaWZpZWRNZXRhZGF0YS5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0dGhpcy5fY2VsbEhlYWRlci5yZWZyZXNoKCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cdHByb3RlY3RlZCBsYXlvdXROb3RlYm9va0NlbGwoKSB7XG5cdFx0dGhpcy5ub3RlYm9va0VkaXRvci5sYXlvdXROb3RlYm9va0NlbGwoXG5cdFx0XHR0aGlzLnZpZXdNb2RlbCxcblx0XHRcdHRoaXMudmlld01vZGVsLmxheW91dEluZm8udG90YWxIZWlnaHRcblx0XHQpO1xuXHR9XG5cblx0dXBkYXRlQm9yZGVycygpIHtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5sZWZ0Qm9yZGVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMudmlld01vZGVsLmxheW91dEluZm8udG90YWxIZWlnaHQgLSAzMn1weGA7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEucmlnaHRCb3JkZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy52aWV3TW9kZWwubGF5b3V0SW5mby50b3RhbEhlaWdodCAtIDMyfXB4YDtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5ib3R0b21Cb3JkZXIuc3R5bGUudG9wID0gYCR7dGhpcy52aWV3TW9kZWwubGF5b3V0SW5mby50b3RhbEhlaWdodCAtIDMyfXB4YDtcblx0fVxuXHR1cGRhdGVTb3VyY2VFZGl0b3IoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdHRoaXMuX2NlbGxIZWFkZXJDb250YWluZXIuaW5uZXJUZXh0ID0gJyc7XG5cdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2RpZmYnKTtcblxuXHRcdGNvbnN0IHVwZGF0ZVNvdXJjZUVkaXRvciA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnZpZXdNb2RlbC5jZWxsRm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdHRoaXMudmlld01vZGVsLmVkaXRvckhlaWdodCA9IDA7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmZvbnRJbmZvLmxpbmVIZWlnaHQgfHwgMTc7XG5cdFx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLnZpZXdNb2RlbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCAhPT0gMCA/IHRoaXMudmlld01vZGVsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0IDogdGhpcy52aWV3TW9kZWwuY29tcHV0ZUlucHV0RWRpdG9ySGVpZ2h0KGxpbmVIZWlnaHQpO1xuXG5cdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7ZWRpdG9ySGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuXHRcdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRpZiAoY29udGVudEhlaWdodCA+PSAwKSB7XG5cdFx0XHRcdHRoaXMudmlld01vZGVsLmVkaXRvckhlaWdodCA9IGNvbnRlbnRIZWlnaHQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZWRpdG9ySGVpZ2h0O1xuXHRcdH07XG5cdFx0Y29uc3QgcmVuZGVyU291cmNlRWRpdG9yID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gdXBkYXRlU291cmNlRWRpdG9yKCk7XG5cdFx0XHRpZiAoIWVkaXRvckhlaWdodCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRoZXJlIGlzIG9ubHkgMSBsaW5lLCB0aGVuIGVuc3VyZSB3ZSBoYXZlIHRoZSBuZWNlc3NhcnkgcGFkZGluZyB0byBkaXNwbGF5IHRoZSBidXR0b24gZm9yIHdoaXRlc3BhY2VzLlxuXHRcdFx0Ly8gRS5nLiBhc3N1bWUgd2UgaGF2ZSBhIGNlbGwgd2l0aCAxIGxpbmUgYW5kIHdlIGFkZCBzb21lIHdoaXRlc3BhY2UsXG5cdFx0XHQvLyBUaGVuIGRpZmYgZWRpdG9yIGRpc3BsYXlzIHRoZSBidXR0b24gYFNob3cgV2hpdGVzcGFjZSBEaWZmZXJlbmNlc2AsIGhvd2V2ZXIgd2l0aCAxMiBwYWRkaW5ncyBvbiB0aGUgdG9wLCB0aGVcblx0XHRcdC8vIGJ1dHRvbiBjYW4gZ2V0IGN1dCBvZmYuXG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLnZpZXdNb2RlbC5tb2RpZmllZE1ldGFkYXRhLnRleHRCdWZmZXIuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHRjb25zdCBvcHRpb25zOiBJRGlmZkVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRcdHBhZGRpbmc6IGdldEVkaXRvclBhZGRpbmcobGluZUNvdW50KVxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHVuY2hhbmdlZFJlZ2lvbnMgPSB0aGlzLl9yZWdpc3RlcihnZXRVbmNoYW5nZWRSZWdpb25TZXR0aW5ncyh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0XHRpZiAodW5jaGFuZ2VkUmVnaW9ucy5vcHRpb25zLmVuYWJsZWQpIHtcblx0XHRcdFx0b3B0aW9ucy5oaWRlVW5jaGFuZ2VkUmVnaW9ucyA9IHVuY2hhbmdlZFJlZ2lvbnMub3B0aW9ucztcblx0XHRcdH1cblx0XHRcdHRoaXMuX2VkaXRvci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodW5jaGFuZ2VkUmVnaW9ucy5vbkRpZENoYW5nZUVuYWJsZW1lbnQoKCkgPT4ge1xuXHRcdFx0XHRvcHRpb25zLmhpZGVVbmNoYW5nZWRSZWdpb25zID0gdW5jaGFuZ2VkUmVnaW9ucy5vcHRpb25zO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoe1xuXHRcdFx0XHR3aWR0aDogdGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGggLSAyICogRElGRl9DRUxMX01BUkdJTixcblx0XHRcdFx0aGVpZ2h0OiBlZGl0b3JIZWlnaHRcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ29udGVudFNpemVDaGFuZ2UoKGUpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudmlld01vZGVsLmNlbGxGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkICYmIGUuY29udGVudEhlaWdodENoYW5nZWQgJiYgdGhpcy52aWV3TW9kZWwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQgIT09IGUuY29udGVudEhlaWdodCkge1xuXHRcdFx0XHRcdHRoaXMudmlld01vZGVsLmVkaXRvckhlaWdodCA9IGUuY29udGVudEhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5faW5pdGlhbGl6ZVNvdXJjZURpZmZFZGl0b3IoKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fY2VsbEhlYWRlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRQcm9wZXJ0eUhlYWRlcixcblx0XHRcdHRoaXMudmlld01vZGVsLFxuXHRcdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lcixcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IsXG5cdFx0XHR7XG5cdFx0XHRcdHVwZGF0ZUluZm9SZW5kZXJpbmc6ICgpID0+IHJlbmRlclNvdXJjZUVkaXRvcigpLFxuXHRcdFx0XHRjaGVja0lmTW9kaWZpZWQ6ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWwub3JpZ2luYWxNZXRhZGF0YS5nZXRIYXNoKCkgIT09IHRoaXMudmlld01vZGVsLm1vZGlmaWVkTWV0YWRhdGEuZ2V0SGFzaCgpID8geyByZWFzb246IHVuZGVmaW5lZCB9IDogZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldEZvbGRpbmdTdGF0ZTogKCkgPT4gdGhpcy52aWV3TW9kZWwuY2VsbEZvbGRpbmdTdGF0ZSxcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlOiAoc3RhdGUpID0+IHRoaXMudmlld01vZGVsLmNlbGxGb2xkaW5nU3RhdGUgPSBzdGF0ZSxcblx0XHRcdFx0dW5DaGFuZ2VkTGFiZWw6ICdOb3RlYm9vayBNZXRhZGF0YScsXG5cdFx0XHRcdGNoYW5nZWRMYWJlbDogJ05vdGVib29rIE1ldGFkYXRhIGNoYW5nZWQnLFxuXHRcdFx0XHRwcmVmaXg6ICdtZXRhZGF0YScsXG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rRGlmZkRvY3VtZW50TWV0YWRhdGFcblx0XHRcdH1cblx0XHQpKTtcblx0XHR0aGlzLl9jZWxsSGVhZGVyLmJ1aWxkSGVhZGVyKCk7XG5cdFx0cmVuZGVyU291cmNlRWRpdG9yKCk7XG5cblx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMudGVtcGxhdGVEYXRhLmlucHV0VG9vbGJhckNvbnRhaW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0Q2hhbmdlZCA9IE5PVEVCT09LX0RJRkZfTUVUQURBVEEuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpbnB1dENoYW5nZWQuc2V0KHRoaXMudmlld01vZGVsLm9yaWdpbmFsTWV0YWRhdGEuZ2V0SGFzaCgpICE9PSB0aGlzLnZpZXdNb2RlbC5tb2RpZmllZE1ldGFkYXRhLmdldEhhc2goKSk7XG5cblx0XHR0aGlzLl90b29sYmFyID0gdGhpcy50ZW1wbGF0ZURhdGEudG9vbGJhcjtcblxuXHRcdHRoaXMuX3Rvb2xiYXIuY29udGV4dCA9IHRoaXMudmlld01vZGVsO1xuXG5cdFx0Y29uc3QgcmVmcmVzaFRvb2xiYXIgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXNDaGFuZ2VzID0gdGhpcy52aWV3TW9kZWwub3JpZ2luYWxNZXRhZGF0YS5nZXRIYXNoKCkgIT09IHRoaXMudmlld01vZGVsLm1vZGlmaWVkTWV0YWRhdGEuZ2V0SGFzaCgpO1xuXHRcdFx0aW5wdXRDaGFuZ2VkLnNldChoYXNDaGFuZ2VzKTtcblxuXHRcdFx0aWYgKGhhc0NoYW5nZXMpIHtcblx0XHRcdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLk5vdGVib29rRGlmZkRvY3VtZW50TWV0YWRhdGEsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pO1xuXHRcdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMobWVudSk7XG5cdFx0XHRcdHRoaXMuX3Rvb2xiYXIuc2V0QWN0aW9ucyhhY3Rpb25zKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3Rvb2xiYXIuc2V0QWN0aW9ucyhbXSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld01vZGVsLm1vZGlmaWVkTWV0YWRhdGEub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0cmVmcmVzaFRvb2xiYXIoKTtcblx0XHR9KSk7XG5cdFx0cmVmcmVzaFRvb2xiYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2luaXRpYWxpemVTb3VyY2VEaWZmRWRpdG9yKCkge1xuXHRcdGNvbnN0IFtvcmlnaW5hbFJlZiwgbW9kaWZpZWRSZWZdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHRoaXMudmlld01vZGVsLm9yaWdpbmFsTWV0YWRhdGEudXJpKSxcblx0XHRcdHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZSh0aGlzLnZpZXdNb2RlbC5tb2RpZmllZE1ldGFkYXRhLnVyaSldKTtcblxuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRvcmlnaW5hbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob3JpZ2luYWxSZWYpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGlmaWVkUmVmKTtcblxuXHRcdGNvbnN0IHZtID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLmNyZWF0ZVZpZXdNb2RlbCh7XG5cdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCxcblx0XHRcdG1vZGlmaWVkOiBtb2RpZmllZFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLFxuXHRcdH0pKTtcblxuXHRcdC8vIFJlZHVjZXMgZmxpY2tlciAoY29tcHV0ZSB0aGlzIGJlZm9yZSBzZXR0aW5nIHRoZSBtb2RlbClcblx0XHQvLyBFbHNlIHdoZW4gdGhlIG1vZGVsIGlzIHNldCwgdGhlIGhlaWdodCBvZiB0aGUgZWRpdG9yIHdpbGwgYmUgeCwgYWZ0ZXIgZGlmZiBpcyBjb21wdXRlZCwgdGhlbiBoZWlnaHQgd2lsbCBiZSB5LlxuXHRcdC8vICYgdGhhdCByZXN1bHRzIGluIGZsaWNrZXIuXG5cdFx0YXdhaXQgdm0ud2FpdEZvckRpZmYoKTtcblx0XHR0aGlzLl9lZGl0b3Iuc2V0TW9kZWwodm0pO1xuXG5cdFx0Y29uc3QgaGFuZGxlVmlld1N0YXRlQ2hhbmdlID0gKCkgPT4ge1xuXHRcdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlQ2hhbmdlZCA9IHRydWU7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGhhbmRsZVNjcm9sbENoYW5nZSA9IChlOiBlZGl0b3JDb21tb24uSVNjcm9sbEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3BDaGFuZ2VkIHx8IGUuc2Nyb2xsTGVmdENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMudXBkYXRlRWRpdG9yT3B0aW9uc0ZvcldoaXRlc3BhY2UoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IuZ2V0T3JpZ2luYWxFZGl0b3IoKS5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbihoYW5kbGVWaWV3U3RhdGVDaGFuZ2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IuZ2V0T3JpZ2luYWxFZGl0b3IoKS5vbkRpZFNjcm9sbENoYW5nZShoYW5kbGVTY3JvbGxDaGFuZ2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKS5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbihoYW5kbGVWaWV3U3RhdGVDaGFuZ2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKS5vbkRpZFNjcm9sbENoYW5nZShoYW5kbGVTY3JvbGxDaGFuZ2UpKTtcblxuXHRcdGNvbnN0IGVkaXRvclZpZXdTdGF0ZSA9IHRoaXMudmlld01vZGVsLmdldFNvdXJjZUVkaXRvclZpZXdTdGF0ZSgpIGFzIGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGw7XG5cdFx0aWYgKGVkaXRvclZpZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUoZWRpdG9yVmlld1N0YXRlKTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGhpcy5fZWRpdG9yLmdldENvbnRlbnRIZWlnaHQoKTtcblx0XHR0aGlzLnZpZXdNb2RlbC5lZGl0b3JIZWlnaHQgPSBjb250ZW50SGVpZ2h0O1xuXHR9XG5cdHByaXZhdGUgdXBkYXRlRWRpdG9yT3B0aW9uc0ZvcldoaXRlc3BhY2UoKSB7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fZWRpdG9yO1xuXHRcdGNvbnN0IHVyaSA9IGVkaXRvci5nZXRNb2RlbCgpPy5tb2RpZmllZC51cmkgfHwgZWRpdG9yLmdldE1vZGVsKCk/Lm9yaWdpbmFsLnVyaTtcblx0XHRpZiAoIXVyaSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpZ25vcmVUcmltV2hpdGVzcGFjZSA9IHRoaXMudGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHVyaSwgJ2RpZmZFZGl0b3IuaWdub3JlVHJpbVdoaXRlc3BhY2UnKTtcblx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlIH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0Q29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odXJpLCAnZGlmZkVkaXRvcicpICYmXG5cdFx0XHRcdGUuYWZmZWN0ZWRLZXlzLmhhcygnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpKSB7XG5cdFx0XHRcdGNvbnN0IGlnbm9yZVRyaW1XaGl0ZXNwYWNlID0gdGhpcy50ZXh0Q29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4odXJpLCAnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpO1xuXHRcdFx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXHRsYXlvdXQoc3RhdGU6IElEaWZmRWxlbWVudExheW91dFN0YXRlKSB7XG5cdFx0RE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyh0aGlzLl9kaWZmRWRpdG9yQ29udGFpbmVyKSwgKCkgPT4ge1xuXHRcdFx0aWYgKHN0YXRlLmVkaXRvckhlaWdodCkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy52aWV3TW9kZWwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHR9cHhgO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IubGF5b3V0KHtcblx0XHRcdFx0XHR3aWR0aDogdGhpcy5fZWRpdG9yLmdldFZpZXdXaWR0aCgpLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy52aWV3TW9kZWwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS5vdXRlcldpZHRoKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLnZpZXdNb2RlbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodH1weGA7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5sYXlvdXROb3RlYm9va0NlbGwoKTtcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fZWRpdG9yLnNldE1vZGVsKG51bGwpO1xuXG5cdFx0aWYgKHRoaXMuX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQpIHtcblx0XHRcdHRoaXMudmlld01vZGVsLnNhdmVTcGlyY2VFZGl0b3JWaWV3U3RhdGUodGhpcy5fZWRpdG9yLnNhdmVWaWV3U3RhdGUoKSk7XG5cdFx0fVxuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RFbGVtZW50UmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9tZXRhZGF0YUxvY2FsRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb3V0cHV0TG9jYWxEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJvdGVjdGVkIF9pZ25vcmVNZXRhZGF0YTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcm90ZWN0ZWQgX2lnbm9yZU91dHB1dHM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJvdGVjdGVkIF9jZWxsSGVhZGVyQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfZWRpdG9yQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfY2VsbEhlYWRlciE6IFByb3BlcnR5SGVhZGVyO1xuXHRwcm90ZWN0ZWQgX21ldGFkYXRhSGVhZGVyQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfbWV0YWRhdGFIZWFkZXIhOiBQcm9wZXJ0eUhlYWRlcjtcblx0cHJvdGVjdGVkIF9tZXRhZGF0YUluZm9Db250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJvdGVjdGVkIF9tZXRhZGF0YUVkaXRvckNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlITogRGlzcG9zYWJsZVN0b3JlO1xuXHRwcm90ZWN0ZWQgX21ldGFkYXRhRWRpdG9yPzogQ29kZUVkaXRvcldpZGdldCB8IERpZmZFZGl0b3JXaWRnZXQ7XG5cblx0cHJvdGVjdGVkIF9vdXRwdXRIZWFkZXJDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJvdGVjdGVkIF9vdXRwdXRIZWFkZXIhOiBQcm9wZXJ0eUhlYWRlcjtcblx0cHJvdGVjdGVkIF9vdXRwdXRJbmZvQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfb3V0cHV0RWRpdG9yQ29udGFpbmVyPzogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfb3V0cHV0Vmlld0NvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX291dHB1dExlZnRDb250YWluZXI/OiBIVE1MRWxlbWVudDtcblx0cHJvdGVjdGVkIF9vdXRwdXRSaWdodENvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX291dHB1dE1ldGFkYXRhQ29udGFpbmVyPzogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfb3V0cHV0RW1wdHlFbGVtZW50PzogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfb3V0cHV0TGVmdFZpZXc/OiBPdXRwdXRDb250YWluZXI7XG5cdHByb3RlY3RlZCBfb3V0cHV0UmlnaHRWaWV3PzogT3V0cHV0Q29udGFpbmVyO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZSE6IERpc3Bvc2FibGVTdG9yZTtcblx0cHJvdGVjdGVkIF9vdXRwdXRFZGl0b3I/OiBDb2RlRWRpdG9yV2lkZ2V0IHwgRGlmZkVkaXRvcldpZGdldDtcblx0cHJvdGVjdGVkIF9vdXRwdXRNZXRhZGF0YUVkaXRvcj86IERpZmZFZGl0b3JXaWRnZXQ7XG5cblx0cHJvdGVjdGVkIF9kaWZmRWRpdG9yQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfZGlhZ29uYWxGaWxsPzogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfaXNEaXNwb3NlZDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rVGV4dERpZmZFZGl0b3IsXG5cdFx0cmVhZG9ubHkgY2VsbDogRGlmZkVsZW1lbnRDZWxsVmlld01vZGVsQmFzZSxcblx0XHRyZWFkb25seSB0ZW1wbGF0ZURhdGE6IENlbGxEaWZmU2luZ2xlU2lkZVJlbmRlclRlbXBsYXRlIHwgQ2VsbERpZmZTaWRlQnlTaWRlUmVuZGVyVGVtcGxhdGUsXG5cdFx0cmVhZG9ubHkgc3R5bGU6ICdsZWZ0JyB8ICdyaWdodCcgfCAnZnVsbCcsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgdGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHQvLyBpbml0XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHR0aGlzLl9vdXRwdXRFZGl0b3JEaXNwb3NlU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNlbGwub25EaWRMYXlvdXRDaGFuZ2UoZSA9PiB7XG5cdFx0XHR0aGlzLmxheW91dChlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2VsbC5vbkRpZExheW91dENoYW5nZShlID0+IHRoaXMudXBkYXRlQm9yZGVycygpKSk7XG5cdFx0dGhpcy5pbml0KCk7XG5cdFx0dGhpcy5idWlsZEJvZHkoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNlbGwub25EaWRTdGF0ZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZU91dHB1dFJlbmRlcmluZyh0aGlzLmNlbGwucmVuZGVyT3V0cHV0KTtcblx0XHR9KSk7XG5cdH1cblxuXHRhYnN0cmFjdCBpbml0KCk6IHZvaWQ7XG5cdGFic3RyYWN0IHN0eWxlQ29udGFpbmVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkO1xuXHRhYnN0cmFjdCBfYnVpbGRPdXRwdXQoKTogdm9pZDtcblx0YWJzdHJhY3QgX2Rpc3Bvc2VPdXRwdXQoKTogdm9pZDtcblx0YWJzdHJhY3QgX2J1aWxkTWV0YWRhdGEoKTogdm9pZDtcblx0YWJzdHJhY3QgX2Rpc3Bvc2VNZXRhZGF0YSgpOiB2b2lkO1xuXG5cdGJ1aWxkQm9keSgpOiB2b2lkIHtcblx0XHRjb25zdCBib2R5ID0gdGhpcy50ZW1wbGF0ZURhdGEuYm9keTtcblx0XHR0aGlzLl9kaWZmRWRpdG9yQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEuZGlmZkVkaXRvckNvbnRhaW5lcjtcblx0XHRib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ2xlZnQnLCAncmlnaHQnLCAnZnVsbCcpO1xuXHRcdHN3aXRjaCAodGhpcy5zdHlsZSkge1xuXHRcdFx0Y2FzZSAnbGVmdCc6XG5cdFx0XHRcdGJvZHkuY2xhc3NMaXN0LmFkZCgnbGVmdCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3JpZ2h0Jzpcblx0XHRcdFx0Ym9keS5jbGFzc0xpc3QuYWRkKCdyaWdodCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJvZHkuY2xhc3NMaXN0LmFkZCgnZnVsbCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHR0aGlzLnN0eWxlQ29udGFpbmVyKHRoaXMuX2RpZmZFZGl0b3JDb250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlU291cmNlRWRpdG9yKCk7XG5cdFx0aWYgKHRoaXMuY2VsbC5tb2RpZmllZCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jZWxsLm1vZGlmaWVkLnRleHRNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gdGhpcy5fY2VsbEhlYWRlci5yZWZyZXNoKCkpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9pZ25vcmVNZXRhZGF0YSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ25vdGVib29rLmRpZmYuaWdub3JlTWV0YWRhdGEnKTtcblx0XHRpZiAodGhpcy5faWdub3JlTWV0YWRhdGEpIHtcblx0XHRcdHRoaXMuX2Rpc3Bvc2VNZXRhZGF0YSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9idWlsZE1ldGFkYXRhKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faWdub3JlT3V0cHV0cyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpIHx8ICEhKHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMpO1xuXHRcdGlmICh0aGlzLl9pZ25vcmVPdXRwdXRzKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NlT3V0cHV0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2J1aWxkT3V0cHV0KCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRsZXQgbWV0YWRhdGFMYXlvdXRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGxldCBvdXRwdXRMYXlvdXRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdub3RlYm9vay5kaWZmLmlnbm9yZU1ldGFkYXRhJykpIHtcblx0XHRcdFx0Y29uc3QgbmV3VmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdub3RlYm9vay5kaWZmLmlnbm9yZU1ldGFkYXRhJyk7XG5cblx0XHRcdFx0aWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgdGhpcy5faWdub3JlTWV0YWRhdGEgIT09IG5ld1ZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5faWdub3JlTWV0YWRhdGEgPSBuZXdWYWx1ZTtcblxuXHRcdFx0XHRcdHRoaXMuX21ldGFkYXRhTG9jYWxEaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ25vdGVib29rLmRpZmYuaWdub3JlTWV0YWRhdGEnKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZGlzcG9zZU1ldGFkYXRhKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuY2VsbC5tZXRhZGF0YVN0YXR1c0hlaWdodCA9IDI1O1xuXHRcdFx0XHRcdFx0dGhpcy5fYnVpbGRNZXRhZGF0YSgpO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVNZXRhZGF0YVJlbmRlcmluZygpO1xuXHRcdFx0XHRcdFx0bWV0YWRhdGFMYXlvdXRDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignbm90ZWJvb2suZGlmZi5pZ25vcmVPdXRwdXRzJykpIHtcblx0XHRcdFx0Y29uc3QgbmV3VmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdub3RlYm9vay5kaWZmLmlnbm9yZU91dHB1dHMnKTtcblxuXHRcdFx0XHRpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiB0aGlzLl9pZ25vcmVPdXRwdXRzICE9PSAobmV3VmFsdWUgfHwgdGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWw/LnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50T3V0cHV0cykpIHtcblx0XHRcdFx0XHR0aGlzLl9pZ25vcmVPdXRwdXRzID0gbmV3VmFsdWUgfHwgISEodGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWw/LnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50T3V0cHV0cyk7XG5cblx0XHRcdFx0XHR0aGlzLl9vdXRwdXRMb2NhbERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0XHRpZiAodGhpcy5faWdub3JlT3V0cHV0cykge1xuXHRcdFx0XHRcdFx0dGhpcy5fZGlzcG9zZU91dHB1dCgpO1xuXHRcdFx0XHRcdFx0dGhpcy5jZWxsLmxheW91dENoYW5nZSgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNlbGwub3V0cHV0U3RhdHVzSGVpZ2h0ID0gMjU7XG5cdFx0XHRcdFx0XHR0aGlzLl9idWlsZE91dHB1dCgpO1xuXHRcdFx0XHRcdFx0b3V0cHV0TGF5b3V0Q2hhbmdlID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG1ldGFkYXRhTGF5b3V0Q2hhbmdlIHx8IG91dHB1dExheW91dENoYW5nZSkge1xuXHRcdFx0XHR0aGlzLmxheW91dCh7IG1ldGFkYXRhSGVpZ2h0OiBtZXRhZGF0YUxheW91dENoYW5nZSwgb3V0cHV0VG90YWxIZWlnaHQ6IG91dHB1dExheW91dENoYW5nZSB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHR1cGRhdGVNZXRhZGF0YVJlbmRlcmluZygpIHtcblx0XHRpZiAodGhpcy5jZWxsLm1ldGFkYXRhRm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5FeHBhbmRlZCkge1xuXHRcdFx0Ly8gd2Ugc2hvdWxkIGV4cGFuZCB0aGUgbWV0YWRhdGEgZWRpdG9yXG5cdFx0XHR0aGlzLl9tZXRhZGF0YUluZm9Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRcdGlmICghdGhpcy5fbWV0YWRhdGFFZGl0b3JDb250YWluZXIgfHwgIXRoaXMuX21ldGFkYXRhRWRpdG9yKSB7XG5cdFx0XHRcdC8vIGNyZWF0ZSBlZGl0b3Jcblx0XHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX21ldGFkYXRhSW5mb0NvbnRhaW5lciwgRE9NLiQoJy5tZXRhZGF0YS1lZGl0b3ItY29udGFpbmVyJykpO1xuXHRcdFx0XHR0aGlzLl9idWlsZE1ldGFkYXRhRWRpdG9yKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFIZWlnaHQgPSB0aGlzLl9tZXRhZGF0YUVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHdlIHNob3VsZCBjb2xsYXBzZSB0aGUgbWV0YWRhdGEgZWRpdG9yXG5cdFx0XHR0aGlzLl9tZXRhZGF0YUluZm9Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdC8vIHRoaXMuX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlLmNsZWFyKCk7XG5cdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFIZWlnaHQgPSAwO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZU91dHB1dFJlbmRlcmluZyhyZW5kZXJSaWNoT3V0cHV0OiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuY2VsbC5vdXRwdXRGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkKSB7XG5cdFx0XHR0aGlzLl9vdXRwdXRJbmZvQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0aWYgKHJlbmRlclJpY2hPdXRwdXQpIHtcblx0XHRcdFx0dGhpcy5faGlkZU91dHB1dHNSYXcoKTtcblx0XHRcdFx0dGhpcy5fYnVpbGRPdXRwdXRSZW5kZXJlckNvbnRhaW5lcigpO1xuXHRcdFx0XHR0aGlzLl9zaG93T3V0cHV0c1JlbmRlcmVyKCk7XG5cdFx0XHRcdHRoaXMuX3Nob3dPdXRwdXRzRW1wdHlWaWV3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9oaWRlT3V0cHV0c1JlbmRlcmVyKCk7XG5cdFx0XHRcdHRoaXMuX2J1aWxkT3V0cHV0UmF3Q29udGFpbmVyKCk7XG5cdFx0XHRcdHRoaXMuX3Nob3dPdXRwdXRzUmF3KCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX291dHB1dEluZm9Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdFx0dGhpcy5faGlkZU91dHB1dHNSYXcoKTtcblx0XHRcdHRoaXMuX2hpZGVPdXRwdXRzUmVuZGVyZXIoKTtcblx0XHRcdHRoaXMuX2hpZGVPdXRwdXRzRW1wdHlWaWV3KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYnVpbGRPdXRwdXRSYXdDb250YWluZXIoKSB7XG5cdFx0aWYgKCF0aGlzLl9vdXRwdXRFZGl0b3JDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5fb3V0cHV0SW5mb0NvbnRhaW5lciwgRE9NLiQoJy5vdXRwdXQtZWRpdG9yLWNvbnRhaW5lcicpKTtcblx0XHRcdHRoaXMuX2J1aWxkT3V0cHV0RWRpdG9yKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd091dHB1dHNSYXcoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0dGhpcy5jZWxsLnJhd091dHB1dEhlaWdodCA9IHRoaXMuX291dHB1dEVkaXRvciEuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3dPdXRwdXRzRW1wdHlWaWV3KCkge1xuXHRcdHRoaXMuY2VsbC5sYXlvdXRDaGFuZ2UoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfaGlkZU91dHB1dHNSYXcoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLmNlbGwucmF3T3V0cHV0SGVpZ2h0ID0gMDtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2hpZGVPdXRwdXRzRW1wdHlWaWV3KCkge1xuXHRcdHRoaXMuY2VsbC5sYXlvdXRDaGFuZ2UoKTtcblx0fVxuXG5cdGFic3RyYWN0IF9idWlsZE91dHB1dFJlbmRlcmVyQ29udGFpbmVyKCk6IHZvaWQ7XG5cdGFic3RyYWN0IF9oaWRlT3V0cHV0c1JlbmRlcmVyKCk6IHZvaWQ7XG5cdGFic3RyYWN0IF9zaG93T3V0cHV0c1JlbmRlcmVyKCk6IHZvaWQ7XG5cblx0cHJpdmF0ZSBfYXBwbHlTYW5pdGl6ZWRNZXRhZGF0YUNoYW5nZXMoY3VycmVudE1ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YSwgbmV3TWV0YWRhdGE6IGFueSkge1xuXHRcdGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBuZXdNZXRhZGF0YU9iaiA9IEpTT04ucGFyc2UobmV3TWV0YWRhdGEpO1xuXHRcdFx0Y29uc3Qga2V5cyA9IG5ldyBTZXQoWy4uLk9iamVjdC5rZXlzKG5ld01ldGFkYXRhT2JqKV0pO1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0XHRzd2l0Y2ggKGtleSBhcyBrZXlvZiBOb3RlYm9va0NlbGxNZXRhZGF0YSkge1xuXHRcdFx0XHRcdGNhc2UgJ2lucHV0Q29sbGFwc2VkJzpcblx0XHRcdFx0XHRjYXNlICdvdXRwdXRDb2xsYXBzZWQnOlxuXHRcdFx0XHRcdFx0Ly8gYm9vbGVhblxuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBuZXdNZXRhZGF0YU9ialtrZXldID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBuZXdNZXRhZGF0YU9ialtrZXldO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBjdXJyZW50TWV0YWRhdGFba2V5IGFzIGtleW9mIE5vdGVib29rQ2VsbE1ldGFkYXRhXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHJlc3VsdFtrZXldID0gbmV3TWV0YWRhdGFPYmpba2V5XTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwhLmNlbGxzLmluZGV4T2YodGhpcy5jZWxsLm1vZGlmaWVkIS50ZXh0TW9kZWwpO1xuXG5cdFx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwhLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsIGluZGV4LCBtZXRhZGF0YTogcmVzdWx0IH1cblx0XHRcdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2J1aWxkTWV0YWRhdGFFZGl0b3IoKSB7XG5cdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuY2xlYXIoKTtcblxuXHRcdGlmICh0aGlzLmNlbGwgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwpIHtcblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9yV2lkZ2V0LCB0aGlzLl9tZXRhZGF0YUVkaXRvckNvbnRhaW5lciEsIHtcblx0XHRcdFx0Li4uZml4ZWREaWZmRWRpdG9yT3B0aW9ucyxcblx0XHRcdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogdGhpcy5ub3RlYm9va0VkaXRvci5nZXRPdmVyZmxvd0NvbnRhaW5lckRvbU5vZGUoKSxcblx0XHRcdFx0cmVhZE9ubHk6IGZhbHNlLFxuXHRcdFx0XHRvcmlnaW5hbEVkaXRhYmxlOiBmYWxzZSxcblx0XHRcdFx0aWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlLFxuXHRcdFx0XHRhdXRvbWF0aWNMYXlvdXQ6IGZhbHNlLFxuXHRcdFx0XHRkaW1lbnNpb246IHtcblx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0LFxuXHRcdFx0XHRcdHdpZHRoOiB0aGlzLmNlbGwuZ2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCksIHRydWUsIHRydWUpXG5cdFx0XHRcdH1cblx0XHRcdH0sIHtcblx0XHRcdFx0b3JpZ2luYWxFZGl0b3I6IGdldE9wdGltaXplZE5lc3RlZENvZGVFZGl0b3JXaWRnZXRPcHRpb25zKCksXG5cdFx0XHRcdG1vZGlmaWVkRWRpdG9yOiBnZXRPcHRpbWl6ZWROZXN0ZWRDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucygpXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgdW5jaGFuZ2VkUmVnaW9ucyA9IHRoaXMuX3JlZ2lzdGVyKGdldFVuY2hhbmdlZFJlZ2lvblNldHRpbmdzKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0XHRcdGlmICh1bmNoYW5nZWRSZWdpb25zLm9wdGlvbnMuZW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvci51cGRhdGVPcHRpb25zKHsgaGlkZVVuY2hhbmdlZFJlZ2lvbnM6IHVuY2hhbmdlZFJlZ2lvbnMub3B0aW9ucyB9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh1bmNoYW5nZWRSZWdpb25zLm9uRGlkQ2hhbmdlRW5hYmxlbWVudCgoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9tZXRhZGF0YUVkaXRvcikge1xuXHRcdFx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyBoaWRlVW5jaGFuZ2VkUmVnaW9uczogdW5jaGFuZ2VkUmVnaW9ucy5vcHRpb25zIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblxuXHRcdFx0dGhpcy5sYXlvdXQoeyBtZXRhZGF0YUhlaWdodDogdHJ1ZSB9KTtcblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh0aGlzLl9tZXRhZGF0YUVkaXRvcik7XG5cblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yQ29udGFpbmVyPy5jbGFzc0xpc3QuYWRkKCdkaWZmJyk7XG5cblx0XHRcdGNvbnN0IFtvcmlnaW5hbE1ldGFkYXRhTW9kZWwsIG1vZGlmaWVkTWV0YWRhdGFNb2RlbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKHRoaXMuY2VsbC5vcmlnaW5hbERvY3VtZW50LnVyaSwgdGhpcy5jZWxsLm9yaWdpbmFsLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxNZXRhZGF0YSkpLFxuXHRcdFx0XHR0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaSh0aGlzLmNlbGwubW9kaWZpZWREb2N1bWVudC51cmksIHRoaXMuY2VsbC5tb2RpZmllZC5oYW5kbGUsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsTWV0YWRhdGEpKVxuXHRcdFx0XSk7XG5cblx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdG9yaWdpbmFsTWV0YWRhdGFNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdG1vZGlmaWVkTWV0YWRhdGFNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKG9yaWdpbmFsTWV0YWRhdGFNb2RlbCk7XG5cdFx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvckRpc3Bvc2VTdG9yZS5hZGQobW9kaWZpZWRNZXRhZGF0YU1vZGVsKTtcblx0XHRcdGNvbnN0IHZtID0gdGhpcy5fbWV0YWRhdGFFZGl0b3IuY3JlYXRlVmlld01vZGVsKHtcblx0XHRcdFx0b3JpZ2luYWw6IG9yaWdpbmFsTWV0YWRhdGFNb2RlbC5vYmplY3QudGV4dEVkaXRvck1vZGVsLFxuXHRcdFx0XHRtb2RpZmllZDogbW9kaWZpZWRNZXRhZGF0YU1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWxcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3Iuc2V0TW9kZWwodm0pO1xuXHRcdFx0Ly8gUmVkdWNlcyBmbGlja2VyIChjb21wdXRlIHRoaXMgYmVmb3JlIHNldHRpbmcgdGhlIG1vZGVsKVxuXHRcdFx0Ly8gRWxzZSB3aGVuIHRoZSBtb2RlbCBpcyBzZXQsIHRoZSBoZWlnaHQgb2YgdGhlIGVkaXRvciB3aWxsIGJlIHgsIGFmdGVyIGRpZmYgaXMgY29tcHV0ZWQsIHRoZW4gaGVpZ2h0IHdpbGwgYmUgeS5cblx0XHRcdC8vICYgdGhhdCByZXN1bHRzIGluIGZsaWNrZXIuXG5cdFx0XHRhd2FpdCB2bS53YWl0Rm9yRGlmZigpO1xuXG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY2VsbC5tZXRhZGF0YUhlaWdodCA9IHRoaXMuX21ldGFkYXRhRWRpdG9yLmdldENvbnRlbnRIZWlnaHQoKTtcblxuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKHRoaXMuX21ldGFkYXRhRWRpdG9yLm9uRGlkQ29udGVudFNpemVDaGFuZ2UoKGUpID0+IHtcblx0XHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQgJiYgdGhpcy5jZWxsLm1ldGFkYXRhRm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5FeHBhbmRlZCkge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5tZXRhZGF0YUhlaWdodCA9IGUuY29udGVudEhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRsZXQgcmVzcG9uZGluZ1RvQ29udGVudENoYW5nZSA9IGZhbHNlO1xuXG5cdFx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvckRpc3Bvc2VTdG9yZS5hZGQobW9kaWZpZWRNZXRhZGF0YU1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdFx0cmVzcG9uZGluZ1RvQ29udGVudENoYW5nZSA9IHRydWU7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gbW9kaWZpZWRNZXRhZGF0YU1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwuZ2V0VmFsdWUoKTtcblx0XHRcdFx0dGhpcy5fYXBwbHlTYW5pdGl6ZWRNZXRhZGF0YUNoYW5nZXModGhpcy5jZWxsLm1vZGlmaWVkIS5tZXRhZGF0YSwgdmFsdWUpO1xuXHRcdFx0XHR0aGlzLl9tZXRhZGF0YUhlYWRlci5yZWZyZXNoKCk7XG5cdFx0XHRcdHJlc3BvbmRpbmdUb0NvbnRlbnRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKHRoaXMuY2VsbC5tb2RpZmllZC50ZXh0TW9kZWwub25EaWRDaGFuZ2VNZXRhZGF0YSgoKSA9PiB7XG5cdFx0XHRcdGlmIChyZXNwb25kaW5nVG9Db250ZW50Q2hhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRNZXRhZGF0YVNvdXJjZSA9IGdldEZvcm1hdHRlZE1ldGFkYXRhSlNPTih0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbD8udHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRDZWxsTWV0YWRhdGEsIHRoaXMuY2VsbC5tb2RpZmllZD8ubWV0YWRhdGEgfHwge30sIHRoaXMuY2VsbC5tb2RpZmllZD8ubGFuZ3VhZ2UsIHRydWUpO1xuXHRcdFx0XHRtb2RpZmllZE1ldGFkYXRhTW9kZWwub2JqZWN0LnRleHRFZGl0b3JNb2RlbC5zZXRWYWx1ZShtb2RpZmllZE1ldGFkYXRhU291cmNlKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29kZUVkaXRvcldpZGdldCwgdGhpcy5fbWV0YWRhdGFFZGl0b3JDb250YWluZXIhLCB7XG5cdFx0XHRcdC4uLmZpeGVkRWRpdG9yT3B0aW9ucyxcblx0XHRcdFx0ZGltZW5zaW9uOiB7XG5cdFx0XHRcdFx0d2lkdGg6IHRoaXMuY2VsbC5nZXRDb21wdXRlZENlbGxDb250YWluZXJXaWR0aCh0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKSwgZmFsc2UsIHRydWUpLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy5jZWxsLmxheW91dEluZm8ubWV0YWRhdGFIZWlnaHRcblx0XHRcdFx0fSxcblx0XHRcdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogdGhpcy5ub3RlYm9va0VkaXRvci5nZXRPdmVyZmxvd0NvbnRhaW5lckRvbU5vZGUoKSxcblx0XHRcdFx0cmVhZE9ubHk6IGZhbHNlXG5cdFx0XHR9LCB7fSk7XG5cdFx0XHR0aGlzLmxheW91dCh7IG1ldGFkYXRhSGVpZ2h0OiB0cnVlIH0pO1xuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKHRoaXMuX21ldGFkYXRhRWRpdG9yKTtcblxuXHRcdFx0Y29uc3QgbW9kZSA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb25jJyk7XG5cdFx0XHRjb25zdCBvcmlnaW5hbE1ldGFkYXRhU291cmNlID0gZ2V0Rm9ybWF0dGVkTWV0YWRhdGFKU09OKHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudENlbGxNZXRhZGF0YSxcblx0XHRcdFx0dGhpcy5jZWxsLnR5cGUgPT09ICdpbnNlcnQnXG5cdFx0XHRcdFx0PyB0aGlzLmNlbGwubW9kaWZpZWQhLm1ldGFkYXRhIHx8IHt9XG5cdFx0XHRcdFx0OiB0aGlzLmNlbGwub3JpZ2luYWwhLm1ldGFkYXRhIHx8IHt9LCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0Y29uc3QgdXJpID0gdGhpcy5jZWxsLnR5cGUgPT09ICdpbnNlcnQnXG5cdFx0XHRcdD8gdGhpcy5jZWxsLm1vZGlmaWVkIS51cmlcblx0XHRcdFx0OiB0aGlzLmNlbGwub3JpZ2luYWwhLnVyaTtcblx0XHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuY2VsbC50eXBlID09PSAnaW5zZXJ0J1xuXHRcdFx0XHQ/IHRoaXMuY2VsbC5tb2RpZmllZCEuaGFuZGxlXG5cdFx0XHRcdDogdGhpcy5jZWxsLm9yaWdpbmFsIS5oYW5kbGU7XG5cblx0XHRcdGNvbnN0IG1vZGVsVXJpID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaSh1cmksIGhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxNZXRhZGF0YSk7XG5cdFx0XHRjb25zdCBtZXRhZGF0YU1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwob3JpZ2luYWxNZXRhZGF0YVNvdXJjZSwgbW9kZSwgbW9kZWxVcmksIGZhbHNlKTtcblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yLnNldE1vZGVsKG1ldGFkYXRhTW9kZWwpO1xuXHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKG1ldGFkYXRhTW9kZWwpO1xuXG5cdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFIZWlnaHQgPSB0aGlzLl9tZXRhZGF0YUVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cblx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh0aGlzLl9tZXRhZGF0YUVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmNvbnRlbnRIZWlnaHRDaGFuZ2VkICYmIHRoaXMuY2VsbC5tZXRhZGF0YUZvbGRpbmdTdGF0ZSA9PT0gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQpIHtcblx0XHRcdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFIZWlnaHQgPSBlLmNvbnRlbnRIZWlnaHQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9idWlsZE91dHB1dEVkaXRvcigpIHtcblx0XHR0aGlzLl9vdXRwdXRFZGl0b3JEaXNwb3NlU3RvcmUuY2xlYXIoKTtcblxuXHRcdGlmICgodGhpcy5jZWxsLnR5cGUgPT09ICdtb2RpZmllZCcgfHwgdGhpcy5jZWxsLnR5cGUgPT09ICd1bmNoYW5nZWQnKSAmJiAhdGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwhLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50T3V0cHV0cykge1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWxPdXRwdXRzU291cmNlID0gZ2V0Rm9ybWF0dGVkT3V0cHV0SlNPTih0aGlzLmNlbGwub3JpZ2luYWw/Lm91dHB1dHMgfHwgW10pO1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRPdXRwdXRzU291cmNlID0gZ2V0Rm9ybWF0dGVkT3V0cHV0SlNPTih0aGlzLmNlbGwubW9kaWZpZWQ/Lm91dHB1dHMgfHwgW10pO1xuXHRcdFx0aWYgKG9yaWdpbmFsT3V0cHV0c1NvdXJjZSAhPT0gbW9kaWZpZWRPdXRwdXRzU291cmNlKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGUgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKCdqc29uJyk7XG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsTW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbChvcmlnaW5hbE91dHB1dHNTb3VyY2UsIG1vZGUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IG1vZGlmaWVkTW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbChtb2RpZmllZE91dHB1dHNTb3VyY2UsIG1vZGUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZS5hZGQob3JpZ2luYWxNb2RlbCk7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZS5hZGQobW9kaWZpZWRNb2RlbCk7XG5cblx0XHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmZvbnRJbmZvLmxpbmVIZWlnaHQgfHwgMTc7XG5cdFx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IE1hdGgubWF4KG9yaWdpbmFsTW9kZWwuZ2V0TGluZUNvdW50KCksIG1vZGlmaWVkTW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFZGl0b3IgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpZmZFZGl0b3JXaWRnZXQsIHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lciEsIHtcblx0XHRcdFx0XHQuLi5maXhlZERpZmZFZGl0b3JPcHRpb25zLFxuXHRcdFx0XHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0T3ZlcmZsb3dDb250YWluZXJEb21Ob2RlKCksXG5cdFx0XHRcdFx0cmVhZE9ubHk6IHRydWUsXG5cdFx0XHRcdFx0aWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlLFxuXHRcdFx0XHRcdGF1dG9tYXRpY0xheW91dDogZmFsc2UsXG5cdFx0XHRcdFx0ZGltZW5zaW9uOiB7XG5cdFx0XHRcdFx0XHRoZWlnaHQ6IE1hdGgubWluKE9VVFBVVF9FRElUT1JfSEVJR0hUX01BR0lDLCB0aGlzLmNlbGwubGF5b3V0SW5mby5yYXdPdXRwdXRIZWlnaHQgfHwgbGluZUhlaWdodCAqIGxpbmVDb3VudCksXG5cdFx0XHRcdFx0XHR3aWR0aDogdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgdHJ1ZSlcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGFjY2Vzc2liaWxpdHlWZXJib3NlOiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuRGlmZkVkaXRvcikgPz8gZmFsc2Vcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdG9yaWdpbmFsRWRpdG9yOiBnZXRPcHRpbWl6ZWROZXN0ZWRDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucygpLFxuXHRcdFx0XHRcdG1vZGlmaWVkRWRpdG9yOiBnZXRPcHRpbWl6ZWROZXN0ZWRDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucygpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFZGl0b3JEaXNwb3NlU3RvcmUuYWRkKHRoaXMuX291dHB1dEVkaXRvcik7XG5cblx0XHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yQ29udGFpbmVyPy5jbGFzc0xpc3QuYWRkKCdkaWZmJyk7XG5cblx0XHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yLnNldE1vZGVsKHtcblx0XHRcdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxNb2RlbCxcblx0XHRcdFx0XHRtb2RpZmllZDogbW9kaWZpZWRNb2RlbFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUodGhpcy5jZWxsLmdldE91dHB1dEVkaXRvclZpZXdTdGF0ZSgpIGFzIGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSk7XG5cblx0XHRcdFx0dGhpcy5jZWxsLnJhd091dHB1dEhlaWdodCA9IHRoaXMuX291dHB1dEVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cblx0XHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh0aGlzLl9vdXRwdXRFZGl0b3Iub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmNvbnRlbnRIZWlnaHRDaGFuZ2VkICYmIHRoaXMuY2VsbC5vdXRwdXRGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNlbGwucmF3T3V0cHV0SGVpZ2h0ID0gZS5jb250ZW50SGVpZ2h0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHRoaXMuX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZS5hZGQodGhpcy5jZWxsLm1vZGlmaWVkIS50ZXh0TW9kZWwub25EaWRDaGFuZ2VPdXRwdXRzKCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtb2RpZmllZE91dHB1dHNTb3VyY2UgPSBnZXRGb3JtYXR0ZWRPdXRwdXRKU09OKHRoaXMuY2VsbC5tb2RpZmllZD8ub3V0cHV0cyB8fCBbXSk7XG5cdFx0XHRcdFx0bW9kaWZpZWRNb2RlbC5zZXRWYWx1ZShtb2RpZmllZE91dHB1dHNTb3VyY2UpO1xuXHRcdFx0XHRcdHRoaXMuX291dHB1dEhlYWRlci5yZWZyZXNoKCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fb3V0cHV0RWRpdG9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlRWRpdG9yV2lkZ2V0LCB0aGlzLl9vdXRwdXRFZGl0b3JDb250YWluZXIhLCB7XG5cdFx0XHQuLi5maXhlZEVkaXRvck9wdGlvbnMsXG5cdFx0XHRkaW1lbnNpb246IHtcblx0XHRcdFx0d2lkdGg6IE1hdGgubWluKE9VVFBVVF9FRElUT1JfSEVJR0hUX01BR0lDLCB0aGlzLmNlbGwuZ2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCksIGZhbHNlLCB0aGlzLmNlbGwudHlwZSA9PT0gJ3VuY2hhbmdlZCcgfHwgdGhpcy5jZWxsLnR5cGUgPT09ICdtb2RpZmllZCcpIC0gMzIpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLnJhd091dHB1dEhlaWdodFxuXHRcdFx0fSxcblx0XHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0T3ZlcmZsb3dDb250YWluZXJEb21Ob2RlKClcblx0XHR9LCB7fSk7XG5cdFx0dGhpcy5fb3V0cHV0RWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh0aGlzLl9vdXRwdXRFZGl0b3IpO1xuXG5cdFx0Y29uc3QgbW9kZSA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb24nKTtcblx0XHRjb25zdCBvcmlnaW5hbG91dHB1dFNvdXJjZSA9IGdldEZvcm1hdHRlZE91dHB1dEpTT04oXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCEudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzXG5cdFx0XHRcdD8gW11cblx0XHRcdFx0OiB0aGlzLmNlbGwudHlwZSA9PT0gJ2luc2VydCdcblx0XHRcdFx0XHQ/IHRoaXMuY2VsbC5tb2RpZmllZD8ub3V0cHV0cyB8fCBbXVxuXHRcdFx0XHRcdDogdGhpcy5jZWxsLm9yaWdpbmFsPy5vdXRwdXRzIHx8IFtdKTtcblx0XHRjb25zdCBvdXRwdXRNb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKG9yaWdpbmFsb3V0cHV0U291cmNlLCBtb2RlLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdHRoaXMuX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZS5hZGQob3V0cHV0TW9kZWwpO1xuXHRcdHRoaXMuX291dHB1dEVkaXRvci5zZXRNb2RlbChvdXRwdXRNb2RlbCk7XG5cdFx0dGhpcy5fb3V0cHV0RWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUodGhpcy5jZWxsLmdldE91dHB1dEVkaXRvclZpZXdTdGF0ZSgpKTtcblxuXHRcdHRoaXMuY2VsbC5yYXdPdXRwdXRIZWlnaHQgPSB0aGlzLl9vdXRwdXRFZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpO1xuXG5cdFx0dGhpcy5fb3V0cHV0RWRpdG9yRGlzcG9zZVN0b3JlLmFkZCh0aGlzLl9vdXRwdXRFZGl0b3Iub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQgJiYgdGhpcy5jZWxsLm91dHB1dEZvbGRpbmdTdGF0ZSA9PT0gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQpIHtcblx0XHRcdFx0dGhpcy5jZWxsLnJhd091dHB1dEhlaWdodCA9IGUuY29udGVudEhlaWdodDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbGF5b3V0Tm90ZWJvb2tDZWxsKCkge1xuXHRcdHRoaXMubm90ZWJvb2tFZGl0b3IubGF5b3V0Tm90ZWJvb2tDZWxsKFxuXHRcdFx0dGhpcy5jZWxsLFxuXHRcdFx0dGhpcy5jZWxsLmxheW91dEluZm8udG90YWxIZWlnaHRcblx0XHQpO1xuXHR9XG5cblx0dXBkYXRlQm9yZGVycygpIHtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5sZWZ0Qm9yZGVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0IC0gMzJ9cHhgO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLnJpZ2h0Qm9yZGVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0IC0gMzJ9cHhgO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmJvdHRvbUJvcmRlci5zdHlsZS50b3AgPSBgJHt0aGlzLmNlbGwubGF5b3V0SW5mby50b3RhbEhlaWdodCAtIDMyfXB4YDtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dEVkaXRvcikge1xuXHRcdFx0dGhpcy5jZWxsLnNhdmVPdXRwdXRFZGl0b3JWaWV3U3RhdGUodGhpcy5fb3V0cHV0RWRpdG9yLnNhdmVWaWV3U3RhdGUoKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX21ldGFkYXRhRWRpdG9yKSB7XG5cdFx0XHR0aGlzLmNlbGwuc2F2ZU1ldGFkYXRhRWRpdG9yVmlld1N0YXRlKHRoaXMuX21ldGFkYXRhRWRpdG9yLnNhdmVWaWV3U3RhdGUoKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JEaXNwb3NlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX291dHB1dEVkaXRvckRpc3Bvc2VTdG9yZS5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRhYnN0cmFjdCB1cGRhdGVTb3VyY2VFZGl0b3IoKTogdm9pZDtcblx0YWJzdHJhY3QgbGF5b3V0KHN0YXRlOiBJRGlmZkVsZW1lbnRMYXlvdXRTdGF0ZSk6IHZvaWQ7XG59XG5cbmFic3RyYWN0IGNsYXNzIFNpbmdsZVNpZGVEaWZmRWxlbWVudCBleHRlbmRzIEFic3RyYWN0RWxlbWVudFJlbmRlcmVyIHtcblx0cHJvdGVjdGVkIF9lZGl0b3IhOiBDb2RlRWRpdG9yV2lkZ2V0O1xuXHRvdmVycmlkZSByZWFkb25seSBjZWxsOiBTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWw7XG5cdG92ZXJyaWRlIHJlYWRvbmx5IHRlbXBsYXRlRGF0YTogQ2VsbERpZmZTaW5nbGVTaWRlUmVuZGVyVGVtcGxhdGU7XG5cdGFic3RyYWN0IGdldCBuZXN0ZWRDZWxsVmlld01vZGVsKCk6IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsO1xuXHRhYnN0cmFjdCBnZXQgcmVhZG9ubHkoKTogYm9vbGVhbjtcblx0Y29uc3RydWN0b3IoXG5cdFx0bm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va1RleHREaWZmRWRpdG9yLFxuXHRcdGNlbGw6IFNpbmdsZVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbCxcblx0XHR0ZW1wbGF0ZURhdGE6IENlbGxEaWZmU2luZ2xlU2lkZVJlbmRlclRlbXBsYXRlLFxuXHRcdHN0eWxlOiAnbGVmdCcgfCAncmlnaHQnIHwgJ2Z1bGwnLFxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHR0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0a2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHR0ZXh0Q29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdG5vdGVib29rRWRpdG9yLFxuXHRcdFx0Y2VsbCxcblx0XHRcdHRlbXBsYXRlRGF0YSxcblx0XHRcdHN0eWxlLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRsYW5ndWFnZVNlcnZpY2UsXG5cdFx0XHRtb2RlbFNlcnZpY2UsXG5cdFx0XHR0ZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdFx0Y29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0a2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0bWVudVNlcnZpY2UsXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0dGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0KTtcblx0XHR0aGlzLmNlbGwgPSBjZWxsO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhID0gdGVtcGxhdGVEYXRhO1xuXG5cdFx0dGhpcy51cGRhdGVCb3JkZXJzKCk7XG5cdH1cblxuXHRpbml0KCkge1xuXHRcdHRoaXMuX2RpYWdvbmFsRmlsbCA9IHRoaXMudGVtcGxhdGVEYXRhLmRpYWdvbmFsRmlsbDtcblx0fVxuXG5cdG92ZXJyaWRlIGJ1aWxkQm9keSgpIHtcblx0XHRjb25zdCBib2R5ID0gdGhpcy50ZW1wbGF0ZURhdGEuYm9keTtcblx0XHR0aGlzLl9kaWZmRWRpdG9yQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEuZGlmZkVkaXRvckNvbnRhaW5lcjtcblx0XHRib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ2xlZnQnLCAncmlnaHQnLCAnZnVsbCcpO1xuXHRcdHN3aXRjaCAodGhpcy5zdHlsZSkge1xuXHRcdFx0Y2FzZSAnbGVmdCc6XG5cdFx0XHRcdGJvZHkuY2xhc3NMaXN0LmFkZCgnbGVmdCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3JpZ2h0Jzpcblx0XHRcdFx0Ym9keS5jbGFzc0xpc3QuYWRkKCdyaWdodCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJvZHkuY2xhc3NMaXN0LmFkZCgnZnVsbCcpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHR0aGlzLnN0eWxlQ29udGFpbmVyKHRoaXMuX2RpZmZFZGl0b3JDb250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlU291cmNlRWRpdG9yKCk7XG5cblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnbm90ZWJvb2suZGlmZi5pZ25vcmVNZXRhZGF0YScpKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NlTWV0YWRhdGEoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYnVpbGRNZXRhZGF0YSgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdub3RlYm9vay5kaWZmLmlnbm9yZU91dHB1dHMnKSB8fCB0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbD8udHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NlT3V0cHV0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2J1aWxkT3V0cHV0KCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRsZXQgbWV0YWRhdGFMYXlvdXRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGxldCBvdXRwdXRMYXlvdXRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdub3RlYm9vay5kaWZmLmlnbm9yZU1ldGFkYXRhJykpIHtcblx0XHRcdFx0dGhpcy5fbWV0YWRhdGFMb2NhbERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ25vdGVib29rLmRpZmYuaWdub3JlTWV0YWRhdGEnKSkge1xuXHRcdFx0XHRcdHRoaXMuX2Rpc3Bvc2VNZXRhZGF0YSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5tZXRhZGF0YVN0YXR1c0hlaWdodCA9IDI1O1xuXHRcdFx0XHRcdHRoaXMuX2J1aWxkTWV0YWRhdGEoKTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZU1ldGFkYXRhUmVuZGVyaW5nKCk7XG5cdFx0XHRcdFx0bWV0YWRhdGFMYXlvdXRDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdub3RlYm9vay5kaWZmLmlnbm9yZU91dHB1dHMnKSkge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRMb2NhbERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpIHx8IHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMpIHtcblx0XHRcdFx0XHR0aGlzLl9kaXNwb3NlT3V0cHV0KCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jZWxsLm91dHB1dFN0YXR1c0hlaWdodCA9IDI1O1xuXHRcdFx0XHRcdHRoaXMuX2J1aWxkT3V0cHV0KCk7XG5cdFx0XHRcdFx0b3V0cHV0TGF5b3V0Q2hhbmdlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAobWV0YWRhdGFMYXlvdXRDaGFuZ2UgfHwgb3V0cHV0TGF5b3V0Q2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0KHsgbWV0YWRhdGFIZWlnaHQ6IG1ldGFkYXRhTGF5b3V0Q2hhbmdlLCBvdXRwdXRUb3RhbEhlaWdodDogb3V0cHV0TGF5b3V0Q2hhbmdlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVNvdXJjZUVkaXRvcigpOiB2b2lkIHtcblx0XHR0aGlzLl9jZWxsSGVhZGVyQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEuY2VsbEhlYWRlckNvbnRhaW5lcjtcblx0XHR0aGlzLl9jZWxsSGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIgPSB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3JDb250YWluZXI7XG5cdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2RpZmYnKTtcblxuXHRcdGNvbnN0IHJlbmRlclNvdXJjZUVkaXRvciA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmNlbGwuY2VsbEZvbGRpbmdTdGF0ZSA9PT0gUHJvcGVydHlGb2xkaW5nU3RhdGUuQ29sbGFwc2VkKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHR0aGlzLmNlbGwuZWRpdG9ySGVpZ2h0ID0gMDtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmZvbnRJbmZvLmxpbmVIZWlnaHQgfHwgMTc7XG5cdFx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLmNlbGwuY29tcHV0ZUlucHV0RWRpdG9ySGVpZ2h0KGxpbmVIZWlnaHQpO1xuXG5cdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7ZWRpdG9ySGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuXHRcdFx0aWYgKHRoaXMuX2VkaXRvcikge1xuXHRcdFx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGhpcy5fZWRpdG9yLmdldENvbnRlbnRIZWlnaHQoKTtcblx0XHRcdFx0aWYgKGNvbnRlbnRIZWlnaHQgPj0gMCkge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5lZGl0b3JIZWlnaHQgPSBjb250ZW50SGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZWRpdG9yID0gdGhpcy50ZW1wbGF0ZURhdGEuc291cmNlRWRpdG9yO1xuXHRcdFx0dGhpcy5fZWRpdG9yLmxheW91dChcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHdpZHRoOiAodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGggLSAyICogRElGRl9DRUxMX01BUkdJTikgLyAyIC0gMTgsXG5cdFx0XHRcdFx0aGVpZ2h0OiBlZGl0b3JIZWlnaHRcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcdHRoaXMuX2VkaXRvci51cGRhdGVPcHRpb25zKHsgcmVhZE9ubHk6IHRoaXMucmVhZG9ubHkgfSk7XG5cdFx0XHR0aGlzLmNlbGwuZWRpdG9ySGVpZ2h0ID0gZWRpdG9ySGVpZ2h0O1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5jZWxsLmNlbGxGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkICYmIGUuY29udGVudEhlaWdodENoYW5nZWQgJiYgdGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0ICE9PSBlLmNvbnRlbnRIZWlnaHQpIHtcblx0XHRcdFx0XHR0aGlzLmNlbGwuZWRpdG9ySGVpZ2h0ID0gZS5jb250ZW50SGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9pbml0aWFsaXplU291cmNlRGlmZkVkaXRvcih0aGlzLm5lc3RlZENlbGxWaWV3TW9kZWwpO1xuXHRcdH07XG5cblx0XHR0aGlzLl9jZWxsSGVhZGVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFByb3BlcnR5SGVhZGVyLFxuXHRcdFx0dGhpcy5jZWxsLFxuXHRcdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lcixcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IsXG5cdFx0XHR7XG5cdFx0XHRcdHVwZGF0ZUluZm9SZW5kZXJpbmc6ICgpID0+IHJlbmRlclNvdXJjZUVkaXRvcigpLFxuXHRcdFx0XHRjaGVja0lmTW9kaWZpZWQ6ICgpID0+ICh7IHJlYXNvbjogdW5kZWZpbmVkIH0pLFxuXHRcdFx0XHRnZXRGb2xkaW5nU3RhdGU6ICgpID0+IHRoaXMuY2VsbC5jZWxsRm9sZGluZ1N0YXRlLFxuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGU6IChzdGF0ZSkgPT4gdGhpcy5jZWxsLmNlbGxGb2xkaW5nU3RhdGUgPSBzdGF0ZSxcblx0XHRcdFx0dW5DaGFuZ2VkTGFiZWw6ICdJbnB1dCcsXG5cdFx0XHRcdGNoYW5nZWRMYWJlbDogJ0lucHV0Jyxcblx0XHRcdFx0cHJlZml4OiAnaW5wdXQnLFxuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5Ob3RlYm9va0RpZmZDZWxsSW5wdXRUaXRsZVxuXHRcdFx0fVxuXHRcdCkpO1xuXHRcdHRoaXMuX2NlbGxIZWFkZXIuYnVpbGRIZWFkZXIoKTtcblx0XHRyZW5kZXJTb3VyY2VFZGl0b3IoKTtcblxuXHRcdHRoaXMuX2luaXRpYWxpemVTb3VyY2VEaWZmRWRpdG9yKHRoaXMubmVzdGVkQ2VsbFZpZXdNb2RlbCk7XG5cdH1cblx0cHJvdGVjdGVkIGNhbGN1bGF0ZURpYWdvbmFsRmlsbEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsLmxheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodCArIHRoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCArIHRoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvck1hcmdpbiArIHRoaXMuY2VsbC5sYXlvdXRJbmZvLm1ldGFkYXRhU3RhdHVzSGVpZ2h0ICsgdGhpcy5jZWxsLmxheW91dEluZm8ubWV0YWRhdGFIZWlnaHQgKyB0aGlzLmNlbGwubGF5b3V0SW5mby5vdXRwdXRUb3RhbEhlaWdodCArIHRoaXMuY2VsbC5sYXlvdXRJbmZvLm91dHB1dFN0YXR1c0hlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2luaXRpYWxpemVTb3VyY2VEaWZmRWRpdG9yKG1vZGlmaWVkQ2VsbDogRGlmZk5lc3RlZENlbGxWaWV3TW9kZWwpIHtcblx0XHRjb25zdCBtb2RpZmllZFJlZiA9IGF3YWl0IHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShtb2RpZmllZENlbGwudXJpKTtcblxuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kaWZpZWRUZXh0TW9kZWwgPSBtb2RpZmllZFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGlmaWVkUmVmKTtcblxuXHRcdHRoaXMuX2VkaXRvciEuc2V0TW9kZWwobW9kaWZpZWRUZXh0TW9kZWwpO1xuXG5cdFx0Y29uc3QgZWRpdG9yVmlld1N0YXRlID0gdGhpcy5jZWxsLmdldFNvdXJjZUVkaXRvclZpZXdTdGF0ZSgpIGFzIGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGw7XG5cdFx0aWYgKGVkaXRvclZpZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yIS5yZXN0b3JlVmlld1N0YXRlKGVkaXRvclZpZXdTdGF0ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMuX2VkaXRvciEuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdHRoaXMuY2VsbC5lZGl0b3JIZWlnaHQgPSBjb250ZW50SGVpZ2h0O1xuXHRcdGNvbnN0IGhlaWdodCA9IGAke3RoaXMuY2FsY3VsYXRlRGlhZ29uYWxGaWxsSGVpZ2h0KCl9cHhgO1xuXHRcdGlmICh0aGlzLl9kaWFnb25hbEZpbGwhLnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG5cdFx0XHR0aGlzLl9kaWFnb25hbEZpbGwhLnN0eWxlLmhlaWdodCA9IGhlaWdodDtcblx0XHR9XG5cdH1cblxuXHRfZGlzcG9zZU1ldGFkYXRhKCkge1xuXHRcdHRoaXMuY2VsbC5tZXRhZGF0YVN0YXR1c0hlaWdodCA9IDA7XG5cdFx0dGhpcy5jZWxsLm1ldGFkYXRhSGVpZ2h0ID0gMDtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEubWV0YWRhdGFIZWFkZXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5tZXRhZGF0YUluZm9Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdF9idWlsZE1ldGFkYXRhKCkge1xuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEubWV0YWRhdGFIZWFkZXJDb250YWluZXI7XG5cdFx0dGhpcy5fbWV0YWRhdGFJbmZvQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEubWV0YWRhdGFJbmZvQ29udGFpbmVyO1xuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0dGhpcy5fbWV0YWRhdGFJbmZvQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXHRcdHRoaXMuX21ldGFkYXRhSW5mb0NvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblxuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFByb3BlcnR5SGVhZGVyLFxuXHRcdFx0dGhpcy5jZWxsLFxuXHRcdFx0dGhpcy5fbWV0YWRhdGFIZWFkZXJDb250YWluZXIsXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLFxuXHRcdFx0e1xuXHRcdFx0XHR1cGRhdGVJbmZvUmVuZGVyaW5nOiB0aGlzLnVwZGF0ZU1ldGFkYXRhUmVuZGVyaW5nLmJpbmQodGhpcyksXG5cdFx0XHRcdGNoZWNrSWZNb2RpZmllZDogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNlbGwuY2hlY2tNZXRhZGF0YUlmTW9kaWZpZWQoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0Rm9sZGluZ1N0YXRlOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuY2VsbC5tZXRhZGF0YUZvbGRpbmdTdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlOiAoc3RhdGUpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFGb2xkaW5nU3RhdGUgPSBzdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dW5DaGFuZ2VkTGFiZWw6ICdNZXRhZGF0YScsXG5cdFx0XHRcdGNoYW5nZWRMYWJlbDogJ01ldGFkYXRhIGNoYW5nZWQnLFxuXHRcdFx0XHRwcmVmaXg6ICdtZXRhZGF0YScsXG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rRGlmZkNlbGxNZXRhZGF0YVRpdGxlXG5cdFx0XHR9XG5cdFx0KTtcblx0XHR0aGlzLl9tZXRhZGF0YUxvY2FsRGlzcG9zYWJsZS5hZGQodGhpcy5fbWV0YWRhdGFIZWFkZXIpO1xuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyLmJ1aWxkSGVhZGVyKCk7XG5cdH1cblxuXHRfYnVpbGRPdXRwdXQoKSB7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SW5mb0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuXHRcdHRoaXMuX291dHB1dEhlYWRlckNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dEhlYWRlckNvbnRhaW5lcjtcblx0XHR0aGlzLl9vdXRwdXRJbmZvQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SW5mb0NvbnRhaW5lcjtcblxuXHRcdHRoaXMuX291dHB1dEhlYWRlckNvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLl9vdXRwdXRJbmZvQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0dGhpcy5fb3V0cHV0SGVhZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFByb3BlcnR5SGVhZGVyLFxuXHRcdFx0dGhpcy5jZWxsLFxuXHRcdFx0dGhpcy5fb3V0cHV0SGVhZGVyQ29udGFpbmVyLFxuXHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvcixcblx0XHRcdHtcblx0XHRcdFx0dXBkYXRlSW5mb1JlbmRlcmluZzogdGhpcy51cGRhdGVPdXRwdXRSZW5kZXJpbmcuYmluZCh0aGlzKSxcblx0XHRcdFx0Y2hlY2tJZk1vZGlmaWVkOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldEZvbGRpbmdTdGF0ZTogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNlbGwub3V0cHV0Rm9sZGluZ1N0YXRlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGU6IChzdGF0ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5vdXRwdXRGb2xkaW5nU3RhdGUgPSBzdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dW5DaGFuZ2VkTGFiZWw6ICdPdXRwdXRzJyxcblx0XHRcdFx0Y2hhbmdlZExhYmVsOiAnT3V0cHV0cyBjaGFuZ2VkJyxcblx0XHRcdFx0cHJlZml4OiAnb3V0cHV0Jyxcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTm90ZWJvb2tEaWZmQ2VsbE91dHB1dHNUaXRsZVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0dGhpcy5fb3V0cHV0TG9jYWxEaXNwb3NhYmxlLmFkZCh0aGlzLl9vdXRwdXRIZWFkZXIpO1xuXHRcdHRoaXMuX291dHB1dEhlYWRlci5idWlsZEhlYWRlcigpO1xuXHR9XG5cblx0X2Rpc3Bvc2VPdXRwdXQoKSB7XG5cdFx0dGhpcy5faGlkZU91dHB1dHNSYXcoKTtcblx0XHR0aGlzLl9oaWRlT3V0cHV0c1JlbmRlcmVyKCk7XG5cdFx0dGhpcy5faGlkZU91dHB1dHNFbXB0eVZpZXcoKTtcblxuXHRcdHRoaXMuY2VsbC5yYXdPdXRwdXRIZWlnaHQgPSAwO1xuXHRcdHRoaXMuY2VsbC5vdXRwdXRNZXRhZGF0YUhlaWdodCA9IDA7XG5cdFx0dGhpcy5jZWxsLm91dHB1dFN0YXR1c0hlaWdodCA9IDA7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SW5mb0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIgPSB1bmRlZmluZWQ7XG5cdH1cbn1cbmV4cG9ydCBjbGFzcyBEZWxldGVkRWxlbWVudCBleHRlbmRzIFNpbmdsZVNpZGVEaWZmRWxlbWVudCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tUZXh0RGlmZkVkaXRvcixcblx0XHRjZWxsOiBTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwsXG5cdFx0dGVtcGxhdGVEYXRhOiBDZWxsRGlmZlNpbmdsZVNpZGVSZW5kZXJUZW1wbGF0ZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0Q29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobm90ZWJvb2tFZGl0b3IsIGNlbGwsIHRlbXBsYXRlRGF0YSwgJ2xlZnQnLCBpbnN0YW50aWF0aW9uU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCBtb2RlbFNlcnZpY2UsIHRleHRNb2RlbFNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIG1lbnVTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHRleHRDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdH1cblxuXHRnZXQgbmVzdGVkQ2VsbFZpZXdNb2RlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsLm9yaWdpbmFsITtcblx0fVxuXHRnZXQgcmVhZG9ubHkoKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRzdHlsZUNvbnRhaW5lcihjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2luc2VydGVkJyk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3JlbW92ZWQnKTtcblx0fVxuXG5cdGxheW91dChzdGF0ZTogSURpZmZFbGVtZW50TGF5b3V0U3RhdGUpIHtcblx0XHRET00uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShET00uZ2V0V2luZG93KHRoaXMuX2RpZmZFZGl0b3JDb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRpZiAoKHN0YXRlLmVkaXRvckhlaWdodCB8fCBzdGF0ZS5vdXRlcldpZHRoKSAmJiB0aGlzLl9lZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodH1weGA7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoe1xuXHRcdFx0XHRcdHdpZHRoOiB0aGlzLmNlbGwuZ2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCksIGZhbHNlLCBmYWxzZSksXG5cdFx0XHRcdFx0aGVpZ2h0OiB0aGlzLmNlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS5vdXRlcldpZHRoICYmIHRoaXMuX2VkaXRvcikge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0fXB4YDtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLmxheW91dCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhdGUubWV0YWRhdGFIZWlnaHQgfHwgc3RhdGUub3V0ZXJXaWR0aCkge1xuXHRcdFx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvcj8ubGF5b3V0KHtcblx0XHRcdFx0XHR3aWR0aDogdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgZmFsc2UpLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy5jZWxsLmxheW91dEluZm8ubWV0YWRhdGFIZWlnaHRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS5vdXRwdXRUb3RhbEhlaWdodCB8fCBzdGF0ZS5vdXRlcldpZHRoKSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVkaXRvcj8ubGF5b3V0KHtcblx0XHRcdFx0XHR3aWR0aDogdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgZmFsc2UpLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy5jZWxsLmxheW91dEluZm8ub3V0cHV0VG90YWxIZWlnaHRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9kaWFnb25hbEZpbGwpIHtcblx0XHRcdFx0dGhpcy5fZGlhZ29uYWxGaWxsLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2FsY3VsYXRlRGlhZ29uYWxGaWxsSGVpZ2h0KCl9cHhgO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxheW91dE5vdGVib29rQ2VsbCgpO1xuXHRcdH0pO1xuXHR9XG5cblxuXHRfYnVpbGRPdXRwdXRSZW5kZXJlckNvbnRhaW5lcigpIHtcblx0XHRpZiAoIXRoaXMuX291dHB1dFZpZXdDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX291dHB1dEluZm9Db250YWluZXIsIERPTS4kKCcub3V0cHV0LXZpZXctY29udGFpbmVyJykpO1xuXHRcdFx0dGhpcy5fb3V0cHV0RW1wdHlFbGVtZW50ID0gRE9NLmFwcGVuZCh0aGlzLl9vdXRwdXRWaWV3Q29udGFpbmVyLCBET00uJCgnLm91dHB1dC1lbXB0eS12aWV3JykpO1xuXHRcdFx0Y29uc3Qgc3BhbiA9IERPTS5hcHBlbmQodGhpcy5fb3V0cHV0RW1wdHlFbGVtZW50LCBET00uJCgnc3BhbicpKTtcblx0XHRcdHNwYW4uaW5uZXJUZXh0ID0gJ05vIG91dHB1dHMgdG8gcmVuZGVyJztcblxuXHRcdFx0aWYgKCF0aGlzLmNlbGwub3JpZ2luYWw/Lm91dHB1dHMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVtcHR5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVtcHR5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNlbGwubGF5b3V0Q2hhbmdlKCk7XG5cblx0XHRcdHRoaXMuX291dHB1dExlZnRWaWV3ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShPdXRwdXRDb250YWluZXIsIHRoaXMubm90ZWJvb2tFZGl0b3IsIHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsISwgdGhpcy5jZWxsLCB0aGlzLmNlbGwub3JpZ2luYWwhLCBEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9vdXRwdXRMZWZ0Vmlldyk7XG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0Vmlldy5yZW5kZXIoKTtcblxuXHRcdFx0Y29uc3QgcmVtb3ZlZE91dHB1dFJlbmRlckxpc3RlbmVyID0gdGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZER5bmFtaWNPdXRwdXRSZW5kZXJlZChlID0+IHtcblx0XHRcdFx0aWYgKGUuY2VsbC51cmkudG9TdHJpbmcoKSA9PT0gdGhpcy5jZWxsLm9yaWdpbmFsIS51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5jZWxsLm9yaWdpbmFsIS5pZCwgWyduYi1jZWxsRGVsZXRlZCddLCBbXSk7XG5cdFx0XHRcdFx0cmVtb3ZlZE91dHB1dFJlbmRlckxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlbW92ZWRPdXRwdXRSZW5kZXJMaXN0ZW5lcik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0fVxuXG5cdF9kZWNvcmF0ZSgpIHtcblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmRlbHRhQ2VsbE91dHB1dENvbnRhaW5lckNsYXNzTmFtZXMoRGlmZlNpZGUuT3JpZ2luYWwsIHRoaXMuY2VsbC5vcmlnaW5hbCEuaWQsIFsnbmItY2VsbERlbGV0ZWQnXSwgW10pO1xuXHR9XG5cblx0X3Nob3dPdXRwdXRzUmVuZGVyZXIoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRcdHRoaXMuX291dHB1dExlZnRWaWV3Py5zaG93T3V0cHV0cygpO1xuXHRcdFx0dGhpcy5fZGVjb3JhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRfaGlkZU91dHB1dHNSZW5kZXJlcigpIHtcblx0XHRpZiAodGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0Vmlldz8uaGlkZU91dHB1dHMoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdGlmICh0aGlzLl9lZGl0b3IpIHtcblx0XHRcdHRoaXMuY2VsbC5zYXZlU3BpcmNlRWRpdG9yVmlld1N0YXRlKHRoaXMuX2VkaXRvci5zYXZlVmlld1N0YXRlKCkpO1xuXHRcdH1cblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zZXJ0RWxlbWVudCBleHRlbmRzIFNpbmdsZVNpZGVEaWZmRWxlbWVudCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tUZXh0RGlmZkVkaXRvcixcblx0XHRjZWxsOiBTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwsXG5cdFx0dGVtcGxhdGVEYXRhOiBDZWxsRGlmZlNpbmdsZVNpZGVSZW5kZXJUZW1wbGF0ZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0Q29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobm90ZWJvb2tFZGl0b3IsIGNlbGwsIHRlbXBsYXRlRGF0YSwgJ3JpZ2h0JywgaW5zdGFudGlhdGlvblNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgbW9kZWxTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBtZW51U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0ZXh0Q29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHR9XG5cdGdldCBuZXN0ZWRDZWxsVmlld01vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLmNlbGwubW9kaWZpZWQhO1xuXHR9XG5cdGdldCByZWFkb25seSgpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRzdHlsZUNvbnRhaW5lcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZWQnKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnaW5zZXJ0ZWQnKTtcblx0fVxuXG5cdF9idWlsZE91dHB1dFJlbmRlcmVyQ29udGFpbmVyKCkge1xuXHRcdGlmICghdGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5fb3V0cHV0SW5mb0NvbnRhaW5lciwgRE9NLiQoJy5vdXRwdXQtdmlldy1jb250YWluZXInKSk7XG5cdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQgPSBET00uYXBwZW5kKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIsIERPTS4kKCcub3V0cHV0LWVtcHR5LXZpZXcnKSk7XG5cdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQuaW5uZXJUZXh0ID0gJ05vIG91dHB1dHMgdG8gcmVuZGVyJztcblxuXHRcdFx0aWYgKCF0aGlzLmNlbGwubW9kaWZpZWQ/Lm91dHB1dHMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVtcHR5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVtcHR5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNlbGwubGF5b3V0Q2hhbmdlKCk7XG5cblx0XHRcdHRoaXMuX291dHB1dFJpZ2h0VmlldyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0cHV0Q29udGFpbmVyLCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCEsIHRoaXMuY2VsbCwgdGhpcy5jZWxsLm1vZGlmaWVkISwgRGlmZlNpZGUuTW9kaWZpZWQsIHRoaXMuX291dHB1dFZpZXdDb250YWluZXIpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb3V0cHV0UmlnaHRWaWV3KTtcblx0XHRcdHRoaXMuX291dHB1dFJpZ2h0Vmlldy5yZW5kZXIoKTtcblxuXHRcdFx0Y29uc3QgaW5zZXJ0T3V0cHV0UmVuZGVyTGlzdGVuZXIgPSB0aGlzLm5vdGVib29rRWRpdG9yLm9uRGlkRHluYW1pY091dHB1dFJlbmRlcmVkKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5jZWxsLnVyaS50b1N0cmluZygpID09PSB0aGlzLmNlbGwubW9kaWZpZWQhLnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5kZWx0YUNlbGxPdXRwdXRDb250YWluZXJDbGFzc05hbWVzKERpZmZTaWRlLk1vZGlmaWVkLCB0aGlzLmNlbGwubW9kaWZpZWQhLmlkLCBbJ25iLWNlbGxBZGRlZCddLCBbXSk7XG5cdFx0XHRcdFx0aW5zZXJ0T3V0cHV0UmVuZGVyTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGluc2VydE91dHB1dFJlbmRlckxpc3RlbmVyKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vdXRwdXRWaWV3Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHR9XG5cblx0X2RlY29yYXRlKCkge1xuXHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5Nb2RpZmllZCwgdGhpcy5jZWxsLm1vZGlmaWVkIS5pZCwgWyduYi1jZWxsQWRkZWQnXSwgW10pO1xuXHR9XG5cblx0X3Nob3dPdXRwdXRzUmVuZGVyZXIoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHR0aGlzLl9vdXRwdXRSaWdodFZpZXc/LnNob3dPdXRwdXRzKCk7XG5cdFx0XHR0aGlzLl9kZWNvcmF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdF9oaWRlT3V0cHV0c1JlbmRlcmVyKCkge1xuXHRcdGlmICh0aGlzLl9vdXRwdXRWaWV3Q29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLl9vdXRwdXRWaWV3Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLl9vdXRwdXRSaWdodFZpZXc/LmhpZGVPdXRwdXRzKCk7XG5cdFx0fVxuXHR9XG5cblx0bGF5b3V0KHN0YXRlOiBJRGlmZkVsZW1lbnRMYXlvdXRTdGF0ZSkge1xuXHRcdERPTS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKERPTS5nZXRXaW5kb3codGhpcy5fZGlmZkVkaXRvckNvbnRhaW5lciksICgpID0+IHtcblx0XHRcdGlmICgoc3RhdGUuZWRpdG9ySGVpZ2h0IHx8IHN0YXRlLm91dGVyV2lkdGgpICYmIHRoaXMuX2VkaXRvcikge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0fXB4YDtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLmxheW91dCh7XG5cdFx0XHRcdFx0d2lkdGg6IHRoaXMuY2VsbC5nZXRDb21wdXRlZENlbGxDb250YWluZXJXaWR0aCh0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKSwgZmFsc2UsIGZhbHNlKSxcblx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlLm91dGVyV2lkdGggJiYgdGhpcy5fZWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmNlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHR9cHhgO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IubGF5b3V0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZS5tZXRhZGF0YUhlaWdodCB8fCBzdGF0ZS5vdXRlcldpZHRoKSB7XG5cdFx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yPy5sYXlvdXQoe1xuXHRcdFx0XHRcdHdpZHRoOiB0aGlzLmNlbGwuZ2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCksIGZhbHNlLCB0cnVlKSxcblx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhdGUub3V0cHV0VG90YWxIZWlnaHQgfHwgc3RhdGUub3V0ZXJXaWR0aCkge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFZGl0b3I/LmxheW91dCh7XG5cdFx0XHRcdFx0d2lkdGg6IHRoaXMuY2VsbC5nZXRDb21wdXRlZENlbGxDb250YWluZXJXaWR0aCh0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKSwgZmFsc2UsIGZhbHNlKSxcblx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxheW91dE5vdGVib29rQ2VsbCgpO1xuXG5cdFx0XHRpZiAodGhpcy5fZGlhZ29uYWxGaWxsKSB7XG5cdFx0XHRcdHRoaXMuX2RpYWdvbmFsRmlsbC5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmNhbGN1bGF0ZURpYWdvbmFsRmlsbEhlaWdodCgpfXB4YDtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0aWYgKHRoaXMuX2VkaXRvcikge1xuXHRcdFx0dGhpcy5jZWxsLnNhdmVTcGlyY2VFZGl0b3JWaWV3U3RhdGUodGhpcy5fZWRpdG9yLnNhdmVWaWV3U3RhdGUoKSk7XG5cdFx0fVxuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2RpZmllZEVsZW1lbnQgZXh0ZW5kcyBBYnN0cmFjdEVsZW1lbnRSZW5kZXJlciB7XG5cdHByaXZhdGUgX2VkaXRvcj86IERpZmZFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQ6IGJvb2xlYW47XG5cdHByb3RlY3RlZCBfdG9vbGJhciE6IFRvb2xCYXI7XG5cdHByb3RlY3RlZCBfbWVudSE6IElNZW51O1xuXG5cdG92ZXJyaWRlIHJlYWRvbmx5IGNlbGw6IFNpZGVCeVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbDtcblx0b3ZlcnJpZGUgcmVhZG9ubHkgdGVtcGxhdGVEYXRhOiBDZWxsRGlmZlNpZGVCeVNpZGVSZW5kZXJUZW1wbGF0ZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRub3RlYm9va0VkaXRvcjogSU5vdGVib29rVGV4dERpZmZFZGl0b3IsXG5cdFx0Y2VsbDogU2lkZUJ5U2lkZURpZmZFbGVtZW50Vmlld01vZGVsLFxuXHRcdHRlbXBsYXRlRGF0YTogQ2VsbERpZmZTaWRlQnlTaWRlUmVuZGVyVGVtcGxhdGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgdGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG5vdGVib29rRWRpdG9yLCBjZWxsLCB0ZW1wbGF0ZURhdGEsICdmdWxsJywgaW5zdGFudGlhdGlvblNlcnZpY2UsIGxhbmd1YWdlU2VydmljZSwgbW9kZWxTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBtZW51U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0ZXh0Q29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuY2VsbCA9IGNlbGw7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEgPSB0ZW1wbGF0ZURhdGE7XG5cdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlQ2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy51cGRhdGVCb3JkZXJzKCk7XG5cdH1cblxuXHRpbml0KCkgeyB9XG5cdHN0eWxlQ29udGFpbmVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnaW5zZXJ0ZWQnLCAncmVtb3ZlZCcpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYnVpbGRCb2R5KCk6IHZvaWQge1xuXHRcdHN1cGVyLmJ1aWxkQm9keSgpO1xuXHRcdGlmICh0aGlzLmNlbGwuZGlzcGxheUljb25Ub0hpZGVVbm1vZGlmaWVkQ2VsbHMpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGVtcGxhdGVEYXRhLm1hcmdpbk92ZXJsYXkub25BY3Rpb24oKCkgPT4gdGhpcy5jZWxsLmhpZGVVbmNoYW5nZWRDZWxscygpKSk7XG5cdFx0XHR0aGlzLnRlbXBsYXRlRGF0YS5tYXJnaW5PdmVybGF5LnNob3coKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50ZW1wbGF0ZURhdGEubWFyZ2luT3ZlcmxheS5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cdF9kaXNwb3NlTWV0YWRhdGEoKSB7XG5cdFx0dGhpcy5jZWxsLm1ldGFkYXRhU3RhdHVzSGVpZ2h0ID0gMDtcblx0XHR0aGlzLmNlbGwubWV0YWRhdGFIZWlnaHQgPSAwO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLm1ldGFkYXRhSGVhZGVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEubWV0YWRhdGFJbmZvQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3IgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRfYnVpbGRNZXRhZGF0YSgpIHtcblx0XHR0aGlzLl9tZXRhZGF0YUhlYWRlckNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLm1ldGFkYXRhSGVhZGVyQ29udGFpbmVyO1xuXHRcdHRoaXMuX21ldGFkYXRhSW5mb0NvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLm1ldGFkYXRhSW5mb0NvbnRhaW5lcjtcblx0XHR0aGlzLl9tZXRhZGF0YUhlYWRlckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdHRoaXMuX21ldGFkYXRhSW5mb0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXHRcdHRoaXMuX21ldGFkYXRhSW5mb0NvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblxuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFByb3BlcnR5SGVhZGVyLFxuXHRcdFx0dGhpcy5jZWxsLFxuXHRcdFx0dGhpcy5fbWV0YWRhdGFIZWFkZXJDb250YWluZXIsXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLFxuXHRcdFx0e1xuXHRcdFx0XHR1cGRhdGVJbmZvUmVuZGVyaW5nOiB0aGlzLnVwZGF0ZU1ldGFkYXRhUmVuZGVyaW5nLmJpbmQodGhpcyksXG5cdFx0XHRcdGNoZWNrSWZNb2RpZmllZDogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNlbGwuY2hlY2tNZXRhZGF0YUlmTW9kaWZpZWQoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0Rm9sZGluZ1N0YXRlOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuY2VsbC5tZXRhZGF0YUZvbGRpbmdTdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlOiAoc3RhdGUpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNlbGwubWV0YWRhdGFGb2xkaW5nU3RhdGUgPSBzdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dW5DaGFuZ2VkTGFiZWw6ICdNZXRhZGF0YScsXG5cdFx0XHRcdGNoYW5nZWRMYWJlbDogJ01ldGFkYXRhIGNoYW5nZWQnLFxuXHRcdFx0XHRwcmVmaXg6ICdtZXRhZGF0YScsXG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rRGlmZkNlbGxNZXRhZGF0YVRpdGxlXG5cdFx0XHR9XG5cdFx0KTtcblx0XHR0aGlzLl9tZXRhZGF0YUxvY2FsRGlzcG9zYWJsZS5hZGQodGhpcy5fbWV0YWRhdGFIZWFkZXIpO1xuXHRcdHRoaXMuX21ldGFkYXRhSGVhZGVyLmJ1aWxkSGVhZGVyKCk7XG5cdH1cblxuXHRfZGlzcG9zZU91dHB1dCgpIHtcblx0XHR0aGlzLl9oaWRlT3V0cHV0c1JhdygpO1xuXHRcdHRoaXMuX2hpZGVPdXRwdXRzUmVuZGVyZXIoKTtcblx0XHR0aGlzLl9oaWRlT3V0cHV0c0VtcHR5VmlldygpO1xuXG5cdFx0dGhpcy5jZWxsLnJhd091dHB1dEhlaWdodCA9IDA7XG5cdFx0dGhpcy5jZWxsLm91dHB1dE1ldGFkYXRhSGVpZ2h0ID0gMDtcblx0XHR0aGlzLmNlbGwub3V0cHV0U3RhdHVzSGVpZ2h0ID0gMDtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRIZWFkZXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRJbmZvQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdF9idWlsZE91dHB1dCgpIHtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRIZWFkZXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRJbmZvQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG5cdFx0dGhpcy5fb3V0cHV0SGVhZGVyQ29udGFpbmVyID0gdGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0SGVhZGVyQ29udGFpbmVyO1xuXHRcdHRoaXMuX291dHB1dEluZm9Db250YWluZXIgPSB0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRJbmZvQ29udGFpbmVyO1xuXHRcdHRoaXMuX291dHB1dEhlYWRlckNvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLl9vdXRwdXRJbmZvQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0aWYgKHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkpIHtcblx0XHRcdHRoaXMuX291dHB1dEluZm9Db250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9kaWZpZWQnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fb3V0cHV0SW5mb0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdtb2RpZmllZCcpO1xuXHRcdH1cblxuXHRcdHRoaXMuX291dHB1dEhlYWRlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRQcm9wZXJ0eUhlYWRlcixcblx0XHRcdHRoaXMuY2VsbCxcblx0XHRcdHRoaXMuX291dHB1dEhlYWRlckNvbnRhaW5lcixcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IsXG5cdFx0XHR7XG5cdFx0XHRcdHVwZGF0ZUluZm9SZW5kZXJpbmc6IHRoaXMudXBkYXRlT3V0cHV0UmVuZGVyaW5nLmJpbmQodGhpcyksXG5cdFx0XHRcdGNoZWNrSWZNb2RpZmllZDogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNlbGwuY2hlY2tJZk91dHB1dHNNb2RpZmllZCgpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRGb2xkaW5nU3RhdGU6ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5jZWxsLm91dHB1dEZvbGRpbmdTdGF0ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlOiAoc3RhdGUpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNlbGwub3V0cHV0Rm9sZGluZ1N0YXRlID0gc3RhdGU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVuQ2hhbmdlZExhYmVsOiAnT3V0cHV0cycsXG5cdFx0XHRcdGNoYW5nZWRMYWJlbDogJ091dHB1dHMgY2hhbmdlZCcsXG5cdFx0XHRcdHByZWZpeDogJ291dHB1dCcsXG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rRGlmZkNlbGxPdXRwdXRzVGl0bGVcblx0XHRcdH1cblx0XHQpO1xuXHRcdHRoaXMuX291dHB1dExvY2FsRGlzcG9zYWJsZS5hZGQodGhpcy5fb3V0cHV0SGVhZGVyKTtcblx0XHR0aGlzLl9vdXRwdXRIZWFkZXIuYnVpbGRIZWFkZXIoKTtcblx0fVxuXG5cdF9idWlsZE91dHB1dFJlbmRlcmVyQ29udGFpbmVyKCkge1xuXHRcdGlmICghdGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5fb3V0cHV0SW5mb0NvbnRhaW5lciwgRE9NLiQoJy5vdXRwdXQtdmlldy1jb250YWluZXInKSk7XG5cdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQgPSBET00uYXBwZW5kKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIsIERPTS4kKCcub3V0cHV0LWVtcHR5LXZpZXcnKSk7XG5cdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQuaW5uZXJUZXh0ID0gJ05vIG91dHB1dHMgdG8gcmVuZGVyJztcblxuXHRcdFx0aWYgKCF0aGlzLmNlbGwuY2hlY2tJZk91dHB1dHNNb2RpZmllZCgpICYmIHRoaXMuY2VsbC5tb2RpZmllZC5vdXRwdXRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5jZWxsLmxheW91dENoYW5nZSgpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNlbGwubW9kaWZpZWQudGV4dE1vZGVsLm9uRGlkQ2hhbmdlT3V0cHV0cygoKSA9PiB7XG5cdFx0XHRcdC8vIGN1cnJlbnRseSB3ZSBvbmx5IGFsbG93IG91dHB1dHMgY2hhbmdlIHRvIHRoZSBtb2RpZmllZCBjZWxsXG5cdFx0XHRcdGlmICghdGhpcy5jZWxsLmNoZWNrSWZPdXRwdXRzTW9kaWZpZWQoKSAmJiB0aGlzLmNlbGwubW9kaWZpZWQub3V0cHV0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHR0aGlzLl9vdXRwdXRFbXB0eUVsZW1lbnQhLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX291dHB1dEVtcHR5RWxlbWVudCEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9kZWNvcmF0ZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0Q29udGFpbmVyID0gRE9NLmFwcGVuZCh0aGlzLl9vdXRwdXRWaWV3Q29udGFpbmVyLCBET00uJCgnLm91dHB1dC12aWV3LWNvbnRhaW5lci1sZWZ0JykpO1xuXHRcdFx0dGhpcy5fb3V0cHV0UmlnaHRDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIsIERPTS4kKCcub3V0cHV0LXZpZXctY29udGFpbmVyLXJpZ2h0JykpO1xuXHRcdFx0dGhpcy5fb3V0cHV0TWV0YWRhdGFDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIsIERPTS4kKCcub3V0cHV0LXZpZXctY29udGFpbmVyLW1ldGFkYXRhJykpO1xuXG5cdFx0XHRjb25zdCBvdXRwdXRNb2RpZmllZCA9IHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCk7XG5cdFx0XHRjb25zdCBvdXRwdXRNZXRhZGF0YUNoYW5nZU9ubHkgPSBvdXRwdXRNb2RpZmllZFxuXHRcdFx0XHQmJiBvdXRwdXRNb2RpZmllZC5raW5kID09PSBPdXRwdXRDb21wYXJpc29uLk1ldGFkYXRhXG5cdFx0XHRcdCYmIHRoaXMuY2VsbC5vcmlnaW5hbC5vdXRwdXRzLmxlbmd0aCA9PT0gMVxuXHRcdFx0XHQmJiB0aGlzLmNlbGwubW9kaWZpZWQub3V0cHV0cy5sZW5ndGggPT09IDFcblx0XHRcdFx0JiYgb3V0cHV0RXF1YWwodGhpcy5jZWxsLm9yaWdpbmFsLm91dHB1dHNbMF0sIHRoaXMuY2VsbC5tb2RpZmllZC5vdXRwdXRzWzBdKSA9PT0gT3V0cHV0Q29tcGFyaXNvbi5NZXRhZGF0YTtcblxuXHRcdFx0aWYgKG91dHB1dE1vZGlmaWVkICYmICFvdXRwdXRNZXRhZGF0YUNoYW5nZU9ubHkpIHtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxPdXRwdXRSZW5kZXJMaXN0ZW5lciA9IHRoaXMubm90ZWJvb2tFZGl0b3Iub25EaWREeW5hbWljT3V0cHV0UmVuZGVyZWQoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUuY2VsbC51cmkudG9TdHJpbmcoKSA9PT0gdGhpcy5jZWxsLm9yaWdpbmFsLnVyaS50b1N0cmluZygpICYmIHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkpIHtcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5jZWxsLm9yaWdpbmFsLmlkLCBbJ25iLWNlbGxEZWxldGVkJ10sIFtdKTtcblx0XHRcdFx0XHRcdG9yaWdpbmFsT3V0cHV0UmVuZGVyTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRPdXRwdXRSZW5kZXJMaXN0ZW5lciA9IHRoaXMubm90ZWJvb2tFZGl0b3Iub25EaWREeW5hbWljT3V0cHV0UmVuZGVyZWQoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUuY2VsbC51cmkudG9TdHJpbmcoKSA9PT0gdGhpcy5jZWxsLm1vZGlmaWVkLnVyaS50b1N0cmluZygpICYmIHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkpIHtcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5Nb2RpZmllZCwgdGhpcy5jZWxsLm1vZGlmaWVkLmlkLCBbJ25iLWNlbGxBZGRlZCddLCBbXSk7XG5cdFx0XHRcdFx0XHRtb2RpZmllZE91dHB1dFJlbmRlckxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKG9yaWdpbmFsT3V0cHV0UmVuZGVyTGlzdGVuZXIpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcihtb2RpZmllZE91dHB1dFJlbmRlckxpc3RlbmVyKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV2Ugc2hvdWxkIHVzZSB0aGUgb3JpZ2luYWwgdGV4dCBtb2RlbCBoZXJlXG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0VmlldyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0cHV0Q29udGFpbmVyLCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCEsIHRoaXMuY2VsbCwgdGhpcy5jZWxsLm9yaWdpbmFsLCBEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5fb3V0cHV0TGVmdENvbnRhaW5lcik7XG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0Vmlldy5yZW5kZXIoKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX291dHB1dExlZnRWaWV3KTtcblx0XHRcdHRoaXMuX291dHB1dFJpZ2h0VmlldyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0cHV0Q29udGFpbmVyLCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCEsIHRoaXMuY2VsbCwgdGhpcy5jZWxsLm1vZGlmaWVkLCBEaWZmU2lkZS5Nb2RpZmllZCwgdGhpcy5fb3V0cHV0UmlnaHRDb250YWluZXIpO1xuXHRcdFx0dGhpcy5fb3V0cHV0UmlnaHRWaWV3LnJlbmRlcigpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb3V0cHV0UmlnaHRWaWV3KTtcblxuXHRcdFx0aWYgKG91dHB1dE1vZGlmaWVkICYmICFvdXRwdXRNZXRhZGF0YUNoYW5nZU9ubHkpIHtcblx0XHRcdFx0dGhpcy5fZGVjb3JhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG91dHB1dE1ldGFkYXRhQ2hhbmdlT25seSkge1xuXG5cdFx0XHRcdHRoaXMuX291dHB1dE1ldGFkYXRhQ29udGFpbmVyLnN0eWxlLnRvcCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLnJhd091dHB1dEhlaWdodH1weGA7XG5cdFx0XHRcdC8vIHNpbmdsZSBvdXRwdXQsIG1ldGFkYXRhIGNoYW5nZSwgbGV0J3MgcmVuZGVyIGEgZGlmZiBlZGl0b3IgZm9yIG1ldGFkYXRhXG5cdFx0XHRcdHRoaXMuX291dHB1dE1ldGFkYXRhRWRpdG9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9yV2lkZ2V0LCB0aGlzLl9vdXRwdXRNZXRhZGF0YUNvbnRhaW5lciwge1xuXHRcdFx0XHRcdC4uLmZpeGVkRGlmZkVkaXRvck9wdGlvbnMsXG5cdFx0XHRcdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogdGhpcy5ub3RlYm9va0VkaXRvci5nZXRPdmVyZmxvd0NvbnRhaW5lckRvbU5vZGUoKSxcblx0XHRcdFx0XHRyZWFkT25seTogdHJ1ZSxcblx0XHRcdFx0XHRpZ25vcmVUcmltV2hpdGVzcGFjZTogZmFsc2UsXG5cdFx0XHRcdFx0YXV0b21hdGljTGF5b3V0OiBmYWxzZSxcblx0XHRcdFx0XHRkaW1lbnNpb246IHtcblx0XHRcdFx0XHRcdGhlaWdodDogT1VUUFVUX0VESVRPUl9IRUlHSFRfTUFHSUMsXG5cdFx0XHRcdFx0XHR3aWR0aDogdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgdHJ1ZSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRvcmlnaW5hbEVkaXRvcjogZ2V0T3B0aW1pemVkTmVzdGVkQ29kZUVkaXRvcldpZGdldE9wdGlvbnMoKSxcblx0XHRcdFx0XHRtb2RpZmllZEVkaXRvcjogZ2V0T3B0aW1pemVkTmVzdGVkQ29kZUVkaXRvcldpZGdldE9wdGlvbnMoKVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9vdXRwdXRNZXRhZGF0YUVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsT3V0cHV0TWV0YWRhdGFTb3VyY2UgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmNlbGwub3JpZ2luYWwub3V0cHV0c1swXS5tZXRhZGF0YSA/PyB7fSwgdW5kZWZpbmVkLCAnXFx0Jyk7XG5cdFx0XHRcdGNvbnN0IG1vZGlmaWVkT3V0cHV0TWV0YWRhdGFTb3VyY2UgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmNlbGwubW9kaWZpZWQub3V0cHV0c1swXS5tZXRhZGF0YSA/PyB7fSwgdW5kZWZpbmVkLCAnXFx0Jyk7XG5cblx0XHRcdFx0Y29uc3QgbW9kZSA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb24nKTtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxNb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKG9yaWdpbmFsT3V0cHV0TWV0YWRhdGFTb3VyY2UsIG1vZGUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IG1vZGlmaWVkTW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbChtb2RpZmllZE91dHB1dE1ldGFkYXRhU291cmNlLCBtb2RlLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdHRoaXMuX291dHB1dE1ldGFkYXRhRWRpdG9yLnNldE1vZGVsKHtcblx0XHRcdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxNb2RlbCxcblx0XHRcdFx0XHRtb2RpZmllZDogbW9kaWZpZWRNb2RlbFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLmNlbGwub3V0cHV0TWV0YWRhdGFIZWlnaHQgPSB0aGlzLl9vdXRwdXRNZXRhZGF0YUVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb3V0cHV0TWV0YWRhdGFFZGl0b3Iub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5vdXRwdXRNZXRhZGF0YUhlaWdodCA9IGUuY29udGVudEhlaWdodDtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdH1cblxuXHRfZGVjb3JhdGUoKSB7XG5cdFx0aWYgKHRoaXMuY2VsbC5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkpIHtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5jZWxsLm9yaWdpbmFsLmlkLCBbJ25iLWNlbGxEZWxldGVkJ10sIFtdKTtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5Nb2RpZmllZCwgdGhpcy5jZWxsLm1vZGlmaWVkLmlkLCBbJ25iLWNlbGxBZGRlZCddLCBbXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5PcmlnaW5hbCwgdGhpcy5jZWxsLm9yaWdpbmFsLmlkLCBbXSwgWyduYi1jZWxsRGVsZXRlZCddKTtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhEaWZmU2lkZS5Nb2RpZmllZCwgdGhpcy5jZWxsLm1vZGlmaWVkLmlkLCBbXSwgWyduYi1jZWxsQWRkZWQnXSk7XG5cdFx0fVxuXHR9XG5cblx0X3Nob3dPdXRwdXRzUmVuZGVyZXIoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dFZpZXdDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX291dHB1dFZpZXdDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRcdHRoaXMuX291dHB1dExlZnRWaWV3Py5zaG93T3V0cHV0cygpO1xuXHRcdFx0dGhpcy5fb3V0cHV0UmlnaHRWaWV3Py5zaG93T3V0cHV0cygpO1xuXHRcdFx0dGhpcy5fb3V0cHV0TWV0YWRhdGFFZGl0b3I/LmxheW91dCh7XG5cdFx0XHRcdHdpZHRoOiB0aGlzLl9lZGl0b3I/LmdldFZpZXdXaWR0aCgpIHx8IHRoaXMuY2VsbC5nZXRDb21wdXRlZENlbGxDb250YWluZXJXaWR0aCh0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKSwgZmFsc2UsIHRydWUpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm91dHB1dE1ldGFkYXRhSGVpZ2h0XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fZGVjb3JhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRfaGlkZU91dHB1dHNSZW5kZXJlcigpIHtcblx0XHRpZiAodGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb3V0cHV0Vmlld0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0XHR0aGlzLl9vdXRwdXRMZWZ0Vmlldz8uaGlkZU91dHB1dHMoKTtcblx0XHRcdHRoaXMuX291dHB1dFJpZ2h0Vmlldz8uaGlkZU91dHB1dHMoKTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVTb3VyY2VFZGl0b3IoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLmNlbGxIZWFkZXJDb250YWluZXI7XG5cdFx0dGhpcy5fY2VsbEhlYWRlckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdHRoaXMuX2NlbGxIZWFkZXJDb250YWluZXIuaW5uZXJUZXh0ID0gJyc7XG5cdFx0Y29uc3QgbW9kaWZpZWRDZWxsID0gdGhpcy5jZWxsLm1vZGlmaWVkO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvckNvbnRhaW5lcjtcblx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGlmZicpO1xuXG5cdFx0Y29uc3QgcmVuZGVyU291cmNlRWRpdG9yID0gKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuY2VsbC5jZWxsRm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdHRoaXMuY2VsbC5lZGl0b3JIZWlnaHQgPSAwO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IG1vZGlmaWVkQ2VsbC50ZXh0TW9kZWwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKS5mb250SW5mby5saW5lSGVpZ2h0IHx8IDE3O1xuXHRcdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gdGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0ICE9PSAwID8gdGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0IDogdGhpcy5jZWxsLmNvbXB1dGVJbnB1dEVkaXRvckhlaWdodChsaW5lSGVpZ2h0KTtcblxuXHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke2VkaXRvckhlaWdodH1weGA7XG5cdFx0XHR0aGlzLl9lZGl0b3JDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cblx0XHRcdGlmICh0aGlzLl9lZGl0b3IpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRcdGlmIChjb250ZW50SGVpZ2h0ID49IDApIHtcblx0XHRcdFx0XHR0aGlzLmNlbGwuZWRpdG9ySGVpZ2h0ID0gY29udGVudEhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2VkaXRvciA9IHRoaXMudGVtcGxhdGVEYXRhLnNvdXJjZUVkaXRvcjtcblx0XHRcdC8vIElmIHRoZXJlIGlzIG9ubHkgMSBsaW5lLCB0aGVuIGVuc3VyZSB3ZSBoYXZlIHRoZSBuZWNlc3NhcnkgcGFkZGluZyB0byBkaXNwbGF5IHRoZSBidXR0b24gZm9yIHdoaXRlc3BhY2VzLlxuXHRcdFx0Ly8gRS5nLiBhc3N1bWUgd2UgaGF2ZSBhIGNlbGwgd2l0aCAxIGxpbmUgYW5kIHdlIGFkZCBzb21lIHdoaXRlc3BhY2UsXG5cdFx0XHQvLyBUaGVuIGRpZmYgZWRpdG9yIGRpc3BsYXlzIHRoZSBidXR0b24gYFNob3cgV2hpdGVzcGFjZSBEaWZmZXJlbmNlc2AsIGhvd2V2ZXIgd2l0aCAxMiBwYWRkaW5ncyBvbiB0aGUgdG9wLCB0aGVcblx0XHRcdC8vIGJ1dHRvbiBjYW4gZ2V0IGN1dCBvZmYuXG5cdFx0XHRjb25zdCBvcHRpb25zOiBJRGlmZkVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRcdHBhZGRpbmc6IGdldEVkaXRvclBhZGRpbmcobGluZUNvdW50KVxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHVuY2hhbmdlZFJlZ2lvbnMgPSB0aGlzLl9yZWdpc3RlcihnZXRVbmNoYW5nZWRSZWdpb25TZXR0aW5ncyh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0XHRpZiAodW5jaGFuZ2VkUmVnaW9ucy5vcHRpb25zLmVuYWJsZWQpIHtcblx0XHRcdFx0b3B0aW9ucy5oaWRlVW5jaGFuZ2VkUmVnaW9ucyA9IHVuY2hhbmdlZFJlZ2lvbnMub3B0aW9ucztcblx0XHRcdH1cblx0XHRcdHRoaXMuX2VkaXRvci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodW5jaGFuZ2VkUmVnaW9ucy5vbkRpZENoYW5nZUVuYWJsZW1lbnQoKCkgPT4ge1xuXHRcdFx0XHRvcHRpb25zLmhpZGVVbmNoYW5nZWRSZWdpb25zID0gdW5jaGFuZ2VkUmVnaW9ucy5vcHRpb25zO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3I/LnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9lZGl0b3IubGF5b3V0KHtcblx0XHRcdFx0d2lkdGg6IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLndpZHRoIC0gMiAqIERJRkZfQ0VMTF9NQVJHSU4sXG5cdFx0XHRcdGhlaWdodDogZWRpdG9ySGVpZ2h0XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmNlbGwuY2VsbEZvbGRpbmdTdGF0ZSA9PT0gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQgJiYgZS5jb250ZW50SGVpZ2h0Q2hhbmdlZCAmJiB0aGlzLmNlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQgIT09IGUuY29udGVudEhlaWdodCkge1xuXHRcdFx0XHRcdHRoaXMuY2VsbC5lZGl0b3JIZWlnaHQgPSBlLmNvbnRlbnRIZWlnaHQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2luaXRpYWxpemVTb3VyY2VEaWZmRWRpdG9yKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX2NlbGxIZWFkZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0UHJvcGVydHlIZWFkZXIsXG5cdFx0XHR0aGlzLmNlbGwsXG5cdFx0XHR0aGlzLl9jZWxsSGVhZGVyQ29udGFpbmVyLFxuXHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvcixcblx0XHRcdHtcblx0XHRcdFx0dXBkYXRlSW5mb1JlbmRlcmluZzogKCkgPT4gcmVuZGVyU291cmNlRWRpdG9yKCksXG5cdFx0XHRcdGNoZWNrSWZNb2RpZmllZDogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNlbGwubW9kaWZpZWQ/LnRleHRNb2RlbC5nZXRUZXh0QnVmZmVySGFzaCgpICE9PSB0aGlzLmNlbGwub3JpZ2luYWw/LnRleHRNb2RlbC5nZXRUZXh0QnVmZmVySGFzaCgpID8geyByZWFzb246IHVuZGVmaW5lZCB9IDogZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldEZvbGRpbmdTdGF0ZTogKCkgPT4gdGhpcy5jZWxsLmNlbGxGb2xkaW5nU3RhdGUsXG5cdFx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZTogKHN0YXRlKSA9PiB0aGlzLmNlbGwuY2VsbEZvbGRpbmdTdGF0ZSA9IHN0YXRlLFxuXHRcdFx0XHR1bkNoYW5nZWRMYWJlbDogJ0lucHV0Jyxcblx0XHRcdFx0Y2hhbmdlZExhYmVsOiAnSW5wdXQgY2hhbmdlZCcsXG5cdFx0XHRcdHByZWZpeDogJ2lucHV0Jyxcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTm90ZWJvb2tEaWZmQ2VsbElucHV0VGl0bGVcblx0XHRcdH1cblx0XHQpKTtcblx0XHR0aGlzLl9jZWxsSGVhZGVyLmJ1aWxkSGVhZGVyKCk7XG5cdFx0cmVuZGVyU291cmNlRWRpdG9yKCk7XG5cblx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMudGVtcGxhdGVEYXRhLmlucHV0VG9vbGJhckNvbnRhaW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0Q2hhbmdlZCA9IE5PVEVCT09LX0RJRkZfQ0VMTF9JTlBVVC5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGlucHV0Q2hhbmdlZC5zZXQodGhpcy5jZWxsLm1vZGlmaWVkLnRleHRNb2RlbC5nZXRUZXh0QnVmZmVySGFzaCgpICE9PSB0aGlzLmNlbGwub3JpZ2luYWwudGV4dE1vZGVsLmdldFRleHRCdWZmZXJIYXNoKCkpO1xuXG5cdFx0Y29uc3QgaWdub3JlV2hpdGVzcGFjZSA9IE5PVEVCT09LX0RJRkZfQ0VMTF9JR05PUkVfV0hJVEVTUEFDRS5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGlnbm9yZSA9IHRoaXMudGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHRoaXMuY2VsbC5tb2RpZmllZC51cmksICdkaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJyk7XG5cdFx0aWdub3JlV2hpdGVzcGFjZS5zZXQoaWdub3JlKTtcblxuXHRcdHRoaXMuX3Rvb2xiYXIgPSB0aGlzLnRlbXBsYXRlRGF0YS50b29sYmFyO1xuXG5cdFx0dGhpcy5fdG9vbGJhci5jb250ZXh0ID0gdGhpcy5jZWxsO1xuXG5cdFx0Y29uc3QgcmVmcmVzaFRvb2xiYXIgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZ25vcmUgPSB0aGlzLnRleHRDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPih0aGlzLmNlbGwubW9kaWZpZWQudXJpLCAnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpO1xuXHRcdFx0aWdub3JlV2hpdGVzcGFjZS5zZXQoaWdub3JlKTtcblx0XHRcdGNvbnN0IGhhc0NoYW5nZXMgPSB0aGlzLmNlbGwubW9kaWZpZWQudGV4dE1vZGVsLmdldFRleHRCdWZmZXJIYXNoKCkgIT09IHRoaXMuY2VsbC5vcmlnaW5hbC50ZXh0TW9kZWwuZ2V0VGV4dEJ1ZmZlckhhc2goKTtcblx0XHRcdGlucHV0Q2hhbmdlZC5zZXQoaGFzQ2hhbmdlcyk7XG5cblx0XHRcdGlmIChoYXNDaGFuZ2VzKSB7XG5cdFx0XHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5Ob3RlYm9va0RpZmZDZWxsSW5wdXRUaXRsZSwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSk7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBnZXRGbGF0QWN0aW9uQmFyQWN0aW9ucyhtZW51KTtcblx0XHRcdFx0dGhpcy5fdG9vbGJhci5zZXRBY3Rpb25zKGFjdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fdG9vbGJhci5zZXRBY3Rpb25zKFtdKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jZWxsLm1vZGlmaWVkLnRleHRNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gcmVmcmVzaFRvb2xiYXIoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKHRoaXMuY2VsbC5tb2RpZmllZC51cmksICdkaWZmRWRpdG9yJykgJiZcblx0XHRcdFx0ZS5hZmZlY3RlZEtleXMuaGFzKCdkaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJykpIHtcblx0XHRcdFx0cmVmcmVzaFRvb2xiYXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0cmVmcmVzaFRvb2xiYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2luaXRpYWxpemVTb3VyY2VEaWZmRWRpdG9yKCkge1xuXHRcdGNvbnN0IFtvcmlnaW5hbFJlZiwgbW9kaWZpZWRSZWZdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHRoaXMuY2VsbC5vcmlnaW5hbC51cmkpLFxuXHRcdFx0dGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHRoaXMuY2VsbC5tb2RpZmllZC51cmkpXSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob3JpZ2luYWxSZWYpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGlmaWVkUmVmKTtcblxuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRvcmlnaW5hbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdm0gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IhLmNyZWF0ZVZpZXdNb2RlbCh7XG5cdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCxcblx0XHRcdG1vZGlmaWVkOiBtb2RpZmllZFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLFxuXHRcdH0pKTtcblxuXHRcdC8vIFJlZHVjZXMgZmxpY2tlciAoY29tcHV0ZSB0aGlzIGJlZm9yZSBzZXR0aW5nIHRoZSBtb2RlbClcblx0XHQvLyBFbHNlIHdoZW4gdGhlIG1vZGVsIGlzIHNldCwgdGhlIGhlaWdodCBvZiB0aGUgZWRpdG9yIHdpbGwgYmUgeCwgYWZ0ZXIgZGlmZiBpcyBjb21wdXRlZCwgdGhlbiBoZWlnaHQgd2lsbCBiZSB5LlxuXHRcdC8vICYgdGhhdCByZXN1bHRzIGluIGZsaWNrZXIuXG5cdFx0YXdhaXQgdm0ud2FpdEZvckRpZmYoKTtcblx0XHR0aGlzLl9lZGl0b3IhLnNldE1vZGVsKHZtKTtcblxuXHRcdGNvbnN0IGhhbmRsZVZpZXdTdGF0ZUNoYW5nZSA9ICgpID0+IHtcblx0XHRcdHRoaXMuX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQgPSB0cnVlO1xuXHRcdH07XG5cblx0XHRjb25zdCBoYW5kbGVTY3JvbGxDaGFuZ2UgPSAoZTogZWRpdG9yQ29tbW9uLklTY3JvbGxFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuc2Nyb2xsVG9wQ2hhbmdlZCB8fCBlLnNjcm9sbExlZnRDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLnVwZGF0ZUVkaXRvck9wdGlvbnNGb3JXaGl0ZXNwYWNlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yIS5nZXRPcmlnaW5hbEVkaXRvcigpLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKGhhbmRsZVZpZXdTdGF0ZUNoYW5nZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvciEuZ2V0T3JpZ2luYWxFZGl0b3IoKS5vbkRpZFNjcm9sbENoYW5nZShoYW5kbGVTY3JvbGxDaGFuZ2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3IhLmdldE1vZGlmaWVkRWRpdG9yKCkub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oaGFuZGxlVmlld1N0YXRlQ2hhbmdlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yIS5nZXRNb2RpZmllZEVkaXRvcigpLm9uRGlkU2Nyb2xsQ2hhbmdlKGhhbmRsZVNjcm9sbENoYW5nZSkpO1xuXG5cdFx0Y29uc3QgZWRpdG9yVmlld1N0YXRlID0gdGhpcy5jZWxsLmdldFNvdXJjZUVkaXRvclZpZXdTdGF0ZSgpIGFzIGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGw7XG5cdFx0aWYgKGVkaXRvclZpZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yIS5yZXN0b3JlVmlld1N0YXRlKGVkaXRvclZpZXdTdGF0ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMuX2VkaXRvciEuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdHRoaXMuY2VsbC5lZGl0b3JIZWlnaHQgPSBjb250ZW50SGVpZ2h0O1xuXHR9XG5cdHByaXZhdGUgdXBkYXRlRWRpdG9yT3B0aW9uc0ZvcldoaXRlc3BhY2UoKSB7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fZWRpdG9yO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHVyaSA9IGVkaXRvci5nZXRNb2RlbCgpPy5tb2RpZmllZC51cmkgfHwgZWRpdG9yLmdldE1vZGVsKCk/Lm9yaWdpbmFsLnVyaTtcblx0XHRpZiAoIXVyaSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpZ25vcmVUcmltV2hpdGVzcGFjZSA9IHRoaXMudGV4dENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHVyaSwgJ2RpZmZFZGl0b3IuaWdub3JlVHJpbVdoaXRlc3BhY2UnKTtcblx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlIH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0Q29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odXJpLCAnZGlmZkVkaXRvcicpICYmXG5cdFx0XHRcdGUuYWZmZWN0ZWRLZXlzLmhhcygnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpKSB7XG5cdFx0XHRcdGNvbnN0IGlnbm9yZVRyaW1XaGl0ZXNwYWNlID0gdGhpcy50ZXh0Q29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4odXJpLCAnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScpO1xuXHRcdFx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXHRsYXlvdXQoc3RhdGU6IElEaWZmRWxlbWVudExheW91dFN0YXRlKSB7XG5cdFx0RE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyh0aGlzLl9kaWZmRWRpdG9yQ29udGFpbmVyKSwgKCkgPT4ge1xuXHRcdFx0aWYgKHN0YXRlLmVkaXRvckhlaWdodCAmJiB0aGlzLl9lZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodH1weGA7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoe1xuXHRcdFx0XHRcdHdpZHRoOiB0aGlzLl9lZGl0b3IhLmdldFZpZXdXaWR0aCgpLFxuXHRcdFx0XHRcdGhlaWdodDogdGhpcy5jZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhdGUub3V0ZXJXaWR0aCAmJiB0aGlzLl9lZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuY2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodH1weGA7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlLm1ldGFkYXRhSGVpZ2h0IHx8IHN0YXRlLm91dGVyV2lkdGgpIHtcblx0XHRcdFx0aWYgKHRoaXMuX21ldGFkYXRhRWRpdG9yQ29udGFpbmVyKSB7XG5cdFx0XHRcdFx0dGhpcy5fbWV0YWRhdGFFZGl0b3JDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5jZWxsLmxheW91dEluZm8ubWV0YWRhdGFIZWlnaHR9cHhgO1xuXHRcdFx0XHRcdHRoaXMuX21ldGFkYXRhRWRpdG9yPy5sYXlvdXQoe1xuXHRcdFx0XHRcdFx0d2lkdGg6IHRoaXMuX2VkaXRvcj8uZ2V0Vmlld1dpZHRoKCkgfHwgdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgdHJ1ZSksXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlLm91dHB1dFRvdGFsSGVpZ2h0IHx8IHN0YXRlLm91dGVyV2lkdGgpIHtcblx0XHRcdFx0aWYgKHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0XHRcdHRoaXMuX291dHB1dEVkaXRvckNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmNlbGwubGF5b3V0SW5mby5vdXRwdXRUb3RhbEhlaWdodH1weGA7XG5cdFx0XHRcdFx0dGhpcy5fb3V0cHV0RWRpdG9yPy5sYXlvdXQoe1xuXHRcdFx0XHRcdFx0d2lkdGg6IHRoaXMuX2VkaXRvcj8uZ2V0Vmlld1dpZHRoKCkgfHwgdGhpcy5jZWxsLmdldENvbXB1dGVkQ2VsbENvbnRhaW5lcldpZHRoKHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLCBmYWxzZSwgdHJ1ZSksXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IHRoaXMuY2VsbC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5fb3V0cHV0TWV0YWRhdGFDb250YWluZXIpIHtcblx0XHRcdFx0XHR0aGlzLl9vdXRwdXRNZXRhZGF0YUNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLmNlbGwubGF5b3V0SW5mby5vdXRwdXRNZXRhZGF0YUhlaWdodH1weGA7XG5cdFx0XHRcdFx0dGhpcy5fb3V0cHV0TWV0YWRhdGFDb250YWluZXIuc3R5bGUudG9wID0gYCR7dGhpcy5jZWxsLmxheW91dEluZm8ub3V0cHV0VG90YWxIZWlnaHQgLSB0aGlzLmNlbGwubGF5b3V0SW5mby5vdXRwdXRNZXRhZGF0YUhlaWdodH1weGA7XG5cdFx0XHRcdFx0dGhpcy5fb3V0cHV0TWV0YWRhdGFFZGl0b3I/LmxheW91dCh7XG5cdFx0XHRcdFx0XHR3aWR0aDogdGhpcy5fZWRpdG9yPy5nZXRWaWV3V2lkdGgoKSB8fCB0aGlzLmNlbGwuZ2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgodGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCksIGZhbHNlLCB0cnVlKSxcblx0XHRcdFx0XHRcdGhlaWdodDogdGhpcy5jZWxsLmxheW91dEluZm8ub3V0cHV0TWV0YWRhdGFIZWlnaHRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxheW91dE5vdGVib29rQ2VsbCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHQvLyBUaGUgZWRpdG9yIGlzbid0IGRpc3Bvc2VkIHlldCwgaXQgY2FuIGJlIHJlLXVzZWQuXG5cdFx0Ly8gSG93ZXZlciB0aGUgbW9kZWwgY2FuIGJlIGRpc3Bvc2VkIGJlZm9yZSB0aGUgZWRpdG9yICYgdGhhdCBjYXVzZXMgaXNzdWVzLlxuXHRcdGlmICh0aGlzLl9lZGl0b3IpIHtcblx0XHRcdHRoaXMuX2VkaXRvci5zZXRNb2RlbChudWxsKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZWRpdG9yICYmIHRoaXMuX2VkaXRvclZpZXdTdGF0ZUNoYW5nZWQpIHtcblx0XHRcdHRoaXMuY2VsbC5zYXZlU3BpcmNlRWRpdG9yVmlld1N0YXRlKHRoaXMuX2VkaXRvci5zYXZlVmlld1N0YXRlKCkpO1xuXHRcdH1cblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBDb2xsYXBzZWRDZWxsT3ZlcmxheVdpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRGlmZkNlbGxNYXJnaW5PdmVybGF5IHtcblx0cHJpdmF0ZSByZWFkb25seSBfbm9kZXMgPSBET00uaCgnZGl2LmRpZmYtaGlkZGVuLWNlbGxzJywgW1xuXHRcdERPTS5oKCdkaXYuY2VudGVyQGNvbnRlbnQnLCB7IHN0eWxlOiB7IGRpc3BsYXk6ICdmbGV4JyB9IH0sIFtcblx0XHRcdERPTS4kKCdhJywge1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Nob3dVbmNoYW5nZWRDZWxscycsICdTaG93IFVuY2hhbmdlZCBDZWxscycpLFxuXHRcdFx0XHRyb2xlOiAnYnV0dG9uJyxcblx0XHRcdFx0b25jbGljazogKCkgPT4geyB0aGlzLl9hY3Rpb24uZmlyZSgpOyB9XG5cdFx0XHR9LFxuXHRcdFx0XHQuLi5yZW5kZXJMYWJlbFdpdGhJY29ucygnJCh1bmZvbGQpJykpXVxuXHRcdCksXG5cdF0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25BY3Rpb24gPSB0aGlzLl9hY3Rpb24uZXZlbnQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fbm9kZXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9ub2Rlcy5yb290KTtcblx0fVxuXG5cdHB1YmxpYyBzaG93KCkge1xuXHRcdHRoaXMuX25vZGVzLnJvb3Quc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpIHtcblx0XHR0aGlzLl9ub2Rlcy5yb290LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLmhpZGUoKTtcblx0XHR0aGlzLmNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzLl9ub2Rlcy5yb290KTtcblx0XHRET00ucmVzZXQodGhpcy5fbm9kZXMucm9vdCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVbmNoYW5nZWRDZWxsT3ZlcmxheVdpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRGlmZkNlbGxNYXJnaW5PdmVybGF5IHtcblx0cHJpdmF0ZSByZWFkb25seSBfbm9kZXMgPSBET00uaCgnZGl2LmRpZmYtaGlkZGVuLWNlbGxzJywgW1xuXHRcdERPTS5oKCdkaXYuY2VudGVyQGNvbnRlbnQnLCB7IHN0eWxlOiB7IGRpc3BsYXk6ICdmbGV4JyB9IH0sIFtcblx0XHRcdERPTS4kKCdhJywge1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2hpZGVVbmNoYW5nZWRDZWxscycsICdIaWRlIFVuY2hhbmdlZCBDZWxscycpLFxuXHRcdFx0XHRyb2xlOiAnYnV0dG9uJyxcblx0XHRcdFx0b25jbGljazogKCkgPT4geyB0aGlzLl9hY3Rpb24uZmlyZSgpOyB9XG5cdFx0XHR9LFxuXHRcdFx0XHQuLi5yZW5kZXJMYWJlbFdpdGhJY29ucygnJChmb2xkKScpXG5cdFx0XHQpLFxuXHRcdF1cblx0XHQpLFxuXHRdKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uQWN0aW9uID0gdGhpcy5fYWN0aW9uLmV2ZW50O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnRcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX25vZGVzLnJvb3Quc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fbm9kZXMucm9vdCk7XG5cdH1cblxuXHRwdWJsaWMgc2hvdygpIHtcblx0XHR0aGlzLl9ub2Rlcy5yb290LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHR9XG5cblx0cHVibGljIGhpZGUoKSB7XG5cdFx0dGhpcy5fbm9kZXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuaGlkZSgpO1xuXHRcdHRoaXMuY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuX25vZGVzLnJvb3QpO1xuXHRcdERPTS5yZXNldCh0aGlzLl9ub2Rlcy5yb290KTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQXVDLHdCQUF3QixrQkFBa0IsYUFBYSw0QkFBNEIsc0JBQXNCLGdDQUE0SCx5Q0FBeUM7QUFDclQsU0FBNkUsVUFBVSxrQkFBMkMsMEJBQTBCLDZCQUE2QixzQ0FBaUcsc0NBQWlGLDhCQUE4QjtBQUN6WSxTQUFTLHdCQUFrRDtBQUMzRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGNBQWMsZUFBcUM7QUFFNUQsU0FBUywyQkFBMkI7QUFDcEMsU0FBZ0IsY0FBYyxRQUFRLHNCQUFzQjtBQUM1RCxTQUFT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QztBQUVELFNBQWlCLFVBQVUsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQzdELFNBQWdCLFdBQVcsS0FBSyxRQUFRO0FBTXZDLFNBQUssT0FBTyxLQUFLLE1BQU0sVUFBVTtBQUNqQyxjQUFVLFlBQVksS0FBSyxPQUFPLElBQUk7QUFBQSxFQUN2QztBQUFBLEVBRU8sT0FBTztBQUNiLFNBQUssT0FBTyxLQUFLLE1BQU0sVUFBVTtBQUFBLEVBQ2xDO0FBQUEsRUFFTyxPQUFPO0FBQ2IsU0FBSyxPQUFPLEtBQUssTUFBTSxVQUFVO0FBQUEsRUFDbEM7QUFBQSxFQUNnQixVQUFVO0FBQ3pCLFNBQUssS0FBSztBQUNWLFNBQUssVUFBVSxZQUFZLEtBQUssT0FBTyxJQUFJO0FBQzNDLFFBQUksTUFBTSxLQUFLLE9BQU8sSUFBSTtBQUMxQixVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7IiwKICAibmFtZXMiOiBbImlnbm9yZVRyaW1XaGl0ZXNwYWNlIiwgIm1vZGUiLCAibW9kaWZpZWRPdXRwdXRzU291cmNlIiwgImlnbm9yZSJdCn0K
