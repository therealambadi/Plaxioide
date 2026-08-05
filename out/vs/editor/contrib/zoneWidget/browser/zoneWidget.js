import * as dom from "../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { Orientation, Sash, SashState } from "../../../../base/browser/ui/sash/sash.js";
import { Color, RGBA } from "../../../../base/common/color.js";
import { IdGenerator } from "../../../../base/common/idGenerator.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import * as objects from "../../../../base/common/objects.js";
import "./zoneWidget.css";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
const defaultColor = new Color(new RGBA(0, 122, 204));
const defaultOptions = {
  showArrow: true,
  showFrame: true,
  className: "",
  frameColor: defaultColor,
  arrowColor: defaultColor,
  keepEditorSelection: false
};
const WIDGET_ID = "vs.editor.contrib.zoneWidget";
class ViewZoneDelegate {
  constructor(domNode, afterLineNumber, afterColumn, heightInLines, onDomNodeTop, onComputedHeight, showInHiddenAreas, ordinal) {
    this.id = "";
    this.domNode = domNode;
    this.afterLineNumber = afterLineNumber;
    this.afterColumn = afterColumn;
    this.heightInLines = heightInLines;
    this.showInHiddenAreas = showInHiddenAreas;
    this.ordinal = ordinal;
    this._onDomNodeTop = onDomNodeTop;
    this._onComputedHeight = onComputedHeight;
  }
  onDomNodeTop(top) {
    this._onDomNodeTop(top);
  }
  onComputedHeight(height) {
    this._onComputedHeight(height);
  }
}
class OverlayWidgetDelegate {
  constructor(id, domNode) {
    this._id = id;
    this._domNode = domNode;
  }
  getId() {
    return this._id;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return null;
  }
}
const _Arrow = class _Arrow {
  constructor(_editor) {
    this._editor = _editor;
    this._ruleName = _Arrow._IdGenerator.nextId();
    this._color = null;
    this._height = -1;
    this._decorations = this._editor.createDecorationsCollection();
  }
  dispose() {
    this.hide();
    domStylesheetsJs.removeCSSRulesContainingSelector(this._ruleName);
  }
  set color(value) {
    if (this._color !== value) {
      this._color = value;
      this._updateStyle();
    }
  }
  set height(value) {
    if (this._height !== value) {
      this._height = value;
      this._updateStyle();
    }
  }
  _updateStyle() {
    domStylesheetsJs.removeCSSRulesContainingSelector(this._ruleName);
    domStylesheetsJs.createCSSRule(
      `.monaco-editor ${this._ruleName}`,
      `border-style: solid; border-color: transparent; border-bottom-color: ${this._color}; border-width: ${this._height}px; bottom: -${this._height}px !important; margin-left: -${this._height}px; `
    );
  }
  show(where) {
    if (where.column === 1) {
      where = { lineNumber: where.lineNumber, column: 2 };
    }
    this._decorations.set([{
      range: Range.fromPositions(where),
      options: {
        description: "zone-widget-arrow",
        className: this._ruleName,
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    }]);
  }
  hide() {
    this._decorations.clear();
  }
};
_Arrow._IdGenerator = new IdGenerator(".arrow-decoration-");
let Arrow = _Arrow;
class ZoneWidget {
  constructor(editor, options = {}) {
    this._arrow = null;
    this._overlayWidget = null;
    this._resizeSash = null;
    this._isSashResizeHeight = false;
    this._viewZone = null;
    this._disposables = new DisposableStore();
    this.container = null;
    this._isShowing = false;
    this.editor = editor;
    this._positionMarkerId = this.editor.createDecorationsCollection();
    this.options = objects.deepClone(options);
    objects.mixin(this.options, defaultOptions, false);
    this.domNode = document.createElement("div");
    if (!this.options.isAccessible) {
      this.domNode.setAttribute("aria-hidden", "true");
      this.domNode.setAttribute("role", "presentation");
    }
    this._disposables.add(this.editor.onDidLayoutChange((info) => {
      const width = this._getWidth(info);
      this.domNode.style.width = width + "px";
      this.domNode.style.left = this._getLeft(info) + "px";
      this._onWidth(width);
    }));
  }
  dispose() {
    if (this._overlayWidget) {
      this.editor.removeOverlayWidget(this._overlayWidget);
      this._overlayWidget = null;
    }
    if (this._viewZone) {
      this.editor.changeViewZones((accessor) => {
        if (this._viewZone) {
          accessor.removeZone(this._viewZone.id);
        }
        this._viewZone = null;
      });
    }
    this._positionMarkerId.clear();
    this._disposables.dispose();
  }
  create() {
    this.domNode.classList.add("zone-widget");
    if (this.options.className) {
      this.domNode.classList.add(this.options.className);
    }
    this.container = document.createElement("div");
    this.container.classList.add("zone-widget-container");
    this.domNode.appendChild(this.container);
    if (this.options.showArrow) {
      this._arrow = new Arrow(this.editor);
      this._disposables.add(this._arrow);
    }
    this._fillContainer(this.container);
    this._initSash();
    this._applyStyles();
  }
  style(styles) {
    if (styles.frameColor) {
      this.options.frameColor = styles.frameColor;
    }
    if (styles.arrowColor) {
      this.options.arrowColor = styles.arrowColor;
    }
    this._applyStyles();
  }
  _applyStyles() {
    if (this.container && this.options.frameColor) {
      const frameColor = this.options.frameColor.toString();
      this.container.style.borderTopColor = frameColor;
      this.container.style.borderBottomColor = frameColor;
    }
    if (this._arrow && this.options.arrowColor) {
      const arrowColor = this.options.arrowColor.toString();
      this._arrow.color = arrowColor;
    }
  }
  _getWidth(info) {
    return info.width - info.minimap.minimapWidth - info.verticalScrollbarWidth;
  }
  _getLeft(info) {
    if (info.minimap.minimapWidth > 0 && info.minimap.minimapLeft === 0) {
      return info.minimap.minimapWidth;
    }
    return 0;
  }
  _onViewZoneTop(top) {
    this.domNode.style.top = top + "px";
  }
  _onViewZoneHeight(height) {
    this.domNode.style.height = `${height}px`;
    if (this.container) {
      const containerHeight = height - this._decoratingElementsHeight();
      this.container.style.height = `${containerHeight}px`;
      const layoutInfo = this.editor.getLayoutInfo();
      this._doLayout(containerHeight, this._getWidth(layoutInfo));
    }
    this._resizeSash?.layout();
  }
  get position() {
    const range = this._positionMarkerId.getRange(0);
    if (!range) {
      return void 0;
    }
    return range.getStartPosition();
  }
  hasFocus() {
    return this.domNode.contains(dom.getActiveElement());
  }
  show(rangeOrPos, heightInLines) {
    const range = Range.isIRange(rangeOrPos) ? Range.lift(rangeOrPos) : Range.fromPositions(rangeOrPos);
    this._isShowing = true;
    this._showImpl(range, heightInLines);
    this._isShowing = false;
    this._positionMarkerId.set([{ range, options: ModelDecorationOptions.EMPTY }]);
  }
  updatePositionAndHeight(rangeOrPos, heightInLines) {
    if (this._viewZone) {
      rangeOrPos = Range.isIRange(rangeOrPos) ? Range.getStartPosition(rangeOrPos) : rangeOrPos;
      this._viewZone.afterLineNumber = rangeOrPos.lineNumber;
      this._viewZone.afterColumn = rangeOrPos.column;
      this._viewZone.heightInLines = heightInLines ?? this._viewZone.heightInLines;
      this.editor.changeViewZones((accessor) => {
        accessor.layoutZone(this._viewZone.id);
      });
      this._positionMarkerId.set([{
        range: Range.isIRange(rangeOrPos) ? rangeOrPos : Range.fromPositions(rangeOrPos),
        options: ModelDecorationOptions.EMPTY
      }]);
      this._updateSashEnablement();
    }
  }
  hide() {
    if (this._viewZone) {
      this.editor.changeViewZones((accessor) => {
        if (this._viewZone) {
          accessor.removeZone(this._viewZone.id);
        }
      });
      this._viewZone = null;
    }
    if (this._overlayWidget) {
      this.editor.removeOverlayWidget(this._overlayWidget);
      this._overlayWidget = null;
    }
    this._arrow?.hide();
    this._positionMarkerId.clear();
    this._isSashResizeHeight = false;
  }
  _decoratingElementsHeight() {
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    let result = 0;
    if (this.options.showArrow) {
      const arrowHeight = Math.round(lineHeight / 3);
      result += 2 * arrowHeight;
    }
    if (this.options.showFrame) {
      const frameThickness = Math.round(lineHeight / 9);
      result += 2 * frameThickness;
    }
    return result;
  }
  /** Gets the maximum widget height in lines. */
  _getMaximumHeightInLines() {
    return Math.max(12, this.editor.getLayoutInfo().height / this.editor.getOption(EditorOption.lineHeight) * 0.8);
  }
  _showImpl(where, heightInLines) {
    const position = where.getStartPosition();
    const layoutInfo = this.editor.getLayoutInfo();
    const width = this._getWidth(layoutInfo);
    this.domNode.style.width = `${width}px`;
    this.domNode.style.left = this._getLeft(layoutInfo) + "px";
    const viewZoneDomNode = document.createElement("div");
    viewZoneDomNode.style.overflow = "hidden";
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const maxHeightInLines = this._getMaximumHeightInLines();
    if (maxHeightInLines !== void 0) {
      heightInLines = Math.min(heightInLines, maxHeightInLines);
    }
    let arrowHeight = 0;
    let frameThickness = 0;
    if (this._arrow && this.options.showArrow) {
      arrowHeight = Math.round(lineHeight / 3);
      this._arrow.height = arrowHeight;
      this._arrow.show(position);
    }
    if (this.options.showFrame) {
      frameThickness = Math.round(lineHeight / 9);
    }
    this.editor.changeViewZones((accessor) => {
      if (this._viewZone) {
        accessor.removeZone(this._viewZone.id);
      }
      if (this._overlayWidget) {
        this.editor.removeOverlayWidget(this._overlayWidget);
        this._overlayWidget = null;
      }
      this.domNode.style.top = "-1000px";
      this._viewZone = new ViewZoneDelegate(
        viewZoneDomNode,
        position.lineNumber,
        position.column,
        heightInLines,
        (top) => this._onViewZoneTop(top),
        (height) => this._onViewZoneHeight(height),
        this.options.showInHiddenAreas,
        this.options.ordinal
      );
      this._viewZone.id = accessor.addZone(this._viewZone);
      this._overlayWidget = new OverlayWidgetDelegate(WIDGET_ID + this._viewZone.id, this.domNode);
      this.editor.addOverlayWidget(this._overlayWidget);
    });
    this._updateSashEnablement();
    if (this.container && this.options.showFrame) {
      const width2 = this.options.frameWidth ? this.options.frameWidth : frameThickness;
      this.container.style.borderTopWidth = width2 + "px";
      this.container.style.borderBottomWidth = width2 + "px";
    }
    const containerHeight = heightInLines * lineHeight - this._decoratingElementsHeight();
    if (this.container) {
      this.container.style.top = arrowHeight + "px";
      this.container.style.height = containerHeight + "px";
      this.container.style.overflow = "hidden";
    }
    this._doLayout(containerHeight, width);
    if (!this.options.keepEditorSelection) {
      this.editor.setSelection(where);
    }
    const model = this.editor.getModel();
    if (model) {
      const range = model.validateRange(new Range(where.startLineNumber, 1, where.endLineNumber + 1, 1));
      this.revealRange(range, range.startLineNumber === model.getLineCount());
    }
  }
  revealRange(range, isLastLine) {
    if (isLastLine) {
      this.editor.revealLineNearTop(range.endLineNumber, ScrollType.Smooth);
    } else {
      this.editor.revealRange(range, ScrollType.Smooth);
    }
  }
  setCssClass(className, classToReplace) {
    if (!this.container) {
      return;
    }
    if (classToReplace) {
      this.container.classList.remove(classToReplace);
    }
    this.container.classList.add(className);
  }
  _onWidth(widthInPixel) {
  }
  _doLayout(heightInPixel, widthInPixel) {
  }
  _relayout(_newHeightInLines, useMax) {
    const maxHeightInLines = this._getMaximumHeightInLines();
    const newHeightInLines = useMax && maxHeightInLines !== void 0 ? Math.min(maxHeightInLines, _newHeightInLines) : _newHeightInLines;
    if (this._viewZone && this._viewZone.heightInLines !== newHeightInLines) {
      this.editor.changeViewZones((accessor) => {
        if (this._viewZone) {
          this._viewZone.heightInLines = newHeightInLines;
          accessor.layoutZone(this._viewZone.id);
        }
      });
      this._updateSashEnablement();
    }
  }
  // --- sash
  _initSash() {
    if (this._resizeSash) {
      return;
    }
    this._resizeSash = this._disposables.add(new Sash(this.domNode, this, { orientation: Orientation.HORIZONTAL }));
    if (!this.options.isResizeable) {
      this._resizeSash.state = SashState.Disabled;
    }
    let data;
    this._disposables.add(this._resizeSash.onDidStart((e) => {
      if (this._viewZone) {
        data = {
          startY: e.startY,
          heightInLines: this._viewZone.heightInLines,
          ...this._getResizeBounds()
        };
      }
    }));
    this._disposables.add(this._resizeSash.onDidEnd(() => {
      data = void 0;
    }));
    this._disposables.add(this._resizeSash.onDidChange((evt) => {
      if (data) {
        const lineDelta = (evt.currentY - data.startY) / this.editor.getOption(EditorOption.lineHeight);
        const roundedLineDelta = lineDelta < 0 ? Math.ceil(lineDelta) : Math.floor(lineDelta);
        const newHeightInLines = data.heightInLines + roundedLineDelta;
        if (newHeightInLines > data.minLines && newHeightInLines < data.maxLines) {
          this._isSashResizeHeight = true;
          this._relayout(newHeightInLines);
        }
      }
    }));
  }
  _updateSashEnablement() {
    if (this._resizeSash) {
      const { minLines, maxLines } = this._getResizeBounds();
      this._resizeSash.state = minLines === maxLines ? SashState.Disabled : SashState.Enabled;
    }
  }
  get _usesResizeHeight() {
    return this._isSashResizeHeight;
  }
  _getResizeBounds() {
    return { minLines: 5, maxLines: 35 };
  }
  getHorizontalSashLeft() {
    return 0;
  }
  getHorizontalSashTop() {
    return (this.domNode.style.height === null ? 0 : parseInt(this.domNode.style.height)) - this._decoratingElementsHeight() / 2;
  }
  getHorizontalSashWidth() {
    const layoutInfo = this.editor.getLayoutInfo();
    return layoutInfo.width - layoutInfo.minimap.minimapWidth;
  }
}
export {
  OverlayWidgetDelegate,
  ZoneWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi96b25lV2lkZ2V0L2Jyb3dzZXIvem9uZVdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGRvbVN0eWxlc2hlZXRzSnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IElIb3Jpem9udGFsU2FzaExheW91dFByb3ZpZGVyLCBJU2FzaEV2ZW50LCBPcmllbnRhdGlvbiwgU2FzaCwgU2FzaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBDb2xvciwgUkdCQSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElkR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaWRHZW5lcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgJy4vem9uZVdpZGdldC5jc3MnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElPdmVybGF5V2lkZ2V0LCBJT3ZlcmxheVdpZGdldFBvc2l0aW9uLCBJVmlld1pvbmUsIElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckxheW91dEluZm8sIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24sIFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElPcHRpb25zIHtcblx0c2hvd0ZyYW1lPzogYm9vbGVhbjtcblx0c2hvd0Fycm93PzogYm9vbGVhbjtcblx0ZnJhbWVXaWR0aD86IG51bWJlcjtcblx0Y2xhc3NOYW1lPzogc3RyaW5nO1xuXHRpc0FjY2Vzc2libGU/OiBib29sZWFuO1xuXHRpc1Jlc2l6ZWFibGU/OiBib29sZWFuO1xuXHRmcmFtZUNvbG9yPzogQ29sb3IgfCBzdHJpbmc7XG5cdGFycm93Q29sb3I/OiBDb2xvcjtcblx0a2VlcEVkaXRvclNlbGVjdGlvbj86IGJvb2xlYW47XG5cdG9yZGluYWw/OiBudW1iZXI7XG5cdHNob3dJbkhpZGRlbkFyZWFzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3R5bGVzIHtcblx0ZnJhbWVDb2xvcj86IENvbG9yIHwgc3RyaW5nIHwgbnVsbDtcblx0YXJyb3dDb2xvcj86IENvbG9yIHwgbnVsbDtcbn1cblxuY29uc3QgZGVmYXVsdENvbG9yID0gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDEyMiwgMjA0KSk7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zOiBJT3B0aW9ucyA9IHtcblx0c2hvd0Fycm93OiB0cnVlLFxuXHRzaG93RnJhbWU6IHRydWUsXG5cdGNsYXNzTmFtZTogJycsXG5cdGZyYW1lQ29sb3I6IGRlZmF1bHRDb2xvcixcblx0YXJyb3dDb2xvcjogZGVmYXVsdENvbG9yLFxuXHRrZWVwRWRpdG9yU2VsZWN0aW9uOiBmYWxzZVxufTtcblxuY29uc3QgV0lER0VUX0lEID0gJ3ZzLmVkaXRvci5jb250cmliLnpvbmVXaWRnZXQnO1xuXG5jbGFzcyBWaWV3Wm9uZURlbGVnYXRlIGltcGxlbWVudHMgSVZpZXdab25lIHtcblxuXHRkb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0aWQ6IHN0cmluZyA9ICcnOyAvLyBBIHZhbGlkIHpvbmUgaWQgc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiAwXG5cdGFmdGVyTGluZU51bWJlcjogbnVtYmVyO1xuXHRhZnRlckNvbHVtbjogbnVtYmVyO1xuXHRoZWlnaHRJbkxpbmVzOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNob3dJbkhpZGRlbkFyZWFzOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBvcmRpbmFsOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Eb21Ob2RlVG9wOiAodG9wOiBudW1iZXIpID0+IHZvaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ29tcHV0ZWRIZWlnaHQ6IChoZWlnaHQ6IG51bWJlcikgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihkb21Ob2RlOiBIVE1MRWxlbWVudCwgYWZ0ZXJMaW5lTnVtYmVyOiBudW1iZXIsIGFmdGVyQ29sdW1uOiBudW1iZXIsIGhlaWdodEluTGluZXM6IG51bWJlcixcblx0XHRvbkRvbU5vZGVUb3A6ICh0b3A6IG51bWJlcikgPT4gdm9pZCxcblx0XHRvbkNvbXB1dGVkSGVpZ2h0OiAoaGVpZ2h0OiBudW1iZXIpID0+IHZvaWQsXG5cdFx0c2hvd0luSGlkZGVuQXJlYXM6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG5cdFx0b3JkaW5hbDogbnVtYmVyIHwgdW5kZWZpbmVkXG5cdCkge1xuXHRcdHRoaXMuZG9tTm9kZSA9IGRvbU5vZGU7XG5cdFx0dGhpcy5hZnRlckxpbmVOdW1iZXIgPSBhZnRlckxpbmVOdW1iZXI7XG5cdFx0dGhpcy5hZnRlckNvbHVtbiA9IGFmdGVyQ29sdW1uO1xuXHRcdHRoaXMuaGVpZ2h0SW5MaW5lcyA9IGhlaWdodEluTGluZXM7XG5cdFx0dGhpcy5zaG93SW5IaWRkZW5BcmVhcyA9IHNob3dJbkhpZGRlbkFyZWFzO1xuXHRcdHRoaXMub3JkaW5hbCA9IG9yZGluYWw7XG5cdFx0dGhpcy5fb25Eb21Ob2RlVG9wID0gb25Eb21Ob2RlVG9wO1xuXHRcdHRoaXMuX29uQ29tcHV0ZWRIZWlnaHQgPSBvbkNvbXB1dGVkSGVpZ2h0O1xuXHR9XG5cblx0b25Eb21Ob2RlVG9wKHRvcDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fb25Eb21Ob2RlVG9wKHRvcCk7XG5cdH1cblxuXHRvbkNvbXB1dGVkSGVpZ2h0KGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fb25Db21wdXRlZEhlaWdodChoZWlnaHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBPdmVybGF5V2lkZ2V0RGVsZWdhdGUgaW1wbGVtZW50cyBJT3ZlcmxheVdpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgZG9tTm9kZTogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLl9pZCA9IGlkO1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb21Ob2RlO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5jbGFzcyBBcnJvdyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0lkR2VuZXJhdG9yID0gbmV3IElkR2VuZXJhdG9yKCcuYXJyb3ctZGVjb3JhdGlvbi0nKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ydWxlTmFtZSA9IEFycm93Ll9JZEdlbmVyYXRvci5uZXh0SWQoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVjb3JhdGlvbnM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cdHByaXZhdGUgX2NvbG9yOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXIgPSAtMTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yXG5cdCkge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zID0gdGhpcy5fZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmhpZGUoKTtcblx0XHRkb21TdHlsZXNoZWV0c0pzLnJlbW92ZUNTU1J1bGVzQ29udGFpbmluZ1NlbGVjdG9yKHRoaXMuX3J1bGVOYW1lKTtcblx0fVxuXG5cdHNldCBjb2xvcih2YWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuX2NvbG9yICE9PSB2YWx1ZSkge1xuXHRcdFx0dGhpcy5fY29sb3IgPSB2YWx1ZTtcblx0XHRcdHRoaXMuX3VwZGF0ZVN0eWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0c2V0IGhlaWdodCh2YWx1ZTogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2hlaWdodCAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX2hlaWdodCA9IHZhbHVlO1xuXHRcdFx0dGhpcy5fdXBkYXRlU3R5bGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVTdHlsZSgpOiB2b2lkIHtcblx0XHRkb21TdHlsZXNoZWV0c0pzLnJlbW92ZUNTU1J1bGVzQ29udGFpbmluZ1NlbGVjdG9yKHRoaXMuX3J1bGVOYW1lKTtcblx0XHRkb21TdHlsZXNoZWV0c0pzLmNyZWF0ZUNTU1J1bGUoXG5cdFx0XHRgLm1vbmFjby1lZGl0b3IgJHt0aGlzLl9ydWxlTmFtZX1gLFxuXHRcdFx0YGJvcmRlci1zdHlsZTogc29saWQ7IGJvcmRlci1jb2xvcjogdHJhbnNwYXJlbnQ7IGJvcmRlci1ib3R0b20tY29sb3I6ICR7dGhpcy5fY29sb3J9OyBib3JkZXItd2lkdGg6ICR7dGhpcy5faGVpZ2h0fXB4OyBib3R0b206IC0ke3RoaXMuX2hlaWdodH1weCAhaW1wb3J0YW50OyBtYXJnaW4tbGVmdDogLSR7dGhpcy5faGVpZ2h0fXB4OyBgXG5cdFx0KTtcblx0fVxuXG5cdHNob3cod2hlcmU6IElQb3NpdGlvbik6IHZvaWQge1xuXG5cdFx0aWYgKHdoZXJlLmNvbHVtbiA9PT0gMSkge1xuXHRcdFx0Ly8gdGhlIGFycm93IGlzbid0IHByZXR0eSBhdCBjb2x1bW4gMSBhbmQgd2UgbmVlZCB0byBwdXNoIGl0IG91dCBhIGxpdHRsZVxuXHRcdFx0d2hlcmUgPSB7IGxpbmVOdW1iZXI6IHdoZXJlLmxpbmVOdW1iZXIsIGNvbHVtbjogMiB9O1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlY29yYXRpb25zLnNldChbe1xuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb21Qb3NpdGlvbnMod2hlcmUpLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ3pvbmUtd2lkZ2V0LWFycm93Jyxcblx0XHRcdFx0Y2xhc3NOYW1lOiB0aGlzLl9ydWxlTmFtZSxcblx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0XHRcdH1cblx0XHR9XSk7XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zLmNsZWFyKCk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFpvbmVXaWRnZXQgaW1wbGVtZW50cyBJSG9yaXpvbnRhbFNhc2hMYXlvdXRQcm92aWRlciB7XG5cblx0cHJpdmF0ZSBfYXJyb3c6IEFycm93IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX292ZXJsYXlXaWRnZXQ6IE92ZXJsYXlXaWRnZXREZWxlZ2F0ZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9yZXNpemVTYXNoOiBTYXNoIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2lzU2FzaFJlc2l6ZUhlaWdodDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wb3NpdGlvbk1hcmtlcklkOiBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uO1xuXG5cdHByb3RlY3RlZCBfdmlld1pvbmU6IFZpZXdab25lRGVsZWdhdGUgfCBudWxsID0gbnVsbDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb250YWluZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRvcHRpb25zOiBJT3B0aW9ucztcblxuXG5cdGNvbnN0cnVjdG9yKGVkaXRvcjogSUNvZGVFZGl0b3IsIG9wdGlvbnM6IElPcHRpb25zID0ge30pIHtcblx0XHR0aGlzLmVkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLl9wb3NpdGlvbk1hcmtlcklkID0gdGhpcy5lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0dGhpcy5vcHRpb25zID0gb2JqZWN0cy5kZWVwQ2xvbmUob3B0aW9ucyk7XG5cdFx0b2JqZWN0cy5taXhpbih0aGlzLm9wdGlvbnMsIGRlZmF1bHRPcHRpb25zLCBmYWxzZSk7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuaXNBY2Nlc3NpYmxlKSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLmVkaXRvci5vbkRpZExheW91dENoYW5nZSgoaW5mbzogRWRpdG9yTGF5b3V0SW5mbykgPT4ge1xuXHRcdFx0Y29uc3Qgd2lkdGggPSB0aGlzLl9nZXRXaWR0aChpbmZvKTtcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4Jztcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5sZWZ0ID0gdGhpcy5fZ2V0TGVmdChpbmZvKSArICdweCc7XG5cdFx0XHR0aGlzLl9vbldpZHRoKHdpZHRoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9vdmVybGF5V2lkZ2V0KSB7XG5cdFx0XHR0aGlzLmVkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMuX292ZXJsYXlXaWRnZXQpO1xuXHRcdFx0dGhpcy5fb3ZlcmxheVdpZGdldCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3ZpZXdab25lKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fdmlld1pvbmUpIHtcblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKHRoaXMuX3ZpZXdab25lLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl92aWV3Wm9uZSA9IG51bGw7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9wb3NpdGlvbk1hcmtlcklkLmNsZWFyKCk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRjcmVhdGUoKTogdm9pZCB7XG5cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnem9uZS13aWRnZXQnKTtcblx0XHRpZiAodGhpcy5vcHRpb25zLmNsYXNzTmFtZSkge1xuXHRcdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQodGhpcy5vcHRpb25zLmNsYXNzTmFtZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd6b25lLXdpZGdldC1jb250YWluZXInKTtcblx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5jb250YWluZXIpO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuc2hvd0Fycm93KSB7XG5cdFx0XHR0aGlzLl9hcnJvdyA9IG5ldyBBcnJvdyh0aGlzLmVkaXRvcik7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fYXJyb3cpO1xuXHRcdH1cblx0XHR0aGlzLl9maWxsQ29udGFpbmVyKHRoaXMuY29udGFpbmVyKTtcblx0XHR0aGlzLl9pbml0U2FzaCgpO1xuXHRcdHRoaXMuX2FwcGx5U3R5bGVzKCk7XG5cdH1cblxuXHRzdHlsZShzdHlsZXM6IElTdHlsZXMpOiB2b2lkIHtcblx0XHRpZiAoc3R5bGVzLmZyYW1lQ29sb3IpIHtcblx0XHRcdHRoaXMub3B0aW9ucy5mcmFtZUNvbG9yID0gc3R5bGVzLmZyYW1lQ29sb3I7XG5cdFx0fVxuXHRcdGlmIChzdHlsZXMuYXJyb3dDb2xvcikge1xuXHRcdFx0dGhpcy5vcHRpb25zLmFycm93Q29sb3IgPSBzdHlsZXMuYXJyb3dDb2xvcjtcblx0XHR9XG5cdFx0dGhpcy5fYXBwbHlTdHlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfYXBwbHlTdHlsZXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY29udGFpbmVyICYmIHRoaXMub3B0aW9ucy5mcmFtZUNvbG9yKSB7XG5cdFx0XHRjb25zdCBmcmFtZUNvbG9yID0gdGhpcy5vcHRpb25zLmZyYW1lQ29sb3IudG9TdHJpbmcoKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmJvcmRlclRvcENvbG9yID0gZnJhbWVDb2xvcjtcblx0XHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmJvcmRlckJvdHRvbUNvbG9yID0gZnJhbWVDb2xvcjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2Fycm93ICYmIHRoaXMub3B0aW9ucy5hcnJvd0NvbG9yKSB7XG5cdFx0XHRjb25zdCBhcnJvd0NvbG9yID0gdGhpcy5vcHRpb25zLmFycm93Q29sb3IudG9TdHJpbmcoKTtcblx0XHRcdHRoaXMuX2Fycm93LmNvbG9yID0gYXJyb3dDb2xvcjtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFdpZHRoKGluZm86IEVkaXRvckxheW91dEluZm8pOiBudW1iZXIge1xuXHRcdHJldHVybiBpbmZvLndpZHRoIC0gaW5mby5taW5pbWFwLm1pbmltYXBXaWR0aCAtIGluZm8udmVydGljYWxTY3JvbGxiYXJXaWR0aDtcblx0fVxuXG5cdHByaXZhdGUgX2dldExlZnQoaW5mbzogRWRpdG9yTGF5b3V0SW5mbyk6IG51bWJlciB7XG5cdFx0Ly8gSWYgbWluaW1hcCBpcyB0byB0aGUgbGVmdCwgd2UgbW92ZSBiZXlvbmQgaXRcblx0XHRpZiAoaW5mby5taW5pbWFwLm1pbmltYXBXaWR0aCA+IDAgJiYgaW5mby5taW5pbWFwLm1pbmltYXBMZWZ0ID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gaW5mby5taW5pbWFwLm1pbmltYXBXaWR0aDtcblx0XHR9XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRwcml2YXRlIF9vblZpZXdab25lVG9wKHRvcDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLnRvcCA9IHRvcCArICdweCc7XG5cdH1cblxuXHRwcml2YXRlIF9vblZpZXdab25lSGVpZ2h0KGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmhlaWdodCA9IGAke2hlaWdodH1weGA7XG5cblx0XHRpZiAodGhpcy5jb250YWluZXIpIHtcblx0XHRcdGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IGhlaWdodCAtIHRoaXMuX2RlY29yYXRpbmdFbGVtZW50c0hlaWdodCgpO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7Y29udGFpbmVySGVpZ2h0fXB4YDtcblx0XHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0XHR0aGlzLl9kb0xheW91dChjb250YWluZXJIZWlnaHQsIHRoaXMuX2dldFdpZHRoKGxheW91dEluZm8pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXNpemVTYXNoPy5sYXlvdXQoKTtcblx0fVxuXG5cdGdldCBwb3NpdGlvbigpOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9wb3NpdGlvbk1hcmtlcklkLmdldFJhbmdlKDApO1xuXHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiByYW5nZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdH1cblxuXHRoYXNGb2N1cygpIHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlLmNvbnRhaW5zKGRvbS5nZXRBY3RpdmVFbGVtZW50KCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9pc1Nob3dpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRzaG93KHJhbmdlT3JQb3M6IElSYW5nZSB8IElQb3NpdGlvbiwgaGVpZ2h0SW5MaW5lczogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBSYW5nZS5pc0lSYW5nZShyYW5nZU9yUG9zKSA/IFJhbmdlLmxpZnQocmFuZ2VPclBvcykgOiBSYW5nZS5mcm9tUG9zaXRpb25zKHJhbmdlT3JQb3MpO1xuXHRcdHRoaXMuX2lzU2hvd2luZyA9IHRydWU7XG5cdFx0dGhpcy5fc2hvd0ltcGwocmFuZ2UsIGhlaWdodEluTGluZXMpO1xuXHRcdHRoaXMuX2lzU2hvd2luZyA9IGZhbHNlO1xuXHRcdHRoaXMuX3Bvc2l0aW9uTWFya2VySWQuc2V0KFt7IHJhbmdlLCBvcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zLkVNUFRZIH1dKTtcblx0fVxuXG5cdHVwZGF0ZVBvc2l0aW9uQW5kSGVpZ2h0KHJhbmdlT3JQb3M6IElSYW5nZSB8IElQb3NpdGlvbiwgaGVpZ2h0SW5MaW5lcz86IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92aWV3Wm9uZSkge1xuXHRcdFx0cmFuZ2VPclBvcyA9IFJhbmdlLmlzSVJhbmdlKHJhbmdlT3JQb3MpID8gUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbihyYW5nZU9yUG9zKSA6IHJhbmdlT3JQb3M7XG5cdFx0XHR0aGlzLl92aWV3Wm9uZS5hZnRlckxpbmVOdW1iZXIgPSByYW5nZU9yUG9zLmxpbmVOdW1iZXI7XG5cdFx0XHR0aGlzLl92aWV3Wm9uZS5hZnRlckNvbHVtbiA9IHJhbmdlT3JQb3MuY29sdW1uO1xuXHRcdFx0dGhpcy5fdmlld1pvbmUuaGVpZ2h0SW5MaW5lcyA9IGhlaWdodEluTGluZXMgPz8gdGhpcy5fdmlld1pvbmUuaGVpZ2h0SW5MaW5lcztcblxuXHRcdFx0dGhpcy5lZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0YWNjZXNzb3IubGF5b3V0Wm9uZSh0aGlzLl92aWV3Wm9uZSEuaWQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9wb3NpdGlvbk1hcmtlcklkLnNldChbe1xuXHRcdFx0XHRyYW5nZTogUmFuZ2UuaXNJUmFuZ2UocmFuZ2VPclBvcykgPyByYW5nZU9yUG9zIDogUmFuZ2UuZnJvbVBvc2l0aW9ucyhyYW5nZU9yUG9zKSxcblx0XHRcdFx0b3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5FTVBUWVxuXHRcdFx0fV0pO1xuXHRcdFx0dGhpcy5fdXBkYXRlU2FzaEVuYWJsZW1lbnQoKTtcblx0XHR9XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92aWV3Wm9uZSkge1xuXHRcdFx0dGhpcy5lZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX3ZpZXdab25lKSB7XG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZSh0aGlzLl92aWV3Wm9uZS5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fdmlld1pvbmUgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fb3ZlcmxheVdpZGdldCkge1xuXHRcdFx0dGhpcy5lZGl0b3IucmVtb3ZlT3ZlcmxheVdpZGdldCh0aGlzLl9vdmVybGF5V2lkZ2V0KTtcblx0XHRcdHRoaXMuX292ZXJsYXlXaWRnZXQgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLl9hcnJvdz8uaGlkZSgpO1xuXHRcdHRoaXMuX3Bvc2l0aW9uTWFya2VySWQuY2xlYXIoKTtcblx0XHR0aGlzLl9pc1Nhc2hSZXNpemVIZWlnaHQgPSBmYWxzZTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZGVjb3JhdGluZ0VsZW1lbnRzSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0bGV0IHJlc3VsdCA9IDA7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLnNob3dBcnJvdykge1xuXHRcdFx0Y29uc3QgYXJyb3dIZWlnaHQgPSBNYXRoLnJvdW5kKGxpbmVIZWlnaHQgLyAzKTtcblx0XHRcdHJlc3VsdCArPSAyICogYXJyb3dIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5zaG93RnJhbWUpIHtcblx0XHRcdGNvbnN0IGZyYW1lVGhpY2tuZXNzID0gTWF0aC5yb3VuZChsaW5lSGVpZ2h0IC8gOSk7XG5cdFx0XHRyZXN1bHQgKz0gMiAqIGZyYW1lVGhpY2tuZXNzO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKiogR2V0cyB0aGUgbWF4aW11bSB3aWRnZXQgaGVpZ2h0IGluIGxpbmVzLiAqL1xuXHRwcm90ZWN0ZWQgX2dldE1heGltdW1IZWlnaHRJbkxpbmVzKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIE1hdGgubWF4KDEyLCAodGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmhlaWdodCAvIHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpICogMC44KTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dJbXBsKHdoZXJlOiBSYW5nZSwgaGVpZ2h0SW5MaW5lczogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSB3aGVyZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuZWRpdG9yLmdldExheW91dEluZm8oKTtcblx0XHRjb25zdCB3aWR0aCA9IHRoaXMuX2dldFdpZHRoKGxheW91dEluZm8pO1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUubGVmdCA9IHRoaXMuX2dldExlZnQobGF5b3V0SW5mbykgKyAncHgnO1xuXG5cdFx0Ly8gUmVuZGVyIHRoZSB3aWRnZXQgYXMgem9uZSAocmVuZGVyaW5nKSBhbmQgd2lkZ2V0IChsaWZlY3ljbGUpXG5cdFx0Y29uc3Qgdmlld1pvbmVEb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dmlld1pvbmVEb21Ob2RlLnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cblx0XHQvLyBhZGp1c3QgaGVpZ2h0SW5MaW5lcyB0byB2aWV3cG9ydFxuXHRcdGNvbnN0IG1heEhlaWdodEluTGluZXMgPSB0aGlzLl9nZXRNYXhpbXVtSGVpZ2h0SW5MaW5lcygpO1xuXHRcdGlmIChtYXhIZWlnaHRJbkxpbmVzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGhlaWdodEluTGluZXMgPSBNYXRoLm1pbihoZWlnaHRJbkxpbmVzLCBtYXhIZWlnaHRJbkxpbmVzKTtcblx0XHR9XG5cblx0XHRsZXQgYXJyb3dIZWlnaHQgPSAwO1xuXHRcdGxldCBmcmFtZVRoaWNrbmVzcyA9IDA7XG5cblx0XHQvLyBSZW5kZXIgdGhlIGFycm93IG9uZSAxLzMgb2YgYW4gZWRpdG9yIGxpbmUgaGVpZ2h0XG5cdFx0aWYgKHRoaXMuX2Fycm93ICYmIHRoaXMub3B0aW9ucy5zaG93QXJyb3cpIHtcblx0XHRcdGFycm93SGVpZ2h0ID0gTWF0aC5yb3VuZChsaW5lSGVpZ2h0IC8gMyk7XG5cdFx0XHR0aGlzLl9hcnJvdy5oZWlnaHQgPSBhcnJvd0hlaWdodDtcblx0XHRcdHRoaXMuX2Fycm93LnNob3cocG9zaXRpb24pO1xuXHRcdH1cblxuXHRcdC8vIFJlbmRlciB0aGUgZnJhbWUgYXMgMS85IG9mIGFuIGVkaXRvciBsaW5lIGhlaWdodFxuXHRcdGlmICh0aGlzLm9wdGlvbnMuc2hvd0ZyYW1lKSB7XG5cdFx0XHRmcmFtZVRoaWNrbmVzcyA9IE1hdGgucm91bmQobGluZUhlaWdodCAvIDkpO1xuXHRcdH1cblxuXHRcdC8vIGluc2VydCB6b25lIHdpZGdldFxuXHRcdHRoaXMuZWRpdG9yLmNoYW5nZVZpZXdab25lcygoYWNjZXNzb3I6IElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fdmlld1pvbmUpIHtcblx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZSh0aGlzLl92aWV3Wm9uZS5pZCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fb3ZlcmxheVdpZGdldCkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMuX292ZXJsYXlXaWRnZXQpO1xuXHRcdFx0XHR0aGlzLl9vdmVybGF5V2lkZ2V0ID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS50b3AgPSAnLTEwMDBweCc7XG5cdFx0XHR0aGlzLl92aWV3Wm9uZSA9IG5ldyBWaWV3Wm9uZURlbGVnYXRlKFxuXHRcdFx0XHR2aWV3Wm9uZURvbU5vZGUsXG5cdFx0XHRcdHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdFx0aGVpZ2h0SW5MaW5lcyxcblx0XHRcdFx0KHRvcDogbnVtYmVyKSA9PiB0aGlzLl9vblZpZXdab25lVG9wKHRvcCksXG5cdFx0XHRcdChoZWlnaHQ6IG51bWJlcikgPT4gdGhpcy5fb25WaWV3Wm9uZUhlaWdodChoZWlnaHQpLFxuXHRcdFx0XHR0aGlzLm9wdGlvbnMuc2hvd0luSGlkZGVuQXJlYXMsXG5cdFx0XHRcdHRoaXMub3B0aW9ucy5vcmRpbmFsXG5cdFx0XHQpO1xuXHRcdFx0dGhpcy5fdmlld1pvbmUuaWQgPSBhY2Nlc3Nvci5hZGRab25lKHRoaXMuX3ZpZXdab25lKTtcblx0XHRcdHRoaXMuX292ZXJsYXlXaWRnZXQgPSBuZXcgT3ZlcmxheVdpZGdldERlbGVnYXRlKFdJREdFVF9JRCArIHRoaXMuX3ZpZXdab25lLmlkLCB0aGlzLmRvbU5vZGUpO1xuXHRcdFx0dGhpcy5lZGl0b3IuYWRkT3ZlcmxheVdpZGdldCh0aGlzLl9vdmVybGF5V2lkZ2V0KTtcblx0XHR9KTtcblx0XHR0aGlzLl91cGRhdGVTYXNoRW5hYmxlbWVudCgpO1xuXG5cdFx0aWYgKHRoaXMuY29udGFpbmVyICYmIHRoaXMub3B0aW9ucy5zaG93RnJhbWUpIHtcblx0XHRcdGNvbnN0IHdpZHRoID0gdGhpcy5vcHRpb25zLmZyYW1lV2lkdGggPyB0aGlzLm9wdGlvbnMuZnJhbWVXaWR0aCA6IGZyYW1lVGhpY2tuZXNzO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUuYm9yZGVyVG9wV2lkdGggPSB3aWR0aCArICdweCc7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5ib3JkZXJCb3R0b21XaWR0aCA9IHdpZHRoICsgJ3B4Jztcblx0XHR9XG5cblx0XHRjb25zdCBjb250YWluZXJIZWlnaHQgPSBoZWlnaHRJbkxpbmVzICogbGluZUhlaWdodCAtIHRoaXMuX2RlY29yYXRpbmdFbGVtZW50c0hlaWdodCgpO1xuXG5cdFx0aWYgKHRoaXMuY29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS50b3AgPSBhcnJvd0hlaWdodCArICdweCc7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBjb250YWluZXJIZWlnaHQgKyAncHgnO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcblx0XHR9XG5cblx0XHR0aGlzLl9kb0xheW91dChjb250YWluZXJIZWlnaHQsIHdpZHRoKTtcblxuXHRcdGlmICghdGhpcy5vcHRpb25zLmtlZXBFZGl0b3JTZWxlY3Rpb24pIHtcblx0XHRcdHRoaXMuZWRpdG9yLnNldFNlbGVjdGlvbih3aGVyZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBtb2RlbC52YWxpZGF0ZVJhbmdlKG5ldyBSYW5nZSh3aGVyZS5zdGFydExpbmVOdW1iZXIsIDEsIHdoZXJlLmVuZExpbmVOdW1iZXIgKyAxLCAxKSk7XG5cdFx0XHR0aGlzLnJldmVhbFJhbmdlKHJhbmdlLCByYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmV2ZWFsUmFuZ2UocmFuZ2U6IFJhbmdlLCBpc0xhc3RMaW5lOiBib29sZWFuKSB7XG5cdFx0aWYgKGlzTGFzdExpbmUpIHtcblx0XHRcdHRoaXMuZWRpdG9yLnJldmVhbExpbmVOZWFyVG9wKHJhbmdlLmVuZExpbmVOdW1iZXIsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0b3IucmV2ZWFsUmFuZ2UocmFuZ2UsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgc2V0Q3NzQ2xhc3MoY2xhc3NOYW1lOiBzdHJpbmcsIGNsYXNzVG9SZXBsYWNlPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjbGFzc1RvUmVwbGFjZSkge1xuXHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShjbGFzc1RvUmVwbGFjZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuXG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2ZpbGxDb250YWluZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQ7XG5cblx0cHJvdGVjdGVkIF9vbldpZHRoKHdpZHRoSW5QaXhlbDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gaW1wbGVtZW50IGluIHN1YmNsYXNzXG5cdH1cblxuXHRwcm90ZWN0ZWQgX2RvTGF5b3V0KGhlaWdodEluUGl4ZWw6IG51bWJlciwgd2lkdGhJblBpeGVsOiBudW1iZXIpOiB2b2lkIHtcblx0XHQvLyBpbXBsZW1lbnQgaW4gc3ViY2xhc3Ncblx0fVxuXG5cdHByb3RlY3RlZCBfcmVsYXlvdXQoX25ld0hlaWdodEluTGluZXM6IG51bWJlciwgdXNlTWF4PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IG1heEhlaWdodEluTGluZXMgPSB0aGlzLl9nZXRNYXhpbXVtSGVpZ2h0SW5MaW5lcygpO1xuXHRcdGNvbnN0IG5ld0hlaWdodEluTGluZXMgPSAodXNlTWF4ICYmIChtYXhIZWlnaHRJbkxpbmVzICE9PSB1bmRlZmluZWQpKSA/IE1hdGgubWluKG1heEhlaWdodEluTGluZXMsIF9uZXdIZWlnaHRJbkxpbmVzKSA6IF9uZXdIZWlnaHRJbkxpbmVzO1xuXHRcdGlmICh0aGlzLl92aWV3Wm9uZSAmJiB0aGlzLl92aWV3Wm9uZS5oZWlnaHRJbkxpbmVzICE9PSBuZXdIZWlnaHRJbkxpbmVzKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fdmlld1pvbmUpIHtcblx0XHRcdFx0XHR0aGlzLl92aWV3Wm9uZS5oZWlnaHRJbkxpbmVzID0gbmV3SGVpZ2h0SW5MaW5lcztcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKHRoaXMuX3ZpZXdab25lLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl91cGRhdGVTYXNoRW5hYmxlbWVudCgpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBzYXNoXG5cblx0cHJpdmF0ZSBfaW5pdFNhc2goKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3Jlc2l6ZVNhc2gpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmVzaXplU2FzaCA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgU2FzaCh0aGlzLmRvbU5vZGUsIHRoaXMsIHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUwgfSkpO1xuXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuaXNSZXNpemVhYmxlKSB7XG5cdFx0XHR0aGlzLl9yZXNpemVTYXNoLnN0YXRlID0gU2FzaFN0YXRlLkRpc2FibGVkO1xuXHRcdH1cblxuXHRcdGxldCBkYXRhOiB7IHN0YXJ0WTogbnVtYmVyOyBoZWlnaHRJbkxpbmVzOiBudW1iZXI7IG1pbkxpbmVzOiBudW1iZXI7IG1heExpbmVzOiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVzaXplU2FzaC5vbkRpZFN0YXJ0KChlOiBJU2FzaEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fdmlld1pvbmUpIHtcblx0XHRcdFx0ZGF0YSA9IHtcblx0XHRcdFx0XHRzdGFydFk6IGUuc3RhcnRZLFxuXHRcdFx0XHRcdGhlaWdodEluTGluZXM6IHRoaXMuX3ZpZXdab25lLmhlaWdodEluTGluZXMsXG5cdFx0XHRcdFx0Li4uIHRoaXMuX2dldFJlc2l6ZUJvdW5kcygpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3Jlc2l6ZVNhc2gub25EaWRFbmQoKCkgPT4ge1xuXHRcdFx0ZGF0YSA9IHVuZGVmaW5lZDtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVzaXplU2FzaC5vbkRpZENoYW5nZSgoZXZ0OiBJU2FzaEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRjb25zdCBsaW5lRGVsdGEgPSAoZXZ0LmN1cnJlbnRZIC0gZGF0YS5zdGFydFkpIC8gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdFx0Y29uc3Qgcm91bmRlZExpbmVEZWx0YSA9IGxpbmVEZWx0YSA8IDAgPyBNYXRoLmNlaWwobGluZURlbHRhKSA6IE1hdGguZmxvb3IobGluZURlbHRhKTtcblx0XHRcdFx0Y29uc3QgbmV3SGVpZ2h0SW5MaW5lcyA9IGRhdGEuaGVpZ2h0SW5MaW5lcyArIHJvdW5kZWRMaW5lRGVsdGE7XG5cblx0XHRcdFx0aWYgKG5ld0hlaWdodEluTGluZXMgPiBkYXRhLm1pbkxpbmVzICYmIG5ld0hlaWdodEluTGluZXMgPCBkYXRhLm1heExpbmVzKSB7XG5cdFx0XHRcdFx0dGhpcy5faXNTYXNoUmVzaXplSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLl9yZWxheW91dChuZXdIZWlnaHRJbkxpbmVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVNhc2hFbmFibGVtZW50KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yZXNpemVTYXNoKSB7XG5cdFx0XHRjb25zdCB7IG1pbkxpbmVzLCBtYXhMaW5lcyB9ID0gdGhpcy5fZ2V0UmVzaXplQm91bmRzKCk7XG5cdFx0XHR0aGlzLl9yZXNpemVTYXNoLnN0YXRlID0gbWluTGluZXMgPT09IG1heExpbmVzID8gU2FzaFN0YXRlLkRpc2FibGVkIDogU2FzaFN0YXRlLkVuYWJsZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBfdXNlc1Jlc2l6ZUhlaWdodCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNTYXNoUmVzaXplSGVpZ2h0O1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRSZXNpemVCb3VuZHMoKTogeyByZWFkb25seSBtaW5MaW5lczogbnVtYmVyOyByZWFkb25seSBtYXhMaW5lczogbnVtYmVyIH0ge1xuXHRcdHJldHVybiB7IG1pbkxpbmVzOiA1LCBtYXhMaW5lczogMzUgfTtcblx0fVxuXG5cdGdldEhvcml6b250YWxTYXNoTGVmdCgpIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGdldEhvcml6b250YWxTYXNoVG9wKCkge1xuXHRcdHJldHVybiAodGhpcy5kb21Ob2RlLnN0eWxlLmhlaWdodCA9PT0gbnVsbCA/IDAgOiBwYXJzZUludCh0aGlzLmRvbU5vZGUuc3R5bGUuaGVpZ2h0KSkgLSAodGhpcy5fZGVjb3JhdGluZ0VsZW1lbnRzSGVpZ2h0KCkgLyAyKTtcblx0fVxuXG5cdGdldEhvcml6b250YWxTYXNoV2lkdGgoKSB7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuZWRpdG9yLmdldExheW91dEluZm8oKTtcblx0XHRyZXR1cm4gbGF5b3V0SW5mby53aWR0aCAtIGxheW91dEluZm8ubWluaW1hcC5taW5pbWFwV2lkdGg7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLHNCQUFzQjtBQUNsQyxTQUFvRCxhQUFhLE1BQU0saUJBQWlCO0FBQ3hGLFNBQVMsT0FBTyxZQUFZO0FBQzVCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFlBQVksYUFBYTtBQUN6QixPQUFPO0FBRVAsU0FBMkIsb0JBQW9CO0FBRS9DLFNBQWlCLGFBQWE7QUFDOUIsU0FBdUMsa0JBQWtCO0FBQ3pELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsOEJBQThCO0FBcUJ2QyxNQUFNLGVBQWUsSUFBSSxNQUFNLElBQUksS0FBSyxHQUFHLEtBQUssR0FBRyxDQUFDO0FBRXBELE1BQU0saUJBQTJCO0FBQUEsRUFDaEMsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUFBLEVBQ1gsWUFBWTtBQUFBLEVBQ1osWUFBWTtBQUFBLEVBQ1oscUJBQXFCO0FBQ3RCO0FBRUEsTUFBTSxZQUFZO0FBRWxCLE1BQU0saUJBQXNDO0FBQUEsRUFhM0MsWUFBWSxTQUFzQixpQkFBeUIsYUFBcUIsZUFDL0UsY0FDQSxrQkFDQSxtQkFDQSxTQUNDO0FBZkYsY0FBYTtBQWdCWixTQUFLLFVBQVU7QUFDZixTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGNBQWM7QUFDbkIsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxVQUFVO0FBQ2YsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyxvQkFBb0I7QUFBQSxFQUMxQjtBQUFBLEVBRUEsYUFBYSxLQUFtQjtBQUMvQixTQUFLLGNBQWMsR0FBRztBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxpQkFBaUIsUUFBc0I7QUFDdEMsU0FBSyxrQkFBa0IsTUFBTTtBQUFBLEVBQzlCO0FBQ0Q7QUFFTyxNQUFNLHNCQUFnRDtBQUFBLEVBSzVELFlBQVksSUFBWSxTQUFzQjtBQUM3QyxTQUFLLE1BQU07QUFDWCxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBRUEsUUFBZ0I7QUFDZixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxhQUEwQjtBQUN6QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxjQUE2QztBQUM1QyxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRUEsTUFBTSxTQUFOLE1BQU0sT0FBTTtBQUFBLEVBU1gsWUFDa0IsU0FDaEI7QUFEZ0I7QUFObEIsU0FBaUIsWUFBWSxPQUFNLGFBQWEsT0FBTztBQUV2RCxTQUFRLFNBQXdCO0FBQ2hDLFNBQVEsVUFBa0I7QUFLekIsU0FBSyxlQUFlLEtBQUssUUFBUSw0QkFBNEI7QUFBQSxFQUM5RDtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLEtBQUs7QUFDVixxQkFBaUIsaUNBQWlDLEtBQUssU0FBUztBQUFBLEVBQ2pFO0FBQUEsRUFFQSxJQUFJLE1BQU0sT0FBZTtBQUN4QixRQUFJLEtBQUssV0FBVyxPQUFPO0FBQzFCLFdBQUssU0FBUztBQUNkLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBSSxPQUFPLE9BQWU7QUFDekIsUUFBSSxLQUFLLFlBQVksT0FBTztBQUMzQixXQUFLLFVBQVU7QUFDZixXQUFLLGFBQWE7QUFBQSxJQUNuQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGVBQXFCO0FBQzVCLHFCQUFpQixpQ0FBaUMsS0FBSyxTQUFTO0FBQ2hFLHFCQUFpQjtBQUFBLE1BQ2hCLGtCQUFrQixLQUFLLFNBQVM7QUFBQSxNQUNoQyx3RUFBd0UsS0FBSyxNQUFNLG1CQUFtQixLQUFLLE9BQU8sZ0JBQWdCLEtBQUssT0FBTyxnQ0FBZ0MsS0FBSyxPQUFPO0FBQUEsSUFDM0w7QUFBQSxFQUNEO0FBQUEsRUFFQSxLQUFLLE9BQXdCO0FBRTVCLFFBQUksTUFBTSxXQUFXLEdBQUc7QUFFdkIsY0FBUSxFQUFFLFlBQVksTUFBTSxZQUFZLFFBQVEsRUFBRTtBQUFBLElBQ25EO0FBRUEsU0FBSyxhQUFhLElBQUksQ0FBQztBQUFBLE1BQ3RCLE9BQU8sTUFBTSxjQUFjLEtBQUs7QUFBQSxNQUNoQyxTQUFTO0FBQUEsUUFDUixhQUFhO0FBQUEsUUFDYixXQUFXLEtBQUs7QUFBQSxRQUNoQixZQUFZLHVCQUF1QjtBQUFBLE1BQ3BDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxPQUFhO0FBQ1osU0FBSyxhQUFhLE1BQU07QUFBQSxFQUN6QjtBQUNEO0FBOURNLE9BRW1CLGVBQWUsSUFBSSxZQUFZLG9CQUFvQjtBQUY1RSxJQUFNLFFBQU47QUFnRU8sTUFBZSxXQUFvRDtBQUFBLEVBaUJ6RSxZQUFZLFFBQXFCLFVBQW9CLENBQUMsR0FBRztBQWZ6RCxTQUFRLFNBQXVCO0FBQy9CLFNBQVEsaUJBQStDO0FBQ3ZELFNBQVEsY0FBMkI7QUFDbkMsU0FBUSxzQkFBK0I7QUFHdkMsU0FBVSxZQUFxQztBQUMvQyxTQUFtQixlQUFlLElBQUksZ0JBQWdCO0FBRXRELHFCQUFnQztBQStIaEMsU0FBVSxhQUFzQjtBQXhIL0IsU0FBSyxTQUFTO0FBQ2QsU0FBSyxvQkFBb0IsS0FBSyxPQUFPLDRCQUE0QjtBQUNqRSxTQUFLLFVBQVUsUUFBUSxVQUFVLE9BQU87QUFDeEMsWUFBUSxNQUFNLEtBQUssU0FBUyxnQkFBZ0IsS0FBSztBQUNqRCxTQUFLLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDM0MsUUFBSSxDQUFDLEtBQUssUUFBUSxjQUFjO0FBQy9CLFdBQUssUUFBUSxhQUFhLGVBQWUsTUFBTTtBQUMvQyxXQUFLLFFBQVEsYUFBYSxRQUFRLGNBQWM7QUFBQSxJQUNqRDtBQUVBLFNBQUssYUFBYSxJQUFJLEtBQUssT0FBTyxrQkFBa0IsQ0FBQyxTQUEyQjtBQUMvRSxZQUFNLFFBQVEsS0FBSyxVQUFVLElBQUk7QUFDakMsV0FBSyxRQUFRLE1BQU0sUUFBUSxRQUFRO0FBQ25DLFdBQUssUUFBUSxNQUFNLE9BQU8sS0FBSyxTQUFTLElBQUksSUFBSTtBQUNoRCxXQUFLLFNBQVMsS0FBSztBQUFBLElBQ3BCLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsUUFBSSxLQUFLLGdCQUFnQjtBQUN4QixXQUFLLE9BQU8sb0JBQW9CLEtBQUssY0FBYztBQUNuRCxXQUFLLGlCQUFpQjtBQUFBLElBQ3ZCO0FBRUEsUUFBSSxLQUFLLFdBQVc7QUFDbkIsV0FBSyxPQUFPLGdCQUFnQixjQUFZO0FBQ3ZDLFlBQUksS0FBSyxXQUFXO0FBQ25CLG1CQUFTLFdBQVcsS0FBSyxVQUFVLEVBQUU7QUFBQSxRQUN0QztBQUNBLGFBQUssWUFBWTtBQUFBLE1BQ2xCLENBQUM7QUFBQSxJQUNGO0FBRUEsU0FBSyxrQkFBa0IsTUFBTTtBQUU3QixTQUFLLGFBQWEsUUFBUTtBQUFBLEVBQzNCO0FBQUEsRUFFQSxTQUFlO0FBRWQsU0FBSyxRQUFRLFVBQVUsSUFBSSxhQUFhO0FBQ3hDLFFBQUksS0FBSyxRQUFRLFdBQVc7QUFDM0IsV0FBSyxRQUFRLFVBQVUsSUFBSSxLQUFLLFFBQVEsU0FBUztBQUFBLElBQ2xEO0FBRUEsU0FBSyxZQUFZLFNBQVMsY0FBYyxLQUFLO0FBQzdDLFNBQUssVUFBVSxVQUFVLElBQUksdUJBQXVCO0FBQ3BELFNBQUssUUFBUSxZQUFZLEtBQUssU0FBUztBQUN2QyxRQUFJLEtBQUssUUFBUSxXQUFXO0FBQzNCLFdBQUssU0FBUyxJQUFJLE1BQU0sS0FBSyxNQUFNO0FBQ25DLFdBQUssYUFBYSxJQUFJLEtBQUssTUFBTTtBQUFBLElBQ2xDO0FBQ0EsU0FBSyxlQUFlLEtBQUssU0FBUztBQUNsQyxTQUFLLFVBQVU7QUFDZixTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRUEsTUFBTSxRQUF1QjtBQUM1QixRQUFJLE9BQU8sWUFBWTtBQUN0QixXQUFLLFFBQVEsYUFBYSxPQUFPO0FBQUEsSUFDbEM7QUFDQSxRQUFJLE9BQU8sWUFBWTtBQUN0QixXQUFLLFFBQVEsYUFBYSxPQUFPO0FBQUEsSUFDbEM7QUFDQSxTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRVUsZUFBcUI7QUFDOUIsUUFBSSxLQUFLLGFBQWEsS0FBSyxRQUFRLFlBQVk7QUFDOUMsWUFBTSxhQUFhLEtBQUssUUFBUSxXQUFXLFNBQVM7QUFDcEQsV0FBSyxVQUFVLE1BQU0saUJBQWlCO0FBQ3RDLFdBQUssVUFBVSxNQUFNLG9CQUFvQjtBQUFBLElBQzFDO0FBQ0EsUUFBSSxLQUFLLFVBQVUsS0FBSyxRQUFRLFlBQVk7QUFDM0MsWUFBTSxhQUFhLEtBQUssUUFBUSxXQUFXLFNBQVM7QUFDcEQsV0FBSyxPQUFPLFFBQVE7QUFBQSxJQUNyQjtBQUFBLEVBQ0Q7QUFBQSxFQUVVLFVBQVUsTUFBZ0M7QUFDbkQsV0FBTyxLQUFLLFFBQVEsS0FBSyxRQUFRLGVBQWUsS0FBSztBQUFBLEVBQ3REO0FBQUEsRUFFUSxTQUFTLE1BQWdDO0FBRWhELFFBQUksS0FBSyxRQUFRLGVBQWUsS0FBSyxLQUFLLFFBQVEsZ0JBQWdCLEdBQUc7QUFDcEUsYUFBTyxLQUFLLFFBQVE7QUFBQSxJQUNyQjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxlQUFlLEtBQW1CO0FBQ3pDLFNBQUssUUFBUSxNQUFNLE1BQU0sTUFBTTtBQUFBLEVBQ2hDO0FBQUEsRUFFUSxrQkFBa0IsUUFBc0I7QUFDL0MsU0FBSyxRQUFRLE1BQU0sU0FBUyxHQUFHLE1BQU07QUFFckMsUUFBSSxLQUFLLFdBQVc7QUFDbkIsWUFBTSxrQkFBa0IsU0FBUyxLQUFLLDBCQUEwQjtBQUNoRSxXQUFLLFVBQVUsTUFBTSxTQUFTLEdBQUcsZUFBZTtBQUNoRCxZQUFNLGFBQWEsS0FBSyxPQUFPLGNBQWM7QUFDN0MsV0FBSyxVQUFVLGlCQUFpQixLQUFLLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDM0Q7QUFFQSxTQUFLLGFBQWEsT0FBTztBQUFBLEVBQzFCO0FBQUEsRUFFQSxJQUFJLFdBQWlDO0FBQ3BDLFVBQU0sUUFBUSxLQUFLLGtCQUFrQixTQUFTLENBQUM7QUFDL0MsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sTUFBTSxpQkFBaUI7QUFBQSxFQUMvQjtBQUFBLEVBRUEsV0FBVztBQUNWLFdBQU8sS0FBSyxRQUFRLFNBQVMsSUFBSSxpQkFBaUIsQ0FBQztBQUFBLEVBQ3BEO0FBQUEsRUFJQSxLQUFLLFlBQWdDLGVBQTZCO0FBQ2pFLFVBQU0sUUFBUSxNQUFNLFNBQVMsVUFBVSxJQUFJLE1BQU0sS0FBSyxVQUFVLElBQUksTUFBTSxjQUFjLFVBQVU7QUFDbEcsU0FBSyxhQUFhO0FBQ2xCLFNBQUssVUFBVSxPQUFPLGFBQWE7QUFDbkMsU0FBSyxhQUFhO0FBQ2xCLFNBQUssa0JBQWtCLElBQUksQ0FBQyxFQUFFLE9BQU8sU0FBUyx1QkFBdUIsTUFBTSxDQUFDLENBQUM7QUFBQSxFQUM5RTtBQUFBLEVBRUEsd0JBQXdCLFlBQWdDLGVBQThCO0FBQ3JGLFFBQUksS0FBSyxXQUFXO0FBQ25CLG1CQUFhLE1BQU0sU0FBUyxVQUFVLElBQUksTUFBTSxpQkFBaUIsVUFBVSxJQUFJO0FBQy9FLFdBQUssVUFBVSxrQkFBa0IsV0FBVztBQUM1QyxXQUFLLFVBQVUsY0FBYyxXQUFXO0FBQ3hDLFdBQUssVUFBVSxnQkFBZ0IsaUJBQWlCLEtBQUssVUFBVTtBQUUvRCxXQUFLLE9BQU8sZ0JBQWdCLGNBQVk7QUFDdkMsaUJBQVMsV0FBVyxLQUFLLFVBQVcsRUFBRTtBQUFBLE1BQ3ZDLENBQUM7QUFDRCxXQUFLLGtCQUFrQixJQUFJLENBQUM7QUFBQSxRQUMzQixPQUFPLE1BQU0sU0FBUyxVQUFVLElBQUksYUFBYSxNQUFNLGNBQWMsVUFBVTtBQUFBLFFBQy9FLFNBQVMsdUJBQXVCO0FBQUEsTUFDakMsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxzQkFBc0I7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE9BQWE7QUFDWixRQUFJLEtBQUssV0FBVztBQUNuQixXQUFLLE9BQU8sZ0JBQWdCLGNBQVk7QUFDdkMsWUFBSSxLQUFLLFdBQVc7QUFDbkIsbUJBQVMsV0FBVyxLQUFLLFVBQVUsRUFBRTtBQUFBLFFBQ3RDO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxZQUFZO0FBQUEsSUFDbEI7QUFDQSxRQUFJLEtBQUssZ0JBQWdCO0FBQ3hCLFdBQUssT0FBTyxvQkFBb0IsS0FBSyxjQUFjO0FBQ25ELFdBQUssaUJBQWlCO0FBQUEsSUFDdkI7QUFDQSxTQUFLLFFBQVEsS0FBSztBQUNsQixTQUFLLGtCQUFrQixNQUFNO0FBQzdCLFNBQUssc0JBQXNCO0FBQUEsRUFDNUI7QUFBQSxFQUVVLDRCQUFvQztBQUM3QyxVQUFNLGFBQWEsS0FBSyxPQUFPLFVBQVUsYUFBYSxVQUFVO0FBQ2hFLFFBQUksU0FBUztBQUViLFFBQUksS0FBSyxRQUFRLFdBQVc7QUFDM0IsWUFBTSxjQUFjLEtBQUssTUFBTSxhQUFhLENBQUM7QUFDN0MsZ0JBQVUsSUFBSTtBQUFBLElBQ2Y7QUFFQSxRQUFJLEtBQUssUUFBUSxXQUFXO0FBQzNCLFlBQU0saUJBQWlCLEtBQUssTUFBTSxhQUFhLENBQUM7QUFDaEQsZ0JBQVUsSUFBSTtBQUFBLElBQ2Y7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFHVSwyQkFBK0M7QUFDeEQsV0FBTyxLQUFLLElBQUksSUFBSyxLQUFLLE9BQU8sY0FBYyxFQUFFLFNBQVMsS0FBSyxPQUFPLFVBQVUsYUFBYSxVQUFVLElBQUssR0FBRztBQUFBLEVBQ2hIO0FBQUEsRUFFUSxVQUFVLE9BQWMsZUFBNkI7QUFDNUQsVUFBTSxXQUFXLE1BQU0saUJBQWlCO0FBQ3hDLFVBQU0sYUFBYSxLQUFLLE9BQU8sY0FBYztBQUM3QyxVQUFNLFFBQVEsS0FBSyxVQUFVLFVBQVU7QUFDdkMsU0FBSyxRQUFRLE1BQU0sUUFBUSxHQUFHLEtBQUs7QUFDbkMsU0FBSyxRQUFRLE1BQU0sT0FBTyxLQUFLLFNBQVMsVUFBVSxJQUFJO0FBR3RELFVBQU0sa0JBQWtCLFNBQVMsY0FBYyxLQUFLO0FBQ3BELG9CQUFnQixNQUFNLFdBQVc7QUFDakMsVUFBTSxhQUFhLEtBQUssT0FBTyxVQUFVLGFBQWEsVUFBVTtBQUdoRSxVQUFNLG1CQUFtQixLQUFLLHlCQUF5QjtBQUN2RCxRQUFJLHFCQUFxQixRQUFXO0FBQ25DLHNCQUFnQixLQUFLLElBQUksZUFBZSxnQkFBZ0I7QUFBQSxJQUN6RDtBQUVBLFFBQUksY0FBYztBQUNsQixRQUFJLGlCQUFpQjtBQUdyQixRQUFJLEtBQUssVUFBVSxLQUFLLFFBQVEsV0FBVztBQUMxQyxvQkFBYyxLQUFLLE1BQU0sYUFBYSxDQUFDO0FBQ3ZDLFdBQUssT0FBTyxTQUFTO0FBQ3JCLFdBQUssT0FBTyxLQUFLLFFBQVE7QUFBQSxJQUMxQjtBQUdBLFFBQUksS0FBSyxRQUFRLFdBQVc7QUFDM0IsdUJBQWlCLEtBQUssTUFBTSxhQUFhLENBQUM7QUFBQSxJQUMzQztBQUdBLFNBQUssT0FBTyxnQkFBZ0IsQ0FBQyxhQUFzQztBQUNsRSxVQUFJLEtBQUssV0FBVztBQUNuQixpQkFBUyxXQUFXLEtBQUssVUFBVSxFQUFFO0FBQUEsTUFDdEM7QUFDQSxVQUFJLEtBQUssZ0JBQWdCO0FBQ3hCLGFBQUssT0FBTyxvQkFBb0IsS0FBSyxjQUFjO0FBQ25ELGFBQUssaUJBQWlCO0FBQUEsTUFDdkI7QUFDQSxXQUFLLFFBQVEsTUFBTSxNQUFNO0FBQ3pCLFdBQUssWUFBWSxJQUFJO0FBQUEsUUFDcEI7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFNBQVM7QUFBQSxRQUNUO0FBQUEsUUFDQSxDQUFDLFFBQWdCLEtBQUssZUFBZSxHQUFHO0FBQUEsUUFDeEMsQ0FBQyxXQUFtQixLQUFLLGtCQUFrQixNQUFNO0FBQUEsUUFDakQsS0FBSyxRQUFRO0FBQUEsUUFDYixLQUFLLFFBQVE7QUFBQSxNQUNkO0FBQ0EsV0FBSyxVQUFVLEtBQUssU0FBUyxRQUFRLEtBQUssU0FBUztBQUNuRCxXQUFLLGlCQUFpQixJQUFJLHNCQUFzQixZQUFZLEtBQUssVUFBVSxJQUFJLEtBQUssT0FBTztBQUMzRixXQUFLLE9BQU8saUJBQWlCLEtBQUssY0FBYztBQUFBLElBQ2pELENBQUM7QUFDRCxTQUFLLHNCQUFzQjtBQUUzQixRQUFJLEtBQUssYUFBYSxLQUFLLFFBQVEsV0FBVztBQUM3QyxZQUFNQSxTQUFRLEtBQUssUUFBUSxhQUFhLEtBQUssUUFBUSxhQUFhO0FBQ2xFLFdBQUssVUFBVSxNQUFNLGlCQUFpQkEsU0FBUTtBQUM5QyxXQUFLLFVBQVUsTUFBTSxvQkFBb0JBLFNBQVE7QUFBQSxJQUNsRDtBQUVBLFVBQU0sa0JBQWtCLGdCQUFnQixhQUFhLEtBQUssMEJBQTBCO0FBRXBGLFFBQUksS0FBSyxXQUFXO0FBQ25CLFdBQUssVUFBVSxNQUFNLE1BQU0sY0FBYztBQUN6QyxXQUFLLFVBQVUsTUFBTSxTQUFTLGtCQUFrQjtBQUNoRCxXQUFLLFVBQVUsTUFBTSxXQUFXO0FBQUEsSUFDakM7QUFFQSxTQUFLLFVBQVUsaUJBQWlCLEtBQUs7QUFFckMsUUFBSSxDQUFDLEtBQUssUUFBUSxxQkFBcUI7QUFDdEMsV0FBSyxPQUFPLGFBQWEsS0FBSztBQUFBLElBQy9CO0FBRUEsVUFBTSxRQUFRLEtBQUssT0FBTyxTQUFTO0FBQ25DLFFBQUksT0FBTztBQUNWLFlBQU0sUUFBUSxNQUFNLGNBQWMsSUFBSSxNQUFNLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFDakcsV0FBSyxZQUFZLE9BQU8sTUFBTSxvQkFBb0IsTUFBTSxhQUFhLENBQUM7QUFBQSxJQUN2RTtBQUFBLEVBQ0Q7QUFBQSxFQUVVLFlBQVksT0FBYyxZQUFxQjtBQUN4RCxRQUFJLFlBQVk7QUFDZixXQUFLLE9BQU8sa0JBQWtCLE1BQU0sZUFBZSxXQUFXLE1BQU07QUFBQSxJQUNyRSxPQUFPO0FBQ04sV0FBSyxPQUFPLFlBQVksT0FBTyxXQUFXLE1BQU07QUFBQSxJQUNqRDtBQUFBLEVBQ0Q7QUFBQSxFQUVVLFlBQVksV0FBbUIsZ0JBQStCO0FBQ3ZFLFFBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxJQUNEO0FBRUEsUUFBSSxnQkFBZ0I7QUFDbkIsV0FBSyxVQUFVLFVBQVUsT0FBTyxjQUFjO0FBQUEsSUFDL0M7QUFFQSxTQUFLLFVBQVUsVUFBVSxJQUFJLFNBQVM7QUFBQSxFQUV2QztBQUFBLEVBSVUsU0FBUyxjQUE0QjtBQUFBLEVBRS9DO0FBQUEsRUFFVSxVQUFVLGVBQXVCLGNBQTRCO0FBQUEsRUFFdkU7QUFBQSxFQUVVLFVBQVUsbUJBQTJCLFFBQXdCO0FBQ3RFLFVBQU0sbUJBQW1CLEtBQUsseUJBQXlCO0FBQ3ZELFVBQU0sbUJBQW9CLFVBQVcscUJBQXFCLFNBQWMsS0FBSyxJQUFJLGtCQUFrQixpQkFBaUIsSUFBSTtBQUN4SCxRQUFJLEtBQUssYUFBYSxLQUFLLFVBQVUsa0JBQWtCLGtCQUFrQjtBQUN4RSxXQUFLLE9BQU8sZ0JBQWdCLGNBQVk7QUFDdkMsWUFBSSxLQUFLLFdBQVc7QUFDbkIsZUFBSyxVQUFVLGdCQUFnQjtBQUMvQixtQkFBUyxXQUFXLEtBQUssVUFBVSxFQUFFO0FBQUEsUUFDdEM7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLHNCQUFzQjtBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJUSxZQUFrQjtBQUN6QixRQUFJLEtBQUssYUFBYTtBQUNyQjtBQUFBLElBQ0Q7QUFDQSxTQUFLLGNBQWMsS0FBSyxhQUFhLElBQUksSUFBSSxLQUFLLEtBQUssU0FBUyxNQUFNLEVBQUUsYUFBYSxZQUFZLFdBQVcsQ0FBQyxDQUFDO0FBRTlHLFFBQUksQ0FBQyxLQUFLLFFBQVEsY0FBYztBQUMvQixXQUFLLFlBQVksUUFBUSxVQUFVO0FBQUEsSUFDcEM7QUFFQSxRQUFJO0FBQ0osU0FBSyxhQUFhLElBQUksS0FBSyxZQUFZLFdBQVcsQ0FBQyxNQUFrQjtBQUNwRSxVQUFJLEtBQUssV0FBVztBQUNuQixlQUFPO0FBQUEsVUFDTixRQUFRLEVBQUU7QUFBQSxVQUNWLGVBQWUsS0FBSyxVQUFVO0FBQUEsVUFDOUIsR0FBSSxLQUFLLGlCQUFpQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxhQUFhLElBQUksS0FBSyxZQUFZLFNBQVMsTUFBTTtBQUNyRCxhQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFFRixTQUFLLGFBQWEsSUFBSSxLQUFLLFlBQVksWUFBWSxDQUFDLFFBQW9CO0FBQ3ZFLFVBQUksTUFBTTtBQUNULGNBQU0sYUFBYSxJQUFJLFdBQVcsS0FBSyxVQUFVLEtBQUssT0FBTyxVQUFVLGFBQWEsVUFBVTtBQUM5RixjQUFNLG1CQUFtQixZQUFZLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLE1BQU0sU0FBUztBQUNwRixjQUFNLG1CQUFtQixLQUFLLGdCQUFnQjtBQUU5QyxZQUFJLG1CQUFtQixLQUFLLFlBQVksbUJBQW1CLEtBQUssVUFBVTtBQUN6RSxlQUFLLHNCQUFzQjtBQUMzQixlQUFLLFVBQVUsZ0JBQWdCO0FBQUEsUUFDaEM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSx3QkFBOEI7QUFDckMsUUFBSSxLQUFLLGFBQWE7QUFDckIsWUFBTSxFQUFFLFVBQVUsU0FBUyxJQUFJLEtBQUssaUJBQWlCO0FBQ3JELFdBQUssWUFBWSxRQUFRLGFBQWEsV0FBVyxVQUFVLFdBQVcsVUFBVTtBQUFBLElBQ2pGO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBYyxvQkFBNkI7QUFDMUMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVUsbUJBQTZFO0FBQ3RGLFdBQU8sRUFBRSxVQUFVLEdBQUcsVUFBVSxHQUFHO0FBQUEsRUFDcEM7QUFBQSxFQUVBLHdCQUF3QjtBQUN2QixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsdUJBQXVCO0FBQ3RCLFlBQVEsS0FBSyxRQUFRLE1BQU0sV0FBVyxPQUFPLElBQUksU0FBUyxLQUFLLFFBQVEsTUFBTSxNQUFNLEtBQU0sS0FBSywwQkFBMEIsSUFBSTtBQUFBLEVBQzdIO0FBQUEsRUFFQSx5QkFBeUI7QUFDeEIsVUFBTSxhQUFhLEtBQUssT0FBTyxjQUFjO0FBQzdDLFdBQU8sV0FBVyxRQUFRLFdBQVcsUUFBUTtBQUFBLEVBQzlDO0FBQ0Q7IiwKICAibmFtZXMiOiBbIndpZHRoIl0KfQo=
