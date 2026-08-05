import { Emitter } from "../../../../../base/common/event.js";
import { hash, StringSHA1 } from "../../../../../base/common/hash.js";
import { Disposable, DisposableStore, dispose } from "../../../../../base/common/lifecycle.js";
import * as UUID from "../../../../../base/common/uuid.js";
import { Range } from "../../../../../editor/common/core/range.js";
import * as model from "../../../../../editor/common/model.js";
import { PieceTreeTextBuffer } from "../../../../../editor/common/model/pieceTreeTextBuffer/pieceTreeTextBuffer.js";
import { createTextBuffer } from "../../../../../editor/common/model/textModel.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { NotebookCellOutputTextModel } from "./notebookCellOutputTextModel.js";
import { ThrottledDelayer } from "../../../../../base/common/async.js";
import { toFormattedString } from "../../../../../base/common/jsonFormatter.js";
import { splitLines } from "../../../../../base/common/strings.js";
const _NotebookCellTextModel = class _NotebookCellTextModel extends Disposable {
  constructor(uri, handle, _source, _language, _mime, cellKind, outputs, metadata, internalMetadata, collapseState, transientOptions, _languageService, _languageDetectionService = void 0) {
    super();
    this.uri = uri;
    this.handle = handle;
    this._source = _source;
    this._language = _language;
    this._mime = _mime;
    this.cellKind = cellKind;
    this.collapseState = collapseState;
    this.transientOptions = transientOptions;
    this._languageService = _languageService;
    this._languageDetectionService = _languageDetectionService;
    this._onDidChangeTextModel = this._register(new Emitter());
    this.onDidChangeTextModel = this._onDidChangeTextModel.event;
    this._onDidChangeOutputs = this._register(new Emitter());
    this.onDidChangeOutputs = this._onDidChangeOutputs.event;
    this._onDidChangeOutputItems = this._register(new Emitter());
    this.onDidChangeOutputItems = this._onDidChangeOutputItems.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidChangeMetadata = this._register(new Emitter());
    this.onDidChangeMetadata = this._onDidChangeMetadata.event;
    this._onDidChangeInternalMetadata = this._register(new Emitter());
    this.onDidChangeInternalMetadata = this._onDidChangeInternalMetadata.event;
    this._onDidChangeLanguage = this._register(new Emitter());
    this.onDidChangeLanguage = this._onDidChangeLanguage.event;
    this._textBufferHash = null;
    this._hash = null;
    this._versionId = 1;
    this._alternativeId = 1;
    this._textModelDisposables = this._register(new DisposableStore());
    this._textModel = void 0;
    this.autoDetectLanguageThrottler = this._register(new ThrottledDelayer(_NotebookCellTextModel.AUTO_DETECT_LANGUAGE_THROTTLE_DELAY));
    this._autoLanguageDetectionEnabled = false;
    this._hasLanguageSetExplicitly = false;
    this._outputs = outputs.map((op) => new NotebookCellOutputTextModel(op));
    this._metadata = metadata ?? {};
    this._internalMetadata = internalMetadata ?? {};
  }
  get outputs() {
    return this._outputs;
  }
  get metadata() {
    return this._metadata;
  }
  set metadata(newMetadata) {
    this._metadata = newMetadata;
    this._hash = null;
    this._onDidChangeMetadata.fire();
  }
  get internalMetadata() {
    return this._internalMetadata;
  }
  set internalMetadata(newInternalMetadata) {
    const lastRunSuccessChanged = this._internalMetadata.lastRunSuccess !== newInternalMetadata.lastRunSuccess;
    newInternalMetadata = {
      ...newInternalMetadata,
      ...{ runStartTimeAdjustment: computeRunStartTimeAdjustment(this._internalMetadata, newInternalMetadata) }
    };
    this._internalMetadata = newInternalMetadata;
    this._hash = null;
    this._onDidChangeInternalMetadata.fire({ lastRunSuccessChanged });
  }
  get language() {
    return this._language;
  }
  set language(newLanguage) {
    if (this._textModel && this._textModel.getLanguageId() === this._languageService.getLanguageIdByLanguageName(newLanguage) && this._textModel.getLanguageId() === this._languageService.getLanguageIdByLanguageName(this.language)) {
      return;
    }
    this._hasLanguageSetExplicitly = true;
    this._setLanguageInternal(newLanguage);
  }
  get mime() {
    return this._mime;
  }
  set mime(newMime) {
    if (this._mime === newMime) {
      return;
    }
    this._mime = newMime;
    this._hash = null;
    this._onDidChangeContent.fire("mime");
  }
  get textBuffer() {
    if (this._textBuffer) {
      return this._textBuffer;
    }
    this._textBuffer = this._register(createTextBuffer(this._source, model.DefaultEndOfLine.LF).textBuffer);
    this._register(this._textBuffer.onDidChangeContent(() => {
      this._hash = null;
      if (!this._textModel) {
        this._onDidChangeContent.fire("content");
      }
      this.autoDetectLanguage();
    }));
    return this._textBuffer;
  }
  get alternativeId() {
    return this._alternativeId;
  }
  get textModel() {
    return this._textModel;
  }
  set textModel(m) {
    if (this._textModel === m) {
      return;
    }
    this._textModelDisposables.clear();
    this._textModel = m;
    if (this._textModel) {
      this.setRegisteredLanguage(this._languageService, this._textModel.getLanguageId(), this.language);
      this._textModelDisposables.add(this._textModel.onDidChangeLanguage((e) => this.setRegisteredLanguage(this._languageService, e.newLanguage, this.language)));
      this._textModelDisposables.add(this._textModel.onWillDispose(() => this.textModel = void 0));
      this._textModelDisposables.add(this._textModel.onDidChangeContent((e) => {
        if (this._textModel) {
          this._versionId = this._textModel.getVersionId();
          this._alternativeId = this._textModel.getAlternativeVersionId();
        }
        this._textBufferHash = null;
        this._onDidChangeContent.fire("content");
        this._onDidChangeContent.fire({ type: "model", event: e });
      }));
      this._textModel._overwriteVersionId(this._versionId);
      this._textModel._overwriteAlternativeVersionId(this._versionId);
      this._onDidChangeTextModel.fire();
    }
  }
  setRegisteredLanguage(languageService, newLanguage, currentLanguage) {
    const isFallBackLanguage = newLanguage === PLAINTEXT_LANGUAGE_ID || newLanguage === "jupyter";
    if (!languageService.isRegisteredLanguageId(currentLanguage) && isFallBackLanguage) {
      this._onDidChangeLanguage.fire(currentLanguage);
    } else {
      this.language = newLanguage;
    }
  }
  get hasLanguageSetExplicitly() {
    return this._hasLanguageSetExplicitly;
  }
  enableAutoLanguageDetection() {
    this._autoLanguageDetectionEnabled = true;
    this.autoDetectLanguage();
  }
  async autoDetectLanguage() {
    if (this._autoLanguageDetectionEnabled) {
      this.autoDetectLanguageThrottler.trigger(() => this._doAutoDetectLanguage());
    }
  }
  async _doAutoDetectLanguage() {
    if (this.hasLanguageSetExplicitly) {
      return;
    }
    const newLanguage = await this._languageDetectionService?.detectLanguage(this.uri);
    if (!newLanguage) {
      return;
    }
    if (this._textModel && this._textModel.getLanguageId() === this._languageService.getLanguageIdByLanguageName(newLanguage) && this._textModel.getLanguageId() === this._languageService.getLanguageIdByLanguageName(this.language)) {
      return;
    }
    this._setLanguageInternal(newLanguage);
  }
  _setLanguageInternal(newLanguage) {
    const newLanguageId = this._languageService.getLanguageIdByLanguageName(newLanguage);
    if (newLanguageId === null) {
      return;
    }
    if (this._textModel) {
      const languageId = this._languageService.createById(newLanguageId);
      this._textModel.setLanguage(languageId.languageId);
    }
    if (this._language === newLanguage) {
      return;
    }
    this._language = newLanguage;
    this._hash = null;
    this._onDidChangeLanguage.fire(newLanguage);
    this._onDidChangeContent.fire("language");
  }
  resetTextBuffer(textBuffer) {
    this._textBuffer = textBuffer;
  }
  getValue() {
    const fullRange = this.getFullModelRange();
    const eol = this.textBuffer.getEOL();
    if (eol === "\n") {
      return this.textBuffer.getValueInRange(fullRange, model.EndOfLinePreference.LF);
    } else {
      return this.textBuffer.getValueInRange(fullRange, model.EndOfLinePreference.CRLF);
    }
  }
  getTextBufferHash() {
    if (this._textBufferHash !== null) {
      return this._textBufferHash;
    }
    const shaComputer = new StringSHA1();
    const snapshot = this.textBuffer.createSnapshot(false);
    let text;
    while (text = snapshot.read()) {
      shaComputer.update(text);
    }
    this._textBufferHash = shaComputer.digest();
    return this._textBufferHash;
  }
  getHashValue() {
    if (this._hash !== null) {
      return this._hash;
    }
    this._hash = hash([hash(this.language), this.getTextBufferHash(), this._getPersisentMetadata(), this.transientOptions.transientOutputs ? [] : this._outputs.map((op) => ({
      outputs: op.outputs.map((output) => ({
        mime: output.mime,
        data: Array.from(output.data.buffer)
      })),
      metadata: op.metadata
    }))]);
    return this._hash;
  }
  _getPersisentMetadata() {
    return getFormattedMetadataJSON(this.transientOptions.transientCellMetadata, this.metadata, this.language);
  }
  getTextLength() {
    return this.textBuffer.getLength();
  }
  getFullModelRange() {
    const lineCount = this.textBuffer.getLineCount();
    return new Range(1, 1, lineCount, this.textBuffer.getLineLength(lineCount) + 1);
  }
  spliceNotebookCellOutputs(splice) {
    if (splice.deleteCount > 0 && splice.newOutputs.length > 0) {
      const commonLen = Math.min(splice.deleteCount, splice.newOutputs.length);
      for (let i = 0; i < commonLen; i++) {
        const currentOutput = this.outputs[splice.start + i];
        const newOutput = splice.newOutputs[i];
        this.replaceOutput(currentOutput.outputId, newOutput);
      }
      const removed = this.outputs.splice(splice.start + commonLen, splice.deleteCount - commonLen, ...splice.newOutputs.slice(commonLen));
      removed.forEach((output) => output.dispose());
      this._onDidChangeOutputs.fire({ start: splice.start + commonLen, deleteCount: splice.deleteCount - commonLen, newOutputs: splice.newOutputs.slice(commonLen) });
    } else {
      const removed = this.outputs.splice(splice.start, splice.deleteCount, ...splice.newOutputs);
      removed.forEach((output) => output.dispose());
      this._onDidChangeOutputs.fire(splice);
    }
  }
  replaceOutput(outputId, newOutputItem) {
    const outputIndex = this.outputs.findIndex((output2) => output2.outputId === outputId);
    if (outputIndex < 0) {
      return false;
    }
    const output = this.outputs[outputIndex];
    output.replaceData({
      outputs: newOutputItem.outputs,
      outputId: newOutputItem.outputId,
      metadata: newOutputItem.metadata
    });
    newOutputItem.dispose();
    this._onDidChangeOutputItems.fire();
    return true;
  }
  changeOutputItems(outputId, append, items) {
    const outputIndex = this.outputs.findIndex((output2) => output2.outputId === outputId);
    if (outputIndex < 0) {
      return false;
    }
    const output = this.outputs[outputIndex];
    if (append) {
      output.appendData(items);
    } else {
      output.replaceData({ outputId, outputs: items, metadata: output.metadata });
    }
    this._onDidChangeOutputItems.fire();
    return true;
  }
  _outputNotEqualFastCheck(left, right) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < this.outputs.length; i++) {
      const l = left[i];
      const r = right[i];
      if (l.outputs.length !== r.outputs.length) {
        return false;
      }
      for (let k = 0; k < l.outputs.length; k++) {
        if (l.outputs[k].mime !== r.outputs[k].mime) {
          return false;
        }
        if (l.outputs[k].data.byteLength !== r.outputs[k].data.byteLength) {
          return false;
        }
      }
    }
    return true;
  }
  equal(b) {
    if (this.language !== b.language) {
      return false;
    }
    if (this.outputs.length !== b.outputs.length) {
      return false;
    }
    if (this.getTextLength() !== b.getTextLength()) {
      return false;
    }
    if (!this.transientOptions.transientOutputs) {
      if (!this._outputNotEqualFastCheck(this.outputs, b.outputs)) {
        return false;
      }
    }
    return this.getHashValue() === b.getHashValue();
  }
  /**
   * Only compares
   * - language
   * - mime
   * - cellKind
   * - internal metadata (conditionally)
   * - source
   */
  fastEqual(b, ignoreMetadata) {
    if (this.language !== b.language) {
      return false;
    }
    if (this.mime !== b.mime) {
      return false;
    }
    if (this.cellKind !== b.cellKind) {
      return false;
    }
    if (!ignoreMetadata) {
      if (this.internalMetadata?.executionOrder !== b.internalMetadata?.executionOrder || this.internalMetadata?.lastRunSuccess !== b.internalMetadata?.lastRunSuccess || this.internalMetadata?.runStartTime !== b.internalMetadata?.runStartTime || this.internalMetadata?.runStartTimeAdjustment !== b.internalMetadata?.runStartTimeAdjustment || this.internalMetadata?.runEndTime !== b.internalMetadata?.runEndTime) {
        return false;
      }
    }
    if (this._textBuffer) {
      if (!_NotebookCellTextModel.linesAreEqual(this.textBuffer.getLinesContent(), b.source)) {
        return false;
      }
    } else if (this._source !== b.source) {
      return false;
    }
    return true;
  }
  static linesAreEqual(aLines, b) {
    const bLines = splitLines(b);
    if (aLines.length !== bLines.length) {
      return false;
    }
    for (let i = 0; i < aLines.length; i++) {
      if (aLines[i] !== bLines[i]) {
        return false;
      }
    }
    return true;
  }
  dispose() {
    dispose(this._outputs);
    const emptyDisposedTextBuffer = new PieceTreeTextBuffer([], "", "\n", false, false, true, true);
    emptyDisposedTextBuffer.dispose();
    this._textBuffer = emptyDisposedTextBuffer;
    super.dispose();
  }
};
_NotebookCellTextModel.AUTO_DETECT_LANGUAGE_THROTTLE_DELAY = 600;
let NotebookCellTextModel = _NotebookCellTextModel;
function cloneNotebookCellTextModel(cell) {
  return {
    source: cell.getValue(),
    language: cell.language,
    mime: cell.mime,
    cellKind: cell.cellKind,
    outputs: cell.outputs.map((output) => ({
      outputs: output.outputs,
      /* paste should generate new outputId */
      outputId: UUID.generateUuid()
    })),
    metadata: {}
  };
}
function computeRunStartTimeAdjustment(oldMetadata, newMetadata) {
  if (oldMetadata.runStartTime !== newMetadata.runStartTime && typeof newMetadata.runStartTime === "number") {
    const offset = Date.now() - newMetadata.runStartTime;
    return offset < 0 ? Math.abs(offset) : 0;
  } else {
    return newMetadata.runStartTimeAdjustment;
  }
}
function getFormattedMetadataJSON(transientCellMetadata, metadata, language, sortKeys) {
  let filteredMetadata = {};
  if (transientCellMetadata) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(metadata)]);
    for (const key of keys) {
      if (!transientCellMetadata[key]) {
        filteredMetadata[key] = metadata[key];
      }
    }
  } else {
    filteredMetadata = metadata;
  }
  const obj = {
    language,
    ...filteredMetadata
  };
  if (language) {
    obj.language = language;
  }
  const metadataSource = toFormattedString(sortKeys ? sortObjectPropertiesRecursively(obj) : obj, {});
  return metadataSource;
}
function sortObjectPropertiesRecursively(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectPropertiesRecursively);
  }
  if (obj !== void 0 && obj !== null && typeof obj === "object" && Object.keys(obj).length > 0) {
    return Object.keys(obj).sort().reduce((sortedObj, prop) => {
      sortedObj[prop] = sortObjectPropertiesRecursively(obj[prop]);
      return sortedObj;
    }, {});
  }
  return obj;
}
export {
  NotebookCellTextModel,
  cloneNotebookCellTextModel,
  getFormattedMetadataJSON,
  sortObjectPropertiesRecursively
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vbW9kZWwvbm90ZWJvb2tDZWxsVGV4dE1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoLCBTdHJpbmdTSEExIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIFVVSUQgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBtb2RlbCBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFBpZWNlVHJlZVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3BpZWNlVHJlZVRleHRCdWZmZXIvcGllY2VUcmVlVGV4dEJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0QnVmZmVyLCBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxPdXRwdXRUZXh0TW9kZWwgfSBmcm9tICcuL25vdGVib29rQ2VsbE91dHB1dFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsSW50ZXJuYWxNZXRhZGF0YUNoYW5nZWRFdmVudCwgQ2VsbEtpbmQsIElDZWxsLCBJQ2VsbER0bzIsIElDZWxsT3V0cHV0LCBJT3V0cHV0RHRvLCBJT3V0cHV0SXRlbUR0bywgTm90ZWJvb2tDZWxsQ29sbGFwc2VTdGF0ZSwgTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YSwgTm90ZWJvb2tDZWxsTWV0YWRhdGEsIE5vdGVib29rQ2VsbE91dHB1dHNTcGxpY2UsIFRyYW5zaWVudENlbGxNZXRhZGF0YSwgVHJhbnNpZW50T3B0aW9ucyB9IGZyb20gJy4uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IFRocm90dGxlZERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvbGFuZ3VhZ2VEZXRlY3Rpb24vY29tbW9uL2xhbmd1YWdlRGV0ZWN0aW9uV29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0b0Zvcm1hdHRlZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25Gb3JtYXR0ZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vdGV4dE1vZGVsRXZlbnRzLmpzJztcbmltcG9ydCB7IHNwbGl0TGluZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcblxuZXhwb3J0IGNsYXNzIE5vdGVib29rQ2VsbFRleHRNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2VsbCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVGV4dE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGV4dE1vZGVsOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVGV4dE1vZGVsLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU91dHB1dHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxOb3RlYm9va0NlbGxPdXRwdXRzU3BsaWNlPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPdXRwdXRzOiBFdmVudDxOb3RlYm9va0NlbGxPdXRwdXRzU3BsaWNlPiA9IHRoaXMuX29uRGlkQ2hhbmdlT3V0cHV0cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU91dHB1dEl0ZW1zID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlT3V0cHV0SXRlbXM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VPdXRwdXRJdGVtcy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjwnY29udGVudCcgfCAnbGFuZ3VhZ2UnIHwgJ21pbWUnIHwgeyB0eXBlOiAnbW9kZWwnOyBldmVudDogSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50OiBFdmVudDwnY29udGVudCcgfCAnbGFuZ3VhZ2UnIHwgJ21pbWUnIHwgeyB0eXBlOiAnbW9kZWwnOyBldmVudDogSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9PiA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1ldGFkYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTWV0YWRhdGE6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VNZXRhZGF0YS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUludGVybmFsTWV0YWRhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDZWxsSW50ZXJuYWxNZXRhZGF0YUNoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlSW50ZXJuYWxNZXRhZGF0YTogRXZlbnQ8Q2VsbEludGVybmFsTWV0YWRhdGFDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VJbnRlcm5hbE1ldGFkYXRhLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTGFuZ3VhZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxhbmd1YWdlOiBFdmVudDxzdHJpbmc+ID0gdGhpcy5fb25EaWRDaGFuZ2VMYW5ndWFnZS5ldmVudDtcblxuXHRwcml2YXRlIF9vdXRwdXRzOiBOb3RlYm9va0NlbGxPdXRwdXRUZXh0TW9kZWxbXTtcblxuXHRnZXQgb3V0cHV0cygpOiBJQ2VsbE91dHB1dFtdIHtcblx0XHRyZXR1cm4gdGhpcy5fb3V0cHV0cztcblx0fVxuXG5cdHByaXZhdGUgX21ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YTtcblxuXHRnZXQgbWV0YWRhdGEoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21ldGFkYXRhO1xuXHR9XG5cblx0c2V0IG1ldGFkYXRhKG5ld01ldGFkYXRhOiBOb3RlYm9va0NlbGxNZXRhZGF0YSkge1xuXHRcdHRoaXMuX21ldGFkYXRhID0gbmV3TWV0YWRhdGE7XG5cdFx0dGhpcy5faGFzaCA9IG51bGw7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNZXRhZGF0YS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9pbnRlcm5hbE1ldGFkYXRhOiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhO1xuXG5cdGdldCBpbnRlcm5hbE1ldGFkYXRhKCkge1xuXHRcdHJldHVybiB0aGlzLl9pbnRlcm5hbE1ldGFkYXRhO1xuXHR9XG5cblx0c2V0IGludGVybmFsTWV0YWRhdGEobmV3SW50ZXJuYWxNZXRhZGF0YTogTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YSkge1xuXHRcdGNvbnN0IGxhc3RSdW5TdWNjZXNzQ2hhbmdlZCA9IHRoaXMuX2ludGVybmFsTWV0YWRhdGEubGFzdFJ1blN1Y2Nlc3MgIT09IG5ld0ludGVybmFsTWV0YWRhdGEubGFzdFJ1blN1Y2Nlc3M7XG5cdFx0bmV3SW50ZXJuYWxNZXRhZGF0YSA9IHtcblx0XHRcdC4uLm5ld0ludGVybmFsTWV0YWRhdGEsXG5cdFx0XHQuLi57IHJ1blN0YXJ0VGltZUFkanVzdG1lbnQ6IGNvbXB1dGVSdW5TdGFydFRpbWVBZGp1c3RtZW50KHRoaXMuX2ludGVybmFsTWV0YWRhdGEsIG5ld0ludGVybmFsTWV0YWRhdGEpIH1cblx0XHR9O1xuXHRcdHRoaXMuX2ludGVybmFsTWV0YWRhdGEgPSBuZXdJbnRlcm5hbE1ldGFkYXRhO1xuXHRcdHRoaXMuX2hhc2ggPSBudWxsO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSW50ZXJuYWxNZXRhZGF0YS5maXJlKHsgbGFzdFJ1blN1Y2Nlc3NDaGFuZ2VkIH0pO1xuXHR9XG5cblx0Z2V0IGxhbmd1YWdlKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYW5ndWFnZTtcblx0fVxuXG5cdHNldCBsYW5ndWFnZShuZXdMYW5ndWFnZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuX3RleHRNb2RlbFxuXHRcdFx0Ly8gMS4gdGhlIGxhbmd1YWdlIHVwZGF0ZSBpcyBmcm9tIHdvcmtzcGFjZSBlZGl0LCBjaGVja2luZyBpZiBpdCdzIHRoZSBzYW1lIGFzIHRleHQgbW9kZWwncyBtb2RlXG5cdFx0XHQmJiB0aGlzLl90ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpID09PSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKG5ld0xhbmd1YWdlKVxuXHRcdFx0Ly8gMi4gdGhlIHRleHQgbW9kZWwncyBtb2RlIG1pZ2h0IGJlIHRoZSBzYW1lIGFzIHRoZSBgdGhpcy5sYW5ndWFnZWAsIGV2ZW4gaWYgdGhlIGxhbmd1YWdlIGZyaWVuZGx5IG5hbWUgaXMgbm90IHRoZSBzYW1lLCB3ZSBzaG91bGQgbm90IHRyaWdnZXIgYW4gdXBkYXRlXG5cdFx0XHQmJiB0aGlzLl90ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpID09PSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKHRoaXMubGFuZ3VhZ2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cblx0XHR0aGlzLl9oYXNMYW5ndWFnZVNldEV4cGxpY2l0bHkgPSB0cnVlO1xuXHRcdHRoaXMuX3NldExhbmd1YWdlSW50ZXJuYWwobmV3TGFuZ3VhZ2UpO1xuXHR9XG5cblx0cHVibGljIGdldCBtaW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX21pbWU7XG5cdH1cblxuXHRwdWJsaWMgc2V0IG1pbWUobmV3TWltZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX21pbWUgPT09IG5ld01pbWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fbWltZSA9IG5ld01pbWU7XG5cdFx0dGhpcy5faGFzaCA9IG51bGw7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoJ21pbWUnKTtcblx0fVxuXG5cdHByaXZhdGUgX3RleHRCdWZmZXIhOiBtb2RlbC5JVGV4dEJ1ZmZlcjtcblxuXHRnZXQgdGV4dEJ1ZmZlcigpIHtcblx0XHRpZiAodGhpcy5fdGV4dEJ1ZmZlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3RleHRCdWZmZXI7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdGV4dEJ1ZmZlciA9IHRoaXMuX3JlZ2lzdGVyKGNyZWF0ZVRleHRCdWZmZXIodGhpcy5fc291cmNlLCBtb2RlbC5EZWZhdWx0RW5kT2ZMaW5lLkxGKS50ZXh0QnVmZmVyKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RleHRCdWZmZXIub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdHRoaXMuX2hhc2ggPSBudWxsO1xuXHRcdFx0aWYgKCF0aGlzLl90ZXh0TW9kZWwpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoJ2NvbnRlbnQnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuYXV0b0RldGVjdExhbmd1YWdlKCk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX3RleHRCdWZmZXI7XG5cdH1cblxuXHRwcml2YXRlIF90ZXh0QnVmZmVySGFzaDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2hhc2g6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgX3ZlcnNpb25JZDogbnVtYmVyID0gMTtcblx0cHJpdmF0ZSBfYWx0ZXJuYXRpdmVJZDogbnVtYmVyID0gMTtcblx0Z2V0IGFsdGVybmF0aXZlSWQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fYWx0ZXJuYXRpdmVJZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfdGV4dE1vZGVsOiBUZXh0TW9kZWwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGdldCB0ZXh0TW9kZWwoKTogVGV4dE1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdGV4dE1vZGVsO1xuXHR9XG5cblx0c2V0IHRleHRNb2RlbChtOiBUZXh0TW9kZWwgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fdGV4dE1vZGVsID09PSBtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdGV4dE1vZGVsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl90ZXh0TW9kZWwgPSBtO1xuXHRcdGlmICh0aGlzLl90ZXh0TW9kZWwpIHtcblx0XHRcdHRoaXMuc2V0UmVnaXN0ZXJlZExhbmd1YWdlKHRoaXMuX2xhbmd1YWdlU2VydmljZSwgdGhpcy5fdGV4dE1vZGVsLmdldExhbmd1YWdlSWQoKSwgdGhpcy5sYW5ndWFnZSk7XG5cblx0XHRcdC8vIExpc3RlbiB0byBsYW5ndWFnZSBjaGFuZ2VzIG9uIHRoZSBtb2RlbFxuXHRcdFx0dGhpcy5fdGV4dE1vZGVsRGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RleHRNb2RlbC5vbkRpZENoYW5nZUxhbmd1YWdlKChlKSA9PiB0aGlzLnNldFJlZ2lzdGVyZWRMYW5ndWFnZSh0aGlzLl9sYW5ndWFnZVNlcnZpY2UsIGUubmV3TGFuZ3VhZ2UsIHRoaXMubGFuZ3VhZ2UpKSk7XG5cdFx0XHR0aGlzLl90ZXh0TW9kZWxEaXNwb3NhYmxlcy5hZGQodGhpcy5fdGV4dE1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4gdGhpcy50ZXh0TW9kZWwgPSB1bmRlZmluZWQpKTtcblx0XHRcdHRoaXMuX3RleHRNb2RlbERpc3Bvc2FibGVzLmFkZCh0aGlzLl90ZXh0TW9kZWwub25EaWRDaGFuZ2VDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl90ZXh0TW9kZWwpIHtcblx0XHRcdFx0XHR0aGlzLl92ZXJzaW9uSWQgPSB0aGlzLl90ZXh0TW9kZWwuZ2V0VmVyc2lvbklkKCk7XG5cdFx0XHRcdFx0dGhpcy5fYWx0ZXJuYXRpdmVJZCA9IHRoaXMuX3RleHRNb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3RleHRCdWZmZXJIYXNoID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoJ2NvbnRlbnQnKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoeyB0eXBlOiAnbW9kZWwnLCBldmVudDogZSB9KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fdGV4dE1vZGVsLl9vdmVyd3JpdGVWZXJzaW9uSWQodGhpcy5fdmVyc2lvbklkKTtcblx0XHRcdHRoaXMuX3RleHRNb2RlbC5fb3ZlcndyaXRlQWx0ZXJuYXRpdmVWZXJzaW9uSWQodGhpcy5fdmVyc2lvbklkKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGV4dE1vZGVsLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFJlZ2lzdGVyZWRMYW5ndWFnZShsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsIG5ld0xhbmd1YWdlOiBzdHJpbmcsIGN1cnJlbnRMYW5ndWFnZTogc3RyaW5nKSB7XG5cdFx0Ly8gVGhlIGxhbmd1YWdlIGRlZmluZWQgaW4gdGhlIGNlbGwgbWlnaHQgbm90IGJlIHN1cHBvcnRlZCBpbiB0aGUgZWRpdG9yIHNvIHRoZSB0ZXh0IG1vZGVsIG1pZ2h0IGJlIHVzaW5nIHRoZSBkZWZhdWx0IGZhbGxiYWNrXG5cdFx0Ly8gSWYgc28gbGV0J3Mgbm90IG1vZGlmeSB0aGUgbGFuZ3VhZ2Vcblx0XHRjb25zdCBpc0ZhbGxCYWNrTGFuZ3VhZ2UgPSAobmV3TGFuZ3VhZ2UgPT09IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCB8fCBuZXdMYW5ndWFnZSA9PT0gJ2p1cHl0ZXInKTtcblx0XHRpZiAoIWxhbmd1YWdlU2VydmljZS5pc1JlZ2lzdGVyZWRMYW5ndWFnZUlkKGN1cnJlbnRMYW5ndWFnZSkgJiYgaXNGYWxsQmFja0xhbmd1YWdlKSB7XG5cdFx0XHQvLyBub3RpZnkgdG8gZGlzcGxheSB3YXJuaW5nLCBidXQgZG9uJ3QgY2hhbmdlIHRoZSBsYW5ndWFnZVxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VMYW5ndWFnZS5maXJlKGN1cnJlbnRMYW5ndWFnZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGFuZ3VhZ2UgPSBuZXdMYW5ndWFnZTtcblx0XHR9XG5cdH1cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQVVUT19ERVRFQ1RfTEFOR1VBR0VfVEhST1RUTEVfREVMQVkgPSA2MDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgYXV0b0RldGVjdExhbmd1YWdlVGhyb3R0bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRocm90dGxlZERlbGF5ZXI8dm9pZD4oTm90ZWJvb2tDZWxsVGV4dE1vZGVsLkFVVE9fREVURUNUX0xBTkdVQUdFX1RIUk9UVExFX0RFTEFZKSk7XG5cdHByaXZhdGUgX2F1dG9MYW5ndWFnZURldGVjdGlvbkVuYWJsZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaGFzTGFuZ3VhZ2VTZXRFeHBsaWNpdGx5OiBib29sZWFuID0gZmFsc2U7XG5cdGdldCBoYXNMYW5ndWFnZVNldEV4cGxpY2l0bHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9oYXNMYW5ndWFnZVNldEV4cGxpY2l0bHk7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB1cmk6IFVSSSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgaGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc291cmNlOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfbGFuZ3VhZ2U6IHN0cmluZyxcblx0XHRwcml2YXRlIF9taW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNlbGxLaW5kOiBDZWxsS2luZCxcblx0XHRvdXRwdXRzOiBJT3V0cHV0RHRvW10sXG5cdFx0bWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhIHwgdW5kZWZpbmVkLFxuXHRcdGludGVybmFsTWV0YWRhdGE6IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEgfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGNvbGxhcHNlU3RhdGU6IE5vdGVib29rQ2VsbENvbGxhcHNlU3RhdGUgfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHRyYW5zaWVudE9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRGV0ZWN0aW9uU2VydmljZTogSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX291dHB1dHMgPSBvdXRwdXRzLm1hcChvcCA9PiBuZXcgTm90ZWJvb2tDZWxsT3V0cHV0VGV4dE1vZGVsKG9wKSk7XG5cdFx0dGhpcy5fbWV0YWRhdGEgPSBtZXRhZGF0YSA/PyB7fTtcblx0XHR0aGlzLl9pbnRlcm5hbE1ldGFkYXRhID0gaW50ZXJuYWxNZXRhZGF0YSA/PyB7fTtcblx0fVxuXG5cdGVuYWJsZUF1dG9MYW5ndWFnZURldGVjdGlvbigpIHtcblx0XHR0aGlzLl9hdXRvTGFuZ3VhZ2VEZXRlY3Rpb25FbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmF1dG9EZXRlY3RMYW5ndWFnZSgpO1xuXHR9XG5cblx0YXN5bmMgYXV0b0RldGVjdExhbmd1YWdlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9hdXRvTGFuZ3VhZ2VEZXRlY3Rpb25FbmFibGVkKSB7XG5cdFx0XHR0aGlzLmF1dG9EZXRlY3RMYW5ndWFnZVRocm90dGxlci50cmlnZ2VyKCgpID0+IHRoaXMuX2RvQXV0b0RldGVjdExhbmd1YWdlKCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2RvQXV0b0RldGVjdExhbmd1YWdlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmhhc0xhbmd1YWdlU2V0RXhwbGljaXRseSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld0xhbmd1YWdlID0gYXdhaXQgdGhpcy5fbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlPy5kZXRlY3RMYW5ndWFnZSh0aGlzLnVyaSk7XG5cdFx0aWYgKCFuZXdMYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl90ZXh0TW9kZWxcblx0XHRcdCYmIHRoaXMuX3RleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCkgPT09IHRoaXMuX2xhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUobmV3TGFuZ3VhZ2UpXG5cdFx0XHQmJiB0aGlzLl90ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpID09PSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKHRoaXMubGFuZ3VhZ2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2V0TGFuZ3VhZ2VJbnRlcm5hbChuZXdMYW5ndWFnZSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRMYW5ndWFnZUludGVybmFsKG5ld0xhbmd1YWdlOiBzdHJpbmcpIHtcblx0XHRjb25zdCBuZXdMYW5ndWFnZUlkID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlSWRCeUxhbmd1YWdlTmFtZShuZXdMYW5ndWFnZSk7XG5cblx0XHRpZiAobmV3TGFuZ3VhZ2VJZCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl90ZXh0TW9kZWwpIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChuZXdMYW5ndWFnZUlkKTtcblx0XHRcdHRoaXMuX3RleHRNb2RlbC5zZXRMYW5ndWFnZShsYW5ndWFnZUlkLmxhbmd1YWdlSWQpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9sYW5ndWFnZSA9PT0gbmV3TGFuZ3VhZ2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9sYW5ndWFnZSA9IG5ld0xhbmd1YWdlO1xuXHRcdHRoaXMuX2hhc2ggPSBudWxsO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlTGFuZ3VhZ2UuZmlyZShuZXdMYW5ndWFnZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoJ2xhbmd1YWdlJyk7XG5cdH1cblxuXHRyZXNldFRleHRCdWZmZXIodGV4dEJ1ZmZlcjogbW9kZWwuSVRleHRCdWZmZXIpIHtcblx0XHR0aGlzLl90ZXh0QnVmZmVyID0gdGV4dEJ1ZmZlcjtcblx0fVxuXG5cdGdldFZhbHVlKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZnVsbFJhbmdlID0gdGhpcy5nZXRGdWxsTW9kZWxSYW5nZSgpO1xuXHRcdGNvbnN0IGVvbCA9IHRoaXMudGV4dEJ1ZmZlci5nZXRFT0woKTtcblx0XHRpZiAoZW9sID09PSAnXFxuJykge1xuXHRcdFx0cmV0dXJuIHRoaXMudGV4dEJ1ZmZlci5nZXRWYWx1ZUluUmFuZ2UoZnVsbFJhbmdlLCBtb2RlbC5FbmRPZkxpbmVQcmVmZXJlbmNlLkxGKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMudGV4dEJ1ZmZlci5nZXRWYWx1ZUluUmFuZ2UoZnVsbFJhbmdlLCBtb2RlbC5FbmRPZkxpbmVQcmVmZXJlbmNlLkNSTEYpO1xuXHRcdH1cblx0fVxuXG5cdGdldFRleHRCdWZmZXJIYXNoKCkge1xuXHRcdGlmICh0aGlzLl90ZXh0QnVmZmVySGFzaCAhPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3RleHRCdWZmZXJIYXNoO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNoYUNvbXB1dGVyID0gbmV3IFN0cmluZ1NIQTEoKTtcblx0XHRjb25zdCBzbmFwc2hvdCA9IHRoaXMudGV4dEJ1ZmZlci5jcmVhdGVTbmFwc2hvdChmYWxzZSk7XG5cdFx0bGV0IHRleHQ6IHN0cmluZyB8IG51bGw7XG5cdFx0d2hpbGUgKCh0ZXh0ID0gc25hcHNob3QucmVhZCgpKSkge1xuXHRcdFx0c2hhQ29tcHV0ZXIudXBkYXRlKHRleHQpO1xuXHRcdH1cblx0XHR0aGlzLl90ZXh0QnVmZmVySGFzaCA9IHNoYUNvbXB1dGVyLmRpZ2VzdCgpO1xuXHRcdHJldHVybiB0aGlzLl90ZXh0QnVmZmVySGFzaDtcblx0fVxuXG5cdGdldEhhc2hWYWx1ZSgpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9oYXNoICE9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faGFzaDtcblx0XHR9XG5cblx0XHR0aGlzLl9oYXNoID0gaGFzaChbaGFzaCh0aGlzLmxhbmd1YWdlKSwgdGhpcy5nZXRUZXh0QnVmZmVySGFzaCgpLCB0aGlzLl9nZXRQZXJzaXNlbnRNZXRhZGF0YSgpLCB0aGlzLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50T3V0cHV0cyA/IFtdIDogdGhpcy5fb3V0cHV0cy5tYXAob3AgPT4gKHtcblx0XHRcdG91dHB1dHM6IG9wLm91dHB1dHMubWFwKG91dHB1dCA9PiAoe1xuXHRcdFx0XHRtaW1lOiBvdXRwdXQubWltZSxcblx0XHRcdFx0ZGF0YTogQXJyYXkuZnJvbShvdXRwdXQuZGF0YS5idWZmZXIpXG5cdFx0XHR9KSksXG5cdFx0XHRtZXRhZGF0YTogb3AubWV0YWRhdGFcblx0XHR9KSldKTtcblx0XHRyZXR1cm4gdGhpcy5faGFzaDtcblx0fVxuXG5cdHByaXZhdGUgX2dldFBlcnNpc2VudE1ldGFkYXRhKCkge1xuXHRcdHJldHVybiBnZXRGb3JtYXR0ZWRNZXRhZGF0YUpTT04odGhpcy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudENlbGxNZXRhZGF0YSwgdGhpcy5tZXRhZGF0YSwgdGhpcy5sYW5ndWFnZSk7XG5cdH1cblxuXHRnZXRUZXh0TGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudGV4dEJ1ZmZlci5nZXRMZW5ndGgoKTtcblx0fVxuXG5cdGdldEZ1bGxNb2RlbFJhbmdlKCkge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IHRoaXMudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRyZXR1cm4gbmV3IFJhbmdlKDEsIDEsIGxpbmVDb3VudCwgdGhpcy50ZXh0QnVmZmVyLmdldExpbmVMZW5ndGgobGluZUNvdW50KSArIDEpO1xuXHR9XG5cblx0c3BsaWNlTm90ZWJvb2tDZWxsT3V0cHV0cyhzcGxpY2U6IE5vdGVib29rQ2VsbE91dHB1dHNTcGxpY2UpOiB2b2lkIHtcblx0XHRpZiAoc3BsaWNlLmRlbGV0ZUNvdW50ID4gMCAmJiBzcGxpY2UubmV3T3V0cHV0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBjb21tb25MZW4gPSBNYXRoLm1pbihzcGxpY2UuZGVsZXRlQ291bnQsIHNwbGljZS5uZXdPdXRwdXRzLmxlbmd0aCk7XG5cdFx0XHQvLyB1cGRhdGVcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY29tbW9uTGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudE91dHB1dCA9IHRoaXMub3V0cHV0c1tzcGxpY2Uuc3RhcnQgKyBpXTtcblx0XHRcdFx0Y29uc3QgbmV3T3V0cHV0ID0gc3BsaWNlLm5ld091dHB1dHNbaV07XG5cblx0XHRcdFx0dGhpcy5yZXBsYWNlT3V0cHV0KGN1cnJlbnRPdXRwdXQub3V0cHV0SWQsIG5ld091dHB1dCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlbW92ZWQgPSB0aGlzLm91dHB1dHMuc3BsaWNlKHNwbGljZS5zdGFydCArIGNvbW1vbkxlbiwgc3BsaWNlLmRlbGV0ZUNvdW50IC0gY29tbW9uTGVuLCAuLi5zcGxpY2UubmV3T3V0cHV0cy5zbGljZShjb21tb25MZW4pKTtcblx0XHRcdHJlbW92ZWQuZm9yRWFjaChvdXRwdXQgPT4gb3V0cHV0LmRpc3Bvc2UoKSk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZU91dHB1dHMuZmlyZSh7IHN0YXJ0OiBzcGxpY2Uuc3RhcnQgKyBjb21tb25MZW4sIGRlbGV0ZUNvdW50OiBzcGxpY2UuZGVsZXRlQ291bnQgLSBjb21tb25MZW4sIG5ld091dHB1dHM6IHNwbGljZS5uZXdPdXRwdXRzLnNsaWNlKGNvbW1vbkxlbikgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlbW92ZWQgPSB0aGlzLm91dHB1dHMuc3BsaWNlKHNwbGljZS5zdGFydCwgc3BsaWNlLmRlbGV0ZUNvdW50LCAuLi5zcGxpY2UubmV3T3V0cHV0cyk7XG5cdFx0XHRyZW1vdmVkLmZvckVhY2gob3V0cHV0ID0+IG91dHB1dC5kaXNwb3NlKCkpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VPdXRwdXRzLmZpcmUoc3BsaWNlKTtcblx0XHR9XG5cdH1cblxuXHRyZXBsYWNlT3V0cHV0KG91dHB1dElkOiBzdHJpbmcsIG5ld091dHB1dEl0ZW06IElDZWxsT3V0cHV0KSB7XG5cdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSB0aGlzLm91dHB1dHMuZmluZEluZGV4KG91dHB1dCA9PiBvdXRwdXQub3V0cHV0SWQgPT09IG91dHB1dElkKTtcblxuXHRcdGlmIChvdXRwdXRJbmRleCA8IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBvdXRwdXQgPSB0aGlzLm91dHB1dHNbb3V0cHV0SW5kZXhdO1xuXHRcdC8vIGNvbnZlcnQgdG8gZHRvIGFuZCBkaXNwb3NlIHRoZSBjZWxsIG91dHB1dCBtb2RlbFxuXHRcdG91dHB1dC5yZXBsYWNlRGF0YSh7XG5cdFx0XHRvdXRwdXRzOiBuZXdPdXRwdXRJdGVtLm91dHB1dHMsXG5cdFx0XHRvdXRwdXRJZDogbmV3T3V0cHV0SXRlbS5vdXRwdXRJZCxcblx0XHRcdG1ldGFkYXRhOiBuZXdPdXRwdXRJdGVtLm1ldGFkYXRhXG5cdFx0fSk7XG5cdFx0bmV3T3V0cHV0SXRlbS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VPdXRwdXRJdGVtcy5maXJlKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRjaGFuZ2VPdXRwdXRJdGVtcyhvdXRwdXRJZDogc3RyaW5nLCBhcHBlbmQ6IGJvb2xlYW4sIGl0ZW1zOiBJT3V0cHV0SXRlbUR0b1tdKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSB0aGlzLm91dHB1dHMuZmluZEluZGV4KG91dHB1dCA9PiBvdXRwdXQub3V0cHV0SWQgPT09IG91dHB1dElkKTtcblxuXHRcdGlmIChvdXRwdXRJbmRleCA8IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBvdXRwdXQgPSB0aGlzLm91dHB1dHNbb3V0cHV0SW5kZXhdO1xuXHRcdGlmIChhcHBlbmQpIHtcblx0XHRcdG91dHB1dC5hcHBlbmREYXRhKGl0ZW1zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3V0cHV0LnJlcGxhY2VEYXRhKHsgb3V0cHV0SWQ6IG91dHB1dElkLCBvdXRwdXRzOiBpdGVtcywgbWV0YWRhdGE6IG91dHB1dC5tZXRhZGF0YSB9KTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VPdXRwdXRJdGVtcy5maXJlKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIF9vdXRwdXROb3RFcXVhbEZhc3RDaGVjayhsZWZ0OiBJQ2VsbE91dHB1dFtdLCByaWdodDogSUNlbGxPdXRwdXRbXSkge1xuXHRcdGlmIChsZWZ0Lmxlbmd0aCAhPT0gcmlnaHQubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm91dHB1dHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGwgPSBsZWZ0W2ldO1xuXHRcdFx0Y29uc3QgciA9IHJpZ2h0W2ldO1xuXG5cdFx0XHRpZiAobC5vdXRwdXRzLmxlbmd0aCAhPT0gci5vdXRwdXRzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGsgPSAwOyBrIDwgbC5vdXRwdXRzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdGlmIChsLm91dHB1dHNba10ubWltZSAhPT0gci5vdXRwdXRzW2tdLm1pbWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobC5vdXRwdXRzW2tdLmRhdGEuYnl0ZUxlbmd0aCAhPT0gci5vdXRwdXRzW2tdLmRhdGEuYnl0ZUxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZXF1YWwoYjogTm90ZWJvb2tDZWxsVGV4dE1vZGVsKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMubGFuZ3VhZ2UgIT09IGIubGFuZ3VhZ2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vdXRwdXRzLmxlbmd0aCAhPT0gYi5vdXRwdXRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmdldFRleHRMZW5ndGgoKSAhPT0gYi5nZXRUZXh0TGVuZ3RoKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzKSB7XG5cdFx0XHQvLyBjb21wYXJlIG91dHB1dHNcblxuXHRcdFx0aWYgKCF0aGlzLl9vdXRwdXROb3RFcXVhbEZhc3RDaGVjayh0aGlzLm91dHB1dHMsIGIub3V0cHV0cykpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmdldEhhc2hWYWx1ZSgpID09PSBiLmdldEhhc2hWYWx1ZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9ubHkgY29tcGFyZXNcblx0ICogLSBsYW5ndWFnZVxuXHQgKiAtIG1pbWVcblx0ICogLSBjZWxsS2luZFxuXHQgKiAtIGludGVybmFsIG1ldGFkYXRhIChjb25kaXRpb25hbGx5KVxuXHQgKiAtIHNvdXJjZVxuXHQgKi9cblx0ZmFzdEVxdWFsKGI6IElDZWxsRHRvMiwgaWdub3JlTWV0YWRhdGE6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5sYW5ndWFnZSAhPT0gYi5sYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm1pbWUgIT09IGIubWltZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNlbGxLaW5kICE9PSBiLmNlbGxLaW5kKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCFpZ25vcmVNZXRhZGF0YSkge1xuXHRcdFx0aWYgKHRoaXMuaW50ZXJuYWxNZXRhZGF0YT8uZXhlY3V0aW9uT3JkZXIgIT09IGIuaW50ZXJuYWxNZXRhZGF0YT8uZXhlY3V0aW9uT3JkZXJcblx0XHRcdFx0fHwgdGhpcy5pbnRlcm5hbE1ldGFkYXRhPy5sYXN0UnVuU3VjY2VzcyAhPT0gYi5pbnRlcm5hbE1ldGFkYXRhPy5sYXN0UnVuU3VjY2Vzc1xuXHRcdFx0XHR8fCB0aGlzLmludGVybmFsTWV0YWRhdGE/LnJ1blN0YXJ0VGltZSAhPT0gYi5pbnRlcm5hbE1ldGFkYXRhPy5ydW5TdGFydFRpbWVcblx0XHRcdFx0fHwgdGhpcy5pbnRlcm5hbE1ldGFkYXRhPy5ydW5TdGFydFRpbWVBZGp1c3RtZW50ICE9PSBiLmludGVybmFsTWV0YWRhdGE/LnJ1blN0YXJ0VGltZUFkanVzdG1lbnRcblx0XHRcdFx0fHwgdGhpcy5pbnRlcm5hbE1ldGFkYXRhPy5ydW5FbmRUaW1lICE9PSBiLmludGVybmFsTWV0YWRhdGE/LnJ1bkVuZFRpbWUpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE9uY2Ugd2UgYXR0YWNoIHRoZSBjZWxsIHRleHQgYnVmZmVyIHRvIGFuIGVkaXRvciwgdGhlIHNvdXJjZSBvZiB0cnV0aCBpcyB0aGUgdGV4dCBidWZmZXIgaW5zdGVhZCBvZiB0aGUgb3JpZ2luYWwgc291cmNlXG5cdFx0aWYgKHRoaXMuX3RleHRCdWZmZXIpIHtcblx0XHRcdGlmICghTm90ZWJvb2tDZWxsVGV4dE1vZGVsLmxpbmVzQXJlRXF1YWwodGhpcy50ZXh0QnVmZmVyLmdldExpbmVzQ29udGVudCgpLCBiLnNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5fc291cmNlICE9PSBiLnNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgbGluZXNBcmVFcXVhbChhTGluZXM6IHN0cmluZ1tdLCBiOiBzdHJpbmcpIHtcblx0XHRjb25zdCBiTGluZXMgPSBzcGxpdExpbmVzKGIpO1xuXHRcdGlmIChhTGluZXMubGVuZ3RoICE9PSBiTGluZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYUxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoYUxpbmVzW2ldICE9PSBiTGluZXNbaV0pIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0ZGlzcG9zZSh0aGlzLl9vdXRwdXRzKTtcblx0XHQvLyBNYW51YWxseSByZWxlYXNlIHJlZmVyZW5jZSB0byBwcmV2aW91cyB0ZXh0IGJ1ZmZlciB0byBhdm9pZCBsYXJnZSBsZWFrc1xuXHRcdC8vIGluIGNhc2Ugc29tZW9uZSBsZWFrcyBhIENlbGxUZXh0TW9kZWwgcmVmZXJlbmNlXG5cdFx0Y29uc3QgZW1wdHlEaXNwb3NlZFRleHRCdWZmZXIgPSBuZXcgUGllY2VUcmVlVGV4dEJ1ZmZlcihbXSwgJycsICdcXG4nLCBmYWxzZSwgZmFsc2UsIHRydWUsIHRydWUpO1xuXHRcdGVtcHR5RGlzcG9zZWRUZXh0QnVmZmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl90ZXh0QnVmZmVyID0gZW1wdHlEaXNwb3NlZFRleHRCdWZmZXI7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9uZU5vdGVib29rQ2VsbFRleHRNb2RlbChjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwpIHtcblx0cmV0dXJuIHtcblx0XHRzb3VyY2U6IGNlbGwuZ2V0VmFsdWUoKSxcblx0XHRsYW5ndWFnZTogY2VsbC5sYW5ndWFnZSxcblx0XHRtaW1lOiBjZWxsLm1pbWUsXG5cdFx0Y2VsbEtpbmQ6IGNlbGwuY2VsbEtpbmQsXG5cdFx0b3V0cHV0czogY2VsbC5vdXRwdXRzLm1hcChvdXRwdXQgPT4gKHtcblx0XHRcdG91dHB1dHM6IG91dHB1dC5vdXRwdXRzLFxuXHRcdFx0LyogcGFzdGUgc2hvdWxkIGdlbmVyYXRlIG5ldyBvdXRwdXRJZCAqLyBvdXRwdXRJZDogVVVJRC5nZW5lcmF0ZVV1aWQoKVxuXHRcdH0pKSxcblx0XHRtZXRhZGF0YToge31cblx0fTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVJ1blN0YXJ0VGltZUFkanVzdG1lbnQob2xkTWV0YWRhdGE6IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIG5ld01ldGFkYXRhOiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0aWYgKG9sZE1ldGFkYXRhLnJ1blN0YXJ0VGltZSAhPT0gbmV3TWV0YWRhdGEucnVuU3RhcnRUaW1lICYmIHR5cGVvZiBuZXdNZXRhZGF0YS5ydW5TdGFydFRpbWUgPT09ICdudW1iZXInKSB7XG5cdFx0Y29uc3Qgb2Zmc2V0ID0gRGF0ZS5ub3coKSAtIG5ld01ldGFkYXRhLnJ1blN0YXJ0VGltZTtcblx0XHRyZXR1cm4gb2Zmc2V0IDwgMCA/IE1hdGguYWJzKG9mZnNldCkgOiAwO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBuZXdNZXRhZGF0YS5ydW5TdGFydFRpbWVBZGp1c3RtZW50O1xuXHR9XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvcm1hdHRlZE1ldGFkYXRhSlNPTih0cmFuc2llbnRDZWxsTWV0YWRhdGE6IFRyYW5zaWVudENlbGxNZXRhZGF0YSB8IHVuZGVmaW5lZCwgbWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhLCBsYW5ndWFnZT86IHN0cmluZywgc29ydEtleXM/OiBib29sZWFuKTogc3RyaW5nIHtcblx0bGV0IGZpbHRlcmVkTWV0YWRhdGE6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTtcblxuXHRpZiAodHJhbnNpZW50Q2VsbE1ldGFkYXRhKSB7XG5cdFx0Y29uc3Qga2V5cyA9IG5ldyBTZXQoWy4uLk9iamVjdC5rZXlzKG1ldGFkYXRhKV0pO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcblx0XHRcdGlmICghKHRyYW5zaWVudENlbGxNZXRhZGF0YVtrZXkgYXMga2V5b2YgTm90ZWJvb2tDZWxsTWV0YWRhdGFdKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGZpbHRlcmVkTWV0YWRhdGFba2V5XSA9IG1ldGFkYXRhW2tleSBhcyBrZXlvZiBOb3RlYm9va0NlbGxNZXRhZGF0YV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGZpbHRlcmVkTWV0YWRhdGEgPSBtZXRhZGF0YTtcblx0fVxuXG5cdGNvbnN0IG9iaiA9IHtcblx0XHRsYW5ndWFnZSxcblx0XHQuLi5maWx0ZXJlZE1ldGFkYXRhXG5cdH07XG5cdC8vIEdpdmUgcHJlZmVyZW5jZSB0byB0aGUgbGFuZ3VhZ2Ugd2UgaGF2ZSBiZWVuIGdpdmVuLlxuXHQvLyBNZXRhZGF0YSBjYW4gY29udGFpbiBgbGFuZ3VhZ2VgIGR1ZSB0byByb3VuZC10cmlwcGluZyBvZiBjZWxsIG1ldGFkYXRhLlxuXHQvLyBJLmUuIHdlIGFkZCBpdCBoZXJlLCBhbmQgdGhlbiBmcm9tIFNDTSB3aGVuIHdlIHJldmVydCB0aGUgY2VsbCwgd2UgZ2V0IHRoaXMgc2FtZSBtZXRhZGF0YSBiYWNrIHdpdGggdGhlIGBsYW5ndWFnZWAgcHJvcGVydHkuXG5cdGlmIChsYW5ndWFnZSkge1xuXHRcdG9iai5sYW5ndWFnZSA9IGxhbmd1YWdlO1xuXHR9XG5cdGNvbnN0IG1ldGFkYXRhU291cmNlID0gdG9Gb3JtYXR0ZWRTdHJpbmcoc29ydEtleXMgPyBzb3J0T2JqZWN0UHJvcGVydGllc1JlY3Vyc2l2ZWx5KG9iaikgOiBvYmosIHt9KTtcblxuXHRyZXR1cm4gbWV0YWRhdGFTb3VyY2U7XG59XG5cblxuLyoqXG4gKiBTb3J0IHRoZSBKU09OIHRvIGVuc3VyZSB3aGVuIGRpZmZpbmcsIHRoZSBKU09OIGtleXMgYXJlIHNvcnRlZCAmIG1hdGNoZWQgY29ycmVjdGx5IGluIGRpZmYgdmlldy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNvcnRPYmplY3RQcm9wZXJ0aWVzUmVjdXJzaXZlbHkob2JqOiBhbnkpOiBhbnkge1xuXHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG5cdFx0cmV0dXJuIG9iai5tYXAoc29ydE9iamVjdFByb3BlcnRpZXNSZWN1cnNpdmVseSk7XG5cdH1cblx0aWYgKG9iaiAhPT0gdW5kZWZpbmVkICYmIG9iaiAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA+IDApIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0T2JqZWN0LmtleXMob2JqKVxuXHRcdFx0XHQuc29ydCgpXG5cdFx0XHRcdC5yZWR1Y2U8UmVjb3JkPHN0cmluZywgYW55Pj4oKHNvcnRlZE9iaiwgcHJvcCkgPT4ge1xuXHRcdFx0XHRcdHNvcnRlZE9ialtwcm9wXSA9IHNvcnRPYmplY3RQcm9wZXJ0aWVzUmVjdXJzaXZlbHkob2JqW3Byb3BdKTtcblx0XHRcdFx0XHRyZXR1cm4gc29ydGVkT2JqO1xuXHRcdFx0XHR9LCB7fSkgYXMgYW55XG5cdFx0KTtcblx0fVxuXHRyZXR1cm4gb2JqO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFzQjtBQUMvQixTQUFTLE1BQU0sa0JBQWtCO0FBQ2pDLFNBQVMsWUFBWSxpQkFBaUIsZUFBZTtBQUVyRCxZQUFZLFVBQVU7QUFDdEIsU0FBUyxhQUFhO0FBQ3RCLFlBQVksV0FBVztBQUN2QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHdCQUFtQztBQUM1QyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLG1DQUFtQztBQUU1QyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGtCQUFrQjtBQUVwQixNQUFNLHlCQUFOLE1BQU0sK0JBQThCLFdBQTRCO0FBQUEsRUF3S3RFLFlBQ1UsS0FDTyxRQUNDLFNBQ1QsV0FDQSxPQUNRLFVBQ2hCLFNBQ0EsVUFDQSxrQkFDZ0IsZUFDQSxrQkFDQyxrQkFDQSw0QkFBbUUsUUFDbkY7QUFDRCxVQUFNO0FBZEc7QUFDTztBQUNDO0FBQ1Q7QUFDQTtBQUNRO0FBSUE7QUFDQTtBQUND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
