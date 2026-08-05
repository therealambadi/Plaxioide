import { stringDiff } from "../../../base/common/diff/diff.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
import { computeLinks } from "../languages/linkComputer.js";
import { BasicInplaceReplace } from "../languages/supports/inplaceReplaceSupport.js";
import { createMonacoBaseAPI } from "./editorBaseApi.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { UnicodeTextModelHighlighter } from "./unicodeTextModelHighlighter.js";
import { DiffComputer } from "../diff/legacyLinesDiffComputer.js";
import { linesDiffComputers } from "../diff/linesDiffComputers.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { computeDefaultDocumentColors } from "../languages/defaultDocumentColorsComputer.js";
import { findSectionHeaders } from "./findSectionHeaders.js";
import { WorkerTextModelSyncServer } from "./textModelSync/textModelSync.impl.js";
const _EditorWorker = class _EditorWorker {
  constructor(_foreignModule = null) {
    this._foreignModule = _foreignModule;
    this._workerTextModelSyncServer = new WorkerTextModelSyncServer();
  }
  dispose() {
  }
  async $ping() {
    return "pong";
  }
  _getModel(uri) {
    return this._workerTextModelSyncServer.getModel(uri);
  }
  getModels() {
    return this._workerTextModelSyncServer.getModels();
  }
  $acceptNewModel(data) {
    this._workerTextModelSyncServer.$acceptNewModel(data);
  }
  $acceptModelChanged(uri, e) {
    this._workerTextModelSyncServer.$acceptModelChanged(uri, e);
  }
  $acceptRemovedModel(uri) {
    this._workerTextModelSyncServer.$acceptRemovedModel(uri);
  }
  async $computeUnicodeHighlights(url, options, range) {
    const model = this._getModel(url);
    if (!model) {
      return { ranges: [], hasMore: false, ambiguousCharacterCount: 0, invisibleCharacterCount: 0, nonBasicAsciiCharacterCount: 0 };
    }
    return UnicodeTextModelHighlighter.computeUnicodeHighlights(model, options, range);
  }
  async $findSectionHeaders(url, options) {
    const model = this._getModel(url);
    if (!model) {
      return [];
    }
    return findSectionHeaders(model, options);
  }
  // ---- BEGIN diff --------------------------------------------------------------------------
  async $computeDiff(originalUrl, modifiedUrl, options, algorithm) {
    const original = this._getModel(originalUrl);
    const modified = this._getModel(modifiedUrl);
    if (!original || !modified) {
      return null;
    }
    const result = _EditorWorker.computeDiff(original, modified, options, algorithm);
    return result;
  }
  static computeDiff(originalTextModel, modifiedTextModel, options, algorithm) {
    const diffAlgorithm = algorithm === "advanced" ? linesDiffComputers.getDefault() : linesDiffComputers.getLegacy();
    const originalLines = originalTextModel.getLinesContent();
    const modifiedLines = modifiedTextModel.getLinesContent();
    const result = diffAlgorithm.computeDiff(originalLines, modifiedLines, options);
    const identical = result.changes.length > 0 ? false : this._modelsAreIdentical(originalTextModel, modifiedTextModel);
    function getLineChanges(changes) {
      return changes.map((m) => [m.original.startLineNumber, m.original.endLineNumberExclusive, m.modified.startLineNumber, m.modified.endLineNumberExclusive, m.innerChanges?.map((m2) => [
        m2.originalRange.startLineNumber,
        m2.originalRange.startColumn,
        m2.originalRange.endLineNumber,
        m2.originalRange.endColumn,
        m2.modifiedRange.startLineNumber,
        m2.modifiedRange.startColumn,
        m2.modifiedRange.endLineNumber,
        m2.modifiedRange.endColumn
      ])]);
    }
    return {
      identical,
      quitEarly: result.hitTimeout,
      changes: getLineChanges(result.changes),
      moves: result.moves.map((m) => [
        m.lineRangeMapping.original.startLineNumber,
        m.lineRangeMapping.original.endLineNumberExclusive,
        m.lineRangeMapping.modified.startLineNumber,
        m.lineRangeMapping.modified.endLineNumberExclusive,
        getLineChanges(m.changes)
      ])
    };
  }
  static _modelsAreIdentical(original, modified) {
    const originalLineCount = original.getLineCount();
    const modifiedLineCount = modified.getLineCount();
    if (originalLineCount !== modifiedLineCount) {
      return false;
    }
    for (let line = 1; line <= originalLineCount; line++) {
      const originalLine = original.getLineContent(line);
      const modifiedLine = modified.getLineContent(line);
      if (originalLine !== modifiedLine) {
        return false;
      }
    }
    return true;
  }
  async $computeDirtyDiff(originalUrl, modifiedUrl, ignoreTrimWhitespace) {
    const original = this._getModel(originalUrl);
    const modified = this._getModel(modifiedUrl);
    if (!original || !modified) {
      return null;
    }
    const originalLines = original.getLinesContent();
    const modifiedLines = modified.getLinesContent();
    const diffComputer = new DiffComputer(originalLines, modifiedLines, {
      shouldComputeCharChanges: false,
      shouldPostProcessCharChanges: false,
      shouldIgnoreTrimWhitespace: ignoreTrimWhitespace,
      shouldMakePrettyDiff: true,
      maxComputationTime: 1e3
    });
    return diffComputer.computeDiff().changes;
  }
  async $computeMoreMinimalEdits(modelUrl, edits, pretty) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return edits;
    }
    const result = [];
    let lastEol = void 0;
    edits = edits.slice(0).sort((a, b) => {
      if (a.range && b.range) {
        return Range.compareRangesUsingStarts(a.range, b.range);
      }
      const aRng = a.range ? 0 : 1;
      const bRng = b.range ? 0 : 1;
      return aRng - bRng;
    });
    let writeIndex = 0;
    for (let readIndex = 1; readIndex < edits.length; readIndex++) {
      if (Range.getEndPosition(edits[writeIndex].range).equals(Range.getStartPosition(edits[readIndex].range))) {
        edits[writeIndex].range = Range.fromPositions(Range.getStartPosition(edits[writeIndex].range), Range.getEndPosition(edits[readIndex].range));
        edits[writeIndex].text += edits[readIndex].text;
      } else {
        writeIndex++;
        edits[writeIndex] = edits[readIndex];
      }
    }
    edits.length = writeIndex + 1;
    for (let { range, text, eol } of edits) {
      if (typeof eol === "number") {
        lastEol = eol;
      }
      if (Range.isEmpty(range) && !text) {
        continue;
      }
      const original = model.getValueInRange(range);
      text = text.replace(/\r\n|\n|\r/g, model.eol);
      if (original === text) {
        continue;
      }
      if (Math.max(text.length, original.length) > _EditorWorker._diffLimit) {
        result.push({ range, text });
        continue;
      }
      const changes = stringDiff(original, text, pretty);
      const editOffset = model.offsetAt(Range.lift(range).getStartPosition());
      for (const change of changes) {
        const start = model.positionAt(editOffset + change.originalStart);
        const end = model.positionAt(editOffset + change.originalStart + change.originalLength);
        const newEdit = {
          text: text.substr(change.modifiedStart, change.modifiedLength),
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column }
        };
        if (model.getValueInRange(newEdit.range) !== newEdit.text) {
          result.push(newEdit);
        }
      }
    }
    if (typeof lastEol === "number") {
      result.push({ eol: lastEol, text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } });
    }
    return result;
  }
  $computeHumanReadableDiff(modelUrl, edits, options) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return edits;
    }
    const result = [];
    let lastEol = void 0;
    edits = edits.slice(0).sort((a, b) => {
      if (a.range && b.range) {
        return Range.compareRangesUsingStarts(a.range, b.range);
      }
      const aRng = a.range ? 0 : 1;
      const bRng = b.range ? 0 : 1;
      return aRng - bRng;
    });
    for (let { range, text, eol } of edits) {
      let addPositions2 = function(pos1, pos2) {
        return new Position(pos1.lineNumber + pos2.lineNumber - 1, pos2.lineNumber === 1 ? pos1.column + pos2.column - 1 : pos2.column);
      }, getText2 = function(lines, range2) {
        const result2 = [];
        for (let i = range2.startLineNumber; i <= range2.endLineNumber; i++) {
          const line = lines[i - 1];
          if (i === range2.startLineNumber && i === range2.endLineNumber) {
            result2.push(line.substring(range2.startColumn - 1, range2.endColumn - 1));
          } else if (i === range2.startLineNumber) {
            result2.push(line.substring(range2.startColumn - 1));
          } else if (i === range2.endLineNumber) {
            result2.push(line.substring(0, range2.endColumn - 1));
          } else {
            result2.push(line);
          }
        }
        return result2;
      };
      var addPositions = addPositions2, getText = getText2;
      if (typeof eol === "number") {
        lastEol = eol;
      }
      if (Range.isEmpty(range) && !text) {
        continue;
      }
      const original = model.getValueInRange(range);
      text = text.replace(/\r\n|\n|\r/g, model.eol);
      if (original === text) {
        continue;
      }
      if (Math.max(text.length, original.length) > _EditorWorker._diffLimit) {
        result.push({ range, text });
        continue;
      }
      const originalLines = original.split(/\r\n|\n|\r/);
      const modifiedLines = text.split(/\r\n|\n|\r/);
      const diff = linesDiffComputers.getDefault().computeDiff(originalLines, modifiedLines, options);
      const start = Range.lift(range).getStartPosition();
      for (const c of diff.changes) {
        if (c.innerChanges) {
          for (const x of c.innerChanges) {
            result.push({
              range: Range.fromPositions(
                addPositions2(start, x.originalRange.getStartPosition()),
                addPositions2(start, x.originalRange.getEndPosition())
              ),
              text: getText2(modifiedLines, x.modifiedRange).join(model.eol)
            });
          }
        } else {
          throw new BugIndicatingError("The experimental diff algorithm always produces inner changes");
        }
      }
    }
    if (typeof lastEol === "number") {
      result.push({ eol: lastEol, text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } });
    }
    return result;
  }
  // ---- END minimal edits ---------------------------------------------------------------
  async $computeLinks(modelUrl) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return null;
    }
    return computeLinks(model);
  }
  // --- BEGIN default document colors -----------------------------------------------------------
  async $computeDefaultDocumentColors(modelUrl) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return null;
    }
    return computeDefaultDocumentColors(model);
  }
  async $textualSuggest(modelUrls, leadingWord, wordDef, wordDefFlags) {
    const sw = new StopWatch();
    const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
    const seen = /* @__PURE__ */ new Set();
    outer: for (const url of modelUrls) {
      const model = this._getModel(url);
      if (!model) {
        continue;
      }
      for (const word of model.words(wordDefRegExp)) {
        if (word === leadingWord || !isNaN(Number(word))) {
          continue;
        }
        seen.add(word);
        if (seen.size > _EditorWorker._suggestionsLimit) {
          break outer;
        }
      }
    }
    return { words: Array.from(seen), duration: sw.elapsed() };
  }
  // ---- END suggest --------------------------------------------------------------------------
  //#region -- word ranges --
  async $computeWordRanges(modelUrl, range, wordDef, wordDefFlags) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return /* @__PURE__ */ Object.create(null);
    }
    const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
    const result = /* @__PURE__ */ Object.create(null);
    for (let line = range.startLineNumber; line < range.endLineNumber; line++) {
      const words = model.getLineWords(line, wordDefRegExp);
      for (const word of words) {
        if (!isNaN(Number(word.word))) {
          continue;
        }
        let array = result[word.word];
        if (!array) {
          array = [];
          result[word.word] = array;
        }
        array.push({
          startLineNumber: line,
          startColumn: word.startColumn,
          endLineNumber: line,
          endColumn: word.endColumn
        });
      }
    }
    return result;
  }
  //#endregion
  async $navigateValueSet(modelUrl, range, up, wordDef, wordDefFlags) {
    const model = this._getModel(modelUrl);
    if (!model) {
      return null;
    }
    const wordDefRegExp = new RegExp(wordDef, wordDefFlags);
    if (range.startColumn === range.endColumn) {
      range = {
        startLineNumber: range.startLineNumber,
        startColumn: range.startColumn,
        endLineNumber: range.endLineNumber,
        endColumn: range.endColumn + 1
      };
    }
    const selectionText = model.getValueInRange(range);
    const wordRange = model.getWordAtPosition({ lineNumber: range.startLineNumber, column: range.startColumn }, wordDefRegExp);
    if (!wordRange) {
      return null;
    }
    const word = model.getValueInRange(wordRange);
    const result = BasicInplaceReplace.INSTANCE.navigateValueSet(range, selectionText, wordRange, word, up);
    return result;
  }
  // ---- BEGIN foreign module support --------------------------------------------------------------------------
  // foreign method request
  $fmr(method, args) {
    if (!this._foreignModule || typeof this._foreignModule[method] !== "function") {
      return Promise.reject(new Error("Missing requestHandler or method: " + method));
    }
    try {
      return Promise.resolve(this._foreignModule[method].apply(this._foreignModule, args));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  // ---- END foreign module support --------------------------------------------------------------------------
};
// ---- END diff --------------------------------------------------------------------------
// ---- BEGIN minimal edits ---------------------------------------------------------------
_EditorWorker._diffLimit = 1e5;
// ---- BEGIN suggest --------------------------------------------------------------------------
_EditorWorker._suggestionsLimit = 1e4;
let EditorWorker = _EditorWorker;
if (typeof importScripts === "function") {
  globalThis.monaco = createMonacoBaseAPI();
}
export {
  EditorWorker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldlYldvcmtlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHN0cmluZ0RpZmYgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9kaWZmL2RpZmYuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3dvcmtlci93ZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1pcnJvclRleHRNb2RlbCwgSU1vZGVsQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vbW9kZWwvbWlycm9yVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElDb2xvckluZm9ybWF0aW9uLCBJSW5wbGFjZVJlcGxhY2VTdXBwb3J0UmVzdWx0LCBJTGluaywgVGV4dEVkaXQgfSBmcm9tICcuLi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgY29tcHV0ZUxpbmtzIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL2xpbmtDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBCYXNpY0lucGxhY2VSZXBsYWNlIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL3N1cHBvcnRzL2lucGxhY2VSZXBsYWNlU3VwcG9ydC5qcyc7XG5pbXBvcnQgeyBEaWZmQWxnb3JpdGhtTmFtZSwgSURpZmZDb21wdXRhdGlvblJlc3VsdCwgSUxpbmVDaGFuZ2UsIElVbmljb2RlSGlnaGxpZ2h0c1Jlc3VsdCB9IGZyb20gJy4vZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vbmFjb0Jhc2VBUEkgfSBmcm9tICcuL2VkaXRvckJhc2VBcGkuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IFVuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlciwgVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucyB9IGZyb20gJy4vdW5pY29kZVRleHRNb2RlbEhpZ2hsaWdodGVyLmpzJztcbmltcG9ydCB7IERpZmZDb21wdXRlciwgSUNoYW5nZSB9IGZyb20gJy4uL2RpZmYvbGVnYWN5TGluZXNEaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgSUxpbmVzRGlmZkNvbXB1dGVyLCBJTGluZXNEaWZmQ29tcHV0ZXJPcHRpb25zIH0gZnJvbSAnLi4vZGlmZi9saW5lc0RpZmZDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBsaW5lc0RpZmZDb21wdXRlcnMgfSBmcm9tICcuLi9kaWZmL2xpbmVzRGlmZkNvbXB1dGVycy5qcyc7XG5pbXBvcnQgeyBJRG9jdW1lbnREaWZmUHJvdmlkZXJPcHRpb25zIH0gZnJvbSAnLi4vZGlmZi9kb2N1bWVudERpZmZQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgY29tcHV0ZURlZmF1bHREb2N1bWVudENvbG9ycyB9IGZyb20gJy4uL2xhbmd1YWdlcy9kZWZhdWx0RG9jdW1lbnRDb2xvcnNDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMsIFNlY3Rpb25IZWFkZXIsIGZpbmRTZWN0aW9uSGVhZGVycyB9IGZyb20gJy4vZmluZFNlY3Rpb25IZWFkZXJzLmpzJztcbmltcG9ydCB7IElSYXdNb2RlbERhdGEsIElXb3JrZXJUZXh0TW9kZWxTeW5jQ2hhbm5lbFNlcnZlciB9IGZyb20gJy4vdGV4dE1vZGVsU3luYy90ZXh0TW9kZWxTeW5jLnByb3RvY29sLmpzJztcbmltcG9ydCB7IElDb21tb25Nb2RlbCwgV29ya2VyVGV4dE1vZGVsU3luY1NlcnZlciB9IGZyb20gJy4vdGV4dE1vZGVsU3luYy90ZXh0TW9kZWxTeW5jLmltcGwuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNaXJyb3JNb2RlbCBleHRlbmRzIElNaXJyb3JUZXh0TW9kZWwge1xuXHRyZWFkb25seSB1cmk6IFVSSTtcblx0cmVhZG9ubHkgdmVyc2lvbjogbnVtYmVyO1xuXHRnZXRWYWx1ZSgpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtlckNvbnRleHQ8SCA9IHVuZGVmaW5lZD4ge1xuXHQvKipcblx0ICogQSBwcm94eSB0byB0aGUgbWFpbiB0aHJlYWQgaG9zdCBvYmplY3QuXG5cdCAqL1xuXHRob3N0OiBIO1xuXHQvKipcblx0ICogR2V0IGFsbCBhdmFpbGFibGUgbWlycm9yIG1vZGVscyBpbiB0aGlzIHdvcmtlci5cblx0ICovXG5cdGdldE1pcnJvck1vZGVscygpOiBJTWlycm9yTW9kZWxbXTtcbn1cblxuLyoqXG4gKiBSYW5nZSBvZiBhIHdvcmQgaW5zaWRlIGEgbW9kZWwuXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJV29yZFJhbmdlIHtcblx0LyoqXG5cdCAqIFRoZSBpbmRleCB3aGVyZSB0aGUgd29yZCBzdGFydHMuXG5cdCAqL1xuXHRyZWFkb25seSBzdGFydDogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGluZGV4IHdoZXJlIHRoZSB3b3JkIGVuZHMuXG5cdCAqL1xuXHRyZWFkb25seSBlbmQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNsYXNzIEVkaXRvcldvcmtlciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlLCBJV29ya2VyVGV4dE1vZGVsU3luY0NoYW5uZWxTZXJ2ZXIsIElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB7XG5cdF9yZXF1ZXN0SGFuZGxlckJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd29ya2VyVGV4dE1vZGVsU3luY1NlcnZlciA9IG5ldyBXb3JrZXJUZXh0TW9kZWxTeW5jU2VydmVyKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZm9yZWlnbk1vZHVsZTogYW55IHwgbnVsbCA9IG51bGxcblx0KSB7IH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRwaW5nKCkge1xuXHRcdHJldHVybiAncG9uZyc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldE1vZGVsKHVyaTogc3RyaW5nKTogSUNvbW1vbk1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya2VyVGV4dE1vZGVsU3luY1NlcnZlci5nZXRNb2RlbCh1cmkpO1xuXHR9XG5cblx0cHVibGljIGdldE1vZGVscygpOiBJQ29tbW9uTW9kZWxbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtlclRleHRNb2RlbFN5bmNTZXJ2ZXIuZ2V0TW9kZWxzKCk7XG5cdH1cblxuXHRwdWJsaWMgJGFjY2VwdE5ld01vZGVsKGRhdGE6IElSYXdNb2RlbERhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl93b3JrZXJUZXh0TW9kZWxTeW5jU2VydmVyLiRhY2NlcHROZXdNb2RlbChkYXRhKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0TW9kZWxDaGFuZ2VkKHVyaTogc3RyaW5nLCBlOiBJTW9kZWxDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl93b3JrZXJUZXh0TW9kZWxTeW5jU2VydmVyLiRhY2NlcHRNb2RlbENoYW5nZWQodXJpLCBlKTtcblx0fVxuXG5cdHB1YmxpYyAkYWNjZXB0UmVtb3ZlZE1vZGVsKHVyaTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fd29ya2VyVGV4dE1vZGVsU3luY1NlcnZlci4kYWNjZXB0UmVtb3ZlZE1vZGVsKHVyaSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGNvbXB1dGVVbmljb2RlSGlnaGxpZ2h0cyh1cmw6IHN0cmluZywgb3B0aW9uczogVW5pY29kZUhpZ2hsaWdodGVyT3B0aW9ucywgcmFuZ2U/OiBJUmFuZ2UpOiBQcm9taXNlPElVbmljb2RlSGlnaGxpZ2h0c1Jlc3VsdD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZ2V0TW9kZWwodXJsKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4geyByYW5nZXM6IFtdLCBoYXNNb3JlOiBmYWxzZSwgYW1iaWd1b3VzQ2hhcmFjdGVyQ291bnQ6IDAsIGludmlzaWJsZUNoYXJhY3RlckNvdW50OiAwLCBub25CYXNpY0FzY2lpQ2hhcmFjdGVyQ291bnQ6IDAgfTtcblx0XHR9XG5cdFx0cmV0dXJuIFVuaWNvZGVUZXh0TW9kZWxIaWdobGlnaHRlci5jb21wdXRlVW5pY29kZUhpZ2hsaWdodHMobW9kZWwsIG9wdGlvbnMsIHJhbmdlKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkZmluZFNlY3Rpb25IZWFkZXJzKHVybDogc3RyaW5nLCBvcHRpb25zOiBGaW5kU2VjdGlvbkhlYWRlck9wdGlvbnMpOiBQcm9taXNlPFNlY3Rpb25IZWFkZXJbXT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZ2V0TW9kZWwodXJsKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiBmaW5kU2VjdGlvbkhlYWRlcnMobW9kZWwsIG9wdGlvbnMpO1xuXHR9XG5cblx0Ly8gLS0tLSBCRUdJTiBkaWZmIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0cHVibGljIGFzeW5jICRjb21wdXRlRGlmZihvcmlnaW5hbFVybDogc3RyaW5nLCBtb2RpZmllZFVybDogc3RyaW5nLCBvcHRpb25zOiBJRG9jdW1lbnREaWZmUHJvdmlkZXJPcHRpb25zLCBhbGdvcml0aG06IERpZmZBbGdvcml0aG1OYW1lKTogUHJvbWlzZTxJRGlmZkNvbXB1dGF0aW9uUmVzdWx0IHwgbnVsbD4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdGhpcy5fZ2V0TW9kZWwob3JpZ2luYWxVcmwpO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5fZ2V0TW9kZWwobW9kaWZpZWRVcmwpO1xuXHRcdGlmICghb3JpZ2luYWwgfHwgIW1vZGlmaWVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBFZGl0b3JXb3JrZXIuY29tcHV0ZURpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBvcHRpb25zLCBhbGdvcml0aG0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBjb21wdXRlRGlmZihvcmlnaW5hbFRleHRNb2RlbDogSUNvbW1vbk1vZGVsIHwgSVRleHRNb2RlbCwgbW9kaWZpZWRUZXh0TW9kZWw6IElDb21tb25Nb2RlbCB8IElUZXh0TW9kZWwsIG9wdGlvbnM6IElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMsIGFsZ29yaXRobTogRGlmZkFsZ29yaXRobU5hbWUpOiBJRGlmZkNvbXB1dGF0aW9uUmVzdWx0IHtcblx0XHRjb25zdCBkaWZmQWxnb3JpdGhtOiBJTGluZXNEaWZmQ29tcHV0ZXIgPSBhbGdvcml0aG0gPT09ICdhZHZhbmNlZCcgPyBsaW5lc0RpZmZDb21wdXRlcnMuZ2V0RGVmYXVsdCgpIDogbGluZXNEaWZmQ29tcHV0ZXJzLmdldExlZ2FjeSgpO1xuXG5cdFx0Y29uc3Qgb3JpZ2luYWxMaW5lcyA9IG9yaWdpbmFsVGV4dE1vZGVsLmdldExpbmVzQ29udGVudCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkTGluZXMgPSBtb2RpZmllZFRleHRNb2RlbC5nZXRMaW5lc0NvbnRlbnQoKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGRpZmZBbGdvcml0aG0uY29tcHV0ZURpZmYob3JpZ2luYWxMaW5lcywgbW9kaWZpZWRMaW5lcywgb3B0aW9ucyk7XG5cblx0XHRjb25zdCBpZGVudGljYWwgPSAocmVzdWx0LmNoYW5nZXMubGVuZ3RoID4gMCA/IGZhbHNlIDogdGhpcy5fbW9kZWxzQXJlSWRlbnRpY2FsKG9yaWdpbmFsVGV4dE1vZGVsLCBtb2RpZmllZFRleHRNb2RlbCkpO1xuXG5cdFx0ZnVuY3Rpb24gZ2V0TGluZUNoYW5nZXMoY2hhbmdlczogcmVhZG9ubHkgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10pOiBJTGluZUNoYW5nZVtdIHtcblx0XHRcdHJldHVybiBjaGFuZ2VzLm1hcChtID0+IChbbS5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIsIG0ub3JpZ2luYWwuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSwgbS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIsIG0ubW9kaWZpZWQuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSwgbS5pbm5lckNoYW5nZXM/Lm1hcChtID0+IFtcblx0XHRcdFx0bS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0bS5vcmlnaW5hbFJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRtLm9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0bS5vcmlnaW5hbFJhbmdlLmVuZENvbHVtbixcblx0XHRcdFx0bS5tb2RpZmllZFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0bS5tb2RpZmllZFJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRtLm1vZGlmaWVkUmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0bS5tb2RpZmllZFJhbmdlLmVuZENvbHVtbixcblx0XHRcdF0pXSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpZGVudGljYWwsXG5cdFx0XHRxdWl0RWFybHk6IHJlc3VsdC5oaXRUaW1lb3V0LFxuXHRcdFx0Y2hhbmdlczogZ2V0TGluZUNoYW5nZXMocmVzdWx0LmNoYW5nZXMpLFxuXHRcdFx0bW92ZXM6IHJlc3VsdC5tb3Zlcy5tYXAobSA9PiAoW1xuXHRcdFx0XHRtLmxpbmVSYW5nZU1hcHBpbmcub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRtLmxpbmVSYW5nZU1hcHBpbmcub3JpZ2luYWwuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSxcblx0XHRcdFx0bS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0bS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUsXG5cdFx0XHRcdGdldExpbmVDaGFuZ2VzKG0uY2hhbmdlcylcblx0XHRcdF0pKSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX21vZGVsc0FyZUlkZW50aWNhbChvcmlnaW5hbDogSUNvbW1vbk1vZGVsIHwgSVRleHRNb2RlbCwgbW9kaWZpZWQ6IElDb21tb25Nb2RlbCB8IElUZXh0TW9kZWwpOiBib29sZWFuIHtcblx0XHRjb25zdCBvcmlnaW5hbExpbmVDb3VudCA9IG9yaWdpbmFsLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkTGluZUNvdW50ID0gbW9kaWZpZWQuZ2V0TGluZUNvdW50KCk7XG5cdFx0aWYgKG9yaWdpbmFsTGluZUNvdW50ICE9PSBtb2RpZmllZExpbmVDb3VudCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRmb3IgKGxldCBsaW5lID0gMTsgbGluZSA8PSBvcmlnaW5hbExpbmVDb3VudDsgbGluZSsrKSB7XG5cdFx0XHRjb25zdCBvcmlnaW5hbExpbmUgPSBvcmlnaW5hbC5nZXRMaW5lQ29udGVudChsaW5lKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkTGluZSA9IG1vZGlmaWVkLmdldExpbmVDb250ZW50KGxpbmUpO1xuXHRcdFx0aWYgKG9yaWdpbmFsTGluZSAhPT0gbW9kaWZpZWRMaW5lKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGNvbXB1dGVEaXJ0eURpZmYob3JpZ2luYWxVcmw6IHN0cmluZywgbW9kaWZpZWRVcmw6IHN0cmluZywgaWdub3JlVHJpbVdoaXRlc3BhY2U6IGJvb2xlYW4pOiBQcm9taXNlPElDaGFuZ2VbXSB8IG51bGw+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRoaXMuX2dldE1vZGVsKG9yaWdpbmFsVXJsKTtcblx0XHRjb25zdCBtb2RpZmllZCA9IHRoaXMuX2dldE1vZGVsKG1vZGlmaWVkVXJsKTtcblx0XHRpZiAoIW9yaWdpbmFsIHx8ICFtb2RpZmllZCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3JpZ2luYWxMaW5lcyA9IG9yaWdpbmFsLmdldExpbmVzQ29udGVudCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkTGluZXMgPSBtb2RpZmllZC5nZXRMaW5lc0NvbnRlbnQoKTtcblx0XHRjb25zdCBkaWZmQ29tcHV0ZXIgPSBuZXcgRGlmZkNvbXB1dGVyKG9yaWdpbmFsTGluZXMsIG1vZGlmaWVkTGluZXMsIHtcblx0XHRcdHNob3VsZENvbXB1dGVDaGFyQ2hhbmdlczogZmFsc2UsXG5cdFx0XHRzaG91bGRQb3N0UHJvY2Vzc0NoYXJDaGFuZ2VzOiBmYWxzZSxcblx0XHRcdHNob3VsZElnbm9yZVRyaW1XaGl0ZXNwYWNlOiBpZ25vcmVUcmltV2hpdGVzcGFjZSxcblx0XHRcdHNob3VsZE1ha2VQcmV0dHlEaWZmOiB0cnVlLFxuXHRcdFx0bWF4Q29tcHV0YXRpb25UaW1lOiAxMDAwXG5cdFx0fSk7XG5cdFx0cmV0dXJuIGRpZmZDb21wdXRlci5jb21wdXRlRGlmZigpLmNoYW5nZXM7XG5cdH1cblxuXHQvLyAtLS0tIEVORCBkaWZmIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblxuXHQvLyAtLS0tIEJFR0lOIG1pbmltYWwgZWRpdHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX2RpZmZMaW1pdCA9IDEwMDAwMDtcblxuXHRwdWJsaWMgYXN5bmMgJGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKG1vZGVsVXJsOiBzdHJpbmcsIGVkaXRzOiBUZXh0RWRpdFtdLCBwcmV0dHk6IGJvb2xlYW4pOiBQcm9taXNlPFRleHRFZGl0W10+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2dldE1vZGVsKG1vZGVsVXJsKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gZWRpdHM7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0OiBUZXh0RWRpdFtdID0gW107XG5cdFx0bGV0IGxhc3RFb2w6IEVuZE9mTGluZVNlcXVlbmNlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0ZWRpdHMgPSBlZGl0cy5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5yYW5nZSAmJiBiLnJhbmdlKSB7XG5cdFx0XHRcdHJldHVybiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBlb2wgb25seSBjaGFuZ2VzIHNob3VsZCBnbyB0byB0aGUgZW5kXG5cdFx0XHRjb25zdCBhUm5nID0gYS5yYW5nZSA/IDAgOiAxO1xuXHRcdFx0Y29uc3QgYlJuZyA9IGIucmFuZ2UgPyAwIDogMTtcblx0XHRcdHJldHVybiBhUm5nIC0gYlJuZztcblx0XHR9KTtcblxuXHRcdC8vIG1lcmdlIGFkamFjZW50IGVkaXRzXG5cdFx0bGV0IHdyaXRlSW5kZXggPSAwO1xuXHRcdGZvciAobGV0IHJlYWRJbmRleCA9IDE7IHJlYWRJbmRleCA8IGVkaXRzLmxlbmd0aDsgcmVhZEluZGV4KyspIHtcblx0XHRcdGlmIChSYW5nZS5nZXRFbmRQb3NpdGlvbihlZGl0c1t3cml0ZUluZGV4XS5yYW5nZSkuZXF1YWxzKFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oZWRpdHNbcmVhZEluZGV4XS5yYW5nZSkpKSB7XG5cdFx0XHRcdGVkaXRzW3dyaXRlSW5kZXhdLnJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhSYW5nZS5nZXRTdGFydFBvc2l0aW9uKGVkaXRzW3dyaXRlSW5kZXhdLnJhbmdlKSwgUmFuZ2UuZ2V0RW5kUG9zaXRpb24oZWRpdHNbcmVhZEluZGV4XS5yYW5nZSkpO1xuXHRcdFx0XHRlZGl0c1t3cml0ZUluZGV4XS50ZXh0ICs9IGVkaXRzW3JlYWRJbmRleF0udGV4dDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdyaXRlSW5kZXgrKztcblx0XHRcdFx0ZWRpdHNbd3JpdGVJbmRleF0gPSBlZGl0c1tyZWFkSW5kZXhdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlZGl0cy5sZW5ndGggPSB3cml0ZUluZGV4ICsgMTtcblxuXHRcdGZvciAobGV0IHsgcmFuZ2UsIHRleHQsIGVvbCB9IG9mIGVkaXRzKSB7XG5cblx0XHRcdGlmICh0eXBlb2YgZW9sID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRsYXN0RW9sID0gZW9sO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoUmFuZ2UuaXNFbXB0eShyYW5nZSkgJiYgIXRleHQpIHtcblx0XHRcdFx0Ly8gZW1wdHkgY2hhbmdlXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvcmlnaW5hbCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSk7XG5cdFx0XHR0ZXh0ID0gdGV4dC5yZXBsYWNlKC9cXHJcXG58XFxufFxcci9nLCBtb2RlbC5lb2wpO1xuXG5cdFx0XHRpZiAob3JpZ2luYWwgPT09IHRleHQpIHtcblx0XHRcdFx0Ly8gbm9vcFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gbWFrZSBzdXJlIGRpZmYgd29uJ3QgdGFrZSB0b28gbG9uZ1xuXHRcdFx0aWYgKE1hdGgubWF4KHRleHQubGVuZ3RoLCBvcmlnaW5hbC5sZW5ndGgpID4gRWRpdG9yV29ya2VyLl9kaWZmTGltaXQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goeyByYW5nZSwgdGV4dCB9KTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGNvbXB1dGUgZGlmZiBiZXR3ZWVuIG9yaWdpbmFsIGFuZCBlZGl0LnRleHRcblx0XHRcdGNvbnN0IGNoYW5nZXMgPSBzdHJpbmdEaWZmKG9yaWdpbmFsLCB0ZXh0LCBwcmV0dHkpO1xuXHRcdFx0Y29uc3QgZWRpdE9mZnNldCA9IG1vZGVsLm9mZnNldEF0KFJhbmdlLmxpZnQocmFuZ2UpLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cblx0XHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSBtb2RlbC5wb3NpdGlvbkF0KGVkaXRPZmZzZXQgKyBjaGFuZ2Uub3JpZ2luYWxTdGFydCk7XG5cdFx0XHRcdGNvbnN0IGVuZCA9IG1vZGVsLnBvc2l0aW9uQXQoZWRpdE9mZnNldCArIGNoYW5nZS5vcmlnaW5hbFN0YXJ0ICsgY2hhbmdlLm9yaWdpbmFsTGVuZ3RoKTtcblx0XHRcdFx0Y29uc3QgbmV3RWRpdDogVGV4dEVkaXQgPSB7XG5cdFx0XHRcdFx0dGV4dDogdGV4dC5zdWJzdHIoY2hhbmdlLm1vZGlmaWVkU3RhcnQsIGNoYW5nZS5tb2RpZmllZExlbmd0aCksXG5cdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiBzdGFydC5saW5lTnVtYmVyLCBzdGFydENvbHVtbjogc3RhcnQuY29sdW1uLCBlbmRMaW5lTnVtYmVyOiBlbmQubGluZU51bWJlciwgZW5kQ29sdW1uOiBlbmQuY29sdW1uIH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAobW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ld0VkaXQucmFuZ2UpICE9PSBuZXdFZGl0LnRleHQpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChuZXdFZGl0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgbGFzdEVvbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHsgZW9sOiBsYXN0RW9sLCB0ZXh0OiAnJywgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAwLCBzdGFydENvbHVtbjogMCwgZW5kTGluZU51bWJlcjogMCwgZW5kQ29sdW1uOiAwIH0gfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyAkY29tcHV0ZUh1bWFuUmVhZGFibGVEaWZmKG1vZGVsVXJsOiBzdHJpbmcsIGVkaXRzOiBUZXh0RWRpdFtdLCBvcHRpb25zOiBJTGluZXNEaWZmQ29tcHV0ZXJPcHRpb25zKTogVGV4dEVkaXRbXSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9nZXRNb2RlbChtb2RlbFVybCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIGVkaXRzO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogVGV4dEVkaXRbXSA9IFtdO1xuXHRcdGxldCBsYXN0RW9sOiBFbmRPZkxpbmVTZXF1ZW5jZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGVkaXRzID0gZWRpdHMuc2xpY2UoMCkuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0aWYgKGEucmFuZ2UgJiYgYi5yYW5nZSkge1xuXHRcdFx0XHRyZXR1cm4gUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKGEucmFuZ2UsIGIucmFuZ2UpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gZW9sIG9ubHkgY2hhbmdlcyBzaG91bGQgZ28gdG8gdGhlIGVuZFxuXHRcdFx0Y29uc3QgYVJuZyA9IGEucmFuZ2UgPyAwIDogMTtcblx0XHRcdGNvbnN0IGJSbmcgPSBiLnJhbmdlID8gMCA6IDE7XG5cdFx0XHRyZXR1cm4gYVJuZyAtIGJSbmc7XG5cdFx0fSk7XG5cblx0XHRmb3IgKGxldCB7IHJhbmdlLCB0ZXh0LCBlb2wgfSBvZiBlZGl0cykge1xuXG5cdFx0XHRpZiAodHlwZW9mIGVvbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0bGFzdEVvbCA9IGVvbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKFJhbmdlLmlzRW1wdHkocmFuZ2UpICYmICF0ZXh0KSB7XG5cdFx0XHRcdC8vIGVtcHR5IGNoYW5nZVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3JpZ2luYWwgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UocmFuZ2UpO1xuXHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxyXFxufFxcbnxcXHIvZywgbW9kZWwuZW9sKTtcblxuXHRcdFx0aWYgKG9yaWdpbmFsID09PSB0ZXh0KSB7XG5cdFx0XHRcdC8vIG5vb3Bcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIG1ha2Ugc3VyZSBkaWZmIHdvbid0IHRha2UgdG9vIGxvbmdcblx0XHRcdGlmIChNYXRoLm1heCh0ZXh0Lmxlbmd0aCwgb3JpZ2luYWwubGVuZ3RoKSA+IEVkaXRvcldvcmtlci5fZGlmZkxpbWl0KSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgcmFuZ2UsIHRleHQgfSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBjb21wdXRlIGRpZmYgYmV0d2VlbiBvcmlnaW5hbCBhbmQgZWRpdC50ZXh0XG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsTGluZXMgPSBvcmlnaW5hbC5zcGxpdCgvXFxyXFxufFxcbnxcXHIvKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkTGluZXMgPSB0ZXh0LnNwbGl0KC9cXHJcXG58XFxufFxcci8pO1xuXG5cdFx0XHRjb25zdCBkaWZmID0gbGluZXNEaWZmQ29tcHV0ZXJzLmdldERlZmF1bHQoKS5jb21wdXRlRGlmZihvcmlnaW5hbExpbmVzLCBtb2RpZmllZExpbmVzLCBvcHRpb25zKTtcblxuXHRcdFx0Y29uc3Qgc3RhcnQgPSBSYW5nZS5saWZ0KHJhbmdlKS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cblx0XHRcdGZ1bmN0aW9uIGFkZFBvc2l0aW9ucyhwb3MxOiBQb3NpdGlvbiwgcG9zMjogUG9zaXRpb24pOiBQb3NpdGlvbiB7XG5cdFx0XHRcdHJldHVybiBuZXcgUG9zaXRpb24ocG9zMS5saW5lTnVtYmVyICsgcG9zMi5saW5lTnVtYmVyIC0gMSwgcG9zMi5saW5lTnVtYmVyID09PSAxID8gcG9zMS5jb2x1bW4gKyBwb3MyLmNvbHVtbiAtIDEgOiBwb3MyLmNvbHVtbik7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGdldFRleHQobGluZXM6IHN0cmluZ1tdLCByYW5nZTogUmFuZ2UpOiBzdHJpbmdbXSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0TGluZU51bWJlcjsgaSA8PSByYW5nZS5lbmRMaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbaSAtIDFdO1xuXHRcdFx0XHRcdGlmIChpID09PSByYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgaSA9PT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2gobGluZS5zdWJzdHJpbmcocmFuZ2Uuc3RhcnRDb2x1bW4gLSAxLCByYW5nZS5lbmRDb2x1bW4gLSAxKSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChpID09PSByYW5nZS5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKGxpbmUuc3Vic3RyaW5nKHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSkpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaSA9PT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2gobGluZS5zdWJzdHJpbmcoMCwgcmFuZ2UuZW5kQ29sdW1uIC0gMSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChsaW5lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGRpZmYuY2hhbmdlcykge1xuXHRcdFx0XHRpZiAoYy5pbm5lckNoYW5nZXMpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHggb2YgYy5pbm5lckNoYW5nZXMpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMoXG5cdFx0XHRcdFx0XHRcdFx0YWRkUG9zaXRpb25zKHN0YXJ0LCB4Lm9yaWdpbmFsUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSxcblx0XHRcdFx0XHRcdFx0XHRhZGRQb3NpdGlvbnMoc3RhcnQsIHgub3JpZ2luYWxSYW5nZS5nZXRFbmRQb3NpdGlvbigpKVxuXHRcdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiBnZXRUZXh0KG1vZGlmaWVkTGluZXMsIHgubW9kaWZpZWRSYW5nZSkuam9pbihtb2RlbC5lb2wpXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignVGhlIGV4cGVyaW1lbnRhbCBkaWZmIGFsZ29yaXRobSBhbHdheXMgcHJvZHVjZXMgaW5uZXIgY2hhbmdlcycpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBsYXN0RW9sID09PSAnbnVtYmVyJykge1xuXHRcdFx0cmVzdWx0LnB1c2goeyBlb2w6IGxhc3RFb2wsIHRleHQ6ICcnLCByYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDAsIHN0YXJ0Q29sdW1uOiAwLCBlbmRMaW5lTnVtYmVyOiAwLCBlbmRDb2x1bW46IDAgfSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Ly8gLS0tLSBFTkQgbWluaW1hbCBlZGl0cyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRwdWJsaWMgYXN5bmMgJGNvbXB1dGVMaW5rcyhtb2RlbFVybDogc3RyaW5nKTogUHJvbWlzZTxJTGlua1tdIHwgbnVsbD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZ2V0TW9kZWwobW9kZWxVcmwpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21wdXRlTGlua3MobW9kZWwpO1xuXHR9XG5cblx0Ly8gLS0tIEJFR0lOIGRlZmF1bHQgZG9jdW1lbnQgY29sb3JzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0cHVibGljIGFzeW5jICRjb21wdXRlRGVmYXVsdERvY3VtZW50Q29sb3JzKG1vZGVsVXJsOiBzdHJpbmcpOiBQcm9taXNlPElDb2xvckluZm9ybWF0aW9uW10gfCBudWxsPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9nZXRNb2RlbChtb2RlbFVybCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBjb21wdXRlRGVmYXVsdERvY3VtZW50Q29sb3JzKG1vZGVsKTtcblx0fVxuXG5cdC8vIC0tLS0gQkVHSU4gc3VnZ2VzdCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9zdWdnZXN0aW9uc0xpbWl0ID0gMTAwMDA7XG5cblx0cHVibGljIGFzeW5jICR0ZXh0dWFsU3VnZ2VzdChtb2RlbFVybHM6IHN0cmluZ1tdLCBsZWFkaW5nV29yZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB3b3JkRGVmOiBzdHJpbmcsIHdvcmREZWZGbGFnczogc3RyaW5nKTogUHJvbWlzZTx7IHdvcmRzOiBzdHJpbmdbXTsgZHVyYXRpb246IG51bWJlciB9IHwgbnVsbD4ge1xuXG5cdFx0Y29uc3Qgc3cgPSBuZXcgU3RvcFdhdGNoKCk7XG5cdFx0Y29uc3Qgd29yZERlZlJlZ0V4cCA9IG5ldyBSZWdFeHAod29yZERlZiwgd29yZERlZkZsYWdzKTtcblx0XHRjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHRvdXRlcjogZm9yIChjb25zdCB1cmwgb2YgbW9kZWxVcmxzKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2dldE1vZGVsKHVybCk7XG5cdFx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IHdvcmQgb2YgbW9kZWwud29yZHMod29yZERlZlJlZ0V4cCkpIHtcblx0XHRcdFx0aWYgKHdvcmQgPT09IGxlYWRpbmdXb3JkIHx8ICFpc05hTihOdW1iZXIod29yZCkpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vlbi5hZGQod29yZCk7XG5cdFx0XHRcdGlmIChzZWVuLnNpemUgPiBFZGl0b3JXb3JrZXIuX3N1Z2dlc3Rpb25zTGltaXQpIHtcblx0XHRcdFx0XHRicmVhayBvdXRlcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHdvcmRzOiBBcnJheS5mcm9tKHNlZW4pLCBkdXJhdGlvbjogc3cuZWxhcHNlZCgpIH07XG5cdH1cblxuXG5cdC8vIC0tLS0gRU5EIHN1Z2dlc3QgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHQvLyNyZWdpb24gLS0gd29yZCByYW5nZXMgLS1cblxuXHRwdWJsaWMgYXN5bmMgJGNvbXB1dGVXb3JkUmFuZ2VzKG1vZGVsVXJsOiBzdHJpbmcsIHJhbmdlOiBJUmFuZ2UsIHdvcmREZWY6IHN0cmluZywgd29yZERlZkZsYWdzOiBzdHJpbmcpOiBQcm9taXNlPHsgW3dvcmQ6IHN0cmluZ106IElSYW5nZVtdIH0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2dldE1vZGVsKG1vZGVsVXJsKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR9XG5cdFx0Y29uc3Qgd29yZERlZlJlZ0V4cCA9IG5ldyBSZWdFeHAod29yZERlZiwgd29yZERlZkZsYWdzKTtcblx0XHRjb25zdCByZXN1bHQ6IHsgW3dvcmQ6IHN0cmluZ106IElSYW5nZVtdIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGZvciAobGV0IGxpbmUgPSByYW5nZS5zdGFydExpbmVOdW1iZXI7IGxpbmUgPCByYW5nZS5lbmRMaW5lTnVtYmVyOyBsaW5lKyspIHtcblx0XHRcdGNvbnN0IHdvcmRzID0gbW9kZWwuZ2V0TGluZVdvcmRzKGxpbmUsIHdvcmREZWZSZWdFeHApO1xuXHRcdFx0Zm9yIChjb25zdCB3b3JkIG9mIHdvcmRzKSB7XG5cdFx0XHRcdGlmICghaXNOYU4oTnVtYmVyKHdvcmQud29yZCkpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGV0IGFycmF5ID0gcmVzdWx0W3dvcmQud29yZF07XG5cdFx0XHRcdGlmICghYXJyYXkpIHtcblx0XHRcdFx0XHRhcnJheSA9IFtdO1xuXHRcdFx0XHRcdHJlc3VsdFt3b3JkLndvcmRdID0gYXJyYXk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJyYXkucHVzaCh7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsaW5lLFxuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiB3b3JkLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGxpbmUsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiB3b3JkLmVuZENvbHVtblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHB1YmxpYyBhc3luYyAkbmF2aWdhdGVWYWx1ZVNldChtb2RlbFVybDogc3RyaW5nLCByYW5nZTogSVJhbmdlLCB1cDogYm9vbGVhbiwgd29yZERlZjogc3RyaW5nLCB3b3JkRGVmRmxhZ3M6IHN0cmluZyk6IFByb21pc2U8SUlucGxhY2VSZXBsYWNlU3VwcG9ydFJlc3VsdCB8IG51bGw+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2dldE1vZGVsKG1vZGVsVXJsKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCB3b3JkRGVmUmVnRXhwID0gbmV3IFJlZ0V4cCh3b3JkRGVmLCB3b3JkRGVmRmxhZ3MpO1xuXG5cdFx0aWYgKHJhbmdlLnN0YXJ0Q29sdW1uID09PSByYW5nZS5lbmRDb2x1bW4pIHtcblx0XHRcdHJhbmdlID0ge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0c3RhcnRDb2x1bW46IHJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiByYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0XHRlbmRDb2x1bW46IHJhbmdlLmVuZENvbHVtbiArIDFcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uVGV4dCA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSk7XG5cblx0XHRjb25zdCB3b3JkUmFuZ2UgPSBtb2RlbC5nZXRXb3JkQXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IHJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiByYW5nZS5zdGFydENvbHVtbiB9LCB3b3JkRGVmUmVnRXhwKTtcblx0XHRpZiAoIXdvcmRSYW5nZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IHdvcmQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2Uod29yZFJhbmdlKTtcblx0XHRjb25zdCByZXN1bHQgPSBCYXNpY0lucGxhY2VSZXBsYWNlLklOU1RBTkNFLm5hdmlnYXRlVmFsdWVTZXQocmFuZ2UsIHNlbGVjdGlvblRleHQsIHdvcmRSYW5nZSwgd29yZCwgdXApO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvLyAtLS0tIEJFR0lOIGZvcmVpZ24gbW9kdWxlIHN1cHBvcnQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHQvLyBmb3JlaWduIG1ldGhvZCByZXF1ZXN0XG5cdHB1YmxpYyAkZm1yKG1ldGhvZDogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLl9mb3JlaWduTW9kdWxlIHx8IHR5cGVvZiB0aGlzLl9mb3JlaWduTW9kdWxlW21ldGhvZF0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWVzdEhhbmRsZXIgb3IgbWV0aG9kOiAnICsgbWV0aG9kKSk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fZm9yZWlnbk1vZHVsZVttZXRob2RdLmFwcGx5KHRoaXMuX2ZvcmVpZ25Nb2R1bGUsIGFyZ3MpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tLSBFTkQgZm9yZWlnbiBtb2R1bGUgc3VwcG9ydCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxufVxuXG4vLyBUaGlzIGlzIG9ubHkgYXZhaWxhYmxlIGluIGEgV2ViIFdvcmtlclxuZGVjbGFyZSBmdW5jdGlvbiBpbXBvcnRTY3JpcHRzKC4uLnVybHM6IHN0cmluZ1tdKTogdm9pZDtcblxuaWYgKHR5cGVvZiBpbXBvcnRTY3JpcHRzID09PSAnZnVuY3Rpb24nKSB7XG5cdC8vIFJ1bm5pbmcgaW4gYSB3ZWIgd29ya2VyXG5cdGdsb2JhbFRoaXMubW9uYWNvID0gY3JlYXRlTW9uYWNvQmFzZUFQSSgpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxrQkFBa0I7QUFJM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBaUIsYUFBYTtBQUk5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG1DQUE4RDtBQUN2RSxTQUFTLG9CQUE2QjtBQUd0QyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFrRCwwQkFBMEI7QUFFNUUsU0FBdUIsaUNBQWlDO0FBcUNqRCxNQUFNLGdCQUFOLE1BQU0sY0FBdUc7QUFBQSxFQUtuSCxZQUNrQixpQkFBNkIsTUFDN0M7QUFEZ0I7QUFIbEIsU0FBaUIsNkJBQTZCLElBQUksMEJBQTBCO0FBQUEsRUFJeEU7QUFBQSxFQUVKLFVBQWdCO0FBQUEsRUFDaEI7QUFBQSxFQUVBLE1BQWEsUUFBUTtBQUNwQixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVUsVUFBVSxLQUF1QztBQUMxRCxXQUFPLEtBQUssMkJBQTJCLFNBQVMsR0FBRztBQUFBLEVBQ3BEO0FBQUEsRUFFTyxZQUE0QjtBQUNsQyxXQUFPLEtBQUssMkJBQTJCLFVBQVU7QUFBQSxFQUNsRDtBQUFBLEVBRU8sZ0JBQWdCLE1BQTJCO0FBQ2pELFNBQUssMkJBQTJCLGdCQUFnQixJQUFJO0FBQUEsRUFDckQ7QUFBQSxFQUVPLG9CQUFvQixLQUFhLEdBQTZCO0FBQ3BFLFNBQUssMkJBQTJCLG9CQUFvQixLQUFLLENBQUM7QUFBQSxFQUMzRDtBQUFBLEVBRU8sb0JBQW9CLEtBQW1CO0FBQzdDLFNBQUssMkJBQTJCLG9CQUFvQixHQUFHO0FBQUEsRUFDeEQ7QUFBQSxFQUVBLE1BQWEsMEJBQTBCLEtBQWEsU0FBb0MsT0FBbUQ7QUFDMUksVUFBTSxRQUFRLEtBQUssVUFBVSxHQUFHO0FBQ2hDLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTyxFQUFFLFFBQVEsQ0FBQyxHQUFHLFNBQVMsT0FBTyx5QkFBeUIsR0FBRyx5QkFBeUIsR0FBRyw2QkFBNkIsRUFBRTtBQUFBLElBQzdIO0FBQ0EsV0FBTyw0QkFBNEIseUJBQXlCLE9BQU8sU0FBUyxLQUFLO0FBQUEsRUFDbEY7QUFBQSxFQUVBLE1BQWEsb0JBQW9CLEtBQWEsU0FBNkQ7QUFDMUcsVUFBTSxRQUFRLEtBQUssVUFBVSxHQUFHO0FBQ2hDLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTyxDQUFDO0FBQUEsSUFDVDtBQUNBLFdBQU8sbUJBQW1CLE9BQU8sT0FBTztBQUFBLEVBQ3pDO0FBQUE7QUFBQSxFQUlBLE1BQWEsYUFBYSxhQUFxQixhQUFxQixTQUF1QyxXQUFzRTtBQUNoTCxVQUFNLFdBQVcsS0FBSyxVQUFVLFdBQVc7QUFDM0MsVUFBTSxXQUFXLEtBQUssVUFBVSxXQUFXO0FBQzNDLFFBQUksQ0FBQyxZQUFZLENBQUMsVUFBVTtBQUMzQixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sU0FBUyxjQUFhLFlBQVksVUFBVSxVQUFVLFNBQVMsU0FBUztBQUM5RSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsT0FBZSxZQUFZLG1CQUE4QyxtQkFBOEMsU0FBdUMsV0FBc0Q7QUFDbk4sVUFBTSxnQkFBb0MsY0FBYyxhQUFhLG1CQUFtQixXQUFXLElBQUksbUJBQW1CLFVBQVU7QUFFcEksVUFBTSxnQkFBZ0Isa0JBQWtCLGdCQUFnQjtBQUN4RCxVQUFNLGdCQUFnQixrQkFBa0IsZ0JBQWdCO0FBRXhELFVBQU0sU0FBUyxjQUFjLFlBQVksZUFBZSxlQUFlLE9BQU87QUFFOUUsVUFBTSxZQUFhLE9BQU8sUUFBUSxTQUFTLElBQUksUUFBUSxLQUFLLG9CQUFvQixtQkFBbUIsaUJBQWlCO0FBRXBILGFBQVMsZUFBZSxTQUE2RDtBQUNwRixhQUFPLFFBQVEsSUFBSSxPQUFNLENBQUMsRUFBRSxTQUFTLGlCQUFpQixFQUFFLFNBQVMsd0JBQXdCLEVBQUUsU0FBUyxpQkFBaUIsRUFBRSxTQUFTLHdCQUF3QixFQUFFLGNBQWMsSUFBSSxDQUFBQSxPQUFLO0FBQUEsUUFDaExBLEdBQUUsY0FBYztBQUFBLFFBQ2hCQSxHQUFFLGNBQWM7QUFBQSxRQUNoQkEsR0FBRSxjQUFjO0FBQUEsUUFDaEJBLEdBQUUsY0FBYztBQUFBLFFBQ2hCQSxHQUFFLGNBQWM7QUFBQSxRQUNoQkEsR0FBRSxjQUFjO0FBQUEsUUFDaEJBLEdBQUUsY0FBYztBQUFBLFFBQ2hCQSxHQUFFLGNBQWM7QUFBQSxNQUNqQixDQUFDLENBQUMsQ0FBRTtBQUFBLElBQ0w7QUFFQSxXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0EsV0FBVyxPQUFPO0FBQUEsTUFDbEIsU0FBUyxlQUFlLE9BQU8sT0FBTztBQUFBLE1BQ3RDLE9BQU8sT0FBTyxNQUFNLElBQUksT0FBTTtBQUFBLFFBQzdCLEVBQUUsaUJBQWlCLFNBQVM7QUFBQSxRQUM1QixFQUFFLGlCQUFpQixTQUFTO0FBQUEsUUFDNUIsRUFBRSxpQkFBaUIsU0FBUztBQUFBLFFBQzVCLEVBQUUsaUJBQWlCLFNBQVM7QUFBQSxRQUM1QixlQUFlLEVBQUUsT0FBTztBQUFBLE1BQ3pCLENBQUU7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBZSxvQkFBb0IsVUFBcUMsVUFBOEM7QUFDckgsVUFBTSxvQkFBb0IsU0FBUyxhQUFhO0FBQ2hELFVBQU0sb0JBQW9CLFNBQVMsYUFBYTtBQUNoRCxRQUFJLHNCQUFzQixtQkFBbUI7QUFDNUMsYUFBTztBQUFBLElBQ1I7QUFDQSxhQUFTLE9BQU8sR0FBRyxRQUFRLG1CQUFtQixRQUFRO0FBQ3JELFlBQU0sZUFBZSxTQUFTLGVBQWUsSUFBSTtBQUNqRCxZQUFNLGVBQWUsU0FBUyxlQUFlLElBQUk7QUFDakQsVUFBSSxpQkFBaUIsY0FBYztBQUNsQyxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYSxrQkFBa0IsYUFBcUIsYUFBcUIsc0JBQTBEO0FBQ2xJLFVBQU0sV0FBVyxLQUFLLFVBQVUsV0FBVztBQUMzQyxVQUFNLFdBQVcsS0FBSyxVQUFVLFdBQVc7QUFDM0MsUUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVO0FBQzNCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxnQkFBZ0IsU0FBUyxnQkFBZ0I7QUFDL0MsVUFBTSxnQkFBZ0IsU0FBUyxnQkFBZ0I7QUFDL0MsVUFBTSxlQUFlLElBQUksYUFBYSxlQUFlLGVBQWU7QUFBQSxNQUNuRSwwQkFBMEI7QUFBQSxNQUMxQiw4QkFBOEI7QUFBQSxNQUM5Qiw0QkFBNEI7QUFBQSxNQUM1QixzQkFBc0I7QUFBQSxNQUN0QixvQkFBb0I7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxhQUFhLFlBQVksRUFBRTtBQUFBLEVBQ25DO0FBQUEsRUFTQSxNQUFhLHlCQUF5QixVQUFrQixPQUFtQixRQUFzQztBQUNoSCxVQUFNLFFBQVEsS0FBSyxVQUFVLFFBQVE7QUFDckMsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sU0FBcUIsQ0FBQztBQUM1QixRQUFJLFVBQXlDO0FBRTdDLFlBQVEsTUFBTSxNQUFNLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNO0FBQ3JDLFVBQUksRUFBRSxTQUFTLEVBQUUsT0FBTztBQUN2QixlQUFPLE1BQU0seUJBQXlCLEVBQUUsT0FBTyxFQUFFLEtBQUs7QUFBQSxNQUN2RDtBQUVBLFlBQU0sT0FBTyxFQUFFLFFBQVEsSUFBSTtBQUMzQixZQUFNLE9BQU8sRUFBRSxRQUFRLElBQUk7QUFDM0IsYUFBTyxPQUFPO0FBQUEsSUFDZixDQUFDO0FBR0QsUUFBSSxhQUFhO0FBQ2pCLGFBQVMsWUFBWSxHQUFHLFlBQVksTUFBTSxRQUFRLGFBQWE7QUFDOUQsVUFBSSxNQUFNLGVBQWUsTUFBTSxVQUFVLEVBQUUsS0FBSyxFQUFFLE9BQU8sTUFBTSxpQkFBaUIsTUFBTSxTQUFTLEVBQUUsS0FBSyxDQUFDLEdBQUc7QUFDekcsY0FBTSxVQUFVLEVBQUUsUUFBUSxNQUFNLGNBQWMsTUFBTSxpQkFBaUIsTUFBTSxVQUFVLEVBQUUsS0FBSyxHQUFHLE1BQU0sZUFBZSxNQUFNLFNBQVMsRUFBRSxLQUFLLENBQUM7QUFDM0ksY0FBTSxVQUFVLEVBQUUsUUFBUSxNQUFNLFNBQVMsRUFBRTtBQUFBLE1BQzVDLE9BQU87QUFDTjtBQUNBLGNBQU0sVUFBVSxJQUFJLE1BQU0sU0FBUztBQUFBLE1BQ3BDO0FBQUEsSUFDRDtBQUNBLFVBQU0sU0FBUyxhQUFhO0FBRTVCLGFBQVMsRUFBRSxPQUFPLE1BQU0sSUFBSSxLQUFLLE9BQU87QUFFdkMsVUFBSSxPQUFPLFFBQVEsVUFBVTtBQUM1QixrQkFBVTtBQUFBLE1BQ1g7QUFFQSxVQUFJLE1BQU0sUUFBUSxLQUFLLEtBQUssQ0FBQyxNQUFNO0FBRWxDO0FBQUEsTUFDRDtBQUVBLFlBQU0sV0FBVyxNQUFNLGdCQUFnQixLQUFLO0FBQzVDLGFBQU8sS0FBSyxRQUFRLGVBQWUsTUFBTSxHQUFHO0FBRTVDLFVBQUksYUFBYSxNQUFNO0FBRXRCO0FBQUEsTUFDRDtBQUdBLFVBQUksS0FBSyxJQUFJLEtBQUssUUFBUSxTQUFTLE1BQU0sSUFBSSxjQUFhLFlBQVk7QUFDckUsZUFBTyxLQUFLLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDM0I7QUFBQSxNQUNEO0FBR0EsWUFBTSxVQUFVLFdBQVcsVUFBVSxNQUFNLE1BQU07QUFDakQsWUFBTSxhQUFhLE1BQU0sU0FBUyxNQUFNLEtBQUssS0FBSyxFQUFFLGlCQUFpQixDQUFDO0FBRXRFLGlCQUFXLFVBQVUsU0FBUztBQUM3QixjQUFNLFFBQVEsTUFBTSxXQUFXLGFBQWEsT0FBTyxhQUFhO0FBQ2hFLGNBQU0sTUFBTSxNQUFNLFdBQVcsYUFBYSxPQUFPLGdCQUFnQixPQUFPLGNBQWM7QUFDdEYsY0FBTSxVQUFvQjtBQUFBLFVBQ3pCLE1BQU0sS0FBSyxPQUFPLE9BQU8sZUFBZSxPQUFPLGNBQWM7QUFBQSxVQUM3RCxPQUFPLEVBQUUsaUJBQWlCLE1BQU0sWUFBWSxhQUFhLE1BQU0sUUFBUSxlQUFlLElBQUksWUFBWSxXQUFXLElBQUksT0FBTztBQUFBLFFBQzdIO0FBRUEsWUFBSSxNQUFNLGdCQUFnQixRQUFRLEtBQUssTUFBTSxRQUFRLE1BQU07QUFDMUQsaUJBQU8sS0FBSyxPQUFPO0FBQUEsUUFDcEI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksT0FBTyxZQUFZLFVBQVU7QUFDaEMsYUFBTyxLQUFLLEVBQUUsS0FBSyxTQUFTLE1BQU0sSUFBSSxPQUFPLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsRUFBRSxDQUFDO0FBQUEsSUFDdEg7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sMEJBQTBCLFVBQWtCLE9BQW1CLFNBQWdEO0FBQ3JILFVBQU0sUUFBUSxLQUFLLFVBQVUsUUFBUTtBQUNyQyxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxTQUFxQixDQUFDO0FBQzVCLFFBQUksVUFBeUM7QUFFN0MsWUFBUSxNQUFNLE1BQU0sQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDckMsVUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPO0FBQ3ZCLGVBQU8sTUFBTSx5QkFBeUIsRUFBRSxPQUFPLEVBQUUsS0FBSztBQUFBLE1BQ3ZEO0FBRUEsWUFBTSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQzNCLFlBQU0sT0FBTyxFQUFFLFFBQVEsSUFBSTtBQUMzQixhQUFPLE9BQU87QUFBQSxJQUNmLENBQUM7QUFFRCxhQUFTLEVBQUUsT0FBTyxNQUFNLElBQUksS0FBSyxPQUFPO0FBa0N2QyxVQUFTQyxnQkFBVCxTQUFzQixNQUFnQixNQUEwQjtBQUMvRCxlQUFPLElBQUksU0FBUyxLQUFLLGFBQWEsS0FBSyxhQUFhLEdBQUcsS0FBSyxlQUFlLElBQUksS0FBSyxTQUFTLEtBQUssU0FBUyxJQUFJLEtBQUssTUFBTTtBQUFBLE1BQy9ILEdBRVNDLFdBQVQsU0FBaUIsT0FBaUJDLFFBQXdCO0FBQ3pELGNBQU1DLFVBQW1CLENBQUM7QUFDMUIsaUJBQVMsSUFBSUQsT0FBTSxpQkFBaUIsS0FBS0EsT0FBTSxlQUFlLEtBQUs7QUFDbEUsZ0JBQU0sT0FBTyxNQUFNLElBQUksQ0FBQztBQUN4QixjQUFJLE1BQU1BLE9BQU0sbUJBQW1CLE1BQU1BLE9BQU0sZUFBZTtBQUM3RCxZQUFBQyxRQUFPLEtBQUssS0FBSyxVQUFVRCxPQUFNLGNBQWMsR0FBR0EsT0FBTSxZQUFZLENBQUMsQ0FBQztBQUFBLFVBQ3ZFLFdBQVcsTUFBTUEsT0FBTSxpQkFBaUI7QUFDdkMsWUFBQUMsUUFBTyxLQUFLLEtBQUssVUFBVUQsT0FBTSxjQUFjLENBQUMsQ0FBQztBQUFBLFVBQ2xELFdBQVcsTUFBTUEsT0FBTSxlQUFlO0FBQ3JDLFlBQUFDLFFBQU8sS0FBSyxLQUFLLFVBQVUsR0FBR0QsT0FBTSxZQUFZLENBQUMsQ0FBQztBQUFBLFVBQ25ELE9BQU87QUFDTixZQUFBQyxRQUFPLEtBQUssSUFBSTtBQUFBLFVBQ2pCO0FBQUEsUUFDRDtBQUNBLGVBQU9BO0FBQUEsTUFDUjtBQW5CUyx5QkFBQUgsZUFJQSxVQUFBQztBQXBDVCxVQUFJLE9BQU8sUUFBUSxVQUFVO0FBQzVCLGtCQUFVO0FBQUEsTUFDWDtBQUVBLFVBQUksTUFBTSxRQUFRLEtBQUssS0FBSyxDQUFDLE1BQU07QUFFbEM7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXLE1BQU0sZ0JBQWdCLEtBQUs7QUFDNUMsYUFBTyxLQUFLLFFBQVEsZUFBZSxNQUFNLEdBQUc7QUFFNUMsVUFBSSxhQUFhLE1BQU07QUFFdEI7QUFBQSxNQUNEO0FBR0EsVUFBSSxLQUFLLElBQUksS0FBSyxRQUFRLFNBQVMsTUFBTSxJQUFJLGNBQWEsWUFBWTtBQUNyRSxlQUFPLEtBQUssRUFBRSxPQUFPLEtBQUssQ0FBQztBQUMzQjtBQUFBLE1BQ0Q7QUFJQSxZQUFNLGdCQUFnQixTQUFTLE1BQU0sWUFBWTtBQUNqRCxZQUFNLGdCQUFnQixLQUFLLE1BQU0sWUFBWTtBQUU3QyxZQUFNLE9BQU8sbUJBQW1CLFdBQVcsRUFBRSxZQUFZLGVBQWUsZUFBZSxPQUFPO0FBRTlGLFlBQU0sUUFBUSxNQUFNLEtBQUssS0FBSyxFQUFFLGlCQUFpQjtBQXVCakQsaUJBQVcsS0FBSyxLQUFLLFNBQVM7QUFDN0IsWUFBSSxFQUFFLGNBQWM7QUFDbkIscUJBQVcsS0FBSyxFQUFFLGNBQWM7QUFDL0IsbUJBQU8sS0FBSztBQUFBLGNBQ1gsT0FBTyxNQUFNO0FBQUEsZ0JBQ1pELGNBQWEsT0FBTyxFQUFFLGNBQWMsaUJBQWlCLENBQUM7QUFBQSxnQkFDdERBLGNBQWEsT0FBTyxFQUFFLGNBQWMsZUFBZSxDQUFDO0FBQUEsY0FDckQ7QUFBQSxjQUNBLE1BQU1DLFNBQVEsZUFBZSxFQUFFLGFBQWEsRUFBRSxLQUFLLE1BQU0sR0FBRztBQUFBLFlBQzdELENBQUM7QUFBQSxVQUNGO0FBQUEsUUFDRCxPQUFPO0FBQ04sZ0JBQU0sSUFBSSxtQkFBbUIsK0RBQStEO0FBQUEsUUFDN0Y7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksT0FBTyxZQUFZLFVBQVU7QUFDaEMsYUFBTyxLQUFLLEVBQUUsS0FBSyxTQUFTLE1BQU0sSUFBSSxPQUFPLEVBQUUsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxXQUFXLEVBQUUsRUFBRSxDQUFDO0FBQUEsSUFDdEg7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFJQSxNQUFhLGNBQWMsVUFBMkM7QUFDckUsVUFBTSxRQUFRLEtBQUssVUFBVSxRQUFRO0FBQ3JDLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLGFBQWEsS0FBSztBQUFBLEVBQzFCO0FBQUE7QUFBQSxFQUlBLE1BQWEsOEJBQThCLFVBQXVEO0FBQ2pHLFVBQU0sUUFBUSxLQUFLLFVBQVUsUUFBUTtBQUNyQyxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyw2QkFBNkIsS0FBSztBQUFBLEVBQzFDO0FBQUEsRUFNQSxNQUFhLGdCQUFnQixXQUFxQixhQUFpQyxTQUFpQixjQUE2RTtBQUVoTCxVQUFNLEtBQUssSUFBSSxVQUFVO0FBQ3pCLFVBQU0sZ0JBQWdCLElBQUksT0FBTyxTQUFTLFlBQVk7QUFDdEQsVUFBTSxPQUFPLG9CQUFJLElBQVk7QUFFN0IsVUFBTyxZQUFXLE9BQU8sV0FBVztBQUNuQyxZQUFNLFFBQVEsS0FBSyxVQUFVLEdBQUc7QUFDaEMsVUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLE1BQ0Q7QUFFQSxpQkFBVyxRQUFRLE1BQU0sTUFBTSxhQUFhLEdBQUc7QUFDOUMsWUFBSSxTQUFTLGVBQWUsQ0FBQyxNQUFNLE9BQU8sSUFBSSxDQUFDLEdBQUc7QUFDakQ7QUFBQSxRQUNEO0FBQ0EsYUFBSyxJQUFJLElBQUk7QUFDYixZQUFJLEtBQUssT0FBTyxjQUFhLG1CQUFtQjtBQUMvQyxnQkFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU8sRUFBRSxPQUFPLE1BQU0sS0FBSyxJQUFJLEdBQUcsVUFBVSxHQUFHLFFBQVEsRUFBRTtBQUFBLEVBQzFEO0FBQUE7QUFBQTtBQUFBLEVBT0EsTUFBYSxtQkFBbUIsVUFBa0IsT0FBZSxTQUFpQixjQUE2RDtBQUM5SSxVQUFNLFFBQVEsS0FBSyxVQUFVLFFBQVE7QUFDckMsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPLHVCQUFPLE9BQU8sSUFBSTtBQUFBLElBQzFCO0FBQ0EsVUFBTSxnQkFBZ0IsSUFBSSxPQUFPLFNBQVMsWUFBWTtBQUN0RCxVQUFNLFNBQXVDLHVCQUFPLE9BQU8sSUFBSTtBQUMvRCxhQUFTLE9BQU8sTUFBTSxpQkFBaUIsT0FBTyxNQUFNLGVBQWUsUUFBUTtBQUMxRSxZQUFNLFFBQVEsTUFBTSxhQUFhLE1BQU0sYUFBYTtBQUNwRCxpQkFBVyxRQUFRLE9BQU87QUFDekIsWUFBSSxDQUFDLE1BQU0sT0FBTyxLQUFLLElBQUksQ0FBQyxHQUFHO0FBQzlCO0FBQUEsUUFDRDtBQUNBLFlBQUksUUFBUSxPQUFPLEtBQUssSUFBSTtBQUM1QixZQUFJLENBQUMsT0FBTztBQUNYLGtCQUFRLENBQUM7QUFDVCxpQkFBTyxLQUFLLElBQUksSUFBSTtBQUFBLFFBQ3JCO0FBQ0EsY0FBTSxLQUFLO0FBQUEsVUFDVixpQkFBaUI7QUFBQSxVQUNqQixhQUFhLEtBQUs7QUFBQSxVQUNsQixlQUFlO0FBQUEsVUFDZixXQUFXLEtBQUs7QUFBQSxRQUNqQixDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFJQSxNQUFhLGtCQUFrQixVQUFrQixPQUFlLElBQWEsU0FBaUIsY0FBb0U7QUFDakssVUFBTSxRQUFRLEtBQUssVUFBVSxRQUFRO0FBQ3JDLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGdCQUFnQixJQUFJLE9BQU8sU0FBUyxZQUFZO0FBRXRELFFBQUksTUFBTSxnQkFBZ0IsTUFBTSxXQUFXO0FBQzFDLGNBQVE7QUFBQSxRQUNQLGlCQUFpQixNQUFNO0FBQUEsUUFDdkIsYUFBYSxNQUFNO0FBQUEsUUFDbkIsZUFBZSxNQUFNO0FBQUEsUUFDckIsV0FBVyxNQUFNLFlBQVk7QUFBQSxNQUM5QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGdCQUFnQixNQUFNLGdCQUFnQixLQUFLO0FBRWpELFVBQU0sWUFBWSxNQUFNLGtCQUFrQixFQUFFLFlBQVksTUFBTSxpQkFBaUIsUUFBUSxNQUFNLFlBQVksR0FBRyxhQUFhO0FBQ3pILFFBQUksQ0FBQyxXQUFXO0FBQ2YsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLE9BQU8sTUFBTSxnQkFBZ0IsU0FBUztBQUM1QyxVQUFNLFNBQVMsb0JBQW9CLFNBQVMsaUJBQWlCLE9BQU8sZUFBZSxXQUFXLE1BQU0sRUFBRTtBQUN0RyxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUE7QUFBQSxFQUtPLEtBQUssUUFBZ0IsTUFBMkI7QUFDdEQsUUFBSSxDQUFDLEtBQUssa0JBQWtCLE9BQU8sS0FBSyxlQUFlLE1BQU0sTUFBTSxZQUFZO0FBQzlFLGFBQU8sUUFBUSxPQUFPLElBQUksTUFBTSx1Q0FBdUMsTUFBTSxDQUFDO0FBQUEsSUFDL0U7QUFFQSxRQUFJO0FBQ0gsYUFBTyxRQUFRLFFBQVEsS0FBSyxlQUFlLE1BQU0sRUFBRSxNQUFNLEtBQUssZ0JBQWdCLElBQUksQ0FBQztBQUFBLElBQ3BGLFNBQVMsR0FBRztBQUNYLGFBQU8sUUFBUSxPQUFPLENBQUM7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQTtBQUdEO0FBQUE7QUFBQTtBQXZjYSxjQThJWSxhQUFhO0FBQUE7QUE5SXpCLGNBMlZZLG9CQUFvQjtBQTNWdEMsSUFBTSxlQUFOO0FBNGNQLElBQUksT0FBTyxrQkFBa0IsWUFBWTtBQUV4QyxhQUFXLFNBQVMsb0JBQW9CO0FBQ3pDOyIsCiAgIm5hbWVzIjogWyJtIiwgImFkZFBvc2l0aW9ucyIsICJnZXRUZXh0IiwgInJhbmdlIiwgInJlc3VsdCJdCn0K
