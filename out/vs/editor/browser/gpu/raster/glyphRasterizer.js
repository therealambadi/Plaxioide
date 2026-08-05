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
import { memoize } from "../../../../base/common/decorators.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { StringBuilder } from "../../../common/core/stringBuilder.js";
import { FontStyle, TokenMetadata } from "../../../common/encodedTokenAttributes.js";
import { ensureNonNullable } from "../gpuUtils.js";
import { ViewGpuContext } from "../viewGpuContext.js";
let nextId = 0;
class GlyphRasterizer extends Disposable {
  constructor(fontSize, fontFamily, devicePixelRatio) {
    super();
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.devicePixelRatio = devicePixelRatio;
    this.id = nextId++;
    this._workGlyph = {
      source: null,
      boundingBox: {
        left: 0,
        bottom: 0,
        right: 0,
        top: 0
      },
      originOffset: {
        x: 0,
        y: 0
      },
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0
    };
    this._workGlyphConfig = { chars: void 0, tokenMetadata: 0, decorationStyleSetId: 0 };
    // TODO: Support workbench.fontAliasing correctly
    this._antiAliasing = isMacintosh ? "greyscale" : "subpixel";
    const devicePixelFontSize = Math.ceil(this.fontSize * devicePixelRatio);
    this._canvas = new OffscreenCanvas(devicePixelFontSize * 3, devicePixelFontSize * 3);
    this._ctx = ensureNonNullable(this._canvas.getContext("2d", {
      willReadFrequently: true,
      alpha: this._antiAliasing === "greyscale"
    }));
    this._ctx.textBaseline = "top";
    this._ctx.fillStyle = "#FFFFFF";
    this._ctx.font = `${devicePixelFontSize}px ${this.fontFamily}`;
    this._textMetrics = this._ctx.measureText("A");
  }
  get cacheKey() {
    return `${this.fontFamily}_${this.fontSize}px`;
  }
  /**
   * Rasterizes a glyph. Note that the returned object is reused across different glyphs and
   * therefore is only safe for synchronous access.
   */
  rasterizeGlyph(chars, tokenMetadata, decorationStyleSetId, colorMap) {
    if (chars === "") {
      return {
        source: this._canvas,
        boundingBox: { top: 0, left: 0, bottom: -1, right: -1 },
        originOffset: { x: 0, y: 0 },
        fontBoundingBoxAscent: 0,
        fontBoundingBoxDescent: 0
      };
    }
    if (this._workGlyphConfig.chars === chars && this._workGlyphConfig.tokenMetadata === tokenMetadata && this._workGlyphConfig.decorationStyleSetId === decorationStyleSetId) {
      return this._workGlyph;
    }
    this._workGlyphConfig.chars = chars;
    this._workGlyphConfig.tokenMetadata = tokenMetadata;
    this._workGlyphConfig.decorationStyleSetId = decorationStyleSetId;
    return this._rasterizeGlyph(chars, tokenMetadata, decorationStyleSetId, colorMap);
  }
  _rasterizeGlyph(chars, tokenMetadata, decorationStyleSetId, colorMap) {
    const devicePixelFontSize = Math.ceil(this.fontSize * this.devicePixelRatio);
    const canvasDim = devicePixelFontSize * 3;
    if (this._canvas.width !== canvasDim) {
      this._canvas.width = canvasDim;
      this._canvas.height = canvasDim;
    }
    this._ctx.save();
    const xSubPixelXOffset = (tokenMetadata & 15) / 10;
    const bgId = TokenMetadata.getBackground(tokenMetadata);
    const bg = colorMap[bgId];
    const decorationStyleSet = ViewGpuContext.decorationStyleCache.getStyleSet(decorationStyleSetId);
    if (this._antiAliasing === "subpixel") {
      this._ctx.fillStyle = bg;
      this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    } else {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
    const fontSb = new StringBuilder(200);
    const fontStyle = TokenMetadata.getFontStyle(tokenMetadata);
    if (fontStyle & FontStyle.Italic) {
      fontSb.appendString("italic ");
    }
    if (decorationStyleSet?.bold !== void 0) {
      if (decorationStyleSet.bold) {
        fontSb.appendString("bold ");
      }
    } else if (fontStyle & FontStyle.Bold) {
      fontSb.appendString("bold ");
    }
    fontSb.appendString(`${devicePixelFontSize}px ${this.fontFamily}`);
    this._ctx.font = fontSb.build();
    const originX = devicePixelFontSize;
    const originY = devicePixelFontSize;
    if (decorationStyleSet?.color !== void 0) {
      this._ctx.fillStyle = `#${decorationStyleSet.color.toString(16).padStart(8, "0")}`;
    } else {
      this._ctx.fillStyle = colorMap[TokenMetadata.getForeground(tokenMetadata)];
    }
    this._ctx.textBaseline = "top";
    if (decorationStyleSet?.opacity !== void 0) {
      this._ctx.globalAlpha = decorationStyleSet.opacity;
    }
    this._ctx.fillText(chars, originX + xSubPixelXOffset, originY);
    this._ctx.restore();
    const imageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
    if (this._antiAliasing === "subpixel") {
      const bgR = parseInt(bg.substring(1, 3), 16);
      const bgG = parseInt(bg.substring(3, 5), 16);
      const bgB = parseInt(bg.substring(5, 7), 16);
      this._clearColor(imageData, bgR, bgG, bgB);
      this._ctx.putImageData(imageData, 0, 0);
    }
    this._findGlyphBoundingBox(imageData, this._workGlyph.boundingBox);
    this._workGlyph.source = this._canvas;
    this._workGlyph.originOffset.x = this._workGlyph.boundingBox.left - originX;
    this._workGlyph.originOffset.y = this._workGlyph.boundingBox.top - originY;
    this._workGlyph.fontBoundingBoxAscent = this._textMetrics.fontBoundingBoxAscent;
    this._workGlyph.fontBoundingBoxDescent = this._textMetrics.fontBoundingBoxDescent;
    return this._workGlyph;
  }
  _clearColor(imageData, r, g, b) {
    for (let offset = 0; offset < imageData.data.length; offset += 4) {
      if (imageData.data[offset] === r && imageData.data[offset + 1] === g && imageData.data[offset + 2] === b) {
        imageData.data[offset + 3] = 0;
      }
    }
  }
  // TODO: Does this even need to happen when measure text is used?
  _findGlyphBoundingBox(imageData, outBoundingBox) {
    const height = this._canvas.height;
    const width = this._canvas.width;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          outBoundingBox.top = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    outBoundingBox.left = 0;
    found = false;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          outBoundingBox.left = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    outBoundingBox.right = width;
    found = false;
    for (let x = width - 1; x >= outBoundingBox.left; x--) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          outBoundingBox.right = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    outBoundingBox.bottom = outBoundingBox.top;
    found = false;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          outBoundingBox.bottom = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
  }
  getTextMetrics(text) {
    return this._ctx.measureText(text);
  }
}
__decorateClass([
  memoize
], GlyphRasterizer.prototype, "cacheKey", 1);
export {
  GlyphRasterizer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvcmFzdGVyL2dseXBoUmFzdGVyaXplci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTdHJpbmdCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc3RyaW5nQnVpbGRlci5qcyc7XG5pbXBvcnQgeyBGb250U3R5bGUsIFRva2VuTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb25OdWxsYWJsZSB9IGZyb20gJy4uL2dwdVV0aWxzLmpzJztcbmltcG9ydCB7IFZpZXdHcHVDb250ZXh0IH0gZnJvbSAnLi4vdmlld0dwdUNvbnRleHQuanMnO1xuaW1wb3J0IHsgdHlwZSBJQm91bmRpbmdCb3gsIHR5cGUgSUdseXBoUmFzdGVyaXplciwgdHlwZSBJUmFzdGVyaXplZEdseXBoIH0gZnJvbSAnLi9yYXN0ZXIuanMnO1xuXG5sZXQgbmV4dElkID0gMDtcblxuZXhwb3J0IGNsYXNzIEdseXBoUmFzdGVyaXplciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJR2x5cGhSYXN0ZXJpemVyIHtcblx0cHVibGljIHJlYWRvbmx5IGlkID0gbmV4dElkKys7XG5cblx0QG1lbW9pemVcblx0cHVibGljIGdldCBjYWNoZUtleSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHt0aGlzLmZvbnRGYW1pbHl9XyR7dGhpcy5mb250U2l6ZX1weGA7XG5cdH1cblxuXHRwcml2YXRlIF9jYW52YXM6IE9mZnNjcmVlbkNhbnZhcztcblx0cHJpdmF0ZSBfY3R4OiBPZmZzY3JlZW5DYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdGV4dE1ldHJpY3M6IFRleHRNZXRyaWNzO1xuXG5cdHByaXZhdGUgX3dvcmtHbHlwaDogSVJhc3Rlcml6ZWRHbHlwaCA9IHtcblx0XHRzb3VyY2U6IG51bGwhLFxuXHRcdGJvdW5kaW5nQm94OiB7XG5cdFx0XHRsZWZ0OiAwLFxuXHRcdFx0Ym90dG9tOiAwLFxuXHRcdFx0cmlnaHQ6IDAsXG5cdFx0XHR0b3A6IDAsXG5cdFx0fSxcblx0XHRvcmlnaW5PZmZzZXQ6IHtcblx0XHRcdHg6IDAsXG5cdFx0XHR5OiAwLFxuXHRcdH0sXG5cdFx0Zm9udEJvdW5kaW5nQm94QXNjZW50OiAwLFxuXHRcdGZvbnRCb3VuZGluZ0JveERlc2NlbnQ6IDAsXG5cdH07XG5cdHByaXZhdGUgX3dvcmtHbHlwaENvbmZpZzogeyBjaGFyczogc3RyaW5nIHwgdW5kZWZpbmVkOyB0b2tlbk1ldGFkYXRhOiBudW1iZXI7IGRlY29yYXRpb25TdHlsZVNldElkOiBudW1iZXIgfSA9IHsgY2hhcnM6IHVuZGVmaW5lZCwgdG9rZW5NZXRhZGF0YTogMCwgZGVjb3JhdGlvblN0eWxlU2V0SWQ6IDAgfTtcblxuXHQvLyBUT0RPOiBTdXBwb3J0IHdvcmtiZW5jaC5mb250QWxpYXNpbmcgY29ycmVjdGx5XG5cdHByaXZhdGUgX2FudGlBbGlhc2luZzogJ3N1YnBpeGVsJyB8ICdncmV5c2NhbGUnID0gaXNNYWNpbnRvc2ggPyAnZ3JleXNjYWxlJyA6ICdzdWJwaXhlbCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgZm9udFNpemU6IG51bWJlcixcblx0XHRyZWFkb25seSBmb250RmFtaWx5OiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgZGV2aWNlUGl4ZWxSYXRpbzogbnVtYmVyXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBkZXZpY2VQaXhlbEZvbnRTaXplID0gTWF0aC5jZWlsKHRoaXMuZm9udFNpemUgKiBkZXZpY2VQaXhlbFJhdGlvKTtcblx0XHR0aGlzLl9jYW52YXMgPSBuZXcgT2Zmc2NyZWVuQ2FudmFzKGRldmljZVBpeGVsRm9udFNpemUgKiAzLCBkZXZpY2VQaXhlbEZvbnRTaXplICogMyk7XG5cdFx0dGhpcy5fY3R4ID0gZW5zdXJlTm9uTnVsbGFibGUodGhpcy5fY2FudmFzLmdldENvbnRleHQoJzJkJywge1xuXHRcdFx0d2lsbFJlYWRGcmVxdWVudGx5OiB0cnVlLFxuXHRcdFx0YWxwaGE6IHRoaXMuX2FudGlBbGlhc2luZyA9PT0gJ2dyZXlzY2FsZScsXG5cdFx0fSkpO1xuXHRcdHRoaXMuX2N0eC50ZXh0QmFzZWxpbmUgPSAndG9wJztcblx0XHR0aGlzLl9jdHguZmlsbFN0eWxlID0gJyNGRkZGRkYnO1xuXHRcdHRoaXMuX2N0eC5mb250ID0gYCR7ZGV2aWNlUGl4ZWxGb250U2l6ZX1weCAke3RoaXMuZm9udEZhbWlseX1gO1xuXHRcdHRoaXMuX3RleHRNZXRyaWNzID0gdGhpcy5fY3R4Lm1lYXN1cmVUZXh0KCdBJyk7XG5cdH1cblxuXHQvKipcblx0ICogUmFzdGVyaXplcyBhIGdseXBoLiBOb3RlIHRoYXQgdGhlIHJldHVybmVkIG9iamVjdCBpcyByZXVzZWQgYWNyb3NzIGRpZmZlcmVudCBnbHlwaHMgYW5kXG5cdCAqIHRoZXJlZm9yZSBpcyBvbmx5IHNhZmUgZm9yIHN5bmNocm9ub3VzIGFjY2Vzcy5cblx0ICovXG5cdHB1YmxpYyByYXN0ZXJpemVHbHlwaChcblx0XHRjaGFyczogc3RyaW5nLFxuXHRcdHRva2VuTWV0YWRhdGE6IG51bWJlcixcblx0XHRkZWNvcmF0aW9uU3R5bGVTZXRJZDogbnVtYmVyLFxuXHRcdGNvbG9yTWFwOiBzdHJpbmdbXSxcblx0KTogUmVhZG9ubHk8SVJhc3Rlcml6ZWRHbHlwaD4ge1xuXHRcdGlmIChjaGFycyA9PT0gJycpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHNvdXJjZTogdGhpcy5fY2FudmFzLFxuXHRcdFx0XHRib3VuZGluZ0JveDogeyB0b3A6IDAsIGxlZnQ6IDAsIGJvdHRvbTogLTEsIHJpZ2h0OiAtMSB9LFxuXHRcdFx0XHRvcmlnaW5PZmZzZXQ6IHsgeDogMCwgeTogMCB9LFxuXHRcdFx0XHRmb250Qm91bmRpbmdCb3hBc2NlbnQ6IDAsXG5cdFx0XHRcdGZvbnRCb3VuZGluZ0JveERlc2NlbnQ6IDAsXG5cdFx0XHR9O1xuXHRcdH1cblx0XHQvLyBDaGVjayBpZiB0aGUgbGFzdCBnbHlwaCBtYXRjaGVzIHRoZSBjb25maWcsIHJldXNlIGlmIHNvLiBUaGlzIGhlbHBzIGF2b2lkIHVubmVjZXNzYXJ5XG5cdFx0Ly8gd29yayB3aGVuIHRoZSByYXN0ZXJpemVyIGlzIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyBsaWtlIHdoZW4gdGhlIGdseXBoIGRvZXNuJ3QgZml0IGludG8gYVxuXHRcdC8vIHBhZ2UuXG5cdFx0aWYgKHRoaXMuX3dvcmtHbHlwaENvbmZpZy5jaGFycyA9PT0gY2hhcnMgJiYgdGhpcy5fd29ya0dseXBoQ29uZmlnLnRva2VuTWV0YWRhdGEgPT09IHRva2VuTWV0YWRhdGEgJiYgdGhpcy5fd29ya0dseXBoQ29uZmlnLmRlY29yYXRpb25TdHlsZVNldElkID09PSBkZWNvcmF0aW9uU3R5bGVTZXRJZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3dvcmtHbHlwaDtcblx0XHR9XG5cdFx0dGhpcy5fd29ya0dseXBoQ29uZmlnLmNoYXJzID0gY2hhcnM7XG5cdFx0dGhpcy5fd29ya0dseXBoQ29uZmlnLnRva2VuTWV0YWRhdGEgPSB0b2tlbk1ldGFkYXRhO1xuXHRcdHRoaXMuX3dvcmtHbHlwaENvbmZpZy5kZWNvcmF0aW9uU3R5bGVTZXRJZCA9IGRlY29yYXRpb25TdHlsZVNldElkO1xuXHRcdHJldHVybiB0aGlzLl9yYXN0ZXJpemVHbHlwaChjaGFycywgdG9rZW5NZXRhZGF0YSwgZGVjb3JhdGlvblN0eWxlU2V0SWQsIGNvbG9yTWFwKTtcblx0fVxuXG5cdHB1YmxpYyBfcmFzdGVyaXplR2x5cGgoXG5cdFx0Y2hhcnM6IHN0cmluZyxcblx0XHR0b2tlbk1ldGFkYXRhOiBudW1iZXIsXG5cdFx0ZGVjb3JhdGlvblN0eWxlU2V0SWQ6IG51bWJlcixcblx0XHRjb2xvck1hcDogc3RyaW5nW10sXG5cdCk6IFJlYWRvbmx5PElSYXN0ZXJpemVkR2x5cGg+IHtcblx0XHRjb25zdCBkZXZpY2VQaXhlbEZvbnRTaXplID0gTWF0aC5jZWlsKHRoaXMuZm9udFNpemUgKiB0aGlzLmRldmljZVBpeGVsUmF0aW8pO1xuXHRcdGNvbnN0IGNhbnZhc0RpbSA9IGRldmljZVBpeGVsRm9udFNpemUgKiAzO1xuXHRcdGlmICh0aGlzLl9jYW52YXMud2lkdGggIT09IGNhbnZhc0RpbSkge1xuXHRcdFx0dGhpcy5fY2FudmFzLndpZHRoID0gY2FudmFzRGltO1xuXHRcdFx0dGhpcy5fY2FudmFzLmhlaWdodCA9IGNhbnZhc0RpbTtcblx0XHR9XG5cblx0XHR0aGlzLl9jdHguc2F2ZSgpO1xuXG5cdFx0Ly8gVGhlIHN1Yi1waXhlbCB4IG9mZnNldCBpcyB0aGUgZnJhY3Rpb25hbCBwYXJ0IG9mIHRoZSB4IHBpeGVsIGNvb3JkaW5hdGUgb2YgdGhlIGNlbGwsIHRoaXNcblx0XHQvLyBpcyB1c2VkIHRvIGltcHJvdmUgdGhlIHNwYWNpbmcgYmV0d2VlbiByZW5kZXJlZCBjaGFyYWN0ZXJzLlxuXHRcdGNvbnN0IHhTdWJQaXhlbFhPZmZzZXQgPSAodG9rZW5NZXRhZGF0YSAmIDBiMTExMSkgLyAxMDtcblxuXHRcdGNvbnN0IGJnSWQgPSBUb2tlbk1ldGFkYXRhLmdldEJhY2tncm91bmQodG9rZW5NZXRhZGF0YSk7XG5cdFx0Y29uc3QgYmcgPSBjb2xvck1hcFtiZ0lkXTtcblxuXHRcdGNvbnN0IGRlY29yYXRpb25TdHlsZVNldCA9IFZpZXdHcHVDb250ZXh0LmRlY29yYXRpb25TdHlsZUNhY2hlLmdldFN0eWxlU2V0KGRlY29yYXRpb25TdHlsZVNldElkKTtcblxuXHRcdC8vIFdoZW4gU1BBQSBpcyB1c2VkLCB0aGUgYmFja2dyb3VuZCBjb2xvciBtdXN0IGJlIHByZXNlbnQgdG8gZ2V0IHRoZSByaWdodCBnbHlwaFxuXHRcdGlmICh0aGlzLl9hbnRpQWxpYXNpbmcgPT09ICdzdWJwaXhlbCcpIHtcblx0XHRcdHRoaXMuX2N0eC5maWxsU3R5bGUgPSBiZztcblx0XHRcdHRoaXMuX2N0eC5maWxsUmVjdCgwLCAwLCB0aGlzLl9jYW52YXMud2lkdGgsIHRoaXMuX2NhbnZhcy5oZWlnaHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMuX2NhbnZhcy53aWR0aCwgdGhpcy5fY2FudmFzLmhlaWdodCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9udFNiID0gbmV3IFN0cmluZ0J1aWxkZXIoMjAwKTtcblx0XHRjb25zdCBmb250U3R5bGUgPSBUb2tlbk1ldGFkYXRhLmdldEZvbnRTdHlsZSh0b2tlbk1ldGFkYXRhKTtcblx0XHRpZiAoZm9udFN0eWxlICYgRm9udFN0eWxlLkl0YWxpYykge1xuXHRcdFx0Zm9udFNiLmFwcGVuZFN0cmluZygnaXRhbGljICcpO1xuXHRcdH1cblx0XHRpZiAoZGVjb3JhdGlvblN0eWxlU2V0Py5ib2xkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChkZWNvcmF0aW9uU3R5bGVTZXQuYm9sZCkge1xuXHRcdFx0XHRmb250U2IuYXBwZW5kU3RyaW5nKCdib2xkICcpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZm9udFN0eWxlICYgRm9udFN0eWxlLkJvbGQpIHtcblx0XHRcdGZvbnRTYi5hcHBlbmRTdHJpbmcoJ2JvbGQgJyk7XG5cdFx0fVxuXHRcdGZvbnRTYi5hcHBlbmRTdHJpbmcoYCR7ZGV2aWNlUGl4ZWxGb250U2l6ZX1weCAke3RoaXMuZm9udEZhbWlseX1gKTtcblx0XHR0aGlzLl9jdHguZm9udCA9IGZvbnRTYi5idWlsZCgpO1xuXG5cdFx0Ly8gVE9ETzogU3VwcG9ydCBGb250U3R5bGUuU3RyaWtldGhyb3VnaCBhbmQgRm9udFN0eWxlLlVuZGVybGluZSB0ZXh0IGRlY29yYXRpb25zLCB0aGVzZVxuXHRcdC8vICAgICAgIG5lZWQgdG8gYmUgZHJhd24gbWFudWFsbHkgdG8gdGhlIGNhbnZhcy4gU2VlIHh0ZXJtLmpzIGZvciBcImRvZGdpbmdcIiB0aGUgdGV4dCBmb3Jcblx0XHQvLyAgICAgICB1bmRlcmxpbmVzLlxuXG5cdFx0Y29uc3Qgb3JpZ2luWCA9IGRldmljZVBpeGVsRm9udFNpemU7XG5cdFx0Y29uc3Qgb3JpZ2luWSA9IGRldmljZVBpeGVsRm9udFNpemU7XG5cdFx0aWYgKGRlY29yYXRpb25TdHlsZVNldD8uY29sb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fY3R4LmZpbGxTdHlsZSA9IGAjJHtkZWNvcmF0aW9uU3R5bGVTZXQuY29sb3IudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDgsICcwJyl9YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY3R4LmZpbGxTdHlsZSA9IGNvbG9yTWFwW1Rva2VuTWV0YWRhdGEuZ2V0Rm9yZWdyb3VuZCh0b2tlbk1ldGFkYXRhKV07XG5cdFx0fVxuXHRcdHRoaXMuX2N0eC50ZXh0QmFzZWxpbmUgPSAndG9wJztcblxuXHRcdGlmIChkZWNvcmF0aW9uU3R5bGVTZXQ/Lm9wYWNpdHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fY3R4Lmdsb2JhbEFscGhhID0gZGVjb3JhdGlvblN0eWxlU2V0Lm9wYWNpdHk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3R4LmZpbGxUZXh0KGNoYXJzLCBvcmlnaW5YICsgeFN1YlBpeGVsWE9mZnNldCwgb3JpZ2luWSk7XG5cdFx0dGhpcy5fY3R4LnJlc3RvcmUoKTtcblxuXHRcdGNvbnN0IGltYWdlRGF0YSA9IHRoaXMuX2N0eC5nZXRJbWFnZURhdGEoMCwgMCwgdGhpcy5fY2FudmFzLndpZHRoLCB0aGlzLl9jYW52YXMuaGVpZ2h0KTtcblx0XHRpZiAodGhpcy5fYW50aUFsaWFzaW5nID09PSAnc3VicGl4ZWwnKSB7XG5cdFx0XHRjb25zdCBiZ1IgPSBwYXJzZUludChiZy5zdWJzdHJpbmcoMSwgMyksIDE2KTtcblx0XHRcdGNvbnN0IGJnRyA9IHBhcnNlSW50KGJnLnN1YnN0cmluZygzLCA1KSwgMTYpO1xuXHRcdFx0Y29uc3QgYmdCID0gcGFyc2VJbnQoYmcuc3Vic3RyaW5nKDUsIDcpLCAxNik7XG5cdFx0XHR0aGlzLl9jbGVhckNvbG9yKGltYWdlRGF0YSwgYmdSLCBiZ0csIGJnQik7XG5cdFx0XHR0aGlzLl9jdHgucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cdFx0fVxuXHRcdHRoaXMuX2ZpbmRHbHlwaEJvdW5kaW5nQm94KGltYWdlRGF0YSwgdGhpcy5fd29ya0dseXBoLmJvdW5kaW5nQm94KTtcblx0XHQvLyBjb25zdCBvZmZzZXQgPSB7XG5cdFx0Ly8gXHR4OiB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveExlZnQsXG5cdFx0Ly8gXHR5OiB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveEFzY2VudFxuXHRcdC8vIH07XG5cdFx0Ly8gY29uc3Qgc2l6ZSA9IHtcblx0XHQvLyBcdHc6IHRleHRNZXRyaWNzLmFjdHVhbEJvdW5kaW5nQm94UmlnaHQgKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveExlZnQsXG5cdFx0Ly8gXHR5OiB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveERlc2NlbnQgKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveEFzY2VudCxcblx0XHQvLyBcdHdJbnQ6IE1hdGguY2VpbCh0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveFJpZ2h0ICsgdGV4dE1ldHJpY3MuYWN0dWFsQm91bmRpbmdCb3hMZWZ0KSxcblx0XHQvLyBcdHlJbnQ6IE1hdGguY2VpbCh0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveERlc2NlbnQgKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveEFzY2VudCksXG5cdFx0Ly8gfTtcblx0XHQvLyBjb25zb2xlLmxvZyhgJHtjaGFyc31fJHtmZ31gLCB0ZXh0TWV0cmljcywgYm91bmRpbmdCb3gsIG9yaWdpblgsIG9yaWdpblksIHsgd2lkdGg6IGJvdW5kaW5nQm94LnJpZ2h0IC0gYm91bmRpbmdCb3gubGVmdCwgaGVpZ2h0OiBib3VuZGluZ0JveC5ib3R0b20gLSBib3VuZGluZ0JveC50b3AgfSk7XG5cdFx0dGhpcy5fd29ya0dseXBoLnNvdXJjZSA9IHRoaXMuX2NhbnZhcztcblx0XHR0aGlzLl93b3JrR2x5cGgub3JpZ2luT2Zmc2V0LnggPSB0aGlzLl93b3JrR2x5cGguYm91bmRpbmdCb3gubGVmdCAtIG9yaWdpblg7XG5cdFx0dGhpcy5fd29ya0dseXBoLm9yaWdpbk9mZnNldC55ID0gdGhpcy5fd29ya0dseXBoLmJvdW5kaW5nQm94LnRvcCAtIG9yaWdpblk7XG5cdFx0dGhpcy5fd29ya0dseXBoLmZvbnRCb3VuZGluZ0JveEFzY2VudCA9IHRoaXMuX3RleHRNZXRyaWNzLmZvbnRCb3VuZGluZ0JveEFzY2VudDtcblx0XHR0aGlzLl93b3JrR2x5cGguZm9udEJvdW5kaW5nQm94RGVzY2VudCA9IHRoaXMuX3RleHRNZXRyaWNzLmZvbnRCb3VuZGluZ0JveERlc2NlbnQ7XG5cblx0XHQvLyBjb25zdCByZXN1bHQyOiBJUmFzdGVyaXplZEdseXBoID0ge1xuXHRcdC8vIFx0c291cmNlOiB0aGlzLl9jYW52YXMsXG5cdFx0Ly8gXHRib3VuZGluZ0JveDoge1xuXHRcdC8vIFx0XHRsZWZ0OiBNYXRoLmZsb29yKG9yaWdpblggLSB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveExlZnQpLFxuXHRcdC8vIFx0XHRyaWdodDogTWF0aC5jZWlsKG9yaWdpblggKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveFJpZ2h0KSxcblx0XHQvLyBcdFx0dG9wOiBNYXRoLmZsb29yKG9yaWdpblkgLSB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveEFzY2VudCksXG5cdFx0Ly8gXHRcdGJvdHRvbTogTWF0aC5jZWlsKG9yaWdpblkgKyB0ZXh0TWV0cmljcy5hY3R1YWxCb3VuZGluZ0JveERlc2NlbnQpLFxuXHRcdC8vIFx0fSxcblx0XHQvLyBcdG9yaWdpbk9mZnNldDoge1xuXHRcdC8vIFx0XHR4OiBNYXRoLmZsb29yKGJvdW5kaW5nQm94LmxlZnQgLSBvcmlnaW5YKSxcblx0XHQvLyBcdFx0eTogTWF0aC5mbG9vcihib3VuZGluZ0JveC50b3AgLSBvcmlnaW5ZKVxuXHRcdC8vIFx0fVxuXHRcdC8vIH07XG5cblx0XHQvLyBUT0RPOiBWZXJpZnkgcmVzdWx0IDEgYW5kIDIgYXJlIHRoZSBzYW1lXG5cblx0XHQvLyBpZiAocmVzdWx0Mi5ib3VuZGluZ0JveC5sZWZ0ID4gcmVzdWx0LmJvdW5kaW5nQm94LmxlZnQpIHtcblx0XHQvLyBcdGRlYnVnZ2VyO1xuXHRcdC8vIH1cblx0XHQvLyBpZiAocmVzdWx0Mi5ib3VuZGluZ0JveC50b3AgPiByZXN1bHQuYm91bmRpbmdCb3gudG9wKSB7XG5cdFx0Ly8gXHRkZWJ1Z2dlcjtcblx0XHQvLyB9XG5cdFx0Ly8gaWYgKHJlc3VsdDIuYm91bmRpbmdCb3gucmlnaHQgPCByZXN1bHQuYm91bmRpbmdCb3gucmlnaHQpIHtcblx0XHQvLyBcdGRlYnVnZ2VyO1xuXHRcdC8vIH1cblx0XHQvLyBpZiAocmVzdWx0Mi5ib3VuZGluZ0JveC5ib3R0b20gPCByZXN1bHQuYm91bmRpbmdCb3guYm90dG9tKSB7XG5cdFx0Ly8gXHRkZWJ1Z2dlcjtcblx0XHQvLyB9XG5cdFx0Ly8gaWYgKEpTT04uc3RyaW5naWZ5KHJlc3VsdDIub3JpZ2luT2Zmc2V0KSAhPT0gSlNPTi5zdHJpbmdpZnkocmVzdWx0Lm9yaWdpbk9mZnNldCkpIHtcblx0XHQvLyBcdGRlYnVnZ2VyO1xuXHRcdC8vIH1cblxuXG5cblx0XHRyZXR1cm4gdGhpcy5fd29ya0dseXBoO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJDb2xvcihpbWFnZURhdGE6IEltYWdlRGF0YSwgcjogbnVtYmVyLCBnOiBudW1iZXIsIGI6IG51bWJlcikge1xuXHRcdGZvciAobGV0IG9mZnNldCA9IDA7IG9mZnNldCA8IGltYWdlRGF0YS5kYXRhLmxlbmd0aDsgb2Zmc2V0ICs9IDQpIHtcblx0XHRcdC8vIENoZWNrIGV4YWN0IG1hdGNoXG5cdFx0XHRpZiAoaW1hZ2VEYXRhLmRhdGFbb2Zmc2V0XSA9PT0gciAmJlxuXHRcdFx0XHRpbWFnZURhdGEuZGF0YVtvZmZzZXQgKyAxXSA9PT0gZyAmJlxuXHRcdFx0XHRpbWFnZURhdGEuZGF0YVtvZmZzZXQgKyAyXSA9PT0gYikge1xuXHRcdFx0XHRpbWFnZURhdGEuZGF0YVtvZmZzZXQgKyAzXSA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gVE9ETzogRG9lcyB0aGlzIGV2ZW4gbmVlZCB0byBoYXBwZW4gd2hlbiBtZWFzdXJlIHRleHQgaXMgdXNlZD9cblx0cHJpdmF0ZSBfZmluZEdseXBoQm91bmRpbmdCb3goaW1hZ2VEYXRhOiBJbWFnZURhdGEsIG91dEJvdW5kaW5nQm94OiBJQm91bmRpbmdCb3gpIHtcblx0XHRjb25zdCBoZWlnaHQgPSB0aGlzLl9jYW52YXMuaGVpZ2h0O1xuXHRcdGNvbnN0IHdpZHRoID0gdGhpcy5fY2FudmFzLndpZHRoO1xuXHRcdGxldCBmb3VuZCA9IGZhbHNlO1xuXHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyspIHtcblx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xuXHRcdFx0XHRjb25zdCBhbHBoYU9mZnNldCA9IHkgKiB3aWR0aCAqIDQgKyB4ICogNCArIDM7XG5cdFx0XHRcdGlmIChpbWFnZURhdGEuZGF0YVthbHBoYU9mZnNldF0gIT09IDApIHtcblx0XHRcdFx0XHRvdXRCb3VuZGluZ0JveC50b3AgPSB5O1xuXHRcdFx0XHRcdGZvdW5kID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRvdXRCb3VuZGluZ0JveC5sZWZ0ID0gMDtcblx0XHRmb3VuZCA9IGZhbHNlO1xuXHRcdGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xuXHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xuXHRcdFx0XHRjb25zdCBhbHBoYU9mZnNldCA9IHkgKiB3aWR0aCAqIDQgKyB4ICogNCArIDM7XG5cdFx0XHRcdGlmIChpbWFnZURhdGEuZGF0YVthbHBoYU9mZnNldF0gIT09IDApIHtcblx0XHRcdFx0XHRvdXRCb3VuZGluZ0JveC5sZWZ0ID0geDtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0b3V0Qm91bmRpbmdCb3gucmlnaHQgPSB3aWR0aDtcblx0XHRmb3VuZCA9IGZhbHNlO1xuXHRcdGZvciAobGV0IHggPSB3aWR0aCAtIDE7IHggPj0gb3V0Qm91bmRpbmdCb3gubGVmdDsgeC0tKSB7XG5cdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG5cdFx0XHRcdGNvbnN0IGFscGhhT2Zmc2V0ID0geSAqIHdpZHRoICogNCArIHggKiA0ICsgMztcblx0XHRcdFx0aWYgKGltYWdlRGF0YS5kYXRhW2FscGhhT2Zmc2V0XSAhPT0gMCkge1xuXHRcdFx0XHRcdG91dEJvdW5kaW5nQm94LnJpZ2h0ID0geDtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0b3V0Qm91bmRpbmdCb3guYm90dG9tID0gb3V0Qm91bmRpbmdCb3gudG9wO1xuXHRcdGZvdW5kID0gZmFsc2U7XG5cdFx0Zm9yIChsZXQgeSA9IGhlaWdodCAtIDE7IHkgPj0gMDsgeS0tKSB7XG5cdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcblx0XHRcdFx0Y29uc3QgYWxwaGFPZmZzZXQgPSB5ICogd2lkdGggKiA0ICsgeCAqIDQgKyAzO1xuXHRcdFx0XHRpZiAoaW1hZ2VEYXRhLmRhdGFbYWxwaGFPZmZzZXRdICE9PSAwKSB7XG5cdFx0XHRcdFx0b3V0Qm91bmRpbmdCb3guYm90dG9tID0geTtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGV4dE1ldHJpY3ModGV4dDogc3RyaW5nKTogVGV4dE1ldHJpY3Mge1xuXHRcdHJldHVybiB0aGlzLl9jdHgubWVhc3VyZVRleHQodGV4dCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVB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
