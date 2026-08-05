import { ok } from "../../../base/common/assert.js";
import { ReadonlyError, illegalArgument } from "../../../base/common/errors.js";
import { IdGenerator } from "../../../base/common/idGenerator.js";
import * as TypeConverters from "./extHostTypeConverters.js";
import { EndOfLine, Position, Range, Selection, TextEditorRevealType } from "./extHostTypes.js";
const _TextEditorDecorationType = class _TextEditorDecorationType {
  constructor(proxy, extension, options) {
    const key = _TextEditorDecorationType._Keys.nextId();
    proxy.$registerTextEditorDecorationType(extension.identifier, key, TypeConverters.DecorationRenderOptions.from(options));
    this.value = Object.freeze({
      key,
      dispose() {
        proxy.$removeTextEditorDecorationType(key);
      }
    });
  }
};
_TextEditorDecorationType._Keys = new IdGenerator("TextEditorDecorationType");
let TextEditorDecorationType = _TextEditorDecorationType;
class TextEditorEdit {
  constructor(document, options) {
    this._collectedEdits = [];
    this._setEndOfLine = void 0;
    this._finalized = false;
    this._document = document;
    this._documentVersionId = document.version;
    this._undoStopBefore = options.undoStopBefore;
    this._undoStopAfter = options.undoStopAfter;
  }
  finalize() {
    this._finalized = true;
    return {
      documentVersionId: this._documentVersionId,
      edits: this._collectedEdits,
      setEndOfLine: this._setEndOfLine,
      undoStopBefore: this._undoStopBefore,
      undoStopAfter: this._undoStopAfter
    };
  }
  _throwIfFinalized() {
    if (this._finalized) {
      throw new Error("Edit is only valid while callback runs");
    }
  }
  replace(location, value) {
    this._throwIfFinalized();
    let range = null;
    if (location instanceof Position) {
      range = new Range(location, location);
    } else if (location instanceof Range) {
      range = location;
    } else {
      throw new Error("Unrecognized location");
    }
    this._pushEdit(range, value, false);
  }
  insert(location, value) {
    this._throwIfFinalized();
    this._pushEdit(new Range(location, location), value, true);
  }
  delete(location) {
    this._throwIfFinalized();
    let range = null;
    if (location instanceof Range) {
      range = location;
    } else {
      throw new Error("Unrecognized location");
    }
    this._pushEdit(range, null, true);
  }
  _pushEdit(range, text, forceMoveMarkers) {
    const validRange = this._document.validateRange(range);
    this._collectedEdits.push({
      range: validRange,
      text,
      forceMoveMarkers
    });
  }
  setEndOfLine(endOfLine) {
    this._throwIfFinalized();
    if (endOfLine !== EndOfLine.LF && endOfLine !== EndOfLine.CRLF) {
      throw illegalArgument("endOfLine");
    }
    this._setEndOfLine = endOfLine;
  }
}
class ExtHostTextEditorOptions {
  constructor(proxy, id, source, logService) {
    this._proxy = proxy;
    this._id = id;
    this._accept(source);
    this._logService = logService;
    const that = this;
    this.value = {
      get tabSize() {
        return that._tabSize;
      },
      set tabSize(value) {
        that._setTabSize(value);
      },
      get indentSize() {
        return that._indentSize;
      },
      set indentSize(value) {
        that._setIndentSize(value);
      },
      get insertSpaces() {
        return that._insertSpaces;
      },
      set insertSpaces(value) {
        that._setInsertSpaces(value);
      },
      get cursorStyle() {
        return that._cursorStyle;
      },
      set cursorStyle(value) {
        that._setCursorStyle(value);
      },
      get lineNumbers() {
        return that._lineNumbers;
      },
      set lineNumbers(value) {
        that._setLineNumbers(value);
      }
    };
  }
  _accept(source) {
    this._tabSize = source.tabSize;
    this._indentSize = source.indentSize;
    this._originalIndentSize = source.originalIndentSize;
    this._insertSpaces = source.insertSpaces;
    this._cursorStyle = source.cursorStyle;
    this._lineNumbers = TypeConverters.TextEditorLineNumbersStyle.to(source.lineNumbers);
  }
  // --- internal: tabSize
  _validateTabSize(value) {
    if (value === "auto") {
      return "auto";
    }
    if (typeof value === "number") {
      const r = Math.floor(value);
      return r > 0 ? r : null;
    }
    if (typeof value === "string") {
      const r = parseInt(value, 10);
      if (isNaN(r)) {
        return null;
      }
      return r > 0 ? r : null;
    }
    return null;
  }
  _setTabSize(value) {
    const tabSize = this._validateTabSize(value);
    if (tabSize === null) {
      return;
    }
    if (typeof tabSize === "number") {
      if (this._tabSize === tabSize) {
        return;
      }
      this._tabSize = tabSize;
    }
    this._warnOnError("setTabSize", this._proxy.$trySetOptions(this._id, {
      tabSize
    }));
  }
  // --- internal: indentSize
  _validateIndentSize(value) {
    if (value === "tabSize") {
      return "tabSize";
    }
    if (typeof value === "number") {
      const r = Math.floor(value);
      return r > 0 ? r : null;
    }
    if (typeof value === "string") {
      const r = parseInt(value, 10);
      if (isNaN(r)) {
        return null;
      }
      return r > 0 ? r : null;
    }
    return null;
  }
  _setIndentSize(value) {
    const indentSize = this._validateIndentSize(value);
    if (indentSize === null) {
      return;
    }
    if (typeof indentSize === "number") {
      if (this._originalIndentSize === indentSize) {
        return;
      }
      this._indentSize = indentSize;
      this._originalIndentSize = indentSize;
    }
    this._warnOnError("setIndentSize", this._proxy.$trySetOptions(this._id, {
      indentSize
    }));
  }
  // --- internal: insert spaces
  _validateInsertSpaces(value) {
    if (value === "auto") {
      return "auto";
    }
    return value === "false" ? false : Boolean(value);
  }
  _setInsertSpaces(value) {
    const insertSpaces = this._validateInsertSpaces(value);
    if (typeof insertSpaces === "boolean") {
      if (this._insertSpaces === insertSpaces) {
        return;
      }
      this._insertSpaces = insertSpaces;
    }
    this._warnOnError("setInsertSpaces", this._proxy.$trySetOptions(this._id, {
      insertSpaces
    }));
  }
  // --- internal: cursor style
  _setCursorStyle(value) {
    if (this._cursorStyle === value) {
      return;
    }
    this._cursorStyle = value;
    this._warnOnError("setCursorStyle", this._proxy.$trySetOptions(this._id, {
      cursorStyle: value
    }));
  }
  // --- internal: line number
  _setLineNumbers(value) {
    if (this._lineNumbers === value) {
      return;
    }
    this._lineNumbers = value;
    this._warnOnError("setLineNumbers", this._proxy.$trySetOptions(this._id, {
      lineNumbers: TypeConverters.TextEditorLineNumbersStyle.from(value)
    }));
  }
  assign(newOptions) {
    const bulkConfigurationUpdate = {};
    let hasUpdate = false;
    if (typeof newOptions.tabSize !== "undefined") {
      const tabSize = this._validateTabSize(newOptions.tabSize);
      if (tabSize === "auto") {
        hasUpdate = true;
        bulkConfigurationUpdate.tabSize = tabSize;
      } else if (typeof tabSize === "number" && this._tabSize !== tabSize) {
        this._tabSize = tabSize;
        hasUpdate = true;
        bulkConfigurationUpdate.tabSize = tabSize;
      }
    }
    if (typeof newOptions.indentSize !== "undefined") {
      const indentSize = this._validateIndentSize(newOptions.indentSize);
      if (indentSize === "tabSize") {
        hasUpdate = true;
        bulkConfigurationUpdate.indentSize = indentSize;
      } else if (typeof indentSize === "number" && this._originalIndentSize !== indentSize) {
        this._indentSize = indentSize;
        this._originalIndentSize = indentSize;
        hasUpdate = true;
        bulkConfigurationUpdate.indentSize = indentSize;
      }
    }
    if (typeof newOptions.insertSpaces !== "undefined") {
      const insertSpaces = this._validateInsertSpaces(newOptions.insertSpaces);
      if (insertSpaces === "auto") {
        hasUpdate = true;
        bulkConfigurationUpdate.insertSpaces = insertSpaces;
      } else if (this._insertSpaces !== insertSpaces) {
        this._insertSpaces = insertSpaces;
        hasUpdate = true;
        bulkConfigurationUpdate.insertSpaces = insertSpaces;
      }
    }
    if (typeof newOptions.cursorStyle !== "undefined") {
      if (this._cursorStyle !== newOptions.cursorStyle) {
        this._cursorStyle = newOptions.cursorStyle;
        hasUpdate = true;
        bulkConfigurationUpdate.cursorStyle = newOptions.cursorStyle;
      }
    }
    if (typeof newOptions.lineNumbers !== "undefined") {
      if (this._lineNumbers !== newOptions.lineNumbers) {
        this._lineNumbers = newOptions.lineNumbers;
        hasUpdate = true;
        bulkConfigurationUpdate.lineNumbers = TypeConverters.TextEditorLineNumbersStyle.from(newOptions.lineNumbers);
      }
    }
    if (hasUpdate) {
      this._warnOnError("setOptions", this._proxy.$trySetOptions(this._id, bulkConfigurationUpdate));
    }
  }
  _warnOnError(action, promise) {
    promise.catch((err) => {
      this._logService.warn(`ExtHostTextEditorOptions '${action}' failed:'`);
      this._logService.warn(err);
    });
  }
}
class ExtHostTextEditor {
  constructor(id, _proxy, _logService, document, selections, options, visibleRanges, viewColumn) {
    this.id = id;
    this._proxy = _proxy;
    this._logService = _logService;
    this._disposed = false;
    this._hasDecorationsForKey = /* @__PURE__ */ new Set();
    this._selections = selections;
    this._options = new ExtHostTextEditorOptions(this._proxy, this.id, options, _logService);
    this._visibleRanges = visibleRanges;
    this._viewColumn = viewColumn;
    const that = this;
    this.value = Object.freeze({
      get document() {
        return document.value;
      },
      set document(_value) {
        throw new ReadonlyError("document");
      },
      // --- selection
      get selection() {
        return that._selections && that._selections[0];
      },
      set selection(value) {
        if (!(value instanceof Selection)) {
          throw illegalArgument("selection");
        }
        that._selections = [value];
        that._trySetSelection();
      },
      get selections() {
        return that._selections;
      },
      set selections(value) {
        if (!Array.isArray(value) || value.some((a) => !(a instanceof Selection))) {
          throw illegalArgument("selections");
        }
        that._selections = value;
        that._trySetSelection();
      },
      // --- visible ranges
      get visibleRanges() {
        return that._visibleRanges;
      },
      set visibleRanges(_value) {
        throw new ReadonlyError("visibleRanges");
      },
      get diffInformation() {
        return that._diffInformation;
      },
      // --- options
      get options() {
        return that._options.value;
      },
      set options(value) {
        if (!that._disposed) {
          that._options.assign(value);
        }
      },
      // --- view column
      get viewColumn() {
        return that._viewColumn;
      },
      set viewColumn(_value) {
        throw new ReadonlyError("viewColumn");
      },
      // --- edit
      edit(callback, options2 = { undoStopBefore: true, undoStopAfter: true }) {
        if (that._disposed) {
          return Promise.reject(new Error("TextEditor#edit not possible on closed editors"));
        }
        const edit = new TextEditorEdit(document.value, options2);
        callback(edit);
        return that._applyEdit(edit);
      },
      // --- snippet edit
      insertSnippet(snippet, where, options2 = { undoStopBefore: true, undoStopAfter: true }) {
        if (that._disposed) {
          return Promise.reject(new Error("TextEditor#insertSnippet not possible on closed editors"));
        }
        let ranges;
        if (!where || Array.isArray(where) && where.length === 0) {
          ranges = that._selections.map((range) => TypeConverters.Range.from(range));
        } else if (where instanceof Position) {
          const { lineNumber, column } = TypeConverters.Position.from(where);
          ranges = [{ startLineNumber: lineNumber, startColumn: column, endLineNumber: lineNumber, endColumn: column }];
        } else if (where instanceof Range) {
          ranges = [TypeConverters.Range.from(where)];
        } else {
          ranges = [];
          for (const posOrRange of where) {
            if (posOrRange instanceof Range) {
              ranges.push(TypeConverters.Range.from(posOrRange));
            } else {
              const { lineNumber, column } = TypeConverters.Position.from(posOrRange);
              ranges.push({ startLineNumber: lineNumber, startColumn: column, endLineNumber: lineNumber, endColumn: column });
            }
          }
        }
        if (options2.keepWhitespace === void 0) {
          options2.keepWhitespace = false;
        }
        return _proxy.$tryInsertSnippet(id, document.value.version, snippet.value, ranges, options2);
      },
      setDecorations(decorationType, ranges) {
        const willBeEmpty = ranges.length === 0;
        if (willBeEmpty && !that._hasDecorationsForKey.has(decorationType.key)) {
          return;
        }
        if (willBeEmpty) {
          that._hasDecorationsForKey.delete(decorationType.key);
        } else {
          that._hasDecorationsForKey.add(decorationType.key);
        }
        that._runOnProxy(() => {
          if (TypeConverters.isDecorationOptionsArr(ranges)) {
            return _proxy.$trySetDecorations(
              id,
              decorationType.key,
              TypeConverters.fromRangeOrRangeWithMessage(ranges)
            );
          } else {
            const _ranges = new Array(4 * ranges.length);
            for (let i = 0, len = ranges.length; i < len; i++) {
              const range = ranges[i];
              _ranges[4 * i] = range.start.line + 1;
              _ranges[4 * i + 1] = range.start.character + 1;
              _ranges[4 * i + 2] = range.end.line + 1;
              _ranges[4 * i + 3] = range.end.character + 1;
            }
            return _proxy.$trySetDecorationsFast(
              id,
              decorationType.key,
              _ranges
            );
          }
        });
      },
      revealRange(range, revealType) {
        that._runOnProxy(() => _proxy.$tryRevealRange(
          id,
          TypeConverters.Range.from(range),
          revealType || TextEditorRevealType.Default
        ));
      },
      show(column) {
        _proxy.$tryShowEditor(id, TypeConverters.ViewColumn.from(column));
      },
      hide() {
        _proxy.$tryHideEditor(id);
      },
      [Symbol.for("debug.description")]() {
        return `TextEditor(${this.document.uri.toString()})`;
      }
    });
  }
  dispose() {
    ok(!this._disposed);
    this._disposed = true;
  }
  // --- incoming: extension host MUST accept what the renderer says
  _acceptOptions(options) {
    ok(!this._disposed);
    this._options._accept(options);
  }
  _acceptVisibleRanges(value) {
    ok(!this._disposed);
    this._visibleRanges = value;
  }
  _acceptViewColumn(value) {
    ok(!this._disposed);
    this._viewColumn = value;
  }
  _acceptSelections(selections) {
    ok(!this._disposed);
    this._selections = selections;
  }
  _acceptDiffInformation(diffInformation) {
    ok(!this._disposed);
    this._diffInformation = diffInformation;
  }
  async _trySetSelection() {
    const selection = this._selections.map(TypeConverters.Selection.from);
    await this._runOnProxy(() => this._proxy.$trySetSelections(this.id, selection));
    return this.value;
  }
  _applyEdit(editBuilder) {
    const editData = editBuilder.finalize();
    if (editData.edits.length === 0 && !editData.setEndOfLine) {
      return Promise.resolve(true);
    }
    const editRanges = editData.edits.map((edit) => edit.range);
    editRanges.sort((a, b) => {
      if (a.end.line === b.end.line) {
        if (a.end.character === b.end.character) {
          if (a.start.line === b.start.line) {
            return a.start.character - b.start.character;
          }
          return a.start.line - b.start.line;
        }
        return a.end.character - b.end.character;
      }
      return a.end.line - b.end.line;
    });
    for (let i = 0, count = editRanges.length - 1; i < count; i++) {
      const rangeEnd = editRanges[i].end;
      const nextRangeStart = editRanges[i + 1].start;
      if (nextRangeStart.isBefore(rangeEnd)) {
        return Promise.reject(
          new Error("Overlapping ranges are not allowed!")
        );
      }
    }
    const edits = editData.edits.map((edit) => {
      return {
        range: TypeConverters.Range.from(edit.range),
        text: edit.text,
        forceMoveMarkers: edit.forceMoveMarkers
      };
    });
    return this._proxy.$tryApplyEdits(this.id, editData.documentVersionId, edits, {
      setEndOfLine: typeof editData.setEndOfLine === "number" ? TypeConverters.EndOfLine.from(editData.setEndOfLine) : void 0,
      undoStopBefore: editData.undoStopBefore,
      undoStopAfter: editData.undoStopAfter
    });
  }
  _runOnProxy(callback) {
    if (this._disposed) {
      this._logService.warn("TextEditor is closed/disposed");
      return Promise.resolve(void 0);
    }
    return callback().then(() => this, (err) => {
      if (!(err instanceof Error && err.name === "DISPOSED")) {
        this._logService.warn(err);
      }
      return null;
    });
  }
}
export {
  ExtHostTextEditor,
  ExtHostTextEditorOptions,
  TextEditorDecorationType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGV4dEVkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG9rIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IFJlYWRvbmx5RXJyb3IsIGlsbGVnYWxBcmd1bWVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJZEdlbmVyYXRvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2lkR2VuZXJhdG9yLmpzJztcbmltcG9ydCB7IFRleHRFZGl0b3JDdXJzb3JTdHlsZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvckNvbmZpZ3VyYXRpb24sIElUZXh0RWRpdG9yQ29uZmlndXJhdGlvblVwZGF0ZSwgTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0ICogYXMgVHlwZUNvbnZlcnRlcnMgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lLCBQb3NpdGlvbiwgUmFuZ2UsIFNlbGVjdGlvbiwgU25pcHBldFN0cmluZywgVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUsIFRleHRFZGl0b3JSZXZlYWxUeXBlIH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9LZXlzID0gbmV3IElkR2VuZXJhdG9yKCdUZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUnKTtcblxuXHRyZWFkb25seSB2YWx1ZTogdnNjb2RlLlRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTtcblxuXHRjb25zdHJ1Y3Rvcihwcm94eTogTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGUsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBvcHRpb25zOiB2c2NvZGUuRGVjb3JhdGlvblJlbmRlck9wdGlvbnMpIHtcblx0XHRjb25zdCBrZXkgPSBUZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUuX0tleXMubmV4dElkKCk7XG5cdFx0cHJveHkuJHJlZ2lzdGVyVGV4dEVkaXRvckRlY29yYXRpb25UeXBlKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBrZXksIFR5cGVDb252ZXJ0ZXJzLkRlY29yYXRpb25SZW5kZXJPcHRpb25zLmZyb20ob3B0aW9ucykpO1xuXHRcdHRoaXMudmFsdWUgPSBPYmplY3QuZnJlZXplKHtcblx0XHRcdGtleSxcblx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdHByb3h5LiRyZW1vdmVUZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUoa2V5KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRFZGl0T3BlcmF0aW9uIHtcblx0cmFuZ2U6IHZzY29kZS5SYW5nZTtcblx0dGV4dDogc3RyaW5nIHwgbnVsbDtcblx0Zm9yY2VNb3ZlTWFya2VyczogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdERhdGEge1xuXHRkb2N1bWVudFZlcnNpb25JZDogbnVtYmVyO1xuXHRlZGl0czogSVRleHRFZGl0T3BlcmF0aW9uW107XG5cdHNldEVuZE9mTGluZTogRW5kT2ZMaW5lIHwgdW5kZWZpbmVkO1xuXHR1bmRvU3RvcEJlZm9yZTogYm9vbGVhbjtcblx0dW5kb1N0b3BBZnRlcjogYm9vbGVhbjtcbn1cblxuY2xhc3MgVGV4dEVkaXRvckVkaXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudFZlcnNpb25JZDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91bmRvU3RvcEJlZm9yZTogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1N0b3BBZnRlcjogYm9vbGVhbjtcblx0cHJpdmF0ZSBfY29sbGVjdGVkRWRpdHM6IElUZXh0RWRpdE9wZXJhdGlvbltdID0gW107XG5cdHByaXZhdGUgX3NldEVuZE9mTGluZTogRW5kT2ZMaW5lIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9maW5hbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgb3B0aW9uczogeyB1bmRvU3RvcEJlZm9yZTogYm9vbGVhbjsgdW5kb1N0b3BBZnRlcjogYm9vbGVhbiB9KSB7XG5cdFx0dGhpcy5fZG9jdW1lbnQgPSBkb2N1bWVudDtcblx0XHR0aGlzLl9kb2N1bWVudFZlcnNpb25JZCA9IGRvY3VtZW50LnZlcnNpb247XG5cdFx0dGhpcy5fdW5kb1N0b3BCZWZvcmUgPSBvcHRpb25zLnVuZG9TdG9wQmVmb3JlO1xuXHRcdHRoaXMuX3VuZG9TdG9wQWZ0ZXIgPSBvcHRpb25zLnVuZG9TdG9wQWZ0ZXI7XG5cdH1cblxuXHRmaW5hbGl6ZSgpOiBJRWRpdERhdGEge1xuXHRcdHRoaXMuX2ZpbmFsaXplZCA9IHRydWU7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRvY3VtZW50VmVyc2lvbklkOiB0aGlzLl9kb2N1bWVudFZlcnNpb25JZCxcblx0XHRcdGVkaXRzOiB0aGlzLl9jb2xsZWN0ZWRFZGl0cyxcblx0XHRcdHNldEVuZE9mTGluZTogdGhpcy5fc2V0RW5kT2ZMaW5lLFxuXHRcdFx0dW5kb1N0b3BCZWZvcmU6IHRoaXMuX3VuZG9TdG9wQmVmb3JlLFxuXHRcdFx0dW5kb1N0b3BBZnRlcjogdGhpcy5fdW5kb1N0b3BBZnRlclxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF90aHJvd0lmRmluYWxpemVkKCkge1xuXHRcdGlmICh0aGlzLl9maW5hbGl6ZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRWRpdCBpcyBvbmx5IHZhbGlkIHdoaWxlIGNhbGxiYWNrIHJ1bnMnKTtcblx0XHR9XG5cdH1cblxuXHRyZXBsYWNlKGxvY2F0aW9uOiBQb3NpdGlvbiB8IFJhbmdlIHwgU2VsZWN0aW9uLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fdGhyb3dJZkZpbmFsaXplZCgpO1xuXHRcdGxldCByYW5nZTogUmFuZ2UgfCBudWxsID0gbnVsbDtcblxuXHRcdGlmIChsb2NhdGlvbiBpbnN0YW5jZW9mIFBvc2l0aW9uKSB7XG5cdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShsb2NhdGlvbiwgbG9jYXRpb24pO1xuXHRcdH0gZWxzZSBpZiAobG9jYXRpb24gaW5zdGFuY2VvZiBSYW5nZSkge1xuXHRcdFx0cmFuZ2UgPSBsb2NhdGlvbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbnJlY29nbml6ZWQgbG9jYXRpb24nKTtcblx0XHR9XG5cblx0XHR0aGlzLl9wdXNoRWRpdChyYW5nZSwgdmFsdWUsIGZhbHNlKTtcblx0fVxuXG5cdGluc2VydChsb2NhdGlvbjogUG9zaXRpb24sIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl90aHJvd0lmRmluYWxpemVkKCk7XG5cdFx0dGhpcy5fcHVzaEVkaXQobmV3IFJhbmdlKGxvY2F0aW9uLCBsb2NhdGlvbiksIHZhbHVlLCB0cnVlKTtcblx0fVxuXG5cdGRlbGV0ZShsb2NhdGlvbjogUmFuZ2UgfCBTZWxlY3Rpb24pOiB2b2lkIHtcblx0XHR0aGlzLl90aHJvd0lmRmluYWxpemVkKCk7XG5cdFx0bGV0IHJhbmdlOiBSYW5nZSB8IG51bGwgPSBudWxsO1xuXG5cdFx0aWYgKGxvY2F0aW9uIGluc3RhbmNlb2YgUmFuZ2UpIHtcblx0XHRcdHJhbmdlID0gbG9jYXRpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5yZWNvZ25pemVkIGxvY2F0aW9uJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHVzaEVkaXQocmFuZ2UsIG51bGwsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHVzaEVkaXQocmFuZ2U6IFJhbmdlLCB0ZXh0OiBzdHJpbmcgfCBudWxsLCBmb3JjZU1vdmVNYXJrZXJzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgdmFsaWRSYW5nZSA9IHRoaXMuX2RvY3VtZW50LnZhbGlkYXRlUmFuZ2UocmFuZ2UpO1xuXHRcdHRoaXMuX2NvbGxlY3RlZEVkaXRzLnB1c2goe1xuXHRcdFx0cmFuZ2U6IHZhbGlkUmFuZ2UsXG5cdFx0XHR0ZXh0OiB0ZXh0LFxuXHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogZm9yY2VNb3ZlTWFya2Vyc1xuXHRcdH0pO1xuXHR9XG5cblx0c2V0RW5kT2ZMaW5lKGVuZE9mTGluZTogRW5kT2ZMaW5lKTogdm9pZCB7XG5cdFx0dGhpcy5fdGhyb3dJZkZpbmFsaXplZCgpO1xuXHRcdGlmIChlbmRPZkxpbmUgIT09IEVuZE9mTGluZS5MRiAmJiBlbmRPZkxpbmUgIT09IEVuZE9mTGluZS5DUkxGKSB7XG5cdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ2VuZE9mTGluZScpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NldEVuZE9mTGluZSA9IGVuZE9mTGluZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFRleHRFZGl0b3JPcHRpb25zIHtcblxuXHRwcml2YXRlIF9wcm94eTogTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGU7XG5cdHByaXZhdGUgX2lkOiBzdHJpbmc7XG5cdHByaXZhdGUgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlO1xuXG5cdHByaXZhdGUgX3RhYlNpemUhOiBudW1iZXI7XG5cdHByaXZhdGUgX2luZGVudFNpemUhOiBudW1iZXI7XG5cdHByaXZhdGUgX29yaWdpbmFsSW5kZW50U2l6ZSE6IG51bWJlciB8ICd0YWJTaXplJztcblx0cHJpdmF0ZSBfaW5zZXJ0U3BhY2VzITogYm9vbGVhbjtcblx0cHJpdmF0ZSBfY3Vyc29yU3R5bGUhOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGU7XG5cdHByaXZhdGUgX2xpbmVOdW1iZXJzITogVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGU7XG5cblx0cmVhZG9ubHkgdmFsdWU6IHZzY29kZS5UZXh0RWRpdG9yT3B0aW9ucztcblxuXHRjb25zdHJ1Y3Rvcihwcm94eTogTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGUsIGlkOiBzdHJpbmcsIHNvdXJjZTogSVJlc29sdmVkVGV4dEVkaXRvckNvbmZpZ3VyYXRpb24sIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKSB7XG5cdFx0dGhpcy5fcHJveHkgPSBwcm94eTtcblx0XHR0aGlzLl9pZCA9IGlkO1xuXHRcdHRoaXMuX2FjY2VwdChzb3VyY2UpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UgPSBsb2dTZXJ2aWNlO1xuXG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0XHR0aGlzLnZhbHVlID0ge1xuXHRcdFx0Z2V0IHRhYlNpemUoKTogbnVtYmVyIHwgc3RyaW5nIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3RhYlNpemU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHRhYlNpemUodmFsdWU6IG51bWJlciB8IHN0cmluZykge1xuXHRcdFx0XHR0aGF0Ll9zZXRUYWJTaXplKHZhbHVlKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgaW5kZW50U2l6ZSgpOiBudW1iZXIgfCBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5faW5kZW50U2l6ZTtcblx0XHRcdH0sXG5cdFx0XHRzZXQgaW5kZW50U2l6ZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKSB7XG5cdFx0XHRcdHRoYXQuX3NldEluZGVudFNpemUodmFsdWUpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBpbnNlcnRTcGFjZXMoKTogYm9vbGVhbiB8IHN0cmluZyB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9pbnNlcnRTcGFjZXM7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGluc2VydFNwYWNlcyh2YWx1ZTogYm9vbGVhbiB8IHN0cmluZykge1xuXHRcdFx0XHR0aGF0Ll9zZXRJbnNlcnRTcGFjZXModmFsdWUpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBjdXJzb3JTdHlsZSgpOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fY3Vyc29yU3R5bGU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGN1cnNvclN0eWxlKHZhbHVlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUpIHtcblx0XHRcdFx0dGhhdC5fc2V0Q3Vyc29yU3R5bGUodmFsdWUpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBsaW5lTnVtYmVycygpOiBUZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9saW5lTnVtYmVycztcblx0XHRcdH0sXG5cdFx0XHRzZXQgbGluZU51bWJlcnModmFsdWU6IFRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlKSB7XG5cdFx0XHRcdHRoYXQuX3NldExpbmVOdW1iZXJzKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHVibGljIF9hY2NlcHQoc291cmNlOiBJUmVzb2x2ZWRUZXh0RWRpdG9yQ29uZmlndXJhdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX3RhYlNpemUgPSBzb3VyY2UudGFiU2l6ZTtcblx0XHR0aGlzLl9pbmRlbnRTaXplID0gc291cmNlLmluZGVudFNpemU7XG5cdFx0dGhpcy5fb3JpZ2luYWxJbmRlbnRTaXplID0gc291cmNlLm9yaWdpbmFsSW5kZW50U2l6ZTtcblx0XHR0aGlzLl9pbnNlcnRTcGFjZXMgPSBzb3VyY2UuaW5zZXJ0U3BhY2VzO1xuXHRcdHRoaXMuX2N1cnNvclN0eWxlID0gc291cmNlLmN1cnNvclN0eWxlO1xuXHRcdHRoaXMuX2xpbmVOdW1iZXJzID0gVHlwZUNvbnZlcnRlcnMuVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUudG8oc291cmNlLmxpbmVOdW1iZXJzKTtcblx0fVxuXG5cdC8vIC0tLSBpbnRlcm5hbDogdGFiU2l6ZVxuXG5cdHByaXZhdGUgX3ZhbGlkYXRlVGFiU2l6ZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogbnVtYmVyIHwgJ2F1dG8nIHwgbnVsbCB7XG5cdFx0aWYgKHZhbHVlID09PSAnYXV0bycpIHtcblx0XHRcdHJldHVybiAnYXV0byc7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCByID0gTWF0aC5mbG9vcih2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gKHIgPiAwID8gciA6IG51bGwpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgciA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XG5cdFx0XHRpZiAoaXNOYU4ocikpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gKHIgPiAwID8gciA6IG51bGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgX3NldFRhYlNpemUodmFsdWU6IG51bWJlciB8IHN0cmluZykge1xuXHRcdGNvbnN0IHRhYlNpemUgPSB0aGlzLl92YWxpZGF0ZVRhYlNpemUodmFsdWUpO1xuXHRcdGlmICh0YWJTaXplID09PSBudWxsKSB7XG5cdFx0XHQvLyBpZ25vcmUgaW52YWxpZCBjYWxsXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdGFiU2l6ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGlmICh0aGlzLl90YWJTaXplID09PSB0YWJTaXplKSB7XG5cdFx0XHRcdC8vIG5vdGhpbmcgdG8gZG9cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gcmVmbGVjdCB0aGUgbmV3IHRhYlNpemUgdmFsdWUgaW1tZWRpYXRlbHlcblx0XHRcdHRoaXMuX3RhYlNpemUgPSB0YWJTaXplO1xuXHRcdH1cblx0XHR0aGlzLl93YXJuT25FcnJvcignc2V0VGFiU2l6ZScsIHRoaXMuX3Byb3h5LiR0cnlTZXRPcHRpb25zKHRoaXMuX2lkLCB7XG5cdFx0XHR0YWJTaXplOiB0YWJTaXplXG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tIGludGVybmFsOiBpbmRlbnRTaXplXG5cblx0cHJpdmF0ZSBfdmFsaWRhdGVJbmRlbnRTaXplKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiBudW1iZXIgfCAndGFiU2l6ZScgfCBudWxsIHtcblx0XHRpZiAodmFsdWUgPT09ICd0YWJTaXplJykge1xuXHRcdFx0cmV0dXJuICd0YWJTaXplJztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IHIgPSBNYXRoLmZsb29yKHZhbHVlKTtcblx0XHRcdHJldHVybiAociA+IDAgPyByIDogbnVsbCk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb25zdCByID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcblx0XHRcdGlmIChpc05hTihyKSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiAociA+IDAgPyByIDogbnVsbCk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0SW5kZW50U2l6ZSh2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKSB7XG5cdFx0Y29uc3QgaW5kZW50U2l6ZSA9IHRoaXMuX3ZhbGlkYXRlSW5kZW50U2l6ZSh2YWx1ZSk7XG5cdFx0aWYgKGluZGVudFNpemUgPT09IG51bGwpIHtcblx0XHRcdC8vIGlnbm9yZSBpbnZhbGlkIGNhbGxcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBpbmRlbnRTaXplID09PSAnbnVtYmVyJykge1xuXHRcdFx0aWYgKHRoaXMuX29yaWdpbmFsSW5kZW50U2l6ZSA9PT0gaW5kZW50U2l6ZSkge1xuXHRcdFx0XHQvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIHJlZmxlY3QgdGhlIG5ldyBpbmRlbnRTaXplIHZhbHVlIGltbWVkaWF0ZWx5XG5cdFx0XHR0aGlzLl9pbmRlbnRTaXplID0gaW5kZW50U2l6ZTtcblx0XHRcdHRoaXMuX29yaWdpbmFsSW5kZW50U2l6ZSA9IGluZGVudFNpemU7XG5cdFx0fVxuXHRcdHRoaXMuX3dhcm5PbkVycm9yKCdzZXRJbmRlbnRTaXplJywgdGhpcy5fcHJveHkuJHRyeVNldE9wdGlvbnModGhpcy5faWQsIHtcblx0XHRcdGluZGVudFNpemU6IGluZGVudFNpemVcblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gaW50ZXJuYWw6IGluc2VydCBzcGFjZXNcblxuXHRwcml2YXRlIF92YWxpZGF0ZUluc2VydFNwYWNlcyh2YWx1ZTogYm9vbGVhbiB8IHN0cmluZyk6IGJvb2xlYW4gfCAnYXV0bycge1xuXHRcdGlmICh2YWx1ZSA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gJ2F1dG8nO1xuXHRcdH1cblx0XHRyZXR1cm4gKHZhbHVlID09PSAnZmFsc2UnID8gZmFsc2UgOiBCb29sZWFuKHZhbHVlKSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRJbnNlcnRTcGFjZXModmFsdWU6IGJvb2xlYW4gfCBzdHJpbmcpIHtcblx0XHRjb25zdCBpbnNlcnRTcGFjZXMgPSB0aGlzLl92YWxpZGF0ZUluc2VydFNwYWNlcyh2YWx1ZSk7XG5cdFx0aWYgKHR5cGVvZiBpbnNlcnRTcGFjZXMgPT09ICdib29sZWFuJykge1xuXHRcdFx0aWYgKHRoaXMuX2luc2VydFNwYWNlcyA9PT0gaW5zZXJ0U3BhY2VzKSB7XG5cdFx0XHRcdC8vIG5vdGhpbmcgdG8gZG9cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gcmVmbGVjdCB0aGUgbmV3IGluc2VydFNwYWNlcyB2YWx1ZSBpbW1lZGlhdGVseVxuXHRcdFx0dGhpcy5faW5zZXJ0U3BhY2VzID0gaW5zZXJ0U3BhY2VzO1xuXHRcdH1cblx0XHR0aGlzLl93YXJuT25FcnJvcignc2V0SW5zZXJ0U3BhY2VzJywgdGhpcy5fcHJveHkuJHRyeVNldE9wdGlvbnModGhpcy5faWQsIHtcblx0XHRcdGluc2VydFNwYWNlczogaW5zZXJ0U3BhY2VzXG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tIGludGVybmFsOiBjdXJzb3Igc3R5bGVcblxuXHRwcml2YXRlIF9zZXRDdXJzb3JTdHlsZSh2YWx1ZTogVGV4dEVkaXRvckN1cnNvclN0eWxlKSB7XG5cdFx0aWYgKHRoaXMuX2N1cnNvclN0eWxlID09PSB2YWx1ZSkge1xuXHRcdFx0Ly8gbm90aGluZyB0byBkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jdXJzb3JTdHlsZSA9IHZhbHVlO1xuXHRcdHRoaXMuX3dhcm5PbkVycm9yKCdzZXRDdXJzb3JTdHlsZScsIHRoaXMuX3Byb3h5LiR0cnlTZXRPcHRpb25zKHRoaXMuX2lkLCB7XG5cdFx0XHRjdXJzb3JTdHlsZTogdmFsdWVcblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gaW50ZXJuYWw6IGxpbmUgbnVtYmVyXG5cblx0cHJpdmF0ZSBfc2V0TGluZU51bWJlcnModmFsdWU6IFRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlKSB7XG5cdFx0aWYgKHRoaXMuX2xpbmVOdW1iZXJzID09PSB2YWx1ZSkge1xuXHRcdFx0Ly8gbm90aGluZyB0byBkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9saW5lTnVtYmVycyA9IHZhbHVlO1xuXHRcdHRoaXMuX3dhcm5PbkVycm9yKCdzZXRMaW5lTnVtYmVycycsIHRoaXMuX3Byb3h5LiR0cnlTZXRPcHRpb25zKHRoaXMuX2lkLCB7XG5cdFx0XHRsaW5lTnVtYmVyczogVHlwZUNvbnZlcnRlcnMuVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUuZnJvbSh2YWx1ZSlcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgYXNzaWduKG5ld09wdGlvbnM6IHZzY29kZS5UZXh0RWRpdG9yT3B0aW9ucykge1xuXHRcdGNvbnN0IGJ1bGtDb25maWd1cmF0aW9uVXBkYXRlOiBJVGV4dEVkaXRvckNvbmZpZ3VyYXRpb25VcGRhdGUgPSB7fTtcblx0XHRsZXQgaGFzVXBkYXRlID0gZmFsc2U7XG5cblx0XHRpZiAodHlwZW9mIG5ld09wdGlvbnMudGFiU2l6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGNvbnN0IHRhYlNpemUgPSB0aGlzLl92YWxpZGF0ZVRhYlNpemUobmV3T3B0aW9ucy50YWJTaXplKTtcblx0XHRcdGlmICh0YWJTaXplID09PSAnYXV0bycpIHtcblx0XHRcdFx0aGFzVXBkYXRlID0gdHJ1ZTtcblx0XHRcdFx0YnVsa0NvbmZpZ3VyYXRpb25VcGRhdGUudGFiU2l6ZSA9IHRhYlNpemU7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0YWJTaXplID09PSAnbnVtYmVyJyAmJiB0aGlzLl90YWJTaXplICE9PSB0YWJTaXplKSB7XG5cdFx0XHRcdC8vIHJlZmxlY3QgdGhlIG5ldyB0YWJTaXplIHZhbHVlIGltbWVkaWF0ZWx5XG5cdFx0XHRcdHRoaXMuX3RhYlNpemUgPSB0YWJTaXplO1xuXHRcdFx0XHRoYXNVcGRhdGUgPSB0cnVlO1xuXHRcdFx0XHRidWxrQ29uZmlndXJhdGlvblVwZGF0ZS50YWJTaXplID0gdGFiU2l6ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG5ld09wdGlvbnMuaW5kZW50U2l6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGNvbnN0IGluZGVudFNpemUgPSB0aGlzLl92YWxpZGF0ZUluZGVudFNpemUobmV3T3B0aW9ucy5pbmRlbnRTaXplKTtcblx0XHRcdGlmIChpbmRlbnRTaXplID09PSAndGFiU2l6ZScpIHtcblx0XHRcdFx0aGFzVXBkYXRlID0gdHJ1ZTtcblx0XHRcdFx0YnVsa0NvbmZpZ3VyYXRpb25VcGRhdGUuaW5kZW50U2l6ZSA9IGluZGVudFNpemU7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBpbmRlbnRTaXplID09PSAnbnVtYmVyJyAmJiB0aGlzLl9vcmlnaW5hbEluZGVudFNpemUgIT09IGluZGVudFNpemUpIHtcblx0XHRcdFx0Ly8gcmVmbGVjdCB0aGUgbmV3IGluZGVudFNpemUgdmFsdWUgaW1tZWRpYXRlbHlcblx0XHRcdFx0dGhpcy5faW5kZW50U2l6ZSA9IGluZGVudFNpemU7XG5cdFx0XHRcdHRoaXMuX29yaWdpbmFsSW5kZW50U2l6ZSA9IGluZGVudFNpemU7XG5cdFx0XHRcdGhhc1VwZGF0ZSA9IHRydWU7XG5cdFx0XHRcdGJ1bGtDb25maWd1cmF0aW9uVXBkYXRlLmluZGVudFNpemUgPSBpbmRlbnRTaXplO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgbmV3T3B0aW9ucy5pbnNlcnRTcGFjZXMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRjb25zdCBpbnNlcnRTcGFjZXMgPSB0aGlzLl92YWxpZGF0ZUluc2VydFNwYWNlcyhuZXdPcHRpb25zLmluc2VydFNwYWNlcyk7XG5cdFx0XHRpZiAoaW5zZXJ0U3BhY2VzID09PSAnYXV0bycpIHtcblx0XHRcdFx0aGFzVXBkYXRlID0gdHJ1ZTtcblx0XHRcdFx0YnVsa0NvbmZpZ3VyYXRpb25VcGRhdGUuaW5zZXJ0U3BhY2VzID0gaW5zZXJ0U3BhY2VzO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9pbnNlcnRTcGFjZXMgIT09IGluc2VydFNwYWNlcykge1xuXHRcdFx0XHQvLyByZWZsZWN0IHRoZSBuZXcgaW5zZXJ0U3BhY2VzIHZhbHVlIGltbWVkaWF0ZWx5XG5cdFx0XHRcdHRoaXMuX2luc2VydFNwYWNlcyA9IGluc2VydFNwYWNlcztcblx0XHRcdFx0aGFzVXBkYXRlID0gdHJ1ZTtcblx0XHRcdFx0YnVsa0NvbmZpZ3VyYXRpb25VcGRhdGUuaW5zZXJ0U3BhY2VzID0gaW5zZXJ0U3BhY2VzO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgbmV3T3B0aW9ucy5jdXJzb3JTdHlsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGlmICh0aGlzLl9jdXJzb3JTdHlsZSAhPT0gbmV3T3B0aW9ucy5jdXJzb3JTdHlsZSkge1xuXHRcdFx0XHR0aGlzLl9jdXJzb3JTdHlsZSA9IG5ld09wdGlvbnMuY3Vyc29yU3R5bGU7XG5cdFx0XHRcdGhhc1VwZGF0ZSA9IHRydWU7XG5cdFx0XHRcdGJ1bGtDb25maWd1cmF0aW9uVXBkYXRlLmN1cnNvclN0eWxlID0gbmV3T3B0aW9ucy5jdXJzb3JTdHlsZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG5ld09wdGlvbnMubGluZU51bWJlcnMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRpZiAodGhpcy5fbGluZU51bWJlcnMgIT09IG5ld09wdGlvbnMubGluZU51bWJlcnMpIHtcblx0XHRcdFx0dGhpcy5fbGluZU51bWJlcnMgPSBuZXdPcHRpb25zLmxpbmVOdW1iZXJzO1xuXHRcdFx0XHRoYXNVcGRhdGUgPSB0cnVlO1xuXHRcdFx0XHRidWxrQ29uZmlndXJhdGlvblVwZGF0ZS5saW5lTnVtYmVycyA9IFR5cGVDb252ZXJ0ZXJzLlRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlLmZyb20obmV3T3B0aW9ucy5saW5lTnVtYmVycyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGhhc1VwZGF0ZSkge1xuXHRcdFx0dGhpcy5fd2Fybk9uRXJyb3IoJ3NldE9wdGlvbnMnLCB0aGlzLl9wcm94eS4kdHJ5U2V0T3B0aW9ucyh0aGlzLl9pZCwgYnVsa0NvbmZpZ3VyYXRpb25VcGRhdGUpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF93YXJuT25FcnJvcihhY3Rpb246IHN0cmluZywgcHJvbWlzZTogUHJvbWlzZTxhbnk+KTogdm9pZCB7XG5cdFx0cHJvbWlzZS5jYXRjaChlcnIgPT4ge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKGBFeHRIb3N0VGV4dEVkaXRvck9wdGlvbnMgJyR7YWN0aW9ufScgZmFpbGVkOidgKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihlcnIpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0VGV4dEVkaXRvciB7XG5cblx0cHJpdmF0ZSBfc2VsZWN0aW9uczogU2VsZWN0aW9uW107XG5cdHByaXZhdGUgX29wdGlvbnM6IEV4dEhvc3RUZXh0RWRpdG9yT3B0aW9ucztcblx0cHJpdmF0ZSBfdmlzaWJsZVJhbmdlczogUmFuZ2VbXTtcblx0cHJpdmF0ZSBfdmlld0NvbHVtbjogdnNjb2RlLlZpZXdDb2x1bW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2Rpc3Bvc2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2hhc0RlY29yYXRpb25zRm9yS2V5ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgX2RpZmZJbmZvcm1hdGlvbjogdnNjb2RlLlRleHRFZGl0b3JEaWZmSW5mb3JtYXRpb25bXSB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSB2YWx1ZTogdnNjb2RlLlRleHRFZGl0b3I7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogTWFpblRocmVhZFRleHRFZGl0b3JzU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0ZG9jdW1lbnQ6IExhenk8dnNjb2RlLlRleHREb2N1bWVudD4sXG5cdFx0c2VsZWN0aW9uczogU2VsZWN0aW9uW10sIG9wdGlvbnM6IElSZXNvbHZlZFRleHRFZGl0b3JDb25maWd1cmF0aW9uLFxuXHRcdHZpc2libGVSYW5nZXM6IFJhbmdlW10sIHZpZXdDb2x1bW46IHZzY29kZS5WaWV3Q29sdW1uIHwgdW5kZWZpbmVkXG5cdCkge1xuXHRcdHRoaXMuX3NlbGVjdGlvbnMgPSBzZWxlY3Rpb25zO1xuXHRcdHRoaXMuX29wdGlvbnMgPSBuZXcgRXh0SG9zdFRleHRFZGl0b3JPcHRpb25zKHRoaXMuX3Byb3h5LCB0aGlzLmlkLCBvcHRpb25zLCBfbG9nU2VydmljZSk7XG5cdFx0dGhpcy5fdmlzaWJsZVJhbmdlcyA9IHZpc2libGVSYW5nZXM7XG5cdFx0dGhpcy5fdmlld0NvbHVtbiA9IHZpZXdDb2x1bW47XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdHRoaXMudmFsdWUgPSBPYmplY3QuZnJlZXplKHtcblx0XHRcdGdldCBkb2N1bWVudCgpOiB2c2NvZGUuVGV4dERvY3VtZW50IHtcblx0XHRcdFx0cmV0dXJuIGRvY3VtZW50LnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHNldCBkb2N1bWVudChfdmFsdWUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFJlYWRvbmx5RXJyb3IoJ2RvY3VtZW50Jyk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tIHNlbGVjdGlvblxuXHRcdFx0Z2V0IHNlbGVjdGlvbigpOiBTZWxlY3Rpb24ge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fc2VsZWN0aW9ucyAmJiB0aGF0Ll9zZWxlY3Rpb25zWzBdO1xuXHRcdFx0fSxcblx0XHRcdHNldCBzZWxlY3Rpb24odmFsdWU6IFNlbGVjdGlvbikge1xuXHRcdFx0XHRpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIFNlbGVjdGlvbikpIHtcblx0XHRcdFx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoJ3NlbGVjdGlvbicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoYXQuX3NlbGVjdGlvbnMgPSBbdmFsdWVdO1xuXHRcdFx0XHR0aGF0Ll90cnlTZXRTZWxlY3Rpb24oKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgc2VsZWN0aW9ucygpOiBTZWxlY3Rpb25bXSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9zZWxlY3Rpb25zO1xuXHRcdFx0fSxcblx0XHRcdHNldCBzZWxlY3Rpb25zKHZhbHVlOiBTZWxlY3Rpb25bXSkge1xuXHRcdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpIHx8IHZhbHVlLnNvbWUoYSA9PiAhKGEgaW5zdGFuY2VvZiBTZWxlY3Rpb24pKSkge1xuXHRcdFx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnc2VsZWN0aW9ucycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoYXQuX3NlbGVjdGlvbnMgPSB2YWx1ZTtcblx0XHRcdFx0dGhhdC5fdHJ5U2V0U2VsZWN0aW9uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tIHZpc2libGUgcmFuZ2VzXG5cdFx0XHRnZXQgdmlzaWJsZVJhbmdlcygpOiBSYW5nZVtdIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3Zpc2libGVSYW5nZXM7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHZpc2libGVSYW5nZXMoX3ZhbHVlOiBSYW5nZVtdKSB7XG5cdFx0XHRcdHRocm93IG5ldyBSZWFkb25seUVycm9yKCd2aXNpYmxlUmFuZ2VzJyk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGRpZmZJbmZvcm1hdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2RpZmZJbmZvcm1hdGlvbjtcblx0XHRcdH0sXG5cdFx0XHQvLyAtLS0gb3B0aW9uc1xuXHRcdFx0Z2V0IG9wdGlvbnMoKTogdnNjb2RlLlRleHRFZGl0b3JPcHRpb25zIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX29wdGlvbnMudmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IG9wdGlvbnModmFsdWU6IHZzY29kZS5UZXh0RWRpdG9yT3B0aW9ucykge1xuXHRcdFx0XHRpZiAoIXRoYXQuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0dGhhdC5fb3B0aW9ucy5hc3NpZ24odmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tIHZpZXcgY29sdW1uXG5cdFx0XHRnZXQgdmlld0NvbHVtbigpOiB2c2NvZGUuVmlld0NvbHVtbiB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll92aWV3Q29sdW1uO1xuXHRcdFx0fSxcblx0XHRcdHNldCB2aWV3Q29sdW1uKF92YWx1ZSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgUmVhZG9ubHlFcnJvcigndmlld0NvbHVtbicpO1xuXHRcdFx0fSxcblx0XHRcdC8vIC0tLSBlZGl0XG5cdFx0XHRlZGl0KGNhbGxiYWNrOiAoZWRpdDogVGV4dEVkaXRvckVkaXQpID0+IHZvaWQsIG9wdGlvbnM6IHsgdW5kb1N0b3BCZWZvcmU6IGJvb2xlYW47IHVuZG9TdG9wQWZ0ZXI6IGJvb2xlYW4gfSA9IHsgdW5kb1N0b3BCZWZvcmU6IHRydWUsIHVuZG9TdG9wQWZ0ZXI6IHRydWUgfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdFx0XHRpZiAodGhhdC5fZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdUZXh0RWRpdG9yI2VkaXQgbm90IHBvc3NpYmxlIG9uIGNsb3NlZCBlZGl0b3JzJykpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGVkaXQgPSBuZXcgVGV4dEVkaXRvckVkaXQoZG9jdW1lbnQudmFsdWUsIG9wdGlvbnMpO1xuXHRcdFx0XHRjYWxsYmFjayhlZGl0KTtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2FwcGx5RWRpdChlZGl0KTtcblx0XHRcdH0sXG5cdFx0XHQvLyAtLS0gc25pcHBldCBlZGl0XG5cdFx0XHRpbnNlcnRTbmlwcGV0KHNuaXBwZXQ6IFNuaXBwZXRTdHJpbmcsIHdoZXJlPzogUG9zaXRpb24gfCByZWFkb25seSBQb3NpdGlvbltdIHwgUmFuZ2UgfCByZWFkb25seSBSYW5nZVtdLCBvcHRpb25zOiB7IHVuZG9TdG9wQmVmb3JlOiBib29sZWFuOyB1bmRvU3RvcEFmdGVyOiBib29sZWFuOyBrZWVwV2hpdGVzcGFjZT86IGJvb2xlYW4gfSA9IHsgdW5kb1N0b3BCZWZvcmU6IHRydWUsIHVuZG9TdG9wQWZ0ZXI6IHRydWUgfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdFx0XHRpZiAodGhhdC5fZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdUZXh0RWRpdG9yI2luc2VydFNuaXBwZXQgbm90IHBvc3NpYmxlIG9uIGNsb3NlZCBlZGl0b3JzJykpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCByYW5nZXM6IElSYW5nZVtdO1xuXG5cdFx0XHRcdGlmICghd2hlcmUgfHwgKEFycmF5LmlzQXJyYXkod2hlcmUpICYmIHdoZXJlLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRcdFx0XHRyYW5nZXMgPSB0aGF0Ll9zZWxlY3Rpb25zLm1hcChyYW5nZSA9PiBUeXBlQ29udmVydGVycy5SYW5nZS5mcm9tKHJhbmdlKSk7XG5cblx0XHRcdFx0fSBlbHNlIGlmICh3aGVyZSBpbnN0YW5jZW9mIFBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgeyBsaW5lTnVtYmVyLCBjb2x1bW4gfSA9IFR5cGVDb252ZXJ0ZXJzLlBvc2l0aW9uLmZyb20od2hlcmUpO1xuXHRcdFx0XHRcdHJhbmdlcyA9IFt7IHN0YXJ0TGluZU51bWJlcjogbGluZU51bWJlciwgc3RhcnRDb2x1bW46IGNvbHVtbiwgZW5kTGluZU51bWJlcjogbGluZU51bWJlciwgZW5kQ29sdW1uOiBjb2x1bW4gfV07XG5cblx0XHRcdFx0fSBlbHNlIGlmICh3aGVyZSBpbnN0YW5jZW9mIFJhbmdlKSB7XG5cdFx0XHRcdFx0cmFuZ2VzID0gW1R5cGVDb252ZXJ0ZXJzLlJhbmdlLmZyb20od2hlcmUpXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyYW5nZXMgPSBbXTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHBvc09yUmFuZ2Ugb2Ygd2hlcmUpIHtcblx0XHRcdFx0XHRcdGlmIChwb3NPclJhbmdlIGluc3RhbmNlb2YgUmFuZ2UpIHtcblx0XHRcdFx0XHRcdFx0cmFuZ2VzLnB1c2goVHlwZUNvbnZlcnRlcnMuUmFuZ2UuZnJvbShwb3NPclJhbmdlKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB7IGxpbmVOdW1iZXIsIGNvbHVtbiB9ID0gVHlwZUNvbnZlcnRlcnMuUG9zaXRpb24uZnJvbShwb3NPclJhbmdlKTtcblx0XHRcdFx0XHRcdFx0cmFuZ2VzLnB1c2goeyBzdGFydExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiBjb2x1bW4sIGVuZExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsIGVuZENvbHVtbjogY29sdW1uIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob3B0aW9ucy5rZWVwV2hpdGVzcGFjZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5rZWVwV2hpdGVzcGFjZSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBfcHJveHkuJHRyeUluc2VydFNuaXBwZXQoaWQsIGRvY3VtZW50LnZhbHVlLnZlcnNpb24sIHNuaXBwZXQudmFsdWUsIHJhbmdlcywgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RGVjb3JhdGlvbnMoZGVjb3JhdGlvblR5cGU6IHZzY29kZS5UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUsIHJhbmdlczogUmFuZ2VbXSB8IHZzY29kZS5EZWNvcmF0aW9uT3B0aW9uc1tdKTogdm9pZCB7XG5cdFx0XHRcdGNvbnN0IHdpbGxCZUVtcHR5ID0gKHJhbmdlcy5sZW5ndGggPT09IDApO1xuXHRcdFx0XHRpZiAod2lsbEJlRW1wdHkgJiYgIXRoYXQuX2hhc0RlY29yYXRpb25zRm9yS2V5LmhhcyhkZWNvcmF0aW9uVHlwZS5rZXkpKSB7XG5cdFx0XHRcdFx0Ly8gYXZvaWQgbm8tb3AgY2FsbCB0byB0aGUgcmVuZGVyZXJcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHdpbGxCZUVtcHR5KSB7XG5cdFx0XHRcdFx0dGhhdC5faGFzRGVjb3JhdGlvbnNGb3JLZXkuZGVsZXRlKGRlY29yYXRpb25UeXBlLmtleSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhhdC5faGFzRGVjb3JhdGlvbnNGb3JLZXkuYWRkKGRlY29yYXRpb25UeXBlLmtleSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhhdC5fcnVuT25Qcm94eSgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKFR5cGVDb252ZXJ0ZXJzLmlzRGVjb3JhdGlvbk9wdGlvbnNBcnIocmFuZ2VzKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIF9wcm94eS4kdHJ5U2V0RGVjb3JhdGlvbnMoXG5cdFx0XHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uVHlwZS5rZXksXG5cdFx0XHRcdFx0XHRcdFR5cGVDb252ZXJ0ZXJzLmZyb21SYW5nZU9yUmFuZ2VXaXRoTWVzc2FnZShyYW5nZXMpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBfcmFuZ2VzOiBudW1iZXJbXSA9IG5ldyBBcnJheTxudW1iZXI+KDQgKiByYW5nZXMubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmFuZ2UgPSByYW5nZXNbaV07XG5cdFx0XHRcdFx0XHRcdF9yYW5nZXNbNCAqIGldID0gcmFuZ2Uuc3RhcnQubGluZSArIDE7XG5cdFx0XHRcdFx0XHRcdF9yYW5nZXNbNCAqIGkgKyAxXSA9IHJhbmdlLnN0YXJ0LmNoYXJhY3RlciArIDE7XG5cdFx0XHRcdFx0XHRcdF9yYW5nZXNbNCAqIGkgKyAyXSA9IHJhbmdlLmVuZC5saW5lICsgMTtcblx0XHRcdFx0XHRcdFx0X3Jhbmdlc1s0ICogaSArIDNdID0gcmFuZ2UuZW5kLmNoYXJhY3RlciArIDE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gX3Byb3h5LiR0cnlTZXREZWNvcmF0aW9uc0Zhc3QoXG5cdFx0XHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uVHlwZS5rZXksXG5cdFx0XHRcdFx0XHRcdF9yYW5nZXNcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRyZXZlYWxSYW5nZShyYW5nZTogUmFuZ2UsIHJldmVhbFR5cGU6IHZzY29kZS5UZXh0RWRpdG9yUmV2ZWFsVHlwZSk6IHZvaWQge1xuXHRcdFx0XHR0aGF0Ll9ydW5PblByb3h5KCgpID0+IF9wcm94eS4kdHJ5UmV2ZWFsUmFuZ2UoXG5cdFx0XHRcdFx0aWQsXG5cdFx0XHRcdFx0VHlwZUNvbnZlcnRlcnMuUmFuZ2UuZnJvbShyYW5nZSksXG5cdFx0XHRcdFx0KHJldmVhbFR5cGUgfHwgVGV4dEVkaXRvclJldmVhbFR5cGUuRGVmYXVsdClcblx0XHRcdFx0KSk7XG5cdFx0XHR9LFxuXHRcdFx0c2hvdyhjb2x1bW46IHZzY29kZS5WaWV3Q29sdW1uKSB7XG5cdFx0XHRcdF9wcm94eS4kdHJ5U2hvd0VkaXRvcihpZCwgVHlwZUNvbnZlcnRlcnMuVmlld0NvbHVtbi5mcm9tKGNvbHVtbikpO1xuXHRcdFx0fSxcblx0XHRcdGhpZGUoKSB7XG5cdFx0XHRcdF9wcm94eS4kdHJ5SGlkZUVkaXRvcihpZCk7XG5cdFx0XHR9LFxuXHRcdFx0W1N5bWJvbC5mb3IoJ2RlYnVnLmRlc2NyaXB0aW9uJyldKCkge1xuXHRcdFx0XHRyZXR1cm4gYFRleHRFZGl0b3IoJHt0aGlzLmRvY3VtZW50LnVyaS50b1N0cmluZygpfSlgO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHRvayghdGhpcy5fZGlzcG9zZWQpO1xuXHRcdHRoaXMuX2Rpc3Bvc2VkID0gdHJ1ZTtcblx0fVxuXG5cdC8vIC0tLSBpbmNvbWluZzogZXh0ZW5zaW9uIGhvc3QgTVVTVCBhY2NlcHQgd2hhdCB0aGUgcmVuZGVyZXIgc2F5c1xuXG5cdF9hY2NlcHRPcHRpb25zKG9wdGlvbnM6IElSZXNvbHZlZFRleHRFZGl0b3JDb25maWd1cmF0aW9uKTogdm9pZCB7XG5cdFx0b2soIXRoaXMuX2Rpc3Bvc2VkKTtcblx0XHR0aGlzLl9vcHRpb25zLl9hY2NlcHQob3B0aW9ucyk7XG5cdH1cblxuXHRfYWNjZXB0VmlzaWJsZVJhbmdlcyh2YWx1ZTogUmFuZ2VbXSk6IHZvaWQge1xuXHRcdG9rKCF0aGlzLl9kaXNwb3NlZCk7XG5cdFx0dGhpcy5fdmlzaWJsZVJhbmdlcyA9IHZhbHVlO1xuXHR9XG5cblx0X2FjY2VwdFZpZXdDb2x1bW4odmFsdWU6IHZzY29kZS5WaWV3Q29sdW1uKSB7XG5cdFx0b2soIXRoaXMuX2Rpc3Bvc2VkKTtcblx0XHR0aGlzLl92aWV3Q29sdW1uID0gdmFsdWU7XG5cdH1cblxuXHRfYWNjZXB0U2VsZWN0aW9ucyhzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSk6IHZvaWQge1xuXHRcdG9rKCF0aGlzLl9kaXNwb3NlZCk7XG5cdFx0dGhpcy5fc2VsZWN0aW9ucyA9IHNlbGVjdGlvbnM7XG5cdH1cblxuXHRfYWNjZXB0RGlmZkluZm9ybWF0aW9uKGRpZmZJbmZvcm1hdGlvbjogdnNjb2RlLlRleHRFZGl0b3JEaWZmSW5mb3JtYXRpb25bXSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdG9rKCF0aGlzLl9kaXNwb3NlZCk7XG5cdFx0dGhpcy5fZGlmZkluZm9ybWF0aW9uID0gZGlmZkluZm9ybWF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdHJ5U2V0U2VsZWN0aW9uKCk6IFByb21pc2U8dnNjb2RlLlRleHRFZGl0b3IgfCBudWxsIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5fc2VsZWN0aW9ucy5tYXAoVHlwZUNvbnZlcnRlcnMuU2VsZWN0aW9uLmZyb20pO1xuXHRcdGF3YWl0IHRoaXMuX3J1bk9uUHJveHkoKCkgPT4gdGhpcy5fcHJveHkuJHRyeVNldFNlbGVjdGlvbnModGhpcy5pZCwgc2VsZWN0aW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseUVkaXQoZWRpdEJ1aWxkZXI6IFRleHRFZGl0b3JFZGl0KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZWRpdERhdGEgPSBlZGl0QnVpbGRlci5maW5hbGl6ZSgpO1xuXG5cdFx0Ly8gcmV0dXJuIHdoZW4gdGhlcmUgaXMgbm90aGluZyB0byBkb1xuXHRcdGlmIChlZGl0RGF0YS5lZGl0cy5sZW5ndGggPT09IDAgJiYgIWVkaXREYXRhLnNldEVuZE9mTGluZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0XHR9XG5cblx0XHQvLyBjaGVjayB0aGF0IHRoZSBlZGl0cyBhcmUgbm90IG92ZXJsYXBwaW5nIChpLmUuIGlsbGVnYWwpXG5cdFx0Y29uc3QgZWRpdFJhbmdlcyA9IGVkaXREYXRhLmVkaXRzLm1hcChlZGl0ID0+IGVkaXQucmFuZ2UpO1xuXG5cdFx0Ly8gc29ydCBhc2NlbmRpbmcgKGJ5IGVuZCBhbmQgdGhlbiBieSBzdGFydClcblx0XHRlZGl0UmFuZ2VzLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChhLmVuZC5saW5lID09PSBiLmVuZC5saW5lKSB7XG5cdFx0XHRcdGlmIChhLmVuZC5jaGFyYWN0ZXIgPT09IGIuZW5kLmNoYXJhY3Rlcikge1xuXHRcdFx0XHRcdGlmIChhLnN0YXJ0LmxpbmUgPT09IGIuc3RhcnQubGluZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGEuc3RhcnQuY2hhcmFjdGVyIC0gYi5zdGFydC5jaGFyYWN0ZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBhLnN0YXJ0LmxpbmUgLSBiLnN0YXJ0LmxpbmU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGEuZW5kLmNoYXJhY3RlciAtIGIuZW5kLmNoYXJhY3Rlcjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhLmVuZC5saW5lIC0gYi5lbmQubGluZTtcblx0XHR9KTtcblxuXHRcdC8vIGNoZWNrIHRoYXQgbm8gZWRpdHMgYXJlIG92ZXJsYXBwaW5nXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGNvdW50ID0gZWRpdFJhbmdlcy5sZW5ndGggLSAxOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3QgcmFuZ2VFbmQgPSBlZGl0UmFuZ2VzW2ldLmVuZDtcblx0XHRcdGNvbnN0IG5leHRSYW5nZVN0YXJ0ID0gZWRpdFJhbmdlc1tpICsgMV0uc3RhcnQ7XG5cblx0XHRcdGlmIChuZXh0UmFuZ2VTdGFydC5pc0JlZm9yZShyYW5nZUVuZCkpIHtcblx0XHRcdFx0Ly8gb3ZlcmxhcHBpbmcgcmFuZ2VzXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChcblx0XHRcdFx0XHRuZXcgRXJyb3IoJ092ZXJsYXBwaW5nIHJhbmdlcyBhcmUgbm90IGFsbG93ZWQhJylcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBwcmVwYXJlIGRhdGEgZm9yIHNlcmlhbGl6YXRpb25cblx0XHRjb25zdCBlZGl0cyA9IGVkaXREYXRhLmVkaXRzLm1hcCgoZWRpdCk6IElTaW5nbGVFZGl0T3BlcmF0aW9uID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiBUeXBlQ29udmVydGVycy5SYW5nZS5mcm9tKGVkaXQucmFuZ2UpLFxuXHRcdFx0XHR0ZXh0OiBlZGl0LnRleHQsXG5cdFx0XHRcdGZvcmNlTW92ZU1hcmtlcnM6IGVkaXQuZm9yY2VNb3ZlTWFya2Vyc1xuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kdHJ5QXBwbHlFZGl0cyh0aGlzLmlkLCBlZGl0RGF0YS5kb2N1bWVudFZlcnNpb25JZCwgZWRpdHMsIHtcblx0XHRcdHNldEVuZE9mTGluZTogdHlwZW9mIGVkaXREYXRhLnNldEVuZE9mTGluZSA9PT0gJ251bWJlcicgPyBUeXBlQ29udmVydGVycy5FbmRPZkxpbmUuZnJvbShlZGl0RGF0YS5zZXRFbmRPZkxpbmUpIDogdW5kZWZpbmVkLFxuXHRcdFx0dW5kb1N0b3BCZWZvcmU6IGVkaXREYXRhLnVuZG9TdG9wQmVmb3JlLFxuXHRcdFx0dW5kb1N0b3BBZnRlcjogZWRpdERhdGEudW5kb1N0b3BBZnRlclxuXHRcdH0pO1xuXHR9XG5cdHByaXZhdGUgX3J1bk9uUHJveHkoY2FsbGJhY2s6ICgpID0+IFByb21pc2U8YW55Pik6IFByb21pc2U8RXh0SG9zdFRleHRFZGl0b3IgfCB1bmRlZmluZWQgfCBudWxsPiB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ1RleHRFZGl0b3IgaXMgY2xvc2VkL2Rpc3Bvc2VkJyk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNhbGxiYWNrKCkudGhlbigoKSA9PiB0aGlzLCBlcnIgPT4ge1xuXHRcdFx0aWYgKCEoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyLm5hbWUgPT09ICdESVNQT1NFRCcpKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihlcnIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsVUFBVTtBQUNuQixTQUFTLGVBQWUsdUJBQXVCO0FBQy9DLFNBQVMsbUJBQW1CO0FBSzVCLFlBQVksb0JBQW9CO0FBQ2hDLFNBQVMsV0FBVyxVQUFVLE9BQU8sV0FBc0QsNEJBQTRCO0FBTWhILE1BQU0sNEJBQU4sTUFBTSwwQkFBeUI7QUFBQSxFQU1yQyxZQUFZLE9BQW1DLFdBQWtDLFNBQXlDO0FBQ3pILFVBQU0sTUFBTSwwQkFBeUIsTUFBTSxPQUFPO0FBQ2xELFVBQU0sa0NBQWtDLFVBQVUsWUFBWSxLQUFLLGVBQWUsd0JBQXdCLEtBQUssT0FBTyxDQUFDO0FBQ3ZILFNBQUssUUFBUSxPQUFPLE9BQU87QUFBQSxNQUMxQjtBQUFBLE1BQ0EsVUFBVTtBQUNULGNBQU0sZ0NBQWdDLEdBQUc7QUFBQSxNQUMxQztBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFFRDtBQWpCYSwwQkFFWSxRQUFRLElBQUksWUFBWSwwQkFBMEI7QUFGcEUsSUFBTSwyQkFBTjtBQWlDUCxNQUFNLGVBQWU7QUFBQSxFQVVwQixZQUFZLFVBQStCLFNBQThEO0FBSnpHLFNBQVEsa0JBQXdDLENBQUM7QUFDakQsU0FBUSxnQkFBdUM7QUFDL0MsU0FBUSxhQUFzQjtBQUc3QixTQUFLLFlBQVk7QUFDakIsU0FBSyxxQkFBcUIsU0FBUztBQUNuQyxTQUFLLGtCQUFrQixRQUFRO0FBQy9CLFNBQUssaUJBQWlCLFFBQVE7QUFBQSxFQUMvQjtBQUFBLEVBRUEsV0FBc0I7QUFDckIsU0FBSyxhQUFhO0FBQ2xCLFdBQU87QUFBQSxNQUNOLG1CQUFtQixLQUFLO0FBQUEsTUFDeEIsT0FBTyxLQUFLO0FBQUEsTUFDWixjQUFjLEtBQUs7QUFBQSxNQUNuQixnQkFBZ0IsS0FBSztBQUFBLE1BQ3JCLGVBQWUsS0FBSztBQUFBLElBQ3JCO0FBQUEsRUFDRDtBQUFBLEVBRVEsb0JBQW9CO0FBQzNCLFFBQUksS0FBSyxZQUFZO0FBQ3BCLFlBQU0sSUFBSSxNQUFNLHdDQUF3QztBQUFBLElBQ3pEO0FBQUEsRUFDRDtBQUFBLEVBRUEsUUFBUSxVQUF3QyxPQUFxQjtBQUNwRSxTQUFLLGtCQUFrQjtBQUN2QixRQUFJLFFBQXNCO0FBRTFCLFFBQUksb0JBQW9CLFVBQVU7QUFDakMsY0FBUSxJQUFJLE1BQU0sVUFBVSxRQUFRO0FBQUEsSUFDckMsV0FBVyxvQkFBb0IsT0FBTztBQUNyQyxjQUFRO0FBQUEsSUFDVCxPQUFPO0FBQ04sWUFBTSxJQUFJLE1BQU0sdUJBQXVCO0FBQUEsSUFDeEM7QUFFQSxTQUFLLFVBQVUsT0FBTyxPQUFPLEtBQUs7QUFBQSxFQUNuQztBQUFBLEVBRUEsT0FBTyxVQUFvQixPQUFxQjtBQUMvQyxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFVBQVUsSUFBSSxNQUFNLFVBQVUsUUFBUSxHQUFHLE9BQU8sSUFBSTtBQUFBLEVBQzFEO0FBQUEsRUFFQSxPQUFPLFVBQW1DO0FBQ3pDLFNBQUssa0JBQWtCO0FBQ3ZCLFFBQUksUUFBc0I7QUFFMUIsUUFBSSxvQkFBb0IsT0FBTztBQUM5QixjQUFRO0FBQUEsSUFDVCxPQUFPO0FBQ04sWUFBTSxJQUFJLE1BQU0sdUJBQXVCO0FBQUEsSUFDeEM7QUFFQSxTQUFLLFVBQVUsT0FBTyxNQUFNLElBQUk7QUFBQSxFQUNqQztBQUFBLEVBRVEsVUFBVSxPQUFjLE1BQXFCLGtCQUFpQztBQUNyRixVQUFNLGFBQWEsS0FBSyxVQUFVLGNBQWMsS0FBSztBQUNyRCxTQUFLLGdCQUFnQixLQUFLO0FBQUEsTUFDekIsT0FBTztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYSxXQUE0QjtBQUN4QyxTQUFLLGtCQUFrQjtBQUN2QixRQUFJLGNBQWMsVUFBVSxNQUFNLGNBQWMsVUFBVSxNQUFNO0FBQy9ELFlBQU0sZ0JBQWdCLFdBQVc7QUFBQSxJQUNsQztBQUVBLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFDRDtBQUVPLE1BQU0seUJBQXlCO0FBQUEsRUFlckMsWUFBWSxPQUFtQyxJQUFZLFFBQTBDLFlBQXlCO0FBQzdILFNBQUssU0FBUztBQUNkLFNBQUssTUFBTTtBQUNYLFNBQUssUUFBUSxNQUFNO0FBQ25CLFNBQUssY0FBYztBQUVuQixVQUFNLE9BQU87QUFFYixTQUFLLFFBQVE7QUFBQSxNQUNaLElBQUksVUFBMkI7QUFDOUIsZUFBTyxLQUFLO0FBQUEsTUFDYjtBQUFBLE1BQ0EsSUFBSSxRQUFRLE9BQXdCO0FBQ25DLGFBQUssWUFBWSxLQUFLO0FBQUEsTUFDdkI7QUFBQSxNQUNBLElBQUksYUFBOEI7QUFDakMsZUFBTyxLQUFLO0FBQUEsTUFDYjtBQUFBLE1BQ0EsSUFBSSxXQUFXLE9BQXdCO0FBQ3RDLGFBQUssZUFBZSxLQUFLO0FBQUEsTUFDMUI7QUFBQSxNQUNBLElBQUksZUFBaUM7QUFDcEMsZUFBTyxLQUFLO0FBQUEsTUFDYjtBQUFBLE1BQ0EsSUFBSSxhQUFhLE9BQXlCO0FBQ3pDLGFBQUssaUJBQWlCLEtBQUs7QUFBQSxNQUM1QjtBQUFBLE1BQ0EsSUFBSSxjQUFxQztBQUN4QyxlQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUEsTUFDQSxJQUFJLFlBQVksT0FBOEI7QUFDN0MsYUFBSyxnQkFBZ0IsS0FBSztBQUFBLE1BQzNCO0FBQUEsTUFDQSxJQUFJLGNBQTBDO0FBQzdDLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxNQUNBLElBQUksWUFBWSxPQUFtQztBQUNsRCxhQUFLLGdCQUFnQixLQUFLO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRU8sUUFBUSxRQUFnRDtBQUM5RCxTQUFLLFdBQVcsT0FBTztBQUN2QixTQUFLLGNBQWMsT0FBTztBQUMxQixTQUFLLHNCQUFzQixPQUFPO0FBQ2xDLFNBQUssZ0JBQWdCLE9BQU87QUFDNUIsU0FBSyxlQUFlLE9BQU87QUFDM0IsU0FBSyxlQUFlLGVBQWUsMkJBQTJCLEdBQUcsT0FBTyxXQUFXO0FBQUEsRUFDcEY7QUFBQTtBQUFBLEVBSVEsaUJBQWlCLE9BQWdEO0FBQ3hFLFFBQUksVUFBVSxRQUFRO0FBQ3JCLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixZQUFNLElBQUksS0FBSyxNQUFNLEtBQUs7QUFDMUIsYUFBUSxJQUFJLElBQUksSUFBSTtBQUFBLElBQ3JCO0FBQ0EsUUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixZQUFNLElBQUksU0FBUyxPQUFPLEVBQUU7QUFDNUIsVUFBSSxNQUFNLENBQUMsR0FBRztBQUNiLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBUSxJQUFJLElBQUksSUFBSTtBQUFBLElBQ3JCO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFlBQVksT0FBd0I7QUFDM0MsVUFBTSxVQUFVLEtBQUssaUJBQWlCLEtBQUs7QUFDM0MsUUFBSSxZQUFZLE1BQU07QUFFckI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxPQUFPLFlBQVksVUFBVTtBQUNoQyxVQUFJLEtBQUssYUFBYSxTQUFTO0FBRTlCO0FBQUEsTUFDRDtBQUVBLFdBQUssV0FBVztBQUFBLElBQ2pCO0FBQ0EsU0FBSyxhQUFhLGNBQWMsS0FBSyxPQUFPLGVBQWUsS0FBSyxLQUFLO0FBQUEsTUFDcEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQTtBQUFBLEVBSVEsb0JBQW9CLE9BQW1EO0FBQzlFLFFBQUksVUFBVSxXQUFXO0FBQ3hCLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixZQUFNLElBQUksS0FBSyxNQUFNLEtBQUs7QUFDMUIsYUFBUSxJQUFJLElBQUksSUFBSTtBQUFBLElBQ3JCO0FBQ0EsUUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixZQUFNLElBQUksU0FBUyxPQUFPLEVBQUU7QUFDNUIsVUFBSSxNQUFNLENBQUMsR0FBRztBQUNiLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBUSxJQUFJLElBQUksSUFBSTtBQUFBLElBQ3JCO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGVBQWUsT0FBd0I7QUFDOUMsVUFBTSxhQUFhLEtBQUssb0JBQW9CLEtBQUs7QUFDakQsUUFBSSxlQUFlLE1BQU07QUFFeEI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxPQUFPLGVBQWUsVUFBVTtBQUNuQyxVQUFJLEtBQUssd0JBQXdCLFlBQVk7QUFFNUM7QUFBQSxNQUNEO0FBRUEsV0FBSyxjQUFjO0FBQ25CLFdBQUssc0JBQXNCO0FBQUEsSUFDNUI7QUFDQSxTQUFLLGFBQWEsaUJBQWlCLEtBQUssT0FBTyxlQUFlLEtBQUssS0FBSztBQUFBLE1BQ3ZFO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUE7QUFBQSxFQUlRLHNCQUFzQixPQUEyQztBQUN4RSxRQUFJLFVBQVUsUUFBUTtBQUNyQixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQVEsVUFBVSxVQUFVLFFBQVEsUUFBUSxLQUFLO0FBQUEsRUFDbEQ7QUFBQSxFQUVRLGlCQUFpQixPQUF5QjtBQUNqRCxVQUFNLGVBQWUsS0FBSyxzQkFBc0IsS0FBSztBQUNyRCxRQUFJLE9BQU8saUJBQWlCLFdBQVc7QUFDdEMsVUFBSSxLQUFLLGtCQUFrQixjQUFjO0FBRXhDO0FBQUEsTUFDRDtBQUVBLFdBQUssZ0JBQWdCO0FBQUEsSUFDdEI7QUFDQSxTQUFLLGFBQWEsbUJBQW1CLEtBQUssT0FBTyxlQUFlLEtBQUssS0FBSztBQUFBLE1BQ3pFO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUE7QUFBQSxFQUlRLGdCQUFnQixPQUE4QjtBQUNyRCxRQUFJLEtBQUssaUJBQWlCLE9BQU87QUFFaEM7QUFBQSxJQUNEO0FBQ0EsU0FBSyxlQUFlO0FBQ3BCLFNBQUssYUFBYSxrQkFBa0IsS0FBSyxPQUFPLGVBQWUsS0FBSyxLQUFLO0FBQUEsTUFDeEUsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBO0FBQUEsRUFJUSxnQkFBZ0IsT0FBbUM7QUFDMUQsUUFBSSxLQUFLLGlCQUFpQixPQUFPO0FBRWhDO0FBQUEsSUFDRDtBQUNBLFNBQUssZUFBZTtBQUNwQixTQUFLLGFBQWEsa0JBQWtCLEtBQUssT0FBTyxlQUFlLEtBQUssS0FBSztBQUFBLE1BQ3hFLGFBQWEsZUFBZSwyQkFBMkIsS0FBSyxLQUFLO0FBQUEsSUFDbEUsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRU8sT0FBTyxZQUFzQztBQUNuRCxVQUFNLDBCQUEwRCxDQUFDO0FBQ2pFLFFBQUksWUFBWTtBQUVoQixRQUFJLE9BQU8sV0FBVyxZQUFZLGFBQWE7QUFDOUMsWUFBTSxVQUFVLEtBQUssaUJBQWlCLFdBQVcsT0FBTztBQUN4RCxVQUFJLFlBQVksUUFBUTtBQUN2QixvQkFBWTtBQUNaLGdDQUF3QixVQUFVO0FBQUEsTUFDbkMsV0FBVyxPQUFPLFlBQVksWUFBWSxLQUFLLGFBQWEsU0FBUztBQUVwRSxhQUFLLFdBQVc7QUFDaEIsb0JBQVk7QUFDWixnQ0FBd0IsVUFBVTtBQUFBLE1BQ25DO0FBQUEsSUFDRDtBQUVBLFFBQUksT0FBTyxXQUFXLGVBQWUsYUFBYTtBQUNqRCxZQUFNLGFBQWEsS0FBSyxvQkFBb0IsV0FBVyxVQUFVO0FBQ2pFLFVBQUksZUFBZSxXQUFXO0FBQzdCLG9CQUFZO0FBQ1osZ0NBQXdCLGFBQWE7QUFBQSxNQUN0QyxXQUFXLE9BQU8sZUFBZSxZQUFZLEtBQUssd0JBQXdCLFlBQVk7QUFFckYsYUFBSyxjQUFjO0FBQ25CLGFBQUssc0JBQXNCO0FBQzNCLG9CQUFZO0FBQ1osZ0NBQXdCLGFBQWE7QUFBQSxNQUN0QztBQUFBLElBQ0Q7QUFFQSxRQUFJLE9BQU8sV0FBVyxpQkFBaUIsYUFBYTtBQUNuRCxZQUFNLGVBQWUsS0FBSyxzQkFBc0IsV0FBVyxZQUFZO0FBQ3ZFLFVBQUksaUJBQWlCLFFBQVE7QUFDNUIsb0JBQVk7QUFDWixnQ0FBd0IsZUFBZTtBQUFBLE1BQ3hDLFdBQVcsS0FBSyxrQkFBa0IsY0FBYztBQUUvQyxhQUFLLGdCQUFnQjtBQUNyQixvQkFBWTtBQUNaLGdDQUF3QixlQUFlO0FBQUEsTUFDeEM7QUFBQSxJQUNEO0FBRUEsUUFBSSxPQUFPLFdBQVcsZ0JBQWdCLGFBQWE7QUFDbEQsVUFBSSxLQUFLLGlCQUFpQixXQUFXLGFBQWE7QUFDakQsYUFBSyxlQUFlLFdBQVc7QUFDL0Isb0JBQVk7QUFDWixnQ0FBd0IsY0FBYyxXQUFXO0FBQUEsTUFDbEQ7QUFBQSxJQUNEO0FBRUEsUUFBSSxPQUFPLFdBQVcsZ0JBQWdCLGFBQWE7QUFDbEQsVUFBSSxLQUFLLGlCQUFpQixXQUFXLGFBQWE7QUFDakQsYUFBSyxlQUFlLFdBQVc7QUFDL0Isb0JBQVk7QUFDWixnQ0FBd0IsY0FBYyxlQUFlLDJCQUEyQixLQUFLLFdBQVcsV0FBVztBQUFBLE1BQzVHO0FBQUEsSUFDRDtBQUVBLFFBQUksV0FBVztBQUNkLFdBQUssYUFBYSxjQUFjLEtBQUssT0FBTyxlQUFlLEtBQUssS0FBSyx1QkFBdUIsQ0FBQztBQUFBLElBQzlGO0FBQUEsRUFDRDtBQUFBLEVBRVEsYUFBYSxRQUFnQixTQUE2QjtBQUNqRSxZQUFRLE1BQU0sU0FBTztBQUNwQixXQUFLLFlBQVksS0FBSyw2QkFBNkIsTUFBTSxZQUFZO0FBQ3JFLFdBQUssWUFBWSxLQUFLLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBRU8sTUFBTSxrQkFBa0I7QUFBQSxFQVk5QixZQUNVLElBQ1EsUUFDQSxhQUNqQixVQUNBLFlBQXlCLFNBQ3pCLGVBQXdCLFlBQ3ZCO0FBTlE7QUFDUTtBQUNBO0FBVGxCLFNBQVEsWUFBcUI7QUFDN0IsU0FBUSx3QkFBd0Isb0JBQUksSUFBWTtBQWEvQyxTQUFLLGNBQWM7QUFDbkIsU0FBSyxXQUFXLElBQUkseUJBQXlCLEtBQUssUUFBUSxLQUFLLElBQUksU0FBUyxXQUFXO0FBQ3ZGLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssY0FBYztBQUVuQixVQUFNLE9BQU87QUFFYixTQUFLLFFBQVEsT0FBTyxPQUFPO0FBQUEsTUFDMUIsSUFBSSxXQUFnQztBQUNuQyxlQUFPLFNBQVM7QUFBQSxNQUNqQjtBQUFBLE1BQ0EsSUFBSSxTQUFTLFFBQVE7QUFDcEIsY0FBTSxJQUFJLGNBQWMsVUFBVTtBQUFBLE1BQ25DO0FBQUE7QUFBQSxNQUVBLElBQUksWUFBdUI7QUFDMUIsZUFBTyxLQUFLLGVBQWUsS0FBSyxZQUFZLENBQUM7QUFBQSxNQUM5QztBQUFBLE1BQ0EsSUFBSSxVQUFVLE9BQWtCO0FBQy9CLFlBQUksRUFBRSxpQkFBaUIsWUFBWTtBQUNsQyxnQkFBTSxnQkFBZ0IsV0FBVztBQUFBLFFBQ2xDO0FBQ0EsYUFBSyxjQUFjLENBQUMsS0FBSztBQUN6QixhQUFLLGlCQUFpQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxJQUFJLGFBQTBCO0FBQzdCLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxNQUNBLElBQUksV0FBVyxPQUFvQjtBQUNsQyxZQUFJLENBQUMsTUFBTSxRQUFRLEtBQUssS0FBSyxNQUFNLEtBQUssT0FBSyxFQUFFLGFBQWEsVUFBVSxHQUFHO0FBQ3hFLGdCQUFNLGdCQUFnQixZQUFZO0FBQUEsUUFDbkM7QUFDQSxhQUFLLGNBQWM7QUFDbkIsYUFBSyxpQkFBaUI7QUFBQSxNQUN2QjtBQUFBO0FBQUEsTUFFQSxJQUFJLGdCQUF5QjtBQUM1QixlQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUEsTUFDQSxJQUFJLGNBQWMsUUFBaUI7QUFDbEMsY0FBTSxJQUFJLGNBQWMsZUFBZTtBQUFBLE1BQ3hDO0FBQUEsTUFDQSxJQUFJLGtCQUFrQjtBQUNyQixlQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUE7QUFBQSxNQUVBLElBQUksVUFBb0M7QUFDdkMsZUFBTyxLQUFLLFNBQVM7QUFBQSxNQUN0QjtBQUFBLE1BQ0EsSUFBSSxRQUFRLE9BQWlDO0FBQzVDLFlBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEIsZUFBSyxTQUFTLE9BQU8sS0FBSztBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBO0FBQUEsTUFFQSxJQUFJLGFBQTRDO0FBQy9DLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxNQUNBLElBQUksV0FBVyxRQUFRO0FBQ3RCLGNBQU0sSUFBSSxjQUFjLFlBQVk7QUFBQSxNQUNyQztBQUFBO0FBQUEsTUFFQSxLQUFLLFVBQTBDQSxXQUErRCxFQUFFLGdCQUFnQixNQUFNLGVBQWUsS0FBSyxHQUFxQjtBQUM5SyxZQUFJLEtBQUssV0FBVztBQUNuQixpQkFBTyxRQUFRLE9BQU8sSUFBSSxNQUFNLGdEQUFnRCxDQUFDO0FBQUEsUUFDbEY7QUFDQSxjQUFNLE9BQU8sSUFBSSxlQUFlLFNBQVMsT0FBT0EsUUFBTztBQUN2RCxpQkFBUyxJQUFJO0FBQ2IsZUFBTyxLQUFLLFdBQVcsSUFBSTtBQUFBLE1BQzVCO0FBQUE7QUFBQSxNQUVBLGNBQWMsU0FBd0IsT0FBbUVBLFdBQXlGLEVBQUUsZ0JBQWdCLE1BQU0sZUFBZSxLQUFLLEdBQXFCO0FBQ2xRLFlBQUksS0FBSyxXQUFXO0FBQ25CLGlCQUFPLFFBQVEsT0FBTyxJQUFJLE1BQU0seURBQXlELENBQUM7QUFBQSxRQUMzRjtBQUNBLFlBQUk7QUFFSixZQUFJLENBQUMsU0FBVSxNQUFNLFFBQVEsS0FBSyxLQUFLLE1BQU0sV0FBVyxHQUFJO0FBQzNELG1CQUFTLEtBQUssWUFBWSxJQUFJLFdBQVMsZUFBZSxNQUFNLEtBQUssS0FBSyxDQUFDO0FBQUEsUUFFeEUsV0FBVyxpQkFBaUIsVUFBVTtBQUNyQyxnQkFBTSxFQUFFLFlBQVksT0FBTyxJQUFJLGVBQWUsU0FBUyxLQUFLLEtBQUs7QUFDakUsbUJBQVMsQ0FBQyxFQUFFLGlCQUFpQixZQUFZLGFBQWEsUUFBUSxlQUFlLFlBQVksV0FBVyxPQUFPLENBQUM7QUFBQSxRQUU3RyxXQUFXLGlCQUFpQixPQUFPO0FBQ2xDLG1CQUFTLENBQUMsZUFBZSxNQUFNLEtBQUssS0FBSyxDQUFDO0FBQUEsUUFDM0MsT0FBTztBQUNOLG1CQUFTLENBQUM7QUFDVixxQkFBVyxjQUFjLE9BQU87QUFDL0IsZ0JBQUksc0JBQXNCLE9BQU87QUFDaEMscUJBQU8sS0FBSyxlQUFlLE1BQU0sS0FBSyxVQUFVLENBQUM7QUFBQSxZQUNsRCxPQUFPO0FBQ04sb0JBQU0sRUFBRSxZQUFZLE9BQU8sSUFBSSxlQUFlLFNBQVMsS0FBSyxVQUFVO0FBQ3RFLHFCQUFPLEtBQUssRUFBRSxpQkFBaUIsWUFBWSxhQUFhLFFBQVEsZUFBZSxZQUFZLFdBQVcsT0FBTyxDQUFDO0FBQUEsWUFDL0c7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUNBLFlBQUlBLFNBQVEsbUJBQW1CLFFBQVc7QUFDekMsVUFBQUEsU0FBUSxpQkFBaUI7QUFBQSxRQUMxQjtBQUNBLGVBQU8sT0FBTyxrQkFBa0IsSUFBSSxTQUFTLE1BQU0sU0FBUyxRQUFRLE9BQU8sUUFBUUEsUUFBTztBQUFBLE1BQzNGO0FBQUEsTUFDQSxlQUFlLGdCQUFpRCxRQUFvRDtBQUNuSCxjQUFNLGNBQWUsT0FBTyxXQUFXO0FBQ3ZDLFlBQUksZUFBZSxDQUFDLEtBQUssc0JBQXNCLElBQUksZUFBZSxHQUFHLEdBQUc7QUFFdkU7QUFBQSxRQUNEO0FBQ0EsWUFBSSxhQUFhO0FBQ2hCLGVBQUssc0JBQXNCLE9BQU8sZUFBZSxHQUFHO0FBQUEsUUFDckQsT0FBTztBQUNOLGVBQUssc0JBQXNCLElBQUksZUFBZSxHQUFHO0FBQUEsUUFDbEQ7QUFDQSxhQUFLLFlBQVksTUFBTTtBQUN0QixjQUFJLGVBQWUsdUJBQXVCLE1BQU0sR0FBRztBQUNsRCxtQkFBTyxPQUFPO0FBQUEsY0FDYjtBQUFBLGNBQ0EsZUFBZTtBQUFBLGNBQ2YsZUFBZSw0QkFBNEIsTUFBTTtBQUFBLFlBQ2xEO0FBQUEsVUFDRCxPQUFPO0FBQ04sa0JBQU0sVUFBb0IsSUFBSSxNQUFjLElBQUksT0FBTyxNQUFNO0FBQzdELHFCQUFTLElBQUksR0FBRyxNQUFNLE9BQU8sUUFBUSxJQUFJLEtBQUssS0FBSztBQUNsRCxvQkFBTSxRQUFRLE9BQU8sQ0FBQztBQUN0QixzQkFBUSxJQUFJLENBQUMsSUFBSSxNQUFNLE1BQU0sT0FBTztBQUNwQyxzQkFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLE1BQU0sTUFBTSxZQUFZO0FBQzdDLHNCQUFRLElBQUksSUFBSSxDQUFDLElBQUksTUFBTSxJQUFJLE9BQU87QUFDdEMsc0JBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxNQUFNLElBQUksWUFBWTtBQUFBLFlBQzVDO0FBQ0EsbUJBQU8sT0FBTztBQUFBLGNBQ2I7QUFBQSxjQUNBLGVBQWU7QUFBQSxjQUNmO0FBQUEsWUFDRDtBQUFBLFVBQ0Q7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsTUFDQSxZQUFZLE9BQWMsWUFBK0M7QUFDeEUsYUFBSyxZQUFZLE1BQU0sT0FBTztBQUFBLFVBQzdCO0FBQUEsVUFDQSxlQUFlLE1BQU0sS0FBSyxLQUFLO0FBQUEsVUFDOUIsY0FBYyxxQkFBcUI7QUFBQSxRQUNyQyxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsS0FBSyxRQUEyQjtBQUMvQixlQUFPLGVBQWUsSUFBSSxlQUFlLFdBQVcsS0FBSyxNQUFNLENBQUM7QUFBQSxNQUNqRTtBQUFBLE1BQ0EsT0FBTztBQUNOLGVBQU8sZUFBZSxFQUFFO0FBQUEsTUFDekI7QUFBQSxNQUNBLENBQUMsT0FBTyxJQUFJLG1CQUFtQixDQUFDLElBQUk7QUFDbkMsZUFBTyxjQUFjLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQztBQUFBLE1BQ2xEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsVUFBVTtBQUNULE9BQUcsQ0FBQyxLQUFLLFNBQVM7QUFDbEIsU0FBSyxZQUFZO0FBQUEsRUFDbEI7QUFBQTtBQUFBLEVBSUEsZUFBZSxTQUFpRDtBQUMvRCxPQUFHLENBQUMsS0FBSyxTQUFTO0FBQ2xCLFNBQUssU0FBUyxRQUFRLE9BQU87QUFBQSxFQUM5QjtBQUFBLEVBRUEscUJBQXFCLE9BQXNCO0FBQzFDLE9BQUcsQ0FBQyxLQUFLLFNBQVM7QUFDbEIsU0FBSyxpQkFBaUI7QUFBQSxFQUN2QjtBQUFBLEVBRUEsa0JBQWtCLE9BQTBCO0FBQzNDLE9BQUcsQ0FBQyxLQUFLLFNBQVM7QUFDbEIsU0FBSyxjQUFjO0FBQUEsRUFDcEI7QUFBQSxFQUVBLGtCQUFrQixZQUErQjtBQUNoRCxPQUFHLENBQUMsS0FBSyxTQUFTO0FBQ2xCLFNBQUssY0FBYztBQUFBLEVBQ3BCO0FBQUEsRUFFQSx1QkFBdUIsaUJBQXVFO0FBQzdGLE9BQUcsQ0FBQyxLQUFLLFNBQVM7QUFDbEIsU0FBSyxtQkFBbUI7QUFBQSxFQUN6QjtBQUFBLEVBRUEsTUFBYyxtQkFBa0U7QUFDL0UsVUFBTSxZQUFZLEtBQUssWUFBWSxJQUFJLGVBQWUsVUFBVSxJQUFJO0FBQ3BFLFVBQU0sS0FBSyxZQUFZLE1BQU0sS0FBSyxPQUFPLGtCQUFrQixLQUFLLElBQUksU0FBUyxDQUFDO0FBQzlFLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVRLFdBQVcsYUFBK0M7QUFDakUsVUFBTSxXQUFXLFlBQVksU0FBUztBQUd0QyxRQUFJLFNBQVMsTUFBTSxXQUFXLEtBQUssQ0FBQyxTQUFTLGNBQWM7QUFDMUQsYUFBTyxRQUFRLFFBQVEsSUFBSTtBQUFBLElBQzVCO0FBR0EsVUFBTSxhQUFhLFNBQVMsTUFBTSxJQUFJLFVBQVEsS0FBSyxLQUFLO0FBR3hELGVBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUN6QixVQUFJLEVBQUUsSUFBSSxTQUFTLEVBQUUsSUFBSSxNQUFNO0FBQzlCLFlBQUksRUFBRSxJQUFJLGNBQWMsRUFBRSxJQUFJLFdBQVc7QUFDeEMsY0FBSSxFQUFFLE1BQU0sU0FBUyxFQUFFLE1BQU0sTUFBTTtBQUNsQyxtQkFBTyxFQUFFLE1BQU0sWUFBWSxFQUFFLE1BQU07QUFBQSxVQUNwQztBQUNBLGlCQUFPLEVBQUUsTUFBTSxPQUFPLEVBQUUsTUFBTTtBQUFBLFFBQy9CO0FBQ0EsZUFBTyxFQUFFLElBQUksWUFBWSxFQUFFLElBQUk7QUFBQSxNQUNoQztBQUNBLGFBQU8sRUFBRSxJQUFJLE9BQU8sRUFBRSxJQUFJO0FBQUEsSUFDM0IsQ0FBQztBQUdELGFBQVMsSUFBSSxHQUFHLFFBQVEsV0FBVyxTQUFTLEdBQUcsSUFBSSxPQUFPLEtBQUs7QUFDOUQsWUFBTSxXQUFXLFdBQVcsQ0FBQyxFQUFFO0FBQy9CLFlBQU0saUJBQWlCLFdBQVcsSUFBSSxDQUFDLEVBQUU7QUFFekMsVUFBSSxlQUFlLFNBQVMsUUFBUSxHQUFHO0FBRXRDLGVBQU8sUUFBUTtBQUFBLFVBQ2QsSUFBSSxNQUFNLHFDQUFxQztBQUFBLFFBQ2hEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxVQUFNLFFBQVEsU0FBUyxNQUFNLElBQUksQ0FBQyxTQUErQjtBQUNoRSxhQUFPO0FBQUEsUUFDTixPQUFPLGVBQWUsTUFBTSxLQUFLLEtBQUssS0FBSztBQUFBLFFBQzNDLE1BQU0sS0FBSztBQUFBLFFBQ1gsa0JBQWtCLEtBQUs7QUFBQSxNQUN4QjtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU8sS0FBSyxPQUFPLGVBQWUsS0FBSyxJQUFJLFNBQVMsbUJBQW1CLE9BQU87QUFBQSxNQUM3RSxjQUFjLE9BQU8sU0FBUyxpQkFBaUIsV0FBVyxlQUFlLFVBQVUsS0FBSyxTQUFTLFlBQVksSUFBSTtBQUFBLE1BQ2pILGdCQUFnQixTQUFTO0FBQUEsTUFDekIsZUFBZSxTQUFTO0FBQUEsSUFDekIsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNRLFlBQVksVUFBNkU7QUFDaEcsUUFBSSxLQUFLLFdBQVc7QUFDbkIsV0FBSyxZQUFZLEtBQUssK0JBQStCO0FBQ3JELGFBQU8sUUFBUSxRQUFRLE1BQVM7QUFBQSxJQUNqQztBQUVBLFdBQU8sU0FBUyxFQUFFLEtBQUssTUFBTSxNQUFNLFNBQU87QUFDekMsVUFBSSxFQUFFLGVBQWUsU0FBUyxJQUFJLFNBQVMsYUFBYTtBQUN2RCxhQUFLLFlBQVksS0FBSyxHQUFHO0FBQUEsTUFDMUI7QUFDQSxhQUFPO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDRjtBQUNEOyIsCiAgIm5hbWVzIjogWyJvcHRpb25zIl0KfQo=
