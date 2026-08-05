import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from "../../../../base/browser/ui/mouseCursor/mouseCursor.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import * as platform from "../../../../base/common/platform.js";
import { Constants } from "../../../../base/common/uint.js";
import "./viewLines.css";
import { applyFontInfo } from "../../config/domFontInfo.js";
import { HorizontalPosition, HorizontalRange, LineVisibleRanges } from "../../view/renderingContext.js";
import { VisibleLinesCollection } from "../../view/viewLayer.js";
import { PartFingerprint, PartFingerprints, ViewPart } from "../../view/viewPart.js";
import { DomReadingContext } from "./domReadingContext.js";
import { ViewLine } from "./viewLine.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import * as viewEvents from "../../../common/viewEvents.js";
import { ViewLineOptions } from "./viewLineOptions.js";
class LastRenderedData {
  constructor() {
    this._currentVisibleRange = new Range(1, 1, 1, 1);
  }
  getCurrentVisibleRange() {
    return this._currentVisibleRange;
  }
  setCurrentVisibleRange(currentVisibleRange) {
    this._currentVisibleRange = currentVisibleRange;
  }
}
class HorizontalRevealRangeRequest {
  constructor(minimalReveal, lineNumber, startColumn, endColumn, startScrollTop, stopScrollTop, scrollType) {
    this.minimalReveal = minimalReveal;
    this.lineNumber = lineNumber;
    this.startColumn = startColumn;
    this.endColumn = endColumn;
    this.startScrollTop = startScrollTop;
    this.stopScrollTop = stopScrollTop;
    this.scrollType = scrollType;
    this.type = "range";
    this.minLineNumber = lineNumber;
    this.maxLineNumber = lineNumber;
  }
}
class HorizontalRevealSelectionsRequest {
  constructor(minimalReveal, selections, startScrollTop, stopScrollTop, scrollType) {
    this.minimalReveal = minimalReveal;
    this.selections = selections;
    this.startScrollTop = startScrollTop;
    this.stopScrollTop = stopScrollTop;
    this.scrollType = scrollType;
    this.type = "selections";
    let minLineNumber = selections[0].startLineNumber;
    let maxLineNumber = selections[0].endLineNumber;
    for (let i = 1, len = selections.length; i < len; i++) {
      const selection = selections[i];
      minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
      maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
    }
    this.minLineNumber = minLineNumber;
    this.maxLineNumber = maxLineNumber;
  }
}
const _ViewLines = class _ViewLines extends ViewPart {
  constructor(context, viewGpuContext, linesContent) {
    super(context);
    const conf = this._context.configuration;
    const options = this._context.configuration.options;
    const fontInfo = options.get(EditorOption.fontInfo);
    const wrappingInfo = options.get(EditorOption.wrappingInfo);
    this._lineHeight = options.get(EditorOption.lineHeight);
    this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
    this._isViewportWrapping = wrappingInfo.isViewportWrapping;
    this._revealHorizontalRightPadding = options.get(EditorOption.revealHorizontalRightPadding);
    this._cursorSurroundingLines = options.get(EditorOption.cursorSurroundingLines);
    this._cursorSurroundingLinesStyle = options.get(EditorOption.cursorSurroundingLinesStyle);
    this._canUseLayerHinting = !options.get(EditorOption.disableLayerHinting);
    this._viewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
    this._linesContent = linesContent;
    this._textRangeRestingSpot = document.createElement("div");
    this._visibleLines = new VisibleLinesCollection({
      createLine: () => new ViewLine(viewGpuContext, this._viewLineOptions)
    });
    this.domNode = this._visibleLines.domNode;
    PartFingerprints.write(this.domNode, PartFingerprint.ViewLines);
    this.domNode.setClassName(`view-lines ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
    applyFontInfo(this.domNode, fontInfo);
    this._maxLineWidth = 0;
    this._asyncUpdateLineWidths = new RunOnceScheduler(() => {
      this._updateLineWidthsSlow();
    }, 200);
    this._asyncCheckMonospaceFontAssumptions = new RunOnceScheduler(() => {
      this._checkMonospaceFontAssumptions();
    }, 2e3);
    this._lastRenderedData = new LastRenderedData();
    this._horizontalRevealRequest = null;
    this._stickyScrollEnabled = options.get(EditorOption.stickyScroll).enabled;
    this._maxNumberStickyLines = options.get(EditorOption.stickyScroll).maxLineCount;
  }
  dispose() {
    this._asyncUpdateLineWidths.dispose();
    this._asyncCheckMonospaceFontAssumptions.dispose();
    super.dispose();
  }
  getDomNode() {
    return this.domNode;
  }
  // ---- begin view event handlers
  onConfigurationChanged(e) {
    this._visibleLines.onConfigurationChanged(e);
    if (e.hasChanged(EditorOption.wrappingInfo)) {
      this._maxLineWidth = 0;
    }
    const options = this._context.configuration.options;
    const fontInfo = options.get(EditorOption.fontInfo);
    const wrappingInfo = options.get(EditorOption.wrappingInfo);
    this._lineHeight = options.get(EditorOption.lineHeight);
    this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
    this._isViewportWrapping = wrappingInfo.isViewportWrapping;
    this._revealHorizontalRightPadding = options.get(EditorOption.revealHorizontalRightPadding);
    this._cursorSurroundingLines = options.get(EditorOption.cursorSurroundingLines);
    this._cursorSurroundingLinesStyle = options.get(EditorOption.cursorSurroundingLinesStyle);
    this._canUseLayerHinting = !options.get(EditorOption.disableLayerHinting);
    this._stickyScrollEnabled = options.get(EditorOption.stickyScroll).enabled;
    this._maxNumberStickyLines = options.get(EditorOption.stickyScroll).maxLineCount;
    applyFontInfo(this.domNode, fontInfo);
    this._onOptionsMaybeChanged();
    if (e.hasChanged(EditorOption.layoutInfo)) {
      this._maxLineWidth = 0;
    }
    return true;
  }
  _onOptionsMaybeChanged() {
    const conf = this._context.configuration;
    const newViewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
    if (!this._viewLineOptions.equals(newViewLineOptions)) {
      this._viewLineOptions = newViewLineOptions;
      const startLineNumber = this._visibleLines.getStartLineNumber();
      const endLineNumber = this._visibleLines.getEndLineNumber();
      for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
        const line = this._visibleLines.getVisibleLine(lineNumber);
        line.onOptionsChanged(this._viewLineOptions);
      }
      return true;
    }
    return false;
  }
  onCursorStateChanged(e) {
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    let r = false;
    for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
      r = this._visibleLines.getVisibleLine(lineNumber).onSelectionChanged() || r;
    }
    return r;
  }
  onDecorationsChanged(e) {
    if (true) {
      const rendStartLineNumber = this._visibleLines.getStartLineNumber();
      const rendEndLineNumber = this._visibleLines.getEndLineNumber();
      for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
        this._visibleLines.getVisibleLine(lineNumber).onDecorationsChanged();
      }
    }
    return true;
  }
  onFlushed(e) {
    const shouldRender = this._visibleLines.onFlushed(e, this._viewLineOptions.useGpu);
    this._maxLineWidth = 0;
    return shouldRender;
  }
  onLinesChanged(e) {
    return this._visibleLines.onLinesChanged(e);
  }
  onLinesDeleted(e) {
    return this._visibleLines.onLinesDeleted(e);
  }
  onLinesInserted(e) {
    return this._visibleLines.onLinesInserted(e);
  }
  onRevealRangeRequest(e) {
    const desiredScrollTop = this._computeScrollTopToRevealRange(this._context.viewLayout.getFutureViewport(), e.source, e.minimalReveal, e.range, e.selections, e.verticalType);
    if (desiredScrollTop === -1) {
      return false;
    }
    let newScrollPosition = this._context.viewLayout.validateScrollPosition({ scrollTop: desiredScrollTop });
    if (e.revealHorizontal) {
      if (e.range && e.range.startLineNumber !== e.range.endLineNumber) {
        newScrollPosition = {
          scrollTop: newScrollPosition.scrollTop,
          scrollLeft: 0
        };
      } else if (e.range) {
        this._horizontalRevealRequest = new HorizontalRevealRangeRequest(e.minimalReveal, e.range.startLineNumber, e.range.startColumn, e.range.endColumn, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
      } else if (e.selections && e.selections.length > 0) {
        this._horizontalRevealRequest = new HorizontalRevealSelectionsRequest(e.minimalReveal, e.selections, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
      }
    } else {
      this._horizontalRevealRequest = null;
    }
    const scrollTopDelta = Math.abs(this._context.viewLayout.getCurrentScrollTop() - newScrollPosition.scrollTop);
    const scrollType = scrollTopDelta <= this._lineHeight ? ScrollType.Immediate : e.scrollType;
    this._context.viewModel.viewLayout.setScrollPosition(newScrollPosition, scrollType);
    return true;
  }
  onScrollChanged(e) {
    if (this._horizontalRevealRequest && e.scrollLeftChanged) {
      this._horizontalRevealRequest = null;
    }
    if (this._horizontalRevealRequest && e.scrollTopChanged) {
      const min = Math.min(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
      const max = Math.max(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
      if (e.scrollTop < min || e.scrollTop > max) {
        this._horizontalRevealRequest = null;
      }
    }
    this.domNode.setWidth(e.scrollWidth);
    return this._visibleLines.onScrollChanged(e) || true;
  }
  onTokensChanged(e) {
    return this._visibleLines.onTokensChanged(e);
  }
  onZonesChanged(e) {
    this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
    return this._visibleLines.onZonesChanged(e);
  }
  onThemeChanged(e) {
    return this._onOptionsMaybeChanged();
  }
  // ---- end view event handlers
  // ----------- HELPERS FOR OTHERS
  getPositionFromDOMInfo(spanNode, offset) {
    const viewLineDomNode = this._getViewLineDomNode(spanNode);
    if (viewLineDomNode === null) {
      return null;
    }
    const lineNumber = this._getLineNumberFor(viewLineDomNode);
    if (lineNumber === -1) {
      return null;
    }
    if (lineNumber < 1 || lineNumber > this._context.viewModel.getLineCount()) {
      return null;
    }
    if (this._context.viewModel.getLineMaxColumn(lineNumber) === 1) {
      return new Position(lineNumber, 1);
    }
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
      return null;
    }
    let column = this._visibleLines.getVisibleLine(lineNumber).getColumnOfNodeOffset(spanNode, offset);
    const minColumn = this._context.viewModel.getLineMinColumn(lineNumber);
    if (column < minColumn) {
      column = minColumn;
    }
    return new Position(lineNumber, column);
  }
  _getViewLineDomNode(node) {
    while (node && node.nodeType === 1) {
      if (node.className === ViewLine.CLASS_NAME) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }
  /**
   * @returns the line number of this view line dom node.
   */
  _getLineNumberFor(domNode) {
    const startLineNumber = this._visibleLines.getStartLineNumber();
    const endLineNumber = this._visibleLines.getEndLineNumber();
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      const line = this._visibleLines.getVisibleLine(lineNumber);
      if (domNode === line.getDomNode()) {
        return lineNumber;
      }
    }
    return -1;
  }
  getLineWidth(lineNumber) {
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
      return -1;
    }
    const context = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
    const result = this._visibleLines.getVisibleLine(lineNumber).getWidth(context);
    this._updateLineWidthsSlowIfDomDidLayout(context);
    return result;
  }
  linesVisibleRangesForRange(_range, includeNewLines) {
    if (this.shouldRender()) {
      return null;
    }
    const originalEndLineNumber = _range.endLineNumber;
    const range = Range.intersectRanges(_range, this._lastRenderedData.getCurrentVisibleRange());
    if (!range) {
      return null;
    }
    const visibleRanges = [];
    let visibleRangesLen = 0;
    const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
    let nextLineModelLineNumber = 0;
    if (includeNewLines) {
      nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
    }
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
        continue;
      }
      const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
      const continuesInNextLine = lineNumber !== range.endLineNumber;
      const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
      const visibleRangesForLine = this._visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
      if (!visibleRangesForLine) {
        continue;
      }
      if (includeNewLines && lineNumber < originalEndLineNumber) {
        const currentLineModelLineNumber = nextLineModelLineNumber;
        nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
        if (currentLineModelLineNumber !== nextLineModelLineNumber) {
          visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1].width += this._typicalHalfwidthCharacterWidth;
        }
      }
      visibleRanges[visibleRangesLen++] = new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine);
    }
    this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
    if (visibleRangesLen === 0) {
      return null;
    }
    return visibleRanges;
  }
  _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
    if (this.shouldRender()) {
      return null;
    }
    if (lineNumber < this._visibleLines.getStartLineNumber() || lineNumber > this._visibleLines.getEndLineNumber()) {
      return null;
    }
    const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
    const result = this._visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
    this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
    return result;
  }
  visibleRangeForPosition(position) {
    const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
    if (!visibleRanges) {
      return null;
    }
    return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
  }
  // --- implementation
  updateLineWidths() {
    this._updateLineWidths(false);
  }
  /**
   * Updates the max line width if it is fast to compute.
   * Returns true if all lines were taken into account.
   * Returns false if some lines need to be reevaluated (in a slow fashion).
   */
  _updateLineWidthsFast() {
    return this._updateLineWidths(true);
  }
  _updateLineWidthsSlow() {
    this._updateLineWidths(false);
  }
  /**
   * Update the line widths using DOM layout information after someone else
   * has caused a synchronous layout.
   */
  _updateLineWidthsSlowIfDomDidLayout(domReadingContext) {
    if (!domReadingContext.didDomLayout) {
      return;
    }
    if (this._asyncUpdateLineWidths.isScheduled()) {
      return;
    }
    this._asyncUpdateLineWidths.cancel();
    this._updateLineWidthsSlow();
  }
  _updateLineWidths(fast) {
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    let localMaxLineWidth = 1;
    let allWidthsComputed = true;
    for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
      const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
      if (fast && !visibleLine.getWidthIsFast()) {
        allWidthsComputed = false;
        continue;
      }
      localMaxLineWidth = Math.max(localMaxLineWidth, visibleLine.getWidth(null));
    }
    if (allWidthsComputed && rendStartLineNumber === 1 && rendEndLineNumber === this._context.viewModel.getLineCount()) {
      this._maxLineWidth = 0;
    }
    this._ensureMaxLineWidth(localMaxLineWidth);
    return allWidthsComputed;
  }
  _checkMonospaceFontAssumptions() {
    let longestLineNumber = -1;
    let longestWidth = -1;
    const rendStartLineNumber = this._visibleLines.getStartLineNumber();
    const rendEndLineNumber = this._visibleLines.getEndLineNumber();
    for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
      const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
      if (visibleLine.needsMonospaceFontCheck()) {
        const lineWidth = visibleLine.getWidth(null);
        if (lineWidth > longestWidth) {
          longestWidth = lineWidth;
          longestLineNumber = lineNumber;
        }
      }
    }
    if (longestLineNumber === -1) {
      return;
    }
    if (!this._visibleLines.getVisibleLine(longestLineNumber).monospaceAssumptionsAreValid()) {
      for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
        const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
        visibleLine.onMonospaceAssumptionsInvalidated();
      }
    }
  }
  prepareRender() {
    throw new Error("Not supported");
  }
  render() {
    throw new Error("Not supported");
  }
  renderText(viewportData) {
    this._visibleLines.renderLines(viewportData);
    this._lastRenderedData.setCurrentVisibleRange(viewportData.visibleRange);
    this.domNode.setWidth(this._context.viewLayout.getScrollWidth());
    this.domNode.setHeight(Math.min(this._context.viewLayout.getScrollHeight(), 1e6));
    if (this._horizontalRevealRequest) {
      const horizontalRevealRequest = this._horizontalRevealRequest;
      if (viewportData.startLineNumber <= horizontalRevealRequest.minLineNumber && horizontalRevealRequest.maxLineNumber <= viewportData.endLineNumber) {
        this._horizontalRevealRequest = null;
        this.onDidRender();
        const newScrollLeft = this._computeScrollLeftToReveal(horizontalRevealRequest);
        if (newScrollLeft) {
          if (!this._isViewportWrapping) {
            this._ensureMaxLineWidth(newScrollLeft.maxHorizontalOffset);
          }
          this._context.viewModel.viewLayout.setScrollPosition({
            scrollLeft: newScrollLeft.scrollLeft
          }, horizontalRevealRequest.scrollType);
        }
      }
    }
    if (!this._updateLineWidthsFast()) {
      this._asyncUpdateLineWidths.schedule();
    } else {
      this._asyncUpdateLineWidths.cancel();
    }
    if (platform.isLinux && !this._asyncCheckMonospaceFontAssumptions.isScheduled()) {
      const rendStartLineNumber = this._visibleLines.getStartLineNumber();
      const rendEndLineNumber = this._visibleLines.getEndLineNumber();
      for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
        const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
        if (visibleLine.needsMonospaceFontCheck()) {
          this._asyncCheckMonospaceFontAssumptions.schedule();
          break;
        }
      }
    }
    this._linesContent.setLayerHinting(this._canUseLayerHinting);
    this._linesContent.setContain("strict");
    const adjustedScrollTop = this._context.viewLayout.getCurrentScrollTop() - viewportData.bigNumbersDelta;
    this._linesContent.setTop(-adjustedScrollTop);
    this._linesContent.setLeft(-this._context.viewLayout.getCurrentScrollLeft());
  }
  // --- width
  _ensureMaxLineWidth(lineWidth) {
    const iLineWidth = Math.ceil(lineWidth);
    if (this._maxLineWidth < iLineWidth) {
      this._maxLineWidth = iLineWidth;
      this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
    }
  }
  _computeScrollTopToRevealRange(viewport, source, minimalReveal, range, selections, verticalType) {
    const viewportStartY = viewport.top;
    const viewportHeight = viewport.height;
    const viewportEndY = viewportStartY + viewportHeight;
    let boxIsSingleRange;
    let boxStartY;
    let boxEndY;
    if (selections && selections.length > 0) {
      let minLineNumber = selections[0].startLineNumber;
      let maxLineNumber = selections[0].endLineNumber;
      for (let i = 1, len = selections.length; i < len; i++) {
        const selection = selections[i];
        minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
        maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
      }
      boxIsSingleRange = false;
      boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(minLineNumber);
      boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(maxLineNumber) + this._lineHeight;
    } else if (range) {
      boxIsSingleRange = true;
      boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.startLineNumber);
      boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.endLineNumber) + this._lineHeight;
    } else {
      return -1;
    }
    const shouldIgnoreScrollOff = (source === "mouse" || minimalReveal) && this._cursorSurroundingLinesStyle === "default";
    let paddingTop = 0;
    let paddingBottom = 0;
    if (!shouldIgnoreScrollOff) {
      const maxLinesInViewport = viewportHeight / this._lineHeight;
      const surroundingLines = Math.max(this._cursorSurroundingLines, this._stickyScrollEnabled ? this._maxNumberStickyLines : 0);
      const context = Math.min(maxLinesInViewport / 2, surroundingLines);
      paddingTop = context * this._lineHeight;
      paddingBottom = Math.max(0, context - 1) * this._lineHeight;
    } else {
      if (!minimalReveal) {
        paddingTop = this._lineHeight;
      }
    }
    if (!minimalReveal) {
      if (verticalType === viewEvents.VerticalRevealType.Simple || verticalType === viewEvents.VerticalRevealType.Bottom) {
        paddingBottom += this._lineHeight;
      }
    }
    boxStartY -= paddingTop;
    boxEndY += paddingBottom;
    let newScrollTop;
    if (boxEndY - boxStartY > viewportHeight) {
      if (!boxIsSingleRange) {
        return -1;
      }
      newScrollTop = boxStartY;
    } else if (verticalType === viewEvents.VerticalRevealType.NearTop || verticalType === viewEvents.VerticalRevealType.NearTopIfOutsideViewport) {
      if (verticalType === viewEvents.VerticalRevealType.NearTopIfOutsideViewport && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
        newScrollTop = viewportStartY;
      } else {
        const desiredGapAbove = Math.max(5 * this._lineHeight, viewportHeight * 0.2);
        const desiredScrollTop = boxStartY - desiredGapAbove;
        const minScrollTop = boxEndY - viewportHeight;
        newScrollTop = Math.max(minScrollTop, desiredScrollTop);
      }
    } else if (verticalType === viewEvents.VerticalRevealType.Center || verticalType === viewEvents.VerticalRevealType.CenterIfOutsideViewport) {
      if (verticalType === viewEvents.VerticalRevealType.CenterIfOutsideViewport && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
        newScrollTop = viewportStartY;
      } else {
        const boxMiddleY = (boxStartY + boxEndY) / 2;
        newScrollTop = Math.max(0, boxMiddleY - viewportHeight / 2);
      }
    } else {
      newScrollTop = this._computeMinimumScrolling(viewportStartY, viewportEndY, boxStartY, boxEndY, verticalType === viewEvents.VerticalRevealType.Top, verticalType === viewEvents.VerticalRevealType.Bottom);
    }
    return newScrollTop;
  }
  _computeScrollLeftToReveal(horizontalRevealRequest) {
    const viewport = this._context.viewLayout.getCurrentViewport();
    const layoutInfo = this._context.configuration.options.get(EditorOption.layoutInfo);
    const viewportStartX = viewport.left;
    const viewportEndX = viewportStartX + viewport.width - layoutInfo.verticalScrollbarWidth;
    let boxStartX = Constants.MAX_SAFE_SMALL_INTEGER;
    let boxEndX = 0;
    if (horizontalRevealRequest.type === "range") {
      const visibleRanges = this._visibleRangesForLineRange(horizontalRevealRequest.lineNumber, horizontalRevealRequest.startColumn, horizontalRevealRequest.endColumn);
      if (!visibleRanges) {
        return null;
      }
      for (const visibleRange of visibleRanges.ranges) {
        boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
        boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
      }
    } else {
      for (const selection of horizontalRevealRequest.selections) {
        if (selection.startLineNumber !== selection.endLineNumber) {
          return null;
        }
        const visibleRanges = this._visibleRangesForLineRange(selection.startLineNumber, selection.startColumn, selection.endColumn);
        if (!visibleRanges) {
          return null;
        }
        for (const visibleRange of visibleRanges.ranges) {
          boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
          boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
        }
      }
    }
    if (!horizontalRevealRequest.minimalReveal) {
      boxStartX = Math.max(0, boxStartX - _ViewLines.HORIZONTAL_EXTRA_PX);
      boxEndX += this._revealHorizontalRightPadding;
    }
    if (horizontalRevealRequest.type === "selections" && boxEndX - boxStartX > viewport.width) {
      return null;
    }
    const newScrollLeft = this._computeMinimumScrolling(viewportStartX, viewportEndX, boxStartX, boxEndX);
    return {
      scrollLeft: newScrollLeft,
      maxHorizontalOffset: boxEndX
    };
  }
  _computeMinimumScrolling(viewportStart, viewportEnd, boxStart, boxEnd, revealAtStart, revealAtEnd) {
    viewportStart = viewportStart | 0;
    viewportEnd = viewportEnd | 0;
    boxStart = boxStart | 0;
    boxEnd = boxEnd | 0;
    revealAtStart = !!revealAtStart;
    revealAtEnd = !!revealAtEnd;
    const viewportLength = viewportEnd - viewportStart;
    const boxLength = boxEnd - boxStart;
    if (boxLength < viewportLength) {
      if (revealAtStart) {
        return boxStart;
      }
      if (revealAtEnd) {
        return Math.max(0, boxEnd - viewportLength);
      }
      if (boxStart < viewportStart) {
        return boxStart;
      } else if (boxEnd > viewportEnd) {
        return Math.max(0, boxEnd - viewportLength);
      }
    } else {
      return boxStart;
    }
    return viewportStart;
  }
};
/**
 * Adds this amount of pixels to the right of lines (no-one wants to type near the edge of the viewport)
 */
_ViewLines.HORIZONTAL_EXTRA_PX = 30;
let ViewLines = _ViewLines;
export {
  ViewLines
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0xpbmVzL3ZpZXdMaW5lcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEZhc3REb21Ob2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Zhc3REb21Ob2RlLmpzJztcbmltcG9ydCB7IE1PVVNFX0NVUlNPUl9URVhUX0NTU19DTEFTU19OQU1FIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL21vdXNlQ3Vyc29yL21vdXNlQ3Vyc29yLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCAnLi92aWV3TGluZXMuY3NzJztcbmltcG9ydCB7IGFwcGx5Rm9udEluZm8gfSBmcm9tICcuLi8uLi9jb25maWcvZG9tRm9udEluZm8uanMnO1xuaW1wb3J0IHsgSG9yaXpvbnRhbFBvc2l0aW9uLCBIb3Jpem9udGFsUmFuZ2UsIElWaWV3TGluZXMsIExpbmVWaXNpYmxlUmFuZ2VzLCBWaXNpYmxlUmFuZ2VzIH0gZnJvbSAnLi4vLi4vdmlldy9yZW5kZXJpbmdDb250ZXh0LmpzJztcbmltcG9ydCB7IFZpc2libGVMaW5lc0NvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi92aWV3L3ZpZXdMYXllci5qcyc7XG5pbXBvcnQgeyBQYXJ0RmluZ2VycHJpbnQsIFBhcnRGaW5nZXJwcmludHMsIFZpZXdQYXJ0IH0gZnJvbSAnLi4vLi4vdmlldy92aWV3UGFydC5qcyc7XG5pbXBvcnQgeyBEb21SZWFkaW5nQ29udGV4dCB9IGZyb20gJy4vZG9tUmVhZGluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgVmlld0xpbmUgfSBmcm9tICcuL3ZpZXdMaW5lLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgVmlld3BvcnREYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVzVmlld3BvcnREYXRhLmpzJztcbmltcG9ydCB7IFZpZXdwb3J0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHsgVmlld0xpbmVPcHRpb25zIH0gZnJvbSAnLi92aWV3TGluZU9wdGlvbnMuanMnO1xuaW1wb3J0IHR5cGUgeyBWaWV3R3B1Q29udGV4dCB9IGZyb20gJy4uLy4uL2dwdS92aWV3R3B1Q29udGV4dC5qcyc7XG5cbmNsYXNzIExhc3RSZW5kZXJlZERhdGEge1xuXG5cdHByaXZhdGUgX2N1cnJlbnRWaXNpYmxlUmFuZ2U6IFJhbmdlO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX2N1cnJlbnRWaXNpYmxlUmFuZ2UgPSBuZXcgUmFuZ2UoMSwgMSwgMSwgMSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q3VycmVudFZpc2libGVSYW5nZSgpOiBSYW5nZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnRWaXNpYmxlUmFuZ2U7XG5cdH1cblxuXHRwdWJsaWMgc2V0Q3VycmVudFZpc2libGVSYW5nZShjdXJyZW50VmlzaWJsZVJhbmdlOiBSYW5nZSk6IHZvaWQge1xuXHRcdHRoaXMuX2N1cnJlbnRWaXNpYmxlUmFuZ2UgPSBjdXJyZW50VmlzaWJsZVJhbmdlO1xuXHR9XG59XG5cbmNsYXNzIEhvcml6b250YWxSZXZlYWxSYW5nZVJlcXVlc3Qge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9ICdyYW5nZSc7XG5cdHB1YmxpYyByZWFkb25seSBtaW5MaW5lTnVtYmVyOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBtYXhMaW5lTnVtYmVyOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1pbmltYWxSZXZlYWw6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmVOdW1iZXI6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc3RhcnRDb2x1bW46IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZW5kQ29sdW1uOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0YXJ0U2Nyb2xsVG9wOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0b3BTY3JvbGxUb3A6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2Nyb2xsVHlwZTogU2Nyb2xsVHlwZVxuXHQpIHtcblx0XHR0aGlzLm1pbkxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyO1xuXHRcdHRoaXMubWF4TGluZU51bWJlciA9IGxpbmVOdW1iZXI7XG5cdH1cbn1cblxuY2xhc3MgSG9yaXpvbnRhbFJldmVhbFNlbGVjdGlvbnNSZXF1ZXN0IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSAnc2VsZWN0aW9ucyc7XG5cdHB1YmxpYyByZWFkb25seSBtaW5MaW5lTnVtYmVyOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBtYXhMaW5lTnVtYmVyOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1pbmltYWxSZXZlYWw6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdLFxuXHRcdHB1YmxpYyByZWFkb25seSBzdGFydFNjcm9sbFRvcDogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBzdG9wU2Nyb2xsVG9wOiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHNjcm9sbFR5cGU6IFNjcm9sbFR5cGVcblx0KSB7XG5cdFx0bGV0IG1pbkxpbmVOdW1iZXIgPSBzZWxlY3Rpb25zWzBdLnN0YXJ0TGluZU51bWJlcjtcblx0XHRsZXQgbWF4TGluZU51bWJlciA9IHNlbGVjdGlvbnNbMF0uZW5kTGluZU51bWJlcjtcblx0XHRmb3IgKGxldCBpID0gMSwgbGVuID0gc2VsZWN0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gc2VsZWN0aW9uc1tpXTtcblx0XHRcdG1pbkxpbmVOdW1iZXIgPSBNYXRoLm1pbihtaW5MaW5lTnVtYmVyLCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdG1heExpbmVOdW1iZXIgPSBNYXRoLm1heChtYXhMaW5lTnVtYmVyLCBzZWxlY3Rpb24uZW5kTGluZU51bWJlcik7XG5cdFx0fVxuXHRcdHRoaXMubWluTGluZU51bWJlciA9IG1pbkxpbmVOdW1iZXI7XG5cdFx0dGhpcy5tYXhMaW5lTnVtYmVyID0gbWF4TGluZU51bWJlcjtcblx0fVxufVxuXG50eXBlIEhvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gSG9yaXpvbnRhbFJldmVhbFJhbmdlUmVxdWVzdCB8IEhvcml6b250YWxSZXZlYWxTZWxlY3Rpb25zUmVxdWVzdDtcblxuLyoqXG4gKiBUaGUgdmlldyBsaW5lcyBwYXJ0IGlzIHJlc3BvbnNpYmxlIGZvciByZW5kZXJpbmcgdGhlIGFjdHVhbCBjb250ZW50IG9mIGFcbiAqIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBWaWV3TGluZXMgZXh0ZW5kcyBWaWV3UGFydCBpbXBsZW1lbnRzIElWaWV3TGluZXMge1xuXHQvKipcblx0ICogQWRkcyB0aGlzIGFtb3VudCBvZiBwaXhlbHMgdG8gdGhlIHJpZ2h0IG9mIGxpbmVzIChuby1vbmUgd2FudHMgdG8gdHlwZSBuZWFyIHRoZSBlZGdlIG9mIHRoZSB2aWV3cG9ydClcblx0ICovXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEhPUklaT05UQUxfRVhUUkFfUFggPSAzMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5lc0NvbnRlbnQ6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfdGV4dFJhbmdlUmVzdGluZ1Nwb3Q6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmxlTGluZXM6IFZpc2libGVMaW5lc0NvbGxlY3Rpb248Vmlld0xpbmU+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PjtcblxuXHQvLyAtLS0gY29uZmlnXG5cdHByaXZhdGUgX2xpbmVIZWlnaHQ6IG51bWJlcjtcblx0cHJpdmF0ZSBfdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBudW1iZXI7XG5cdHByaXZhdGUgX2lzVmlld3BvcnRXcmFwcGluZzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfcmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZzogbnVtYmVyO1xuXHRwcml2YXRlIF9jdXJzb3JTdXJyb3VuZGluZ0xpbmVzOiBudW1iZXI7XG5cdHByaXZhdGUgX2N1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZTogJ2RlZmF1bHQnIHwgJ2FsbCc7XG5cdHByaXZhdGUgX2NhblVzZUxheWVySGludGluZzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfdmlld0xpbmVPcHRpb25zOiBWaWV3TGluZU9wdGlvbnM7XG5cblx0Ly8gLS0tIHdpZHRoXG5cdHByaXZhdGUgX21heExpbmVXaWR0aDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hc3luY1VwZGF0ZUxpbmVXaWR0aHM6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FzeW5jQ2hlY2tNb25vc3BhY2VGb250QXNzdW1wdGlvbnM6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0cHJpdmF0ZSBfaG9yaXpvbnRhbFJldmVhbFJlcXVlc3Q6IEhvcml6b250YWxSZXZlYWxSZXF1ZXN0IHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFzdFJlbmRlcmVkRGF0YTogTGFzdFJlbmRlcmVkRGF0YTtcblxuXHQvLyBTdGlja3kgU2Nyb2xsXG5cdHByaXZhdGUgX3N0aWNreVNjcm9sbEVuYWJsZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX21heE51bWJlclN0aWNreUxpbmVzOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoY29udGV4dDogVmlld0NvbnRleHQsIHZpZXdHcHVDb250ZXh0OiBWaWV3R3B1Q29udGV4dCB8IHVuZGVmaW5lZCwgbGluZXNDb250ZW50OiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4pIHtcblx0XHRzdXBlcihjb250ZXh0KTtcblxuXHRcdGNvbnN0IGNvbmYgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb247XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdGNvbnN0IGZvbnRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCB3cmFwcGluZ0luZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ud3JhcHBpbmdJbmZvKTtcblxuXHRcdHRoaXMuX2xpbmVIZWlnaHQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0dGhpcy5fdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoID0gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdHRoaXMuX2lzVmlld3BvcnRXcmFwcGluZyA9IHdyYXBwaW5nSW5mby5pc1ZpZXdwb3J0V3JhcHBpbmc7XG5cdFx0dGhpcy5fcmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZXZlYWxIb3Jpem9udGFsUmlnaHRQYWRkaW5nKTtcblx0XHR0aGlzLl9jdXJzb3JTdXJyb3VuZGluZ0xpbmVzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmN1cnNvclN1cnJvdW5kaW5nTGluZXMpO1xuXHRcdHRoaXMuX2N1cnNvclN1cnJvdW5kaW5nTGluZXNTdHlsZSA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5jdXJzb3JTdXJyb3VuZGluZ0xpbmVzU3R5bGUpO1xuXHRcdHRoaXMuX2NhblVzZUxheWVySGludGluZyA9ICFvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZGlzYWJsZUxheWVySGludGluZyk7XG5cdFx0dGhpcy5fdmlld0xpbmVPcHRpb25zID0gbmV3IFZpZXdMaW5lT3B0aW9ucyhjb25mLCB0aGlzLl9jb250ZXh0LnRoZW1lLnR5cGUpO1xuXG5cdFx0dGhpcy5fbGluZXNDb250ZW50ID0gbGluZXNDb250ZW50O1xuXHRcdHRoaXMuX3RleHRSYW5nZVJlc3RpbmdTcG90ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fdmlzaWJsZUxpbmVzID0gbmV3IFZpc2libGVMaW5lc0NvbGxlY3Rpb24oe1xuXHRcdFx0Y3JlYXRlTGluZTogKCkgPT4gbmV3IFZpZXdMaW5lKHZpZXdHcHVDb250ZXh0LCB0aGlzLl92aWV3TGluZU9wdGlvbnMpLFxuXHRcdH0pO1xuXHRcdHRoaXMuZG9tTm9kZSA9IHRoaXMuX3Zpc2libGVMaW5lcy5kb21Ob2RlO1xuXG5cdFx0UGFydEZpbmdlcnByaW50cy53cml0ZSh0aGlzLmRvbU5vZGUsIFBhcnRGaW5nZXJwcmludC5WaWV3TGluZXMpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRDbGFzc05hbWUoYHZpZXctbGluZXMgJHtNT1VTRV9DVVJTT1JfVEVYVF9DU1NfQ0xBU1NfTkFNRX1gKTtcblx0XHRhcHBseUZvbnRJbmZvKHRoaXMuZG9tTm9kZSwgZm9udEluZm8pO1xuXG5cdFx0Ly8gLS0tIHdpZHRoICYgaGVpZ2h0XG5cdFx0dGhpcy5fbWF4TGluZVdpZHRoID0gMDtcblx0XHR0aGlzLl9hc3luY1VwZGF0ZUxpbmVXaWR0aHMgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVMaW5lV2lkdGhzU2xvdygpO1xuXHRcdH0sIDIwMCk7XG5cdFx0dGhpcy5fYXN5bmNDaGVja01vbm9zcGFjZUZvbnRBc3N1bXB0aW9ucyA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdHRoaXMuX2NoZWNrTW9ub3NwYWNlRm9udEFzc3VtcHRpb25zKCk7XG5cdFx0fSwgMjAwMCk7XG5cblx0XHR0aGlzLl9sYXN0UmVuZGVyZWREYXRhID0gbmV3IExhc3RSZW5kZXJlZERhdGEoKTtcblxuXHRcdHRoaXMuX2hvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gbnVsbDtcblxuXHRcdC8vIHN0aWNreSBzY3JvbGwgd2lkZ2V0XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsRW5hYmxlZCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpLmVuYWJsZWQ7XG5cdFx0dGhpcy5fbWF4TnVtYmVyU3RpY2t5TGluZXMgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc3RpY2t5U2Nyb2xsKS5tYXhMaW5lQ291bnQ7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9hc3luY1VwZGF0ZUxpbmVXaWR0aHMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2FzeW5jQ2hlY2tNb25vc3BhY2VGb250QXNzdW1wdGlvbnMuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXREb21Ob2RlKCk6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9tTm9kZTtcblx0fVxuXG5cdC8vIC0tLS0gYmVnaW4gdmlldyBldmVudCBoYW5kbGVyc1xuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl92aXNpYmxlTGluZXMub25Db25maWd1cmF0aW9uQ2hhbmdlZChlKTtcblx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi53cmFwcGluZ0luZm8pKSB7XG5cdFx0XHR0aGlzLl9tYXhMaW5lV2lkdGggPSAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBmb250SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0Y29uc3Qgd3JhcHBpbmdJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbyk7XG5cblx0XHR0aGlzLl9saW5lSGVpZ2h0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdHRoaXMuX3R5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA9IGZvbnRJbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDtcblx0XHR0aGlzLl9pc1ZpZXdwb3J0V3JhcHBpbmcgPSB3cmFwcGluZ0luZm8uaXNWaWV3cG9ydFdyYXBwaW5nO1xuXHRcdHRoaXMuX3JldmVhbEhvcml6b250YWxSaWdodFBhZGRpbmcgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ucmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZyk7XG5cdFx0dGhpcy5fY3Vyc29yU3Vycm91bmRpbmdMaW5lcyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5jdXJzb3JTdXJyb3VuZGluZ0xpbmVzKTtcblx0XHR0aGlzLl9jdXJzb3JTdXJyb3VuZGluZ0xpbmVzU3R5bGUgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uY3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlKTtcblx0XHR0aGlzLl9jYW5Vc2VMYXllckhpbnRpbmcgPSAhb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmRpc2FibGVMYXllckhpbnRpbmcpO1xuXG5cdFx0Ly8gc3RpY2t5IHNjcm9sbFxuXHRcdHRoaXMuX3N0aWNreVNjcm9sbEVuYWJsZWQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc3RpY2t5U2Nyb2xsKS5lbmFibGVkO1xuXHRcdHRoaXMuX21heE51bWJlclN0aWNreUxpbmVzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnN0aWNreVNjcm9sbCkubWF4TGluZUNvdW50O1xuXG5cdFx0YXBwbHlGb250SW5mbyh0aGlzLmRvbU5vZGUsIGZvbnRJbmZvKTtcblxuXHRcdHRoaXMuX29uT3B0aW9uc01heWJlQ2hhbmdlZCgpO1xuXG5cdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbykpIHtcblx0XHRcdHRoaXMuX21heExpbmVXaWR0aCA9IDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHJpdmF0ZSBfb25PcHRpb25zTWF5YmVDaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGNvbmYgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb247XG5cblx0XHRjb25zdCBuZXdWaWV3TGluZU9wdGlvbnMgPSBuZXcgVmlld0xpbmVPcHRpb25zKGNvbmYsIHRoaXMuX2NvbnRleHQudGhlbWUudHlwZSk7XG5cdFx0aWYgKCF0aGlzLl92aWV3TGluZU9wdGlvbnMuZXF1YWxzKG5ld1ZpZXdMaW5lT3B0aW9ucykpIHtcblx0XHRcdHRoaXMuX3ZpZXdMaW5lT3B0aW9ucyA9IG5ld1ZpZXdMaW5lT3B0aW9ucztcblxuXHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRFbmRMaW5lTnVtYmVyKCk7XG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IGVuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFZpc2libGVMaW5lKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRsaW5lLm9uT3B0aW9uc0NoYW5nZWQodGhpcy5fdmlld0xpbmVPcHRpb25zKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25DdXJzb3JTdGF0ZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdGNvbnN0IHJlbmRFbmRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRsZXQgciA9IGZhbHNlO1xuXHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSByZW5kU3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IHJlbmRFbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdHIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0VmlzaWJsZUxpbmUobGluZU51bWJlcikub25TZWxlY3Rpb25DaGFuZ2VkKCkgfHwgcjtcblx0XHR9XG5cdFx0cmV0dXJuIHI7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uRGVjb3JhdGlvbnNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKHRydWUvKmUuaW5saW5lRGVjb3JhdGlvbnNDaGFuZ2VkKi8pIHtcblx0XHRcdGNvbnN0IHJlbmRTdGFydExpbmVOdW1iZXIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0XHRjb25zdCByZW5kRW5kTGluZU51bWJlciA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRFbmRMaW5lTnVtYmVyKCk7XG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gcmVuZFN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSByZW5kRW5kTGluZU51bWJlcjsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdHRoaXMuX3Zpc2libGVMaW5lcy5nZXRWaXNpYmxlTGluZShsaW5lTnVtYmVyKS5vbkRlY29yYXRpb25zQ2hhbmdlZCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25GbHVzaGVkKGU6IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHNob3VsZFJlbmRlciA9IHRoaXMuX3Zpc2libGVMaW5lcy5vbkZsdXNoZWQoZSwgdGhpcy5fdmlld0xpbmVPcHRpb25zLnVzZUdwdSk7XG5cdFx0dGhpcy5fbWF4TGluZVdpZHRoID0gMDtcblx0XHRyZXR1cm4gc2hvdWxkUmVuZGVyO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkxpbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlTGluZXMub25MaW5lc0NoYW5nZWQoZSk7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNEZWxldGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzRGVsZXRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGVMaW5lcy5vbkxpbmVzRGVsZXRlZChlKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlTGluZXMub25MaW5lc0luc2VydGVkKGUpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblJldmVhbFJhbmdlUmVxdWVzdChlOiB2aWV3RXZlbnRzLlZpZXdSZXZlYWxSYW5nZVJlcXVlc3RFdmVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIFVzaW5nIHRoZSBmdXR1cmUgdmlld3BvcnQgaGVyZSBpbiBvcmRlciB0byBoYW5kbGUgbXVsdGlwbGVcblx0XHQvLyBpbmNvbWluZyByZXZlYWwgcmFuZ2UgcmVxdWVzdHMgdGhhdCBtaWdodCBhbGwgZGVzaXJlIHRvIGJlIGFuaW1hdGVkXG5cdFx0Y29uc3QgZGVzaXJlZFNjcm9sbFRvcCA9IHRoaXMuX2NvbXB1dGVTY3JvbGxUb3BUb1JldmVhbFJhbmdlKHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRGdXR1cmVWaWV3cG9ydCgpLCBlLnNvdXJjZSwgZS5taW5pbWFsUmV2ZWFsLCBlLnJhbmdlLCBlLnNlbGVjdGlvbnMsIGUudmVydGljYWxUeXBlKTtcblxuXHRcdGlmIChkZXNpcmVkU2Nyb2xsVG9wID09PSAtMSkge1xuXHRcdFx0Ly8gbWFya2VyIHRvIGFib3J0IHRoZSByZXZlYWwgcmFuZ2UgcmVxdWVzdFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIHZhbGlkYXRlIHRoZSBuZXcgZGVzaXJlZCBzY3JvbGwgdG9wXG5cdFx0bGV0IG5ld1Njcm9sbFBvc2l0aW9uID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LnZhbGlkYXRlU2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IGRlc2lyZWRTY3JvbGxUb3AgfSk7XG5cblx0XHRpZiAoZS5yZXZlYWxIb3Jpem9udGFsKSB7XG5cdFx0XHRpZiAoZS5yYW5nZSAmJiBlLnJhbmdlLnN0YXJ0TGluZU51bWJlciAhPT0gZS5yYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdC8vIFR3byBvciBtb3JlIGxpbmVzPyA9PiBzY3JvbGwgdG8gYmFzZSAoVGhhdCdzIGhvdyB5b3Ugc2VlIG1vc3Qgb2YgdGhlIHR3byBsaW5lcylcblx0XHRcdFx0bmV3U2Nyb2xsUG9zaXRpb24gPSB7XG5cdFx0XHRcdFx0c2Nyb2xsVG9wOiBuZXdTY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3AsXG5cdFx0XHRcdFx0c2Nyb2xsTGVmdDogMFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIGlmIChlLnJhbmdlKSB7XG5cdFx0XHRcdC8vIFdlIGRvbid0IG5lY2Vzc2FyaWx5IGtub3cgdGhlIGhvcml6b250YWwgb2Zmc2V0IG9mIHRoaXMgcmFuZ2Ugc2luY2UgdGhlIGxpbmUgbWlnaHQgbm90IGJlIGluIHRoZSB2aWV3Li4uXG5cdFx0XHRcdHRoaXMuX2hvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gbmV3IEhvcml6b250YWxSZXZlYWxSYW5nZVJlcXVlc3QoZS5taW5pbWFsUmV2ZWFsLCBlLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgZS5yYW5nZS5zdGFydENvbHVtbiwgZS5yYW5nZS5lbmRDb2x1bW4sIHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsVG9wKCksIG5ld1Njcm9sbFBvc2l0aW9uLnNjcm9sbFRvcCwgZS5zY3JvbGxUeXBlKTtcblx0XHRcdH0gZWxzZSBpZiAoZS5zZWxlY3Rpb25zICYmIGUuc2VsZWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX2hvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gbmV3IEhvcml6b250YWxSZXZlYWxTZWxlY3Rpb25zUmVxdWVzdChlLm1pbmltYWxSZXZlYWwsIGUuc2VsZWN0aW9ucywgdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKSwgbmV3U2Nyb2xsUG9zaXRpb24uc2Nyb2xsVG9wLCBlLnNjcm9sbFR5cGUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9ob3Jpem9udGFsUmV2ZWFsUmVxdWVzdCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Nyb2xsVG9wRGVsdGEgPSBNYXRoLmFicyh0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbFRvcCgpIC0gbmV3U2Nyb2xsUG9zaXRpb24uc2Nyb2xsVG9wKTtcblx0XHRjb25zdCBzY3JvbGxUeXBlID0gKHNjcm9sbFRvcERlbHRhIDw9IHRoaXMuX2xpbmVIZWlnaHQgPyBTY3JvbGxUeXBlLkltbWVkaWF0ZSA6IGUuc2Nyb2xsVHlwZSk7XG5cdFx0dGhpcy5fY29udGV4dC52aWV3TW9kZWwudmlld0xheW91dC5zZXRTY3JvbGxQb3NpdGlvbihuZXdTY3JvbGxQb3NpdGlvbiwgc2Nyb2xsVHlwZSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25TY3JvbGxDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1Njcm9sbENoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9ob3Jpem9udGFsUmV2ZWFsUmVxdWVzdCAmJiBlLnNjcm9sbExlZnRDaGFuZ2VkKSB7XG5cdFx0XHQvLyBjYW5jZWwgYW55IG91dHN0YW5kaW5nIGhvcml6b250YWwgcmV2ZWFsIHJlcXVlc3QgaWYgc29tZW9uZSBlbHNlIHNjcm9sbHMgaG9yaXpvbnRhbGx5LlxuXHRcdFx0dGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3QgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAodGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3QgJiYgZS5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRjb25zdCBtaW4gPSBNYXRoLm1pbih0aGlzLl9ob3Jpem9udGFsUmV2ZWFsUmVxdWVzdC5zdGFydFNjcm9sbFRvcCwgdGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3Quc3RvcFNjcm9sbFRvcCk7XG5cdFx0XHRjb25zdCBtYXggPSBNYXRoLm1heCh0aGlzLl9ob3Jpem9udGFsUmV2ZWFsUmVxdWVzdC5zdGFydFNjcm9sbFRvcCwgdGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3Quc3RvcFNjcm9sbFRvcCk7XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3AgPCBtaW4gfHwgZS5zY3JvbGxUb3AgPiBtYXgpIHtcblx0XHRcdFx0Ly8gY2FuY2VsIGFueSBvdXRzdGFuZGluZyBob3Jpem9udGFsIHJldmVhbCByZXF1ZXN0IGlmIHNvbWVvbmUgZWxzZSBzY3JvbGxzIHZlcnRpY2FsbHkuXG5cdFx0XHRcdHRoaXMuX2hvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5kb21Ob2RlLnNldFdpZHRoKGUuc2Nyb2xsV2lkdGgpO1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlTGluZXMub25TY3JvbGxDaGFuZ2VkKGUpIHx8IHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25Ub2tlbnNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1Rva2Vuc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlTGluZXMub25Ub2tlbnNDaGFuZ2VkKGUpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblpvbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdab25lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnZpZXdMYXlvdXQuc2V0TWF4TGluZVdpZHRoKHRoaXMuX21heExpbmVXaWR0aCk7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGVMaW5lcy5vblpvbmVzQ2hhbmdlZChlKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25UaGVtZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VGhlbWVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fb25PcHRpb25zTWF5YmVDaGFuZ2VkKCk7XG5cdH1cblxuXHQvLyAtLS0tIGVuZCB2aWV3IGV2ZW50IGhhbmRsZXJzXG5cblx0Ly8gLS0tLS0tLS0tLS0gSEVMUEVSUyBGT1IgT1RIRVJTXG5cblx0cHVibGljIGdldFBvc2l0aW9uRnJvbURPTUluZm8oc3Bhbk5vZGU6IEhUTUxFbGVtZW50LCBvZmZzZXQ6IG51bWJlcik6IFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3Qgdmlld0xpbmVEb21Ob2RlID0gdGhpcy5fZ2V0Vmlld0xpbmVEb21Ob2RlKHNwYW5Ob2RlKTtcblx0XHRpZiAodmlld0xpbmVEb21Ob2RlID09PSBudWxsKSB7XG5cdFx0XHQvLyBDb3VsZG4ndCBmaW5kIHZpZXcgbGluZSBub2RlXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgbGluZU51bWJlciA9IHRoaXMuX2dldExpbmVOdW1iZXJGb3Iodmlld0xpbmVEb21Ob2RlKTtcblxuXHRcdGlmIChsaW5lTnVtYmVyID09PSAtMSkge1xuXHRcdFx0Ly8gQ291bGRuJ3QgZmluZCB2aWV3IGxpbmUgbm9kZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPCAxIHx8IGxpbmVOdW1iZXIgPiB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0Ly8gbGluZU51bWJlciBpcyBvdXRzaWRlIHJhbmdlXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSA9PT0gMSkge1xuXHRcdFx0Ly8gTGluZSBpcyBlbXB0eVxuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCAxKTtcblx0XHR9XG5cblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdGNvbnN0IHJlbmRFbmRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRpZiAobGluZU51bWJlciA8IHJlbmRTdGFydExpbmVOdW1iZXIgfHwgbGluZU51bWJlciA+IHJlbmRFbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBDb3VsZG4ndCBmaW5kIGxpbmVcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBjb2x1bW4gPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0VmlzaWJsZUxpbmUobGluZU51bWJlcikuZ2V0Q29sdW1uT2ZOb2RlT2Zmc2V0KHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHRcdGNvbnN0IG1pbkNvbHVtbiA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNaW5Db2x1bW4obGluZU51bWJlcik7XG5cdFx0aWYgKGNvbHVtbiA8IG1pbkNvbHVtbikge1xuXHRcdFx0Y29sdW1uID0gbWluQ29sdW1uO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRWaWV3TGluZURvbU5vZGUobm9kZTogSFRNTEVsZW1lbnQgfCBudWxsKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHR3aGlsZSAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSAxKSB7XG5cdFx0XHRpZiAobm9kZS5jbGFzc05hbWUgPT09IFZpZXdMaW5lLkNMQVNTX05BTUUpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0XHR9XG5cdFx0XHRub2RlID0gbm9kZS5wYXJlbnRFbGVtZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyB0aGUgbGluZSBudW1iZXIgb2YgdGhpcyB2aWV3IGxpbmUgZG9tIG5vZGUuXG5cdCAqL1xuXHRwcml2YXRlIF9nZXRMaW5lTnVtYmVyRm9yKGRvbU5vZGU6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRFbmRMaW5lTnVtYmVyKCk7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0VmlzaWJsZUxpbmUobGluZU51bWJlcik7XG5cdFx0XHRpZiAoZG9tTm9kZSA9PT0gbGluZS5nZXREb21Ob2RlKCkpIHtcblx0XHRcdFx0cmV0dXJuIGxpbmVOdW1iZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lV2lkdGgobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdGNvbnN0IHJlbmRFbmRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRpZiAobGluZU51bWJlciA8IHJlbmRTdGFydExpbmVOdW1iZXIgfHwgbGluZU51bWJlciA+IHJlbmRFbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBDb3VsZG4ndCBmaW5kIGxpbmVcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gbmV3IERvbVJlYWRpbmdDb250ZXh0KHRoaXMuZG9tTm9kZS5kb21Ob2RlLCB0aGlzLl90ZXh0UmFuZ2VSZXN0aW5nU3BvdCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFZpc2libGVMaW5lKGxpbmVOdW1iZXIpLmdldFdpZHRoKGNvbnRleHQpO1xuXHRcdHRoaXMuX3VwZGF0ZUxpbmVXaWR0aHNTbG93SWZEb21EaWRMYXlvdXQoY29udGV4dCk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGxpbmVzVmlzaWJsZVJhbmdlc0ZvclJhbmdlKF9yYW5nZTogUmFuZ2UsIGluY2x1ZGVOZXdMaW5lczogYm9vbGVhbik6IExpbmVWaXNpYmxlUmFuZ2VzW10gfCBudWxsIHtcblx0XHRpZiAodGhpcy5zaG91bGRSZW5kZXIoKSkge1xuXHRcdFx0Ly8gQ2Fubm90IHJlYWQgZnJvbSB0aGUgRE9NIGJlY2F1c2UgaXQgaXMgZGlydHlcblx0XHRcdC8vIGkuZS4gdGhlIG1vZGVsICYgdGhlIGRvbSBhcmUgb3V0IG9mIHN5bmMsIHNvIEknZCBiZSByZWFkaW5nIHNvbWV0aGluZyBzdGFsZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3JpZ2luYWxFbmRMaW5lTnVtYmVyID0gX3JhbmdlLmVuZExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgcmFuZ2UgPSBSYW5nZS5pbnRlcnNlY3RSYW5nZXMoX3JhbmdlLCB0aGlzLl9sYXN0UmVuZGVyZWREYXRhLmdldEN1cnJlbnRWaXNpYmxlUmFuZ2UoKSk7XG5cdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlczogTGluZVZpc2libGVSYW5nZXNbXSA9IFtdO1xuXHRcdGxldCB2aXNpYmxlUmFuZ2VzTGVuID0gMDtcblx0XHRjb25zdCBkb21SZWFkaW5nQ29udGV4dCA9IG5ldyBEb21SZWFkaW5nQ29udGV4dCh0aGlzLmRvbU5vZGUuZG9tTm9kZSwgdGhpcy5fdGV4dFJhbmdlUmVzdGluZ1Nwb3QpO1xuXG5cdFx0bGV0IG5leHRMaW5lTW9kZWxMaW5lTnVtYmVyOiBudW1iZXIgPSAwO1xuXHRcdGlmIChpbmNsdWRlTmV3TGluZXMpIHtcblx0XHRcdG5leHRMaW5lTW9kZWxMaW5lTnVtYmVyID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihuZXcgUG9zaXRpb24ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKSkubGluZU51bWJlcjtcblx0XHR9XG5cblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdGNvbnN0IHJlbmRFbmRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IHJhbmdlLmVuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXG5cdFx0XHRpZiAobGluZU51bWJlciA8IHJlbmRTdGFydExpbmVOdW1iZXIgfHwgbGluZU51bWJlciA+IHJlbmRFbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IGxpbmVOdW1iZXIgPT09IHJhbmdlLnN0YXJ0TGluZU51bWJlciA/IHJhbmdlLnN0YXJ0Q29sdW1uIDogMTtcblx0XHRcdGNvbnN0IGNvbnRpbnVlc0luTmV4dExpbmUgPSBsaW5lTnVtYmVyICE9PSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgZW5kQ29sdW1uID0gY29udGludWVzSW5OZXh0TGluZSA/IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikgOiByYW5nZS5lbmRDb2x1bW47XG5cdFx0XHRjb25zdCB2aXNpYmxlUmFuZ2VzRm9yTGluZSA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRWaXNpYmxlTGluZShsaW5lTnVtYmVyKS5nZXRWaXNpYmxlUmFuZ2VzRm9yUmFuZ2UobGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZENvbHVtbiwgZG9tUmVhZGluZ0NvbnRleHQpO1xuXG5cdFx0XHRpZiAoIXZpc2libGVSYW5nZXNGb3JMaW5lKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5jbHVkZU5ld0xpbmVzICYmIGxpbmVOdW1iZXIgPCBvcmlnaW5hbEVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudExpbmVNb2RlbExpbmVOdW1iZXIgPSBuZXh0TGluZU1vZGVsTGluZU51bWJlcjtcblx0XHRcdFx0bmV4dExpbmVNb2RlbExpbmVOdW1iZXIgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyICsgMSwgMSkpLmxpbmVOdW1iZXI7XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRMaW5lTW9kZWxMaW5lTnVtYmVyICE9PSBuZXh0TGluZU1vZGVsTGluZU51bWJlcikge1xuXHRcdFx0XHRcdHZpc2libGVSYW5nZXNGb3JMaW5lLnJhbmdlc1t2aXNpYmxlUmFuZ2VzRm9yTGluZS5yYW5nZXMubGVuZ3RoIC0gMV0ud2lkdGggKz0gdGhpcy5fdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHZpc2libGVSYW5nZXNbdmlzaWJsZVJhbmdlc0xlbisrXSA9IG5ldyBMaW5lVmlzaWJsZVJhbmdlcyh2aXNpYmxlUmFuZ2VzRm9yTGluZS5vdXRzaWRlUmVuZGVyZWRMaW5lLCBsaW5lTnVtYmVyLCBIb3Jpem9udGFsUmFuZ2UuZnJvbSh2aXNpYmxlUmFuZ2VzRm9yTGluZS5yYW5nZXMpLCBjb250aW51ZXNJbk5leHRMaW5lKTtcblx0XHR9XG5cblx0XHR0aGlzLl91cGRhdGVMaW5lV2lkdGhzU2xvd0lmRG9tRGlkTGF5b3V0KGRvbVJlYWRpbmdDb250ZXh0KTtcblxuXHRcdGlmICh2aXNpYmxlUmFuZ2VzTGVuID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdmlzaWJsZVJhbmdlcztcblx0fVxuXG5cdHByaXZhdGUgX3Zpc2libGVSYW5nZXNGb3JMaW5lUmFuZ2UobGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlcik6IFZpc2libGVSYW5nZXMgfCBudWxsIHtcblx0XHRpZiAodGhpcy5zaG91bGRSZW5kZXIoKSkge1xuXHRcdFx0Ly8gQ2Fubm90IHJlYWQgZnJvbSB0aGUgRE9NIGJlY2F1c2UgaXQgaXMgZGlydHlcblx0XHRcdC8vIGkuZS4gdGhlIG1vZGVsICYgdGhlIGRvbSBhcmUgb3V0IG9mIHN5bmMsIHNvIEknZCBiZSByZWFkaW5nIHNvbWV0aGluZyBzdGFsZVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVOdW1iZXIgPCB0aGlzLl92aXNpYmxlTGluZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCkgfHwgbGluZU51bWJlciA+IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRFbmRMaW5lTnVtYmVyKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRvbVJlYWRpbmdDb250ZXh0ID0gbmV3IERvbVJlYWRpbmdDb250ZXh0KHRoaXMuZG9tTm9kZS5kb21Ob2RlLCB0aGlzLl90ZXh0UmFuZ2VSZXN0aW5nU3BvdCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFZpc2libGVMaW5lKGxpbmVOdW1iZXIpLmdldFZpc2libGVSYW5nZXNGb3JSYW5nZShsaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kQ29sdW1uLCBkb21SZWFkaW5nQ29udGV4dCk7XG5cdFx0dGhpcy5fdXBkYXRlTGluZVdpZHRoc1Nsb3dJZkRvbURpZExheW91dChkb21SZWFkaW5nQ29udGV4dCk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHZpc2libGVSYW5nZUZvclBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbik6IEhvcml6b250YWxQb3NpdGlvbiB8IG51bGwge1xuXHRcdGNvbnN0IHZpc2libGVSYW5nZXMgPSB0aGlzLl92aXNpYmxlUmFuZ2VzRm9yTGluZVJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24uY29sdW1uKTtcblx0XHRpZiAoIXZpc2libGVSYW5nZXMpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IEhvcml6b250YWxQb3NpdGlvbih2aXNpYmxlUmFuZ2VzLm91dHNpZGVSZW5kZXJlZExpbmUsIHZpc2libGVSYW5nZXMucmFuZ2VzWzBdLmxlZnQpO1xuXHR9XG5cblx0Ly8gLS0tIGltcGxlbWVudGF0aW9uXG5cblx0cHVibGljIHVwZGF0ZUxpbmVXaWR0aHMoKTogdm9pZCB7XG5cdFx0dGhpcy5fdXBkYXRlTGluZVdpZHRocyhmYWxzZSk7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgbWF4IGxpbmUgd2lkdGggaWYgaXQgaXMgZmFzdCB0byBjb21wdXRlLlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgYWxsIGxpbmVzIHdlcmUgdGFrZW4gaW50byBhY2NvdW50LlxuXHQgKiBSZXR1cm5zIGZhbHNlIGlmIHNvbWUgbGluZXMgbmVlZCB0byBiZSByZWV2YWx1YXRlZCAoaW4gYSBzbG93IGZhc2hpb24pLlxuXHQgKi9cblx0cHJpdmF0ZSBfdXBkYXRlTGluZVdpZHRoc0Zhc3QoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VwZGF0ZUxpbmVXaWR0aHModHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVMaW5lV2lkdGhzU2xvdygpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVMaW5lV2lkdGhzKGZhbHNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgdGhlIGxpbmUgd2lkdGhzIHVzaW5nIERPTSBsYXlvdXQgaW5mb3JtYXRpb24gYWZ0ZXIgc29tZW9uZSBlbHNlXG5cdCAqIGhhcyBjYXVzZWQgYSBzeW5jaHJvbm91cyBsYXlvdXQuXG5cdCAqL1xuXHRwcml2YXRlIF91cGRhdGVMaW5lV2lkdGhzU2xvd0lmRG9tRGlkTGF5b3V0KGRvbVJlYWRpbmdDb250ZXh0OiBEb21SZWFkaW5nQ29udGV4dCk6IHZvaWQge1xuXHRcdGlmICghZG9tUmVhZGluZ0NvbnRleHQuZGlkRG9tTGF5b3V0KSB7XG5cdFx0XHQvLyBvbmx5IHByb2NlZWQgaWYgd2UganVzdCBkaWQgYSBsYXlvdXRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2FzeW5jVXBkYXRlTGluZVdpZHRocy5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHQvLyByZWFkaW5nIHdpZHRocyBpcyBub3Qgc2NoZWR1bGVkID0+IHdpZHRocyBhcmUgdXAtdG8tZGF0ZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9hc3luY1VwZGF0ZUxpbmVXaWR0aHMuY2FuY2VsKCk7XG5cdFx0dGhpcy5fdXBkYXRlTGluZVdpZHRoc1Nsb3coKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUxpbmVXaWR0aHMoZmFzdDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHJlbmRTdGFydExpbmVOdW1iZXIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7XG5cdFx0Y29uc3QgcmVuZEVuZExpbmVOdW1iZXIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0RW5kTGluZU51bWJlcigpO1xuXG5cdFx0bGV0IGxvY2FsTWF4TGluZVdpZHRoID0gMTtcblx0XHRsZXQgYWxsV2lkdGhzQ29tcHV0ZWQgPSB0cnVlO1xuXHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSByZW5kU3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IHJlbmRFbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IHZpc2libGVMaW5lID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFZpc2libGVMaW5lKGxpbmVOdW1iZXIpO1xuXG5cdFx0XHRpZiAoZmFzdCAmJiAhdmlzaWJsZUxpbmUuZ2V0V2lkdGhJc0Zhc3QoKSkge1xuXHRcdFx0XHQvLyBDYW5ub3QgY29tcHV0ZSB3aWR0aCBpbiBhIGZhc3Qgd2F5IGZvciB0aGlzIGxpbmVcblx0XHRcdFx0YWxsV2lkdGhzQ29tcHV0ZWQgPSBmYWxzZTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxvY2FsTWF4TGluZVdpZHRoID0gTWF0aC5tYXgobG9jYWxNYXhMaW5lV2lkdGgsIHZpc2libGVMaW5lLmdldFdpZHRoKG51bGwpKTtcblx0XHR9XG5cblx0XHRpZiAoYWxsV2lkdGhzQ29tcHV0ZWQgJiYgcmVuZFN0YXJ0TGluZU51bWJlciA9PT0gMSAmJiByZW5kRW5kTGluZU51bWJlciA9PT0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdC8vIHdlIGtub3cgdGhlIG1heCBsaW5lIHdpZHRoIGZvciBhbGwgdGhlIGxpbmVzXG5cdFx0XHR0aGlzLl9tYXhMaW5lV2lkdGggPSAwO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Vuc3VyZU1heExpbmVXaWR0aChsb2NhbE1heExpbmVXaWR0aCk7XG5cblx0XHRyZXR1cm4gYWxsV2lkdGhzQ29tcHV0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9jaGVja01vbm9zcGFjZUZvbnRBc3N1bXB0aW9ucygpOiB2b2lkIHtcblx0XHQvLyBQcm9ibGVtcyB3aXRoIG1vbm9zcGFjZSBhc3N1bXB0aW9ucyBhcmUgbW9yZSBhcHBhcmVudCBmb3IgbG9uZ2VyIGxpbmVzLFxuXHRcdC8vIGFzIHNtYWxsIHJvdW5kaW5nIGVycm9ycyBzdGFydCB0byBzdW0gdXAsIHNvIHdlIHdpbGwgc2VsZWN0IHRoZSBsb25nZXN0XG5cdFx0Ly8gbGluZSBmb3IgYSBjbG9zZXIgaW5zcGVjdGlvblxuXHRcdGxldCBsb25nZXN0TGluZU51bWJlciA9IC0xO1xuXHRcdGxldCBsb25nZXN0V2lkdGggPSAtMTtcblx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdGNvbnN0IHJlbmRFbmRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldEVuZExpbmVOdW1iZXIoKTtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gcmVuZFN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSByZW5kRW5kTGluZU51bWJlcjsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCB2aXNpYmxlTGluZSA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRWaXNpYmxlTGluZShsaW5lTnVtYmVyKTtcblx0XHRcdGlmICh2aXNpYmxlTGluZS5uZWVkc01vbm9zcGFjZUZvbnRDaGVjaygpKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVXaWR0aCA9IHZpc2libGVMaW5lLmdldFdpZHRoKG51bGwpO1xuXHRcdFx0XHRpZiAobGluZVdpZHRoID4gbG9uZ2VzdFdpZHRoKSB7XG5cdFx0XHRcdFx0bG9uZ2VzdFdpZHRoID0gbGluZVdpZHRoO1xuXHRcdFx0XHRcdGxvbmdlc3RMaW5lTnVtYmVyID0gbGluZU51bWJlcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChsb25nZXN0TGluZU51bWJlciA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX3Zpc2libGVMaW5lcy5nZXRWaXNpYmxlTGluZShsb25nZXN0TGluZU51bWJlcikubW9ub3NwYWNlQXNzdW1wdGlvbnNBcmVWYWxpZCgpKSB7XG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gcmVuZFN0YXJ0TGluZU51bWJlcjsgbGluZU51bWJlciA8PSByZW5kRW5kTGluZU51bWJlcjsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdGNvbnN0IHZpc2libGVMaW5lID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFZpc2libGVMaW5lKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHR2aXNpYmxlTGluZS5vbk1vbm9zcGFjZUFzc3VtcHRpb25zSW52YWxpZGF0ZWQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcHJlcGFyZVJlbmRlcigpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBzdXBwb3J0ZWQnKTtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdOb3Qgc3VwcG9ydGVkJyk7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyVGV4dCh2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSk6IHZvaWQge1xuXHRcdC8vICgxKSByZW5kZXIgbGluZXMgLSBlbnN1cmVzIGxpbmVzIGFyZSBpbiB0aGUgRE9NXG5cdFx0dGhpcy5fdmlzaWJsZUxpbmVzLnJlbmRlckxpbmVzKHZpZXdwb3J0RGF0YSk7XG5cdFx0dGhpcy5fbGFzdFJlbmRlcmVkRGF0YS5zZXRDdXJyZW50VmlzaWJsZVJhbmdlKHZpZXdwb3J0RGF0YS52aXNpYmxlUmFuZ2UpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRXaWR0aCh0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0U2Nyb2xsV2lkdGgoKSk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldEhlaWdodChNYXRoLm1pbih0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0U2Nyb2xsSGVpZ2h0KCksIDEwMDAwMDApKTtcblxuXHRcdC8vICgyKSBjb21wdXRlIGhvcml6b250YWwgc2Nyb2xsIHBvc2l0aW9uOlxuXHRcdC8vICAtIHRoaXMgbXVzdCBoYXBwZW4gYWZ0ZXIgdGhlIGxpbmVzIGFyZSBpbiB0aGUgRE9NIHNpbmNlIGl0IG1pZ2h0IG5lZWQgYSBsaW5lIHRoYXQgcmVuZGVyZWQganVzdCBub3dcblx0XHQvLyAgLSBpdCBtaWdodCBjaGFuZ2UgYHNjcm9sbFdpZHRoYCBhbmQgYHNjcm9sbExlZnRgXG5cdFx0aWYgKHRoaXMuX2hvcml6b250YWxSZXZlYWxSZXF1ZXN0KSB7XG5cblx0XHRcdGNvbnN0IGhvcml6b250YWxSZXZlYWxSZXF1ZXN0ID0gdGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3Q7XG5cblx0XHRcdC8vIENoZWNrIHRoYXQgd2UgaGF2ZSB0aGUgbGluZSB0aGF0IGNvbnRhaW5zIHRoZSBob3Jpem9udGFsIHJhbmdlIGluIHRoZSB2aWV3cG9ydFxuXHRcdFx0aWYgKHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIgPD0gaG9yaXpvbnRhbFJldmVhbFJlcXVlc3QubWluTGluZU51bWJlciAmJiBob3Jpem9udGFsUmV2ZWFsUmVxdWVzdC5tYXhMaW5lTnVtYmVyIDw9IHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyKSB7XG5cblx0XHRcdFx0dGhpcy5faG9yaXpvbnRhbFJldmVhbFJlcXVlc3QgPSBudWxsO1xuXG5cdFx0XHRcdC8vIGFsbG93IGB2aXNpYmxlUmFuZ2VzRm9yUmFuZ2UyYCB0byB3b3JrXG5cdFx0XHRcdHRoaXMub25EaWRSZW5kZXIoKTtcblxuXHRcdFx0XHQvLyBjb21wdXRlIG5ldyBzY3JvbGwgcG9zaXRpb25cblx0XHRcdFx0Y29uc3QgbmV3U2Nyb2xsTGVmdCA9IHRoaXMuX2NvbXB1dGVTY3JvbGxMZWZ0VG9SZXZlYWwoaG9yaXpvbnRhbFJldmVhbFJlcXVlc3QpO1xuXG5cdFx0XHRcdGlmIChuZXdTY3JvbGxMZWZ0KSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl9pc1ZpZXdwb3J0V3JhcHBpbmcpIHtcblx0XHRcdFx0XHRcdC8vIGVuc3VyZSBgc2Nyb2xsV2lkdGhgIGlzIGxhcmdlIGVub3VnaFxuXHRcdFx0XHRcdFx0dGhpcy5fZW5zdXJlTWF4TGluZVdpZHRoKG5ld1Njcm9sbExlZnQubWF4SG9yaXpvbnRhbE9mZnNldCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIHNldCBgc2Nyb2xsTGVmdGBcblx0XHRcdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC52aWV3TGF5b3V0LnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0XHRcdHNjcm9sbExlZnQ6IG5ld1Njcm9sbExlZnQuc2Nyb2xsTGVmdFxuXHRcdFx0XHRcdH0sIGhvcml6b250YWxSZXZlYWxSZXF1ZXN0LnNjcm9sbFR5cGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIG1heCBsaW5lIHdpZHRoIChub3Qgc28gaW1wb3J0YW50LCBpdCBpcyBqdXN0IHNvIHRoZSBob3Jpem9udGFsIHNjcm9sbGJhciBkb2Vzbid0IGdldCB0b28gc21hbGwpXG5cdFx0aWYgKCF0aGlzLl91cGRhdGVMaW5lV2lkdGhzRmFzdCgpKSB7XG5cdFx0XHQvLyBDb21wdXRpbmcgdGhlIHdpZHRoIG9mIHNvbWUgbGluZXMgd291bGQgYmUgc2xvdyA9PiBkZWxheSBpdFxuXHRcdFx0dGhpcy5fYXN5bmNVcGRhdGVMaW5lV2lkdGhzLnNjaGVkdWxlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2FzeW5jVXBkYXRlTGluZVdpZHRocy5jYW5jZWwoKTtcblx0XHR9XG5cblx0XHRpZiAocGxhdGZvcm0uaXNMaW51eCAmJiAhdGhpcy5fYXN5bmNDaGVja01vbm9zcGFjZUZvbnRBc3N1bXB0aW9ucy5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRjb25zdCByZW5kU3RhcnRMaW5lTnVtYmVyID0gdGhpcy5fdmlzaWJsZUxpbmVzLmdldFN0YXJ0TGluZU51bWJlcigpO1xuXHRcdFx0Y29uc3QgcmVuZEVuZExpbmVOdW1iZXIgPSB0aGlzLl92aXNpYmxlTGluZXMuZ2V0RW5kTGluZU51bWJlcigpO1xuXHRcdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IHJlbmRTdGFydExpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gcmVuZEVuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlTGluZSA9IHRoaXMuX3Zpc2libGVMaW5lcy5nZXRWaXNpYmxlTGluZShsaW5lTnVtYmVyKTtcblx0XHRcdFx0aWYgKHZpc2libGVMaW5lLm5lZWRzTW9ub3NwYWNlRm9udENoZWNrKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9hc3luY0NoZWNrTW9ub3NwYWNlRm9udEFzc3VtcHRpb25zLnNjaGVkdWxlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAoMykgaGFuZGxlIHNjcm9sbGluZ1xuXHRcdHRoaXMuX2xpbmVzQ29udGVudC5zZXRMYXllckhpbnRpbmcodGhpcy5fY2FuVXNlTGF5ZXJIaW50aW5nKTtcblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuc2V0Q29udGFpbignc3RyaWN0Jyk7XG5cdFx0Y29uc3QgYWRqdXN0ZWRTY3JvbGxUb3AgPSB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbFRvcCgpIC0gdmlld3BvcnREYXRhLmJpZ051bWJlcnNEZWx0YTtcblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuc2V0VG9wKC1hZGp1c3RlZFNjcm9sbFRvcCk7XG5cdFx0dGhpcy5fbGluZXNDb250ZW50LnNldExlZnQoLXRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsTGVmdCgpKTtcblx0fVxuXG5cdC8vIC0tLSB3aWR0aFxuXG5cdHByaXZhdGUgX2Vuc3VyZU1heExpbmVXaWR0aChsaW5lV2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGlMaW5lV2lkdGggPSBNYXRoLmNlaWwobGluZVdpZHRoKTtcblx0XHRpZiAodGhpcy5fbWF4TGluZVdpZHRoIDwgaUxpbmVXaWR0aCkge1xuXHRcdFx0dGhpcy5fbWF4TGluZVdpZHRoID0gaUxpbmVXaWR0aDtcblx0XHRcdHRoaXMuX2NvbnRleHQudmlld01vZGVsLnZpZXdMYXlvdXQuc2V0TWF4TGluZVdpZHRoKHRoaXMuX21heExpbmVXaWR0aCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZVNjcm9sbFRvcFRvUmV2ZWFsUmFuZ2Uodmlld3BvcnQ6IFZpZXdwb3J0LCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIG1pbmltYWxSZXZlYWw6IGJvb2xlYW4sIHJhbmdlOiBSYW5nZSB8IG51bGwsIHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdIHwgbnVsbCwgdmVydGljYWxUeXBlOiB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZSk6IG51bWJlciB7XG5cdFx0Y29uc3Qgdmlld3BvcnRTdGFydFkgPSB2aWV3cG9ydC50b3A7XG5cdFx0Y29uc3Qgdmlld3BvcnRIZWlnaHQgPSB2aWV3cG9ydC5oZWlnaHQ7XG5cdFx0Y29uc3Qgdmlld3BvcnRFbmRZID0gdmlld3BvcnRTdGFydFkgKyB2aWV3cG9ydEhlaWdodDtcblx0XHRsZXQgYm94SXNTaW5nbGVSYW5nZTogYm9vbGVhbjtcblx0XHRsZXQgYm94U3RhcnRZOiBudW1iZXI7XG5cdFx0bGV0IGJveEVuZFk6IG51bWJlcjtcblxuXHRcdGlmIChzZWxlY3Rpb25zICYmIHNlbGVjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0bGV0IG1pbkxpbmVOdW1iZXIgPSBzZWxlY3Rpb25zWzBdLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGxldCBtYXhMaW5lTnVtYmVyID0gc2VsZWN0aW9uc1swXS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDEsIGxlbiA9IHNlbGVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gc2VsZWN0aW9uc1tpXTtcblx0XHRcdFx0bWluTGluZU51bWJlciA9IE1hdGgubWluKG1pbkxpbmVOdW1iZXIsIHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRtYXhMaW5lTnVtYmVyID0gTWF0aC5tYXgobWF4TGluZU51bWJlciwgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdFx0Ym94SXNTaW5nbGVSYW5nZSA9IGZhbHNlO1xuXHRcdFx0Ym94U3RhcnRZID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihtaW5MaW5lTnVtYmVyKTtcblx0XHRcdGJveEVuZFkgPSB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKG1heExpbmVOdW1iZXIpICsgdGhpcy5fbGluZUhlaWdodDtcblx0XHR9IGVsc2UgaWYgKHJhbmdlKSB7XG5cdFx0XHRib3hJc1NpbmdsZVJhbmdlID0gdHJ1ZTtcblx0XHRcdGJveFN0YXJ0WSA9IHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdGJveEVuZFkgPSB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKHJhbmdlLmVuZExpbmVOdW1iZXIpICsgdGhpcy5fbGluZUhlaWdodDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNob3VsZElnbm9yZVNjcm9sbE9mZiA9IChzb3VyY2UgPT09ICdtb3VzZScgfHwgbWluaW1hbFJldmVhbCkgJiYgdGhpcy5fY3Vyc29yU3Vycm91bmRpbmdMaW5lc1N0eWxlID09PSAnZGVmYXVsdCc7XG5cblx0XHRsZXQgcGFkZGluZ1RvcDogbnVtYmVyID0gMDtcblx0XHRsZXQgcGFkZGluZ0JvdHRvbTogbnVtYmVyID0gMDtcblxuXHRcdGlmICghc2hvdWxkSWdub3JlU2Nyb2xsT2ZmKSB7XG5cdFx0XHRjb25zdCBtYXhMaW5lc0luVmlld3BvcnQgPSAodmlld3BvcnRIZWlnaHQgLyB0aGlzLl9saW5lSGVpZ2h0KTtcblx0XHRcdGNvbnN0IHN1cnJvdW5kaW5nTGluZXMgPSBNYXRoLm1heCh0aGlzLl9jdXJzb3JTdXJyb3VuZGluZ0xpbmVzLCB0aGlzLl9zdGlja3lTY3JvbGxFbmFibGVkID8gdGhpcy5fbWF4TnVtYmVyU3RpY2t5TGluZXMgOiAwKTtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBNYXRoLm1pbihtYXhMaW5lc0luVmlld3BvcnQgLyAyLCBzdXJyb3VuZGluZ0xpbmVzKTtcblx0XHRcdHBhZGRpbmdUb3AgPSBjb250ZXh0ICogdGhpcy5fbGluZUhlaWdodDtcblx0XHRcdHBhZGRpbmdCb3R0b20gPSBNYXRoLm1heCgwLCAoY29udGV4dCAtIDEpKSAqIHRoaXMuX2xpbmVIZWlnaHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghbWluaW1hbFJldmVhbCkge1xuXHRcdFx0XHQvLyBSZXZlYWwgb25lIG1vcmUgbGluZSBhYm92ZSAodGhpcyBjYXNlIGlzIGhpdCB3aGVuIGRyYWdnaW5nKVxuXHRcdFx0XHRwYWRkaW5nVG9wID0gdGhpcy5fbGluZUhlaWdodDtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCFtaW5pbWFsUmV2ZWFsKSB7XG5cdFx0XHRpZiAodmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5TaW1wbGUgfHwgdmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5Cb3R0b20pIHtcblx0XHRcdFx0Ly8gUmV2ZWFsIG9uZSBsaW5lIG1vcmUgd2hlbiB0aGUgbGFzdCBsaW5lIHdvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHNjcm9sbGJhciAtIGFycm93IGRvd24gY2FzZSBvciByZXZlYWxpbmcgYSBsaW5lIGV4cGxpY2l0bHkgYXQgYm90dG9tXG5cdFx0XHRcdHBhZGRpbmdCb3R0b20gKz0gdGhpcy5fbGluZUhlaWdodDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRib3hTdGFydFkgLT0gcGFkZGluZ1RvcDtcblx0XHRib3hFbmRZICs9IHBhZGRpbmdCb3R0b207XG5cdFx0bGV0IG5ld1Njcm9sbFRvcDogbnVtYmVyO1xuXG5cdFx0aWYgKGJveEVuZFkgLSBib3hTdGFydFkgPiB2aWV3cG9ydEhlaWdodCkge1xuXHRcdFx0Ly8gdGhlIGJveCBpcyBsYXJnZXIgdGhhbiB0aGUgdmlld3BvcnQgLi4uIHNjcm9sbCB0byBpdHMgdG9wXG5cdFx0XHRpZiAoIWJveElzU2luZ2xlUmFuZ2UpIHtcblx0XHRcdFx0Ly8gZG8gbm90IHJldmVhbCBtdWx0aXBsZSBjdXJzb3JzIGlmIHRoZXJlIGFyZSBtb3JlIHRoYW4gZml0IHRoZSB2aWV3cG9ydFxuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHR9XG5cdFx0XHRuZXdTY3JvbGxUb3AgPSBib3hTdGFydFk7XG5cdFx0fSBlbHNlIGlmICh2ZXJ0aWNhbFR5cGUgPT09IHZpZXdFdmVudHMuVmVydGljYWxSZXZlYWxUeXBlLk5lYXJUb3AgfHwgdmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnQpIHtcblx0XHRcdGlmICh2ZXJ0aWNhbFR5cGUgPT09IHZpZXdFdmVudHMuVmVydGljYWxSZXZlYWxUeXBlLk5lYXJUb3BJZk91dHNpZGVWaWV3cG9ydCAmJiB2aWV3cG9ydFN0YXJ0WSA8PSBib3hTdGFydFkgJiYgYm94RW5kWSA8PSB2aWV3cG9ydEVuZFkpIHtcblx0XHRcdFx0Ly8gQm94IGlzIGFscmVhZHkgaW4gdGhlIHZpZXdwb3J0Li4uIGRvIG5vdGhpbmdcblx0XHRcdFx0bmV3U2Nyb2xsVG9wID0gdmlld3BvcnRTdGFydFk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBXZSB3YW50IGEgZ2FwIHRoYXQgaXMgMjAlIG9mIHRoZSB2aWV3cG9ydCwgYnV0IHdpdGggYSBtaW5pbXVtIG9mIDUgbGluZXNcblx0XHRcdFx0Y29uc3QgZGVzaXJlZEdhcEFib3ZlID0gTWF0aC5tYXgoNSAqIHRoaXMuX2xpbmVIZWlnaHQsIHZpZXdwb3J0SGVpZ2h0ICogMC4yKTtcblx0XHRcdFx0Ly8gVHJ5IHRvIHNjcm9sbCBqdXN0IGFib3ZlIHRoZSBib3ggd2l0aCB0aGUgZGVzaXJlZCBnYXBcblx0XHRcdFx0Y29uc3QgZGVzaXJlZFNjcm9sbFRvcCA9IGJveFN0YXJ0WSAtIGRlc2lyZWRHYXBBYm92ZTtcblx0XHRcdFx0Ly8gQnV0IGVuc3VyZSB0aGF0IHRoZSBib3ggaXMgbm90IHB1c2hlZCBvdXQgb2Ygdmlld3BvcnRcblx0XHRcdFx0Y29uc3QgbWluU2Nyb2xsVG9wID0gYm94RW5kWSAtIHZpZXdwb3J0SGVpZ2h0O1xuXHRcdFx0XHRuZXdTY3JvbGxUb3AgPSBNYXRoLm1heChtaW5TY3JvbGxUb3AsIGRlc2lyZWRTY3JvbGxUb3ApO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5DZW50ZXIgfHwgdmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCkge1xuXHRcdFx0aWYgKHZlcnRpY2FsVHlwZSA9PT0gdmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQgJiYgdmlld3BvcnRTdGFydFkgPD0gYm94U3RhcnRZICYmIGJveEVuZFkgPD0gdmlld3BvcnRFbmRZKSB7XG5cdFx0XHRcdC8vIEJveCBpcyBhbHJlYWR5IGluIHRoZSB2aWV3cG9ydC4uLiBkbyBub3RoaW5nXG5cdFx0XHRcdG5ld1Njcm9sbFRvcCA9IHZpZXdwb3J0U3RhcnRZO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQm94IGlzIG91dHNpZGUgdGhlIHZpZXdwb3J0Li4uIGNlbnRlciBpdFxuXHRcdFx0XHRjb25zdCBib3hNaWRkbGVZID0gKGJveFN0YXJ0WSArIGJveEVuZFkpIC8gMjtcblx0XHRcdFx0bmV3U2Nyb2xsVG9wID0gTWF0aC5tYXgoMCwgYm94TWlkZGxlWSAtIHZpZXdwb3J0SGVpZ2h0IC8gMik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1Njcm9sbFRvcCA9IHRoaXMuX2NvbXB1dGVNaW5pbXVtU2Nyb2xsaW5nKHZpZXdwb3J0U3RhcnRZLCB2aWV3cG9ydEVuZFksIGJveFN0YXJ0WSwgYm94RW5kWSwgdmVydGljYWxUeXBlID09PSB2aWV3RXZlbnRzLlZlcnRpY2FsUmV2ZWFsVHlwZS5Ub3AsIHZlcnRpY2FsVHlwZSA9PT0gdmlld0V2ZW50cy5WZXJ0aWNhbFJldmVhbFR5cGUuQm90dG9tKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3U2Nyb2xsVG9wO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZVNjcm9sbExlZnRUb1JldmVhbChob3Jpem9udGFsUmV2ZWFsUmVxdWVzdDogSG9yaXpvbnRhbFJldmVhbFJlcXVlc3QpOiB7IHNjcm9sbExlZnQ6IG51bWJlcjsgbWF4SG9yaXpvbnRhbE9mZnNldDogbnVtYmVyIH0gfCBudWxsIHtcblxuXHRcdGNvbnN0IHZpZXdwb3J0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldEN1cnJlbnRWaWV3cG9ydCgpO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IHZpZXdwb3J0U3RhcnRYID0gdmlld3BvcnQubGVmdDtcblx0XHRjb25zdCB2aWV3cG9ydEVuZFggPSB2aWV3cG9ydFN0YXJ0WCArIHZpZXdwb3J0LndpZHRoIC0gbGF5b3V0SW5mby52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXG5cdFx0bGV0IGJveFN0YXJ0WCA9IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSO1xuXHRcdGxldCBib3hFbmRYID0gMDtcblx0XHRpZiAoaG9yaXpvbnRhbFJldmVhbFJlcXVlc3QudHlwZSA9PT0gJ3JhbmdlJykge1xuXHRcdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMuX3Zpc2libGVSYW5nZXNGb3JMaW5lUmFuZ2UoaG9yaXpvbnRhbFJldmVhbFJlcXVlc3QubGluZU51bWJlciwgaG9yaXpvbnRhbFJldmVhbFJlcXVlc3Quc3RhcnRDb2x1bW4sIGhvcml6b250YWxSZXZlYWxSZXF1ZXN0LmVuZENvbHVtbik7XG5cdFx0XHRpZiAoIXZpc2libGVSYW5nZXMpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHZpc2libGVSYW5nZSBvZiB2aXNpYmxlUmFuZ2VzLnJhbmdlcykge1xuXHRcdFx0XHRib3hTdGFydFggPSBNYXRoLm1pbihib3hTdGFydFgsIE1hdGgucm91bmQodmlzaWJsZVJhbmdlLmxlZnQpKTtcblx0XHRcdFx0Ym94RW5kWCA9IE1hdGgubWF4KGJveEVuZFgsIE1hdGgucm91bmQodmlzaWJsZVJhbmdlLmxlZnQgKyB2aXNpYmxlUmFuZ2Uud2lkdGgpKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2YgaG9yaXpvbnRhbFJldmVhbFJlcXVlc3Quc2VsZWN0aW9ucykge1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAhPT0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB2aXNpYmxlUmFuZ2VzID0gdGhpcy5fdmlzaWJsZVJhbmdlc0ZvckxpbmVSYW5nZShzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uc3RhcnRDb2x1bW4sIHNlbGVjdGlvbi5lbmRDb2x1bW4pO1xuXHRcdFx0XHRpZiAoIXZpc2libGVSYW5nZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IHZpc2libGVSYW5nZSBvZiB2aXNpYmxlUmFuZ2VzLnJhbmdlcykge1xuXHRcdFx0XHRcdGJveFN0YXJ0WCA9IE1hdGgubWluKGJveFN0YXJ0WCwgTWF0aC5yb3VuZCh2aXNpYmxlUmFuZ2UubGVmdCkpO1xuXHRcdFx0XHRcdGJveEVuZFggPSBNYXRoLm1heChib3hFbmRYLCBNYXRoLnJvdW5kKHZpc2libGVSYW5nZS5sZWZ0ICsgdmlzaWJsZVJhbmdlLndpZHRoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWhvcml6b250YWxSZXZlYWxSZXF1ZXN0Lm1pbmltYWxSZXZlYWwpIHtcblx0XHRcdGJveFN0YXJ0WCA9IE1hdGgubWF4KDAsIGJveFN0YXJ0WCAtIFZpZXdMaW5lcy5IT1JJWk9OVEFMX0VYVFJBX1BYKTtcblx0XHRcdGJveEVuZFggKz0gdGhpcy5fcmV2ZWFsSG9yaXpvbnRhbFJpZ2h0UGFkZGluZztcblx0XHR9XG5cblx0XHRpZiAoaG9yaXpvbnRhbFJldmVhbFJlcXVlc3QudHlwZSA9PT0gJ3NlbGVjdGlvbnMnICYmIGJveEVuZFggLSBib3hTdGFydFggPiB2aWV3cG9ydC53aWR0aCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3U2Nyb2xsTGVmdCA9IHRoaXMuX2NvbXB1dGVNaW5pbXVtU2Nyb2xsaW5nKHZpZXdwb3J0U3RhcnRYLCB2aWV3cG9ydEVuZFgsIGJveFN0YXJ0WCwgYm94RW5kWCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjcm9sbExlZnQ6IG5ld1Njcm9sbExlZnQsXG5cdFx0XHRtYXhIb3Jpem9udGFsT2Zmc2V0OiBib3hFbmRYXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVNaW5pbXVtU2Nyb2xsaW5nKHZpZXdwb3J0U3RhcnQ6IG51bWJlciwgdmlld3BvcnRFbmQ6IG51bWJlciwgYm94U3RhcnQ6IG51bWJlciwgYm94RW5kOiBudW1iZXIsIHJldmVhbEF0U3RhcnQ/OiBib29sZWFuLCByZXZlYWxBdEVuZD86IGJvb2xlYW4pOiBudW1iZXIge1xuXHRcdHZpZXdwb3J0U3RhcnQgPSB2aWV3cG9ydFN0YXJ0IHwgMDtcblx0XHR2aWV3cG9ydEVuZCA9IHZpZXdwb3J0RW5kIHwgMDtcblx0XHRib3hTdGFydCA9IGJveFN0YXJ0IHwgMDtcblx0XHRib3hFbmQgPSBib3hFbmQgfCAwO1xuXHRcdHJldmVhbEF0U3RhcnQgPSAhIXJldmVhbEF0U3RhcnQ7XG5cdFx0cmV2ZWFsQXRFbmQgPSAhIXJldmVhbEF0RW5kO1xuXG5cdFx0Y29uc3Qgdmlld3BvcnRMZW5ndGggPSB2aWV3cG9ydEVuZCAtIHZpZXdwb3J0U3RhcnQ7XG5cdFx0Y29uc3QgYm94TGVuZ3RoID0gYm94RW5kIC0gYm94U3RhcnQ7XG5cblx0XHRpZiAoYm94TGVuZ3RoIDwgdmlld3BvcnRMZW5ndGgpIHtcblx0XHRcdC8vIFRoZSBib3ggd291bGQgZml0IGluIHRoZSB2aWV3cG9ydFxuXG5cdFx0XHRpZiAocmV2ZWFsQXRTdGFydCkge1xuXHRcdFx0XHRyZXR1cm4gYm94U3RhcnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZXZlYWxBdEVuZCkge1xuXHRcdFx0XHRyZXR1cm4gTWF0aC5tYXgoMCwgYm94RW5kIC0gdmlld3BvcnRMZW5ndGgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYm94U3RhcnQgPCB2aWV3cG9ydFN0YXJ0KSB7XG5cdFx0XHRcdC8vIFRoZSBib3ggaXMgYWJvdmUgdGhlIHZpZXdwb3J0XG5cdFx0XHRcdHJldHVybiBib3hTdGFydDtcblx0XHRcdH0gZWxzZSBpZiAoYm94RW5kID4gdmlld3BvcnRFbmQpIHtcblx0XHRcdFx0Ly8gVGhlIGJveCBpcyBiZWxvdyB0aGUgdmlld3BvcnRcblx0XHRcdFx0cmV0dXJuIE1hdGgubWF4KDAsIGJveEVuZCAtIHZpZXdwb3J0TGVuZ3RoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gVGhlIGJveCB3b3VsZCBub3QgZml0IGluIHRoZSB2aWV3cG9ydFxuXHRcdFx0Ly8gUmV2ZWFsIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGJveFxuXHRcdFx0cmV0dXJuIGJveFN0YXJ0O1xuXHRcdH1cblxuXHRcdHJldHVybiB2aWV3cG9ydFN0YXJ0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHdCQUF3QjtBQUNqQyxZQUFZLGNBQWM7QUFDMUIsU0FBUyxpQkFBaUI7QUFDMUIsT0FBTztBQUNQLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CLGlCQUE2Qix5QkFBd0M7QUFDbEcsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxpQkFBaUIsa0JBQWtCLGdCQUFnQjtBQUM1RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFFdEIsU0FBUyxrQkFBa0I7QUFDM0IsWUFBWSxnQkFBZ0I7QUFJNUIsU0FBUyx1QkFBdUI7QUFHaEMsTUFBTSxpQkFBaUI7QUFBQSxFQUl0QixjQUFjO0FBQ2IsU0FBSyx1QkFBdUIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxFQUNqRDtBQUFBLEVBRU8seUJBQWdDO0FBQ3RDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVPLHVCQUF1QixxQkFBa0M7QUFDL0QsU0FBSyx1QkFBdUI7QUFBQSxFQUM3QjtBQUNEO0FBRUEsTUFBTSw2QkFBNkI7QUFBQSxFQUtsQyxZQUNpQixlQUNBLFlBQ0EsYUFDQSxXQUNBLGdCQUNBLGVBQ0EsWUFDZjtBQVBlO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBWGpCLFNBQWdCLE9BQU87QUFhdEIsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUNEO0FBRUEsTUFBTSxrQ0FBa0M7QUFBQSxFQUt2QyxZQUNpQixlQUNBLFlBQ0EsZ0JBQ0EsZUFDQSxZQUNmO0FBTGU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQVRqQixTQUFnQixPQUFPO0FBV3RCLFFBQUksZ0JBQWdCLFdBQVcsQ0FBQyxFQUFFO0FBQ2xDLFFBQUksZ0JBQWdCLFdBQVcsQ0FBQyxFQUFFO0FBQ2xDLGFBQVMsSUFBSSxHQUFHLE1BQU0sV0FBVyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3RELFlBQU0sWUFBWSxXQUFXLENBQUM7QUFDOUIsc0JBQWdCLEtBQUssSUFBSSxlQUFlLFVBQVUsZUFBZTtBQUNqRSxzQkFBZ0IsS0FBSyxJQUFJLGVBQWUsVUFBVSxhQUFhO0FBQUEsSUFDaEU7QUFDQSxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGdCQUFnQjtBQUFBLEVBQ3RCO0FBQ0Q7QUFRTyxNQUFNLGFBQU4sTUFBTSxtQkFBa0IsU0FBK0I7QUFBQSxFQWlDN0QsWUFBWSxTQUFzQixnQkFBNEMsY0FBd0M7QUFDckgsVUFBTSxPQUFPO0FBRWIsVUFBTSxPQUFPLEtBQUssU0FBUztBQUMzQixVQUFNLFVBQVUsS0FBSyxTQUFTLGNBQWM7QUFDNUMsVUFBTSxXQUFXLFFBQVEsSUFBSSxhQUFhLFFBQVE7QUFDbEQsVUFBTSxlQUFlLFFBQVEsSUFBSSxhQUFhLFlBQVk7QUFFMUQsU0FBSyxjQUFjLFFBQVEsSUFBSSxhQUFhLFVBQVU7QUFDdEQsU0FBSyxrQ0FBa0MsU0FBUztBQUNoRCxTQUFLLHNCQUFzQixhQUFhO0FBQ3hDLFNBQUssZ0NBQWdDLFFBQVEsSUFBSSxhQUFhLDRCQUE0QjtBQUMxRixTQUFLLDBCQUEwQixRQUFRLElBQUksYUFBYSxzQkFBc0I7QUFDOUUsU0FBSywrQkFBK0IsUUFBUSxJQUFJLGFBQWEsMkJBQTJCO0FBQ3hGLFNBQUssc0JBQXNCLENBQUMsUUFBUSxJQUFJLGFBQWEsbUJBQW1CO0FBQ3hFLFNBQUssbUJBQW1CLElBQUksZ0JBQWdCLE1BQU0sS0FBSyxTQUFTLE1BQU0sSUFBSTtBQUUxRSxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLHdCQUF3QixTQUFTLGNBQWMsS0FBSztBQUN6RCxTQUFLLGdCQUFnQixJQUFJLHVCQUF1QjtBQUFBLE1BQy9DLFlBQVksTUFBTSxJQUFJLFNBQVMsZ0JBQWdCLEtBQUssZ0JBQWdCO0FBQUEsSUFDckUsQ0FBQztBQUNELFNBQUssVUFBVSxLQUFLLGNBQWM7QUFFbEMscUJBQWlCLE1BQU0sS0FBSyxTQUFTLGdCQUFnQixTQUFTO0FBQzlELFNBQUssUUFBUSxhQUFhLGNBQWMsZ0NBQWdDLEVBQUU7QUFDMUUsa0JBQWMsS0FBSyxTQUFTLFFBQVE7QUFHcEMsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyx5QkFBeUIsSUFBSSxpQkFBaUIsTUFBTTtBQUN4RCxXQUFLLHNCQUFzQjtBQUFBLElBQzVCLEdBQUcsR0FBRztBQUNOLFNBQUssc0NBQXNDLElBQUksaUJBQWlCLE1BQU07QUFDckUsV0FBSywrQkFBK0I7QUFBQSxJQUNyQyxHQUFHLEdBQUk7QUFFUCxTQUFLLG9CQUFvQixJQUFJLGlCQUFpQjtBQUU5QyxTQUFLLDJCQUEyQjtBQUdoQyxTQUFLLHVCQUF1QixRQUFRLElBQUksYUFBYSxZQUFZLEVBQUU7QUFDbkUsU0FBSyx3QkFBd0IsUUFBUSxJQUFJLGFBQWEsWUFBWSxFQUFFO0FBQUEsRUFDckU7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixTQUFLLHVCQUF1QixRQUFRO0FBQ3BDLFNBQUssb0NBQW9DLFFBQVE7QUFDakQsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUFBLEVBRU8sYUFBdUM7QUFDN0MsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBO0FBQUEsRUFJZ0IsdUJBQXVCLEdBQXNEO0FBQzVGLFNBQUssY0FBYyx1QkFBdUIsQ0FBQztBQUMzQyxRQUFJLEVBQUUsV0FBVyxhQUFhLFlBQVksR0FBRztBQUM1QyxXQUFLLGdCQUFnQjtBQUFBLElBQ3RCO0FBRUEsVUFBTSxVQUFVLEtBQUssU0FBUyxjQUFjO0FBQzVDLFVBQU0sV0FBVyxRQUFRLElBQUksYUFBYSxRQUFRO0FBQ2xELFVBQU0sZUFBZSxRQUFRLElBQUksYUFBYSxZQUFZO0FBRTFELFNBQUssY0FBYyxRQUFRLElBQUksYUFBYSxVQUFVO0FBQ3RELFNBQUssa0NBQWtDLFNBQVM7QUFDaEQsU0FBSyxzQkFBc0IsYUFBYTtBQUN4QyxTQUFLLGdDQUFnQyxRQUFRLElBQUksYUFBYSw0QkFBNEI7QUFDMUYsU0FBSywwQkFBMEIsUUFBUSxJQUFJLGFBQWEsc0JBQXNCO0FBQzlFLFNBQUssK0JBQStCLFFBQVEsSUFBSSxhQUFhLDJCQUEyQjtBQUN4RixTQUFLLHNCQUFzQixDQUFDLFFBQVEsSUFBSSxhQUFhLG1CQUFtQjtBQUd4RSxTQUFLLHVCQUF1QixRQUFRLElBQUksYUFBYSxZQUFZLEVBQUU7QUFDbkUsU0FBSyx3QkFBd0IsUUFBUSxJQUFJLGFBQWEsWUFBWSxFQUFFO0FBRXBFLGtCQUFjLEtBQUssU0FBUyxRQUFRO0FBRXBDLFNBQUssdUJBQXVCO0FBRTVCLFFBQUksRUFBRSxXQUFXLGFBQWEsVUFBVSxHQUFHO0FBQzFDLFdBQUssZ0JBQWdCO0FBQUEsSUFDdEI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ1EseUJBQWtDO0FBQ3pDLFVBQU0sT0FBTyxLQUFLLFNBQVM7QUFFM0IsVUFBTSxxQkFBcUIsSUFBSSxnQkFBZ0IsTUFBTSxLQUFLLFNBQVMsTUFBTSxJQUFJO0FBQzdFLFFBQUksQ0FBQyxLQUFLLGlCQUFpQixPQUFPLGtCQUFrQixHQUFHO0FBQ3RELFdBQUssbUJBQW1CO0FBRXhCLFlBQU0sa0JBQWtCLEtBQUssY0FBYyxtQkFBbUI7QUFDOUQsWUFBTSxnQkFBZ0IsS0FBSyxjQUFjLGlCQUFpQjtBQUMxRCxlQUFTLGFBQWEsaUJBQWlCLGNBQWMsZUFBZSxjQUFjO0FBQ2pGLGNBQU0sT0FBTyxLQUFLLGNBQWMsZUFBZSxVQUFVO0FBQ3pELGFBQUssaUJBQWlCLEtBQUssZ0JBQWdCO0FBQUEsTUFDNUM7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDZ0IscUJBQXFCLEdBQW9EO0FBQ3hGLFVBQU0sc0JBQXNCLEtBQUssY0FBYyxtQkFBbUI7QUFDbEUsVUFBTSxvQkFBb0IsS0FBSyxjQUFjLGlCQUFpQjtBQUM5RCxRQUFJLElBQUk7QUFDUixhQUFTLGFBQWEscUJBQXFCLGNBQWMsbUJBQW1CLGNBQWM7QUFDekYsVUFBSSxLQUFLLGNBQWMsZUFBZSxVQUFVLEVBQUUsbUJBQW1CLEtBQUs7QUFBQSxJQUMzRTtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDZ0IscUJBQXFCLEdBQW9EO0FBQ3hGLFFBQUksTUFBb0M7QUFDdkMsWUFBTSxzQkFBc0IsS0FBSyxjQUFjLG1CQUFtQjtBQUNsRSxZQUFNLG9CQUFvQixLQUFLLGNBQWMsaUJBQWlCO0FBQzlELGVBQVMsYUFBYSxxQkFBcUIsY0FBYyxtQkFBbUIsY0FBYztBQUN6RixhQUFLLGNBQWMsZUFBZSxVQUFVLEVBQUUscUJBQXFCO0FBQUEsTUFDcEU7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNnQixVQUFVLEdBQXlDO0FBQ2xFLFVBQU0sZUFBZSxLQUFLLGNBQWMsVUFBVSxHQUFHLEtBQUssaUJBQWlCLE1BQU07QUFDakYsU0FBSyxnQkFBZ0I7QUFDckIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNnQixlQUFlLEdBQThDO0FBQzVFLFdBQU8sS0FBSyxjQUFjLGVBQWUsQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFDZ0IsZUFBZSxHQUE4QztBQUM1RSxXQUFPLEtBQUssY0FBYyxlQUFlLENBQUM7QUFBQSxFQUMzQztBQUFBLEVBQ2dCLGdCQUFnQixHQUErQztBQUM5RSxXQUFPLEtBQUssY0FBYyxnQkFBZ0IsQ0FBQztBQUFBLEVBQzVDO0FBQUEsRUFDZ0IscUJBQXFCLEdBQW9EO0FBR3hGLFVBQU0sbUJBQW1CLEtBQUssK0JBQStCLEtBQUssU0FBUyxXQUFXLGtCQUFrQixHQUFHLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFlBQVk7QUFFM0ssUUFBSSxxQkFBcUIsSUFBSTtBQUU1QixhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksb0JBQW9CLEtBQUssU0FBUyxXQUFXLHVCQUF1QixFQUFFLFdBQVcsaUJBQWlCLENBQUM7QUFFdkcsUUFBSSxFQUFFLGtCQUFrQjtBQUN2QixVQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLEVBQUUsTUFBTSxlQUFlO0FBRWpFLDRCQUFvQjtBQUFBLFVBQ25CLFdBQVcsa0JBQWtCO0FBQUEsVUFDN0IsWUFBWTtBQUFBLFFBQ2I7QUFBQSxNQUNELFdBQVcsRUFBRSxPQUFPO0FBRW5CLGFBQUssMkJBQTJCLElBQUksNkJBQTZCLEVBQUUsZUFBZSxFQUFFLE1BQU0saUJBQWlCLEVBQUUsTUFBTSxhQUFhLEVBQUUsTUFBTSxXQUFXLEtBQUssU0FBUyxXQUFXLG9CQUFvQixHQUFHLGtCQUFrQixXQUFXLEVBQUUsVUFBVTtBQUFBLE1BQzdPLFdBQVcsRUFBRSxjQUFjLEVBQUUsV0FBVyxTQUFTLEdBQUc7QUFDbkQsYUFBSywyQkFBMkIsSUFBSSxrQ0FBa0MsRUFBRSxlQUFlLEVBQUUsWUFBWSxLQUFLLFNBQVMsV0FBVyxvQkFBb0IsR0FBRyxrQkFBa0IsV0FBVyxFQUFFLFVBQVU7QUFBQSxNQUMvTDtBQUFBLElBQ0QsT0FBTztBQUNOLFdBQUssMkJBQTJCO0FBQUEsSUFDakM7QUFFQSxVQUFNLGlCQUFpQixLQUFLLElBQUksS0FBSyxTQUFTLFdBQVcsb0JBQW9CLElBQUksa0JBQWtCLFNBQVM7QUFDNUcsVUFBTSxhQUFjLGtCQUFrQixLQUFLLGNBQWMsV0FBVyxZQUFZLEVBQUU7QUFDbEYsU0FBSyxTQUFTLFVBQVUsV0FBVyxrQkFBa0IsbUJBQW1CLFVBQVU7QUFFbEYsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNnQixnQkFBZ0IsR0FBK0M7QUFDOUUsUUFBSSxLQUFLLDRCQUE0QixFQUFFLG1CQUFtQjtBQUV6RCxXQUFLLDJCQUEyQjtBQUFBLElBQ2pDO0FBQ0EsUUFBSSxLQUFLLDRCQUE0QixFQUFFLGtCQUFrQjtBQUN4RCxZQUFNLE1BQU0sS0FBSyxJQUFJLEtBQUsseUJBQXlCLGdCQUFnQixLQUFLLHlCQUF5QixhQUFhO0FBQzlHLFlBQU0sTUFBTSxLQUFLLElBQUksS0FBSyx5QkFBeUIsZ0JBQWdCLEtBQUsseUJBQXlCLGFBQWE7QUFDOUcsVUFBSSxFQUFFLFlBQVksT0FBTyxFQUFFLFlBQVksS0FBSztBQUUzQyxhQUFLLDJCQUEyQjtBQUFBLE1BQ2pDO0FBQUEsSUFDRDtBQUNBLFNBQUssUUFBUSxTQUFTLEVBQUUsV0FBVztBQUNuQyxXQUFPLEtBQUssY0FBYyxnQkFBZ0IsQ0FBQyxLQUFLO0FBQUEsRUFDakQ7QUFBQSxFQUVnQixnQkFBZ0IsR0FBK0M7QUFDOUUsV0FBTyxLQUFLLGNBQWMsZ0JBQWdCLENBQUM7QUFBQSxFQUM1QztBQUFBLEVBQ2dCLGVBQWUsR0FBOEM7QUFDNUUsU0FBSyxTQUFTLFVBQVUsV0FBVyxnQkFBZ0IsS0FBSyxhQUFhO0FBQ3JFLFdBQU8sS0FBSyxjQUFjLGVBQWUsQ0FBQztBQUFBLEVBQzNDO0FBQUEsRUFDZ0IsZUFBZSxHQUE4QztBQUM1RSxXQUFPLEtBQUssdUJBQXVCO0FBQUEsRUFDcEM7QUFBQTtBQUFBO0FBQUEsRUFNTyx1QkFBdUIsVUFBdUIsUUFBaUM7QUFDckYsVUFBTSxrQkFBa0IsS0FBSyxvQkFBb0IsUUFBUTtBQUN6RCxRQUFJLG9CQUFvQixNQUFNO0FBRTdCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxhQUFhLEtBQUssa0JBQWtCLGVBQWU7QUFFekQsUUFBSSxlQUFlLElBQUk7QUFFdEIsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGFBQWEsS0FBSyxhQUFhLEtBQUssU0FBUyxVQUFVLGFBQWEsR0FBRztBQUUxRSxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksS0FBSyxTQUFTLFVBQVUsaUJBQWlCLFVBQVUsTUFBTSxHQUFHO0FBRS9ELGFBQU8sSUFBSSxTQUFTLFlBQVksQ0FBQztBQUFBLElBQ2xDO0FBRUEsVUFBTSxzQkFBc0IsS0FBSyxjQUFjLG1CQUFtQjtBQUNsRSxVQUFNLG9CQUFvQixLQUFLLGNBQWMsaUJBQWlCO0FBQzlELFFBQUksYUFBYSx1QkFBdUIsYUFBYSxtQkFBbUI7QUFFdkUsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLFNBQVMsS0FBSyxjQUFjLGVBQWUsVUFBVSxFQUFFLHNCQUFzQixVQUFVLE1BQU07QUFDakcsVUFBTSxZQUFZLEtBQUssU0FBUyxVQUFVLGlCQUFpQixVQUFVO0FBQ3JFLFFBQUksU0FBUyxXQUFXO0FBQ3ZCLGVBQVM7QUFBQSxJQUNWO0FBQ0EsV0FBTyxJQUFJLFNBQVMsWUFBWSxNQUFNO0FBQUEsRUFDdkM7QUFBQSxFQUVRLG9CQUFvQixNQUE4QztBQUN6RSxXQUFPLFFBQVEsS0FBSyxhQUFhLEdBQUc7QUFDbkMsVUFBSSxLQUFLLGNBQWMsU0FBUyxZQUFZO0FBQzNDLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLUSxrQkFBa0IsU0FBOEI7QUFDdkQsVUFBTSxrQkFBa0IsS0FBSyxjQUFjLG1CQUFtQjtBQUM5RCxVQUFNLGdCQUFnQixLQUFLLGNBQWMsaUJBQWlCO0FBQzFELGFBQVMsYUFBYSxpQkFBaUIsY0FBYyxlQUFlLGNBQWM7QUFDakYsWUFBTSxPQUFPLEtBQUssY0FBYyxlQUFlLFVBQVU7QUFDekQsVUFBSSxZQUFZLEtBQUssV0FBVyxHQUFHO0FBQ2xDLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxhQUFhLFlBQTRCO0FBQy9DLFVBQU0sc0JBQXNCLEtBQUssY0FBYyxtQkFBbUI7QUFDbEUsVUFBTSxvQkFBb0IsS0FBSyxjQUFjLGlCQUFpQjtBQUM5RCxRQUFJLGFBQWEsdUJBQXVCLGFBQWEsbUJBQW1CO0FBRXZFLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxVQUFVLElBQUksa0JBQWtCLEtBQUssUUFBUSxTQUFTLEtBQUsscUJBQXFCO0FBQ3RGLFVBQU0sU0FBUyxLQUFLLGNBQWMsZUFBZSxVQUFVLEVBQUUsU0FBUyxPQUFPO0FBQzdFLFNBQUssb0NBQW9DLE9BQU87QUFFaEQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLDJCQUEyQixRQUFlLGlCQUFzRDtBQUN0RyxRQUFJLEtBQUssYUFBYSxHQUFHO0FBR3hCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSx3QkFBd0IsT0FBTztBQUNyQyxVQUFNLFFBQVEsTUFBTSxnQkFBZ0IsUUFBUSxLQUFLLGtCQUFrQix1QkFBdUIsQ0FBQztBQUMzRixRQUFJLENBQUMsT0FBTztBQUNYLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxnQkFBcUMsQ0FBQztBQUM1QyxRQUFJLG1CQUFtQjtBQUN2QixVQUFNLG9CQUFvQixJQUFJLGtCQUFrQixLQUFLLFFBQVEsU0FBUyxLQUFLLHFCQUFxQjtBQUVoRyxRQUFJLDBCQUFrQztBQUN0QyxRQUFJLGlCQUFpQjtBQUNwQixnQ0FBMEIsS0FBSyxTQUFTLFVBQVUscUJBQXFCLG1DQUFtQyxJQUFJLFNBQVMsTUFBTSxpQkFBaUIsQ0FBQyxDQUFDLEVBQUU7QUFBQSxJQUNuSjtBQUVBLFVBQU0sc0JBQXNCLEtBQUssY0FBYyxtQkFBbUI7QUFDbEUsVUFBTSxvQkFBb0IsS0FBSyxjQUFjLGlCQUFpQjtBQUM5RCxhQUFTLGFBQWEsTUFBTSxpQkFBaUIsY0FBYyxNQUFNLGVBQWUsY0FBYztBQUU3RixVQUFJLGFBQWEsdUJBQXVCLGFBQWEsbUJBQW1CO0FBQ3ZFO0FBQUEsTUFDRDtBQUVBLFlBQU0sY0FBYyxlQUFlLE1BQU0sa0JBQWtCLE1BQU0sY0FBYztBQUMvRSxZQUFNLHNCQUFzQixlQUFlLE1BQU07QUFDakQsWUFBTSxZQUFZLHNCQUFzQixLQUFLLFNBQVMsVUFBVSxpQkFBaUIsVUFBVSxJQUFJLE1BQU07QUFDckcsWUFBTSx1QkFBdUIsS0FBSyxjQUFjLGVBQWUsVUFBVSxFQUFFLHlCQUF5QixZQUFZLGFBQWEsV0FBVyxpQkFBaUI7QUFFekosVUFBSSxDQUFDLHNCQUFzQjtBQUMxQjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLG1CQUFtQixhQUFhLHVCQUF1QjtBQUMxRCxjQUFNLDZCQUE2QjtBQUNuQyxrQ0FBMEIsS0FBSyxTQUFTLFVBQVUscUJBQXFCLG1DQUFtQyxJQUFJLFNBQVMsYUFBYSxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBRTNJLFlBQUksK0JBQStCLHlCQUF5QjtBQUMzRCwrQkFBcUIsT0FBTyxxQkFBcUIsT0FBTyxTQUFTLENBQUMsRUFBRSxTQUFTLEtBQUs7QUFBQSxRQUNuRjtBQUFBLE1BQ0Q7QUFFQSxvQkFBYyxrQkFBa0IsSUFBSSxJQUFJLGtCQUFrQixxQkFBcUIscUJBQXFCLFlBQVksZ0JBQWdCLEtBQUsscUJBQXFCLE1BQU0sR0FBRyxtQkFBbUI7QUFBQSxJQUN2TDtBQUVBLFNBQUssb0NBQW9DLGlCQUFpQjtBQUUxRCxRQUFJLHFCQUFxQixHQUFHO0FBQzNCLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLDJCQUEyQixZQUFvQixhQUFxQixXQUF5QztBQUNwSCxRQUFJLEtBQUssYUFBYSxHQUFHO0FBR3hCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxhQUFhLEtBQUssY0FBYyxtQkFBbUIsS0FBSyxhQUFhLEtBQUssY0FBYyxpQkFBaUIsR0FBRztBQUMvRyxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sb0JBQW9CLElBQUksa0JBQWtCLEtBQUssUUFBUSxTQUFTLEtBQUsscUJBQXFCO0FBQ2hHLFVBQU0sU0FBUyxLQUFLLGNBQWMsZUFBZSxVQUFVLEVBQUUseUJBQXlCLFlBQVksYUFBYSxXQUFXLGlCQUFpQjtBQUMzSSxTQUFLLG9DQUFvQyxpQkFBaUI7QUFFMUQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLHdCQUF3QixVQUErQztBQUM3RSxVQUFNLGdCQUFnQixLQUFLLDJCQUEyQixTQUFTLFlBQVksU0FBUyxRQUFRLFNBQVMsTUFBTTtBQUMzRyxRQUFJLENBQUMsZUFBZTtBQUNuQixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sSUFBSSxtQkFBbUIsY0FBYyxxQkFBcUIsY0FBYyxPQUFPLENBQUMsRUFBRSxJQUFJO0FBQUEsRUFDOUY7QUFBQTtBQUFBLEVBSU8sbUJBQXlCO0FBQy9CLFNBQUssa0JBQWtCLEtBQUs7QUFBQSxFQUM3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9RLHdCQUFpQztBQUN4QyxXQUFPLEtBQUssa0JBQWtCLElBQUk7QUFBQSxFQUNuQztBQUFBLEVBRVEsd0JBQThCO0FBQ3JDLFNBQUssa0JBQWtCLEtBQUs7QUFBQSxFQUM3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNUSxvQ0FBb0MsbUJBQTRDO0FBQ3ZGLFFBQUksQ0FBQyxrQkFBa0IsY0FBYztBQUVwQztBQUFBLElBQ0Q7QUFDQSxRQUFJLEtBQUssdUJBQXVCLFlBQVksR0FBRztBQUU5QztBQUFBLElBQ0Q7QUFDQSxTQUFLLHVCQUF1QixPQUFPO0FBQ25DLFNBQUssc0JBQXNCO0FBQUEsRUFDNUI7QUFBQSxFQUVRLGtCQUFrQixNQUF3QjtBQUNqRCxVQUFNLHNCQUFzQixLQUFLLGNBQWMsbUJBQW1CO0FBQ2xFLFVBQU0sb0JBQW9CLEtBQUssY0FBYyxpQkFBaUI7QUFFOUQsUUFBSSxvQkFBb0I7QUFDeEIsUUFBSSxvQkFBb0I7QUFDeEIsYUFBUyxhQUFhLHFCQUFxQixjQUFjLG1CQUFtQixjQUFjO0FBQ3pGLFlBQU0sY0FBYyxLQUFLLGNBQWMsZUFBZSxVQUFVO0FBRWhFLFVBQUksUUFBUSxDQUFDLFlBQVksZUFBZSxHQUFHO0FBRTFDLDRCQUFvQjtBQUNwQjtBQUFBLE1BQ0Q7QUFFQSwwQkFBb0IsS0FBSyxJQUFJLG1CQUFtQixZQUFZLFNBQVMsSUFBSSxDQUFDO0FBQUEsSUFDM0U7QUFFQSxRQUFJLHFCQUFxQix3QkFBd0IsS0FBSyxzQkFBc0IsS0FBSyxTQUFTLFVBQVUsYUFBYSxHQUFHO0FBRW5ILFdBQUssZ0JBQWdCO0FBQUEsSUFDdEI7QUFFQSxTQUFLLG9CQUFvQixpQkFBaUI7QUFFMUMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGlDQUF1QztBQUk5QyxRQUFJLG9CQUFvQjtBQUN4QixRQUFJLGVBQWU7QUFDbkIsVUFBTSxzQkFBc0IsS0FBSyxjQUFjLG1CQUFtQjtBQUNsRSxVQUFNLG9CQUFvQixLQUFLLGNBQWMsaUJBQWlCO0FBQzlELGFBQVMsYUFBYSxxQkFBcUIsY0FBYyxtQkFBbUIsY0FBYztBQUN6RixZQUFNLGNBQWMsS0FBSyxjQUFjLGVBQWUsVUFBVTtBQUNoRSxVQUFJLFlBQVksd0JBQXdCLEdBQUc7QUFDMUMsY0FBTSxZQUFZLFlBQVksU0FBUyxJQUFJO0FBQzNDLFlBQUksWUFBWSxjQUFjO0FBQzdCLHlCQUFlO0FBQ2YsOEJBQW9CO0FBQUEsUUFDckI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksc0JBQXNCLElBQUk7QUFDN0I7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUssY0FBYyxlQUFlLGlCQUFpQixFQUFFLDZCQUE2QixHQUFHO0FBQ3pGLGVBQVMsYUFBYSxxQkFBcUIsY0FBYyxtQkFBbUIsY0FBYztBQUN6RixjQUFNLGNBQWMsS0FBSyxjQUFjLGVBQWUsVUFBVTtBQUNoRSxvQkFBWSxrQ0FBa0M7QUFBQSxNQUMvQztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFTyxnQkFBc0I7QUFDNUIsVUFBTSxJQUFJLE1BQU0sZUFBZTtBQUFBLEVBQ2hDO0FBQUEsRUFFTyxTQUFlO0FBQ3JCLFVBQU0sSUFBSSxNQUFNLGVBQWU7QUFBQSxFQUNoQztBQUFBLEVBRU8sV0FBVyxjQUFrQztBQUVuRCxTQUFLLGNBQWMsWUFBWSxZQUFZO0FBQzNDLFNBQUssa0JBQWtCLHVCQUF1QixhQUFhLFlBQVk7QUFDdkUsU0FBSyxRQUFRLFNBQVMsS0FBSyxTQUFTLFdBQVcsZUFBZSxDQUFDO0FBQy9ELFNBQUssUUFBUSxVQUFVLEtBQUssSUFBSSxLQUFLLFNBQVMsV0FBVyxnQkFBZ0IsR0FBRyxHQUFPLENBQUM7QUFLcEYsUUFBSSxLQUFLLDBCQUEwQjtBQUVsQyxZQUFNLDBCQUEwQixLQUFLO0FBR3JDLFVBQUksYUFBYSxtQkFBbUIsd0JBQXdCLGlCQUFpQix3QkFBd0IsaUJBQWlCLGFBQWEsZUFBZTtBQUVqSixhQUFLLDJCQUEyQjtBQUdoQyxhQUFLLFlBQVk7QUFHakIsY0FBTSxnQkFBZ0IsS0FBSywyQkFBMkIsdUJBQXVCO0FBRTdFLFlBQUksZUFBZTtBQUNsQixjQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFFOUIsaUJBQUssb0JBQW9CLGNBQWMsbUJBQW1CO0FBQUEsVUFDM0Q7QUFFQSxlQUFLLFNBQVMsVUFBVSxXQUFXLGtCQUFrQjtBQUFBLFlBQ3BELFlBQVksY0FBYztBQUFBLFVBQzNCLEdBQUcsd0JBQXdCLFVBQVU7QUFBQSxRQUN0QztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsUUFBSSxDQUFDLEtBQUssc0JBQXNCLEdBQUc7QUFFbEMsV0FBSyx1QkFBdUIsU0FBUztBQUFBLElBQ3RDLE9BQU87QUFDTixXQUFLLHVCQUF1QixPQUFPO0FBQUEsSUFDcEM7QUFFQSxRQUFJLFNBQVMsV0FBVyxDQUFDLEtBQUssb0NBQW9DLFlBQVksR0FBRztBQUNoRixZQUFNLHNCQUFzQixLQUFLLGNBQWMsbUJBQW1CO0FBQ2xFLFlBQU0sb0JBQW9CLEtBQUssY0FBYyxpQkFBaUI7QUFDOUQsZUFBUyxhQUFhLHFCQUFxQixjQUFjLG1CQUFtQixjQUFjO0FBQ3pGLGNBQU0sY0FBYyxLQUFLLGNBQWMsZUFBZSxVQUFVO0FBQ2hFLFlBQUksWUFBWSx3QkFBd0IsR0FBRztBQUMxQyxlQUFLLG9DQUFvQyxTQUFTO0FBQ2xEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsU0FBSyxjQUFjLGdCQUFnQixLQUFLLG1CQUFtQjtBQUMzRCxTQUFLLGNBQWMsV0FBVyxRQUFRO0FBQ3RDLFVBQU0sb0JBQW9CLEtBQUssU0FBUyxXQUFXLG9CQUFvQixJQUFJLGFBQWE7QUFDeEYsU0FBSyxjQUFjLE9BQU8sQ0FBQyxpQkFBaUI7QUFDNUMsU0FBSyxjQUFjLFFBQVEsQ0FBQyxLQUFLLFNBQVMsV0FBVyxxQkFBcUIsQ0FBQztBQUFBLEVBQzVFO0FBQUE7QUFBQSxFQUlRLG9CQUFvQixXQUF5QjtBQUNwRCxVQUFNLGFBQWEsS0FBSyxLQUFLLFNBQVM7QUFDdEMsUUFBSSxLQUFLLGdCQUFnQixZQUFZO0FBQ3BDLFdBQUssZ0JBQWdCO0FBQ3JCLFdBQUssU0FBUyxVQUFVLFdBQVcsZ0JBQWdCLEtBQUssYUFBYTtBQUFBLElBQ3RFO0FBQUEsRUFDRDtBQUFBLEVBRVEsK0JBQStCLFVBQW9CLFFBQW1DLGVBQXdCLE9BQXFCLFlBQWdDLGNBQXFEO0FBQy9OLFVBQU0saUJBQWlCLFNBQVM7QUFDaEMsVUFBTSxpQkFBaUIsU0FBUztBQUNoQyxVQUFNLGVBQWUsaUJBQWlCO0FBQ3RDLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUVKLFFBQUksY0FBYyxXQUFXLFNBQVMsR0FBRztBQUN4QyxVQUFJLGdCQUFnQixXQUFXLENBQUMsRUFBRTtBQUNsQyxVQUFJLGdCQUFnQixXQUFXLENBQUMsRUFBRTtBQUNsQyxlQUFTLElBQUksR0FBRyxNQUFNLFdBQVcsUUFBUSxJQUFJLEtBQUssS0FBSztBQUN0RCxjQUFNLFlBQVksV0FBVyxDQUFDO0FBQzlCLHdCQUFnQixLQUFLLElBQUksZUFBZSxVQUFVLGVBQWU7QUFDakUsd0JBQWdCLEtBQUssSUFBSSxlQUFlLFVBQVUsYUFBYTtBQUFBLE1BQ2hFO0FBQ0EseUJBQW1CO0FBQ25CLGtCQUFZLEtBQUssU0FBUyxXQUFXLCtCQUErQixhQUFhO0FBQ2pGLGdCQUFVLEtBQUssU0FBUyxXQUFXLCtCQUErQixhQUFhLElBQUksS0FBSztBQUFBLElBQ3pGLFdBQVcsT0FBTztBQUNqQix5QkFBbUI7QUFDbkIsa0JBQVksS0FBSyxTQUFTLFdBQVcsK0JBQStCLE1BQU0sZUFBZTtBQUN6RixnQkFBVSxLQUFLLFNBQVMsV0FBVywrQkFBK0IsTUFBTSxhQUFhLElBQUksS0FBSztBQUFBLElBQy9GLE9BQU87QUFDTixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0seUJBQXlCLFdBQVcsV0FBVyxrQkFBa0IsS0FBSyxpQ0FBaUM7QUFFN0csUUFBSSxhQUFxQjtBQUN6QixRQUFJLGdCQUF3QjtBQUU1QixRQUFJLENBQUMsdUJBQXVCO0FBQzNCLFlBQU0scUJBQXNCLGlCQUFpQixLQUFLO0FBQ2xELFlBQU0sbUJBQW1CLEtBQUssSUFBSSxLQUFLLHlCQUF5QixLQUFLLHVCQUF1QixLQUFLLHdCQUF3QixDQUFDO0FBQzFILFlBQU0sVUFBVSxLQUFLLElBQUkscUJBQXFCLEdBQUcsZ0JBQWdCO0FBQ2pFLG1CQUFhLFVBQVUsS0FBSztBQUM1QixzQkFBZ0IsS0FBSyxJQUFJLEdBQUksVUFBVSxDQUFFLElBQUksS0FBSztBQUFBLElBQ25ELE9BQU87QUFDTixVQUFJLENBQUMsZUFBZTtBQUVuQixxQkFBYSxLQUFLO0FBQUEsTUFDbkI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxDQUFDLGVBQWU7QUFDbkIsVUFBSSxpQkFBaUIsV0FBVyxtQkFBbUIsVUFBVSxpQkFBaUIsV0FBVyxtQkFBbUIsUUFBUTtBQUVuSCx5QkFBaUIsS0FBSztBQUFBLE1BQ3ZCO0FBQUEsSUFDRDtBQUVBLGlCQUFhO0FBQ2IsZUFBVztBQUNYLFFBQUk7QUFFSixRQUFJLFVBQVUsWUFBWSxnQkFBZ0I7QUFFekMsVUFBSSxDQUFDLGtCQUFrQjtBQUV0QixlQUFPO0FBQUEsTUFDUjtBQUNBLHFCQUFlO0FBQUEsSUFDaEIsV0FBVyxpQkFBaUIsV0FBVyxtQkFBbUIsV0FBVyxpQkFBaUIsV0FBVyxtQkFBbUIsMEJBQTBCO0FBQzdJLFVBQUksaUJBQWlCLFdBQVcsbUJBQW1CLDRCQUE0QixrQkFBa0IsYUFBYSxXQUFXLGNBQWM7QUFFdEksdUJBQWU7QUFBQSxNQUNoQixPQUFPO0FBRU4sY0FBTSxrQkFBa0IsS0FBSyxJQUFJLElBQUksS0FBSyxhQUFhLGlCQUFpQixHQUFHO0FBRTNFLGNBQU0sbUJBQW1CLFlBQVk7QUFFckMsY0FBTSxlQUFlLFVBQVU7QUFDL0IsdUJBQWUsS0FBSyxJQUFJLGNBQWMsZ0JBQWdCO0FBQUEsTUFDdkQ7QUFBQSxJQUNELFdBQVcsaUJBQWlCLFdBQVcsbUJBQW1CLFVBQVUsaUJBQWlCLFdBQVcsbUJBQW1CLHlCQUF5QjtBQUMzSSxVQUFJLGlCQUFpQixXQUFXLG1CQUFtQiwyQkFBMkIsa0JBQWtCLGFBQWEsV0FBVyxjQUFjO0FBRXJJLHVCQUFlO0FBQUEsTUFDaEIsT0FBTztBQUVOLGNBQU0sY0FBYyxZQUFZLFdBQVc7QUFDM0MsdUJBQWUsS0FBSyxJQUFJLEdBQUcsYUFBYSxpQkFBaUIsQ0FBQztBQUFBLE1BQzNEO0FBQUEsSUFDRCxPQUFPO0FBQ04scUJBQWUsS0FBSyx5QkFBeUIsZ0JBQWdCLGNBQWMsV0FBVyxTQUFTLGlCQUFpQixXQUFXLG1CQUFtQixLQUFLLGlCQUFpQixXQUFXLG1CQUFtQixNQUFNO0FBQUEsSUFDek07QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsMkJBQTJCLHlCQUE4RztBQUVoSixVQUFNLFdBQVcsS0FBSyxTQUFTLFdBQVcsbUJBQW1CO0FBQzdELFVBQU0sYUFBYSxLQUFLLFNBQVMsY0FBYyxRQUFRLElBQUksYUFBYSxVQUFVO0FBQ2xGLFVBQU0saUJBQWlCLFNBQVM7QUFDaEMsVUFBTSxlQUFlLGlCQUFpQixTQUFTLFFBQVEsV0FBVztBQUVsRSxRQUFJLFlBQVksVUFBVTtBQUMxQixRQUFJLFVBQVU7QUFDZCxRQUFJLHdCQUF3QixTQUFTLFNBQVM7QUFDN0MsWUFBTSxnQkFBZ0IsS0FBSywyQkFBMkIsd0JBQXdCLFlBQVksd0JBQXdCLGFBQWEsd0JBQXdCLFNBQVM7QUFDaEssVUFBSSxDQUFDLGVBQWU7QUFDbkIsZUFBTztBQUFBLE1BQ1I7QUFDQSxpQkFBVyxnQkFBZ0IsY0FBYyxRQUFRO0FBQ2hELG9CQUFZLEtBQUssSUFBSSxXQUFXLEtBQUssTUFBTSxhQUFhLElBQUksQ0FBQztBQUM3RCxrQkFBVSxLQUFLLElBQUksU0FBUyxLQUFLLE1BQU0sYUFBYSxPQUFPLGFBQWEsS0FBSyxDQUFDO0FBQUEsTUFDL0U7QUFBQSxJQUNELE9BQU87QUFDTixpQkFBVyxhQUFhLHdCQUF3QixZQUFZO0FBQzNELFlBQUksVUFBVSxvQkFBb0IsVUFBVSxlQUFlO0FBQzFELGlCQUFPO0FBQUEsUUFDUjtBQUNBLGNBQU0sZ0JBQWdCLEtBQUssMkJBQTJCLFVBQVUsaUJBQWlCLFVBQVUsYUFBYSxVQUFVLFNBQVM7QUFDM0gsWUFBSSxDQUFDLGVBQWU7QUFDbkIsaUJBQU87QUFBQSxRQUNSO0FBQ0EsbUJBQVcsZ0JBQWdCLGNBQWMsUUFBUTtBQUNoRCxzQkFBWSxLQUFLLElBQUksV0FBVyxLQUFLLE1BQU0sYUFBYSxJQUFJLENBQUM7QUFDN0Qsb0JBQVUsS0FBSyxJQUFJLFNBQVMsS0FBSyxNQUFNLGFBQWEsT0FBTyxhQUFhLEtBQUssQ0FBQztBQUFBLFFBQy9FO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsd0JBQXdCLGVBQWU7QUFDM0Msa0JBQVksS0FBSyxJQUFJLEdBQUcsWUFBWSxXQUFVLG1CQUFtQjtBQUNqRSxpQkFBVyxLQUFLO0FBQUEsSUFDakI7QUFFQSxRQUFJLHdCQUF3QixTQUFTLGdCQUFnQixVQUFVLFlBQVksU0FBUyxPQUFPO0FBQzFGLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxnQkFBZ0IsS0FBSyx5QkFBeUIsZ0JBQWdCLGNBQWMsV0FBVyxPQUFPO0FBQ3BHLFdBQU87QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUFBLEVBRVEseUJBQXlCLGVBQXVCLGFBQXFCLFVBQWtCLFFBQWdCLGVBQXlCLGFBQStCO0FBQ3RLLG9CQUFnQixnQkFBZ0I7QUFDaEMsa0JBQWMsY0FBYztBQUM1QixlQUFXLFdBQVc7QUFDdEIsYUFBUyxTQUFTO0FBQ2xCLG9CQUFnQixDQUFDLENBQUM7QUFDbEIsa0JBQWMsQ0FBQyxDQUFDO0FBRWhCLFVBQU0saUJBQWlCLGNBQWM7QUFDckMsVUFBTSxZQUFZLFNBQVM7QUFFM0IsUUFBSSxZQUFZLGdCQUFnQjtBQUcvQixVQUFJLGVBQWU7QUFDbEIsZUFBTztBQUFBLE1BQ1I7QUFFQSxVQUFJLGFBQWE7QUFDaEIsZUFBTyxLQUFLLElBQUksR0FBRyxTQUFTLGNBQWM7QUFBQSxNQUMzQztBQUVBLFVBQUksV0FBVyxlQUFlO0FBRTdCLGVBQU87QUFBQSxNQUNSLFdBQVcsU0FBUyxhQUFhO0FBRWhDLGVBQU8sS0FBSyxJQUFJLEdBQUcsU0FBUyxjQUFjO0FBQUEsTUFDM0M7QUFBQSxJQUNELE9BQU87QUFHTixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFBQTtBQUFBO0FBQUE7QUEzdkJhLFdBSVksc0JBQXNCO0FBSnhDLElBQU0sWUFBTjsiLAogICJuYW1lcyI6IFtdCn0K
