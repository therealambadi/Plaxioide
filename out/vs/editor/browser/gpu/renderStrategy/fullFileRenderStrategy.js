import { getActiveWindow } from "../../../../base/browser/dom.js";
import { Color } from "../../../../base/common/color.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { CursorColumns } from "../../../common/core/cursorColumns.js";
import { ViewEventType } from "../../../common/viewEvents.js";
import { createContentSegmenter } from "../contentSegmenter.js";
import { fullFileRenderStrategyWgsl } from "./fullFileRenderStrategy.wgsl.js";
import { BindingId } from "../gpu.js";
import { GPULifecycle } from "../gpuDisposable.js";
import { quadVertices } from "../gpuUtils.js";
import { ViewGpuContext } from "../viewGpuContext.js";
import { BaseRenderStrategy } from "./baseRenderStrategy.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["IndicesPerCell"] = 6] = "IndicesPerCell";
  return Constants2;
})(Constants || {});
var CellBufferInfo = /* @__PURE__ */ ((CellBufferInfo2) => {
  CellBufferInfo2[CellBufferInfo2["FloatsPerEntry"] = 6] = "FloatsPerEntry";
  CellBufferInfo2[CellBufferInfo2["BytesPerEntry"] = 24] = "BytesPerEntry";
  CellBufferInfo2[CellBufferInfo2["Offset_X"] = 0] = "Offset_X";
  CellBufferInfo2[CellBufferInfo2["Offset_Y"] = 1] = "Offset_Y";
  CellBufferInfo2[CellBufferInfo2["Offset_Unused1"] = 2] = "Offset_Unused1";
  CellBufferInfo2[CellBufferInfo2["Offset_Unused2"] = 3] = "Offset_Unused2";
  CellBufferInfo2[CellBufferInfo2["GlyphIndex"] = 4] = "GlyphIndex";
  CellBufferInfo2[CellBufferInfo2["TextureIndex"] = 5] = "TextureIndex";
  return CellBufferInfo2;
})(CellBufferInfo || {});
const _FullFileRenderStrategy = class _FullFileRenderStrategy extends BaseRenderStrategy {
  constructor(context, viewGpuContext, device, glyphRasterizer) {
    super(context, viewGpuContext, device, glyphRasterizer);
    this.type = "fullfile";
    this.wgsl = fullFileRenderStrategyWgsl;
    this._activeDoubleBufferIndex = 0;
    this._upToDateLines = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
    this._visibleObjectCount = 0;
    this._finalRenderedLine = 0;
    this._scrollInitialized = false;
    this._queuedBufferUpdates = [[], []];
    const bufferSize = _FullFileRenderStrategy.maxSupportedLines * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */ * Float32Array.BYTES_PER_ELEMENT;
    this._cellBindBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco full file cell buffer",
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })).object;
    this._cellValueBuffers = [
      new ArrayBuffer(bufferSize),
      new ArrayBuffer(bufferSize)
    ];
    const scrollOffsetBufferSize = 2;
    this._scrollOffsetBindBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco scroll offset buffer",
      size: scrollOffsetBufferSize * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })).object;
    this._scrollOffsetValueBuffer = new Float32Array(scrollOffsetBufferSize);
  }
  get bindGroupEntries() {
    return [
      { binding: BindingId.Cells, resource: { buffer: this._cellBindBuffer } },
      { binding: BindingId.ScrollOffset, resource: { buffer: this._scrollOffsetBindBuffer } }
    ];
  }
  // #region Event handlers
  // The primary job of these handlers is to:
  // 1. Invalidate the up to date line cache, which will cause the line to be re-rendered when
  //    it's _within the viewport_.
  // 2. Pass relevant events on to the render function so it can force certain line ranges to be
  //    re-rendered even if they're not in the viewport. For example when a view zone is added,
  //    there are lines that used to be visible but are no longer, so those ranges must be
  //    cleared and uploaded to the GPU.
  onConfigurationChanged(e) {
    this._invalidateAllLines();
    this._queueBufferUpdate(e);
    return true;
  }
  onDecorationsChanged(e) {
    this._invalidateAllLines();
    return true;
  }
  onTokensChanged(e) {
    for (const range of e.ranges) {
      this._invalidateLineRange(range.fromLineNumber, range.toLineNumber);
    }
    return true;
  }
  onLinesDeleted(e) {
    this._invalidateLinesFrom(e.fromLineNumber);
    this._queueBufferUpdate(e);
    return true;
  }
  onLinesInserted(e) {
    this._invalidateLinesFrom(e.fromLineNumber);
    return true;
  }
  onLinesChanged(e) {
    this._invalidateLineRange(e.fromLineNumber, e.fromLineNumber + e.count);
    return true;
  }
  onScrollChanged(e) {
    const dpr = getActiveWindow().devicePixelRatio;
    this._scrollOffsetValueBuffer[0] = (e?.scrollLeft ?? this._context.viewLayout.getCurrentScrollLeft()) * dpr;
    this._scrollOffsetValueBuffer[1] = (e?.scrollTop ?? this._context.viewLayout.getCurrentScrollTop()) * dpr;
    this._device.queue.writeBuffer(this._scrollOffsetBindBuffer, 0, this._scrollOffsetValueBuffer);
    return true;
  }
  onThemeChanged(e) {
    this._invalidateAllLines();
    return true;
  }
  onLineMappingChanged(e) {
    this._invalidateAllLines();
    this._queueBufferUpdate(e);
    return true;
  }
  onZonesChanged(e) {
    this._invalidateAllLines();
    this._queueBufferUpdate(e);
    return true;
  }
  // #endregion
  _invalidateAllLines() {
    this._upToDateLines[0].clear();
    this._upToDateLines[1].clear();
  }
  _invalidateLinesFrom(lineNumber) {
    for (const i of [0, 1]) {
      const upToDateLines = this._upToDateLines[i];
      for (const upToDateLine of upToDateLines) {
        if (upToDateLine >= lineNumber) {
          upToDateLines.delete(upToDateLine);
        }
      }
    }
  }
  _invalidateLineRange(fromLineNumber, toLineNumber) {
    for (let i = fromLineNumber; i <= toLineNumber; i++) {
      this._upToDateLines[0].delete(i);
      this._upToDateLines[1].delete(i);
    }
  }
  reset() {
    this._invalidateAllLines();
    for (const bufferIndex of [0, 1]) {
      const buffer = new Float32Array(this._cellValueBuffers[bufferIndex]);
      buffer.fill(0, 0, buffer.length);
      this._device.queue.writeBuffer(this._cellBindBuffer, 0, buffer.buffer, 0, buffer.byteLength);
    }
    this._finalRenderedLine = 0;
  }
  update(viewportData, viewLineOptions) {
    let chars = "";
    let segment;
    let charWidth = 0;
    let y = 0;
    let x = 0;
    let absoluteOffsetX = 0;
    let absoluteOffsetY = 0;
    let tabXOffset = 0;
    let glyph;
    let cellIndex = 0;
    let tokenStartIndex = 0;
    let tokenEndIndex = 0;
    let tokenMetadata = 0;
    let decorationStyleSetBold;
    let decorationStyleSetColor;
    let decorationStyleSetOpacity;
    let lineData;
    let decoration;
    let fillStartIndex = 0;
    let fillEndIndex = 0;
    let tokens;
    const dpr = getActiveWindow().devicePixelRatio;
    let contentSegmenter;
    if (!this._scrollInitialized) {
      this.onScrollChanged();
      this._scrollInitialized = true;
    }
    const cellBuffer = new Float32Array(this._cellValueBuffers[this._activeDoubleBufferIndex]);
    const lineIndexCount = _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
    const upToDateLines = this._upToDateLines[this._activeDoubleBufferIndex];
    let dirtyLineStart = 3e3;
    let dirtyLineEnd = 0;
    const queuedBufferUpdates = this._queuedBufferUpdates[this._activeDoubleBufferIndex];
    while (queuedBufferUpdates.length) {
      const e = queuedBufferUpdates.shift();
      switch (e.type) {
        // TODO: Refine these cases so we're not throwing away everything
        case ViewEventType.ViewConfigurationChanged:
        case ViewEventType.ViewLineMappingChanged:
        case ViewEventType.ViewZonesChanged: {
          cellBuffer.fill(0);
          dirtyLineStart = 1;
          dirtyLineEnd = Math.max(dirtyLineEnd, this._finalRenderedLine);
          this._finalRenderedLine = 0;
          break;
        }
        case ViewEventType.ViewLinesDeleted: {
          const deletedLineContentStartIndex = (e.fromLineNumber - 1) * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
          const deletedLineContentEndIndex = e.toLineNumber * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
          const nullContentStartIndex = (this._finalRenderedLine - (e.toLineNumber - e.fromLineNumber + 1)) * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
          cellBuffer.set(cellBuffer.subarray(deletedLineContentEndIndex), deletedLineContentStartIndex);
          cellBuffer.fill(0, nullContentStartIndex);
          dirtyLineStart = Math.min(dirtyLineStart, e.fromLineNumber);
          dirtyLineEnd = Math.max(dirtyLineEnd, this._finalRenderedLine);
          this._finalRenderedLine -= e.toLineNumber - e.fromLineNumber + 1;
          break;
        }
      }
    }
    for (y = viewportData.startLineNumber; y <= viewportData.endLineNumber; y++) {
      if (!this._viewGpuContext.canRender(viewLineOptions, viewportData, y)) {
        fillStartIndex = (y - 1) * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
        fillEndIndex = y * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
        cellBuffer.fill(0, fillStartIndex, fillEndIndex);
        dirtyLineStart = Math.min(dirtyLineStart, y);
        dirtyLineEnd = Math.max(dirtyLineEnd, y);
        continue;
      }
      if (upToDateLines.has(y)) {
        continue;
      }
      dirtyLineStart = Math.min(dirtyLineStart, y);
      dirtyLineEnd = Math.max(dirtyLineEnd, y);
      lineData = viewportData.getViewLineRenderingData(y);
      tabXOffset = 0;
      contentSegmenter = createContentSegmenter(lineData, viewLineOptions);
      charWidth = viewLineOptions.spaceWidth * dpr;
      absoluteOffsetX = 0;
      tokens = lineData.tokens;
      tokenStartIndex = lineData.minColumn - 1;
      tokenEndIndex = 0;
      for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
        tokenEndIndex = tokens.getEndOffset(tokenIndex);
        if (tokenEndIndex <= tokenStartIndex) {
          continue;
        }
        tokenMetadata = tokens.getMetadata(tokenIndex);
        for (x = tokenStartIndex; x < tokenEndIndex; x++) {
          if (x > _FullFileRenderStrategy.maxSupportedColumns) {
            break;
          }
          segment = contentSegmenter.getSegmentAtIndex(x);
          if (segment === void 0) {
            continue;
          }
          chars = segment;
          if (!(lineData.isBasicASCII && viewLineOptions.useMonospaceOptimizations)) {
            charWidth = this.glyphRasterizer.getTextMetrics(chars).width;
          }
          decorationStyleSetColor = void 0;
          decorationStyleSetBold = void 0;
          decorationStyleSetOpacity = void 0;
          for (decoration of lineData.inlineDecorations) {
            if (y < decoration.range.startLineNumber || y > decoration.range.endLineNumber || y === decoration.range.startLineNumber && x < decoration.range.startColumn - 1 || y === decoration.range.endLineNumber && x >= decoration.range.endColumn - 1) {
              continue;
            }
            const rules = ViewGpuContext.decorationCssRuleExtractor.getStyleRules(this._viewGpuContext.canvas.domNode, decoration.inlineClassName);
            for (const rule of rules) {
              for (const r of rule.style) {
                const value = rule.styleMap.get(r)?.toString() ?? "";
                switch (r) {
                  case "color": {
                    const parsedColor = Color.Format.CSS.parse(value);
                    if (!parsedColor) {
                      throw new BugIndicatingError("Invalid color format " + value);
                    }
                    decorationStyleSetColor = parsedColor.toNumber32Bit();
                    break;
                  }
                  case "font-weight": {
                    const parsedValue = parseCssFontWeight(value);
                    if (parsedValue >= 400) {
                      decorationStyleSetBold = true;
                    } else {
                      decorationStyleSetBold = false;
                    }
                    break;
                  }
                  case "opacity": {
                    const parsedValue = parseCssOpacity(value);
                    decorationStyleSetOpacity = parsedValue;
                    break;
                  }
                  default:
                    throw new BugIndicatingError("Unexpected inline decoration style");
                }
              }
            }
          }
          if (chars === " " || chars === "	") {
            cellIndex = ((y - 1) * _FullFileRenderStrategy.maxSupportedColumns + x) * 6 /* IndicesPerCell */;
            cellBuffer.fill(0, cellIndex, cellIndex + 6 /* FloatsPerEntry */);
            if (chars === "	") {
              const offsetBefore = x + tabXOffset;
              tabXOffset = CursorColumns.nextRenderTabStop(x + tabXOffset, lineData.tabSize);
              absoluteOffsetX += charWidth * (tabXOffset - offsetBefore);
              tabXOffset -= x + 1;
            } else {
              absoluteOffsetX += charWidth;
            }
            continue;
          }
          const decorationStyleSetId = ViewGpuContext.decorationStyleCache.getOrCreateEntry(decorationStyleSetColor, decorationStyleSetBold, decorationStyleSetOpacity);
          glyph = this._viewGpuContext.atlas.getGlyph(this.glyphRasterizer, chars, tokenMetadata, decorationStyleSetId, absoluteOffsetX);
          absoluteOffsetY = Math.round(
            // Top of layout box (includes line height)
            viewportData.relativeVerticalOffset[y - viewportData.startLineNumber] * dpr + // Delta from top of layout box (includes line height) to top of the inline box (no line height)
            Math.floor((viewportData.lineHeight * dpr - (glyph.fontBoundingBoxAscent + glyph.fontBoundingBoxDescent)) / 2) + // Delta from top of inline box (no line height) to top of glyph origin. If the glyph was drawn
            // with a top baseline for example, this ends up drawing the glyph correctly using the alphabetical
            // baseline.
            glyph.fontBoundingBoxAscent
          );
          cellIndex = ((y - 1) * _FullFileRenderStrategy.maxSupportedColumns + x) * 6 /* IndicesPerCell */;
          cellBuffer[cellIndex + 0 /* Offset_X */] = Math.floor(absoluteOffsetX);
          cellBuffer[cellIndex + 1 /* Offset_Y */] = absoluteOffsetY;
          cellBuffer[cellIndex + 4 /* GlyphIndex */] = glyph.glyphIndex;
          cellBuffer[cellIndex + 5 /* TextureIndex */] = glyph.pageIndex;
          absoluteOffsetX += charWidth;
        }
        tokenStartIndex = tokenEndIndex;
      }
      fillStartIndex = ((y - 1) * _FullFileRenderStrategy.maxSupportedColumns + tokenEndIndex) * 6 /* IndicesPerCell */;
      fillEndIndex = y * _FullFileRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
      cellBuffer.fill(0, fillStartIndex, fillEndIndex);
      upToDateLines.add(y);
    }
    const visibleObjectCount = (viewportData.endLineNumber - viewportData.startLineNumber + 1) * lineIndexCount;
    dirtyLineStart = Math.min(dirtyLineStart, _FullFileRenderStrategy.maxSupportedLines);
    dirtyLineEnd = Math.min(dirtyLineEnd, _FullFileRenderStrategy.maxSupportedLines);
    if (dirtyLineStart <= dirtyLineEnd) {
      this._device.queue.writeBuffer(
        this._cellBindBuffer,
        (dirtyLineStart - 1) * lineIndexCount * Float32Array.BYTES_PER_ELEMENT,
        cellBuffer.buffer,
        (dirtyLineStart - 1) * lineIndexCount * Float32Array.BYTES_PER_ELEMENT,
        (dirtyLineEnd - dirtyLineStart + 1) * lineIndexCount * Float32Array.BYTES_PER_ELEMENT
      );
    }
    this._finalRenderedLine = Math.max(this._finalRenderedLine, dirtyLineEnd);
    this._activeDoubleBufferIndex = this._activeDoubleBufferIndex ? 0 : 1;
    this._visibleObjectCount = visibleObjectCount;
    return visibleObjectCount;
  }
  draw(pass, viewportData) {
    if (this._visibleObjectCount <= 0) {
      throw new BugIndicatingError("Attempt to draw 0 objects");
    }
    pass.draw(
      quadVertices.length / 2,
      this._visibleObjectCount,
      void 0,
      (viewportData.startLineNumber - 1) * _FullFileRenderStrategy.maxSupportedColumns
    );
  }
  /**
   * Queue updates that need to happen on the active buffer, not just the cache. This will be
   * deferred to when the actual cell buffer is changed since the active buffer could be locked by
   * the GPU which would block the main thread.
   */
  _queueBufferUpdate(e) {
    this._queuedBufferUpdates[0].push(e);
    this._queuedBufferUpdates[1].push(e);
  }
};
/**
 * The hard cap for line count that can be rendered by the GPU renderer.
 */
_FullFileRenderStrategy.maxSupportedLines = 3e3;
/**
 * The hard cap for line columns that can be rendered by the GPU renderer.
 */
_FullFileRenderStrategy.maxSupportedColumns = 200;
let FullFileRenderStrategy = _FullFileRenderStrategy;
function parseCssFontWeight(value) {
  switch (value) {
    case "lighter":
    case "normal":
      return 400;
    case "bolder":
    case "bold":
      return 700;
  }
  return parseInt(value);
}
function parseCssOpacity(value) {
  if (value.endsWith("%")) {
    return parseFloat(value.substring(0, value.length - 1)) / 100;
  }
  if (value.match(/^\d+(?:\.\d*)/)) {
    return parseFloat(value);
  }
  return 1;
}
export {
  FullFileRenderStrategy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvcmVuZGVyU3RyYXRlZ3kvZnVsbEZpbGVSZW5kZXJTdHJhdGVneS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sdW1ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2N1cnNvckNvbHVtbnMuanMnO1xuaW1wb3J0IHR5cGUgeyBJVmlld0xpbmVUb2tlbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgVmlld0V2ZW50VHlwZSwgdHlwZSBWaWV3Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCwgdHlwZSBWaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQsIHR5cGUgVmlld0xpbmVNYXBwaW5nQ2hhbmdlZEV2ZW50LCB0eXBlIFZpZXdMaW5lc0NoYW5nZWRFdmVudCwgdHlwZSBWaWV3TGluZXNEZWxldGVkRXZlbnQsIHR5cGUgVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCwgdHlwZSBWaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50LCB0eXBlIFZpZXdUaGVtZUNoYW5nZWRFdmVudCwgdHlwZSBWaWV3VG9rZW5zQ2hhbmdlZEV2ZW50LCB0eXBlIFZpZXdab25lc0NoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3RXZlbnRzLmpzJztcbmltcG9ydCB0eXBlIHsgVmlld3BvcnREYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVzVmlld3BvcnREYXRhLmpzJztcbmltcG9ydCB0eXBlIHsgSW5saW5lRGVjb3JhdGlvbiwgVmlld0xpbmVSZW5kZXJpbmdEYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdMaW5lT3B0aW9ucyB9IGZyb20gJy4uLy4uL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmVPcHRpb25zLmpzJztcbmltcG9ydCB0eXBlIHsgSVRleHR1cmVBdGxhc1BhZ2VHbHlwaCB9IGZyb20gJy4uL2F0bGFzL2F0bGFzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUNvbnRlbnRTZWdtZW50ZXIsIHR5cGUgSUNvbnRlbnRTZWdtZW50ZXIgfSBmcm9tICcuLi9jb250ZW50U2VnbWVudGVyLmpzJztcbmltcG9ydCB7IGZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3lXZ3NsIH0gZnJvbSAnLi9mdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lndnc2wuanMnO1xuaW1wb3J0IHsgQmluZGluZ0lkIH0gZnJvbSAnLi4vZ3B1LmpzJztcbmltcG9ydCB7IEdQVUxpZmVjeWNsZSB9IGZyb20gJy4uL2dwdURpc3Bvc2FibGUuanMnO1xuaW1wb3J0IHsgcXVhZFZlcnRpY2VzIH0gZnJvbSAnLi4vZ3B1VXRpbHMuanMnO1xuaW1wb3J0IHsgR2x5cGhSYXN0ZXJpemVyIH0gZnJvbSAnLi4vcmFzdGVyL2dseXBoUmFzdGVyaXplci5qcyc7XG5pbXBvcnQgeyBWaWV3R3B1Q29udGV4dCB9IGZyb20gJy4uL3ZpZXdHcHVDb250ZXh0LmpzJztcbmltcG9ydCB7IEJhc2VSZW5kZXJTdHJhdGVneSB9IGZyb20gJy4vYmFzZVJlbmRlclN0cmF0ZWd5LmpzJztcblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHRJbmRpY2VzUGVyQ2VsbCA9IDYsXG59XG5cbmNvbnN0IGVudW0gQ2VsbEJ1ZmZlckluZm8ge1xuXHRGbG9hdHNQZXJFbnRyeSA9IDYsXG5cdEJ5dGVzUGVyRW50cnkgPSBDZWxsQnVmZmVySW5mby5GbG9hdHNQZXJFbnRyeSAqIDQsXG5cdE9mZnNldF9YID0gMCxcblx0T2Zmc2V0X1kgPSAxLFxuXHRPZmZzZXRfVW51c2VkMSA9IDIsXG5cdE9mZnNldF9VbnVzZWQyID0gMyxcblx0R2x5cGhJbmRleCA9IDQsXG5cdFRleHR1cmVJbmRleCA9IDUsXG59XG5cbnR5cGUgUXVldWVkQnVmZmVyRXZlbnQgPSAoXG5cdFZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50IHxcblx0Vmlld0xpbmVNYXBwaW5nQ2hhbmdlZEV2ZW50IHxcblx0Vmlld0xpbmVzRGVsZXRlZEV2ZW50IHxcblx0Vmlld1pvbmVzQ2hhbmdlZEV2ZW50XG4pO1xuXG4vKipcbiAqIEEgcmVuZGVyIHN0cmF0ZWd5IHRoYXQgdHJhY2tzIGEgbGFyZ2UgYnVmZmVyLCB1cGxvYWRpbmcgb25seSBkaXJ0eSBsaW5lcyBhcyB0aGV5IGNoYW5nZSBhbmRcbiAqIGxldmVyYWdpbmcgaGVhdnkgY2FjaGluZy4gVGhpcyBpcyB0aGUgbW9zdCBwZXJmb3JtYW50IHN0cmF0ZWd5IGJ1dCBoYXMgbGltaXRhdGlvbnMgYXJvdW5kIGxvbmdcbiAqIGxpbmVzIGFuZCB0b28gbWFueSBsaW5lcy5cbiAqL1xuZXhwb3J0IGNsYXNzIEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kgZXh0ZW5kcyBCYXNlUmVuZGVyU3RyYXRlZ3kge1xuXG5cdC8qKlxuXHQgKiBUaGUgaGFyZCBjYXAgZm9yIGxpbmUgY291bnQgdGhhdCBjYW4gYmUgcmVuZGVyZWQgYnkgdGhlIEdQVSByZW5kZXJlci5cblx0ICovXG5cdHN0YXRpYyByZWFkb25seSBtYXhTdXBwb3J0ZWRMaW5lcyA9IDMwMDA7XG5cblx0LyoqXG5cdCAqIFRoZSBoYXJkIGNhcCBmb3IgbGluZSBjb2x1bW5zIHRoYXQgY2FuIGJlIHJlbmRlcmVkIGJ5IHRoZSBHUFUgcmVuZGVyZXIuXG5cdCAqL1xuXHRzdGF0aWMgcmVhZG9ubHkgbWF4U3VwcG9ydGVkQ29sdW1ucyA9IDIwMDtcblxuXHRyZWFkb25seSB0eXBlID0gJ2Z1bGxmaWxlJztcblx0cmVhZG9ubHkgd2dzbDogc3RyaW5nID0gZnVsbEZpbGVSZW5kZXJTdHJhdGVneVdnc2w7XG5cblx0cHJpdmF0ZSBfY2VsbEJpbmRCdWZmZXIhOiBHUFVCdWZmZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBjZWxsIHZhbHVlIGJ1ZmZlcnMsIHRoZXNlIGhvbGQgdGhlIGNlbGxzIGFuZCB0aGVpciBnbHlwaHMuIEl0J3MgZG91YmxlIGJ1ZmZlcnMgc3VjaCB0aGF0XG5cdCAqIHRoZSB0aHJlYWQgZG9lc24ndCBibG9jayB3aGVuIG9uZSBpcyBiZWluZyB1cGxvYWRlZCB0byB0aGUgR1BVLlxuXHQgKi9cblx0cHJpdmF0ZSBfY2VsbFZhbHVlQnVmZmVycyE6IFtBcnJheUJ1ZmZlciwgQXJyYXlCdWZmZXJdO1xuXHRwcml2YXRlIF9hY3RpdmVEb3VibGVCdWZmZXJJbmRleDogMCB8IDEgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwVG9EYXRlTGluZXM6IFtTZXQ8bnVtYmVyPiwgU2V0PG51bWJlcj5dID0gW25ldyBTZXQoKSwgbmV3IFNldCgpXTtcblx0cHJpdmF0ZSBfdmlzaWJsZU9iamVjdENvdW50OiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9maW5hbFJlbmRlcmVkTGluZTogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIF9zY3JvbGxPZmZzZXRCaW5kQnVmZmVyOiBHUFVCdWZmZXI7XG5cdHByaXZhdGUgX3Njcm9sbE9mZnNldFZhbHVlQnVmZmVyOiBGbG9hdDMyQXJyYXk7XG5cdHByaXZhdGUgX3Njcm9sbEluaXRpYWxpemVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcXVldWVkQnVmZmVyVXBkYXRlczogW1F1ZXVlZEJ1ZmZlckV2ZW50W10sIFF1ZXVlZEJ1ZmZlckV2ZW50W11dID0gW1tdLCBbXV07XG5cblx0Z2V0IGJpbmRHcm91cEVudHJpZXMoKTogR1BVQmluZEdyb3VwRW50cnlbXSB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdHsgYmluZGluZzogQmluZGluZ0lkLkNlbGxzLCByZXNvdXJjZTogeyBidWZmZXI6IHRoaXMuX2NlbGxCaW5kQnVmZmVyIH0gfSxcblx0XHRcdHsgYmluZGluZzogQmluZGluZ0lkLlNjcm9sbE9mZnNldCwgcmVzb3VyY2U6IHsgYnVmZmVyOiB0aGlzLl9zY3JvbGxPZmZzZXRCaW5kQnVmZmVyIH0gfVxuXHRcdF07XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250ZXh0OiBWaWV3Q29udGV4dCxcblx0XHR2aWV3R3B1Q29udGV4dDogVmlld0dwdUNvbnRleHQsXG5cdFx0ZGV2aWNlOiBHUFVEZXZpY2UsXG5cdFx0Z2x5cGhSYXN0ZXJpemVyOiB7IHZhbHVlOiBHbHlwaFJhc3Rlcml6ZXIgfSxcblx0KSB7XG5cdFx0c3VwZXIoY29udGV4dCwgdmlld0dwdUNvbnRleHQsIGRldmljZSwgZ2x5cGhSYXN0ZXJpemVyKTtcblxuXHRcdGNvbnN0IGJ1ZmZlclNpemUgPSBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZExpbmVzICogRnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UO1xuXHRcdHRoaXMuX2NlbGxCaW5kQnVmZmVyID0gdGhpcy5fcmVnaXN0ZXIoR1BVTGlmZWN5Y2xlLmNyZWF0ZUJ1ZmZlcih0aGlzLl9kZXZpY2UsIHtcblx0XHRcdGxhYmVsOiAnTW9uYWNvIGZ1bGwgZmlsZSBjZWxsIGJ1ZmZlcicsXG5cdFx0XHRzaXplOiBidWZmZXJTaXplLFxuXHRcdFx0dXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlNUT1JBR0UgfCBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcblx0XHR9KSkub2JqZWN0O1xuXHRcdHRoaXMuX2NlbGxWYWx1ZUJ1ZmZlcnMgPSBbXG5cdFx0XHRuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSksXG5cdFx0XHRuZXcgQXJyYXlCdWZmZXIoYnVmZmVyU2l6ZSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IHNjcm9sbE9mZnNldEJ1ZmZlclNpemUgPSAyO1xuXHRcdHRoaXMuX3Njcm9sbE9mZnNldEJpbmRCdWZmZXIgPSB0aGlzLl9yZWdpc3RlcihHUFVMaWZlY3ljbGUuY3JlYXRlQnVmZmVyKHRoaXMuX2RldmljZSwge1xuXHRcdFx0bGFiZWw6ICdNb25hY28gc2Nyb2xsIG9mZnNldCBidWZmZXInLFxuXHRcdFx0c2l6ZTogc2Nyb2xsT2Zmc2V0QnVmZmVyU2l6ZSAqIEZsb2F0MzJBcnJheS5CWVRFU19QRVJfRUxFTUVOVCxcblx0XHRcdHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG5cdFx0fSkpLm9iamVjdDtcblx0XHR0aGlzLl9zY3JvbGxPZmZzZXRWYWx1ZUJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkoc2Nyb2xsT2Zmc2V0QnVmZmVyU2l6ZSk7XG5cdH1cblxuXHQvLyAjcmVnaW9uIEV2ZW50IGhhbmRsZXJzXG5cblx0Ly8gVGhlIHByaW1hcnkgam9iIG9mIHRoZXNlIGhhbmRsZXJzIGlzIHRvOlxuXHQvLyAxLiBJbnZhbGlkYXRlIHRoZSB1cCB0byBkYXRlIGxpbmUgY2FjaGUsIHdoaWNoIHdpbGwgY2F1c2UgdGhlIGxpbmUgdG8gYmUgcmUtcmVuZGVyZWQgd2hlblxuXHQvLyAgICBpdCdzIF93aXRoaW4gdGhlIHZpZXdwb3J0Xy5cblx0Ly8gMi4gUGFzcyByZWxldmFudCBldmVudHMgb24gdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBzbyBpdCBjYW4gZm9yY2UgY2VydGFpbiBsaW5lIHJhbmdlcyB0byBiZVxuXHQvLyAgICByZS1yZW5kZXJlZCBldmVuIGlmIHRoZXkncmUgbm90IGluIHRoZSB2aWV3cG9ydC4gRm9yIGV4YW1wbGUgd2hlbiBhIHZpZXcgem9uZSBpcyBhZGRlZCxcblx0Ly8gICAgdGhlcmUgYXJlIGxpbmVzIHRoYXQgdXNlZCB0byBiZSB2aXNpYmxlIGJ1dCBhcmUgbm8gbG9uZ2VyLCBzbyB0aG9zZSByYW5nZXMgbXVzdCBiZVxuXHQvLyAgICBjbGVhcmVkIGFuZCB1cGxvYWRlZCB0byB0aGUgR1BVLlxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IFZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5faW52YWxpZGF0ZUFsbExpbmVzKCk7XG5cdFx0dGhpcy5fcXVldWVCdWZmZXJVcGRhdGUoZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25EZWNvcmF0aW9uc0NoYW5nZWQoZTogVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5faW52YWxpZGF0ZUFsbExpbmVzKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25Ub2tlbnNDaGFuZ2VkKGU6IFZpZXdUb2tlbnNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHQvLyBUT0RPOiBUaGlzIGN1cnJlbnRseSBmaXJlcyBmb3IgdGhlIGVudGlyZSB2aWV3cG9ydCB3aGVuZXZlciBzY3JvbGxpbmcgc3RvcHNcblx0XHQvLyAgICAgICBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjMzOTQyXG5cdFx0Zm9yIChjb25zdCByYW5nZSBvZiBlLnJhbmdlcykge1xuXHRcdFx0dGhpcy5faW52YWxpZGF0ZUxpbmVSYW5nZShyYW5nZS5mcm9tTGluZU51bWJlciwgcmFuZ2UudG9MaW5lTnVtYmVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0RlbGV0ZWQoZTogVmlld0xpbmVzRGVsZXRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gVE9ETzogVGhpcyBjdXJyZW50bHkgaW52YWxpZGF0ZXMgZXZlcnl0aGluZyBhZnRlciB0aGUgZGVsZXRlZCBsaW5lLCBpdCBjb3VsZCBzaGlmdCB0aGVcblx0XHQvLyAgICAgICBsaW5lIGRhdGEgdXAgdG8gcmV0YWluIHNvbWUgdXAgdG8gZGF0ZSBsaW5lc1xuXHRcdC8vIFRPRE86IFRoaXMgZG9lcyBub3QgaW52YWxpZGF0ZSBsaW5lcyB0aGF0IGFyZSBubyBsb25nZXIgaW4gdGhlIGZpbGVcblx0XHR0aGlzLl9pbnZhbGlkYXRlTGluZXNGcm9tKGUuZnJvbUxpbmVOdW1iZXIpO1xuXHRcdHRoaXMuX3F1ZXVlQnVmZmVyVXBkYXRlKGUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNJbnNlcnRlZChlOiBWaWV3TGluZXNJbnNlcnRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gVE9ETzogVGhpcyBjdXJyZW50bHkgaW52YWxpZGF0ZXMgZXZlcnl0aGluZyBhZnRlciB0aGUgZGVsZXRlZCBsaW5lLCBpdCBjb3VsZCBzaGlmdCB0aGVcblx0XHQvLyAgICAgICBsaW5lIGRhdGEgdXAgdG8gcmV0YWluIHNvbWUgdXAgdG8gZGF0ZSBsaW5lc1xuXHRcdHRoaXMuX2ludmFsaWRhdGVMaW5lc0Zyb20oZS5mcm9tTGluZU51bWJlcik7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogVmlld0xpbmVzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5faW52YWxpZGF0ZUxpbmVSYW5nZShlLmZyb21MaW5lTnVtYmVyLCBlLmZyb21MaW5lTnVtYmVyICsgZS5jb3VudCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25TY3JvbGxDaGFuZ2VkKGU/OiBWaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZHByID0gZ2V0QWN0aXZlV2luZG93KCkuZGV2aWNlUGl4ZWxSYXRpbztcblx0XHR0aGlzLl9zY3JvbGxPZmZzZXRWYWx1ZUJ1ZmZlclswXSA9IChlPy5zY3JvbGxMZWZ0ID8/IHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsTGVmdCgpKSAqIGRwcjtcblx0XHR0aGlzLl9zY3JvbGxPZmZzZXRWYWx1ZUJ1ZmZlclsxXSA9IChlPy5zY3JvbGxUb3AgPz8gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKSkgKiBkcHI7XG5cdFx0dGhpcy5fZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKHRoaXMuX3Njcm9sbE9mZnNldEJpbmRCdWZmZXIsIDAsIHRoaXMuX3Njcm9sbE9mZnNldFZhbHVlQnVmZmVyKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvblRoZW1lQ2hhbmdlZChlOiBWaWV3VGhlbWVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9pbnZhbGlkYXRlQWxsTGluZXMoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkxpbmVNYXBwaW5nQ2hhbmdlZChlOiBWaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9pbnZhbGlkYXRlQWxsTGluZXMoKTtcblx0XHR0aGlzLl9xdWV1ZUJ1ZmZlclVwZGF0ZShlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvblpvbmVzQ2hhbmdlZChlOiBWaWV3Wm9uZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9pbnZhbGlkYXRlQWxsTGluZXMoKTtcblx0XHR0aGlzLl9xdWV1ZUJ1ZmZlclVwZGF0ZShlKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgX2ludmFsaWRhdGVBbGxMaW5lcygpOiB2b2lkIHtcblx0XHR0aGlzLl91cFRvRGF0ZUxpbmVzWzBdLmNsZWFyKCk7XG5cdFx0dGhpcy5fdXBUb0RhdGVMaW5lc1sxXS5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW52YWxpZGF0ZUxpbmVzRnJvbShsaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGkgb2YgWzAsIDFdKSB7XG5cdFx0XHRjb25zdCB1cFRvRGF0ZUxpbmVzID0gdGhpcy5fdXBUb0RhdGVMaW5lc1tpXTtcblx0XHRcdGZvciAoY29uc3QgdXBUb0RhdGVMaW5lIG9mIHVwVG9EYXRlTGluZXMpIHtcblx0XHRcdFx0aWYgKHVwVG9EYXRlTGluZSA+PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0dXBUb0RhdGVMaW5lcy5kZWxldGUodXBUb0RhdGVMaW5lKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ludmFsaWRhdGVMaW5lUmFuZ2UoZnJvbUxpbmVOdW1iZXI6IG51bWJlciwgdG9MaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHRmb3IgKGxldCBpID0gZnJvbUxpbmVOdW1iZXI7IGkgPD0gdG9MaW5lTnVtYmVyOyBpKyspIHtcblx0XHRcdHRoaXMuX3VwVG9EYXRlTGluZXNbMF0uZGVsZXRlKGkpO1xuXHRcdFx0dGhpcy5fdXBUb0RhdGVMaW5lc1sxXS5kZWxldGUoaSk7XG5cdFx0fVxuXHR9XG5cblx0cmVzZXQoKSB7XG5cdFx0dGhpcy5faW52YWxpZGF0ZUFsbExpbmVzKCk7XG5cdFx0Zm9yIChjb25zdCBidWZmZXJJbmRleCBvZiBbMCwgMV0pIHtcblx0XHRcdC8vIFplcm8gb3V0IGJ1ZmZlciBhbmQgdXBsb2FkIHRvIEdQVSB0byBwcmV2ZW50IHN0YWxlIHJvd3MgZnJvbSByZW5kZXJpbmdcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fY2VsbFZhbHVlQnVmZmVyc1tidWZmZXJJbmRleF0pO1xuXHRcdFx0YnVmZmVyLmZpbGwoMCwgMCwgYnVmZmVyLmxlbmd0aCk7XG5cdFx0XHR0aGlzLl9kZXZpY2UucXVldWUud3JpdGVCdWZmZXIodGhpcy5fY2VsbEJpbmRCdWZmZXIsIDAsIGJ1ZmZlci5idWZmZXIsIDAsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcblx0XHR9XG5cdFx0dGhpcy5fZmluYWxSZW5kZXJlZExpbmUgPSAwO1xuXHR9XG5cblx0dXBkYXRlKHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhLCB2aWV3TGluZU9wdGlvbnM6IFZpZXdMaW5lT3B0aW9ucyk6IG51bWJlciB7XG5cdFx0Ly8gSU1QT1JUQU5UOiBUaGlzIGlzIGEgaG90IGZ1bmN0aW9uLiBWYXJpYWJsZXMgYXJlIHByZS1hbGxvY2F0ZWQgYW5kIHNoYXJlZCB3aXRoaW4gdGhlXG5cdFx0Ly8gbG9vcC4gVGhpcyBpcyBkb25lIHNvIHdlIGRvbid0IG5lZWQgdG8gdHJ1c3QgdGhlIEpJVCBjb21waWxlciB0byBkbyB0aGlzIG9wdGltaXphdGlvbiB0b1xuXHRcdC8vIGF2b2lkIHBvdGVudGlhbCBhZGRpdGlvbmFsIGJsb2NraW5nIHRpbWUgaW4gZ2FyYmFnZSBjb2xsZWN0b3Igd2hpY2ggaXMgYSBjb21tb24gY2F1c2Ugb2Zcblx0XHQvLyBkcm9wcGVkIGZyYW1lcy5cblxuXHRcdGxldCBjaGFycyA9ICcnO1xuXHRcdGxldCBzZWdtZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGNoYXJXaWR0aCA9IDA7XG5cdFx0bGV0IHkgPSAwO1xuXHRcdGxldCB4ID0gMDtcblx0XHRsZXQgYWJzb2x1dGVPZmZzZXRYID0gMDtcblx0XHRsZXQgYWJzb2x1dGVPZmZzZXRZID0gMDtcblx0XHRsZXQgdGFiWE9mZnNldCA9IDA7XG5cdFx0bGV0IGdseXBoOiBSZWFkb25seTxJVGV4dHVyZUF0bGFzUGFnZUdseXBoPjtcblx0XHRsZXQgY2VsbEluZGV4ID0gMDtcblxuXHRcdGxldCB0b2tlblN0YXJ0SW5kZXggPSAwO1xuXHRcdGxldCB0b2tlbkVuZEluZGV4ID0gMDtcblx0XHRsZXQgdG9rZW5NZXRhZGF0YSA9IDA7XG5cblx0XHRsZXQgZGVjb3JhdGlvblN0eWxlU2V0Qm9sZDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZGVjb3JhdGlvblN0eWxlU2V0Q29sb3I6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZGVjb3JhdGlvblN0eWxlU2V0T3BhY2l0eTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0bGV0IGxpbmVEYXRhOiBWaWV3TGluZVJlbmRlcmluZ0RhdGE7XG5cdFx0bGV0IGRlY29yYXRpb246IElubGluZURlY29yYXRpb247XG5cdFx0bGV0IGZpbGxTdGFydEluZGV4ID0gMDtcblx0XHRsZXQgZmlsbEVuZEluZGV4ID0gMDtcblxuXHRcdGxldCB0b2tlbnM6IElWaWV3TGluZVRva2VucztcblxuXHRcdGNvbnN0IGRwciA9IGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW87XG5cdFx0bGV0IGNvbnRlbnRTZWdtZW50ZXI6IElDb250ZW50U2VnbWVudGVyO1xuXG5cdFx0aWYgKCF0aGlzLl9zY3JvbGxJbml0aWFsaXplZCkge1xuXHRcdFx0dGhpcy5vblNjcm9sbENoYW5nZWQoKTtcblx0XHRcdHRoaXMuX3Njcm9sbEluaXRpYWxpemVkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgY2VsbCBkYXRhXG5cdFx0Y29uc3QgY2VsbEJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fY2VsbFZhbHVlQnVmZmVyc1t0aGlzLl9hY3RpdmVEb3VibGVCdWZmZXJJbmRleF0pO1xuXHRcdGNvbnN0IGxpbmVJbmRleENvdW50ID0gRnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXG5cdFx0Y29uc3QgdXBUb0RhdGVMaW5lcyA9IHRoaXMuX3VwVG9EYXRlTGluZXNbdGhpcy5fYWN0aXZlRG91YmxlQnVmZmVySW5kZXhdO1xuXHRcdGxldCBkaXJ0eUxpbmVTdGFydCA9IDMwMDA7XG5cdFx0bGV0IGRpcnR5TGluZUVuZCA9IDA7XG5cblx0XHQvLyBIYW5kbGUgYW55IHF1ZXVlZCBidWZmZXIgdXBkYXRlc1xuXHRcdGNvbnN0IHF1ZXVlZEJ1ZmZlclVwZGF0ZXMgPSB0aGlzLl9xdWV1ZWRCdWZmZXJVcGRhdGVzW3RoaXMuX2FjdGl2ZURvdWJsZUJ1ZmZlckluZGV4XTtcblx0XHR3aGlsZSAocXVldWVkQnVmZmVyVXBkYXRlcy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGUgPSBxdWV1ZWRCdWZmZXJVcGRhdGVzLnNoaWZ0KCkhO1xuXHRcdFx0c3dpdGNoIChlLnR5cGUpIHtcblx0XHRcdFx0Ly8gVE9ETzogUmVmaW5lIHRoZXNlIGNhc2VzIHNvIHdlJ3JlIG5vdCB0aHJvd2luZyBhd2F5IGV2ZXJ5dGhpbmdcblx0XHRcdFx0Y2FzZSBWaWV3RXZlbnRUeXBlLlZpZXdDb25maWd1cmF0aW9uQ2hhbmdlZDpcblx0XHRcdFx0Y2FzZSBWaWV3RXZlbnRUeXBlLlZpZXdMaW5lTWFwcGluZ0NoYW5nZWQ6XG5cdFx0XHRcdGNhc2UgVmlld0V2ZW50VHlwZS5WaWV3Wm9uZXNDaGFuZ2VkOiB7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlci5maWxsKDApO1xuXG5cdFx0XHRcdFx0ZGlydHlMaW5lU3RhcnQgPSAxO1xuXHRcdFx0XHRcdGRpcnR5TGluZUVuZCA9IE1hdGgubWF4KGRpcnR5TGluZUVuZCwgdGhpcy5fZmluYWxSZW5kZXJlZExpbmUpO1xuXHRcdFx0XHRcdHRoaXMuX2ZpbmFsUmVuZGVyZWRMaW5lID0gMDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIFZpZXdFdmVudFR5cGUuVmlld0xpbmVzRGVsZXRlZDoge1xuXHRcdFx0XHRcdC8vIFNoaWZ0IGNvbnRlbnQgYmVsb3cgZGVsZXRlZCBsaW5lIHVwXG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlZExpbmVDb250ZW50U3RhcnRJbmRleCA9IChlLmZyb21MaW5lTnVtYmVyIC0gMSkgKiBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZXRlZExpbmVDb250ZW50RW5kSW5kZXggPSAoZS50b0xpbmVOdW1iZXIpICogRnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0XHRcdGNvbnN0IG51bGxDb250ZW50U3RhcnRJbmRleCA9ICh0aGlzLl9maW5hbFJlbmRlcmVkTGluZSAtIChlLnRvTGluZU51bWJlciAtIGUuZnJvbUxpbmVOdW1iZXIgKyAxKSkgKiBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlci5zZXQoY2VsbEJ1ZmZlci5zdWJhcnJheShkZWxldGVkTGluZUNvbnRlbnRFbmRJbmRleCksIGRlbGV0ZWRMaW5lQ29udGVudFN0YXJ0SW5kZXgpO1xuXG5cdFx0XHRcdFx0Ly8gWmVybyBvdXQgY29udGVudCBvbiBsaW5lcyB0aGF0IGFyZSBubyBsb25nZXIgdmFsaWRcblx0XHRcdFx0XHRjZWxsQnVmZmVyLmZpbGwoMCwgbnVsbENvbnRlbnRTdGFydEluZGV4KTtcblxuXHRcdFx0XHRcdC8vIFVwZGF0ZSBkaXJ0eSBsaW5lcyBhbmQgZmluYWwgcmVuZGVyZWQgbGluZVxuXHRcdFx0XHRcdGRpcnR5TGluZVN0YXJ0ID0gTWF0aC5taW4oZGlydHlMaW5lU3RhcnQsIGUuZnJvbUxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGRpcnR5TGluZUVuZCA9IE1hdGgubWF4KGRpcnR5TGluZUVuZCwgdGhpcy5fZmluYWxSZW5kZXJlZExpbmUpO1xuXHRcdFx0XHRcdHRoaXMuX2ZpbmFsUmVuZGVyZWRMaW5lIC09IGUudG9MaW5lTnVtYmVyIC0gZS5mcm9tTGluZU51bWJlciArIDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKHkgPSB2aWV3cG9ydERhdGEuc3RhcnRMaW5lTnVtYmVyOyB5IDw9IHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyOyB5KyspIHtcblxuXHRcdFx0Ly8gT25seSBhdHRlbXB0IHRvIHJlbmRlciBsaW5lcyB0aGF0IHRoZSBHUFUgcmVuZGVyZXIgY2FuIGhhbmRsZVxuXHRcdFx0aWYgKCF0aGlzLl92aWV3R3B1Q29udGV4dC5jYW5SZW5kZXIodmlld0xpbmVPcHRpb25zLCB2aWV3cG9ydERhdGEsIHkpKSB7XG5cdFx0XHRcdGZpbGxTdGFydEluZGV4ID0gKCh5IC0gMSkgKiBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMpICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0XHRmaWxsRW5kSW5kZXggPSAoeSAqIEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucykgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRcdGNlbGxCdWZmZXIuZmlsbCgwLCBmaWxsU3RhcnRJbmRleCwgZmlsbEVuZEluZGV4KTtcblxuXHRcdFx0XHRkaXJ0eUxpbmVTdGFydCA9IE1hdGgubWluKGRpcnR5TGluZVN0YXJ0LCB5KTtcblx0XHRcdFx0ZGlydHlMaW5lRW5kID0gTWF0aC5tYXgoZGlydHlMaW5lRW5kLCB5KTtcblxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2tpcCB1cGRhdGluZyB0aGUgbGluZSBpZiBpdCdzIGFscmVhZHkgdXAgdG8gZGF0ZVxuXHRcdFx0aWYgKHVwVG9EYXRlTGluZXMuaGFzKHkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRkaXJ0eUxpbmVTdGFydCA9IE1hdGgubWluKGRpcnR5TGluZVN0YXJ0LCB5KTtcblx0XHRcdGRpcnR5TGluZUVuZCA9IE1hdGgubWF4KGRpcnR5TGluZUVuZCwgeSk7XG5cblx0XHRcdGxpbmVEYXRhID0gdmlld3BvcnREYXRhLmdldFZpZXdMaW5lUmVuZGVyaW5nRGF0YSh5KTtcblx0XHRcdHRhYlhPZmZzZXQgPSAwO1xuXG5cdFx0XHRjb250ZW50U2VnbWVudGVyID0gY3JlYXRlQ29udGVudFNlZ21lbnRlcihsaW5lRGF0YSwgdmlld0xpbmVPcHRpb25zKTtcblx0XHRcdGNoYXJXaWR0aCA9IHZpZXdMaW5lT3B0aW9ucy5zcGFjZVdpZHRoICogZHByO1xuXHRcdFx0YWJzb2x1dGVPZmZzZXRYID0gMDtcblxuXHRcdFx0dG9rZW5zID0gbGluZURhdGEudG9rZW5zO1xuXHRcdFx0dG9rZW5TdGFydEluZGV4ID0gbGluZURhdGEubWluQ29sdW1uIC0gMTtcblx0XHRcdHRva2VuRW5kSW5kZXggPSAwO1xuXHRcdFx0Zm9yIChsZXQgdG9rZW5JbmRleCA9IDAsIHRva2Vuc0xlbiA9IHRva2Vucy5nZXRDb3VudCgpOyB0b2tlbkluZGV4IDwgdG9rZW5zTGVuOyB0b2tlbkluZGV4KyspIHtcblx0XHRcdFx0dG9rZW5FbmRJbmRleCA9IHRva2Vucy5nZXRFbmRPZmZzZXQodG9rZW5JbmRleCk7XG5cdFx0XHRcdGlmICh0b2tlbkVuZEluZGV4IDw9IHRva2VuU3RhcnRJbmRleCkge1xuXHRcdFx0XHRcdC8vIFRoZSBmYXV4IGluZGVudCBwYXJ0IG9mIHRoZSBsaW5lIHNob3VsZCBoYXZlIG5vIHRva2VuIHR5cGVcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRva2VuTWV0YWRhdGEgPSB0b2tlbnMuZ2V0TWV0YWRhdGEodG9rZW5JbmRleCk7XG5cblx0XHRcdFx0Zm9yICh4ID0gdG9rZW5TdGFydEluZGV4OyB4IDwgdG9rZW5FbmRJbmRleDsgeCsrKSB7XG5cdFx0XHRcdFx0Ly8gT25seSByZW5kZXIgbGluZXMgdGhhdCBkbyBub3QgZXhjZWVkIG1heGltdW0gY29sdW1uc1xuXHRcdFx0XHRcdGlmICh4ID4gRnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2VnbWVudCA9IGNvbnRlbnRTZWdtZW50ZXIuZ2V0U2VnbWVudEF0SW5kZXgoeCk7XG5cdFx0XHRcdFx0aWYgKHNlZ21lbnQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNoYXJzID0gc2VnbWVudDtcblxuXHRcdFx0XHRcdGlmICghKGxpbmVEYXRhLmlzQmFzaWNBU0NJSSAmJiB2aWV3TGluZU9wdGlvbnMudXNlTW9ub3NwYWNlT3B0aW1pemF0aW9ucykpIHtcblx0XHRcdFx0XHRcdGNoYXJXaWR0aCA9IHRoaXMuZ2x5cGhSYXN0ZXJpemVyLmdldFRleHRNZXRyaWNzKGNoYXJzKS53aWR0aDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRkZWNvcmF0aW9uU3R5bGVTZXRDb2xvciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRkZWNvcmF0aW9uU3R5bGVTZXRCb2xkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldE9wYWNpdHkgPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0XHQvLyBBcHBseSBzdXBwb3J0ZWQgaW5saW5lIGRlY29yYXRpb24gc3R5bGVzIHRvIHRoZSBjZWxsIG1ldGFkYXRhXG5cdFx0XHRcdFx0Zm9yIChkZWNvcmF0aW9uIG9mIGxpbmVEYXRhLmlubGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIFJhbmdlLnN0cmljdENvbnRhaW5zUG9zaXRpb24gZXhjZXB0IGl0IHdvcmtzIGF0IHRoZSBjZWxsIGxldmVsLFxuXHRcdFx0XHRcdFx0Ly8gaXQncyBhbHNvIGlubGluZWQgdG8gYXZvaWQgb3ZlcmhlYWQuXG5cdFx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRcdCh5IDwgZGVjb3JhdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIgfHwgeSA+IGRlY29yYXRpb24ucmFuZ2UuZW5kTGluZU51bWJlcikgfHxcblx0XHRcdFx0XHRcdFx0KHkgPT09IGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICYmIHggPCBkZWNvcmF0aW9uLnJhbmdlLnN0YXJ0Q29sdW1uIC0gMSkgfHxcblx0XHRcdFx0XHRcdFx0KHkgPT09IGRlY29yYXRpb24ucmFuZ2UuZW5kTGluZU51bWJlciAmJiB4ID49IGRlY29yYXRpb24ucmFuZ2UuZW5kQ29sdW1uIC0gMSlcblx0XHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgcnVsZXMgPSBWaWV3R3B1Q29udGV4dC5kZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3Rvci5nZXRTdHlsZVJ1bGVzKHRoaXMuX3ZpZXdHcHVDb250ZXh0LmNhbnZhcy5kb21Ob2RlLCBkZWNvcmF0aW9uLmlubGluZUNsYXNzTmFtZSk7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHJ1bGUgb2YgcnVsZXMpIHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCByIG9mIHJ1bGUuc3R5bGUpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJ1bGUuc3R5bGVNYXAuZ2V0KHIpPy50b1N0cmluZygpID8/ICcnO1xuXHRcdFx0XHRcdFx0XHRcdHN3aXRjaCAocikge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y2FzZSAnY29sb3InOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFRPRE86IFRoaXMgcGFyc2luZyBhbmQgZXJyb3IgaGFuZGxpbmcgc2hvdWxkIG1vdmUgaW50byBjYW5SZW5kZXIgc28gZmFsbGJhY2tcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gICAgICAgdG8gRE9NIHdvcmtzXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZENvbG9yID0gQ29sb3IuRm9ybWF0LkNTUy5wYXJzZSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICghcGFyc2VkQ29sb3IpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdJbnZhbGlkIGNvbG9yIGZvcm1hdCAnICsgdmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldENvbG9yID0gcGFyc2VkQ29sb3IudG9OdW1iZXIzMkJpdCgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2ZvbnQtd2VpZ2h0Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBwYXJzZWRWYWx1ZSA9IHBhcnNlQ3NzRm9udFdlaWdodCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmIChwYXJzZWRWYWx1ZSA+PSA0MDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uU3R5bGVTZXRCb2xkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBUT0RPOiBTZXQgYm9sZCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzNzU4NClcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uU3R5bGVTZXRCb2xkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogU2V0IG5vcm1hbCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzNzU4NClcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGNhc2UgJ29wYWNpdHknOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZFZhbHVlID0gcGFyc2VDc3NPcGFjaXR5KHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvblN0eWxlU2V0T3BhY2l0eSA9IHBhcnNlZFZhbHVlO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ1VuZXhwZWN0ZWQgaW5saW5lIGRlY29yYXRpb24gc3R5bGUnKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoY2hhcnMgPT09ICcgJyB8fCBjaGFycyA9PT0gJ1xcdCcpIHtcblx0XHRcdFx0XHRcdC8vIFplcm8gb3V0IGdseXBoIHRvIGVuc3VyZSBpdCBkb2Vzbid0IGdldCByZW5kZXJlZFxuXHRcdFx0XHRcdFx0Y2VsbEluZGV4ID0gKCh5IC0gMSkgKiBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMgKyB4KSAqIENvbnN0YW50cy5JbmRpY2VzUGVyQ2VsbDtcblx0XHRcdFx0XHRcdGNlbGxCdWZmZXIuZmlsbCgwLCBjZWxsSW5kZXgsIGNlbGxJbmRleCArIENlbGxCdWZmZXJJbmZvLkZsb2F0c1BlckVudHJ5KTtcblx0XHRcdFx0XHRcdC8vIEFkanVzdCB4T2Zmc2V0IGZvciB0YWIgc3RvcHNcblx0XHRcdFx0XHRcdGlmIChjaGFycyA9PT0gJ1xcdCcpIHtcblx0XHRcdFx0XHRcdFx0Ly8gRmluZCB0aGUgcGl4ZWwgb2Zmc2V0IGJldHdlZW4gdGhlIGN1cnJlbnQgcG9zaXRpb24gYW5kIHRoZSBuZXh0IHRhYiBzdG9wXG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9mZnNldEJlZm9yZSA9IHggKyB0YWJYT2Zmc2V0O1xuXHRcdFx0XHRcdFx0XHR0YWJYT2Zmc2V0ID0gQ3Vyc29yQ29sdW1ucy5uZXh0UmVuZGVyVGFiU3RvcCh4ICsgdGFiWE9mZnNldCwgbGluZURhdGEudGFiU2l6ZSk7XG5cdFx0XHRcdFx0XHRcdGFic29sdXRlT2Zmc2V0WCArPSBjaGFyV2lkdGggKiAodGFiWE9mZnNldCAtIG9mZnNldEJlZm9yZSk7XG5cdFx0XHRcdFx0XHRcdC8vIENvbnZlcnQgYmFjayB0byBvZmZzZXQgZXhjbHVkaW5nIHggYW5kIHRoZSBjdXJyZW50IGNoYXJhY3RlclxuXHRcdFx0XHRcdFx0XHR0YWJYT2Zmc2V0IC09IHggKyAxO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0YWJzb2x1dGVPZmZzZXRYICs9IGNoYXJXaWR0aDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGRlY29yYXRpb25TdHlsZVNldElkID0gVmlld0dwdUNvbnRleHQuZGVjb3JhdGlvblN0eWxlQ2FjaGUuZ2V0T3JDcmVhdGVFbnRyeShkZWNvcmF0aW9uU3R5bGVTZXRDb2xvciwgZGVjb3JhdGlvblN0eWxlU2V0Qm9sZCwgZGVjb3JhdGlvblN0eWxlU2V0T3BhY2l0eSk7XG5cdFx0XHRcdFx0Z2x5cGggPSB0aGlzLl92aWV3R3B1Q29udGV4dC5hdGxhcy5nZXRHbHlwaCh0aGlzLmdseXBoUmFzdGVyaXplciwgY2hhcnMsIHRva2VuTWV0YWRhdGEsIGRlY29yYXRpb25TdHlsZVNldElkLCBhYnNvbHV0ZU9mZnNldFgpO1xuXG5cdFx0XHRcdFx0YWJzb2x1dGVPZmZzZXRZID0gTWF0aC5yb3VuZChcblx0XHRcdFx0XHRcdC8vIFRvcCBvZiBsYXlvdXQgYm94IChpbmNsdWRlcyBsaW5lIGhlaWdodClcblx0XHRcdFx0XHRcdHZpZXdwb3J0RGF0YS5yZWxhdGl2ZVZlcnRpY2FsT2Zmc2V0W3kgLSB2aWV3cG9ydERhdGEuc3RhcnRMaW5lTnVtYmVyXSAqIGRwciArXG5cblx0XHRcdFx0XHRcdC8vIERlbHRhIGZyb20gdG9wIG9mIGxheW91dCBib3ggKGluY2x1ZGVzIGxpbmUgaGVpZ2h0KSB0byB0b3Agb2YgdGhlIGlubGluZSBib3ggKG5vIGxpbmUgaGVpZ2h0KVxuXHRcdFx0XHRcdFx0TWF0aC5mbG9vcigodmlld3BvcnREYXRhLmxpbmVIZWlnaHQgKiBkcHIgLSAoZ2x5cGguZm9udEJvdW5kaW5nQm94QXNjZW50ICsgZ2x5cGguZm9udEJvdW5kaW5nQm94RGVzY2VudCkpIC8gMikgK1xuXG5cdFx0XHRcdFx0XHQvLyBEZWx0YSBmcm9tIHRvcCBvZiBpbmxpbmUgYm94IChubyBsaW5lIGhlaWdodCkgdG8gdG9wIG9mIGdseXBoIG9yaWdpbi4gSWYgdGhlIGdseXBoIHdhcyBkcmF3blxuXHRcdFx0XHRcdFx0Ly8gd2l0aCBhIHRvcCBiYXNlbGluZSBmb3IgZXhhbXBsZSwgdGhpcyBlbmRzIHVwIGRyYXdpbmcgdGhlIGdseXBoIGNvcnJlY3RseSB1c2luZyB0aGUgYWxwaGFiZXRpY2FsXG5cdFx0XHRcdFx0XHQvLyBiYXNlbGluZS5cblx0XHRcdFx0XHRcdGdseXBoLmZvbnRCb3VuZGluZ0JveEFzY2VudFxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRjZWxsSW5kZXggPSAoKHkgLSAxKSAqIEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucyArIHgpICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0XHRcdGNlbGxCdWZmZXJbY2VsbEluZGV4ICsgQ2VsbEJ1ZmZlckluZm8uT2Zmc2V0X1hdID0gTWF0aC5mbG9vcihhYnNvbHV0ZU9mZnNldFgpO1xuXHRcdFx0XHRcdGNlbGxCdWZmZXJbY2VsbEluZGV4ICsgQ2VsbEJ1ZmZlckluZm8uT2Zmc2V0X1ldID0gYWJzb2x1dGVPZmZzZXRZO1xuXHRcdFx0XHRcdGNlbGxCdWZmZXJbY2VsbEluZGV4ICsgQ2VsbEJ1ZmZlckluZm8uR2x5cGhJbmRleF0gPSBnbHlwaC5nbHlwaEluZGV4O1xuXHRcdFx0XHRcdGNlbGxCdWZmZXJbY2VsbEluZGV4ICsgQ2VsbEJ1ZmZlckluZm8uVGV4dHVyZUluZGV4XSA9IGdseXBoLnBhZ2VJbmRleDtcblxuXHRcdFx0XHRcdC8vIEFkanVzdCB0aGUgeCBwaXhlbCBvZmZzZXQgZm9yIHRoZSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRcdGFic29sdXRlT2Zmc2V0WCArPSBjaGFyV2lkdGg7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0b2tlblN0YXJ0SW5kZXggPSB0b2tlbkVuZEluZGV4O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDbGVhciB0byBlbmQgb2YgbGluZVxuXHRcdFx0ZmlsbFN0YXJ0SW5kZXggPSAoKHkgLSAxKSAqIEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucyArIHRva2VuRW5kSW5kZXgpICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0ZmlsbEVuZEluZGV4ID0gKHkgKiBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMpICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0Y2VsbEJ1ZmZlci5maWxsKDAsIGZpbGxTdGFydEluZGV4LCBmaWxsRW5kSW5kZXgpO1xuXG5cdFx0XHR1cFRvRGF0ZUxpbmVzLmFkZCh5KTtcblx0XHR9XG5cblx0XHRjb25zdCB2aXNpYmxlT2JqZWN0Q291bnQgPSAodmlld3BvcnREYXRhLmVuZExpbmVOdW1iZXIgLSB2aWV3cG9ydERhdGEuc3RhcnRMaW5lTnVtYmVyICsgMSkgKiBsaW5lSW5kZXhDb3VudDtcblxuXHRcdC8vIE9ubHkgd3JpdGUgd2hlbiB0aGVyZSBpcyBjaGFuZ2VkIGRhdGFcblx0XHRkaXJ0eUxpbmVTdGFydCA9IE1hdGgubWluKGRpcnR5TGluZVN0YXJ0LCBGdWxsRmlsZVJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZExpbmVzKTtcblx0XHRkaXJ0eUxpbmVFbmQgPSBNYXRoLm1pbihkaXJ0eUxpbmVFbmQsIEZ1bGxGaWxlUmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkTGluZXMpO1xuXHRcdGlmIChkaXJ0eUxpbmVTdGFydCA8PSBkaXJ0eUxpbmVFbmQpIHtcblx0XHRcdC8vIFdyaXRlIGJ1ZmZlciBhbmQgc3dhcCBpdCBvdXQgdG8gdW5ibG9jayB3cml0ZXNcblx0XHRcdHRoaXMuX2RldmljZS5xdWV1ZS53cml0ZUJ1ZmZlcihcblx0XHRcdFx0dGhpcy5fY2VsbEJpbmRCdWZmZXIsXG5cdFx0XHRcdChkaXJ0eUxpbmVTdGFydCAtIDEpICogbGluZUluZGV4Q291bnQgKiBGbG9hdDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQsXG5cdFx0XHRcdGNlbGxCdWZmZXIuYnVmZmVyLFxuXHRcdFx0XHQoZGlydHlMaW5lU3RhcnQgLSAxKSAqIGxpbmVJbmRleENvdW50ICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5ULFxuXHRcdFx0XHQoZGlydHlMaW5lRW5kIC0gZGlydHlMaW5lU3RhcnQgKyAxKSAqIGxpbmVJbmRleENvdW50ICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpbmFsUmVuZGVyZWRMaW5lID0gTWF0aC5tYXgodGhpcy5fZmluYWxSZW5kZXJlZExpbmUsIGRpcnR5TGluZUVuZCk7XG5cblx0XHR0aGlzLl9hY3RpdmVEb3VibGVCdWZmZXJJbmRleCA9IHRoaXMuX2FjdGl2ZURvdWJsZUJ1ZmZlckluZGV4ID8gMCA6IDE7XG5cblx0XHR0aGlzLl92aXNpYmxlT2JqZWN0Q291bnQgPSB2aXNpYmxlT2JqZWN0Q291bnQ7XG5cblx0XHRyZXR1cm4gdmlzaWJsZU9iamVjdENvdW50O1xuXHR9XG5cblx0ZHJhdyhwYXNzOiBHUFVSZW5kZXJQYXNzRW5jb2Rlciwgdmlld3BvcnREYXRhOiBWaWV3cG9ydERhdGEpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdmlzaWJsZU9iamVjdENvdW50IDw9IDApIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0F0dGVtcHQgdG8gZHJhdyAwIG9iamVjdHMnKTtcblx0XHR9XG5cdFx0cGFzcy5kcmF3KFxuXHRcdFx0cXVhZFZlcnRpY2VzLmxlbmd0aCAvIDIsXG5cdFx0XHR0aGlzLl92aXNpYmxlT2JqZWN0Q291bnQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHQodmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlciAtIDEpICogRnVsbEZpbGVSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBRdWV1ZSB1cGRhdGVzIHRoYXQgbmVlZCB0byBoYXBwZW4gb24gdGhlIGFjdGl2ZSBidWZmZXIsIG5vdCBqdXN0IHRoZSBjYWNoZS4gVGhpcyB3aWxsIGJlXG5cdCAqIGRlZmVycmVkIHRvIHdoZW4gdGhlIGFjdHVhbCBjZWxsIGJ1ZmZlciBpcyBjaGFuZ2VkIHNpbmNlIHRoZSBhY3RpdmUgYnVmZmVyIGNvdWxkIGJlIGxvY2tlZCBieVxuXHQgKiB0aGUgR1BVIHdoaWNoIHdvdWxkIGJsb2NrIHRoZSBtYWluIHRocmVhZC5cblx0ICovXG5cdHByaXZhdGUgX3F1ZXVlQnVmZmVyVXBkYXRlKGU6IFF1ZXVlZEJ1ZmZlckV2ZW50KSB7XG5cdFx0dGhpcy5fcXVldWVkQnVmZmVyVXBkYXRlc1swXS5wdXNoKGUpO1xuXHRcdHRoaXMuX3F1ZXVlZEJ1ZmZlclVwZGF0ZXNbMV0ucHVzaChlKTtcblx0fVxufVxuXG5mdW5jdGlvbiBwYXJzZUNzc0ZvbnRXZWlnaHQodmFsdWU6IHN0cmluZykge1xuXHRzd2l0Y2ggKHZhbHVlKSB7XG5cdFx0Y2FzZSAnbGlnaHRlcic6XG5cdFx0Y2FzZSAnbm9ybWFsJzogcmV0dXJuIDQwMDtcblx0XHRjYXNlICdib2xkZXInOlxuXHRcdGNhc2UgJ2JvbGQnOiByZXR1cm4gNzAwO1xuXHR9XG5cdHJldHVybiBwYXJzZUludCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ3NzT3BhY2l0eSh2YWx1ZTogc3RyaW5nKTogbnVtYmVyIHtcblx0aWYgKHZhbHVlLmVuZHNXaXRoKCclJykpIHtcblx0XHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZS5zdWJzdHJpbmcoMCwgdmFsdWUubGVuZ3RoIC0gMSkpIC8gMTAwO1xuXHR9XG5cdGlmICh2YWx1ZS5tYXRjaCgvXlxcZCsoPzpcXC5cXGQqKS8pKSB7XG5cdFx0cmV0dXJuIHBhcnNlRmxvYXQodmFsdWUpO1xuXHR9XG5cdHJldHVybiAxO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMscUJBQW9VO0FBTTdVLFNBQVMsOEJBQXNEO0FBQy9ELFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBCO0FBRW5DLElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUNDLEVBQUFBLHNCQUFBLG9CQUFp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QkFBc0IsYUFBYSxnQkFBZ0IsYUFBYSxrQkFBa0IsS0FBSztBQUc3RixxQkFBaUIsS0FBSyxJQUFJLGdCQUFnQix3QkFBdUIsaUJBQWlCO0FBQ2xGLG1CQUFlLEtBQUssSUFBSSxjQUFjLHdCQUF1QixpQkFBaUI7QUFDOUUsUUFBSSxrQkFBa0IsY0FBYztBQUVuQyxXQUFLLFFBQVEsTUFBTTtBQUFBLFFBQ2xCLEtBQUs7QUFBQSxTQUNKLGlCQUFpQixLQUFLLGlCQUFpQixhQUFhO0FBQUEsUUFDckQsV0FBVztBQUFBLFNBQ1YsaUJBQWlCLEtBQUssaUJBQWlCLGFBQWE7QUFBQSxTQUNwRCxlQUFlLGlCQUFpQixLQUFLLGlCQUFpQixhQUFhO0FBQUEsTUFDckU7QUFBQSxJQUNEO0FBRUEsU0FBSyxxQkFBcUIsS0FBSyxJQUFJLEtBQUssb0JBQW9CLFlBQVk7QUFFeEUsU0FBSywyQkFBMkIsS0FBSywyQkFBMkIsSUFBSTtBQUVwRSxTQUFLLHNCQUFzQjtBQUUzQixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsS0FBSyxNQUE0QixjQUFrQztBQUNsRSxRQUFJLEtBQUssdUJBQXVCLEdBQUc7QUFDbEMsWUFBTSxJQUFJLG1CQUFtQiwyQkFBMkI7QUFBQSxJQUN6RDtBQUNBLFNBQUs7QUFBQSxNQUNKLGFBQWEsU0FBUztBQUFBLE1BQ3RCLEtBQUs7QUFBQSxNQUNMO0FBQUEsT0FDQyxhQUFhLGtCQUFrQixLQUFLLHdCQUF1QjtBQUFBLElBQzdEO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9RLG1CQUFtQixHQUFzQjtBQUNoRCxTQUFLLHFCQUFxQixDQUFDLEVBQUUsS0FBSyxDQUFDO0FBQ25DLFNBQUsscUJBQXFCLENBQUMsRUFBRSxLQUFLLENBQUM7QUFBQSxFQUNwQztBQUNEO0FBQUE7QUFBQTtBQUFBO0FBM2RhLHdCQUtJLG9CQUFvQjtBQUFBO0FBQUE7QUFBQTtBQUx4Qix3QkFVSSxzQkFBc0I7QUFWaEMsSUFBTSx5QkFBTjtBQTZkUCxTQUFTLG1CQUFtQixPQUFlO0FBQzFDLFVBQVEsT0FBTztBQUFBLElBQ2QsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFVLGFBQU87QUFBQSxJQUN0QixLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQVEsYUFBTztBQUFBLEVBQ3JCO0FBQ0EsU0FBTyxTQUFTLEtBQUs7QUFDdEI7QUFFQSxTQUFTLGdCQUFnQixPQUF1QjtBQUMvQyxNQUFJLE1BQU0sU0FBUyxHQUFHLEdBQUc7QUFDeEIsV0FBTyxXQUFXLE1BQU0sVUFBVSxHQUFHLE1BQU0sU0FBUyxDQUFDLENBQUMsSUFBSTtBQUFBLEVBQzNEO0FBQ0EsTUFBSSxNQUFNLE1BQU0sZUFBZSxHQUFHO0FBQ2pDLFdBQU8sV0FBVyxLQUFLO0FBQUEsRUFDeEI7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbIkNvbnN0YW50cyIsICJDZWxsQnVmZmVySW5mbyJdCn0K
