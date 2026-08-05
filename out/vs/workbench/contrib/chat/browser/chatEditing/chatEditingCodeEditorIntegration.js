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
import "../media/chatEditorController.css";
import { getTotalWidth } from "../../../../../base/browser/dom.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, constObservable, derived, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { themeColorFromId } from "../../../../../base/common/themables.js";
import { MouseTargetType } from "../../../../../editor/browser/editorBrowser.js";
import { observableCodeEditor } from "../../../../../editor/browser/observableCodeEditor.js";
import { AccessibleDiffViewer } from "../../../../../editor/browser/widget/diffEditor/components/accessibleDiffViewer.js";
import { RenderOptions, LineSource, renderLines } from "../../../../../editor/browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { diffAddDecoration, diffWholeLineAddDecoration, diffDeleteDecoration } from "../../../../../editor/browser/widget/diffEditor/registrations.contribution.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { LineRange } from "../../../../../editor/common/core/lineRange.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { MinimapPosition, OverviewRulerLane, TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../../editor/common/model/textModel.js";
import { InlineDecoration, InlineDecorationType } from "../../../../../editor/common/viewModel.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { MenuWorkbenchToolBar, HiddenItemStrategy } from "../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { TextEditorSelectionRevealType } from "../../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorsOrder, isDiffEditorInput } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { overviewRulerModifiedForeground, minimapGutterModifiedBackground, overviewRulerAddedForeground, minimapGutterAddedBackground, overviewRulerDeletedForeground, minimapGutterDeletedBackground } from "../../../scm/common/quickDiff.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { WorkingSetEntryState } from "../../common/chatEditingService.js";
import { isTextDiffEditorForEntry } from "./chatEditing.js";
import { ChatAgentLocation } from "../../common/constants.js";
let ChatEditingCodeEditorIntegration = class {
  constructor(_entry, _editor, documentDiffInfo, _chatAgentService, _editorService, _accessibilitySignalsService, instantiationService) {
    this._entry = _entry;
    this._editor = _editor;
    this._chatAgentService = _chatAgentService;
    this._editorService = _editorService;
    this._accessibilitySignalsService = _accessibilitySignalsService;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this._store = new DisposableStore();
    this._diffHunksRenderStore = this._store.add(new DisposableStore());
    this._diffHunkWidgets = [];
    this._viewZones = [];
    this._accessibleDiffViewVisible = observableValue(this, false);
    this._diffLineDecorations = _editor.createDecorationsCollection();
    const codeEditorObs = observableCodeEditor(_editor);
    this._diffLineDecorations = this._editor.createDecorationsCollection();
    this._diffVisualDecorations = this._editor.createDecorationsCollection();
    const enabledObs = derived((r) => {
      if (!isEqual(codeEditorObs.model.read(r)?.uri, documentDiffInfo.read(r).modifiedModel.uri)) {
        return false;
      }
      if (this._editor.getOption(EditorOption.inDiffEditor) && !instantiationService.invokeFunction(isTextDiffEditorForEntry, _entry, this._editor)) {
        return false;
      }
      return true;
    });
    this._store.add(autorun((r) => {
      if (!enabledObs.read(r)) {
        this._diffLineDecorations.clear();
        return;
      }
      const data = [];
      const diff = documentDiffInfo.read(r);
      for (const diffEntry of diff.changes) {
        data.push({
          range: diffEntry.modified.toInclusiveRange() ?? new Range(diffEntry.modified.startLineNumber, 1, diffEntry.modified.startLineNumber, Number.MAX_SAFE_INTEGER),
          options: ChatEditingCodeEditorIntegration._diffLineDecorationData
        });
      }
      this._diffLineDecorations.set(data);
    }));
    let lastModifyingRequestId;
    this._store.add(autorun((r) => {
      if (enabledObs.read(r) && !_entry.isCurrentlyBeingModifiedBy.read(r) && lastModifyingRequestId !== _entry.lastModifyingRequestId && !documentDiffInfo.read(r).identical) {
        lastModifyingRequestId = _entry.lastModifyingRequestId;
        const position = _editor.getPosition() ?? new Position(1, 1);
        const ranges = this._diffLineDecorations.getRanges();
        let initialIndex = ranges.findIndex((r2) => r2.containsPosition(position));
        if (initialIndex < 0) {
          initialIndex = 0;
          for (; initialIndex < ranges.length - 1; initialIndex++) {
            const range = ranges[initialIndex];
            if (range.endLineNumber >= position.lineNumber) {
              break;
            }
          }
        }
        this._currentIndex.set(initialIndex, void 0);
        _editor.revealRange(ranges[initialIndex]);
      }
    }));
    this._store.add(autorun((r) => {
      if (!enabledObs.read(r)) {
        this._clearDiffRendering();
        return;
      }
      if (!_entry.isCurrentlyBeingModifiedBy.read(r)) {
        if (!this._editor.getOption(EditorOption.inDiffEditor)) {
          codeEditorObs.getOption(EditorOption.fontInfo).read(r);
          codeEditorObs.getOption(EditorOption.lineHeight).read(r);
          const reviewMode = _entry.reviewMode.read(r);
          const diff = documentDiffInfo.read(r);
          this._updateDiffRendering(diff, reviewMode);
        } else {
          this._clearDiffRendering();
        }
      }
    }));
    this._store.add(autorun((r) => {
      const position = codeEditorObs.positions.read(r)?.at(0);
      if (!position || !enabledObs.read(r)) {
        return;
      }
      const diff = documentDiffInfo.read(r);
      const mapping = diff.changes.find((m) => m.modified.contains(position.lineNumber) || m.modified.isEmpty && m.modified.startLineNumber === position.lineNumber);
      if (mapping?.modified.isEmpty) {
        this._accessibilitySignalsService.playSignal(AccessibilitySignal.diffLineDeleted, { source: "chatEditingEditor.cursorPositionChanged" });
      } else if (mapping?.original.isEmpty) {
        this._accessibilitySignalsService.playSignal(AccessibilitySignal.diffLineInserted, { source: "chatEditingEditor.cursorPositionChanged" });
      } else if (mapping) {
        this._accessibilitySignalsService.playSignal(AccessibilitySignal.diffLineModified, { source: "chatEditingEditor.cursorPositionChanged" });
      }
    }));
    this._store.add(autorunWithStore((r, store) => {
      const visible = this._accessibleDiffViewVisible.read(r);
      if (!visible || !enabledObs.read(r)) {
        return;
      }
      const accessibleDiffWidget = new AccessibleDiffViewContainer();
      _editor.addOverlayWidget(accessibleDiffWidget);
      store.add(toDisposable(() => _editor.removeOverlayWidget(accessibleDiffWidget)));
      store.add(instantiationService.createInstance(
        AccessibleDiffViewer,
        accessibleDiffWidget.getDomNode(),
        enabledObs,
        (visible2, tx) => this._accessibleDiffViewVisible.set(visible2, tx),
        constObservable(true),
        codeEditorObs.layoutInfo.map((v, r2) => v.width),
        codeEditorObs.layoutInfo.map((v, r2) => v.height),
        documentDiffInfo.map((diff) => diff.changes.slice()),
        instantiationService.createInstance(AccessibleDiffViewerModel, documentDiffInfo, _editor)
      ));
    }));
    let actualOptions;
    const restoreActualOptions = () => {
      if (actualOptions !== void 0) {
        this._editor.updateOptions(actualOptions);
        actualOptions = void 0;
      }
    };
    this._store.add(toDisposable(restoreActualOptions));
    const renderAsBeingModified = derived(this, (r) => {
      return enabledObs.read(r) && Boolean(_entry.isCurrentlyBeingModifiedBy.read(r));
    });
    this._store.add(autorun((r) => {
      const value = renderAsBeingModified.read(r);
      if (value) {
        actualOptions ??= {
          readOnly: this._editor.getOption(EditorOption.readOnly),
          stickyScroll: this._editor.getOption(EditorOption.stickyScroll),
          codeLens: this._editor.getOption(EditorOption.codeLens),
          guides: this._editor.getOption(EditorOption.guides)
        };
        this._editor.updateOptions({
          readOnly: true,
          stickyScroll: { enabled: false },
          codeLens: false,
          guides: { indentation: false, bracketPairs: false }
        });
      } else {
        restoreActualOptions();
      }
    }));
  }
  dispose() {
    this._clear();
    this._store.dispose();
  }
  _clear() {
    this._diffLineDecorations.clear();
    this._clearDiffRendering();
    this._currentIndex.set(-1, void 0);
  }
  // ---- diff rendering logic
  _clearDiffRendering() {
    this._editor.changeViewZones((viewZoneChangeAccessor) => {
      for (const id of this._viewZones) {
        viewZoneChangeAccessor.removeZone(id);
      }
    });
    this._viewZones = [];
    this._diffHunksRenderStore.clear();
    this._diffVisualDecorations.clear();
  }
  _updateDiffRendering(diff, reviewMode) {
    const chatDiffAddDecoration = ModelDecorationOptions.createDynamic({
      ...diffAddDecoration,
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const chatDiffWholeLineAddDecoration = ModelDecorationOptions.createDynamic({
      ...diffWholeLineAddDecoration,
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const createOverviewDecoration = (overviewRulerColor, minimapColor) => {
      return ModelDecorationOptions.createDynamic({
        description: "chat-editing-decoration",
        overviewRuler: { color: themeColorFromId(overviewRulerColor), position: OverviewRulerLane.Left },
        minimap: { color: themeColorFromId(minimapColor), position: MinimapPosition.Gutter }
      });
    };
    const modifiedDecoration = createOverviewDecoration(overviewRulerModifiedForeground, minimapGutterModifiedBackground);
    const addedDecoration = createOverviewDecoration(overviewRulerAddedForeground, minimapGutterAddedBackground);
    const deletedDecoration = createOverviewDecoration(overviewRulerDeletedForeground, minimapGutterDeletedBackground);
    this._diffHunksRenderStore.clear();
    this._diffHunkWidgets.length = 0;
    const diffHunkDecorations = [];
    this._editor.changeViewZones((viewZoneChangeAccessor) => {
      for (const id of this._viewZones) {
        viewZoneChangeAccessor.removeZone(id);
      }
      this._viewZones = [];
      const modifiedVisualDecorations = [];
      const mightContainNonBasicASCII = diff.originalModel.mightContainNonBasicASCII();
      const mightContainRTL = diff.originalModel.mightContainRTL();
      const renderOptions = RenderOptions.fromEditor(this._editor);
      const editorLineCount = this._editor.getModel()?.getLineCount();
      for (const diffEntry of diff.changes) {
        const originalRange = diffEntry.original;
        diff.originalModel.tokenization.forceTokenization(Math.max(1, originalRange.endLineNumberExclusive - 1));
        const source = new LineSource(
          originalRange.mapToLineArray((l) => diff.originalModel.tokenization.getLineTokens(l)),
          [],
          mightContainNonBasicASCII,
          mightContainRTL
        );
        const decorations = [];
        if (reviewMode) {
          for (const i of diffEntry.innerChanges || []) {
            decorations.push(new InlineDecoration(
              i.originalRange.delta(-(diffEntry.original.startLineNumber - 1)),
              diffDeleteDecoration.className,
              InlineDecorationType.Regular
            ));
            if (!(i.originalRange.isEmpty() && i.originalRange.startLineNumber === 1 && i.modifiedRange.endLineNumber === editorLineCount) && !i.modifiedRange.isEmpty()) {
              modifiedVisualDecorations.push({
                range: i.modifiedRange,
                options: chatDiffAddDecoration
              });
            }
          }
        }
        const isCreatedContent = decorations.length === 1 && decorations[0].range.isEmpty() && diffEntry.original.startLineNumber === 1;
        if (!diffEntry.modified.isEmpty && !(isCreatedContent && diffEntry.modified.endLineNumberExclusive - 1 === editorLineCount)) {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: chatDiffWholeLineAddDecoration
          });
        }
        if (diffEntry.original.isEmpty) {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: addedDecoration
          });
        } else if (diffEntry.modified.isEmpty) {
          modifiedVisualDecorations.push({
            range: new Range(diffEntry.modified.startLineNumber - 1, 1, diffEntry.modified.startLineNumber, 1),
            options: deletedDecoration
          });
        } else {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: modifiedDecoration
          });
        }
        if (reviewMode) {
          const domNode = document.createElement("div");
          domNode.className = "chat-editing-original-zone view-lines line-delete monaco-mouse-cursor-text";
          const result = renderLines(source, renderOptions, decorations, domNode);
          if (!isCreatedContent) {
            const viewZoneData = {
              afterLineNumber: diffEntry.modified.startLineNumber - 1,
              heightInLines: result.heightInLines,
              domNode,
              ordinal: 5e4 + 2
              // more than https://github.com/microsoft/vscode/blob/bf52a5cfb2c75a7327c9adeaefbddc06d529dcad/src/vs/workbench/contrib/inlineChat/browser/inlineChatZoneWidget.ts#L42
            };
            this._viewZones.push(viewZoneChangeAccessor.addZone(viewZoneData));
          }
          const widget = this._editor.invokeWithinContext((accessor) => {
            const instaService = accessor.get(IInstantiationService);
            return instaService.createInstance(DiffHunkWidget, diff, diffEntry, this._editor.getModel().getVersionId(), this._editor, isCreatedContent ? 0 : result.heightInLines);
          });
          widget.layout(diffEntry.modified.startLineNumber);
          this._diffHunkWidgets.push(widget);
          diffHunkDecorations.push({
            range: diffEntry.modified.toInclusiveRange() ?? new Range(diffEntry.modified.startLineNumber, 1, diffEntry.modified.startLineNumber, Number.MAX_SAFE_INTEGER),
            options: {
              description: "diff-hunk-widget",
              stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
            }
          });
        }
      }
      this._diffVisualDecorations.set(modifiedVisualDecorations);
    });
    const diffHunkDecoCollection = this._editor.createDecorationsCollection(diffHunkDecorations);
    this._diffHunksRenderStore.add(toDisposable(() => {
      dispose(this._diffHunkWidgets);
      this._diffHunkWidgets.length = 0;
      diffHunkDecoCollection.clear();
    }));
    const positionObs = observableFromEvent(this._editor.onDidChangeCursorPosition, (_) => this._editor.getPosition());
    const activeWidgetIdx = derived((r) => {
      const position = positionObs.read(r);
      if (!position) {
        return -1;
      }
      const idx = diffHunkDecoCollection.getRanges().findIndex((r2) => r2.containsPosition(position));
      return idx;
    });
    const toggleWidget = (activeWidget) => {
      const positionIdx = activeWidgetIdx.get();
      for (let i = 0; i < this._diffHunkWidgets.length; i++) {
        const widget = this._diffHunkWidgets[i];
        widget.toggle(widget === activeWidget || i === positionIdx);
      }
    };
    this._diffHunksRenderStore.add(autorun((r) => {
      const idx = activeWidgetIdx.read(r);
      const widget = this._diffHunkWidgets[idx];
      toggleWidget(widget);
    }));
    this._diffHunksRenderStore.add(this._editor.onMouseMove((e) => {
      if (e.target.type === MouseTargetType.OVERLAY_WIDGET) {
        const id = e.target.detail;
        const widget = this._diffHunkWidgets.find((w) => w.getId() === id);
        toggleWidget(widget);
      } else if (e.target.type === MouseTargetType.CONTENT_VIEW_ZONE) {
        const zone = e.target.detail;
        const idx = this._viewZones.findIndex((id) => id === zone.viewZoneId);
        toggleWidget(this._diffHunkWidgets[idx]);
      } else if (e.target.position) {
        const { position } = e.target;
        const idx = diffHunkDecoCollection.getRanges().findIndex((r) => r.containsPosition(position));
        toggleWidget(this._diffHunkWidgets[idx]);
      } else {
        toggleWidget(void 0);
      }
    }));
    this._diffHunksRenderStore.add(Event.any(this._editor.onDidScrollChange, this._editor.onDidLayoutChange)(() => {
      for (let i = 0; i < this._diffHunkWidgets.length; i++) {
        const widget = this._diffHunkWidgets[i];
        const range = diffHunkDecoCollection.getRange(i);
        if (range) {
          widget.layout(range?.startLineNumber);
        } else {
          widget.dispose();
        }
      }
    }));
  }
  enableAccessibleDiffView() {
    this._accessibleDiffViewVisible.set(true, void 0);
  }
  // ---- navigation logic
  reveal(firstOrLast) {
    const decorations = this._diffLineDecorations.getRanges().sort((a, b) => Range.compareRangesUsingStarts(a, b));
    const index = firstOrLast ? 0 : decorations.length - 1;
    const range = decorations.at(index);
    if (range) {
      this._editor.setPosition(range.getStartPosition());
      this._editor.revealRange(range);
      this._editor.focus();
      this._currentIndex.set(index, void 0);
    }
  }
  next(wrap) {
    return this._reveal(true, !wrap);
  }
  previous(wrap) {
    return this._reveal(false, !wrap);
  }
  _reveal(next, strict) {
    const position = this._editor.getPosition();
    if (!position) {
      this._currentIndex.set(-1, void 0);
      return false;
    }
    const decorations = this._diffLineDecorations.getRanges().sort((a, b) => Range.compareRangesUsingStarts(a, b));
    if (decorations.length === 0) {
      this._currentIndex.set(-1, void 0);
      return false;
    }
    let newIndex = -1;
    for (let i = 0; i < decorations.length; i++) {
      const range = decorations[i];
      if (range.containsPosition(position)) {
        newIndex = i + (next ? 1 : -1);
        break;
      } else if (Position.isBefore(position, range.getStartPosition())) {
        newIndex = next ? i : i - 1;
        break;
      }
    }
    if (strict && (newIndex < 0 || newIndex >= decorations.length)) {
      return false;
    }
    newIndex = (newIndex + decorations.length) % decorations.length;
    this._currentIndex.set(newIndex, void 0);
    const targetRange = decorations[newIndex];
    const targetPosition = next ? targetRange.getStartPosition() : targetRange.getEndPosition();
    this._editor.setPosition(targetPosition);
    this._editor.revealPositionInCenter(targetPosition);
    this._editor.focus();
    return true;
  }
  // --- hunks
  _findClosestWidget() {
    if (!this._editor.hasModel()) {
      return void 0;
    }
    const lineRelativeTop = this._editor.getTopForLineNumber(this._editor.getPosition().lineNumber) - this._editor.getScrollTop();
    let closestWidget;
    let closestDistance = Number.MAX_VALUE;
    for (const widget of this._diffHunkWidgets) {
      const widgetTop = widget.getPosition()?.preference?.top;
      if (widgetTop !== void 0) {
        const distance = Math.abs(widgetTop - lineRelativeTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestWidget = widget;
        }
      }
    }
    return closestWidget;
  }
  rejectNearestChange(closestWidget) {
    closestWidget = closestWidget ?? this._findClosestWidget();
    if (closestWidget instanceof DiffHunkWidget) {
      closestWidget.reject();
      this.next(true);
    }
  }
  acceptNearestChange(closestWidget) {
    closestWidget = closestWidget ?? this._findClosestWidget();
    if (closestWidget instanceof DiffHunkWidget) {
      closestWidget.accept();
      this.next(true);
    }
  }
  async toggleDiff(widget) {
    if (!this._editor.hasModel()) {
      return;
    }
    let selection = this._editor.getSelection();
    if (widget instanceof DiffHunkWidget) {
      const lineNumber = widget.getStartLineNumber();
      const position = lineNumber ? new Position(lineNumber, 1) : void 0;
      if (position && !selection.containsPosition(position)) {
        selection = Selection.fromPositions(position);
      }
    }
    const isDiffEditor = this._editor.getOption(EditorOption.inDiffEditor);
    if (isDiffEditor) {
      await this._editorService.openEditor({
        resource: this._entry.modifiedURI,
        options: {
          selection,
          selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport
        }
      });
    } else {
      const defaultAgentName = this._chatAgentService.getDefaultAgent(ChatAgentLocation.EditingSession)?.fullName;
      const diffEditor = await this._editorService.openEditor({
        original: { resource: this._entry.originalURI, options: { selection: void 0 } },
        modified: { resource: this._entry.modifiedURI, options: { selection } },
        label: defaultAgentName ? localize("diff.agent", "{0} (changes from {1})", basename(this._entry.modifiedURI), defaultAgentName) : localize("diff.generic", "{0} (changes from chat)", basename(this._entry.modifiedURI))
      });
      if (diffEditor && diffEditor.input) {
        diffEditor.getControl()?.setSelection(selection);
        const d = autorun((r) => {
          const state = this._entry.state.read(r);
          if (state === WorkingSetEntryState.Accepted || state === WorkingSetEntryState.Rejected) {
            d.dispose();
            const editorIdents = [];
            for (const candidate of this._editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
              if (isDiffEditorInput(candidate.editor) && isEqual(candidate.editor.original.resource, this._entry.originalURI) && isEqual(candidate.editor.modified.resource, this._entry.modifiedURI)) {
                editorIdents.push(candidate);
              }
            }
            this._editorService.closeEditors(editorIdents);
          }
        });
      }
    }
  }
};
ChatEditingCodeEditorIntegration._diffLineDecorationData = ModelDecorationOptions.register({ description: "diff-line-decoration" });
ChatEditingCodeEditorIntegration = __decorateClass([
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IAccessibilitySignalService),
  __decorateParam(6, IInstantiationService)
], ChatEditingCodeEditorIntegration);
let DiffHunkWidget = class {
  constructor(_diffInfo, _change, _versionId, _editor, _lineDelta, instaService) {
    this._diffInfo = _diffInfo;
    this._change = _change;
    this._versionId = _versionId;
    this._editor = _editor;
    this._lineDelta = _lineDelta;
    this._id = `diff-change-widget-${DiffHunkWidget._idPool++}`;
    this._store = new DisposableStore();
    this._domNode = document.createElement("div");
    this._domNode.className = "chat-diff-change-content-widget";
    const toolbar = instaService.createInstance(MenuWorkbenchToolBar, this._domNode, MenuId.ChatEditingEditorHunk, {
      telemetrySource: "chatEditingEditorHunk",
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      menuOptions: {
        renderShortTitle: true,
        arg: this
      }
    });
    this._store.add(toolbar);
    this._store.add(toolbar.actionRunner.onWillRun((_) => _editor.focus()));
    this._editor.addOverlayWidget(this);
  }
  dispose() {
    this._store.dispose();
    this._editor.removeOverlayWidget(this);
  }
  getId() {
    return this._id;
  }
  layout(startLineNumber) {
    const lineHeight = this._editor.getOption(EditorOption.lineHeight);
    const { contentLeft, contentWidth, verticalScrollbarWidth } = this._editor.getLayoutInfo();
    const scrollTop = this._editor.getScrollTop();
    this._position = {
      stackOridinal: 1,
      preference: {
        top: this._editor.getTopForLineNumber(startLineNumber) - scrollTop - lineHeight * this._lineDelta,
        left: contentLeft + contentWidth - (2 * verticalScrollbarWidth + getTotalWidth(this._domNode))
      }
    };
    this._editor.layoutOverlayWidget(this);
    this._lastStartLineNumber = startLineNumber;
  }
  toggle(show) {
    this._domNode.classList.toggle("hover", show);
    if (this._lastStartLineNumber) {
      this.layout(this._lastStartLineNumber);
    }
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return this._position ?? null;
  }
  getStartLineNumber() {
    return this._lastStartLineNumber;
  }
  // ---
  async reject() {
    if (this._versionId !== this._editor.getModel()?.getVersionId()) {
      return false;
    }
    return await this._diffInfo.undo(this._change);
  }
  async accept() {
    if (this._versionId !== this._editor.getModel()?.getVersionId()) {
      return false;
    }
    return this._diffInfo.keep(this._change);
  }
};
DiffHunkWidget._idPool = 0;
DiffHunkWidget = __decorateClass([
  __decorateParam(5, IInstantiationService)
], DiffHunkWidget);
class AccessibleDiffViewContainer {
  constructor() {
    this._domNode = document.createElement("div");
    this._domNode.className = "accessible-diff-view";
    this._domNode.style.width = "100%";
    this._domNode.style.position = "absolute";
  }
  getId() {
    return "chatEdits.accessibleDiffView";
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      preference: { top: 0, left: 0 },
      stackOridinal: 1
    };
  }
}
class AccessibleDiffViewerModel {
  constructor(_documentDiffInfo, _editor) {
    this._documentDiffInfo = _documentDiffInfo;
    this._editor = _editor;
  }
  getOriginalModel() {
    return this._documentDiffInfo.get().originalModel;
  }
  getOriginalOptions() {
    return this._editor.getOptions();
  }
  originalReveal(range) {
    const changes = this._documentDiffInfo.get().changes;
    const idx = changes.findIndex((value) => value.original.intersect(LineRange.fromRange(range)));
    if (idx >= 0) {
      range = changes[idx].modified.toInclusiveRange() ?? range;
    }
    this.modifiedReveal(range);
  }
  getModifiedModel() {
    return this._editor.getModel();
  }
  getModifiedOptions() {
    return this._editor.getOptions();
  }
  modifiedReveal(range) {
    if (range) {
      this._editor.revealRange(range);
      this._editor.setSelection(range);
    }
    this._editor.focus();
  }
  modifiedSetSelection(range) {
    this._editor.setSelection(range);
  }
  modifiedFocus() {
    this._editor.focus();
  }
  getModifiedPosition() {
    return this._editor.getPosition() ?? void 0;
  }
}
export {
  ChatEditingCodeEditorIntegration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4uL21lZGlhL2NoYXRFZGl0b3JDb250cm9sbGVyLmNzcyc7XG5cbmltcG9ydCB7IGdldFRvdGFsV2lkdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgY29uc3RPYnNlcnZhYmxlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyB0aGVtZUNvbG9yRnJvbUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbkNvb3JkaW5hdGVzLCBJVmlld1pvbmUsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlRGlmZlZpZXdlciwgSUFjY2Vzc2libGVEaWZmVmlld2VyTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2FjY2Vzc2libGVEaWZmVmlld2VyLmpzJztcbmltcG9ydCB7IFJlbmRlck9wdGlvbnMsIExpbmVTb3VyY2UsIHJlbmRlckxpbmVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvY29tcG9uZW50cy9kaWZmRWRpdG9yVmlld1pvbmVzL3JlbmRlckxpbmVzLmpzJztcbmltcG9ydCB7IGRpZmZBZGREZWNvcmF0aW9uLCBkaWZmV2hvbGVMaW5lQWRkRGVjb3JhdGlvbiwgZGlmZkRlbGV0ZURlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9yZWdpc3RyYXRpb25zLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSURvY3VtZW50RGlmZiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZGlmZi9kb2N1bWVudERpZmZQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCwgTWluaW1hcFBvc2l0aW9uLCBPdmVydmlld1J1bGVyTGFuZSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElubGluZURlY29yYXRpb24sIElubGluZURlY29yYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVXb3JrYmVuY2hUb29sQmFyLCBIaWRkZW5JdGVtU3RyYXRlZ3kgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFRleHRFZGl0b3JTZWxlY3Rpb25SZXZlYWxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JzT3JkZXIsIElFZGl0b3JJZGVudGlmaWVyLCBpc0RpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgb3ZlcnZpZXdSdWxlck1vZGlmaWVkRm9yZWdyb3VuZCwgbWluaW1hcEd1dHRlck1vZGlmaWVkQmFja2dyb3VuZCwgb3ZlcnZpZXdSdWxlckFkZGVkRm9yZWdyb3VuZCwgbWluaW1hcEd1dHRlckFkZGVkQmFja2dyb3VuZCwgb3ZlcnZpZXdSdWxlckRlbGV0ZWRGb3JlZ3JvdW5kLCBtaW5pbWFwR3V0dGVyRGVsZXRlZEJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3F1aWNrRGlmZi5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IElNb2RpZmllZEZpbGVFbnRyeSwgSU1vZGlmaWVkRmlsZUVudHJ5Q2hhbmdlSHVuaywgSU1vZGlmaWVkRmlsZUVudHJ5RWRpdG9ySW50ZWdyYXRpb24sIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1RleHREaWZmRWRpdG9yRm9yRW50cnkgfSBmcm9tICcuL2NoYXRFZGl0aW5nLmpzJztcbmltcG9ydCB7IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElEb2N1bWVudERpZmYyIGV4dGVuZHMgSURvY3VtZW50RGlmZiB7XG5cblx0b3JpZ2luYWxNb2RlbDogSVRleHRNb2RlbDtcblx0bW9kaWZpZWRNb2RlbDogSVRleHRNb2RlbDtcblxuXHRrZWVwKGNoYW5nZXM6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyk6IFByb21pc2U8Ym9vbGVhbj47XG5cdHVuZG8oY2hhbmdlczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nKTogUHJvbWlzZTxib29sZWFuPjtcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nQ29kZUVkaXRvckludGVncmF0aW9uIGltcGxlbWVudHMgSU1vZGlmaWVkRmlsZUVudHJ5RWRpdG9ySW50ZWdyYXRpb24ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9kaWZmTGluZURlY29yYXRpb25EYXRhID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7IGRlc2NyaXB0aW9uOiAnZGlmZi1saW5lLWRlY29yYXRpb24nIH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRJbmRleCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCAtMSk7XG5cdHJlYWRvbmx5IGN1cnJlbnRJbmRleDogSU9ic2VydmFibGU8bnVtYmVyPiA9IHRoaXMuX2N1cnJlbnRJbmRleDtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlmZkxpbmVEZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlmZlZpc3VhbERlY29yYXRpb25zOiBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmSHVua3NSZW5kZXJTdG9yZSA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmSHVua1dpZGdldHM6IERpZmZIdW5rV2lkZ2V0W10gPSBbXTtcblx0cHJpdmF0ZSBfdmlld1pvbmVzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2libGVEaWZmVmlld1Zpc2libGUgPSBvYnNlcnZhYmxlVmFsdWU8Ym9vbGVhbj4odGhpcywgZmFsc2UpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VudHJ5OiBJTW9kaWZpZWRGaWxlRW50cnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRkb2N1bWVudERpZmZJbmZvOiBJT2JzZXJ2YWJsZTxJRG9jdW1lbnREaWZmMj4sXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxzU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fZGlmZkxpbmVEZWNvcmF0aW9ucyA9IF9lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0Y29uc3QgY29kZUVkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKF9lZGl0b3IpO1xuXG5cdFx0dGhpcy5fZGlmZkxpbmVEZWNvcmF0aW9ucyA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTsgLy8gdHJhY2tzIHRoZSBsaW5lIHJhbmdlIHcvbyB2aXN1YWxzICh1c2VkIGZvciBuYXZpZ2F0ZSlcblx0XHR0aGlzLl9kaWZmVmlzdWFsRGVjb3JhdGlvbnMgPSB0aGlzLl9lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7IC8vIHRyYWNrcyB0aGUgcmVhbCBkaWZmIHdpdGggY2hhcmFjdGVyIGxldmVsIGluc2VydHNcblxuXHRcdGNvbnN0IGVuYWJsZWRPYnMgPSBkZXJpdmVkKHIgPT4ge1xuXHRcdFx0aWYgKCFpc0VxdWFsKGNvZGVFZGl0b3JPYnMubW9kZWwucmVhZChyKT8udXJpLCBkb2N1bWVudERpZmZJbmZvLnJlYWQocikubW9kaWZpZWRNb2RlbC51cmkpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbkRpZmZFZGl0b3IpICYmICFpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihpc1RleHREaWZmRWRpdG9yRm9yRW50cnksIF9lbnRyeSwgdGhpcy5fZWRpdG9yKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblxuXG5cdFx0Ly8gdXBkYXRlIGRlY29yYXRpb25zXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cblx0XHRcdGlmICghZW5hYmxlZE9icy5yZWFkKHIpKSB7XG5cdFx0XHRcdHRoaXMuX2RpZmZMaW5lRGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkYXRhOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGlmZiA9IGRvY3VtZW50RGlmZkluZm8ucmVhZChyKTtcblx0XHRcdGZvciAoY29uc3QgZGlmZkVudHJ5IG9mIGRpZmYuY2hhbmdlcykge1xuXHRcdFx0XHRkYXRhLnB1c2goe1xuXHRcdFx0XHRcdHJhbmdlOiBkaWZmRW50cnkubW9kaWZpZWQudG9JbmNsdXNpdmVSYW5nZSgpID8/IG5ldyBSYW5nZShkaWZmRW50cnkubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCAxLCBkaWZmRW50cnkubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiksXG5cdFx0XHRcdFx0b3B0aW9uczogQ2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24uX2RpZmZMaW5lRGVjb3JhdGlvbkRhdGFcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kaWZmTGluZURlY29yYXRpb25zLnNldChkYXRhKTtcblx0XHR9KSk7XG5cblx0XHQvLyBJTklUIGN1cnJlbnQgaW5kZXggd2hlbjogZW5hYmxlZCwgbm90IHN0cmVhbWluZyBhbnltb3JlLCBvbmNlIHBlciByZXF1ZXN0LCBhbmQgd2hlbiBoYXZpbmcgY2hhbmdlc1xuXHRcdGxldCBsYXN0TW9kaWZ5aW5nUmVxdWVzdElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cblx0XHRcdGlmIChlbmFibGVkT2JzLnJlYWQocilcblx0XHRcdFx0JiYgIV9lbnRyeS5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpXG5cdFx0XHRcdCYmIGxhc3RNb2RpZnlpbmdSZXF1ZXN0SWQgIT09IF9lbnRyeS5sYXN0TW9kaWZ5aW5nUmVxdWVzdElkXG5cdFx0XHRcdCYmICFkb2N1bWVudERpZmZJbmZvLnJlYWQocikuaWRlbnRpY2FsXG5cdFx0XHQpIHtcblx0XHRcdFx0bGFzdE1vZGlmeWluZ1JlcXVlc3RJZCA9IF9lbnRyeS5sYXN0TW9kaWZ5aW5nUmVxdWVzdElkO1xuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IF9lZGl0b3IuZ2V0UG9zaXRpb24oKSA/PyBuZXcgUG9zaXRpb24oMSwgMSk7XG5cdFx0XHRcdGNvbnN0IHJhbmdlcyA9IHRoaXMuX2RpZmZMaW5lRGVjb3JhdGlvbnMuZ2V0UmFuZ2VzKCk7XG5cdFx0XHRcdGxldCBpbml0aWFsSW5kZXggPSByYW5nZXMuZmluZEluZGV4KHIgPT4gci5jb250YWluc1Bvc2l0aW9uKHBvc2l0aW9uKSk7XG5cdFx0XHRcdGlmIChpbml0aWFsSW5kZXggPCAwKSB7XG5cdFx0XHRcdFx0aW5pdGlhbEluZGV4ID0gMDtcblx0XHRcdFx0XHRmb3IgKDsgaW5pdGlhbEluZGV4IDwgcmFuZ2VzLmxlbmd0aCAtIDE7IGluaXRpYWxJbmRleCsrKSB7XG5cdFx0XHRcdFx0XHRjb25zdCByYW5nZSA9IHJhbmdlc1tpbml0aWFsSW5kZXhdO1xuXHRcdFx0XHRcdFx0aWYgKHJhbmdlLmVuZExpbmVOdW1iZXIgPj0gcG9zaXRpb24ubGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fY3VycmVudEluZGV4LnNldChpbml0aWFsSW5kZXgsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdF9lZGl0b3IucmV2ZWFsUmFuZ2UocmFuZ2VzW2luaXRpYWxJbmRleF0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIHJlbmRlciBkaWZmIGRlY29yYXRpb25zXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cblx0XHRcdGlmICghZW5hYmxlZE9icy5yZWFkKHIpKSB7XG5cdFx0XHRcdHRoaXMuX2NsZWFyRGlmZlJlbmRlcmluZygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIGRvbmU6IHJlbmRlciBkaWZmXG5cdFx0XHRpZiAoIV9lbnRyeS5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpKSB7XG5cblx0XHRcdFx0Ly8gQWRkIGRpZmYgZGVjb3JhdGlvbiB0byB0aGUgVUkgKHVubGVzcyBpbiBkaWZmIGVkaXRvcilcblx0XHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbkRpZmZFZGl0b3IpKSB7XG5cdFx0XHRcdFx0Y29kZUVkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKS5yZWFkKHIpO1xuXHRcdFx0XHRcdGNvZGVFZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KS5yZWFkKHIpO1xuXG5cdFx0XHRcdFx0Y29uc3QgcmV2aWV3TW9kZSA9IF9lbnRyeS5yZXZpZXdNb2RlLnJlYWQocik7XG5cdFx0XHRcdFx0Y29uc3QgZGlmZiA9IGRvY3VtZW50RGlmZkluZm8ucmVhZChyKTtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVEaWZmUmVuZGVyaW5nKGRpZmYsIHJldmlld01vZGUpO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fY2xlYXJEaWZmUmVuZGVyaW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblxuXHRcdC8vIGFjY2Vzc2liaWxpdHk6IHNpZ25hbHMgd2hpbGUgY3Vyc29yIGNoYW5nZXNcblx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gY29kZUVkaXRvck9icy5wb3NpdGlvbnMucmVhZChyKT8uYXQoMCk7XG5cdFx0XHRpZiAoIXBvc2l0aW9uIHx8ICFlbmFibGVkT2JzLnJlYWQocikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkaWZmID0gZG9jdW1lbnREaWZmSW5mby5yZWFkKHIpO1xuXHRcdFx0Y29uc3QgbWFwcGluZyA9IGRpZmYuY2hhbmdlcy5maW5kKG0gPT4gbS5tb2RpZmllZC5jb250YWlucyhwb3NpdGlvbi5saW5lTnVtYmVyKSB8fCBtLm1vZGlmaWVkLmlzRW1wdHkgJiYgbS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgPT09IHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKG1hcHBpbmc/Lm1vZGlmaWVkLmlzRW1wdHkpIHtcblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbHNTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5kaWZmTGluZURlbGV0ZWQsIHsgc291cmNlOiAnY2hhdEVkaXRpbmdFZGl0b3IuY3Vyc29yUG9zaXRpb25DaGFuZ2VkJyB9KTtcblx0XHRcdH0gZWxzZSBpZiAobWFwcGluZz8ub3JpZ2luYWwuaXNFbXB0eSkge1xuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsc1NlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lSW5zZXJ0ZWQsIHsgc291cmNlOiAnY2hhdEVkaXRpbmdFZGl0b3IuY3Vyc29yUG9zaXRpb25DaGFuZ2VkJyB9KTtcblx0XHRcdH0gZWxzZSBpZiAobWFwcGluZykge1xuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsc1NlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lTW9kaWZpZWQsIHsgc291cmNlOiAnY2hhdEVkaXRpbmdFZGl0b3IuY3Vyc29yUG9zaXRpb25DaGFuZ2VkJyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBhY2Nlc3NpYmlsaXR5OiBkaWZmIHZpZXdcblx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bldpdGhTdG9yZSgociwgc3RvcmUpID0+IHtcblxuXHRcdFx0Y29uc3QgdmlzaWJsZSA9IHRoaXMuX2FjY2Vzc2libGVEaWZmVmlld1Zpc2libGUucmVhZChyKTtcblxuXHRcdFx0aWYgKCF2aXNpYmxlIHx8ICFlbmFibGVkT2JzLnJlYWQocikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhY2Nlc3NpYmxlRGlmZldpZGdldCA9IG5ldyBBY2Nlc3NpYmxlRGlmZlZpZXdDb250YWluZXIoKTtcblx0XHRcdF9lZGl0b3IuYWRkT3ZlcmxheVdpZGdldChhY2Nlc3NpYmxlRGlmZldpZGdldCk7XG5cdFx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IF9lZGl0b3IucmVtb3ZlT3ZlcmxheVdpZGdldChhY2Nlc3NpYmxlRGlmZldpZGdldCkpKTtcblxuXHRcdFx0c3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRBY2Nlc3NpYmxlRGlmZlZpZXdlcixcblx0XHRcdFx0YWNjZXNzaWJsZURpZmZXaWRnZXQuZ2V0RG9tTm9kZSgpLFxuXHRcdFx0XHRlbmFibGVkT2JzLFxuXHRcdFx0XHQodmlzaWJsZSwgdHgpID0+IHRoaXMuX2FjY2Vzc2libGVEaWZmVmlld1Zpc2libGUuc2V0KHZpc2libGUsIHR4KSxcblx0XHRcdFx0Y29uc3RPYnNlcnZhYmxlKHRydWUpLFxuXHRcdFx0XHRjb2RlRWRpdG9yT2JzLmxheW91dEluZm8ubWFwKCh2LCByKSA9PiB2LndpZHRoKSxcblx0XHRcdFx0Y29kZUVkaXRvck9icy5sYXlvdXRJbmZvLm1hcCgodiwgcikgPT4gdi5oZWlnaHQpLFxuXHRcdFx0XHRkb2N1bWVudERpZmZJbmZvLm1hcChkaWZmID0+IGRpZmYuY2hhbmdlcy5zbGljZSgpKSxcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbCwgZG9jdW1lbnREaWZmSW5mbywgX2VkaXRvciksXG5cdFx0XHQpKTtcblx0XHR9KSk7XG5cblxuXHRcdC8vIC0tLS0gcmVhZG9ubHkgd2hpbGUgc3RyZWFtaW5nXG5cblx0XHRsZXQgYWN0dWFsT3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCByZXN0b3JlQWN0dWFsT3B0aW9ucyA9ICgpID0+IHtcblx0XHRcdGlmIChhY3R1YWxPcHRpb25zICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnVwZGF0ZU9wdGlvbnMoYWN0dWFsT3B0aW9ucyk7XG5cdFx0XHRcdGFjdHVhbE9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZCh0b0Rpc3Bvc2FibGUocmVzdG9yZUFjdHVhbE9wdGlvbnMpKTtcblxuXHRcdGNvbnN0IHJlbmRlckFzQmVpbmdNb2RpZmllZCA9IGRlcml2ZWQodGhpcywgciA9PiB7XG5cdFx0XHRyZXR1cm4gZW5hYmxlZE9icy5yZWFkKHIpICYmIEJvb2xlYW4oX2VudHJ5LmlzQ3VycmVudGx5QmVpbmdNb2RpZmllZEJ5LnJlYWQocikpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlbmRlckFzQmVpbmdNb2RpZmllZC5yZWFkKHIpO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cblx0XHRcdFx0YWN0dWFsT3B0aW9ucyA/Pz0ge1xuXHRcdFx0XHRcdHJlYWRPbmx5OiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSksXG5cdFx0XHRcdFx0c3RpY2t5U2Nyb2xsOiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpLFxuXHRcdFx0XHRcdGNvZGVMZW5zOiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5jb2RlTGVucyksXG5cdFx0XHRcdFx0Z3VpZGVzOiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5ndWlkZXMpXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5fZWRpdG9yLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHRcdHJlYWRPbmx5OiB0cnVlLFxuXHRcdFx0XHRcdHN0aWNreVNjcm9sbDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRcdFx0XHRcdGNvZGVMZW5zOiBmYWxzZSxcblx0XHRcdFx0XHRndWlkZXM6IHsgaW5kZW50YXRpb246IGZhbHNlLCBicmFja2V0UGFpcnM6IGZhbHNlIH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN0b3JlQWN0dWFsT3B0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2xlYXIoKTtcblx0XHR0aGlzLl9zdG9yZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9jbGVhcigpIHtcblx0XHR0aGlzLl9kaWZmTGluZURlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy5fY2xlYXJEaWZmUmVuZGVyaW5nKCk7XG5cdFx0dGhpcy5fY3VycmVudEluZGV4LnNldCgtMSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdC8vIC0tLS0gZGlmZiByZW5kZXJpbmcgbG9naWNcblxuXHRwcml2YXRlIF9jbGVhckRpZmZSZW5kZXJpbmcoKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmNoYW5nZVZpZXdab25lcygodmlld1pvbmVDaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiB0aGlzLl92aWV3Wm9uZXMpIHtcblx0XHRcdFx0dmlld1pvbmVDaGFuZ2VBY2Nlc3Nvci5yZW1vdmVab25lKGlkKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl92aWV3Wm9uZXMgPSBbXTtcblx0XHR0aGlzLl9kaWZmSHVua3NSZW5kZXJTdG9yZS5jbGVhcigpO1xuXHRcdHRoaXMuX2RpZmZWaXN1YWxEZWNvcmF0aW9ucy5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRGlmZlJlbmRlcmluZyhkaWZmOiBJRG9jdW1lbnREaWZmMiwgcmV2aWV3TW9kZTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Y29uc3QgY2hhdERpZmZBZGREZWNvcmF0aW9uID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5jcmVhdGVEeW5hbWljKHtcblx0XHRcdC4uLmRpZmZBZGREZWNvcmF0aW9uLFxuXHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHR9KTtcblx0XHRjb25zdCBjaGF0RGlmZldob2xlTGluZUFkZERlY29yYXRpb24gPSBNb2RlbERlY29yYXRpb25PcHRpb25zLmNyZWF0ZUR5bmFtaWMoe1xuXHRcdFx0Li4uZGlmZldob2xlTGluZUFkZERlY29yYXRpb24sXG5cdFx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHR9KTtcblx0XHRjb25zdCBjcmVhdGVPdmVydmlld0RlY29yYXRpb24gPSAob3ZlcnZpZXdSdWxlckNvbG9yOiBzdHJpbmcsIG1pbmltYXBDb2xvcjogc3RyaW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5jcmVhdGVEeW5hbWljKHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdjaGF0LWVkaXRpbmctZGVjb3JhdGlvbicsXG5cdFx0XHRcdG92ZXJ2aWV3UnVsZXI6IHsgY29sb3I6IHRoZW1lQ29sb3JGcm9tSWQob3ZlcnZpZXdSdWxlckNvbG9yKSwgcG9zaXRpb246IE92ZXJ2aWV3UnVsZXJMYW5lLkxlZnQgfSxcblx0XHRcdFx0bWluaW1hcDogeyBjb2xvcjogdGhlbWVDb2xvckZyb21JZChtaW5pbWFwQ29sb3IpLCBwb3NpdGlvbjogTWluaW1hcFBvc2l0aW9uLkd1dHRlciB9LFxuXHRcdFx0fSk7XG5cdFx0fTtcblx0XHRjb25zdCBtb2RpZmllZERlY29yYXRpb24gPSBjcmVhdGVPdmVydmlld0RlY29yYXRpb24ob3ZlcnZpZXdSdWxlck1vZGlmaWVkRm9yZWdyb3VuZCwgbWluaW1hcEd1dHRlck1vZGlmaWVkQmFja2dyb3VuZCk7XG5cdFx0Y29uc3QgYWRkZWREZWNvcmF0aW9uID0gY3JlYXRlT3ZlcnZpZXdEZWNvcmF0aW9uKG92ZXJ2aWV3UnVsZXJBZGRlZEZvcmVncm91bmQsIG1pbmltYXBHdXR0ZXJBZGRlZEJhY2tncm91bmQpO1xuXHRcdGNvbnN0IGRlbGV0ZWREZWNvcmF0aW9uID0gY3JlYXRlT3ZlcnZpZXdEZWNvcmF0aW9uKG92ZXJ2aWV3UnVsZXJEZWxldGVkRm9yZWdyb3VuZCwgbWluaW1hcEd1dHRlckRlbGV0ZWRCYWNrZ3JvdW5kKTtcblxuXHRcdHRoaXMuX2RpZmZIdW5rc1JlbmRlclN0b3JlLmNsZWFyKCk7XG5cdFx0dGhpcy5fZGlmZkh1bmtXaWRnZXRzLmxlbmd0aCA9IDA7XG5cdFx0Y29uc3QgZGlmZkh1bmtEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblxuXHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoKHZpZXdab25lQ2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdGZvciAoY29uc3QgaWQgb2YgdGhpcy5fdmlld1pvbmVzKSB7XG5cdFx0XHRcdHZpZXdab25lQ2hhbmdlQWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl92aWV3Wm9uZXMgPSBbXTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkVmlzdWFsRGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0XHRjb25zdCBtaWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJID0gZGlmZi5vcmlnaW5hbE1vZGVsLm1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkoKTtcblx0XHRcdGNvbnN0IG1pZ2h0Q29udGFpblJUTCA9IGRpZmYub3JpZ2luYWxNb2RlbC5taWdodENvbnRhaW5SVEwoKTtcblx0XHRcdGNvbnN0IHJlbmRlck9wdGlvbnMgPSBSZW5kZXJPcHRpb25zLmZyb21FZGl0b3IodGhpcy5fZWRpdG9yKTtcblx0XHRcdGNvbnN0IGVkaXRvckxpbmVDb3VudCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpPy5nZXRMaW5lQ291bnQoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBkaWZmRW50cnkgb2YgZGlmZi5jaGFuZ2VzKSB7XG5cblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxSYW5nZSA9IGRpZmZFbnRyeS5vcmlnaW5hbDtcblx0XHRcdFx0ZGlmZi5vcmlnaW5hbE1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihNYXRoLm1heCgxLCBvcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxKSk7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZSA9IG5ldyBMaW5lU291cmNlKFxuXHRcdFx0XHRcdG9yaWdpbmFsUmFuZ2UubWFwVG9MaW5lQXJyYXkobCA9PiBkaWZmLm9yaWdpbmFsTW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobCkpLFxuXHRcdFx0XHRcdFtdLFxuXHRcdFx0XHRcdG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUksXG5cdFx0XHRcdFx0bWlnaHRDb250YWluUlRMLFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uczogSW5saW5lRGVjb3JhdGlvbltdID0gW107XG5cblx0XHRcdFx0aWYgKHJldmlld01vZGUpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGkgb2YgZGlmZkVudHJ5LmlubmVyQ2hhbmdlcyB8fCBbXSkge1xuXHRcdFx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaChuZXcgSW5saW5lRGVjb3JhdGlvbihcblx0XHRcdFx0XHRcdFx0aS5vcmlnaW5hbFJhbmdlLmRlbHRhKC0oZGlmZkVudHJ5Lm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciAtIDEpKSxcblx0XHRcdFx0XHRcdFx0ZGlmZkRlbGV0ZURlY29yYXRpb24uY2xhc3NOYW1lISxcblx0XHRcdFx0XHRcdFx0SW5saW5lRGVjb3JhdGlvblR5cGUuUmVndWxhclxuXHRcdFx0XHRcdFx0KSk7XG5cblx0XHRcdFx0XHRcdC8vIElmIHRoZSBvcmlnaW5hbCByYW5nZSBpcyBlbXB0eSwgdGhlIHN0YXJ0IGxpbmUgbnVtYmVyIGlzIDEgYW5kIHRoZSBuZXcgcmFuZ2Ugc3BhbnMgdGhlIGVudGlyZSBmaWxlLCBkb24ndCBkcmF3IGFuIEFkZGVkIGRlY29yYXRpb25cblx0XHRcdFx0XHRcdGlmICghKGkub3JpZ2luYWxSYW5nZS5pc0VtcHR5KCkgJiYgaS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gMSAmJiBpLm1vZGlmaWVkUmFuZ2UuZW5kTGluZU51bWJlciA9PT0gZWRpdG9yTGluZUNvdW50KSAmJiAhaS5tb2RpZmllZFJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRcdFx0XHRtb2RpZmllZFZpc3VhbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdHJhbmdlOiBpLm1vZGlmaWVkUmFuZ2UsIG9wdGlvbnM6IGNoYXREaWZmQWRkRGVjb3JhdGlvblxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZW5kZXIgYW4gYWRkZWQgZGVjb3JhdGlvbiBidXQgZG9uJ3QgYWxzbyByZW5kZXIgYSBkZWxldGVkIGRlY29yYXRpb24gZm9yIG5ld2x5IGluc2VydGVkIGNvbnRlbnQgYXQgdGhlIHN0YXJ0IG9mIHRoZSBmaWxlXG5cdFx0XHRcdC8vIE5vdGUsIHRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgYExpbmVSYW5nZS5pc0VtcHR5KClgIGluIGRpZmZFbnRyeS5vcmlnaW5hbCBiZWluZyBgZmFsc2VgIGZvciBuZXdseSBpbnNlcnRlZCBjb250ZW50XG5cdFx0XHRcdGNvbnN0IGlzQ3JlYXRlZENvbnRlbnQgPSBkZWNvcmF0aW9ucy5sZW5ndGggPT09IDEgJiYgZGVjb3JhdGlvbnNbMF0ucmFuZ2UuaXNFbXB0eSgpICYmIGRpZmZFbnRyeS5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIgPT09IDE7XG5cblx0XHRcdFx0aWYgKCFkaWZmRW50cnkubW9kaWZpZWQuaXNFbXB0eSAmJiAhKGlzQ3JlYXRlZENvbnRlbnQgJiYgKGRpZmZFbnRyeS5tb2RpZmllZC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSkgPT09IGVkaXRvckxpbmVDb3VudCkpIHtcblx0XHRcdFx0XHRtb2RpZmllZFZpc3VhbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IGRpZmZFbnRyeS5tb2RpZmllZC50b0luY2x1c2l2ZVJhbmdlKCkhLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogY2hhdERpZmZXaG9sZUxpbmVBZGREZWNvcmF0aW9uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZGlmZkVudHJ5Lm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0XHQvLyBpbnNlcnRpb25cblx0XHRcdFx0XHRtb2RpZmllZFZpc3VhbERlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IGRpZmZFbnRyeS5tb2RpZmllZC50b0luY2x1c2l2ZVJhbmdlKCkhLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogYWRkZWREZWNvcmF0aW9uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZGlmZkVudHJ5Lm1vZGlmaWVkLmlzRW1wdHkpIHtcblx0XHRcdFx0XHQvLyBkZWxldGlvblxuXHRcdFx0XHRcdG1vZGlmaWVkVmlzdWFsRGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKGRpZmZFbnRyeS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgLSAxLCAxLCBkaWZmRW50cnkubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyLCAxKSxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IGRlbGV0ZWREZWNvcmF0aW9uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gbW9kaWZpY2F0aW9uXG5cdFx0XHRcdFx0bW9kaWZpZWRWaXN1YWxEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdHJhbmdlOiBkaWZmRW50cnkubW9kaWZpZWQudG9JbmNsdXNpdmVSYW5nZSgpISxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IG1vZGlmaWVkRGVjb3JhdGlvblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHJldmlld01vZGUpIHtcblx0XHRcdFx0XHRjb25zdCBkb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc05hbWUgPSAnY2hhdC1lZGl0aW5nLW9yaWdpbmFsLXpvbmUgdmlldy1saW5lcyBsaW5lLWRlbGV0ZSBtb25hY28tbW91c2UtY3Vyc29yLXRleHQnO1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlbmRlckxpbmVzKHNvdXJjZSwgcmVuZGVyT3B0aW9ucywgZGVjb3JhdGlvbnMsIGRvbU5vZGUpO1xuXG5cdFx0XHRcdFx0aWYgKCFpc0NyZWF0ZWRDb250ZW50KSB7XG5cblx0XHRcdFx0XHRcdGNvbnN0IHZpZXdab25lRGF0YTogSVZpZXdab25lID0ge1xuXHRcdFx0XHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IGRpZmZFbnRyeS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgLSAxLFxuXHRcdFx0XHRcdFx0XHRoZWlnaHRJbkxpbmVzOiByZXN1bHQuaGVpZ2h0SW5MaW5lcyxcblx0XHRcdFx0XHRcdFx0ZG9tTm9kZSxcblx0XHRcdFx0XHRcdFx0b3JkaW5hbDogNTAwMDAgKyAyIC8vIG1vcmUgdGhhbiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9ibG9iL2JmNTJhNWNmYjJjNzVhNzMyN2M5YWRlYWVmYmRkYzA2ZDUyOWRjYWQvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Wm9uZVdpZGdldC50cyNMNDJcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdHRoaXMuX3ZpZXdab25lcy5wdXNoKHZpZXdab25lQ2hhbmdlQWNjZXNzb3IuYWRkWm9uZSh2aWV3Wm9uZURhdGEpKTtcblx0XHRcdFx0XHR9XG5cblxuXHRcdFx0XHRcdC8vIEFkZCBjb250ZW50IHdpZGdldCBmb3IgZWFjaCBkaWZmIGNoYW5nZVxuXHRcdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2VkaXRvci5pbnZva2VXaXRoaW5Db250ZXh0KGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmSHVua1dpZGdldCwgZGlmZiwgZGlmZkVudHJ5LCB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmVyc2lvbklkKCksIHRoaXMuX2VkaXRvciwgaXNDcmVhdGVkQ29udGVudCA/IDAgOiByZXN1bHQuaGVpZ2h0SW5MaW5lcyk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR3aWRnZXQubGF5b3V0KGRpZmZFbnRyeS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0XHRcdFx0dGhpcy5fZGlmZkh1bmtXaWRnZXRzLnB1c2god2lkZ2V0KTtcblx0XHRcdFx0XHRkaWZmSHVua0RlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IGRpZmZFbnRyeS5tb2RpZmllZC50b0luY2x1c2l2ZVJhbmdlKCkgPz8gbmV3IFJhbmdlKGRpZmZFbnRyeS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIsIDEsIGRpZmZFbnRyeS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdkaWZmLWh1bmstd2lkZ2V0Jyxcblx0XHRcdFx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZGlmZlZpc3VhbERlY29yYXRpb25zLnNldChtb2RpZmllZFZpc3VhbERlY29yYXRpb25zKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZIdW5rRGVjb0NvbGxlY3Rpb24gPSB0aGlzLl9lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKGRpZmZIdW5rRGVjb3JhdGlvbnMpO1xuXG5cdFx0dGhpcy5fZGlmZkh1bmtzUmVuZGVyU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NlKHRoaXMuX2RpZmZIdW5rV2lkZ2V0cyk7XG5cdFx0XHR0aGlzLl9kaWZmSHVua1dpZGdldHMubGVuZ3RoID0gMDtcblx0XHRcdGRpZmZIdW5rRGVjb0NvbGxlY3Rpb24uY2xlYXIoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBwb3NpdGlvbk9icyA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24sIF8gPT4gdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkpO1xuXG5cdFx0Y29uc3QgYWN0aXZlV2lkZ2V0SWR4ID0gZGVyaXZlZChyID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gcG9zaXRpb25PYnMucmVhZChyKTtcblx0XHRcdGlmICghcG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaWR4ID0gZGlmZkh1bmtEZWNvQ29sbGVjdGlvbi5nZXRSYW5nZXMoKS5maW5kSW5kZXgociA9PiByLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKTtcblx0XHRcdHJldHVybiBpZHg7XG5cdFx0fSk7XG5cdFx0Y29uc3QgdG9nZ2xlV2lkZ2V0ID0gKGFjdGl2ZVdpZGdldDogRGlmZkh1bmtXaWRnZXQgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uSWR4ID0gYWN0aXZlV2lkZ2V0SWR4LmdldCgpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9kaWZmSHVua1dpZGdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5fZGlmZkh1bmtXaWRnZXRzW2ldO1xuXHRcdFx0XHR3aWRnZXQudG9nZ2xlKHdpZGdldCA9PT0gYWN0aXZlV2lkZ2V0IHx8IGkgPT09IHBvc2l0aW9uSWR4KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fZGlmZkh1bmtzUmVuZGVyU3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cdFx0XHQvLyByZXZlYWwgd2hlbiBjdXJzb3IgaW5zaWRlXG5cdFx0XHRjb25zdCBpZHggPSBhY3RpdmVXaWRnZXRJZHgucmVhZChyKTtcblx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2RpZmZIdW5rV2lkZ2V0c1tpZHhdO1xuXHRcdFx0dG9nZ2xlV2lkZ2V0KHdpZGdldCk7XG5cdFx0fSkpO1xuXG5cblx0XHR0aGlzLl9kaWZmSHVua3NSZW5kZXJTdG9yZS5hZGQodGhpcy5fZWRpdG9yLm9uTW91c2VNb3ZlKGUgPT4ge1xuXG5cdFx0XHQvLyByZXZlYWwgd2hlbiBob3ZlcmluZyBvdmVyXG5cdFx0XHRpZiAoZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLk9WRVJMQVlfV0lER0VUKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gZS50YXJnZXQuZGV0YWlsO1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9kaWZmSHVua1dpZGdldHMuZmluZCh3ID0+IHcuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdFx0XHR0b2dnbGVXaWRnZXQod2lkZ2V0KTtcblxuXHRcdFx0fSBlbHNlIGlmIChlLnRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9WSUVXX1pPTkUpIHtcblx0XHRcdFx0Y29uc3Qgem9uZSA9IGUudGFyZ2V0LmRldGFpbDtcblx0XHRcdFx0Y29uc3QgaWR4ID0gdGhpcy5fdmlld1pvbmVzLmZpbmRJbmRleChpZCA9PiBpZCA9PT0gem9uZS52aWV3Wm9uZUlkKTtcblx0XHRcdFx0dG9nZ2xlV2lkZ2V0KHRoaXMuX2RpZmZIdW5rV2lkZ2V0c1tpZHhdKTtcblxuXHRcdFx0fSBlbHNlIGlmIChlLnRhcmdldC5wb3NpdGlvbikge1xuXHRcdFx0XHRjb25zdCB7IHBvc2l0aW9uIH0gPSBlLnRhcmdldDtcblx0XHRcdFx0Y29uc3QgaWR4ID0gZGlmZkh1bmtEZWNvQ29sbGVjdGlvbi5nZXRSYW5nZXMoKS5maW5kSW5kZXgociA9PiByLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKTtcblx0XHRcdFx0dG9nZ2xlV2lkZ2V0KHRoaXMuX2RpZmZIdW5rV2lkZ2V0c1tpZHhdKTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dG9nZ2xlV2lkZ2V0KHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlmZkh1bmtzUmVuZGVyU3RvcmUuYWRkKEV2ZW50LmFueSh0aGlzLl9lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UsIHRoaXMuX2VkaXRvci5vbkRpZExheW91dENoYW5nZSkoKCkgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9kaWZmSHVua1dpZGdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5fZGlmZkh1bmtXaWRnZXRzW2ldO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IGRpZmZIdW5rRGVjb0NvbGxlY3Rpb24uZ2V0UmFuZ2UoaSk7XG5cdFx0XHRcdGlmIChyYW5nZSkge1xuXHRcdFx0XHRcdHdpZGdldC5sYXlvdXQocmFuZ2U/LnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGVuYWJsZUFjY2Vzc2libGVEaWZmVmlldygpOiB2b2lkIHtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlRGlmZlZpZXdWaXNpYmxlLnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gLS0tLSBuYXZpZ2F0aW9uIGxvZ2ljXG5cblx0cmV2ZWFsKGZpcnN0T3JMYXN0OiBib29sZWFuKTogdm9pZCB7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMuX2RpZmZMaW5lRGVjb3JhdGlvbnNcblx0XHRcdC5nZXRSYW5nZXMoKVxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLCBiKSk7XG5cblx0XHRjb25zdCBpbmRleCA9IGZpcnN0T3JMYXN0ID8gMCA6IGRlY29yYXRpb25zLmxlbmd0aCAtIDE7XG5cdFx0Y29uc3QgcmFuZ2UgPSBkZWNvcmF0aW9ucy5hdChpbmRleCk7XG5cdFx0aWYgKHJhbmdlKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3Iuc2V0UG9zaXRpb24ocmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdHRoaXMuX2VkaXRvci5yZXZlYWxSYW5nZShyYW5nZSk7XG5cdFx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0XHRcdHRoaXMuX2N1cnJlbnRJbmRleC5zZXQoaW5kZXgsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0bmV4dCh3cmFwOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JldmVhbCh0cnVlLCAhd3JhcCk7XG5cdH1cblxuXHRwcmV2aW91cyh3cmFwOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JldmVhbChmYWxzZSwgIXdyYXApO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmV2ZWFsKG5leHQ6IGJvb2xlYW4sIHN0cmljdDogYm9vbGVhbikge1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKTtcblx0XHRpZiAoIXBvc2l0aW9uKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50SW5kZXguc2V0KC0xLCB1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlY29yYXRpb25zID0gdGhpcy5fZGlmZkxpbmVEZWNvcmF0aW9uc1xuXHRcdFx0LmdldFJhbmdlcygpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKGEsIGIpKTtcblxuXHRcdGlmIChkZWNvcmF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRJbmRleC5zZXQoLTEsIHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IG5ld0luZGV4OiBudW1iZXIgPSAtMTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRlY29yYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IGRlY29yYXRpb25zW2ldO1xuXHRcdFx0aWYgKHJhbmdlLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHRcdG5ld0luZGV4ID0gaSArIChuZXh0ID8gMSA6IC0xKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9IGVsc2UgaWYgKFBvc2l0aW9uLmlzQmVmb3JlKHBvc2l0aW9uLCByYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpKSB7XG5cdFx0XHRcdG5ld0luZGV4ID0gbmV4dCA/IGkgOiBpIC0gMTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHN0cmljdCAmJiAobmV3SW5kZXggPCAwIHx8IG5ld0luZGV4ID49IGRlY29yYXRpb25zLmxlbmd0aCkpIHtcblx0XHRcdC8vIE5PIGNoYW5nZVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG5ld0luZGV4ID0gKG5ld0luZGV4ICsgZGVjb3JhdGlvbnMubGVuZ3RoKSAlIGRlY29yYXRpb25zLmxlbmd0aDtcblxuXHRcdHRoaXMuX2N1cnJlbnRJbmRleC5zZXQobmV3SW5kZXgsIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCB0YXJnZXRSYW5nZSA9IGRlY29yYXRpb25zW25ld0luZGV4XTtcblx0XHRjb25zdCB0YXJnZXRQb3NpdGlvbiA9IG5leHQgPyB0YXJnZXRSYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkgOiB0YXJnZXRSYW5nZS5nZXRFbmRQb3NpdGlvbigpO1xuXHRcdHRoaXMuX2VkaXRvci5zZXRQb3NpdGlvbih0YXJnZXRQb3NpdGlvbik7XG5cdFx0dGhpcy5fZWRpdG9yLnJldmVhbFBvc2l0aW9uSW5DZW50ZXIodGFyZ2V0UG9zaXRpb24pO1xuXHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvLyAtLS0gaHVua3NcblxuXHRwcml2YXRlIF9maW5kQ2xvc2VzdFdpZGdldCgpOiBEaWZmSHVua1dpZGdldCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbGluZVJlbGF0aXZlVG9wID0gdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIodGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkubGluZU51bWJlcikgLSB0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsVG9wKCk7XG5cdFx0bGV0IGNsb3Nlc3RXaWRnZXQ6IERpZmZIdW5rV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjbG9zZXN0RGlzdGFuY2UgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG5cdFx0Zm9yIChjb25zdCB3aWRnZXQgb2YgdGhpcy5fZGlmZkh1bmtXaWRnZXRzKSB7XG5cdFx0XHRjb25zdCB3aWRnZXRUb3AgPSAoPElPdmVybGF5V2lkZ2V0UG9zaXRpb25Db29yZGluYXRlcyB8IHVuZGVmaW5lZD53aWRnZXQuZ2V0UG9zaXRpb24oKT8ucHJlZmVyZW5jZSk/LnRvcDtcblx0XHRcdGlmICh3aWRnZXRUb3AgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBkaXN0YW5jZSA9IE1hdGguYWJzKHdpZGdldFRvcCAtIGxpbmVSZWxhdGl2ZVRvcCk7XG5cdFx0XHRcdGlmIChkaXN0YW5jZSA8IGNsb3Nlc3REaXN0YW5jZSkge1xuXHRcdFx0XHRcdGNsb3Nlc3REaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdFx0XHRcdGNsb3Nlc3RXaWRnZXQgPSB3aWRnZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gY2xvc2VzdFdpZGdldDtcblx0fVxuXG5cdHJlamVjdE5lYXJlc3RDaGFuZ2UoY2xvc2VzdFdpZGdldDogSU1vZGlmaWVkRmlsZUVudHJ5Q2hhbmdlSHVuayB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNsb3Nlc3RXaWRnZXQgPSBjbG9zZXN0V2lkZ2V0ID8/IHRoaXMuX2ZpbmRDbG9zZXN0V2lkZ2V0KCk7XG5cdFx0aWYgKGNsb3Nlc3RXaWRnZXQgaW5zdGFuY2VvZiBEaWZmSHVua1dpZGdldCkge1xuXHRcdFx0Y2xvc2VzdFdpZGdldC5yZWplY3QoKTtcblx0XHRcdHRoaXMubmV4dCh0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRhY2NlcHROZWFyZXN0Q2hhbmdlKGNsb3Nlc3RXaWRnZXQ6IElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmsgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjbG9zZXN0V2lkZ2V0ID0gY2xvc2VzdFdpZGdldCA/PyB0aGlzLl9maW5kQ2xvc2VzdFdpZGdldCgpO1xuXHRcdGlmIChjbG9zZXN0V2lkZ2V0IGluc3RhbmNlb2YgRGlmZkh1bmtXaWRnZXQpIHtcblx0XHRcdGNsb3Nlc3RXaWRnZXQuYWNjZXB0KCk7XG5cdFx0XHR0aGlzLm5leHQodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdG9nZ2xlRGlmZih3aWRnZXQ6IElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmsgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHNlbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAod2lkZ2V0IGluc3RhbmNlb2YgRGlmZkh1bmtXaWRnZXQpIHtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB3aWRnZXQuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IGxpbmVOdW1iZXIgPyBuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocG9zaXRpb24gJiYgIXNlbGVjdGlvbi5jb250YWluc1Bvc2l0aW9uKHBvc2l0aW9uKSkge1xuXHRcdFx0XHRzZWxlY3Rpb24gPSBTZWxlY3Rpb24uZnJvbVBvc2l0aW9ucyhwb3NpdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNEaWZmRWRpdG9yID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uaW5EaWZmRWRpdG9yKTtcblxuXHRcdGlmIChpc0RpZmZFZGl0b3IpIHtcblx0XHRcdC8vIG5vcm1hbCBFRElUT1Jcblx0XHRcdGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlOiB0aGlzLl9lbnRyeS5tb2RpZmllZFVSSSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbixcblx0XHRcdFx0XHRzZWxlY3Rpb25SZXZlYWxUeXBlOiBUZXh0RWRpdG9yU2VsZWN0aW9uUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnRcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gRElGRiBlZGl0b3Jcblx0XHRcdGNvbnN0IGRlZmF1bHRBZ2VudE5hbWUgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbik/LmZ1bGxOYW1lO1xuXHRcdFx0Y29uc3QgZGlmZkVkaXRvciA9IGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiB0aGlzLl9lbnRyeS5vcmlnaW5hbFVSSSwgb3B0aW9uczogeyBzZWxlY3Rpb246IHVuZGVmaW5lZCB9IH0sXG5cdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiB0aGlzLl9lbnRyeS5tb2RpZmllZFVSSSwgb3B0aW9uczogeyBzZWxlY3Rpb24gfSB9LFxuXHRcdFx0XHRsYWJlbDogZGVmYXVsdEFnZW50TmFtZVxuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RpZmYuYWdlbnQnLCAnezB9IChjaGFuZ2VzIGZyb20gezF9KScsIGJhc2VuYW1lKHRoaXMuX2VudHJ5Lm1vZGlmaWVkVVJJKSwgZGVmYXVsdEFnZW50TmFtZSlcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdkaWZmLmdlbmVyaWMnLCAnezB9IChjaGFuZ2VzIGZyb20gY2hhdCknLCBiYXNlbmFtZSh0aGlzLl9lbnRyeS5tb2RpZmllZFVSSSkpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGRpZmZFZGl0b3IgJiYgZGlmZkVkaXRvci5pbnB1dCkge1xuXG5cdFx0XHRcdC8vIHRoaXMgaXMgbmVlZGVkLCBwYXNzaW5nIHRoZSBzZWxlY3Rpb24gZG9lc24ndCBzZWVtIHRvIHdvcmtcblx0XHRcdFx0ZGlmZkVkaXRvci5nZXRDb250cm9sKCk/LnNldFNlbGVjdGlvbihzZWxlY3Rpb24pO1xuXG5cdFx0XHRcdC8vIGNsb3NlIGRpZmYgZWRpdG9yIHdoZW4gZW50cnkgaXMgZGVjaWRlZFxuXHRcdFx0XHRjb25zdCBkID0gYXV0b3J1bihyID0+IHtcblx0XHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX2VudHJ5LnN0YXRlLnJlYWQocik7XG5cdFx0XHRcdFx0aWYgKHN0YXRlID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5BY2NlcHRlZCB8fCBzdGF0ZSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQpIHtcblx0XHRcdFx0XHRcdGQuZGlzcG9zZSgpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBlZGl0b3JJZGVudHM6IElFZGl0b3JJZGVudGlmaWVyW10gPSBbXTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIHRoaXMuX2VkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpc0RpZmZFZGl0b3JJbnB1dChjYW5kaWRhdGUuZWRpdG9yKVxuXHRcdFx0XHRcdFx0XHRcdCYmIGlzRXF1YWwoY2FuZGlkYXRlLmVkaXRvci5vcmlnaW5hbC5yZXNvdXJjZSwgdGhpcy5fZW50cnkub3JpZ2luYWxVUkkpXG5cdFx0XHRcdFx0XHRcdFx0JiYgaXNFcXVhbChjYW5kaWRhdGUuZWRpdG9yLm1vZGlmaWVkLnJlc291cmNlLCB0aGlzLl9lbnRyeS5tb2RpZmllZFVSSSlcblx0XHRcdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRcdFx0ZWRpdG9ySWRlbnRzLnB1c2goY2FuZGlkYXRlKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLmNsb3NlRWRpdG9ycyhlZGl0b3JJZGVudHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIERpZmZIdW5rV2lkZ2V0IGltcGxlbWVudHMgSU92ZXJsYXlXaWRnZXQsIElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmsge1xuXG5cdHByaXZhdGUgc3RhdGljIF9pZFBvb2wgPSAwO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pZDogc3RyaW5nID0gYGRpZmYtY2hhbmdlLXdpZGdldC0ke0RpZmZIdW5rV2lkZ2V0Ll9pZFBvb2wrK31gO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBfcG9zaXRpb246IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RTdGFydExpbmVOdW1iZXI6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZJbmZvOiBJRG9jdW1lbnREaWZmMixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jaGFuZ2U6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92ZXJzaW9uSWQ6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVEZWx0YTogbnVtYmVyLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICdjaGF0LWRpZmYtY2hhbmdlLWNvbnRlbnQtd2lkZ2V0JztcblxuXHRcdGNvbnN0IHRvb2xiYXIgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIHRoaXMuX2RvbU5vZGUsIE1lbnVJZC5DaGF0RWRpdGluZ0VkaXRvckh1bmssIHtcblx0XHRcdHRlbGVtZXRyeVNvdXJjZTogJ2NoYXRFZGl0aW5nRWRpdG9ySHVuaycsXG5cdFx0XHRoaWRkZW5JdGVtU3RyYXRlZ3k6IEhpZGRlbkl0ZW1TdHJhdGVneS5Ob0hpZGUsXG5cdFx0XHR0b29sYmFyT3B0aW9uczogeyBwcmltYXJ5R3JvdXA6ICgpID0+IHRydWUsIH0sXG5cdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRyZW5kZXJTaG9ydFRpdGxlOiB0cnVlLFxuXHRcdFx0XHRhcmc6IHRoaXMsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRvb2xiYXIpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0b29sYmFyLmFjdGlvblJ1bm5lci5vbldpbGxSdW4oXyA9PiBfZWRpdG9yLmZvY3VzKCkpKTtcblx0XHR0aGlzLl9lZGl0b3IuYWRkT3ZlcmxheVdpZGdldCh0aGlzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2VkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRsYXlvdXQoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCB7IGNvbnRlbnRMZWZ0LCBjb250ZW50V2lkdGgsIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggfSA9IHRoaXMuX2VkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5fZWRpdG9yLmdldFNjcm9sbFRvcCgpO1xuXG5cdFx0dGhpcy5fcG9zaXRpb24gPSB7XG5cdFx0XHRzdGFja09yaWRpbmFsOiAxLFxuXHRcdFx0cHJlZmVyZW5jZToge1xuXHRcdFx0XHR0b3A6IHRoaXMuX2VkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHN0YXJ0TGluZU51bWJlcikgLSBzY3JvbGxUb3AgLSAobGluZUhlaWdodCAqIHRoaXMuX2xpbmVEZWx0YSksXG5cdFx0XHRcdGxlZnQ6IGNvbnRlbnRMZWZ0ICsgY29udGVudFdpZHRoIC0gKDIgKiB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoICsgZ2V0VG90YWxXaWR0aCh0aGlzLl9kb21Ob2RlKSlcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fZWRpdG9yLmxheW91dE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5fbGFzdFN0YXJ0TGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjtcblx0fVxuXG5cdHRvZ2dsZShzaG93OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdob3ZlcicsIHNob3cpO1xuXHRcdGlmICh0aGlzLl9sYXN0U3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHR0aGlzLmxheW91dCh0aGlzLl9sYXN0U3RhcnRMaW5lTnVtYmVyKTtcblx0XHR9XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fcG9zaXRpb24gPz8gbnVsbDtcblx0fVxuXG5cdGdldFN0YXJ0TGluZU51bWJlcigpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9sYXN0U3RhcnRMaW5lTnVtYmVyO1xuXHR9XG5cblx0Ly8gLS0tXG5cblx0YXN5bmMgcmVqZWN0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0aGlzLl92ZXJzaW9uSWQgIT09IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpPy5nZXRWZXJzaW9uSWQoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fZGlmZkluZm8udW5kbyh0aGlzLl9jaGFuZ2UpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0aGlzLl92ZXJzaW9uSWQgIT09IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpPy5nZXRWZXJzaW9uSWQoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZGlmZkluZm8ua2VlcCh0aGlzLl9jaGFuZ2UpO1xuXHR9XG59XG5cblxuY2xhc3MgQWNjZXNzaWJsZURpZmZWaWV3Q29udGFpbmVyIGltcGxlbWVudHMgSU92ZXJsYXlXaWRnZXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICdhY2Nlc3NpYmxlLWRpZmYtdmlldyc7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS53aWR0aCA9ICcxMDAlJztcblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdjaGF0RWRpdHMuYWNjZXNzaWJsZURpZmZWaWV3Jztcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9kb21Ob2RlO1xuXHR9XG5cblx0Z2V0UG9zaXRpb24oKTogSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwcmVmZXJlbmNlOiB7IHRvcDogMCwgbGVmdDogMCB9LFxuXHRcdFx0c3RhY2tPcmlkaW5hbDogMVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbCBpbXBsZW1lbnRzIElBY2Nlc3NpYmxlRGlmZlZpZXdlck1vZGVsIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnREaWZmSW5mbzogSU9ic2VydmFibGU8SURvY3VtZW50RGlmZjI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdCkgeyB9XG5cblx0Z2V0T3JpZ2luYWxNb2RlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnREaWZmSW5mby5nZXQoKS5vcmlnaW5hbE1vZGVsO1xuXHR9XG5cblx0Z2V0T3JpZ2luYWxPcHRpb25zKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9ucygpO1xuXHR9XG5cblx0b3JpZ2luYWxSZXZlYWwocmFuZ2U6IFJhbmdlKSB7XG5cdFx0Y29uc3QgY2hhbmdlcyA9IHRoaXMuX2RvY3VtZW50RGlmZkluZm8uZ2V0KCkuY2hhbmdlcztcblx0XHRjb25zdCBpZHggPSBjaGFuZ2VzLmZpbmRJbmRleCh2YWx1ZSA9PiB2YWx1ZS5vcmlnaW5hbC5pbnRlcnNlY3QoTGluZVJhbmdlLmZyb21SYW5nZShyYW5nZSkpKTtcblx0XHRpZiAoaWR4ID49IDApIHtcblx0XHRcdHJhbmdlID0gY2hhbmdlc1tpZHhdLm1vZGlmaWVkLnRvSW5jbHVzaXZlUmFuZ2UoKSA/PyByYW5nZTtcblx0XHR9XG5cdFx0dGhpcy5tb2RpZmllZFJldmVhbChyYW5nZSk7XG5cdH1cblxuXHRnZXRNb2RpZmllZE1vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdH1cblxuXHRnZXRNb2RpZmllZE9wdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvci5nZXRPcHRpb25zKCk7XG5cdH1cblxuXHRtb2RpZmllZFJldmVhbChyYW5nZTogUmFuZ2UpIHtcblx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdHRoaXMuX2VkaXRvci5yZXZlYWxSYW5nZShyYW5nZSk7XG5cdFx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9uKHJhbmdlKTtcblx0XHR9XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdH1cblxuXHRtb2RpZmllZFNldFNlbGVjdGlvbihyYW5nZTogUmFuZ2UpIHtcblx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9uKHJhbmdlKTtcblx0fVxuXG5cdG1vZGlmaWVkRm9jdXMoKSB7XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdH1cblxuXHRnZXRNb2RpZmllZFBvc2l0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSA/PyB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUVQLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQixTQUFTLG9CQUFvQjtBQUN2RCxTQUFTLFNBQVMs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
