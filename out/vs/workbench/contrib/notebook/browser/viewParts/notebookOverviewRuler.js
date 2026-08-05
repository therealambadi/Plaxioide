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
import { getWindow } from "../../../../../base/browser/dom.js";
import { createFastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { PixelRatio } from "../../../../../base/browser/pixelRatio.js";
import { IThemeService, Themable } from "../../../../../platform/theme/common/themeService.js";
import { NotebookOverviewRulerLane } from "../notebookBrowser.js";
let NotebookOverviewRuler = class extends Themable {
  constructor(notebookEditor, container, themeService) {
    super(themeService);
    this.notebookEditor = notebookEditor;
    this._lanes = 3;
    this._domNode = createFastDomNode(document.createElement("canvas"));
    this._domNode.setPosition("relative");
    this._domNode.setLayerHinting(true);
    this._domNode.setContain("strict");
    container.appendChild(this._domNode.domNode);
    this._register(notebookEditor.onDidChangeDecorations(() => {
      this.layout();
    }));
    this._register(PixelRatio.getInstance(getWindow(this._domNode.domNode)).onDidChange(() => {
      this.layout();
    }));
  }
  layout() {
    const width = 10;
    const layoutInfo = this.notebookEditor.getLayoutInfo();
    const scrollHeight = layoutInfo.scrollHeight;
    const height = layoutInfo.height;
    const ratio = PixelRatio.getInstance(getWindow(this._domNode.domNode)).value;
    this._domNode.setWidth(width);
    this._domNode.setHeight(height);
    this._domNode.domNode.width = width * ratio;
    this._domNode.domNode.height = height * ratio;
    const ctx = this._domNode.domNode.getContext("2d");
    ctx.clearRect(0, 0, width * ratio, height * ratio);
    this._render(ctx, width * ratio, height * ratio, scrollHeight * ratio, ratio);
  }
  _render(ctx, width, height, scrollHeight, ratio) {
    const viewModel = this.notebookEditor.getViewModel();
    const fontInfo = this.notebookEditor.getLayoutInfo().fontInfo;
    const laneWidth = width / this._lanes;
    let currentFrom = 0;
    if (viewModel) {
      for (let i = 0; i < viewModel.viewCells.length; i++) {
        const viewCell = viewModel.viewCells[i];
        const textBuffer = viewCell.textBuffer;
        const decorations = viewCell.getCellDecorations();
        const cellHeight = viewCell.layoutInfo.totalHeight / scrollHeight * ratio * height;
        decorations.filter((decoration) => decoration.overviewRuler).forEach((decoration) => {
          const overviewRuler = decoration.overviewRuler;
          const fillStyle = this.getColor(overviewRuler.color) ?? "#000000";
          const lineHeight = Math.min(fontInfo.lineHeight, viewCell.layoutInfo.editorHeight / scrollHeight / textBuffer.getLineCount() * ratio * height);
          const lineNumbers = overviewRuler.modelRanges.map((range) => range.startLineNumber).reduce((previous, current) => {
            if (previous.length === 0) {
              previous.push(current);
            } else {
              const last = previous[previous.length - 1];
              if (last !== current) {
                previous.push(current);
              }
            }
            return previous;
          }, []);
          let x = 0;
          switch (overviewRuler.position) {
            case NotebookOverviewRulerLane.Left:
              x = 0;
              break;
            case NotebookOverviewRulerLane.Center:
              x = laneWidth;
              break;
            case NotebookOverviewRulerLane.Right:
              x = laneWidth * 2;
              break;
            default:
              break;
          }
          const width2 = overviewRuler.position === NotebookOverviewRulerLane.Full ? laneWidth * 3 : laneWidth;
          for (let i2 = 0; i2 < lineNumbers.length; i2++) {
            ctx.fillStyle = fillStyle;
            const lineNumber = lineNumbers[i2];
            const offset = (lineNumber - 1) * lineHeight;
            ctx.fillRect(x, currentFrom + offset, width2, lineHeight);
          }
          if (overviewRuler.includeOutput) {
            ctx.fillStyle = fillStyle;
            const outputOffset = viewCell.layoutInfo.editorHeight / scrollHeight * ratio * height;
            const decorationHeight = fontInfo.lineHeight / scrollHeight * ratio * height;
            ctx.fillRect(laneWidth, currentFrom + outputOffset, laneWidth, decorationHeight);
          }
        });
        currentFrom += cellHeight;
      }
      const overviewRulerDecorations = viewModel.getOverviewRulerDecorations();
      for (let i = 0; i < overviewRulerDecorations.length; i++) {
        const decoration = overviewRulerDecorations[i];
        if (!decoration.options.overviewRuler) {
          continue;
        }
        const viewZoneInfo = this.notebookEditor.getViewZoneLayoutInfo(decoration.viewZoneId);
        if (!viewZoneInfo) {
          continue;
        }
        const fillStyle = this.getColor(decoration.options.overviewRuler.color) ?? "#000000";
        let x = 0;
        switch (decoration.options.overviewRuler.position) {
          case NotebookOverviewRulerLane.Left:
            x = 0;
            break;
          case NotebookOverviewRulerLane.Center:
            x = laneWidth;
            break;
          case NotebookOverviewRulerLane.Right:
            x = laneWidth * 2;
            break;
          default:
            break;
        }
        const width2 = decoration.options.overviewRuler.position === NotebookOverviewRulerLane.Full ? laneWidth * 3 : laneWidth;
        ctx.fillStyle = fillStyle;
        const viewZoneHeight = viewZoneInfo.height / scrollHeight * ratio * height;
        const viewZoneTop = viewZoneInfo.top / scrollHeight * ratio * height;
        ctx.fillRect(x, viewZoneTop, width2, viewZoneHeight);
      }
    }
  }
};
NotebookOverviewRuler = __decorateClass([
  __decorateParam(2, IThemeService)
], NotebookOverviewRuler);
export {
  NotebookOverviewRuler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va092ZXJ2aWV3UnVsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGNyZWF0ZUZhc3REb21Ob2RlLCBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBQaXhlbFJhdGlvIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3BpeGVsUmF0aW8uanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgVGhlbWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvckRlbGVnYXRlLCBOb3RlYm9va092ZXJ2aWV3UnVsZXJMYW5lIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcblxuZXhwb3J0IGNsYXNzIE5vdGVib29rT3ZlcnZpZXdSdWxlciBleHRlbmRzIFRoZW1hYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogRmFzdERvbU5vZGU8SFRNTENhbnZhc0VsZW1lbnQ+O1xuXHRwcml2YXRlIF9sYW5lcyA9IDM7XG5cblx0Y29uc3RydWN0b3IocmVhZG9ubHkgbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va0VkaXRvckRlbGVnYXRlLCBjb250YWluZXI6IEhUTUxFbGVtZW50LCBASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UpIHtcblx0XHRzdXBlcih0aGVtZVNlcnZpY2UpO1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBjcmVhdGVGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKSk7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRQb3NpdGlvbigncmVsYXRpdmUnKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldExheWVySGludGluZyh0cnVlKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldENvbnRhaW4oJ3N0cmljdCcpO1xuXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2RvbU5vZGUuZG9tTm9kZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZURlY29yYXRpb25zKCgpID0+IHtcblx0XHRcdHRoaXMubGF5b3V0KCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoUGl4ZWxSYXRpby5nZXRJbnN0YW5jZShnZXRXaW5kb3codGhpcy5fZG9tTm9kZS5kb21Ob2RlKSkub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5sYXlvdXQoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRsYXlvdXQoKSB7XG5cdFx0Y29uc3Qgd2lkdGggPSAxMDtcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0Y29uc3Qgc2Nyb2xsSGVpZ2h0ID0gbGF5b3V0SW5mby5zY3JvbGxIZWlnaHQ7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gbGF5b3V0SW5mby5oZWlnaHQ7XG5cdFx0Y29uc3QgcmF0aW8gPSBQaXhlbFJhdGlvLmdldEluc3RhbmNlKGdldFdpbmRvdyh0aGlzLl9kb21Ob2RlLmRvbU5vZGUpKS52YWx1ZTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldFdpZHRoKHdpZHRoKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldEhlaWdodChoZWlnaHQpO1xuXHRcdHRoaXMuX2RvbU5vZGUuZG9tTm9kZS53aWR0aCA9IHdpZHRoICogcmF0aW87XG5cdFx0dGhpcy5fZG9tTm9kZS5kb21Ob2RlLmhlaWdodCA9IGhlaWdodCAqIHJhdGlvO1xuXHRcdGNvbnN0IGN0eCA9IHRoaXMuX2RvbU5vZGUuZG9tTm9kZS5nZXRDb250ZXh0KCcyZCcpITtcblx0XHRjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoICogcmF0aW8sIGhlaWdodCAqIHJhdGlvKTtcblx0XHR0aGlzLl9yZW5kZXIoY3R4LCB3aWR0aCAqIHJhdGlvLCBoZWlnaHQgKiByYXRpbywgc2Nyb2xsSGVpZ2h0ICogcmF0aW8sIHJhdGlvKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlcihjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHNjcm9sbEhlaWdodDogbnVtYmVyLCByYXRpbzogbnVtYmVyKSB7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRWaWV3TW9kZWwoKTtcblx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmZvbnRJbmZvO1xuXHRcdGNvbnN0IGxhbmVXaWR0aCA9IHdpZHRoIC8gdGhpcy5fbGFuZXM7XG5cblx0XHRsZXQgY3VycmVudEZyb20gPSAwO1xuXG5cdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2aWV3TW9kZWwudmlld0NlbGxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdDZWxsID0gdmlld01vZGVsLnZpZXdDZWxsc1tpXTtcblx0XHRcdFx0Y29uc3QgdGV4dEJ1ZmZlciA9IHZpZXdDZWxsLnRleHRCdWZmZXI7XG5cdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zID0gdmlld0NlbGwuZ2V0Q2VsbERlY29yYXRpb25zKCk7XG5cdFx0XHRcdGNvbnN0IGNlbGxIZWlnaHQgPSAodmlld0NlbGwubGF5b3V0SW5mby50b3RhbEhlaWdodCAvIHNjcm9sbEhlaWdodCkgKiByYXRpbyAqIGhlaWdodDtcblxuXHRcdFx0XHRkZWNvcmF0aW9ucy5maWx0ZXIoZGVjb3JhdGlvbiA9PiBkZWNvcmF0aW9uLm92ZXJ2aWV3UnVsZXIpLmZvckVhY2goZGVjb3JhdGlvbiA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb3ZlcnZpZXdSdWxlciA9IGRlY29yYXRpb24ub3ZlcnZpZXdSdWxlciE7XG5cdFx0XHRcdFx0Y29uc3QgZmlsbFN0eWxlID0gdGhpcy5nZXRDb2xvcihvdmVydmlld1J1bGVyLmNvbG9yKSA/PyAnIzAwMDAwMCc7XG5cdFx0XHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IE1hdGgubWluKGZvbnRJbmZvLmxpbmVIZWlnaHQsICh2aWV3Q2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCAvIHNjcm9sbEhlaWdodCAvIHRleHRCdWZmZXIuZ2V0TGluZUNvdW50KCkpICogcmF0aW8gKiBoZWlnaHQpO1xuXHRcdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXJzID0gb3ZlcnZpZXdSdWxlci5tb2RlbFJhbmdlcy5tYXAocmFuZ2UgPT4gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKS5yZWR1Y2UoKHByZXZpb3VzOiBudW1iZXJbXSwgY3VycmVudDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAocHJldmlvdXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHByZXZpb3VzLnB1c2goY3VycmVudCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsYXN0ID0gcHJldmlvdXNbcHJldmlvdXMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0XHRcdGlmIChsYXN0ICE9PSBjdXJyZW50KSB7XG5cdFx0XHRcdFx0XHRcdFx0cHJldmlvdXMucHVzaChjdXJyZW50KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJldmlvdXM7XG5cdFx0XHRcdFx0fSwgW10gYXMgbnVtYmVyW10pO1xuXG5cdFx0XHRcdFx0bGV0IHggPSAwO1xuXHRcdFx0XHRcdHN3aXRjaCAob3ZlcnZpZXdSdWxlci5wb3NpdGlvbikge1xuXHRcdFx0XHRcdFx0Y2FzZSBOb3RlYm9va092ZXJ2aWV3UnVsZXJMYW5lLkxlZnQ6XG5cdFx0XHRcdFx0XHRcdHggPSAwO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tPdmVydmlld1J1bGVyTGFuZS5DZW50ZXI6XG5cdFx0XHRcdFx0XHRcdHggPSBsYW5lV2lkdGg7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSBOb3RlYm9va092ZXJ2aWV3UnVsZXJMYW5lLlJpZ2h0OlxuXHRcdFx0XHRcdFx0XHR4ID0gbGFuZVdpZHRoICogMjtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB3aWR0aCA9IG92ZXJ2aWV3UnVsZXIucG9zaXRpb24gPT09IE5vdGVib29rT3ZlcnZpZXdSdWxlckxhbmUuRnVsbCA/IGxhbmVXaWR0aCAqIDMgOiBsYW5lV2lkdGg7XG5cblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVOdW1iZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gZmlsbFN0eWxlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGxpbmVOdW1iZXJzW2ldO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2Zmc2V0ID0gKGxpbmVOdW1iZXIgLSAxKSAqIGxpbmVIZWlnaHQ7XG5cdFx0XHRcdFx0XHRjdHguZmlsbFJlY3QoeCwgY3VycmVudEZyb20gKyBvZmZzZXQsIHdpZHRoLCBsaW5lSGVpZ2h0KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAob3ZlcnZpZXdSdWxlci5pbmNsdWRlT3V0cHV0KSB7XG5cdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gZmlsbFN0eWxlO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3V0cHV0T2Zmc2V0ID0gKHZpZXdDZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0IC8gc2Nyb2xsSGVpZ2h0KSAqIHJhdGlvICogaGVpZ2h0O1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbkhlaWdodCA9IChmb250SW5mby5saW5lSGVpZ2h0IC8gc2Nyb2xsSGVpZ2h0KSAqIHJhdGlvICogaGVpZ2h0O1xuXHRcdFx0XHRcdFx0Y3R4LmZpbGxSZWN0KGxhbmVXaWR0aCwgY3VycmVudEZyb20gKyBvdXRwdXRPZmZzZXQsIGxhbmVXaWR0aCwgZGVjb3JhdGlvbkhlaWdodCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjdXJyZW50RnJvbSArPSBjZWxsSGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvdmVydmlld1J1bGVyRGVjb3JhdGlvbnMgPSB2aWV3TW9kZWwuZ2V0T3ZlcnZpZXdSdWxlckRlY29yYXRpb25zKCk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgb3ZlcnZpZXdSdWxlckRlY29yYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGRlY29yYXRpb24gPSBvdmVydmlld1J1bGVyRGVjb3JhdGlvbnNbaV07XG5cdFx0XHRcdGlmICghZGVjb3JhdGlvbi5vcHRpb25zLm92ZXJ2aWV3UnVsZXIpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB2aWV3Wm9uZUluZm8gPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldFZpZXdab25lTGF5b3V0SW5mbyhkZWNvcmF0aW9uLnZpZXdab25lSWQpO1xuXG5cdFx0XHRcdGlmICghdmlld1pvbmVJbmZvKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBmaWxsU3R5bGUgPSB0aGlzLmdldENvbG9yKGRlY29yYXRpb24ub3B0aW9ucy5vdmVydmlld1J1bGVyLmNvbG9yKSA/PyAnIzAwMDAwMCc7XG5cdFx0XHRcdGxldCB4ID0gMDtcblx0XHRcdFx0c3dpdGNoIChkZWNvcmF0aW9uLm9wdGlvbnMub3ZlcnZpZXdSdWxlci5wb3NpdGlvbikge1xuXHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tPdmVydmlld1J1bGVyTGFuZS5MZWZ0OlxuXHRcdFx0XHRcdFx0eCA9IDA7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIE5vdGVib29rT3ZlcnZpZXdSdWxlckxhbmUuQ2VudGVyOlxuXHRcdFx0XHRcdFx0eCA9IGxhbmVXaWR0aDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tPdmVydmlld1J1bGVyTGFuZS5SaWdodDpcblx0XHRcdFx0XHRcdHggPSBsYW5lV2lkdGggKiAyO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgd2lkdGggPSBkZWNvcmF0aW9uLm9wdGlvbnMub3ZlcnZpZXdSdWxlci5wb3NpdGlvbiA9PT0gTm90ZWJvb2tPdmVydmlld1J1bGVyTGFuZS5GdWxsID8gbGFuZVdpZHRoICogMyA6IGxhbmVXaWR0aDtcblxuXHRcdFx0XHRjdHguZmlsbFN0eWxlID0gZmlsbFN0eWxlO1xuXG5cdFx0XHRcdGNvbnN0IHZpZXdab25lSGVpZ2h0ID0gKHZpZXdab25lSW5mby5oZWlnaHQgLyBzY3JvbGxIZWlnaHQpICogcmF0aW8gKiBoZWlnaHQ7XG5cdFx0XHRcdGNvbnN0IHZpZXdab25lVG9wID0gKHZpZXdab25lSW5mby50b3AgLyBzY3JvbGxIZWlnaHQpICogcmF0aW8gKiBoZWlnaHQ7XG5cblx0XHRcdFx0Y3R4LmZpbGxSZWN0KHgsIHZpZXdab25lVG9wLCB3aWR0aCwgdmlld1pvbmVIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHlCQUFzQztBQUMvQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWUsZ0JBQWdCO0FBQ3hDLFNBQWtDLGlDQUFpQztBQUU1RCxJQUFNLHdCQUFOLGNBQW9DLFNBQVM7QUFBQSxFQUluRCxZQUFxQixnQkFBeUMsV0FBdUMsY0FBNkI7QUFDakksVUFBTSxZQUFZO0FBREU7QUFGckIsU0FBUSxTQUFTO0FBSWhCLFNBQUssV0FBVyxrQkFBa0IsU0FBUyxjQUFjLFFBQVEsQ0FBQztBQUNsRSxTQUFLLFNBQVMsWUFBWSxVQUFVO0FBQ3BDLFNBQUssU0FBUyxnQkFBZ0IsSUFBSTtBQUNsQyxTQUFLLFNBQVMsV0FBVyxRQUFRO0FBRWpDLGNBQVUsWUFBWSxLQUFLLFNBQVMsT0FBTztBQUUzQyxTQUFLLFVBQVUsZUFBZSx1QkFBdUIsTUFBTTtBQUMxRCxXQUFLLE9BQU87QUFBQSxJQUNiLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxXQUFXLFlBQVksVUFBVSxLQUFLLFNBQVMsT0FBTyxDQUFDLEVBQUUsWUFBWSxNQUFNO0FBQ3pGLFdBQUssT0FBTztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsU0FBUztBQUNSLFVBQU0sUUFBUTtBQUNk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
