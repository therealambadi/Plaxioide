import { getActiveWindow } from "../../../../base/browser/dom.js";
import { Color } from "../../../../base/common/color.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { CursorColumns } from "../../../common/core/cursorColumns.js";
import { createContentSegmenter } from "../contentSegmenter.js";
import { BindingId } from "../gpu.js";
import { GPULifecycle } from "../gpuDisposable.js";
import { quadVertices } from "../gpuUtils.js";
import { ViewGpuContext } from "../viewGpuContext.js";
import { BaseRenderStrategy } from "./baseRenderStrategy.js";
import { fullFileRenderStrategyWgsl } from "./fullFileRenderStrategy.wgsl.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["IndicesPerCell"] = 6] = "IndicesPerCell";
  Constants2[Constants2["CellBindBufferCapacityIncrement"] = 32] = "CellBindBufferCapacityIncrement";
  Constants2[Constants2["CellBindBufferInitialCapacity"] = 63] = "CellBindBufferInitialCapacity";
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
const _ViewportRenderStrategy = class _ViewportRenderStrategy extends BaseRenderStrategy {
  constructor(context, viewGpuContext, device, glyphRasterizer) {
    super(context, viewGpuContext, device, glyphRasterizer);
    this.type = "viewport";
    this.wgsl = fullFileRenderStrategyWgsl;
    this._cellBindBufferLineCapacity = 63 /* CellBindBufferInitialCapacity */;
    this._activeDoubleBufferIndex = 0;
    this._visibleObjectCount = 0;
    this._scrollInitialized = false;
    this._onDidChangeBindGroupEntries = this._register(new Emitter());
    this.onDidChangeBindGroupEntries = this._onDidChangeBindGroupEntries.event;
    this._rebuildCellBuffer(this._cellBindBufferLineCapacity);
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
  _rebuildCellBuffer(lineCount) {
    this._cellBindBuffer?.destroy();
    const lineCountWithIncrement = (Math.floor(lineCount / 32 /* CellBindBufferCapacityIncrement */) + 1) * 32 /* CellBindBufferCapacityIncrement */;
    const bufferSize = lineCountWithIncrement * _ViewportRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */ * Float32Array.BYTES_PER_ELEMENT;
    this._cellBindBuffer = this._register(GPULifecycle.createBuffer(this._device, {
      label: "Monaco full file cell buffer",
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })).object;
    this._cellValueBuffers = [
      new ArrayBuffer(bufferSize),
      new ArrayBuffer(bufferSize)
    ];
    this._cellBindBufferLineCapacity = lineCountWithIncrement;
    this._onDidChangeBindGroupEntries.fire();
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
    return true;
  }
  onDecorationsChanged(e) {
    return true;
  }
  onTokensChanged(e) {
    return true;
  }
  onLinesDeleted(e) {
    return true;
  }
  onLinesInserted(e) {
    return true;
  }
  onLinesChanged(e) {
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
    return true;
  }
  onLineMappingChanged(e) {
    return true;
  }
  onZonesChanged(e) {
    return true;
  }
  // #endregion
  reset() {
    for (const bufferIndex of [0, 1]) {
      const buffer = new Float32Array(this._cellValueBuffers[bufferIndex]);
      buffer.fill(0, 0, buffer.length);
      this._device.queue.writeBuffer(this._cellBindBuffer, 0, buffer.buffer, 0, buffer.byteLength);
    }
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
    if (this._cellBindBufferLineCapacity < viewportData.endLineNumber - viewportData.startLineNumber + 1) {
      this._rebuildCellBuffer(viewportData.endLineNumber - viewportData.startLineNumber + 1);
    }
    const cellBuffer = new Float32Array(this._cellValueBuffers[this._activeDoubleBufferIndex]);
    cellBuffer.fill(0);
    const lineIndexCount = _ViewportRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
    for (y = viewportData.startLineNumber; y <= viewportData.endLineNumber; y++) {
      if (!this._viewGpuContext.canRender(viewLineOptions, viewportData, y)) {
        continue;
      }
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
          if (x > _ViewportRenderStrategy.maxSupportedColumns) {
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
            cellIndex = ((y - 1) * _ViewportRenderStrategy.maxSupportedColumns + x) * 6 /* IndicesPerCell */;
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
          cellIndex = ((y - viewportData.startLineNumber) * _ViewportRenderStrategy.maxSupportedColumns + x) * 6 /* IndicesPerCell */;
          cellBuffer[cellIndex + 0 /* Offset_X */] = Math.floor(absoluteOffsetX);
          cellBuffer[cellIndex + 1 /* Offset_Y */] = absoluteOffsetY;
          cellBuffer[cellIndex + 4 /* GlyphIndex */] = glyph.glyphIndex;
          cellBuffer[cellIndex + 5 /* TextureIndex */] = glyph.pageIndex;
          absoluteOffsetX += charWidth;
        }
        tokenStartIndex = tokenEndIndex;
      }
      fillStartIndex = ((y - viewportData.startLineNumber) * _ViewportRenderStrategy.maxSupportedColumns + tokenEndIndex) * 6 /* IndicesPerCell */;
      fillEndIndex = (y - viewportData.startLineNumber) * _ViewportRenderStrategy.maxSupportedColumns * 6 /* IndicesPerCell */;
      cellBuffer.fill(0, fillStartIndex, fillEndIndex);
    }
    const visibleObjectCount = (viewportData.endLineNumber - viewportData.startLineNumber + 1) * lineIndexCount;
    this._device.queue.writeBuffer(
      this._cellBindBuffer,
      0,
      cellBuffer.buffer,
      0,
      (viewportData.endLineNumber - viewportData.startLineNumber) * lineIndexCount * Float32Array.BYTES_PER_ELEMENT
    );
    this._activeDoubleBufferIndex = this._activeDoubleBufferIndex ? 0 : 1;
    this._visibleObjectCount = visibleObjectCount;
    return visibleObjectCount;
  }
  draw(pass, viewportData) {
    if (this._visibleObjectCount <= 0) {
      throw new BugIndicatingError("Attempt to draw 0 objects");
    }
    pass.draw(quadVertices.length / 2, this._visibleObjectCount);
  }
};
/**
 * The hard cap for line columns that can be rendered by the GPU renderer.
 */
_ViewportRenderStrategy.maxSupportedColumns = 2e3;
let ViewportRenderStrategy = _ViewportRenderStrategy;
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
  ViewportRenderStrategy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvcmVuZGVyU3RyYXRlZ3kvdmlld3BvcnRSZW5kZXJTdHJhdGVneS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEN1cnNvckNvbHVtbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9jdXJzb3JDb2x1bW5zLmpzJztcbmltcG9ydCB0eXBlIHsgSVZpZXdMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IHR5cGUgVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIHR5cGUgVmlld0RlY29yYXRpb25zQ2hhbmdlZEV2ZW50LCB0eXBlIFZpZXdMaW5lTWFwcGluZ0NoYW5nZWRFdmVudCwgdHlwZSBWaWV3TGluZXNDaGFuZ2VkRXZlbnQsIHR5cGUgVmlld0xpbmVzRGVsZXRlZEV2ZW50LCB0eXBlIFZpZXdMaW5lc0luc2VydGVkRXZlbnQsIHR5cGUgVmlld1Njcm9sbENoYW5nZWRFdmVudCwgdHlwZSBWaWV3VGhlbWVDaGFuZ2VkRXZlbnQsIHR5cGUgVmlld1Rva2Vuc0NoYW5nZWRFdmVudCwgdHlwZSBWaWV3Wm9uZXNDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdwb3J0RGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L3ZpZXdMaW5lc1ZpZXdwb3J0RGF0YS5qcyc7XG5pbXBvcnQgdHlwZSB7IElubGluZURlY29yYXRpb24sIFZpZXdMaW5lUmVuZGVyaW5nRGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHR5cGUgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHR5cGUgeyBWaWV3TGluZU9wdGlvbnMgfSBmcm9tICcuLi8uLi92aWV3UGFydHMvdmlld0xpbmVzL3ZpZXdMaW5lT3B0aW9ucy5qcyc7XG5pbXBvcnQgdHlwZSB7IElUZXh0dXJlQXRsYXNQYWdlR2x5cGggfSBmcm9tICcuLi9hdGxhcy9hdGxhcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVDb250ZW50U2VnbWVudGVyLCB0eXBlIElDb250ZW50U2VnbWVudGVyIH0gZnJvbSAnLi4vY29udGVudFNlZ21lbnRlci5qcyc7XG5pbXBvcnQgeyBCaW5kaW5nSWQgfSBmcm9tICcuLi9ncHUuanMnO1xuaW1wb3J0IHsgR1BVTGlmZWN5Y2xlIH0gZnJvbSAnLi4vZ3B1RGlzcG9zYWJsZS5qcyc7XG5pbXBvcnQgeyBxdWFkVmVydGljZXMgfSBmcm9tICcuLi9ncHVVdGlscy5qcyc7XG5pbXBvcnQgeyBHbHlwaFJhc3Rlcml6ZXIgfSBmcm9tICcuLi9yYXN0ZXIvZ2x5cGhSYXN0ZXJpemVyLmpzJztcbmltcG9ydCB7IFZpZXdHcHVDb250ZXh0IH0gZnJvbSAnLi4vdmlld0dwdUNvbnRleHQuanMnO1xuaW1wb3J0IHsgQmFzZVJlbmRlclN0cmF0ZWd5IH0gZnJvbSAnLi9iYXNlUmVuZGVyU3RyYXRlZ3kuanMnO1xuaW1wb3J0IHsgZnVsbEZpbGVSZW5kZXJTdHJhdGVneVdnc2wgfSBmcm9tICcuL2Z1bGxGaWxlUmVuZGVyU3RyYXRlZ3kud2dzbC5qcyc7XG5cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0SW5kaWNlc1BlckNlbGwgPSA2LFxuXHRDZWxsQmluZEJ1ZmZlckNhcGFjaXR5SW5jcmVtZW50ID0gMzIsXG5cdENlbGxCaW5kQnVmZmVySW5pdGlhbENhcGFjaXR5ID0gNjMsIC8vIFdpbGwgYmUgcm91bmRlZCB1cCB0byBuZWFyZXN0IGluY3JlbWVudFxufVxuXG5jb25zdCBlbnVtIENlbGxCdWZmZXJJbmZvIHtcblx0RmxvYXRzUGVyRW50cnkgPSA2LFxuXHRCeXRlc1BlckVudHJ5ID0gQ2VsbEJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkgKiA0LFxuXHRPZmZzZXRfWCA9IDAsXG5cdE9mZnNldF9ZID0gMSxcblx0T2Zmc2V0X1VudXNlZDEgPSAyLFxuXHRPZmZzZXRfVW51c2VkMiA9IDMsXG5cdEdseXBoSW5kZXggPSA0LFxuXHRUZXh0dXJlSW5kZXggPSA1LFxufVxuXG4vKipcbiAqIEEgcmVuZGVyIHN0cmF0ZWd5IHRoYXQgdXBsb2FkcyB0aGUgY29udGVudCBvZiB0aGUgZW50aXJlIHZpZXdwb3J0IGV2ZXJ5IGZyYW1lLlxuICovXG5leHBvcnQgY2xhc3MgVmlld3BvcnRSZW5kZXJTdHJhdGVneSBleHRlbmRzIEJhc2VSZW5kZXJTdHJhdGVneSB7XG5cdC8qKlxuXHQgKiBUaGUgaGFyZCBjYXAgZm9yIGxpbmUgY29sdW1ucyB0aGF0IGNhbiBiZSByZW5kZXJlZCBieSB0aGUgR1BVIHJlbmRlcmVyLlxuXHQgKi9cblx0c3RhdGljIHJlYWRvbmx5IG1heFN1cHBvcnRlZENvbHVtbnMgPSAyMDAwO1xuXG5cdHJlYWRvbmx5IHR5cGUgPSAndmlld3BvcnQnO1xuXHRyZWFkb25seSB3Z3NsOiBzdHJpbmcgPSBmdWxsRmlsZVJlbmRlclN0cmF0ZWd5V2dzbDtcblxuXHRwcml2YXRlIF9jZWxsQmluZEJ1ZmZlckxpbmVDYXBhY2l0eSA9IENvbnN0YW50cy5DZWxsQmluZEJ1ZmZlckluaXRpYWxDYXBhY2l0eTtcblx0cHJpdmF0ZSBfY2VsbEJpbmRCdWZmZXIhOiBHUFVCdWZmZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBjZWxsIHZhbHVlIGJ1ZmZlcnMsIHRoZXNlIGhvbGQgdGhlIGNlbGxzIGFuZCB0aGVpciBnbHlwaHMuIEl0J3MgZG91YmxlIGJ1ZmZlcnMgc3VjaCB0aGF0XG5cdCAqIHRoZSB0aHJlYWQgZG9lc24ndCBibG9jayB3aGVuIG9uZSBpcyBiZWluZyB1cGxvYWRlZCB0byB0aGUgR1BVLlxuXHQgKi9cblx0cHJpdmF0ZSBfY2VsbFZhbHVlQnVmZmVycyE6IFtBcnJheUJ1ZmZlciwgQXJyYXlCdWZmZXJdO1xuXHRwcml2YXRlIF9hY3RpdmVEb3VibGVCdWZmZXJJbmRleDogMCB8IDEgPSAwO1xuXG5cdHByaXZhdGUgX3Zpc2libGVPYmplY3RDb3VudDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIF9zY3JvbGxPZmZzZXRCaW5kQnVmZmVyOiBHUFVCdWZmZXI7XG5cdHByaXZhdGUgX3Njcm9sbE9mZnNldFZhbHVlQnVmZmVyOiBGbG9hdDMyQXJyYXk7XG5cdHByaXZhdGUgX3Njcm9sbEluaXRpYWxpemVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0Z2V0IGJpbmRHcm91cEVudHJpZXMoKTogR1BVQmluZEdyb3VwRW50cnlbXSB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdHsgYmluZGluZzogQmluZGluZ0lkLkNlbGxzLCByZXNvdXJjZTogeyBidWZmZXI6IHRoaXMuX2NlbGxCaW5kQnVmZmVyIH0gfSxcblx0XHRcdHsgYmluZGluZzogQmluZGluZ0lkLlNjcm9sbE9mZnNldCwgcmVzb3VyY2U6IHsgYnVmZmVyOiB0aGlzLl9zY3JvbGxPZmZzZXRCaW5kQnVmZmVyIH0gfVxuXHRcdF07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUJpbmRHcm91cEVudHJpZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VCaW5kR3JvdXBFbnRyaWVzID0gdGhpcy5fb25EaWRDaGFuZ2VCaW5kR3JvdXBFbnRyaWVzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdHZpZXdHcHVDb250ZXh0OiBWaWV3R3B1Q29udGV4dCxcblx0XHRkZXZpY2U6IEdQVURldmljZSxcblx0XHRnbHlwaFJhc3Rlcml6ZXI6IHsgdmFsdWU6IEdseXBoUmFzdGVyaXplciB9LFxuXHQpIHtcblx0XHRzdXBlcihjb250ZXh0LCB2aWV3R3B1Q29udGV4dCwgZGV2aWNlLCBnbHlwaFJhc3Rlcml6ZXIpO1xuXG5cdFx0dGhpcy5fcmVidWlsZENlbGxCdWZmZXIodGhpcy5fY2VsbEJpbmRCdWZmZXJMaW5lQ2FwYWNpdHkpO1xuXG5cdFx0Y29uc3Qgc2Nyb2xsT2Zmc2V0QnVmZmVyU2l6ZSA9IDI7XG5cdFx0dGhpcy5fc2Nyb2xsT2Zmc2V0QmluZEJ1ZmZlciA9IHRoaXMuX3JlZ2lzdGVyKEdQVUxpZmVjeWNsZS5jcmVhdGVCdWZmZXIodGhpcy5fZGV2aWNlLCB7XG5cdFx0XHRsYWJlbDogJ01vbmFjbyBzY3JvbGwgb2Zmc2V0IGJ1ZmZlcicsXG5cdFx0XHRzaXplOiBzY3JvbGxPZmZzZXRCdWZmZXJTaXplICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5ULFxuXHRcdFx0dXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlVOSUZPUk0gfCBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcblx0XHR9KSkub2JqZWN0O1xuXHRcdHRoaXMuX3Njcm9sbE9mZnNldFZhbHVlQnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheShzY3JvbGxPZmZzZXRCdWZmZXJTaXplKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlYnVpbGRDZWxsQnVmZmVyKGxpbmVDb3VudDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fY2VsbEJpbmRCdWZmZXI/LmRlc3Ryb3koKTtcblxuXHRcdC8vIEluY3JlYXNlIGluIGNodW5rcyBzbyByZXNpemluZyBhIHdpbmRvdyBieSBoYW5kIGRvZXNuJ3Qga2VlcCBhbGxvY2F0aW5nIGFuZCB0aHJvd2luZyBhd2F5XG5cdFx0Y29uc3QgbGluZUNvdW50V2l0aEluY3JlbWVudCA9IChNYXRoLmZsb29yKGxpbmVDb3VudCAvIENvbnN0YW50cy5DZWxsQmluZEJ1ZmZlckNhcGFjaXR5SW5jcmVtZW50KSArIDEpICogQ29uc3RhbnRzLkNlbGxCaW5kQnVmZmVyQ2FwYWNpdHlJbmNyZW1lbnQ7XG5cblx0XHRjb25zdCBidWZmZXJTaXplID0gbGluZUNvdW50V2l0aEluY3JlbWVudCAqIFZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucyAqIENvbnN0YW50cy5JbmRpY2VzUGVyQ2VsbCAqIEZsb2F0MzJBcnJheS5CWVRFU19QRVJfRUxFTUVOVDtcblx0XHR0aGlzLl9jZWxsQmluZEJ1ZmZlciA9IHRoaXMuX3JlZ2lzdGVyKEdQVUxpZmVjeWNsZS5jcmVhdGVCdWZmZXIodGhpcy5fZGV2aWNlLCB7XG5cdFx0XHRsYWJlbDogJ01vbmFjbyBmdWxsIGZpbGUgY2VsbCBidWZmZXInLFxuXHRcdFx0c2l6ZTogYnVmZmVyU2l6ZSxcblx0XHRcdHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5TVE9SQUdFIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG5cdFx0fSkpLm9iamVjdDtcblx0XHR0aGlzLl9jZWxsVmFsdWVCdWZmZXJzID0gW1xuXHRcdFx0bmV3IEFycmF5QnVmZmVyKGJ1ZmZlclNpemUpLFxuXHRcdFx0bmV3IEFycmF5QnVmZmVyKGJ1ZmZlclNpemUpLFxuXHRcdF07XG5cdFx0dGhpcy5fY2VsbEJpbmRCdWZmZXJMaW5lQ2FwYWNpdHkgPSBsaW5lQ291bnRXaXRoSW5jcmVtZW50O1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VCaW5kR3JvdXBFbnRyaWVzLmZpcmUoKTtcblx0fVxuXG5cdC8vICNyZWdpb24gRXZlbnQgaGFuZGxlcnNcblxuXHQvLyBUaGUgcHJpbWFyeSBqb2Igb2YgdGhlc2UgaGFuZGxlcnMgaXMgdG86XG5cdC8vIDEuIEludmFsaWRhdGUgdGhlIHVwIHRvIGRhdGUgbGluZSBjYWNoZSwgd2hpY2ggd2lsbCBjYXVzZSB0aGUgbGluZSB0byBiZSByZS1yZW5kZXJlZCB3aGVuXG5cdC8vICAgIGl0J3MgX3dpdGhpbiB0aGUgdmlld3BvcnRfLlxuXHQvLyAyLiBQYXNzIHJlbGV2YW50IGV2ZW50cyBvbiB0byB0aGUgcmVuZGVyIGZ1bmN0aW9uIHNvIGl0IGNhbiBmb3JjZSBjZXJ0YWluIGxpbmUgcmFuZ2VzIHRvIGJlXG5cdC8vICAgIHJlLXJlbmRlcmVkIGV2ZW4gaWYgdGhleSdyZSBub3QgaW4gdGhlIHZpZXdwb3J0LiBGb3IgZXhhbXBsZSB3aGVuIGEgdmlldyB6b25lIGlzIGFkZGVkLFxuXHQvLyAgICB0aGVyZSBhcmUgbGluZXMgdGhhdCB1c2VkIHRvIGJlIHZpc2libGUgYnV0IGFyZSBubyBsb25nZXIsIHNvIHRob3NlIHJhbmdlcyBtdXN0IGJlXG5cdC8vICAgIGNsZWFyZWQgYW5kIHVwbG9hZGVkIHRvIHRoZSBHUFUuXG5cblx0cHVibGljIG92ZXJyaWRlIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZTogVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiBWaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvblRva2Vuc0NoYW5nZWQoZTogVmlld1Rva2Vuc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNEZWxldGVkKGU6IFZpZXdMaW5lc0RlbGV0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uTGluZXNJbnNlcnRlZChlOiBWaWV3TGluZXNJbnNlcnRlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogVmlld0xpbmVzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgb25TY3JvbGxDaGFuZ2VkKGU/OiBWaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZHByID0gZ2V0QWN0aXZlV2luZG93KCkuZGV2aWNlUGl4ZWxSYXRpbztcblx0XHR0aGlzLl9zY3JvbGxPZmZzZXRWYWx1ZUJ1ZmZlclswXSA9IChlPy5zY3JvbGxMZWZ0ID8/IHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsTGVmdCgpKSAqIGRwcjtcblx0XHR0aGlzLl9zY3JvbGxPZmZzZXRWYWx1ZUJ1ZmZlclsxXSA9IChlPy5zY3JvbGxUb3AgPz8gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKSkgKiBkcHI7XG5cdFx0dGhpcy5fZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKHRoaXMuX3Njcm9sbE9mZnNldEJpbmRCdWZmZXIsIDAsIHRoaXMuX3Njcm9sbE9mZnNldFZhbHVlQnVmZmVyKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvblRoZW1lQ2hhbmdlZChlOiBWaWV3VGhlbWVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkxpbmVNYXBwaW5nQ2hhbmdlZChlOiBWaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBvblpvbmVzQ2hhbmdlZChlOiBWaWV3Wm9uZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8vICNlbmRyZWdpb25cblxuXHRyZXNldCgpIHtcblx0XHRmb3IgKGNvbnN0IGJ1ZmZlckluZGV4IG9mIFswLCAxXSkge1xuXHRcdFx0Ly8gWmVybyBvdXQgYnVmZmVyIGFuZCB1cGxvYWQgdG8gR1BVIHRvIHByZXZlbnQgc3RhbGUgcm93cyBmcm9tIHJlbmRlcmluZ1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9jZWxsVmFsdWVCdWZmZXJzW2J1ZmZlckluZGV4XSk7XG5cdFx0XHRidWZmZXIuZmlsbCgwLCAwLCBidWZmZXIubGVuZ3RoKTtcblx0XHRcdHRoaXMuX2RldmljZS5xdWV1ZS53cml0ZUJ1ZmZlcih0aGlzLl9jZWxsQmluZEJ1ZmZlciwgMCwgYnVmZmVyLmJ1ZmZlciwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZSh2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSwgdmlld0xpbmVPcHRpb25zOiBWaWV3TGluZU9wdGlvbnMpOiBudW1iZXIge1xuXHRcdC8vIElNUE9SVEFOVDogVGhpcyBpcyBhIGhvdCBmdW5jdGlvbi4gVmFyaWFibGVzIGFyZSBwcmUtYWxsb2NhdGVkIGFuZCBzaGFyZWQgd2l0aGluIHRoZVxuXHRcdC8vIGxvb3AuIFRoaXMgaXMgZG9uZSBzbyB3ZSBkb24ndCBuZWVkIHRvIHRydXN0IHRoZSBKSVQgY29tcGlsZXIgdG8gZG8gdGhpcyBvcHRpbWl6YXRpb24gdG9cblx0XHQvLyBhdm9pZCBwb3RlbnRpYWwgYWRkaXRpb25hbCBibG9ja2luZyB0aW1lIGluIGdhcmJhZ2UgY29sbGVjdG9yIHdoaWNoIGlzIGEgY29tbW9uIGNhdXNlIG9mXG5cdFx0Ly8gZHJvcHBlZCBmcmFtZXMuXG5cblx0XHRsZXQgY2hhcnMgPSAnJztcblx0XHRsZXQgc2VnbWVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjaGFyV2lkdGggPSAwO1xuXHRcdGxldCB5ID0gMDtcblx0XHRsZXQgeCA9IDA7XG5cdFx0bGV0IGFic29sdXRlT2Zmc2V0WCA9IDA7XG5cdFx0bGV0IGFic29sdXRlT2Zmc2V0WSA9IDA7XG5cdFx0bGV0IHRhYlhPZmZzZXQgPSAwO1xuXHRcdGxldCBnbHlwaDogUmVhZG9ubHk8SVRleHR1cmVBdGxhc1BhZ2VHbHlwaD47XG5cdFx0bGV0IGNlbGxJbmRleCA9IDA7XG5cblx0XHRsZXQgdG9rZW5TdGFydEluZGV4ID0gMDtcblx0XHRsZXQgdG9rZW5FbmRJbmRleCA9IDA7XG5cdFx0bGV0IHRva2VuTWV0YWRhdGEgPSAwO1xuXG5cdFx0bGV0IGRlY29yYXRpb25TdHlsZVNldEJvbGQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGRlY29yYXRpb25TdHlsZVNldENvbG9yOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGRlY29yYXRpb25TdHlsZVNldE9wYWNpdHk6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGxldCBsaW5lRGF0YTogVmlld0xpbmVSZW5kZXJpbmdEYXRhO1xuXHRcdGxldCBkZWNvcmF0aW9uOiBJbmxpbmVEZWNvcmF0aW9uO1xuXHRcdGxldCBmaWxsU3RhcnRJbmRleCA9IDA7XG5cdFx0bGV0IGZpbGxFbmRJbmRleCA9IDA7XG5cblx0XHRsZXQgdG9rZW5zOiBJVmlld0xpbmVUb2tlbnM7XG5cblx0XHRjb25zdCBkcHIgPSBnZXRBY3RpdmVXaW5kb3coKS5kZXZpY2VQaXhlbFJhdGlvO1xuXHRcdGxldCBjb250ZW50U2VnbWVudGVyOiBJQ29udGVudFNlZ21lbnRlcjtcblxuXHRcdGlmICghdGhpcy5fc2Nyb2xsSW5pdGlhbGl6ZWQpIHtcblx0XHRcdHRoaXMub25TY3JvbGxDaGFuZ2VkKCk7XG5cdFx0XHR0aGlzLl9zY3JvbGxJbml0aWFsaXplZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gWmVybyBvdXQgY2VsbCBidWZmZXIgb3IgcmVidWlsZCBpZiBuZWVkZWRcblx0XHRpZiAodGhpcy5fY2VsbEJpbmRCdWZmZXJMaW5lQ2FwYWNpdHkgPCB2aWV3cG9ydERhdGEuZW5kTGluZU51bWJlciAtIHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIgKyAxKSB7XG5cdFx0XHR0aGlzLl9yZWJ1aWxkQ2VsbEJ1ZmZlcih2aWV3cG9ydERhdGEuZW5kTGluZU51bWJlciAtIHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIgKyAxKTtcblx0XHR9XG5cdFx0Y29uc3QgY2VsbEJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fY2VsbFZhbHVlQnVmZmVyc1t0aGlzLl9hY3RpdmVEb3VibGVCdWZmZXJJbmRleF0pO1xuXHRcdGNlbGxCdWZmZXIuZmlsbCgwKTtcblxuXHRcdGNvbnN0IGxpbmVJbmRleENvdW50ID0gVmlld3BvcnRSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXG5cdFx0Zm9yICh5ID0gdmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlcjsgeSA8PSB2aWV3cG9ydERhdGEuZW5kTGluZU51bWJlcjsgeSsrKSB7XG5cblx0XHRcdC8vIE9ubHkgYXR0ZW1wdCB0byByZW5kZXIgbGluZXMgdGhhdCB0aGUgR1BVIHJlbmRlcmVyIGNhbiBoYW5kbGVcblx0XHRcdGlmICghdGhpcy5fdmlld0dwdUNvbnRleHQuY2FuUmVuZGVyKHZpZXdMaW5lT3B0aW9ucywgdmlld3BvcnREYXRhLCB5KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0bGluZURhdGEgPSB2aWV3cG9ydERhdGEuZ2V0Vmlld0xpbmVSZW5kZXJpbmdEYXRhKHkpO1xuXHRcdFx0dGFiWE9mZnNldCA9IDA7XG5cblx0XHRcdGNvbnRlbnRTZWdtZW50ZXIgPSBjcmVhdGVDb250ZW50U2VnbWVudGVyKGxpbmVEYXRhLCB2aWV3TGluZU9wdGlvbnMpO1xuXHRcdFx0Y2hhcldpZHRoID0gdmlld0xpbmVPcHRpb25zLnNwYWNlV2lkdGggKiBkcHI7XG5cdFx0XHRhYnNvbHV0ZU9mZnNldFggPSAwO1xuXG5cdFx0XHR0b2tlbnMgPSBsaW5lRGF0YS50b2tlbnM7XG5cdFx0XHR0b2tlblN0YXJ0SW5kZXggPSBsaW5lRGF0YS5taW5Db2x1bW4gLSAxO1xuXHRcdFx0dG9rZW5FbmRJbmRleCA9IDA7XG5cdFx0XHRmb3IgKGxldCB0b2tlbkluZGV4ID0gMCwgdG9rZW5zTGVuID0gdG9rZW5zLmdldENvdW50KCk7IHRva2VuSW5kZXggPCB0b2tlbnNMZW47IHRva2VuSW5kZXgrKykge1xuXHRcdFx0XHR0b2tlbkVuZEluZGV4ID0gdG9rZW5zLmdldEVuZE9mZnNldCh0b2tlbkluZGV4KTtcblx0XHRcdFx0aWYgKHRva2VuRW5kSW5kZXggPD0gdG9rZW5TdGFydEluZGV4KSB7XG5cdFx0XHRcdFx0Ly8gVGhlIGZhdXggaW5kZW50IHBhcnQgb2YgdGhlIGxpbmUgc2hvdWxkIGhhdmUgbm8gdG9rZW4gdHlwZVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dG9rZW5NZXRhZGF0YSA9IHRva2Vucy5nZXRNZXRhZGF0YSh0b2tlbkluZGV4KTtcblxuXHRcdFx0XHRmb3IgKHggPSB0b2tlblN0YXJ0SW5kZXg7IHggPCB0b2tlbkVuZEluZGV4OyB4KyspIHtcblx0XHRcdFx0XHQvLyBPbmx5IHJlbmRlciBsaW5lcyB0aGF0IGRvIG5vdCBleGNlZWQgbWF4aW11bSBjb2x1bW5zXG5cdFx0XHRcdFx0aWYgKHggPiBWaWV3cG9ydFJlbmRlclN0cmF0ZWd5Lm1heFN1cHBvcnRlZENvbHVtbnMpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzZWdtZW50ID0gY29udGVudFNlZ21lbnRlci5nZXRTZWdtZW50QXRJbmRleCh4KTtcblx0XHRcdFx0XHRpZiAoc2VnbWVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hhcnMgPSBzZWdtZW50O1xuXG5cdFx0XHRcdFx0aWYgKCEobGluZURhdGEuaXNCYXNpY0FTQ0lJICYmIHZpZXdMaW5lT3B0aW9ucy51c2VNb25vc3BhY2VPcHRpbWl6YXRpb25zKSkge1xuXHRcdFx0XHRcdFx0Y2hhcldpZHRoID0gdGhpcy5nbHlwaFJhc3Rlcml6ZXIuZ2V0VGV4dE1ldHJpY3MoY2hhcnMpLndpZHRoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldENvbG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldEJvbGQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0ZGVjb3JhdGlvblN0eWxlU2V0T3BhY2l0eSA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRcdC8vIEFwcGx5IHN1cHBvcnRlZCBpbmxpbmUgZGVjb3JhdGlvbiBzdHlsZXMgdG8gdGhlIGNlbGwgbWV0YWRhdGFcblx0XHRcdFx0XHRmb3IgKGRlY29yYXRpb24gb2YgbGluZURhdGEuaW5saW5lRGVjb3JhdGlvbnMpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgUmFuZ2Uuc3RyaWN0Q29udGFpbnNQb3NpdGlvbiBleGNlcHQgaXQgd29ya3MgYXQgdGhlIGNlbGwgbGV2ZWwsXG5cdFx0XHRcdFx0XHQvLyBpdCdzIGFsc28gaW5saW5lZCB0byBhdm9pZCBvdmVyaGVhZC5cblx0XHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdFx0KHkgPCBkZWNvcmF0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlciB8fCB5ID4gZGVjb3JhdGlvbi5yYW5nZS5lbmRMaW5lTnVtYmVyKSB8fFxuXHRcdFx0XHRcdFx0XHQoeSA9PT0gZGVjb3JhdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgeCA8IGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxKSB8fFxuXHRcdFx0XHRcdFx0XHQoeSA9PT0gZGVjb3JhdGlvbi5yYW5nZS5lbmRMaW5lTnVtYmVyICYmIHggPj0gZGVjb3JhdGlvbi5yYW5nZS5lbmRDb2x1bW4gLSAxKVxuXHRcdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCBydWxlcyA9IFZpZXdHcHVDb250ZXh0LmRlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yLmdldFN0eWxlUnVsZXModGhpcy5fdmlld0dwdUNvbnRleHQuY2FudmFzLmRvbU5vZGUsIGRlY29yYXRpb24uaW5saW5lQ2xhc3NOYW1lKTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgcnVsZSBvZiBydWxlcykge1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHIgb2YgcnVsZS5zdHlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gcnVsZS5zdHlsZU1hcC5nZXQocik/LnRvU3RyaW5nKCkgPz8gJyc7XG5cdFx0XHRcdFx0XHRcdFx0c3dpdGNoIChyKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjYXNlICdjb2xvcic6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogVGhpcyBwYXJzaW5nIGFuZCBlcnJvciBoYW5kbGluZyBzaG91bGQgbW92ZSBpbnRvIGNhblJlbmRlciBzbyBmYWxsYmFja1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAgICAgICB0byBET00gd29ya3Ncblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkQ29sb3IgPSBDb2xvci5Gb3JtYXQuQ1NTLnBhcnNlKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKCFwYXJzZWRDb2xvcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0ludmFsaWQgY29sb3IgZm9ybWF0ICcgKyB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvblN0eWxlU2V0Q29sb3IgPSBwYXJzZWRDb2xvci50b051bWJlcjMyQml0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0Y2FzZSAnZm9udC13ZWlnaHQnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZFZhbHVlID0gcGFyc2VDc3NGb250V2VpZ2h0KHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKHBhcnNlZFZhbHVlID49IDQwMCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldEJvbGQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFRPRE86IFNldCBib2xkIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjM3NTg0KVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlY29yYXRpb25TdHlsZVNldEJvbGQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBUT0RPOiBTZXQgbm9ybWFsIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjM3NTg0KVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0Y2FzZSAnb3BhY2l0eSc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkVmFsdWUgPSBwYXJzZUNzc09wYWNpdHkodmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9uU3R5bGVTZXRPcGFjaXR5ID0gcGFyc2VkVmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogdGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignVW5leHBlY3RlZCBpbmxpbmUgZGVjb3JhdGlvbiBzdHlsZScpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChjaGFycyA9PT0gJyAnIHx8IGNoYXJzID09PSAnXFx0Jykge1xuXHRcdFx0XHRcdFx0Ly8gWmVybyBvdXQgZ2x5cGggdG8gZW5zdXJlIGl0IGRvZXNuJ3QgZ2V0IHJlbmRlcmVkXG5cdFx0XHRcdFx0XHRjZWxsSW5kZXggPSAoKHkgLSAxKSAqIFZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucyArIHgpICogQ29uc3RhbnRzLkluZGljZXNQZXJDZWxsO1xuXHRcdFx0XHRcdFx0Y2VsbEJ1ZmZlci5maWxsKDAsIGNlbGxJbmRleCwgY2VsbEluZGV4ICsgQ2VsbEJ1ZmZlckluZm8uRmxvYXRzUGVyRW50cnkpO1xuXHRcdFx0XHRcdFx0Ly8gQWRqdXN0IHhPZmZzZXQgZm9yIHRhYiBzdG9wc1xuXHRcdFx0XHRcdFx0aWYgKGNoYXJzID09PSAnXFx0Jykge1xuXHRcdFx0XHRcdFx0XHQvLyBGaW5kIHRoZSBwaXhlbCBvZmZzZXQgYmV0d2VlbiB0aGUgY3VycmVudCBwb3NpdGlvbiBhbmQgdGhlIG5leHQgdGFiIHN0b3Bcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2Zmc2V0QmVmb3JlID0geCArIHRhYlhPZmZzZXQ7XG5cdFx0XHRcdFx0XHRcdHRhYlhPZmZzZXQgPSBDdXJzb3JDb2x1bW5zLm5leHRSZW5kZXJUYWJTdG9wKHggKyB0YWJYT2Zmc2V0LCBsaW5lRGF0YS50YWJTaXplKTtcblx0XHRcdFx0XHRcdFx0YWJzb2x1dGVPZmZzZXRYICs9IGNoYXJXaWR0aCAqICh0YWJYT2Zmc2V0IC0gb2Zmc2V0QmVmb3JlKTtcblx0XHRcdFx0XHRcdFx0Ly8gQ29udmVydCBiYWNrIHRvIG9mZnNldCBleGNsdWRpbmcgeCBhbmQgdGhlIGN1cnJlbnQgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRcdHRhYlhPZmZzZXQgLT0geCArIDE7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRhYnNvbHV0ZU9mZnNldFggKz0gY2hhcldpZHRoO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvblN0eWxlU2V0SWQgPSBWaWV3R3B1Q29udGV4dC5kZWNvcmF0aW9uU3R5bGVDYWNoZS5nZXRPckNyZWF0ZUVudHJ5KGRlY29yYXRpb25TdHlsZVNldENvbG9yLCBkZWNvcmF0aW9uU3R5bGVTZXRCb2xkLCBkZWNvcmF0aW9uU3R5bGVTZXRPcGFjaXR5KTtcblx0XHRcdFx0XHRnbHlwaCA9IHRoaXMuX3ZpZXdHcHVDb250ZXh0LmF0bGFzLmdldEdseXBoKHRoaXMuZ2x5cGhSYXN0ZXJpemVyLCBjaGFycywgdG9rZW5NZXRhZGF0YSwgZGVjb3JhdGlvblN0eWxlU2V0SWQsIGFic29sdXRlT2Zmc2V0WCk7XG5cblx0XHRcdFx0XHRhYnNvbHV0ZU9mZnNldFkgPSBNYXRoLnJvdW5kKFxuXHRcdFx0XHRcdFx0Ly8gVG9wIG9mIGxheW91dCBib3ggKGluY2x1ZGVzIGxpbmUgaGVpZ2h0KVxuXHRcdFx0XHRcdFx0dmlld3BvcnREYXRhLnJlbGF0aXZlVmVydGljYWxPZmZzZXRbeSAtIHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXJdICogZHByICtcblxuXHRcdFx0XHRcdFx0Ly8gRGVsdGEgZnJvbSB0b3Agb2YgbGF5b3V0IGJveCAoaW5jbHVkZXMgbGluZSBoZWlnaHQpIHRvIHRvcCBvZiB0aGUgaW5saW5lIGJveCAobm8gbGluZSBoZWlnaHQpXG5cdFx0XHRcdFx0XHRNYXRoLmZsb29yKCh2aWV3cG9ydERhdGEubGluZUhlaWdodCAqIGRwciAtIChnbHlwaC5mb250Qm91bmRpbmdCb3hBc2NlbnQgKyBnbHlwaC5mb250Qm91bmRpbmdCb3hEZXNjZW50KSkgLyAyKSArXG5cblx0XHRcdFx0XHRcdC8vIERlbHRhIGZyb20gdG9wIG9mIGlubGluZSBib3ggKG5vIGxpbmUgaGVpZ2h0KSB0byB0b3Agb2YgZ2x5cGggb3JpZ2luLiBJZiB0aGUgZ2x5cGggd2FzIGRyYXduXG5cdFx0XHRcdFx0XHQvLyB3aXRoIGEgdG9wIGJhc2VsaW5lIGZvciBleGFtcGxlLCB0aGlzIGVuZHMgdXAgZHJhd2luZyB0aGUgZ2x5cGggY29ycmVjdGx5IHVzaW5nIHRoZSBhbHBoYWJldGljYWxcblx0XHRcdFx0XHRcdC8vIGJhc2VsaW5lLlxuXHRcdFx0XHRcdFx0Z2x5cGguZm9udEJvdW5kaW5nQm94QXNjZW50XG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdGNlbGxJbmRleCA9ICgoeSAtIHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIpICogVmlld3BvcnRSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICsgeCkgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlcltjZWxsSW5kZXggKyBDZWxsQnVmZmVySW5mby5PZmZzZXRfWF0gPSBNYXRoLmZsb29yKGFic29sdXRlT2Zmc2V0WCk7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlcltjZWxsSW5kZXggKyBDZWxsQnVmZmVySW5mby5PZmZzZXRfWV0gPSBhYnNvbHV0ZU9mZnNldFk7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlcltjZWxsSW5kZXggKyBDZWxsQnVmZmVySW5mby5HbHlwaEluZGV4XSA9IGdseXBoLmdseXBoSW5kZXg7XG5cdFx0XHRcdFx0Y2VsbEJ1ZmZlcltjZWxsSW5kZXggKyBDZWxsQnVmZmVySW5mby5UZXh0dXJlSW5kZXhdID0gZ2x5cGgucGFnZUluZGV4O1xuXG5cdFx0XHRcdFx0Ly8gQWRqdXN0IHRoZSB4IHBpeGVsIG9mZnNldCBmb3IgdGhlIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdFx0YWJzb2x1dGVPZmZzZXRYICs9IGNoYXJXaWR0aDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRva2VuU3RhcnRJbmRleCA9IHRva2VuRW5kSW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENsZWFyIHRvIGVuZCBvZiBsaW5lXG5cdFx0XHRmaWxsU3RhcnRJbmRleCA9ICgoeSAtIHZpZXdwb3J0RGF0YS5zdGFydExpbmVOdW1iZXIpICogVmlld3BvcnRSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zICsgdG9rZW5FbmRJbmRleCkgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRmaWxsRW5kSW5kZXggPSAoKHkgLSB2aWV3cG9ydERhdGEuc3RhcnRMaW5lTnVtYmVyKSAqIFZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kubWF4U3VwcG9ydGVkQ29sdW1ucykgKiBDb25zdGFudHMuSW5kaWNlc1BlckNlbGw7XG5cdFx0XHRjZWxsQnVmZmVyLmZpbGwoMCwgZmlsbFN0YXJ0SW5kZXgsIGZpbGxFbmRJbmRleCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZU9iamVjdENvdW50ID0gKHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyIC0gdmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlciArIDEpICogbGluZUluZGV4Q291bnQ7XG5cblx0XHQvLyBUaGlzIHJlbmRlciBzdHJhdGVneSBhbHdheXMgdXBsb2FkcyB0aGUgd2hvbGUgdmlld3BvcnRcblx0XHR0aGlzLl9kZXZpY2UucXVldWUud3JpdGVCdWZmZXIoXG5cdFx0XHR0aGlzLl9jZWxsQmluZEJ1ZmZlcixcblx0XHRcdDAsXG5cdFx0XHRjZWxsQnVmZmVyLmJ1ZmZlcixcblx0XHRcdDAsXG5cdFx0XHQodmlld3BvcnREYXRhLmVuZExpbmVOdW1iZXIgLSB2aWV3cG9ydERhdGEuc3RhcnRMaW5lTnVtYmVyKSAqIGxpbmVJbmRleENvdW50ICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UXG5cdFx0KTtcblxuXHRcdHRoaXMuX2FjdGl2ZURvdWJsZUJ1ZmZlckluZGV4ID0gdGhpcy5fYWN0aXZlRG91YmxlQnVmZmVySW5kZXggPyAwIDogMTtcblxuXHRcdHRoaXMuX3Zpc2libGVPYmplY3RDb3VudCA9IHZpc2libGVPYmplY3RDb3VudDtcblxuXHRcdHJldHVybiB2aXNpYmxlT2JqZWN0Q291bnQ7XG5cdH1cblxuXHRkcmF3KHBhc3M6IEdQVVJlbmRlclBhc3NFbmNvZGVyLCB2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92aXNpYmxlT2JqZWN0Q291bnQgPD0gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignQXR0ZW1wdCB0byBkcmF3IDAgb2JqZWN0cycpO1xuXHRcdH1cblx0XHRwYXNzLmRyYXcocXVhZFZlcnRpY2VzLmxlbmd0aCAvIDIsIHRoaXMuX3Zpc2libGVPYmplY3RDb3VudCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcGFyc2VDc3NGb250V2VpZ2h0KHZhbHVlOiBzdHJpbmcpIHtcblx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdGNhc2UgJ2xpZ2h0ZXInOlxuXHRcdGNhc2UgJ25vcm1hbCc6IHJldHVybiA0MDA7XG5cdFx0Y2FzZSAnYm9sZGVyJzpcblx0XHRjYXNlICdib2xkJzogcmV0dXJuIDcwMDtcblx0fVxuXHRyZXR1cm4gcGFyc2VJbnQodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBwYXJzZUNzc09wYWNpdHkodmFsdWU6IHN0cmluZyk6IG51bWJlciB7XG5cdGlmICh2YWx1ZS5lbmRzV2l0aCgnJScpKSB7XG5cdFx0cmV0dXJuIHBhcnNlRmxvYXQodmFsdWUuc3Vic3RyaW5nKDAsIHZhbHVlLmxlbmd0aCAtIDEpKSAvIDEwMDtcblx0fVxuXHRpZiAodmFsdWUubWF0Y2goL15cXGQrKD86XFwuXFxkKikvKSkge1xuXHRcdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKTtcblx0fVxuXHRyZXR1cm4gMTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxxQkFBcUI7QUFROUIsU0FBUyw4QkFBc0Q7QUFDL0QsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQ0FBa0M7QUFFM0MsSUFBVyxZQUFYLGtCQUFXQSxlQUFYO0FBQ0MsRUFBQUEsc0JBQUEsb0JBQWlCLEtBQWpCO0FBQ0EsRUFBQUEsc0JBQUEscUNBQWtDLE1BQWxDO0FBQ0EsRUFBQUEsc0JBQUEsbUNBQWdDLE1BQWhDO0FBSFUsU0FBQUE7QUFBQSxHQUFBO0FBTVgsSUFBVyxpQkFBWCxrQkFBV0Msb0JBQVg7QUFDQyxFQUFBQSxnQ0FBQSxvQkFBaUIsS0FBakI7QUFDQSxFQUFBQSxnQ0FBQSxtQkFBZ0IsTUFBaEI7QUFDQSxFQUFBQSxnQ0FBQSxjQUFXLEtBQVg7QUFDQSxFQUFBQSxnQ0FBQSxjQUFXLEtBQVg7QUFDQSxFQUFBQSxnQ0FBQSxvQkFBaUIsS0FBakI7QUFDQSxFQUFBQSxnQ0FBQSxvQkFBaUIsS0FBakI7QUFDQSxFQUFBQSxnQ0FBQSxnQkFBYSxLQUFiO0FBQ0EsRUFBQUEsZ0NBQUEsa0JBQWUsS0FBZjtB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
