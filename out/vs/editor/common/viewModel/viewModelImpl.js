import { ArrayQueue } from "../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { Color } from "../../../base/common/color.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as platform from "../../../base/common/platform.js";
import * as strings from "../../../base/common/strings.js";
import { EditorOption, EDITOR_FONT_DEFAULTS, filterValidationDecorations } from "../config/editorOptions.js";
import { CursorsController } from "../cursor/cursor.js";
import { CursorConfiguration } from "../cursorCommon.js";
import { CursorChangeReason } from "../cursorEvents.js";
import { Position } from "../core/position.js";
import { Range } from "../core/range.js";
import { ScrollType } from "../editorCommon.js";
import { EndOfLinePreference, TrackedRangeStickiness } from "../model.js";
import * as textModelEvents from "../textModelEvents.js";
import { TokenizationRegistry } from "../languages.js";
import { ColorId } from "../encodedTokenAttributes.js";
import { PLAINTEXT_LANGUAGE_ID } from "../languages/modesRegistry.js";
import { tokenizeLineToHTML } from "../languages/textToHtmlTokenizer.js";
import * as viewEvents from "../viewEvents.js";
import { ViewLayout } from "../viewLayout/viewLayout.js";
import { MinimapTokensColorTracker } from "./minimapTokensColorTracker.js";
import { MinimapLinesRenderingData, OverviewRulerDecorationsGroup, ViewLineRenderingData } from "../viewModel.js";
import { ViewModelDecorations } from "./viewModelDecorations.js";
import { FocusChangedEvent, HiddenAreasChangedEvent, ModelContentChangedEvent, ModelDecorationsChangedEvent, ModelLanguageChangedEvent, ModelLanguageConfigurationChangedEvent, ModelOptionsChangedEvent, ModelTokensChangedEvent, ReadOnlyEditAttemptEvent, ScrollChangedEvent, ViewModelEventDispatcher, ViewZonesChangedEvent, WidgetFocusChangedEvent } from "../viewModelEventDispatcher.js";
import { ViewModelLinesFromModelAsIs, ViewModelLinesFromProjectedModel } from "./viewModelLines.js";
import { GlyphMarginLanesModel } from "./glyphLanesModel.js";
const USE_IDENTITY_LINES_COLLECTION = true;
class ViewModel extends Disposable {
  constructor(editorId, configuration, model, domLineBreaksComputerFactory, monospaceLineBreaksComputerFactory, scheduleAtNextAnimationFrame, languageConfigurationService, _themeService, _attachedView, _transactionalTarget) {
    super();
    this.languageConfigurationService = languageConfigurationService;
    this._themeService = _themeService;
    this._attachedView = _attachedView;
    this._transactionalTarget = _transactionalTarget;
    this.hiddenAreasModel = new HiddenAreasModel();
    this.previousHiddenAreas = [];
    this._editorId = editorId;
    this._configuration = configuration;
    this.model = model;
    this._eventDispatcher = new ViewModelEventDispatcher();
    this.onEvent = this._eventDispatcher.onEvent;
    this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
    this._updateConfigurationViewLineCount = this._register(new RunOnceScheduler(() => this._updateConfigurationViewLineCountNow(), 0));
    this._hasFocus = false;
    this._viewportStart = ViewportStart.create(this.model);
    this.glyphLanes = new GlyphMarginLanesModel(0);
    if (USE_IDENTITY_LINES_COLLECTION && this.model.isTooLargeForTokenization()) {
      this._lines = new ViewModelLinesFromModelAsIs(this.model);
    } else {
      const options = this._configuration.options;
      const fontInfo = options.get(EditorOption.fontInfo);
      const wrappingStrategy = options.get(EditorOption.wrappingStrategy);
      const wrappingInfo = options.get(EditorOption.wrappingInfo);
      const wrappingIndent = options.get(EditorOption.wrappingIndent);
      const wordBreak = options.get(EditorOption.wordBreak);
      this._lines = new ViewModelLinesFromProjectedModel(
        this._editorId,
        this.model,
        domLineBreaksComputerFactory,
        monospaceLineBreaksComputerFactory,
        fontInfo,
        this.model.getOptions().tabSize,
        wrappingStrategy,
        wrappingInfo.wrappingColumn,
        wrappingIndent,
        wordBreak
      );
    }
    this.coordinatesConverter = this._lines.createCoordinatesConverter();
    this._cursor = this._register(new CursorsController(model, this, this.coordinatesConverter, this.cursorConfig));
    this.viewLayout = this._register(new ViewLayout(this._configuration, this.getLineCount(), scheduleAtNextAnimationFrame));
    this._register(this.viewLayout.onDidScroll((e) => {
      if (e.scrollTopChanged) {
        this._handleVisibleLinesChanged();
      }
      if (e.scrollTopChanged) {
        this._viewportStart.invalidate();
      }
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewScrollChangedEvent(e));
      this._eventDispatcher.emitOutgoingEvent(new ScrollChangedEvent(
        e.oldScrollWidth,
        e.oldScrollLeft,
        e.oldScrollHeight,
        e.oldScrollTop,
        e.scrollWidth,
        e.scrollLeft,
        e.scrollHeight,
        e.scrollTop
      ));
    }));
    this._register(this.viewLayout.onDidContentSizeChange((e) => {
      this._eventDispatcher.emitOutgoingEvent(e);
    }));
    this._decorations = new ViewModelDecorations(this._editorId, this.model, this._configuration, this._lines, this.coordinatesConverter);
    this._registerModelEvents();
    this._register(this._configuration.onDidChangeFast((e) => {
      try {
        const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
        this._onConfigurationChanged(eventsCollector, e);
      } finally {
        this._eventDispatcher.endEmitViewEvents();
      }
    }));
    this._register(MinimapTokensColorTracker.getInstance().onDidChange(() => {
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewTokensColorsChangedEvent());
    }));
    this._register(this._themeService.onDidColorThemeChange((theme) => {
      this._invalidateDecorationsColorCache();
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewThemeChangedEvent(theme));
    }));
    this._updateConfigurationViewLineCountNow();
  }
  dispose() {
    super.dispose();
    this._decorations.dispose();
    this._lines.dispose();
    this._viewportStart.dispose();
    this._eventDispatcher.dispose();
  }
  createLineBreaksComputer() {
    return this._lines.createLineBreaksComputer();
  }
  addViewEventHandler(eventHandler) {
    this._eventDispatcher.addViewEventHandler(eventHandler);
  }
  removeViewEventHandler(eventHandler) {
    this._eventDispatcher.removeViewEventHandler(eventHandler);
  }
  _updateConfigurationViewLineCountNow() {
    this._configuration.setViewLineCount(this._lines.getViewLineCount());
  }
  getModelVisibleRanges() {
    const linesViewportData = this.viewLayout.getLinesViewportData();
    const viewVisibleRange = new Range(
      linesViewportData.startLineNumber,
      this.getLineMinColumn(linesViewportData.startLineNumber),
      linesViewportData.endLineNumber,
      this.getLineMaxColumn(linesViewportData.endLineNumber)
    );
    const modelVisibleRanges = this._toModelVisibleRanges(viewVisibleRange);
    return modelVisibleRanges;
  }
  visibleLinesStabilized() {
    const modelVisibleRanges = this.getModelVisibleRanges();
    this._attachedView.setVisibleLines(modelVisibleRanges, true);
  }
  _handleVisibleLinesChanged() {
    const modelVisibleRanges = this.getModelVisibleRanges();
    this._attachedView.setVisibleLines(modelVisibleRanges, false);
  }
  setHasFocus(hasFocus) {
    this._hasFocus = hasFocus;
    this._cursor.setHasFocus(hasFocus);
    this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewFocusChangedEvent(hasFocus));
    this._eventDispatcher.emitOutgoingEvent(new FocusChangedEvent(!hasFocus, hasFocus));
  }
  setHasWidgetFocus(hasWidgetFocus) {
    this._eventDispatcher.emitOutgoingEvent(new WidgetFocusChangedEvent(!hasWidgetFocus, hasWidgetFocus));
  }
  onCompositionStart() {
    this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewCompositionStartEvent());
  }
  onCompositionEnd() {
    this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewCompositionEndEvent());
  }
  _captureStableViewport() {
    if (this._viewportStart.isValid && this.viewLayout.getCurrentScrollTop() > 0) {
      const previousViewportStartViewPosition = new Position(this._viewportStart.viewLineNumber, this.getLineMinColumn(this._viewportStart.viewLineNumber));
      const previousViewportStartModelPosition = this.coordinatesConverter.convertViewPositionToModelPosition(previousViewportStartViewPosition);
      return new StableViewport(previousViewportStartModelPosition, this._viewportStart.startLineDelta);
    }
    return new StableViewport(null, 0);
  }
  _onConfigurationChanged(eventsCollector, e) {
    const stableViewport = this._captureStableViewport();
    const options = this._configuration.options;
    const fontInfo = options.get(EditorOption.fontInfo);
    const wrappingStrategy = options.get(EditorOption.wrappingStrategy);
    const wrappingInfo = options.get(EditorOption.wrappingInfo);
    const wrappingIndent = options.get(EditorOption.wrappingIndent);
    const wordBreak = options.get(EditorOption.wordBreak);
    if (this._lines.setWrappingSettings(fontInfo, wrappingStrategy, wrappingInfo.wrappingColumn, wrappingIndent, wordBreak)) {
      eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
      eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
      eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
      this._cursor.onLineMappingChanged(eventsCollector);
      this._decorations.onLineMappingChanged();
      this.viewLayout.onFlushed(this.getLineCount());
      this._updateConfigurationViewLineCount.schedule();
    }
    if (e.hasChanged(EditorOption.readOnly)) {
      this._decorations.reset();
      eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
    }
    if (e.hasChanged(EditorOption.renderValidationDecorations)) {
      this._decorations.reset();
      eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
    }
    eventsCollector.emitViewEvent(new viewEvents.ViewConfigurationChangedEvent(e));
    this.viewLayout.onConfigurationChanged(e);
    stableViewport.recoverViewportStart(this.coordinatesConverter, this.viewLayout);
    if (CursorConfiguration.shouldRecreate(e)) {
      this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
      this._cursor.updateConfiguration(this.cursorConfig);
    }
  }
  _registerModelEvents() {
    this._register(this.model.onDidChangeContentOrInjectedText((e) => {
      try {
        const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
        let hadOtherModelChange = false;
        let hadModelLineChangeThatChangedLineMapping = false;
        const changes = e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.changes : e.changes;
        const versionId = e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.versionId : null;
        const lineBreaksComputer = this._lines.createLineBreaksComputer();
        for (const change of changes) {
          switch (change.changeType) {
            case textModelEvents.RawContentChangedType.LinesInserted: {
              for (let lineIdx = 0; lineIdx < change.detail.length; lineIdx++) {
                const line = change.detail[lineIdx];
                let injectedText = change.injectedTexts[lineIdx];
                if (injectedText) {
                  injectedText = injectedText.filter((element) => !element.ownerId || element.ownerId === this._editorId);
                }
                lineBreaksComputer.addRequest(line, injectedText, null);
              }
              break;
            }
            case textModelEvents.RawContentChangedType.LineChanged: {
              let injectedText = null;
              if (change.injectedText) {
                injectedText = change.injectedText.filter((element) => !element.ownerId || element.ownerId === this._editorId);
              }
              lineBreaksComputer.addRequest(change.detail, injectedText, null);
              break;
            }
          }
        }
        const lineBreaks = lineBreaksComputer.finalize();
        const lineBreakQueue = new ArrayQueue(lineBreaks);
        for (const change of changes) {
          switch (change.changeType) {
            case textModelEvents.RawContentChangedType.Flush: {
              this._lines.onModelFlushed();
              eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
              this._decorations.reset();
              this.viewLayout.onFlushed(this.getLineCount());
              hadOtherModelChange = true;
              break;
            }
            case textModelEvents.RawContentChangedType.LinesDeleted: {
              const linesDeletedEvent = this._lines.onModelLinesDeleted(versionId, change.fromLineNumber, change.toLineNumber);
              if (linesDeletedEvent !== null) {
                eventsCollector.emitViewEvent(linesDeletedEvent);
                this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
              }
              hadOtherModelChange = true;
              break;
            }
            case textModelEvents.RawContentChangedType.LinesInserted: {
              const insertedLineBreaks = lineBreakQueue.takeCount(change.detail.length);
              const linesInsertedEvent = this._lines.onModelLinesInserted(versionId, change.fromLineNumber, change.toLineNumber, insertedLineBreaks);
              if (linesInsertedEvent !== null) {
                eventsCollector.emitViewEvent(linesInsertedEvent);
                this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
              }
              hadOtherModelChange = true;
              break;
            }
            case textModelEvents.RawContentChangedType.LineChanged: {
              const changedLineBreakData = lineBreakQueue.dequeue();
              const [lineMappingChanged, linesChangedEvent, linesInsertedEvent, linesDeletedEvent] = this._lines.onModelLineChanged(versionId, change.lineNumber, changedLineBreakData);
              hadModelLineChangeThatChangedLineMapping = lineMappingChanged;
              if (linesChangedEvent) {
                eventsCollector.emitViewEvent(linesChangedEvent);
              }
              if (linesInsertedEvent) {
                eventsCollector.emitViewEvent(linesInsertedEvent);
                this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
              }
              if (linesDeletedEvent) {
                eventsCollector.emitViewEvent(linesDeletedEvent);
                this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
              }
              break;
            }
            case textModelEvents.RawContentChangedType.EOLChanged: {
              break;
            }
          }
        }
        if (versionId !== null) {
          this._lines.acceptVersionId(versionId);
        }
        this.viewLayout.onHeightMaybeChanged();
        if (!hadOtherModelChange && hadModelLineChangeThatChangedLineMapping) {
          eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
          eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
          this._cursor.onLineMappingChanged(eventsCollector);
          this._decorations.onLineMappingChanged();
        }
      } finally {
        this._eventDispatcher.endEmitViewEvents();
      }
      const viewportStartWasValid = this._viewportStart.isValid;
      this._viewportStart.invalidate();
      this._configuration.setModelLineCount(this.model.getLineCount());
      this._updateConfigurationViewLineCountNow();
      if (!this._hasFocus && this.model.getAttachedEditorCount() >= 2 && viewportStartWasValid) {
        const modelRange = this.model._getTrackedRange(this._viewportStart.modelTrackedRange);
        if (modelRange) {
          const viewPosition = this.coordinatesConverter.convertModelPositionToViewPosition(modelRange.getStartPosition());
          const viewPositionTop = this.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
          this.viewLayout.setScrollPosition({ scrollTop: viewPositionTop + this._viewportStart.startLineDelta }, ScrollType.Immediate);
        }
      }
      try {
        const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
        if (e instanceof textModelEvents.InternalModelContentChangeEvent) {
          eventsCollector.emitOutgoingEvent(new ModelContentChangedEvent(e.contentChangedEvent));
        }
        this._cursor.onModelContentChanged(eventsCollector, e);
      } finally {
        this._eventDispatcher.endEmitViewEvents();
      }
      this._handleVisibleLinesChanged();
    }));
    this._register(this.model.onDidChangeTokens((e) => {
      const viewRanges = [];
      for (let j = 0, lenJ = e.ranges.length; j < lenJ; j++) {
        const modelRange = e.ranges[j];
        const viewStartLineNumber = this.coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.fromLineNumber, 1)).lineNumber;
        const viewEndLineNumber = this.coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.toLineNumber, this.model.getLineMaxColumn(modelRange.toLineNumber))).lineNumber;
        viewRanges[j] = {
          fromLineNumber: viewStartLineNumber,
          toLineNumber: viewEndLineNumber
        };
      }
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewTokensChangedEvent(viewRanges));
      this._eventDispatcher.emitOutgoingEvent(new ModelTokensChangedEvent(e));
    }));
    this._register(this.model.onDidChangeLanguageConfiguration((e) => {
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewLanguageConfigurationEvent());
      this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
      this._cursor.updateConfiguration(this.cursorConfig);
      this._eventDispatcher.emitOutgoingEvent(new ModelLanguageConfigurationChangedEvent(e));
    }));
    this._register(this.model.onDidChangeLanguage((e) => {
      this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
      this._cursor.updateConfiguration(this.cursorConfig);
      this._eventDispatcher.emitOutgoingEvent(new ModelLanguageChangedEvent(e));
    }));
    this._register(this.model.onDidChangeOptions((e) => {
      if (this._lines.setTabSize(this.model.getOptions().tabSize)) {
        try {
          const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
          eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
          eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
          eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
          this._cursor.onLineMappingChanged(eventsCollector);
          this._decorations.onLineMappingChanged();
          this.viewLayout.onFlushed(this.getLineCount());
        } finally {
          this._eventDispatcher.endEmitViewEvents();
        }
        this._updateConfigurationViewLineCount.schedule();
      }
      this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
      this._cursor.updateConfiguration(this.cursorConfig);
      this._eventDispatcher.emitOutgoingEvent(new ModelOptionsChangedEvent(e));
    }));
    this._register(this.model.onDidChangeDecorations((e) => {
      this._decorations.onModelDecorationsChanged();
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewDecorationsChangedEvent(e));
      this._eventDispatcher.emitOutgoingEvent(new ModelDecorationsChangedEvent(e));
    }));
  }
  /**
   * @param forceUpdate If true, the hidden areas will be updated even if the new ranges are the same as the previous ranges.
   * This is because the model might have changed, which resets the hidden areas, but not the last cached value.
   * This needs a better fix in the future.
  */
  setHiddenAreas(ranges, source, forceUpdate) {
    this.hiddenAreasModel.setHiddenAreas(source, ranges);
    const mergedRanges = this.hiddenAreasModel.getMergedRanges();
    if (mergedRanges === this.previousHiddenAreas && !forceUpdate) {
      return;
    }
    this.previousHiddenAreas = mergedRanges;
    const stableViewport = this._captureStableViewport();
    let lineMappingChanged = false;
    try {
      const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
      lineMappingChanged = this._lines.setHiddenAreas(mergedRanges);
      if (lineMappingChanged) {
        eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
        eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
        eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
        this._cursor.onLineMappingChanged(eventsCollector);
        this._decorations.onLineMappingChanged();
        this.viewLayout.onFlushed(this.getLineCount());
        this.viewLayout.onHeightMaybeChanged();
      }
      const firstModelLineInViewPort = stableViewport.viewportStartModelPosition?.lineNumber;
      const firstModelLineIsHidden = firstModelLineInViewPort && mergedRanges.some((range) => range.startLineNumber <= firstModelLineInViewPort && firstModelLineInViewPort <= range.endLineNumber);
      if (!firstModelLineIsHidden) {
        stableViewport.recoverViewportStart(this.coordinatesConverter, this.viewLayout);
      }
    } finally {
      this._eventDispatcher.endEmitViewEvents();
    }
    this._updateConfigurationViewLineCount.schedule();
    if (lineMappingChanged) {
      this._eventDispatcher.emitOutgoingEvent(new HiddenAreasChangedEvent());
    }
  }
  getVisibleRangesPlusViewportAboveBelow() {
    const layoutInfo = this._configuration.options.get(EditorOption.layoutInfo);
    const lineHeight = this._configuration.options.get(EditorOption.lineHeight);
    const linesAround = Math.max(20, Math.round(layoutInfo.height / lineHeight));
    const partialData = this.viewLayout.getLinesViewportData();
    const startViewLineNumber = Math.max(1, partialData.completelyVisibleStartLineNumber - linesAround);
    const endViewLineNumber = Math.min(this.getLineCount(), partialData.completelyVisibleEndLineNumber + linesAround);
    return this._toModelVisibleRanges(new Range(
      startViewLineNumber,
      this.getLineMinColumn(startViewLineNumber),
      endViewLineNumber,
      this.getLineMaxColumn(endViewLineNumber)
    ));
  }
  getVisibleRanges() {
    const visibleViewRange = this.getCompletelyVisibleViewRange();
    return this._toModelVisibleRanges(visibleViewRange);
  }
  getHiddenAreas() {
    return this._lines.getHiddenAreas();
  }
  _toModelVisibleRanges(visibleViewRange) {
    const visibleRange = this.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
    const hiddenAreas = this._lines.getHiddenAreas();
    if (hiddenAreas.length === 0) {
      return [visibleRange];
    }
    const result = [];
    let resultLen = 0;
    let startLineNumber = visibleRange.startLineNumber;
    let startColumn = visibleRange.startColumn;
    const endLineNumber = visibleRange.endLineNumber;
    const endColumn = visibleRange.endColumn;
    for (let i = 0, len = hiddenAreas.length; i < len; i++) {
      const hiddenStartLineNumber = hiddenAreas[i].startLineNumber;
      const hiddenEndLineNumber = hiddenAreas[i].endLineNumber;
      if (hiddenEndLineNumber < startLineNumber) {
        continue;
      }
      if (hiddenStartLineNumber > endLineNumber) {
        continue;
      }
      if (startLineNumber < hiddenStartLineNumber) {
        result[resultLen++] = new Range(
          startLineNumber,
          startColumn,
          hiddenStartLineNumber - 1,
          this.model.getLineMaxColumn(hiddenStartLineNumber - 1)
        );
      }
      startLineNumber = hiddenEndLineNumber + 1;
      startColumn = 1;
    }
    if (startLineNumber < endLineNumber || startLineNumber === endLineNumber && startColumn < endColumn) {
      result[resultLen++] = new Range(
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn
      );
    }
    return result;
  }
  getCompletelyVisibleViewRange() {
    const partialData = this.viewLayout.getLinesViewportData();
    const startViewLineNumber = partialData.completelyVisibleStartLineNumber;
    const endViewLineNumber = partialData.completelyVisibleEndLineNumber;
    return new Range(
      startViewLineNumber,
      this.getLineMinColumn(startViewLineNumber),
      endViewLineNumber,
      this.getLineMaxColumn(endViewLineNumber)
    );
  }
  getCompletelyVisibleViewRangeAtScrollTop(scrollTop) {
    const partialData = this.viewLayout.getLinesViewportDataAtScrollTop(scrollTop);
    const startViewLineNumber = partialData.completelyVisibleStartLineNumber;
    const endViewLineNumber = partialData.completelyVisibleEndLineNumber;
    return new Range(
      startViewLineNumber,
      this.getLineMinColumn(startViewLineNumber),
      endViewLineNumber,
      this.getLineMaxColumn(endViewLineNumber)
    );
  }
  saveState() {
    const compatViewState = this.viewLayout.saveState();
    const scrollTop = compatViewState.scrollTop;
    const firstViewLineNumber = this.viewLayout.getLineNumberAtVerticalOffset(scrollTop);
    const firstPosition = this.coordinatesConverter.convertViewPositionToModelPosition(new Position(firstViewLineNumber, this.getLineMinColumn(firstViewLineNumber)));
    const firstPositionDeltaTop = this.viewLayout.getVerticalOffsetForLineNumber(firstViewLineNumber) - scrollTop;
    return {
      scrollLeft: compatViewState.scrollLeft,
      firstPosition,
      firstPositionDeltaTop
    };
  }
  reduceRestoreState(state) {
    if (typeof state.firstPosition === "undefined") {
      return this._reduceRestoreStateCompatibility(state);
    }
    const modelPosition = this.model.validatePosition(state.firstPosition);
    const viewPosition = this.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
    const scrollTop = this.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber) - state.firstPositionDeltaTop;
    return {
      scrollLeft: state.scrollLeft,
      scrollTop
    };
  }
  _reduceRestoreStateCompatibility(state) {
    return {
      scrollLeft: state.scrollLeft,
      scrollTop: state.scrollTopWithoutViewZones
    };
  }
  getTabSize() {
    return this.model.getOptions().tabSize;
  }
  getLineCount() {
    return this._lines.getViewLineCount();
  }
  /**
   * Gives a hint that a lot of requests are about to come in for these line numbers.
   */
  setViewport(startLineNumber, endLineNumber, centeredLineNumber) {
    this._viewportStart.update(this, startLineNumber);
  }
  getActiveIndentGuide(lineNumber, minLineNumber, maxLineNumber) {
    return this._lines.getActiveIndentGuide(lineNumber, minLineNumber, maxLineNumber);
  }
  getLinesIndentGuides(startLineNumber, endLineNumber) {
    return this._lines.getViewLinesIndentGuides(startLineNumber, endLineNumber);
  }
  getBracketGuidesInRangeByLine(startLineNumber, endLineNumber, activePosition, options) {
    return this._lines.getViewLinesBracketGuides(startLineNumber, endLineNumber, activePosition, options);
  }
  getLineContent(lineNumber) {
    return this._lines.getViewLineContent(lineNumber);
  }
  getLineLength(lineNumber) {
    return this._lines.getViewLineLength(lineNumber);
  }
  getLineMinColumn(lineNumber) {
    return this._lines.getViewLineMinColumn(lineNumber);
  }
  getLineMaxColumn(lineNumber) {
    return this._lines.getViewLineMaxColumn(lineNumber);
  }
  getLineFirstNonWhitespaceColumn(lineNumber) {
    const result = strings.firstNonWhitespaceIndex(this.getLineContent(lineNumber));
    if (result === -1) {
      return 0;
    }
    return result + 1;
  }
  getLineLastNonWhitespaceColumn(lineNumber) {
    const result = strings.lastNonWhitespaceIndex(this.getLineContent(lineNumber));
    if (result === -1) {
      return 0;
    }
    return result + 2;
  }
  getMinimapDecorationsInRange(range) {
    return this._decorations.getMinimapDecorationsInRange(range);
  }
  getDecorationsInViewport(visibleRange) {
    return this._decorations.getDecorationsViewportData(visibleRange).decorations;
  }
  getInjectedTextAt(viewPosition) {
    return this._lines.getInjectedTextAt(viewPosition);
  }
  getViewportViewLineRenderingData(visibleRange, lineNumber) {
    const allInlineDecorations = this._decorations.getDecorationsViewportData(visibleRange).inlineDecorations;
    const inlineDecorations = allInlineDecorations[lineNumber - visibleRange.startLineNumber];
    return this._getViewLineRenderingData(lineNumber, inlineDecorations);
  }
  getViewLineRenderingData(lineNumber) {
    const inlineDecorations = this._decorations.getInlineDecorationsOnLine(lineNumber);
    return this._getViewLineRenderingData(lineNumber, inlineDecorations);
  }
  _getViewLineRenderingData(lineNumber, inlineDecorations) {
    const mightContainRTL = this.model.mightContainRTL();
    const mightContainNonBasicASCII = this.model.mightContainNonBasicASCII();
    const tabSize = this.getTabSize();
    const lineData = this._lines.getViewLineData(lineNumber);
    if (lineData.inlineDecorations) {
      inlineDecorations = [
        ...inlineDecorations,
        ...lineData.inlineDecorations.map(
          (d) => d.toInlineDecoration(lineNumber)
        )
      ];
    }
    return new ViewLineRenderingData(
      lineData.minColumn,
      lineData.maxColumn,
      lineData.content,
      lineData.continuesWithWrappedLine,
      mightContainRTL,
      mightContainNonBasicASCII,
      lineData.tokens,
      inlineDecorations,
      tabSize,
      lineData.startVisibleColumn
    );
  }
  getViewLineData(lineNumber) {
    return this._lines.getViewLineData(lineNumber);
  }
  getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed) {
    const result = this._lines.getViewLinesData(startLineNumber, endLineNumber, needed);
    return new MinimapLinesRenderingData(
      this.getTabSize(),
      result
    );
  }
  getAllOverviewRulerDecorations(theme) {
    const decorations = this.model.getOverviewRulerDecorations(this._editorId, filterValidationDecorations(this._configuration.options));
    const result = new OverviewRulerDecorations();
    for (const decoration of decorations) {
      const decorationOptions = decoration.options;
      const opts = decorationOptions.overviewRuler;
      if (!opts) {
        continue;
      }
      const lane = opts.position;
      if (lane === 0) {
        continue;
      }
      const color = opts.getColor(theme.value);
      const viewStartLineNumber = this.coordinatesConverter.getViewLineNumberOfModelPosition(decoration.range.startLineNumber, decoration.range.startColumn);
      const viewEndLineNumber = this.coordinatesConverter.getViewLineNumberOfModelPosition(decoration.range.endLineNumber, decoration.range.endColumn);
      result.accept(color, decorationOptions.zIndex, viewStartLineNumber, viewEndLineNumber, lane);
    }
    return result.asArray;
  }
  _invalidateDecorationsColorCache() {
    const decorations = this.model.getOverviewRulerDecorations();
    for (const decoration of decorations) {
      const opts1 = decoration.options.overviewRuler;
      opts1?.invalidateCachedColor();
      const opts2 = decoration.options.minimap;
      opts2?.invalidateCachedColor();
    }
  }
  getValueInRange(range, eol) {
    const modelRange = this.coordinatesConverter.convertViewRangeToModelRange(range);
    return this.model.getValueInRange(modelRange, eol);
  }
  getValueLengthInRange(range, eol) {
    const modelRange = this.coordinatesConverter.convertViewRangeToModelRange(range);
    return this.model.getValueLengthInRange(modelRange, eol);
  }
  modifyPosition(position, offset) {
    const modelPosition = this.coordinatesConverter.convertViewPositionToModelPosition(position);
    const resultModelPosition = this.model.modifyPosition(modelPosition, offset);
    return this.coordinatesConverter.convertModelPositionToViewPosition(resultModelPosition);
  }
  deduceModelPositionRelativeToViewPosition(viewAnchorPosition, deltaOffset, lineFeedCnt) {
    const modelAnchor = this.coordinatesConverter.convertViewPositionToModelPosition(viewAnchorPosition);
    if (this.model.getEOL().length === 2) {
      if (deltaOffset < 0) {
        deltaOffset -= lineFeedCnt;
      } else {
        deltaOffset += lineFeedCnt;
      }
    }
    const modelAnchorOffset = this.model.getOffsetAt(modelAnchor);
    const resultOffset = modelAnchorOffset + deltaOffset;
    return this.model.getPositionAt(resultOffset);
  }
  getPlainTextToCopy(modelRanges, emptySelectionClipboard, forceCRLF) {
    const newLineCharacter = forceCRLF ? "\r\n" : this.model.getEOL();
    modelRanges = modelRanges.slice(0);
    modelRanges.sort(Range.compareRangesUsingStarts);
    let hasEmptyRange = false;
    let hasNonEmptyRange = false;
    for (const range of modelRanges) {
      if (range.isEmpty()) {
        hasEmptyRange = true;
      } else {
        hasNonEmptyRange = true;
      }
    }
    if (!hasNonEmptyRange) {
      if (!emptySelectionClipboard) {
        return "";
      }
      const modelLineNumbers = modelRanges.map((r) => r.startLineNumber);
      let result2 = "";
      for (let i = 0; i < modelLineNumbers.length; i++) {
        if (i > 0 && modelLineNumbers[i - 1] === modelLineNumbers[i]) {
          continue;
        }
        result2 += this.model.getLineContent(modelLineNumbers[i]) + newLineCharacter;
      }
      return result2;
    }
    if (hasEmptyRange && emptySelectionClipboard) {
      const result2 = [];
      let prevModelLineNumber = 0;
      for (const modelRange of modelRanges) {
        const modelLineNumber = modelRange.startLineNumber;
        if (modelRange.isEmpty()) {
          if (modelLineNumber !== prevModelLineNumber) {
            result2.push(this.model.getLineContent(modelLineNumber));
          }
        } else {
          result2.push(this.model.getValueInRange(modelRange, forceCRLF ? EndOfLinePreference.CRLF : EndOfLinePreference.TextDefined));
        }
        prevModelLineNumber = modelLineNumber;
      }
      return result2.length === 1 ? result2[0] : result2;
    }
    const result = [];
    for (const modelRange of modelRanges) {
      if (!modelRange.isEmpty()) {
        result.push(this.model.getValueInRange(modelRange, forceCRLF ? EndOfLinePreference.CRLF : EndOfLinePreference.TextDefined));
      }
    }
    return result.length === 1 ? result[0] : result;
  }
  getRichTextToCopy(modelRanges, emptySelectionClipboard) {
    const languageId = this.model.getLanguageId();
    if (languageId === PLAINTEXT_LANGUAGE_ID) {
      return null;
    }
    if (modelRanges.length !== 1) {
      return null;
    }
    let range = modelRanges[0];
    if (range.isEmpty()) {
      if (!emptySelectionClipboard) {
        return null;
      }
      const lineNumber = range.startLineNumber;
      range = new Range(lineNumber, this.model.getLineMinColumn(lineNumber), lineNumber, this.model.getLineMaxColumn(lineNumber));
    }
    const fontInfo = this._configuration.options.get(EditorOption.fontInfo);
    const colorMap = this._getColorMap();
    const hasBadChars = /[:;\\\/<>]/.test(fontInfo.fontFamily);
    const useDefaultFontFamily = hasBadChars || fontInfo.fontFamily === EDITOR_FONT_DEFAULTS.fontFamily;
    let fontFamily;
    if (useDefaultFontFamily) {
      fontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
    } else {
      fontFamily = fontInfo.fontFamily;
      fontFamily = fontFamily.replace(/"/g, "'");
      const hasQuotesOrIsList = /[,']/.test(fontFamily);
      if (!hasQuotesOrIsList) {
        const needsQuotes = /[+ ]/.test(fontFamily);
        if (needsQuotes) {
          fontFamily = `'${fontFamily}'`;
        }
      }
      fontFamily = `${fontFamily}, ${EDITOR_FONT_DEFAULTS.fontFamily}`;
    }
    return {
      mode: languageId,
      html: `<div style="color: ${colorMap[ColorId.DefaultForeground]};background-color: ${colorMap[ColorId.DefaultBackground]};font-family: ${fontFamily};font-weight: ${fontInfo.fontWeight};font-size: ${fontInfo.fontSize}px;line-height: ${fontInfo.lineHeight}px;white-space: pre;">` + this._getHTMLToCopy(range, colorMap) + "</div>"
    };
  }
  _getHTMLToCopy(modelRange, colorMap) {
    const startLineNumber = modelRange.startLineNumber;
    const startColumn = modelRange.startColumn;
    const endLineNumber = modelRange.endLineNumber;
    const endColumn = modelRange.endColumn;
    const tabSize = this.getTabSize();
    let result = "";
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      const lineTokens = this.model.tokenization.getLineTokens(lineNumber);
      const lineContent = lineTokens.getLineContent();
      const startOffset = lineNumber === startLineNumber ? startColumn - 1 : 0;
      const endOffset = lineNumber === endLineNumber ? endColumn - 1 : lineContent.length;
      if (lineContent === "") {
        result += "<br>";
      } else {
        result += tokenizeLineToHTML(lineContent, lineTokens.inflate(), colorMap, startOffset, endOffset, tabSize, platform.isWindows);
      }
    }
    return result;
  }
  _getColorMap() {
    const colorMap = TokenizationRegistry.getColorMap();
    const result = ["#000000"];
    if (colorMap) {
      for (let i = 1, len = colorMap.length; i < len; i++) {
        result[i] = Color.Format.CSS.formatHex(colorMap[i]);
      }
    }
    return result;
  }
  //#region cursor operations
  getPrimaryCursorState() {
    return this._cursor.getPrimaryCursorState();
  }
  getLastAddedCursorIndex() {
    return this._cursor.getLastAddedCursorIndex();
  }
  getCursorStates() {
    return this._cursor.getCursorStates();
  }
  setCursorStates(source, reason, states) {
    return this._withViewEventsCollector((eventsCollector) => this._cursor.setStates(eventsCollector, source, reason, states));
  }
  getCursorColumnSelectData() {
    return this._cursor.getCursorColumnSelectData();
  }
  getCursorAutoClosedCharacters() {
    return this._cursor.getAutoClosedCharacters();
  }
  setCursorColumnSelectData(columnSelectData) {
    this._cursor.setCursorColumnSelectData(columnSelectData);
  }
  getPrevEditOperationType() {
    return this._cursor.getPrevEditOperationType();
  }
  setPrevEditOperationType(type) {
    this._cursor.setPrevEditOperationType(type);
  }
  getSelection() {
    return this._cursor.getSelection();
  }
  getSelections() {
    return this._cursor.getSelections();
  }
  getPosition() {
    return this._cursor.getPrimaryCursorState().modelState.position;
  }
  setSelections(source, selections, reason = CursorChangeReason.NotSet) {
    this._withViewEventsCollector((eventsCollector) => this._cursor.setSelections(eventsCollector, source, selections, reason));
  }
  saveCursorState() {
    return this._cursor.saveState();
  }
  restoreCursorState(states) {
    this._withViewEventsCollector((eventsCollector) => this._cursor.restoreState(eventsCollector, states));
  }
  _executeCursorEdit(callback) {
    if (this._cursor.context.cursorConfig.readOnly) {
      this._eventDispatcher.emitOutgoingEvent(new ReadOnlyEditAttemptEvent());
      return;
    }
    this._withViewEventsCollector(callback);
  }
  executeEdits(source, edits, cursorStateComputer) {
    this._executeCursorEdit((eventsCollector) => this._cursor.executeEdits(eventsCollector, source, edits, cursorStateComputer));
  }
  startComposition() {
    this._executeCursorEdit((eventsCollector) => this._cursor.startComposition(eventsCollector));
  }
  endComposition(source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.endComposition(eventsCollector, source));
  }
  type(text, source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.type(eventsCollector, text, source));
  }
  compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.compositionType(eventsCollector, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source));
  }
  paste(text, pasteOnNewLine, multicursorText, source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.paste(eventsCollector, text, pasteOnNewLine, multicursorText, source));
  }
  cut(source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.cut(eventsCollector, source));
  }
  executeCommand(command, source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.executeCommand(eventsCollector, command, source));
  }
  executeCommands(commands, source) {
    this._executeCursorEdit((eventsCollector) => this._cursor.executeCommands(eventsCollector, commands, source));
  }
  revealAllCursors(source, revealHorizontal, minimalReveal = false) {
    this._withViewEventsCollector((eventsCollector) => this._cursor.revealAll(eventsCollector, source, minimalReveal, viewEvents.VerticalRevealType.Simple, revealHorizontal, ScrollType.Smooth));
  }
  revealPrimaryCursor(source, revealHorizontal, minimalReveal = false) {
    this._withViewEventsCollector((eventsCollector) => this._cursor.revealPrimary(eventsCollector, source, minimalReveal, viewEvents.VerticalRevealType.Simple, revealHorizontal, ScrollType.Smooth));
  }
  revealTopMostCursor(source) {
    const viewPosition = this._cursor.getTopMostViewPosition();
    const viewRange = new Range(viewPosition.lineNumber, viewPosition.column, viewPosition.lineNumber, viewPosition.column);
    this._withViewEventsCollector((eventsCollector) => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, viewEvents.VerticalRevealType.Simple, true, ScrollType.Smooth)));
  }
  revealBottomMostCursor(source) {
    const viewPosition = this._cursor.getBottomMostViewPosition();
    const viewRange = new Range(viewPosition.lineNumber, viewPosition.column, viewPosition.lineNumber, viewPosition.column);
    this._withViewEventsCollector((eventsCollector) => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, viewEvents.VerticalRevealType.Simple, true, ScrollType.Smooth)));
  }
  revealRange(source, revealHorizontal, viewRange, verticalType, scrollType) {
    this._withViewEventsCollector((eventsCollector) => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, verticalType, revealHorizontal, scrollType)));
  }
  //#endregion
  //#region viewLayout
  changeWhitespace(callback) {
    const hadAChange = this.viewLayout.changeWhitespace(callback);
    if (hadAChange) {
      this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewZonesChangedEvent());
      this._eventDispatcher.emitOutgoingEvent(new ViewZonesChangedEvent());
    }
  }
  //#endregion
  _withViewEventsCollector(callback) {
    return this._transactionalTarget.batchChanges(() => {
      try {
        const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
        return callback(eventsCollector);
      } finally {
        this._eventDispatcher.endEmitViewEvents();
      }
    });
  }
  batchEvents(callback) {
    this._withViewEventsCollector(() => {
      callback();
    });
  }
  normalizePosition(position, affinity) {
    return this._lines.normalizePosition(position, affinity);
  }
  /**
   * Gets the column at which indentation stops at a given line.
   * @internal
  */
  getLineIndentColumn(lineNumber) {
    return this._lines.getLineIndentColumn(lineNumber);
  }
}
class ViewportStart {
  constructor(_model, _viewLineNumber, _isValid, _modelTrackedRange, _startLineDelta) {
    this._model = _model;
    this._viewLineNumber = _viewLineNumber;
    this._isValid = _isValid;
    this._modelTrackedRange = _modelTrackedRange;
    this._startLineDelta = _startLineDelta;
  }
  static create(model) {
    const viewportStartLineTrackedRange = model._setTrackedRange(null, new Range(1, 1, 1, 1), TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
    return new ViewportStart(model, 1, false, viewportStartLineTrackedRange, 0);
  }
  get viewLineNumber() {
    return this._viewLineNumber;
  }
  get isValid() {
    return this._isValid;
  }
  get modelTrackedRange() {
    return this._modelTrackedRange;
  }
  get startLineDelta() {
    return this._startLineDelta;
  }
  dispose() {
    this._model._setTrackedRange(this._modelTrackedRange, null, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
  }
  update(viewModel, startLineNumber) {
    const position = viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(startLineNumber, viewModel.getLineMinColumn(startLineNumber)));
    const viewportStartLineTrackedRange = viewModel.model._setTrackedRange(this._modelTrackedRange, new Range(position.lineNumber, position.column, position.lineNumber, position.column), TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
    const viewportStartLineTop = viewModel.viewLayout.getVerticalOffsetForLineNumber(startLineNumber);
    const scrollTop = viewModel.viewLayout.getCurrentScrollTop();
    this._viewLineNumber = startLineNumber;
    this._isValid = true;
    this._modelTrackedRange = viewportStartLineTrackedRange;
    this._startLineDelta = scrollTop - viewportStartLineTop;
  }
  invalidate() {
    this._isValid = false;
  }
}
class OverviewRulerDecorations {
  constructor() {
    this._asMap = /* @__PURE__ */ Object.create(null);
    this.asArray = [];
  }
  accept(color, zIndex, startLineNumber, endLineNumber, lane) {
    const prevGroup = this._asMap[color];
    if (prevGroup) {
      const prevData = prevGroup.data;
      const prevLane = prevData[prevData.length - 3];
      const prevEndLineNumber = prevData[prevData.length - 1];
      if (prevLane === lane && prevEndLineNumber + 1 >= startLineNumber) {
        if (endLineNumber > prevEndLineNumber) {
          prevData[prevData.length - 1] = endLineNumber;
        }
        return;
      }
      prevData.push(lane, startLineNumber, endLineNumber);
    } else {
      const group = new OverviewRulerDecorationsGroup(color, zIndex, [lane, startLineNumber, endLineNumber]);
      this._asMap[color] = group;
      this.asArray.push(group);
    }
  }
}
class HiddenAreasModel {
  constructor() {
    this.hiddenAreas = /* @__PURE__ */ new Map();
    this.shouldRecompute = false;
    this.ranges = [];
  }
  setHiddenAreas(source, ranges) {
    const existing = this.hiddenAreas.get(source);
    if (existing && rangeArraysEqual(existing, ranges)) {
      return;
    }
    this.hiddenAreas.set(source, ranges);
    this.shouldRecompute = true;
  }
  /**
   * The returned array is immutable.
  */
  getMergedRanges() {
    if (!this.shouldRecompute) {
      return this.ranges;
    }
    this.shouldRecompute = false;
    const newRanges = Array.from(this.hiddenAreas.values()).reduce((r, hiddenAreas) => mergeLineRangeArray(r, hiddenAreas), []);
    if (rangeArraysEqual(this.ranges, newRanges)) {
      return this.ranges;
    }
    this.ranges = newRanges;
    return this.ranges;
  }
}
function mergeLineRangeArray(arr1, arr2) {
  const result = [];
  let i = 0;
  let j = 0;
  while (i < arr1.length && j < arr2.length) {
    const item1 = arr1[i];
    const item2 = arr2[j];
    if (item1.endLineNumber < item2.startLineNumber - 1) {
      result.push(arr1[i++]);
    } else if (item2.endLineNumber < item1.startLineNumber - 1) {
      result.push(arr2[j++]);
    } else {
      const startLineNumber = Math.min(item1.startLineNumber, item2.startLineNumber);
      const endLineNumber = Math.max(item1.endLineNumber, item2.endLineNumber);
      result.push(new Range(startLineNumber, 1, endLineNumber, 1));
      i++;
      j++;
    }
  }
  while (i < arr1.length) {
    result.push(arr1[i++]);
  }
  while (j < arr2.length) {
    result.push(arr2[j++]);
  }
  return result;
}
function rangeArraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (!arr1[i].equalsRange(arr2[i])) {
      return false;
    }
  }
  return true;
}
class StableViewport {
  constructor(viewportStartModelPosition, startLineDelta) {
    this.viewportStartModelPosition = viewportStartModelPosition;
    this.startLineDelta = startLineDelta;
  }
  recoverViewportStart(coordinatesConverter, viewLayout) {
    if (!this.viewportStartModelPosition) {
      return;
    }
    const viewPosition = coordinatesConverter.convertModelPositionToViewPosition(this.viewportStartModelPosition);
    const viewPositionTop = viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
    viewLayout.setScrollPosition({ scrollTop: viewPositionTop + this.startLineDelta }, ScrollType.Immediate);
  }
}
export {
  ViewModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxJbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQXJyYXlRdWV1ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50LCBFZGl0b3JPcHRpb24sIEVESVRPUl9GT05UX0RFRkFVTFRTLCBmaWx0ZXJWYWxpZGF0aW9uRGVjb3JhdGlvbnMgfSBmcm9tICcuLi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JzQ29udHJvbGxlciB9IGZyb20gJy4uL2N1cnNvci9jdXJzb3IuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29uZmlndXJhdGlvbiwgQ3Vyc29yU3RhdGUsIEVkaXRPcGVyYXRpb25UeXBlLCBJQ29sdW1uU2VsZWN0RGF0YSwgUGFydGlhbEN1cnNvclN0YXRlIH0gZnJvbSAnLi4vY3Vyc29yQ29tbW9uLmpzJztcbmltcG9ydCB7IEN1cnNvckNoYW5nZVJlYXNvbiB9IGZyb20gJy4uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGlvbiwgU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmQsIElDdXJzb3JTdGF0ZSwgSVZpZXdTdGF0ZSwgU2Nyb2xsVHlwZSB9IGZyb20gJy4uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVByZWZlcmVuY2UsIElBdHRhY2hlZFZpZXcsIElDdXJzb3JTdGF0ZUNvbXB1dGVyLCBJR2x5cGhNYXJnaW5MYW5lc01vZGVsLCBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24sIElUZXh0TW9kZWwsIFBvc2l0aW9uQWZmaW5pdHksIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJQWN0aXZlSW5kZW50R3VpZGVJbmZvLCBCcmFja2V0R3VpZGVPcHRpb25zLCBJbmRlbnRHdWlkZSB9IGZyb20gJy4uL3RleHRNb2RlbEd1aWRlcy5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25NaW5pbWFwT3B0aW9ucywgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgTW9kZWxEZWNvcmF0aW9uT3ZlcnZpZXdSdWxlck9wdGlvbnMgfSBmcm9tICcuLi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0ICogYXMgdGV4dE1vZGVsRXZlbnRzIGZyb20gJy4uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBDb2xvcklkIH0gZnJvbSAnLi4vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyB0b2tlbml6ZUxpbmVUb0hUTUwgfSBmcm9tICcuLi9sYW5ndWFnZXMvdGV4dFRvSHRtbFRva2VuaXplci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JUaGVtZSB9IGZyb20gJy4uL2VkaXRvclRoZW1lLmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi4vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBWaWV3TGF5b3V0IH0gZnJvbSAnLi4vdmlld0xheW91dC92aWV3TGF5b3V0LmpzJztcbmltcG9ydCB7IE1pbmltYXBUb2tlbnNDb2xvclRyYWNrZXIgfSBmcm9tICcuL21pbmltYXBUb2tlbnNDb2xvclRyYWNrZXIuanMnO1xuaW1wb3J0IHsgSUxpbmVCcmVha3NDb21wdXRlciwgSUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnksIEluamVjdGVkVGV4dCB9IGZyb20gJy4uL21vZGVsTGluZVByb2plY3Rpb25EYXRhLmpzJztcbmltcG9ydCB7IFZpZXdFdmVudEhhbmRsZXIgfSBmcm9tICcuLi92aWV3RXZlbnRIYW5kbGVyLmpzJztcbmltcG9ydCB7IElDb29yZGluYXRlc0NvbnZlcnRlciwgSW5saW5lRGVjb3JhdGlvbiwgSVZpZXdNb2RlbCwgSVdoaXRlc3BhY2VDaGFuZ2VBY2Nlc3NvciwgTWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YSwgT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zR3JvdXAsIFZpZXdMaW5lRGF0YSwgVmlld0xpbmVSZW5kZXJpbmdEYXRhLCBWaWV3TW9kZWxEZWNvcmF0aW9uIH0gZnJvbSAnLi4vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IFZpZXdNb2RlbERlY29yYXRpb25zIH0gZnJvbSAnLi92aWV3TW9kZWxEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBGb2N1c0NoYW5nZWRFdmVudCwgSGlkZGVuQXJlYXNDaGFuZ2VkRXZlbnQsIE1vZGVsQ29udGVudENoYW5nZWRFdmVudCwgTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCwgTW9kZWxMYW5ndWFnZUNoYW5nZWRFdmVudCwgTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIE1vZGVsT3B0aW9uc0NoYW5nZWRFdmVudCwgTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQsIE91dGdvaW5nVmlld01vZGVsRXZlbnQsIFJlYWRPbmx5RWRpdEF0dGVtcHRFdmVudCwgU2Nyb2xsQ2hhbmdlZEV2ZW50LCBWaWV3TW9kZWxFdmVudERpc3BhdGNoZXIsIFZpZXdNb2RlbEV2ZW50c0NvbGxlY3RvciwgVmlld1pvbmVzQ2hhbmdlZEV2ZW50LCBXaWRnZXRGb2N1c0NoYW5nZWRFdmVudCB9IGZyb20gJy4uL3ZpZXdNb2RlbEV2ZW50RGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBJVmlld01vZGVsTGluZXMsIFZpZXdNb2RlbExpbmVzRnJvbU1vZGVsQXNJcywgVmlld01vZGVsTGluZXNGcm9tUHJvamVjdGVkTW9kZWwgfSBmcm9tICcuL3ZpZXdNb2RlbExpbmVzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEdseXBoTWFyZ2luTGFuZXNNb2RlbCB9IGZyb20gJy4vZ2x5cGhMYW5lc01vZGVsLmpzJztcblxuY29uc3QgVVNFX0lERU5USVRZX0xJTkVTX0NPTExFQ1RJT04gPSB0cnVlO1xuXG5leHBvcnQgY2xhc3MgVmlld01vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElWaWV3TW9kZWwge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcklkOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb246IElFZGl0b3JDb25maWd1cmF0aW9uO1xuXHRwdWJsaWMgcmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2V2ZW50RGlzcGF0Y2hlcjogVmlld01vZGVsRXZlbnREaXNwYXRjaGVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25FdmVudDogRXZlbnQ8T3V0Z29pbmdWaWV3TW9kZWxFdmVudD47XG5cdHB1YmxpYyBjdXJzb3JDb25maWc6IEN1cnNvckNvbmZpZ3VyYXRpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwZGF0ZUNvbmZpZ3VyYXRpb25WaWV3TGluZUNvdW50OiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIF9oYXNGb2N1czogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld3BvcnRTdGFydDogVmlld3BvcnRTdGFydDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGluZXM6IElWaWV3TW9kZWxMaW5lcztcblx0cHVibGljIHJlYWRvbmx5IGNvb3JkaW5hdGVzQ29udmVydGVyOiBJQ29vcmRpbmF0ZXNDb252ZXJ0ZXI7XG5cdHB1YmxpYyByZWFkb25seSB2aWV3TGF5b3V0OiBWaWV3TGF5b3V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJzb3I6IEN1cnNvcnNDb250cm9sbGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uczogVmlld01vZGVsRGVjb3JhdGlvbnM7XG5cdHB1YmxpYyByZWFkb25seSBnbHlwaExhbmVzOiBJR2x5cGhNYXJnaW5MYW5lc01vZGVsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcklkOiBudW1iZXIsXG5cdFx0Y29uZmlndXJhdGlvbjogSUVkaXRvckNvbmZpZ3VyYXRpb24sXG5cdFx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0ZG9tTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeTogSUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnksXG5cdFx0bW9ub3NwYWNlTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeTogSUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnksXG5cdFx0c2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZTogKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiBJRGlzcG9zYWJsZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9hdHRhY2hlZFZpZXc6IElBdHRhY2hlZFZpZXcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdHJhbnNhY3Rpb25hbFRhcmdldDogSUJhdGNoYWJsZVRhcmdldCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2VkaXRvcklkID0gZWRpdG9ySWQ7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb247XG5cdFx0dGhpcy5tb2RlbCA9IG1vZGVsO1xuXHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlciA9IG5ldyBWaWV3TW9kZWxFdmVudERpc3BhdGNoZXIoKTtcblx0XHR0aGlzLm9uRXZlbnQgPSB0aGlzLl9ldmVudERpc3BhdGNoZXIub25FdmVudDtcblx0XHR0aGlzLmN1cnNvckNvbmZpZyA9IG5ldyBDdXJzb3JDb25maWd1cmF0aW9uKHRoaXMubW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCB0aGlzLm1vZGVsLmdldE9wdGlvbnMoKSwgdGhpcy5fY29uZmlndXJhdGlvbiwgdGhpcy5sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLl91cGRhdGVDb25maWd1cmF0aW9uVmlld0xpbmVDb3VudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuX3VwZGF0ZUNvbmZpZ3VyYXRpb25WaWV3TGluZUNvdW50Tm93KCksIDApKTtcblx0XHR0aGlzLl9oYXNGb2N1cyA9IGZhbHNlO1xuXHRcdHRoaXMuX3ZpZXdwb3J0U3RhcnQgPSBWaWV3cG9ydFN0YXJ0LmNyZWF0ZSh0aGlzLm1vZGVsKTtcblx0XHR0aGlzLmdseXBoTGFuZXMgPSBuZXcgR2x5cGhNYXJnaW5MYW5lc01vZGVsKDApO1xuXG5cdFx0aWYgKFVTRV9JREVOVElUWV9MSU5FU19DT0xMRUNUSU9OICYmIHRoaXMubW9kZWwuaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpKSB7XG5cblx0XHRcdHRoaXMuX2xpbmVzID0gbmV3IFZpZXdNb2RlbExpbmVzRnJvbU1vZGVsQXNJcyh0aGlzLm1vZGVsKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdFx0Y29uc3QgZm9udEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdFx0Y29uc3Qgd3JhcHBpbmdTdHJhdGVneSA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53cmFwcGluZ1N0cmF0ZWd5KTtcblx0XHRcdGNvbnN0IHdyYXBwaW5nSW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53cmFwcGluZ0luZm8pO1xuXHRcdFx0Y29uc3Qgd3JhcHBpbmdJbmRlbnQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ud3JhcHBpbmdJbmRlbnQpO1xuXHRcdFx0Y29uc3Qgd29yZEJyZWFrID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndvcmRCcmVhayk7XG5cblx0XHRcdHRoaXMuX2xpbmVzID0gbmV3IFZpZXdNb2RlbExpbmVzRnJvbVByb2plY3RlZE1vZGVsKFxuXHRcdFx0XHR0aGlzLl9lZGl0b3JJZCxcblx0XHRcdFx0dGhpcy5tb2RlbCxcblx0XHRcdFx0ZG9tTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSxcblx0XHRcdFx0bW9ub3NwYWNlTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSxcblx0XHRcdFx0Zm9udEluZm8sXG5cdFx0XHRcdHRoaXMubW9kZWwuZ2V0T3B0aW9ucygpLnRhYlNpemUsXG5cdFx0XHRcdHdyYXBwaW5nU3RyYXRlZ3ksXG5cdFx0XHRcdHdyYXBwaW5nSW5mby53cmFwcGluZ0NvbHVtbixcblx0XHRcdFx0d3JhcHBpbmdJbmRlbnQsXG5cdFx0XHRcdHdvcmRCcmVha1xuXHRcdFx0KTtcblx0XHR9XG5cblx0XHR0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyID0gdGhpcy5fbGluZXMuY3JlYXRlQ29vcmRpbmF0ZXNDb252ZXJ0ZXIoKTtcblxuXHRcdHRoaXMuX2N1cnNvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDdXJzb3JzQ29udHJvbGxlcihtb2RlbCwgdGhpcywgdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlciwgdGhpcy5jdXJzb3JDb25maWcpKTtcblxuXHRcdHRoaXMudmlld0xheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBWaWV3TGF5b3V0KHRoaXMuX2NvbmZpZ3VyYXRpb24sIHRoaXMuZ2V0TGluZUNvdW50KCksIHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0xheW91dC5vbkRpZFNjcm9sbCgoZSkgPT4ge1xuXHRcdFx0aWYgKGUuc2Nyb2xsVG9wQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLl9oYW5kbGVWaXNpYmxlTGluZXNDaGFuZ2VkKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX3ZpZXdwb3J0U3RhcnQuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRTaW5nbGVWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld1Njcm9sbENoYW5nZWRFdmVudChlKSk7XG5cdFx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW1pdE91dGdvaW5nRXZlbnQobmV3IFNjcm9sbENoYW5nZWRFdmVudChcblx0XHRcdFx0ZS5vbGRTY3JvbGxXaWR0aCwgZS5vbGRTY3JvbGxMZWZ0LCBlLm9sZFNjcm9sbEhlaWdodCwgZS5vbGRTY3JvbGxUb3AsXG5cdFx0XHRcdGUuc2Nyb2xsV2lkdGgsIGUuc2Nyb2xsTGVmdCwgZS5zY3JvbGxIZWlnaHQsIGUuc2Nyb2xsVG9wXG5cdFx0XHQpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdMYXlvdXQub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRPdXRnb2luZ0V2ZW50KGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2RlY29yYXRpb25zID0gbmV3IFZpZXdNb2RlbERlY29yYXRpb25zKHRoaXMuX2VkaXRvcklkLCB0aGlzLm1vZGVsLCB0aGlzLl9jb25maWd1cmF0aW9uLCB0aGlzLl9saW5lcywgdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlcik7XG5cblx0XHR0aGlzLl9yZWdpc3Rlck1vZGVsRXZlbnRzKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uLm9uRGlkQ2hhbmdlRmFzdCgoZSkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgZXZlbnRzQ29sbGVjdG9yID0gdGhpcy5fZXZlbnREaXNwYXRjaGVyLmJlZ2luRW1pdFZpZXdFdmVudHMoKTtcblx0XHRcdFx0dGhpcy5fb25Db25maWd1cmF0aW9uQ2hhbmdlZChldmVudHNDb2xsZWN0b3IsIGUpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVuZEVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoTWluaW1hcFRva2Vuc0NvbG9yVHJhY2tlci5nZXRJbnN0YW5jZSgpLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdUb2tlbnNDb2xvcnNDaGFuZ2VkRXZlbnQoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSgodGhlbWUpID0+IHtcblx0XHRcdHRoaXMuX2ludmFsaWRhdGVEZWNvcmF0aW9uc0NvbG9yQ2FjaGUoKTtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdUaGVtZUNoYW5nZWRFdmVudCh0aGVtZSkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3VwZGF0ZUNvbmZpZ3VyYXRpb25WaWV3TGluZUNvdW50Tm93KCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHQvLyBGaXJzdCByZW1vdmUgbGlzdGVuZXJzLCBhcyBkaXNwb3NpbmcgdGhlIGxpbmVzIG1pZ2h0IGVuZCB1cCBzZW5kaW5nXG5cdFx0Ly8gbW9kZWwgZGVjb3JhdGlvbiBjaGFuZ2VkIGV2ZW50cyAuLi4gYW5kIHdlIG5vIGxvbmdlciBjYXJlIGFib3V0IHRoZW0gLi4uXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9saW5lcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fdmlld3BvcnRTdGFydC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVMaW5lQnJlYWtzQ29tcHV0ZXIoKTogSUxpbmVCcmVha3NDb21wdXRlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmNyZWF0ZUxpbmVCcmVha3NDb21wdXRlcigpO1xuXHR9XG5cblx0cHVibGljIGFkZFZpZXdFdmVudEhhbmRsZXIoZXZlbnRIYW5kbGVyOiBWaWV3RXZlbnRIYW5kbGVyKTogdm9pZCB7XG5cdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmFkZFZpZXdFdmVudEhhbmRsZXIoZXZlbnRIYW5kbGVyKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVWaWV3RXZlbnRIYW5kbGVyKGV2ZW50SGFuZGxlcjogVmlld0V2ZW50SGFuZGxlcik6IHZvaWQge1xuXHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5yZW1vdmVWaWV3RXZlbnRIYW5kbGVyKGV2ZW50SGFuZGxlcik7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb25maWd1cmF0aW9uVmlld0xpbmVDb3VudE5vdygpOiB2b2lkIHtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnNldFZpZXdMaW5lQ291bnQodGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVDb3VudCgpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TW9kZWxWaXNpYmxlUmFuZ2VzKCk6IFJhbmdlW10ge1xuXHRcdGNvbnN0IGxpbmVzVmlld3BvcnREYXRhID0gdGhpcy52aWV3TGF5b3V0LmdldExpbmVzVmlld3BvcnREYXRhKCk7XG5cdFx0Y29uc3Qgdmlld1Zpc2libGVSYW5nZSA9IG5ldyBSYW5nZShcblx0XHRcdGxpbmVzVmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdHRoaXMuZ2V0TGluZU1pbkNvbHVtbihsaW5lc1ZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIpLFxuXHRcdFx0bGluZXNWaWV3cG9ydERhdGEuZW5kTGluZU51bWJlcixcblx0XHRcdHRoaXMuZ2V0TGluZU1heENvbHVtbihsaW5lc1ZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyKVxuXHRcdCk7XG5cdFx0Y29uc3QgbW9kZWxWaXNpYmxlUmFuZ2VzID0gdGhpcy5fdG9Nb2RlbFZpc2libGVSYW5nZXModmlld1Zpc2libGVSYW5nZSk7XG5cdFx0cmV0dXJuIG1vZGVsVmlzaWJsZVJhbmdlcztcblx0fVxuXG5cdHB1YmxpYyB2aXNpYmxlTGluZXNTdGFiaWxpemVkKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsVmlzaWJsZVJhbmdlcyA9IHRoaXMuZ2V0TW9kZWxWaXNpYmxlUmFuZ2VzKCk7XG5cdFx0dGhpcy5fYXR0YWNoZWRWaWV3LnNldFZpc2libGVMaW5lcyhtb2RlbFZpc2libGVSYW5nZXMsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlVmlzaWJsZUxpbmVzQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbFZpc2libGVSYW5nZXMgPSB0aGlzLmdldE1vZGVsVmlzaWJsZVJhbmdlcygpO1xuXHRcdHRoaXMuX2F0dGFjaGVkVmlldy5zZXRWaXNpYmxlTGluZXMobW9kZWxWaXNpYmxlUmFuZ2VzLCBmYWxzZSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0SGFzRm9jdXMoaGFzRm9jdXM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9oYXNGb2N1cyA9IGhhc0ZvY3VzO1xuXHRcdHRoaXMuX2N1cnNvci5zZXRIYXNGb2N1cyhoYXNGb2N1cyk7XG5cdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRTaW5nbGVWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0ZvY3VzQ2hhbmdlZEV2ZW50KGhhc0ZvY3VzKSk7XG5cdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRPdXRnb2luZ0V2ZW50KG5ldyBGb2N1c0NoYW5nZWRFdmVudCghaGFzRm9jdXMsIGhhc0ZvY3VzKSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0SGFzV2lkZ2V0Rm9jdXMoaGFzV2lkZ2V0Rm9jdXM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW1pdE91dGdvaW5nRXZlbnQobmV3IFdpZGdldEZvY3VzQ2hhbmdlZEV2ZW50KCFoYXNXaWRnZXRGb2N1cywgaGFzV2lkZ2V0Rm9jdXMpKTtcblx0fVxuXG5cdHB1YmxpYyBvbkNvbXBvc2l0aW9uU3RhcnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRTaW5nbGVWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0NvbXBvc2l0aW9uU3RhcnRFdmVudCgpKTtcblx0fVxuXG5cdHB1YmxpYyBvbkNvbXBvc2l0aW9uRW5kKCk6IHZvaWQge1xuXHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdDb21wb3NpdGlvbkVuZEV2ZW50KCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2FwdHVyZVN0YWJsZVZpZXdwb3J0KCk6IFN0YWJsZVZpZXdwb3J0IHtcblx0XHQvLyBXZSBtaWdodCBuZWVkIHRvIHJlc3RvcmUgdGhlIGN1cnJlbnQgc3RhcnQgdmlldyByYW5nZSwgc28gc2F2ZSBpdCAoaWYgYXZhaWxhYmxlKVxuXHRcdC8vIEJ1dCBvbmx5IGlmIHRoZSBzY3JvbGwgcG9zaXRpb24gaXMgbm90IGF0IHRoZSB0b3Agb2YgdGhlIGZpbGVcblx0XHRpZiAodGhpcy5fdmlld3BvcnRTdGFydC5pc1ZhbGlkICYmIHRoaXMudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsVG9wKCkgPiAwKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c1ZpZXdwb3J0U3RhcnRWaWV3UG9zaXRpb24gPSBuZXcgUG9zaXRpb24odGhpcy5fdmlld3BvcnRTdGFydC52aWV3TGluZU51bWJlciwgdGhpcy5nZXRMaW5lTWluQ29sdW1uKHRoaXMuX3ZpZXdwb3J0U3RhcnQudmlld0xpbmVOdW1iZXIpKTtcblx0XHRcdGNvbnN0IHByZXZpb3VzVmlld3BvcnRTdGFydE1vZGVsUG9zaXRpb24gPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24ocHJldmlvdXNWaWV3cG9ydFN0YXJ0Vmlld1Bvc2l0aW9uKTtcblx0XHRcdHJldHVybiBuZXcgU3RhYmxlVmlld3BvcnQocHJldmlvdXNWaWV3cG9ydFN0YXJ0TW9kZWxQb3NpdGlvbiwgdGhpcy5fdmlld3BvcnRTdGFydC5zdGFydExpbmVEZWx0YSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgU3RhYmxlVmlld3BvcnQobnVsbCwgMCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yLCBlOiBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhYmxlVmlld3BvcnQgPSB0aGlzLl9jYXB0dXJlU3RhYmxlVmlld3BvcnQoKTtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdGNvbnN0IGZvbnRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCB3cmFwcGluZ1N0cmF0ZWd5ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndyYXBwaW5nU3RyYXRlZ3kpO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53cmFwcGluZ0luZm8pO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5kZW50ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5kZW50KTtcblx0XHRjb25zdCB3b3JkQnJlYWsgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ud29yZEJyZWFrKTtcblxuXHRcdGlmICh0aGlzLl9saW5lcy5zZXRXcmFwcGluZ1NldHRpbmdzKGZvbnRJbmZvLCB3cmFwcGluZ1N0cmF0ZWd5LCB3cmFwcGluZ0luZm8ud3JhcHBpbmdDb2x1bW4sIHdyYXBwaW5nSW5kZW50LCB3b3JkQnJlYWspKSB7XG5cdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3Rmx1c2hlZEV2ZW50KCkpO1xuXHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0xpbmVNYXBwaW5nQ2hhbmdlZEV2ZW50KCkpO1xuXHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KG51bGwpKTtcblx0XHRcdHRoaXMuX2N1cnNvci5vbkxpbmVNYXBwaW5nQ2hhbmdlZChldmVudHNDb2xsZWN0b3IpO1xuXHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMub25MaW5lTWFwcGluZ0NoYW5nZWQoKTtcblx0XHRcdHRoaXMudmlld0xheW91dC5vbkZsdXNoZWQodGhpcy5nZXRMaW5lQ291bnQoKSk7XG5cblx0XHRcdHRoaXMuX3VwZGF0ZUNvbmZpZ3VyYXRpb25WaWV3TGluZUNvdW50LnNjaGVkdWxlKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHQvLyBNdXN0IHJlYWQgYWdhaW4gYWxsIGRlY29yYXRpb25zIGR1ZSB0byByZWFkT25seSBmaWx0ZXJpbmdcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zLnJlc2V0KCk7XG5cdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQobnVsbCkpO1xuXHRcdH1cblxuXHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucykpIHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zLnJlc2V0KCk7XG5cdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQobnVsbCkpO1xuXHRcdH1cblxuXHRcdGV2ZW50c0NvbGxlY3Rvci5lbWl0Vmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KGUpKTtcblx0XHR0aGlzLnZpZXdMYXlvdXQub25Db25maWd1cmF0aW9uQ2hhbmdlZChlKTtcblxuXHRcdHN0YWJsZVZpZXdwb3J0LnJlY292ZXJWaWV3cG9ydFN0YXJ0KHRoaXMuY29vcmRpbmF0ZXNDb252ZXJ0ZXIsIHRoaXMudmlld0xheW91dCk7XG5cblx0XHRpZiAoQ3Vyc29yQ29uZmlndXJhdGlvbi5zaG91bGRSZWNyZWF0ZShlKSkge1xuXHRcdFx0dGhpcy5jdXJzb3JDb25maWcgPSBuZXcgQ3Vyc29yQ29uZmlndXJhdGlvbih0aGlzLm1vZGVsLmdldExhbmd1YWdlSWQoKSwgdGhpcy5tb2RlbC5nZXRPcHRpb25zKCksIHRoaXMuX2NvbmZpZ3VyYXRpb24sIHRoaXMubGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHR0aGlzLl9jdXJzb3IudXBkYXRlQ29uZmlndXJhdGlvbih0aGlzLmN1cnNvckNvbmZpZyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJNb2RlbEV2ZW50cygpOiB2b2lkIHtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWwub25EaWRDaGFuZ2VDb250ZW50T3JJbmplY3RlZFRleHQoKGUpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50c0NvbGxlY3RvciA9IHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5iZWdpbkVtaXRWaWV3RXZlbnRzKCk7XG5cblx0XHRcdFx0bGV0IGhhZE90aGVyTW9kZWxDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdFx0bGV0IGhhZE1vZGVsTGluZUNoYW5nZVRoYXRDaGFuZ2VkTGluZU1hcHBpbmcgPSBmYWxzZTtcblxuXHRcdFx0XHRjb25zdCBjaGFuZ2VzID0gKGUgaW5zdGFuY2VvZiB0ZXh0TW9kZWxFdmVudHMuSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCA/IGUucmF3Q29udGVudENoYW5nZWRFdmVudC5jaGFuZ2VzIDogZS5jaGFuZ2VzKTtcblx0XHRcdFx0Y29uc3QgdmVyc2lvbklkID0gKGUgaW5zdGFuY2VvZiB0ZXh0TW9kZWxFdmVudHMuSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCA/IGUucmF3Q29udGVudENoYW5nZWRFdmVudC52ZXJzaW9uSWQgOiBudWxsKTtcblxuXHRcdFx0XHQvLyBEbyBhIGZpcnN0IHBhc3MgdG8gY29tcHV0ZSBsaW5lIG1hcHBpbmdzLCBhbmQgYSBzZWNvbmQgcGFzcyB0byBhY3R1YWxseSBpbnRlcnByZXQgdGhlbVxuXHRcdFx0XHRjb25zdCBsaW5lQnJlYWtzQ29tcHV0ZXIgPSB0aGlzLl9saW5lcy5jcmVhdGVMaW5lQnJlYWtzQ29tcHV0ZXIoKTtcblx0XHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgY2hhbmdlcykge1xuXHRcdFx0XHRcdHN3aXRjaCAoY2hhbmdlLmNoYW5nZVR5cGUpIHtcblx0XHRcdFx0XHRcdGNhc2UgdGV4dE1vZGVsRXZlbnRzLlJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5MaW5lc0luc2VydGVkOiB7XG5cdFx0XHRcdFx0XHRcdGZvciAobGV0IGxpbmVJZHggPSAwOyBsaW5lSWR4IDwgY2hhbmdlLmRldGFpbC5sZW5ndGg7IGxpbmVJZHgrKykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmUgPSBjaGFuZ2UuZGV0YWlsW2xpbmVJZHhdO1xuXHRcdFx0XHRcdFx0XHRcdGxldCBpbmplY3RlZFRleHQgPSBjaGFuZ2UuaW5qZWN0ZWRUZXh0c1tsaW5lSWR4XTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoaW5qZWN0ZWRUZXh0KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpbmplY3RlZFRleHQgPSBpbmplY3RlZFRleHQuZmlsdGVyKGVsZW1lbnQgPT4gKCFlbGVtZW50Lm93bmVySWQgfHwgZWxlbWVudC5vd25lcklkID09PSB0aGlzLl9lZGl0b3JJZCkpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRsaW5lQnJlYWtzQ29tcHV0ZXIuYWRkUmVxdWVzdChsaW5lLCBpbmplY3RlZFRleHQsIG51bGwpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FzZSB0ZXh0TW9kZWxFdmVudHMuUmF3Q29udGVudENoYW5nZWRUeXBlLkxpbmVDaGFuZ2VkOiB7XG5cdFx0XHRcdFx0XHRcdGxldCBpbmplY3RlZFRleHQ6IHRleHRNb2RlbEV2ZW50cy5MaW5lSW5qZWN0ZWRUZXh0W10gfCBudWxsID0gbnVsbDtcblx0XHRcdFx0XHRcdFx0aWYgKGNoYW5nZS5pbmplY3RlZFRleHQpIHtcblx0XHRcdFx0XHRcdFx0XHRpbmplY3RlZFRleHQgPSBjaGFuZ2UuaW5qZWN0ZWRUZXh0LmZpbHRlcihlbGVtZW50ID0+ICghZWxlbWVudC5vd25lcklkIHx8IGVsZW1lbnQub3duZXJJZCA9PT0gdGhpcy5fZWRpdG9ySWQpKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRsaW5lQnJlYWtzQ29tcHV0ZXIuYWRkUmVxdWVzdChjaGFuZ2UuZGV0YWlsLCBpbmplY3RlZFRleHQsIG51bGwpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbGluZUJyZWFrcyA9IGxpbmVCcmVha3NDb21wdXRlci5maW5hbGl6ZSgpO1xuXHRcdFx0XHRjb25zdCBsaW5lQnJlYWtRdWV1ZSA9IG5ldyBBcnJheVF1ZXVlKGxpbmVCcmVha3MpO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcblx0XHRcdFx0XHRzd2l0Y2ggKGNoYW5nZS5jaGFuZ2VUeXBlKSB7XG5cdFx0XHRcdFx0XHRjYXNlIHRleHRNb2RlbEV2ZW50cy5SYXdDb250ZW50Q2hhbmdlZFR5cGUuRmx1c2g6IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbGluZXMub25Nb2RlbEZsdXNoZWQoKTtcblx0XHRcdFx0XHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCgpKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMucmVzZXQoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy52aWV3TGF5b3V0Lm9uRmx1c2hlZCh0aGlzLmdldExpbmVDb3VudCgpKTtcblx0XHRcdFx0XHRcdFx0aGFkT3RoZXJNb2RlbENoYW5nZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FzZSB0ZXh0TW9kZWxFdmVudHMuUmF3Q29udGVudENoYW5nZWRUeXBlLkxpbmVzRGVsZXRlZDoge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsaW5lc0RlbGV0ZWRFdmVudCA9IHRoaXMuX2xpbmVzLm9uTW9kZWxMaW5lc0RlbGV0ZWQodmVyc2lvbklkLCBjaGFuZ2UuZnJvbUxpbmVOdW1iZXIsIGNoYW5nZS50b0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRpZiAobGluZXNEZWxldGVkRXZlbnQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChsaW5lc0RlbGV0ZWRFdmVudCk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy52aWV3TGF5b3V0Lm9uTGluZXNEZWxldGVkKGxpbmVzRGVsZXRlZEV2ZW50LmZyb21MaW5lTnVtYmVyLCBsaW5lc0RlbGV0ZWRFdmVudC50b0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGhhZE90aGVyTW9kZWxDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhc2UgdGV4dE1vZGVsRXZlbnRzLlJhd0NvbnRlbnRDaGFuZ2VkVHlwZS5MaW5lc0luc2VydGVkOiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGluc2VydGVkTGluZUJyZWFrcyA9IGxpbmVCcmVha1F1ZXVlLnRha2VDb3VudChjaGFuZ2UuZGV0YWlsLmxlbmd0aCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmVzSW5zZXJ0ZWRFdmVudCA9IHRoaXMuX2xpbmVzLm9uTW9kZWxMaW5lc0luc2VydGVkKHZlcnNpb25JZCwgY2hhbmdlLmZyb21MaW5lTnVtYmVyLCBjaGFuZ2UudG9MaW5lTnVtYmVyLCBpbnNlcnRlZExpbmVCcmVha3MpO1xuXHRcdFx0XHRcdFx0XHRpZiAobGluZXNJbnNlcnRlZEV2ZW50ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobGluZXNJbnNlcnRlZEV2ZW50KTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnZpZXdMYXlvdXQub25MaW5lc0luc2VydGVkKGxpbmVzSW5zZXJ0ZWRFdmVudC5mcm9tTGluZU51bWJlciwgbGluZXNJbnNlcnRlZEV2ZW50LnRvTGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aGFkT3RoZXJNb2RlbENoYW5nZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FzZSB0ZXh0TW9kZWxFdmVudHMuUmF3Q29udGVudENoYW5nZWRUeXBlLkxpbmVDaGFuZ2VkOiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNoYW5nZWRMaW5lQnJlYWtEYXRhID0gbGluZUJyZWFrUXVldWUuZGVxdWV1ZSgpITtcblx0XHRcdFx0XHRcdFx0Y29uc3QgW2xpbmVNYXBwaW5nQ2hhbmdlZCwgbGluZXNDaGFuZ2VkRXZlbnQsIGxpbmVzSW5zZXJ0ZWRFdmVudCwgbGluZXNEZWxldGVkRXZlbnRdID1cblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9saW5lcy5vbk1vZGVsTGluZUNoYW5nZWQodmVyc2lvbklkLCBjaGFuZ2UubGluZU51bWJlciwgY2hhbmdlZExpbmVCcmVha0RhdGEpO1xuXHRcdFx0XHRcdFx0XHRoYWRNb2RlbExpbmVDaGFuZ2VUaGF0Q2hhbmdlZExpbmVNYXBwaW5nID0gbGluZU1hcHBpbmdDaGFuZ2VkO1xuXHRcdFx0XHRcdFx0XHRpZiAobGluZXNDaGFuZ2VkRXZlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChsaW5lc0NoYW5nZWRFdmVudCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKGxpbmVzSW5zZXJ0ZWRFdmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdGV2ZW50c0NvbGxlY3Rvci5lbWl0Vmlld0V2ZW50KGxpbmVzSW5zZXJ0ZWRFdmVudCk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy52aWV3TGF5b3V0Lm9uTGluZXNJbnNlcnRlZChsaW5lc0luc2VydGVkRXZlbnQuZnJvbUxpbmVOdW1iZXIsIGxpbmVzSW5zZXJ0ZWRFdmVudC50b0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChsaW5lc0RlbGV0ZWRFdmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdGV2ZW50c0NvbGxlY3Rvci5lbWl0Vmlld0V2ZW50KGxpbmVzRGVsZXRlZEV2ZW50KTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnZpZXdMYXlvdXQub25MaW5lc0RlbGV0ZWQobGluZXNEZWxldGVkRXZlbnQuZnJvbUxpbmVOdW1iZXIsIGxpbmVzRGVsZXRlZEV2ZW50LnRvTGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXNlIHRleHRNb2RlbEV2ZW50cy5SYXdDb250ZW50Q2hhbmdlZFR5cGUuRU9MQ2hhbmdlZDoge1xuXHRcdFx0XHRcdFx0XHQvLyBOb3RoaW5nIHRvIGRvLiBUaGUgbmV3IHZlcnNpb24gd2lsbCBiZSBhY2NlcHRlZCBiZWxvd1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodmVyc2lvbklkICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0dGhpcy5fbGluZXMuYWNjZXB0VmVyc2lvbklkKHZlcnNpb25JZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy52aWV3TGF5b3V0Lm9uSGVpZ2h0TWF5YmVDaGFuZ2VkKCk7XG5cblx0XHRcdFx0aWYgKCFoYWRPdGhlck1vZGVsQ2hhbmdlICYmIGhhZE1vZGVsTGluZUNoYW5nZVRoYXRDaGFuZ2VkTGluZU1hcHBpbmcpIHtcblx0XHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQoKSk7XG5cdFx0XHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KG51bGwpKTtcblx0XHRcdFx0XHR0aGlzLl9jdXJzb3Iub25MaW5lTWFwcGluZ0NoYW5nZWQoZXZlbnRzQ29sbGVjdG9yKTtcblx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5vbkxpbmVNYXBwaW5nQ2hhbmdlZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW5kRW1pdFZpZXdFdmVudHMoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVXBkYXRlIHRoZSBjb25maWd1cmF0aW9uIGFuZCByZXNldCB0aGUgY2VudGVyZWQgdmlldyBsaW5lXG5cdFx0XHRjb25zdCB2aWV3cG9ydFN0YXJ0V2FzVmFsaWQgPSB0aGlzLl92aWV3cG9ydFN0YXJ0LmlzVmFsaWQ7XG5cdFx0XHR0aGlzLl92aWV3cG9ydFN0YXJ0LmludmFsaWRhdGUoKTtcblx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24uc2V0TW9kZWxMaW5lQ291bnQodGhpcy5tb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0aGlzLl91cGRhdGVDb25maWd1cmF0aW9uVmlld0xpbmVDb3VudE5vdygpO1xuXG5cdFx0XHQvLyBSZWNvdmVyIHZpZXdwb3J0XG5cdFx0XHRpZiAoIXRoaXMuX2hhc0ZvY3VzICYmIHRoaXMubW9kZWwuZ2V0QXR0YWNoZWRFZGl0b3JDb3VudCgpID49IDIgJiYgdmlld3BvcnRTdGFydFdhc1ZhbGlkKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsUmFuZ2UgPSB0aGlzLm1vZGVsLl9nZXRUcmFja2VkUmFuZ2UodGhpcy5fdmlld3BvcnRTdGFydC5tb2RlbFRyYWNrZWRSYW5nZSk7XG5cdFx0XHRcdGlmIChtb2RlbFJhbmdlKSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKG1vZGVsUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdFx0XHRjb25zdCB2aWV3UG9zaXRpb25Ub3AgPSB0aGlzLnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdFx0XHR0aGlzLnZpZXdMYXlvdXQuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHZpZXdQb3NpdGlvblRvcCArIHRoaXMuX3ZpZXdwb3J0U3RhcnQuc3RhcnRMaW5lRGVsdGEgfSwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50c0NvbGxlY3RvciA9IHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5iZWdpbkVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHRcdGlmIChlIGluc3RhbmNlb2YgdGV4dE1vZGVsRXZlbnRzLkludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQpIHtcblx0XHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdE91dGdvaW5nRXZlbnQobmV3IE1vZGVsQ29udGVudENoYW5nZWRFdmVudChlLmNvbnRlbnRDaGFuZ2VkRXZlbnQpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jdXJzb3Iub25Nb2RlbENvbnRlbnRDaGFuZ2VkKGV2ZW50c0NvbGxlY3RvciwgZSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW5kRW1pdFZpZXdFdmVudHMoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5faGFuZGxlVmlzaWJsZUxpbmVzQ2hhbmdlZCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWwub25EaWRDaGFuZ2VUb2tlbnMoKGUpID0+IHtcblx0XHRcdGNvbnN0IHZpZXdSYW5nZXM6IHsgZnJvbUxpbmVOdW1iZXI6IG51bWJlcjsgdG9MaW5lTnVtYmVyOiBudW1iZXIgfVtdID0gW107XG5cdFx0XHRmb3IgKGxldCBqID0gMCwgbGVuSiA9IGUucmFuZ2VzLmxlbmd0aDsgaiA8IGxlbko7IGorKykge1xuXHRcdFx0XHRjb25zdCBtb2RlbFJhbmdlID0gZS5yYW5nZXNbal07XG5cdFx0XHRcdGNvbnN0IHZpZXdTdGFydExpbmVOdW1iZXIgPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24obmV3IFBvc2l0aW9uKG1vZGVsUmFuZ2UuZnJvbUxpbmVOdW1iZXIsIDEpKS5saW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCB2aWV3RW5kTGluZU51bWJlciA9IHRoaXMuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihuZXcgUG9zaXRpb24obW9kZWxSYW5nZS50b0xpbmVOdW1iZXIsIHRoaXMubW9kZWwuZ2V0TGluZU1heENvbHVtbihtb2RlbFJhbmdlLnRvTGluZU51bWJlcikpKS5saW5lTnVtYmVyO1xuXHRcdFx0XHR2aWV3UmFuZ2VzW2pdID0ge1xuXHRcdFx0XHRcdGZyb21MaW5lTnVtYmVyOiB2aWV3U3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdHRvTGluZU51bWJlcjogdmlld0VuZExpbmVOdW1iZXJcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdUb2tlbnNDaGFuZ2VkRXZlbnQodmlld1JhbmdlcykpO1xuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRPdXRnb2luZ0V2ZW50KG5ldyBNb2RlbFRva2Vuc0NoYW5nZWRFdmVudChlKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbC5vbkRpZENoYW5nZUxhbmd1YWdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRTaW5nbGVWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0xhbmd1YWdlQ29uZmlndXJhdGlvbkV2ZW50KCkpO1xuXHRcdFx0dGhpcy5jdXJzb3JDb25maWcgPSBuZXcgQ3Vyc29yQ29uZmlndXJhdGlvbih0aGlzLm1vZGVsLmdldExhbmd1YWdlSWQoKSwgdGhpcy5tb2RlbC5nZXRPcHRpb25zKCksIHRoaXMuX2NvbmZpZ3VyYXRpb24sIHRoaXMubGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHR0aGlzLl9jdXJzb3IudXBkYXRlQ29uZmlndXJhdGlvbih0aGlzLmN1cnNvckNvbmZpZyk7XG5cdFx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW1pdE91dGdvaW5nRXZlbnQobmV3IE1vZGVsTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KGUpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlTGFuZ3VhZ2UoKGUpID0+IHtcblx0XHRcdHRoaXMuY3Vyc29yQ29uZmlnID0gbmV3IEN1cnNvckNvbmZpZ3VyYXRpb24odGhpcy5tb2RlbC5nZXRMYW5ndWFnZUlkKCksIHRoaXMubW9kZWwuZ2V0T3B0aW9ucygpLCB0aGlzLl9jb25maWd1cmF0aW9uLCB0aGlzLmxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fY3Vyc29yLnVwZGF0ZUNvbmZpZ3VyYXRpb24odGhpcy5jdXJzb3JDb25maWcpO1xuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRPdXRnb2luZ0V2ZW50KG5ldyBNb2RlbExhbmd1YWdlQ2hhbmdlZEV2ZW50KGUpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlT3B0aW9ucygoZSkgPT4ge1xuXHRcdFx0Ly8gQSB0YWIgc2l6ZSBjaGFuZ2UgY2F1c2VzIGEgbGluZSBtYXBwaW5nIGNoYW5nZWQgZXZlbnQgPT4gYWxsIHZpZXcgcGFydHMgd2lsbCByZXBhaW50IE9LLCBubyBmdXJ0aGVyIGV2ZW50IG5lZWRlZCBoZXJlXG5cdFx0XHRpZiAodGhpcy5fbGluZXMuc2V0VGFiU2l6ZSh0aGlzLm1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplKSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGV2ZW50c0NvbGxlY3RvciA9IHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5iZWdpbkVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCgpKTtcblx0XHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQoKSk7XG5cdFx0XHRcdFx0ZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KG51bGwpKTtcblx0XHRcdFx0XHR0aGlzLl9jdXJzb3Iub25MaW5lTWFwcGluZ0NoYW5nZWQoZXZlbnRzQ29sbGVjdG9yKTtcblx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5vbkxpbmVNYXBwaW5nQ2hhbmdlZCgpO1xuXHRcdFx0XHRcdHRoaXMudmlld0xheW91dC5vbkZsdXNoZWQodGhpcy5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVuZEVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fdXBkYXRlQ29uZmlndXJhdGlvblZpZXdMaW5lQ291bnQuc2NoZWR1bGUoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5jdXJzb3JDb25maWcgPSBuZXcgQ3Vyc29yQ29uZmlndXJhdGlvbih0aGlzLm1vZGVsLmdldExhbmd1YWdlSWQoKSwgdGhpcy5tb2RlbC5nZXRPcHRpb25zKCksIHRoaXMuX2NvbmZpZ3VyYXRpb24sIHRoaXMubGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHR0aGlzLl9jdXJzb3IudXBkYXRlQ29uZmlndXJhdGlvbih0aGlzLmN1cnNvckNvbmZpZyk7XG5cblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0T3V0Z29pbmdFdmVudChuZXcgTW9kZWxPcHRpb25zQ2hhbmdlZEV2ZW50KGUpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMoKGUpID0+IHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zLm9uTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWQoKTtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudChlKSk7XG5cdFx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIuZW1pdE91dGdvaW5nRXZlbnQobmV3IE1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQoZSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgaGlkZGVuQXJlYXNNb2RlbCA9IG5ldyBIaWRkZW5BcmVhc01vZGVsKCk7XG5cdHByaXZhdGUgcHJldmlvdXNIaWRkZW5BcmVhczogcmVhZG9ubHkgUmFuZ2VbXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0gZm9yY2VVcGRhdGUgSWYgdHJ1ZSwgdGhlIGhpZGRlbiBhcmVhcyB3aWxsIGJlIHVwZGF0ZWQgZXZlbiBpZiB0aGUgbmV3IHJhbmdlcyBhcmUgdGhlIHNhbWUgYXMgdGhlIHByZXZpb3VzIHJhbmdlcy5cblx0ICogVGhpcyBpcyBiZWNhdXNlIHRoZSBtb2RlbCBtaWdodCBoYXZlIGNoYW5nZWQsIHdoaWNoIHJlc2V0cyB0aGUgaGlkZGVuIGFyZWFzLCBidXQgbm90IHRoZSBsYXN0IGNhY2hlZCB2YWx1ZS5cblx0ICogVGhpcyBuZWVkcyBhIGJldHRlciBmaXggaW4gdGhlIGZ1dHVyZS5cblx0Ki9cblx0cHVibGljIHNldEhpZGRlbkFyZWFzKHJhbmdlczogUmFuZ2VbXSwgc291cmNlPzogdW5rbm93biwgZm9yY2VVcGRhdGU/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5oaWRkZW5BcmVhc01vZGVsLnNldEhpZGRlbkFyZWFzKHNvdXJjZSwgcmFuZ2VzKTtcblx0XHRjb25zdCBtZXJnZWRSYW5nZXMgPSB0aGlzLmhpZGRlbkFyZWFzTW9kZWwuZ2V0TWVyZ2VkUmFuZ2VzKCk7XG5cdFx0aWYgKG1lcmdlZFJhbmdlcyA9PT0gdGhpcy5wcmV2aW91c0hpZGRlbkFyZWFzICYmICFmb3JjZVVwZGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucHJldmlvdXNIaWRkZW5BcmVhcyA9IG1lcmdlZFJhbmdlcztcblxuXHRcdGNvbnN0IHN0YWJsZVZpZXdwb3J0ID0gdGhpcy5fY2FwdHVyZVN0YWJsZVZpZXdwb3J0KCk7XG5cblx0XHRsZXQgbGluZU1hcHBpbmdDaGFuZ2VkID0gZmFsc2U7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV2ZW50c0NvbGxlY3RvciA9IHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5iZWdpbkVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHRsaW5lTWFwcGluZ0NoYW5nZWQgPSB0aGlzLl9saW5lcy5zZXRIaWRkZW5BcmVhcyhtZXJnZWRSYW5nZXMpO1xuXHRcdFx0aWYgKGxpbmVNYXBwaW5nQ2hhbmdlZCkge1xuXHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3Rmx1c2hlZEV2ZW50KCkpO1xuXHRcdFx0XHRldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQoKSk7XG5cdFx0XHRcdGV2ZW50c0NvbGxlY3Rvci5lbWl0Vmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudChudWxsKSk7XG5cdFx0XHRcdHRoaXMuX2N1cnNvci5vbkxpbmVNYXBwaW5nQ2hhbmdlZChldmVudHNDb2xsZWN0b3IpO1xuXHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5vbkxpbmVNYXBwaW5nQ2hhbmdlZCgpO1xuXHRcdFx0XHR0aGlzLnZpZXdMYXlvdXQub25GbHVzaGVkKHRoaXMuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0XHR0aGlzLnZpZXdMYXlvdXQub25IZWlnaHRNYXliZUNoYW5nZWQoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZmlyc3RNb2RlbExpbmVJblZpZXdQb3J0ID0gc3RhYmxlVmlld3BvcnQudmlld3BvcnRTdGFydE1vZGVsUG9zaXRpb24/LmxpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBmaXJzdE1vZGVsTGluZUlzSGlkZGVuID0gZmlyc3RNb2RlbExpbmVJblZpZXdQb3J0ICYmIG1lcmdlZFJhbmdlcy5zb21lKHJhbmdlID0+IHJhbmdlLnN0YXJ0TGluZU51bWJlciA8PSBmaXJzdE1vZGVsTGluZUluVmlld1BvcnQgJiYgZmlyc3RNb2RlbExpbmVJblZpZXdQb3J0IDw9IHJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKCFmaXJzdE1vZGVsTGluZUlzSGlkZGVuKSB7XG5cdFx0XHRcdHN0YWJsZVZpZXdwb3J0LnJlY292ZXJWaWV3cG9ydFN0YXJ0KHRoaXMuY29vcmRpbmF0ZXNDb252ZXJ0ZXIsIHRoaXMudmlld0xheW91dCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbmRFbWl0Vmlld0V2ZW50cygpO1xuXHRcdH1cblx0XHR0aGlzLl91cGRhdGVDb25maWd1cmF0aW9uVmlld0xpbmVDb3VudC5zY2hlZHVsZSgpO1xuXG5cdFx0aWYgKGxpbmVNYXBwaW5nQ2hhbmdlZCkge1xuXHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVtaXRPdXRnb2luZ0V2ZW50KG5ldyBIaWRkZW5BcmVhc0NoYW5nZWRFdmVudCgpKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmlzaWJsZVJhbmdlc1BsdXNWaWV3cG9ydEFib3ZlQmVsb3coKTogUmFuZ2VbXSB7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCBsaW5lc0Fyb3VuZCA9IE1hdGgubWF4KDIwLCBNYXRoLnJvdW5kKGxheW91dEluZm8uaGVpZ2h0IC8gbGluZUhlaWdodCkpO1xuXHRcdGNvbnN0IHBhcnRpYWxEYXRhID0gdGhpcy52aWV3TGF5b3V0LmdldExpbmVzVmlld3BvcnREYXRhKCk7XG5cdFx0Y29uc3Qgc3RhcnRWaWV3TGluZU51bWJlciA9IE1hdGgubWF4KDEsIHBhcnRpYWxEYXRhLmNvbXBsZXRlbHlWaXNpYmxlU3RhcnRMaW5lTnVtYmVyIC0gbGluZXNBcm91bmQpO1xuXHRcdGNvbnN0IGVuZFZpZXdMaW5lTnVtYmVyID0gTWF0aC5taW4odGhpcy5nZXRMaW5lQ291bnQoKSwgcGFydGlhbERhdGEuY29tcGxldGVseVZpc2libGVFbmRMaW5lTnVtYmVyICsgbGluZXNBcm91bmQpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX3RvTW9kZWxWaXNpYmxlUmFuZ2VzKG5ldyBSYW5nZShcblx0XHRcdHN0YXJ0Vmlld0xpbmVOdW1iZXIsIHRoaXMuZ2V0TGluZU1pbkNvbHVtbihzdGFydFZpZXdMaW5lTnVtYmVyKSxcblx0XHRcdGVuZFZpZXdMaW5lTnVtYmVyLCB0aGlzLmdldExpbmVNYXhDb2x1bW4oZW5kVmlld0xpbmVOdW1iZXIpXG5cdFx0KSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmlzaWJsZVJhbmdlcygpOiBSYW5nZVtdIHtcblx0XHRjb25zdCB2aXNpYmxlVmlld1JhbmdlID0gdGhpcy5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSgpO1xuXHRcdHJldHVybiB0aGlzLl90b01vZGVsVmlzaWJsZVJhbmdlcyh2aXNpYmxlVmlld1JhbmdlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRIaWRkZW5BcmVhcygpOiBSYW5nZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0SGlkZGVuQXJlYXMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3RvTW9kZWxWaXNpYmxlUmFuZ2VzKHZpc2libGVWaWV3UmFuZ2U6IFJhbmdlKTogUmFuZ2VbXSB7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlID0gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1JhbmdlVG9Nb2RlbFJhbmdlKHZpc2libGVWaWV3UmFuZ2UpO1xuXHRcdGNvbnN0IGhpZGRlbkFyZWFzID0gdGhpcy5fbGluZXMuZ2V0SGlkZGVuQXJlYXMoKTtcblxuXHRcdGlmIChoaWRkZW5BcmVhcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbdmlzaWJsZVJhbmdlXTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IFJhbmdlW10gPSBbXTtcblx0XHRsZXQgcmVzdWx0TGVuID0gMDtcblx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gdmlzaWJsZVJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRsZXQgc3RhcnRDb2x1bW4gPSB2aXNpYmxlUmFuZ2Uuc3RhcnRDb2x1bW47XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHZpc2libGVSYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IHZpc2libGVSYW5nZS5lbmRDb2x1bW47XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGhpZGRlbkFyZWFzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBoaWRkZW5TdGFydExpbmVOdW1iZXIgPSBoaWRkZW5BcmVhc1tpXS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBoaWRkZW5FbmRMaW5lTnVtYmVyID0gaGlkZGVuQXJlYXNbaV0uZW5kTGluZU51bWJlcjtcblxuXHRcdFx0aWYgKGhpZGRlbkVuZExpbmVOdW1iZXIgPCBzdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaGlkZGVuU3RhcnRMaW5lTnVtYmVyID4gZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlciA8IGhpZGRlblN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IFJhbmdlKFxuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0aGlkZGVuU3RhcnRMaW5lTnVtYmVyIC0gMSwgdGhpcy5tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGhpZGRlblN0YXJ0TGluZU51bWJlciAtIDEpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRzdGFydExpbmVOdW1iZXIgPSBoaWRkZW5FbmRMaW5lTnVtYmVyICsgMTtcblx0XHRcdHN0YXJ0Q29sdW1uID0gMTtcblx0XHR9XG5cblx0XHRpZiAoc3RhcnRMaW5lTnVtYmVyIDwgZW5kTGluZU51bWJlciB8fCAoc3RhcnRMaW5lTnVtYmVyID09PSBlbmRMaW5lTnVtYmVyICYmIHN0YXJ0Q29sdW1uIDwgZW5kQ29sdW1uKSkge1xuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBSYW5nZShcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbixcblx0XHRcdFx0ZW5kTGluZU51bWJlciwgZW5kQ29sdW1uXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29tcGxldGVseVZpc2libGVWaWV3UmFuZ2UoKTogUmFuZ2Uge1xuXHRcdGNvbnN0IHBhcnRpYWxEYXRhID0gdGhpcy52aWV3TGF5b3V0LmdldExpbmVzVmlld3BvcnREYXRhKCk7XG5cdFx0Y29uc3Qgc3RhcnRWaWV3TGluZU51bWJlciA9IHBhcnRpYWxEYXRhLmNvbXBsZXRlbHlWaXNpYmxlU3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGVuZFZpZXdMaW5lTnVtYmVyID0gcGFydGlhbERhdGEuY29tcGxldGVseVZpc2libGVFbmRMaW5lTnVtYmVyO1xuXG5cdFx0cmV0dXJuIG5ldyBSYW5nZShcblx0XHRcdHN0YXJ0Vmlld0xpbmVOdW1iZXIsIHRoaXMuZ2V0TGluZU1pbkNvbHVtbihzdGFydFZpZXdMaW5lTnVtYmVyKSxcblx0XHRcdGVuZFZpZXdMaW5lTnVtYmVyLCB0aGlzLmdldExpbmVNYXhDb2x1bW4oZW5kVmlld0xpbmVOdW1iZXIpXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZUF0U2Nyb2xsVG9wKHNjcm9sbFRvcDogbnVtYmVyKTogUmFuZ2Uge1xuXHRcdGNvbnN0IHBhcnRpYWxEYXRhID0gdGhpcy52aWV3TGF5b3V0LmdldExpbmVzVmlld3BvcnREYXRhQXRTY3JvbGxUb3Aoc2Nyb2xsVG9wKTtcblx0XHRjb25zdCBzdGFydFZpZXdMaW5lTnVtYmVyID0gcGFydGlhbERhdGEuY29tcGxldGVseVZpc2libGVTdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kVmlld0xpbmVOdW1iZXIgPSBwYXJ0aWFsRGF0YS5jb21wbGV0ZWx5VmlzaWJsZUVuZExpbmVOdW1iZXI7XG5cblx0XHRyZXR1cm4gbmV3IFJhbmdlKFxuXHRcdFx0c3RhcnRWaWV3TGluZU51bWJlciwgdGhpcy5nZXRMaW5lTWluQ29sdW1uKHN0YXJ0Vmlld0xpbmVOdW1iZXIpLFxuXHRcdFx0ZW5kVmlld0xpbmVOdW1iZXIsIHRoaXMuZ2V0TGluZU1heENvbHVtbihlbmRWaWV3TGluZU51bWJlcilcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHNhdmVTdGF0ZSgpOiBJVmlld1N0YXRlIHtcblx0XHRjb25zdCBjb21wYXRWaWV3U3RhdGUgPSB0aGlzLnZpZXdMYXlvdXQuc2F2ZVN0YXRlKCk7XG5cblx0XHRjb25zdCBzY3JvbGxUb3AgPSBjb21wYXRWaWV3U3RhdGUuc2Nyb2xsVG9wO1xuXHRcdGNvbnN0IGZpcnN0Vmlld0xpbmVOdW1iZXIgPSB0aGlzLnZpZXdMYXlvdXQuZ2V0TGluZU51bWJlckF0VmVydGljYWxPZmZzZXQoc2Nyb2xsVG9wKTtcblx0XHRjb25zdCBmaXJzdFBvc2l0aW9uID0gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKG5ldyBQb3NpdGlvbihmaXJzdFZpZXdMaW5lTnVtYmVyLCB0aGlzLmdldExpbmVNaW5Db2x1bW4oZmlyc3RWaWV3TGluZU51bWJlcikpKTtcblx0XHRjb25zdCBmaXJzdFBvc2l0aW9uRGVsdGFUb3AgPSB0aGlzLnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKGZpcnN0Vmlld0xpbmVOdW1iZXIpIC0gc2Nyb2xsVG9wO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjcm9sbExlZnQ6IGNvbXBhdFZpZXdTdGF0ZS5zY3JvbGxMZWZ0LFxuXHRcdFx0Zmlyc3RQb3NpdGlvbjogZmlyc3RQb3NpdGlvbixcblx0XHRcdGZpcnN0UG9zaXRpb25EZWx0YVRvcDogZmlyc3RQb3NpdGlvbkRlbHRhVG9wXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyByZWR1Y2VSZXN0b3JlU3RhdGUoc3RhdGU6IElWaWV3U3RhdGUpOiB7IHNjcm9sbExlZnQ6IG51bWJlcjsgc2Nyb2xsVG9wOiBudW1iZXIgfSB7XG5cdFx0aWYgKHR5cGVvZiBzdGF0ZS5maXJzdFBvc2l0aW9uID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Ly8gVGhpcyBpcyBhIHZpZXcgc3RhdGUgc2VyaWFsaXplZCBieSBhbiBvbGRlciB2ZXJzaW9uXG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVkdWNlUmVzdG9yZVN0YXRlQ29tcGF0aWJpbGl0eShzdGF0ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWxQb3NpdGlvbiA9IHRoaXMubW9kZWwudmFsaWRhdGVQb3NpdGlvbihzdGF0ZS5maXJzdFBvc2l0aW9uKTtcblx0XHRjb25zdCB2aWV3UG9zaXRpb24gPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24obW9kZWxQb3NpdGlvbik7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih2aWV3UG9zaXRpb24ubGluZU51bWJlcikgLSBzdGF0ZS5maXJzdFBvc2l0aW9uRGVsdGFUb3A7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjcm9sbExlZnQ6IHN0YXRlLnNjcm9sbExlZnQsXG5cdFx0XHRzY3JvbGxUb3A6IHNjcm9sbFRvcFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9yZWR1Y2VSZXN0b3JlU3RhdGVDb21wYXRpYmlsaXR5KHN0YXRlOiBJVmlld1N0YXRlKTogeyBzY3JvbGxMZWZ0OiBudW1iZXI7IHNjcm9sbFRvcDogbnVtYmVyIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzY3JvbGxMZWZ0OiBzdGF0ZS5zY3JvbGxMZWZ0LFxuXHRcdFx0c2Nyb2xsVG9wOiBzdGF0ZS5zY3JvbGxUb3BXaXRob3V0Vmlld1pvbmVzIVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGdldFRhYlNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRPcHRpb25zKCkudGFiU2l6ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVDb3VudCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdpdmVzIGEgaGludCB0aGF0IGEgbG90IG9mIHJlcXVlc3RzIGFyZSBhYm91dCB0byBjb21lIGluIGZvciB0aGVzZSBsaW5lIG51bWJlcnMuXG5cdCAqL1xuXHRwdWJsaWMgc2V0Vmlld3BvcnQoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgY2VudGVyZWRMaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl92aWV3cG9ydFN0YXJ0LnVwZGF0ZSh0aGlzLCBzdGFydExpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldEFjdGl2ZUluZGVudEd1aWRlKGxpbmVOdW1iZXI6IG51bWJlciwgbWluTGluZU51bWJlcjogbnVtYmVyLCBtYXhMaW5lTnVtYmVyOiBudW1iZXIpOiBJQWN0aXZlSW5kZW50R3VpZGVJbmZvIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0QWN0aXZlSW5kZW50R3VpZGUobGluZU51bWJlciwgbWluTGluZU51bWJlciwgbWF4TGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZXNJbmRlbnRHdWlkZXMoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlcltdIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QnJhY2tldEd1aWRlc0luUmFuZ2VCeUxpbmUoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgYWN0aXZlUG9zaXRpb246IElQb3NpdGlvbiB8IG51bGwsIG9wdGlvbnM6IEJyYWNrZXRHdWlkZU9wdGlvbnMpOiBJbmRlbnRHdWlkZVtdW10ge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5nZXRWaWV3TGluZXNCcmFja2V0R3VpZGVzKHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlciwgYWN0aXZlUG9zaXRpb24sIG9wdGlvbnMpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVDb250ZW50KGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmdldFZpZXdMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmVzLmdldFZpZXdMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVNaW5Db2x1bW4obGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVNaW5Db2x1bW4obGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5nZXRWaWV3TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gc3RyaW5ncy5maXJzdE5vbldoaXRlc3BhY2VJbmRleCh0aGlzLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpKTtcblx0XHRpZiAocmVzdWx0ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQgKyAxO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHN0cmluZ3MubGFzdE5vbldoaXRlc3BhY2VJbmRleCh0aGlzLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpKTtcblx0XHRpZiAocmVzdWx0ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQgKyAyO1xuXHR9XG5cblx0cHVibGljIGdldE1pbmltYXBEZWNvcmF0aW9uc0luUmFuZ2UocmFuZ2U6IFJhbmdlKTogVmlld01vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVjb3JhdGlvbnMuZ2V0TWluaW1hcERlY29yYXRpb25zSW5SYW5nZShyYW5nZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVjb3JhdGlvbnNJblZpZXdwb3J0KHZpc2libGVSYW5nZTogUmFuZ2UpOiBWaWV3TW9kZWxEZWNvcmF0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLl9kZWNvcmF0aW9ucy5nZXREZWNvcmF0aW9uc1ZpZXdwb3J0RGF0YSh2aXNpYmxlUmFuZ2UpLmRlY29yYXRpb25zO1xuXHR9XG5cblx0cHVibGljIGdldEluamVjdGVkVGV4dEF0KHZpZXdQb3NpdGlvbjogUG9zaXRpb24pOiBJbmplY3RlZFRleHQgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0SW5qZWN0ZWRUZXh0QXQodmlld1Bvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3cG9ydFZpZXdMaW5lUmVuZGVyaW5nRGF0YSh2aXNpYmxlUmFuZ2U6IFJhbmdlLCBsaW5lTnVtYmVyOiBudW1iZXIpOiBWaWV3TGluZVJlbmRlcmluZ0RhdGEge1xuXHRcdGNvbnN0IGFsbElubGluZURlY29yYXRpb25zID0gdGhpcy5fZGVjb3JhdGlvbnMuZ2V0RGVjb3JhdGlvbnNWaWV3cG9ydERhdGEodmlzaWJsZVJhbmdlKS5pbmxpbmVEZWNvcmF0aW9ucztcblx0XHRjb25zdCBpbmxpbmVEZWNvcmF0aW9ucyA9IGFsbElubGluZURlY29yYXRpb25zW2xpbmVOdW1iZXIgLSB2aXNpYmxlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyXTtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0Vmlld0xpbmVSZW5kZXJpbmdEYXRhKGxpbmVOdW1iZXIsIGlubGluZURlY29yYXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEobGluZU51bWJlcjogbnVtYmVyKTogVmlld0xpbmVSZW5kZXJpbmdEYXRhIHtcblx0XHRjb25zdCBpbmxpbmVEZWNvcmF0aW9ucyA9IHRoaXMuX2RlY29yYXRpb25zLmdldElubGluZURlY29yYXRpb25zT25MaW5lKGxpbmVOdW1iZXIpO1xuXHRcdHJldHVybiB0aGlzLl9nZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEobGluZU51bWJlciwgaW5saW5lRGVjb3JhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Vmlld0xpbmVSZW5kZXJpbmdEYXRhKGxpbmVOdW1iZXI6IG51bWJlciwgaW5saW5lRGVjb3JhdGlvbnM6IElubGluZURlY29yYXRpb25bXSk6IFZpZXdMaW5lUmVuZGVyaW5nRGF0YSB7XG5cdFx0Y29uc3QgbWlnaHRDb250YWluUlRMID0gdGhpcy5tb2RlbC5taWdodENvbnRhaW5SVEwoKTtcblx0XHRjb25zdCBtaWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJID0gdGhpcy5tb2RlbC5taWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJKCk7XG5cdFx0Y29uc3QgdGFiU2l6ZSA9IHRoaXMuZ2V0VGFiU2l6ZSgpO1xuXHRcdGNvbnN0IGxpbmVEYXRhID0gdGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVEYXRhKGxpbmVOdW1iZXIpO1xuXG5cdFx0aWYgKGxpbmVEYXRhLmlubGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRpbmxpbmVEZWNvcmF0aW9ucyA9IFtcblx0XHRcdFx0Li4uaW5saW5lRGVjb3JhdGlvbnMsXG5cdFx0XHRcdC4uLmxpbmVEYXRhLmlubGluZURlY29yYXRpb25zLm1hcChkID0+XG5cdFx0XHRcdFx0ZC50b0lubGluZURlY29yYXRpb24obGluZU51bWJlcilcblx0XHRcdFx0KVxuXHRcdFx0XTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFZpZXdMaW5lUmVuZGVyaW5nRGF0YShcblx0XHRcdGxpbmVEYXRhLm1pbkNvbHVtbixcblx0XHRcdGxpbmVEYXRhLm1heENvbHVtbixcblx0XHRcdGxpbmVEYXRhLmNvbnRlbnQsXG5cdFx0XHRsaW5lRGF0YS5jb250aW51ZXNXaXRoV3JhcHBlZExpbmUsXG5cdFx0XHRtaWdodENvbnRhaW5SVEwsXG5cdFx0XHRtaWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJLFxuXHRcdFx0bGluZURhdGEudG9rZW5zLFxuXHRcdFx0aW5saW5lRGVjb3JhdGlvbnMsXG5cdFx0XHR0YWJTaXplLFxuXHRcdFx0bGluZURhdGEuc3RhcnRWaXNpYmxlQ29sdW1uXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3TGluZURhdGEobGluZU51bWJlcjogbnVtYmVyKTogVmlld0xpbmVEYXRhIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMuZ2V0Vmlld0xpbmVEYXRhKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgbmVlZGVkOiBib29sZWFuW10pOiBNaW5pbWFwTGluZXNSZW5kZXJpbmdEYXRhIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9saW5lcy5nZXRWaWV3TGluZXNEYXRhKHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlciwgbmVlZGVkKTtcblx0XHRyZXR1cm4gbmV3IE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoXG5cdFx0XHR0aGlzLmdldFRhYlNpemUoKSxcblx0XHRcdHJlc3VsdFxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWxsT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zKHRoZW1lOiBFZGl0b3JUaGVtZSk6IE92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9uc0dyb3VwW10ge1xuXHRcdGNvbnN0IGRlY29yYXRpb25zID0gdGhpcy5tb2RlbC5nZXRPdmVydmlld1J1bGVyRGVjb3JhdGlvbnModGhpcy5fZWRpdG9ySWQsIGZpbHRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyh0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMpKTtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zKCk7XG5cdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uT3B0aW9ucyA9IDxNb2RlbERlY29yYXRpb25PcHRpb25zPmRlY29yYXRpb24ub3B0aW9ucztcblx0XHRcdGNvbnN0IG9wdHMgPSBkZWNvcmF0aW9uT3B0aW9ucy5vdmVydmlld1J1bGVyO1xuXHRcdFx0aWYgKCFvcHRzKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGFuZSA9IDxudW1iZXI+b3B0cy5wb3NpdGlvbjtcblx0XHRcdGlmIChsYW5lID09PSAwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29sb3IgPSBvcHRzLmdldENvbG9yKHRoZW1lLnZhbHVlKTtcblx0XHRcdGNvbnN0IHZpZXdTdGFydExpbmVOdW1iZXIgPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmdldFZpZXdMaW5lTnVtYmVyT2ZNb2RlbFBvc2l0aW9uKGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBkZWNvcmF0aW9uLnJhbmdlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdGNvbnN0IHZpZXdFbmRMaW5lTnVtYmVyID0gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5nZXRWaWV3TGluZU51bWJlck9mTW9kZWxQb3NpdGlvbihkZWNvcmF0aW9uLnJhbmdlLmVuZExpbmVOdW1iZXIsIGRlY29yYXRpb24ucmFuZ2UuZW5kQ29sdW1uKTtcblxuXHRcdFx0cmVzdWx0LmFjY2VwdChjb2xvciwgZGVjb3JhdGlvbk9wdGlvbnMuekluZGV4LCB2aWV3U3RhcnRMaW5lTnVtYmVyLCB2aWV3RW5kTGluZU51bWJlciwgbGFuZSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQuYXNBcnJheTtcblx0fVxuXG5cdHByaXZhdGUgX2ludmFsaWRhdGVEZWNvcmF0aW9uc0NvbG9yQ2FjaGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLm1vZGVsLmdldE92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9ucygpO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBkZWNvcmF0aW9ucykge1xuXHRcdFx0Y29uc3Qgb3B0czEgPSA8TW9kZWxEZWNvcmF0aW9uT3ZlcnZpZXdSdWxlck9wdGlvbnM+ZGVjb3JhdGlvbi5vcHRpb25zLm92ZXJ2aWV3UnVsZXI7XG5cdFx0XHRvcHRzMT8uaW52YWxpZGF0ZUNhY2hlZENvbG9yKCk7XG5cdFx0XHRjb25zdCBvcHRzMiA9IDxNb2RlbERlY29yYXRpb25NaW5pbWFwT3B0aW9ucz5kZWNvcmF0aW9uLm9wdGlvbnMubWluaW1hcDtcblx0XHRcdG9wdHMyPy5pbnZhbGlkYXRlQ2FjaGVkQ29sb3IoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWVJblJhbmdlKHJhbmdlOiBSYW5nZSwgZW9sOiBFbmRPZkxpbmVQcmVmZXJlbmNlKTogc3RyaW5nIHtcblx0XHRjb25zdCBtb2RlbFJhbmdlID0gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1JhbmdlVG9Nb2RlbFJhbmdlKHJhbmdlKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRWYWx1ZUluUmFuZ2UobW9kZWxSYW5nZSwgZW9sKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWYWx1ZUxlbmd0aEluUmFuZ2UocmFuZ2U6IFJhbmdlLCBlb2w6IEVuZE9mTGluZVByZWZlcmVuY2UpOiBudW1iZXIge1xuXHRcdGNvbnN0IG1vZGVsUmFuZ2UgPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UmFuZ2VUb01vZGVsUmFuZ2UocmFuZ2UpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldFZhbHVlTGVuZ3RoSW5SYW5nZShtb2RlbFJhbmdlLCBlb2wpO1xuXHR9XG5cblx0cHVibGljIG1vZGlmeVBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbiwgb2Zmc2V0OiBudW1iZXIpOiBQb3NpdGlvbiB7XG5cdFx0Y29uc3QgbW9kZWxQb3NpdGlvbiA9IHRoaXMuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0Y29uc3QgcmVzdWx0TW9kZWxQb3NpdGlvbiA9IHRoaXMubW9kZWwubW9kaWZ5UG9zaXRpb24obW9kZWxQb3NpdGlvbiwgb2Zmc2V0KTtcblx0XHRyZXR1cm4gdGhpcy5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKHJlc3VsdE1vZGVsUG9zaXRpb24pO1xuXHR9XG5cblx0cHVibGljIGRlZHVjZU1vZGVsUG9zaXRpb25SZWxhdGl2ZVRvVmlld1Bvc2l0aW9uKHZpZXdBbmNob3JQb3NpdGlvbjogUG9zaXRpb24sIGRlbHRhT2Zmc2V0OiBudW1iZXIsIGxpbmVGZWVkQ250OiBudW1iZXIpOiBQb3NpdGlvbiB7XG5cdFx0Y29uc3QgbW9kZWxBbmNob3IgPSB0aGlzLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24odmlld0FuY2hvclBvc2l0aW9uKTtcblx0XHRpZiAodGhpcy5tb2RlbC5nZXRFT0woKS5sZW5ndGggPT09IDIpIHtcblx0XHRcdC8vIFRoaXMgbW9kZWwgdXNlcyBDUkxGLCBzbyB0aGUgZGVsdGEgbXVzdCB0YWtlIHRoYXQgaW50byBhY2NvdW50XG5cdFx0XHRpZiAoZGVsdGFPZmZzZXQgPCAwKSB7XG5cdFx0XHRcdGRlbHRhT2Zmc2V0IC09IGxpbmVGZWVkQ250O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsdGFPZmZzZXQgKz0gbGluZUZlZWRDbnQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWxBbmNob3JPZmZzZXQgPSB0aGlzLm1vZGVsLmdldE9mZnNldEF0KG1vZGVsQW5jaG9yKTtcblx0XHRjb25zdCByZXN1bHRPZmZzZXQgPSBtb2RlbEFuY2hvck9mZnNldCArIGRlbHRhT2Zmc2V0O1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldFBvc2l0aW9uQXQocmVzdWx0T2Zmc2V0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQbGFpblRleHRUb0NvcHkobW9kZWxSYW5nZXM6IFJhbmdlW10sIGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkOiBib29sZWFuLCBmb3JjZUNSTEY6IGJvb2xlYW4pOiBzdHJpbmcgfCBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbmV3TGluZUNoYXJhY3RlciA9IGZvcmNlQ1JMRiA/ICdcXHJcXG4nIDogdGhpcy5tb2RlbC5nZXRFT0woKTtcblxuXHRcdG1vZGVsUmFuZ2VzID0gbW9kZWxSYW5nZXMuc2xpY2UoMCk7XG5cdFx0bW9kZWxSYW5nZXMuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpO1xuXG5cdFx0bGV0IGhhc0VtcHR5UmFuZ2UgPSBmYWxzZTtcblx0XHRsZXQgaGFzTm9uRW1wdHlSYW5nZSA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgbW9kZWxSYW5nZXMpIHtcblx0XHRcdGlmIChyYW5nZS5pc0VtcHR5KCkpIHtcblx0XHRcdFx0aGFzRW1wdHlSYW5nZSA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYXNOb25FbXB0eVJhbmdlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWhhc05vbkVtcHR5UmFuZ2UpIHtcblx0XHRcdC8vIGFsbCByYW5nZXMgYXJlIGVtcHR5XG5cdFx0XHRpZiAoIWVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kZWxMaW5lTnVtYmVycyA9IG1vZGVsUmFuZ2VzLm1hcCgocikgPT4gci5zdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1vZGVsTGluZU51bWJlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGkgPiAwICYmIG1vZGVsTGluZU51bWJlcnNbaSAtIDFdID09PSBtb2RlbExpbmVOdW1iZXJzW2ldKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0ICs9IHRoaXMubW9kZWwuZ2V0TGluZUNvbnRlbnQobW9kZWxMaW5lTnVtYmVyc1tpXSkgKyBuZXdMaW5lQ2hhcmFjdGVyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRpZiAoaGFzRW1wdHlSYW5nZSAmJiBlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCkge1xuXHRcdFx0Ly8gbWl4ZWQgZW1wdHkgc2VsZWN0aW9ucyBhbmQgbm9uLWVtcHR5IHNlbGVjdGlvbnNcblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRcdGxldCBwcmV2TW9kZWxMaW5lTnVtYmVyID0gMDtcblx0XHRcdGZvciAoY29uc3QgbW9kZWxSYW5nZSBvZiBtb2RlbFJhbmdlcykge1xuXHRcdFx0XHRjb25zdCBtb2RlbExpbmVOdW1iZXIgPSBtb2RlbFJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0aWYgKG1vZGVsUmFuZ2UuaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsTGluZU51bWJlciAhPT0gcHJldk1vZGVsTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2godGhpcy5tb2RlbC5nZXRMaW5lQ29udGVudChtb2RlbExpbmVOdW1iZXIpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2godGhpcy5tb2RlbC5nZXRWYWx1ZUluUmFuZ2UobW9kZWxSYW5nZSwgZm9yY2VDUkxGID8gRW5kT2ZMaW5lUHJlZmVyZW5jZS5DUkxGIDogRW5kT2ZMaW5lUHJlZmVyZW5jZS5UZXh0RGVmaW5lZCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZNb2RlbExpbmVOdW1iZXIgPSBtb2RlbExpbmVOdW1iZXI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0Lmxlbmd0aCA9PT0gMSA/IHJlc3VsdFswXSA6IHJlc3VsdDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBtb2RlbFJhbmdlIG9mIG1vZGVsUmFuZ2VzKSB7XG5cdFx0XHRpZiAoIW1vZGVsUmFuZ2UuaXNFbXB0eSgpKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHRoaXMubW9kZWwuZ2V0VmFsdWVJblJhbmdlKG1vZGVsUmFuZ2UsIGZvcmNlQ1JMRiA/IEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRiA6IEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdC5sZW5ndGggPT09IDEgPyByZXN1bHRbMF0gOiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmljaFRleHRUb0NvcHkobW9kZWxSYW5nZXM6IFJhbmdlW10sIGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkOiBib29sZWFuKTogeyBodG1sOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9IHwgbnVsbCB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IHRoaXMubW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdGlmIChsYW5ndWFnZUlkID09PSBQTEFJTlRFWFRfTEFOR1VBR0VfSUQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChtb2RlbFJhbmdlcy5sZW5ndGggIT09IDEpIHtcblx0XHRcdC8vIG5vIG11bHRpcGxlIHNlbGVjdGlvbiBzdXBwb3J0IGF0IHRoaXMgdGltZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0bGV0IHJhbmdlID0gbW9kZWxSYW5nZXNbMF07XG5cdFx0aWYgKHJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0aWYgKCFlbXB0eVNlbGVjdGlvbkNsaXBib2FyZCkge1xuXHRcdFx0XHQvLyBub3RoaW5nIHRvIGNvcHlcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0cmFuZ2UgPSBuZXcgUmFuZ2UobGluZU51bWJlciwgdGhpcy5tb2RlbC5nZXRMaW5lTWluQ29sdW1uKGxpbmVOdW1iZXIpLCBsaW5lTnVtYmVyLCB0aGlzLm1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbnRJbmZvID0gdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdGNvbnN0IGNvbG9yTWFwID0gdGhpcy5fZ2V0Q29sb3JNYXAoKTtcblx0XHRjb25zdCBoYXNCYWRDaGFycyA9ICgvWzo7XFxcXFxcLzw+XS8udGVzdChmb250SW5mby5mb250RmFtaWx5KSk7XG5cdFx0Y29uc3QgdXNlRGVmYXVsdEZvbnRGYW1pbHkgPSAoaGFzQmFkQ2hhcnMgfHwgZm9udEluZm8uZm9udEZhbWlseSA9PT0gRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udEZhbWlseSk7XG5cdFx0bGV0IGZvbnRGYW1pbHk6IHN0cmluZztcblx0XHRpZiAodXNlRGVmYXVsdEZvbnRGYW1pbHkpIHtcblx0XHRcdGZvbnRGYW1pbHkgPSBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250RmFtaWx5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb250RmFtaWx5ID0gZm9udEluZm8uZm9udEZhbWlseTtcblx0XHRcdGZvbnRGYW1pbHkgPSBmb250RmFtaWx5LnJlcGxhY2UoL1wiL2csICdcXCcnKTtcblx0XHRcdGNvbnN0IGhhc1F1b3Rlc09ySXNMaXN0ID0gL1ssJ10vLnRlc3QoZm9udEZhbWlseSk7XG5cdFx0XHRpZiAoIWhhc1F1b3Rlc09ySXNMaXN0KSB7XG5cdFx0XHRcdGNvbnN0IG5lZWRzUXVvdGVzID0gL1srIF0vLnRlc3QoZm9udEZhbWlseSk7XG5cdFx0XHRcdGlmIChuZWVkc1F1b3Rlcykge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHkgPSBgJyR7Zm9udEZhbWlseX0nYDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9udEZhbWlseSA9IGAke2ZvbnRGYW1pbHl9LCAke0VESVRPUl9GT05UX0RFRkFVTFRTLmZvbnRGYW1pbHl9YDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bW9kZTogbGFuZ3VhZ2VJZCxcblx0XHRcdGh0bWw6IChcblx0XHRcdFx0YDxkaXYgc3R5bGU9XCJgXG5cdFx0XHRcdCsgYGNvbG9yOiAke2NvbG9yTWFwW0NvbG9ySWQuRGVmYXVsdEZvcmVncm91bmRdfTtgXG5cdFx0XHRcdCsgYGJhY2tncm91bmQtY29sb3I6ICR7Y29sb3JNYXBbQ29sb3JJZC5EZWZhdWx0QmFja2dyb3VuZF19O2Bcblx0XHRcdFx0KyBgZm9udC1mYW1pbHk6ICR7Zm9udEZhbWlseX07YFxuXHRcdFx0XHQrIGBmb250LXdlaWdodDogJHtmb250SW5mby5mb250V2VpZ2h0fTtgXG5cdFx0XHRcdCsgYGZvbnQtc2l6ZTogJHtmb250SW5mby5mb250U2l6ZX1weDtgXG5cdFx0XHRcdCsgYGxpbmUtaGVpZ2h0OiAke2ZvbnRJbmZvLmxpbmVIZWlnaHR9cHg7YFxuXHRcdFx0XHQrIGB3aGl0ZS1zcGFjZTogcHJlO2Bcblx0XHRcdFx0KyBgXCI+YFxuXHRcdFx0XHQrIHRoaXMuX2dldEhUTUxUb0NvcHkocmFuZ2UsIGNvbG9yTWFwKVxuXHRcdFx0XHQrICc8L2Rpdj4nXG5cdFx0XHQpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhUTUxUb0NvcHkobW9kZWxSYW5nZTogUmFuZ2UsIGNvbG9yTWFwOiBzdHJpbmdbXSk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gbW9kZWxSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSBtb2RlbFJhbmdlLnN0YXJ0Q29sdW1uO1xuXHRcdGNvbnN0IGVuZExpbmVOdW1iZXIgPSBtb2RlbFJhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gbW9kZWxSYW5nZS5lbmRDb2x1bW47XG5cblx0XHRjb25zdCB0YWJTaXplID0gdGhpcy5nZXRUYWJTaXplKCk7XG5cblx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IGVuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0Y29uc3QgbGluZVRva2VucyA9IHRoaXMubW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IGxpbmVUb2tlbnMuZ2V0TGluZUNvbnRlbnQoKTtcblx0XHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gKGxpbmVOdW1iZXIgPT09IHN0YXJ0TGluZU51bWJlciA/IHN0YXJ0Q29sdW1uIC0gMSA6IDApO1xuXHRcdFx0Y29uc3QgZW5kT2Zmc2V0ID0gKGxpbmVOdW1iZXIgPT09IGVuZExpbmVOdW1iZXIgPyBlbmRDb2x1bW4gLSAxIDogbGluZUNvbnRlbnQubGVuZ3RoKTtcblxuXHRcdFx0aWYgKGxpbmVDb250ZW50ID09PSAnJykge1xuXHRcdFx0XHRyZXN1bHQgKz0gJzxicj4nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0ICs9IHRva2VuaXplTGluZVRvSFRNTChsaW5lQ29udGVudCwgbGluZVRva2Vucy5pbmZsYXRlKCksIGNvbG9yTWFwLCBzdGFydE9mZnNldCwgZW5kT2Zmc2V0LCB0YWJTaXplLCBwbGF0Zm9ybS5pc1dpbmRvd3MpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDb2xvck1hcCgpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgY29sb3JNYXAgPSBUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRDb2xvck1hcCgpO1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbJyMwMDAwMDAnXTtcblx0XHRpZiAoY29sb3JNYXApIHtcblx0XHRcdGZvciAobGV0IGkgPSAxLCBsZW4gPSBjb2xvck1hcC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRyZXN1bHRbaV0gPSBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleChjb2xvck1hcFtpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvLyNyZWdpb24gY3Vyc29yIG9wZXJhdGlvbnNcblxuXHRwdWJsaWMgZ2V0UHJpbWFyeUN1cnNvclN0YXRlKCk6IEN1cnNvclN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29yLmdldFByaW1hcnlDdXJzb3JTdGF0ZSgpO1xuXHR9XG5cdHB1YmxpYyBnZXRMYXN0QWRkZWRDdXJzb3JJbmRleCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0TGFzdEFkZGVkQ3Vyc29ySW5kZXgoKTtcblx0fVxuXHRwdWJsaWMgZ2V0Q3Vyc29yU3RhdGVzKCk6IEN1cnNvclN0YXRlW10ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0Q3Vyc29yU3RhdGVzKCk7XG5cdH1cblx0cHVibGljIHNldEN1cnNvclN0YXRlcyhzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHJlYXNvbjogQ3Vyc29yQ2hhbmdlUmVhc29uLCBzdGF0ZXM6IFBhcnRpYWxDdXJzb3JTdGF0ZVtdIHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcihldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLnNldFN0YXRlcyhldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgcmVhc29uLCBzdGF0ZXMpKTtcblx0fVxuXHRwdWJsaWMgZ2V0Q3Vyc29yQ29sdW1uU2VsZWN0RGF0YSgpOiBJQ29sdW1uU2VsZWN0RGF0YSB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnNvci5nZXRDdXJzb3JDb2x1bW5TZWxlY3REYXRhKCk7XG5cdH1cblx0cHVibGljIGdldEN1cnNvckF1dG9DbG9zZWRDaGFyYWN0ZXJzKCk6IFJhbmdlW10ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0QXV0b0Nsb3NlZENoYXJhY3RlcnMoKTtcblx0fVxuXHRwdWJsaWMgc2V0Q3Vyc29yQ29sdW1uU2VsZWN0RGF0YShjb2x1bW5TZWxlY3REYXRhOiBJQ29sdW1uU2VsZWN0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2N1cnNvci5zZXRDdXJzb3JDb2x1bW5TZWxlY3REYXRhKGNvbHVtblNlbGVjdERhdGEpO1xuXHR9XG5cdHB1YmxpYyBnZXRQcmV2RWRpdE9wZXJhdGlvblR5cGUoKTogRWRpdE9wZXJhdGlvblR5cGUge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0UHJldkVkaXRPcGVyYXRpb25UeXBlKCk7XG5cdH1cblx0cHVibGljIHNldFByZXZFZGl0T3BlcmF0aW9uVHlwZSh0eXBlOiBFZGl0T3BlcmF0aW9uVHlwZSk6IHZvaWQge1xuXHRcdHRoaXMuX2N1cnNvci5zZXRQcmV2RWRpdE9wZXJhdGlvblR5cGUodHlwZSk7XG5cdH1cblx0cHVibGljIGdldFNlbGVjdGlvbigpOiBTZWxlY3Rpb24ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0U2VsZWN0aW9uKCk7XG5cdH1cblx0cHVibGljIGdldFNlbGVjdGlvbnMoKTogU2VsZWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLl9jdXJzb3IuZ2V0U2VsZWN0aW9ucygpO1xuXHR9XG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnNvci5nZXRQcmltYXJ5Q3Vyc29yU3RhdGUoKS5tb2RlbFN0YXRlLnBvc2l0aW9uO1xuXHR9XG5cdHB1YmxpYyBzZXRTZWxlY3Rpb25zKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgc2VsZWN0aW9uczogcmVhZG9ubHkgSVNlbGVjdGlvbltdLCByZWFzb24gPSBDdXJzb3JDaGFuZ2VSZWFzb24uTm90U2V0KTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aFZpZXdFdmVudHNDb2xsZWN0b3IoZXZlbnRzQ29sbGVjdG9yID0+IHRoaXMuX2N1cnNvci5zZXRTZWxlY3Rpb25zKGV2ZW50c0NvbGxlY3Rvciwgc291cmNlLCBzZWxlY3Rpb25zLCByZWFzb24pKTtcblx0fVxuXHRwdWJsaWMgc2F2ZUN1cnNvclN0YXRlKCk6IElDdXJzb3JTdGF0ZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29yLnNhdmVTdGF0ZSgpO1xuXHR9XG5cdHB1YmxpYyByZXN0b3JlQ3Vyc29yU3RhdGUoc3RhdGVzOiBJQ3Vyc29yU3RhdGVbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhWaWV3RXZlbnRzQ29sbGVjdG9yKGV2ZW50c0NvbGxlY3RvciA9PiB0aGlzLl9jdXJzb3IucmVzdG9yZVN0YXRlKGV2ZW50c0NvbGxlY3Rvciwgc3RhdGVzKSk7XG5cdH1cblxuXHRwcml2YXRlIF9leGVjdXRlQ3Vyc29yRWRpdChjYWxsYmFjazogKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2N1cnNvci5jb250ZXh0LmN1cnNvckNvbmZpZy5yZWFkT25seSkge1xuXHRcdFx0Ly8gd2UgY2Fubm90IGVkaXQgd2hlbiByZWFkIG9ubHkuLi5cblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0T3V0Z29pbmdFdmVudChuZXcgUmVhZE9ubHlFZGl0QXR0ZW1wdEV2ZW50KCkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcihjYWxsYmFjayk7XG5cdH1cblx0cHVibGljIGV4ZWN1dGVFZGl0cyhzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGVkaXRzOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSwgY3Vyc29yU3RhdGVDb21wdXRlcjogSUN1cnNvclN0YXRlQ29tcHV0ZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9leGVjdXRlQ3Vyc29yRWRpdChldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLmV4ZWN1dGVFZGl0cyhldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgZWRpdHMsIGN1cnNvclN0YXRlQ29tcHV0ZXIpKTtcblx0fVxuXHRwdWJsaWMgc3RhcnRDb21wb3NpdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9leGVjdXRlQ3Vyc29yRWRpdChldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLnN0YXJ0Q29tcG9zaXRpb24oZXZlbnRzQ29sbGVjdG9yKSk7XG5cdH1cblx0cHVibGljIGVuZENvbXBvc2l0aW9uKHNvdXJjZT86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9leGVjdXRlQ3Vyc29yRWRpdChldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLmVuZENvbXBvc2l0aW9uKGV2ZW50c0NvbGxlY3Rvciwgc291cmNlKSk7XG5cdH1cblx0cHVibGljIHR5cGUodGV4dDogc3RyaW5nLCBzb3VyY2U/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZXhlY3V0ZUN1cnNvckVkaXQoZXZlbnRzQ29sbGVjdG9yID0+IHRoaXMuX2N1cnNvci50eXBlKGV2ZW50c0NvbGxlY3RvciwgdGV4dCwgc291cmNlKSk7XG5cdH1cblx0cHVibGljIGNvbXBvc2l0aW9uVHlwZSh0ZXh0OiBzdHJpbmcsIHJlcGxhY2VQcmV2Q2hhckNudDogbnVtYmVyLCByZXBsYWNlTmV4dENoYXJDbnQ6IG51bWJlciwgcG9zaXRpb25EZWx0YTogbnVtYmVyLCBzb3VyY2U/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZXhlY3V0ZUN1cnNvckVkaXQoZXZlbnRzQ29sbGVjdG9yID0+IHRoaXMuX2N1cnNvci5jb21wb3NpdGlvblR5cGUoZXZlbnRzQ29sbGVjdG9yLCB0ZXh0LCByZXBsYWNlUHJldkNoYXJDbnQsIHJlcGxhY2VOZXh0Q2hhckNudCwgcG9zaXRpb25EZWx0YSwgc291cmNlKSk7XG5cdH1cblx0cHVibGljIHBhc3RlKHRleHQ6IHN0cmluZywgcGFzdGVPbk5ld0xpbmU6IGJvb2xlYW4sIG11bHRpY3Vyc29yVGV4dD86IHN0cmluZ1tdIHwgbnVsbCB8IHVuZGVmaW5lZCwgc291cmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2V4ZWN1dGVDdXJzb3JFZGl0KGV2ZW50c0NvbGxlY3RvciA9PiB0aGlzLl9jdXJzb3IucGFzdGUoZXZlbnRzQ29sbGVjdG9yLCB0ZXh0LCBwYXN0ZU9uTmV3TGluZSwgbXVsdGljdXJzb3JUZXh0LCBzb3VyY2UpKTtcblx0fVxuXHRwdWJsaWMgY3V0KHNvdXJjZT86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9leGVjdXRlQ3Vyc29yRWRpdChldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLmN1dChldmVudHNDb2xsZWN0b3IsIHNvdXJjZSkpO1xuXHR9XG5cdHB1YmxpYyBleGVjdXRlQ29tbWFuZChjb21tYW5kOiBJQ29tbWFuZCwgc291cmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2V4ZWN1dGVDdXJzb3JFZGl0KGV2ZW50c0NvbGxlY3RvciA9PiB0aGlzLl9jdXJzb3IuZXhlY3V0ZUNvbW1hbmQoZXZlbnRzQ29sbGVjdG9yLCBjb21tYW5kLCBzb3VyY2UpKTtcblx0fVxuXHRwdWJsaWMgZXhlY3V0ZUNvbW1hbmRzKGNvbW1hbmRzOiBJQ29tbWFuZFtdLCBzb3VyY2U/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZXhlY3V0ZUN1cnNvckVkaXQoZXZlbnRzQ29sbGVjdG9yID0+IHRoaXMuX2N1cnNvci5leGVjdXRlQ29tbWFuZHMoZXZlbnRzQ29sbGVjdG9yLCBjb21tYW5kcywgc291cmNlKSk7XG5cdH1cblx0cHVibGljIHJldmVhbEFsbEN1cnNvcnMoc291cmNlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCByZXZlYWxIb3Jpem9udGFsOiBib29sZWFuLCBtaW5pbWFsUmV2ZWFsOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcihldmVudHNDb2xsZWN0b3IgPT4gdGhpcy5fY3Vyc29yLnJldmVhbEFsbChldmVudHNDb2xsZWN0b3IsIHNvdXJjZSwgbWluaW1hbFJldmVhbCwgdmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLCByZXZlYWxIb3Jpem9udGFsLCBTY3JvbGxUeXBlLlNtb290aCkpO1xuXHR9XG5cdHB1YmxpYyByZXZlYWxQcmltYXJ5Q3Vyc29yKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgcmV2ZWFsSG9yaXpvbnRhbDogYm9vbGVhbiwgbWluaW1hbFJldmVhbDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aFZpZXdFdmVudHNDb2xsZWN0b3IoZXZlbnRzQ29sbGVjdG9yID0+IHRoaXMuX2N1cnNvci5yZXZlYWxQcmltYXJ5KGV2ZW50c0NvbGxlY3Rvciwgc291cmNlLCBtaW5pbWFsUmV2ZWFsLCB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5TaW1wbGUsIHJldmVhbEhvcml6b250YWwsIFNjcm9sbFR5cGUuU21vb3RoKSk7XG5cdH1cblx0cHVibGljIHJldmVhbFRvcE1vc3RDdXJzb3Ioc291cmNlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gdGhpcy5fY3Vyc29yLmdldFRvcE1vc3RWaWV3UG9zaXRpb24oKTtcblx0XHRjb25zdCB2aWV3UmFuZ2UgPSBuZXcgUmFuZ2Uodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIsIHZpZXdQb3NpdGlvbi5jb2x1bW4sIHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLCB2aWV3UG9zaXRpb24uY29sdW1uKTtcblx0XHR0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcihldmVudHNDb2xsZWN0b3IgPT4gZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld1JldmVhbFJhbmdlUmVxdWVzdEV2ZW50KHNvdXJjZSwgZmFsc2UsIHZpZXdSYW5nZSwgbnVsbCwgdmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLCB0cnVlLCBTY3JvbGxUeXBlLlNtb290aCkpKTtcblx0fVxuXHRwdWJsaWMgcmV2ZWFsQm90dG9tTW9zdEN1cnNvcihzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCB2aWV3UG9zaXRpb24gPSB0aGlzLl9jdXJzb3IuZ2V0Qm90dG9tTW9zdFZpZXdQb3NpdGlvbigpO1xuXHRcdGNvbnN0IHZpZXdSYW5nZSA9IG5ldyBSYW5nZSh2aWV3UG9zaXRpb24ubGluZU51bWJlciwgdmlld1Bvc2l0aW9uLmNvbHVtbiwgdmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIsIHZpZXdQb3NpdGlvbi5jb2x1bW4pO1xuXHRcdHRoaXMuX3dpdGhWaWV3RXZlbnRzQ29sbGVjdG9yKGV2ZW50c0NvbGxlY3RvciA9PiBldmVudHNDb2xsZWN0b3IuZW1pdFZpZXdFdmVudChuZXcgdmlld0V2ZW50cy5WaWV3UmV2ZWFsUmFuZ2VSZXF1ZXN0RXZlbnQoc291cmNlLCBmYWxzZSwgdmlld1JhbmdlLCBudWxsLCB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5TaW1wbGUsIHRydWUsIFNjcm9sbFR5cGUuU21vb3RoKSkpO1xuXHR9XG5cdHB1YmxpYyByZXZlYWxSYW5nZShzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHJldmVhbEhvcml6b250YWw6IGJvb2xlYW4sIHZpZXdSYW5nZTogUmFuZ2UsIHZlcnRpY2FsVHlwZTogdmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUsIHNjcm9sbFR5cGU6IFNjcm9sbFR5cGUpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcihldmVudHNDb2xsZWN0b3IgPT4gZXZlbnRzQ29sbGVjdG9yLmVtaXRWaWV3RXZlbnQobmV3IHZpZXdFdmVudHMuVmlld1JldmVhbFJhbmdlUmVxdWVzdEV2ZW50KHNvdXJjZSwgZmFsc2UsIHZpZXdSYW5nZSwgbnVsbCwgdmVydGljYWxUeXBlLCByZXZlYWxIb3Jpem9udGFsLCBzY3JvbGxUeXBlKSkpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHZpZXdMYXlvdXRcblx0cHVibGljIGNoYW5nZVdoaXRlc3BhY2UoY2FsbGJhY2s6IChhY2Nlc3NvcjogSVdoaXRlc3BhY2VDaGFuZ2VBY2Nlc3NvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IGhhZEFDaGFuZ2UgPSB0aGlzLnZpZXdMYXlvdXQuY2hhbmdlV2hpdGVzcGFjZShjYWxsYmFjayk7XG5cdFx0aWYgKGhhZEFDaGFuZ2UpIHtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0U2luZ2xlVmlld0V2ZW50KG5ldyB2aWV3RXZlbnRzLlZpZXdab25lc0NoYW5nZWRFdmVudCgpKTtcblx0XHRcdHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5lbWl0T3V0Z29pbmdFdmVudChuZXcgVmlld1pvbmVzQ2hhbmdlZEV2ZW50KCkpO1xuXHRcdH1cblx0fVxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIF93aXRoVmlld0V2ZW50c0NvbGxlY3RvcjxUPihjYWxsYmFjazogKGV2ZW50c0NvbGxlY3RvcjogVmlld01vZGVsRXZlbnRzQ29sbGVjdG9yKSA9PiBUKTogVCB7XG5cdFx0cmV0dXJuIHRoaXMuX3RyYW5zYWN0aW9uYWxUYXJnZXQuYmF0Y2hDaGFuZ2VzKCgpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50c0NvbGxlY3RvciA9IHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5iZWdpbkVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHRcdHJldHVybiBjYWxsYmFjayhldmVudHNDb2xsZWN0b3IpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5fZXZlbnREaXNwYXRjaGVyLmVuZEVtaXRWaWV3RXZlbnRzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYmF0Y2hFdmVudHMoY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoVmlld0V2ZW50c0NvbGxlY3RvcigoKSA9PiB7IGNhbGxiYWNrKCk7IH0pO1xuXHR9XG5cblx0bm9ybWFsaXplUG9zaXRpb24ocG9zaXRpb246IFBvc2l0aW9uLCBhZmZpbml0eTogUG9zaXRpb25BZmZpbml0eSk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXMubm9ybWFsaXplUG9zaXRpb24ocG9zaXRpb24sIGFmZmluaXR5KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBjb2x1bW4gYXQgd2hpY2ggaW5kZW50YXRpb24gc3RvcHMgYXQgYSBnaXZlbiBsaW5lLlxuXHQgKiBAaW50ZXJuYWxcblx0Ki9cblx0Z2V0TGluZUluZGVudENvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5nZXRMaW5lSW5kZW50Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJhdGNoYWJsZVRhcmdldCB7XG5cdC8qKlxuXHQgKiBBbGxvd3MgdGhlIHRhcmdldCB0byBhcHBseSB0aGUgY2hhbmdlcyBpbnRyb2R1Y2VkIGJ5IHRoZSBjYWxsYmFjayBpbiBhIGJhdGNoLlxuXHQqL1xuXHRiYXRjaENoYW5nZXM8VD4oY2I6ICgpID0+IFQpOiBUO1xufVxuXG5jbGFzcyBWaWV3cG9ydFN0YXJ0IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHB1YmxpYyBzdGF0aWMgY3JlYXRlKG1vZGVsOiBJVGV4dE1vZGVsKTogVmlld3BvcnRTdGFydCB7XG5cdFx0Y29uc3Qgdmlld3BvcnRTdGFydExpbmVUcmFja2VkUmFuZ2UgPSBtb2RlbC5fc2V0VHJhY2tlZFJhbmdlKG51bGwsIG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMpO1xuXHRcdHJldHVybiBuZXcgVmlld3BvcnRTdGFydChtb2RlbCwgMSwgZmFsc2UsIHZpZXdwb3J0U3RhcnRMaW5lVHJhY2tlZFJhbmdlLCAwKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdmlld0xpbmVOdW1iZXIoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld0xpbmVOdW1iZXI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzVmFsaWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzVmFsaWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG1vZGVsVHJhY2tlZFJhbmdlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsVHJhY2tlZFJhbmdlO1xuXHR9XG5cblx0cHVibGljIGdldCBzdGFydExpbmVEZWx0YSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9zdGFydExpbmVEZWx0YTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSBfdmlld0xpbmVOdW1iZXI6IG51bWJlcixcblx0XHRwcml2YXRlIF9pc1ZhbGlkOiBib29sZWFuLFxuXHRcdHByaXZhdGUgX21vZGVsVHJhY2tlZFJhbmdlOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfc3RhcnRMaW5lRGVsdGE6IG51bWJlcixcblx0KSB7IH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9tb2RlbC5fc2V0VHJhY2tlZFJhbmdlKHRoaXMuX21vZGVsVHJhY2tlZFJhbmdlLCBudWxsLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyk7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKG5ldyBQb3NpdGlvbihzdGFydExpbmVOdW1iZXIsIHZpZXdNb2RlbC5nZXRMaW5lTWluQ29sdW1uKHN0YXJ0TGluZU51bWJlcikpKTtcblx0XHRjb25zdCB2aWV3cG9ydFN0YXJ0TGluZVRyYWNrZWRSYW5nZSA9IHZpZXdNb2RlbC5tb2RlbC5fc2V0VHJhY2tlZFJhbmdlKHRoaXMuX21vZGVsVHJhY2tlZFJhbmdlLCBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyk7XG5cdFx0Y29uc3Qgdmlld3BvcnRTdGFydExpbmVUb3AgPSB2aWV3TW9kZWwudmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIoc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCBzY3JvbGxUb3AgPSB2aWV3TW9kZWwudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsVG9wKCk7XG5cblx0XHR0aGlzLl92aWV3TGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjtcblx0XHR0aGlzLl9pc1ZhbGlkID0gdHJ1ZTtcblx0XHR0aGlzLl9tb2RlbFRyYWNrZWRSYW5nZSA9IHZpZXdwb3J0U3RhcnRMaW5lVHJhY2tlZFJhbmdlO1xuXHRcdHRoaXMuX3N0YXJ0TGluZURlbHRhID0gc2Nyb2xsVG9wIC0gdmlld3BvcnRTdGFydExpbmVUb3A7XG5cdH1cblxuXHRwdWJsaWMgaW52YWxpZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc1ZhbGlkID0gZmFsc2U7XG5cdH1cbn1cblxuY2xhc3MgT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hc01hcDogeyBbY29sb3I6IHN0cmluZ106IE92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9uc0dyb3VwIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRyZWFkb25seSBhc0FycmF5OiBPdmVydmlld1J1bGVyRGVjb3JhdGlvbnNHcm91cFtdID0gW107XG5cblx0cHVibGljIGFjY2VwdChjb2xvcjogc3RyaW5nLCB6SW5kZXg6IG51bWJlciwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgbGFuZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJldkdyb3VwID0gdGhpcy5fYXNNYXBbY29sb3JdO1xuXG5cdFx0aWYgKHByZXZHcm91cCkge1xuXHRcdFx0Y29uc3QgcHJldkRhdGEgPSBwcmV2R3JvdXAuZGF0YTtcblx0XHRcdGNvbnN0IHByZXZMYW5lID0gcHJldkRhdGFbcHJldkRhdGEubGVuZ3RoIC0gM107XG5cdFx0XHRjb25zdCBwcmV2RW5kTGluZU51bWJlciA9IHByZXZEYXRhW3ByZXZEYXRhLmxlbmd0aCAtIDFdO1xuXHRcdFx0aWYgKHByZXZMYW5lID09PSBsYW5lICYmIHByZXZFbmRMaW5lTnVtYmVyICsgMSA+PSBzdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Ly8gbWVyZ2UgaW50byBwcmV2XG5cdFx0XHRcdGlmIChlbmRMaW5lTnVtYmVyID4gcHJldkVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRwcmV2RGF0YVtwcmV2RGF0YS5sZW5ndGggLSAxXSA9IGVuZExpbmVOdW1iZXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBwdXNoXG5cdFx0XHRwcmV2RGF0YS5wdXNoKGxhbmUsIHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gbmV3IE92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9uc0dyb3VwKGNvbG9yLCB6SW5kZXgsIFtsYW5lLCBzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXJdKTtcblx0XHRcdHRoaXMuX2FzTWFwW2NvbG9yXSA9IGdyb3VwO1xuXHRcdFx0dGhpcy5hc0FycmF5LnB1c2goZ3JvdXApO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBIaWRkZW5BcmVhc01vZGVsIHtcblx0cHJpdmF0ZSByZWFkb25seSBoaWRkZW5BcmVhcyA9IG5ldyBNYXA8dW5rbm93biwgUmFuZ2VbXT4oKTtcblx0cHJpdmF0ZSBzaG91bGRSZWNvbXB1dGUgPSBmYWxzZTtcblx0cHJpdmF0ZSByYW5nZXM6IFJhbmdlW10gPSBbXTtcblxuXHRzZXRIaWRkZW5BcmVhcyhzb3VyY2U6IHVua25vd24sIHJhbmdlczogUmFuZ2VbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5oaWRkZW5BcmVhcy5nZXQoc291cmNlKTtcblx0XHRpZiAoZXhpc3RpbmcgJiYgcmFuZ2VBcnJheXNFcXVhbChleGlzdGluZywgcmFuZ2VzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmhpZGRlbkFyZWFzLnNldChzb3VyY2UsIHJhbmdlcyk7XG5cdFx0dGhpcy5zaG91bGRSZWNvbXB1dGUgPSB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSByZXR1cm5lZCBhcnJheSBpcyBpbW11dGFibGUuXG5cdCovXG5cdGdldE1lcmdlZFJhbmdlcygpOiByZWFkb25seSBSYW5nZVtdIHtcblx0XHRpZiAoIXRoaXMuc2hvdWxkUmVjb21wdXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yYW5nZXM7XG5cdFx0fVxuXHRcdHRoaXMuc2hvdWxkUmVjb21wdXRlID0gZmFsc2U7XG5cdFx0Y29uc3QgbmV3UmFuZ2VzID0gQXJyYXkuZnJvbSh0aGlzLmhpZGRlbkFyZWFzLnZhbHVlcygpKS5yZWR1Y2UoKHIsIGhpZGRlbkFyZWFzKSA9PiBtZXJnZUxpbmVSYW5nZUFycmF5KHIsIGhpZGRlbkFyZWFzKSwgW10pO1xuXHRcdGlmIChyYW5nZUFycmF5c0VxdWFsKHRoaXMucmFuZ2VzLCBuZXdSYW5nZXMpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yYW5nZXM7XG5cdFx0fVxuXHRcdHRoaXMucmFuZ2VzID0gbmV3UmFuZ2VzO1xuXHRcdHJldHVybiB0aGlzLnJhbmdlcztcblx0fVxufVxuXG5mdW5jdGlvbiBtZXJnZUxpbmVSYW5nZUFycmF5KGFycjE6IFJhbmdlW10sIGFycjI6IFJhbmdlW10pOiBSYW5nZVtdIHtcblx0Y29uc3QgcmVzdWx0ID0gW107XG5cdGxldCBpID0gMDtcblx0bGV0IGogPSAwO1xuXHR3aGlsZSAoaSA8IGFycjEubGVuZ3RoICYmIGogPCBhcnIyLmxlbmd0aCkge1xuXHRcdGNvbnN0IGl0ZW0xID0gYXJyMVtpXTtcblx0XHRjb25zdCBpdGVtMiA9IGFycjJbal07XG5cblx0XHRpZiAoaXRlbTEuZW5kTGluZU51bWJlciA8IGl0ZW0yLnN0YXJ0TGluZU51bWJlciAtIDEpIHtcblx0XHRcdHJlc3VsdC5wdXNoKGFycjFbaSsrXSk7XG5cdFx0fSBlbHNlIGlmIChpdGVtMi5lbmRMaW5lTnVtYmVyIDwgaXRlbTEuc3RhcnRMaW5lTnVtYmVyIC0gMSkge1xuXHRcdFx0cmVzdWx0LnB1c2goYXJyMltqKytdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gTWF0aC5taW4oaXRlbTEuc3RhcnRMaW5lTnVtYmVyLCBpdGVtMi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IE1hdGgubWF4KGl0ZW0xLmVuZExpbmVOdW1iZXIsIGl0ZW0yLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0cmVzdWx0LnB1c2gobmV3IFJhbmdlKHN0YXJ0TGluZU51bWJlciwgMSwgZW5kTGluZU51bWJlciwgMSkpO1xuXHRcdFx0aSsrO1xuXHRcdFx0aisrO1xuXHRcdH1cblx0fVxuXHR3aGlsZSAoaSA8IGFycjEubGVuZ3RoKSB7XG5cdFx0cmVzdWx0LnB1c2goYXJyMVtpKytdKTtcblx0fVxuXHR3aGlsZSAoaiA8IGFycjIubGVuZ3RoKSB7XG5cdFx0cmVzdWx0LnB1c2goYXJyMltqKytdKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiByYW5nZUFycmF5c0VxdWFsKGFycjE6IFJhbmdlW10sIGFycjI6IFJhbmdlW10pOiBib29sZWFuIHtcblx0aWYgKGFycjEubGVuZ3RoICE9PSBhcnIyLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGFycjEubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoIWFycjFbaV0uZXF1YWxzUmFuZ2UoYXJyMltpXSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogTWFpbnRhaW4gYSBzdGFibGUgdmlld3BvcnQgYnkgdHJ5aW5nIHRvIGtlZXAgdGhlIGZpcnN0IGxpbmUgaW4gdGhlIHZpZXdwb3J0IGNvbnN0YW50LlxuICovXG5jbGFzcyBTdGFibGVWaWV3cG9ydCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB2aWV3cG9ydFN0YXJ0TW9kZWxQb3NpdGlvbjogUG9zaXRpb24gfCBudWxsLFxuXHRcdHB1YmxpYyByZWFkb25seSBzdGFydExpbmVEZWx0YTogbnVtYmVyXG5cdCkgeyB9XG5cblx0cHVibGljIHJlY292ZXJWaWV3cG9ydFN0YXJ0KGNvb3JkaW5hdGVzQ29udmVydGVyOiBJQ29vcmRpbmF0ZXNDb252ZXJ0ZXIsIHZpZXdMYXlvdXQ6IFZpZXdMYXlvdXQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlld3BvcnRTdGFydE1vZGVsUG9zaXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbih0aGlzLnZpZXdwb3J0U3RhcnRNb2RlbFBvc2l0aW9uKTtcblx0XHRjb25zdCB2aWV3UG9zaXRpb25Ub3AgPSB2aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih2aWV3UG9zaXRpb24ubGluZU51bWJlcik7XG5cdFx0dmlld0xheW91dC5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcDogdmlld1Bvc2l0aW9uVG9wICsgdGhpcy5zdGFydExpbmVEZWx0YSB9LCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsYUFBYTtBQUV0QixTQUFTLGtCQUErQjtBQUN4QyxZQUFZLGNBQWM7QUFDMUIsWUFBWSxhQUFhO0FBQ3pCLFNBQW9DLGNBQWMsc0JBQXNCLG1DQUFtQztBQUMzRyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUFrRztBQUMzRyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFvQixnQkFBZ0I7QUFDcEMsU0FBUyxhQUFhO0FBRXRCLFNBQTZDLGtCQUFrQjtBQUUvRCxTQUFTLHFCQUFnSiw4QkFBOEI7QUFHdkwsWUFBWSxxQkFBcUI7QUFDakMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBRW5DLFlBQVksZ0JBQWdCO0FBQzVCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUNB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UyxvQkFBb0IsTUFBZSxNQUF3QjtBQUNuRSxRQUFNLFNBQVMsQ0FBQztBQUNoQixNQUFJLElBQUk7QUFDUixNQUFJLElBQUk7QUFDUixTQUFPLElBQUksS0FBSyxVQUFVLElBQUksS0FBSyxRQUFRO0FBQzFDLFVBQU0sUUFBUSxLQUFLLENBQUM7QUFDcEIsVUFBTSxRQUFRLEtBQUssQ0FBQztBQUVwQixRQUFJLE1BQU0sZ0JBQWdCLE1BQU0sa0JBQWtCLEdBQUc7QUFDcEQsYUFBTyxLQUFLLEtBQUssR0FBRyxDQUFDO0FBQUEsSUFDdEIsV0FBVyxNQUFNLGdCQUFnQixNQUFNLGtCQUFrQixHQUFHO0FBQzNELGFBQU8sS0FBSyxLQUFLLEdBQUcsQ0FBQztBQUFBLElBQ3RCLE9BQU87QUFDTixZQUFNLGtCQUFrQixLQUFLLElBQUksTUFBTSxpQkFBaUIsTUFBTSxlQUFlO0FBQzdFLFlBQU0sZ0JBQWdCLEtBQUssSUFBSSxNQUFNLGVBQWUsTUFBTSxhQUFhO0FBQ3ZFLGFBQU8sS0FBSyxJQUFJLE1BQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDLENBQUM7QUFDM0Q7QUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0EsU0FBTyxJQUFJLEtBQUssUUFBUTtBQUN2QixXQUFPLEtBQUssS0FBSyxHQUFHLENBQUM7QUFBQSxFQUN0QjtBQUNBLFNBQU8sSUFBSSxLQUFLLFFBQVE7QUFDdkIsV0FBTyxLQUFLLEtBQUssR0FBRyxDQUFDO0FBQUEsRUFDdEI7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLGlCQUFpQixNQUFlLE1BQXdCO0FBQ2hFLE1BQUksS0FBSyxXQUFXLEtBQUssUUFBUTtBQUNoQyxXQUFPO0FBQUEsRUFDUjtBQUNBLFdBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxRQUFRLEtBQUs7QUFDckMsUUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsR0FBRztBQUNsQyxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7QUFLQSxNQUFNLGVBQWU7QUFBQSxFQUNwQixZQUNpQiw0QkFDQSxnQkFDZjtBQUZlO0FBQ0E7QUFBQSxFQUNiO0FBQUEsRUFFRyxxQkFBcUIsc0JBQTZDLFlBQThCO0FBQ3RHLFFBQUksQ0FBQyxLQUFLLDRCQUE0QjtBQUNyQztBQUFBLElBQ0Q7QUFDQSxVQUFNLGVBQWUscUJBQXFCLG1DQUFtQyxLQUFLLDBCQUEwQjtBQUM1RyxVQUFNLGtCQUFrQixXQUFXLCtCQUErQixhQUFhLFVBQVU7QUFDekYsZUFBVyxrQkFBa0IsRUFBRSxXQUFXLGtCQUFrQixLQUFLLGVBQWUsR0FBRyxXQUFXLFNBQVM7QUFBQSxFQUN4RztBQUNEOyIsCiAgIm5hbWVzIjogWyJyZXN1bHQiXQp9Cg==
