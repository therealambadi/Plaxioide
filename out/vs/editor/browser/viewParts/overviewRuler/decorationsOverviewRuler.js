import { createFastDomNode } from "../../../../base/browser/fastDomNode.js";
import { Color } from "../../../../base/common/color.js";
import { ViewPart } from "../../view/viewPart.js";
import { Position } from "../../../common/core/position.js";
import { TokenizationRegistry } from "../../../common/languages.js";
import { editorCursorForeground, editorOverviewRulerBorder, editorOverviewRulerBackground, editorMultiCursorSecondaryForeground, editorMultiCursorPrimaryForeground } from "../../../common/core/editorColorRegistry.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { OverviewRulerDecorationsGroup } from "../../../common/viewModel.js";
import { equals } from "../../../../base/common/arrays.js";
class Settings {
  constructor(config, theme) {
    const options = config.options;
    this.lineHeight = options.get(EditorOption.lineHeight);
    this.pixelRatio = options.get(EditorOption.pixelRatio);
    this.overviewRulerLanes = options.get(EditorOption.overviewRulerLanes);
    this.renderBorder = options.get(EditorOption.overviewRulerBorder);
    const borderColor = theme.getColor(editorOverviewRulerBorder);
    this.borderColor = borderColor ? borderColor.toString() : null;
    this.hideCursor = options.get(EditorOption.hideCursorInOverviewRuler);
    const cursorColorSingle = theme.getColor(editorCursorForeground);
    this.cursorColorSingle = cursorColorSingle ? cursorColorSingle.transparent(0.7).toString() : null;
    const cursorColorPrimary = theme.getColor(editorMultiCursorPrimaryForeground);
    this.cursorColorPrimary = cursorColorPrimary ? cursorColorPrimary.transparent(0.7).toString() : null;
    const cursorColorSecondary = theme.getColor(editorMultiCursorSecondaryForeground);
    this.cursorColorSecondary = cursorColorSecondary ? cursorColorSecondary.transparent(0.7).toString() : null;
    this.themeType = theme.type;
    const minimapOpts = options.get(EditorOption.minimap);
    const minimapEnabled = minimapOpts.enabled;
    const minimapSide = minimapOpts.side;
    const themeColor = theme.getColor(editorOverviewRulerBackground);
    const defaultBackground = TokenizationRegistry.getDefaultBackground();
    if (themeColor) {
      this.backgroundColor = themeColor;
    } else if (minimapEnabled && minimapSide === "right") {
      this.backgroundColor = defaultBackground;
    } else {
      this.backgroundColor = null;
    }
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const position = layoutInfo.overviewRuler;
    this.top = position.top;
    this.right = position.right;
    this.domWidth = position.width;
    this.domHeight = position.height;
    if (this.overviewRulerLanes === 0) {
      this.canvasWidth = 0;
      this.canvasHeight = 0;
    } else {
      this.canvasWidth = this.domWidth * this.pixelRatio | 0;
      this.canvasHeight = this.domHeight * this.pixelRatio | 0;
    }
    const [x, w] = this._initLanes(1, this.canvasWidth, this.overviewRulerLanes);
    this.x = x;
    this.w = w;
  }
  _initLanes(canvasLeftOffset, canvasWidth, laneCount) {
    const remainingWidth = canvasWidth - canvasLeftOffset;
    if (laneCount >= 3) {
      const leftWidth = Math.floor(remainingWidth / 3);
      const rightWidth = Math.floor(remainingWidth / 3);
      const centerWidth = remainingWidth - leftWidth - rightWidth;
      const leftOffset = canvasLeftOffset;
      const centerOffset = leftOffset + leftWidth;
      const rightOffset = leftOffset + leftWidth + centerWidth;
      return [
        [
          0,
          leftOffset,
          // Left
          centerOffset,
          // Center
          leftOffset,
          // Left | Center
          rightOffset,
          // Right
          leftOffset,
          // Left | Right
          centerOffset,
          // Center | Right
          leftOffset
          // Left | Center | Right
        ],
        [
          0,
          leftWidth,
          // Left
          centerWidth,
          // Center
          leftWidth + centerWidth,
          // Left | Center
          rightWidth,
          // Right
          leftWidth + centerWidth + rightWidth,
          // Left | Right
          centerWidth + rightWidth,
          // Center | Right
          leftWidth + centerWidth + rightWidth
          // Left | Center | Right
        ]
      ];
    } else if (laneCount === 2) {
      const leftWidth = Math.floor(remainingWidth / 2);
      const rightWidth = remainingWidth - leftWidth;
      const leftOffset = canvasLeftOffset;
      const rightOffset = leftOffset + leftWidth;
      return [
        [
          0,
          leftOffset,
          // Left
          leftOffset,
          // Center
          leftOffset,
          // Left | Center
          rightOffset,
          // Right
          leftOffset,
          // Left | Right
          leftOffset,
          // Center | Right
          leftOffset
          // Left | Center | Right
        ],
        [
          0,
          leftWidth,
          // Left
          leftWidth,
          // Center
          leftWidth,
          // Left | Center
          rightWidth,
          // Right
          leftWidth + rightWidth,
          // Left | Right
          leftWidth + rightWidth,
          // Center | Right
          leftWidth + rightWidth
          // Left | Center | Right
        ]
      ];
    } else {
      const offset = canvasLeftOffset;
      const width = remainingWidth;
      return [
        [
          0,
          offset,
          // Left
          offset,
          // Center
          offset,
          // Left | Center
          offset,
          // Right
          offset,
          // Left | Right
          offset,
          // Center | Right
          offset
          // Left | Center | Right
        ],
        [
          0,
          width,
          // Left
          width,
          // Center
          width,
          // Left | Center
          width,
          // Right
          width,
          // Left | Right
          width,
          // Center | Right
          width
          // Left | Center | Right
        ]
      ];
    }
  }
  equals(other) {
    return this.lineHeight === other.lineHeight && this.pixelRatio === other.pixelRatio && this.overviewRulerLanes === other.overviewRulerLanes && this.renderBorder === other.renderBorder && this.borderColor === other.borderColor && this.hideCursor === other.hideCursor && this.cursorColorSingle === other.cursorColorSingle && this.cursorColorPrimary === other.cursorColorPrimary && this.cursorColorSecondary === other.cursorColorSecondary && this.themeType === other.themeType && Color.equals(this.backgroundColor, other.backgroundColor) && this.top === other.top && this.right === other.right && this.domWidth === other.domWidth && this.domHeight === other.domHeight && this.canvasWidth === other.canvasWidth && this.canvasHeight === other.canvasHeight;
  }
}
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MIN_DECORATION_HEIGHT"] = 6] = "MIN_DECORATION_HEIGHT";
  return Constants2;
})(Constants || {});
var OverviewRulerLane = /* @__PURE__ */ ((OverviewRulerLane2) => {
  OverviewRulerLane2[OverviewRulerLane2["Left"] = 1] = "Left";
  OverviewRulerLane2[OverviewRulerLane2["Center"] = 2] = "Center";
  OverviewRulerLane2[OverviewRulerLane2["Right"] = 4] = "Right";
  OverviewRulerLane2[OverviewRulerLane2["Full"] = 7] = "Full";
  return OverviewRulerLane2;
})(OverviewRulerLane || {});
var ShouldRenderValue = /* @__PURE__ */ ((ShouldRenderValue2) => {
  ShouldRenderValue2[ShouldRenderValue2["NotNeeded"] = 0] = "NotNeeded";
  ShouldRenderValue2[ShouldRenderValue2["Maybe"] = 1] = "Maybe";
  ShouldRenderValue2[ShouldRenderValue2["Needed"] = 2] = "Needed";
  return ShouldRenderValue2;
})(ShouldRenderValue || {});
class DecorationsOverviewRuler extends ViewPart {
  constructor(context) {
    super(context);
    this._actualShouldRender = 0 /* NotNeeded */;
    this._renderedDecorations = [];
    this._renderedCursorPositions = [];
    this._domNode = createFastDomNode(document.createElement("canvas"));
    this._domNode.setClassName("decorationsOverviewRuler");
    this._domNode.setPosition("absolute");
    this._domNode.setLayerHinting(true);
    this._domNode.setContain("strict");
    this._domNode.setAttribute("aria-hidden", "true");
    this._updateSettings(false);
    this._tokensColorTrackerListener = TokenizationRegistry.onDidChange((e) => {
      if (e.changedColorMap) {
        this._updateSettings(true);
      }
    });
    this._cursorPositions = [{ position: new Position(1, 1), color: this._settings.cursorColorSingle }];
  }
  dispose() {
    super.dispose();
    this._tokensColorTrackerListener.dispose();
  }
  _updateSettings(renderNow) {
    const newSettings = new Settings(this._context.configuration, this._context.theme);
    if (this._settings && this._settings.equals(newSettings)) {
      return false;
    }
    this._settings = newSettings;
    this._domNode.setTop(this._settings.top);
    this._domNode.setRight(this._settings.right);
    this._domNode.setWidth(this._settings.domWidth);
    this._domNode.setHeight(this._settings.domHeight);
    this._domNode.domNode.width = this._settings.canvasWidth;
    this._domNode.domNode.height = this._settings.canvasHeight;
    if (renderNow) {
      this._render();
    }
    return true;
  }
  // ---- begin view event handlers
  _markRenderingIsNeeded() {
    this._actualShouldRender = 2 /* Needed */;
    return true;
  }
  _markRenderingIsMaybeNeeded() {
    this._actualShouldRender = 1 /* Maybe */;
    return true;
  }
  onConfigurationChanged(e) {
    return this._updateSettings(false) ? this._markRenderingIsNeeded() : false;
  }
  onCursorStateChanged(e) {
    this._cursorPositions = [];
    for (let i = 0, len = e.selections.length; i < len; i++) {
      let color = this._settings.cursorColorSingle;
      if (len > 1) {
        color = i === 0 ? this._settings.cursorColorPrimary : this._settings.cursorColorSecondary;
      }
      this._cursorPositions.push({ position: e.selections[i].getPosition(), color });
    }
    this._cursorPositions.sort((a, b) => Position.compare(a.position, b.position));
    return this._markRenderingIsMaybeNeeded();
  }
  onDecorationsChanged(e) {
    if (e.affectsOverviewRuler) {
      return this._markRenderingIsMaybeNeeded();
    }
    return false;
  }
  onFlushed(e) {
    return this._markRenderingIsNeeded();
  }
  onScrollChanged(e) {
    return e.scrollHeightChanged ? this._markRenderingIsNeeded() : false;
  }
  onZonesChanged(e) {
    return this._markRenderingIsNeeded();
  }
  onThemeChanged(e) {
    return this._updateSettings(false) ? this._markRenderingIsNeeded() : false;
  }
  // ---- end view event handlers
  getDomNode() {
    return this._domNode.domNode;
  }
  prepareRender(ctx) {
  }
  render(editorCtx) {
    this._render();
    this._actualShouldRender = 0 /* NotNeeded */;
  }
  _render() {
    const backgroundColor = this._settings.backgroundColor;
    if (this._settings.overviewRulerLanes === 0) {
      this._domNode.setBackgroundColor(backgroundColor ? Color.Format.CSS.formatHexA(backgroundColor) : "");
      this._domNode.setDisplay("none");
      return;
    }
    const decorations = this._context.viewModel.getAllOverviewRulerDecorations(this._context.theme);
    decorations.sort(OverviewRulerDecorationsGroup.compareByRenderingProps);
    if (this._actualShouldRender === 1 /* Maybe */ && !OverviewRulerDecorationsGroup.equalsArr(this._renderedDecorations, decorations)) {
      this._actualShouldRender = 2 /* Needed */;
    }
    if (this._actualShouldRender === 1 /* Maybe */ && !equals(this._renderedCursorPositions, this._cursorPositions, (a, b) => a.position.lineNumber === b.position.lineNumber && a.color === b.color)) {
      this._actualShouldRender = 2 /* Needed */;
    }
    if (this._actualShouldRender === 1 /* Maybe */) {
      return;
    }
    this._renderedDecorations = decorations;
    this._renderedCursorPositions = this._cursorPositions;
    this._domNode.setDisplay("block");
    const canvasWidth = this._settings.canvasWidth;
    const canvasHeight = this._settings.canvasHeight;
    const lineHeight = this._settings.lineHeight;
    const viewLayout = this._context.viewLayout;
    const outerHeight = this._context.viewLayout.getScrollHeight();
    const heightRatio = canvasHeight / outerHeight;
    const minDecorationHeight = 6 /* MIN_DECORATION_HEIGHT */ * this._settings.pixelRatio | 0;
    const halfMinDecorationHeight = minDecorationHeight / 2 | 0;
    const canvasCtx = this._domNode.domNode.getContext("2d");
    if (backgroundColor) {
      if (backgroundColor.isOpaque()) {
        canvasCtx.fillStyle = Color.Format.CSS.formatHexA(backgroundColor);
        canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        canvasCtx.fillStyle = Color.Format.CSS.formatHexA(backgroundColor);
        canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
    } else {
      canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    const x = this._settings.x;
    const w = this._settings.w;
    for (const decorationGroup of decorations) {
      const color = decorationGroup.color;
      const decorationGroupData = decorationGroup.data;
      canvasCtx.fillStyle = color;
      let prevLane = 0;
      let prevY1 = 0;
      let prevY2 = 0;
      for (let i = 0, len = decorationGroupData.length / 3; i < len; i++) {
        const lane = decorationGroupData[3 * i];
        const startLineNumber = decorationGroupData[3 * i + 1];
        const endLineNumber = decorationGroupData[3 * i + 2];
        let y1 = viewLayout.getVerticalOffsetForLineNumber(startLineNumber) * heightRatio | 0;
        let y2 = (viewLayout.getVerticalOffsetForLineNumber(endLineNumber) + lineHeight) * heightRatio | 0;
        const height = y2 - y1;
        if (height < minDecorationHeight) {
          let yCenter = (y1 + y2) / 2 | 0;
          if (yCenter < halfMinDecorationHeight) {
            yCenter = halfMinDecorationHeight;
          } else if (yCenter + halfMinDecorationHeight > canvasHeight) {
            yCenter = canvasHeight - halfMinDecorationHeight;
          }
          y1 = yCenter - halfMinDecorationHeight;
          y2 = yCenter + halfMinDecorationHeight;
        }
        if (y1 > prevY2 + 1 || lane !== prevLane) {
          if (i !== 0) {
            canvasCtx.fillRect(x[prevLane], prevY1, w[prevLane], prevY2 - prevY1);
          }
          prevLane = lane;
          prevY1 = y1;
          prevY2 = y2;
        } else {
          if (y2 > prevY2) {
            prevY2 = y2;
          }
        }
      }
      canvasCtx.fillRect(x[prevLane], prevY1, w[prevLane], prevY2 - prevY1);
    }
    if (!this._settings.hideCursor) {
      const cursorHeight = 2 * this._settings.pixelRatio | 0;
      const halfCursorHeight = cursorHeight / 2 | 0;
      const cursorX = this._settings.x[7 /* Full */];
      const cursorW = this._settings.w[7 /* Full */];
      let prevY1 = -100;
      let prevY2 = -100;
      let prevColor = null;
      for (let i = 0, len = this._cursorPositions.length; i < len; i++) {
        const color = this._cursorPositions[i].color;
        if (!color) {
          continue;
        }
        const cursor = this._cursorPositions[i].position;
        let yCenter = viewLayout.getVerticalOffsetForLineNumber(cursor.lineNumber) * heightRatio | 0;
        if (yCenter < halfCursorHeight) {
          yCenter = halfCursorHeight;
        } else if (yCenter + halfCursorHeight > canvasHeight) {
          yCenter = canvasHeight - halfCursorHeight;
        }
        const y1 = yCenter - halfCursorHeight;
        const y2 = y1 + cursorHeight;
        if (y1 > prevY2 + 1 || color !== prevColor) {
          if (i !== 0 && prevColor) {
            canvasCtx.fillRect(cursorX, prevY1, cursorW, prevY2 - prevY1);
          }
          prevY1 = y1;
          prevY2 = y2;
        } else {
          if (y2 > prevY2) {
            prevY2 = y2;
          }
        }
        prevColor = color;
        canvasCtx.fillStyle = color;
      }
      if (prevColor) {
        canvasCtx.fillRect(cursorX, prevY1, cursorW, prevY2 - prevY1);
      }
    }
    if (this._settings.renderBorder && this._settings.borderColor && this._settings.overviewRulerLanes > 0) {
      canvasCtx.beginPath();
      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = this._settings.borderColor;
      canvasCtx.moveTo(0, 0);
      canvasCtx.lineTo(0, canvasHeight);
      canvasCtx.moveTo(1, 0);
      canvasCtx.lineTo(canvasWidth, 0);
      canvasCtx.stroke();
    }
  }
}
export {
  DecorationsOverviewRuler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvb3ZlcnZpZXdSdWxlci9kZWNvcmF0aW9uc092ZXJ2aWV3UnVsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBGYXN0RG9tTm9kZSwgY3JlYXRlRmFzdERvbU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZmFzdERvbU5vZGUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFydCB9IGZyb20gJy4uLy4uL3ZpZXcvdmlld1BhcnQuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgZWRpdG9yQ3Vyc29yRm9yZWdyb3VuZCwgZWRpdG9yT3ZlcnZpZXdSdWxlckJvcmRlciwgZWRpdG9yT3ZlcnZpZXdSdWxlckJhY2tncm91bmQsIGVkaXRvck11bHRpQ3Vyc29yU2Vjb25kYXJ5Rm9yZWdyb3VuZCwgZWRpdG9yTXVsdGlDdXJzb3JQcmltYXJ5Rm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRvckNvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVuZGVyaW5nQ29udGV4dCwgUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQgfSBmcm9tICcuLi8uLi92aWV3L3JlbmRlcmluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCB7IEVkaXRvclRoZW1lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvclRoZW1lLmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IE92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9uc0dyb3VwIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuXG5jbGFzcyBTZXR0aW5ncyB7XG5cblx0cHVibGljIHJlYWRvbmx5IGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IHBpeGVsUmF0aW86IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IG92ZXJ2aWV3UnVsZXJMYW5lczogbnVtYmVyO1xuXG5cdHB1YmxpYyByZWFkb25seSByZW5kZXJCb3JkZXI6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBib3JkZXJDb2xvcjogc3RyaW5nIHwgbnVsbDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaGlkZUN1cnNvcjogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IGN1cnNvckNvbG9yU2luZ2xlOiBzdHJpbmcgfCBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgY3Vyc29yQ29sb3JQcmltYXJ5OiBzdHJpbmcgfCBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgY3Vyc29yQ29sb3JTZWNvbmRhcnk6IHN0cmluZyB8IG51bGw7XG5cblx0cHVibGljIHJlYWRvbmx5IHRoZW1lVHlwZTogJ2xpZ2h0JyB8ICdkYXJrJyB8ICdoY0xpZ2h0JyB8ICdoY0RhcmsnO1xuXHRwdWJsaWMgcmVhZG9ubHkgYmFja2dyb3VuZENvbG9yOiBDb2xvciB8IG51bGw7XG5cblx0cHVibGljIHJlYWRvbmx5IHRvcDogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgcmlnaHQ6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IGRvbVdpZHRoOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBkb21IZWlnaHQ6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IGNhbnZhc1dpZHRoOiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBjYW52YXNIZWlnaHQ6IG51bWJlcjtcblxuXHRwdWJsaWMgcmVhZG9ubHkgeDogbnVtYmVyW107XG5cdHB1YmxpYyByZWFkb25seSB3OiBudW1iZXJbXTtcblxuXHRjb25zdHJ1Y3Rvcihjb25maWc6IElFZGl0b3JDb25maWd1cmF0aW9uLCB0aGVtZTogRWRpdG9yVGhlbWUpIHtcblx0XHRjb25zdCBvcHRpb25zID0gY29uZmlnLm9wdGlvbnM7XG5cdFx0dGhpcy5saW5lSGVpZ2h0ID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdHRoaXMucGl4ZWxSYXRpbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5waXhlbFJhdGlvKTtcblx0XHR0aGlzLm92ZXJ2aWV3UnVsZXJMYW5lcyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5vdmVydmlld1J1bGVyTGFuZXMpO1xuXG5cdFx0dGhpcy5yZW5kZXJCb3JkZXIgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ub3ZlcnZpZXdSdWxlckJvcmRlcik7XG5cdFx0Y29uc3QgYm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JPdmVydmlld1J1bGVyQm9yZGVyKTtcblx0XHR0aGlzLmJvcmRlckNvbG9yID0gYm9yZGVyQ29sb3IgPyBib3JkZXJDb2xvci50b1N0cmluZygpIDogbnVsbDtcblxuXHRcdHRoaXMuaGlkZUN1cnNvciA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5oaWRlQ3Vyc29ySW5PdmVydmlld1J1bGVyKTtcblx0XHRjb25zdCBjdXJzb3JDb2xvclNpbmdsZSA9IHRoZW1lLmdldENvbG9yKGVkaXRvckN1cnNvckZvcmVncm91bmQpO1xuXHRcdHRoaXMuY3Vyc29yQ29sb3JTaW5nbGUgPSBjdXJzb3JDb2xvclNpbmdsZSA/IGN1cnNvckNvbG9yU2luZ2xlLnRyYW5zcGFyZW50KDAuNykudG9TdHJpbmcoKSA6IG51bGw7XG5cdFx0Y29uc3QgY3Vyc29yQ29sb3JQcmltYXJ5ID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yTXVsdGlDdXJzb3JQcmltYXJ5Rm9yZWdyb3VuZCk7XG5cdFx0dGhpcy5jdXJzb3JDb2xvclByaW1hcnkgPSBjdXJzb3JDb2xvclByaW1hcnkgPyBjdXJzb3JDb2xvclByaW1hcnkudHJhbnNwYXJlbnQoMC43KS50b1N0cmluZygpIDogbnVsbDtcblx0XHRjb25zdCBjdXJzb3JDb2xvclNlY29uZGFyeSA9IHRoZW1lLmdldENvbG9yKGVkaXRvck11bHRpQ3Vyc29yU2Vjb25kYXJ5Rm9yZWdyb3VuZCk7XG5cdFx0dGhpcy5jdXJzb3JDb2xvclNlY29uZGFyeSA9IGN1cnNvckNvbG9yU2Vjb25kYXJ5ID8gY3Vyc29yQ29sb3JTZWNvbmRhcnkudHJhbnNwYXJlbnQoMC43KS50b1N0cmluZygpIDogbnVsbDtcblxuXHRcdHRoaXMudGhlbWVUeXBlID0gdGhlbWUudHlwZTtcblxuXHRcdGNvbnN0IG1pbmltYXBPcHRzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLm1pbmltYXApO1xuXHRcdGNvbnN0IG1pbmltYXBFbmFibGVkID0gbWluaW1hcE9wdHMuZW5hYmxlZDtcblx0XHRjb25zdCBtaW5pbWFwU2lkZSA9IG1pbmltYXBPcHRzLnNpZGU7XG5cdFx0Y29uc3QgdGhlbWVDb2xvciA9IHRoZW1lLmdldENvbG9yKGVkaXRvck92ZXJ2aWV3UnVsZXJCYWNrZ3JvdW5kKTtcblx0XHRjb25zdCBkZWZhdWx0QmFja2dyb3VuZCA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldERlZmF1bHRCYWNrZ3JvdW5kKCk7XG5cblx0XHRpZiAodGhlbWVDb2xvcikge1xuXHRcdFx0dGhpcy5iYWNrZ3JvdW5kQ29sb3IgPSB0aGVtZUNvbG9yO1xuXHRcdH0gZWxzZSBpZiAobWluaW1hcEVuYWJsZWQgJiYgbWluaW1hcFNpZGUgPT09ICdyaWdodCcpIHtcblx0XHRcdHRoaXMuYmFja2dyb3VuZENvbG9yID0gZGVmYXVsdEJhY2tncm91bmQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYmFja2dyb3VuZENvbG9yID0gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gbGF5b3V0SW5mby5vdmVydmlld1J1bGVyO1xuXHRcdHRoaXMudG9wID0gcG9zaXRpb24udG9wO1xuXHRcdHRoaXMucmlnaHQgPSBwb3NpdGlvbi5yaWdodDtcblx0XHR0aGlzLmRvbVdpZHRoID0gcG9zaXRpb24ud2lkdGg7XG5cdFx0dGhpcy5kb21IZWlnaHQgPSBwb3NpdGlvbi5oZWlnaHQ7XG5cdFx0aWYgKHRoaXMub3ZlcnZpZXdSdWxlckxhbmVzID09PSAwKSB7XG5cdFx0XHQvLyBvdmVydmlldyBydWxlciBpcyBvZmZcblx0XHRcdHRoaXMuY2FudmFzV2lkdGggPSAwO1xuXHRcdFx0dGhpcy5jYW52YXNIZWlnaHQgPSAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNhbnZhc1dpZHRoID0gKHRoaXMuZG9tV2lkdGggKiB0aGlzLnBpeGVsUmF0aW8pIHwgMDtcblx0XHRcdHRoaXMuY2FudmFzSGVpZ2h0ID0gKHRoaXMuZG9tSGVpZ2h0ICogdGhpcy5waXhlbFJhdGlvKSB8IDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgW3gsIHddID0gdGhpcy5faW5pdExhbmVzKDEsIHRoaXMuY2FudmFzV2lkdGgsIHRoaXMub3ZlcnZpZXdSdWxlckxhbmVzKTtcblx0XHR0aGlzLnggPSB4O1xuXHRcdHRoaXMudyA9IHc7XG5cdH1cblxuXHRwcml2YXRlIF9pbml0TGFuZXMoY2FudmFzTGVmdE9mZnNldDogbnVtYmVyLCBjYW52YXNXaWR0aDogbnVtYmVyLCBsYW5lQ291bnQ6IG51bWJlcik6IFtudW1iZXJbXSwgbnVtYmVyW11dIHtcblx0XHRjb25zdCByZW1haW5pbmdXaWR0aCA9IGNhbnZhc1dpZHRoIC0gY2FudmFzTGVmdE9mZnNldDtcblxuXHRcdGlmIChsYW5lQ291bnQgPj0gMykge1xuXHRcdFx0Y29uc3QgbGVmdFdpZHRoID0gTWF0aC5mbG9vcihyZW1haW5pbmdXaWR0aCAvIDMpO1xuXHRcdFx0Y29uc3QgcmlnaHRXaWR0aCA9IE1hdGguZmxvb3IocmVtYWluaW5nV2lkdGggLyAzKTtcblx0XHRcdGNvbnN0IGNlbnRlcldpZHRoID0gcmVtYWluaW5nV2lkdGggLSBsZWZ0V2lkdGggLSByaWdodFdpZHRoO1xuXHRcdFx0Y29uc3QgbGVmdE9mZnNldCA9IGNhbnZhc0xlZnRPZmZzZXQ7XG5cdFx0XHRjb25zdCBjZW50ZXJPZmZzZXQgPSBsZWZ0T2Zmc2V0ICsgbGVmdFdpZHRoO1xuXHRcdFx0Y29uc3QgcmlnaHRPZmZzZXQgPSBsZWZ0T2Zmc2V0ICsgbGVmdFdpZHRoICsgY2VudGVyV2lkdGg7XG5cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQwLFxuXHRcdFx0XHRcdGxlZnRPZmZzZXQsIC8vIExlZnRcblx0XHRcdFx0XHRjZW50ZXJPZmZzZXQsIC8vIENlbnRlclxuXHRcdFx0XHRcdGxlZnRPZmZzZXQsIC8vIExlZnQgfCBDZW50ZXJcblx0XHRcdFx0XHRyaWdodE9mZnNldCwgLy8gUmlnaHRcblx0XHRcdFx0XHRsZWZ0T2Zmc2V0LCAvLyBMZWZ0IHwgUmlnaHRcblx0XHRcdFx0XHRjZW50ZXJPZmZzZXQsIC8vIENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdFx0bGVmdE9mZnNldCwgLy8gTGVmdCB8IENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdF0sIFtcblx0XHRcdFx0XHQwLFxuXHRcdFx0XHRcdGxlZnRXaWR0aCwgLy8gTGVmdFxuXHRcdFx0XHRcdGNlbnRlcldpZHRoLCAvLyBDZW50ZXJcblx0XHRcdFx0XHRsZWZ0V2lkdGggKyBjZW50ZXJXaWR0aCwgLy8gTGVmdCB8IENlbnRlclxuXHRcdFx0XHRcdHJpZ2h0V2lkdGgsIC8vIFJpZ2h0XG5cdFx0XHRcdFx0bGVmdFdpZHRoICsgY2VudGVyV2lkdGggKyByaWdodFdpZHRoLCAvLyBMZWZ0IHwgUmlnaHRcblx0XHRcdFx0XHRjZW50ZXJXaWR0aCArIHJpZ2h0V2lkdGgsIC8vIENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdFx0bGVmdFdpZHRoICsgY2VudGVyV2lkdGggKyByaWdodFdpZHRoLCAvLyBMZWZ0IHwgQ2VudGVyIHwgUmlnaHRcblx0XHRcdFx0XVxuXHRcdFx0XTtcblx0XHR9IGVsc2UgaWYgKGxhbmVDb3VudCA9PT0gMikge1xuXHRcdFx0Y29uc3QgbGVmdFdpZHRoID0gTWF0aC5mbG9vcihyZW1haW5pbmdXaWR0aCAvIDIpO1xuXHRcdFx0Y29uc3QgcmlnaHRXaWR0aCA9IHJlbWFpbmluZ1dpZHRoIC0gbGVmdFdpZHRoO1xuXHRcdFx0Y29uc3QgbGVmdE9mZnNldCA9IGNhbnZhc0xlZnRPZmZzZXQ7XG5cdFx0XHRjb25zdCByaWdodE9mZnNldCA9IGxlZnRPZmZzZXQgKyBsZWZ0V2lkdGg7XG5cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQwLFxuXHRcdFx0XHRcdGxlZnRPZmZzZXQsIC8vIExlZnRcblx0XHRcdFx0XHRsZWZ0T2Zmc2V0LCAvLyBDZW50ZXJcblx0XHRcdFx0XHRsZWZ0T2Zmc2V0LCAvLyBMZWZ0IHwgQ2VudGVyXG5cdFx0XHRcdFx0cmlnaHRPZmZzZXQsIC8vIFJpZ2h0XG5cdFx0XHRcdFx0bGVmdE9mZnNldCwgLy8gTGVmdCB8IFJpZ2h0XG5cdFx0XHRcdFx0bGVmdE9mZnNldCwgLy8gQ2VudGVyIHwgUmlnaHRcblx0XHRcdFx0XHRsZWZ0T2Zmc2V0LCAvLyBMZWZ0IHwgQ2VudGVyIHwgUmlnaHRcblx0XHRcdFx0XSwgW1xuXHRcdFx0XHRcdDAsXG5cdFx0XHRcdFx0bGVmdFdpZHRoLCAvLyBMZWZ0XG5cdFx0XHRcdFx0bGVmdFdpZHRoLCAvLyBDZW50ZXJcblx0XHRcdFx0XHRsZWZ0V2lkdGgsIC8vIExlZnQgfCBDZW50ZXJcblx0XHRcdFx0XHRyaWdodFdpZHRoLCAvLyBSaWdodFxuXHRcdFx0XHRcdGxlZnRXaWR0aCArIHJpZ2h0V2lkdGgsIC8vIExlZnQgfCBSaWdodFxuXHRcdFx0XHRcdGxlZnRXaWR0aCArIHJpZ2h0V2lkdGgsIC8vIENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdFx0bGVmdFdpZHRoICsgcmlnaHRXaWR0aCwgLy8gTGVmdCB8IENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG9mZnNldCA9IGNhbnZhc0xlZnRPZmZzZXQ7XG5cdFx0XHRjb25zdCB3aWR0aCA9IHJlbWFpbmluZ1dpZHRoO1xuXG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0MCxcblx0XHRcdFx0XHRvZmZzZXQsIC8vIExlZnRcblx0XHRcdFx0XHRvZmZzZXQsIC8vIENlbnRlclxuXHRcdFx0XHRcdG9mZnNldCwgLy8gTGVmdCB8IENlbnRlclxuXHRcdFx0XHRcdG9mZnNldCwgLy8gUmlnaHRcblx0XHRcdFx0XHRvZmZzZXQsIC8vIExlZnQgfCBSaWdodFxuXHRcdFx0XHRcdG9mZnNldCwgLy8gQ2VudGVyIHwgUmlnaHRcblx0XHRcdFx0XHRvZmZzZXQsIC8vIExlZnQgfCBDZW50ZXIgfCBSaWdodFxuXHRcdFx0XHRdLCBbXG5cdFx0XHRcdFx0MCxcblx0XHRcdFx0XHR3aWR0aCwgLy8gTGVmdFxuXHRcdFx0XHRcdHdpZHRoLCAvLyBDZW50ZXJcblx0XHRcdFx0XHR3aWR0aCwgLy8gTGVmdCB8IENlbnRlclxuXHRcdFx0XHRcdHdpZHRoLCAvLyBSaWdodFxuXHRcdFx0XHRcdHdpZHRoLCAvLyBMZWZ0IHwgUmlnaHRcblx0XHRcdFx0XHR3aWR0aCwgLy8gQ2VudGVyIHwgUmlnaHRcblx0XHRcdFx0XHR3aWR0aCwgLy8gTGVmdCB8IENlbnRlciB8IFJpZ2h0XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGVxdWFscyhvdGhlcjogU2V0dGluZ3MpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0dGhpcy5saW5lSGVpZ2h0ID09PSBvdGhlci5saW5lSGVpZ2h0XG5cdFx0XHQmJiB0aGlzLnBpeGVsUmF0aW8gPT09IG90aGVyLnBpeGVsUmF0aW9cblx0XHRcdCYmIHRoaXMub3ZlcnZpZXdSdWxlckxhbmVzID09PSBvdGhlci5vdmVydmlld1J1bGVyTGFuZXNcblx0XHRcdCYmIHRoaXMucmVuZGVyQm9yZGVyID09PSBvdGhlci5yZW5kZXJCb3JkZXJcblx0XHRcdCYmIHRoaXMuYm9yZGVyQ29sb3IgPT09IG90aGVyLmJvcmRlckNvbG9yXG5cdFx0XHQmJiB0aGlzLmhpZGVDdXJzb3IgPT09IG90aGVyLmhpZGVDdXJzb3Jcblx0XHRcdCYmIHRoaXMuY3Vyc29yQ29sb3JTaW5nbGUgPT09IG90aGVyLmN1cnNvckNvbG9yU2luZ2xlXG5cdFx0XHQmJiB0aGlzLmN1cnNvckNvbG9yUHJpbWFyeSA9PT0gb3RoZXIuY3Vyc29yQ29sb3JQcmltYXJ5XG5cdFx0XHQmJiB0aGlzLmN1cnNvckNvbG9yU2Vjb25kYXJ5ID09PSBvdGhlci5jdXJzb3JDb2xvclNlY29uZGFyeVxuXHRcdFx0JiYgdGhpcy50aGVtZVR5cGUgPT09IG90aGVyLnRoZW1lVHlwZVxuXHRcdFx0JiYgQ29sb3IuZXF1YWxzKHRoaXMuYmFja2dyb3VuZENvbG9yLCBvdGhlci5iYWNrZ3JvdW5kQ29sb3IpXG5cdFx0XHQmJiB0aGlzLnRvcCA9PT0gb3RoZXIudG9wXG5cdFx0XHQmJiB0aGlzLnJpZ2h0ID09PSBvdGhlci5yaWdodFxuXHRcdFx0JiYgdGhpcy5kb21XaWR0aCA9PT0gb3RoZXIuZG9tV2lkdGhcblx0XHRcdCYmIHRoaXMuZG9tSGVpZ2h0ID09PSBvdGhlci5kb21IZWlnaHRcblx0XHRcdCYmIHRoaXMuY2FudmFzV2lkdGggPT09IG90aGVyLmNhbnZhc1dpZHRoXG5cdFx0XHQmJiB0aGlzLmNhbnZhc0hlaWdodCA9PT0gb3RoZXIuY2FudmFzSGVpZ2h0XG5cdFx0KTtcblx0fVxufVxuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdE1JTl9ERUNPUkFUSU9OX0hFSUdIVCA9IDZcbn1cblxuY29uc3QgZW51bSBPdmVydmlld1J1bGVyTGFuZSB7XG5cdExlZnQgPSAxLFxuXHRDZW50ZXIgPSAyLFxuXHRSaWdodCA9IDQsXG5cdEZ1bGwgPSA3XG59XG5cbnR5cGUgQ3Vyc29yID0ge1xuXHRwb3NpdGlvbjogUG9zaXRpb247XG5cdGNvbG9yOiBzdHJpbmcgfCBudWxsO1xufTtcblxuY29uc3QgZW51bSBTaG91bGRSZW5kZXJWYWx1ZSB7XG5cdE5vdE5lZWRlZCA9IDAsXG5cdE1heWJlID0gMSxcblx0TmVlZGVkID0gMlxufVxuXG5leHBvcnQgY2xhc3MgRGVjb3JhdGlvbnNPdmVydmlld1J1bGVyIGV4dGVuZHMgVmlld1BhcnQge1xuXG5cdHByaXZhdGUgX2FjdHVhbFNob3VsZFJlbmRlcjogU2hvdWxkUmVuZGVyVmFsdWUgPSBTaG91bGRSZW5kZXJWYWx1ZS5Ob3ROZWVkZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5zQ29sb3JUcmFja2VyTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MQ2FudmFzRWxlbWVudD47XG5cdHByaXZhdGUgX3NldHRpbmdzITogU2V0dGluZ3M7XG5cdHByaXZhdGUgX2N1cnNvclBvc2l0aW9uczogQ3Vyc29yW107XG5cblx0cHJpdmF0ZSBfcmVuZGVyZWREZWNvcmF0aW9uczogT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zR3JvdXBbXSA9IFtdO1xuXHRwcml2YXRlIF9yZW5kZXJlZEN1cnNvclBvc2l0aW9uczogQ3Vyc29yW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCkge1xuXHRcdHN1cGVyKGNvbnRleHQpO1xuXG5cdFx0dGhpcy5fZG9tTm9kZSA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldENsYXNzTmFtZSgnZGVjb3JhdGlvbnNPdmVydmlld1J1bGVyJyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRQb3NpdGlvbignYWJzb2x1dGUnKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldExheWVySGludGluZyh0cnVlKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldENvbnRhaW4oJ3N0cmljdCcpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cblx0XHR0aGlzLl91cGRhdGVTZXR0aW5ncyhmYWxzZSk7XG5cblx0XHR0aGlzLl90b2tlbnNDb2xvclRyYWNrZXJMaXN0ZW5lciA9IFRva2VuaXphdGlvblJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5jaGFuZ2VkQ29sb3JNYXApIHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlU2V0dGluZ3ModHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9jdXJzb3JQb3NpdGlvbnMgPSBbeyBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpLCBjb2xvcjogdGhpcy5fc2V0dGluZ3MuY3Vyc29yQ29sb3JTaW5nbGUgfV07XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fdG9rZW5zQ29sb3JUcmFja2VyTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU2V0dGluZ3MocmVuZGVyTm93OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbmV3U2V0dGluZ3MgPSBuZXcgU2V0dGluZ3ModGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLCB0aGlzLl9jb250ZXh0LnRoZW1lKTtcblx0XHRpZiAodGhpcy5fc2V0dGluZ3MgJiYgdGhpcy5fc2V0dGluZ3MuZXF1YWxzKG5ld1NldHRpbmdzKSkge1xuXHRcdFx0Ly8gbm90aGluZyB0byBkb1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NldHRpbmdzID0gbmV3U2V0dGluZ3M7XG5cblx0XHR0aGlzLl9kb21Ob2RlLnNldFRvcCh0aGlzLl9zZXR0aW5ncy50b3ApO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0UmlnaHQodGhpcy5fc2V0dGluZ3MucmlnaHQpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0V2lkdGgodGhpcy5fc2V0dGluZ3MuZG9tV2lkdGgpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0SGVpZ2h0KHRoaXMuX3NldHRpbmdzLmRvbUhlaWdodCk7XG5cdFx0dGhpcy5fZG9tTm9kZS5kb21Ob2RlLndpZHRoID0gdGhpcy5fc2V0dGluZ3MuY2FudmFzV2lkdGg7XG5cdFx0dGhpcy5fZG9tTm9kZS5kb21Ob2RlLmhlaWdodCA9IHRoaXMuX3NldHRpbmdzLmNhbnZhc0hlaWdodDtcblxuXHRcdGlmIChyZW5kZXJOb3cpIHtcblx0XHRcdHRoaXMuX3JlbmRlcigpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tLSBiZWdpbiB2aWV3IGV2ZW50IGhhbmRsZXJzXG5cblx0cHJpdmF0ZSBfbWFya1JlbmRlcmluZ0lzTmVlZGVkKCk6IHRydWUge1xuXHRcdHRoaXMuX2FjdHVhbFNob3VsZFJlbmRlciA9IFNob3VsZFJlbmRlclZhbHVlLk5lZWRlZDtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX21hcmtSZW5kZXJpbmdJc01heWJlTmVlZGVkKCk6IHRydWUge1xuXHRcdHRoaXMuX2FjdHVhbFNob3VsZFJlbmRlciA9IFNob3VsZFJlbmRlclZhbHVlLk1heWJlO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl91cGRhdGVTZXR0aW5ncyhmYWxzZSkgPyB0aGlzLl9tYXJrUmVuZGVyaW5nSXNOZWVkZWQoKSA6IGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkN1cnNvclN0YXRlQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2N1cnNvclBvc2l0aW9ucyA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBlLnNlbGVjdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGxldCBjb2xvciA9IHRoaXMuX3NldHRpbmdzLmN1cnNvckNvbG9yU2luZ2xlO1xuXHRcdFx0aWYgKGxlbiA+IDEpIHtcblx0XHRcdFx0Y29sb3IgPSBpID09PSAwID8gdGhpcy5fc2V0dGluZ3MuY3Vyc29yQ29sb3JQcmltYXJ5IDogdGhpcy5fc2V0dGluZ3MuY3Vyc29yQ29sb3JTZWNvbmRhcnk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jdXJzb3JQb3NpdGlvbnMucHVzaCh7IHBvc2l0aW9uOiBlLnNlbGVjdGlvbnNbaV0uZ2V0UG9zaXRpb24oKSwgY29sb3IgfSk7XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnNvclBvc2l0aW9ucy5zb3J0KChhLCBiKSA9PiBQb3NpdGlvbi5jb21wYXJlKGEucG9zaXRpb24sIGIucG9zaXRpb24pKTtcblx0XHRyZXR1cm4gdGhpcy5fbWFya1JlbmRlcmluZ0lzTWF5YmVOZWVkZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25EZWNvcmF0aW9uc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3RGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoZS5hZmZlY3RzT3ZlcnZpZXdSdWxlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX21hcmtSZW5kZXJpbmdJc01heWJlTmVlZGVkKCk7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25GbHVzaGVkKGU6IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tYXJrUmVuZGVyaW5nSXNOZWVkZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25TY3JvbGxDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1Njcm9sbENoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlLnNjcm9sbEhlaWdodENoYW5nZWQgPyB0aGlzLl9tYXJrUmVuZGVyaW5nSXNOZWVkZWQoKSA6IGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvblpvbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdab25lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tYXJrUmVuZGVyaW5nSXNOZWVkZWQoKTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25UaGVtZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VGhlbWVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdXBkYXRlU2V0dGluZ3MoZmFsc2UpID8gdGhpcy5fbWFya1JlbmRlcmluZ0lzTmVlZGVkKCkgOiBmYWxzZTtcblx0fVxuXG5cdC8vIC0tLS0gZW5kIHZpZXcgZXZlbnQgaGFuZGxlcnNcblxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGUuZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyBwcmVwYXJlUmVuZGVyKGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IHZvaWQge1xuXHRcdC8vIE5vdGhpbmcgdG8gcmVhZFxuXHR9XG5cblx0cHVibGljIHJlbmRlcihlZGl0b3JDdHg6IFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0KTogdm9pZCB7XG5cdFx0dGhpcy5fcmVuZGVyKCk7XG5cdFx0dGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID0gU2hvdWxkUmVuZGVyVmFsdWUuTm90TmVlZGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyKCk6IHZvaWQge1xuXHRcdGNvbnN0IGJhY2tncm91bmRDb2xvciA9IHRoaXMuX3NldHRpbmdzLmJhY2tncm91bmRDb2xvcjtcblx0XHRpZiAodGhpcy5fc2V0dGluZ3Mub3ZlcnZpZXdSdWxlckxhbmVzID09PSAwKSB7XG5cdFx0XHQvLyBvdmVydmlldyBydWxlciBpcyBvZmZcblx0XHRcdHRoaXMuX2RvbU5vZGUuc2V0QmFja2dyb3VuZENvbG9yKGJhY2tncm91bmRDb2xvciA/IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4QShiYWNrZ3JvdW5kQ29sb3IpIDogJycpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zZXREaXNwbGF5KCdub25lJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5nZXRBbGxPdmVydmlld1J1bGVyRGVjb3JhdGlvbnModGhpcy5fY29udGV4dC50aGVtZSk7XG5cdFx0ZGVjb3JhdGlvbnMuc29ydChPdmVydmlld1J1bGVyRGVjb3JhdGlvbnNHcm91cC5jb21wYXJlQnlSZW5kZXJpbmdQcm9wcyk7XG5cblx0XHRpZiAodGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID09PSBTaG91bGRSZW5kZXJWYWx1ZS5NYXliZSAmJiAhT3ZlcnZpZXdSdWxlckRlY29yYXRpb25zR3JvdXAuZXF1YWxzQXJyKHRoaXMuX3JlbmRlcmVkRGVjb3JhdGlvbnMsIGRlY29yYXRpb25zKSkge1xuXHRcdFx0dGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID0gU2hvdWxkUmVuZGVyVmFsdWUuTmVlZGVkO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID09PSBTaG91bGRSZW5kZXJWYWx1ZS5NYXliZSAmJiAhZXF1YWxzKHRoaXMuX3JlbmRlcmVkQ3Vyc29yUG9zaXRpb25zLCB0aGlzLl9jdXJzb3JQb3NpdGlvbnMsIChhLCBiKSA9PiBhLnBvc2l0aW9uLmxpbmVOdW1iZXIgPT09IGIucG9zaXRpb24ubGluZU51bWJlciAmJiBhLmNvbG9yID09PSBiLmNvbG9yKSkge1xuXHRcdFx0dGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID0gU2hvdWxkUmVuZGVyVmFsdWUuTmVlZGVkO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fYWN0dWFsU2hvdWxkUmVuZGVyID09PSBTaG91bGRSZW5kZXJWYWx1ZS5NYXliZSkge1xuXHRcdFx0Ly8gYm90aCBkZWNvcmF0aW9ucyBhbmQgY3Vyc29yIHBvc2l0aW9ucyBhcmUgdW5jaGFuZ2VkLCBub3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3JlbmRlcmVkRGVjb3JhdGlvbnMgPSBkZWNvcmF0aW9ucztcblx0XHR0aGlzLl9yZW5kZXJlZEN1cnNvclBvc2l0aW9ucyA9IHRoaXMuX2N1cnNvclBvc2l0aW9ucztcblxuXHRcdHRoaXMuX2RvbU5vZGUuc2V0RGlzcGxheSgnYmxvY2snKTtcblx0XHRjb25zdCBjYW52YXNXaWR0aCA9IHRoaXMuX3NldHRpbmdzLmNhbnZhc1dpZHRoO1xuXHRcdGNvbnN0IGNhbnZhc0hlaWdodCA9IHRoaXMuX3NldHRpbmdzLmNhbnZhc0hlaWdodDtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fc2V0dGluZ3MubGluZUhlaWdodDtcblx0XHRjb25zdCB2aWV3TGF5b3V0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0O1xuXHRcdGNvbnN0IG91dGVySGVpZ2h0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFNjcm9sbEhlaWdodCgpO1xuXHRcdGNvbnN0IGhlaWdodFJhdGlvID0gY2FudmFzSGVpZ2h0IC8gb3V0ZXJIZWlnaHQ7XG5cblx0XHRjb25zdCBtaW5EZWNvcmF0aW9uSGVpZ2h0ID0gKENvbnN0YW50cy5NSU5fREVDT1JBVElPTl9IRUlHSFQgKiB0aGlzLl9zZXR0aW5ncy5waXhlbFJhdGlvKSB8IDA7XG5cdFx0Y29uc3QgaGFsZk1pbkRlY29yYXRpb25IZWlnaHQgPSAobWluRGVjb3JhdGlvbkhlaWdodCAvIDIpIHwgMDtcblxuXHRcdGNvbnN0IGNhbnZhc0N0eCA9IHRoaXMuX2RvbU5vZGUuZG9tTm9kZS5nZXRDb250ZXh0KCcyZCcpITtcblx0XHRpZiAoYmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHRpZiAoYmFja2dyb3VuZENvbG9yLmlzT3BhcXVlKCkpIHtcblx0XHRcdFx0Ly8gV2UgaGF2ZSBhIGJhY2tncm91bmQgY29sb3Igd2hpY2ggaXMgb3BhcXVlLCB3ZSBjYW4ganVzdCBwYWludCB0aGUgZW50aXJlIHN1cmZhY2Ugd2l0aCBpdFxuXHRcdFx0XHRjYW52YXNDdHguZmlsbFN0eWxlID0gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXhBKGJhY2tncm91bmRDb2xvcik7XG5cdFx0XHRcdGNhbnZhc0N0eC5maWxsUmVjdCgwLCAwLCBjYW52YXNXaWR0aCwgY2FudmFzSGVpZ2h0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFdlIGhhdmUgYSBiYWNrZ3JvdW5kIGNvbG9yIHdoaWNoIGlzIHRyYW5zcGFyZW50LCB3ZSBuZWVkIHRvIGZpcnN0IGNsZWFyIHRoZSBzdXJmYWNlIGFuZFxuXHRcdFx0XHQvLyB0aGVuIGZpbGwgaXRcblx0XHRcdFx0Y2FudmFzQ3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXNXaWR0aCwgY2FudmFzSGVpZ2h0KTtcblx0XHRcdFx0Y2FudmFzQ3R4LmZpbGxTdHlsZSA9IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4QShiYWNrZ3JvdW5kQ29sb3IpO1xuXHRcdFx0XHRjYW52YXNDdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzV2lkdGgsIGNhbnZhc0hlaWdodCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFdlIGRvbid0IGhhdmUgYSBiYWNrZ3JvdW5kIGNvbG9yXG5cdFx0XHRjYW52YXNDdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhc1dpZHRoLCBjYW52YXNIZWlnaHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHggPSB0aGlzLl9zZXR0aW5ncy54O1xuXHRcdGNvbnN0IHcgPSB0aGlzLl9zZXR0aW5ncy53O1xuXG5cblxuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbkdyb3VwIG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCBjb2xvciA9IGRlY29yYXRpb25Hcm91cC5jb2xvcjtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25Hcm91cERhdGEgPSBkZWNvcmF0aW9uR3JvdXAuZGF0YTtcblxuXHRcdFx0Y2FudmFzQ3R4LmZpbGxTdHlsZSA9IGNvbG9yO1xuXG5cdFx0XHRsZXQgcHJldkxhbmUgPSAwO1xuXHRcdFx0bGV0IHByZXZZMSA9IDA7XG5cdFx0XHRsZXQgcHJldlkyID0gMDtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBkZWNvcmF0aW9uR3JvdXBEYXRhLmxlbmd0aCAvIDM7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBsYW5lID0gZGVjb3JhdGlvbkdyb3VwRGF0YVszICogaV07XG5cdFx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IGRlY29yYXRpb25Hcm91cERhdGFbMyAqIGkgKyAxXTtcblx0XHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IGRlY29yYXRpb25Hcm91cERhdGFbMyAqIGkgKyAyXTtcblxuXHRcdFx0XHRsZXQgeTEgPSAodmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIoc3RhcnRMaW5lTnVtYmVyKSAqIGhlaWdodFJhdGlvKSB8IDA7XG5cdFx0XHRcdGxldCB5MiA9ICgodmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIoZW5kTGluZU51bWJlcikgKyBsaW5lSGVpZ2h0KSAqIGhlaWdodFJhdGlvKSB8IDA7XG5cdFx0XHRcdGNvbnN0IGhlaWdodCA9IHkyIC0geTE7XG5cdFx0XHRcdGlmIChoZWlnaHQgPCBtaW5EZWNvcmF0aW9uSGVpZ2h0KSB7XG5cdFx0XHRcdFx0bGV0IHlDZW50ZXIgPSAoKHkxICsgeTIpIC8gMikgfCAwO1xuXHRcdFx0XHRcdGlmICh5Q2VudGVyIDwgaGFsZk1pbkRlY29yYXRpb25IZWlnaHQpIHtcblx0XHRcdFx0XHRcdHlDZW50ZXIgPSBoYWxmTWluRGVjb3JhdGlvbkhlaWdodDtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHlDZW50ZXIgKyBoYWxmTWluRGVjb3JhdGlvbkhlaWdodCA+IGNhbnZhc0hlaWdodCkge1xuXHRcdFx0XHRcdFx0eUNlbnRlciA9IGNhbnZhc0hlaWdodCAtIGhhbGZNaW5EZWNvcmF0aW9uSGVpZ2h0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR5MSA9IHlDZW50ZXIgLSBoYWxmTWluRGVjb3JhdGlvbkhlaWdodDtcblx0XHRcdFx0XHR5MiA9IHlDZW50ZXIgKyBoYWxmTWluRGVjb3JhdGlvbkhlaWdodDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh5MSA+IHByZXZZMiArIDEgfHwgbGFuZSAhPT0gcHJldkxhbmUpIHtcblx0XHRcdFx0XHQvLyBmbHVzaCBwcmV2XG5cdFx0XHRcdFx0aWYgKGkgIT09IDApIHtcblx0XHRcdFx0XHRcdGNhbnZhc0N0eC5maWxsUmVjdCh4W3ByZXZMYW5lXSwgcHJldlkxLCB3W3ByZXZMYW5lXSwgcHJldlkyIC0gcHJldlkxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJldkxhbmUgPSBsYW5lO1xuXHRcdFx0XHRcdHByZXZZMSA9IHkxO1xuXHRcdFx0XHRcdHByZXZZMiA9IHkyO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIG1lcmdlIGludG8gcHJldlxuXHRcdFx0XHRcdGlmICh5MiA+IHByZXZZMikge1xuXHRcdFx0XHRcdFx0cHJldlkyID0geTI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYW52YXNDdHguZmlsbFJlY3QoeFtwcmV2TGFuZV0sIHByZXZZMSwgd1twcmV2TGFuZV0sIHByZXZZMiAtIHByZXZZMSk7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhdyBjdXJzb3JzXG5cdFx0aWYgKCF0aGlzLl9zZXR0aW5ncy5oaWRlQ3Vyc29yKSB7XG5cdFx0XHRjb25zdCBjdXJzb3JIZWlnaHQgPSAoMiAqIHRoaXMuX3NldHRpbmdzLnBpeGVsUmF0aW8pIHwgMDtcblx0XHRcdGNvbnN0IGhhbGZDdXJzb3JIZWlnaHQgPSAoY3Vyc29ySGVpZ2h0IC8gMikgfCAwO1xuXHRcdFx0Y29uc3QgY3Vyc29yWCA9IHRoaXMuX3NldHRpbmdzLnhbT3ZlcnZpZXdSdWxlckxhbmUuRnVsbF07XG5cdFx0XHRjb25zdCBjdXJzb3JXID0gdGhpcy5fc2V0dGluZ3Mud1tPdmVydmlld1J1bGVyTGFuZS5GdWxsXTtcblxuXHRcdFx0bGV0IHByZXZZMSA9IC0xMDA7XG5cdFx0XHRsZXQgcHJldlkyID0gLTEwMDtcblx0XHRcdGxldCBwcmV2Q29sb3I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2N1cnNvclBvc2l0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBjb2xvciA9IHRoaXMuX2N1cnNvclBvc2l0aW9uc1tpXS5jb2xvcjtcblx0XHRcdFx0aWYgKCFjb2xvcikge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGN1cnNvciA9IHRoaXMuX2N1cnNvclBvc2l0aW9uc1tpXS5wb3NpdGlvbjtcblxuXHRcdFx0XHRsZXQgeUNlbnRlciA9ICh2aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihjdXJzb3IubGluZU51bWJlcikgKiBoZWlnaHRSYXRpbykgfCAwO1xuXHRcdFx0XHRpZiAoeUNlbnRlciA8IGhhbGZDdXJzb3JIZWlnaHQpIHtcblx0XHRcdFx0XHR5Q2VudGVyID0gaGFsZkN1cnNvckhlaWdodDtcblx0XHRcdFx0fSBlbHNlIGlmICh5Q2VudGVyICsgaGFsZkN1cnNvckhlaWdodCA+IGNhbnZhc0hlaWdodCkge1xuXHRcdFx0XHRcdHlDZW50ZXIgPSBjYW52YXNIZWlnaHQgLSBoYWxmQ3Vyc29ySGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHkxID0geUNlbnRlciAtIGhhbGZDdXJzb3JIZWlnaHQ7XG5cdFx0XHRcdGNvbnN0IHkyID0geTEgKyBjdXJzb3JIZWlnaHQ7XG5cblx0XHRcdFx0aWYgKHkxID4gcHJldlkyICsgMSB8fCBjb2xvciAhPT0gcHJldkNvbG9yKSB7XG5cdFx0XHRcdFx0Ly8gZmx1c2ggcHJldlxuXHRcdFx0XHRcdGlmIChpICE9PSAwICYmIHByZXZDb2xvcikge1xuXHRcdFx0XHRcdFx0Y2FudmFzQ3R4LmZpbGxSZWN0KGN1cnNvclgsIHByZXZZMSwgY3Vyc29yVywgcHJldlkyIC0gcHJldlkxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJldlkxID0geTE7XG5cdFx0XHRcdFx0cHJldlkyID0geTI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gbWVyZ2UgaW50byBwcmV2XG5cdFx0XHRcdFx0aWYgKHkyID4gcHJldlkyKSB7XG5cdFx0XHRcdFx0XHRwcmV2WTIgPSB5Mjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJldkNvbG9yID0gY29sb3I7XG5cdFx0XHRcdGNhbnZhc0N0eC5maWxsU3R5bGUgPSBjb2xvcjtcblx0XHRcdH1cblx0XHRcdGlmIChwcmV2Q29sb3IpIHtcblx0XHRcdFx0Y2FudmFzQ3R4LmZpbGxSZWN0KGN1cnNvclgsIHByZXZZMSwgY3Vyc29yVywgcHJldlkyIC0gcHJldlkxKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc2V0dGluZ3MucmVuZGVyQm9yZGVyICYmIHRoaXMuX3NldHRpbmdzLmJvcmRlckNvbG9yICYmIHRoaXMuX3NldHRpbmdzLm92ZXJ2aWV3UnVsZXJMYW5lcyA+IDApIHtcblx0XHRcdGNhbnZhc0N0eC5iZWdpblBhdGgoKTtcblx0XHRcdGNhbnZhc0N0eC5saW5lV2lkdGggPSAxO1xuXHRcdFx0Y2FudmFzQ3R4LnN0cm9rZVN0eWxlID0gdGhpcy5fc2V0dGluZ3MuYm9yZGVyQ29sb3I7XG5cdFx0XHRjYW52YXNDdHgubW92ZVRvKDAsIDApO1xuXHRcdFx0Y2FudmFzQ3R4LmxpbmVUbygwLCBjYW52YXNIZWlnaHQpO1xuXHRcdFx0Y2FudmFzQ3R4Lm1vdmVUbygxLCAwKTtcblx0XHRcdGNhbnZhc0N0eC5saW5lVG8oY2FudmFzV2lkdGgsIDApO1xuXHRcdFx0Y2FudmFzQ3R4LnN0cm9rZSgpO1xu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LFVBQVUsYUFBYztBQUN2RCxZQUFNLG1CQUFvQixlQUFlLElBQUs7QUFDOUMsWUFBTSxVQUFVLEtBQUssVUFBVSxFQUFFLFlBQXNCO0FBQ3ZELFlBQU0sVUFBVSxLQUFLLFVBQVUsRUFBRSxZQUFzQjtBQUV2RCxVQUFJLFNBQVM7QUFDYixVQUFJLFNBQVM7QUFDYixVQUFJLFlBQTJCO0FBQy9CLGVBQVMsSUFBSSxHQUFHLE1BQU0sS0FBSyxpQkFBaUIsUUFBUSxJQUFJLEtBQUssS0FBSztBQUNqRSxjQUFNLFFBQVEsS0FBSyxpQkFBaUIsQ0FBQyxFQUFFO0FBQ3ZDLFlBQUksQ0FBQyxPQUFPO0FBQ1g7QUFBQSxRQUNEO0FBQ0EsY0FBTSxTQUFTLEtBQUssaUJBQWlCLENBQUMsRUFBRTtBQUV4QyxZQUFJLFVBQVcsV0FBVywrQkFBK0IsT0FBTyxVQUFVLElBQUksY0FBZTtBQUM3RixZQUFJLFVBQVUsa0JBQWtCO0FBQy9CLG9CQUFVO0FBQUEsUUFDWCxXQUFXLFVBQVUsbUJBQW1CLGNBQWM7QUFDckQsb0JBQVUsZUFBZTtBQUFBLFFBQzFCO0FBQ0EsY0FBTSxLQUFLLFVBQVU7QUFDckIsY0FBTSxLQUFLLEtBQUs7QUFFaEIsWUFBSSxLQUFLLFNBQVMsS0FBSyxVQUFVLFdBQVc7QUFFM0MsY0FBSSxNQUFNLEtBQUssV0FBVztBQUN6QixzQkFBVSxTQUFTLFNBQVMsUUFBUSxTQUFTLFNBQVMsTUFBTTtBQUFBLFVBQzdEO0FBQ0EsbUJBQVM7QUFDVCxtQkFBUztBQUFBLFFBQ1YsT0FBTztBQUVOLGNBQUksS0FBSyxRQUFRO0FBQ2hCLHFCQUFTO0FBQUEsVUFDVjtBQUFBLFFBQ0Q7QUFDQSxvQkFBWTtBQUNaLGtCQUFVLFlBQVk7QUFBQSxNQUN2QjtBQUNBLFVBQUksV0FBVztBQUNkLGtCQUFVLFNBQVMsU0FBUyxRQUFRLFNBQVMsU0FBUyxNQUFNO0FBQUEsTUFDN0Q7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLFVBQVUsZ0JBQWdCLEtBQUssVUFBVSxlQUFlLEtBQUssVUFBVSxxQkFBcUIsR0FBRztBQUN2RyxnQkFBVSxVQUFVO0FBQ3BCLGdCQUFVLFlBQVk7QUFDdEIsZ0JBQVUsY0FBYyxLQUFLLFVBQVU7QUFDdkMsZ0JBQVUsT0FBTyxHQUFHLENBQUM7QUFDckIsZ0JBQVUsT0FBTyxHQUFHLFlBQVk7QUFDaEMsZ0JBQVUsT0FBTyxHQUFHLENBQUM7QUFDckIsZ0JBQVUsT0FBTyxhQUFhLENBQUM7QUFDL0IsZ0JBQVUsT0FBTztBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJDb25zdGFudHMiLCAiT3ZlcnZpZXdSdWxlckxhbmUiLCAiU2hvdWxkUmVuZGVyVmFsdWUiXQp9Cg==
