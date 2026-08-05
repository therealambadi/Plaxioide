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
import { WindowIntervalTimer } from "../../../../base/browser/dom.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { themeColorFromId, ThemeIcon } from "../../../../base/common/themables.js";
import { StableEditorScrollState } from "../../../../editor/browser/stableEditorScroll.js";
import { LineSource, RenderOptions, renderLines } from "../../../../editor/browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { LineRange } from "../../../../editor/common/core/lineRange.js";
import { Range } from "../../../../editor/common/core/range.js";
import { MinimapPosition, OverviewRulerLane, TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { InlineDecoration, InlineDecorationType } from "../../../../editor/common/viewModel.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { SaveReason } from "../../../common/editor.js";
import { countWords } from "../../chat/common/chatWordCounter.js";
import { HunkState } from "./inlineChatSession.js";
import { ACTION_TOGGLE_DIFF, CTX_INLINE_CHAT_CHANGE_HAS_DIFF, CTX_INLINE_CHAT_CHANGE_SHOWS_DIFF, InlineChatConfigKeys, MENU_INLINE_CHAT_ZONE, minimapInlineChatDiffInserted, overviewRulerInlineChatDiffInserted } from "../common/inlineChat.js";
import { assertType } from "../../../../base/common/types.js";
import { performAsyncTextEdit, asProgressiveEdit } from "./utils.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { Schemas } from "../../../../base/common/network.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { DefaultChatTextEditor } from "../../chat/browser/codeBlockPart.js";
import { isEqual } from "../../../../base/common/resources.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { ConflictActionsFactory } from "../../mergeEditor/browser/view/conflictActions.js";
import { observableValue } from "../../../../base/common/observable.js";
import { IMenuService, MenuItemAction } from "../../../../platform/actions/common/actions.js";
var HunkAction = /* @__PURE__ */ ((HunkAction2) => {
  HunkAction2[HunkAction2["Accept"] = 0] = "Accept";
  HunkAction2[HunkAction2["Discard"] = 1] = "Discard";
  HunkAction2[HunkAction2["MoveNext"] = 2] = "MoveNext";
  HunkAction2[HunkAction2["MovePrev"] = 3] = "MovePrev";
  HunkAction2[HunkAction2["ToggleDiff"] = 4] = "ToggleDiff";
  return HunkAction2;
})(HunkAction || {});
let LiveStrategy = class {
  constructor(_session, _editor, _zone, _showOverlayToolbar, contextKeyService, _editorWorkerService, _accessibilityService, _configService, _menuService, _contextService, _textFileService, _instaService) {
    this._session = _session;
    this._editor = _editor;
    this._zone = _zone;
    this._showOverlayToolbar = _showOverlayToolbar;
    this._editorWorkerService = _editorWorkerService;
    this._accessibilityService = _accessibilityService;
    this._configService = _configService;
    this._menuService = _menuService;
    this._contextService = _contextService;
    this._textFileService = _textFileService;
    this._instaService = _instaService;
    this._decoInsertedText = ModelDecorationOptions.register({
      description: "inline-modified-line",
      className: "inline-chat-inserted-range-linehighlight",
      isWholeLine: true,
      overviewRuler: {
        position: OverviewRulerLane.Full,
        color: themeColorFromId(overviewRulerInlineChatDiffInserted)
      },
      minimap: {
        position: MinimapPosition.Inline,
        color: themeColorFromId(minimapInlineChatDiffInserted)
      }
    });
    this._decoInsertedTextRange = ModelDecorationOptions.register({
      description: "inline-chat-inserted-range-linehighlight",
      className: "inline-chat-inserted-range",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    this._store = new DisposableStore();
    this._onDidAccept = this._store.add(new Emitter());
    this._onDidDiscard = this._store.add(new Emitter());
    this._editCount = 0;
    this._hunkData = /* @__PURE__ */ new Map();
    this.onDidAccept = this._onDidAccept.event;
    this.onDidDiscard = this._onDidDiscard.event;
    this._ctxCurrentChangeHasDiff = CTX_INLINE_CHAT_CHANGE_HAS_DIFF.bindTo(contextKeyService);
    this._ctxCurrentChangeShowsDiff = CTX_INLINE_CHAT_CHANGE_SHOWS_DIFF.bindTo(contextKeyService);
    this._progressiveEditingDecorations = this._editor.createDecorationsCollection();
    this._lensActionsFactory = this._store.add(new ConflictActionsFactory(this._editor));
  }
  dispose() {
    this._resetDiff();
    this._store.dispose();
  }
  _resetDiff() {
    this._ctxCurrentChangeHasDiff.reset();
    this._ctxCurrentChangeShowsDiff.reset();
    this._zone.widget.updateStatus("");
    this._progressiveEditingDecorations.clear();
    for (const data of this._hunkData.values()) {
      data.remove();
    }
  }
  async apply() {
    this._resetDiff();
    if (this._editCount > 0) {
      this._editor.pushUndoStop();
    }
    await this._doApplyChanges(true);
  }
  cancel() {
    this._resetDiff();
    return this._session.hunkData.discardAll();
  }
  async makeChanges(edits, obs, undoStopBefore) {
    return this._makeChanges(edits, obs, void 0, void 0, undoStopBefore);
  }
  async makeProgressiveChanges(edits, obs, opts, undoStopBefore) {
    const progress = new Progress((edits2) => {
      const newLines = /* @__PURE__ */ new Set();
      for (const edit of edits2) {
        LineRange.fromRange(edit.range).forEach((line) => newLines.add(line));
      }
      const existingRanges = this._progressiveEditingDecorations.getRanges().map(LineRange.fromRange);
      for (const existingRange of existingRanges) {
        existingRange.forEach((line) => newLines.delete(line));
      }
      const newDecorations = [];
      for (const line of newLines) {
        newDecorations.push({ range: new Range(line, 1, line, Number.MAX_VALUE), options: this._decoInsertedText });
      }
      this._progressiveEditingDecorations.append(newDecorations);
    });
    return this._makeChanges(edits, obs, opts, progress, undoStopBefore);
  }
  async _makeChanges(edits, obs, opts, progress, undoStopBefore) {
    if (undoStopBefore) {
      this._editor.pushUndoStop();
    }
    this._editCount++;
    if (opts) {
      const durationInSec = opts.duration / 1e3;
      for (const edit of edits) {
        const wordCount = countWords(edit.text ?? "");
        const speed = wordCount / durationInSec;
        const asyncEdit = asProgressiveEdit(new WindowIntervalTimer(this._zone.domNode), edit, speed, opts.token);
        await performAsyncTextEdit(this._session.textModelN, asyncEdit, progress, obs);
      }
    } else {
      obs.start();
      this._session.textModelN.pushEditOperations(null, edits, (undoEdits) => {
        progress?.report(undoEdits);
        return null;
      });
      obs.stop();
    }
  }
  performHunkAction(hunk, action) {
    const displayData = this._findDisplayData(hunk);
    if (!displayData) {
      if (action === 0 /* Accept */) {
        this._onDidAccept.fire();
      } else if (action === 1 /* Discard */) {
        this._onDidDiscard.fire();
      }
      return;
    }
    if (action === 0 /* Accept */) {
      displayData.acceptHunk();
    } else if (action === 1 /* Discard */) {
      displayData.discardHunk();
    } else if (action === 2 /* MoveNext */) {
      displayData.move(true);
    } else if (action === 3 /* MovePrev */) {
      displayData.move(false);
    } else if (action === 4 /* ToggleDiff */) {
      displayData.toggleDiff?.();
    }
  }
  _findDisplayData(hunkInfo) {
    let result;
    if (hunkInfo) {
      result = this._hunkData.get(hunkInfo);
    }
    if (!result && this._zone.position) {
      const zoneLine = this._zone.position.lineNumber;
      let distance = Number.MAX_SAFE_INTEGER;
      for (const candidate of this._hunkData.values()) {
        if (candidate.hunk.getState() !== HunkState.Pending) {
          continue;
        }
        const hunkRanges = candidate.hunk.getRangesN();
        if (hunkRanges.length === 0) {
          continue;
        }
        const myDistance = zoneLine <= hunkRanges[0].startLineNumber ? hunkRanges[0].startLineNumber - zoneLine : zoneLine - hunkRanges[0].endLineNumber;
        if (myDistance < distance) {
          distance = myDistance;
          result = candidate;
        }
      }
    }
    if (!result) {
      result = Iterable.first(Iterable.filter(this._hunkData.values(), (candidate) => candidate.hunk.getState() === HunkState.Pending));
    }
    return result;
  }
  async renderChanges() {
    this._progressiveEditingDecorations.clear();
    const renderHunks = () => {
      let widgetData;
      changeDecorationsAndViewZones(this._editor, (decorationsAccessor, viewZoneAccessor) => {
        const keysNow = new Set(this._hunkData.keys());
        widgetData = void 0;
        for (const hunkData of this._session.hunkData.getInfo()) {
          keysNow.delete(hunkData);
          const hunkRanges = hunkData.getRangesN();
          let data = this._hunkData.get(hunkData);
          if (!data) {
            const decorationIds = [];
            for (let i = 0; i < hunkRanges.length; i++) {
              decorationIds.push(
                decorationsAccessor.addDecoration(hunkRanges[i], i === 0 ? this._decoInsertedText : this._decoInsertedTextRange)
              );
            }
            const acceptHunk = () => {
              hunkData.acceptChanges();
              renderHunks();
            };
            const discardHunk = () => {
              hunkData.discardChanges();
              renderHunks();
            };
            const mightContainNonBasicASCII = this._session.textModel0.mightContainNonBasicASCII();
            const mightContainRTL = this._session.textModel0.mightContainRTL();
            const renderOptions = RenderOptions.fromEditor(this._editor);
            const originalRange = hunkData.getRanges0()[0];
            const source = new LineSource(
              LineRange.fromRangeInclusive(originalRange).mapToLineArray((l) => this._session.textModel0.tokenization.getLineTokens(l)),
              [],
              mightContainNonBasicASCII,
              mightContainRTL
            );
            const domNode = document.createElement("div");
            domNode.className = "inline-chat-original-zone2";
            const result = renderLines(source, renderOptions, [new InlineDecoration(new Range(originalRange.startLineNumber, 1, originalRange.startLineNumber, 1), "", InlineDecorationType.Regular)], domNode);
            const viewZoneData = {
              afterLineNumber: -1,
              heightInLines: result.heightInLines,
              domNode,
              ordinal: 5e4 + 2
              // more than https://github.com/microsoft/vscode/blob/bf52a5cfb2c75a7327c9adeaefbddc06d529dcad/src/vs/workbench/contrib/inlineChat/browser/inlineChatZoneWidget.ts#L42
            };
            const toggleDiff = () => {
              const scrollState = StableEditorScrollState.capture(this._editor);
              changeDecorationsAndViewZones(this._editor, (_decorationsAccessor, viewZoneAccessor2) => {
                assertType(data);
                if (!data.diffViewZoneId) {
                  const [hunkRange] = hunkData.getRangesN();
                  viewZoneData.afterLineNumber = hunkRange.startLineNumber - 1;
                  data.diffViewZoneId = viewZoneAccessor2.addZone(viewZoneData);
                } else {
                  viewZoneAccessor2.removeZone(data.diffViewZoneId);
                  data.diffViewZoneId = void 0;
                }
              });
              this._ctxCurrentChangeShowsDiff.set(typeof data?.diffViewZoneId === "string");
              scrollState.restore(this._editor);
            };
            let lensActions;
            const lensActionsViewZoneIds = [];
            if (this._showOverlayToolbar && hunkData.getState() === HunkState.Pending) {
              lensActions = new DisposableStore();
              const menu = this._menuService.createMenu(MENU_INLINE_CHAT_ZONE, this._contextService);
              const makeActions = () => {
                const actions = [];
                const tuples = menu.getActions({ arg: hunkData });
                for (const [, group] of tuples) {
                  for (const item of group) {
                    if (item instanceof MenuItemAction) {
                      let text = item.label;
                      if (item.id === ACTION_TOGGLE_DIFF) {
                        text = item.checked ? "Hide Changes" : "Show Changes";
                      } else if (ThemeIcon.isThemeIcon(item.item.icon)) {
                        text = `$(${item.item.icon.id}) ${text}`;
                      }
                      actions.push({
                        text,
                        tooltip: item.tooltip,
                        action: async () => item.run()
                      });
                    }
                  }
                }
                return actions;
              };
              const obs = observableValue(this, makeActions());
              lensActions.add(menu.onDidChange(() => obs.set(makeActions(), void 0)));
              lensActions.add(menu);
              lensActions.add(this._lensActionsFactory.createWidget(
                viewZoneAccessor,
                hunkRanges[0].startLineNumber - 1,
                obs,
                lensActionsViewZoneIds
              ));
            }
            const remove = () => {
              changeDecorationsAndViewZones(this._editor, (decorationsAccessor2, viewZoneAccessor2) => {
                assertType(data);
                for (const decorationId of data.decorationIds) {
                  decorationsAccessor2.removeDecoration(decorationId);
                }
                if (data.diffViewZoneId) {
                  viewZoneAccessor2.removeZone(data.diffViewZoneId);
                }
                data.decorationIds = [];
                data.diffViewZoneId = void 0;
                data.lensActionsViewZoneIds?.forEach(viewZoneAccessor2.removeZone);
                data.lensActionsViewZoneIds = void 0;
              });
              lensActions?.dispose();
            };
            const move = (next) => {
              const keys = Array.from(this._hunkData.keys());
              const idx = keys.indexOf(hunkData);
              const nextIdx = (idx + (next ? 1 : -1) + keys.length) % keys.length;
              if (nextIdx !== idx) {
                const nextData = this._hunkData.get(keys[nextIdx]);
                this._zone.updatePositionAndHeight(nextData?.position);
                renderHunks();
              }
            };
            const zoneLineNumber = this._zone.position?.lineNumber ?? this._editor.getPosition().lineNumber;
            const myDistance = zoneLineNumber <= hunkRanges[0].startLineNumber ? hunkRanges[0].startLineNumber - zoneLineNumber : zoneLineNumber - hunkRanges[0].endLineNumber;
            data = {
              hunk: hunkData,
              decorationIds,
              diffViewZoneId: "",
              diffViewZone: viewZoneData,
              lensActionsViewZoneIds,
              distance: myDistance,
              position: hunkRanges[0].getStartPosition().delta(-1),
              acceptHunk,
              discardHunk,
              toggleDiff: !hunkData.isInsertion() ? toggleDiff : void 0,
              remove,
              move
            };
            this._hunkData.set(hunkData, data);
          } else if (hunkData.getState() !== HunkState.Pending) {
            data.remove();
          } else {
            const zoneLineNumber = this._zone.position?.lineNumber ?? this._editor.getPosition().lineNumber;
            const modifiedRangeNow = hunkRanges[0];
            data.position = modifiedRangeNow.getStartPosition().delta(-1);
            data.distance = zoneLineNumber <= modifiedRangeNow.startLineNumber ? modifiedRangeNow.startLineNumber - zoneLineNumber : zoneLineNumber - modifiedRangeNow.endLineNumber;
          }
          if (hunkData.getState() === HunkState.Pending && (!widgetData || data.distance < widgetData.distance)) {
            widgetData = data;
          }
        }
        for (const key of keysNow) {
          const data = this._hunkData.get(key);
          if (data) {
            this._hunkData.delete(key);
            data.remove();
          }
        }
      });
      if (widgetData) {
        this._zone.reveal(widgetData.position);
        const mode = this._configService.getValue(InlineChatConfigKeys.AccessibleDiffView);
        if (mode === "on" || mode === "auto" && this._accessibilityService.isScreenReaderOptimized()) {
          this._zone.widget.showAccessibleHunk(this._session, widgetData.hunk);
        }
        this._ctxCurrentChangeHasDiff.set(Boolean(widgetData.toggleDiff));
      } else if (this._hunkData.size > 0) {
        let oneAccepted = false;
        for (const hunkData of this._session.hunkData.getInfo()) {
          if (hunkData.getState() === HunkState.Accepted) {
            oneAccepted = true;
            break;
          }
        }
        if (oneAccepted) {
          this._onDidAccept.fire();
        } else {
          this._onDidDiscard.fire();
        }
      }
      return widgetData;
    };
    return renderHunks()?.position;
  }
  getWholeRangeDecoration() {
    return [];
  }
  async _doApplyChanges(ignoreLocal) {
    const untitledModels = [];
    const editor = this._instaService.createInstance(DefaultChatTextEditor);
    for (const request of this._session.chatModel.getRequests()) {
      if (!request.response?.response) {
        continue;
      }
      for (const item of request.response.response.value) {
        if (item.kind !== "textEditGroup") {
          continue;
        }
        if (ignoreLocal && isEqual(item.uri, this._session.textModelN.uri)) {
          continue;
        }
        await editor.apply(request.response, item, void 0);
        if (item.uri.scheme === Schemas.untitled) {
          const untitled = this._textFileService.untitled.get(item.uri);
          if (untitled) {
            untitledModels.push(untitled);
          }
        }
      }
    }
    for (const untitledModel of untitledModels) {
      if (!untitledModel.isDisposed()) {
        await untitledModel.resolve();
        await untitledModel.save({ reason: SaveReason.EXPLICIT });
      }
    }
  }
};
LiveStrategy = __decorateClass([
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IEditorWorkerService),
  __decorateParam(6, IAccessibilityService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ITextFileService),
  __decorateParam(11, IInstantiationService)
], LiveStrategy);
function changeDecorationsAndViewZones(editor, callback) {
  editor.changeDecorations((decorationsAccessor) => {
    editor.changeViewZones((viewZoneAccessor) => {
      callback(decorationsAccessor, viewZoneAccessor);
    });
  });
}
export {
  HunkAction,
  LiveStrategy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFN0cmF0ZWdpZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBXaW5kb3dJbnRlcnZhbFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyB0aGVtZUNvbG9yRnJvbUlkLCBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElWaWV3Wm9uZSwgSVZpZXdab25lQ2hhbmdlQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc3RhYmxlRWRpdG9yU2Nyb2xsLmpzJztcbmltcG9ydCB7IExpbmVTb3VyY2UsIFJlbmRlck9wdGlvbnMsIHJlbmRlckxpbmVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvY29tcG9uZW50cy9kaWZmRWRpdG9yVmlld1pvbmVzL3JlbmRlckxpbmVzLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVmFsaWRFZGl0T3BlcmF0aW9uLCBNaW5pbWFwUG9zaXRpb24sIE92ZXJ2aWV3UnVsZXJMYW5lLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJbmxpbmVEZWNvcmF0aW9uLCBJbmxpbmVEZWNvcmF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IFNhdmVSZWFzb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGNvdW50V29yZHMgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0V29yZENvdW50ZXIuanMnO1xuaW1wb3J0IHsgSHVua0luZm9ybWF0aW9uLCBTZXNzaW9uLCBIdW5rU3RhdGUgfSBmcm9tICcuL2lubGluZUNoYXRTZXNzaW9uLmpzJztcbmltcG9ydCB7IElubGluZUNoYXRab25lV2lkZ2V0IH0gZnJvbSAnLi9pbmxpbmVDaGF0Wm9uZVdpZGdldC5qcyc7XG5pbXBvcnQgeyBBQ1RJT05fVE9HR0xFX0RJRkYsIENUWF9JTkxJTkVfQ0hBVF9DSEFOR0VfSEFTX0RJRkYsIENUWF9JTkxJTkVfQ0hBVF9DSEFOR0VfU0hPV1NfRElGRiwgSW5saW5lQ2hhdENvbmZpZ0tleXMsIE1FTlVfSU5MSU5FX0NIQVRfWk9ORSwgbWluaW1hcElubGluZUNoYXREaWZmSW5zZXJ0ZWQsIG92ZXJ2aWV3UnVsZXJJbmxpbmVDaGF0RGlmZkluc2VydGVkIH0gZnJvbSAnLi4vY29tbW9uL2lubGluZUNoYXQuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IHBlcmZvcm1Bc3luY1RleHRFZGl0LCBhc1Byb2dyZXNzaXZlRWRpdCB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElVbnRpdGxlZFRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VudGl0bGVkL2NvbW1vbi91bnRpdGxlZFRleHRFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IERlZmF1bHRDaGF0VGV4dEVkaXRvciB9IGZyb20gJy4uLy4uL2NoYXQvYnJvd3Nlci9jb2RlQmxvY2tQYXJ0LmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBDb25mbGljdEFjdGlvbnNGYWN0b3J5LCBJQ29udGVudFdpZGdldEFjdGlvbiB9IGZyb20gJy4uLy4uL21lcmdlRWRpdG9yL2Jyb3dzZXIvdmlldy9jb25mbGljdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRPYnNlcnZlciB7XG5cdHN0YXJ0KCk6IHZvaWQ7XG5cdHN0b3AoKTogdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gSHVua0FjdGlvbiB7XG5cdEFjY2VwdCxcblx0RGlzY2FyZCxcblx0TW92ZU5leHQsXG5cdE1vdmVQcmV2LFxuXHRUb2dnbGVEaWZmXG59XG5cbmV4cG9ydCBjbGFzcyBMaXZlU3RyYXRlZ3kge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29JbnNlcnRlZFRleHQgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ2lubGluZS1tb2RpZmllZC1saW5lJyxcblx0XHRjbGFzc05hbWU6ICdpbmxpbmUtY2hhdC1pbnNlcnRlZC1yYW5nZS1saW5laGlnaGxpZ2h0Jyxcblx0XHRpc1dob2xlTGluZTogdHJ1ZSxcblx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuRnVsbCxcblx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKG92ZXJ2aWV3UnVsZXJJbmxpbmVDaGF0RGlmZkluc2VydGVkKSxcblx0XHR9LFxuXHRcdG1pbmltYXA6IHtcblx0XHRcdHBvc2l0aW9uOiBNaW5pbWFwUG9zaXRpb24uSW5saW5lLFxuXHRcdFx0Y29sb3I6IHRoZW1lQ29sb3JGcm9tSWQobWluaW1hcElubGluZUNoYXREaWZmSW5zZXJ0ZWQpLFxuXHRcdH1cblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVjb0luc2VydGVkVGV4dFJhbmdlID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdpbmxpbmUtY2hhdC1pbnNlcnRlZC1yYW5nZS1saW5laGlnaGxpZ2h0Jyxcblx0XHRjbGFzc05hbWU6ICdpbmxpbmUtY2hhdC1pbnNlcnRlZC1yYW5nZScsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdH0pO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRBY2NlcHQgPSB0aGlzLl9zdG9yZS5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWREaXNjYXJkID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhDdXJyZW50Q2hhbmdlSGFzRGlmZjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eEN1cnJlbnRDaGFuZ2VTaG93c0RpZmY6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc2l2ZUVkaXRpbmdEZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfbGVuc0FjdGlvbnNGYWN0b3J5OiBDb25mbGljdEFjdGlvbnNGYWN0b3J5O1xuXHRwcml2YXRlIF9lZGl0Q291bnQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2h1bmtEYXRhID0gbmV3IE1hcDxIdW5rSW5mb3JtYXRpb24sIEh1bmtEaXNwbGF5RGF0YT4oKTtcblxuXHRyZWFkb25seSBvbkRpZEFjY2VwdDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZEFjY2VwdC5ldmVudDtcblx0cmVhZG9ubHkgb25EaWREaXNjYXJkOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkRGlzY2FyZC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3Nlc3Npb246IFNlc3Npb24sXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBfem9uZTogSW5saW5lQ2hhdFpvbmVXaWRnZXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2hvd092ZXJsYXlUb29sYmFyOiBib29sZWFuLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9lZGl0b3JXb3JrZXJTZXJ2aWNlOiBJRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2N0eEN1cnJlbnRDaGFuZ2VIYXNEaWZmID0gQ1RYX0lOTElORV9DSEFUX0NIQU5HRV9IQVNfRElGRi5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2N0eEN1cnJlbnRDaGFuZ2VTaG93c0RpZmYgPSBDVFhfSU5MSU5FX0NIQVRfQ0hBTkdFX1NIT1dTX0RJRkYuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3Byb2dyZXNzaXZlRWRpdGluZ0RlY29yYXRpb25zID0gdGhpcy5fZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXHRcdHRoaXMuX2xlbnNBY3Rpb25zRmFjdG9yeSA9IHRoaXMuX3N0b3JlLmFkZChuZXcgQ29uZmxpY3RBY3Rpb25zRmFjdG9yeSh0aGlzLl9lZGl0b3IpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVzZXREaWZmKCk7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzZXREaWZmKCk6IHZvaWQge1xuXHRcdHRoaXMuX2N0eEN1cnJlbnRDaGFuZ2VIYXNEaWZmLnJlc2V0KCk7XG5cdFx0dGhpcy5fY3R4Q3VycmVudENoYW5nZVNob3dzRGlmZi5yZXNldCgpO1xuXHRcdHRoaXMuX3pvbmUud2lkZ2V0LnVwZGF0ZVN0YXR1cygnJyk7XG5cdFx0dGhpcy5fcHJvZ3Jlc3NpdmVFZGl0aW5nRGVjb3JhdGlvbnMuY2xlYXIoKTtcblxuXG5cdFx0Zm9yIChjb25zdCBkYXRhIG9mIHRoaXMuX2h1bmtEYXRhLnZhbHVlcygpKSB7XG5cdFx0XHRkYXRhLnJlbW92ZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGFwcGx5KCkge1xuXHRcdHRoaXMuX3Jlc2V0RGlmZigpO1xuXHRcdGlmICh0aGlzLl9lZGl0Q291bnQgPiAwKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX2RvQXBwbHlDaGFuZ2VzKHRydWUpO1xuXHR9XG5cblx0Y2FuY2VsKCkge1xuXHRcdHRoaXMuX3Jlc2V0RGlmZigpO1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9uLmh1bmtEYXRhLmRpc2NhcmRBbGwoKTtcblx0fVxuXG5cdGFzeW5jIG1ha2VDaGFuZ2VzKGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBvYnM6IElFZGl0T2JzZXJ2ZXIsIHVuZG9TdG9wQmVmb3JlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX21ha2VDaGFuZ2VzKGVkaXRzLCBvYnMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRvU3RvcEJlZm9yZSk7XG5cdH1cblxuXHRhc3luYyBtYWtlUHJvZ3Jlc3NpdmVDaGFuZ2VzKGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBvYnM6IElFZGl0T2JzZXJ2ZXIsIG9wdHM6IFByb2dyZXNzaW5nRWRpdHNPcHRpb25zLCB1bmRvU3RvcEJlZm9yZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gYWRkIGRlY29yYXRpb25zIG9uY2UgcGVyIGxpbmUgdGhhdCBnb3QgZWRpdGVkXG5cdFx0Y29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3M8SVZhbGlkRWRpdE9wZXJhdGlvbltdPihlZGl0cyA9PiB7XG5cblx0XHRcdGNvbnN0IG5ld0xpbmVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgZWRpdHMpIHtcblx0XHRcdFx0TGluZVJhbmdlLmZyb21SYW5nZShlZGl0LnJhbmdlKS5mb3JFYWNoKGxpbmUgPT4gbmV3TGluZXMuYWRkKGxpbmUpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGV4aXN0aW5nUmFuZ2VzID0gdGhpcy5fcHJvZ3Jlc3NpdmVFZGl0aW5nRGVjb3JhdGlvbnMuZ2V0UmFuZ2VzKCkubWFwKExpbmVSYW5nZS5mcm9tUmFuZ2UpO1xuXHRcdFx0Zm9yIChjb25zdCBleGlzdGluZ1JhbmdlIG9mIGV4aXN0aW5nUmFuZ2VzKSB7XG5cdFx0XHRcdGV4aXN0aW5nUmFuZ2UuZm9yRWFjaChsaW5lID0+IG5ld0xpbmVzLmRlbGV0ZShsaW5lKSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgbGluZSBvZiBuZXdMaW5lcykge1xuXHRcdFx0XHRuZXdEZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IG5ldyBSYW5nZShsaW5lLCAxLCBsaW5lLCBOdW1iZXIuTUFYX1ZBTFVFKSwgb3B0aW9uczogdGhpcy5fZGVjb0luc2VydGVkVGV4dCB9KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcHJvZ3Jlc3NpdmVFZGl0aW5nRGVjb3JhdGlvbnMuYXBwZW5kKG5ld0RlY29yYXRpb25zKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gdGhpcy5fbWFrZUNoYW5nZXMoZWRpdHMsIG9icywgb3B0cywgcHJvZ3Jlc3MsIHVuZG9TdG9wQmVmb3JlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX21ha2VDaGFuZ2VzKGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBvYnM6IElFZGl0T2JzZXJ2ZXIsIG9wdHM6IFByb2dyZXNzaW5nRWRpdHNPcHRpb25zIHwgdW5kZWZpbmVkLCBwcm9ncmVzczogUHJvZ3Jlc3M8SVZhbGlkRWRpdE9wZXJhdGlvbltdPiB8IHVuZGVmaW5lZCwgdW5kb1N0b3BCZWZvcmU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIHB1c2ggdW5kbyBzdG9wIGJlZm9yZSBmaXJzdCBlZGl0XG5cdFx0aWYgKHVuZG9TdG9wQmVmb3JlKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdENvdW50Kys7XG5cblx0XHRpZiAob3B0cykge1xuXHRcdFx0Ly8gQVNZTkNcblx0XHRcdGNvbnN0IGR1cmF0aW9uSW5TZWMgPSBvcHRzLmR1cmF0aW9uIC8gMTAwMDtcblx0XHRcdGZvciAoY29uc3QgZWRpdCBvZiBlZGl0cykge1xuXHRcdFx0XHRjb25zdCB3b3JkQ291bnQgPSBjb3VudFdvcmRzKGVkaXQudGV4dCA/PyAnJyk7XG5cdFx0XHRcdGNvbnN0IHNwZWVkID0gd29yZENvdW50IC8gZHVyYXRpb25JblNlYztcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coeyBkdXJhdGlvbkluU2VjLCB3b3JkQ291bnQsIHNwZWVkOiB3b3JkQ291bnQgLyBkdXJhdGlvbkluU2VjIH0pO1xuXHRcdFx0XHRjb25zdCBhc3luY0VkaXQgPSBhc1Byb2dyZXNzaXZlRWRpdChuZXcgV2luZG93SW50ZXJ2YWxUaW1lcih0aGlzLl96b25lLmRvbU5vZGUpLCBlZGl0LCBzcGVlZCwgb3B0cy50b2tlbik7XG5cdFx0XHRcdGF3YWl0IHBlcmZvcm1Bc3luY1RleHRFZGl0KHRoaXMuX3Nlc3Npb24udGV4dE1vZGVsTiwgYXN5bmNFZGl0LCBwcm9ncmVzcywgb2JzKTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBTWU5DXG5cdFx0XHRvYnMuc3RhcnQoKTtcblx0XHRcdHRoaXMuX3Nlc3Npb24udGV4dE1vZGVsTi5wdXNoRWRpdE9wZXJhdGlvbnMobnVsbCwgZWRpdHMsICh1bmRvRWRpdHMpID0+IHtcblx0XHRcdFx0cHJvZ3Jlc3M/LnJlcG9ydCh1bmRvRWRpdHMpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0pO1xuXHRcdFx0b2JzLnN0b3AoKTtcblx0XHR9XG5cdH1cblxuXHRwZXJmb3JtSHVua0FjdGlvbihodW5rOiBIdW5rSW5mb3JtYXRpb24gfCB1bmRlZmluZWQsIGFjdGlvbjogSHVua0FjdGlvbikge1xuXHRcdGNvbnN0IGRpc3BsYXlEYXRhID0gdGhpcy5fZmluZERpc3BsYXlEYXRhKGh1bmspO1xuXG5cdFx0aWYgKCFkaXNwbGF5RGF0YSkge1xuXHRcdFx0Ly8gbm8gaHVua3MgKGxlZnQgb3Igbm90IHlldCkgZm91bmQsIG1ha2Ugc3VyZSB0b1xuXHRcdFx0Ly8gZmluaXNoIHRoZSBzZXNzaW9uc1xuXHRcdFx0aWYgKGFjdGlvbiA9PT0gSHVua0FjdGlvbi5BY2NlcHQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRBY2NlcHQuZmlyZSgpO1xuXHRcdFx0fSBlbHNlIGlmIChhY3Rpb24gPT09IEh1bmtBY3Rpb24uRGlzY2FyZCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZERpc2NhcmQuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChhY3Rpb24gPT09IEh1bmtBY3Rpb24uQWNjZXB0KSB7XG5cdFx0XHRkaXNwbGF5RGF0YS5hY2NlcHRIdW5rKCk7XG5cdFx0fSBlbHNlIGlmIChhY3Rpb24gPT09IEh1bmtBY3Rpb24uRGlzY2FyZCkge1xuXHRcdFx0ZGlzcGxheURhdGEuZGlzY2FyZEh1bmsoKTtcblx0XHR9IGVsc2UgaWYgKGFjdGlvbiA9PT0gSHVua0FjdGlvbi5Nb3ZlTmV4dCkge1xuXHRcdFx0ZGlzcGxheURhdGEubW92ZSh0cnVlKTtcblx0XHR9IGVsc2UgaWYgKGFjdGlvbiA9PT0gSHVua0FjdGlvbi5Nb3ZlUHJldikge1xuXHRcdFx0ZGlzcGxheURhdGEubW92ZShmYWxzZSk7XG5cdFx0fSBlbHNlIGlmIChhY3Rpb24gPT09IEh1bmtBY3Rpb24uVG9nZ2xlRGlmZikge1xuXHRcdFx0ZGlzcGxheURhdGEudG9nZ2xlRGlmZj8uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZmluZERpc3BsYXlEYXRhKGh1bmtJbmZvPzogSHVua0luZm9ybWF0aW9uKSB7XG5cdFx0bGV0IHJlc3VsdDogSHVua0Rpc3BsYXlEYXRhIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChodW5rSW5mbykge1xuXHRcdFx0Ly8gdXNlIGNvbnRleHQgaHVuayAoZnJvbSB0b29sL2J1dHRvbmJhcilcblx0XHRcdHJlc3VsdCA9IHRoaXMuX2h1bmtEYXRhLmdldChodW5rSW5mbyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXN1bHQgJiYgdGhpcy5fem9uZS5wb3NpdGlvbikge1xuXHRcdFx0Ly8gZmluZCBuZWFyZXN0IGZyb20gem9uZSBwb3NpdGlvblxuXHRcdFx0Y29uc3Qgem9uZUxpbmUgPSB0aGlzLl96b25lLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRsZXQgZGlzdGFuY2U6IG51bWJlciA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXHRcdFx0Zm9yIChjb25zdCBjYW5kaWRhdGUgb2YgdGhpcy5faHVua0RhdGEudmFsdWVzKCkpIHtcblx0XHRcdFx0aWYgKGNhbmRpZGF0ZS5odW5rLmdldFN0YXRlKCkgIT09IEh1bmtTdGF0ZS5QZW5kaW5nKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaHVua1JhbmdlcyA9IGNhbmRpZGF0ZS5odW5rLmdldFJhbmdlc04oKTtcblx0XHRcdFx0aWYgKGh1bmtSYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Ly8gYm9nb3VzIGh1bmtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBteURpc3RhbmNlID0gem9uZUxpbmUgPD0gaHVua1Jhbmdlc1swXS5zdGFydExpbmVOdW1iZXJcblx0XHRcdFx0XHQ/IGh1bmtSYW5nZXNbMF0uc3RhcnRMaW5lTnVtYmVyIC0gem9uZUxpbmVcblx0XHRcdFx0XHQ6IHpvbmVMaW5lIC0gaHVua1Jhbmdlc1swXS5lbmRMaW5lTnVtYmVyO1xuXG5cdFx0XHRcdGlmIChteURpc3RhbmNlIDwgZGlzdGFuY2UpIHtcblx0XHRcdFx0XHRkaXN0YW5jZSA9IG15RGlzdGFuY2U7XG5cdFx0XHRcdFx0cmVzdWx0ID0gY2FuZGlkYXRlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdC8vIGZhbGxiYWNrOiBmaXJzdCBodW5rIHRoYXQgaXMgcGVuZGluZ1xuXHRcdFx0cmVzdWx0ID0gSXRlcmFibGUuZmlyc3QoSXRlcmFibGUuZmlsdGVyKHRoaXMuX2h1bmtEYXRhLnZhbHVlcygpLCBjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmh1bmsuZ2V0U3RhdGUoKSA9PT0gSHVua1N0YXRlLlBlbmRpbmcpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jIHJlbmRlckNoYW5nZXMoKSB7XG5cblx0XHR0aGlzLl9wcm9ncmVzc2l2ZUVkaXRpbmdEZWNvcmF0aW9ucy5jbGVhcigpO1xuXG5cdFx0Y29uc3QgcmVuZGVySHVua3MgPSAoKSA9PiB7XG5cblx0XHRcdGxldCB3aWRnZXREYXRhOiBIdW5rRGlzcGxheURhdGEgfCB1bmRlZmluZWQ7XG5cblx0XHRcdGNoYW5nZURlY29yYXRpb25zQW5kVmlld1pvbmVzKHRoaXMuX2VkaXRvciwgKGRlY29yYXRpb25zQWNjZXNzb3IsIHZpZXdab25lQWNjZXNzb3IpID0+IHtcblxuXHRcdFx0XHRjb25zdCBrZXlzTm93ID0gbmV3IFNldCh0aGlzLl9odW5rRGF0YS5rZXlzKCkpO1xuXHRcdFx0XHR3aWRnZXREYXRhID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgaHVua0RhdGEgb2YgdGhpcy5fc2Vzc2lvbi5odW5rRGF0YS5nZXRJbmZvKCkpIHtcblxuXHRcdFx0XHRcdGtleXNOb3cuZGVsZXRlKGh1bmtEYXRhKTtcblxuXHRcdFx0XHRcdGNvbnN0IGh1bmtSYW5nZXMgPSBodW5rRGF0YS5nZXRSYW5nZXNOKCk7XG5cdFx0XHRcdFx0bGV0IGRhdGEgPSB0aGlzLl9odW5rRGF0YS5nZXQoaHVua0RhdGEpO1xuXHRcdFx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRcdFx0Ly8gZmlyc3QgdGltZSAtPiBjcmVhdGUgZGVjb3JhdGlvblxuXHRcdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbklkczogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaHVua1Jhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uSWRzLnB1c2goZGVjb3JhdGlvbnNBY2Nlc3Nvci5hZGREZWNvcmF0aW9uKGh1bmtSYW5nZXNbaV0sIGkgPT09IDBcblx0XHRcdFx0XHRcdFx0XHQ/IHRoaXMuX2RlY29JbnNlcnRlZFRleHRcblx0XHRcdFx0XHRcdFx0XHQ6IHRoaXMuX2RlY29JbnNlcnRlZFRleHRSYW5nZSlcblx0XHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgYWNjZXB0SHVuayA9ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0aHVua0RhdGEuYWNjZXB0Q2hhbmdlcygpO1xuXHRcdFx0XHRcdFx0XHRyZW5kZXJIdW5rcygpO1xuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0Y29uc3QgZGlzY2FyZEh1bmsgPSAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGh1bmtEYXRhLmRpc2NhcmRDaGFuZ2VzKCk7XG5cdFx0XHRcdFx0XHRcdHJlbmRlckh1bmtzKCk7XG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHQvLyBvcmlnaW5hbCB2aWV3IHpvbmVcblx0XHRcdFx0XHRcdGNvbnN0IG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkgPSB0aGlzLl9zZXNzaW9uLnRleHRNb2RlbDAubWlnaHRDb250YWluTm9uQmFzaWNBU0NJSSgpO1xuXHRcdFx0XHRcdFx0Y29uc3QgbWlnaHRDb250YWluUlRMID0gdGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWwwLm1pZ2h0Q29udGFpblJUTCgpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVuZGVyT3B0aW9ucyA9IFJlbmRlck9wdGlvbnMuZnJvbUVkaXRvcih0aGlzLl9lZGl0b3IpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxSYW5nZSA9IGh1bmtEYXRhLmdldFJhbmdlczAoKVswXTtcblx0XHRcdFx0XHRcdGNvbnN0IHNvdXJjZSA9IG5ldyBMaW5lU291cmNlKFxuXHRcdFx0XHRcdFx0XHRMaW5lUmFuZ2UuZnJvbVJhbmdlSW5jbHVzaXZlKG9yaWdpbmFsUmFuZ2UpLm1hcFRvTGluZUFycmF5KGwgPT4gdGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWwwLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGwpKSxcblx0XHRcdFx0XHRcdFx0W10sXG5cdFx0XHRcdFx0XHRcdG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUksXG5cdFx0XHRcdFx0XHRcdG1pZ2h0Q29udGFpblJUTCxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRjb25zdCBkb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0XHRkb21Ob2RlLmNsYXNzTmFtZSA9ICdpbmxpbmUtY2hhdC1vcmlnaW5hbC16b25lMic7XG5cdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSByZW5kZXJMaW5lcyhzb3VyY2UsIHJlbmRlck9wdGlvbnMsIFtuZXcgSW5saW5lRGVjb3JhdGlvbihuZXcgUmFuZ2Uob3JpZ2luYWxSYW5nZS5zdGFydExpbmVOdW1iZXIsIDEsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKSwgJycsIElubGluZURlY29yYXRpb25UeXBlLlJlZ3VsYXIpXSwgZG9tTm9kZSk7XG5cdFx0XHRcdFx0XHRjb25zdCB2aWV3Wm9uZURhdGE6IElWaWV3Wm9uZSA9IHtcblx0XHRcdFx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiAtMSxcblx0XHRcdFx0XHRcdFx0aGVpZ2h0SW5MaW5lczogcmVzdWx0LmhlaWdodEluTGluZXMsXG5cdFx0XHRcdFx0XHRcdGRvbU5vZGUsXG5cdFx0XHRcdFx0XHRcdG9yZGluYWw6IDUwMDAwICsgMiAvLyBtb3JlIHRoYW4gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi9iZjUyYTVjZmIyYzc1YTczMjdjOWFkZWFlZmJkZGMwNmQ1MjlkY2FkL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFpvbmVXaWRnZXQudHMjTDQyXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRjb25zdCB0b2dnbGVEaWZmID0gKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzY3JvbGxTdGF0ZSA9IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlLmNhcHR1cmUodGhpcy5fZWRpdG9yKTtcblx0XHRcdFx0XHRcdFx0Y2hhbmdlRGVjb3JhdGlvbnNBbmRWaWV3Wm9uZXModGhpcy5fZWRpdG9yLCAoX2RlY29yYXRpb25zQWNjZXNzb3IsIHZpZXdab25lQWNjZXNzb3IpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGRhdGEpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICghZGF0YS5kaWZmVmlld1pvbmVJZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgW2h1bmtSYW5nZV0gPSBodW5rRGF0YS5nZXRSYW5nZXNOKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR2aWV3Wm9uZURhdGEuYWZ0ZXJMaW5lTnVtYmVyID0gaHVua1JhbmdlLnN0YXJ0TGluZU51bWJlciAtIDE7XG5cdFx0XHRcdFx0XHRcdFx0XHRkYXRhLmRpZmZWaWV3Wm9uZUlkID0gdmlld1pvbmVBY2Nlc3Nvci5hZGRab25lKHZpZXdab25lRGF0YSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZpZXdab25lQWNjZXNzb3IucmVtb3ZlWm9uZShkYXRhLmRpZmZWaWV3Wm9uZUlkISk7XG5cdFx0XHRcdFx0XHRcdFx0XHRkYXRhLmRpZmZWaWV3Wm9uZUlkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2N0eEN1cnJlbnRDaGFuZ2VTaG93c0RpZmYuc2V0KHR5cGVvZiBkYXRhPy5kaWZmVmlld1pvbmVJZCA9PT0gJ3N0cmluZycpO1xuXHRcdFx0XHRcdFx0XHRzY3JvbGxTdGF0ZS5yZXN0b3JlKHRoaXMuX2VkaXRvcik7XG5cdFx0XHRcdFx0XHR9O1xuXG5cblx0XHRcdFx0XHRcdGxldCBsZW5zQWN0aW9uczogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGVuc0FjdGlvbnNWaWV3Wm9uZUlkczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX3Nob3dPdmVybGF5VG9vbGJhciAmJiBodW5rRGF0YS5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuUGVuZGluZykge1xuXG5cdFx0XHRcdFx0XHRcdGxlbnNBY3Rpb25zID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IG1lbnUgPSB0aGlzLl9tZW51U2VydmljZS5jcmVhdGVNZW51KE1FTlVfSU5MSU5FX0NIQVRfWk9ORSwgdGhpcy5fY29udGV4dFNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBtYWtlQWN0aW9ucyA9ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBhY3Rpb25zOiBJQ29udGVudFdpZGdldEFjdGlvbltdID0gW107XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgdHVwbGVzID0gbWVudS5nZXRBY3Rpb25zKHsgYXJnOiBodW5rRGF0YSB9KTtcblx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IFssIGdyb3VwXSBvZiB0dXBsZXMpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBncm91cCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoaXRlbSBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsZXQgdGV4dCA9IGl0ZW0ubGFiZWw7XG5cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoaXRlbS5pZCA9PT0gQUNUSU9OX1RPR0dMRV9ESUZGKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0ZXh0ID0gaXRlbS5jaGVja2VkID8gJ0hpZGUgQ2hhbmdlcycgOiAnU2hvdyBDaGFuZ2VzJztcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpdGVtLml0ZW0uaWNvbikpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRleHQgPSBgJCgke2l0ZW0uaXRlbS5pY29uLmlkfSkgJHt0ZXh0fWA7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRleHQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0b29sdGlwOiBpdGVtLnRvb2x0aXAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhY3Rpb246IGFzeW5jICgpID0+IGl0ZW0ucnVuKCksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGFjdGlvbnM7XG5cdFx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2JzID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIG1ha2VBY3Rpb25zKCkpO1xuXHRcdFx0XHRcdFx0XHRsZW5zQWN0aW9ucy5hZGQobWVudS5vbkRpZENoYW5nZSgoKSA9PiBvYnMuc2V0KG1ha2VBY3Rpb25zKCksIHVuZGVmaW5lZCkpKTtcblx0XHRcdFx0XHRcdFx0bGVuc0FjdGlvbnMuYWRkKG1lbnUpO1xuXG5cdFx0XHRcdFx0XHRcdGxlbnNBY3Rpb25zLmFkZCh0aGlzLl9sZW5zQWN0aW9uc0ZhY3RvcnkuY3JlYXRlV2lkZ2V0KHZpZXdab25lQWNjZXNzb3IsXG5cdFx0XHRcdFx0XHRcdFx0aHVua1Jhbmdlc1swXS5zdGFydExpbmVOdW1iZXIgLSAxLFxuXHRcdFx0XHRcdFx0XHRcdG9icyxcblx0XHRcdFx0XHRcdFx0XHRsZW5zQWN0aW9uc1ZpZXdab25lSWRzXG5cdFx0XHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCByZW1vdmUgPSAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNoYW5nZURlY29yYXRpb25zQW5kVmlld1pvbmVzKHRoaXMuX2VkaXRvciwgKGRlY29yYXRpb25zQWNjZXNzb3IsIHZpZXdab25lQWNjZXNzb3IpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGRhdGEpO1xuXHRcdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbklkIG9mIGRhdGEuZGVjb3JhdGlvbklkcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvbnNBY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKGRlY29yYXRpb25JZCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGlmIChkYXRhLmRpZmZWaWV3Wm9uZUlkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2aWV3Wm9uZUFjY2Vzc29yLnJlbW92ZVpvbmUoZGF0YS5kaWZmVmlld1pvbmVJZCEpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRkYXRhLmRlY29yYXRpb25JZHMgPSBbXTtcblx0XHRcdFx0XHRcdFx0XHRkYXRhLmRpZmZWaWV3Wm9uZUlkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0XHRcdFx0ZGF0YS5sZW5zQWN0aW9uc1ZpZXdab25lSWRzPy5mb3JFYWNoKHZpZXdab25lQWNjZXNzb3IucmVtb3ZlWm9uZSk7XG5cdFx0XHRcdFx0XHRcdFx0ZGF0YS5sZW5zQWN0aW9uc1ZpZXdab25lSWRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHRsZW5zQWN0aW9ucz8uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0Y29uc3QgbW92ZSA9IChuZXh0OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGtleXMgPSBBcnJheS5mcm9tKHRoaXMuX2h1bmtEYXRhLmtleXMoKSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlkeCA9IGtleXMuaW5kZXhPZihodW5rRGF0YSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5leHRJZHggPSAoaWR4ICsgKG5leHQgPyAxIDogLTEpICsga2V5cy5sZW5ndGgpICUga2V5cy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXh0SWR4ICE9PSBpZHgpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBuZXh0RGF0YSA9IHRoaXMuX2h1bmtEYXRhLmdldChrZXlzW25leHRJZHhdKSE7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fem9uZS51cGRhdGVQb3NpdGlvbkFuZEhlaWdodChuZXh0RGF0YT8ucG9zaXRpb24pO1xuXHRcdFx0XHRcdFx0XHRcdHJlbmRlckh1bmtzKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdGNvbnN0IHpvbmVMaW5lTnVtYmVyID0gdGhpcy5fem9uZS5wb3NpdGlvbj8ubGluZU51bWJlciA/PyB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSEubGluZU51bWJlcjtcblx0XHRcdFx0XHRcdGNvbnN0IG15RGlzdGFuY2UgPSB6b25lTGluZU51bWJlciA8PSBodW5rUmFuZ2VzWzBdLnN0YXJ0TGluZU51bWJlclxuXHRcdFx0XHRcdFx0XHQ/IGh1bmtSYW5nZXNbMF0uc3RhcnRMaW5lTnVtYmVyIC0gem9uZUxpbmVOdW1iZXJcblx0XHRcdFx0XHRcdFx0OiB6b25lTGluZU51bWJlciAtIGh1bmtSYW5nZXNbMF0uZW5kTGluZU51bWJlcjtcblxuXHRcdFx0XHRcdFx0ZGF0YSA9IHtcblx0XHRcdFx0XHRcdFx0aHVuazogaHVua0RhdGEsXG5cdFx0XHRcdFx0XHRcdGRlY29yYXRpb25JZHMsXG5cdFx0XHRcdFx0XHRcdGRpZmZWaWV3Wm9uZUlkOiAnJyxcblx0XHRcdFx0XHRcdFx0ZGlmZlZpZXdab25lOiB2aWV3Wm9uZURhdGEsXG5cdFx0XHRcdFx0XHRcdGxlbnNBY3Rpb25zVmlld1pvbmVJZHMsXG5cdFx0XHRcdFx0XHRcdGRpc3RhbmNlOiBteURpc3RhbmNlLFxuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbjogaHVua1Jhbmdlc1swXS5nZXRTdGFydFBvc2l0aW9uKCkuZGVsdGEoLTEpLFxuXHRcdFx0XHRcdFx0XHRhY2NlcHRIdW5rLFxuXHRcdFx0XHRcdFx0XHRkaXNjYXJkSHVuayxcblx0XHRcdFx0XHRcdFx0dG9nZ2xlRGlmZjogIWh1bmtEYXRhLmlzSW5zZXJ0aW9uKCkgPyB0b2dnbGVEaWZmIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRyZW1vdmUsXG5cdFx0XHRcdFx0XHRcdG1vdmUsXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHR0aGlzLl9odW5rRGF0YS5zZXQoaHVua0RhdGEsIGRhdGEpO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChodW5rRGF0YS5nZXRTdGF0ZSgpICE9PSBIdW5rU3RhdGUuUGVuZGluZykge1xuXHRcdFx0XHRcdFx0ZGF0YS5yZW1vdmUoKTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyB1cGRhdGUgZGlzdGFuY2UgYW5kIHBvc2l0aW9uIGJhc2VkIG9uIG1vZGlmaWVkUmFuZ2UtZGVjb3JhdGlvblxuXHRcdFx0XHRcdFx0Y29uc3Qgem9uZUxpbmVOdW1iZXIgPSB0aGlzLl96b25lLnBvc2l0aW9uPy5saW5lTnVtYmVyID8/IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpIS5saW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRSYW5nZU5vdyA9IGh1bmtSYW5nZXNbMF07XG5cdFx0XHRcdFx0XHRkYXRhLnBvc2l0aW9uID0gbW9kaWZpZWRSYW5nZU5vdy5nZXRTdGFydFBvc2l0aW9uKCkuZGVsdGEoLTEpO1xuXHRcdFx0XHRcdFx0ZGF0YS5kaXN0YW5jZSA9IHpvbmVMaW5lTnVtYmVyIDw9IG1vZGlmaWVkUmFuZ2VOb3cuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHRcdFx0XHRcdD8gbW9kaWZpZWRSYW5nZU5vdy5zdGFydExpbmVOdW1iZXIgLSB6b25lTGluZU51bWJlclxuXHRcdFx0XHRcdFx0XHQ6IHpvbmVMaW5lTnVtYmVyIC0gbW9kaWZpZWRSYW5nZU5vdy5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChodW5rRGF0YS5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuUGVuZGluZyAmJiAoIXdpZGdldERhdGEgfHwgZGF0YS5kaXN0YW5jZSA8IHdpZGdldERhdGEuZGlzdGFuY2UpKSB7XG5cdFx0XHRcdFx0XHR3aWRnZXREYXRhID0gZGF0YTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBrZXlzTm93KSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2h1bmtEYXRhLmdldChrZXkpO1xuXHRcdFx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9odW5rRGF0YS5kZWxldGUoa2V5KTtcblx0XHRcdFx0XHRcdGRhdGEucmVtb3ZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHdpZGdldERhdGEpIHtcblx0XHRcdFx0dGhpcy5fem9uZS5yZXZlYWwod2lkZ2V0RGF0YS5wb3NpdGlvbik7XG5cblx0XHRcdFx0Y29uc3QgbW9kZSA9IHRoaXMuX2NvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8J29uJyB8ICdvZmYnIHwgJ2F1dG8nPihJbmxpbmVDaGF0Q29uZmlnS2V5cy5BY2Nlc3NpYmxlRGlmZlZpZXcpO1xuXHRcdFx0XHRpZiAobW9kZSA9PT0gJ29uJyB8fCBtb2RlID09PSAnYXV0bycgJiYgdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMuX3pvbmUud2lkZ2V0LnNob3dBY2Nlc3NpYmxlSHVuayh0aGlzLl9zZXNzaW9uLCB3aWRnZXREYXRhLmh1bmspO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fY3R4Q3VycmVudENoYW5nZUhhc0RpZmYuc2V0KEJvb2xlYW4od2lkZ2V0RGF0YS50b2dnbGVEaWZmKSk7XG5cblx0XHRcdH0gZWxzZSBpZiAodGhpcy5faHVua0RhdGEuc2l6ZSA+IDApIHtcblx0XHRcdFx0Ly8gZXZlcnl0aGluZyBhY2NlcHRlZCBvciByZWplY3RlZFxuXHRcdFx0XHRsZXQgb25lQWNjZXB0ZWQgPSBmYWxzZTtcblx0XHRcdFx0Zm9yIChjb25zdCBodW5rRGF0YSBvZiB0aGlzLl9zZXNzaW9uLmh1bmtEYXRhLmdldEluZm8oKSkge1xuXHRcdFx0XHRcdGlmIChodW5rRGF0YS5nZXRTdGF0ZSgpID09PSBIdW5rU3RhdGUuQWNjZXB0ZWQpIHtcblx0XHRcdFx0XHRcdG9uZUFjY2VwdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob25lQWNjZXB0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZEFjY2VwdC5maXJlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWREaXNjYXJkLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gd2lkZ2V0RGF0YTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHJlbmRlckh1bmtzKCk/LnBvc2l0aW9uO1xuXHR9XG5cblx0Z2V0V2hvbGVSYW5nZURlY29yYXRpb24oKTogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10ge1xuXHRcdC8vIGRvbid0IHJlbmRlciB0aGUgYmx1ZSBpbiBsaXZlIG1vZGVcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9kb0FwcGx5Q2hhbmdlcyhpZ25vcmVMb2NhbDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgdW50aXRsZWRNb2RlbHM6IElVbnRpdGxlZFRleHRFZGl0b3JNb2RlbFtdID0gW107XG5cblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVmYXVsdENoYXRUZXh0RWRpdG9yKTtcblxuXG5cdFx0Zm9yIChjb25zdCByZXF1ZXN0IG9mIHRoaXMuX3Nlc3Npb24uY2hhdE1vZGVsLmdldFJlcXVlc3RzKCkpIHtcblxuXHRcdFx0aWYgKCFyZXF1ZXN0LnJlc3BvbnNlPy5yZXNwb25zZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHJlcXVlc3QucmVzcG9uc2UucmVzcG9uc2UudmFsdWUpIHtcblx0XHRcdFx0aWYgKGl0ZW0ua2luZCAhPT0gJ3RleHRFZGl0R3JvdXAnKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGlnbm9yZUxvY2FsICYmIGlzRXF1YWwoaXRlbS51cmksIHRoaXMuX3Nlc3Npb24udGV4dE1vZGVsTi51cmkpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCBlZGl0b3IuYXBwbHkocmVxdWVzdC5yZXNwb25zZSwgaXRlbSwgdW5kZWZpbmVkKTtcblxuXHRcdFx0XHRpZiAoaXRlbS51cmkuc2NoZW1lID09PSBTY2hlbWFzLnVudGl0bGVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgdW50aXRsZWQgPSB0aGlzLl90ZXh0RmlsZVNlcnZpY2UudW50aXRsZWQuZ2V0KGl0ZW0udXJpKTtcblx0XHRcdFx0XHRpZiAodW50aXRsZWQpIHtcblx0XHRcdFx0XHRcdHVudGl0bGVkTW9kZWxzLnB1c2godW50aXRsZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdW50aXRsZWRNb2RlbCBvZiB1bnRpdGxlZE1vZGVscykge1xuXHRcdFx0aWYgKCF1bnRpdGxlZE1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRhd2FpdCB1bnRpdGxlZE1vZGVsLnJlc29sdmUoKTtcblx0XHRcdFx0YXdhaXQgdW50aXRsZWRNb2RlbC5zYXZlKHsgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lUIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2dyZXNzaW5nRWRpdHNPcHRpb25zIHtcblx0ZHVyYXRpb246IG51bWJlcjtcblx0dG9rZW46IENhbmNlbGxhdGlvblRva2VuO1xufVxuXG50eXBlIEh1bmtEaXNwbGF5RGF0YSA9IHtcblxuXHRkZWNvcmF0aW9uSWRzOiBzdHJpbmdbXTtcblxuXHRkaWZmVmlld1pvbmVJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRkaWZmVmlld1pvbmU6IElWaWV3Wm9uZTtcblxuXHRsZW5zQWN0aW9uc1ZpZXdab25lSWRzPzogc3RyaW5nW107XG5cblx0ZGlzdGFuY2U6IG51bWJlcjtcblx0cG9zaXRpb246IFBvc2l0aW9uO1xuXHRhY2NlcHRIdW5rOiAoKSA9PiB2b2lkO1xuXHRkaXNjYXJkSHVuazogKCkgPT4gdm9pZDtcblx0dG9nZ2xlRGlmZj86ICgpID0+IGFueTtcblx0cmVtb3ZlKCk6IHZvaWQ7XG5cdG1vdmU6IChuZXh0OiBib29sZWFuKSA9PiB2b2lkO1xuXG5cdGh1bms6IEh1bmtJbmZvcm1hdGlvbjtcbn07XG5cbmZ1bmN0aW9uIGNoYW5nZURlY29yYXRpb25zQW5kVmlld1pvbmVzKGVkaXRvcjogSUNvZGVFZGl0b3IsIGNhbGxiYWNrOiAoYWNjZXNzb3I6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IsIHZpZXdab25lQWNjZXNzb3I6IElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yKSA9PiB2b2lkKTogdm9pZCB7XG5cdGVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhkZWNvcmF0aW9uc0FjY2Vzc29yID0+IHtcblx0XHRlZGl0b3IuY2hhbmdlVmlld1pvbmVzKHZpZXdab25lQWNjZXNzb3IgPT4ge1xuXHRcdFx0Y2FsbGJhY2soZGVjb3JhdGlvbnNBY2Nlc3Nvciwgdmlld1pvbmVBY2Nlc3Nvcik7XG5cdFx0fSk7XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsa0JBQWtCLGlCQUFpQjtBQUU1QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLFlBQVksZUFBZSxtQkFBbUI7QUFFdkQsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxhQUFhO0FBRXRCLFNBQXNGLGlCQUFpQixtQkFBbUIsOEJBQThCO0FBQ3hKLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsa0JBQWtCLDRCQUE0QjtBQUN2RCxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBbUMsaUJBQWlCO0FBRXBELFNBQVMsb0JBQW9CLGlDQUFpQyxtQ0FBbUMsc0JBQXNCLHVCQUF1QiwrQkFBK0IsMkNBQTJDO0FBQ3hOLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCLHlCQUF5QjtBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsOEJB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UztBQUVwRCxZQUFJLEtBQUssSUFBSSxXQUFXLFFBQVEsVUFBVTtBQUN6QyxnQkFBTSxXQUFXLEtBQUssaUJBQWlCLFNBQVMsSUFBSSxLQUFLLEdBQUc7QUFDNUQsY0FBSSxVQUFVO0FBQ2IsMkJBQWUsS0FBSyxRQUFRO0FBQUEsVUFDN0I7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxlQUFXLGlCQUFpQixnQkFBZ0I7QUFDM0MsVUFBSSxDQUFDLGNBQWMsV0FBVyxHQUFHO0FBQ2hDLGNBQU0sY0FBYyxRQUFRO0FBQzVCLGNBQU0sY0FBYyxLQUFLLEVBQUUsUUFBUSxXQUFXLFNBQVMsQ0FBQztBQUFBLE1BQ3pEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXZlYSxlQUFOO0FBQUEsRUF3Q0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0EvQ1U7QUFrZ0JiLFNBQVMsOEJBQThCLFFBQXFCLFVBQWdIO0FBQzNLLFNBQU8sa0JBQWtCLHlCQUF1QjtBQUMvQyxXQUFPLGdCQUFnQixzQkFBb0I7QUFDMUMsZUFBUyxxQkFBcUIsZ0JBQWdCO0FBQUEsSUFDL0MsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGOyIsCiAgIm5hbWVzIjogWyJIdW5rQWN0aW9uIiwgImVkaXRzIiwgInZpZXdab25lQWNjZXNzb3IiLCAiZGVjb3JhdGlvbnNBY2Nlc3NvciJdCn0K
