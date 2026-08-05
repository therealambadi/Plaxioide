import { ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { EndOfLinePreference } from "../../../../../editor/common/model.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { ResourceNotebookCellEdit } from "../../../bulkEdit/browser/bulkCellEdits.js";
import { CellEditState, CellFocusMode, expandCellRangesWithHiddenCells } from "../notebookBrowser.js";
import { cloneNotebookCellTextModel } from "../../common/model/notebookCellTextModel.js";
import { CellEditType, CellKind, SelectionStateType } from "../../common/notebookCommon.js";
import { cellRangeContains, cellRangesToIndexes } from "../../common/notebookRange.js";
import { localize } from "../../../../../nls.js";
async function changeCellToKind(kind, context, language, mime) {
  const { notebookEditor } = context;
  if (!notebookEditor.hasModel()) {
    return;
  }
  if (notebookEditor.isReadOnly) {
    return;
  }
  if (context.ui && context.cell) {
    const { cell } = context;
    if (cell.cellKind === kind) {
      return;
    }
    const text = cell.getText();
    const idx = notebookEditor.getCellIndex(cell);
    if (language === void 0) {
      const availableLanguages = notebookEditor.activeKernel?.supportedLanguages ?? [];
      language = availableLanguages[0] ?? PLAINTEXT_LANGUAGE_ID;
    }
    notebookEditor.textModel.applyEdits([
      {
        editType: CellEditType.Replace,
        index: idx,
        count: 1,
        cells: [{
          cellKind: kind,
          source: text,
          language,
          mime: mime ?? cell.mime,
          outputs: cell.model.outputs,
          metadata: cell.metadata
        }]
      }
    ], true, {
      kind: SelectionStateType.Index,
      focus: notebookEditor.getFocus(),
      selections: notebookEditor.getSelections()
    }, () => {
      return {
        kind: SelectionStateType.Index,
        focus: notebookEditor.getFocus(),
        selections: notebookEditor.getSelections()
      };
    }, void 0, true);
    const newCell = notebookEditor.cellAt(idx);
    await notebookEditor.focusNotebookCell(newCell, cell.getEditState() === CellEditState.Editing ? "editor" : "container");
  } else if (context.selectedCells) {
    const selectedCells = context.selectedCells;
    const rawEdits = [];
    selectedCells.forEach((cell) => {
      if (cell.cellKind === kind) {
        return;
      }
      const text = cell.getText();
      const idx = notebookEditor.getCellIndex(cell);
      if (language === void 0) {
        const availableLanguages = notebookEditor.activeKernel?.supportedLanguages ?? [];
        language = availableLanguages[0] ?? PLAINTEXT_LANGUAGE_ID;
      }
      rawEdits.push(
        {
          editType: CellEditType.Replace,
          index: idx,
          count: 1,
          cells: [{
            cellKind: kind,
            source: text,
            language,
            mime: mime ?? cell.mime,
            outputs: cell.model.outputs,
            metadata: cell.metadata
          }]
        }
      );
    });
    notebookEditor.textModel.applyEdits(rawEdits, true, {
      kind: SelectionStateType.Index,
      focus: notebookEditor.getFocus(),
      selections: notebookEditor.getSelections()
    }, () => {
      return {
        kind: SelectionStateType.Index,
        focus: notebookEditor.getFocus(),
        selections: notebookEditor.getSelections()
      };
    }, void 0, true);
  }
}
function runDeleteAction(editor, cell) {
  const textModel = editor.textModel;
  const selections = editor.getSelections();
  const targetCellIndex = editor.getCellIndex(cell);
  const containingSelection = selections.find((selection) => selection.start <= targetCellIndex && targetCellIndex < selection.end);
  const computeUndoRedo = !editor.isReadOnly || textModel.viewType === "interactive";
  if (containingSelection) {
    const edits = selections.reverse().map((selection) => ({
      editType: CellEditType.Replace,
      index: selection.start,
      count: selection.end - selection.start,
      cells: []
    }));
    const nextCellAfterContainingSelection = containingSelection.end >= editor.getLength() ? void 0 : editor.cellAt(containingSelection.end);
    textModel.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections: editor.getSelections() }, () => {
      if (nextCellAfterContainingSelection) {
        const cellIndex = textModel.cells.findIndex((cell2) => cell2.handle === nextCellAfterContainingSelection.handle);
        return { kind: SelectionStateType.Index, focus: { start: cellIndex, end: cellIndex + 1 }, selections: [{ start: cellIndex, end: cellIndex + 1 }] };
      } else {
        if (textModel.length) {
          const lastCellIndex = textModel.length - 1;
          return { kind: SelectionStateType.Index, focus: { start: lastCellIndex, end: lastCellIndex + 1 }, selections: [{ start: lastCellIndex, end: lastCellIndex + 1 }] };
        } else {
          return { kind: SelectionStateType.Index, focus: { start: 0, end: 0 }, selections: [{ start: 0, end: 0 }] };
        }
      }
    }, void 0, computeUndoRedo);
  } else {
    const focus = editor.getFocus();
    const edits = [{
      editType: CellEditType.Replace,
      index: targetCellIndex,
      count: 1,
      cells: []
    }];
    const finalSelections = [];
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];
      if (selection.end <= targetCellIndex) {
        finalSelections.push(selection);
      } else if (selection.start > targetCellIndex) {
        finalSelections.push({ start: selection.start - 1, end: selection.end - 1 });
      } else {
        finalSelections.push({ start: targetCellIndex, end: targetCellIndex + 1 });
      }
    }
    if (editor.cellAt(focus.start) === cell) {
      const newFocus = focus.end === textModel.length ? { start: focus.start - 1, end: focus.end - 1 } : focus;
      textModel.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections: editor.getSelections() }, () => ({
        kind: SelectionStateType.Index,
        focus: newFocus,
        selections: finalSelections
      }), void 0, computeUndoRedo);
    } else {
      const newFocus = focus.start > targetCellIndex ? { start: focus.start - 1, end: focus.end - 1 } : focus;
      textModel.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: editor.getFocus(), selections: editor.getSelections() }, () => ({
        kind: SelectionStateType.Index,
        focus: newFocus,
        selections: finalSelections
      }), void 0, computeUndoRedo);
    }
  }
}
async function moveCellRange(context, direction) {
  if (!context.notebookEditor.hasModel()) {
    return;
  }
  const editor = context.notebookEditor;
  const textModel = editor.textModel;
  if (editor.isReadOnly) {
    return;
  }
  let range = void 0;
  if (context.cell) {
    const idx = editor.getCellIndex(context.cell);
    range = { start: idx, end: idx + 1 };
  } else {
    const selections = editor.getSelections();
    const modelRanges = expandCellRangesWithHiddenCells(editor, selections);
    range = modelRanges[0];
  }
  if (!range || range.start === range.end) {
    return;
  }
  if (direction === "up") {
    if (range.start === 0) {
      return;
    }
    const indexAbove = range.start - 1;
    const finalSelection = { start: range.start - 1, end: range.end - 1 };
    const focus = context.notebookEditor.getFocus();
    const newFocus = cellRangeContains(range, focus) ? { start: focus.start - 1, end: focus.end - 1 } : { start: range.start - 1, end: range.start };
    textModel.applyEdits(
      [
        {
          editType: CellEditType.Move,
          index: indexAbove,
          length: 1,
          newIdx: range.end - 1
        }
      ],
      true,
      {
        kind: SelectionStateType.Index,
        focus: editor.getFocus(),
        selections: editor.getSelections()
      },
      () => ({ kind: SelectionStateType.Index, focus: newFocus, selections: [finalSelection] }),
      void 0,
      true
    );
    const focusRange = editor.getSelections()[0] ?? editor.getFocus();
    editor.revealCellRangeInView(focusRange);
  } else {
    if (range.end >= textModel.length) {
      return;
    }
    const indexBelow = range.end;
    const finalSelection = { start: range.start + 1, end: range.end + 1 };
    const focus = editor.getFocus();
    const newFocus = cellRangeContains(range, focus) ? { start: focus.start + 1, end: focus.end + 1 } : { start: range.start + 1, end: range.start + 2 };
    textModel.applyEdits(
      [
        {
          editType: CellEditType.Move,
          index: indexBelow,
          length: 1,
          newIdx: range.start
        }
      ],
      true,
      {
        kind: SelectionStateType.Index,
        focus: editor.getFocus(),
        selections: editor.getSelections()
      },
      () => ({ kind: SelectionStateType.Index, focus: newFocus, selections: [finalSelection] }),
      void 0,
      true
    );
    const focusRange = editor.getSelections()[0] ?? editor.getFocus();
    editor.revealCellRangeInView(focusRange);
  }
}
async function copyCellRange(context, direction) {
  const editor = context.notebookEditor;
  if (!editor.hasModel()) {
    return;
  }
  const textModel = editor.textModel;
  if (editor.isReadOnly) {
    return;
  }
  let range = void 0;
  if (context.ui) {
    const targetCell = context.cell;
    const targetCellIndex = editor.getCellIndex(targetCell);
    range = { start: targetCellIndex, end: targetCellIndex + 1 };
  } else {
    const selections = editor.getSelections();
    const modelRanges = expandCellRangesWithHiddenCells(editor, selections);
    range = modelRanges[0];
  }
  if (!range || range.start === range.end) {
    return;
  }
  if (direction === "up") {
    const focus = editor.getFocus();
    const selections = editor.getSelections();
    textModel.applyEdits(
      [
        {
          editType: CellEditType.Replace,
          index: range.end,
          count: 0,
          cells: cellRangesToIndexes([range]).map((index) => cloneNotebookCellTextModel(editor.cellAt(index).model))
        }
      ],
      true,
      {
        kind: SelectionStateType.Index,
        focus,
        selections
      },
      () => ({ kind: SelectionStateType.Index, focus, selections }),
      void 0,
      true
    );
  } else {
    const focus = editor.getFocus();
    const selections = editor.getSelections();
    const newCells = cellRangesToIndexes([range]).map((index) => cloneNotebookCellTextModel(editor.cellAt(index).model));
    const countDelta = newCells.length;
    const newFocus = context.ui ? focus : { start: focus.start + countDelta, end: focus.end + countDelta };
    const newSelections = context.ui ? selections : [{ start: range.start + countDelta, end: range.end + countDelta }];
    textModel.applyEdits(
      [
        {
          editType: CellEditType.Replace,
          index: range.end,
          count: 0,
          cells: cellRangesToIndexes([range]).map((index) => cloneNotebookCellTextModel(editor.cellAt(index).model))
        }
      ],
      true,
      {
        kind: SelectionStateType.Index,
        focus,
        selections
      },
      () => ({ kind: SelectionStateType.Index, focus: newFocus, selections: newSelections }),
      void 0,
      true
    );
    const focusRange = editor.getSelections()[0] ?? editor.getFocus();
    editor.revealCellRangeInView(focusRange);
  }
}
async function joinSelectedCells(bulkEditService, notificationService, context) {
  const editor = context.notebookEditor;
  if (editor.isReadOnly) {
    return;
  }
  const edits = [];
  const cells = [];
  for (const selection of editor.getSelections()) {
    cells.push(...editor.getCellsInRange(selection));
  }
  if (cells.length <= 1) {
    return;
  }
  const cellKind = cells[0].cellKind;
  const isSameKind = cells.every((cell) => cell.cellKind === cellKind);
  if (!isSameKind) {
    const message = localize("notebookActions.joinSelectedCells", "Cannot join cells of different kinds");
    return notificationService.warn(message);
  }
  const firstCell = cells[0];
  const insertContent = cells.map((cell) => cell.getText()).join(firstCell.textBuffer.getEOL());
  const firstSelection = editor.getSelections()[0];
  edits.push(
    new ResourceNotebookCellEdit(
      editor.textModel.uri,
      {
        editType: CellEditType.Replace,
        index: firstSelection.start,
        count: firstSelection.end - firstSelection.start,
        cells: [{
          cellKind: firstCell.cellKind,
          source: insertContent,
          language: firstCell.language,
          mime: firstCell.mime,
          outputs: firstCell.model.outputs,
          metadata: firstCell.metadata
        }]
      }
    )
  );
  for (const selection of editor.getSelections().slice(1)) {
    edits.push(new ResourceNotebookCellEdit(
      editor.textModel.uri,
      {
        editType: CellEditType.Replace,
        index: selection.start,
        count: selection.end - selection.start,
        cells: []
      }
    ));
  }
  if (edits.length) {
    await bulkEditService.apply(
      edits,
      { quotableLabel: localize("notebookActions.joinSelectedCells.label", "Join Notebook Cells") }
    );
  }
}
async function joinNotebookCells(editor, range, direction, constraint) {
  if (editor.isReadOnly) {
    return null;
  }
  const textModel = editor.textModel;
  const cells = editor.getCellsInRange(range);
  if (!cells.length) {
    return null;
  }
  if (range.start === 0 && direction === "above") {
    return null;
  }
  if (range.end === textModel.length && direction === "below") {
    return null;
  }
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (constraint && cell.cellKind !== constraint) {
      return null;
    }
  }
  if (direction === "above") {
    const above = editor.cellAt(range.start - 1);
    if (constraint && above.cellKind !== constraint) {
      return null;
    }
    const insertContent = cells.map((cell) => (cell.textBuffer.getEOL() ?? "") + cell.getText()).join("");
    const aboveCellLineCount = above.textBuffer.getLineCount();
    const aboveCellLastLineEndColumn = above.textBuffer.getLineLength(aboveCellLineCount);
    return {
      edits: [
        new ResourceTextEdit(above.uri, { range: new Range(aboveCellLineCount, aboveCellLastLineEndColumn + 1, aboveCellLineCount, aboveCellLastLineEndColumn + 1), text: insertContent }),
        new ResourceNotebookCellEdit(
          textModel.uri,
          {
            editType: CellEditType.Replace,
            index: range.start,
            count: range.end - range.start,
            cells: []
          }
        )
      ],
      cell: above,
      endFocus: { start: range.start - 1, end: range.start },
      endSelections: [{ start: range.start - 1, end: range.start }]
    };
  } else {
    const below = editor.cellAt(range.end);
    if (constraint && below.cellKind !== constraint) {
      return null;
    }
    const cell = cells[0];
    const restCells = [...cells.slice(1), below];
    const insertContent = restCells.map((cl) => (cl.textBuffer.getEOL() ?? "") + cl.getText()).join("");
    const cellLineCount = cell.textBuffer.getLineCount();
    const cellLastLineEndColumn = cell.textBuffer.getLineLength(cellLineCount);
    return {
      edits: [
        new ResourceTextEdit(cell.uri, { range: new Range(cellLineCount, cellLastLineEndColumn + 1, cellLineCount, cellLastLineEndColumn + 1), text: insertContent }),
        new ResourceNotebookCellEdit(
          textModel.uri,
          {
            editType: CellEditType.Replace,
            index: range.start + 1,
            count: range.end - range.start,
            cells: []
          }
        )
      ],
      cell,
      endFocus: { start: range.start, end: range.start + 1 },
      endSelections: [{ start: range.start, end: range.start + 1 }]
    };
  }
}
async function joinCellsWithSurrounds(bulkEditService, context, direction) {
  const editor = context.notebookEditor;
  const textModel = editor.textModel;
  const viewModel = editor.getViewModel();
  let ret = null;
  if (context.ui) {
    const focusMode = context.cell.focusMode;
    const cellIndex = editor.getCellIndex(context.cell);
    ret = await joinNotebookCells(editor, { start: cellIndex, end: cellIndex + 1 }, direction);
    if (!ret) {
      return;
    }
    await bulkEditService.apply(
      ret?.edits,
      { quotableLabel: "Join Notebook Cells" }
    );
    viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: ret.endFocus, selections: ret.endSelections });
    ret.cell.updateEditState(CellEditState.Editing, "joinCellsWithSurrounds");
    editor.revealCellRangeInView(editor.getFocus());
    if (focusMode === CellFocusMode.Editor) {
      ret.cell.focusMode = CellFocusMode.Editor;
    }
  } else {
    const selections = editor.getSelections();
    if (!selections.length) {
      return;
    }
    const focus = editor.getFocus();
    const focusMode = editor.cellAt(focus.start)?.focusMode;
    const edits = [];
    let cell = null;
    const cells = [];
    for (let i = selections.length - 1; i >= 0; i--) {
      const selection = selections[i];
      const containFocus = cellRangeContains(selection, focus);
      if (selection.end >= textModel.length && direction === "below" || selection.start === 0 && direction === "above") {
        if (containFocus) {
          cell = editor.cellAt(focus.start);
        }
        cells.push(...editor.getCellsInRange(selection));
        continue;
      }
      const singleRet = await joinNotebookCells(editor, selection, direction);
      if (!singleRet) {
        return;
      }
      edits.push(...singleRet.edits);
      cells.push(singleRet.cell);
      if (containFocus) {
        cell = singleRet.cell;
      }
    }
    if (!edits.length) {
      return;
    }
    if (!cell || !cells.length) {
      return;
    }
    await bulkEditService.apply(
      edits,
      { quotableLabel: "Join Notebook Cells" }
    );
    cells.forEach((cell2) => {
      cell2.updateEditState(CellEditState.Editing, "joinCellsWithSurrounds");
    });
    viewModel.updateSelectionsState({ kind: SelectionStateType.Handle, primary: cell.handle, selections: cells.map((cell2) => cell2.handle) });
    editor.revealCellRangeInView(editor.getFocus());
    const newFocusedCell = editor.cellAt(editor.getFocus().start);
    if (focusMode === CellFocusMode.Editor && newFocusedCell) {
      newFocusedCell.focusMode = CellFocusMode.Editor;
    }
  }
}
function _splitPointsToBoundaries(splitPoints, textBuffer) {
  const boundaries = [];
  const lineCnt = textBuffer.getLineCount();
  const getLineLen = (lineNumber) => {
    return textBuffer.getLineLength(lineNumber);
  };
  splitPoints = splitPoints.sort((l, r) => {
    const lineDiff = l.lineNumber - r.lineNumber;
    const columnDiff = l.column - r.column;
    return lineDiff !== 0 ? lineDiff : columnDiff;
  });
  for (let sp of splitPoints) {
    if (getLineLen(sp.lineNumber) + 1 === sp.column && sp.column !== 1 && sp.lineNumber < lineCnt) {
      sp = new Position(sp.lineNumber + 1, 1);
    }
    _pushIfAbsent(boundaries, sp);
  }
  if (boundaries.length === 0) {
    return null;
  }
  const modelStart = new Position(1, 1);
  const modelEnd = new Position(lineCnt, getLineLen(lineCnt) + 1);
  return [modelStart, ...boundaries, modelEnd];
}
function _pushIfAbsent(positions, p) {
  const last = positions.length > 0 ? positions[positions.length - 1] : void 0;
  if (!last || last.lineNumber !== p.lineNumber || last.column !== p.column) {
    positions.push(p);
  }
}
function computeCellLinesContents(cell, splitPoints) {
  const rangeBoundaries = _splitPointsToBoundaries(splitPoints, cell.textBuffer);
  if (!rangeBoundaries) {
    return null;
  }
  const newLineModels = [];
  for (let i = 1; i < rangeBoundaries.length; i++) {
    const start = rangeBoundaries[i - 1];
    const end = rangeBoundaries[i];
    newLineModels.push(cell.textBuffer.getValueInRange(new Range(start.lineNumber, start.column, end.lineNumber, end.column), EndOfLinePreference.TextDefined));
  }
  return newLineModels;
}
function insertCell(languageService, editor, index, type, direction = "above", initialText = "", ui = false, kernelHistoryService) {
  const viewModel = editor.getViewModel();
  const activeKernel = editor.activeKernel;
  if (viewModel.options.isReadOnly) {
    return null;
  }
  const cell = editor.cellAt(index);
  const nextIndex = ui ? viewModel.getNextVisibleCellIndex(index) : index + 1;
  let language;
  if (type === CellKind.Code) {
    const supportedLanguages = activeKernel?.supportedLanguages ?? languageService.getRegisteredLanguageIds();
    const defaultLanguage = supportedLanguages[0] || PLAINTEXT_LANGUAGE_ID;
    if (cell?.cellKind === CellKind.Code) {
      language = cell.language;
    } else if (cell?.cellKind === CellKind.Markup) {
      const nearestCodeCellIndex = viewModel.nearestCodeCellIndex(index);
      if (nearestCodeCellIndex > -1) {
        language = viewModel.cellAt(nearestCodeCellIndex).language;
      } else {
        language = defaultLanguage;
      }
    } else if (!cell && viewModel.length === 0) {
      const lastKernels = kernelHistoryService?.getKernels(viewModel.notebookDocument);
      if (lastKernels?.all.length) {
        const lastKernel = lastKernels.all[0];
        language = lastKernel.supportedLanguages[0] || defaultLanguage;
      } else {
        language = defaultLanguage;
      }
    } else {
      if (cell === void 0 && direction === "above") {
        language = viewModel.viewCells.find((cell2) => cell2.cellKind === CellKind.Code)?.language || defaultLanguage;
      } else {
        language = defaultLanguage;
      }
    }
    if (!supportedLanguages.includes(language)) {
      language = defaultLanguage;
    }
  } else {
    language = "markdown";
  }
  const insertIndex = cell ? direction === "above" ? index : nextIndex : index;
  return insertCellAtIndex(viewModel, insertIndex, initialText, language, type, void 0, [], true, true);
}
function insertCellAtIndex(viewModel, index, source, language, type, metadata, outputs, synchronous, pushUndoStop) {
  const endSelections = { kind: SelectionStateType.Index, focus: { start: index, end: index + 1 }, selections: [{ start: index, end: index + 1 }] };
  viewModel.notebookDocument.applyEdits([
    {
      editType: CellEditType.Replace,
      index,
      count: 0,
      cells: [
        {
          cellKind: type,
          language,
          mime: void 0,
          outputs,
          metadata,
          source
        }
      ]
    }
  ], synchronous, { kind: SelectionStateType.Index, focus: viewModel.getFocus(), selections: viewModel.getSelections() }, () => endSelections, void 0, pushUndoStop && !viewModel.options.isReadOnly);
  return viewModel.cellAt(index);
}
export {
  changeCellToKind,
  computeCellLinesContents,
  copyCellRange,
  insertCell,
  insertCellAtIndex,
  joinCellsWithSurrounds,
  joinNotebookCells,
  joinSelectedCells,
  moveCellRange,
  runDeleteAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvY2VsbE9wZXJhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJQnVsa0VkaXRTZXJ2aWNlLCBSZXNvdXJjZUVkaXQsIFJlc291cmNlVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9idWxrRWRpdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJUmVhZG9ubHlUZXh0QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQgfSBmcm9tICcuLi8uLi8uLi9idWxrRWRpdC9icm93c2VyL2J1bGtDZWxsRWRpdHMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQWN0aW9uQ29udGV4dCwgSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQgfSBmcm9tICcuL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIENlbGxGb2N1c01vZGUsIGV4cGFuZENlbGxSYW5nZXNXaXRoSGlkZGVuQ2VsbHMsIElBY3RpdmVOb3RlYm9va0VkaXRvciwgSUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbFZpZXdNb2RlbCwgTm90ZWJvb2tWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvbm90ZWJvb2tWaWV3TW9kZWxJbXBsLmpzJztcbmltcG9ydCB7IGNsb25lTm90ZWJvb2tDZWxsVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rQ2VsbFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kLCBJQ2VsbEVkaXRPcGVyYXRpb24sIElDZWxsUmVwbGFjZUVkaXQsIElPdXRwdXREdG8sIElTZWxlY3Rpb25TdGF0ZSwgTm90ZWJvb2tDZWxsTWV0YWRhdGEsIFNlbGVjdGlvblN0YXRlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBjZWxsUmFuZ2VDb250YWlucywgY2VsbFJhbmdlc1RvSW5kZXhlcywgSUNlbGxSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1JhbmdlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoYW5nZUNlbGxUb0tpbmQoa2luZDogQ2VsbEtpbmQsIGNvbnRleHQ6IElOb3RlYm9va0FjdGlvbkNvbnRleHQsIGxhbmd1YWdlPzogc3RyaW5nLCBtaW1lPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IHsgbm90ZWJvb2tFZGl0b3IgfSA9IGNvbnRleHQ7XG5cdGlmICghbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChub3RlYm9va0VkaXRvci5pc1JlYWRPbmx5KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGNvbnRleHQudWkgJiYgY29udGV4dC5jZWxsKSB7XG5cdFx0Ly8gYWN0aW9uIGZyb20gVUlcblx0XHRjb25zdCB7IGNlbGwgfSA9IGNvbnRleHQ7XG5cblx0XHRpZiAoY2VsbC5jZWxsS2luZCA9PT0ga2luZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRleHQgPSBjZWxsLmdldFRleHQoKTtcblx0XHRjb25zdCBpZHggPSBub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgoY2VsbCk7XG5cblx0XHRpZiAobGFuZ3VhZ2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgYXZhaWxhYmxlTGFuZ3VhZ2VzID0gbm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsPy5zdXBwb3J0ZWRMYW5ndWFnZXMgPz8gW107XG5cdFx0XHRsYW5ndWFnZSA9IGF2YWlsYWJsZUxhbmd1YWdlc1swXSA/PyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQ7XG5cdFx0fVxuXG5cdFx0bm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdGluZGV4OiBpZHgsXG5cdFx0XHRcdGNvdW50OiAxLFxuXHRcdFx0XHRjZWxsczogW3tcblx0XHRcdFx0XHRjZWxsS2luZDoga2luZCxcblx0XHRcdFx0XHRzb3VyY2U6IHRleHQsXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdFx0XHRcdG1pbWU6IG1pbWUgPz8gY2VsbC5taW1lLFxuXHRcdFx0XHRcdG91dHB1dHM6IGNlbGwubW9kZWwub3V0cHV0cyxcblx0XHRcdFx0XHRtZXRhZGF0YTogY2VsbC5tZXRhZGF0YSxcblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHRdLCB0cnVlLCB7XG5cdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRmb2N1czogbm90ZWJvb2tFZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRcdHNlbGVjdGlvbnM6IG5vdGVib29rRWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdH0sICgpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0Zm9jdXM6IG5vdGVib29rRWRpdG9yLmdldEZvY3VzKCksXG5cdFx0XHRcdHNlbGVjdGlvbnM6IG5vdGVib29rRWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdFx0fTtcblx0XHR9LCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdGNvbnN0IG5ld0NlbGwgPSBub3RlYm9va0VkaXRvci5jZWxsQXQoaWR4KTtcblx0XHRhd2FpdCBub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChuZXdDZWxsLCBjZWxsLmdldEVkaXRTdGF0ZSgpID09PSBDZWxsRWRpdFN0YXRlLkVkaXRpbmcgPyAnZWRpdG9yJyA6ICdjb250YWluZXInKTtcblx0fSBlbHNlIGlmIChjb250ZXh0LnNlbGVjdGVkQ2VsbHMpIHtcblx0XHRjb25zdCBzZWxlY3RlZENlbGxzID0gY29udGV4dC5zZWxlY3RlZENlbGxzO1xuXHRcdGNvbnN0IHJhd0VkaXRzOiBJQ2VsbEVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXG5cdFx0c2VsZWN0ZWRDZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IGtpbmQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdGV4dCA9IGNlbGwuZ2V0VGV4dCgpO1xuXHRcdFx0Y29uc3QgaWR4ID0gbm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEluZGV4KGNlbGwpO1xuXG5cdFx0XHRpZiAobGFuZ3VhZ2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBhdmFpbGFibGVMYW5ndWFnZXMgPSBub3RlYm9va0VkaXRvci5hY3RpdmVLZXJuZWw/LnN1cHBvcnRlZExhbmd1YWdlcyA/PyBbXTtcblx0XHRcdFx0bGFuZ3VhZ2UgPSBhdmFpbGFibGVMYW5ndWFnZXNbMF0gPz8gUExBSU5URVhUX0xBTkdVQUdFX0lEO1xuXHRcdFx0fVxuXG5cdFx0XHRyYXdFZGl0cy5wdXNoKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdGluZGV4OiBpZHgsXG5cdFx0XHRcdFx0Y291bnQ6IDEsXG5cdFx0XHRcdFx0Y2VsbHM6IFt7XG5cdFx0XHRcdFx0XHRjZWxsS2luZDoga2luZCxcblx0XHRcdFx0XHRcdHNvdXJjZTogdGV4dCxcblx0XHRcdFx0XHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRcdFx0XHRcdG1pbWU6IG1pbWUgPz8gY2VsbC5taW1lLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogY2VsbC5tb2RlbC5vdXRwdXRzLFxuXHRcdFx0XHRcdFx0bWV0YWRhdGE6IGNlbGwubWV0YWRhdGEsXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdG5vdGVib29rRWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKHJhd0VkaXRzLCB0cnVlLCB7XG5cdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRmb2N1czogbm90ZWJvb2tFZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRcdHNlbGVjdGlvbnM6IG5vdGVib29rRWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdH0sICgpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0Zm9jdXM6IG5vdGVib29rRWRpdG9yLmdldEZvY3VzKCksXG5cdFx0XHRcdHNlbGVjdGlvbnM6IG5vdGVib29rRWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdFx0fTtcblx0XHR9LCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5EZWxldGVBY3Rpb24oZWRpdG9yOiBJQWN0aXZlTm90ZWJvb2tFZGl0b3IsIGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRjb25zdCB0YXJnZXRDZWxsSW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KGNlbGwpO1xuXHRjb25zdCBjb250YWluaW5nU2VsZWN0aW9uID0gc2VsZWN0aW9ucy5maW5kKHNlbGVjdGlvbiA9PiBzZWxlY3Rpb24uc3RhcnQgPD0gdGFyZ2V0Q2VsbEluZGV4ICYmIHRhcmdldENlbGxJbmRleCA8IHNlbGVjdGlvbi5lbmQpO1xuXG5cdGNvbnN0IGNvbXB1dGVVbmRvUmVkbyA9ICFlZGl0b3IuaXNSZWFkT25seSB8fCB0ZXh0TW9kZWwudmlld1R5cGUgPT09ICdpbnRlcmFjdGl2ZSc7XG5cdGlmIChjb250YWluaW5nU2VsZWN0aW9uKSB7XG5cdFx0Y29uc3QgZWRpdHM6IElDZWxsUmVwbGFjZUVkaXRbXSA9IHNlbGVjdGlvbnMucmV2ZXJzZSgpLm1hcChzZWxlY3Rpb24gPT4gKHtcblx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IHNlbGVjdGlvbi5zdGFydCwgY291bnQ6IHNlbGVjdGlvbi5lbmQgLSBzZWxlY3Rpb24uc3RhcnQsIGNlbGxzOiBbXVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG5leHRDZWxsQWZ0ZXJDb250YWluaW5nU2VsZWN0aW9uID0gY29udGFpbmluZ1NlbGVjdGlvbi5lbmQgPj0gZWRpdG9yLmdldExlbmd0aCgpID8gdW5kZWZpbmVkIDogZWRpdG9yLmNlbGxBdChjb250YWluaW5nU2VsZWN0aW9uLmVuZCk7XG5cblx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSwgc2VsZWN0aW9uczogZWRpdG9yLmdldFNlbGVjdGlvbnMoKSB9LCAoKSA9PiB7XG5cdFx0XHRpZiAobmV4dENlbGxBZnRlckNvbnRhaW5pbmdTZWxlY3Rpb24pIHtcblx0XHRcdFx0Y29uc3QgY2VsbEluZGV4ID0gdGV4dE1vZGVsLmNlbGxzLmZpbmRJbmRleChjZWxsID0+IGNlbGwuaGFuZGxlID09PSBuZXh0Q2VsbEFmdGVyQ29udGFpbmluZ1NlbGVjdGlvbi5oYW5kbGUpO1xuXHRcdFx0XHRyZXR1cm4geyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiBjZWxsSW5kZXgsIGVuZDogY2VsbEluZGV4ICsgMSB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogY2VsbEluZGV4LCBlbmQ6IGNlbGxJbmRleCArIDEgfV0gfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0ZXh0TW9kZWwubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFzdENlbGxJbmRleCA9IHRleHRNb2RlbC5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdHJldHVybiB7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IGxhc3RDZWxsSW5kZXgsIGVuZDogbGFzdENlbGxJbmRleCArIDEgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IGxhc3RDZWxsSW5kZXgsIGVuZDogbGFzdENlbGxJbmRleCArIDEgfV0gfTtcblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMCB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAwIH1dIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LCB1bmRlZmluZWQsIGNvbXB1dGVVbmRvUmVkbyk7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgZm9jdXMgPSBlZGl0b3IuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBlZGl0czogSUNlbGxSZXBsYWNlRWRpdFtdID0gW3tcblx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IHRhcmdldENlbGxJbmRleCwgY291bnQ6IDEsIGNlbGxzOiBbXVxuXHRcdH1dO1xuXG5cdFx0Y29uc3QgZmluYWxTZWxlY3Rpb25zOiBJQ2VsbFJhbmdlW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHNlbGVjdGlvbnNbaV07XG5cblx0XHRcdGlmIChzZWxlY3Rpb24uZW5kIDw9IHRhcmdldENlbGxJbmRleCkge1xuXHRcdFx0XHRmaW5hbFNlbGVjdGlvbnMucHVzaChzZWxlY3Rpb24pO1xuXHRcdFx0fSBlbHNlIGlmIChzZWxlY3Rpb24uc3RhcnQgPiB0YXJnZXRDZWxsSW5kZXgpIHtcblx0XHRcdFx0ZmluYWxTZWxlY3Rpb25zLnB1c2goeyBzdGFydDogc2VsZWN0aW9uLnN0YXJ0IC0gMSwgZW5kOiBzZWxlY3Rpb24uZW5kIC0gMSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZpbmFsU2VsZWN0aW9ucy5wdXNoKHsgc3RhcnQ6IHRhcmdldENlbGxJbmRleCwgZW5kOiB0YXJnZXRDZWxsSW5kZXggKyAxIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IuY2VsbEF0KGZvY3VzLnN0YXJ0KSA9PT0gY2VsbCkge1xuXHRcdFx0Ly8gZm9jdXMgaXMgdGhlIHRhcmdldCwgZm9jdXMgaXMgYWxzbyBub3QgcGFydCBvZiBhbnkgc2VsZWN0aW9uXG5cdFx0XHRjb25zdCBuZXdGb2N1cyA9IGZvY3VzLmVuZCA9PT0gdGV4dE1vZGVsLmxlbmd0aCA/IHsgc3RhcnQ6IGZvY3VzLnN0YXJ0IC0gMSwgZW5kOiBmb2N1cy5lbmQgLSAxIH0gOiBmb2N1cztcblxuXHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoZWRpdHMsIHRydWUsIHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogZWRpdG9yLmdldEZvY3VzKCksIHNlbGVjdGlvbnM6IGVkaXRvci5nZXRTZWxlY3Rpb25zKCkgfSwgKCkgPT4gKHtcblx0XHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogbmV3Rm9jdXMsIHNlbGVjdGlvbnM6IGZpbmFsU2VsZWN0aW9uc1xuXHRcdFx0fSksIHVuZGVmaW5lZCwgY29tcHV0ZVVuZG9SZWRvKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdXNlcnMgZGVjaWRlIHRvIGRlbGV0ZSBhIGNlbGwgb3V0IG9mIGN1cnJlbnQgZm9jdXMvc2VsZWN0aW9uXG5cdFx0XHRjb25zdCBuZXdGb2N1cyA9IGZvY3VzLnN0YXJ0ID4gdGFyZ2V0Q2VsbEluZGV4ID8geyBzdGFydDogZm9jdXMuc3RhcnQgLSAxLCBlbmQ6IGZvY3VzLmVuZCAtIDEgfSA6IGZvY3VzO1xuXG5cdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSwgc2VsZWN0aW9uczogZWRpdG9yLmdldFNlbGVjdGlvbnMoKSB9LCAoKSA9PiAoe1xuXHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBuZXdGb2N1cywgc2VsZWN0aW9uczogZmluYWxTZWxlY3Rpb25zXG5cdFx0XHR9KSwgdW5kZWZpbmVkLCBjb21wdXRlVW5kb1JlZG8pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbW92ZUNlbGxSYW5nZShjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0LCBkaXJlY3Rpb246ICd1cCcgfCAnZG93bicpOiBQcm9taXNlPHZvaWQ+IHtcblx0aWYgKCFjb250ZXh0Lm5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvcjtcblx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRpZiAoZWRpdG9yLmlzUmVhZE9ubHkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgcmFuZ2U6IElDZWxsUmFuZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0aWYgKGNvbnRleHQuY2VsbCkge1xuXHRcdGNvbnN0IGlkeCA9IGVkaXRvci5nZXRDZWxsSW5kZXgoY29udGV4dC5jZWxsKTtcblx0XHRyYW5nZSA9IHsgc3RhcnQ6IGlkeCwgZW5kOiBpZHggKyAxIH07XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0Y29uc3QgbW9kZWxSYW5nZXMgPSBleHBhbmRDZWxsUmFuZ2VzV2l0aEhpZGRlbkNlbGxzKGVkaXRvciwgc2VsZWN0aW9ucyk7XG5cdFx0cmFuZ2UgPSBtb2RlbFJhbmdlc1swXTtcblx0fVxuXG5cdGlmICghcmFuZ2UgfHwgcmFuZ2Uuc3RhcnQgPT09IHJhbmdlLmVuZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChkaXJlY3Rpb24gPT09ICd1cCcpIHtcblx0XHRpZiAocmFuZ2Uuc3RhcnQgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleEFib3ZlID0gcmFuZ2Uuc3RhcnQgLSAxO1xuXHRcdGNvbnN0IGZpbmFsU2VsZWN0aW9uID0geyBzdGFydDogcmFuZ2Uuc3RhcnQgLSAxLCBlbmQ6IHJhbmdlLmVuZCAtIDEgfTtcblx0XHRjb25zdCBmb2N1cyA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3IuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBuZXdGb2N1cyA9IGNlbGxSYW5nZUNvbnRhaW5zKHJhbmdlLCBmb2N1cykgPyB7IHN0YXJ0OiBmb2N1cy5zdGFydCAtIDEsIGVuZDogZm9jdXMuZW5kIC0gMSB9IDogeyBzdGFydDogcmFuZ2Uuc3RhcnQgLSAxLCBlbmQ6IHJhbmdlLnN0YXJ0IH07XG5cdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1vdmUsXG5cdFx0XHRcdGluZGV4OiBpbmRleEFib3ZlLFxuXHRcdFx0XHRsZW5ndGg6IDEsXG5cdFx0XHRcdG5ld0lkeDogcmFuZ2UuZW5kIC0gMVxuXHRcdFx0fV0sXG5cdFx0XHR0cnVlLFxuXHRcdFx0e1xuXHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRcdGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRcdFx0c2VsZWN0aW9uczogZWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdFx0fSxcblx0XHRcdCgpID0+ICh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IG5ld0ZvY3VzLCBzZWxlY3Rpb25zOiBbZmluYWxTZWxlY3Rpb25dIH0pLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cdFx0Y29uc3QgZm9jdXNSYW5nZSA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKClbMF0gPz8gZWRpdG9yLmdldEZvY3VzKCk7XG5cdFx0ZWRpdG9yLnJldmVhbENlbGxSYW5nZUluVmlldyhmb2N1c1JhbmdlKTtcblx0fSBlbHNlIHtcblx0XHRpZiAocmFuZ2UuZW5kID49IHRleHRNb2RlbC5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleEJlbG93ID0gcmFuZ2UuZW5kO1xuXHRcdGNvbnN0IGZpbmFsU2VsZWN0aW9uID0geyBzdGFydDogcmFuZ2Uuc3RhcnQgKyAxLCBlbmQ6IHJhbmdlLmVuZCArIDEgfTtcblx0XHRjb25zdCBmb2N1cyA9IGVkaXRvci5nZXRGb2N1cygpO1xuXHRcdGNvbnN0IG5ld0ZvY3VzID0gY2VsbFJhbmdlQ29udGFpbnMocmFuZ2UsIGZvY3VzKSA/IHsgc3RhcnQ6IGZvY3VzLnN0YXJ0ICsgMSwgZW5kOiBmb2N1cy5lbmQgKyAxIH0gOiB7IHN0YXJ0OiByYW5nZS5zdGFydCArIDEsIGVuZDogcmFuZ2Uuc3RhcnQgKyAyIH07XG5cblx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7XG5cdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTW92ZSxcblx0XHRcdFx0aW5kZXg6IGluZGV4QmVsb3csXG5cdFx0XHRcdGxlbmd0aDogMSxcblx0XHRcdFx0bmV3SWR4OiByYW5nZS5zdGFydFxuXHRcdFx0fV0sXG5cdFx0XHR0cnVlLFxuXHRcdFx0e1xuXHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsXG5cdFx0XHRcdGZvY3VzOiBlZGl0b3IuZ2V0Rm9jdXMoKSxcblx0XHRcdFx0c2VsZWN0aW9uczogZWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHRcdFx0fSxcblx0XHRcdCgpID0+ICh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IG5ld0ZvY3VzLCBzZWxlY3Rpb25zOiBbZmluYWxTZWxlY3Rpb25dIH0pLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cblx0XHRjb25zdCBmb2N1c1JhbmdlID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKVswXSA/PyBlZGl0b3IuZ2V0Rm9jdXMoKTtcblx0XHRlZGl0b3IucmV2ZWFsQ2VsbFJhbmdlSW5WaWV3KGZvY3VzUmFuZ2UpO1xuXHR9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5Q2VsbFJhbmdlKGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0LCBkaXJlY3Rpb246ICd1cCcgfCAnZG93bicpOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvcjtcblx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cblx0aWYgKGVkaXRvci5pc1JlYWRPbmx5KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0bGV0IHJhbmdlOiBJQ2VsbFJhbmdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGlmIChjb250ZXh0LnVpKSB7XG5cdFx0Y29uc3QgdGFyZ2V0Q2VsbCA9IGNvbnRleHQuY2VsbDtcblx0XHRjb25zdCB0YXJnZXRDZWxsSW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KHRhcmdldENlbGwpO1xuXHRcdHJhbmdlID0geyBzdGFydDogdGFyZ2V0Q2VsbEluZGV4LCBlbmQ6IHRhcmdldENlbGxJbmRleCArIDEgfTtcblx0fSBlbHNlIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRjb25zdCBtb2RlbFJhbmdlcyA9IGV4cGFuZENlbGxSYW5nZXNXaXRoSGlkZGVuQ2VsbHMoZWRpdG9yLCBzZWxlY3Rpb25zKTtcblx0XHRyYW5nZSA9IG1vZGVsUmFuZ2VzWzBdO1xuXHR9XG5cblx0aWYgKCFyYW5nZSB8fCByYW5nZS5zdGFydCA9PT0gcmFuZ2UuZW5kKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGRpcmVjdGlvbiA9PT0gJ3VwJykge1xuXHRcdC8vIGluc2VydCB1cCwgd2l0aG91dCBjaGFuZ2luZyBmb2N1cyBhbmQgc2VsZWN0aW9uc1xuXHRcdGNvbnN0IGZvY3VzID0gZWRpdG9yLmdldEZvY3VzKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdGluZGV4OiByYW5nZS5lbmQsXG5cdFx0XHRcdGNvdW50OiAwLFxuXHRcdFx0XHRjZWxsczogY2VsbFJhbmdlc1RvSW5kZXhlcyhbcmFuZ2VdKS5tYXAoaW5kZXggPT4gY2xvbmVOb3RlYm9va0NlbGxUZXh0TW9kZWwoZWRpdG9yLmNlbGxBdChpbmRleCkhLm1vZGVsKSlcblx0XHRcdH1dLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHtcblx0XHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdFx0XHRmb2N1czogZm9jdXMsXG5cdFx0XHRcdHNlbGVjdGlvbnM6IHNlbGVjdGlvbnNcblx0XHRcdH0sXG5cdFx0XHQoKSA9PiAoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiBmb2N1cywgc2VsZWN0aW9uczogc2VsZWN0aW9ucyB9KSxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHRydWVcblx0XHQpO1xuXHR9IGVsc2Uge1xuXHRcdC8vIGluc2VydCBkb3duLCBtb3ZlIHNlbGVjdGlvbnNcblx0XHRjb25zdCBmb2N1cyA9IGVkaXRvci5nZXRGb2N1cygpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGNvbnN0IG5ld0NlbGxzID0gY2VsbFJhbmdlc1RvSW5kZXhlcyhbcmFuZ2VdKS5tYXAoaW5kZXggPT4gY2xvbmVOb3RlYm9va0NlbGxUZXh0TW9kZWwoZWRpdG9yLmNlbGxBdChpbmRleCkhLm1vZGVsKSk7XG5cdFx0Y29uc3QgY291bnREZWx0YSA9IG5ld0NlbGxzLmxlbmd0aDtcblx0XHRjb25zdCBuZXdGb2N1cyA9IGNvbnRleHQudWkgPyBmb2N1cyA6IHsgc3RhcnQ6IGZvY3VzLnN0YXJ0ICsgY291bnREZWx0YSwgZW5kOiBmb2N1cy5lbmQgKyBjb3VudERlbHRhIH07XG5cdFx0Y29uc3QgbmV3U2VsZWN0aW9ucyA9IGNvbnRleHQudWkgPyBzZWxlY3Rpb25zIDogW3sgc3RhcnQ6IHJhbmdlLnN0YXJ0ICsgY291bnREZWx0YSwgZW5kOiByYW5nZS5lbmQgKyBjb3VudERlbHRhIH1dO1xuXHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRpbmRleDogcmFuZ2UuZW5kLFxuXHRcdFx0XHRjb3VudDogMCxcblx0XHRcdFx0Y2VsbHM6IGNlbGxSYW5nZXNUb0luZGV4ZXMoW3JhbmdlXSkubWFwKGluZGV4ID0+IGNsb25lTm90ZWJvb2tDZWxsVGV4dE1vZGVsKGVkaXRvci5jZWxsQXQoaW5kZXgpIS5tb2RlbCkpXG5cdFx0XHR9XSxcblx0XHRcdHRydWUsXG5cdFx0XHR7XG5cdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0Zm9jdXM6IGZvY3VzLFxuXHRcdFx0XHRzZWxlY3Rpb25zOiBzZWxlY3Rpb25zXG5cdFx0XHR9LFxuXHRcdFx0KCkgPT4gKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogbmV3Rm9jdXMsIHNlbGVjdGlvbnM6IG5ld1NlbGVjdGlvbnMgfSksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR0cnVlXG5cdFx0KTtcblxuXHRcdGNvbnN0IGZvY3VzUmFuZ2UgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpWzBdID8/IGVkaXRvci5nZXRGb2N1cygpO1xuXHRcdGVkaXRvci5yZXZlYWxDZWxsUmFuZ2VJblZpZXcoZm9jdXNSYW5nZSk7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGpvaW5TZWxlY3RlZENlbGxzKGJ1bGtFZGl0U2VydmljZTogSUJ1bGtFZGl0U2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsIGNvbnRleHQ6IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGVkaXRvciA9IGNvbnRleHQubm90ZWJvb2tFZGl0b3I7XG5cdGlmIChlZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGVkaXRzOiBSZXNvdXJjZUVkaXRbXSA9IFtdO1xuXHRjb25zdCBjZWxsczogSUNlbGxWaWV3TW9kZWxbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpKSB7XG5cdFx0Y2VsbHMucHVzaCguLi5lZGl0b3IuZ2V0Q2VsbHNJblJhbmdlKHNlbGVjdGlvbikpO1xuXHR9XG5cblx0aWYgKGNlbGxzLmxlbmd0aCA8PSAxKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Ly8gY2hlY2sgaWYgYWxsIGNlbGxzIGFyZSBvZiB0aGUgc2FtZSBraW5kXG5cdGNvbnN0IGNlbGxLaW5kID0gY2VsbHNbMF0uY2VsbEtpbmQ7XG5cdGNvbnN0IGlzU2FtZUtpbmQgPSBjZWxscy5ldmVyeShjZWxsID0+IGNlbGwuY2VsbEtpbmQgPT09IGNlbGxLaW5kKTtcblx0aWYgKCFpc1NhbWVLaW5kKSB7XG5cdFx0Ly8gY2Fubm90IGpvaW4gY2VsbHMgb2YgZGlmZmVyZW50IGtpbmRzXG5cdFx0Ly8gc2hvdyB3YXJuaW5nIGFuZCBxdWl0XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdub3RlYm9va0FjdGlvbnMuam9pblNlbGVjdGVkQ2VsbHMnLCBcIkNhbm5vdCBqb2luIGNlbGxzIG9mIGRpZmZlcmVudCBraW5kc1wiKTtcblx0XHRyZXR1cm4gbm90aWZpY2F0aW9uU2VydmljZS53YXJuKG1lc3NhZ2UpO1xuXHR9XG5cblx0Ly8gbWVyZ2UgYWxsIGNlbGxzIGNvbnRlbnQgaW50byBmaXJzdCBjZWxsXG5cdGNvbnN0IGZpcnN0Q2VsbCA9IGNlbGxzWzBdO1xuXHRjb25zdCBpbnNlcnRDb250ZW50ID0gY2VsbHMubWFwKGNlbGwgPT4gY2VsbC5nZXRUZXh0KCkpLmpvaW4oZmlyc3RDZWxsLnRleHRCdWZmZXIuZ2V0RU9MKCkpO1xuXHRjb25zdCBmaXJzdFNlbGVjdGlvbiA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKClbMF07XG5cdGVkaXRzLnB1c2goXG5cdFx0bmV3IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdChlZGl0b3IudGV4dE1vZGVsLnVyaSxcblx0XHRcdHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRpbmRleDogZmlyc3RTZWxlY3Rpb24uc3RhcnQsXG5cdFx0XHRcdGNvdW50OiBmaXJzdFNlbGVjdGlvbi5lbmQgLSBmaXJzdFNlbGVjdGlvbi5zdGFydCxcblx0XHRcdFx0Y2VsbHM6IFt7XG5cdFx0XHRcdFx0Y2VsbEtpbmQ6IGZpcnN0Q2VsbC5jZWxsS2luZCxcblx0XHRcdFx0XHRzb3VyY2U6IGluc2VydENvbnRlbnQsXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IGZpcnN0Q2VsbC5sYW5ndWFnZSxcblx0XHRcdFx0XHRtaW1lOiBmaXJzdENlbGwubWltZSxcblx0XHRcdFx0XHRvdXRwdXRzOiBmaXJzdENlbGwubW9kZWwub3V0cHV0cyxcblx0XHRcdFx0XHRtZXRhZGF0YTogZmlyc3RDZWxsLm1ldGFkYXRhLFxuXHRcdFx0XHR9XVxuXHRcdFx0fVxuXHRcdClcblx0KTtcblxuXHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLnNsaWNlKDEpKSB7XG5cdFx0ZWRpdHMucHVzaChuZXcgUmVzb3VyY2VOb3RlYm9va0NlbGxFZGl0KGVkaXRvci50ZXh0TW9kZWwudXJpLFxuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdGluZGV4OiBzZWxlY3Rpb24uc3RhcnQsXG5cdFx0XHRcdGNvdW50OiBzZWxlY3Rpb24uZW5kIC0gc2VsZWN0aW9uLnN0YXJ0LFxuXHRcdFx0XHRjZWxsczogW11cblx0XHRcdH0pKTtcblx0fVxuXG5cdGlmIChlZGl0cy5sZW5ndGgpIHtcblx0XHRhd2FpdCBidWxrRWRpdFNlcnZpY2UuYXBwbHkoXG5cdFx0XHRlZGl0cyxcblx0XHRcdHsgcXVvdGFibGVMYWJlbDogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5qb2luU2VsZWN0ZWRDZWxscy5sYWJlbCcsIFwiSm9pbiBOb3RlYm9vayBDZWxsc1wiKSB9XG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gam9pbk5vdGVib29rQ2VsbHMoZWRpdG9yOiBJQWN0aXZlTm90ZWJvb2tFZGl0b3IsIHJhbmdlOiBJQ2VsbFJhbmdlLCBkaXJlY3Rpb246ICdhYm92ZScgfCAnYmVsb3cnLCBjb25zdHJhaW50PzogQ2VsbEtpbmQpOiBQcm9taXNlPHsgZWRpdHM6IFJlc291cmNlRWRpdFtdOyBjZWxsOiBJQ2VsbFZpZXdNb2RlbDsgZW5kRm9jdXM6IElDZWxsUmFuZ2U7IGVuZFNlbGVjdGlvbnM6IElDZWxsUmFuZ2VbXSB9IHwgbnVsbD4ge1xuXHRpZiAoZWRpdG9yLmlzUmVhZE9ubHkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdGNvbnN0IGNlbGxzID0gZWRpdG9yLmdldENlbGxzSW5SYW5nZShyYW5nZSk7XG5cblx0aWYgKCFjZWxscy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGlmIChyYW5nZS5zdGFydCA9PT0gMCAmJiBkaXJlY3Rpb24gPT09ICdhYm92ZScpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGlmIChyYW5nZS5lbmQgPT09IHRleHRNb2RlbC5sZW5ndGggJiYgZGlyZWN0aW9uID09PSAnYmVsb3cnKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNlbGxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgY2VsbCA9IGNlbGxzW2ldO1xuXG5cdFx0aWYgKGNvbnN0cmFpbnQgJiYgY2VsbC5jZWxsS2luZCAhPT0gY29uc3RyYWludCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGRpcmVjdGlvbiA9PT0gJ2Fib3ZlJykge1xuXHRcdGNvbnN0IGFib3ZlID0gZWRpdG9yLmNlbGxBdChyYW5nZS5zdGFydCAtIDEpIGFzIENlbGxWaWV3TW9kZWw7XG5cdFx0aWYgKGNvbnN0cmFpbnQgJiYgYWJvdmUuY2VsbEtpbmQgIT09IGNvbnN0cmFpbnQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluc2VydENvbnRlbnQgPSBjZWxscy5tYXAoY2VsbCA9PiAoY2VsbC50ZXh0QnVmZmVyLmdldEVPTCgpID8/ICcnKSArIGNlbGwuZ2V0VGV4dCgpKS5qb2luKCcnKTtcblx0XHRjb25zdCBhYm92ZUNlbGxMaW5lQ291bnQgPSBhYm92ZS50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGFib3ZlQ2VsbExhc3RMaW5lRW5kQ29sdW1uID0gYWJvdmUudGV4dEJ1ZmZlci5nZXRMaW5lTGVuZ3RoKGFib3ZlQ2VsbExpbmVDb3VudCk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdHM6IFtcblx0XHRcdFx0bmV3IFJlc291cmNlVGV4dEVkaXQoYWJvdmUudXJpLCB7IHJhbmdlOiBuZXcgUmFuZ2UoYWJvdmVDZWxsTGluZUNvdW50LCBhYm92ZUNlbGxMYXN0TGluZUVuZENvbHVtbiArIDEsIGFib3ZlQ2VsbExpbmVDb3VudCwgYWJvdmVDZWxsTGFzdExpbmVFbmRDb2x1bW4gKyAxKSwgdGV4dDogaW5zZXJ0Q29udGVudCB9KSxcblx0XHRcdFx0bmV3IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCh0ZXh0TW9kZWwudXJpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSxcblx0XHRcdFx0XHRcdGluZGV4OiByYW5nZS5zdGFydCxcblx0XHRcdFx0XHRcdGNvdW50OiByYW5nZS5lbmQgLSByYW5nZS5zdGFydCxcblx0XHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KVxuXHRcdFx0XSxcblx0XHRcdGNlbGw6IGFib3ZlLFxuXHRcdFx0ZW5kRm9jdXM6IHsgc3RhcnQ6IHJhbmdlLnN0YXJ0IC0gMSwgZW5kOiByYW5nZS5zdGFydCB9LFxuXHRcdFx0ZW5kU2VsZWN0aW9uczogW3sgc3RhcnQ6IHJhbmdlLnN0YXJ0IC0gMSwgZW5kOiByYW5nZS5zdGFydCB9XVxuXHRcdH07XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgYmVsb3cgPSBlZGl0b3IuY2VsbEF0KHJhbmdlLmVuZCkgYXMgQ2VsbFZpZXdNb2RlbDtcblx0XHRpZiAoY29uc3RyYWludCAmJiBiZWxvdy5jZWxsS2luZCAhPT0gY29uc3RyYWludCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2VsbCA9IGNlbGxzWzBdO1xuXHRcdGNvbnN0IHJlc3RDZWxscyA9IFsuLi5jZWxscy5zbGljZSgxKSwgYmVsb3ddO1xuXHRcdGNvbnN0IGluc2VydENvbnRlbnQgPSByZXN0Q2VsbHMubWFwKGNsID0+IChjbC50ZXh0QnVmZmVyLmdldEVPTCgpID8/ICcnKSArIGNsLmdldFRleHQoKSkuam9pbignJyk7XG5cblx0XHRjb25zdCBjZWxsTGluZUNvdW50ID0gY2VsbC50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGNlbGxMYXN0TGluZUVuZENvbHVtbiA9IGNlbGwudGV4dEJ1ZmZlci5nZXRMaW5lTGVuZ3RoKGNlbGxMaW5lQ291bnQpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRzOiBbXG5cdFx0XHRcdG5ldyBSZXNvdXJjZVRleHRFZGl0KGNlbGwudXJpLCB7IHJhbmdlOiBuZXcgUmFuZ2UoY2VsbExpbmVDb3VudCwgY2VsbExhc3RMaW5lRW5kQ29sdW1uICsgMSwgY2VsbExpbmVDb3VudCwgY2VsbExhc3RMaW5lRW5kQ29sdW1uICsgMSksIHRleHQ6IGluc2VydENvbnRlbnQgfSksXG5cdFx0XHRcdG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQodGV4dE1vZGVsLnVyaSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdFx0XHRpbmRleDogcmFuZ2Uuc3RhcnQgKyAxLFxuXHRcdFx0XHRcdFx0Y291bnQ6IHJhbmdlLmVuZCAtIHJhbmdlLnN0YXJ0LFxuXHRcdFx0XHRcdFx0Y2VsbHM6IFtdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpXG5cdFx0XHRdLFxuXHRcdFx0Y2VsbCxcblx0XHRcdGVuZEZvY3VzOiB7IHN0YXJ0OiByYW5nZS5zdGFydCwgZW5kOiByYW5nZS5zdGFydCArIDEgfSxcblx0XHRcdGVuZFNlbGVjdGlvbnM6IFt7IHN0YXJ0OiByYW5nZS5zdGFydCwgZW5kOiByYW5nZS5zdGFydCArIDEgfV1cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBqb2luQ2VsbHNXaXRoU3Vycm91bmRzKGJ1bGtFZGl0U2VydmljZTogSUJ1bGtFZGl0U2VydmljZSwgY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQsIGRpcmVjdGlvbjogJ2Fib3ZlJyB8ICdiZWxvdycpOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvcjtcblx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLmdldFZpZXdNb2RlbCgpIGFzIE5vdGVib29rVmlld01vZGVsO1xuXHRsZXQgcmV0OiB7XG5cdFx0ZWRpdHM6IFJlc291cmNlRWRpdFtdO1xuXHRcdGNlbGw6IElDZWxsVmlld01vZGVsO1xuXHRcdGVuZEZvY3VzOiBJQ2VsbFJhbmdlO1xuXHRcdGVuZFNlbGVjdGlvbnM6IElDZWxsUmFuZ2VbXTtcblx0fSB8IG51bGwgPSBudWxsO1xuXG5cdGlmIChjb250ZXh0LnVpKSB7XG5cdFx0Y29uc3QgZm9jdXNNb2RlID0gY29udGV4dC5jZWxsLmZvY3VzTW9kZTtcblx0XHRjb25zdCBjZWxsSW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KGNvbnRleHQuY2VsbCk7XG5cdFx0cmV0ID0gYXdhaXQgam9pbk5vdGVib29rQ2VsbHMoZWRpdG9yLCB7IHN0YXJ0OiBjZWxsSW5kZXgsIGVuZDogY2VsbEluZGV4ICsgMSB9LCBkaXJlY3Rpb24pO1xuXHRcdGlmICghcmV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgYnVsa0VkaXRTZXJ2aWNlLmFwcGx5KFxuXHRcdFx0cmV0Py5lZGl0cyxcblx0XHRcdHsgcXVvdGFibGVMYWJlbDogJ0pvaW4gTm90ZWJvb2sgQ2VsbHMnIH1cblx0XHQpO1xuXHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiByZXQuZW5kRm9jdXMsIHNlbGVjdGlvbnM6IHJldC5lbmRTZWxlY3Rpb25zIH0pO1xuXHRcdHJldC5jZWxsLnVwZGF0ZUVkaXRTdGF0ZShDZWxsRWRpdFN0YXRlLkVkaXRpbmcsICdqb2luQ2VsbHNXaXRoU3Vycm91bmRzJyk7XG5cdFx0ZWRpdG9yLnJldmVhbENlbGxSYW5nZUluVmlldyhlZGl0b3IuZ2V0Rm9jdXMoKSk7XG5cdFx0aWYgKGZvY3VzTW9kZSA9PT0gQ2VsbEZvY3VzTW9kZS5FZGl0b3IpIHtcblx0XHRcdHJldC5jZWxsLmZvY3VzTW9kZSA9IENlbGxGb2N1c01vZGUuRWRpdG9yO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoIXNlbGVjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXMgPSBlZGl0b3IuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBmb2N1c01vZGUgPSBlZGl0b3IuY2VsbEF0KGZvY3VzLnN0YXJ0KT8uZm9jdXNNb2RlO1xuXG5cdFx0Y29uc3QgZWRpdHM6IFJlc291cmNlRWRpdFtdID0gW107XG5cdFx0bGV0IGNlbGw6IElDZWxsVmlld01vZGVsIHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgY2VsbHM6IElDZWxsVmlld01vZGVsW10gPSBbXTtcblxuXHRcdGZvciAobGV0IGkgPSBzZWxlY3Rpb25zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBzZWxlY3Rpb25zW2ldO1xuXHRcdFx0Y29uc3QgY29udGFpbkZvY3VzID0gY2VsbFJhbmdlQ29udGFpbnMoc2VsZWN0aW9uLCBmb2N1cyk7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0c2VsZWN0aW9uLmVuZCA+PSB0ZXh0TW9kZWwubGVuZ3RoICYmIGRpcmVjdGlvbiA9PT0gJ2JlbG93J1xuXHRcdFx0XHR8fCBzZWxlY3Rpb24uc3RhcnQgPT09IDAgJiYgZGlyZWN0aW9uID09PSAnYWJvdmUnXG5cdFx0XHQpIHtcblx0XHRcdFx0aWYgKGNvbnRhaW5Gb2N1cykge1xuXHRcdFx0XHRcdGNlbGwgPSBlZGl0b3IuY2VsbEF0KGZvY3VzLnN0YXJ0KSE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjZWxscy5wdXNoKC4uLmVkaXRvci5nZXRDZWxsc0luUmFuZ2Uoc2VsZWN0aW9uKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzaW5nbGVSZXQgPSBhd2FpdCBqb2luTm90ZWJvb2tDZWxscyhlZGl0b3IsIHNlbGVjdGlvbiwgZGlyZWN0aW9uKTtcblxuXHRcdFx0aWYgKCFzaW5nbGVSZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0cy5wdXNoKC4uLnNpbmdsZVJldC5lZGl0cyk7XG5cdFx0XHRjZWxscy5wdXNoKHNpbmdsZVJldC5jZWxsKTtcblxuXHRcdFx0aWYgKGNvbnRhaW5Gb2N1cykge1xuXHRcdFx0XHRjZWxsID0gc2luZ2xlUmV0LmNlbGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFlZGl0cy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWNlbGwgfHwgIWNlbGxzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IGJ1bGtFZGl0U2VydmljZS5hcHBseShcblx0XHRcdGVkaXRzLFxuXHRcdFx0eyBxdW90YWJsZUxhYmVsOiAnSm9pbiBOb3RlYm9vayBDZWxscycgfVxuXHRcdCk7XG5cblx0XHRjZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0Y2VsbC51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nLCAnam9pbkNlbGxzV2l0aFN1cnJvdW5kcycpO1xuXHRcdH0pO1xuXG5cdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5IYW5kbGUsIHByaW1hcnk6IGNlbGwuaGFuZGxlLCBzZWxlY3Rpb25zOiBjZWxscy5tYXAoY2VsbCA9PiBjZWxsLmhhbmRsZSkgfSk7XG5cdFx0ZWRpdG9yLnJldmVhbENlbGxSYW5nZUluVmlldyhlZGl0b3IuZ2V0Rm9jdXMoKSk7XG5cdFx0Y29uc3QgbmV3Rm9jdXNlZENlbGwgPSBlZGl0b3IuY2VsbEF0KGVkaXRvci5nZXRGb2N1cygpLnN0YXJ0KTtcblx0XHRpZiAoZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLkVkaXRvciAmJiBuZXdGb2N1c2VkQ2VsbCkge1xuXHRcdFx0bmV3Rm9jdXNlZENlbGwuZm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5FZGl0b3I7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIF9zcGxpdFBvaW50c1RvQm91bmRhcmllcyhzcGxpdFBvaW50czogSVBvc2l0aW9uW10sIHRleHRCdWZmZXI6IElSZWFkb25seVRleHRCdWZmZXIpOiBJUG9zaXRpb25bXSB8IG51bGwge1xuXHRjb25zdCBib3VuZGFyaWVzOiBJUG9zaXRpb25bXSA9IFtdO1xuXHRjb25zdCBsaW5lQ250ID0gdGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0Y29uc3QgZ2V0TGluZUxlbiA9IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRyZXR1cm4gdGV4dEJ1ZmZlci5nZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpO1xuXHR9O1xuXG5cdC8vIHNwbGl0IHBvaW50cyBuZWVkIHRvIGJlIHNvcnRlZFxuXHRzcGxpdFBvaW50cyA9IHNwbGl0UG9pbnRzLnNvcnQoKGwsIHIpID0+IHtcblx0XHRjb25zdCBsaW5lRGlmZiA9IGwubGluZU51bWJlciAtIHIubGluZU51bWJlcjtcblx0XHRjb25zdCBjb2x1bW5EaWZmID0gbC5jb2x1bW4gLSByLmNvbHVtbjtcblx0XHRyZXR1cm4gbGluZURpZmYgIT09IDAgPyBsaW5lRGlmZiA6IGNvbHVtbkRpZmY7XG5cdH0pO1xuXG5cdGZvciAobGV0IHNwIG9mIHNwbGl0UG9pbnRzKSB7XG5cdFx0aWYgKGdldExpbmVMZW4oc3AubGluZU51bWJlcikgKyAxID09PSBzcC5jb2x1bW4gJiYgc3AuY29sdW1uICE9PSAxIC8qKiBlbXB0eSBsaW5lICovICYmIHNwLmxpbmVOdW1iZXIgPCBsaW5lQ250KSB7XG5cdFx0XHRzcCA9IG5ldyBQb3NpdGlvbihzcC5saW5lTnVtYmVyICsgMSwgMSk7XG5cdFx0fVxuXHRcdF9wdXNoSWZBYnNlbnQoYm91bmRhcmllcywgc3ApO1xuXHR9XG5cblx0aWYgKGJvdW5kYXJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvLyBib3VuZGFyaWVzIGFscmVhZHkgc29ydGVkIGFuZCBub3QgZW1wdHlcblx0Y29uc3QgbW9kZWxTdGFydCA9IG5ldyBQb3NpdGlvbigxLCAxKTtcblx0Y29uc3QgbW9kZWxFbmQgPSBuZXcgUG9zaXRpb24obGluZUNudCwgZ2V0TGluZUxlbihsaW5lQ250KSArIDEpO1xuXHRyZXR1cm4gW21vZGVsU3RhcnQsIC4uLmJvdW5kYXJpZXMsIG1vZGVsRW5kXTtcbn1cblxuZnVuY3Rpb24gX3B1c2hJZkFic2VudChwb3NpdGlvbnM6IElQb3NpdGlvbltdLCBwOiBJUG9zaXRpb24pIHtcblx0Y29uc3QgbGFzdCA9IHBvc2l0aW9ucy5sZW5ndGggPiAwID8gcG9zaXRpb25zW3Bvc2l0aW9ucy5sZW5ndGggLSAxXSA6IHVuZGVmaW5lZDtcblx0aWYgKCFsYXN0IHx8IGxhc3QubGluZU51bWJlciAhPT0gcC5saW5lTnVtYmVyIHx8IGxhc3QuY29sdW1uICE9PSBwLmNvbHVtbikge1xuXHRcdHBvc2l0aW9ucy5wdXNoKHApO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlQ2VsbExpbmVzQ29udGVudHMoY2VsbDogSUNlbGxWaWV3TW9kZWwsIHNwbGl0UG9pbnRzOiBJUG9zaXRpb25bXSk6IHN0cmluZ1tdIHwgbnVsbCB7XG5cdGNvbnN0IHJhbmdlQm91bmRhcmllcyA9IF9zcGxpdFBvaW50c1RvQm91bmRhcmllcyhzcGxpdFBvaW50cywgY2VsbC50ZXh0QnVmZmVyKTtcblx0aWYgKCFyYW5nZUJvdW5kYXJpZXMpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRjb25zdCBuZXdMaW5lTW9kZWxzOiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGxldCBpID0gMTsgaSA8IHJhbmdlQm91bmRhcmllcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IHN0YXJ0ID0gcmFuZ2VCb3VuZGFyaWVzW2kgLSAxXTtcblx0XHRjb25zdCBlbmQgPSByYW5nZUJvdW5kYXJpZXNbaV07XG5cblx0XHRuZXdMaW5lTW9kZWxzLnB1c2goY2VsbC50ZXh0QnVmZmVyLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2Uoc3RhcnQubGluZU51bWJlciwgc3RhcnQuY29sdW1uLCBlbmQubGluZU51bWJlciwgZW5kLmNvbHVtbiksIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpKTtcblx0fVxuXG5cdHJldHVybiBuZXdMaW5lTW9kZWxzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0Q2VsbChcblx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRlZGl0b3I6IElBY3RpdmVOb3RlYm9va0VkaXRvcixcblx0aW5kZXg6IG51bWJlcixcblx0dHlwZTogQ2VsbEtpbmQsXG5cdGRpcmVjdGlvbjogJ2Fib3ZlJyB8ICdiZWxvdycgPSAnYWJvdmUnLFxuXHRpbml0aWFsVGV4dDogc3RyaW5nID0gJycsXG5cdHVpOiBib29sZWFuID0gZmFsc2UsXG5cdGtlcm5lbEhpc3RvcnlTZXJ2aWNlPzogSU5vdGVib29rS2VybmVsSGlzdG9yeVNlcnZpY2Vcbikge1xuXHRjb25zdCB2aWV3TW9kZWwgPSBlZGl0b3IuZ2V0Vmlld01vZGVsKCkgYXMgTm90ZWJvb2tWaWV3TW9kZWw7XG5cdGNvbnN0IGFjdGl2ZUtlcm5lbCA9IGVkaXRvci5hY3RpdmVLZXJuZWw7XG5cdGlmICh2aWV3TW9kZWwub3B0aW9ucy5pc1JlYWRPbmx5KSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBjZWxsID0gZWRpdG9yLmNlbGxBdChpbmRleCk7XG5cdGNvbnN0IG5leHRJbmRleCA9IHVpID8gdmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KGluZGV4KSA6IGluZGV4ICsgMTtcblx0bGV0IGxhbmd1YWdlO1xuXHRpZiAodHlwZSA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdGNvbnN0IHN1cHBvcnRlZExhbmd1YWdlcyA9IGFjdGl2ZUtlcm5lbD8uc3VwcG9ydGVkTGFuZ3VhZ2VzID8/IGxhbmd1YWdlU2VydmljZS5nZXRSZWdpc3RlcmVkTGFuZ3VhZ2VJZHMoKTtcblx0XHRjb25zdCBkZWZhdWx0TGFuZ3VhZ2UgPSBzdXBwb3J0ZWRMYW5ndWFnZXNbMF0gfHwgUExBSU5URVhUX0xBTkdVQUdFX0lEO1xuXG5cdFx0aWYgKGNlbGw/LmNlbGxLaW5kID09PSBDZWxsS2luZC5Db2RlKSB7XG5cdFx0XHRsYW5ndWFnZSA9IGNlbGwubGFuZ3VhZ2U7XG5cdFx0fSBlbHNlIGlmIChjZWxsPy5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRjb25zdCBuZWFyZXN0Q29kZUNlbGxJbmRleCA9IHZpZXdNb2RlbC5uZWFyZXN0Q29kZUNlbGxJbmRleChpbmRleCk7XG5cdFx0XHRpZiAobmVhcmVzdENvZGVDZWxsSW5kZXggPiAtMSkge1xuXHRcdFx0XHRsYW5ndWFnZSA9IHZpZXdNb2RlbC5jZWxsQXQobmVhcmVzdENvZGVDZWxsSW5kZXgpIS5sYW5ndWFnZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxhbmd1YWdlID0gZGVmYXVsdExhbmd1YWdlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoIWNlbGwgJiYgdmlld01vZGVsLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gTm8gY2VsbHMgaW4gbm90ZWJvb2sgLSBjaGVjayBrZXJuZWwgaGlzdG9yeVxuXHRcdFx0Y29uc3QgbGFzdEtlcm5lbHMgPSBrZXJuZWxIaXN0b3J5U2VydmljZT8uZ2V0S2VybmVscyh2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudCk7XG5cdFx0XHRpZiAobGFzdEtlcm5lbHM/LmFsbC5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgbGFzdEtlcm5lbCA9IGxhc3RLZXJuZWxzLmFsbFswXTtcblx0XHRcdFx0bGFuZ3VhZ2UgPSBsYXN0S2VybmVsLnN1cHBvcnRlZExhbmd1YWdlc1swXSB8fCBkZWZhdWx0TGFuZ3VhZ2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsYW5ndWFnZSA9IGRlZmF1bHRMYW5ndWFnZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGNlbGwgPT09IHVuZGVmaW5lZCAmJiBkaXJlY3Rpb24gPT09ICdhYm92ZScpIHtcblx0XHRcdFx0Ly8gaW5zZXJ0IGNlbGwgYXQgdGhlIHZlcnkgdG9wXG5cdFx0XHRcdGxhbmd1YWdlID0gdmlld01vZGVsLnZpZXdDZWxscy5maW5kKGNlbGwgPT4gY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSk/Lmxhbmd1YWdlIHx8IGRlZmF1bHRMYW5ndWFnZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxhbmd1YWdlID0gZGVmYXVsdExhbmd1YWdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghc3VwcG9ydGVkTGFuZ3VhZ2VzLmluY2x1ZGVzKGxhbmd1YWdlKSkge1xuXHRcdFx0Ly8gdGhlIGxhbmd1YWdlIG5vIGxvbmdlciBleGlzdHNcblx0XHRcdGxhbmd1YWdlID0gZGVmYXVsdExhbmd1YWdlO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRsYW5ndWFnZSA9ICdtYXJrZG93bic7XG5cdH1cblxuXHRjb25zdCBpbnNlcnRJbmRleCA9IGNlbGwgP1xuXHRcdChkaXJlY3Rpb24gPT09ICdhYm92ZScgPyBpbmRleCA6IG5leHRJbmRleCkgOlxuXHRcdGluZGV4O1xuXHRyZXR1cm4gaW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCBpbnNlcnRJbmRleCwgaW5pdGlhbFRleHQsIGxhbmd1YWdlLCB0eXBlLCB1bmRlZmluZWQsIFtdLCB0cnVlLCB0cnVlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydENlbGxBdEluZGV4KHZpZXdNb2RlbDogTm90ZWJvb2tWaWV3TW9kZWwsIGluZGV4OiBudW1iZXIsIHNvdXJjZTogc3RyaW5nLCBsYW5ndWFnZTogc3RyaW5nLCB0eXBlOiBDZWxsS2luZCwgbWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhIHwgdW5kZWZpbmVkLCBvdXRwdXRzOiBJT3V0cHV0RHRvW10sIHN5bmNocm9ub3VzOiBib29sZWFuLCBwdXNoVW5kb1N0b3A6IGJvb2xlYW4pOiBDZWxsVmlld01vZGVsIHtcblx0Y29uc3QgZW5kU2VsZWN0aW9uczogSVNlbGVjdGlvblN0YXRlID0geyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiBpbmRleCwgZW5kOiBpbmRleCArIDEgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IGluZGV4LCBlbmQ6IGluZGV4ICsgMSB9XSB9O1xuXHR2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5hcHBseUVkaXRzKFtcblx0XHR7XG5cdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRpbmRleCxcblx0XHRcdGNvdW50OiAwLFxuXHRcdFx0Y2VsbHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNlbGxLaW5kOiB0eXBlLFxuXHRcdFx0XHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRcdFx0XHRtaW1lOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0b3V0cHV0czogb3V0cHV0cyxcblx0XHRcdFx0XHRtZXRhZGF0YTogbWV0YWRhdGEsXG5cdFx0XHRcdFx0c291cmNlOiBzb3VyY2Vcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH1cblx0XSwgc3luY2hyb25vdXMsIHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogdmlld01vZGVsLmdldEZvY3VzKCksIHNlbGVjdGlvbnM6IHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCkgfSwgKCkgPT4gZW5kU2VsZWN0aW9ucywgdW5kZWZpbmVkLCBwdXNoVW5kb1N0b3AgJiYgIXZpZXdNb2RlbC5vcHRpb25zLmlzUmVhZE9ubHkpO1xuXHRyZXR1cm4gdmlld01vZGVsLmNlbGxBdChpbmRleCkhO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBeUMsd0JBQXdCO0FBQ2pFLFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFTLGFBQWE7QUFDdEIsU0FBUywyQkFBZ0Q7QUFDekQsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxlQUFlLGVBQWUsdUNBQThFO0FBRXJILFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsY0FBYyxVQUFtRywwQkFBMEI7QUFDcEosU0FBUyxtQkFBbUIsMkJBQXVDO0FBQ25FLFNBQVMsZ0JBQWdCO0FBSXpCLGVBQXNCLGlCQUFpQixNQUFnQixTQUFpQyxVQUFtQixNQUE4QjtBQUN4SSxRQUFNLEVBQUUsZUFBZSxJQUFJO0FBQzNCLE1BQUksQ0FBQyxlQUFlLFNBQVMsR0FBRztBQUMvQjtBQUFBLEVBQ0Q7QUFFQSxNQUFJLGVBQWUsWUFBWTtBQUM5QjtBQUFBLEVBQ0Q7QUFFQSxNQUFJLFFBQVEsTUFBTSxRQUFRLE1BQU07QUFFL0IsVUFBTSxFQUFFLEtBQUssSUFBSTtBQUVqQixRQUFJLEtBQUssYUFBYSxNQUFNO0FBQzNCO0FBQUEsSUFDRDtBQUVBLFVBQU0sT0FBTyxLQUFLLFFBQVE7QUFDMUIsVUFBTSxNQUFNLGVBQWUsYUFBYSxJQUFJO0FBRTVDLFFBQUksYUFBYSxRQUFXO0FBQzNCLFlBQU0scUJBQXFCLGVBQWUsY0FBYyxzQkFBc0IsQ0FBQztBQUMvRSxpQkFBVyxtQkFBbUIsQ0FBQyxLQUFLO0FBQUEsSUFDckM7QUFFQSxtQkFBZSxVQUFVLFdBQVc7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
