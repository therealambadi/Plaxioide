import "./selections.css";
import { DynamicViewOverlay } from "../../view/dynamicViewOverlay.js";
import { editorSelectionForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
var CornerStyle = /* @__PURE__ */ ((CornerStyle2) => {
  CornerStyle2[CornerStyle2["EXTERN"] = 0] = "EXTERN";
  CornerStyle2[CornerStyle2["INTERN"] = 1] = "INTERN";
  CornerStyle2[CornerStyle2["FLAT"] = 2] = "FLAT";
  return CornerStyle2;
})(CornerStyle || {});
class HorizontalRangeWithStyle {
  constructor(other) {
    this.left = other.left;
    this.width = other.width;
    this.startStyle = null;
    this.endStyle = null;
  }
}
class LineVisibleRangesWithStyle {
  constructor(lineNumber, ranges) {
    this.lineNumber = lineNumber;
    this.ranges = ranges;
  }
}
function toStyledRange(item) {
  return new HorizontalRangeWithStyle(item);
}
function toStyled(item) {
  return new LineVisibleRangesWithStyle(item.lineNumber, item.ranges.map(toStyledRange));
}
const _SelectionsOverlay = class _SelectionsOverlay extends DynamicViewOverlay {
  constructor(context) {
    super();
    this._previousFrameVisibleRangesWithStyle = [];
    this._context = context;
    const options = this._context.configuration.options;
    this._roundedSelection = options.get(EditorOption.roundedSelection);
    this._typicalHalfwidthCharacterWidth = options.get(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
    this._selections = [];
    this._renderResult = null;
    this._context.addEventHandler(this);
  }
  dispose() {
    this._context.removeEventHandler(this);
    this._renderResult = null;
    super.dispose();
  }
  // --- begin event handlers
  onConfigurationChanged(e) {
    const options = this._context.configuration.options;
    this._roundedSelection = options.get(EditorOption.roundedSelection);
    this._typicalHalfwidthCharacterWidth = options.get(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
    return true;
  }
  onCursorStateChanged(e) {
    this._selections = e.selections.slice(0);
    return true;
  }
  onDecorationsChanged(e) {
    return true;
  }
  onFlushed(e) {
    return true;
  }
  onLinesChanged(e) {
    return true;
  }
  onLinesDeleted(e) {
    return true;
  }
  onLinesInserted(e) {
    return true;
  }
  onScrollChanged(e) {
    return e.scrollTopChanged;
  }
  onZonesChanged(e) {
    return true;
  }
  // --- end event handlers
  _visibleRangesHaveGaps(linesVisibleRanges) {
    for (let i = 0, len = linesVisibleRanges.length; i < len; i++) {
      const lineVisibleRanges = linesVisibleRanges[i];
      if (lineVisibleRanges.ranges.length > 1) {
        return true;
      }
    }
    return false;
  }
  _enrichVisibleRangesWithStyle(viewport, linesVisibleRanges, previousFrame) {
    const epsilon = this._typicalHalfwidthCharacterWidth / 4;
    let previousFrameTop = null;
    let previousFrameBottom = null;
    if (previousFrame && previousFrame.length > 0 && linesVisibleRanges.length > 0) {
      const topLineNumber = linesVisibleRanges[0].lineNumber;
      if (topLineNumber === viewport.startLineNumber) {
        for (let i = 0; !previousFrameTop && i < previousFrame.length; i++) {
          if (previousFrame[i].lineNumber === topLineNumber) {
            previousFrameTop = previousFrame[i].ranges[0];
          }
        }
      }
      const bottomLineNumber = linesVisibleRanges[linesVisibleRanges.length - 1].lineNumber;
      if (bottomLineNumber === viewport.endLineNumber) {
        for (let i = previousFrame.length - 1; !previousFrameBottom && i >= 0; i--) {
          if (previousFrame[i].lineNumber === bottomLineNumber) {
            previousFrameBottom = previousFrame[i].ranges[0];
          }
        }
      }
      if (previousFrameTop && !previousFrameTop.startStyle) {
        previousFrameTop = null;
      }
      if (previousFrameBottom && !previousFrameBottom.startStyle) {
        previousFrameBottom = null;
      }
    }
    for (let i = 0, len = linesVisibleRanges.length; i < len; i++) {
      const curLineRange = linesVisibleRanges[i].ranges[0];
      const curLeft = curLineRange.left;
      const curRight = curLineRange.left + curLineRange.width;
      const startStyle = {
        top: 0 /* EXTERN */,
        bottom: 0 /* EXTERN */
      };
      const endStyle = {
        top: 0 /* EXTERN */,
        bottom: 0 /* EXTERN */
      };
      if (i > 0) {
        const prevLeft = linesVisibleRanges[i - 1].ranges[0].left;
        const prevRight = linesVisibleRanges[i - 1].ranges[0].left + linesVisibleRanges[i - 1].ranges[0].width;
        if (abs(curLeft - prevLeft) < epsilon) {
          startStyle.top = 2 /* FLAT */;
        } else if (curLeft > prevLeft) {
          startStyle.top = 1 /* INTERN */;
        }
        if (abs(curRight - prevRight) < epsilon) {
          endStyle.top = 2 /* FLAT */;
        } else if (prevLeft < curRight && curRight < prevRight) {
          endStyle.top = 1 /* INTERN */;
        }
      } else if (previousFrameTop) {
        startStyle.top = previousFrameTop.startStyle.top;
        endStyle.top = previousFrameTop.endStyle.top;
      }
      if (i + 1 < len) {
        const nextLeft = linesVisibleRanges[i + 1].ranges[0].left;
        const nextRight = linesVisibleRanges[i + 1].ranges[0].left + linesVisibleRanges[i + 1].ranges[0].width;
        if (abs(curLeft - nextLeft) < epsilon) {
          startStyle.bottom = 2 /* FLAT */;
        } else if (nextLeft < curLeft && curLeft < nextRight) {
          startStyle.bottom = 1 /* INTERN */;
        }
        if (abs(curRight - nextRight) < epsilon) {
          endStyle.bottom = 2 /* FLAT */;
        } else if (curRight < nextRight) {
          endStyle.bottom = 1 /* INTERN */;
        }
      } else if (previousFrameBottom) {
        startStyle.bottom = previousFrameBottom.startStyle.bottom;
        endStyle.bottom = previousFrameBottom.endStyle.bottom;
      }
      curLineRange.startStyle = startStyle;
      curLineRange.endStyle = endStyle;
    }
  }
  _getVisibleRangesWithStyle(selection, ctx, previousFrame) {
    const _linesVisibleRanges = ctx.linesVisibleRangesForRange(selection, true) || [];
    const linesVisibleRanges = _linesVisibleRanges.map(toStyled);
    const visibleRangesHaveGaps = this._visibleRangesHaveGaps(linesVisibleRanges);
    if (!visibleRangesHaveGaps && this._roundedSelection) {
      this._enrichVisibleRangesWithStyle(ctx.visibleRange, linesVisibleRanges, previousFrame);
    }
    return linesVisibleRanges;
  }
  _createSelectionPiece(top, bottom, className, left, width) {
    return '<div class="cslr ' + className + '" style="top:' + top.toString() + "px;bottom:" + bottom.toString() + "px;left:" + left.toString() + "px;width:" + width.toString() + 'px;"></div>';
  }
  _actualRenderOneSelection(output2, visibleStartLineNumber, hasMultipleSelections, visibleRanges) {
    if (visibleRanges.length === 0) {
      return;
    }
    const visibleRangesHaveStyle = !!visibleRanges[0].ranges[0].startStyle;
    const firstLineNumber = visibleRanges[0].lineNumber;
    const lastLineNumber = visibleRanges[visibleRanges.length - 1].lineNumber;
    for (let i = 0, len = visibleRanges.length; i < len; i++) {
      const lineVisibleRanges = visibleRanges[i];
      const lineNumber = lineVisibleRanges.lineNumber;
      const lineIndex = lineNumber - visibleStartLineNumber;
      const top = hasMultipleSelections ? lineNumber === firstLineNumber ? 1 : 0 : 0;
      const bottom = hasMultipleSelections ? lineNumber !== firstLineNumber && lineNumber === lastLineNumber ? 1 : 0 : 0;
      let innerCornerOutput = "";
      let restOfSelectionOutput = "";
      for (let j = 0, lenJ = lineVisibleRanges.ranges.length; j < lenJ; j++) {
        const visibleRange = lineVisibleRanges.ranges[j];
        if (visibleRangesHaveStyle) {
          const startStyle = visibleRange.startStyle;
          const endStyle = visibleRange.endStyle;
          if (startStyle.top === 1 /* INTERN */ || startStyle.bottom === 1 /* INTERN */) {
            innerCornerOutput += this._createSelectionPiece(top, bottom, _SelectionsOverlay.SELECTION_CLASS_NAME, visibleRange.left - _SelectionsOverlay.ROUNDED_PIECE_WIDTH, _SelectionsOverlay.ROUNDED_PIECE_WIDTH);
            let className2 = _SelectionsOverlay.EDITOR_BACKGROUND_CLASS_NAME;
            if (startStyle.top === 1 /* INTERN */) {
              className2 += " " + _SelectionsOverlay.SELECTION_TOP_RIGHT;
            }
            if (startStyle.bottom === 1 /* INTERN */) {
              className2 += " " + _SelectionsOverlay.SELECTION_BOTTOM_RIGHT;
            }
            innerCornerOutput += this._createSelectionPiece(top, bottom, className2, visibleRange.left - _SelectionsOverlay.ROUNDED_PIECE_WIDTH, _SelectionsOverlay.ROUNDED_PIECE_WIDTH);
          }
          if (endStyle.top === 1 /* INTERN */ || endStyle.bottom === 1 /* INTERN */) {
            innerCornerOutput += this._createSelectionPiece(top, bottom, _SelectionsOverlay.SELECTION_CLASS_NAME, visibleRange.left + visibleRange.width, _SelectionsOverlay.ROUNDED_PIECE_WIDTH);
            let className2 = _SelectionsOverlay.EDITOR_BACKGROUND_CLASS_NAME;
            if (endStyle.top === 1 /* INTERN */) {
              className2 += " " + _SelectionsOverlay.SELECTION_TOP_LEFT;
            }
            if (endStyle.bottom === 1 /* INTERN */) {
              className2 += " " + _SelectionsOverlay.SELECTION_BOTTOM_LEFT;
            }
            innerCornerOutput += this._createSelectionPiece(top, bottom, className2, visibleRange.left + visibleRange.width, _SelectionsOverlay.ROUNDED_PIECE_WIDTH);
          }
        }
        let className = _SelectionsOverlay.SELECTION_CLASS_NAME;
        if (visibleRangesHaveStyle) {
          const startStyle = visibleRange.startStyle;
          const endStyle = visibleRange.endStyle;
          if (startStyle.top === 0 /* EXTERN */) {
            className += " " + _SelectionsOverlay.SELECTION_TOP_LEFT;
          }
          if (startStyle.bottom === 0 /* EXTERN */) {
            className += " " + _SelectionsOverlay.SELECTION_BOTTOM_LEFT;
          }
          if (endStyle.top === 0 /* EXTERN */) {
            className += " " + _SelectionsOverlay.SELECTION_TOP_RIGHT;
          }
          if (endStyle.bottom === 0 /* EXTERN */) {
            className += " " + _SelectionsOverlay.SELECTION_BOTTOM_RIGHT;
          }
        }
        restOfSelectionOutput += this._createSelectionPiece(top, bottom, className, visibleRange.left, visibleRange.width);
      }
      output2[lineIndex][0] += innerCornerOutput;
      output2[lineIndex][1] += restOfSelectionOutput;
    }
  }
  prepareRender(ctx) {
    const output = [];
    const visibleStartLineNumber = ctx.visibleRange.startLineNumber;
    const visibleEndLineNumber = ctx.visibleRange.endLineNumber;
    for (let lineNumber = visibleStartLineNumber; lineNumber <= visibleEndLineNumber; lineNumber++) {
      const lineIndex = lineNumber - visibleStartLineNumber;
      output[lineIndex] = ["", ""];
    }
    const thisFrameVisibleRangesWithStyle = [];
    for (let i = 0, len = this._selections.length; i < len; i++) {
      const selection = this._selections[i];
      if (selection.isEmpty()) {
        thisFrameVisibleRangesWithStyle[i] = null;
        continue;
      }
      const visibleRangesWithStyle = this._getVisibleRangesWithStyle(selection, ctx, this._previousFrameVisibleRangesWithStyle[i]);
      thisFrameVisibleRangesWithStyle[i] = visibleRangesWithStyle;
      this._actualRenderOneSelection(output, visibleStartLineNumber, this._selections.length > 1, visibleRangesWithStyle);
    }
    this._previousFrameVisibleRangesWithStyle = thisFrameVisibleRangesWithStyle;
    this._renderResult = output.map(([internalCorners, restOfSelection]) => internalCorners + restOfSelection);
  }
  render(startLineNumber, lineNumber) {
    if (!this._renderResult) {
      return "";
    }
    const lineIndex = lineNumber - startLineNumber;
    if (lineIndex < 0 || lineIndex >= this._renderResult.length) {
      return "";
    }
    return this._renderResult[lineIndex];
  }
};
_SelectionsOverlay.SELECTION_CLASS_NAME = "selected-text";
_SelectionsOverlay.SELECTION_TOP_LEFT = "top-left-radius";
_SelectionsOverlay.SELECTION_BOTTOM_LEFT = "bottom-left-radius";
_SelectionsOverlay.SELECTION_TOP_RIGHT = "top-right-radius";
_SelectionsOverlay.SELECTION_BOTTOM_RIGHT = "bottom-right-radius";
_SelectionsOverlay.EDITOR_BACKGROUND_CLASS_NAME = "monaco-editor-background";
_SelectionsOverlay.ROUNDED_PIECE_WIDTH = 10;
let SelectionsOverlay = _SelectionsOverlay;
registerThemingParticipant((theme, collector) => {
  const editorSelectionForegroundColor = theme.getColor(editorSelectionForeground);
  if (editorSelectionForegroundColor && !editorSelectionForegroundColor.isTransparent()) {
    collector.addRule(`.monaco-editor .view-line span.inline-selected-text { color: ${editorSelectionForegroundColor}; }`);
  }
});
function abs(n) {
  return n < 0 ? -n : n;
}
export {
  SelectionsOverlay
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvc2VsZWN0aW9ucy9zZWxlY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL3NlbGVjdGlvbnMuY3NzJztcbmltcG9ydCB7IER5bmFtaWNWaWV3T3ZlcmxheSB9IGZyb20gJy4uLy4uL3ZpZXcvZHluYW1pY1ZpZXdPdmVybGF5LmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSG9yaXpvbnRhbFJhbmdlLCBMaW5lVmlzaWJsZVJhbmdlcywgUmVuZGVyaW5nQ29udGV4dCB9IGZyb20gJy4uLy4uL3ZpZXcvcmVuZGVyaW5nQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0ICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JTZWxlY3Rpb25Gb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5cbmNvbnN0IGVudW0gQ29ybmVyU3R5bGUge1xuXHRFWFRFUk4sXG5cdElOVEVSTixcblx0RkxBVFxufVxuXG5pbnRlcmZhY2UgSVZpc2libGVSYW5nZUVuZFBvaW50U3R5bGUge1xuXHR0b3A6IENvcm5lclN0eWxlO1xuXHRib3R0b206IENvcm5lclN0eWxlO1xufVxuXG5jbGFzcyBIb3Jpem9udGFsUmFuZ2VXaXRoU3R5bGUge1xuXHRwdWJsaWMgbGVmdDogbnVtYmVyO1xuXHRwdWJsaWMgd2lkdGg6IG51bWJlcjtcblx0cHVibGljIHN0YXJ0U3R5bGU6IElWaXNpYmxlUmFuZ2VFbmRQb2ludFN0eWxlIHwgbnVsbDtcblx0cHVibGljIGVuZFN0eWxlOiBJVmlzaWJsZVJhbmdlRW5kUG9pbnRTdHlsZSB8IG51bGw7XG5cblx0Y29uc3RydWN0b3Iob3RoZXI6IEhvcml6b250YWxSYW5nZSkge1xuXHRcdHRoaXMubGVmdCA9IG90aGVyLmxlZnQ7XG5cdFx0dGhpcy53aWR0aCA9IG90aGVyLndpZHRoO1xuXHRcdHRoaXMuc3RhcnRTdHlsZSA9IG51bGw7XG5cdFx0dGhpcy5lbmRTdHlsZSA9IG51bGw7XG5cdH1cbn1cblxuY2xhc3MgTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGUge1xuXHRwdWJsaWMgbGluZU51bWJlcjogbnVtYmVyO1xuXHRwdWJsaWMgcmFuZ2VzOiBIb3Jpem9udGFsUmFuZ2VXaXRoU3R5bGVbXTtcblxuXHRjb25zdHJ1Y3RvcihsaW5lTnVtYmVyOiBudW1iZXIsIHJhbmdlczogSG9yaXpvbnRhbFJhbmdlV2l0aFN0eWxlW10pIHtcblx0XHR0aGlzLmxpbmVOdW1iZXIgPSBsaW5lTnVtYmVyO1xuXHRcdHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHRvU3R5bGVkUmFuZ2UoaXRlbTogSG9yaXpvbnRhbFJhbmdlKTogSG9yaXpvbnRhbFJhbmdlV2l0aFN0eWxlIHtcblx0cmV0dXJuIG5ldyBIb3Jpem9udGFsUmFuZ2VXaXRoU3R5bGUoaXRlbSk7XG59XG5cbmZ1bmN0aW9uIHRvU3R5bGVkKGl0ZW06IExpbmVWaXNpYmxlUmFuZ2VzKTogTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGUge1xuXHRyZXR1cm4gbmV3IExpbmVWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlKGl0ZW0ubGluZU51bWJlciwgaXRlbS5yYW5nZXMubWFwKHRvU3R5bGVkUmFuZ2UpKTtcbn1cblxuLyoqXG4gKiBUaGlzIHZpZXcgcGFydCBkaXNwbGF5cyBzZWxlY3RlZCB0ZXh0IHRvIHRoZSB1c2VyLiBFdmVyeSBsaW5lIGhhcyBpdHMgb3duIHNlbGVjdGlvbiBvdmVybGF5LlxuICovXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uc092ZXJsYXkgZXh0ZW5kcyBEeW5hbWljVmlld092ZXJsYXkge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNFTEVDVElPTl9DTEFTU19OQU1FID0gJ3NlbGVjdGVkLXRleHQnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTRUxFQ1RJT05fVE9QX0xFRlQgPSAndG9wLWxlZnQtcmFkaXVzJztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU0VMRUNUSU9OX0JPVFRPTV9MRUZUID0gJ2JvdHRvbS1sZWZ0LXJhZGl1cyc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNFTEVDVElPTl9UT1BfUklHSFQgPSAndG9wLXJpZ2h0LXJhZGl1cyc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNFTEVDVElPTl9CT1RUT01fUklHSFQgPSAnYm90dG9tLXJpZ2h0LXJhZGl1cyc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVESVRPUl9CQUNLR1JPVU5EX0NMQVNTX05BTUUgPSAnbW9uYWNvLWVkaXRvci1iYWNrZ3JvdW5kJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBST1VOREVEX1BJRUNFX1dJRFRIID0gMTA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dDogVmlld0NvbnRleHQ7XG5cdHByaXZhdGUgX3JvdW5kZWRTZWxlY3Rpb246IGJvb2xlYW47XG5cdHByaXZhdGUgX3R5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDogbnVtYmVyO1xuXHRwcml2YXRlIF9zZWxlY3Rpb25zOiBSYW5nZVtdO1xuXHRwcml2YXRlIF9yZW5kZXJSZXN1bHQ6IHN0cmluZ1tdIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdHRoaXMuX3JvdW5kZWRTZWxlY3Rpb24gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ucm91bmRlZFNlbGVjdGlvbik7XG5cdFx0dGhpcy5fdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKS50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cdFx0dGhpcy5fc2VsZWN0aW9ucyA9IFtdO1xuXHRcdHRoaXMuX3JlbmRlclJlc3VsdCA9IG51bGw7XG5cdFx0dGhpcy5fY29udGV4dC5hZGRFdmVudEhhbmRsZXIodGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0LnJlbW92ZUV2ZW50SGFuZGxlcih0aGlzKTtcblx0XHR0aGlzLl9yZW5kZXJSZXN1bHQgPSBudWxsO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8vIC0tLSBiZWdpbiBldmVudCBoYW5kbGVyc1xuXG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0dGhpcy5fcm91bmRlZFNlbGVjdGlvbiA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yb3VuZGVkU2VsZWN0aW9uKTtcblx0XHR0aGlzLl90eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGggPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25DdXJzb3JTdGF0ZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9zZWxlY3Rpb25zID0gZS5zZWxlY3Rpb25zLnNsaWNlKDApO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIHRydWUgZm9yIGlubGluZSBkZWNvcmF0aW9ucyB0aGF0IGNhbiBlbmQgdXAgcmVsYXlvdXRpbmcgdGV4dFxuXHRcdHJldHVybiB0cnVlOy8vZS5pbmxpbmVEZWNvcmF0aW9uc0NoYW5nZWQ7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uRmx1c2hlZChlOiB2aWV3RXZlbnRzLlZpZXdGbHVzaGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0RlbGV0ZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZXNEZWxldGVkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblNjcm9sbENoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3U2Nyb2xsQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGUuc2Nyb2xsVG9wQ2hhbmdlZDtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25ab25lc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Wm9uZXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8vIC0tLSBlbmQgZXZlbnQgaGFuZGxlcnNcblxuXHRwcml2YXRlIF92aXNpYmxlUmFuZ2VzSGF2ZUdhcHMobGluZXNWaXNpYmxlUmFuZ2VzOiBMaW5lVmlzaWJsZVJhbmdlc1dpdGhTdHlsZVtdKTogYm9vbGVhbiB7XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXNWaXNpYmxlUmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lVmlzaWJsZVJhbmdlcyA9IGxpbmVzVmlzaWJsZVJhbmdlc1tpXTtcblxuXHRcdFx0aWYgKGxpbmVWaXNpYmxlUmFuZ2VzLnJhbmdlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdC8vIFRoZXJlIGFyZSB0d28gcmFuZ2VzIG9uIHRoZSBzYW1lIGxpbmVcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5yaWNoVmlzaWJsZVJhbmdlc1dpdGhTdHlsZSh2aWV3cG9ydDogUmFuZ2UsIGxpbmVzVmlzaWJsZVJhbmdlczogTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbXSwgcHJldmlvdXNGcmFtZTogTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbXSB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBlcHNpbG9uID0gdGhpcy5fdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoIC8gNDtcblx0XHRsZXQgcHJldmlvdXNGcmFtZVRvcDogSG9yaXpvbnRhbFJhbmdlV2l0aFN0eWxlIHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IHByZXZpb3VzRnJhbWVCb3R0b206IEhvcml6b250YWxSYW5nZVdpdGhTdHlsZSB8IG51bGwgPSBudWxsO1xuXG5cdFx0aWYgKHByZXZpb3VzRnJhbWUgJiYgcHJldmlvdXNGcmFtZS5sZW5ndGggPiAwICYmIGxpbmVzVmlzaWJsZVJhbmdlcy5sZW5ndGggPiAwKSB7XG5cblx0XHRcdGNvbnN0IHRvcExpbmVOdW1iZXIgPSBsaW5lc1Zpc2libGVSYW5nZXNbMF0ubGluZU51bWJlcjtcblx0XHRcdGlmICh0b3BMaW5lTnVtYmVyID09PSB2aWV3cG9ydC5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7ICFwcmV2aW91c0ZyYW1lVG9wICYmIGkgPCBwcmV2aW91c0ZyYW1lLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKHByZXZpb3VzRnJhbWVbaV0ubGluZU51bWJlciA9PT0gdG9wTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0cHJldmlvdXNGcmFtZVRvcCA9IHByZXZpb3VzRnJhbWVbaV0ucmFuZ2VzWzBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBib3R0b21MaW5lTnVtYmVyID0gbGluZXNWaXNpYmxlUmFuZ2VzW2xpbmVzVmlzaWJsZVJhbmdlcy5sZW5ndGggLSAxXS5saW5lTnVtYmVyO1xuXHRcdFx0aWYgKGJvdHRvbUxpbmVOdW1iZXIgPT09IHZpZXdwb3J0LmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IHByZXZpb3VzRnJhbWUubGVuZ3RoIC0gMTsgIXByZXZpb3VzRnJhbWVCb3R0b20gJiYgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRpZiAocHJldmlvdXNGcmFtZVtpXS5saW5lTnVtYmVyID09PSBib3R0b21MaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRwcmV2aW91c0ZyYW1lQm90dG9tID0gcHJldmlvdXNGcmFtZVtpXS5yYW5nZXNbMF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcmV2aW91c0ZyYW1lVG9wICYmICFwcmV2aW91c0ZyYW1lVG9wLnN0YXJ0U3R5bGUpIHtcblx0XHRcdFx0cHJldmlvdXNGcmFtZVRvcCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAocHJldmlvdXNGcmFtZUJvdHRvbSAmJiAhcHJldmlvdXNGcmFtZUJvdHRvbS5zdGFydFN0eWxlKSB7XG5cdFx0XHRcdHByZXZpb3VzRnJhbWVCb3R0b20gPSBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lc1Zpc2libGVSYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdC8vIFdlIGtub3cgZm9yIGEgZmFjdCB0aGF0IHRoZXJlIGlzIHByZWNpc2VseSBvbmUgcmFuZ2Ugb24gZWFjaCBsaW5lXG5cdFx0XHRjb25zdCBjdXJMaW5lUmFuZ2UgPSBsaW5lc1Zpc2libGVSYW5nZXNbaV0ucmFuZ2VzWzBdO1xuXHRcdFx0Y29uc3QgY3VyTGVmdCA9IGN1ckxpbmVSYW5nZS5sZWZ0O1xuXHRcdFx0Y29uc3QgY3VyUmlnaHQgPSBjdXJMaW5lUmFuZ2UubGVmdCArIGN1ckxpbmVSYW5nZS53aWR0aDtcblxuXHRcdFx0Y29uc3Qgc3RhcnRTdHlsZSA9IHtcblx0XHRcdFx0dG9wOiBDb3JuZXJTdHlsZS5FWFRFUk4sXG5cdFx0XHRcdGJvdHRvbTogQ29ybmVyU3R5bGUuRVhURVJOXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBlbmRTdHlsZSA9IHtcblx0XHRcdFx0dG9wOiBDb3JuZXJTdHlsZS5FWFRFUk4sXG5cdFx0XHRcdGJvdHRvbTogQ29ybmVyU3R5bGUuRVhURVJOXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0Ly8gTG9vayBhYm92ZVxuXHRcdFx0XHRjb25zdCBwcmV2TGVmdCA9IGxpbmVzVmlzaWJsZVJhbmdlc1tpIC0gMV0ucmFuZ2VzWzBdLmxlZnQ7XG5cdFx0XHRcdGNvbnN0IHByZXZSaWdodCA9IGxpbmVzVmlzaWJsZVJhbmdlc1tpIC0gMV0ucmFuZ2VzWzBdLmxlZnQgKyBsaW5lc1Zpc2libGVSYW5nZXNbaSAtIDFdLnJhbmdlc1swXS53aWR0aDtcblxuXHRcdFx0XHRpZiAoYWJzKGN1ckxlZnQgLSBwcmV2TGVmdCkgPCBlcHNpbG9uKSB7XG5cdFx0XHRcdFx0c3RhcnRTdHlsZS50b3AgPSBDb3JuZXJTdHlsZS5GTEFUO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGN1ckxlZnQgPiBwcmV2TGVmdCkge1xuXHRcdFx0XHRcdHN0YXJ0U3R5bGUudG9wID0gQ29ybmVyU3R5bGUuSU5URVJOO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGFicyhjdXJSaWdodCAtIHByZXZSaWdodCkgPCBlcHNpbG9uKSB7XG5cdFx0XHRcdFx0ZW5kU3R5bGUudG9wID0gQ29ybmVyU3R5bGUuRkxBVDtcblx0XHRcdFx0fSBlbHNlIGlmIChwcmV2TGVmdCA8IGN1clJpZ2h0ICYmIGN1clJpZ2h0IDwgcHJldlJpZ2h0KSB7XG5cdFx0XHRcdFx0ZW5kU3R5bGUudG9wID0gQ29ybmVyU3R5bGUuSU5URVJOO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHByZXZpb3VzRnJhbWVUb3ApIHtcblx0XHRcdFx0Ly8gQWNjZXB0IHNvbWUgaGljY3VwcyBuZWFyIHRoZSB2aWV3cG9ydCBlZGdlcyB0byBzYXZlIG9uIHJlcGFpbnRzXG5cdFx0XHRcdHN0YXJ0U3R5bGUudG9wID0gcHJldmlvdXNGcmFtZVRvcC5zdGFydFN0eWxlIS50b3A7XG5cdFx0XHRcdGVuZFN0eWxlLnRvcCA9IHByZXZpb3VzRnJhbWVUb3AuZW5kU3R5bGUhLnRvcDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGkgKyAxIDwgbGVuKSB7XG5cdFx0XHRcdC8vIExvb2sgYmVsb3dcblx0XHRcdFx0Y29uc3QgbmV4dExlZnQgPSBsaW5lc1Zpc2libGVSYW5nZXNbaSArIDFdLnJhbmdlc1swXS5sZWZ0O1xuXHRcdFx0XHRjb25zdCBuZXh0UmlnaHQgPSBsaW5lc1Zpc2libGVSYW5nZXNbaSArIDFdLnJhbmdlc1swXS5sZWZ0ICsgbGluZXNWaXNpYmxlUmFuZ2VzW2kgKyAxXS5yYW5nZXNbMF0ud2lkdGg7XG5cblx0XHRcdFx0aWYgKGFicyhjdXJMZWZ0IC0gbmV4dExlZnQpIDwgZXBzaWxvbikge1xuXHRcdFx0XHRcdHN0YXJ0U3R5bGUuYm90dG9tID0gQ29ybmVyU3R5bGUuRkxBVDtcblx0XHRcdFx0fSBlbHNlIGlmIChuZXh0TGVmdCA8IGN1ckxlZnQgJiYgY3VyTGVmdCA8IG5leHRSaWdodCkge1xuXHRcdFx0XHRcdHN0YXJ0U3R5bGUuYm90dG9tID0gQ29ybmVyU3R5bGUuSU5URVJOO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGFicyhjdXJSaWdodCAtIG5leHRSaWdodCkgPCBlcHNpbG9uKSB7XG5cdFx0XHRcdFx0ZW5kU3R5bGUuYm90dG9tID0gQ29ybmVyU3R5bGUuRkxBVDtcblx0XHRcdFx0fSBlbHNlIGlmIChjdXJSaWdodCA8IG5leHRSaWdodCkge1xuXHRcdFx0XHRcdGVuZFN0eWxlLmJvdHRvbSA9IENvcm5lclN0eWxlLklOVEVSTjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChwcmV2aW91c0ZyYW1lQm90dG9tKSB7XG5cdFx0XHRcdC8vIEFjY2VwdCBzb21lIGhpY2N1cHMgbmVhciB0aGUgdmlld3BvcnQgZWRnZXMgdG8gc2F2ZSBvbiByZXBhaW50c1xuXHRcdFx0XHRzdGFydFN0eWxlLmJvdHRvbSA9IHByZXZpb3VzRnJhbWVCb3R0b20uc3RhcnRTdHlsZSEuYm90dG9tO1xuXHRcdFx0XHRlbmRTdHlsZS5ib3R0b20gPSBwcmV2aW91c0ZyYW1lQm90dG9tLmVuZFN0eWxlIS5ib3R0b207XG5cdFx0XHR9XG5cblx0XHRcdGN1ckxpbmVSYW5nZS5zdGFydFN0eWxlID0gc3RhcnRTdHlsZTtcblx0XHRcdGN1ckxpbmVSYW5nZS5lbmRTdHlsZSA9IGVuZFN0eWxlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldFZpc2libGVSYW5nZXNXaXRoU3R5bGUoc2VsZWN0aW9uOiBSYW5nZSwgY3R4OiBSZW5kZXJpbmdDb250ZXh0LCBwcmV2aW91c0ZyYW1lOiBMaW5lVmlzaWJsZVJhbmdlc1dpdGhTdHlsZVtdIHwgbnVsbCk6IExpbmVWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlW10ge1xuXHRcdGNvbnN0IF9saW5lc1Zpc2libGVSYW5nZXMgPSBjdHgubGluZXNWaXNpYmxlUmFuZ2VzRm9yUmFuZ2Uoc2VsZWN0aW9uLCB0cnVlKSB8fCBbXTtcblx0XHRjb25zdCBsaW5lc1Zpc2libGVSYW5nZXMgPSBfbGluZXNWaXNpYmxlUmFuZ2VzLm1hcCh0b1N0eWxlZCk7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlc0hhdmVHYXBzID0gdGhpcy5fdmlzaWJsZVJhbmdlc0hhdmVHYXBzKGxpbmVzVmlzaWJsZVJhbmdlcyk7XG5cblx0XHRpZiAoIXZpc2libGVSYW5nZXNIYXZlR2FwcyAmJiB0aGlzLl9yb3VuZGVkU2VsZWN0aW9uKSB7XG5cdFx0XHR0aGlzLl9lbnJpY2hWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlKGN0eC52aXNpYmxlUmFuZ2UsIGxpbmVzVmlzaWJsZVJhbmdlcywgcHJldmlvdXNGcmFtZSk7XG5cdFx0fVxuXG5cdFx0Ly8gVGhlIHZpc2libGUgcmFuZ2VzIGFyZSBzb3J0ZWQgVE9QLUJPVFRPTSBhbmQgTEVGVC1SSUdIVFxuXHRcdHJldHVybiBsaW5lc1Zpc2libGVSYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVTZWxlY3Rpb25QaWVjZSh0b3A6IG51bWJlciwgYm90dG9tOiBudW1iZXIsIGNsYXNzTmFtZTogc3RyaW5nLCBsZWZ0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiAoXG5cdFx0XHQnPGRpdiBjbGFzcz1cImNzbHIgJ1xuXHRcdFx0KyBjbGFzc05hbWVcblx0XHRcdCsgJ1wiIHN0eWxlPVwiJ1xuXHRcdFx0KyAndG9wOicgKyB0b3AudG9TdHJpbmcoKSArICdweDsnXG5cdFx0XHQrICdib3R0b206JyArIGJvdHRvbS50b1N0cmluZygpICsgJ3B4Oydcblx0XHRcdCsgJ2xlZnQ6JyArIGxlZnQudG9TdHJpbmcoKSArICdweDsnXG5cdFx0XHQrICd3aWR0aDonICsgd2lkdGgudG9TdHJpbmcoKSArICdweDsnXG5cdFx0XHQrICdcIj48L2Rpdj4nXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgX2FjdHVhbFJlbmRlck9uZVNlbGVjdGlvbihvdXRwdXQyOiBbc3RyaW5nLCBzdHJpbmddW10sIHZpc2libGVTdGFydExpbmVOdW1iZXI6IG51bWJlciwgaGFzTXVsdGlwbGVTZWxlY3Rpb25zOiBib29sZWFuLCB2aXNpYmxlUmFuZ2VzOiBMaW5lVmlzaWJsZVJhbmdlc1dpdGhTdHlsZVtdKTogdm9pZCB7XG5cdFx0aWYgKHZpc2libGVSYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlc0hhdmVTdHlsZSA9ICEhdmlzaWJsZVJhbmdlc1swXS5yYW5nZXNbMF0uc3RhcnRTdHlsZTtcblxuXHRcdGNvbnN0IGZpcnN0TGluZU51bWJlciA9IHZpc2libGVSYW5nZXNbMF0ubGluZU51bWJlcjtcblx0XHRjb25zdCBsYXN0TGluZU51bWJlciA9IHZpc2libGVSYW5nZXNbdmlzaWJsZVJhbmdlcy5sZW5ndGggLSAxXS5saW5lTnVtYmVyO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHZpc2libGVSYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmVWaXNpYmxlUmFuZ2VzID0gdmlzaWJsZVJhbmdlc1tpXTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBsaW5lVmlzaWJsZVJhbmdlcy5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgbGluZUluZGV4ID0gbGluZU51bWJlciAtIHZpc2libGVTdGFydExpbmVOdW1iZXI7XG5cblx0XHRcdGNvbnN0IHRvcCA9IGhhc011bHRpcGxlU2VsZWN0aW9ucyA/IChsaW5lTnVtYmVyID09PSBmaXJzdExpbmVOdW1iZXIgPyAxIDogMCkgOiAwO1xuXHRcdFx0Y29uc3QgYm90dG9tID0gaGFzTXVsdGlwbGVTZWxlY3Rpb25zID8gKGxpbmVOdW1iZXIgIT09IGZpcnN0TGluZU51bWJlciAmJiBsaW5lTnVtYmVyID09PSBsYXN0TGluZU51bWJlciA/IDEgOiAwKSA6IDA7XG5cblx0XHRcdGxldCBpbm5lckNvcm5lck91dHB1dCA9ICcnO1xuXHRcdFx0bGV0IHJlc3RPZlNlbGVjdGlvbk91dHB1dCA9ICcnO1xuXG5cdFx0XHRmb3IgKGxldCBqID0gMCwgbGVuSiA9IGxpbmVWaXNpYmxlUmFuZ2VzLnJhbmdlcy5sZW5ndGg7IGogPCBsZW5KOyBqKyspIHtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZVJhbmdlID0gbGluZVZpc2libGVSYW5nZXMucmFuZ2VzW2pdO1xuXG5cdFx0XHRcdGlmICh2aXNpYmxlUmFuZ2VzSGF2ZVN0eWxlKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRTdHlsZSA9IHZpc2libGVSYW5nZS5zdGFydFN0eWxlITtcblx0XHRcdFx0XHRjb25zdCBlbmRTdHlsZSA9IHZpc2libGVSYW5nZS5lbmRTdHlsZSE7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0U3R5bGUudG9wID09PSBDb3JuZXJTdHlsZS5JTlRFUk4gfHwgc3RhcnRTdHlsZS5ib3R0b20gPT09IENvcm5lclN0eWxlLklOVEVSTikge1xuXHRcdFx0XHRcdFx0Ly8gUmV2ZXJzZSByb3VuZGVkIGNvcm5lciB0byB0aGUgbGVmdFxuXG5cdFx0XHRcdFx0XHQvLyBGaXJzdCBjb21lcyB0aGUgc2VsZWN0aW9uIChibHVlIGxheWVyKVxuXHRcdFx0XHRcdFx0aW5uZXJDb3JuZXJPdXRwdXQgKz0gdGhpcy5fY3JlYXRlU2VsZWN0aW9uUGllY2UodG9wLCBib3R0b20sIFNlbGVjdGlvbnNPdmVybGF5LlNFTEVDVElPTl9DTEFTU19OQU1FLCB2aXNpYmxlUmFuZ2UubGVmdCAtIFNlbGVjdGlvbnNPdmVybGF5LlJPVU5ERURfUElFQ0VfV0lEVEgsIFNlbGVjdGlvbnNPdmVybGF5LlJPVU5ERURfUElFQ0VfV0lEVEgpO1xuXG5cdFx0XHRcdFx0XHQvLyBTZWNvbmQgY29tZXMgdGhlIGJhY2tncm91bmQgKHdoaXRlIGxheWVyKSB3aXRoIGludmVyc2UgYm9yZGVyIHJhZGl1c1xuXHRcdFx0XHRcdFx0bGV0IGNsYXNzTmFtZSA9IFNlbGVjdGlvbnNPdmVybGF5LkVESVRPUl9CQUNLR1JPVU5EX0NMQVNTX05BTUU7XG5cdFx0XHRcdFx0XHRpZiAoc3RhcnRTdHlsZS50b3AgPT09IENvcm5lclN0eWxlLklOVEVSTikge1xuXHRcdFx0XHRcdFx0XHRjbGFzc05hbWUgKz0gJyAnICsgU2VsZWN0aW9uc092ZXJsYXkuU0VMRUNUSU9OX1RPUF9SSUdIVDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChzdGFydFN0eWxlLmJvdHRvbSA9PT0gQ29ybmVyU3R5bGUuSU5URVJOKSB7XG5cdFx0XHRcdFx0XHRcdGNsYXNzTmFtZSArPSAnICcgKyBTZWxlY3Rpb25zT3ZlcmxheS5TRUxFQ1RJT05fQk9UVE9NX1JJR0hUO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aW5uZXJDb3JuZXJPdXRwdXQgKz0gdGhpcy5fY3JlYXRlU2VsZWN0aW9uUGllY2UodG9wLCBib3R0b20sIGNsYXNzTmFtZSwgdmlzaWJsZVJhbmdlLmxlZnQgLSBTZWxlY3Rpb25zT3ZlcmxheS5ST1VOREVEX1BJRUNFX1dJRFRILCBTZWxlY3Rpb25zT3ZlcmxheS5ST1VOREVEX1BJRUNFX1dJRFRIKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVuZFN0eWxlLnRvcCA9PT0gQ29ybmVyU3R5bGUuSU5URVJOIHx8IGVuZFN0eWxlLmJvdHRvbSA9PT0gQ29ybmVyU3R5bGUuSU5URVJOKSB7XG5cdFx0XHRcdFx0XHQvLyBSZXZlcnNlIHJvdW5kZWQgY29ybmVyIHRvIHRoZSByaWdodFxuXG5cdFx0XHRcdFx0XHQvLyBGaXJzdCBjb21lcyB0aGUgc2VsZWN0aW9uIChibHVlIGxheWVyKVxuXHRcdFx0XHRcdFx0aW5uZXJDb3JuZXJPdXRwdXQgKz0gdGhpcy5fY3JlYXRlU2VsZWN0aW9uUGllY2UodG9wLCBib3R0b20sIFNlbGVjdGlvbnNPdmVybGF5LlNFTEVDVElPTl9DTEFTU19OQU1FLCB2aXNpYmxlUmFuZ2UubGVmdCArIHZpc2libGVSYW5nZS53aWR0aCwgU2VsZWN0aW9uc092ZXJsYXkuUk9VTkRFRF9QSUVDRV9XSURUSCk7XG5cblx0XHRcdFx0XHRcdC8vIFNlY29uZCBjb21lcyB0aGUgYmFja2dyb3VuZCAod2hpdGUgbGF5ZXIpIHdpdGggaW52ZXJzZSBib3JkZXIgcmFkaXVzXG5cdFx0XHRcdFx0XHRsZXQgY2xhc3NOYW1lID0gU2VsZWN0aW9uc092ZXJsYXkuRURJVE9SX0JBQ0tHUk9VTkRfQ0xBU1NfTkFNRTtcblx0XHRcdFx0XHRcdGlmIChlbmRTdHlsZS50b3AgPT09IENvcm5lclN0eWxlLklOVEVSTikge1xuXHRcdFx0XHRcdFx0XHRjbGFzc05hbWUgKz0gJyAnICsgU2VsZWN0aW9uc092ZXJsYXkuU0VMRUNUSU9OX1RPUF9MRUZUO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGVuZFN0eWxlLmJvdHRvbSA9PT0gQ29ybmVyU3R5bGUuSU5URVJOKSB7XG5cdFx0XHRcdFx0XHRcdGNsYXNzTmFtZSArPSAnICcgKyBTZWxlY3Rpb25zT3ZlcmxheS5TRUxFQ1RJT05fQk9UVE9NX0xFRlQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpbm5lckNvcm5lck91dHB1dCArPSB0aGlzLl9jcmVhdGVTZWxlY3Rpb25QaWVjZSh0b3AsIGJvdHRvbSwgY2xhc3NOYW1lLCB2aXNpYmxlUmFuZ2UubGVmdCArIHZpc2libGVSYW5nZS53aWR0aCwgU2VsZWN0aW9uc092ZXJsYXkuUk9VTkRFRF9QSUVDRV9XSURUSCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IGNsYXNzTmFtZSA9IFNlbGVjdGlvbnNPdmVybGF5LlNFTEVDVElPTl9DTEFTU19OQU1FO1xuXHRcdFx0XHRpZiAodmlzaWJsZVJhbmdlc0hhdmVTdHlsZSkge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXJ0U3R5bGUgPSB2aXNpYmxlUmFuZ2Uuc3RhcnRTdHlsZSE7XG5cdFx0XHRcdFx0Y29uc3QgZW5kU3R5bGUgPSB2aXNpYmxlUmFuZ2UuZW5kU3R5bGUhO1xuXHRcdFx0XHRcdGlmIChzdGFydFN0eWxlLnRvcCA9PT0gQ29ybmVyU3R5bGUuRVhURVJOKSB7XG5cdFx0XHRcdFx0XHRjbGFzc05hbWUgKz0gJyAnICsgU2VsZWN0aW9uc092ZXJsYXkuU0VMRUNUSU9OX1RPUF9MRUZUO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RhcnRTdHlsZS5ib3R0b20gPT09IENvcm5lclN0eWxlLkVYVEVSTikge1xuXHRcdFx0XHRcdFx0Y2xhc3NOYW1lICs9ICcgJyArIFNlbGVjdGlvbnNPdmVybGF5LlNFTEVDVElPTl9CT1RUT01fTEVGVDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVuZFN0eWxlLnRvcCA9PT0gQ29ybmVyU3R5bGUuRVhURVJOKSB7XG5cdFx0XHRcdFx0XHRjbGFzc05hbWUgKz0gJyAnICsgU2VsZWN0aW9uc092ZXJsYXkuU0VMRUNUSU9OX1RPUF9SSUdIVDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVuZFN0eWxlLmJvdHRvbSA9PT0gQ29ybmVyU3R5bGUuRVhURVJOKSB7XG5cdFx0XHRcdFx0XHRjbGFzc05hbWUgKz0gJyAnICsgU2VsZWN0aW9uc092ZXJsYXkuU0VMRUNUSU9OX0JPVFRPTV9SSUdIVDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdE9mU2VsZWN0aW9uT3V0cHV0ICs9IHRoaXMuX2NyZWF0ZVNlbGVjdGlvblBpZWNlKHRvcCwgYm90dG9tLCBjbGFzc05hbWUsIHZpc2libGVSYW5nZS5sZWZ0LCB2aXNpYmxlUmFuZ2Uud2lkdGgpO1xuXHRcdFx0fVxuXG5cdFx0XHRvdXRwdXQyW2xpbmVJbmRleF1bMF0gKz0gaW5uZXJDb3JuZXJPdXRwdXQ7XG5cdFx0XHRvdXRwdXQyW2xpbmVJbmRleF1bMV0gKz0gcmVzdE9mU2VsZWN0aW9uT3V0cHV0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3ByZXZpb3VzRnJhbWVWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlOiAoTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbXSB8IG51bGwpW10gPSBbXTtcblx0cHVibGljIHByZXBhcmVSZW5kZXIoY3R4OiBSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cblx0XHQvLyBCdWlsZCBIVE1MIGZvciBpbm5lciBjb3JuZXJzIHNlcGFyYXRlIGZyb20gSFRNTCBmb3IgdGhlIHJlc3Qgb2Ygc2VsZWN0aW9ucyxcblx0XHQvLyBhcyB0aGUgaW5uZXIgY29ybmVyIEhUTUwgY2FuIGludGVyZmVyZSB3aXRoIHRoYXQgb2Ygb3RoZXIgc2VsZWN0aW9ucy5cblx0XHQvLyBJbiBmaW5hbCByZW5kZXIsIG1ha2Ugc3VyZSB0byBwbGFjZSB0aGUgaW5uZXIgY29ybmVyIEhUTUwgYmVmb3JlIHRoZSByZXN0IG9mIHNlbGVjdGlvbiBIVE1MLiBTZWUgaXNzdWUgIzc3Nzc3LlxuXHRcdGNvbnN0IG91dHB1dDogW3N0cmluZywgc3RyaW5nXVtdID0gW107XG5cdFx0Y29uc3QgdmlzaWJsZVN0YXJ0TGluZU51bWJlciA9IGN0eC52aXNpYmxlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IHZpc2libGVFbmRMaW5lTnVtYmVyID0gY3R4LnZpc2libGVSYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSB2aXNpYmxlU3RhcnRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IHZpc2libGVFbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdGNvbnN0IGxpbmVJbmRleCA9IGxpbmVOdW1iZXIgLSB2aXNpYmxlU3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0b3V0cHV0W2xpbmVJbmRleF0gPSBbJycsICcnXTtcblx0XHR9XG5cblx0XHRjb25zdCB0aGlzRnJhbWVWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlOiAoTGluZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbXSB8IG51bGwpW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fc2VsZWN0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5fc2VsZWN0aW9uc1tpXTtcblx0XHRcdGlmIChzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdHRoaXNGcmFtZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbaV0gPSBudWxsO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdmlzaWJsZVJhbmdlc1dpdGhTdHlsZSA9IHRoaXMuX2dldFZpc2libGVSYW5nZXNXaXRoU3R5bGUoc2VsZWN0aW9uLCBjdHgsIHRoaXMuX3ByZXZpb3VzRnJhbWVWaXNpYmxlUmFuZ2VzV2l0aFN0eWxlW2ldKTtcblx0XHRcdHRoaXNGcmFtZVZpc2libGVSYW5nZXNXaXRoU3R5bGVbaV0gPSB2aXNpYmxlUmFuZ2VzV2l0aFN0eWxlO1xuXHRcdFx0dGhpcy5fYWN0dWFsUmVuZGVyT25lU2VsZWN0aW9uKG91dHB1dCwgdmlzaWJsZVN0YXJ0TGluZU51bWJlciwgdGhpcy5fc2VsZWN0aW9ucy5sZW5ndGggPiAxLCB2aXNpYmxlUmFuZ2VzV2l0aFN0eWxlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9wcmV2aW91c0ZyYW1lVmlzaWJsZVJhbmdlc1dpdGhTdHlsZSA9IHRoaXNGcmFtZVZpc2libGVSYW5nZXNXaXRoU3R5bGU7XG5cdFx0dGhpcy5fcmVuZGVyUmVzdWx0ID0gb3V0cHV0Lm1hcCgoW2ludGVybmFsQ29ybmVycywgcmVzdE9mU2VsZWN0aW9uXSkgPT4gaW50ZXJuYWxDb3JuZXJzICsgcmVzdE9mU2VsZWN0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXIoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9yZW5kZXJSZXN1bHQpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0Y29uc3QgbGluZUluZGV4ID0gbGluZU51bWJlciAtIHN0YXJ0TGluZU51bWJlcjtcblx0XHRpZiAobGluZUluZGV4IDwgMCB8fCBsaW5lSW5kZXggPj0gdGhpcy5fcmVuZGVyUmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyUmVzdWx0W2xpbmVJbmRleF07XG5cdH1cbn1cblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0Y29uc3QgZWRpdG9yU2VsZWN0aW9uRm9yZWdyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yU2VsZWN0aW9uRm9yZWdyb3VuZCk7XG5cdGlmIChlZGl0b3JTZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IgJiYgIWVkaXRvclNlbGVjdGlvbkZvcmVncm91bmRDb2xvci5pc1RyYW5zcGFyZW50KCkpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLnZpZXctbGluZSBzcGFuLmlubGluZS1zZWxlY3RlZC10ZXh0IHsgY29sb3I6ICR7ZWRpdG9yU2VsZWN0aW9uRm9yZWdyb3VuZENvbG9yfTsgfWApO1xuXHR9XG59KTtcblxuZnVuY3Rpb24gYWJzKG46IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiBuIDwgMCA/IC1uIDogbjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU87QUFDUCxTQUFTLDBCQUEwQjtBQUtuQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLG9CQUFvQjtBQUU3QixJQUFXLGNBQVgsa0JBQVdBLGlCQUFYO0FBQ0MsRUFBQUEsMEJBQUE7QUFDQSxFQUFBQSwwQkFBQTtBQUNBLEVBQUFBLDBCQUFBO0FBSFUsU0FBQUE7QUFBQSxHQUFBO0FBV1gsTUFBTSx5QkFBeUI7QUFBQSxFQU05QixZQUFZLE9BQXdCO0FBQ25DLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssUUFBUSxNQUFNO0FBQ25CLFNBQUssYUFBYTtBQUNsQixTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUNEO0FBRUEsTUFBTSwyQkFBMkI7QUFBQSxFQUloQyxZQUFZLFlBQW9CLFFBQW9DO0FBQ25FLFNBQUssYUFBYTtBQUNsQixTQUFLLFNBQVM7QUFBQSxFQUNmO0FBQ0Q7QUFFQSxTQUFTLGNBQWMsTUFBaUQ7QUFDdkUsU0FBTyxJQUFJLHlCQUF5QixJQUFJO0FBQ3pDO0FBRUEsU0FBUyxTQUFTLE1BQXFEO0FBQ3RFLFNBQU8sSUFBSSwyQkFBMkIsS0FBSyxZQUFZLEtBQUssT0FBTyxJQUFJLGFBQWEsQ0FBQztBQUN0RjtBQUtPLE1BQU0scUJBQU4sTUFBTSwyQkFBMEIsbUJBQW1C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ekIsY0FBUSxTQUFTLEVBQUUsQ0FBQyxLQUFLO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQUEsRUFHTyxjQUFjLEtBQTZCO0FBS2pELFVBQU0sU0FBNkIsQ0FBQztBQUNwQyxVQUFNLHlCQUF5QixJQUFJLGFBQWE7QUFDaEQsVUFBTSx1QkFBdUIsSUFBSSxhQUFhO0FBQzlDLGFBQVMsYUFBYSx3QkFBd0IsY0FBYyxzQkFBc0IsY0FBYztBQUMvRixZQUFNLFlBQVksYUFBYTtBQUMvQixhQUFPLFNBQVMsSUFBSSxDQUFDLElBQUksRUFBRTtBQUFBLElBQzVCO0FBRUEsVUFBTSxrQ0FBMkUsQ0FBQztBQUNsRixhQUFTLElBQUksR0FBRyxNQUFNLEtBQUssWUFBWSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQzVELFlBQU0sWUFBWSxLQUFLLFlBQVksQ0FBQztBQUNwQyxVQUFJLFVBQVUsUUFBUSxHQUFHO0FBQ3hCLHdDQUFnQyxDQUFDLElBQUk7QUFDckM7QUFBQSxNQUNEO0FBRUEsWUFBTSx5QkFBeUIsS0FBSywyQkFBMkIsV0FBVyxLQUFLLEtBQUsscUNBQXFDLENBQUMsQ0FBQztBQUMzSCxzQ0FBZ0MsQ0FBQyxJQUFJO0FBQ3JDLFdBQUssMEJBQTBCLFFBQVEsd0JBQXdCLEtBQUssWUFBWSxTQUFTLEdBQUcsc0JBQXNCO0FBQUEsSUFDbkg7QUFFQSxTQUFLLHVDQUF1QztBQUM1QyxTQUFLLGdCQUFnQixPQUFPLElBQUksQ0FBQyxDQUFDLGlCQUFpQixlQUFlLE1BQU0sa0JBQWtCLGVBQWU7QUFBQSxFQUMxRztBQUFBLEVBRU8sT0FBTyxpQkFBeUIsWUFBNEI7QUFDbEUsUUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sWUFBWSxhQUFhO0FBQy9CLFFBQUksWUFBWSxLQUFLLGFBQWEsS0FBSyxjQUFjLFFBQVE7QUFDNUQsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLEtBQUssY0FBYyxTQUFTO0FBQUEsRUFDcEM7QUFDRDtBQWhWYSxtQkFFWSx1QkFBdUI7QUFGbkMsbUJBR1kscUJBQXFCO0FBSGpDLG1CQUlZLHdCQUF3QjtBQUpwQyxtQkFLWSxzQkFBc0I7QUFMbEMsbUJBTVkseUJBQXlCO0FBTnJDLG1CQU9ZLCtCQUErQjtBQVAzQyxtQkFTWSxzQkFBc0I7QUFUeEMsSUFBTSxvQkFBTjtBQWtWUCwyQkFBMkIsQ0FBQyxPQUFPLGNBQWM7QUFDaEQsUUFBTSxpQ0FBaUMsTUFBTSxTQUFTLHlCQUF5QjtBQUMvRSxNQUFJLGtDQUFrQyxDQUFDLCtCQUErQixjQUFjLEdBQUc7QUFDdEYsY0FBVSxRQUFRLGdFQUFnRSw4QkFBOEIsS0FBSztBQUFBLEVBQ3RIO0FBQ0QsQ0FBQztBQUVELFNBQVMsSUFBSSxHQUFtQjtBQUMvQixTQUFPLElBQUksSUFBSSxDQUFDLElBQUk7QUFDckI7IiwKICAibmFtZXMiOiBbIkNvcm5lclN0eWxlIiwgImNsYXNzTmFtZSJdCn0K
