import "./minimap.css";
import * as dom from "../../../../base/browser/dom.js";
import { createFastDomNode } from "../../../../base/browser/fastDomNode.js";
import { GlobalPointerMoveMonitor } from "../../../../base/browser/globalPointerMoveMonitor.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import * as strings from "../../../../base/common/strings.js";
import { RenderedLinesCollection } from "../../view/viewLayer.js";
import { PartFingerprint, PartFingerprints, ViewPart } from "../../view/viewPart.js";
import { RenderMinimap, EditorOption, MINIMAP_GUTTER_WIDTH, EditorLayoutInfoComputer } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { RGBA8 } from "../../../common/core/rgba.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { ColorId } from "../../../common/encodedTokenAttributes.js";
import { Constants } from "./minimapCharSheet.js";
import { MinimapTokensColorTracker } from "../../../common/viewModel/minimapTokensColorTracker.js";
import * as viewEvents from "../../../common/viewEvents.js";
import { ViewModelDecoration } from "../../../common/viewModel.js";
import { minimapSelection, minimapBackground, minimapForegroundOpacity, editorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { Selection } from "../../../common/core/selection.js";
import { EventType, Gesture } from "../../../../base/browser/touch.js";
import { MinimapCharRendererFactory } from "./minimapCharRendererFactory.js";
import { MinimapPosition, MinimapSectionHeaderStyle } from "../../../common/model.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { LRUCache } from "../../../../base/common/map.js";
import { DEFAULT_FONT_FAMILY } from "../../../../base/browser/fonts.js";
const POINTER_DRAG_RESET_DISTANCE = 140;
const GUTTER_DECORATION_WIDTH = 2;
class MinimapOptions {
  constructor(configuration, theme, tokensColorTracker) {
    const options = configuration.options;
    const pixelRatio = options.get(EditorOption.pixelRatio);
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const minimapLayout = layoutInfo.minimap;
    const fontInfo = options.get(EditorOption.fontInfo);
    const minimapOpts = options.get(EditorOption.minimap);
    this.renderMinimap = minimapLayout.renderMinimap;
    this.size = minimapOpts.size;
    this.minimapHeightIsEditorHeight = minimapLayout.minimapHeightIsEditorHeight;
    this.scrollBeyondLastLine = options.get(EditorOption.scrollBeyondLastLine);
    this.paddingTop = options.get(EditorOption.padding).top;
    this.paddingBottom = options.get(EditorOption.padding).bottom;
    this.showSlider = minimapOpts.showSlider;
    this.autohide = minimapOpts.autohide;
    this.pixelRatio = pixelRatio;
    this.typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
    this.lineHeight = options.get(EditorOption.lineHeight);
    this.minimapLeft = minimapLayout.minimapLeft;
    this.minimapWidth = minimapLayout.minimapWidth;
    this.minimapHeight = layoutInfo.height;
    this.canvasInnerWidth = minimapLayout.minimapCanvasInnerWidth;
    this.canvasInnerHeight = minimapLayout.minimapCanvasInnerHeight;
    this.canvasOuterWidth = minimapLayout.minimapCanvasOuterWidth;
    this.canvasOuterHeight = minimapLayout.minimapCanvasOuterHeight;
    this.isSampling = minimapLayout.minimapIsSampling;
    this.editorHeight = layoutInfo.height;
    this.fontScale = minimapLayout.minimapScale;
    this.minimapLineHeight = minimapLayout.minimapLineHeight;
    this.minimapCharWidth = Constants.BASE_CHAR_WIDTH * this.fontScale;
    this.sectionHeaderFontFamily = DEFAULT_FONT_FAMILY;
    this.sectionHeaderFontSize = minimapOpts.sectionHeaderFontSize * pixelRatio;
    this.sectionHeaderLetterSpacing = minimapOpts.sectionHeaderLetterSpacing;
    this.sectionHeaderFontColor = MinimapOptions._getSectionHeaderColor(theme, tokensColorTracker.getColor(ColorId.DefaultForeground));
    this.charRenderer = createSingleCallFunction(() => MinimapCharRendererFactory.create(this.fontScale, fontInfo.fontFamily));
    this.defaultBackgroundColor = tokensColorTracker.getColor(ColorId.DefaultBackground);
    this.backgroundColor = MinimapOptions._getMinimapBackground(theme, this.defaultBackgroundColor);
    this.foregroundAlpha = MinimapOptions._getMinimapForegroundOpacity(theme);
  }
  static _getMinimapBackground(theme, defaultBackgroundColor) {
    const themeColor = theme.getColor(minimapBackground);
    if (themeColor) {
      return new RGBA8(themeColor.rgba.r, themeColor.rgba.g, themeColor.rgba.b, Math.round(255 * themeColor.rgba.a));
    }
    return defaultBackgroundColor;
  }
  static _getMinimapForegroundOpacity(theme) {
    const themeColor = theme.getColor(minimapForegroundOpacity);
    if (themeColor) {
      return RGBA8._clamp(Math.round(255 * themeColor.rgba.a));
    }
    return 255;
  }
  static _getSectionHeaderColor(theme, defaultForegroundColor) {
    const themeColor = theme.getColor(editorForeground);
    if (themeColor) {
      return new RGBA8(themeColor.rgba.r, themeColor.rgba.g, themeColor.rgba.b, Math.round(255 * themeColor.rgba.a));
    }
    return defaultForegroundColor;
  }
  equals(other) {
    return this.renderMinimap === other.renderMinimap && this.size === other.size && this.minimapHeightIsEditorHeight === other.minimapHeightIsEditorHeight && this.scrollBeyondLastLine === other.scrollBeyondLastLine && this.paddingTop === other.paddingTop && this.paddingBottom === other.paddingBottom && this.showSlider === other.showSlider && this.autohide === other.autohide && this.pixelRatio === other.pixelRatio && this.typicalHalfwidthCharacterWidth === other.typicalHalfwidthCharacterWidth && this.lineHeight === other.lineHeight && this.minimapLeft === other.minimapLeft && this.minimapWidth === other.minimapWidth && this.minimapHeight === other.minimapHeight && this.canvasInnerWidth === other.canvasInnerWidth && this.canvasInnerHeight === other.canvasInnerHeight && this.canvasOuterWidth === other.canvasOuterWidth && this.canvasOuterHeight === other.canvasOuterHeight && this.isSampling === other.isSampling && this.editorHeight === other.editorHeight && this.fontScale === other.fontScale && this.minimapLineHeight === other.minimapLineHeight && this.minimapCharWidth === other.minimapCharWidth && this.sectionHeaderFontSize === other.sectionHeaderFontSize && this.sectionHeaderLetterSpacing === other.sectionHeaderLetterSpacing && this.defaultBackgroundColor && this.defaultBackgroundColor.equals(other.defaultBackgroundColor) && this.backgroundColor && this.backgroundColor.equals(other.backgroundColor) && this.foregroundAlpha === other.foregroundAlpha;
  }
}
class MinimapLayout {
  constructor(scrollTop, scrollHeight, sliderNeeded, _computedSliderRatio, sliderTop, sliderHeight, topPaddingLineCount, startLineNumber, endLineNumber) {
    this.scrollTop = scrollTop;
    this.scrollHeight = scrollHeight;
    this.sliderNeeded = sliderNeeded;
    this._computedSliderRatio = _computedSliderRatio;
    this.sliderTop = sliderTop;
    this.sliderHeight = sliderHeight;
    this.topPaddingLineCount = topPaddingLineCount;
    this.startLineNumber = startLineNumber;
    this.endLineNumber = endLineNumber;
  }
  /**
   * Compute a desired `scrollPosition` such that the slider moves by `delta`.
   */
  getDesiredScrollTopFromDelta(delta) {
    return Math.round(this.scrollTop + delta / this._computedSliderRatio);
  }
  getDesiredScrollTopFromTouchLocation(pageY) {
    return Math.round((pageY - this.sliderHeight / 2) / this._computedSliderRatio);
  }
  /**
   * Intersect a line range with `this.startLineNumber` and `this.endLineNumber`.
   */
  intersectWithViewport(range) {
    const startLineNumber = Math.max(this.startLineNumber, range.startLineNumber);
    const endLineNumber = Math.min(this.endLineNumber, range.endLineNumber);
    if (startLineNumber > endLineNumber) {
      return null;
    }
    return [startLineNumber, endLineNumber];
  }
  /**
   * Get the inner minimap y coordinate for a line number.
   */
  getYForLineNumber(lineNumber, minimapLineHeight) {
    return +(lineNumber - this.startLineNumber + this.topPaddingLineCount) * minimapLineHeight;
  }
  static create(options, viewportStartLineNumber, viewportEndLineNumber, viewportStartLineNumberVerticalOffset, viewportHeight, viewportContainsWhitespaceGaps, lineCount, realLineCount, scrollTop, scrollHeight, previousLayout) {
    const pixelRatio = options.pixelRatio;
    const minimapLineHeight = options.minimapLineHeight;
    const minimapLinesFitting = Math.floor(options.canvasInnerHeight / minimapLineHeight);
    const lineHeight = options.lineHeight;
    if (options.minimapHeightIsEditorHeight) {
      let logicalScrollHeight = realLineCount * options.lineHeight + options.paddingTop + options.paddingBottom;
      if (options.scrollBeyondLastLine) {
        logicalScrollHeight += Math.max(0, viewportHeight - options.lineHeight - options.paddingBottom);
      }
      const sliderHeight2 = Math.max(1, Math.floor(viewportHeight * viewportHeight / logicalScrollHeight));
      const maxMinimapSliderTop2 = Math.max(0, options.minimapHeight - sliderHeight2);
      const computedSliderRatio2 = maxMinimapSliderTop2 / (scrollHeight - viewportHeight);
      const sliderTop2 = scrollTop * computedSliderRatio2;
      const sliderNeeded = maxMinimapSliderTop2 > 0;
      const maxLinesFitting = Math.floor(options.canvasInnerHeight / options.minimapLineHeight);
      const topPaddingLineCount = Math.floor(options.paddingTop / options.lineHeight);
      return new MinimapLayout(scrollTop, scrollHeight, sliderNeeded, computedSliderRatio2, sliderTop2, sliderHeight2, topPaddingLineCount, 1, Math.min(lineCount, maxLinesFitting));
    }
    let sliderHeight;
    if (viewportContainsWhitespaceGaps && viewportEndLineNumber !== lineCount) {
      const viewportLineCount = viewportEndLineNumber - viewportStartLineNumber + 1;
      sliderHeight = Math.floor(viewportLineCount * minimapLineHeight / pixelRatio);
    } else {
      const expectedViewportLineCount = viewportHeight / lineHeight;
      sliderHeight = Math.floor(expectedViewportLineCount * minimapLineHeight / pixelRatio);
    }
    const extraLinesAtTheTop = Math.floor(options.paddingTop / lineHeight);
    let extraLinesAtTheBottom = Math.floor(options.paddingBottom / lineHeight);
    if (options.scrollBeyondLastLine) {
      const expectedViewportLineCount = viewportHeight / lineHeight;
      extraLinesAtTheBottom = Math.max(extraLinesAtTheBottom, expectedViewportLineCount - 1);
    }
    let maxMinimapSliderTop;
    if (extraLinesAtTheBottom > 0) {
      const expectedViewportLineCount = viewportHeight / lineHeight;
      maxMinimapSliderTop = (extraLinesAtTheTop + lineCount + extraLinesAtTheBottom - expectedViewportLineCount - 1) * minimapLineHeight / pixelRatio;
    } else {
      maxMinimapSliderTop = Math.max(0, (extraLinesAtTheTop + lineCount) * minimapLineHeight / pixelRatio - sliderHeight);
    }
    maxMinimapSliderTop = Math.min(options.minimapHeight - sliderHeight, maxMinimapSliderTop);
    const computedSliderRatio = maxMinimapSliderTop / (scrollHeight - viewportHeight);
    const sliderTop = scrollTop * computedSliderRatio;
    if (minimapLinesFitting >= extraLinesAtTheTop + lineCount + extraLinesAtTheBottom) {
      const sliderNeeded = maxMinimapSliderTop > 0;
      return new MinimapLayout(scrollTop, scrollHeight, sliderNeeded, computedSliderRatio, sliderTop, sliderHeight, extraLinesAtTheTop, 1, lineCount);
    } else {
      let consideringStartLineNumber;
      if (viewportStartLineNumber > 1) {
        consideringStartLineNumber = viewportStartLineNumber + extraLinesAtTheTop;
      } else {
        consideringStartLineNumber = Math.max(1, scrollTop / lineHeight);
      }
      let topPaddingLineCount;
      let startLineNumber = Math.max(1, Math.floor(consideringStartLineNumber - sliderTop * pixelRatio / minimapLineHeight));
      if (startLineNumber < extraLinesAtTheTop) {
        topPaddingLineCount = extraLinesAtTheTop - startLineNumber + 1;
        startLineNumber = 1;
      } else {
        topPaddingLineCount = 0;
        startLineNumber = Math.max(1, startLineNumber - extraLinesAtTheTop);
      }
      if (previousLayout && previousLayout.scrollHeight === scrollHeight) {
        if (previousLayout.scrollTop > scrollTop) {
          startLineNumber = Math.min(startLineNumber, previousLayout.startLineNumber);
          topPaddingLineCount = Math.max(topPaddingLineCount, previousLayout.topPaddingLineCount);
        }
        if (previousLayout.scrollTop < scrollTop) {
          startLineNumber = Math.max(startLineNumber, previousLayout.startLineNumber);
          topPaddingLineCount = Math.min(topPaddingLineCount, previousLayout.topPaddingLineCount);
        }
      }
      const endLineNumber = Math.min(lineCount, startLineNumber - topPaddingLineCount + minimapLinesFitting - 1);
      const partialLine = (scrollTop - viewportStartLineNumberVerticalOffset) / lineHeight;
      let sliderTopAligned;
      if (scrollTop >= options.paddingTop) {
        sliderTopAligned = (viewportStartLineNumber - startLineNumber + topPaddingLineCount + partialLine) * minimapLineHeight / pixelRatio;
      } else {
        sliderTopAligned = scrollTop / options.paddingTop * (topPaddingLineCount + partialLine) * minimapLineHeight / pixelRatio;
      }
      return new MinimapLayout(scrollTop, scrollHeight, true, computedSliderRatio, sliderTopAligned, sliderHeight, topPaddingLineCount, startLineNumber, endLineNumber);
    }
  }
}
const _MinimapLine = class _MinimapLine {
  constructor(dy) {
    this.dy = dy;
  }
  onContentChanged() {
    this.dy = -1;
  }
  onTokensChanged() {
    this.dy = -1;
  }
};
_MinimapLine.INVALID = new _MinimapLine(-1);
let MinimapLine = _MinimapLine;
class RenderData {
  constructor(renderedLayout, imageData, lines) {
    this.renderedLayout = renderedLayout;
    this._imageData = imageData;
    this._renderedLines = new RenderedLinesCollection({
      createLine: () => MinimapLine.INVALID
    });
    this._renderedLines._set(renderedLayout.startLineNumber, lines);
  }
  /**
   * Check if the current RenderData matches accurately the new desired layout and no painting is needed.
   */
  linesEquals(layout) {
    if (!this.scrollEquals(layout)) {
      return false;
    }
    const tmp = this._renderedLines._get();
    const lines = tmp.lines;
    for (let i = 0, len = lines.length; i < len; i++) {
      if (lines[i].dy === -1) {
        return false;
      }
    }
    return true;
  }
  /**
   * Check if the current RenderData matches the new layout's scroll position
   */
  scrollEquals(layout) {
    return this.renderedLayout.startLineNumber === layout.startLineNumber && this.renderedLayout.endLineNumber === layout.endLineNumber;
  }
  _get() {
    const tmp = this._renderedLines._get();
    return {
      imageData: this._imageData,
      rendLineNumberStart: tmp.rendLineNumberStart,
      lines: tmp.lines
    };
  }
  onLinesChanged(changeFromLineNumber, changeCount) {
    return this._renderedLines.onLinesChanged(changeFromLineNumber, changeCount);
  }
  onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
    this._renderedLines.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
  }
  onLinesInserted(insertFromLineNumber, insertToLineNumber) {
    this._renderedLines.onLinesInserted(insertFromLineNumber, insertToLineNumber);
  }
  onTokensChanged(ranges) {
    return this._renderedLines.onTokensChanged(ranges);
  }
}
class MinimapBuffers {
  constructor(ctx, WIDTH, HEIGHT, background) {
    this._backgroundFillData = MinimapBuffers._createBackgroundFillData(WIDTH, HEIGHT, background);
    this._buffers = [
      ctx.createImageData(WIDTH, HEIGHT),
      ctx.createImageData(WIDTH, HEIGHT)
    ];
    this._lastUsedBuffer = 0;
  }
  getBuffer() {
    this._lastUsedBuffer = 1 - this._lastUsedBuffer;
    const result = this._buffers[this._lastUsedBuffer];
    result.data.set(this._backgroundFillData);
    return result;
  }
  static _createBackgroundFillData(WIDTH, HEIGHT, background) {
    const backgroundR = background.r;
    const backgroundG = background.g;
    const backgroundB = background.b;
    const backgroundA = background.a;
    const result = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    let offset = 0;
    for (let i = 0; i < HEIGHT; i++) {
      for (let j = 0; j < WIDTH; j++) {
        result[offset] = backgroundR;
        result[offset + 1] = backgroundG;
        result[offset + 2] = backgroundB;
        result[offset + 3] = backgroundA;
        offset += 4;
      }
    }
    return result;
  }
}
class MinimapSamplingState {
  constructor(samplingRatio, minimapLines) {
    this.samplingRatio = samplingRatio;
    this.minimapLines = minimapLines;
  }
  static compute(options, viewLineCount, oldSamplingState) {
    if (options.renderMinimap === RenderMinimap.None || !options.isSampling) {
      return [null, []];
    }
    const { minimapLineCount } = EditorLayoutInfoComputer.computeContainedMinimapLineCount({
      viewLineCount,
      scrollBeyondLastLine: options.scrollBeyondLastLine,
      paddingTop: options.paddingTop,
      paddingBottom: options.paddingBottom,
      height: options.editorHeight,
      lineHeight: options.lineHeight,
      pixelRatio: options.pixelRatio
    });
    const ratio = viewLineCount / minimapLineCount;
    const halfRatio = ratio / 2;
    if (!oldSamplingState || oldSamplingState.minimapLines.length === 0) {
      const result2 = [];
      result2[0] = 1;
      if (minimapLineCount > 1) {
        for (let i = 0, lastIndex = minimapLineCount - 1; i < lastIndex; i++) {
          result2[i] = Math.round(i * ratio + halfRatio);
        }
        result2[minimapLineCount - 1] = viewLineCount;
      }
      return [new MinimapSamplingState(ratio, result2), []];
    }
    const oldMinimapLines = oldSamplingState.minimapLines;
    const oldLength = oldMinimapLines.length;
    const result = [];
    let oldIndex = 0;
    let oldDeltaLineCount = 0;
    let minViewLineNumber = 1;
    const MAX_EVENT_COUNT = 10;
    let events = [];
    let lastEvent = null;
    for (let i = 0; i < minimapLineCount; i++) {
      const fromViewLineNumber = Math.max(minViewLineNumber, Math.round(i * ratio));
      const toViewLineNumber = Math.max(fromViewLineNumber, Math.round((i + 1) * ratio));
      while (oldIndex < oldLength && oldMinimapLines[oldIndex] < fromViewLineNumber) {
        if (events.length < MAX_EVENT_COUNT) {
          const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
          if (lastEvent && lastEvent.type === "deleted" && lastEvent._oldIndex === oldIndex - 1) {
            lastEvent.deleteToLineNumber++;
          } else {
            lastEvent = { type: "deleted", _oldIndex: oldIndex, deleteFromLineNumber: oldMinimapLineNumber, deleteToLineNumber: oldMinimapLineNumber };
            events.push(lastEvent);
          }
          oldDeltaLineCount--;
        }
        oldIndex++;
      }
      let selectedViewLineNumber;
      if (oldIndex < oldLength && oldMinimapLines[oldIndex] <= toViewLineNumber) {
        selectedViewLineNumber = oldMinimapLines[oldIndex];
        oldIndex++;
      } else {
        if (i === 0) {
          selectedViewLineNumber = 1;
        } else if (i + 1 === minimapLineCount) {
          selectedViewLineNumber = viewLineCount;
        } else {
          selectedViewLineNumber = Math.round(i * ratio + halfRatio);
        }
        if (events.length < MAX_EVENT_COUNT) {
          const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
          if (lastEvent && lastEvent.type === "inserted" && lastEvent._i === i - 1) {
            lastEvent.insertToLineNumber++;
          } else {
            lastEvent = { type: "inserted", _i: i, insertFromLineNumber: oldMinimapLineNumber, insertToLineNumber: oldMinimapLineNumber };
            events.push(lastEvent);
          }
          oldDeltaLineCount++;
        }
      }
      result[i] = selectedViewLineNumber;
      minViewLineNumber = selectedViewLineNumber;
    }
    if (events.length < MAX_EVENT_COUNT) {
      while (oldIndex < oldLength) {
        const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
        if (lastEvent && lastEvent.type === "deleted" && lastEvent._oldIndex === oldIndex - 1) {
          lastEvent.deleteToLineNumber++;
        } else {
          lastEvent = { type: "deleted", _oldIndex: oldIndex, deleteFromLineNumber: oldMinimapLineNumber, deleteToLineNumber: oldMinimapLineNumber };
          events.push(lastEvent);
        }
        oldDeltaLineCount--;
        oldIndex++;
      }
    } else {
      events = [{ type: "flush" }];
    }
    return [new MinimapSamplingState(ratio, result), events];
  }
  modelLineToMinimapLine(lineNumber) {
    return Math.min(this.minimapLines.length, Math.max(1, Math.round(lineNumber / this.samplingRatio)));
  }
  /**
   * Will return null if the model line ranges are not intersecting with a sampled model line.
   */
  modelLineRangeToMinimapLineRange(fromLineNumber, toLineNumber) {
    let fromLineIndex = this.modelLineToMinimapLine(fromLineNumber) - 1;
    while (fromLineIndex > 0 && this.minimapLines[fromLineIndex - 1] >= fromLineNumber) {
      fromLineIndex--;
    }
    let toLineIndex = this.modelLineToMinimapLine(toLineNumber) - 1;
    while (toLineIndex + 1 < this.minimapLines.length && this.minimapLines[toLineIndex + 1] <= toLineNumber) {
      toLineIndex++;
    }
    if (fromLineIndex === toLineIndex) {
      const sampledLineNumber = this.minimapLines[fromLineIndex];
      if (sampledLineNumber < fromLineNumber || sampledLineNumber > toLineNumber) {
        return null;
      }
    }
    return [fromLineIndex + 1, toLineIndex + 1];
  }
  /**
   * Will always return a range, even if it is not intersecting with a sampled model line.
   */
  decorationLineRangeToMinimapLineRange(startLineNumber, endLineNumber) {
    let minimapLineStart = this.modelLineToMinimapLine(startLineNumber);
    let minimapLineEnd = this.modelLineToMinimapLine(endLineNumber);
    if (startLineNumber !== endLineNumber && minimapLineEnd === minimapLineStart) {
      if (minimapLineEnd === this.minimapLines.length) {
        if (minimapLineStart > 1) {
          minimapLineStart--;
        }
      } else {
        minimapLineEnd++;
      }
    }
    return [minimapLineStart, minimapLineEnd];
  }
  onLinesDeleted(e) {
    const deletedLineCount = e.toLineNumber - e.fromLineNumber + 1;
    let changeStartIndex = this.minimapLines.length;
    let changeEndIndex = 0;
    for (let i = this.minimapLines.length - 1; i >= 0; i--) {
      if (this.minimapLines[i] < e.fromLineNumber) {
        break;
      }
      if (this.minimapLines[i] <= e.toLineNumber) {
        this.minimapLines[i] = Math.max(1, e.fromLineNumber - 1);
        changeStartIndex = Math.min(changeStartIndex, i);
        changeEndIndex = Math.max(changeEndIndex, i);
      } else {
        this.minimapLines[i] -= deletedLineCount;
      }
    }
    return [changeStartIndex, changeEndIndex];
  }
  onLinesInserted(e) {
    const insertedLineCount = e.toLineNumber - e.fromLineNumber + 1;
    for (let i = this.minimapLines.length - 1; i >= 0; i--) {
      if (this.minimapLines[i] < e.fromLineNumber) {
        break;
      }
      this.minimapLines[i] += insertedLineCount;
    }
  }
}
class Minimap extends ViewPart {
  constructor(context) {
    super(context);
    this._sectionHeaderCache = new LRUCache(10, 1.5);
    this.tokensColorTracker = MinimapTokensColorTracker.getInstance();
    this._selections = [];
    this._minimapSelections = null;
    this.options = new MinimapOptions(this._context.configuration, this._context.theme, this.tokensColorTracker);
    const [samplingState] = MinimapSamplingState.compute(this.options, this._context.viewModel.getLineCount(), null);
    this._samplingState = samplingState;
    this._shouldCheckSampling = false;
    this._actual = new InnerMinimap(context.theme, this);
  }
  dispose() {
    this._actual.dispose();
    super.dispose();
  }
  getDomNode() {
    return this._actual.getDomNode();
  }
  _onOptionsMaybeChanged() {
    const opts = new MinimapOptions(this._context.configuration, this._context.theme, this.tokensColorTracker);
    if (this.options.equals(opts)) {
      return false;
    }
    this.options = opts;
    this._recreateLineSampling();
    this._actual.onDidChangeOptions();
    return true;
  }
  // ---- begin view event handlers
  onConfigurationChanged(e) {
    return this._onOptionsMaybeChanged();
  }
  onCursorStateChanged(e) {
    this._selections = e.selections;
    this._minimapSelections = null;
    return this._actual.onSelectionChanged();
  }
  onDecorationsChanged(e) {
    if (e.affectsMinimap) {
      return this._actual.onDecorationsChanged();
    }
    return false;
  }
  onFlushed(e) {
    if (this._samplingState) {
      this._shouldCheckSampling = true;
    }
    return this._actual.onFlushed();
  }
  onLinesChanged(e) {
    if (this._samplingState) {
      const minimapLineRange = this._samplingState.modelLineRangeToMinimapLineRange(e.fromLineNumber, e.fromLineNumber + e.count - 1);
      if (minimapLineRange) {
        return this._actual.onLinesChanged(minimapLineRange[0], minimapLineRange[1] - minimapLineRange[0] + 1);
      } else {
        return false;
      }
    } else {
      return this._actual.onLinesChanged(e.fromLineNumber, e.count);
    }
  }
  onLinesDeleted(e) {
    if (this._samplingState) {
      const [changeStartIndex, changeEndIndex] = this._samplingState.onLinesDeleted(e);
      if (changeStartIndex <= changeEndIndex) {
        this._actual.onLinesChanged(changeStartIndex + 1, changeEndIndex - changeStartIndex + 1);
      }
      this._shouldCheckSampling = true;
      return true;
    } else {
      return this._actual.onLinesDeleted(e.fromLineNumber, e.toLineNumber);
    }
  }
  onLinesInserted(e) {
    if (this._samplingState) {
      this._samplingState.onLinesInserted(e);
      this._shouldCheckSampling = true;
      return true;
    } else {
      return this._actual.onLinesInserted(e.fromLineNumber, e.toLineNumber);
    }
  }
  onScrollChanged(e) {
    return this._actual.onScrollChanged();
  }
  onThemeChanged(e) {
    this._actual.onThemeChanged();
    this._onOptionsMaybeChanged();
    return true;
  }
  onTokensChanged(e) {
    if (this._samplingState) {
      const ranges = [];
      for (const range of e.ranges) {
        const minimapLineRange = this._samplingState.modelLineRangeToMinimapLineRange(range.fromLineNumber, range.toLineNumber);
        if (minimapLineRange) {
          ranges.push({ fromLineNumber: minimapLineRange[0], toLineNumber: minimapLineRange[1] });
        }
      }
      if (ranges.length) {
        return this._actual.onTokensChanged(ranges);
      } else {
        return false;
      }
    } else {
      return this._actual.onTokensChanged(e.ranges);
    }
  }
  onTokensColorsChanged(e) {
    this._onOptionsMaybeChanged();
    return this._actual.onTokensColorsChanged();
  }
  onZonesChanged(e) {
    return this._actual.onZonesChanged();
  }
  // --- end event handlers
  prepareRender(ctx) {
    if (this._shouldCheckSampling) {
      this._shouldCheckSampling = false;
      this._recreateLineSampling();
    }
  }
  render(ctx) {
    let viewportStartLineNumber = ctx.visibleRange.startLineNumber;
    let viewportEndLineNumber = ctx.visibleRange.endLineNumber;
    if (this._samplingState) {
      viewportStartLineNumber = this._samplingState.modelLineToMinimapLine(viewportStartLineNumber);
      viewportEndLineNumber = this._samplingState.modelLineToMinimapLine(viewportEndLineNumber);
    }
    const minimapCtx = {
      viewportContainsWhitespaceGaps: ctx.viewportData.whitespaceViewportData.length > 0,
      scrollWidth: ctx.scrollWidth,
      scrollHeight: ctx.scrollHeight,
      viewportStartLineNumber,
      viewportEndLineNumber,
      viewportStartLineNumberVerticalOffset: ctx.getVerticalOffsetForLineNumber(viewportStartLineNumber),
      scrollTop: ctx.scrollTop,
      scrollLeft: ctx.scrollLeft,
      viewportWidth: ctx.viewportWidth,
      viewportHeight: ctx.viewportHeight
    };
    this._actual.render(minimapCtx);
  }
  //#region IMinimapModel
  _recreateLineSampling() {
    this._minimapSelections = null;
    const wasSampling = Boolean(this._samplingState);
    const [samplingState, events] = MinimapSamplingState.compute(this.options, this._context.viewModel.getLineCount(), this._samplingState);
    this._samplingState = samplingState;
    if (wasSampling && this._samplingState) {
      for (const event of events) {
        switch (event.type) {
          case "deleted":
            this._actual.onLinesDeleted(event.deleteFromLineNumber, event.deleteToLineNumber);
            break;
          case "inserted":
            this._actual.onLinesInserted(event.insertFromLineNumber, event.insertToLineNumber);
            break;
          case "flush":
            this._actual.onFlushed();
            break;
        }
      }
    }
  }
  getLineCount() {
    if (this._samplingState) {
      return this._samplingState.minimapLines.length;
    }
    return this._context.viewModel.getLineCount();
  }
  getRealLineCount() {
    return this._context.viewModel.getLineCount();
  }
  getLineContent(lineNumber) {
    if (this._samplingState) {
      return this._context.viewModel.getLineContent(this._samplingState.minimapLines[lineNumber - 1]);
    }
    return this._context.viewModel.getLineContent(lineNumber);
  }
  getLineMaxColumn(lineNumber) {
    if (this._samplingState) {
      return this._context.viewModel.getLineMaxColumn(this._samplingState.minimapLines[lineNumber - 1]);
    }
    return this._context.viewModel.getLineMaxColumn(lineNumber);
  }
  getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed) {
    if (this._samplingState) {
      const result = [];
      for (let lineIndex = 0, lineCount = endLineNumber - startLineNumber + 1; lineIndex < lineCount; lineIndex++) {
        if (needed[lineIndex]) {
          result[lineIndex] = this._context.viewModel.getViewLineData(this._samplingState.minimapLines[startLineNumber + lineIndex - 1]);
        } else {
          result[lineIndex] = null;
        }
      }
      return result;
    }
    return this._context.viewModel.getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed).data;
  }
  getSelections() {
    if (this._minimapSelections === null) {
      if (this._samplingState) {
        this._minimapSelections = [];
        for (const selection of this._selections) {
          const [minimapLineStart, minimapLineEnd] = this._samplingState.decorationLineRangeToMinimapLineRange(selection.startLineNumber, selection.endLineNumber);
          this._minimapSelections.push(new Selection(minimapLineStart, selection.startColumn, minimapLineEnd, selection.endColumn));
        }
      } else {
        this._minimapSelections = this._selections;
      }
    }
    return this._minimapSelections;
  }
  getMinimapDecorationsInViewport(startLineNumber, endLineNumber) {
    return this._getMinimapDecorationsInViewport(startLineNumber, endLineNumber).filter((decoration) => !decoration.options.minimap?.sectionHeaderStyle);
  }
  getSectionHeaderDecorationsInViewport(startLineNumber, endLineNumber) {
    const headerHeightInMinimapLines = this.options.sectionHeaderFontSize / this.options.minimapLineHeight;
    startLineNumber = Math.floor(Math.max(1, startLineNumber - headerHeightInMinimapLines));
    return this._getMinimapDecorationsInViewport(startLineNumber, endLineNumber).filter((decoration) => !!decoration.options.minimap?.sectionHeaderStyle);
  }
  _getMinimapDecorationsInViewport(startLineNumber, endLineNumber) {
    let visibleRange;
    if (this._samplingState) {
      const modelStartLineNumber = this._samplingState.minimapLines[startLineNumber - 1];
      const modelEndLineNumber = this._samplingState.minimapLines[endLineNumber - 1];
      visibleRange = new Range(modelStartLineNumber, 1, modelEndLineNumber, this._context.viewModel.getLineMaxColumn(modelEndLineNumber));
    } else {
      visibleRange = new Range(startLineNumber, 1, endLineNumber, this._context.viewModel.getLineMaxColumn(endLineNumber));
    }
    const decorations = this._context.viewModel.getMinimapDecorationsInRange(visibleRange);
    if (this._samplingState) {
      const result = [];
      for (const decoration of decorations) {
        if (!decoration.options.minimap) {
          continue;
        }
        const range = decoration.range;
        const minimapStartLineNumber = this._samplingState.modelLineToMinimapLine(range.startLineNumber);
        const minimapEndLineNumber = this._samplingState.modelLineToMinimapLine(range.endLineNumber);
        result.push(new ViewModelDecoration(new Range(minimapStartLineNumber, range.startColumn, minimapEndLineNumber, range.endColumn), decoration.options));
      }
      return result;
    }
    return decorations;
  }
  getSectionHeaderText(decoration, fitWidth) {
    const headerText = decoration.options.minimap?.sectionHeaderText;
    if (!headerText) {
      return null;
    }
    const cachedText = this._sectionHeaderCache.get(headerText);
    if (cachedText) {
      return cachedText;
    }
    const fittedText = fitWidth(headerText);
    this._sectionHeaderCache.set(headerText, fittedText);
    return fittedText;
  }
  getOptions() {
    return this._context.viewModel.model.getOptions();
  }
  revealLineNumber(lineNumber) {
    if (this._samplingState) {
      lineNumber = this._samplingState.minimapLines[lineNumber - 1];
    }
    this._context.viewModel.revealRange(
      "mouse",
      false,
      new Range(lineNumber, 1, lineNumber, 1),
      viewEvents.VerticalRevealType.Center,
      ScrollType.Smooth
    );
  }
  setScrollTop(scrollTop) {
    this._context.viewModel.viewLayout.setScrollPosition({
      scrollTop
    }, ScrollType.Immediate);
  }
  //#endregion
}
class InnerMinimap extends Disposable {
  constructor(theme, model) {
    super();
    this._renderDecorations = false;
    this._gestureInProgress = false;
    this._theme = theme;
    this._model = model;
    this._lastRenderData = null;
    this._buffers = null;
    this._selectionColor = this._theme.getColor(minimapSelection);
    this._domNode = createFastDomNode(document.createElement("div"));
    PartFingerprints.write(this._domNode, PartFingerprint.Minimap);
    this._domNode.setClassName(this._getMinimapDomNodeClassName());
    this._domNode.setPosition("absolute");
    this._domNode.setAttribute("role", "presentation");
    this._domNode.setAttribute("aria-hidden", "true");
    this._shadow = createFastDomNode(document.createElement("div"));
    this._shadow.setClassName("minimap-shadow-hidden");
    this._domNode.appendChild(this._shadow);
    this._canvas = createFastDomNode(document.createElement("canvas"));
    this._canvas.setPosition("absolute");
    this._canvas.setLeft(0);
    this._domNode.appendChild(this._canvas);
    this._decorationsCanvas = createFastDomNode(document.createElement("canvas"));
    this._decorationsCanvas.setPosition("absolute");
    this._decorationsCanvas.setClassName("minimap-decorations-layer");
    this._decorationsCanvas.setLeft(0);
    this._domNode.appendChild(this._decorationsCanvas);
    this._slider = createFastDomNode(document.createElement("div"));
    this._slider.setPosition("absolute");
    this._slider.setClassName("minimap-slider");
    this._slider.setLayerHinting(true);
    this._slider.setContain("strict");
    this._domNode.appendChild(this._slider);
    this._sliderHorizontal = createFastDomNode(document.createElement("div"));
    this._sliderHorizontal.setPosition("absolute");
    this._sliderHorizontal.setClassName("minimap-slider-horizontal");
    this._slider.appendChild(this._sliderHorizontal);
    this._applyLayout();
    this._pointerDownListener = dom.addStandardDisposableListener(this._domNode.domNode, dom.EventType.POINTER_DOWN, (e) => {
      e.preventDefault();
      const renderMinimap = this._model.options.renderMinimap;
      if (renderMinimap === RenderMinimap.None) {
        return;
      }
      if (!this._lastRenderData) {
        return;
      }
      if (this._model.options.size !== "proportional") {
        if (e.button === 0 && this._lastRenderData) {
          const position = dom.getDomNodePagePosition(this._slider.domNode);
          const initialPosY = position.top + position.height / 2;
          this._startSliderDragging(e, initialPosY, this._lastRenderData.renderedLayout);
        }
        return;
      }
      const minimapLineHeight = this._model.options.minimapLineHeight;
      const internalOffsetY = this._model.options.canvasInnerHeight / this._model.options.canvasOuterHeight * e.offsetY;
      const lineIndex = Math.floor(internalOffsetY / minimapLineHeight);
      let lineNumber = lineIndex + this._lastRenderData.renderedLayout.startLineNumber - this._lastRenderData.renderedLayout.topPaddingLineCount;
      lineNumber = Math.min(lineNumber, this._model.getLineCount());
      this._model.revealLineNumber(lineNumber);
    });
    this._sliderPointerMoveMonitor = new GlobalPointerMoveMonitor();
    this._sliderPointerDownListener = dom.addStandardDisposableListener(this._slider.domNode, dom.EventType.POINTER_DOWN, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 0 && this._lastRenderData) {
        this._startSliderDragging(e, e.pageY, this._lastRenderData.renderedLayout);
      }
    });
    this._gestureDisposable = Gesture.addTarget(this._domNode.domNode);
    this._sliderTouchStartListener = dom.addDisposableListener(this._domNode.domNode, EventType.Start, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._lastRenderData) {
        this._slider.toggleClassName("active", true);
        this._gestureInProgress = true;
        this.scrollDueToTouchEvent(e);
      }
    }, { passive: false });
    this._sliderTouchMoveListener = dom.addDisposableListener(this._domNode.domNode, EventType.Change, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._lastRenderData && this._gestureInProgress) {
        this.scrollDueToTouchEvent(e);
      }
    }, { passive: false });
    this._sliderTouchEndListener = dom.addStandardDisposableListener(this._domNode.domNode, EventType.End, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._gestureInProgress = false;
      this._slider.toggleClassName("active", false);
    });
  }
  _startSliderDragging(e, initialPosY, initialSliderState) {
    if (!e.target || !(e.target instanceof Element)) {
      return;
    }
    const initialPosX = e.pageX;
    this._slider.toggleClassName("active", true);
    const handlePointerMove = (posy, posx) => {
      const minimapPosition = dom.getDomNodePagePosition(this._domNode.domNode);
      const pointerOrthogonalDelta = Math.min(
        Math.abs(posx - initialPosX),
        Math.abs(posx - minimapPosition.left),
        Math.abs(posx - minimapPosition.left - minimapPosition.width)
      );
      if (platform.isWindows && pointerOrthogonalDelta > POINTER_DRAG_RESET_DISTANCE) {
        this._model.setScrollTop(initialSliderState.scrollTop);
        return;
      }
      const pointerDelta = posy - initialPosY;
      this._model.setScrollTop(initialSliderState.getDesiredScrollTopFromDelta(pointerDelta));
    };
    if (e.pageY !== initialPosY) {
      handlePointerMove(e.pageY, initialPosX);
    }
    this._sliderPointerMoveMonitor.startMonitoring(
      e.target,
      e.pointerId,
      e.buttons,
      (pointerMoveData) => handlePointerMove(pointerMoveData.pageY, pointerMoveData.pageX),
      () => {
        this._slider.toggleClassName("active", false);
      }
    );
  }
  scrollDueToTouchEvent(touch) {
    const startY = this._domNode.domNode.getBoundingClientRect().top;
    const scrollTop = this._lastRenderData.renderedLayout.getDesiredScrollTopFromTouchLocation(touch.pageY - startY);
    this._model.setScrollTop(scrollTop);
  }
  dispose() {
    this._pointerDownListener.dispose();
    this._sliderPointerMoveMonitor.dispose();
    this._sliderPointerDownListener.dispose();
    this._gestureDisposable.dispose();
    this._sliderTouchStartListener.dispose();
    this._sliderTouchMoveListener.dispose();
    this._sliderTouchEndListener.dispose();
    super.dispose();
  }
  _getMinimapDomNodeClassName() {
    const class_ = ["minimap"];
    if (this._model.options.showSlider === "always") {
      class_.push("slider-always");
    } else {
      class_.push("slider-mouseover");
    }
    if (this._model.options.autohide) {
      class_.push("autohide");
    }
    return class_.join(" ");
  }
  getDomNode() {
    return this._domNode;
  }
  _applyLayout() {
    this._domNode.setLeft(this._model.options.minimapLeft);
    this._domNode.setWidth(this._model.options.minimapWidth);
    this._domNode.setHeight(this._model.options.minimapHeight);
    this._shadow.setHeight(this._model.options.minimapHeight);
    this._canvas.setWidth(this._model.options.canvasOuterWidth);
    this._canvas.setHeight(this._model.options.canvasOuterHeight);
    this._canvas.domNode.width = this._model.options.canvasInnerWidth;
    this._canvas.domNode.height = this._model.options.canvasInnerHeight;
    this._decorationsCanvas.setWidth(this._model.options.canvasOuterWidth);
    this._decorationsCanvas.setHeight(this._model.options.canvasOuterHeight);
    this._decorationsCanvas.domNode.width = this._model.options.canvasInnerWidth;
    this._decorationsCanvas.domNode.height = this._model.options.canvasInnerHeight;
    this._slider.setWidth(this._model.options.minimapWidth);
  }
  _getBuffer() {
    if (!this._buffers) {
      if (this._model.options.canvasInnerWidth > 0 && this._model.options.canvasInnerHeight > 0) {
        this._buffers = new MinimapBuffers(
          this._canvas.domNode.getContext("2d"),
          this._model.options.canvasInnerWidth,
          this._model.options.canvasInnerHeight,
          this._model.options.backgroundColor
        );
      }
    }
    return this._buffers ? this._buffers.getBuffer() : null;
  }
  // ---- begin view event handlers
  onDidChangeOptions() {
    this._lastRenderData = null;
    this._buffers = null;
    this._applyLayout();
    this._domNode.setClassName(this._getMinimapDomNodeClassName());
  }
  onSelectionChanged() {
    this._renderDecorations = true;
    return true;
  }
  onDecorationsChanged() {
    this._renderDecorations = true;
    return true;
  }
  onFlushed() {
    this._lastRenderData = null;
    return true;
  }
  onLinesChanged(changeFromLineNumber, changeCount) {
    if (this._lastRenderData) {
      return this._lastRenderData.onLinesChanged(changeFromLineNumber, changeCount);
    }
    return false;
  }
  onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
    this._lastRenderData?.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
    return true;
  }
  onLinesInserted(insertFromLineNumber, insertToLineNumber) {
    this._lastRenderData?.onLinesInserted(insertFromLineNumber, insertToLineNumber);
    return true;
  }
  onScrollChanged() {
    this._renderDecorations = true;
    return true;
  }
  onThemeChanged() {
    this._selectionColor = this._theme.getColor(minimapSelection);
    this._renderDecorations = true;
    return true;
  }
  onTokensChanged(ranges) {
    if (this._lastRenderData) {
      return this._lastRenderData.onTokensChanged(ranges);
    }
    return false;
  }
  onTokensColorsChanged() {
    this._lastRenderData = null;
    this._buffers = null;
    return true;
  }
  onZonesChanged() {
    this._lastRenderData = null;
    return true;
  }
  // --- end event handlers
  render(renderingCtx) {
    const renderMinimap = this._model.options.renderMinimap;
    if (renderMinimap === RenderMinimap.None) {
      this._shadow.setClassName("minimap-shadow-hidden");
      this._sliderHorizontal.setWidth(0);
      this._sliderHorizontal.setHeight(0);
      return;
    }
    if (renderingCtx.scrollLeft + renderingCtx.viewportWidth >= renderingCtx.scrollWidth) {
      this._shadow.setClassName("minimap-shadow-hidden");
    } else {
      this._shadow.setClassName("minimap-shadow-visible");
    }
    const layout = MinimapLayout.create(
      this._model.options,
      renderingCtx.viewportStartLineNumber,
      renderingCtx.viewportEndLineNumber,
      renderingCtx.viewportStartLineNumberVerticalOffset,
      renderingCtx.viewportHeight,
      renderingCtx.viewportContainsWhitespaceGaps,
      this._model.getLineCount(),
      this._model.getRealLineCount(),
      renderingCtx.scrollTop,
      renderingCtx.scrollHeight,
      this._lastRenderData ? this._lastRenderData.renderedLayout : null
    );
    this._slider.setDisplay(layout.sliderNeeded ? "block" : "none");
    this._slider.setTop(layout.sliderTop);
    this._slider.setHeight(layout.sliderHeight);
    this._sliderHorizontal.setLeft(0);
    this._sliderHorizontal.setWidth(this._model.options.minimapWidth);
    this._sliderHorizontal.setTop(0);
    this._sliderHorizontal.setHeight(layout.sliderHeight);
    this.renderDecorations(layout);
    this._lastRenderData = this.renderLines(layout);
  }
  renderDecorations(layout) {
    if (this._renderDecorations) {
      this._renderDecorations = false;
      const selections = this._model.getSelections();
      selections.sort(Range.compareRangesUsingStarts);
      const decorations = this._model.getMinimapDecorationsInViewport(layout.startLineNumber, layout.endLineNumber);
      decorations.sort((a, b) => (a.options.zIndex || 0) - (b.options.zIndex || 0));
      const { canvasInnerWidth, canvasInnerHeight } = this._model.options;
      const minimapLineHeight = this._model.options.minimapLineHeight;
      const minimapCharWidth = this._model.options.minimapCharWidth;
      const tabSize = this._model.getOptions().tabSize;
      const canvasContext = this._decorationsCanvas.domNode.getContext("2d");
      canvasContext.clearRect(0, 0, canvasInnerWidth, canvasInnerHeight);
      const highlightedLines = new ContiguousLineMap(layout.startLineNumber, layout.endLineNumber, false);
      this._renderSelectionLineHighlights(canvasContext, selections, highlightedLines, layout, minimapLineHeight);
      this._renderDecorationsLineHighlights(canvasContext, decorations, highlightedLines, layout, minimapLineHeight);
      const lineOffsetMap = new ContiguousLineMap(layout.startLineNumber, layout.endLineNumber, null);
      this._renderSelectionsHighlights(canvasContext, selections, lineOffsetMap, layout, minimapLineHeight, tabSize, minimapCharWidth, canvasInnerWidth);
      this._renderDecorationsHighlights(canvasContext, decorations, lineOffsetMap, layout, minimapLineHeight, tabSize, minimapCharWidth, canvasInnerWidth);
      this._renderSectionHeaders(layout);
    }
  }
  _renderSelectionLineHighlights(canvasContext, selections, highlightedLines, layout, minimapLineHeight) {
    if (!this._selectionColor || this._selectionColor.isTransparent()) {
      return;
    }
    canvasContext.fillStyle = this._selectionColor.transparent(0.5).toString();
    let y1 = 0;
    let y2 = 0;
    for (const selection of selections) {
      const intersection = layout.intersectWithViewport(selection);
      if (!intersection) {
        continue;
      }
      const [startLineNumber, endLineNumber] = intersection;
      for (let line = startLineNumber; line <= endLineNumber; line++) {
        highlightedLines.set(line, true);
      }
      const yy1 = layout.getYForLineNumber(startLineNumber, minimapLineHeight);
      const yy2 = layout.getYForLineNumber(endLineNumber, minimapLineHeight);
      if (y2 >= yy1) {
        y2 = yy2;
      } else {
        if (y2 > y1) {
          canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y1, canvasContext.canvas.width, y2 - y1);
        }
        y1 = yy1;
        y2 = yy2;
      }
    }
    if (y2 > y1) {
      canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y1, canvasContext.canvas.width, y2 - y1);
    }
  }
  _renderDecorationsLineHighlights(canvasContext, decorations, highlightedLines, layout, minimapLineHeight) {
    const highlightColors = /* @__PURE__ */ new Map();
    for (let i = decorations.length - 1; i >= 0; i--) {
      const decoration = decorations[i];
      const minimapOptions = decoration.options.minimap;
      if (!minimapOptions || minimapOptions.position !== MinimapPosition.Inline) {
        continue;
      }
      const intersection = layout.intersectWithViewport(decoration.range);
      if (!intersection) {
        continue;
      }
      const [startLineNumber, endLineNumber] = intersection;
      const decorationColor = minimapOptions.getColor(this._theme.value);
      if (!decorationColor || decorationColor.isTransparent()) {
        continue;
      }
      let highlightColor = highlightColors.get(decorationColor.toString());
      if (!highlightColor) {
        highlightColor = decorationColor.transparent(0.5).toString();
        highlightColors.set(decorationColor.toString(), highlightColor);
      }
      canvasContext.fillStyle = highlightColor;
      for (let line = startLineNumber; line <= endLineNumber; line++) {
        if (highlightedLines.has(line)) {
          continue;
        }
        highlightedLines.set(line, true);
        const y = layout.getYForLineNumber(startLineNumber, minimapLineHeight);
        canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y, canvasContext.canvas.width, minimapLineHeight);
      }
    }
  }
  _renderSelectionsHighlights(canvasContext, selections, lineOffsetMap, layout, lineHeight, tabSize, characterWidth, canvasInnerWidth) {
    if (!this._selectionColor || this._selectionColor.isTransparent()) {
      return;
    }
    for (const selection of selections) {
      const intersection = layout.intersectWithViewport(selection);
      if (!intersection) {
        continue;
      }
      const [startLineNumber, endLineNumber] = intersection;
      for (let line = startLineNumber; line <= endLineNumber; line++) {
        this.renderDecorationOnLine(canvasContext, lineOffsetMap, selection, this._selectionColor, layout, line, lineHeight, lineHeight, tabSize, characterWidth, canvasInnerWidth);
      }
    }
  }
  _renderDecorationsHighlights(canvasContext, decorations, lineOffsetMap, layout, minimapLineHeight, tabSize, characterWidth, canvasInnerWidth) {
    for (const decoration of decorations) {
      const minimapOptions = decoration.options.minimap;
      if (!minimapOptions) {
        continue;
      }
      const intersection = layout.intersectWithViewport(decoration.range);
      if (!intersection) {
        continue;
      }
      const [startLineNumber, endLineNumber] = intersection;
      const decorationColor = minimapOptions.getColor(this._theme.value);
      if (!decorationColor || decorationColor.isTransparent()) {
        continue;
      }
      for (let line = startLineNumber; line <= endLineNumber; line++) {
        switch (minimapOptions.position) {
          case MinimapPosition.Inline:
            this.renderDecorationOnLine(canvasContext, lineOffsetMap, decoration.range, decorationColor, layout, line, minimapLineHeight, minimapLineHeight, tabSize, characterWidth, canvasInnerWidth);
            continue;
          case MinimapPosition.Gutter: {
            const y = layout.getYForLineNumber(line, minimapLineHeight);
            const x = 2;
            this.renderDecoration(canvasContext, decorationColor, x, y, GUTTER_DECORATION_WIDTH, minimapLineHeight);
            continue;
          }
        }
      }
    }
  }
  renderDecorationOnLine(canvasContext, lineOffsetMap, decorationRange, decorationColor, layout, lineNumber, height, minimapLineHeight, tabSize, charWidth, canvasInnerWidth) {
    const y = layout.getYForLineNumber(lineNumber, minimapLineHeight);
    if (y + height < 0 || y > this._model.options.canvasInnerHeight) {
      return;
    }
    const { startLineNumber, endLineNumber } = decorationRange;
    const startColumn = startLineNumber === lineNumber ? decorationRange.startColumn : 1;
    const endColumn = endLineNumber === lineNumber ? decorationRange.endColumn : this._model.getLineMaxColumn(lineNumber);
    const x1 = this.getXOffsetForPosition(lineOffsetMap, lineNumber, startColumn, tabSize, charWidth, canvasInnerWidth);
    const x2 = this.getXOffsetForPosition(lineOffsetMap, lineNumber, endColumn, tabSize, charWidth, canvasInnerWidth);
    this.renderDecoration(canvasContext, decorationColor, x1, y, x2 - x1, height);
  }
  getXOffsetForPosition(lineOffsetMap, lineNumber, column, tabSize, charWidth, canvasInnerWidth) {
    if (column === 1) {
      return MINIMAP_GUTTER_WIDTH;
    }
    const minimumXOffset = (column - 1) * charWidth;
    if (minimumXOffset >= canvasInnerWidth) {
      return canvasInnerWidth;
    }
    let lineIndexToXOffset = lineOffsetMap.get(lineNumber);
    if (!lineIndexToXOffset) {
      const lineData = this._model.getLineContent(lineNumber);
      lineIndexToXOffset = [MINIMAP_GUTTER_WIDTH];
      let prevx = MINIMAP_GUTTER_WIDTH;
      for (let i = 1; i < lineData.length + 1; i++) {
        const charCode = lineData.charCodeAt(i - 1);
        const dx = charCode === CharCode.Tab ? tabSize * charWidth : strings.isFullWidthCharacter(charCode) ? 2 * charWidth : charWidth;
        const x = prevx + dx;
        if (x >= canvasInnerWidth) {
          lineIndexToXOffset[i] = canvasInnerWidth;
          break;
        }
        lineIndexToXOffset[i] = x;
        prevx = x;
      }
      lineOffsetMap.set(lineNumber, lineIndexToXOffset);
    }
    if (column - 1 < lineIndexToXOffset.length) {
      return lineIndexToXOffset[column - 1];
    }
    return canvasInnerWidth;
  }
  renderDecoration(canvasContext, decorationColor, x, y, width, height) {
    canvasContext.fillStyle = decorationColor && decorationColor.toString() || "";
    canvasContext.fillRect(x, y, width, height);
  }
  _renderSectionHeaders(layout) {
    const minimapLineHeight = this._model.options.minimapLineHeight;
    const sectionHeaderFontSize = this._model.options.sectionHeaderFontSize;
    const sectionHeaderLetterSpacing = this._model.options.sectionHeaderLetterSpacing;
    const backgroundFillHeight = sectionHeaderFontSize * 1.5;
    const { canvasInnerWidth } = this._model.options;
    const backgroundColor = this._model.options.backgroundColor;
    const backgroundFill = `rgb(${backgroundColor.r} ${backgroundColor.g} ${backgroundColor.b} / .7)`;
    const foregroundColor = this._model.options.sectionHeaderFontColor;
    const foregroundFill = `rgb(${foregroundColor.r} ${foregroundColor.g} ${foregroundColor.b})`;
    const separatorStroke = foregroundFill;
    const canvasContext = this._decorationsCanvas.domNode.getContext("2d");
    canvasContext.letterSpacing = sectionHeaderLetterSpacing + "px";
    canvasContext.font = "500 " + sectionHeaderFontSize + "px " + this._model.options.sectionHeaderFontFamily;
    canvasContext.strokeStyle = separatorStroke;
    canvasContext.lineWidth = 0.2;
    const decorations = this._model.getSectionHeaderDecorationsInViewport(layout.startLineNumber, layout.endLineNumber);
    decorations.sort((a, b) => a.range.startLineNumber - b.range.startLineNumber);
    const fitWidth = InnerMinimap._fitSectionHeader.bind(
      null,
      canvasContext,
      canvasInnerWidth - MINIMAP_GUTTER_WIDTH
    );
    for (const decoration of decorations) {
      const y = layout.getYForLineNumber(decoration.range.startLineNumber, minimapLineHeight) + sectionHeaderFontSize;
      const backgroundFillY = y - sectionHeaderFontSize;
      const separatorY = backgroundFillY + 2;
      const headerText = this._model.getSectionHeaderText(decoration, fitWidth);
      InnerMinimap._renderSectionLabel(
        canvasContext,
        headerText,
        decoration.options.minimap?.sectionHeaderStyle === MinimapSectionHeaderStyle.Underlined,
        backgroundFill,
        foregroundFill,
        canvasInnerWidth,
        backgroundFillY,
        backgroundFillHeight,
        y,
        separatorY
      );
    }
  }
  static _fitSectionHeader(target, maxWidth, headerText) {
    if (!headerText) {
      return headerText;
    }
    const ellipsis = "\u2026";
    const width = target.measureText(headerText).width;
    const ellipsisWidth = target.measureText(ellipsis).width;
    if (width <= maxWidth || width <= ellipsisWidth) {
      return headerText;
    }
    const len = headerText.length;
    const averageCharWidth = width / headerText.length;
    const maxCharCount = Math.floor((maxWidth - ellipsisWidth) / averageCharWidth) - 1;
    let halfCharCount = Math.ceil(maxCharCount / 2);
    while (halfCharCount > 0 && /\s/.test(headerText[halfCharCount - 1])) {
      --halfCharCount;
    }
    return headerText.substring(0, halfCharCount) + ellipsis + headerText.substring(len - (maxCharCount - halfCharCount));
  }
  static _renderSectionLabel(target, headerText, hasSeparatorLine, backgroundFill, foregroundFill, minimapWidth, backgroundFillY, backgroundFillHeight, textY, separatorY) {
    if (headerText) {
      target.fillStyle = backgroundFill;
      target.fillRect(0, backgroundFillY, minimapWidth, backgroundFillHeight);
      target.fillStyle = foregroundFill;
      target.fillText(headerText, MINIMAP_GUTTER_WIDTH, textY);
    }
    if (hasSeparatorLine) {
      target.beginPath();
      target.moveTo(0, separatorY);
      target.lineTo(minimapWidth, separatorY);
      target.closePath();
      target.stroke();
    }
  }
  renderLines(layout) {
    const startLineNumber = layout.startLineNumber;
    const endLineNumber = layout.endLineNumber;
    const minimapLineHeight = this._model.options.minimapLineHeight;
    if (this._lastRenderData && this._lastRenderData.linesEquals(layout)) {
      const _lastData = this._lastRenderData._get();
      return new RenderData(layout, _lastData.imageData, _lastData.lines);
    }
    const imageData = this._getBuffer();
    if (!imageData) {
      return null;
    }
    const [_dirtyY1, _dirtyY2, needed] = InnerMinimap._renderUntouchedLines(
      imageData,
      layout.topPaddingLineCount,
      startLineNumber,
      endLineNumber,
      minimapLineHeight,
      this._lastRenderData
    );
    const lineInfo = this._model.getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed);
    const tabSize = this._model.getOptions().tabSize;
    const defaultBackground = this._model.options.defaultBackgroundColor;
    const background = this._model.options.backgroundColor;
    const foregroundAlpha = this._model.options.foregroundAlpha;
    const tokensColorTracker = this._model.tokensColorTracker;
    const useLighterFont = tokensColorTracker.backgroundIsLight();
    const renderMinimap = this._model.options.renderMinimap;
    const charRenderer = this._model.options.charRenderer();
    const fontScale = this._model.options.fontScale;
    const minimapCharWidth = this._model.options.minimapCharWidth;
    const baseCharHeight = renderMinimap === RenderMinimap.Text ? Constants.BASE_CHAR_HEIGHT : Constants.BASE_CHAR_HEIGHT + 1;
    const renderMinimapLineHeight = baseCharHeight * fontScale;
    const innerLinePadding = minimapLineHeight > renderMinimapLineHeight ? Math.floor((minimapLineHeight - renderMinimapLineHeight) / 2) : 0;
    const backgroundA = background.a / 255;
    const renderBackground = new RGBA8(
      Math.round((background.r - defaultBackground.r) * backgroundA + defaultBackground.r),
      Math.round((background.g - defaultBackground.g) * backgroundA + defaultBackground.g),
      Math.round((background.b - defaultBackground.b) * backgroundA + defaultBackground.b),
      255
    );
    let dy = layout.topPaddingLineCount * minimapLineHeight;
    const renderedLines = [];
    for (let lineIndex = 0, lineCount = endLineNumber - startLineNumber + 1; lineIndex < lineCount; lineIndex++) {
      if (needed[lineIndex]) {
        InnerMinimap._renderLine(
          imageData,
          renderBackground,
          background.a,
          useLighterFont,
          renderMinimap,
          minimapCharWidth,
          tokensColorTracker,
          foregroundAlpha,
          charRenderer,
          dy,
          innerLinePadding,
          tabSize,
          lineInfo[lineIndex],
          fontScale,
          minimapLineHeight
        );
      }
      renderedLines[lineIndex] = new MinimapLine(dy);
      dy += minimapLineHeight;
    }
    const dirtyY1 = _dirtyY1 === -1 ? 0 : _dirtyY1;
    const dirtyY2 = _dirtyY2 === -1 ? imageData.height : _dirtyY2;
    const dirtyHeight = dirtyY2 - dirtyY1;
    const ctx = this._canvas.domNode.getContext("2d");
    ctx.putImageData(imageData, 0, 0, 0, dirtyY1, imageData.width, dirtyHeight);
    return new RenderData(
      layout,
      imageData,
      renderedLines
    );
  }
  static _renderUntouchedLines(target, topPaddingLineCount, startLineNumber, endLineNumber, minimapLineHeight, lastRenderData) {
    const needed = [];
    if (!lastRenderData) {
      for (let i = 0, len = endLineNumber - startLineNumber + 1; i < len; i++) {
        needed[i] = true;
      }
      return [-1, -1, needed];
    }
    const _lastData = lastRenderData._get();
    const lastTargetData = _lastData.imageData.data;
    const lastStartLineNumber = _lastData.rendLineNumberStart;
    const lastLines = _lastData.lines;
    const lastLinesLength = lastLines.length;
    const WIDTH = target.width;
    const targetData = target.data;
    const maxDestPixel = (endLineNumber - startLineNumber + 1) * minimapLineHeight * WIDTH * 4;
    let dirtyPixel1 = -1;
    let dirtyPixel2 = -1;
    let copySourceStart = -1;
    let copySourceEnd = -1;
    let copyDestStart = -1;
    let copyDestEnd = -1;
    let dest_dy = topPaddingLineCount * minimapLineHeight;
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
      const lineIndex = lineNumber - startLineNumber;
      const lastLineIndex = lineNumber - lastStartLineNumber;
      const source_dy = lastLineIndex >= 0 && lastLineIndex < lastLinesLength ? lastLines[lastLineIndex].dy : -1;
      if (source_dy === -1) {
        needed[lineIndex] = true;
        dest_dy += minimapLineHeight;
        continue;
      }
      const sourceStart = source_dy * WIDTH * 4;
      const sourceEnd = (source_dy + minimapLineHeight) * WIDTH * 4;
      const destStart = dest_dy * WIDTH * 4;
      const destEnd = (dest_dy + minimapLineHeight) * WIDTH * 4;
      if (copySourceEnd === sourceStart && copyDestEnd === destStart) {
        copySourceEnd = sourceEnd;
        copyDestEnd = destEnd;
      } else {
        if (copySourceStart !== -1) {
          targetData.set(lastTargetData.subarray(copySourceStart, copySourceEnd), copyDestStart);
          if (dirtyPixel1 === -1 && copySourceStart === 0 && copySourceStart === copyDestStart) {
            dirtyPixel1 = copySourceEnd;
          }
          if (dirtyPixel2 === -1 && copySourceEnd === maxDestPixel && copySourceStart === copyDestStart) {
            dirtyPixel2 = copySourceStart;
          }
        }
        copySourceStart = sourceStart;
        copySourceEnd = sourceEnd;
        copyDestStart = destStart;
        copyDestEnd = destEnd;
      }
      needed[lineIndex] = false;
      dest_dy += minimapLineHeight;
    }
    if (copySourceStart !== -1) {
      targetData.set(lastTargetData.subarray(copySourceStart, copySourceEnd), copyDestStart);
      if (dirtyPixel1 === -1 && copySourceStart === 0 && copySourceStart === copyDestStart) {
        dirtyPixel1 = copySourceEnd;
      }
      if (dirtyPixel2 === -1 && copySourceEnd === maxDestPixel && copySourceStart === copyDestStart) {
        dirtyPixel2 = copySourceStart;
      }
    }
    const dirtyY1 = dirtyPixel1 === -1 ? -1 : dirtyPixel1 / (WIDTH * 4);
    const dirtyY2 = dirtyPixel2 === -1 ? -1 : dirtyPixel2 / (WIDTH * 4);
    return [dirtyY1, dirtyY2, needed];
  }
  static _renderLine(target, backgroundColor, backgroundAlpha, useLighterFont, renderMinimap, charWidth, colorTracker, foregroundAlpha, minimapCharRenderer, dy, innerLinePadding, tabSize, lineData, fontScale, minimapLineHeight) {
    const content = lineData.content;
    const tokens = lineData.tokens;
    const maxDx = target.width - charWidth;
    const force1pxHeight = minimapLineHeight === 1;
    let dx = MINIMAP_GUTTER_WIDTH;
    let charIndex = 0;
    let tabsCharDelta = 0;
    for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
      const tokenEndIndex = tokens.getEndOffset(tokenIndex);
      const tokenColorId = tokens.getForeground(tokenIndex);
      const tokenColor = colorTracker.getColor(tokenColorId);
      for (; charIndex < tokenEndIndex; charIndex++) {
        if (dx > maxDx) {
          return;
        }
        const charCode = content.charCodeAt(charIndex);
        if (charCode === CharCode.Tab) {
          const insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
          tabsCharDelta += insertSpacesCount - 1;
          dx += insertSpacesCount * charWidth;
        } else if (charCode === CharCode.Space) {
          dx += charWidth;
        } else {
          const count = strings.isFullWidthCharacter(charCode) ? 2 : 1;
          for (let i = 0; i < count; i++) {
            if (renderMinimap === RenderMinimap.Blocks) {
              minimapCharRenderer.blockRenderChar(target, dx, dy + innerLinePadding, tokenColor, foregroundAlpha, backgroundColor, backgroundAlpha, force1pxHeight);
            } else {
              minimapCharRenderer.renderChar(target, dx, dy + innerLinePadding, charCode, tokenColor, foregroundAlpha, backgroundColor, backgroundAlpha, fontScale, useLighterFont, force1pxHeight);
            }
            dx += charWidth;
            if (dx > maxDx) {
              return;
            }
          }
        }
      }
    }
  }
}
class ContiguousLineMap {
  constructor(startLineNumber, endLineNumber, defaultValue) {
    this._startLineNumber = startLineNumber;
    this._endLineNumber = endLineNumber;
    this._defaultValue = defaultValue;
    this._values = [];
    for (let i = 0, count = this._endLineNumber - this._startLineNumber + 1; i < count; i++) {
      this._values[i] = defaultValue;
    }
  }
  has(lineNumber) {
    return this.get(lineNumber) !== this._defaultValue;
  }
  set(lineNumber, value) {
    if (lineNumber < this._startLineNumber || lineNumber > this._endLineNumber) {
      return;
    }
    this._values[lineNumber - this._startLineNumber] = value;
  }
  get(lineNumber) {
    if (lineNumber < this._startLineNumber || lineNumber > this._endLineNumber) {
      return this._defaultValue;
    }
    return this._values[lineNumber - this._startLineNumber];
  }
}
export {
  Minimap
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvbWluaW1hcC9taW5pbWFwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21pbmltYXAuY3NzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEZhc3REb21Ob2RlLCBjcmVhdGVGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBHbG9iYWxQb2ludGVyTW92ZU1vbml0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZ2xvYmFsUG9pbnRlck1vdmVNb25pdG9yLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElMaW5lLCBSZW5kZXJlZExpbmVzQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL3ZpZXcvdmlld0xheWVyLmpzJztcbmltcG9ydCB7IFBhcnRGaW5nZXJwcmludCwgUGFydEZpbmdlcnByaW50cywgVmlld1BhcnQgfSBmcm9tICcuLi8uLi92aWV3L3ZpZXdQYXJ0LmpzJztcbmltcG9ydCB7IFJlbmRlck1pbmltYXAsIEVkaXRvck9wdGlvbiwgTUlOSU1BUF9HVVRURVJfV0lEVEgsIEVkaXRvckxheW91dEluZm9Db21wdXRlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFJHQkE4IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmdiYS5qcyc7XG5pbXBvcnQgeyBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2xvcklkIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgTWluaW1hcENoYXJSZW5kZXJlciB9IGZyb20gJy4vbWluaW1hcENoYXJSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuL21pbmltYXBDaGFyU2hlZXQuanMnO1xuaW1wb3J0IHsgTWluaW1hcFRva2Vuc0NvbG9yVHJhY2tlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvbWluaW1hcFRva2Vuc0NvbG9yVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBSZW5kZXJpbmdDb250ZXh0LCBSZXN0cmljdGVkUmVuZGVyaW5nQ29udGV4dCB9IGZyb20gJy4uLy4uL3ZpZXcvcmVuZGVyaW5nQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHsgRWRpdG9yVGhlbWUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yVGhlbWUuanMnO1xuaW1wb3J0ICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBWaWV3TGluZURhdGEsIFZpZXdNb2RlbERlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IG1pbmltYXBTZWxlY3Rpb24sIG1pbmltYXBCYWNrZ3JvdW5kLCBtaW5pbWFwRm9yZWdyb3VuZE9wYWNpdHksIGVkaXRvckZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25NaW5pbWFwT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgR2VzdHVyZUV2ZW50LCBFdmVudFR5cGUsIEdlc3R1cmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdG91Y2guanMnO1xuaW1wb3J0IHsgTWluaW1hcENoYXJSZW5kZXJlckZhY3RvcnkgfSBmcm9tICcuL21pbmltYXBDaGFyUmVuZGVyZXJGYWN0b3J5LmpzJztcbmltcG9ydCB7IE1pbmltYXBQb3NpdGlvbiwgTWluaW1hcFNlY3Rpb25IZWFkZXJTdHlsZSwgVGV4dE1vZGVsUmVzb2x2ZWRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Z1bmN0aW9uYWwuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9GT05UX0ZBTUlMWSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mb250cy5qcyc7XG5cbi8qKlxuICogVGhlIG9ydGhvZ29uYWwgZGlzdGFuY2UgdG8gdGhlIHNsaWRlciBhdCB3aGljaCBkcmFnZ2luZyBcInJlc2V0c1wiLiBUaGlzIGltcGxlbWVudHMgXCJzbmFwcGluZ1wiXG4gKi9cbmNvbnN0IFBPSU5URVJfRFJBR19SRVNFVF9ESVNUQU5DRSA9IDE0MDtcblxuY29uc3QgR1VUVEVSX0RFQ09SQVRJT05fV0lEVEggPSAyO1xuXG5jbGFzcyBNaW5pbWFwT3B0aW9ucyB7XG5cblx0cHVibGljIHJlYWRvbmx5IHJlbmRlck1pbmltYXA6IFJlbmRlck1pbmltYXA7XG5cdHB1YmxpYyByZWFkb25seSBzaXplOiAncHJvcG9ydGlvbmFsJyB8ICdmaWxsJyB8ICdmaXQnO1xuXHRwdWJsaWMgcmVhZG9ubHkgbWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0OiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2Nyb2xsQmV5b25kTGFzdExpbmU6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBwYWRkaW5nVG9wOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBwYWRkaW5nQm90dG9tOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzaG93U2xpZGVyOiAnYWx3YXlzJyB8ICdtb3VzZW92ZXInO1xuXHRwdWJsaWMgcmVhZG9ubHkgYXV0b2hpZGU6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBwaXhlbFJhdGlvOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSB0eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIGNvbnRhaW5lciBkb20gbm9kZSBsZWZ0IHBvc2l0aW9uIChpbiBDU1MgcHgpXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgbWluaW1hcExlZnQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIGNvbnRhaW5lciBkb20gbm9kZSB3aWR0aCAoaW4gQ1NTIHB4KVxuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IG1pbmltYXBXaWR0aDogbnVtYmVyO1xuXHQvKipcblx0ICogY29udGFpbmVyIGRvbSBub2RlIGhlaWdodCAoaW4gQ1NTIHB4KVxuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IG1pbmltYXBIZWlnaHQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIGNhbnZhcyBiYWNraW5nIHN0b3JlIHdpZHRoIChpbiBkZXZpY2UgcHgpXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgY2FudmFzSW5uZXJXaWR0aDogbnVtYmVyO1xuXHQvKipcblx0ICogY2FudmFzIGJhY2tpbmcgc3RvcmUgaGVpZ2h0IChpbiBkZXZpY2UgcHgpXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgY2FudmFzSW5uZXJIZWlnaHQ6IG51bWJlcjtcblx0LyoqXG5cdCAqIGNhbnZhcyB3aWR0aCAoaW4gQ1NTIHB4KVxuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IGNhbnZhc091dGVyV2lkdGg6IG51bWJlcjtcblx0LyoqXG5cdCAqIGNhbnZhcyBoZWlnaHQgKGluIENTUyBweClcblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBjYW52YXNPdXRlckhlaWdodDogbnVtYmVyO1xuXG5cdHB1YmxpYyByZWFkb25seSBpc1NhbXBsaW5nOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgZWRpdG9ySGVpZ2h0OiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBmb250U2NhbGU6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IG1pbmltYXBMaW5lSGVpZ2h0OiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBtaW5pbWFwQ2hhcldpZHRoOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzZWN0aW9uSGVhZGVyRm9udEZhbWlseTogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2VjdGlvbkhlYWRlckZvbnRTaXplOiBudW1iZXI7XG5cdC8qKlxuXHQgKiBTcGFjZSBpbiBiZXR3ZWVuIHRoZSBjaGFyYWN0ZXJzIG9mIHRoZSBzZWN0aW9uIGhlYWRlciAoaW4gQ1NTIHB4KVxuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IHNlY3Rpb25IZWFkZXJMZXR0ZXJTcGFjaW5nOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzZWN0aW9uSGVhZGVyRm9udENvbG9yOiBSR0JBODtcblxuXHRwdWJsaWMgcmVhZG9ubHkgY2hhclJlbmRlcmVyOiAoKSA9PiBNaW5pbWFwQ2hhclJlbmRlcmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgZGVmYXVsdEJhY2tncm91bmRDb2xvcjogUkdCQTg7XG5cdHB1YmxpYyByZWFkb25seSBiYWNrZ3JvdW5kQ29sb3I6IFJHQkE4O1xuXHQvKipcblx0ICogZm9yZWdyb3VuZCBhbHBoYTogaW50ZWdlciBpbiBbMC0yNTVdXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgZm9yZWdyb3VuZEFscGhhOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoY29uZmlndXJhdGlvbjogSUVkaXRvckNvbmZpZ3VyYXRpb24sIHRoZW1lOiBFZGl0b3JUaGVtZSwgdG9rZW5zQ29sb3JUcmFja2VyOiBNaW5pbWFwVG9rZW5zQ29sb3JUcmFja2VyKSB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBwaXhlbFJhdGlvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnBpeGVsUmF0aW8pO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbyk7XG5cdFx0Y29uc3QgbWluaW1hcExheW91dCA9IGxheW91dEluZm8ubWluaW1hcDtcblx0XHRjb25zdCBmb250SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0Y29uc3QgbWluaW1hcE9wdHMgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubWluaW1hcCk7XG5cblx0XHR0aGlzLnJlbmRlck1pbmltYXAgPSBtaW5pbWFwTGF5b3V0LnJlbmRlck1pbmltYXA7XG5cdFx0dGhpcy5zaXplID0gbWluaW1hcE9wdHMuc2l6ZTtcblx0XHR0aGlzLm1pbmltYXBIZWlnaHRJc0VkaXRvckhlaWdodCA9IG1pbmltYXBMYXlvdXQubWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0O1xuXHRcdHRoaXMuc2Nyb2xsQmV5b25kTGFzdExpbmUgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc2Nyb2xsQmV5b25kTGFzdExpbmUpO1xuXHRcdHRoaXMucGFkZGluZ1RvcCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5wYWRkaW5nKS50b3A7XG5cdFx0dGhpcy5wYWRkaW5nQm90dG9tID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnBhZGRpbmcpLmJvdHRvbTtcblx0XHR0aGlzLnNob3dTbGlkZXIgPSBtaW5pbWFwT3B0cy5zaG93U2xpZGVyO1xuXHRcdHRoaXMuYXV0b2hpZGUgPSBtaW5pbWFwT3B0cy5hdXRvaGlkZTtcblx0XHR0aGlzLnBpeGVsUmF0aW8gPSBwaXhlbFJhdGlvO1xuXHRcdHRoaXMudHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoID0gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdHRoaXMubGluZUhlaWdodCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHR0aGlzLm1pbmltYXBMZWZ0ID0gbWluaW1hcExheW91dC5taW5pbWFwTGVmdDtcblx0XHR0aGlzLm1pbmltYXBXaWR0aCA9IG1pbmltYXBMYXlvdXQubWluaW1hcFdpZHRoO1xuXHRcdHRoaXMubWluaW1hcEhlaWdodCA9IGxheW91dEluZm8uaGVpZ2h0O1xuXG5cdFx0dGhpcy5jYW52YXNJbm5lcldpZHRoID0gbWluaW1hcExheW91dC5taW5pbWFwQ2FudmFzSW5uZXJXaWR0aDtcblx0XHR0aGlzLmNhbnZhc0lubmVySGVpZ2h0ID0gbWluaW1hcExheW91dC5taW5pbWFwQ2FudmFzSW5uZXJIZWlnaHQ7XG5cdFx0dGhpcy5jYW52YXNPdXRlcldpZHRoID0gbWluaW1hcExheW91dC5taW5pbWFwQ2FudmFzT3V0ZXJXaWR0aDtcblx0XHR0aGlzLmNhbnZhc091dGVySGVpZ2h0ID0gbWluaW1hcExheW91dC5taW5pbWFwQ2FudmFzT3V0ZXJIZWlnaHQ7XG5cblx0XHR0aGlzLmlzU2FtcGxpbmcgPSBtaW5pbWFwTGF5b3V0Lm1pbmltYXBJc1NhbXBsaW5nO1xuXHRcdHRoaXMuZWRpdG9ySGVpZ2h0ID0gbGF5b3V0SW5mby5oZWlnaHQ7XG5cdFx0dGhpcy5mb250U2NhbGUgPSBtaW5pbWFwTGF5b3V0Lm1pbmltYXBTY2FsZTtcblx0XHR0aGlzLm1pbmltYXBMaW5lSGVpZ2h0ID0gbWluaW1hcExheW91dC5taW5pbWFwTGluZUhlaWdodDtcblx0XHR0aGlzLm1pbmltYXBDaGFyV2lkdGggPSBDb25zdGFudHMuQkFTRV9DSEFSX1dJRFRIICogdGhpcy5mb250U2NhbGU7XG5cdFx0dGhpcy5zZWN0aW9uSGVhZGVyRm9udEZhbWlseSA9IERFRkFVTFRfRk9OVF9GQU1JTFk7XG5cdFx0dGhpcy5zZWN0aW9uSGVhZGVyRm9udFNpemUgPSBtaW5pbWFwT3B0cy5zZWN0aW9uSGVhZGVyRm9udFNpemUgKiBwaXhlbFJhdGlvO1xuXHRcdHRoaXMuc2VjdGlvbkhlYWRlckxldHRlclNwYWNpbmcgPSBtaW5pbWFwT3B0cy5zZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZzsgLy8gaW50ZW50aW9uYWxseSBub3QgbXVsdGlwbHlpbmcgYnkgcGl4ZWxSYXRpb1xuXHRcdHRoaXMuc2VjdGlvbkhlYWRlckZvbnRDb2xvciA9IE1pbmltYXBPcHRpb25zLl9nZXRTZWN0aW9uSGVhZGVyQ29sb3IodGhlbWUsIHRva2Vuc0NvbG9yVHJhY2tlci5nZXRDb2xvcihDb2xvcklkLkRlZmF1bHRGb3JlZ3JvdW5kKSk7XG5cblx0XHR0aGlzLmNoYXJSZW5kZXJlciA9IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbigoKSA9PiBNaW5pbWFwQ2hhclJlbmRlcmVyRmFjdG9yeS5jcmVhdGUodGhpcy5mb250U2NhbGUsIGZvbnRJbmZvLmZvbnRGYW1pbHkpKTtcblx0XHR0aGlzLmRlZmF1bHRCYWNrZ3JvdW5kQ29sb3IgPSB0b2tlbnNDb2xvclRyYWNrZXIuZ2V0Q29sb3IoQ29sb3JJZC5EZWZhdWx0QmFja2dyb3VuZCk7XG5cdFx0dGhpcy5iYWNrZ3JvdW5kQ29sb3IgPSBNaW5pbWFwT3B0aW9ucy5fZ2V0TWluaW1hcEJhY2tncm91bmQodGhlbWUsIHRoaXMuZGVmYXVsdEJhY2tncm91bmRDb2xvcik7XG5cdFx0dGhpcy5mb3JlZ3JvdW5kQWxwaGEgPSBNaW5pbWFwT3B0aW9ucy5fZ2V0TWluaW1hcEZvcmVncm91bmRPcGFjaXR5KHRoZW1lKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9nZXRNaW5pbWFwQmFja2dyb3VuZCh0aGVtZTogRWRpdG9yVGhlbWUsIGRlZmF1bHRCYWNrZ3JvdW5kQ29sb3I6IFJHQkE4KTogUkdCQTgge1xuXHRcdGNvbnN0IHRoZW1lQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihtaW5pbWFwQmFja2dyb3VuZCk7XG5cdFx0aWYgKHRoZW1lQ29sb3IpIHtcblx0XHRcdHJldHVybiBuZXcgUkdCQTgodGhlbWVDb2xvci5yZ2JhLnIsIHRoZW1lQ29sb3IucmdiYS5nLCB0aGVtZUNvbG9yLnJnYmEuYiwgTWF0aC5yb3VuZCgyNTUgKiB0aGVtZUNvbG9yLnJnYmEuYSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gZGVmYXVsdEJhY2tncm91bmRDb2xvcjtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9nZXRNaW5pbWFwRm9yZWdyb3VuZE9wYWNpdHkodGhlbWU6IEVkaXRvclRoZW1lKTogbnVtYmVyIHtcblx0XHRjb25zdCB0aGVtZUNvbG9yID0gdGhlbWUuZ2V0Q29sb3IobWluaW1hcEZvcmVncm91bmRPcGFjaXR5KTtcblx0XHRpZiAodGhlbWVDb2xvcikge1xuXHRcdFx0cmV0dXJuIFJHQkE4Ll9jbGFtcChNYXRoLnJvdW5kKDI1NSAqIHRoZW1lQ29sb3IucmdiYS5hKSk7XG5cdFx0fVxuXHRcdHJldHVybiAyNTU7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0U2VjdGlvbkhlYWRlckNvbG9yKHRoZW1lOiBFZGl0b3JUaGVtZSwgZGVmYXVsdEZvcmVncm91bmRDb2xvcjogUkdCQTgpOiBSR0JBOCB7XG5cdFx0Y29uc3QgdGhlbWVDb2xvciA9IHRoZW1lLmdldENvbG9yKGVkaXRvckZvcmVncm91bmQpO1xuXHRcdGlmICh0aGVtZUNvbG9yKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFJHQkE4KHRoZW1lQ29sb3IucmdiYS5yLCB0aGVtZUNvbG9yLnJnYmEuZywgdGhlbWVDb2xvci5yZ2JhLmIsIE1hdGgucm91bmQoMjU1ICogdGhlbWVDb2xvci5yZ2JhLmEpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRlZmF1bHRGb3JlZ3JvdW5kQ29sb3I7XG5cdH1cblxuXHRwdWJsaWMgZXF1YWxzKG90aGVyOiBNaW5pbWFwT3B0aW9ucyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5yZW5kZXJNaW5pbWFwID09PSBvdGhlci5yZW5kZXJNaW5pbWFwXG5cdFx0XHQmJiB0aGlzLnNpemUgPT09IG90aGVyLnNpemVcblx0XHRcdCYmIHRoaXMubWluaW1hcEhlaWdodElzRWRpdG9ySGVpZ2h0ID09PSBvdGhlci5taW5pbWFwSGVpZ2h0SXNFZGl0b3JIZWlnaHRcblx0XHRcdCYmIHRoaXMuc2Nyb2xsQmV5b25kTGFzdExpbmUgPT09IG90aGVyLnNjcm9sbEJleW9uZExhc3RMaW5lXG5cdFx0XHQmJiB0aGlzLnBhZGRpbmdUb3AgPT09IG90aGVyLnBhZGRpbmdUb3Bcblx0XHRcdCYmIHRoaXMucGFkZGluZ0JvdHRvbSA9PT0gb3RoZXIucGFkZGluZ0JvdHRvbVxuXHRcdFx0JiYgdGhpcy5zaG93U2xpZGVyID09PSBvdGhlci5zaG93U2xpZGVyXG5cdFx0XHQmJiB0aGlzLmF1dG9oaWRlID09PSBvdGhlci5hdXRvaGlkZVxuXHRcdFx0JiYgdGhpcy5waXhlbFJhdGlvID09PSBvdGhlci5waXhlbFJhdGlvXG5cdFx0XHQmJiB0aGlzLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA9PT0gb3RoZXIudHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoXG5cdFx0XHQmJiB0aGlzLmxpbmVIZWlnaHQgPT09IG90aGVyLmxpbmVIZWlnaHRcblx0XHRcdCYmIHRoaXMubWluaW1hcExlZnQgPT09IG90aGVyLm1pbmltYXBMZWZ0XG5cdFx0XHQmJiB0aGlzLm1pbmltYXBXaWR0aCA9PT0gb3RoZXIubWluaW1hcFdpZHRoXG5cdFx0XHQmJiB0aGlzLm1pbmltYXBIZWlnaHQgPT09IG90aGVyLm1pbmltYXBIZWlnaHRcblx0XHRcdCYmIHRoaXMuY2FudmFzSW5uZXJXaWR0aCA9PT0gb3RoZXIuY2FudmFzSW5uZXJXaWR0aFxuXHRcdFx0JiYgdGhpcy5jYW52YXNJbm5lckhlaWdodCA9PT0gb3RoZXIuY2FudmFzSW5uZXJIZWlnaHRcblx0XHRcdCYmIHRoaXMuY2FudmFzT3V0ZXJXaWR0aCA9PT0gb3RoZXIuY2FudmFzT3V0ZXJXaWR0aFxuXHRcdFx0JiYgdGhpcy5jYW52YXNPdXRlckhlaWdodCA9PT0gb3RoZXIuY2FudmFzT3V0ZXJIZWlnaHRcblx0XHRcdCYmIHRoaXMuaXNTYW1wbGluZyA9PT0gb3RoZXIuaXNTYW1wbGluZ1xuXHRcdFx0JiYgdGhpcy5lZGl0b3JIZWlnaHQgPT09IG90aGVyLmVkaXRvckhlaWdodFxuXHRcdFx0JiYgdGhpcy5mb250U2NhbGUgPT09IG90aGVyLmZvbnRTY2FsZVxuXHRcdFx0JiYgdGhpcy5taW5pbWFwTGluZUhlaWdodCA9PT0gb3RoZXIubWluaW1hcExpbmVIZWlnaHRcblx0XHRcdCYmIHRoaXMubWluaW1hcENoYXJXaWR0aCA9PT0gb3RoZXIubWluaW1hcENoYXJXaWR0aFxuXHRcdFx0JiYgdGhpcy5zZWN0aW9uSGVhZGVyRm9udFNpemUgPT09IG90aGVyLnNlY3Rpb25IZWFkZXJGb250U2l6ZVxuXHRcdFx0JiYgdGhpcy5zZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZyA9PT0gb3RoZXIuc2VjdGlvbkhlYWRlckxldHRlclNwYWNpbmdcblx0XHRcdCYmIHRoaXMuZGVmYXVsdEJhY2tncm91bmRDb2xvciAmJiB0aGlzLmRlZmF1bHRCYWNrZ3JvdW5kQ29sb3IuZXF1YWxzKG90aGVyLmRlZmF1bHRCYWNrZ3JvdW5kQ29sb3IpXG5cdFx0XHQmJiB0aGlzLmJhY2tncm91bmRDb2xvciAmJiB0aGlzLmJhY2tncm91bmRDb2xvci5lcXVhbHMob3RoZXIuYmFja2dyb3VuZENvbG9yKVxuXHRcdFx0JiYgdGhpcy5mb3JlZ3JvdW5kQWxwaGEgPT09IG90aGVyLmZvcmVncm91bmRBbHBoYVxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgTWluaW1hcExheW91dCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0LyoqXG5cdFx0ICogVGhlIGdpdmVuIGVkaXRvciBzY3JvbGxUb3AgKGlucHV0KS5cblx0XHQgKi9cblx0XHRwdWJsaWMgcmVhZG9ubHkgc2Nyb2xsVG9wOiBudW1iZXIsXG5cdFx0LyoqXG5cdFx0ICogVGhlIGdpdmVuIGVkaXRvciBzY3JvbGxIZWlnaHQgKGlucHV0KS5cblx0XHQgKi9cblx0XHRwdWJsaWMgcmVhZG9ubHkgc2Nyb2xsSGVpZ2h0OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHNsaWRlck5lZWRlZDogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21wdXRlZFNsaWRlclJhdGlvOiBudW1iZXIsXG5cdFx0LyoqXG5cdFx0ICogc2xpZGVyIGRvbSBub2RlIHRvcCAoaW4gQ1NTIHB4KVxuXHRcdCAqL1xuXHRcdHB1YmxpYyByZWFkb25seSBzbGlkZXJUb3A6IG51bWJlcixcblx0XHQvKipcblx0XHQgKiBzbGlkZXIgZG9tIG5vZGUgaGVpZ2h0IChpbiBDU1MgcHgpXG5cdFx0ICovXG5cdFx0cHVibGljIHJlYWRvbmx5IHNsaWRlckhlaWdodDogbnVtYmVyLFxuXHRcdC8qKlxuXHRcdCAqIGVtcHR5IGxpbmVzIHRvIHJlc2VydmUgYXQgdGhlIHRvcCBvZiB0aGUgbWluaW1hcC5cblx0XHQgKi9cblx0XHRwdWJsaWMgcmVhZG9ubHkgdG9wUGFkZGluZ0xpbmVDb3VudDogbnVtYmVyLFxuXHRcdC8qKlxuXHRcdCAqIG1pbmltYXAgcmVuZGVyIHN0YXJ0IGxpbmUgbnVtYmVyLlxuXHRcdCAqL1xuXHRcdHB1YmxpYyByZWFkb25seSBzdGFydExpbmVOdW1iZXI6IG51bWJlcixcblx0XHQvKipcblx0XHQgKiBtaW5pbWFwIHJlbmRlciBlbmQgbGluZSBudW1iZXIuXG5cdFx0ICovXG5cdFx0cHVibGljIHJlYWRvbmx5IGVuZExpbmVOdW1iZXI6IG51bWJlclxuXHQpIHsgfVxuXG5cdC8qKlxuXHQgKiBDb21wdXRlIGEgZGVzaXJlZCBgc2Nyb2xsUG9zaXRpb25gIHN1Y2ggdGhhdCB0aGUgc2xpZGVyIG1vdmVzIGJ5IGBkZWx0YWAuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0RGVzaXJlZFNjcm9sbFRvcEZyb21EZWx0YShkZWx0YTogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gTWF0aC5yb3VuZCh0aGlzLnNjcm9sbFRvcCArIGRlbHRhIC8gdGhpcy5fY29tcHV0ZWRTbGlkZXJSYXRpbyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVzaXJlZFNjcm9sbFRvcEZyb21Ub3VjaExvY2F0aW9uKHBhZ2VZOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBNYXRoLnJvdW5kKChwYWdlWSAtIHRoaXMuc2xpZGVySGVpZ2h0IC8gMikgLyB0aGlzLl9jb21wdXRlZFNsaWRlclJhdGlvKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbnRlcnNlY3QgYSBsaW5lIHJhbmdlIHdpdGggYHRoaXMuc3RhcnRMaW5lTnVtYmVyYCBhbmQgYHRoaXMuZW5kTGluZU51bWJlcmAuXG5cdCAqL1xuXHRwdWJsaWMgaW50ZXJzZWN0V2l0aFZpZXdwb3J0KHJhbmdlOiBSYW5nZSk6IFtudW1iZXIsIG51bWJlcl0gfCBudWxsIHtcblx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBNYXRoLm1heCh0aGlzLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gTWF0aC5taW4odGhpcy5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRMaW5lTnVtYmVyKTtcblx0XHRpZiAoc3RhcnRMaW5lTnVtYmVyID4gZW5kTGluZU51bWJlcikge1xuXHRcdFx0Ly8gZW50aXJlbHkgb3V0c2lkZSBtaW5pbWFwJ3Mgdmlld3BvcnRcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gW3N0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlcl07XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBpbm5lciBtaW5pbWFwIHkgY29vcmRpbmF0ZSBmb3IgYSBsaW5lIG51bWJlci5cblx0ICovXG5cdHB1YmxpYyBnZXRZRm9yTGluZU51bWJlcihsaW5lTnVtYmVyOiBudW1iZXIsIG1pbmltYXBMaW5lSGVpZ2h0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiArIChsaW5lTnVtYmVyIC0gdGhpcy5zdGFydExpbmVOdW1iZXIgKyB0aGlzLnRvcFBhZGRpbmdMaW5lQ291bnQpICogbWluaW1hcExpbmVIZWlnaHQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZShcblx0XHRvcHRpb25zOiBNaW5pbWFwT3B0aW9ucyxcblx0XHR2aWV3cG9ydFN0YXJ0TGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHZpZXdwb3J0RW5kTGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyVmVydGljYWxPZmZzZXQ6IG51bWJlcixcblx0XHR2aWV3cG9ydEhlaWdodDogbnVtYmVyLFxuXHRcdHZpZXdwb3J0Q29udGFpbnNXaGl0ZXNwYWNlR2FwczogYm9vbGVhbixcblx0XHRsaW5lQ291bnQ6IG51bWJlcixcblx0XHRyZWFsTGluZUNvdW50OiBudW1iZXIsXG5cdFx0c2Nyb2xsVG9wOiBudW1iZXIsXG5cdFx0c2Nyb2xsSGVpZ2h0OiBudW1iZXIsXG5cdFx0cHJldmlvdXNMYXlvdXQ6IE1pbmltYXBMYXlvdXQgfCBudWxsXG5cdCk6IE1pbmltYXBMYXlvdXQge1xuXHRcdGNvbnN0IHBpeGVsUmF0aW8gPSBvcHRpb25zLnBpeGVsUmF0aW87XG5cdFx0Y29uc3QgbWluaW1hcExpbmVIZWlnaHQgPSBvcHRpb25zLm1pbmltYXBMaW5lSGVpZ2h0O1xuXHRcdGNvbnN0IG1pbmltYXBMaW5lc0ZpdHRpbmcgPSBNYXRoLmZsb29yKG9wdGlvbnMuY2FudmFzSW5uZXJIZWlnaHQgLyBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IG9wdGlvbnMubGluZUhlaWdodDtcblxuXHRcdGlmIChvcHRpb25zLm1pbmltYXBIZWlnaHRJc0VkaXRvckhlaWdodCkge1xuXHRcdFx0bGV0IGxvZ2ljYWxTY3JvbGxIZWlnaHQgPSAoXG5cdFx0XHRcdHJlYWxMaW5lQ291bnQgKiBvcHRpb25zLmxpbmVIZWlnaHRcblx0XHRcdFx0KyBvcHRpb25zLnBhZGRpbmdUb3Bcblx0XHRcdFx0KyBvcHRpb25zLnBhZGRpbmdCb3R0b21cblx0XHRcdCk7XG5cdFx0XHRpZiAob3B0aW9ucy5zY3JvbGxCZXlvbmRMYXN0TGluZSkge1xuXHRcdFx0XHRsb2dpY2FsU2Nyb2xsSGVpZ2h0ICs9IE1hdGgubWF4KDAsIHZpZXdwb3J0SGVpZ2h0IC0gb3B0aW9ucy5saW5lSGVpZ2h0IC0gb3B0aW9ucy5wYWRkaW5nQm90dG9tKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNsaWRlckhlaWdodCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3Iodmlld3BvcnRIZWlnaHQgKiB2aWV3cG9ydEhlaWdodCAvIGxvZ2ljYWxTY3JvbGxIZWlnaHQpKTtcblx0XHRcdGNvbnN0IG1heE1pbmltYXBTbGlkZXJUb3AgPSBNYXRoLm1heCgwLCBvcHRpb25zLm1pbmltYXBIZWlnaHQgLSBzbGlkZXJIZWlnaHQpO1xuXHRcdFx0Ly8gVGhlIHNsaWRlciBjYW4gbW92ZSBmcm9tIDAgdG8gYG1heE1pbmltYXBTbGlkZXJUb3BgXG5cdFx0XHQvLyBpbiB0aGUgc2FtZSB3YXkgYHNjcm9sbFRvcGAgY2FuIG1vdmUgZnJvbSAwIHRvIGBzY3JvbGxIZWlnaHRgIC0gYHZpZXdwb3J0SGVpZ2h0YC5cblx0XHRcdGNvbnN0IGNvbXB1dGVkU2xpZGVyUmF0aW8gPSAobWF4TWluaW1hcFNsaWRlclRvcCkgLyAoc2Nyb2xsSGVpZ2h0IC0gdmlld3BvcnRIZWlnaHQpO1xuXHRcdFx0Y29uc3Qgc2xpZGVyVG9wID0gKHNjcm9sbFRvcCAqIGNvbXB1dGVkU2xpZGVyUmF0aW8pO1xuXHRcdFx0Y29uc3Qgc2xpZGVyTmVlZGVkID0gKG1heE1pbmltYXBTbGlkZXJUb3AgPiAwKTtcblx0XHRcdGNvbnN0IG1heExpbmVzRml0dGluZyA9IE1hdGguZmxvb3Iob3B0aW9ucy5jYW52YXNJbm5lckhlaWdodCAvIG9wdGlvbnMubWluaW1hcExpbmVIZWlnaHQpO1xuXHRcdFx0Y29uc3QgdG9wUGFkZGluZ0xpbmVDb3VudCA9IE1hdGguZmxvb3Iob3B0aW9ucy5wYWRkaW5nVG9wIC8gb3B0aW9ucy5saW5lSGVpZ2h0KTtcblx0XHRcdHJldHVybiBuZXcgTWluaW1hcExheW91dChzY3JvbGxUb3AsIHNjcm9sbEhlaWdodCwgc2xpZGVyTmVlZGVkLCBjb21wdXRlZFNsaWRlclJhdGlvLCBzbGlkZXJUb3AsIHNsaWRlckhlaWdodCwgdG9wUGFkZGluZ0xpbmVDb3VudCwgMSwgTWF0aC5taW4obGluZUNvdW50LCBtYXhMaW5lc0ZpdHRpbmcpKTtcblx0XHR9XG5cblx0XHQvLyBUaGUgdmlzaWJsZSBsaW5lIGNvdW50IGluIGEgdmlld3BvcnQgY2FuIGNoYW5nZSBkdWUgdG8gYSBudW1iZXIgb2YgcmVhc29uczpcblx0XHQvLyAgYSkgd2l0aCB0aGUgc2FtZSB2aWV3cG9ydCB3aWR0aCwgZGlmZmVyZW50IHNjcm9sbCBwb3NpdGlvbnMgY2FuIHJlc3VsdCBpbiBwYXJ0aWFsIGxpbmVzIGJlaW5nIHZpc2libGU6XG5cdFx0Ly8gICAgZS5nLiBmb3IgYSBsaW5lIGhlaWdodCBvZiAyMCwgYW5kIGEgdmlld3BvcnQgaGVpZ2h0IG9mIDYwMFxuXHRcdC8vICAgICAgICAgICogc2Nyb2xsVG9wID0gMCAgPT4gdmlzaWJsZSBsaW5lcyBhcmUgWzEsIDMwXVxuXHRcdC8vICAgICAgICAgICogc2Nyb2xsVG9wID0gMTAgPT4gdmlzaWJsZSBsaW5lcyBhcmUgWzEsIDMxXSAod2l0aCBsaW5lcyAxIGFuZCAzMSBwYXJ0aWFsbHkgdmlzaWJsZSlcblx0XHQvLyAgICAgICAgICAqIHNjcm9sbFRvcCA9IDIwID0+IHZpc2libGUgbGluZXMgYXJlIFsyLCAzMV1cblx0XHQvLyAgYikgd2hpdGVzcGFjZSBnYXBzIG1pZ2h0IG1ha2UgdGhlaXIgd2F5IGluIHRoZSB2aWV3cG9ydCAod2hpY2ggcmVzdWx0cyBpbiBhIGRlY3JlYXNlIGluIHRoZSB2aXNpYmxlIGxpbmUgY291bnQpXG5cdFx0Ly8gIGMpIHdlIGNvdWxkIGJlIGluIHRoZSBzY3JvbGwgYmV5b25kIGxhc3QgbGluZSBjYXNlICh3aGljaCBhbHNvIHJlc3VsdHMgaW4gYSBkZWNyZWFzZSBpbiB0aGUgdmlzaWJsZSBsaW5lIGNvdW50LCBkb3duIHRvIHBvc3NpYmx5IG9ubHkgb25lIGxpbmUgYmVpbmcgdmlzaWJsZSlcblxuXHRcdC8vIFdlIG11c3QgZmlyc3QgZXN0YWJsaXNoIGEgZGVzaXJhYmxlIHNsaWRlciBoZWlnaHQuXG5cdFx0bGV0IHNsaWRlckhlaWdodDogbnVtYmVyO1xuXHRcdGlmICh2aWV3cG9ydENvbnRhaW5zV2hpdGVzcGFjZUdhcHMgJiYgdmlld3BvcnRFbmRMaW5lTnVtYmVyICE9PSBsaW5lQ291bnQpIHtcblx0XHRcdC8vIGNhc2UgYikgZnJvbSBhYm92ZTogdGhlcmUgYXJlIHdoaXRlc3BhY2UgZ2FwcyBpbiB0aGUgdmlld3BvcnQuXG5cdFx0XHQvLyBJbiB0aGlzIGNhc2UsIHRoZSBoZWlnaHQgb2YgdGhlIHNsaWRlciBkaXJlY3RseSByZWZsZWN0cyB0aGUgdmlzaWJsZSBsaW5lIGNvdW50LlxuXHRcdFx0Y29uc3Qgdmlld3BvcnRMaW5lQ291bnQgPSB2aWV3cG9ydEVuZExpbmVOdW1iZXIgLSB2aWV3cG9ydFN0YXJ0TGluZU51bWJlciArIDE7XG5cdFx0XHRzbGlkZXJIZWlnaHQgPSBNYXRoLmZsb29yKHZpZXdwb3J0TGluZUNvdW50ICogbWluaW1hcExpbmVIZWlnaHQgLyBwaXhlbFJhdGlvKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gVGhlIHNsaWRlciBoYXMgYSBzdGFibGUgaGVpZ2h0XG5cdFx0XHRjb25zdCBleHBlY3RlZFZpZXdwb3J0TGluZUNvdW50ID0gdmlld3BvcnRIZWlnaHQgLyBsaW5lSGVpZ2h0O1xuXHRcdFx0c2xpZGVySGVpZ2h0ID0gTWF0aC5mbG9vcihleHBlY3RlZFZpZXdwb3J0TGluZUNvdW50ICogbWluaW1hcExpbmVIZWlnaHQgLyBwaXhlbFJhdGlvKTtcblx0XHR9XG5cblx0XHRjb25zdCBleHRyYUxpbmVzQXRUaGVUb3AgPSBNYXRoLmZsb29yKG9wdGlvbnMucGFkZGluZ1RvcCAvIGxpbmVIZWlnaHQpO1xuXHRcdGxldCBleHRyYUxpbmVzQXRUaGVCb3R0b20gPSBNYXRoLmZsb29yKG9wdGlvbnMucGFkZGluZ0JvdHRvbSAvIGxpbmVIZWlnaHQpO1xuXHRcdGlmIChvcHRpb25zLnNjcm9sbEJleW9uZExhc3RMaW5lKSB7XG5cdFx0XHRjb25zdCBleHBlY3RlZFZpZXdwb3J0TGluZUNvdW50ID0gdmlld3BvcnRIZWlnaHQgLyBsaW5lSGVpZ2h0O1xuXHRcdFx0ZXh0cmFMaW5lc0F0VGhlQm90dG9tID0gTWF0aC5tYXgoZXh0cmFMaW5lc0F0VGhlQm90dG9tLCBleHBlY3RlZFZpZXdwb3J0TGluZUNvdW50IC0gMSk7XG5cdFx0fVxuXG5cdFx0bGV0IG1heE1pbmltYXBTbGlkZXJUb3A6IG51bWJlcjtcblx0XHRpZiAoZXh0cmFMaW5lc0F0VGhlQm90dG9tID4gMCkge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRWaWV3cG9ydExpbmVDb3VudCA9IHZpZXdwb3J0SGVpZ2h0IC8gbGluZUhlaWdodDtcblx0XHRcdC8vIFRoZSBtaW5pbWFwIHNsaWRlciwgd2hlbiBkcmFnZ2VkIGFsbCB0aGUgd2F5IGRvd24sIHdpbGwgY29udGFpbiB0aGUgbGFzdCBsaW5lIGF0IGl0cyB0b3Bcblx0XHRcdG1heE1pbmltYXBTbGlkZXJUb3AgPSAoZXh0cmFMaW5lc0F0VGhlVG9wICsgbGluZUNvdW50ICsgZXh0cmFMaW5lc0F0VGhlQm90dG9tIC0gZXhwZWN0ZWRWaWV3cG9ydExpbmVDb3VudCAtIDEpICogbWluaW1hcExpbmVIZWlnaHQgLyBwaXhlbFJhdGlvO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUaGUgbWluaW1hcCBzbGlkZXIsIHdoZW4gZHJhZ2dlZCBhbGwgdGhlIHdheSBkb3duLCB3aWxsIGNvbnRhaW4gdGhlIGxhc3QgbGluZSBhdCBpdHMgYm90dG9tXG5cdFx0XHRtYXhNaW5pbWFwU2xpZGVyVG9wID0gTWF0aC5tYXgoMCwgKGV4dHJhTGluZXNBdFRoZVRvcCArIGxpbmVDb3VudCkgKiBtaW5pbWFwTGluZUhlaWdodCAvIHBpeGVsUmF0aW8gLSBzbGlkZXJIZWlnaHQpO1xuXHRcdH1cblx0XHRtYXhNaW5pbWFwU2xpZGVyVG9wID0gTWF0aC5taW4ob3B0aW9ucy5taW5pbWFwSGVpZ2h0IC0gc2xpZGVySGVpZ2h0LCBtYXhNaW5pbWFwU2xpZGVyVG9wKTtcblxuXHRcdC8vIFRoZSBzbGlkZXIgY2FuIG1vdmUgZnJvbSAwIHRvIGBtYXhNaW5pbWFwU2xpZGVyVG9wYFxuXHRcdC8vIGluIHRoZSBzYW1lIHdheSBgc2Nyb2xsVG9wYCBjYW4gbW92ZSBmcm9tIDAgdG8gYHNjcm9sbEhlaWdodGAgLSBgdmlld3BvcnRIZWlnaHRgLlxuXHRcdGNvbnN0IGNvbXB1dGVkU2xpZGVyUmF0aW8gPSAobWF4TWluaW1hcFNsaWRlclRvcCkgLyAoc2Nyb2xsSGVpZ2h0IC0gdmlld3BvcnRIZWlnaHQpO1xuXHRcdGNvbnN0IHNsaWRlclRvcCA9IChzY3JvbGxUb3AgKiBjb21wdXRlZFNsaWRlclJhdGlvKTtcblxuXHRcdGlmIChtaW5pbWFwTGluZXNGaXR0aW5nID49IGV4dHJhTGluZXNBdFRoZVRvcCArIGxpbmVDb3VudCArIGV4dHJhTGluZXNBdFRoZUJvdHRvbSkge1xuXHRcdFx0Ly8gQWxsIGxpbmVzIGZpdCBpbiB0aGUgbWluaW1hcFxuXHRcdFx0Y29uc3Qgc2xpZGVyTmVlZGVkID0gKG1heE1pbmltYXBTbGlkZXJUb3AgPiAwKTtcblx0XHRcdHJldHVybiBuZXcgTWluaW1hcExheW91dChzY3JvbGxUb3AsIHNjcm9sbEhlaWdodCwgc2xpZGVyTmVlZGVkLCBjb21wdXRlZFNsaWRlclJhdGlvLCBzbGlkZXJUb3AsIHNsaWRlckhlaWdodCwgZXh0cmFMaW5lc0F0VGhlVG9wLCAxLCBsaW5lQ291bnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQgY29uc2lkZXJpbmdTdGFydExpbmVOdW1iZXI6IG51bWJlcjtcblx0XHRcdGlmICh2aWV3cG9ydFN0YXJ0TGluZU51bWJlciA+IDEpIHtcblx0XHRcdFx0Y29uc2lkZXJpbmdTdGFydExpbmVOdW1iZXIgPSB2aWV3cG9ydFN0YXJ0TGluZU51bWJlciArIGV4dHJhTGluZXNBdFRoZVRvcDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNpZGVyaW5nU3RhcnRMaW5lTnVtYmVyID0gTWF0aC5tYXgoMSwgc2Nyb2xsVG9wIC8gbGluZUhlaWdodCk7XG5cdFx0XHR9XG5cblx0XHRcdGxldCB0b3BQYWRkaW5nTGluZUNvdW50OiBudW1iZXI7XG5cdFx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihjb25zaWRlcmluZ1N0YXJ0TGluZU51bWJlciAtIHNsaWRlclRvcCAqIHBpeGVsUmF0aW8gLyBtaW5pbWFwTGluZUhlaWdodCkpO1xuXHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlciA8IGV4dHJhTGluZXNBdFRoZVRvcCkge1xuXHRcdFx0XHR0b3BQYWRkaW5nTGluZUNvdW50ID0gZXh0cmFMaW5lc0F0VGhlVG9wIC0gc3RhcnRMaW5lTnVtYmVyICsgMTtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyID0gMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRvcFBhZGRpbmdMaW5lQ291bnQgPSAwO1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXIgPSBNYXRoLm1heCgxLCBzdGFydExpbmVOdW1iZXIgLSBleHRyYUxpbmVzQXRUaGVUb3ApO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBdm9pZCBmbGlja2VyaW5nIGNhdXNlZCBieSBhIHBhcnRpYWwgdmlld3BvcnQgc3RhcnQgbGluZVxuXHRcdFx0Ly8gYnkgYmVpbmcgY29uc2lzdGVudCB3LnIudC4gdGhlIHByZXZpb3VzIGxheW91dCBkZWNpc2lvblxuXHRcdFx0aWYgKHByZXZpb3VzTGF5b3V0ICYmIHByZXZpb3VzTGF5b3V0LnNjcm9sbEhlaWdodCA9PT0gc2Nyb2xsSGVpZ2h0KSB7XG5cdFx0XHRcdGlmIChwcmV2aW91c0xheW91dC5zY3JvbGxUb3AgPiBzY3JvbGxUb3ApIHtcblx0XHRcdFx0XHQvLyBTY3JvbGxpbmcgdXAgPT4gbmV2ZXIgaW5jcmVhc2UgYHN0YXJ0TGluZU51bWJlcmBcblx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXIgPSBNYXRoLm1pbihzdGFydExpbmVOdW1iZXIsIHByZXZpb3VzTGF5b3V0LnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdFx0dG9wUGFkZGluZ0xpbmVDb3VudCA9IE1hdGgubWF4KHRvcFBhZGRpbmdMaW5lQ291bnQsIHByZXZpb3VzTGF5b3V0LnRvcFBhZGRpbmdMaW5lQ291bnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChwcmV2aW91c0xheW91dC5zY3JvbGxUb3AgPCBzY3JvbGxUb3ApIHtcblx0XHRcdFx0XHQvLyBTY3JvbGxpbmcgZG93biA9PiBuZXZlciBkZWNyZWFzZSBgc3RhcnRMaW5lTnVtYmVyYFxuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlciA9IE1hdGgubWF4KHN0YXJ0TGluZU51bWJlciwgcHJldmlvdXNMYXlvdXQuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHR0b3BQYWRkaW5nTGluZUNvdW50ID0gTWF0aC5taW4odG9wUGFkZGluZ0xpbmVDb3VudCwgcHJldmlvdXNMYXlvdXQudG9wUGFkZGluZ0xpbmVDb3VudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IE1hdGgubWluKGxpbmVDb3VudCwgc3RhcnRMaW5lTnVtYmVyIC0gdG9wUGFkZGluZ0xpbmVDb3VudCArIG1pbmltYXBMaW5lc0ZpdHRpbmcgLSAxKTtcblx0XHRcdGNvbnN0IHBhcnRpYWxMaW5lID0gKHNjcm9sbFRvcCAtIHZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyVmVydGljYWxPZmZzZXQpIC8gbGluZUhlaWdodDtcblxuXHRcdFx0bGV0IHNsaWRlclRvcEFsaWduZWQ6IG51bWJlcjtcblx0XHRcdGlmIChzY3JvbGxUb3AgPj0gb3B0aW9ucy5wYWRkaW5nVG9wKSB7XG5cdFx0XHRcdHNsaWRlclRvcEFsaWduZWQgPSAodmlld3BvcnRTdGFydExpbmVOdW1iZXIgLSBzdGFydExpbmVOdW1iZXIgKyB0b3BQYWRkaW5nTGluZUNvdW50ICsgcGFydGlhbExpbmUpICogbWluaW1hcExpbmVIZWlnaHQgLyBwaXhlbFJhdGlvO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2xpZGVyVG9wQWxpZ25lZCA9IChzY3JvbGxUb3AgLyBvcHRpb25zLnBhZGRpbmdUb3ApICogKHRvcFBhZGRpbmdMaW5lQ291bnQgKyBwYXJ0aWFsTGluZSkgKiBtaW5pbWFwTGluZUhlaWdodCAvIHBpeGVsUmF0aW87XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgTWluaW1hcExheW91dChzY3JvbGxUb3AsIHNjcm9sbEhlaWdodCwgdHJ1ZSwgY29tcHV0ZWRTbGlkZXJSYXRpbywgc2xpZGVyVG9wQWxpZ25lZCwgc2xpZGVySGVpZ2h0LCB0b3BQYWRkaW5nTGluZUNvdW50LCBzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBNaW5pbWFwTGluZSBpbXBsZW1lbnRzIElMaW5lIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElOVkFMSUQgPSBuZXcgTWluaW1hcExpbmUoLTEpO1xuXG5cdGR5OiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoZHk6IG51bWJlcikge1xuXHRcdHRoaXMuZHkgPSBkeTtcblx0fVxuXG5cdHB1YmxpYyBvbkNvbnRlbnRDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuZHkgPSAtMTtcblx0fVxuXG5cdHB1YmxpYyBvblRva2Vuc0NoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5keSA9IC0xO1xuXHR9XG59XG5cbmNsYXNzIFJlbmRlckRhdGEge1xuXHQvKipcblx0ICogbGFzdCByZW5kZXJlZCBsYXlvdXQuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgcmVuZGVyZWRMYXlvdXQ6IE1pbmltYXBMYXlvdXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ltYWdlRGF0YTogSW1hZ2VEYXRhO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJlZExpbmVzOiBSZW5kZXJlZExpbmVzQ29sbGVjdGlvbjxNaW5pbWFwTGluZT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVuZGVyZWRMYXlvdXQ6IE1pbmltYXBMYXlvdXQsXG5cdFx0aW1hZ2VEYXRhOiBJbWFnZURhdGEsXG5cdFx0bGluZXM6IE1pbmltYXBMaW5lW11cblx0KSB7XG5cdFx0dGhpcy5yZW5kZXJlZExheW91dCA9IHJlbmRlcmVkTGF5b3V0O1xuXHRcdHRoaXMuX2ltYWdlRGF0YSA9IGltYWdlRGF0YTtcblx0XHR0aGlzLl9yZW5kZXJlZExpbmVzID0gbmV3IFJlbmRlcmVkTGluZXNDb2xsZWN0aW9uKHtcblx0XHRcdGNyZWF0ZUxpbmU6ICgpID0+IE1pbmltYXBMaW5lLklOVkFMSURcblx0XHR9KTtcblx0XHR0aGlzLl9yZW5kZXJlZExpbmVzLl9zZXQocmVuZGVyZWRMYXlvdXQuc3RhcnRMaW5lTnVtYmVyLCBsaW5lcyk7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGN1cnJlbnQgUmVuZGVyRGF0YSBtYXRjaGVzIGFjY3VyYXRlbHkgdGhlIG5ldyBkZXNpcmVkIGxheW91dCBhbmQgbm8gcGFpbnRpbmcgaXMgbmVlZGVkLlxuXHQgKi9cblx0cHVibGljIGxpbmVzRXF1YWxzKGxheW91dDogTWluaW1hcExheW91dCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5zY3JvbGxFcXVhbHMobGF5b3V0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRtcCA9IHRoaXMuX3JlbmRlcmVkTGluZXMuX2dldCgpO1xuXHRcdGNvbnN0IGxpbmVzID0gdG1wLmxpbmVzO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKGxpbmVzW2ldLmR5ID09PSAtMSkge1xuXHRcdFx0XHQvLyBUaGlzIGxpbmUgaXMgaW52YWxpZFxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGN1cnJlbnQgUmVuZGVyRGF0YSBtYXRjaGVzIHRoZSBuZXcgbGF5b3V0J3Mgc2Nyb2xsIHBvc2l0aW9uXG5cdCAqL1xuXHRwdWJsaWMgc2Nyb2xsRXF1YWxzKGxheW91dDogTWluaW1hcExheW91dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJlbmRlcmVkTGF5b3V0LnN0YXJ0TGluZU51bWJlciA9PT0gbGF5b3V0LnN0YXJ0TGluZU51bWJlclxuXHRcdFx0JiYgdGhpcy5yZW5kZXJlZExheW91dC5lbmRMaW5lTnVtYmVyID09PSBsYXlvdXQuZW5kTGluZU51bWJlcjtcblx0fVxuXG5cdF9nZXQoKTogeyBpbWFnZURhdGE6IEltYWdlRGF0YTsgcmVuZExpbmVOdW1iZXJTdGFydDogbnVtYmVyOyBsaW5lczogTWluaW1hcExpbmVbXSB9IHtcblx0XHRjb25zdCB0bXAgPSB0aGlzLl9yZW5kZXJlZExpbmVzLl9nZXQoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW1hZ2VEYXRhOiB0aGlzLl9pbWFnZURhdGEsXG5cdFx0XHRyZW5kTGluZU51bWJlclN0YXJ0OiB0bXAucmVuZExpbmVOdW1iZXJTdGFydCxcblx0XHRcdGxpbmVzOiB0bXAubGluZXNcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIG9uTGluZXNDaGFuZ2VkKGNoYW5nZUZyb21MaW5lTnVtYmVyOiBudW1iZXIsIGNoYW5nZUNvdW50OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRMaW5lcy5vbkxpbmVzQ2hhbmdlZChjaGFuZ2VGcm9tTGluZU51bWJlciwgY2hhbmdlQ291bnQpO1xuXHR9XG5cdHB1YmxpYyBvbkxpbmVzRGVsZXRlZChkZWxldGVGcm9tTGluZU51bWJlcjogbnVtYmVyLCBkZWxldGVUb0xpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmRlcmVkTGluZXMub25MaW5lc0RlbGV0ZWQoZGVsZXRlRnJvbUxpbmVOdW1iZXIsIGRlbGV0ZVRvTGluZU51bWJlcik7XG5cdH1cblx0cHVibGljIG9uTGluZXNJbnNlcnRlZChpbnNlcnRGcm9tTGluZU51bWJlcjogbnVtYmVyLCBpbnNlcnRUb0xpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmRlcmVkTGluZXMub25MaW5lc0luc2VydGVkKGluc2VydEZyb21MaW5lTnVtYmVyLCBpbnNlcnRUb0xpbmVOdW1iZXIpO1xuXHR9XG5cdHB1YmxpYyBvblRva2Vuc0NoYW5nZWQocmFuZ2VzOiB7IGZyb21MaW5lTnVtYmVyOiBudW1iZXI7IHRvTGluZU51bWJlcjogbnVtYmVyIH1bXSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZExpbmVzLm9uVG9rZW5zQ2hhbmdlZChyYW5nZXMpO1xuXHR9XG59XG5cbi8qKlxuICogU29tZSBzb3J0IG9mIGRvdWJsZSBidWZmZXJpbmcuXG4gKlxuICogS2VlcHMgdHdvIGJ1ZmZlcnMgYXJvdW5kIHRoYXQgd2lsbCBiZSByb3RhdGVkIGZvciBwYWludGluZy5cbiAqIEFsd2F5cyBnaXZlcyBhIGJ1ZmZlciB0aGF0IGlzIGZpbGxlZCB3aXRoIHRoZSBiYWNrZ3JvdW5kIGNvbG9yLlxuICovXG5jbGFzcyBNaW5pbWFwQnVmZmVycyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYmFja2dyb3VuZEZpbGxEYXRhOiBVaW50OENsYW1wZWRBcnJheTtcblx0cHJpdmF0ZSByZWFkb25seSBfYnVmZmVyczogW0ltYWdlRGF0YSwgSW1hZ2VEYXRhXTtcblx0cHJpdmF0ZSBfbGFzdFVzZWRCdWZmZXI6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCwgV0lEVEg6IG51bWJlciwgSEVJR0hUOiBudW1iZXIsIGJhY2tncm91bmQ6IFJHQkE4KSB7XG5cdFx0dGhpcy5fYmFja2dyb3VuZEZpbGxEYXRhID0gTWluaW1hcEJ1ZmZlcnMuX2NyZWF0ZUJhY2tncm91bmRGaWxsRGF0YShXSURUSCwgSEVJR0hULCBiYWNrZ3JvdW5kKTtcblx0XHR0aGlzLl9idWZmZXJzID0gW1xuXHRcdFx0Y3R4LmNyZWF0ZUltYWdlRGF0YShXSURUSCwgSEVJR0hUKSxcblx0XHRcdGN0eC5jcmVhdGVJbWFnZURhdGEoV0lEVEgsIEhFSUdIVClcblx0XHRdO1xuXHRcdHRoaXMuX2xhc3RVc2VkQnVmZmVyID0gMDtcblx0fVxuXG5cdHB1YmxpYyBnZXRCdWZmZXIoKTogSW1hZ2VEYXRhIHtcblx0XHQvLyByb3RhdGUgYnVmZmVyc1xuXHRcdHRoaXMuX2xhc3RVc2VkQnVmZmVyID0gMSAtIHRoaXMuX2xhc3RVc2VkQnVmZmVyO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2J1ZmZlcnNbdGhpcy5fbGFzdFVzZWRCdWZmZXJdO1xuXG5cdFx0Ly8gZmlsbCB3aXRoIGJhY2tncm91bmQgY29sb3Jcblx0XHRyZXN1bHQuZGF0YS5zZXQodGhpcy5fYmFja2dyb3VuZEZpbGxEYXRhKTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY3JlYXRlQmFja2dyb3VuZEZpbGxEYXRhKFdJRFRIOiBudW1iZXIsIEhFSUdIVDogbnVtYmVyLCBiYWNrZ3JvdW5kOiBSR0JBOCk6IFVpbnQ4Q2xhbXBlZEFycmF5IHtcblx0XHRjb25zdCBiYWNrZ3JvdW5kUiA9IGJhY2tncm91bmQucjtcblx0XHRjb25zdCBiYWNrZ3JvdW5kRyA9IGJhY2tncm91bmQuZztcblx0XHRjb25zdCBiYWNrZ3JvdW5kQiA9IGJhY2tncm91bmQuYjtcblx0XHRjb25zdCBiYWNrZ3JvdW5kQSA9IGJhY2tncm91bmQuYTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OENsYW1wZWRBcnJheShXSURUSCAqIEhFSUdIVCAqIDQpO1xuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgSEVJR0hUOyBpKyspIHtcblx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgV0lEVEg7IGorKykge1xuXHRcdFx0XHRyZXN1bHRbb2Zmc2V0XSA9IGJhY2tncm91bmRSO1xuXHRcdFx0XHRyZXN1bHRbb2Zmc2V0ICsgMV0gPSBiYWNrZ3JvdW5kRztcblx0XHRcdFx0cmVzdWx0W29mZnNldCArIDJdID0gYmFja2dyb3VuZEI7XG5cdFx0XHRcdHJlc3VsdFtvZmZzZXQgKyAzXSA9IGJhY2tncm91bmRBO1xuXHRcdFx0XHRvZmZzZXQgKz0gNDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pbmltYXBNb2RlbCB7XG5cdHJlYWRvbmx5IHRva2Vuc0NvbG9yVHJhY2tlcjogTWluaW1hcFRva2Vuc0NvbG9yVHJhY2tlcjtcblx0cmVhZG9ubHkgb3B0aW9uczogTWluaW1hcE9wdGlvbnM7XG5cblx0Z2V0TGluZUNvdW50KCk6IG51bWJlcjtcblx0Z2V0UmVhbExpbmVDb3VudCgpOiBudW1iZXI7XG5cdGdldExpbmVDb250ZW50KGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZztcblx0Z2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXI7XG5cdGdldE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgbmVlZGVkOiBib29sZWFuW10pOiAoVmlld0xpbmVEYXRhIHwgbnVsbClbXTtcblx0Z2V0U2VsZWN0aW9ucygpOiBTZWxlY3Rpb25bXTtcblx0Z2V0TWluaW1hcERlY29yYXRpb25zSW5WaWV3cG9ydChzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyKTogVmlld01vZGVsRGVjb3JhdGlvbltdO1xuXHRnZXRTZWN0aW9uSGVhZGVyRGVjb3JhdGlvbnNJblZpZXdwb3J0KHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIpOiBWaWV3TW9kZWxEZWNvcmF0aW9uW107XG5cdGdldFNlY3Rpb25IZWFkZXJUZXh0KGRlY29yYXRpb246IFZpZXdNb2RlbERlY29yYXRpb24sIGZpdFdpZHRoOiAoczogc3RyaW5nKSA9PiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsO1xuXHRnZXRPcHRpb25zKCk6IFRleHRNb2RlbFJlc29sdmVkT3B0aW9ucztcblx0cmV2ZWFsTGluZU51bWJlcihsaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkO1xuXHRzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSU1pbmltYXBSZW5kZXJpbmdDb250ZXh0IHtcblx0cmVhZG9ubHkgdmlld3BvcnRDb250YWluc1doaXRlc3BhY2VHYXBzOiBib29sZWFuO1xuXG5cdHJlYWRvbmx5IHNjcm9sbFdpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNjcm9sbEhlaWdodDogbnVtYmVyO1xuXG5cdHJlYWRvbmx5IHZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdHJlYWRvbmx5IHZpZXdwb3J0RW5kTGluZU51bWJlcjogbnVtYmVyO1xuXHRyZWFkb25seSB2aWV3cG9ydFN0YXJ0TGluZU51bWJlclZlcnRpY2FsT2Zmc2V0OiBudW1iZXI7XG5cblx0cmVhZG9ubHkgc2Nyb2xsVG9wOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNjcm9sbExlZnQ6IG51bWJlcjtcblxuXHRyZWFkb25seSB2aWV3cG9ydFdpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IHZpZXdwb3J0SGVpZ2h0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBTYW1wbGluZ1N0YXRlTGluZXNEZWxldGVkRXZlbnQge1xuXHR0eXBlOiAnZGVsZXRlZCc7XG5cdF9vbGRJbmRleDogbnVtYmVyO1xuXHRkZWxldGVGcm9tTGluZU51bWJlcjogbnVtYmVyO1xuXHRkZWxldGVUb0xpbmVOdW1iZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFNhbXBsaW5nU3RhdGVMaW5lc0luc2VydGVkRXZlbnQge1xuXHR0eXBlOiAnaW5zZXJ0ZWQnO1xuXHRfaTogbnVtYmVyO1xuXHRpbnNlcnRGcm9tTGluZU51bWJlcjogbnVtYmVyO1xuXHRpbnNlcnRUb0xpbmVOdW1iZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFNhbXBsaW5nU3RhdGVGbHVzaEV2ZW50IHtcblx0dHlwZTogJ2ZsdXNoJztcbn1cblxudHlwZSBTYW1wbGluZ1N0YXRlRXZlbnQgPSBTYW1wbGluZ1N0YXRlTGluZXNJbnNlcnRlZEV2ZW50IHwgU2FtcGxpbmdTdGF0ZUxpbmVzRGVsZXRlZEV2ZW50IHwgU2FtcGxpbmdTdGF0ZUZsdXNoRXZlbnQ7XG5cbmNsYXNzIE1pbmltYXBTYW1wbGluZ1N0YXRlIHtcblxuXHRwdWJsaWMgc3RhdGljIGNvbXB1dGUob3B0aW9uczogTWluaW1hcE9wdGlvbnMsIHZpZXdMaW5lQ291bnQ6IG51bWJlciwgb2xkU2FtcGxpbmdTdGF0ZTogTWluaW1hcFNhbXBsaW5nU3RhdGUgfCBudWxsKTogW01pbmltYXBTYW1wbGluZ1N0YXRlIHwgbnVsbCwgU2FtcGxpbmdTdGF0ZUV2ZW50W11dIHtcblx0XHRpZiAob3B0aW9ucy5yZW5kZXJNaW5pbWFwID09PSBSZW5kZXJNaW5pbWFwLk5vbmUgfHwgIW9wdGlvbnMuaXNTYW1wbGluZykge1xuXHRcdFx0cmV0dXJuIFtudWxsLCBbXV07XG5cdFx0fVxuXG5cdFx0Ly8gcmF0aW8gaXMgaW50ZW50aW9uYWxseSBub3QgcGFydCBvZiB0aGUgbGF5b3V0IHRvIGF2b2lkIHRoZSBsYXlvdXQgY2hhbmdpbmcgYWxsIHRoZSB0aW1lXG5cdFx0Ly8gc28gd2UgbmVlZCB0byByZWNvbXB1dGUgaXQgYWdhaW4uLi5cblx0XHRjb25zdCB7IG1pbmltYXBMaW5lQ291bnQgfSA9IEVkaXRvckxheW91dEluZm9Db21wdXRlci5jb21wdXRlQ29udGFpbmVkTWluaW1hcExpbmVDb3VudCh7XG5cdFx0XHR2aWV3TGluZUNvdW50OiB2aWV3TGluZUNvdW50LFxuXHRcdFx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IG9wdGlvbnMuc2Nyb2xsQmV5b25kTGFzdExpbmUsXG5cdFx0XHRwYWRkaW5nVG9wOiBvcHRpb25zLnBhZGRpbmdUb3AsXG5cdFx0XHRwYWRkaW5nQm90dG9tOiBvcHRpb25zLnBhZGRpbmdCb3R0b20sXG5cdFx0XHRoZWlnaHQ6IG9wdGlvbnMuZWRpdG9ySGVpZ2h0LFxuXHRcdFx0bGluZUhlaWdodDogb3B0aW9ucy5saW5lSGVpZ2h0LFxuXHRcdFx0cGl4ZWxSYXRpbzogb3B0aW9ucy5waXhlbFJhdGlvXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmF0aW8gPSB2aWV3TGluZUNvdW50IC8gbWluaW1hcExpbmVDb3VudDtcblx0XHRjb25zdCBoYWxmUmF0aW8gPSByYXRpbyAvIDI7XG5cblx0XHRpZiAoIW9sZFNhbXBsaW5nU3RhdGUgfHwgb2xkU2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRyZXN1bHRbMF0gPSAxO1xuXHRcdFx0aWYgKG1pbmltYXBMaW5lQ291bnQgPiAxKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsYXN0SW5kZXggPSBtaW5pbWFwTGluZUNvdW50IC0gMTsgaSA8IGxhc3RJbmRleDsgaSsrKSB7XG5cdFx0XHRcdFx0cmVzdWx0W2ldID0gTWF0aC5yb3VuZChpICogcmF0aW8gKyBoYWxmUmF0aW8pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3VsdFttaW5pbWFwTGluZUNvdW50IC0gMV0gPSB2aWV3TGluZUNvdW50O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFtuZXcgTWluaW1hcFNhbXBsaW5nU3RhdGUocmF0aW8sIHJlc3VsdCksIFtdXTtcblx0XHR9XG5cblx0XHRjb25zdCBvbGRNaW5pbWFwTGluZXMgPSBvbGRTYW1wbGluZ1N0YXRlLm1pbmltYXBMaW5lcztcblx0XHRjb25zdCBvbGRMZW5ndGggPSBvbGRNaW5pbWFwTGluZXMubGVuZ3RoO1xuXHRcdGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcblx0XHRsZXQgb2xkSW5kZXggPSAwO1xuXHRcdGxldCBvbGREZWx0YUxpbmVDb3VudCA9IDA7XG5cdFx0bGV0IG1pblZpZXdMaW5lTnVtYmVyID0gMTtcblx0XHRjb25zdCBNQVhfRVZFTlRfQ09VTlQgPSAxMDsgLy8gZ2VuZXJhdGUgYXQgbW9zdCAxMCBldmVudHMsIGlmIHRoZXJlIGFyZSBtb3JlIHRoYW4gMTAgY2hhbmdlcywganVzdCBmbHVzaCBhbGwgcHJldmlvdXMgZGF0YVxuXHRcdGxldCBldmVudHM6IFNhbXBsaW5nU3RhdGVFdmVudFtdID0gW107XG5cdFx0bGV0IGxhc3RFdmVudDogU2FtcGxpbmdTdGF0ZUV2ZW50IHwgbnVsbCA9IG51bGw7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtaW5pbWFwTGluZUNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IGZyb21WaWV3TGluZU51bWJlciA9IE1hdGgubWF4KG1pblZpZXdMaW5lTnVtYmVyLCBNYXRoLnJvdW5kKGkgKiByYXRpbykpO1xuXHRcdFx0Y29uc3QgdG9WaWV3TGluZU51bWJlciA9IE1hdGgubWF4KGZyb21WaWV3TGluZU51bWJlciwgTWF0aC5yb3VuZCgoaSArIDEpICogcmF0aW8pKTtcblxuXHRcdFx0d2hpbGUgKG9sZEluZGV4IDwgb2xkTGVuZ3RoICYmIG9sZE1pbmltYXBMaW5lc1tvbGRJbmRleF0gPCBmcm9tVmlld0xpbmVOdW1iZXIpIHtcblx0XHRcdFx0aWYgKGV2ZW50cy5sZW5ndGggPCBNQVhfRVZFTlRfQ09VTlQpIHtcblx0XHRcdFx0XHRjb25zdCBvbGRNaW5pbWFwTGluZU51bWJlciA9IG9sZEluZGV4ICsgMSArIG9sZERlbHRhTGluZUNvdW50O1xuXHRcdFx0XHRcdGlmIChsYXN0RXZlbnQgJiYgbGFzdEV2ZW50LnR5cGUgPT09ICdkZWxldGVkJyAmJiBsYXN0RXZlbnQuX29sZEluZGV4ID09PSBvbGRJbmRleCAtIDEpIHtcblx0XHRcdFx0XHRcdGxhc3RFdmVudC5kZWxldGVUb0xpbmVOdW1iZXIrKztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bGFzdEV2ZW50ID0geyB0eXBlOiAnZGVsZXRlZCcsIF9vbGRJbmRleDogb2xkSW5kZXgsIGRlbGV0ZUZyb21MaW5lTnVtYmVyOiBvbGRNaW5pbWFwTGluZU51bWJlciwgZGVsZXRlVG9MaW5lTnVtYmVyOiBvbGRNaW5pbWFwTGluZU51bWJlciB9O1xuXHRcdFx0XHRcdFx0ZXZlbnRzLnB1c2gobGFzdEV2ZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b2xkRGVsdGFMaW5lQ291bnQtLTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvbGRJbmRleCsrO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc2VsZWN0ZWRWaWV3TGluZU51bWJlcjogbnVtYmVyO1xuXHRcdFx0aWYgKG9sZEluZGV4IDwgb2xkTGVuZ3RoICYmIG9sZE1pbmltYXBMaW5lc1tvbGRJbmRleF0gPD0gdG9WaWV3TGluZU51bWJlcikge1xuXHRcdFx0XHQvLyByZXVzZSB0aGUgb2xkIHNhbXBsZWQgbGluZVxuXHRcdFx0XHRzZWxlY3RlZFZpZXdMaW5lTnVtYmVyID0gb2xkTWluaW1hcExpbmVzW29sZEluZGV4XTtcblx0XHRcdFx0b2xkSW5kZXgrKztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChpID09PSAwKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRWaWV3TGluZU51bWJlciA9IDE7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaSArIDEgPT09IG1pbmltYXBMaW5lQ291bnQpIHtcblx0XHRcdFx0XHRzZWxlY3RlZFZpZXdMaW5lTnVtYmVyID0gdmlld0xpbmVDb3VudDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWxlY3RlZFZpZXdMaW5lTnVtYmVyID0gTWF0aC5yb3VuZChpICogcmF0aW8gKyBoYWxmUmF0aW8pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChldmVudHMubGVuZ3RoIDwgTUFYX0VWRU5UX0NPVU5UKSB7XG5cdFx0XHRcdFx0Y29uc3Qgb2xkTWluaW1hcExpbmVOdW1iZXIgPSBvbGRJbmRleCArIDEgKyBvbGREZWx0YUxpbmVDb3VudDtcblx0XHRcdFx0XHRpZiAobGFzdEV2ZW50ICYmIGxhc3RFdmVudC50eXBlID09PSAnaW5zZXJ0ZWQnICYmIGxhc3RFdmVudC5faSA9PT0gaSAtIDEpIHtcblx0XHRcdFx0XHRcdGxhc3RFdmVudC5pbnNlcnRUb0xpbmVOdW1iZXIrKztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bGFzdEV2ZW50ID0geyB0eXBlOiAnaW5zZXJ0ZWQnLCBfaTogaSwgaW5zZXJ0RnJvbUxpbmVOdW1iZXI6IG9sZE1pbmltYXBMaW5lTnVtYmVyLCBpbnNlcnRUb0xpbmVOdW1iZXI6IG9sZE1pbmltYXBMaW5lTnVtYmVyIH07XG5cdFx0XHRcdFx0XHRldmVudHMucHVzaChsYXN0RXZlbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRvbGREZWx0YUxpbmVDb3VudCsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdFtpXSA9IHNlbGVjdGVkVmlld0xpbmVOdW1iZXI7XG5cdFx0XHRtaW5WaWV3TGluZU51bWJlciA9IHNlbGVjdGVkVmlld0xpbmVOdW1iZXI7XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50cy5sZW5ndGggPCBNQVhfRVZFTlRfQ09VTlQpIHtcblx0XHRcdHdoaWxlIChvbGRJbmRleCA8IG9sZExlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBvbGRNaW5pbWFwTGluZU51bWJlciA9IG9sZEluZGV4ICsgMSArIG9sZERlbHRhTGluZUNvdW50O1xuXHRcdFx0XHRpZiAobGFzdEV2ZW50ICYmIGxhc3RFdmVudC50eXBlID09PSAnZGVsZXRlZCcgJiYgbGFzdEV2ZW50Ll9vbGRJbmRleCA9PT0gb2xkSW5kZXggLSAxKSB7XG5cdFx0XHRcdFx0bGFzdEV2ZW50LmRlbGV0ZVRvTGluZU51bWJlcisrO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxhc3RFdmVudCA9IHsgdHlwZTogJ2RlbGV0ZWQnLCBfb2xkSW5kZXg6IG9sZEluZGV4LCBkZWxldGVGcm9tTGluZU51bWJlcjogb2xkTWluaW1hcExpbmVOdW1iZXIsIGRlbGV0ZVRvTGluZU51bWJlcjogb2xkTWluaW1hcExpbmVOdW1iZXIgfTtcblx0XHRcdFx0XHRldmVudHMucHVzaChsYXN0RXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9sZERlbHRhTGluZUNvdW50LS07XG5cdFx0XHRcdG9sZEluZGV4Kys7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRvbyBtYW55IGV2ZW50cywganVzdCBnaXZlIHVwXG5cdFx0XHRldmVudHMgPSBbeyB0eXBlOiAnZmx1c2gnIH1dO1xuXHRcdH1cblxuXHRcdHJldHVybiBbbmV3IE1pbmltYXBTYW1wbGluZ1N0YXRlKHJhdGlvLCByZXN1bHQpLCBldmVudHNdO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHNhbXBsaW5nUmF0aW86IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWluaW1hcExpbmVzOiBudW1iZXJbXVx0Ly8gYSBtYXAgb2YgMC1iYXNlZCBtaW5pbWFwIGxpbmUgaW5kZXhlcyB0byAxLWJhc2VkIHZpZXcgbGluZSBudW1iZXJzXG5cdCkge1xuXHR9XG5cblx0cHVibGljIG1vZGVsTGluZVRvTWluaW1hcExpbmUobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gTWF0aC5taW4odGhpcy5taW5pbWFwTGluZXMubGVuZ3RoLCBNYXRoLm1heCgxLCBNYXRoLnJvdW5kKGxpbmVOdW1iZXIgLyB0aGlzLnNhbXBsaW5nUmF0aW8pKSk7XG5cdH1cblxuXHQvKipcblx0ICogV2lsbCByZXR1cm4gbnVsbCBpZiB0aGUgbW9kZWwgbGluZSByYW5nZXMgYXJlIG5vdCBpbnRlcnNlY3Rpbmcgd2l0aCBhIHNhbXBsZWQgbW9kZWwgbGluZS5cblx0ICovXG5cdHB1YmxpYyBtb2RlbExpbmVSYW5nZVRvTWluaW1hcExpbmVSYW5nZShmcm9tTGluZU51bWJlcjogbnVtYmVyLCB0b0xpbmVOdW1iZXI6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0gfCBudWxsIHtcblx0XHRsZXQgZnJvbUxpbmVJbmRleCA9IHRoaXMubW9kZWxMaW5lVG9NaW5pbWFwTGluZShmcm9tTGluZU51bWJlcikgLSAxO1xuXHRcdHdoaWxlIChmcm9tTGluZUluZGV4ID4gMCAmJiB0aGlzLm1pbmltYXBMaW5lc1tmcm9tTGluZUluZGV4IC0gMV0gPj0gZnJvbUxpbmVOdW1iZXIpIHtcblx0XHRcdGZyb21MaW5lSW5kZXgtLTtcblx0XHR9XG5cdFx0bGV0IHRvTGluZUluZGV4ID0gdGhpcy5tb2RlbExpbmVUb01pbmltYXBMaW5lKHRvTGluZU51bWJlcikgLSAxO1xuXHRcdHdoaWxlICh0b0xpbmVJbmRleCArIDEgPCB0aGlzLm1pbmltYXBMaW5lcy5sZW5ndGggJiYgdGhpcy5taW5pbWFwTGluZXNbdG9MaW5lSW5kZXggKyAxXSA8PSB0b0xpbmVOdW1iZXIpIHtcblx0XHRcdHRvTGluZUluZGV4Kys7XG5cdFx0fVxuXHRcdGlmIChmcm9tTGluZUluZGV4ID09PSB0b0xpbmVJbmRleCkge1xuXHRcdFx0Y29uc3Qgc2FtcGxlZExpbmVOdW1iZXIgPSB0aGlzLm1pbmltYXBMaW5lc1tmcm9tTGluZUluZGV4XTtcblx0XHRcdGlmIChzYW1wbGVkTGluZU51bWJlciA8IGZyb21MaW5lTnVtYmVyIHx8IHNhbXBsZWRMaW5lTnVtYmVyID4gdG9MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdC8vIFRoaXMgbGluZSBpcyBub3QgcGFydCBvZiB0aGUgc2FtcGxlZCBsaW5lcyA9PT4gbm90aGluZyB0byBkb1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFtmcm9tTGluZUluZGV4ICsgMSwgdG9MaW5lSW5kZXggKyAxXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBXaWxsIGFsd2F5cyByZXR1cm4gYSByYW5nZSwgZXZlbiBpZiBpdCBpcyBub3QgaW50ZXJzZWN0aW5nIHdpdGggYSBzYW1wbGVkIG1vZGVsIGxpbmUuXG5cdCAqL1xuXHRwdWJsaWMgZGVjb3JhdGlvbkxpbmVSYW5nZVRvTWluaW1hcExpbmVSYW5nZShzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG5cdFx0bGV0IG1pbmltYXBMaW5lU3RhcnQgPSB0aGlzLm1vZGVsTGluZVRvTWluaW1hcExpbmUoc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRsZXQgbWluaW1hcExpbmVFbmQgPSB0aGlzLm1vZGVsTGluZVRvTWluaW1hcExpbmUoZW5kTGluZU51bWJlcik7XG5cdFx0aWYgKHN0YXJ0TGluZU51bWJlciAhPT0gZW5kTGluZU51bWJlciAmJiBtaW5pbWFwTGluZUVuZCA9PT0gbWluaW1hcExpbmVTdGFydCkge1xuXHRcdFx0aWYgKG1pbmltYXBMaW5lRW5kID09PSB0aGlzLm1pbmltYXBMaW5lcy5sZW5ndGgpIHtcblx0XHRcdFx0aWYgKG1pbmltYXBMaW5lU3RhcnQgPiAxKSB7XG5cdFx0XHRcdFx0bWluaW1hcExpbmVTdGFydC0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtaW5pbWFwTGluZUVuZCsrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gW21pbmltYXBMaW5lU3RhcnQsIG1pbmltYXBMaW5lRW5kXTtcblx0fVxuXG5cdHB1YmxpYyBvbkxpbmVzRGVsZXRlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudCk6IFtudW1iZXIsIG51bWJlcl0ge1xuXHRcdC8vIGhhdmUgdGhlIG1hcHBpbmcgYmUgc3RpY2t5XG5cdFx0Y29uc3QgZGVsZXRlZExpbmVDb3VudCA9IGUudG9MaW5lTnVtYmVyIC0gZS5mcm9tTGluZU51bWJlciArIDE7XG5cdFx0bGV0IGNoYW5nZVN0YXJ0SW5kZXggPSB0aGlzLm1pbmltYXBMaW5lcy5sZW5ndGg7XG5cdFx0bGV0IGNoYW5nZUVuZEluZGV4ID0gMDtcblx0XHRmb3IgKGxldCBpID0gdGhpcy5taW5pbWFwTGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGlmICh0aGlzLm1pbmltYXBMaW5lc1tpXSA8IGUuZnJvbUxpbmVOdW1iZXIpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5taW5pbWFwTGluZXNbaV0gPD0gZS50b0xpbmVOdW1iZXIpIHtcblx0XHRcdFx0Ly8gdGhpcyBsaW5lIGdvdCBkZWxldGVkID0+IG1vdmUgdG8gcHJldmlvdXMgYXZhaWxhYmxlXG5cdFx0XHRcdHRoaXMubWluaW1hcExpbmVzW2ldID0gTWF0aC5tYXgoMSwgZS5mcm9tTGluZU51bWJlciAtIDEpO1xuXHRcdFx0XHRjaGFuZ2VTdGFydEluZGV4ID0gTWF0aC5taW4oY2hhbmdlU3RhcnRJbmRleCwgaSk7XG5cdFx0XHRcdGNoYW5nZUVuZEluZGV4ID0gTWF0aC5tYXgoY2hhbmdlRW5kSW5kZXgsIGkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5taW5pbWFwTGluZXNbaV0gLT0gZGVsZXRlZExpbmVDb3VudDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFtjaGFuZ2VTdGFydEluZGV4LCBjaGFuZ2VFbmRJbmRleF07XG5cdH1cblxuXHRwdWJsaWMgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IHZvaWQge1xuXHRcdC8vIGhhdmUgdGhlIG1hcHBpbmcgYmUgc3RpY2t5XG5cdFx0Y29uc3QgaW5zZXJ0ZWRMaW5lQ291bnQgPSBlLnRvTGluZU51bWJlciAtIGUuZnJvbUxpbmVOdW1iZXIgKyAxO1xuXHRcdGZvciAobGV0IGkgPSB0aGlzLm1pbmltYXBMaW5lcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0aWYgKHRoaXMubWluaW1hcExpbmVzW2ldIDwgZS5mcm9tTGluZU51bWJlcikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHRoaXMubWluaW1hcExpbmVzW2ldICs9IGluc2VydGVkTGluZUNvdW50O1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIFRoZSBtaW5pbWFwIGFwcGVhcnMgYmVzaWRlIHRoZSBlZGl0b3Igc2Nyb2xsIGJhciBhbmQgdmlzdWFsaXplcyBhIHpvb21lZCBvdXRcbiAqIHZpZXcgb2YgdGhlIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNaW5pbWFwIGV4dGVuZHMgVmlld1BhcnQgaW1wbGVtZW50cyBJTWluaW1hcE1vZGVsIHtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdG9rZW5zQ29sb3JUcmFja2VyOiBNaW5pbWFwVG9rZW5zQ29sb3JUcmFja2VyO1xuXG5cdHByaXZhdGUgX3NlbGVjdGlvbnM6IFNlbGVjdGlvbltdO1xuXHRwcml2YXRlIF9taW5pbWFwU2VsZWN0aW9uczogU2VsZWN0aW9uW10gfCBudWxsO1xuXG5cdHB1YmxpYyBvcHRpb25zOiBNaW5pbWFwT3B0aW9ucztcblxuXHRwcml2YXRlIF9zYW1wbGluZ1N0YXRlOiBNaW5pbWFwU2FtcGxpbmdTdGF0ZSB8IG51bGw7XG5cdHByaXZhdGUgX3Nob3VsZENoZWNrU2FtcGxpbmc6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfc2VjdGlvbkhlYWRlckNhY2hlID0gbmV3IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPigxMCwgMS41KTtcblxuXHRwcml2YXRlIF9hY3R1YWw6IElubmVyTWluaW1hcDtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCkge1xuXHRcdHN1cGVyKGNvbnRleHQpO1xuXG5cdFx0dGhpcy50b2tlbnNDb2xvclRyYWNrZXIgPSBNaW5pbWFwVG9rZW5zQ29sb3JUcmFja2VyLmdldEluc3RhbmNlKCk7XG5cblx0XHR0aGlzLl9zZWxlY3Rpb25zID0gW107XG5cdFx0dGhpcy5fbWluaW1hcFNlbGVjdGlvbnMgPSBudWxsO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gbmV3IE1pbmltYXBPcHRpb25zKHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbiwgdGhpcy5fY29udGV4dC50aGVtZSwgdGhpcy50b2tlbnNDb2xvclRyYWNrZXIpO1xuXHRcdGNvbnN0IFtzYW1wbGluZ1N0YXRlLF0gPSBNaW5pbWFwU2FtcGxpbmdTdGF0ZS5jb21wdXRlKHRoaXMub3B0aW9ucywgdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvdW50KCksIG51bGwpO1xuXHRcdHRoaXMuX3NhbXBsaW5nU3RhdGUgPSBzYW1wbGluZ1N0YXRlO1xuXHRcdHRoaXMuX3Nob3VsZENoZWNrU2FtcGxpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuX2FjdHVhbCA9IG5ldyBJbm5lck1pbmltYXAoY29udGV4dC50aGVtZSwgdGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3R1YWwuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXREb21Ob2RlKCk6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5nZXREb21Ob2RlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbk9wdGlvbnNNYXliZUNoYW5nZWQoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgb3B0cyA9IG5ldyBNaW5pbWFwT3B0aW9ucyh0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24sIHRoaXMuX2NvbnRleHQudGhlbWUsIHRoaXMudG9rZW5zQ29sb3JUcmFja2VyKTtcblx0XHRpZiAodGhpcy5vcHRpb25zLmVxdWFscyhvcHRzKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRzO1xuXHRcdHRoaXMuX3JlY3JlYXRlTGluZVNhbXBsaW5nKCk7XG5cdFx0dGhpcy5fYWN0dWFsLm9uRGlkQ2hhbmdlT3B0aW9ucygpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tLSBiZWdpbiB2aWV3IGV2ZW50IGhhbmRsZXJzXG5cblx0cHVibGljIG92ZXJyaWRlIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9vbk9wdGlvbnNNYXliZUNoYW5nZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25DdXJzb3JTdGF0ZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9zZWxlY3Rpb25zID0gZS5zZWxlY3Rpb25zO1xuXHRcdHRoaXMuX21pbmltYXBTZWxlY3Rpb25zID0gbnVsbDtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uU2VsZWN0aW9uQ2hhbmdlZCgpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChlLmFmZmVjdHNNaW5pbWFwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uRGVjb3JhdGlvbnNDaGFuZ2VkKCk7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25GbHVzaGVkKGU6IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHR0aGlzLl9zaG91bGRDaGVja1NhbXBsaW5nID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5vbkZsdXNoZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fc2FtcGxpbmdTdGF0ZSkge1xuXHRcdFx0Y29uc3QgbWluaW1hcExpbmVSYW5nZSA9IHRoaXMuX3NhbXBsaW5nU3RhdGUubW9kZWxMaW5lUmFuZ2VUb01pbmltYXBMaW5lUmFuZ2UoZS5mcm9tTGluZU51bWJlciwgZS5mcm9tTGluZU51bWJlciArIGUuY291bnQgLSAxKTtcblx0XHRcdGlmIChtaW5pbWFwTGluZVJhbmdlKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9hY3R1YWwub25MaW5lc0NoYW5nZWQobWluaW1hcExpbmVSYW5nZVswXSwgbWluaW1hcExpbmVSYW5nZVsxXSAtIG1pbmltYXBMaW5lUmFuZ2VbMF0gKyAxKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5vbkxpbmVzQ2hhbmdlZChlLmZyb21MaW5lTnVtYmVyLCBlLmNvdW50KTtcblx0XHR9XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNEZWxldGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzRGVsZXRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3NhbXBsaW5nU3RhdGUpIHtcblx0XHRcdGNvbnN0IFtjaGFuZ2VTdGFydEluZGV4LCBjaGFuZ2VFbmRJbmRleF0gPSB0aGlzLl9zYW1wbGluZ1N0YXRlLm9uTGluZXNEZWxldGVkKGUpO1xuXHRcdFx0aWYgKGNoYW5nZVN0YXJ0SW5kZXggPD0gY2hhbmdlRW5kSW5kZXgpIHtcblx0XHRcdFx0dGhpcy5fYWN0dWFsLm9uTGluZXNDaGFuZ2VkKGNoYW5nZVN0YXJ0SW5kZXggKyAxLCBjaGFuZ2VFbmRJbmRleCAtIGNoYW5nZVN0YXJ0SW5kZXggKyAxKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Nob3VsZENoZWNrU2FtcGxpbmcgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9hY3R1YWwub25MaW5lc0RlbGV0ZWQoZS5mcm9tTGluZU51bWJlciwgZS50b0xpbmVOdW1iZXIpO1xuXHRcdH1cblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHR0aGlzLl9zYW1wbGluZ1N0YXRlLm9uTGluZXNJbnNlcnRlZChlKTtcblx0XHRcdHRoaXMuX3Nob3VsZENoZWNrU2FtcGxpbmcgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9hY3R1YWwub25MaW5lc0luc2VydGVkKGUuZnJvbUxpbmVOdW1iZXIsIGUudG9MaW5lTnVtYmVyKTtcblx0XHR9XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uU2Nyb2xsQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdTY3JvbGxDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uU2Nyb2xsQ2hhbmdlZCgpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblRoZW1lQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdUaGVtZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2FjdHVhbC5vblRoZW1lQ2hhbmdlZCgpO1xuXHRcdHRoaXMuX29uT3B0aW9uc01heWJlQ2hhbmdlZCgpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblRva2Vuc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VG9rZW5zQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3NhbXBsaW5nU3RhdGUpIHtcblx0XHRcdGNvbnN0IHJhbmdlczogeyBmcm9tTGluZU51bWJlcjogbnVtYmVyOyB0b0xpbmVOdW1iZXI6IG51bWJlciB9W10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgZS5yYW5nZXMpIHtcblx0XHRcdFx0Y29uc3QgbWluaW1hcExpbmVSYW5nZSA9IHRoaXMuX3NhbXBsaW5nU3RhdGUubW9kZWxMaW5lUmFuZ2VUb01pbmltYXBMaW5lUmFuZ2UocmFuZ2UuZnJvbUxpbmVOdW1iZXIsIHJhbmdlLnRvTGluZU51bWJlcik7XG5cdFx0XHRcdGlmIChtaW5pbWFwTGluZVJhbmdlKSB7XG5cdFx0XHRcdFx0cmFuZ2VzLnB1c2goeyBmcm9tTGluZU51bWJlcjogbWluaW1hcExpbmVSYW5nZVswXSwgdG9MaW5lTnVtYmVyOiBtaW5pbWFwTGluZVJhbmdlWzFdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAocmFuZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uVG9rZW5zQ2hhbmdlZChyYW5nZXMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uVG9rZW5zQ2hhbmdlZChlLnJhbmdlcyk7XG5cdFx0fVxuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblRva2Vuc0NvbG9yc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VG9rZW5zQ29sb3JzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fb25PcHRpb25zTWF5YmVDaGFuZ2VkKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbC5vblRva2Vuc0NvbG9yc0NoYW5nZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25ab25lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Wm9uZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLm9uWm9uZXNDaGFuZ2VkKCk7XG5cdH1cblxuXHQvLyAtLS0gZW5kIGV2ZW50IGhhbmRsZXJzXG5cblx0cHVibGljIHByZXBhcmVSZW5kZXIoY3R4OiBSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3Nob3VsZENoZWNrU2FtcGxpbmcpIHtcblx0XHRcdHRoaXMuX3Nob3VsZENoZWNrU2FtcGxpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuX3JlY3JlYXRlTGluZVNhbXBsaW5nKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlbmRlcihjdHg6IFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cdFx0bGV0IHZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyID0gY3R4LnZpc2libGVSYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0bGV0IHZpZXdwb3J0RW5kTGluZU51bWJlciA9IGN0eC52aXNpYmxlUmFuZ2UuZW5kTGluZU51bWJlcjtcblxuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHR2aWV3cG9ydFN0YXJ0TGluZU51bWJlciA9IHRoaXMuX3NhbXBsaW5nU3RhdGUubW9kZWxMaW5lVG9NaW5pbWFwTGluZSh2aWV3cG9ydFN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHR2aWV3cG9ydEVuZExpbmVOdW1iZXIgPSB0aGlzLl9zYW1wbGluZ1N0YXRlLm1vZGVsTGluZVRvTWluaW1hcExpbmUodmlld3BvcnRFbmRMaW5lTnVtYmVyKTtcblx0XHR9XG5cblx0XHRjb25zdCBtaW5pbWFwQ3R4OiBJTWluaW1hcFJlbmRlcmluZ0NvbnRleHQgPSB7XG5cdFx0XHR2aWV3cG9ydENvbnRhaW5zV2hpdGVzcGFjZUdhcHM6IChjdHgudmlld3BvcnREYXRhLndoaXRlc3BhY2VWaWV3cG9ydERhdGEubGVuZ3RoID4gMCksXG5cblx0XHRcdHNjcm9sbFdpZHRoOiBjdHguc2Nyb2xsV2lkdGgsXG5cdFx0XHRzY3JvbGxIZWlnaHQ6IGN0eC5zY3JvbGxIZWlnaHQsXG5cblx0XHRcdHZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyOiB2aWV3cG9ydFN0YXJ0TGluZU51bWJlcixcblx0XHRcdHZpZXdwb3J0RW5kTGluZU51bWJlcjogdmlld3BvcnRFbmRMaW5lTnVtYmVyLFxuXHRcdFx0dmlld3BvcnRTdGFydExpbmVOdW1iZXJWZXJ0aWNhbE9mZnNldDogY3R4LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcih2aWV3cG9ydFN0YXJ0TGluZU51bWJlciksXG5cblx0XHRcdHNjcm9sbFRvcDogY3R4LnNjcm9sbFRvcCxcblx0XHRcdHNjcm9sbExlZnQ6IGN0eC5zY3JvbGxMZWZ0LFxuXG5cdFx0XHR2aWV3cG9ydFdpZHRoOiBjdHgudmlld3BvcnRXaWR0aCxcblx0XHRcdHZpZXdwb3J0SGVpZ2h0OiBjdHgudmlld3BvcnRIZWlnaHQsXG5cdFx0fTtcblx0XHR0aGlzLl9hY3R1YWwucmVuZGVyKG1pbmltYXBDdHgpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIElNaW5pbWFwTW9kZWxcblxuXHRwcml2YXRlIF9yZWNyZWF0ZUxpbmVTYW1wbGluZygpOiB2b2lkIHtcblx0XHR0aGlzLl9taW5pbWFwU2VsZWN0aW9ucyA9IG51bGw7XG5cblx0XHRjb25zdCB3YXNTYW1wbGluZyA9IEJvb2xlYW4odGhpcy5fc2FtcGxpbmdTdGF0ZSk7XG5cdFx0Y29uc3QgW3NhbXBsaW5nU3RhdGUsIGV2ZW50c10gPSBNaW5pbWFwU2FtcGxpbmdTdGF0ZS5jb21wdXRlKHRoaXMub3B0aW9ucywgdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvdW50KCksIHRoaXMuX3NhbXBsaW5nU3RhdGUpO1xuXHRcdHRoaXMuX3NhbXBsaW5nU3RhdGUgPSBzYW1wbGluZ1N0YXRlO1xuXG5cdFx0aWYgKHdhc1NhbXBsaW5nICYmIHRoaXMuX3NhbXBsaW5nU3RhdGUpIHtcblx0XHRcdC8vIHdhcyBzYW1wbGluZywgaXMgc2FtcGxpbmdcblx0XHRcdGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG5cdFx0XHRcdHN3aXRjaCAoZXZlbnQudHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgJ2RlbGV0ZWQnOlxuXHRcdFx0XHRcdFx0dGhpcy5fYWN0dWFsLm9uTGluZXNEZWxldGVkKGV2ZW50LmRlbGV0ZUZyb21MaW5lTnVtYmVyLCBldmVudC5kZWxldGVUb0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnaW5zZXJ0ZWQnOlxuXHRcdFx0XHRcdFx0dGhpcy5fYWN0dWFsLm9uTGluZXNJbnNlcnRlZChldmVudC5pbnNlcnRGcm9tTGluZU51bWJlciwgZXZlbnQuaW5zZXJ0VG9MaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ2ZsdXNoJzpcblx0XHRcdFx0XHRcdHRoaXMuX2FjdHVhbC5vbkZsdXNoZWQoKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldExpbmVDb3VudCgpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXMubGVuZ3RoO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmVhbExpbmVDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lQ29udGVudChsaW5lTnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZUNvbnRlbnQodGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXNbbGluZU51bWJlciAtIDFdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fc2FtcGxpbmdTdGF0ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4odGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXNbbGluZU51bWJlciAtIDFdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBuZWVkZWQ6IGJvb2xlYW5bXSk6IChWaWV3TGluZURhdGEgfCBudWxsKVtdIHtcblx0XHRpZiAodGhpcy5fc2FtcGxpbmdTdGF0ZSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiAoVmlld0xpbmVEYXRhIHwgbnVsbClbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgbGluZUluZGV4ID0gMCwgbGluZUNvdW50ID0gZW5kTGluZU51bWJlciAtIHN0YXJ0TGluZU51bWJlciArIDE7IGxpbmVJbmRleCA8IGxpbmVDb3VudDsgbGluZUluZGV4KyspIHtcblx0XHRcdFx0aWYgKG5lZWRlZFtsaW5lSW5kZXhdKSB7XG5cdFx0XHRcdFx0cmVzdWx0W2xpbmVJbmRleF0gPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRWaWV3TGluZURhdGEodGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXNbc3RhcnRMaW5lTnVtYmVyICsgbGluZUluZGV4IC0gMV0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdFtsaW5lSW5kZXhdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyLCBuZWVkZWQpLmRhdGE7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VsZWN0aW9ucygpOiBTZWxlY3Rpb25bXSB7XG5cdFx0aWYgKHRoaXMuX21pbmltYXBTZWxlY3Rpb25zID09PSBudWxsKSB7XG5cdFx0XHRpZiAodGhpcy5fc2FtcGxpbmdTdGF0ZSkge1xuXHRcdFx0XHR0aGlzLl9taW5pbWFwU2VsZWN0aW9ucyA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiB0aGlzLl9zZWxlY3Rpb25zKSB7XG5cdFx0XHRcdFx0Y29uc3QgW21pbmltYXBMaW5lU3RhcnQsIG1pbmltYXBMaW5lRW5kXSA9IHRoaXMuX3NhbXBsaW5nU3RhdGUuZGVjb3JhdGlvbkxpbmVSYW5nZVRvTWluaW1hcExpbmVSYW5nZShzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uZW5kTGluZU51bWJlcik7XG5cdFx0XHRcdFx0dGhpcy5fbWluaW1hcFNlbGVjdGlvbnMucHVzaChuZXcgU2VsZWN0aW9uKG1pbmltYXBMaW5lU3RhcnQsIHNlbGVjdGlvbi5zdGFydENvbHVtbiwgbWluaW1hcExpbmVFbmQsIHNlbGVjdGlvbi5lbmRDb2x1bW4pKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbWluaW1hcFNlbGVjdGlvbnMgPSB0aGlzLl9zZWxlY3Rpb25zO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbWluaW1hcFNlbGVjdGlvbnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWluaW1hcERlY29yYXRpb25zSW5WaWV3cG9ydChzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyKTogVmlld01vZGVsRGVjb3JhdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0TWluaW1hcERlY29yYXRpb25zSW5WaWV3cG9ydChzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIpXG5cdFx0XHQuZmlsdGVyKGRlY29yYXRpb24gPT4gIWRlY29yYXRpb24ub3B0aW9ucy5taW5pbWFwPy5zZWN0aW9uSGVhZGVyU3R5bGUpO1xuXHR9XG5cblx0cHVibGljIGdldFNlY3Rpb25IZWFkZXJEZWNvcmF0aW9uc0luVmlld3BvcnQoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlcik6IFZpZXdNb2RlbERlY29yYXRpb25bXSB7XG5cdFx0Y29uc3QgaGVhZGVySGVpZ2h0SW5NaW5pbWFwTGluZXMgPSB0aGlzLm9wdGlvbnMuc2VjdGlvbkhlYWRlckZvbnRTaXplIC8gdGhpcy5vcHRpb25zLm1pbmltYXBMaW5lSGVpZ2h0O1xuXHRcdHN0YXJ0TGluZU51bWJlciA9IE1hdGguZmxvb3IoTWF0aC5tYXgoMSwgc3RhcnRMaW5lTnVtYmVyIC0gaGVhZGVySGVpZ2h0SW5NaW5pbWFwTGluZXMpKTtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0TWluaW1hcERlY29yYXRpb25zSW5WaWV3cG9ydChzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIpXG5cdFx0XHQuZmlsdGVyKGRlY29yYXRpb24gPT4gISFkZWNvcmF0aW9uLm9wdGlvbnMubWluaW1hcD8uc2VjdGlvbkhlYWRlclN0eWxlKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE1pbmltYXBEZWNvcmF0aW9uc0luVmlld3BvcnQoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlcikge1xuXHRcdGxldCB2aXNpYmxlUmFuZ2U6IFJhbmdlO1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHRjb25zdCBtb2RlbFN0YXJ0TGluZU51bWJlciA9IHRoaXMuX3NhbXBsaW5nU3RhdGUubWluaW1hcExpbmVzW3N0YXJ0TGluZU51bWJlciAtIDFdO1xuXHRcdFx0Y29uc3QgbW9kZWxFbmRMaW5lTnVtYmVyID0gdGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXNbZW5kTGluZU51bWJlciAtIDFdO1xuXHRcdFx0dmlzaWJsZVJhbmdlID0gbmV3IFJhbmdlKG1vZGVsU3RhcnRMaW5lTnVtYmVyLCAxLCBtb2RlbEVuZExpbmVOdW1iZXIsIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4obW9kZWxFbmRMaW5lTnVtYmVyKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZpc2libGVSYW5nZSA9IG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIDEsIGVuZExpbmVOdW1iZXIsIHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4oZW5kTGluZU51bWJlcikpO1xuXHRcdH1cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldE1pbmltYXBEZWNvcmF0aW9uc0luUmFuZ2UodmlzaWJsZVJhbmdlKTtcblxuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IFZpZXdNb2RlbERlY29yYXRpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRcdGlmICghZGVjb3JhdGlvbi5vcHRpb25zLm1pbmltYXApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGRlY29yYXRpb24ucmFuZ2U7XG5cdFx0XHRcdGNvbnN0IG1pbmltYXBTdGFydExpbmVOdW1iZXIgPSB0aGlzLl9zYW1wbGluZ1N0YXRlLm1vZGVsTGluZVRvTWluaW1hcExpbmUocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0Y29uc3QgbWluaW1hcEVuZExpbmVOdW1iZXIgPSB0aGlzLl9zYW1wbGluZ1N0YXRlLm1vZGVsTGluZVRvTWluaW1hcExpbmUocmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKG5ldyBWaWV3TW9kZWxEZWNvcmF0aW9uKG5ldyBSYW5nZShtaW5pbWFwU3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgbWluaW1hcEVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbiksIGRlY29yYXRpb24ub3B0aW9ucykpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGVjb3JhdGlvbnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2VjdGlvbkhlYWRlclRleHQoZGVjb3JhdGlvbjogVmlld01vZGVsRGVjb3JhdGlvbiwgZml0V2lkdGg6IChzOiBzdHJpbmcpID0+IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRcdGNvbnN0IGhlYWRlclRleHQgPSBkZWNvcmF0aW9uLm9wdGlvbnMubWluaW1hcD8uc2VjdGlvbkhlYWRlclRleHQ7XG5cdFx0aWYgKCFoZWFkZXJUZXh0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgY2FjaGVkVGV4dCA9IHRoaXMuX3NlY3Rpb25IZWFkZXJDYWNoZS5nZXQoaGVhZGVyVGV4dCk7XG5cdFx0aWYgKGNhY2hlZFRleHQpIHtcblx0XHRcdHJldHVybiBjYWNoZWRUZXh0O1xuXHRcdH1cblx0XHRjb25zdCBmaXR0ZWRUZXh0ID0gZml0V2lkdGgoaGVhZGVyVGV4dCk7XG5cdFx0dGhpcy5fc2VjdGlvbkhlYWRlckNhY2hlLnNldChoZWFkZXJUZXh0LCBmaXR0ZWRUZXh0KTtcblx0XHRyZXR1cm4gZml0dGVkVGV4dDtcblx0fVxuXG5cdHB1YmxpYyBnZXRPcHRpb25zKCk6IFRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld01vZGVsLm1vZGVsLmdldE9wdGlvbnMoKTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxMaW5lTnVtYmVyKGxpbmVOdW1iZXI6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zYW1wbGluZ1N0YXRlKSB7XG5cdFx0XHRsaW5lTnVtYmVyID0gdGhpcy5fc2FtcGxpbmdTdGF0ZS5taW5pbWFwTGluZXNbbGluZU51bWJlciAtIDFdO1xuXHRcdH1cblx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5yZXZlYWxSYW5nZShcblx0XHRcdCdtb3VzZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG5ldyBSYW5nZShsaW5lTnVtYmVyLCAxLCBsaW5lTnVtYmVyLCAxKSxcblx0XHRcdHZpZXdFdmVudHMuVmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcixcblx0XHRcdFNjcm9sbFR5cGUuU21vb3RoXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC52aWV3TGF5b3V0LnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdHNjcm9sbFRvcDogc2Nyb2xsVG9wXG5cdFx0fSwgU2Nyb2xsVHlwZS5JbW1lZGlhdGUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmNsYXNzIElubmVyTWluaW1hcCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lOiBFZGl0b3JUaGVtZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElNaW5pbWFwTW9kZWw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zaGFkb3c6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfY2FudmFzOiBGYXN0RG9tTm9kZTxIVE1MQ2FudmFzRWxlbWVudD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25zQ2FudmFzOiBGYXN0RG9tTm9kZTxIVE1MQ2FudmFzRWxlbWVudD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NsaWRlcjogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zbGlkZXJIb3Jpem9udGFsOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BvaW50ZXJEb3duTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zbGlkZXJQb2ludGVyTW92ZU1vbml0b3I6IEdsb2JhbFBvaW50ZXJNb3ZlTW9uaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfc2xpZGVyUG9pbnRlckRvd25MaXN0ZW5lcjogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dlc3R1cmVEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2xpZGVyVG91Y2hTdGFydExpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2xpZGVyVG91Y2hNb3ZlTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zbGlkZXJUb3VjaEVuZExpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblxuXHRwcml2YXRlIF9sYXN0UmVuZGVyRGF0YTogUmVuZGVyRGF0YSB8IG51bGw7XG5cdHByaXZhdGUgX3NlbGVjdGlvbkNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcmVuZGVyRGVjb3JhdGlvbnM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZ2VzdHVyZUluUHJvZ3Jlc3M6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfYnVmZmVyczogTWluaW1hcEJ1ZmZlcnMgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHRoZW1lOiBFZGl0b3JUaGVtZSxcblx0XHRtb2RlbDogSU1pbmltYXBNb2RlbFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fdGhlbWUgPSB0aGVtZTtcblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xuXG5cdFx0dGhpcy5fbGFzdFJlbmRlckRhdGEgPSBudWxsO1xuXHRcdHRoaXMuX2J1ZmZlcnMgPSBudWxsO1xuXHRcdHRoaXMuX3NlbGVjdGlvbkNvbG9yID0gdGhpcy5fdGhlbWUuZ2V0Q29sb3IobWluaW1hcFNlbGVjdGlvbik7XG5cblx0XHR0aGlzLl9kb21Ob2RlID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpO1xuXHRcdFBhcnRGaW5nZXJwcmludHMud3JpdGUodGhpcy5fZG9tTm9kZSwgUGFydEZpbmdlcnByaW50Lk1pbmltYXApO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0Q2xhc3NOYW1lKHRoaXMuX2dldE1pbmltYXBEb21Ob2RlQ2xhc3NOYW1lKCkpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0UG9zaXRpb24oJ2Fic29sdXRlJyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncHJlc2VudGF0aW9uJyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblxuXHRcdHRoaXMuX3NoYWRvdyA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0XHR0aGlzLl9zaGFkb3cuc2V0Q2xhc3NOYW1lKCdtaW5pbWFwLXNoYWRvdy1oaWRkZW4nKTtcblx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX3NoYWRvdyk7XG5cblx0XHR0aGlzLl9jYW52YXMgPSBjcmVhdGVGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKSk7XG5cdFx0dGhpcy5fY2FudmFzLnNldFBvc2l0aW9uKCdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuX2NhbnZhcy5zZXRMZWZ0KDApO1xuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fY2FudmFzKTtcblxuXHRcdHRoaXMuX2RlY29yYXRpb25zQ2FudmFzID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJykpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zQ2FudmFzLnNldFBvc2l0aW9uKCdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zQ2FudmFzLnNldENsYXNzTmFtZSgnbWluaW1hcC1kZWNvcmF0aW9ucy1sYXllcicpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zQ2FudmFzLnNldExlZnQoMCk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9kZWNvcmF0aW9uc0NhbnZhcyk7XG5cblx0XHR0aGlzLl9zbGlkZXIgPSBjcmVhdGVGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG5cdFx0dGhpcy5fc2xpZGVyLnNldFBvc2l0aW9uKCdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuX3NsaWRlci5zZXRDbGFzc05hbWUoJ21pbmltYXAtc2xpZGVyJyk7XG5cdFx0dGhpcy5fc2xpZGVyLnNldExheWVySGludGluZyh0cnVlKTtcblx0XHR0aGlzLl9zbGlkZXIuc2V0Q29udGFpbignc3RyaWN0Jyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9zbGlkZXIpO1xuXG5cdFx0dGhpcy5fc2xpZGVySG9yaXpvbnRhbCA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0XHR0aGlzLl9zbGlkZXJIb3Jpem9udGFsLnNldFBvc2l0aW9uKCdhYnNvbHV0ZScpO1xuXHRcdHRoaXMuX3NsaWRlckhvcml6b250YWwuc2V0Q2xhc3NOYW1lKCdtaW5pbWFwLXNsaWRlci1ob3Jpem9udGFsJyk7XG5cdFx0dGhpcy5fc2xpZGVyLmFwcGVuZENoaWxkKHRoaXMuX3NsaWRlckhvcml6b250YWwpO1xuXG5cdFx0dGhpcy5fYXBwbHlMYXlvdXQoKTtcblxuXHRcdHRoaXMuX3BvaW50ZXJEb3duTGlzdGVuZXIgPSBkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZG9tTm9kZS5kb21Ob2RlLCBkb20uRXZlbnRUeXBlLlBPSU5URVJfRE9XTiwgKGUpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0Y29uc3QgcmVuZGVyTWluaW1hcCA9IHRoaXMuX21vZGVsLm9wdGlvbnMucmVuZGVyTWluaW1hcDtcblx0XHRcdGlmIChyZW5kZXJNaW5pbWFwID09PSBSZW5kZXJNaW5pbWFwLk5vbmUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLl9sYXN0UmVuZGVyRGF0YSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fbW9kZWwub3B0aW9ucy5zaXplICE9PSAncHJvcG9ydGlvbmFsJykge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gPT09IDAgJiYgdGhpcy5fbGFzdFJlbmRlckRhdGEpIHtcblx0XHRcdFx0XHQvLyBwcmV0ZW5kIHRoZSBjbGljayBvY2N1cnJlZCBpbiB0aGUgY2VudGVyIG9mIHRoZSBzbGlkZXJcblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuX3NsaWRlci5kb21Ob2RlKTtcblx0XHRcdFx0XHRjb25zdCBpbml0aWFsUG9zWSA9IHBvc2l0aW9uLnRvcCArIHBvc2l0aW9uLmhlaWdodCAvIDI7XG5cdFx0XHRcdFx0dGhpcy5fc3RhcnRTbGlkZXJEcmFnZ2luZyhlLCBpbml0aWFsUG9zWSwgdGhpcy5fbGFzdFJlbmRlckRhdGEucmVuZGVyZWRMYXlvdXQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG1pbmltYXBMaW5lSGVpZ2h0ID0gdGhpcy5fbW9kZWwub3B0aW9ucy5taW5pbWFwTGluZUhlaWdodDtcblx0XHRcdGNvbnN0IGludGVybmFsT2Zmc2V0WSA9ICh0aGlzLl9tb2RlbC5vcHRpb25zLmNhbnZhc0lubmVySGVpZ2h0IC8gdGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNPdXRlckhlaWdodCkgKiBlLm9mZnNldFk7XG5cdFx0XHRjb25zdCBsaW5lSW5kZXggPSBNYXRoLmZsb29yKGludGVybmFsT2Zmc2V0WSAvIG1pbmltYXBMaW5lSGVpZ2h0KTtcblxuXHRcdFx0bGV0IGxpbmVOdW1iZXIgPSBsaW5lSW5kZXggKyB0aGlzLl9sYXN0UmVuZGVyRGF0YS5yZW5kZXJlZExheW91dC5zdGFydExpbmVOdW1iZXIgLSB0aGlzLl9sYXN0UmVuZGVyRGF0YS5yZW5kZXJlZExheW91dC50b3BQYWRkaW5nTGluZUNvdW50O1xuXHRcdFx0bGluZU51bWJlciA9IE1hdGgubWluKGxpbmVOdW1iZXIsIHRoaXMuX21vZGVsLmdldExpbmVDb3VudCgpKTtcblxuXHRcdFx0dGhpcy5fbW9kZWwucmV2ZWFsTGluZU51bWJlcihsaW5lTnVtYmVyKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3NsaWRlclBvaW50ZXJNb3ZlTW9uaXRvciA9IG5ldyBHbG9iYWxQb2ludGVyTW92ZU1vbml0b3IoKTtcblxuXHRcdHRoaXMuX3NsaWRlclBvaW50ZXJEb3duTGlzdGVuZXIgPSBkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fc2xpZGVyLmRvbU5vZGUsIGRvbS5FdmVudFR5cGUuUE9JTlRFUl9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMCAmJiB0aGlzLl9sYXN0UmVuZGVyRGF0YSkge1xuXHRcdFx0XHR0aGlzLl9zdGFydFNsaWRlckRyYWdnaW5nKGUsIGUucGFnZVksIHRoaXMuX2xhc3RSZW5kZXJEYXRhLnJlbmRlcmVkTGF5b3V0KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX2dlc3R1cmVEaXNwb3NhYmxlID0gR2VzdHVyZS5hZGRUYXJnZXQodGhpcy5fZG9tTm9kZS5kb21Ob2RlKTtcblx0XHR0aGlzLl9zbGlkZXJUb3VjaFN0YXJ0TGlzdGVuZXIgPSBkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUuZG9tTm9kZSwgRXZlbnRUeXBlLlN0YXJ0LCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKHRoaXMuX2xhc3RSZW5kZXJEYXRhKSB7XG5cdFx0XHRcdHRoaXMuX3NsaWRlci50b2dnbGVDbGFzc05hbWUoJ2FjdGl2ZScsIHRydWUpO1xuXHRcdFx0XHR0aGlzLl9nZXN0dXJlSW5Qcm9ncmVzcyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuc2Nyb2xsRHVlVG9Ub3VjaEV2ZW50KGUpO1xuXHRcdFx0fVxuXHRcdH0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cblx0XHR0aGlzLl9zbGlkZXJUb3VjaE1vdmVMaXN0ZW5lciA9IGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZG9tTm9kZS5kb21Ob2RlLCBFdmVudFR5cGUuQ2hhbmdlLCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKHRoaXMuX2xhc3RSZW5kZXJEYXRhICYmIHRoaXMuX2dlc3R1cmVJblByb2dyZXNzKSB7XG5cdFx0XHRcdHRoaXMuc2Nyb2xsRHVlVG9Ub3VjaEV2ZW50KGUpO1xuXHRcdFx0fVxuXHRcdH0sIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cblx0XHR0aGlzLl9zbGlkZXJUb3VjaEVuZExpc3RlbmVyID0gZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUuZG9tTm9kZSwgRXZlbnRUeXBlLkVuZCwgKGU6IEdlc3R1cmVFdmVudCkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuX2dlc3R1cmVJblByb2dyZXNzID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9zbGlkZXIudG9nZ2xlQ2xhc3NOYW1lKCdhY3RpdmUnLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9zdGFydFNsaWRlckRyYWdnaW5nKGU6IFBvaW50ZXJFdmVudCwgaW5pdGlhbFBvc1k6IG51bWJlciwgaW5pdGlhbFNsaWRlclN0YXRlOiBNaW5pbWFwTGF5b3V0KTogdm9pZCB7XG5cdFx0aWYgKCFlLnRhcmdldCB8fCAhKGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5pdGlhbFBvc1ggPSBlLnBhZ2VYO1xuXG5cdFx0dGhpcy5fc2xpZGVyLnRvZ2dsZUNsYXNzTmFtZSgnYWN0aXZlJywgdHJ1ZSk7XG5cblx0XHRjb25zdCBoYW5kbGVQb2ludGVyTW92ZSA9IChwb3N5OiBudW1iZXIsIHBvc3g6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgbWluaW1hcFBvc2l0aW9uID0gZG9tLmdldERvbU5vZGVQYWdlUG9zaXRpb24odGhpcy5fZG9tTm9kZS5kb21Ob2RlKTtcblx0XHRcdGNvbnN0IHBvaW50ZXJPcnRob2dvbmFsRGVsdGEgPSBNYXRoLm1pbihcblx0XHRcdFx0TWF0aC5hYnMocG9zeCAtIGluaXRpYWxQb3NYKSxcblx0XHRcdFx0TWF0aC5hYnMocG9zeCAtIG1pbmltYXBQb3NpdGlvbi5sZWZ0KSxcblx0XHRcdFx0TWF0aC5hYnMocG9zeCAtIG1pbmltYXBQb3NpdGlvbi5sZWZ0IC0gbWluaW1hcFBvc2l0aW9uLndpZHRoKVxuXHRcdFx0KTtcblxuXHRcdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cyAmJiBwb2ludGVyT3J0aG9nb25hbERlbHRhID4gUE9JTlRFUl9EUkFHX1JFU0VUX0RJU1RBTkNFKSB7XG5cdFx0XHRcdC8vIFRoZSBwb2ludGVyIGhhcyB3b25kZXJlZCBhd2F5IGZyb20gdGhlIHNjcm9sbGJhciA9PiByZXNldCBkcmFnZ2luZ1xuXHRcdFx0XHR0aGlzLl9tb2RlbC5zZXRTY3JvbGxUb3AoaW5pdGlhbFNsaWRlclN0YXRlLnNjcm9sbFRvcCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcG9pbnRlckRlbHRhID0gcG9zeSAtIGluaXRpYWxQb3NZO1xuXHRcdFx0dGhpcy5fbW9kZWwuc2V0U2Nyb2xsVG9wKGluaXRpYWxTbGlkZXJTdGF0ZS5nZXREZXNpcmVkU2Nyb2xsVG9wRnJvbURlbHRhKHBvaW50ZXJEZWx0YSkpO1xuXHRcdH07XG5cblx0XHRpZiAoZS5wYWdlWSAhPT0gaW5pdGlhbFBvc1kpIHtcblx0XHRcdGhhbmRsZVBvaW50ZXJNb3ZlKGUucGFnZVksIGluaXRpYWxQb3NYKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zbGlkZXJQb2ludGVyTW92ZU1vbml0b3Iuc3RhcnRNb25pdG9yaW5nKFxuXHRcdFx0ZS50YXJnZXQsXG5cdFx0XHRlLnBvaW50ZXJJZCxcblx0XHRcdGUuYnV0dG9ucyxcblx0XHRcdHBvaW50ZXJNb3ZlRGF0YSA9PiBoYW5kbGVQb2ludGVyTW92ZShwb2ludGVyTW92ZURhdGEucGFnZVksIHBvaW50ZXJNb3ZlRGF0YS5wYWdlWCksXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3NsaWRlci50b2dnbGVDbGFzc05hbWUoJ2FjdGl2ZScsIGZhbHNlKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzY3JvbGxEdWVUb1RvdWNoRXZlbnQodG91Y2g6IEdlc3R1cmVFdmVudCkge1xuXHRcdGNvbnN0IHN0YXJ0WSA9IHRoaXMuX2RvbU5vZGUuZG9tTm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5fbGFzdFJlbmRlckRhdGEhLnJlbmRlcmVkTGF5b3V0LmdldERlc2lyZWRTY3JvbGxUb3BGcm9tVG91Y2hMb2NhdGlvbih0b3VjaC5wYWdlWSAtIHN0YXJ0WSk7XG5cdFx0dGhpcy5fbW9kZWwuc2V0U2Nyb2xsVG9wKHNjcm9sbFRvcCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9wb2ludGVyRG93bkxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zbGlkZXJQb2ludGVyTW92ZU1vbml0b3IuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3NsaWRlclBvaW50ZXJEb3duTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2dlc3R1cmVEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zbGlkZXJUb3VjaFN0YXJ0TGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3NsaWRlclRvdWNoTW92ZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zbGlkZXJUb3VjaEVuZExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRNaW5pbWFwRG9tTm9kZUNsYXNzTmFtZSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGNsYXNzXyA9IFsnbWluaW1hcCddO1xuXHRcdGlmICh0aGlzLl9tb2RlbC5vcHRpb25zLnNob3dTbGlkZXIgPT09ICdhbHdheXMnKSB7XG5cdFx0XHRjbGFzc18ucHVzaCgnc2xpZGVyLWFsd2F5cycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjbGFzc18ucHVzaCgnc2xpZGVyLW1vdXNlb3ZlcicpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fbW9kZWwub3B0aW9ucy5hdXRvaGlkZSkge1xuXHRcdFx0Y2xhc3NfLnB1c2goJ2F1dG9oaWRlJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNsYXNzXy5qb2luKCcgJyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9kb21Ob2RlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlMYXlvdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRMZWZ0KHRoaXMuX21vZGVsLm9wdGlvbnMubWluaW1hcExlZnQpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0V2lkdGgodGhpcy5fbW9kZWwub3B0aW9ucy5taW5pbWFwV2lkdGgpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0SGVpZ2h0KHRoaXMuX21vZGVsLm9wdGlvbnMubWluaW1hcEhlaWdodCk7XG5cdFx0dGhpcy5fc2hhZG93LnNldEhlaWdodCh0aGlzLl9tb2RlbC5vcHRpb25zLm1pbmltYXBIZWlnaHQpO1xuXG5cdFx0dGhpcy5fY2FudmFzLnNldFdpZHRoKHRoaXMuX21vZGVsLm9wdGlvbnMuY2FudmFzT3V0ZXJXaWR0aCk7XG5cdFx0dGhpcy5fY2FudmFzLnNldEhlaWdodCh0aGlzLl9tb2RlbC5vcHRpb25zLmNhbnZhc091dGVySGVpZ2h0KTtcblx0XHR0aGlzLl9jYW52YXMuZG9tTm9kZS53aWR0aCA9IHRoaXMuX21vZGVsLm9wdGlvbnMuY2FudmFzSW5uZXJXaWR0aDtcblx0XHR0aGlzLl9jYW52YXMuZG9tTm9kZS5oZWlnaHQgPSB0aGlzLl9tb2RlbC5vcHRpb25zLmNhbnZhc0lubmVySGVpZ2h0O1xuXG5cdFx0dGhpcy5fZGVjb3JhdGlvbnNDYW52YXMuc2V0V2lkdGgodGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNPdXRlcldpZHRoKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc0NhbnZhcy5zZXRIZWlnaHQodGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNPdXRlckhlaWdodCk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnNDYW52YXMuZG9tTm9kZS53aWR0aCA9IHRoaXMuX21vZGVsLm9wdGlvbnMuY2FudmFzSW5uZXJXaWR0aDtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc0NhbnZhcy5kb21Ob2RlLmhlaWdodCA9IHRoaXMuX21vZGVsLm9wdGlvbnMuY2FudmFzSW5uZXJIZWlnaHQ7XG5cblx0XHR0aGlzLl9zbGlkZXIuc2V0V2lkdGgodGhpcy5fbW9kZWwub3B0aW9ucy5taW5pbWFwV2lkdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QnVmZmVyKCk6IEltYWdlRGF0YSB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fYnVmZmVycykge1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsLm9wdGlvbnMuY2FudmFzSW5uZXJXaWR0aCA+IDAgJiYgdGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNJbm5lckhlaWdodCA+IDApIHtcblx0XHRcdFx0dGhpcy5fYnVmZmVycyA9IG5ldyBNaW5pbWFwQnVmZmVycyhcblx0XHRcdFx0XHR0aGlzLl9jYW52YXMuZG9tTm9kZS5nZXRDb250ZXh0KCcyZCcpISxcblx0XHRcdFx0XHR0aGlzLl9tb2RlbC5vcHRpb25zLmNhbnZhc0lubmVyV2lkdGgsXG5cdFx0XHRcdFx0dGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNJbm5lckhlaWdodCxcblx0XHRcdFx0XHR0aGlzLl9tb2RlbC5vcHRpb25zLmJhY2tncm91bmRDb2xvclxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fYnVmZmVycyA/IHRoaXMuX2J1ZmZlcnMuZ2V0QnVmZmVyKCkgOiBudWxsO1xuXHR9XG5cblx0Ly8gLS0tLSBiZWdpbiB2aWV3IGV2ZW50IGhhbmRsZXJzXG5cblx0cHVibGljIG9uRGlkQ2hhbmdlT3B0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLl9sYXN0UmVuZGVyRGF0YSA9IG51bGw7XG5cdFx0dGhpcy5fYnVmZmVycyA9IG51bGw7XG5cdFx0dGhpcy5fYXBwbHlMYXlvdXQoKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldENsYXNzTmFtZSh0aGlzLl9nZXRNaW5pbWFwRG9tTm9kZUNsYXNzTmFtZSgpKTtcblx0fVxuXHRwdWJsaWMgb25TZWxlY3Rpb25DaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3JlbmRlckRlY29yYXRpb25zID0gdHJ1ZTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb25EZWNvcmF0aW9uc0NoYW5nZWQoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fcmVuZGVyRGVjb3JhdGlvbnMgPSB0cnVlO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvbkZsdXNoZWQoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbGFzdFJlbmRlckRhdGEgPSBudWxsO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvbkxpbmVzQ2hhbmdlZChjaGFuZ2VGcm9tTGluZU51bWJlcjogbnVtYmVyLCBjaGFuZ2VDb3VudDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2xhc3RSZW5kZXJEYXRhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGFzdFJlbmRlckRhdGEub25MaW5lc0NoYW5nZWQoY2hhbmdlRnJvbUxpbmVOdW1iZXIsIGNoYW5nZUNvdW50KTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvbkxpbmVzRGVsZXRlZChkZWxldGVGcm9tTGluZU51bWJlcjogbnVtYmVyLCBkZWxldGVUb0xpbmVOdW1iZXI6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2xhc3RSZW5kZXJEYXRhPy5vbkxpbmVzRGVsZXRlZChkZWxldGVGcm9tTGluZU51bWJlciwgZGVsZXRlVG9MaW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb25MaW5lc0luc2VydGVkKGluc2VydEZyb21MaW5lTnVtYmVyOiBudW1iZXIsIGluc2VydFRvTGluZU51bWJlcjogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbGFzdFJlbmRlckRhdGE/Lm9uTGluZXNJbnNlcnRlZChpbnNlcnRGcm9tTGluZU51bWJlciwgaW5zZXJ0VG9MaW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb25TY3JvbGxDaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3JlbmRlckRlY29yYXRpb25zID0gdHJ1ZTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb25UaGVtZUNoYW5nZWQoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fc2VsZWN0aW9uQ29sb3IgPSB0aGlzLl90aGVtZS5nZXRDb2xvcihtaW5pbWFwU2VsZWN0aW9uKTtcblx0XHR0aGlzLl9yZW5kZXJEZWNvcmF0aW9ucyA9IHRydWU7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cHVibGljIG9uVG9rZW5zQ2hhbmdlZChyYW5nZXM6IHsgZnJvbUxpbmVOdW1iZXI6IG51bWJlcjsgdG9MaW5lTnVtYmVyOiBudW1iZXIgfVtdKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2xhc3RSZW5kZXJEYXRhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGFzdFJlbmRlckRhdGEub25Ub2tlbnNDaGFuZ2VkKHJhbmdlcyk7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25Ub2tlbnNDb2xvcnNDaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2xhc3RSZW5kZXJEYXRhID0gbnVsbDtcblx0XHR0aGlzLl9idWZmZXJzID0gbnVsbDtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb25ab25lc0NoYW5nZWQoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbGFzdFJlbmRlckRhdGEgPSBudWxsO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tIGVuZCBldmVudCBoYW5kbGVyc1xuXG5cdHB1YmxpYyByZW5kZXIocmVuZGVyaW5nQ3R4OiBJTWluaW1hcFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcblx0XHRjb25zdCByZW5kZXJNaW5pbWFwID0gdGhpcy5fbW9kZWwub3B0aW9ucy5yZW5kZXJNaW5pbWFwO1xuXHRcdGlmIChyZW5kZXJNaW5pbWFwID09PSBSZW5kZXJNaW5pbWFwLk5vbmUpIHtcblx0XHRcdHRoaXMuX3NoYWRvdy5zZXRDbGFzc05hbWUoJ21pbmltYXAtc2hhZG93LWhpZGRlbicpO1xuXHRcdFx0dGhpcy5fc2xpZGVySG9yaXpvbnRhbC5zZXRXaWR0aCgwKTtcblx0XHRcdHRoaXMuX3NsaWRlckhvcml6b250YWwuc2V0SGVpZ2h0KDApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocmVuZGVyaW5nQ3R4LnNjcm9sbExlZnQgKyByZW5kZXJpbmdDdHgudmlld3BvcnRXaWR0aCA+PSByZW5kZXJpbmdDdHguc2Nyb2xsV2lkdGgpIHtcblx0XHRcdHRoaXMuX3NoYWRvdy5zZXRDbGFzc05hbWUoJ21pbmltYXAtc2hhZG93LWhpZGRlbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zaGFkb3cuc2V0Q2xhc3NOYW1lKCdtaW5pbWFwLXNoYWRvdy12aXNpYmxlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF5b3V0ID0gTWluaW1hcExheW91dC5jcmVhdGUoXG5cdFx0XHR0aGlzLl9tb2RlbC5vcHRpb25zLFxuXHRcdFx0cmVuZGVyaW5nQ3R4LnZpZXdwb3J0U3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0cmVuZGVyaW5nQ3R4LnZpZXdwb3J0RW5kTGluZU51bWJlcixcblx0XHRcdHJlbmRlcmluZ0N0eC52aWV3cG9ydFN0YXJ0TGluZU51bWJlclZlcnRpY2FsT2Zmc2V0LFxuXHRcdFx0cmVuZGVyaW5nQ3R4LnZpZXdwb3J0SGVpZ2h0LFxuXHRcdFx0cmVuZGVyaW5nQ3R4LnZpZXdwb3J0Q29udGFpbnNXaGl0ZXNwYWNlR2Fwcyxcblx0XHRcdHRoaXMuX21vZGVsLmdldExpbmVDb3VudCgpLFxuXHRcdFx0dGhpcy5fbW9kZWwuZ2V0UmVhbExpbmVDb3VudCgpLFxuXHRcdFx0cmVuZGVyaW5nQ3R4LnNjcm9sbFRvcCxcblx0XHRcdHJlbmRlcmluZ0N0eC5zY3JvbGxIZWlnaHQsXG5cdFx0XHR0aGlzLl9sYXN0UmVuZGVyRGF0YSA/IHRoaXMuX2xhc3RSZW5kZXJEYXRhLnJlbmRlcmVkTGF5b3V0IDogbnVsbFxuXHRcdCk7XG5cdFx0dGhpcy5fc2xpZGVyLnNldERpc3BsYXkobGF5b3V0LnNsaWRlck5lZWRlZCA/ICdibG9jaycgOiAnbm9uZScpO1xuXHRcdHRoaXMuX3NsaWRlci5zZXRUb3AobGF5b3V0LnNsaWRlclRvcCk7XG5cdFx0dGhpcy5fc2xpZGVyLnNldEhlaWdodChsYXlvdXQuc2xpZGVySGVpZ2h0KTtcblxuXHRcdC8vIENvbXB1dGUgaG9yaXpvbnRhbCBzbGlkZXIgY29vcmRpbmF0ZXNcblx0XHR0aGlzLl9zbGlkZXJIb3Jpem9udGFsLnNldExlZnQoMCk7XG5cdFx0dGhpcy5fc2xpZGVySG9yaXpvbnRhbC5zZXRXaWR0aCh0aGlzLl9tb2RlbC5vcHRpb25zLm1pbmltYXBXaWR0aCk7XG5cdFx0dGhpcy5fc2xpZGVySG9yaXpvbnRhbC5zZXRUb3AoMCk7XG5cdFx0dGhpcy5fc2xpZGVySG9yaXpvbnRhbC5zZXRIZWlnaHQobGF5b3V0LnNsaWRlckhlaWdodCk7XG5cblx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25zKGxheW91dCk7XG5cdFx0dGhpcy5fbGFzdFJlbmRlckRhdGEgPSB0aGlzLnJlbmRlckxpbmVzKGxheW91dCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRlY29yYXRpb25zKGxheW91dDogTWluaW1hcExheW91dCkge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJEZWNvcmF0aW9ucykge1xuXHRcdFx0dGhpcy5fcmVuZGVyRGVjb3JhdGlvbnMgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9tb2RlbC5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRzZWxlY3Rpb25zLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLl9tb2RlbC5nZXRNaW5pbWFwRGVjb3JhdGlvbnNJblZpZXdwb3J0KGxheW91dC5zdGFydExpbmVOdW1iZXIsIGxheW91dC5lbmRMaW5lTnVtYmVyKTtcblx0XHRcdGRlY29yYXRpb25zLnNvcnQoKGEsIGIpID0+IChhLm9wdGlvbnMuekluZGV4IHx8IDApIC0gKGIub3B0aW9ucy56SW5kZXggfHwgMCkpO1xuXG5cdFx0XHRjb25zdCB7IGNhbnZhc0lubmVyV2lkdGgsIGNhbnZhc0lubmVySGVpZ2h0IH0gPSB0aGlzLl9tb2RlbC5vcHRpb25zO1xuXHRcdFx0Y29uc3QgbWluaW1hcExpbmVIZWlnaHQgPSB0aGlzLl9tb2RlbC5vcHRpb25zLm1pbmltYXBMaW5lSGVpZ2h0O1xuXHRcdFx0Y29uc3QgbWluaW1hcENoYXJXaWR0aCA9IHRoaXMuX21vZGVsLm9wdGlvbnMubWluaW1hcENoYXJXaWR0aDtcblx0XHRcdGNvbnN0IHRhYlNpemUgPSB0aGlzLl9tb2RlbC5nZXRPcHRpb25zKCkudGFiU2l6ZTtcblx0XHRcdGNvbnN0IGNhbnZhc0NvbnRleHQgPSB0aGlzLl9kZWNvcmF0aW9uc0NhbnZhcy5kb21Ob2RlLmdldENvbnRleHQoJzJkJykhO1xuXG5cdFx0XHRjYW52YXNDb250ZXh0LmNsZWFyUmVjdCgwLCAwLCBjYW52YXNJbm5lcldpZHRoLCBjYW52YXNJbm5lckhlaWdodCk7XG5cblx0XHRcdC8vIFdlIGZpcnN0IG5lZWQgdG8gcmVuZGVyIGxpbmUgaGlnaGxpZ2h0cyBhbmQgdGhlbiByZW5kZXIgZGVjb3JhdGlvbnMgb24gdG9wIG9mIHRob3NlLlxuXHRcdFx0Ly8gQnV0IHdlIG5lZWQgdG8gcGljayBhIHNpbmdsZSBjb2xvciBmb3IgZWFjaCBsaW5lLCBhbmQgdXNlIHRoYXQgYXMgYSBsaW5lIGhpZ2hsaWdodC5cblx0XHRcdC8vIFRoaXMgbmVlZHMgdG8gYmUgdGhlIGNvbG9yIG9mIHRoZSBkZWNvcmF0aW9uIHdpdGggdGhlIGhpZ2hlc3QgYHpJbmRleGAsIGJ1dCBwcmlvcml0eVxuXHRcdFx0Ly8gaXMgZ2l2ZW4gdG8gdGhlIHNlbGVjdGlvbi5cblxuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0ZWRMaW5lcyA9IG5ldyBDb250aWd1b3VzTGluZU1hcDxib29sZWFuPihsYXlvdXQuc3RhcnRMaW5lTnVtYmVyLCBsYXlvdXQuZW5kTGluZU51bWJlciwgZmFsc2UpO1xuXHRcdFx0dGhpcy5fcmVuZGVyU2VsZWN0aW9uTGluZUhpZ2hsaWdodHMoY2FudmFzQ29udGV4dCwgc2VsZWN0aW9ucywgaGlnaGxpZ2h0ZWRMaW5lcywgbGF5b3V0LCBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0XHR0aGlzLl9yZW5kZXJEZWNvcmF0aW9uc0xpbmVIaWdobGlnaHRzKGNhbnZhc0NvbnRleHQsIGRlY29yYXRpb25zLCBoaWdobGlnaHRlZExpbmVzLCBsYXlvdXQsIG1pbmltYXBMaW5lSGVpZ2h0KTtcblxuXHRcdFx0Y29uc3QgbGluZU9mZnNldE1hcCA9IG5ldyBDb250aWd1b3VzTGluZU1hcDxudW1iZXJbXSB8IG51bGw+KGxheW91dC5zdGFydExpbmVOdW1iZXIsIGxheW91dC5lbmRMaW5lTnVtYmVyLCBudWxsKTtcblx0XHRcdHRoaXMuX3JlbmRlclNlbGVjdGlvbnNIaWdobGlnaHRzKGNhbnZhc0NvbnRleHQsIHNlbGVjdGlvbnMsIGxpbmVPZmZzZXRNYXAsIGxheW91dCwgbWluaW1hcExpbmVIZWlnaHQsIHRhYlNpemUsIG1pbmltYXBDaGFyV2lkdGgsIGNhbnZhc0lubmVyV2lkdGgpO1xuXHRcdFx0dGhpcy5fcmVuZGVyRGVjb3JhdGlvbnNIaWdobGlnaHRzKGNhbnZhc0NvbnRleHQsIGRlY29yYXRpb25zLCBsaW5lT2Zmc2V0TWFwLCBsYXlvdXQsIG1pbmltYXBMaW5lSGVpZ2h0LCB0YWJTaXplLCBtaW5pbWFwQ2hhcldpZHRoLCBjYW52YXNJbm5lcldpZHRoKTtcblx0XHRcdHRoaXMuX3JlbmRlclNlY3Rpb25IZWFkZXJzKGxheW91dCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyU2VsZWN0aW9uTGluZUhpZ2hsaWdodHMoXG5cdFx0Y2FudmFzQ29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHRcdHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdLFxuXHRcdGhpZ2hsaWdodGVkTGluZXM6IENvbnRpZ3VvdXNMaW5lTWFwPGJvb2xlYW4+LFxuXHRcdGxheW91dDogTWluaW1hcExheW91dCxcblx0XHRtaW5pbWFwTGluZUhlaWdodDogbnVtYmVyXG5cdCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fc2VsZWN0aW9uQ29sb3IgfHwgdGhpcy5fc2VsZWN0aW9uQ29sb3IuaXNUcmFuc3BhcmVudCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2FudmFzQ29udGV4dC5maWxsU3R5bGUgPSB0aGlzLl9zZWxlY3Rpb25Db2xvci50cmFuc3BhcmVudCgwLjUpLnRvU3RyaW5nKCk7XG5cblx0XHRsZXQgeTEgPSAwO1xuXHRcdGxldCB5MiA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRjb25zdCBpbnRlcnNlY3Rpb24gPSBsYXlvdXQuaW50ZXJzZWN0V2l0aFZpZXdwb3J0KHNlbGVjdGlvbik7XG5cdFx0XHRpZiAoIWludGVyc2VjdGlvbikge1xuXHRcdFx0XHQvLyBlbnRpcmVseSBvdXRzaWRlIG1pbmltYXAncyB2aWV3cG9ydFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IFtzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXJdID0gaW50ZXJzZWN0aW9uO1xuXG5cdFx0XHRmb3IgKGxldCBsaW5lID0gc3RhcnRMaW5lTnVtYmVyOyBsaW5lIDw9IGVuZExpbmVOdW1iZXI7IGxpbmUrKykge1xuXHRcdFx0XHRoaWdobGlnaHRlZExpbmVzLnNldChsaW5lLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeXkxID0gbGF5b3V0LmdldFlGb3JMaW5lTnVtYmVyKHN0YXJ0TGluZU51bWJlciwgbWluaW1hcExpbmVIZWlnaHQpO1xuXHRcdFx0Y29uc3QgeXkyID0gbGF5b3V0LmdldFlGb3JMaW5lTnVtYmVyKGVuZExpbmVOdW1iZXIsIG1pbmltYXBMaW5lSGVpZ2h0KTtcblxuXHRcdFx0aWYgKHkyID49IHl5MSkge1xuXHRcdFx0XHQvLyBtZXJnZSBpbnRvIHByZXZpb3VzXG5cdFx0XHRcdHkyID0geXkyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHkyID4geTEpIHtcblx0XHRcdFx0XHQvLyBmbHVzaFxuXHRcdFx0XHRcdGNhbnZhc0NvbnRleHQuZmlsbFJlY3QoTUlOSU1BUF9HVVRURVJfV0lEVEgsIHkxLCBjYW52YXNDb250ZXh0LmNhbnZhcy53aWR0aCwgeTIgLSB5MSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0eTEgPSB5eTE7XG5cdFx0XHRcdHkyID0geXkyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh5MiA+IHkxKSB7XG5cdFx0XHQvLyBmbHVzaFxuXHRcdFx0Y2FudmFzQ29udGV4dC5maWxsUmVjdChNSU5JTUFQX0dVVFRFUl9XSURUSCwgeTEsIGNhbnZhc0NvbnRleHQuY2FudmFzLndpZHRoLCB5MiAtIHkxKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJEZWNvcmF0aW9uc0xpbmVIaWdobGlnaHRzKFxuXHRcdGNhbnZhc0NvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcblx0XHRkZWNvcmF0aW9uczogVmlld01vZGVsRGVjb3JhdGlvbltdLFxuXHRcdGhpZ2hsaWdodGVkTGluZXM6IENvbnRpZ3VvdXNMaW5lTWFwPGJvb2xlYW4+LFxuXHRcdGxheW91dDogTWluaW1hcExheW91dCxcblx0XHRtaW5pbWFwTGluZUhlaWdodDogbnVtYmVyXG5cdCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgaGlnaGxpZ2h0Q29sb3JzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuXHRcdC8vIExvb3AgYmFja3dhcmRzIHRvIGhpdCBmaXJzdCBkZWNvcmF0aW9ucyB3aXRoIGhpZ2hlciBgekluZGV4YFxuXHRcdGZvciAobGV0IGkgPSBkZWNvcmF0aW9ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbiA9IGRlY29yYXRpb25zW2ldO1xuXG5cdFx0XHRjb25zdCBtaW5pbWFwT3B0aW9ucyA9IDxNb2RlbERlY29yYXRpb25NaW5pbWFwT3B0aW9ucyB8IG51bGwgfCB1bmRlZmluZWQ+ZGVjb3JhdGlvbi5vcHRpb25zLm1pbmltYXA7XG5cdFx0XHRpZiAoIW1pbmltYXBPcHRpb25zIHx8IG1pbmltYXBPcHRpb25zLnBvc2l0aW9uICE9PSBNaW5pbWFwUG9zaXRpb24uSW5saW5lKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbnRlcnNlY3Rpb24gPSBsYXlvdXQuaW50ZXJzZWN0V2l0aFZpZXdwb3J0KGRlY29yYXRpb24ucmFuZ2UpO1xuXHRcdFx0aWYgKCFpbnRlcnNlY3Rpb24pIHtcblx0XHRcdFx0Ly8gZW50aXJlbHkgb3V0c2lkZSBtaW5pbWFwJ3Mgdmlld3BvcnRcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBbc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyXSA9IGludGVyc2VjdGlvbjtcblxuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbkNvbG9yID0gbWluaW1hcE9wdGlvbnMuZ2V0Q29sb3IodGhpcy5fdGhlbWUudmFsdWUpO1xuXHRcdFx0aWYgKCFkZWNvcmF0aW9uQ29sb3IgfHwgZGVjb3JhdGlvbkNvbG9yLmlzVHJhbnNwYXJlbnQoKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGhpZ2hsaWdodENvbG9yID0gaGlnaGxpZ2h0Q29sb3JzLmdldChkZWNvcmF0aW9uQ29sb3IudG9TdHJpbmcoKSk7XG5cdFx0XHRpZiAoIWhpZ2hsaWdodENvbG9yKSB7XG5cdFx0XHRcdGhpZ2hsaWdodENvbG9yID0gZGVjb3JhdGlvbkNvbG9yLnRyYW5zcGFyZW50KDAuNSkudG9TdHJpbmcoKTtcblx0XHRcdFx0aGlnaGxpZ2h0Q29sb3JzLnNldChkZWNvcmF0aW9uQ29sb3IudG9TdHJpbmcoKSwgaGlnaGxpZ2h0Q29sb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHRjYW52YXNDb250ZXh0LmZpbGxTdHlsZSA9IGhpZ2hsaWdodENvbG9yO1xuXHRcdFx0Zm9yIChsZXQgbGluZSA9IHN0YXJ0TGluZU51bWJlcjsgbGluZSA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lKyspIHtcblx0XHRcdFx0aWYgKGhpZ2hsaWdodGVkTGluZXMuaGFzKGxpbmUpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aGlnaGxpZ2h0ZWRMaW5lcy5zZXQobGluZSwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IHkgPSBsYXlvdXQuZ2V0WUZvckxpbmVOdW1iZXIoc3RhcnRMaW5lTnVtYmVyLCBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0XHRcdGNhbnZhc0NvbnRleHQuZmlsbFJlY3QoTUlOSU1BUF9HVVRURVJfV0lEVEgsIHksIGNhbnZhc0NvbnRleHQuY2FudmFzLndpZHRoLCBtaW5pbWFwTGluZUhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyU2VsZWN0aW9uc0hpZ2hsaWdodHMoXG5cdFx0Y2FudmFzQ29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHRcdHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdLFxuXHRcdGxpbmVPZmZzZXRNYXA6IENvbnRpZ3VvdXNMaW5lTWFwPG51bWJlcltdIHwgbnVsbD4sXG5cdFx0bGF5b3V0OiBNaW5pbWFwTGF5b3V0LFxuXHRcdGxpbmVIZWlnaHQ6IG51bWJlcixcblx0XHR0YWJTaXplOiBudW1iZXIsXG5cdFx0Y2hhcmFjdGVyV2lkdGg6IG51bWJlcixcblx0XHRjYW52YXNJbm5lcldpZHRoOiBudW1iZXJcblx0KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9zZWxlY3Rpb25Db2xvciB8fCB0aGlzLl9zZWxlY3Rpb25Db2xvci5pc1RyYW5zcGFyZW50KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0Y29uc3QgaW50ZXJzZWN0aW9uID0gbGF5b3V0LmludGVyc2VjdFdpdGhWaWV3cG9ydChzZWxlY3Rpb24pO1xuXHRcdFx0aWYgKCFpbnRlcnNlY3Rpb24pIHtcblx0XHRcdFx0Ly8gZW50aXJlbHkgb3V0c2lkZSBtaW5pbWFwJ3Mgdmlld3BvcnRcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBbc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyXSA9IGludGVyc2VjdGlvbjtcblxuXHRcdFx0Zm9yIChsZXQgbGluZSA9IHN0YXJ0TGluZU51bWJlcjsgbGluZSA8PSBlbmRMaW5lTnVtYmVyOyBsaW5lKyspIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJEZWNvcmF0aW9uT25MaW5lKGNhbnZhc0NvbnRleHQsIGxpbmVPZmZzZXRNYXAsIHNlbGVjdGlvbiwgdGhpcy5fc2VsZWN0aW9uQ29sb3IsIGxheW91dCwgbGluZSwgbGluZUhlaWdodCwgbGluZUhlaWdodCwgdGFiU2l6ZSwgY2hhcmFjdGVyV2lkdGgsIGNhbnZhc0lubmVyV2lkdGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlckRlY29yYXRpb25zSGlnaGxpZ2h0cyhcblx0XHRjYW52YXNDb250ZXh0OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG5cdFx0ZGVjb3JhdGlvbnM6IFZpZXdNb2RlbERlY29yYXRpb25bXSxcblx0XHRsaW5lT2Zmc2V0TWFwOiBDb250aWd1b3VzTGluZU1hcDxudW1iZXJbXSB8IG51bGw+LFxuXHRcdGxheW91dDogTWluaW1hcExheW91dCxcblx0XHRtaW5pbWFwTGluZUhlaWdodDogbnVtYmVyLFxuXHRcdHRhYlNpemU6IG51bWJlcixcblx0XHRjaGFyYWN0ZXJXaWR0aDogbnVtYmVyLFxuXHRcdGNhbnZhc0lubmVyV2lkdGg6IG51bWJlclxuXHQpOiB2b2lkIHtcblx0XHQvLyBMb29wIGZvcndhcmRzIHRvIGhpdCBmaXJzdCBkZWNvcmF0aW9ucyB3aXRoIGxvd2VyIGB6SW5kZXhgXG5cdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRlY29yYXRpb25zKSB7XG5cblx0XHRcdGNvbnN0IG1pbmltYXBPcHRpb25zID0gPE1vZGVsRGVjb3JhdGlvbk1pbmltYXBPcHRpb25zIHwgbnVsbCB8IHVuZGVmaW5lZD5kZWNvcmF0aW9uLm9wdGlvbnMubWluaW1hcDtcblx0XHRcdGlmICghbWluaW1hcE9wdGlvbnMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGludGVyc2VjdGlvbiA9IGxheW91dC5pbnRlcnNlY3RXaXRoVmlld3BvcnQoZGVjb3JhdGlvbi5yYW5nZSk7XG5cdFx0XHRpZiAoIWludGVyc2VjdGlvbikge1xuXHRcdFx0XHQvLyBlbnRpcmVseSBvdXRzaWRlIG1pbmltYXAncyB2aWV3cG9ydFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IFtzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXJdID0gaW50ZXJzZWN0aW9uO1xuXG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uQ29sb3IgPSBtaW5pbWFwT3B0aW9ucy5nZXRDb2xvcih0aGlzLl90aGVtZS52YWx1ZSk7XG5cdFx0XHRpZiAoIWRlY29yYXRpb25Db2xvciB8fCBkZWNvcmF0aW9uQ29sb3IuaXNUcmFuc3BhcmVudCgpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGxldCBsaW5lID0gc3RhcnRMaW5lTnVtYmVyOyBsaW5lIDw9IGVuZExpbmVOdW1iZXI7IGxpbmUrKykge1xuXHRcdFx0XHRzd2l0Y2ggKG1pbmltYXBPcHRpb25zLnBvc2l0aW9uKSB7XG5cblx0XHRcdFx0XHRjYXNlIE1pbmltYXBQb3NpdGlvbi5JbmxpbmU6XG5cdFx0XHRcdFx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25PbkxpbmUoY2FudmFzQ29udGV4dCwgbGluZU9mZnNldE1hcCwgZGVjb3JhdGlvbi5yYW5nZSwgZGVjb3JhdGlvbkNvbG9yLCBsYXlvdXQsIGxpbmUsIG1pbmltYXBMaW5lSGVpZ2h0LCBtaW5pbWFwTGluZUhlaWdodCwgdGFiU2l6ZSwgY2hhcmFjdGVyV2lkdGgsIGNhbnZhc0lubmVyV2lkdGgpO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cblx0XHRcdFx0XHRjYXNlIE1pbmltYXBQb3NpdGlvbi5HdXR0ZXI6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHkgPSBsYXlvdXQuZ2V0WUZvckxpbmVOdW1iZXIobGluZSwgbWluaW1hcExpbmVIZWlnaHQpO1xuXHRcdFx0XHRcdFx0Y29uc3QgeCA9IDI7XG5cdFx0XHRcdFx0XHR0aGlzLnJlbmRlckRlY29yYXRpb24oY2FudmFzQ29udGV4dCwgZGVjb3JhdGlvbkNvbG9yLCB4LCB5LCBHVVRURVJfREVDT1JBVElPTl9XSURUSCwgbWluaW1hcExpbmVIZWlnaHQpO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJEZWNvcmF0aW9uT25MaW5lKFxuXHRcdGNhbnZhc0NvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcblx0XHRsaW5lT2Zmc2V0TWFwOiBDb250aWd1b3VzTGluZU1hcDxudW1iZXJbXSB8IG51bGw+LFxuXHRcdGRlY29yYXRpb25SYW5nZTogUmFuZ2UsXG5cdFx0ZGVjb3JhdGlvbkNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZCxcblx0XHRsYXlvdXQ6IE1pbmltYXBMYXlvdXQsXG5cdFx0bGluZU51bWJlcjogbnVtYmVyLFxuXHRcdGhlaWdodDogbnVtYmVyLFxuXHRcdG1pbmltYXBMaW5lSGVpZ2h0OiBudW1iZXIsXG5cdFx0dGFiU2l6ZTogbnVtYmVyLFxuXHRcdGNoYXJXaWR0aDogbnVtYmVyLFxuXHRcdGNhbnZhc0lubmVyV2lkdGg6IG51bWJlclxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCB5ID0gbGF5b3V0LmdldFlGb3JMaW5lTnVtYmVyKGxpbmVOdW1iZXIsIG1pbmltYXBMaW5lSGVpZ2h0KTtcblxuXHRcdC8vIFNraXAgcmVuZGVyaW5nIHRoZSBsaW5lIGlmIGl0J3MgdmVydGljYWxseSBvdXRzaWRlIG91ciB2aWV3cG9ydFxuXHRcdGlmICh5ICsgaGVpZ2h0IDwgMCB8fCB5ID4gdGhpcy5fbW9kZWwub3B0aW9ucy5jYW52YXNJbm5lckhlaWdodCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyIH0gPSBkZWNvcmF0aW9uUmFuZ2U7XG5cdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSAoc3RhcnRMaW5lTnVtYmVyID09PSBsaW5lTnVtYmVyID8gZGVjb3JhdGlvblJhbmdlLnN0YXJ0Q29sdW1uIDogMSk7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gKGVuZExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIgPyBkZWNvcmF0aW9uUmFuZ2UuZW5kQ29sdW1uIDogdGhpcy5fbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSk7XG5cblx0XHRjb25zdCB4MSA9IHRoaXMuZ2V0WE9mZnNldEZvclBvc2l0aW9uKGxpbmVPZmZzZXRNYXAsIGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCB0YWJTaXplLCBjaGFyV2lkdGgsIGNhbnZhc0lubmVyV2lkdGgpO1xuXHRcdGNvbnN0IHgyID0gdGhpcy5nZXRYT2Zmc2V0Rm9yUG9zaXRpb24obGluZU9mZnNldE1hcCwgbGluZU51bWJlciwgZW5kQ29sdW1uLCB0YWJTaXplLCBjaGFyV2lkdGgsIGNhbnZhc0lubmVyV2lkdGgpO1xuXG5cdFx0dGhpcy5yZW5kZXJEZWNvcmF0aW9uKGNhbnZhc0NvbnRleHQsIGRlY29yYXRpb25Db2xvciwgeDEsIHksIHgyIC0geDEsIGhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIGdldFhPZmZzZXRGb3JQb3NpdGlvbihcblx0XHRsaW5lT2Zmc2V0TWFwOiBDb250aWd1b3VzTGluZU1hcDxudW1iZXJbXSB8IG51bGw+LFxuXHRcdGxpbmVOdW1iZXI6IG51bWJlcixcblx0XHRjb2x1bW46IG51bWJlcixcblx0XHR0YWJTaXplOiBudW1iZXIsXG5cdFx0Y2hhcldpZHRoOiBudW1iZXIsXG5cdFx0Y2FudmFzSW5uZXJXaWR0aDogbnVtYmVyXG5cdCk6IG51bWJlciB7XG5cdFx0aWYgKGNvbHVtbiA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIE1JTklNQVBfR1VUVEVSX1dJRFRIO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1pbmltdW1YT2Zmc2V0ID0gKGNvbHVtbiAtIDEpICogY2hhcldpZHRoO1xuXHRcdGlmIChtaW5pbXVtWE9mZnNldCA+PSBjYW52YXNJbm5lcldpZHRoKSB7XG5cdFx0XHQvLyB0aGVyZSBpcyBubyBuZWVkIHRvIGxvb2sgYXQgYWN0dWFsIGNoYXJhY3RlcnMsXG5cdFx0XHQvLyBhcyB0aGlzIGNvbHVtbiBpcyBjZXJ0YWlubHkgYWZ0ZXIgdGhlIG1pbmltYXAgd2lkdGhcblx0XHRcdHJldHVybiBjYW52YXNJbm5lcldpZHRoO1xuXHRcdH1cblxuXHRcdC8vIENhY2hlIGxpbmUgb2Zmc2V0IGRhdGEgc28gdGhhdCBpdCBpcyBvbmx5IHJlYWQgb25jZSBwZXIgbGluZVxuXHRcdGxldCBsaW5lSW5kZXhUb1hPZmZzZXQgPSBsaW5lT2Zmc2V0TWFwLmdldChsaW5lTnVtYmVyKTtcblx0XHRpZiAoIWxpbmVJbmRleFRvWE9mZnNldCkge1xuXHRcdFx0Y29uc3QgbGluZURhdGEgPSB0aGlzLl9tb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRcdGxpbmVJbmRleFRvWE9mZnNldCA9IFtNSU5JTUFQX0dVVFRFUl9XSURUSF07XG5cdFx0XHRsZXQgcHJldnggPSBNSU5JTUFQX0dVVFRFUl9XSURUSDtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbGluZURhdGEubGVuZ3RoICsgMTsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoYXJDb2RlID0gbGluZURhdGEuY2hhckNvZGVBdChpIC0gMSk7XG5cdFx0XHRcdGNvbnN0IGR4ID0gY2hhckNvZGUgPT09IENoYXJDb2RlLlRhYlxuXHRcdFx0XHRcdD8gdGFiU2l6ZSAqIGNoYXJXaWR0aFxuXHRcdFx0XHRcdDogc3RyaW5ncy5pc0Z1bGxXaWR0aENoYXJhY3RlcihjaGFyQ29kZSlcblx0XHRcdFx0XHRcdD8gMiAqIGNoYXJXaWR0aFxuXHRcdFx0XHRcdFx0OiBjaGFyV2lkdGg7XG5cblx0XHRcdFx0Y29uc3QgeCA9IHByZXZ4ICsgZHg7XG5cdFx0XHRcdGlmICh4ID49IGNhbnZhc0lubmVyV2lkdGgpIHtcblx0XHRcdFx0XHQvLyBubyBuZWVkIHRvIGtlZXAgb24gZ29pbmcsIGFzIHdlJ3ZlIGhpdCB0aGUgY2FudmFzIHdpZHRoXG5cdFx0XHRcdFx0bGluZUluZGV4VG9YT2Zmc2V0W2ldID0gY2FudmFzSW5uZXJXaWR0aDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxpbmVJbmRleFRvWE9mZnNldFtpXSA9IHg7XG5cdFx0XHRcdHByZXZ4ID0geDtcblx0XHRcdH1cblxuXHRcdFx0bGluZU9mZnNldE1hcC5zZXQobGluZU51bWJlciwgbGluZUluZGV4VG9YT2Zmc2V0KTtcblx0XHR9XG5cblx0XHRpZiAoY29sdW1uIC0gMSA8IGxpbmVJbmRleFRvWE9mZnNldC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBsaW5lSW5kZXhUb1hPZmZzZXRbY29sdW1uIC0gMV07XG5cdFx0fVxuXHRcdC8vIGdvZXMgb3ZlciB0aGUgY2FudmFzIHdpZHRoXG5cdFx0cmV0dXJuIGNhbnZhc0lubmVyV2lkdGg7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRlY29yYXRpb24oY2FudmFzQ29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELCBkZWNvcmF0aW9uQ29sb3I6IENvbG9yIHwgdW5kZWZpbmVkLCB4OiBudW1iZXIsIHk6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0XHRjYW52YXNDb250ZXh0LmZpbGxTdHlsZSA9IGRlY29yYXRpb25Db2xvciAmJiBkZWNvcmF0aW9uQ29sb3IudG9TdHJpbmcoKSB8fCAnJztcblx0XHRjYW52YXNDb250ZXh0LmZpbGxSZWN0KHgsIHksIHdpZHRoLCBoZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyU2VjdGlvbkhlYWRlcnMobGF5b3V0OiBNaW5pbWFwTGF5b3V0KSB7XG5cdFx0Y29uc3QgbWluaW1hcExpbmVIZWlnaHQgPSB0aGlzLl9tb2RlbC5vcHRpb25zLm1pbmltYXBMaW5lSGVpZ2h0O1xuXHRcdGNvbnN0IHNlY3Rpb25IZWFkZXJGb250U2l6ZSA9IHRoaXMuX21vZGVsLm9wdGlvbnMuc2VjdGlvbkhlYWRlckZvbnRTaXplO1xuXHRcdGNvbnN0IHNlY3Rpb25IZWFkZXJMZXR0ZXJTcGFjaW5nID0gdGhpcy5fbW9kZWwub3B0aW9ucy5zZWN0aW9uSGVhZGVyTGV0dGVyU3BhY2luZztcblx0XHRjb25zdCBiYWNrZ3JvdW5kRmlsbEhlaWdodCA9IHNlY3Rpb25IZWFkZXJGb250U2l6ZSAqIDEuNTtcblx0XHRjb25zdCB7IGNhbnZhc0lubmVyV2lkdGggfSA9IHRoaXMuX21vZGVsLm9wdGlvbnM7XG5cblx0XHRjb25zdCBiYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLl9tb2RlbC5vcHRpb25zLmJhY2tncm91bmRDb2xvcjtcblx0XHRjb25zdCBiYWNrZ3JvdW5kRmlsbCA9IGByZ2IoJHtiYWNrZ3JvdW5kQ29sb3Iucn0gJHtiYWNrZ3JvdW5kQ29sb3IuZ30gJHtiYWNrZ3JvdW5kQ29sb3IuYn0gLyAuNylgO1xuXHRcdGNvbnN0IGZvcmVncm91bmRDb2xvciA9IHRoaXMuX21vZGVsLm9wdGlvbnMuc2VjdGlvbkhlYWRlckZvbnRDb2xvcjtcblx0XHRjb25zdCBmb3JlZ3JvdW5kRmlsbCA9IGByZ2IoJHtmb3JlZ3JvdW5kQ29sb3Iucn0gJHtmb3JlZ3JvdW5kQ29sb3IuZ30gJHtmb3JlZ3JvdW5kQ29sb3IuYn0pYDtcblx0XHRjb25zdCBzZXBhcmF0b3JTdHJva2UgPSBmb3JlZ3JvdW5kRmlsbDtcblxuXHRcdGNvbnN0IGNhbnZhc0NvbnRleHQgPSB0aGlzLl9kZWNvcmF0aW9uc0NhbnZhcy5kb21Ob2RlLmdldENvbnRleHQoJzJkJykhO1xuXHRcdGNhbnZhc0NvbnRleHQubGV0dGVyU3BhY2luZyA9IHNlY3Rpb25IZWFkZXJMZXR0ZXJTcGFjaW5nICsgJ3B4Jztcblx0XHRjYW52YXNDb250ZXh0LmZvbnQgPSAnNTAwICcgKyBzZWN0aW9uSGVhZGVyRm9udFNpemUgKyAncHggJyArIHRoaXMuX21vZGVsLm9wdGlvbnMuc2VjdGlvbkhlYWRlckZvbnRGYW1pbHk7XG5cdFx0Y2FudmFzQ29udGV4dC5zdHJva2VTdHlsZSA9IHNlcGFyYXRvclN0cm9rZTtcblx0XHRjYW52YXNDb250ZXh0LmxpbmVXaWR0aCA9IDAuMjtcblxuXHRcdGNvbnN0IGRlY29yYXRpb25zID0gdGhpcy5fbW9kZWwuZ2V0U2VjdGlvbkhlYWRlckRlY29yYXRpb25zSW5WaWV3cG9ydChsYXlvdXQuc3RhcnRMaW5lTnVtYmVyLCBsYXlvdXQuZW5kTGluZU51bWJlcik7XG5cdFx0ZGVjb3JhdGlvbnMuc29ydCgoYSwgYikgPT4gYS5yYW5nZS5zdGFydExpbmVOdW1iZXIgLSBiLnJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cblx0XHRjb25zdCBmaXRXaWR0aCA9IElubmVyTWluaW1hcC5fZml0U2VjdGlvbkhlYWRlci5iaW5kKG51bGwsIGNhbnZhc0NvbnRleHQsXG5cdFx0XHRjYW52YXNJbm5lcldpZHRoIC0gTUlOSU1BUF9HVVRURVJfV0lEVEgpO1xuXG5cdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCB5ID0gbGF5b3V0LmdldFlGb3JMaW5lTnVtYmVyKGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBtaW5pbWFwTGluZUhlaWdodCkgKyBzZWN0aW9uSGVhZGVyRm9udFNpemU7XG5cdFx0XHRjb25zdCBiYWNrZ3JvdW5kRmlsbFkgPSB5IC0gc2VjdGlvbkhlYWRlckZvbnRTaXplO1xuXHRcdFx0Y29uc3Qgc2VwYXJhdG9yWSA9IGJhY2tncm91bmRGaWxsWSArIDI7XG5cdFx0XHRjb25zdCBoZWFkZXJUZXh0ID0gdGhpcy5fbW9kZWwuZ2V0U2VjdGlvbkhlYWRlclRleHQoZGVjb3JhdGlvbiwgZml0V2lkdGgpO1xuXG5cdFx0XHRJbm5lck1pbmltYXAuX3JlbmRlclNlY3Rpb25MYWJlbChcblx0XHRcdFx0Y2FudmFzQ29udGV4dCxcblx0XHRcdFx0aGVhZGVyVGV4dCxcblx0XHRcdFx0ZGVjb3JhdGlvbi5vcHRpb25zLm1pbmltYXA/LnNlY3Rpb25IZWFkZXJTdHlsZSA9PT0gTWluaW1hcFNlY3Rpb25IZWFkZXJTdHlsZS5VbmRlcmxpbmVkLFxuXHRcdFx0XHRiYWNrZ3JvdW5kRmlsbCxcblx0XHRcdFx0Zm9yZWdyb3VuZEZpbGwsXG5cdFx0XHRcdGNhbnZhc0lubmVyV2lkdGgsXG5cdFx0XHRcdGJhY2tncm91bmRGaWxsWSxcblx0XHRcdFx0YmFja2dyb3VuZEZpbGxIZWlnaHQsXG5cdFx0XHRcdHksXG5cdFx0XHRcdHNlcGFyYXRvclkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9maXRTZWN0aW9uSGVhZGVyKFxuXHRcdHRhcmdldDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHRcdG1heFdpZHRoOiBudW1iZXIsXG5cdFx0aGVhZGVyVGV4dDogc3RyaW5nLFxuXHQpOiBzdHJpbmcge1xuXHRcdGlmICghaGVhZGVyVGV4dCkge1xuXHRcdFx0cmV0dXJuIGhlYWRlclRleHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWxsaXBzaXMgPSAnXHUyMDI2Jztcblx0XHRjb25zdCB3aWR0aCA9IHRhcmdldC5tZWFzdXJlVGV4dChoZWFkZXJUZXh0KS53aWR0aDtcblx0XHRjb25zdCBlbGxpcHNpc1dpZHRoID0gdGFyZ2V0Lm1lYXN1cmVUZXh0KGVsbGlwc2lzKS53aWR0aDtcblxuXHRcdGlmICh3aWR0aCA8PSBtYXhXaWR0aCB8fCB3aWR0aCA8PSBlbGxpcHNpc1dpZHRoKSB7XG5cdFx0XHRyZXR1cm4gaGVhZGVyVGV4dDtcblx0XHR9XG5cblx0XHRjb25zdCBsZW4gPSBoZWFkZXJUZXh0Lmxlbmd0aDtcblx0XHRjb25zdCBhdmVyYWdlQ2hhcldpZHRoID0gd2lkdGggLyBoZWFkZXJUZXh0Lmxlbmd0aDtcblx0XHRjb25zdCBtYXhDaGFyQ291bnQgPSBNYXRoLmZsb29yKChtYXhXaWR0aCAtIGVsbGlwc2lzV2lkdGgpIC8gYXZlcmFnZUNoYXJXaWR0aCkgLSAxO1xuXG5cdFx0Ly8gRmluZCBhIGhhbGZ3YXkgcG9pbnQgdGhhdCBpc24ndCBhZnRlciB3aGl0ZXNwYWNlXG5cdFx0bGV0IGhhbGZDaGFyQ291bnQgPSBNYXRoLmNlaWwobWF4Q2hhckNvdW50IC8gMik7XG5cdFx0d2hpbGUgKGhhbGZDaGFyQ291bnQgPiAwICYmIC9cXHMvLnRlc3QoaGVhZGVyVGV4dFtoYWxmQ2hhckNvdW50IC0gMV0pKSB7XG5cdFx0XHQtLWhhbGZDaGFyQ291bnQ7XG5cdFx0fVxuXG5cdFx0Ly8gU3BsaXQgd2l0aCBlbGxpcHNpc1xuXHRcdHJldHVybiBoZWFkZXJUZXh0LnN1YnN0cmluZygwLCBoYWxmQ2hhckNvdW50KVxuXHRcdFx0KyBlbGxpcHNpcyArIGhlYWRlclRleHQuc3Vic3RyaW5nKGxlbiAtIChtYXhDaGFyQ291bnQgLSBoYWxmQ2hhckNvdW50KSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmVuZGVyU2VjdGlvbkxhYmVsKFxuXHRcdHRhcmdldDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHRcdGhlYWRlclRleHQ6IHN0cmluZyB8IG51bGwsXG5cdFx0aGFzU2VwYXJhdG9yTGluZTogYm9vbGVhbixcblx0XHRiYWNrZ3JvdW5kRmlsbDogc3RyaW5nLFxuXHRcdGZvcmVncm91bmRGaWxsOiBzdHJpbmcsXG5cdFx0bWluaW1hcFdpZHRoOiBudW1iZXIsXG5cdFx0YmFja2dyb3VuZEZpbGxZOiBudW1iZXIsXG5cdFx0YmFja2dyb3VuZEZpbGxIZWlnaHQ6IG51bWJlcixcblx0XHR0ZXh0WTogbnVtYmVyLFxuXHRcdHNlcGFyYXRvclk6IG51bWJlclxuXHQpOiB2b2lkIHtcblx0XHRpZiAoaGVhZGVyVGV4dCkge1xuXHRcdFx0dGFyZ2V0LmZpbGxTdHlsZSA9IGJhY2tncm91bmRGaWxsO1xuXHRcdFx0dGFyZ2V0LmZpbGxSZWN0KDAsIGJhY2tncm91bmRGaWxsWSwgbWluaW1hcFdpZHRoLCBiYWNrZ3JvdW5kRmlsbEhlaWdodCk7XG5cblx0XHRcdHRhcmdldC5maWxsU3R5bGUgPSBmb3JlZ3JvdW5kRmlsbDtcblx0XHRcdHRhcmdldC5maWxsVGV4dChoZWFkZXJUZXh0LCBNSU5JTUFQX0dVVFRFUl9XSURUSCwgdGV4dFkpO1xuXHRcdH1cblxuXHRcdGlmIChoYXNTZXBhcmF0b3JMaW5lKSB7XG5cdFx0XHR0YXJnZXQuYmVnaW5QYXRoKCk7XG5cdFx0XHR0YXJnZXQubW92ZVRvKDAsIHNlcGFyYXRvclkpO1xuXHRcdFx0dGFyZ2V0LmxpbmVUbyhtaW5pbWFwV2lkdGgsIHNlcGFyYXRvclkpO1xuXHRcdFx0dGFyZ2V0LmNsb3NlUGF0aCgpO1xuXHRcdFx0dGFyZ2V0LnN0cm9rZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTGluZXMobGF5b3V0OiBNaW5pbWFwTGF5b3V0KTogUmVuZGVyRGF0YSB8IG51bGwge1xuXHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IGxheW91dC5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IGxheW91dC5lbmRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IG1pbmltYXBMaW5lSGVpZ2h0ID0gdGhpcy5fbW9kZWwub3B0aW9ucy5taW5pbWFwTGluZUhlaWdodDtcblxuXHRcdC8vIENoZWNrIGlmIG5vdGhpbmcgY2hhbmdlZCB3LnIudC4gbGluZXMgZnJvbSBsYXN0IGZyYW1lXG5cdFx0aWYgKHRoaXMuX2xhc3RSZW5kZXJEYXRhICYmIHRoaXMuX2xhc3RSZW5kZXJEYXRhLmxpbmVzRXF1YWxzKGxheW91dCkpIHtcblx0XHRcdGNvbnN0IF9sYXN0RGF0YSA9IHRoaXMuX2xhc3RSZW5kZXJEYXRhLl9nZXQoKTtcblx0XHRcdC8vIE5pY2UhISBOb3RoaW5nIGNoYW5nZWQgZnJvbSBsYXN0IGZyYW1lXG5cdFx0XHRyZXR1cm4gbmV3IFJlbmRlckRhdGEobGF5b3V0LCBfbGFzdERhdGEuaW1hZ2VEYXRhLCBfbGFzdERhdGEubGluZXMpO1xuXHRcdH1cblxuXHRcdC8vIE9oIHdlbGwhISBXZSBuZWVkIHRvIHJlcGFpbnQgc29tZSBsaW5lcy4uLlxuXG5cdFx0Y29uc3QgaW1hZ2VEYXRhID0gdGhpcy5fZ2V0QnVmZmVyKCk7XG5cdFx0aWYgKCFpbWFnZURhdGEpIHtcblx0XHRcdC8vIDAgd2lkdGggb3IgMCBoZWlnaHQgY2FudmFzLCBub3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZW5kZXIgdW50b3VjaGVkIGxpbmVzIGJ5IHVzaW5nIGxhc3QgcmVuZGVyZWQgZGF0YS5cblx0XHRjb25zdCBbX2RpcnR5WTEsIF9kaXJ0eVkyLCBuZWVkZWRdID0gSW5uZXJNaW5pbWFwLl9yZW5kZXJVbnRvdWNoZWRMaW5lcyhcblx0XHRcdGltYWdlRGF0YSxcblx0XHRcdGxheW91dC50b3BQYWRkaW5nTGluZUNvdW50LFxuXHRcdFx0c3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0ZW5kTGluZU51bWJlcixcblx0XHRcdG1pbmltYXBMaW5lSGVpZ2h0LFxuXHRcdFx0dGhpcy5fbGFzdFJlbmRlckRhdGFcblx0XHQpO1xuXG5cdFx0Ly8gRmV0Y2ggcmVuZGVyaW5nIGluZm8gZnJvbSB2aWV3IG1vZGVsIGZvciByZXN0IG9mIGxpbmVzIHRoYXQgbmVlZCByZW5kZXJpbmcuXG5cdFx0Y29uc3QgbGluZUluZm8gPSB0aGlzLl9tb2RlbC5nZXRNaW5pbWFwTGluZXNSZW5kZXJpbmdEYXRhKHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlciwgbmVlZGVkKTtcblx0XHRjb25zdCB0YWJTaXplID0gdGhpcy5fbW9kZWwuZ2V0T3B0aW9ucygpLnRhYlNpemU7XG5cdFx0Y29uc3QgZGVmYXVsdEJhY2tncm91bmQgPSB0aGlzLl9tb2RlbC5vcHRpb25zLmRlZmF1bHRCYWNrZ3JvdW5kQ29sb3I7XG5cdFx0Y29uc3QgYmFja2dyb3VuZCA9IHRoaXMuX21vZGVsLm9wdGlvbnMuYmFja2dyb3VuZENvbG9yO1xuXHRcdGNvbnN0IGZvcmVncm91bmRBbHBoYSA9IHRoaXMuX21vZGVsLm9wdGlvbnMuZm9yZWdyb3VuZEFscGhhO1xuXHRcdGNvbnN0IHRva2Vuc0NvbG9yVHJhY2tlciA9IHRoaXMuX21vZGVsLnRva2Vuc0NvbG9yVHJhY2tlcjtcblx0XHRjb25zdCB1c2VMaWdodGVyRm9udCA9IHRva2Vuc0NvbG9yVHJhY2tlci5iYWNrZ3JvdW5kSXNMaWdodCgpO1xuXHRcdGNvbnN0IHJlbmRlck1pbmltYXAgPSB0aGlzLl9tb2RlbC5vcHRpb25zLnJlbmRlck1pbmltYXA7XG5cdFx0Y29uc3QgY2hhclJlbmRlcmVyID0gdGhpcy5fbW9kZWwub3B0aW9ucy5jaGFyUmVuZGVyZXIoKTtcblx0XHRjb25zdCBmb250U2NhbGUgPSB0aGlzLl9tb2RlbC5vcHRpb25zLmZvbnRTY2FsZTtcblx0XHRjb25zdCBtaW5pbWFwQ2hhcldpZHRoID0gdGhpcy5fbW9kZWwub3B0aW9ucy5taW5pbWFwQ2hhcldpZHRoO1xuXG5cdFx0Y29uc3QgYmFzZUNoYXJIZWlnaHQgPSAocmVuZGVyTWluaW1hcCA9PT0gUmVuZGVyTWluaW1hcC5UZXh0ID8gQ29uc3RhbnRzLkJBU0VfQ0hBUl9IRUlHSFQgOiBDb25zdGFudHMuQkFTRV9DSEFSX0hFSUdIVCArIDEpO1xuXHRcdGNvbnN0IHJlbmRlck1pbmltYXBMaW5lSGVpZ2h0ID0gYmFzZUNoYXJIZWlnaHQgKiBmb250U2NhbGU7XG5cdFx0Y29uc3QgaW5uZXJMaW5lUGFkZGluZyA9IChtaW5pbWFwTGluZUhlaWdodCA+IHJlbmRlck1pbmltYXBMaW5lSGVpZ2h0ID8gTWF0aC5mbG9vcigobWluaW1hcExpbmVIZWlnaHQgLSByZW5kZXJNaW5pbWFwTGluZUhlaWdodCkgLyAyKSA6IDApO1xuXG5cdFx0Ly8gUmVuZGVyIHRoZSByZXN0IG9mIGxpbmVzXG5cdFx0Y29uc3QgYmFja2dyb3VuZEEgPSBiYWNrZ3JvdW5kLmEgLyAyNTU7XG5cdFx0Y29uc3QgcmVuZGVyQmFja2dyb3VuZCA9IG5ldyBSR0JBOChcblx0XHRcdE1hdGgucm91bmQoKGJhY2tncm91bmQuciAtIGRlZmF1bHRCYWNrZ3JvdW5kLnIpICogYmFja2dyb3VuZEEgKyBkZWZhdWx0QmFja2dyb3VuZC5yKSxcblx0XHRcdE1hdGgucm91bmQoKGJhY2tncm91bmQuZyAtIGRlZmF1bHRCYWNrZ3JvdW5kLmcpICogYmFja2dyb3VuZEEgKyBkZWZhdWx0QmFja2dyb3VuZC5nKSxcblx0XHRcdE1hdGgucm91bmQoKGJhY2tncm91bmQuYiAtIGRlZmF1bHRCYWNrZ3JvdW5kLmIpICogYmFja2dyb3VuZEEgKyBkZWZhdWx0QmFja2dyb3VuZC5iKSxcblx0XHRcdDI1NVxuXHRcdCk7XG5cdFx0bGV0IGR5ID0gbGF5b3V0LnRvcFBhZGRpbmdMaW5lQ291bnQgKiBtaW5pbWFwTGluZUhlaWdodDtcblx0XHRjb25zdCByZW5kZXJlZExpbmVzOiBNaW5pbWFwTGluZVtdID0gW107XG5cdFx0Zm9yIChsZXQgbGluZUluZGV4ID0gMCwgbGluZUNvdW50ID0gZW5kTGluZU51bWJlciAtIHN0YXJ0TGluZU51bWJlciArIDE7IGxpbmVJbmRleCA8IGxpbmVDb3VudDsgbGluZUluZGV4KyspIHtcblx0XHRcdGlmIChuZWVkZWRbbGluZUluZGV4XSkge1xuXHRcdFx0XHRJbm5lck1pbmltYXAuX3JlbmRlckxpbmUoXG5cdFx0XHRcdFx0aW1hZ2VEYXRhLFxuXHRcdFx0XHRcdHJlbmRlckJhY2tncm91bmQsXG5cdFx0XHRcdFx0YmFja2dyb3VuZC5hLFxuXHRcdFx0XHRcdHVzZUxpZ2h0ZXJGb250LFxuXHRcdFx0XHRcdHJlbmRlck1pbmltYXAsXG5cdFx0XHRcdFx0bWluaW1hcENoYXJXaWR0aCxcblx0XHRcdFx0XHR0b2tlbnNDb2xvclRyYWNrZXIsXG5cdFx0XHRcdFx0Zm9yZWdyb3VuZEFscGhhLFxuXHRcdFx0XHRcdGNoYXJSZW5kZXJlcixcblx0XHRcdFx0XHRkeSxcblx0XHRcdFx0XHRpbm5lckxpbmVQYWRkaW5nLFxuXHRcdFx0XHRcdHRhYlNpemUsXG5cdFx0XHRcdFx0bGluZUluZm9bbGluZUluZGV4XSEsXG5cdFx0XHRcdFx0Zm9udFNjYWxlLFxuXHRcdFx0XHRcdG1pbmltYXBMaW5lSGVpZ2h0XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJlZExpbmVzW2xpbmVJbmRleF0gPSBuZXcgTWluaW1hcExpbmUoZHkpO1xuXHRcdFx0ZHkgKz0gbWluaW1hcExpbmVIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlydHlZMSA9IChfZGlydHlZMSA9PT0gLTEgPyAwIDogX2RpcnR5WTEpO1xuXHRcdGNvbnN0IGRpcnR5WTIgPSAoX2RpcnR5WTIgPT09IC0xID8gaW1hZ2VEYXRhLmhlaWdodCA6IF9kaXJ0eVkyKTtcblx0XHRjb25zdCBkaXJ0eUhlaWdodCA9IGRpcnR5WTIgLSBkaXJ0eVkxO1xuXG5cdFx0Ly8gRmluYWxseSwgcGFpbnQgdG8gdGhlIGNhbnZhc1xuXHRcdGNvbnN0IGN0eCA9IHRoaXMuX2NhbnZhcy5kb21Ob2RlLmdldENvbnRleHQoJzJkJykhO1xuXHRcdGN0eC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwLCAwLCBkaXJ0eVkxLCBpbWFnZURhdGEud2lkdGgsIGRpcnR5SGVpZ2h0KTtcblxuXHRcdC8vIFNhdmUgcmVuZGVyZWQgZGF0YSBmb3IgcmV1c2Ugb24gbmV4dCBmcmFtZSBpZiBwb3NzaWJsZVxuXHRcdHJldHVybiBuZXcgUmVuZGVyRGF0YShcblx0XHRcdGxheW91dCxcblx0XHRcdGltYWdlRGF0YSxcblx0XHRcdHJlbmRlcmVkTGluZXNcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlbmRlclVudG91Y2hlZExpbmVzKFxuXHRcdHRhcmdldDogSW1hZ2VEYXRhLFxuXHRcdHRvcFBhZGRpbmdMaW5lQ291bnQ6IG51bWJlcixcblx0XHRzdGFydExpbmVOdW1iZXI6IG51bWJlcixcblx0XHRlbmRMaW5lTnVtYmVyOiBudW1iZXIsXG5cdFx0bWluaW1hcExpbmVIZWlnaHQ6IG51bWJlcixcblx0XHRsYXN0UmVuZGVyRGF0YTogUmVuZGVyRGF0YSB8IG51bGwsXG5cdCk6IFtudW1iZXIsIG51bWJlciwgYm9vbGVhbltdXSB7XG5cblx0XHRjb25zdCBuZWVkZWQ6IGJvb2xlYW5bXSA9IFtdO1xuXHRcdGlmICghbGFzdFJlbmRlckRhdGEpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBlbmRMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyICsgMTsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdG5lZWRlZFtpXSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gWy0xLCAtMSwgbmVlZGVkXTtcblx0XHR9XG5cblx0XHRjb25zdCBfbGFzdERhdGEgPSBsYXN0UmVuZGVyRGF0YS5fZ2V0KCk7XG5cdFx0Y29uc3QgbGFzdFRhcmdldERhdGEgPSBfbGFzdERhdGEuaW1hZ2VEYXRhLmRhdGE7XG5cdFx0Y29uc3QgbGFzdFN0YXJ0TGluZU51bWJlciA9IF9sYXN0RGF0YS5yZW5kTGluZU51bWJlclN0YXJ0O1xuXHRcdGNvbnN0IGxhc3RMaW5lcyA9IF9sYXN0RGF0YS5saW5lcztcblx0XHRjb25zdCBsYXN0TGluZXNMZW5ndGggPSBsYXN0TGluZXMubGVuZ3RoO1xuXHRcdGNvbnN0IFdJRFRIID0gdGFyZ2V0LndpZHRoO1xuXHRcdGNvbnN0IHRhcmdldERhdGEgPSB0YXJnZXQuZGF0YTtcblxuXHRcdGNvbnN0IG1heERlc3RQaXhlbCA9IChlbmRMaW5lTnVtYmVyIC0gc3RhcnRMaW5lTnVtYmVyICsgMSkgKiBtaW5pbWFwTGluZUhlaWdodCAqIFdJRFRIICogNDtcblx0XHRsZXQgZGlydHlQaXhlbDEgPSAtMTsgLy8gdGhlIHBpeGVsIG9mZnNldCB1cCB0byB3aGljaCBhbGwgdGhlIGRhdGEgaXMgZXF1YWwgdG8gdGhlIHByZXYgZnJhbWVcblx0XHRsZXQgZGlydHlQaXhlbDIgPSAtMTsgLy8gdGhlIHBpeGVsIG9mZnNldCBhZnRlciB3aGljaCBhbGwgdGhlIGRhdGEgaXMgZXF1YWwgdG8gdGhlIHByZXYgZnJhbWVcblxuXHRcdGxldCBjb3B5U291cmNlU3RhcnQgPSAtMTtcblx0XHRsZXQgY29weVNvdXJjZUVuZCA9IC0xO1xuXHRcdGxldCBjb3B5RGVzdFN0YXJ0ID0gLTE7XG5cdFx0bGV0IGNvcHlEZXN0RW5kID0gLTE7XG5cblx0XHRsZXQgZGVzdF9keSA9IHRvcFBhZGRpbmdMaW5lQ291bnQgKiBtaW5pbWFwTGluZUhlaWdodDtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IGVuZExpbmVOdW1iZXI7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0Y29uc3QgbGluZUluZGV4ID0gbGluZU51bWJlciAtIHN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGxhc3RMaW5lSW5kZXggPSBsaW5lTnVtYmVyIC0gbGFzdFN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGNvbnN0IHNvdXJjZV9keSA9IChsYXN0TGluZUluZGV4ID49IDAgJiYgbGFzdExpbmVJbmRleCA8IGxhc3RMaW5lc0xlbmd0aCA/IGxhc3RMaW5lc1tsYXN0TGluZUluZGV4XS5keSA6IC0xKTtcblxuXHRcdFx0aWYgKHNvdXJjZV9keSA9PT0gLTEpIHtcblx0XHRcdFx0bmVlZGVkW2xpbmVJbmRleF0gPSB0cnVlO1xuXHRcdFx0XHRkZXN0X2R5ICs9IG1pbmltYXBMaW5lSGVpZ2h0O1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc291cmNlU3RhcnQgPSBzb3VyY2VfZHkgKiBXSURUSCAqIDQ7XG5cdFx0XHRjb25zdCBzb3VyY2VFbmQgPSAoc291cmNlX2R5ICsgbWluaW1hcExpbmVIZWlnaHQpICogV0lEVEggKiA0O1xuXHRcdFx0Y29uc3QgZGVzdFN0YXJ0ID0gZGVzdF9keSAqIFdJRFRIICogNDtcblx0XHRcdGNvbnN0IGRlc3RFbmQgPSAoZGVzdF9keSArIG1pbmltYXBMaW5lSGVpZ2h0KSAqIFdJRFRIICogNDtcblxuXHRcdFx0aWYgKGNvcHlTb3VyY2VFbmQgPT09IHNvdXJjZVN0YXJ0ICYmIGNvcHlEZXN0RW5kID09PSBkZXN0U3RhcnQpIHtcblx0XHRcdFx0Ly8gY29udGlndW91cyB6b25lID0+IGV4dGVuZCBjb3B5IHJlcXVlc3Rcblx0XHRcdFx0Y29weVNvdXJjZUVuZCA9IHNvdXJjZUVuZDtcblx0XHRcdFx0Y29weURlc3RFbmQgPSBkZXN0RW5kO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGNvcHlTb3VyY2VTdGFydCAhPT0gLTEpIHtcblx0XHRcdFx0XHQvLyBmbHVzaCBleGlzdGluZyBjb3B5IHJlcXVlc3Rcblx0XHRcdFx0XHR0YXJnZXREYXRhLnNldChsYXN0VGFyZ2V0RGF0YS5zdWJhcnJheShjb3B5U291cmNlU3RhcnQsIGNvcHlTb3VyY2VFbmQpLCBjb3B5RGVzdFN0YXJ0KTtcblx0XHRcdFx0XHRpZiAoZGlydHlQaXhlbDEgPT09IC0xICYmIGNvcHlTb3VyY2VTdGFydCA9PT0gMCAmJiBjb3B5U291cmNlU3RhcnQgPT09IGNvcHlEZXN0U3RhcnQpIHtcblx0XHRcdFx0XHRcdGRpcnR5UGl4ZWwxID0gY29weVNvdXJjZUVuZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGRpcnR5UGl4ZWwyID09PSAtMSAmJiBjb3B5U291cmNlRW5kID09PSBtYXhEZXN0UGl4ZWwgJiYgY29weVNvdXJjZVN0YXJ0ID09PSBjb3B5RGVzdFN0YXJ0KSB7XG5cdFx0XHRcdFx0XHRkaXJ0eVBpeGVsMiA9IGNvcHlTb3VyY2VTdGFydDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29weVNvdXJjZVN0YXJ0ID0gc291cmNlU3RhcnQ7XG5cdFx0XHRcdGNvcHlTb3VyY2VFbmQgPSBzb3VyY2VFbmQ7XG5cdFx0XHRcdGNvcHlEZXN0U3RhcnQgPSBkZXN0U3RhcnQ7XG5cdFx0XHRcdGNvcHlEZXN0RW5kID0gZGVzdEVuZDtcblx0XHRcdH1cblxuXHRcdFx0bmVlZGVkW2xpbmVJbmRleF0gPSBmYWxzZTtcblx0XHRcdGRlc3RfZHkgKz0gbWluaW1hcExpbmVIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0aWYgKGNvcHlTb3VyY2VTdGFydCAhPT0gLTEpIHtcblx0XHRcdC8vIGZsdXNoIGV4aXN0aW5nIGNvcHkgcmVxdWVzdFxuXHRcdFx0dGFyZ2V0RGF0YS5zZXQobGFzdFRhcmdldERhdGEuc3ViYXJyYXkoY29weVNvdXJjZVN0YXJ0LCBjb3B5U291cmNlRW5kKSwgY29weURlc3RTdGFydCk7XG5cdFx0XHRpZiAoZGlydHlQaXhlbDEgPT09IC0xICYmIGNvcHlTb3VyY2VTdGFydCA9PT0gMCAmJiBjb3B5U291cmNlU3RhcnQgPT09IGNvcHlEZXN0U3RhcnQpIHtcblx0XHRcdFx0ZGlydHlQaXhlbDEgPSBjb3B5U291cmNlRW5kO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGRpcnR5UGl4ZWwyID09PSAtMSAmJiBjb3B5U291cmNlRW5kID09PSBtYXhEZXN0UGl4ZWwgJiYgY29weVNvdXJjZVN0YXJ0ID09PSBjb3B5RGVzdFN0YXJ0KSB7XG5cdFx0XHRcdGRpcnR5UGl4ZWwyID0gY29weVNvdXJjZVN0YXJ0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGRpcnR5WTEgPSAoZGlydHlQaXhlbDEgPT09IC0xID8gLTEgOiBkaXJ0eVBpeGVsMSAvIChXSURUSCAqIDQpKTtcblx0XHRjb25zdCBkaXJ0eVkyID0gKGRpcnR5UGl4ZWwyID09PSAtMSA/IC0xIDogZGlydHlQaXhlbDIgLyAoV0lEVEggKiA0KSk7XG5cblx0XHRyZXR1cm4gW2RpcnR5WTEsIGRpcnR5WTIsIG5lZWRlZF07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmVuZGVyTGluZShcblx0XHR0YXJnZXQ6IEltYWdlRGF0YSxcblx0XHRiYWNrZ3JvdW5kQ29sb3I6IFJHQkE4LFxuXHRcdGJhY2tncm91bmRBbHBoYTogbnVtYmVyLFxuXHRcdHVzZUxpZ2h0ZXJGb250OiBib29sZWFuLFxuXHRcdHJlbmRlck1pbmltYXA6IFJlbmRlck1pbmltYXAsXG5cdFx0Y2hhcldpZHRoOiBudW1iZXIsXG5cdFx0Y29sb3JUcmFja2VyOiBNaW5pbWFwVG9rZW5zQ29sb3JUcmFja2VyLFxuXHRcdGZvcmVncm91bmRBbHBoYTogbnVtYmVyLFxuXHRcdG1pbmltYXBDaGFyUmVuZGVyZXI6IE1pbmltYXBDaGFyUmVuZGVyZXIsXG5cdFx0ZHk6IG51bWJlcixcblx0XHRpbm5lckxpbmVQYWRkaW5nOiBudW1iZXIsXG5cdFx0dGFiU2l6ZTogbnVtYmVyLFxuXHRcdGxpbmVEYXRhOiBWaWV3TGluZURhdGEsXG5cdFx0Zm9udFNjYWxlOiBudW1iZXIsXG5cdFx0bWluaW1hcExpbmVIZWlnaHQ6IG51bWJlclxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBjb250ZW50ID0gbGluZURhdGEuY29udGVudDtcblx0XHRjb25zdCB0b2tlbnMgPSBsaW5lRGF0YS50b2tlbnM7XG5cdFx0Y29uc3QgbWF4RHggPSB0YXJnZXQud2lkdGggLSBjaGFyV2lkdGg7XG5cdFx0Y29uc3QgZm9yY2UxcHhIZWlnaHQgPSAobWluaW1hcExpbmVIZWlnaHQgPT09IDEpO1xuXG5cdFx0bGV0IGR4ID0gTUlOSU1BUF9HVVRURVJfV0lEVEg7XG5cdFx0bGV0IGNoYXJJbmRleCA9IDA7XG5cdFx0bGV0IHRhYnNDaGFyRGVsdGEgPSAwO1xuXG5cdFx0Zm9yIChsZXQgdG9rZW5JbmRleCA9IDAsIHRva2Vuc0xlbiA9IHRva2Vucy5nZXRDb3VudCgpOyB0b2tlbkluZGV4IDwgdG9rZW5zTGVuOyB0b2tlbkluZGV4KyspIHtcblx0XHRcdGNvbnN0IHRva2VuRW5kSW5kZXggPSB0b2tlbnMuZ2V0RW5kT2Zmc2V0KHRva2VuSW5kZXgpO1xuXHRcdFx0Y29uc3QgdG9rZW5Db2xvcklkID0gdG9rZW5zLmdldEZvcmVncm91bmQodG9rZW5JbmRleCk7XG5cdFx0XHRjb25zdCB0b2tlbkNvbG9yID0gY29sb3JUcmFja2VyLmdldENvbG9yKHRva2VuQ29sb3JJZCk7XG5cblx0XHRcdGZvciAoOyBjaGFySW5kZXggPCB0b2tlbkVuZEluZGV4OyBjaGFySW5kZXgrKykge1xuXHRcdFx0XHRpZiAoZHggPiBtYXhEeCkge1xuXHRcdFx0XHRcdC8vIGhpdCBlZGdlIG9mIG1pbmltYXBcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY2hhckNvZGUgPSBjb250ZW50LmNoYXJDb2RlQXQoY2hhckluZGV4KTtcblxuXHRcdFx0XHRpZiAoY2hhckNvZGUgPT09IENoYXJDb2RlLlRhYikge1xuXHRcdFx0XHRcdGNvbnN0IGluc2VydFNwYWNlc0NvdW50ID0gdGFiU2l6ZSAtIChjaGFySW5kZXggKyB0YWJzQ2hhckRlbHRhKSAlIHRhYlNpemU7XG5cdFx0XHRcdFx0dGFic0NoYXJEZWx0YSArPSBpbnNlcnRTcGFjZXNDb3VudCAtIDE7XG5cdFx0XHRcdFx0Ly8gTm8gbmVlZCB0byByZW5kZXIgYW55dGhpbmcgc2luY2UgdGFiIGlzIGludmlzaWJsZVxuXHRcdFx0XHRcdGR4ICs9IGluc2VydFNwYWNlc0NvdW50ICogY2hhcldpZHRoO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoYXJDb2RlID09PSBDaGFyQ29kZS5TcGFjZSkge1xuXHRcdFx0XHRcdC8vIE5vIG5lZWQgdG8gcmVuZGVyIGFueXRoaW5nIHNpbmNlIHNwYWNlIGlzIGludmlzaWJsZVxuXHRcdFx0XHRcdGR4ICs9IGNoYXJXaWR0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBSZW5kZXIgdHdpY2UgZm9yIGEgZnVsbCB3aWR0aCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRjb25zdCBjb3VudCA9IHN0cmluZ3MuaXNGdWxsV2lkdGhDaGFyYWN0ZXIoY2hhckNvZGUpID8gMiA6IDE7XG5cblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcblx0XHRcdFx0XHRcdGlmIChyZW5kZXJNaW5pbWFwID09PSBSZW5kZXJNaW5pbWFwLkJsb2Nrcykge1xuXHRcdFx0XHRcdFx0XHRtaW5pbWFwQ2hhclJlbmRlcmVyLmJsb2NrUmVuZGVyQ2hhcih0YXJnZXQsIGR4LCBkeSArIGlubmVyTGluZVBhZGRpbmcsIHRva2VuQ29sb3IsIGZvcmVncm91bmRBbHBoYSwgYmFja2dyb3VuZENvbG9yLCBiYWNrZ3JvdW5kQWxwaGEsIGZvcmNlMXB4SGVpZ2h0KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7IC8vIFJlbmRlck1pbmltYXAuVGV4dFxuXHRcdFx0XHRcdFx0XHRtaW5pbWFwQ2hhclJlbmRlcmVyLnJlbmRlckNoYXIodGFyZ2V0LCBkeCwgZHkgKyBpbm5lckxpbmVQYWRkaW5nLCBjaGFyQ29kZSwgdG9rZW5Db2xvciwgZm9yZWdyb3VuZEFscGhhLCBiYWNrZ3JvdW5kQ29sb3IsIGJhY2tncm91bmRBbHBoYSwgZm9udFNjYWxlLCB1c2VMaWdodGVyRm9udCwgZm9yY2UxcHhIZWlnaHQpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRkeCArPSBjaGFyV2lkdGg7XG5cblx0XHRcdFx0XHRcdGlmIChkeCA+IG1heER4KSB7XG5cdFx0XHRcdFx0XHRcdC8vIGhpdCBlZGdlIG9mIG1pbmltYXBcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBDb250aWd1b3VzTGluZU1hcDxUPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VuZExpbmVOdW1iZXI6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVmYXVsdFZhbHVlOiBUO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92YWx1ZXM6IFRbXTtcblxuXHRjb25zdHJ1Y3RvcihzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBkZWZhdWx0VmFsdWU6IFQpIHtcblx0XHR0aGlzLl9zdGFydExpbmVOdW1iZXIgPSBzdGFydExpbmVOdW1iZXI7XG5cdFx0dGhpcy5fZW5kTGluZU51bWJlciA9IGVuZExpbmVOdW1iZXI7XG5cdFx0dGhpcy5fZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuXHRcdHRoaXMuX3ZhbHVlcyA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBjb3VudCA9IHRoaXMuX2VuZExpbmVOdW1iZXIgLSB0aGlzLl9zdGFydExpbmVOdW1iZXIgKyAxOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0dGhpcy5fdmFsdWVzW2ldID0gZGVmYXVsdFZhbHVlO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoYXMobGluZU51bWJlcjogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICh0aGlzLmdldChsaW5lTnVtYmVyKSAhPT0gdGhpcy5fZGVmYXVsdFZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyBzZXQobGluZU51bWJlcjogbnVtYmVyLCB2YWx1ZTogVCk6IHZvaWQge1xuXHRcdGlmIChsaW5lTnVtYmVyIDwgdGhpcy5fc3RhcnRMaW5lTnVtYmVyIHx8IGxpbmVOdW1iZXIgPiB0aGlzLl9lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3ZhbHVlc1tsaW5lTnVtYmVyIC0gdGhpcy5fc3RhcnRMaW5lTnVtYmVyXSA9IHZhbHVlO1xuXHR9XG5cblx0cHVibGljIGdldChsaW5lTnVtYmVyOiBudW1iZXIpOiBUIHtcblx0XHRpZiAobGluZU51bWJlciA8IHRoaXMuX3N0YXJ0TGluZU51bWJlciB8fCBsaW5lTnVtYmVyID4gdGhpcy5fZW5kTGluZU51bWJlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2RlZmF1bHRWYWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbHVlc1tsaW5lTnVtYmVyIC0gdGhpcy5fc3RhcnRMaW5lTnVtYmVyXTtcblx0fVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFNBQXNCLHlCQUF5QjtBQUMvQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFzQixrQkFBa0I7QUFDeEMsWUFBWSxjQUFjO0FBQzFCLFlBQVksYUFBYTtBQUN6QixTQUFnQiwrQkFBK0I7QUFDL0MsU0FBUyxpQkFBaUIsa0JBQWtCLGdCQUFnQjtBQUM1RCxTQUFTLGVBQWUsY0FBYyxzQkFBc0IsZ0NBQWdDO0FBQzVGLFNBQVMsYUFBYTtBQUN0QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxlQUFlO0FBRXhCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUNBQWlDO0FBSTFDLFlBQVksZ0JBQWdCO0FBQzVCLFNBQXVCLDJCQUEyQjtBQUNsRCxTQUFTLGtCQUFrQixtQkFBbUIsMEJBQTBCLHdCQUF3QjtBQUVoRyxTQUFTLGlCQUFpQjtBQUUxQixTQUF1QixXQUFXLGVBQWU7QUFDakQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxpQkFBaUIsaUNBQTJEO0FBQ3JGLFNB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QUksR0FBRyxRQUFRLEtBQUssaUJBQWlCLEtBQUssbUJBQW1CLEdBQUcsSUFBSSxPQUFPLEtBQUs7QUFDeEYsV0FBSyxRQUFRLENBQUMsSUFBSTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUFBLEVBRU8sSUFBSSxZQUE2QjtBQUN2QyxXQUFRLEtBQUssSUFBSSxVQUFVLE1BQU0sS0FBSztBQUFBLEVBQ3ZDO0FBQUEsRUFFTyxJQUFJLFlBQW9CLE9BQWdCO0FBQzlDLFFBQUksYUFBYSxLQUFLLG9CQUFvQixhQUFhLEtBQUssZ0JBQWdCO0FBQzNFO0FBQUEsSUFDRDtBQUNBLFNBQUssUUFBUSxhQUFhLEtBQUssZ0JBQWdCLElBQUk7QUFBQSxFQUNwRDtBQUFBLEVBRU8sSUFBSSxZQUF1QjtBQUNqQyxRQUFJLGFBQWEsS0FBSyxvQkFBb0IsYUFBYSxLQUFLLGdCQUFnQjtBQUMzRSxhQUFPLEtBQUs7QUFBQSxJQUNiO0FBQ0EsV0FBTyxLQUFLLFFBQVEsYUFBYSxLQUFLLGdCQUFnQjtBQUFBLEVBQ3ZEO0FBQ0Q7IiwKICAibmFtZXMiOiBbInNsaWRlckhlaWdodCIsICJtYXhNaW5pbWFwU2xpZGVyVG9wIiwgImNvbXB1dGVkU2xpZGVyUmF0aW8iLCAic2xpZGVyVG9wIiwgInJlc3VsdCJdCn0K
