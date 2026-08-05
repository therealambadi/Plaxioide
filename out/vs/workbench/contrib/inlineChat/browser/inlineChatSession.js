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
import { Emitter, Event } from "../../../../base/common/event.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { CTX_INLINE_CHAT_HAS_STASHED_SESSION } from "../common/inlineChat.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { DetailedLineRangeMapping } from "../../../../editor/common/diff/rangeMapping.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { coalesceInPlace } from "../../../../base/common/arrays.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
const _SessionWholeRange = class _SessionWholeRange {
  constructor(_textModel, wholeRange) {
    this._textModel = _textModel;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._decorationIds = [];
    this._decorationIds = _textModel.deltaDecorations([], [{ range: wholeRange, options: _SessionWholeRange._options }]);
  }
  dispose() {
    this._onDidChange.dispose();
    if (!this._textModel.isDisposed()) {
      this._textModel.deltaDecorations(this._decorationIds, []);
    }
  }
  fixup(changes) {
    const newDeco = [];
    for (const { modified } of changes) {
      const modifiedRange = this._textModel.validateRange(modified.isEmpty ? new Range(modified.startLineNumber, 1, modified.startLineNumber, Number.MAX_SAFE_INTEGER) : new Range(modified.startLineNumber, 1, modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER));
      newDeco.push({ range: modifiedRange, options: _SessionWholeRange._options });
    }
    const [first, ...rest] = this._decorationIds;
    const newIds = this._textModel.deltaDecorations(rest, newDeco);
    this._decorationIds = [first].concat(newIds);
    this._onDidChange.fire(this);
  }
  get trackedInitialRange() {
    const [first] = this._decorationIds;
    return this._textModel.getDecorationRange(first) ?? new Range(1, 1, 1, 1);
  }
  get value() {
    let result;
    for (const id of this._decorationIds) {
      const range = this._textModel.getDecorationRange(id);
      if (range) {
        if (!result) {
          result = range;
        } else {
          result = Range.plusRange(result, range);
        }
      }
    }
    return result;
  }
};
_SessionWholeRange._options = ModelDecorationOptions.register({ description: "inlineChat/session/wholeRange" });
let SessionWholeRange = _SessionWholeRange;
class Session {
  constructor(headless, targetUri, textModel0, textModelN, agent, wholeRange, hunkData, chatModel, versionsByRequest) {
    this.headless = headless;
    this.targetUri = targetUri;
    this.textModel0 = textModel0;
    this.textModelN = textModelN;
    this.agent = agent;
    this.wholeRange = wholeRange;
    this.hunkData = hunkData;
    this.chatModel = chatModel;
    this._isUnstashed = false;
    this._startTime = /* @__PURE__ */ new Date();
    this._versionByRequest = /* @__PURE__ */ new Map();
    this._teldata = {
      extension: ExtensionIdentifier.toKey(agent.extensionId),
      startTime: this._startTime.toISOString(),
      endTime: this._startTime.toISOString(),
      edits: 0,
      finishedByEdit: false,
      rounds: "",
      undos: "",
      unstashed: 0,
      acceptedHunks: 0,
      discardedHunks: 0,
      responseTypes: ""
    };
    if (versionsByRequest) {
      this._versionByRequest = new Map(versionsByRequest);
    }
  }
  get isUnstashed() {
    return this._isUnstashed;
  }
  markUnstashed() {
    this._teldata.unstashed += 1;
    this._isUnstashed = true;
  }
  markModelVersion(request) {
    this._versionByRequest.set(request.id, this.textModelN.getAlternativeVersionId());
  }
  get versionsByRequest() {
    return Array.from(this._versionByRequest);
  }
  async undoChangesUntil(requestId) {
    const targetAltVersion = this._versionByRequest.get(requestId);
    if (targetAltVersion === void 0) {
      return false;
    }
    this.hunkData.ignoreTextModelNChanges = true;
    try {
      while (targetAltVersion < this.textModelN.getAlternativeVersionId() && this.textModelN.canUndo()) {
        await this.textModelN.undo();
      }
    } finally {
      this.hunkData.ignoreTextModelNChanges = false;
    }
    return true;
  }
  get hasChangedText() {
    return !this.textModel0.equalsTextBuffer(this.textModelN.getTextBuffer());
  }
  asChangedText(changes) {
    if (changes.length === 0) {
      return void 0;
    }
    let startLine = Number.MAX_VALUE;
    let endLine = Number.MIN_VALUE;
    for (const change of changes) {
      startLine = Math.min(startLine, change.modified.startLineNumber);
      endLine = Math.max(endLine, change.modified.endLineNumberExclusive);
    }
    return this.textModelN.getValueInRange(new Range(startLine, 1, endLine, Number.MAX_VALUE));
  }
  recordExternalEditOccurred(didFinish) {
    this._teldata.edits += 1;
    this._teldata.finishedByEdit = didFinish;
  }
  asTelemetryData() {
    for (const item of this.hunkData.getInfo()) {
      switch (item.getState()) {
        case 1 /* Accepted */:
          this._teldata.acceptedHunks += 1;
          break;
        case 2 /* Rejected */:
          this._teldata.discardedHunks += 1;
          break;
      }
    }
    this._teldata.endTime = (/* @__PURE__ */ new Date()).toISOString();
    return this._teldata;
  }
}
let StashedSession = class {
  constructor(editor, session, _undoCancelEdits, contextKeyService, _sessionService, _logService) {
    this._undoCancelEdits = _undoCancelEdits;
    this._sessionService = _sessionService;
    this._logService = _logService;
    this._ctxHasStashedSession = CTX_INLINE_CHAT_HAS_STASHED_SESSION.bindTo(contextKeyService);
    this._session = session;
    this._ctxHasStashedSession.set(true);
    this._listener = Event.once(Event.any(editor.onDidChangeCursorSelection, editor.onDidChangeModelContent, editor.onDidChangeModel, editor.onDidBlurEditorWidget))(() => {
      this._session = void 0;
      this._sessionService.releaseSession(session);
      this._ctxHasStashedSession.reset();
    });
  }
  dispose() {
    this._listener.dispose();
    this._ctxHasStashedSession.reset();
    if (this._session) {
      this._sessionService.releaseSession(this._session);
    }
  }
  unstash() {
    if (!this._session) {
      return void 0;
    }
    this._listener.dispose();
    const result = this._session;
    result.markUnstashed();
    result.hunkData.ignoreTextModelNChanges = true;
    result.textModelN.pushEditOperations(null, this._undoCancelEdits, () => null);
    result.hunkData.ignoreTextModelNChanges = false;
    this._session = void 0;
    this._logService.debug("[IE] Unstashed session");
    return result;
  }
};
StashedSession = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInlineChatSessionService),
  __decorateParam(5, ILogService)
], StashedSession);
function lineRangeAsRange(lineRange, model) {
  return lineRange.isEmpty ? new Range(lineRange.startLineNumber, 1, lineRange.startLineNumber, Number.MAX_SAFE_INTEGER) : new Range(lineRange.startLineNumber, 1, lineRange.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER);
}
let HunkData = class {
  constructor(_editorWorkerService, _textModel0, _textModelN) {
    this._editorWorkerService = _editorWorkerService;
    this._textModel0 = _textModel0;
    this._textModelN = _textModelN;
    this._store = new DisposableStore();
    this._data = /* @__PURE__ */ new Map();
    this._ignoreChanges = false;
    this._store.add(_textModelN.onDidChangeContent((e) => {
      if (!this._ignoreChanges) {
        this._mirrorChanges(e);
      }
    }));
  }
  dispose() {
    if (!this._textModelN.isDisposed()) {
      this._textModelN.changeDecorations((accessor) => {
        for (const { textModelNDecorations } of this._data.values()) {
          textModelNDecorations.forEach(accessor.removeDecoration, accessor);
        }
      });
    }
    if (!this._textModel0.isDisposed()) {
      this._textModel0.changeDecorations((accessor) => {
        for (const { textModel0Decorations } of this._data.values()) {
          textModel0Decorations.forEach(accessor.removeDecoration, accessor);
        }
      });
    }
    this._data.clear();
    this._store.dispose();
  }
  set ignoreTextModelNChanges(value) {
    this._ignoreChanges = value;
  }
  get ignoreTextModelNChanges() {
    return this._ignoreChanges;
  }
  _mirrorChanges(event) {
    const hunkRanges = [];
    const ranges0 = [];
    for (const entry of this._data.values()) {
      if (entry.state === 0 /* Pending */) {
        for (let i = 1; i < entry.textModelNDecorations.length; i++) {
          const rangeN = this._textModelN.getDecorationRange(entry.textModelNDecorations[i]);
          const range0 = this._textModel0.getDecorationRange(entry.textModel0Decorations[i]);
          if (rangeN && range0) {
            hunkRanges.push({
              rangeN,
              range0,
              markAccepted: () => entry.state = 1 /* Accepted */
            });
          }
        }
      } else if (entry.state === 1 /* Accepted */) {
        for (let i = 1; i < entry.textModel0Decorations.length; i++) {
          const range = this._textModel0.getDecorationRange(entry.textModel0Decorations[i]);
          if (range) {
            ranges0.push(range);
          }
        }
      }
    }
    hunkRanges.sort((a, b) => Range.compareRangesUsingStarts(a.rangeN, b.rangeN));
    ranges0.sort(Range.compareRangesUsingStarts);
    const edits = [];
    for (const change of event.changes) {
      let isOverlapping = false;
      let pendingChangesLen = 0;
      for (const entry of hunkRanges) {
        if (entry.rangeN.getEndPosition().isBefore(Range.getStartPosition(change.range))) {
          pendingChangesLen += this._textModelN.getValueLengthInRange(entry.rangeN);
          pendingChangesLen -= this._textModel0.getValueLengthInRange(entry.range0);
        } else if (Range.areIntersectingOrTouching(entry.rangeN, change.range)) {
          entry.markAccepted();
          isOverlapping = true;
          break;
        } else {
          break;
        }
      }
      if (isOverlapping) {
        continue;
      }
      const offset0 = change.rangeOffset - pendingChangesLen;
      const start0 = this._textModel0.getPositionAt(offset0);
      let acceptedChangesLen = 0;
      for (const range of ranges0) {
        if (range.getEndPosition().isBefore(start0)) {
          acceptedChangesLen += this._textModel0.getValueLengthInRange(range);
        }
      }
      const start = this._textModel0.getPositionAt(offset0 + acceptedChangesLen);
      const end = this._textModel0.getPositionAt(offset0 + acceptedChangesLen + change.rangeLength);
      edits.push(EditOperation.replace(Range.fromPositions(start, end), change.text));
    }
    this._textModel0.pushEditOperations(null, edits, () => null);
  }
  async recompute(editState, diff) {
    diff ??= await this._editorWorkerService.computeDiff(this._textModel0.uri, this._textModelN.uri, { ignoreTrimWhitespace: false, maxComputationTimeMs: Number.MAX_SAFE_INTEGER, computeMoves: false }, "advanced");
    let mergedChanges = [];
    if (diff && diff.changes.length > 0) {
      mergedChanges = [diff.changes[0]];
      for (let i = 1; i < diff.changes.length; i++) {
        const lastChange = mergedChanges[mergedChanges.length - 1];
        const thisChange = diff.changes[i];
        if (thisChange.modified.startLineNumber - lastChange.modified.endLineNumberExclusive <= HunkData._HUNK_THRESHOLD) {
          mergedChanges[mergedChanges.length - 1] = new DetailedLineRangeMapping(
            lastChange.original.join(thisChange.original),
            lastChange.modified.join(thisChange.modified),
            (lastChange.innerChanges ?? []).concat(thisChange.innerChanges ?? [])
          );
        } else {
          mergedChanges.push(thisChange);
        }
      }
    }
    const hunks = mergedChanges.map((change) => new RawHunk(change.original, change.modified, change.innerChanges ?? []));
    editState.applied = hunks.length;
    this._textModelN.changeDecorations((accessorN) => {
      this._textModel0.changeDecorations((accessor0) => {
        for (const { textModelNDecorations, textModel0Decorations } of this._data.values()) {
          textModelNDecorations.forEach(accessorN.removeDecoration, accessorN);
          textModel0Decorations.forEach(accessor0.removeDecoration, accessor0);
        }
        this._data.clear();
        for (const hunk of hunks) {
          const textModelNDecorations = [];
          const textModel0Decorations = [];
          textModelNDecorations.push(accessorN.addDecoration(lineRangeAsRange(hunk.modified, this._textModelN), HunkData._HUNK_TRACKED_RANGE));
          textModel0Decorations.push(accessor0.addDecoration(lineRangeAsRange(hunk.original, this._textModel0), HunkData._HUNK_TRACKED_RANGE));
          for (const change of hunk.changes) {
            textModelNDecorations.push(accessorN.addDecoration(change.modifiedRange, HunkData._HUNK_TRACKED_RANGE));
            textModel0Decorations.push(accessor0.addDecoration(change.originalRange, HunkData._HUNK_TRACKED_RANGE));
          }
          this._data.set(hunk, {
            editState,
            textModelNDecorations,
            textModel0Decorations,
            state: 0 /* Pending */
          });
        }
      });
    });
  }
  get size() {
    return this._data.size;
  }
  get pending() {
    return Iterable.reduce(this._data.values(), (r, { state }) => r + (state === 0 /* Pending */ ? 1 : 0), 0);
  }
  _discardEdits(item) {
    const edits = [];
    const rangesN = item.getRangesN();
    const ranges0 = item.getRanges0();
    for (let i = 1; i < rangesN.length; i++) {
      const modifiedRange = rangesN[i];
      const originalValue = this._textModel0.getValueInRange(ranges0[i]);
      edits.push(EditOperation.replace(modifiedRange, originalValue));
    }
    return edits;
  }
  discardAll() {
    const edits = [];
    for (const item of this.getInfo()) {
      if (item.getState() === 0 /* Pending */) {
        edits.push(this._discardEdits(item));
      }
    }
    const undoEdits = [];
    this._textModelN.pushEditOperations(null, edits.flat(), (_undoEdits) => {
      undoEdits.push(_undoEdits);
      return null;
    });
    return undoEdits.flat();
  }
  getInfo() {
    const result = [];
    for (const [hunk, data] of this._data.entries()) {
      const item = {
        getState: () => {
          return data.state;
        },
        isInsertion: () => {
          return hunk.original.isEmpty;
        },
        getRangesN: () => {
          const ranges = data.textModelNDecorations.map((id) => this._textModelN.getDecorationRange(id));
          coalesceInPlace(ranges);
          return ranges;
        },
        getRanges0: () => {
          const ranges = data.textModel0Decorations.map((id) => this._textModel0.getDecorationRange(id));
          coalesceInPlace(ranges);
          return ranges;
        },
        discardChanges: () => {
          if (data.state === 0 /* Pending */) {
            const edits = this._discardEdits(item);
            this._textModelN.pushEditOperations(null, edits, () => null);
            data.state = 2 /* Rejected */;
            if (data.editState.applied > 0) {
              data.editState.applied -= 1;
            }
          }
        },
        acceptChanges: () => {
          if (data.state === 0 /* Pending */) {
            const edits = [];
            const rangesN = item.getRangesN();
            const ranges0 = item.getRanges0();
            for (let i = 1; i < ranges0.length; i++) {
              const originalRange = ranges0[i];
              const modifiedValue = this._textModelN.getValueInRange(rangesN[i]);
              edits.push(EditOperation.replace(originalRange, modifiedValue));
            }
            this._textModel0.pushEditOperations(null, edits, () => null);
            data.state = 1 /* Accepted */;
          }
        }
      };
      result.push(item);
    }
    return result;
  }
};
HunkData._HUNK_TRACKED_RANGE = ModelDecorationOptions.register({
  description: "inline-chat-hunk-tracked-range",
  stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
});
HunkData._HUNK_THRESHOLD = 8;
HunkData = __decorateClass([
  __decorateParam(0, IEditorWorkerService)
], HunkData);
class RawHunk {
  constructor(original, modified, changes) {
    this.original = original;
    this.modified = modified;
    this.changes = changes;
  }
}
var HunkState = /* @__PURE__ */ ((HunkState2) => {
  HunkState2[HunkState2["Pending"] = 0] = "Pending";
  HunkState2[HunkState2["Accepted"] = 1] = "Accepted";
  HunkState2[HunkState2["Rejected"] = 2] = "Rejected";
  return HunkState2;
})(HunkState || {});
export {
  HunkData,
  HunkState,
  Session,
  SessionWholeRange,
  StashedSession
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24sIElNb2RlbERlY29yYXRpb25PcHRpb25zLCBJTW9kZWxEZWx0YURlY29yYXRpb24sIElUZXh0TW9kZWwsIElWYWxpZEVkaXRPcGVyYXRpb24sIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENUWF9JTkxJTkVfQ0hBVF9IQVNfU1RBU0hFRF9TRVNTSU9OIH0gZnJvbSAnLi4vY29tbW9uL2lubGluZUNoYXQuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiwgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsIExpbmVSYW5nZU1hcHBpbmcsIFJhbmdlTWFwcGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZGlmZi9yYW5nZU1hcHBpbmcuanMnO1xuaW1wb3J0IHsgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZUluUGxhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZWwsIElDaGF0UmVxdWVzdE1vZGVsLCBJQ2hhdFRleHRFZGl0R3JvdXBTdGF0ZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50IH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBJRG9jdW1lbnREaWZmIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL2RvY3VtZW50RGlmZlByb3ZpZGVyLmpzJztcblxuXG5leHBvcnQgdHlwZSBUZWxlbWV0cnlEYXRhID0ge1xuXHRleHRlbnNpb246IHN0cmluZztcblx0cm91bmRzOiBzdHJpbmc7XG5cdHVuZG9zOiBzdHJpbmc7XG5cdHVuc3Rhc2hlZDogbnVtYmVyO1xuXHRlZGl0czogbnVtYmVyO1xuXHRmaW5pc2hlZEJ5RWRpdDogYm9vbGVhbjtcblx0c3RhcnRUaW1lOiBzdHJpbmc7XG5cdGVuZFRpbWU6IHN0cmluZztcblx0YWNjZXB0ZWRIdW5rczogbnVtYmVyO1xuXHRkaXNjYXJkZWRIdW5rczogbnVtYmVyO1xuXHRyZXNwb25zZVR5cGVzOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBUZWxlbWV0cnlEYXRhQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnanJpZWtlbic7XG5cdGNvbW1lbnQ6ICdEYXRhIGFib3V0IGFuIGludGVyYWN0aW9uIGVkaXRvciBzZXNzaW9uJztcblx0ZXh0ZW5zaW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiBwcm92aWRpbmcgdGhlIGRhdGEnIH07XG5cdHJvdW5kczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ051bWJlciBvZiByZXF1ZXN0IHRoYXQgd2VyZSBtYWRlJyB9O1xuXHR1bmRvczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1JlcXVlc3RzIHRoYXQgaGF2ZSBiZWVuIHVuZG9uZScgfTtcblx0ZWRpdHM6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdEaWQgZWRpdHMgaGFwcGVuIHdoaWxlIHRoZSBzZXNzaW9uIHdhcyBhY3RpdmUnIH07XG5cdHVuc3Rhc2hlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0hvdyBvZnRlbiBkaWQgdGhpcyBzZXNzaW9uIGJlY29tZSBzdGFzaGVkIGFuZCByZXN1bWVkJyB9O1xuXHRmaW5pc2hlZEJ5RWRpdDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0RpZCBlZGl0cyBjYXVzZSB0aGUgc2Vzc2lvbiB0byB0ZXJtaW5hdGUnIH07XG5cdHN0YXJ0VGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZW4gdGhlIHNlc3Npb24gc3RhcnRlZCcgfTtcblx0ZW5kVGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZW4gdGhlIHNlc3Npb24gZW5kZWQnIH07XG5cdGFjY2VwdGVkSHVua3M6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdOdW1iZXIgb2YgYWNjZXB0ZWQgaHVua3MnIH07XG5cdGRpc2NhcmRlZEh1bmtzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIGRpc2NhcmRlZCBodW5rcycgfTtcblx0cmVzcG9uc2VUeXBlczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0NvbW1hIHNlcGFyYXRlZCBsaXN0IG9mIHJlc3BvbnNlIHR5cGVzIGxpa2UgZWRpdHMsIG1lc3NhZ2UsIG1peGVkJyB9O1xufTtcblxuXG5leHBvcnQgY2xhc3MgU2Vzc2lvbldob2xlUmFuZ2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9vcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoeyBkZXNjcmlwdGlvbjogJ2lubGluZUNoYXQvc2Vzc2lvbi93aG9sZVJhbmdlJyB9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPHRoaXM+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx0aGlzPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX2RlY29yYXRpb25JZHM6IHN0cmluZ1tdID0gW107XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsOiBJVGV4dE1vZGVsLCB3aG9sZVJhbmdlOiBJUmFuZ2UpIHtcblx0XHR0aGlzLl9kZWNvcmF0aW9uSWRzID0gX3RleHRNb2RlbC5kZWx0YURlY29yYXRpb25zKFtdLCBbeyByYW5nZTogd2hvbGVSYW5nZSwgb3B0aW9uczogU2Vzc2lvbldob2xlUmFuZ2UuX29wdGlvbnMgfV0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdFx0aWYgKCF0aGlzLl90ZXh0TW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHR0aGlzLl90ZXh0TW9kZWwuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLl9kZWNvcmF0aW9uSWRzLCBbXSk7XG5cdFx0fVxuXHR9XG5cblx0Zml4dXAoY2hhbmdlczogcmVhZG9ubHkgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10pOiB2b2lkIHtcblx0XHRjb25zdCBuZXdEZWNvOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgeyBtb2RpZmllZCB9IG9mIGNoYW5nZXMpIHtcblx0XHRcdGNvbnN0IG1vZGlmaWVkUmFuZ2UgPSB0aGlzLl90ZXh0TW9kZWwudmFsaWRhdGVSYW5nZShtb2RpZmllZC5pc0VtcHR5XG5cdFx0XHRcdD8gbmV3IFJhbmdlKG1vZGlmaWVkLnN0YXJ0TGluZU51bWJlciwgMSwgbW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcblx0XHRcdFx0OiBuZXcgUmFuZ2UobW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCAxLCBtb2RpZmllZC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpKTtcblxuXHRcdFx0bmV3RGVjby5wdXNoKHsgcmFuZ2U6IG1vZGlmaWVkUmFuZ2UsIG9wdGlvbnM6IFNlc3Npb25XaG9sZVJhbmdlLl9vcHRpb25zIH0pO1xuXHRcdH1cblx0XHRjb25zdCBbZmlyc3QsIC4uLnJlc3RdID0gdGhpcy5fZGVjb3JhdGlvbklkczsgLy8gZmlyc3QgaXMgdGhlIG9yaWdpbmFsIHdob2xlIHJhbmdlXG5cdFx0Y29uc3QgbmV3SWRzID0gdGhpcy5fdGV4dE1vZGVsLmRlbHRhRGVjb3JhdGlvbnMocmVzdCwgbmV3RGVjbyk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbklkcyA9IFtmaXJzdF0uY29uY2F0KG5ld0lkcyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh0aGlzKTtcblx0fVxuXG5cdGdldCB0cmFja2VkSW5pdGlhbFJhbmdlKCk6IFJhbmdlIHtcblx0XHRjb25zdCBbZmlyc3RdID0gdGhpcy5fZGVjb3JhdGlvbklkcztcblx0XHRyZXR1cm4gdGhpcy5fdGV4dE1vZGVsLmdldERlY29yYXRpb25SYW5nZShmaXJzdCkgPz8gbmV3IFJhbmdlKDEsIDEsIDEsIDEpO1xuXHR9XG5cblx0Z2V0IHZhbHVlKCk6IFJhbmdlIHtcblx0XHRsZXQgcmVzdWx0OiBSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRoaXMuX2RlY29yYXRpb25JZHMpIHtcblx0XHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fdGV4dE1vZGVsLmdldERlY29yYXRpb25SYW5nZShpZCk7XG5cdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0XHRyZXN1bHQgPSByYW5nZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQgPSBSYW5nZS5wbHVzUmFuZ2UocmVzdWx0LCByYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdCE7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNlc3Npb24ge1xuXG5cdHByaXZhdGUgX2lzVW5zdGFzaGVkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RlbGRhdGE6IFRlbGVtZXRyeURhdGE7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdmVyc2lvbkJ5UmVxdWVzdCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaGVhZGxlc3M6IGJvb2xlYW4sXG5cdFx0LyoqXG5cdFx0ICogVGhlIFVSSSBvZiB0aGUgZG9jdW1lbnQgd2hpY2ggaXMgYmVpbmcgRWRpdG9yRWRpdFxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IHRhcmdldFVyaTogVVJJLFxuXHRcdC8qKlxuXHRcdCAqIEEgY29weSBvZiB0aGUgZG9jdW1lbnQgYXQgdGhlIHRpbWUgdGhlIHNlc3Npb24gd2FzIHN0YXJ0ZWRcblx0XHQgKi9cblx0XHRyZWFkb25seSB0ZXh0TW9kZWwwOiBJVGV4dE1vZGVsLFxuXHRcdC8qKlxuXHRcdCAqIFRoZSBtb2RlbCBvZiB0aGUgZWRpdG9yXG5cdFx0ICovXG5cdFx0cmVhZG9ubHkgdGV4dE1vZGVsTjogSVRleHRNb2RlbCxcblx0XHRyZWFkb25seSBhZ2VudDogSUNoYXRBZ2VudCxcblx0XHRyZWFkb25seSB3aG9sZVJhbmdlOiBTZXNzaW9uV2hvbGVSYW5nZSxcblx0XHRyZWFkb25seSBodW5rRGF0YTogSHVua0RhdGEsXG5cdFx0cmVhZG9ubHkgY2hhdE1vZGVsOiBDaGF0TW9kZWwsXG5cdFx0dmVyc2lvbnNCeVJlcXVlc3Q/OiBbc3RyaW5nLCBudW1iZXJdW10sIC8vIERFQlQ/IHRoaXMgaXMgbmVlZGVkIHdoZW4gYSBjaGF0IG1vZGVsIGlzIFwicmV1c2VkXCIgZm9yIGEgbmV3IGNoYXQgc2Vzc2lvblxuXHQpIHtcblxuXHRcdHRoaXMuX3RlbGRhdGEgPSB7XG5cdFx0XHRleHRlbnNpb246IEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoYWdlbnQuZXh0ZW5zaW9uSWQpLFxuXHRcdFx0c3RhcnRUaW1lOiB0aGlzLl9zdGFydFRpbWUudG9JU09TdHJpbmcoKSxcblx0XHRcdGVuZFRpbWU6IHRoaXMuX3N0YXJ0VGltZS50b0lTT1N0cmluZygpLFxuXHRcdFx0ZWRpdHM6IDAsXG5cdFx0XHRmaW5pc2hlZEJ5RWRpdDogZmFsc2UsXG5cdFx0XHRyb3VuZHM6ICcnLFxuXHRcdFx0dW5kb3M6ICcnLFxuXHRcdFx0dW5zdGFzaGVkOiAwLFxuXHRcdFx0YWNjZXB0ZWRIdW5rczogMCxcblx0XHRcdGRpc2NhcmRlZEh1bmtzOiAwLFxuXHRcdFx0cmVzcG9uc2VUeXBlczogJydcblx0XHR9O1xuXHRcdGlmICh2ZXJzaW9uc0J5UmVxdWVzdCkge1xuXHRcdFx0dGhpcy5fdmVyc2lvbkJ5UmVxdWVzdCA9IG5ldyBNYXAodmVyc2lvbnNCeVJlcXVlc3QpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpc1Vuc3Rhc2hlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNVbnN0YXNoZWQ7XG5cdH1cblxuXHRtYXJrVW5zdGFzaGVkKCkge1xuXHRcdHRoaXMuX3RlbGRhdGEudW5zdGFzaGVkISArPSAxO1xuXHRcdHRoaXMuX2lzVW5zdGFzaGVkID0gdHJ1ZTtcblx0fVxuXG5cdG1hcmtNb2RlbFZlcnNpb24ocmVxdWVzdDogSUNoYXRSZXF1ZXN0TW9kZWwpIHtcblx0XHR0aGlzLl92ZXJzaW9uQnlSZXF1ZXN0LnNldChyZXF1ZXN0LmlkLCB0aGlzLnRleHRNb2RlbE4uZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSk7XG5cdH1cblxuXHRnZXQgdmVyc2lvbnNCeVJlcXVlc3QoKSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5fdmVyc2lvbkJ5UmVxdWVzdCk7XG5cdH1cblxuXHRhc3luYyB1bmRvQ2hhbmdlc1VudGlsKHJlcXVlc3RJZDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHRjb25zdCB0YXJnZXRBbHRWZXJzaW9uID0gdGhpcy5fdmVyc2lvbkJ5UmVxdWVzdC5nZXQocmVxdWVzdElkKTtcblx0XHRpZiAodGFyZ2V0QWx0VmVyc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIHVuZG8gdGlsbCB0aGlzIHBvaW50XG5cdFx0dGhpcy5odW5rRGF0YS5pZ25vcmVUZXh0TW9kZWxOQ2hhbmdlcyA9IHRydWU7XG5cdFx0dHJ5IHtcblx0XHRcdHdoaWxlICh0YXJnZXRBbHRWZXJzaW9uIDwgdGhpcy50ZXh0TW9kZWxOLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCkgJiYgdGhpcy50ZXh0TW9kZWxOLmNhblVuZG8oKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRleHRNb2RlbE4udW5kbygpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmh1bmtEYXRhLmlnbm9yZVRleHRNb2RlbE5DaGFuZ2VzID0gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Z2V0IGhhc0NoYW5nZWRUZXh0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy50ZXh0TW9kZWwwLmVxdWFsc1RleHRCdWZmZXIodGhpcy50ZXh0TW9kZWxOLmdldFRleHRCdWZmZXIoKSk7XG5cdH1cblxuXHRhc0NoYW5nZWRUZXh0KGNoYW5nZXM6IHJlYWRvbmx5IExpbmVSYW5nZU1hcHBpbmdbXSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGNoYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCBzdGFydExpbmUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXHRcdGxldCBlbmRMaW5lID0gTnVtYmVyLk1JTl9WQUxVRTtcblx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBjaGFuZ2VzKSB7XG5cdFx0XHRzdGFydExpbmUgPSBNYXRoLm1pbihzdGFydExpbmUsIGNoYW5nZS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0ZW5kTGluZSA9IE1hdGgubWF4KGVuZExpbmUsIGNoYW5nZS5tb2RpZmllZC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy50ZXh0TW9kZWxOLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2Uoc3RhcnRMaW5lLCAxLCBlbmRMaW5lLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdH1cblxuXHRyZWNvcmRFeHRlcm5hbEVkaXRPY2N1cnJlZChkaWRGaW5pc2g6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl90ZWxkYXRhLmVkaXRzICs9IDE7XG5cdFx0dGhpcy5fdGVsZGF0YS5maW5pc2hlZEJ5RWRpdCA9IGRpZEZpbmlzaDtcblx0fVxuXG5cdGFzVGVsZW1ldHJ5RGF0YSgpOiBUZWxlbWV0cnlEYXRhIHtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmh1bmtEYXRhLmdldEluZm8oKSkge1xuXHRcdFx0c3dpdGNoIChpdGVtLmdldFN0YXRlKCkpIHtcblx0XHRcdFx0Y2FzZSBIdW5rU3RhdGUuQWNjZXB0ZWQ6XG5cdFx0XHRcdFx0dGhpcy5fdGVsZGF0YS5hY2NlcHRlZEh1bmtzICs9IDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgSHVua1N0YXRlLlJlamVjdGVkOlxuXHRcdFx0XHRcdHRoaXMuX3RlbGRhdGEuZGlzY2FyZGVkSHVua3MgKz0gMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl90ZWxkYXRhLmVuZFRpbWUgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cdFx0cmV0dXJuIHRoaXMuX3RlbGRhdGE7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgU3Rhc2hlZFNlc3Npb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4SGFzU3Rhc2hlZFNlc3Npb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9zZXNzaW9uOiBTZXNzaW9uIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0c2Vzc2lvbjogU2Vzc2lvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF91bmRvQ2FuY2VsRWRpdHM6IElWYWxpZEVkaXRPcGVyYXRpb25bXSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvblNlcnZpY2U6IElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2N0eEhhc1N0YXNoZWRTZXNzaW9uID0gQ1RYX0lOTElORV9DSEFUX0hBU19TVEFTSEVEX1NFU1NJT04uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdC8vIGtlZXAgc2Vzc2lvbiBmb3IgYSBsaXR0bGUgYml0LCBvbmx5IHJlbGVhc2Ugd2hlbiB1c2VyIGNvbnRpbnVlcyB0byB3b3JrICh0eXBlLCBtb3ZlIGN1cnNvciwgZXRjLilcblx0XHR0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblx0XHR0aGlzLl9jdHhIYXNTdGFzaGVkU2Vzc2lvbi5zZXQodHJ1ZSk7XG5cdFx0dGhpcy5fbGlzdGVuZXIgPSBFdmVudC5vbmNlKEV2ZW50LmFueShlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24sIGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCwgZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwsIGVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQpKSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9zZXNzaW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fc2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24oc2Vzc2lvbik7XG5cdFx0XHR0aGlzLl9jdHhIYXNTdGFzaGVkU2Vzc2lvbi5yZXNldCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9saXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY3R4SGFzU3Rhc2hlZFNlc3Npb24ucmVzZXQoKTtcblx0XHRpZiAodGhpcy5fc2Vzc2lvbikge1xuXHRcdFx0dGhpcy5fc2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24odGhpcy5fc2Vzc2lvbik7XG5cdFx0fVxuXHR9XG5cblx0dW5zdGFzaCgpOiBTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX3Nlc3Npb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMuX2xpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9zZXNzaW9uO1xuXHRcdHJlc3VsdC5tYXJrVW5zdGFzaGVkKCk7XG5cdFx0cmVzdWx0Lmh1bmtEYXRhLmlnbm9yZVRleHRNb2RlbE5DaGFuZ2VzID0gdHJ1ZTtcblx0XHRyZXN1bHQudGV4dE1vZGVsTi5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgdGhpcy5fdW5kb0NhbmNlbEVkaXRzLCAoKSA9PiBudWxsKTtcblx0XHRyZXN1bHQuaHVua0RhdGEuaWdub3JlVGV4dE1vZGVsTkNoYW5nZXMgPSBmYWxzZTtcblx0XHR0aGlzLl9zZXNzaW9uID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ1tJRV0gVW5zdGFzaGVkIHNlc3Npb24nKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbi8vIC0tLVxuXG5mdW5jdGlvbiBsaW5lUmFuZ2VBc1JhbmdlKGxpbmVSYW5nZTogTGluZVJhbmdlLCBtb2RlbDogSVRleHRNb2RlbCk6IFJhbmdlIHtcblx0cmV0dXJuIGxpbmVSYW5nZS5pc0VtcHR5XG5cdFx0PyBuZXcgUmFuZ2UobGluZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSwgbGluZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG5cdFx0OiBuZXcgUmFuZ2UobGluZVJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSwgbGluZVJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUik7XG59XG5cbmV4cG9ydCBjbGFzcyBIdW5rRGF0YSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0hVTktfVFJBQ0tFRF9SQU5HRSA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAnaW5saW5lLWNoYXQtaHVuay10cmFja2VkLXJhbmdlJyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0fSk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0hVTktfVEhSRVNIT0xEID0gODtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGF0YSA9IG5ldyBNYXA8UmF3SHVuaywgUmF3SHVua0RhdGE+KCk7XG5cdHByaXZhdGUgX2lnbm9yZUNoYW5nZXM6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsMDogSVRleHRNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxOOiBJVGV4dE1vZGVsLFxuXHQpIHtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGV4dE1vZGVsTi5vbkRpZENoYW5nZUNvbnRlbnQoZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lnbm9yZUNoYW5nZXMpIHtcblx0XHRcdFx0dGhpcy5fbWlycm9yQ2hhbmdlcyhlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGV4dE1vZGVsTi5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHRoaXMuX3RleHRNb2RlbE4uY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgdGV4dE1vZGVsTkRlY29yYXRpb25zIH0gb2YgdGhpcy5fZGF0YS52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdHRleHRNb2RlbE5EZWNvcmF0aW9ucy5mb3JFYWNoKGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24sIGFjY2Vzc29yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdGV4dE1vZGVsMC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHRoaXMuX3RleHRNb2RlbDAuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgdGV4dE1vZGVsMERlY29yYXRpb25zIH0gb2YgdGhpcy5fZGF0YS52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdHRleHRNb2RlbDBEZWNvcmF0aW9ucy5mb3JFYWNoKGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24sIGFjY2Vzc29yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHRoaXMuX2RhdGEuY2xlYXIoKTtcblx0XHR0aGlzLl9zdG9yZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRzZXQgaWdub3JlVGV4dE1vZGVsTkNoYW5nZXModmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9pZ25vcmVDaGFuZ2VzID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgaWdub3JlVGV4dE1vZGVsTkNoYW5nZXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lnbm9yZUNoYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIF9taXJyb3JDaGFuZ2VzKGV2ZW50OiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KSB7XG5cblx0XHQvLyBtaXJyb3IgdGV4dE1vZGVsTiBjaGFuZ2VzIHRvIHRleHRNb2RlbDAgZXhlY2VwdCBmb3IgdGhvc2UgdGhhdFxuXHRcdC8vIG92ZXJsYXAgd2l0aCBhIGh1bmtcblxuXHRcdHR5cGUgSHVua1JhbmdlUGFpciA9IHsgcmFuZ2VOOiBSYW5nZTsgcmFuZ2UwOiBSYW5nZTsgbWFya0FjY2VwdGVkOiAoKSA9PiB2b2lkIH07XG5cdFx0Y29uc3QgaHVua1JhbmdlczogSHVua1JhbmdlUGFpcltdID0gW107XG5cblx0XHRjb25zdCByYW5nZXMwOiBSYW5nZVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMuX2RhdGEudmFsdWVzKCkpIHtcblxuXHRcdFx0aWYgKGVudHJ5LnN0YXRlID09PSBIdW5rU3RhdGUuUGVuZGluZykge1xuXHRcdFx0XHQvLyBwZW5kaW5nIG1lYW5zIHRoZSBodW5rJ3MgY2hhbmdlcyBhcmVuJ3QgXCJzeW5jJ2RcIiB5ZXRcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBlbnRyeS50ZXh0TW9kZWxORGVjb3JhdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCByYW5nZU4gPSB0aGlzLl90ZXh0TW9kZWxOLmdldERlY29yYXRpb25SYW5nZShlbnRyeS50ZXh0TW9kZWxORGVjb3JhdGlvbnNbaV0pO1xuXHRcdFx0XHRcdGNvbnN0IHJhbmdlMCA9IHRoaXMuX3RleHRNb2RlbDAuZ2V0RGVjb3JhdGlvblJhbmdlKGVudHJ5LnRleHRNb2RlbDBEZWNvcmF0aW9uc1tpXSk7XG5cdFx0XHRcdFx0aWYgKHJhbmdlTiAmJiByYW5nZTApIHtcblx0XHRcdFx0XHRcdGh1bmtSYW5nZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdHJhbmdlTiwgcmFuZ2UwLFxuXHRcdFx0XHRcdFx0XHRtYXJrQWNjZXB0ZWQ6ICgpID0+IGVudHJ5LnN0YXRlID0gSHVua1N0YXRlLkFjY2VwdGVkXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIGlmIChlbnRyeS5zdGF0ZSA9PT0gSHVua1N0YXRlLkFjY2VwdGVkKSB7XG5cdFx0XHRcdC8vIGFjY2VwdGVkIG1lYW5zIHRoZSBodW5rJ3MgY2hhbmdlcyBhcmUgYWxzbyBpbiB0ZXh0TW9kZWwwXG5cdFx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgZW50cnkudGV4dE1vZGVsMERlY29yYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl90ZXh0TW9kZWwwLmdldERlY29yYXRpb25SYW5nZShlbnRyeS50ZXh0TW9kZWwwRGVjb3JhdGlvbnNbaV0pO1xuXHRcdFx0XHRcdGlmIChyYW5nZSkge1xuXHRcdFx0XHRcdFx0cmFuZ2VzMC5wdXNoKHJhbmdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRodW5rUmFuZ2VzLnNvcnQoKGEsIGIpID0+IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLnJhbmdlTiwgYi5yYW5nZU4pKTtcblx0XHRyYW5nZXMwLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdGNvbnN0IGVkaXRzOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgZXZlbnQuY2hhbmdlcykge1xuXG5cdFx0XHRsZXQgaXNPdmVybGFwcGluZyA9IGZhbHNlO1xuXG5cdFx0XHRsZXQgcGVuZGluZ0NoYW5nZXNMZW4gPSAwO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIGh1bmtSYW5nZXMpIHtcblx0XHRcdFx0aWYgKGVudHJ5LnJhbmdlTi5nZXRFbmRQb3NpdGlvbigpLmlzQmVmb3JlKFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oY2hhbmdlLnJhbmdlKSkpIHtcblx0XHRcdFx0XHQvLyBwZW5kaW5nIGh1bmsgX2JlZm9yZV8gdGhpcyBjaGFuZ2UuIFdoZW4gcHJvamVjdGluZyBpbnRvIHRleHRNb2RlbDAgd2UgbmVlZCB0b1xuXHRcdFx0XHRcdC8vIHN1YnRyYWN0IHRoYXQuIEJlY2F1c2UgZGlmZmluZyBpcyByZWxheGVkIGl0IG1pZ2h0IGluY2x1ZGUgY2hhbmdlcyB0aGF0IGFyZSBub3Rcblx0XHRcdFx0XHQvLyBhY3R1YWwgaW5zZXJ0aW9ucy9kZWxldGlvbnMuIFRoZXJlZm9yZSB3ZSBuZWVkIHRvIHRha2UgdGhlIGxlbmd0aCBvZiB0aGUgb3JpZ2luYWxcblx0XHRcdFx0XHQvLyByYW5nZSBpbnRvIGFjY291bnQuXG5cdFx0XHRcdFx0cGVuZGluZ0NoYW5nZXNMZW4gKz0gdGhpcy5fdGV4dE1vZGVsTi5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UoZW50cnkucmFuZ2VOKTtcblx0XHRcdFx0XHRwZW5kaW5nQ2hhbmdlc0xlbiAtPSB0aGlzLl90ZXh0TW9kZWwwLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShlbnRyeS5yYW5nZTApO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoUmFuZ2UuYXJlSW50ZXJzZWN0aW5nT3JUb3VjaGluZyhlbnRyeS5yYW5nZU4sIGNoYW5nZS5yYW5nZSkpIHtcblx0XHRcdFx0XHQvLyBhbiBlZGl0IG92ZXJsYXBzIHdpdGggYSAocGVuZGluZykgaHVuay4gV2UgdGFrZSB0aGlzIGFzIGEgc2lnbmFsXG5cdFx0XHRcdFx0Ly8gdG8gbWFyayB0aGUgaHVuayBhcyBhY2NlcHRlZCBhbmQgdG8gaWdub3JlIHRoZSBlZGl0LiBUaGUgcmFuZ2Ugb2YgdGhlIGh1bmtcblx0XHRcdFx0XHQvLyB3aWxsIGJlIHVwLXRvLWRhdGUgYmVjYXVzZSBvZiBkZWNvcmF0aW9ucyBjcmVhdGVkIGZvciB0aGVtXG5cdFx0XHRcdFx0ZW50cnkubWFya0FjY2VwdGVkKCk7XG5cdFx0XHRcdFx0aXNPdmVybGFwcGluZyA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBodW5rcyBwYXN0IHRoaXMgY2hhbmdlIGFyZW4ndCByZWxldmFudFxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc092ZXJsYXBwaW5nKSB7XG5cdFx0XHRcdC8vIGh1bmsgb3ZlcmxhcHMsIGl0IGdyZXdcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9mZnNldDAgPSBjaGFuZ2UucmFuZ2VPZmZzZXQgLSBwZW5kaW5nQ2hhbmdlc0xlbjtcblx0XHRcdGNvbnN0IHN0YXJ0MCA9IHRoaXMuX3RleHRNb2RlbDAuZ2V0UG9zaXRpb25BdChvZmZzZXQwKTtcblxuXHRcdFx0bGV0IGFjY2VwdGVkQ2hhbmdlc0xlbiA9IDA7XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHJhbmdlczApIHtcblx0XHRcdFx0aWYgKHJhbmdlLmdldEVuZFBvc2l0aW9uKCkuaXNCZWZvcmUoc3RhcnQwKSkge1xuXHRcdFx0XHRcdC8vIGFjY2VwdGVkIGh1bmsgX2JlZm9yZV8gdGhpcyBwcm9qZWN0ZWQgY2hhbmdlLiBXaGVuIHByb2plY3RpbmcgaW50byB0ZXh0TW9kZWwwXG5cdFx0XHRcdFx0Ly8gd2UgbmVlZCB0byBhZGQgdGhhdFxuXHRcdFx0XHRcdGFjY2VwdGVkQ2hhbmdlc0xlbiArPSB0aGlzLl90ZXh0TW9kZWwwLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShyYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhcnQgPSB0aGlzLl90ZXh0TW9kZWwwLmdldFBvc2l0aW9uQXQob2Zmc2V0MCArIGFjY2VwdGVkQ2hhbmdlc0xlbik7XG5cdFx0XHRjb25zdCBlbmQgPSB0aGlzLl90ZXh0TW9kZWwwLmdldFBvc2l0aW9uQXQob2Zmc2V0MCArIGFjY2VwdGVkQ2hhbmdlc0xlbiArIGNoYW5nZS5yYW5nZUxlbmd0aCk7XG5cdFx0XHRlZGl0cy5wdXNoKEVkaXRPcGVyYXRpb24ucmVwbGFjZShSYW5nZS5mcm9tUG9zaXRpb25zKHN0YXJ0LCBlbmQpLCBjaGFuZ2UudGV4dCkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3RleHRNb2RlbDAucHVzaEVkaXRPcGVyYXRpb25zKG51bGwsIGVkaXRzLCAoKSA9PiBudWxsKTtcblx0fVxuXG5cdGFzeW5jIHJlY29tcHV0ZShlZGl0U3RhdGU6IElDaGF0VGV4dEVkaXRHcm91cFN0YXRlLCBkaWZmPzogSURvY3VtZW50RGlmZiB8IG51bGwpIHtcblxuXHRcdGRpZmYgPz89IGF3YWl0IHRoaXMuX2VkaXRvcldvcmtlclNlcnZpY2UuY29tcHV0ZURpZmYodGhpcy5fdGV4dE1vZGVsMC51cmksIHRoaXMuX3RleHRNb2RlbE4udXJpLCB7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlOiBmYWxzZSwgbWF4Q29tcHV0YXRpb25UaW1lTXM6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCBjb21wdXRlTW92ZXM6IGZhbHNlIH0sICdhZHZhbmNlZCcpO1xuXG5cdFx0bGV0IG1lcmdlZENoYW5nZXM6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdID0gW107XG5cblx0XHRpZiAoZGlmZiAmJiBkaWZmLmNoYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gbWVyZ2UgY2hhbmdlcyBuZWlnaGJvcmluZyBjaGFuZ2VzXG5cdFx0XHRtZXJnZWRDaGFuZ2VzID0gW2RpZmYuY2hhbmdlc1swXV07XG5cdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGRpZmYuY2hhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsYXN0Q2hhbmdlID0gbWVyZ2VkQ2hhbmdlc1ttZXJnZWRDaGFuZ2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRjb25zdCB0aGlzQ2hhbmdlID0gZGlmZi5jaGFuZ2VzW2ldO1xuXHRcdFx0XHRpZiAodGhpc0NoYW5nZS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgLSBsYXN0Q2hhbmdlLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPD0gSHVua0RhdGEuX0hVTktfVEhSRVNIT0xEKSB7XG5cdFx0XHRcdFx0bWVyZ2VkQ2hhbmdlc1ttZXJnZWRDaGFuZ2VzLmxlbmd0aCAtIDFdID0gbmV3IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRcdGxhc3RDaGFuZ2Uub3JpZ2luYWwuam9pbih0aGlzQ2hhbmdlLm9yaWdpbmFsKSxcblx0XHRcdFx0XHRcdGxhc3RDaGFuZ2UubW9kaWZpZWQuam9pbih0aGlzQ2hhbmdlLm1vZGlmaWVkKSxcblx0XHRcdFx0XHRcdChsYXN0Q2hhbmdlLmlubmVyQ2hhbmdlcyA/PyBbXSkuY29uY2F0KHRoaXNDaGFuZ2UuaW5uZXJDaGFuZ2VzID8/IFtdKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVyZ2VkQ2hhbmdlcy5wdXNoKHRoaXNDaGFuZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaHVua3MgPSBtZXJnZWRDaGFuZ2VzLm1hcChjaGFuZ2UgPT4gbmV3IFJhd0h1bmsoY2hhbmdlLm9yaWdpbmFsLCBjaGFuZ2UubW9kaWZpZWQsIGNoYW5nZS5pbm5lckNoYW5nZXMgPz8gW10pKTtcblxuXHRcdGVkaXRTdGF0ZS5hcHBsaWVkID0gaHVua3MubGVuZ3RoO1xuXG5cdFx0dGhpcy5fdGV4dE1vZGVsTi5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3Nvck4gPT4ge1xuXG5cdFx0XHR0aGlzLl90ZXh0TW9kZWwwLmNoYW5nZURlY29yYXRpb25zKGFjY2Vzc29yMCA9PiB7XG5cblx0XHRcdFx0Ly8gY2xlYW4gdXAgb2xkIGRlY29yYXRpb25zXG5cdFx0XHRcdGZvciAoY29uc3QgeyB0ZXh0TW9kZWxORGVjb3JhdGlvbnMsIHRleHRNb2RlbDBEZWNvcmF0aW9ucyB9IG9mIHRoaXMuX2RhdGEudmFsdWVzKCkpIHtcblx0XHRcdFx0XHR0ZXh0TW9kZWxORGVjb3JhdGlvbnMuZm9yRWFjaChhY2Nlc3Nvck4ucmVtb3ZlRGVjb3JhdGlvbiwgYWNjZXNzb3JOKTtcblx0XHRcdFx0XHR0ZXh0TW9kZWwwRGVjb3JhdGlvbnMuZm9yRWFjaChhY2Nlc3NvcjAucmVtb3ZlRGVjb3JhdGlvbiwgYWNjZXNzb3IwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2RhdGEuY2xlYXIoKTtcblxuXHRcdFx0XHQvLyBhZGQgbmV3IGRlY29yYXRpb25zXG5cdFx0XHRcdGZvciAoY29uc3QgaHVuayBvZiBodW5rcykge1xuXG5cdFx0XHRcdFx0Y29uc3QgdGV4dE1vZGVsTkRlY29yYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRcdGNvbnN0IHRleHRNb2RlbDBEZWNvcmF0aW9uczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0XHRcdHRleHRNb2RlbE5EZWNvcmF0aW9ucy5wdXNoKGFjY2Vzc29yTi5hZGREZWNvcmF0aW9uKGxpbmVSYW5nZUFzUmFuZ2UoaHVuay5tb2RpZmllZCwgdGhpcy5fdGV4dE1vZGVsTiksIEh1bmtEYXRhLl9IVU5LX1RSQUNLRURfUkFOR0UpKTtcblx0XHRcdFx0XHR0ZXh0TW9kZWwwRGVjb3JhdGlvbnMucHVzaChhY2Nlc3NvcjAuYWRkRGVjb3JhdGlvbihsaW5lUmFuZ2VBc1JhbmdlKGh1bmsub3JpZ2luYWwsIHRoaXMuX3RleHRNb2RlbDApLCBIdW5rRGF0YS5fSFVOS19UUkFDS0VEX1JBTkdFKSk7XG5cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBodW5rLmNoYW5nZXMpIHtcblx0XHRcdFx0XHRcdHRleHRNb2RlbE5EZWNvcmF0aW9ucy5wdXNoKGFjY2Vzc29yTi5hZGREZWNvcmF0aW9uKGNoYW5nZS5tb2RpZmllZFJhbmdlLCBIdW5rRGF0YS5fSFVOS19UUkFDS0VEX1JBTkdFKSk7XG5cdFx0XHRcdFx0XHR0ZXh0TW9kZWwwRGVjb3JhdGlvbnMucHVzaChhY2Nlc3NvcjAuYWRkRGVjb3JhdGlvbihjaGFuZ2Uub3JpZ2luYWxSYW5nZSwgSHVua0RhdGEuX0hVTktfVFJBQ0tFRF9SQU5HRSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuX2RhdGEuc2V0KGh1bmssIHtcblx0XHRcdFx0XHRcdGVkaXRTdGF0ZSxcblx0XHRcdFx0XHRcdHRleHRNb2RlbE5EZWNvcmF0aW9ucyxcblx0XHRcdFx0XHRcdHRleHRNb2RlbDBEZWNvcmF0aW9ucyxcblx0XHRcdFx0XHRcdHN0YXRlOiBIdW5rU3RhdGUuUGVuZGluZ1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2RhdGEuc2l6ZTtcblx0fVxuXG5cdGdldCBwZW5kaW5nKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIEl0ZXJhYmxlLnJlZHVjZSh0aGlzLl9kYXRhLnZhbHVlcygpLCAociwgeyBzdGF0ZSB9KSA9PiByICsgKHN0YXRlID09PSBIdW5rU3RhdGUuUGVuZGluZyA/IDEgOiAwKSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIF9kaXNjYXJkRWRpdHMoaXRlbTogSHVua0luZm9ybWF0aW9uKTogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSB7XG5cdFx0Y29uc3QgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCByYW5nZXNOID0gaXRlbS5nZXRSYW5nZXNOKCk7XG5cdFx0Y29uc3QgcmFuZ2VzMCA9IGl0ZW0uZ2V0UmFuZ2VzMCgpO1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgcmFuZ2VzTi5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRSYW5nZSA9IHJhbmdlc05baV07XG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsVmFsdWUgPSB0aGlzLl90ZXh0TW9kZWwwLmdldFZhbHVlSW5SYW5nZShyYW5nZXMwW2ldKTtcblx0XHRcdGVkaXRzLnB1c2goRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG1vZGlmaWVkUmFuZ2UsIG9yaWdpbmFsVmFsdWUpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGVkaXRzO1xuXHR9XG5cblx0ZGlzY2FyZEFsbCgpIHtcblx0XHRjb25zdCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMuZ2V0SW5mbygpKSB7XG5cdFx0XHRpZiAoaXRlbS5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuUGVuZGluZykge1xuXHRcdFx0XHRlZGl0cy5wdXNoKHRoaXMuX2Rpc2NhcmRFZGl0cyhpdGVtKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHVuZG9FZGl0czogSVZhbGlkRWRpdE9wZXJhdGlvbltdW10gPSBbXTtcblx0XHR0aGlzLl90ZXh0TW9kZWxOLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBlZGl0cy5mbGF0KCksIChfdW5kb0VkaXRzKSA9PiB7XG5cdFx0XHR1bmRvRWRpdHMucHVzaChfdW5kb0VkaXRzKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0pO1xuXHRcdHJldHVybiB1bmRvRWRpdHMuZmxhdCgpO1xuXHR9XG5cblx0Z2V0SW5mbygpOiBIdW5rSW5mb3JtYXRpb25bXSB7XG5cblx0XHRjb25zdCByZXN1bHQ6IEh1bmtJbmZvcm1hdGlvbltdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IFtodW5rLCBkYXRhXSBvZiB0aGlzLl9kYXRhLmVudHJpZXMoKSkge1xuXHRcdFx0Y29uc3QgaXRlbTogSHVua0luZm9ybWF0aW9uID0ge1xuXHRcdFx0XHRnZXRTdGF0ZTogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBkYXRhLnN0YXRlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc0luc2VydGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBodW5rLm9yaWdpbmFsLmlzRW1wdHk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFJhbmdlc046ICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCByYW5nZXMgPSBkYXRhLnRleHRNb2RlbE5EZWNvcmF0aW9ucy5tYXAoaWQgPT4gdGhpcy5fdGV4dE1vZGVsTi5nZXREZWNvcmF0aW9uUmFuZ2UoaWQpKTtcblx0XHRcdFx0XHRjb2FsZXNjZUluUGxhY2UocmFuZ2VzKTtcblx0XHRcdFx0XHRyZXR1cm4gcmFuZ2VzO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRSYW5nZXMwOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2VzID0gZGF0YS50ZXh0TW9kZWwwRGVjb3JhdGlvbnMubWFwKGlkID0+IHRoaXMuX3RleHRNb2RlbDAuZ2V0RGVjb3JhdGlvblJhbmdlKGlkKSk7XG5cdFx0XHRcdFx0Y29hbGVzY2VJblBsYWNlKHJhbmdlcyk7XG5cdFx0XHRcdFx0cmV0dXJuIHJhbmdlcztcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGlzY2FyZENoYW5nZXM6ICgpID0+IHtcblx0XHRcdFx0XHQvLyBESVNDQVJEOiByZXBsYWNlIG1vZGlmaWVkIHJhbmdlIHdpdGggb3JpZ2luYWwgdmFsdWUuIFRoZSBtb2RpZmllZCByYW5nZSBpcyByZXRyaWV2ZWQgZnJvbSBhIGRlY29yYXRpb25cblx0XHRcdFx0XHQvLyB3aGljaCB3YXMgY3JlYXRlZCBhYm92ZSBzbyB0aGF0IHR5cGluZyBpbiB0aGUgZWRpdG9yIGtlZXBzIGRpc2NhcmQgd29ya2luZy5cblx0XHRcdFx0XHRpZiAoZGF0YS5zdGF0ZSA9PT0gSHVua1N0YXRlLlBlbmRpbmcpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRzID0gdGhpcy5fZGlzY2FyZEVkaXRzKGl0ZW0pO1xuXHRcdFx0XHRcdFx0dGhpcy5fdGV4dE1vZGVsTi5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsICgpID0+IG51bGwpO1xuXHRcdFx0XHRcdFx0ZGF0YS5zdGF0ZSA9IEh1bmtTdGF0ZS5SZWplY3RlZDtcblx0XHRcdFx0XHRcdGlmIChkYXRhLmVkaXRTdGF0ZS5hcHBsaWVkID4gMCkge1xuXHRcdFx0XHRcdFx0XHRkYXRhLmVkaXRTdGF0ZS5hcHBsaWVkIC09IDE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhY2NlcHRDaGFuZ2VzOiAoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gQUNDRVBUOiByZXBsYWNlIG9yaWdpbmFsIHJhbmdlIHdpdGggbW9kaWZpZWQgdmFsdWUuIFRoZSBtb2RpZmllZCB2YWx1ZSBpcyByZXRyaWV2ZWQgZnJvbSB0aGUgbW9kZWwgdmlhXG5cdFx0XHRcdFx0Ly8gaXRzIGRlY29yYXRpb24gYW5kIHRoZSBvcmlnaW5hbCByYW5nZSBpcyByZXRyaWV2ZWQgZnJvbSB0aGUgaHVuay5cblx0XHRcdFx0XHRpZiAoZGF0YS5zdGF0ZSA9PT0gSHVua1N0YXRlLlBlbmRpbmcpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0XHRcdFx0XHRjb25zdCByYW5nZXNOID0gaXRlbS5nZXRSYW5nZXNOKCk7XG5cdFx0XHRcdFx0XHRjb25zdCByYW5nZXMwID0gaXRlbS5nZXRSYW5nZXMwKCk7XG5cdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IHJhbmdlczAubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxSYW5nZSA9IHJhbmdlczBbaV07XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG1vZGlmaWVkVmFsdWUgPSB0aGlzLl90ZXh0TW9kZWxOLmdldFZhbHVlSW5SYW5nZShyYW5nZXNOW2ldKTtcblx0XHRcdFx0XHRcdFx0ZWRpdHMucHVzaChFZGl0T3BlcmF0aW9uLnJlcGxhY2Uob3JpZ2luYWxSYW5nZSwgbW9kaWZpZWRWYWx1ZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5fdGV4dE1vZGVsMC5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsICgpID0+IG51bGwpO1xuXHRcdFx0XHRcdFx0ZGF0YS5zdGF0ZSA9IEh1bmtTdGF0ZS5BY2NlcHRlZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRyZXN1bHQucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNsYXNzIFJhd0h1bmsge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBvcmlnaW5hbDogTGluZVJhbmdlLFxuXHRcdHJlYWRvbmx5IG1vZGlmaWVkOiBMaW5lUmFuZ2UsXG5cdFx0cmVhZG9ubHkgY2hhbmdlczogUmFuZ2VNYXBwaW5nW11cblx0KSB7IH1cbn1cblxudHlwZSBSYXdIdW5rRGF0YSA9IHtcblx0dGV4dE1vZGVsTkRlY29yYXRpb25zOiBzdHJpbmdbXTtcblx0dGV4dE1vZGVsMERlY29yYXRpb25zOiBzdHJpbmdbXTtcblx0c3RhdGU6IEh1bmtTdGF0ZTtcblx0ZWRpdFN0YXRlOiBJQ2hhdFRleHRFZGl0R3JvdXBTdGF0ZTtcbn07XG5cbmV4cG9ydCBjb25zdCBlbnVtIEh1bmtTdGF0ZSB7XG5cdFBlbmRpbmcgPSAwLFxuXHRBY2NlcHRlZCA9IDEsXG5cdFJlamVjdGVkID0gMlxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEh1bmtJbmZvcm1hdGlvbiB7XG5cdC8qKlxuXHQgKiBUaGUgZmlyc3QgZWxlbWVudCBbMF0gaXMgdGhlIHdob2xlIG1vZGlmaWVkIHJhbmdlIGFuZCBzdWJzZXF1ZW50IGVsZW1lbnRzIGFyZSB3b3JkLWxldmVsIGNoYW5nZXNcblx0ICovXG5cdGdldFJhbmdlc04oKTogUmFuZ2VbXTtcblxuXHRnZXRSYW5nZXMwKCk6IFJhbmdlW107XG5cblx0aXNJbnNlcnRpb24oKTogYm9vbGVhbjtcblxuXHRkaXNjYXJkQ2hhbmdlcygpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBBY2NlcHQgdGhlIGh1bmsuIEFwcGxpZXMgdGhlIGNvcnJlc3BvbmRpbmcgZWRpdHMgaW50byB0ZXh0TW9kZWwwXG5cdCAqL1xuXHRhY2NlcHRDaGFuZ2VzKCk6IHZvaWQ7XG5cblx0Z2V0U3RhdGUoKTogSHVua1N0YXRlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUEwSCw4QkFBOEI7QUFDeEosU0FBUywyQ0FBMkM7QUFDcEQsU0FBaUIsYUFBYTtBQUM5QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHFCQUEyQztBQUNwRCxTQUFTLGdDQUFnRTtBQUN6RSxTQUFTLGlDQUFpQztBQUUxQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHVCQUFvQztBQUU3QyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUywyQkFBMkI7QUFvQzdCLE1BQU0scUJBQU4sTUFBTSxtQkFBa0I7QUFBQSxFQVM5QixZQUE2QixZQUF3QixZQUFvQjtBQUE1QztBQUw3QixTQUFpQixlQUFlLElBQUksUUFBYztBQUNsRCxTQUFTLGNBQTJCLEtBQUssYUFBYTtBQUV0RCxTQUFRLGlCQUEyQixDQUFDO0FBR25DLFNBQUssaUJBQWlCLFdBQVcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxZQUFZLFNBQVMsbUJBQWtCLFNBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDbkg7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLGFBQWEsUUFBUTtBQUMxQixRQUFJLENBQUMsS0FBSyxXQUFXLFdBQVcsR0FBRztBQUNsQyxXQUFLLFdBQVcsaUJBQWlCLEtBQUssZ0JBQWdCLENBQUMsQ0FBQztBQUFBLElBQ3pEO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxTQUFvRDtBQUN6RCxVQUFNLFVBQW1DLENBQUM7QUFDMUMsZUFBVyxFQUFFLFNBQVMsS0FBSyxTQUFTO0FBQ25DLFlBQU0sZ0JBQWdCLEtBQUssV0FBVyxjQUFjLFNBQVMsVUFDMUQsSUFBSSxNQUFNLFNBQVMsaUJBQWlCLEdB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
