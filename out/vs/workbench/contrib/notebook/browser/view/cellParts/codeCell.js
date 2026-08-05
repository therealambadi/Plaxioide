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
import { localize } from "../../../../../../nls.js";
import * as DOM from "../../../../../../base/browser/dom.js";
import { raceCancellation } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { clamp } from "../../../../../../base/common/numbers.js";
import * as strings from "../../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { EditorOption } from "../../../../../../editor/common/config/editorOptions.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { tokenizeToStringSync } from "../../../../../../editor/common/languages/textToHtmlTokenizer.js";
import { CodeActionController } from "../../../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { CellFocusMode, EXPAND_CELL_INPUT_COMMAND_ID } from "../../notebookBrowser.js";
import { outputDisplayLimit } from "../../viewModel/codeCellViewModel.js";
import { CellEditorOptions } from "./cellEditorOptions.js";
import { CellOutputContainer } from "./cellOutput.js";
import { CollapsedCodeCellExecutionIcon } from "./codeCellExecutionIcon.js";
let CodeCell = class extends Disposable {
  constructor(notebookEditor, viewCell, templateData, editorPool, instantiationService, keybindingService, openerService, languageService, configurationService, notebookExecutionStateService) {
    super();
    this.notebookEditor = notebookEditor;
    this.viewCell = viewCell;
    this.templateData = templateData;
    this.editorPool = editorPool;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.languageService = languageService;
    this.configurationService = configurationService;
    this._isDisposed = false;
    this._cellEditorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(viewCell.language), this.notebookEditor.notebookOptions, this.configurationService));
    this._outputContainerRenderer = this.instantiationService.createInstance(CellOutputContainer, notebookEditor, viewCell, templateData, { limit: outputDisplayLimit });
    this.cellParts = this._register(templateData.cellParts.concatContentPart([this._cellEditorOptions, this._outputContainerRenderer], DOM.getWindow(notebookEditor.getDomNode())));
    const editorHeight = this.calculateInitEditorHeight();
    this.initializeEditor(editorHeight);
    this._renderedInputCollapseState = false;
    this.registerNotebookEditorListeners();
    this.registerViewCellLayoutChange();
    this.registerCellEditorEventListeners();
    this.registerMouseListener();
    this._register(Event.any(this.viewCell.onDidStartExecution, this.viewCell.onDidStopExecution)((e) => {
      this.cellParts.updateForExecutionState(this.viewCell, e);
    }));
    this._register(this.viewCell.onDidChangeState((e) => {
      this.cellParts.updateState(this.viewCell, e);
      if (e.outputIsHoveredChanged) {
        this.updateForOutputHover();
      }
      if (e.outputIsFocusedChanged) {
        this.updateForOutputFocus();
      }
      if (e.metadataChanged || e.internalMetadataChanged) {
        this.updateEditorOptions();
      }
      if (e.inputCollapsedChanged || e.outputCollapsedChanged) {
        this.viewCell.pauseLayout();
        const updated = this.updateForCollapseState();
        this.viewCell.resumeLayout();
        if (updated) {
          this.relayoutCell();
        }
      }
      if (e.focusModeChanged) {
        this.updateEditorForFocusModeChange(true);
      }
    }));
    this.cellParts.scheduleRenderCell(this.viewCell);
    this._register(toDisposable(() => {
      this.cellParts.unrenderCell(this.viewCell);
    }));
    this.updateEditorOptions();
    this.updateEditorForFocusModeChange(false);
    this.updateForOutputHover();
    this.updateForOutputFocus();
    this.viewCell.editorHeight = editorHeight;
    this._outputContainerRenderer.render();
    this._renderedOutputCollapseState = false;
    this.initialViewUpdateExpanded();
    this._register(this.viewCell.onLayoutInfoRead(() => {
      this.cellParts.prepareLayout();
    }));
    const executionItemElement = DOM.append(this.templateData.cellInputCollapsedContainer, DOM.$(".collapsed-execution-icon"));
    this._register(toDisposable(() => {
      executionItemElement.remove();
    }));
    this._collapsedExecutionIcon = this._register(this.instantiationService.createInstance(CollapsedCodeCellExecutionIcon, this.notebookEditor, this.viewCell, executionItemElement));
    this.updateForCollapseState();
    this._register(Event.runAndSubscribe(viewCell.onDidChangeOutputs, this.updateForOutputs.bind(this)));
    this._register(Event.runAndSubscribe(viewCell.onDidChangeLayout, this.updateForLayout.bind(this)));
    this._cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
    templateData.editor.updateOptions(this._cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
  }
  updateCodeCellOptions(templateData) {
    templateData.editor.updateOptions(this._cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
    const cts = new CancellationTokenSource();
    this._register({ dispose() {
      cts.dispose(true);
    } });
    raceCancellation(this.viewCell.resolveTextModel(), cts.token).then((model) => {
      if (this._isDisposed) {
        return;
      }
      if (model) {
        model.updateOptions({
          indentSize: this._cellEditorOptions.indentSize,
          tabSize: this._cellEditorOptions.tabSize,
          insertSpaces: this._cellEditorOptions.insertSpaces
        });
      }
    });
  }
  updateForLayout() {
    this._pendingLayout?.dispose();
    this._pendingLayout = DOM.modify(DOM.getWindow(this.notebookEditor.getDomNode()), () => {
      this.cellParts.updateInternalLayoutNow(this.viewCell);
    });
  }
  updateForOutputHover() {
    this.templateData.container.classList.toggle("cell-output-hover", this.viewCell.outputIsHovered);
  }
  updateForOutputFocus() {
    this.templateData.container.classList.toggle("cell-output-focus", this.viewCell.outputIsFocused);
  }
  calculateInitEditorHeight() {
    const lineNum = this.viewCell.lineCount;
    const lineHeight = this.viewCell.layoutInfo.fontInfo?.lineHeight || 17;
    const editorPadding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
    const editorHeight = this.viewCell.layoutInfo.editorHeight === 0 ? lineNum * lineHeight + editorPadding.top + editorPadding.bottom : this.viewCell.layoutInfo.editorHeight;
    return editorHeight;
  }
  initializeEditor(initEditorHeight) {
    const width = this.viewCell.layoutInfo.editorWidth;
    this.layoutEditor(
      {
        width,
        height: initEditorHeight
      }
    );
    const cts = new CancellationTokenSource();
    this._register({ dispose() {
      cts.dispose(true);
    } });
    raceCancellation(this.viewCell.resolveTextModel(), cts.token).then((model) => {
      if (this._isDisposed || model?.isDisposed()) {
        return;
      }
      if (model && this.templateData.editor) {
        this._reigsterModelListeners(model);
        this.templateData.editor.setModel(model);
        if (this._isDisposed) {
          return;
        }
        model.updateOptions({
          indentSize: this._cellEditorOptions.indentSize,
          tabSize: this._cellEditorOptions.tabSize,
          insertSpaces: this._cellEditorOptions.insertSpaces
        });
        this.viewCell.attachTextEditor(this.templateData.editor, this.viewCell.layoutInfo.estimatedHasHorizontalScrolling);
        const focusEditorIfNeeded = () => {
          if (this.notebookEditor.getActiveCell() === this.viewCell && this.viewCell.focusMode === CellFocusMode.Editor && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) {
            this.templateData.editor?.focus();
          }
        };
        focusEditorIfNeeded();
        const realContentHeight = this.templateData.editor?.getContentHeight();
        if (realContentHeight !== void 0 && realContentHeight !== initEditorHeight) {
          this.onCellEditorHeightChange(realContentHeight);
        }
        if (this._isDisposed) {
          return;
        }
        focusEditorIfNeeded();
      }
      this._register(this._cellEditorOptions.onDidChange(() => this.updateCodeCellOptions(this.templateData)));
    });
  }
  updateForOutputs() {
    DOM.setVisibility(this.viewCell.outputsViewModels.length > 0, this.templateData.focusSinkElement);
  }
  updateEditorOptions() {
    const editor = this.templateData.editor;
    if (!editor) {
      return;
    }
    const isReadonly = this.notebookEditor.isReadOnly;
    const padding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
    const options = editor.getOptions();
    if (options.get(EditorOption.readOnly) !== isReadonly || options.get(EditorOption.padding) !== padding) {
      editor.updateOptions({ readOnly: this.notebookEditor.isReadOnly, padding: this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri) });
    }
  }
  registerNotebookEditorListeners() {
    this._register(this.notebookEditor.onDidScroll(() => {
      this.adjustEditorPosition();
    }));
    this._register(this.notebookEditor.onDidChangeLayout(() => {
      this.adjustEditorPosition();
      this.onCellWidthChange();
    }));
  }
  adjustEditorPosition() {
    const extraOffset = -6 - 1;
    const min = 0;
    const scrollTop = this.notebookEditor.scrollTop;
    const elementTop = this.notebookEditor.getAbsoluteTopOfElement(this.viewCell);
    const diff = scrollTop - elementTop + extraOffset;
    const notebookEditorLayout = this.notebookEditor.getLayoutInfo();
    const editorMaxHeight = notebookEditorLayout.height - notebookEditorLayout.stickyHeight - 26;
    const maxTop = this.viewCell.layoutInfo.editorHeight - editorMaxHeight;
    const top = maxTop > 20 ? clamp(min, diff, maxTop) : min;
    this.templateData.editorPart.style.top = `${top}px`;
    this.templateData.editor?.setScrollTop(top);
  }
  registerViewCellLayoutChange() {
    this._register(this.viewCell.onDidChangeLayout((e) => {
      if (e.outerWidth !== void 0) {
        const layoutInfo = this.templateData.editor.getLayoutInfo();
        if (layoutInfo.width !== this.viewCell.layoutInfo.editorWidth) {
          this.onCellWidthChange();
          this.adjustEditorPosition();
        }
      }
    }));
  }
  registerCellEditorEventListeners() {
    this._register(this.templateData.editor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        if (this.viewCell.layoutInfo.editorHeight !== e.contentHeight) {
          this.onCellEditorHeightChange(e.contentHeight);
          this.adjustEditorPosition();
        }
      }
    }));
    this._register(this.templateData.editor.onDidChangeCursorSelection((e) => {
      if (e.source === "restoreState" || e.oldModelVersionId === 0) {
        return;
      }
      const selections = this.templateData.editor.getSelections();
      if (selections?.length) {
        const contentHeight = this.templateData.editor.getContentHeight();
        const layoutContentHeight = this.viewCell.layoutInfo.editorHeight;
        if (contentHeight !== layoutContentHeight) {
          this.onCellEditorHeightChange(contentHeight);
          if (this._isDisposed) {
            return;
          }
        }
        const lastSelection = selections[selections.length - 1];
        this.notebookEditor.revealRangeInViewAsync(this.viewCell, lastSelection);
      }
    }));
    this._register(this.templateData.editor.onDidBlurEditorWidget(() => {
      CodeActionController.get(this.templateData.editor)?.hideCodeActions();
      CodeActionController.get(this.templateData.editor)?.hideLightBulbWidget();
    }));
  }
  _reigsterModelListeners(model) {
    this._register(model.onDidChangeTokens(() => {
      if (this.viewCell.isInputCollapsed && this._inputCollapseElement) {
        const content = this._getRichTextFromLineTokens(model);
        DOM.safeInnerHtml(this._inputCollapseElement, content);
        this._attachInputExpandButton(this._inputCollapseElement);
      }
    }));
  }
  registerMouseListener() {
    this._register(this.templateData.editor.onMouseDown((e) => {
      if (e.event.rightButton) {
        e.event.preventDefault();
      }
    }));
  }
  shouldPreserveEditor() {
    return this.notebookEditor.getActiveCell() === this.viewCell && this.viewCell.focusMode === CellFocusMode.Editor && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body);
  }
  updateEditorForFocusModeChange(sync) {
    if (this.shouldPreserveEditor()) {
      if (sync) {
        this.templateData.editor?.focus();
      } else {
        this._register(DOM.runAtThisOrScheduleAtNextAnimationFrame(DOM.getWindow(this.templateData.container), () => {
          this.templateData.editor?.focus();
        }));
      }
    }
    this.templateData.container.classList.toggle("cell-editor-focus", this.viewCell.focusMode === CellFocusMode.Editor);
    this.templateData.container.classList.toggle("cell-output-focus", this.viewCell.focusMode === CellFocusMode.Output);
  }
  updateForCollapseState() {
    if (this.viewCell.isOutputCollapsed === this._renderedOutputCollapseState && this.viewCell.isInputCollapsed === this._renderedInputCollapseState) {
      return false;
    }
    this.viewCell.layoutChange({ editorHeight: true });
    if (this.viewCell.isInputCollapsed) {
      this._collapseInput();
    } else {
      this._showInput();
    }
    if (this.viewCell.isOutputCollapsed) {
      this._collapseOutput();
    } else {
      this._showOutput(false);
    }
    this.relayoutCell();
    this._renderedOutputCollapseState = this.viewCell.isOutputCollapsed;
    this._renderedInputCollapseState = this.viewCell.isInputCollapsed;
    return true;
  }
  _collapseInput() {
    DOM.hide(this.templateData.editorPart);
    this.templateData.container.classList.toggle("input-collapsed", true);
    this._removeInputCollapsePreview();
    this._collapsedExecutionIcon.setVisibility(true);
    const richEditorText = this.templateData.editor.hasModel() ? this._getRichTextFromLineTokens(this.templateData.editor.getModel()) : this._getRichText(this.viewCell.textBuffer, this.viewCell.language);
    const element = DOM.$("div.cell-collapse-preview");
    DOM.safeInnerHtml(element, richEditorText);
    this._inputCollapseElement = element;
    this.templateData.cellInputCollapsedContainer.appendChild(element);
    this._attachInputExpandButton(element);
    DOM.show(this.templateData.cellInputCollapsedContainer);
  }
  _attachInputExpandButton(element) {
    const expandIcon = DOM.$("span.expandInputIcon");
    const keybinding = this.keybindingService.lookupKeybinding(EXPAND_CELL_INPUT_COMMAND_ID);
    if (keybinding) {
      element.title = localize("cellExpandInputButtonLabelWithDoubleClick", "Double-click to expand cell input ({0})", keybinding.getLabel());
      expandIcon.title = localize("cellExpandInputButtonLabel", "Expand Cell Input ({0})", keybinding.getLabel());
    }
    expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
    element.appendChild(expandIcon);
  }
  _showInput() {
    this._collapsedExecutionIcon.setVisibility(false);
    DOM.show(this.templateData.editorPart);
    DOM.hide(this.templateData.cellInputCollapsedContainer);
  }
  _getRichText(buffer, language) {
    return tokenizeToStringSync(this.languageService, buffer.getLineContent(1), language);
  }
  _getRichTextFromLineTokens(model) {
    let result = `<div class="monaco-tokenized-source">`;
    const firstLineTokens = model.tokenization.getLineTokens(1);
    const viewLineTokens = firstLineTokens.inflate();
    const line = model.getLineContent(1);
    let startOffset = 0;
    for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
      const type = viewLineTokens.getClassName(j);
      const endIndex = viewLineTokens.getEndOffset(j);
      result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
      startOffset = endIndex;
    }
    result += `</div>`;
    return result;
  }
  _removeInputCollapsePreview() {
    const children = this.templateData.cellInputCollapsedContainer.children;
    const elements = [];
    for (let i = 0; i < children.length; i++) {
      if (children[i].classList.contains("cell-collapse-preview")) {
        elements.push(children[i]);
      }
    }
    elements.forEach((element) => {
      element.remove();
    });
  }
  _updateOutputInnerContainer(hide) {
    const children = this.templateData.outputContainer.domNode.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].classList.contains("output-inner-container")) {
        DOM.setVisibility(!hide, children[i]);
      }
    }
  }
  _collapseOutput() {
    this.templateData.container.classList.toggle("output-collapsed", true);
    DOM.show(this.templateData.cellOutputCollapsedContainer);
    this._updateOutputInnerContainer(true);
    this._outputContainerRenderer.viewUpdateHideOuputs();
  }
  _showOutput(initRendering) {
    this.templateData.container.classList.toggle("output-collapsed", false);
    DOM.hide(this.templateData.cellOutputCollapsedContainer);
    this._updateOutputInnerContainer(false);
    this._outputContainerRenderer.viewUpdateShowOutputs(initRendering);
  }
  initialViewUpdateExpanded() {
    this.templateData.container.classList.toggle("input-collapsed", false);
    DOM.show(this.templateData.editorPart);
    DOM.hide(this.templateData.cellInputCollapsedContainer);
    this.templateData.container.classList.toggle("output-collapsed", false);
    this._showOutput(true);
  }
  layoutEditor(dimension) {
    const editorLayout = this.notebookEditor.getLayoutInfo();
    const maxHeight = Math.min(
      editorLayout.height - editorLayout.stickyHeight - 26,
      dimension.height
    );
    this.templateData.editor?.layout({
      width: dimension.width,
      height: maxHeight
    }, true);
  }
  onCellWidthChange() {
    if (!this.templateData.editor.hasModel()) {
      return;
    }
    const realContentHeight = this.templateData.editor.getContentHeight();
    this.viewCell.editorHeight = realContentHeight;
    this.relayoutCell();
    this.layoutEditor(
      {
        width: this.viewCell.layoutInfo.editorWidth,
        height: realContentHeight
      }
    );
  }
  onCellEditorHeightChange(newHeight) {
    const viewLayout = this.templateData.editor.getLayoutInfo();
    this.viewCell.editorHeight = newHeight;
    this.relayoutCell();
    this.layoutEditor(
      {
        width: viewLayout.width,
        height: newHeight
      }
    );
  }
  relayoutCell() {
    this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
  }
  dispose() {
    this._isDisposed = true;
    if (this.shouldPreserveEditor()) {
      this.editorPool.preserveFocusedEditor(this.viewCell);
    }
    this.viewCell.detachTextEditor();
    this._removeInputCollapsePreview();
    this._outputContainerRenderer.dispose();
    this._pendingLayout?.dispose();
    super.dispose();
  }
};
CodeCell = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, INotebookExecutionStateService)
], CodeCell);
export {
  CodeCell
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL2NvZGVDZWxsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRGltZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2RpbWVuc2lvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgdG9rZW5pemVUb1N0cmluZ1N5bmMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy90ZXh0VG9IdG1sVG9rZW5pemVyLmpzJztcbmltcG9ydCB7IElSZWFkb25seVRleHRCdWZmZXIsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25Db250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29kZUFjdGlvbi9icm93c2VyL2NvZGVBY3Rpb25Db250cm9sbGVyLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENlbGxGb2N1c01vZGUsIEVYUEFORF9DRUxMX0lOUFVUX0NPTU1BTkRfSUQsIElBY3RpdmVOb3RlYm9va0VkaXRvckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVDZWxsVmlld01vZGVsLCBvdXRwdXREaXNwbGF5TGltaXQgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvY29kZUNlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbFBhcnRzQ29sbGVjdGlvbiB9IGZyb20gJy4uL2NlbGxQYXJ0LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbEVkaXRvclBvb2wgfSBmcm9tICcuLi9ub3RlYm9va0NlbGxFZGl0b3JQb29sLmpzJztcbmltcG9ydCB7IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUgfSBmcm9tICcuLi9ub3RlYm9va1JlbmRlcmluZ0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4vY2VsbEVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2VsbE91dHB1dENvbnRhaW5lciB9IGZyb20gJy4vY2VsbE91dHB1dC5qcyc7XG5pbXBvcnQgeyBDb2xsYXBzZWRDb2RlQ2VsbEV4ZWN1dGlvbkljb24gfSBmcm9tICcuL2NvZGVDZWxsRXhlY3V0aW9uSWNvbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDb2RlQ2VsbCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9vdXRwdXRDb250YWluZXJSZW5kZXJlcjogQ2VsbE91dHB1dENvbnRhaW5lcjtcblx0cHJpdmF0ZSBfaW5wdXRDb2xsYXBzZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3JlbmRlcmVkSW5wdXRDb2xsYXBzZVN0YXRlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9yZW5kZXJlZE91dHB1dENvbGxhcHNlU3RhdGU6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2lzRGlzcG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBjZWxsUGFydHM6IENlbGxQYXJ0c0NvbGxlY3Rpb247XG5cblx0cHJpdmF0ZSBfY29sbGFwc2VkRXhlY3V0aW9uSWNvbjogQ29sbGFwc2VkQ29kZUNlbGxFeGVjdXRpb25JY29uO1xuXHRwcml2YXRlIF9jZWxsRWRpdG9yT3B0aW9uczogQ2VsbEVkaXRvck9wdGlvbnM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvcjogSUFjdGl2ZU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3Q2VsbDogQ29kZUNlbGxWaWV3TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0ZW1wbGF0ZURhdGE6IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JQb29sOiBOb3RlYm9va0NlbGxFZGl0b3JQb29sLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDZWxsRWRpdG9yT3B0aW9ucyh0aGlzLm5vdGVib29rRWRpdG9yLmdldEJhc2VDZWxsRWRpdG9yT3B0aW9ucyh2aWV3Q2VsbC5sYW5ndWFnZSksIHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0dGhpcy5fb3V0cHV0Q29udGFpbmVyUmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxPdXRwdXRDb250YWluZXIsIG5vdGVib29rRWRpdG9yLCB2aWV3Q2VsbCwgdGVtcGxhdGVEYXRhLCB7IGxpbWl0OiBvdXRwdXREaXNwbGF5TGltaXQgfSk7XG5cdFx0dGhpcy5jZWxsUGFydHMgPSB0aGlzLl9yZWdpc3Rlcih0ZW1wbGF0ZURhdGEuY2VsbFBhcnRzLmNvbmNhdENvbnRlbnRQYXJ0KFt0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucywgdGhpcy5fb3V0cHV0Q29udGFpbmVyUmVuZGVyZXJdLCBET00uZ2V0V2luZG93KG5vdGVib29rRWRpdG9yLmdldERvbU5vZGUoKSkpKTtcblxuXHRcdC8vIHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQgb3IgZXN0aW1hdGlvbiB3aGVuIHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQgPT09IDBcblx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLmNhbGN1bGF0ZUluaXRFZGl0b3JIZWlnaHQoKTtcblx0XHR0aGlzLmluaXRpYWxpemVFZGl0b3IoZWRpdG9ySGVpZ2h0KTtcblx0XHR0aGlzLl9yZW5kZXJlZElucHV0Q29sbGFwc2VTdGF0ZSA9IGZhbHNlOyAvLyBlZGl0b3IgaXMgYWx3YXlzIGV4cGFuZGVkIGluaXRpYWxseVxuXG5cdFx0dGhpcy5yZWdpc3Rlck5vdGVib29rRWRpdG9yTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5yZWdpc3RlclZpZXdDZWxsTGF5b3V0Q2hhbmdlKCk7XG5cdFx0dGhpcy5yZWdpc3RlckNlbGxFZGl0b3JFdmVudExpc3RlbmVycygpO1xuXHRcdHRoaXMucmVnaXN0ZXJNb3VzZUxpc3RlbmVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkodGhpcy52aWV3Q2VsbC5vbkRpZFN0YXJ0RXhlY3V0aW9uLCB0aGlzLnZpZXdDZWxsLm9uRGlkU3RvcEV4ZWN1dGlvbikoKGUpID0+IHtcblx0XHRcdHRoaXMuY2VsbFBhcnRzLnVwZGF0ZUZvckV4ZWN1dGlvblN0YXRlKHRoaXMudmlld0NlbGwsIGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0NlbGwub25EaWRDaGFuZ2VTdGF0ZShlID0+IHtcblx0XHRcdHRoaXMuY2VsbFBhcnRzLnVwZGF0ZVN0YXRlKHRoaXMudmlld0NlbGwsIGUpO1xuXG5cdFx0XHRpZiAoZS5vdXRwdXRJc0hvdmVyZWRDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRm9yT3V0cHV0SG92ZXIoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUub3V0cHV0SXNGb2N1c2VkQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZvck91dHB1dEZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLm1ldGFkYXRhQ2hhbmdlZCB8fCBlLmludGVybmFsTWV0YWRhdGFDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRWRpdG9yT3B0aW9ucygpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5pbnB1dENvbGxhcHNlZENoYW5nZWQgfHwgZS5vdXRwdXRDb2xsYXBzZWRDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMudmlld0NlbGwucGF1c2VMYXlvdXQoKTtcblx0XHRcdFx0Y29uc3QgdXBkYXRlZCA9IHRoaXMudXBkYXRlRm9yQ29sbGFwc2VTdGF0ZSgpO1xuXHRcdFx0XHR0aGlzLnZpZXdDZWxsLnJlc3VtZUxheW91dCgpO1xuXHRcdFx0XHRpZiAodXBkYXRlZCkge1xuXHRcdFx0XHRcdHRoaXMucmVsYXlvdXRDZWxsKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuZm9jdXNNb2RlQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUVkaXRvckZvckZvY3VzTW9kZUNoYW5nZSh0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmNlbGxQYXJ0cy5zY2hlZHVsZVJlbmRlckNlbGwodGhpcy52aWV3Q2VsbCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5jZWxsUGFydHMudW5yZW5kZXJDZWxsKHRoaXMudmlld0NlbGwpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMudXBkYXRlRWRpdG9yT3B0aW9ucygpO1xuXHRcdHRoaXMudXBkYXRlRWRpdG9yRm9yRm9jdXNNb2RlQ2hhbmdlKGZhbHNlKTtcblx0XHR0aGlzLnVwZGF0ZUZvck91dHB1dEhvdmVyKCk7XG5cdFx0dGhpcy51cGRhdGVGb3JPdXRwdXRGb2N1cygpO1xuXG5cdFx0Ly8gUmVuZGVyIE91dHB1dHNcblx0XHR0aGlzLnZpZXdDZWxsLmVkaXRvckhlaWdodCA9IGVkaXRvckhlaWdodDtcblx0XHR0aGlzLl9vdXRwdXRDb250YWluZXJSZW5kZXJlci5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZW5kZXJlZE91dHB1dENvbGxhcHNlU3RhdGUgPSBmYWxzZTsgLy8gdGhlIG91dHB1dCBpcyBhbHdheXMgcmVuZGVyZWQgaW5pdGlhbGx5XG5cdFx0Ly8gTmVlZCB0byBkbyB0aGlzIGFmdGVyIHRoZSBpbnRpYWwgcmVuZGVyT3V0cHV0XG5cdFx0dGhpcy5pbml0aWFsVmlld1VwZGF0ZUV4cGFuZGVkKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdDZWxsLm9uTGF5b3V0SW5mb1JlYWQoKCkgPT4ge1xuXHRcdFx0dGhpcy5jZWxsUGFydHMucHJlcGFyZUxheW91dCgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGV4ZWN1dGlvbkl0ZW1FbGVtZW50ID0gRE9NLmFwcGVuZCh0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIsIERPTS4kKCcuY29sbGFwc2VkLWV4ZWN1dGlvbi1pY29uJykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRleGVjdXRpb25JdGVtRWxlbWVudC5yZW1vdmUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fY29sbGFwc2VkRXhlY3V0aW9uSWNvbiA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29sbGFwc2VkQ29kZUNlbGxFeGVjdXRpb25JY29uLCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLnZpZXdDZWxsLCBleGVjdXRpb25JdGVtRWxlbWVudCkpO1xuXHRcdHRoaXMudXBkYXRlRm9yQ29sbGFwc2VTdGF0ZSgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHZpZXdDZWxsLm9uRGlkQ2hhbmdlT3V0cHV0cywgdGhpcy51cGRhdGVGb3JPdXRwdXRzLmJpbmQodGhpcykpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodmlld0NlbGwub25EaWRDaGFuZ2VMYXlvdXQsIHRoaXMudXBkYXRlRm9yTGF5b3V0LmJpbmQodGhpcykpKTtcblxuXHRcdHRoaXMuX2NlbGxFZGl0b3JPcHRpb25zLnNldExpbmVOdW1iZXJzKHRoaXMudmlld0NlbGwubGluZU51bWJlcnMpO1xuXHRcdHRlbXBsYXRlRGF0YS5lZGl0b3IudXBkYXRlT3B0aW9ucyh0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucy5nZXRVcGRhdGVkVmFsdWUodGhpcy52aWV3Q2VsbC5pbnRlcm5hbE1ldGFkYXRhLCB0aGlzLnZpZXdDZWxsLnVyaSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb2RlQ2VsbE9wdGlvbnModGVtcGxhdGVEYXRhOiBDb2RlQ2VsbFJlbmRlclRlbXBsYXRlKSB7XG5cdFx0dGVtcGxhdGVEYXRhLmVkaXRvci51cGRhdGVPcHRpb25zKHRoaXMuX2NlbGxFZGl0b3JPcHRpb25zLmdldFVwZGF0ZWRWYWx1ZSh0aGlzLnZpZXdDZWxsLmludGVybmFsTWV0YWRhdGEsIHRoaXMudmlld0NlbGwudXJpKSk7XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih7IGRpc3Bvc2UoKSB7IGN0cy5kaXNwb3NlKHRydWUpOyB9IH0pO1xuXHRcdHJhY2VDYW5jZWxsYXRpb24odGhpcy52aWV3Q2VsbC5yZXNvbHZlVGV4dE1vZGVsKCksIGN0cy50b2tlbikudGhlbihtb2RlbCA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtb2RlbCkge1xuXHRcdFx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0XHRpbmRlbnRTaXplOiB0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucy5pbmRlbnRTaXplLFxuXHRcdFx0XHRcdHRhYlNpemU6IHRoaXMuX2NlbGxFZGl0b3JPcHRpb25zLnRhYlNpemUsXG5cdFx0XHRcdFx0aW5zZXJ0U3BhY2VzOiB0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucy5pbnNlcnRTcGFjZXMsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGVuZGluZ0xheW91dDogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSB1cGRhdGVGb3JMYXlvdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fcGVuZGluZ0xheW91dD8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3BlbmRpbmdMYXlvdXQgPSBET00ubW9kaWZ5KERPTS5nZXRXaW5kb3codGhpcy5ub3RlYm9va0VkaXRvci5nZXREb21Ob2RlKCkpLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmNlbGxQYXJ0cy51cGRhdGVJbnRlcm5hbExheW91dE5vdyh0aGlzLnZpZXdDZWxsKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRm9yT3V0cHV0SG92ZXIoKSB7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2NlbGwtb3V0cHV0LWhvdmVyJywgdGhpcy52aWV3Q2VsbC5vdXRwdXRJc0hvdmVyZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGb3JPdXRwdXRGb2N1cygpIHtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY2VsbC1vdXRwdXQtZm9jdXMnLCB0aGlzLnZpZXdDZWxsLm91dHB1dElzRm9jdXNlZCk7XG5cdH1cblxuXHRwcml2YXRlIGNhbGN1bGF0ZUluaXRFZGl0b3JIZWlnaHQoKSB7XG5cdFx0Y29uc3QgbGluZU51bSA9IHRoaXMudmlld0NlbGwubGluZUNvdW50O1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLnZpZXdDZWxsLmxheW91dEluZm8uZm9udEluZm8/LmxpbmVIZWlnaHQgfHwgMTc7XG5cdFx0Y29uc3QgZWRpdG9yUGFkZGluZyA9IHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVFZGl0b3JQYWRkaW5nKHRoaXMudmlld0NlbGwuaW50ZXJuYWxNZXRhZGF0YSwgdGhpcy52aWV3Q2VsbC51cmkpO1xuXHRcdGNvbnN0IGVkaXRvckhlaWdodCA9IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQgPT09IDBcblx0XHRcdD8gbGluZU51bSAqIGxpbmVIZWlnaHQgKyBlZGl0b3JQYWRkaW5nLnRvcCArIGVkaXRvclBhZGRpbmcuYm90dG9tXG5cdFx0XHQ6IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHQ7XG5cdFx0cmV0dXJuIGVkaXRvckhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZUVkaXRvcihpbml0RWRpdG9ySGVpZ2h0OiBudW1iZXIpIHtcblx0XHRjb25zdCB3aWR0aCA9IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JXaWR0aDtcblx0XHR0aGlzLmxheW91dEVkaXRvcihcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IGluaXRFZGl0b3JIZWlnaHRcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeyBkaXNwb3NlKCkgeyBjdHMuZGlzcG9zZSh0cnVlKTsgfSB9KTtcblx0XHRyYWNlQ2FuY2VsbGF0aW9uKHRoaXMudmlld0NlbGwucmVzb2x2ZVRleHRNb2RlbCgpLCBjdHMudG9rZW4pLnRoZW4obW9kZWwgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQgfHwgbW9kZWw/LmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtb2RlbCAmJiB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5fcmVpZ3N0ZXJNb2RlbExpc3RlbmVycyhtb2RlbCk7XG5cblx0XHRcdFx0Ly8gc2V0IG1vZGVsIGNhbiB0cmlnZ2VyIHZpZXcgdXBkYXRlLCB3aGljaCBjYW4gbGVhZCB0byBkaXNwb3NlIG9mIHRoaXMgY2VsbFxuXHRcdFx0XHR0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3Iuc2V0TW9kZWwobW9kZWwpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0aW5kZW50U2l6ZTogdGhpcy5fY2VsbEVkaXRvck9wdGlvbnMuaW5kZW50U2l6ZSxcblx0XHRcdFx0XHR0YWJTaXplOiB0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucy50YWJTaXplLFxuXHRcdFx0XHRcdGluc2VydFNwYWNlczogdGhpcy5fY2VsbEVkaXRvck9wdGlvbnMuaW5zZXJ0U3BhY2VzLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy52aWV3Q2VsbC5hdHRhY2hUZXh0RWRpdG9yKHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvciwgdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLmVzdGltYXRlZEhhc0hvcml6b250YWxTY3JvbGxpbmcpO1xuXHRcdFx0XHRjb25zdCBmb2N1c0VkaXRvcklmTmVlZGVkID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0QWN0aXZlQ2VsbCgpID09PSB0aGlzLnZpZXdDZWxsICYmXG5cdFx0XHRcdFx0XHR0aGlzLnZpZXdDZWxsLmZvY3VzTW9kZSA9PT0gQ2VsbEZvY3VzTW9kZS5FZGl0b3IgJiZcblx0XHRcdFx0XHRcdCh0aGlzLm5vdGVib29rRWRpdG9yLmhhc0VkaXRvckZvY3VzKCkgfHwgdGhpcy5ub3RlYm9va0VkaXRvci5nZXREb21Ob2RlKCkub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSB0aGlzLm5vdGVib29rRWRpdG9yLmdldERvbU5vZGUoKS5vd25lckRvY3VtZW50LmJvZHkpKSAvLyBEb24ndCBzdGVhbCBmb2N1cyBmcm9tIG90aGVyIHdvcmtiZW5jaCBwYXJ0cywgYnV0IGlmIGJvZHkgaGFzIGZvY3VzLCB3ZSBjYW4gdGFrZSBpdFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcj8uZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGZvY3VzRWRpdG9ySWZOZWVkZWQoKTtcblxuXHRcdFx0XHRjb25zdCByZWFsQ29udGVudEhlaWdodCA9IHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcj8uZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdFx0XHRpZiAocmVhbENvbnRlbnRIZWlnaHQgIT09IHVuZGVmaW5lZCAmJiByZWFsQ29udGVudEhlaWdodCAhPT0gaW5pdEVkaXRvckhlaWdodCkge1xuXHRcdFx0XHRcdHRoaXMub25DZWxsRWRpdG9ySGVpZ2h0Q2hhbmdlKHJlYWxDb250ZW50SGVpZ2h0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9jdXNFZGl0b3JJZk5lZWRlZCgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jZWxsRWRpdG9yT3B0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZUNvZGVDZWxsT3B0aW9ucyh0aGlzLnRlbXBsYXRlRGF0YSkpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRm9yT3V0cHV0cygpOiB2b2lkIHtcblx0XHRET00uc2V0VmlzaWJpbGl0eSh0aGlzLnZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzLmxlbmd0aCA+IDAsIHRoaXMudGVtcGxhdGVEYXRhLmZvY3VzU2lua0VsZW1lbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFZGl0b3JPcHRpb25zKCkge1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcjtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzUmVhZG9ubHkgPSB0aGlzLm5vdGVib29rRWRpdG9yLmlzUmVhZE9ubHk7XG5cdFx0Y29uc3QgcGFkZGluZyA9IHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVFZGl0b3JQYWRkaW5nKHRoaXMudmlld0NlbGwuaW50ZXJuYWxNZXRhZGF0YSwgdGhpcy52aWV3Q2VsbC51cmkpO1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBlZGl0b3IuZ2V0T3B0aW9ucygpO1xuXHRcdGlmIChvcHRpb25zLmdldChFZGl0b3JPcHRpb24ucmVhZE9ubHkpICE9PSBpc1JlYWRvbmx5IHx8IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5wYWRkaW5nKSAhPT0gcGFkZGluZykge1xuXHRcdFx0ZWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyByZWFkT25seTogdGhpcy5ub3RlYm9va0VkaXRvci5pc1JlYWRPbmx5LCBwYWRkaW5nOiB0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5jb21wdXRlRWRpdG9yUGFkZGluZyh0aGlzLnZpZXdDZWxsLmludGVybmFsTWV0YWRhdGEsIHRoaXMudmlld0NlbGwudXJpKSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTm90ZWJvb2tFZGl0b3JMaXN0ZW5lcnMoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZFNjcm9sbCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFkanVzdEVkaXRvclBvc2l0aW9uKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZUxheW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFkanVzdEVkaXRvclBvc2l0aW9uKCk7XG5cdFx0XHR0aGlzLm9uQ2VsbFdpZHRoQ2hhbmdlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGp1c3RFZGl0b3JQb3NpdGlvbigpIHtcblx0XHRjb25zdCBleHRyYU9mZnNldCA9IC0gNiAvKiogZGlzdGFuY2UgdG8gdGhlIHRvcCBvZiB0aGUgY2VsbCBlZGl0b3IsIHdoaWNoIGlzIDZweCB1bmRlciB0aGUgZm9jdXMgaW5kaWNhdG9yICovIC0gMSAvKiogYm9yZGVyICovO1xuXHRcdGNvbnN0IG1pbiA9IDA7XG5cblx0XHRjb25zdCBzY3JvbGxUb3AgPSB0aGlzLm5vdGVib29rRWRpdG9yLnNjcm9sbFRvcDtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRBYnNvbHV0ZVRvcE9mRWxlbWVudCh0aGlzLnZpZXdDZWxsKTtcblx0XHRjb25zdCBkaWZmID0gc2Nyb2xsVG9wIC0gZWxlbWVudFRvcCArIGV4dHJhT2Zmc2V0O1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3JMYXlvdXQgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKTtcblxuXHRcdC8vIHdlIHNob3VsZCBzdG9wIGFkanVzdGluZyB0aGUgdG9wIHdoZW4gdXNlcnMgYXJlIHZpZXdpbmcgdGhlIGJvdHRvbSBvZiB0aGUgY2VsbCBlZGl0b3Jcblx0XHRjb25zdCBlZGl0b3JNYXhIZWlnaHQgPSBub3RlYm9va0VkaXRvckxheW91dC5oZWlnaHRcblx0XHRcdC0gbm90ZWJvb2tFZGl0b3JMYXlvdXQuc3RpY2t5SGVpZ2h0XG5cdFx0XHQtIDI2IC8qKiBub3RlYm9vayB0b29sYmFyICovO1xuXG5cdFx0Y29uc3QgbWF4VG9wID1cblx0XHRcdHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JIZWlnaHRcblx0XHRcdC8vICsgdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLnN0YXR1c0JhckhlaWdodFxuXHRcdFx0LSBlZGl0b3JNYXhIZWlnaHRcblx0XHRcdDtcblx0XHRjb25zdCB0b3AgPSBtYXhUb3AgPiAyMCA/XG5cdFx0XHRjbGFtcChtaW4sIGRpZmYsIG1heFRvcCkgOlxuXHRcdFx0bWluO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvclBhcnQuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcblx0XHQvLyBzY3JvbGwgdGhlIGVkaXRvciB3aXRoIHRvcFxuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcj8uc2V0U2Nyb2xsVG9wKHRvcCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld0NlbGxMYXlvdXRDaGFuZ2UoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3Q2VsbC5vbkRpZENoYW5nZUxheW91dCgoZSkgPT4ge1xuXHRcdFx0aWYgKGUub3V0ZXJXaWR0aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdFx0XHRpZiAobGF5b3V0SW5mby53aWR0aCAhPT0gdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLmVkaXRvcldpZHRoKSB7XG5cdFx0XHRcdFx0dGhpcy5vbkNlbGxXaWR0aENoYW5nZSgpO1xuXHRcdFx0XHRcdHRoaXMuYWRqdXN0RWRpdG9yUG9zaXRpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDZWxsRWRpdG9yRXZlbnRMaXN0ZW5lcnMoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yLm9uRGlkQ29udGVudFNpemVDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmNvbnRlbnRIZWlnaHRDaGFuZ2VkKSB7XG5cdFx0XHRcdGlmICh0aGlzLnZpZXdDZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0ICE9PSBlLmNvbnRlbnRIZWlnaHQpIHtcblx0XHRcdFx0XHR0aGlzLm9uQ2VsbEVkaXRvckhlaWdodENoYW5nZShlLmNvbnRlbnRIZWlnaHQpO1xuXHRcdFx0XHRcdHRoaXMuYWRqdXN0RWRpdG9yUG9zaXRpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuc291cmNlID09PSAncmVzdG9yZVN0YXRlJyB8fCBlLm9sZE1vZGVsVmVyc2lvbklkID09PSAwKSB7XG5cdFx0XHRcdC8vIGRvIG5vdCByZXZlYWwgdGhlIGNlbGwgaW50byB2aWV3IGlmIHRoaXMgc2VsZWN0aW9uIGNoYW5nZSB3YXMgY2F1c2VkIGJ5IHJlc3RvcmluZyBlZGl0b3JzLi4uXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0XHRcdGlmIChzZWxlY3Rpb25zPy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudEhlaWdodCA9IHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRcdGNvbnN0IGxheW91dENvbnRlbnRIZWlnaHQgPSB0aGlzLnZpZXdDZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0O1xuXG5cdFx0XHRcdGlmIChjb250ZW50SGVpZ2h0ICE9PSBsYXlvdXRDb250ZW50SGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5vbkNlbGxFZGl0b3JIZWlnaHRDaGFuZ2UoY29udGVudEhlaWdodCk7XG5cblx0XHRcdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBsYXN0U2VsZWN0aW9uID0gc2VsZWN0aW9uc1tzZWxlY3Rpb25zLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnJldmVhbFJhbmdlSW5WaWV3QXN5bmModGhpcy52aWV3Q2VsbCwgbGFzdFNlbGVjdGlvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yLm9uRGlkQmx1ckVkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHRDb2RlQWN0aW9uQ29udHJvbGxlci5nZXQodGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yKT8uaGlkZUNvZGVBY3Rpb25zKCk7XG5cdFx0XHRDb2RlQWN0aW9uQ29udHJvbGxlci5nZXQodGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yKT8uaGlkZUxpZ2h0QnVsYldpZGdldCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlaWdzdGVyTW9kZWxMaXN0ZW5lcnMobW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbC5vbkRpZENoYW5nZVRva2VucygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy52aWV3Q2VsbC5pc0lucHV0Q29sbGFwc2VkICYmIHRoaXMuX2lucHV0Q29sbGFwc2VFbGVtZW50KSB7XG5cdFx0XHRcdC8vIGZsdXNoIHRoZSBjb2xsYXBzZWQgaW5wdXQgd2l0aCB0aGUgbGF0ZXN0IHRva2Vuc1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gdGhpcy5fZ2V0UmljaFRleHRGcm9tTGluZVRva2Vucyhtb2RlbCk7XG5cdFx0XHRcdERPTS5zYWZlSW5uZXJIdG1sKHRoaXMuX2lucHV0Q29sbGFwc2VFbGVtZW50LCBjb250ZW50KTtcblx0XHRcdFx0dGhpcy5fYXR0YWNoSW5wdXRFeHBhbmRCdXR0b24odGhpcy5faW5wdXRDb2xsYXBzZUVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJNb3VzZUxpc3RlbmVyKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvci5vbk1vdXNlRG93bihlID0+IHtcblx0XHRcdC8vIHByZXZlbnQgZGVmYXVsdCBvbiByaWdodCBtb3VzZSBjbGljaywgb3RoZXJ3aXNlIGl0IHdpbGwgdHJpZ2dlciB1bmV4cGVjdGVkIGZvY3VzIGNoYW5nZXNcblx0XHRcdC8vIHRoZSBjYXRjaCBpcywgaXQgbWVhbnMgd2UgZG9uJ3QgYWxsb3cgY3VzdG9taXphdGlvbiBvZiByaWdodCBidXR0b24gbW91c2UgZG93biBoYW5kbGVycyBvdGhlciB0aGFuIHRoZSBidWlsdCBpbiBvbmVzLlxuXHRcdFx0aWYgKGUuZXZlbnQucmlnaHRCdXR0b24pIHtcblx0XHRcdFx0ZS5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkUHJlc2VydmVFZGl0b3IoKSB7XG5cdFx0Ly8gVGhlIERPTSBmb2N1cyBuZWVkcyB0byBiZSBhZGp1c3RlZDpcblx0XHQvLyB3aGVuIGEgY2VsbCBlZGl0b3Igc2hvdWxkIGJlIGZvY3VzZWRcblx0XHQvLyB0aGUgZG9jdW1lbnQgYWN0aXZlIGVsZW1lbnQgaXMgaW5zaWRlIHRoZSBub3RlYm9vayBlZGl0b3Igb3IgdGhlIGRvY3VtZW50IGJvZHkgKGNlbGwgZWRpdG9yIGJlaW5nIGRpc3Bvc2VkIHByZXZpb3VzbHkpXG5cdFx0cmV0dXJuIHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0QWN0aXZlQ2VsbCgpID09PSB0aGlzLnZpZXdDZWxsXG5cdFx0XHQmJiB0aGlzLnZpZXdDZWxsLmZvY3VzTW9kZSA9PT0gQ2VsbEZvY3VzTW9kZS5FZGl0b3Jcblx0XHRcdCYmICh0aGlzLm5vdGVib29rRWRpdG9yLmhhc0VkaXRvckZvY3VzKCkgfHwgdGhpcy5ub3RlYm9va0VkaXRvci5nZXREb21Ob2RlKCkub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSB0aGlzLm5vdGVib29rRWRpdG9yLmdldERvbU5vZGUoKS5vd25lckRvY3VtZW50LmJvZHkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFZGl0b3JGb3JGb2N1c01vZGVDaGFuZ2Uoc3luYzogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLnNob3VsZFByZXNlcnZlRWRpdG9yKCkpIHtcblx0XHRcdGlmIChzeW5jKSB7XG5cdFx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcj8uZm9jdXMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5ydW5BdFRoaXNPclNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyh0aGlzLnRlbXBsYXRlRGF0YS5jb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yPy5mb2N1cygpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2NlbGwtZWRpdG9yLWZvY3VzJywgdGhpcy52aWV3Q2VsbC5mb2N1c01vZGUgPT09IENlbGxGb2N1c01vZGUuRWRpdG9yKTtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY2VsbC1vdXRwdXQtZm9jdXMnLCB0aGlzLnZpZXdDZWxsLmZvY3VzTW9kZSA9PT0gQ2VsbEZvY3VzTW9kZS5PdXRwdXQpO1xuXHR9XG5cdHByaXZhdGUgdXBkYXRlRm9yQ29sbGFwc2VTdGF0ZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy52aWV3Q2VsbC5pc091dHB1dENvbGxhcHNlZCA9PT0gdGhpcy5fcmVuZGVyZWRPdXRwdXRDb2xsYXBzZVN0YXRlICYmXG5cdFx0XHR0aGlzLnZpZXdDZWxsLmlzSW5wdXRDb2xsYXBzZWQgPT09IHRoaXMuX3JlbmRlcmVkSW5wdXRDb2xsYXBzZVN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q2VsbC5sYXlvdXRDaGFuZ2UoeyBlZGl0b3JIZWlnaHQ6IHRydWUgfSk7XG5cblx0XHRpZiAodGhpcy52aWV3Q2VsbC5pc0lucHV0Q29sbGFwc2VkKSB7XG5cdFx0XHR0aGlzLl9jb2xsYXBzZUlucHV0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Nob3dJbnB1dCgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnZpZXdDZWxsLmlzT3V0cHV0Q29sbGFwc2VkKSB7XG5cdFx0XHR0aGlzLl9jb2xsYXBzZU91dHB1dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zaG93T3V0cHV0KGZhbHNlKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbGF5b3V0Q2VsbCgpO1xuXG5cdFx0dGhpcy5fcmVuZGVyZWRPdXRwdXRDb2xsYXBzZVN0YXRlID0gdGhpcy52aWV3Q2VsbC5pc091dHB1dENvbGxhcHNlZDtcblx0XHR0aGlzLl9yZW5kZXJlZElucHV0Q29sbGFwc2VTdGF0ZSA9IHRoaXMudmlld0NlbGwuaXNJbnB1dENvbGxhcHNlZDtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29sbGFwc2VJbnB1dCgpIHtcblx0XHQvLyBoaWRlIHRoZSBlZGl0b3IgYW5kIGV4ZWN1dGlvbiBsYWJlbCwga2VlcCB0aGUgcnVuIGJ1dHRvblxuXHRcdERPTS5oaWRlKHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvclBhcnQpO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdpbnB1dC1jb2xsYXBzZWQnLCB0cnVlKTtcblxuXHRcdC8vIHJlbW92ZSBpbnB1dCBwcmV2aWV3XG5cdFx0dGhpcy5fcmVtb3ZlSW5wdXRDb2xsYXBzZVByZXZpZXcoKTtcblxuXHRcdHRoaXMuX2NvbGxhcHNlZEV4ZWN1dGlvbkljb24uc2V0VmlzaWJpbGl0eSh0cnVlKTtcblxuXHRcdC8vIHVwZGF0ZSBwcmV2aWV3XG5cdFx0Y29uc3QgcmljaEVkaXRvclRleHQgPSB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3IuaGFzTW9kZWwoKSA/IHRoaXMuX2dldFJpY2hUZXh0RnJvbUxpbmVUb2tlbnModGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yLmdldE1vZGVsKCkpIDogdGhpcy5fZ2V0UmljaFRleHQodGhpcy52aWV3Q2VsbC50ZXh0QnVmZmVyLCB0aGlzLnZpZXdDZWxsLmxhbmd1YWdlKTtcblx0XHRjb25zdCBlbGVtZW50ID0gRE9NLiQoJ2Rpdi5jZWxsLWNvbGxhcHNlLXByZXZpZXcnKTtcblx0XHRET00uc2FmZUlubmVySHRtbChlbGVtZW50LCByaWNoRWRpdG9yVGV4dCk7XG5cdFx0dGhpcy5faW5wdXRDb2xsYXBzZUVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50KTtcblx0XHR0aGlzLl9hdHRhY2hJbnB1dEV4cGFuZEJ1dHRvbihlbGVtZW50KTtcblxuXHRcdERPTS5zaG93KHRoaXMudGVtcGxhdGVEYXRhLmNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIF9hdHRhY2hJbnB1dEV4cGFuZEJ1dHRvbihlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGV4cGFuZEljb24gPSBET00uJCgnc3Bhbi5leHBhbmRJbnB1dEljb24nKTtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEVYUEFORF9DRUxMX0lOUFVUX0NPTU1BTkRfSUQpO1xuXHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRlbGVtZW50LnRpdGxlID0gbG9jYWxpemUoJ2NlbGxFeHBhbmRJbnB1dEJ1dHRvbkxhYmVsV2l0aERvdWJsZUNsaWNrJywgXCJEb3VibGUtY2xpY2sgdG8gZXhwYW5kIGNlbGwgaW5wdXQgKHswfSlcIiwga2V5YmluZGluZy5nZXRMYWJlbCgpKTtcblx0XHRcdGV4cGFuZEljb24udGl0bGUgPSBsb2NhbGl6ZSgnY2VsbEV4cGFuZElucHV0QnV0dG9uTGFiZWwnLCBcIkV4cGFuZCBDZWxsIElucHV0ICh7MH0pXCIsIGtleWJpbmRpbmcuZ2V0TGFiZWwoKSk7XG5cdFx0fVxuXG5cdFx0ZXhwYW5kSWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ubW9yZSkpO1xuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoZXhwYW5kSWNvbik7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93SW5wdXQoKSB7XG5cdFx0dGhpcy5fY29sbGFwc2VkRXhlY3V0aW9uSWNvbi5zZXRWaXNpYmlsaXR5KGZhbHNlKTtcblx0XHRET00uc2hvdyh0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3JQYXJ0KTtcblx0XHRET00uaGlkZSh0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UmljaFRleHQoYnVmZmVyOiBJUmVhZG9ubHlUZXh0QnVmZmVyLCBsYW5ndWFnZTogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRva2VuaXplVG9TdHJpbmdTeW5jKHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCBidWZmZXIuZ2V0TGluZUNvbnRlbnQoMSksIGxhbmd1YWdlKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFJpY2hUZXh0RnJvbUxpbmVUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHRsZXQgcmVzdWx0ID0gYDxkaXYgY2xhc3M9XCJtb25hY28tdG9rZW5pemVkLXNvdXJjZVwiPmA7XG5cblx0XHRjb25zdCBmaXJzdExpbmVUb2tlbnMgPSBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucygxKTtcblx0XHRjb25zdCB2aWV3TGluZVRva2VucyA9IGZpcnN0TGluZVRva2Vucy5pbmZsYXRlKCk7XG5cdFx0Y29uc3QgbGluZSA9IG1vZGVsLmdldExpbmVDb250ZW50KDEpO1xuXHRcdGxldCBzdGFydE9mZnNldCA9IDA7XG5cdFx0Zm9yIChsZXQgaiA9IDAsIGxlbkogPSB2aWV3TGluZVRva2Vucy5nZXRDb3VudCgpOyBqIDwgbGVuSjsgaisrKSB7XG5cdFx0XHRjb25zdCB0eXBlID0gdmlld0xpbmVUb2tlbnMuZ2V0Q2xhc3NOYW1lKGopO1xuXHRcdFx0Y29uc3QgZW5kSW5kZXggPSB2aWV3TGluZVRva2Vucy5nZXRFbmRPZmZzZXQoaik7XG5cdFx0XHRyZXN1bHQgKz0gYDxzcGFuIGNsYXNzPVwiJHt0eXBlfVwiPiR7c3RyaW5ncy5lc2NhcGUobGluZS5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIGVuZEluZGV4KSl9PC9zcGFuPmA7XG5cdFx0XHRzdGFydE9mZnNldCA9IGVuZEluZGV4O1xuXHRcdH1cblxuXHRcdHJlc3VsdCArPSBgPC9kaXY+YDtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlSW5wdXRDb2xsYXBzZVByZXZpZXcoKSB7XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSB0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIuY2hpbGRyZW47XG5cdFx0Y29uc3QgZWxlbWVudHMgPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoY2hpbGRyZW5baV0uY2xhc3NMaXN0LmNvbnRhaW5zKCdjZWxsLWNvbGxhcHNlLXByZXZpZXcnKSkge1xuXHRcdFx0XHRlbGVtZW50cy5wdXNoKGNoaWxkcmVuW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0ZWxlbWVudC5yZW1vdmUoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZU91dHB1dElubmVyQ29udGFpbmVyKGhpZGU6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBjaGlsZHJlbiA9IHRoaXMudGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lci5kb21Ob2RlLmNoaWxkcmVuO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChjaGlsZHJlbltpXS5jbGFzc0xpc3QuY29udGFpbnMoJ291dHB1dC1pbm5lci1jb250YWluZXInKSkge1xuXHRcdFx0XHRET00uc2V0VmlzaWJpbGl0eSghaGlkZSwgY2hpbGRyZW5baV0gYXMgSFRNTEVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbGxhcHNlT3V0cHV0KCkge1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdvdXRwdXQtY29sbGFwc2VkJywgdHJ1ZSk7XG5cdFx0RE9NLnNob3codGhpcy50ZW1wbGF0ZURhdGEuY2VsbE91dHB1dENvbGxhcHNlZENvbnRhaW5lcik7XG5cdFx0dGhpcy5fdXBkYXRlT3V0cHV0SW5uZXJDb250YWluZXIodHJ1ZSk7XG5cdFx0dGhpcy5fb3V0cHV0Q29udGFpbmVyUmVuZGVyZXIudmlld1VwZGF0ZUhpZGVPdXB1dHMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dPdXRwdXQoaW5pdFJlbmRlcmluZzogYm9vbGVhbikge1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdvdXRwdXQtY29sbGFwc2VkJywgZmFsc2UpO1xuXHRcdERPTS5oaWRlKHRoaXMudGVtcGxhdGVEYXRhLmNlbGxPdXRwdXRDb2xsYXBzZWRDb250YWluZXIpO1xuXHRcdHRoaXMuX3VwZGF0ZU91dHB1dElubmVyQ29udGFpbmVyKGZhbHNlKTtcblx0XHR0aGlzLl9vdXRwdXRDb250YWluZXJSZW5kZXJlci52aWV3VXBkYXRlU2hvd091dHB1dHMoaW5pdFJlbmRlcmluZyk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRpYWxWaWV3VXBkYXRlRXhwYW5kZWQoKTogdm9pZCB7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2lucHV0LWNvbGxhcHNlZCcsIGZhbHNlKTtcblx0XHRET00uc2hvdyh0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3JQYXJ0KTtcblx0XHRET00uaGlkZSh0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdvdXRwdXQtY29sbGFwc2VkJywgZmFsc2UpO1xuXHRcdHRoaXMuX3Nob3dPdXRwdXQodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGxheW91dEVkaXRvcihkaW1lbnNpb246IElEaW1lbnNpb24pOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JMYXlvdXQgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKTtcblx0XHRjb25zdCBtYXhIZWlnaHQgPSBNYXRoLm1pbihcblx0XHRcdGVkaXRvckxheW91dC5oZWlnaHRcblx0XHRcdC0gZWRpdG9yTGF5b3V0LnN0aWNreUhlaWdodFxuXHRcdFx0LSAyNiAvKiogbm90ZWJvb2sgdG9vbGJhciAqLyxcblx0XHRcdGRpbWVuc2lvbi5oZWlnaHRcblx0XHQpO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmVkaXRvcj8ubGF5b3V0KHtcblx0XHRcdHdpZHRoOiBkaW1lbnNpb24ud2lkdGgsXG5cdFx0XHRoZWlnaHQ6IG1heEhlaWdodFxuXHRcdH0sIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNlbGxXaWR0aENoYW5nZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudGVtcGxhdGVEYXRhLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVhbENvbnRlbnRIZWlnaHQgPSB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdHRoaXMudmlld0NlbGwuZWRpdG9ySGVpZ2h0ID0gcmVhbENvbnRlbnRIZWlnaHQ7XG5cdFx0dGhpcy5yZWxheW91dENlbGwoKTtcblx0XHR0aGlzLmxheW91dEVkaXRvcihcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JXaWR0aCxcblx0XHRcdFx0aGVpZ2h0OiByZWFsQ29udGVudEhlaWdodFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIG9uQ2VsbEVkaXRvckhlaWdodENoYW5nZShuZXdIZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdMYXlvdXQgPSB0aGlzLnRlbXBsYXRlRGF0YS5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdHRoaXMudmlld0NlbGwuZWRpdG9ySGVpZ2h0ID0gbmV3SGVpZ2h0O1xuXHRcdHRoaXMucmVsYXlvdXRDZWxsKCk7XG5cdFx0dGhpcy5sYXlvdXRFZGl0b3IoXG5cdFx0XHR7XG5cdFx0XHRcdHdpZHRoOiB2aWV3TGF5b3V0LndpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IG5ld0hlaWdodFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRyZWxheW91dENlbGwoKSB7XG5cdFx0dGhpcy5ub3RlYm9va0VkaXRvci5sYXlvdXROb3RlYm9va0NlbGwodGhpcy52aWV3Q2VsbCwgdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cblx0XHQvLyBtb3ZlIGZvY3VzIGJhY2sgdG8gdGhlIGNlbGwgbGlzdCBvdGhlcndpc2UgdGhlIGZvY3VzIGdvZXMgdG8gYm9keVxuXHRcdGlmICh0aGlzLnNob3VsZFByZXNlcnZlRWRpdG9yKCkpIHtcblx0XHRcdC8vIG5vdyB0aGUgZm9jdXMgaXMgb24gdGhlIG1vbmFjbyBlZGl0b3IgZm9yIHRoZSBjZWxsIGJ1dCBkZXRhY2hlZCBmcm9tIHRoZSByb3dzLlxuXHRcdFx0dGhpcy5lZGl0b3JQb29sLnByZXNlcnZlRm9jdXNlZEVkaXRvcih0aGlzLnZpZXdDZWxsKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdDZWxsLmRldGFjaFRleHRFZGl0b3IoKTtcblx0XHR0aGlzLl9yZW1vdmVJbnB1dENvbGxhcHNlUHJldmlldygpO1xuXHRcdHRoaXMuX291dHB1dENvbnRhaW5lclJlbmRlcmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9wZW5kaW5nTGF5b3V0Py5kaXNwb3NlKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxhQUFhO0FBQ3RCLFlBQVksYUFBYTtBQUN6QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGVBQWUsb0NBQW1FO0FBQzNG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
