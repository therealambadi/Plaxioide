import * as browser from "../../../../base/browser/browser.js";
import { createFastDomNode } from "../../../../base/browser/fastDomNode.js";
import * as platform from "../../../../base/common/platform.js";
import { RangeUtil } from "./rangeUtil.js";
import { FloatHorizontalRange, VisibleRanges } from "../../view/renderingContext.js";
import { LineDecoration } from "../../../common/viewLayout/lineDecorations.js";
import { ForeignElementType, RenderLineInput, renderViewLine, LineRange, DomPosition } from "../../../common/viewLayout/viewLineRenderer.js";
import { InlineDecorationType } from "../../../common/viewModel.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { EditorFontLigatures } from "../../../common/config/editorOptions.js";
const canUseFastRenderedViewLine = function() {
  if (platform.isNative) {
    return true;
  }
  if (platform.isLinux || browser.isFirefox || browser.isSafari) {
    return false;
  }
  return true;
}();
let monospaceAssumptionsAreValid = true;
const _ViewLine = class _ViewLine {
  constructor(_viewGpuContext, options) {
    this._viewGpuContext = _viewGpuContext;
    this._options = options;
    this._isMaybeInvalid = true;
    this._renderedViewLine = null;
  }
  // --- begin IVisibleLineData
  getDomNode() {
    if (this._renderedViewLine && this._renderedViewLine.domNode) {
      return this._renderedViewLine.domNode.domNode;
    }
    return null;
  }
  setDomNode(domNode) {
    if (this._renderedViewLine) {
      this._renderedViewLine.domNode = createFastDomNode(domNode);
    } else {
      throw new Error("I have no rendered view line to set the dom node to...");
    }
  }
  onContentChanged() {
    this._isMaybeInvalid = true;
  }
  onTokensChanged() {
    this._isMaybeInvalid = true;
  }
  onDecorationsChanged() {
    this._isMaybeInvalid = true;
  }
  onOptionsChanged(newOptions) {
    this._isMaybeInvalid = true;
    this._options = newOptions;
  }
  onSelectionChanged() {
    if (isHighContrast(this._options.themeType) || this._options.renderWhitespace === "selection") {
      this._isMaybeInvalid = true;
      return true;
    }
    return false;
  }
  renderLine(lineNumber, deltaTop, lineHeight, viewportData, sb) {
    if (this._options.useGpu && this._viewGpuContext?.canRender(this._options, viewportData, lineNumber)) {
      this._renderedViewLine?.domNode?.domNode.remove();
      this._renderedViewLine = null;
      return false;
    }
    if (this._isMaybeInvalid === false) {
      return false;
    }
    this._isMaybeInvalid = false;
    const lineData = viewportData.getViewLineRenderingData(lineNumber);
    const options = this._options;
    const actualInlineDecorations = LineDecoration.filter(lineData.inlineDecorations, lineNumber, lineData.minColumn, lineData.maxColumn);
    let selectionsOnLine = null;
    if (isHighContrast(options.themeType) || this._options.renderWhitespace === "selection") {
      const selections = viewportData.selections;
      for (const selection of selections) {
        if (selection.endLineNumber < lineNumber || selection.startLineNumber > lineNumber) {
          continue;
        }
        const startColumn = selection.startLineNumber === lineNumber ? selection.startColumn : lineData.minColumn;
        const endColumn = selection.endLineNumber === lineNumber ? selection.endColumn : lineData.maxColumn;
        if (startColumn < endColumn) {
          if (isHighContrast(options.themeType)) {
            actualInlineDecorations.push(new LineDecoration(startColumn, endColumn, "inline-selected-text", InlineDecorationType.Regular));
          }
          if (this._options.renderWhitespace === "selection") {
            if (!selectionsOnLine) {
              selectionsOnLine = [];
            }
            selectionsOnLine.push(new LineRange(startColumn - 1, endColumn - 1));
          }
        }
      }
    }
    const renderLineInput = new RenderLineInput(
      options.useMonospaceOptimizations,
      options.canUseHalfwidthRightwardsArrow,
      lineData.content,
      lineData.continuesWithWrappedLine,
      lineData.isBasicASCII,
      lineData.containsRTL,
      lineData.minColumn - 1,
      lineData.tokens,
      actualInlineDecorations,
      lineData.tabSize,
      lineData.startVisibleColumn,
      options.spaceWidth,
      options.middotWidth,
      options.wsmiddotWidth,
      options.stopRenderingLineAfter,
      options.renderWhitespace,
      options.renderControlCharacters,
      options.fontLigatures !== EditorFontLigatures.OFF,
      selectionsOnLine
    );
    if (this._renderedViewLine && this._renderedViewLine.input.equals(renderLineInput)) {
      return false;
    }
    sb.appendString('<div style="top:');
    sb.appendString(String(deltaTop));
    sb.appendString("px;height:");
    sb.appendString(String(lineHeight));
    sb.appendString('px;" class="');
    sb.appendString(_ViewLine.CLASS_NAME);
    sb.appendString('">');
    const output = renderViewLine(renderLineInput, sb);
    sb.appendString("</div>");
    let renderedViewLine = null;
    if (monospaceAssumptionsAreValid && canUseFastRenderedViewLine && lineData.isBasicASCII && options.useMonospaceOptimizations && output.containsForeignElements === ForeignElementType.None) {
      renderedViewLine = new FastRenderedViewLine(
        this._renderedViewLine ? this._renderedViewLine.domNode : null,
        renderLineInput,
        output.characterMapping
      );
    }
    if (!renderedViewLine) {
      renderedViewLine = createRenderedLine(
        this._renderedViewLine ? this._renderedViewLine.domNode : null,
        renderLineInput,
        output.characterMapping,
        output.containsRTL,
        output.containsForeignElements
      );
    }
    this._renderedViewLine = renderedViewLine;
    return true;
  }
  layoutLine(lineNumber, deltaTop, lineHeight) {
    if (this._renderedViewLine && this._renderedViewLine.domNode) {
      this._renderedViewLine.domNode.setTop(deltaTop);
      this._renderedViewLine.domNode.setHeight(lineHeight);
    }
  }
  // --- end IVisibleLineData
  getWidth(context) {
    if (!this._renderedViewLine) {
      return 0;
    }
    return this._renderedViewLine.getWidth(context);
  }
  getWidthIsFast() {
    if (!this._renderedViewLine) {
      return true;
    }
    return this._renderedViewLine.getWidthIsFast();
  }
  needsMonospaceFontCheck() {
    if (!this._renderedViewLine) {
      return false;
    }
    return this._renderedViewLine instanceof FastRenderedViewLine;
  }
  monospaceAssumptionsAreValid() {
    if (!this._renderedViewLine) {
      return monospaceAssumptionsAreValid;
    }
    if (this._renderedViewLine instanceof FastRenderedViewLine) {
      return this._renderedViewLine.monospaceAssumptionsAreValid();
    }
    return monospaceAssumptionsAreValid;
  }
  onMonospaceAssumptionsInvalidated() {
    if (this._renderedViewLine && this._renderedViewLine instanceof FastRenderedViewLine) {
      this._renderedViewLine = this._renderedViewLine.toSlowRenderedLine();
    }
  }
  getVisibleRangesForRange(lineNumber, startColumn, endColumn, context) {
    if (!this._renderedViewLine) {
      return null;
    }
    startColumn = Math.min(this._renderedViewLine.input.lineContent.length + 1, Math.max(1, startColumn));
    endColumn = Math.min(this._renderedViewLine.input.lineContent.length + 1, Math.max(1, endColumn));
    const stopRenderingLineAfter = this._renderedViewLine.input.stopRenderingLineAfter;
    if (stopRenderingLineAfter !== -1 && startColumn > stopRenderingLineAfter + 1 && endColumn > stopRenderingLineAfter + 1) {
      return new VisibleRanges(true, [new FloatHorizontalRange(this.getWidth(context), 0)]);
    }
    if (stopRenderingLineAfter !== -1 && startColumn > stopRenderingLineAfter + 1) {
      startColumn = stopRenderingLineAfter + 1;
    }
    if (stopRenderingLineAfter !== -1 && endColumn > stopRenderingLineAfter + 1) {
      endColumn = stopRenderingLineAfter + 1;
    }
    const horizontalRanges = this._renderedViewLine.getVisibleRangesForRange(lineNumber, startColumn, endColumn, context);
    if (horizontalRanges && horizontalRanges.length > 0) {
      return new VisibleRanges(false, horizontalRanges);
    }
    return null;
  }
  getColumnOfNodeOffset(spanNode, offset) {
    if (!this._renderedViewLine) {
      return 1;
    }
    return this._renderedViewLine.getColumnOfNodeOffset(spanNode, offset);
  }
};
_ViewLine.CLASS_NAME = "view-line";
let ViewLine = _ViewLine;
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxMonospaceDistance"] = 300] = "MaxMonospaceDistance";
  return Constants2;
})(Constants || {});
class FastRenderedViewLine {
  constructor(domNode, renderLineInput, characterMapping) {
    this._cachedWidth = -1;
    this.domNode = domNode;
    this.input = renderLineInput;
    const keyColumnCount = Math.floor(renderLineInput.lineContent.length / 300 /* MaxMonospaceDistance */);
    if (keyColumnCount > 0) {
      this._keyColumnPixelOffsetCache = new Float32Array(keyColumnCount);
      for (let i = 0; i < keyColumnCount; i++) {
        this._keyColumnPixelOffsetCache[i] = -1;
      }
    } else {
      this._keyColumnPixelOffsetCache = null;
    }
    this._characterMapping = characterMapping;
    this._charWidth = renderLineInput.spaceWidth;
  }
  getWidth(context) {
    if (!this.domNode || this.input.lineContent.length < 300 /* MaxMonospaceDistance */) {
      const horizontalOffset = this._characterMapping.getHorizontalOffset(this._characterMapping.length);
      return Math.round(this._charWidth * horizontalOffset);
    }
    if (this._cachedWidth === -1) {
      this._cachedWidth = this._getReadingTarget(this.domNode).offsetWidth;
      context?.markDidDomLayout();
    }
    return this._cachedWidth;
  }
  getWidthIsFast() {
    return this.input.lineContent.length < 300 /* MaxMonospaceDistance */ || this._cachedWidth !== -1;
  }
  monospaceAssumptionsAreValid() {
    if (!this.domNode) {
      return monospaceAssumptionsAreValid;
    }
    if (this.input.lineContent.length < 300 /* MaxMonospaceDistance */) {
      const expectedWidth = this.getWidth(null);
      const actualWidth = this.domNode.domNode.firstChild.offsetWidth;
      if (Math.abs(expectedWidth - actualWidth) >= 2) {
        console.warn(`monospace assumptions have been violated, therefore disabling monospace optimizations!`);
        monospaceAssumptionsAreValid = false;
      }
    }
    return monospaceAssumptionsAreValid;
  }
  toSlowRenderedLine() {
    return createRenderedLine(this.domNode, this.input, this._characterMapping, false, ForeignElementType.None);
  }
  getVisibleRangesForRange(lineNumber, startColumn, endColumn, context) {
    const startPosition = this._getColumnPixelOffset(lineNumber, startColumn, context);
    const endPosition = this._getColumnPixelOffset(lineNumber, endColumn, context);
    return [new FloatHorizontalRange(startPosition, endPosition - startPosition)];
  }
  _getColumnPixelOffset(lineNumber, column, context) {
    if (column <= 300 /* MaxMonospaceDistance */) {
      const horizontalOffset2 = this._characterMapping.getHorizontalOffset(column);
      return this._charWidth * horizontalOffset2;
    }
    const keyColumnOrdinal = Math.floor((column - 1) / 300 /* MaxMonospaceDistance */) - 1;
    const keyColumn = (keyColumnOrdinal + 1) * 300 /* MaxMonospaceDistance */ + 1;
    let keyColumnPixelOffset = -1;
    if (this._keyColumnPixelOffsetCache) {
      keyColumnPixelOffset = this._keyColumnPixelOffsetCache[keyColumnOrdinal];
      if (keyColumnPixelOffset === -1) {
        keyColumnPixelOffset = this._actualReadPixelOffset(lineNumber, keyColumn, context);
        this._keyColumnPixelOffsetCache[keyColumnOrdinal] = keyColumnPixelOffset;
      }
    }
    if (keyColumnPixelOffset === -1) {
      const horizontalOffset2 = this._characterMapping.getHorizontalOffset(column);
      return this._charWidth * horizontalOffset2;
    }
    const keyColumnHorizontalOffset = this._characterMapping.getHorizontalOffset(keyColumn);
    const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
    return keyColumnPixelOffset + this._charWidth * (horizontalOffset - keyColumnHorizontalOffset);
  }
  _getReadingTarget(myDomNode) {
    return myDomNode.domNode.firstChild;
  }
  _actualReadPixelOffset(lineNumber, column, context) {
    if (!this.domNode) {
      return -1;
    }
    const domPosition = this._characterMapping.getDomPosition(column);
    const r = RangeUtil.readHorizontalRanges(this._getReadingTarget(this.domNode), domPosition.partIndex, domPosition.charIndex, domPosition.partIndex, domPosition.charIndex, context);
    if (!r || r.length === 0) {
      return -1;
    }
    return r[0].left;
  }
  getColumnOfNodeOffset(spanNode, offset) {
    return getColumnOfNodeOffset(this._characterMapping, spanNode, offset);
  }
}
class RenderedViewLine {
  constructor(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements) {
    this.domNode = domNode;
    this.input = renderLineInput;
    this._characterMapping = characterMapping;
    this._isWhitespaceOnly = /^\s*$/.test(renderLineInput.lineContent);
    this._containsForeignElements = containsForeignElements;
    this._cachedWidth = -1;
    this._pixelOffsetCache = null;
    if (!containsRTL || this._characterMapping.length === 0) {
      this._pixelOffsetCache = new Float32Array(Math.max(2, this._characterMapping.length + 1));
      for (let column = 0, len = this._characterMapping.length; column <= len; column++) {
        this._pixelOffsetCache[column] = -1;
      }
    }
  }
  // --- Reading from the DOM methods
  _getReadingTarget(myDomNode) {
    return myDomNode.domNode.firstChild;
  }
  /**
   * Width of the line in pixels
   */
  getWidth(context) {
    if (!this.domNode) {
      return 0;
    }
    if (this._cachedWidth === -1) {
      this._cachedWidth = this._getReadingTarget(this.domNode).offsetWidth;
      context?.markDidDomLayout();
    }
    return this._cachedWidth;
  }
  getWidthIsFast() {
    if (this._cachedWidth === -1) {
      return false;
    }
    return true;
  }
  /**
   * Visible ranges for a model range
   */
  getVisibleRangesForRange(lineNumber, startColumn, endColumn, context) {
    if (!this.domNode) {
      return null;
    }
    if (this._pixelOffsetCache !== null) {
      const startOffset = this._readPixelOffset(this.domNode, lineNumber, startColumn, context);
      if (startOffset === -1) {
        return null;
      }
      const endOffset = this._readPixelOffset(this.domNode, lineNumber, endColumn, context);
      if (endOffset === -1) {
        return null;
      }
      return [new FloatHorizontalRange(startOffset, endOffset - startOffset)];
    }
    return this._readVisibleRangesForRange(this.domNode, lineNumber, startColumn, endColumn, context);
  }
  _readVisibleRangesForRange(domNode, lineNumber, startColumn, endColumn, context) {
    if (startColumn === endColumn) {
      const pixelOffset = this._readPixelOffset(domNode, lineNumber, startColumn, context);
      if (pixelOffset === -1) {
        return null;
      } else {
        return [new FloatHorizontalRange(pixelOffset, 0)];
      }
    } else {
      return this._readRawVisibleRangesForRange(domNode, startColumn, endColumn, context);
    }
  }
  _readPixelOffset(domNode, lineNumber, column, context) {
    if (this._characterMapping.length === 0) {
      if (this._containsForeignElements === ForeignElementType.None) {
        return 0;
      }
      if (this._containsForeignElements === ForeignElementType.After) {
        return 0;
      }
      if (this._containsForeignElements === ForeignElementType.Before) {
        return this.getWidth(context);
      }
      const readingTarget = this._getReadingTarget(domNode);
      if (readingTarget.firstChild) {
        context.markDidDomLayout();
        return readingTarget.firstChild.offsetWidth;
      } else {
        return 0;
      }
    }
    if (this._pixelOffsetCache !== null) {
      const cachedPixelOffset = this._pixelOffsetCache[column];
      if (cachedPixelOffset !== -1) {
        return cachedPixelOffset;
      }
      const result = this._actualReadPixelOffset(domNode, lineNumber, column, context);
      this._pixelOffsetCache[column] = result;
      return result;
    }
    return this._actualReadPixelOffset(domNode, lineNumber, column, context);
  }
  _actualReadPixelOffset(domNode, lineNumber, column, context) {
    if (this._characterMapping.length === 0) {
      const r2 = RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), 0, 0, 0, 0, context);
      if (!r2 || r2.length === 0) {
        return -1;
      }
      return r2[0].left;
    }
    if (column === this._characterMapping.length && this._isWhitespaceOnly && this._containsForeignElements === ForeignElementType.None) {
      return this.getWidth(context);
    }
    const domPosition = this._characterMapping.getDomPosition(column);
    const r = RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), domPosition.partIndex, domPosition.charIndex, domPosition.partIndex, domPosition.charIndex, context);
    if (!r || r.length === 0) {
      return -1;
    }
    const result = r[0].left;
    if (this.input.isBasicASCII) {
      const horizontalOffset = this._characterMapping.getHorizontalOffset(column);
      const expectedResult = Math.round(this.input.spaceWidth * horizontalOffset);
      if (Math.abs(expectedResult - result) <= 1) {
        return expectedResult;
      }
    }
    return result;
  }
  _readRawVisibleRangesForRange(domNode, startColumn, endColumn, context) {
    if (startColumn === 1 && endColumn === this._characterMapping.length) {
      return [new FloatHorizontalRange(0, this.getWidth(context))];
    }
    const startDomPosition = this._characterMapping.getDomPosition(startColumn);
    const endDomPosition = this._characterMapping.getDomPosition(endColumn);
    return RangeUtil.readHorizontalRanges(this._getReadingTarget(domNode), startDomPosition.partIndex, startDomPosition.charIndex, endDomPosition.partIndex, endDomPosition.charIndex, context);
  }
  /**
   * Returns the column for the text found at a specific offset inside a rendered dom node
   */
  getColumnOfNodeOffset(spanNode, offset) {
    return getColumnOfNodeOffset(this._characterMapping, spanNode, offset);
  }
}
class WebKitRenderedViewLine extends RenderedViewLine {
  _readVisibleRangesForRange(domNode, lineNumber, startColumn, endColumn, context) {
    const output = super._readVisibleRangesForRange(domNode, lineNumber, startColumn, endColumn, context);
    if (!output || output.length === 0 || startColumn === endColumn || startColumn === 1 && endColumn === this._characterMapping.length) {
      return output;
    }
    if (!this.input.containsRTL) {
      const endPixelOffset = this._readPixelOffset(domNode, lineNumber, endColumn, context);
      if (endPixelOffset !== -1) {
        const lastRange = output[output.length - 1];
        if (lastRange.left < endPixelOffset) {
          lastRange.width = endPixelOffset - lastRange.left;
        }
      }
    }
    return output;
  }
}
const createRenderedLine = function() {
  if (browser.isWebKit) {
    return createWebKitRenderedLine;
  }
  return createNormalRenderedLine;
}();
function createWebKitRenderedLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements) {
  return new WebKitRenderedViewLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements);
}
function createNormalRenderedLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements) {
  return new RenderedViewLine(domNode, renderLineInput, characterMapping, containsRTL, containsForeignElements);
}
function getColumnOfNodeOffset(characterMapping, spanNode, offset) {
  const spanNodeTextContentLength = spanNode.textContent.length;
  let spanIndex = -1;
  while (spanNode) {
    spanNode = spanNode.previousSibling;
    spanIndex++;
  }
  return characterMapping.getColumn(new DomPosition(spanIndex, offset), spanNodeTextContentLength);
}
export {
  ViewLine,
  getColumnOfNodeOffset
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0xpbmVzL3ZpZXdMaW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYnJvd3NlciBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBGYXN0RG9tTm9kZSwgY3JlYXRlRmFzdERvbU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZmFzdERvbU5vZGUuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVZpc2libGVMaW5lIH0gZnJvbSAnLi4vLi4vdmlldy92aWV3TGF5ZXIuanMnO1xuaW1wb3J0IHsgUmFuZ2VVdGlsIH0gZnJvbSAnLi9yYW5nZVV0aWwuanMnO1xuaW1wb3J0IHsgU3RyaW5nQnVpbGRlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3N0cmluZ0J1aWxkZXIuanMnO1xuaW1wb3J0IHsgRmxvYXRIb3Jpem9udGFsUmFuZ2UsIFZpc2libGVSYW5nZXMgfSBmcm9tICcuLi8uLi92aWV3L3JlbmRlcmluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgTGluZURlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0xheW91dC9saW5lRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhcmFjdGVyTWFwcGluZywgRm9yZWlnbkVsZW1lbnRUeXBlLCBSZW5kZXJMaW5lSW5wdXQsIHJlbmRlclZpZXdMaW5lLCBMaW5lUmFuZ2UsIERvbVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBWaWV3cG9ydERhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0xheW91dC92aWV3TGluZXNWaWV3cG9ydERhdGEuanMnO1xuaW1wb3J0IHsgSW5saW5lRGVjb3JhdGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IEVkaXRvckZvbnRMaWdhdHVyZXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRG9tUmVhZGluZ0NvbnRleHQgfSBmcm9tICcuL2RvbVJlYWRpbmdDb250ZXh0LmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xpbmVPcHRpb25zIH0gZnJvbSAnLi92aWV3TGluZU9wdGlvbnMuanMnO1xuaW1wb3J0IHsgVmlld0dwdUNvbnRleHQgfSBmcm9tICcuLi8uLi9ncHUvdmlld0dwdUNvbnRleHQuanMnO1xuXG5jb25zdCBjYW5Vc2VGYXN0UmVuZGVyZWRWaWV3TGluZSA9IChmdW5jdGlvbiAoKSB7XG5cdGlmIChwbGF0Zm9ybS5pc05hdGl2ZSkge1xuXHRcdC8vIEluIFZTQ29kZSB3ZSBrbm93IHZlcnkgd2VsbCB3aGVuIHRoZSB6b29tIGxldmVsIGNoYW5nZXNcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGlmIChwbGF0Zm9ybS5pc0xpbnV4IHx8IGJyb3dzZXIuaXNGaXJlZm94IHx8IGJyb3dzZXIuaXNTYWZhcmkpIHtcblx0XHQvLyBPbiBMaW51eCwgaXQgYXBwZWFycyB0aGF0IHpvb21pbmcgYWZmZWN0cyBjaGFyIHdpZHRocyAoaW4gcGl4ZWxzKSwgd2hpY2ggaXMgdW5leHBlY3RlZC5cblx0XHQvLyAtLVxuXHRcdC8vIEV2ZW4gdGhvdWdoIHdlIHJlYWQgY2hhcmFjdGVyIHdpZHRocyBjb3JyZWN0bHksIGhhdmluZyByZWFkIHRoZW0gYXQgYSBzcGVjaWZpYyB6b29tIGxldmVsXG5cdFx0Ly8gZG9lcyBub3QgbWVhbiB0aGV5IGFyZSB0aGUgc2FtZSBhdCB0aGUgY3VycmVudCB6b29tIGxldmVsLlxuXHRcdC8vIC0tXG5cdFx0Ly8gVGhpcyBjb3VsZCBiZSBpbXByb3ZlZCBpZiB3ZSBldmVyIGZpZ3VyZSBvdXQgaG93IHRvIGdldCBhbiBldmVudCB3aGVuIGJyb3dzZXJzIHpvb20sXG5cdFx0Ly8gYnV0IHVudGlsIHRoZW4gd2UgaGF2ZSB0byBzdGljayB3aXRoIHJlYWRpbmcgY2xpZW50IHJlY3RzLlxuXHRcdC8vIC0tXG5cdFx0Ly8gVGhlIHNhbWUgaGFzIGJlZW4gb2JzZXJ2ZWQgd2l0aCBGaXJlZm94IG9uIFdpbmRvd3M3XG5cdFx0Ly8gLS1cblx0XHQvLyBUaGUgc2FtZSBoYXMgYmVlbiBvdmVyc3ZlZCB3aXRoIFNhZmFyaVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiB0cnVlO1xufSkoKTtcblxubGV0IG1vbm9zcGFjZUFzc3VtcHRpb25zQXJlVmFsaWQgPSB0cnVlO1xuXG5leHBvcnQgY2xhc3MgVmlld0xpbmUgaW1wbGVtZW50cyBJVmlzaWJsZUxpbmUge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgQ0xBU1NfTkFNRSA9ICd2aWV3LWxpbmUnO1xuXG5cdHByaXZhdGUgX29wdGlvbnM6IFZpZXdMaW5lT3B0aW9ucztcblx0cHJpdmF0ZSBfaXNNYXliZUludmFsaWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX3JlbmRlcmVkVmlld0xpbmU6IElSZW5kZXJlZFZpZXdMaW5lIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF92aWV3R3B1Q29udGV4dDogVmlld0dwdUNvbnRleHQgfCB1bmRlZmluZWQsIG9wdGlvbnM6IFZpZXdMaW5lT3B0aW9ucykge1xuXHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuX2lzTWF5YmVJbnZhbGlkID0gdHJ1ZTtcblx0XHR0aGlzLl9yZW5kZXJlZFZpZXdMaW5lID0gbnVsbDtcblx0fVxuXG5cdC8vIC0tLSBiZWdpbiBJVmlzaWJsZUxpbmVEYXRhXG5cblx0cHVibGljIGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZWRWaWV3TGluZSAmJiB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmRvbU5vZGUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmRvbU5vZGUuZG9tTm9kZTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblx0cHVibGljIHNldERvbU5vZGUoZG9tTm9kZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRWaWV3TGluZS5kb21Ob2RlID0gY3JlYXRlRmFzdERvbU5vZGUoZG9tTm9kZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSSBoYXZlIG5vIHJlbmRlcmVkIHZpZXcgbGluZSB0byBzZXQgdGhlIGRvbSBub2RlIHRvLi4uJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG9uQ29udGVudENoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNNYXliZUludmFsaWQgPSB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvblRva2Vuc0NoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNNYXliZUludmFsaWQgPSB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvbkRlY29yYXRpb25zQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc01heWJlSW52YWxpZCA9IHRydWU7XG5cdH1cblx0cHVibGljIG9uT3B0aW9uc0NoYW5nZWQobmV3T3B0aW9uczogVmlld0xpbmVPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5faXNNYXliZUludmFsaWQgPSB0cnVlO1xuXHRcdHRoaXMuX29wdGlvbnMgPSBuZXdPcHRpb25zO1xuXHR9XG5cdHB1YmxpYyBvblNlbGVjdGlvbkNoYW5nZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKGlzSGlnaENvbnRyYXN0KHRoaXMuX29wdGlvbnMudGhlbWVUeXBlKSB8fCB0aGlzLl9vcHRpb25zLnJlbmRlcldoaXRlc3BhY2UgPT09ICdzZWxlY3Rpb24nKSB7XG5cdFx0XHR0aGlzLl9pc01heWJlSW52YWxpZCA9IHRydWU7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIHJlbmRlckxpbmUobGluZU51bWJlcjogbnVtYmVyLCBkZWx0YVRvcDogbnVtYmVyLCBsaW5lSGVpZ2h0OiBudW1iZXIsIHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhLCBzYjogU3RyaW5nQnVpbGRlcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9vcHRpb25zLnVzZUdwdSAmJiB0aGlzLl92aWV3R3B1Q29udGV4dD8uY2FuUmVuZGVyKHRoaXMuX29wdGlvbnMsIHZpZXdwb3J0RGF0YSwgbGluZU51bWJlcikpIHtcblx0XHRcdHRoaXMuX3JlbmRlcmVkVmlld0xpbmU/LmRvbU5vZGU/LmRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLl9yZW5kZXJlZFZpZXdMaW5lID0gbnVsbDtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faXNNYXliZUludmFsaWQgPT09IGZhbHNlKSB7XG5cdFx0XHQvLyBpdCBhcHBlYXJzIHRoYXQgbm90aGluZyByZWxldmFudCBoYXMgY2hhbmdlZFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lzTWF5YmVJbnZhbGlkID0gZmFsc2U7XG5cblx0XHRjb25zdCBsaW5lRGF0YSA9IHZpZXdwb3J0RGF0YS5nZXRWaWV3TGluZVJlbmRlcmluZ0RhdGEobGluZU51bWJlcik7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX29wdGlvbnM7XG5cdFx0Y29uc3QgYWN0dWFsSW5saW5lRGVjb3JhdGlvbnMgPSBMaW5lRGVjb3JhdGlvbi5maWx0ZXIobGluZURhdGEuaW5saW5lRGVjb3JhdGlvbnMsIGxpbmVOdW1iZXIsIGxpbmVEYXRhLm1pbkNvbHVtbiwgbGluZURhdGEubWF4Q29sdW1uKTtcblxuXHRcdC8vIE9ubHkgc2VuZCBzZWxlY3Rpb24gaW5mb3JtYXRpb24gd2hlbiBuZWVkZWQgZm9yIHJlbmRlcmluZyB3aGl0ZXNwYWNlXG5cdFx0bGV0IHNlbGVjdGlvbnNPbkxpbmU6IExpbmVSYW5nZVtdIHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKGlzSGlnaENvbnRyYXN0KG9wdGlvbnMudGhlbWVUeXBlKSB8fCB0aGlzLl9vcHRpb25zLnJlbmRlcldoaXRlc3BhY2UgPT09ICdzZWxlY3Rpb24nKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gdmlld3BvcnREYXRhLnNlbGVjdGlvbnM7XG5cdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cblx0XHRcdFx0aWYgKHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyIDwgbGluZU51bWJlciB8fCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyID4gbGluZU51bWJlcikge1xuXHRcdFx0XHRcdC8vIFNlbGVjdGlvbiBkb2VzIG5vdCBpbnRlcnNlY3QgbGluZVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc3RhcnRDb2x1bW4gPSAoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciA9PT0gbGluZU51bWJlciA/IHNlbGVjdGlvbi5zdGFydENvbHVtbiA6IGxpbmVEYXRhLm1pbkNvbHVtbik7XG5cdFx0XHRcdGNvbnN0IGVuZENvbHVtbiA9IChzZWxlY3Rpb24uZW5kTGluZU51bWJlciA9PT0gbGluZU51bWJlciA/IHNlbGVjdGlvbi5lbmRDb2x1bW4gOiBsaW5lRGF0YS5tYXhDb2x1bW4pO1xuXG5cdFx0XHRcdGlmIChzdGFydENvbHVtbiA8IGVuZENvbHVtbikge1xuXHRcdFx0XHRcdGlmIChpc0hpZ2hDb250cmFzdChvcHRpb25zLnRoZW1lVHlwZSkpIHtcblx0XHRcdFx0XHRcdGFjdHVhbElubGluZURlY29yYXRpb25zLnB1c2gobmV3IExpbmVEZWNvcmF0aW9uKHN0YXJ0Q29sdW1uLCBlbmRDb2x1bW4sICdpbmxpbmUtc2VsZWN0ZWQtdGV4dCcsIElubGluZURlY29yYXRpb25UeXBlLlJlZ3VsYXIpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoaXMuX29wdGlvbnMucmVuZGVyV2hpdGVzcGFjZSA9PT0gJ3NlbGVjdGlvbicpIHtcblx0XHRcdFx0XHRcdGlmICghc2VsZWN0aW9uc09uTGluZSkge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3Rpb25zT25MaW5lID0gW107XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHNlbGVjdGlvbnNPbkxpbmUucHVzaChuZXcgTGluZVJhbmdlKHN0YXJ0Q29sdW1uIC0gMSwgZW5kQ29sdW1uIC0gMSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbmRlckxpbmVJbnB1dCA9IG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRvcHRpb25zLnVzZU1vbm9zcGFjZU9wdGltaXphdGlvbnMsXG5cdFx0XHRvcHRpb25zLmNhblVzZUhhbGZ3aWR0aFJpZ2h0d2FyZHNBcnJvdyxcblx0XHRcdGxpbmVEYXRhLmNvbnRlbnQsXG5cdFx0XHRsaW5lRGF0YS5jb250aW51ZXNXaXRoV3JhcHBlZExpbmUsXG5cdFx0XHRsaW5lRGF0YS5pc0Jhc2ljQVNDSUksXG5cdFx0XHRsaW5lRGF0YS5jb250YWluc1JUTCxcblx0XHRcdGxpbmVEYXRhLm1pbkNvbHVtbiAtIDEsXG5cdFx0XHRsaW5lRGF0YS50b2tlbnMsXG5cdFx0XHRhY3R1YWxJbmxpbmVEZWNvcmF0aW9ucyxcblx0XHRcdGxpbmVEYXRhLnRhYlNpemUsXG5cdFx0XHRsaW5lRGF0YS5zdGFydFZpc2libGVDb2x1bW4sXG5cdFx0XHRvcHRpb25zLnNwYWNlV2lkdGgsXG5cdFx0XHRvcHRpb25zLm1pZGRvdFdpZHRoLFxuXHRcdFx0b3B0aW9ucy53c21pZGRvdFdpZHRoLFxuXHRcdFx0b3B0aW9ucy5zdG9wUmVuZGVyaW5nTGluZUFmdGVyLFxuXHRcdFx0b3B0aW9ucy5yZW5kZXJXaGl0ZXNwYWNlLFxuXHRcdFx0b3B0aW9ucy5yZW5kZXJDb250cm9sQ2hhcmFjdGVycyxcblx0XHRcdG9wdGlvbnMuZm9udExpZ2F0dXJlcyAhPT0gRWRpdG9yRm9udExpZ2F0dXJlcy5PRkYsXG5cdFx0XHRzZWxlY3Rpb25zT25MaW5lXG5cdFx0KTtcblxuXHRcdGlmICh0aGlzLl9yZW5kZXJlZFZpZXdMaW5lICYmIHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuaW5wdXQuZXF1YWxzKHJlbmRlckxpbmVJbnB1dCkpIHtcblx0XHRcdC8vIG5vIG5lZWQgdG8gZG8gYW55dGhpbmcsIHdlIGhhdmUgdGhlIHNhbWUgcmVuZGVyIGlucHV0XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0c2IuYXBwZW5kU3RyaW5nKCc8ZGl2IHN0eWxlPVwidG9wOicpO1xuXHRcdHNiLmFwcGVuZFN0cmluZyhTdHJpbmcoZGVsdGFUb3ApKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJ3B4O2hlaWdodDonKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcoU3RyaW5nKGxpbmVIZWlnaHQpKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJ3B4O1wiIGNsYXNzPVwiJyk7XG5cdFx0c2IuYXBwZW5kU3RyaW5nKFZpZXdMaW5lLkNMQVNTX05BTUUpO1xuXHRcdHNiLmFwcGVuZFN0cmluZygnXCI+Jyk7XG5cblx0XHRjb25zdCBvdXRwdXQgPSByZW5kZXJWaWV3TGluZShyZW5kZXJMaW5lSW5wdXQsIHNiKTtcblxuXHRcdHNiLmFwcGVuZFN0cmluZygnPC9kaXY+Jyk7XG5cblx0XHRsZXQgcmVuZGVyZWRWaWV3TGluZTogSVJlbmRlcmVkVmlld0xpbmUgfCBudWxsID0gbnVsbDtcblx0XHRpZiAobW9ub3NwYWNlQXNzdW1wdGlvbnNBcmVWYWxpZCAmJiBjYW5Vc2VGYXN0UmVuZGVyZWRWaWV3TGluZSAmJiBsaW5lRGF0YS5pc0Jhc2ljQVNDSUkgJiYgb3B0aW9ucy51c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zICYmIG91dHB1dC5jb250YWluc0ZvcmVpZ25FbGVtZW50cyA9PT0gRm9yZWlnbkVsZW1lbnRUeXBlLk5vbmUpIHtcblx0XHRcdHJlbmRlcmVkVmlld0xpbmUgPSBuZXcgRmFzdFJlbmRlcmVkVmlld0xpbmUoXG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVkVmlld0xpbmUgPyB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmRvbU5vZGUgOiBudWxsLFxuXHRcdFx0XHRyZW5kZXJMaW5lSW5wdXQsXG5cdFx0XHRcdG91dHB1dC5jaGFyYWN0ZXJNYXBwaW5nXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmICghcmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0cmVuZGVyZWRWaWV3TGluZSA9IGNyZWF0ZVJlbmRlcmVkTGluZShcblx0XHRcdFx0dGhpcy5fcmVuZGVyZWRWaWV3TGluZSA/IHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuZG9tTm9kZSA6IG51bGwsXG5cdFx0XHRcdHJlbmRlckxpbmVJbnB1dCxcblx0XHRcdFx0b3V0cHV0LmNoYXJhY3Rlck1hcHBpbmcsXG5cdFx0XHRcdG91dHB1dC5jb250YWluc1JUTCxcblx0XHRcdFx0b3V0cHV0LmNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlbmRlcmVkVmlld0xpbmUgPSByZW5kZXJlZFZpZXdMaW5lO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0TGluZShsaW5lTnVtYmVyOiBudW1iZXIsIGRlbHRhVG9wOiBudW1iZXIsIGxpbmVIZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJlZFZpZXdMaW5lICYmIHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuZG9tTm9kZSkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRWaWV3TGluZS5kb21Ob2RlLnNldFRvcChkZWx0YVRvcCk7XG5cdFx0XHR0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmRvbU5vZGUuc2V0SGVpZ2h0KGxpbmVIZWlnaHQpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBlbmQgSVZpc2libGVMaW5lRGF0YVxuXG5cdHB1YmxpYyBnZXRXaWR0aChjb250ZXh0OiBEb21SZWFkaW5nQ29udGV4dCB8IG51bGwpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmdldFdpZHRoKGNvbnRleHQpO1xuXHR9XG5cblx0cHVibGljIGdldFdpZHRoSXNGYXN0KCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLmdldFdpZHRoSXNGYXN0KCk7XG5cdH1cblxuXHRwdWJsaWMgbmVlZHNNb25vc3BhY2VGb250Q2hlY2soKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9yZW5kZXJlZFZpZXdMaW5lKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAodGhpcy5fcmVuZGVyZWRWaWV3TGluZSBpbnN0YW5jZW9mIEZhc3RSZW5kZXJlZFZpZXdMaW5lKTtcblx0fVxuXG5cdHB1YmxpYyBtb25vc3BhY2VBc3N1bXB0aW9uc0FyZVZhbGlkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0cmV0dXJuIG1vbm9zcGFjZUFzc3VtcHRpb25zQXJlVmFsaWQ7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9yZW5kZXJlZFZpZXdMaW5lIGluc3RhbmNlb2YgRmFzdFJlbmRlcmVkVmlld0xpbmUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZFZpZXdMaW5lLm1vbm9zcGFjZUFzc3VtcHRpb25zQXJlVmFsaWQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vbm9zcGFjZUFzc3VtcHRpb25zQXJlVmFsaWQ7XG5cdH1cblxuXHRwdWJsaWMgb25Nb25vc3BhY2VBc3N1bXB0aW9uc0ludmFsaWRhdGVkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJlZFZpZXdMaW5lICYmIHRoaXMuX3JlbmRlcmVkVmlld0xpbmUgaW5zdGFuY2VvZiBGYXN0UmVuZGVyZWRWaWV3TGluZSkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRWaWV3TGluZSA9IHRoaXMuX3JlbmRlcmVkVmlld0xpbmUudG9TbG93UmVuZGVyZWRMaW5lKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldFZpc2libGVSYW5nZXNGb3JSYW5nZShsaW5lTnVtYmVyOiBudW1iZXIsIHN0YXJ0Q29sdW1uOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyLCBjb250ZXh0OiBEb21SZWFkaW5nQ29udGV4dCk6IFZpc2libGVSYW5nZXMgfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX3JlbmRlcmVkVmlld0xpbmUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHN0YXJ0Q29sdW1uID0gTWF0aC5taW4odGhpcy5fcmVuZGVyZWRWaWV3TGluZS5pbnB1dC5saW5lQ29udGVudC5sZW5ndGggKyAxLCBNYXRoLm1heCgxLCBzdGFydENvbHVtbikpO1xuXHRcdGVuZENvbHVtbiA9IE1hdGgubWluKHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuaW5wdXQubGluZUNvbnRlbnQubGVuZ3RoICsgMSwgTWF0aC5tYXgoMSwgZW5kQ29sdW1uKSk7XG5cblx0XHRjb25zdCBzdG9wUmVuZGVyaW5nTGluZUFmdGVyID0gdGhpcy5fcmVuZGVyZWRWaWV3TGluZS5pbnB1dC5zdG9wUmVuZGVyaW5nTGluZUFmdGVyO1xuXG5cdFx0aWYgKHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIgIT09IC0xICYmIHN0YXJ0Q29sdW1uID4gc3RvcFJlbmRlcmluZ0xpbmVBZnRlciArIDEgJiYgZW5kQ29sdW1uID4gc3RvcFJlbmRlcmluZ0xpbmVBZnRlciArIDEpIHtcblx0XHRcdC8vIFRoaXMgcmFuZ2UgaXMgb2J2aW91c2x5IG5vdCB2aXNpYmxlXG5cdFx0XHRyZXR1cm4gbmV3IFZpc2libGVSYW5nZXModHJ1ZSwgW25ldyBGbG9hdEhvcml6b250YWxSYW5nZSh0aGlzLmdldFdpZHRoKGNvbnRleHQpLCAwKV0pO1xuXHRcdH1cblxuXHRcdGlmIChzdG9wUmVuZGVyaW5nTGluZUFmdGVyICE9PSAtMSAmJiBzdGFydENvbHVtbiA+IHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIgKyAxKSB7XG5cdFx0XHRzdGFydENvbHVtbiA9IHN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIgKyAxO1xuXHRcdH1cblxuXHRcdGlmIChzdG9wUmVuZGVyaW5nTGluZUFmdGVyICE9PSAtMSAmJiBlbmRDb2x1bW4gPiBzdG9wUmVuZGVyaW5nTGluZUFmdGVyICsgMSkge1xuXHRcdFx0ZW5kQ29sdW1uID0gc3RvcFJlbmRlcmluZ0xpbmVBZnRlciArIDE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaG9yaXpvbnRhbFJhbmdlcyA9IHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuZ2V0VmlzaWJsZVJhbmdlc0ZvclJhbmdlKGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRDb2x1bW4sIGNvbnRleHQpO1xuXHRcdGlmIChob3Jpem9udGFsUmFuZ2VzICYmIGhvcml6b250YWxSYW5nZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIG5ldyBWaXNpYmxlUmFuZ2VzKGZhbHNlLCBob3Jpem9udGFsUmFuZ2VzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb2x1bW5PZk5vZGVPZmZzZXQoc3Bhbk5vZGU6IEhUTUxFbGVtZW50LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9yZW5kZXJlZFZpZXdMaW5lKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkVmlld0xpbmUuZ2V0Q29sdW1uT2ZOb2RlT2Zmc2V0KHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJUmVuZGVyZWRWaWV3TGluZSB7XG5cdGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB8IG51bGw7XG5cdHJlYWRvbmx5IGlucHV0OiBSZW5kZXJMaW5lSW5wdXQ7XG5cdGdldFdpZHRoKGNvbnRleHQ6IERvbVJlYWRpbmdDb250ZXh0IHwgbnVsbCk6IG51bWJlcjtcblx0Z2V0V2lkdGhJc0Zhc3QoKTogYm9vbGVhbjtcblx0Z2V0VmlzaWJsZVJhbmdlc0ZvclJhbmdlKGxpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kQ29sdW1uOiBudW1iZXIsIGNvbnRleHQ6IERvbVJlYWRpbmdDb250ZXh0KTogRmxvYXRIb3Jpem9udGFsUmFuZ2VbXSB8IG51bGw7XG5cdGdldENvbHVtbk9mTm9kZU9mZnNldChzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKTogbnVtYmVyO1xufVxuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBJdCBzZWVtcyB0aGF0IHJvdW5kaW5nIGVycm9ycyBvY2N1ciB3aXRoIGxvbmcgbGluZXMsIHNvIHRoZSBwdXJlbHkgbXVsdGlwbGljYXRpb24gYmFzZWRcblx0ICogbWV0aG9kIGlzIG9ubHkgdmlhYmxlIGZvciBzaG9ydCBsaW5lcy4gRm9yIGxvbmdlciBsaW5lcywgd2UgbG9vayB1cCB0aGUgcmVhbCBwb3NpdGlvbiBvZlxuXHQgKiBldmVyeSAzMDB0aCBjaGFyYWN0ZXIgYW5kIHVzZSBtdWx0aXBsaWNhdGlvbiBiYXNlZCBvbiB0aGF0LlxuXHQgKlxuXHQgKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzMzMTc4XG5cdCAqL1xuXHRNYXhNb25vc3BhY2VEaXN0YW5jZSA9IDMwMFxufVxuXG4vKipcbiAqIEEgcmVuZGVyZWQgbGluZSB3aGljaCBpcyBndWFyYW50ZWVkIHRvIGNvbnRhaW4gb25seSByZWd1bGFyIEFTQ0lJIGFuZCBpcyByZW5kZXJlZCB3aXRoIGEgbW9ub3NwYWNlIGZvbnQuXG4gKi9cbmNsYXNzIEZhc3RSZW5kZXJlZFZpZXdMaW5lIGltcGxlbWVudHMgSVJlbmRlcmVkVmlld0xpbmUge1xuXG5cdHB1YmxpYyBkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4gfCBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQ6IFJlbmRlckxpbmVJbnB1dDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGFyV2lkdGg6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfa2V5Q29sdW1uUGl4ZWxPZmZzZXRDYWNoZTogRmxvYXQzMkFycmF5IHwgbnVsbDtcblx0cHJpdmF0ZSBfY2FjaGVkV2lkdGg6IG51bWJlciA9IC0xO1xuXG5cdGNvbnN0cnVjdG9yKGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB8IG51bGwsIHJlbmRlckxpbmVJbnB1dDogUmVuZGVyTGluZUlucHV0LCBjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nKSB7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9tTm9kZTtcblx0XHR0aGlzLmlucHV0ID0gcmVuZGVyTGluZUlucHV0O1xuXHRcdGNvbnN0IGtleUNvbHVtbkNvdW50ID0gTWF0aC5mbG9vcihyZW5kZXJMaW5lSW5wdXQubGluZUNvbnRlbnQubGVuZ3RoIC8gQ29uc3RhbnRzLk1heE1vbm9zcGFjZURpc3RhbmNlKTtcblx0XHRpZiAoa2V5Q29sdW1uQ291bnQgPiAwKSB7XG5cdFx0XHR0aGlzLl9rZXlDb2x1bW5QaXhlbE9mZnNldENhY2hlID0gbmV3IEZsb2F0MzJBcnJheShrZXlDb2x1bW5Db3VudCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGtleUNvbHVtbkNvdW50OyBpKyspIHtcblx0XHRcdFx0dGhpcy5fa2V5Q29sdW1uUGl4ZWxPZmZzZXRDYWNoZVtpXSA9IC0xO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9rZXlDb2x1bW5QaXhlbE9mZnNldENhY2hlID0gbnVsbDtcblx0XHR9XG5cblx0XHR0aGlzLl9jaGFyYWN0ZXJNYXBwaW5nID0gY2hhcmFjdGVyTWFwcGluZztcblx0XHR0aGlzLl9jaGFyV2lkdGggPSByZW5kZXJMaW5lSW5wdXQuc3BhY2VXaWR0aDtcblx0fVxuXG5cdHB1YmxpYyBnZXRXaWR0aChjb250ZXh0OiBEb21SZWFkaW5nQ29udGV4dCB8IG51bGwpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5kb21Ob2RlIHx8IHRoaXMuaW5wdXQubGluZUNvbnRlbnQubGVuZ3RoIDwgQ29uc3RhbnRzLk1heE1vbm9zcGFjZURpc3RhbmNlKSB7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsT2Zmc2V0ID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5nZXRIb3Jpem9udGFsT2Zmc2V0KHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcubGVuZ3RoKTtcblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMuX2NoYXJXaWR0aCAqIGhvcml6b250YWxPZmZzZXQpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY2FjaGVkV2lkdGggPT09IC0xKSB7XG5cdFx0XHR0aGlzLl9jYWNoZWRXaWR0aCA9IHRoaXMuX2dldFJlYWRpbmdUYXJnZXQodGhpcy5kb21Ob2RlKS5vZmZzZXRXaWR0aDtcblx0XHRcdGNvbnRleHQ/Lm1hcmtEaWREb21MYXlvdXQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlZFdpZHRoO1xuXHR9XG5cblx0cHVibGljIGdldFdpZHRoSXNGYXN0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5pbnB1dC5saW5lQ29udGVudC5sZW5ndGggPCBDb25zdGFudHMuTWF4TW9ub3NwYWNlRGlzdGFuY2UpIHx8IHRoaXMuX2NhY2hlZFdpZHRoICE9PSAtMTtcblx0fVxuXG5cdHB1YmxpYyBtb25vc3BhY2VBc3N1bXB0aW9uc0FyZVZhbGlkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5kb21Ob2RlKSB7XG5cdFx0XHRyZXR1cm4gbW9ub3NwYWNlQXNzdW1wdGlvbnNBcmVWYWxpZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaW5wdXQubGluZUNvbnRlbnQubGVuZ3RoIDwgQ29uc3RhbnRzLk1heE1vbm9zcGFjZURpc3RhbmNlKSB7XG5cdFx0XHRjb25zdCBleHBlY3RlZFdpZHRoID0gdGhpcy5nZXRXaWR0aChudWxsKTtcblx0XHRcdGNvbnN0IGFjdHVhbFdpZHRoID0gKDxIVE1MU3BhbkVsZW1lbnQ+dGhpcy5kb21Ob2RlLmRvbU5vZGUuZmlyc3RDaGlsZCkub2Zmc2V0V2lkdGg7XG5cdFx0XHRpZiAoTWF0aC5hYnMoZXhwZWN0ZWRXaWR0aCAtIGFjdHVhbFdpZHRoKSA+PSAyKSB7XG5cdFx0XHRcdC8vIG1vcmUgdGhhbiAycHggb2ZmXG5cdFx0XHRcdGNvbnNvbGUud2FybihgbW9ub3NwYWNlIGFzc3VtcHRpb25zIGhhdmUgYmVlbiB2aW9sYXRlZCwgdGhlcmVmb3JlIGRpc2FibGluZyBtb25vc3BhY2Ugb3B0aW1pemF0aW9ucyFgKTtcblx0XHRcdFx0bW9ub3NwYWNlQXNzdW1wdGlvbnNBcmVWYWxpZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbW9ub3NwYWNlQXNzdW1wdGlvbnNBcmVWYWxpZDtcblx0fVxuXG5cdHB1YmxpYyB0b1Nsb3dSZW5kZXJlZExpbmUoKTogUmVuZGVyZWRWaWV3TGluZSB7XG5cdFx0cmV0dXJuIGNyZWF0ZVJlbmRlcmVkTGluZSh0aGlzLmRvbU5vZGUsIHRoaXMuaW5wdXQsIHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcsIGZhbHNlLCBGb3JlaWduRWxlbWVudFR5cGUuTm9uZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmlzaWJsZVJhbmdlc0ZvclJhbmdlKGxpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kQ29sdW1uOiBudW1iZXIsIGNvbnRleHQ6IERvbVJlYWRpbmdDb250ZXh0KTogRmxvYXRIb3Jpem9udGFsUmFuZ2VbXSB8IG51bGwge1xuXHRcdGNvbnN0IHN0YXJ0UG9zaXRpb24gPSB0aGlzLl9nZXRDb2x1bW5QaXhlbE9mZnNldChsaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgY29udGV4dCk7XG5cdFx0Y29uc3QgZW5kUG9zaXRpb24gPSB0aGlzLl9nZXRDb2x1bW5QaXhlbE9mZnNldChsaW5lTnVtYmVyLCBlbmRDb2x1bW4sIGNvbnRleHQpO1xuXHRcdHJldHVybiBbbmV3IEZsb2F0SG9yaXpvbnRhbFJhbmdlKHN0YXJ0UG9zaXRpb24sIGVuZFBvc2l0aW9uIC0gc3RhcnRQb3NpdGlvbildO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29sdW1uUGl4ZWxPZmZzZXQobGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBudW1iZXIge1xuXHRcdGlmIChjb2x1bW4gPD0gQ29uc3RhbnRzLk1heE1vbm9zcGFjZURpc3RhbmNlKSB7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsT2Zmc2V0ID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5nZXRIb3Jpem9udGFsT2Zmc2V0KGNvbHVtbik7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2hhcldpZHRoICogaG9yaXpvbnRhbE9mZnNldDtcblx0XHR9XG5cblx0XHRjb25zdCBrZXlDb2x1bW5PcmRpbmFsID0gTWF0aC5mbG9vcigoY29sdW1uIC0gMSkgLyBDb25zdGFudHMuTWF4TW9ub3NwYWNlRGlzdGFuY2UpIC0gMTtcblx0XHRjb25zdCBrZXlDb2x1bW4gPSAoa2V5Q29sdW1uT3JkaW5hbCArIDEpICogQ29uc3RhbnRzLk1heE1vbm9zcGFjZURpc3RhbmNlICsgMTtcblx0XHRsZXQga2V5Q29sdW1uUGl4ZWxPZmZzZXQgPSAtMTtcblx0XHRpZiAodGhpcy5fa2V5Q29sdW1uUGl4ZWxPZmZzZXRDYWNoZSkge1xuXHRcdFx0a2V5Q29sdW1uUGl4ZWxPZmZzZXQgPSB0aGlzLl9rZXlDb2x1bW5QaXhlbE9mZnNldENhY2hlW2tleUNvbHVtbk9yZGluYWxdO1xuXHRcdFx0aWYgKGtleUNvbHVtblBpeGVsT2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0XHRrZXlDb2x1bW5QaXhlbE9mZnNldCA9IHRoaXMuX2FjdHVhbFJlYWRQaXhlbE9mZnNldChsaW5lTnVtYmVyLCBrZXlDb2x1bW4sIGNvbnRleHQpO1xuXHRcdFx0XHR0aGlzLl9rZXlDb2x1bW5QaXhlbE9mZnNldENhY2hlW2tleUNvbHVtbk9yZGluYWxdID0ga2V5Q29sdW1uUGl4ZWxPZmZzZXQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGtleUNvbHVtblBpeGVsT2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0Ly8gQ291bGQgbm90IHJlYWQgYWN0dWFsIGtleSBjb2x1bW4gcGl4ZWwgb2Zmc2V0XG5cdFx0XHRjb25zdCBob3Jpem9udGFsT2Zmc2V0ID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5nZXRIb3Jpem9udGFsT2Zmc2V0KGNvbHVtbik7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2hhcldpZHRoICogaG9yaXpvbnRhbE9mZnNldDtcblx0XHR9XG5cblx0XHRjb25zdCBrZXlDb2x1bW5Ib3Jpem9udGFsT2Zmc2V0ID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5nZXRIb3Jpem9udGFsT2Zmc2V0KGtleUNvbHVtbik7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbE9mZnNldCA9IHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcuZ2V0SG9yaXpvbnRhbE9mZnNldChjb2x1bW4pO1xuXHRcdHJldHVybiBrZXlDb2x1bW5QaXhlbE9mZnNldCArIHRoaXMuX2NoYXJXaWR0aCAqIChob3Jpem9udGFsT2Zmc2V0IC0ga2V5Q29sdW1uSG9yaXpvbnRhbE9mZnNldCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRSZWFkaW5nVGFyZ2V0KG15RG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+KTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiA8SFRNTFNwYW5FbGVtZW50Pm15RG9tTm9kZS5kb21Ob2RlLmZpcnN0Q2hpbGQ7XG5cdH1cblxuXHRwcml2YXRlIF9hY3R1YWxSZWFkUGl4ZWxPZmZzZXQobGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5kb21Ob2RlKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdGNvbnN0IGRvbVBvc2l0aW9uID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5nZXREb21Qb3NpdGlvbihjb2x1bW4pO1xuXHRcdGNvbnN0IHIgPSBSYW5nZVV0aWwucmVhZEhvcml6b250YWxSYW5nZXModGhpcy5fZ2V0UmVhZGluZ1RhcmdldCh0aGlzLmRvbU5vZGUpLCBkb21Qb3NpdGlvbi5wYXJ0SW5kZXgsIGRvbVBvc2l0aW9uLmNoYXJJbmRleCwgZG9tUG9zaXRpb24ucGFydEluZGV4LCBkb21Qb3NpdGlvbi5jaGFySW5kZXgsIGNvbnRleHQpO1xuXHRcdGlmICghciB8fCByLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gclswXS5sZWZ0O1xuXHR9XG5cblx0cHVibGljIGdldENvbHVtbk9mTm9kZU9mZnNldChzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gZ2V0Q29sdW1uT2ZOb2RlT2Zmc2V0KHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcsIHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHR9XG59XG5cbi8qKlxuICogRXZlcnkgdGltZSB3ZSByZW5kZXIgYSBsaW5lLCB3ZSBzYXZlIHdoYXQgd2UgaGF2ZSByZW5kZXJlZCBpbiBhbiBpbnN0YW5jZSBvZiB0aGlzIGNsYXNzLlxuICovXG5jbGFzcyBSZW5kZXJlZFZpZXdMaW5lIGltcGxlbWVudHMgSVJlbmRlcmVkVmlld0xpbmUge1xuXG5cdHB1YmxpYyBkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4gfCBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQ6IFJlbmRlckxpbmVJbnB1dDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2NoYXJhY3Rlck1hcHBpbmc6IENoYXJhY3Rlck1hcHBpbmc7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzV2hpdGVzcGFjZU9ubHk6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRhaW5zRm9yZWlnbkVsZW1lbnRzOiBGb3JlaWduRWxlbWVudFR5cGU7XG5cdHByaXZhdGUgX2NhY2hlZFdpZHRoOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBtYXAgdGhhdCBpcyB1c2VkIG9ubHkgd2hlbiB0aGUgbGluZSBpcyBndWFyYW50ZWVkIHRvIGhhdmUgbm8gUlRMIHRleHQuXG5cdCAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9waXhlbE9mZnNldENhY2hlOiBGbG9hdDMyQXJyYXkgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiB8IG51bGwsIHJlbmRlckxpbmVJbnB1dDogUmVuZGVyTGluZUlucHV0LCBjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nLCBjb250YWluc1JUTDogYm9vbGVhbiwgY29udGFpbnNGb3JlaWduRWxlbWVudHM6IEZvcmVpZ25FbGVtZW50VHlwZSkge1xuXHRcdHRoaXMuZG9tTm9kZSA9IGRvbU5vZGU7XG5cdFx0dGhpcy5pbnB1dCA9IHJlbmRlckxpbmVJbnB1dDtcblx0XHR0aGlzLl9jaGFyYWN0ZXJNYXBwaW5nID0gY2hhcmFjdGVyTWFwcGluZztcblx0XHR0aGlzLl9pc1doaXRlc3BhY2VPbmx5ID0gL15cXHMqJC8udGVzdChyZW5kZXJMaW5lSW5wdXQubGluZUNvbnRlbnQpO1xuXHRcdHRoaXMuX2NvbnRhaW5zRm9yZWlnbkVsZW1lbnRzID0gY29udGFpbnNGb3JlaWduRWxlbWVudHM7XG5cdFx0dGhpcy5fY2FjaGVkV2lkdGggPSAtMTtcblxuXHRcdHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGUgPSBudWxsO1xuXHRcdGlmICghY29udGFpbnNSVEwgfHwgdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5sZW5ndGggPT09IDAgLyogdGhlIGxpbmUgaXMgZW1wdHkgKi8pIHtcblx0XHRcdHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGUgPSBuZXcgRmxvYXQzMkFycmF5KE1hdGgubWF4KDIsIHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcubGVuZ3RoICsgMSkpO1xuXHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMCwgbGVuID0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5sZW5ndGg7IGNvbHVtbiA8PSBsZW47IGNvbHVtbisrKSB7XG5cdFx0XHRcdHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGVbY29sdW1uXSA9IC0xO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBSZWFkaW5nIGZyb20gdGhlIERPTSBtZXRob2RzXG5cblx0cHJvdGVjdGVkIF9nZXRSZWFkaW5nVGFyZ2V0KG15RG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+KTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiA8SFRNTFNwYW5FbGVtZW50Pm15RG9tTm9kZS5kb21Ob2RlLmZpcnN0Q2hpbGQ7XG5cdH1cblxuXHQvKipcblx0ICogV2lkdGggb2YgdGhlIGxpbmUgaW4gcGl4ZWxzXG5cdCAqL1xuXHRwdWJsaWMgZ2V0V2lkdGgoY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQgfCBudWxsKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuZG9tTm9kZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9jYWNoZWRXaWR0aCA9PT0gLTEpIHtcblx0XHRcdHRoaXMuX2NhY2hlZFdpZHRoID0gdGhpcy5fZ2V0UmVhZGluZ1RhcmdldCh0aGlzLmRvbU5vZGUpLm9mZnNldFdpZHRoO1xuXHRcdFx0Y29udGV4dD8ubWFya0RpZERvbUxheW91dCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY2FjaGVkV2lkdGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V2lkdGhJc0Zhc3QoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2NhY2hlZFdpZHRoID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBWaXNpYmxlIHJhbmdlcyBmb3IgYSBtb2RlbCByYW5nZVxuXHQgKi9cblx0cHVibGljIGdldFZpc2libGVSYW5nZXNGb3JSYW5nZShsaW5lTnVtYmVyOiBudW1iZXIsIHN0YXJ0Q29sdW1uOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyLCBjb250ZXh0OiBEb21SZWFkaW5nQ29udGV4dCk6IEZsb2F0SG9yaXpvbnRhbFJhbmdlW10gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuZG9tTm9kZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9waXhlbE9mZnNldENhY2hlICE9PSBudWxsKSB7XG5cdFx0XHQvLyB0aGUgdGV4dCBpcyBMVFJcblx0XHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gdGhpcy5fcmVhZFBpeGVsT2Zmc2V0KHRoaXMuZG9tTm9kZSwgbGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGNvbnRleHQpO1xuXHRcdFx0aWYgKHN0YXJ0T2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZW5kT2Zmc2V0ID0gdGhpcy5fcmVhZFBpeGVsT2Zmc2V0KHRoaXMuZG9tTm9kZSwgbGluZU51bWJlciwgZW5kQ29sdW1uLCBjb250ZXh0KTtcblx0XHRcdGlmIChlbmRPZmZzZXQgPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gW25ldyBGbG9hdEhvcml6b250YWxSYW5nZShzdGFydE9mZnNldCwgZW5kT2Zmc2V0IC0gc3RhcnRPZmZzZXQpXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVhZFZpc2libGVSYW5nZXNGb3JSYW5nZSh0aGlzLmRvbU5vZGUsIGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRDb2x1bW4sIGNvbnRleHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9yZWFkVmlzaWJsZVJhbmdlc0ZvclJhbmdlKGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiwgbGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBGbG9hdEhvcml6b250YWxSYW5nZVtdIHwgbnVsbCB7XG5cdFx0aWYgKHN0YXJ0Q29sdW1uID09PSBlbmRDb2x1bW4pIHtcblx0XHRcdGNvbnN0IHBpeGVsT2Zmc2V0ID0gdGhpcy5fcmVhZFBpeGVsT2Zmc2V0KGRvbU5vZGUsIGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBjb250ZXh0KTtcblx0XHRcdGlmIChwaXhlbE9mZnNldCA9PT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gW25ldyBGbG9hdEhvcml6b250YWxSYW5nZShwaXhlbE9mZnNldCwgMCldO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVhZFJhd1Zpc2libGVSYW5nZXNGb3JSYW5nZShkb21Ob2RlLCBzdGFydENvbHVtbiwgZW5kQ29sdW1uLCBjb250ZXh0KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3JlYWRQaXhlbE9mZnNldChkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4sIGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIsIGNvbnRleHQ6IERvbVJlYWRpbmdDb250ZXh0KTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fY2hhcmFjdGVyTWFwcGluZy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIFRoaXMgbGluZSBoYXMgbm8gY29udGVudFxuXHRcdFx0aWYgKHRoaXMuX2NvbnRhaW5zRm9yZWlnbkVsZW1lbnRzID09PSBGb3JlaWduRWxlbWVudFR5cGUuTm9uZSkge1xuXHRcdFx0XHQvLyBXZSBjYW4gYXNzdW1lIHRoZSBsaW5lIGlzIHJlYWxseSBlbXB0eVxuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9jb250YWluc0ZvcmVpZ25FbGVtZW50cyA9PT0gRm9yZWlnbkVsZW1lbnRUeXBlLkFmdGVyKSB7XG5cdFx0XHRcdC8vIFdlIGhhdmUgZm9yZWlnbiBlbGVtZW50cyBhZnRlciB0aGUgKGVtcHR5KSBsaW5lXG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2NvbnRhaW5zRm9yZWlnbkVsZW1lbnRzID09PSBGb3JlaWduRWxlbWVudFR5cGUuQmVmb3JlKSB7XG5cdFx0XHRcdC8vIFdlIGhhdmUgZm9yZWlnbiBlbGVtZW50cyBiZWZvcmUgdGhlIChlbXB0eSkgbGluZVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRXaWR0aChjb250ZXh0KTtcblx0XHRcdH1cblx0XHRcdC8vIFdlIGhhdmUgZm9yZWlnbiBlbGVtZW50cyBiZWZvcmUgJiBhZnRlciB0aGUgKGVtcHR5KSBsaW5lXG5cdFx0XHRjb25zdCByZWFkaW5nVGFyZ2V0ID0gdGhpcy5fZ2V0UmVhZGluZ1RhcmdldChkb21Ob2RlKTtcblx0XHRcdGlmIChyZWFkaW5nVGFyZ2V0LmZpcnN0Q2hpbGQpIHtcblx0XHRcdFx0Y29udGV4dC5tYXJrRGlkRG9tTGF5b3V0KCk7XG5cdFx0XHRcdHJldHVybiAoPEhUTUxTcGFuRWxlbWVudD5yZWFkaW5nVGFyZ2V0LmZpcnN0Q2hpbGQpLm9mZnNldFdpZHRoO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGUgIT09IG51bGwpIHtcblx0XHRcdC8vIHRoZSB0ZXh0IGlzIExUUlxuXG5cdFx0XHRjb25zdCBjYWNoZWRQaXhlbE9mZnNldCA9IHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGVbY29sdW1uXTtcblx0XHRcdGlmIChjYWNoZWRQaXhlbE9mZnNldCAhPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGNhY2hlZFBpeGVsT2Zmc2V0O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9hY3R1YWxSZWFkUGl4ZWxPZmZzZXQoZG9tTm9kZSwgbGluZU51bWJlciwgY29sdW1uLCBjb250ZXh0KTtcblx0XHRcdHRoaXMuX3BpeGVsT2Zmc2V0Q2FjaGVbY29sdW1uXSA9IHJlc3VsdDtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFJlYWRQaXhlbE9mZnNldChkb21Ob2RlLCBsaW5lTnVtYmVyLCBjb2x1bW4sIGNvbnRleHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0dWFsUmVhZFBpeGVsT2Zmc2V0KGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiwgbGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9jaGFyYWN0ZXJNYXBwaW5nLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gVGhpcyBsaW5lIGhhcyBubyBjb250ZW50XG5cdFx0XHRjb25zdCByID0gUmFuZ2VVdGlsLnJlYWRIb3Jpem9udGFsUmFuZ2VzKHRoaXMuX2dldFJlYWRpbmdUYXJnZXQoZG9tTm9kZSksIDAsIDAsIDAsIDAsIGNvbnRleHQpO1xuXHRcdFx0aWYgKCFyIHx8IHIubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByWzBdLmxlZnQ7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbHVtbiA9PT0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5sZW5ndGggJiYgdGhpcy5faXNXaGl0ZXNwYWNlT25seSAmJiB0aGlzLl9jb250YWluc0ZvcmVpZ25FbGVtZW50cyA9PT0gRm9yZWlnbkVsZW1lbnRUeXBlLk5vbmUpIHtcblx0XHRcdC8vIFRoaXMgYnJhbmNoIGhlbHBzIGluIHRoZSBjYXNlIG9mIHdoaXRlc3BhY2Ugb25seSBsaW5lcyB3aGljaCBoYXZlIGEgd2lkdGggc2V0XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRXaWR0aChjb250ZXh0KTtcblx0XHR9XG5cblx0XHRjb25zdCBkb21Qb3NpdGlvbiA9IHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcuZ2V0RG9tUG9zaXRpb24oY29sdW1uKTtcblxuXHRcdGNvbnN0IHIgPSBSYW5nZVV0aWwucmVhZEhvcml6b250YWxSYW5nZXModGhpcy5fZ2V0UmVhZGluZ1RhcmdldChkb21Ob2RlKSwgZG9tUG9zaXRpb24ucGFydEluZGV4LCBkb21Qb3NpdGlvbi5jaGFySW5kZXgsIGRvbVBvc2l0aW9uLnBhcnRJbmRleCwgZG9tUG9zaXRpb24uY2hhckluZGV4LCBjb250ZXh0KTtcblx0XHRpZiAoIXIgfHwgci5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gclswXS5sZWZ0O1xuXHRcdGlmICh0aGlzLmlucHV0LmlzQmFzaWNBU0NJSSkge1xuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbE9mZnNldCA9IHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcuZ2V0SG9yaXpvbnRhbE9mZnNldChjb2x1bW4pO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRSZXN1bHQgPSBNYXRoLnJvdW5kKHRoaXMuaW5wdXQuc3BhY2VXaWR0aCAqIGhvcml6b250YWxPZmZzZXQpO1xuXHRcdFx0aWYgKE1hdGguYWJzKGV4cGVjdGVkUmVzdWx0IC0gcmVzdWx0KSA8PSAxKSB7XG5cdFx0XHRcdHJldHVybiBleHBlY3RlZFJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX3JlYWRSYXdWaXNpYmxlUmFuZ2VzRm9yUmFuZ2UoZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+LCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBGbG9hdEhvcml6b250YWxSYW5nZVtdIHwgbnVsbCB7XG5cblx0XHRpZiAoc3RhcnRDb2x1bW4gPT09IDEgJiYgZW5kQ29sdW1uID09PSB0aGlzLl9jaGFyYWN0ZXJNYXBwaW5nLmxlbmd0aCkge1xuXHRcdFx0Ly8gVGhpcyBicmFuY2ggaGVscHMgSUUgd2l0aCBiaWRpIHRleHQgJiBnaXZlcyBhIHBlcmZvcm1hbmNlIGJvb3N0IHRvIG90aGVyIGJyb3dzZXJzIHdoZW4gcmVhZGluZyB2aXNpYmxlIHJhbmdlcyBmb3IgYW4gZW50aXJlIGxpbmVcblxuXHRcdFx0cmV0dXJuIFtuZXcgRmxvYXRIb3Jpem9udGFsUmFuZ2UoMCwgdGhpcy5nZXRXaWR0aChjb250ZXh0KSldO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0RG9tUG9zaXRpb24gPSB0aGlzLl9jaGFyYWN0ZXJNYXBwaW5nLmdldERvbVBvc2l0aW9uKHN0YXJ0Q29sdW1uKTtcblx0XHRjb25zdCBlbmREb21Qb3NpdGlvbiA9IHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcuZ2V0RG9tUG9zaXRpb24oZW5kQ29sdW1uKTtcblxuXHRcdHJldHVybiBSYW5nZVV0aWwucmVhZEhvcml6b250YWxSYW5nZXModGhpcy5fZ2V0UmVhZGluZ1RhcmdldChkb21Ob2RlKSwgc3RhcnREb21Qb3NpdGlvbi5wYXJ0SW5kZXgsIHN0YXJ0RG9tUG9zaXRpb24uY2hhckluZGV4LCBlbmREb21Qb3NpdGlvbi5wYXJ0SW5kZXgsIGVuZERvbVBvc2l0aW9uLmNoYXJJbmRleCwgY29udGV4dCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY29sdW1uIGZvciB0aGUgdGV4dCBmb3VuZCBhdCBhIHNwZWNpZmljIG9mZnNldCBpbnNpZGUgYSByZW5kZXJlZCBkb20gbm9kZVxuXHQgKi9cblx0cHVibGljIGdldENvbHVtbk9mTm9kZU9mZnNldChzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gZ2V0Q29sdW1uT2ZOb2RlT2Zmc2V0KHRoaXMuX2NoYXJhY3Rlck1hcHBpbmcsIHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHR9XG59XG5cbmNsYXNzIFdlYktpdFJlbmRlcmVkVmlld0xpbmUgZXh0ZW5kcyBSZW5kZXJlZFZpZXdMaW5lIHtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9yZWFkVmlzaWJsZVJhbmdlc0ZvclJhbmdlKGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50PiwgbGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlciwgY29udGV4dDogRG9tUmVhZGluZ0NvbnRleHQpOiBGbG9hdEhvcml6b250YWxSYW5nZVtdIHwgbnVsbCB7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gc3VwZXIuX3JlYWRWaXNpYmxlUmFuZ2VzRm9yUmFuZ2UoZG9tTm9kZSwgbGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZENvbHVtbiwgY29udGV4dCk7XG5cblx0XHRpZiAoIW91dHB1dCB8fCBvdXRwdXQubGVuZ3RoID09PSAwIHx8IHN0YXJ0Q29sdW1uID09PSBlbmRDb2x1bW4gfHwgKHN0YXJ0Q29sdW1uID09PSAxICYmIGVuZENvbHVtbiA9PT0gdGhpcy5fY2hhcmFjdGVyTWFwcGluZy5sZW5ndGgpKSB7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH1cblxuXHRcdC8vIFdlYktpdCBpcyBidWdneSBhbmQgcmV0dXJucyBhbiBleHBhbmRlZCByYW5nZSAodG8gY29udGFpbiB3b3JkcyBpbiBzb21lIGNhc2VzKVxuXHRcdC8vIFRoZSBsYXN0IGNsaWVudCByZWN0IGlzIGVubGFyZ2VkIChJIHRoaW5rKVxuXHRcdGlmICghdGhpcy5pbnB1dC5jb250YWluc1JUTCkge1xuXHRcdFx0Ly8gVGhpcyBpcyBhbiBhdHRlbXB0IHRvIHBhdGNoIHRoaW5ncyB1cFxuXHRcdFx0Ly8gRmluZCBwb3NpdGlvbiBvZiBsYXN0IGNvbHVtblxuXHRcdFx0Y29uc3QgZW5kUGl4ZWxPZmZzZXQgPSB0aGlzLl9yZWFkUGl4ZWxPZmZzZXQoZG9tTm9kZSwgbGluZU51bWJlciwgZW5kQ29sdW1uLCBjb250ZXh0KTtcblx0XHRcdGlmIChlbmRQaXhlbE9mZnNldCAhPT0gLTEpIHtcblx0XHRcdFx0Y29uc3QgbGFzdFJhbmdlID0gb3V0cHV0W291dHB1dC5sZW5ndGggLSAxXTtcblx0XHRcdFx0aWYgKGxhc3RSYW5nZS5sZWZ0IDwgZW5kUGl4ZWxPZmZzZXQpIHtcblx0XHRcdFx0XHQvLyBUcmltIGRvd24gdGhlIHdpZHRoIG9mIHRoZSBsYXN0IHZpc2libGUgcmFuZ2UgdG8gbm90IGdvIGFmdGVyIHRoZSBsYXN0IGNvbHVtbidzIHBvc2l0aW9uXG5cdFx0XHRcdFx0bGFzdFJhbmdlLndpZHRoID0gZW5kUGl4ZWxPZmZzZXQgLSBsYXN0UmFuZ2UubGVmdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cbn1cblxuY29uc3QgY3JlYXRlUmVuZGVyZWRMaW5lOiAoZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+IHwgbnVsbCwgcmVuZGVyTGluZUlucHV0OiBSZW5kZXJMaW5lSW5wdXQsIGNoYXJhY3Rlck1hcHBpbmc6IENoYXJhY3Rlck1hcHBpbmcsIGNvbnRhaW5zUlRMOiBib29sZWFuLCBjb250YWluc0ZvcmVpZ25FbGVtZW50czogRm9yZWlnbkVsZW1lbnRUeXBlKSA9PiBSZW5kZXJlZFZpZXdMaW5lID0gKGZ1bmN0aW9uICgpIHtcblx0aWYgKGJyb3dzZXIuaXNXZWJLaXQpIHtcblx0XHRyZXR1cm4gY3JlYXRlV2ViS2l0UmVuZGVyZWRMaW5lO1xuXHR9XG5cdHJldHVybiBjcmVhdGVOb3JtYWxSZW5kZXJlZExpbmU7XG59KSgpO1xuXG5mdW5jdGlvbiBjcmVhdGVXZWJLaXRSZW5kZXJlZExpbmUoZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+IHwgbnVsbCwgcmVuZGVyTGluZUlucHV0OiBSZW5kZXJMaW5lSW5wdXQsIGNoYXJhY3Rlck1hcHBpbmc6IENoYXJhY3Rlck1hcHBpbmcsIGNvbnRhaW5zUlRMOiBib29sZWFuLCBjb250YWluc0ZvcmVpZ25FbGVtZW50czogRm9yZWlnbkVsZW1lbnRUeXBlKTogUmVuZGVyZWRWaWV3TGluZSB7XG5cdHJldHVybiBuZXcgV2ViS2l0UmVuZGVyZWRWaWV3TGluZShkb21Ob2RlLCByZW5kZXJMaW5lSW5wdXQsIGNoYXJhY3Rlck1hcHBpbmcsIGNvbnRhaW5zUlRMLCBjb250YWluc0ZvcmVpZ25FbGVtZW50cyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU5vcm1hbFJlbmRlcmVkTGluZShkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4gfCBudWxsLCByZW5kZXJMaW5lSW5wdXQ6IFJlbmRlckxpbmVJbnB1dCwgY2hhcmFjdGVyTWFwcGluZzogQ2hhcmFjdGVyTWFwcGluZywgY29udGFpbnNSVEw6IGJvb2xlYW4sIGNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzOiBGb3JlaWduRWxlbWVudFR5cGUpOiBSZW5kZXJlZFZpZXdMaW5lIHtcblx0cmV0dXJuIG5ldyBSZW5kZXJlZFZpZXdMaW5lKGRvbU5vZGUsIHJlbmRlckxpbmVJbnB1dCwgY2hhcmFjdGVyTWFwcGluZywgY29udGFpbnNSVEwsIGNvbnRhaW5zRm9yZWlnbkVsZW1lbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbHVtbk9mTm9kZU9mZnNldChjaGFyYWN0ZXJNYXBwaW5nOiBDaGFyYWN0ZXJNYXBwaW5nLCBzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKTogbnVtYmVyIHtcblx0Y29uc3Qgc3Bhbk5vZGVUZXh0Q29udGVudExlbmd0aCA9IHNwYW5Ob2RlLnRleHRDb250ZW50IS5sZW5ndGg7XG5cblx0bGV0IHNwYW5JbmRleCA9IC0xO1xuXHR3aGlsZSAoc3Bhbk5vZGUpIHtcblx0XHRzcGFuTm9kZSA9IDxIVE1MRWxlbWVudD5zcGFuTm9kZS5wcmV2aW91c1NpYmxpbmc7XG5cdFx0c3BhbkluZGV4Kys7XG5cdH1cblxuXHRyZXR1cm4gY2hhcmFjdGVyTWFwcGluZy5nZXRDb2x1bW4obmV3IERvbVBvc2l0aW9uKHNwYW5JbmRleCwgb2Zmc2V0KSwgc3Bhbk5vZGVUZXh0Q29udGVudExlbmd0aCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLGFBQWE7QUFDekIsU0FBc0IseUJBQXlCO0FBQy9DLFlBQVksY0FBYztB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
