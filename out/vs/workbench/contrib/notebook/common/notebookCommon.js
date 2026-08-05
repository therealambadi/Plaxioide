import { VSBuffer } from "../../../../base/common/buffer.js";
import * as glob from "../../../../base/common/glob.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Mimes } from "../../../../base/common/mime.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { isWindows } from "../../../../base/common/platform.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { generateMetadataUri, generate as generateUri, extractCellOutputDetails, parseMetadataUri, parse as parseUri } from "../../../services/notebook/common/notebookDocumentService.js";
const NOTEBOOK_EDITOR_ID = "workbench.editor.notebook";
const NOTEBOOK_DIFF_EDITOR_ID = "workbench.editor.notebookTextDiffEditor";
const NOTEBOOK_MULTI_DIFF_EDITOR_ID = "workbench.editor.notebookMultiTextDiffEditor";
const INTERACTIVE_WINDOW_EDITOR_ID = "workbench.editor.interactive";
const REPL_EDITOR_ID = "workbench.editor.repl";
const EXECUTE_REPL_COMMAND_ID = "replNotebook.input.execute";
var CellKind = /* @__PURE__ */ ((CellKind2) => {
  CellKind2[CellKind2["Markup"] = 1] = "Markup";
  CellKind2[CellKind2["Code"] = 2] = "Code";
  return CellKind2;
})(CellKind || {});
const NOTEBOOK_DISPLAY_ORDER = [
  "application/json",
  "application/javascript",
  "text/html",
  "image/svg+xml",
  Mimes.latex,
  Mimes.markdown,
  "image/png",
  "image/jpeg",
  Mimes.text
];
const ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER = [
  Mimes.latex,
  Mimes.markdown,
  "application/json",
  "text/html",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  Mimes.text
];
const RENDERER_EQUIVALENT_EXTENSIONS = /* @__PURE__ */ new Map([
  ["ms-toolsai.jupyter", /* @__PURE__ */ new Set(["jupyter-notebook", "interactive"])],
  ["ms-toolsai.jupyter-renderers", /* @__PURE__ */ new Set(["jupyter-notebook", "interactive"])]
]);
const RENDERER_NOT_AVAILABLE = "_notAvailable";
var NotebookRunState = /* @__PURE__ */ ((NotebookRunState2) => {
  NotebookRunState2[NotebookRunState2["Running"] = 1] = "Running";
  NotebookRunState2[NotebookRunState2["Idle"] = 2] = "Idle";
  return NotebookRunState2;
})(NotebookRunState || {});
var NotebookCellExecutionState = /* @__PURE__ */ ((NotebookCellExecutionState2) => {
  NotebookCellExecutionState2[NotebookCellExecutionState2["Unconfirmed"] = 1] = "Unconfirmed";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Pending"] = 2] = "Pending";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Executing"] = 3] = "Executing";
  return NotebookCellExecutionState2;
})(NotebookCellExecutionState || {});
var NotebookExecutionState = /* @__PURE__ */ ((NotebookExecutionState2) => {
  NotebookExecutionState2[NotebookExecutionState2["Unconfirmed"] = 1] = "Unconfirmed";
  NotebookExecutionState2[NotebookExecutionState2["Pending"] = 2] = "Pending";
  NotebookExecutionState2[NotebookExecutionState2["Executing"] = 3] = "Executing";
  return NotebookExecutionState2;
})(NotebookExecutionState || {});
var NotebookRendererMatch = /* @__PURE__ */ ((NotebookRendererMatch2) => {
  NotebookRendererMatch2[NotebookRendererMatch2["WithHardKernelDependency"] = 0] = "WithHardKernelDependency";
  NotebookRendererMatch2[NotebookRendererMatch2["WithOptionalKernelDependency"] = 1] = "WithOptionalKernelDependency";
  NotebookRendererMatch2[NotebookRendererMatch2["Pure"] = 2] = "Pure";
  NotebookRendererMatch2[NotebookRendererMatch2["Never"] = 3] = "Never";
  return NotebookRendererMatch2;
})(NotebookRendererMatch || {});
var RendererMessagingSpec = /* @__PURE__ */ ((RendererMessagingSpec2) => {
  RendererMessagingSpec2["Always"] = "always";
  RendererMessagingSpec2["Never"] = "never";
  RendererMessagingSpec2["Optional"] = "optional";
  return RendererMessagingSpec2;
})(RendererMessagingSpec || {});
var NotebookCellsChangeType = /* @__PURE__ */ ((NotebookCellsChangeType2) => {
  NotebookCellsChangeType2[NotebookCellsChangeType2["ModelChange"] = 1] = "ModelChange";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Move"] = 2] = "Move";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellLanguage"] = 5] = "ChangeCellLanguage";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Initialize"] = 6] = "Initialize";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellMetadata"] = 7] = "ChangeCellMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Output"] = 8] = "Output";
  NotebookCellsChangeType2[NotebookCellsChangeType2["OutputItem"] = 9] = "OutputItem";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellContent"] = 10] = "ChangeCellContent";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeDocumentMetadata"] = 11] = "ChangeDocumentMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellInternalMetadata"] = 12] = "ChangeCellInternalMetadata";
  NotebookCellsChangeType2[NotebookCellsChangeType2["ChangeCellMime"] = 13] = "ChangeCellMime";
  NotebookCellsChangeType2[NotebookCellsChangeType2["Unknown"] = 100] = "Unknown";
  return NotebookCellsChangeType2;
})(NotebookCellsChangeType || {});
var SelectionStateType = /* @__PURE__ */ ((SelectionStateType2) => {
  SelectionStateType2[SelectionStateType2["Handle"] = 0] = "Handle";
  SelectionStateType2[SelectionStateType2["Index"] = 1] = "Index";
  return SelectionStateType2;
})(SelectionStateType || {});
var CellEditType = /* @__PURE__ */ ((CellEditType2) => {
  CellEditType2[CellEditType2["Replace"] = 1] = "Replace";
  CellEditType2[CellEditType2["Output"] = 2] = "Output";
  CellEditType2[CellEditType2["Metadata"] = 3] = "Metadata";
  CellEditType2[CellEditType2["CellLanguage"] = 4] = "CellLanguage";
  CellEditType2[CellEditType2["DocumentMetadata"] = 5] = "DocumentMetadata";
  CellEditType2[CellEditType2["Move"] = 6] = "Move";
  CellEditType2[CellEditType2["OutputItems"] = 7] = "OutputItems";
  CellEditType2[CellEditType2["PartialMetadata"] = 8] = "PartialMetadata";
  CellEditType2[CellEditType2["PartialInternalMetadata"] = 9] = "PartialInternalMetadata";
  return CellEditType2;
})(CellEditType || {});
var NotebookMetadataUri;
((NotebookMetadataUri2) => {
  NotebookMetadataUri2.scheme = Schemas.vscodeNotebookMetadata;
  function generate(notebook) {
    return generateMetadataUri(notebook);
  }
  NotebookMetadataUri2.generate = generate;
  function parse(metadata) {
    return parseMetadataUri(metadata);
  }
  NotebookMetadataUri2.parse = parse;
})(NotebookMetadataUri || (NotebookMetadataUri = {}));
var CellUri;
((CellUri2) => {
  CellUri2.scheme = Schemas.vscodeNotebookCell;
  function generate(notebook, handle) {
    return generateUri(notebook, handle);
  }
  CellUri2.generate = generate;
  function parse(cell) {
    return parseUri(cell);
  }
  CellUri2.parse = parse;
  function generateCellOutputUriWithId(notebook, outputId) {
    return notebook.with({
      scheme: Schemas.vscodeNotebookCellOutput,
      query: new URLSearchParams({
        openIn: "editor",
        outputId: outputId ?? "",
        notebookScheme: notebook.scheme !== Schemas.file ? notebook.scheme : ""
      }).toString()
    });
  }
  CellUri2.generateCellOutputUriWithId = generateCellOutputUriWithId;
  function generateCellOutputUriWithIndex(notebook, cellUri, outputIndex) {
    return notebook.with({
      scheme: Schemas.vscodeNotebookCellOutput,
      fragment: cellUri.fragment,
      query: new URLSearchParams({
        openIn: "notebook",
        outputIndex: String(outputIndex)
      }).toString()
    });
  }
  CellUri2.generateCellOutputUriWithIndex = generateCellOutputUriWithIndex;
  function parseCellOutputUri(uri) {
    return extractCellOutputDetails(uri);
  }
  CellUri2.parseCellOutputUri = parseCellOutputUri;
  function generateCellPropertyUri(notebook, handle, scheme2) {
    return CellUri2.generate(notebook, handle).with({ scheme: scheme2 });
  }
  CellUri2.generateCellPropertyUri = generateCellPropertyUri;
  function parseCellPropertyUri(uri, propertyScheme) {
    if (uri.scheme !== propertyScheme) {
      return void 0;
    }
    return CellUri2.parse(uri.with({ scheme: CellUri2.scheme }));
  }
  CellUri2.parseCellPropertyUri = parseCellPropertyUri;
})(CellUri || (CellUri = {}));
const normalizeSlashes = (str) => isWindows ? str.replace(/\//g, "\\") : str;
class MimeTypeDisplayOrder {
  constructor(initialValue = [], defaultOrder = NOTEBOOK_DISPLAY_ORDER) {
    this.defaultOrder = defaultOrder;
    this.order = [...new Set(initialValue)].map((pattern) => ({
      pattern,
      matches: glob.parse(normalizeSlashes(pattern))
    }));
  }
  /**
   * Returns a sorted array of the input mimetypes.
   */
  sort(mimetypes) {
    const remaining = new Map(Iterable.map(mimetypes, (m) => [m, normalizeSlashes(m)]));
    let sorted = [];
    for (const { matches } of this.order) {
      for (const [original, normalized] of remaining) {
        if (matches(normalized)) {
          sorted.push(original);
          remaining.delete(original);
          break;
        }
      }
    }
    if (remaining.size) {
      sorted = sorted.concat([...remaining.keys()].sort(
        (a, b) => this.defaultOrder.indexOf(a) - this.defaultOrder.indexOf(b)
      ));
    }
    return sorted;
  }
  /**
   * Records that the user selected the given mimetype over the other
   * possible mimetypes, prioritizing it for future reference.
   */
  prioritize(chosenMimetype, otherMimetypes) {
    const chosenIndex = this.findIndex(chosenMimetype);
    if (chosenIndex === -1) {
      this.order.unshift({ pattern: chosenMimetype, matches: glob.parse(normalizeSlashes(chosenMimetype)) });
      return;
    }
    const uniqueIndicies = new Set(otherMimetypes.map((m) => this.findIndex(m, chosenIndex)));
    uniqueIndicies.delete(-1);
    const otherIndices = Array.from(uniqueIndicies).sort();
    this.order.splice(chosenIndex + 1, 0, ...otherIndices.map((i) => this.order[i]));
    for (let oi = otherIndices.length - 1; oi >= 0; oi--) {
      this.order.splice(otherIndices[oi], 1);
    }
  }
  /**
   * Gets an array of in-order mimetype preferences.
   */
  toArray() {
    return this.order.map((o) => o.pattern);
  }
  findIndex(mimeType, maxIndex = this.order.length) {
    const normalized = normalizeSlashes(mimeType);
    for (let i = 0; i < maxIndex; i++) {
      if (this.order[i].matches(normalized)) {
        return i;
      }
    }
    return -1;
  }
}
function diff(before, after, contains, equal = (a, b) => a === b) {
  const result = [];
  function pushSplice(start, deleteCount, toInsert) {
    if (deleteCount === 0 && toInsert.length === 0) {
      return;
    }
    const latest = result[result.length - 1];
    if (latest && latest.start + latest.deleteCount === start) {
      latest.deleteCount += deleteCount;
      latest.toInsert.push(...toInsert);
    } else {
      result.push({ start, deleteCount, toInsert });
    }
  }
  let beforeIdx = 0;
  let afterIdx = 0;
  while (true) {
    if (beforeIdx === before.length) {
      pushSplice(beforeIdx, 0, after.slice(afterIdx));
      break;
    }
    if (afterIdx === after.length) {
      pushSplice(beforeIdx, before.length - beforeIdx, []);
      break;
    }
    const beforeElement = before[beforeIdx];
    const afterElement = after[afterIdx];
    if (equal(beforeElement, afterElement)) {
      beforeIdx += 1;
      afterIdx += 1;
      continue;
    }
    if (contains(afterElement)) {
      pushSplice(beforeIdx, 1, []);
      beforeIdx += 1;
    } else {
      pushSplice(beforeIdx, 0, [afterElement]);
      afterIdx += 1;
    }
  }
  return result;
}
const NOTEBOOK_EDITOR_CURSOR_BOUNDARY = new RawContextKey("notebookEditorCursorAtBoundary", "none");
const NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY = new RawContextKey("notebookEditorCursorAtLineBoundary", "none");
var NotebookEditorPriority = /* @__PURE__ */ ((NotebookEditorPriority2) => {
  NotebookEditorPriority2["default"] = "default";
  NotebookEditorPriority2["option"] = "option";
  return NotebookEditorPriority2;
})(NotebookEditorPriority || {});
var NotebookFindScopeType = /* @__PURE__ */ ((NotebookFindScopeType2) => {
  NotebookFindScopeType2["Cells"] = "cells";
  NotebookFindScopeType2["Text"] = "text";
  NotebookFindScopeType2["None"] = "none";
  return NotebookFindScopeType2;
})(NotebookFindScopeType || {});
function isDocumentExcludePattern(filenamePattern) {
  const arg = filenamePattern;
  if ((typeof arg.include === "string" || glob.isRelativePattern(arg.include)) && (typeof arg.exclude === "string" || glob.isRelativePattern(arg.exclude))) {
    return true;
  }
  return false;
}
function notebookDocumentFilterMatch(filter, viewType, resource) {
  if (Array.isArray(filter.viewType) && filter.viewType.indexOf(viewType) >= 0) {
    return true;
  }
  if (filter.viewType === viewType) {
    return true;
  }
  if (filter.filenamePattern) {
    const filenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.include : filter.filenamePattern;
    const excludeFilenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.exclude : void 0;
    if (glob.match(filenamePattern, basename(resource.fsPath).toLowerCase())) {
      if (excludeFilenamePattern) {
        if (glob.match(excludeFilenamePattern, basename(resource.fsPath).toLowerCase())) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}
const NotebookSetting = {
  displayOrder: "notebook.displayOrder",
  cellToolbarLocation: "notebook.cellToolbarLocation",
  cellToolbarVisibility: "notebook.cellToolbarVisibility",
  showCellStatusBar: "notebook.showCellStatusBar",
  cellExecutionTimeVerbosity: "notebook.cellExecutionTimeVerbosity",
  textDiffEditorPreview: "notebook.diff.enablePreview",
  diffOverviewRuler: "notebook.diff.overviewRuler",
  experimentalInsertToolbarAlignment: "notebook.experimental.insertToolbarAlignment",
  compactView: "notebook.compactView",
  focusIndicator: "notebook.cellFocusIndicator",
  insertToolbarLocation: "notebook.insertToolbarLocation",
  globalToolbar: "notebook.globalToolbar",
  stickyScrollEnabled: "notebook.stickyScroll.enabled",
  stickyScrollMode: "notebook.stickyScroll.mode",
  undoRedoPerCell: "notebook.undoRedoPerCell",
  consolidatedOutputButton: "notebook.consolidatedOutputButton",
  showFoldingControls: "notebook.showFoldingControls",
  dragAndDropEnabled: "notebook.dragAndDropEnabled",
  cellEditorOptionsCustomizations: "notebook.editorOptionsCustomizations",
  consolidatedRunButton: "notebook.consolidatedRunButton",
  openGettingStarted: "notebook.experimental.openGettingStarted",
  globalToolbarShowLabel: "notebook.globalToolbarShowLabel",
  markupFontSize: "notebook.markup.fontSize",
  markdownLineHeight: "notebook.markdown.lineHeight",
  interactiveWindowCollapseCodeCells: "interactiveWindow.collapseCellInputCode",
  outputScrollingDeprecated: "notebook.experimental.outputScrolling",
  outputScrolling: "notebook.output.scrolling",
  textOutputLineLimit: "notebook.output.textLineLimit",
  LinkifyOutputFilePaths: "notebook.output.linkifyFilePaths",
  minimalErrorRendering: "notebook.output.minimalErrorRendering",
  formatOnSave: "notebook.formatOnSave.enabled",
  insertFinalNewline: "notebook.insertFinalNewline",
  defaultFormatter: "notebook.defaultFormatter",
  formatOnCellExecution: "notebook.formatOnCellExecution",
  codeActionsOnSave: "notebook.codeActionsOnSave",
  outputWordWrap: "notebook.output.wordWrap",
  outputLineHeightDeprecated: "notebook.outputLineHeight",
  outputLineHeight: "notebook.output.lineHeight",
  outputFontSizeDeprecated: "notebook.outputFontSize",
  outputFontSize: "notebook.output.fontSize",
  outputFontFamilyDeprecated: "notebook.outputFontFamily",
  outputFontFamily: "notebook.output.fontFamily",
  findFilters: "notebook.find.filters",
  logging: "notebook.logging",
  confirmDeleteRunningCell: "notebook.confirmDeleteRunningCell",
  remoteSaving: "notebook.experimental.remoteSave",
  gotoSymbolsAllSymbols: "notebook.gotoSymbols.showAllSymbols",
  outlineShowMarkdownHeadersOnly: "notebook.outline.showMarkdownHeadersOnly",
  outlineShowCodeCells: "notebook.outline.showCodeCells",
  outlineShowCodeCellSymbols: "notebook.outline.showCodeCellSymbols",
  breadcrumbsShowCodeCells: "notebook.breadcrumbs.showCodeCells",
  scrollToRevealCell: "notebook.scrolling.revealNextCellOnExecute",
  cellChat: "notebook.experimental.cellChat",
  cellGenerate: "notebook.experimental.generate",
  notebookVariablesView: "notebook.variablesView",
  notebookInlineValues: "notebook.inlineValues",
  InteractiveWindowPromptToSave: "interactiveWindow.promptToSaveOnClose",
  cellFailureDiagnostics: "notebook.cellFailureDiagnostics",
  outputBackupSizeLimit: "notebook.backup.sizeLimit",
  multiCursor: "notebook.multiCursor.enabled",
  markupFontFamily: "notebook.markup.fontFamily"
};
var CellStatusbarAlignment = /* @__PURE__ */ ((CellStatusbarAlignment2) => {
  CellStatusbarAlignment2[CellStatusbarAlignment2["Left"] = 1] = "Left";
  CellStatusbarAlignment2[CellStatusbarAlignment2["Right"] = 2] = "Right";
  return CellStatusbarAlignment2;
})(CellStatusbarAlignment || {});
const _NotebookWorkingCopyTypeIdentifier = class _NotebookWorkingCopyTypeIdentifier {
  static create(notebookType, viewType) {
    return `${_NotebookWorkingCopyTypeIdentifier._prefix}${notebookType}/${viewType ?? notebookType}`;
  }
  static parse(candidate) {
    if (candidate.startsWith(_NotebookWorkingCopyTypeIdentifier._prefix)) {
      const split = candidate.substring(_NotebookWorkingCopyTypeIdentifier._prefix.length).split("/");
      if (split.length === 2) {
        return { notebookType: split[0], viewType: split[1] };
      }
    }
    return void 0;
  }
};
_NotebookWorkingCopyTypeIdentifier._prefix = "notebook/";
let NotebookWorkingCopyTypeIdentifier = _NotebookWorkingCopyTypeIdentifier;
function isTextStreamMime(mimeType) {
  return ["application/vnd.code.notebook.stdout", "application/vnd.code.notebook.stderr"].includes(mimeType);
}
const textDecoder = new TextDecoder();
function compressOutputItemStreams(outputs) {
  const buffers = [];
  let startAppending = false;
  for (const output of outputs) {
    if (buffers.length === 0 || startAppending) {
      buffers.push(output);
      startAppending = true;
    }
  }
  let didCompression = compressStreamBuffer(buffers);
  const concatenated = VSBuffer.concat(buffers.map((buffer) => VSBuffer.wrap(buffer)));
  const data = formatStreamText(concatenated);
  didCompression = didCompression || data.byteLength !== concatenated.byteLength;
  return { data, didCompression };
}
const MOVE_CURSOR_1_LINE_COMMAND = `${String.fromCharCode(27)}[A`;
const MOVE_CURSOR_1_LINE_COMMAND_BYTES = MOVE_CURSOR_1_LINE_COMMAND.split("").map((c) => c.charCodeAt(0));
const LINE_FEED = 10;
function compressStreamBuffer(streams) {
  let didCompress = false;
  streams.forEach((stream, index) => {
    if (index === 0 || stream.length < MOVE_CURSOR_1_LINE_COMMAND.length) {
      return;
    }
    const previousStream = streams[index - 1];
    const command = stream.subarray(0, MOVE_CURSOR_1_LINE_COMMAND.length);
    if (command[0] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[0] && command[1] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[1] && command[2] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[2]) {
      const lastIndexOfLineFeed = previousStream.lastIndexOf(LINE_FEED);
      if (lastIndexOfLineFeed === -1) {
        return;
      }
      didCompress = true;
      streams[index - 1] = previousStream.subarray(0, lastIndexOfLineFeed);
      streams[index] = stream.subarray(MOVE_CURSOR_1_LINE_COMMAND.length);
    }
  });
  return didCompress;
}
function fixBackspace(txt) {
  let tmp = txt;
  do {
    txt = tmp;
    tmp = txt.replace(/[^\n]\x08/gm, "");
  } while (tmp.length < txt.length);
  return txt;
}
function fixCarriageReturn(txt) {
  txt = txt.replace(/\r+\n/gm, "\n");
  while (txt.search(/\r[^$]/g) > -1) {
    const base = txt.match(/^(.*)\r+/m)[1];
    let insert = txt.match(/\r+(.*)$/m)[1];
    insert = insert + base.slice(insert.length, base.length);
    txt = txt.replace(/\r+.*$/m, "\r").replace(/^.*\r/m, insert);
  }
  return txt;
}
const BACKSPACE_CHARACTER = "\b".charCodeAt(0);
const CARRIAGE_RETURN_CHARACTER = "\r".charCodeAt(0);
function formatStreamText(buffer) {
  if (!buffer.buffer.includes(BACKSPACE_CHARACTER) && !buffer.buffer.includes(CARRIAGE_RETURN_CHARACTER)) {
    return buffer;
  }
  return VSBuffer.fromString(fixCarriageReturn(fixBackspace(textDecoder.decode(buffer.buffer))));
}
export {
  ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER,
  CellEditType,
  CellKind,
  CellStatusbarAlignment,
  CellUri,
  EXECUTE_REPL_COMMAND_ID,
  INTERACTIVE_WINDOW_EDITOR_ID,
  MOVE_CURSOR_1_LINE_COMMAND,
  MimeTypeDisplayOrder,
  NOTEBOOK_DIFF_EDITOR_ID,
  NOTEBOOK_DISPLAY_ORDER,
  NOTEBOOK_EDITOR_CURSOR_BOUNDARY,
  NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY,
  NOTEBOOK_EDITOR_ID,
  NOTEBOOK_MULTI_DIFF_EDITOR_ID,
  NotebookCellExecutionState,
  NotebookCellsChangeType,
  NotebookEditorPriority,
  NotebookExecutionState,
  NotebookFindScopeType,
  NotebookMetadataUri,
  NotebookRendererMatch,
  NotebookRunState,
  NotebookSetting,
  NotebookWorkingCopyTypeIdentifier,
  RENDERER_EQUIVALENT_EXTENSIONS,
  RENDERER_NOT_AVAILABLE,
  REPL_EDITOR_ID,
  RendererMessagingSpec,
  SelectionStateType,
  compressOutputItemStreams,
  diff,
  isDocumentExcludePattern,
  isTextStreamMime,
  notebookDocumentFilterMatch
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlmZlJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RpZmYvZGlmZi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1pbWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVNwbGljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NlcXVlbmNlLmpzJztcbmltcG9ydCB7IFRoZW1lQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCAqIGFzIGVkaXRvckNvbW1vbiBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDb21tYW5kLCBXb3Jrc3BhY2VFZGl0TWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJUmVhZG9ubHlUZXh0QnVmZmVyLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVJlYWRMaW1pdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVW5kb1JlZG9Hcm91cCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBJUmV2ZXJ0T3B0aW9ucywgSVNhdmVPcHRpb25zLCBJVW50eXBlZEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNlbGxFeGVjdXRpb25FcnJvciB9IGZyb20gJy4vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rVGV4dE1vZGVsTGlrZSB9IGZyb20gJy4vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDZWxsUmFuZ2UgfSBmcm9tICcuL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVNZXRhZGF0YVVyaSwgZ2VuZXJhdGUgYXMgZ2VuZXJhdGVVcmksIGV4dHJhY3RDZWxsT3V0cHV0RGV0YWlscywgcGFyc2VNZXRhZGF0YVVyaSwgcGFyc2UgYXMgcGFyc2VVcmkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tEb2N1bWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwTWV0YSwgSVdvcmtpbmdDb3B5U2F2ZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IFNuYXBzaG90Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi9maWxlV29ya2luZ0NvcHkuanMnO1xuXG5leHBvcnQgY29uc3QgTk9URUJPT0tfRURJVE9SX0lEID0gJ3dvcmtiZW5jaC5lZGl0b3Iubm90ZWJvb2snO1xuZXhwb3J0IGNvbnN0IE5PVEVCT09LX0RJRkZfRURJVE9SX0lEID0gJ3dvcmtiZW5jaC5lZGl0b3Iubm90ZWJvb2tUZXh0RGlmZkVkaXRvcic7XG5leHBvcnQgY29uc3QgTk9URUJPT0tfTVVMVElfRElGRl9FRElUT1JfSUQgPSAnd29ya2JlbmNoLmVkaXRvci5ub3RlYm9va011bHRpVGV4dERpZmZFZGl0b3InO1xuZXhwb3J0IGNvbnN0IElOVEVSQUNUSVZFX1dJTkRPV19FRElUT1JfSUQgPSAnd29ya2JlbmNoLmVkaXRvci5pbnRlcmFjdGl2ZSc7XG5leHBvcnQgY29uc3QgUkVQTF9FRElUT1JfSUQgPSAnd29ya2JlbmNoLmVkaXRvci5yZXBsJztcblxuZXhwb3J0IGNvbnN0IEVYRUNVVEVfUkVQTF9DT01NQU5EX0lEID0gJ3JlcGxOb3RlYm9vay5pbnB1dC5leGVjdXRlJztcblxuZXhwb3J0IGVudW0gQ2VsbEtpbmQge1xuXHRNYXJrdXAgPSAxLFxuXHRDb2RlID0gMlxufVxuXG5leHBvcnQgY29uc3QgTk9URUJPT0tfRElTUExBWV9PUkRFUjogcmVhZG9ubHkgc3RyaW5nW10gPSBbXG5cdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHQndGV4dC9odG1sJyxcblx0J2ltYWdlL3N2Zyt4bWwnLFxuXHRNaW1lcy5sYXRleCxcblx0TWltZXMubWFya2Rvd24sXG5cdCdpbWFnZS9wbmcnLFxuXHQnaW1hZ2UvanBlZycsXG5cdE1pbWVzLnRleHRcbl07XG5cbmV4cG9ydCBjb25zdCBBQ0NFU1NJQkxFX05PVEVCT09LX0RJU1BMQVlfT1JERVI6IHJlYWRvbmx5IHN0cmluZ1tdID0gW1xuXHRNaW1lcy5sYXRleCxcblx0TWltZXMubWFya2Rvd24sXG5cdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0J3RleHQvaHRtbCcsXG5cdCdpbWFnZS9zdmcreG1sJyxcblx0J2ltYWdlL3BuZycsXG5cdCdpbWFnZS9qcGVnJyxcblx0TWltZXMudGV4dCxcbl07XG5cbi8qKlxuICogQSBtYXBwaW5nIG9mIGV4dGVuc2lvbiBJRHMgd2hvIGNvbnRhaW4gcmVuZGVyZXJzLCB0byBub3RlYm9vayBpZHMgd2hvIHRoZXlcbiAqIHNob3VsZCBiZSB0cmVhdGVkIGFzIHRoZSBzYW1lIGluIHRoZSByZW5kZXJlciBzZWxlY3Rpb24gbG9naWMuIFRoaXMgaXMgdXNlZFxuICogdG8gcHJlZmVyIHRoZSAxc3QgcGFydHkgSnVweXRlciByZW5kZXJlcnMgZXZlbiB0aG91Z2ggdGhleSdyZSBpbiBhIHNlcGFyYXRlXG4gKiBleHRlbnNpb24sIGZvciBpbnN0YW5jZS4gU2VlICMxMzYyNDcuXG4gKi9cbmV4cG9ydCBjb25zdCBSRU5ERVJFUl9FUVVJVkFMRU5UX0VYVEVOU0lPTlM6IFJlYWRvbmx5TWFwPHN0cmluZywgUmVhZG9ubHlTZXQ8c3RyaW5nPj4gPSBuZXcgTWFwKFtcblx0Wydtcy10b29sc2FpLmp1cHl0ZXInLCBuZXcgU2V0KFsnanVweXRlci1ub3RlYm9vaycsICdpbnRlcmFjdGl2ZSddKV0sXG5cdFsnbXMtdG9vbHNhaS5qdXB5dGVyLXJlbmRlcmVycycsIG5ldyBTZXQoWydqdXB5dGVyLW5vdGVib29rJywgJ2ludGVyYWN0aXZlJ10pXSxcbl0pO1xuXG5leHBvcnQgY29uc3QgUkVOREVSRVJfTk9UX0FWQUlMQUJMRSA9ICdfbm90QXZhaWxhYmxlJztcblxuZXhwb3J0IHR5cGUgQ29udHJpYnV0ZWROb3RlYm9va1JlbmRlcmVyRW50cnlwb2ludCA9IHN0cmluZyB8IHsgcmVhZG9ubHkgZXh0ZW5kczogc3RyaW5nOyByZWFkb25seSBwYXRoOiBzdHJpbmcgfTtcblxuZXhwb3J0IGVudW0gTm90ZWJvb2tSdW5TdGF0ZSB7XG5cdFJ1bm5pbmcgPSAxLFxuXHRJZGxlID0gMlxufVxuXG5leHBvcnQgdHlwZSBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEgPSBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuZXhwb3J0IGVudW0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUge1xuXHRVbmNvbmZpcm1lZCA9IDEsXG5cdFBlbmRpbmcgPSAyLFxuXHRFeGVjdXRpbmcgPSAzXG59XG5leHBvcnQgZW51bSBOb3RlYm9va0V4ZWN1dGlvblN0YXRlIHtcblx0VW5jb25maXJtZWQgPSAxLFxuXHRQZW5kaW5nID0gMixcblx0RXhlY3V0aW5nID0gM1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0NlbGxQcmV2aW91c0V4ZWN1dGlvblJlc3VsdCB7XG5cdGV4ZWN1dGlvbk9yZGVyPzogbnVtYmVyO1xuXHRzdWNjZXNzPzogYm9vbGVhbjtcblx0ZHVyYXRpb24/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tDZWxsTWV0YWRhdGEge1xuXHQvKipcblx0ICogY3VzdG9tIG1ldGFkYXRhXG5cdCAqL1xuXHRba2V5OiBzdHJpbmddOiB1bmtub3duO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEge1xuXHQvKipcblx0ICogVXNlZCBvbmx5IGZvciBkaWZmaW5nIG9mIE5vdGVib29rcy5cblx0ICogVGhpcyBpcyBub3QgcGVyc2lzdGVkIGFuZCBnZW5lcmFsbHkgdXNlZnVsIG9ubHkgd2hlbiBkaWZmaW5nIHR3byBub3RlYm9va3MuXG5cdCAqIFVzZWZ1bCBvbmx5IGFmdGVyIHdlJ3ZlIG1hbnVhbGx5IG1hdGNoZWQgYSBmZXcgY2VsbHMgdG9nZXRoZXIgc28gd2Uga25vdyB3aGljaCBjZWxscyBhcmUgbWF0Y2hpbmcuXG5cdCAqL1xuXHRpbnRlcm5hbElkPzogc3RyaW5nO1xuXHRleGVjdXRpb25JZD86IHN0cmluZztcblx0ZXhlY3V0aW9uT3JkZXI/OiBudW1iZXI7XG5cdGxhc3RSdW5TdWNjZXNzPzogYm9vbGVhbjtcblx0cnVuU3RhcnRUaW1lPzogbnVtYmVyO1xuXHRydW5TdGFydFRpbWVBZGp1c3RtZW50PzogbnVtYmVyO1xuXHRydW5FbmRUaW1lPzogbnVtYmVyO1xuXHRyZW5kZXJEdXJhdGlvbj86IHsgW2tleTogc3RyaW5nXTogbnVtYmVyIH07XG5cdGVycm9yPzogSUNlbGxFeGVjdXRpb25FcnJvcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va0NlbGxDb2xsYXBzZVN0YXRlIHtcblx0aW5wdXRDb2xsYXBzZWQ/OiBib29sZWFuO1xuXHRvdXRwdXRDb2xsYXBzZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbERlZmF1bHRDb2xsYXBzZUNvbmZpZyB7XG5cdGNvZGVDZWxsPzogTm90ZWJvb2tDZWxsQ29sbGFwc2VTdGF0ZTtcblx0bWFya3VwQ2VsbD86IE5vdGVib29rQ2VsbENvbGxhcHNlU3RhdGU7XG59XG5cbmV4cG9ydCB0eXBlIEludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPSAnYWx3YXlzJyB8ICduZXZlcicgfCAnZnJvbUVkaXRvcic7XG5cbmV4cG9ydCB0eXBlIFRyYW5zaWVudENlbGxNZXRhZGF0YSA9IHsgcmVhZG9ubHkgW0sgaW4ga2V5b2YgTm90ZWJvb2tDZWxsTWV0YWRhdGFdPzogYm9vbGVhbiB9O1xuZXhwb3J0IHR5cGUgQ2VsbENvbnRlbnRNZXRhZGF0YSA9IHsgcmVhZG9ubHkgW0sgaW4ga2V5b2YgTm90ZWJvb2tDZWxsTWV0YWRhdGFdPzogYm9vbGVhbiB9O1xuZXhwb3J0IHR5cGUgVHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YSA9IHsgcmVhZG9ubHkgW0sgaW4ga2V5b2YgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhXT86IGJvb2xlYW4gfTtcblxuZXhwb3J0IGludGVyZmFjZSBUcmFuc2llbnRPcHRpb25zIHtcblx0cmVhZG9ubHkgdHJhbnNpZW50T3V0cHV0czogYm9vbGVhbjtcblx0cmVhZG9ubHkgdHJhbnNpZW50Q2VsbE1ldGFkYXRhOiBUcmFuc2llbnRDZWxsTWV0YWRhdGE7XG5cdHJlYWRvbmx5IHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IFRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE7XG5cdHJlYWRvbmx5IGNlbGxDb250ZW50TWV0YWRhdGE6IENlbGxDb250ZW50TWV0YWRhdGE7XG59XG5cbi8qKiBOb3RlOiBlbnVtIHZhbHVlcyBhcmUgdXNlZCBmb3Igc29ydGluZyAqL1xuZXhwb3J0IGNvbnN0IGVudW0gTm90ZWJvb2tSZW5kZXJlck1hdGNoIHtcblx0LyoqIFJlbmRlcmVyIGhhcyBhIGhhcmQgZGVwZW5kZW5jeSBvbiBhbiBhdmFpbGFibGUga2VybmVsICovXG5cdFdpdGhIYXJkS2VybmVsRGVwZW5kZW5jeSA9IDAsXG5cdC8qKiBSZW5kZXJlciB3b3JrcyBiZXR0ZXIgd2l0aCBhbiBhdmFpbGFibGUga2VybmVsICovXG5cdFdpdGhPcHRpb25hbEtlcm5lbERlcGVuZGVuY3kgPSAxLFxuXHQvKiogUmVuZGVyZXIgaXMga2VybmVsLWFnbm9zdGljICovXG5cdFB1cmUgPSAyLFxuXHQvKiogUmVuZGVyZXIgaXMgZm9yIGEgZGlmZmVyZW50IG1pbWVUeXBlIG9yIGhhcyBhIGhhcmQgZGVwZW5kZW5jeSB3aGljaCBpcyB1bnNhdGlzZmllZCAqL1xuXHROZXZlciA9IDMsXG59XG5cbi8qKlxuICogUmVuZGVyZXIgbWVzc2FnaW5nIHJlcXVpcmVtZW50LiBXaGlsZSB0aGlzIGFsbG93cyBmb3IgJ29wdGlvbmFsJyBtZXNzYWdpbmcsXG4gKiBWUyBDb2RlIGVmZmVjdGl2ZWx5IHRyZWF0cyBpdCB0aGUgc2FtZSBhcyB0cnVlIHJpZ2h0IG5vdy4gXCJQYXJ0aWFsXG4gKiBhY3RpdmF0aW9uXCIgb2YgZXh0ZW5zaW9ucyBpcyBhIHZlcnkgdHJpY2t5IHByb2JsZW0sIHdoaWNoIGNvdWxkIGFsbG93XG4gKiBzb2x2aW5nIHRoaXMuIEJ1dCBmb3Igbm93LCBvcHRpb25hbCBpcyBtb3N0bHkgb25seSBob25vcmVkIGZvciBhem5iLlxuICovXG5leHBvcnQgY29uc3QgZW51bSBSZW5kZXJlck1lc3NhZ2luZ1NwZWMge1xuXHRBbHdheXMgPSAnYWx3YXlzJyxcblx0TmV2ZXIgPSAnbmV2ZXInLFxuXHRPcHRpb25hbCA9ICdvcHRpb25hbCcsXG59XG5cbmV4cG9ydCB0eXBlIE5vdGVib29rUmVuZGVyZXJFbnRyeXBvaW50ID0geyByZWFkb25seSBleHRlbmRzOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHJlYWRvbmx5IHBhdGg6IFVSSSB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va1JlbmRlcmVySW5mbyB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGRpc3BsYXlOYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGVudHJ5cG9pbnQ6IE5vdGVib29rUmVuZGVyZXJFbnRyeXBvaW50O1xuXHRyZWFkb25seSBleHRlbnNpb25Mb2NhdGlvbjogVVJJO1xuXHRyZWFkb25seSBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblx0cmVhZG9ubHkgbWVzc2FnaW5nOiBSZW5kZXJlck1lc3NhZ2luZ1NwZWM7XG5cblx0cmVhZG9ubHkgbWltZVR5cGVzOiByZWFkb25seSBzdHJpbmdbXTtcblxuXHRyZWFkb25seSBpc0J1aWx0aW46IGJvb2xlYW47XG5cblx0bWF0Y2hlc1dpdGhvdXRLZXJuZWwobWltZVR5cGU6IHN0cmluZyk6IE5vdGVib29rUmVuZGVyZXJNYXRjaDtcblx0bWF0Y2hlcyhtaW1lVHlwZTogc3RyaW5nLCBrZXJuZWxQcm92aWRlczogUmVhZG9ubHlBcnJheTxzdHJpbmc+KTogTm90ZWJvb2tSZW5kZXJlck1hdGNoO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va1N0YXRpY1ByZWxvYWRJbmZvIHtcblx0cmVhZG9ubHkgdHlwZTogc3RyaW5nO1xuXHRyZWFkb25seSBlbnRyeXBvaW50OiBVUkk7XG5cdHJlYWRvbmx5IGV4dGVuc2lvbkxvY2F0aW9uOiBVUkk7XG5cdHJlYWRvbmx5IGxvY2FsUmVzb3VyY2VSb290czogcmVhZG9ubHkgVVJJW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9yZGVyZWRNaW1lVHlwZSB7XG5cdG1pbWVUeXBlOiBzdHJpbmc7XG5cdHJlbmRlcmVySWQ6IHN0cmluZztcblx0aXNUcnVzdGVkOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElPdXRwdXRJdGVtRHRvIHtcblx0cmVhZG9ubHkgbWltZTogc3RyaW5nO1xuXHRyZWFkb25seSBkYXRhOiBWU0J1ZmZlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJT3V0cHV0RHRvIHtcblx0b3V0cHV0czogSU91dHB1dEl0ZW1EdG9bXTtcblx0b3V0cHV0SWQ6IHN0cmluZztcblx0bWV0YWRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsT3V0cHV0IHtcblx0cmVhZG9ubHkgdmVyc2lvbklkOiBudW1iZXI7XG5cdG91dHB1dHM6IElPdXRwdXRJdGVtRHRvW107XG5cdG1ldGFkYXRhPzogUmVjb3JkPHN0cmluZywgYW55Pjtcblx0b3V0cHV0SWQ6IHN0cmluZztcblx0LyoqXG5cdCAqIEFsdGVybmF0aXZlIG91dHB1dCBpZCB0aGF0J3MgcmV1c2VkIHdoZW4gdGhlIG91dHB1dCBpcyB1cGRhdGVkLlxuXHQgKi9cblx0YWx0ZXJuYXRpdmVPdXRwdXRJZDogc3RyaW5nO1xuXHRvbkRpZENoYW5nZURhdGE6IEV2ZW50PHZvaWQ+O1xuXHRyZXBsYWNlRGF0YShpdGVtczogSU91dHB1dER0byk6IHZvaWQ7XG5cdGFwcGVuZERhdGEoaXRlbXM6IElPdXRwdXRJdGVtRHRvW10pOiB2b2lkO1xuXHRhcHBlbmRlZFNpbmNlVmVyc2lvbih2ZXJzaW9uSWQ6IG51bWJlciwgbWltZTogc3RyaW5nKTogVlNCdWZmZXIgfCB1bmRlZmluZWQ7XG5cdGFzRHRvKCk6IElPdXRwdXREdG87XG5cdGJ1bXBWZXJzaW9uKCk6IHZvaWQ7XG5cdGRpc3Bvc2UoKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDZWxsSW50ZXJuYWxNZXRhZGF0YUNoYW5nZWRFdmVudCB7XG5cdHJlYWRvbmx5IGxhc3RSdW5TdWNjZXNzQ2hhbmdlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rRG9jdW1lbnRNZXRhZGF0YVRleHRNb2RlbCB7XG5cdC8qKlxuXHQgKiBOb3RlYm9vayBNZXRhZGF0YSBVcmkuXG5cdCAqL1xuXHRyZWFkb25seSB1cmk6IFVSSTtcblx0LyoqXG5cdCAqIFRyaWdnZXJlZCB3aGVuIHRoZSBOb3RlYm9vayBNZXRhZGF0YSBjaGFuZ2VzLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXHRyZWFkb25seSBtZXRhZGF0YTogUmVhZG9ubHk8Tm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhPjtcblx0cmVhZG9ubHkgdGV4dEJ1ZmZlcjogSVJlYWRvbmx5VGV4dEJ1ZmZlcjtcblx0LyoqXG5cdCAqIFRleHQgcmVwcmVzZW50YXRpb24gb2YgdGhlIE5vdGVib29rIE1ldGFkYXRhXG5cdCAqL1xuXHRnZXRWYWx1ZSgpOiBzdHJpbmc7XG5cdGdldEhhc2goKTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsIHtcblx0cmVhZG9ubHkgdXJpOiBVUkk7XG5cdGhhbmRsZTogbnVtYmVyO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xuXHRjZWxsS2luZDogQ2VsbEtpbmQ7XG5cdG91dHB1dHM6IElDZWxsT3V0cHV0W107XG5cdG1ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YTtcblx0aW50ZXJuYWxNZXRhZGF0YTogTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YTtcblx0Z2V0SGFzaFZhbHVlKCk6IG51bWJlcjtcblx0dGV4dEJ1ZmZlcjogSVJlYWRvbmx5VGV4dEJ1ZmZlcjtcblx0dGV4dE1vZGVsPzogSVRleHRNb2RlbDtcblx0b25EaWRDaGFuZ2VUZXh0TW9kZWw6IEV2ZW50PHZvaWQ+O1xuXHRnZXRWYWx1ZSgpOiBzdHJpbmc7XG5cdG9uRGlkQ2hhbmdlT3V0cHV0cz86IEV2ZW50PE5vdGVib29rQ2VsbE91dHB1dHNTcGxpY2U+O1xuXHRvbkRpZENoYW5nZU91dHB1dEl0ZW1zPzogRXZlbnQ8dm9pZD47XG5cdG9uRGlkQ2hhbmdlTGFuZ3VhZ2U6IEV2ZW50PHN0cmluZz47XG5cdG9uRGlkQ2hhbmdlTWV0YWRhdGE6IEV2ZW50PHZvaWQ+O1xuXHRvbkRpZENoYW5nZUludGVybmFsTWV0YWRhdGE6IEV2ZW50PENlbGxJbnRlcm5hbE1ldGFkYXRhQ2hhbmdlZEV2ZW50Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tTbmFwc2hvdE9wdGlvbnMge1xuXHRjb250ZXh0OiBTbmFwc2hvdENvbnRleHQ7XG5cdG91dHB1dFNpemVMaW1pdDogbnVtYmVyO1xuXHR0cmFuc2llbnRPcHRpb25zPzogVHJhbnNpZW50T3B0aW9ucztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tUZXh0TW9kZWwgZXh0ZW5kcyBJTm90ZWJvb2tUZXh0TW9kZWxMaWtlIHtcblx0cmVhZG9ubHkgbm90ZWJvb2tUeXBlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHZpZXdUeXBlOiBzdHJpbmc7XG5cdG1ldGFkYXRhOiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGE7XG5cdHJlYWRvbmx5IHRyYW5zaWVudE9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnM7XG5cdHJlYWRvbmx5IHVyaTogVVJJO1xuXHRyZWFkb25seSB2ZXJzaW9uSWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgbGVuZ3RoOiBudW1iZXI7XG5cdHJlYWRvbmx5IGNlbGxzOiByZWFkb25seSBJQ2VsbFtdO1xuXHRyZXNldChjZWxsczogSUNlbGxEdG8yW10sIG1ldGFkYXRhOiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEsIHRyYW5zaWVudE9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMpOiB2b2lkO1xuXHRjcmVhdGVTbmFwc2hvdChvcHRpb25zOiBJTm90ZWJvb2tTbmFwc2hvdE9wdGlvbnMpOiBOb3RlYm9va0RhdGE7XG5cdHJlc3RvcmVTbmFwc2hvdChzbmFwc2hvdDogTm90ZWJvb2tEYXRhLCB0cmFuc2llbnRPcHRpb25zPzogVHJhbnNpZW50T3B0aW9ucyk6IHZvaWQ7XG5cdGFwcGx5RWRpdHMocmF3RWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdLCBzeW5jaHJvbm91czogYm9vbGVhbiwgYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCBlbmRTZWxlY3Rpb25zQ29tcHV0ZXI6ICgpID0+IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCwgY29tcHV0ZVVuZG9SZWRvPzogYm9vbGVhbik6IGJvb2xlYW47XG5cdG9uRGlkQ2hhbmdlQ29udGVudDogRXZlbnQ8Tm90ZWJvb2tUZXh0TW9kZWxDaGFuZ2VkRXZlbnQ+O1xuXHRvbldpbGxEaXNwb3NlOiBFdmVudDx2b2lkPjtcbn1cblxuZXhwb3J0IHR5cGUgTm90ZWJvb2tDZWxsVGV4dE1vZGVsU3BsaWNlPFQ+ID0gW1xuXHRzdGFydDogbnVtYmVyLFxuXHRkZWxldGVDb3VudDogbnVtYmVyLFxuXHRuZXdJdGVtczogVFtdXG5dO1xuXG5leHBvcnQgdHlwZSBOb3RlYm9va0NlbGxPdXRwdXRzU3BsaWNlID0ge1xuXHRzdGFydDogbnVtYmVyIC8qIHN0YXJ0ICovO1xuXHRkZWxldGVDb3VudDogbnVtYmVyIC8qIGRlbGV0ZSBjb3VudCAqLztcblx0bmV3T3V0cHV0czogSUNlbGxPdXRwdXRbXTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1haW5DZWxsRHRvIHtcblx0aGFuZGxlOiBudW1iZXI7XG5cdHVybDogc3RyaW5nO1xuXHRzb3VyY2U6IHN0cmluZ1tdO1xuXHRlb2w6IHN0cmluZztcblx0dmVyc2lvbklkOiBudW1iZXI7XG5cdGxhbmd1YWdlOiBzdHJpbmc7XG5cdGNlbGxLaW5kOiBDZWxsS2luZDtcblx0b3V0cHV0czogSU91dHB1dER0b1tdO1xuXHRtZXRhZGF0YT86IE5vdGVib29rQ2VsbE1ldGFkYXRhO1xuXHRpbnRlcm5hbE1ldGFkYXRhPzogTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGVudW0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUge1xuXHRNb2RlbENoYW5nZSA9IDEsXG5cdE1vdmUgPSAyLFxuXHRDaGFuZ2VDZWxsTGFuZ3VhZ2UgPSA1LFxuXHRJbml0aWFsaXplID0gNixcblx0Q2hhbmdlQ2VsbE1ldGFkYXRhID0gNyxcblx0T3V0cHV0ID0gOCxcblx0T3V0cHV0SXRlbSA9IDksXG5cdENoYW5nZUNlbGxDb250ZW50ID0gMTAsXG5cdENoYW5nZURvY3VtZW50TWV0YWRhdGEgPSAxMSxcblx0Q2hhbmdlQ2VsbEludGVybmFsTWV0YWRhdGEgPSAxMixcblx0Q2hhbmdlQ2VsbE1pbWUgPSAxMyxcblx0VW5rbm93biA9IDEwMFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbHNJbml0aWFsaXplRXZlbnQ8VD4ge1xuXHRyZWFkb25seSBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Jbml0aWFsaXplO1xuXHRyZWFkb25seSBjaGFuZ2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8VD5bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va0NlbGxDb250ZW50Q2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsQ29udGVudDtcblx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va0NlbGxzTW9kZWxDaGFuZ2VkRXZlbnQ8VD4ge1xuXHRyZWFkb25seSBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb2RlbENoYW5nZTtcblx0cmVhZG9ubHkgY2hhbmdlczogTm90ZWJvb2tDZWxsVGV4dE1vZGVsU3BsaWNlPFQ+W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tDZWxsc01vZGVsTW92ZUV2ZW50PFQ+IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW92ZTtcblx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgbGVuZ3RoOiBudW1iZXI7XG5cdHJlYWRvbmx5IG5ld0lkeDogbnVtYmVyO1xuXHRyZWFkb25seSBjZWxsczogVFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rT3V0cHV0Q2hhbmdlZEV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuT3V0cHV0O1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXRzOiBJT3V0cHV0RHRvW107XG5cdHJlYWRvbmx5IGFwcGVuZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va091dHB1dEl0ZW1DaGFuZ2VkRXZlbnQge1xuXHRyZWFkb25seSBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5PdXRwdXRJdGVtO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXRJZDogc3RyaW5nO1xuXHRyZWFkb25seSBvdXRwdXRJdGVtczogSU91dHB1dEl0ZW1EdG9bXTtcblx0cmVhZG9ubHkgYXBwZW5kOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbHNDaGFuZ2VMYW5ndWFnZUV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbExhbmd1YWdlO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBsYW5ndWFnZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbHNDaGFuZ2VNaW1lRXZlbnQge1xuXHRyZWFkb25seSBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsTWltZTtcblx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgbWltZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rQ2VsbHNDaGFuZ2VNZXRhZGF0YUV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbE1ldGFkYXRhO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBtZXRhZGF0YTogTm90ZWJvb2tDZWxsTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tDZWxsc0NoYW5nZUludGVybmFsTWV0YWRhdGFFdmVudCB7XG5cdHJlYWRvbmx5IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxJbnRlcm5hbE1ldGFkYXRhO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBpbnRlcm5hbE1ldGFkYXRhOiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rRG9jdW1lbnRDaGFuZ2VNZXRhZGF0YUV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlRG9jdW1lbnRNZXRhZGF0YTtcblx0cmVhZG9ubHkgbWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va0RvY3VtZW50VW5rbm93bkNoYW5nZUV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuVW5rbm93bjtcbn1cblxuZXhwb3J0IHR5cGUgTm90ZWJvb2tSYXdDb250ZW50RXZlbnREdG8gPSBOb3RlYm9va0NlbGxzSW5pdGlhbGl6ZUV2ZW50PElNYWluQ2VsbER0bz4gfCBOb3RlYm9va0RvY3VtZW50Q2hhbmdlTWV0YWRhdGFFdmVudCB8IE5vdGVib29rQ2VsbENvbnRlbnRDaGFuZ2VFdmVudCB8IE5vdGVib29rQ2VsbHNNb2RlbENoYW5nZWRFdmVudDxJTWFpbkNlbGxEdG8+IHwgTm90ZWJvb2tDZWxsc01vZGVsTW92ZUV2ZW50PElNYWluQ2VsbER0bz4gfCBOb3RlYm9va091dHB1dENoYW5nZWRFdmVudCB8IE5vdGVib29rT3V0cHV0SXRlbUNoYW5nZWRFdmVudCB8IE5vdGVib29rQ2VsbHNDaGFuZ2VMYW5ndWFnZUV2ZW50IHwgTm90ZWJvb2tDZWxsc0NoYW5nZU1pbWVFdmVudCB8IE5vdGVib29rQ2VsbHNDaGFuZ2VNZXRhZGF0YUV2ZW50IHwgTm90ZWJvb2tDZWxsc0NoYW5nZUludGVybmFsTWV0YWRhdGFFdmVudCB8IE5vdGVib29rRG9jdW1lbnRVbmtub3duQ2hhbmdlRXZlbnQ7XG5cbmV4cG9ydCB0eXBlIE5vdGVib29rQ2VsbHNDaGFuZ2VkRXZlbnREdG8gPSB7XG5cdHJlYWRvbmx5IHJhd0V2ZW50czogTm90ZWJvb2tSYXdDb250ZW50RXZlbnREdG9bXTtcblx0cmVhZG9ubHkgdmVyc2lvbklkOiBudW1iZXI7XG59O1xuXG5leHBvcnQgdHlwZSBOb3RlYm9va1Jhd0NvbnRlbnRFdmVudCA9IChOb3RlYm9va0NlbGxzSW5pdGlhbGl6ZUV2ZW50PElDZWxsPiB8IE5vdGVib29rRG9jdW1lbnRDaGFuZ2VNZXRhZGF0YUV2ZW50IHwgTm90ZWJvb2tDZWxsQ29udGVudENoYW5nZUV2ZW50IHwgTm90ZWJvb2tDZWxsc01vZGVsQ2hhbmdlZEV2ZW50PElDZWxsPiB8IE5vdGVib29rQ2VsbHNNb2RlbE1vdmVFdmVudDxJQ2VsbD4gfCBOb3RlYm9va091dHB1dENoYW5nZWRFdmVudCB8IE5vdGVib29rT3V0cHV0SXRlbUNoYW5nZWRFdmVudCB8IE5vdGVib29rQ2VsbHNDaGFuZ2VMYW5ndWFnZUV2ZW50IHwgTm90ZWJvb2tDZWxsc0NoYW5nZU1pbWVFdmVudCB8IE5vdGVib29rQ2VsbHNDaGFuZ2VNZXRhZGF0YUV2ZW50IHwgTm90ZWJvb2tDZWxsc0NoYW5nZUludGVybmFsTWV0YWRhdGFFdmVudCB8IE5vdGVib29rRG9jdW1lbnRVbmtub3duQ2hhbmdlRXZlbnQpICYgeyB0cmFuc2llbnQ6IGJvb2xlYW4gfTtcblxuZXhwb3J0IGVudW0gU2VsZWN0aW9uU3RhdGVUeXBlIHtcblx0SGFuZGxlID0gMCxcblx0SW5kZXggPSAxXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlbGVjdGlvbkhhbmRsZVN0YXRlIHtcblx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkhhbmRsZTtcblx0cHJpbWFyeTogbnVtYmVyIHwgbnVsbDtcblx0c2VsZWN0aW9uczogbnVtYmVyW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlbGVjdGlvbkluZGV4U3RhdGUge1xuXHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXg7XG5cdGZvY3VzOiBJQ2VsbFJhbmdlO1xuXHRzZWxlY3Rpb25zOiBJQ2VsbFJhbmdlW107XG59XG5cbmV4cG9ydCB0eXBlIElTZWxlY3Rpb25TdGF0ZSA9IElTZWxlY3Rpb25IYW5kbGVTdGF0ZSB8IElTZWxlY3Rpb25JbmRleFN0YXRlO1xuXG5leHBvcnQgdHlwZSBOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudCA9IHtcblx0cmVhZG9ubHkgcmF3RXZlbnRzOiBOb3RlYm9va1Jhd0NvbnRlbnRFdmVudFtdO1xuXHRyZWFkb25seSB2ZXJzaW9uSWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgc3luY2hyb25vdXM6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGVuZFNlbGVjdGlvblN0YXRlOiBJU2VsZWN0aW9uU3RhdGUgfCB1bmRlZmluZWQ7XG59O1xuXG5leHBvcnQgdHlwZSBOb3RlYm9va1RleHRNb2RlbFdpbGxBZGRSZW1vdmVFdmVudCA9IHtcblx0cmVhZG9ubHkgcmF3RXZlbnQ6IE5vdGVib29rQ2VsbHNNb2RlbENoYW5nZWRFdmVudDxJQ2VsbD47XG59O1xuXG5leHBvcnQgY29uc3QgZW51bSBDZWxsRWRpdFR5cGUge1xuXHRSZXBsYWNlID0gMSxcblx0T3V0cHV0ID0gMixcblx0TWV0YWRhdGEgPSAzLFxuXHRDZWxsTGFuZ3VhZ2UgPSA0LFxuXHREb2N1bWVudE1ldGFkYXRhID0gNSxcblx0TW92ZSA9IDYsXG5cdE91dHB1dEl0ZW1zID0gNyxcblx0UGFydGlhbE1ldGFkYXRhID0gOCxcblx0UGFydGlhbEludGVybmFsTWV0YWRhdGEgPSA5LFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsRHRvMiB7XG5cdHNvdXJjZTogc3RyaW5nO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xuXHRtaW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGNlbGxLaW5kOiBDZWxsS2luZDtcblx0b3V0cHV0czogSU91dHB1dER0b1tdO1xuXHRtZXRhZGF0YT86IE5vdGVib29rQ2VsbE1ldGFkYXRhO1xuXHRpbnRlcm5hbE1ldGFkYXRhPzogTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YTtcblx0Y29sbGFwc2VTdGF0ZT86IE5vdGVib29rQ2VsbENvbGxhcHNlU3RhdGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxSZXBsYWNlRWRpdCB7XG5cdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZTtcblx0aW5kZXg6IG51bWJlcjtcblx0Y291bnQ6IG51bWJlcjtcblx0Y2VsbHM6IElDZWxsRHRvMltdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsT3V0cHV0RWRpdCB7XG5cdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0O1xuXHRpbmRleDogbnVtYmVyO1xuXHRvdXRwdXRzOiBJT3V0cHV0RHRvW107XG5cdGFwcGVuZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxPdXRwdXRFZGl0QnlIYW5kbGUge1xuXHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dDtcblx0aGFuZGxlOiBudW1iZXI7XG5cdG91dHB1dHM6IElPdXRwdXREdG9bXTtcblx0YXBwZW5kPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2VsbE91dHB1dEl0ZW1FZGl0IHtcblx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcztcblx0b3V0cHV0SWQ6IHN0cmluZztcblx0aXRlbXM6IElPdXRwdXRJdGVtRHRvW107XG5cdGFwcGVuZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxNZXRhZGF0YUVkaXQge1xuXHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhO1xuXHRpbmRleDogbnVtYmVyO1xuXHRtZXRhZGF0YTogTm90ZWJvb2tDZWxsTWV0YWRhdGE7XG59XG5cbi8vIFRoZXNlIHR5cGVzIGFyZSBudWxsYWJsZSBiZWNhdXNlIHdlIG5lZWQgdG8gdXNlICdudWxsJyBvbiB0aGUgRUggc2lkZSBzbyBpdCBpcyBKU09OLXN0cmluZ2lmaWVkXG5leHBvcnQgdHlwZSBOdWxsYWJsZVBhcnRpYWxOb3RlYm9va0NlbGxNZXRhZGF0YSA9IHtcblx0W0tleSBpbiBrZXlvZiBQYXJ0aWFsPE5vdGVib29rQ2VsbE1ldGFkYXRhPl06IE5vdGVib29rQ2VsbE1ldGFkYXRhW0tleV0gfCBudWxsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsUGFydGlhbE1ldGFkYXRhRWRpdCB7XG5cdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUGFydGlhbE1ldGFkYXRhO1xuXHRpbmRleDogbnVtYmVyO1xuXHRtZXRhZGF0YTogTnVsbGFibGVQYXJ0aWFsTm90ZWJvb2tDZWxsTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxQYXJ0aWFsTWV0YWRhdGFFZGl0QnlIYW5kbGUge1xuXHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxNZXRhZGF0YTtcblx0aGFuZGxlOiBudW1iZXI7XG5cdG1ldGFkYXRhOiBOdWxsYWJsZVBhcnRpYWxOb3RlYm9va0NlbGxNZXRhZGF0YTtcbn1cblxuZXhwb3J0IHR5cGUgTnVsbGFibGVQYXJ0aWFsTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YSA9IHtcblx0W0tleSBpbiBrZXlvZiBQYXJ0aWFsPE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGE+XTogTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YVtLZXldIHwgbnVsbFxufTtcbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxQYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YUVkaXQge1xuXHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhO1xuXHRpbmRleDogbnVtYmVyO1xuXHRpbnRlcm5hbE1ldGFkYXRhOiBOdWxsYWJsZVBhcnRpYWxOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsUGFydGlhbEludGVybmFsTWV0YWRhdGFFZGl0QnlIYW5kbGUge1xuXHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhO1xuXHRoYW5kbGU6IG51bWJlcjtcblx0aW50ZXJuYWxNZXRhZGF0YTogTnVsbGFibGVQYXJ0aWFsTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2VsbExhbmd1YWdlRWRpdCB7XG5cdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuQ2VsbExhbmd1YWdlO1xuXHRpbmRleDogbnVtYmVyO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEb2N1bWVudE1ldGFkYXRhRWRpdCB7XG5cdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuRG9jdW1lbnRNZXRhZGF0YTtcblx0bWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2VsbE1vdmVFZGl0IHtcblx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5Nb3ZlO1xuXHRpbmRleDogbnVtYmVyO1xuXHRsZW5ndGg6IG51bWJlcjtcblx0bmV3SWR4OiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIElJbW1lZGlhdGVDZWxsRWRpdE9wZXJhdGlvbiA9IElDZWxsT3V0cHV0RWRpdEJ5SGFuZGxlIHwgSUNlbGxQYXJ0aWFsTWV0YWRhdGFFZGl0QnlIYW5kbGUgfCBJQ2VsbE91dHB1dEl0ZW1FZGl0IHwgSUNlbGxQYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YUVkaXQgfCBJQ2VsbFBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhRWRpdEJ5SGFuZGxlIHwgSUNlbGxQYXJ0aWFsTWV0YWRhdGFFZGl0O1xuZXhwb3J0IHR5cGUgSUNlbGxFZGl0T3BlcmF0aW9uID0gSUltbWVkaWF0ZUNlbGxFZGl0T3BlcmF0aW9uIHwgSUNlbGxSZXBsYWNlRWRpdCB8IElDZWxsT3V0cHV0RWRpdCB8IElDZWxsTWV0YWRhdGFFZGl0IHwgSUNlbGxQYXJ0aWFsTWV0YWRhdGFFZGl0IHwgSUNlbGxQYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YUVkaXQgfCBJRG9jdW1lbnRNZXRhZGF0YUVkaXQgfCBJQ2VsbE1vdmVFZGl0IHwgSUNlbGxPdXRwdXRJdGVtRWRpdCB8IElDZWxsTGFuZ3VhZ2VFZGl0O1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtzcGFjZU5vdGVib29rQ2VsbEVkaXQge1xuXHRtZXRhZGF0YT86IFdvcmtzcGFjZUVkaXRNZXRhZGF0YTtcblx0cmVzb3VyY2U6IFVSSTtcblx0bm90ZWJvb2tWZXJzaW9uSWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0Y2VsbEVkaXQ6IElDZWxsUGFydGlhbE1ldGFkYXRhRWRpdCB8IElEb2N1bWVudE1ldGFkYXRhRWRpdCB8IElDZWxsUmVwbGFjZUVkaXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtzcGFjZU5vdGVib29rQ2VsbEVkaXREdG8ge1xuXHRtZXRhZGF0YT86IFdvcmtzcGFjZUVkaXRNZXRhZGF0YTtcblx0cmVzb3VyY2U6IFVSSTtcblx0bm90ZWJvb2tWZXJzaW9uSWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0Y2VsbEVkaXQ6IElDZWxsUGFydGlhbE1ldGFkYXRhRWRpdCB8IElEb2N1bWVudE1ldGFkYXRhRWRpdCB8IElDZWxsUmVwbGFjZUVkaXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tEYXRhIHtcblx0cmVhZG9ubHkgY2VsbHM6IElDZWxsRHRvMltdO1xuXHRyZWFkb25seSBtZXRhZGF0YTogTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhO1xufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ29udHJpYnV0aW9uRGF0YSB7XG5cdGV4dGVuc2lvbj86IEV4dGVuc2lvbklkZW50aWZpZXI7XG5cdHByb3ZpZGVyRGlzcGxheU5hbWU6IHN0cmluZztcblx0ZGlzcGxheU5hbWU6IHN0cmluZztcblx0ZmlsZW5hbWVQYXR0ZXJuOiAoc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuIHwgSU5vdGVib29rRXhjbHVzaXZlRG9jdW1lbnRGaWx0ZXIpW107XG5cdHByaW9yaXR5PzogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5O1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIE5vdGVib29rTWV0YWRhdGFVcmkge1xuXHRleHBvcnQgY29uc3Qgc2NoZW1lID0gU2NoZW1hcy52c2NvZGVOb3RlYm9va01ldGFkYXRhO1xuXHRleHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGUobm90ZWJvb2s6IFVSSSk6IFVSSSB7XG5cdFx0cmV0dXJuIGdlbmVyYXRlTWV0YWRhdGFVcmkobm90ZWJvb2spO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiBwYXJzZShtZXRhZGF0YTogVVJJKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gcGFyc2VNZXRhZGF0YVVyaShtZXRhZGF0YSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDZWxsVXJpIHtcblx0ZXhwb3J0IGNvbnN0IHNjaGVtZSA9IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsO1xuXHRleHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGUobm90ZWJvb2s6IFVSSSwgaGFuZGxlOiBudW1iZXIpOiBVUkkge1xuXHRcdHJldHVybiBnZW5lcmF0ZVVyaShub3RlYm9vaywgaGFuZGxlKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBwYXJzZShjZWxsOiBVUkkpOiB7IG5vdGVib29rOiBVUkk7IGhhbmRsZTogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBwYXJzZVVyaShjZWxsKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgYSBVUkkgZm9yIGEgY2VsbCBvdXRwdXQgaW4gYSBub3RlYm9vayB1c2luZyB0aGUgb3V0cHV0IElELlxuXHQgKiBVc2VkIHdoZW4gVVJJIHNob3VsZCBiZSBvcGVuZWQgYXMgdGV4dCBpbiB0aGUgZWRpdG9yLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ2VsbE91dHB1dFVyaVdpdGhJZChub3RlYm9vazogVVJJLCBvdXRwdXRJZD86IHN0cmluZykge1xuXHRcdHJldHVybiBub3RlYm9vay53aXRoKHtcblx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxPdXRwdXQsXG5cdFx0XHRxdWVyeTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG5cdFx0XHRcdG9wZW5JbjogJ2VkaXRvcicsXG5cdFx0XHRcdG91dHB1dElkOiBvdXRwdXRJZCA/PyAnJyxcblx0XHRcdFx0bm90ZWJvb2tTY2hlbWU6IG5vdGVib29rLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlID8gbm90ZWJvb2suc2NoZW1lIDogJycsXG5cdFx0XHR9KS50b1N0cmluZygpXG5cdFx0fSk7XG5cdH1cblx0LyoqXG5cdCAqIEdlbmVyYXRlcyBhIFVSSSBmb3IgYSBjZWxsIG91dHB1dCBpbiBhIG5vdGVib29rIHVzaW5nIHRoZSBvdXRwdXQgaW5kZXguXG5cdCAqIFVzZWQgd2hlbiBVUkkgc2hvdWxkIGJlIG9wZW5lZCBpbiBub3RlYm9vayBlZGl0b3IuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDZWxsT3V0cHV0VXJpV2l0aEluZGV4KG5vdGVib29rOiBVUkksIGNlbGxVcmk6IFVSSSwgb3V0cHV0SW5kZXg6IG51bWJlcik6IFVSSSB7XG5cdFx0cmV0dXJuIG5vdGVib29rLndpdGgoe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE91dHB1dCxcblx0XHRcdGZyYWdtZW50OiBjZWxsVXJpLmZyYWdtZW50LFxuXHRcdFx0cXVlcnk6IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuXHRcdFx0XHRvcGVuSW46ICdub3RlYm9vaycsXG5cdFx0XHRcdG91dHB1dEluZGV4OiBTdHJpbmcob3V0cHV0SW5kZXgpLFxuXHRcdFx0fSkudG9TdHJpbmcoKVxuXHRcdH0pO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ2VsbE91dHB1dFVyaSh1cmk6IFVSSSk6IHsgbm90ZWJvb2s6IFVSSTsgb3BlbkluOiBzdHJpbmc7IG91dHB1dElkPzogc3RyaW5nOyBjZWxsRnJhZ21lbnQ/OiBzdHJpbmc7IG91dHB1dEluZGV4PzogbnVtYmVyOyBjZWxsSGFuZGxlPzogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBleHRyYWN0Q2VsbE91dHB1dERldGFpbHModXJpKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaShub3RlYm9vazogVVJJLCBoYW5kbGU6IG51bWJlciwgc2NoZW1lOiBzdHJpbmcpOiBVUkkge1xuXHRcdHJldHVybiBDZWxsVXJpLmdlbmVyYXRlKG5vdGVib29rLCBoYW5kbGUpLndpdGgoeyBzY2hlbWU6IHNjaGVtZSB9KTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBwYXJzZUNlbGxQcm9wZXJ0eVVyaSh1cmk6IFVSSSwgcHJvcGVydHlTY2hlbWU6IHN0cmluZykge1xuXHRcdGlmICh1cmkuc2NoZW1lICE9PSBwcm9wZXJ0eVNjaGVtZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gQ2VsbFVyaS5wYXJzZSh1cmkud2l0aCh7IHNjaGVtZTogc2NoZW1lIH0pKTtcblx0fVxufVxuXG5jb25zdCBub3JtYWxpemVTbGFzaGVzID0gKHN0cjogc3RyaW5nKSA9PiBpc1dpbmRvd3MgPyBzdHIucmVwbGFjZSgvXFwvL2csICdcXFxcJykgOiBzdHI7XG5cbmludGVyZmFjZSBJTWltZVR5cGVXaXRoTWF0Y2hlciB7XG5cdHBhdHRlcm46IHN0cmluZztcblx0bWF0Y2hlczogZ2xvYi5QYXJzZWRQYXR0ZXJuO1xufVxuXG5leHBvcnQgY2xhc3MgTWltZVR5cGVEaXNwbGF5T3JkZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IG9yZGVyOiBJTWltZVR5cGVXaXRoTWF0Y2hlcltdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGluaXRpYWxWYWx1ZTogcmVhZG9ubHkgc3RyaW5nW10gPSBbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRPcmRlciA9IE5PVEVCT09LX0RJU1BMQVlfT1JERVIsXG5cdCkge1xuXHRcdHRoaXMub3JkZXIgPSBbLi4ubmV3IFNldChpbml0aWFsVmFsdWUpXS5tYXAocGF0dGVybiA9PiAoe1xuXHRcdFx0cGF0dGVybixcblx0XHRcdG1hdGNoZXM6IGdsb2IucGFyc2Uobm9ybWFsaXplU2xhc2hlcyhwYXR0ZXJuKSlcblx0XHR9KSk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIHNvcnRlZCBhcnJheSBvZiB0aGUgaW5wdXQgbWltZXR5cGVzLlxuXHQgKi9cblx0cHVibGljIHNvcnQobWltZXR5cGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlbWFpbmluZyA9IG5ldyBNYXAoSXRlcmFibGUubWFwKG1pbWV0eXBlcywgbSA9PiBbbSwgbm9ybWFsaXplU2xhc2hlcyhtKV0pKTtcblx0XHRsZXQgc29ydGVkOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCB7IG1hdGNoZXMgfSBvZiB0aGlzLm9yZGVyKSB7XG5cdFx0XHRmb3IgKGNvbnN0IFtvcmlnaW5hbCwgbm9ybWFsaXplZF0gb2YgcmVtYWluaW5nKSB7XG5cdFx0XHRcdGlmIChtYXRjaGVzKG5vcm1hbGl6ZWQpKSB7XG5cdFx0XHRcdFx0c29ydGVkLnB1c2gob3JpZ2luYWwpO1xuXHRcdFx0XHRcdHJlbWFpbmluZy5kZWxldGUob3JpZ2luYWwpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJlbWFpbmluZy5zaXplKSB7XG5cdFx0XHRzb3J0ZWQgPSBzb3J0ZWQuY29uY2F0KFsuLi5yZW1haW5pbmcua2V5cygpXS5zb3J0KFxuXHRcdFx0XHQoYSwgYikgPT4gdGhpcy5kZWZhdWx0T3JkZXIuaW5kZXhPZihhKSAtIHRoaXMuZGVmYXVsdE9yZGVyLmluZGV4T2YoYiksXG5cdFx0XHQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc29ydGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlY29yZHMgdGhhdCB0aGUgdXNlciBzZWxlY3RlZCB0aGUgZ2l2ZW4gbWltZXR5cGUgb3ZlciB0aGUgb3RoZXJcblx0ICogcG9zc2libGUgbWltZXR5cGVzLCBwcmlvcml0aXppbmcgaXQgZm9yIGZ1dHVyZSByZWZlcmVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgcHJpb3JpdGl6ZShjaG9zZW5NaW1ldHlwZTogc3RyaW5nLCBvdGhlck1pbWV0eXBlczogcmVhZG9ubHkgc3RyaW5nW10pIHtcblx0XHRjb25zdCBjaG9zZW5JbmRleCA9IHRoaXMuZmluZEluZGV4KGNob3Nlbk1pbWV0eXBlKTtcblx0XHRpZiAoY2hvc2VuSW5kZXggPT09IC0xKSB7XG5cdFx0XHQvLyBhbHdheXMgZmlyc3QsIG5vdGhpbmcgbW9yZSB0byBkb1xuXHRcdFx0dGhpcy5vcmRlci51bnNoaWZ0KHsgcGF0dGVybjogY2hvc2VuTWltZXR5cGUsIG1hdGNoZXM6IGdsb2IucGFyc2Uobm9ybWFsaXplU2xhc2hlcyhjaG9zZW5NaW1ldHlwZSkpIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEdldCB0aGUgb3RoZXIgbWltZXR5cGVzIHRoYXQgYXJlIGJlZm9yZSB0aGUgY2hvc2VuTWltZXR5cGUuIFRoZW4sIG1vdmVcblx0XHQvLyB0aGVtIGFmdGVyIGl0LCByZXRhaW5pbmcgb3JkZXIuXG5cdFx0Y29uc3QgdW5pcXVlSW5kaWNpZXMgPSBuZXcgU2V0KG90aGVyTWltZXR5cGVzLm1hcChtID0+IHRoaXMuZmluZEluZGV4KG0sIGNob3NlbkluZGV4KSkpO1xuXHRcdHVuaXF1ZUluZGljaWVzLmRlbGV0ZSgtMSk7XG5cdFx0Y29uc3Qgb3RoZXJJbmRpY2VzID0gQXJyYXkuZnJvbSh1bmlxdWVJbmRpY2llcykuc29ydCgpO1xuXHRcdHRoaXMub3JkZXIuc3BsaWNlKGNob3NlbkluZGV4ICsgMSwgMCwgLi4ub3RoZXJJbmRpY2VzLm1hcChpID0+IHRoaXMub3JkZXJbaV0pKTtcblxuXHRcdGZvciAobGV0IG9pID0gb3RoZXJJbmRpY2VzLmxlbmd0aCAtIDE7IG9pID49IDA7IG9pLS0pIHtcblx0XHRcdHRoaXMub3JkZXIuc3BsaWNlKG90aGVySW5kaWNlc1tvaV0sIDEpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIGFuIGFycmF5IG9mIGluLW9yZGVyIG1pbWV0eXBlIHByZWZlcmVuY2VzLlxuXHQgKi9cblx0cHVibGljIHRvQXJyYXkoKSB7XG5cdFx0cmV0dXJuIHRoaXMub3JkZXIubWFwKG8gPT4gby5wYXR0ZXJuKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEluZGV4KG1pbWVUeXBlOiBzdHJpbmcsIG1heEluZGV4ID0gdGhpcy5vcmRlci5sZW5ndGgpIHtcblx0XHRjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplU2xhc2hlcyhtaW1lVHlwZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtYXhJbmRleDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5vcmRlcltpXS5tYXRjaGVzKG5vcm1hbGl6ZWQpKSB7XG5cdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiAtMTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSU11dGFibGVTcGxpY2U8VD4gZXh0ZW5kcyBJU3BsaWNlPFQ+IHtcblx0cmVhZG9ubHkgdG9JbnNlcnQ6IFRbXTtcblx0ZGVsZXRlQ291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmY8VD4oYmVmb3JlOiBUW10sIGFmdGVyOiBUW10sIGNvbnRhaW5zOiAoYTogVCkgPT4gYm9vbGVhbiwgZXF1YWw6IChhOiBULCBiOiBUKSA9PiBib29sZWFuID0gKGE6IFQsIGI6IFQpID0+IGEgPT09IGIpOiBJU3BsaWNlPFQ+W10ge1xuXHRjb25zdCByZXN1bHQ6IElNdXRhYmxlU3BsaWNlPFQ+W10gPSBbXTtcblxuXHRmdW5jdGlvbiBwdXNoU3BsaWNlKHN0YXJ0OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIHRvSW5zZXJ0OiBUW10pOiB2b2lkIHtcblx0XHRpZiAoZGVsZXRlQ291bnQgPT09IDAgJiYgdG9JbnNlcnQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF0ZXN0ID0gcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXTtcblxuXHRcdGlmIChsYXRlc3QgJiYgbGF0ZXN0LnN0YXJ0ICsgbGF0ZXN0LmRlbGV0ZUNvdW50ID09PSBzdGFydCkge1xuXHRcdFx0bGF0ZXN0LmRlbGV0ZUNvdW50ICs9IGRlbGV0ZUNvdW50O1xuXHRcdFx0bGF0ZXN0LnRvSW5zZXJ0LnB1c2goLi4udG9JbnNlcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQucHVzaCh7IHN0YXJ0LCBkZWxldGVDb3VudCwgdG9JbnNlcnQgfSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGJlZm9yZUlkeCA9IDA7XG5cdGxldCBhZnRlcklkeCA9IDA7XG5cblx0d2hpbGUgKHRydWUpIHtcblx0XHRpZiAoYmVmb3JlSWR4ID09PSBiZWZvcmUubGVuZ3RoKSB7XG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgMCwgYWZ0ZXIuc2xpY2UoYWZ0ZXJJZHgpKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChhZnRlcklkeCA9PT0gYWZ0ZXIubGVuZ3RoKSB7XG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgYmVmb3JlLmxlbmd0aCAtIGJlZm9yZUlkeCwgW10pO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmVmb3JlRWxlbWVudCA9IGJlZm9yZVtiZWZvcmVJZHhdO1xuXHRcdGNvbnN0IGFmdGVyRWxlbWVudCA9IGFmdGVyW2FmdGVySWR4XTtcblxuXHRcdGlmIChlcXVhbChiZWZvcmVFbGVtZW50LCBhZnRlckVsZW1lbnQpKSB7XG5cdFx0XHQvLyBlcXVhbFxuXHRcdFx0YmVmb3JlSWR4ICs9IDE7XG5cdFx0XHRhZnRlcklkeCArPSAxO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRhaW5zKGFmdGVyRWxlbWVudCkpIHtcblx0XHRcdC8vIGBhZnRlckVsZW1lbnRgIGV4aXN0cyBiZWZvcmUsIHdoaWNoIG1lYW5zIHNvbWUgZWxlbWVudHMgYmVmb3JlIGBhZnRlckVsZW1lbnRgIGFyZSBkZWxldGVkXG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgMSwgW10pO1xuXHRcdFx0YmVmb3JlSWR4ICs9IDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGBhZnRlckVsZW1lbnRgIGFkZGVkXG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgMCwgW2FmdGVyRWxlbWVudF0pO1xuXHRcdFx0YWZ0ZXJJZHggKz0gMTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsRWRpdG9yVmlld1N0YXRlIHtcblx0c2VsZWN0aW9uczogZWRpdG9yQ29tbW9uLklDdXJzb3JTdGF0ZVtdO1xufVxuXG5leHBvcnQgY29uc3QgTk9URUJPT0tfRURJVE9SX0NVUlNPUl9CT1VOREFSWSA9IG5ldyBSYXdDb250ZXh0S2V5PCdub25lJyB8ICd0b3AnIHwgJ2JvdHRvbScgfCAnYm90aCc+KCdub3RlYm9va0VkaXRvckN1cnNvckF0Qm91bmRhcnknLCAnbm9uZScpO1xuXG5leHBvcnQgY29uc3QgTk9URUJPT0tfRURJVE9SX0NVUlNPUl9MSU5FX0JPVU5EQVJZID0gbmV3IFJhd0NvbnRleHRLZXk8J25vbmUnIHwgJ3N0YXJ0JyB8ICdlbmQnIHwgJ2JvdGgnPignbm90ZWJvb2tFZGl0b3JDdXJzb3JBdExpbmVCb3VuZGFyeScsICdub25lJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rTG9hZE9wdGlvbnMge1xuXHQvKipcblx0ICogR28gdG8gZGlzayBieXBhc3NpbmcgYW55IGNhY2hlIG9mIHRoZSBtb2RlbCBpZiBhbnkuXG5cdCAqL1xuXHRmb3JjZVJlYWRGcm9tRmlsZT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBJZiBwcm92aWRlZCwgdGhlIHNpemUgb2YgdGhlIGZpbGUgd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIGxpbWl0c1xuXHQgKiBhbmQgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYW55IGxpbWl0IGlzIGV4Y2VlZGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgbGltaXRzPzogSUZpbGVSZWFkTGltaXRzO1xufVxuXG5leHBvcnQgdHlwZSBOb3RlYm9va0VkaXRvck1vZGVsQ3JlYXRpb25PcHRpb25zID0ge1xuXHRsaW1pdHM/OiBJRmlsZVJlYWRMaW1pdHM7XG5cdHNjcmF0Y2hwYWQ/OiBib29sZWFuO1xuXHR2aWV3VHlwZT86IHN0cmluZztcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbCBleHRlbmRzIElOb3RlYm9va0VkaXRvck1vZGVsIHtcblx0bm90ZWJvb2s6IE5vdGVib29rVGV4dE1vZGVsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0VkaXRvck1vZGVsIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBvbkRpZENoYW5nZURpcnR5OiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgb25EaWRTYXZlOiBFdmVudDxJV29ya2luZ0NvcHlTYXZlRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU9ycGhhbmVkOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZWFkb25seTogRXZlbnQ8dm9pZD47XG5cdHJlYWRvbmx5IG9uRGlkUmV2ZXJ0VW50aXRsZWQ6IEV2ZW50PHZvaWQ+O1xuXHRyZWFkb25seSByZXNvdXJjZTogVVJJO1xuXHRyZWFkb25seSB2aWV3VHlwZTogc3RyaW5nO1xuXHRyZWFkb25seSBub3RlYm9vazogSU5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBoYXNFcnJvclN0YXRlOiBib29sZWFuO1xuXHRpc1Jlc29sdmVkKCk6IGJvb2xlYW47XG5cdGlzRGlydHkoKTogYm9vbGVhbjtcblx0aXNNb2RpZmllZCgpOiBib29sZWFuO1xuXHRpc1JlYWRvbmx5KCk6IGJvb2xlYW4gfCBJTWFya2Rvd25TdHJpbmc7XG5cdGlzT3JwaGFuZWQoKTogYm9vbGVhbjtcblx0aGFzQXNzb2NpYXRlZEZpbGVQYXRoKCk6IGJvb2xlYW47XG5cdGxvYWQob3B0aW9ucz86IElOb3RlYm9va0xvYWRPcHRpb25zKTogUHJvbWlzZTxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPjtcblx0c2F2ZShvcHRpb25zPzogSVNhdmVPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPjtcblx0c2F2ZUFzKHRhcmdldDogVVJJKTogUHJvbWlzZTxJVW50eXBlZEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPjtcblx0cmV2ZXJ0KG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rRGlmZkVkaXRvck1vZGVsIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRvcmlnaW5hbDogeyBub3RlYm9vazogTm90ZWJvb2tUZXh0TW9kZWw7IHJlc291cmNlOiBVUkk7IHZpZXdUeXBlOiBzdHJpbmcgfTtcblx0bW9kaWZpZWQ6IHsgbm90ZWJvb2s6IE5vdGVib29rVGV4dE1vZGVsOyByZXNvdXJjZTogVVJJOyB2aWV3VHlwZTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tEb2N1bWVudEJhY2t1cERhdGEgZXh0ZW5kcyBJV29ya2luZ0NvcHlCYWNrdXBNZXRhIHtcblx0cmVhZG9ubHkgdmlld1R5cGU6IHN0cmluZztcblx0cmVhZG9ubHkgYmFja3VwSWQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IG10aW1lPzogbnVtYmVyO1xufVxuXG5leHBvcnQgZW51bSBOb3RlYm9va0VkaXRvclByaW9yaXR5IHtcblx0ZGVmYXVsdCA9ICdkZWZhdWx0Jyxcblx0b3B0aW9uID0gJ29wdGlvbicsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rRmluZE9wdGlvbnMge1xuXHRyZWdleD86IGJvb2xlYW47XG5cdHdob2xlV29yZD86IGJvb2xlYW47XG5cdGNhc2VTZW5zaXRpdmU/OiBib29sZWFuO1xuXHR3b3JkU2VwYXJhdG9ycz86IHN0cmluZztcblx0aW5jbHVkZU1hcmt1cElucHV0PzogYm9vbGVhbjtcblx0aW5jbHVkZU1hcmt1cFByZXZpZXc/OiBib29sZWFuO1xuXHRpbmNsdWRlQ29kZUlucHV0PzogYm9vbGVhbjtcblx0aW5jbHVkZU91dHB1dD86IGJvb2xlYW47XG5cdGZpbmRTY29wZT86IElOb3RlYm9va0ZpbmRTY29wZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tGaW5kU2NvcGUge1xuXHRmaW5kU2NvcGVUeXBlOiBOb3RlYm9va0ZpbmRTY29wZVR5cGU7XG5cdHNlbGVjdGVkQ2VsbFJhbmdlcz86IElDZWxsUmFuZ2VbXTtcblx0c2VsZWN0ZWRUZXh0UmFuZ2VzPzogUmFuZ2VbXTtcbn1cblxuZXhwb3J0IGVudW0gTm90ZWJvb2tGaW5kU2NvcGVUeXBlIHtcblx0Q2VsbHMgPSAnY2VsbHMnLFxuXHRUZXh0ID0gJ3RleHQnLFxuXHROb25lID0gJ25vbmUnXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rRXhjbHVzaXZlRG9jdW1lbnRGaWx0ZXIge1xuXHRpbmNsdWRlPzogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuO1xuXHRleGNsdWRlPzogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0RvY3VtZW50RmlsdGVyIHtcblx0dmlld1R5cGU/OiBzdHJpbmcgfCBzdHJpbmdbXTtcblx0ZmlsZW5hbWVQYXR0ZXJuPzogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuIHwgSU5vdGVib29rRXhjbHVzaXZlRG9jdW1lbnRGaWx0ZXI7XG59XG5cbi8vVE9ET0ByZWJvcm5peCB0ZXN0XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RvY3VtZW50RXhjbHVkZVBhdHRlcm4oZmlsZW5hbWVQYXR0ZXJuOiBzdHJpbmcgfCBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gfCBJTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudEZpbHRlcik6IGZpbGVuYW1lUGF0dGVybiBpcyB7IGluY2x1ZGU6IHN0cmluZyB8IGdsb2IuSVJlbGF0aXZlUGF0dGVybjsgZXhjbHVkZTogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuIH0ge1xuXHRjb25zdCBhcmcgPSBmaWxlbmFtZVBhdHRlcm4gYXMgSU5vdGVib29rRXhjbHVzaXZlRG9jdW1lbnRGaWx0ZXI7XG5cblx0aWYgKCh0eXBlb2YgYXJnLmluY2x1ZGUgPT09ICdzdHJpbmcnIHx8IGdsb2IuaXNSZWxhdGl2ZVBhdHRlcm4oYXJnLmluY2x1ZGUpKVxuXHRcdCYmICh0eXBlb2YgYXJnLmV4Y2x1ZGUgPT09ICdzdHJpbmcnIHx8IGdsb2IuaXNSZWxhdGl2ZVBhdHRlcm4oYXJnLmV4Y2x1ZGUpKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG5vdGVib29rRG9jdW1lbnRGaWx0ZXJNYXRjaChmaWx0ZXI6IElOb3RlYm9va0RvY3VtZW50RmlsdGVyLCB2aWV3VHlwZTogc3RyaW5nLCByZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7XG5cdGlmIChBcnJheS5pc0FycmF5KGZpbHRlci52aWV3VHlwZSkgJiYgZmlsdGVyLnZpZXdUeXBlLmluZGV4T2Yodmlld1R5cGUpID49IDApIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGlmIChmaWx0ZXIudmlld1R5cGUgPT09IHZpZXdUeXBlKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAoZmlsdGVyLmZpbGVuYW1lUGF0dGVybikge1xuXHRcdGNvbnN0IGZpbGVuYW1lUGF0dGVybiA9IGlzRG9jdW1lbnRFeGNsdWRlUGF0dGVybihmaWx0ZXIuZmlsZW5hbWVQYXR0ZXJuKSA/IGZpbHRlci5maWxlbmFtZVBhdHRlcm4uaW5jbHVkZSA6IChmaWx0ZXIuZmlsZW5hbWVQYXR0ZXJuIGFzIHN0cmluZyB8IGdsb2IuSVJlbGF0aXZlUGF0dGVybik7XG5cdFx0Y29uc3QgZXhjbHVkZUZpbGVuYW1lUGF0dGVybiA9IGlzRG9jdW1lbnRFeGNsdWRlUGF0dGVybihmaWx0ZXIuZmlsZW5hbWVQYXR0ZXJuKSA/IGZpbHRlci5maWxlbmFtZVBhdHRlcm4uZXhjbHVkZSA6IHVuZGVmaW5lZDtcblxuXHRcdGlmIChnbG9iLm1hdGNoKGZpbGVuYW1lUGF0dGVybiwgYmFzZW5hbWUocmVzb3VyY2UuZnNQYXRoKS50b0xvd2VyQ2FzZSgpKSkge1xuXHRcdFx0aWYgKGV4Y2x1ZGVGaWxlbmFtZVBhdHRlcm4pIHtcblx0XHRcdFx0aWYgKGdsb2IubWF0Y2goZXhjbHVkZUZpbGVuYW1lUGF0dGVybiwgYmFzZW5hbWUocmVzb3VyY2UuZnNQYXRoKS50b0xvd2VyQ2FzZSgpKSkge1xuXHRcdFx0XHRcdC8vIHNob3VsZCBleGNsdWRlXG5cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1Qcm92aWRlciB7XG5cdHZpZXdUeXBlOiBzdHJpbmc7XG5cdG9uRGlkQ2hhbmdlU3RhdHVzQmFySXRlbXM/OiBFdmVudDx2b2lkPjtcblx0cHJvdmlkZUNlbGxTdGF0dXNCYXJJdGVtcyh1cmk6IFVSSSwgaW5kZXg6IG51bWJlciwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbUxpc3QgfCB1bmRlZmluZWQ+O1xufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rRGlmZlJlc3VsdCB7XG5cdGNlbGxzRGlmZjogSURpZmZSZXN1bHQ7XG5cdG1ldGFkYXRhQ2hhbmdlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbSB7XG5cdHJlYWRvbmx5IGFsaWdubWVudDogQ2VsbFN0YXR1c2JhckFsaWdubWVudDtcblx0cmVhZG9ubHkgcHJpb3JpdHk/OiBudW1iZXI7XG5cdHJlYWRvbmx5IHRleHQ6IHN0cmluZztcblx0cmVhZG9ubHkgY29sb3I/OiBzdHJpbmcgfCBUaGVtZUNvbG9yO1xuXHRyZWFkb25seSBiYWNrZ3JvdW5kQ29sb3I/OiBzdHJpbmcgfCBUaGVtZUNvbG9yO1xuXHRyZWFkb25seSB0b29sdGlwPzogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nO1xuXHRyZWFkb25seSBjb21tYW5kPzogc3RyaW5nIHwgQ29tbWFuZDtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uPzogSUFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbjtcblx0cmVhZG9ubHkgb3BhY2l0eT86IHN0cmluZztcblx0cmVhZG9ubHkgb25seVNob3dXaGVuQWN0aXZlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbUxpc3Qge1xuXHRpdGVtczogSU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1bXTtcblx0ZGlzcG9zZT8oKTogdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgU2hvd0NlbGxTdGF0dXNCYXJUeXBlID0gJ2hpZGRlbicgfCAndmlzaWJsZScgfCAndmlzaWJsZUFmdGVyRXhlY3V0ZSc7XG5leHBvcnQgY29uc3QgTm90ZWJvb2tTZXR0aW5nID0ge1xuXHRkaXNwbGF5T3JkZXI6ICdub3RlYm9vay5kaXNwbGF5T3JkZXInLFxuXHRjZWxsVG9vbGJhckxvY2F0aW9uOiAnbm90ZWJvb2suY2VsbFRvb2xiYXJMb2NhdGlvbicsXG5cdGNlbGxUb29sYmFyVmlzaWJpbGl0eTogJ25vdGVib29rLmNlbGxUb29sYmFyVmlzaWJpbGl0eScsXG5cdHNob3dDZWxsU3RhdHVzQmFyOiAnbm90ZWJvb2suc2hvd0NlbGxTdGF0dXNCYXInLFxuXHRjZWxsRXhlY3V0aW9uVGltZVZlcmJvc2l0eTogJ25vdGVib29rLmNlbGxFeGVjdXRpb25UaW1lVmVyYm9zaXR5Jyxcblx0dGV4dERpZmZFZGl0b3JQcmV2aWV3OiAnbm90ZWJvb2suZGlmZi5lbmFibGVQcmV2aWV3Jyxcblx0ZGlmZk92ZXJ2aWV3UnVsZXI6ICdub3RlYm9vay5kaWZmLm92ZXJ2aWV3UnVsZXInLFxuXHRleHBlcmltZW50YWxJbnNlcnRUb29sYmFyQWxpZ25tZW50OiAnbm90ZWJvb2suZXhwZXJpbWVudGFsLmluc2VydFRvb2xiYXJBbGlnbm1lbnQnLFxuXHRjb21wYWN0VmlldzogJ25vdGVib29rLmNvbXBhY3RWaWV3Jyxcblx0Zm9jdXNJbmRpY2F0b3I6ICdub3RlYm9vay5jZWxsRm9jdXNJbmRpY2F0b3InLFxuXHRpbnNlcnRUb29sYmFyTG9jYXRpb246ICdub3RlYm9vay5pbnNlcnRUb29sYmFyTG9jYXRpb24nLFxuXHRnbG9iYWxUb29sYmFyOiAnbm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsXG5cdHN0aWNreVNjcm9sbEVuYWJsZWQ6ICdub3RlYm9vay5zdGlja3lTY3JvbGwuZW5hYmxlZCcsXG5cdHN0aWNreVNjcm9sbE1vZGU6ICdub3RlYm9vay5zdGlja3lTY3JvbGwubW9kZScsXG5cdHVuZG9SZWRvUGVyQ2VsbDogJ25vdGVib29rLnVuZG9SZWRvUGVyQ2VsbCcsXG5cdGNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbjogJ25vdGVib29rLmNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbicsXG5cdHNob3dGb2xkaW5nQ29udHJvbHM6ICdub3RlYm9vay5zaG93Rm9sZGluZ0NvbnRyb2xzJyxcblx0ZHJhZ0FuZERyb3BFbmFibGVkOiAnbm90ZWJvb2suZHJhZ0FuZERyb3BFbmFibGVkJyxcblx0Y2VsbEVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9uczogJ25vdGVib29rLmVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucycsXG5cdGNvbnNvbGlkYXRlZFJ1bkJ1dHRvbjogJ25vdGVib29rLmNvbnNvbGlkYXRlZFJ1bkJ1dHRvbicsXG5cdG9wZW5HZXR0aW5nU3RhcnRlZDogJ25vdGVib29rLmV4cGVyaW1lbnRhbC5vcGVuR2V0dGluZ1N0YXJ0ZWQnLFxuXHRnbG9iYWxUb29sYmFyU2hvd0xhYmVsOiAnbm90ZWJvb2suZ2xvYmFsVG9vbGJhclNob3dMYWJlbCcsXG5cdG1hcmt1cEZvbnRTaXplOiAnbm90ZWJvb2subWFya3VwLmZvbnRTaXplJyxcblx0bWFya2Rvd25MaW5lSGVpZ2h0OiAnbm90ZWJvb2subWFya2Rvd24ubGluZUhlaWdodCcsXG5cdGludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHM6ICdpbnRlcmFjdGl2ZVdpbmRvdy5jb2xsYXBzZUNlbGxJbnB1dENvZGUnLFxuXHRvdXRwdXRTY3JvbGxpbmdEZXByZWNhdGVkOiAnbm90ZWJvb2suZXhwZXJpbWVudGFsLm91dHB1dFNjcm9sbGluZycsXG5cdG91dHB1dFNjcm9sbGluZzogJ25vdGVib29rLm91dHB1dC5zY3JvbGxpbmcnLFxuXHR0ZXh0T3V0cHV0TGluZUxpbWl0OiAnbm90ZWJvb2sub3V0cHV0LnRleHRMaW5lTGltaXQnLFxuXHRMaW5raWZ5T3V0cHV0RmlsZVBhdGhzOiAnbm90ZWJvb2sub3V0cHV0LmxpbmtpZnlGaWxlUGF0aHMnLFxuXHRtaW5pbWFsRXJyb3JSZW5kZXJpbmc6ICdub3RlYm9vay5vdXRwdXQubWluaW1hbEVycm9yUmVuZGVyaW5nJyxcblx0Zm9ybWF0T25TYXZlOiAnbm90ZWJvb2suZm9ybWF0T25TYXZlLmVuYWJsZWQnLFxuXHRpbnNlcnRGaW5hbE5ld2xpbmU6ICdub3RlYm9vay5pbnNlcnRGaW5hbE5ld2xpbmUnLFxuXHRkZWZhdWx0Rm9ybWF0dGVyOiAnbm90ZWJvb2suZGVmYXVsdEZvcm1hdHRlcicsXG5cdGZvcm1hdE9uQ2VsbEV4ZWN1dGlvbjogJ25vdGVib29rLmZvcm1hdE9uQ2VsbEV4ZWN1dGlvbicsXG5cdGNvZGVBY3Rpb25zT25TYXZlOiAnbm90ZWJvb2suY29kZUFjdGlvbnNPblNhdmUnLFxuXHRvdXRwdXRXb3JkV3JhcDogJ25vdGVib29rLm91dHB1dC53b3JkV3JhcCcsXG5cdG91dHB1dExpbmVIZWlnaHREZXByZWNhdGVkOiAnbm90ZWJvb2sub3V0cHV0TGluZUhlaWdodCcsXG5cdG91dHB1dExpbmVIZWlnaHQ6ICdub3RlYm9vay5vdXRwdXQubGluZUhlaWdodCcsXG5cdG91dHB1dEZvbnRTaXplRGVwcmVjYXRlZDogJ25vdGVib29rLm91dHB1dEZvbnRTaXplJyxcblx0b3V0cHV0Rm9udFNpemU6ICdub3RlYm9vay5vdXRwdXQuZm9udFNpemUnLFxuXHRvdXRwdXRGb250RmFtaWx5RGVwcmVjYXRlZDogJ25vdGVib29rLm91dHB1dEZvbnRGYW1pbHknLFxuXHRvdXRwdXRGb250RmFtaWx5OiAnbm90ZWJvb2sub3V0cHV0LmZvbnRGYW1pbHknLFxuXHRmaW5kRmlsdGVyczogJ25vdGVib29rLmZpbmQuZmlsdGVycycsXG5cdGxvZ2dpbmc6ICdub3RlYm9vay5sb2dnaW5nJyxcblx0Y29uZmlybURlbGV0ZVJ1bm5pbmdDZWxsOiAnbm90ZWJvb2suY29uZmlybURlbGV0ZVJ1bm5pbmdDZWxsJyxcblx0cmVtb3RlU2F2aW5nOiAnbm90ZWJvb2suZXhwZXJpbWVudGFsLnJlbW90ZVNhdmUnLFxuXHRnb3RvU3ltYm9sc0FsbFN5bWJvbHM6ICdub3RlYm9vay5nb3RvU3ltYm9scy5zaG93QWxsU3ltYm9scycsXG5cdG91dGxpbmVTaG93TWFya2Rvd25IZWFkZXJzT25seTogJ25vdGVib29rLm91dGxpbmUuc2hvd01hcmtkb3duSGVhZGVyc09ubHknLFxuXHRvdXRsaW5lU2hvd0NvZGVDZWxsczogJ25vdGVib29rLm91dGxpbmUuc2hvd0NvZGVDZWxscycsXG5cdG91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzOiAnbm90ZWJvb2sub3V0bGluZS5zaG93Q29kZUNlbGxTeW1ib2xzJyxcblx0YnJlYWRjcnVtYnNTaG93Q29kZUNlbGxzOiAnbm90ZWJvb2suYnJlYWRjcnVtYnMuc2hvd0NvZGVDZWxscycsXG5cdHNjcm9sbFRvUmV2ZWFsQ2VsbDogJ25vdGVib29rLnNjcm9sbGluZy5yZXZlYWxOZXh0Q2VsbE9uRXhlY3V0ZScsXG5cdGNlbGxDaGF0OiAnbm90ZWJvb2suZXhwZXJpbWVudGFsLmNlbGxDaGF0Jyxcblx0Y2VsbEdlbmVyYXRlOiAnbm90ZWJvb2suZXhwZXJpbWVudGFsLmdlbmVyYXRlJyxcblx0bm90ZWJvb2tWYXJpYWJsZXNWaWV3OiAnbm90ZWJvb2sudmFyaWFibGVzVmlldycsXG5cdG5vdGVib29rSW5saW5lVmFsdWVzOiAnbm90ZWJvb2suaW5saW5lVmFsdWVzJyxcblx0SW50ZXJhY3RpdmVXaW5kb3dQcm9tcHRUb1NhdmU6ICdpbnRlcmFjdGl2ZVdpbmRvdy5wcm9tcHRUb1NhdmVPbkNsb3NlJyxcblx0Y2VsbEZhaWx1cmVEaWFnbm9zdGljczogJ25vdGVib29rLmNlbGxGYWlsdXJlRGlhZ25vc3RpY3MnLFxuXHRvdXRwdXRCYWNrdXBTaXplTGltaXQ6ICdub3RlYm9vay5iYWNrdXAuc2l6ZUxpbWl0Jyxcblx0bXVsdGlDdXJzb3I6ICdub3RlYm9vay5tdWx0aUN1cnNvci5lbmFibGVkJyxcblx0bWFya3VwRm9udEZhbWlseTogJ25vdGVib29rLm1hcmt1cC5mb250RmFtaWx5Jyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCBlbnVtIENlbGxTdGF0dXNiYXJBbGlnbm1lbnQge1xuXHRMZWZ0ID0gMSxcblx0UmlnaHQgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1dvcmtpbmdDb3B5VHlwZUlkZW50aWZpZXIge1xuXG5cdHByaXZhdGUgc3RhdGljIF9wcmVmaXggPSAnbm90ZWJvb2svJztcblxuXHRzdGF0aWMgY3JlYXRlKG5vdGVib29rVHlwZTogc3RyaW5nLCB2aWV3VHlwZT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAke05vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5fcHJlZml4fSR7bm90ZWJvb2tUeXBlfS8ke3ZpZXdUeXBlID8/IG5vdGVib29rVHlwZX1gO1xuXHR9XG5cblx0c3RhdGljIHBhcnNlKGNhbmRpZGF0ZTogc3RyaW5nKTogeyBub3RlYm9va1R5cGU6IHN0cmluZzsgdmlld1R5cGU6IHN0cmluZyB9IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoY2FuZGlkYXRlLnN0YXJ0c1dpdGgoTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyLl9wcmVmaXgpKSB7XG5cdFx0XHRjb25zdCBzcGxpdCA9IGNhbmRpZGF0ZS5zdWJzdHJpbmcoTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyLl9wcmVmaXgubGVuZ3RoKS5zcGxpdCgnLycpO1xuXHRcdFx0aWYgKHNwbGl0Lmxlbmd0aCA9PT0gMikge1xuXHRcdFx0XHRyZXR1cm4geyBub3RlYm9va1R5cGU6IHNwbGl0WzBdLCB2aWV3VHlwZTogc3BsaXRbMV0gfTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rRXh0ZW5zaW9uRGVzY3JpcHRpb24ge1xuXHRyZWFkb25seSBpZDogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblx0cmVhZG9ubHkgbG9jYXRpb246IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogV2hldGhlciB0aGUgcHJvdmlkZWQgbWltZSB0eXBlIGlzIGEgdGV4dCBzdHJlYW0gbGlrZSBgc3Rkb3V0YCwgYHN0ZGVycmAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1RleHRTdHJlYW1NaW1lKG1pbWVUeXBlOiBzdHJpbmcpIHtcblx0cmV0dXJuIFsnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVyciddLmluY2x1ZGVzKG1pbWVUeXBlKTtcbn1cblxuXG5jb25zdCB0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXG4vKipcbiAqIEdpdmVuIGEgc3RyZWFtIG9mIGluZGl2aWR1YWwgc3Rkb3V0IG91dHB1dHMsIHRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIGNvbXByZXNzZWQgbGluZXMsIGVzY2FwaW5nIHNvbWUgb2YgdGhlIGNvbW1vbiB0ZXJtaW5hbCBlc2NhcGUgY29kZXMuXG4gKiBFLmcuIHNvbWUgdGVybWluYWwgZXNjYXBlIGNvZGVzIHdvdWxkIHJlc3VsdCBpbiB0aGUgcHJldmlvdXMgbGluZSBnZXR0aW5nIGNsZWFyZWQsIHN1Y2ggaWYgd2UgaGFkIDMgbGluZXMgYW5kXG4gKiBsYXN0IGxpbmUgY29udGFpbmVkIHN1Y2ggYSBjb2RlLCB0aGVuIHRoZSByZXN1bHQgc3RyaW5nIHdvdWxkIGJlIGp1c3QgdGhlIGZpcnN0IHR3byBsaW5lcy5cbiAqIEByZXR1cm5zIGEgc2luZ2xlIFZTQnVmZmVyIHdpdGggdGhlIGNvbmNhdGVuYXRlZCBhbmQgY29tcHJlc3NlZCBkYXRhLCBhbmQgd2hldGhlciBhbnkgY29tcHJlc3Npb24gd2FzIGRvbmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wcmVzc091dHB1dEl0ZW1TdHJlYW1zKG91dHB1dHM6IFVpbnQ4QXJyYXlbXSkge1xuXHRjb25zdCBidWZmZXJzOiBVaW50OEFycmF5W10gPSBbXTtcblx0bGV0IHN0YXJ0QXBwZW5kaW5nID0gZmFsc2U7XG5cblx0Ly8gUGljayB0aGUgZmlyc3Qgc2V0IG9mIG91dHB1dHMgd2l0aCB0aGUgc2FtZSBtaW1lIHR5cGUuXG5cdGZvciAoY29uc3Qgb3V0cHV0IG9mIG91dHB1dHMpIHtcblx0XHRpZiAoKGJ1ZmZlcnMubGVuZ3RoID09PSAwIHx8IHN0YXJ0QXBwZW5kaW5nKSkge1xuXHRcdFx0YnVmZmVycy5wdXNoKG91dHB1dCk7XG5cdFx0XHRzdGFydEFwcGVuZGluZyA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGRpZENvbXByZXNzaW9uID0gY29tcHJlc3NTdHJlYW1CdWZmZXIoYnVmZmVycyk7XG5cdGNvbnN0IGNvbmNhdGVuYXRlZCA9IFZTQnVmZmVyLmNvbmNhdChidWZmZXJzLm1hcChidWZmZXIgPT4gVlNCdWZmZXIud3JhcChidWZmZXIpKSk7XG5cdGNvbnN0IGRhdGEgPSBmb3JtYXRTdHJlYW1UZXh0KGNvbmNhdGVuYXRlZCk7XG5cdGRpZENvbXByZXNzaW9uID0gZGlkQ29tcHJlc3Npb24gfHwgZGF0YS5ieXRlTGVuZ3RoICE9PSBjb25jYXRlbmF0ZWQuYnl0ZUxlbmd0aDtcblx0cmV0dXJuIHsgZGF0YSwgZGlkQ29tcHJlc3Npb24gfTtcbn1cblxuZXhwb3J0IGNvbnN0IE1PVkVfQ1VSU09SXzFfTElORV9DT01NQU5EID0gYCR7U3RyaW5nLmZyb21DaGFyQ29kZSgyNyl9W0FgO1xuY29uc3QgTU9WRV9DVVJTT1JfMV9MSU5FX0NPTU1BTkRfQllURVMgPSBNT1ZFX0NVUlNPUl8xX0xJTkVfQ09NTUFORC5zcGxpdCgnJykubWFwKGMgPT4gYy5jaGFyQ29kZUF0KDApKTtcbmNvbnN0IExJTkVfRkVFRCA9IDEwO1xuZnVuY3Rpb24gY29tcHJlc3NTdHJlYW1CdWZmZXIoc3RyZWFtczogVWludDhBcnJheVtdKSB7XG5cdGxldCBkaWRDb21wcmVzcyA9IGZhbHNlO1xuXHRzdHJlYW1zLmZvckVhY2goKHN0cmVhbSwgaW5kZXgpID0+IHtcblx0XHRpZiAoaW5kZXggPT09IDAgfHwgc3RyZWFtLmxlbmd0aCA8IE1PVkVfQ1VSU09SXzFfTElORV9DT01NQU5ELmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzU3RyZWFtID0gc3RyZWFtc1tpbmRleCAtIDFdO1xuXG5cdFx0Ly8gUmVtb3ZlIHRoZSBwcmV2aW91cyBsaW5lIGlmIHJlcXVpcmVkLlxuXHRcdGNvbnN0IGNvbW1hbmQgPSBzdHJlYW0uc3ViYXJyYXkoMCwgTU9WRV9DVVJTT1JfMV9MSU5FX0NPTU1BTkQubGVuZ3RoKTtcblx0XHRpZiAoY29tbWFuZFswXSA9PT0gTU9WRV9DVVJTT1JfMV9MSU5FX0NPTU1BTkRfQllURVNbMF0gJiYgY29tbWFuZFsxXSA9PT0gTU9WRV9DVVJTT1JfMV9MSU5FX0NPTU1BTkRfQllURVNbMV0gJiYgY29tbWFuZFsyXSA9PT0gTU9WRV9DVVJTT1JfMV9MSU5FX0NPTU1BTkRfQllURVNbMl0pIHtcblx0XHRcdGNvbnN0IGxhc3RJbmRleE9mTGluZUZlZWQgPSBwcmV2aW91c1N0cmVhbS5sYXN0SW5kZXhPZihMSU5FX0ZFRUQpO1xuXHRcdFx0aWYgKGxhc3RJbmRleE9mTGluZUZlZWQgPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZGlkQ29tcHJlc3MgPSB0cnVlO1xuXHRcdFx0c3RyZWFtc1tpbmRleCAtIDFdID0gcHJldmlvdXNTdHJlYW0uc3ViYXJyYXkoMCwgbGFzdEluZGV4T2ZMaW5lRmVlZCk7XG5cdFx0XHRzdHJlYW1zW2luZGV4XSA9IHN0cmVhbS5zdWJhcnJheShNT1ZFX0NVUlNPUl8xX0xJTkVfQ09NTUFORC5sZW5ndGgpO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBkaWRDb21wcmVzcztcbn1cblxuXG5cbi8qKlxuICogVG9vayB0aGlzIGZyb20ganVweXRlci9ub3RlYm9va1xuICogaHR0cHM6Ly9naXRodWIuY29tL2p1cHl0ZXIvbm90ZWJvb2svYmxvYi9iOGI2NjMzMmUyMDIzZTgzZDJlZTA0ZjgzZDg4MTRmNTY3ZTAxYTRlL25vdGVib29rL3N0YXRpYy9iYXNlL2pzL3V0aWxzLmpzXG4gKiBSZW1vdmUgY2hhcmFjdGVycyB0aGF0IGFyZSBvdmVycmlkZGVuIGJ5IGJhY2tzcGFjZSBjaGFyYWN0ZXJzXG4gKi9cbmZ1bmN0aW9uIGZpeEJhY2tzcGFjZSh0eHQ6IHN0cmluZykge1xuXHRsZXQgdG1wID0gdHh0O1xuXHRkbyB7XG5cdFx0dHh0ID0gdG1wO1xuXHRcdC8vIENhbmNlbCBvdXQgYW55dGhpbmctYnV0LW5ld2xpbmUgZm9sbG93ZWQgYnkgYmFja3NwYWNlXG5cdFx0dG1wID0gdHh0LnJlcGxhY2UoL1teXFxuXVxceDA4L2dtLCAnJyk7XG5cdH0gd2hpbGUgKHRtcC5sZW5ndGggPCB0eHQubGVuZ3RoKTtcblx0cmV0dXJuIHR4dDtcbn1cblxuLyoqXG4gKiBSZW1vdmUgY2h1bmtzIHRoYXQgc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgdGhlIGVmZmVjdCBvZiBjYXJyaWFnZSByZXR1cm4gY2hhcmFjdGVyc1xuICogRnJvbSBodHRwczovL2dpdGh1Yi5jb20vanVweXRlci9ub3RlYm9vay9ibG9iL21hc3Rlci9ub3RlYm9vay9zdGF0aWMvYmFzZS9qcy91dGlscy5qc1xuICovXG5mdW5jdGlvbiBmaXhDYXJyaWFnZVJldHVybih0eHQ6IHN0cmluZykge1xuXHR0eHQgPSB0eHQucmVwbGFjZSgvXFxyK1xcbi9nbSwgJ1xcbicpOyAvLyBcXHIgZm9sbG93ZWQgYnkgXFxuIC0tPiBuZXdsaW5lXG5cdHdoaWxlICh0eHQuc2VhcmNoKC9cXHJbXiRdL2cpID4gLTEpIHtcblx0XHRjb25zdCBiYXNlID0gdHh0Lm1hdGNoKC9eKC4qKVxccisvbSkhWzFdO1xuXHRcdGxldCBpbnNlcnQgPSB0eHQubWF0Y2goL1xccisoLiopJC9tKSFbMV07XG5cdFx0aW5zZXJ0ID0gaW5zZXJ0ICsgYmFzZS5zbGljZShpbnNlcnQubGVuZ3RoLCBiYXNlLmxlbmd0aCk7XG5cdFx0dHh0ID0gdHh0LnJlcGxhY2UoL1xccisuKiQvbSwgJ1xccicpLnJlcGxhY2UoL14uKlxcci9tLCBpbnNlcnQpO1xuXHR9XG5cdHJldHVybiB0eHQ7XG59XG5cbmNvbnN0IEJBQ0tTUEFDRV9DSEFSQUNURVIgPSAnXFxiJy5jaGFyQ29kZUF0KDApO1xuY29uc3QgQ0FSUklBR0VfUkVUVVJOX0NIQVJBQ1RFUiA9ICdcXHInLmNoYXJDb2RlQXQoMCk7XG5mdW5jdGlvbiBmb3JtYXRTdHJlYW1UZXh0KGJ1ZmZlcjogVlNCdWZmZXIpOiBWU0J1ZmZlciB7XG5cdC8vIFdlIGhhdmUgc3BlY2lhbCBoYW5kbGluZyBmb3IgYmFja3NwYWNlIGFuZCBjYXJyaWFnZSByZXR1cm4gY2hhcmFjdGVycy5cblx0Ly8gRG9uJ3QgdW5uZWNlc3NhcnkgZGVjb2RlIHRoZSBieXRlcyBpZiB3ZSBkb24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IHByb2Nlc3NpbmcuXG5cdGlmICghYnVmZmVyLmJ1ZmZlci5pbmNsdWRlcyhCQUNLU1BBQ0VfQ0hBUkFDVEVSKSAmJiAhYnVmZmVyLmJ1ZmZlci5pbmNsdWRlcyhDQVJSSUFHRV9SRVRVUk5fQ0hBUkFDVEVSKSkge1xuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblx0Ly8gRG8gdGhlIHNhbWUgdGhpbmcganVweXRlciBpcyBkb2luZ1xuXHRyZXR1cm4gVlNCdWZmZXIuZnJvbVN0cmluZyhmaXhDYXJyaWFnZVJldHVybihmaXhCYWNrc3BhY2UodGV4dERlY29kZXIuZGVjb2RlKGJ1ZmZlci5idWZmZXIpKSkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbiB7XG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBkZXRhaWw/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNvbW1hbmQ/OiBzdHJpbmcgfCBDb21tYW5kO1xuXHRyZWFkb25seSBkb2N1bWVudGF0aW9uPzogVXJpQ29tcG9uZW50cyB8IHN0cmluZztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBSXpCLFlBQVksVUFBVTtBQUV0QixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBUzFCLFNBQVMscUJBQXFCO0FBVTlCLFNBQVMscUJBQXFCLFlBQVksYUFBYSwwQkFBMEIsa0JBQWtCLFNBQVMsZ0JBQWdCO0FBSXJILE1BQU0scUJBQXFCO0FBQzNCLE1BQU0sMEJBQTBCO0FBQ2hDLE1BQU0sZ0NBQWdDO0FBQ3RDLE1BQU0sK0JB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QSxFQUM1RDtBQUNBLFNBQU87QUFDUjtBQUVBLE1BQU0sc0JBQXNCLEtBQUssV0FBVyxDQUFDO0FBQzdDLE1BQU0sNEJBQTRCLEtBQUssV0FBVyxDQUFDO0FBQ25ELFNBQVMsaUJBQWlCLFFBQTRCO0FBR3JELE1BQUksQ0FBQyxPQUFPLE9BQU8sU0FBUyxtQkFBbUIsS0FBSyxDQUFDLE9BQU8sT0FBTyxTQUFTLHlCQUF5QixHQUFHO0FBQ3ZHLFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTyxTQUFTLFdBQVcsa0JBQWtCLGFBQWEsWUFBWSxPQUFPLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQztBQUM5RjsiLAogICJuYW1lcyI6IFsiQ2VsbEtpbmQiLCAiTm90ZWJvb2tSdW5TdGF0ZSIsICJOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSIsICJOb3RlYm9va0V4ZWN1dGlvblN0YXRlIiwgIk5vdGVib29rUmVuZGVyZXJNYXRjaCIsICJSZW5kZXJlck1lc3NhZ2luZ1NwZWMiLCAiTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUiLCAiU2VsZWN0aW9uU3RhdGVUeXBlIiwgIkNlbGxFZGl0VHlwZSIsICJOb3RlYm9va01ldGFkYXRhVXJpIiwgIkNlbGxVcmkiLCAic2NoZW1lIiwgIk5vdGVib29rRWRpdG9yUHJpb3JpdHkiLCAiTm90ZWJvb2tGaW5kU2NvcGVUeXBlIiwgIkNlbGxTdGF0dXNiYXJBbGlnbm1lbnQiXQp9Cg==
