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
import * as DOM from "../../../../../../base/browser/dom.js";
import { renderMarkdown } from "../../../../../../base/browser/markdownRenderer.js";
import { Action } from "../../../../../../base/common/actions.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import * as nls from "../../../../../../nls.js";
import { getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { WorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { IExtensionsWorkbenchService } from "../../../../extensions/common/extensions.js";
import { JUPYTER_EXTENSION_ID, RenderOutputType } from "../../notebookBrowser.js";
import { mimetypeIcon } from "../../notebookIcons.js";
import { CellContentPart } from "../cellPart.js";
import { CellUri, NotebookCellExecutionState, RENDERER_NOT_AVAILABLE, isTextStreamMime } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { INotebookService } from "../../../common/notebookService.js";
import { COPY_OUTPUT_COMMAND_ID } from "../../controller/cellOutputActions.js";
import { autorun, observableValue } from "../../../../../../base/common/observable.js";
import { NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from "../../../common/notebookContextKeys.js";
import { TEXT_BASED_MIMETYPES } from "../../viewModel/cellOutputTextHelper.js";
let CellOutputElement = class extends Disposable {
  constructor(notebookEditor, viewCell, cellOutputContainer, outputContainer, output, notebookService, quickInputService, parentContextKeyService, menuService, extensionsWorkbenchService, instantiationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.viewCell = viewCell;
    this.cellOutputContainer = cellOutputContainer;
    this.outputContainer = outputContainer;
    this.output = output;
    this.notebookService = notebookService;
    this.quickInputService = quickInputService;
    this.menuService = menuService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.instantiationService = instantiationService;
    this.toolbarDisposables = this._register(new DisposableStore());
    this.toolbarAttached = false;
    this._outputHeightTimer = null;
    this.contextKeyService = parentContextKeyService;
    this._register(this.output.model.onDidChangeData(() => {
      this.rerender();
    }));
    this._register(this.output.onDidResetRenderer(() => {
      this.rerender();
    }));
  }
  detach() {
    this.renderedOutputContainer?.remove();
    let count = 0;
    if (this.innerContainer) {
      for (let i = 0; i < this.innerContainer.childNodes.length; i++) {
        if (this.innerContainer.childNodes[i].className === "rendered-output") {
          count++;
        }
        if (count > 1) {
          break;
        }
      }
      if (count === 0) {
        this.innerContainer.remove();
      }
    }
    this.notebookEditor.removeInset(this.output);
  }
  updateDOMTop(top) {
    if (this.innerContainer) {
      this.innerContainer.style.top = `${top}px`;
    }
  }
  rerender() {
    if (this.notebookEditor.hasModel() && this.innerContainer && this.renderResult && this.renderResult.type === RenderOutputType.Extension) {
      const [mimeTypes, pick] = this.output.resolveMimeTypes(this.notebookEditor.textModel, this.notebookEditor.activeKernel?.preloadProvides);
      const pickedMimeType = mimeTypes[pick];
      if (pickedMimeType.mimeType === this.renderResult.mimeType && pickedMimeType.rendererId === this.renderResult.renderer.id) {
        const index = this.viewCell.outputsViewModels.indexOf(this.output);
        this.notebookEditor.updateOutput(this.viewCell, this.renderResult, this.viewCell.getOutputOffset(index));
        return;
      }
    }
    if (!this.innerContainer) {
      const currOutputIndex = this.cellOutputContainer.renderedOutputEntries.findIndex((entry) => entry.element === this);
      const previousSibling = currOutputIndex > 0 && !!this.cellOutputContainer.renderedOutputEntries[currOutputIndex - 1].element.innerContainer?.parentElement ? this.cellOutputContainer.renderedOutputEntries[currOutputIndex - 1].element.innerContainer : void 0;
      this.render(previousSibling);
    } else {
      const nextElement = this.innerContainer.nextElementSibling;
      this.toolbarDisposables.clear();
      const element = this.innerContainer;
      if (element) {
        element.remove();
        this.notebookEditor.removeInset(this.output);
      }
      this.render(nextElement);
    }
    this._relayoutCell();
  }
  // insert after previousSibling
  _generateInnerOutputContainer(previousSibling, pickedMimeTypeRenderer) {
    this.innerContainer = DOM.$(".output-inner-container");
    if (previousSibling && previousSibling.nextElementSibling) {
      this.outputContainer.domNode.insertBefore(this.innerContainer, previousSibling.nextElementSibling);
    } else {
      this.outputContainer.domNode.appendChild(this.innerContainer);
    }
    this.innerContainer.setAttribute("output-mime-type", pickedMimeTypeRenderer.mimeType);
    return this.innerContainer;
  }
  render(previousSibling) {
    const index = this.viewCell.outputsViewModels.indexOf(this.output);
    if (this.viewCell.isOutputCollapsed || !this.notebookEditor.hasModel()) {
      this.cellOutputContainer.flagAsStale();
      return void 0;
    }
    const notebookUri = CellUri.parse(this.viewCell.uri)?.notebook;
    if (!notebookUri) {
      return void 0;
    }
    const notebookTextModel = this.notebookEditor.textModel;
    const [mimeTypes, pick] = this.output.resolveMimeTypes(notebookTextModel, this.notebookEditor.activeKernel?.preloadProvides);
    if (!mimeTypes.find((mimeType) => mimeType.isTrusted) || mimeTypes.length === 0) {
      this.viewCell.updateOutputHeight(index, 0, "CellOutputElement#noMimeType");
      return void 0;
    }
    const selectedPresentation = mimeTypes[pick];
    let renderer = this.notebookService.getRendererInfo(selectedPresentation.rendererId);
    if (!renderer && selectedPresentation.mimeType.indexOf("text/") > -1) {
      renderer = this.notebookService.getRendererInfo("vscode.builtin-renderer");
    }
    const innerContainer = this._generateInnerOutputContainer(previousSibling, selectedPresentation);
    if (index === 0 || this.output.visible.get()) {
      this._attachToolbar(innerContainer, notebookTextModel, this.notebookEditor.activeKernel, index, mimeTypes);
    } else {
      this._register(autorun((reader) => {
        const visible = reader.readObservable(this.output.visible);
        if (visible && !this.toolbarAttached) {
          this._attachToolbar(innerContainer, notebookTextModel, this.notebookEditor.activeKernel, index, mimeTypes);
        } else if (!visible) {
          this.toolbarDisposables.clear();
        }
        this.cellOutputContainer.checkForHiddenOutputs();
      }));
      this.cellOutputContainer.hasHiddenOutputs.set(true, void 0);
    }
    this.renderedOutputContainer = DOM.append(innerContainer, DOM.$(".rendered-output"));
    this.renderResult = renderer ? { type: RenderOutputType.Extension, renderer, source: this.output, mimeType: selectedPresentation.mimeType } : this._renderMissingRenderer(this.output, selectedPresentation.mimeType);
    this.output.pickedMimeType = selectedPresentation;
    if (!this.renderResult) {
      this.viewCell.updateOutputHeight(index, 0, "CellOutputElement#renderResultUndefined");
      return void 0;
    }
    this.notebookEditor.createOutput(this.viewCell, this.renderResult, this.viewCell.getOutputOffset(index), false);
    innerContainer.classList.add("background");
    return { initRenderIsSynchronous: false };
  }
  _renderMissingRenderer(viewModel, preferredMimeType) {
    if (!viewModel.model.outputs.length) {
      return this._renderMessage(viewModel, nls.localize("empty", "Cell has no output"));
    }
    if (!preferredMimeType) {
      const mimeTypes = viewModel.model.outputs.map((op) => op.mime);
      const mimeTypesMessage = mimeTypes.join(", ");
      return this._renderMessage(viewModel, nls.localize("noRenderer.2", "No renderer could be found for output. It has the following mimetypes: {0}", mimeTypesMessage));
    }
    return this._renderSearchForMimetype(viewModel, preferredMimeType);
  }
  _renderSearchForMimetype(viewModel, mimeType) {
    const query = `@tag:notebookRenderer ${mimeType}`;
    const p = DOM.$("p", void 0, `No renderer could be found for mimetype "${mimeType}", but one might be available on the Marketplace.`);
    const a = DOM.$("a", { href: `command:workbench.extensions.search?%22${query}%22`, class: "monaco-button monaco-text-button", tabindex: 0, role: "button", style: "padding: 8px; text-decoration: none; color: rgb(255, 255, 255); background-color: rgb(14, 99, 156); max-width: 200px;" }, `Search Marketplace`);
    return {
      type: RenderOutputType.Html,
      source: viewModel,
      htmlContent: p.outerHTML + a.outerHTML
    };
  }
  _renderMessage(viewModel, message) {
    const el = DOM.$("p", void 0, message);
    return { type: RenderOutputType.Html, source: viewModel, htmlContent: el.outerHTML };
  }
  shouldEnableCopy(mimeTypes) {
    if (!mimeTypes.find((mimeType) => TEXT_BASED_MIMETYPES.indexOf(mimeType.mimeType) || mimeType.mimeType.startsWith("image/"))) {
      return false;
    }
    if (isTextStreamMime(mimeTypes[0].mimeType)) {
      const cellViewModel = this.output.cellViewModel;
      const index = cellViewModel.outputsViewModels.indexOf(this.output);
      if (index > 0) {
        const previousOutput = cellViewModel.model.outputs[index - 1];
        return !isTextStreamMime(previousOutput.outputs[0].mime);
      }
    }
    return true;
  }
  async _attachToolbar(outputItemDiv, notebookTextModel, kernel, index, mimeTypes) {
    const hasMultipleMimeTypes = mimeTypes.filter((mimeType) => mimeType.isTrusted).length > 1;
    const isCopyEnabled = this.shouldEnableCopy(mimeTypes);
    if (index > 0 && !hasMultipleMimeTypes && !isCopyEnabled) {
      return;
    }
    if (!this.notebookEditor.hasModel()) {
      return;
    }
    outputItemDiv.style.position = "relative";
    const mimeTypePicker = DOM.$(".cell-output-toolbar");
    outputItemDiv.appendChild(mimeTypePicker);
    const toolbar = this.toolbarDisposables.add(this.instantiationService.createInstance(WorkbenchToolBar, mimeTypePicker, {
      renderDropdownAsChildElement: false
    }));
    toolbar.context = {
      ui: true,
      cell: this.output.cellViewModel,
      outputViewModel: this.output,
      notebookEditor: this.notebookEditor,
      $mid: MarshalledId.NotebookCellActionContext
    };
    const pickAction = this.toolbarDisposables.add(new Action(
      "notebook.output.pickMimetype",
      nls.localize("pickMimeType", "Change Presentation"),
      ThemeIcon.asClassName(mimetypeIcon),
      void 0,
      async (_context) => this._pickActiveMimeTypeRenderer(outputItemDiv, notebookTextModel, kernel, this.output)
    ));
    const menuContextKeyService = this.toolbarDisposables.add(this.contextKeyService.createScoped(outputItemDiv));
    const hasHiddenOutputs = NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS.bindTo(menuContextKeyService);
    const isFirstCellOutput = NOTEBOOK_CELL_IS_FIRST_OUTPUT.bindTo(menuContextKeyService);
    const cellOutputMimetype = NOTEBOOK_CELL_OUTPUT_MIMETYPE.bindTo(menuContextKeyService);
    isFirstCellOutput.set(index === 0);
    if (mimeTypes[index]) {
      cellOutputMimetype.set(mimeTypes[index].mimeType);
    }
    this.toolbarDisposables.add(autorun((reader) => {
      hasHiddenOutputs.set(reader.readObservable(this.cellOutputContainer.hasHiddenOutputs));
    }));
    const menu = this.toolbarDisposables.add(this.menuService.createMenu(MenuId.NotebookOutputToolbar, menuContextKeyService));
    const updateMenuToolbar = () => {
      let { secondary } = getActionBarActions(menu.getActions({ shouldForwardArgs: true }), () => false);
      if (!isCopyEnabled) {
        secondary = secondary.filter((action) => action.id !== COPY_OUTPUT_COMMAND_ID);
      }
      if (hasMultipleMimeTypes) {
        secondary = [pickAction, ...secondary];
      }
      toolbar.setActions([], secondary);
    };
    updateMenuToolbar();
    this.toolbarDisposables.add(menu.onDidChange(updateMenuToolbar));
  }
  async _pickActiveMimeTypeRenderer(outputItemDiv, notebookTextModel, kernel, viewModel) {
    const [mimeTypes, currIndex] = viewModel.resolveMimeTypes(notebookTextModel, kernel?.preloadProvides);
    const items = [];
    const unsupportedItems = [];
    mimeTypes.forEach((mimeType2, index) => {
      if (mimeType2.isTrusted) {
        const arr = mimeType2.rendererId === RENDERER_NOT_AVAILABLE ? unsupportedItems : items;
        arr.push({
          label: mimeType2.mimeType,
          id: mimeType2.mimeType,
          index,
          picked: index === currIndex,
          detail: this._generateRendererInfo(mimeType2.rendererId),
          description: index === currIndex ? nls.localize("curruentActiveMimeType", "Currently Active") : void 0
        });
      }
    });
    if (unsupportedItems.some((m) => JUPYTER_RENDERER_MIMETYPES.includes(m.id))) {
      unsupportedItems.push({
        label: nls.localize("installJupyterPrompt", "Install additional renderers from the marketplace"),
        id: "installRenderers",
        index: mimeTypes.length
      });
    }
    const disposables = new DisposableStore();
    const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    picker.items = [
      ...items,
      { type: "separator" },
      ...unsupportedItems
    ];
    picker.activeItems = items.filter((item) => !!item.picked);
    picker.placeholder = items.length !== mimeTypes.length ? nls.localize("promptChooseMimeTypeInSecure.placeHolder", "Select mimetype to render for current output") : nls.localize("promptChooseMimeType.placeHolder", "Select mimetype to render for current output");
    const pick = await new Promise((resolve) => {
      disposables.add(picker.onDidAccept(() => {
        resolve(picker.selectedItems.length === 1 ? picker.selectedItems[0] : void 0);
        disposables.dispose();
      }));
      picker.show();
    });
    if (pick === void 0 || pick.index === currIndex) {
      return;
    }
    if (pick.id === "installRenderers") {
      this._showJupyterExtension();
      return;
    }
    const nextElement = outputItemDiv.nextElementSibling;
    this.toolbarDisposables.clear();
    const element = this.innerContainer;
    if (element) {
      element.remove();
      this.notebookEditor.removeInset(viewModel);
    }
    viewModel.pickedMimeType = mimeTypes[pick.index];
    this.viewCell.updateOutputMinHeight(this.viewCell.layoutInfo.outputTotalHeight);
    const { mimeType, rendererId } = mimeTypes[pick.index];
    this.notebookService.updateMimePreferredRenderer(notebookTextModel.viewType, mimeType, rendererId, mimeTypes.map((m) => m.mimeType));
    this.render(nextElement);
    this._validateFinalOutputHeight(false);
    this._relayoutCell();
  }
  async _showJupyterExtension() {
    await this.extensionsWorkbenchService.openSearch(`@id:${JUPYTER_EXTENSION_ID}`);
  }
  _generateRendererInfo(renderId) {
    const renderInfo = this.notebookService.getRendererInfo(renderId);
    if (renderInfo) {
      const displayName = renderInfo.displayName !== "" ? renderInfo.displayName : renderInfo.id;
      return `${displayName} (${renderInfo.extensionId.value})`;
    }
    return nls.localize("unavailableRenderInfo", "renderer not available");
  }
  _validateFinalOutputHeight(synchronous) {
    if (this._outputHeightTimer !== null) {
      clearTimeout(this._outputHeightTimer);
    }
    if (synchronous) {
      this.viewCell.unlockOutputHeight();
    } else {
      this._outputHeightTimer = setTimeout(() => {
        this.viewCell.unlockOutputHeight();
      }, 1e3);
    }
  }
  _relayoutCell() {
    this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
  }
  dispose() {
    if (this._outputHeightTimer) {
      this.viewCell.unlockOutputHeight();
      clearTimeout(this._outputHeightTimer);
    }
    super.dispose();
  }
};
CellOutputElement = __decorateClass([
  __decorateParam(5, INotebookService),
  __decorateParam(6, IQuickInputService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IExtensionsWorkbenchService),
  __decorateParam(10, IInstantiationService)
], CellOutputElement);
class OutputEntryViewHandler {
  constructor(model, element) {
    this.model = model;
    this.element = element;
  }
}
var CellOutputUpdateContext = /* @__PURE__ */ ((CellOutputUpdateContext2) => {
  CellOutputUpdateContext2[CellOutputUpdateContext2["Execution"] = 1] = "Execution";
  CellOutputUpdateContext2[CellOutputUpdateContext2["Other"] = 2] = "Other";
  return CellOutputUpdateContext2;
})(CellOutputUpdateContext || {});
let CellOutputContainer = class extends CellContentPart {
  constructor(notebookEditor, viewCell, templateData, options, openerService, _notebookExecutionStateService, instantiationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.viewCell = viewCell;
    this.templateData = templateData;
    this.options = options;
    this.openerService = openerService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this.instantiationService = instantiationService;
    this._outputEntries = [];
    this._hasStaleOutputs = false;
    this.hasHiddenOutputs = observableValue("hasHiddenOutputs", false);
    this._outputHeightTimer = null;
    this._register(viewCell.onDidStartExecution(() => {
      viewCell.updateOutputMinHeight(viewCell.layoutInfo.outputTotalHeight);
    }));
    this._register(viewCell.onDidStopExecution(() => {
      this._validateFinalOutputHeight(false);
    }));
    this._register(viewCell.onDidChangeOutputs((splice) => {
      const executionState = this._notebookExecutionStateService.getCellExecution(viewCell.uri);
      const context = executionState ? 1 /* Execution */ : 2 /* Other */;
      this._updateOutputs(splice, context);
    }));
    this._register(viewCell.onDidChangeLayout(() => {
      this.updateInternalLayoutNow(viewCell);
    }));
  }
  checkForHiddenOutputs() {
    if (this._outputEntries.find((entry) => {
      return entry.model.visible;
    })) {
      this.hasHiddenOutputs.set(true, void 0);
    } else {
      this.hasHiddenOutputs.set(false, void 0);
    }
  }
  get renderedOutputEntries() {
    return this._outputEntries;
  }
  updateInternalLayoutNow(viewCell) {
    this.templateData.outputContainer.setTop(viewCell.layoutInfo.outputContainerOffset);
    this.templateData.outputShowMoreContainer.setTop(viewCell.layoutInfo.outputShowMoreContainerOffset);
    this._outputEntries.forEach((entry) => {
      const index = this.viewCell.outputsViewModels.indexOf(entry.model);
      if (index >= 0) {
        const top = this.viewCell.getOutputOffsetInContainer(index);
        entry.element.updateDOMTop(top);
      }
    });
  }
  render() {
    try {
      this._doRender();
    } finally {
      this._relayoutCell();
    }
  }
  /**
   * Notify that an output may have been swapped out without the model getting rendered.
   */
  flagAsStale() {
    this._hasStaleOutputs = true;
  }
  _doRender() {
    if (this.viewCell.outputsViewModels.length > 0) {
      if (this.viewCell.layoutInfo.outputTotalHeight !== 0) {
        this.viewCell.updateOutputMinHeight(this.viewCell.layoutInfo.outputTotalHeight);
      }
      DOM.show(this.templateData.outputContainer.domNode);
      for (let index = 0; index < Math.min(this.options.limit, this.viewCell.outputsViewModels.length); index++) {
        const currOutput = this.viewCell.outputsViewModels[index];
        const entry = this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, currOutput);
        this._outputEntries.push(new OutputEntryViewHandler(currOutput, entry));
        entry.render(void 0);
      }
      if (this.viewCell.outputsViewModels.length > this.options.limit) {
        DOM.show(this.templateData.outputShowMoreContainer.domNode);
        this.viewCell.updateOutputShowMoreContainerHeight(46);
      }
      this._validateFinalOutputHeight(false);
    } else {
      DOM.hide(this.templateData.outputContainer.domNode);
    }
    this.templateData.outputShowMoreContainer.domNode.innerText = "";
    if (this.viewCell.outputsViewModels.length > this.options.limit) {
      this.templateData.outputShowMoreContainer.domNode.appendChild(this._generateShowMoreElement(this.templateData.templateDisposables));
    } else {
      DOM.hide(this.templateData.outputShowMoreContainer.domNode);
      this.viewCell.updateOutputShowMoreContainerHeight(0);
    }
  }
  viewUpdateShowOutputs(initRendering) {
    if (this._hasStaleOutputs) {
      this._hasStaleOutputs = false;
      this._outputEntries.forEach((entry) => {
        entry.element.rerender();
      });
    }
    for (let index = 0; index < this._outputEntries.length; index++) {
      const viewHandler = this._outputEntries[index];
      const outputEntry = viewHandler.element;
      if (outputEntry.renderResult) {
        this.notebookEditor.createOutput(this.viewCell, outputEntry.renderResult, this.viewCell.getOutputOffset(index), false);
      } else {
        outputEntry.render(void 0);
      }
    }
    this._relayoutCell();
  }
  viewUpdateHideOuputs() {
    for (let index = 0; index < this._outputEntries.length; index++) {
      this.notebookEditor.hideInset(this._outputEntries[index].model);
    }
  }
  _validateFinalOutputHeight(synchronous) {
    if (this._outputHeightTimer !== null) {
      clearTimeout(this._outputHeightTimer);
    }
    const executionState = this._notebookExecutionStateService.getCellExecution(this.viewCell.uri);
    if (synchronous) {
      this.viewCell.unlockOutputHeight();
    } else if (executionState?.state !== NotebookCellExecutionState.Executing) {
      this._outputHeightTimer = setTimeout(() => {
        this.viewCell.unlockOutputHeight();
      }, 200);
    }
  }
  _updateOutputs(splice, context = 2 /* Other */) {
    const previousOutputHeight = this.viewCell.layoutInfo.outputTotalHeight;
    this.viewCell.updateOutputMinHeight(previousOutputHeight);
    if (this.viewCell.outputsViewModels.length) {
      DOM.show(this.templateData.outputContainer.domNode);
    } else {
      DOM.hide(this.templateData.outputContainer.domNode);
    }
    this.viewCell.spliceOutputHeights(splice.start, splice.deleteCount, splice.newOutputs.map((_) => 0));
    this._renderNow(splice, context);
  }
  _renderNow(splice, context) {
    if (splice.start >= this.options.limit) {
      return;
    }
    const firstGroupEntries = this._outputEntries.slice(0, splice.start);
    const deletedEntries = this._outputEntries.slice(splice.start, splice.start + splice.deleteCount);
    const secondGroupEntries = this._outputEntries.slice(splice.start + splice.deleteCount);
    let newlyInserted = this.viewCell.outputsViewModels.slice(splice.start, splice.start + splice.newOutputs.length);
    if (firstGroupEntries.length + newlyInserted.length + secondGroupEntries.length > this.options.limit) {
      if (firstGroupEntries.length + newlyInserted.length > this.options.limit) {
        [...deletedEntries, ...secondGroupEntries].forEach((entry) => {
          entry.element.detach();
          entry.element.dispose();
        });
        newlyInserted = newlyInserted.slice(0, this.options.limit - firstGroupEntries.length);
        const newlyInsertedEntries = newlyInserted.map((insert) => {
          return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
        });
        this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries];
        for (let i = firstGroupEntries.length; i < this._outputEntries.length; i++) {
          this._outputEntries[i].element.render(void 0);
        }
      } else {
        const elementsPushedOutOfView = secondGroupEntries.slice(this.options.limit - firstGroupEntries.length - newlyInserted.length);
        [...deletedEntries, ...elementsPushedOutOfView].forEach((entry) => {
          entry.element.detach();
          entry.element.dispose();
        });
        const reRenderRightBoundary = firstGroupEntries.length + newlyInserted.length;
        const newlyInsertedEntries = newlyInserted.map((insert) => {
          return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
        });
        this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries, ...secondGroupEntries.slice(0, this.options.limit - firstGroupEntries.length - newlyInserted.length)];
        for (let i = firstGroupEntries.length; i < reRenderRightBoundary; i++) {
          const previousSibling = i - 1 >= 0 && this._outputEntries[i - 1] && !!this._outputEntries[i - 1].element.innerContainer?.parentElement ? this._outputEntries[i - 1].element.innerContainer : void 0;
          this._outputEntries[i].element.render(previousSibling);
        }
      }
    } else {
      deletedEntries.forEach((entry) => {
        entry.element.detach();
        entry.element.dispose();
      });
      const reRenderRightBoundary = firstGroupEntries.length + newlyInserted.length;
      const newlyInsertedEntries = newlyInserted.map((insert) => {
        return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
      });
      let outputsNewlyAvailable = [];
      if (firstGroupEntries.length + newlyInsertedEntries.length + secondGroupEntries.length < this.viewCell.outputsViewModels.length) {
        const last = Math.min(this.options.limit, this.viewCell.outputsViewModels.length);
        outputsNewlyAvailable = this.viewCell.outputsViewModels.slice(firstGroupEntries.length + newlyInsertedEntries.length + secondGroupEntries.length, last).map((output) => {
          return new OutputEntryViewHandler(output, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, output));
        });
      }
      this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries, ...secondGroupEntries, ...outputsNewlyAvailable];
      for (let i = firstGroupEntries.length; i < reRenderRightBoundary; i++) {
        const previousSibling = i - 1 >= 0 && this._outputEntries[i - 1] && !!this._outputEntries[i - 1].element.innerContainer?.parentElement ? this._outputEntries[i - 1].element.innerContainer : void 0;
        this._outputEntries[i].element.render(previousSibling);
      }
      for (let i = 0; i < outputsNewlyAvailable.length; i++) {
        this._outputEntries[firstGroupEntries.length + newlyInserted.length + secondGroupEntries.length + i].element.render(void 0);
      }
    }
    if (this.viewCell.outputsViewModels.length > this.options.limit) {
      DOM.show(this.templateData.outputShowMoreContainer.domNode);
      if (!this.templateData.outputShowMoreContainer.domNode.hasChildNodes()) {
        this.templateData.outputShowMoreContainer.domNode.appendChild(this._generateShowMoreElement(this.templateData.templateDisposables));
      }
      this.viewCell.updateOutputShowMoreContainerHeight(46);
    } else {
      DOM.hide(this.templateData.outputShowMoreContainer.domNode);
    }
    this._relayoutCell();
    this._validateFinalOutputHeight(context === 2 /* Other */ && this.viewCell.outputsViewModels.length === 0);
  }
  _generateShowMoreElement(disposables) {
    const md = {
      value: `There are more than ${this.options.limit} outputs, [show more (open the raw output data in a text editor) ...](command:workbench.action.openLargeOutput)`,
      isTrusted: true,
      supportThemeIcons: true
    };
    const rendered = renderMarkdown(md, {
      actionHandler: {
        callback: (content) => {
          if (content === "command:workbench.action.openLargeOutput") {
            this.openerService.open(CellUri.generateCellOutputUriWithId(this.notebookEditor.textModel.uri));
          }
          return;
        },
        disposables
      }
    });
    disposables.add(rendered);
    rendered.element.classList.add("output-show-more");
    return rendered.element;
  }
  _relayoutCell() {
    this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
  }
  dispose() {
    this.viewCell.updateOutputMinHeight(0);
    if (this._outputHeightTimer) {
      clearTimeout(this._outputHeightTimer);
    }
    this._outputEntries.forEach((entry) => {
      entry.element.dispose();
    });
    super.dispose();
  }
};
CellOutputContainer = __decorateClass([
  __decorateParam(4, IOpenerService),
  __decorateParam(5, INotebookExecutionStateService),
  __decorateParam(6, IInstantiationService)
], CellOutputContainer);
const JUPYTER_RENDERER_MIMETYPES = [
  "application/geo+json",
  "application/vdom.v1+json",
  "application/vnd.dataresource+json",
  "application/vnd.plotly.v1+json",
  "application/vnd.vega.v2+json",
  "application/vnd.vega.v3+json",
  "application/vnd.vega.v4+json",
  "application/vnd.vega.v5+json",
  "application/vnd.vegalite.v1+json",
  "application/vnd.vegalite.v2+json",
  "application/vnd.vegalite.v3+json",
  "application/vnd.vegalite.v4+json",
  "application/x-nteract-model-debug+json",
  "image/svg+xml",
  "text/latex",
  "text/vnd.plotly.v1+html",
  "application/vnd.jupyter.widget-view+json",
  "application/vnd.code.notebook.error"
];
export {
  CellOutputContainer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL2NlbGxPdXRwdXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyByZW5kZXJNYXJrZG93biB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDZWxsT3V0cHV0Vmlld01vZGVsLCBJQ2VsbFZpZXdNb2RlbCwgSUluc2V0UmVuZGVyT3V0cHV0LCBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSwgSlVQWVRFUl9FWFRFTlNJT05fSUQsIFJlbmRlck91dHB1dFR5cGUgfSBmcm9tICcuLi8uLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgbWltZXR5cGVJY29uIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tJY29ucy5qcyc7XG5pbXBvcnQgeyBDZWxsQ29udGVudFBhcnQgfSBmcm9tICcuLi9jZWxsUGFydC5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFJlbmRlclRlbXBsYXRlIH0gZnJvbSAnLi4vbm90ZWJvb2tSZW5kZXJpbmdDb21tb24uanMnO1xuaW1wb3J0IHsgQ29kZUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvY29kZUNlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbFVyaSwgSU9yZGVyZWRNaW1lVHlwZSwgTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUsIE5vdGVib29rQ2VsbE91dHB1dHNTcGxpY2UsIFJFTkRFUkVSX05PVF9BVkFJTEFCTEUsIGlzVGV4dFN0cmVhbU1pbWUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0tlcm5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ09QWV9PVVRQVVRfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uL2NvbnRyb2xsZXIvY2VsbE91dHB1dEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19DRUxMX0hBU19ISURERU5fT1VUUFVUUywgTk9URUJPT0tfQ0VMTF9JU19GSVJTVF9PVVRQVVQsIE5PVEVCT09LX0NFTExfT1VUUFVUX01JTUVUWVBFIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgVEVYVF9CQVNFRF9NSU1FVFlQRVMgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvY2VsbE91dHB1dFRleHRIZWxwZXIuanMnO1xuXG5pbnRlcmZhY2UgSU1pbWVUeXBlUmVuZGVyZXIgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGluZGV4OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJUmVuZGVyUmVzdWx0IHtcblx0aW5pdFJlbmRlcklzU3luY2hyb25vdXM6IGZhbHNlO1xufVxuXG4vLyBET00gc3RydWN0dXJlXG4vL1xuLy8gICNvdXRwdXRcbi8vICB8XG4vLyAgfCAgI291dHB1dC1pbm5lci1jb250YWluZXJcbi8vICB8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgI2NlbGwtb3V0cHV0LXRvb2xiYXJcbi8vICB8ICAgICAgICAgICAgICAgICAgICAgICAgfCAgI291dHB1dC1lbGVtZW50XG4vLyAgfCAgICAgICAgICAgICAgICAgICAgICAgIHwgICNvdXRwdXQtZWxlbWVudFxuLy8gIHwgICAgICAgICAgICAgICAgICAgICAgICB8ICAjb3V0cHV0LWVsZW1lbnRcbi8vICB8ICAjb3V0cHV0LWlubmVyLWNvbnRhaW5lclxuLy8gIHwgICAgICAgICAgICAgICAgICAgICAgICB8ICAjY2VsbC1vdXRwdXQtdG9vbGJhclxuLy8gIHwgICAgICAgICAgICAgICAgICAgICAgICB8ICAjb3V0cHV0LWVsZW1lbnRcbi8vICB8ICAjb3V0cHV0LWlubmVyLWNvbnRhaW5lclxuLy8gIHwgICAgICAgICAgICAgICAgICAgICAgICB8ICAjY2VsbC1vdXRwdXQtdG9vbGJhclxuLy8gIHwgICAgICAgICAgICAgICAgICAgICAgICB8ICAjb3V0cHV0LWVsZW1lbnRcbmNsYXNzIENlbGxPdXRwdXRFbGVtZW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9vbGJhckRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRpbm5lckNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRyZW5kZXJlZE91dHB1dENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRyZW5kZXJSZXN1bHQ/OiBJSW5zZXRSZW5kZXJPdXRwdXQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIHRvb2xiYXJBdHRhY2hlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va0VkaXRvckRlbGVnYXRlLFxuXHRcdHByaXZhdGUgdmlld0NlbGw6IENvZGVDZWxsVmlld01vZGVsLFxuXHRcdHByaXZhdGUgY2VsbE91dHB1dENvbnRhaW5lcjogQ2VsbE91dHB1dENvbnRhaW5lcixcblx0XHRwcml2YXRlIG91dHB1dENvbnRhaW5lcjogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+LFxuXHRcdHJlYWRvbmx5IG91dHB1dDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwYXJlbnRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IHBhcmVudENvbnRleHRLZXlTZXJ2aWNlO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vdXRwdXQubW9kZWwub25EaWRDaGFuZ2VEYXRhKCgpID0+IHtcblx0XHRcdHRoaXMucmVyZW5kZXIoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm91dHB1dC5vbkRpZFJlc2V0UmVuZGVyZXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5yZXJlbmRlcigpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGRldGFjaCgpIHtcblx0XHR0aGlzLnJlbmRlcmVkT3V0cHV0Q29udGFpbmVyPy5yZW1vdmUoKTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0aWYgKHRoaXMuaW5uZXJDb250YWluZXIpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5pbm5lckNvbnRhaW5lci5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICgodGhpcy5pbm5lckNvbnRhaW5lci5jaGlsZE5vZGVzW2ldIGFzIEhUTUxFbGVtZW50KS5jbGFzc05hbWUgPT09ICdyZW5kZXJlZC1vdXRwdXQnKSB7XG5cdFx0XHRcdFx0Y291bnQrKztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjb3VudCA+IDEpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY291bnQgPT09IDApIHtcblx0XHRcdFx0dGhpcy5pbm5lckNvbnRhaW5lci5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnJlbW92ZUluc2V0KHRoaXMub3V0cHV0KTtcblx0fVxuXG5cdHVwZGF0ZURPTVRvcCh0b3A6IG51bWJlcikge1xuXHRcdGlmICh0aGlzLmlubmVyQ29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmlubmVyQ29udGFpbmVyLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG5cdFx0fVxuXHR9XG5cblx0cmVyZW5kZXIoKSB7XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpICYmXG5cdFx0XHR0aGlzLmlubmVyQ29udGFpbmVyICYmXG5cdFx0XHR0aGlzLnJlbmRlclJlc3VsdCAmJlxuXHRcdFx0dGhpcy5yZW5kZXJSZXN1bHQudHlwZSA9PT0gUmVuZGVyT3V0cHV0VHlwZS5FeHRlbnNpb25cblx0XHQpIHtcblx0XHRcdC8vIE91dHB1dCByZW5kZXJlZCBieSBleHRlbnNpb24gcmVuZGVyZXIgZ290IGFuIHVwZGF0ZVxuXHRcdFx0Y29uc3QgW21pbWVUeXBlcywgcGlja10gPSB0aGlzLm91dHB1dC5yZXNvbHZlTWltZVR5cGVzKHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsLCB0aGlzLm5vdGVib29rRWRpdG9yLmFjdGl2ZUtlcm5lbD8ucHJlbG9hZFByb3ZpZGVzKTtcblx0XHRcdGNvbnN0IHBpY2tlZE1pbWVUeXBlID0gbWltZVR5cGVzW3BpY2tdO1xuXHRcdFx0aWYgKHBpY2tlZE1pbWVUeXBlLm1pbWVUeXBlID09PSB0aGlzLnJlbmRlclJlc3VsdC5taW1lVHlwZSAmJiBwaWNrZWRNaW1lVHlwZS5yZW5kZXJlcklkID09PSB0aGlzLnJlbmRlclJlc3VsdC5yZW5kZXJlci5pZCkge1xuXHRcdFx0XHQvLyBTYW1lIG1pbWV0eXBlLCBzYW1lIHJlbmRlcmVyLCBjYWxsIHRoZSBleHRlbnNpb24gcmVuZGVyZXIgdG8gdXBkYXRlXG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKHRoaXMub3V0cHV0KTtcblx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci51cGRhdGVPdXRwdXQodGhpcy52aWV3Q2VsbCwgdGhpcy5yZW5kZXJSZXN1bHQsIHRoaXMudmlld0NlbGwuZ2V0T3V0cHV0T2Zmc2V0KGluZGV4KSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuaW5uZXJDb250YWluZXIpIHtcblx0XHRcdC8vIGluaXQgcmVuZGVyaW5nIGRpZG4ndCBoYXBwZW5cblx0XHRcdGNvbnN0IGN1cnJPdXRwdXRJbmRleCA9IHRoaXMuY2VsbE91dHB1dENvbnRhaW5lci5yZW5kZXJlZE91dHB1dEVudHJpZXMuZmluZEluZGV4KGVudHJ5ID0+IGVudHJ5LmVsZW1lbnQgPT09IHRoaXMpO1xuXHRcdFx0Y29uc3QgcHJldmlvdXNTaWJsaW5nID0gY3Vyck91dHB1dEluZGV4ID4gMCAmJiAhISh0aGlzLmNlbGxPdXRwdXRDb250YWluZXIucmVuZGVyZWRPdXRwdXRFbnRyaWVzW2N1cnJPdXRwdXRJbmRleCAtIDFdLmVsZW1lbnQuaW5uZXJDb250YWluZXI/LnBhcmVudEVsZW1lbnQpXG5cdFx0XHRcdD8gdGhpcy5jZWxsT3V0cHV0Q29udGFpbmVyLnJlbmRlcmVkT3V0cHV0RW50cmllc1tjdXJyT3V0cHV0SW5kZXggLSAxXS5lbGVtZW50LmlubmVyQ29udGFpbmVyXG5cdFx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5yZW5kZXIocHJldmlvdXNTaWJsaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gQW5vdGhlciBtaW1ldHlwZSBvciByZW5kZXJlciBpcyBwaWNrZWQsIHdlIG5lZWQgdG8gY2xlYXIgdGhlIGN1cnJlbnQgb3V0cHV0IGFuZCByZS1yZW5kZXJcblx0XHRcdGNvbnN0IG5leHRFbGVtZW50ID0gdGhpcy5pbm5lckNvbnRhaW5lci5uZXh0RWxlbWVudFNpYmxpbmc7XG5cdFx0XHR0aGlzLnRvb2xiYXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuaW5uZXJDb250YWluZXI7XG5cdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnJlbW92ZUluc2V0KHRoaXMub3V0cHV0KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZW5kZXIobmV4dEVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlbGF5b3V0Q2VsbCgpO1xuXHR9XG5cblx0Ly8gaW5zZXJ0IGFmdGVyIHByZXZpb3VzU2libGluZ1xuXHRwcml2YXRlIF9nZW5lcmF0ZUlubmVyT3V0cHV0Q29udGFpbmVyKHByZXZpb3VzU2libGluZzogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsIHBpY2tlZE1pbWVUeXBlUmVuZGVyZXI6IElPcmRlcmVkTWltZVR5cGUpIHtcblx0XHR0aGlzLmlubmVyQ29udGFpbmVyID0gRE9NLiQoJy5vdXRwdXQtaW5uZXItY29udGFpbmVyJyk7XG5cblx0XHRpZiAocHJldmlvdXNTaWJsaW5nICYmIHByZXZpb3VzU2libGluZy5uZXh0RWxlbWVudFNpYmxpbmcpIHtcblx0XHRcdHRoaXMub3V0cHV0Q29udGFpbmVyLmRvbU5vZGUuaW5zZXJ0QmVmb3JlKHRoaXMuaW5uZXJDb250YWluZXIsIHByZXZpb3VzU2libGluZy5uZXh0RWxlbWVudFNpYmxpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm91dHB1dENvbnRhaW5lci5kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuaW5uZXJDb250YWluZXIpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5uZXJDb250YWluZXIuc2V0QXR0cmlidXRlKCdvdXRwdXQtbWltZS10eXBlJywgcGlja2VkTWltZVR5cGVSZW5kZXJlci5taW1lVHlwZSk7XG5cdFx0cmV0dXJuIHRoaXMuaW5uZXJDb250YWluZXI7XG5cdH1cblxuXHRyZW5kZXIocHJldmlvdXNTaWJsaW5nOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCk6IElSZW5kZXJSZXN1bHQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKHRoaXMub3V0cHV0KTtcblxuXHRcdGlmICh0aGlzLnZpZXdDZWxsLmlzT3V0cHV0Q29sbGFwc2VkIHx8ICF0aGlzLm5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHRoaXMuY2VsbE91dHB1dENvbnRhaW5lci5mbGFnQXNTdGFsZSgpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBub3RlYm9va1VyaSA9IENlbGxVcmkucGFyc2UodGhpcy52aWV3Q2VsbC51cmkpPy5ub3RlYm9vaztcblx0XHRpZiAoIW5vdGVib29rVXJpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vdGVib29rVGV4dE1vZGVsID0gdGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWw7XG5cblx0XHRjb25zdCBbbWltZVR5cGVzLCBwaWNrXSA9IHRoaXMub3V0cHV0LnJlc29sdmVNaW1lVHlwZXMobm90ZWJvb2tUZXh0TW9kZWwsIHRoaXMubm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsPy5wcmVsb2FkUHJvdmlkZXMpO1xuXG5cdFx0aWYgKCFtaW1lVHlwZXMuZmluZChtaW1lVHlwZSA9PiBtaW1lVHlwZS5pc1RydXN0ZWQpIHx8IG1pbWVUeXBlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMudmlld0NlbGwudXBkYXRlT3V0cHV0SGVpZ2h0KGluZGV4LCAwLCAnQ2VsbE91dHB1dEVsZW1lbnQjbm9NaW1lVHlwZScpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZFByZXNlbnRhdGlvbiA9IG1pbWVUeXBlc1twaWNrXTtcblx0XHRsZXQgcmVuZGVyZXIgPSB0aGlzLm5vdGVib29rU2VydmljZS5nZXRSZW5kZXJlckluZm8oc2VsZWN0ZWRQcmVzZW50YXRpb24ucmVuZGVyZXJJZCk7XG5cdFx0aWYgKCFyZW5kZXJlciAmJiBzZWxlY3RlZFByZXNlbnRhdGlvbi5taW1lVHlwZS5pbmRleE9mKCd0ZXh0LycpID4gLTEpIHtcblx0XHRcdHJlbmRlcmVyID0gdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0UmVuZGVyZXJJbmZvKCd2c2NvZGUuYnVpbHRpbi1yZW5kZXJlcicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlubmVyQ29udGFpbmVyID0gdGhpcy5fZ2VuZXJhdGVJbm5lck91dHB1dENvbnRhaW5lcihwcmV2aW91c1NpYmxpbmcsIHNlbGVjdGVkUHJlc2VudGF0aW9uKTtcblx0XHRpZiAoaW5kZXggPT09IDAgfHwgdGhpcy5vdXRwdXQudmlzaWJsZS5nZXQoKSkge1xuXHRcdFx0dGhpcy5fYXR0YWNoVG9vbGJhcihpbm5lckNvbnRhaW5lciwgbm90ZWJvb2tUZXh0TW9kZWwsIHRoaXMubm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsLCBpbmRleCwgbWltZVR5cGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bigocmVhZGVyKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHZpc2libGUgPSByZWFkZXIucmVhZE9ic2VydmFibGUodGhpcy5vdXRwdXQudmlzaWJsZSk7XG5cdFx0XHRcdGlmICh2aXNpYmxlICYmICF0aGlzLnRvb2xiYXJBdHRhY2hlZCkge1xuXHRcdFx0XHRcdHRoaXMuX2F0dGFjaFRvb2xiYXIoaW5uZXJDb250YWluZXIsIG5vdGVib29rVGV4dE1vZGVsLCB0aGlzLm5vdGVib29rRWRpdG9yLmFjdGl2ZUtlcm5lbCwgaW5kZXgsIG1pbWVUeXBlcyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIXZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLnRvb2xiYXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY2VsbE91dHB1dENvbnRhaW5lci5jaGVja0ZvckhpZGRlbk91dHB1dHMoKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuY2VsbE91dHB1dENvbnRhaW5lci5oYXNIaWRkZW5PdXRwdXRzLnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZWRPdXRwdXRDb250YWluZXIgPSBET00uYXBwZW5kKGlubmVyQ29udGFpbmVyLCBET00uJCgnLnJlbmRlcmVkLW91dHB1dCcpKTtcblxuXG5cdFx0dGhpcy5yZW5kZXJSZXN1bHQgPSByZW5kZXJlclxuXHRcdFx0PyB7IHR5cGU6IFJlbmRlck91dHB1dFR5cGUuRXh0ZW5zaW9uLCByZW5kZXJlciwgc291cmNlOiB0aGlzLm91dHB1dCwgbWltZVR5cGU6IHNlbGVjdGVkUHJlc2VudGF0aW9uLm1pbWVUeXBlIH1cblx0XHRcdDogdGhpcy5fcmVuZGVyTWlzc2luZ1JlbmRlcmVyKHRoaXMub3V0cHV0LCBzZWxlY3RlZFByZXNlbnRhdGlvbi5taW1lVHlwZSk7XG5cblx0XHR0aGlzLm91dHB1dC5waWNrZWRNaW1lVHlwZSA9IHNlbGVjdGVkUHJlc2VudGF0aW9uO1xuXG5cdFx0aWYgKCF0aGlzLnJlbmRlclJlc3VsdCkge1xuXHRcdFx0dGhpcy52aWV3Q2VsbC51cGRhdGVPdXRwdXRIZWlnaHQoaW5kZXgsIDAsICdDZWxsT3V0cHV0RWxlbWVudCNyZW5kZXJSZXN1bHRVbmRlZmluZWQnKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5ub3RlYm9va0VkaXRvci5jcmVhdGVPdXRwdXQodGhpcy52aWV3Q2VsbCwgdGhpcy5yZW5kZXJSZXN1bHQsIHRoaXMudmlld0NlbGwuZ2V0T3V0cHV0T2Zmc2V0KGluZGV4KSwgZmFsc2UpO1xuXHRcdGlubmVyQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2JhY2tncm91bmQnKTtcblxuXHRcdHJldHVybiB7IGluaXRSZW5kZXJJc1N5bmNocm9ub3VzOiBmYWxzZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyTWlzc2luZ1JlbmRlcmVyKHZpZXdNb2RlbDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsIHByZWZlcnJlZE1pbWVUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBJSW5zZXRSZW5kZXJPdXRwdXQge1xuXHRcdGlmICghdmlld01vZGVsLm1vZGVsLm91dHB1dHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyTWVzc2FnZSh2aWV3TW9kZWwsIG5scy5sb2NhbGl6ZSgnZW1wdHknLCBcIkNlbGwgaGFzIG5vIG91dHB1dFwiKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFwcmVmZXJyZWRNaW1lVHlwZSkge1xuXHRcdFx0Y29uc3QgbWltZVR5cGVzID0gdmlld01vZGVsLm1vZGVsLm91dHB1dHMubWFwKG9wID0+IG9wLm1pbWUpO1xuXHRcdFx0Y29uc3QgbWltZVR5cGVzTWVzc2FnZSA9IG1pbWVUeXBlcy5qb2luKCcsICcpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlbmRlck1lc3NhZ2Uodmlld01vZGVsLCBubHMubG9jYWxpemUoJ25vUmVuZGVyZXIuMicsIFwiTm8gcmVuZGVyZXIgY291bGQgYmUgZm91bmQgZm9yIG91dHB1dC4gSXQgaGFzIHRoZSBmb2xsb3dpbmcgbWltZXR5cGVzOiB7MH1cIiwgbWltZVR5cGVzTWVzc2FnZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJTZWFyY2hGb3JNaW1ldHlwZSh2aWV3TW9kZWwsIHByZWZlcnJlZE1pbWVUeXBlKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlclNlYXJjaEZvck1pbWV0eXBlKHZpZXdNb2RlbDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsIG1pbWVUeXBlOiBzdHJpbmcpOiBJSW5zZXRSZW5kZXJPdXRwdXQge1xuXHRcdGNvbnN0IHF1ZXJ5ID0gYEB0YWc6bm90ZWJvb2tSZW5kZXJlciAke21pbWVUeXBlfWA7XG5cblx0XHRjb25zdCBwID0gRE9NLiQoJ3AnLCB1bmRlZmluZWQsIGBObyByZW5kZXJlciBjb3VsZCBiZSBmb3VuZCBmb3IgbWltZXR5cGUgXCIke21pbWVUeXBlfVwiLCBidXQgb25lIG1pZ2h0IGJlIGF2YWlsYWJsZSBvbiB0aGUgTWFya2V0cGxhY2UuYCk7XG5cdFx0Y29uc3QgYSA9IERPTS4kKCdhJywgeyBocmVmOiBgY29tbWFuZDp3b3JrYmVuY2guZXh0ZW5zaW9ucy5zZWFyY2g/JTIyJHtxdWVyeX0lMjJgLCBjbGFzczogJ21vbmFjby1idXR0b24gbW9uYWNvLXRleHQtYnV0dG9uJywgdGFiaW5kZXg6IDAsIHJvbGU6ICdidXR0b24nLCBzdHlsZTogJ3BhZGRpbmc6IDhweDsgdGV4dC1kZWNvcmF0aW9uOiBub25lOyBjb2xvcjogcmdiKDI1NSwgMjU1LCAyNTUpOyBiYWNrZ3JvdW5kLWNvbG9yOiByZ2IoMTQsIDk5LCAxNTYpOyBtYXgtd2lkdGg6IDIwMHB4OycgfSwgYFNlYXJjaCBNYXJrZXRwbGFjZWApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFJlbmRlck91dHB1dFR5cGUuSHRtbCxcblx0XHRcdHNvdXJjZTogdmlld01vZGVsLFxuXHRcdFx0aHRtbENvbnRlbnQ6IHAub3V0ZXJIVE1MICsgYS5vdXRlckhUTUxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyTWVzc2FnZSh2aWV3TW9kZWw6IElDZWxsT3V0cHV0Vmlld01vZGVsLCBtZXNzYWdlOiBzdHJpbmcpOiBJSW5zZXRSZW5kZXJPdXRwdXQge1xuXHRcdGNvbnN0IGVsID0gRE9NLiQoJ3AnLCB1bmRlZmluZWQsIG1lc3NhZ2UpO1xuXHRcdHJldHVybiB7IHR5cGU6IFJlbmRlck91dHB1dFR5cGUuSHRtbCwgc291cmNlOiB2aWV3TW9kZWwsIGh0bWxDb250ZW50OiBlbC5vdXRlckhUTUwgfTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkRW5hYmxlQ29weShtaW1lVHlwZXM6IHJlYWRvbmx5IElPcmRlcmVkTWltZVR5cGVbXSkge1xuXHRcdGlmICghbWltZVR5cGVzLmZpbmQobWltZVR5cGUgPT4gVEVYVF9CQVNFRF9NSU1FVFlQRVMuaW5kZXhPZihtaW1lVHlwZS5taW1lVHlwZSkgfHwgbWltZVR5cGUubWltZVR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGlzVGV4dFN0cmVhbU1pbWUobWltZVR5cGVzWzBdLm1pbWVUeXBlKSkge1xuXHRcdFx0Y29uc3QgY2VsbFZpZXdNb2RlbCA9IHRoaXMub3V0cHV0LmNlbGxWaWV3TW9kZWwgYXMgSUNlbGxWaWV3TW9kZWw7XG5cdFx0XHRjb25zdCBpbmRleCA9IGNlbGxWaWV3TW9kZWwub3V0cHV0c1ZpZXdNb2RlbHMuaW5kZXhPZih0aGlzLm91dHB1dCk7XG5cdFx0XHRpZiAoaW5kZXggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzT3V0cHV0ID0gY2VsbFZpZXdNb2RlbC5tb2RlbC5vdXRwdXRzW2luZGV4IC0gMV07XG5cdFx0XHRcdC8vIGlmIHRoZSBwcmV2aW91cyBvdXRwdXQgd2FzIGFsc28gYSBzdHJlYW0sIHRoZSBjb3B5IGNvbW1hbmQgd2lsbCBiZSBpbiB0aGF0IG91dHB1dCBpbnN0ZWFkXG5cdFx0XHRcdHJldHVybiAhaXNUZXh0U3RyZWFtTWltZShwcmV2aW91c091dHB1dC5vdXRwdXRzWzBdLm1pbWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYXR0YWNoVG9vbGJhcihvdXRwdXRJdGVtRGl2OiBIVE1MRWxlbWVudCwgbm90ZWJvb2tUZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLCBrZXJuZWw6IElOb3RlYm9va0tlcm5lbCB8IHVuZGVmaW5lZCwgaW5kZXg6IG51bWJlciwgbWltZVR5cGVzOiByZWFkb25seSBJT3JkZXJlZE1pbWVUeXBlW10pIHtcblx0XHRjb25zdCBoYXNNdWx0aXBsZU1pbWVUeXBlcyA9IG1pbWVUeXBlcy5maWx0ZXIobWltZVR5cGUgPT4gbWltZVR5cGUuaXNUcnVzdGVkKS5sZW5ndGggPiAxO1xuXHRcdGNvbnN0IGlzQ29weUVuYWJsZWQgPSB0aGlzLnNob3VsZEVuYWJsZUNvcHkobWltZVR5cGVzKTtcblx0XHRpZiAoaW5kZXggPiAwICYmICFoYXNNdWx0aXBsZU1pbWVUeXBlcyAmJiAhaXNDb3B5RW5hYmxlZCkge1xuXHRcdFx0Ly8gbm90aGluZyB0byBwdXQgaW4gdGhlIHRvb2xiYXJcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMubm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG91dHB1dEl0ZW1EaXYuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdGNvbnN0IG1pbWVUeXBlUGlja2VyID0gRE9NLiQoJy5jZWxsLW91dHB1dC10b29sYmFyJyk7XG5cblx0XHRvdXRwdXRJdGVtRGl2LmFwcGVuZENoaWxkKG1pbWVUeXBlUGlja2VyKTtcblxuXHRcdGNvbnN0IHRvb2xiYXIgPSB0aGlzLnRvb2xiYXJEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLCBtaW1lVHlwZVBpY2tlciwge1xuXHRcdFx0cmVuZGVyRHJvcGRvd25Bc0NoaWxkRWxlbWVudDogZmFsc2Vcblx0XHR9KSk7XG5cdFx0dG9vbGJhci5jb250ZXh0ID0ge1xuXHRcdFx0dWk6IHRydWUsXG5cdFx0XHRjZWxsOiB0aGlzLm91dHB1dC5jZWxsVmlld01vZGVsIGFzIElDZWxsVmlld01vZGVsLFxuXHRcdFx0b3V0cHV0Vmlld01vZGVsOiB0aGlzLm91dHB1dCxcblx0XHRcdG5vdGVib29rRWRpdG9yOiB0aGlzLm5vdGVib29rRWRpdG9yLFxuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLk5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHRcblx0XHR9O1xuXG5cdFx0Ly8gVE9ETzogVGhpcyBjb3VsZCBwcm9iYWJseSBiZSBhIHJlYWwgcmVnaXN0ZXJlZCBhY3Rpb24sIGJ1dCBpdCBoYXMgdG8gdGFsayB0byB0aGlzIG91dHB1dCBlbGVtZW50XG5cdFx0Y29uc3QgcGlja0FjdGlvbiA9IHRoaXMudG9vbGJhckRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCdub3RlYm9vay5vdXRwdXQucGlja01pbWV0eXBlJywgbmxzLmxvY2FsaXplKCdwaWNrTWltZVR5cGUnLCBcIkNoYW5nZSBQcmVzZW50YXRpb25cIiksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShtaW1ldHlwZUljb24pLCB1bmRlZmluZWQsXG5cdFx0XHRhc3luYyBfY29udGV4dCA9PiB0aGlzLl9waWNrQWN0aXZlTWltZVR5cGVSZW5kZXJlcihvdXRwdXRJdGVtRGl2LCBub3RlYm9va1RleHRNb2RlbCwga2VybmVsLCB0aGlzLm91dHB1dCkpKTtcblxuXHRcdGNvbnN0IG1lbnVDb250ZXh0S2V5U2VydmljZSA9IHRoaXMudG9vbGJhckRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChvdXRwdXRJdGVtRGl2KSk7XG5cdFx0Y29uc3QgaGFzSGlkZGVuT3V0cHV0cyA9IE5PVEVCT09LX0NFTExfSEFTX0hJRERFTl9PVVRQVVRTLmJpbmRUbyhtZW51Q29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGlzRmlyc3RDZWxsT3V0cHV0ID0gTk9URUJPT0tfQ0VMTF9JU19GSVJTVF9PVVRQVVQuYmluZFRvKG1lbnVDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY2VsbE91dHB1dE1pbWV0eXBlID0gTk9URUJPT0tfQ0VMTF9PVVRQVVRfTUlNRVRZUEUuYmluZFRvKG1lbnVDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aXNGaXJzdENlbGxPdXRwdXQuc2V0KGluZGV4ID09PSAwKTtcblx0XHRpZiAobWltZVR5cGVzW2luZGV4XSkge1xuXHRcdFx0Y2VsbE91dHB1dE1pbWV0eXBlLnNldChtaW1lVHlwZXNbaW5kZXhdLm1pbWVUeXBlKTtcblx0XHR9XG5cdFx0dGhpcy50b29sYmFyRGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4oKHJlYWRlcikgPT4geyBoYXNIaWRkZW5PdXRwdXRzLnNldChyZWFkZXIucmVhZE9ic2VydmFibGUodGhpcy5jZWxsT3V0cHV0Q29udGFpbmVyLmhhc0hpZGRlbk91dHB1dHMpKTsgfSkpO1xuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLnRvb2xiYXJEaXNwb3NhYmxlcy5hZGQodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5Ob3RlYm9va091dHB1dFRvb2xiYXIsIG1lbnVDb250ZXh0S2V5U2VydmljZSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlTWVudVRvb2xiYXIgPSAoKSA9PiB7XG5cdFx0XHRsZXQgeyBzZWNvbmRhcnkgfSA9IGdldEFjdGlvbkJhckFjdGlvbnMobWVudSEuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLCAoKSA9PiBmYWxzZSk7XG5cdFx0XHRpZiAoIWlzQ29weUVuYWJsZWQpIHtcblx0XHRcdFx0c2Vjb25kYXJ5ID0gc2Vjb25kYXJ5LmZpbHRlcigoYWN0aW9uKSA9PiBhY3Rpb24uaWQgIT09IENPUFlfT1VUUFVUX0NPTU1BTkRfSUQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGhhc011bHRpcGxlTWltZVR5cGVzKSB7XG5cdFx0XHRcdHNlY29uZGFyeSA9IFtwaWNrQWN0aW9uLCAuLi5zZWNvbmRhcnldO1xuXHRcdFx0fVxuXG5cdFx0XHR0b29sYmFyLnNldEFjdGlvbnMoW10sIHNlY29uZGFyeSk7XG5cdFx0fTtcblx0XHR1cGRhdGVNZW51VG9vbGJhcigpO1xuXHRcdHRoaXMudG9vbGJhckRpc3Bvc2FibGVzLmFkZChtZW51Lm9uRGlkQ2hhbmdlKHVwZGF0ZU1lbnVUb29sYmFyKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9waWNrQWN0aXZlTWltZVR5cGVSZW5kZXJlcihvdXRwdXRJdGVtRGl2OiBIVE1MRWxlbWVudCwgbm90ZWJvb2tUZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLCBrZXJuZWw6IElOb3RlYm9va0tlcm5lbCB8IHVuZGVmaW5lZCwgdmlld01vZGVsOiBJQ2VsbE91dHB1dFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IFttaW1lVHlwZXMsIGN1cnJJbmRleF0gPSB2aWV3TW9kZWwucmVzb2x2ZU1pbWVUeXBlcyhub3RlYm9va1RleHRNb2RlbCwga2VybmVsPy5wcmVsb2FkUHJvdmlkZXMpO1xuXG5cdFx0Y29uc3QgaXRlbXM6IElNaW1lVHlwZVJlbmRlcmVyW10gPSBbXTtcblx0XHRjb25zdCB1bnN1cHBvcnRlZEl0ZW1zOiBJTWltZVR5cGVSZW5kZXJlcltdID0gW107XG5cdFx0bWltZVR5cGVzLmZvckVhY2goKG1pbWVUeXBlLCBpbmRleCkgPT4ge1xuXHRcdFx0aWYgKG1pbWVUeXBlLmlzVHJ1c3RlZCkge1xuXHRcdFx0XHRjb25zdCBhcnIgPSBtaW1lVHlwZS5yZW5kZXJlcklkID09PSBSRU5ERVJFUl9OT1RfQVZBSUxBQkxFID9cblx0XHRcdFx0XHR1bnN1cHBvcnRlZEl0ZW1zIDpcblx0XHRcdFx0XHRpdGVtcztcblx0XHRcdFx0YXJyLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBtaW1lVHlwZS5taW1lVHlwZSxcblx0XHRcdFx0XHRpZDogbWltZVR5cGUubWltZVR5cGUsXG5cdFx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRcdHBpY2tlZDogaW5kZXggPT09IGN1cnJJbmRleCxcblx0XHRcdFx0XHRkZXRhaWw6IHRoaXMuX2dlbmVyYXRlUmVuZGVyZXJJbmZvKG1pbWVUeXBlLnJlbmRlcmVySWQpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBpbmRleCA9PT0gY3VyckluZGV4ID8gbmxzLmxvY2FsaXplKCdjdXJydWVudEFjdGl2ZU1pbWVUeXBlJywgXCJDdXJyZW50bHkgQWN0aXZlXCIpIDogdW5kZWZpbmVkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKHVuc3VwcG9ydGVkSXRlbXMuc29tZShtID0+IEpVUFlURVJfUkVOREVSRVJfTUlNRVRZUEVTLmluY2x1ZGVzKG0uaWQhKSkpIHtcblx0XHRcdHVuc3VwcG9ydGVkSXRlbXMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2luc3RhbGxKdXB5dGVyUHJvbXB0JywgXCJJbnN0YWxsIGFkZGl0aW9uYWwgcmVuZGVyZXJzIGZyb20gdGhlIG1hcmtldHBsYWNlXCIpLFxuXHRcdFx0XHRpZDogJ2luc3RhbGxSZW5kZXJlcnMnLFxuXHRcdFx0XHRpbmRleDogbWltZVR5cGVzLmxlbmd0aFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcGlja2VyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrKHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cdFx0cGlja2VyLml0ZW1zID0gW1xuXHRcdFx0Li4uaXRlbXMsXG5cdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG5cdFx0XHQuLi51bnN1cHBvcnRlZEl0ZW1zXG5cdFx0XTtcblx0XHRwaWNrZXIuYWN0aXZlSXRlbXMgPSBpdGVtcy5maWx0ZXIoaXRlbSA9PiAhIWl0ZW0ucGlja2VkKTtcblx0XHRwaWNrZXIucGxhY2Vob2xkZXIgPSBpdGVtcy5sZW5ndGggIT09IG1pbWVUeXBlcy5sZW5ndGhcblx0XHRcdD8gbmxzLmxvY2FsaXplKCdwcm9tcHRDaG9vc2VNaW1lVHlwZUluU2VjdXJlLnBsYWNlSG9sZGVyJywgXCJTZWxlY3QgbWltZXR5cGUgdG8gcmVuZGVyIGZvciBjdXJyZW50IG91dHB1dFwiKVxuXHRcdFx0OiBubHMubG9jYWxpemUoJ3Byb21wdENob29zZU1pbWVUeXBlLnBsYWNlSG9sZGVyJywgXCJTZWxlY3QgbWltZXR5cGUgdG8gcmVuZGVyIGZvciBjdXJyZW50IG91dHB1dFwiKTtcblxuXHRcdGNvbnN0IHBpY2sgPSBhd2FpdCBuZXcgUHJvbWlzZTxJTWltZVR5cGVSZW5kZXJlciB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZShwaWNrZXIuc2VsZWN0ZWRJdGVtcy5sZW5ndGggPT09IDEgPyAocGlja2VyLnNlbGVjdGVkSXRlbXNbMF0gYXMgSU1pbWVUeXBlUmVuZGVyZXIpIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0cGlja2VyLnNob3coKTtcblx0XHR9KTtcblxuXHRcdGlmIChwaWNrID09PSB1bmRlZmluZWQgfHwgcGljay5pbmRleCA9PT0gY3VyckluZGV4KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHBpY2suaWQgPT09ICdpbnN0YWxsUmVuZGVyZXJzJykge1xuXHRcdFx0dGhpcy5fc2hvd0p1cHl0ZXJFeHRlbnNpb24oKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyB1c2VyIGNob29zZXMgYW5vdGhlciBtaW1ldHlwZVxuXHRcdGNvbnN0IG5leHRFbGVtZW50ID0gb3V0cHV0SXRlbURpdi5uZXh0RWxlbWVudFNpYmxpbmc7XG5cdFx0dGhpcy50b29sYmFyRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5pbm5lckNvbnRhaW5lcjtcblx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0ZWxlbWVudC5yZW1vdmUoKTtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IucmVtb3ZlSW5zZXQodmlld01vZGVsKTtcblx0XHR9XG5cblx0XHR2aWV3TW9kZWwucGlja2VkTWltZVR5cGUgPSBtaW1lVHlwZXNbcGljay5pbmRleF07XG5cdFx0dGhpcy52aWV3Q2VsbC51cGRhdGVPdXRwdXRNaW5IZWlnaHQodGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0KTtcblxuXHRcdGNvbnN0IHsgbWltZVR5cGUsIHJlbmRlcmVySWQgfSA9IG1pbWVUeXBlc1twaWNrLmluZGV4XTtcblx0XHR0aGlzLm5vdGVib29rU2VydmljZS51cGRhdGVNaW1lUHJlZmVycmVkUmVuZGVyZXIobm90ZWJvb2tUZXh0TW9kZWwudmlld1R5cGUsIG1pbWVUeXBlLCByZW5kZXJlcklkLCBtaW1lVHlwZXMubWFwKG0gPT4gbS5taW1lVHlwZSkpO1xuXHRcdHRoaXMucmVuZGVyKG5leHRFbGVtZW50IGFzIEhUTUxFbGVtZW50KTtcblx0XHR0aGlzLl92YWxpZGF0ZUZpbmFsT3V0cHV0SGVpZ2h0KGZhbHNlKTtcblx0XHR0aGlzLl9yZWxheW91dENlbGwoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Nob3dKdXB5dGVyRXh0ZW5zaW9uKCkge1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaChgQGlkOiR7SlVQWVRFUl9FWFRFTlNJT05fSUR9YCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZW5lcmF0ZVJlbmRlcmVySW5mbyhyZW5kZXJJZDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCByZW5kZXJJbmZvID0gdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0UmVuZGVyZXJJbmZvKHJlbmRlcklkKTtcblxuXHRcdGlmIChyZW5kZXJJbmZvKSB7XG5cdFx0XHRjb25zdCBkaXNwbGF5TmFtZSA9IHJlbmRlckluZm8uZGlzcGxheU5hbWUgIT09ICcnID8gcmVuZGVySW5mby5kaXNwbGF5TmFtZSA6IHJlbmRlckluZm8uaWQ7XG5cdFx0XHRyZXR1cm4gYCR7ZGlzcGxheU5hbWV9ICgke3JlbmRlckluZm8uZXh0ZW5zaW9uSWQudmFsdWV9KWA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgndW5hdmFpbGFibGVSZW5kZXJJbmZvJywgXCJyZW5kZXJlciBub3QgYXZhaWxhYmxlXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3V0cHV0SGVpZ2h0VGltZXI6IGFueSA9IG51bGw7XG5cblx0cHJpdmF0ZSBfdmFsaWRhdGVGaW5hbE91dHB1dEhlaWdodChzeW5jaHJvbm91czogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9vdXRwdXRIZWlnaHRUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX291dHB1dEhlaWdodFRpbWVyKTtcblx0XHR9XG5cblx0XHRpZiAoc3luY2hyb25vdXMpIHtcblx0XHRcdHRoaXMudmlld0NlbGwudW5sb2NrT3V0cHV0SGVpZ2h0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX291dHB1dEhlaWdodFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMudmlld0NlbGwudW5sb2NrT3V0cHV0SGVpZ2h0KCk7XG5cdFx0XHR9LCAxMDAwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9yZWxheW91dENlbGwoKSB7XG5cdFx0dGhpcy5ub3RlYm9va0VkaXRvci5sYXlvdXROb3RlYm9va0NlbGwodGhpcy52aWV3Q2VsbCwgdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0aWYgKHRoaXMuX291dHB1dEhlaWdodFRpbWVyKSB7XG5cdFx0XHR0aGlzLnZpZXdDZWxsLnVubG9ja091dHB1dEhlaWdodCgpO1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX291dHB1dEhlaWdodFRpbWVyKTtcblx0XHR9XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0RW50cnlWaWV3SGFuZGxlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG1vZGVsOiBJQ2VsbE91dHB1dFZpZXdNb2RlbCxcblx0XHRyZWFkb25seSBlbGVtZW50OiBDZWxsT3V0cHV0RWxlbWVudFxuXHQpIHtcblxuXHR9XG59XG5cbmNvbnN0IGVudW0gQ2VsbE91dHB1dFVwZGF0ZUNvbnRleHQge1xuXHRFeGVjdXRpb24gPSAxLFxuXHRPdGhlciA9IDJcbn1cblxuZXhwb3J0IGNsYXNzIENlbGxPdXRwdXRDb250YWluZXIgZXh0ZW5kcyBDZWxsQ29udGVudFBhcnQge1xuXHRwcml2YXRlIF9vdXRwdXRFbnRyaWVzOiBPdXRwdXRFbnRyeVZpZXdIYW5kbGVyW10gPSBbXTtcblx0cHJpdmF0ZSBfaGFzU3RhbGVPdXRwdXRzOiBib29sZWFuID0gZmFsc2U7XG5cblx0aGFzSGlkZGVuT3V0cHV0cyA9IG9ic2VydmFibGVWYWx1ZTxib29sZWFuPignaGFzSGlkZGVuT3V0cHV0cycsIGZhbHNlKTtcblx0Y2hlY2tGb3JIaWRkZW5PdXRwdXRzKCkge1xuXHRcdGlmICh0aGlzLl9vdXRwdXRFbnRyaWVzLmZpbmQoZW50cnkgPT4geyByZXR1cm4gZW50cnkubW9kZWwudmlzaWJsZTsgfSkpIHtcblx0XHRcdHRoaXMuaGFzSGlkZGVuT3V0cHV0cy5zZXQodHJ1ZSwgdW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5oYXNIaWRkZW5PdXRwdXRzLnNldChmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgcmVuZGVyZWRPdXRwdXRFbnRyaWVzKCkge1xuXHRcdHJldHVybiB0aGlzLl9vdXRwdXRFbnRyaWVzO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSB2aWV3Q2VsbDogQ29kZUNlbGxWaWV3TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0ZW1wbGF0ZURhdGE6IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUsXG5cdFx0cHJpdmF0ZSBvcHRpb25zOiB7IGxpbWl0OiBudW1iZXIgfSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHZpZXdDZWxsLm9uRGlkU3RhcnRFeGVjdXRpb24oKCkgPT4ge1xuXHRcdFx0dmlld0NlbGwudXBkYXRlT3V0cHV0TWluSGVpZ2h0KHZpZXdDZWxsLmxheW91dEluZm8ub3V0cHV0VG90YWxIZWlnaHQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHZpZXdDZWxsLm9uRGlkU3RvcEV4ZWN1dGlvbigoKSA9PiB7XG5cdFx0XHR0aGlzLl92YWxpZGF0ZUZpbmFsT3V0cHV0SGVpZ2h0KGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih2aWV3Q2VsbC5vbkRpZENoYW5nZU91dHB1dHMoc3BsaWNlID0+IHtcblx0XHRcdGNvbnN0IGV4ZWN1dGlvblN0YXRlID0gdGhpcy5fbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbih2aWV3Q2VsbC51cmkpO1xuXHRcdFx0Y29uc3QgY29udGV4dCA9IGV4ZWN1dGlvblN0YXRlID8gQ2VsbE91dHB1dFVwZGF0ZUNvbnRleHQuRXhlY3V0aW9uIDogQ2VsbE91dHB1dFVwZGF0ZUNvbnRleHQuT3RoZXI7XG5cdFx0XHR0aGlzLl91cGRhdGVPdXRwdXRzKHNwbGljZSwgY29udGV4dCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlld0NlbGwub25EaWRDaGFuZ2VMYXlvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVJbnRlcm5hbExheW91dE5vdyh2aWV3Q2VsbCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlSW50ZXJuYWxMYXlvdXROb3codmlld0NlbGw6IENvZGVDZWxsVmlld01vZGVsKSB7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0Q29udGFpbmVyLnNldFRvcCh2aWV3Q2VsbC5sYXlvdXRJbmZvLm91dHB1dENvbnRhaW5lck9mZnNldCk7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0U2hvd01vcmVDb250YWluZXIuc2V0VG9wKHZpZXdDZWxsLmxheW91dEluZm8ub3V0cHV0U2hvd01vcmVDb250YWluZXJPZmZzZXQpO1xuXG5cdFx0dGhpcy5fb3V0cHV0RW50cmllcy5mb3JFYWNoKGVudHJ5ID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKGVudHJ5Lm1vZGVsKTtcblx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdGNvbnN0IHRvcCA9IHRoaXMudmlld0NlbGwuZ2V0T3V0cHV0T2Zmc2V0SW5Db250YWluZXIoaW5kZXgpO1xuXHRcdFx0XHRlbnRyeS5lbGVtZW50LnVwZGF0ZURPTVRvcCh0b3ApO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmVuZGVyKCkge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9kb1JlbmRlcigpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHQvLyBUT0RPQHJlYm9ybml4LCB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYXQgYWxsIGFzIGNlbGwgbGF5b3V0IGNoYW5nZSB3b3VsZCBzZW5kIHRoZSB1cGRhdGUgcmVxdWVzdC5cblx0XHRcdHRoaXMuX3JlbGF5b3V0Q2VsbCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBOb3RpZnkgdGhhdCBhbiBvdXRwdXQgbWF5IGhhdmUgYmVlbiBzd2FwcGVkIG91dCB3aXRob3V0IHRoZSBtb2RlbCBnZXR0aW5nIHJlbmRlcmVkLlxuXHQgKi9cblx0ZmxhZ0FzU3RhbGUoKSB7XG5cdFx0dGhpcy5faGFzU3RhbGVPdXRwdXRzID0gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2RvUmVuZGVyKCkge1xuXHRcdGlmICh0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzLmxlbmd0aCA+IDApIHtcblx0XHRcdGlmICh0aGlzLnZpZXdDZWxsLmxheW91dEluZm8ub3V0cHV0VG90YWxIZWlnaHQgIT09IDApIHtcblx0XHRcdFx0dGhpcy52aWV3Q2VsbC51cGRhdGVPdXRwdXRNaW5IZWlnaHQodGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0KTtcblx0XHRcdH1cblxuXHRcdFx0RE9NLnNob3codGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0Q29udGFpbmVyLmRvbU5vZGUpO1xuXHRcdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IE1hdGgubWluKHRoaXMub3B0aW9ucy5saW1pdCwgdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5sZW5ndGgpOyBpbmRleCsrKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJPdXRwdXQgPSB0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzW2luZGV4XTtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxPdXRwdXRFbGVtZW50LCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLnZpZXdDZWxsLCB0aGlzLCB0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRDb250YWluZXIsIGN1cnJPdXRwdXQpO1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzLnB1c2gobmV3IE91dHB1dEVudHJ5Vmlld0hhbmRsZXIoY3Vyck91dHB1dCwgZW50cnkpKTtcblx0XHRcdFx0ZW50cnkucmVuZGVyKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzLmxlbmd0aCA+IHRoaXMub3B0aW9ucy5saW1pdCkge1xuXHRcdFx0XHRET00uc2hvdyh0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRTaG93TW9yZUNvbnRhaW5lci5kb21Ob2RlKTtcblx0XHRcdFx0dGhpcy52aWV3Q2VsbC51cGRhdGVPdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodCg0Nik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3ZhbGlkYXRlRmluYWxPdXRwdXRIZWlnaHQoZmFsc2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBub29wXG5cdFx0XHRET00uaGlkZSh0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRDb250YWluZXIuZG9tTm9kZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0U2hvd01vcmVDb250YWluZXIuZG9tTm9kZS5pbm5lclRleHQgPSAnJztcblx0XHRpZiAodGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5sZW5ndGggPiB0aGlzLm9wdGlvbnMubGltaXQpIHtcblx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dFNob3dNb3JlQ29udGFpbmVyLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fZ2VuZXJhdGVTaG93TW9yZUVsZW1lbnQodGhpcy50ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlcykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRET00uaGlkZSh0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRTaG93TW9yZUNvbnRhaW5lci5kb21Ob2RlKTtcblx0XHRcdHRoaXMudmlld0NlbGwudXBkYXRlT3V0cHV0U2hvd01vcmVDb250YWluZXJIZWlnaHQoMCk7XG5cdFx0fVxuXHR9XG5cblx0dmlld1VwZGF0ZVNob3dPdXRwdXRzKGluaXRSZW5kZXJpbmc6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faGFzU3RhbGVPdXRwdXRzKSB7XG5cdFx0XHR0aGlzLl9oYXNTdGFsZU91dHB1dHMgPSBmYWxzZTtcblx0XHRcdHRoaXMuX291dHB1dEVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiB7XG5cdFx0XHRcdGVudHJ5LmVsZW1lbnQucmVyZW5kZXIoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9vdXRwdXRFbnRyaWVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3Qgdmlld0hhbmRsZXIgPSB0aGlzLl9vdXRwdXRFbnRyaWVzW2luZGV4XTtcblx0XHRcdGNvbnN0IG91dHB1dEVudHJ5ID0gdmlld0hhbmRsZXIuZWxlbWVudDtcblx0XHRcdGlmIChvdXRwdXRFbnRyeS5yZW5kZXJSZXN1bHQpIHtcblx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5jcmVhdGVPdXRwdXQodGhpcy52aWV3Q2VsbCwgb3V0cHV0RW50cnkucmVuZGVyUmVzdWx0IGFzIElJbnNldFJlbmRlck91dHB1dCwgdGhpcy52aWV3Q2VsbC5nZXRPdXRwdXRPZmZzZXQoaW5kZXgpLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXRFbnRyeS5yZW5kZXIodW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9yZWxheW91dENlbGwoKTtcblx0fVxuXG5cdHZpZXdVcGRhdGVIaWRlT3VwdXRzKCk6IHZvaWQge1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9vdXRwdXRFbnRyaWVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5oaWRlSW5zZXQodGhpcy5fb3V0cHV0RW50cmllc1tpbmRleF0ubW9kZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX291dHB1dEhlaWdodFRpbWVyOiBhbnkgPSBudWxsO1xuXG5cdHByaXZhdGUgX3ZhbGlkYXRlRmluYWxPdXRwdXRIZWlnaHQoc3luY2hyb25vdXM6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fb3V0cHV0SGVpZ2h0VGltZXIgIT09IG51bGwpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9vdXRwdXRIZWlnaHRUaW1lcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhlY3V0aW9uU3RhdGUgPSB0aGlzLl9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRDZWxsRXhlY3V0aW9uKHRoaXMudmlld0NlbGwudXJpKTtcblxuXHRcdGlmIChzeW5jaHJvbm91cykge1xuXHRcdFx0dGhpcy52aWV3Q2VsbC51bmxvY2tPdXRwdXRIZWlnaHQoKTtcblx0XHR9IGVsc2UgaWYgKGV4ZWN1dGlvblN0YXRlPy5zdGF0ZSAhPT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUuRXhlY3V0aW5nKSB7XG5cdFx0XHR0aGlzLl9vdXRwdXRIZWlnaHRUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnZpZXdDZWxsLnVubG9ja091dHB1dEhlaWdodCgpO1xuXHRcdFx0fSwgMjAwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVPdXRwdXRzKHNwbGljZTogTm90ZWJvb2tDZWxsT3V0cHV0c1NwbGljZSwgY29udGV4dDogQ2VsbE91dHB1dFVwZGF0ZUNvbnRleHQgPSBDZWxsT3V0cHV0VXBkYXRlQ29udGV4dC5PdGhlcikge1xuXHRcdGNvbnN0IHByZXZpb3VzT3V0cHV0SGVpZ2h0ID0gdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0O1xuXG5cdFx0Ly8gZm9yIGNlbGwgb3V0cHV0IHVwZGF0ZSwgd2UgbWFrZSBzdXJlIHRoZSBjZWxsIGRvZXMgbm90IHNocmluayBiZWZvcmUgdGhlIG5ldyBvdXRwdXRzIGFyZSByZW5kZXJlZC5cblx0XHR0aGlzLnZpZXdDZWxsLnVwZGF0ZU91dHB1dE1pbkhlaWdodChwcmV2aW91c091dHB1dEhlaWdodCk7XG5cblx0XHRpZiAodGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5sZW5ndGgpIHtcblx0XHRcdERPTS5zaG93KHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lci5kb21Ob2RlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0RE9NLmhpZGUodGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0Q29udGFpbmVyLmRvbU5vZGUpO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld0NlbGwuc3BsaWNlT3V0cHV0SGVpZ2h0cyhzcGxpY2Uuc3RhcnQsIHNwbGljZS5kZWxldGVDb3VudCwgc3BsaWNlLm5ld091dHB1dHMubWFwKF8gPT4gMCkpO1xuXHRcdHRoaXMuX3JlbmRlck5vdyhzcGxpY2UsIGNvbnRleHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyTm93KHNwbGljZTogTm90ZWJvb2tDZWxsT3V0cHV0c1NwbGljZSwgY29udGV4dDogQ2VsbE91dHB1dFVwZGF0ZUNvbnRleHQpIHtcblx0XHRpZiAoc3BsaWNlLnN0YXJ0ID49IHRoaXMub3B0aW9ucy5saW1pdCkge1xuXHRcdFx0Ly8gc3BsaWNlIGl0ZW1zIG91dCBvZiBsaW1pdFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0R3JvdXBFbnRyaWVzID0gdGhpcy5fb3V0cHV0RW50cmllcy5zbGljZSgwLCBzcGxpY2Uuc3RhcnQpO1xuXHRcdGNvbnN0IGRlbGV0ZWRFbnRyaWVzID0gdGhpcy5fb3V0cHV0RW50cmllcy5zbGljZShzcGxpY2Uuc3RhcnQsIHNwbGljZS5zdGFydCArIHNwbGljZS5kZWxldGVDb3VudCk7XG5cdFx0Y29uc3Qgc2Vjb25kR3JvdXBFbnRyaWVzID0gdGhpcy5fb3V0cHV0RW50cmllcy5zbGljZShzcGxpY2Uuc3RhcnQgKyBzcGxpY2UuZGVsZXRlQ291bnQpO1xuXHRcdGxldCBuZXdseUluc2VydGVkID0gdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5zbGljZShzcGxpY2Uuc3RhcnQsIHNwbGljZS5zdGFydCArIHNwbGljZS5uZXdPdXRwdXRzLmxlbmd0aCk7XG5cblx0XHQvLyBbLi4uZmlyc3RHcm91cCwgLi4uZGVsZXRlZEVudHJpZXMsIC4uLnNlY29uZEdyb3VwRW50cmllc10gIFsuLi5yZXN0SW5Nb2RlbF1cblx0XHQvLyBbLi4uZmlyc3RHcm91cCwgLi4ubmV3bHlJbnNlcnRlZCwgLi4uc2Vjb25kR3JvdXBFbnRyaWVzLCByZXN0SW5Nb2RlbF1cblx0XHRpZiAoZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoICsgbmV3bHlJbnNlcnRlZC5sZW5ndGggKyBzZWNvbmRHcm91cEVudHJpZXMubGVuZ3RoID4gdGhpcy5vcHRpb25zLmxpbWl0KSB7XG5cdFx0XHQvLyBleGNlZWRzIGxpbWl0IGFnYWluXG5cdFx0XHRpZiAoZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoICsgbmV3bHlJbnNlcnRlZC5sZW5ndGggPiB0aGlzLm9wdGlvbnMubGltaXQpIHtcblx0XHRcdFx0Wy4uLmRlbGV0ZWRFbnRyaWVzLCAuLi5zZWNvbmRHcm91cEVudHJpZXNdLmZvckVhY2goZW50cnkgPT4ge1xuXHRcdFx0XHRcdGVudHJ5LmVsZW1lbnQuZGV0YWNoKCk7XG5cdFx0XHRcdFx0ZW50cnkuZWxlbWVudC5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdG5ld2x5SW5zZXJ0ZWQgPSBuZXdseUluc2VydGVkLnNsaWNlKDAsIHRoaXMub3B0aW9ucy5saW1pdCAtIGZpcnN0R3JvdXBFbnRyaWVzLmxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IG5ld2x5SW5zZXJ0ZWRFbnRyaWVzID0gbmV3bHlJbnNlcnRlZC5tYXAoaW5zZXJ0ID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IE91dHB1dEVudHJ5Vmlld0hhbmRsZXIoaW5zZXJ0LCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxPdXRwdXRFbGVtZW50LCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLnZpZXdDZWxsLCB0aGlzLCB0aGlzLnRlbXBsYXRlRGF0YS5vdXRwdXRDb250YWluZXIsIGluc2VydCkpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzID0gWy4uLmZpcnN0R3JvdXBFbnRyaWVzLCAuLi5uZXdseUluc2VydGVkRW50cmllc107XG5cblx0XHRcdFx0Ly8gcmVuZGVyIG5ld2x5IGluc2VydGVkIG91dHB1dHNcblx0XHRcdFx0Zm9yIChsZXQgaSA9IGZpcnN0R3JvdXBFbnRyaWVzLmxlbmd0aDsgaSA8IHRoaXMuX291dHB1dEVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzW2ldLmVsZW1lbnQucmVuZGVyKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHBhcnQgb2Ygc2Vjb25kR3JvdXBFbnRyaWVzIGFyZSBwdXNoZWQgb3V0IG9mIHZpZXdcblx0XHRcdFx0Ly8gbm93IHdlIGhhdmUgdG8gYmUgY3JlYXRpdmUgYXMgc2Vjb25kR3JvdXBFbnRyaWVzIG1pZ2h0IG5vdCB1c2UgZGVkaWNhdGVkIGNvbnRhaW5lcnNcblx0XHRcdFx0Y29uc3QgZWxlbWVudHNQdXNoZWRPdXRPZlZpZXcgPSBzZWNvbmRHcm91cEVudHJpZXMuc2xpY2UodGhpcy5vcHRpb25zLmxpbWl0IC0gZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoIC0gbmV3bHlJbnNlcnRlZC5sZW5ndGgpO1xuXHRcdFx0XHRbLi4uZGVsZXRlZEVudHJpZXMsIC4uLmVsZW1lbnRzUHVzaGVkT3V0T2ZWaWV3XS5mb3JFYWNoKGVudHJ5ID0+IHtcblx0XHRcdFx0XHRlbnRyeS5lbGVtZW50LmRldGFjaCgpO1xuXHRcdFx0XHRcdGVudHJ5LmVsZW1lbnQuZGlzcG9zZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBleGNsdXNpdmVcblx0XHRcdFx0Y29uc3QgcmVSZW5kZXJSaWdodEJvdW5kYXJ5ID0gZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoICsgbmV3bHlJbnNlcnRlZC5sZW5ndGg7XG5cblx0XHRcdFx0Y29uc3QgbmV3bHlJbnNlcnRlZEVudHJpZXMgPSBuZXdseUluc2VydGVkLm1hcChpbnNlcnQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgT3V0cHV0RW50cnlWaWV3SGFuZGxlcihpbnNlcnQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbE91dHB1dEVsZW1lbnQsIHRoaXMubm90ZWJvb2tFZGl0b3IsIHRoaXMudmlld0NlbGwsIHRoaXMsIHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lciwgaW5zZXJ0KSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX291dHB1dEVudHJpZXMgPSBbLi4uZmlyc3RHcm91cEVudHJpZXMsIC4uLm5ld2x5SW5zZXJ0ZWRFbnRyaWVzLCAuLi5zZWNvbmRHcm91cEVudHJpZXMuc2xpY2UoMCwgdGhpcy5vcHRpb25zLmxpbWl0IC0gZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoIC0gbmV3bHlJbnNlcnRlZC5sZW5ndGgpXTtcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoOyBpIDwgcmVSZW5kZXJSaWdodEJvdW5kYXJ5OyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBwcmV2aW91c1NpYmxpbmcgPSBpIC0gMSA+PSAwICYmIHRoaXMuX291dHB1dEVudHJpZXNbaSAtIDFdICYmICEhKHRoaXMuX291dHB1dEVudHJpZXNbaSAtIDFdLmVsZW1lbnQuaW5uZXJDb250YWluZXI/LnBhcmVudEVsZW1lbnQpID8gdGhpcy5fb3V0cHV0RW50cmllc1tpIC0gMV0uZWxlbWVudC5pbm5lckNvbnRhaW5lciA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzW2ldLmVsZW1lbnQucmVuZGVyKHByZXZpb3VzU2libGluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYWZ0ZXIgc3BsaWNlLCBpdCBkb2Vzbid0IGV4Y2VlZFxuXHRcdFx0ZGVsZXRlZEVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiB7XG5cdFx0XHRcdGVudHJ5LmVsZW1lbnQuZGV0YWNoKCk7XG5cdFx0XHRcdGVudHJ5LmVsZW1lbnQuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHJlUmVuZGVyUmlnaHRCb3VuZGFyeSA9IGZpcnN0R3JvdXBFbnRyaWVzLmxlbmd0aCArIG5ld2x5SW5zZXJ0ZWQubGVuZ3RoO1xuXG5cdFx0XHRjb25zdCBuZXdseUluc2VydGVkRW50cmllcyA9IG5ld2x5SW5zZXJ0ZWQubWFwKGluc2VydCA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgT3V0cHV0RW50cnlWaWV3SGFuZGxlcihpbnNlcnQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbE91dHB1dEVsZW1lbnQsIHRoaXMubm90ZWJvb2tFZGl0b3IsIHRoaXMudmlld0NlbGwsIHRoaXMsIHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lciwgaW5zZXJ0KSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IG91dHB1dHNOZXdseUF2YWlsYWJsZTogT3V0cHV0RW50cnlWaWV3SGFuZGxlcltdID0gW107XG5cblx0XHRcdGlmIChmaXJzdEdyb3VwRW50cmllcy5sZW5ndGggKyBuZXdseUluc2VydGVkRW50cmllcy5sZW5ndGggKyBzZWNvbmRHcm91cEVudHJpZXMubGVuZ3RoIDwgdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgbGFzdCA9IE1hdGgubWluKHRoaXMub3B0aW9ucy5saW1pdCwgdGhpcy52aWV3Q2VsbC5vdXRwdXRzVmlld01vZGVscy5sZW5ndGgpO1xuXHRcdFx0XHRvdXRwdXRzTmV3bHlBdmFpbGFibGUgPSB0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzLnNsaWNlKGZpcnN0R3JvdXBFbnRyaWVzLmxlbmd0aCArIG5ld2x5SW5zZXJ0ZWRFbnRyaWVzLmxlbmd0aCArIHNlY29uZEdyb3VwRW50cmllcy5sZW5ndGgsIGxhc3QpLm1hcChvdXRwdXQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgT3V0cHV0RW50cnlWaWV3SGFuZGxlcihvdXRwdXQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbE91dHB1dEVsZW1lbnQsIHRoaXMubm90ZWJvb2tFZGl0b3IsIHRoaXMudmlld0NlbGwsIHRoaXMsIHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lciwgb3V0cHV0KSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzID0gWy4uLmZpcnN0R3JvdXBFbnRyaWVzLCAuLi5uZXdseUluc2VydGVkRW50cmllcywgLi4uc2Vjb25kR3JvdXBFbnRyaWVzLCAuLi5vdXRwdXRzTmV3bHlBdmFpbGFibGVdO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gZmlyc3RHcm91cEVudHJpZXMubGVuZ3RoOyBpIDwgcmVSZW5kZXJSaWdodEJvdW5kYXJ5OyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcHJldmlvdXNTaWJsaW5nID0gaSAtIDEgPj0gMCAmJiB0aGlzLl9vdXRwdXRFbnRyaWVzW2kgLSAxXSAmJiAhISh0aGlzLl9vdXRwdXRFbnRyaWVzW2kgLSAxXS5lbGVtZW50LmlubmVyQ29udGFpbmVyPy5wYXJlbnRFbGVtZW50KSA/IHRoaXMuX291dHB1dEVudHJpZXNbaSAtIDFdLmVsZW1lbnQuaW5uZXJDb250YWluZXIgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX291dHB1dEVudHJpZXNbaV0uZWxlbWVudC5yZW5kZXIocHJldmlvdXNTaWJsaW5nKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRzTmV3bHlBdmFpbGFibGUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dGhpcy5fb3V0cHV0RW50cmllc1tmaXJzdEdyb3VwRW50cmllcy5sZW5ndGggKyBuZXdseUluc2VydGVkLmxlbmd0aCArIHNlY29uZEdyb3VwRW50cmllcy5sZW5ndGggKyBpXS5lbGVtZW50LnJlbmRlcih1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzLmxlbmd0aCA+IHRoaXMub3B0aW9ucy5saW1pdCkge1xuXHRcdFx0RE9NLnNob3codGhpcy50ZW1wbGF0ZURhdGEub3V0cHV0U2hvd01vcmVDb250YWluZXIuZG9tTm9kZSk7XG5cdFx0XHRpZiAoIXRoaXMudGVtcGxhdGVEYXRhLm91dHB1dFNob3dNb3JlQ29udGFpbmVyLmRvbU5vZGUuaGFzQ2hpbGROb2RlcygpKSB7XG5cdFx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dFNob3dNb3JlQ29udGFpbmVyLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fZ2VuZXJhdGVTaG93TW9yZUVsZW1lbnQodGhpcy50ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlcykpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy52aWV3Q2VsbC51cGRhdGVPdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodCg0Nik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdERPTS5oaWRlKHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dFNob3dNb3JlQ29udGFpbmVyLmRvbU5vZGUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlbGF5b3V0Q2VsbCgpO1xuXHRcdC8vIGlmIGl0J3MgY2xlYXJpbmcgYWxsIG91dHB1dHMsIG9yIG91dHB1dHMgYXJlIGFsbCByZW5kZXJlZCBzeW5jaHJvbm91c2x5XG5cdFx0Ly8gc2hyaW5rIGltbWVkaWF0ZWx5IGFzIHRoZSBmaW5hbCBvdXRwdXQgaGVpZ2h0IHdpbGwgYmUgemVyby5cblx0XHQvLyBpZiBpdCdzIHJlcnVuLCB0aGVuIHRoZSBvdXRwdXQgY2xlYXJpbmcgbWlnaHQgYmUgdGVtcG9yYXJ5LCBzbyB3ZSBkb24ndCBzaHJpbmsgaW1tZWRpYXRlbHlcblx0XHR0aGlzLl92YWxpZGF0ZUZpbmFsT3V0cHV0SGVpZ2h0KGNvbnRleHQgPT09IENlbGxPdXRwdXRVcGRhdGVDb250ZXh0Lk90aGVyICYmIHRoaXMudmlld0NlbGwub3V0cHV0c1ZpZXdNb2RlbHMubGVuZ3RoID09PSAwKTtcblx0fVxuXG5cdHByaXZhdGUgX2dlbmVyYXRlU2hvd01vcmVFbGVtZW50KGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgbWQ6IElNYXJrZG93blN0cmluZyA9IHtcblx0XHRcdHZhbHVlOiBgVGhlcmUgYXJlIG1vcmUgdGhhbiAke3RoaXMub3B0aW9ucy5saW1pdH0gb3V0cHV0cywgW3Nob3cgbW9yZSAob3BlbiB0aGUgcmF3IG91dHB1dCBkYXRhIGluIGEgdGV4dCBlZGl0b3IpIC4uLl0oY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLm9wZW5MYXJnZU91dHB1dClgLFxuXHRcdFx0aXNUcnVzdGVkOiB0cnVlLFxuXHRcdFx0c3VwcG9ydFRoZW1lSWNvbnM6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVuZGVyZWQgPSByZW5kZXJNYXJrZG93bihtZCwge1xuXHRcdFx0YWN0aW9uSGFuZGxlcjoge1xuXHRcdFx0XHRjYWxsYmFjazogKGNvbnRlbnQpID0+IHtcblx0XHRcdFx0XHRpZiAoY29udGVudCA9PT0gJ2NvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5vcGVuTGFyZ2VPdXRwdXQnKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihDZWxsVXJpLmdlbmVyYXRlQ2VsbE91dHB1dFVyaVdpdGhJZCh0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCEudXJpKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkaXNwb3NhYmxlc1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZW5kZXJlZCk7XG5cblx0XHRyZW5kZXJlZC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ291dHB1dC1zaG93LW1vcmUnKTtcblx0XHRyZXR1cm4gcmVuZGVyZWQuZWxlbWVudDtcblx0fVxuXG5cdHByaXZhdGUgX3JlbGF5b3V0Q2VsbCgpIHtcblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmxheW91dE5vdGVib29rQ2VsbCh0aGlzLnZpZXdDZWxsLCB0aGlzLnZpZXdDZWxsLmxheW91dEluZm8udG90YWxIZWlnaHQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLnZpZXdDZWxsLnVwZGF0ZU91dHB1dE1pbkhlaWdodCgwKTtcblxuXHRcdGlmICh0aGlzLl9vdXRwdXRIZWlnaHRUaW1lcikge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX291dHB1dEhlaWdodFRpbWVyKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vdXRwdXRFbnRyaWVzLmZvckVhY2goZW50cnkgPT4ge1xuXHRcdFx0ZW50cnkuZWxlbWVudC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY29uc3QgSlVQWVRFUl9SRU5ERVJFUl9NSU1FVFlQRVMgPSBbXG5cdCdhcHBsaWNhdGlvbi9nZW8ranNvbicsXG5cdCdhcHBsaWNhdGlvbi92ZG9tLnYxK2pzb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLmRhdGFyZXNvdXJjZStqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5wbG90bHkudjEranNvbicsXG5cdCdhcHBsaWNhdGlvbi92bmQudmVnYS52Mitqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC52ZWdhLnYzK2pzb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLnZlZ2EudjQranNvbicsXG5cdCdhcHBsaWNhdGlvbi92bmQudmVnYS52NStqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC52ZWdhbGl0ZS52MStqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC52ZWdhbGl0ZS52Mitqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC52ZWdhbGl0ZS52Mytqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC52ZWdhbGl0ZS52NCtqc29uJyxcblx0J2FwcGxpY2F0aW9uL3gtbnRlcmFjdC1tb2RlbC1kZWJ1Zytqc29uJyxcblx0J2ltYWdlL3N2Zyt4bWwnLFxuXHQndGV4dC9sYXRleCcsXG5cdCd0ZXh0L3ZuZC5wbG90bHkudjEraHRtbCcsXG5cdCdhcHBsaWNhdGlvbi92bmQuanVweXRlci53aWRnZXQtdmlldytqc29uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLmVycm9yJ1xuXTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsY0FBYztBQUV2QixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsb0JBQW9CO0FBQzdCLFlBQVksU0FBUztBQUNyQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGNBQWMsY0FBYztBQUNyQyxTQUFT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
