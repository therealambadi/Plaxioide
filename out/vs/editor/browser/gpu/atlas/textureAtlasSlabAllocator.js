import { getActiveWindow } from "../../../../base/browser/dom.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { NKeyMap } from "../../../../base/common/map.js";
import { ensureNonNullable } from "../gpuUtils.js";
import { UsagePreviewColors } from "./atlas.js";
class TextureAtlasSlabAllocator {
  constructor(_canvas, _textureIndex, options) {
    this._canvas = _canvas;
    this._textureIndex = _textureIndex;
    this._slabs = [];
    this._activeSlabsByDims = new NKeyMap();
    this._unusedRects = [];
    this._openRegionsByHeight = /* @__PURE__ */ new Map();
    this._openRegionsByWidth = /* @__PURE__ */ new Map();
    /** A set of all glyphs allocated, this is only tracked to enable debug related functionality */
    this._allocatedGlyphs = /* @__PURE__ */ new Set();
    this._nextIndex = 0;
    this._ctx = ensureNonNullable(this._canvas.getContext("2d", {
      willReadFrequently: true
    }));
    this._slabW = Math.min(
      options?.slabW ?? 64 << Math.max(Math.floor(getActiveWindow().devicePixelRatio) - 1, 0),
      this._canvas.width
    );
    this._slabH = Math.min(
      options?.slabH ?? this._slabW,
      this._canvas.height
    );
    this._slabsPerRow = Math.floor(this._canvas.width / this._slabW);
    this._slabsPerColumn = Math.floor(this._canvas.height / this._slabH);
  }
  allocate(rasterizedGlyph) {
    const glyphWidth = rasterizedGlyph.boundingBox.right - rasterizedGlyph.boundingBox.left + 1;
    const glyphHeight = rasterizedGlyph.boundingBox.bottom - rasterizedGlyph.boundingBox.top + 1;
    if (glyphWidth > this._canvas.width || glyphHeight > this._canvas.height) {
      throw new BugIndicatingError("Glyph is too large for the atlas page");
    }
    if (glyphWidth > this._slabW || glyphHeight > this._slabH) {
      if (this._allocatedGlyphs.size > 0) {
        return void 0;
      }
      let sizeCandidate = this._canvas.width;
      while (glyphWidth < sizeCandidate / 2 && glyphHeight < sizeCandidate / 2) {
        sizeCandidate /= 2;
      }
      this._slabW = sizeCandidate;
      this._slabH = sizeCandidate;
      this._slabsPerRow = Math.floor(this._canvas.width / this._slabW);
      this._slabsPerColumn = Math.floor(this._canvas.height / this._slabH);
    }
    const desiredSlabSize = {
      // Nearest square number
      // TODO: This can probably be optimized
      // w: 1 << Math.ceil(Math.sqrt(glyphWidth)),
      // h: 1 << Math.ceil(Math.sqrt(glyphHeight)),
      // Nearest x px
      // w: Math.ceil(glyphWidth / nearestXPixels) * nearestXPixels,
      // h: Math.ceil(glyphHeight / nearestXPixels) * nearestXPixels,
      // Round odd numbers up
      // w: glyphWidth % 0 === 1 ? glyphWidth + 1 : glyphWidth,
      // h: glyphHeight % 0 === 1 ? glyphHeight + 1 : glyphHeight,
      // Exact number only
      w: glyphWidth,
      h: glyphHeight
    };
    let slab = this._activeSlabsByDims.get(desiredSlabSize.w, desiredSlabSize.h);
    if (slab) {
      const glyphsPerSlab = Math.floor(this._slabW / slab.entryW) * Math.floor(this._slabH / slab.entryH);
      if (slab.count >= glyphsPerSlab) {
        slab = void 0;
      }
    }
    let dx;
    let dy;
    if (!slab) {
      if (glyphWidth < glyphHeight) {
        const openRegions = this._openRegionsByWidth.get(glyphWidth);
        if (openRegions?.length) {
          for (let i = openRegions.length - 1; i >= 0; i--) {
            const r = openRegions[i];
            if (r.w >= glyphWidth && r.h >= glyphHeight) {
              dx = r.x;
              dy = r.y;
              if (glyphWidth < r.w) {
                this._unusedRects.push({
                  x: r.x + glyphWidth,
                  y: r.y,
                  w: r.w - glyphWidth,
                  h: glyphHeight
                });
              }
              r.y += glyphHeight;
              r.h -= glyphHeight;
              if (r.h === 0) {
                if (i === openRegions.length - 1) {
                  openRegions.pop();
                } else {
                  this._unusedRects.splice(i, 1);
                }
              }
              break;
            }
          }
        }
      } else {
        const openRegions = this._openRegionsByHeight.get(glyphHeight);
        if (openRegions?.length) {
          for (let i = openRegions.length - 1; i >= 0; i--) {
            const r = openRegions[i];
            if (r.w >= glyphWidth && r.h >= glyphHeight) {
              dx = r.x;
              dy = r.y;
              if (glyphHeight < r.h) {
                this._unusedRects.push({
                  x: r.x,
                  y: r.y + glyphHeight,
                  w: glyphWidth,
                  h: r.h - glyphHeight
                });
              }
              r.x += glyphWidth;
              r.w -= glyphWidth;
              if (r.h === 0) {
                if (i === openRegions.length - 1) {
                  openRegions.pop();
                } else {
                  this._unusedRects.splice(i, 1);
                }
              }
              break;
            }
          }
        }
      }
    }
    if (dx === void 0 || dy === void 0) {
      if (!slab) {
        if (this._slabs.length >= this._slabsPerRow * this._slabsPerColumn) {
          return void 0;
        }
        slab = {
          x: Math.floor(this._slabs.length % this._slabsPerRow) * this._slabW,
          y: Math.floor(this._slabs.length / this._slabsPerRow) * this._slabH,
          entryW: desiredSlabSize.w,
          entryH: desiredSlabSize.h,
          count: 0
        };
        const unusedW = this._slabW % slab.entryW;
        const unusedH = this._slabH % slab.entryH;
        if (unusedW) {
          addEntryToMapArray(this._openRegionsByWidth, unusedW, {
            x: slab.x + this._slabW - unusedW,
            w: unusedW,
            y: slab.y,
            h: this._slabH - (unusedH ?? 0)
          });
        }
        if (unusedH) {
          addEntryToMapArray(this._openRegionsByHeight, unusedH, {
            x: slab.x,
            w: this._slabW,
            y: slab.y + this._slabH - unusedH,
            h: unusedH
          });
        }
        this._slabs.push(slab);
        this._activeSlabsByDims.set(slab, desiredSlabSize.w, desiredSlabSize.h);
      }
      const glyphsPerRow = Math.floor(this._slabW / slab.entryW);
      dx = slab.x + Math.floor(slab.count % glyphsPerRow) * slab.entryW;
      dy = slab.y + Math.floor(slab.count / glyphsPerRow) * slab.entryH;
      slab.count++;
    }
    this._ctx.drawImage(
      rasterizedGlyph.source,
      // source
      rasterizedGlyph.boundingBox.left,
      rasterizedGlyph.boundingBox.top,
      glyphWidth,
      glyphHeight,
      // destination
      dx,
      dy,
      glyphWidth,
      glyphHeight
    );
    const glyph = {
      pageIndex: this._textureIndex,
      glyphIndex: this._nextIndex++,
      x: dx,
      y: dy,
      w: glyphWidth,
      h: glyphHeight,
      originOffsetX: rasterizedGlyph.originOffset.x,
      originOffsetY: rasterizedGlyph.originOffset.y,
      fontBoundingBoxAscent: rasterizedGlyph.fontBoundingBoxAscent,
      fontBoundingBoxDescent: rasterizedGlyph.fontBoundingBoxDescent
    };
    this._allocatedGlyphs.add(glyph);
    return glyph;
  }
  getUsagePreview() {
    const w = this._canvas.width;
    const h = this._canvas.height;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = ensureNonNullable(canvas.getContext("2d"));
    ctx.fillStyle = UsagePreviewColors.Unused;
    ctx.fillRect(0, 0, w, h);
    let slabEntryPixels = 0;
    let usedPixels = 0;
    let slabEdgePixels = 0;
    let restrictedPixels = 0;
    const slabW = 64 << Math.floor(getActiveWindow().devicePixelRatio) - 1;
    const slabH = slabW;
    for (const slab of this._slabs) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < slab.count; i++) {
        if (x + slab.entryW > slabW) {
          x = 0;
          y += slab.entryH;
        }
        ctx.fillStyle = UsagePreviewColors.Wasted;
        ctx.fillRect(slab.x + x, slab.y + y, slab.entryW, slab.entryH);
        slabEntryPixels += slab.entryW * slab.entryH;
        x += slab.entryW;
      }
      const entriesPerRow = Math.floor(slabW / slab.entryW);
      const entriesPerCol = Math.floor(slabH / slab.entryH);
      const thisSlabPixels = slab.entryW * entriesPerRow * slab.entryH * entriesPerCol;
      slabEdgePixels += slabW * slabH - thisSlabPixels;
    }
    for (const g of this._allocatedGlyphs) {
      usedPixels += g.w * g.h;
      ctx.fillStyle = UsagePreviewColors.Used;
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
    const unusedRegions = Array.from(this._openRegionsByWidth.values()).flat().concat(Array.from(this._openRegionsByHeight.values()).flat());
    for (const r of unusedRegions) {
      ctx.fillStyle = UsagePreviewColors.Restricted;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      restrictedPixels += r.w * r.h;
    }
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this._canvas, 0, 0);
    ctx.globalAlpha = 1;
    return canvas.convertToBlob();
  }
  getStats() {
    const w = this._canvas.width;
    const h = this._canvas.height;
    let slabEntryPixels = 0;
    let usedPixels = 0;
    let slabEdgePixels = 0;
    let wastedPixels = 0;
    let restrictedPixels = 0;
    const totalPixels = w * h;
    const slabW = 64 << Math.floor(getActiveWindow().devicePixelRatio) - 1;
    const slabH = slabW;
    for (const slab of this._slabs) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < slab.count; i++) {
        if (x + slab.entryW > slabW) {
          x = 0;
          y += slab.entryH;
        }
        slabEntryPixels += slab.entryW * slab.entryH;
        x += slab.entryW;
      }
      const entriesPerRow = Math.floor(slabW / slab.entryW);
      const entriesPerCol = Math.floor(slabH / slab.entryH);
      const thisSlabPixels = slab.entryW * entriesPerRow * slab.entryH * entriesPerCol;
      slabEdgePixels += slabW * slabH - thisSlabPixels;
    }
    for (const g of this._allocatedGlyphs) {
      usedPixels += g.w * g.h;
    }
    const unusedRegions = Array.from(this._openRegionsByWidth.values()).flat().concat(Array.from(this._openRegionsByHeight.values()).flat());
    for (const r of unusedRegions) {
      restrictedPixels += r.w * r.h;
    }
    const edgeUsedPixels = slabEdgePixels - restrictedPixels;
    wastedPixels = slabEntryPixels - (usedPixels - edgeUsedPixels);
    const efficiency = usedPixels / (usedPixels + wastedPixels + restrictedPixels);
    return [
      `page[${this._textureIndex}]:`,
      `     Total: ${totalPixels}px (${w}x${h})`,
      `      Used: ${usedPixels}px (${(usedPixels / totalPixels * 100).toFixed(2)}%)`,
      `    Wasted: ${wastedPixels}px (${(wastedPixels / totalPixels * 100).toFixed(2)}%)`,
      `Restricted: ${restrictedPixels}px (${(restrictedPixels / totalPixels * 100).toFixed(2)}%) (hard to allocate)`,
      `Efficiency: ${efficiency === 1 ? "100" : (efficiency * 100).toFixed(2)}%`,
      `     Slabs: ${this._slabs.length} of ${Math.floor(this._canvas.width / slabW) * Math.floor(this._canvas.height / slabH)}`
    ].join("\n");
  }
}
function addEntryToMapArray(map, key, entry) {
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  list.push(entry);
}
export {
  TextureAtlasSlabAllocator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvYXRsYXMvdGV4dHVyZUF0bGFzU2xhYkFsbG9jYXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IE5LZXlNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9uTnVsbGFibGUgfSBmcm9tICcuLi9ncHVVdGlscy5qcyc7XG5pbXBvcnQgdHlwZSB7IElSYXN0ZXJpemVkR2x5cGggfSBmcm9tICcuLi9yYXN0ZXIvcmFzdGVyLmpzJztcbmltcG9ydCB7IFVzYWdlUHJldmlld0NvbG9ycywgdHlwZSBJVGV4dHVyZUF0bGFzQWxsb2NhdG9yLCB0eXBlIElUZXh0dXJlQXRsYXNQYWdlR2x5cGggfSBmcm9tICcuL2F0bGFzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBUZXh0dXJlQXRsYXNTbGFiQWxsb2NhdG9yT3B0aW9ucyB7XG5cdHNsYWJXPzogbnVtYmVyO1xuXHRzbGFiSD86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBUaGUgc2xhYiBhbGxvY2F0b3IgaXMgYSBtb3JlIGNvbXBsZXggYWxsb2NhdG9yIHRoYXQgcGxhY2VzIGdseXBocyBpbiBzcXVhcmUgc2xhYnMgb2YgYSBmaXhlZFxuICogc2l6ZS4gU2xhYnMgYXJlIGRlZmluZWQgYnkgYSBzbWFsbCByYW5nZSBvZiBnbHlwaHMgc2l6ZXMgdGhleSBjYW4gaG91c2UsIHRoaXMgcGxhY2VzIGxpa2Utc2l6ZWRcbiAqIGdseXBocyBpbiB0aGUgc2FtZSBzbGFiIHdoaWNoIHJlZHVjZXMgd2FzdGVkIHNwYWNlLlxuICpcbiAqIFNsYWJzIGFsc28gbWF5IGNvbnRhaW4gXCJ1bnVzZWRcIiByZWdpb25zIG9uIHRoZSBsZWZ0IGFuZCBib3R0b20gZGVwZW5kaW5nIG9uIHRoZSBzaXplIG9mIHRoZVxuICogZ2x5cGhzIHRoZXkgaW5jbHVkZS4gVGhpcyBzcGFjZSBpcyB1c2VkIHRvIHBsYWNlIHZlcnkgdGhpbiBvciBzaG9ydCBnbHlwaHMsIHdoaWNoIHdvdWxkIG90aGVyd2lzZVxuICogd2FzdGUgYSBsb3Qgb2Ygc3BhY2UgaW4gdGhlaXIgb3duIHNsYWIuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0dXJlQXRsYXNTbGFiQWxsb2NhdG9yIGltcGxlbWVudHMgSVRleHR1cmVBdGxhc0FsbG9jYXRvciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3R4OiBPZmZzY3JlZW5DYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2xhYnM6IElUZXh0dXJlQXRsYXNTbGFiW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlU2xhYnNCeURpbXM6IE5LZXlNYXA8SVRleHR1cmVBdGxhc1NsYWIsIFtudW1iZXIsIG51bWJlcl0+ID0gbmV3IE5LZXlNYXAoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF91bnVzZWRSZWN0czogSVRleHR1cmVBdGxhc1NsYWJVbnVzZWRSZWN0W10gPSBbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vcGVuUmVnaW9uc0J5SGVpZ2h0OiBNYXA8bnVtYmVyLCBJVGV4dHVyZUF0bGFzU2xhYlVudXNlZFJlY3RbXT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29wZW5SZWdpb25zQnlXaWR0aDogTWFwPG51bWJlciwgSVRleHR1cmVBdGxhc1NsYWJVbnVzZWRSZWN0W10+ID0gbmV3IE1hcCgpO1xuXG5cdC8qKiBBIHNldCBvZiBhbGwgZ2x5cGhzIGFsbG9jYXRlZCwgdGhpcyBpcyBvbmx5IHRyYWNrZWQgdG8gZW5hYmxlIGRlYnVnIHJlbGF0ZWQgZnVuY3Rpb25hbGl0eSAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hbGxvY2F0ZWRHbHlwaHM6IFNldDxSZWFkb25seTxJVGV4dHVyZUF0bGFzUGFnZUdseXBoPj4gPSBuZXcgU2V0KCk7XG5cblx0cHJpdmF0ZSBfc2xhYlc6IG51bWJlcjtcblx0cHJpdmF0ZSBfc2xhYkg6IG51bWJlcjtcblx0cHJpdmF0ZSBfc2xhYnNQZXJSb3c6IG51bWJlcjtcblx0cHJpdmF0ZSBfc2xhYnNQZXJDb2x1bW46IG51bWJlcjtcblx0cHJpdmF0ZSBfbmV4dEluZGV4ID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYW52YXM6IE9mZnNjcmVlbkNhbnZhcyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0dXJlSW5kZXg6IG51bWJlcixcblx0XHRvcHRpb25zPzogVGV4dHVyZUF0bGFzU2xhYkFsbG9jYXRvck9wdGlvbnNcblx0KSB7XG5cdFx0dGhpcy5fY3R4ID0gZW5zdXJlTm9uTnVsbGFibGUodGhpcy5fY2FudmFzLmdldENvbnRleHQoJzJkJywge1xuXHRcdFx0d2lsbFJlYWRGcmVxdWVudGx5OiB0cnVlXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc2xhYlcgPSBNYXRoLm1pbihcblx0XHRcdG9wdGlvbnM/LnNsYWJXID8/ICg2NCA8PCBNYXRoLm1heChNYXRoLmZsb29yKGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW8pIC0gMSwgMCkpLFxuXHRcdFx0dGhpcy5fY2FudmFzLndpZHRoXG5cdFx0KTtcblx0XHR0aGlzLl9zbGFiSCA9IE1hdGgubWluKFxuXHRcdFx0b3B0aW9ucz8uc2xhYkggPz8gdGhpcy5fc2xhYlcsXG5cdFx0XHR0aGlzLl9jYW52YXMuaGVpZ2h0XG5cdFx0KTtcblx0XHR0aGlzLl9zbGFic1BlclJvdyA9IE1hdGguZmxvb3IodGhpcy5fY2FudmFzLndpZHRoIC8gdGhpcy5fc2xhYlcpO1xuXHRcdHRoaXMuX3NsYWJzUGVyQ29sdW1uID0gTWF0aC5mbG9vcih0aGlzLl9jYW52YXMuaGVpZ2h0IC8gdGhpcy5fc2xhYkgpO1xuXHR9XG5cblx0cHVibGljIGFsbG9jYXRlKHJhc3Rlcml6ZWRHbHlwaDogSVJhc3Rlcml6ZWRHbHlwaCk6IElUZXh0dXJlQXRsYXNQYWdlR2x5cGggfCB1bmRlZmluZWQge1xuXHRcdC8vIEZpbmQgaWRlYWwgc2xhYiwgY3JlYXRpbmcgaXQgaWYgdGhlcmUgaXMgbm9uZSBzdWl0YWJsZVxuXHRcdGNvbnN0IGdseXBoV2lkdGggPSByYXN0ZXJpemVkR2x5cGguYm91bmRpbmdCb3gucmlnaHQgLSByYXN0ZXJpemVkR2x5cGguYm91bmRpbmdCb3gubGVmdCArIDE7XG5cdFx0Y29uc3QgZ2x5cGhIZWlnaHQgPSByYXN0ZXJpemVkR2x5cGguYm91bmRpbmdCb3guYm90dG9tIC0gcmFzdGVyaXplZEdseXBoLmJvdW5kaW5nQm94LnRvcCArIDE7XG5cblx0XHQvLyBUaGUgZ2x5cGggZG9lcyBub3QgZml0IGludG8gdGhlIGF0bGFzIHBhZ2UsIGdseXBocyBzaG91bGQgbmV2ZXIgYmUgdGhpcyBsYXJnZSBpbiBwcmFjdGljZVxuXHRcdGlmIChnbHlwaFdpZHRoID4gdGhpcy5fY2FudmFzLndpZHRoIHx8IGdseXBoSGVpZ2h0ID4gdGhpcy5fY2FudmFzLmhlaWdodCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignR2x5cGggaXMgdG9vIGxhcmdlIGZvciB0aGUgYXRsYXMgcGFnZScpO1xuXHRcdH1cblxuXHRcdC8vIFRoZSBnbHlwaCBkb2VzIG5vdCBmaXQgaW50byBhIHNsYWJcblx0XHRpZiAoZ2x5cGhXaWR0aCA+IHRoaXMuX3NsYWJXIHx8IGdseXBoSGVpZ2h0ID4gdGhpcy5fc2xhYkgpIHtcblx0XHRcdC8vIE9ubHkgaWYgdGhpcyBpcyB0aGUgYWxsb2NhdG9yJ3MgZmlyc3QgZ2x5cGgsIHJlc2l6ZSB0aGUgc2xhYiBzaXplIHRvIGZpdCB0aGUgZ2x5cGguXG5cdFx0XHRpZiAodGhpcy5fYWxsb2NhdGVkR2x5cGhzLnNpemUgPiAwKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHQvLyBGaW5kIHRoZSBsYXJnZXN0IHBvd2VyIG9mIDIgZGV2aXNvciB0aGF0IHRoZSBnbHlwaCBmaXRzIGludG8sIHRoaXMgZW5zdXJlIHRoZXJlIGlzIG5vXG5cdFx0XHQvLyB3YXN0ZWQgc3BhY2Ugb3V0c2lkZSB0aGUgYWxsb2NhdGVkIHNsYWJzLlxuXHRcdFx0bGV0IHNpemVDYW5kaWRhdGUgPSB0aGlzLl9jYW52YXMud2lkdGg7XG5cdFx0XHR3aGlsZSAoZ2x5cGhXaWR0aCA8IHNpemVDYW5kaWRhdGUgLyAyICYmIGdseXBoSGVpZ2h0IDwgc2l6ZUNhbmRpZGF0ZSAvIDIpIHtcblx0XHRcdFx0c2l6ZUNhbmRpZGF0ZSAvPSAyO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc2xhYlcgPSBzaXplQ2FuZGlkYXRlO1xuXHRcdFx0dGhpcy5fc2xhYkggPSBzaXplQ2FuZGlkYXRlO1xuXHRcdFx0dGhpcy5fc2xhYnNQZXJSb3cgPSBNYXRoLmZsb29yKHRoaXMuX2NhbnZhcy53aWR0aCAvIHRoaXMuX3NsYWJXKTtcblx0XHRcdHRoaXMuX3NsYWJzUGVyQ29sdW1uID0gTWF0aC5mbG9vcih0aGlzLl9jYW52YXMuaGVpZ2h0IC8gdGhpcy5fc2xhYkgpO1xuXHRcdH1cblxuXHRcdC8vIGNvbnN0IGRwciA9IGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW87XG5cblx0XHQvLyBUT0RPOiBJbmNsdWRlIGZvbnQgc2l6ZSBhcyB3ZWxsIGFzIERQUiBpbiBuZWFyZXN0WFBpeGVscyBjYWxjdWxhdGlvblxuXG5cdFx0Ly8gUm91bmQgc2xhYiBnbHlwaCBkaW1lbnNpb25zIHRvIHRoZSBuZWFyZXN0IHggcGl4ZWxzLCB3aGVyZSB4IHNjYWxlZCB3aXRoIGRldmljZSBwaXhlbCByYXRpb1xuXHRcdC8vIGNvbnN0IG5lYXJlc3RYUGl4ZWxzID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihkcHIgLyAwLjUpKTtcblx0XHQvLyBjb25zdCBuZWFyZXN0WFBpeGVscyA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IoZHByKSk7XG5cdFx0Y29uc3QgZGVzaXJlZFNsYWJTaXplID0ge1xuXHRcdFx0Ly8gTmVhcmVzdCBzcXVhcmUgbnVtYmVyXG5cdFx0XHQvLyBUT0RPOiBUaGlzIGNhbiBwcm9iYWJseSBiZSBvcHRpbWl6ZWRcblx0XHRcdC8vIHc6IDEgPDwgTWF0aC5jZWlsKE1hdGguc3FydChnbHlwaFdpZHRoKSksXG5cdFx0XHQvLyBoOiAxIDw8IE1hdGguY2VpbChNYXRoLnNxcnQoZ2x5cGhIZWlnaHQpKSxcblxuXHRcdFx0Ly8gTmVhcmVzdCB4IHB4XG5cdFx0XHQvLyB3OiBNYXRoLmNlaWwoZ2x5cGhXaWR0aCAvIG5lYXJlc3RYUGl4ZWxzKSAqIG5lYXJlc3RYUGl4ZWxzLFxuXHRcdFx0Ly8gaDogTWF0aC5jZWlsKGdseXBoSGVpZ2h0IC8gbmVhcmVzdFhQaXhlbHMpICogbmVhcmVzdFhQaXhlbHMsXG5cblx0XHRcdC8vIFJvdW5kIG9kZCBudW1iZXJzIHVwXG5cdFx0XHQvLyB3OiBnbHlwaFdpZHRoICUgMCA9PT0gMSA/IGdseXBoV2lkdGggKyAxIDogZ2x5cGhXaWR0aCxcblx0XHRcdC8vIGg6IGdseXBoSGVpZ2h0ICUgMCA9PT0gMSA/IGdseXBoSGVpZ2h0ICsgMSA6IGdseXBoSGVpZ2h0LFxuXG5cdFx0XHQvLyBFeGFjdCBudW1iZXIgb25seVxuXHRcdFx0dzogZ2x5cGhXaWR0aCxcblx0XHRcdGg6IGdseXBoSGVpZ2h0LFxuXHRcdH07XG5cblx0XHQvLyBHZXQgYW55IGV4aXN0aW5nIHNsYWJcblx0XHRsZXQgc2xhYiA9IHRoaXMuX2FjdGl2ZVNsYWJzQnlEaW1zLmdldChkZXNpcmVkU2xhYlNpemUudywgZGVzaXJlZFNsYWJTaXplLmgpO1xuXG5cdFx0Ly8gQ2hlY2sgaWYgdGhlIHNsYWIgaXMgZnVsbFxuXHRcdGlmIChzbGFiKSB7XG5cdFx0XHRjb25zdCBnbHlwaHNQZXJTbGFiID0gTWF0aC5mbG9vcih0aGlzLl9zbGFiVyAvIHNsYWIuZW50cnlXKSAqIE1hdGguZmxvb3IodGhpcy5fc2xhYkggLyBzbGFiLmVudHJ5SCk7XG5cdFx0XHRpZiAoc2xhYi5jb3VudCA+PSBnbHlwaHNQZXJTbGFiKSB7XG5cdFx0XHRcdHNsYWIgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGR4OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGR5OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBTZWFyY2ggZm9yIHN1aXRhYmxlIHNwYWNlIGluIHVudXNlZCByZWN0YW5nbGVzXG5cdFx0aWYgKCFzbGFiKSB7XG5cdFx0XHQvLyBPbmx5IGNoZWNrIGF2YWlsYWJpbGl0eSBmb3IgdGhlIHNtYWxsZXN0IHNpZGVcblx0XHRcdGlmIChnbHlwaFdpZHRoIDwgZ2x5cGhIZWlnaHQpIHtcblx0XHRcdFx0Y29uc3Qgb3BlblJlZ2lvbnMgPSB0aGlzLl9vcGVuUmVnaW9uc0J5V2lkdGguZ2V0KGdseXBoV2lkdGgpO1xuXHRcdFx0XHRpZiAob3BlblJlZ2lvbnM/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdC8vIFRPRE86IERvbid0IHNlYXJjaCBldmVyeXRoaW5nP1xuXHRcdFx0XHRcdC8vIFNlYXJjaCBmcm9tIHRoZSBlbmQgc28gd2UgY2FuIHR5cGljYWxseSBwb3AgaXQgb2ZmIHRoZSBzdGFja1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSBvcGVuUmVnaW9ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgciA9IG9wZW5SZWdpb25zW2ldO1xuXHRcdFx0XHRcdFx0aWYgKHIudyA+PSBnbHlwaFdpZHRoICYmIHIuaCA+PSBnbHlwaEhlaWdodCkge1xuXHRcdFx0XHRcdFx0XHRkeCA9IHIueDtcblx0XHRcdFx0XHRcdFx0ZHkgPSByLnk7XG5cdFx0XHRcdFx0XHRcdGlmIChnbHlwaFdpZHRoIDwgci53KSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fdW51c2VkUmVjdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0XHR4OiByLnggKyBnbHlwaFdpZHRoLFxuXHRcdFx0XHRcdFx0XHRcdFx0eTogci55LFxuXHRcdFx0XHRcdFx0XHRcdFx0dzogci53IC0gZ2x5cGhXaWR0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGg6IGdseXBoSGVpZ2h0XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ci55ICs9IGdseXBoSGVpZ2h0O1xuXHRcdFx0XHRcdFx0XHRyLmggLT0gZ2x5cGhIZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdGlmIChyLmggPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoaSA9PT0gb3BlblJlZ2lvbnMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0b3BlblJlZ2lvbnMucG9wKCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX3VudXNlZFJlY3RzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBvcGVuUmVnaW9ucyA9IHRoaXMuX29wZW5SZWdpb25zQnlIZWlnaHQuZ2V0KGdseXBoSGVpZ2h0KTtcblx0XHRcdFx0aWYgKG9wZW5SZWdpb25zPy5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBUT0RPOiBEb24ndCBzZWFyY2ggZXZlcnl0aGluZz9cblx0XHRcdFx0XHQvLyBTZWFyY2ggZnJvbSB0aGUgZW5kIHNvIHdlIGNhbiB0eXBpY2FsbHkgcG9wIGl0IG9mZiB0aGUgc3RhY2tcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gb3BlblJlZ2lvbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHIgPSBvcGVuUmVnaW9uc1tpXTtcblx0XHRcdFx0XHRcdGlmIChyLncgPj0gZ2x5cGhXaWR0aCAmJiByLmggPj0gZ2x5cGhIZWlnaHQpIHtcblx0XHRcdFx0XHRcdFx0ZHggPSByLng7XG5cdFx0XHRcdFx0XHRcdGR5ID0gci55O1xuXHRcdFx0XHRcdFx0XHRpZiAoZ2x5cGhIZWlnaHQgPCByLmgpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl91bnVzZWRSZWN0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdHg6IHIueCxcblx0XHRcdFx0XHRcdFx0XHRcdHk6IHIueSArIGdseXBoSGVpZ2h0LFxuXHRcdFx0XHRcdFx0XHRcdFx0dzogZ2x5cGhXaWR0aCxcblx0XHRcdFx0XHRcdFx0XHRcdGg6IHIuaCAtIGdseXBoSGVpZ2h0XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ci54ICs9IGdseXBoV2lkdGg7XG5cdFx0XHRcdFx0XHRcdHIudyAtPSBnbHlwaFdpZHRoO1xuXHRcdFx0XHRcdFx0XHRpZiAoci5oID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGkgPT09IG9wZW5SZWdpb25zLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdG9wZW5SZWdpb25zLnBvcCgpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl91bnVzZWRSZWN0cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBhIG5ldyBzbGFiXG5cdFx0aWYgKGR4ID09PSB1bmRlZmluZWQgfHwgZHkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKCFzbGFiKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9zbGFicy5sZW5ndGggPj0gdGhpcy5fc2xhYnNQZXJSb3cgKiB0aGlzLl9zbGFic1BlckNvbHVtbikge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzbGFiID0ge1xuXHRcdFx0XHRcdHg6IE1hdGguZmxvb3IodGhpcy5fc2xhYnMubGVuZ3RoICUgdGhpcy5fc2xhYnNQZXJSb3cpICogdGhpcy5fc2xhYlcsXG5cdFx0XHRcdFx0eTogTWF0aC5mbG9vcih0aGlzLl9zbGFicy5sZW5ndGggLyB0aGlzLl9zbGFic1BlclJvdykgKiB0aGlzLl9zbGFiSCxcblx0XHRcdFx0XHRlbnRyeVc6IGRlc2lyZWRTbGFiU2l6ZS53LFxuXHRcdFx0XHRcdGVudHJ5SDogZGVzaXJlZFNsYWJTaXplLmgsXG5cdFx0XHRcdFx0Y291bnQ6IDBcblx0XHRcdFx0fTtcblx0XHRcdFx0Ly8gVHJhY2sgdW51c2VkIHJlZ2lvbnMgdG8gdXNlIGZvciBzbWFsbCBnbHlwaHNcblx0XHRcdFx0Ly8gKy0tLS0tLS0tLS0tLS0rLS0tLStcblx0XHRcdFx0Ly8gfCAgICAgICAgICAgICB8ICAgIHxcblx0XHRcdFx0Ly8gfCAgICAgICAgICAgICB8ICAgIHwgPC0gVW51c2VkIFcgcmVnaW9uXG5cdFx0XHRcdC8vIHwgICAgICAgICAgICAgfCAgICB8XG5cdFx0XHRcdC8vIHwtLS0tLS0tLS0tLS0tKy0tLS0rXG5cdFx0XHRcdC8vIHwgICAgICAgICAgICAgICAgICB8IDwtIFVudXNlZCBIIHJlZ2lvblxuXHRcdFx0XHQvLyArLS0tLS0tLS0tLS0tLS0tLS0tK1xuXHRcdFx0XHRjb25zdCB1bnVzZWRXID0gdGhpcy5fc2xhYlcgJSBzbGFiLmVudHJ5Vztcblx0XHRcdFx0Y29uc3QgdW51c2VkSCA9IHRoaXMuX3NsYWJIICUgc2xhYi5lbnRyeUg7XG5cdFx0XHRcdGlmICh1bnVzZWRXKSB7XG5cdFx0XHRcdFx0YWRkRW50cnlUb01hcEFycmF5KHRoaXMuX29wZW5SZWdpb25zQnlXaWR0aCwgdW51c2VkVywge1xuXHRcdFx0XHRcdFx0eDogc2xhYi54ICsgdGhpcy5fc2xhYlcgLSB1bnVzZWRXLFxuXHRcdFx0XHRcdFx0dzogdW51c2VkVyxcblx0XHRcdFx0XHRcdHk6IHNsYWIueSxcblx0XHRcdFx0XHRcdGg6IHRoaXMuX3NsYWJIIC0gKHVudXNlZEggPz8gMClcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodW51c2VkSCkge1xuXHRcdFx0XHRcdGFkZEVudHJ5VG9NYXBBcnJheSh0aGlzLl9vcGVuUmVnaW9uc0J5SGVpZ2h0LCB1bnVzZWRILCB7XG5cdFx0XHRcdFx0XHR4OiBzbGFiLngsXG5cdFx0XHRcdFx0XHR3OiB0aGlzLl9zbGFiVyxcblx0XHRcdFx0XHRcdHk6IHNsYWIueSArIHRoaXMuX3NsYWJIIC0gdW51c2VkSCxcblx0XHRcdFx0XHRcdGg6IHVudXNlZEhcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9zbGFicy5wdXNoKHNsYWIpO1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVTbGFic0J5RGltcy5zZXQoc2xhYiwgZGVzaXJlZFNsYWJTaXplLncsIGRlc2lyZWRTbGFiU2l6ZS5oKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZ2x5cGhzUGVyUm93ID0gTWF0aC5mbG9vcih0aGlzLl9zbGFiVyAvIHNsYWIuZW50cnlXKTtcblx0XHRcdGR4ID0gc2xhYi54ICsgTWF0aC5mbG9vcihzbGFiLmNvdW50ICUgZ2x5cGhzUGVyUm93KSAqIHNsYWIuZW50cnlXO1xuXHRcdFx0ZHkgPSBzbGFiLnkgKyBNYXRoLmZsb29yKHNsYWIuY291bnQgLyBnbHlwaHNQZXJSb3cpICogc2xhYi5lbnRyeUg7XG5cblx0XHRcdC8vIFNoaWZ0IGN1cnJlbnQgcm93XG5cdFx0XHRzbGFiLmNvdW50Kys7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhdyBnbHlwaFxuXHRcdHRoaXMuX2N0eC5kcmF3SW1hZ2UoXG5cdFx0XHRyYXN0ZXJpemVkR2x5cGguc291cmNlLFxuXHRcdFx0Ly8gc291cmNlXG5cdFx0XHRyYXN0ZXJpemVkR2x5cGguYm91bmRpbmdCb3gubGVmdCxcblx0XHRcdHJhc3Rlcml6ZWRHbHlwaC5ib3VuZGluZ0JveC50b3AsXG5cdFx0XHRnbHlwaFdpZHRoLFxuXHRcdFx0Z2x5cGhIZWlnaHQsXG5cdFx0XHQvLyBkZXN0aW5hdGlvblxuXHRcdFx0ZHgsXG5cdFx0XHRkeSxcblx0XHRcdGdseXBoV2lkdGgsXG5cdFx0XHRnbHlwaEhlaWdodFxuXHRcdCk7XG5cblx0XHQvLyBDcmVhdGUgZ2x5cGggb2JqZWN0XG5cdFx0Y29uc3QgZ2x5cGg6IElUZXh0dXJlQXRsYXNQYWdlR2x5cGggPSB7XG5cdFx0XHRwYWdlSW5kZXg6IHRoaXMuX3RleHR1cmVJbmRleCxcblx0XHRcdGdseXBoSW5kZXg6IHRoaXMuX25leHRJbmRleCsrLFxuXHRcdFx0eDogZHgsXG5cdFx0XHR5OiBkeSxcblx0XHRcdHc6IGdseXBoV2lkdGgsXG5cdFx0XHRoOiBnbHlwaEhlaWdodCxcblx0XHRcdG9yaWdpbk9mZnNldFg6IHJhc3Rlcml6ZWRHbHlwaC5vcmlnaW5PZmZzZXQueCxcblx0XHRcdG9yaWdpbk9mZnNldFk6IHJhc3Rlcml6ZWRHbHlwaC5vcmlnaW5PZmZzZXQueSxcblx0XHRcdGZvbnRCb3VuZGluZ0JveEFzY2VudDogcmFzdGVyaXplZEdseXBoLmZvbnRCb3VuZGluZ0JveEFzY2VudCxcblx0XHRcdGZvbnRCb3VuZGluZ0JveERlc2NlbnQ6IHJhc3Rlcml6ZWRHbHlwaC5mb250Qm91bmRpbmdCb3hEZXNjZW50LFxuXHRcdH07XG5cblx0XHQvLyBTZXQgdGhlIGdseXBoXG5cdFx0dGhpcy5fYWxsb2NhdGVkR2x5cGhzLmFkZChnbHlwaCk7XG5cblx0XHRyZXR1cm4gZ2x5cGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VXNhZ2VQcmV2aWV3KCk6IFByb21pc2U8QmxvYj4ge1xuXHRcdGNvbnN0IHcgPSB0aGlzLl9jYW52YXMud2lkdGg7XG5cdFx0Y29uc3QgaCA9IHRoaXMuX2NhbnZhcy5oZWlnaHQ7XG5cdFx0Y29uc3QgY2FudmFzID0gbmV3IE9mZnNjcmVlbkNhbnZhcyh3LCBoKTtcblx0XHRjb25zdCBjdHggPSBlbnN1cmVOb25OdWxsYWJsZShjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSk7XG5cblx0XHRjdHguZmlsbFN0eWxlID0gVXNhZ2VQcmV2aWV3Q29sb3JzLlVudXNlZDtcblx0XHRjdHguZmlsbFJlY3QoMCwgMCwgdywgaCk7XG5cblx0XHRsZXQgc2xhYkVudHJ5UGl4ZWxzID0gMDtcblx0XHRsZXQgdXNlZFBpeGVscyA9IDA7XG5cdFx0bGV0IHNsYWJFZGdlUGl4ZWxzID0gMDtcblx0XHRsZXQgcmVzdHJpY3RlZFBpeGVscyA9IDA7XG5cdFx0Y29uc3Qgc2xhYlcgPSA2NCA8PCAoTWF0aC5mbG9vcihnZXRBY3RpdmVXaW5kb3coKS5kZXZpY2VQaXhlbFJhdGlvKSAtIDEpO1xuXHRcdGNvbnN0IHNsYWJIID0gc2xhYlc7XG5cblx0XHQvLyBEcmF3IHdhc3RlZCB1bmRlcm5lYXRoIGdseXBocyBmaXJzdFxuXHRcdGZvciAoY29uc3Qgc2xhYiBvZiB0aGlzLl9zbGFicykge1xuXHRcdFx0bGV0IHggPSAwO1xuXHRcdFx0bGV0IHkgPSAwO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzbGFiLmNvdW50OyBpKyspIHtcblx0XHRcdFx0aWYgKHggKyBzbGFiLmVudHJ5VyA+IHNsYWJXKSB7XG5cdFx0XHRcdFx0eCA9IDA7XG5cdFx0XHRcdFx0eSArPSBzbGFiLmVudHJ5SDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjdHguZmlsbFN0eWxlID0gVXNhZ2VQcmV2aWV3Q29sb3JzLldhc3RlZDtcblx0XHRcdFx0Y3R4LmZpbGxSZWN0KHNsYWIueCArIHgsIHNsYWIueSArIHksIHNsYWIuZW50cnlXLCBzbGFiLmVudHJ5SCk7XG5cblx0XHRcdFx0c2xhYkVudHJ5UGl4ZWxzICs9IHNsYWIuZW50cnlXICogc2xhYi5lbnRyeUg7XG5cdFx0XHRcdHggKz0gc2xhYi5lbnRyeVc7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyaWVzUGVyUm93ID0gTWF0aC5mbG9vcihzbGFiVyAvIHNsYWIuZW50cnlXKTtcblx0XHRcdGNvbnN0IGVudHJpZXNQZXJDb2wgPSBNYXRoLmZsb29yKHNsYWJIIC8gc2xhYi5lbnRyeUgpO1xuXHRcdFx0Y29uc3QgdGhpc1NsYWJQaXhlbHMgPSBzbGFiLmVudHJ5VyAqIGVudHJpZXNQZXJSb3cgKiBzbGFiLmVudHJ5SCAqIGVudHJpZXNQZXJDb2w7XG5cdFx0XHRzbGFiRWRnZVBpeGVscyArPSAoc2xhYlcgKiBzbGFiSCkgLSB0aGlzU2xhYlBpeGVscztcblx0XHR9XG5cblx0XHQvLyBEcmF3IGdseXBoc1xuXHRcdGZvciAoY29uc3QgZyBvZiB0aGlzLl9hbGxvY2F0ZWRHbHlwaHMpIHtcblx0XHRcdHVzZWRQaXhlbHMgKz0gZy53ICogZy5oO1xuXHRcdFx0Y3R4LmZpbGxTdHlsZSA9IFVzYWdlUHJldmlld0NvbG9ycy5Vc2VkO1xuXHRcdFx0Y3R4LmZpbGxSZWN0KGcueCwgZy55LCBnLncsIGcuaCk7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhdyB1bnVzZWQgc3BhY2Ugb24gc2lkZVxuXHRcdGNvbnN0IHVudXNlZFJlZ2lvbnMgPSBBcnJheS5mcm9tKHRoaXMuX29wZW5SZWdpb25zQnlXaWR0aC52YWx1ZXMoKSkuZmxhdCgpLmNvbmNhdChBcnJheS5mcm9tKHRoaXMuX29wZW5SZWdpb25zQnlIZWlnaHQudmFsdWVzKCkpLmZsYXQoKSk7XG5cdFx0Zm9yIChjb25zdCByIG9mIHVudXNlZFJlZ2lvbnMpIHtcblx0XHRcdGN0eC5maWxsU3R5bGUgPSBVc2FnZVByZXZpZXdDb2xvcnMuUmVzdHJpY3RlZDtcblx0XHRcdGN0eC5maWxsUmVjdChyLngsIHIueSwgci53LCByLmgpO1xuXHRcdFx0cmVzdHJpY3RlZFBpeGVscyArPSByLncgKiByLmg7XG5cdFx0fVxuXG5cblx0XHQvLyBPdmVybGF5IGFjdHVhbCBnbHlwaHMgb24gdG9wXG5cdFx0Y3R4Lmdsb2JhbEFscGhhID0gMC41O1xuXHRcdGN0eC5kcmF3SW1hZ2UodGhpcy5fY2FudmFzLCAwLCAwKTtcblx0XHRjdHguZ2xvYmFsQWxwaGEgPSAxO1xuXG5cdFx0cmV0dXJuIGNhbnZhcy5jb252ZXJ0VG9CbG9iKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U3RhdHMoKTogc3RyaW5nIHtcblx0XHRjb25zdCB3ID0gdGhpcy5fY2FudmFzLndpZHRoO1xuXHRcdGNvbnN0IGggPSB0aGlzLl9jYW52YXMuaGVpZ2h0O1xuXG5cdFx0bGV0IHNsYWJFbnRyeVBpeGVscyA9IDA7XG5cdFx0bGV0IHVzZWRQaXhlbHMgPSAwO1xuXHRcdGxldCBzbGFiRWRnZVBpeGVscyA9IDA7XG5cdFx0bGV0IHdhc3RlZFBpeGVscyA9IDA7XG5cdFx0bGV0IHJlc3RyaWN0ZWRQaXhlbHMgPSAwO1xuXHRcdGNvbnN0IHRvdGFsUGl4ZWxzID0gdyAqIGg7XG5cdFx0Y29uc3Qgc2xhYlcgPSA2NCA8PCAoTWF0aC5mbG9vcihnZXRBY3RpdmVXaW5kb3coKS5kZXZpY2VQaXhlbFJhdGlvKSAtIDEpO1xuXHRcdGNvbnN0IHNsYWJIID0gc2xhYlc7XG5cblx0XHQvLyBEcmF3IHdhc3RlZCB1bmRlcm5lYXRoIGdseXBocyBmaXJzdFxuXHRcdGZvciAoY29uc3Qgc2xhYiBvZiB0aGlzLl9zbGFicykge1xuXHRcdFx0bGV0IHggPSAwO1xuXHRcdFx0bGV0IHkgPSAwO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzbGFiLmNvdW50OyBpKyspIHtcblx0XHRcdFx0aWYgKHggKyBzbGFiLmVudHJ5VyA+IHNsYWJXKSB7XG5cdFx0XHRcdFx0eCA9IDA7XG5cdFx0XHRcdFx0eSArPSBzbGFiLmVudHJ5SDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzbGFiRW50cnlQaXhlbHMgKz0gc2xhYi5lbnRyeVcgKiBzbGFiLmVudHJ5SDtcblx0XHRcdFx0eCArPSBzbGFiLmVudHJ5Vztcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJpZXNQZXJSb3cgPSBNYXRoLmZsb29yKHNsYWJXIC8gc2xhYi5lbnRyeVcpO1xuXHRcdFx0Y29uc3QgZW50cmllc1BlckNvbCA9IE1hdGguZmxvb3Ioc2xhYkggLyBzbGFiLmVudHJ5SCk7XG5cdFx0XHRjb25zdCB0aGlzU2xhYlBpeGVscyA9IHNsYWIuZW50cnlXICogZW50cmllc1BlclJvdyAqIHNsYWIuZW50cnlIICogZW50cmllc1BlckNvbDtcblx0XHRcdHNsYWJFZGdlUGl4ZWxzICs9IChzbGFiVyAqIHNsYWJIKSAtIHRoaXNTbGFiUGl4ZWxzO1xuXHRcdH1cblxuXHRcdC8vIERyYXcgZ2x5cGhzXG5cdFx0Zm9yIChjb25zdCBnIG9mIHRoaXMuX2FsbG9jYXRlZEdseXBocykge1xuXHRcdFx0dXNlZFBpeGVscyArPSBnLncgKiBnLmg7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhdyB1bnVzZWQgc3BhY2Ugb24gc2lkZVxuXHRcdGNvbnN0IHVudXNlZFJlZ2lvbnMgPSBBcnJheS5mcm9tKHRoaXMuX29wZW5SZWdpb25zQnlXaWR0aC52YWx1ZXMoKSkuZmxhdCgpLmNvbmNhdChBcnJheS5mcm9tKHRoaXMuX29wZW5SZWdpb25zQnlIZWlnaHQudmFsdWVzKCkpLmZsYXQoKSk7XG5cdFx0Zm9yIChjb25zdCByIG9mIHVudXNlZFJlZ2lvbnMpIHtcblx0XHRcdHJlc3RyaWN0ZWRQaXhlbHMgKz0gci53ICogci5oO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkZ2VVc2VkUGl4ZWxzID0gc2xhYkVkZ2VQaXhlbHMgLSByZXN0cmljdGVkUGl4ZWxzO1xuXHRcdHdhc3RlZFBpeGVscyA9IHNsYWJFbnRyeVBpeGVscyAtICh1c2VkUGl4ZWxzIC0gZWRnZVVzZWRQaXhlbHMpO1xuXG5cdFx0Ly8gdXNlZFBpeGVscyArPSBzbGFiRWRnZVBpeGVscyAtIHJlc3RyaWN0ZWRQaXhlbHM7XG5cdFx0Y29uc3QgZWZmaWNpZW5jeSA9IHVzZWRQaXhlbHMgLyAodXNlZFBpeGVscyArIHdhc3RlZFBpeGVscyArIHJlc3RyaWN0ZWRQaXhlbHMpO1xuXG5cdFx0cmV0dXJuIFtcblx0XHRcdGBwYWdlWyR7dGhpcy5fdGV4dHVyZUluZGV4fV06YCxcblx0XHRcdGAgICAgIFRvdGFsOiAke3RvdGFsUGl4ZWxzfXB4ICgke3d9eCR7aH0pYCxcblx0XHRcdGAgICAgICBVc2VkOiAke3VzZWRQaXhlbHN9cHggKCR7KCh1c2VkUGl4ZWxzIC8gdG90YWxQaXhlbHMpICogMTAwKS50b0ZpeGVkKDIpfSUpYCxcblx0XHRcdGAgICAgV2FzdGVkOiAke3dhc3RlZFBpeGVsc31weCAoJHsoKHdhc3RlZFBpeGVscyAvIHRvdGFsUGl4ZWxzKSAqIDEwMCkudG9GaXhlZCgyKX0lKWAsXG5cdFx0XHRgUmVzdHJpY3RlZDogJHtyZXN0cmljdGVkUGl4ZWxzfXB4ICgkeygocmVzdHJpY3RlZFBpeGVscyAvIHRvdGFsUGl4ZWxzKSAqIDEwMCkudG9GaXhlZCgyKX0lKSAoaGFyZCB0byBhbGxvY2F0ZSlgLFxuXHRcdFx0YEVmZmljaWVuY3k6ICR7ZWZmaWNpZW5jeSA9PT0gMSA/ICcxMDAnIDogKGVmZmljaWVuY3kgKiAxMDApLnRvRml4ZWQoMil9JWAsXG5cdFx0XHRgICAgICBTbGFiczogJHt0aGlzLl9zbGFicy5sZW5ndGh9IG9mICR7TWF0aC5mbG9vcih0aGlzLl9jYW52YXMud2lkdGggLyBzbGFiVykgKiBNYXRoLmZsb29yKHRoaXMuX2NhbnZhcy5oZWlnaHQgLyBzbGFiSCl9YFxuXHRcdF0uam9pbignXFxuJyk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElUZXh0dXJlQXRsYXNTbGFiIHtcblx0eDogbnVtYmVyO1xuXHR5OiBudW1iZXI7XG5cdGVudHJ5SDogbnVtYmVyO1xuXHRlbnRyeVc6IG51bWJlcjtcblx0Y291bnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElUZXh0dXJlQXRsYXNTbGFiVW51c2VkUmVjdCB7XG5cdHg6IG51bWJlcjtcblx0eTogbnVtYmVyO1xuXHR3OiBudW1iZXI7XG5cdGg6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gYWRkRW50cnlUb01hcEFycmF5PEssIFY+KG1hcDogTWFwPEssIFZbXT4sIGtleTogSywgZW50cnk6IFYpIHtcblx0bGV0IGxpc3QgPSBtYXAuZ2V0KGtleSk7XG5cdGlmICghbGlzdCkge1xuXHRcdGxpc3QgPSBbXTtcblx0XHRtYXAuc2V0KGtleSwgbGlzdCk7XG5cdH1cblx0bGlzdC5wdXNoKGVudHJ5KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLDBCQUFvRjtBQWdCdEYsTUFBTSwwQkFBNEQ7QUFBQSxFQXFCeEUsWUFDa0IsU0FDQSxlQUNqQixTQUNDO0FBSGdCO0FBQ0E7QUFuQmxCLFNBQWlCLFNBQThCLENBQUM7QUFDaEQsU0FBaUIscUJBQW1FLElBQUksUUFBUTtBQUVoRyxTQUFpQixlQUE4QyxDQUFDO0FBRWhFLFNBQWlCLHVCQUFtRSxvQkFBSSxJQUFJO0FBQzVGLFNBQWlCLHNCQUFrRSxvQkFBSSxJQUFJO0FBRzNGO0FBQUEsU0FBaUIsbUJBQTBELG9CQUFJLElBQUk7QUFNbkYsU0FBUSxhQUFhO0FBT3BCLFNBQUssT0FBTyxrQkFBa0IsS0FBSyxR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
