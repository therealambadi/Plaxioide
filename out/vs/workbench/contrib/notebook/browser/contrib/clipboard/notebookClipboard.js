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
import { localize, localize2 } from "../../../../../../nls.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../../common/contributions.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { NOTEBOOK_CELL_EDITABLE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED } from "../../../common/notebookContextKeys.js";
import { cellRangeToViewCells, expandCellRangesWithHiddenCells, getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { CopyAction, CutAction, PasteAction } from "../../../../../../editor/contrib/clipboard/browser/clipboard.js";
import { IClipboardService } from "../../../../../../platform/clipboard/common/clipboardService.js";
import { cloneNotebookCellTextModel } from "../../../common/model/notebookCellTextModel.js";
import { CellEditType, SelectionStateType } from "../../../common/notebookCommon.js";
import { INotebookService } from "../../../common/notebookService.js";
import * as platform from "../../../../../../base/common/platform.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { CellOverflowToolbarGroups, NotebookAction, NotebookCellAction, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, NOTEBOOK_OUTPUT_WEBVIEW_ACTION_WEIGHT } from "../../controller/coreActions.js";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContextKey } from "../../../../../../platform/contextkey/common/contextkeys.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { RedoCommand, UndoCommand } from "../../../../../../editor/browser/editorExtensions.js";
import { Categories } from "../../../../../../platform/action/common/actionCommonCategories.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { showWindowLogActionId } from "../../../../../services/log/common/logConstants.js";
import { getActiveElement, getWindow, isAncestor, isEditableElement, isHTMLElement } from "../../../../../../base/browser/dom.js";
let _logging = false;
function toggleLogging() {
  _logging = !_logging;
}
function _log(loggerService, str) {
  if (_logging) {
    loggerService.info(`[NotebookClipboard]: ${str}`);
  }
}
function getFocusedEditor(accessor) {
  const loggerService = accessor.get(ILogService);
  const editorService = accessor.get(IEditorService);
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!editor) {
    _log(loggerService, "[Revive Webview] No notebook editor found for active editor pane, bypass");
    return;
  }
  if (!editor.hasEditorFocus()) {
    _log(loggerService, "[Revive Webview] Notebook editor is not focused, bypass");
    return;
  }
  if (!editor.hasWebviewFocus()) {
    _log(loggerService, "[Revive Webview] Notebook editor backlayer webview is not focused, bypass");
    return;
  }
  const view = editor.getViewModel();
  if (view && view.viewCells.every((cell) => !cell.outputIsFocused && !cell.outputIsHovered)) {
    return;
  }
  return { editor, loggerService };
}
function getFocusedWebviewDelegate(accessor) {
  const result = getFocusedEditor(accessor);
  if (!result) {
    return;
  }
  const webview = result.editor.getInnerWebview();
  _log(result.loggerService, "[Revive Webview] Notebook editor backlayer webview is focused");
  return webview;
}
function withWebview(accessor, f) {
  const webview = getFocusedWebviewDelegate(accessor);
  if (webview) {
    f(webview);
    return true;
  }
  return false;
}
function withEditor(accessor, f) {
  const result = getFocusedEditor(accessor);
  return result ? f(result.editor) : false;
}
const PRIORITY = 105;
UndoCommand.addImplementation(PRIORITY, "notebook-webview", (accessor) => {
  return withWebview(accessor, (webview) => webview.undo());
});
RedoCommand.addImplementation(PRIORITY, "notebook-webview", (accessor) => {
  return withWebview(accessor, (webview) => webview.redo());
});
CopyAction?.addImplementation(PRIORITY, "notebook-webview", (accessor) => {
  return withWebview(accessor, (webview) => webview.copy());
});
PasteAction?.addImplementation(PRIORITY, "notebook-webview", (accessor) => {
  return withWebview(accessor, (webview) => webview.paste());
});
CutAction?.addImplementation(PRIORITY, "notebook-webview", (accessor) => {
  return withWebview(accessor, (webview) => webview.cut());
});
function runPasteCells(editor, activeCell, pasteCells) {
  if (!editor.hasModel()) {
    return false;
  }
  const textModel = editor.textModel;
  if (editor.isReadOnly) {
    return false;
  }
  const originalState = {
    kind: SelectionStateType.Index,
    focus: editor.getFocus(),
    selections: editor.getSelections()
  };
  if (activeCell) {
    const currCellIndex = editor.getCellIndex(activeCell);
    const newFocusIndex = typeof currCellIndex === "number" ? currCellIndex + 1 : 0;
    textModel.applyEdits([
      {
        editType: CellEditType.Replace,
        index: newFocusIndex,
        count: 0,
        cells: pasteCells.items.map((cell) => cloneNotebookCellTextModel(cell))
      }
    ], true, originalState, () => ({
      kind: SelectionStateType.Index,
      focus: { start: newFocusIndex, end: newFocusIndex + 1 },
      selections: [{ start: newFocusIndex, end: newFocusIndex + pasteCells.items.length }]
    }), void 0, true);
  } else {
    if (editor.getLength() !== 0) {
      return false;
    }
    textModel.applyEdits([
      {
        editType: CellEditType.Replace,
        index: 0,
        count: 0,
        cells: pasteCells.items.map((cell) => cloneNotebookCellTextModel(cell))
      }
    ], true, originalState, () => ({
      kind: SelectionStateType.Index,
      focus: { start: 0, end: 1 },
      selections: [{ start: 1, end: pasteCells.items.length + 1 }]
    }), void 0, true);
  }
  return true;
}
function runCopyCells(accessor, editor, targetCell) {
  if (!editor.hasModel()) {
    return false;
  }
  if (editor.hasOutputTextSelection()) {
    getWindow(editor.getDomNode()).document.execCommand("copy");
    return true;
  }
  const clipboardService = accessor.get(IClipboardService);
  const notebookService = accessor.get(INotebookService);
  const selections = editor.getSelections();
  if (targetCell) {
    const targetCellIndex = editor.getCellIndex(targetCell);
    const containingSelection = selections.find((selection) => selection.start <= targetCellIndex && targetCellIndex < selection.end);
    if (!containingSelection) {
      clipboardService.writeText(targetCell.getText());
      notebookService.setToCopy([targetCell.model], true);
      return true;
    }
  }
  const selectionRanges = expandCellRangesWithHiddenCells(editor, editor.getSelections());
  const selectedCells = cellRangeToViewCells(editor, selectionRanges);
  if (!selectedCells.length) {
    return false;
  }
  clipboardService.writeText(selectedCells.map((cell) => cell.getText()).join("\n"));
  notebookService.setToCopy(selectedCells.map((cell) => cell.model), true);
  return true;
}
function runCutCells(accessor, editor, targetCell) {
  if (!editor.hasModel() || editor.isReadOnly) {
    return false;
  }
  const textModel = editor.textModel;
  const clipboardService = accessor.get(IClipboardService);
  const notebookService = accessor.get(INotebookService);
  const selections = editor.getSelections();
  if (targetCell) {
    const targetCellIndex = editor.getCellIndex(targetCell);
    const containingSelection2 = selections.find((selection) => selection.start <= targetCellIndex && targetCellIndex < selection.end);
    if (!containingSelection2) {
      clipboardService.writeText(targetCell.getText());
      const focus2 = editor.getFocus();
      const newFocus = focus2.end <= targetCellIndex ? focus2 : { start: focus2.start - 1, end: focus2.end - 1 };
      const newSelections = selections.map((selection) => selection.end <= targetCellIndex ? selection : { start: selection.start - 1, end: selection.end - 1 });
      textModel.applyEdits([
        { editType: CellEditType.Replace, index: targetCellIndex, count: 1, cells: [] }
      ], true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections }, () => ({ kind: SelectionStateType.Index, focus: newFocus, selections: newSelections }), void 0, true);
      notebookService.setToCopy([targetCell.model], false);
      return true;
    }
  }
  const focus = editor.getFocus();
  const containingSelection = selections.find((selection) => selection.start <= focus.start && focus.end <= selection.end);
  if (!containingSelection) {
    const targetCell2 = editor.cellAt(focus.start);
    clipboardService.writeText(targetCell2.getText());
    const newFocus = focus.end === editor.getLength() ? { start: focus.start - 1, end: focus.end - 1 } : focus;
    const newSelections = selections.map((selection) => selection.end <= focus.start ? selection : { start: selection.start - 1, end: selection.end - 1 });
    textModel.applyEdits([
      { editType: CellEditType.Replace, index: focus.start, count: 1, cells: [] }
    ], true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections }, () => ({ kind: SelectionStateType.Index, focus: newFocus, selections: newSelections }), void 0, true);
    notebookService.setToCopy([targetCell2.model], false);
    return true;
  }
  const selectionRanges = expandCellRangesWithHiddenCells(editor, editor.getSelections());
  const selectedCells = cellRangeToViewCells(editor, selectionRanges);
  if (!selectedCells.length) {
    return false;
  }
  clipboardService.writeText(selectedCells.map((cell) => cell.getText()).join("\n"));
  const edits = selectionRanges.map((range) => ({ editType: CellEditType.Replace, index: range.start, count: range.end - range.start, cells: [] }));
  const firstSelectIndex = selectionRanges[0].start;
  const newFocusedCellIndex = firstSelectIndex < textModel.cells.length - 1 ? firstSelectIndex : Math.max(textModel.cells.length - 2, 0);
  textModel.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections: selectionRanges }, () => {
    return {
      kind: SelectionStateType.Index,
      focus: { start: newFocusedCellIndex, end: newFocusedCellIndex + 1 },
      selections: [{ start: newFocusedCellIndex, end: newFocusedCellIndex + 1 }]
    };
  }, void 0, true);
  notebookService.setToCopy(selectedCells.map((cell) => cell.model), false);
  return true;
}
let NotebookClipboardContribution = class extends Disposable {
  constructor(_editorService) {
    super();
    this._editorService = _editorService;
    const PRIORITY2 = 105;
    if (CopyAction) {
      this._register(CopyAction.addImplementation(PRIORITY2, "notebook-clipboard", (accessor) => {
        return this.runCopyAction(accessor);
      }));
    }
    if (PasteAction) {
      this._register(PasteAction.addImplementation(PRIORITY2, "notebook-clipboard", (accessor) => {
        return this.runPasteAction(accessor);
      }));
    }
    if (CutAction) {
      this._register(CutAction.addImplementation(PRIORITY2, "notebook-clipboard", (accessor) => {
        return this.runCutAction(accessor);
      }));
    }
  }
  _getContext() {
    const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    const activeCell = editor?.getActiveCell();
    return {
      editor,
      activeCell
    };
  }
  _focusInsideEmebedMonaco(editor) {
    const windowSelection = getWindow(editor.getDomNode()).getSelection();
    if (windowSelection?.rangeCount !== 1) {
      return false;
    }
    const activeSelection = windowSelection.getRangeAt(0);
    if (activeSelection.startContainer === activeSelection.endContainer && activeSelection.endOffset - activeSelection.startOffset === 0) {
      return false;
    }
    let container = activeSelection.commonAncestorContainer;
    const body = editor.getDomNode();
    if (!body.contains(container)) {
      return false;
    }
    while (container && container !== body) {
      if (container.classList && container.classList.contains("monaco-editor")) {
        return true;
      }
      container = container.parentNode;
    }
    return false;
  }
  runCopyAction(accessor) {
    const loggerService = accessor.get(ILogService);
    const activeElement = getActiveElement();
    if (isHTMLElement(activeElement) && isEditableElement(activeElement)) {
      _log(loggerService, "[NotebookEditor] focus is on input or textarea element, bypass");
      return false;
    }
    const { editor } = this._getContext();
    if (!editor) {
      _log(loggerService, "[NotebookEditor] no active notebook editor, bypass");
      return false;
    }
    if (!isAncestor(activeElement, editor.getDomNode())) {
      _log(loggerService, "[NotebookEditor] focus is outside of the notebook editor, bypass");
      return false;
    }
    if (this._focusInsideEmebedMonaco(editor)) {
      _log(loggerService, "[NotebookEditor] focus is on embed monaco editor, bypass");
      return false;
    }
    _log(loggerService, "[NotebookEditor] run copy actions on notebook model");
    return runCopyCells(accessor, editor, void 0);
  }
  runPasteAction(accessor) {
    const activeElement = getActiveElement();
    if (activeElement && isEditableElement(activeElement)) {
      return false;
    }
    const notebookService = accessor.get(INotebookService);
    const pasteCells = notebookService.getToCopy();
    if (!pasteCells) {
      return false;
    }
    const { editor, activeCell } = this._getContext();
    if (!editor) {
      return false;
    }
    return runPasteCells(editor, activeCell, pasteCells);
  }
  runCutAction(accessor) {
    const activeElement = getActiveElement();
    if (activeElement && isEditableElement(activeElement)) {
      return false;
    }
    const { editor } = this._getContext();
    if (!editor) {
      return false;
    }
    return runCutCells(accessor, editor, void 0);
  }
};
NotebookClipboardContribution.ID = "workbench.contrib.notebookClipboard";
NotebookClipboardContribution = __decorateClass([
  __decorateParam(0, IEditorService)
], NotebookClipboardContribution);
registerWorkbenchContribution2(NotebookClipboardContribution.ID, NotebookClipboardContribution, WorkbenchPhase.BlockRestore);
const COPY_CELL_COMMAND_ID = "notebook.cell.copy";
const CUT_CELL_COMMAND_ID = "notebook.cell.cut";
const PASTE_CELL_COMMAND_ID = "notebook.cell.paste";
const PASTE_CELL_ABOVE_COMMAND_ID = "notebook.cell.pasteAbove";
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: COPY_CELL_COMMAND_ID,
        title: localize("notebookActions.copy", "Copy Cell"),
        menu: {
          id: MenuId.NotebookCellTitle,
          when: NOTEBOOK_EDITOR_FOCUSED,
          group: CellOverflowToolbarGroups.Copy,
          order: 2
        },
        keybinding: platform.isNative ? void 0 : {
          primary: KeyMod.CtrlCmd | KeyCode.KeyC,
          win: { primary: KeyMod.CtrlCmd | KeyCode.KeyC, secondary: [KeyMod.CtrlCmd | KeyCode.Insert] },
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
          weight: KeybindingWeight.WorkbenchContrib
        }
      }
    );
  }
  async runWithContext(accessor, context) {
    runCopyCells(accessor, context.notebookEditor, context.cell);
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: CUT_CELL_COMMAND_ID,
        title: localize("notebookActions.cut", "Cut Cell"),
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
          group: CellOverflowToolbarGroups.Copy,
          order: 1
        },
        keybinding: platform.isNative ? void 0 : {
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
          primary: KeyMod.CtrlCmd | KeyCode.KeyX,
          win: { primary: KeyMod.CtrlCmd | KeyCode.KeyX, secondary: [KeyMod.Shift | KeyCode.Delete] },
          weight: KeybindingWeight.WorkbenchContrib
        }
      }
    );
  }
  async runWithContext(accessor, context) {
    runCutCells(accessor, context.notebookEditor, context.cell);
  }
});
registerAction2(class extends NotebookAction {
  constructor() {
    super(
      {
        id: PASTE_CELL_COMMAND_ID,
        title: localize("notebookActions.paste", "Paste Cell"),
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE),
          group: CellOverflowToolbarGroups.Copy,
          order: 3
        },
        keybinding: platform.isNative ? void 0 : {
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
          primary: KeyMod.CtrlCmd | KeyCode.KeyV,
          win: { primary: KeyMod.CtrlCmd | KeyCode.KeyV, secondary: [KeyMod.Shift | KeyCode.Insert] },
          linux: { primary: KeyMod.CtrlCmd | KeyCode.KeyV, secondary: [KeyMod.Shift | KeyCode.Insert] },
          weight: KeybindingWeight.EditorContrib
        }
      }
    );
  }
  async runWithContext(accessor, context) {
    const notebookService = accessor.get(INotebookService);
    const pasteCells = notebookService.getToCopy();
    if (!context.notebookEditor.hasModel() || context.notebookEditor.isReadOnly) {
      return;
    }
    if (!pasteCells) {
      return;
    }
    runPasteCells(context.notebookEditor, context.cell, pasteCells);
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: PASTE_CELL_ABOVE_COMMAND_ID,
        title: localize("notebookActions.pasteAbove", "Paste Cell Above"),
        keybinding: {
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV,
          weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
        }
      }
    );
  }
  async runWithContext(accessor, context) {
    const notebookService = accessor.get(INotebookService);
    const pasteCells = notebookService.getToCopy();
    const editor = context.notebookEditor;
    const textModel = editor.textModel;
    if (editor.isReadOnly) {
      return;
    }
    if (!pasteCells) {
      return;
    }
    const originalState = {
      kind: SelectionStateType.Index,
      focus: editor.getFocus(),
      selections: editor.getSelections()
    };
    const currCellIndex = context.notebookEditor.getCellIndex(context.cell);
    const newFocusIndex = currCellIndex;
    textModel.applyEdits([
      {
        editType: CellEditType.Replace,
        index: currCellIndex,
        count: 0,
        cells: pasteCells.items.map((cell) => cloneNotebookCellTextModel(cell))
      }
    ], true, originalState, () => ({
      kind: SelectionStateType.Index,
      focus: { start: newFocusIndex, end: newFocusIndex + 1 },
      selections: [{ start: newFocusIndex, end: newFocusIndex + pasteCells.items.length }]
    }), void 0, true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleNotebookClipboardLog",
      title: localize2("toggleNotebookClipboardLog", "Toggle Notebook Clipboard Troubleshooting"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    toggleLogging();
    if (_logging) {
      const commandService = accessor.get(ICommandService);
      commandService.executeCommand(showWindowLogActionId);
    }
  }
});
registerAction2(class extends NotebookCellAction {
  constructor() {
    super(
      {
        id: "notebook.cell.output.selectAll",
        title: localize("notebook.cell.output.selectAll", "Select All"),
        keybinding: {
          primary: KeyMod.CtrlCmd | KeyCode.KeyA,
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED),
          weight: NOTEBOOK_OUTPUT_WEBVIEW_ACTION_WEIGHT
        }
      }
    );
  }
  async runWithContext(accessor, _context) {
    withEditor(accessor, (editor) => {
      if (!editor.hasEditorFocus()) {
        return false;
      }
      if (editor.hasEditorFocus() && !editor.hasWebviewFocus()) {
        return true;
      }
      const cell = editor.getActiveCell();
      if (!cell || !cell.outputIsFocused || !editor.hasWebviewFocus()) {
        return true;
      }
      if (cell.inputInOutputIsFocused) {
        editor.selectInputContents(cell);
      } else {
        editor.selectOutputContent(cell);
      }
      return true;
    });
  }
});
export {
  NotebookClipboardContribution,
  runCopyCells,
  runCutCells,
  runPasteCells
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvY2xpcGJvYXJkL25vdGVib29rQ2xpcGJvYXJkLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19DRUxMX0VESVRBQkxFLCBOT1RFQk9PS19FRElUT1JfRURJVEFCTEUsIE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBOT1RFQk9PS19PVVRQVVRfRk9DVVNFRCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGNlbGxSYW5nZVRvVmlld0NlbGxzLCBleHBhbmRDZWxsUmFuZ2VzV2l0aEhpZGRlbkNlbGxzLCBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJQ2VsbFZpZXdNb2RlbCwgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENvcHlBY3Rpb24sIEN1dEFjdGlvbiwgUGFzdGVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jbGlwYm9hcmQvYnJvd3Nlci9jbGlwYm9hcmQuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY2xvbmVOb3RlYm9va0NlbGxUZXh0TW9kZWwsIE5vdGVib29rQ2VsbFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va0NlbGxUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRUeXBlLCBJQ2VsbEVkaXRPcGVyYXRpb24sIElTZWxlY3Rpb25TdGF0ZSwgU2VsZWN0aW9uU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDZWxsT3ZlcmZsb3dUb29sYmFyR3JvdXBzLCBJTm90ZWJvb2tBY3Rpb25Db250ZXh0LCBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCwgTm90ZWJvb2tBY3Rpb24sIE5vdGVib29rQ2VsbEFjdGlvbiwgTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hULCBOT1RFQk9PS19PVVRQVVRfV0VCVklFV19BQ1RJT05fV0VJR0hUIH0gZnJvbSAnLi4vLi4vY29udHJvbGxlci9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSW5wdXRGb2N1c2VkQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFJlZG9Db21tYW5kLCBVbmRvQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdlYnZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IHNob3dXaW5kb3dMb2dBY3Rpb25JZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xvZy9jb21tb24vbG9nQ29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZUVsZW1lbnQsIGdldFdpbmRvdywgaXNBbmNlc3RvciwgaXNFZGl0YWJsZUVsZW1lbnQsIGlzSFRNTEVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcblxubGV0IF9sb2dnaW5nOiBib29sZWFuID0gZmFsc2U7XG5mdW5jdGlvbiB0b2dnbGVMb2dnaW5nKCkge1xuXHRfbG9nZ2luZyA9ICFfbG9nZ2luZztcbn1cblxuZnVuY3Rpb24gX2xvZyhsb2dnZXJTZXJ2aWNlOiBJTG9nU2VydmljZSwgc3RyOiBzdHJpbmcpIHtcblx0aWYgKF9sb2dnaW5nKSB7XG5cdFx0bG9nZ2VyU2VydmljZS5pbmZvKGBbTm90ZWJvb2tDbGlwYm9hcmRdOiAke3N0cn1gKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRGb2N1c2VkRWRpdG9yKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdGNvbnN0IGxvZ2dlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0Y29uc3QgZWRpdG9yID0gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXHRpZiAoIWVkaXRvcikge1xuXHRcdF9sb2cobG9nZ2VyU2VydmljZSwgJ1tSZXZpdmUgV2Vidmlld10gTm8gbm90ZWJvb2sgZWRpdG9yIGZvdW5kIGZvciBhY3RpdmUgZWRpdG9yIHBhbmUsIGJ5cGFzcycpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmICghZWRpdG9yLmhhc0VkaXRvckZvY3VzKCkpIHtcblx0XHRfbG9nKGxvZ2dlclNlcnZpY2UsICdbUmV2aXZlIFdlYnZpZXddIE5vdGVib29rIGVkaXRvciBpcyBub3QgZm9jdXNlZCwgYnlwYXNzJyk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKCFlZGl0b3IuaGFzV2Vidmlld0ZvY3VzKCkpIHtcblx0XHRfbG9nKGxvZ2dlclNlcnZpY2UsICdbUmV2aXZlIFdlYnZpZXddIE5vdGVib29rIGVkaXRvciBiYWNrbGF5ZXIgd2VidmlldyBpcyBub3QgZm9jdXNlZCwgYnlwYXNzJyk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdC8vIElmIG5vbmUgb2YgdGhlIG91dHB1dHMgaGF2ZSBmb2N1cywgdGhlbiB3ZWJ2aWV3IGlzIG5vdCBmb2N1c2VkXG5cdGNvbnN0IHZpZXcgPSBlZGl0b3IuZ2V0Vmlld01vZGVsKCk7XG5cdGlmICh2aWV3ICYmIHZpZXcudmlld0NlbGxzLmV2ZXJ5KGNlbGwgPT4gIWNlbGwub3V0cHV0SXNGb2N1c2VkICYmICFjZWxsLm91dHB1dElzSG92ZXJlZCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZXR1cm4geyBlZGl0b3IsIGxvZ2dlclNlcnZpY2UgfTtcbn1cbmZ1bmN0aW9uIGdldEZvY3VzZWRXZWJ2aWV3RGVsZWdhdGUoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBJV2VidmlldyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IHJlc3VsdCA9IGdldEZvY3VzZWRFZGl0b3IoYWNjZXNzb3IpO1xuXHRpZiAoIXJlc3VsdCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCB3ZWJ2aWV3ID0gcmVzdWx0LmVkaXRvci5nZXRJbm5lcldlYnZpZXcoKTtcblx0X2xvZyhyZXN1bHQubG9nZ2VyU2VydmljZSwgJ1tSZXZpdmUgV2Vidmlld10gTm90ZWJvb2sgZWRpdG9yIGJhY2tsYXllciB3ZWJ2aWV3IGlzIGZvY3VzZWQnKTtcblx0cmV0dXJuIHdlYnZpZXc7XG59XG5cbmZ1bmN0aW9uIHdpdGhXZWJ2aWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBmOiAod2Vidmlld2U6IElXZWJ2aWV3KSA9PiB2b2lkKSB7XG5cdGNvbnN0IHdlYnZpZXcgPSBnZXRGb2N1c2VkV2Vidmlld0RlbGVnYXRlKGFjY2Vzc29yKTtcblx0aWYgKHdlYnZpZXcpIHtcblx0XHRmKHdlYnZpZXcpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gd2l0aEVkaXRvcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZjogKGVkaXRvcjogSU5vdGVib29rRWRpdG9yKSA9PiBib29sZWFuKSB7XG5cdGNvbnN0IHJlc3VsdCA9IGdldEZvY3VzZWRFZGl0b3IoYWNjZXNzb3IpO1xuXHRyZXR1cm4gcmVzdWx0ID8gZihyZXN1bHQuZWRpdG9yKSA6IGZhbHNlO1xufVxuXG5jb25zdCBQUklPUklUWSA9IDEwNTtcblxuVW5kb0NvbW1hbmQuYWRkSW1wbGVtZW50YXRpb24oUFJJT1JJVFksICdub3RlYm9vay13ZWJ2aWV3JywgYWNjZXNzb3IgPT4ge1xuXHRyZXR1cm4gd2l0aFdlYnZpZXcoYWNjZXNzb3IsIHdlYnZpZXcgPT4gd2Vidmlldy51bmRvKCkpO1xufSk7XG5cblJlZG9Db21tYW5kLmFkZEltcGxlbWVudGF0aW9uKFBSSU9SSVRZLCAnbm90ZWJvb2std2VidmlldycsIGFjY2Vzc29yID0+IHtcblx0cmV0dXJuIHdpdGhXZWJ2aWV3KGFjY2Vzc29yLCB3ZWJ2aWV3ID0+IHdlYnZpZXcucmVkbygpKTtcbn0pO1xuXG5Db3B5QWN0aW9uPy5hZGRJbXBsZW1lbnRhdGlvbihQUklPUklUWSwgJ25vdGVib29rLXdlYnZpZXcnLCBhY2Nlc3NvciA9PiB7XG5cdHJldHVybiB3aXRoV2VidmlldyhhY2Nlc3Nvciwgd2VidmlldyA9PiB3ZWJ2aWV3LmNvcHkoKSk7XG59KTtcblxuUGFzdGVBY3Rpb24/LmFkZEltcGxlbWVudGF0aW9uKFBSSU9SSVRZLCAnbm90ZWJvb2std2VidmlldycsIGFjY2Vzc29yID0+IHtcblx0cmV0dXJuIHdpdGhXZWJ2aWV3KGFjY2Vzc29yLCB3ZWJ2aWV3ID0+IHdlYnZpZXcucGFzdGUoKSk7XG59KTtcblxuQ3V0QWN0aW9uPy5hZGRJbXBsZW1lbnRhdGlvbihQUklPUklUWSwgJ25vdGVib29rLXdlYnZpZXcnLCBhY2Nlc3NvciA9PiB7XG5cdHJldHVybiB3aXRoV2VidmlldyhhY2Nlc3Nvciwgd2VidmlldyA9PiB3ZWJ2aWV3LmN1dCgpKTtcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gcnVuUGFzdGVDZWxscyhlZGl0b3I6IElOb3RlYm9va0VkaXRvciwgYWN0aXZlQ2VsbDogSUNlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQsIHBhc3RlQ2VsbHM6IHtcblx0aXRlbXM6IE5vdGVib29rQ2VsbFRleHRNb2RlbFtdO1xuXHRpc0NvcHk6IGJvb2xlYW47XG59KTogYm9vbGVhbiB7XG5cdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRpZiAoZWRpdG9yLmlzUmVhZE9ubHkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCBvcmlnaW5hbFN0YXRlOiBJU2VsZWN0aW9uU3RhdGUgPSB7XG5cdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRzZWxlY3Rpb25zOiBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpXG5cdH07XG5cblx0aWYgKGFjdGl2ZUNlbGwpIHtcblx0XHRjb25zdCBjdXJyQ2VsbEluZGV4ID0gZWRpdG9yLmdldENlbGxJbmRleChhY3RpdmVDZWxsKTtcblx0XHRjb25zdCBuZXdGb2N1c0luZGV4ID0gdHlwZW9mIGN1cnJDZWxsSW5kZXggPT09ICdudW1iZXInID8gY3VyckNlbGxJbmRleCArIDEgOiAwO1xuXHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRpbmRleDogbmV3Rm9jdXNJbmRleCxcblx0XHRcdFx0Y291bnQ6IDAsXG5cdFx0XHRcdGNlbGxzOiBwYXN0ZUNlbGxzLml0ZW1zLm1hcChjZWxsID0+IGNsb25lTm90ZWJvb2tDZWxsVGV4dE1vZGVsKGNlbGwpKVxuXHRcdFx0fVxuXHRcdF0sIHRydWUsIG9yaWdpbmFsU3RhdGUsICgpID0+ICh7XG5cdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRmb2N1czogeyBzdGFydDogbmV3Rm9jdXNJbmRleCwgZW5kOiBuZXdGb2N1c0luZGV4ICsgMSB9LFxuXHRcdFx0c2VsZWN0aW9uczogW3sgc3RhcnQ6IG5ld0ZvY3VzSW5kZXgsIGVuZDogbmV3Rm9jdXNJbmRleCArIHBhc3RlQ2VsbHMuaXRlbXMubGVuZ3RoIH1dXG5cdFx0fSksIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKGVkaXRvci5nZXRMZW5ndGgoKSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0Y291bnQ6IDAsXG5cdFx0XHRcdGNlbGxzOiBwYXN0ZUNlbGxzLml0ZW1zLm1hcChjZWxsID0+IGNsb25lTm90ZWJvb2tDZWxsVGV4dE1vZGVsKGNlbGwpKVxuXHRcdFx0fVxuXHRcdF0sIHRydWUsIG9yaWdpbmFsU3RhdGUsICgpID0+ICh7XG5cdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRmb2N1czogeyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHRzZWxlY3Rpb25zOiBbeyBzdGFydDogMSwgZW5kOiBwYXN0ZUNlbGxzLml0ZW1zLmxlbmd0aCArIDEgfV1cblx0XHR9KSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuQ29weUNlbGxzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElOb3RlYm9va0VkaXRvciwgdGFyZ2V0Q2VsbDogSUNlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmIChlZGl0b3IuaGFzT3V0cHV0VGV4dFNlbGVjdGlvbigpKSB7XG5cdFx0Z2V0V2luZG93KGVkaXRvci5nZXREb21Ob2RlKCkpLmRvY3VtZW50LmV4ZWNDb21tYW5kKCdjb3B5Jyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0PElDbGlwYm9hcmRTZXJ2aWNlPihJQ2xpcGJvYXJkU2VydmljZSk7XG5cdGNvbnN0IG5vdGVib29rU2VydmljZSA9IGFjY2Vzc29yLmdldDxJTm90ZWJvb2tTZXJ2aWNlPihJTm90ZWJvb2tTZXJ2aWNlKTtcblx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0aWYgKHRhcmdldENlbGwpIHtcblx0XHRjb25zdCB0YXJnZXRDZWxsSW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KHRhcmdldENlbGwpO1xuXHRcdGNvbnN0IGNvbnRhaW5pbmdTZWxlY3Rpb24gPSBzZWxlY3Rpb25zLmZpbmQoc2VsZWN0aW9uID0+IHNlbGVjdGlvbi5zdGFydCA8PSB0YXJnZXRDZWxsSW5kZXggJiYgdGFyZ2V0Q2VsbEluZGV4IDwgc2VsZWN0aW9uLmVuZCk7XG5cblx0XHRpZiAoIWNvbnRhaW5pbmdTZWxlY3Rpb24pIHtcblx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHRhcmdldENlbGwuZ2V0VGV4dCgpKTtcblx0XHRcdG5vdGVib29rU2VydmljZS5zZXRUb0NvcHkoW3RhcmdldENlbGwubW9kZWxdLCB0cnVlKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHNlbGVjdGlvblJhbmdlcyA9IGV4cGFuZENlbGxSYW5nZXNXaXRoSGlkZGVuQ2VsbHMoZWRpdG9yLCBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpKTtcblx0Y29uc3Qgc2VsZWN0ZWRDZWxscyA9IGNlbGxSYW5nZVRvVmlld0NlbGxzKGVkaXRvciwgc2VsZWN0aW9uUmFuZ2VzKTtcblxuXHRpZiAoIXNlbGVjdGVkQ2VsbHMubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoc2VsZWN0ZWRDZWxscy5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSkuam9pbignXFxuJykpO1xuXHRub3RlYm9va1NlcnZpY2Uuc2V0VG9Db3B5KHNlbGVjdGVkQ2VsbHMubWFwKGNlbGwgPT4gY2VsbC5tb2RlbCksIHRydWUpO1xuXG5cdHJldHVybiB0cnVlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkN1dENlbGxzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElOb3RlYm9va0VkaXRvciwgdGFyZ2V0Q2VsbDogSUNlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSB8fCBlZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQ8SUNsaXBib2FyZFNlcnZpY2U+KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0Y29uc3Qgbm90ZWJvb2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0PElOb3RlYm9va1NlcnZpY2U+KElOb3RlYm9va1NlcnZpY2UpO1xuXHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblxuXHRpZiAodGFyZ2V0Q2VsbCkge1xuXHRcdC8vIGZyb20gdWlcblx0XHRjb25zdCB0YXJnZXRDZWxsSW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KHRhcmdldENlbGwpO1xuXHRcdGNvbnN0IGNvbnRhaW5pbmdTZWxlY3Rpb24gPSBzZWxlY3Rpb25zLmZpbmQoc2VsZWN0aW9uID0+IHNlbGVjdGlvbi5zdGFydCA8PSB0YXJnZXRDZWxsSW5kZXggJiYgdGFyZ2V0Q2VsbEluZGV4IDwgc2VsZWN0aW9uLmVuZCk7XG5cblx0XHRpZiAoIWNvbnRhaW5pbmdTZWxlY3Rpb24pIHtcblx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHRhcmdldENlbGwuZ2V0VGV4dCgpKTtcblx0XHRcdC8vIGRlbGV0ZSBjZWxsXG5cdFx0XHRjb25zdCBmb2N1cyA9IGVkaXRvci5nZXRGb2N1cygpO1xuXHRcdFx0Y29uc3QgbmV3Rm9jdXMgPSBmb2N1cy5lbmQgPD0gdGFyZ2V0Q2VsbEluZGV4ID8gZm9jdXMgOiB7IHN0YXJ0OiBmb2N1cy5zdGFydCAtIDEsIGVuZDogZm9jdXMuZW5kIC0gMSB9O1xuXHRcdFx0Y29uc3QgbmV3U2VsZWN0aW9ucyA9IHNlbGVjdGlvbnMubWFwKHNlbGVjdGlvbiA9PiAoc2VsZWN0aW9uLmVuZCA8PSB0YXJnZXRDZWxsSW5kZXggPyBzZWxlY3Rpb24gOiB7IHN0YXJ0OiBzZWxlY3Rpb24uc3RhcnQgLSAxLCBlbmQ6IHNlbGVjdGlvbi5lbmQgLSAxIH0pKTtcblxuXHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IHRhcmdldENlbGxJbmRleCwgY291bnQ6IDEsIGNlbGxzOiBbXSB9XG5cdFx0XHRdLCB0cnVlLCB7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IGVkaXRvci5nZXRGb2N1cygpLCBzZWxlY3Rpb25zOiBzZWxlY3Rpb25zIH0sICgpID0+ICh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IG5ld0ZvY3VzLCBzZWxlY3Rpb25zOiBuZXdTZWxlY3Rpb25zIH0pLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRub3RlYm9va1NlcnZpY2Uuc2V0VG9Db3B5KFt0YXJnZXRDZWxsLm1vZGVsXSwgZmFsc2UpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZm9jdXMgPSBlZGl0b3IuZ2V0Rm9jdXMoKTtcblx0Y29uc3QgY29udGFpbmluZ1NlbGVjdGlvbiA9IHNlbGVjdGlvbnMuZmluZChzZWxlY3Rpb24gPT4gc2VsZWN0aW9uLnN0YXJ0IDw9IGZvY3VzLnN0YXJ0ICYmIGZvY3VzLmVuZCA8PSBzZWxlY3Rpb24uZW5kKTtcblxuXHRpZiAoIWNvbnRhaW5pbmdTZWxlY3Rpb24pIHtcblx0XHQvLyBmb2N1cyBpcyBvdXQgb2YgYW55IHNlbGVjdGlvbiwgd2Ugc2hvdWxkIG9ubHkgY3V0IHRoaXMgY2VsbFxuXHRcdGNvbnN0IHRhcmdldENlbGwgPSBlZGl0b3IuY2VsbEF0KGZvY3VzLnN0YXJ0KTtcblx0XHRjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dCh0YXJnZXRDZWxsLmdldFRleHQoKSk7XG5cdFx0Y29uc3QgbmV3Rm9jdXMgPSBmb2N1cy5lbmQgPT09IGVkaXRvci5nZXRMZW5ndGgoKSA/IHsgc3RhcnQ6IGZvY3VzLnN0YXJ0IC0gMSwgZW5kOiBmb2N1cy5lbmQgLSAxIH0gOiBmb2N1cztcblx0XHRjb25zdCBuZXdTZWxlY3Rpb25zID0gc2VsZWN0aW9ucy5tYXAoc2VsZWN0aW9uID0+IChzZWxlY3Rpb24uZW5kIDw9IGZvY3VzLnN0YXJ0ID8gc2VsZWN0aW9uIDogeyBzdGFydDogc2VsZWN0aW9uLnN0YXJ0IC0gMSwgZW5kOiBzZWxlY3Rpb24uZW5kIC0gMSB9KSk7XG5cdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiBmb2N1cy5zdGFydCwgY291bnQ6IDEsIGNlbGxzOiBbXSB9XG5cdFx0XSwgdHJ1ZSwgeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSwgc2VsZWN0aW9uczogc2VsZWN0aW9ucyB9LCAoKSA9PiAoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBuZXdGb2N1cywgc2VsZWN0aW9uczogbmV3U2VsZWN0aW9ucyB9KSwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdG5vdGVib29rU2VydmljZS5zZXRUb0NvcHkoW3RhcmdldENlbGwubW9kZWxdLCBmYWxzZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRjb25zdCBzZWxlY3Rpb25SYW5nZXMgPSBleHBhbmRDZWxsUmFuZ2VzV2l0aEhpZGRlbkNlbGxzKGVkaXRvciwgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSk7XG5cdGNvbnN0IHNlbGVjdGVkQ2VsbHMgPSBjZWxsUmFuZ2VUb1ZpZXdDZWxscyhlZGl0b3IsIHNlbGVjdGlvblJhbmdlcyk7XG5cblx0aWYgKCFzZWxlY3RlZENlbGxzLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHNlbGVjdGVkQ2VsbHMubWFwKGNlbGwgPT4gY2VsbC5nZXRUZXh0KCkpLmpvaW4oJ1xcbicpKTtcblx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gc2VsZWN0aW9uUmFuZ2VzLm1hcChyYW5nZSA9PiAoeyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiByYW5nZS5zdGFydCwgY291bnQ6IHJhbmdlLmVuZCAtIHJhbmdlLnN0YXJ0LCBjZWxsczogW10gfSkpO1xuXHRjb25zdCBmaXJzdFNlbGVjdEluZGV4ID0gc2VsZWN0aW9uUmFuZ2VzWzBdLnN0YXJ0O1xuXG5cdC8qKlxuXHQgKiBJZiB3ZSBoYXZlIGNlbGxzLCAwLCAxLCAyLCAzLCA0LCA1LCA2XG5cdCAqIGFuZCBjZWxscyAxLCAyIGFyZSBzZWxlY3RlZCwgYW5kIHRoZW4gd2UgZGVsZXRlIGNlbGxzIDEgYW5kIDJcblx0ICogdGhlIG5ldyBmb2N1c2VkIGNlbGwgc2hvdWxkIHN0aWxsIGJlIGF0IGluZGV4IDFcblx0ICovXG5cdGNvbnN0IG5ld0ZvY3VzZWRDZWxsSW5kZXggPSBmaXJzdFNlbGVjdEluZGV4IDwgdGV4dE1vZGVsLmNlbGxzLmxlbmd0aCAtIDFcblx0XHQ/IGZpcnN0U2VsZWN0SW5kZXhcblx0XHQ6IE1hdGgubWF4KHRleHRNb2RlbC5jZWxscy5sZW5ndGggLSAyLCAwKTtcblxuXHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSwgc2VsZWN0aW9uczogc2VsZWN0aW9uUmFuZ2VzIH0sICgpID0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdFx0Zm9jdXM6IHsgc3RhcnQ6IG5ld0ZvY3VzZWRDZWxsSW5kZXgsIGVuZDogbmV3Rm9jdXNlZENlbGxJbmRleCArIDEgfSxcblx0XHRcdHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiBuZXdGb2N1c2VkQ2VsbEluZGV4LCBlbmQ6IG5ld0ZvY3VzZWRDZWxsSW5kZXggKyAxIH1dXG5cdFx0fTtcblx0fSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0bm90ZWJvb2tTZXJ2aWNlLnNldFRvQ29weShzZWxlY3RlZENlbGxzLm1hcChjZWxsID0+IGNlbGwubW9kZWwpLCBmYWxzZSk7XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0NsaXBib2FyZENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5ub3RlYm9va0NsaXBib2FyZCc7XG5cblx0Y29uc3RydWN0b3IoQElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IFBSSU9SSVRZID0gMTA1O1xuXG5cdFx0aWYgKENvcHlBY3Rpb24pIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKENvcHlBY3Rpb24uYWRkSW1wbGVtZW50YXRpb24oUFJJT1JJVFksICdub3RlYm9vay1jbGlwYm9hcmQnLCBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJ1bkNvcHlBY3Rpb24oYWNjZXNzb3IpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGlmIChQYXN0ZUFjdGlvbikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoUGFzdGVBY3Rpb24uYWRkSW1wbGVtZW50YXRpb24oUFJJT1JJVFksICdub3RlYm9vay1jbGlwYm9hcmQnLCBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJ1blBhc3RlQWN0aW9uKGFjY2Vzc29yKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRpZiAoQ3V0QWN0aW9uKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihDdXRBY3Rpb24uYWRkSW1wbGVtZW50YXRpb24oUFJJT1JJVFksICdub3RlYm9vay1jbGlwYm9hcmQnLCBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJ1bkN1dEFjdGlvbihhY2Nlc3Nvcik7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29udGV4dCgpIHtcblx0XHRjb25zdCBlZGl0b3IgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdFx0Y29uc3QgYWN0aXZlQ2VsbCA9IGVkaXRvcj8uZ2V0QWN0aXZlQ2VsbCgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRvcixcblx0XHRcdGFjdGl2ZUNlbGxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZm9jdXNJbnNpZGVFbWViZWRNb25hY28oZWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IpIHtcblx0XHRjb25zdCB3aW5kb3dTZWxlY3Rpb24gPSBnZXRXaW5kb3coZWRpdG9yLmdldERvbU5vZGUoKSkuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHRpZiAod2luZG93U2VsZWN0aW9uPy5yYW5nZUNvdW50ICE9PSAxKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlU2VsZWN0aW9uID0gd2luZG93U2VsZWN0aW9uLmdldFJhbmdlQXQoMCk7XG5cdFx0aWYgKGFjdGl2ZVNlbGVjdGlvbi5zdGFydENvbnRhaW5lciA9PT0gYWN0aXZlU2VsZWN0aW9uLmVuZENvbnRhaW5lciAmJiBhY3RpdmVTZWxlY3Rpb24uZW5kT2Zmc2V0IC0gYWN0aXZlU2VsZWN0aW9uLnN0YXJ0T2Zmc2V0ID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IGNvbnRhaW5lcjogYW55ID0gYWN0aXZlU2VsZWN0aW9uLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyO1xuXHRcdGNvbnN0IGJvZHkgPSBlZGl0b3IuZ2V0RG9tTm9kZSgpO1xuXG5cdFx0aWYgKCFib2R5LmNvbnRhaW5zKGNvbnRhaW5lcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR3aGlsZSAoY29udGFpbmVyXG5cdFx0XHQmJlxuXHRcdFx0Y29udGFpbmVyICE9PSBib2R5KSB7XG5cdFx0XHRpZiAoKGNvbnRhaW5lciBhcyBIVE1MRWxlbWVudCkuY2xhc3NMaXN0ICYmIChjb250YWluZXIgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLWVkaXRvcicpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb250YWluZXIgPSBjb250YWluZXIucGFyZW50Tm9kZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRydW5Db3B5QWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgbG9nZ2VyU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGlmIChpc0hUTUxFbGVtZW50KGFjdGl2ZUVsZW1lbnQpICYmIGlzRWRpdGFibGVFbGVtZW50KGFjdGl2ZUVsZW1lbnQpKSB7XG5cdFx0XHRfbG9nKGxvZ2dlclNlcnZpY2UsICdbTm90ZWJvb2tFZGl0b3JdIGZvY3VzIGlzIG9uIGlucHV0IG9yIHRleHRhcmVhIGVsZW1lbnQsIGJ5cGFzcycpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZWRpdG9yIH0gPSB0aGlzLl9nZXRDb250ZXh0KCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdF9sb2cobG9nZ2VyU2VydmljZSwgJ1tOb3RlYm9va0VkaXRvcl0gbm8gYWN0aXZlIG5vdGVib29rIGVkaXRvciwgYnlwYXNzJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCFpc0FuY2VzdG9yKGFjdGl2ZUVsZW1lbnQsIGVkaXRvci5nZXREb21Ob2RlKCkpKSB7XG5cdFx0XHRfbG9nKGxvZ2dlclNlcnZpY2UsICdbTm90ZWJvb2tFZGl0b3JdIGZvY3VzIGlzIG91dHNpZGUgb2YgdGhlIG5vdGVib29rIGVkaXRvciwgYnlwYXNzJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2ZvY3VzSW5zaWRlRW1lYmVkTW9uYWNvKGVkaXRvcikpIHtcblx0XHRcdF9sb2cobG9nZ2VyU2VydmljZSwgJ1tOb3RlYm9va0VkaXRvcl0gZm9jdXMgaXMgb24gZW1iZWQgbW9uYWNvIGVkaXRvciwgYnlwYXNzJyk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0X2xvZyhsb2dnZXJTZXJ2aWNlLCAnW05vdGVib29rRWRpdG9yXSBydW4gY29weSBhY3Rpb25zIG9uIG5vdGVib29rIG1vZGVsJyk7XG5cdFx0cmV0dXJuIHJ1bkNvcHlDZWxscyhhY2Nlc3NvciwgZWRpdG9yLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cnVuUGFzdGVBY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gPEhUTUxFbGVtZW50PmdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRpZiAoYWN0aXZlRWxlbWVudCAmJiBpc0VkaXRhYmxlRWxlbWVudChhY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vdGVib29rU2VydmljZSA9IGFjY2Vzc29yLmdldDxJTm90ZWJvb2tTZXJ2aWNlPihJTm90ZWJvb2tTZXJ2aWNlKTtcblx0XHRjb25zdCBwYXN0ZUNlbGxzID0gbm90ZWJvb2tTZXJ2aWNlLmdldFRvQ29weSgpO1xuXG5cdFx0aWYgKCFwYXN0ZUNlbGxzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBlZGl0b3IsIGFjdGl2ZUNlbGwgfSA9IHRoaXMuX2dldENvbnRleHQoKTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBydW5QYXN0ZUNlbGxzKGVkaXRvciwgYWN0aXZlQ2VsbCwgcGFzdGVDZWxscyk7XG5cdH1cblxuXHRydW5DdXRBY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gPEhUTUxFbGVtZW50PmdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRpZiAoYWN0aXZlRWxlbWVudCAmJiBpc0VkaXRhYmxlRWxlbWVudChhY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZWRpdG9yIH0gPSB0aGlzLl9nZXRDb250ZXh0KCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcnVuQ3V0Q2VsbHMoYWNjZXNzb3IsIGVkaXRvciwgdW5kZWZpbmVkKTtcblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoTm90ZWJvb2tDbGlwYm9hcmRDb250cmlidXRpb24uSUQsIE5vdGVib29rQ2xpcGJvYXJkQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xuXG5jb25zdCBDT1BZX0NFTExfQ09NTUFORF9JRCA9ICdub3RlYm9vay5jZWxsLmNvcHknO1xuY29uc3QgQ1VUX0NFTExfQ09NTUFORF9JRCA9ICdub3RlYm9vay5jZWxsLmN1dCc7XG5jb25zdCBQQVNURV9DRUxMX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2VsbC5wYXN0ZSc7XG5jb25zdCBQQVNURV9DRUxMX0FCT1ZFX0NPTU1BTkRfSUQgPSAnbm90ZWJvb2suY2VsbC5wYXN0ZUFib3ZlJztcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBDT1BZX0NFTExfQ09NTUFORF9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMuY29weScsIFwiQ29weSBDZWxsXCIpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBOT1RFQk9PS19FRElUT1JfRk9DVVNFRCxcblx0XHRcdFx0XHRncm91cDogQ2VsbE92ZXJmbG93VG9vbGJhckdyb3Vwcy5Db3B5LFxuXHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRrZXliaW5kaW5nOiBwbGF0Zm9ybS5pc05hdGl2ZSA/IHVuZGVmaW5lZCA6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Qyxcblx0XHRcdFx0XHR3aW46IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUMsIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5JbnNlcnRdIH0sXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSkpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KSB7XG5cdFx0cnVuQ29weUNlbGxzKGFjY2Vzc29yLCBjb250ZXh0Lm5vdGVib29rRWRpdG9yLCBjb250ZXh0LmNlbGwpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgTm90ZWJvb2tDZWxsQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBDVVRfQ0VMTF9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5jdXQnLCBcIkN1dCBDZWxsXCIpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfQ0VMTF9FRElUQUJMRSksXG5cdFx0XHRcdFx0Z3JvdXA6IENlbGxPdmVyZmxvd1Rvb2xiYXJHcm91cHMuQ29weSxcblx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0fSxcblx0XHRcdFx0a2V5YmluZGluZzogcGxhdGZvcm0uaXNOYXRpdmUgPyB1bmRlZmluZWQgOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSkpLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlYLFxuXHRcdFx0XHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5WCwgc2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5EZWxldGVdIH0sXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQpIHtcblx0XHRydW5DdXRDZWxscyhhY2Nlc3NvciwgY29udGV4dC5ub3RlYm9va0VkaXRvciwgY29udGV4dC5jZWxsKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBQQVNURV9DRUxMX0NPTU1BTkRfSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tBY3Rpb25zLnBhc3RlJywgXCJQYXN0ZSBDZWxsXCIpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSksXG5cdFx0XHRcdFx0Z3JvdXA6IENlbGxPdmVyZmxvd1Rvb2xiYXJHcm91cHMuQ29weSxcblx0XHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdFx0fSxcblx0XHRcdFx0a2V5YmluZGluZzogcGxhdGZvcm0uaXNOYXRpdmUgPyB1bmRlZmluZWQgOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSkpLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlWLFxuXHRcdFx0XHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Viwgc2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5JbnNlcnRdIH0sXG5cdFx0XHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVYsIHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuSW5zZXJ0XSB9LFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQpIHtcblx0XHRjb25zdCBub3RlYm9va1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQ8SU5vdGVib29rU2VydmljZT4oSU5vdGVib29rU2VydmljZSk7XG5cdFx0Y29uc3QgcGFzdGVDZWxscyA9IG5vdGVib29rU2VydmljZS5nZXRUb0NvcHkoKTtcblxuXHRcdGlmICghY29udGV4dC5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpIHx8IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghcGFzdGVDZWxscykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJ1blBhc3RlQ2VsbHMoY29udGV4dC5ub3RlYm9va0VkaXRvciwgY29udGV4dC5jZWxsLCBwYXN0ZUNlbGxzKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogUEFTVEVfQ0VMTF9BQk9WRV9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5wYXN0ZUFib3ZlJywgXCJQYXN0ZSBDZWxsIEFib3ZlXCIpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSkpLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlWLFxuXHRcdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCkge1xuXHRcdGNvbnN0IG5vdGVib29rU2VydmljZSA9IGFjY2Vzc29yLmdldDxJTm90ZWJvb2tTZXJ2aWNlPihJTm90ZWJvb2tTZXJ2aWNlKTtcblx0XHRjb25zdCBwYXN0ZUNlbGxzID0gbm90ZWJvb2tTZXJ2aWNlLmdldFRvQ29weSgpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3I7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdGlmIChlZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghcGFzdGVDZWxscykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9yaWdpbmFsU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSA9IHtcblx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRcdHNlbGVjdGlvbnM6IGVkaXRvci5nZXRTZWxlY3Rpb25zKClcblx0XHR9O1xuXG5cdFx0Y29uc3QgY3VyckNlbGxJbmRleCA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEluZGV4KGNvbnRleHQuY2VsbCk7XG5cdFx0Y29uc3QgbmV3Rm9jdXNJbmRleCA9IGN1cnJDZWxsSW5kZXg7XG5cdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdGluZGV4OiBjdXJyQ2VsbEluZGV4LFxuXHRcdFx0XHRjb3VudDogMCxcblx0XHRcdFx0Y2VsbHM6IHBhc3RlQ2VsbHMuaXRlbXMubWFwKGNlbGwgPT4gY2xvbmVOb3RlYm9va0NlbGxUZXh0TW9kZWwoY2VsbCkpXG5cdFx0XHR9XG5cdFx0XSwgdHJ1ZSwgb3JpZ2luYWxTdGF0ZSwgKCkgPT4gKHtcblx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdGZvY3VzOiB7IHN0YXJ0OiBuZXdGb2N1c0luZGV4LCBlbmQ6IG5ld0ZvY3VzSW5kZXggKyAxIH0sXG5cdFx0XHRzZWxlY3Rpb25zOiBbeyBzdGFydDogbmV3Rm9jdXNJbmRleCwgZW5kOiBuZXdGb2N1c0luZGV4ICsgcGFzdGVDZWxscy5pdGVtcy5sZW5ndGggfV1cblx0XHR9KSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlTm90ZWJvb2tDbGlwYm9hcmRMb2cnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlTm90ZWJvb2tDbGlwYm9hcmRMb2cnLCAnVG9nZ2xlIE5vdGVib29rIENsaXBib2FyZCBUcm91Ymxlc2hvb3RpbmcnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHR0b2dnbGVMb2dnaW5nKCk7XG5cdFx0aWYgKF9sb2dnaW5nKSB7XG5cdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoc2hvd1dpbmRvd0xvZ0FjdGlvbklkKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE5vdGVib29rQ2VsbEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ25vdGVib29rLmNlbGwub3V0cHV0LnNlbGVjdEFsbCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2suY2VsbC5vdXRwdXQuc2VsZWN0QWxsJywgXCJTZWxlY3QgQWxsXCIpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUEsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBOT1RFQk9PS19PVVRQVVRfRk9DVVNFRCksXG5cdFx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19PVVRQVVRfV0VCVklFV19BQ1RJT05fV0VJR0hUXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9jb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCkge1xuXHRcdHdpdGhFZGl0b3IoYWNjZXNzb3IsIGVkaXRvciA9PiB7XG5cdFx0XHRpZiAoIWVkaXRvci5oYXNFZGl0b3JGb2N1cygpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChlZGl0b3IuaGFzRWRpdG9yRm9jdXMoKSAmJiAhZWRpdG9yLmhhc1dlYnZpZXdGb2N1cygpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2VsbCA9IGVkaXRvci5nZXRBY3RpdmVDZWxsKCk7XG5cdFx0XHRpZiAoIWNlbGwgfHwgIWNlbGwub3V0cHV0SXNGb2N1c2VkIHx8ICFlZGl0b3IuaGFzV2Vidmlld0ZvY3VzKCkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2VsbC5pbnB1dEluT3V0cHV0SXNGb2N1c2VkKSB7XG5cdFx0XHRcdGVkaXRvci5zZWxlY3RJbnB1dENvbnRlbnRzKGNlbGwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdE91dHB1dENvbnRlbnQoY2VsbCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQixzQ0FBc0M7QUFDL0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0IsMEJBQTBCLHlCQUF5QiwrQkFBK0I7QUFDbkgsU0FBUyxzQkFBc0IsaUNBQWlDLHVDQUF3RTtBQUN4SSxTQUFTLFlBQVksV0FBVyxtQkFBbUI7QUFDbkQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQ0FBeUQ7QUFDbEUsU0FBUyxjQUFtRCwwQkFBMEI7QUFDdEYsU0FBUyx3QkFBd0I7QUFDakMsWUFBWSxjQUFjO0FBQzFCLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUNqRCxTQUFTLDJCQUErRSxnQkFBZ0Isb0JBQW9CLHNDQUFzQyw2Q0FBNkM7QUFDL00sU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx3QkFBd0I7QUFFakMsU0FBUyxhQUFhLG1CQUFtQjtBQUV6QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1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QzlCLE1BQU0sbUJBQW1CO0FBQUEsTUFDekIsT0FBTyxFQUFFLE9BQU8sZUFBZSxLQUFLLGdCQUFnQixFQUFFO0FBQUEsTUFDdEQsWUFBWSxDQUFDLEVBQUUsT0FBTyxlQUFlLEtBQUssZ0JBQWdCLFdBQVcsTUFBTSxPQUFPLENBQUM7QUFBQSxJQUNwRixJQUFJLFFBQVcsSUFBSTtBQUFBLEVBQ3BCO0FBQ0QsQ0FBQztBQUVELGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLDhCQUE4QiwyQ0FBMkM7QUFBQSxNQUMxRixVQUFVLFdBQVc7QUFBQSxNQUNyQixJQUFJO0FBQUEsSUFDTCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsSUFBSSxVQUFrQztBQUNyQyxrQkFBYztBQUNkLFFBQUksVUFBVTtBQUNiLFlBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELHFCQUFlLGVBQWUscUJBQXFCO0FBQUEsSUFDcEQ7QUFBQSxFQUNEO0FBQ0QsQ0FBQztBQUdELGdCQUFnQixjQUFjLG1CQUFtQjtBQUFBLEVBQ2hELGNBQWM7QUFDYjtBQUFBLE1BQ0M7QUFBQSxRQUNDLElBQUk7QUFBQSxRQUNKLE9BQU8sU0FBUyxrQ0FBa0MsWUFBWTtBQUFBLFFBQzlELFlBQVk7QUFBQSxVQUNYLFNBQVMsT0FBTyxVQUFVLFFBQVE7QUFBQSxVQUNsQyxNQUFNLGVBQWUsSUFBSSx5QkFBeUIsdUJBQXVCO0FBQUEsVUFDekUsUUFBUTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sZUFBZSxVQUE0QixVQUFzQztBQUN0RixlQUFXLFVBQVUsWUFBVTtBQUM5QixVQUFJLENBQUMsT0FBTyxlQUFlLEdBQUc7QUFDN0IsZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLE9BQU8sZUFBZSxLQUFLLENBQUMsT0FBTyxnQkFBZ0IsR0FBRztBQUN6RCxlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sT0FBTyxPQUFPLGNBQWM7QUFDbEMsVUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLG1CQUFtQixDQUFDLE9BQU8sZ0JBQWdCLEdBQUc7QUFDaEUsZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLEtBQUssd0JBQXdCO0FBQ2hDLGVBQU8sb0JBQW9CLElBQUk7QUFBQSxNQUNoQyxPQUFPO0FBQ04sZUFBTyxvQkFBb0IsSUFBSTtBQUFBLE1BQ2hDO0FBQ0EsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUFBLEVBRUY7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJjb250YWluaW5nU2VsZWN0aW9uIiwgImZvY3VzIiwgInRhcmdldENlbGwiLCAiUFJJT1JJVFkiXQp9Cg==
