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
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { disposableTimeout, raceCancellation } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { tokenizeToStringSync } from "../../../../../../editor/common/languages/textToHtmlTokenizer.js";
import { localize } from "../../../../../../nls.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { CellEditState, CellFocusMode, CellFoldingState, EXPAND_CELL_INPUT_COMMAND_ID } from "../../notebookBrowser.js";
import { collapsedIcon, expandedIcon } from "../../notebookIcons.js";
import { CellEditorOptions } from "./cellEditorOptions.js";
import { WordHighlighterContribution } from "../../../../../../editor/contrib/wordHighlighter/browser/wordHighlighter.js";
let MarkupCell = class extends Disposable {
  constructor(notebookEditor, viewCell, templateData, renderedEditors, accessibilityService, contextKeyService, instantiationService, languageService, configurationService, keybindingService) {
    super();
    this.notebookEditor = notebookEditor;
    this.viewCell = viewCell;
    this.templateData = templateData;
    this.renderedEditors = renderedEditors;
    this.accessibilityService = accessibilityService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.languageService = languageService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.editor = null;
    this.localDisposables = this._register(new DisposableStore());
    this.focusSwitchDisposable = this._register(new MutableDisposable());
    this.editorDisposables = this._register(new DisposableStore());
    this._isDisposed = false;
    this.constructDOM();
    this.editorPart = templateData.editorPart;
    this.cellEditorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(viewCell.language), this.notebookEditor.notebookOptions, this.configurationService));
    this.cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
    this.editorOptions = this.cellEditorOptions.getValue(this.viewCell.internalMetadata, this.viewCell.uri);
    this._register(toDisposable(() => renderedEditors.delete(this.viewCell)));
    this.registerListeners();
    this.templateData.cellParts.scheduleRenderCell(this.viewCell);
    this._register(toDisposable(() => {
      this.templateData.cellParts.unrenderCell(this.viewCell);
    }));
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => {
      this.viewUpdate();
    }));
    this.updateForHover();
    this.updateForFocusModeChange();
    this.foldingState = viewCell.foldingState;
    this.layoutFoldingIndicator();
    this.updateFoldingIconShowClass();
    if (this.viewCell.layoutInfo.totalHeight > 0) {
      this.relayoutCell();
    }
    this.viewUpdate();
    this.layoutCellParts();
    this._register(this.viewCell.onDidChangeLayout(() => {
      this.layoutCellParts();
    }));
  }
  layoutCellParts() {
    this.templateData.cellParts.updateInternalLayoutNow(this.viewCell);
  }
  constructDOM() {
    const id = `aria-markup-cell-${this.viewCell.id}`;
    this.markdownAccessibilityContainer = this.templateData.cellContainer;
    this.markdownAccessibilityContainer.id = id;
    this.markdownAccessibilityContainer.style.height = "1px";
    this.markdownAccessibilityContainer.style.overflow = "hidden";
    this.markdownAccessibilityContainer.style.position = "absolute";
    this.markdownAccessibilityContainer.style.top = "100000px";
    this.markdownAccessibilityContainer.style.left = "10000px";
    this.markdownAccessibilityContainer.ariaHidden = "false";
    this.templateData.rootContainer.setAttribute("aria-describedby", id);
    this.templateData.container.classList.toggle("webview-backed-markdown-cell", true);
  }
  registerListeners() {
    this._register(this.viewCell.onDidChangeState((e) => {
      this.templateData.cellParts.updateState(this.viewCell, e);
    }));
    this._register(this.viewCell.model.onDidChangeMetadata(() => {
      this.viewUpdate();
    }));
    this._register(this.viewCell.onDidChangeState((e) => {
      if (e.editStateChanged || e.contentChanged) {
        this.viewUpdate();
      }
      if (e.focusModeChanged) {
        this.updateForFocusModeChange();
      }
      if (e.foldingStateChanged) {
        const foldingState = this.viewCell.foldingState;
        if (foldingState !== this.foldingState) {
          this.foldingState = foldingState;
          this.layoutFoldingIndicator();
        }
      }
      if (e.cellIsHoveredChanged) {
        this.updateForHover();
      }
      if (e.inputCollapsedChanged) {
        this.updateCollapsedState();
        this.viewUpdate();
      }
      if (e.cellLineNumberChanged) {
        this.cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
      }
    }));
    this._register(this.notebookEditor.notebookOptions.onDidChangeOptions((e) => {
      if (e.showFoldingControls) {
        this.updateFoldingIconShowClass();
      }
    }));
    this._register(this.viewCell.onDidChangeLayout((e) => {
      const layoutInfo = this.editor?.getLayoutInfo();
      if (e.outerWidth && this.viewCell.getEditState() === CellEditState.Editing && layoutInfo && layoutInfo.width !== this.viewCell.layoutInfo.editorWidth) {
        this.onCellEditorWidthChange();
      }
    }));
    this._register(this.cellEditorOptions.onDidChange(() => this.updateMarkupCellOptions()));
  }
  updateMarkupCellOptions() {
    this.updateEditorOptions(this.cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
    if (this.editor) {
      this.editor.updateOptions(this.cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
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
            indentSize: this.cellEditorOptions.indentSize,
            tabSize: this.cellEditorOptions.tabSize,
            insertSpaces: this.cellEditorOptions.insertSpaces
          });
        }
      });
    }
  }
  updateCollapsedState() {
    if (this.viewCell.isInputCollapsed) {
      this.notebookEditor.hideMarkupPreviews([this.viewCell]);
    } else {
      this.notebookEditor.unhideMarkupPreviews([this.viewCell]);
    }
  }
  updateForHover() {
    this.templateData.container.classList.toggle("markdown-cell-hover", this.viewCell.cellIsHovered);
  }
  updateForFocusModeChange() {
    if (this.viewCell.focusMode === CellFocusMode.Editor) {
      this.focusEditorIfNeeded();
    }
    this.templateData.container.classList.toggle("cell-editor-focus", this.viewCell.focusMode === CellFocusMode.Editor);
  }
  dispose() {
    this._isDisposed = true;
    if (this.notebookEditor.getActiveCell() === this.viewCell && this.viewCell.focusMode === CellFocusMode.Editor && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) {
      this.notebookEditor.focusContainer();
    }
    this.viewCell.detachTextEditor();
    super.dispose();
  }
  updateFoldingIconShowClass() {
    const showFoldingIcon = this.notebookEditor.notebookOptions.getDisplayOptions().showFoldingControls;
    this.templateData.foldingIndicator.classList.remove("mouseover", "always");
    this.templateData.foldingIndicator.classList.add(showFoldingIcon);
  }
  viewUpdate() {
    if (this.viewCell.isInputCollapsed) {
      this.viewUpdateCollapsed();
    } else if (this.viewCell.getEditState() === CellEditState.Editing) {
      this.viewUpdateEditing();
    } else {
      this.viewUpdatePreview();
    }
  }
  viewUpdateCollapsed() {
    DOM.show(this.templateData.cellInputCollapsedContainer);
    DOM.hide(this.editorPart);
    this.templateData.cellInputCollapsedContainer.innerText = "";
    const markdownIcon = DOM.append(this.templateData.cellInputCollapsedContainer, DOM.$("span"));
    markdownIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.markdown));
    const element = DOM.$("div");
    element.classList.add("cell-collapse-preview");
    const richEditorText = this.getRichText(this.viewCell.textBuffer, this.viewCell.language);
    DOM.safeInnerHtml(element, richEditorText);
    this.templateData.cellInputCollapsedContainer.appendChild(element);
    const expandIcon = DOM.append(element, DOM.$("span.expandInputIcon"));
    expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
    const keybinding = this.keybindingService.lookupKeybinding(EXPAND_CELL_INPUT_COMMAND_ID);
    if (keybinding) {
      element.title = localize("cellExpandInputButtonLabelWithDoubleClick", "Double-click to expand cell input ({0})", keybinding.getLabel());
      expandIcon.title = localize("cellExpandInputButtonLabel", "Expand Cell Input ({0})", keybinding.getLabel());
    }
    this.markdownAccessibilityContainer.ariaHidden = "true";
    this.templateData.container.classList.toggle("input-collapsed", true);
    this.viewCell.renderedMarkdownHeight = 0;
    this.viewCell.layoutChange({});
  }
  getRichText(buffer, language) {
    return tokenizeToStringSync(this.languageService, buffer.getLineContent(1), language);
  }
  viewUpdateEditing() {
    let editorHeight;
    DOM.show(this.editorPart);
    this.markdownAccessibilityContainer.ariaHidden = "true";
    DOM.hide(this.templateData.cellInputCollapsedContainer);
    this.notebookEditor.hideMarkupPreviews([this.viewCell]);
    this.templateData.container.classList.toggle("input-collapsed", false);
    this.templateData.container.classList.toggle("markdown-cell-edit-mode", true);
    if (this.editor && this.editor.hasModel()) {
      editorHeight = this.editor.getContentHeight();
      this.viewCell.attachTextEditor(this.editor);
      this.focusEditorIfNeeded();
      this.bindEditorListeners(this.editor);
      this.editor.layout({
        width: this.viewCell.layoutInfo.editorWidth,
        height: editorHeight
      });
    } else {
      this.editorDisposables.clear();
      const width = this.notebookEditor.notebookOptions.computeMarkdownCellEditorWidth(this.notebookEditor.getLayoutInfo().width);
      const lineNum = this.viewCell.lineCount;
      const lineHeight = this.viewCell.layoutInfo.fontInfo?.lineHeight || 17;
      const editorPadding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
      editorHeight = Math.max(lineNum, 1) * lineHeight + editorPadding.top + editorPadding.bottom;
      this.templateData.editorContainer.innerText = "";
      const editorContextKeyService = this.contextKeyService.createScoped(this.templateData.editorPart);
      EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);
      const editorInstaService = this.editorDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService])));
      this.editorDisposables.add(editorContextKeyService);
      this.editor = this.editorDisposables.add(editorInstaService.createInstance(CodeEditorWidget, this.templateData.editorContainer, {
        ...this.editorOptions,
        dimension: {
          width,
          height: editorHeight
        }
        // overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode()
      }, {
        contributions: this.notebookEditor.creationOptions.cellEditorContributions
      }));
      this.templateData.currentEditor = this.editor;
      this.editorDisposables.add(this.editor.onDidBlurEditorWidget(() => {
        if (this.editor) {
          WordHighlighterContribution.get(this.editor)?.stopHighlighting();
        }
      }));
      this.editorDisposables.add(this.editor.onDidFocusEditorWidget(() => {
        if (this.editor) {
          WordHighlighterContribution.get(this.editor)?.restoreViewState(true);
        }
      }));
      const cts = new CancellationTokenSource();
      this.editorDisposables.add({ dispose() {
        cts.dispose(true);
      } });
      raceCancellation(this.viewCell.resolveTextModel(), cts.token).then((model) => {
        if (!model) {
          return;
        }
        this.editor.setModel(model);
        model.updateOptions({
          indentSize: this.cellEditorOptions.indentSize,
          tabSize: this.cellEditorOptions.tabSize,
          insertSpaces: this.cellEditorOptions.insertSpaces
        });
        const realContentHeight = this.editor.getContentHeight();
        if (realContentHeight !== editorHeight) {
          this.editor.layout(
            {
              width,
              height: realContentHeight
            }
          );
          editorHeight = realContentHeight;
        }
        this.viewCell.attachTextEditor(this.editor);
        if (this.viewCell.getEditState() === CellEditState.Editing) {
          this.focusEditorIfNeeded();
        }
        this.bindEditorListeners(this.editor);
        this.viewCell.editorHeight = editorHeight;
      });
    }
    this.viewCell.editorHeight = editorHeight;
    this.focusEditorIfNeeded();
    this.renderedEditors.set(this.viewCell, this.editor);
  }
  viewUpdatePreview() {
    this.viewCell.detachTextEditor();
    DOM.hide(this.editorPart);
    DOM.hide(this.templateData.cellInputCollapsedContainer);
    this.markdownAccessibilityContainer.ariaHidden = "false";
    this.templateData.container.classList.toggle("input-collapsed", false);
    this.templateData.container.classList.toggle("markdown-cell-edit-mode", false);
    this.renderedEditors.delete(this.viewCell);
    this.markdownAccessibilityContainer.innerText = "";
    if (this.viewCell.renderedHtml) {
      if (this.accessibilityService.isScreenReaderOptimized()) {
        DOM.safeInnerHtml(this.markdownAccessibilityContainer, this.viewCell.renderedHtml);
      } else {
        DOM.clearNode(this.markdownAccessibilityContainer);
      }
    }
    this.notebookEditor.createMarkupPreview(this.viewCell);
  }
  focusEditorIfNeeded() {
    if (this.viewCell.focusMode === CellFocusMode.Editor && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) {
      if (!this.editor) {
        return;
      }
      this.editor.focus();
      const primarySelection = this.editor.getSelection();
      if (!primarySelection) {
        return;
      }
      this.notebookEditor.revealRangeInViewAsync(this.viewCell, primarySelection);
    }
  }
  layoutEditor(dimension) {
    this.editor?.layout(dimension);
  }
  onCellEditorWidthChange() {
    const realContentHeight = this.editor.getContentHeight();
    this.layoutEditor(
      {
        width: this.viewCell.layoutInfo.editorWidth,
        height: realContentHeight
      }
    );
  }
  relayoutCell() {
    this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
    this.layoutFoldingIndicator();
  }
  updateEditorOptions(newValue) {
    this.editorOptions = newValue;
    this.editor?.updateOptions(this.editorOptions);
  }
  layoutFoldingIndicator() {
    switch (this.foldingState) {
      case CellFoldingState.None:
        this.templateData.foldingIndicator.style.display = "none";
        this.templateData.foldingIndicator.innerText = "";
        break;
      case CellFoldingState.Collapsed:
        this.templateData.foldingIndicator.style.display = "";
        DOM.reset(this.templateData.foldingIndicator, renderIcon(collapsedIcon));
        break;
      case CellFoldingState.Expanded:
        this.templateData.foldingIndicator.style.display = "";
        DOM.reset(this.templateData.foldingIndicator, renderIcon(expandedIcon));
        break;
      default:
        break;
    }
  }
  bindEditorListeners(editor) {
    this.localDisposables.clear();
    this.focusSwitchDisposable.clear();
    this.localDisposables.add(editor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        this.onCellEditorHeightChange(editor, e.contentHeight);
      }
    }));
    this.localDisposables.add(editor.onDidChangeCursorSelection((e) => {
      if (e.source === "restoreState") {
        return;
      }
      const selections = editor.getSelections();
      if (selections?.length) {
        const contentHeight = editor.getContentHeight();
        const layoutContentHeight = this.viewCell.layoutInfo.editorHeight;
        if (contentHeight !== layoutContentHeight) {
          this.onCellEditorHeightChange(editor, contentHeight);
        }
        const lastSelection = selections[selections.length - 1];
        this.notebookEditor.revealRangeInViewAsync(this.viewCell, lastSelection);
      }
    }));
    const updateFocusMode = () => this.viewCell.focusMode = editor.hasWidgetFocus() ? CellFocusMode.Editor : CellFocusMode.Container;
    this.localDisposables.add(editor.onDidFocusEditorWidget(() => {
      updateFocusMode();
    }));
    this.localDisposables.add(editor.onDidBlurEditorWidget(() => {
      if (this.templateData.container.ownerDocument.activeElement?.contains(this.templateData.container)) {
        this.focusSwitchDisposable.value = disposableTimeout(() => updateFocusMode(), 300);
      } else {
        updateFocusMode();
      }
    }));
    updateFocusMode();
  }
  onCellEditorHeightChange(editor, newHeight) {
    const viewLayout = editor.getLayoutInfo();
    this.viewCell.editorHeight = newHeight;
    editor.layout(
      {
        width: viewLayout.width,
        height: newHeight
      }
    );
  }
};
MarkupCell = __decorateClass([
  __decorateParam(4, IAccessibilityService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IKeybindingService)
], MarkupCell);
export {
  MarkupCell
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL21hcmt1cENlbGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0LCByYWNlQ2FuY2VsbGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IHRva2VuaXplVG9TdHJpbmdTeW5jIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvdGV4dFRvSHRtbFRva2VuaXplci5qcyc7XG5pbXBvcnQgeyBJUmVhZG9ubHlUZXh0QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFN0YXRlLCBDZWxsRm9jdXNNb2RlLCBDZWxsRm9sZGluZ1N0YXRlLCBFWFBBTkRfQ0VMTF9JTlBVVF9DT01NQU5EX0lELCBJQWN0aXZlTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSwgSUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgY29sbGFwc2VkSWNvbiwgZXhwYW5kZWRJY29uIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tJY29ucy5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4vY2VsbEVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25DZWxsUmVuZGVyVGVtcGxhdGUgfSBmcm9tICcuLi9ub3RlYm9va1JlbmRlcmluZ0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBNYXJrdXBDZWxsVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vdmlld01vZGVsL21hcmt1cENlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgV29yZEhpZ2hsaWdodGVyQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvd29yZEhpZ2hsaWdodGVyL2Jyb3dzZXIvd29yZEhpZ2hsaWdodGVyLmpzJztcblxuZXhwb3J0IGNsYXNzIE1hcmt1cENlbGwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGVkaXRvcjogQ29kZUVkaXRvcldpZGdldCB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgbWFya2Rvd25BY2Nlc3NpYmlsaXR5Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgZWRpdG9yUGFydDogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2NhbERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBmb2N1c1N3aXRjaERpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIGZvbGRpbmdTdGF0ZTogQ2VsbEZvbGRpbmdTdGF0ZTtcblx0cHJpdmF0ZSBjZWxsRWRpdG9yT3B0aW9uczogQ2VsbEVkaXRvck9wdGlvbnM7XG5cdHByaXZhdGUgZWRpdG9yT3B0aW9uczogSUVkaXRvck9wdGlvbnM7XG5cdHByaXZhdGUgX2lzRGlzcG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJQWN0aXZlTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHZpZXdDZWxsOiBNYXJrdXBDZWxsVmlld01vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGVtcGxhdGVEYXRhOiBNYXJrZG93bkNlbGxSZW5kZXJUZW1wbGF0ZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVkRWRpdG9yczogTWFwPElDZWxsVmlld01vZGVsLCBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZD4sXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNvbnN0cnVjdERPTSgpO1xuXHRcdHRoaXMuZWRpdG9yUGFydCA9IHRlbXBsYXRlRGF0YS5lZGl0b3JQYXJ0O1xuXHRcdHRoaXMuY2VsbEVkaXRvck9wdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2VsbEVkaXRvck9wdGlvbnModGhpcy5ub3RlYm9va0VkaXRvci5nZXRCYXNlQ2VsbEVkaXRvck9wdGlvbnModmlld0NlbGwubGFuZ3VhZ2UpLCB0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucywgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdHRoaXMuY2VsbEVkaXRvck9wdGlvbnMuc2V0TGluZU51bWJlcnModGhpcy52aWV3Q2VsbC5saW5lTnVtYmVycyk7XG5cdFx0dGhpcy5lZGl0b3JPcHRpb25zID0gdGhpcy5jZWxsRWRpdG9yT3B0aW9ucy5nZXRWYWx1ZSh0aGlzLnZpZXdDZWxsLmludGVybmFsTWV0YWRhdGEsIHRoaXMudmlld0NlbGwudXJpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiByZW5kZXJlZEVkaXRvcnMuZGVsZXRlKHRoaXMudmlld0NlbGwpKSk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXG5cdFx0Ly8gdXBkYXRlIGZvciBpbml0IHN0YXRlXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY2VsbFBhcnRzLnNjaGVkdWxlUmVuZGVyQ2VsbCh0aGlzLnZpZXdDZWxsKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jZWxsUGFydHMudW5yZW5kZXJDZWxsKHRoaXMudmlld0NlbGwpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2Uub25EaWRDaGFuZ2VTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKCkgPT4ge1xuXHRcdFx0dGhpcy52aWV3VXBkYXRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51cGRhdGVGb3JIb3ZlcigpO1xuXHRcdHRoaXMudXBkYXRlRm9yRm9jdXNNb2RlQ2hhbmdlKCk7XG5cdFx0dGhpcy5mb2xkaW5nU3RhdGUgPSB2aWV3Q2VsbC5mb2xkaW5nU3RhdGU7XG5cdFx0dGhpcy5sYXlvdXRGb2xkaW5nSW5kaWNhdG9yKCk7XG5cdFx0dGhpcy51cGRhdGVGb2xkaW5nSWNvblNob3dDbGFzcygpO1xuXG5cdFx0Ly8gdGhlIG1hcmtkb3duIHByZXZpZXcncyBoZWlnaHQgbWlnaHQgYWxyZWFkeSBiZSB1cGRhdGVkIGFmdGVyIHRoZSByZW5kZXJlciBjYWxscyBgZWxlbWVudC5nZXRIZWlnaHQoKWBcblx0XHRpZiAodGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0ID4gMCkge1xuXHRcdFx0dGhpcy5yZWxheW91dENlbGwoKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdVcGRhdGUoKTtcblxuXHRcdHRoaXMubGF5b3V0Q2VsbFBhcnRzKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3Q2VsbC5vbkRpZENoYW5nZUxheW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmxheW91dENlbGxQYXJ0cygpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGxheW91dENlbGxQYXJ0cygpIHtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jZWxsUGFydHMudXBkYXRlSW50ZXJuYWxMYXlvdXROb3codGhpcy52aWV3Q2VsbCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdERPTSgpIHtcblx0XHQvLyBDcmVhdGUgYW4gZWxlbWVudCB0aGF0IGlzIG9ubHkgdXNlZCB0byBhbm5vdW5jZSBtYXJrdXAgY2VsbCBjb250ZW50IHRvIHNjcmVlbiByZWFkZXJzXG5cdFx0Y29uc3QgaWQgPSBgYXJpYS1tYXJrdXAtY2VsbC0ke3RoaXMudmlld0NlbGwuaWR9YDtcblx0XHR0aGlzLm1hcmtkb3duQWNjZXNzaWJpbGl0eUNvbnRhaW5lciA9IHRoaXMudGVtcGxhdGVEYXRhLmNlbGxDb250YWluZXI7XG5cdFx0dGhpcy5tYXJrZG93bkFjY2Vzc2liaWxpdHlDb250YWluZXIuaWQgPSBpZDtcblx0XHQvLyBIaWRlIHRoZSBlbGVtZW50IGZyb20gbm9uLXNjcmVlbiByZWFkZXJzXG5cdFx0dGhpcy5tYXJrZG93bkFjY2Vzc2liaWxpdHlDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzFweCc7XG5cdFx0dGhpcy5tYXJrZG93bkFjY2Vzc2liaWxpdHlDb250YWluZXIuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcblx0XHR0aGlzLm1hcmtkb3duQWNjZXNzaWJpbGl0eUNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5tYXJrZG93bkFjY2Vzc2liaWxpdHlDb250YWluZXIuc3R5bGUudG9wID0gJzEwMDAwMHB4Jztcblx0XHR0aGlzLm1hcmtkb3duQWNjZXNzaWJpbGl0eUNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJzEwMDAwcHgnO1xuXHRcdHRoaXMubWFya2Rvd25BY2Nlc3NpYmlsaXR5Q29udGFpbmVyLmFyaWFIaWRkZW4gPSAnZmFsc2UnO1xuXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEucm9vdENvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGVzY3JpYmVkYnknLCBpZCk7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3dlYnZpZXctYmFja2VkLW1hcmtkb3duLWNlbGwnLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3Q2VsbC5vbkRpZENoYW5nZVN0YXRlKGUgPT4ge1xuXHRcdFx0dGhpcy50ZW1wbGF0ZURhdGEuY2VsbFBhcnRzLnVwZGF0ZVN0YXRlKHRoaXMudmlld0NlbGwsIGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0NlbGwubW9kZWwub25EaWRDaGFuZ2VNZXRhZGF0YSgoKSA9PiB7XG5cdFx0XHR0aGlzLnZpZXdVcGRhdGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdDZWxsLm9uRGlkQ2hhbmdlU3RhdGUoKGUpID0+IHtcblx0XHRcdGlmIChlLmVkaXRTdGF0ZUNoYW5nZWQgfHwgZS5jb250ZW50Q2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLnZpZXdVcGRhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuZm9jdXNNb2RlQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZvckZvY3VzTW9kZUNoYW5nZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5mb2xkaW5nU3RhdGVDaGFuZ2VkKSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdTdGF0ZSA9IHRoaXMudmlld0NlbGwuZm9sZGluZ1N0YXRlO1xuXG5cdFx0XHRcdGlmIChmb2xkaW5nU3RhdGUgIT09IHRoaXMuZm9sZGluZ1N0YXRlKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2xkaW5nU3RhdGUgPSBmb2xkaW5nU3RhdGU7XG5cdFx0XHRcdFx0dGhpcy5sYXlvdXRGb2xkaW5nSW5kaWNhdG9yKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuY2VsbElzSG92ZXJlZENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVGb3JIb3ZlcigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5pbnB1dENvbGxhcHNlZENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb2xsYXBzZWRTdGF0ZSgpO1xuXHRcdFx0XHR0aGlzLnZpZXdVcGRhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuY2VsbExpbmVOdW1iZXJDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuY2VsbEVkaXRvck9wdGlvbnMuc2V0TGluZU51bWJlcnModGhpcy52aWV3Q2VsbC5saW5lTnVtYmVycyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0VkaXRvci5ub3RlYm9va09wdGlvbnMub25EaWRDaGFuZ2VPcHRpb25zKGUgPT4ge1xuXHRcdFx0aWYgKGUuc2hvd0ZvbGRpbmdDb250cm9scykge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZvbGRpbmdJY29uU2hvd0NsYXNzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3Q2VsbC5vbkRpZENoYW5nZUxheW91dCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuZWRpdG9yPy5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0XHRpZiAoZS5vdXRlcldpZHRoICYmIHRoaXMudmlld0NlbGwuZ2V0RWRpdFN0YXRlKCkgPT09IENlbGxFZGl0U3RhdGUuRWRpdGluZyAmJiBsYXlvdXRJbmZvICYmIGxheW91dEluZm8ud2lkdGggIT09IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JXaWR0aCkge1xuXHRcdFx0XHR0aGlzLm9uQ2VsbEVkaXRvcldpZHRoQ2hhbmdlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jZWxsRWRpdG9yT3B0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZU1hcmt1cENlbGxPcHRpb25zKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTWFya3VwQ2VsbE9wdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVFZGl0b3JPcHRpb25zKHRoaXMuY2VsbEVkaXRvck9wdGlvbnMuZ2V0VXBkYXRlZFZhbHVlKHRoaXMudmlld0NlbGwuaW50ZXJuYWxNZXRhZGF0YSwgdGhpcy52aWV3Q2VsbC51cmkpKTtcblxuXHRcdGlmICh0aGlzLmVkaXRvcikge1xuXHRcdFx0dGhpcy5lZGl0b3IudXBkYXRlT3B0aW9ucyh0aGlzLmNlbGxFZGl0b3JPcHRpb25zLmdldFVwZGF0ZWRWYWx1ZSh0aGlzLnZpZXdDZWxsLmludGVybmFsTWV0YWRhdGEsIHRoaXMudmlld0NlbGwudXJpKSk7XG5cblx0XHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoeyBkaXNwb3NlKCkgeyBjdHMuZGlzcG9zZSh0cnVlKTsgfSB9KTtcblx0XHRcdHJhY2VDYW5jZWxsYXRpb24odGhpcy52aWV3Q2VsbC5yZXNvbHZlVGV4dE1vZGVsKCksIGN0cy50b2tlbikudGhlbihtb2RlbCA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0XHRpbmRlbnRTaXplOiB0aGlzLmNlbGxFZGl0b3JPcHRpb25zLmluZGVudFNpemUsXG5cdFx0XHRcdFx0XHR0YWJTaXplOiB0aGlzLmNlbGxFZGl0b3JPcHRpb25zLnRhYlNpemUsXG5cdFx0XHRcdFx0XHRpbnNlcnRTcGFjZXM6IHRoaXMuY2VsbEVkaXRvck9wdGlvbnMuaW5zZXJ0U3BhY2VzLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbGxhcHNlZFN0YXRlKCkge1xuXHRcdGlmICh0aGlzLnZpZXdDZWxsLmlzSW5wdXRDb2xsYXBzZWQpIHtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuaGlkZU1hcmt1cFByZXZpZXdzKFt0aGlzLnZpZXdDZWxsXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IudW5oaWRlTWFya3VwUHJldmlld3MoW3RoaXMudmlld0NlbGxdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUZvckhvdmVyKCk6IHZvaWQge1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdtYXJrZG93bi1jZWxsLWhvdmVyJywgdGhpcy52aWV3Q2VsbC5jZWxsSXNIb3ZlcmVkKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRm9yRm9jdXNNb2RlQ2hhbmdlKCkge1xuXHRcdGlmICh0aGlzLnZpZXdDZWxsLmZvY3VzTW9kZSA9PT0gQ2VsbEZvY3VzTW9kZS5FZGl0b3IpIHtcblx0XHRcdHRoaXMuZm9jdXNFZGl0b3JJZk5lZWRlZCgpO1xuXHRcdH1cblxuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjZWxsLWVkaXRvci1mb2N1cycsIHRoaXMudmlld0NlbGwuZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLkVkaXRvcik7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXG5cdFx0Ly8gbW92ZSBmb2N1cyBiYWNrIHRvIHRoZSBjZWxsIGxpc3Qgb3RoZXJ3aXNlIHRoZSBmb2N1cyBnb2VzIHRvIGJvZHlcblx0XHRpZiAodGhpcy5ub3RlYm9va0VkaXRvci5nZXRBY3RpdmVDZWxsKCkgPT09IHRoaXMudmlld0NlbGwgJiYgdGhpcy52aWV3Q2VsbC5mb2N1c01vZGUgPT09IENlbGxGb2N1c01vZGUuRWRpdG9yICYmICh0aGlzLm5vdGVib29rRWRpdG9yLmhhc0VkaXRvckZvY3VzKCkgfHwgdGhpcy5ub3RlYm9va0VkaXRvci5nZXREb21Ob2RlKCkub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSB0aGlzLm5vdGVib29rRWRpdG9yLmdldERvbU5vZGUoKS5vd25lckRvY3VtZW50LmJvZHkpKSB7XG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmZvY3VzQ29udGFpbmVyKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q2VsbC5kZXRhY2hUZXh0RWRpdG9yKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGb2xkaW5nSWNvblNob3dDbGFzcygpIHtcblx0XHRjb25zdCBzaG93Rm9sZGluZ0ljb24gPSB0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5nZXREaXNwbGF5T3B0aW9ucygpLnNob3dGb2xkaW5nQ29udHJvbHM7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuZm9sZGluZ0luZGljYXRvci5jbGFzc0xpc3QucmVtb3ZlKCdtb3VzZW92ZXInLCAnYWx3YXlzJyk7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuZm9sZGluZ0luZGljYXRvci5jbGFzc0xpc3QuYWRkKHNob3dGb2xkaW5nSWNvbik7XG5cdH1cblxuXHRwcml2YXRlIHZpZXdVcGRhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMudmlld0NlbGwuaXNJbnB1dENvbGxhcHNlZCkge1xuXHRcdFx0dGhpcy52aWV3VXBkYXRlQ29sbGFwc2VkKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnZpZXdDZWxsLmdldEVkaXRTdGF0ZSgpID09PSBDZWxsRWRpdFN0YXRlLkVkaXRpbmcpIHtcblx0XHRcdHRoaXMudmlld1VwZGF0ZUVkaXRpbmcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy52aWV3VXBkYXRlUHJldmlldygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdmlld1VwZGF0ZUNvbGxhcHNlZCgpOiB2b2lkIHtcblx0XHRET00uc2hvdyh0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpO1xuXHRcdERPTS5oaWRlKHRoaXMuZWRpdG9yUGFydCk7XG5cblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIuaW5uZXJUZXh0ID0gJyc7XG5cblx0XHRjb25zdCBtYXJrZG93bkljb24gPSBET00uYXBwZW5kKHRoaXMudGVtcGxhdGVEYXRhLmNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lciwgRE9NLiQoJ3NwYW4nKSk7XG5cdFx0bWFya2Rvd25JY29uLmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5tYXJrZG93bikpO1xuXG5cdFx0Y29uc3QgZWxlbWVudCA9IERPTS4kKCdkaXYnKTtcblx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NlbGwtY29sbGFwc2UtcHJldmlldycpO1xuXHRcdGNvbnN0IHJpY2hFZGl0b3JUZXh0ID0gdGhpcy5nZXRSaWNoVGV4dCh0aGlzLnZpZXdDZWxsLnRleHRCdWZmZXIsIHRoaXMudmlld0NlbGwubGFuZ3VhZ2UpO1xuXHRcdERPTS5zYWZlSW5uZXJIdG1sKGVsZW1lbnQsIHJpY2hFZGl0b3JUZXh0KTtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG5cblx0XHRjb25zdCBleHBhbmRJY29uID0gRE9NLmFwcGVuZChlbGVtZW50LCBET00uJCgnc3Bhbi5leHBhbmRJbnB1dEljb24nKSk7XG5cdFx0ZXhwYW5kSWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ubW9yZSkpO1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoRVhQQU5EX0NFTExfSU5QVVRfQ09NTUFORF9JRCk7XG5cdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdGVsZW1lbnQudGl0bGUgPSBsb2NhbGl6ZSgnY2VsbEV4cGFuZElucHV0QnV0dG9uTGFiZWxXaXRoRG91YmxlQ2xpY2snLCBcIkRvdWJsZS1jbGljayB0byBleHBhbmQgY2VsbCBpbnB1dCAoezB9KVwiLCBrZXliaW5kaW5nLmdldExhYmVsKCkpO1xuXHRcdFx0ZXhwYW5kSWNvbi50aXRsZSA9IGxvY2FsaXplKCdjZWxsRXhwYW5kSW5wdXRCdXR0b25MYWJlbCcsIFwiRXhwYW5kIENlbGwgSW5wdXQgKHswfSlcIiwga2V5YmluZGluZy5nZXRMYWJlbCgpKTtcblx0XHR9XG5cblx0XHR0aGlzLm1hcmtkb3duQWNjZXNzaWJpbGl0eUNvbnRhaW5lci5hcmlhSGlkZGVuID0gJ3RydWUnO1xuXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2lucHV0LWNvbGxhcHNlZCcsIHRydWUpO1xuXHRcdHRoaXMudmlld0NlbGwucmVuZGVyZWRNYXJrZG93bkhlaWdodCA9IDA7XG5cdFx0dGhpcy52aWV3Q2VsbC5sYXlvdXRDaGFuZ2Uoe30pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSaWNoVGV4dChidWZmZXI6IElSZWFkb25seVRleHRCdWZmZXIsIGxhbmd1YWdlOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdG9rZW5pemVUb1N0cmluZ1N5bmModGhpcy5sYW5ndWFnZVNlcnZpY2UsIGJ1ZmZlci5nZXRMaW5lQ29udGVudCgxKSwgbGFuZ3VhZ2UpO1xuXHR9XG5cblx0cHJpdmF0ZSB2aWV3VXBkYXRlRWRpdGluZygpOiB2b2lkIHtcblx0XHQvLyBzd2l0Y2ggdG8gZWRpdGluZyBtb2RlXG5cdFx0bGV0IGVkaXRvckhlaWdodDogbnVtYmVyO1xuXG5cdFx0RE9NLnNob3codGhpcy5lZGl0b3JQYXJ0KTtcblx0XHR0aGlzLm1hcmtkb3duQWNjZXNzaWJpbGl0eUNvbnRhaW5lci5hcmlhSGlkZGVuID0gJ3RydWUnO1xuXHRcdERPTS5oaWRlKHRoaXMudGVtcGxhdGVEYXRhLmNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lcik7XG5cblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmhpZGVNYXJrdXBQcmV2aWV3cyhbdGhpcy52aWV3Q2VsbF0pO1xuXG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2lucHV0LWNvbGxhcHNlZCcsIGZhbHNlKTtcblx0XHR0aGlzLnRlbXBsYXRlRGF0YS5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnbWFya2Rvd24tY2VsbC1lZGl0LW1vZGUnLCB0cnVlKTtcblxuXHRcdGlmICh0aGlzLmVkaXRvciAmJiB0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRlZGl0b3JIZWlnaHQgPSB0aGlzLmVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cblx0XHRcdC8vIG5vdCBmaXJzdCB0aW1lLCB3ZSBkb24ndCBuZWVkIHRvIGNyZWF0ZSBlZGl0b3Jcblx0XHRcdHRoaXMudmlld0NlbGwuYXR0YWNoVGV4dEVkaXRvcih0aGlzLmVkaXRvcik7XG5cdFx0XHR0aGlzLmZvY3VzRWRpdG9ySWZOZWVkZWQoKTtcblxuXHRcdFx0dGhpcy5iaW5kRWRpdG9yTGlzdGVuZXJzKHRoaXMuZWRpdG9yKTtcblxuXHRcdFx0dGhpcy5lZGl0b3IubGF5b3V0KHtcblx0XHRcdFx0d2lkdGg6IHRoaXMudmlld0NlbGwubGF5b3V0SW5mby5lZGl0b3JXaWR0aCxcblx0XHRcdFx0aGVpZ2h0OiBlZGl0b3JIZWlnaHRcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVkaXRvckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRjb25zdCB3aWR0aCA9IHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVNYXJrZG93bkNlbGxFZGl0b3JXaWR0aCh0aGlzLm5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKS53aWR0aCk7XG5cdFx0XHRjb25zdCBsaW5lTnVtID0gdGhpcy52aWV3Q2VsbC5saW5lQ291bnQ7XG5cdFx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLmZvbnRJbmZvPy5saW5lSGVpZ2h0IHx8IDE3O1xuXHRcdFx0Y29uc3QgZWRpdG9yUGFkZGluZyA9IHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVFZGl0b3JQYWRkaW5nKHRoaXMudmlld0NlbGwuaW50ZXJuYWxNZXRhZGF0YSwgdGhpcy52aWV3Q2VsbC51cmkpO1xuXHRcdFx0ZWRpdG9ySGVpZ2h0ID0gTWF0aC5tYXgobGluZU51bSwgMSkgKiBsaW5lSGVpZ2h0ICsgZWRpdG9yUGFkZGluZy50b3AgKyBlZGl0b3JQYWRkaW5nLmJvdHRvbTtcblxuXHRcdFx0dGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0XHQvLyBjcmVhdGUgYSBzcGVjaWFsIGNvbnRleHQga2V5IHNlcnZpY2UgdGhhdCBzZXQgdGhlIGluQ29tcG9zaXRlRWRpdG9yLWNvbnRleHRrZXlcblx0XHRcdGNvbnN0IGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yUGFydCk7XG5cdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5pbkNvbXBvc2l0ZUVkaXRvci5iaW5kVG8oZWRpdG9yQ29udGV4dEtleVNlcnZpY2UpLnNldCh0cnVlKTtcblx0XHRcdGNvbnN0IGVkaXRvckluc3RhU2VydmljZSA9IHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblx0XHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdFx0dGhpcy5lZGl0b3IgPSB0aGlzLmVkaXRvckRpc3Bvc2FibGVzLmFkZChlZGl0b3JJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29kZUVkaXRvcldpZGdldCwgdGhpcy50ZW1wbGF0ZURhdGEuZWRpdG9yQ29udGFpbmVyLCB7XG5cdFx0XHRcdC4uLnRoaXMuZWRpdG9yT3B0aW9ucyxcblx0XHRcdFx0ZGltZW5zaW9uOiB7XG5cdFx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRcdGhlaWdodDogZWRpdG9ySGVpZ2h0XG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8vIG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0T3ZlcmZsb3dDb250YWluZXJEb21Ob2RlKClcblx0XHRcdH0sIHtcblx0XHRcdFx0Y29udHJpYnV0aW9uczogdGhpcy5ub3RlYm9va0VkaXRvci5jcmVhdGlvbk9wdGlvbnMuY2VsbEVkaXRvckNvbnRyaWJ1dGlvbnNcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLmN1cnJlbnRFZGl0b3IgPSB0aGlzLmVkaXRvcjtcblx0XHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHRoaXMuZWRpdG9yLm9uRGlkQmx1ckVkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmVkaXRvcikge1xuXHRcdFx0XHRcdFdvcmRIaWdobGlnaHRlckNvbnRyaWJ1dGlvbi5nZXQodGhpcy5lZGl0b3IpPy5zdG9wSGlnaGxpZ2h0aW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHRoaXMuZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5lZGl0b3IpIHtcblx0XHRcdFx0XHRXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KHRoaXMuZWRpdG9yKT8ucmVzdG9yZVZpZXdTdGF0ZSh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHsgZGlzcG9zZSgpIHsgY3RzLmRpc3Bvc2UodHJ1ZSk7IH0gfSk7XG5cdFx0XHRyYWNlQ2FuY2VsbGF0aW9uKHRoaXMudmlld0NlbGwucmVzb2x2ZVRleHRNb2RlbCgpLCBjdHMudG9rZW4pLnRoZW4obW9kZWwgPT4ge1xuXHRcdFx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5lZGl0b3IhLnNldE1vZGVsKG1vZGVsKTtcblx0XHRcdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0aW5kZW50U2l6ZTogdGhpcy5jZWxsRWRpdG9yT3B0aW9ucy5pbmRlbnRTaXplLFxuXHRcdFx0XHRcdHRhYlNpemU6IHRoaXMuY2VsbEVkaXRvck9wdGlvbnMudGFiU2l6ZSxcblx0XHRcdFx0XHRpbnNlcnRTcGFjZXM6IHRoaXMuY2VsbEVkaXRvck9wdGlvbnMuaW5zZXJ0U3BhY2VzLFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCByZWFsQ29udGVudEhlaWdodCA9IHRoaXMuZWRpdG9yIS5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRcdGlmIChyZWFsQ29udGVudEhlaWdodCAhPT0gZWRpdG9ySGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5lZGl0b3IhLmxheW91dChcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRcdFx0XHRoZWlnaHQ6IHJlYWxDb250ZW50SGVpZ2h0XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRlZGl0b3JIZWlnaHQgPSByZWFsQ29udGVudEhlaWdodDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMudmlld0NlbGwuYXR0YWNoVGV4dEVkaXRvcih0aGlzLmVkaXRvciEpO1xuXG5cdFx0XHRcdGlmICh0aGlzLnZpZXdDZWxsLmdldEVkaXRTdGF0ZSgpID09PSBDZWxsRWRpdFN0YXRlLkVkaXRpbmcpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzRWRpdG9ySWZOZWVkZWQoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuYmluZEVkaXRvckxpc3RlbmVycyh0aGlzLmVkaXRvciEpO1xuXG5cdFx0XHRcdHRoaXMudmlld0NlbGwuZWRpdG9ySGVpZ2h0ID0gZWRpdG9ySGVpZ2h0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q2VsbC5lZGl0b3JIZWlnaHQgPSBlZGl0b3JIZWlnaHQ7XG5cdFx0dGhpcy5mb2N1c0VkaXRvcklmTmVlZGVkKCk7XG5cdFx0dGhpcy5yZW5kZXJlZEVkaXRvcnMuc2V0KHRoaXMudmlld0NlbGwsIHRoaXMuZWRpdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgdmlld1VwZGF0ZVByZXZpZXcoKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3Q2VsbC5kZXRhY2hUZXh0RWRpdG9yKCk7XG5cdFx0RE9NLmhpZGUodGhpcy5lZGl0b3JQYXJ0KTtcblx0XHRET00uaGlkZSh0aGlzLnRlbXBsYXRlRGF0YS5jZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpO1xuXHRcdHRoaXMubWFya2Rvd25BY2Nlc3NpYmlsaXR5Q29udGFpbmVyLmFyaWFIaWRkZW4gPSAnZmFsc2UnO1xuXHRcdHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdpbnB1dC1jb2xsYXBzZWQnLCBmYWxzZSk7XG5cdFx0dGhpcy50ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ21hcmtkb3duLWNlbGwtZWRpdC1tb2RlJywgZmFsc2UpO1xuXG5cdFx0dGhpcy5yZW5kZXJlZEVkaXRvcnMuZGVsZXRlKHRoaXMudmlld0NlbGwpO1xuXG5cdFx0dGhpcy5tYXJrZG93bkFjY2Vzc2liaWxpdHlDb250YWluZXIuaW5uZXJUZXh0ID0gJyc7XG5cdFx0aWYgKHRoaXMudmlld0NlbGwucmVuZGVyZWRIdG1sKSB7XG5cdFx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHRcdERPTS5zYWZlSW5uZXJIdG1sKHRoaXMubWFya2Rvd25BY2Nlc3NpYmlsaXR5Q29udGFpbmVyLCB0aGlzLnZpZXdDZWxsLnJlbmRlcmVkSHRtbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRET00uY2xlYXJOb2RlKHRoaXMubWFya2Rvd25BY2Nlc3NpYmlsaXR5Q29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmNyZWF0ZU1hcmt1cFByZXZpZXcodGhpcy52aWV3Q2VsbCk7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzRWRpdG9ySWZOZWVkZWQoKSB7XG5cdFx0aWYgKHRoaXMudmlld0NlbGwuZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLkVkaXRvciAmJlxuXHRcdFx0KHRoaXMubm90ZWJvb2tFZGl0b3IuaGFzRWRpdG9yRm9jdXMoKSB8fCB0aGlzLm5vdGVib29rRWRpdG9yLmdldERvbU5vZGUoKS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0RG9tTm9kZSgpLm93bmVyRG9jdW1lbnQuYm9keSlcblx0XHQpIHsgLy8gRG9uJ3Qgc3RlYWwgZm9jdXMgZnJvbSBvdGhlciB3b3JrYmVuY2ggcGFydHMsIGJ1dCBpZiBib2R5IGhhcyBmb2N1cywgd2UgY2FuIHRha2UgaXRcblx0XHRcdGlmICghdGhpcy5lZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXG5cdFx0XHRjb25zdCBwcmltYXJ5U2VsZWN0aW9uID0gdGhpcy5lZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoIXByaW1hcnlTZWxlY3Rpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnJldmVhbFJhbmdlSW5WaWV3QXN5bmModGhpcy52aWV3Q2VsbCwgcHJpbWFyeVNlbGVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRFZGl0b3IoZGltZW5zaW9uOiBET00uSURpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yPy5sYXlvdXQoZGltZW5zaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgb25DZWxsRWRpdG9yV2lkdGhDaGFuZ2UoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVhbENvbnRlbnRIZWlnaHQgPSB0aGlzLmVkaXRvciEuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdHRoaXMubGF5b3V0RWRpdG9yKFxuXHRcdFx0e1xuXHRcdFx0XHR3aWR0aDogdGhpcy52aWV3Q2VsbC5sYXlvdXRJbmZvLmVkaXRvcldpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IHJlYWxDb250ZW50SGVpZ2h0XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdC8vIExFVCB0aGUgY29udGVudCBzaXplIG9ic2VydmVyIHRvIGhhbmRsZSBpdFxuXHRcdC8vIHRoaXMudmlld0NlbGwuZWRpdG9ySGVpZ2h0ID0gcmVhbENvbnRlbnRIZWlnaHQ7XG5cdFx0Ly8gdGhpcy5yZWxheW91dENlbGwoKTtcblx0fVxuXG5cdHJlbGF5b3V0Q2VsbCgpOiB2b2lkIHtcblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmxheW91dE5vdGVib29rQ2VsbCh0aGlzLnZpZXdDZWxsLCB0aGlzLnZpZXdDZWxsLmxheW91dEluZm8udG90YWxIZWlnaHQpO1xuXHRcdHRoaXMubGF5b3V0Rm9sZGluZ0luZGljYXRvcigpO1xuXHR9XG5cblx0dXBkYXRlRWRpdG9yT3B0aW9ucyhuZXdWYWx1ZTogSUVkaXRvck9wdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvck9wdGlvbnMgPSBuZXdWYWx1ZTtcblx0XHR0aGlzLmVkaXRvcj8udXBkYXRlT3B0aW9ucyh0aGlzLmVkaXRvck9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRGb2xkaW5nSW5kaWNhdG9yKCkge1xuXHRcdHN3aXRjaCAodGhpcy5mb2xkaW5nU3RhdGUpIHtcblx0XHRcdGNhc2UgQ2VsbEZvbGRpbmdTdGF0ZS5Ob25lOlxuXHRcdFx0XHR0aGlzLnRlbXBsYXRlRGF0YS5mb2xkaW5nSW5kaWNhdG9yLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLmZvbGRpbmdJbmRpY2F0b3IuaW5uZXJUZXh0ID0gJyc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDZWxsRm9sZGluZ1N0YXRlLkNvbGxhcHNlZDpcblx0XHRcdFx0dGhpcy50ZW1wbGF0ZURhdGEuZm9sZGluZ0luZGljYXRvci5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHRcdERPTS5yZXNldCh0aGlzLnRlbXBsYXRlRGF0YS5mb2xkaW5nSW5kaWNhdG9yLCByZW5kZXJJY29uKGNvbGxhcHNlZEljb24pKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENlbGxGb2xkaW5nU3RhdGUuRXhwYW5kZWQ6XG5cdFx0XHRcdHRoaXMudGVtcGxhdGVEYXRhLmZvbGRpbmdJbmRpY2F0b3Iuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdFx0XHRET00ucmVzZXQodGhpcy50ZW1wbGF0ZURhdGEuZm9sZGluZ0luZGljYXRvciwgcmVuZGVySWNvbihleHBhbmRlZEljb24pKTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYmluZEVkaXRvckxpc3RlbmVycyhlZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQpIHtcblxuXHRcdHRoaXMubG9jYWxEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuZm9jdXNTd2l0Y2hEaXNwb3NhYmxlLmNsZWFyKCk7XG5cblx0XHR0aGlzLmxvY2FsRGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5vbkNlbGxFZGl0b3JIZWlnaHRDaGFuZ2UoZWRpdG9yLCBlLmNvbnRlbnRIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMubG9jYWxEaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5zb3VyY2UgPT09ICdyZXN0b3JlU3RhdGUnKSB7XG5cdFx0XHRcdC8vIGRvIG5vdCByZXZlYWwgdGhlIGNlbGwgaW50byB2aWV3IGlmIHRoaXMgc2VsZWN0aW9uIGNoYW5nZSB3YXMgY2F1c2VkIGJ5IHJlc3RvcmluZyBlZGl0b3JzLi4uXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0XHRcdGlmIChzZWxlY3Rpb25zPy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudEhlaWdodCA9IGVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRcdGNvbnN0IGxheW91dENvbnRlbnRIZWlnaHQgPSB0aGlzLnZpZXdDZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0O1xuXG5cdFx0XHRcdGlmIChjb250ZW50SGVpZ2h0ICE9PSBsYXlvdXRDb250ZW50SGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5vbkNlbGxFZGl0b3JIZWlnaHRDaGFuZ2UoZWRpdG9yLCBjb250ZW50SGVpZ2h0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBsYXN0U2VsZWN0aW9uID0gc2VsZWN0aW9uc1tzZWxlY3Rpb25zLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnJldmVhbFJhbmdlSW5WaWV3QXN5bmModGhpcy52aWV3Q2VsbCwgbGFzdFNlbGVjdGlvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRm9jdXNNb2RlID0gKCkgPT4gdGhpcy52aWV3Q2VsbC5mb2N1c01vZGUgPSBlZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSA/IENlbGxGb2N1c01vZGUuRWRpdG9yIDogQ2VsbEZvY3VzTW9kZS5Db250YWluZXI7XG5cdFx0dGhpcy5sb2NhbERpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR1cGRhdGVGb2N1c01vZGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmxvY2FsRGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQoKCkgPT4ge1xuXHRcdFx0Ly8gdGhpcyBpcyBmb3IgYSBzcGVjaWFsIGNhc2U6XG5cdFx0XHQvLyB1c2VycyBjbGljayB0aGUgc3RhdHVzIGJhciBlbXB0eSBzcGFjZSwgd2hpY2ggd2Ugd2lsbCB0aGVuIGZvY3VzIHRoZSBlZGl0b3Jcblx0XHRcdC8vIHNvIHdlIGRvbid0IHdhbnQgdG8gdXBkYXRlIHRoZSBmb2N1cyBzdGF0ZSB0b28gZWFnZXJseVxuXHRcdFx0aWYgKHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lci5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ/LmNvbnRhaW5zKHRoaXMudGVtcGxhdGVEYXRhLmNvbnRhaW5lcikpIHtcblx0XHRcdFx0dGhpcy5mb2N1c1N3aXRjaERpc3Bvc2FibGUudmFsdWUgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB1cGRhdGVGb2N1c01vZGUoKSwgMzAwKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVwZGF0ZUZvY3VzTW9kZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHVwZGF0ZUZvY3VzTW9kZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNlbGxFZGl0b3JIZWlnaHRDaGFuZ2UoZWRpdG9yOiBDb2RlRWRpdG9yV2lkZ2V0LCBuZXdIZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdMYXlvdXQgPSBlZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdHRoaXMudmlld0NlbGwuZWRpdG9ySGVpZ2h0ID0gbmV3SGVpZ2h0O1xuXHRcdGVkaXRvci5sYXlvdXQoXG5cdFx0XHR7XG5cdFx0XHRcdHdpZHRoOiB2aWV3TGF5b3V0LndpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IG5ld0hlaWdodFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsa0JBQWtCO0FB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
