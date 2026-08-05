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
import { $, addDisposableListener } from "../../../../../../base/browser/dom.js";
import { ArrayQueue } from "../../../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../../../base/common/async.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedWithStore, observableFromEvent, observableValue } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { assertIsDefined } from "../../../../../../base/common/types.js";
import { applyFontInfo } from "../../../../config/domFontInfo.js";
import { diffDeleteDecoration, diffRemoveIcon } from "../../registrations.contribution.js";
import { DiffMapping } from "../../diffEditorViewModel.js";
import { InlineDiffDeletedCodeMargin } from "./inlineDiffDeletedCodeMargin.js";
import { LineSource, RenderOptions, renderLines } from "./renderLines.js";
import { animatedObservable, joinCombine } from "../../utils.js";
import { EditorOption } from "../../../../../common/config/editorOptions.js";
import { LineRange } from "../../../../../common/core/lineRange.js";
import { Position } from "../../../../../common/core/position.js";
import { ScrollType } from "../../../../../common/editorCommon.js";
import { BackgroundTokenizationState } from "../../../../../common/tokenizationTextModelPart.js";
import { InlineDecoration, InlineDecorationType } from "../../../../../common/viewModel.js";
import { IClipboardService } from "../../../../../../platform/clipboard/common/clipboardService.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { Range } from "../../../../../common/core/range.js";
let DiffEditorViewZones = class extends Disposable {
  constructor(_targetWindow, _editors, _diffModel, _options, _diffEditorWidget, _canIgnoreViewZoneUpdateEvent, _origViewZonesToIgnore, _modViewZonesToIgnore, _clipboardService, _contextMenuService) {
    super();
    this._targetWindow = _targetWindow;
    this._editors = _editors;
    this._diffModel = _diffModel;
    this._options = _options;
    this._diffEditorWidget = _diffEditorWidget;
    this._canIgnoreViewZoneUpdateEvent = _canIgnoreViewZoneUpdateEvent;
    this._origViewZonesToIgnore = _origViewZonesToIgnore;
    this._modViewZonesToIgnore = _modViewZonesToIgnore;
    this._clipboardService = _clipboardService;
    this._contextMenuService = _contextMenuService;
    this._originalTopPadding = observableValue(this, 0);
    this._originalScrollOffset = observableValue(this, 0);
    this._originalScrollOffsetAnimated = animatedObservable(this._targetWindow, this._originalScrollOffset, this._store);
    this._modifiedTopPadding = observableValue(this, 0);
    this._modifiedScrollOffset = observableValue(this, 0);
    this._modifiedScrollOffsetAnimated = animatedObservable(this._targetWindow, this._modifiedScrollOffset, this._store);
    const state = observableValue("invalidateAlignmentsState", 0);
    const updateImmediately = this._register(new RunOnceScheduler(() => {
      state.set(state.get() + 1, void 0);
    }, 0));
    this._register(this._editors.original.onDidChangeViewZones((_args) => {
      if (!this._canIgnoreViewZoneUpdateEvent()) {
        updateImmediately.schedule();
      }
    }));
    this._register(this._editors.modified.onDidChangeViewZones((_args) => {
      if (!this._canIgnoreViewZoneUpdateEvent()) {
        updateImmediately.schedule();
      }
    }));
    this._register(this._editors.original.onDidChangeConfiguration((args) => {
      if (args.hasChanged(EditorOption.wrappingInfo) || args.hasChanged(EditorOption.lineHeight)) {
        updateImmediately.schedule();
      }
    }));
    this._register(this._editors.modified.onDidChangeConfiguration((args) => {
      if (args.hasChanged(EditorOption.wrappingInfo) || args.hasChanged(EditorOption.lineHeight)) {
        updateImmediately.schedule();
      }
    }));
    const originalModelTokenizationCompleted = this._diffModel.map(
      (m) => m ? observableFromEvent(this, m.model.original.onDidChangeTokens, () => m.model.original.tokenization.backgroundTokenizationState === BackgroundTokenizationState.Completed) : void 0
    ).map((m, reader) => m?.read(reader));
    const alignments = derived((reader) => {
      const diffModel = this._diffModel.read(reader);
      const diff = diffModel?.diff.read(reader);
      if (!diffModel || !diff) {
        return null;
      }
      state.read(reader);
      const renderSideBySide = this._options.renderSideBySide.read(reader);
      const innerHunkAlignment = renderSideBySide;
      return computeRangeAlignment(
        this._editors.original,
        this._editors.modified,
        diff.mappings,
        this._origViewZonesToIgnore,
        this._modViewZonesToIgnore,
        innerHunkAlignment
      );
    });
    const alignmentsSyncedMovedText = derived((reader) => {
      const syncedMovedText = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
      if (!syncedMovedText) {
        return null;
      }
      state.read(reader);
      const mappings = syncedMovedText.changes.map((c) => new DiffMapping(c));
      return computeRangeAlignment(
        this._editors.original,
        this._editors.modified,
        mappings,
        this._origViewZonesToIgnore,
        this._modViewZonesToIgnore,
        true
      );
    });
    function createFakeLinesDiv() {
      const r = document.createElement("div");
      r.className = "diagonal-fill";
      return r;
    }
    const alignmentViewZonesDisposables = this._register(new DisposableStore());
    this.viewZones = derivedWithStore(this, (reader, store) => {
      alignmentViewZonesDisposables.clear();
      const alignmentsVal = alignments.read(reader) || [];
      const origViewZones = [];
      const modViewZones = [];
      const modifiedTopPaddingVal = this._modifiedTopPadding.read(reader);
      if (modifiedTopPaddingVal > 0) {
        modViewZones.push({
          afterLineNumber: 0,
          domNode: document.createElement("div"),
          heightInPx: modifiedTopPaddingVal,
          showInHiddenAreas: true,
          suppressMouseDown: true
        });
      }
      const originalTopPaddingVal = this._originalTopPadding.read(reader);
      if (originalTopPaddingVal > 0) {
        origViewZones.push({
          afterLineNumber: 0,
          domNode: document.createElement("div"),
          heightInPx: originalTopPaddingVal,
          showInHiddenAreas: true,
          suppressMouseDown: true
        });
      }
      const renderSideBySide = this._options.renderSideBySide.read(reader);
      const deletedCodeLineBreaksComputer = !renderSideBySide ? this._editors.modified._getViewModel()?.createLineBreaksComputer() : void 0;
      if (deletedCodeLineBreaksComputer) {
        const originalModel = this._editors.original.getModel();
        for (const a of alignmentsVal) {
          if (a.diff) {
            for (let i = a.originalRange.startLineNumber; i < a.originalRange.endLineNumberExclusive; i++) {
              if (i > originalModel.getLineCount()) {
                return { orig: origViewZones, mod: modViewZones };
              }
              deletedCodeLineBreaksComputer?.addRequest(originalModel.getLineContent(i), null, null);
            }
          }
        }
      }
      const lineBreakData = deletedCodeLineBreaksComputer?.finalize() ?? [];
      let lineBreakDataIdx = 0;
      const modLineHeight = this._editors.modified.getOption(EditorOption.lineHeight);
      const syncedMovedText = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
      const mightContainNonBasicASCII = this._editors.original.getModel()?.mightContainNonBasicASCII() ?? false;
      const mightContainRTL = this._editors.original.getModel()?.mightContainRTL() ?? false;
      const renderOptions = RenderOptions.fromEditor(this._editors.modified);
      for (const a of alignmentsVal) {
        if (a.diff && !renderSideBySide && (!this._options.useTrueInlineDiffRendering.read(reader) || !allowsTrueInlineDiffRendering(a.diff))) {
          if (!a.originalRange.isEmpty) {
            originalModelTokenizationCompleted.read(reader);
            const deletedCodeDomNode = document.createElement("div");
            deletedCodeDomNode.classList.add("view-lines", "line-delete", "monaco-mouse-cursor-text");
            const originalModel = this._editors.original.getModel();
            if (a.originalRange.endLineNumberExclusive - 1 > originalModel.getLineCount()) {
              return { orig: origViewZones, mod: modViewZones };
            }
            const source = new LineSource(
              a.originalRange.mapToLineArray((l) => originalModel.tokenization.getLineTokens(l)),
              a.originalRange.mapToLineArray((_) => lineBreakData[lineBreakDataIdx++]),
              mightContainNonBasicASCII,
              mightContainRTL
            );
            const decorations = [];
            for (const i of a.diff.innerChanges || []) {
              decorations.push(new InlineDecoration(
                i.originalRange.delta(-(a.diff.original.startLineNumber - 1)),
                diffDeleteDecoration.className,
                InlineDecorationType.Regular
              ));
            }
            const result = renderLines(source, renderOptions, decorations, deletedCodeDomNode);
            const marginDomNode2 = document.createElement("div");
            marginDomNode2.className = "inline-deleted-margin-view-zone";
            applyFontInfo(marginDomNode2, renderOptions.fontInfo);
            if (this._options.renderIndicators.read(reader)) {
              for (let i = 0; i < result.heightInLines; i++) {
                const marginElement = document.createElement("div");
                marginElement.className = `delete-sign ${ThemeIcon.asClassName(diffRemoveIcon)}`;
                marginElement.setAttribute("style", `position:absolute;top:${i * modLineHeight}px;width:${renderOptions.lineDecorationsWidth}px;height:${modLineHeight}px;right:0;`);
                marginDomNode2.appendChild(marginElement);
              }
            }
            let zoneId = void 0;
            alignmentViewZonesDisposables.add(
              new InlineDiffDeletedCodeMargin(
                () => assertIsDefined(zoneId),
                marginDomNode2,
                this._editors.modified,
                a.diff,
                this._diffEditorWidget,
                result.viewLineCounts,
                this._editors.original.getModel(),
                this._contextMenuService,
                this._clipboardService
              )
            );
            for (let i = 0; i < result.viewLineCounts.length; i++) {
              const count = result.viewLineCounts[i];
              if (count > 1) {
                origViewZones.push({
                  afterLineNumber: a.originalRange.startLineNumber + i,
                  domNode: createFakeLinesDiv(),
                  heightInPx: (count - 1) * modLineHeight,
                  showInHiddenAreas: true,
                  suppressMouseDown: true
                });
              }
            }
            modViewZones.push({
              afterLineNumber: a.modifiedRange.startLineNumber - 1,
              domNode: deletedCodeDomNode,
              heightInPx: result.heightInLines * modLineHeight,
              minWidthInPx: result.minWidthInPx,
              marginDomNode: marginDomNode2,
              setZoneId(id) {
                zoneId = id;
              },
              showInHiddenAreas: true,
              suppressMouseDown: true
            });
          }
          const marginDomNode = document.createElement("div");
          marginDomNode.className = "gutter-delete";
          origViewZones.push({
            afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
            domNode: createFakeLinesDiv(),
            heightInPx: a.modifiedHeightInPx,
            marginDomNode,
            showInHiddenAreas: true,
            suppressMouseDown: true
          });
        } else {
          const delta = a.modifiedHeightInPx - a.originalHeightInPx;
          if (delta > 0) {
            if (syncedMovedText?.lineRangeMapping.original.delta(-1).deltaLength(2).contains(a.originalRange.endLineNumberExclusive - 1)) {
              continue;
            }
            origViewZones.push({
              afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
              domNode: createFakeLinesDiv(),
              heightInPx: delta,
              showInHiddenAreas: true,
              suppressMouseDown: true
            });
          } else {
            let createViewZoneMarginArrow2 = function() {
              const arrow = document.createElement("div");
              arrow.className = "arrow-revert-change " + ThemeIcon.asClassName(Codicon.arrowRight);
              store.add(addDisposableListener(arrow, "mousedown", (e) => e.stopPropagation()));
              store.add(addDisposableListener(arrow, "click", (e) => {
                e.stopPropagation();
                _diffEditorWidget.revert(a.diff);
              }));
              return $("div", {}, arrow);
            };
            var createViewZoneMarginArrow = createViewZoneMarginArrow2;
            if (syncedMovedText?.lineRangeMapping.modified.delta(-1).deltaLength(2).contains(a.modifiedRange.endLineNumberExclusive - 1)) {
              continue;
            }
            let marginDomNode = void 0;
            if (a.diff && a.diff.modified.isEmpty && this._options.shouldRenderOldRevertArrows.read(reader)) {
              marginDomNode = createViewZoneMarginArrow2();
            }
            modViewZones.push({
              afterLineNumber: a.modifiedRange.endLineNumberExclusive - 1,
              domNode: createFakeLinesDiv(),
              heightInPx: -delta,
              marginDomNode,
              showInHiddenAreas: true,
              suppressMouseDown: true
            });
          }
        }
      }
      for (const a of alignmentsSyncedMovedText.read(reader) ?? []) {
        if (!syncedMovedText?.lineRangeMapping.original.intersect(a.originalRange) || !syncedMovedText?.lineRangeMapping.modified.intersect(a.modifiedRange)) {
          continue;
        }
        const delta = a.modifiedHeightInPx - a.originalHeightInPx;
        if (delta > 0) {
          origViewZones.push({
            afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
            domNode: createFakeLinesDiv(),
            heightInPx: delta,
            showInHiddenAreas: true,
            suppressMouseDown: true
          });
        } else {
          modViewZones.push({
            afterLineNumber: a.modifiedRange.endLineNumberExclusive - 1,
            domNode: createFakeLinesDiv(),
            heightInPx: -delta,
            showInHiddenAreas: true,
            suppressMouseDown: true
          });
        }
      }
      return { orig: origViewZones, mod: modViewZones };
    });
    let ignoreChange = false;
    this._register(this._editors.original.onDidScrollChange((e) => {
      if (e.scrollLeftChanged && !ignoreChange) {
        ignoreChange = true;
        this._editors.modified.setScrollLeft(e.scrollLeft);
        ignoreChange = false;
      }
    }));
    this._register(this._editors.modified.onDidScrollChange((e) => {
      if (e.scrollLeftChanged && !ignoreChange) {
        ignoreChange = true;
        this._editors.original.setScrollLeft(e.scrollLeft);
        ignoreChange = false;
      }
    }));
    this._originalScrollTop = observableFromEvent(this._editors.original.onDidScrollChange, () => (
      /** @description original.getScrollTop */
      this._editors.original.getScrollTop()
    ));
    this._modifiedScrollTop = observableFromEvent(this._editors.modified.onDidScrollChange, () => (
      /** @description modified.getScrollTop */
      this._editors.modified.getScrollTop()
    ));
    this._register(autorun((reader) => {
      const newScrollTopModified = this._originalScrollTop.read(reader) - (this._originalScrollOffsetAnimated.get() - this._modifiedScrollOffsetAnimated.read(reader)) - (this._originalTopPadding.get() - this._modifiedTopPadding.read(reader));
      if (newScrollTopModified !== this._editors.modified.getScrollTop()) {
        this._editors.modified.setScrollTop(newScrollTopModified, ScrollType.Immediate);
      }
    }));
    this._register(autorun((reader) => {
      const newScrollTopOriginal = this._modifiedScrollTop.read(reader) - (this._modifiedScrollOffsetAnimated.get() - this._originalScrollOffsetAnimated.read(reader)) - (this._modifiedTopPadding.get() - this._originalTopPadding.read(reader));
      if (newScrollTopOriginal !== this._editors.original.getScrollTop()) {
        this._editors.original.setScrollTop(newScrollTopOriginal, ScrollType.Immediate);
      }
    }));
    this._register(autorun((reader) => {
      const m = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
      let deltaOrigToMod = 0;
      if (m) {
        const trueTopOriginal = this._editors.original.getTopForLineNumber(m.lineRangeMapping.original.startLineNumber, true) - this._originalTopPadding.get();
        const trueTopModified = this._editors.modified.getTopForLineNumber(m.lineRangeMapping.modified.startLineNumber, true) - this._modifiedTopPadding.get();
        deltaOrigToMod = trueTopModified - trueTopOriginal;
      }
      if (deltaOrigToMod > 0) {
        this._modifiedTopPadding.set(0, void 0);
        this._originalTopPadding.set(deltaOrigToMod, void 0);
      } else if (deltaOrigToMod < 0) {
        this._modifiedTopPadding.set(-deltaOrigToMod, void 0);
        this._originalTopPadding.set(0, void 0);
      } else {
        setTimeout(() => {
          this._modifiedTopPadding.set(0, void 0);
          this._originalTopPadding.set(0, void 0);
        }, 400);
      }
      if (this._editors.modified.hasTextFocus()) {
        this._originalScrollOffset.set(this._modifiedScrollOffset.get() - deltaOrigToMod, void 0, true);
      } else {
        this._modifiedScrollOffset.set(this._originalScrollOffset.get() + deltaOrigToMod, void 0, true);
      }
    }));
  }
};
DiffEditorViewZones = __decorateClass([
  __decorateParam(8, IClipboardService),
  __decorateParam(9, IContextMenuService)
], DiffEditorViewZones);
function computeRangeAlignment(originalEditor, modifiedEditor, diffs, originalEditorAlignmentViewZones, modifiedEditorAlignmentViewZones, innerHunkAlignment) {
  const originalLineHeightOverrides = new ArrayQueue(getAdditionalLineHeights(originalEditor, originalEditorAlignmentViewZones));
  const modifiedLineHeightOverrides = new ArrayQueue(getAdditionalLineHeights(modifiedEditor, modifiedEditorAlignmentViewZones));
  const origLineHeight = originalEditor.getOption(EditorOption.lineHeight);
  const modLineHeight = modifiedEditor.getOption(EditorOption.lineHeight);
  const result = [];
  let lastOriginalLineNumber = 0;
  let lastModifiedLineNumber = 0;
  function handleAlignmentsOutsideOfDiffs(untilOriginalLineNumberExclusive, untilModifiedLineNumberExclusive) {
    while (true) {
      let origNext = originalLineHeightOverrides.peek();
      let modNext = modifiedLineHeightOverrides.peek();
      if (origNext && origNext.lineNumber >= untilOriginalLineNumberExclusive) {
        origNext = void 0;
      }
      if (modNext && modNext.lineNumber >= untilModifiedLineNumberExclusive) {
        modNext = void 0;
      }
      if (!origNext && !modNext) {
        break;
      }
      const distOrig = origNext ? origNext.lineNumber - lastOriginalLineNumber : Number.MAX_VALUE;
      const distNext = modNext ? modNext.lineNumber - lastModifiedLineNumber : Number.MAX_VALUE;
      if (distOrig < distNext) {
        originalLineHeightOverrides.dequeue();
        modNext = {
          lineNumber: origNext.lineNumber - lastOriginalLineNumber + lastModifiedLineNumber,
          heightInPx: 0
        };
      } else if (distOrig > distNext) {
        modifiedLineHeightOverrides.dequeue();
        origNext = {
          lineNumber: modNext.lineNumber - lastModifiedLineNumber + lastOriginalLineNumber,
          heightInPx: 0
        };
      } else {
        originalLineHeightOverrides.dequeue();
        modifiedLineHeightOverrides.dequeue();
      }
      result.push({
        originalRange: LineRange.ofLength(origNext.lineNumber, 1),
        modifiedRange: LineRange.ofLength(modNext.lineNumber, 1),
        originalHeightInPx: origLineHeight + origNext.heightInPx,
        modifiedHeightInPx: modLineHeight + modNext.heightInPx,
        diff: void 0
      });
    }
  }
  for (const m of diffs) {
    let emitAlignment2 = function(origLineNumberExclusive, modLineNumberExclusive, forceAlignment = false) {
      if (origLineNumberExclusive < lastOrigLineNumber || modLineNumberExclusive < lastModLineNumber) {
        return;
      }
      if (first) {
        first = false;
      } else if (!forceAlignment && (origLineNumberExclusive === lastOrigLineNumber || modLineNumberExclusive === lastModLineNumber)) {
        return;
      }
      const originalRange = new LineRange(lastOrigLineNumber, origLineNumberExclusive);
      const modifiedRange = new LineRange(lastModLineNumber, modLineNumberExclusive);
      if (originalRange.isEmpty && modifiedRange.isEmpty) {
        return;
      }
      const originalAdditionalHeight = originalLineHeightOverrides.takeWhile((v) => v.lineNumber < origLineNumberExclusive)?.reduce((p, c2) => p + c2.heightInPx, 0) ?? 0;
      const modifiedAdditionalHeight = modifiedLineHeightOverrides.takeWhile((v) => v.lineNumber < modLineNumberExclusive)?.reduce((p, c2) => p + c2.heightInPx, 0) ?? 0;
      result.push({
        originalRange,
        modifiedRange,
        originalHeightInPx: originalRange.length * origLineHeight + originalAdditionalHeight,
        modifiedHeightInPx: modifiedRange.length * modLineHeight + modifiedAdditionalHeight,
        diff: m.lineRangeMapping
      });
      lastOrigLineNumber = origLineNumberExclusive;
      lastModLineNumber = modLineNumberExclusive;
    };
    var emitAlignment = emitAlignment2;
    const c = m.lineRangeMapping;
    handleAlignmentsOutsideOfDiffs(c.original.startLineNumber, c.modified.startLineNumber);
    let first = true;
    let lastModLineNumber = c.modified.startLineNumber;
    let lastOrigLineNumber = c.original.startLineNumber;
    if (innerHunkAlignment) {
      for (const i of c.innerChanges || []) {
        if (i.originalRange.startColumn > 1 && i.modifiedRange.startColumn > 1) {
          emitAlignment2(i.originalRange.startLineNumber, i.modifiedRange.startLineNumber);
        }
        const originalModel = originalEditor.getModel();
        const maxColumn = i.originalRange.endLineNumber <= originalModel.getLineCount() ? originalModel.getLineMaxColumn(i.originalRange.endLineNumber) : Number.MAX_SAFE_INTEGER;
        if (i.originalRange.endColumn < maxColumn) {
          emitAlignment2(i.originalRange.endLineNumber, i.modifiedRange.endLineNumber);
        }
      }
    }
    emitAlignment2(c.original.endLineNumberExclusive, c.modified.endLineNumberExclusive, true);
    lastOriginalLineNumber = c.original.endLineNumberExclusive;
    lastModifiedLineNumber = c.modified.endLineNumberExclusive;
  }
  handleAlignmentsOutsideOfDiffs(Number.MAX_VALUE, Number.MAX_VALUE);
  return result;
}
function getAdditionalLineHeights(editor, viewZonesToIgnore) {
  const viewZoneHeights = [];
  const wrappingZoneHeights = [];
  const hasWrapping = editor.getOption(EditorOption.wrappingInfo).wrappingColumn !== -1;
  const coordinatesConverter = editor._getViewModel().coordinatesConverter;
  const editorLineHeight = editor.getOption(EditorOption.lineHeight);
  if (hasWrapping) {
    for (let i = 1; i <= editor.getModel().getLineCount(); i++) {
      const lineCount = coordinatesConverter.getModelLineViewLineCount(i);
      if (lineCount > 1) {
        wrappingZoneHeights.push({ lineNumber: i, heightInPx: editorLineHeight * (lineCount - 1) });
      }
    }
  }
  for (const w of editor.getWhitespaces()) {
    if (viewZonesToIgnore.has(w.id)) {
      continue;
    }
    const modelLineNumber = w.afterLineNumber === 0 ? 0 : coordinatesConverter.convertViewPositionToModelPosition(
      new Position(w.afterLineNumber, 1)
    ).lineNumber;
    viewZoneHeights.push({ lineNumber: modelLineNumber, heightInPx: w.height });
  }
  const result = joinCombine(
    viewZoneHeights,
    wrappingZoneHeights,
    (v) => v.lineNumber,
    (v1, v2) => ({ lineNumber: v1.lineNumber, heightInPx: v1.heightInPx + v2.heightInPx })
  );
  return result;
}
function allowsTrueInlineDiffRendering(mapping) {
  if (!mapping.innerChanges) {
    return false;
  }
  return mapping.innerChanges.every(
    (c) => rangeIsSingleLine(c.modifiedRange) && rangeIsSingleLine(c.originalRange) || c.originalRange.equalsRange(new Range(1, 1, 1, 1))
  );
}
function rangeIsSingleLine(range) {
  return range.startLineNumber === range.endLineNumber;
}
export {
  DiffEditorViewZones,
  allowsTrueInlineDiffRendering,
  rangeIsSingleLine
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvZGlmZkVkaXRvclZpZXdab25lcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQXJyYXlRdWV1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgYXV0b3J1biwgZGVyaXZlZCwgZGVyaXZlZFdpdGhTdG9yZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgYXBwbHlGb250SW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbmZpZy9kb21Gb250SW5mby5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IGRpZmZEZWxldGVEZWNvcmF0aW9uLCBkaWZmUmVtb3ZlSWNvbiB9IGZyb20gJy4uLy4uL3JlZ2lzdHJhdGlvbnMuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JFZGl0b3JzIH0gZnJvbSAnLi4vZGlmZkVkaXRvckVkaXRvcnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvclZpZXdNb2RlbCwgRGlmZk1hcHBpbmcgfSBmcm9tICcuLi8uLi9kaWZmRWRpdG9yVmlld01vZGVsLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi9kaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElubGluZURpZmZEZWxldGVkQ29kZU1hcmdpbiB9IGZyb20gJy4vaW5saW5lRGlmZkRlbGV0ZWRDb2RlTWFyZ2luLmpzJztcbmltcG9ydCB7IExpbmVTb3VyY2UsIFJlbmRlck9wdGlvbnMsIHJlbmRlckxpbmVzIH0gZnJvbSAnLi9yZW5kZXJMaW5lcy5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZVZpZXdab25lLCBhbmltYXRlZE9ic2VydmFibGUsIGpvaW5Db21iaW5lIH0gZnJvbSAnLi4vLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vdG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVEZWNvcmF0aW9uLCBJbmxpbmVEZWNvcmF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9kaWZmRWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcblxuLyoqXG4gKiBFbnN1cmVzIGJvdGggZWRpdG9ycyBoYXZlIHRoZSBzYW1lIGhlaWdodCBieSBhbGlnbmluZyB1bmNoYW5nZWQgbGluZXMuXG4gKiBJbiBpbmxpbmUgdmlldyBtb2RlLCBpbnNlcnRzIHZpZXd6b25lcyB0byBzaG93IGRlbGV0ZWQgY29kZSBmcm9tIHRoZSBvcmlnaW5hbCB0ZXh0IG1vZGVsIGluIHRoZSBtb2RpZmllZCBjb2RlIGVkaXRvci5cbiAqIFN5bmNocm9uaXplcyBzY3JvbGxpbmcuXG4gKlxuICogTWFrZSBzdXJlIHRvIGFkZCB0aGUgdmlldyB6b25lcyFcbiAqL1xuZXhwb3J0IGNsYXNzIERpZmZFZGl0b3JWaWV3Wm9uZXMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxUb3BQYWRkaW5nID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIDApO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbFNjcm9sbFRvcDogSU9ic2VydmFibGU8bnVtYmVyPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxTY3JvbGxPZmZzZXQgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyLCBib29sZWFuPih0aGlzLCAwKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxTY3JvbGxPZmZzZXRBbmltYXRlZCA9IGFuaW1hdGVkT2JzZXJ2YWJsZSh0aGlzLl90YXJnZXRXaW5kb3csIHRoaXMuX29yaWdpbmFsU2Nyb2xsT2Zmc2V0LCB0aGlzLl9zdG9yZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRUb3BQYWRkaW5nID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIDApO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZFNjcm9sbFRvcDogSU9ic2VydmFibGU8bnVtYmVyPjtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRTY3JvbGxPZmZzZXQgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyLCBib29sZWFuPih0aGlzLCAwKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRTY3JvbGxPZmZzZXRBbmltYXRlZCA9IGFuaW1hdGVkT2JzZXJ2YWJsZSh0aGlzLl90YXJnZXRXaW5kb3csIHRoaXMuX21vZGlmaWVkU2Nyb2xsT2Zmc2V0LCB0aGlzLl9zdG9yZSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHZpZXdab25lczogSU9ic2VydmFibGU8eyBvcmlnOiBJT2JzZXJ2YWJsZVZpZXdab25lW107IG1vZDogSU9ic2VydmFibGVWaWV3Wm9uZVtdIH0+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RhcmdldFdpbmRvdzogV2luZG93LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcnM6IERpZmZFZGl0b3JFZGl0b3JzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZNb2RlbDogSU9ic2VydmFibGU8RGlmZkVkaXRvclZpZXdNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogRGlmZkVkaXRvck9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlmZkVkaXRvcldpZGdldDogRGlmZkVkaXRvcldpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYW5JZ25vcmVWaWV3Wm9uZVVwZGF0ZUV2ZW50OiAoKSA9PiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29yaWdWaWV3Wm9uZXNUb0lnbm9yZTogU2V0PHN0cmluZz4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kVmlld1pvbmVzVG9JZ25vcmU6IFNldDxzdHJpbmc+LFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBzdGF0ZSA9IG9ic2VydmFibGVWYWx1ZSgnaW52YWxpZGF0ZUFsaWdubWVudHNTdGF0ZScsIDApO1xuXG5cdFx0Y29uc3QgdXBkYXRlSW1tZWRpYXRlbHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRzdGF0ZS5zZXQoc3RhdGUuZ2V0KCkgKyAxLCB1bmRlZmluZWQpO1xuXHRcdH0sIDApKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25EaWRDaGFuZ2VWaWV3Wm9uZXMoKF9hcmdzKSA9PiB7IGlmICghdGhpcy5fY2FuSWdub3JlVmlld1pvbmVVcGRhdGVFdmVudCgpKSB7IHVwZGF0ZUltbWVkaWF0ZWx5LnNjaGVkdWxlKCk7IH0gfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMubW9kaWZpZWQub25EaWRDaGFuZ2VWaWV3Wm9uZXMoKF9hcmdzKSA9PiB7IGlmICghdGhpcy5fY2FuSWdub3JlVmlld1pvbmVVcGRhdGVFdmVudCgpKSB7IHVwZGF0ZUltbWVkaWF0ZWx5LnNjaGVkdWxlKCk7IH0gfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChhcmdzKSA9PiB7XG5cdFx0XHRpZiAoYXJncy5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi53cmFwcGluZ0luZm8pIHx8IGFyZ3MuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpIHsgdXBkYXRlSW1tZWRpYXRlbHkuc2NoZWR1bGUoKTsgfVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoYXJncykgPT4ge1xuXHRcdFx0aWYgKGFyZ3MuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ud3JhcHBpbmdJbmZvKSB8fCBhcmdzLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpKSB7IHVwZGF0ZUltbWVkaWF0ZWx5LnNjaGVkdWxlKCk7IH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBvcmlnaW5hbE1vZGVsVG9rZW5pemF0aW9uQ29tcGxldGVkID0gdGhpcy5fZGlmZk1vZGVsLm1hcChtID0+XG5cdFx0XHRtID8gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBtLm1vZGVsLm9yaWdpbmFsLm9uRGlkQ2hhbmdlVG9rZW5zLCAoKSA9PiBtLm1vZGVsLm9yaWdpbmFsLnRva2VuaXphdGlvbi5iYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RhdGUgPT09IEJhY2tncm91bmRUb2tlbml6YXRpb25TdGF0ZS5Db21wbGV0ZWQpIDogdW5kZWZpbmVkXG5cdFx0KS5tYXAoKG0sIHJlYWRlcikgPT4gbT8ucmVhZChyZWFkZXIpKTtcblxuXHRcdGNvbnN0IGFsaWdubWVudHMgPSBkZXJpdmVkPElMaW5lUmFuZ2VBbGlnbm1lbnRbXSB8IG51bGw+KChyZWFkZXIpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gYWxpZ25tZW50cyAqL1xuXHRcdFx0Y29uc3QgZGlmZk1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGRpZmYgPSBkaWZmTW9kZWw/LmRpZmYucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFkaWZmTW9kZWwgfHwgIWRpZmYpIHsgcmV0dXJuIG51bGw7IH1cblx0XHRcdHN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHJlbmRlclNpZGVCeVNpZGUgPSB0aGlzLl9vcHRpb25zLnJlbmRlclNpZGVCeVNpZGUucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgaW5uZXJIdW5rQWxpZ25tZW50ID0gcmVuZGVyU2lkZUJ5U2lkZTtcblx0XHRcdHJldHVybiBjb21wdXRlUmFuZ2VBbGlnbm1lbnQoXG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwsXG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQsXG5cdFx0XHRcdGRpZmYubWFwcGluZ3MsXG5cdFx0XHRcdHRoaXMuX29yaWdWaWV3Wm9uZXNUb0lnbm9yZSxcblx0XHRcdFx0dGhpcy5fbW9kVmlld1pvbmVzVG9JZ25vcmUsXG5cdFx0XHRcdGlubmVySHVua0FsaWdubWVudFxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGFsaWdubWVudHNTeW5jZWRNb3ZlZFRleHQgPSBkZXJpdmVkPElMaW5lUmFuZ2VBbGlnbm1lbnRbXSB8IG51bGw+KChyZWFkZXIpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gYWxpZ25tZW50c1N5bmNlZE1vdmVkVGV4dCAqL1xuXHRcdFx0Y29uc3Qgc3luY2VkTW92ZWRUZXh0ID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKT8ubW92ZWRUZXh0VG9Db21wYXJlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghc3luY2VkTW92ZWRUZXh0KSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRzdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBtYXBwaW5ncyA9IHN5bmNlZE1vdmVkVGV4dC5jaGFuZ2VzLm1hcChjID0+IG5ldyBEaWZmTWFwcGluZyhjKSk7XG5cdFx0XHQvLyBUT0RPIGRvbnQgaW5jbHVkZSBhbGlnbm1lbnRzIG91dHNpZGUgc3luY2VkTW92ZWRUZXh0XG5cdFx0XHRyZXR1cm4gY29tcHV0ZVJhbmdlQWxpZ25tZW50KFxuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLFxuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLFxuXHRcdFx0XHRtYXBwaW5ncyxcblx0XHRcdFx0dGhpcy5fb3JpZ1ZpZXdab25lc1RvSWdub3JlLFxuXHRcdFx0XHR0aGlzLl9tb2RWaWV3Wm9uZXNUb0lnbm9yZSxcblx0XHRcdFx0dHJ1ZVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdGZ1bmN0aW9uIGNyZWF0ZUZha2VMaW5lc0RpdigpOiBIVE1MRWxlbWVudCB7XG5cdFx0XHRjb25zdCByID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRyLmNsYXNzTmFtZSA9ICdkaWFnb25hbC1maWxsJztcblx0XHRcdHJldHVybiByO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFsaWdubWVudFZpZXdab25lc0Rpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHR0aGlzLnZpZXdab25lcyA9IGRlcml2ZWRXaXRoU3RvcmU8eyBvcmlnOiBJT2JzZXJ2YWJsZVZpZXdab25lW107IG1vZDogSU9ic2VydmFibGVWaWV3Wm9uZVtdIH0+KHRoaXMsIChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRhbGlnbm1lbnRWaWV3Wm9uZXNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0XHRjb25zdCBhbGlnbm1lbnRzVmFsID0gYWxpZ25tZW50cy5yZWFkKHJlYWRlcikgfHwgW107XG5cblx0XHRcdGNvbnN0IG9yaWdWaWV3Wm9uZXM6IElPYnNlcnZhYmxlVmlld1pvbmVbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbW9kVmlld1pvbmVzOiBJT2JzZXJ2YWJsZVZpZXdab25lW10gPSBbXTtcblxuXHRcdFx0Y29uc3QgbW9kaWZpZWRUb3BQYWRkaW5nVmFsID0gdGhpcy5fbW9kaWZpZWRUb3BQYWRkaW5nLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChtb2RpZmllZFRvcFBhZGRpbmdWYWwgPiAwKSB7XG5cdFx0XHRcdG1vZFZpZXdab25lcy5wdXNoKHtcblx0XHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IDAsXG5cdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG5cdFx0XHRcdFx0aGVpZ2h0SW5QeDogbW9kaWZpZWRUb3BQYWRkaW5nVmFsLFxuXHRcdFx0XHRcdHNob3dJbkhpZGRlbkFyZWFzOiB0cnVlLFxuXHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG9yaWdpbmFsVG9wUGFkZGluZ1ZhbCA9IHRoaXMuX29yaWdpbmFsVG9wUGFkZGluZy5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAob3JpZ2luYWxUb3BQYWRkaW5nVmFsID4gMCkge1xuXHRcdFx0XHRvcmlnVmlld1pvbmVzLnB1c2goe1xuXHRcdFx0XHRcdGFmdGVyTGluZU51bWJlcjogMCxcblx0XHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdFx0XHRoZWlnaHRJblB4OiBvcmlnaW5hbFRvcFBhZGRpbmdWYWwsXG5cdFx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IHRydWUsXG5cdFx0XHRcdFx0c3VwcHJlc3NNb3VzZURvd246IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZW5kZXJTaWRlQnlTaWRlID0gdGhpcy5fb3B0aW9ucy5yZW5kZXJTaWRlQnlTaWRlLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0Y29uc3QgZGVsZXRlZENvZGVMaW5lQnJlYWtzQ29tcHV0ZXIgPSAhcmVuZGVyU2lkZUJ5U2lkZSA/IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuX2dldFZpZXdNb2RlbCgpPy5jcmVhdGVMaW5lQnJlYWtzQ29tcHV0ZXIoKSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChkZWxldGVkQ29kZUxpbmVCcmVha3NDb21wdXRlcikge1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbE1vZGVsID0gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5nZXRNb2RlbCgpITtcblx0XHRcdFx0Zm9yIChjb25zdCBhIG9mIGFsaWdubWVudHNWYWwpIHtcblx0XHRcdFx0XHRpZiAoYS5kaWZmKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gYS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcjsgaSA8IGEub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0Ly8gYGlgIGNhbiBiZSBvdXQgb2YgYm91bmQgd2hlbiB0aGUgZGlmZiBoYXMgbm90IGJlZW4gdXBkYXRlZCB5ZXQuXG5cdFx0XHRcdFx0XHRcdC8vIEluIHRoaXMgY2FzZSwgd2UgZG8gYW4gZWFybHkgcmV0dXJuLlxuXHRcdFx0XHRcdFx0XHQvLyBUT0RPQGhlZGlldDogRml4IHRoaXMgYnkgYXBwbHlpbmcgdGhlIGVkaXQgZGlyZWN0bHkgdG8gdGhlIGRpZmYgbW9kZWwsIHNvIHRoYXQgdGhlIGRpZmYgaXMgYWx3YXlzIHZhbGlkLlxuXHRcdFx0XHRcdFx0XHRpZiAoaSA+IG9yaWdpbmFsTW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBvcmlnOiBvcmlnVmlld1pvbmVzLCBtb2Q6IG1vZFZpZXdab25lcyB9O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRlbGV0ZWRDb2RlTGluZUJyZWFrc0NvbXB1dGVyPy5hZGRSZXF1ZXN0KG9yaWdpbmFsTW9kZWwuZ2V0TGluZUNvbnRlbnQoaSksIG51bGwsIG51bGwpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsaW5lQnJlYWtEYXRhID0gZGVsZXRlZENvZGVMaW5lQnJlYWtzQ29tcHV0ZXI/LmZpbmFsaXplKCkgPz8gW107XG5cdFx0XHRsZXQgbGluZUJyZWFrRGF0YUlkeCA9IDA7XG5cblx0XHRcdGNvbnN0IG1vZExpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cblx0XHRcdGNvbnN0IHN5bmNlZE1vdmVkVGV4dCA9IHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcik/Lm1vdmVkVGV4dFRvQ29tcGFyZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGNvbnN0IG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkgPSB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLmdldE1vZGVsKCk/Lm1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkoKSA/PyBmYWxzZTtcblx0XHRcdGNvbnN0IG1pZ2h0Q29udGFpblJUTCA9IHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuZ2V0TW9kZWwoKT8ubWlnaHRDb250YWluUlRMKCkgPz8gZmFsc2U7XG5cdFx0XHRjb25zdCByZW5kZXJPcHRpb25zID0gUmVuZGVyT3B0aW9ucy5mcm9tRWRpdG9yKHRoaXMuX2VkaXRvcnMubW9kaWZpZWQpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGEgb2YgYWxpZ25tZW50c1ZhbCkge1xuXHRcdFx0XHRpZiAoYS5kaWZmICYmICFyZW5kZXJTaWRlQnlTaWRlICYmICghdGhpcy5fb3B0aW9ucy51c2VUcnVlSW5saW5lRGlmZlJlbmRlcmluZy5yZWFkKHJlYWRlcikgfHwgIWFsbG93c1RydWVJbmxpbmVEaWZmUmVuZGVyaW5nKGEuZGlmZikpKSB7XG5cdFx0XHRcdFx0aWYgKCFhLm9yaWdpbmFsUmFuZ2UuaXNFbXB0eSkge1xuXHRcdFx0XHRcdFx0b3JpZ2luYWxNb2RlbFRva2VuaXphdGlvbkNvbXBsZXRlZC5yZWFkKHJlYWRlcik7IC8vIFVwZGF0ZSB2aWV3LXpvbmVzIG9uY2UgdG9rZW5pemF0aW9uIGNvbXBsZXRlc1xuXG5cdFx0XHRcdFx0XHRjb25zdCBkZWxldGVkQ29kZURvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRcdGRlbGV0ZWRDb2RlRG9tTm9kZS5jbGFzc0xpc3QuYWRkKCd2aWV3LWxpbmVzJywgJ2xpbmUtZGVsZXRlJywgJ21vbmFjby1tb3VzZS1jdXJzb3ItdGV4dCcpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxNb2RlbCA9IHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdFx0XHQvLyBgYS5vcmlnaW5hbFJhbmdlYCBjYW4gYmUgb3V0IG9mIGJvdW5kIHdoZW4gdGhlIGRpZmYgaGFzIG5vdCBiZWVuIHVwZGF0ZWQgeWV0LlxuXHRcdFx0XHRcdFx0Ly8gSW4gdGhpcyBjYXNlLCB3ZSBkbyBhbiBlYXJseSByZXR1cm4uXG5cdFx0XHRcdFx0XHQvLyBUT0RPQGhlZGlldDogRml4IHRoaXMgYnkgYXBwbHlpbmcgdGhlIGVkaXQgZGlyZWN0bHkgdG8gdGhlIGRpZmYgbW9kZWwsIHNvIHRoYXQgdGhlIGRpZmYgaXMgYWx3YXlzIHZhbGlkLlxuXHRcdFx0XHRcdFx0aWYgKGEub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSA+IG9yaWdpbmFsTW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHsgb3JpZzogb3JpZ1ZpZXdab25lcywgbW9kOiBtb2RWaWV3Wm9uZXMgfTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IHNvdXJjZSA9IG5ldyBMaW5lU291cmNlKFxuXHRcdFx0XHRcdFx0XHRhLm9yaWdpbmFsUmFuZ2UubWFwVG9MaW5lQXJyYXkobCA9PiBvcmlnaW5hbE1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGwpKSxcblx0XHRcdFx0XHRcdFx0YS5vcmlnaW5hbFJhbmdlLm1hcFRvTGluZUFycmF5KF8gPT4gbGluZUJyZWFrRGF0YVtsaW5lQnJlYWtEYXRhSWR4KytdKSxcblx0XHRcdFx0XHRcdFx0bWlnaHRDb250YWluTm9uQmFzaWNBU0NJSSxcblx0XHRcdFx0XHRcdFx0bWlnaHRDb250YWluUlRMLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zOiBJbmxpbmVEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgaSBvZiBhLmRpZmYuaW5uZXJDaGFuZ2VzIHx8IFtdKSB7XG5cdFx0XHRcdFx0XHRcdGRlY29yYXRpb25zLnB1c2gobmV3IElubGluZURlY29yYXRpb24oXG5cdFx0XHRcdFx0XHRcdFx0aS5vcmlnaW5hbFJhbmdlLmRlbHRhKC0oYS5kaWZmLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciAtIDEpKSxcblx0XHRcdFx0XHRcdFx0XHRkaWZmRGVsZXRlRGVjb3JhdGlvbi5jbGFzc05hbWUhLFxuXHRcdFx0XHRcdFx0XHRcdElubGluZURlY29yYXRpb25UeXBlLlJlZ3VsYXJcblx0XHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSByZW5kZXJMaW5lcyhzb3VyY2UsIHJlbmRlck9wdGlvbnMsIGRlY29yYXRpb25zLCBkZWxldGVkQ29kZURvbU5vZGUpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBtYXJnaW5Eb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0XHRtYXJnaW5Eb21Ob2RlLmNsYXNzTmFtZSA9ICdpbmxpbmUtZGVsZXRlZC1tYXJnaW4tdmlldy16b25lJztcblx0XHRcdFx0XHRcdGFwcGx5Rm9udEluZm8obWFyZ2luRG9tTm9kZSwgcmVuZGVyT3B0aW9ucy5mb250SW5mbyk7XG5cblx0XHRcdFx0XHRcdGlmICh0aGlzLl9vcHRpb25zLnJlbmRlckluZGljYXRvcnMucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0LmhlaWdodEluTGluZXM7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1hcmdpbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRcdFx0XHRtYXJnaW5FbGVtZW50LmNsYXNzTmFtZSA9IGBkZWxldGUtc2lnbiAke1RoZW1lSWNvbi5hc0NsYXNzTmFtZShkaWZmUmVtb3ZlSWNvbil9YDtcblx0XHRcdFx0XHRcdFx0XHRtYXJnaW5FbGVtZW50LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCBgcG9zaXRpb246YWJzb2x1dGU7dG9wOiR7aSAqIG1vZExpbmVIZWlnaHR9cHg7d2lkdGg6JHtyZW5kZXJPcHRpb25zLmxpbmVEZWNvcmF0aW9uc1dpZHRofXB4O2hlaWdodDoke21vZExpbmVIZWlnaHR9cHg7cmlnaHQ6MDtgKTtcblx0XHRcdFx0XHRcdFx0XHRtYXJnaW5Eb21Ob2RlLmFwcGVuZENoaWxkKG1hcmdpbkVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGxldCB6b25lSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdGFsaWdubWVudFZpZXdab25lc0Rpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHRcdFx0bmV3IElubGluZURpZmZEZWxldGVkQ29kZU1hcmdpbihcblx0XHRcdFx0XHRcdFx0XHQoKSA9PiBhc3NlcnRJc0RlZmluZWQoem9uZUlkKSxcblx0XHRcdFx0XHRcdFx0XHRtYXJnaW5Eb21Ob2RlLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQsXG5cdFx0XHRcdFx0XHRcdFx0YS5kaWZmLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2RpZmZFZGl0b3JXaWRnZXQsXG5cdFx0XHRcdFx0XHRcdFx0cmVzdWx0LnZpZXdMaW5lQ291bnRzLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuZ2V0TW9kZWwoKSEsXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2NsaXBib2FyZFNlcnZpY2UsXG5cdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0LnZpZXdMaW5lQ291bnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvdW50ID0gcmVzdWx0LnZpZXdMaW5lQ291bnRzW2ldO1xuXHRcdFx0XHRcdFx0XHQvLyBBY2NvdW50IGZvciB3cmFwcGVkIGxpbmVzIGluIHRoZSAoY29sbGFwc2VkKSBvcmlnaW5hbCBlZGl0b3IgKHdoaWNoIGRvZXNuJ3Qgd3JhcCBsaW5lcykuXG5cdFx0XHRcdFx0XHRcdGlmIChjb3VudCA+IDEpIHtcblx0XHRcdFx0XHRcdFx0XHRvcmlnVmlld1pvbmVzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiBhLm9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgaSxcblx0XHRcdFx0XHRcdFx0XHRcdGRvbU5vZGU6IGNyZWF0ZUZha2VMaW5lc0RpdigpLFxuXHRcdFx0XHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogKGNvdW50IC0gMSkgKiBtb2RMaW5lSGVpZ2h0LFxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRzdXBwcmVzc01vdXNlRG93bjogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRtb2RWaWV3Wm9uZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdGFmdGVyTGluZU51bWJlcjogYS5tb2RpZmllZFJhbmdlLnN0YXJ0TGluZU51bWJlciAtIDEsXG5cdFx0XHRcdFx0XHRcdGRvbU5vZGU6IGRlbGV0ZWRDb2RlRG9tTm9kZSxcblx0XHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogcmVzdWx0LmhlaWdodEluTGluZXMgKiBtb2RMaW5lSGVpZ2h0LFxuXHRcdFx0XHRcdFx0XHRtaW5XaWR0aEluUHg6IHJlc3VsdC5taW5XaWR0aEluUHgsXG5cdFx0XHRcdFx0XHRcdG1hcmdpbkRvbU5vZGUsXG5cdFx0XHRcdFx0XHRcdHNldFpvbmVJZChpZCkgeyB6b25lSWQgPSBpZDsgfSxcblx0XHRcdFx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgbWFyZ2luRG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdG1hcmdpbkRvbU5vZGUuY2xhc3NOYW1lID0gJ2d1dHRlci1kZWxldGUnO1xuXG5cdFx0XHRcdFx0b3JpZ1ZpZXdab25lcy5wdXNoKHtcblx0XHRcdFx0XHRcdGFmdGVyTGluZU51bWJlcjogYS5vcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogY3JlYXRlRmFrZUxpbmVzRGl2KCksXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiBhLm1vZGlmaWVkSGVpZ2h0SW5QeCxcblx0XHRcdFx0XHRcdG1hcmdpbkRvbU5vZGUsXG5cdFx0XHRcdFx0XHRzaG93SW5IaWRkZW5BcmVhczogdHJ1ZSxcblx0XHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGRlbHRhID0gYS5tb2RpZmllZEhlaWdodEluUHggLSBhLm9yaWdpbmFsSGVpZ2h0SW5QeDtcblx0XHRcdFx0XHRpZiAoZGVsdGEgPiAwKSB7XG5cdFx0XHRcdFx0XHRpZiAoc3luY2VkTW92ZWRUZXh0Py5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmRlbHRhKC0xKS5kZWx0YUxlbmd0aCgyKS5jb250YWlucyhhLm9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIDEpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRvcmlnVmlld1pvbmVzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IGEub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSxcblx0XHRcdFx0XHRcdFx0ZG9tTm9kZTogY3JlYXRlRmFrZUxpbmVzRGl2KCksXG5cdFx0XHRcdFx0XHRcdGhlaWdodEluUHg6IGRlbHRhLFxuXHRcdFx0XHRcdFx0XHRzaG93SW5IaWRkZW5BcmVhczogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0c3VwcHJlc3NNb3VzZURvd246IHRydWUsXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKHN5bmNlZE1vdmVkVGV4dD8ubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5kZWx0YSgtMSkuZGVsdGFMZW5ndGgoMikuY29udGFpbnMoYS5tb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxKSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gY3JlYXRlVmlld1pvbmVNYXJnaW5BcnJvdygpOiBIVE1MRWxlbWVudCB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0XHRcdGFycm93LmNsYXNzTmFtZSA9ICdhcnJvdy1yZXZlcnQtY2hhbmdlICcgKyBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5hcnJvd1JpZ2h0KTtcblx0XHRcdFx0XHRcdFx0c3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihhcnJvdywgJ21vdXNlZG93bicsIGUgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSkpO1xuXHRcdFx0XHRcdFx0XHRzdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGFycm93LCAnY2xpY2snLCBlID0+IHtcblx0XHRcdFx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRcdF9kaWZmRWRpdG9yV2lkZ2V0LnJldmVydChhLmRpZmYhKTtcblx0XHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gJCgnZGl2Jywge30sIGFycm93KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bGV0IG1hcmdpbkRvbU5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0aWYgKGEuZGlmZiAmJiBhLmRpZmYubW9kaWZpZWQuaXNFbXB0eSAmJiB0aGlzLl9vcHRpb25zLnNob3VsZFJlbmRlck9sZFJldmVydEFycm93cy5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0XHRcdFx0bWFyZ2luRG9tTm9kZSA9IGNyZWF0ZVZpZXdab25lTWFyZ2luQXJyb3coKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bW9kVmlld1pvbmVzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IGEubW9kaWZpZWRSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSxcblx0XHRcdFx0XHRcdFx0ZG9tTm9kZTogY3JlYXRlRmFrZUxpbmVzRGl2KCksXG5cdFx0XHRcdFx0XHRcdGhlaWdodEluUHg6IC1kZWx0YSxcblx0XHRcdFx0XHRcdFx0bWFyZ2luRG9tTm9kZSxcblx0XHRcdFx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgYSBvZiBhbGlnbm1lbnRzU3luY2VkTW92ZWRUZXh0LnJlYWQocmVhZGVyKSA/PyBbXSkge1xuXHRcdFx0XHRpZiAoIXN5bmNlZE1vdmVkVGV4dD8ubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC5pbnRlcnNlY3QoYS5vcmlnaW5hbFJhbmdlKVxuXHRcdFx0XHRcdHx8ICFzeW5jZWRNb3ZlZFRleHQ/LmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQuaW50ZXJzZWN0KGEubW9kaWZpZWRSYW5nZSkpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmUgdW5yZWxhdGVkIGFsaWdubWVudHMgb3V0c2lkZSB0aGUgc3luY2VkIG1vdmVkIHRleHRcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGRlbHRhID0gYS5tb2RpZmllZEhlaWdodEluUHggLSBhLm9yaWdpbmFsSGVpZ2h0SW5QeDtcblx0XHRcdFx0aWYgKGRlbHRhID4gMCkge1xuXHRcdFx0XHRcdG9yaWdWaWV3Wm9uZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IGEub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSxcblx0XHRcdFx0XHRcdGRvbU5vZGU6IGNyZWF0ZUZha2VMaW5lc0RpdigpLFxuXHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogZGVsdGEsXG5cdFx0XHRcdFx0XHRzaG93SW5IaWRkZW5BcmVhczogdHJ1ZSxcblx0XHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG1vZFZpZXdab25lcy5wdXNoKHtcblx0XHRcdFx0XHRcdGFmdGVyTGluZU51bWJlcjogYS5tb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogY3JlYXRlRmFrZUxpbmVzRGl2KCksXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiAtZGVsdGEsXG5cdFx0XHRcdFx0XHRzaG93SW5IaWRkZW5BcmVhczogdHJ1ZSxcblx0XHRcdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiB0cnVlLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7IG9yaWc6IG9yaWdWaWV3Wm9uZXMsIG1vZDogbW9kVmlld1pvbmVzIH07XG5cdFx0fSk7XG5cblx0XHRsZXQgaWdub3JlQ2hhbmdlID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5vbkRpZFNjcm9sbENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLnNjcm9sbExlZnRDaGFuZ2VkICYmICFpZ25vcmVDaGFuZ2UpIHtcblx0XHRcdFx0aWdub3JlQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5zZXRTY3JvbGxMZWZ0KGUuc2Nyb2xsTGVmdCk7XG5cdFx0XHRcdGlnbm9yZUNoYW5nZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkU2Nyb2xsQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuc2Nyb2xsTGVmdENoYW5nZWQgJiYgIWlnbm9yZUNoYW5nZSkge1xuXHRcdFx0XHRpZ25vcmVDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLnNldFNjcm9sbExlZnQoZS5zY3JvbGxMZWZ0KTtcblx0XHRcdFx0aWdub3JlQ2hhbmdlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fb3JpZ2luYWxTY3JvbGxUb3AgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25EaWRTY3JvbGxDaGFuZ2UsICgpID0+IC8qKiBAZGVzY3JpcHRpb24gb3JpZ2luYWwuZ2V0U2Nyb2xsVG9wICovIHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuZ2V0U2Nyb2xsVG9wKCkpO1xuXHRcdHRoaXMuX21vZGlmaWVkU2Nyb2xsVG9wID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLm9uRGlkU2Nyb2xsQ2hhbmdlLCAoKSA9PiAvKiogQGRlc2NyaXB0aW9uIG1vZGlmaWVkLmdldFNjcm9sbFRvcCAqLyB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldFNjcm9sbFRvcCgpKTtcblxuXHRcdC8vIG9yaWdFeHRyYUhlaWdodCArIG9yaWdPZmZzZXQgLSBvcmlnU2Nyb2xsVG9wID0gbW9kRXh0cmFIZWlnaHQgKyBtb2RPZmZzZXQgLSBtb2RTY3JvbGxUb3BcblxuXHRcdC8vIG9yaWdTY3JvbGxUb3AgPSBvcmlnRXh0cmFIZWlnaHQgKyBvcmlnT2Zmc2V0IC0gbW9kRXh0cmFIZWlnaHQgLSBtb2RPZmZzZXQgKyBtb2RTY3JvbGxUb3Bcblx0XHQvLyBtb2RTY3JvbGxUb3AgPSBtb2RFeHRyYUhlaWdodCArIG1vZE9mZnNldCAtIG9yaWdFeHRyYUhlaWdodCAtIG9yaWdPZmZzZXQgKyBvcmlnU2Nyb2xsVG9wXG5cblx0XHQvLyBvcmlnT2Zmc2V0IC0gbW9kT2Zmc2V0ID0gaGVpZ2h0T2ZMaW5lcygxLi5ZKSAtIGhlaWdodE9mTGluZXMoMS4uWClcblx0XHQvLyBvcmlnU2Nyb2xsVG9wID49IDAsIG1vZFNjcm9sbFRvcCA+PSAwXG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBzY3JvbGwgbW9kaWZpZWQgKi9cblx0XHRcdGNvbnN0IG5ld1Njcm9sbFRvcE1vZGlmaWVkID0gdGhpcy5fb3JpZ2luYWxTY3JvbGxUb3AucmVhZChyZWFkZXIpXG5cdFx0XHRcdC0gKHRoaXMuX29yaWdpbmFsU2Nyb2xsT2Zmc2V0QW5pbWF0ZWQuZ2V0KCkgLSB0aGlzLl9tb2RpZmllZFNjcm9sbE9mZnNldEFuaW1hdGVkLnJlYWQocmVhZGVyKSlcblx0XHRcdFx0LSAodGhpcy5fb3JpZ2luYWxUb3BQYWRkaW5nLmdldCgpIC0gdGhpcy5fbW9kaWZpZWRUb3BQYWRkaW5nLnJlYWQocmVhZGVyKSk7XG5cdFx0XHRpZiAobmV3U2Nyb2xsVG9wTW9kaWZpZWQgIT09IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZ2V0U2Nyb2xsVG9wKCkpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5zZXRTY3JvbGxUb3AobmV3U2Nyb2xsVG9wTW9kaWZpZWQsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBzY3JvbGwgb3JpZ2luYWwgKi9cblx0XHRcdGNvbnN0IG5ld1Njcm9sbFRvcE9yaWdpbmFsID0gdGhpcy5fbW9kaWZpZWRTY3JvbGxUb3AucmVhZChyZWFkZXIpXG5cdFx0XHRcdC0gKHRoaXMuX21vZGlmaWVkU2Nyb2xsT2Zmc2V0QW5pbWF0ZWQuZ2V0KCkgLSB0aGlzLl9vcmlnaW5hbFNjcm9sbE9mZnNldEFuaW1hdGVkLnJlYWQocmVhZGVyKSlcblx0XHRcdFx0LSAodGhpcy5fbW9kaWZpZWRUb3BQYWRkaW5nLmdldCgpIC0gdGhpcy5fb3JpZ2luYWxUb3BQYWRkaW5nLnJlYWQocmVhZGVyKSk7XG5cdFx0XHRpZiAobmV3U2Nyb2xsVG9wT3JpZ2luYWwgIT09IHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuZ2V0U2Nyb2xsVG9wKCkpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5zZXRTY3JvbGxUb3AobmV3U2Nyb2xsVG9wT3JpZ2luYWwsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIGVkaXRvciB0b3Agb2Zmc2V0cyAqL1xuXHRcdFx0Y29uc3QgbSA9IHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcik/Lm1vdmVkVGV4dFRvQ29tcGFyZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGxldCBkZWx0YU9yaWdUb01vZCA9IDA7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHRjb25zdCB0cnVlVG9wT3JpZ2luYWwgPSB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLmdldFRvcEZvckxpbmVOdW1iZXIobS5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciwgdHJ1ZSkgLSB0aGlzLl9vcmlnaW5hbFRvcFBhZGRpbmcuZ2V0KCk7XG5cdFx0XHRcdGNvbnN0IHRydWVUb3BNb2RpZmllZCA9IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZ2V0VG9wRm9yTGluZU51bWJlcihtLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCB0cnVlKSAtIHRoaXMuX21vZGlmaWVkVG9wUGFkZGluZy5nZXQoKTtcblx0XHRcdFx0ZGVsdGFPcmlnVG9Nb2QgPSB0cnVlVG9wTW9kaWZpZWQgLSB0cnVlVG9wT3JpZ2luYWw7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkZWx0YU9yaWdUb01vZCA+IDApIHtcblx0XHRcdFx0dGhpcy5fbW9kaWZpZWRUb3BQYWRkaW5nLnNldCgwLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR0aGlzLl9vcmlnaW5hbFRvcFBhZGRpbmcuc2V0KGRlbHRhT3JpZ1RvTW9kLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIGlmIChkZWx0YU9yaWdUb01vZCA8IDApIHtcblx0XHRcdFx0dGhpcy5fbW9kaWZpZWRUb3BQYWRkaW5nLnNldCgtZGVsdGFPcmlnVG9Nb2QsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdHRoaXMuX29yaWdpbmFsVG9wUGFkZGluZy5zZXQoMCwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX21vZGlmaWVkVG9wUGFkZGluZy5zZXQoMCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR0aGlzLl9vcmlnaW5hbFRvcFBhZGRpbmcuc2V0KDAsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0sIDQwMCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmhhc1RleHRGb2N1cygpKSB7XG5cdFx0XHRcdHRoaXMuX29yaWdpbmFsU2Nyb2xsT2Zmc2V0LnNldCh0aGlzLl9tb2RpZmllZFNjcm9sbE9mZnNldC5nZXQoKSAtIGRlbHRhT3JpZ1RvTW9kLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbW9kaWZpZWRTY3JvbGxPZmZzZXQuc2V0KHRoaXMuX29yaWdpbmFsU2Nyb2xsT2Zmc2V0LmdldCgpICsgZGVsdGFPcmlnVG9Nb2QsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJTGluZVJhbmdlQWxpZ25tZW50IHtcblx0b3JpZ2luYWxSYW5nZTogTGluZVJhbmdlO1xuXHRtb2RpZmllZFJhbmdlOiBMaW5lUmFuZ2U7XG5cblx0Ly8gYWNjb3VudHMgZm9yIGZvcmVpZ24gdmlld3pvbmVzIGFuZCBsaW5lIHdyYXBwaW5nXG5cdG9yaWdpbmFsSGVpZ2h0SW5QeDogbnVtYmVyO1xuXHRtb2RpZmllZEhlaWdodEluUHg6IG51bWJlcjtcblxuXHQvKipcblx0ICogSWYgdGhpcyByYW5nZSBhbGlnbm1lbnQgaXMgYSBkaXJlY3QgcmVzdWx0IG9mIGEgZGlmZiwgdGhlbiB0aGlzIGlzIHRoZSBkaWZmJ3MgbGluZSBtYXBwaW5nLlxuXHQgKiBPbmx5IHVzZWQgZm9yIGlubGluZS12aWV3LlxuXHQgKi9cblx0ZGlmZj86IERldGFpbGVkTGluZVJhbmdlTWFwcGluZztcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVJhbmdlQWxpZ25tZW50KFxuXHRvcmlnaW5hbEVkaXRvcjogQ29kZUVkaXRvcldpZGdldCxcblx0bW9kaWZpZWRFZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQsXG5cdGRpZmZzOiByZWFkb25seSBEaWZmTWFwcGluZ1tdLFxuXHRvcmlnaW5hbEVkaXRvckFsaWdubWVudFZpZXdab25lczogUmVhZG9ubHlTZXQ8c3RyaW5nPixcblx0bW9kaWZpZWRFZGl0b3JBbGlnbm1lbnRWaWV3Wm9uZXM6IFJlYWRvbmx5U2V0PHN0cmluZz4sXG5cdGlubmVySHVua0FsaWdubWVudDogYm9vbGVhbixcbik6IElMaW5lUmFuZ2VBbGlnbm1lbnRbXSB7XG5cdGNvbnN0IG9yaWdpbmFsTGluZUhlaWdodE92ZXJyaWRlcyA9IG5ldyBBcnJheVF1ZXVlKGdldEFkZGl0aW9uYWxMaW5lSGVpZ2h0cyhvcmlnaW5hbEVkaXRvciwgb3JpZ2luYWxFZGl0b3JBbGlnbm1lbnRWaWV3Wm9uZXMpKTtcblx0Y29uc3QgbW9kaWZpZWRMaW5lSGVpZ2h0T3ZlcnJpZGVzID0gbmV3IEFycmF5UXVldWUoZ2V0QWRkaXRpb25hbExpbmVIZWlnaHRzKG1vZGlmaWVkRWRpdG9yLCBtb2RpZmllZEVkaXRvckFsaWdubWVudFZpZXdab25lcykpO1xuXG5cdGNvbnN0IG9yaWdMaW5lSGVpZ2h0ID0gb3JpZ2luYWxFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0Y29uc3QgbW9kTGluZUhlaWdodCA9IG1vZGlmaWVkRWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cblx0Y29uc3QgcmVzdWx0OiBJTGluZVJhbmdlQWxpZ25tZW50W10gPSBbXTtcblxuXHRsZXQgbGFzdE9yaWdpbmFsTGluZU51bWJlciA9IDA7XG5cdGxldCBsYXN0TW9kaWZpZWRMaW5lTnVtYmVyID0gMDtcblxuXHRmdW5jdGlvbiBoYW5kbGVBbGlnbm1lbnRzT3V0c2lkZU9mRGlmZnModW50aWxPcmlnaW5hbExpbmVOdW1iZXJFeGNsdXNpdmU6IG51bWJlciwgdW50aWxNb2RpZmllZExpbmVOdW1iZXJFeGNsdXNpdmU6IG51bWJlcikge1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRsZXQgb3JpZ05leHQgPSBvcmlnaW5hbExpbmVIZWlnaHRPdmVycmlkZXMucGVlaygpO1xuXHRcdFx0bGV0IG1vZE5leHQgPSBtb2RpZmllZExpbmVIZWlnaHRPdmVycmlkZXMucGVlaygpO1xuXHRcdFx0aWYgKG9yaWdOZXh0ICYmIG9yaWdOZXh0LmxpbmVOdW1iZXIgPj0gdW50aWxPcmlnaW5hbExpbmVOdW1iZXJFeGNsdXNpdmUpIHtcblx0XHRcdFx0b3JpZ05leHQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAobW9kTmV4dCAmJiBtb2ROZXh0LmxpbmVOdW1iZXIgPj0gdW50aWxNb2RpZmllZExpbmVOdW1iZXJFeGNsdXNpdmUpIHtcblx0XHRcdFx0bW9kTmV4dCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmICghb3JpZ05leHQgJiYgIW1vZE5leHQpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRpc3RPcmlnID0gb3JpZ05leHQgPyBvcmlnTmV4dC5saW5lTnVtYmVyIC0gbGFzdE9yaWdpbmFsTGluZU51bWJlciA6IE51bWJlci5NQVhfVkFMVUU7XG5cdFx0XHRjb25zdCBkaXN0TmV4dCA9IG1vZE5leHQgPyBtb2ROZXh0LmxpbmVOdW1iZXIgLSBsYXN0TW9kaWZpZWRMaW5lTnVtYmVyIDogTnVtYmVyLk1BWF9WQUxVRTtcblxuXHRcdFx0aWYgKGRpc3RPcmlnIDwgZGlzdE5leHQpIHtcblx0XHRcdFx0b3JpZ2luYWxMaW5lSGVpZ2h0T3ZlcnJpZGVzLmRlcXVldWUoKTtcblx0XHRcdFx0bW9kTmV4dCA9IHtcblx0XHRcdFx0XHRsaW5lTnVtYmVyOiBvcmlnTmV4dCEubGluZU51bWJlciAtIGxhc3RPcmlnaW5hbExpbmVOdW1iZXIgKyBsYXN0TW9kaWZpZWRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGhlaWdodEluUHg6IDAsXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKGRpc3RPcmlnID4gZGlzdE5leHQpIHtcblx0XHRcdFx0bW9kaWZpZWRMaW5lSGVpZ2h0T3ZlcnJpZGVzLmRlcXVldWUoKTtcblx0XHRcdFx0b3JpZ05leHQgPSB7XG5cdFx0XHRcdFx0bGluZU51bWJlcjogbW9kTmV4dCEubGluZU51bWJlciAtIGxhc3RNb2RpZmllZExpbmVOdW1iZXIgKyBsYXN0T3JpZ2luYWxMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGhlaWdodEluUHg6IDAsXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcmlnaW5hbExpbmVIZWlnaHRPdmVycmlkZXMuZGVxdWV1ZSgpO1xuXHRcdFx0XHRtb2RpZmllZExpbmVIZWlnaHRPdmVycmlkZXMuZGVxdWV1ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdG9yaWdpbmFsUmFuZ2U6IExpbmVSYW5nZS5vZkxlbmd0aChvcmlnTmV4dCEubGluZU51bWJlciwgMSksXG5cdFx0XHRcdG1vZGlmaWVkUmFuZ2U6IExpbmVSYW5nZS5vZkxlbmd0aChtb2ROZXh0IS5saW5lTnVtYmVyLCAxKSxcblx0XHRcdFx0b3JpZ2luYWxIZWlnaHRJblB4OiBvcmlnTGluZUhlaWdodCArIG9yaWdOZXh0IS5oZWlnaHRJblB4LFxuXHRcdFx0XHRtb2RpZmllZEhlaWdodEluUHg6IG1vZExpbmVIZWlnaHQgKyBtb2ROZXh0IS5oZWlnaHRJblB4LFxuXHRcdFx0XHRkaWZmOiB1bmRlZmluZWQsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRmb3IgKGNvbnN0IG0gb2YgZGlmZnMpIHtcblx0XHRjb25zdCBjID0gbS5saW5lUmFuZ2VNYXBwaW5nO1xuXHRcdGhhbmRsZUFsaWdubWVudHNPdXRzaWRlT2ZEaWZmcyhjLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciwgYy5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0bGV0IGZpcnN0ID0gdHJ1ZTtcblx0XHRsZXQgbGFzdE1vZExpbmVOdW1iZXIgPSBjLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcjtcblx0XHRsZXQgbGFzdE9yaWdMaW5lTnVtYmVyID0gYy5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXI7XG5cblx0XHRmdW5jdGlvbiBlbWl0QWxpZ25tZW50KG9yaWdMaW5lTnVtYmVyRXhjbHVzaXZlOiBudW1iZXIsIG1vZExpbmVOdW1iZXJFeGNsdXNpdmU6IG51bWJlciwgZm9yY2VBbGlnbm1lbnQgPSBmYWxzZSkge1xuXHRcdFx0aWYgKG9yaWdMaW5lTnVtYmVyRXhjbHVzaXZlIDwgbGFzdE9yaWdMaW5lTnVtYmVyIHx8IG1vZExpbmVOdW1iZXJFeGNsdXNpdmUgPCBsYXN0TW9kTGluZU51bWJlcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZmlyc3QpIHtcblx0XHRcdFx0Zmlyc3QgPSBmYWxzZTtcblx0XHRcdH0gZWxzZSBpZiAoIWZvcmNlQWxpZ25tZW50ICYmIChvcmlnTGluZU51bWJlckV4Y2x1c2l2ZSA9PT0gbGFzdE9yaWdMaW5lTnVtYmVyIHx8IG1vZExpbmVOdW1iZXJFeGNsdXNpdmUgPT09IGxhc3RNb2RMaW5lTnVtYmVyKSkge1xuXHRcdFx0XHQvLyBUaGlzIGNhdXNlcyBhIHJlLWFsaWdubWVudCBvZiBhbiBhbHJlYWR5IGFsaWduZWQgbGluZS5cblx0XHRcdFx0Ly8gSG93ZXZlciwgd2UgZG9uJ3QgY2FyZSBmb3IgdGhlIGZpbmFsIGFsaWdubWVudC5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgb3JpZ2luYWxSYW5nZSA9IG5ldyBMaW5lUmFuZ2UobGFzdE9yaWdMaW5lTnVtYmVyLCBvcmlnTGluZU51bWJlckV4Y2x1c2l2ZSk7XG5cdFx0XHRjb25zdCBtb2RpZmllZFJhbmdlID0gbmV3IExpbmVSYW5nZShsYXN0TW9kTGluZU51bWJlciwgbW9kTGluZU51bWJlckV4Y2x1c2l2ZSk7XG5cdFx0XHRpZiAob3JpZ2luYWxSYW5nZS5pc0VtcHR5ICYmIG1vZGlmaWVkUmFuZ2UuaXNFbXB0eSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsQWRkaXRpb25hbEhlaWdodCA9IG9yaWdpbmFsTGluZUhlaWdodE92ZXJyaWRlc1xuXHRcdFx0XHQudGFrZVdoaWxlKHYgPT4gdi5saW5lTnVtYmVyIDwgb3JpZ0xpbmVOdW1iZXJFeGNsdXNpdmUpXG5cdFx0XHRcdD8ucmVkdWNlKChwLCBjKSA9PiBwICsgYy5oZWlnaHRJblB4LCAwKSA/PyAwO1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRBZGRpdGlvbmFsSGVpZ2h0ID0gbW9kaWZpZWRMaW5lSGVpZ2h0T3ZlcnJpZGVzXG5cdFx0XHRcdC50YWtlV2hpbGUodiA9PiB2LmxpbmVOdW1iZXIgPCBtb2RMaW5lTnVtYmVyRXhjbHVzaXZlKVxuXHRcdFx0XHQ/LnJlZHVjZSgocCwgYykgPT4gcCArIGMuaGVpZ2h0SW5QeCwgMCkgPz8gMDtcblxuXHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRvcmlnaW5hbFJhbmdlLFxuXHRcdFx0XHRtb2RpZmllZFJhbmdlLFxuXHRcdFx0XHRvcmlnaW5hbEhlaWdodEluUHg6IG9yaWdpbmFsUmFuZ2UubGVuZ3RoICogb3JpZ0xpbmVIZWlnaHQgKyBvcmlnaW5hbEFkZGl0aW9uYWxIZWlnaHQsXG5cdFx0XHRcdG1vZGlmaWVkSGVpZ2h0SW5QeDogbW9kaWZpZWRSYW5nZS5sZW5ndGggKiBtb2RMaW5lSGVpZ2h0ICsgbW9kaWZpZWRBZGRpdGlvbmFsSGVpZ2h0LFxuXHRcdFx0XHRkaWZmOiBtLmxpbmVSYW5nZU1hcHBpbmcsXG5cdFx0XHR9KTtcblxuXHRcdFx0bGFzdE9yaWdMaW5lTnVtYmVyID0gb3JpZ0xpbmVOdW1iZXJFeGNsdXNpdmU7XG5cdFx0XHRsYXN0TW9kTGluZU51bWJlciA9IG1vZExpbmVOdW1iZXJFeGNsdXNpdmU7XG5cdFx0fVxuXG5cdFx0aWYgKGlubmVySHVua0FsaWdubWVudCkge1xuXHRcdFx0Zm9yIChjb25zdCBpIG9mIGMuaW5uZXJDaGFuZ2VzIHx8IFtdKSB7XG5cdFx0XHRcdGlmIChpLm9yaWdpbmFsUmFuZ2Uuc3RhcnRDb2x1bW4gPiAxICYmIGkubW9kaWZpZWRSYW5nZS5zdGFydENvbHVtbiA+IDEpIHtcblx0XHRcdFx0XHQvLyBUaGVyZSBpcyBzb21lIHVubW9kaWZpZWQgdGV4dCBvbiB0aGlzIGxpbmUgYmVmb3JlIHRoZSBkaWZmXG5cdFx0XHRcdFx0ZW1pdEFsaWdubWVudChpLm9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBpLm1vZGlmaWVkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBvcmlnaW5hbE1vZGVsID0gb3JpZ2luYWxFZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRcdC8vIFdoZW4gdGhlIGRpZmYgaXMgaW52YWxpZCwgdGhlIHJhbmdlcyBtaWdodCBiZSBvdXQgb2YgYm91bmRzICh0aGlzIHNob3VsZCBiZSBmaXhlZCBpbiB0aGUgZGlmZiBtb2RlbCBieSBhcHBseWluZyBlZGl0cyBkaXJlY3RseSkuXG5cdFx0XHRcdGNvbnN0IG1heENvbHVtbiA9IGkub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyIDw9IG9yaWdpbmFsTW9kZWwuZ2V0TGluZUNvdW50KCkgPyBvcmlnaW5hbE1vZGVsLmdldExpbmVNYXhDb2x1bW4oaS5vcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXIpIDogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cdFx0XHRcdGlmIChpLm9yaWdpbmFsUmFuZ2UuZW5kQ29sdW1uIDwgbWF4Q29sdW1uKSB7XG5cdFx0XHRcdFx0Ly8gLy8gVGhlcmUgaXMgc29tZSB1bm1vZGlmaWVkIHRleHQgb24gdGhpcyBsaW5lIGFmdGVyIHRoZSBkaWZmXG5cdFx0XHRcdFx0ZW1pdEFsaWdubWVudChpLm9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlciwgaS5tb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZW1pdEFsaWdubWVudChjLm9yaWdpbmFsLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUsIGMubW9kaWZpZWQuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSwgdHJ1ZSk7XG5cblx0XHRsYXN0T3JpZ2luYWxMaW5lTnVtYmVyID0gYy5vcmlnaW5hbC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlO1xuXHRcdGxhc3RNb2RpZmllZExpbmVOdW1iZXIgPSBjLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmU7XG5cdH1cblx0aGFuZGxlQWxpZ25tZW50c091dHNpZGVPZkRpZmZzKE51bWJlci5NQVhfVkFMVUUsIE51bWJlci5NQVhfVkFMVUUpO1xuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmludGVyZmFjZSBBZGRpdGlvbmFsTGluZUhlaWdodEluZm8ge1xuXHRsaW5lTnVtYmVyOiBudW1iZXI7XG5cdGhlaWdodEluUHg6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gZ2V0QWRkaXRpb25hbExpbmVIZWlnaHRzKGVkaXRvcjogQ29kZUVkaXRvcldpZGdldCwgdmlld1pvbmVzVG9JZ25vcmU6IFJlYWRvbmx5U2V0PHN0cmluZz4pOiByZWFkb25seSBBZGRpdGlvbmFsTGluZUhlaWdodEluZm9bXSB7XG5cdGNvbnN0IHZpZXdab25lSGVpZ2h0czogeyBsaW5lTnVtYmVyOiBudW1iZXI7IGhlaWdodEluUHg6IG51bWJlciB9W10gPSBbXTtcblx0Y29uc3Qgd3JhcHBpbmdab25lSGVpZ2h0czogeyBsaW5lTnVtYmVyOiBudW1iZXI7IGhlaWdodEluUHg6IG51bWJlciB9W10gPSBbXTtcblxuXHRjb25zdCBoYXNXcmFwcGluZyA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbykud3JhcHBpbmdDb2x1bW4gIT09IC0xO1xuXHRjb25zdCBjb29yZGluYXRlc0NvbnZlcnRlciA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCkhLmNvb3JkaW5hdGVzQ29udmVydGVyO1xuXHRjb25zdCBlZGl0b3JMaW5lSGVpZ2h0ID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdGlmIChoYXNXcmFwcGluZykge1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDw9IGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ291bnQoKTsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSBjb29yZGluYXRlc0NvbnZlcnRlci5nZXRNb2RlbExpbmVWaWV3TGluZUNvdW50KGkpO1xuXHRcdFx0aWYgKGxpbmVDb3VudCA+IDEpIHtcblx0XHRcdFx0d3JhcHBpbmdab25lSGVpZ2h0cy5wdXNoKHsgbGluZU51bWJlcjogaSwgaGVpZ2h0SW5QeDogZWRpdG9yTGluZUhlaWdodCAqIChsaW5lQ291bnQgLSAxKSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmb3IgKGNvbnN0IHcgb2YgZWRpdG9yLmdldFdoaXRlc3BhY2VzKCkpIHtcblx0XHRpZiAodmlld1pvbmVzVG9JZ25vcmUuaGFzKHcuaWQpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Y29uc3QgbW9kZWxMaW5lTnVtYmVyID0gdy5hZnRlckxpbmVOdW1iZXIgPT09IDAgPyAwIDogY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihcblx0XHRcdG5ldyBQb3NpdGlvbih3LmFmdGVyTGluZU51bWJlciwgMSlcblx0XHQpLmxpbmVOdW1iZXI7XG5cdFx0dmlld1pvbmVIZWlnaHRzLnB1c2goeyBsaW5lTnVtYmVyOiBtb2RlbExpbmVOdW1iZXIsIGhlaWdodEluUHg6IHcuaGVpZ2h0IH0pO1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0ID0gam9pbkNvbWJpbmUoXG5cdFx0dmlld1pvbmVIZWlnaHRzLFxuXHRcdHdyYXBwaW5nWm9uZUhlaWdodHMsXG5cdFx0diA9PiB2LmxpbmVOdW1iZXIsXG5cdFx0KHYxLCB2MikgPT4gKHsgbGluZU51bWJlcjogdjEubGluZU51bWJlciwgaGVpZ2h0SW5QeDogdjEuaGVpZ2h0SW5QeCArIHYyLmhlaWdodEluUHggfSlcblx0KTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWxsb3dzVHJ1ZUlubGluZURpZmZSZW5kZXJpbmcobWFwcGluZzogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nKTogYm9vbGVhbiB7XG5cdGlmICghbWFwcGluZy5pbm5lckNoYW5nZXMpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cmV0dXJuIG1hcHBpbmcuaW5uZXJDaGFuZ2VzLmV2ZXJ5KGMgPT5cblx0XHQocmFuZ2VJc1NpbmdsZUxpbmUoYy5tb2RpZmllZFJhbmdlKSAmJiByYW5nZUlzU2luZ2xlTGluZShjLm9yaWdpbmFsUmFuZ2UpKVxuXHRcdHx8IGMub3JpZ2luYWxSYW5nZS5lcXVhbHNSYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpXG5cdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZUlzU2luZ2xlTGluZShyYW5nZTogUmFuZ2UpOiBib29sZWFuIHtcblx0cmV0dXJuIHJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gcmFuZ2UuZW5kTGluZU51bWJlcjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxHQUFHLDZCQUE2QjtBQUN6QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFzQixTQUFTLFNBQVMsa0JBQWtCLHFCQUFxQix1QkFBdUI7QUFDdEcsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyxzQkFBc0Isc0JBQXNCO0FBRXJELFNBQThCLG1CQUFtQjtBQUVqRCxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLFlBQVksZUFBZSxtQkFBbUI7QUFDdkQsU0FBOEIsb0JBQW9CLG1CQUFtQjtBQUNyRSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGtCQUFrQiw0QkFBNEI7QUFDdkQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxhQUFhO0FBU2YsSUFBTSxzQkFBTixjQUFrQyxXQUFXO0FBQUEsRUFhbkQsWUFDa0IsZUFD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eUIsRUFBRSxTQUFTO0FBQ3BDLDZCQUF5QixFQUFFLFNBQVM7QUFBQSxFQUNyQztBQUNBLGlDQUErQixPQUFPLFdBQVcsT0FBTyxTQUFTO0FBRWpFLFNBQU87QUFDUjtBQU9BLFNBQVMseUJBQXlCLFFBQTBCLG1CQUE2RTtBQUN4SSxRQUFNLGtCQUFnRSxDQUFDO0FBQ3ZFLFFBQU0sc0JBQW9FLENBQUM7QUFFM0UsUUFBTSxjQUFjLE9BQU8sVUFBVSxhQUFhLFlBQVksRUFBRSxtQkFBbUI7QUFDbkYsUUFBTSx1QkFBdUIsT0FBTyxjQUFjLEVBQUc7QUFDckQsUUFBTSxtQkFBbUIsT0FBTyxVQUFVLGFBQWEsVUFBVTtBQUNqRSxNQUFJLGFBQWE7QUFDaEIsYUFBUyxJQUFJLEdBQUcsS0FBSyxPQUFPLFNBQVMsRUFBRyxhQUFhLEdBQUcsS0FBSztBQUM1RCxZQUFNLFlBQVkscUJBQXFCLDBCQUEwQixDQUFDO0FBQ2xFLFVBQUksWUFBWSxHQUFHO0FBQ2xCLDRCQUFvQixLQUFLLEVBQUUsWUFBWSxHQUFHLFlBQVksb0JBQW9CLFlBQVksR0FBRyxDQUFDO0FBQUEsTUFDM0Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLGFBQVcsS0FBSyxPQUFPLGVBQWUsR0FBRztBQUN4QyxRQUFJLGtCQUFrQixJQUFJLEVBQUUsRUFBRSxHQUFHO0FBQ2hDO0FBQUEsSUFDRDtBQUNBLFVBQU0sa0JBQWtCLEVBQUUsb0JBQW9CLElBQUksSUFBSSxxQkFBcUI7QUFBQSxNQUMxRSxJQUFJLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQztBQUFBLElBQ2xDLEVBQUU7QUFDRixvQkFBZ0IsS0FBSyxFQUFFLFlBQVksaUJBQWlCLFlBQVksRUFBRSxPQUFPLENBQUM7QUFBQSxFQUMzRTtBQUVBLFFBQU0sU0FBUztBQUFBLElBQ2Q7QUFBQSxJQUNBO0FBQUEsSUFDQSxPQUFLLEVBQUU7QUFBQSxJQUNQLENBQUMsSUFBSSxRQUFRLEVBQUUsWUFBWSxHQUFHLFlBQVksWUFBWSxHQUFHLGFBQWEsR0FBRyxXQUFXO0FBQUEsRUFDckY7QUFFQSxTQUFPO0FBQ1I7QUFFTyxTQUFTLDhCQUE4QixTQUE0QztBQUN6RixNQUFJLENBQUMsUUFBUSxjQUFjO0FBQzFCLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTyxRQUFRLGFBQWE7QUFBQSxJQUFNLE9BQ2hDLGtCQUFrQixFQUFFLGFBQWEsS0FBSyxrQkFBa0IsRUFBRSxhQUFhLEtBQ3JFLEVBQUUsY0FBYyxZQUFZLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxFQUNyRDtBQUNEO0FBRU8sU0FBUyxrQkFBa0IsT0FBdUI7QUFDeEQsU0FBTyxNQUFNLG9CQUFvQixNQUFNO0FBQ3hDOyIsCiAgIm5hbWVzIjogWyJtYXJnaW5Eb21Ob2RlIiwgImNyZWF0ZVZpZXdab25lTWFyZ2luQXJyb3ciLCAiZW1pdEFsaWdubWVudCIsICJjIl0KfQo=
