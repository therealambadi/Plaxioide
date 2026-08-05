var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _callOnDispose, _delegate, _items, _DataTransfer_instances, normalizeMime_fn;
import { asArray, coalesceInPlace, equals } from "../../../base/common/arrays.js";
import { illegalArgument } from "../../../base/common/errors.js";
import { MarkdownString as BaseMarkdownString } from "../../../base/common/htmlContent.js";
import { ResourceMap } from "../../../base/common/map.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { Mimes, normalizeMimeType } from "../../../base/common/mime.js";
import { nextCharLength } from "../../../base/common/strings.js";
import { isNumber, isObject, isString, isStringArray } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { TextEditorSelectionSource } from "../../../platform/editor/common/editor.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { FileSystemProviderErrorCode, markAsFileSystemProviderError } from "../../../platform/files/common/files.js";
import { RemoteAuthorityResolverErrorCode } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { CellEditType, isTextStreamMime } from "../../contrib/notebook/common/notebookCommon.js";
function es5ClassCompat(target) {
  const interceptFunctions = {
    apply: function(...args) {
      if (args.length === 0) {
        return Reflect.construct(target, []);
      } else {
        const argsList = args.length === 1 ? [] : args[1];
        return Reflect.construct(target, argsList, args[0].constructor);
      }
    },
    call: function(...args) {
      if (args.length === 0) {
        return Reflect.construct(target, []);
      } else {
        const [thisArg, ...restArgs] = args;
        return Reflect.construct(target, restArgs, thisArg.constructor);
      }
    }
  };
  return Object.assign(target, interceptFunctions);
}
var TerminalOutputAnchor = /* @__PURE__ */ ((TerminalOutputAnchor2) => {
  TerminalOutputAnchor2[TerminalOutputAnchor2["Top"] = 0] = "Top";
  TerminalOutputAnchor2[TerminalOutputAnchor2["Bottom"] = 1] = "Bottom";
  return TerminalOutputAnchor2;
})(TerminalOutputAnchor || {});
var TerminalQuickFixType = /* @__PURE__ */ ((TerminalQuickFixType2) => {
  TerminalQuickFixType2[TerminalQuickFixType2["TerminalCommand"] = 0] = "TerminalCommand";
  TerminalQuickFixType2[TerminalQuickFixType2["Opener"] = 1] = "Opener";
  TerminalQuickFixType2[TerminalQuickFixType2["Command"] = 3] = "Command";
  return TerminalQuickFixType2;
})(TerminalQuickFixType || {});
let Disposable = class {
  constructor(callOnDispose) {
    __privateAdd(this, _callOnDispose);
    __privateSet(this, _callOnDispose, callOnDispose);
  }
  static from(...inDisposables) {
    let disposables = inDisposables;
    return new Disposable(function() {
      if (disposables) {
        for (const disposable of disposables) {
          if (disposable && typeof disposable.dispose === "function") {
            disposable.dispose();
          }
        }
        disposables = void 0;
      }
    });
  }
  dispose() {
    if (typeof __privateGet(this, _callOnDispose) === "function") {
      __privateGet(this, _callOnDispose).call(this);
      __privateSet(this, _callOnDispose, void 0);
    }
  }
};
_callOnDispose = new WeakMap();
Disposable = __decorateClass([
  es5ClassCompat
], Disposable);
let Position = class {
  static Min(...positions) {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (p.isBefore(result)) {
        result = p;
      }
    }
    return result;
  }
  static Max(...positions) {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (p.isAfter(result)) {
        result = p;
      }
    }
    return result;
  }
  static isPosition(other) {
    if (!other) {
      return false;
    }
    if (other instanceof Position) {
      return true;
    }
    const { line, character } = other;
    if (typeof line === "number" && typeof character === "number") {
      return true;
    }
    return false;
  }
  static of(obj) {
    if (obj instanceof Position) {
      return obj;
    } else if (this.isPosition(obj)) {
      return new Position(obj.line, obj.character);
    }
    throw new Error("Invalid argument, is NOT a position-like object");
  }
  get line() {
    return this._line;
  }
  get character() {
    return this._character;
  }
  constructor(line, character) {
    if (line < 0) {
      throw illegalArgument("line must be non-negative");
    }
    if (character < 0) {
      throw illegalArgument("character must be non-negative");
    }
    this._line = line;
    this._character = character;
  }
  isBefore(other) {
    if (this._line < other._line) {
      return true;
    }
    if (other._line < this._line) {
      return false;
    }
    return this._character < other._character;
  }
  isBeforeOrEqual(other) {
    if (this._line < other._line) {
      return true;
    }
    if (other._line < this._line) {
      return false;
    }
    return this._character <= other._character;
  }
  isAfter(other) {
    return !this.isBeforeOrEqual(other);
  }
  isAfterOrEqual(other) {
    return !this.isBefore(other);
  }
  isEqual(other) {
    return this._line === other._line && this._character === other._character;
  }
  compareTo(other) {
    if (this._line < other._line) {
      return -1;
    } else if (this._line > other.line) {
      return 1;
    } else {
      if (this._character < other._character) {
        return -1;
      } else if (this._character > other._character) {
        return 1;
      } else {
        return 0;
      }
    }
  }
  translate(lineDeltaOrChange, characterDelta = 0) {
    if (lineDeltaOrChange === null || characterDelta === null) {
      throw illegalArgument();
    }
    let lineDelta;
    if (typeof lineDeltaOrChange === "undefined") {
      lineDelta = 0;
    } else if (typeof lineDeltaOrChange === "number") {
      lineDelta = lineDeltaOrChange;
    } else {
      lineDelta = typeof lineDeltaOrChange.lineDelta === "number" ? lineDeltaOrChange.lineDelta : 0;
      characterDelta = typeof lineDeltaOrChange.characterDelta === "number" ? lineDeltaOrChange.characterDelta : 0;
    }
    if (lineDelta === 0 && characterDelta === 0) {
      return this;
    }
    return new Position(this.line + lineDelta, this.character + characterDelta);
  }
  with(lineOrChange, character = this.character) {
    if (lineOrChange === null || character === null) {
      throw illegalArgument();
    }
    let line;
    if (typeof lineOrChange === "undefined") {
      line = this.line;
    } else if (typeof lineOrChange === "number") {
      line = lineOrChange;
    } else {
      line = typeof lineOrChange.line === "number" ? lineOrChange.line : this.line;
      character = typeof lineOrChange.character === "number" ? lineOrChange.character : this.character;
    }
    if (line === this.line && character === this.character) {
      return this;
    }
    return new Position(line, character);
  }
  toJSON() {
    return { line: this.line, character: this.character };
  }
  [Symbol.for("debug.description")]() {
    return `(${this.line}:${this.character})`;
  }
};
Position = __decorateClass([
  es5ClassCompat
], Position);
let Range = class {
  static isRange(thing) {
    if (thing instanceof Range) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Position.isPosition(thing.start) && Position.isPosition(thing.end);
  }
  static of(obj) {
    if (obj instanceof Range) {
      return obj;
    }
    if (this.isRange(obj)) {
      return new Range(obj.start, obj.end);
    }
    throw new Error("Invalid argument, is NOT a range-like object");
  }
  get start() {
    return this._start;
  }
  get end() {
    return this._end;
  }
  constructor(startLineOrStart, startColumnOrEnd, endLine, endColumn) {
    let start;
    let end;
    if (typeof startLineOrStart === "number" && typeof startColumnOrEnd === "number" && typeof endLine === "number" && typeof endColumn === "number") {
      start = new Position(startLineOrStart, startColumnOrEnd);
      end = new Position(endLine, endColumn);
    } else if (Position.isPosition(startLineOrStart) && Position.isPosition(startColumnOrEnd)) {
      start = Position.of(startLineOrStart);
      end = Position.of(startColumnOrEnd);
    }
    if (!start || !end) {
      throw new Error("Invalid arguments");
    }
    if (start.isBefore(end)) {
      this._start = start;
      this._end = end;
    } else {
      this._start = end;
      this._end = start;
    }
  }
  contains(positionOrRange) {
    if (Range.isRange(positionOrRange)) {
      return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    } else if (Position.isPosition(positionOrRange)) {
      if (Position.of(positionOrRange).isBefore(this._start)) {
        return false;
      }
      if (this._end.isBefore(positionOrRange)) {
        return false;
      }
      return true;
    }
    return false;
  }
  isEqual(other) {
    return this._start.isEqual(other._start) && this._end.isEqual(other._end);
  }
  intersection(other) {
    const start = Position.Max(other.start, this._start);
    const end = Position.Min(other.end, this._end);
    if (start.isAfter(end)) {
      return void 0;
    }
    return new Range(start, end);
  }
  union(other) {
    if (this.contains(other)) {
      return this;
    } else if (other.contains(this)) {
      return other;
    }
    const start = Position.Min(other.start, this._start);
    const end = Position.Max(other.end, this.end);
    return new Range(start, end);
  }
  get isEmpty() {
    return this._start.isEqual(this._end);
  }
  get isSingleLine() {
    return this._start.line === this._end.line;
  }
  with(startOrChange, end = this.end) {
    if (startOrChange === null || end === null) {
      throw illegalArgument();
    }
    let start;
    if (!startOrChange) {
      start = this.start;
    } else if (Position.isPosition(startOrChange)) {
      start = startOrChange;
    } else {
      start = startOrChange.start || this.start;
      end = startOrChange.end || this.end;
    }
    if (start.isEqual(this._start) && end.isEqual(this.end)) {
      return this;
    }
    return new Range(start, end);
  }
  toJSON() {
    return [this.start, this.end];
  }
  [Symbol.for("debug.description")]() {
    return getDebugDescriptionOfRange(this);
  }
};
Range = __decorateClass([
  es5ClassCompat
], Range);
let Selection = class extends Range {
  static isSelection(thing) {
    if (thing instanceof Selection) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange(thing) && Position.isPosition(thing.anchor) && Position.isPosition(thing.active) && typeof thing.isReversed === "boolean";
  }
  get anchor() {
    return this._anchor;
  }
  get active() {
    return this._active;
  }
  constructor(anchorLineOrAnchor, anchorColumnOrActive, activeLine, activeColumn) {
    let anchor;
    let active;
    if (typeof anchorLineOrAnchor === "number" && typeof anchorColumnOrActive === "number" && typeof activeLine === "number" && typeof activeColumn === "number") {
      anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
      active = new Position(activeLine, activeColumn);
    } else if (Position.isPosition(anchorLineOrAnchor) && Position.isPosition(anchorColumnOrActive)) {
      anchor = Position.of(anchorLineOrAnchor);
      active = Position.of(anchorColumnOrActive);
    }
    if (!anchor || !active) {
      throw new Error("Invalid arguments");
    }
    super(anchor, active);
    this._anchor = anchor;
    this._active = active;
  }
  get isReversed() {
    return this._anchor === this._end;
  }
  toJSON() {
    return {
      start: this.start,
      end: this.end,
      active: this.active,
      anchor: this.anchor
    };
  }
  [Symbol.for("debug.description")]() {
    return getDebugDescriptionOfSelection(this);
  }
};
Selection = __decorateClass([
  es5ClassCompat
], Selection);
function getDebugDescriptionOfRange(range) {
  return range.isEmpty ? `[${range.start.line}:${range.start.character})` : `[${range.start.line}:${range.start.character} -> ${range.end.line}:${range.end.character})`;
}
function getDebugDescriptionOfSelection(selection) {
  let rangeStr = getDebugDescriptionOfRange(selection);
  if (!selection.isEmpty) {
    if (selection.active.isEqual(selection.start)) {
      rangeStr = `|${rangeStr}`;
    } else {
      rangeStr = `${rangeStr}|`;
    }
  }
  return rangeStr;
}
const validateConnectionToken = (connectionToken) => {
  if (typeof connectionToken !== "string" || connectionToken.length === 0 || !/^[0-9A-Za-z_\-]+$/.test(connectionToken)) {
    throw illegalArgument("connectionToken");
  }
};
class ResolvedAuthority {
  static isResolvedAuthority(resolvedAuthority) {
    return resolvedAuthority && typeof resolvedAuthority === "object" && typeof resolvedAuthority.host === "string" && typeof resolvedAuthority.port === "number" && (resolvedAuthority.connectionToken === void 0 || typeof resolvedAuthority.connectionToken === "string");
  }
  constructor(host, port, connectionToken) {
    if (typeof host !== "string" || host.length === 0) {
      throw illegalArgument("host");
    }
    if (typeof port !== "number" || port === 0 || Math.round(port) !== port) {
      throw illegalArgument("port");
    }
    if (typeof connectionToken !== "undefined") {
      validateConnectionToken(connectionToken);
    }
    this.host = host;
    this.port = Math.round(port);
    this.connectionToken = connectionToken;
  }
}
class ManagedResolvedAuthority {
  constructor(makeConnection, connectionToken) {
    this.makeConnection = makeConnection;
    this.connectionToken = connectionToken;
    if (typeof connectionToken !== "undefined") {
      validateConnectionToken(connectionToken);
    }
  }
  static isManagedResolvedAuthority(resolvedAuthority) {
    return resolvedAuthority && typeof resolvedAuthority === "object" && typeof resolvedAuthority.makeConnection === "function" && (resolvedAuthority.connectionToken === void 0 || typeof resolvedAuthority.connectionToken === "string");
  }
}
class RemoteAuthorityResolverError extends Error {
  static NotAvailable(message, handled) {
    return new RemoteAuthorityResolverError(message, RemoteAuthorityResolverErrorCode.NotAvailable, handled);
  }
  static TemporarilyNotAvailable(message) {
    return new RemoteAuthorityResolverError(message, RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable);
  }
  constructor(message, code = RemoteAuthorityResolverErrorCode.Unknown, detail) {
    super(message);
    this._message = message;
    this._code = code;
    this._detail = detail;
    Object.setPrototypeOf(this, RemoteAuthorityResolverError.prototype);
  }
}
var EndOfLine = /* @__PURE__ */ ((EndOfLine2) => {
  EndOfLine2[EndOfLine2["LF"] = 1] = "LF";
  EndOfLine2[EndOfLine2["CRLF"] = 2] = "CRLF";
  return EndOfLine2;
})(EndOfLine || {});
var EnvironmentVariableMutatorType = /* @__PURE__ */ ((EnvironmentVariableMutatorType2) => {
  EnvironmentVariableMutatorType2[EnvironmentVariableMutatorType2["Replace"] = 1] = "Replace";
  EnvironmentVariableMutatorType2[EnvironmentVariableMutatorType2["Append"] = 2] = "Append";
  EnvironmentVariableMutatorType2[EnvironmentVariableMutatorType2["Prepend"] = 3] = "Prepend";
  return EnvironmentVariableMutatorType2;
})(EnvironmentVariableMutatorType || {});
let TextEdit = class {
  static isTextEdit(thing) {
    if (thing instanceof TextEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange(thing) && typeof thing.newText === "string";
  }
  static replace(range, newText) {
    return new TextEdit(range, newText);
  }
  static insert(position, newText) {
    return TextEdit.replace(new Range(position, position), newText);
  }
  static delete(range) {
    return TextEdit.replace(range, "");
  }
  static setEndOfLine(eol) {
    const ret = new TextEdit(new Range(new Position(0, 0), new Position(0, 0)), "");
    ret.newEol = eol;
    return ret;
  }
  get range() {
    return this._range;
  }
  set range(value) {
    if (value && !Range.isRange(value)) {
      throw illegalArgument("range");
    }
    this._range = value;
  }
  get newText() {
    return this._newText || "";
  }
  set newText(value) {
    if (value && typeof value !== "string") {
      throw illegalArgument("newText");
    }
    this._newText = value;
  }
  get newEol() {
    return this._newEol;
  }
  set newEol(value) {
    if (value && typeof value !== "number") {
      throw illegalArgument("newEol");
    }
    this._newEol = value;
  }
  constructor(range, newText) {
    this._range = range;
    this._newText = newText;
  }
  toJSON() {
    return {
      range: this.range,
      newText: this.newText,
      newEol: this._newEol
    };
  }
};
TextEdit = __decorateClass([
  es5ClassCompat
], TextEdit);
let NotebookEdit = class {
  static isNotebookCellEdit(thing) {
    if (thing instanceof NotebookEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return NotebookRange.isNotebookRange(thing) && Array.isArray(thing.newCells);
  }
  static replaceCells(range, newCells) {
    return new NotebookEdit(range, newCells);
  }
  static insertCells(index, newCells) {
    return new NotebookEdit(new NotebookRange(index, index), newCells);
  }
  static deleteCells(range) {
    return new NotebookEdit(range, []);
  }
  static updateCellMetadata(index, newMetadata) {
    const edit = new NotebookEdit(new NotebookRange(index, index), []);
    edit.newCellMetadata = newMetadata;
    return edit;
  }
  static updateNotebookMetadata(newMetadata) {
    const edit = new NotebookEdit(new NotebookRange(0, 0), []);
    edit.newNotebookMetadata = newMetadata;
    return edit;
  }
  constructor(range, newCells) {
    this.range = range;
    this.newCells = newCells;
  }
};
NotebookEdit = __decorateClass([
  es5ClassCompat
], NotebookEdit);
class SnippetTextEdit {
  static isSnippetTextEdit(thing) {
    if (thing instanceof SnippetTextEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange(thing.range) && SnippetString.isSnippetString(thing.snippet);
  }
  static replace(range, snippet) {
    return new SnippetTextEdit(range, snippet);
  }
  static insert(position, snippet) {
    return SnippetTextEdit.replace(new Range(position, position), snippet);
  }
  constructor(range, snippet) {
    this.range = range;
    this.snippet = snippet;
  }
}
var FileEditType = /* @__PURE__ */ ((FileEditType2) => {
  FileEditType2[FileEditType2["File"] = 1] = "File";
  FileEditType2[FileEditType2["Text"] = 2] = "Text";
  FileEditType2[FileEditType2["Cell"] = 3] = "Cell";
  FileEditType2[FileEditType2["CellReplace"] = 5] = "CellReplace";
  FileEditType2[FileEditType2["Snippet"] = 6] = "Snippet";
  return FileEditType2;
})(FileEditType || {});
let WorkspaceEdit = class {
  constructor() {
    this._edits = [];
  }
  _allEntries() {
    return this._edits;
  }
  // --- file
  renameFile(from, to, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from, to, options, metadata });
  }
  createFile(uri, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from: void 0, to: uri, options, metadata });
  }
  deleteFile(uri, options, metadata) {
    this._edits.push({ _type: 1 /* File */, from: uri, to: void 0, options, metadata });
  }
  // --- notebook
  replaceNotebookMetadata(uri, value, metadata) {
    this._edits.push({ _type: 3 /* Cell */, metadata, uri, edit: { editType: CellEditType.DocumentMetadata, metadata: value } });
  }
  replaceNotebookCells(uri, startOrRange, cellData, metadata) {
    const start = startOrRange.start;
    const end = startOrRange.end;
    if (start !== end || cellData.length > 0) {
      this._edits.push({ _type: 5 /* CellReplace */, uri, index: start, count: end - start, cells: cellData, metadata });
    }
  }
  replaceNotebookCellMetadata(uri, index, cellMetadata, metadata) {
    this._edits.push({ _type: 3 /* Cell */, metadata, uri, edit: { editType: CellEditType.Metadata, index, metadata: cellMetadata } });
  }
  // --- text
  replace(uri, range, newText, metadata) {
    this._edits.push({ _type: 2 /* Text */, uri, edit: new TextEdit(range, newText), metadata });
  }
  insert(resource, position, newText, metadata) {
    this.replace(resource, new Range(position, position), newText, metadata);
  }
  delete(resource, range, metadata) {
    this.replace(resource, range, "", metadata);
  }
  // --- text (Maplike)
  has(uri) {
    return this._edits.some((edit) => edit._type === 2 /* Text */ && edit.uri.toString() === uri.toString());
  }
  set(uri, edits) {
    if (!edits) {
      for (let i = 0; i < this._edits.length; i++) {
        const element = this._edits[i];
        switch (element._type) {
          case 2 /* Text */:
          case 6 /* Snippet */:
          case 3 /* Cell */:
          case 5 /* CellReplace */:
            if (element.uri.toString() === uri.toString()) {
              this._edits[i] = void 0;
            }
            break;
        }
      }
      coalesceInPlace(this._edits);
    } else {
      for (const editOrTuple of edits) {
        if (!editOrTuple) {
          continue;
        }
        let edit;
        let metadata;
        if (Array.isArray(editOrTuple)) {
          edit = editOrTuple[0];
          metadata = editOrTuple[1];
        } else {
          edit = editOrTuple;
        }
        if (NotebookEdit.isNotebookCellEdit(edit)) {
          if (edit.newCellMetadata) {
            this.replaceNotebookCellMetadata(uri, edit.range.start, edit.newCellMetadata, metadata);
          } else if (edit.newNotebookMetadata) {
            this.replaceNotebookMetadata(uri, edit.newNotebookMetadata, metadata);
          } else {
            this.replaceNotebookCells(uri, edit.range, edit.newCells, metadata);
          }
        } else if (SnippetTextEdit.isSnippetTextEdit(edit)) {
          this._edits.push({ _type: 6 /* Snippet */, uri, range: edit.range, edit: edit.snippet, metadata, keepWhitespace: edit.keepWhitespace });
        } else {
          this._edits.push({ _type: 2 /* Text */, uri, edit, metadata });
        }
      }
    }
  }
  get(uri) {
    const res = [];
    for (const candidate of this._edits) {
      if (candidate._type === 2 /* Text */ && candidate.uri.toString() === uri.toString()) {
        res.push(candidate.edit);
      }
    }
    return res;
  }
  entries() {
    const textEdits = new ResourceMap();
    for (const candidate of this._edits) {
      if (candidate._type === 2 /* Text */) {
        let textEdit = textEdits.get(candidate.uri);
        if (!textEdit) {
          textEdit = [candidate.uri, []];
          textEdits.set(candidate.uri, textEdit);
        }
        textEdit[1].push(candidate.edit);
      }
    }
    return [...textEdits.values()];
  }
  get size() {
    return this.entries().length;
  }
  toJSON() {
    return this.entries();
  }
};
WorkspaceEdit = __decorateClass([
  es5ClassCompat
], WorkspaceEdit);
let SnippetString = class {
  constructor(value) {
    this._tabstop = 1;
    this.value = value || "";
  }
  static isSnippetString(thing) {
    if (thing instanceof SnippetString) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return typeof thing.value === "string";
  }
  static _escape(value) {
    return value.replace(/\$|}|\\/g, "\\$&");
  }
  appendText(string) {
    this.value += SnippetString._escape(string);
    return this;
  }
  appendTabstop(number = this._tabstop++) {
    this.value += "$";
    this.value += number;
    return this;
  }
  appendPlaceholder(value, number = this._tabstop++) {
    if (typeof value === "function") {
      const nested = new SnippetString();
      nested._tabstop = this._tabstop;
      value(nested);
      this._tabstop = nested._tabstop;
      value = nested.value;
    } else {
      value = SnippetString._escape(value);
    }
    this.value += "${";
    this.value += number;
    this.value += ":";
    this.value += value;
    this.value += "}";
    return this;
  }
  appendChoice(values, number = this._tabstop++) {
    const value = values.map((s) => s.replaceAll(/[|\\,]/g, "\\$&")).join(",");
    this.value += "${";
    this.value += number;
    this.value += "|";
    this.value += value;
    this.value += "|}";
    return this;
  }
  appendVariable(name, defaultValue) {
    if (typeof defaultValue === "function") {
      const nested = new SnippetString();
      nested._tabstop = this._tabstop;
      defaultValue(nested);
      this._tabstop = nested._tabstop;
      defaultValue = nested.value;
    } else if (typeof defaultValue === "string") {
      defaultValue = defaultValue.replace(/\$|}/g, "\\$&");
    }
    this.value += "${";
    this.value += name;
    if (defaultValue) {
      this.value += ":";
      this.value += defaultValue;
    }
    this.value += "}";
    return this;
  }
};
SnippetString = __decorateClass([
  es5ClassCompat
], SnippetString);
var DiagnosticTag = /* @__PURE__ */ ((DiagnosticTag2) => {
  DiagnosticTag2[DiagnosticTag2["Unnecessary"] = 1] = "Unnecessary";
  DiagnosticTag2[DiagnosticTag2["Deprecated"] = 2] = "Deprecated";
  return DiagnosticTag2;
})(DiagnosticTag || {});
var DiagnosticSeverity = /* @__PURE__ */ ((DiagnosticSeverity2) => {
  DiagnosticSeverity2[DiagnosticSeverity2["Hint"] = 3] = "Hint";
  DiagnosticSeverity2[DiagnosticSeverity2["Information"] = 2] = "Information";
  DiagnosticSeverity2[DiagnosticSeverity2["Warning"] = 1] = "Warning";
  DiagnosticSeverity2[DiagnosticSeverity2["Error"] = 0] = "Error";
  return DiagnosticSeverity2;
})(DiagnosticSeverity || {});
let Location = class {
  static isLocation(thing) {
    if (thing instanceof Location) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange(thing.range) && URI.isUri(thing.uri);
  }
  constructor(uri, rangeOrPosition) {
    this.uri = uri;
    if (!rangeOrPosition) {
    } else if (Range.isRange(rangeOrPosition)) {
      this.range = Range.of(rangeOrPosition);
    } else if (Position.isPosition(rangeOrPosition)) {
      this.range = new Range(rangeOrPosition, rangeOrPosition);
    } else {
      throw new Error("Illegal argument");
    }
  }
  toJSON() {
    return {
      uri: this.uri,
      range: this.range
    };
  }
};
Location = __decorateClass([
  es5ClassCompat
], Location);
let DiagnosticRelatedInformation = class {
  static is(thing) {
    if (!thing) {
      return false;
    }
    return typeof thing.message === "string" && thing.location && Range.isRange(thing.location.range) && URI.isUri(thing.location.uri);
  }
  constructor(location, message) {
    this.location = location;
    this.message = message;
  }
  static isEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.message === b.message && a.location.range.isEqual(b.location.range) && a.location.uri.toString() === b.location.uri.toString();
  }
};
DiagnosticRelatedInformation = __decorateClass([
  es5ClassCompat
], DiagnosticRelatedInformation);
let Diagnostic = class {
  constructor(range, message, severity = 0 /* Error */) {
    if (!Range.isRange(range)) {
      throw new TypeError("range must be set");
    }
    if (!message) {
      throw new TypeError("message must be set");
    }
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
  toJSON() {
    return {
      severity: DiagnosticSeverity[this.severity],
      message: this.message,
      range: this.range,
      source: this.source,
      code: this.code
    };
  }
  static isEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.message === b.message && a.severity === b.severity && a.code === b.code && a.severity === b.severity && a.source === b.source && a.range.isEqual(b.range) && equals(a.tags, b.tags) && equals(a.relatedInformation, b.relatedInformation, DiagnosticRelatedInformation.isEqual);
  }
};
Diagnostic = __decorateClass([
  es5ClassCompat
], Diagnostic);
let Hover = class {
  constructor(contents, range) {
    if (!contents) {
      throw new Error("Illegal argument, contents must be defined");
    }
    if (Array.isArray(contents)) {
      this.contents = contents;
    } else {
      this.contents = [contents];
    }
    this.range = range;
  }
};
Hover = __decorateClass([
  es5ClassCompat
], Hover);
let VerboseHover = class extends Hover {
  constructor(contents, range, canIncreaseVerbosity, canDecreaseVerbosity) {
    super(contents, range);
    this.canIncreaseVerbosity = canIncreaseVerbosity;
    this.canDecreaseVerbosity = canDecreaseVerbosity;
  }
};
VerboseHover = __decorateClass([
  es5ClassCompat
], VerboseHover);
var HoverVerbosityAction = /* @__PURE__ */ ((HoverVerbosityAction2) => {
  HoverVerbosityAction2[HoverVerbosityAction2["Increase"] = 0] = "Increase";
  HoverVerbosityAction2[HoverVerbosityAction2["Decrease"] = 1] = "Decrease";
  return HoverVerbosityAction2;
})(HoverVerbosityAction || {});
var DocumentHighlightKind = /* @__PURE__ */ ((DocumentHighlightKind2) => {
  DocumentHighlightKind2[DocumentHighlightKind2["Text"] = 0] = "Text";
  DocumentHighlightKind2[DocumentHighlightKind2["Read"] = 1] = "Read";
  DocumentHighlightKind2[DocumentHighlightKind2["Write"] = 2] = "Write";
  return DocumentHighlightKind2;
})(DocumentHighlightKind || {});
let DocumentHighlight = class {
  constructor(range, kind = 0 /* Text */) {
    this.range = range;
    this.kind = kind;
  }
  toJSON() {
    return {
      range: this.range,
      kind: DocumentHighlightKind[this.kind]
    };
  }
};
DocumentHighlight = __decorateClass([
  es5ClassCompat
], DocumentHighlight);
let MultiDocumentHighlight = class {
  constructor(uri, highlights) {
    this.uri = uri;
    this.highlights = highlights;
  }
  toJSON() {
    return {
      uri: this.uri,
      highlights: this.highlights.map((h) => h.toJSON())
    };
  }
};
MultiDocumentHighlight = __decorateClass([
  es5ClassCompat
], MultiDocumentHighlight);
var SymbolKind = /* @__PURE__ */ ((SymbolKind2) => {
  SymbolKind2[SymbolKind2["File"] = 0] = "File";
  SymbolKind2[SymbolKind2["Module"] = 1] = "Module";
  SymbolKind2[SymbolKind2["Namespace"] = 2] = "Namespace";
  SymbolKind2[SymbolKind2["Package"] = 3] = "Package";
  SymbolKind2[SymbolKind2["Class"] = 4] = "Class";
  SymbolKind2[SymbolKind2["Method"] = 5] = "Method";
  SymbolKind2[SymbolKind2["Property"] = 6] = "Property";
  SymbolKind2[SymbolKind2["Field"] = 7] = "Field";
  SymbolKind2[SymbolKind2["Constructor"] = 8] = "Constructor";
  SymbolKind2[SymbolKind2["Enum"] = 9] = "Enum";
  SymbolKind2[SymbolKind2["Interface"] = 10] = "Interface";
  SymbolKind2[SymbolKind2["Function"] = 11] = "Function";
  SymbolKind2[SymbolKind2["Variable"] = 12] = "Variable";
  SymbolKind2[SymbolKind2["Constant"] = 13] = "Constant";
  SymbolKind2[SymbolKind2["String"] = 14] = "String";
  SymbolKind2[SymbolKind2["Number"] = 15] = "Number";
  SymbolKind2[SymbolKind2["Boolean"] = 16] = "Boolean";
  SymbolKind2[SymbolKind2["Array"] = 17] = "Array";
  SymbolKind2[SymbolKind2["Object"] = 18] = "Object";
  SymbolKind2[SymbolKind2["Key"] = 19] = "Key";
  SymbolKind2[SymbolKind2["Null"] = 20] = "Null";
  SymbolKind2[SymbolKind2["EnumMember"] = 21] = "EnumMember";
  SymbolKind2[SymbolKind2["Struct"] = 22] = "Struct";
  SymbolKind2[SymbolKind2["Event"] = 23] = "Event";
  SymbolKind2[SymbolKind2["Operator"] = 24] = "Operator";
  SymbolKind2[SymbolKind2["TypeParameter"] = 25] = "TypeParameter";
  return SymbolKind2;
})(SymbolKind || {});
var SymbolTag = /* @__PURE__ */ ((SymbolTag2) => {
  SymbolTag2[SymbolTag2["Deprecated"] = 1] = "Deprecated";
  return SymbolTag2;
})(SymbolTag || {});
let SymbolInformation = class {
  static validate(candidate) {
    if (!candidate.name) {
      throw new Error("name must not be falsy");
    }
  }
  constructor(name, kind, rangeOrContainer, locationOrUri, containerName) {
    this.name = name;
    this.kind = kind;
    this.containerName = containerName;
    if (typeof rangeOrContainer === "string") {
      this.containerName = rangeOrContainer;
    }
    if (locationOrUri instanceof Location) {
      this.location = locationOrUri;
    } else if (rangeOrContainer instanceof Range) {
      this.location = new Location(locationOrUri, rangeOrContainer);
    }
    SymbolInformation.validate(this);
  }
  toJSON() {
    return {
      name: this.name,
      kind: SymbolKind[this.kind],
      location: this.location,
      containerName: this.containerName
    };
  }
};
SymbolInformation = __decorateClass([
  es5ClassCompat
], SymbolInformation);
let DocumentSymbol = class {
  static validate(candidate) {
    if (!candidate.name) {
      throw new Error("name must not be falsy");
    }
    if (!candidate.range.contains(candidate.selectionRange)) {
      throw new Error("selectionRange must be contained in fullRange");
    }
    candidate.children?.forEach(DocumentSymbol.validate);
  }
  constructor(name, detail, kind, range, selectionRange) {
    this.name = name;
    this.detail = detail;
    this.kind = kind;
    this.range = range;
    this.selectionRange = selectionRange;
    this.children = [];
    DocumentSymbol.validate(this);
  }
};
DocumentSymbol = __decorateClass([
  es5ClassCompat
], DocumentSymbol);
var CodeActionTriggerKind = /* @__PURE__ */ ((CodeActionTriggerKind2) => {
  CodeActionTriggerKind2[CodeActionTriggerKind2["Invoke"] = 1] = "Invoke";
  CodeActionTriggerKind2[CodeActionTriggerKind2["Automatic"] = 2] = "Automatic";
  return CodeActionTriggerKind2;
})(CodeActionTriggerKind || {});
let CodeAction = class {
  constructor(title, kind) {
    this.title = title;
    this.kind = kind;
  }
};
CodeAction = __decorateClass([
  es5ClassCompat
], CodeAction);
let CodeActionKind = class {
  constructor(value) {
    this.value = value;
  }
  append(parts) {
    return new CodeActionKind(this.value ? this.value + CodeActionKind.sep + parts : parts);
  }
  intersects(other) {
    return this.contains(other) || other.contains(this);
  }
  contains(other) {
    return this.value === other.value || other.value.startsWith(this.value + CodeActionKind.sep);
  }
};
CodeActionKind.sep = ".";
CodeActionKind = __decorateClass([
  es5ClassCompat
], CodeActionKind);
CodeActionKind.Empty = new CodeActionKind("");
CodeActionKind.QuickFix = CodeActionKind.Empty.append("quickfix");
CodeActionKind.Refactor = CodeActionKind.Empty.append("refactor");
CodeActionKind.RefactorExtract = CodeActionKind.Refactor.append("extract");
CodeActionKind.RefactorInline = CodeActionKind.Refactor.append("inline");
CodeActionKind.RefactorMove = CodeActionKind.Refactor.append("move");
CodeActionKind.RefactorRewrite = CodeActionKind.Refactor.append("rewrite");
CodeActionKind.Source = CodeActionKind.Empty.append("source");
CodeActionKind.SourceOrganizeImports = CodeActionKind.Source.append("organizeImports");
CodeActionKind.SourceFixAll = CodeActionKind.Source.append("fixAll");
CodeActionKind.Notebook = CodeActionKind.Empty.append("notebook");
let SelectionRange = class {
  constructor(range, parent) {
    this.range = range;
    this.parent = parent;
    if (parent && !parent.range.contains(this.range)) {
      throw new Error("Invalid argument: parent must contain this range");
    }
  }
};
SelectionRange = __decorateClass([
  es5ClassCompat
], SelectionRange);
class CallHierarchyItem {
  constructor(kind, name, detail, uri, range, selectionRange) {
    this.kind = kind;
    this.name = name;
    this.detail = detail;
    this.uri = uri;
    this.range = range;
    this.selectionRange = selectionRange;
  }
}
class CallHierarchyIncomingCall {
  constructor(item, fromRanges) {
    this.fromRanges = fromRanges;
    this.from = item;
  }
}
class CallHierarchyOutgoingCall {
  constructor(item, fromRanges) {
    this.fromRanges = fromRanges;
    this.to = item;
  }
}
var LanguageStatusSeverity = /* @__PURE__ */ ((LanguageStatusSeverity2) => {
  LanguageStatusSeverity2[LanguageStatusSeverity2["Information"] = 0] = "Information";
  LanguageStatusSeverity2[LanguageStatusSeverity2["Warning"] = 1] = "Warning";
  LanguageStatusSeverity2[LanguageStatusSeverity2["Error"] = 2] = "Error";
  return LanguageStatusSeverity2;
})(LanguageStatusSeverity || {});
let CodeLens = class {
  constructor(range, command) {
    this.range = range;
    this.command = command;
  }
  get isResolved() {
    return !!this.command;
  }
};
CodeLens = __decorateClass([
  es5ClassCompat
], CodeLens);
let MarkdownString = class {
  constructor(value, supportThemeIcons = false) {
    __privateAdd(this, _delegate);
    __privateSet(this, _delegate, new BaseMarkdownString(value, { supportThemeIcons }));
  }
  static isMarkdownString(thing) {
    if (thing instanceof MarkdownString) {
      return true;
    }
    return thing && thing.appendCodeblock && thing.appendMarkdown && thing.appendText && thing.value !== void 0;
  }
  get value() {
    return __privateGet(this, _delegate).value;
  }
  set value(value) {
    __privateGet(this, _delegate).value = value;
  }
  get isTrusted() {
    return __privateGet(this, _delegate).isTrusted;
  }
  set isTrusted(value) {
    __privateGet(this, _delegate).isTrusted = value;
  }
  get supportThemeIcons() {
    return __privateGet(this, _delegate).supportThemeIcons;
  }
  set supportThemeIcons(value) {
    __privateGet(this, _delegate).supportThemeIcons = value;
  }
  get supportHtml() {
    return __privateGet(this, _delegate).supportHtml;
  }
  set supportHtml(value) {
    __privateGet(this, _delegate).supportHtml = value;
  }
  get baseUri() {
    return __privateGet(this, _delegate).baseUri;
  }
  set baseUri(value) {
    __privateGet(this, _delegate).baseUri = value;
  }
  appendText(value) {
    __privateGet(this, _delegate).appendText(value);
    return this;
  }
  appendMarkdown(value) {
    __privateGet(this, _delegate).appendMarkdown(value);
    return this;
  }
  appendCodeblock(value, language) {
    __privateGet(this, _delegate).appendCodeblock(language ?? "", value);
    return this;
  }
};
_delegate = new WeakMap();
MarkdownString = __decorateClass([
  es5ClassCompat
], MarkdownString);
let ParameterInformation = class {
  constructor(label, documentation) {
    this.label = label;
    this.documentation = documentation;
  }
};
ParameterInformation = __decorateClass([
  es5ClassCompat
], ParameterInformation);
let SignatureInformation = class {
  constructor(label, documentation) {
    this.label = label;
    this.documentation = documentation;
    this.parameters = [];
  }
};
SignatureInformation = __decorateClass([
  es5ClassCompat
], SignatureInformation);
let SignatureHelp = class {
  constructor() {
    this.activeSignature = 0;
    this.activeParameter = 0;
    this.signatures = [];
  }
};
SignatureHelp = __decorateClass([
  es5ClassCompat
], SignatureHelp);
var SignatureHelpTriggerKind = /* @__PURE__ */ ((SignatureHelpTriggerKind2) => {
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["Invoke"] = 1] = "Invoke";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["TriggerCharacter"] = 2] = "TriggerCharacter";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["ContentChange"] = 3] = "ContentChange";
  return SignatureHelpTriggerKind2;
})(SignatureHelpTriggerKind || {});
var InlayHintKind = /* @__PURE__ */ ((InlayHintKind2) => {
  InlayHintKind2[InlayHintKind2["Type"] = 1] = "Type";
  InlayHintKind2[InlayHintKind2["Parameter"] = 2] = "Parameter";
  return InlayHintKind2;
})(InlayHintKind || {});
let InlayHintLabelPart = class {
  constructor(value) {
    this.value = value;
  }
};
InlayHintLabelPart = __decorateClass([
  es5ClassCompat
], InlayHintLabelPart);
let InlayHint = class {
  constructor(position, label, kind) {
    this.position = position;
    this.label = label;
    this.kind = kind;
  }
};
InlayHint = __decorateClass([
  es5ClassCompat
], InlayHint);
var CompletionTriggerKind = /* @__PURE__ */ ((CompletionTriggerKind2) => {
  CompletionTriggerKind2[CompletionTriggerKind2["Invoke"] = 0] = "Invoke";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerCharacter"] = 1] = "TriggerCharacter";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
  return CompletionTriggerKind2;
})(CompletionTriggerKind || {});
var CompletionItemKind = /* @__PURE__ */ ((CompletionItemKind2) => {
  CompletionItemKind2[CompletionItemKind2["Text"] = 0] = "Text";
  CompletionItemKind2[CompletionItemKind2["Method"] = 1] = "Method";
  CompletionItemKind2[CompletionItemKind2["Function"] = 2] = "Function";
  CompletionItemKind2[CompletionItemKind2["Constructor"] = 3] = "Constructor";
  CompletionItemKind2[CompletionItemKind2["Field"] = 4] = "Field";
  CompletionItemKind2[CompletionItemKind2["Variable"] = 5] = "Variable";
  CompletionItemKind2[CompletionItemKind2["Class"] = 6] = "Class";
  CompletionItemKind2[CompletionItemKind2["Interface"] = 7] = "Interface";
  CompletionItemKind2[CompletionItemKind2["Module"] = 8] = "Module";
  CompletionItemKind2[CompletionItemKind2["Property"] = 9] = "Property";
  CompletionItemKind2[CompletionItemKind2["Unit"] = 10] = "Unit";
  CompletionItemKind2[CompletionItemKind2["Value"] = 11] = "Value";
  CompletionItemKind2[CompletionItemKind2["Enum"] = 12] = "Enum";
  CompletionItemKind2[CompletionItemKind2["Keyword"] = 13] = "Keyword";
  CompletionItemKind2[CompletionItemKind2["Snippet"] = 14] = "Snippet";
  CompletionItemKind2[CompletionItemKind2["Color"] = 15] = "Color";
  CompletionItemKind2[CompletionItemKind2["File"] = 16] = "File";
  CompletionItemKind2[CompletionItemKind2["Reference"] = 17] = "Reference";
  CompletionItemKind2[CompletionItemKind2["Folder"] = 18] = "Folder";
  CompletionItemKind2[CompletionItemKind2["EnumMember"] = 19] = "EnumMember";
  CompletionItemKind2[CompletionItemKind2["Constant"] = 20] = "Constant";
  CompletionItemKind2[CompletionItemKind2["Struct"] = 21] = "Struct";
  CompletionItemKind2[CompletionItemKind2["Event"] = 22] = "Event";
  CompletionItemKind2[CompletionItemKind2["Operator"] = 23] = "Operator";
  CompletionItemKind2[CompletionItemKind2["TypeParameter"] = 24] = "TypeParameter";
  CompletionItemKind2[CompletionItemKind2["User"] = 25] = "User";
  CompletionItemKind2[CompletionItemKind2["Issue"] = 26] = "Issue";
  return CompletionItemKind2;
})(CompletionItemKind || {});
var CompletionItemTag = /* @__PURE__ */ ((CompletionItemTag2) => {
  CompletionItemTag2[CompletionItemTag2["Deprecated"] = 1] = "Deprecated";
  return CompletionItemTag2;
})(CompletionItemTag || {});
let CompletionItem = class {
  constructor(label, kind) {
    this.label = label;
    this.kind = kind;
  }
  toJSON() {
    return {
      label: this.label,
      kind: this.kind && CompletionItemKind[this.kind],
      detail: this.detail,
      documentation: this.documentation,
      sortText: this.sortText,
      filterText: this.filterText,
      preselect: this.preselect,
      insertText: this.insertText,
      textEdit: this.textEdit
    };
  }
};
CompletionItem = __decorateClass([
  es5ClassCompat
], CompletionItem);
let CompletionList = class {
  constructor(items = [], isIncomplete = false) {
    this.items = items;
    this.isIncomplete = isIncomplete;
  }
};
CompletionList = __decorateClass([
  es5ClassCompat
], CompletionList);
let InlineSuggestion = class {
  constructor(insertText, range, command) {
    this.insertText = insertText;
    this.range = range;
    this.command = command;
  }
};
InlineSuggestion = __decorateClass([
  es5ClassCompat
], InlineSuggestion);
let InlineSuggestionList = class {
  constructor(items) {
    this.commands = void 0;
    this.suppressSuggestions = void 0;
    this.items = items;
  }
};
InlineSuggestionList = __decorateClass([
  es5ClassCompat
], InlineSuggestionList);
var PartialAcceptTriggerKind = /* @__PURE__ */ ((PartialAcceptTriggerKind2) => {
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Unknown"] = 0] = "Unknown";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Word"] = 1] = "Word";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Line"] = 2] = "Line";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Suggest"] = 3] = "Suggest";
  return PartialAcceptTriggerKind2;
})(PartialAcceptTriggerKind || {});
var ViewColumn = /* @__PURE__ */ ((ViewColumn2) => {
  ViewColumn2[ViewColumn2["Active"] = -1] = "Active";
  ViewColumn2[ViewColumn2["Beside"] = -2] = "Beside";
  ViewColumn2[ViewColumn2["One"] = 1] = "One";
  ViewColumn2[ViewColumn2["Two"] = 2] = "Two";
  ViewColumn2[ViewColumn2["Three"] = 3] = "Three";
  ViewColumn2[ViewColumn2["Four"] = 4] = "Four";
  ViewColumn2[ViewColumn2["Five"] = 5] = "Five";
  ViewColumn2[ViewColumn2["Six"] = 6] = "Six";
  ViewColumn2[ViewColumn2["Seven"] = 7] = "Seven";
  ViewColumn2[ViewColumn2["Eight"] = 8] = "Eight";
  ViewColumn2[ViewColumn2["Nine"] = 9] = "Nine";
  return ViewColumn2;
})(ViewColumn || {});
var StatusBarAlignment = /* @__PURE__ */ ((StatusBarAlignment2) => {
  StatusBarAlignment2[StatusBarAlignment2["Left"] = 1] = "Left";
  StatusBarAlignment2[StatusBarAlignment2["Right"] = 2] = "Right";
  return StatusBarAlignment2;
})(StatusBarAlignment || {});
function asStatusBarItemIdentifier(extension, id) {
  return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
var TextEditorLineNumbersStyle = /* @__PURE__ */ ((TextEditorLineNumbersStyle2) => {
  TextEditorLineNumbersStyle2[TextEditorLineNumbersStyle2["Off"] = 0] = "Off";
  TextEditorLineNumbersStyle2[TextEditorLineNumbersStyle2["On"] = 1] = "On";
  TextEditorLineNumbersStyle2[TextEditorLineNumbersStyle2["Relative"] = 2] = "Relative";
  TextEditorLineNumbersStyle2[TextEditorLineNumbersStyle2["Interval"] = 3] = "Interval";
  return TextEditorLineNumbersStyle2;
})(TextEditorLineNumbersStyle || {});
var TextDocumentSaveReason = /* @__PURE__ */ ((TextDocumentSaveReason2) => {
  TextDocumentSaveReason2[TextDocumentSaveReason2["Manual"] = 1] = "Manual";
  TextDocumentSaveReason2[TextDocumentSaveReason2["AfterDelay"] = 2] = "AfterDelay";
  TextDocumentSaveReason2[TextDocumentSaveReason2["FocusOut"] = 3] = "FocusOut";
  return TextDocumentSaveReason2;
})(TextDocumentSaveReason || {});
var TextEditorRevealType = /* @__PURE__ */ ((TextEditorRevealType2) => {
  TextEditorRevealType2[TextEditorRevealType2["Default"] = 0] = "Default";
  TextEditorRevealType2[TextEditorRevealType2["InCenter"] = 1] = "InCenter";
  TextEditorRevealType2[TextEditorRevealType2["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
  TextEditorRevealType2[TextEditorRevealType2["AtTop"] = 3] = "AtTop";
  return TextEditorRevealType2;
})(TextEditorRevealType || {});
var TextEditorSelectionChangeKind = /* @__PURE__ */ ((TextEditorSelectionChangeKind2) => {
  TextEditorSelectionChangeKind2[TextEditorSelectionChangeKind2["Keyboard"] = 1] = "Keyboard";
  TextEditorSelectionChangeKind2[TextEditorSelectionChangeKind2["Mouse"] = 2] = "Mouse";
  TextEditorSelectionChangeKind2[TextEditorSelectionChangeKind2["Command"] = 3] = "Command";
  return TextEditorSelectionChangeKind2;
})(TextEditorSelectionChangeKind || {});
var TextEditorChangeKind = /* @__PURE__ */ ((TextEditorChangeKind2) => {
  TextEditorChangeKind2[TextEditorChangeKind2["Addition"] = 1] = "Addition";
  TextEditorChangeKind2[TextEditorChangeKind2["Deletion"] = 2] = "Deletion";
  TextEditorChangeKind2[TextEditorChangeKind2["Modification"] = 3] = "Modification";
  return TextEditorChangeKind2;
})(TextEditorChangeKind || {});
var TextDocumentChangeReason = /* @__PURE__ */ ((TextDocumentChangeReason2) => {
  TextDocumentChangeReason2[TextDocumentChangeReason2["Undo"] = 1] = "Undo";
  TextDocumentChangeReason2[TextDocumentChangeReason2["Redo"] = 2] = "Redo";
  return TextDocumentChangeReason2;
})(TextDocumentChangeReason || {});
var DecorationRangeBehavior = /* @__PURE__ */ ((DecorationRangeBehavior2) => {
  DecorationRangeBehavior2[DecorationRangeBehavior2["OpenOpen"] = 0] = "OpenOpen";
  DecorationRangeBehavior2[DecorationRangeBehavior2["ClosedClosed"] = 1] = "ClosedClosed";
  DecorationRangeBehavior2[DecorationRangeBehavior2["OpenClosed"] = 2] = "OpenClosed";
  DecorationRangeBehavior2[DecorationRangeBehavior2["ClosedOpen"] = 3] = "ClosedOpen";
  return DecorationRangeBehavior2;
})(DecorationRangeBehavior || {});
((TextEditorSelectionChangeKind2) => {
  function fromValue(s) {
    switch (s) {
      case "keyboard":
        return 1 /* Keyboard */;
      case "mouse":
        return 2 /* Mouse */;
      case TextEditorSelectionSource.PROGRAMMATIC:
      case TextEditorSelectionSource.JUMP:
      case TextEditorSelectionSource.NAVIGATION:
        return 3 /* Command */;
    }
    return void 0;
  }
  TextEditorSelectionChangeKind2.fromValue = fromValue;
})(TextEditorSelectionChangeKind || (TextEditorSelectionChangeKind = {}));
var SyntaxTokenType = /* @__PURE__ */ ((SyntaxTokenType2) => {
  SyntaxTokenType2[SyntaxTokenType2["Other"] = 0] = "Other";
  SyntaxTokenType2[SyntaxTokenType2["Comment"] = 1] = "Comment";
  SyntaxTokenType2[SyntaxTokenType2["String"] = 2] = "String";
  SyntaxTokenType2[SyntaxTokenType2["RegEx"] = 3] = "RegEx";
  return SyntaxTokenType2;
})(SyntaxTokenType || {});
((SyntaxTokenType2) => {
  function toString(v) {
    switch (v) {
      case 0 /* Other */:
        return "other";
      case 1 /* Comment */:
        return "comment";
      case 2 /* String */:
        return "string";
      case 3 /* RegEx */:
        return "regex";
    }
    return "other";
  }
  SyntaxTokenType2.toString = toString;
})(SyntaxTokenType || (SyntaxTokenType = {}));
let DocumentLink = class {
  constructor(range, target) {
    if (target && !URI.isUri(target)) {
      throw illegalArgument("target");
    }
    if (!Range.isRange(range) || range.isEmpty) {
      throw illegalArgument("range");
    }
    this.range = range;
    this.target = target;
  }
};
DocumentLink = __decorateClass([
  es5ClassCompat
], DocumentLink);
let Color = class {
  constructor(red, green, blue, alpha) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }
};
Color = __decorateClass([
  es5ClassCompat
], Color);
let ColorInformation = class {
  constructor(range, color) {
    if (color && !(color instanceof Color)) {
      throw illegalArgument("color");
    }
    if (!Range.isRange(range) || range.isEmpty) {
      throw illegalArgument("range");
    }
    this.range = range;
    this.color = color;
  }
};
ColorInformation = __decorateClass([
  es5ClassCompat
], ColorInformation);
let ColorPresentation = class {
  constructor(label) {
    if (!label || typeof label !== "string") {
      throw illegalArgument("label");
    }
    this.label = label;
  }
};
ColorPresentation = __decorateClass([
  es5ClassCompat
], ColorPresentation);
var ColorFormat = /* @__PURE__ */ ((ColorFormat2) => {
  ColorFormat2[ColorFormat2["RGB"] = 0] = "RGB";
  ColorFormat2[ColorFormat2["HEX"] = 1] = "HEX";
  ColorFormat2[ColorFormat2["HSL"] = 2] = "HSL";
  return ColorFormat2;
})(ColorFormat || {});
var SourceControlInputBoxValidationType = /* @__PURE__ */ ((SourceControlInputBoxValidationType2) => {
  SourceControlInputBoxValidationType2[SourceControlInputBoxValidationType2["Error"] = 0] = "Error";
  SourceControlInputBoxValidationType2[SourceControlInputBoxValidationType2["Warning"] = 1] = "Warning";
  SourceControlInputBoxValidationType2[SourceControlInputBoxValidationType2["Information"] = 2] = "Information";
  return SourceControlInputBoxValidationType2;
})(SourceControlInputBoxValidationType || {});
var TerminalExitReason = /* @__PURE__ */ ((TerminalExitReason2) => {
  TerminalExitReason2[TerminalExitReason2["Unknown"] = 0] = "Unknown";
  TerminalExitReason2[TerminalExitReason2["Shutdown"] = 1] = "Shutdown";
  TerminalExitReason2[TerminalExitReason2["Process"] = 2] = "Process";
  TerminalExitReason2[TerminalExitReason2["User"] = 3] = "User";
  TerminalExitReason2[TerminalExitReason2["Extension"] = 4] = "Extension";
  return TerminalExitReason2;
})(TerminalExitReason || {});
var TerminalShellExecutionCommandLineConfidence = /* @__PURE__ */ ((TerminalShellExecutionCommandLineConfidence2) => {
  TerminalShellExecutionCommandLineConfidence2[TerminalShellExecutionCommandLineConfidence2["Low"] = 0] = "Low";
  TerminalShellExecutionCommandLineConfidence2[TerminalShellExecutionCommandLineConfidence2["Medium"] = 1] = "Medium";
  TerminalShellExecutionCommandLineConfidence2[TerminalShellExecutionCommandLineConfidence2["High"] = 2] = "High";
  return TerminalShellExecutionCommandLineConfidence2;
})(TerminalShellExecutionCommandLineConfidence || {});
var TerminalShellType = /* @__PURE__ */ ((TerminalShellType2) => {
  TerminalShellType2[TerminalShellType2["Sh"] = 1] = "Sh";
  TerminalShellType2[TerminalShellType2["Bash"] = 2] = "Bash";
  TerminalShellType2[TerminalShellType2["Fish"] = 3] = "Fish";
  TerminalShellType2[TerminalShellType2["Csh"] = 4] = "Csh";
  TerminalShellType2[TerminalShellType2["Ksh"] = 5] = "Ksh";
  TerminalShellType2[TerminalShellType2["Zsh"] = 6] = "Zsh";
  TerminalShellType2[TerminalShellType2["CommandPrompt"] = 7] = "CommandPrompt";
  TerminalShellType2[TerminalShellType2["GitBash"] = 8] = "GitBash";
  TerminalShellType2[TerminalShellType2["PowerShell"] = 9] = "PowerShell";
  TerminalShellType2[TerminalShellType2["Python"] = 10] = "Python";
  TerminalShellType2[TerminalShellType2["Julia"] = 11] = "Julia";
  TerminalShellType2[TerminalShellType2["NuShell"] = 12] = "NuShell";
  TerminalShellType2[TerminalShellType2["Node"] = 13] = "Node";
  return TerminalShellType2;
})(TerminalShellType || {});
class TerminalLink {
  constructor(startIndex, length, tooltip) {
    this.startIndex = startIndex;
    this.length = length;
    this.tooltip = tooltip;
    if (typeof startIndex !== "number" || startIndex < 0) {
      throw illegalArgument("startIndex");
    }
    if (typeof length !== "number" || length < 1) {
      throw illegalArgument("length");
    }
    if (tooltip !== void 0 && typeof tooltip !== "string") {
      throw illegalArgument("tooltip");
    }
  }
}
class TerminalQuickFixOpener {
  constructor(uri) {
    this.uri = uri;
  }
}
class TerminalQuickFixCommand {
  constructor(terminalCommand) {
    this.terminalCommand = terminalCommand;
  }
}
var TerminalLocation = /* @__PURE__ */ ((TerminalLocation2) => {
  TerminalLocation2[TerminalLocation2["Panel"] = 1] = "Panel";
  TerminalLocation2[TerminalLocation2["Editor"] = 2] = "Editor";
  return TerminalLocation2;
})(TerminalLocation || {});
class TerminalProfile {
  constructor(options) {
    this.options = options;
    if (typeof options !== "object") {
      throw illegalArgument("options");
    }
  }
}
var TerminalCompletionItemKind = /* @__PURE__ */ ((TerminalCompletionItemKind2) => {
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["File"] = 0] = "File";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Folder"] = 1] = "Folder";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Method"] = 2] = "Method";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Alias"] = 3] = "Alias";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Argument"] = 4] = "Argument";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Option"] = 5] = "Option";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["OptionValue"] = 6] = "OptionValue";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Flag"] = 7] = "Flag";
  return TerminalCompletionItemKind2;
})(TerminalCompletionItemKind || {});
class TerminalCompletionItem {
  constructor(label, icon, detail, documentation, isFile, isDirectory, isKeyword, replacementIndex, replacementLength) {
    this.label = label;
    this.icon = icon;
    this.detail = detail;
    this.documentation = documentation;
    this.isFile = isFile;
    this.isDirectory = isDirectory;
    this.isKeyword = isKeyword;
    this.replacementIndex = replacementIndex ?? 0;
    this.replacementLength = replacementLength ?? 0;
  }
}
class TerminalCompletionList {
  /**
   * Creates a new completion list.
   *
   * @param items The completion items.
   * @param isIncomplete The list is not complete.
   */
  constructor(items, resourceRequestConfig) {
    this.items = items ?? [];
    this.resourceRequestConfig = resourceRequestConfig;
  }
}
var TaskRevealKind = /* @__PURE__ */ ((TaskRevealKind2) => {
  TaskRevealKind2[TaskRevealKind2["Always"] = 1] = "Always";
  TaskRevealKind2[TaskRevealKind2["Silent"] = 2] = "Silent";
  TaskRevealKind2[TaskRevealKind2["Never"] = 3] = "Never";
  return TaskRevealKind2;
})(TaskRevealKind || {});
var TaskEventKind = /* @__PURE__ */ ((TaskEventKind2) => {
  TaskEventKind2["Changed"] = "changed";
  TaskEventKind2["ProcessStarted"] = "processStarted";
  TaskEventKind2["ProcessEnded"] = "processEnded";
  TaskEventKind2["Terminated"] = "terminated";
  TaskEventKind2["Start"] = "start";
  TaskEventKind2["AcquiredInput"] = "acquiredInput";
  TaskEventKind2["DependsOnStarted"] = "dependsOnStarted";
  TaskEventKind2["Active"] = "active";
  TaskEventKind2["Inactive"] = "inactive";
  TaskEventKind2["End"] = "end";
  TaskEventKind2["ProblemMatcherStarted"] = "problemMatcherStarted";
  TaskEventKind2["ProblemMatcherEnded"] = "problemMatcherEnded";
  TaskEventKind2["ProblemMatcherFoundErrors"] = "problemMatcherFoundErrors";
  return TaskEventKind2;
})(TaskEventKind || {});
var TaskPanelKind = /* @__PURE__ */ ((TaskPanelKind2) => {
  TaskPanelKind2[TaskPanelKind2["Shared"] = 1] = "Shared";
  TaskPanelKind2[TaskPanelKind2["Dedicated"] = 2] = "Dedicated";
  TaskPanelKind2[TaskPanelKind2["New"] = 3] = "New";
  return TaskPanelKind2;
})(TaskPanelKind || {});
let TaskGroup = class {
  constructor(id, label) {
    this.label = label;
    if (typeof id !== "string") {
      throw illegalArgument("name");
    }
    if (typeof label !== "string") {
      throw illegalArgument("name");
    }
    this._id = id;
  }
  static from(value) {
    switch (value) {
      case "clean":
        return TaskGroup.Clean;
      case "build":
        return TaskGroup.Build;
      case "rebuild":
        return TaskGroup.Rebuild;
      case "test":
        return TaskGroup.Test;
      default:
        return void 0;
    }
  }
  get id() {
    return this._id;
  }
};
TaskGroup.Clean = new TaskGroup("clean", "Clean");
TaskGroup.Build = new TaskGroup("build", "Build");
TaskGroup.Rebuild = new TaskGroup("rebuild", "Rebuild");
TaskGroup.Test = new TaskGroup("test", "Test");
TaskGroup = __decorateClass([
  es5ClassCompat
], TaskGroup);
function computeTaskExecutionId(values) {
  let id = "";
  for (let i = 0; i < values.length; i++) {
    id += values[i].replace(/,/g, ",,") + ",";
  }
  return id;
}
let ProcessExecution = class {
  constructor(process, varg1, varg2) {
    if (typeof process !== "string") {
      throw illegalArgument("process");
    }
    this._args = [];
    this._process = process;
    if (varg1 !== void 0) {
      if (Array.isArray(varg1)) {
        this._args = varg1;
        this._options = varg2;
      } else {
        this._options = varg1;
      }
    }
  }
  get process() {
    return this._process;
  }
  set process(value) {
    if (typeof value !== "string") {
      throw illegalArgument("process");
    }
    this._process = value;
  }
  get args() {
    return this._args;
  }
  set args(value) {
    if (!Array.isArray(value)) {
      value = [];
    }
    this._args = value;
  }
  get options() {
    return this._options;
  }
  set options(value) {
    this._options = value;
  }
  computeId() {
    const props = [];
    props.push("process");
    if (this._process !== void 0) {
      props.push(this._process);
    }
    if (this._args && this._args.length > 0) {
      for (const arg of this._args) {
        props.push(arg);
      }
    }
    return computeTaskExecutionId(props);
  }
};
ProcessExecution = __decorateClass([
  es5ClassCompat
], ProcessExecution);
let ShellExecution = class {
  constructor(arg0, arg1, arg2) {
    this._args = [];
    if (Array.isArray(arg1)) {
      if (!arg0) {
        throw illegalArgument("command can't be undefined or null");
      }
      if (typeof arg0 !== "string" && typeof arg0.value !== "string") {
        throw illegalArgument("command");
      }
      this._command = arg0;
      if (arg1) {
        this._args = arg1;
      }
      this._options = arg2;
    } else {
      if (typeof arg0 !== "string") {
        throw illegalArgument("commandLine");
      }
      this._commandLine = arg0;
      this._options = arg1;
    }
  }
  get commandLine() {
    return this._commandLine;
  }
  set commandLine(value) {
    if (typeof value !== "string") {
      throw illegalArgument("commandLine");
    }
    this._commandLine = value;
  }
  get command() {
    return this._command ? this._command : "";
  }
  set command(value) {
    if (typeof value !== "string" && typeof value.value !== "string") {
      throw illegalArgument("command");
    }
    this._command = value;
  }
  get args() {
    return this._args;
  }
  set args(value) {
    this._args = value || [];
  }
  get options() {
    return this._options;
  }
  set options(value) {
    this._options = value;
  }
  computeId() {
    const props = [];
    props.push("shell");
    if (this._commandLine !== void 0) {
      props.push(this._commandLine);
    }
    if (this._command !== void 0) {
      props.push(typeof this._command === "string" ? this._command : this._command.value);
    }
    if (this._args && this._args.length > 0) {
      for (const arg of this._args) {
        props.push(typeof arg === "string" ? arg : arg.value);
      }
    }
    return computeTaskExecutionId(props);
  }
};
ShellExecution = __decorateClass([
  es5ClassCompat
], ShellExecution);
var ShellQuoting = /* @__PURE__ */ ((ShellQuoting2) => {
  ShellQuoting2[ShellQuoting2["Escape"] = 1] = "Escape";
  ShellQuoting2[ShellQuoting2["Strong"] = 2] = "Strong";
  ShellQuoting2[ShellQuoting2["Weak"] = 3] = "Weak";
  return ShellQuoting2;
})(ShellQuoting || {});
var TaskScope = /* @__PURE__ */ ((TaskScope2) => {
  TaskScope2[TaskScope2["Global"] = 1] = "Global";
  TaskScope2[TaskScope2["Workspace"] = 2] = "Workspace";
  return TaskScope2;
})(TaskScope || {});
class CustomExecution {
  constructor(callback) {
    this._callback = callback;
  }
  computeId() {
    return "customExecution" + generateUuid();
  }
  set callback(value) {
    this._callback = value;
  }
  get callback() {
    return this._callback;
  }
}
let Task = class {
  constructor(definition, arg2, arg3, arg4, arg5, arg6) {
    this.__deprecated = false;
    this._definition = this.definition = definition;
    let problemMatchers;
    if (typeof arg2 === "string") {
      this._name = this.name = arg2;
      this._source = this.source = arg3;
      this.execution = arg4;
      problemMatchers = arg5;
      this.__deprecated = true;
    } else if (arg2 === 1 /* Global */ || arg2 === 2 /* Workspace */) {
      this.target = arg2;
      this._name = this.name = arg3;
      this._source = this.source = arg4;
      this.execution = arg5;
      problemMatchers = arg6;
    } else {
      this.target = arg2;
      this._name = this.name = arg3;
      this._source = this.source = arg4;
      this.execution = arg5;
      problemMatchers = arg6;
    }
    if (typeof problemMatchers === "string") {
      this._problemMatchers = [problemMatchers];
      this._hasDefinedMatchers = true;
    } else if (Array.isArray(problemMatchers)) {
      this._problemMatchers = problemMatchers;
      this._hasDefinedMatchers = true;
    } else {
      this._problemMatchers = [];
      this._hasDefinedMatchers = false;
    }
    this._isBackground = false;
    this._presentationOptions = /* @__PURE__ */ Object.create(null);
    this._runOptions = /* @__PURE__ */ Object.create(null);
  }
  get _id() {
    return this.__id;
  }
  set _id(value) {
    this.__id = value;
  }
  get _deprecated() {
    return this.__deprecated;
  }
  clear() {
    if (this.__id === void 0) {
      return;
    }
    this.__id = void 0;
    this._scope = void 0;
    this.computeDefinitionBasedOnExecution();
  }
  computeDefinitionBasedOnExecution() {
    if (this._execution instanceof ProcessExecution) {
      this._definition = {
        type: Task.ProcessType,
        id: this._execution.computeId()
      };
    } else if (this._execution instanceof ShellExecution) {
      this._definition = {
        type: Task.ShellType,
        id: this._execution.computeId()
      };
    } else if (this._execution instanceof CustomExecution) {
      this._definition = {
        type: Task.ExtensionCallbackType,
        id: this._execution.computeId()
      };
    } else {
      this._definition = {
        type: Task.EmptyType,
        id: generateUuid()
      };
    }
  }
  get definition() {
    return this._definition;
  }
  set definition(value) {
    if (value === void 0 || value === null) {
      throw illegalArgument("Kind can't be undefined or null");
    }
    this.clear();
    this._definition = value;
  }
  get scope() {
    return this._scope;
  }
  set target(value) {
    this.clear();
    this._scope = value;
  }
  get name() {
    return this._name;
  }
  set name(value) {
    if (typeof value !== "string") {
      throw illegalArgument("name");
    }
    this.clear();
    this._name = value;
  }
  get execution() {
    return this._execution;
  }
  set execution(value) {
    if (value === null) {
      value = void 0;
    }
    this.clear();
    this._execution = value;
    const type = this._definition.type;
    if (Task.EmptyType === type || Task.ProcessType === type || Task.ShellType === type || Task.ExtensionCallbackType === type) {
      this.computeDefinitionBasedOnExecution();
    }
  }
  get problemMatchers() {
    return this._problemMatchers;
  }
  set problemMatchers(value) {
    if (!Array.isArray(value)) {
      this.clear();
      this._problemMatchers = [];
      this._hasDefinedMatchers = false;
      return;
    } else {
      this.clear();
      this._problemMatchers = value;
      this._hasDefinedMatchers = true;
    }
  }
  get hasDefinedMatchers() {
    return this._hasDefinedMatchers;
  }
  get isBackground() {
    return this._isBackground;
  }
  set isBackground(value) {
    if (value !== true && value !== false) {
      value = false;
    }
    this.clear();
    this._isBackground = value;
  }
  get source() {
    return this._source;
  }
  set source(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw illegalArgument("source must be a string of length > 0");
    }
    this.clear();
    this._source = value;
  }
  get group() {
    return this._group;
  }
  set group(value) {
    if (value === null) {
      value = void 0;
    }
    this.clear();
    this._group = value;
  }
  get detail() {
    return this._detail;
  }
  set detail(value) {
    if (value === null) {
      value = void 0;
    }
    this._detail = value;
  }
  get presentationOptions() {
    return this._presentationOptions;
  }
  set presentationOptions(value) {
    if (value === null || value === void 0) {
      value = /* @__PURE__ */ Object.create(null);
    }
    this.clear();
    this._presentationOptions = value;
  }
  get runOptions() {
    return this._runOptions;
  }
  set runOptions(value) {
    if (value === null || value === void 0) {
      value = /* @__PURE__ */ Object.create(null);
    }
    this.clear();
    this._runOptions = value;
  }
};
Task.ExtensionCallbackType = "customExecution";
Task.ProcessType = "process";
Task.ShellType = "shell";
Task.EmptyType = "$empty";
Task = __decorateClass([
  es5ClassCompat
], Task);
var ProgressLocation = /* @__PURE__ */ ((ProgressLocation2) => {
  ProgressLocation2[ProgressLocation2["SourceControl"] = 1] = "SourceControl";
  ProgressLocation2[ProgressLocation2["Window"] = 10] = "Window";
  ProgressLocation2[ProgressLocation2["Notification"] = 15] = "Notification";
  return ProgressLocation2;
})(ProgressLocation || {});
var ViewBadge;
((ViewBadge2) => {
  function isViewBadge(thing) {
    const viewBadgeThing = thing;
    if (!isNumber(viewBadgeThing.value)) {
      console.log("INVALID view badge, invalid value", viewBadgeThing.value);
      return false;
    }
    if (viewBadgeThing.tooltip && !isString(viewBadgeThing.tooltip)) {
      console.log("INVALID view badge, invalid tooltip", viewBadgeThing.tooltip);
      return false;
    }
    return true;
  }
  ViewBadge2.isViewBadge = isViewBadge;
})(ViewBadge || (ViewBadge = {}));
let TreeItem = class {
  constructor(arg1, collapsibleState = 0 /* None */) {
    this.collapsibleState = collapsibleState;
    if (URI.isUri(arg1)) {
      this.resourceUri = arg1;
    } else {
      this.label = arg1;
    }
  }
  static isTreeItem(thing, extension) {
    const treeItemThing = thing;
    if (treeItemThing.checkboxState !== void 0) {
      const checkbox = isNumber(treeItemThing.checkboxState) ? treeItemThing.checkboxState : isObject(treeItemThing.checkboxState) && isNumber(treeItemThing.checkboxState.state) ? treeItemThing.checkboxState.state : void 0;
      const tooltip = !isNumber(treeItemThing.checkboxState) && isObject(treeItemThing.checkboxState) ? treeItemThing.checkboxState.tooltip : void 0;
      if (checkbox === void 0 || checkbox !== 1 /* Checked */ && checkbox !== 0 /* Unchecked */ || tooltip !== void 0 && !isString(tooltip)) {
        console.log("INVALID tree item, invalid checkboxState", treeItemThing.checkboxState);
        return false;
      }
    }
    if (thing instanceof TreeItem) {
      return true;
    }
    if (treeItemThing.label !== void 0 && !isString(treeItemThing.label) && !treeItemThing.label?.label) {
      console.log("INVALID tree item, invalid label", treeItemThing.label);
      return false;
    }
    if (treeItemThing.id !== void 0 && !isString(treeItemThing.id)) {
      console.log("INVALID tree item, invalid id", treeItemThing.id);
      return false;
    }
    if (treeItemThing.iconPath !== void 0 && !isString(treeItemThing.iconPath) && !URI.isUri(treeItemThing.iconPath) && (!treeItemThing.iconPath || !isString(treeItemThing.iconPath.id))) {
      const asLightAndDarkThing = treeItemThing.iconPath;
      if (!asLightAndDarkThing || !isString(asLightAndDarkThing.light) && !URI.isUri(asLightAndDarkThing.light) && !isString(asLightAndDarkThing.dark) && !URI.isUri(asLightAndDarkThing.dark)) {
        console.log("INVALID tree item, invalid iconPath", treeItemThing.iconPath);
        return false;
      }
    }
    if (treeItemThing.description !== void 0 && !isString(treeItemThing.description) && typeof treeItemThing.description !== "boolean") {
      console.log("INVALID tree item, invalid description", treeItemThing.description);
      return false;
    }
    if (treeItemThing.resourceUri !== void 0 && !URI.isUri(treeItemThing.resourceUri)) {
      console.log("INVALID tree item, invalid resourceUri", treeItemThing.resourceUri);
      return false;
    }
    if (treeItemThing.tooltip !== void 0 && !isString(treeItemThing.tooltip) && !(treeItemThing.tooltip instanceof MarkdownString)) {
      console.log("INVALID tree item, invalid tooltip", treeItemThing.tooltip);
      return false;
    }
    if (treeItemThing.command !== void 0 && !treeItemThing.command.command) {
      console.log("INVALID tree item, invalid command", treeItemThing.command);
      return false;
    }
    if (treeItemThing.collapsibleState !== void 0 && treeItemThing.collapsibleState < 0 /* None */ && treeItemThing.collapsibleState > 2 /* Expanded */) {
      console.log("INVALID tree item, invalid collapsibleState", treeItemThing.collapsibleState);
      return false;
    }
    if (treeItemThing.contextValue !== void 0 && !isString(treeItemThing.contextValue)) {
      console.log("INVALID tree item, invalid contextValue", treeItemThing.contextValue);
      return false;
    }
    if (treeItemThing.accessibilityInformation !== void 0 && !treeItemThing.accessibilityInformation?.label) {
      console.log("INVALID tree item, invalid accessibilityInformation", treeItemThing.accessibilityInformation);
      return false;
    }
    return true;
  }
};
TreeItem = __decorateClass([
  es5ClassCompat
], TreeItem);
var TreeItemCollapsibleState = /* @__PURE__ */ ((TreeItemCollapsibleState2) => {
  TreeItemCollapsibleState2[TreeItemCollapsibleState2["None"] = 0] = "None";
  TreeItemCollapsibleState2[TreeItemCollapsibleState2["Collapsed"] = 1] = "Collapsed";
  TreeItemCollapsibleState2[TreeItemCollapsibleState2["Expanded"] = 2] = "Expanded";
  return TreeItemCollapsibleState2;
})(TreeItemCollapsibleState || {});
var TreeItemCheckboxState = /* @__PURE__ */ ((TreeItemCheckboxState2) => {
  TreeItemCheckboxState2[TreeItemCheckboxState2["Unchecked"] = 0] = "Unchecked";
  TreeItemCheckboxState2[TreeItemCheckboxState2["Checked"] = 1] = "Checked";
  return TreeItemCheckboxState2;
})(TreeItemCheckboxState || {});
let DataTransferItem = class {
  constructor(value) {
    this.value = value;
  }
  async asString() {
    return typeof this.value === "string" ? this.value : JSON.stringify(this.value);
  }
  asFile() {
    return void 0;
  }
};
DataTransferItem = __decorateClass([
  es5ClassCompat
], DataTransferItem);
class InternalDataTransferItem extends DataTransferItem {
}
class InternalFileDataTransferItem extends InternalDataTransferItem {
  #file;
  constructor(file) {
    super("");
    this.#file = file;
  }
  asFile() {
    return this.#file;
  }
}
class DataTransferFile {
  constructor(name, uri, itemId, getData) {
    this.name = name;
    this.uri = uri;
    this._itemId = itemId;
    this._getData = getData;
  }
  data() {
    return this._getData();
  }
}
let DataTransfer = class {
  constructor(init) {
    __privateAdd(this, _DataTransfer_instances);
    __privateAdd(this, _items, /* @__PURE__ */ new Map());
    for (const [mime, item] of init ?? []) {
      const existing = __privateGet(this, _items).get(__privateMethod(this, _DataTransfer_instances, normalizeMime_fn).call(this, mime));
      if (existing) {
        existing.push(item);
      } else {
        __privateGet(this, _items).set(__privateMethod(this, _DataTransfer_instances, normalizeMime_fn).call(this, mime), [item]);
      }
    }
  }
  get(mimeType) {
    return __privateGet(this, _items).get(__privateMethod(this, _DataTransfer_instances, normalizeMime_fn).call(this, mimeType))?.[0];
  }
  set(mimeType, value) {
    __privateGet(this, _items).set(__privateMethod(this, _DataTransfer_instances, normalizeMime_fn).call(this, mimeType), [value]);
  }
  forEach(callbackfn, thisArg) {
    for (const [mime, items] of __privateGet(this, _items)) {
      for (const item of items) {
        callbackfn.call(thisArg, item, mime, this);
      }
    }
  }
  *[Symbol.iterator]() {
    for (const [mime, items] of __privateGet(this, _items)) {
      for (const item of items) {
        yield [mime, item];
      }
    }
  }
};
_items = new WeakMap();
_DataTransfer_instances = new WeakSet();
normalizeMime_fn = function(mimeType) {
  return mimeType.toLowerCase();
};
DataTransfer = __decorateClass([
  es5ClassCompat
], DataTransfer);
let DocumentDropEdit = class {
  constructor(insertText, title, kind) {
    this.insertText = insertText;
    this.title = title;
    this.kind = kind;
  }
};
DocumentDropEdit = __decorateClass([
  es5ClassCompat
], DocumentDropEdit);
var DocumentPasteTriggerKind = /* @__PURE__ */ ((DocumentPasteTriggerKind2) => {
  DocumentPasteTriggerKind2[DocumentPasteTriggerKind2["Automatic"] = 0] = "Automatic";
  DocumentPasteTriggerKind2[DocumentPasteTriggerKind2["PasteAs"] = 1] = "PasteAs";
  return DocumentPasteTriggerKind2;
})(DocumentPasteTriggerKind || {});
const _DocumentDropOrPasteEditKind = class _DocumentDropOrPasteEditKind {
  constructor(value) {
    this.value = value;
  }
  append(...parts) {
    return new _DocumentDropOrPasteEditKind((this.value ? [this.value, ...parts] : parts).join(_DocumentDropOrPasteEditKind.sep));
  }
  intersects(other) {
    return this.contains(other) || other.contains(this);
  }
  contains(other) {
    return this.value === other.value || other.value.startsWith(this.value + _DocumentDropOrPasteEditKind.sep);
  }
};
_DocumentDropOrPasteEditKind.sep = ".";
let DocumentDropOrPasteEditKind = _DocumentDropOrPasteEditKind;
DocumentDropOrPasteEditKind.Empty = new DocumentDropOrPasteEditKind("");
DocumentDropOrPasteEditKind.Text = new DocumentDropOrPasteEditKind("text");
DocumentDropOrPasteEditKind.TextUpdateImports = DocumentDropOrPasteEditKind.Text.append("updateImports");
class DocumentPasteEdit {
  constructor(insertText, title, kind) {
    this.title = title;
    this.insertText = insertText;
    this.kind = kind;
  }
}
let ThemeIcon = class {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
  static isThemeIcon(thing) {
    if (typeof thing.id !== "string") {
      console.log("INVALID ThemeIcon, invalid id", thing.id);
      return false;
    }
    return true;
  }
};
ThemeIcon = __decorateClass([
  es5ClassCompat
], ThemeIcon);
ThemeIcon.File = new ThemeIcon("file");
ThemeIcon.Folder = new ThemeIcon("folder");
let ThemeColor = class {
  constructor(id) {
    this.id = id;
  }
};
ThemeColor = __decorateClass([
  es5ClassCompat
], ThemeColor);
var ConfigurationTarget = /* @__PURE__ */ ((ConfigurationTarget2) => {
  ConfigurationTarget2[ConfigurationTarget2["Global"] = 1] = "Global";
  ConfigurationTarget2[ConfigurationTarget2["Workspace"] = 2] = "Workspace";
  ConfigurationTarget2[ConfigurationTarget2["WorkspaceFolder"] = 3] = "WorkspaceFolder";
  return ConfigurationTarget2;
})(ConfigurationTarget || {});
let RelativePattern = class {
  get base() {
    return this._base;
  }
  set base(base) {
    this._base = base;
    this._baseUri = URI.file(base);
  }
  get baseUri() {
    return this._baseUri;
  }
  set baseUri(baseUri) {
    this._baseUri = baseUri;
    this._base = baseUri.fsPath;
  }
  constructor(base, pattern) {
    if (typeof base !== "string") {
      if (!base || !URI.isUri(base) && !URI.isUri(base.uri)) {
        throw illegalArgument("base");
      }
    }
    if (typeof pattern !== "string") {
      throw illegalArgument("pattern");
    }
    if (typeof base === "string") {
      this.baseUri = URI.file(base);
    } else if (URI.isUri(base)) {
      this.baseUri = base;
    } else {
      this.baseUri = base.uri;
    }
    this.pattern = pattern;
  }
  toJSON() {
    return {
      pattern: this.pattern,
      base: this.base,
      baseUri: this.baseUri.toJSON()
    };
  }
};
RelativePattern = __decorateClass([
  es5ClassCompat
], RelativePattern);
const breakpointIds = /* @__PURE__ */ new WeakMap();
function setBreakpointId(bp, id) {
  breakpointIds.set(bp, id);
}
let Breakpoint = class {
  constructor(enabled, condition, hitCondition, logMessage, mode) {
    this.enabled = typeof enabled === "boolean" ? enabled : true;
    if (typeof condition === "string") {
      this.condition = condition;
    }
    if (typeof hitCondition === "string") {
      this.hitCondition = hitCondition;
    }
    if (typeof logMessage === "string") {
      this.logMessage = logMessage;
    }
    if (typeof mode === "string") {
      this.mode = mode;
    }
  }
  get id() {
    if (!this._id) {
      this._id = breakpointIds.get(this) ?? generateUuid();
    }
    return this._id;
  }
};
Breakpoint = __decorateClass([
  es5ClassCompat
], Breakpoint);
let SourceBreakpoint = class extends Breakpoint {
  constructor(location, enabled, condition, hitCondition, logMessage, mode) {
    super(enabled, condition, hitCondition, logMessage, mode);
    if (location === null) {
      throw illegalArgument("location");
    }
    this.location = location;
  }
};
SourceBreakpoint = __decorateClass([
  es5ClassCompat
], SourceBreakpoint);
let FunctionBreakpoint = class extends Breakpoint {
  constructor(functionName, enabled, condition, hitCondition, logMessage, mode) {
    super(enabled, condition, hitCondition, logMessage, mode);
    this.functionName = functionName;
  }
};
FunctionBreakpoint = __decorateClass([
  es5ClassCompat
], FunctionBreakpoint);
let DataBreakpoint = class extends Breakpoint {
  constructor(label, dataId, canPersist, enabled, condition, hitCondition, logMessage, mode) {
    super(enabled, condition, hitCondition, logMessage, mode);
    if (!dataId) {
      throw illegalArgument("dataId");
    }
    this.label = label;
    this.dataId = dataId;
    this.canPersist = canPersist;
  }
};
DataBreakpoint = __decorateClass([
  es5ClassCompat
], DataBreakpoint);
let DebugAdapterExecutable = class {
  constructor(command, args, options) {
    this.command = command;
    this.args = args || [];
    this.options = options;
  }
};
DebugAdapterExecutable = __decorateClass([
  es5ClassCompat
], DebugAdapterExecutable);
let DebugAdapterServer = class {
  constructor(port, host) {
    this.port = port;
    this.host = host;
  }
};
DebugAdapterServer = __decorateClass([
  es5ClassCompat
], DebugAdapterServer);
let DebugAdapterNamedPipeServer = class {
  constructor(path) {
    this.path = path;
  }
};
DebugAdapterNamedPipeServer = __decorateClass([
  es5ClassCompat
], DebugAdapterNamedPipeServer);
let DebugAdapterInlineImplementation = class {
  constructor(impl) {
    this.implementation = impl;
  }
};
DebugAdapterInlineImplementation = __decorateClass([
  es5ClassCompat
], DebugAdapterInlineImplementation);
class DebugStackFrame {
  constructor(session, threadId, frameId) {
    this.session = session;
    this.threadId = threadId;
    this.frameId = frameId;
  }
}
class DebugThread {
  constructor(session, threadId) {
    this.session = session;
    this.threadId = threadId;
  }
}
let EvaluatableExpression = class {
  constructor(range, expression) {
    this.range = range;
    this.expression = expression;
  }
};
EvaluatableExpression = __decorateClass([
  es5ClassCompat
], EvaluatableExpression);
var InlineCompletionTriggerKind = /* @__PURE__ */ ((InlineCompletionTriggerKind2) => {
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Invoke"] = 0] = "Invoke";
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Automatic"] = 1] = "Automatic";
  return InlineCompletionTriggerKind2;
})(InlineCompletionTriggerKind || {});
let InlineValueText = class {
  constructor(range, text) {
    this.range = range;
    this.text = text;
  }
};
InlineValueText = __decorateClass([
  es5ClassCompat
], InlineValueText);
let InlineValueVariableLookup = class {
  constructor(range, variableName, caseSensitiveLookup = true) {
    this.range = range;
    this.variableName = variableName;
    this.caseSensitiveLookup = caseSensitiveLookup;
  }
};
InlineValueVariableLookup = __decorateClass([
  es5ClassCompat
], InlineValueVariableLookup);
let InlineValueEvaluatableExpression = class {
  constructor(range, expression) {
    this.range = range;
    this.expression = expression;
  }
};
InlineValueEvaluatableExpression = __decorateClass([
  es5ClassCompat
], InlineValueEvaluatableExpression);
let InlineValueContext = class {
  constructor(frameId, range) {
    this.frameId = frameId;
    this.stoppedLocation = range;
  }
};
InlineValueContext = __decorateClass([
  es5ClassCompat
], InlineValueContext);
var NewSymbolNameTag = /* @__PURE__ */ ((NewSymbolNameTag2) => {
  NewSymbolNameTag2[NewSymbolNameTag2["AIGenerated"] = 1] = "AIGenerated";
  return NewSymbolNameTag2;
})(NewSymbolNameTag || {});
var NewSymbolNameTriggerKind = /* @__PURE__ */ ((NewSymbolNameTriggerKind2) => {
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Invoke"] = 0] = "Invoke";
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Automatic"] = 1] = "Automatic";
  return NewSymbolNameTriggerKind2;
})(NewSymbolNameTriggerKind || {});
class NewSymbolName {
  constructor(newSymbolName, tags) {
    this.newSymbolName = newSymbolName;
    this.tags = tags;
  }
}
var FileChangeType = /* @__PURE__ */ ((FileChangeType2) => {
  FileChangeType2[FileChangeType2["Changed"] = 1] = "Changed";
  FileChangeType2[FileChangeType2["Created"] = 2] = "Created";
  FileChangeType2[FileChangeType2["Deleted"] = 3] = "Deleted";
  return FileChangeType2;
})(FileChangeType || {});
let FileSystemError = class extends Error {
  static FileExists(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileExists, FileSystemError.FileExists);
  }
  static FileNotFound(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileNotFound, FileSystemError.FileNotFound);
  }
  static FileNotADirectory(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileNotADirectory, FileSystemError.FileNotADirectory);
  }
  static FileIsADirectory(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileIsADirectory, FileSystemError.FileIsADirectory);
  }
  static NoPermissions(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.NoPermissions, FileSystemError.NoPermissions);
  }
  static Unavailable(messageOrUri) {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.Unavailable, FileSystemError.Unavailable);
  }
  constructor(uriOrMessage, code = FileSystemProviderErrorCode.Unknown, terminator) {
    super(URI.isUri(uriOrMessage) ? uriOrMessage.toString(true) : uriOrMessage);
    this.code = terminator?.name ?? "Unknown";
    markAsFileSystemProviderError(this, code);
    Object.setPrototypeOf(this, FileSystemError.prototype);
    if (typeof Error.captureStackTrace === "function" && typeof terminator === "function") {
      Error.captureStackTrace(this, terminator);
    }
  }
};
FileSystemError = __decorateClass([
  es5ClassCompat
], FileSystemError);
let FoldingRange = class {
  constructor(start, end, kind) {
    this.start = start;
    this.end = end;
    this.kind = kind;
  }
};
FoldingRange = __decorateClass([
  es5ClassCompat
], FoldingRange);
var FoldingRangeKind = /* @__PURE__ */ ((FoldingRangeKind2) => {
  FoldingRangeKind2[FoldingRangeKind2["Comment"] = 1] = "Comment";
  FoldingRangeKind2[FoldingRangeKind2["Imports"] = 2] = "Imports";
  FoldingRangeKind2[FoldingRangeKind2["Region"] = 3] = "Region";
  return FoldingRangeKind2;
})(FoldingRangeKind || {});
var CommentThreadCollapsibleState = /* @__PURE__ */ ((CommentThreadCollapsibleState2) => {
  CommentThreadCollapsibleState2[CommentThreadCollapsibleState2["Collapsed"] = 0] = "Collapsed";
  CommentThreadCollapsibleState2[CommentThreadCollapsibleState2["Expanded"] = 1] = "Expanded";
  return CommentThreadCollapsibleState2;
})(CommentThreadCollapsibleState || {});
var CommentMode = /* @__PURE__ */ ((CommentMode2) => {
  CommentMode2[CommentMode2["Editing"] = 0] = "Editing";
  CommentMode2[CommentMode2["Preview"] = 1] = "Preview";
  return CommentMode2;
})(CommentMode || {});
var CommentState = /* @__PURE__ */ ((CommentState2) => {
  CommentState2[CommentState2["Published"] = 0] = "Published";
  CommentState2[CommentState2["Draft"] = 1] = "Draft";
  return CommentState2;
})(CommentState || {});
var CommentThreadState = /* @__PURE__ */ ((CommentThreadState2) => {
  CommentThreadState2[CommentThreadState2["Unresolved"] = 0] = "Unresolved";
  CommentThreadState2[CommentThreadState2["Resolved"] = 1] = "Resolved";
  return CommentThreadState2;
})(CommentThreadState || {});
var CommentThreadApplicability = /* @__PURE__ */ ((CommentThreadApplicability2) => {
  CommentThreadApplicability2[CommentThreadApplicability2["Current"] = 0] = "Current";
  CommentThreadApplicability2[CommentThreadApplicability2["Outdated"] = 1] = "Outdated";
  return CommentThreadApplicability2;
})(CommentThreadApplicability || {});
var CommentThreadFocus = /* @__PURE__ */ ((CommentThreadFocus2) => {
  CommentThreadFocus2[CommentThreadFocus2["Reply"] = 1] = "Reply";
  CommentThreadFocus2[CommentThreadFocus2["Comment"] = 2] = "Comment";
  return CommentThreadFocus2;
})(CommentThreadFocus || {});
class SemanticTokensLegend {
  constructor(tokenTypes, tokenModifiers = []) {
    this.tokenTypes = tokenTypes;
    this.tokenModifiers = tokenModifiers;
  }
}
function isStrArrayOrUndefined(arg) {
  return typeof arg === "undefined" || isStringArray(arg);
}
class SemanticTokensBuilder {
  constructor(legend) {
    this._prevLine = 0;
    this._prevChar = 0;
    this._dataIsSortedAndDeltaEncoded = true;
    this._data = [];
    this._dataLen = 0;
    this._tokenTypeStrToInt = /* @__PURE__ */ new Map();
    this._tokenModifierStrToInt = /* @__PURE__ */ new Map();
    this._hasLegend = false;
    if (legend) {
      this._hasLegend = true;
      for (let i = 0, len = legend.tokenTypes.length; i < len; i++) {
        this._tokenTypeStrToInt.set(legend.tokenTypes[i], i);
      }
      for (let i = 0, len = legend.tokenModifiers.length; i < len; i++) {
        this._tokenModifierStrToInt.set(legend.tokenModifiers[i], i);
      }
    }
  }
  push(arg0, arg1, arg2, arg3, arg4) {
    if (typeof arg0 === "number" && typeof arg1 === "number" && typeof arg2 === "number" && typeof arg3 === "number" && (typeof arg4 === "number" || typeof arg4 === "undefined")) {
      if (typeof arg4 === "undefined") {
        arg4 = 0;
      }
      return this._pushEncoded(arg0, arg1, arg2, arg3, arg4);
    }
    if (Range.isRange(arg0) && typeof arg1 === "string" && isStrArrayOrUndefined(arg2)) {
      return this._push(arg0, arg1, arg2);
    }
    throw illegalArgument();
  }
  _push(range, tokenType, tokenModifiers) {
    if (!this._hasLegend) {
      throw new Error("Legend must be provided in constructor");
    }
    if (range.start.line !== range.end.line) {
      throw new Error("`range` cannot span multiple lines");
    }
    if (!this._tokenTypeStrToInt.has(tokenType)) {
      throw new Error("`tokenType` is not in the provided legend");
    }
    const line = range.start.line;
    const char = range.start.character;
    const length = range.end.character - range.start.character;
    const nTokenType = this._tokenTypeStrToInt.get(tokenType);
    let nTokenModifiers = 0;
    if (tokenModifiers) {
      for (const tokenModifier of tokenModifiers) {
        if (!this._tokenModifierStrToInt.has(tokenModifier)) {
          throw new Error("`tokenModifier` is not in the provided legend");
        }
        const nTokenModifier = this._tokenModifierStrToInt.get(tokenModifier);
        nTokenModifiers |= 1 << nTokenModifier >>> 0;
      }
    }
    this._pushEncoded(line, char, length, nTokenType, nTokenModifiers);
  }
  _pushEncoded(line, char, length, tokenType, tokenModifiers) {
    if (this._dataIsSortedAndDeltaEncoded && (line < this._prevLine || line === this._prevLine && char < this._prevChar)) {
      this._dataIsSortedAndDeltaEncoded = false;
      const tokenCount = this._data.length / 5 | 0;
      let prevLine = 0;
      let prevChar = 0;
      for (let i = 0; i < tokenCount; i++) {
        let line2 = this._data[5 * i];
        let char2 = this._data[5 * i + 1];
        if (line2 === 0) {
          line2 = prevLine;
          char2 += prevChar;
        } else {
          line2 += prevLine;
        }
        this._data[5 * i] = line2;
        this._data[5 * i + 1] = char2;
        prevLine = line2;
        prevChar = char2;
      }
    }
    let pushLine = line;
    let pushChar = char;
    if (this._dataIsSortedAndDeltaEncoded && this._dataLen > 0) {
      pushLine -= this._prevLine;
      if (pushLine === 0) {
        pushChar -= this._prevChar;
      }
    }
    this._data[this._dataLen++] = pushLine;
    this._data[this._dataLen++] = pushChar;
    this._data[this._dataLen++] = length;
    this._data[this._dataLen++] = tokenType;
    this._data[this._dataLen++] = tokenModifiers;
    this._prevLine = line;
    this._prevChar = char;
  }
  static _sortAndDeltaEncode(data) {
    const pos = [];
    const tokenCount = data.length / 5 | 0;
    for (let i = 0; i < tokenCount; i++) {
      pos[i] = i;
    }
    pos.sort((a, b) => {
      const aLine = data[5 * a];
      const bLine = data[5 * b];
      if (aLine === bLine) {
        const aChar = data[5 * a + 1];
        const bChar = data[5 * b + 1];
        return aChar - bChar;
      }
      return aLine - bLine;
    });
    const result = new Uint32Array(data.length);
    let prevLine = 0;
    let prevChar = 0;
    for (let i = 0; i < tokenCount; i++) {
      const srcOffset = 5 * pos[i];
      const line = data[srcOffset + 0];
      const char = data[srcOffset + 1];
      const length = data[srcOffset + 2];
      const tokenType = data[srcOffset + 3];
      const tokenModifiers = data[srcOffset + 4];
      const pushLine = line - prevLine;
      const pushChar = pushLine === 0 ? char - prevChar : char;
      const dstOffset = 5 * i;
      result[dstOffset + 0] = pushLine;
      result[dstOffset + 1] = pushChar;
      result[dstOffset + 2] = length;
      result[dstOffset + 3] = tokenType;
      result[dstOffset + 4] = tokenModifiers;
      prevLine = line;
      prevChar = char;
    }
    return result;
  }
  build(resultId) {
    if (!this._dataIsSortedAndDeltaEncoded) {
      return new SemanticTokens(SemanticTokensBuilder._sortAndDeltaEncode(this._data), resultId);
    }
    return new SemanticTokens(new Uint32Array(this._data), resultId);
  }
}
class SemanticTokens {
  constructor(data, resultId) {
    this.resultId = resultId;
    this.data = data;
  }
}
class SemanticTokensEdit {
  constructor(start, deleteCount, data) {
    this.start = start;
    this.deleteCount = deleteCount;
    this.data = data;
  }
}
class SemanticTokensEdits {
  constructor(edits, resultId) {
    this.resultId = resultId;
    this.edits = edits;
  }
}
var DebugConsoleMode = /* @__PURE__ */ ((DebugConsoleMode2) => {
  DebugConsoleMode2[DebugConsoleMode2["Separate"] = 0] = "Separate";
  DebugConsoleMode2[DebugConsoleMode2["MergeWithParent"] = 1] = "MergeWithParent";
  return DebugConsoleMode2;
})(DebugConsoleMode || {});
class DebugVisualization {
  constructor(name) {
    this.name = name;
  }
}
var QuickInputButtonLocation = /* @__PURE__ */ ((QuickInputButtonLocation2) => {
  QuickInputButtonLocation2[QuickInputButtonLocation2["Title"] = 1] = "Title";
  QuickInputButtonLocation2[QuickInputButtonLocation2["Inline"] = 2] = "Inline";
  return QuickInputButtonLocation2;
})(QuickInputButtonLocation || {});
let QuickInputButtons = class {
  constructor() {
  }
};
QuickInputButtons.Back = { iconPath: new ThemeIcon("arrow-left") };
QuickInputButtons = __decorateClass([
  es5ClassCompat
], QuickInputButtons);
var QuickPickItemKind = /* @__PURE__ */ ((QuickPickItemKind2) => {
  QuickPickItemKind2[QuickPickItemKind2["Separator"] = -1] = "Separator";
  QuickPickItemKind2[QuickPickItemKind2["Default"] = 0] = "Default";
  return QuickPickItemKind2;
})(QuickPickItemKind || {});
var InputBoxValidationSeverity = /* @__PURE__ */ ((InputBoxValidationSeverity2) => {
  InputBoxValidationSeverity2[InputBoxValidationSeverity2["Info"] = 1] = "Info";
  InputBoxValidationSeverity2[InputBoxValidationSeverity2["Warning"] = 2] = "Warning";
  InputBoxValidationSeverity2[InputBoxValidationSeverity2["Error"] = 3] = "Error";
  return InputBoxValidationSeverity2;
})(InputBoxValidationSeverity || {});
var ExtensionKind = /* @__PURE__ */ ((ExtensionKind2) => {
  ExtensionKind2[ExtensionKind2["UI"] = 1] = "UI";
  ExtensionKind2[ExtensionKind2["Workspace"] = 2] = "Workspace";
  return ExtensionKind2;
})(ExtensionKind || {});
class FileDecoration {
  static validate(d) {
    if (typeof d.badge === "string") {
      let len = nextCharLength(d.badge, 0);
      if (len < d.badge.length) {
        len += nextCharLength(d.badge, len);
      }
      if (d.badge.length > len) {
        throw new Error(`The 'badge'-property must be undefined or a short character`);
      }
    } else if (d.badge) {
      if (!ThemeIcon.isThemeIcon(d.badge)) {
        throw new Error(`The 'badge'-property is not a valid ThemeIcon`);
      }
    }
    if (!d.color && !d.badge && !d.tooltip) {
      throw new Error(`The decoration is empty`);
    }
    return true;
  }
  constructor(badge, tooltip, color) {
    this.badge = badge;
    this.tooltip = tooltip;
    this.color = color;
  }
}
let ColorTheme = class {
  constructor(kind) {
    this.kind = kind;
  }
};
ColorTheme = __decorateClass([
  es5ClassCompat
], ColorTheme);
var ColorThemeKind = /* @__PURE__ */ ((ColorThemeKind2) => {
  ColorThemeKind2[ColorThemeKind2["Light"] = 1] = "Light";
  ColorThemeKind2[ColorThemeKind2["Dark"] = 2] = "Dark";
  ColorThemeKind2[ColorThemeKind2["HighContrast"] = 3] = "HighContrast";
  ColorThemeKind2[ColorThemeKind2["HighContrastLight"] = 4] = "HighContrastLight";
  return ColorThemeKind2;
})(ColorThemeKind || {});
class NotebookRange {
  static isNotebookRange(thing) {
    if (thing instanceof NotebookRange) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return typeof thing.start === "number" && typeof thing.end === "number";
  }
  get start() {
    return this._start;
  }
  get end() {
    return this._end;
  }
  get isEmpty() {
    return this._start === this._end;
  }
  constructor(start, end) {
    if (start < 0) {
      throw illegalArgument("start must be positive");
    }
    if (end < 0) {
      throw illegalArgument("end must be positive");
    }
    if (start <= end) {
      this._start = start;
      this._end = end;
    } else {
      this._start = end;
      this._end = start;
    }
  }
  with(change) {
    let start = this._start;
    let end = this._end;
    if (change.start !== void 0) {
      start = change.start;
    }
    if (change.end !== void 0) {
      end = change.end;
    }
    if (start === this._start && end === this._end) {
      return this;
    }
    return new NotebookRange(start, end);
  }
}
class NotebookCellData {
  static validate(data) {
    if (typeof data.kind !== "number") {
      throw new Error("NotebookCellData MUST have 'kind' property");
    }
    if (typeof data.value !== "string") {
      throw new Error("NotebookCellData MUST have 'value' property");
    }
    if (typeof data.languageId !== "string") {
      throw new Error("NotebookCellData MUST have 'languageId' property");
    }
  }
  static isNotebookCellDataArray(value) {
    return Array.isArray(value) && value.every((elem) => NotebookCellData.isNotebookCellData(elem));
  }
  static isNotebookCellData(value) {
    return true;
  }
  constructor(kind, value, languageId, mime, outputs, metadata, executionSummary) {
    this.kind = kind;
    this.value = value;
    this.languageId = languageId;
    this.mime = mime;
    this.outputs = outputs ?? [];
    this.metadata = metadata;
    this.executionSummary = executionSummary;
    NotebookCellData.validate(this);
  }
}
class NotebookData {
  constructor(cells) {
    this.cells = cells;
  }
}
class NotebookCellOutputItem {
  constructor(data, mime) {
    this.data = data;
    this.mime = mime;
    const mimeNormalized = normalizeMimeType(mime, true);
    if (!mimeNormalized) {
      throw new Error(`INVALID mime type: ${mime}. Must be in the format "type/subtype[;optionalparameter]"`);
    }
    this.mime = mimeNormalized;
  }
  static isNotebookCellOutputItem(obj) {
    if (obj instanceof NotebookCellOutputItem) {
      return true;
    }
    if (!obj) {
      return false;
    }
    return typeof obj.mime === "string" && obj.data instanceof Uint8Array;
  }
  static error(err) {
    const obj = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
    return NotebookCellOutputItem.json(obj, "application/vnd.code.notebook.error");
  }
  static stdout(value) {
    return NotebookCellOutputItem.text(value, "application/vnd.code.notebook.stdout");
  }
  static stderr(value) {
    return NotebookCellOutputItem.text(value, "application/vnd.code.notebook.stderr");
  }
  static bytes(value, mime = "application/octet-stream") {
    return new NotebookCellOutputItem(value, mime);
  }
  static #encoder = new TextEncoder();
  static text(value, mime = Mimes.text) {
    const bytes = NotebookCellOutputItem.#encoder.encode(String(value));
    return new NotebookCellOutputItem(bytes, mime);
  }
  static json(value, mime = "text/x-json") {
    const rawStr = JSON.stringify(value, void 0, "	");
    return NotebookCellOutputItem.text(rawStr, mime);
  }
}
class NotebookCellOutput {
  static isNotebookCellOutput(candidate) {
    if (candidate instanceof NotebookCellOutput) {
      return true;
    }
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    return typeof candidate.id === "string" && Array.isArray(candidate.items);
  }
  static ensureUniqueMimeTypes(items, warn = false) {
    const seen = /* @__PURE__ */ new Set();
    const removeIdx = /* @__PURE__ */ new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normalMime = normalizeMimeType(item.mime);
      if (!seen.has(normalMime) || isTextStreamMime(normalMime)) {
        seen.add(normalMime);
        continue;
      }
      removeIdx.add(i);
      if (warn) {
        console.warn(`DUPLICATED mime type '${item.mime}' will be dropped`);
      }
    }
    if (removeIdx.size === 0) {
      return items;
    }
    return items.filter((_item, index) => !removeIdx.has(index));
  }
  constructor(items, idOrMetadata, metadata) {
    this.items = NotebookCellOutput.ensureUniqueMimeTypes(items, true);
    if (typeof idOrMetadata === "string") {
      this.id = idOrMetadata;
      this.metadata = metadata;
    } else {
      this.id = generateUuid();
      this.metadata = idOrMetadata ?? metadata;
    }
  }
}
class CellErrorStackFrame {
  /**
   * @param label The name of the stack frame
   * @param file The file URI of the stack frame
   * @param position The position of the stack frame within the file
   */
  constructor(label, uri, position) {
    this.label = label;
    this.uri = uri;
    this.position = position;
  }
}
var NotebookCellKind = /* @__PURE__ */ ((NotebookCellKind2) => {
  NotebookCellKind2[NotebookCellKind2["Markup"] = 1] = "Markup";
  NotebookCellKind2[NotebookCellKind2["Code"] = 2] = "Code";
  return NotebookCellKind2;
})(NotebookCellKind || {});
var NotebookCellExecutionState = /* @__PURE__ */ ((NotebookCellExecutionState2) => {
  NotebookCellExecutionState2[NotebookCellExecutionState2["Idle"] = 1] = "Idle";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Pending"] = 2] = "Pending";
  NotebookCellExecutionState2[NotebookCellExecutionState2["Executing"] = 3] = "Executing";
  return NotebookCellExecutionState2;
})(NotebookCellExecutionState || {});
var NotebookCellStatusBarAlignment = /* @__PURE__ */ ((NotebookCellStatusBarAlignment2) => {
  NotebookCellStatusBarAlignment2[NotebookCellStatusBarAlignment2["Left"] = 1] = "Left";
  NotebookCellStatusBarAlignment2[NotebookCellStatusBarAlignment2["Right"] = 2] = "Right";
  return NotebookCellStatusBarAlignment2;
})(NotebookCellStatusBarAlignment || {});
var NotebookEditorRevealType = /* @__PURE__ */ ((NotebookEditorRevealType2) => {
  NotebookEditorRevealType2[NotebookEditorRevealType2["Default"] = 0] = "Default";
  NotebookEditorRevealType2[NotebookEditorRevealType2["InCenter"] = 1] = "InCenter";
  NotebookEditorRevealType2[NotebookEditorRevealType2["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
  NotebookEditorRevealType2[NotebookEditorRevealType2["AtTop"] = 3] = "AtTop";
  return NotebookEditorRevealType2;
})(NotebookEditorRevealType || {});
class NotebookCellStatusBarItem {
  constructor(text, alignment) {
    this.text = text;
    this.alignment = alignment;
  }
}
var NotebookControllerAffinity = /* @__PURE__ */ ((NotebookControllerAffinity3) => {
  NotebookControllerAffinity3[NotebookControllerAffinity3["Default"] = 1] = "Default";
  NotebookControllerAffinity3[NotebookControllerAffinity3["Preferred"] = 2] = "Preferred";
  return NotebookControllerAffinity3;
})(NotebookControllerAffinity || {});
var NotebookControllerAffinity2 = /* @__PURE__ */ ((NotebookControllerAffinity22) => {
  NotebookControllerAffinity22[NotebookControllerAffinity22["Default"] = 1] = "Default";
  NotebookControllerAffinity22[NotebookControllerAffinity22["Preferred"] = 2] = "Preferred";
  NotebookControllerAffinity22[NotebookControllerAffinity22["Hidden"] = -1] = "Hidden";
  return NotebookControllerAffinity22;
})(NotebookControllerAffinity2 || {});
class NotebookRendererScript {
  constructor(uri, provides = []) {
    this.uri = uri;
    this.provides = asArray(provides);
  }
}
class NotebookKernelSourceAction {
  constructor(label) {
    this.label = label;
  }
}
var NotebookVariablesRequestKind = /* @__PURE__ */ ((NotebookVariablesRequestKind2) => {
  NotebookVariablesRequestKind2[NotebookVariablesRequestKind2["Named"] = 1] = "Named";
  NotebookVariablesRequestKind2[NotebookVariablesRequestKind2["Indexed"] = 2] = "Indexed";
  return NotebookVariablesRequestKind2;
})(NotebookVariablesRequestKind || {});
let TimelineItem = class {
  constructor(label, timestamp) {
    this.label = label;
    this.timestamp = timestamp;
  }
};
TimelineItem = __decorateClass([
  es5ClassCompat
], TimelineItem);
var ExtensionMode = /* @__PURE__ */ ((ExtensionMode2) => {
  ExtensionMode2[ExtensionMode2["Production"] = 1] = "Production";
  ExtensionMode2[ExtensionMode2["Development"] = 2] = "Development";
  ExtensionMode2[ExtensionMode2["Test"] = 3] = "Test";
  return ExtensionMode2;
})(ExtensionMode || {});
var ExtensionRuntime = /* @__PURE__ */ ((ExtensionRuntime2) => {
  ExtensionRuntime2[ExtensionRuntime2["Node"] = 1] = "Node";
  ExtensionRuntime2[ExtensionRuntime2["Webworker"] = 2] = "Webworker";
  return ExtensionRuntime2;
})(ExtensionRuntime || {});
var StandardTokenType = /* @__PURE__ */ ((StandardTokenType2) => {
  StandardTokenType2[StandardTokenType2["Other"] = 0] = "Other";
  StandardTokenType2[StandardTokenType2["Comment"] = 1] = "Comment";
  StandardTokenType2[StandardTokenType2["String"] = 2] = "String";
  StandardTokenType2[StandardTokenType2["RegEx"] = 3] = "RegEx";
  return StandardTokenType2;
})(StandardTokenType || {});
class LinkedEditingRanges {
  constructor(ranges, wordPattern) {
    this.ranges = ranges;
    this.wordPattern = wordPattern;
  }
}
class PortAttributes {
  constructor(autoForwardAction) {
    this._autoForwardAction = autoForwardAction;
  }
  get autoForwardAction() {
    return this._autoForwardAction;
  }
}
var TestResultState = /* @__PURE__ */ ((TestResultState2) => {
  TestResultState2[TestResultState2["Queued"] = 1] = "Queued";
  TestResultState2[TestResultState2["Running"] = 2] = "Running";
  TestResultState2[TestResultState2["Passed"] = 3] = "Passed";
  TestResultState2[TestResultState2["Failed"] = 4] = "Failed";
  TestResultState2[TestResultState2["Skipped"] = 5] = "Skipped";
  TestResultState2[TestResultState2["Errored"] = 6] = "Errored";
  return TestResultState2;
})(TestResultState || {});
var TestRunProfileKind = /* @__PURE__ */ ((TestRunProfileKind2) => {
  TestRunProfileKind2[TestRunProfileKind2["Run"] = 1] = "Run";
  TestRunProfileKind2[TestRunProfileKind2["Debug"] = 2] = "Debug";
  TestRunProfileKind2[TestRunProfileKind2["Coverage"] = 3] = "Coverage";
  return TestRunProfileKind2;
})(TestRunProfileKind || {});
class TestRunProfileBase {
  constructor(controllerId, profileId, kind) {
    this.controllerId = controllerId;
    this.profileId = profileId;
    this.kind = kind;
  }
}
let TestRunRequest = class {
  constructor(include = void 0, exclude = void 0, profile = void 0, continuous = false, preserveFocus = true) {
    this.include = include;
    this.exclude = exclude;
    this.profile = profile;
    this.continuous = continuous;
    this.preserveFocus = preserveFocus;
  }
};
TestRunRequest = __decorateClass([
  es5ClassCompat
], TestRunRequest);
let TestMessage = class {
  constructor(message) {
    this.message = message;
  }
  static diff(message, expected, actual) {
    const msg = new TestMessage(message);
    msg.expectedOutput = expected;
    msg.actualOutput = actual;
    return msg;
  }
};
TestMessage = __decorateClass([
  es5ClassCompat
], TestMessage);
let TestTag = class {
  constructor(id) {
    this.id = id;
  }
};
TestTag = __decorateClass([
  es5ClassCompat
], TestTag);
class TestMessageStackFrame {
  /**
   * @param label The name of the stack frame
   * @param file The file URI of the stack frame
   * @param position The position of the stack frame within the file
   */
  constructor(label, uri, position) {
    this.label = label;
    this.uri = uri;
    this.position = position;
  }
}
class TestCoverageCount {
  constructor(covered, total) {
    this.covered = covered;
    this.total = total;
    validateTestCoverageCount(this);
  }
}
function validateTestCoverageCount(cc) {
  if (!cc) {
    return;
  }
  if (cc.covered > cc.total) {
    throw new Error(`The total number of covered items (${cc.covered}) cannot be greater than the total (${cc.total})`);
  }
  if (cc.total < 0) {
    throw new Error(`The number of covered items (${cc.total}) cannot be negative`);
  }
}
class FileCoverage {
  constructor(uri, statementCoverage, branchCoverage, declarationCoverage, includesTests = []) {
    this.uri = uri;
    this.statementCoverage = statementCoverage;
    this.branchCoverage = branchCoverage;
    this.declarationCoverage = declarationCoverage;
    this.includesTests = includesTests;
  }
  static fromDetails(uri, details) {
    const statements = new TestCoverageCount(0, 0);
    const branches = new TestCoverageCount(0, 0);
    const decl = new TestCoverageCount(0, 0);
    for (const detail of details) {
      if ("branches" in detail) {
        statements.total += 1;
        statements.covered += detail.executed ? 1 : 0;
        for (const branch of detail.branches) {
          branches.total += 1;
          branches.covered += branch.executed ? 1 : 0;
        }
      } else {
        decl.total += 1;
        decl.covered += detail.executed ? 1 : 0;
      }
    }
    const coverage = new FileCoverage(
      uri,
      statements,
      branches.total > 0 ? branches : void 0,
      decl.total > 0 ? decl : void 0
    );
    coverage.detailedCoverage = details;
    return coverage;
  }
}
class StatementCoverage {
  constructor(executed, location, branches = []) {
    this.executed = executed;
    this.location = location;
    this.branches = branches;
  }
  // back compat until finalization:
  get executionCount() {
    return +this.executed;
  }
  set executionCount(n) {
    this.executed = n;
  }
}
class BranchCoverage {
  constructor(executed, location, label) {
    this.executed = executed;
    this.location = location;
    this.label = label;
  }
  // back compat until finalization:
  get executionCount() {
    return +this.executed;
  }
  set executionCount(n) {
    this.executed = n;
  }
}
class DeclarationCoverage {
  constructor(name, executed, location) {
    this.name = name;
    this.executed = executed;
    this.location = location;
  }
  // back compat until finalization:
  get executionCount() {
    return +this.executed;
  }
  set executionCount(n) {
    this.executed = n;
  }
}
var ExternalUriOpenerPriority = /* @__PURE__ */ ((ExternalUriOpenerPriority2) => {
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["None"] = 0] = "None";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Option"] = 1] = "Option";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Default"] = 2] = "Default";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Preferred"] = 3] = "Preferred";
  return ExternalUriOpenerPriority2;
})(ExternalUriOpenerPriority || {});
var WorkspaceTrustState = /* @__PURE__ */ ((WorkspaceTrustState2) => {
  WorkspaceTrustState2[WorkspaceTrustState2["Untrusted"] = 0] = "Untrusted";
  WorkspaceTrustState2[WorkspaceTrustState2["Trusted"] = 1] = "Trusted";
  WorkspaceTrustState2[WorkspaceTrustState2["Unspecified"] = 2] = "Unspecified";
  return WorkspaceTrustState2;
})(WorkspaceTrustState || {});
var PortAutoForwardAction = /* @__PURE__ */ ((PortAutoForwardAction2) => {
  PortAutoForwardAction2[PortAutoForwardAction2["Notify"] = 1] = "Notify";
  PortAutoForwardAction2[PortAutoForwardAction2["OpenBrowser"] = 2] = "OpenBrowser";
  PortAutoForwardAction2[PortAutoForwardAction2["OpenPreview"] = 3] = "OpenPreview";
  PortAutoForwardAction2[PortAutoForwardAction2["Silent"] = 4] = "Silent";
  PortAutoForwardAction2[PortAutoForwardAction2["Ignore"] = 5] = "Ignore";
  PortAutoForwardAction2[PortAutoForwardAction2["OpenBrowserOnce"] = 6] = "OpenBrowserOnce";
  return PortAutoForwardAction2;
})(PortAutoForwardAction || {});
class TypeHierarchyItem {
  constructor(kind, name, detail, uri, range, selectionRange) {
    this.kind = kind;
    this.name = name;
    this.detail = detail;
    this.uri = uri;
    this.range = range;
    this.selectionRange = selectionRange;
  }
}
class TextTabInput {
  constructor(uri) {
    this.uri = uri;
  }
}
class TextDiffTabInput {
  constructor(original, modified) {
    this.original = original;
    this.modified = modified;
  }
}
class TextMergeTabInput {
  constructor(base, input1, input2, result) {
    this.base = base;
    this.input1 = input1;
    this.input2 = input2;
    this.result = result;
  }
}
class CustomEditorTabInput {
  constructor(uri, viewType) {
    this.uri = uri;
    this.viewType = viewType;
  }
}
class WebviewEditorTabInput {
  constructor(viewType) {
    this.viewType = viewType;
  }
}
class NotebookEditorTabInput {
  constructor(uri, notebookType) {
    this.uri = uri;
    this.notebookType = notebookType;
  }
}
class NotebookDiffEditorTabInput {
  constructor(original, modified, notebookType) {
    this.original = original;
    this.modified = modified;
    this.notebookType = notebookType;
  }
}
class TerminalEditorTabInput {
  constructor() {
  }
}
class InteractiveWindowInput {
  constructor(uri, inputBoxUri) {
    this.uri = uri;
    this.inputBoxUri = inputBoxUri;
  }
}
class ChatEditorTabInput {
  constructor() {
  }
}
class TextMultiDiffTabInput {
  constructor(textDiffs) {
    this.textDiffs = textDiffs;
  }
}
var InteractiveSessionVoteDirection = /* @__PURE__ */ ((InteractiveSessionVoteDirection2) => {
  InteractiveSessionVoteDirection2[InteractiveSessionVoteDirection2["Down"] = 0] = "Down";
  InteractiveSessionVoteDirection2[InteractiveSessionVoteDirection2["Up"] = 1] = "Up";
  return InteractiveSessionVoteDirection2;
})(InteractiveSessionVoteDirection || {});
var ChatCopyKind = /* @__PURE__ */ ((ChatCopyKind2) => {
  ChatCopyKind2[ChatCopyKind2["Action"] = 1] = "Action";
  ChatCopyKind2[ChatCopyKind2["Toolbar"] = 2] = "Toolbar";
  return ChatCopyKind2;
})(ChatCopyKind || {});
var ChatVariableLevel = /* @__PURE__ */ ((ChatVariableLevel2) => {
  ChatVariableLevel2[ChatVariableLevel2["Short"] = 1] = "Short";
  ChatVariableLevel2[ChatVariableLevel2["Medium"] = 2] = "Medium";
  ChatVariableLevel2[ChatVariableLevel2["Full"] = 3] = "Full";
  return ChatVariableLevel2;
})(ChatVariableLevel || {});
class ChatCompletionItem {
  constructor(id, label, values) {
    this.id = id;
    this.label = label;
    this.values = values;
  }
}
var ChatEditingSessionActionOutcome = /* @__PURE__ */ ((ChatEditingSessionActionOutcome2) => {
  ChatEditingSessionActionOutcome2[ChatEditingSessionActionOutcome2["Accepted"] = 1] = "Accepted";
  ChatEditingSessionActionOutcome2[ChatEditingSessionActionOutcome2["Rejected"] = 2] = "Rejected";
  ChatEditingSessionActionOutcome2[ChatEditingSessionActionOutcome2["Saved"] = 3] = "Saved";
  return ChatEditingSessionActionOutcome2;
})(ChatEditingSessionActionOutcome || {});
var InteractiveEditorResponseFeedbackKind = /* @__PURE__ */ ((InteractiveEditorResponseFeedbackKind2) => {
  InteractiveEditorResponseFeedbackKind2[InteractiveEditorResponseFeedbackKind2["Unhelpful"] = 0] = "Unhelpful";
  InteractiveEditorResponseFeedbackKind2[InteractiveEditorResponseFeedbackKind2["Helpful"] = 1] = "Helpful";
  InteractiveEditorResponseFeedbackKind2[InteractiveEditorResponseFeedbackKind2["Undone"] = 2] = "Undone";
  InteractiveEditorResponseFeedbackKind2[InteractiveEditorResponseFeedbackKind2["Accepted"] = 3] = "Accepted";
  InteractiveEditorResponseFeedbackKind2[InteractiveEditorResponseFeedbackKind2["Bug"] = 4] = "Bug";
  return InteractiveEditorResponseFeedbackKind2;
})(InteractiveEditorResponseFeedbackKind || {});
var ChatResultFeedbackKind = /* @__PURE__ */ ((ChatResultFeedbackKind2) => {
  ChatResultFeedbackKind2[ChatResultFeedbackKind2["Unhelpful"] = 0] = "Unhelpful";
  ChatResultFeedbackKind2[ChatResultFeedbackKind2["Helpful"] = 1] = "Helpful";
  return ChatResultFeedbackKind2;
})(ChatResultFeedbackKind || {});
class ChatResponseMarkdownPart {
  constructor(value) {
    if (typeof value !== "string" && value.isTrusted === true) {
      throw new Error("The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.");
    }
    this.value = typeof value === "string" ? new MarkdownString(value) : value;
  }
}
class ChatResponseMarkdownWithVulnerabilitiesPart {
  constructor(value, vulnerabilities) {
    if (typeof value !== "string" && value.isTrusted === true) {
      throw new Error("The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.");
    }
    this.value = typeof value === "string" ? new MarkdownString(value) : value;
    this.vulnerabilities = vulnerabilities;
  }
}
class ChatResponseConfirmationPart {
  constructor(title, message, data, buttons) {
    this.title = title;
    this.message = message;
    this.data = data;
    this.buttons = buttons;
  }
}
class ChatResponseFileTreePart {
  constructor(value, baseUri) {
    this.value = value;
    this.baseUri = baseUri;
  }
}
class ChatResponseAnchorPart {
  constructor(value, title) {
    this.value = value;
    this.value2 = value;
    this.title = title;
  }
}
class ChatResponseProgressPart {
  constructor(value) {
    this.value = value;
  }
}
class ChatResponseProgressPart2 {
  constructor(value, task) {
    this.value = value;
    this.task = task;
  }
}
class ChatResponseWarningPart {
  constructor(value) {
    if (typeof value !== "string" && value.isTrusted === true) {
      throw new Error("The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.");
    }
    this.value = typeof value === "string" ? new MarkdownString(value) : value;
  }
}
class ChatResponseCommandButtonPart {
  constructor(value) {
    this.value = value;
  }
}
class ChatResponseReferencePart {
  constructor(value, iconPath, options) {
    this.value = value;
    this.iconPath = iconPath;
    this.options = options;
  }
}
class ChatResponseCodeblockUriPart {
  constructor(value, isEdit) {
    this.value = value;
    this.isEdit = isEdit;
  }
}
class ChatResponseCodeCitationPart {
  constructor(value, license, snippet) {
    this.value = value;
    this.license = license;
    this.snippet = snippet;
  }
}
class ChatResponseMovePart {
  constructor(uri, range) {
    this.uri = uri;
    this.range = range;
  }
}
class ChatResponseTextEditPart {
  constructor(uri, editsOrDone) {
    this.uri = uri;
    if (editsOrDone === true) {
      this.isDone = true;
      this.edits = [];
    } else {
      this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];
    }
  }
}
class ChatResponseNotebookEditPart {
  constructor(uri, editsOrDone) {
    this.uri = uri;
    if (editsOrDone === true) {
      this.isDone = true;
      this.edits = [];
    } else {
      this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];
    }
  }
}
class ChatRequestTurn {
  constructor(prompt, command, references, participant, toolReferences) {
    this.prompt = prompt;
    this.command = command;
    this.references = references;
    this.participant = participant;
    this.toolReferences = toolReferences;
  }
}
class ChatResponseTurn {
  constructor(response, result, participant, command) {
    this.response = response;
    this.result = result;
    this.participant = participant;
    this.command = command;
  }
}
var ChatLocation = /* @__PURE__ */ ((ChatLocation2) => {
  ChatLocation2[ChatLocation2["Panel"] = 1] = "Panel";
  ChatLocation2[ChatLocation2["Terminal"] = 2] = "Terminal";
  ChatLocation2[ChatLocation2["Notebook"] = 3] = "Notebook";
  ChatLocation2[ChatLocation2["Editor"] = 4] = "Editor";
  ChatLocation2[ChatLocation2["EditingSession"] = 5] = "EditingSession";
  return ChatLocation2;
})(ChatLocation || {});
var ChatResponseReferencePartStatusKind = /* @__PURE__ */ ((ChatResponseReferencePartStatusKind2) => {
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Complete"] = 1] = "Complete";
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Partial"] = 2] = "Partial";
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Omitted"] = 3] = "Omitted";
  return ChatResponseReferencePartStatusKind2;
})(ChatResponseReferencePartStatusKind || {});
class ChatRequestEditorData {
  constructor(document, selection, wholeRange) {
    this.document = document;
    this.selection = selection;
    this.wholeRange = wholeRange;
  }
}
class ChatRequestNotebookData {
  constructor(cell) {
    this.cell = cell;
  }
}
class ChatReferenceBinaryData {
  constructor(mimeType, data, reference) {
    this.mimeType = mimeType;
    this.data = data;
    this.reference = reference;
  }
}
class ChatReferenceDiagnostic {
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
  }
}
var LanguageModelChatMessageRole = /* @__PURE__ */ ((LanguageModelChatMessageRole2) => {
  LanguageModelChatMessageRole2[LanguageModelChatMessageRole2["User"] = 1] = "User";
  LanguageModelChatMessageRole2[LanguageModelChatMessageRole2["Assistant"] = 2] = "Assistant";
  LanguageModelChatMessageRole2[LanguageModelChatMessageRole2["System"] = 3] = "System";
  return LanguageModelChatMessageRole2;
})(LanguageModelChatMessageRole || {});
class LanguageModelToolResultPart {
  constructor(callId, content, isError) {
    this.callId = callId;
    this.content = content;
    this.isError = isError ?? false;
  }
}
class PreparedTerminalToolInvocation {
  constructor(command, language, confirmationMessages) {
    this.command = command;
    this.language = language;
    this.confirmationMessages = confirmationMessages;
  }
}
var ChatErrorLevel = /* @__PURE__ */ ((ChatErrorLevel2) => {
  ChatErrorLevel2[ChatErrorLevel2["Info"] = 0] = "Info";
  ChatErrorLevel2[ChatErrorLevel2["Warning"] = 1] = "Warning";
  ChatErrorLevel2[ChatErrorLevel2["Error"] = 2] = "Error";
  return ChatErrorLevel2;
})(ChatErrorLevel || {});
class LanguageModelChatMessage {
  constructor(role, content, name) {
    this._content = [];
    this.role = role;
    this.content = content;
    this.name = name;
  }
  static User(content, name) {
    return new LanguageModelChatMessage(1 /* User */, content, name);
  }
  static Assistant(content, name) {
    return new LanguageModelChatMessage(2 /* Assistant */, content, name);
  }
  set content(value) {
    if (typeof value === "string") {
      this._content = [new LanguageModelTextPart(value)];
    } else {
      this._content = value;
    }
  }
  get content() {
    return this._content;
  }
  // Temp to avoid breaking changes
  set content2(value) {
    if (value) {
      this.content = value.map((part) => {
        if (typeof part === "string") {
          return new LanguageModelTextPart(part);
        }
        return part;
      });
    }
  }
  get content2() {
    return this.content.map((part) => {
      if (part instanceof LanguageModelTextPart) {
        return part.value;
      }
      return part;
    });
  }
}
class LanguageModelChatMessage2 {
  constructor(role, content, name) {
    this._content = [];
    this.role = role;
    this.content = content;
    this.name = name;
  }
  static User(content, name) {
    return new LanguageModelChatMessage2(1 /* User */, content, name);
  }
  static Assistant(content, name) {
    return new LanguageModelChatMessage2(2 /* Assistant */, content, name);
  }
  set content(value) {
    if (typeof value === "string") {
      this._content = [new LanguageModelTextPart(value)];
    } else {
      this._content = value;
    }
  }
  get content() {
    return this._content;
  }
  // Temp to avoid breaking changes
  set content2(value) {
    if (value) {
      this.content = value.map((part) => {
        if (typeof part === "string") {
          return new LanguageModelTextPart(part);
        }
        return part;
      });
    }
  }
  get content2() {
    return this.content.map((part) => {
      if (part instanceof LanguageModelTextPart) {
        return part.value;
      }
      return part;
    });
  }
}
class LanguageModelToolCallPart {
  constructor(callId, name, input) {
    this.callId = callId;
    this.name = name;
    this.input = input;
  }
}
class LanguageModelTextPart {
  constructor(value) {
    this.value = value;
  }
  toJSON() {
    return {
      $mid: MarshalledId.LanguageModelTextPart,
      value: this.value
    };
  }
}
class LanguageModelDataPart {
  constructor(value) {
    this.value = value;
  }
  toJSON() {
    return {
      $mid: MarshalledId.LanguageModelDataPart,
      value: this.value
    };
  }
}
var ChatImageMimeType = /* @__PURE__ */ ((ChatImageMimeType2) => {
  ChatImageMimeType2["PNG"] = "image/png";
  ChatImageMimeType2["JPEG"] = "image/jpeg";
  ChatImageMimeType2["GIF"] = "image/gif";
  ChatImageMimeType2["WEBP"] = "image/webp";
  ChatImageMimeType2["BMP"] = "image/bmp";
  return ChatImageMimeType2;
})(ChatImageMimeType || {});
class LanguageModelPromptTsxPart {
  constructor(value) {
    this.value = value;
  }
  toJSON() {
    return {
      $mid: MarshalledId.LanguageModelPromptTsxPart,
      value: this.value
    };
  }
}
class LanguageModelChatSystemMessage {
  constructor(content) {
    this.content = content;
  }
}
class LanguageModelChatUserMessage {
  constructor(content, name) {
    this.content = content;
    this.name = name;
  }
}
class LanguageModelChatAssistantMessage {
  constructor(content, name) {
    this.content = content;
    this.name = name;
  }
}
class LanguageModelError extends Error {
  static #name = "LanguageModelError";
  static NotFound(message) {
    return new LanguageModelError(message, LanguageModelError.NotFound.name);
  }
  static NoPermissions(message) {
    return new LanguageModelError(message, LanguageModelError.NoPermissions.name);
  }
  static Blocked(message) {
    return new LanguageModelError(message, LanguageModelError.Blocked.name);
  }
  static tryDeserialize(data) {
    if (data.name !== LanguageModelError.#name) {
      return void 0;
    }
    return new LanguageModelError(data.message, data.code, data.cause);
  }
  constructor(message, code, cause) {
    super(message, { cause });
    this.name = LanguageModelError.#name;
    this.code = code ?? "";
  }
}
class LanguageModelToolResult {
  constructor(content) {
    this.content = content;
  }
  toJSON() {
    return {
      $mid: MarshalledId.LanguageModelToolResult,
      content: this.content
    };
  }
}
class ExtendedLanguageModelToolResult extends LanguageModelToolResult {
}
var LanguageModelChatToolMode = /* @__PURE__ */ ((LanguageModelChatToolMode2) => {
  LanguageModelChatToolMode2[LanguageModelChatToolMode2["Auto"] = 1] = "Auto";
  LanguageModelChatToolMode2[LanguageModelChatToolMode2["Required"] = 2] = "Required";
  return LanguageModelChatToolMode2;
})(LanguageModelChatToolMode || {});
var RelatedInformationType = /* @__PURE__ */ ((RelatedInformationType2) => {
  RelatedInformationType2[RelatedInformationType2["SymbolInformation"] = 1] = "SymbolInformation";
  RelatedInformationType2[RelatedInformationType2["CommandInformation"] = 2] = "CommandInformation";
  RelatedInformationType2[RelatedInformationType2["SearchInformation"] = 3] = "SearchInformation";
  RelatedInformationType2[RelatedInformationType2["SettingInformation"] = 4] = "SettingInformation";
  return RelatedInformationType2;
})(RelatedInformationType || {});
var SpeechToTextStatus = /* @__PURE__ */ ((SpeechToTextStatus2) => {
  SpeechToTextStatus2[SpeechToTextStatus2["Started"] = 1] = "Started";
  SpeechToTextStatus2[SpeechToTextStatus2["Recognizing"] = 2] = "Recognizing";
  SpeechToTextStatus2[SpeechToTextStatus2["Recognized"] = 3] = "Recognized";
  SpeechToTextStatus2[SpeechToTextStatus2["Stopped"] = 4] = "Stopped";
  SpeechToTextStatus2[SpeechToTextStatus2["Error"] = 5] = "Error";
  return SpeechToTextStatus2;
})(SpeechToTextStatus || {});
var TextToSpeechStatus = /* @__PURE__ */ ((TextToSpeechStatus2) => {
  TextToSpeechStatus2[TextToSpeechStatus2["Started"] = 1] = "Started";
  TextToSpeechStatus2[TextToSpeechStatus2["Stopped"] = 2] = "Stopped";
  TextToSpeechStatus2[TextToSpeechStatus2["Error"] = 3] = "Error";
  return TextToSpeechStatus2;
})(TextToSpeechStatus || {});
var KeywordRecognitionStatus = /* @__PURE__ */ ((KeywordRecognitionStatus2) => {
  KeywordRecognitionStatus2[KeywordRecognitionStatus2["Recognized"] = 1] = "Recognized";
  KeywordRecognitionStatus2[KeywordRecognitionStatus2["Stopped"] = 2] = "Stopped";
  return KeywordRecognitionStatus2;
})(KeywordRecognitionStatus || {});
class InlineEdit {
  constructor(text, range) {
    this.text = text;
    this.range = range;
  }
}
var InlineEditTriggerKind = /* @__PURE__ */ ((InlineEditTriggerKind2) => {
  InlineEditTriggerKind2[InlineEditTriggerKind2["Invoke"] = 0] = "Invoke";
  InlineEditTriggerKind2[InlineEditTriggerKind2["Automatic"] = 1] = "Automatic";
  return InlineEditTriggerKind2;
})(InlineEditTriggerKind || {});
class McpStdioServerDefinition {
  constructor(label, command, args, env) {
    this.label = label;
    this.command = command;
    this.args = args;
    this.env = env;
  }
}
class McpSSEServerDefinition {
  constructor(label, uri) {
    this.label = label;
    this.uri = uri;
    this.headers = [];
  }
}
export {
  BranchCoverage,
  Breakpoint,
  CallHierarchyIncomingCall,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CellErrorStackFrame,
  ChatCompletionItem,
  ChatCopyKind,
  ChatEditingSessionActionOutcome,
  ChatEditorTabInput,
  ChatErrorLevel,
  ChatImageMimeType,
  ChatLocation,
  ChatReferenceBinaryData,
  ChatReferenceDiagnostic,
  ChatRequestEditorData,
  ChatRequestNotebookData,
  ChatRequestTurn,
  ChatResponseAnchorPart,
  ChatResponseCodeCitationPart,
  ChatResponseCodeblockUriPart,
  ChatResponseCommandButtonPart,
  ChatResponseConfirmationPart,
  ChatResponseFileTreePart,
  ChatResponseMarkdownPart,
  ChatResponseMarkdownWithVulnerabilitiesPart,
  ChatResponseMovePart,
  ChatResponseNotebookEditPart,
  ChatResponseProgressPart,
  ChatResponseProgressPart2,
  ChatResponseReferencePart,
  ChatResponseReferencePartStatusKind,
  ChatResponseTextEditPart,
  ChatResponseTurn,
  ChatResponseWarningPart,
  ChatResultFeedbackKind,
  ChatVariableLevel,
  CodeAction,
  CodeActionKind,
  CodeActionTriggerKind,
  CodeLens,
  Color,
  ColorFormat,
  ColorInformation,
  ColorPresentation,
  ColorTheme,
  ColorThemeKind,
  CommentMode,
  CommentState,
  CommentThreadApplicability,
  CommentThreadCollapsibleState,
  CommentThreadFocus,
  CommentThreadState,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionList,
  CompletionTriggerKind,
  ConfigurationTarget,
  CustomEditorTabInput,
  CustomExecution,
  DataBreakpoint,
  DataTransfer,
  DataTransferFile,
  DataTransferItem,
  DebugAdapterExecutable,
  DebugAdapterInlineImplementation,
  DebugAdapterNamedPipeServer,
  DebugAdapterServer,
  DebugConsoleMode,
  DebugStackFrame,
  DebugThread,
  DebugVisualization,
  DeclarationCoverage,
  DecorationRangeBehavior,
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  DiagnosticTag,
  Disposable,
  DocumentDropEdit,
  DocumentDropOrPasteEditKind,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentLink,
  DocumentPasteEdit,
  DocumentPasteTriggerKind,
  DocumentSymbol,
  EndOfLine,
  EnvironmentVariableMutatorType,
  EvaluatableExpression,
  ExtendedLanguageModelToolResult,
  ExtensionKind,
  ExtensionMode,
  ExtensionRuntime,
  ExternalUriOpenerPriority,
  FileChangeType,
  FileCoverage,
  FileDecoration,
  FileEditType,
  FileSystemError,
  FoldingRange,
  FoldingRangeKind,
  FunctionBreakpoint,
  Hover,
  HoverVerbosityAction,
  InlayHint,
  InlayHintKind,
  InlayHintLabelPart,
  InlineCompletionTriggerKind,
  InlineEdit,
  InlineEditTriggerKind,
  InlineSuggestion,
  InlineSuggestionList,
  InlineValueContext,
  InlineValueEvaluatableExpression,
  InlineValueText,
  InlineValueVariableLookup,
  InputBoxValidationSeverity,
  InteractiveEditorResponseFeedbackKind,
  InteractiveSessionVoteDirection,
  InteractiveWindowInput,
  InternalDataTransferItem,
  InternalFileDataTransferItem,
  KeywordRecognitionStatus,
  LanguageModelChatAssistantMessage,
  LanguageModelChatMessage,
  LanguageModelChatMessage2,
  LanguageModelChatMessageRole,
  LanguageModelChatSystemMessage,
  LanguageModelChatToolMode,
  LanguageModelChatUserMessage,
  LanguageModelDataPart,
  LanguageModelError,
  LanguageModelPromptTsxPart,
  LanguageModelTextPart,
  LanguageModelToolCallPart,
  LanguageModelToolResult,
  LanguageModelToolResultPart,
  LanguageStatusSeverity,
  LinkedEditingRanges,
  Location,
  ManagedResolvedAuthority,
  MarkdownString,
  McpSSEServerDefinition,
  McpStdioServerDefinition,
  MultiDocumentHighlight,
  NewSymbolName,
  NewSymbolNameTag,
  NewSymbolNameTriggerKind,
  NotebookCellData,
  NotebookCellExecutionState,
  NotebookCellKind,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookCellStatusBarAlignment,
  NotebookCellStatusBarItem,
  NotebookControllerAffinity,
  NotebookControllerAffinity2,
  NotebookData,
  NotebookDiffEditorTabInput,
  NotebookEdit,
  NotebookEditorRevealType,
  NotebookEditorTabInput,
  NotebookKernelSourceAction,
  NotebookRange,
  NotebookRendererScript,
  NotebookVariablesRequestKind,
  ParameterInformation,
  PartialAcceptTriggerKind,
  PortAttributes,
  PortAutoForwardAction,
  Position,
  PreparedTerminalToolInvocation,
  ProcessExecution,
  ProgressLocation,
  QuickInputButtonLocation,
  QuickInputButtons,
  QuickPickItemKind,
  Range,
  RelatedInformationType,
  RelativePattern,
  RemoteAuthorityResolverError,
  ResolvedAuthority,
  Selection,
  SelectionRange,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensEdit,
  SemanticTokensEdits,
  SemanticTokensLegend,
  ShellExecution,
  ShellQuoting,
  SignatureHelp,
  SignatureHelpTriggerKind,
  SignatureInformation,
  SnippetString,
  SnippetTextEdit,
  SourceBreakpoint,
  SourceControlInputBoxValidationType,
  SpeechToTextStatus,
  StandardTokenType,
  StatementCoverage,
  StatusBarAlignment,
  SymbolInformation,
  SymbolKind,
  SymbolTag,
  SyntaxTokenType,
  Task,
  TaskEventKind,
  TaskGroup,
  TaskPanelKind,
  TaskRevealKind,
  TaskScope,
  TerminalCompletionItem,
  TerminalCompletionItemKind,
  TerminalCompletionList,
  TerminalEditorTabInput,
  TerminalExitReason,
  TerminalLink,
  TerminalLocation,
  TerminalOutputAnchor,
  TerminalProfile,
  TerminalQuickFixCommand,
  TerminalQuickFixOpener,
  TerminalQuickFixType,
  TerminalShellExecutionCommandLineConfidence,
  TerminalShellType,
  TestCoverageCount,
  TestMessage,
  TestMessageStackFrame,
  TestResultState,
  TestRunProfileBase,
  TestRunProfileKind,
  TestRunRequest,
  TestTag,
  TextDiffTabInput,
  TextDocumentChangeReason,
  TextDocumentSaveReason,
  TextEdit,
  TextEditorChangeKind,
  TextEditorLineNumbersStyle,
  TextEditorRevealType,
  TextEditorSelectionChangeKind,
  TextMergeTabInput,
  TextMultiDiffTabInput,
  TextTabInput,
  TextToSpeechStatus,
  ThemeColor,
  ThemeIcon,
  TimelineItem,
  TreeItem,
  TreeItemCheckboxState,
  TreeItemCollapsibleState,
  TypeHierarchyItem,
  VerboseHover,
  ViewBadge,
  ViewColumn,
  WebviewEditorTabInput,
  WorkspaceEdit,
  WorkspaceTrustState,
  asStatusBarItemIdentifier,
  getDebugDescriptionOfRange,
  getDebugDescriptionOfSelection,
  setBreakpointId,
  validateTestCoverageCount
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHlwZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBsb2NhbC9jb2RlLW5vLW5hdGl2ZS1wcml2YXRlICovXG5cbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBhc0FycmF5LCBjb2FsZXNjZUluUGxhY2UsIGVxdWFscyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBpbGxlZ2FsQXJndW1lbnQsIFNlcmlhbGl6ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJUmVsYXRpdmVQYXR0ZXJuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyBhcyBCYXNlTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nVHJ1c3RlZE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBNaW1lcywgbm9ybWFsaXplTWltZVR5cGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IG5leHRDaGFyTGVuZ3RoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBpc051bWJlciwgaXNPYmplY3QsIGlzU3RyaW5nLCBpc1N0cmluZ0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLCBtYXJrQXNGaWxlU3lzdGVtUHJvdmlkZXJFcnJvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yQ29kZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRUeXBlLCBJQ2VsbE1ldGFkYXRhRWRpdCwgSURvY3VtZW50TWV0YWRhdGFFZGl0LCBpc1RleHRTdHJlYW1NaW1lIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSVJlbGF0aXZlUGF0dGVybkR0byB9IGZyb20gJy4vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqXG4gKiBUaGlzIHV0aWxpdHkgZW5zdXJlcyB0aGF0IG9sZCBKUyBjb2RlIHRoYXQgdXNlcyBmdW5jdGlvbnMgZm9yIGNsYXNzZXMgc3RpbGwgd29ya3MuIEV4aXN0aW5nIHVzYWdlcyBjYW5ub3QgYmUgcmVtb3ZlZFxuICogYnV0IG5ldyBvbmVzIG11c3Qgbm90IGJlIGFkZGVkXG4gKiAqL1xuZnVuY3Rpb24gZXM1Q2xhc3NDb21wYXQodGFyZ2V0OiBGdW5jdGlvbik6IGFueSB7XG5cdGNvbnN0IGludGVyY2VwdEZ1bmN0aW9ucyA9IHtcblx0XHRhcHBseTogZnVuY3Rpb24gKC4uLmFyZ3M6IGFueVtdKTogYW55IHtcblx0XHRcdGlmIChhcmdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gUmVmbGVjdC5jb25zdHJ1Y3QodGFyZ2V0LCBbXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBhcmdzTGlzdCA9IGFyZ3MubGVuZ3RoID09PSAxID8gW10gOiBhcmdzWzFdO1xuXHRcdFx0XHRyZXR1cm4gUmVmbGVjdC5jb25zdHJ1Y3QodGFyZ2V0LCBhcmdzTGlzdCwgYXJnc1swXS5jb25zdHJ1Y3Rvcik7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjYWxsOiBmdW5jdGlvbiAoLi4uYXJnczogYW55W10pOiBhbnkge1xuXHRcdFx0aWYgKGFyZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybiBSZWZsZWN0LmNvbnN0cnVjdCh0YXJnZXQsIFtdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IFt0aGlzQXJnLCAuLi5yZXN0QXJnc10gPSBhcmdzO1xuXHRcdFx0XHRyZXR1cm4gUmVmbGVjdC5jb25zdHJ1Y3QodGFyZ2V0LCByZXN0QXJncywgdGhpc0FyZy5jb25zdHJ1Y3Rvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih0YXJnZXQsIGludGVyY2VwdEZ1bmN0aW9ucyk7XG59XG5cbmV4cG9ydCBlbnVtIFRlcm1pbmFsT3V0cHV0QW5jaG9yIHtcblx0VG9wID0gMCxcblx0Qm90dG9tID0gMVxufVxuXG5leHBvcnQgZW51bSBUZXJtaW5hbFF1aWNrRml4VHlwZSB7XG5cdFRlcm1pbmFsQ29tbWFuZCA9IDAsXG5cdE9wZW5lciA9IDEsXG5cdENvbW1hbmQgPSAzXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyBmcm9tKC4uLmluRGlzcG9zYWJsZXM6IHsgZGlzcG9zZSgpOiBhbnkgfVtdKTogRGlzcG9zYWJsZSB7XG5cdFx0bGV0IGRpc3Bvc2FibGVzOiBSZWFkb25seUFycmF5PHsgZGlzcG9zZSgpOiBhbnkgfT4gfCB1bmRlZmluZWQgPSBpbkRpc3Bvc2FibGVzO1xuXHRcdHJldHVybiBuZXcgRGlzcG9zYWJsZShmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoZGlzcG9zYWJsZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBkaXNwb3NhYmxlIG9mIGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdFx0aWYgKGRpc3Bvc2FibGUgJiYgdHlwZW9mIGRpc3Bvc2FibGUuZGlzcG9zZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGRpc3Bvc2FibGVzID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0I2NhbGxPbkRpc3Bvc2U/OiAoKSA9PiBhbnk7XG5cblx0Y29uc3RydWN0b3IoY2FsbE9uRGlzcG9zZTogKCkgPT4gYW55KSB7XG5cdFx0dGhpcy4jY2FsbE9uRGlzcG9zZSA9IGNhbGxPbkRpc3Bvc2U7XG5cdH1cblxuXHRkaXNwb3NlKCk6IGFueSB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLiNjYWxsT25EaXNwb3NlID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aGlzLiNjYWxsT25EaXNwb3NlKCk7XG5cdFx0XHR0aGlzLiNjYWxsT25EaXNwb3NlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBQb3NpdGlvbiB7XG5cblx0c3RhdGljIE1pbiguLi5wb3NpdGlvbnM6IFBvc2l0aW9uW10pOiBQb3NpdGlvbiB7XG5cdFx0aWYgKHBvc2l0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoKTtcblx0XHR9XG5cdFx0bGV0IHJlc3VsdCA9IHBvc2l0aW9uc1swXTtcblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IHBvc2l0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcCA9IHBvc2l0aW9uc1tpXTtcblx0XHRcdGlmIChwLmlzQmVmb3JlKHJlc3VsdCkpIHtcblx0XHRcdFx0cmVzdWx0ID0gcDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHN0YXRpYyBNYXgoLi4ucG9zaXRpb25zOiBQb3NpdGlvbltdKTogUG9zaXRpb24ge1xuXHRcdGlmIChwb3NpdGlvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCk7XG5cdFx0fVxuXHRcdGxldCByZXN1bHQgPSBwb3NpdGlvbnNbMF07XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBwb3NpdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHAgPSBwb3NpdGlvbnNbaV07XG5cdFx0XHRpZiAocC5pc0FmdGVyKHJlc3VsdCkpIHtcblx0XHRcdFx0cmVzdWx0ID0gcDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHN0YXRpYyBpc1Bvc2l0aW9uKG90aGVyOiBhbnkpOiBvdGhlciBpcyBQb3NpdGlvbiB7XG5cdFx0aWYgKCFvdGhlcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAob3RoZXIgaW5zdGFuY2VvZiBQb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSA8UG9zaXRpb24+b3RoZXI7XG5cdFx0aWYgKHR5cGVvZiBsaW5lID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgY2hhcmFjdGVyID09PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHN0YXRpYyBvZihvYmo6IHZzY29kZS5Qb3NpdGlvbik6IFBvc2l0aW9uIHtcblx0XHRpZiAob2JqIGluc3RhbmNlb2YgUG9zaXRpb24pIHtcblx0XHRcdHJldHVybiBvYmo7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlzUG9zaXRpb24ob2JqKSkge1xuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihvYmoubGluZSwgb2JqLmNoYXJhY3Rlcik7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudCwgaXMgTk9UIGEgcG9zaXRpb24tbGlrZSBvYmplY3QnKTtcblx0fVxuXG5cdHByaXZhdGUgX2xpbmU6IG51bWJlcjtcblx0cHJpdmF0ZSBfY2hhcmFjdGVyOiBudW1iZXI7XG5cblx0Z2V0IGxpbmUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZTtcblx0fVxuXG5cdGdldCBjaGFyYWN0ZXIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hhcmFjdGVyO1xuXHR9XG5cblx0Y29uc3RydWN0b3IobGluZTogbnVtYmVyLCBjaGFyYWN0ZXI6IG51bWJlcikge1xuXHRcdGlmIChsaW5lIDwgMCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdsaW5lIG11c3QgYmUgbm9uLW5lZ2F0aXZlJyk7XG5cdFx0fVxuXHRcdGlmIChjaGFyYWN0ZXIgPCAwKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2NoYXJhY3RlciBtdXN0IGJlIG5vbi1uZWdhdGl2ZScpO1xuXHRcdH1cblx0XHR0aGlzLl9saW5lID0gbGluZTtcblx0XHR0aGlzLl9jaGFyYWN0ZXIgPSBjaGFyYWN0ZXI7XG5cdH1cblxuXHRpc0JlZm9yZShvdGhlcjogUG9zaXRpb24pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbGluZSA8IG90aGVyLl9saW5lKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKG90aGVyLl9saW5lIDwgdGhpcy5fbGluZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY2hhcmFjdGVyIDwgb3RoZXIuX2NoYXJhY3Rlcjtcblx0fVxuXG5cdGlzQmVmb3JlT3JFcXVhbChvdGhlcjogUG9zaXRpb24pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbGluZSA8IG90aGVyLl9saW5lKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKG90aGVyLl9saW5lIDwgdGhpcy5fbGluZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY2hhcmFjdGVyIDw9IG90aGVyLl9jaGFyYWN0ZXI7XG5cdH1cblxuXHRpc0FmdGVyKG90aGVyOiBQb3NpdGlvbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5pc0JlZm9yZU9yRXF1YWwob3RoZXIpO1xuXHR9XG5cblx0aXNBZnRlck9yRXF1YWwob3RoZXI6IFBvc2l0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmlzQmVmb3JlKG90aGVyKTtcblx0fVxuXG5cdGlzRXF1YWwob3RoZXI6IFBvc2l0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmUgPT09IG90aGVyLl9saW5lICYmIHRoaXMuX2NoYXJhY3RlciA9PT0gb3RoZXIuX2NoYXJhY3Rlcjtcblx0fVxuXG5cdGNvbXBhcmVUbyhvdGhlcjogUG9zaXRpb24pOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9saW5lIDwgb3RoZXIuX2xpbmUpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2xpbmUgPiBvdGhlci5saW5lKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZXF1YWwgbGluZVxuXHRcdFx0aWYgKHRoaXMuX2NoYXJhY3RlciA8IG90aGVyLl9jaGFyYWN0ZXIpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9jaGFyYWN0ZXIgPiBvdGhlci5fY2hhcmFjdGVyKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZXF1YWwgbGluZSBhbmQgY2hhcmFjdGVyXG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHRyYW5zbGF0ZShjaGFuZ2U6IHsgbGluZURlbHRhPzogbnVtYmVyOyBjaGFyYWN0ZXJEZWx0YT86IG51bWJlciB9KTogUG9zaXRpb247XG5cdHRyYW5zbGF0ZShsaW5lRGVsdGE/OiBudW1iZXIsIGNoYXJhY3RlckRlbHRhPzogbnVtYmVyKTogUG9zaXRpb247XG5cdHRyYW5zbGF0ZShsaW5lRGVsdGFPckNoYW5nZTogbnVtYmVyIHwgdW5kZWZpbmVkIHwgeyBsaW5lRGVsdGE/OiBudW1iZXI7IGNoYXJhY3RlckRlbHRhPzogbnVtYmVyIH0sIGNoYXJhY3RlckRlbHRhOiBudW1iZXIgPSAwKTogUG9zaXRpb24ge1xuXG5cdFx0aWYgKGxpbmVEZWx0YU9yQ2hhbmdlID09PSBudWxsIHx8IGNoYXJhY3RlckRlbHRhID09PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoKTtcblx0XHR9XG5cblx0XHRsZXQgbGluZURlbHRhOiBudW1iZXI7XG5cdFx0aWYgKHR5cGVvZiBsaW5lRGVsdGFPckNoYW5nZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGxpbmVEZWx0YSA9IDA7XG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgbGluZURlbHRhT3JDaGFuZ2UgPT09ICdudW1iZXInKSB7XG5cdFx0XHRsaW5lRGVsdGEgPSBsaW5lRGVsdGFPckNoYW5nZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGluZURlbHRhID0gdHlwZW9mIGxpbmVEZWx0YU9yQ2hhbmdlLmxpbmVEZWx0YSA9PT0gJ251bWJlcicgPyBsaW5lRGVsdGFPckNoYW5nZS5saW5lRGVsdGEgOiAwO1xuXHRcdFx0Y2hhcmFjdGVyRGVsdGEgPSB0eXBlb2YgbGluZURlbHRhT3JDaGFuZ2UuY2hhcmFjdGVyRGVsdGEgPT09ICdudW1iZXInID8gbGluZURlbHRhT3JDaGFuZ2UuY2hhcmFjdGVyRGVsdGEgOiAwO1xuXHRcdH1cblxuXHRcdGlmIChsaW5lRGVsdGEgPT09IDAgJiYgY2hhcmFjdGVyRGVsdGEgPT09IDApIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKHRoaXMubGluZSArIGxpbmVEZWx0YSwgdGhpcy5jaGFyYWN0ZXIgKyBjaGFyYWN0ZXJEZWx0YSk7XG5cdH1cblxuXHR3aXRoKGNoYW5nZTogeyBsaW5lPzogbnVtYmVyOyBjaGFyYWN0ZXI/OiBudW1iZXIgfSk6IFBvc2l0aW9uO1xuXHR3aXRoKGxpbmU/OiBudW1iZXIsIGNoYXJhY3Rlcj86IG51bWJlcik6IFBvc2l0aW9uO1xuXHR3aXRoKGxpbmVPckNoYW5nZTogbnVtYmVyIHwgdW5kZWZpbmVkIHwgeyBsaW5lPzogbnVtYmVyOyBjaGFyYWN0ZXI/OiBudW1iZXIgfSwgY2hhcmFjdGVyOiBudW1iZXIgPSB0aGlzLmNoYXJhY3Rlcik6IFBvc2l0aW9uIHtcblxuXHRcdGlmIChsaW5lT3JDaGFuZ2UgPT09IG51bGwgfHwgY2hhcmFjdGVyID09PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoKTtcblx0XHR9XG5cblx0XHRsZXQgbGluZTogbnVtYmVyO1xuXHRcdGlmICh0eXBlb2YgbGluZU9yQ2hhbmdlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0bGluZSA9IHRoaXMubGluZTtcblxuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGxpbmVPckNoYW5nZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGxpbmUgPSBsaW5lT3JDaGFuZ2U7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0bGluZSA9IHR5cGVvZiBsaW5lT3JDaGFuZ2UubGluZSA9PT0gJ251bWJlcicgPyBsaW5lT3JDaGFuZ2UubGluZSA6IHRoaXMubGluZTtcblx0XHRcdGNoYXJhY3RlciA9IHR5cGVvZiBsaW5lT3JDaGFuZ2UuY2hhcmFjdGVyID09PSAnbnVtYmVyJyA/IGxpbmVPckNoYW5nZS5jaGFyYWN0ZXIgOiB0aGlzLmNoYXJhY3Rlcjtcblx0XHR9XG5cblx0XHRpZiAobGluZSA9PT0gdGhpcy5saW5lICYmIGNoYXJhY3RlciA9PT0gdGhpcy5jaGFyYWN0ZXIpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmUsIGNoYXJhY3Rlcik7XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4geyBsaW5lOiB0aGlzLmxpbmUsIGNoYXJhY3RlcjogdGhpcy5jaGFyYWN0ZXIgfTtcblx0fVxuXG5cdFtTeW1ib2wuZm9yKCdkZWJ1Zy5kZXNjcmlwdGlvbicpXSgpIHtcblx0XHRyZXR1cm4gYCgke3RoaXMubGluZX06JHt0aGlzLmNoYXJhY3Rlcn0pYDtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBSYW5nZSB7XG5cblx0c3RhdGljIGlzUmFuZ2UodGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5SYW5nZSB7XG5cdFx0aWYgKHRoaW5nIGluc3RhbmNlb2YgUmFuZ2UpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBQb3NpdGlvbi5pc1Bvc2l0aW9uKCg8UmFuZ2U+dGhpbmcpLnN0YXJ0KVxuXHRcdFx0JiYgUG9zaXRpb24uaXNQb3NpdGlvbigoPFJhbmdlPnRoaW5nLmVuZCkpO1xuXHR9XG5cblx0c3RhdGljIG9mKG9iajogdnNjb2RlLlJhbmdlKTogUmFuZ2Uge1xuXHRcdGlmIChvYmogaW5zdGFuY2VvZiBSYW5nZSkge1xuXHRcdFx0cmV0dXJuIG9iajtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaXNSYW5nZShvYmopKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFJhbmdlKG9iai5zdGFydCwgb2JqLmVuZCk7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudCwgaXMgTk9UIGEgcmFuZ2UtbGlrZSBvYmplY3QnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfc3RhcnQ6IFBvc2l0aW9uO1xuXHRwcm90ZWN0ZWQgX2VuZDogUG9zaXRpb247XG5cblx0Z2V0IHN0YXJ0KCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhcnQ7XG5cdH1cblxuXHRnZXQgZW5kKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fZW5kO1xuXHR9XG5cblx0Y29uc3RydWN0b3Ioc3RhcnQ6IHZzY29kZS5Qb3NpdGlvbiwgZW5kOiB2c2NvZGUuUG9zaXRpb24pO1xuXHRjb25zdHJ1Y3RvcihzdGFydDogUG9zaXRpb24sIGVuZDogUG9zaXRpb24pO1xuXHRjb25zdHJ1Y3RvcihzdGFydExpbmU6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kTGluZTogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlcik7XG5cdGNvbnN0cnVjdG9yKHN0YXJ0TGluZU9yU3RhcnQ6IG51bWJlciB8IFBvc2l0aW9uIHwgdnNjb2RlLlBvc2l0aW9uLCBzdGFydENvbHVtbk9yRW5kOiBudW1iZXIgfCBQb3NpdGlvbiB8IHZzY29kZS5Qb3NpdGlvbiwgZW5kTGluZT86IG51bWJlciwgZW5kQ29sdW1uPzogbnVtYmVyKSB7XG5cdFx0bGV0IHN0YXJ0OiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZW5kOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0eXBlb2Ygc3RhcnRMaW5lT3JTdGFydCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHN0YXJ0Q29sdW1uT3JFbmQgPT09ICdudW1iZXInICYmIHR5cGVvZiBlbmRMaW5lID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZW5kQ29sdW1uID09PSAnbnVtYmVyJykge1xuXHRcdFx0c3RhcnQgPSBuZXcgUG9zaXRpb24oc3RhcnRMaW5lT3JTdGFydCwgc3RhcnRDb2x1bW5PckVuZCk7XG5cdFx0XHRlbmQgPSBuZXcgUG9zaXRpb24oZW5kTGluZSwgZW5kQ29sdW1uKTtcblx0XHR9IGVsc2UgaWYgKFBvc2l0aW9uLmlzUG9zaXRpb24oc3RhcnRMaW5lT3JTdGFydCkgJiYgUG9zaXRpb24uaXNQb3NpdGlvbihzdGFydENvbHVtbk9yRW5kKSkge1xuXHRcdFx0c3RhcnQgPSBQb3NpdGlvbi5vZihzdGFydExpbmVPclN0YXJ0KTtcblx0XHRcdGVuZCA9IFBvc2l0aW9uLm9mKHN0YXJ0Q29sdW1uT3JFbmQpO1xuXHRcdH1cblxuXHRcdGlmICghc3RhcnQgfHwgIWVuZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdH1cblxuXHRcdGlmIChzdGFydC5pc0JlZm9yZShlbmQpKSB7XG5cdFx0XHR0aGlzLl9zdGFydCA9IHN0YXJ0O1xuXHRcdFx0dGhpcy5fZW5kID0gZW5kO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zdGFydCA9IGVuZDtcblx0XHRcdHRoaXMuX2VuZCA9IHN0YXJ0O1xuXHRcdH1cblx0fVxuXG5cdGNvbnRhaW5zKHBvc2l0aW9uT3JSYW5nZTogUG9zaXRpb24gfCBSYW5nZSk6IGJvb2xlYW4ge1xuXHRcdGlmIChSYW5nZS5pc1JhbmdlKHBvc2l0aW9uT3JSYW5nZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmNvbnRhaW5zKHBvc2l0aW9uT3JSYW5nZS5zdGFydClcblx0XHRcdFx0JiYgdGhpcy5jb250YWlucyhwb3NpdGlvbk9yUmFuZ2UuZW5kKTtcblxuXHRcdH0gZWxzZSBpZiAoUG9zaXRpb24uaXNQb3NpdGlvbihwb3NpdGlvbk9yUmFuZ2UpKSB7XG5cdFx0XHRpZiAoUG9zaXRpb24ub2YocG9zaXRpb25PclJhbmdlKS5pc0JlZm9yZSh0aGlzLl9zdGFydCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2VuZC5pc0JlZm9yZShwb3NpdGlvbk9yUmFuZ2UpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpc0VxdWFsKG90aGVyOiBSYW5nZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zdGFydC5pc0VxdWFsKG90aGVyLl9zdGFydCkgJiYgdGhpcy5fZW5kLmlzRXF1YWwob3RoZXIuX2VuZCk7XG5cdH1cblxuXHRpbnRlcnNlY3Rpb24ob3RoZXI6IFJhbmdlKTogUmFuZ2UgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHN0YXJ0ID0gUG9zaXRpb24uTWF4KG90aGVyLnN0YXJ0LCB0aGlzLl9zdGFydCk7XG5cdFx0Y29uc3QgZW5kID0gUG9zaXRpb24uTWluKG90aGVyLmVuZCwgdGhpcy5fZW5kKTtcblx0XHRpZiAoc3RhcnQuaXNBZnRlcihlbmQpKSB7XG5cdFx0XHQvLyB0aGlzIGhhcHBlbnMgd2hlbiB0aGVyZSBpcyBubyBvdmVybGFwOlxuXHRcdFx0Ly8gfC0tLS0tfFxuXHRcdFx0Ly8gICAgICAgICAgfC0tLS18XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFJhbmdlKHN0YXJ0LCBlbmQpO1xuXHR9XG5cblx0dW5pb24ob3RoZXI6IFJhbmdlKTogUmFuZ2Uge1xuXHRcdGlmICh0aGlzLmNvbnRhaW5zKG90aGVyKSkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSBlbHNlIGlmIChvdGhlci5jb250YWlucyh0aGlzKSkge1xuXHRcdFx0cmV0dXJuIG90aGVyO1xuXHRcdH1cblx0XHRjb25zdCBzdGFydCA9IFBvc2l0aW9uLk1pbihvdGhlci5zdGFydCwgdGhpcy5fc3RhcnQpO1xuXHRcdGNvbnN0IGVuZCA9IFBvc2l0aW9uLk1heChvdGhlci5lbmQsIHRoaXMuZW5kKTtcblx0XHRyZXR1cm4gbmV3IFJhbmdlKHN0YXJ0LCBlbmQpO1xuXHR9XG5cblx0Z2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXJ0LmlzRXF1YWwodGhpcy5fZW5kKTtcblx0fVxuXG5cdGdldCBpc1NpbmdsZUxpbmUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXJ0LmxpbmUgPT09IHRoaXMuX2VuZC5saW5lO1xuXHR9XG5cblx0d2l0aChjaGFuZ2U6IHsgc3RhcnQ/OiBQb3NpdGlvbjsgZW5kPzogUG9zaXRpb24gfSk6IFJhbmdlO1xuXHR3aXRoKHN0YXJ0PzogUG9zaXRpb24sIGVuZD86IFBvc2l0aW9uKTogUmFuZ2U7XG5cdHdpdGgoc3RhcnRPckNoYW5nZTogUG9zaXRpb24gfCB1bmRlZmluZWQgfCB7IHN0YXJ0PzogUG9zaXRpb247IGVuZD86IFBvc2l0aW9uIH0sIGVuZDogUG9zaXRpb24gPSB0aGlzLmVuZCk6IFJhbmdlIHtcblxuXHRcdGlmIChzdGFydE9yQ2hhbmdlID09PSBudWxsIHx8IGVuZCA9PT0gbnVsbCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCk7XG5cdFx0fVxuXG5cdFx0bGV0IHN0YXJ0OiBQb3NpdGlvbjtcblx0XHRpZiAoIXN0YXJ0T3JDaGFuZ2UpIHtcblx0XHRcdHN0YXJ0ID0gdGhpcy5zdGFydDtcblxuXHRcdH0gZWxzZSBpZiAoUG9zaXRpb24uaXNQb3NpdGlvbihzdGFydE9yQ2hhbmdlKSkge1xuXHRcdFx0c3RhcnQgPSBzdGFydE9yQ2hhbmdlO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YXJ0ID0gc3RhcnRPckNoYW5nZS5zdGFydCB8fCB0aGlzLnN0YXJ0O1xuXHRcdFx0ZW5kID0gc3RhcnRPckNoYW5nZS5lbmQgfHwgdGhpcy5lbmQ7XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXJ0LmlzRXF1YWwodGhpcy5fc3RhcnQpICYmIGVuZC5pc0VxdWFsKHRoaXMuZW5kKSkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgUmFuZ2Uoc3RhcnQsIGVuZCk7XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4gW3RoaXMuc3RhcnQsIHRoaXMuZW5kXTtcblx0fVxuXG5cdFtTeW1ib2wuZm9yKCdkZWJ1Zy5kZXNjcmlwdGlvbicpXSgpIHtcblx0XHRyZXR1cm4gZ2V0RGVidWdEZXNjcmlwdGlvbk9mUmFuZ2UodGhpcyk7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgUmFuZ2Uge1xuXG5cdHN0YXRpYyBpc1NlbGVjdGlvbih0aGluZzogYW55KTogdGhpbmcgaXMgU2VsZWN0aW9uIHtcblx0XHRpZiAodGhpbmcgaW5zdGFuY2VvZiBTZWxlY3Rpb24pIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBSYW5nZS5pc1JhbmdlKHRoaW5nKVxuXHRcdFx0JiYgUG9zaXRpb24uaXNQb3NpdGlvbigoPFNlbGVjdGlvbj50aGluZykuYW5jaG9yKVxuXHRcdFx0JiYgUG9zaXRpb24uaXNQb3NpdGlvbigoPFNlbGVjdGlvbj50aGluZykuYWN0aXZlKVxuXHRcdFx0JiYgdHlwZW9mICg8U2VsZWN0aW9uPnRoaW5nKS5pc1JldmVyc2VkID09PSAnYm9vbGVhbic7XG5cdH1cblxuXHRwcml2YXRlIF9hbmNob3I6IFBvc2l0aW9uO1xuXG5cdHB1YmxpYyBnZXQgYW5jaG9yKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fYW5jaG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aXZlOiBQb3NpdGlvbjtcblxuXHRwdWJsaWMgZ2V0IGFjdGl2ZSgpOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2ZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKGFuY2hvcjogUG9zaXRpb24sIGFjdGl2ZTogUG9zaXRpb24pO1xuXHRjb25zdHJ1Y3RvcihhbmNob3JMaW5lOiBudW1iZXIsIGFuY2hvckNvbHVtbjogbnVtYmVyLCBhY3RpdmVMaW5lOiBudW1iZXIsIGFjdGl2ZUNvbHVtbjogbnVtYmVyKTtcblx0Y29uc3RydWN0b3IoYW5jaG9yTGluZU9yQW5jaG9yOiBudW1iZXIgfCBQb3NpdGlvbiwgYW5jaG9yQ29sdW1uT3JBY3RpdmU6IG51bWJlciB8IFBvc2l0aW9uLCBhY3RpdmVMaW5lPzogbnVtYmVyLCBhY3RpdmVDb2x1bW4/OiBudW1iZXIpIHtcblx0XHRsZXQgYW5jaG9yOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgYWN0aXZlOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0eXBlb2YgYW5jaG9yTGluZU9yQW5jaG9yID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgYW5jaG9yQ29sdW1uT3JBY3RpdmUgPT09ICdudW1iZXInICYmIHR5cGVvZiBhY3RpdmVMaW5lID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgYWN0aXZlQ29sdW1uID09PSAnbnVtYmVyJykge1xuXHRcdFx0YW5jaG9yID0gbmV3IFBvc2l0aW9uKGFuY2hvckxpbmVPckFuY2hvciwgYW5jaG9yQ29sdW1uT3JBY3RpdmUpO1xuXHRcdFx0YWN0aXZlID0gbmV3IFBvc2l0aW9uKGFjdGl2ZUxpbmUsIGFjdGl2ZUNvbHVtbik7XG5cdFx0fSBlbHNlIGlmIChQb3NpdGlvbi5pc1Bvc2l0aW9uKGFuY2hvckxpbmVPckFuY2hvcikgJiYgUG9zaXRpb24uaXNQb3NpdGlvbihhbmNob3JDb2x1bW5PckFjdGl2ZSkpIHtcblx0XHRcdGFuY2hvciA9IFBvc2l0aW9uLm9mKGFuY2hvckxpbmVPckFuY2hvcik7XG5cdFx0XHRhY3RpdmUgPSBQb3NpdGlvbi5vZihhbmNob3JDb2x1bW5PckFjdGl2ZSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFhbmNob3IgfHwgIWFjdGl2ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdH1cblxuXHRcdHN1cGVyKGFuY2hvciwgYWN0aXZlKTtcblxuXHRcdHRoaXMuX2FuY2hvciA9IGFuY2hvcjtcblx0XHR0aGlzLl9hY3RpdmUgPSBhY3RpdmU7XG5cdH1cblxuXHRnZXQgaXNSZXZlcnNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYW5jaG9yID09PSB0aGlzLl9lbmQ7XG5cdH1cblxuXHRvdmVycmlkZSB0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0OiB0aGlzLnN0YXJ0LFxuXHRcdFx0ZW5kOiB0aGlzLmVuZCxcblx0XHRcdGFjdGl2ZTogdGhpcy5hY3RpdmUsXG5cdFx0XHRhbmNob3I6IHRoaXMuYW5jaG9yXG5cdFx0fTtcblx0fVxuXG5cblx0W1N5bWJvbC5mb3IoJ2RlYnVnLmRlc2NyaXB0aW9uJyldKCkge1xuXHRcdHJldHVybiBnZXREZWJ1Z0Rlc2NyaXB0aW9uT2ZTZWxlY3Rpb24odGhpcyk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlYnVnRGVzY3JpcHRpb25PZlJhbmdlKHJhbmdlOiB2c2NvZGUuUmFuZ2UpOiBzdHJpbmcge1xuXHRyZXR1cm4gcmFuZ2UuaXNFbXB0eVxuXHRcdD8gYFske3JhbmdlLnN0YXJ0LmxpbmV9OiR7cmFuZ2Uuc3RhcnQuY2hhcmFjdGVyfSlgXG5cdFx0OiBgWyR7cmFuZ2Uuc3RhcnQubGluZX06JHtyYW5nZS5zdGFydC5jaGFyYWN0ZXJ9IC0+ICR7cmFuZ2UuZW5kLmxpbmV9OiR7cmFuZ2UuZW5kLmNoYXJhY3Rlcn0pYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlYnVnRGVzY3JpcHRpb25PZlNlbGVjdGlvbihzZWxlY3Rpb246IHZzY29kZS5TZWxlY3Rpb24pOiBzdHJpbmcge1xuXHRsZXQgcmFuZ2VTdHIgPSBnZXREZWJ1Z0Rlc2NyaXB0aW9uT2ZSYW5nZShzZWxlY3Rpb24pO1xuXHRpZiAoIXNlbGVjdGlvbi5pc0VtcHR5KSB7XG5cdFx0aWYgKHNlbGVjdGlvbi5hY3RpdmUuaXNFcXVhbChzZWxlY3Rpb24uc3RhcnQpKSB7XG5cdFx0XHRyYW5nZVN0ciA9IGB8JHtyYW5nZVN0cn1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyYW5nZVN0ciA9IGAke3JhbmdlU3RyfXxgO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmFuZ2VTdHI7XG59XG5cbmNvbnN0IHZhbGlkYXRlQ29ubmVjdGlvblRva2VuID0gKGNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nKSA9PiB7XG5cdGlmICh0eXBlb2YgY29ubmVjdGlvblRva2VuICE9PSAnc3RyaW5nJyB8fCBjb25uZWN0aW9uVG9rZW4ubGVuZ3RoID09PSAwIHx8ICEvXlswLTlBLVphLXpfXFwtXSskLy50ZXN0KGNvbm5lY3Rpb25Ub2tlbikpIHtcblx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2Nvbm5lY3Rpb25Ub2tlbicpO1xuXHR9XG59O1xuXG5cbmV4cG9ydCBjbGFzcyBSZXNvbHZlZEF1dGhvcml0eSB7XG5cdHB1YmxpYyBzdGF0aWMgaXNSZXNvbHZlZEF1dGhvcml0eShyZXNvbHZlZEF1dGhvcml0eTogYW55KTogcmVzb2x2ZWRBdXRob3JpdHkgaXMgUmVzb2x2ZWRBdXRob3JpdHkge1xuXHRcdHJldHVybiByZXNvbHZlZEF1dGhvcml0eVxuXHRcdFx0JiYgdHlwZW9mIHJlc29sdmVkQXV0aG9yaXR5ID09PSAnb2JqZWN0J1xuXHRcdFx0JiYgdHlwZW9mIHJlc29sdmVkQXV0aG9yaXR5Lmhvc3QgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2YgcmVzb2x2ZWRBdXRob3JpdHkucG9ydCA9PT0gJ251bWJlcidcblx0XHRcdCYmIChyZXNvbHZlZEF1dGhvcml0eS5jb25uZWN0aW9uVG9rZW4gPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgcmVzb2x2ZWRBdXRob3JpdHkuY29ubmVjdGlvblRva2VuID09PSAnc3RyaW5nJyk7XG5cdH1cblxuXHRyZWFkb25seSBob3N0OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBvcnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgY29ubmVjdGlvblRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIGNvbm5lY3Rpb25Ub2tlbj86IHN0cmluZykge1xuXHRcdGlmICh0eXBlb2YgaG9zdCAhPT0gJ3N0cmluZycgfHwgaG9zdC5sZW5ndGggPT09IDApIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnaG9zdCcpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHBvcnQgIT09ICdudW1iZXInIHx8IHBvcnQgPT09IDAgfHwgTWF0aC5yb3VuZChwb3J0KSAhPT0gcG9ydCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdwb3J0Jyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgY29ubmVjdGlvblRva2VuICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0dmFsaWRhdGVDb25uZWN0aW9uVG9rZW4oY29ubmVjdGlvblRva2VuKTtcblx0XHR9XG5cdFx0dGhpcy5ob3N0ID0gaG9zdDtcblx0XHR0aGlzLnBvcnQgPSBNYXRoLnJvdW5kKHBvcnQpO1xuXHRcdHRoaXMuY29ubmVjdGlvblRva2VuID0gY29ubmVjdGlvblRva2VuO1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIE1hbmFnZWRSZXNvbHZlZEF1dGhvcml0eSB7XG5cblx0cHVibGljIHN0YXRpYyBpc01hbmFnZWRSZXNvbHZlZEF1dGhvcml0eShyZXNvbHZlZEF1dGhvcml0eTogYW55KTogcmVzb2x2ZWRBdXRob3JpdHkgaXMgTWFuYWdlZFJlc29sdmVkQXV0aG9yaXR5IHtcblx0XHRyZXR1cm4gcmVzb2x2ZWRBdXRob3JpdHlcblx0XHRcdCYmIHR5cGVvZiByZXNvbHZlZEF1dGhvcml0eSA9PT0gJ29iamVjdCdcblx0XHRcdCYmIHR5cGVvZiByZXNvbHZlZEF1dGhvcml0eS5tYWtlQ29ubmVjdGlvbiA9PT0gJ2Z1bmN0aW9uJ1xuXHRcdFx0JiYgKHJlc29sdmVkQXV0aG9yaXR5LmNvbm5lY3Rpb25Ub2tlbiA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiByZXNvbHZlZEF1dGhvcml0eS5jb25uZWN0aW9uVG9rZW4gPT09ICdzdHJpbmcnKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBtYWtlQ29ubmVjdGlvbjogKCkgPT4gVGhlbmFibGU8dnNjb2RlLk1hbmFnZWRNZXNzYWdlUGFzc2luZz4sIHB1YmxpYyByZWFkb25seSBjb25uZWN0aW9uVG9rZW4/OiBzdHJpbmcpIHtcblx0XHRpZiAodHlwZW9mIGNvbm5lY3Rpb25Ub2tlbiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHZhbGlkYXRlQ29ubmVjdGlvblRva2VuKGNvbm5lY3Rpb25Ub2tlbik7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG5cdHN0YXRpYyBOb3RBdmFpbGFibGUobWVzc2FnZT86IHN0cmluZywgaGFuZGxlZD86IGJvb2xlYW4pOiBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yIHtcblx0XHRyZXR1cm4gbmV3IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3IobWVzc2FnZSwgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvckNvZGUuTm90QXZhaWxhYmxlLCBoYW5kbGVkKTtcblx0fVxuXG5cdHN0YXRpYyBUZW1wb3JhcmlseU5vdEF2YWlsYWJsZShtZXNzYWdlPzogc3RyaW5nKTogUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvciB7XG5cdFx0cmV0dXJuIG5ldyBSZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yKG1lc3NhZ2UsIFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlLlRlbXBvcmFyaWx5Tm90QXZhaWxhYmxlKTtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBfbWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgcmVhZG9ubHkgX2NvZGU6IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlO1xuXHRwdWJsaWMgcmVhZG9ubHkgX2RldGFpbDogYW55O1xuXG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2U/OiBzdHJpbmcsIGNvZGU6IFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3JDb2RlID0gUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvckNvZGUuVW5rbm93biwgZGV0YWlsPzogYW55KSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cblx0XHR0aGlzLl9tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLl9jb2RlID0gY29kZTtcblx0XHR0aGlzLl9kZXRhaWwgPSBkZXRhaWw7XG5cblx0XHQvLyB3b3JrYXJvdW5kIHdoZW4gZXh0ZW5kaW5nIGJ1aWx0aW4gb2JqZWN0cyBhbmQgd2hlbiBjb21waWxpbmcgdG8gRVM1LCBzZWU6XG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0LXdpa2kvYmxvYi9tYXN0ZXIvQnJlYWtpbmctQ2hhbmdlcy5tZCNleHRlbmRpbmctYnVpbHQtaW5zLWxpa2UtZXJyb3ItYXJyYXktYW5kLW1hcC1tYXktbm8tbG9uZ2VyLXdvcmtcblx0XHRPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJFcnJvci5wcm90b3R5cGUpO1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIEVuZE9mTGluZSB7XG5cdExGID0gMSxcblx0Q1JMRiA9IDJcbn1cblxuZXhwb3J0IGVudW0gRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlIHtcblx0UmVwbGFjZSA9IDEsXG5cdEFwcGVuZCA9IDIsXG5cdFByZXBlbmQgPSAzXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFRleHRFZGl0IHtcblxuXHRzdGF0aWMgaXNUZXh0RWRpdCh0aGluZzogYW55KTogdGhpbmcgaXMgVGV4dEVkaXQge1xuXHRcdGlmICh0aGluZyBpbnN0YW5jZW9mIFRleHRFZGl0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCF0aGluZykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gUmFuZ2UuaXNSYW5nZSgoPFRleHRFZGl0PnRoaW5nKSlcblx0XHRcdCYmIHR5cGVvZiAoPFRleHRFZGl0PnRoaW5nKS5uZXdUZXh0ID09PSAnc3RyaW5nJztcblx0fVxuXG5cdHN0YXRpYyByZXBsYWNlKHJhbmdlOiBSYW5nZSwgbmV3VGV4dDogc3RyaW5nKTogVGV4dEVkaXQge1xuXHRcdHJldHVybiBuZXcgVGV4dEVkaXQocmFuZ2UsIG5ld1RleHQpO1xuXHR9XG5cblx0c3RhdGljIGluc2VydChwb3NpdGlvbjogUG9zaXRpb24sIG5ld1RleHQ6IHN0cmluZyk6IFRleHRFZGl0IHtcblx0XHRyZXR1cm4gVGV4dEVkaXQucmVwbGFjZShuZXcgUmFuZ2UocG9zaXRpb24sIHBvc2l0aW9uKSwgbmV3VGV4dCk7XG5cdH1cblxuXHRzdGF0aWMgZGVsZXRlKHJhbmdlOiBSYW5nZSk6IFRleHRFZGl0IHtcblx0XHRyZXR1cm4gVGV4dEVkaXQucmVwbGFjZShyYW5nZSwgJycpO1xuXHR9XG5cblx0c3RhdGljIHNldEVuZE9mTGluZShlb2w6IEVuZE9mTGluZSk6IFRleHRFZGl0IHtcblx0XHRjb25zdCByZXQgPSBuZXcgVGV4dEVkaXQobmV3IFJhbmdlKG5ldyBQb3NpdGlvbigwLCAwKSwgbmV3IFBvc2l0aW9uKDAsIDApKSwgJycpO1xuXHRcdHJldC5uZXdFb2wgPSBlb2w7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHByb3RlY3RlZCBfcmFuZ2U6IFJhbmdlO1xuXHRwcm90ZWN0ZWQgX25ld1RleHQ6IHN0cmluZyB8IG51bGw7XG5cdHByb3RlY3RlZCBfbmV3RW9sPzogRW5kT2ZMaW5lO1xuXG5cdGdldCByYW5nZSgpOiBSYW5nZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JhbmdlO1xuXHR9XG5cblx0c2V0IHJhbmdlKHZhbHVlOiBSYW5nZSkge1xuXHRcdGlmICh2YWx1ZSAmJiAhUmFuZ2UuaXNSYW5nZSh2YWx1ZSkpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgncmFuZ2UnKTtcblx0XHR9XG5cdFx0dGhpcy5fcmFuZ2UgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBuZXdUZXh0KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX25ld1RleHQgfHwgJyc7XG5cdH1cblxuXHRzZXQgbmV3VGV4dCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnbmV3VGV4dCcpO1xuXHRcdH1cblx0XHR0aGlzLl9uZXdUZXh0ID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgbmV3RW9sKCk6IEVuZE9mTGluZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX25ld0VvbDtcblx0fVxuXG5cdHNldCBuZXdFb2wodmFsdWU6IEVuZE9mTGluZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ25ld0VvbCcpO1xuXHRcdH1cblx0XHR0aGlzLl9uZXdFb2wgPSB2YWx1ZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHJhbmdlOiBSYW5nZSwgbmV3VGV4dDogc3RyaW5nIHwgbnVsbCkge1xuXHRcdHRoaXMuX3JhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy5fbmV3VGV4dCA9IG5ld1RleHQ7XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IHRoaXMucmFuZ2UsXG5cdFx0XHRuZXdUZXh0OiB0aGlzLm5ld1RleHQsXG5cdFx0XHRuZXdFb2w6IHRoaXMuX25ld0VvbFxuXHRcdH07XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgTm90ZWJvb2tFZGl0IGltcGxlbWVudHMgdnNjb2RlLk5vdGVib29rRWRpdCB7XG5cblx0c3RhdGljIGlzTm90ZWJvb2tDZWxsRWRpdCh0aGluZzogYW55KTogdGhpbmcgaXMgTm90ZWJvb2tFZGl0IHtcblx0XHRpZiAodGhpbmcgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBOb3RlYm9va1JhbmdlLmlzTm90ZWJvb2tSYW5nZSgoPE5vdGVib29rRWRpdD50aGluZykpXG5cdFx0XHQmJiBBcnJheS5pc0FycmF5KCg8Tm90ZWJvb2tFZGl0PnRoaW5nKS5uZXdDZWxscyk7XG5cdH1cblxuXHRzdGF0aWMgcmVwbGFjZUNlbGxzKHJhbmdlOiBOb3RlYm9va1JhbmdlLCBuZXdDZWxsczogTm90ZWJvb2tDZWxsRGF0YVtdKTogTm90ZWJvb2tFZGl0IHtcblx0XHRyZXR1cm4gbmV3IE5vdGVib29rRWRpdChyYW5nZSwgbmV3Q2VsbHMpO1xuXHR9XG5cblx0c3RhdGljIGluc2VydENlbGxzKGluZGV4OiBudW1iZXIsIG5ld0NlbGxzOiB2c2NvZGUuTm90ZWJvb2tDZWxsRGF0YVtdKTogdnNjb2RlLk5vdGVib29rRWRpdCB7XG5cdFx0cmV0dXJuIG5ldyBOb3RlYm9va0VkaXQobmV3IE5vdGVib29rUmFuZ2UoaW5kZXgsIGluZGV4KSwgbmV3Q2VsbHMpO1xuXHR9XG5cblx0c3RhdGljIGRlbGV0ZUNlbGxzKHJhbmdlOiBOb3RlYm9va1JhbmdlKTogTm90ZWJvb2tFZGl0IHtcblx0XHRyZXR1cm4gbmV3IE5vdGVib29rRWRpdChyYW5nZSwgW10pO1xuXHR9XG5cblx0c3RhdGljIHVwZGF0ZUNlbGxNZXRhZGF0YShpbmRleDogbnVtYmVyLCBuZXdNZXRhZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSk6IE5vdGVib29rRWRpdCB7XG5cdFx0Y29uc3QgZWRpdCA9IG5ldyBOb3RlYm9va0VkaXQobmV3IE5vdGVib29rUmFuZ2UoaW5kZXgsIGluZGV4KSwgW10pO1xuXHRcdGVkaXQubmV3Q2VsbE1ldGFkYXRhID0gbmV3TWV0YWRhdGE7XG5cdFx0cmV0dXJuIGVkaXQ7XG5cdH1cblxuXHRzdGF0aWMgdXBkYXRlTm90ZWJvb2tNZXRhZGF0YShuZXdNZXRhZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSk6IE5vdGVib29rRWRpdCB7XG5cdFx0Y29uc3QgZWRpdCA9IG5ldyBOb3RlYm9va0VkaXQobmV3IE5vdGVib29rUmFuZ2UoMCwgMCksIFtdKTtcblx0XHRlZGl0Lm5ld05vdGVib29rTWV0YWRhdGEgPSBuZXdNZXRhZGF0YTtcblx0XHRyZXR1cm4gZWRpdDtcblx0fVxuXG5cdHJhbmdlOiBOb3RlYm9va1JhbmdlO1xuXHRuZXdDZWxsczogTm90ZWJvb2tDZWxsRGF0YVtdO1xuXHRuZXdDZWxsTWV0YWRhdGE/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xuXHRuZXdOb3RlYm9va01ldGFkYXRhPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcblxuXHRjb25zdHJ1Y3RvcihyYW5nZTogTm90ZWJvb2tSYW5nZSwgbmV3Q2VsbHM6IE5vdGVib29rQ2VsbERhdGFbXSkge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLm5ld0NlbGxzID0gbmV3Q2VsbHM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNuaXBwZXRUZXh0RWRpdCBpbXBsZW1lbnRzIHZzY29kZS5TbmlwcGV0VGV4dEVkaXQge1xuXG5cdHN0YXRpYyBpc1NuaXBwZXRUZXh0RWRpdCh0aGluZzogYW55KTogdGhpbmcgaXMgU25pcHBldFRleHRFZGl0IHtcblx0XHRpZiAodGhpbmcgaW5zdGFuY2VvZiBTbmlwcGV0VGV4dEVkaXQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBSYW5nZS5pc1JhbmdlKCg8U25pcHBldFRleHRFZGl0PnRoaW5nKS5yYW5nZSlcblx0XHRcdCYmIFNuaXBwZXRTdHJpbmcuaXNTbmlwcGV0U3RyaW5nKCg8U25pcHBldFRleHRFZGl0PnRoaW5nKS5zbmlwcGV0KTtcblx0fVxuXG5cdHN0YXRpYyByZXBsYWNlKHJhbmdlOiBSYW5nZSwgc25pcHBldDogU25pcHBldFN0cmluZyk6IFNuaXBwZXRUZXh0RWRpdCB7XG5cdFx0cmV0dXJuIG5ldyBTbmlwcGV0VGV4dEVkaXQocmFuZ2UsIHNuaXBwZXQpO1xuXHR9XG5cblx0c3RhdGljIGluc2VydChwb3NpdGlvbjogUG9zaXRpb24sIHNuaXBwZXQ6IFNuaXBwZXRTdHJpbmcpOiBTbmlwcGV0VGV4dEVkaXQge1xuXHRcdHJldHVybiBTbmlwcGV0VGV4dEVkaXQucmVwbGFjZShuZXcgUmFuZ2UocG9zaXRpb24sIHBvc2l0aW9uKSwgc25pcHBldCk7XG5cdH1cblxuXHRyYW5nZTogUmFuZ2U7XG5cblx0c25pcHBldDogU25pcHBldFN0cmluZztcblxuXHRrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IocmFuZ2U6IFJhbmdlLCBzbmlwcGV0OiBTbmlwcGV0U3RyaW5nKSB7XG5cdFx0dGhpcy5yYW5nZSA9IHJhbmdlO1xuXHRcdHRoaXMuc25pcHBldCA9IHNuaXBwZXQ7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZU9wZXJhdGlvbk9wdGlvbnMge1xuXHRyZWFkb25seSBvdmVyd3JpdGU/OiBib29sZWFuO1xuXHRyZWFkb25seSBpZ25vcmVJZkV4aXN0cz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlnbm9yZUlmTm90RXhpc3RzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgcmVjdXJzaXZlPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29udGVudHM/OiBVaW50OEFycmF5IHwgdnNjb2RlLkRhdGFUcmFuc2ZlckZpbGU7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEZpbGVFZGl0VHlwZSB7XG5cdEZpbGUgPSAxLFxuXHRUZXh0ID0gMixcblx0Q2VsbCA9IDMsXG5cdENlbGxSZXBsYWNlID0gNSxcblx0U25pcHBldCA9IDYsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVPcGVyYXRpb24ge1xuXHRyZWFkb25seSBfdHlwZTogRmlsZUVkaXRUeXBlLkZpbGU7XG5cdHJlYWRvbmx5IGZyb20/OiBVUkk7XG5cdHJlYWRvbmx5IHRvPzogVVJJO1xuXHRyZWFkb25seSBvcHRpb25zPzogSUZpbGVPcGVyYXRpb25PcHRpb25zO1xuXHRyZWFkb25seSBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVRleHRFZGl0IHtcblx0cmVhZG9ubHkgX3R5cGU6IEZpbGVFZGl0VHlwZS5UZXh0O1xuXHRyZWFkb25seSB1cmk6IFVSSTtcblx0cmVhZG9ubHkgZWRpdDogVGV4dEVkaXQ7XG5cdHJlYWRvbmx5IG1ldGFkYXRhPzogdnNjb2RlLldvcmtzcGFjZUVkaXRFbnRyeU1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU25pcHBldFRleHRFZGl0IHtcblx0cmVhZG9ubHkgX3R5cGU6IEZpbGVFZGl0VHlwZS5TbmlwcGV0O1xuXHRyZWFkb25seSB1cmk6IFVSSTtcblx0cmVhZG9ubHkgcmFuZ2U6IHZzY29kZS5SYW5nZTtcblx0cmVhZG9ubHkgZWRpdDogdnNjb2RlLlNuaXBwZXRTdHJpbmc7XG5cdHJlYWRvbmx5IG1ldGFkYXRhPzogdnNjb2RlLldvcmtzcGFjZUVkaXRFbnRyeU1ldGFkYXRhO1xuXHRyZWFkb25seSBrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVDZWxsRWRpdCB7XG5cdHJlYWRvbmx5IF90eXBlOiBGaWxlRWRpdFR5cGUuQ2VsbDtcblx0cmVhZG9ubHkgdXJpOiBVUkk7XG5cdHJlYWRvbmx5IGVkaXQ/OiBJQ2VsbE1ldGFkYXRhRWRpdCB8IElEb2N1bWVudE1ldGFkYXRhRWRpdDtcblx0cmVhZG9ubHkgbWV0YWRhdGE/OiB2c2NvZGUuV29ya3NwYWNlRWRpdEVudHJ5TWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNlbGxFZGl0IHtcblx0cmVhZG9ubHkgX3R5cGU6IEZpbGVFZGl0VHlwZS5DZWxsUmVwbGFjZTtcblx0cmVhZG9ubHkgbWV0YWRhdGE/OiB2c2NvZGUuV29ya3NwYWNlRWRpdEVudHJ5TWV0YWRhdGE7XG5cdHJlYWRvbmx5IHVyaTogVVJJO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBjb3VudDogbnVtYmVyO1xuXHRyZWFkb25seSBjZWxsczogdnNjb2RlLk5vdGVib29rQ2VsbERhdGFbXTtcbn1cblxuXG50eXBlIFdvcmtzcGFjZUVkaXRFbnRyeSA9IElGaWxlT3BlcmF0aW9uIHwgSUZpbGVUZXh0RWRpdCB8IElGaWxlU25pcHBldFRleHRFZGl0IHwgSUZpbGVDZWxsRWRpdCB8IElDZWxsRWRpdDtcblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgV29ya3NwYWNlRWRpdCBpbXBsZW1lbnRzIHZzY29kZS5Xb3Jrc3BhY2VFZGl0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0czogV29ya3NwYWNlRWRpdEVudHJ5W10gPSBbXTtcblxuXG5cdF9hbGxFbnRyaWVzKCk6IFJlYWRvbmx5QXJyYXk8V29ya3NwYWNlRWRpdEVudHJ5PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRzO1xuXHR9XG5cblx0Ly8gLS0tIGZpbGVcblxuXHRyZW5hbWVGaWxlKGZyb206IHZzY29kZS5VcmksIHRvOiB2c2NvZGUuVXJpLCBvcHRpb25zPzogeyByZWFkb25seSBvdmVyd3JpdGU/OiBib29sZWFuOyByZWFkb25seSBpZ25vcmVJZkV4aXN0cz86IGJvb2xlYW4gfSwgbWV0YWRhdGE/OiB2c2NvZGUuV29ya3NwYWNlRWRpdEVudHJ5TWV0YWRhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0cy5wdXNoKHsgX3R5cGU6IEZpbGVFZGl0VHlwZS5GaWxlLCBmcm9tLCB0bywgb3B0aW9ucywgbWV0YWRhdGEgfSk7XG5cdH1cblxuXHRjcmVhdGVGaWxlKHVyaTogdnNjb2RlLlVyaSwgb3B0aW9ucz86IHsgcmVhZG9ubHkgb3ZlcndyaXRlPzogYm9vbGVhbjsgcmVhZG9ubHkgaWdub3JlSWZFeGlzdHM/OiBib29sZWFuOyByZWFkb25seSBjb250ZW50cz86IFVpbnQ4QXJyYXkgfCB2c2NvZGUuRGF0YVRyYW5zZmVyRmlsZSB9LCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRzLnB1c2goeyBfdHlwZTogRmlsZUVkaXRUeXBlLkZpbGUsIGZyb206IHVuZGVmaW5lZCwgdG86IHVyaSwgb3B0aW9ucywgbWV0YWRhdGEgfSk7XG5cdH1cblxuXHRkZWxldGVGaWxlKHVyaTogdnNjb2RlLlVyaSwgb3B0aW9ucz86IHsgcmVhZG9ubHkgcmVjdXJzaXZlPzogYm9vbGVhbjsgcmVhZG9ubHkgaWdub3JlSWZOb3RFeGlzdHM/OiBib29sZWFuIH0sIG1ldGFkYXRhPzogdnNjb2RlLldvcmtzcGFjZUVkaXRFbnRyeU1ldGFkYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdHMucHVzaCh7IF90eXBlOiBGaWxlRWRpdFR5cGUuRmlsZSwgZnJvbTogdXJpLCB0bzogdW5kZWZpbmVkLCBvcHRpb25zLCBtZXRhZGF0YSB9KTtcblx0fVxuXG5cdC8vIC0tLSBub3RlYm9va1xuXG5cdHByaXZhdGUgcmVwbGFjZU5vdGVib29rTWV0YWRhdGEodXJpOiBVUkksIHZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRzLnB1c2goeyBfdHlwZTogRmlsZUVkaXRUeXBlLkNlbGwsIG1ldGFkYXRhLCB1cmksIGVkaXQ6IHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5Eb2N1bWVudE1ldGFkYXRhLCBtZXRhZGF0YTogdmFsdWUgfSB9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVwbGFjZU5vdGVib29rQ2VsbHModXJpOiBVUkksIHN0YXJ0T3JSYW5nZTogdnNjb2RlLk5vdGVib29rUmFuZ2UsIGNlbGxEYXRhOiB2c2NvZGUuTm90ZWJvb2tDZWxsRGF0YVtdLCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IHN0YXJ0ID0gc3RhcnRPclJhbmdlLnN0YXJ0O1xuXHRcdGNvbnN0IGVuZCA9IHN0YXJ0T3JSYW5nZS5lbmQ7XG5cblx0XHRpZiAoc3RhcnQgIT09IGVuZCB8fCBjZWxsRGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9lZGl0cy5wdXNoKHsgX3R5cGU6IEZpbGVFZGl0VHlwZS5DZWxsUmVwbGFjZSwgdXJpLCBpbmRleDogc3RhcnQsIGNvdW50OiBlbmQgLSBzdGFydCwgY2VsbHM6IGNlbGxEYXRhLCBtZXRhZGF0YSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlcGxhY2VOb3RlYm9va0NlbGxNZXRhZGF0YSh1cmk6IFVSSSwgaW5kZXg6IG51bWJlciwgY2VsbE1ldGFkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRzLnB1c2goeyBfdHlwZTogRmlsZUVkaXRUeXBlLkNlbGwsIG1ldGFkYXRhLCB1cmksIGVkaXQ6IHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXgsIG1ldGFkYXRhOiBjZWxsTWV0YWRhdGEgfSB9KTtcblx0fVxuXG5cdC8vIC0tLSB0ZXh0XG5cblx0cmVwbGFjZSh1cmk6IFVSSSwgcmFuZ2U6IFJhbmdlLCBuZXdUZXh0OiBzdHJpbmcsIG1ldGFkYXRhPzogdnNjb2RlLldvcmtzcGFjZUVkaXRFbnRyeU1ldGFkYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdHMucHVzaCh7IF90eXBlOiBGaWxlRWRpdFR5cGUuVGV4dCwgdXJpLCBlZGl0OiBuZXcgVGV4dEVkaXQocmFuZ2UsIG5ld1RleHQpLCBtZXRhZGF0YSB9KTtcblx0fVxuXG5cdGluc2VydChyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogUG9zaXRpb24sIG5ld1RleHQ6IHN0cmluZywgbWV0YWRhdGE/OiB2c2NvZGUuV29ya3NwYWNlRWRpdEVudHJ5TWV0YWRhdGEpOiB2b2lkIHtcblx0XHR0aGlzLnJlcGxhY2UocmVzb3VyY2UsIG5ldyBSYW5nZShwb3NpdGlvbiwgcG9zaXRpb24pLCBuZXdUZXh0LCBtZXRhZGF0YSk7XG5cdH1cblxuXHRkZWxldGUocmVzb3VyY2U6IFVSSSwgcmFuZ2U6IFJhbmdlLCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSk6IHZvaWQge1xuXHRcdHRoaXMucmVwbGFjZShyZXNvdXJjZSwgcmFuZ2UsICcnLCBtZXRhZGF0YSk7XG5cdH1cblxuXHQvLyAtLS0gdGV4dCAoTWFwbGlrZSlcblxuXHRoYXModXJpOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdHMuc29tZShlZGl0ID0+IGVkaXQuX3R5cGUgPT09IEZpbGVFZGl0VHlwZS5UZXh0ICYmIGVkaXQudXJpLnRvU3RyaW5nKCkgPT09IHVyaS50b1N0cmluZygpKTtcblx0fVxuXG5cdHNldCh1cmk6IFVSSSwgZWRpdHM6IFJlYWRvbmx5QXJyYXk8VGV4dEVkaXQgfCBTbmlwcGV0VGV4dEVkaXQ+KTogdm9pZDtcblx0c2V0KHVyaTogVVJJLCBlZGl0czogUmVhZG9ubHlBcnJheTxbVGV4dEVkaXQgfCBTbmlwcGV0VGV4dEVkaXQsIHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSB8IHVuZGVmaW5lZF0+KTogdm9pZDtcblx0c2V0KHVyaTogVVJJLCBlZGl0czogcmVhZG9ubHkgTm90ZWJvb2tFZGl0W10pOiB2b2lkO1xuXHRzZXQodXJpOiBVUkksIGVkaXRzOiBSZWFkb25seUFycmF5PFtOb3RlYm9va0VkaXQsIHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSB8IHVuZGVmaW5lZF0+KTogdm9pZDtcblxuXHRzZXQodXJpOiBVUkksIGVkaXRzOiBudWxsIHwgdW5kZWZpbmVkIHwgUmVhZG9ubHlBcnJheTxUZXh0RWRpdCB8IFNuaXBwZXRUZXh0RWRpdCB8IE5vdGVib29rRWRpdCB8IFtOb3RlYm9va0VkaXQsIHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSB8IHVuZGVmaW5lZF0gfCBbVGV4dEVkaXQgfCBTbmlwcGV0VGV4dEVkaXQsIHZzY29kZS5Xb3Jrc3BhY2VFZGl0RW50cnlNZXRhZGF0YSB8IHVuZGVmaW5lZF0+KTogdm9pZCB7XG5cdFx0aWYgKCFlZGl0cykge1xuXHRcdFx0Ly8gcmVtb3ZlIGFsbCB0ZXh0LCBzbmlwcGV0LCBvciBub3RlYm9vayBlZGl0cyBmb3IgYHVyaWBcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZWRpdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuX2VkaXRzW2ldO1xuXHRcdFx0XHRzd2l0Y2ggKGVsZW1lbnQuX3R5cGUpIHtcblx0XHRcdFx0XHRjYXNlIEZpbGVFZGl0VHlwZS5UZXh0OlxuXHRcdFx0XHRcdGNhc2UgRmlsZUVkaXRUeXBlLlNuaXBwZXQ6XG5cdFx0XHRcdFx0Y2FzZSBGaWxlRWRpdFR5cGUuQ2VsbDpcblx0XHRcdFx0XHRjYXNlIEZpbGVFZGl0VHlwZS5DZWxsUmVwbGFjZTpcblx0XHRcdFx0XHRcdGlmIChlbGVtZW50LnVyaS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9lZGl0c1tpXSA9IHVuZGVmaW5lZCE7IC8vIHdpbGwgYmUgY29hbGVzY2VkIGRvd24gYmVsb3dcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb2FsZXNjZUluUGxhY2UodGhpcy5fZWRpdHMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBhcHBlbmQgZWRpdCB0byB0aGUgZW5kXG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRPclR1cGxlIG9mIGVkaXRzKSB7XG5cdFx0XHRcdGlmICghZWRpdE9yVHVwbGUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsZXQgZWRpdDogVGV4dEVkaXQgfCBTbmlwcGV0VGV4dEVkaXQgfCBOb3RlYm9va0VkaXQ7XG5cdFx0XHRcdGxldCBtZXRhZGF0YTogdnNjb2RlLldvcmtzcGFjZUVkaXRFbnRyeU1ldGFkYXRhIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShlZGl0T3JUdXBsZSkpIHtcblx0XHRcdFx0XHRlZGl0ID0gZWRpdE9yVHVwbGVbMF07XG5cdFx0XHRcdFx0bWV0YWRhdGEgPSBlZGl0T3JUdXBsZVsxXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlZGl0ID0gZWRpdE9yVHVwbGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKE5vdGVib29rRWRpdC5pc05vdGVib29rQ2VsbEVkaXQoZWRpdCkpIHtcblx0XHRcdFx0XHRpZiAoZWRpdC5uZXdDZWxsTWV0YWRhdGEpIHtcblx0XHRcdFx0XHRcdHRoaXMucmVwbGFjZU5vdGVib29rQ2VsbE1ldGFkYXRhKHVyaSwgZWRpdC5yYW5nZS5zdGFydCwgZWRpdC5uZXdDZWxsTWV0YWRhdGEsIG1ldGFkYXRhKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGVkaXQubmV3Tm90ZWJvb2tNZXRhZGF0YSkge1xuXHRcdFx0XHRcdFx0dGhpcy5yZXBsYWNlTm90ZWJvb2tNZXRhZGF0YSh1cmksIGVkaXQubmV3Tm90ZWJvb2tNZXRhZGF0YSwgbWV0YWRhdGEpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLnJlcGxhY2VOb3RlYm9va0NlbGxzKHVyaSwgZWRpdC5yYW5nZSwgZWRpdC5uZXdDZWxscywgbWV0YWRhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChTbmlwcGV0VGV4dEVkaXQuaXNTbmlwcGV0VGV4dEVkaXQoZWRpdCkpIHtcblx0XHRcdFx0XHR0aGlzLl9lZGl0cy5wdXNoKHsgX3R5cGU6IEZpbGVFZGl0VHlwZS5TbmlwcGV0LCB1cmksIHJhbmdlOiBlZGl0LnJhbmdlLCBlZGl0OiBlZGl0LnNuaXBwZXQsIG1ldGFkYXRhLCBrZWVwV2hpdGVzcGFjZTogZWRpdC5rZWVwV2hpdGVzcGFjZSB9KTtcblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX2VkaXRzLnB1c2goeyBfdHlwZTogRmlsZUVkaXRUeXBlLlRleHQsIHVyaSwgZWRpdCwgbWV0YWRhdGEgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXQodXJpOiBVUkkpOiBUZXh0RWRpdFtdIHtcblx0XHRjb25zdCByZXM6IFRleHRFZGl0W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiB0aGlzLl9lZGl0cykge1xuXHRcdFx0aWYgKGNhbmRpZGF0ZS5fdHlwZSA9PT0gRmlsZUVkaXRUeXBlLlRleHQgJiYgY2FuZGlkYXRlLnVyaS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRyZXMucHVzaChjYW5kaWRhdGUuZWRpdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHRlbnRyaWVzKCk6IFtVUkksIFRleHRFZGl0W11dW10ge1xuXHRcdGNvbnN0IHRleHRFZGl0cyA9IG5ldyBSZXNvdXJjZU1hcDxbVVJJLCBUZXh0RWRpdFtdXT4oKTtcblx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiB0aGlzLl9lZGl0cykge1xuXHRcdFx0aWYgKGNhbmRpZGF0ZS5fdHlwZSA9PT0gRmlsZUVkaXRUeXBlLlRleHQpIHtcblx0XHRcdFx0bGV0IHRleHRFZGl0ID0gdGV4dEVkaXRzLmdldChjYW5kaWRhdGUudXJpKTtcblx0XHRcdFx0aWYgKCF0ZXh0RWRpdCkge1xuXHRcdFx0XHRcdHRleHRFZGl0ID0gW2NhbmRpZGF0ZS51cmksIFtdXTtcblx0XHRcdFx0XHR0ZXh0RWRpdHMuc2V0KGNhbmRpZGF0ZS51cmksIHRleHRFZGl0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0RWRpdFsxXS5wdXNoKGNhbmRpZGF0ZS5lZGl0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFsuLi50ZXh0RWRpdHMudmFsdWVzKCldO1xuXHR9XG5cblx0Z2V0IHNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5lbnRyaWVzKCkubGVuZ3RoO1xuXHR9XG5cblx0dG9KU09OKCk6IGFueSB7XG5cdFx0cmV0dXJuIHRoaXMuZW50cmllcygpO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFNuaXBwZXRTdHJpbmcge1xuXG5cdHN0YXRpYyBpc1NuaXBwZXRTdHJpbmcodGhpbmc6IGFueSk6IHRoaW5nIGlzIFNuaXBwZXRTdHJpbmcge1xuXHRcdGlmICh0aGluZyBpbnN0YW5jZW9mIFNuaXBwZXRTdHJpbmcpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlb2YgKDxTbmlwcGV0U3RyaW5nPnRoaW5nKS52YWx1ZSA9PT0gJ3N0cmluZyc7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZXNjYXBlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiB2YWx1ZS5yZXBsYWNlKC9cXCR8fXxcXFxcL2csICdcXFxcJCYnKTtcblx0fVxuXG5cdHByaXZhdGUgX3RhYnN0b3A6IG51bWJlciA9IDE7XG5cblx0dmFsdWU6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZT86IHN0cmluZykge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZSB8fCAnJztcblx0fVxuXG5cdGFwcGVuZFRleHQoc3RyaW5nOiBzdHJpbmcpOiBTbmlwcGV0U3RyaW5nIHtcblx0XHR0aGlzLnZhbHVlICs9IFNuaXBwZXRTdHJpbmcuX2VzY2FwZShzdHJpbmcpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0YXBwZW5kVGFic3RvcChudW1iZXI6IG51bWJlciA9IHRoaXMuX3RhYnN0b3ArKyk6IFNuaXBwZXRTdHJpbmcge1xuXHRcdHRoaXMudmFsdWUgKz0gJyQnO1xuXHRcdHRoaXMudmFsdWUgKz0gbnVtYmVyO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0YXBwZW5kUGxhY2Vob2xkZXIodmFsdWU6IHN0cmluZyB8ICgoc25pcHBldDogU25pcHBldFN0cmluZykgPT4gYW55KSwgbnVtYmVyOiBudW1iZXIgPSB0aGlzLl90YWJzdG9wKyspOiBTbmlwcGV0U3RyaW5nIHtcblxuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNvbnN0IG5lc3RlZCA9IG5ldyBTbmlwcGV0U3RyaW5nKCk7XG5cdFx0XHRuZXN0ZWQuX3RhYnN0b3AgPSB0aGlzLl90YWJzdG9wO1xuXHRcdFx0dmFsdWUobmVzdGVkKTtcblx0XHRcdHRoaXMuX3RhYnN0b3AgPSBuZXN0ZWQuX3RhYnN0b3A7XG5cdFx0XHR2YWx1ZSA9IG5lc3RlZC52YWx1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFsdWUgPSBTbmlwcGV0U3RyaW5nLl9lc2NhcGUodmFsdWUpO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsdWUgKz0gJyR7Jztcblx0XHR0aGlzLnZhbHVlICs9IG51bWJlcjtcblx0XHR0aGlzLnZhbHVlICs9ICc6Jztcblx0XHR0aGlzLnZhbHVlICs9IHZhbHVlO1xuXHRcdHRoaXMudmFsdWUgKz0gJ30nO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRhcHBlbmRDaG9pY2UodmFsdWVzOiBzdHJpbmdbXSwgbnVtYmVyOiBudW1iZXIgPSB0aGlzLl90YWJzdG9wKyspOiBTbmlwcGV0U3RyaW5nIHtcblx0XHRjb25zdCB2YWx1ZSA9IHZhbHVlcy5tYXAocyA9PiBzLnJlcGxhY2VBbGwoL1t8XFxcXCxdL2csICdcXFxcJCYnKSkuam9pbignLCcpO1xuXG5cdFx0dGhpcy52YWx1ZSArPSAnJHsnO1xuXHRcdHRoaXMudmFsdWUgKz0gbnVtYmVyO1xuXHRcdHRoaXMudmFsdWUgKz0gJ3wnO1xuXHRcdHRoaXMudmFsdWUgKz0gdmFsdWU7XG5cdFx0dGhpcy52YWx1ZSArPSAnfH0nO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRhcHBlbmRWYXJpYWJsZShuYW1lOiBzdHJpbmcsIGRlZmF1bHRWYWx1ZT86IHN0cmluZyB8ICgoc25pcHBldDogU25pcHBldFN0cmluZykgPT4gYW55KSk6IFNuaXBwZXRTdHJpbmcge1xuXG5cdFx0aWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNvbnN0IG5lc3RlZCA9IG5ldyBTbmlwcGV0U3RyaW5nKCk7XG5cdFx0XHRuZXN0ZWQuX3RhYnN0b3AgPSB0aGlzLl90YWJzdG9wO1xuXHRcdFx0ZGVmYXVsdFZhbHVlKG5lc3RlZCk7XG5cdFx0XHR0aGlzLl90YWJzdG9wID0gbmVzdGVkLl90YWJzdG9wO1xuXHRcdFx0ZGVmYXVsdFZhbHVlID0gbmVzdGVkLnZhbHVlO1xuXG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0ZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlLnJlcGxhY2UoL1xcJHx9L2csICdcXFxcJCYnKTsgLy8gQ29kZVFMIFtTTTAyMzgzXSBJIGRvIG5vdCB3YW50IHRvIGVzY2FwZSBiYWNrc2xhc2hlcyBoZXJlXG5cdFx0fVxuXG5cdFx0dGhpcy52YWx1ZSArPSAnJHsnO1xuXHRcdHRoaXMudmFsdWUgKz0gbmFtZTtcblx0XHRpZiAoZGVmYXVsdFZhbHVlKSB7XG5cdFx0XHR0aGlzLnZhbHVlICs9ICc6Jztcblx0XHRcdHRoaXMudmFsdWUgKz0gZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0XHR0aGlzLnZhbHVlICs9ICd9JztcblxuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gRGlhZ25vc3RpY1RhZyB7XG5cdFVubmVjZXNzYXJ5ID0gMSxcblx0RGVwcmVjYXRlZCA9IDJcbn1cblxuZXhwb3J0IGVudW0gRGlhZ25vc3RpY1NldmVyaXR5IHtcblx0SGludCA9IDMsXG5cdEluZm9ybWF0aW9uID0gMixcblx0V2FybmluZyA9IDEsXG5cdEVycm9yID0gMFxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBMb2NhdGlvbiB7XG5cblx0c3RhdGljIGlzTG9jYXRpb24odGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5Mb2NhdGlvbiB7XG5cdFx0aWYgKHRoaW5nIGluc3RhbmNlb2YgTG9jYXRpb24pIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBSYW5nZS5pc1JhbmdlKCg8TG9jYXRpb24+dGhpbmcpLnJhbmdlKVxuXHRcdFx0JiYgVVJJLmlzVXJpKCg8TG9jYXRpb24+dGhpbmcpLnVyaSk7XG5cdH1cblxuXHR1cmk6IFVSSTtcblx0cmFuZ2UhOiBSYW5nZTtcblxuXHRjb25zdHJ1Y3Rvcih1cmk6IFVSSSwgcmFuZ2VPclBvc2l0aW9uOiBSYW5nZSB8IFBvc2l0aW9uKSB7XG5cdFx0dGhpcy51cmkgPSB1cmk7XG5cblx0XHRpZiAoIXJhbmdlT3JQb3NpdGlvbikge1xuXHRcdFx0Ly90aGF0J3MgT0tcblx0XHR9IGVsc2UgaWYgKFJhbmdlLmlzUmFuZ2UocmFuZ2VPclBvc2l0aW9uKSkge1xuXHRcdFx0dGhpcy5yYW5nZSA9IFJhbmdlLm9mKHJhbmdlT3JQb3NpdGlvbik7XG5cdFx0fSBlbHNlIGlmIChQb3NpdGlvbi5pc1Bvc2l0aW9uKHJhbmdlT3JQb3NpdGlvbikpIHtcblx0XHRcdHRoaXMucmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2VPclBvc2l0aW9uLCByYW5nZU9yUG9zaXRpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgYXJndW1lbnQnKTtcblx0XHR9XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dXJpOiB0aGlzLnVyaSxcblx0XHRcdHJhbmdlOiB0aGlzLnJhbmdlXG5cdFx0fTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBEaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uIHtcblxuXHRzdGF0aWMgaXModGhpbmc6IGFueSk6IHRoaW5nIGlzIERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24ge1xuXHRcdGlmICghdGhpbmcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHR5cGVvZiAoPERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24+dGhpbmcpLm1lc3NhZ2UgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiAoPERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24+dGhpbmcpLmxvY2F0aW9uXG5cdFx0XHQmJiBSYW5nZS5pc1JhbmdlKCg8RGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbj50aGluZykubG9jYXRpb24ucmFuZ2UpXG5cdFx0XHQmJiBVUkkuaXNVcmkoKDxEaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uPnRoaW5nKS5sb2NhdGlvbi51cmkpO1xuXHR9XG5cblx0bG9jYXRpb246IExvY2F0aW9uO1xuXHRtZXNzYWdlOiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IobG9jYXRpb246IExvY2F0aW9uLCBtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHR0aGlzLmxvY2F0aW9uID0gbG9jYXRpb247XG5cdFx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblx0fVxuXG5cdHN0YXRpYyBpc0VxdWFsKGE6IERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sIGI6IERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24pOiBib29sZWFuIHtcblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghYSB8fCAhYikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYS5tZXNzYWdlID09PSBiLm1lc3NhZ2Vcblx0XHRcdCYmIGEubG9jYXRpb24ucmFuZ2UuaXNFcXVhbChiLmxvY2F0aW9uLnJhbmdlKVxuXHRcdFx0JiYgYS5sb2NhdGlvbi51cmkudG9TdHJpbmcoKSA9PT0gYi5sb2NhdGlvbi51cmkudG9TdHJpbmcoKTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBEaWFnbm9zdGljIHtcblxuXHRyYW5nZTogUmFuZ2U7XG5cdG1lc3NhZ2U6IHN0cmluZztcblx0c2V2ZXJpdHk6IERpYWdub3N0aWNTZXZlcml0eTtcblx0c291cmNlPzogc3RyaW5nO1xuXHRjb2RlPzogc3RyaW5nIHwgbnVtYmVyO1xuXHRyZWxhdGVkSW5mb3JtYXRpb24/OiBEaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uW107XG5cdHRhZ3M/OiBEaWFnbm9zdGljVGFnW107XG5cblx0Y29uc3RydWN0b3IocmFuZ2U6IFJhbmdlLCBtZXNzYWdlOiBzdHJpbmcsIHNldmVyaXR5OiBEaWFnbm9zdGljU2V2ZXJpdHkgPSBEaWFnbm9zdGljU2V2ZXJpdHkuRXJyb3IpIHtcblx0XHRpZiAoIVJhbmdlLmlzUmFuZ2UocmFuZ2UpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdyYW5nZSBtdXN0IGJlIHNldCcpO1xuXHRcdH1cblx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ21lc3NhZ2UgbXVzdCBiZSBzZXQnKTtcblx0XHR9XG5cdFx0dGhpcy5yYW5nZSA9IHJhbmdlO1xuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5zZXZlcml0eSA9IHNldmVyaXR5O1xuXHR9XG5cblx0dG9KU09OKCk6IGFueSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldmVyaXR5OiBEaWFnbm9zdGljU2V2ZXJpdHlbdGhpcy5zZXZlcml0eV0sXG5cdFx0XHRtZXNzYWdlOiB0aGlzLm1lc3NhZ2UsXG5cdFx0XHRyYW5nZTogdGhpcy5yYW5nZSxcblx0XHRcdHNvdXJjZTogdGhpcy5zb3VyY2UsXG5cdFx0XHRjb2RlOiB0aGlzLmNvZGUsXG5cdFx0fTtcblx0fVxuXG5cdHN0YXRpYyBpc0VxdWFsKGE6IERpYWdub3N0aWMgfCB1bmRlZmluZWQsIGI6IERpYWdub3N0aWMgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghYSB8fCAhYikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYS5tZXNzYWdlID09PSBiLm1lc3NhZ2Vcblx0XHRcdCYmIGEuc2V2ZXJpdHkgPT09IGIuc2V2ZXJpdHlcblx0XHRcdCYmIGEuY29kZSA9PT0gYi5jb2RlXG5cdFx0XHQmJiBhLnNldmVyaXR5ID09PSBiLnNldmVyaXR5XG5cdFx0XHQmJiBhLnNvdXJjZSA9PT0gYi5zb3VyY2Vcblx0XHRcdCYmIGEucmFuZ2UuaXNFcXVhbChiLnJhbmdlKVxuXHRcdFx0JiYgZXF1YWxzKGEudGFncywgYi50YWdzKVxuXHRcdFx0JiYgZXF1YWxzKGEucmVsYXRlZEluZm9ybWF0aW9uLCBiLnJlbGF0ZWRJbmZvcm1hdGlvbiwgRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbi5pc0VxdWFsKTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBIb3ZlciB7XG5cblx0cHVibGljIGNvbnRlbnRzOiAodnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdnNjb2RlLk1hcmtlZFN0cmluZylbXTtcblx0cHVibGljIHJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250ZW50czogdnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdnNjb2RlLk1hcmtlZFN0cmluZyB8ICh2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB2c2NvZGUuTWFya2VkU3RyaW5nKVtdLFxuXHRcdHJhbmdlPzogUmFuZ2Vcblx0KSB7XG5cdFx0aWYgKCFjb250ZW50cykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGFyZ3VtZW50LCBjb250ZW50cyBtdXN0IGJlIGRlZmluZWQnKTtcblx0XHR9XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY29udGVudHMpKSB7XG5cdFx0XHR0aGlzLmNvbnRlbnRzID0gY29udGVudHM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGVudHMgPSBbY29udGVudHNdO1xuXHRcdH1cblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgVmVyYm9zZUhvdmVyIGV4dGVuZHMgSG92ZXIge1xuXG5cdHB1YmxpYyBjYW5JbmNyZWFzZVZlcmJvc2l0eTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHVibGljIGNhbkRlY3JlYXNlVmVyYm9zaXR5OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRlbnRzOiB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB2c2NvZGUuTWFya2VkU3RyaW5nIHwgKHZzY29kZS5NYXJrZG93blN0cmluZyB8IHZzY29kZS5NYXJrZWRTdHJpbmcpW10sXG5cdFx0cmFuZ2U/OiBSYW5nZSxcblx0XHRjYW5JbmNyZWFzZVZlcmJvc2l0eT86IGJvb2xlYW4sXG5cdFx0Y2FuRGVjcmVhc2VWZXJib3NpdHk/OiBib29sZWFuLFxuXHQpIHtcblx0XHRzdXBlcihjb250ZW50cywgcmFuZ2UpO1xuXHRcdHRoaXMuY2FuSW5jcmVhc2VWZXJib3NpdHkgPSBjYW5JbmNyZWFzZVZlcmJvc2l0eTtcblx0XHR0aGlzLmNhbkRlY3JlYXNlVmVyYm9zaXR5ID0gY2FuRGVjcmVhc2VWZXJib3NpdHk7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gSG92ZXJWZXJib3NpdHlBY3Rpb24ge1xuXHRJbmNyZWFzZSA9IDAsXG5cdERlY3JlYXNlID0gMVxufVxuXG5leHBvcnQgZW51bSBEb2N1bWVudEhpZ2hsaWdodEtpbmQge1xuXHRUZXh0ID0gMCxcblx0UmVhZCA9IDEsXG5cdFdyaXRlID0gMlxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBEb2N1bWVudEhpZ2hsaWdodCB7XG5cblx0cmFuZ2U6IFJhbmdlO1xuXHRraW5kOiBEb2N1bWVudEhpZ2hsaWdodEtpbmQ7XG5cblx0Y29uc3RydWN0b3IocmFuZ2U6IFJhbmdlLCBraW5kOiBEb2N1bWVudEhpZ2hsaWdodEtpbmQgPSBEb2N1bWVudEhpZ2hsaWdodEtpbmQuVGV4dCkge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLmtpbmQgPSBraW5kO1xuXHR9XG5cblx0dG9KU09OKCk6IGFueSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlOiB0aGlzLnJhbmdlLFxuXHRcdFx0a2luZDogRG9jdW1lbnRIaWdobGlnaHRLaW5kW3RoaXMua2luZF1cblx0XHR9O1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIE11bHRpRG9jdW1lbnRIaWdobGlnaHQge1xuXG5cdHVyaTogVVJJO1xuXHRoaWdobGlnaHRzOiBEb2N1bWVudEhpZ2hsaWdodFtdO1xuXG5cdGNvbnN0cnVjdG9yKHVyaTogVVJJLCBoaWdobGlnaHRzOiBEb2N1bWVudEhpZ2hsaWdodFtdKSB7XG5cdFx0dGhpcy51cmkgPSB1cmk7XG5cdFx0dGhpcy5oaWdobGlnaHRzID0gaGlnaGxpZ2h0cztcblx0fVxuXG5cdHRvSlNPTigpOiBhbnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHR1cmk6IHRoaXMudXJpLFxuXHRcdFx0aGlnaGxpZ2h0czogdGhpcy5oaWdobGlnaHRzLm1hcChoID0+IGgudG9KU09OKCkpXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgZW51bSBTeW1ib2xLaW5kIHtcblx0RmlsZSA9IDAsXG5cdE1vZHVsZSA9IDEsXG5cdE5hbWVzcGFjZSA9IDIsXG5cdFBhY2thZ2UgPSAzLFxuXHRDbGFzcyA9IDQsXG5cdE1ldGhvZCA9IDUsXG5cdFByb3BlcnR5ID0gNixcblx0RmllbGQgPSA3LFxuXHRDb25zdHJ1Y3RvciA9IDgsXG5cdEVudW0gPSA5LFxuXHRJbnRlcmZhY2UgPSAxMCxcblx0RnVuY3Rpb24gPSAxMSxcblx0VmFyaWFibGUgPSAxMixcblx0Q29uc3RhbnQgPSAxMyxcblx0U3RyaW5nID0gMTQsXG5cdE51bWJlciA9IDE1LFxuXHRCb29sZWFuID0gMTYsXG5cdEFycmF5ID0gMTcsXG5cdE9iamVjdCA9IDE4LFxuXHRLZXkgPSAxOSxcblx0TnVsbCA9IDIwLFxuXHRFbnVtTWVtYmVyID0gMjEsXG5cdFN0cnVjdCA9IDIyLFxuXHRFdmVudCA9IDIzLFxuXHRPcGVyYXRvciA9IDI0LFxuXHRUeXBlUGFyYW1ldGVyID0gMjVcbn1cblxuZXhwb3J0IGVudW0gU3ltYm9sVGFnIHtcblx0RGVwcmVjYXRlZCA9IDEsXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFN5bWJvbEluZm9ybWF0aW9uIHtcblxuXHRzdGF0aWMgdmFsaWRhdGUoY2FuZGlkYXRlOiBTeW1ib2xJbmZvcm1hdGlvbik6IHZvaWQge1xuXHRcdGlmICghY2FuZGlkYXRlLm5hbWUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignbmFtZSBtdXN0IG5vdCBiZSBmYWxzeScpO1xuXHRcdH1cblx0fVxuXG5cdG5hbWU6IHN0cmluZztcblx0bG9jYXRpb24hOiBMb2NhdGlvbjtcblx0a2luZDogU3ltYm9sS2luZDtcblx0dGFncz86IFN5bWJvbFRhZ1tdO1xuXHRjb250YWluZXJOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBraW5kOiBTeW1ib2xLaW5kLCBjb250YWluZXJOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsIGxvY2F0aW9uOiBMb2NhdGlvbik7XG5cdGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywga2luZDogU3ltYm9sS2luZCwgcmFuZ2U6IFJhbmdlLCB1cmk/OiBVUkksIGNvbnRhaW5lck5hbWU/OiBzdHJpbmcpO1xuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGtpbmQ6IFN5bWJvbEtpbmQsIHJhbmdlT3JDb250YWluZXI6IHN0cmluZyB8IHVuZGVmaW5lZCB8IFJhbmdlLCBsb2NhdGlvbk9yVXJpPzogTG9jYXRpb24gfCBVUkksIGNvbnRhaW5lck5hbWU/OiBzdHJpbmcpIHtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdFx0dGhpcy5jb250YWluZXJOYW1lID0gY29udGFpbmVyTmFtZTtcblxuXHRcdGlmICh0eXBlb2YgcmFuZ2VPckNvbnRhaW5lciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuY29udGFpbmVyTmFtZSA9IHJhbmdlT3JDb250YWluZXI7XG5cdFx0fVxuXG5cdFx0aWYgKGxvY2F0aW9uT3JVcmkgaW5zdGFuY2VvZiBMb2NhdGlvbikge1xuXHRcdFx0dGhpcy5sb2NhdGlvbiA9IGxvY2F0aW9uT3JVcmk7XG5cdFx0fSBlbHNlIGlmIChyYW5nZU9yQ29udGFpbmVyIGluc3RhbmNlb2YgUmFuZ2UpIHtcblx0XHRcdHRoaXMubG9jYXRpb24gPSBuZXcgTG9jYXRpb24obG9jYXRpb25PclVyaSEsIHJhbmdlT3JDb250YWluZXIpO1xuXHRcdH1cblxuXHRcdFN5bWJvbEluZm9ybWF0aW9uLnZhbGlkYXRlKHRoaXMpO1xuXHR9XG5cblx0dG9KU09OKCk6IGFueSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGtpbmQ6IFN5bWJvbEtpbmRbdGhpcy5raW5kXSxcblx0XHRcdGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uLFxuXHRcdFx0Y29udGFpbmVyTmFtZTogdGhpcy5jb250YWluZXJOYW1lXG5cdFx0fTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBEb2N1bWVudFN5bWJvbCB7XG5cblx0c3RhdGljIHZhbGlkYXRlKGNhbmRpZGF0ZTogRG9jdW1lbnRTeW1ib2wpOiB2b2lkIHtcblx0XHRpZiAoIWNhbmRpZGF0ZS5uYW1lKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ25hbWUgbXVzdCBub3QgYmUgZmFsc3knKTtcblx0XHR9XG5cdFx0aWYgKCFjYW5kaWRhdGUucmFuZ2UuY29udGFpbnMoY2FuZGlkYXRlLnNlbGVjdGlvblJhbmdlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdzZWxlY3Rpb25SYW5nZSBtdXN0IGJlIGNvbnRhaW5lZCBpbiBmdWxsUmFuZ2UnKTtcblx0XHR9XG5cdFx0Y2FuZGlkYXRlLmNoaWxkcmVuPy5mb3JFYWNoKERvY3VtZW50U3ltYm9sLnZhbGlkYXRlKTtcblx0fVxuXG5cdG5hbWU6IHN0cmluZztcblx0ZGV0YWlsOiBzdHJpbmc7XG5cdGtpbmQ6IFN5bWJvbEtpbmQ7XG5cdHRhZ3M/OiBTeW1ib2xUYWdbXTtcblx0cmFuZ2U6IFJhbmdlO1xuXHRzZWxlY3Rpb25SYW5nZTogUmFuZ2U7XG5cdGNoaWxkcmVuOiBEb2N1bWVudFN5bWJvbFtdO1xuXG5cdGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZGV0YWlsOiBzdHJpbmcsIGtpbmQ6IFN5bWJvbEtpbmQsIHJhbmdlOiBSYW5nZSwgc2VsZWN0aW9uUmFuZ2U6IFJhbmdlKSB7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmRldGFpbCA9IGRldGFpbDtcblx0XHR0aGlzLmtpbmQgPSBraW5kO1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLnNlbGVjdGlvblJhbmdlID0gc2VsZWN0aW9uUmFuZ2U7XG5cdFx0dGhpcy5jaGlsZHJlbiA9IFtdO1xuXG5cdFx0RG9jdW1lbnRTeW1ib2wudmFsaWRhdGUodGhpcyk7XG5cdH1cbn1cblxuXG5leHBvcnQgZW51bSBDb2RlQWN0aW9uVHJpZ2dlcktpbmQge1xuXHRJbnZva2UgPSAxLFxuXHRBdXRvbWF0aWMgPSAyLFxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBDb2RlQWN0aW9uIHtcblx0dGl0bGU6IHN0cmluZztcblxuXHRjb21tYW5kPzogdnNjb2RlLkNvbW1hbmQ7XG5cblx0ZWRpdD86IFdvcmtzcGFjZUVkaXQ7XG5cblx0ZGlhZ25vc3RpY3M/OiBEaWFnbm9zdGljW107XG5cblx0a2luZD86IENvZGVBY3Rpb25LaW5kO1xuXG5cdGlzUHJlZmVycmVkPzogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcih0aXRsZTogc3RyaW5nLCBraW5kPzogQ29kZUFjdGlvbktpbmQpIHtcblx0XHR0aGlzLnRpdGxlID0gdGl0bGU7XG5cdFx0dGhpcy5raW5kID0ga2luZDtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBDb2RlQWN0aW9uS2luZCB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IHNlcCA9ICcuJztcblxuXHRwdWJsaWMgc3RhdGljIEVtcHR5OiBDb2RlQWN0aW9uS2luZDtcblx0cHVibGljIHN0YXRpYyBRdWlja0ZpeDogQ29kZUFjdGlvbktpbmQ7XG5cdHB1YmxpYyBzdGF0aWMgUmVmYWN0b3I6IENvZGVBY3Rpb25LaW5kO1xuXHRwdWJsaWMgc3RhdGljIFJlZmFjdG9yRXh0cmFjdDogQ29kZUFjdGlvbktpbmQ7XG5cdHB1YmxpYyBzdGF0aWMgUmVmYWN0b3JJbmxpbmU6IENvZGVBY3Rpb25LaW5kO1xuXHRwdWJsaWMgc3RhdGljIFJlZmFjdG9yTW92ZTogQ29kZUFjdGlvbktpbmQ7XG5cdHB1YmxpYyBzdGF0aWMgUmVmYWN0b3JSZXdyaXRlOiBDb2RlQWN0aW9uS2luZDtcblx0cHVibGljIHN0YXRpYyBTb3VyY2U6IENvZGVBY3Rpb25LaW5kO1xuXHRwdWJsaWMgc3RhdGljIFNvdXJjZU9yZ2FuaXplSW1wb3J0czogQ29kZUFjdGlvbktpbmQ7XG5cdHB1YmxpYyBzdGF0aWMgU291cmNlRml4QWxsOiBDb2RlQWN0aW9uS2luZDtcblx0cHVibGljIHN0YXRpYyBOb3RlYm9vazogQ29kZUFjdGlvbktpbmQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHZhbHVlOiBzdHJpbmdcblx0KSB7IH1cblxuXHRwdWJsaWMgYXBwZW5kKHBhcnRzOiBzdHJpbmcpOiBDb2RlQWN0aW9uS2luZCB7XG5cdFx0cmV0dXJuIG5ldyBDb2RlQWN0aW9uS2luZCh0aGlzLnZhbHVlID8gdGhpcy52YWx1ZSArIENvZGVBY3Rpb25LaW5kLnNlcCArIHBhcnRzIDogcGFydHMpO1xuXHR9XG5cblx0cHVibGljIGludGVyc2VjdHMob3RoZXI6IENvZGVBY3Rpb25LaW5kKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29udGFpbnMob3RoZXIpIHx8IG90aGVyLmNvbnRhaW5zKHRoaXMpO1xuXHR9XG5cblx0cHVibGljIGNvbnRhaW5zKG90aGVyOiBDb2RlQWN0aW9uS2luZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlID09PSBvdGhlci52YWx1ZSB8fCBvdGhlci52YWx1ZS5zdGFydHNXaXRoKHRoaXMudmFsdWUgKyBDb2RlQWN0aW9uS2luZC5zZXApO1xuXHR9XG59XG5cbkNvZGVBY3Rpb25LaW5kLkVtcHR5ID0gbmV3IENvZGVBY3Rpb25LaW5kKCcnKTtcbkNvZGVBY3Rpb25LaW5kLlF1aWNrRml4ID0gQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdxdWlja2ZpeCcpO1xuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3IgPSBDb2RlQWN0aW9uS2luZC5FbXB0eS5hcHBlbmQoJ3JlZmFjdG9yJyk7XG5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QgPSBDb2RlQWN0aW9uS2luZC5SZWZhY3Rvci5hcHBlbmQoJ2V4dHJhY3QnKTtcbkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9ySW5saW5lID0gQ29kZUFjdGlvbktpbmQuUmVmYWN0b3IuYXBwZW5kKCdpbmxpbmUnKTtcbkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yTW92ZSA9IENvZGVBY3Rpb25LaW5kLlJlZmFjdG9yLmFwcGVuZCgnbW92ZScpO1xuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JSZXdyaXRlID0gQ29kZUFjdGlvbktpbmQuUmVmYWN0b3IuYXBwZW5kKCdyZXdyaXRlJyk7XG5Db2RlQWN0aW9uS2luZC5Tb3VyY2UgPSBDb2RlQWN0aW9uS2luZC5FbXB0eS5hcHBlbmQoJ3NvdXJjZScpO1xuQ29kZUFjdGlvbktpbmQuU291cmNlT3JnYW5pemVJbXBvcnRzID0gQ29kZUFjdGlvbktpbmQuU291cmNlLmFwcGVuZCgnb3JnYW5pemVJbXBvcnRzJyk7XG5Db2RlQWN0aW9uS2luZC5Tb3VyY2VGaXhBbGwgPSBDb2RlQWN0aW9uS2luZC5Tb3VyY2UuYXBwZW5kKCdmaXhBbGwnKTtcbkNvZGVBY3Rpb25LaW5kLk5vdGVib29rID0gQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdub3RlYm9vaycpO1xuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBTZWxlY3Rpb25SYW5nZSB7XG5cblx0cmFuZ2U6IFJhbmdlO1xuXHRwYXJlbnQ/OiBTZWxlY3Rpb25SYW5nZTtcblxuXHRjb25zdHJ1Y3RvcihyYW5nZTogUmFuZ2UsIHBhcmVudD86IFNlbGVjdGlvblJhbmdlKSB7XG5cdFx0dGhpcy5yYW5nZSA9IHJhbmdlO1xuXHRcdHRoaXMucGFyZW50ID0gcGFyZW50O1xuXG5cdFx0aWYgKHBhcmVudCAmJiAhcGFyZW50LnJhbmdlLmNvbnRhaW5zKHRoaXMucmFuZ2UpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYXJndW1lbnQ6IHBhcmVudCBtdXN0IGNvbnRhaW4gdGhpcyByYW5nZScpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2FsbEhpZXJhcmNoeUl0ZW0ge1xuXG5cdF9zZXNzaW9uSWQ/OiBzdHJpbmc7XG5cdF9pdGVtSWQ/OiBzdHJpbmc7XG5cblx0a2luZDogU3ltYm9sS2luZDtcblx0dGFncz86IFN5bWJvbFRhZ1tdO1xuXHRuYW1lOiBzdHJpbmc7XG5cdGRldGFpbD86IHN0cmluZztcblx0dXJpOiBVUkk7XG5cdHJhbmdlOiBSYW5nZTtcblx0c2VsZWN0aW9uUmFuZ2U6IFJhbmdlO1xuXG5cdGNvbnN0cnVjdG9yKGtpbmQ6IFN5bWJvbEtpbmQsIG5hbWU6IHN0cmluZywgZGV0YWlsOiBzdHJpbmcsIHVyaTogVVJJLCByYW5nZTogUmFuZ2UsIHNlbGVjdGlvblJhbmdlOiBSYW5nZSkge1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmRldGFpbCA9IGRldGFpbDtcblx0XHR0aGlzLnVyaSA9IHVyaTtcblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy5zZWxlY3Rpb25SYW5nZSA9IHNlbGVjdGlvblJhbmdlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsIHtcblxuXHRmcm9tOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW07XG5cdGZyb21SYW5nZXM6IHZzY29kZS5SYW5nZVtdO1xuXG5cdGNvbnN0cnVjdG9yKGl0ZW06IHZzY29kZS5DYWxsSGllcmFyY2h5SXRlbSwgZnJvbVJhbmdlczogdnNjb2RlLlJhbmdlW10pIHtcblx0XHR0aGlzLmZyb21SYW5nZXMgPSBmcm9tUmFuZ2VzO1xuXHRcdHRoaXMuZnJvbSA9IGl0ZW07XG5cdH1cbn1cbmV4cG9ydCBjbGFzcyBDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxsIHtcblxuXHR0bzogdnNjb2RlLkNhbGxIaWVyYXJjaHlJdGVtO1xuXHRmcm9tUmFuZ2VzOiB2c2NvZGUuUmFuZ2VbXTtcblxuXHRjb25zdHJ1Y3RvcihpdGVtOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW0sIGZyb21SYW5nZXM6IHZzY29kZS5SYW5nZVtdKSB7XG5cdFx0dGhpcy5mcm9tUmFuZ2VzID0gZnJvbVJhbmdlcztcblx0XHR0aGlzLnRvID0gaXRlbTtcblx0fVxufVxuXG5leHBvcnQgZW51bSBMYW5ndWFnZVN0YXR1c1NldmVyaXR5IHtcblx0SW5mb3JtYXRpb24gPSAwLFxuXHRXYXJuaW5nID0gMSxcblx0RXJyb3IgPSAyXG59XG5cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgQ29kZUxlbnMge1xuXG5cdHJhbmdlOiBSYW5nZTtcblxuXHRjb21tYW5kOiB2c2NvZGUuQ29tbWFuZCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihyYW5nZTogUmFuZ2UsIGNvbW1hbmQ/OiB2c2NvZGUuQ29tbWFuZCkge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuXHR9XG5cblx0Z2V0IGlzUmVzb2x2ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5jb21tYW5kO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIE1hcmtkb3duU3RyaW5nIGltcGxlbWVudHMgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHtcblxuXHRyZWFkb25seSAjZGVsZWdhdGU6IEJhc2VNYXJrZG93blN0cmluZztcblxuXHRzdGF0aWMgaXNNYXJrZG93blN0cmluZyh0aGluZzogYW55KTogdGhpbmcgaXMgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHtcblx0XHRpZiAodGhpbmcgaW5zdGFuY2VvZiBNYXJrZG93blN0cmluZykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGluZyAmJiB0aGluZy5hcHBlbmRDb2RlYmxvY2sgJiYgdGhpbmcuYXBwZW5kTWFya2Rvd24gJiYgdGhpbmcuYXBwZW5kVGV4dCAmJiAodGhpbmcudmFsdWUgIT09IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZT86IHN0cmluZywgc3VwcG9ydFRoZW1lSWNvbnM6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdHRoaXMuI2RlbGVnYXRlID0gbmV3IEJhc2VNYXJrZG93blN0cmluZyh2YWx1ZSwgeyBzdXBwb3J0VGhlbWVJY29ucyB9KTtcblx0fVxuXG5cdGdldCB2YWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLiNkZWxlZ2F0ZS52YWx1ZTtcblx0fVxuXHRzZXQgdmFsdWUodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuI2RlbGVnYXRlLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgaXNUcnVzdGVkKCk6IGJvb2xlYW4gfCBNYXJrZG93blN0cmluZ1RydXN0ZWRPcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy4jZGVsZWdhdGUuaXNUcnVzdGVkO1xuXHR9XG5cblx0c2V0IGlzVHJ1c3RlZCh2YWx1ZTogYm9vbGVhbiB8IE1hcmtkb3duU3RyaW5nVHJ1c3RlZE9wdGlvbnMgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLiNkZWxlZ2F0ZS5pc1RydXN0ZWQgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBzdXBwb3J0VGhlbWVJY29ucygpOiBib29sZWFuIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy4jZGVsZWdhdGUuc3VwcG9ydFRoZW1lSWNvbnM7XG5cdH1cblxuXHRzZXQgc3VwcG9ydFRoZW1lSWNvbnModmFsdWU6IGJvb2xlYW4gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLiNkZWxlZ2F0ZS5zdXBwb3J0VGhlbWVJY29ucyA9IHZhbHVlO1xuXHR9XG5cblx0Z2V0IHN1cHBvcnRIdG1sKCk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLiNkZWxlZ2F0ZS5zdXBwb3J0SHRtbDtcblx0fVxuXG5cdHNldCBzdXBwb3J0SHRtbCh2YWx1ZTogYm9vbGVhbiB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuI2RlbGVnYXRlLnN1cHBvcnRIdG1sID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgYmFzZVVyaSgpOiB2c2NvZGUuVXJpIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy4jZGVsZWdhdGUuYmFzZVVyaTtcblx0fVxuXG5cdHNldCBiYXNlVXJpKHZhbHVlOiB2c2NvZGUuVXJpIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy4jZGVsZWdhdGUuYmFzZVVyaSA9IHZhbHVlO1xuXHR9XG5cblx0YXBwZW5kVGV4dCh2YWx1ZTogc3RyaW5nKTogdnNjb2RlLk1hcmtkb3duU3RyaW5nIHtcblx0XHR0aGlzLiNkZWxlZ2F0ZS5hcHBlbmRUZXh0KHZhbHVlKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGFwcGVuZE1hcmtkb3duKHZhbHVlOiBzdHJpbmcpOiB2c2NvZGUuTWFya2Rvd25TdHJpbmcge1xuXHRcdHRoaXMuI2RlbGVnYXRlLmFwcGVuZE1hcmtkb3duKHZhbHVlKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGFwcGVuZENvZGVibG9jayh2YWx1ZTogc3RyaW5nLCBsYW5ndWFnZT86IHN0cmluZyk6IHZzY29kZS5NYXJrZG93blN0cmluZyB7XG5cdFx0dGhpcy4jZGVsZWdhdGUuYXBwZW5kQ29kZWJsb2NrKGxhbmd1YWdlID8/ICcnLCB2YWx1ZSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgUGFyYW1ldGVySW5mb3JtYXRpb24ge1xuXG5cdGxhYmVsOiBzdHJpbmcgfCBbbnVtYmVyLCBudW1iZXJdO1xuXHRkb2N1bWVudGF0aW9uPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcgfCBbbnVtYmVyLCBudW1iZXJdLCBkb2N1bWVudGF0aW9uPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nKSB7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMuZG9jdW1lbnRhdGlvbiA9IGRvY3VtZW50YXRpb247XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgU2lnbmF0dXJlSW5mb3JtYXRpb24ge1xuXG5cdGxhYmVsOiBzdHJpbmc7XG5cdGRvY3VtZW50YXRpb24/OiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmc7XG5cdHBhcmFtZXRlcnM6IFBhcmFtZXRlckluZm9ybWF0aW9uW107XG5cdGFjdGl2ZVBhcmFtZXRlcj86IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihsYWJlbDogc3RyaW5nLCBkb2N1bWVudGF0aW9uPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nKSB7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMuZG9jdW1lbnRhdGlvbiA9IGRvY3VtZW50YXRpb247XG5cdFx0dGhpcy5wYXJhbWV0ZXJzID0gW107XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgU2lnbmF0dXJlSGVscCB7XG5cblx0c2lnbmF0dXJlczogU2lnbmF0dXJlSW5mb3JtYXRpb25bXTtcblx0YWN0aXZlU2lnbmF0dXJlOiBudW1iZXIgPSAwO1xuXHRhY3RpdmVQYXJhbWV0ZXI6IG51bWJlciA9IDA7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5zaWduYXR1cmVzID0gW107XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kIHtcblx0SW52b2tlID0gMSxcblx0VHJpZ2dlckNoYXJhY3RlciA9IDIsXG5cdENvbnRlbnRDaGFuZ2UgPSAzLFxufVxuXG5cbmV4cG9ydCBlbnVtIElubGF5SGludEtpbmQge1xuXHRUeXBlID0gMSxcblx0UGFyYW1ldGVyID0gMixcbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgSW5sYXlIaW50TGFiZWxQYXJ0IHtcblxuXHR2YWx1ZTogc3RyaW5nO1xuXHR0b29sdGlwPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nO1xuXHRsb2NhdGlvbj86IExvY2F0aW9uO1xuXHRjb21tYW5kPzogdnNjb2RlLkNvbW1hbmQ7XG5cblx0Y29uc3RydWN0b3IodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBJbmxheUhpbnQgaW1wbGVtZW50cyB2c2NvZGUuSW5sYXlIaW50IHtcblxuXHRsYWJlbDogc3RyaW5nIHwgSW5sYXlIaW50TGFiZWxQYXJ0W107XG5cdHRvb2x0aXA/OiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmc7XG5cdHBvc2l0aW9uOiBQb3NpdGlvbjtcblx0dGV4dEVkaXRzPzogVGV4dEVkaXRbXTtcblx0a2luZD86IHZzY29kZS5JbmxheUhpbnRLaW5kO1xuXHRwYWRkaW5nTGVmdD86IGJvb2xlYW47XG5cdHBhZGRpbmdSaWdodD86IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IocG9zaXRpb246IFBvc2l0aW9uLCBsYWJlbDogc3RyaW5nIHwgSW5sYXlIaW50TGFiZWxQYXJ0W10sIGtpbmQ/OiB2c2NvZGUuSW5sYXlIaW50S2luZCkge1xuXHRcdHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcblx0XHR0aGlzLmxhYmVsID0gbGFiZWw7XG5cdFx0dGhpcy5raW5kID0ga2luZDtcblx0fVxufVxuXG5leHBvcnQgZW51bSBDb21wbGV0aW9uVHJpZ2dlcktpbmQge1xuXHRJbnZva2UgPSAwLFxuXHRUcmlnZ2VyQ2hhcmFjdGVyID0gMSxcblx0VHJpZ2dlckZvckluY29tcGxldGVDb21wbGV0aW9ucyA9IDJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0aW9uQ29udGV4dCB7XG5cdHJlYWRvbmx5IHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQ7XG5cdHJlYWRvbmx5IHRyaWdnZXJDaGFyYWN0ZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGVudW0gQ29tcGxldGlvbkl0ZW1LaW5kIHtcblx0VGV4dCA9IDAsXG5cdE1ldGhvZCA9IDEsXG5cdEZ1bmN0aW9uID0gMixcblx0Q29uc3RydWN0b3IgPSAzLFxuXHRGaWVsZCA9IDQsXG5cdFZhcmlhYmxlID0gNSxcblx0Q2xhc3MgPSA2LFxuXHRJbnRlcmZhY2UgPSA3LFxuXHRNb2R1bGUgPSA4LFxuXHRQcm9wZXJ0eSA9IDksXG5cdFVuaXQgPSAxMCxcblx0VmFsdWUgPSAxMSxcblx0RW51bSA9IDEyLFxuXHRLZXl3b3JkID0gMTMsXG5cdFNuaXBwZXQgPSAxNCxcblx0Q29sb3IgPSAxNSxcblx0RmlsZSA9IDE2LFxuXHRSZWZlcmVuY2UgPSAxNyxcblx0Rm9sZGVyID0gMTgsXG5cdEVudW1NZW1iZXIgPSAxOSxcblx0Q29uc3RhbnQgPSAyMCxcblx0U3RydWN0ID0gMjEsXG5cdEV2ZW50ID0gMjIsXG5cdE9wZXJhdG9yID0gMjMsXG5cdFR5cGVQYXJhbWV0ZXIgPSAyNCxcblx0VXNlciA9IDI1LFxuXHRJc3N1ZSA9IDI2XG59XG5cbmV4cG9ydCBlbnVtIENvbXBsZXRpb25JdGVtVGFnIHtcblx0RGVwcmVjYXRlZCA9IDEsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGxldGlvbkl0ZW1MYWJlbCB7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGRldGFpbD86IHN0cmluZztcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25JdGVtIGltcGxlbWVudHMgdnNjb2RlLkNvbXBsZXRpb25JdGVtIHtcblxuXHRsYWJlbDogc3RyaW5nIHwgQ29tcGxldGlvbkl0ZW1MYWJlbDtcblx0a2luZD86IENvbXBsZXRpb25JdGVtS2luZDtcblx0dGFncz86IENvbXBsZXRpb25JdGVtVGFnW107XG5cdGRldGFpbD86IHN0cmluZztcblx0ZG9jdW1lbnRhdGlvbj86IHN0cmluZyB8IHZzY29kZS5NYXJrZG93blN0cmluZztcblx0c29ydFRleHQ/OiBzdHJpbmc7XG5cdGZpbHRlclRleHQ/OiBzdHJpbmc7XG5cdHByZXNlbGVjdD86IGJvb2xlYW47XG5cdGluc2VydFRleHQ/OiBzdHJpbmcgfCBTbmlwcGV0U3RyaW5nO1xuXHRrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW47XG5cdHJhbmdlPzogUmFuZ2UgfCB7IGluc2VydGluZzogUmFuZ2U7IHJlcGxhY2luZzogUmFuZ2UgfTtcblx0Y29tbWl0Q2hhcmFjdGVycz86IHN0cmluZ1tdO1xuXHR0ZXh0RWRpdD86IFRleHRFZGl0O1xuXHRhZGRpdGlvbmFsVGV4dEVkaXRzPzogVGV4dEVkaXRbXTtcblx0Y29tbWFuZD86IHZzY29kZS5Db21tYW5kO1xuXG5cdGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcgfCBDb21wbGV0aW9uSXRlbUxhYmVsLCBraW5kPzogQ29tcGxldGlvbkl0ZW1LaW5kKSB7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6IHRoaXMubGFiZWwsXG5cdFx0XHRraW5kOiB0aGlzLmtpbmQgJiYgQ29tcGxldGlvbkl0ZW1LaW5kW3RoaXMua2luZF0sXG5cdFx0XHRkZXRhaWw6IHRoaXMuZGV0YWlsLFxuXHRcdFx0ZG9jdW1lbnRhdGlvbjogdGhpcy5kb2N1bWVudGF0aW9uLFxuXHRcdFx0c29ydFRleHQ6IHRoaXMuc29ydFRleHQsXG5cdFx0XHRmaWx0ZXJUZXh0OiB0aGlzLmZpbHRlclRleHQsXG5cdFx0XHRwcmVzZWxlY3Q6IHRoaXMucHJlc2VsZWN0LFxuXHRcdFx0aW5zZXJ0VGV4dDogdGhpcy5pbnNlcnRUZXh0LFxuXHRcdFx0dGV4dEVkaXQ6IHRoaXMudGV4dEVkaXRcblx0XHR9O1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25MaXN0IHtcblxuXHRpc0luY29tcGxldGU/OiBib29sZWFuO1xuXHRpdGVtczogdnNjb2RlLkNvbXBsZXRpb25JdGVtW107XG5cblx0Y29uc3RydWN0b3IoaXRlbXM6IHZzY29kZS5Db21wbGV0aW9uSXRlbVtdID0gW10sIGlzSW5jb21wbGV0ZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdFx0dGhpcy5pdGVtcyA9IGl0ZW1zO1xuXHRcdHRoaXMuaXNJbmNvbXBsZXRlID0gaXNJbmNvbXBsZXRlO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIElubGluZVN1Z2dlc3Rpb24gaW1wbGVtZW50cyB2c2NvZGUuSW5saW5lQ29tcGxldGlvbkl0ZW0ge1xuXG5cdGZpbHRlclRleHQ/OiBzdHJpbmc7XG5cdGluc2VydFRleHQ6IHN0cmluZztcblx0cmFuZ2U/OiBSYW5nZTtcblx0Y29tbWFuZD86IHZzY29kZS5Db21tYW5kO1xuXG5cdGNvbnN0cnVjdG9yKGluc2VydFRleHQ6IHN0cmluZywgcmFuZ2U/OiBSYW5nZSwgY29tbWFuZD86IHZzY29kZS5Db21tYW5kKSB7XG5cdFx0dGhpcy5pbnNlcnRUZXh0ID0gaW5zZXJ0VGV4dDtcblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy5jb21tYW5kID0gY29tbWFuZDtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBJbmxpbmVTdWdnZXN0aW9uTGlzdCBpbXBsZW1lbnRzIHZzY29kZS5JbmxpbmVDb21wbGV0aW9uTGlzdCB7XG5cdGl0ZW1zOiB2c2NvZGUuSW5saW5lQ29tcGxldGlvbkl0ZW1bXTtcblxuXHRjb21tYW5kczogdnNjb2RlLkNvbW1hbmRbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRzdXBwcmVzc1N1Z2dlc3Rpb25zOiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGl0ZW1zOiB2c2NvZGUuSW5saW5lQ29tcGxldGlvbkl0ZW1bXSkge1xuXHRcdHRoaXMuaXRlbXMgPSBpdGVtcztcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpYWxBY2NlcHRJbmZvIHtcblx0a2luZDogUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kO1xuXHRhY2NlcHRlZExlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgZW51bSBQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQge1xuXHRVbmtub3duID0gMCxcblx0V29yZCA9IDEsXG5cdExpbmUgPSAyLFxuXHRTdWdnZXN0ID0gMyxcbn1cblxuZXhwb3J0IGVudW0gVmlld0NvbHVtbiB7XG5cdEFjdGl2ZSA9IC0xLFxuXHRCZXNpZGUgPSAtMixcblx0T25lID0gMSxcblx0VHdvID0gMixcblx0VGhyZWUgPSAzLFxuXHRGb3VyID0gNCxcblx0Rml2ZSA9IDUsXG5cdFNpeCA9IDYsXG5cdFNldmVuID0gNyxcblx0RWlnaHQgPSA4LFxuXHROaW5lID0gOVxufVxuXG5leHBvcnQgZW51bSBTdGF0dXNCYXJBbGlnbm1lbnQge1xuXHRMZWZ0ID0gMSxcblx0UmlnaHQgPSAyXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc1N0YXR1c0Jhckl0ZW1JZGVudGlmaWVyKGV4dGVuc2lvbjogRXh0ZW5zaW9uSWRlbnRpZmllciwgaWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBgJHtFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbil9LiR7aWR9YDtcbn1cblxuZXhwb3J0IGVudW0gVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUge1xuXHRPZmYgPSAwLFxuXHRPbiA9IDEsXG5cdFJlbGF0aXZlID0gMixcblx0SW50ZXJ2YWwgPSAzXG59XG5cbmV4cG9ydCBlbnVtIFRleHREb2N1bWVudFNhdmVSZWFzb24ge1xuXHRNYW51YWwgPSAxLFxuXHRBZnRlckRlbGF5ID0gMixcblx0Rm9jdXNPdXQgPSAzXG59XG5cbmV4cG9ydCBlbnVtIFRleHRFZGl0b3JSZXZlYWxUeXBlIHtcblx0RGVmYXVsdCA9IDAsXG5cdEluQ2VudGVyID0gMSxcblx0SW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCA9IDIsXG5cdEF0VG9wID0gM1xufVxuXG5leHBvcnQgZW51bSBUZXh0RWRpdG9yU2VsZWN0aW9uQ2hhbmdlS2luZCB7XG5cdEtleWJvYXJkID0gMSxcblx0TW91c2UgPSAyLFxuXHRDb21tYW5kID0gM1xufVxuXG5leHBvcnQgZW51bSBUZXh0RWRpdG9yQ2hhbmdlS2luZCB7XG5cdEFkZGl0aW9uID0gMSxcblx0RGVsZXRpb24gPSAyLFxuXHRNb2RpZmljYXRpb24gPSAzXG59XG5cbmV4cG9ydCBlbnVtIFRleHREb2N1bWVudENoYW5nZVJlYXNvbiB7XG5cdFVuZG8gPSAxLFxuXHRSZWRvID0gMixcbn1cblxuLyoqXG4gKiBUaGVzZSB2YWx1ZXMgbWF0Y2ggdmVyeSBjYXJlZnVsbHkgdGhlIHZhbHVlcyBvZiBgVHJhY2tlZFJhbmdlU3RpY2tpbmVzc2BcbiAqL1xuZXhwb3J0IGVudW0gRGVjb3JhdGlvblJhbmdlQmVoYXZpb3Ige1xuXHQvKipcblx0ICogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzXG5cdCAqL1xuXHRPcGVuT3BlbiA9IDAsXG5cdC8qKlxuXHQgKiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlc1xuXHQgKi9cblx0Q2xvc2VkQ2xvc2VkID0gMSxcblx0LyoqXG5cdCAqIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZVxuXHQgKi9cblx0T3BlbkNsb3NlZCA9IDIsXG5cdC8qKlxuXHQgKiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkdyb3dzT25seVdoZW5UeXBpbmdBZnRlclxuXHQgKi9cblx0Q2xvc2VkT3BlbiA9IDNcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXh0RWRpdG9yU2VsZWN0aW9uQ2hhbmdlS2luZCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tVmFsdWUoczogVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZSB8IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHN3aXRjaCAocykge1xuXHRcdFx0Y2FzZSAna2V5Ym9hcmQnOiByZXR1cm4gVGV4dEVkaXRvclNlbGVjdGlvbkNoYW5nZUtpbmQuS2V5Ym9hcmQ7XG5cdFx0XHRjYXNlICdtb3VzZSc6IHJldHVybiBUZXh0RWRpdG9yU2VsZWN0aW9uQ2hhbmdlS2luZC5Nb3VzZTtcblx0XHRcdGNhc2UgVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZS5QUk9HUkFNTUFUSUM6XG5cdFx0XHRjYXNlIFRleHRFZGl0b3JTZWxlY3Rpb25Tb3VyY2UuSlVNUDpcblx0XHRcdGNhc2UgVGV4dEVkaXRvclNlbGVjdGlvblNvdXJjZS5OQVZJR0FUSU9OOlxuXHRcdFx0XHRyZXR1cm4gVGV4dEVkaXRvclNlbGVjdGlvbkNoYW5nZUtpbmQuQ29tbWFuZDtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgZW51bSBTeW50YXhUb2tlblR5cGUge1xuXHRPdGhlciA9IDAsXG5cdENvbW1lbnQgPSAxLFxuXHRTdHJpbmcgPSAyLFxuXHRSZWdFeCA9IDNcbn1cbmV4cG9ydCBuYW1lc3BhY2UgU3ludGF4VG9rZW5UeXBlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvU3RyaW5nKHY6IFN5bnRheFRva2VuVHlwZSB8IHVua25vd24pOiAnb3RoZXInIHwgJ2NvbW1lbnQnIHwgJ3N0cmluZycgfCAncmVnZXgnIHtcblx0XHRzd2l0Y2ggKHYpIHtcblx0XHRcdGNhc2UgU3ludGF4VG9rZW5UeXBlLk90aGVyOiByZXR1cm4gJ290aGVyJztcblx0XHRcdGNhc2UgU3ludGF4VG9rZW5UeXBlLkNvbW1lbnQ6IHJldHVybiAnY29tbWVudCc7XG5cdFx0XHRjYXNlIFN5bnRheFRva2VuVHlwZS5TdHJpbmc6IHJldHVybiAnc3RyaW5nJztcblx0XHRcdGNhc2UgU3ludGF4VG9rZW5UeXBlLlJlZ0V4OiByZXR1cm4gJ3JlZ2V4Jztcblx0XHR9XG5cdFx0cmV0dXJuICdvdGhlcic7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgRG9jdW1lbnRMaW5rIHtcblxuXHRyYW5nZTogUmFuZ2U7XG5cblx0dGFyZ2V0PzogVVJJO1xuXG5cdHRvb2x0aXA/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IocmFuZ2U6IFJhbmdlLCB0YXJnZXQ6IFVSSSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0YXJnZXQgJiYgIShVUkkuaXNVcmkodGFyZ2V0KSkpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgndGFyZ2V0Jyk7XG5cdFx0fVxuXHRcdGlmICghUmFuZ2UuaXNSYW5nZShyYW5nZSkgfHwgcmFuZ2UuaXNFbXB0eSkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdyYW5nZScpO1xuXHRcdH1cblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgQ29sb3Ige1xuXHRyZWFkb25seSByZWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZ3JlZW46IG51bWJlcjtcblx0cmVhZG9ubHkgYmx1ZTogbnVtYmVyO1xuXHRyZWFkb25seSBhbHBoYTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHJlZDogbnVtYmVyLCBncmVlbjogbnVtYmVyLCBibHVlOiBudW1iZXIsIGFscGhhOiBudW1iZXIpIHtcblx0XHR0aGlzLnJlZCA9IHJlZDtcblx0XHR0aGlzLmdyZWVuID0gZ3JlZW47XG5cdFx0dGhpcy5ibHVlID0gYmx1ZTtcblx0XHR0aGlzLmFscGhhID0gYWxwaGE7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgSUNvbG9yRm9ybWF0ID0gc3RyaW5nIHwgeyBvcGFxdWU6IHN0cmluZzsgdHJhbnNwYXJlbnQ6IHN0cmluZyB9O1xuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBDb2xvckluZm9ybWF0aW9uIHtcblx0cmFuZ2U6IFJhbmdlO1xuXG5cdGNvbG9yOiBDb2xvcjtcblxuXHRjb25zdHJ1Y3RvcihyYW5nZTogUmFuZ2UsIGNvbG9yOiBDb2xvcikge1xuXHRcdGlmIChjb2xvciAmJiAhKGNvbG9yIGluc3RhbmNlb2YgQ29sb3IpKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2NvbG9yJyk7XG5cdFx0fVxuXHRcdGlmICghUmFuZ2UuaXNSYW5nZShyYW5nZSkgfHwgcmFuZ2UuaXNFbXB0eSkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdyYW5nZScpO1xuXHRcdH1cblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIENvbG9yUHJlc2VudGF0aW9uIHtcblx0bGFiZWw6IHN0cmluZztcblx0dGV4dEVkaXQ/OiBUZXh0RWRpdDtcblx0YWRkaXRpb25hbFRleHRFZGl0cz86IFRleHRFZGl0W107XG5cblx0Y29uc3RydWN0b3IobGFiZWw6IHN0cmluZykge1xuXHRcdGlmICghbGFiZWwgfHwgdHlwZW9mIGxhYmVsICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdsYWJlbCcpO1xuXHRcdH1cblx0XHR0aGlzLmxhYmVsID0gbGFiZWw7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gQ29sb3JGb3JtYXQge1xuXHRSR0IgPSAwLFxuXHRIRVggPSAxLFxuXHRIU0wgPSAyXG59XG5cbmV4cG9ydCBlbnVtIFNvdXJjZUNvbnRyb2xJbnB1dEJveFZhbGlkYXRpb25UeXBlIHtcblx0RXJyb3IgPSAwLFxuXHRXYXJuaW5nID0gMSxcblx0SW5mb3JtYXRpb24gPSAyXG59XG5cbmV4cG9ydCBlbnVtIFRlcm1pbmFsRXhpdFJlYXNvbiB7XG5cdFVua25vd24gPSAwLFxuXHRTaHV0ZG93biA9IDEsXG5cdFByb2Nlc3MgPSAyLFxuXHRVc2VyID0gMyxcblx0RXh0ZW5zaW9uID0gNFxufVxuXG5leHBvcnQgZW51bSBUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlIHtcblx0TG93ID0gMCxcblx0TWVkaXVtID0gMSxcblx0SGlnaCA9IDJcbn1cblxuZXhwb3J0IGVudW0gVGVybWluYWxTaGVsbFR5cGUge1xuXHRTaCA9IDEsXG5cdEJhc2ggPSAyLFxuXHRGaXNoID0gMyxcblx0Q3NoID0gNCxcblx0S3NoID0gNSxcblx0WnNoID0gNixcblx0Q29tbWFuZFByb21wdCA9IDcsXG5cdEdpdEJhc2ggPSA4LFxuXHRQb3dlclNoZWxsID0gOSxcblx0UHl0aG9uID0gMTAsXG5cdEp1bGlhID0gMTEsXG5cdE51U2hlbGwgPSAxMixcblx0Tm9kZSA9IDEzXG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExpbmsgaW1wbGVtZW50cyB2c2NvZGUuVGVybWluYWxMaW5rIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHN0YXJ0SW5kZXg6IG51bWJlcixcblx0XHRwdWJsaWMgbGVuZ3RoOiBudW1iZXIsXG5cdFx0cHVibGljIHRvb2x0aXA/OiBzdHJpbmdcblx0KSB7XG5cdFx0aWYgKHR5cGVvZiBzdGFydEluZGV4ICE9PSAnbnVtYmVyJyB8fCBzdGFydEluZGV4IDwgMCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdzdGFydEluZGV4Jyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgbGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBsZW5ndGggPCAxKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2xlbmd0aCcpO1xuXHRcdH1cblx0XHRpZiAodG9vbHRpcCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiB0b29sdGlwICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCd0b29sdGlwJyk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFF1aWNrRml4T3BlbmVyIHtcblx0dXJpOiB2c2NvZGUuVXJpO1xuXHRjb25zdHJ1Y3Rvcih1cmk6IHZzY29kZS5VcmkpIHtcblx0XHR0aGlzLnVyaSA9IHVyaTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxRdWlja0ZpeENvbW1hbmQge1xuXHR0ZXJtaW5hbENvbW1hbmQ6IHN0cmluZztcblx0Y29uc3RydWN0b3IodGVybWluYWxDb21tYW5kOiBzdHJpbmcpIHtcblx0XHR0aGlzLnRlcm1pbmFsQ29tbWFuZCA9IHRlcm1pbmFsQ29tbWFuZDtcblx0fVxufVxuXG5leHBvcnQgZW51bSBUZXJtaW5hbExvY2F0aW9uIHtcblx0UGFuZWwgPSAxLFxuXHRFZGl0b3IgPSAyLFxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxQcm9maWxlIGltcGxlbWVudHMgdnNjb2RlLlRlcm1pbmFsUHJvZmlsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBvcHRpb25zOiB2c2NvZGUuVGVybWluYWxPcHRpb25zIHwgdnNjb2RlLkV4dGVuc2lvblRlcm1pbmFsT3B0aW9uc1xuXHQpIHtcblx0XHRpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ29wdGlvbnMnKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQge1xuXHRGaWxlID0gMCxcblx0Rm9sZGVyID0gMSxcblx0TWV0aG9kID0gMixcblx0QWxpYXMgPSAzLFxuXHRBcmd1bWVudCA9IDQsXG5cdE9wdGlvbiA9IDUsXG5cdE9wdGlvblZhbHVlID0gNixcblx0RmxhZyA9IDcsXG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbENvbXBsZXRpb25JdGVtIGltcGxlbWVudHMgdnNjb2RlLlRlcm1pbmFsQ29tcGxldGlvbkl0ZW0ge1xuXHRsYWJlbDogc3RyaW5nIHwgQ29tcGxldGlvbkl0ZW1MYWJlbDtcblx0aWNvbj86IFRoZW1lSWNvbiB8IHVuZGVmaW5lZDtcblx0ZGV0YWlsPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRkb2N1bWVudGF0aW9uPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRpc0ZpbGU/OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRpc0RpcmVjdG9yeT86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdGlzS2V5d29yZD86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHJlcGxhY2VtZW50SW5kZXg6IG51bWJlcjtcblx0cmVwbGFjZW1lbnRMZW5ndGg6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihsYWJlbDogc3RyaW5nIHwgQ29tcGxldGlvbkl0ZW1MYWJlbCwgaWNvbj86IFRoZW1lSWNvbiwgZGV0YWlsPzogc3RyaW5nLCBkb2N1bWVudGF0aW9uPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nLCBpc0ZpbGU/OiBib29sZWFuLCBpc0RpcmVjdG9yeT86IGJvb2xlYW4sIGlzS2V5d29yZD86IGJvb2xlYW4sIHJlcGxhY2VtZW50SW5kZXg/OiBudW1iZXIsIHJlcGxhY2VtZW50TGVuZ3RoPzogbnVtYmVyKSB7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMuaWNvbiA9IGljb247XG5cdFx0dGhpcy5kZXRhaWwgPSBkZXRhaWw7XG5cdFx0dGhpcy5kb2N1bWVudGF0aW9uID0gZG9jdW1lbnRhdGlvbjtcblx0XHR0aGlzLmlzRmlsZSA9IGlzRmlsZTtcblx0XHR0aGlzLmlzRGlyZWN0b3J5ID0gaXNEaXJlY3Rvcnk7XG5cdFx0dGhpcy5pc0tleXdvcmQgPSBpc0tleXdvcmQ7XG5cdFx0dGhpcy5yZXBsYWNlbWVudEluZGV4ID0gcmVwbGFjZW1lbnRJbmRleCA/PyAwO1xuXHRcdHRoaXMucmVwbGFjZW1lbnRMZW5ndGggPSByZXBsYWNlbWVudExlbmd0aCA/PyAwO1xuXHR9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNvbGxlY3Rpb24gb2Yge0BsaW5rIENvbXBsZXRpb25JdGVtIGNvbXBsZXRpb24gaXRlbXN9IHRvIGJlIHByZXNlbnRlZFxuICogaW4gdGhlIGVkaXRvci5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlcm1pbmFsQ29tcGxldGlvbkxpc3Q8VCBleHRlbmRzIFRlcm1pbmFsQ29tcGxldGlvbkl0ZW0gPSBUZXJtaW5hbENvbXBsZXRpb25JdGVtPiB7XG5cblx0LyoqXG5cdCAqIFJlc291cmNlcyBzaG91bGQgYmUgc2hvd24gaW4gdGhlIGNvbXBsZXRpb25zIGxpc3Rcblx0ICovXG5cdHJlc291cmNlUmVxdWVzdENvbmZpZz86IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnO1xuXG5cdC8qKlxuXHQgKiBUaGUgY29tcGxldGlvbiBpdGVtcy5cblx0ICovXG5cdGl0ZW1zOiBUW107XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgY29tcGxldGlvbiBsaXN0LlxuXHQgKlxuXHQgKiBAcGFyYW0gaXRlbXMgVGhlIGNvbXBsZXRpb24gaXRlbXMuXG5cdCAqIEBwYXJhbSBpc0luY29tcGxldGUgVGhlIGxpc3QgaXMgbm90IGNvbXBsZXRlLlxuXHQgKi9cblx0Y29uc3RydWN0b3IoaXRlbXM/OiBUW10sIHJlc291cmNlUmVxdWVzdENvbmZpZz86IFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnKSB7XG5cdFx0dGhpcy5pdGVtcyA9IGl0ZW1zID8/IFtdO1xuXHRcdHRoaXMucmVzb3VyY2VSZXF1ZXN0Q29uZmlnID0gcmVzb3VyY2VSZXF1ZXN0Q29uZmlnO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcge1xuXHRmaWxlc1JlcXVlc3RlZD86IGJvb2xlYW47XG5cdGZvbGRlcnNSZXF1ZXN0ZWQ/OiBib29sZWFuO1xuXHRmaWxlRXh0ZW5zaW9ucz86IHN0cmluZ1tdO1xuXHRjd2Q/OiB2c2NvZGUuVXJpO1xufVxuXG5leHBvcnQgZW51bSBUYXNrUmV2ZWFsS2luZCB7XG5cdEFsd2F5cyA9IDEsXG5cblx0U2lsZW50ID0gMixcblxuXHROZXZlciA9IDNcbn1cblxuZXhwb3J0IGVudW0gVGFza0V2ZW50S2luZCB7XG5cdC8qKiBJbmRpY2F0ZXMgYSB0YXNrJ3MgcHJvcGVydGllcyBvciBjb25maWd1cmF0aW9uIGhhdmUgY2hhbmdlZCAqL1xuXHRDaGFuZ2VkID0gJ2NoYW5nZWQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgYSB0YXNrIGhhcyBiZWd1biBleGVjdXRpbmcgKi9cblx0UHJvY2Vzc1N0YXJ0ZWQgPSAncHJvY2Vzc1N0YXJ0ZWQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgYSB0YXNrIHByb2Nlc3MgaGFzIGNvbXBsZXRlZCAqL1xuXHRQcm9jZXNzRW5kZWQgPSAncHJvY2Vzc0VuZGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIGEgdGFzayB3YXMgdGVybWluYXRlZCwgZWl0aGVyIGJ5IHVzZXIgYWN0aW9uIG9yIGJ5IHRoZSBzeXN0ZW0gKi9cblx0VGVybWluYXRlZCA9ICd0ZXJtaW5hdGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIGEgdGFzayBoYXMgc3RhcnRlZCBydW5uaW5nICovXG5cdFN0YXJ0ID0gJ3N0YXJ0JyxcblxuXHQvKiogSW5kaWNhdGVzIGEgdGFzayBoYXMgYWNxdWlyZWQgYWxsIG5lZWRlZCBpbnB1dC92YXJpYWJsZXMgdG8gZXhlY3V0ZSAqL1xuXHRBY3F1aXJlZElucHV0ID0gJ2FjcXVpcmVkSW5wdXQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgYSBkZXBlbmRlbnQgdGFzayBoYXMgc3RhcnRlZCAqL1xuXHREZXBlbmRzT25TdGFydGVkID0gJ2RlcGVuZHNPblN0YXJ0ZWQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgYSB0YXNrIGlzIGFjdGl2ZWx5IHJ1bm5pbmcvcHJvY2Vzc2luZyAqL1xuXHRBY3RpdmUgPSAnYWN0aXZlJyxcblxuXHQvKiogSW5kaWNhdGVzIGEgdGFzayBpcyBwYXVzZWQvd2FpdGluZyBidXQgbm90IGNvbXBsZXRlICovXG5cdEluYWN0aXZlID0gJ2luYWN0aXZlJyxcblxuXHQvKiogSW5kaWNhdGVzIGEgdGFzayBoYXMgY29tcGxldGVkIGZ1bGx5ICovXG5cdEVuZCA9ICdlbmQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgdGhlIHRhc2sncyBwcm9ibGVtIG1hdGNoZXIgaGFzIHN0YXJ0ZWQgKi9cblx0UHJvYmxlbU1hdGNoZXJTdGFydGVkID0gJ3Byb2JsZW1NYXRjaGVyU3RhcnRlZCcsXG5cblx0LyoqIEluZGljYXRlcyB0aGUgdGFzaydzIHByb2JsZW0gbWF0Y2hlciBoYXMgZW5kZWQgd2l0aG91dCBlcnJvcnMgKi9cblx0UHJvYmxlbU1hdGNoZXJFbmRlZCA9ICdwcm9ibGVtTWF0Y2hlckVuZGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIHRoZSB0YXNrJ3MgcHJvYmxlbSBtYXRjaGVyIGhhcyBlbmRlZCB3aXRoIGVycm9ycyAqL1xuXHRQcm9ibGVtTWF0Y2hlckZvdW5kRXJyb3JzID0gJ3Byb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMnXG59XG5cblxuZXhwb3J0IGVudW0gVGFza1BhbmVsS2luZCB7XG5cdFNoYXJlZCA9IDEsXG5cblx0RGVkaWNhdGVkID0gMixcblxuXHROZXcgPSAzXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFRhc2tHcm91cCBpbXBsZW1lbnRzIHZzY29kZS5UYXNrR3JvdXAge1xuXG5cdGlzRGVmYXVsdDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaWQ6IHN0cmluZztcblxuXHRwdWJsaWMgc3RhdGljIENsZWFuOiBUYXNrR3JvdXAgPSBuZXcgVGFza0dyb3VwKCdjbGVhbicsICdDbGVhbicpO1xuXG5cdHB1YmxpYyBzdGF0aWMgQnVpbGQ6IFRhc2tHcm91cCA9IG5ldyBUYXNrR3JvdXAoJ2J1aWxkJywgJ0J1aWxkJyk7XG5cblx0cHVibGljIHN0YXRpYyBSZWJ1aWxkOiBUYXNrR3JvdXAgPSBuZXcgVGFza0dyb3VwKCdyZWJ1aWxkJywgJ1JlYnVpbGQnKTtcblxuXHRwdWJsaWMgc3RhdGljIFRlc3Q6IFRhc2tHcm91cCA9IG5ldyBUYXNrR3JvdXAoJ3Rlc3QnLCAnVGVzdCcpO1xuXG5cdHB1YmxpYyBzdGF0aWMgZnJvbSh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdFx0Y2FzZSAnY2xlYW4nOlxuXHRcdFx0XHRyZXR1cm4gVGFza0dyb3VwLkNsZWFuO1xuXHRcdFx0Y2FzZSAnYnVpbGQnOlxuXHRcdFx0XHRyZXR1cm4gVGFza0dyb3VwLkJ1aWxkO1xuXHRcdFx0Y2FzZSAncmVidWlsZCc6XG5cdFx0XHRcdHJldHVybiBUYXNrR3JvdXAuUmVidWlsZDtcblx0XHRcdGNhc2UgJ3Rlc3QnOlxuXHRcdFx0XHRyZXR1cm4gVGFza0dyb3VwLlRlc3Q7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIHB1YmxpYyByZWFkb25seSBsYWJlbDogc3RyaW5nKSB7XG5cdFx0aWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnbmFtZScpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGxhYmVsICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCduYW1lJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2lkID0gaWQ7XG5cdH1cblxuXHRnZXQgaWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVRhc2tFeGVjdXRpb25JZCh2YWx1ZXM6IHN0cmluZ1tdKTogc3RyaW5nIHtcblx0bGV0IGlkOiBzdHJpbmcgPSAnJztcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRpZCArPSB2YWx1ZXNbaV0ucmVwbGFjZSgvLC9nLCAnLCwnKSArICcsJztcblx0fVxuXHRyZXR1cm4gaWQ7XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFByb2Nlc3NFeGVjdXRpb24gaW1wbGVtZW50cyB2c2NvZGUuUHJvY2Vzc0V4ZWN1dGlvbiB7XG5cblx0cHJpdmF0ZSBfcHJvY2Vzczogc3RyaW5nO1xuXHRwcml2YXRlIF9hcmdzOiBzdHJpbmdbXTtcblx0cHJpdmF0ZSBfb3B0aW9uczogdnNjb2RlLlByb2Nlc3NFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHByb2Nlc3M6IHN0cmluZywgb3B0aW9ucz86IHZzY29kZS5Qcm9jZXNzRXhlY3V0aW9uT3B0aW9ucyk7XG5cdGNvbnN0cnVjdG9yKHByb2Nlc3M6IHN0cmluZywgYXJnczogc3RyaW5nW10sIG9wdGlvbnM/OiB2c2NvZGUuUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnMpO1xuXHRjb25zdHJ1Y3Rvcihwcm9jZXNzOiBzdHJpbmcsIHZhcmcxPzogc3RyaW5nW10gfCB2c2NvZGUuUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnMsIHZhcmcyPzogdnNjb2RlLlByb2Nlc3NFeGVjdXRpb25PcHRpb25zKSB7XG5cdFx0aWYgKHR5cGVvZiBwcm9jZXNzICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdwcm9jZXNzJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2FyZ3MgPSBbXTtcblx0XHR0aGlzLl9wcm9jZXNzID0gcHJvY2Vzcztcblx0XHRpZiAodmFyZzEgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFyZzEpKSB7XG5cdFx0XHRcdHRoaXMuX2FyZ3MgPSB2YXJnMTtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucyA9IHZhcmcyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucyA9IHZhcmcxO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cblx0Z2V0IHByb2Nlc3MoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzcztcblx0fVxuXG5cdHNldCBwcm9jZXNzKHZhbHVlOiBzdHJpbmcpIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdwcm9jZXNzJyk7XG5cdFx0fVxuXHRcdHRoaXMuX3Byb2Nlc3MgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBhcmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5fYXJncztcblx0fVxuXG5cdHNldCBhcmdzKHZhbHVlOiBzdHJpbmdbXSkge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdHZhbHVlID0gW107XG5cdFx0fVxuXHRcdHRoaXMuX2FyZ3MgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBvcHRpb25zKCk6IHZzY29kZS5Qcm9jZXNzRXhlY3V0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbnM7XG5cdH1cblxuXHRzZXQgb3B0aW9ucyh2YWx1ZTogdnNjb2RlLlByb2Nlc3NFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fb3B0aW9ucyA9IHZhbHVlO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVJZCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByb3BzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHByb3BzLnB1c2goJ3Byb2Nlc3MnKTtcblx0XHRpZiAodGhpcy5fcHJvY2VzcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRwcm9wcy5wdXNoKHRoaXMuX3Byb2Nlc3MpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fYXJncyAmJiB0aGlzLl9hcmdzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgYXJnIG9mIHRoaXMuX2FyZ3MpIHtcblx0XHRcdFx0cHJvcHMucHVzaChhcmcpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY29tcHV0ZVRhc2tFeGVjdXRpb25JZChwcm9wcyk7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgU2hlbGxFeGVjdXRpb24gaW1wbGVtZW50cyB2c2NvZGUuU2hlbGxFeGVjdXRpb24ge1xuXG5cdHByaXZhdGUgX2NvbW1hbmRMaW5lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NvbW1hbmQ6IHN0cmluZyB8IHZzY29kZS5TaGVsbFF1b3RlZFN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYXJnczogKHN0cmluZyB8IHZzY29kZS5TaGVsbFF1b3RlZFN0cmluZylbXSA9IFtdO1xuXHRwcml2YXRlIF9vcHRpb25zOiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGNvbW1hbmRMaW5lOiBzdHJpbmcsIG9wdGlvbnM/OiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zKTtcblx0Y29uc3RydWN0b3IoY29tbWFuZDogc3RyaW5nIHwgdnNjb2RlLlNoZWxsUXVvdGVkU3RyaW5nLCBhcmdzOiAoc3RyaW5nIHwgdnNjb2RlLlNoZWxsUXVvdGVkU3RyaW5nKVtdLCBvcHRpb25zPzogdnNjb2RlLlNoZWxsRXhlY3V0aW9uT3B0aW9ucyk7XG5cdGNvbnN0cnVjdG9yKGFyZzA6IHN0cmluZyB8IHZzY29kZS5TaGVsbFF1b3RlZFN0cmluZywgYXJnMT86IHZzY29kZS5TaGVsbEV4ZWN1dGlvbk9wdGlvbnMgfCAoc3RyaW5nIHwgdnNjb2RlLlNoZWxsUXVvdGVkU3RyaW5nKVtdLCBhcmcyPzogdnNjb2RlLlNoZWxsRXhlY3V0aW9uT3B0aW9ucykge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGFyZzEpKSB7XG5cdFx0XHRpZiAoIWFyZzApIHtcblx0XHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdjb21tYW5kIGNhblxcJ3QgYmUgdW5kZWZpbmVkIG9yIG51bGwnKTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgYXJnMCAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGFyZzAudmFsdWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnY29tbWFuZCcpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY29tbWFuZCA9IGFyZzA7XG5cdFx0XHRpZiAoYXJnMSkge1xuXHRcdFx0XHR0aGlzLl9hcmdzID0gYXJnMTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29wdGlvbnMgPSBhcmcyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodHlwZW9mIGFyZzAgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnY29tbWFuZExpbmUnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2NvbW1hbmRMaW5lID0gYXJnMDtcblx0XHRcdHRoaXMuX29wdGlvbnMgPSBhcmcxO1xuXHRcdH1cblx0fVxuXG5cdGdldCBjb21tYW5kTGluZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jb21tYW5kTGluZTtcblx0fVxuXG5cdHNldCBjb21tYW5kTGluZSh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnY29tbWFuZExpbmUnKTtcblx0XHR9XG5cdFx0dGhpcy5fY29tbWFuZExpbmUgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBjb21tYW5kKCk6IHN0cmluZyB8IHZzY29kZS5TaGVsbFF1b3RlZFN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbW1hbmQgPyB0aGlzLl9jb21tYW5kIDogJyc7XG5cdH1cblxuXHRzZXQgY29tbWFuZCh2YWx1ZTogc3RyaW5nIHwgdnNjb2RlLlNoZWxsUXVvdGVkU3RyaW5nKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIHZhbHVlLnZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdjb21tYW5kJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbW1hbmQgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBhcmdzKCk6IChzdHJpbmcgfCB2c2NvZGUuU2hlbGxRdW90ZWRTdHJpbmcpW10ge1xuXHRcdHJldHVybiB0aGlzLl9hcmdzO1xuXHR9XG5cblx0c2V0IGFyZ3ModmFsdWU6IChzdHJpbmcgfCB2c2NvZGUuU2hlbGxRdW90ZWRTdHJpbmcpW10gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9hcmdzID0gdmFsdWUgfHwgW107XG5cdH1cblxuXHRnZXQgb3B0aW9ucygpOiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucztcblx0fVxuXG5cdHNldCBvcHRpb25zKHZhbHVlOiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fb3B0aW9ucyA9IHZhbHVlO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVJZCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByb3BzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHByb3BzLnB1c2goJ3NoZWxsJyk7XG5cdFx0aWYgKHRoaXMuX2NvbW1hbmRMaW5lICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHByb3BzLnB1c2godGhpcy5fY29tbWFuZExpbmUpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY29tbWFuZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRwcm9wcy5wdXNoKHR5cGVvZiB0aGlzLl9jb21tYW5kID09PSAnc3RyaW5nJyA/IHRoaXMuX2NvbW1hbmQgOiB0aGlzLl9jb21tYW5kLnZhbHVlKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2FyZ3MgJiYgdGhpcy5fYXJncy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGFyZyBvZiB0aGlzLl9hcmdzKSB7XG5cdFx0XHRcdHByb3BzLnB1c2godHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgPyBhcmcgOiBhcmcudmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY29tcHV0ZVRhc2tFeGVjdXRpb25JZChwcm9wcyk7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gU2hlbGxRdW90aW5nIHtcblx0RXNjYXBlID0gMSxcblx0U3Ryb25nID0gMixcblx0V2VhayA9IDNcbn1cblxuZXhwb3J0IGVudW0gVGFza1Njb3BlIHtcblx0R2xvYmFsID0gMSxcblx0V29ya3NwYWNlID0gMlxufVxuXG5leHBvcnQgY2xhc3MgQ3VzdG9tRXhlY3V0aW9uIGltcGxlbWVudHMgdnNjb2RlLkN1c3RvbUV4ZWN1dGlvbiB7XG5cdHByaXZhdGUgX2NhbGxiYWNrOiAocmVzb2x2ZWREZWZpbml0aW9uOiB2c2NvZGUuVGFza0RlZmluaXRpb24pID0+IFRoZW5hYmxlPHZzY29kZS5Qc2V1ZG90ZXJtaW5hbD47XG5cdGNvbnN0cnVjdG9yKGNhbGxiYWNrOiAocmVzb2x2ZWREZWZpbml0aW9uOiB2c2NvZGUuVGFza0RlZmluaXRpb24pID0+IFRoZW5hYmxlPHZzY29kZS5Qc2V1ZG90ZXJtaW5hbD4pIHtcblx0XHR0aGlzLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuXHR9XG5cdHB1YmxpYyBjb21wdXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ2N1c3RvbUV4ZWN1dGlvbicgKyBnZW5lcmF0ZVV1aWQoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgY2FsbGJhY2sodmFsdWU6IChyZXNvbHZlZERlZmluaXRpb246IHZzY29kZS5UYXNrRGVmaW5pdGlvbikgPT4gVGhlbmFibGU8dnNjb2RlLlBzZXVkb3Rlcm1pbmFsPikge1xuXHRcdHRoaXMuX2NhbGxiYWNrID0gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNhbGxiYWNrKCk6ICgocmVzb2x2ZWREZWZpbml0aW9uOiB2c2NvZGUuVGFza0RlZmluaXRpb24pID0+IFRoZW5hYmxlPHZzY29kZS5Qc2V1ZG90ZXJtaW5hbD4pIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FsbGJhY2s7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgVGFzayBpbXBsZW1lbnRzIHZzY29kZS5UYXNrIHtcblxuXHRwcml2YXRlIHN0YXRpYyBFeHRlbnNpb25DYWxsYmFja1R5cGU6IHN0cmluZyA9ICdjdXN0b21FeGVjdXRpb24nO1xuXHRwcml2YXRlIHN0YXRpYyBQcm9jZXNzVHlwZTogc3RyaW5nID0gJ3Byb2Nlc3MnO1xuXHRwcml2YXRlIHN0YXRpYyBTaGVsbFR5cGU6IHN0cmluZyA9ICdzaGVsbCc7XG5cdHByaXZhdGUgc3RhdGljIEVtcHR5VHlwZTogc3RyaW5nID0gJyRlbXB0eSc7XG5cblx0cHJpdmF0ZSBfX2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX19kZXByZWNhdGVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBfZGVmaW5pdGlvbjogdnNjb2RlLlRhc2tEZWZpbml0aW9uO1xuXHRwcml2YXRlIF9zY29wZTogdnNjb2RlLlRhc2tTY29wZS5HbG9iYWwgfCB2c2NvZGUuVGFza1Njb3BlLldvcmtzcGFjZSB8IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX25hbWU6IHN0cmluZztcblx0cHJpdmF0ZSBfZXhlY3V0aW9uOiBQcm9jZXNzRXhlY3V0aW9uIHwgU2hlbGxFeGVjdXRpb24gfCBDdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Byb2JsZW1NYXRjaGVyczogc3RyaW5nW107XG5cdHByaXZhdGUgX2hhc0RlZmluZWRNYXRjaGVyczogYm9vbGVhbjtcblx0cHJpdmF0ZSBfaXNCYWNrZ3JvdW5kOiBib29sZWFuO1xuXHRwcml2YXRlIF9zb3VyY2U6IHN0cmluZztcblx0cHJpdmF0ZSBfZ3JvdXA6IFRhc2tHcm91cCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcHJlc2VudGF0aW9uT3B0aW9uczogdnNjb2RlLlRhc2tQcmVzZW50YXRpb25PcHRpb25zO1xuXHRwcml2YXRlIF9ydW5PcHRpb25zOiB2c2NvZGUuUnVuT3B0aW9ucztcblx0cHJpdmF0ZSBfZGV0YWlsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoZGVmaW5pdGlvbjogdnNjb2RlLlRhc2tEZWZpbml0aW9uLCBuYW1lOiBzdHJpbmcsIHNvdXJjZTogc3RyaW5nLCBleGVjdXRpb24/OiBQcm9jZXNzRXhlY3V0aW9uIHwgU2hlbGxFeGVjdXRpb24gfCBDdXN0b21FeGVjdXRpb24sIHByb2JsZW1NYXRjaGVycz86IHN0cmluZyB8IHN0cmluZ1tdKTtcblx0Y29uc3RydWN0b3IoZGVmaW5pdGlvbjogdnNjb2RlLlRhc2tEZWZpbml0aW9uLCBzY29wZTogdnNjb2RlLlRhc2tTY29wZS5HbG9iYWwgfCB2c2NvZGUuVGFza1Njb3BlLldvcmtzcGFjZSB8IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIsIG5hbWU6IHN0cmluZywgc291cmNlOiBzdHJpbmcsIGV4ZWN1dGlvbj86IFByb2Nlc3NFeGVjdXRpb24gfCBTaGVsbEV4ZWN1dGlvbiB8IEN1c3RvbUV4ZWN1dGlvbiwgcHJvYmxlbU1hdGNoZXJzPzogc3RyaW5nIHwgc3RyaW5nW10pO1xuXHRjb25zdHJ1Y3RvcihkZWZpbml0aW9uOiB2c2NvZGUuVGFza0RlZmluaXRpb24sIGFyZzI6IHN0cmluZyB8ICh2c2NvZGUuVGFza1Njb3BlLkdsb2JhbCB8IHZzY29kZS5UYXNrU2NvcGUuV29ya3NwYWNlKSB8IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIsIGFyZzM6IGFueSwgYXJnND86IGFueSwgYXJnNT86IGFueSwgYXJnNj86IGFueSkge1xuXHRcdHRoaXMuX2RlZmluaXRpb24gPSB0aGlzLmRlZmluaXRpb24gPSBkZWZpbml0aW9uO1xuXHRcdGxldCBwcm9ibGVtTWF0Y2hlcnM6IHN0cmluZyB8IHN0cmluZ1tdO1xuXHRcdGlmICh0eXBlb2YgYXJnMiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX25hbWUgPSB0aGlzLm5hbWUgPSBhcmcyO1xuXHRcdFx0dGhpcy5fc291cmNlID0gdGhpcy5zb3VyY2UgPSBhcmczO1xuXHRcdFx0dGhpcy5leGVjdXRpb24gPSBhcmc0O1xuXHRcdFx0cHJvYmxlbU1hdGNoZXJzID0gYXJnNTtcblx0XHRcdHRoaXMuX19kZXByZWNhdGVkID0gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKGFyZzIgPT09IFRhc2tTY29wZS5HbG9iYWwgfHwgYXJnMiA9PT0gVGFza1Njb3BlLldvcmtzcGFjZSkge1xuXHRcdFx0dGhpcy50YXJnZXQgPSBhcmcyO1xuXHRcdFx0dGhpcy5fbmFtZSA9IHRoaXMubmFtZSA9IGFyZzM7XG5cdFx0XHR0aGlzLl9zb3VyY2UgPSB0aGlzLnNvdXJjZSA9IGFyZzQ7XG5cdFx0XHR0aGlzLmV4ZWN1dGlvbiA9IGFyZzU7XG5cdFx0XHRwcm9ibGVtTWF0Y2hlcnMgPSBhcmc2O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRhcmdldCA9IGFyZzI7XG5cdFx0XHR0aGlzLl9uYW1lID0gdGhpcy5uYW1lID0gYXJnMztcblx0XHRcdHRoaXMuX3NvdXJjZSA9IHRoaXMuc291cmNlID0gYXJnNDtcblx0XHRcdHRoaXMuZXhlY3V0aW9uID0gYXJnNTtcblx0XHRcdHByb2JsZW1NYXRjaGVycyA9IGFyZzY7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgcHJvYmxlbU1hdGNoZXJzID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5fcHJvYmxlbU1hdGNoZXJzID0gW3Byb2JsZW1NYXRjaGVyc107XG5cdFx0XHR0aGlzLl9oYXNEZWZpbmVkTWF0Y2hlcnMgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm9ibGVtTWF0Y2hlcnMpKSB7XG5cdFx0XHR0aGlzLl9wcm9ibGVtTWF0Y2hlcnMgPSBwcm9ibGVtTWF0Y2hlcnM7XG5cdFx0XHR0aGlzLl9oYXNEZWZpbmVkTWF0Y2hlcnMgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9wcm9ibGVtTWF0Y2hlcnMgPSBbXTtcblx0XHRcdHRoaXMuX2hhc0RlZmluZWRNYXRjaGVycyA9IGZhbHNlO1xuXHRcdH1cblx0XHR0aGlzLl9pc0JhY2tncm91bmQgPSBmYWxzZTtcblx0XHR0aGlzLl9wcmVzZW50YXRpb25PcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl9ydW5PcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdGdldCBfaWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fX2lkO1xuXHR9XG5cblx0c2V0IF9pZCh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fX2lkID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgX2RlcHJlY2F0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX19kZXByZWNhdGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fX2lkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fX2lkID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Njb3BlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuY29tcHV0ZURlZmluaXRpb25CYXNlZE9uRXhlY3V0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVEZWZpbml0aW9uQmFzZWRPbkV4ZWN1dGlvbigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZXhlY3V0aW9uIGluc3RhbmNlb2YgUHJvY2Vzc0V4ZWN1dGlvbikge1xuXHRcdFx0dGhpcy5fZGVmaW5pdGlvbiA9IHtcblx0XHRcdFx0dHlwZTogVGFzay5Qcm9jZXNzVHlwZSxcblx0XHRcdFx0aWQ6IHRoaXMuX2V4ZWN1dGlvbi5jb21wdXRlSWQoKVxuXHRcdFx0fTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2V4ZWN1dGlvbiBpbnN0YW5jZW9mIFNoZWxsRXhlY3V0aW9uKSB7XG5cdFx0XHR0aGlzLl9kZWZpbml0aW9uID0ge1xuXHRcdFx0XHR0eXBlOiBUYXNrLlNoZWxsVHlwZSxcblx0XHRcdFx0aWQ6IHRoaXMuX2V4ZWN1dGlvbi5jb21wdXRlSWQoKVxuXHRcdFx0fTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2V4ZWN1dGlvbiBpbnN0YW5jZW9mIEN1c3RvbUV4ZWN1dGlvbikge1xuXHRcdFx0dGhpcy5fZGVmaW5pdGlvbiA9IHtcblx0XHRcdFx0dHlwZTogVGFzay5FeHRlbnNpb25DYWxsYmFja1R5cGUsXG5cdFx0XHRcdGlkOiB0aGlzLl9leGVjdXRpb24uY29tcHV0ZUlkKClcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2RlZmluaXRpb24gPSB7XG5cdFx0XHRcdHR5cGU6IFRhc2suRW1wdHlUeXBlLFxuXHRcdFx0XHRpZDogZ2VuZXJhdGVVdWlkKClcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGRlZmluaXRpb24oKTogdnNjb2RlLlRhc2tEZWZpbml0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVmaW5pdGlvbjtcblx0fVxuXG5cdHNldCBkZWZpbml0aW9uKHZhbHVlOiB2c2NvZGUuVGFza0RlZmluaXRpb24pIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCdLaW5kIGNhblxcJ3QgYmUgdW5kZWZpbmVkIG9yIG51bGwnKTtcblx0XHR9XG5cdFx0dGhpcy5jbGVhcigpO1xuXHRcdHRoaXMuX2RlZmluaXRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBzY29wZSgpOiB2c2NvZGUuVGFza1Njb3BlLkdsb2JhbCB8IHZzY29kZS5UYXNrU2NvcGUuV29ya3NwYWNlIHwgdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Njb3BlO1xuXHR9XG5cblx0c2V0IHRhcmdldCh2YWx1ZTogdnNjb2RlLlRhc2tTY29wZS5HbG9iYWwgfCB2c2NvZGUuVGFza1Njb3BlLldvcmtzcGFjZSB8IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIpIHtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fc2NvcGUgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWU7XG5cdH1cblxuXHRzZXQgbmFtZSh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnbmFtZScpO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fbmFtZSA9IHZhbHVlO1xuXHR9XG5cblx0Z2V0IGV4ZWN1dGlvbigpOiBQcm9jZXNzRXhlY3V0aW9uIHwgU2hlbGxFeGVjdXRpb24gfCBDdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9leGVjdXRpb247XG5cdH1cblxuXHRzZXQgZXhlY3V0aW9uKHZhbHVlOiBQcm9jZXNzRXhlY3V0aW9uIHwgU2hlbGxFeGVjdXRpb24gfCBDdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fZXhlY3V0aW9uID0gdmFsdWU7XG5cdFx0Y29uc3QgdHlwZSA9IHRoaXMuX2RlZmluaXRpb24udHlwZTtcblx0XHRpZiAoVGFzay5FbXB0eVR5cGUgPT09IHR5cGUgfHwgVGFzay5Qcm9jZXNzVHlwZSA9PT0gdHlwZSB8fCBUYXNrLlNoZWxsVHlwZSA9PT0gdHlwZSB8fCBUYXNrLkV4dGVuc2lvbkNhbGxiYWNrVHlwZSA9PT0gdHlwZSkge1xuXHRcdFx0dGhpcy5jb21wdXRlRGVmaW5pdGlvbkJhc2VkT25FeGVjdXRpb24oKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgcHJvYmxlbU1hdGNoZXJzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvYmxlbU1hdGNoZXJzO1xuXHR9XG5cblx0c2V0IHByb2JsZW1NYXRjaGVycyh2YWx1ZTogc3RyaW5nW10pIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9wcm9ibGVtTWF0Y2hlcnMgPSBbXTtcblx0XHRcdHRoaXMuX2hhc0RlZmluZWRNYXRjaGVycyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9wcm9ibGVtTWF0Y2hlcnMgPSB2YWx1ZTtcblx0XHRcdHRoaXMuX2hhc0RlZmluZWRNYXRjaGVycyA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGhhc0RlZmluZWRNYXRjaGVycygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faGFzRGVmaW5lZE1hdGNoZXJzO1xuXHR9XG5cblx0Z2V0IGlzQmFja2dyb3VuZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNCYWNrZ3JvdW5kO1xuXHR9XG5cblx0c2V0IGlzQmFja2dyb3VuZCh2YWx1ZTogYm9vbGVhbikge1xuXHRcdGlmICh2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gZmFsc2UpIHtcblx0XHRcdHZhbHVlID0gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHR0aGlzLl9pc0JhY2tncm91bmQgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBzb3VyY2UoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fc291cmNlO1xuXHR9XG5cblx0c2V0IHNvdXJjZSh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgdmFsdWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ3NvdXJjZSBtdXN0IGJlIGEgc3RyaW5nIG9mIGxlbmd0aCA+IDAnKTtcblx0XHR9XG5cdFx0dGhpcy5jbGVhcigpO1xuXHRcdHRoaXMuX3NvdXJjZSA9IHZhbHVlO1xuXHR9XG5cblx0Z2V0IGdyb3VwKCk6IFRhc2tHcm91cCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2dyb3VwO1xuXHR9XG5cblx0c2V0IGdyb3VwKHZhbHVlOiBUYXNrR3JvdXAgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fZ3JvdXAgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBkZXRhaWwoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZGV0YWlsO1xuXHR9XG5cblx0c2V0IGRldGFpbCh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5fZGV0YWlsID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgcHJlc2VudGF0aW9uT3B0aW9ucygpOiB2c2NvZGUuVGFza1ByZXNlbnRhdGlvbk9wdGlvbnMge1xuXHRcdHJldHVybiB0aGlzLl9wcmVzZW50YXRpb25PcHRpb25zO1xuXHR9XG5cblx0c2V0IHByZXNlbnRhdGlvbk9wdGlvbnModmFsdWU6IHZzY29kZS5UYXNrUHJlc2VudGF0aW9uT3B0aW9ucykge1xuXHRcdGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR2YWx1ZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0fVxuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHR0aGlzLl9wcmVzZW50YXRpb25PcHRpb25zID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgcnVuT3B0aW9ucygpOiB2c2NvZGUuUnVuT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bk9wdGlvbnM7XG5cdH1cblxuXHRzZXQgcnVuT3B0aW9ucyh2YWx1ZTogdnNjb2RlLlJ1bk9wdGlvbnMpIHtcblx0XHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dmFsdWUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fcnVuT3B0aW9ucyA9IHZhbHVlO1xuXHR9XG59XG5cblxuZXhwb3J0IGVudW0gUHJvZ3Jlc3NMb2NhdGlvbiB7XG5cdFNvdXJjZUNvbnRyb2wgPSAxLFxuXHRXaW5kb3cgPSAxMCxcblx0Tm90aWZpY2F0aW9uID0gMTVcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBWaWV3QmFkZ2Uge1xuXHRleHBvcnQgZnVuY3Rpb24gaXNWaWV3QmFkZ2UodGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5WaWV3QmFkZ2Uge1xuXHRcdGNvbnN0IHZpZXdCYWRnZVRoaW5nID0gdGhpbmcgYXMgdnNjb2RlLlZpZXdCYWRnZTtcblxuXHRcdGlmICghaXNOdW1iZXIodmlld0JhZGdlVGhpbmcudmFsdWUpKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSU5WQUxJRCB2aWV3IGJhZGdlLCBpbnZhbGlkIHZhbHVlJywgdmlld0JhZGdlVGhpbmcudmFsdWUpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodmlld0JhZGdlVGhpbmcudG9vbHRpcCAmJiAhaXNTdHJpbmcodmlld0JhZGdlVGhpbmcudG9vbHRpcCkpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIHZpZXcgYmFkZ2UsIGludmFsaWQgdG9vbHRpcCcsIHZpZXdCYWRnZVRoaW5nLnRvb2x0aXApO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBUcmVlSXRlbSB7XG5cblx0bGFiZWw/OiBzdHJpbmcgfCB2c2NvZGUuVHJlZUl0ZW1MYWJlbDtcblx0cmVzb3VyY2VVcmk/OiBVUkk7XG5cdGljb25QYXRoPzogc3RyaW5nIHwgVVJJIHwgeyBsaWdodDogc3RyaW5nIHwgVVJJOyBkYXJrOiBzdHJpbmcgfCBVUkkgfSB8IFRoZW1lSWNvbjtcblx0Y29tbWFuZD86IHZzY29kZS5Db21tYW5kO1xuXHRjb250ZXh0VmFsdWU/OiBzdHJpbmc7XG5cdHRvb2x0aXA/OiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmc7XG5cdGNoZWNrYm94U3RhdGU/OiB2c2NvZGUuVHJlZUl0ZW1DaGVja2JveFN0YXRlO1xuXG5cdHN0YXRpYyBpc1RyZWVJdGVtKHRoaW5nOiBhbnksIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogdGhpbmcgaXMgVHJlZUl0ZW0ge1xuXHRcdGNvbnN0IHRyZWVJdGVtVGhpbmcgPSB0aGluZyBhcyB2c2NvZGUuVHJlZUl0ZW07XG5cblx0XHRpZiAodHJlZUl0ZW1UaGluZy5jaGVja2JveFN0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGNoZWNrYm94ID0gaXNOdW1iZXIodHJlZUl0ZW1UaGluZy5jaGVja2JveFN0YXRlKSA/IHRyZWVJdGVtVGhpbmcuY2hlY2tib3hTdGF0ZSA6XG5cdFx0XHRcdGlzT2JqZWN0KHRyZWVJdGVtVGhpbmcuY2hlY2tib3hTdGF0ZSkgJiYgaXNOdW1iZXIodHJlZUl0ZW1UaGluZy5jaGVja2JveFN0YXRlLnN0YXRlKSA/IHRyZWVJdGVtVGhpbmcuY2hlY2tib3hTdGF0ZS5zdGF0ZSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHRvb2x0aXAgPSAhaXNOdW1iZXIodHJlZUl0ZW1UaGluZy5jaGVja2JveFN0YXRlKSAmJiBpc09iamVjdCh0cmVlSXRlbVRoaW5nLmNoZWNrYm94U3RhdGUpID8gdHJlZUl0ZW1UaGluZy5jaGVja2JveFN0YXRlLnRvb2x0aXAgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoY2hlY2tib3ggPT09IHVuZGVmaW5lZCB8fCAoY2hlY2tib3ggIT09IFRyZWVJdGVtQ2hlY2tib3hTdGF0ZS5DaGVja2VkICYmIGNoZWNrYm94ICE9PSBUcmVlSXRlbUNoZWNrYm94U3RhdGUuVW5jaGVja2VkKSB8fCAodG9vbHRpcCAhPT0gdW5kZWZpbmVkICYmICFpc1N0cmluZyh0b29sdGlwKSkpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0lOVkFMSUQgdHJlZSBpdGVtLCBpbnZhbGlkIGNoZWNrYm94U3RhdGUnLCB0cmVlSXRlbVRoaW5nLmNoZWNrYm94U3RhdGUpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaW5nIGluc3RhbmNlb2YgVHJlZUl0ZW0pIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICh0cmVlSXRlbVRoaW5nLmxhYmVsICE9PSB1bmRlZmluZWQgJiYgIWlzU3RyaW5nKHRyZWVJdGVtVGhpbmcubGFiZWwpICYmICEodHJlZUl0ZW1UaGluZy5sYWJlbD8ubGFiZWwpKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSU5WQUxJRCB0cmVlIGl0ZW0sIGludmFsaWQgbGFiZWwnLCB0cmVlSXRlbVRoaW5nLmxhYmVsKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCh0cmVlSXRlbVRoaW5nLmlkICE9PSB1bmRlZmluZWQpICYmICFpc1N0cmluZyh0cmVlSXRlbVRoaW5nLmlkKSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0lOVkFMSUQgdHJlZSBpdGVtLCBpbnZhbGlkIGlkJywgdHJlZUl0ZW1UaGluZy5pZCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICgodHJlZUl0ZW1UaGluZy5pY29uUGF0aCAhPT0gdW5kZWZpbmVkKSAmJiAhaXNTdHJpbmcodHJlZUl0ZW1UaGluZy5pY29uUGF0aCkgJiYgIVVSSS5pc1VyaSh0cmVlSXRlbVRoaW5nLmljb25QYXRoKSAmJiAoIXRyZWVJdGVtVGhpbmcuaWNvblBhdGggfHwgIWlzU3RyaW5nKCh0cmVlSXRlbVRoaW5nLmljb25QYXRoIGFzIHZzY29kZS5UaGVtZUljb24pLmlkKSkpIHtcblx0XHRcdGNvbnN0IGFzTGlnaHRBbmREYXJrVGhpbmcgPSB0cmVlSXRlbVRoaW5nLmljb25QYXRoIGFzIHsgbGlnaHQ6IHN0cmluZyB8IFVSSTsgZGFyazogc3RyaW5nIHwgVVJJIH0gfCBudWxsO1xuXHRcdFx0aWYgKCFhc0xpZ2h0QW5kRGFya1RoaW5nIHx8ICghaXNTdHJpbmcoYXNMaWdodEFuZERhcmtUaGluZy5saWdodCkgJiYgIVVSSS5pc1VyaShhc0xpZ2h0QW5kRGFya1RoaW5nLmxpZ2h0KSAmJiAhaXNTdHJpbmcoYXNMaWdodEFuZERhcmtUaGluZy5kYXJrKSAmJiAhVVJJLmlzVXJpKGFzTGlnaHRBbmREYXJrVGhpbmcuZGFyaykpKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIHRyZWUgaXRlbSwgaW52YWxpZCBpY29uUGF0aCcsIHRyZWVJdGVtVGhpbmcuaWNvblBhdGgpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICgodHJlZUl0ZW1UaGluZy5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkKSAmJiAhaXNTdHJpbmcodHJlZUl0ZW1UaGluZy5kZXNjcmlwdGlvbikgJiYgKHR5cGVvZiB0cmVlSXRlbVRoaW5nLmRlc2NyaXB0aW9uICE9PSAnYm9vbGVhbicpKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSU5WQUxJRCB0cmVlIGl0ZW0sIGludmFsaWQgZGVzY3JpcHRpb24nLCB0cmVlSXRlbVRoaW5nLmRlc2NyaXB0aW9uKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCh0cmVlSXRlbVRoaW5nLnJlc291cmNlVXJpICE9PSB1bmRlZmluZWQpICYmICFVUkkuaXNVcmkodHJlZUl0ZW1UaGluZy5yZXNvdXJjZVVyaSkpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIHRyZWUgaXRlbSwgaW52YWxpZCByZXNvdXJjZVVyaScsIHRyZWVJdGVtVGhpbmcucmVzb3VyY2VVcmkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoKHRyZWVJdGVtVGhpbmcudG9vbHRpcCAhPT0gdW5kZWZpbmVkKSAmJiAhaXNTdHJpbmcodHJlZUl0ZW1UaGluZy50b29sdGlwKSAmJiAhKHRyZWVJdGVtVGhpbmcudG9vbHRpcCBpbnN0YW5jZW9mIE1hcmtkb3duU3RyaW5nKSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0lOVkFMSUQgdHJlZSBpdGVtLCBpbnZhbGlkIHRvb2x0aXAnLCB0cmVlSXRlbVRoaW5nLnRvb2x0aXApO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoKHRyZWVJdGVtVGhpbmcuY29tbWFuZCAhPT0gdW5kZWZpbmVkKSAmJiAhdHJlZUl0ZW1UaGluZy5jb21tYW5kLmNvbW1hbmQpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIHRyZWUgaXRlbSwgaW52YWxpZCBjb21tYW5kJywgdHJlZUl0ZW1UaGluZy5jb21tYW5kKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCh0cmVlSXRlbVRoaW5nLmNvbGxhcHNpYmxlU3RhdGUgIT09IHVuZGVmaW5lZCkgJiYgKHRyZWVJdGVtVGhpbmcuY29sbGFwc2libGVTdGF0ZSA8IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lKSAmJiAodHJlZUl0ZW1UaGluZy5jb2xsYXBzaWJsZVN0YXRlID4gVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkKSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0lOVkFMSUQgdHJlZSBpdGVtLCBpbnZhbGlkIGNvbGxhcHNpYmxlU3RhdGUnLCB0cmVlSXRlbVRoaW5nLmNvbGxhcHNpYmxlU3RhdGUpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoKHRyZWVJdGVtVGhpbmcuY29udGV4dFZhbHVlICE9PSB1bmRlZmluZWQpICYmICFpc1N0cmluZyh0cmVlSXRlbVRoaW5nLmNvbnRleHRWYWx1ZSkpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIHRyZWUgaXRlbSwgaW52YWxpZCBjb250ZXh0VmFsdWUnLCB0cmVlSXRlbVRoaW5nLmNvbnRleHRWYWx1ZSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICgodHJlZUl0ZW1UaGluZy5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24gIT09IHVuZGVmaW5lZCkgJiYgIXRyZWVJdGVtVGhpbmcuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uPy5sYWJlbCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0lOVkFMSUQgdHJlZSBpdGVtLCBpbnZhbGlkIGFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbicsIHRyZWVJdGVtVGhpbmcuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcgfCB2c2NvZGUuVHJlZUl0ZW1MYWJlbCwgY29sbGFwc2libGVTdGF0ZT86IHZzY29kZS5UcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUpO1xuXHRjb25zdHJ1Y3RvcihyZXNvdXJjZVVyaTogVVJJLCBjb2xsYXBzaWJsZVN0YXRlPzogdnNjb2RlLlRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZSk7XG5cdGNvbnN0cnVjdG9yKGFyZzE6IHN0cmluZyB8IHZzY29kZS5UcmVlSXRlbUxhYmVsIHwgVVJJLCBwdWJsaWMgY29sbGFwc2libGVTdGF0ZTogdnNjb2RlLlRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZSA9IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lKSB7XG5cdFx0aWYgKFVSSS5pc1VyaShhcmcxKSkge1xuXHRcdFx0dGhpcy5yZXNvdXJjZVVyaSA9IGFyZzE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGFiZWwgPSBhcmcxO1xuXHRcdH1cblx0fVxuXG59XG5cbmV4cG9ydCBlbnVtIFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZSB7XG5cdE5vbmUgPSAwLFxuXHRDb2xsYXBzZWQgPSAxLFxuXHRFeHBhbmRlZCA9IDJcbn1cblxuZXhwb3J0IGVudW0gVHJlZUl0ZW1DaGVja2JveFN0YXRlIHtcblx0VW5jaGVja2VkID0gMCxcblx0Q2hlY2tlZCA9IDFcbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbSBpbXBsZW1lbnRzIHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtIHtcblxuXHRhc3luYyBhc1N0cmluZygpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy52YWx1ZSA9PT0gJ3N0cmluZycgPyB0aGlzLnZhbHVlIDogSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZSk7XG5cdH1cblxuXHRhc0ZpbGUoKTogdW5kZWZpbmVkIHwgdnNjb2RlLkRhdGFUcmFuc2ZlckZpbGUge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmFsdWU6IGFueSxcblx0KSB7IH1cbn1cblxuLyoqXG4gKiBBIGRhdGEgdHJhbnNmZXIgaXRlbSB0aGF0IGhhcyBiZWVuIGNyZWF0ZWQgYnkgVlMgQ29kZSBpbnN0ZWFkIG9mIGJ5IGEgZXh0ZW5zaW9uLlxuICpcbiAqIEludGVudGlvbmFsbHkgbm90IGV4cG9ydGVkIHRvIGV4dGVuc2lvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnRlcm5hbERhdGFUcmFuc2Zlckl0ZW0gZXh0ZW5kcyBEYXRhVHJhbnNmZXJJdGVtIHsgfVxuXG4vKipcbiAqIEEgZGF0YSB0cmFuc2ZlciBpdGVtIGZvciBhIGZpbGUuXG4gKlxuICogSW50ZW50aW9uYWxseSBub3QgZXhwb3J0ZWQgdG8gZXh0ZW5zaW9ucyBhcyBvbmx5IHdlIGNhbiBjcmVhdGUgdGhlc2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnRlcm5hbEZpbGVEYXRhVHJhbnNmZXJJdGVtIGV4dGVuZHMgSW50ZXJuYWxEYXRhVHJhbnNmZXJJdGVtIHtcblxuXHRyZWFkb25seSAjZmlsZTogdnNjb2RlLkRhdGFUcmFuc2ZlckZpbGU7XG5cblx0Y29uc3RydWN0b3IoZmlsZTogdnNjb2RlLkRhdGFUcmFuc2ZlckZpbGUpIHtcblx0XHRzdXBlcignJyk7XG5cdFx0dGhpcy4jZmlsZSA9IGZpbGU7XG5cdH1cblxuXHRvdmVycmlkZSBhc0ZpbGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2ZpbGU7XG5cdH1cbn1cblxuLyoqXG4gKiBJbnRlbnRpb25hbGx5IG5vdCBleHBvcnRlZCB0byBleHRlbnNpb25zXG4gKi9cbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJGaWxlIGltcGxlbWVudHMgdnNjb2RlLkRhdGFUcmFuc2ZlckZpbGUge1xuXG5cdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSB1cmk6IHZzY29kZS5VcmkgfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIHJlYWRvbmx5IF9pdGVtSWQ6IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBfZ2V0RGF0YTogKCkgPT4gUHJvbWlzZTxVaW50OEFycmF5PjtcblxuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHVyaTogdnNjb2RlLlVyaSB8IHVuZGVmaW5lZCwgaXRlbUlkOiBzdHJpbmcsIGdldERhdGE6ICgpID0+IFByb21pc2U8VWludDhBcnJheT4pIHtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMudXJpID0gdXJpO1xuXHRcdHRoaXMuX2l0ZW1JZCA9IGl0ZW1JZDtcblx0XHR0aGlzLl9nZXREYXRhID0gZ2V0RGF0YTtcblx0fVxuXG5cdGRhdGEoKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldERhdGEoKTtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXIgaW1wbGVtZW50cyB2c2NvZGUuRGF0YVRyYW5zZmVyIHtcblx0I2l0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtW10+KCk7XG5cblx0Y29uc3RydWN0b3IoaW5pdD86IEl0ZXJhYmxlPHJlYWRvbmx5IFtzdHJpbmcsIHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtXT4pIHtcblx0XHRmb3IgKGNvbnN0IFttaW1lLCBpdGVtXSBvZiBpbml0ID8/IFtdKSB7XG5cdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuI2l0ZW1zLmdldCh0aGlzLiNub3JtYWxpemVNaW1lKG1pbWUpKTtcblx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRleGlzdGluZy5wdXNoKGl0ZW0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4jaXRlbXMuc2V0KHRoaXMuI25vcm1hbGl6ZU1pbWUobWltZSksIFtpdGVtXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0KG1pbWVUeXBlOiBzdHJpbmcpOiB2c2NvZGUuRGF0YVRyYW5zZmVySXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuI2l0ZW1zLmdldCh0aGlzLiNub3JtYWxpemVNaW1lKG1pbWVUeXBlKSk/LlswXTtcblx0fVxuXG5cdHNldChtaW1lVHlwZTogc3RyaW5nLCB2YWx1ZTogdnNjb2RlLkRhdGFUcmFuc2Zlckl0ZW0pOiB2b2lkIHtcblx0XHQvLyBUaGlzIGludGVudGlvbmFsbHkgb3ZlcndyaXRlcyBhbGwgZW50cmllcyBmb3IgYSBnaXZlbiBtaW1ldHlwZS5cblx0XHQvLyBUaGlzIGlzIHNpbWlsYXIgdG8gaG93IHRoZSBET00gRGF0YVRyYW5zZmVyIHR5cGUgd29ya3Ncblx0XHR0aGlzLiNpdGVtcy5zZXQodGhpcy4jbm9ybWFsaXplTWltZShtaW1lVHlwZSksIFt2YWx1ZV0pO1xuXHR9XG5cblx0Zm9yRWFjaChjYWxsYmFja2ZuOiAodmFsdWU6IHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtLCBrZXk6IHN0cmluZywgZGF0YVRyYW5zZmVyOiBEYXRhVHJhbnNmZXIpID0+IHZvaWQsIHRoaXNBcmc/OiB1bmtub3duKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbbWltZSwgaXRlbXNdIG9mIHRoaXMuI2l0ZW1zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdFx0Y2FsbGJhY2tmbi5jYWxsKHRoaXNBcmcsIGl0ZW0sIG1pbWUsIHRoaXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdCpbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFttaW1lVHlwZTogc3RyaW5nLCBpdGVtOiB2c2NvZGUuRGF0YVRyYW5zZmVySXRlbV0+IHtcblx0XHRmb3IgKGNvbnN0IFttaW1lLCBpdGVtc10gb2YgdGhpcy4jaXRlbXMpIHtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdFx0XHR5aWVsZCBbbWltZSwgaXRlbV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0I25vcm1hbGl6ZU1pbWUobWltZVR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIG1pbWVUeXBlLnRvTG93ZXJDYXNlKCk7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgRG9jdW1lbnREcm9wRWRpdCB7XG5cdHRpdGxlPzogc3RyaW5nO1xuXG5cdGlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0aW5zZXJ0VGV4dDogc3RyaW5nIHwgU25pcHBldFN0cmluZztcblxuXHRhZGRpdGlvbmFsRWRpdD86IFdvcmtzcGFjZUVkaXQ7XG5cblx0a2luZD86IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZDtcblxuXHRjb25zdHJ1Y3RvcihpbnNlcnRUZXh0OiBzdHJpbmcgfCBTbmlwcGV0U3RyaW5nLCB0aXRsZT86IHN0cmluZywga2luZD86IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCkge1xuXHRcdHRoaXMuaW5zZXJ0VGV4dCA9IGluc2VydFRleHQ7XG5cdFx0dGhpcy50aXRsZSA9IHRpdGxlO1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gRG9jdW1lbnRQYXN0ZVRyaWdnZXJLaW5kIHtcblx0QXV0b21hdGljID0gMCxcblx0UGFzdGVBcyA9IDEsXG59XG5cbmV4cG9ydCBjbGFzcyBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQge1xuXHRzdGF0aWMgRW1wdHk6IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZDtcblx0c3RhdGljIFRleHQ6IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZDtcblx0c3RhdGljIFRleHRVcGRhdGVJbXBvcnRzOiBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgc2VwID0gJy4nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB2YWx1ZTogc3RyaW5nXG5cdCkgeyB9XG5cblx0cHVibGljIGFwcGVuZCguLi5wYXJ0czogc3RyaW5nW10pOiBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQge1xuXHRcdHJldHVybiBuZXcgRG9jdW1lbnREcm9wT3JQYXN0ZUVkaXRLaW5kKCh0aGlzLnZhbHVlID8gW3RoaXMudmFsdWUsIC4uLnBhcnRzXSA6IHBhcnRzKS5qb2luKERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZC5zZXApKTtcblx0fVxuXG5cdHB1YmxpYyBpbnRlcnNlY3RzKG90aGVyOiBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb250YWlucyhvdGhlcikgfHwgb3RoZXIuY29udGFpbnModGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgY29udGFpbnMob3RoZXI6IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlID09PSBvdGhlci52YWx1ZSB8fCBvdGhlci52YWx1ZS5zdGFydHNXaXRoKHRoaXMudmFsdWUgKyBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQuc2VwKTtcblx0fVxufVxuRG9jdW1lbnREcm9wT3JQYXN0ZUVkaXRLaW5kLkVtcHR5ID0gbmV3IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCgnJyk7XG5Eb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQuVGV4dCA9IG5ldyBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQoJ3RleHQnKTtcbkRvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZC5UZXh0VXBkYXRlSW1wb3J0cyA9IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZC5UZXh0LmFwcGVuZCgndXBkYXRlSW1wb3J0cycpO1xuXG5leHBvcnQgY2xhc3MgRG9jdW1lbnRQYXN0ZUVkaXQge1xuXG5cdHRpdGxlOiBzdHJpbmc7XG5cdGluc2VydFRleHQ6IHN0cmluZyB8IFNuaXBwZXRTdHJpbmc7XG5cdGFkZGl0aW9uYWxFZGl0PzogV29ya3NwYWNlRWRpdDtcblx0a2luZDogRG9jdW1lbnREcm9wT3JQYXN0ZUVkaXRLaW5kO1xuXG5cdGNvbnN0cnVjdG9yKGluc2VydFRleHQ6IHN0cmluZyB8IFNuaXBwZXRTdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGtpbmQ6IERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCkge1xuXHRcdHRoaXMudGl0bGUgPSB0aXRsZTtcblx0XHR0aGlzLmluc2VydFRleHQgPSBpbnNlcnRUZXh0O1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgVGhlbWVJY29uIHtcblxuXHRzdGF0aWMgRmlsZTogVGhlbWVJY29uO1xuXHRzdGF0aWMgRm9sZGVyOiBUaGVtZUljb247XG5cblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgY29sb3I/OiBUaGVtZUNvbG9yO1xuXG5cdGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIGNvbG9yPzogVGhlbWVDb2xvcikge1xuXHRcdHRoaXMuaWQgPSBpZDtcblx0XHR0aGlzLmNvbG9yID0gY29sb3I7XG5cdH1cblxuXHRzdGF0aWMgaXNUaGVtZUljb24odGhpbmc6IGFueSkge1xuXHRcdGlmICh0eXBlb2YgdGhpbmcuaWQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSU5WQUxJRCBUaGVtZUljb24sIGludmFsaWQgaWQnLCB0aGluZy5pZCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5UaGVtZUljb24uRmlsZSA9IG5ldyBUaGVtZUljb24oJ2ZpbGUnKTtcblRoZW1lSWNvbi5Gb2xkZXIgPSBuZXcgVGhlbWVJY29uKCdmb2xkZXInKTtcblxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBUaGVtZUNvbG9yIHtcblx0aWQ6IHN0cmluZztcblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZykge1xuXHRcdHRoaXMuaWQgPSBpZDtcblx0fVxufVxuXG5leHBvcnQgZW51bSBDb25maWd1cmF0aW9uVGFyZ2V0IHtcblx0R2xvYmFsID0gMSxcblxuXHRXb3Jrc3BhY2UgPSAyLFxuXG5cdFdvcmtzcGFjZUZvbGRlciA9IDNcbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgUmVsYXRpdmVQYXR0ZXJuIGltcGxlbWVudHMgSVJlbGF0aXZlUGF0dGVybiB7XG5cblx0cGF0dGVybjogc3RyaW5nO1xuXG5cdHByaXZhdGUgX2Jhc2UhOiBzdHJpbmc7XG5cdGdldCBiYXNlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2Jhc2U7XG5cdH1cblx0c2V0IGJhc2UoYmFzZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fYmFzZSA9IGJhc2U7XG5cdFx0dGhpcy5fYmFzZVVyaSA9IFVSSS5maWxlKGJhc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYmFzZVVyaSE6IFVSSTtcblx0Z2V0IGJhc2VVcmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5fYmFzZVVyaTtcblx0fVxuXHRzZXQgYmFzZVVyaShiYXNlVXJpOiBVUkkpIHtcblx0XHR0aGlzLl9iYXNlVXJpID0gYmFzZVVyaTtcblx0XHR0aGlzLl9iYXNlID0gYmFzZVVyaS5mc1BhdGg7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihiYXNlOiB2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHwgVVJJIHwgc3RyaW5nLCBwYXR0ZXJuOiBzdHJpbmcpIHtcblx0XHRpZiAodHlwZW9mIGJhc2UgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpZiAoIWJhc2UgfHwgIVVSSS5pc1VyaShiYXNlKSAmJiAhVVJJLmlzVXJpKGJhc2UudXJpKSkge1xuXHRcdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2Jhc2UnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHBhdHRlcm4gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ3BhdHRlcm4nKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGJhc2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLmJhc2VVcmkgPSBVUkkuZmlsZShiYXNlKTtcblx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaShiYXNlKSkge1xuXHRcdFx0dGhpcy5iYXNlVXJpID0gYmFzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5iYXNlVXJpID0gYmFzZS51cmk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcblx0fVxuXG5cdHRvSlNPTigpOiBJUmVsYXRpdmVQYXR0ZXJuRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cGF0dGVybjogdGhpcy5wYXR0ZXJuLFxuXHRcdFx0YmFzZTogdGhpcy5iYXNlLFxuXHRcdFx0YmFzZVVyaTogdGhpcy5iYXNlVXJpLnRvSlNPTigpXG5cdFx0fTtcblx0fVxufVxuXG5jb25zdCBicmVha3BvaW50SWRzID0gbmV3IFdlYWtNYXA8QnJlYWtwb2ludCwgc3RyaW5nPigpO1xuXG4vKipcbiAqIFdlIHdhbnQgdG8gYmUgYWJsZSB0byBjb25zdHJ1Y3QgQnJlYWtwb2ludHMgaW50ZXJuYWxseSB0aGF0IGhhdmUgYSBwYXJ0aWN1bGFyIGlkLCBidXQgd2UgZG9uJ3Qgd2FudCBleHRlbnNpb25zIHRvIGJlXG4gKiBhYmxlIHRvIGRvIHRoaXMgd2l0aCB0aGUgZXhwb3NlZCBCcmVha3BvaW50IGNsYXNzZXMgaW4gZXh0ZW5zaW9uIEFQSS5cbiAqIFdlIGFsc28gd2FudCBcImluc3RhbmNlb2ZcIiB0byB3b3JrIHdpdGggZGVidWcuYnJlYWtwb2ludHMgYW5kIHRoZSBleHBvc2VkIGJyZWFrcG9pbnQgY2xhc3Nlcy5cbiAqIEFuZCBwcml2YXRlIG1lbWJlcnMgd2lsbCBiZSByZW5hbWVkIGluIHRoZSBidWlsdCBqcywgc28gY2FzdGluZyB0byBhbnkgYW5kIHNldHRpbmcgYSBwcml2YXRlIG1lbWJlciBpcyBub3Qgc2FmZS5cbiAqIFNvLCB3ZSBzdG9yZSBpbnRlcm5hbCBicmVha3BvaW50IElEcyBpbiBhIFdlYWtNYXAuIFRoaXMgZnVuY3Rpb24gbXVzdCBiZSBjYWxsZWQgYWZ0ZXIgY29uc3RydWN0aW5nIGEgQnJlYWtwb2ludFxuICogd2l0aCBhIGtub3duIGlkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0QnJlYWtwb2ludElkKGJwOiBCcmVha3BvaW50LCBpZDogc3RyaW5nKSB7XG5cdGJyZWFrcG9pbnRJZHMuc2V0KGJwLCBpZCk7XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIEJyZWFrcG9pbnQge1xuXG5cdHByaXZhdGUgX2lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29uZGl0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBoaXRDb25kaXRpb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGxvZ01lc3NhZ2U/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IG1vZGU/OiBzdHJpbmc7XG5cblx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKGVuYWJsZWQ/OiBib29sZWFuLCBjb25kaXRpb24/OiBzdHJpbmcsIGhpdENvbmRpdGlvbj86IHN0cmluZywgbG9nTWVzc2FnZT86IHN0cmluZywgbW9kZT86IHN0cmluZykge1xuXHRcdHRoaXMuZW5hYmxlZCA9IHR5cGVvZiBlbmFibGVkID09PSAnYm9vbGVhbicgPyBlbmFibGVkIDogdHJ1ZTtcblx0XHRpZiAodHlwZW9mIGNvbmRpdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuY29uZGl0aW9uID0gY29uZGl0aW9uO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGhpdENvbmRpdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuaGl0Q29uZGl0aW9uID0gaGl0Q29uZGl0aW9uO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGxvZ01lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLmxvZ01lc3NhZ2UgPSBsb2dNZXNzYWdlO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLm1vZGUgPSBtb2RlO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpZCgpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5faWQpIHtcblx0XHRcdHRoaXMuX2lkID0gYnJlYWtwb2ludElkcy5nZXQodGhpcykgPz8gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBTb3VyY2VCcmVha3BvaW50IGV4dGVuZHMgQnJlYWtwb2ludCB7XG5cdHJlYWRvbmx5IGxvY2F0aW9uOiBMb2NhdGlvbjtcblxuXHRjb25zdHJ1Y3Rvcihsb2NhdGlvbjogTG9jYXRpb24sIGVuYWJsZWQ/OiBib29sZWFuLCBjb25kaXRpb24/OiBzdHJpbmcsIGhpdENvbmRpdGlvbj86IHN0cmluZywgbG9nTWVzc2FnZT86IHN0cmluZywgbW9kZT86IHN0cmluZykge1xuXHRcdHN1cGVyKGVuYWJsZWQsIGNvbmRpdGlvbiwgaGl0Q29uZGl0aW9uLCBsb2dNZXNzYWdlLCBtb2RlKTtcblx0XHRpZiAobG9jYXRpb24gPT09IG51bGwpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnbG9jYXRpb24nKTtcblx0XHR9XG5cdFx0dGhpcy5sb2NhdGlvbiA9IGxvY2F0aW9uO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIEZ1bmN0aW9uQnJlYWtwb2ludCBleHRlbmRzIEJyZWFrcG9pbnQge1xuXHRyZWFkb25seSBmdW5jdGlvbk5hbWU6IHN0cmluZztcblxuXHRjb25zdHJ1Y3RvcihmdW5jdGlvbk5hbWU6IHN0cmluZywgZW5hYmxlZD86IGJvb2xlYW4sIGNvbmRpdGlvbj86IHN0cmluZywgaGl0Q29uZGl0aW9uPzogc3RyaW5nLCBsb2dNZXNzYWdlPzogc3RyaW5nLCBtb2RlPzogc3RyaW5nKSB7XG5cdFx0c3VwZXIoZW5hYmxlZCwgY29uZGl0aW9uLCBoaXRDb25kaXRpb24sIGxvZ01lc3NhZ2UsIG1vZGUpO1xuXHRcdHRoaXMuZnVuY3Rpb25OYW1lID0gZnVuY3Rpb25OYW1lO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIERhdGFCcmVha3BvaW50IGV4dGVuZHMgQnJlYWtwb2ludCB7XG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGRhdGFJZDogc3RyaW5nO1xuXHRyZWFkb25seSBjYW5QZXJzaXN0OiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcsIGRhdGFJZDogc3RyaW5nLCBjYW5QZXJzaXN0OiBib29sZWFuLCBlbmFibGVkPzogYm9vbGVhbiwgY29uZGl0aW9uPzogc3RyaW5nLCBoaXRDb25kaXRpb24/OiBzdHJpbmcsIGxvZ01lc3NhZ2U/OiBzdHJpbmcsIG1vZGU/OiBzdHJpbmcpIHtcblx0XHRzdXBlcihlbmFibGVkLCBjb25kaXRpb24sIGhpdENvbmRpdGlvbiwgbG9nTWVzc2FnZSwgbW9kZSk7XG5cdFx0aWYgKCFkYXRhSWQpIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnZGF0YUlkJyk7XG5cdFx0fVxuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLmRhdGFJZCA9IGRhdGFJZDtcblx0XHR0aGlzLmNhblBlcnNpc3QgPSBjYW5QZXJzaXN0O1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIERlYnVnQWRhcHRlckV4ZWN1dGFibGUgaW1wbGVtZW50cyB2c2NvZGUuRGVidWdBZGFwdGVyRXhlY3V0YWJsZSB7XG5cdHJlYWRvbmx5IGNvbW1hbmQ6IHN0cmluZztcblx0cmVhZG9ubHkgYXJnczogc3RyaW5nW107XG5cdHJlYWRvbmx5IG9wdGlvbnM/OiB2c2NvZGUuRGVidWdBZGFwdGVyRXhlY3V0YWJsZU9wdGlvbnM7XG5cblx0Y29uc3RydWN0b3IoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgb3B0aW9ucz86IHZzY29kZS5EZWJ1Z0FkYXB0ZXJFeGVjdXRhYmxlT3B0aW9ucykge1xuXHRcdHRoaXMuY29tbWFuZCA9IGNvbW1hbmQ7XG5cdFx0dGhpcy5hcmdzID0gYXJncyB8fCBbXTtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIERlYnVnQWRhcHRlclNlcnZlciBpbXBsZW1lbnRzIHZzY29kZS5EZWJ1Z0FkYXB0ZXJTZXJ2ZXIge1xuXHRyZWFkb25seSBwb3J0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGhvc3Q/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IocG9ydDogbnVtYmVyLCBob3N0Pzogc3RyaW5nKSB7XG5cdFx0dGhpcy5wb3J0ID0gcG9ydDtcblx0XHR0aGlzLmhvc3QgPSBob3N0O1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIERlYnVnQWRhcHRlck5hbWVkUGlwZVNlcnZlciBpbXBsZW1lbnRzIHZzY29kZS5EZWJ1Z0FkYXB0ZXJOYW1lZFBpcGVTZXJ2ZXIge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcGF0aDogc3RyaW5nKSB7XG5cdH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgRGVidWdBZGFwdGVySW5saW5lSW1wbGVtZW50YXRpb24gaW1wbGVtZW50cyB2c2NvZGUuRGVidWdBZGFwdGVySW5saW5lSW1wbGVtZW50YXRpb24ge1xuXHRyZWFkb25seSBpbXBsZW1lbnRhdGlvbjogdnNjb2RlLkRlYnVnQWRhcHRlcjtcblxuXHRjb25zdHJ1Y3RvcihpbXBsOiB2c2NvZGUuRGVidWdBZGFwdGVyKSB7XG5cdFx0dGhpcy5pbXBsZW1lbnRhdGlvbiA9IGltcGw7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgRGVidWdTdGFja0ZyYW1lIGltcGxlbWVudHMgdnNjb2RlLkRlYnVnU3RhY2tGcmFtZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBzZXNzaW9uOiB2c2NvZGUuRGVidWdTZXNzaW9uLFxuXHRcdHJlYWRvbmx5IHRocmVhZElkOiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgZnJhbWVJZDogbnVtYmVyKSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnVGhyZWFkIGltcGxlbWVudHMgdnNjb2RlLkRlYnVnVGhyZWFkIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHNlc3Npb246IHZzY29kZS5EZWJ1Z1Nlc3Npb24sXG5cdFx0cmVhZG9ubHkgdGhyZWFkSWQ6IG51bWJlcikgeyB9XG59XG5cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgRXZhbHVhdGFibGVFeHByZXNzaW9uIGltcGxlbWVudHMgdnNjb2RlLkV2YWx1YXRhYmxlRXhwcmVzc2lvbiB7XG5cdHJlYWRvbmx5IHJhbmdlOiB2c2NvZGUuUmFuZ2U7XG5cdHJlYWRvbmx5IGV4cHJlc3Npb24/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IocmFuZ2U6IHZzY29kZS5SYW5nZSwgZXhwcmVzc2lvbj86IHN0cmluZykge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLmV4cHJlc3Npb24gPSBleHByZXNzaW9uO1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCB7XG5cdEludm9rZSA9IDAsXG5cdEF1dG9tYXRpYyA9IDEsXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIElubGluZVZhbHVlVGV4dCBpbXBsZW1lbnRzIHZzY29kZS5JbmxpbmVWYWx1ZVRleHQge1xuXHRyZWFkb25seSByYW5nZTogUmFuZ2U7XG5cdHJlYWRvbmx5IHRleHQ6IHN0cmluZztcblxuXHRjb25zdHJ1Y3RvcihyYW5nZTogUmFuZ2UsIHRleHQ6IHN0cmluZykge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLnRleHQgPSB0ZXh0O1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIElubGluZVZhbHVlVmFyaWFibGVMb29rdXAgaW1wbGVtZW50cyB2c2NvZGUuSW5saW5lVmFsdWVWYXJpYWJsZUxvb2t1cCB7XG5cdHJlYWRvbmx5IHJhbmdlOiBSYW5nZTtcblx0cmVhZG9ubHkgdmFyaWFibGVOYW1lPzogc3RyaW5nO1xuXHRyZWFkb25seSBjYXNlU2Vuc2l0aXZlTG9va3VwOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKHJhbmdlOiBSYW5nZSwgdmFyaWFibGVOYW1lPzogc3RyaW5nLCBjYXNlU2Vuc2l0aXZlTG9va3VwOiBib29sZWFuID0gdHJ1ZSkge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLnZhcmlhYmxlTmFtZSA9IHZhcmlhYmxlTmFtZTtcblx0XHR0aGlzLmNhc2VTZW5zaXRpdmVMb29rdXAgPSBjYXNlU2Vuc2l0aXZlTG9va3VwO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIElubGluZVZhbHVlRXZhbHVhdGFibGVFeHByZXNzaW9uIGltcGxlbWVudHMgdnNjb2RlLklubGluZVZhbHVlRXZhbHVhdGFibGVFeHByZXNzaW9uIHtcblx0cmVhZG9ubHkgcmFuZ2U6IFJhbmdlO1xuXHRyZWFkb25seSBleHByZXNzaW9uPzogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKHJhbmdlOiBSYW5nZSwgZXhwcmVzc2lvbj86IHN0cmluZykge1xuXHRcdHRoaXMucmFuZ2UgPSByYW5nZTtcblx0XHR0aGlzLmV4cHJlc3Npb24gPSBleHByZXNzaW9uO1xuXHR9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIElubGluZVZhbHVlQ29udGV4dCBpbXBsZW1lbnRzIHZzY29kZS5JbmxpbmVWYWx1ZUNvbnRleHQge1xuXG5cdHJlYWRvbmx5IGZyYW1lSWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgc3RvcHBlZExvY2F0aW9uOiB2c2NvZGUuUmFuZ2U7XG5cblx0Y29uc3RydWN0b3IoZnJhbWVJZDogbnVtYmVyLCByYW5nZTogdnNjb2RlLlJhbmdlKSB7XG5cdFx0dGhpcy5mcmFtZUlkID0gZnJhbWVJZDtcblx0XHR0aGlzLnN0b3BwZWRMb2NhdGlvbiA9IHJhbmdlO1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIE5ld1N5bWJvbE5hbWVUYWcge1xuXHRBSUdlbmVyYXRlZCA9IDFcbn1cblxuZXhwb3J0IGVudW0gTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kIHtcblx0SW52b2tlID0gMCxcblx0QXV0b21hdGljID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIE5ld1N5bWJvbE5hbWUgaW1wbGVtZW50cyB2c2NvZGUuTmV3U3ltYm9sTmFtZSB7XG5cdHJlYWRvbmx5IG5ld1N5bWJvbE5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgdGFncz86IHJlYWRvbmx5IHZzY29kZS5OZXdTeW1ib2xOYW1lVGFnW10gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bmV3U3ltYm9sTmFtZTogc3RyaW5nLFxuXHRcdHRhZ3M/OiByZWFkb25seSBOZXdTeW1ib2xOYW1lVGFnW11cblx0KSB7XG5cdFx0dGhpcy5uZXdTeW1ib2xOYW1lID0gbmV3U3ltYm9sTmFtZTtcblx0XHR0aGlzLnRhZ3MgPSB0YWdzO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiBmaWxlIGFwaVxuXG5leHBvcnQgZW51bSBGaWxlQ2hhbmdlVHlwZSB7XG5cdENoYW5nZWQgPSAxLFxuXHRDcmVhdGVkID0gMixcblx0RGVsZXRlZCA9IDMsXG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1FcnJvciBleHRlbmRzIEVycm9yIHtcblxuXHRzdGF0aWMgRmlsZUV4aXN0cyhtZXNzYWdlT3JVcmk/OiBzdHJpbmcgfCBVUkkpOiBGaWxlU3lzdGVtRXJyb3Ige1xuXHRcdHJldHVybiBuZXcgRmlsZVN5c3RlbUVycm9yKG1lc3NhZ2VPclVyaSwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVFeGlzdHMsIEZpbGVTeXN0ZW1FcnJvci5GaWxlRXhpc3RzKTtcblx0fVxuXHRzdGF0aWMgRmlsZU5vdEZvdW5kKG1lc3NhZ2VPclVyaT86IHN0cmluZyB8IFVSSSk6IEZpbGVTeXN0ZW1FcnJvciB7XG5cdFx0cmV0dXJuIG5ldyBGaWxlU3lzdGVtRXJyb3IobWVzc2FnZU9yVXJpLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEZvdW5kLCBGaWxlU3lzdGVtRXJyb3IuRmlsZU5vdEZvdW5kKTtcblx0fVxuXHRzdGF0aWMgRmlsZU5vdEFEaXJlY3RvcnkobWVzc2FnZU9yVXJpPzogc3RyaW5nIHwgVVJJKTogRmlsZVN5c3RlbUVycm9yIHtcblx0XHRyZXR1cm4gbmV3IEZpbGVTeXN0ZW1FcnJvcihtZXNzYWdlT3JVcmksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90QURpcmVjdG9yeSwgRmlsZVN5c3RlbUVycm9yLkZpbGVOb3RBRGlyZWN0b3J5KTtcblx0fVxuXHRzdGF0aWMgRmlsZUlzQURpcmVjdG9yeShtZXNzYWdlT3JVcmk/OiBzdHJpbmcgfCBVUkkpOiBGaWxlU3lzdGVtRXJyb3Ige1xuXHRcdHJldHVybiBuZXcgRmlsZVN5c3RlbUVycm9yKG1lc3NhZ2VPclVyaSwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVJc0FEaXJlY3RvcnksIEZpbGVTeXN0ZW1FcnJvci5GaWxlSXNBRGlyZWN0b3J5KTtcblx0fVxuXHRzdGF0aWMgTm9QZXJtaXNzaW9ucyhtZXNzYWdlT3JVcmk/OiBzdHJpbmcgfCBVUkkpOiBGaWxlU3lzdGVtRXJyb3Ige1xuXHRcdHJldHVybiBuZXcgRmlsZVN5c3RlbUVycm9yKG1lc3NhZ2VPclVyaSwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLk5vUGVybWlzc2lvbnMsIEZpbGVTeXN0ZW1FcnJvci5Ob1Blcm1pc3Npb25zKTtcblx0fVxuXHRzdGF0aWMgVW5hdmFpbGFibGUobWVzc2FnZU9yVXJpPzogc3RyaW5nIHwgVVJJKTogRmlsZVN5c3RlbUVycm9yIHtcblx0XHRyZXR1cm4gbmV3IEZpbGVTeXN0ZW1FcnJvcihtZXNzYWdlT3JVcmksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5VbmF2YWlsYWJsZSwgRmlsZVN5c3RlbUVycm9yLlVuYXZhaWxhYmxlKTtcblx0fVxuXG5cdHJlYWRvbmx5IGNvZGU6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcih1cmlPck1lc3NhZ2U/OiBzdHJpbmcgfCBVUkksIGNvZGU6IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZSA9IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Vbmtub3duLCB0ZXJtaW5hdG9yPzogRnVuY3Rpb24pIHtcblx0XHRzdXBlcihVUkkuaXNVcmkodXJpT3JNZXNzYWdlKSA/IHVyaU9yTWVzc2FnZS50b1N0cmluZyh0cnVlKSA6IHVyaU9yTWVzc2FnZSk7XG5cblx0XHR0aGlzLmNvZGUgPSB0ZXJtaW5hdG9yPy5uYW1lID8/ICdVbmtub3duJztcblxuXHRcdC8vIG1hcmsgdGhlIGVycm9yIGFzIGZpbGUgc3lzdGVtIHByb3ZpZGVyIGVycm9yIHNvIHRoYXRcblx0XHQvLyB3ZSBjYW4gZXh0cmFjdCB0aGUgZXJyb3IgY29kZSBvbiB0aGUgcmVjZWl2aW5nIHNpZGVcblx0XHRtYXJrQXNGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcih0aGlzLCBjb2RlKTtcblxuXHRcdC8vIHdvcmthcm91bmQgd2hlbiBleHRlbmRpbmcgYnVpbHRpbiBvYmplY3RzIGFuZCB3aGVuIGNvbXBpbGluZyB0byBFUzUsIHNlZTpcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQtd2lraS9ibG9iL21hc3Rlci9CcmVha2luZy1DaGFuZ2VzLm1kI2V4dGVuZGluZy1idWlsdC1pbnMtbGlrZS1lcnJvci1hcnJheS1hbmQtbWFwLW1heS1uby1sb25nZXItd29ya1xuXHRcdE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBGaWxlU3lzdGVtRXJyb3IucHJvdG90eXBlKTtcblxuXHRcdGlmICh0eXBlb2YgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIHRlcm1pbmF0b3IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdC8vIG5pY2Ugc3RhY2sgdHJhY2VzXG5cdFx0XHRFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0ZXJtaW5hdG9yKTtcblx0XHR9XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBmb2xkaW5nIGFwaVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBGb2xkaW5nUmFuZ2Uge1xuXG5cdHN0YXJ0OiBudW1iZXI7XG5cblx0ZW5kOiBudW1iZXI7XG5cblx0a2luZD86IEZvbGRpbmdSYW5nZUtpbmQ7XG5cblx0Y29uc3RydWN0b3Ioc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGtpbmQ/OiBGb2xkaW5nUmFuZ2VLaW5kKSB7XG5cdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xuXHRcdHRoaXMuZW5kID0gZW5kO1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gRm9sZGluZ1JhbmdlS2luZCB7XG5cdENvbW1lbnQgPSAxLFxuXHRJbXBvcnRzID0gMixcblx0UmVnaW9uID0gM1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIENvbW1lbnRcbmV4cG9ydCBlbnVtIENvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlIHtcblx0LyoqXG5cdCAqIERldGVybWluZXMgYW4gaXRlbSBpcyBjb2xsYXBzZWRcblx0ICovXG5cdENvbGxhcHNlZCA9IDAsXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmVzIGFuIGl0ZW0gaXMgZXhwYW5kZWRcblx0ICovXG5cdEV4cGFuZGVkID0gMVxufVxuXG5leHBvcnQgZW51bSBDb21tZW50TW9kZSB7XG5cdEVkaXRpbmcgPSAwLFxuXHRQcmV2aWV3ID0gMVxufVxuXG5leHBvcnQgZW51bSBDb21tZW50U3RhdGUge1xuXHRQdWJsaXNoZWQgPSAwLFxuXHREcmFmdCA9IDFcbn1cblxuZXhwb3J0IGVudW0gQ29tbWVudFRocmVhZFN0YXRlIHtcblx0VW5yZXNvbHZlZCA9IDAsXG5cdFJlc29sdmVkID0gMVxufVxuXG5leHBvcnQgZW51bSBDb21tZW50VGhyZWFkQXBwbGljYWJpbGl0eSB7XG5cdEN1cnJlbnQgPSAwLFxuXHRPdXRkYXRlZCA9IDFcbn1cblxuZXhwb3J0IGVudW0gQ29tbWVudFRocmVhZEZvY3VzIHtcblx0UmVwbHkgPSAxLFxuXHRDb21tZW50ID0gMlxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFNlbWFudGljIENvbG9yaW5nXG5cbmV4cG9ydCBjbGFzcyBTZW1hbnRpY1Rva2Vuc0xlZ2VuZCB7XG5cdHB1YmxpYyByZWFkb25seSB0b2tlblR5cGVzOiBzdHJpbmdbXTtcblx0cHVibGljIHJlYWRvbmx5IHRva2VuTW9kaWZpZXJzOiBzdHJpbmdbXTtcblxuXHRjb25zdHJ1Y3Rvcih0b2tlblR5cGVzOiBzdHJpbmdbXSwgdG9rZW5Nb2RpZmllcnM6IHN0cmluZ1tdID0gW10pIHtcblx0XHR0aGlzLnRva2VuVHlwZXMgPSB0b2tlblR5cGVzO1xuXHRcdHRoaXMudG9rZW5Nb2RpZmllcnMgPSB0b2tlbk1vZGlmaWVycztcblx0fVxufVxuXG5mdW5jdGlvbiBpc1N0ckFycmF5T3JVbmRlZmluZWQoYXJnOiBhbnkpOiBhcmcgaXMgc3RyaW5nW10gfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gKCh0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJykgfHwgaXNTdHJpbmdBcnJheShhcmcpKTtcbn1cblxuZXhwb3J0IGNsYXNzIFNlbWFudGljVG9rZW5zQnVpbGRlciB7XG5cblx0cHJpdmF0ZSBfcHJldkxpbmU6IG51bWJlcjtcblx0cHJpdmF0ZSBfcHJldkNoYXI6IG51bWJlcjtcblx0cHJpdmF0ZSBfZGF0YUlzU29ydGVkQW5kRGVsdGFFbmNvZGVkOiBib29sZWFuO1xuXHRwcml2YXRlIF9kYXRhOiBudW1iZXJbXTtcblx0cHJpdmF0ZSBfZGF0YUxlbjogbnVtYmVyO1xuXHRwcml2YXRlIF90b2tlblR5cGVTdHJUb0ludDogTWFwPHN0cmluZywgbnVtYmVyPjtcblx0cHJpdmF0ZSBfdG9rZW5Nb2RpZmllclN0clRvSW50OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuXHRwcml2YXRlIF9oYXNMZWdlbmQ6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IobGVnZW5kPzogdnNjb2RlLlNlbWFudGljVG9rZW5zTGVnZW5kKSB7XG5cdFx0dGhpcy5fcHJldkxpbmUgPSAwO1xuXHRcdHRoaXMuX3ByZXZDaGFyID0gMDtcblx0XHR0aGlzLl9kYXRhSXNTb3J0ZWRBbmREZWx0YUVuY29kZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2RhdGEgPSBbXTtcblx0XHR0aGlzLl9kYXRhTGVuID0gMDtcblx0XHR0aGlzLl90b2tlblR5cGVTdHJUb0ludCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cdFx0dGhpcy5fdG9rZW5Nb2RpZmllclN0clRvSW50ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHR0aGlzLl9oYXNMZWdlbmQgPSBmYWxzZTtcblx0XHRpZiAobGVnZW5kKSB7XG5cdFx0XHR0aGlzLl9oYXNMZWdlbmQgPSB0cnVlO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGxlZ2VuZC50b2tlblR5cGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdHRoaXMuX3Rva2VuVHlwZVN0clRvSW50LnNldChsZWdlbmQudG9rZW5UeXBlc1tpXSwgaSk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbGVnZW5kLnRva2VuTW9kaWZpZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdHRoaXMuX3Rva2VuTW9kaWZpZXJTdHJUb0ludC5zZXQobGVnZW5kLnRva2VuTW9kaWZpZXJzW2ldLCBpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcHVzaChsaW5lOiBudW1iZXIsIGNoYXI6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHRva2VuVHlwZTogbnVtYmVyLCB0b2tlbk1vZGlmaWVycz86IG51bWJlcik6IHZvaWQ7XG5cdHB1YmxpYyBwdXNoKHJhbmdlOiBSYW5nZSwgdG9rZW5UeXBlOiBzdHJpbmcsIHRva2VuTW9kaWZpZXJzPzogc3RyaW5nW10pOiB2b2lkO1xuXHRwdWJsaWMgcHVzaChhcmcwOiBhbnksIGFyZzE6IGFueSwgYXJnMjogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55KTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiBhcmcwID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgYXJnMSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGFyZzIgPT09ICdudW1iZXInICYmIHR5cGVvZiBhcmczID09PSAnbnVtYmVyJyAmJiAodHlwZW9mIGFyZzQgPT09ICdudW1iZXInIHx8IHR5cGVvZiBhcmc0ID09PSAndW5kZWZpbmVkJykpIHtcblx0XHRcdGlmICh0eXBlb2YgYXJnNCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0YXJnNCA9IDA7XG5cdFx0XHR9XG5cdFx0XHQvLyAxc3Qgb3ZlcmxvYWRcblx0XHRcdHJldHVybiB0aGlzLl9wdXNoRW5jb2RlZChhcmcwLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0KTtcblx0XHR9XG5cdFx0aWYgKFJhbmdlLmlzUmFuZ2UoYXJnMCkgJiYgdHlwZW9mIGFyZzEgPT09ICdzdHJpbmcnICYmIGlzU3RyQXJyYXlPclVuZGVmaW5lZChhcmcyKSkge1xuXHRcdFx0Ly8gMm5kIG92ZXJsb2FkXG5cdFx0XHRyZXR1cm4gdGhpcy5fcHVzaChhcmcwLCBhcmcxLCBhcmcyKTtcblx0XHR9XG5cdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCk7XG5cdH1cblxuXHRwcml2YXRlIF9wdXNoKHJhbmdlOiB2c2NvZGUuUmFuZ2UsIHRva2VuVHlwZTogc3RyaW5nLCB0b2tlbk1vZGlmaWVycz86IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9oYXNMZWdlbmQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTGVnZW5kIG11c3QgYmUgcHJvdmlkZWQgaW4gY29uc3RydWN0b3InKTtcblx0XHR9XG5cdFx0aWYgKHJhbmdlLnN0YXJ0LmxpbmUgIT09IHJhbmdlLmVuZC5saW5lKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ByYW5nZWAgY2Fubm90IHNwYW4gbXVsdGlwbGUgbGluZXMnKTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl90b2tlblR5cGVTdHJUb0ludC5oYXModG9rZW5UeXBlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdgdG9rZW5UeXBlYCBpcyBub3QgaW4gdGhlIHByb3ZpZGVkIGxlZ2VuZCcpO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lID0gcmFuZ2Uuc3RhcnQubGluZTtcblx0XHRjb25zdCBjaGFyID0gcmFuZ2Uuc3RhcnQuY2hhcmFjdGVyO1xuXHRcdGNvbnN0IGxlbmd0aCA9IHJhbmdlLmVuZC5jaGFyYWN0ZXIgLSByYW5nZS5zdGFydC5jaGFyYWN0ZXI7XG5cdFx0Y29uc3QgblRva2VuVHlwZSA9IHRoaXMuX3Rva2VuVHlwZVN0clRvSW50LmdldCh0b2tlblR5cGUpITtcblx0XHRsZXQgblRva2VuTW9kaWZpZXJzID0gMDtcblx0XHRpZiAodG9rZW5Nb2RpZmllcnMpIHtcblx0XHRcdGZvciAoY29uc3QgdG9rZW5Nb2RpZmllciBvZiB0b2tlbk1vZGlmaWVycykge1xuXHRcdFx0XHRpZiAoIXRoaXMuX3Rva2VuTW9kaWZpZXJTdHJUb0ludC5oYXModG9rZW5Nb2RpZmllcikpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2B0b2tlbk1vZGlmaWVyYCBpcyBub3QgaW4gdGhlIHByb3ZpZGVkIGxlZ2VuZCcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IG5Ub2tlbk1vZGlmaWVyID0gdGhpcy5fdG9rZW5Nb2RpZmllclN0clRvSW50LmdldCh0b2tlbk1vZGlmaWVyKSE7XG5cdFx0XHRcdG5Ub2tlbk1vZGlmaWVycyB8PSAoMSA8PCBuVG9rZW5Nb2RpZmllcikgPj4+IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3B1c2hFbmNvZGVkKGxpbmUsIGNoYXIsIGxlbmd0aCwgblRva2VuVHlwZSwgblRva2VuTW9kaWZpZXJzKTtcblx0fVxuXG5cdHByaXZhdGUgX3B1c2hFbmNvZGVkKGxpbmU6IG51bWJlciwgY2hhcjogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgdG9rZW5UeXBlOiBudW1iZXIsIHRva2VuTW9kaWZpZXJzOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGF0YUlzU29ydGVkQW5kRGVsdGFFbmNvZGVkICYmIChsaW5lIDwgdGhpcy5fcHJldkxpbmUgfHwgKGxpbmUgPT09IHRoaXMuX3ByZXZMaW5lICYmIGNoYXIgPCB0aGlzLl9wcmV2Q2hhcikpKSB7XG5cdFx0XHQvLyBwdXNoIGNhbGxzIHdlcmUgb3JkZXJlZCBhbmQgYXJlIG5vIGxvbmdlciBvcmRlcmVkXG5cdFx0XHR0aGlzLl9kYXRhSXNTb3J0ZWRBbmREZWx0YUVuY29kZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly8gUmVtb3ZlIGRlbHRhIGVuY29kaW5nIGZyb20gZGF0YVxuXHRcdFx0Y29uc3QgdG9rZW5Db3VudCA9ICh0aGlzLl9kYXRhLmxlbmd0aCAvIDUpIHwgMDtcblx0XHRcdGxldCBwcmV2TGluZSA9IDA7XG5cdFx0XHRsZXQgcHJldkNoYXIgPSAwO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbkNvdW50OyBpKyspIHtcblx0XHRcdFx0bGV0IGxpbmUgPSB0aGlzLl9kYXRhWzUgKiBpXTtcblx0XHRcdFx0bGV0IGNoYXIgPSB0aGlzLl9kYXRhWzUgKiBpICsgMV07XG5cblx0XHRcdFx0aWYgKGxpbmUgPT09IDApIHtcblx0XHRcdFx0XHQvLyBvbiB0aGUgc2FtZSBsaW5lIGFzIHByZXZpb3VzIHRva2VuXG5cdFx0XHRcdFx0bGluZSA9IHByZXZMaW5lO1xuXHRcdFx0XHRcdGNoYXIgKz0gcHJldkNoYXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gb24gYSBkaWZmZXJlbnQgbGluZSB0aGFuIHByZXZpb3VzIHRva2VuXG5cdFx0XHRcdFx0bGluZSArPSBwcmV2TGluZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2RhdGFbNSAqIGldID0gbGluZTtcblx0XHRcdFx0dGhpcy5fZGF0YVs1ICogaSArIDFdID0gY2hhcjtcblxuXHRcdFx0XHRwcmV2TGluZSA9IGxpbmU7XG5cdFx0XHRcdHByZXZDaGFyID0gY2hhcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgcHVzaExpbmUgPSBsaW5lO1xuXHRcdGxldCBwdXNoQ2hhciA9IGNoYXI7XG5cdFx0aWYgKHRoaXMuX2RhdGFJc1NvcnRlZEFuZERlbHRhRW5jb2RlZCAmJiB0aGlzLl9kYXRhTGVuID4gMCkge1xuXHRcdFx0cHVzaExpbmUgLT0gdGhpcy5fcHJldkxpbmU7XG5cdFx0XHRpZiAocHVzaExpbmUgPT09IDApIHtcblx0XHRcdFx0cHVzaENoYXIgLT0gdGhpcy5fcHJldkNoYXI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGF0YVt0aGlzLl9kYXRhTGVuKytdID0gcHVzaExpbmU7XG5cdFx0dGhpcy5fZGF0YVt0aGlzLl9kYXRhTGVuKytdID0gcHVzaENoYXI7XG5cdFx0dGhpcy5fZGF0YVt0aGlzLl9kYXRhTGVuKytdID0gbGVuZ3RoO1xuXHRcdHRoaXMuX2RhdGFbdGhpcy5fZGF0YUxlbisrXSA9IHRva2VuVHlwZTtcblx0XHR0aGlzLl9kYXRhW3RoaXMuX2RhdGFMZW4rK10gPSB0b2tlbk1vZGlmaWVycztcblxuXHRcdHRoaXMuX3ByZXZMaW5lID0gbGluZTtcblx0XHR0aGlzLl9wcmV2Q2hhciA9IGNoYXI7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc29ydEFuZERlbHRhRW5jb2RlKGRhdGE6IG51bWJlcltdKTogVWludDMyQXJyYXkge1xuXHRcdGNvbnN0IHBvczogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCB0b2tlbkNvdW50ID0gKGRhdGEubGVuZ3RoIC8gNSkgfCAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5Db3VudDsgaSsrKSB7XG5cdFx0XHRwb3NbaV0gPSBpO1xuXHRcdH1cblx0XHRwb3Muc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0Y29uc3QgYUxpbmUgPSBkYXRhWzUgKiBhXTtcblx0XHRcdGNvbnN0IGJMaW5lID0gZGF0YVs1ICogYl07XG5cdFx0XHRpZiAoYUxpbmUgPT09IGJMaW5lKSB7XG5cdFx0XHRcdGNvbnN0IGFDaGFyID0gZGF0YVs1ICogYSArIDFdO1xuXHRcdFx0XHRjb25zdCBiQ2hhciA9IGRhdGFbNSAqIGIgKyAxXTtcblx0XHRcdFx0cmV0dXJuIGFDaGFyIC0gYkNoYXI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYUxpbmUgLSBiTGluZTtcblx0XHR9KTtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgVWludDMyQXJyYXkoZGF0YS5sZW5ndGgpO1xuXHRcdGxldCBwcmV2TGluZSA9IDA7XG5cdFx0bGV0IHByZXZDaGFyID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2VuQ291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3Qgc3JjT2Zmc2V0ID0gNSAqIHBvc1tpXTtcblx0XHRcdGNvbnN0IGxpbmUgPSBkYXRhW3NyY09mZnNldCArIDBdO1xuXHRcdFx0Y29uc3QgY2hhciA9IGRhdGFbc3JjT2Zmc2V0ICsgMV07XG5cdFx0XHRjb25zdCBsZW5ndGggPSBkYXRhW3NyY09mZnNldCArIDJdO1xuXHRcdFx0Y29uc3QgdG9rZW5UeXBlID0gZGF0YVtzcmNPZmZzZXQgKyAzXTtcblx0XHRcdGNvbnN0IHRva2VuTW9kaWZpZXJzID0gZGF0YVtzcmNPZmZzZXQgKyA0XTtcblxuXHRcdFx0Y29uc3QgcHVzaExpbmUgPSBsaW5lIC0gcHJldkxpbmU7XG5cdFx0XHRjb25zdCBwdXNoQ2hhciA9IChwdXNoTGluZSA9PT0gMCA/IGNoYXIgLSBwcmV2Q2hhciA6IGNoYXIpO1xuXG5cdFx0XHRjb25zdCBkc3RPZmZzZXQgPSA1ICogaTtcblx0XHRcdHJlc3VsdFtkc3RPZmZzZXQgKyAwXSA9IHB1c2hMaW5lO1xuXHRcdFx0cmVzdWx0W2RzdE9mZnNldCArIDFdID0gcHVzaENoYXI7XG5cdFx0XHRyZXN1bHRbZHN0T2Zmc2V0ICsgMl0gPSBsZW5ndGg7XG5cdFx0XHRyZXN1bHRbZHN0T2Zmc2V0ICsgM10gPSB0b2tlblR5cGU7XG5cdFx0XHRyZXN1bHRbZHN0T2Zmc2V0ICsgNF0gPSB0b2tlbk1vZGlmaWVycztcblxuXHRcdFx0cHJldkxpbmUgPSBsaW5lO1xuXHRcdFx0cHJldkNoYXIgPSBjaGFyO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgYnVpbGQocmVzdWx0SWQ/OiBzdHJpbmcpOiBTZW1hbnRpY1Rva2VucyB7XG5cdFx0aWYgKCF0aGlzLl9kYXRhSXNTb3J0ZWRBbmREZWx0YUVuY29kZWQpIHtcblx0XHRcdHJldHVybiBuZXcgU2VtYW50aWNUb2tlbnMoU2VtYW50aWNUb2tlbnNCdWlsZGVyLl9zb3J0QW5kRGVsdGFFbmNvZGUodGhpcy5fZGF0YSksIHJlc3VsdElkKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBTZW1hbnRpY1Rva2VucyhuZXcgVWludDMyQXJyYXkodGhpcy5fZGF0YSksIHJlc3VsdElkKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VtYW50aWNUb2tlbnMge1xuXHRyZWFkb25seSByZXN1bHRJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBkYXRhOiBVaW50MzJBcnJheTtcblxuXHRjb25zdHJ1Y3RvcihkYXRhOiBVaW50MzJBcnJheSwgcmVzdWx0SWQ/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnJlc3VsdElkID0gcmVzdWx0SWQ7XG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VtYW50aWNUb2tlbnNFZGl0IHtcblx0cmVhZG9ubHkgc3RhcnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZGVsZXRlQ291bnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZGF0YTogVWludDMyQXJyYXkgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Ioc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgZGF0YT86IFVpbnQzMkFycmF5KSB7XG5cdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xuXHRcdHRoaXMuZGVsZXRlQ291bnQgPSBkZWxldGVDb3VudDtcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZW1hbnRpY1Rva2Vuc0VkaXRzIHtcblx0cmVhZG9ubHkgcmVzdWx0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZWRpdHM6IFNlbWFudGljVG9rZW5zRWRpdFtdO1xuXG5cdGNvbnN0cnVjdG9yKGVkaXRzOiBTZW1hbnRpY1Rva2Vuc0VkaXRbXSwgcmVzdWx0SWQ/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnJlc3VsdElkID0gcmVzdWx0SWQ7XG5cdFx0dGhpcy5lZGl0cyA9IGVkaXRzO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gZGVidWdcbmV4cG9ydCBlbnVtIERlYnVnQ29uc29sZU1vZGUge1xuXHQvKipcblx0ICogRGVidWcgc2Vzc2lvbiBzaG91bGQgaGF2ZSBhIHNlcGFyYXRlIGRlYnVnIGNvbnNvbGUuXG5cdCAqL1xuXHRTZXBhcmF0ZSA9IDAsXG5cblx0LyoqXG5cdCAqIERlYnVnIHNlc3Npb24gc2hvdWxkIHNoYXJlIGRlYnVnIGNvbnNvbGUgd2l0aCBpdHMgcGFyZW50IHNlc3Npb24uXG5cdCAqIFRoaXMgdmFsdWUgaGFzIG5vIGVmZmVjdCBmb3Igc2Vzc2lvbnMgd2hpY2ggZG8gbm90IGhhdmUgYSBwYXJlbnQgc2Vzc2lvbi5cblx0ICovXG5cdE1lcmdlV2l0aFBhcmVudCA9IDFcbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnVmlzdWFsaXphdGlvbiB7XG5cdGljb25QYXRoPzogVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSB8IFRoZW1lSWNvbjtcblx0dmlzdWFsaXphdGlvbj86IHZzY29kZS5Db21tYW5kIHwgdnNjb2RlLlRyZWVEYXRhUHJvdmlkZXI8dW5rbm93bj47XG5cblx0Y29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZykgeyB9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5leHBvcnQgZW51bSBRdWlja0lucHV0QnV0dG9uTG9jYXRpb24ge1xuXHRUaXRsZSA9IDEsXG5cdElubGluZSA9IDJcbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgUXVpY2tJbnB1dEJ1dHRvbnMge1xuXG5cdHN0YXRpYyByZWFkb25seSBCYWNrOiB2c2NvZGUuUXVpY2tJbnB1dEJ1dHRvbiA9IHsgaWNvblBhdGg6IG5ldyBUaGVtZUljb24oJ2Fycm93LWxlZnQnKSB9O1xuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoKSB7IH1cbn1cblxuZXhwb3J0IGVudW0gUXVpY2tQaWNrSXRlbUtpbmQge1xuXHRTZXBhcmF0b3IgPSAtMSxcblx0RGVmYXVsdCA9IDAsXG59XG5cbmV4cG9ydCBlbnVtIElucHV0Qm94VmFsaWRhdGlvblNldmVyaXR5IHtcblx0SW5mbyA9IDEsXG5cdFdhcm5pbmcgPSAyLFxuXHRFcnJvciA9IDNcbn1cblxuZXhwb3J0IGVudW0gRXh0ZW5zaW9uS2luZCB7XG5cdFVJID0gMSxcblx0V29ya3NwYWNlID0gMlxufVxuXG5leHBvcnQgY2xhc3MgRmlsZURlY29yYXRpb24ge1xuXG5cdHN0YXRpYyB2YWxpZGF0ZShkOiBGaWxlRGVjb3JhdGlvbik6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgZC5iYWRnZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGxldCBsZW4gPSBuZXh0Q2hhckxlbmd0aChkLmJhZGdlLCAwKTtcblx0XHRcdGlmIChsZW4gPCBkLmJhZGdlLmxlbmd0aCkge1xuXHRcdFx0XHRsZW4gKz0gbmV4dENoYXJMZW5ndGgoZC5iYWRnZSwgbGVuKTtcblx0XHRcdH1cblx0XHRcdGlmIChkLmJhZGdlLmxlbmd0aCA+IGxlbikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRoZSAnYmFkZ2UnLXByb3BlcnR5IG11c3QgYmUgdW5kZWZpbmVkIG9yIGEgc2hvcnQgY2hhcmFjdGVyYCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChkLmJhZGdlKSB7XG5cdFx0XHRpZiAoIVRoZW1lSWNvbi5pc1RoZW1lSWNvbihkLmJhZGdlKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRoZSAnYmFkZ2UnLXByb3BlcnR5IGlzIG5vdCBhIHZhbGlkIFRoZW1lSWNvbmApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIWQuY29sb3IgJiYgIWQuYmFkZ2UgJiYgIWQudG9vbHRpcCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUaGUgZGVjb3JhdGlvbiBpcyBlbXB0eWApO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGJhZGdlPzogc3RyaW5nIHwgdnNjb2RlLlRoZW1lSWNvbjtcblx0dG9vbHRpcD86IHN0cmluZztcblx0Y29sb3I/OiB2c2NvZGUuVGhlbWVDb2xvcjtcblx0cHJvcGFnYXRlPzogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3RvcihiYWRnZT86IHN0cmluZyB8IFRoZW1lSWNvbiwgdG9vbHRpcD86IHN0cmluZywgY29sb3I/OiBUaGVtZUNvbG9yKSB7XG5cdFx0dGhpcy5iYWRnZSA9IGJhZGdlO1xuXHRcdHRoaXMudG9vbHRpcCA9IHRvb2x0aXA7XG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiBUaGVtaW5nXG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIENvbG9yVGhlbWUgaW1wbGVtZW50cyB2c2NvZGUuQ29sb3JUaGVtZSB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBraW5kOiBDb2xvclRoZW1lS2luZCkge1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIENvbG9yVGhlbWVLaW5kIHtcblx0TGlnaHQgPSAxLFxuXHREYXJrID0gMixcblx0SGlnaENvbnRyYXN0ID0gMyxcblx0SGlnaENvbnRyYXN0TGlnaHQgPSA0XG59XG5cbi8vI2VuZHJlZ2lvbiBUaGVtaW5nXG5cbi8vI3JlZ2lvbiBOb3RlYm9va1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tSYW5nZSB7XG5cdHN0YXRpYyBpc05vdGVib29rUmFuZ2UodGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5Ob3RlYm9va1JhbmdlIHtcblx0XHRpZiAodGhpbmcgaW5zdGFuY2VvZiBOb3RlYm9va1JhbmdlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCF0aGluZykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHlwZW9mICg8Tm90ZWJvb2tSYW5nZT50aGluZykuc3RhcnQgPT09ICdudW1iZXInXG5cdFx0XHQmJiB0eXBlb2YgKDxOb3RlYm9va1JhbmdlPnRoaW5nKS5lbmQgPT09ICdudW1iZXInO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhcnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfZW5kOiBudW1iZXI7XG5cblx0Z2V0IHN0YXJ0KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGFydDtcblx0fVxuXG5cdGdldCBlbmQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VuZDtcblx0fVxuXG5cdGdldCBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zdGFydCA9PT0gdGhpcy5fZW5kO1xuXHR9XG5cblx0Y29uc3RydWN0b3Ioc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpIHtcblx0XHRpZiAoc3RhcnQgPCAwKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ3N0YXJ0IG11c3QgYmUgcG9zaXRpdmUnKTtcblx0XHR9XG5cdFx0aWYgKGVuZCA8IDApIHtcblx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnZW5kIG11c3QgYmUgcG9zaXRpdmUnKTtcblx0XHR9XG5cdFx0aWYgKHN0YXJ0IDw9IGVuZCkge1xuXHRcdFx0dGhpcy5fc3RhcnQgPSBzdGFydDtcblx0XHRcdHRoaXMuX2VuZCA9IGVuZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3RhcnQgPSBlbmQ7XG5cdFx0XHR0aGlzLl9lbmQgPSBzdGFydDtcblx0XHR9XG5cdH1cblxuXHR3aXRoKGNoYW5nZTogeyBzdGFydD86IG51bWJlcjsgZW5kPzogbnVtYmVyIH0pOiBOb3RlYm9va1JhbmdlIHtcblx0XHRsZXQgc3RhcnQgPSB0aGlzLl9zdGFydDtcblx0XHRsZXQgZW5kID0gdGhpcy5fZW5kO1xuXG5cdFx0aWYgKGNoYW5nZS5zdGFydCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRzdGFydCA9IGNoYW5nZS5zdGFydDtcblx0XHR9XG5cdFx0aWYgKGNoYW5nZS5lbmQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0ZW5kID0gY2hhbmdlLmVuZDtcblx0XHR9XG5cdFx0aWYgKHN0YXJ0ID09PSB0aGlzLl9zdGFydCAmJiBlbmQgPT09IHRoaXMuX2VuZCkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgTm90ZWJvb2tSYW5nZShzdGFydCwgZW5kKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDZWxsRGF0YSB7XG5cblx0c3RhdGljIHZhbGlkYXRlKGRhdGE6IE5vdGVib29rQ2VsbERhdGEpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIGRhdGEua2luZCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm90ZWJvb2tDZWxsRGF0YSBNVVNUIGhhdmUgXFwna2luZFxcJyBwcm9wZXJ0eScpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGRhdGEudmFsdWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdGVib29rQ2VsbERhdGEgTVVTVCBoYXZlIFxcJ3ZhbHVlXFwnIHByb3BlcnR5Jyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZGF0YS5sYW5ndWFnZUlkICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3RlYm9va0NlbGxEYXRhIE1VU1QgaGF2ZSBcXCdsYW5ndWFnZUlkXFwnIHByb3BlcnR5Jyk7XG5cdFx0fVxuXHR9XG5cblx0c3RhdGljIGlzTm90ZWJvb2tDZWxsRGF0YUFycmF5KHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgdnNjb2RlLk5vdGVib29rQ2VsbERhdGFbXSB7XG5cdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpICYmICg8dW5rbm93bltdPnZhbHVlKS5ldmVyeShlbGVtID0+IE5vdGVib29rQ2VsbERhdGEuaXNOb3RlYm9va0NlbGxEYXRhKGVsZW0pKTtcblx0fVxuXG5cdHN0YXRpYyBpc05vdGVib29rQ2VsbERhdGEodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyB2c2NvZGUuTm90ZWJvb2tDZWxsRGF0YSB7XG5cdFx0Ly8gcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgTm90ZWJvb2tDZWxsRGF0YTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGtpbmQ6IE5vdGVib29rQ2VsbEtpbmQ7XG5cdHZhbHVlOiBzdHJpbmc7XG5cdGxhbmd1YWdlSWQ6IHN0cmluZztcblx0bWltZT86IHN0cmluZztcblx0b3V0cHV0cz86IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXRbXTtcblx0bWV0YWRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuXHRleGVjdXRpb25TdW1tYXJ5PzogdnNjb2RlLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN1bW1hcnk7XG5cblx0Y29uc3RydWN0b3Ioa2luZDogTm90ZWJvb2tDZWxsS2luZCwgdmFsdWU6IHN0cmluZywgbGFuZ3VhZ2VJZDogc3RyaW5nLCBtaW1lPzogc3RyaW5nLCBvdXRwdXRzPzogdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dFtdLCBtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIGFueT4sIGV4ZWN1dGlvblN1bW1hcnk/OiB2c2NvZGUuTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3VtbWFyeSkge1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMubGFuZ3VhZ2VJZCA9IGxhbmd1YWdlSWQ7XG5cdFx0dGhpcy5taW1lID0gbWltZTtcblx0XHR0aGlzLm91dHB1dHMgPSBvdXRwdXRzID8/IFtdO1xuXHRcdHRoaXMubWV0YWRhdGEgPSBtZXRhZGF0YTtcblx0XHR0aGlzLmV4ZWN1dGlvblN1bW1hcnkgPSBleGVjdXRpb25TdW1tYXJ5O1xuXG5cdFx0Tm90ZWJvb2tDZWxsRGF0YS52YWxpZGF0ZSh0aGlzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tEYXRhIHtcblxuXHRjZWxsczogTm90ZWJvb2tDZWxsRGF0YVtdO1xuXHRtZXRhZGF0YT86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG5cblx0Y29uc3RydWN0b3IoY2VsbHM6IE5vdGVib29rQ2VsbERhdGFbXSkge1xuXHRcdHRoaXMuY2VsbHMgPSBjZWxscztcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0NlbGxPdXRwdXRJdGVtIHtcblxuXHRzdGF0aWMgaXNOb3RlYm9va0NlbGxPdXRwdXRJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSB7XG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIE5vdGVib29rQ2VsbE91dHB1dEl0ZW0pIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIW9iaikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHlwZW9mICg8dnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dEl0ZW0+b2JqKS5taW1lID09PSAnc3RyaW5nJ1xuXHRcdFx0JiYgKDx2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbT5vYmopLmRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5O1xuXHR9XG5cblx0c3RhdGljIGVycm9yKGVycjogRXJyb3IgfCB7IG5hbWU6IHN0cmluZzsgbWVzc2FnZT86IHN0cmluZzsgc3RhY2s/OiBzdHJpbmcgfSk6IE5vdGVib29rQ2VsbE91dHB1dEl0ZW0ge1xuXHRcdGNvbnN0IG9iaiA9IHtcblx0XHRcdG5hbWU6IGVyci5uYW1lLFxuXHRcdFx0bWVzc2FnZTogZXJyLm1lc3NhZ2UsXG5cdFx0XHRzdGFjazogZXJyLnN0YWNrXG5cdFx0fTtcblx0XHRyZXR1cm4gTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS5qc29uKG9iaiwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLmVycm9yJyk7XG5cdH1cblxuXHRzdGF0aWMgc3Rkb3V0KHZhbHVlOiBzdHJpbmcpOiBOb3RlYm9va0NlbGxPdXRwdXRJdGVtIHtcblx0XHRyZXR1cm4gTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS50ZXh0KHZhbHVlLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0Jyk7XG5cdH1cblxuXHRzdGF0aWMgc3RkZXJyKHZhbHVlOiBzdHJpbmcpOiBOb3RlYm9va0NlbGxPdXRwdXRJdGVtIHtcblx0XHRyZXR1cm4gTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS50ZXh0KHZhbHVlLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3RkZXJyJyk7XG5cdH1cblxuXHRzdGF0aWMgYnl0ZXModmFsdWU6IFVpbnQ4QXJyYXksIG1pbWU6IHN0cmluZyA9ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKTogTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSB7XG5cdFx0cmV0dXJuIG5ldyBOb3RlYm9va0NlbGxPdXRwdXRJdGVtKHZhbHVlLCBtaW1lKTtcblx0fVxuXG5cdHN0YXRpYyAjZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXG5cdHN0YXRpYyB0ZXh0KHZhbHVlOiBzdHJpbmcsIG1pbWU6IHN0cmluZyA9IE1pbWVzLnRleHQpOiBOb3RlYm9va0NlbGxPdXRwdXRJdGVtIHtcblx0XHRjb25zdCBieXRlcyA9IE5vdGVib29rQ2VsbE91dHB1dEl0ZW0uI2VuY29kZXIuZW5jb2RlKFN0cmluZyh2YWx1ZSkpO1xuXHRcdHJldHVybiBuZXcgTm90ZWJvb2tDZWxsT3V0cHV0SXRlbShieXRlcywgbWltZSk7XG5cdH1cblxuXHRzdGF0aWMganNvbih2YWx1ZTogYW55LCBtaW1lOiBzdHJpbmcgPSAndGV4dC94LWpzb24nKTogTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSB7XG5cdFx0Y29uc3QgcmF3U3RyID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIHVuZGVmaW5lZCwgJ1xcdCcpO1xuXHRcdHJldHVybiBOb3RlYm9va0NlbGxPdXRwdXRJdGVtLnRleHQocmF3U3RyLCBtaW1lKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBkYXRhOiBVaW50OEFycmF5LFxuXHRcdHB1YmxpYyBtaW1lOiBzdHJpbmcsXG5cdCkge1xuXHRcdGNvbnN0IG1pbWVOb3JtYWxpemVkID0gbm9ybWFsaXplTWltZVR5cGUobWltZSwgdHJ1ZSk7XG5cdFx0aWYgKCFtaW1lTm9ybWFsaXplZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJTlZBTElEIG1pbWUgdHlwZTogJHttaW1lfS4gTXVzdCBiZSBpbiB0aGUgZm9ybWF0IFwidHlwZS9zdWJ0eXBlWztvcHRpb25hbHBhcmFtZXRlcl1cImApO1xuXHRcdH1cblx0XHR0aGlzLm1pbWUgPSBtaW1lTm9ybWFsaXplZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDZWxsT3V0cHV0IHtcblxuXHRzdGF0aWMgaXNOb3RlYm9va0NlbGxPdXRwdXQoY2FuZGlkYXRlOiBhbnkpOiBjYW5kaWRhdGUgaXMgdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dCB7XG5cdFx0aWYgKGNhbmRpZGF0ZSBpbnN0YW5jZW9mIE5vdGVib29rQ2VsbE91dHB1dCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghY2FuZGlkYXRlIHx8IHR5cGVvZiBjYW5kaWRhdGUgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlb2YgKDxOb3RlYm9va0NlbGxPdXRwdXQ+Y2FuZGlkYXRlKS5pZCA9PT0gJ3N0cmluZycgJiYgQXJyYXkuaXNBcnJheSgoPE5vdGVib29rQ2VsbE91dHB1dD5jYW5kaWRhdGUpLml0ZW1zKTtcblx0fVxuXG5cdHN0YXRpYyBlbnN1cmVVbmlxdWVNaW1lVHlwZXMoaXRlbXM6IE5vdGVib29rQ2VsbE91dHB1dEl0ZW1bXSwgd2FybjogYm9vbGVhbiA9IGZhbHNlKTogTm90ZWJvb2tDZWxsT3V0cHV0SXRlbVtdIHtcblx0XHRjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgcmVtb3ZlSWR4ID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zW2ldO1xuXHRcdFx0Y29uc3Qgbm9ybWFsTWltZSA9IG5vcm1hbGl6ZU1pbWVUeXBlKGl0ZW0ubWltZSk7XG5cdFx0XHQvLyBXZSBjYW4gaGF2ZSBtdWx0aXBsZSB0ZXh0IHN0cmVhbSBtaW1lIHR5cGVzIGluIHRoZSBzYW1lIG91dHB1dC5cblx0XHRcdGlmICghc2Vlbi5oYXMobm9ybWFsTWltZSkgfHwgaXNUZXh0U3RyZWFtTWltZShub3JtYWxNaW1lKSkge1xuXHRcdFx0XHRzZWVuLmFkZChub3JtYWxNaW1lKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHQvLyBkdXBsaWNhdGVkIG1pbWUgdHlwZXMuLi4gZmlyc3QgaGFzIHdvblxuXHRcdFx0cmVtb3ZlSWR4LmFkZChpKTtcblx0XHRcdGlmICh3YXJuKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgRFVQTElDQVRFRCBtaW1lIHR5cGUgJyR7aXRlbS5taW1lfScgd2lsbCBiZSBkcm9wcGVkYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZW1vdmVJZHguc2l6ZSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGl0ZW1zO1xuXHRcdH1cblx0XHRyZXR1cm4gaXRlbXMuZmlsdGVyKChfaXRlbSwgaW5kZXgpID0+ICFyZW1vdmVJZHguaGFzKGluZGV4KSk7XG5cdH1cblxuXHRpZDogc3RyaW5nO1xuXHRpdGVtczogTm90ZWJvb2tDZWxsT3V0cHV0SXRlbVtdO1xuXHRtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIGFueT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aXRlbXM6IE5vdGVib29rQ2VsbE91dHB1dEl0ZW1bXSxcblx0XHRpZE9yTWV0YWRhdGE/OiBzdHJpbmcgfCBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuXHRcdG1ldGFkYXRhPzogUmVjb3JkPHN0cmluZywgYW55PlxuXHQpIHtcblx0XHR0aGlzLml0ZW1zID0gTm90ZWJvb2tDZWxsT3V0cHV0LmVuc3VyZVVuaXF1ZU1pbWVUeXBlcyhpdGVtcywgdHJ1ZSk7XG5cdFx0aWYgKHR5cGVvZiBpZE9yTWV0YWRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLmlkID0gaWRPck1ldGFkYXRhO1xuXHRcdFx0dGhpcy5tZXRhZGF0YSA9IG1ldGFkYXRhO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0XHR0aGlzLm1ldGFkYXRhID0gaWRPck1ldGFkYXRhID8/IG1ldGFkYXRhO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2VsbEVycm9yU3RhY2tGcmFtZSB7XG5cdC8qKlxuXHQgKiBAcGFyYW0gbGFiZWwgVGhlIG5hbWUgb2YgdGhlIHN0YWNrIGZyYW1lXG5cdCAqIEBwYXJhbSBmaWxlIFRoZSBmaWxlIFVSSSBvZiB0aGUgc3RhY2sgZnJhbWVcblx0ICogQHBhcmFtIHBvc2l0aW9uIFRoZSBwb3NpdGlvbiBvZiB0aGUgc3RhY2sgZnJhbWUgd2l0aGluIHRoZSBmaWxlXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgbGFiZWw6IHN0cmluZyxcblx0XHRwdWJsaWMgdXJpPzogdnNjb2RlLlVyaSxcblx0XHRwdWJsaWMgcG9zaXRpb24/OiBQb3NpdGlvbixcblx0KSB7IH1cbn1cblxuZXhwb3J0IGVudW0gTm90ZWJvb2tDZWxsS2luZCB7XG5cdE1hcmt1cCA9IDEsXG5cdENvZGUgPSAyXG59XG5cbmV4cG9ydCBlbnVtIE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIHtcblx0SWRsZSA9IDEsXG5cdFBlbmRpbmcgPSAyLFxuXHRFeGVjdXRpbmcgPSAzLFxufVxuXG5leHBvcnQgZW51bSBOb3RlYm9va0NlbGxTdGF0dXNCYXJBbGlnbm1lbnQge1xuXHRMZWZ0ID0gMSxcblx0UmlnaHQgPSAyXG59XG5cbmV4cG9ydCBlbnVtIE5vdGVib29rRWRpdG9yUmV2ZWFsVHlwZSB7XG5cdERlZmF1bHQgPSAwLFxuXHRJbkNlbnRlciA9IDEsXG5cdEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQgPSAyLFxuXHRBdFRvcCA9IDNcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW0ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgdGV4dDogc3RyaW5nLFxuXHRcdHB1YmxpYyBhbGlnbm1lbnQ6IE5vdGVib29rQ2VsbFN0YXR1c0JhckFsaWdubWVudCkgeyB9XG59XG5cblxuZXhwb3J0IGVudW0gTm90ZWJvb2tDb250cm9sbGVyQWZmaW5pdHkge1xuXHREZWZhdWx0ID0gMSxcblx0UHJlZmVycmVkID0gMlxufVxuXG5leHBvcnQgZW51bSBOb3RlYm9va0NvbnRyb2xsZXJBZmZpbml0eTIge1xuXHREZWZhdWx0ID0gMSxcblx0UHJlZmVycmVkID0gMixcblx0SGlkZGVuID0gLTFcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rUmVuZGVyZXJTY3JpcHQge1xuXG5cdHB1YmxpYyBwcm92aWRlczogcmVhZG9ubHkgc3RyaW5nW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHVyaTogdnNjb2RlLlVyaSxcblx0XHRwcm92aWRlczogc3RyaW5nIHwgcmVhZG9ubHkgc3RyaW5nW10gPSBbXVxuXHQpIHtcblx0XHR0aGlzLnByb3ZpZGVzID0gYXNBcnJheShwcm92aWRlcyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rS2VybmVsU291cmNlQWN0aW9uIHtcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGRldGFpbD86IHN0cmluZztcblx0Y29tbWFuZD86IHZzY29kZS5Db21tYW5kO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgbGFiZWw6IHN0cmluZ1xuXHQpIHsgfVxufVxuXG5leHBvcnQgZW51bSBOb3RlYm9va1ZhcmlhYmxlc1JlcXVlc3RLaW5kIHtcblx0TmFtZWQgPSAxLFxuXHRJbmRleGVkID0gMlxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFRpbWVsaW5lXG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFRpbWVsaW5lSXRlbSBpbXBsZW1lbnRzIHZzY29kZS5UaW1lbGluZUl0ZW0ge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgbGFiZWw6IHN0cmluZywgcHVibGljIHRpbWVzdGFtcDogbnVtYmVyKSB7IH1cbn1cblxuLy8jZW5kcmVnaW9uIFRpbWVsaW5lXG5cbi8vI3JlZ2lvbiBFeHRlbnNpb25Db250ZXh0XG5cbmV4cG9ydCBlbnVtIEV4dGVuc2lvbk1vZGUge1xuXHQvKipcblx0ICogVGhlIGV4dGVuc2lvbiBpcyBpbnN0YWxsZWQgbm9ybWFsbHkgKGZvciBleGFtcGxlLCBmcm9tIHRoZSBtYXJrZXRwbGFjZVxuXHQgKiBvciBWU0lYKSBpbiBWUyBDb2RlLlxuXHQgKi9cblx0UHJvZHVjdGlvbiA9IDEsXG5cblx0LyoqXG5cdCAqIFRoZSBleHRlbnNpb24gaXMgcnVubmluZyBmcm9tIGFuIGAtLWV4dGVuc2lvbkRldmVsb3BtZW50UGF0aGAgcHJvdmlkZWRcblx0ICogd2hlbiBsYXVuY2hpbmcgVlMgQ29kZS5cblx0ICovXG5cdERldmVsb3BtZW50ID0gMixcblxuXHQvKipcblx0ICogVGhlIGV4dGVuc2lvbiBpcyBydW5uaW5nIGZyb20gYW4gYC0tZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoYCBhbmRcblx0ICogdGhlIGV4dGVuc2lvbiBob3N0IGlzIHJ1bm5pbmcgdW5pdCB0ZXN0cy5cblx0ICovXG5cdFRlc3QgPSAzLFxufVxuXG5leHBvcnQgZW51bSBFeHRlbnNpb25SdW50aW1lIHtcblx0LyoqXG5cdCAqIFRoZSBleHRlbnNpb24gaXMgcnVubmluZyBpbiBhIE5vZGVKUyBleHRlbnNpb24gaG9zdC4gUnVudGltZSBhY2Nlc3MgdG8gTm9kZUpTIEFQSXMgaXMgYXZhaWxhYmxlLlxuXHQgKi9cblx0Tm9kZSA9IDEsXG5cdC8qKlxuXHQgKiBUaGUgZXh0ZW5zaW9uIGlzIHJ1bm5pbmcgaW4gYSBXZWJ3b3JrZXIgZXh0ZW5zaW9uIGhvc3QuIFJ1bnRpbWUgYWNjZXNzIGlzIGxpbWl0ZWQgdG8gV2Vid29ya2VyIEFQSXMuXG5cdCAqL1xuXHRXZWJ3b3JrZXIgPSAyXG59XG5cbi8vI2VuZHJlZ2lvbiBFeHRlbnNpb25Db250ZXh0XG5cbmV4cG9ydCBlbnVtIFN0YW5kYXJkVG9rZW5UeXBlIHtcblx0T3RoZXIgPSAwLFxuXHRDb21tZW50ID0gMSxcblx0U3RyaW5nID0gMixcblx0UmVnRXggPSAzXG59XG5cblxuZXhwb3J0IGNsYXNzIExpbmtlZEVkaXRpbmdSYW5nZXMge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcmFuZ2VzOiBSYW5nZVtdLCBwdWJsaWMgcmVhZG9ubHkgd29yZFBhdHRlcm4/OiBSZWdFeHApIHtcblx0fVxufVxuXG4vLyNyZWdpb24gcG9ydHNcbmV4cG9ydCBjbGFzcyBQb3J0QXR0cmlidXRlcyB7XG5cdHByaXZhdGUgX2F1dG9Gb3J3YXJkQWN0aW9uOiBQb3J0QXV0b0ZvcndhcmRBY3Rpb247XG5cblx0Y29uc3RydWN0b3IoYXV0b0ZvcndhcmRBY3Rpb246IFBvcnRBdXRvRm9yd2FyZEFjdGlvbikge1xuXHRcdHRoaXMuX2F1dG9Gb3J3YXJkQWN0aW9uID0gYXV0b0ZvcndhcmRBY3Rpb247XG5cdH1cblxuXHRnZXQgYXV0b0ZvcndhcmRBY3Rpb24oKTogUG9ydEF1dG9Gb3J3YXJkQWN0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fYXV0b0ZvcndhcmRBY3Rpb247XG5cdH1cbn1cbi8vI2VuZHJlZ2lvbiBwb3J0c1xuXG4vLyNyZWdpb24gVGVzdGluZ1xuZXhwb3J0IGVudW0gVGVzdFJlc3VsdFN0YXRlIHtcblx0UXVldWVkID0gMSxcblx0UnVubmluZyA9IDIsXG5cdFBhc3NlZCA9IDMsXG5cdEZhaWxlZCA9IDQsXG5cdFNraXBwZWQgPSA1LFxuXHRFcnJvcmVkID0gNlxufVxuXG5leHBvcnQgZW51bSBUZXN0UnVuUHJvZmlsZUtpbmQge1xuXHRSdW4gPSAxLFxuXHREZWJ1ZyA9IDIsXG5cdENvdmVyYWdlID0gMyxcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RSdW5Qcm9maWxlQmFzZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250cm9sbGVySWQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcHJvZmlsZUlkOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IGtpbmQ6IHZzY29kZS5UZXN0UnVuUHJvZmlsZUtpbmQsXG5cdCkgeyB9XG59XG5cbkBlczVDbGFzc0NvbXBhdFxuZXhwb3J0IGNsYXNzIFRlc3RSdW5SZXF1ZXN0IGltcGxlbWVudHMgdnNjb2RlLlRlc3RSdW5SZXF1ZXN0IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGluY2x1ZGU6IHZzY29kZS5UZXN0SXRlbVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBleGNsdWRlOiB2c2NvZGUuVGVzdEl0ZW1bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcHJvZmlsZTogdnNjb2RlLlRlc3RSdW5Qcm9maWxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb250aW51b3VzID0gZmFsc2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IHByZXNlcnZlRm9jdXMgPSB0cnVlLFxuXHQpIHsgfVxufVxuXG5AZXM1Q2xhc3NDb21wYXRcbmV4cG9ydCBjbGFzcyBUZXN0TWVzc2FnZSBpbXBsZW1lbnRzIHZzY29kZS5UZXN0TWVzc2FnZSB7XG5cdHB1YmxpYyBleHBlY3RlZE91dHB1dD86IHN0cmluZztcblx0cHVibGljIGFjdHVhbE91dHB1dD86IHN0cmluZztcblx0cHVibGljIGxvY2F0aW9uPzogdnNjb2RlLkxvY2F0aW9uO1xuXHRwdWJsaWMgY29udGV4dFZhbHVlPzogc3RyaW5nO1xuXG5cdC8qKiBwcm9wb3NlZDogKi9cblx0cHVibGljIHN0YWNrVHJhY2U/OiBUZXN0TWVzc2FnZVN0YWNrRnJhbWVbXTtcblxuXHRwdWJsaWMgc3RhdGljIGRpZmYobWVzc2FnZTogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nLCBleHBlY3RlZDogc3RyaW5nLCBhY3R1YWw6IHN0cmluZykge1xuXHRcdGNvbnN0IG1zZyA9IG5ldyBUZXN0TWVzc2FnZShtZXNzYWdlKTtcblx0XHRtc2cuZXhwZWN0ZWRPdXRwdXQgPSBleHBlY3RlZDtcblx0XHRtc2cuYWN0dWFsT3V0cHV0ID0gYWN0dWFsO1xuXHRcdHJldHVybiBtc2c7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgbWVzc2FnZTogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nKSB7IH1cbn1cblxuQGVzNUNsYXNzQ29tcGF0XG5leHBvcnQgY2xhc3MgVGVzdFRhZyBpbXBsZW1lbnRzIHZzY29kZS5UZXN0VGFnIHtcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmcpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdE1lc3NhZ2VTdGFja0ZyYW1lIHtcblx0LyoqXG5cdCAqIEBwYXJhbSBsYWJlbCBUaGUgbmFtZSBvZiB0aGUgc3RhY2sgZnJhbWVcblx0ICogQHBhcmFtIGZpbGUgVGhlIGZpbGUgVVJJIG9mIHRoZSBzdGFjayBmcmFtZVxuXHQgKiBAcGFyYW0gcG9zaXRpb24gVGhlIHBvc2l0aW9uIG9mIHRoZSBzdGFjayBmcmFtZSB3aXRoaW4gdGhlIGZpbGVcblx0ICovXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBsYWJlbDogc3RyaW5nLFxuXHRcdHB1YmxpYyB1cmk/OiB2c2NvZGUuVXJpLFxuXHRcdHB1YmxpYyBwb3NpdGlvbj86IFBvc2l0aW9uLFxuXHQpIHsgfVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFRlc3QgQ292ZXJhZ2VcbmV4cG9ydCBjbGFzcyBUZXN0Q292ZXJhZ2VDb3VudCBpbXBsZW1lbnRzIHZzY29kZS5UZXN0Q292ZXJhZ2VDb3VudCB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBjb3ZlcmVkOiBudW1iZXIsIHB1YmxpYyB0b3RhbDogbnVtYmVyKSB7XG5cdFx0dmFsaWRhdGVUZXN0Q292ZXJhZ2VDb3VudCh0aGlzKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUZXN0Q292ZXJhZ2VDb3VudChjYz86IHZzY29kZS5UZXN0Q292ZXJhZ2VDb3VudCkge1xuXHRpZiAoIWNjKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGNjLmNvdmVyZWQgPiBjYy50b3RhbCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgVGhlIHRvdGFsIG51bWJlciBvZiBjb3ZlcmVkIGl0ZW1zICgke2NjLmNvdmVyZWR9KSBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIHRoZSB0b3RhbCAoJHtjYy50b3RhbH0pYCk7XG5cdH1cblxuXHRpZiAoY2MudG90YWwgPCAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBUaGUgbnVtYmVyIG9mIGNvdmVyZWQgaXRlbXMgKCR7Y2MudG90YWx9KSBjYW5ub3QgYmUgbmVnYXRpdmVgKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZUNvdmVyYWdlIGltcGxlbWVudHMgdnNjb2RlLkZpbGVDb3ZlcmFnZSB7XG5cdHB1YmxpYyBzdGF0aWMgZnJvbURldGFpbHModXJpOiB2c2NvZGUuVXJpLCBkZXRhaWxzOiB2c2NvZGUuRmlsZUNvdmVyYWdlRGV0YWlsW10pOiB2c2NvZGUuRmlsZUNvdmVyYWdlIHtcblx0XHRjb25zdCBzdGF0ZW1lbnRzID0gbmV3IFRlc3RDb3ZlcmFnZUNvdW50KDAsIDApO1xuXHRcdGNvbnN0IGJyYW5jaGVzID0gbmV3IFRlc3RDb3ZlcmFnZUNvdW50KDAsIDApO1xuXHRcdGNvbnN0IGRlY2wgPSBuZXcgVGVzdENvdmVyYWdlQ291bnQoMCwgMCk7XG5cblx0XHRmb3IgKGNvbnN0IGRldGFpbCBvZiBkZXRhaWxzKSB7XG5cdFx0XHRpZiAoJ2JyYW5jaGVzJyBpbiBkZXRhaWwpIHtcblx0XHRcdFx0c3RhdGVtZW50cy50b3RhbCArPSAxO1xuXHRcdFx0XHRzdGF0ZW1lbnRzLmNvdmVyZWQgKz0gZGV0YWlsLmV4ZWN1dGVkID8gMSA6IDA7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBicmFuY2ggb2YgZGV0YWlsLmJyYW5jaGVzKSB7XG5cdFx0XHRcdFx0YnJhbmNoZXMudG90YWwgKz0gMTtcblx0XHRcdFx0XHRicmFuY2hlcy5jb3ZlcmVkICs9IGJyYW5jaC5leGVjdXRlZCA/IDEgOiAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZWNsLnRvdGFsICs9IDE7XG5cdFx0XHRcdGRlY2wuY292ZXJlZCArPSBkZXRhaWwuZXhlY3V0ZWQgPyAxIDogMDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb3ZlcmFnZSA9IG5ldyBGaWxlQ292ZXJhZ2UoXG5cdFx0XHR1cmksXG5cdFx0XHRzdGF0ZW1lbnRzLFxuXHRcdFx0YnJhbmNoZXMudG90YWwgPiAwID8gYnJhbmNoZXMgOiB1bmRlZmluZWQsXG5cdFx0XHRkZWNsLnRvdGFsID4gMCA/IGRlY2wgOiB1bmRlZmluZWQsXG5cdFx0KTtcblxuXHRcdGNvdmVyYWdlLmRldGFpbGVkQ292ZXJhZ2UgPSBkZXRhaWxzO1xuXG5cdFx0cmV0dXJuIGNvdmVyYWdlO1xuXHR9XG5cblx0ZGV0YWlsZWRDb3ZlcmFnZT86IHZzY29kZS5GaWxlQ292ZXJhZ2VEZXRhaWxbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdXJpOiB2c2NvZGUuVXJpLFxuXHRcdHB1YmxpYyBzdGF0ZW1lbnRDb3ZlcmFnZTogdnNjb2RlLlRlc3RDb3ZlcmFnZUNvdW50LFxuXHRcdHB1YmxpYyBicmFuY2hDb3ZlcmFnZT86IHZzY29kZS5UZXN0Q292ZXJhZ2VDb3VudCxcblx0XHRwdWJsaWMgZGVjbGFyYXRpb25Db3ZlcmFnZT86IHZzY29kZS5UZXN0Q292ZXJhZ2VDb3VudCxcblx0XHRwdWJsaWMgaW5jbHVkZXNUZXN0czogdnNjb2RlLlRlc3RJdGVtW10gPSBbXSxcblx0KSB7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRlbWVudENvdmVyYWdlIGltcGxlbWVudHMgdnNjb2RlLlN0YXRlbWVudENvdmVyYWdlIHtcblx0Ly8gYmFjayBjb21wYXQgdW50aWwgZmluYWxpemF0aW9uOlxuXHRnZXQgZXhlY3V0aW9uQ291bnQoKSB7IHJldHVybiArdGhpcy5leGVjdXRlZDsgfVxuXHRzZXQgZXhlY3V0aW9uQ291bnQobjogbnVtYmVyKSB7IHRoaXMuZXhlY3V0ZWQgPSBuOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIGV4ZWN1dGVkOiBudW1iZXIgfCBib29sZWFuLFxuXHRcdHB1YmxpYyBsb2NhdGlvbjogUG9zaXRpb24gfCBSYW5nZSxcblx0XHRwdWJsaWMgYnJhbmNoZXM6IHZzY29kZS5CcmFuY2hDb3ZlcmFnZVtdID0gW10sXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBCcmFuY2hDb3ZlcmFnZSBpbXBsZW1lbnRzIHZzY29kZS5CcmFuY2hDb3ZlcmFnZSB7XG5cdC8vIGJhY2sgY29tcGF0IHVudGlsIGZpbmFsaXphdGlvbjpcblx0Z2V0IGV4ZWN1dGlvbkNvdW50KCkgeyByZXR1cm4gK3RoaXMuZXhlY3V0ZWQ7IH1cblx0c2V0IGV4ZWN1dGlvbkNvdW50KG46IG51bWJlcikgeyB0aGlzLmV4ZWN1dGVkID0gbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBleGVjdXRlZDogbnVtYmVyIHwgYm9vbGVhbixcblx0XHRwdWJsaWMgbG9jYXRpb246IFBvc2l0aW9uIHwgUmFuZ2UsXG5cdFx0cHVibGljIGxhYmVsPzogc3RyaW5nLFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVjbGFyYXRpb25Db3ZlcmFnZSBpbXBsZW1lbnRzIHZzY29kZS5EZWNsYXJhdGlvbkNvdmVyYWdlIHtcblx0Ly8gYmFjayBjb21wYXQgdW50aWwgZmluYWxpemF0aW9uOlxuXHRnZXQgZXhlY3V0aW9uQ291bnQoKSB7IHJldHVybiArdGhpcy5leGVjdXRlZDsgfVxuXHRzZXQgZXhlY3V0aW9uQ291bnQobjogbnVtYmVyKSB7IHRoaXMuZXhlY3V0ZWQgPSBuOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRwdWJsaWMgZXhlY3V0ZWQ6IG51bWJlciB8IGJvb2xlYW4sXG5cdFx0cHVibGljIGxvY2F0aW9uOiBQb3NpdGlvbiB8IFJhbmdlLFxuXHQpIHsgfVxufVxuLy8jZW5kcmVnaW9uXG5cbmV4cG9ydCBlbnVtIEV4dGVybmFsVXJpT3BlbmVyUHJpb3JpdHkge1xuXHROb25lID0gMCxcblx0T3B0aW9uID0gMSxcblx0RGVmYXVsdCA9IDIsXG5cdFByZWZlcnJlZCA9IDMsXG59XG5cbmV4cG9ydCBlbnVtIFdvcmtzcGFjZVRydXN0U3RhdGUge1xuXHRVbnRydXN0ZWQgPSAwLFxuXHRUcnVzdGVkID0gMSxcblx0VW5zcGVjaWZpZWQgPSAyXG59XG5cbmV4cG9ydCBlbnVtIFBvcnRBdXRvRm9yd2FyZEFjdGlvbiB7XG5cdE5vdGlmeSA9IDEsXG5cdE9wZW5Ccm93c2VyID0gMixcblx0T3BlblByZXZpZXcgPSAzLFxuXHRTaWxlbnQgPSA0LFxuXHRJZ25vcmUgPSA1LFxuXHRPcGVuQnJvd3Nlck9uY2UgPSA2XG59XG5cbmV4cG9ydCBjbGFzcyBUeXBlSGllcmFyY2h5SXRlbSB7XG5cdF9zZXNzaW9uSWQ/OiBzdHJpbmc7XG5cdF9pdGVtSWQ/OiBzdHJpbmc7XG5cblx0a2luZDogU3ltYm9sS2luZDtcblx0dGFncz86IFN5bWJvbFRhZ1tdO1xuXHRuYW1lOiBzdHJpbmc7XG5cdGRldGFpbD86IHN0cmluZztcblx0dXJpOiBVUkk7XG5cdHJhbmdlOiBSYW5nZTtcblx0c2VsZWN0aW9uUmFuZ2U6IFJhbmdlO1xuXG5cdGNvbnN0cnVjdG9yKGtpbmQ6IFN5bWJvbEtpbmQsIG5hbWU6IHN0cmluZywgZGV0YWlsOiBzdHJpbmcsIHVyaTogVVJJLCByYW5nZTogUmFuZ2UsIHNlbGVjdGlvblJhbmdlOiBSYW5nZSkge1xuXHRcdHRoaXMua2luZCA9IGtpbmQ7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmRldGFpbCA9IGRldGFpbDtcblx0XHR0aGlzLnVyaSA9IHVyaTtcblx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0dGhpcy5zZWxlY3Rpb25SYW5nZSA9IHNlbGVjdGlvblJhbmdlO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiBUYWIgSW5wdXRzXG5cbmV4cG9ydCBjbGFzcyBUZXh0VGFiSW5wdXQge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSB1cmk6IFVSSSkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0RGlmZlRhYklucHV0IHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgb3JpZ2luYWw6IFVSSSwgcmVhZG9ubHkgbW9kaWZpZWQ6IFVSSSkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0TWVyZ2VUYWJJbnB1dCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGJhc2U6IFVSSSwgcmVhZG9ubHkgaW5wdXQxOiBVUkksIHJlYWRvbmx5IGlucHV0MjogVVJJLCByZWFkb25seSByZXN1bHQ6IFVSSSkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDdXN0b21FZGl0b3JUYWJJbnB1dCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHVyaTogVVJJLCByZWFkb25seSB2aWV3VHlwZTogc3RyaW5nKSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFdlYnZpZXdFZGl0b3JUYWJJbnB1dCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHZpZXdUeXBlOiBzdHJpbmcpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tFZGl0b3JUYWJJbnB1dCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHVyaTogVVJJLCByZWFkb25seSBub3RlYm9va1R5cGU6IHN0cmluZykgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0RpZmZFZGl0b3JUYWJJbnB1dCB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IG9yaWdpbmFsOiBVUkksIHJlYWRvbmx5IG1vZGlmaWVkOiBVUkksIHJlYWRvbmx5IG5vdGVib29rVHlwZTogc3RyaW5nKSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsRWRpdG9yVGFiSW5wdXQge1xuXHRjb25zdHJ1Y3RvcigpIHsgfVxufVxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlV2luZG93SW5wdXQge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSB1cmk6IFVSSSwgcmVhZG9ubHkgaW5wdXRCb3hVcmk6IFVSSSkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0RWRpdG9yVGFiSW5wdXQge1xuXHRjb25zdHJ1Y3RvcigpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGV4dE11bHRpRGlmZlRhYklucHV0IHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgdGV4dERpZmZzOiBUZXh0RGlmZlRhYklucHV0W10pIHsgfVxufVxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBDaGF0XG5cbmV4cG9ydCBlbnVtIEludGVyYWN0aXZlU2Vzc2lvblZvdGVEaXJlY3Rpb24ge1xuXHREb3duID0gMCxcblx0VXAgPSAxXG59XG5cbmV4cG9ydCBlbnVtIENoYXRDb3B5S2luZCB7XG5cdEFjdGlvbiA9IDEsXG5cdFRvb2xiYXIgPSAyXG59XG5cbmV4cG9ydCBlbnVtIENoYXRWYXJpYWJsZUxldmVsIHtcblx0U2hvcnQgPSAxLFxuXHRNZWRpdW0gPSAyLFxuXHRGdWxsID0gM1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdENvbXBsZXRpb25JdGVtIGltcGxlbWVudHMgdnNjb2RlLkNoYXRDb21wbGV0aW9uSXRlbSB7XG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmcgfCBDb21wbGV0aW9uSXRlbUxhYmVsO1xuXHRmdWxsTmFtZT86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0aWNvbj86IHZzY29kZS5UaGVtZUljb247XG5cdGluc2VydFRleHQ/OiBzdHJpbmc7XG5cdHZhbHVlczogdnNjb2RlLkNoYXRWYXJpYWJsZVZhbHVlW107XG5cdGRldGFpbD86IHN0cmluZztcblx0ZG9jdW1lbnRhdGlvbj86IHN0cmluZyB8IE1hcmtkb3duU3RyaW5nO1xuXHRjb21tYW5kPzogdnNjb2RlLkNvbW1hbmQ7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZyB8IENvbXBsZXRpb25JdGVtTGFiZWwsIHZhbHVlczogdnNjb2RlLkNoYXRWYXJpYWJsZVZhbHVlW10pIHtcblx0XHR0aGlzLmlkID0gaWQ7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMudmFsdWVzID0gdmFsdWVzO1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIENoYXRFZGl0aW5nU2Vzc2lvbkFjdGlvbk91dGNvbWUge1xuXHRBY2NlcHRlZCA9IDEsXG5cdFJlamVjdGVkID0gMixcblx0U2F2ZWQgPSAzXG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gSW50ZXJhY3RpdmUgRWRpdG9yXG5cbmV4cG9ydCBlbnVtIEludGVyYWN0aXZlRWRpdG9yUmVzcG9uc2VGZWVkYmFja0tpbmQge1xuXHRVbmhlbHBmdWwgPSAwLFxuXHRIZWxwZnVsID0gMSxcblx0VW5kb25lID0gMixcblx0QWNjZXB0ZWQgPSAzLFxuXHRCdWcgPSA0XG59XG5cbmV4cG9ydCBlbnVtIENoYXRSZXN1bHRGZWVkYmFja0tpbmQge1xuXHRVbmhlbHBmdWwgPSAwLFxuXHRIZWxwZnVsID0gMSxcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRSZXNwb25zZU1hcmtkb3duUGFydCB7XG5cdHZhbHVlOiB2c2NvZGUuTWFya2Rvd25TdHJpbmc7XG5cdGNvbnN0cnVjdG9yKHZhbHVlOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcpIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJyAmJiB2YWx1ZS5pc1RydXN0ZWQgPT09IHRydWUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVGhlIGJvb2xlYW4gZm9ybSBvZiBNYXJrZG93blN0cmluZy5pc1RydXN0ZWQgaXMgTk9UIHN1cHBvcnRlZCBmb3IgY2hhdCBwYXJ0aWNpcGFudHMuJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy52YWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBuZXcgTWFya2Rvd25TdHJpbmcodmFsdWUpIDogdmFsdWU7XG5cdH1cbn1cblxuLyoqXG4gKiBUT0RPIGlmICd2dWxuZXJhYmlsaXRpZXMnIGlzIGZpbmFsaXplZCwgdGhpcyBzaG91bGQgYmUgbWVyZ2VkIHdpdGggdGhlIGJhc2UgQ2hhdFJlc3BvbnNlTWFya2Rvd25QYXJ0LiBJIGp1c3QgZG9uJ3Qgc2VlIGhvdyB0byBkbyB0aGF0IHdoaWxlIGtlZXBpbmdcbiAqIHZ1bG5lcmFiaWxpdGllcyBpbiBhIHNlcGVyYXRlIEFQSSBwcm9wb3NhbCBpbiBhIGNsZWFuIHdheS5cbiAqL1xuZXhwb3J0IGNsYXNzIENoYXRSZXNwb25zZU1hcmtkb3duV2l0aFZ1bG5lcmFiaWxpdGllc1BhcnQge1xuXHR2YWx1ZTogdnNjb2RlLk1hcmtkb3duU3RyaW5nO1xuXHR2dWxuZXJhYmlsaXRpZXM6IHZzY29kZS5DaGF0VnVsbmVyYWJpbGl0eVtdO1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nLCB2dWxuZXJhYmlsaXRpZXM6IHZzY29kZS5DaGF0VnVsbmVyYWJpbGl0eVtdKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgJiYgdmFsdWUuaXNUcnVzdGVkID09PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBib29sZWFuIGZvcm0gb2YgTWFya2Rvd25TdHJpbmcuaXNUcnVzdGVkIGlzIE5PVCBzdXBwb3J0ZWQgZm9yIGNoYXQgcGFydGljaXBhbnRzLicpO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsdWUgPSB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gbmV3IE1hcmtkb3duU3RyaW5nKHZhbHVlKSA6IHZhbHVlO1xuXHRcdHRoaXMudnVsbmVyYWJpbGl0aWVzID0gdnVsbmVyYWJpbGl0aWVzO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0IHtcblx0dGl0bGU6IHN0cmluZztcblx0bWVzc2FnZTogc3RyaW5nO1xuXHRkYXRhOiBhbnk7XG5cdGJ1dHRvbnM/OiBzdHJpbmdbXTtcblxuXHRjb25zdHJ1Y3Rvcih0aXRsZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGRhdGE6IGFueSwgYnV0dG9ucz86IHN0cmluZ1tdKSB7XG5cdFx0dGhpcy50aXRsZSA9IHRpdGxlO1xuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHR0aGlzLmJ1dHRvbnMgPSBidXR0b25zO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VGaWxlVHJlZVBhcnQge1xuXHR2YWx1ZTogdnNjb2RlLkNoYXRSZXNwb25zZUZpbGVUcmVlW107XG5cdGJhc2VVcmk6IHZzY29kZS5Vcmk7XG5cdGNvbnN0cnVjdG9yKHZhbHVlOiB2c2NvZGUuQ2hhdFJlc3BvbnNlRmlsZVRyZWVbXSwgYmFzZVVyaTogdnNjb2RlLlVyaSkge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmJhc2VVcmkgPSBiYXNlVXJpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VBbmNob3JQYXJ0IGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZXNwb25zZUFuY2hvclBhcnQge1xuXHR2YWx1ZTogdnNjb2RlLlVyaSB8IHZzY29kZS5Mb2NhdGlvbjtcblx0dGl0bGU/OiBzdHJpbmc7XG5cblx0dmFsdWUyOiB2c2NvZGUuVXJpIHwgdnNjb2RlLkxvY2F0aW9uIHwgdnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uO1xuXHRyZXNvbHZlPyh0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogVGhlbmFibGU8dm9pZD47XG5cblx0Y29uc3RydWN0b3IodmFsdWU6IHZzY29kZS5VcmkgfCB2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb24sIHRpdGxlPzogc3RyaW5nKSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlIGFzIGFueTtcblx0XHR0aGlzLnZhbHVlMiA9IHZhbHVlO1xuXHRcdHRoaXMudGl0bGUgPSB0aXRsZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0IHtcblx0dmFsdWU6IHN0cmluZztcblx0Y29uc3RydWN0b3IodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0MiB7XG5cdHZhbHVlOiBzdHJpbmc7XG5cdHRhc2s/OiAocHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQ+KSA9PiBUaGVuYWJsZTxzdHJpbmcgfCB2b2lkPjtcblx0Y29uc3RydWN0b3IodmFsdWU6IHN0cmluZywgdGFzaz86IChwcm9ncmVzczogdnNjb2RlLlByb2dyZXNzPHZzY29kZS5DaGF0UmVzcG9uc2VXYXJuaW5nUGFydD4pID0+IFRoZW5hYmxlPHN0cmluZyB8IHZvaWQ+KSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMudGFzayA9IHRhc2s7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IHtcblx0dmFsdWU6IHZzY29kZS5NYXJrZG93blN0cmluZztcblx0Y29uc3RydWN0b3IodmFsdWU6IHN0cmluZyB8IHZzY29kZS5NYXJrZG93blN0cmluZykge1xuXHRcdGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnICYmIHZhbHVlLmlzVHJ1c3RlZCA9PT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgYm9vbGVhbiBmb3JtIG9mIE1hcmtkb3duU3RyaW5nLmlzVHJ1c3RlZCBpcyBOT1Qgc3VwcG9ydGVkIGZvciBjaGF0IHBhcnRpY2lwYW50cy4nKTtcblx0XHR9XG5cblx0XHR0aGlzLnZhbHVlID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IG5ldyBNYXJrZG93blN0cmluZyh2YWx1ZSkgOiB2YWx1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQge1xuXHR2YWx1ZTogdnNjb2RlLkNvbW1hbmQ7XG5cdGNvbnN0cnVjdG9yKHZhbHVlOiB2c2NvZGUuQ29tbWFuZCkge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCB7XG5cdHZhbHVlOiB2c2NvZGUuVXJpIHwgdnNjb2RlLkxvY2F0aW9uIHwgeyB2YXJpYWJsZU5hbWU6IHN0cmluZzsgdmFsdWU/OiB2c2NvZGUuVXJpIHwgdnNjb2RlLkxvY2F0aW9uIH0gfCBzdHJpbmc7XG5cdGljb25QYXRoPzogdnNjb2RlLlVyaSB8IHZzY29kZS5UaGVtZUljb24gfCB7IGxpZ2h0OiB2c2NvZGUuVXJpOyBkYXJrOiB2c2NvZGUuVXJpIH07XG5cdG9wdGlvbnM/OiB7IHN0YXR1cz86IHsgZGVzY3JpcHRpb246IHN0cmluZzsga2luZDogdnNjb2RlLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnRTdGF0dXNLaW5kIH0gfTtcblx0Y29uc3RydWN0b3IodmFsdWU6IHZzY29kZS5VcmkgfCB2c2NvZGUuTG9jYXRpb24gfCB7IHZhcmlhYmxlTmFtZTogc3RyaW5nOyB2YWx1ZT86IHZzY29kZS5VcmkgfCB2c2NvZGUuTG9jYXRpb24gfSB8IHN0cmluZywgaWNvblBhdGg/OiB2c2NvZGUuVXJpIHwgdnNjb2RlLlRoZW1lSWNvbiB8IHsgbGlnaHQ6IHZzY29kZS5Vcmk7IGRhcms6IHZzY29kZS5VcmkgfSwgb3B0aW9ucz86IHsgc3RhdHVzPzogeyBkZXNjcmlwdGlvbjogc3RyaW5nOyBraW5kOiB2c2NvZGUuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydFN0YXR1c0tpbmQgfSB9KSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuaWNvblBhdGggPSBpY29uUGF0aDtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0IHtcblx0aXNFZGl0PzogYm9vbGVhbjtcblx0dmFsdWU6IHZzY29kZS5Vcmk7XG5cdGNvbnN0cnVjdG9yKHZhbHVlOiB2c2NvZGUuVXJpLCBpc0VkaXQ/OiBib29sZWFuKSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuaXNFZGl0ID0gaXNFZGl0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VDb2RlQ2l0YXRpb25QYXJ0IHtcblx0dmFsdWU6IHZzY29kZS5Vcmk7XG5cdGxpY2Vuc2U6IHN0cmluZztcblx0c25pcHBldDogc3RyaW5nO1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogdnNjb2RlLlVyaSwgbGljZW5zZTogc3RyaW5nLCBzbmlwcGV0OiBzdHJpbmcpIHtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5saWNlbnNlID0gbGljZW5zZTtcblx0XHR0aGlzLnNuaXBwZXQgPSBzbmlwcGV0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VNb3ZlUGFydCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB1cmk6IHZzY29kZS5VcmksXG5cdFx0cHVibGljIHJlYWRvbmx5IHJhbmdlOiB2c2NvZGUuUmFuZ2UsXG5cdCkge1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VUZXh0RWRpdFBhcnQgaW1wbGVtZW50cyB2c2NvZGUuQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0IHtcblx0dXJpOiB2c2NvZGUuVXJpO1xuXHRlZGl0czogdnNjb2RlLlRleHRFZGl0W107XG5cdGlzRG9uZT86IGJvb2xlYW47XG5cdGNvbnN0cnVjdG9yKHVyaTogdnNjb2RlLlVyaSwgZWRpdHNPckRvbmU6IHZzY29kZS5UZXh0RWRpdCB8IHZzY29kZS5UZXh0RWRpdFtdIHwgdHJ1ZSkge1xuXHRcdHRoaXMudXJpID0gdXJpO1xuXHRcdGlmIChlZGl0c09yRG9uZSA9PT0gdHJ1ZSkge1xuXHRcdFx0dGhpcy5pc0RvbmUgPSB0cnVlO1xuXHRcdFx0dGhpcy5lZGl0cyA9IFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVkaXRzID0gQXJyYXkuaXNBcnJheShlZGl0c09yRG9uZSkgPyBlZGl0c09yRG9uZSA6IFtlZGl0c09yRG9uZV07XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VOb3RlYm9va0VkaXRQYXJ0IGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZXNwb25zZU5vdGVib29rRWRpdFBhcnQge1xuXHR1cmk6IHZzY29kZS5Vcmk7XG5cdGVkaXRzOiB2c2NvZGUuTm90ZWJvb2tFZGl0W107XG5cdGlzRG9uZT86IGJvb2xlYW47XG5cdGNvbnN0cnVjdG9yKHVyaTogdnNjb2RlLlVyaSwgZWRpdHNPckRvbmU6IHZzY29kZS5Ob3RlYm9va0VkaXQgfCB2c2NvZGUuTm90ZWJvb2tFZGl0W10gfCB0cnVlKSB7XG5cdFx0dGhpcy51cmkgPSB1cmk7XG5cdFx0aWYgKGVkaXRzT3JEb25lID09PSB0cnVlKSB7XG5cdFx0XHR0aGlzLmlzRG9uZSA9IHRydWU7XG5cdFx0XHR0aGlzLmVkaXRzID0gW107XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWRpdHMgPSBBcnJheS5pc0FycmF5KGVkaXRzT3JEb25lKSA/IGVkaXRzT3JEb25lIDogW2VkaXRzT3JEb25lXTtcblxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlcXVlc3RUdXJuIGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZXF1ZXN0VHVybiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHByb21wdDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGNvbW1hbmQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRyZWFkb25seSByZWZlcmVuY2VzOiB2c2NvZGUuQ2hhdFByb21wdFJlZmVyZW5jZVtdLFxuXHRcdHJlYWRvbmx5IHBhcnRpY2lwYW50OiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgdG9vbFJlZmVyZW5jZXM6IHZzY29kZS5DaGF0TGFuZ3VhZ2VNb2RlbFRvb2xSZWZlcmVuY2VbXVxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlVHVybiBpbXBsZW1lbnRzIHZzY29kZS5DaGF0UmVzcG9uc2VUdXJuIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSByZXNwb25zZTogUmVhZG9ubHlBcnJheTxDaGF0UmVzcG9uc2VNYXJrZG93blBhcnQgfCBDaGF0UmVzcG9uc2VGaWxlVHJlZVBhcnQgfCBDaGF0UmVzcG9uc2VBbmNob3JQYXJ0IHwgQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQ+LFxuXHRcdHJlYWRvbmx5IHJlc3VsdDogdnNjb2RlLkNoYXRSZXN1bHQsXG5cdFx0cmVhZG9ubHkgcGFydGljaXBhbnQ6IHN0cmluZyxcblx0XHRyZWFkb25seSBjb21tYW5kPzogc3RyaW5nXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBlbnVtIENoYXRMb2NhdGlvbiB7XG5cdFBhbmVsID0gMSxcblx0VGVybWluYWwgPSAyLFxuXHROb3RlYm9vayA9IDMsXG5cdEVkaXRvciA9IDQsXG5cdEVkaXRpbmdTZXNzaW9uID0gNSxcbn1cblxuZXhwb3J0IGVudW0gQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydFN0YXR1c0tpbmQge1xuXHRDb21wbGV0ZSA9IDEsXG5cdFBhcnRpYWwgPSAyLFxuXHRPbWl0dGVkID0gM1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlcXVlc3RFZGl0b3JEYXRhIGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZXF1ZXN0RWRpdG9yRGF0YSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LFxuXHRcdHJlYWRvbmx5IHNlbGVjdGlvbjogdnNjb2RlLlNlbGVjdGlvbixcblx0XHRyZWFkb25seSB3aG9sZVJhbmdlOiB2c2NvZGUuUmFuZ2UsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVxdWVzdE5vdGVib29rRGF0YSBpbXBsZW1lbnRzIHZzY29kZS5DaGF0UmVxdWVzdE5vdGVib29rRGF0YSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNlbGw6IHZzY29kZS5UZXh0RG9jdW1lbnRcblx0KSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRSZWZlcmVuY2VCaW5hcnlEYXRhIGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZWZlcmVuY2VCaW5hcnlEYXRhIHtcblx0bWltZVR5cGU6IHN0cmluZztcblx0ZGF0YTogKCkgPT4gVGhlbmFibGU8VWludDhBcnJheT47XG5cdHJlZmVyZW5jZT86IHZzY29kZS5Vcmk7XG5cdGNvbnN0cnVjdG9yKG1pbWVUeXBlOiBzdHJpbmcsIGRhdGE6ICgpID0+IFRoZW5hYmxlPFVpbnQ4QXJyYXk+LCByZWZlcmVuY2U/OiB2c2NvZGUuVXJpKSB7XG5cdFx0dGhpcy5taW1lVHlwZSA9IG1pbWVUeXBlO1xuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0dGhpcy5yZWZlcmVuY2UgPSByZWZlcmVuY2U7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRSZWZlcmVuY2VEaWFnbm9zdGljIGltcGxlbWVudHMgdnNjb2RlLkNoYXRSZWZlcmVuY2VEaWFnbm9zdGljIHtcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGRpYWdub3N0aWNzOiBbdnNjb2RlLlVyaSwgdnNjb2RlLkRpYWdub3N0aWNbXV1bXSkgeyB9XG59XG5cbmV4cG9ydCBlbnVtIExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUge1xuXHRVc2VyID0gMSxcblx0QXNzaXN0YW50ID0gMixcblx0U3lzdGVtID0gM1xufVxuXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IGltcGxlbWVudHMgdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB7XG5cblx0Y2FsbElkOiBzdHJpbmc7XG5cdGNvbnRlbnQ6IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydCB8IHVua25vd24pW107XG5cdGlzRXJyb3I6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoY2FsbElkOiBzdHJpbmcsIGNvbnRlbnQ6IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydCB8IHVua25vd24pW10sIGlzRXJyb3I/OiBib29sZWFuKSB7XG5cdFx0dGhpcy5jYWxsSWQgPSBjYWxsSWQ7XG5cdFx0dGhpcy5jb250ZW50ID0gY29udGVudDtcblx0XHR0aGlzLmlzRXJyb3IgPSBpc0Vycm9yID8/IGZhbHNlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQcmVwYXJlZFRlcm1pbmFsVG9vbEludm9jYXRpb24ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29tbWFuZDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBsYW5ndWFnZTogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBjb25maXJtYXRpb25NZXNzYWdlcz86IHZzY29kZS5MYW5ndWFnZU1vZGVsVG9vbENvbmZpcm1hdGlvbk1lc3NhZ2VzLFxuXHQpIHsgfVxufVxuXG5leHBvcnQgZW51bSBDaGF0RXJyb3JMZXZlbCB7XG5cdEluZm8gPSAwLFxuXHRXYXJuaW5nID0gMSxcblx0RXJyb3IgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UgaW1wbGVtZW50cyB2c2NvZGUuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlIHtcblxuXHRzdGF0aWMgVXNlcihjb250ZW50OiBzdHJpbmcgfCAoTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydClbXSwgbmFtZT86IHN0cmluZyk6IExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZSB7XG5cdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UoTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZS5Vc2VyLCBjb250ZW50LCBuYW1lKTtcblx0fVxuXG5cdHN0YXRpYyBBc3Npc3RhbnQoY29udGVudDogc3RyaW5nIHwgKExhbmd1YWdlTW9kZWxUZXh0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQpW10sIG5hbWU/OiBzdHJpbmcpOiBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2Uge1xuXHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlKExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUuQXNzaXN0YW50LCBjb250ZW50LCBuYW1lKTtcblx0fVxuXG5cdHJvbGU6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlO1xuXG5cdHByaXZhdGUgX2NvbnRlbnQ6IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KVtdID0gW107XG5cblx0c2V0IGNvbnRlbnQodmFsdWU6IHN0cmluZyB8IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KVtdKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdC8vIHdlIGNoYW5nZWQgdGhpcyBhbmQgc3RpbGwgc3VwcG9ydCBzZXR0aW5nIGNvbnRlbnQgd2l0aCBhIHN0cmluZyBwcm9wZXJ0eS4gdGhpcyBrZWVwIHRoZSBBUEkgcnVudGltZSBzdGFibGVcblx0XHRcdC8vIGRlc3BpdGUgdGhlIGJyZWFraW5nIGNoYW5nZSBpbiB0aGUgdHlwZSBkZWZpbml0aW9uLlxuXHRcdFx0dGhpcy5fY29udGVudCA9IFtuZXcgTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KHZhbHVlKV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NvbnRlbnQgPSB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGVudCgpOiAoTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydClbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnQ7XG5cdH1cblxuXHQvLyBUZW1wIHRvIGF2b2lkIGJyZWFraW5nIGNoYW5nZXNcblx0c2V0IGNvbnRlbnQyKHZhbHVlOiAoc3RyaW5nIHwgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydClbXSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0dGhpcy5jb250ZW50ID0gdmFsdWUubWFwKHBhcnQgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsVGV4dFBhcnQocGFydCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGVudDIoKTogKHN0cmluZyB8IExhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQpW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbnRlbnQubWFwKHBhcnQgPT4ge1xuXHRcdFx0aWYgKHBhcnQgaW5zdGFuY2VvZiBMYW5ndWFnZU1vZGVsVGV4dFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnQudmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9KTtcblx0fVxuXG5cdG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihyb2xlOiB2c2NvZGUuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZSwgY29udGVudDogc3RyaW5nIHwgKExhbmd1YWdlTW9kZWxUZXh0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQpW10sIG5hbWU/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnJvbGUgPSByb2xlO1xuXHRcdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyIGltcGxlbWVudHMgdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIge1xuXG5cdHN0YXRpYyBVc2VyKGNvbnRlbnQ6IHN0cmluZyB8IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0IHwgTGFuZ3VhZ2VNb2RlbERhdGFQYXJ0KVtdLCBuYW1lPzogc3RyaW5nKTogTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlMiB7XG5cdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyKExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUuVXNlciwgY29udGVudCwgbmFtZSk7XG5cdH1cblxuXHRzdGF0aWMgQXNzaXN0YW50KGNvbnRlbnQ6IHN0cmluZyB8IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0IHwgTGFuZ3VhZ2VNb2RlbERhdGFQYXJ0KVtdLCBuYW1lPzogc3RyaW5nKTogTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlMiB7XG5cdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyKExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUuQXNzaXN0YW50LCBjb250ZW50LCBuYW1lKTtcblx0fVxuXG5cdHJvbGU6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlO1xuXG5cdHByaXZhdGUgX2NvbnRlbnQ6IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0IHwgTGFuZ3VhZ2VNb2RlbERhdGFQYXJ0KVtdID0gW107XG5cblx0c2V0IGNvbnRlbnQodmFsdWU6IHN0cmluZyB8IChMYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQgfCBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0IHwgTGFuZ3VhZ2VNb2RlbERhdGFQYXJ0KVtdKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdC8vIHdlIGNoYW5nZWQgdGhpcyBhbmQgc3RpbGwgc3VwcG9ydCBzZXR0aW5nIGNvbnRlbnQgd2l0aCBhIHN0cmluZyBwcm9wZXJ0eS4gdGhpcyBrZWVwIHRoZSBBUEkgcnVudGltZSBzdGFibGVcblx0XHRcdC8vIGRlc3BpdGUgdGhlIGJyZWFraW5nIGNoYW5nZSBpbiB0aGUgdHlwZSBkZWZpbml0aW9uLlxuXHRcdFx0dGhpcy5fY29udGVudCA9IFtuZXcgTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KHZhbHVlKV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NvbnRlbnQgPSB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGVudCgpOiAoTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydCB8IExhbmd1YWdlTW9kZWxEYXRhUGFydClbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnQ7XG5cdH1cblxuXHQvLyBUZW1wIHRvIGF2b2lkIGJyZWFraW5nIGNoYW5nZXNcblx0c2V0IGNvbnRlbnQyKHZhbHVlOiAoc3RyaW5nIHwgTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydCB8IExhbmd1YWdlTW9kZWxEYXRhUGFydClbXSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0dGhpcy5jb250ZW50ID0gdmFsdWUubWFwKHBhcnQgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsVGV4dFBhcnQocGFydCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGVudDIoKTogKHN0cmluZyB8IExhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQgfCBMYW5ndWFnZU1vZGVsRGF0YVBhcnQpW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbnRlbnQubWFwKHBhcnQgPT4ge1xuXHRcdFx0aWYgKHBhcnQgaW5zdGFuY2VvZiBMYW5ndWFnZU1vZGVsVGV4dFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnQudmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9KTtcblx0fVxuXG5cdG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihyb2xlOiB2c2NvZGUuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZSwgY29udGVudDogc3RyaW5nIHwgKExhbmd1YWdlTW9kZWxUZXh0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydCB8IExhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQgfCBMYW5ndWFnZU1vZGVsRGF0YVBhcnQpW10sIG5hbWU/OiBzdHJpbmcpIHtcblx0XHR0aGlzLnJvbGUgPSByb2xlO1xuXHRcdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0IGltcGxlbWVudHMgdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQge1xuXHRjYWxsSWQ6IHN0cmluZztcblx0bmFtZTogc3RyaW5nO1xuXHRpbnB1dDogYW55O1xuXG5cdGNvbnN0cnVjdG9yKGNhbGxJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGlucHV0OiBhbnkpIHtcblx0XHR0aGlzLmNhbGxJZCA9IGNhbGxJZDtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXG5cdFx0dGhpcy5pbnB1dCA9IGlucHV0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsVGV4dFBhcnQgaW1wbGVtZW50cyB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHtcblx0dmFsdWU6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHR9XG5cblx0dG9KU09OKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0LFxuXHRcdFx0dmFsdWU6IHRoaXMudmFsdWUsXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VNb2RlbERhdGFQYXJ0IGltcGxlbWVudHMgdnNjb2RlLkxhbmd1YWdlTW9kZWxEYXRhUGFydCB7XG5cdHZhbHVlOiB2c2NvZGUuQ2hhdEltYWdlUGFydDtcblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogdnNjb2RlLkNoYXRJbWFnZVBhcnQpIHtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5MYW5ndWFnZU1vZGVsRGF0YVBhcnQsXG5cdFx0XHR2YWx1ZTogdGhpcy52YWx1ZSxcblx0XHR9O1xuXHR9XG59XG5cbi8qKlxuICogRW51bSBmb3Igc3VwcG9ydGVkIGltYWdlIE1JTUUgdHlwZXMuXG4gKi9cbmV4cG9ydCBlbnVtIENoYXRJbWFnZU1pbWVUeXBlIHtcblx0UE5HID0gJ2ltYWdlL3BuZycsXG5cdEpQRUcgPSAnaW1hZ2UvanBlZycsXG5cdEdJRiA9ICdpbWFnZS9naWYnLFxuXHRXRUJQID0gJ2ltYWdlL3dlYnAnLFxuXHRCTVAgPSAnaW1hZ2UvYm1wJyxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGF0SW1hZ2VQYXJ0IHtcblx0bWltZVR5cGU6IENoYXRJbWFnZU1pbWVUeXBlO1xuXHRkYXRhOiBWU0J1ZmZlcjtcbn1cblxuZXhwb3J0IGNsYXNzIExhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0IHtcblx0dmFsdWU6IHVua25vd247XG5cblx0Y29uc3RydWN0b3IodmFsdWU6IHVua25vd24pIHtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5MYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydCxcblx0XHRcdHZhbHVlOiB0aGlzLnZhbHVlLFxuXHRcdH07XG5cdH1cbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICovXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VNb2RlbENoYXRTeXN0ZW1NZXNzYWdlIHtcblx0Y29udGVudDogc3RyaW5nO1xuXHRjb25zdHJ1Y3Rvcihjb250ZW50OiBzdHJpbmcpIHtcblx0XHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xuXHR9XG59XG5cblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICovXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VNb2RlbENoYXRVc2VyTWVzc2FnZSB7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0bmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRlbnQ6IHN0cmluZywgbmFtZT86IHN0cmluZykge1xuXHRcdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0fVxufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKi9cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsQ2hhdEFzc2lzdGFudE1lc3NhZ2Uge1xuXHRjb250ZW50OiBzdHJpbmc7XG5cdG5hbWU/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IoY29udGVudDogc3RyaW5nLCBuYW1lPzogc3RyaW5nKSB7XG5cdFx0dGhpcy5jb250ZW50ID0gY29udGVudDtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cblx0c3RhdGljIHJlYWRvbmx5ICNuYW1lID0gJ0xhbmd1YWdlTW9kZWxFcnJvcic7XG5cblx0c3RhdGljIE5vdEZvdW5kKG1lc3NhZ2U/OiBzdHJpbmcpOiBMYW5ndWFnZU1vZGVsRXJyb3Ige1xuXHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbEVycm9yKG1lc3NhZ2UsIExhbmd1YWdlTW9kZWxFcnJvci5Ob3RGb3VuZC5uYW1lKTtcblx0fVxuXG5cdHN0YXRpYyBOb1Blcm1pc3Npb25zKG1lc3NhZ2U/OiBzdHJpbmcpOiBMYW5ndWFnZU1vZGVsRXJyb3Ige1xuXHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbEVycm9yKG1lc3NhZ2UsIExhbmd1YWdlTW9kZWxFcnJvci5Ob1Blcm1pc3Npb25zLm5hbWUpO1xuXHR9XG5cblx0c3RhdGljIEJsb2NrZWQobWVzc2FnZT86IHN0cmluZyk6IExhbmd1YWdlTW9kZWxFcnJvciB7XG5cdFx0cmV0dXJuIG5ldyBMYW5ndWFnZU1vZGVsRXJyb3IobWVzc2FnZSwgTGFuZ3VhZ2VNb2RlbEVycm9yLkJsb2NrZWQubmFtZSk7XG5cdH1cblxuXHRzdGF0aWMgdHJ5RGVzZXJpYWxpemUoZGF0YTogU2VyaWFsaXplZEVycm9yKTogTGFuZ3VhZ2VNb2RlbEVycm9yIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZGF0YS5uYW1lICE9PSBMYW5ndWFnZU1vZGVsRXJyb3IuI25hbWUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbEVycm9yKGRhdGEubWVzc2FnZSwgZGF0YS5jb2RlLCBkYXRhLmNhdXNlKTtcblx0fVxuXG5cdHJlYWRvbmx5IGNvZGU6IHN0cmluZztcblxuXHRjb25zdHJ1Y3RvcihtZXNzYWdlPzogc3RyaW5nLCBjb2RlPzogc3RyaW5nLCBjYXVzZT86IEVycm9yKSB7XG5cdFx0c3VwZXIobWVzc2FnZSwgeyBjYXVzZSB9KTtcblx0XHR0aGlzLm5hbWUgPSBMYW5ndWFnZU1vZGVsRXJyb3IuI25hbWU7XG5cdFx0dGhpcy5jb2RlID0gY29kZSA/PyAnJztcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdCB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZW50OiAoTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgTGFuZ3VhZ2VNb2RlbFByb21wdFRzeFBhcnQpW10pIHsgfVxuXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0LFxuXHRcdFx0Y29udGVudDogdGhpcy5jb250ZW50LFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuZGVkTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQgZXh0ZW5kcyBMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdCB7XG59XG5cbmV4cG9ydCBlbnVtIExhbmd1YWdlTW9kZWxDaGF0VG9vbE1vZGUge1xuXHRBdXRvID0gMSxcblx0UmVxdWlyZWQgPSAyXG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gYWlcblxuZXhwb3J0IGVudW0gUmVsYXRlZEluZm9ybWF0aW9uVHlwZSB7XG5cdFN5bWJvbEluZm9ybWF0aW9uID0gMSxcblx0Q29tbWFuZEluZm9ybWF0aW9uID0gMixcblx0U2VhcmNoSW5mb3JtYXRpb24gPSAzLFxuXHRTZXR0aW5nSW5mb3JtYXRpb24gPSA0XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gU3BlZWNoXG5cbmV4cG9ydCBlbnVtIFNwZWVjaFRvVGV4dFN0YXR1cyB7XG5cdFN0YXJ0ZWQgPSAxLFxuXHRSZWNvZ25pemluZyA9IDIsXG5cdFJlY29nbml6ZWQgPSAzLFxuXHRTdG9wcGVkID0gNCxcblx0RXJyb3IgPSA1XG59XG5cbmV4cG9ydCBlbnVtIFRleHRUb1NwZWVjaFN0YXR1cyB7XG5cdFN0YXJ0ZWQgPSAxLFxuXHRTdG9wcGVkID0gMixcblx0RXJyb3IgPSAzXG59XG5cbmV4cG9ydCBlbnVtIEtleXdvcmRSZWNvZ25pdGlvblN0YXR1cyB7XG5cdFJlY29nbml6ZWQgPSAxLFxuXHRTdG9wcGVkID0gMlxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIElubGluZUVkaXRcblxuZXhwb3J0IGNsYXNzIElubGluZUVkaXQgaW1wbGVtZW50cyB2c2NvZGUuSW5saW5lRWRpdCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB0ZXh0OiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJhbmdlOiBSYW5nZSxcblx0KSB7IH1cbn1cblxuZXhwb3J0IGVudW0gSW5saW5lRWRpdFRyaWdnZXJLaW5kIHtcblx0SW52b2tlID0gMCxcblx0QXV0b21hdGljID0gMSxcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBNQ1xuZXhwb3J0IGNsYXNzIE1jcFN0ZGlvU2VydmVyRGVmaW5pdGlvbiBpbXBsZW1lbnRzIHZzY29kZS5NY3BTdGRpb1NlcnZlckRlZmluaXRpb24ge1xuXHRjd2Q/OiBVUkk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIGxhYmVsOiBzdHJpbmcsXG5cdFx0cHVibGljIGNvbW1hbmQ6IHN0cmluZyxcblx0XHRwdWJsaWMgYXJnczogc3RyaW5nW10sXG5cdFx0cHVibGljIGVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyIHwgbnVsbD5cblx0KSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIE1jcFNTRVNlcnZlckRlZmluaXRpb24gaW1wbGVtZW50cyB2c2NvZGUuTWNwU1NFU2VydmVyRGVmaW5pdGlvbiB7XG5cdGhlYWRlcnM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtdO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgbGFiZWw6IHN0cmluZyxcblx0XHRwdWJsaWMgdXJpOiBVUklcblx0KSB7IH1cbn1cbi8vI2VuZHJlZ2lvblxuIl0sCiAg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OENBQUEsWUFBUyxLQUFUO0FBQ0EsRUFBQUEsOENBQUEsZUFBWSxLQUFaO0FBRlcsU0FBQUE7QUFBQSxHQUFBO0FBUUwsTUFBTSx5QkFBb0U7QUFBQSxFQUdoRixZQUNRLE9BQ0EsU0FDQSxNQUNBLEtBQ047QUFKTTtBQUNBO0FBQ0E7QUFDQTtBQUFBLEVBQ0o7QUFDTDtBQUVPLE1BQU0sdUJBQWdFO0FBQUEsRUFFNUUsWUFDUSxPQUNBLEtBQ047QUFGTTtBQUNBO0FBSFIsbUJBQThCLENBQUM7QUFBQSxFQUkzQjtBQUNMOyIsCiAgIm5hbWVzIjogWyJUZXJtaW5hbE91dHB1dEFuY2hvciIsICJUZXJtaW5hbFF1aWNrRml4VHlwZSIsICJFbmRPZkxpbmUiLCAiRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlIiwgIkZpbGVFZGl0VHlwZSIsICJEaWFnbm9zdGljVGFnIiwgIkRpYWdub3N0aWNTZXZlcml0eSIsICJIb3ZlclZlcmJvc2l0eUFjdGlvbiIsICJEb2N1bWVudEhpZ2hsaWdodEtpbmQiLCAiU3ltYm9sS2luZCIsICJTeW1ib2xUYWciLCAiQ29kZUFjdGlvblRyaWdnZXJLaW5kIiwgIkxhbmd1YWdlU3RhdHVzU2V2ZXJpdHkiLCAiU2lnbmF0dXJlSGVscFRyaWdnZXJLaW5kIiwgIklubGF5SGludEtpbmQiLCAiQ29tcGxldGlvblRyaWdnZXJLaW5kIiwgIkNvbXBsZXRpb25JdGVtS2luZCIsICJDb21wbGV0aW9uSXRlbVRhZyIsICJQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQiLCAiVmlld0NvbHVtbiIsICJTdGF0dXNCYXJBbGlnbm1lbnQiLCAiVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUiLCAiVGV4dERvY3VtZW50U2F2ZVJlYXNvbiIsICJUZXh0RWRpdG9yUmV2ZWFsVHlwZSIsICJUZXh0RWRpdG9yU2VsZWN0aW9uQ2hhbmdlS2luZCIsICJUZXh0RWRpdG9yQ2hhbmdlS2luZCIsICJUZXh0RG9jdW1lbnRDaGFuZ2VSZWFzb24iLCAiRGVjb3JhdGlvblJhbmdlQmVoYXZpb3IiLCAiU3ludGF4VG9rZW5UeXBlIiwgIkNvbG9yRm9ybWF0IiwgIlNvdXJjZUNvbnRyb2xJbnB1dEJveFZhbGlkYXRpb25UeXBlIiwgIlRlcm1pbmFsRXhpdFJlYXNvbiIsICJUZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlIiwgIlRlcm1pbmFsU2hlbGxUeXBlIiwgIlRlcm1pbmFsTG9jYXRpb24iLCAiVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQiLCAiVGFza1JldmVhbEtpbmQiLCAiVGFza0V2ZW50S2luZCIsICJUYXNrUGFuZWxLaW5kIiwgIlNoZWxsUXVvdGluZyIsICJUYXNrU2NvcGUiLCAiUHJvZ3Jlc3NMb2NhdGlvbiIsICJWaWV3QmFkZ2UiLCAiVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlIiwgIlRyZWVJdGVtQ2hlY2tib3hTdGF0ZSIsICJEb2N1bWVudFBhc3RlVHJpZ2dlcktpbmQiLCAiQ29uZmlndXJhdGlvblRhcmdldCIsICJJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQiLCAiTmV3U3ltYm9sTmFtZVRhZyIsICJOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQiLCAiRmlsZUNoYW5nZVR5cGUiLCAiRm9sZGluZ1JhbmdlS2luZCIsICJDb21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZSIsICJDb21tZW50TW9kZSIsICJDb21tZW50U3RhdGUiLCAiQ29tbWVudFRocmVhZFN0YXRlIiwgIkNvbW1lbnRUaHJlYWRBcHBsaWNhYmlsaXR5IiwgIkNvbW1lbnRUaHJlYWRGb2N1cyIsICJsaW5lIiwgImNoYXIiLCAiRGVidWdDb25zb2xlTW9kZSIsICJRdWlja0lucHV0QnV0dG9uTG9jYXRpb24iLCAiUXVpY2tQaWNrSXRlbUtpbmQiLCAiSW5wdXRCb3hWYWxpZGF0aW9uU2V2ZXJpdHkiLCAiRXh0ZW5zaW9uS2luZCIsICJDb2xvclRoZW1lS2luZCIsICJOb3RlYm9va0NlbGxLaW5kIiwgIk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIiwgIk5vdGVib29rQ2VsbFN0YXR1c0JhckFsaWdubWVudCIsICJOb3RlYm9va0VkaXRvclJldmVhbFR5cGUiLCAiTm90ZWJvb2tDb250cm9sbGVyQWZmaW5pdHkiLCAiTm90ZWJvb2tDb250cm9sbGVyQWZmaW5pdHkyIiwgIk5vdGVib29rVmFyaWFibGVzUmVxdWVzdEtpbmQiLCAiRXh0ZW5zaW9uTW9kZSIsICJFeHRlbnNpb25SdW50aW1lIiwgIlN0YW5kYXJkVG9rZW5UeXBlIiwgIlRlc3RSZXN1bHRTdGF0ZSIsICJUZXN0UnVuUHJvZmlsZUtpbmQiLCAiRXh0ZXJuYWxVcmlPcGVuZXJQcmlvcml0eSIsICJXb3Jrc3BhY2VUcnVzdFN0YXRlIiwgIlBvcnRBdXRvRm9yd2FyZEFjdGlvbiIsICJJbnRlcmFjdGl2ZVNlc3Npb25Wb3RlRGlyZWN0aW9uIiwgIkNoYXRDb3B5S2luZCIsICJDaGF0VmFyaWFibGVMZXZlbCIsICJDaGF0RWRpdGluZ1Nlc3Npb25BY3Rpb25PdXRjb21lIiwgIkludGVyYWN0aXZlRWRpdG9yUmVzcG9uc2VGZWVkYmFja0tpbmQiLCAiQ2hhdFJlc3VsdEZlZWRiYWNrS2luZCIsICJDaGF0TG9jYXRpb24iLCAiQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydFN0YXR1c0tpbmQiLCAiTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZSIsICJDaGF0RXJyb3JMZXZlbCIsICJDaGF0SW1hZ2VNaW1lVHlwZSIsICJMYW5ndWFnZU1vZGVsQ2hhdFRvb2xNb2RlIiwgIlJlbGF0ZWRJbmZvcm1hdGlvblR5cGUiLCAiU3BlZWNoVG9UZXh0U3RhdHVzIiwgIlRleHRUb1NwZWVjaFN0YXR1cyIsICJLZXl3b3JkUmVjb2duaXRpb25TdGF0dXMiLCAiSW5saW5lRWRpdFRyaWdnZXJLaW5kIl0KfQo=
