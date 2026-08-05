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
import { PixelRatio } from "../../../../../../base/browser/pixelRatio.js";
import * as DOM from "../../../../../../base/browser/dom.js";
import { FastDomNode } from "../../../../../../base/browser/fastDomNode.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { BareFontInfo } from "../../../../../../editor/common/config/fontInfo.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../../editor/common/languages/modesRegistry.js";
import { localize } from "../../../../../../nls.js";
import { IMenuService } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../../../platform/notification/common/notification.js";
import { CellPartsCollection } from "../cellPart.js";
import { CellChatPart } from "../cellParts/chat/cellChatPart.js";
import { CellComments } from "../cellParts/cellComments.js";
import { CellContextKeyPart } from "../cellParts/cellContextKeys.js";
import { CellDecorations } from "../cellParts/cellDecorations.js";
import { CellDragAndDropPart } from "../cellParts/cellDnd.js";
import { CodeCellDragImageRenderer } from "../cellParts/cellDragRenderer.js";
import { CellEditorOptions } from "../cellParts/cellEditorOptions.js";
import { CellExecutionPart } from "../cellParts/cellExecution.js";
import { CellFocusPart } from "../cellParts/cellFocus.js";
import { CellFocusIndicator } from "../cellParts/cellFocusIndicator.js";
import { CellProgressBar } from "../cellParts/cellProgressBar.js";
import { CellEditorStatusBar } from "../cellParts/cellStatusPart.js";
import { BetweenCellToolbar, CellTitleToolbarPart } from "../cellParts/cellToolbars.js";
import { CodeCell } from "../cellParts/codeCell.js";
import { RunToolbar } from "../cellParts/codeCellRunToolbar.js";
import { CollapsedCellInput } from "../cellParts/collapsedCellInput.js";
import { CollapsedCellOutput } from "../cellParts/collapsedCellOutput.js";
import { FoldedCellHint } from "../cellParts/foldedCellHint.js";
import { MarkupCell } from "../cellParts/markupCell.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
const $ = DOM.$;
let NotebookCellListDelegate = class extends Disposable {
  constructor(targetWindow, configurationService) {
    super();
    this.configurationService = configurationService;
    const editorOptions = this.configurationService.getValue("editor");
    this.lineHeight = BareFontInfo.createFromRawSettings(editorOptions, PixelRatio.getInstance(targetWindow).value).lineHeight;
  }
  getHeight(element) {
    return element.getHeight(this.lineHeight);
  }
  getDynamicHeight(element) {
    return element.getDynamicHeight();
  }
  getTemplateId(element) {
    if (element.cellKind === CellKind.Markup) {
      return MarkupCellRenderer.TEMPLATE_ID;
    } else {
      return CodeCellRenderer.TEMPLATE_ID;
    }
  }
};
NotebookCellListDelegate = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookCellListDelegate);
class AbstractCellRenderer extends Disposable {
  constructor(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, language, dndController) {
    super();
    this.instantiationService = instantiationService;
    this.notebookEditor = notebookEditor;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.contextKeyServiceProvider = contextKeyServiceProvider;
    this.dndController = dndController;
    this.editorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(language), this.notebookEditor.notebookOptions, configurationService));
  }
  dispose() {
    super.dispose();
    this.dndController = void 0;
  }
}
let MarkupCellRenderer = class extends AbstractCellRenderer {
  constructor(notebookEditor, dndController, renderedEditors, contextKeyServiceProvider, configurationService, instantiationService, contextMenuService, menuService, keybindingService, notificationService, notebookExecutionStateService) {
    super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, "markdown", dndController);
    this.renderedEditors = renderedEditors;
    this._notebookExecutionStateService = notebookExecutionStateService;
  }
  get templateId() {
    return MarkupCellRenderer.TEMPLATE_ID;
  }
  renderTemplate(rootContainer) {
    rootContainer.classList.add("markdown-cell-row");
    const container = DOM.append(rootContainer, DOM.$(".cell-inner-container"));
    const templateDisposables = new DisposableStore();
    const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
    const decorationContainer = DOM.append(rootContainer, $(".cell-decoration"));
    const titleToolbarContainer = DOM.append(container, $(".cell-title-toolbar"));
    const focusIndicatorTop = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-top")));
    const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left")));
    const foldingIndicator = DOM.append(focusIndicatorLeft.domNode, DOM.$(".notebook-folding-indicator"));
    const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right")));
    const codeInnerContent = DOM.append(container, $(".cell.code"));
    const editorPart = DOM.append(codeInnerContent, $(".cell-editor-part"));
    const cellChatPart = DOM.append(editorPart, $(".cell-chat-part"));
    const cellInputCollapsedContainer = DOM.append(codeInnerContent, $(".input-collapse-container"));
    cellInputCollapsedContainer.style.display = "none";
    const editorContainer = DOM.append(editorPart, $(".cell-editor-container"));
    editorPart.style.display = "none";
    const cellCommentPartContainer = DOM.append(container, $(".cell-comment-container"));
    const innerContent = DOM.append(container, $(".cell.markdown"));
    const bottomCellContainer = DOM.append(container, $(".cell-bottom-toolbar-container"));
    const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const rootClassDelegate = {
      toggle: (className, force) => container.classList.toggle(className, force)
    };
    const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(
      CellTitleToolbarPart,
      titleToolbarContainer,
      rootClassDelegate,
      this.notebookEditor.creationOptions.menuIds.cellTitleToolbar,
      this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar,
      this.notebookEditor
    ));
    const focusIndicatorBottom = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-bottom")));
    const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), [
      templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
      templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, void 0)),
      templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom)),
      templateDisposables.add(new FoldedCellHint(this.notebookEditor, DOM.append(container, $(".notebook-folded-hint")), this._notebookExecutionStateService)),
      templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
      templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
      templateDisposables.add(new CellFocusPart(container, void 0, this.notebookEditor)),
      templateDisposables.add(new CellDragAndDropPart(container)),
      templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor))
    ], [
      titleToolbar,
      templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellContainer))
    ]);
    templateDisposables.add(cellParts);
    const templateData = {
      rootContainer,
      cellInputCollapsedContainer,
      instantiationService: scopedInstaService,
      container,
      cellContainer: innerContent,
      editorPart,
      editorContainer,
      foldingIndicator,
      templateDisposables,
      elementDisposables: templateDisposables.add(new DisposableStore()),
      cellParts,
      toJSON: () => {
        return {};
      }
    };
    return templateData;
  }
  renderElement(element, index, templateData, height) {
    if (!this.notebookEditor.hasModel()) {
      throw new Error("The notebook editor is not attached with view model yet.");
    }
    templateData.currentRenderedCell = element;
    templateData.currentEditor = void 0;
    templateData.editorPart.style.display = "none";
    templateData.cellContainer.innerText = "";
    if (height === void 0) {
      return;
    }
    templateData.elementDisposables.add(templateData.instantiationService.createInstance(MarkupCell, this.notebookEditor, element, templateData, this.renderedEditors));
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
};
MarkupCellRenderer.TEMPLATE_ID = "markdown_cell";
MarkupCellRenderer = __decorateClass([
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, INotebookExecutionStateService)
], MarkupCellRenderer);
let CodeCellRenderer = class extends AbstractCellRenderer {
  constructor(notebookEditor, renderedEditors, editorPool, dndController, contextKeyServiceProvider, configurationService, contextMenuService, menuService, instantiationService, keybindingService, notificationService) {
    super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, PLAINTEXT_LANGUAGE_ID, dndController);
    this.renderedEditors = renderedEditors;
    this.editorPool = editorPool;
  }
  get templateId() {
    return CodeCellRenderer.TEMPLATE_ID;
  }
  renderTemplate(rootContainer) {
    rootContainer.classList.add("code-cell-row");
    const container = DOM.append(rootContainer, DOM.$(".cell-inner-container"));
    const templateDisposables = new DisposableStore();
    const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
    const decorationContainer = DOM.append(rootContainer, $(".cell-decoration"));
    const focusIndicatorTop = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-top")));
    const titleToolbarContainer = DOM.append(container, $(".cell-title-toolbar"));
    const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left")));
    const cellChatPart = DOM.append(container, $(".cell-chat-part"));
    const cellContainer = DOM.append(container, $(".cell.code"));
    const runButtonContainer = DOM.append(cellContainer, $(".run-button-container"));
    const cellInputCollapsedContainer = DOM.append(cellContainer, $(".input-collapse-container"));
    cellInputCollapsedContainer.style.display = "none";
    const executionOrderLabel = DOM.append(focusIndicatorLeft.domNode, $("div.execution-count-label"));
    executionOrderLabel.title = localize("cellExecutionOrderCountLabel", "Execution Order");
    const editorPart = DOM.append(cellContainer, $(".cell-editor-part"));
    const editorContainer = DOM.append(editorPart, $(".cell-editor-container"));
    const cellCommentPartContainer = DOM.append(container, $(".cell-comment-container"));
    const editorContextKeyService = templateDisposables.add(this.contextKeyServiceProvider(editorPart));
    const editorInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService])));
    EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);
    const editor = editorInstaService.createInstance(CodeEditorWidget, editorContainer, {
      ...this.editorOptions.getDefaultValue(),
      dimension: {
        width: 0,
        height: 0
      },
      scrollbar: {
        vertical: "hidden",
        horizontal: "auto",
        handleMouseWheel: false,
        useShadows: false
      }
    }, {
      contributions: this.notebookEditor.creationOptions.cellEditorContributions
    });
    templateDisposables.add(editor);
    const outputContainer = new FastDomNode(DOM.append(container, $(".output")));
    const cellOutputCollapsedContainer = DOM.append(outputContainer.domNode, $(".output-collapse-container"));
    const outputShowMoreContainer = new FastDomNode(DOM.append(container, $(".output-show-more-container")));
    const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$(".cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right")));
    const focusSinkElement = DOM.append(container, $(".cell-editor-focus-sink"));
    focusSinkElement.setAttribute("tabindex", "0");
    const bottomCellToolbarContainer = DOM.append(container, $(".cell-bottom-toolbar-container"));
    const focusIndicatorBottom = new FastDomNode(DOM.append(container, $(".cell-focus-indicator.cell-focus-indicator-bottom")));
    const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const rootClassDelegate = {
      toggle: (className, force) => container.classList.toggle(className, force)
    };
    const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(
      CellTitleToolbarPart,
      titleToolbarContainer,
      rootClassDelegate,
      this.notebookEditor.creationOptions.menuIds.cellTitleToolbar,
      this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar,
      this.notebookEditor
    ));
    const focusIndicatorPart = templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom));
    const contentParts = [
      focusIndicatorPart,
      templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
      templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, editor)),
      templateDisposables.add(scopedInstaService.createInstance(CellProgressBar, editorPart, cellInputCollapsedContainer)),
      templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
      templateDisposables.add(scopedInstaService.createInstance(CellExecutionPart, this.notebookEditor, executionOrderLabel)),
      templateDisposables.add(scopedInstaService.createInstance(CollapsedCellOutput, this.notebookEditor, cellOutputCollapsedContainer)),
      templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
      templateDisposables.add(new CellFocusPart(container, focusSinkElement, this.notebookEditor)),
      templateDisposables.add(new CellDragAndDropPart(container)),
      templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor))
    ];
    const { cellExecutePrimary, cellExecuteToolbar } = this.notebookEditor.creationOptions.menuIds;
    if (cellExecutePrimary && cellExecuteToolbar) {
      contentParts.push(templateDisposables.add(
        scopedInstaService.createInstance(RunToolbar, this.notebookEditor, contextKeyService, container, runButtonContainer, cellExecutePrimary, cellExecuteToolbar)
      ));
    }
    const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), contentParts, [
      titleToolbar,
      templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellToolbarContainer))
    ]);
    templateDisposables.add(cellParts);
    const templateData = {
      rootContainer,
      editorPart,
      cellInputCollapsedContainer,
      cellOutputCollapsedContainer,
      instantiationService: scopedInstaService,
      container,
      cellContainer,
      focusSinkElement,
      outputContainer,
      outputShowMoreContainer,
      editor,
      templateDisposables,
      elementDisposables: templateDisposables.add(new DisposableStore()),
      cellParts,
      toJSON: () => {
        return {};
      }
    };
    const dragHandles = [focusIndicatorLeft.domNode, focusIndicatorPart.codeFocusIndicator.domNode, focusIndicatorPart.outputFocusIndicator.domNode];
    this.dndController?.registerDragHandle(templateData, rootContainer, dragHandles, () => new CodeCellDragImageRenderer().getDragImage(templateData, templateData.editor, "code"));
    return templateData;
  }
  renderElement(element, index, templateData, height) {
    if (!this.notebookEditor.hasModel()) {
      throw new Error("The notebook editor is not attached with view model yet.");
    }
    templateData.currentRenderedCell = element;
    if (height === void 0) {
      return;
    }
    templateData.outputContainer.domNode.innerText = "";
    templateData.outputContainer.domNode.appendChild(templateData.cellOutputCollapsedContainer);
    templateData.elementDisposables.add(templateData.instantiationService.createInstance(CodeCell, this.notebookEditor, element, templateData, this.editorPool));
    this.renderedEditors.set(element, templateData.editor);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
    this.renderedEditors.delete(element);
  }
};
CodeCellRenderer.TEMPLATE_ID = "code_cell";
CodeCellRenderer = __decorateClass([
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, INotificationService)
], CodeCellRenderer);
export {
  CodeCellRenderer,
  MarkupCellRenderer,
  NotebookCellListDelegate
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvcmVuZGVyZXJzL2NlbGxSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFBpeGVsUmF0aW8gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby5qcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFJlbmRlcmVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQmFyZUZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElDZWxsVmlld01vZGVsLCBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDZWxsUGFydHNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vY2VsbFBhcnQuanMnO1xuaW1wb3J0IHsgQ2VsbENoYXRQYXJ0IH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NoYXQvY2VsbENoYXRQYXJ0LmpzJztcbmltcG9ydCB7IENlbGxDb21tZW50cyB9IGZyb20gJy4uL2NlbGxQYXJ0cy9jZWxsQ29tbWVudHMuanMnO1xuaW1wb3J0IHsgQ2VsbENvbnRleHRLZXlQYXJ0IH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NlbGxDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBDZWxsRGVjb3JhdGlvbnMgfSBmcm9tICcuLi9jZWxsUGFydHMvY2VsbERlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IENlbGxEcmFnQW5kRHJvcENvbnRyb2xsZXIsIENlbGxEcmFnQW5kRHJvcFBhcnQgfSBmcm9tICcuLi9jZWxsUGFydHMvY2VsbERuZC5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbERyYWdJbWFnZVJlbmRlcmVyIH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NlbGxEcmFnUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi9jZWxsUGFydHMvY2VsbEVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2VsbEV4ZWN1dGlvblBhcnQgfSBmcm9tICcuLi9jZWxsUGFydHMvY2VsbEV4ZWN1dGlvbi5qcyc7XG5pbXBvcnQgeyBDZWxsRm9jdXNQYXJ0IH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NlbGxGb2N1cy5qcyc7XG5pbXBvcnQgeyBDZWxsRm9jdXNJbmRpY2F0b3IgfSBmcm9tICcuLi9jZWxsUGFydHMvY2VsbEZvY3VzSW5kaWNhdG9yLmpzJztcbmltcG9ydCB7IENlbGxQcm9ncmVzc0JhciB9IGZyb20gJy4uL2NlbGxQYXJ0cy9jZWxsUHJvZ3Jlc3NCYXIuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRvclN0YXR1c0JhciB9IGZyb20gJy4uL2NlbGxQYXJ0cy9jZWxsU3RhdHVzUGFydC5qcyc7XG5pbXBvcnQgeyBCZXR3ZWVuQ2VsbFRvb2xiYXIsIENlbGxUaXRsZVRvb2xiYXJQYXJ0IH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NlbGxUb29sYmFycy5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbCB9IGZyb20gJy4uL2NlbGxQYXJ0cy9jb2RlQ2VsbC5qcyc7XG5pbXBvcnQgeyBSdW5Ub29sYmFyIH0gZnJvbSAnLi4vY2VsbFBhcnRzL2NvZGVDZWxsUnVuVG9vbGJhci5qcyc7XG5pbXBvcnQgeyBDb2xsYXBzZWRDZWxsSW5wdXQgfSBmcm9tICcuLi9jZWxsUGFydHMvY29sbGFwc2VkQ2VsbElucHV0LmpzJztcbmltcG9ydCB7IENvbGxhcHNlZENlbGxPdXRwdXQgfSBmcm9tICcuLi9jZWxsUGFydHMvY29sbGFwc2VkQ2VsbE91dHB1dC5qcyc7XG5pbXBvcnQgeyBGb2xkZWRDZWxsSGludCB9IGZyb20gJy4uL2NlbGxQYXJ0cy9mb2xkZWRDZWxsSGludC5qcyc7XG5pbXBvcnQgeyBNYXJrdXBDZWxsIH0gZnJvbSAnLi4vY2VsbFBhcnRzL21hcmt1cENlbGwuanMnO1xuaW1wb3J0IHsgQ29kZUNlbGxSZW5kZXJUZW1wbGF0ZSwgTWFya2Rvd25DZWxsUmVuZGVyVGVtcGxhdGUgfSBmcm9tICcuLi9ub3RlYm9va1JlbmRlcmluZ0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9jb2RlQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBNYXJrdXBDZWxsVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vdmlld01vZGVsL21hcmt1cENlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9ub3RlYm9va1ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbEVkaXRvclBvb2wgfSBmcm9tICcuLi9ub3RlYm9va0NlbGxFZGl0b3JQb29sLmpzJztcblxuY29uc3QgJCA9IERPTS4kO1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDZWxsTGlzdERlbGVnYXRlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPENlbGxWaWV3TW9kZWw+IHtcblx0cHJpdmF0ZSByZWFkb25seSBsaW5lSGVpZ2h0OiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dGFyZ2V0V2luZG93OiBXaW5kb3csXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJyk7XG5cdFx0dGhpcy5saW5lSGVpZ2h0ID0gQmFyZUZvbnRJbmZvLmNyZWF0ZUZyb21SYXdTZXR0aW5ncyhlZGl0b3JPcHRpb25zLCBQaXhlbFJhdGlvLmdldEluc3RhbmNlKHRhcmdldFdpbmRvdykudmFsdWUpLmxpbmVIZWlnaHQ7XG5cdH1cblxuXHRnZXRIZWlnaHQoZWxlbWVudDogQ2VsbFZpZXdNb2RlbCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGVsZW1lbnQuZ2V0SGVpZ2h0KHRoaXMubGluZUhlaWdodCk7XG5cdH1cblxuXHRnZXREeW5hbWljSGVpZ2h0KGVsZW1lbnQ6IENlbGxWaWV3TW9kZWwpOiBudW1iZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWxlbWVudC5nZXREeW5hbWljSGVpZ2h0KCk7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IENlbGxWaWV3TW9kZWwpOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50LmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdHJldHVybiBNYXJrdXBDZWxsUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBDb2RlQ2VsbFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH1cblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENlbGxSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgZWRpdG9yT3B0aW9uczogQ2VsbEVkaXRvck9wdGlvbnM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0S2V5U2VydmljZVByb3ZpZGVyOiAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4gSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdGxhbmd1YWdlOiBzdHJpbmcsXG5cdFx0cHJvdGVjdGVkIGRuZENvbnRyb2xsZXI6IENlbGxEcmFnQW5kRHJvcENvbnRyb2xsZXIgfCB1bmRlZmluZWRcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVkaXRvck9wdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2VsbEVkaXRvck9wdGlvbnModGhpcy5ub3RlYm9va0VkaXRvci5nZXRCYXNlQ2VsbEVkaXRvck9wdGlvbnMobGFuZ3VhZ2UpLCB0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucywgY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZG5kQ29udHJvbGxlciA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFya3VwQ2VsbFJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RDZWxsUmVuZGVyZXIgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPE1hcmt1cENlbGxWaWV3TW9kZWwsIE1hcmtkb3duQ2VsbFJlbmRlclRlbXBsYXRlPiB7XG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdtYXJrZG93bl9jZWxsJztcblxuXHRwcml2YXRlIF9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRkbmRDb250cm9sbGVyOiBDZWxsRHJhZ0FuZERyb3BDb250cm9sbGVyLFxuXHRcdHByaXZhdGUgcmVuZGVyZWRFZGl0b3JzOiBNYXA8SUNlbGxWaWV3TW9kZWwsIElDb2RlRWRpdG9yPixcblx0XHRjb250ZXh0S2V5U2VydmljZVByb3ZpZGVyOiAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4gSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2Ugbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2U6IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpbnN0YW50aWF0aW9uU2VydmljZSwgbm90ZWJvb2tFZGl0b3IsIGNvbnRleHRNZW51U2VydmljZSwgbWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2VQcm92aWRlciwgJ21hcmtkb3duJywgZG5kQ29udHJvbGxlcik7XG5cdFx0dGhpcy5fbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgPSBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZTtcblx0fVxuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBNYXJrdXBDZWxsUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShyb290Q29udGFpbmVyOiBIVE1MRWxlbWVudCk6IE1hcmtkb3duQ2VsbFJlbmRlclRlbXBsYXRlIHtcblx0XHRyb290Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21hcmtkb3duLWNlbGwtcm93Jyk7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gRE9NLmFwcGVuZChyb290Q29udGFpbmVyLCBET00uJCgnLmNlbGwtaW5uZXItY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IHRlbXBsYXRlRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlUHJvdmlkZXIoY29udGFpbmVyKSk7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbkNvbnRhaW5lciA9IERPTS5hcHBlbmQocm9vdENvbnRhaW5lciwgJCgnLmNlbGwtZGVjb3JhdGlvbicpKTtcblx0XHRjb25zdCB0aXRsZVRvb2xiYXJDb250YWluZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmNlbGwtdGl0bGUtdG9vbGJhcicpKTtcblxuXHRcdGNvbnN0IGZvY3VzSW5kaWNhdG9yVG9wID0gbmV3IEZhc3REb21Ob2RlKERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1mb2N1cy1pbmRpY2F0b3IuY2VsbC1mb2N1cy1pbmRpY2F0b3ItdG9wJykpKTtcblx0XHRjb25zdCBmb2N1c0luZGljYXRvckxlZnQgPSBuZXcgRmFzdERvbU5vZGUoRE9NLmFwcGVuZChjb250YWluZXIsIERPTS4kKCcuY2VsbC1mb2N1cy1pbmRpY2F0b3IuY2VsbC1mb2N1cy1pbmRpY2F0b3Itc2lkZS5jZWxsLWZvY3VzLWluZGljYXRvci1sZWZ0JykpKTtcblx0XHRjb25zdCBmb2xkaW5nSW5kaWNhdG9yID0gRE9NLmFwcGVuZChmb2N1c0luZGljYXRvckxlZnQuZG9tTm9kZSwgRE9NLiQoJy5ub3RlYm9vay1mb2xkaW5nLWluZGljYXRvcicpKTtcblx0XHRjb25zdCBmb2N1c0luZGljYXRvclJpZ2h0ID0gbmV3IEZhc3REb21Ob2RlKERPTS5hcHBlbmQoY29udGFpbmVyLCBET00uJCgnLmNlbGwtZm9jdXMtaW5kaWNhdG9yLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXNpZGUuY2VsbC1mb2N1cy1pbmRpY2F0b3ItcmlnaHQnKSkpO1xuXG5cdFx0Y29uc3QgY29kZUlubmVyQ29udGVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC5jb2RlJykpO1xuXHRcdGNvbnN0IGVkaXRvclBhcnQgPSBET00uYXBwZW5kKGNvZGVJbm5lckNvbnRlbnQsICQoJy5jZWxsLWVkaXRvci1wYXJ0JykpO1xuXHRcdGNvbnN0IGNlbGxDaGF0UGFydCA9IERPTS5hcHBlbmQoZWRpdG9yUGFydCwgJCgnLmNlbGwtY2hhdC1wYXJ0JykpO1xuXHRcdGNvbnN0IGNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29kZUlubmVyQ29udGVudCwgJCgnLmlucHV0LWNvbGxhcHNlLWNvbnRhaW5lcicpKTtcblx0XHRjZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRjb25zdCBlZGl0b3JDb250YWluZXIgPSBET00uYXBwZW5kKGVkaXRvclBhcnQsICQoJy5jZWxsLWVkaXRvci1jb250YWluZXInKSk7XG5cdFx0ZWRpdG9yUGFydC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdGNvbnN0IGNlbGxDb21tZW50UGFydENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1jb21tZW50LWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBpbm5lckNvbnRlbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmNlbGwubWFya2Rvd24nKSk7XG5cdFx0Y29uc3QgYm90dG9tQ2VsbENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1ib3R0b20tdG9vbGJhci1jb250YWluZXInKSk7XG5cblx0XHRjb25zdCBzY29wZWRJbnN0YVNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZV0pKSk7XG5cdFx0Y29uc3Qgcm9vdENsYXNzRGVsZWdhdGUgPSB7XG5cdFx0XHR0b2dnbGU6IChjbGFzc05hbWU6IHN0cmluZywgZm9yY2U/OiBib29sZWFuKSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWUsIGZvcmNlKVxuXHRcdH07XG5cdFx0Y29uc3QgdGl0bGVUb29sYmFyID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q2VsbFRpdGxlVG9vbGJhclBhcnQsXG5cdFx0XHR0aXRsZVRvb2xiYXJDb250YWluZXIsXG5cdFx0XHRyb290Q2xhc3NEZWxlZ2F0ZSxcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHMuY2VsbFRpdGxlVG9vbGJhcixcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHMuY2VsbERlbGV0ZVRvb2xiYXIsXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yKSk7XG5cdFx0Y29uc3QgZm9jdXNJbmRpY2F0b3JCb3R0b20gPSBuZXcgRmFzdERvbU5vZGUoRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5jZWxsLWZvY3VzLWluZGljYXRvci5jZWxsLWZvY3VzLWluZGljYXRvci1ib3R0b20nKSkpO1xuXG5cdFx0Y29uc3QgY2VsbFBhcnRzID0gbmV3IENlbGxQYXJ0c0NvbGxlY3Rpb24oRE9NLmdldFdpbmRvdyhyb290Q29udGFpbmVyKSwgW1xuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxDaGF0UGFydCwgdGhpcy5ub3RlYm9va0VkaXRvciwgY2VsbENoYXRQYXJ0KSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbEVkaXRvclN0YXR1c0JhciwgdGhpcy5ub3RlYm9va0VkaXRvciwgY29udGFpbmVyLCBlZGl0b3JQYXJ0LCB1bmRlZmluZWQpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKG5ldyBDZWxsRm9jdXNJbmRpY2F0b3IodGhpcy5ub3RlYm9va0VkaXRvciwgdGl0bGVUb29sYmFyLCBmb2N1c0luZGljYXRvclRvcCwgZm9jdXNJbmRpY2F0b3JMZWZ0LCBmb2N1c0luZGljYXRvclJpZ2h0LCBmb2N1c0luZGljYXRvckJvdHRvbSkpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IEZvbGRlZENlbGxIaW50KHRoaXMubm90ZWJvb2tFZGl0b3IsIERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcubm90ZWJvb2stZm9sZGVkLWhpbnQnKSksIHRoaXMuX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgQ2VsbERlY29yYXRpb25zKHRoaXMubm90ZWJvb2tFZGl0b3IsIHJvb3RDb250YWluZXIsIGRlY29yYXRpb25Db250YWluZXIpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDZWxsQ29tbWVudHMsIHRoaXMubm90ZWJvb2tFZGl0b3IsIGNlbGxDb21tZW50UGFydENvbnRhaW5lcikpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IENvbGxhcHNlZENlbGxJbnB1dCh0aGlzLm5vdGVib29rRWRpdG9yLCBjZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKG5ldyBDZWxsRm9jdXNQYXJ0KGNvbnRhaW5lciwgdW5kZWZpbmVkLCB0aGlzLm5vdGVib29rRWRpdG9yKSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgQ2VsbERyYWdBbmREcm9wUGFydChjb250YWluZXIpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDZWxsQ29udGV4dEtleVBhcnQsIHRoaXMubm90ZWJvb2tFZGl0b3IpKSxcblx0XHRdLCBbXG5cdFx0XHR0aXRsZVRvb2xiYXIsXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQmV0d2VlbkNlbGxUb29sYmFyLCB0aGlzLm5vdGVib29rRWRpdG9yLCB0aXRsZVRvb2xiYXJDb250YWluZXIsIGJvdHRvbUNlbGxDb250YWluZXIpKVxuXHRcdF0pO1xuXG5cdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoY2VsbFBhcnRzKTtcblxuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YTogTWFya2Rvd25DZWxsUmVuZGVyVGVtcGxhdGUgPSB7XG5cdFx0XHRyb290Q29udGFpbmVyLFxuXHRcdFx0Y2VsbElucHV0Q29sbGFwc2VkQ29udGFpbmVyLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHNjb3BlZEluc3RhU2VydmljZSxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdGNlbGxDb250YWluZXI6IGlubmVyQ29udGVudCxcblx0XHRcdGVkaXRvclBhcnQsXG5cdFx0XHRlZGl0b3JDb250YWluZXIsXG5cdFx0XHRmb2xkaW5nSW5kaWNhdG9yLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcyxcblx0XHRcdGVsZW1lbnREaXNwb3NhYmxlczogdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSxcblx0XHRcdGNlbGxQYXJ0cyxcblx0XHRcdHRvSlNPTjogKCkgPT4geyByZXR1cm4ge307IH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRlbXBsYXRlRGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogTWFya3VwQ2VsbFZpZXdNb2RlbCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBNYXJrZG93bkNlbGxSZW5kZXJUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgbm90ZWJvb2sgZWRpdG9yIGlzIG5vdCBhdHRhY2hlZCB3aXRoIHZpZXcgbW9kZWwgeWV0LicpO1xuXHRcdH1cblxuXHRcdHRlbXBsYXRlRGF0YS5jdXJyZW50UmVuZGVyZWRDZWxsID0gZWxlbWVudDtcblx0XHR0ZW1wbGF0ZURhdGEuY3VycmVudEVkaXRvciA9IHVuZGVmaW5lZDtcblx0XHR0ZW1wbGF0ZURhdGEuZWRpdG9yUGFydC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRlbXBsYXRlRGF0YS5jZWxsQ29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0aWYgKGhlaWdodCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGVtcGxhdGVEYXRhLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmt1cENlbGwsIHRoaXMubm90ZWJvb2tFZGl0b3IsIGVsZW1lbnQsIHRlbXBsYXRlRGF0YSwgdGhpcy5yZW5kZXJlZEVkaXRvcnMpKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IE1hcmtkb3duQ2VsbFJlbmRlclRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoX2VsZW1lbnQ6IElDZWxsVmlld01vZGVsLCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBNYXJrZG93bkNlbGxSZW5kZXJUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29kZUNlbGxSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0Q2VsbFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxDb2RlQ2VsbFZpZXdNb2RlbCwgQ29kZUNlbGxSZW5kZXJUZW1wbGF0ZT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnY29kZV9jZWxsJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZW5kZXJlZEVkaXRvcnM6IE1hcDxJQ2VsbFZpZXdNb2RlbCwgSUNvZGVFZGl0b3I+LFxuXHRcdHByaXZhdGUgZWRpdG9yUG9vbDogTm90ZWJvb2tDZWxsRWRpdG9yUG9vbCxcblx0XHRkbmRDb250cm9sbGVyOiBDZWxsRHJhZ0FuZERyb3BDb250cm9sbGVyLFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlUHJvdmlkZXI6IChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiBJU2NvcGVkQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBub3RlYm9va0VkaXRvciwgY29udGV4dE1lbnVTZXJ2aWNlLCBtZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZVByb3ZpZGVyLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQsIGRuZENvbnRyb2xsZXIpO1xuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIENvZGVDZWxsUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShyb290Q29udGFpbmVyOiBIVE1MRWxlbWVudCk6IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUge1xuXHRcdHJvb3RDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY29kZS1jZWxsLXJvdycpO1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IERPTS5hcHBlbmQocm9vdENvbnRhaW5lciwgRE9NLiQoJy5jZWxsLWlubmVyLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZVByb3ZpZGVyKGNvbnRhaW5lcikpO1xuXHRcdGNvbnN0IGRlY29yYXRpb25Db250YWluZXIgPSBET00uYXBwZW5kKHJvb3RDb250YWluZXIsICQoJy5jZWxsLWRlY29yYXRpb24nKSk7XG5cdFx0Y29uc3QgZm9jdXNJbmRpY2F0b3JUb3AgPSBuZXcgRmFzdERvbU5vZGUoRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5jZWxsLWZvY3VzLWluZGljYXRvci5jZWxsLWZvY3VzLWluZGljYXRvci10b3AnKSkpO1xuXHRcdGNvbnN0IHRpdGxlVG9vbGJhckNvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC10aXRsZS10b29sYmFyJykpO1xuXG5cdFx0Ly8gVGhpcyBpcyBhbHNvIHRoZSBkcmFnIGhhbmRsZVxuXHRcdGNvbnN0IGZvY3VzSW5kaWNhdG9yTGVmdCA9IG5ldyBGYXN0RG9tTm9kZShET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5jZWxsLWZvY3VzLWluZGljYXRvci5jZWxsLWZvY3VzLWluZGljYXRvci1zaWRlLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQnKSkpO1xuXHRcdGNvbnN0IGNlbGxDaGF0UGFydCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1jaGF0LXBhcnQnKSk7XG5cdFx0Y29uc3QgY2VsbENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC5jb2RlJykpO1xuXHRcdGNvbnN0IHJ1bkJ1dHRvbkNvbnRhaW5lciA9IERPTS5hcHBlbmQoY2VsbENvbnRhaW5lciwgJCgnLnJ1bi1idXR0b24tY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGNlbGxJbnB1dENvbGxhcHNlZENvbnRhaW5lciA9IERPTS5hcHBlbmQoY2VsbENvbnRhaW5lciwgJCgnLmlucHV0LWNvbGxhcHNlLWNvbnRhaW5lcicpKTtcblx0XHRjZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRjb25zdCBleGVjdXRpb25PcmRlckxhYmVsID0gRE9NLmFwcGVuZChmb2N1c0luZGljYXRvckxlZnQuZG9tTm9kZSwgJCgnZGl2LmV4ZWN1dGlvbi1jb3VudC1sYWJlbCcpKTtcblx0XHRleGVjdXRpb25PcmRlckxhYmVsLnRpdGxlID0gbG9jYWxpemUoJ2NlbGxFeGVjdXRpb25PcmRlckNvdW50TGFiZWwnLCAnRXhlY3V0aW9uIE9yZGVyJyk7XG5cdFx0Y29uc3QgZWRpdG9yUGFydCA9IERPTS5hcHBlbmQoY2VsbENvbnRhaW5lciwgJCgnLmNlbGwtZWRpdG9yLXBhcnQnKSk7XG5cdFx0Y29uc3QgZWRpdG9yQ29udGFpbmVyID0gRE9NLmFwcGVuZChlZGl0b3JQYXJ0LCAkKCcuY2VsbC1lZGl0b3ItY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGNlbGxDb21tZW50UGFydENvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1jb21tZW50LWNvbnRhaW5lcicpKTtcblxuXHRcdC8vIGNyZWF0ZSBhIHNwZWNpYWwgY29udGV4dCBrZXkgc2VydmljZSB0aGF0IHNldCB0aGUgaW5Db21wb3NpdGVFZGl0b3ItY29udGV4dGtleVxuXHRcdGNvbnN0IGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZVByb3ZpZGVyKGVkaXRvclBhcnQpKTtcblx0XHRjb25zdCBlZGl0b3JJbnN0YVNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBlZGl0b3JDb250ZXh0S2V5U2VydmljZV0pKSk7XG5cdFx0RWRpdG9yQ29udGV4dEtleXMuaW5Db21wb3NpdGVFZGl0b3IuYmluZFRvKGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBlZGl0b3JJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29kZUVkaXRvcldpZGdldCwgZWRpdG9yQ29udGFpbmVyLCB7XG5cdFx0XHQuLi50aGlzLmVkaXRvck9wdGlvbnMuZ2V0RGVmYXVsdFZhbHVlKCksXG5cdFx0XHRkaW1lbnNpb246IHtcblx0XHRcdFx0d2lkdGg6IDAsXG5cdFx0XHRcdGhlaWdodDogMFxuXHRcdFx0fSxcblx0XHRcdHNjcm9sbGJhcjoge1xuXHRcdFx0XHR2ZXJ0aWNhbDogJ2hpZGRlbicsXG5cdFx0XHRcdGhvcml6b250YWw6ICdhdXRvJyxcblx0XHRcdFx0aGFuZGxlTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdHVzZVNoYWRvd3M6IGZhbHNlLFxuXHRcdFx0fSxcblx0XHR9LCB7XG5cdFx0XHRjb250cmlidXRpb25zOiB0aGlzLm5vdGVib29rRWRpdG9yLmNyZWF0aW9uT3B0aW9ucy5jZWxsRWRpdG9yQ29udHJpYnV0aW9uc1xuXHRcdH0pO1xuXG5cdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZWRpdG9yKTtcblxuXHRcdGNvbnN0IG91dHB1dENvbnRhaW5lciA9IG5ldyBGYXN0RG9tTm9kZShET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm91dHB1dCcpKSk7XG5cdFx0Y29uc3QgY2VsbE91dHB1dENvbGxhcHNlZENvbnRhaW5lciA9IERPTS5hcHBlbmQob3V0cHV0Q29udGFpbmVyLmRvbU5vZGUsICQoJy5vdXRwdXQtY29sbGFwc2UtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IG91dHB1dFNob3dNb3JlQ29udGFpbmVyID0gbmV3IEZhc3REb21Ob2RlKERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcub3V0cHV0LXNob3ctbW9yZS1jb250YWluZXInKSkpO1xuXHRcdGNvbnN0IGZvY3VzSW5kaWNhdG9yUmlnaHQgPSBuZXcgRmFzdERvbU5vZGUoRE9NLmFwcGVuZChjb250YWluZXIsIERPTS4kKCcuY2VsbC1mb2N1cy1pbmRpY2F0b3IuY2VsbC1mb2N1cy1pbmRpY2F0b3Itc2lkZS5jZWxsLWZvY3VzLWluZGljYXRvci1yaWdodCcpKSk7XG5cdFx0Y29uc3QgZm9jdXNTaW5rRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY2VsbC1lZGl0b3ItZm9jdXMtc2luaycpKTtcblx0XHRmb2N1c1NpbmtFbGVtZW50LnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXHRcdGNvbnN0IGJvdHRvbUNlbGxUb29sYmFyQ29udGFpbmVyID0gRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5jZWxsLWJvdHRvbS10b29sYmFyLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBmb2N1c0luZGljYXRvckJvdHRvbSA9IG5ldyBGYXN0RG9tTm9kZShET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmNlbGwtZm9jdXMtaW5kaWNhdG9yLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWJvdHRvbScpKSk7XG5cblx0XHRjb25zdCBzY29wZWRJbnN0YVNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZV0pKSk7XG5cdFx0Y29uc3Qgcm9vdENsYXNzRGVsZWdhdGUgPSB7XG5cdFx0XHR0b2dnbGU6IChjbGFzc05hbWU6IHN0cmluZywgZm9yY2U/OiBib29sZWFuKSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWUsIGZvcmNlKVxuXHRcdH07XG5cdFx0Y29uc3QgdGl0bGVUb29sYmFyID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q2VsbFRpdGxlVG9vbGJhclBhcnQsXG5cdFx0XHR0aXRsZVRvb2xiYXJDb250YWluZXIsXG5cdFx0XHRyb290Q2xhc3NEZWxlZ2F0ZSxcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHMuY2VsbFRpdGxlVG9vbGJhcixcblx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHMuY2VsbERlbGV0ZVRvb2xiYXIsXG5cdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yKSk7XG5cblx0XHRjb25zdCBmb2N1c0luZGljYXRvclBhcnQgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgQ2VsbEZvY3VzSW5kaWNhdG9yKHRoaXMubm90ZWJvb2tFZGl0b3IsIHRpdGxlVG9vbGJhciwgZm9jdXNJbmRpY2F0b3JUb3AsIGZvY3VzSW5kaWNhdG9yTGVmdCwgZm9jdXNJbmRpY2F0b3JSaWdodCwgZm9jdXNJbmRpY2F0b3JCb3R0b20pKTtcblx0XHRjb25zdCBjb250ZW50UGFydHMgPSBbXG5cdFx0XHRmb2N1c0luZGljYXRvclBhcnQsXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbENoYXRQYXJ0LCB0aGlzLm5vdGVib29rRWRpdG9yLCBjZWxsQ2hhdFBhcnQpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDZWxsRWRpdG9yU3RhdHVzQmFyLCB0aGlzLm5vdGVib29rRWRpdG9yLCBjb250YWluZXIsIGVkaXRvclBhcnQsIGVkaXRvcikpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxQcm9ncmVzc0JhciwgZWRpdG9yUGFydCwgY2VsbElucHV0Q29sbGFwc2VkQ29udGFpbmVyKSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgQ2VsbERlY29yYXRpb25zKHRoaXMubm90ZWJvb2tFZGl0b3IsIHJvb3RDb250YWluZXIsIGRlY29yYXRpb25Db250YWluZXIpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDZWxsQ29tbWVudHMsIHRoaXMubm90ZWJvb2tFZGl0b3IsIGNlbGxDb21tZW50UGFydENvbnRhaW5lcikpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxFeGVjdXRpb25QYXJ0LCB0aGlzLm5vdGVib29rRWRpdG9yLCBleGVjdXRpb25PcmRlckxhYmVsKSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29sbGFwc2VkQ2VsbE91dHB1dCwgdGhpcy5ub3RlYm9va0VkaXRvciwgY2VsbE91dHB1dENvbGxhcHNlZENvbnRhaW5lcikpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IENvbGxhcHNlZENlbGxJbnB1dCh0aGlzLm5vdGVib29rRWRpdG9yLCBjZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIpKSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKG5ldyBDZWxsRm9jdXNQYXJ0KGNvbnRhaW5lciwgZm9jdXNTaW5rRWxlbWVudCwgdGhpcy5ub3RlYm9va0VkaXRvcikpLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IENlbGxEcmFnQW5kRHJvcFBhcnQoY29udGFpbmVyKSksXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbENvbnRleHRLZXlQYXJ0LCB0aGlzLm5vdGVib29rRWRpdG9yKSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IHsgY2VsbEV4ZWN1dGVQcmltYXJ5LCBjZWxsRXhlY3V0ZVRvb2xiYXIgfSA9IHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHM7XG5cdFx0aWYgKGNlbGxFeGVjdXRlUHJpbWFyeSAmJiBjZWxsRXhlY3V0ZVRvb2xiYXIpIHtcblx0XHRcdGNvbnRlbnRQYXJ0cy5wdXNoKHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHRzY29wZWRJbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUnVuVG9vbGJhciwgdGhpcy5ub3RlYm9va0VkaXRvciwgY29udGV4dEtleVNlcnZpY2UsIGNvbnRhaW5lciwgcnVuQnV0dG9uQ29udGFpbmVyLCBjZWxsRXhlY3V0ZVByaW1hcnksIGNlbGxFeGVjdXRlVG9vbGJhcilcblx0XHRcdCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGxQYXJ0cyA9IG5ldyBDZWxsUGFydHNDb2xsZWN0aW9uKERPTS5nZXRXaW5kb3cocm9vdENvbnRhaW5lciksIGNvbnRlbnRQYXJ0cywgW1xuXHRcdFx0dGl0bGVUb29sYmFyLFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJldHdlZW5DZWxsVG9vbGJhciwgdGhpcy5ub3RlYm9va0VkaXRvciwgdGl0bGVUb29sYmFyQ29udGFpbmVyLCBib3R0b21DZWxsVG9vbGJhckNvbnRhaW5lcikpXG5cdFx0XSk7XG5cblx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChjZWxsUGFydHMpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGVEYXRhOiBDb2RlQ2VsbFJlbmRlclRlbXBsYXRlID0ge1xuXHRcdFx0cm9vdENvbnRhaW5lcixcblx0XHRcdGVkaXRvclBhcnQsXG5cdFx0XHRjZWxsSW5wdXRDb2xsYXBzZWRDb250YWluZXIsXG5cdFx0XHRjZWxsT3V0cHV0Q29sbGFwc2VkQ29udGFpbmVyLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHNjb3BlZEluc3RhU2VydmljZSxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdGNlbGxDb250YWluZXIsXG5cdFx0XHRmb2N1c1NpbmtFbGVtZW50LFxuXHRcdFx0b3V0cHV0Q29udGFpbmVyLFxuXHRcdFx0b3V0cHV0U2hvd01vcmVDb250YWluZXIsXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHR0ZW1wbGF0ZURpc3Bvc2FibGVzLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzOiB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpLFxuXHRcdFx0Y2VsbFBhcnRzLFxuXHRcdFx0dG9KU09OOiAoKSA9PiB7IHJldHVybiB7fTsgfVxuXHRcdH07XG5cblx0XHQvLyBmb2N1c0luZGljYXRvckxlZnQgY292ZXJzIHRoZSBsZWZ0IG1hcmdpbiBhcmVhXG5cdFx0Ly8gY29kZS9vdXRwdXRGb2N1c0luZGljYXRvciBuZWVkIHRvIGJlIHJlZ2lzdGVyZWQgYXMgZHJhZyBoYW5kbGVycyBzbyB0aGVpciBjbGljayBoYW5kbGVycyBkb24ndCB0YWtlIG92ZXJcblx0XHRjb25zdCBkcmFnSGFuZGxlcyA9IFtmb2N1c0luZGljYXRvckxlZnQuZG9tTm9kZSwgZm9jdXNJbmRpY2F0b3JQYXJ0LmNvZGVGb2N1c0luZGljYXRvci5kb21Ob2RlLCBmb2N1c0luZGljYXRvclBhcnQub3V0cHV0Rm9jdXNJbmRpY2F0b3IuZG9tTm9kZV07XG5cdFx0dGhpcy5kbmRDb250cm9sbGVyPy5yZWdpc3RlckRyYWdIYW5kbGUodGVtcGxhdGVEYXRhLCByb290Q29udGFpbmVyLCBkcmFnSGFuZGxlcywgKCkgPT4gbmV3IENvZGVDZWxsRHJhZ0ltYWdlUmVuZGVyZXIoKS5nZXREcmFnSW1hZ2UodGVtcGxhdGVEYXRhLCB0ZW1wbGF0ZURhdGEuZWRpdG9yLCAnY29kZScpKTtcblx0XHRyZXR1cm4gdGVtcGxhdGVEYXRhO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBDb2RlQ2VsbFZpZXdNb2RlbCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBDb2RlQ2VsbFJlbmRlclRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBub3RlYm9vayBlZGl0b3IgaXMgbm90IGF0dGFjaGVkIHdpdGggdmlldyBtb2RlbCB5ZXQuJyk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLmN1cnJlbnRSZW5kZXJlZENlbGwgPSBlbGVtZW50O1xuXG5cdFx0aWYgKGhlaWdodCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLm91dHB1dENvbnRhaW5lci5kb21Ob2RlLmlubmVyVGV4dCA9ICcnO1xuXHRcdHRlbXBsYXRlRGF0YS5vdXRwdXRDb250YWluZXIuZG9tTm9kZS5hcHBlbmRDaGlsZCh0ZW1wbGF0ZURhdGEuY2VsbE91dHB1dENvbGxhcHNlZENvbnRhaW5lcik7XG5cblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0ZW1wbGF0ZURhdGEuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29kZUNlbGwsIHRoaXMubm90ZWJvb2tFZGl0b3IsIGVsZW1lbnQsIHRlbXBsYXRlRGF0YSwgdGhpcy5lZGl0b3JQb29sKSk7XG5cdFx0dGhpcy5yZW5kZXJlZEVkaXRvcnMuc2V0KGVsZW1lbnQsIHRlbXBsYXRlRGF0YS5lZGl0b3IpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogQ29kZUNlbGxSZW5kZXJUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElDZWxsVmlld01vZGVsLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IENvZGVDZWxsUmVuZGVyVGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMucmVuZGVyZWRFZGl0b3JzLmRlbGV0ZShlbGVtZW50KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixZQUFZLFNBQVM7QUFDckIsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUyxZQUFZLHVCQUF1QjtBQUU1QyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUFvRDtBQUM3RCxT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
