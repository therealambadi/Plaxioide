import { MouseTargetType } from "../editorBrowser.js";
import { PageCoordinates } from "../editorDom.js";
import { PartFingerprint, PartFingerprints } from "../view/viewPart.js";
import { ViewLine } from "../viewParts/viewLines/viewLine.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { Position } from "../../common/core/position.js";
import { Range as EditorRange } from "../../common/core/range.js";
import { CursorColumns } from "../../common/core/cursorColumns.js";
import * as dom from "../../../base/browser/dom.js";
import { AtomicTabMoveOperations, Direction } from "../../common/cursor/cursorAtomicMoveOperations.js";
import { PositionAffinity } from "../../common/model.js";
import { Lazy } from "../../../base/common/lazy.js";
var HitTestResultType = /* @__PURE__ */ ((HitTestResultType2) => {
  HitTestResultType2[HitTestResultType2["Unknown"] = 0] = "Unknown";
  HitTestResultType2[HitTestResultType2["Content"] = 1] = "Content";
  return HitTestResultType2;
})(HitTestResultType || {});
class UnknownHitTestResult {
  constructor(hitTarget = null) {
    this.hitTarget = hitTarget;
    this.type = 0 /* Unknown */;
  }
}
class ContentHitTestResult {
  constructor(position, spanNode, injectedText) {
    this.position = position;
    this.spanNode = spanNode;
    this.injectedText = injectedText;
    this.type = 1 /* Content */;
  }
  get hitTarget() {
    return this.spanNode;
  }
}
var HitTestResult;
((HitTestResult2) => {
  function createFromDOMInfo(ctx, spanNode, offset) {
    const position = ctx.getPositionFromDOMInfo(spanNode, offset);
    if (position) {
      return new ContentHitTestResult(position, spanNode, null);
    }
    return new UnknownHitTestResult(spanNode);
  }
  HitTestResult2.createFromDOMInfo = createFromDOMInfo;
})(HitTestResult || (HitTestResult = {}));
class PointerHandlerLastRenderData {
  constructor(lastViewCursorsRenderData, lastTextareaPosition) {
    this.lastViewCursorsRenderData = lastViewCursorsRenderData;
    this.lastTextareaPosition = lastTextareaPosition;
  }
}
class MouseTarget {
  static _deduceRage(position, range = null) {
    if (!range && position) {
      return new EditorRange(position.lineNumber, position.column, position.lineNumber, position.column);
    }
    return range ?? null;
  }
  static createUnknown(element, mouseColumn, position) {
    return { type: MouseTargetType.UNKNOWN, element, mouseColumn, position, range: this._deduceRage(position) };
  }
  static createTextarea(element, mouseColumn) {
    return { type: MouseTargetType.TEXTAREA, element, mouseColumn, position: null, range: null };
  }
  static createMargin(type, element, mouseColumn, position, range, detail) {
    return { type, element, mouseColumn, position, range, detail };
  }
  static createViewZone(type, element, mouseColumn, position, detail) {
    return { type, element, mouseColumn, position, range: this._deduceRage(position), detail };
  }
  static createContentText(element, mouseColumn, position, range, detail) {
    return { type: MouseTargetType.CONTENT_TEXT, element, mouseColumn, position, range: this._deduceRage(position, range), detail };
  }
  static createContentEmpty(element, mouseColumn, position, detail) {
    return { type: MouseTargetType.CONTENT_EMPTY, element, mouseColumn, position, range: this._deduceRage(position), detail };
  }
  static createContentWidget(element, mouseColumn, detail) {
    return { type: MouseTargetType.CONTENT_WIDGET, element, mouseColumn, position: null, range: null, detail };
  }
  static createScrollbar(element, mouseColumn, position) {
    return { type: MouseTargetType.SCROLLBAR, element, mouseColumn, position, range: this._deduceRage(position) };
  }
  static createOverlayWidget(element, mouseColumn, detail) {
    return { type: MouseTargetType.OVERLAY_WIDGET, element, mouseColumn, position: null, range: null, detail };
  }
  static createOutsideEditor(mouseColumn, position, outsidePosition, outsideDistance) {
    return { type: MouseTargetType.OUTSIDE_EDITOR, element: null, mouseColumn, position, range: this._deduceRage(position), outsidePosition, outsideDistance };
  }
  static _typeToString(type) {
    if (type === MouseTargetType.TEXTAREA) {
      return "TEXTAREA";
    }
    if (type === MouseTargetType.GUTTER_GLYPH_MARGIN) {
      return "GUTTER_GLYPH_MARGIN";
    }
    if (type === MouseTargetType.GUTTER_LINE_NUMBERS) {
      return "GUTTER_LINE_NUMBERS";
    }
    if (type === MouseTargetType.GUTTER_LINE_DECORATIONS) {
      return "GUTTER_LINE_DECORATIONS";
    }
    if (type === MouseTargetType.GUTTER_VIEW_ZONE) {
      return "GUTTER_VIEW_ZONE";
    }
    if (type === MouseTargetType.CONTENT_TEXT) {
      return "CONTENT_TEXT";
    }
    if (type === MouseTargetType.CONTENT_EMPTY) {
      return "CONTENT_EMPTY";
    }
    if (type === MouseTargetType.CONTENT_VIEW_ZONE) {
      return "CONTENT_VIEW_ZONE";
    }
    if (type === MouseTargetType.CONTENT_WIDGET) {
      return "CONTENT_WIDGET";
    }
    if (type === MouseTargetType.OVERVIEW_RULER) {
      return "OVERVIEW_RULER";
    }
    if (type === MouseTargetType.SCROLLBAR) {
      return "SCROLLBAR";
    }
    if (type === MouseTargetType.OVERLAY_WIDGET) {
      return "OVERLAY_WIDGET";
    }
    return "UNKNOWN";
  }
  static toString(target) {
    return this._typeToString(target.type) + ": " + target.position + " - " + target.range + " - " + JSON.stringify(target.detail);
  }
}
class ElementPath {
  static isTextArea(path) {
    return path.length === 2 && path[0] === PartFingerprint.OverflowGuard && path[1] === PartFingerprint.TextArea;
  }
  static isChildOfViewLines(path) {
    return path.length >= 4 && path[0] === PartFingerprint.OverflowGuard && path[3] === PartFingerprint.ViewLines;
  }
  static isStrictChildOfViewLines(path) {
    return path.length > 4 && path[0] === PartFingerprint.OverflowGuard && path[3] === PartFingerprint.ViewLines;
  }
  static isChildOfScrollableElement(path) {
    return path.length >= 2 && path[0] === PartFingerprint.OverflowGuard && path[1] === PartFingerprint.ScrollableElement;
  }
  static isChildOfMinimap(path) {
    return path.length >= 2 && path[0] === PartFingerprint.OverflowGuard && path[1] === PartFingerprint.Minimap;
  }
  static isChildOfContentWidgets(path) {
    return path.length >= 4 && path[0] === PartFingerprint.OverflowGuard && path[3] === PartFingerprint.ContentWidgets;
  }
  static isChildOfOverflowGuard(path) {
    return path.length >= 1 && path[0] === PartFingerprint.OverflowGuard;
  }
  static isChildOfOverflowingContentWidgets(path) {
    return path.length >= 1 && path[0] === PartFingerprint.OverflowingContentWidgets;
  }
  static isChildOfOverlayWidgets(path) {
    return path.length >= 2 && path[0] === PartFingerprint.OverflowGuard && path[1] === PartFingerprint.OverlayWidgets;
  }
  static isChildOfOverflowingOverlayWidgets(path) {
    return path.length >= 1 && path[0] === PartFingerprint.OverflowingOverlayWidgets;
  }
}
class HitTestContext {
  constructor(context, viewHelper, lastRenderData) {
    this.viewModel = context.viewModel;
    const options = context.configuration.options;
    this.layoutInfo = options.get(EditorOption.layoutInfo);
    this.viewDomNode = viewHelper.viewDomNode;
    this.viewLinesGpu = viewHelper.viewLinesGpu;
    this.lineHeight = options.get(EditorOption.lineHeight);
    this.stickyTabStops = options.get(EditorOption.stickyTabStops);
    this.typicalHalfwidthCharacterWidth = options.get(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
    this.lastRenderData = lastRenderData;
    this._context = context;
    this._viewHelper = viewHelper;
  }
  getZoneAtCoord(mouseVerticalOffset) {
    return HitTestContext.getZoneAtCoord(this._context, mouseVerticalOffset);
  }
  static getZoneAtCoord(context, mouseVerticalOffset) {
    const viewZoneWhitespace = context.viewLayout.getWhitespaceAtVerticalOffset(mouseVerticalOffset);
    if (viewZoneWhitespace) {
      const viewZoneMiddle = viewZoneWhitespace.verticalOffset + viewZoneWhitespace.height / 2;
      const lineCount = context.viewModel.getLineCount();
      let positionBefore = null;
      let position;
      let positionAfter = null;
      if (viewZoneWhitespace.afterLineNumber !== lineCount) {
        positionAfter = new Position(viewZoneWhitespace.afterLineNumber + 1, 1);
      }
      if (viewZoneWhitespace.afterLineNumber > 0) {
        positionBefore = new Position(viewZoneWhitespace.afterLineNumber, context.viewModel.getLineMaxColumn(viewZoneWhitespace.afterLineNumber));
      }
      if (positionAfter === null) {
        position = positionBefore;
      } else if (positionBefore === null) {
        position = positionAfter;
      } else if (mouseVerticalOffset < viewZoneMiddle) {
        position = positionBefore;
      } else {
        position = positionAfter;
      }
      return {
        viewZoneId: viewZoneWhitespace.id,
        afterLineNumber: viewZoneWhitespace.afterLineNumber,
        positionBefore,
        positionAfter,
        position
      };
    }
    return null;
  }
  getFullLineRangeAtCoord(mouseVerticalOffset) {
    if (this._context.viewLayout.isAfterLines(mouseVerticalOffset)) {
      const lineNumber2 = this._context.viewModel.getLineCount();
      const maxLineColumn2 = this._context.viewModel.getLineMaxColumn(lineNumber2);
      return {
        range: new EditorRange(lineNumber2, maxLineColumn2, lineNumber2, maxLineColumn2),
        isAfterLines: true
      };
    }
    const lineNumber = this._context.viewLayout.getLineNumberAtVerticalOffset(mouseVerticalOffset);
    const maxLineColumn = this._context.viewModel.getLineMaxColumn(lineNumber);
    return {
      range: new EditorRange(lineNumber, 1, lineNumber, maxLineColumn),
      isAfterLines: false
    };
  }
  getLineNumberAtVerticalOffset(mouseVerticalOffset) {
    return this._context.viewLayout.getLineNumberAtVerticalOffset(mouseVerticalOffset);
  }
  isAfterLines(mouseVerticalOffset) {
    return this._context.viewLayout.isAfterLines(mouseVerticalOffset);
  }
  isInTopPadding(mouseVerticalOffset) {
    return this._context.viewLayout.isInTopPadding(mouseVerticalOffset);
  }
  isInBottomPadding(mouseVerticalOffset) {
    return this._context.viewLayout.isInBottomPadding(mouseVerticalOffset);
  }
  getVerticalOffsetForLineNumber(lineNumber) {
    return this._context.viewLayout.getVerticalOffsetForLineNumber(lineNumber);
  }
  findAttribute(element, attr) {
    return HitTestContext._findAttribute(element, attr, this._viewHelper.viewDomNode);
  }
  static _findAttribute(element, attr, stopAt) {
    while (element && element !== element.ownerDocument.body) {
      if (element.hasAttribute && element.hasAttribute(attr)) {
        return element.getAttribute(attr);
      }
      if (element === stopAt) {
        return null;
      }
      element = element.parentNode;
    }
    return null;
  }
  getLineWidth(lineNumber) {
    return this._viewHelper.getLineWidth(lineNumber);
  }
  visibleRangeForPosition(lineNumber, column) {
    return this._viewHelper.visibleRangeForPosition(lineNumber, column);
  }
  getPositionFromDOMInfo(spanNode, offset) {
    return this._viewHelper.getPositionFromDOMInfo(spanNode, offset);
  }
  getCurrentScrollTop() {
    return this._context.viewLayout.getCurrentScrollTop();
  }
  getCurrentScrollLeft() {
    return this._context.viewLayout.getCurrentScrollLeft();
  }
}
class BareHitTestRequest {
  constructor(ctx, editorPos, pos, relativePos) {
    this.editorPos = editorPos;
    this.pos = pos;
    this.relativePos = relativePos;
    this.mouseVerticalOffset = Math.max(0, ctx.getCurrentScrollTop() + this.relativePos.y);
    this.mouseContentHorizontalOffset = ctx.getCurrentScrollLeft() + this.relativePos.x - ctx.layoutInfo.contentLeft;
    this.isInMarginArea = this.relativePos.x < ctx.layoutInfo.contentLeft && this.relativePos.x >= ctx.layoutInfo.glyphMarginLeft;
    this.isInContentArea = !this.isInMarginArea;
    this.mouseColumn = Math.max(0, MouseTargetFactory._getMouseColumn(this.mouseContentHorizontalOffset, ctx.typicalHalfwidthCharacterWidth));
  }
}
class HitTestRequest extends BareHitTestRequest {
  constructor(ctx, editorPos, pos, relativePos, eventTarget) {
    super(ctx, editorPos, pos, relativePos);
    this.hitTestResult = new Lazy(() => MouseTargetFactory.doHitTest(this._ctx, this));
    this._targetPathCacheElement = null;
    this._targetPathCacheValue = new Uint8Array(0);
    this._ctx = ctx;
    this._eventTarget = eventTarget;
    const hasEventTarget = Boolean(this._eventTarget);
    this._useHitTestTarget = !hasEventTarget;
  }
  get target() {
    if (this._useHitTestTarget) {
      return this.hitTestResult.value.hitTarget;
    }
    return this._eventTarget;
  }
  get targetPath() {
    if (this._targetPathCacheElement !== this.target) {
      this._targetPathCacheElement = this.target;
      this._targetPathCacheValue = PartFingerprints.collect(this.target, this._ctx.viewDomNode);
    }
    return this._targetPathCacheValue;
  }
  toString() {
    return `pos(${this.pos.x},${this.pos.y}), editorPos(${this.editorPos.x},${this.editorPos.y}), relativePos(${this.relativePos.x},${this.relativePos.y}), mouseVerticalOffset: ${this.mouseVerticalOffset}, mouseContentHorizontalOffset: ${this.mouseContentHorizontalOffset}
	target: ${this.target ? this.target.outerHTML : null}`;
  }
  get wouldBenefitFromHitTestTargetSwitch() {
    return !this._useHitTestTarget && this.hitTestResult.value.hitTarget !== null && this.target !== this.hitTestResult.value.hitTarget;
  }
  switchToHitTestTarget() {
    this._useHitTestTarget = true;
  }
  _getMouseColumn(position = null) {
    if (position && position.column < this._ctx.viewModel.getLineMaxColumn(position.lineNumber)) {
      return CursorColumns.visibleColumnFromColumn(this._ctx.viewModel.getLineContent(position.lineNumber), position.column, this._ctx.viewModel.model.getOptions().tabSize) + 1;
    }
    return this.mouseColumn;
  }
  fulfillUnknown(position = null) {
    return MouseTarget.createUnknown(this.target, this._getMouseColumn(position), position);
  }
  fulfillTextarea() {
    return MouseTarget.createTextarea(this.target, this._getMouseColumn());
  }
  fulfillMargin(type, position, range, detail) {
    return MouseTarget.createMargin(type, this.target, this._getMouseColumn(position), position, range, detail);
  }
  fulfillViewZone(type, position, detail) {
    return MouseTarget.createViewZone(type, this.target, this._getMouseColumn(position), position, detail);
  }
  fulfillContentText(position, range, detail) {
    return MouseTarget.createContentText(this.target, this._getMouseColumn(position), position, range, detail);
  }
  fulfillContentEmpty(position, detail) {
    return MouseTarget.createContentEmpty(this.target, this._getMouseColumn(position), position, detail);
  }
  fulfillContentWidget(detail) {
    return MouseTarget.createContentWidget(this.target, this._getMouseColumn(), detail);
  }
  fulfillScrollbar(position) {
    return MouseTarget.createScrollbar(this.target, this._getMouseColumn(position), position);
  }
  fulfillOverlayWidget(detail) {
    return MouseTarget.createOverlayWidget(this.target, this._getMouseColumn(), detail);
  }
}
const EMPTY_CONTENT_AFTER_LINES = { isAfterLines: true };
function createEmptyContentDataInLines(horizontalDistanceToText) {
  return {
    isAfterLines: false,
    horizontalDistanceToText
  };
}
class MouseTargetFactory {
  constructor(context, viewHelper) {
    this._context = context;
    this._viewHelper = viewHelper;
  }
  mouseTargetIsWidget(e) {
    const t = e.target;
    const path = PartFingerprints.collect(t, this._viewHelper.viewDomNode);
    if (ElementPath.isChildOfContentWidgets(path) || ElementPath.isChildOfOverflowingContentWidgets(path)) {
      return true;
    }
    if (ElementPath.isChildOfOverlayWidgets(path) || ElementPath.isChildOfOverflowingOverlayWidgets(path)) {
      return true;
    }
    return false;
  }
  createMouseTarget(lastRenderData, editorPos, pos, relativePos, target) {
    const ctx = new HitTestContext(this._context, this._viewHelper, lastRenderData);
    const request = new HitTestRequest(ctx, editorPos, pos, relativePos, target);
    try {
      const r = MouseTargetFactory._createMouseTarget(ctx, request);
      if (r.type === MouseTargetType.CONTENT_TEXT) {
        if (ctx.stickyTabStops && r.position !== null) {
          const position = MouseTargetFactory._snapToSoftTabBoundary(r.position, ctx.viewModel);
          const range = EditorRange.fromPositions(position, position).plusRange(r.range);
          return request.fulfillContentText(position, range, r.detail);
        }
      }
      return r;
    } catch (err) {
      return request.fulfillUnknown();
    }
  }
  static _createMouseTarget(ctx, request) {
    if (request.target === null) {
      return request.fulfillUnknown();
    }
    const resolvedRequest = request;
    let result = null;
    if (!ElementPath.isChildOfOverflowGuard(request.targetPath) && !ElementPath.isChildOfOverflowingContentWidgets(request.targetPath) && !ElementPath.isChildOfOverflowingOverlayWidgets(request.targetPath)) {
      result = result || request.fulfillUnknown();
    }
    result = result || MouseTargetFactory._hitTestContentWidget(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestOverlayWidget(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestMinimap(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestScrollbarSlider(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestViewZone(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestMargin(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestViewCursor(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestTextArea(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestViewLines(ctx, resolvedRequest);
    result = result || MouseTargetFactory._hitTestScrollbar(ctx, resolvedRequest);
    return result || request.fulfillUnknown();
  }
  static _hitTestContentWidget(ctx, request) {
    if (ElementPath.isChildOfContentWidgets(request.targetPath) || ElementPath.isChildOfOverflowingContentWidgets(request.targetPath)) {
      const widgetId = ctx.findAttribute(request.target, "widgetId");
      if (widgetId) {
        return request.fulfillContentWidget(widgetId);
      } else {
        return request.fulfillUnknown();
      }
    }
    return null;
  }
  static _hitTestOverlayWidget(ctx, request) {
    if (ElementPath.isChildOfOverlayWidgets(request.targetPath) || ElementPath.isChildOfOverflowingOverlayWidgets(request.targetPath)) {
      const widgetId = ctx.findAttribute(request.target, "widgetId");
      if (widgetId) {
        return request.fulfillOverlayWidget(widgetId);
      } else {
        return request.fulfillUnknown();
      }
    }
    return null;
  }
  static _hitTestViewCursor(ctx, request) {
    if (request.target) {
      const lastViewCursorsRenderData = ctx.lastRenderData.lastViewCursorsRenderData;
      for (const d of lastViewCursorsRenderData) {
        if (request.target === d.domNode) {
          return request.fulfillContentText(d.position, null, { mightBeForeignElement: false, injectedText: null });
        }
      }
    }
    if (request.isInContentArea) {
      const lastViewCursorsRenderData = ctx.lastRenderData.lastViewCursorsRenderData;
      const mouseContentHorizontalOffset = request.mouseContentHorizontalOffset;
      const mouseVerticalOffset = request.mouseVerticalOffset;
      for (const d of lastViewCursorsRenderData) {
        if (mouseContentHorizontalOffset < d.contentLeft) {
          continue;
        }
        if (mouseContentHorizontalOffset > d.contentLeft + d.width) {
          continue;
        }
        const cursorVerticalOffset = ctx.getVerticalOffsetForLineNumber(d.position.lineNumber);
        if (cursorVerticalOffset <= mouseVerticalOffset && mouseVerticalOffset <= cursorVerticalOffset + d.height) {
          return request.fulfillContentText(d.position, null, { mightBeForeignElement: false, injectedText: null });
        }
      }
    }
    return null;
  }
  static _hitTestViewZone(ctx, request) {
    const viewZoneData = ctx.getZoneAtCoord(request.mouseVerticalOffset);
    if (viewZoneData) {
      const mouseTargetType = request.isInContentArea ? MouseTargetType.CONTENT_VIEW_ZONE : MouseTargetType.GUTTER_VIEW_ZONE;
      return request.fulfillViewZone(mouseTargetType, viewZoneData.position, viewZoneData);
    }
    return null;
  }
  static _hitTestTextArea(ctx, request) {
    if (ElementPath.isTextArea(request.targetPath)) {
      if (ctx.lastRenderData.lastTextareaPosition) {
        return request.fulfillContentText(ctx.lastRenderData.lastTextareaPosition, null, { mightBeForeignElement: false, injectedText: null });
      }
      return request.fulfillTextarea();
    }
    return null;
  }
  static _hitTestMargin(ctx, request) {
    if (request.isInMarginArea) {
      const res = ctx.getFullLineRangeAtCoord(request.mouseVerticalOffset);
      const pos = res.range.getStartPosition();
      let offset = Math.abs(request.relativePos.x);
      const detail = {
        isAfterLines: res.isAfterLines,
        glyphMarginLeft: ctx.layoutInfo.glyphMarginLeft,
        glyphMarginWidth: ctx.layoutInfo.glyphMarginWidth,
        lineNumbersWidth: ctx.layoutInfo.lineNumbersWidth,
        offsetX: offset
      };
      offset -= ctx.layoutInfo.glyphMarginLeft;
      if (offset <= ctx.layoutInfo.glyphMarginWidth) {
        const modelCoordinate = ctx.viewModel.coordinatesConverter.convertViewPositionToModelPosition(res.range.getStartPosition());
        const lanes = ctx.viewModel.glyphLanes.getLanesAtLine(modelCoordinate.lineNumber);
        detail.glyphMarginLane = lanes[Math.floor(offset / ctx.lineHeight)];
        return request.fulfillMargin(MouseTargetType.GUTTER_GLYPH_MARGIN, pos, res.range, detail);
      }
      offset -= ctx.layoutInfo.glyphMarginWidth;
      if (offset <= ctx.layoutInfo.lineNumbersWidth) {
        return request.fulfillMargin(MouseTargetType.GUTTER_LINE_NUMBERS, pos, res.range, detail);
      }
      offset -= ctx.layoutInfo.lineNumbersWidth;
      return request.fulfillMargin(MouseTargetType.GUTTER_LINE_DECORATIONS, pos, res.range, detail);
    }
    return null;
  }
  static _hitTestViewLines(ctx, request) {
    if (!ElementPath.isChildOfViewLines(request.targetPath)) {
      return null;
    }
    if (ctx.isInTopPadding(request.mouseVerticalOffset)) {
      return request.fulfillContentEmpty(new Position(1, 1), EMPTY_CONTENT_AFTER_LINES);
    }
    if (ctx.isAfterLines(request.mouseVerticalOffset) || ctx.isInBottomPadding(request.mouseVerticalOffset)) {
      const lineCount = ctx.viewModel.getLineCount();
      const maxLineColumn = ctx.viewModel.getLineMaxColumn(lineCount);
      return request.fulfillContentEmpty(new Position(lineCount, maxLineColumn), EMPTY_CONTENT_AFTER_LINES);
    }
    if (ElementPath.isStrictChildOfViewLines(request.targetPath)) {
      const lineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
      if (ctx.viewModel.getLineLength(lineNumber) === 0) {
        const lineWidth2 = ctx.getLineWidth(lineNumber);
        const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth2);
        return request.fulfillContentEmpty(new Position(lineNumber, 1), detail);
      }
      const lineWidth = ctx.getLineWidth(lineNumber);
      if (request.mouseContentHorizontalOffset >= lineWidth) {
        const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
        const pos = new Position(lineNumber, ctx.viewModel.getLineMaxColumn(lineNumber));
        return request.fulfillContentEmpty(pos, detail);
      }
    } else {
      if (ctx.viewLinesGpu) {
        const lineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
        if (ctx.viewModel.getLineLength(lineNumber) === 0) {
          const lineWidth2 = ctx.getLineWidth(lineNumber);
          const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth2);
          return request.fulfillContentEmpty(new Position(lineNumber, 1), detail);
        }
        const lineWidth = ctx.getLineWidth(lineNumber);
        if (request.mouseContentHorizontalOffset >= lineWidth) {
          const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
          const pos = new Position(lineNumber, ctx.viewModel.getLineMaxColumn(lineNumber));
          return request.fulfillContentEmpty(pos, detail);
        }
        const position = ctx.viewLinesGpu.getPositionAtCoordinate(lineNumber, request.mouseContentHorizontalOffset);
        if (position) {
          const detail = {
            injectedText: null,
            mightBeForeignElement: false
          };
          return request.fulfillContentText(position, EditorRange.fromPositions(position, position), detail);
        }
      }
    }
    const hitTestResult = request.hitTestResult.value;
    if (hitTestResult.type === 1 /* Content */) {
      return MouseTargetFactory.createMouseTargetFromHitTestPosition(ctx, request, hitTestResult.spanNode, hitTestResult.position, hitTestResult.injectedText);
    }
    if (request.wouldBenefitFromHitTestTargetSwitch) {
      request.switchToHitTestTarget();
      return this._createMouseTarget(ctx, request);
    }
    return request.fulfillUnknown();
  }
  static _hitTestMinimap(ctx, request) {
    if (ElementPath.isChildOfMinimap(request.targetPath)) {
      const possibleLineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
      const maxColumn = ctx.viewModel.getLineMaxColumn(possibleLineNumber);
      return request.fulfillScrollbar(new Position(possibleLineNumber, maxColumn));
    }
    return null;
  }
  static _hitTestScrollbarSlider(ctx, request) {
    if (ElementPath.isChildOfScrollableElement(request.targetPath)) {
      if (request.target && request.target.nodeType === 1) {
        const className = request.target.className;
        if (className && /\b(slider|scrollbar)\b/.test(className)) {
          const possibleLineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
          const maxColumn = ctx.viewModel.getLineMaxColumn(possibleLineNumber);
          return request.fulfillScrollbar(new Position(possibleLineNumber, maxColumn));
        }
      }
    }
    return null;
  }
  static _hitTestScrollbar(ctx, request) {
    if (ElementPath.isChildOfScrollableElement(request.targetPath)) {
      const possibleLineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
      const maxColumn = ctx.viewModel.getLineMaxColumn(possibleLineNumber);
      return request.fulfillScrollbar(new Position(possibleLineNumber, maxColumn));
    }
    return null;
  }
  getMouseColumn(relativePos) {
    const options = this._context.configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const mouseContentHorizontalOffset = this._context.viewLayout.getCurrentScrollLeft() + relativePos.x - layoutInfo.contentLeft;
    return MouseTargetFactory._getMouseColumn(mouseContentHorizontalOffset, options.get(EditorOption.fontInfo).typicalHalfwidthCharacterWidth);
  }
  static _getMouseColumn(mouseContentHorizontalOffset, typicalHalfwidthCharacterWidth) {
    if (mouseContentHorizontalOffset < 0) {
      return 1;
    }
    const chars = Math.round(mouseContentHorizontalOffset / typicalHalfwidthCharacterWidth);
    return chars + 1;
  }
  static createMouseTargetFromHitTestPosition(ctx, request, spanNode, pos, injectedText) {
    const lineNumber = pos.lineNumber;
    const column = pos.column;
    const lineWidth = ctx.getLineWidth(lineNumber);
    if (request.mouseContentHorizontalOffset > lineWidth) {
      const detail = createEmptyContentDataInLines(request.mouseContentHorizontalOffset - lineWidth);
      return request.fulfillContentEmpty(pos, detail);
    }
    const visibleRange = ctx.visibleRangeForPosition(lineNumber, column);
    if (!visibleRange) {
      return request.fulfillUnknown(pos);
    }
    const columnHorizontalOffset = visibleRange.left;
    if (Math.abs(request.mouseContentHorizontalOffset - columnHorizontalOffset) < 1) {
      return request.fulfillContentText(pos, null, { mightBeForeignElement: !!injectedText, injectedText });
    }
    const points = [];
    points.push({ offset: visibleRange.left, column });
    if (column > 1) {
      const visibleRange2 = ctx.visibleRangeForPosition(lineNumber, column - 1);
      if (visibleRange2) {
        points.push({ offset: visibleRange2.left, column: column - 1 });
      }
    }
    const lineMaxColumn = ctx.viewModel.getLineMaxColumn(lineNumber);
    if (column < lineMaxColumn) {
      const visibleRange2 = ctx.visibleRangeForPosition(lineNumber, column + 1);
      if (visibleRange2) {
        points.push({ offset: visibleRange2.left, column: column + 1 });
      }
    }
    points.sort((a, b) => a.offset - b.offset);
    const mouseCoordinates = request.pos.toClientCoordinates(dom.getWindow(ctx.viewDomNode));
    const spanNodeClientRect = spanNode.getBoundingClientRect();
    const mouseIsOverSpanNode = spanNodeClientRect.left <= mouseCoordinates.clientX && mouseCoordinates.clientX <= spanNodeClientRect.right;
    let rng = null;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev.offset <= request.mouseContentHorizontalOffset && request.mouseContentHorizontalOffset <= curr.offset) {
        rng = new EditorRange(lineNumber, prev.column, lineNumber, curr.column);
        const prevDelta = Math.abs(prev.offset - request.mouseContentHorizontalOffset);
        const nextDelta = Math.abs(curr.offset - request.mouseContentHorizontalOffset);
        pos = prevDelta < nextDelta ? new Position(lineNumber, prev.column) : new Position(lineNumber, curr.column);
        break;
      }
    }
    return request.fulfillContentText(pos, rng, { mightBeForeignElement: !mouseIsOverSpanNode || !!injectedText, injectedText });
  }
  /**
   * Most probably WebKit browsers and Edge
   */
  static _doHitTestWithCaretRangeFromPoint(ctx, request) {
    const lineNumber = ctx.getLineNumberAtVerticalOffset(request.mouseVerticalOffset);
    const lineStartVerticalOffset = ctx.getVerticalOffsetForLineNumber(lineNumber);
    const lineEndVerticalOffset = lineStartVerticalOffset + ctx.lineHeight;
    const isBelowLastLine = lineNumber === ctx.viewModel.getLineCount() && request.mouseVerticalOffset > lineEndVerticalOffset;
    if (!isBelowLastLine) {
      const lineCenteredVerticalOffset = Math.floor((lineStartVerticalOffset + lineEndVerticalOffset) / 2);
      let adjustedPageY = request.pos.y + (lineCenteredVerticalOffset - request.mouseVerticalOffset);
      if (adjustedPageY <= request.editorPos.y) {
        adjustedPageY = request.editorPos.y + 1;
      }
      if (adjustedPageY >= request.editorPos.y + request.editorPos.height) {
        adjustedPageY = request.editorPos.y + request.editorPos.height - 1;
      }
      const adjustedPage = new PageCoordinates(request.pos.x, adjustedPageY);
      const r = this._actualDoHitTestWithCaretRangeFromPoint(ctx, adjustedPage.toClientCoordinates(dom.getWindow(ctx.viewDomNode)));
      if (r.type === 1 /* Content */) {
        return r;
      }
    }
    return this._actualDoHitTestWithCaretRangeFromPoint(ctx, request.pos.toClientCoordinates(dom.getWindow(ctx.viewDomNode)));
  }
  static _actualDoHitTestWithCaretRangeFromPoint(ctx, coords) {
    const shadowRoot = dom.getShadowRoot(ctx.viewDomNode);
    let range;
    if (shadowRoot) {
      if (typeof shadowRoot.caretRangeFromPoint === "undefined") {
        range = shadowCaretRangeFromPoint(shadowRoot, coords.clientX, coords.clientY);
      } else {
        range = shadowRoot.caretRangeFromPoint(coords.clientX, coords.clientY);
      }
    } else {
      range = ctx.viewDomNode.ownerDocument.caretRangeFromPoint(coords.clientX, coords.clientY);
    }
    if (!range || !range.startContainer) {
      return new UnknownHitTestResult();
    }
    const startContainer = range.startContainer;
    if (startContainer.nodeType === startContainer.TEXT_NODE) {
      const parent1 = startContainer.parentNode;
      const parent2 = parent1 ? parent1.parentNode : null;
      const parent3 = parent2 ? parent2.parentNode : null;
      const parent3ClassName = parent3 && parent3.nodeType === parent3.ELEMENT_NODE ? parent3.className : null;
      if (parent3ClassName === ViewLine.CLASS_NAME) {
        return HitTestResult.createFromDOMInfo(ctx, parent1, range.startOffset);
      } else {
        return new UnknownHitTestResult(startContainer.parentNode);
      }
    } else if (startContainer.nodeType === startContainer.ELEMENT_NODE) {
      const parent1 = startContainer.parentNode;
      const parent2 = parent1 ? parent1.parentNode : null;
      const parent2ClassName = parent2 && parent2.nodeType === parent2.ELEMENT_NODE ? parent2.className : null;
      if (parent2ClassName === ViewLine.CLASS_NAME) {
        return HitTestResult.createFromDOMInfo(ctx, startContainer, startContainer.textContent.length);
      } else {
        return new UnknownHitTestResult(startContainer);
      }
    }
    return new UnknownHitTestResult();
  }
  /**
   * Most probably Gecko
   */
  static _doHitTestWithCaretPositionFromPoint(ctx, coords) {
    const hitResult = ctx.viewDomNode.ownerDocument.caretPositionFromPoint(coords.clientX, coords.clientY);
    if (hitResult.offsetNode.nodeType === hitResult.offsetNode.TEXT_NODE) {
      const parent1 = hitResult.offsetNode.parentNode;
      const parent2 = parent1 ? parent1.parentNode : null;
      const parent3 = parent2 ? parent2.parentNode : null;
      const parent3ClassName = parent3 && parent3.nodeType === parent3.ELEMENT_NODE ? parent3.className : null;
      if (parent3ClassName === ViewLine.CLASS_NAME) {
        return HitTestResult.createFromDOMInfo(ctx, hitResult.offsetNode.parentNode, hitResult.offset);
      } else {
        return new UnknownHitTestResult(hitResult.offsetNode.parentNode);
      }
    }
    if (hitResult.offsetNode.nodeType === hitResult.offsetNode.ELEMENT_NODE) {
      const parent1 = hitResult.offsetNode.parentNode;
      const parent1ClassName = parent1 && parent1.nodeType === parent1.ELEMENT_NODE ? parent1.className : null;
      const parent2 = parent1 ? parent1.parentNode : null;
      const parent2ClassName = parent2 && parent2.nodeType === parent2.ELEMENT_NODE ? parent2.className : null;
      if (parent1ClassName === ViewLine.CLASS_NAME) {
        const tokenSpan = hitResult.offsetNode.childNodes[Math.min(hitResult.offset, hitResult.offsetNode.childNodes.length - 1)];
        if (tokenSpan) {
          return HitTestResult.createFromDOMInfo(ctx, tokenSpan, 0);
        }
      } else if (parent2ClassName === ViewLine.CLASS_NAME) {
        return HitTestResult.createFromDOMInfo(ctx, hitResult.offsetNode, 0);
      }
    }
    return new UnknownHitTestResult(hitResult.offsetNode);
  }
  static _snapToSoftTabBoundary(position, viewModel) {
    const lineContent = viewModel.getLineContent(position.lineNumber);
    const { tabSize } = viewModel.model.getOptions();
    const newPosition = AtomicTabMoveOperations.atomicPosition(lineContent, position.column - 1, tabSize, Direction.Nearest);
    if (newPosition !== -1) {
      return new Position(position.lineNumber, newPosition + 1);
    }
    return position;
  }
  static doHitTest(ctx, request) {
    let result = new UnknownHitTestResult();
    if (typeof ctx.viewDomNode.ownerDocument.caretRangeFromPoint === "function") {
      result = this._doHitTestWithCaretRangeFromPoint(ctx, request);
    } else if (ctx.viewDomNode.ownerDocument.caretPositionFromPoint) {
      result = this._doHitTestWithCaretPositionFromPoint(ctx, request.pos.toClientCoordinates(dom.getWindow(ctx.viewDomNode)));
    }
    if (result.type === 1 /* Content */) {
      const injectedText = ctx.viewModel.getInjectedTextAt(result.position);
      const normalizedPosition = ctx.viewModel.normalizePosition(result.position, PositionAffinity.None);
      if (injectedText || !normalizedPosition.equals(result.position)) {
        result = new ContentHitTestResult(normalizedPosition, result.spanNode, injectedText);
      }
    }
    return result;
  }
}
function shadowCaretRangeFromPoint(shadowRoot, x, y) {
  const range = document.createRange();
  let el = shadowRoot.elementFromPoint(x, y);
  if (el !== null) {
    while (el && el.firstChild && el.firstChild.nodeType !== el.firstChild.TEXT_NODE && el.lastChild && el.lastChild.firstChild) {
      el = el.lastChild;
    }
    const rect = el.getBoundingClientRect();
    const elWindow = dom.getWindow(el);
    const fontStyle = elWindow.getComputedStyle(el, null).getPropertyValue("font-style");
    const fontVariant = elWindow.getComputedStyle(el, null).getPropertyValue("font-variant");
    const fontWeight = elWindow.getComputedStyle(el, null).getPropertyValue("font-weight");
    const fontSize = elWindow.getComputedStyle(el, null).getPropertyValue("font-size");
    const lineHeight = elWindow.getComputedStyle(el, null).getPropertyValue("line-height");
    const fontFamily = elWindow.getComputedStyle(el, null).getPropertyValue("font-family");
    const font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`;
    const text = el.innerText;
    let pixelCursor = rect.left;
    let offset = 0;
    let step;
    if (x > rect.left + rect.width) {
      offset = text.length;
    } else {
      const charWidthReader = CharWidthReader.getInstance();
      for (let i = 0; i < text.length + 1; i++) {
        step = charWidthReader.getCharWidth(text.charAt(i), font) / 2;
        pixelCursor += step;
        if (x < pixelCursor) {
          offset = i;
          break;
        }
        pixelCursor += step;
      }
    }
    range.setStart(el.firstChild, offset);
    range.setEnd(el.firstChild, offset);
  }
  return range;
}
const _CharWidthReader = class _CharWidthReader {
  static getInstance() {
    if (!_CharWidthReader._INSTANCE) {
      _CharWidthReader._INSTANCE = new _CharWidthReader();
    }
    return _CharWidthReader._INSTANCE;
  }
  constructor() {
    this._cache = {};
    this._canvas = document.createElement("canvas");
  }
  getCharWidth(char, font) {
    const cacheKey = char + font;
    if (this._cache[cacheKey]) {
      return this._cache[cacheKey];
    }
    const context = this._canvas.getContext("2d");
    context.font = font;
    const metrics = context.measureText(char);
    const width = metrics.width;
    this._cache[cacheKey] = width;
    return width;
  }
};
_CharWidthReader._INSTANCE = null;
let CharWidthReader = _CharWidthReader;
export {
  HitTestContext,
  MouseTarget,
  MouseTargetFactory,
  PointerHandlerLastRenderData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL21vdXNlVGFyZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVBvaW50ZXJIYW5kbGVySGVscGVyIH0gZnJvbSAnLi9tb3VzZUhhbmRsZXIuanMnO1xuaW1wb3J0IHsgSU1vdXNlVGFyZ2V0Q29udGVudEVtcHR5RGF0YSwgSU1vdXNlVGFyZ2V0TWFyZ2luRGF0YSwgSU1vdXNlVGFyZ2V0LCBJTW91c2VUYXJnZXRDb250ZW50RW1wdHksIElNb3VzZVRhcmdldENvbnRlbnRUZXh0LCBJTW91c2VUYXJnZXRDb250ZW50V2lkZ2V0LCBJTW91c2VUYXJnZXRNYXJnaW4sIElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3IsIElNb3VzZVRhcmdldE92ZXJsYXlXaWRnZXQsIElNb3VzZVRhcmdldFNjcm9sbGJhciwgSU1vdXNlVGFyZ2V0VGV4dGFyZWEsIElNb3VzZVRhcmdldFVua25vd24sIElNb3VzZVRhcmdldFZpZXdab25lLCBJTW91c2VUYXJnZXRDb250ZW50VGV4dERhdGEsIElNb3VzZVRhcmdldFZpZXdab25lRGF0YSwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDbGllbnRDb29yZGluYXRlcywgRWRpdG9yTW91c2VFdmVudCwgRWRpdG9yUGFnZVBvc2l0aW9uLCBQYWdlQ29vcmRpbmF0ZXMsIENvb3JkaW5hdGVzUmVsYXRpdmVUb0VkaXRvciB9IGZyb20gJy4uL2VkaXRvckRvbS5qcyc7XG5pbXBvcnQgeyBQYXJ0RmluZ2VycHJpbnQsIFBhcnRGaW5nZXJwcmludHMgfSBmcm9tICcuLi92aWV3L3ZpZXdQYXJ0LmpzJztcbmltcG9ydCB7IFZpZXdMaW5lIH0gZnJvbSAnLi4vdmlld1BhcnRzL3ZpZXdMaW5lcy92aWV3TGluZS5qcyc7XG5pbXBvcnQgeyBJVmlld0N1cnNvclJlbmRlckRhdGEgfSBmcm9tICcuLi92aWV3UGFydHMvdmlld0N1cnNvcnMvdmlld0N1cnNvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JMYXlvdXRJbmZvLCBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSBhcyBFZGl0b3JSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IEhvcml6b250YWxQb3NpdGlvbiB9IGZyb20gJy4uL3ZpZXcvcmVuZGVyaW5nQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHsgSVZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sdW1ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL2N1cnNvckNvbHVtbnMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQXRvbWljVGFiTW92ZU9wZXJhdGlvbnMsIERpcmVjdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jdXJzb3IvY3Vyc29yQXRvbWljTW92ZU9wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb25BZmZpbml0eSB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJbmplY3RlZFRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWxMaW5lUHJvamVjdGlvbkRhdGEuanMnO1xuaW1wb3J0IHsgTXV0YWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xpbmVzR3B1IH0gZnJvbSAnLi4vdmlld1BhcnRzL3ZpZXdMaW5lc0dwdS92aWV3TGluZXNHcHUuanMnO1xuXG5jb25zdCBlbnVtIEhpdFRlc3RSZXN1bHRUeXBlIHtcblx0VW5rbm93bixcblx0Q29udGVudCxcbn1cblxuY2xhc3MgVW5rbm93bkhpdFRlc3RSZXN1bHQge1xuXHRyZWFkb25seSB0eXBlID0gSGl0VGVzdFJlc3VsdFR5cGUuVW5rbm93bjtcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaGl0VGFyZ2V0OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsXG5cdCkgeyB9XG59XG5cbmNsYXNzIENvbnRlbnRIaXRUZXN0UmVzdWx0IHtcblx0cmVhZG9ubHkgdHlwZSA9IEhpdFRlc3RSZXN1bHRUeXBlLkNvbnRlbnQ7XG5cblx0Z2V0IGhpdFRhcmdldCgpOiBIVE1MRWxlbWVudCB7IHJldHVybiB0aGlzLnNwYW5Ob2RlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgcG9zaXRpb246IFBvc2l0aW9uLFxuXHRcdHJlYWRvbmx5IHNwYW5Ob2RlOiBIVE1MRWxlbWVudCxcblx0XHRyZWFkb25seSBpbmplY3RlZFRleHQ6IEluamVjdGVkVGV4dCB8IG51bGwsXG5cdCkgeyB9XG59XG5cbnR5cGUgSGl0VGVzdFJlc3VsdCA9IFVua25vd25IaXRUZXN0UmVzdWx0IHwgQ29udGVudEhpdFRlc3RSZXN1bHQ7XG5cbm5hbWVzcGFjZSBIaXRUZXN0UmVzdWx0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZyb21ET01JbmZvKGN0eDogSGl0VGVzdENvbnRleHQsIHNwYW5Ob2RlOiBIVE1MRWxlbWVudCwgb2Zmc2V0OiBudW1iZXIpOiBIaXRUZXN0UmVzdWx0IHtcblx0XHRjb25zdCBwb3NpdGlvbiA9IGN0eC5nZXRQb3NpdGlvbkZyb21ET01JbmZvKHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHRcdGlmIChwb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuIG5ldyBDb250ZW50SGl0VGVzdFJlc3VsdChwb3NpdGlvbiwgc3Bhbk5vZGUsIG51bGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFVua25vd25IaXRUZXN0UmVzdWx0KHNwYW5Ob2RlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUG9pbnRlckhhbmRsZXJMYXN0UmVuZGVyRGF0YSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBsYXN0Vmlld0N1cnNvcnNSZW5kZXJEYXRhOiBJVmlld0N1cnNvclJlbmRlckRhdGFbXSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFzdFRleHRhcmVhUG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgTW91c2VUYXJnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIF9kZWR1Y2VSYWdlKHBvc2l0aW9uOiBQb3NpdGlvbik6IEVkaXRvclJhbmdlO1xuXHRwcml2YXRlIHN0YXRpYyBfZGVkdWNlUmFnZShwb3NpdGlvbjogUG9zaXRpb24sIHJhbmdlOiBFZGl0b3JSYW5nZSB8IG51bGwpOiBFZGl0b3JSYW5nZTtcblx0cHJpdmF0ZSBzdGF0aWMgX2RlZHVjZVJhZ2UocG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbCk6IEVkaXRvclJhbmdlIHwgbnVsbDtcblx0cHJpdmF0ZSBzdGF0aWMgX2RlZHVjZVJhZ2UocG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbCwgcmFuZ2U6IEVkaXRvclJhbmdlIHwgbnVsbCA9IG51bGwpOiBFZGl0b3JSYW5nZSB8IG51bGwge1xuXHRcdGlmICghcmFuZ2UgJiYgcG9zaXRpb24pIHtcblx0XHRcdHJldHVybiBuZXcgRWRpdG9yUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmFuZ2UgPz8gbnVsbDtcblx0fVxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZVVua25vd24oZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24gfCBudWxsKTogSU1vdXNlVGFyZ2V0VW5rbm93biB7XG5cdFx0cmV0dXJuIHsgdHlwZTogTW91c2VUYXJnZXRUeXBlLlVOS05PV04sIGVsZW1lbnQsIG1vdXNlQ29sdW1uLCBwb3NpdGlvbiwgcmFuZ2U6IHRoaXMuX2RlZHVjZVJhZ2UocG9zaXRpb24pIH07XG5cdH1cblx0cHVibGljIHN0YXRpYyBjcmVhdGVUZXh0YXJlYShlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwsIG1vdXNlQ29sdW1uOiBudW1iZXIpOiBJTW91c2VUYXJnZXRUZXh0YXJlYSB7XG5cdFx0cmV0dXJuIHsgdHlwZTogTW91c2VUYXJnZXRUeXBlLlRFWFRBUkVBLCBlbGVtZW50LCBtb3VzZUNvbHVtbiwgcG9zaXRpb246IG51bGwsIHJhbmdlOiBudWxsIH07XG5cdH1cblx0cHVibGljIHN0YXRpYyBjcmVhdGVNYXJnaW4odHlwZTogTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9HTFlQSF9NQVJHSU4gfCBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0xJTkVfTlVNQkVSUyB8IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9ERUNPUkFUSU9OUywgZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24sIHJhbmdlOiBFZGl0b3JSYW5nZSwgZGV0YWlsOiBJTW91c2VUYXJnZXRNYXJnaW5EYXRhKTogSU1vdXNlVGFyZ2V0TWFyZ2luIHtcblx0XHRyZXR1cm4geyB0eXBlLCBlbGVtZW50LCBtb3VzZUNvbHVtbiwgcG9zaXRpb24sIHJhbmdlLCBkZXRhaWwgfTtcblx0fVxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZVZpZXdab25lKHR5cGU6IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfVklFV19aT05FIHwgTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVklFV19aT05FLCBlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwsIG1vdXNlQ29sdW1uOiBudW1iZXIsIHBvc2l0aW9uOiBQb3NpdGlvbiwgZGV0YWlsOiBJTW91c2VUYXJnZXRWaWV3Wm9uZURhdGEpOiBJTW91c2VUYXJnZXRWaWV3Wm9uZSB7XG5cdFx0cmV0dXJuIHsgdHlwZSwgZWxlbWVudCwgbW91c2VDb2x1bW4sIHBvc2l0aW9uLCByYW5nZTogdGhpcy5fZGVkdWNlUmFnZShwb3NpdGlvbiksIGRldGFpbCB9O1xuXHR9XG5cdHB1YmxpYyBzdGF0aWMgY3JlYXRlQ29udGVudFRleHQoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24sIHJhbmdlOiBFZGl0b3JSYW5nZSB8IG51bGwsIGRldGFpbDogSU1vdXNlVGFyZ2V0Q29udGVudFRleHREYXRhKTogSU1vdXNlVGFyZ2V0Q29udGVudFRleHQge1xuXHRcdHJldHVybiB7IHR5cGU6IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1RFWFQsIGVsZW1lbnQsIG1vdXNlQ29sdW1uLCBwb3NpdGlvbiwgcmFuZ2U6IHRoaXMuX2RlZHVjZVJhZ2UocG9zaXRpb24sIHJhbmdlKSwgZGV0YWlsIH07XG5cdH1cblx0cHVibGljIHN0YXRpYyBjcmVhdGVDb250ZW50RW1wdHkoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24sIGRldGFpbDogSU1vdXNlVGFyZ2V0Q29udGVudEVtcHR5RGF0YSk6IElNb3VzZVRhcmdldENvbnRlbnRFbXB0eSB7XG5cdFx0cmV0dXJuIHsgdHlwZTogTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfRU1QVFksIGVsZW1lbnQsIG1vdXNlQ29sdW1uLCBwb3NpdGlvbiwgcmFuZ2U6IHRoaXMuX2RlZHVjZVJhZ2UocG9zaXRpb24pLCBkZXRhaWwgfTtcblx0fVxuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZUNvbnRlbnRXaWRnZXQoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBkZXRhaWw6IHN0cmluZyk6IElNb3VzZVRhcmdldENvbnRlbnRXaWRnZXQge1xuXHRcdHJldHVybiB7IHR5cGU6IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1dJREdFVCwgZWxlbWVudCwgbW91c2VDb2x1bW4sIHBvc2l0aW9uOiBudWxsLCByYW5nZTogbnVsbCwgZGV0YWlsIH07XG5cdH1cblx0cHVibGljIHN0YXRpYyBjcmVhdGVTY3JvbGxiYXIoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsLCBtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24pOiBJTW91c2VUYXJnZXRTY3JvbGxiYXIge1xuXHRcdHJldHVybiB7IHR5cGU6IE1vdXNlVGFyZ2V0VHlwZS5TQ1JPTExCQVIsIGVsZW1lbnQsIG1vdXNlQ29sdW1uLCBwb3NpdGlvbiwgcmFuZ2U6IHRoaXMuX2RlZHVjZVJhZ2UocG9zaXRpb24pIH07XG5cdH1cblx0cHVibGljIHN0YXRpYyBjcmVhdGVPdmVybGF5V2lkZ2V0KGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCwgbW91c2VDb2x1bW46IG51bWJlciwgZGV0YWlsOiBzdHJpbmcpOiBJTW91c2VUYXJnZXRPdmVybGF5V2lkZ2V0IHtcblx0XHRyZXR1cm4geyB0eXBlOiBNb3VzZVRhcmdldFR5cGUuT1ZFUkxBWV9XSURHRVQsIGVsZW1lbnQsIG1vdXNlQ29sdW1uLCBwb3NpdGlvbjogbnVsbCwgcmFuZ2U6IG51bGwsIGRldGFpbCB9O1xuXHR9XG5cdHB1YmxpYyBzdGF0aWMgY3JlYXRlT3V0c2lkZUVkaXRvcihtb3VzZUNvbHVtbjogbnVtYmVyLCBwb3NpdGlvbjogUG9zaXRpb24sIG91dHNpZGVQb3NpdGlvbjogJ2Fib3ZlJyB8ICdiZWxvdycgfCAnbGVmdCcgfCAncmlnaHQnLCBvdXRzaWRlRGlzdGFuY2U6IG51bWJlcik6IElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3Ige1xuXHRcdHJldHVybiB7IHR5cGU6IE1vdXNlVGFyZ2V0VHlwZS5PVVRTSURFX0VESVRPUiwgZWxlbWVudDogbnVsbCwgbW91c2VDb2x1bW4sIHBvc2l0aW9uLCByYW5nZTogdGhpcy5fZGVkdWNlUmFnZShwb3NpdGlvbiksIG91dHNpZGVQb3NpdGlvbiwgb3V0c2lkZURpc3RhbmNlIH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfdHlwZVRvU3RyaW5nKHR5cGU6IE1vdXNlVGFyZ2V0VHlwZSk6IHN0cmluZyB7XG5cdFx0aWYgKHR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5URVhUQVJFQSkge1xuXHRcdFx0cmV0dXJuICdURVhUQVJFQSc7XG5cdFx0fVxuXHRcdGlmICh0eXBlID09PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0dMWVBIX01BUkdJTikge1xuXHRcdFx0cmV0dXJuICdHVVRURVJfR0xZUEhfTUFSR0lOJztcblx0XHR9XG5cdFx0aWYgKHR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9OVU1CRVJTKSB7XG5cdFx0XHRyZXR1cm4gJ0dVVFRFUl9MSU5FX05VTUJFUlMnO1xuXHRcdH1cblx0XHRpZiAodHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX0RFQ09SQVRJT05TKSB7XG5cdFx0XHRyZXR1cm4gJ0dVVFRFUl9MSU5FX0RFQ09SQVRJT05TJztcblx0XHR9XG5cdFx0aWYgKHR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfVklFV19aT05FKSB7XG5cdFx0XHRyZXR1cm4gJ0dVVFRFUl9WSUVXX1pPTkUnO1xuXHRcdH1cblx0XHRpZiAodHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVCkge1xuXHRcdFx0cmV0dXJuICdDT05URU5UX1RFWFQnO1xuXHRcdH1cblx0XHRpZiAodHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfRU1QVFkpIHtcblx0XHRcdHJldHVybiAnQ09OVEVOVF9FTVBUWSc7XG5cdFx0fVxuXHRcdGlmICh0eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9WSUVXX1pPTkUpIHtcblx0XHRcdHJldHVybiAnQ09OVEVOVF9WSUVXX1pPTkUnO1xuXHRcdH1cblx0XHRpZiAodHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfV0lER0VUKSB7XG5cdFx0XHRyZXR1cm4gJ0NPTlRFTlRfV0lER0VUJztcblx0XHR9XG5cdFx0aWYgKHR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5PVkVSVklFV19SVUxFUikge1xuXHRcdFx0cmV0dXJuICdPVkVSVklFV19SVUxFUic7XG5cdFx0fVxuXHRcdGlmICh0eXBlID09PSBNb3VzZVRhcmdldFR5cGUuU0NST0xMQkFSKSB7XG5cdFx0XHRyZXR1cm4gJ1NDUk9MTEJBUic7XG5cdFx0fVxuXHRcdGlmICh0eXBlID09PSBNb3VzZVRhcmdldFR5cGUuT1ZFUkxBWV9XSURHRVQpIHtcblx0XHRcdHJldHVybiAnT1ZFUkxBWV9XSURHRVQnO1xuXHRcdH1cblx0XHRyZXR1cm4gJ1VOS05PV04nO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyB0b1N0cmluZyh0YXJnZXQ6IElNb3VzZVRhcmdldCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3R5cGVUb1N0cmluZyh0YXJnZXQudHlwZSkgKyAnOiAnICsgdGFyZ2V0LnBvc2l0aW9uICsgJyAtICcgKyB0YXJnZXQucmFuZ2UgKyAnIC0gJyArIEpTT04uc3RyaW5naWZ5KCg8YW55PnRhcmdldCkuZGV0YWlsKTtcblx0fVxufVxuXG5jbGFzcyBFbGVtZW50UGF0aCB7XG5cblx0cHVibGljIHN0YXRpYyBpc1RleHRBcmVhKHBhdGg6IFVpbnQ4QXJyYXkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0cGF0aC5sZW5ndGggPT09IDJcblx0XHRcdCYmIHBhdGhbMF0gPT09IFBhcnRGaW5nZXJwcmludC5PdmVyZmxvd0d1YXJkXG5cdFx0XHQmJiBwYXRoWzFdID09PSBQYXJ0RmluZ2VycHJpbnQuVGV4dEFyZWFcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBpc0NoaWxkT2ZWaWV3TGluZXMocGF0aDogVWludDhBcnJheSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHRwYXRoLmxlbmd0aCA+PSA0XG5cdFx0XHQmJiBwYXRoWzBdID09PSBQYXJ0RmluZ2VycHJpbnQuT3ZlcmZsb3dHdWFyZFxuXHRcdFx0JiYgcGF0aFszXSA9PT0gUGFydEZpbmdlcnByaW50LlZpZXdMaW5lc1xuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGlzU3RyaWN0Q2hpbGRPZlZpZXdMaW5lcyhwYXRoOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHBhdGgubGVuZ3RoID4gNFxuXHRcdFx0JiYgcGF0aFswXSA9PT0gUGFydEZpbmdlcnByaW50Lk92ZXJmbG93R3VhcmRcblx0XHRcdCYmIHBhdGhbM10gPT09IFBhcnRGaW5nZXJwcmludC5WaWV3TGluZXNcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBpc0NoaWxkT2ZTY3JvbGxhYmxlRWxlbWVudChwYXRoOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHBhdGgubGVuZ3RoID49IDJcblx0XHRcdCYmIHBhdGhbMF0gPT09IFBhcnRGaW5nZXJwcmludC5PdmVyZmxvd0d1YXJkXG5cdFx0XHQmJiBwYXRoWzFdID09PSBQYXJ0RmluZ2VycHJpbnQuU2Nyb2xsYWJsZUVsZW1lbnRcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBpc0NoaWxkT2ZNaW5pbWFwKHBhdGg6IFVpbnQ4QXJyYXkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0cGF0aC5sZW5ndGggPj0gMlxuXHRcdFx0JiYgcGF0aFswXSA9PT0gUGFydEZpbmdlcnByaW50Lk92ZXJmbG93R3VhcmRcblx0XHRcdCYmIHBhdGhbMV0gPT09IFBhcnRGaW5nZXJwcmludC5NaW5pbWFwXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZE9mQ29udGVudFdpZGdldHMocGF0aDogVWludDhBcnJheSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHRwYXRoLmxlbmd0aCA+PSA0XG5cdFx0XHQmJiBwYXRoWzBdID09PSBQYXJ0RmluZ2VycHJpbnQuT3ZlcmZsb3dHdWFyZFxuXHRcdFx0JiYgcGF0aFszXSA9PT0gUGFydEZpbmdlcnByaW50LkNvbnRlbnRXaWRnZXRzXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZE9mT3ZlcmZsb3dHdWFyZChwYXRoOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHBhdGgubGVuZ3RoID49IDFcblx0XHRcdCYmIHBhdGhbMF0gPT09IFBhcnRGaW5nZXJwcmludC5PdmVyZmxvd0d1YXJkXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZE9mT3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0cyhwYXRoOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHBhdGgubGVuZ3RoID49IDFcblx0XHRcdCYmIHBhdGhbMF0gPT09IFBhcnRGaW5nZXJwcmludC5PdmVyZmxvd2luZ0NvbnRlbnRXaWRnZXRzXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZE9mT3ZlcmxheVdpZGdldHMocGF0aDogVWludDhBcnJheSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHRwYXRoLmxlbmd0aCA+PSAyXG5cdFx0XHQmJiBwYXRoWzBdID09PSBQYXJ0RmluZ2VycHJpbnQuT3ZlcmZsb3dHdWFyZFxuXHRcdFx0JiYgcGF0aFsxXSA9PT0gUGFydEZpbmdlcnByaW50Lk92ZXJsYXlXaWRnZXRzXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgaXNDaGlsZE9mT3ZlcmZsb3dpbmdPdmVybGF5V2lkZ2V0cyhwYXRoOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHBhdGgubGVuZ3RoID49IDFcblx0XHRcdCYmIHBhdGhbMF0gPT09IFBhcnRGaW5nZXJwcmludC5PdmVyZmxvd2luZ092ZXJsYXlXaWRnZXRzXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSGl0VGVzdENvbnRleHQge1xuXG5cdHB1YmxpYyByZWFkb25seSB2aWV3TW9kZWw6IElWaWV3TW9kZWw7XG5cdHB1YmxpYyByZWFkb25seSBsYXlvdXRJbmZvOiBFZGl0b3JMYXlvdXRJbmZvO1xuXHRwdWJsaWMgcmVhZG9ubHkgdmlld0RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgdmlld0xpbmVzR3B1OiBWaWV3TGluZXNHcHUgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSBsaW5lSGVpZ2h0OiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBzdGlja3lUYWJTdG9wczogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IHR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGFzdFJlbmRlckRhdGE6IFBvaW50ZXJIYW5kbGVyTGFzdFJlbmRlckRhdGE7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dDogVmlld0NvbnRleHQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdIZWxwZXI6IElQb2ludGVySGFuZGxlckhlbHBlcjtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCwgdmlld0hlbHBlcjogSVBvaW50ZXJIYW5kbGVySGVscGVyLCBsYXN0UmVuZGVyRGF0YTogUG9pbnRlckhhbmRsZXJMYXN0UmVuZGVyRGF0YSkge1xuXHRcdHRoaXMudmlld01vZGVsID0gY29udGV4dC52aWV3TW9kZWw7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGNvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdHRoaXMubGF5b3V0SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblx0XHR0aGlzLnZpZXdEb21Ob2RlID0gdmlld0hlbHBlci52aWV3RG9tTm9kZTtcblx0XHR0aGlzLnZpZXdMaW5lc0dwdSA9IHZpZXdIZWxwZXIudmlld0xpbmVzR3B1O1xuXHRcdHRoaXMubGluZUhlaWdodCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHR0aGlzLnN0aWNreVRhYlN0b3BzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnN0aWNreVRhYlN0b3BzKTtcblx0XHR0aGlzLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbykudHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoO1xuXHRcdHRoaXMubGFzdFJlbmRlckRhdGEgPSBsYXN0UmVuZGVyRGF0YTtcblx0XHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLl92aWV3SGVscGVyID0gdmlld0hlbHBlcjtcblx0fVxuXG5cdHB1YmxpYyBnZXRab25lQXRDb29yZChtb3VzZVZlcnRpY2FsT2Zmc2V0OiBudW1iZXIpOiBJTW91c2VUYXJnZXRWaWV3Wm9uZURhdGEgfCBudWxsIHtcblx0XHRyZXR1cm4gSGl0VGVzdENvbnRleHQuZ2V0Wm9uZUF0Q29vcmQodGhpcy5fY29udGV4dCwgbW91c2VWZXJ0aWNhbE9mZnNldCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGdldFpvbmVBdENvb3JkKGNvbnRleHQ6IFZpZXdDb250ZXh0LCBtb3VzZVZlcnRpY2FsT2Zmc2V0OiBudW1iZXIpOiBJTW91c2VUYXJnZXRWaWV3Wm9uZURhdGEgfCBudWxsIHtcblx0XHQvLyBUaGUgdGFyZ2V0IGlzIGVpdGhlciBhIHZpZXcgem9uZSBvciB0aGUgZW1wdHkgc3BhY2UgYWZ0ZXIgdGhlIGxhc3Qgdmlldy1saW5lXG5cdFx0Y29uc3Qgdmlld1pvbmVXaGl0ZXNwYWNlID0gY29udGV4dC52aWV3TGF5b3V0LmdldFdoaXRlc3BhY2VBdFZlcnRpY2FsT2Zmc2V0KG1vdXNlVmVydGljYWxPZmZzZXQpO1xuXG5cdFx0aWYgKHZpZXdab25lV2hpdGVzcGFjZSkge1xuXHRcdFx0Y29uc3Qgdmlld1pvbmVNaWRkbGUgPSB2aWV3Wm9uZVdoaXRlc3BhY2UudmVydGljYWxPZmZzZXQgKyB2aWV3Wm9uZVdoaXRlc3BhY2UuaGVpZ2h0IC8gMjtcblx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IGNvbnRleHQudmlld01vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0bGV0IHBvc2l0aW9uQmVmb3JlOiBQb3NpdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdFx0bGV0IHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGw7XG5cdFx0XHRsZXQgcG9zaXRpb25BZnRlcjogUG9zaXRpb24gfCBudWxsID0gbnVsbDtcblxuXHRcdFx0aWYgKHZpZXdab25lV2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIgIT09IGxpbmVDb3VudCkge1xuXHRcdFx0XHQvLyBUaGVyZSBhcmUgbW9yZSBsaW5lcyBhZnRlciB0aGlzIHZpZXcgem9uZVxuXHRcdFx0XHRwb3NpdGlvbkFmdGVyID0gbmV3IFBvc2l0aW9uKHZpZXdab25lV2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIgKyAxLCAxKTtcblx0XHRcdH1cblx0XHRcdGlmICh2aWV3Wm9uZVdoaXRlc3BhY2UuYWZ0ZXJMaW5lTnVtYmVyID4gMCkge1xuXHRcdFx0XHQvLyBUaGVyZSBhcmUgbW9yZSBsaW5lcyBhYm92ZSB0aGlzIHZpZXcgem9uZVxuXHRcdFx0XHRwb3NpdGlvbkJlZm9yZSA9IG5ldyBQb3NpdGlvbih2aWV3Wm9uZVdoaXRlc3BhY2UuYWZ0ZXJMaW5lTnVtYmVyLCBjb250ZXh0LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHZpZXdab25lV2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBvc2l0aW9uQWZ0ZXIgPT09IG51bGwpIHtcblx0XHRcdFx0cG9zaXRpb24gPSBwb3NpdGlvbkJlZm9yZTtcblx0XHRcdH0gZWxzZSBpZiAocG9zaXRpb25CZWZvcmUgPT09IG51bGwpIHtcblx0XHRcdFx0cG9zaXRpb24gPSBwb3NpdGlvbkFmdGVyO1xuXHRcdFx0fSBlbHNlIGlmIChtb3VzZVZlcnRpY2FsT2Zmc2V0IDwgdmlld1pvbmVNaWRkbGUpIHtcblx0XHRcdFx0cG9zaXRpb24gPSBwb3NpdGlvbkJlZm9yZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBvc2l0aW9uID0gcG9zaXRpb25BZnRlcjtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmlld1pvbmVJZDogdmlld1pvbmVXaGl0ZXNwYWNlLmlkLFxuXHRcdFx0XHRhZnRlckxpbmVOdW1iZXI6IHZpZXdab25lV2hpdGVzcGFjZS5hZnRlckxpbmVOdW1iZXIsXG5cdFx0XHRcdHBvc2l0aW9uQmVmb3JlOiBwb3NpdGlvbkJlZm9yZSxcblx0XHRcdFx0cG9zaXRpb25BZnRlcjogcG9zaXRpb25BZnRlcixcblx0XHRcdFx0cG9zaXRpb246IHBvc2l0aW9uIVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RnVsbExpbmVSYW5nZUF0Q29vcmQobW91c2VWZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogeyByYW5nZTogRWRpdG9yUmFuZ2U7IGlzQWZ0ZXJMaW5lczogYm9vbGVhbiB9IHtcblx0XHRpZiAodGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmlzQWZ0ZXJMaW5lcyhtb3VzZVZlcnRpY2FsT2Zmc2V0KSkge1xuXHRcdFx0Ly8gQmVsb3cgdGhlIGxhc3QgbGluZVxuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0Y29uc3QgbWF4TGluZUNvbHVtbiA9IHRoaXMuX2NvbnRleHQudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyYW5nZTogbmV3IEVkaXRvclJhbmdlKGxpbmVOdW1iZXIsIG1heExpbmVDb2x1bW4sIGxpbmVOdW1iZXIsIG1heExpbmVDb2x1bW4pLFxuXHRcdFx0XHRpc0FmdGVyTGluZXM6IHRydWVcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZU51bWJlciA9IHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldChtb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblx0XHRjb25zdCBtYXhMaW5lQ29sdW1uID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IG5ldyBFZGl0b3JSYW5nZShsaW5lTnVtYmVyLCAxLCBsaW5lTnVtYmVyLCBtYXhMaW5lQ29sdW1uKSxcblx0XHRcdGlzQWZ0ZXJMaW5lczogZmFsc2Vcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldExpbmVOdW1iZXJBdFZlcnRpY2FsT2Zmc2V0KG1vdXNlVmVydGljYWxPZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldChtb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblx0fVxuXG5cdHB1YmxpYyBpc0FmdGVyTGluZXMobW91c2VWZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld0xheW91dC5pc0FmdGVyTGluZXMobW91c2VWZXJ0aWNhbE9mZnNldCk7XG5cdH1cblxuXHRwdWJsaWMgaXNJblRvcFBhZGRpbmcobW91c2VWZXJ0aWNhbE9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQudmlld0xheW91dC5pc0luVG9wUGFkZGluZyhtb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblx0fVxuXG5cdHB1YmxpYyBpc0luQm90dG9tUGFkZGluZyhtb3VzZVZlcnRpY2FsT2Zmc2V0OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmlzSW5Cb3R0b21QYWRkaW5nKG1vdXNlVmVydGljYWxPZmZzZXQpO1xuXHR9XG5cblx0cHVibGljIGdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihsaW5lTnVtYmVyOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKGxpbmVOdW1iZXIpO1xuXHR9XG5cblx0cHVibGljIGZpbmRBdHRyaWJ1dGUoZWxlbWVudDogRWxlbWVudCwgYXR0cjogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIEhpdFRlc3RDb250ZXh0Ll9maW5kQXR0cmlidXRlKGVsZW1lbnQsIGF0dHIsIHRoaXMuX3ZpZXdIZWxwZXIudmlld0RvbU5vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpbmRBdHRyaWJ1dGUoZWxlbWVudDogRWxlbWVudCwgYXR0cjogc3RyaW5nLCBzdG9wQXQ6IEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHR3aGlsZSAoZWxlbWVudCAmJiBlbGVtZW50ICE9PSBlbGVtZW50Lm93bmVyRG9jdW1lbnQuYm9keSkge1xuXHRcdFx0aWYgKGVsZW1lbnQuaGFzQXR0cmlidXRlICYmIGVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHIpKSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyKTtcblx0XHRcdH1cblx0XHRcdGlmIChlbGVtZW50ID09PSBzdG9wQXQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRlbGVtZW50ID0gPEVsZW1lbnQ+ZWxlbWVudC5wYXJlbnROb2RlO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBnZXRMaW5lV2lkdGgobGluZU51bWJlcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld0hlbHBlci5nZXRMaW5lV2lkdGgobGluZU51bWJlcik7XG5cdH1cblxuXHRwdWJsaWMgdmlzaWJsZVJhbmdlRm9yUG9zaXRpb24obGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlcik6IEhvcml6b250YWxQb3NpdGlvbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl92aWV3SGVscGVyLnZpc2libGVSYW5nZUZvclBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UG9zaXRpb25Gcm9tRE9NSW5mbyhzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKTogUG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld0hlbHBlci5nZXRQb3NpdGlvbkZyb21ET01JbmZvKHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHR9XG5cblx0cHVibGljIGdldEN1cnJlbnRTY3JvbGxUb3AoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDdXJyZW50U2Nyb2xsTGVmdCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbExlZnQoKTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBCYXJlSGl0VGVzdFJlcXVlc3Qge1xuXG5cdHB1YmxpYyByZWFkb25seSBlZGl0b3JQb3M6IEVkaXRvclBhZ2VQb3NpdGlvbjtcblx0cHVibGljIHJlYWRvbmx5IHBvczogUGFnZUNvb3JkaW5hdGVzO1xuXHRwdWJsaWMgcmVhZG9ubHkgcmVsYXRpdmVQb3M6IENvb3JkaW5hdGVzUmVsYXRpdmVUb0VkaXRvcjtcblx0cHVibGljIHJlYWRvbmx5IG1vdXNlVmVydGljYWxPZmZzZXQ6IG51bWJlcjtcblx0cHVibGljIHJlYWRvbmx5IGlzSW5NYXJnaW5BcmVhOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgaXNJbkNvbnRlbnRBcmVhOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgbW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldDogbnVtYmVyO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBtb3VzZUNvbHVtbjogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKGN0eDogSGl0VGVzdENvbnRleHQsIGVkaXRvclBvczogRWRpdG9yUGFnZVBvc2l0aW9uLCBwb3M6IFBhZ2VDb29yZGluYXRlcywgcmVsYXRpdmVQb3M6IENvb3JkaW5hdGVzUmVsYXRpdmVUb0VkaXRvcikge1xuXHRcdHRoaXMuZWRpdG9yUG9zID0gZWRpdG9yUG9zO1xuXHRcdHRoaXMucG9zID0gcG9zO1xuXHRcdHRoaXMucmVsYXRpdmVQb3MgPSByZWxhdGl2ZVBvcztcblxuXHRcdHRoaXMubW91c2VWZXJ0aWNhbE9mZnNldCA9IE1hdGgubWF4KDAsIGN0eC5nZXRDdXJyZW50U2Nyb2xsVG9wKCkgKyB0aGlzLnJlbGF0aXZlUG9zLnkpO1xuXHRcdHRoaXMubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCA9IGN0eC5nZXRDdXJyZW50U2Nyb2xsTGVmdCgpICsgdGhpcy5yZWxhdGl2ZVBvcy54IC0gY3R4LmxheW91dEluZm8uY29udGVudExlZnQ7XG5cdFx0dGhpcy5pc0luTWFyZ2luQXJlYSA9ICh0aGlzLnJlbGF0aXZlUG9zLnggPCBjdHgubGF5b3V0SW5mby5jb250ZW50TGVmdCAmJiB0aGlzLnJlbGF0aXZlUG9zLnggPj0gY3R4LmxheW91dEluZm8uZ2x5cGhNYXJnaW5MZWZ0KTtcblx0XHR0aGlzLmlzSW5Db250ZW50QXJlYSA9ICF0aGlzLmlzSW5NYXJnaW5BcmVhO1xuXHRcdHRoaXMubW91c2VDb2x1bW4gPSBNYXRoLm1heCgwLCBNb3VzZVRhcmdldEZhY3RvcnkuX2dldE1vdXNlQ29sdW1uKHRoaXMubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCwgY3R4LnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCkpO1xuXHR9XG59XG5cbmNsYXNzIEhpdFRlc3RSZXF1ZXN0IGV4dGVuZHMgQmFyZUhpdFRlc3RSZXF1ZXN0IHtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4OiBIaXRUZXN0Q29udGV4dDtcblx0cHJpdmF0ZSByZWFkb25seSBfZXZlbnRUYXJnZXQ6IEhUTUxFbGVtZW50IHwgbnVsbDtcblx0cHVibGljIHJlYWRvbmx5IGhpdFRlc3RSZXN1bHQgPSBuZXcgTGF6eSgoKSA9PiBNb3VzZVRhcmdldEZhY3RvcnkuZG9IaXRUZXN0KHRoaXMuX2N0eCwgdGhpcykpO1xuXHRwcml2YXRlIF91c2VIaXRUZXN0VGFyZ2V0OiBib29sZWFuO1xuXHRwcml2YXRlIF90YXJnZXRQYXRoQ2FjaGVFbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF90YXJnZXRQYXRoQ2FjaGVWYWx1ZTogVWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KDApO1xuXG5cdHB1YmxpYyBnZXQgdGFyZ2V0KCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuX3VzZUhpdFRlc3RUYXJnZXQpIHtcblx0XHRcdHJldHVybiB0aGlzLmhpdFRlc3RSZXN1bHQudmFsdWUuaGl0VGFyZ2V0O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZXZlbnRUYXJnZXQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHRhcmdldFBhdGgoKTogVWludDhBcnJheSB7XG5cdFx0aWYgKHRoaXMuX3RhcmdldFBhdGhDYWNoZUVsZW1lbnQgIT09IHRoaXMudGFyZ2V0KSB7XG5cdFx0XHR0aGlzLl90YXJnZXRQYXRoQ2FjaGVFbGVtZW50ID0gdGhpcy50YXJnZXQ7XG5cdFx0XHR0aGlzLl90YXJnZXRQYXRoQ2FjaGVWYWx1ZSA9IFBhcnRGaW5nZXJwcmludHMuY29sbGVjdCh0aGlzLnRhcmdldCwgdGhpcy5fY3R4LnZpZXdEb21Ob2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3RhcmdldFBhdGhDYWNoZVZhbHVlO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoY3R4OiBIaXRUZXN0Q29udGV4dCwgZWRpdG9yUG9zOiBFZGl0b3JQYWdlUG9zaXRpb24sIHBvczogUGFnZUNvb3JkaW5hdGVzLCByZWxhdGl2ZVBvczogQ29vcmRpbmF0ZXNSZWxhdGl2ZVRvRWRpdG9yLCBldmVudFRhcmdldDogSFRNTEVsZW1lbnQgfCBudWxsKSB7XG5cdFx0c3VwZXIoY3R4LCBlZGl0b3JQb3MsIHBvcywgcmVsYXRpdmVQb3MpO1xuXHRcdHRoaXMuX2N0eCA9IGN0eDtcblx0XHR0aGlzLl9ldmVudFRhcmdldCA9IGV2ZW50VGFyZ2V0O1xuXG5cdFx0Ly8gSWYgbm8gZXZlbnQgdGFyZ2V0IGlzIHBhc3NlZCBpbiwgd2Ugd2lsbCB1c2UgdGhlIGhpdCB0ZXN0IHRhcmdldFxuXHRcdGNvbnN0IGhhc0V2ZW50VGFyZ2V0ID0gQm9vbGVhbih0aGlzLl9ldmVudFRhcmdldCk7XG5cdFx0dGhpcy5fdXNlSGl0VGVzdFRhcmdldCA9ICFoYXNFdmVudFRhcmdldDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgcG9zKCR7dGhpcy5wb3MueH0sJHt0aGlzLnBvcy55fSksIGVkaXRvclBvcygke3RoaXMuZWRpdG9yUG9zLnh9LCR7dGhpcy5lZGl0b3JQb3MueX0pLCByZWxhdGl2ZVBvcygke3RoaXMucmVsYXRpdmVQb3MueH0sJHt0aGlzLnJlbGF0aXZlUG9zLnl9KSwgbW91c2VWZXJ0aWNhbE9mZnNldDogJHt0aGlzLm1vdXNlVmVydGljYWxPZmZzZXR9LCBtb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0OiAke3RoaXMubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldH1cXG5cXHR0YXJnZXQ6ICR7dGhpcy50YXJnZXQgPyAoPEhUTUxFbGVtZW50PnRoaXMudGFyZ2V0KS5vdXRlckhUTUwgOiBudWxsfWA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHdvdWxkQmVuZWZpdEZyb21IaXRUZXN0VGFyZ2V0U3dpdGNoKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHQhdGhpcy5fdXNlSGl0VGVzdFRhcmdldFxuXHRcdFx0JiYgdGhpcy5oaXRUZXN0UmVzdWx0LnZhbHVlLmhpdFRhcmdldCAhPT0gbnVsbFxuXHRcdFx0JiYgdGhpcy50YXJnZXQgIT09IHRoaXMuaGl0VGVzdFJlc3VsdC52YWx1ZS5oaXRUYXJnZXRcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHN3aXRjaFRvSGl0VGVzdFRhcmdldCgpOiB2b2lkIHtcblx0XHR0aGlzLl91c2VIaXRUZXN0VGFyZ2V0ID0gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE1vdXNlQ29sdW1uKHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGwgPSBudWxsKTogbnVtYmVyIHtcblx0XHRpZiAocG9zaXRpb24gJiYgcG9zaXRpb24uY29sdW1uIDwgdGhpcy5fY3R4LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIpKSB7XG5cdFx0XHQvLyBNb3N0IGxpa2VseSwgdGhlIGxpbmUgY29udGFpbnMgZm9yZWlnbiBkZWNvcmF0aW9ucy4uLlxuXHRcdFx0cmV0dXJuIEN1cnNvckNvbHVtbnMudmlzaWJsZUNvbHVtbkZyb21Db2x1bW4odGhpcy5fY3R4LnZpZXdNb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKSwgcG9zaXRpb24uY29sdW1uLCB0aGlzLl9jdHgudmlld01vZGVsLm1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplKSArIDE7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLm1vdXNlQ29sdW1uO1xuXHR9XG5cblx0cHVibGljIGZ1bGZpbGxVbmtub3duKHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGwgPSBudWxsKTogSU1vdXNlVGFyZ2V0VW5rbm93biB7XG5cdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZVVua25vd24odGhpcy50YXJnZXQsIHRoaXMuX2dldE1vdXNlQ29sdW1uKHBvc2l0aW9uKSwgcG9zaXRpb24pO1xuXHR9XG5cdHB1YmxpYyBmdWxmaWxsVGV4dGFyZWEoKTogSU1vdXNlVGFyZ2V0VGV4dGFyZWEge1xuXHRcdHJldHVybiBNb3VzZVRhcmdldC5jcmVhdGVUZXh0YXJlYSh0aGlzLnRhcmdldCwgdGhpcy5fZ2V0TW91c2VDb2x1bW4oKSk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxNYXJnaW4odHlwZTogTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9HTFlQSF9NQVJHSU4gfCBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0xJTkVfTlVNQkVSUyB8IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9ERUNPUkFUSU9OUywgcG9zaXRpb246IFBvc2l0aW9uLCByYW5nZTogRWRpdG9yUmFuZ2UsIGRldGFpbDogSU1vdXNlVGFyZ2V0TWFyZ2luRGF0YSk6IElNb3VzZVRhcmdldE1hcmdpbiB7XG5cdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZU1hcmdpbih0eXBlLCB0aGlzLnRhcmdldCwgdGhpcy5fZ2V0TW91c2VDb2x1bW4ocG9zaXRpb24pLCBwb3NpdGlvbiwgcmFuZ2UsIGRldGFpbCk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxWaWV3Wm9uZSh0eXBlOiBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX1ZJRVdfWk9ORSB8IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1ZJRVdfWk9ORSwgcG9zaXRpb246IFBvc2l0aW9uLCBkZXRhaWw6IElNb3VzZVRhcmdldFZpZXdab25lRGF0YSk6IElNb3VzZVRhcmdldFZpZXdab25lIHtcblx0XHRyZXR1cm4gTW91c2VUYXJnZXQuY3JlYXRlVmlld1pvbmUodHlwZSwgdGhpcy50YXJnZXQsIHRoaXMuX2dldE1vdXNlQ29sdW1uKHBvc2l0aW9uKSwgcG9zaXRpb24sIGRldGFpbCk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxDb250ZW50VGV4dChwb3NpdGlvbjogUG9zaXRpb24sIHJhbmdlOiBFZGl0b3JSYW5nZSB8IG51bGwsIGRldGFpbDogSU1vdXNlVGFyZ2V0Q29udGVudFRleHREYXRhKTogSU1vdXNlVGFyZ2V0Q29udGVudFRleHQge1xuXHRcdHJldHVybiBNb3VzZVRhcmdldC5jcmVhdGVDb250ZW50VGV4dCh0aGlzLnRhcmdldCwgdGhpcy5fZ2V0TW91c2VDb2x1bW4ocG9zaXRpb24pLCBwb3NpdGlvbiwgcmFuZ2UsIGRldGFpbCk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxDb250ZW50RW1wdHkocG9zaXRpb246IFBvc2l0aW9uLCBkZXRhaWw6IElNb3VzZVRhcmdldENvbnRlbnRFbXB0eURhdGEpOiBJTW91c2VUYXJnZXRDb250ZW50RW1wdHkge1xuXHRcdHJldHVybiBNb3VzZVRhcmdldC5jcmVhdGVDb250ZW50RW1wdHkodGhpcy50YXJnZXQsIHRoaXMuX2dldE1vdXNlQ29sdW1uKHBvc2l0aW9uKSwgcG9zaXRpb24sIGRldGFpbCk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxDb250ZW50V2lkZ2V0KGRldGFpbDogc3RyaW5nKTogSU1vdXNlVGFyZ2V0Q29udGVudFdpZGdldCB7XG5cdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZUNvbnRlbnRXaWRnZXQodGhpcy50YXJnZXQsIHRoaXMuX2dldE1vdXNlQ29sdW1uKCksIGRldGFpbCk7XG5cdH1cblx0cHVibGljIGZ1bGZpbGxTY3JvbGxiYXIocG9zaXRpb246IFBvc2l0aW9uKTogSU1vdXNlVGFyZ2V0U2Nyb2xsYmFyIHtcblx0XHRyZXR1cm4gTW91c2VUYXJnZXQuY3JlYXRlU2Nyb2xsYmFyKHRoaXMudGFyZ2V0LCB0aGlzLl9nZXRNb3VzZUNvbHVtbihwb3NpdGlvbiksIHBvc2l0aW9uKTtcblx0fVxuXHRwdWJsaWMgZnVsZmlsbE92ZXJsYXlXaWRnZXQoZGV0YWlsOiBzdHJpbmcpOiBJTW91c2VUYXJnZXRPdmVybGF5V2lkZ2V0IHtcblx0XHRyZXR1cm4gTW91c2VUYXJnZXQuY3JlYXRlT3ZlcmxheVdpZGdldCh0aGlzLnRhcmdldCwgdGhpcy5fZ2V0TW91c2VDb2x1bW4oKSwgZGV0YWlsKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgUmVzb2x2ZWRIaXRUZXN0UmVxdWVzdCBleHRlbmRzIEhpdFRlc3RSZXF1ZXN0IHtcblx0cmVhZG9ubHkgdGFyZ2V0OiBIVE1MRWxlbWVudDtcbn1cblxuY29uc3QgRU1QVFlfQ09OVEVOVF9BRlRFUl9MSU5FUzogSU1vdXNlVGFyZ2V0Q29udGVudEVtcHR5RGF0YSA9IHsgaXNBZnRlckxpbmVzOiB0cnVlIH07XG5cbmZ1bmN0aW9uIGNyZWF0ZUVtcHR5Q29udGVudERhdGFJbkxpbmVzKGhvcml6b250YWxEaXN0YW5jZVRvVGV4dDogbnVtYmVyKTogSU1vdXNlVGFyZ2V0Q29udGVudEVtcHR5RGF0YSB7XG5cdHJldHVybiB7XG5cdFx0aXNBZnRlckxpbmVzOiBmYWxzZSxcblx0XHRob3Jpem9udGFsRGlzdGFuY2VUb1RleHQ6IGhvcml6b250YWxEaXN0YW5jZVRvVGV4dFxuXHR9O1xufVxuXG5leHBvcnQgY2xhc3MgTW91c2VUYXJnZXRGYWN0b3J5IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0OiBWaWV3Q29udGV4dDtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld0hlbHBlcjogSVBvaW50ZXJIYW5kbGVySGVscGVyO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRleHQ6IFZpZXdDb250ZXh0LCB2aWV3SGVscGVyOiBJUG9pbnRlckhhbmRsZXJIZWxwZXIpIHtcblx0XHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLl92aWV3SGVscGVyID0gdmlld0hlbHBlcjtcblx0fVxuXG5cdHB1YmxpYyBtb3VzZVRhcmdldElzV2lkZ2V0KGU6IEVkaXRvck1vdXNlRXZlbnQpOiBib29sZWFuIHtcblx0XHRjb25zdCB0ID0gPEVsZW1lbnQ+ZS50YXJnZXQ7XG5cdFx0Y29uc3QgcGF0aCA9IFBhcnRGaW5nZXJwcmludHMuY29sbGVjdCh0LCB0aGlzLl92aWV3SGVscGVyLnZpZXdEb21Ob2RlKTtcblxuXHRcdC8vIElzIGl0IGEgY29udGVudCB3aWRnZXQ/XG5cdFx0aWYgKEVsZW1lbnRQYXRoLmlzQ2hpbGRPZkNvbnRlbnRXaWRnZXRzKHBhdGgpIHx8IEVsZW1lbnRQYXRoLmlzQ2hpbGRPZk92ZXJmbG93aW5nQ29udGVudFdpZGdldHMocGF0aCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIElzIGl0IGFuIG92ZXJsYXkgd2lkZ2V0P1xuXHRcdGlmIChFbGVtZW50UGF0aC5pc0NoaWxkT2ZPdmVybGF5V2lkZ2V0cyhwYXRoKSB8fCBFbGVtZW50UGF0aC5pc0NoaWxkT2ZPdmVyZmxvd2luZ092ZXJsYXlXaWRnZXRzKHBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlTW91c2VUYXJnZXQobGFzdFJlbmRlckRhdGE6IFBvaW50ZXJIYW5kbGVyTGFzdFJlbmRlckRhdGEsIGVkaXRvclBvczogRWRpdG9yUGFnZVBvc2l0aW9uLCBwb3M6IFBhZ2VDb29yZGluYXRlcywgcmVsYXRpdmVQb3M6IENvb3JkaW5hdGVzUmVsYXRpdmVUb0VkaXRvciwgdGFyZ2V0OiBIVE1MRWxlbWVudCB8IG51bGwpOiBJTW91c2VUYXJnZXQge1xuXHRcdGNvbnN0IGN0eCA9IG5ldyBIaXRUZXN0Q29udGV4dCh0aGlzLl9jb250ZXh0LCB0aGlzLl92aWV3SGVscGVyLCBsYXN0UmVuZGVyRGF0YSk7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IG5ldyBIaXRUZXN0UmVxdWVzdChjdHgsIGVkaXRvclBvcywgcG9zLCByZWxhdGl2ZVBvcywgdGFyZ2V0KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgciA9IE1vdXNlVGFyZ2V0RmFjdG9yeS5fY3JlYXRlTW91c2VUYXJnZXQoY3R4LCByZXF1ZXN0KTtcblxuXHRcdFx0aWYgKHIudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVCkge1xuXHRcdFx0XHQvLyBTbmFwIHRvIHRoZSBuZWFyZXN0IHNvZnQgdGFiIGJvdW5kYXJ5IGlmIGF0b21pYyBzb2Z0IHRhYnMgYXJlIGVuYWJsZWQuXG5cdFx0XHRcdGlmIChjdHguc3RpY2t5VGFiU3RvcHMgJiYgci5wb3NpdGlvbiAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gTW91c2VUYXJnZXRGYWN0b3J5Ll9zbmFwVG9Tb2Z0VGFiQm91bmRhcnkoci5wb3NpdGlvbiwgY3R4LnZpZXdNb2RlbCk7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBFZGl0b3JSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uLCBwb3NpdGlvbikucGx1c1JhbmdlKHIucmFuZ2UpO1xuXHRcdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50VGV4dChwb3NpdGlvbiwgcmFuZ2UsIHIuZGV0YWlsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhNb3VzZVRhcmdldC50b1N0cmluZyhyKSk7XG5cdFx0XHRyZXR1cm4gcjtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdC8vIGNvbnNvbGUubG9nKGVycik7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsVW5rbm93bigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jcmVhdGVNb3VzZVRhcmdldChjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBIaXRUZXN0UmVxdWVzdCk6IElNb3VzZVRhcmdldCB7XG5cblx0XHQvLyBjb25zb2xlLmxvZyhgJHtkb21IaXRUZXN0RXhlY3V0ZWQgPyAnPT4nIDogJyd9Q0FNRSBJTiBSRVFVRVNUOiAke3JlcXVlc3R9YCk7XG5cblx0XHRpZiAocmVxdWVzdC50YXJnZXQgPT09IG51bGwpIHtcblx0XHRcdC8vIE5vIHRhcmdldFxuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbFVua25vd24oKTtcblx0XHR9XG5cblx0XHQvLyB3ZSBrbm93IGZvciBhIGZhY3QgdGhhdCByZXF1ZXN0LnRhcmdldCBpcyBub3QgbnVsbFxuXHRcdGNvbnN0IHJlc29sdmVkUmVxdWVzdCA9IDxSZXNvbHZlZEhpdFRlc3RSZXF1ZXN0PnJlcXVlc3Q7XG5cblx0XHRsZXQgcmVzdWx0OiBJTW91c2VUYXJnZXQgfCBudWxsID0gbnVsbDtcblxuXHRcdGlmICghRWxlbWVudFBhdGguaXNDaGlsZE9mT3ZlcmZsb3dHdWFyZChyZXF1ZXN0LnRhcmdldFBhdGgpICYmICFFbGVtZW50UGF0aC5pc0NoaWxkT2ZPdmVyZmxvd2luZ0NvbnRlbnRXaWRnZXRzKHJlcXVlc3QudGFyZ2V0UGF0aCkgJiYgIUVsZW1lbnRQYXRoLmlzQ2hpbGRPZk92ZXJmbG93aW5nT3ZlcmxheVdpZGdldHMocmVxdWVzdC50YXJnZXRQYXRoKSkge1xuXHRcdFx0Ly8gV2Ugb25seSByZW5kZXIgZG9tIG5vZGVzIGluc2lkZSB0aGUgb3ZlcmZsb3cgZ3VhcmQgb3IgaW4gdGhlIG92ZXJmbG93aW5nIGNvbnRlbnQgd2lkZ2V0c1xuXHRcdFx0cmVzdWx0ID0gcmVzdWx0IHx8IHJlcXVlc3QuZnVsZmlsbFVua25vd24oKTtcblx0XHR9XG5cblx0XHRyZXN1bHQgPSByZXN1bHQgfHwgTW91c2VUYXJnZXRGYWN0b3J5Ll9oaXRUZXN0Q29udGVudFdpZGdldChjdHgsIHJlc29sdmVkUmVxdWVzdCk7XG5cdFx0cmVzdWx0ID0gcmVzdWx0IHx8IE1vdXNlVGFyZ2V0RmFjdG9yeS5faGl0VGVzdE92ZXJsYXlXaWRnZXQoY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBNb3VzZVRhcmdldEZhY3RvcnkuX2hpdFRlc3RNaW5pbWFwKGN0eCwgcmVzb2x2ZWRSZXF1ZXN0KTtcblx0XHRyZXN1bHQgPSByZXN1bHQgfHwgTW91c2VUYXJnZXRGYWN0b3J5Ll9oaXRUZXN0U2Nyb2xsYmFyU2xpZGVyKGN0eCwgcmVzb2x2ZWRSZXF1ZXN0KTtcblx0XHRyZXN1bHQgPSByZXN1bHQgfHwgTW91c2VUYXJnZXRGYWN0b3J5Ll9oaXRUZXN0Vmlld1pvbmUoY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBNb3VzZVRhcmdldEZhY3RvcnkuX2hpdFRlc3RNYXJnaW4oY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBNb3VzZVRhcmdldEZhY3RvcnkuX2hpdFRlc3RWaWV3Q3Vyc29yKGN0eCwgcmVzb2x2ZWRSZXF1ZXN0KTtcblx0XHRyZXN1bHQgPSByZXN1bHQgfHwgTW91c2VUYXJnZXRGYWN0b3J5Ll9oaXRUZXN0VGV4dEFyZWEoY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBNb3VzZVRhcmdldEZhY3RvcnkuX2hpdFRlc3RWaWV3TGluZXMoY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXHRcdHJlc3VsdCA9IHJlc3VsdCB8fCBNb3VzZVRhcmdldEZhY3RvcnkuX2hpdFRlc3RTY3JvbGxiYXIoY3R4LCByZXNvbHZlZFJlcXVlc3QpO1xuXG5cdFx0cmV0dXJuIChyZXN1bHQgfHwgcmVxdWVzdC5mdWxmaWxsVW5rbm93bigpKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9oaXRUZXN0Q29udGVudFdpZGdldChjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBSZXNvbHZlZEhpdFRlc3RSZXF1ZXN0KTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0Ly8gSXMgaXQgYSBjb250ZW50IHdpZGdldD9cblx0XHRpZiAoRWxlbWVudFBhdGguaXNDaGlsZE9mQ29udGVudFdpZGdldHMocmVxdWVzdC50YXJnZXRQYXRoKSB8fCBFbGVtZW50UGF0aC5pc0NoaWxkT2ZPdmVyZmxvd2luZ0NvbnRlbnRXaWRnZXRzKHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGNvbnN0IHdpZGdldElkID0gY3R4LmZpbmRBdHRyaWJ1dGUocmVxdWVzdC50YXJnZXQsICd3aWRnZXRJZCcpO1xuXHRcdFx0aWYgKHdpZGdldElkKSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50V2lkZ2V0KHdpZGdldElkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxVbmtub3duKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hpdFRlc3RPdmVybGF5V2lkZ2V0KGN0eDogSGl0VGVzdENvbnRleHQsIHJlcXVlc3Q6IFJlc29sdmVkSGl0VGVzdFJlcXVlc3QpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblx0XHQvLyBJcyBpdCBhbiBvdmVybGF5IHdpZGdldD9cblx0XHRpZiAoRWxlbWVudFBhdGguaXNDaGlsZE9mT3ZlcmxheVdpZGdldHMocmVxdWVzdC50YXJnZXRQYXRoKSB8fCBFbGVtZW50UGF0aC5pc0NoaWxkT2ZPdmVyZmxvd2luZ092ZXJsYXlXaWRnZXRzKHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGNvbnN0IHdpZGdldElkID0gY3R4LmZpbmRBdHRyaWJ1dGUocmVxdWVzdC50YXJnZXQsICd3aWRnZXRJZCcpO1xuXHRcdFx0aWYgKHdpZGdldElkKSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxPdmVybGF5V2lkZ2V0KHdpZGdldElkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxVbmtub3duKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hpdFRlc3RWaWV3Q3Vyc29yKGN0eDogSGl0VGVzdENvbnRleHQsIHJlcXVlc3Q6IFJlc29sdmVkSGl0VGVzdFJlcXVlc3QpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblxuXHRcdGlmIChyZXF1ZXN0LnRhcmdldCkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgd2UndmUgaGl0IGEgcGFpbnRlZCBjdXJzb3Jcblx0XHRcdGNvbnN0IGxhc3RWaWV3Q3Vyc29yc1JlbmRlckRhdGEgPSBjdHgubGFzdFJlbmRlckRhdGEubGFzdFZpZXdDdXJzb3JzUmVuZGVyRGF0YTtcblxuXHRcdFx0Zm9yIChjb25zdCBkIG9mIGxhc3RWaWV3Q3Vyc29yc1JlbmRlckRhdGEpIHtcblxuXHRcdFx0XHRpZiAocmVxdWVzdC50YXJnZXQgPT09IGQuZG9tTm9kZSkge1xuXHRcdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50VGV4dChkLnBvc2l0aW9uLCBudWxsLCB7IG1pZ2h0QmVGb3JlaWduRWxlbWVudDogZmFsc2UsIGluamVjdGVkVGV4dDogbnVsbCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChyZXF1ZXN0LmlzSW5Db250ZW50QXJlYSkge1xuXHRcdFx0Ly8gRWRnZSBoYXMgYSBidWcgd2hlbiBoaXQtdGVzdGluZyB0aGUgZXhhY3QgcG9zaXRpb24gb2YgYSBjdXJzb3IsXG5cdFx0XHQvLyBpbnN0ZWFkIG9mIHJldHVybmluZyB0aGUgY29ycmVjdCBkb20gbm9kZSwgaXQgcmV0dXJucyB0aGVcblx0XHRcdC8vIGZpcnN0IG9yIGxhc3QgcmVuZGVyZWQgdmlldyBsaW5lIGRvbSBub2RlLCB0aGVyZWZvcmUgaGVscCBpdCBvdXRcblx0XHRcdC8vIGFuZCBmaXJzdCBjaGVjayBpZiB3ZSBhcmUgb24gdG9wIG9mIGEgY3Vyc29yXG5cblx0XHRcdGNvbnN0IGxhc3RWaWV3Q3Vyc29yc1JlbmRlckRhdGEgPSBjdHgubGFzdFJlbmRlckRhdGEubGFzdFZpZXdDdXJzb3JzUmVuZGVyRGF0YTtcblx0XHRcdGNvbnN0IG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQgPSByZXF1ZXN0Lm1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQ7XG5cdFx0XHRjb25zdCBtb3VzZVZlcnRpY2FsT2Zmc2V0ID0gcmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0O1xuXG5cdFx0XHRmb3IgKGNvbnN0IGQgb2YgbGFzdFZpZXdDdXJzb3JzUmVuZGVyRGF0YSkge1xuXG5cdFx0XHRcdGlmIChtb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IDwgZC5jb250ZW50TGVmdCkge1xuXHRcdFx0XHRcdC8vIG1vdXNlIHBvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mIHRoZSBjdXJzb3Jcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCA+IGQuY29udGVudExlZnQgKyBkLndpZHRoKSB7XG5cdFx0XHRcdFx0Ly8gbW91c2UgcG9zaXRpb24gaXMgdG8gdGhlIHJpZ2h0IG9mIHRoZSBjdXJzb3Jcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGN1cnNvclZlcnRpY2FsT2Zmc2V0ID0gY3R4LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihkLnBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRjdXJzb3JWZXJ0aWNhbE9mZnNldCA8PSBtb3VzZVZlcnRpY2FsT2Zmc2V0XG5cdFx0XHRcdFx0JiYgbW91c2VWZXJ0aWNhbE9mZnNldCA8PSBjdXJzb3JWZXJ0aWNhbE9mZnNldCArIGQuaGVpZ2h0XG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50VGV4dChkLnBvc2l0aW9uLCBudWxsLCB7IG1pZ2h0QmVGb3JlaWduRWxlbWVudDogZmFsc2UsIGluamVjdGVkVGV4dDogbnVsbCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hpdFRlc3RWaWV3Wm9uZShjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBSZXNvbHZlZEhpdFRlc3RSZXF1ZXN0KTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0Y29uc3Qgdmlld1pvbmVEYXRhID0gY3R4LmdldFpvbmVBdENvb3JkKHJlcXVlc3QubW91c2VWZXJ0aWNhbE9mZnNldCk7XG5cdFx0aWYgKHZpZXdab25lRGF0YSkge1xuXHRcdFx0Y29uc3QgbW91c2VUYXJnZXRUeXBlID0gKHJlcXVlc3QuaXNJbkNvbnRlbnRBcmVhID8gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVklFV19aT05FIDogTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9WSUVXX1pPTkUpO1xuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbFZpZXdab25lKG1vdXNlVGFyZ2V0VHlwZSwgdmlld1pvbmVEYXRhLnBvc2l0aW9uLCB2aWV3Wm9uZURhdGEpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hpdFRlc3RUZXh0QXJlYShjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBSZXNvbHZlZEhpdFRlc3RSZXF1ZXN0KTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0Ly8gSXMgaXQgdGhlIHRleHRhcmVhP1xuXHRcdGlmIChFbGVtZW50UGF0aC5pc1RleHRBcmVhKHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGlmIChjdHgubGFzdFJlbmRlckRhdGEubGFzdFRleHRhcmVhUG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRUZXh0KGN0eC5sYXN0UmVuZGVyRGF0YS5sYXN0VGV4dGFyZWFQb3NpdGlvbiwgbnVsbCwgeyBtaWdodEJlRm9yZWlnbkVsZW1lbnQ6IGZhbHNlLCBpbmplY3RlZFRleHQ6IG51bGwgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsVGV4dGFyZWEoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfaGl0VGVzdE1hcmdpbihjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBSZXNvbHZlZEhpdFRlc3RSZXF1ZXN0KTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0aWYgKHJlcXVlc3QuaXNJbk1hcmdpbkFyZWEpIHtcblx0XHRcdGNvbnN0IHJlcyA9IGN0eC5nZXRGdWxsTGluZVJhbmdlQXRDb29yZChyZXF1ZXN0Lm1vdXNlVmVydGljYWxPZmZzZXQpO1xuXHRcdFx0Y29uc3QgcG9zID0gcmVzLnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdGxldCBvZmZzZXQgPSBNYXRoLmFicyhyZXF1ZXN0LnJlbGF0aXZlUG9zLngpO1xuXHRcdFx0Y29uc3QgZGV0YWlsOiBNdXRhYmxlPElNb3VzZVRhcmdldE1hcmdpbkRhdGE+ID0ge1xuXHRcdFx0XHRpc0FmdGVyTGluZXM6IHJlcy5pc0FmdGVyTGluZXMsXG5cdFx0XHRcdGdseXBoTWFyZ2luTGVmdDogY3R4LmxheW91dEluZm8uZ2x5cGhNYXJnaW5MZWZ0LFxuXHRcdFx0XHRnbHlwaE1hcmdpbldpZHRoOiBjdHgubGF5b3V0SW5mby5nbHlwaE1hcmdpbldpZHRoLFxuXHRcdFx0XHRsaW5lTnVtYmVyc1dpZHRoOiBjdHgubGF5b3V0SW5mby5saW5lTnVtYmVyc1dpZHRoLFxuXHRcdFx0XHRvZmZzZXRYOiBvZmZzZXRcblx0XHRcdH07XG5cblx0XHRcdG9mZnNldCAtPSBjdHgubGF5b3V0SW5mby5nbHlwaE1hcmdpbkxlZnQ7XG5cblx0XHRcdGlmIChvZmZzZXQgPD0gY3R4LmxheW91dEluZm8uZ2x5cGhNYXJnaW5XaWR0aCkge1xuXHRcdFx0XHQvLyBPbiB0aGUgZ2x5cGggbWFyZ2luXG5cdFx0XHRcdGNvbnN0IG1vZGVsQ29vcmRpbmF0ZSA9IGN0eC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbihyZXMucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdFx0Y29uc3QgbGFuZXMgPSBjdHgudmlld01vZGVsLmdseXBoTGFuZXMuZ2V0TGFuZXNBdExpbmUobW9kZWxDb29yZGluYXRlLmxpbmVOdW1iZXIpO1xuXHRcdFx0XHRkZXRhaWwuZ2x5cGhNYXJnaW5MYW5lID0gbGFuZXNbTWF0aC5mbG9vcihvZmZzZXQgLyBjdHgubGluZUhlaWdodCldO1xuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsTWFyZ2luKE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfR0xZUEhfTUFSR0lOLCBwb3MsIHJlcy5yYW5nZSwgZGV0YWlsKTtcblx0XHRcdH1cblx0XHRcdG9mZnNldCAtPSBjdHgubGF5b3V0SW5mby5nbHlwaE1hcmdpbldpZHRoO1xuXG5cdFx0XHRpZiAob2Zmc2V0IDw9IGN0eC5sYXlvdXRJbmZvLmxpbmVOdW1iZXJzV2lkdGgpIHtcblx0XHRcdFx0Ly8gT24gdGhlIGxpbmUgbnVtYmVyc1xuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsTWFyZ2luKE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9OVU1CRVJTLCBwb3MsIHJlcy5yYW5nZSwgZGV0YWlsKTtcblx0XHRcdH1cblx0XHRcdG9mZnNldCAtPSBjdHgubGF5b3V0SW5mby5saW5lTnVtYmVyc1dpZHRoO1xuXG5cdFx0XHQvLyBPbiB0aGUgbGluZSBkZWNvcmF0aW9uc1xuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbE1hcmdpbihNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0xJTkVfREVDT1JBVElPTlMsIHBvcywgcmVzLnJhbmdlLCBkZXRhaWwpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9oaXRUZXN0Vmlld0xpbmVzKGN0eDogSGl0VGVzdENvbnRleHQsIHJlcXVlc3Q6IFJlc29sdmVkSGl0VGVzdFJlcXVlc3QpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblx0XHRpZiAoIUVsZW1lbnRQYXRoLmlzQ2hpbGRPZlZpZXdMaW5lcyhyZXF1ZXN0LnRhcmdldFBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoY3R4LmlzSW5Ub3BQYWRkaW5nKHJlcXVlc3QubW91c2VWZXJ0aWNhbE9mZnNldCkpIHtcblx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50RW1wdHkobmV3IFBvc2l0aW9uKDEsIDEpLCBFTVBUWV9DT05URU5UX0FGVEVSX0xJTkVTKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiBpdCBpcyBiZWxvdyBhbnkgbGluZXMgYW5kIGFueSB2aWV3IHpvbmVzXG5cdFx0aWYgKGN0eC5pc0FmdGVyTGluZXMocmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0KSB8fCBjdHguaXNJbkJvdHRvbVBhZGRpbmcocmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0KSkge1xuXHRcdFx0Ly8gVGhpcyBtb3N0IGxpa2VseSBpbmRpY2F0ZXMgaXQgaGFwcGVuZWQgYWZ0ZXIgdGhlIGxhc3Qgdmlldy1saW5lXG5cdFx0XHRjb25zdCBsaW5lQ291bnQgPSBjdHgudmlld01vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0Y29uc3QgbWF4TGluZUNvbHVtbiA9IGN0eC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lQ291bnQpO1xuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRFbXB0eShuZXcgUG9zaXRpb24obGluZUNvdW50LCBtYXhMaW5lQ29sdW1uKSwgRU1QVFlfQ09OVEVOVF9BRlRFUl9MSU5FUyk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgd2UgYXJlIGhpdHRpbmcgYSB2aWV3LWxpbmUgKGNhbiBoYXBwZW4gaW4gdGhlIGNhc2Ugb2YgaW5saW5lIGRlY29yYXRpb25zIG9uIGVtcHR5IGxpbmVzKVxuXHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDY5NDJcblx0XHRpZiAoRWxlbWVudFBhdGguaXNTdHJpY3RDaGlsZE9mVmlld0xpbmVzKHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBjdHguZ2V0TGluZU51bWJlckF0VmVydGljYWxPZmZzZXQocmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblx0XHRcdGlmIChjdHgudmlld01vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcikgPT09IDApIHtcblx0XHRcdFx0Y29uc3QgbGluZVdpZHRoID0gY3R4LmdldExpbmVXaWR0aChsaW5lTnVtYmVyKTtcblx0XHRcdFx0Y29uc3QgZGV0YWlsID0gY3JlYXRlRW1wdHlDb250ZW50RGF0YUluTGluZXMocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IC0gbGluZVdpZHRoKTtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRFbXB0eShuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSksIGRldGFpbCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVXaWR0aCA9IGN0eC5nZXRMaW5lV2lkdGgobGluZU51bWJlcik7XG5cdFx0XHRpZiAocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0ID49IGxpbmVXaWR0aCkge1xuXHRcdFx0XHQvLyBUT0RPOiBUaGlzIGlzIHdyb25nIGZvciBSVExcblx0XHRcdFx0Y29uc3QgZGV0YWlsID0gY3JlYXRlRW1wdHlDb250ZW50RGF0YUluTGluZXMocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IC0gbGluZVdpZHRoKTtcblx0XHRcdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGN0eC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSk7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50RW1wdHkocG9zLCBkZXRhaWwpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoY3R4LnZpZXdMaW5lc0dwdSkge1xuXHRcdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gY3R4LmdldExpbmVOdW1iZXJBdFZlcnRpY2FsT2Zmc2V0KHJlcXVlc3QubW91c2VWZXJ0aWNhbE9mZnNldCk7XG5cdFx0XHRcdGlmIChjdHgudmlld01vZGVsLmdldExpbmVMZW5ndGgobGluZU51bWJlcikgPT09IDApIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lV2lkdGggPSBjdHguZ2V0TGluZVdpZHRoKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGNvbnN0IGRldGFpbCA9IGNyZWF0ZUVtcHR5Q29udGVudERhdGFJbkxpbmVzKHJlcXVlc3QubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCAtIGxpbmVXaWR0aCk7XG5cdFx0XHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRFbXB0eShuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSksIGRldGFpbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBsaW5lV2lkdGggPSBjdHguZ2V0TGluZVdpZHRoKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRpZiAocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0ID49IGxpbmVXaWR0aCkge1xuXHRcdFx0XHRcdC8vIFRPRE86IFRoaXMgaXMgd3JvbmcgZm9yIFJUTFxuXHRcdFx0XHRcdGNvbnN0IGRldGFpbCA9IGNyZWF0ZUVtcHR5Q29udGVudERhdGFJbkxpbmVzKHJlcXVlc3QubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCAtIGxpbmVXaWR0aCk7XG5cdFx0XHRcdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGN0eC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRFbXB0eShwb3MsIGRldGFpbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGN0eC52aWV3TGluZXNHcHUuZ2V0UG9zaXRpb25BdENvb3JkaW5hdGUobGluZU51bWJlciwgcmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0KTtcblx0XHRcdFx0aWYgKHBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGV0YWlsOiBJTW91c2VUYXJnZXRDb250ZW50VGV4dERhdGEgPSB7XG5cdFx0XHRcdFx0XHRpbmplY3RlZFRleHQ6IG51bGwsXG5cdFx0XHRcdFx0XHRtaWdodEJlRm9yZWlnbkVsZW1lbnQ6IGZhbHNlXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsQ29udGVudFRleHQocG9zaXRpb24sIEVkaXRvclJhbmdlLmZyb21Qb3NpdGlvbnMocG9zaXRpb24sIHBvc2l0aW9uKSwgZGV0YWlsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERvIHRoZSBoaXQgdGVzdCAoaWYgbm90IGFscmVhZHkgZG9uZSlcblx0XHRjb25zdCBoaXRUZXN0UmVzdWx0ID0gcmVxdWVzdC5oaXRUZXN0UmVzdWx0LnZhbHVlO1xuXG5cdFx0aWYgKGhpdFRlc3RSZXN1bHQudHlwZSA9PT0gSGl0VGVzdFJlc3VsdFR5cGUuQ29udGVudCkge1xuXHRcdFx0cmV0dXJuIE1vdXNlVGFyZ2V0RmFjdG9yeS5jcmVhdGVNb3VzZVRhcmdldEZyb21IaXRUZXN0UG9zaXRpb24oY3R4LCByZXF1ZXN0LCBoaXRUZXN0UmVzdWx0LnNwYW5Ob2RlLCBoaXRUZXN0UmVzdWx0LnBvc2l0aW9uLCBoaXRUZXN0UmVzdWx0LmluamVjdGVkVGV4dCk7XG5cdFx0fVxuXG5cdFx0Ly8gV2UgZGlkbid0IGhpdCBjb250ZW50Li4uXG5cdFx0aWYgKHJlcXVlc3Qud291bGRCZW5lZml0RnJvbUhpdFRlc3RUYXJnZXRTd2l0Y2gpIHtcblx0XHRcdC8vIFdlIGFjdHVhbGx5IGhpdCBzb21ldGhpbmcgZGlmZmVyZW50Li4uIEdpdmUgaXQgb25lIGxhc3QgY2hhbmdlIGJ5IHRyeWluZyBhZ2FpbiB3aXRoIHRoaXMgbmV3IHRhcmdldFxuXHRcdFx0cmVxdWVzdC5zd2l0Y2hUb0hpdFRlc3RUYXJnZXQoKTtcblx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVNb3VzZVRhcmdldChjdHgsIHJlcXVlc3QpO1xuXHRcdH1cblxuXHRcdC8vIFdlIGhhdmUgdHJpZWQgZXZlcnl0aGluZy4uLlxuXHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxVbmtub3duKCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfaGl0VGVzdE1pbmltYXAoY3R4OiBIaXRUZXN0Q29udGV4dCwgcmVxdWVzdDogUmVzb2x2ZWRIaXRUZXN0UmVxdWVzdCk6IElNb3VzZVRhcmdldCB8IG51bGwge1xuXHRcdGlmIChFbGVtZW50UGF0aC5pc0NoaWxkT2ZNaW5pbWFwKHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGNvbnN0IHBvc3NpYmxlTGluZU51bWJlciA9IGN0eC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldChyZXF1ZXN0Lm1vdXNlVmVydGljYWxPZmZzZXQpO1xuXHRcdFx0Y29uc3QgbWF4Q29sdW1uID0gY3R4LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc3NpYmxlTGluZU51bWJlcik7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsU2Nyb2xsYmFyKG5ldyBQb3NpdGlvbihwb3NzaWJsZUxpbmVOdW1iZXIsIG1heENvbHVtbikpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9oaXRUZXN0U2Nyb2xsYmFyU2xpZGVyKGN0eDogSGl0VGVzdENvbnRleHQsIHJlcXVlc3Q6IFJlc29sdmVkSGl0VGVzdFJlcXVlc3QpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblx0XHRpZiAoRWxlbWVudFBhdGguaXNDaGlsZE9mU2Nyb2xsYWJsZUVsZW1lbnQocmVxdWVzdC50YXJnZXRQYXRoKSkge1xuXHRcdFx0aWYgKHJlcXVlc3QudGFyZ2V0ICYmIHJlcXVlc3QudGFyZ2V0Lm5vZGVUeXBlID09PSAxKSB7XG5cdFx0XHRcdGNvbnN0IGNsYXNzTmFtZSA9IHJlcXVlc3QudGFyZ2V0LmNsYXNzTmFtZTtcblx0XHRcdFx0aWYgKGNsYXNzTmFtZSAmJiAvXFxiKHNsaWRlcnxzY3JvbGxiYXIpXFxiLy50ZXN0KGNsYXNzTmFtZSkpIHtcblx0XHRcdFx0XHRjb25zdCBwb3NzaWJsZUxpbmVOdW1iZXIgPSBjdHguZ2V0TGluZU51bWJlckF0VmVydGljYWxPZmZzZXQocmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblx0XHRcdFx0XHRjb25zdCBtYXhDb2x1bW4gPSBjdHgudmlld01vZGVsLmdldExpbmVNYXhDb2x1bW4ocG9zc2libGVMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsU2Nyb2xsYmFyKG5ldyBQb3NpdGlvbihwb3NzaWJsZUxpbmVOdW1iZXIsIG1heENvbHVtbikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hpdFRlc3RTY3JvbGxiYXIoY3R4OiBIaXRUZXN0Q29udGV4dCwgcmVxdWVzdDogUmVzb2x2ZWRIaXRUZXN0UmVxdWVzdCk6IElNb3VzZVRhcmdldCB8IG51bGwge1xuXHRcdC8vIElzIGl0IHRoZSBvdmVydmlldyBydWxlcj9cblx0XHQvLyBJcyBpdCBhIGNoaWxkIG9mIHRoZSBzY3JvbGxhYmxlIGVsZW1lbnQ/XG5cdFx0aWYgKEVsZW1lbnRQYXRoLmlzQ2hpbGRPZlNjcm9sbGFibGVFbGVtZW50KHJlcXVlc3QudGFyZ2V0UGF0aCkpIHtcblx0XHRcdGNvbnN0IHBvc3NpYmxlTGluZU51bWJlciA9IGN0eC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldChyZXF1ZXN0Lm1vdXNlVmVydGljYWxPZmZzZXQpO1xuXHRcdFx0Y29uc3QgbWF4Q29sdW1uID0gY3R4LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc3NpYmxlTGluZU51bWJlcik7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsU2Nyb2xsYmFyKG5ldyBQb3NpdGlvbihwb3NzaWJsZUxpbmVOdW1iZXIsIG1heENvbHVtbikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHVibGljIGdldE1vdXNlQ29sdW1uKHJlbGF0aXZlUG9zOiBDb29yZGluYXRlc1JlbGF0aXZlVG9FZGl0b3IpOiBudW1iZXIge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQgPSB0aGlzLl9jb250ZXh0LnZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbExlZnQoKSArIHJlbGF0aXZlUG9zLnggLSBsYXlvdXRJbmZvLmNvbnRlbnRMZWZ0O1xuXHRcdHJldHVybiBNb3VzZVRhcmdldEZhY3RvcnkuX2dldE1vdXNlQ29sdW1uKG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQsIG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbykudHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgX2dldE1vdXNlQ29sdW1uKG1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQ6IG51bWJlciwgdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmIChtb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IDwgMCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHRcdGNvbnN0IGNoYXJzID0gTWF0aC5yb3VuZChtb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IC8gdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHRyZXR1cm4gKGNoYXJzICsgMSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBjcmVhdGVNb3VzZVRhcmdldEZyb21IaXRUZXN0UG9zaXRpb24oY3R4OiBIaXRUZXN0Q29udGV4dCwgcmVxdWVzdDogSGl0VGVzdFJlcXVlc3QsIHNwYW5Ob2RlOiBIVE1MRWxlbWVudCwgcG9zOiBQb3NpdGlvbiwgaW5qZWN0ZWRUZXh0OiBJbmplY3RlZFRleHQgfCBudWxsKTogSU1vdXNlVGFyZ2V0IHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gcG9zLmxpbmVOdW1iZXI7XG5cdFx0Y29uc3QgY29sdW1uID0gcG9zLmNvbHVtbjtcblxuXHRcdGNvbnN0IGxpbmVXaWR0aCA9IGN0eC5nZXRMaW5lV2lkdGgobGluZU51bWJlcik7XG5cblx0XHRpZiAocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0ID4gbGluZVdpZHRoKSB7XG5cdFx0XHRjb25zdCBkZXRhaWwgPSBjcmVhdGVFbXB0eUNvbnRlbnREYXRhSW5MaW5lcyhyZXF1ZXN0Lm1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQgLSBsaW5lV2lkdGgpO1xuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbENvbnRlbnRFbXB0eShwb3MsIGRldGFpbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlID0gY3R4LnZpc2libGVSYW5nZUZvclBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cblx0XHRpZiAoIXZpc2libGVSYW5nZSkge1xuXHRcdFx0cmV0dXJuIHJlcXVlc3QuZnVsZmlsbFVua25vd24ocG9zKTtcblx0XHR9XG5cblx0XHRjb25zdCBjb2x1bW5Ib3Jpem9udGFsT2Zmc2V0ID0gdmlzaWJsZVJhbmdlLmxlZnQ7XG5cblx0XHRpZiAoTWF0aC5hYnMocmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IC0gY29sdW1uSG9yaXpvbnRhbE9mZnNldCkgPCAxKSB7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdC5mdWxmaWxsQ29udGVudFRleHQocG9zLCBudWxsLCB7IG1pZ2h0QmVGb3JlaWduRWxlbWVudDogISFpbmplY3RlZFRleHQsIGluamVjdGVkVGV4dCB9KTtcblx0XHR9XG5cblx0XHQvLyBMZXQncyBkZWZpbmUgYSwgYiwgYyBhbmQgY2hlY2sgaWYgdGhlIG9mZnNldCBpcyBpbiBiZXR3ZWVuIHRoZW0uLi5cblx0XHRpbnRlcmZhY2UgT2Zmc2V0Q29sdW1uIHsgb2Zmc2V0OiBudW1iZXI7IGNvbHVtbjogbnVtYmVyIH1cblxuXHRcdGNvbnN0IHBvaW50czogT2Zmc2V0Q29sdW1uW10gPSBbXTtcblx0XHRwb2ludHMucHVzaCh7IG9mZnNldDogdmlzaWJsZVJhbmdlLmxlZnQsIGNvbHVtbjogY29sdW1uIH0pO1xuXHRcdGlmIChjb2x1bW4gPiAxKSB7XG5cdFx0XHRjb25zdCB2aXNpYmxlUmFuZ2UgPSBjdHgudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uIC0gMSk7XG5cdFx0XHRpZiAodmlzaWJsZVJhbmdlKSB7XG5cdFx0XHRcdHBvaW50cy5wdXNoKHsgb2Zmc2V0OiB2aXNpYmxlUmFuZ2UubGVmdCwgY29sdW1uOiBjb2x1bW4gLSAxIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBsaW5lTWF4Q29sdW1uID0gY3R4LnZpZXdNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdGlmIChjb2x1bW4gPCBsaW5lTWF4Q29sdW1uKSB7XG5cdFx0XHRjb25zdCB2aXNpYmxlUmFuZ2UgPSBjdHgudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uICsgMSk7XG5cdFx0XHRpZiAodmlzaWJsZVJhbmdlKSB7XG5cdFx0XHRcdHBvaW50cy5wdXNoKHsgb2Zmc2V0OiB2aXNpYmxlUmFuZ2UubGVmdCwgY29sdW1uOiBjb2x1bW4gKyAxIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHBvaW50cy5zb3J0KChhLCBiKSA9PiBhLm9mZnNldCAtIGIub2Zmc2V0KTtcblxuXHRcdGNvbnN0IG1vdXNlQ29vcmRpbmF0ZXMgPSByZXF1ZXN0LnBvcy50b0NsaWVudENvb3JkaW5hdGVzKGRvbS5nZXRXaW5kb3coY3R4LnZpZXdEb21Ob2RlKSk7XG5cdFx0Y29uc3Qgc3Bhbk5vZGVDbGllbnRSZWN0ID0gc3Bhbk5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3QgbW91c2VJc092ZXJTcGFuTm9kZSA9IChzcGFuTm9kZUNsaWVudFJlY3QubGVmdCA8PSBtb3VzZUNvb3JkaW5hdGVzLmNsaWVudFggJiYgbW91c2VDb29yZGluYXRlcy5jbGllbnRYIDw9IHNwYW5Ob2RlQ2xpZW50UmVjdC5yaWdodCk7XG5cblx0XHRsZXQgcm5nOiBFZGl0b3JSYW5nZSB8IG51bGwgPSBudWxsO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHByZXYgPSBwb2ludHNbaSAtIDFdO1xuXHRcdFx0Y29uc3QgY3VyciA9IHBvaW50c1tpXTtcblx0XHRcdGlmIChwcmV2Lm9mZnNldCA8PSByZXF1ZXN0Lm1vdXNlQ29udGVudEhvcml6b250YWxPZmZzZXQgJiYgcmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0IDw9IGN1cnIub2Zmc2V0KSB7XG5cdFx0XHRcdHJuZyA9IG5ldyBFZGl0b3JSYW5nZShsaW5lTnVtYmVyLCBwcmV2LmNvbHVtbiwgbGluZU51bWJlciwgY3Vyci5jb2x1bW4pO1xuXG5cdFx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTUyODE5XG5cdFx0XHRcdC8vIER1ZSB0byB0aGUgdXNlIG9mIHp3aiwgdGhlIGJyb3dzZXIncyBoaXQgdGVzdCByZXN1bHQgaXMgc2tld2VkIHRvd2FyZHMgdGhlIGxlZnRcblx0XHRcdFx0Ly8gSGVyZSB3ZSB0cnkgdG8gY29ycmVjdCB0aGF0IGlmIHRoZSBtb3VzZSBob3Jpem9udGFsIG9mZnNldCBpcyBjbG9zZXIgdG8gdGhlIHJpZ2h0IHRoYW4gdGhlIGxlZnRcblxuXHRcdFx0XHRjb25zdCBwcmV2RGVsdGEgPSBNYXRoLmFicyhwcmV2Lm9mZnNldCAtIHJlcXVlc3QubW91c2VDb250ZW50SG9yaXpvbnRhbE9mZnNldCk7XG5cdFx0XHRcdGNvbnN0IG5leHREZWx0YSA9IE1hdGguYWJzKGN1cnIub2Zmc2V0IC0gcmVxdWVzdC5tb3VzZUNvbnRlbnRIb3Jpem9udGFsT2Zmc2V0KTtcblxuXHRcdFx0XHRwb3MgPSAoXG5cdFx0XHRcdFx0cHJldkRlbHRhIDwgbmV4dERlbHRhXG5cdFx0XHRcdFx0XHQ/IG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBwcmV2LmNvbHVtbilcblx0XHRcdFx0XHRcdDogbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGN1cnIuY29sdW1uKVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXF1ZXN0LmZ1bGZpbGxDb250ZW50VGV4dChwb3MsIHJuZywgeyBtaWdodEJlRm9yZWlnbkVsZW1lbnQ6ICFtb3VzZUlzT3ZlclNwYW5Ob2RlIHx8ICEhaW5qZWN0ZWRUZXh0LCBpbmplY3RlZFRleHQgfSk7XG5cdH1cblxuXHQvKipcblx0ICogTW9zdCBwcm9iYWJseSBXZWJLaXQgYnJvd3NlcnMgYW5kIEVkZ2Vcblx0ICovXG5cdHByaXZhdGUgc3RhdGljIF9kb0hpdFRlc3RXaXRoQ2FyZXRSYW5nZUZyb21Qb2ludChjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBCYXJlSGl0VGVzdFJlcXVlc3QpOiBIaXRUZXN0UmVzdWx0IHtcblxuXHRcdC8vIEluIENocm9tZSwgZXNwZWNpYWxseSBvbiBMaW51eCBpdCBpcyBwb3NzaWJsZSB0byBjbGljayBiZXR3ZWVuIGxpbmVzLFxuXHRcdC8vIHNvIHRyeSB0byBhZGp1c3QgdGhlIGBoaXR5YCBiZWxvdyBzbyB0aGF0IGl0IGxhbmRzIGluIHRoZSBjZW50ZXIgb2YgYSBsaW5lXG5cdFx0Y29uc3QgbGluZU51bWJlciA9IGN0eC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldChyZXF1ZXN0Lm1vdXNlVmVydGljYWxPZmZzZXQpO1xuXHRcdGNvbnN0IGxpbmVTdGFydFZlcnRpY2FsT2Zmc2V0ID0gY3R4LmdldFZlcnRpY2FsT2Zmc2V0Rm9yTGluZU51bWJlcihsaW5lTnVtYmVyKTtcblx0XHRjb25zdCBsaW5lRW5kVmVydGljYWxPZmZzZXQgPSBsaW5lU3RhcnRWZXJ0aWNhbE9mZnNldCArIGN0eC5saW5lSGVpZ2h0O1xuXG5cdFx0Y29uc3QgaXNCZWxvd0xhc3RMaW5lID0gKFxuXHRcdFx0bGluZU51bWJlciA9PT0gY3R4LnZpZXdNb2RlbC5nZXRMaW5lQ291bnQoKVxuXHRcdFx0JiYgcmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0ID4gbGluZUVuZFZlcnRpY2FsT2Zmc2V0XG5cdFx0KTtcblxuXHRcdGlmICghaXNCZWxvd0xhc3RMaW5lKSB7XG5cdFx0XHRjb25zdCBsaW5lQ2VudGVyZWRWZXJ0aWNhbE9mZnNldCA9IE1hdGguZmxvb3IoKGxpbmVTdGFydFZlcnRpY2FsT2Zmc2V0ICsgbGluZUVuZFZlcnRpY2FsT2Zmc2V0KSAvIDIpO1xuXHRcdFx0bGV0IGFkanVzdGVkUGFnZVkgPSByZXF1ZXN0LnBvcy55ICsgKGxpbmVDZW50ZXJlZFZlcnRpY2FsT2Zmc2V0IC0gcmVxdWVzdC5tb3VzZVZlcnRpY2FsT2Zmc2V0KTtcblxuXHRcdFx0aWYgKGFkanVzdGVkUGFnZVkgPD0gcmVxdWVzdC5lZGl0b3JQb3MueSkge1xuXHRcdFx0XHRhZGp1c3RlZFBhZ2VZID0gcmVxdWVzdC5lZGl0b3JQb3MueSArIDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWRqdXN0ZWRQYWdlWSA+PSByZXF1ZXN0LmVkaXRvclBvcy55ICsgcmVxdWVzdC5lZGl0b3JQb3MuaGVpZ2h0KSB7XG5cdFx0XHRcdGFkanVzdGVkUGFnZVkgPSByZXF1ZXN0LmVkaXRvclBvcy55ICsgcmVxdWVzdC5lZGl0b3JQb3MuaGVpZ2h0IC0gMTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWRqdXN0ZWRQYWdlID0gbmV3IFBhZ2VDb29yZGluYXRlcyhyZXF1ZXN0LnBvcy54LCBhZGp1c3RlZFBhZ2VZKTtcblxuXHRcdFx0Y29uc3QgciA9IHRoaXMuX2FjdHVhbERvSGl0VGVzdFdpdGhDYXJldFJhbmdlRnJvbVBvaW50KGN0eCwgYWRqdXN0ZWRQYWdlLnRvQ2xpZW50Q29vcmRpbmF0ZXMoZG9tLmdldFdpbmRvdyhjdHgudmlld0RvbU5vZGUpKSk7XG5cdFx0XHRpZiAoci50eXBlID09PSBIaXRUZXN0UmVzdWx0VHlwZS5Db250ZW50KSB7XG5cdFx0XHRcdHJldHVybiByO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFsc28gdHJ5IHRvIGhpdCB0ZXN0IHdpdGhvdXQgdGhlIGFkanVzdG1lbnQgKGZvciB0aGUgZWRnZSBjYXNlcyB0aGF0IHdlIGFyZSBuZWFyIHRoZSB0b3Agb3IgYm90dG9tKVxuXHRcdHJldHVybiB0aGlzLl9hY3R1YWxEb0hpdFRlc3RXaXRoQ2FyZXRSYW5nZUZyb21Qb2ludChjdHgsIHJlcXVlc3QucG9zLnRvQ2xpZW50Q29vcmRpbmF0ZXMoZG9tLmdldFdpbmRvdyhjdHgudmlld0RvbU5vZGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYWN0dWFsRG9IaXRUZXN0V2l0aENhcmV0UmFuZ2VGcm9tUG9pbnQoY3R4OiBIaXRUZXN0Q29udGV4dCwgY29vcmRzOiBDbGllbnRDb29yZGluYXRlcyk6IEhpdFRlc3RSZXN1bHQge1xuXHRcdGNvbnN0IHNoYWRvd1Jvb3QgPSBkb20uZ2V0U2hhZG93Um9vdChjdHgudmlld0RvbU5vZGUpO1xuXHRcdGxldCByYW5nZTogUmFuZ2U7XG5cdFx0aWYgKHNoYWRvd1Jvb3QpIHtcblx0XHRcdGlmICh0eXBlb2YgKDxhbnk+c2hhZG93Um9vdCkuY2FyZXRSYW5nZUZyb21Qb2ludCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0cmFuZ2UgPSBzaGFkb3dDYXJldFJhbmdlRnJvbVBvaW50KHNoYWRvd1Jvb3QsIGNvb3Jkcy5jbGllbnRYLCBjb29yZHMuY2xpZW50WSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyYW5nZSA9ICg8YW55PnNoYWRvd1Jvb3QpLmNhcmV0UmFuZ2VGcm9tUG9pbnQoY29vcmRzLmNsaWVudFgsIGNvb3Jkcy5jbGllbnRZKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmFuZ2UgPSAoPGFueT5jdHgudmlld0RvbU5vZGUub3duZXJEb2N1bWVudCkuY2FyZXRSYW5nZUZyb21Qb2ludChjb29yZHMuY2xpZW50WCwgY29vcmRzLmNsaWVudFkpO1xuXHRcdH1cblxuXHRcdGlmICghcmFuZ2UgfHwgIXJhbmdlLnN0YXJ0Q29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFVua25vd25IaXRUZXN0UmVzdWx0KCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hyb21lIGFsd2F5cyBoaXRzIGEgVEVYVF9OT0RFLCB3aGlsZSBFZGdlIHNvbWV0aW1lcyBoaXRzIGEgdG9rZW4gc3BhblxuXHRcdGNvbnN0IHN0YXJ0Q29udGFpbmVyID0gcmFuZ2Uuc3RhcnRDb250YWluZXI7XG5cblx0XHRpZiAoc3RhcnRDb250YWluZXIubm9kZVR5cGUgPT09IHN0YXJ0Q29udGFpbmVyLlRFWFRfTk9ERSkge1xuXHRcdFx0Ly8gc3RhcnRDb250YWluZXIgaXMgZXhwZWN0ZWQgdG8gYmUgdGhlIHRva2VuIHRleHRcblx0XHRcdGNvbnN0IHBhcmVudDEgPSBzdGFydENvbnRhaW5lci5wYXJlbnROb2RlOyAvLyBleHBlY3RlZCB0byBiZSB0aGUgdG9rZW4gc3BhblxuXHRcdFx0Y29uc3QgcGFyZW50MiA9IHBhcmVudDEgPyBwYXJlbnQxLnBhcmVudE5vZGUgOiBudWxsOyAvLyBleHBlY3RlZCB0byBiZSB0aGUgdmlldyBsaW5lIGNvbnRhaW5lciBzcGFuXG5cdFx0XHRjb25zdCBwYXJlbnQzID0gcGFyZW50MiA/IHBhcmVudDIucGFyZW50Tm9kZSA6IG51bGw7IC8vIGV4cGVjdGVkIHRvIGJlIHRoZSB2aWV3IGxpbmUgZGl2XG5cdFx0XHRjb25zdCBwYXJlbnQzQ2xhc3NOYW1lID0gcGFyZW50MyAmJiBwYXJlbnQzLm5vZGVUeXBlID09PSBwYXJlbnQzLkVMRU1FTlRfTk9ERSA/ICg8SFRNTEVsZW1lbnQ+cGFyZW50MykuY2xhc3NOYW1lIDogbnVsbDtcblxuXHRcdFx0aWYgKHBhcmVudDNDbGFzc05hbWUgPT09IFZpZXdMaW5lLkNMQVNTX05BTUUpIHtcblx0XHRcdFx0cmV0dXJuIEhpdFRlc3RSZXN1bHQuY3JlYXRlRnJvbURPTUluZm8oY3R4LCA8SFRNTEVsZW1lbnQ+cGFyZW50MSwgcmFuZ2Uuc3RhcnRPZmZzZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBVbmtub3duSGl0VGVzdFJlc3VsdCg8SFRNTEVsZW1lbnQ+c3RhcnRDb250YWluZXIucGFyZW50Tm9kZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChzdGFydENvbnRhaW5lci5ub2RlVHlwZSA9PT0gc3RhcnRDb250YWluZXIuRUxFTUVOVF9OT0RFKSB7XG5cdFx0XHQvLyBzdGFydENvbnRhaW5lciBpcyBleHBlY3RlZCB0byBiZSB0aGUgdG9rZW4gc3BhblxuXHRcdFx0Y29uc3QgcGFyZW50MSA9IHN0YXJ0Q29udGFpbmVyLnBhcmVudE5vZGU7IC8vIGV4cGVjdGVkIHRvIGJlIHRoZSB2aWV3IGxpbmUgY29udGFpbmVyIHNwYW5cblx0XHRcdGNvbnN0IHBhcmVudDIgPSBwYXJlbnQxID8gcGFyZW50MS5wYXJlbnROb2RlIDogbnVsbDsgLy8gZXhwZWN0ZWQgdG8gYmUgdGhlIHZpZXcgbGluZSBkaXZcblx0XHRcdGNvbnN0IHBhcmVudDJDbGFzc05hbWUgPSBwYXJlbnQyICYmIHBhcmVudDIubm9kZVR5cGUgPT09IHBhcmVudDIuRUxFTUVOVF9OT0RFID8gKDxIVE1MRWxlbWVudD5wYXJlbnQyKS5jbGFzc05hbWUgOiBudWxsO1xuXG5cdFx0XHRpZiAocGFyZW50MkNsYXNzTmFtZSA9PT0gVmlld0xpbmUuQ0xBU1NfTkFNRSkge1xuXHRcdFx0XHRyZXR1cm4gSGl0VGVzdFJlc3VsdC5jcmVhdGVGcm9tRE9NSW5mbyhjdHgsIDxIVE1MRWxlbWVudD5zdGFydENvbnRhaW5lciwgKDxIVE1MRWxlbWVudD5zdGFydENvbnRhaW5lcikudGV4dENvbnRlbnQhLmxlbmd0aCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFVua25vd25IaXRUZXN0UmVzdWx0KDxIVE1MRWxlbWVudD5zdGFydENvbnRhaW5lcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBVbmtub3duSGl0VGVzdFJlc3VsdCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1vc3QgcHJvYmFibHkgR2Vja29cblx0ICovXG5cdHByaXZhdGUgc3RhdGljIF9kb0hpdFRlc3RXaXRoQ2FyZXRQb3NpdGlvbkZyb21Qb2ludChjdHg6IEhpdFRlc3RDb250ZXh0LCBjb29yZHM6IENsaWVudENvb3JkaW5hdGVzKTogSGl0VGVzdFJlc3VsdCB7XG5cdFx0Y29uc3QgaGl0UmVzdWx0OiB7IG9mZnNldE5vZGU6IE5vZGU7IG9mZnNldDogbnVtYmVyIH0gPSAoPGFueT5jdHgudmlld0RvbU5vZGUub3duZXJEb2N1bWVudCkuY2FyZXRQb3NpdGlvbkZyb21Qb2ludChjb29yZHMuY2xpZW50WCwgY29vcmRzLmNsaWVudFkpO1xuXG5cdFx0aWYgKGhpdFJlc3VsdC5vZmZzZXROb2RlLm5vZGVUeXBlID09PSBoaXRSZXN1bHQub2Zmc2V0Tm9kZS5URVhUX05PREUpIHtcblx0XHRcdC8vIG9mZnNldE5vZGUgaXMgZXhwZWN0ZWQgdG8gYmUgdGhlIHRva2VuIHRleHRcblx0XHRcdGNvbnN0IHBhcmVudDEgPSBoaXRSZXN1bHQub2Zmc2V0Tm9kZS5wYXJlbnROb2RlOyAvLyBleHBlY3RlZCB0byBiZSB0aGUgdG9rZW4gc3BhblxuXHRcdFx0Y29uc3QgcGFyZW50MiA9IHBhcmVudDEgPyBwYXJlbnQxLnBhcmVudE5vZGUgOiBudWxsOyAvLyBleHBlY3RlZCB0byBiZSB0aGUgdmlldyBsaW5lIGNvbnRhaW5lciBzcGFuXG5cdFx0XHRjb25zdCBwYXJlbnQzID0gcGFyZW50MiA/IHBhcmVudDIucGFyZW50Tm9kZSA6IG51bGw7IC8vIGV4cGVjdGVkIHRvIGJlIHRoZSB2aWV3IGxpbmUgZGl2XG5cdFx0XHRjb25zdCBwYXJlbnQzQ2xhc3NOYW1lID0gcGFyZW50MyAmJiBwYXJlbnQzLm5vZGVUeXBlID09PSBwYXJlbnQzLkVMRU1FTlRfTk9ERSA/ICg8SFRNTEVsZW1lbnQ+cGFyZW50MykuY2xhc3NOYW1lIDogbnVsbDtcblxuXHRcdFx0aWYgKHBhcmVudDNDbGFzc05hbWUgPT09IFZpZXdMaW5lLkNMQVNTX05BTUUpIHtcblx0XHRcdFx0cmV0dXJuIEhpdFRlc3RSZXN1bHQuY3JlYXRlRnJvbURPTUluZm8oY3R4LCA8SFRNTEVsZW1lbnQ+aGl0UmVzdWx0Lm9mZnNldE5vZGUucGFyZW50Tm9kZSwgaGl0UmVzdWx0Lm9mZnNldCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFVua25vd25IaXRUZXN0UmVzdWx0KDxIVE1MRWxlbWVudD5oaXRSZXN1bHQub2Zmc2V0Tm9kZS5wYXJlbnROb2RlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGb3IgaW5saW5lIGRlY29yYXRpb25zLCBHZWNrbyBzb21ldGltZXMgcmV0dXJucyB0aGUgYDxzcGFuPmAgb2YgdGhlIGxpbmUgYW5kIHRoZSBvZmZzZXQgaXMgdGhlIGA8c3Bhbj5gIHdpdGggdGhlIGlubGluZSBkZWNvcmF0aW9uXG5cdFx0Ly8gU29tZSBvdGhlciB0aW1lcywgaXQgcmV0dXJucyB0aGUgYDxzcGFuPmAgd2l0aCB0aGUgaW5saW5lIGRlY29yYXRpb25cblx0XHRpZiAoaGl0UmVzdWx0Lm9mZnNldE5vZGUubm9kZVR5cGUgPT09IGhpdFJlc3VsdC5vZmZzZXROb2RlLkVMRU1FTlRfTk9ERSkge1xuXHRcdFx0Y29uc3QgcGFyZW50MSA9IGhpdFJlc3VsdC5vZmZzZXROb2RlLnBhcmVudE5vZGU7XG5cdFx0XHRjb25zdCBwYXJlbnQxQ2xhc3NOYW1lID0gcGFyZW50MSAmJiBwYXJlbnQxLm5vZGVUeXBlID09PSBwYXJlbnQxLkVMRU1FTlRfTk9ERSA/ICg8SFRNTEVsZW1lbnQ+cGFyZW50MSkuY2xhc3NOYW1lIDogbnVsbDtcblx0XHRcdGNvbnN0IHBhcmVudDIgPSBwYXJlbnQxID8gcGFyZW50MS5wYXJlbnROb2RlIDogbnVsbDtcblx0XHRcdGNvbnN0IHBhcmVudDJDbGFzc05hbWUgPSBwYXJlbnQyICYmIHBhcmVudDIubm9kZVR5cGUgPT09IHBhcmVudDIuRUxFTUVOVF9OT0RFID8gKDxIVE1MRWxlbWVudD5wYXJlbnQyKS5jbGFzc05hbWUgOiBudWxsO1xuXG5cdFx0XHRpZiAocGFyZW50MUNsYXNzTmFtZSA9PT0gVmlld0xpbmUuQ0xBU1NfTkFNRSkge1xuXHRcdFx0XHQvLyBpdCByZXR1cm5lZCB0aGUgYDxzcGFuPmAgb2YgdGhlIGxpbmUgYW5kIHRoZSBvZmZzZXQgaXMgdGhlIGA8c3Bhbj5gIHdpdGggdGhlIGlubGluZSBkZWNvcmF0aW9uXG5cdFx0XHRcdGNvbnN0IHRva2VuU3BhbiA9IGhpdFJlc3VsdC5vZmZzZXROb2RlLmNoaWxkTm9kZXNbTWF0aC5taW4oaGl0UmVzdWx0Lm9mZnNldCwgaGl0UmVzdWx0Lm9mZnNldE5vZGUuY2hpbGROb2Rlcy5sZW5ndGggLSAxKV07XG5cdFx0XHRcdGlmICh0b2tlblNwYW4pIHtcblx0XHRcdFx0XHRyZXR1cm4gSGl0VGVzdFJlc3VsdC5jcmVhdGVGcm9tRE9NSW5mbyhjdHgsIDxIVE1MRWxlbWVudD50b2tlblNwYW4sIDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHBhcmVudDJDbGFzc05hbWUgPT09IFZpZXdMaW5lLkNMQVNTX05BTUUpIHtcblx0XHRcdFx0Ly8gaXQgcmV0dXJuZWQgdGhlIGA8c3Bhbj5gIHdpdGggdGhlIGlubGluZSBkZWNvcmF0aW9uXG5cdFx0XHRcdHJldHVybiBIaXRUZXN0UmVzdWx0LmNyZWF0ZUZyb21ET01JbmZvKGN0eCwgPEhUTUxFbGVtZW50PmhpdFJlc3VsdC5vZmZzZXROb2RlLCAwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFVua25vd25IaXRUZXN0UmVzdWx0KDxIVE1MRWxlbWVudD5oaXRSZXN1bHQub2Zmc2V0Tm9kZSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc25hcFRvU29mdFRhYkJvdW5kYXJ5KHBvc2l0aW9uOiBQb3NpdGlvbiwgdmlld01vZGVsOiBJVmlld01vZGVsKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gdmlld01vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHsgdGFiU2l6ZSB9ID0gdmlld01vZGVsLm1vZGVsLmdldE9wdGlvbnMoKTtcblx0XHRjb25zdCBuZXdQb3NpdGlvbiA9IEF0b21pY1RhYk1vdmVPcGVyYXRpb25zLmF0b21pY1Bvc2l0aW9uKGxpbmVDb250ZW50LCBwb3NpdGlvbi5jb2x1bW4gLSAxLCB0YWJTaXplLCBEaXJlY3Rpb24uTmVhcmVzdCk7XG5cdFx0aWYgKG5ld1Bvc2l0aW9uICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIG5ldyBQb3NpdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBuZXdQb3NpdGlvbiArIDEpO1xuXHRcdH1cblx0XHRyZXR1cm4gcG9zaXRpb247XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGRvSGl0VGVzdChjdHg6IEhpdFRlc3RDb250ZXh0LCByZXF1ZXN0OiBCYXJlSGl0VGVzdFJlcXVlc3QpOiBIaXRUZXN0UmVzdWx0IHtcblxuXHRcdGxldCByZXN1bHQ6IEhpdFRlc3RSZXN1bHQgPSBuZXcgVW5rbm93bkhpdFRlc3RSZXN1bHQoKTtcblx0XHRpZiAodHlwZW9mICg8YW55PmN0eC52aWV3RG9tTm9kZS5vd25lckRvY3VtZW50KS5jYXJldFJhbmdlRnJvbVBvaW50ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXN1bHQgPSB0aGlzLl9kb0hpdFRlc3RXaXRoQ2FyZXRSYW5nZUZyb21Qb2ludChjdHgsIHJlcXVlc3QpO1xuXHRcdH0gZWxzZSBpZiAoKDxhbnk+Y3R4LnZpZXdEb21Ob2RlLm93bmVyRG9jdW1lbnQpLmNhcmV0UG9zaXRpb25Gcm9tUG9pbnQpIHtcblx0XHRcdHJlc3VsdCA9IHRoaXMuX2RvSGl0VGVzdFdpdGhDYXJldFBvc2l0aW9uRnJvbVBvaW50KGN0eCwgcmVxdWVzdC5wb3MudG9DbGllbnRDb29yZGluYXRlcyhkb20uZ2V0V2luZG93KGN0eC52aWV3RG9tTm9kZSkpKTtcblx0XHR9XG5cdFx0aWYgKHJlc3VsdC50eXBlID09PSBIaXRUZXN0UmVzdWx0VHlwZS5Db250ZW50KSB7XG5cdFx0XHRjb25zdCBpbmplY3RlZFRleHQgPSBjdHgudmlld01vZGVsLmdldEluamVjdGVkVGV4dEF0KHJlc3VsdC5wb3NpdGlvbik7XG5cblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRQb3NpdGlvbiA9IGN0eC52aWV3TW9kZWwubm9ybWFsaXplUG9zaXRpb24ocmVzdWx0LnBvc2l0aW9uLCBQb3NpdGlvbkFmZmluaXR5Lk5vbmUpO1xuXHRcdFx0aWYgKGluamVjdGVkVGV4dCB8fCAhbm9ybWFsaXplZFBvc2l0aW9uLmVxdWFscyhyZXN1bHQucG9zaXRpb24pKSB7XG5cdFx0XHRcdHJlc3VsdCA9IG5ldyBDb250ZW50SGl0VGVzdFJlc3VsdChub3JtYWxpemVkUG9zaXRpb24sIHJlc3VsdC5zcGFuTm9kZSwgaW5qZWN0ZWRUZXh0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5mdW5jdGlvbiBzaGFkb3dDYXJldFJhbmdlRnJvbVBvaW50KHNoYWRvd1Jvb3Q6IFNoYWRvd1Jvb3QsIHg6IG51bWJlciwgeTogbnVtYmVyKTogUmFuZ2Uge1xuXHRjb25zdCByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XG5cblx0Ly8gR2V0IHRoZSBlbGVtZW50IHVuZGVyIHRoZSBwb2ludFxuXHRsZXQgZWw6IEVsZW1lbnQgfCBudWxsID0gKDxhbnk+c2hhZG93Um9vdCkuZWxlbWVudEZyb21Qb2ludCh4LCB5KTtcblxuXHRpZiAoZWwgIT09IG51bGwpIHtcblx0XHQvLyBHZXQgdGhlIGxhc3QgY2hpbGQgb2YgdGhlIGVsZW1lbnQgdW50aWwgaXRzIGZpcnN0Q2hpbGQgaXMgYSB0ZXh0IG5vZGVcblx0XHQvLyBUaGlzIGFzc3VtZXMgdGhhdCB0aGUgcG9pbnRlciBpcyBvbiB0aGUgcmlnaHQgb2YgdGhlIGxpbmUsIG91dCBvZiB0aGUgdG9rZW5zXG5cdFx0Ly8gYW5kIHRoYXQgd2Ugd2FudCB0byBnZXQgdGhlIG9mZnNldCBvZiB0aGUgbGFzdCB0b2tlbiBvZiB0aGUgbGluZVxuXHRcdHdoaWxlIChlbCAmJiBlbC5maXJzdENoaWxkICYmIGVsLmZpcnN0Q2hpbGQubm9kZVR5cGUgIT09IGVsLmZpcnN0Q2hpbGQuVEVYVF9OT0RFICYmIGVsLmxhc3RDaGlsZCAmJiBlbC5sYXN0Q2hpbGQuZmlyc3RDaGlsZCkge1xuXHRcdFx0ZWwgPSA8RWxlbWVudD5lbC5sYXN0Q2hpbGQ7XG5cdFx0fVxuXG5cdFx0Ly8gR3JhYiBpdHMgcmVjdFxuXHRcdGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRcdC8vIEFuZCBpdHMgZm9udCAodGhlIGNvbXB1dGVkIHNob3J0aGFuZCBmb250IHByb3BlcnR5IG1pZ2h0IGJlIGVtcHR5LCBzZWUgIzMyMTcpXG5cdFx0Y29uc3QgZWxXaW5kb3cgPSBkb20uZ2V0V2luZG93KGVsKTtcblx0XHRjb25zdCBmb250U3R5bGUgPSBlbFdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdmb250LXN0eWxlJyk7XG5cdFx0Y29uc3QgZm9udFZhcmlhbnQgPSBlbFdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdmb250LXZhcmlhbnQnKTtcblx0XHRjb25zdCBmb250V2VpZ2h0ID0gZWxXaW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZSgnZm9udC13ZWlnaHQnKTtcblx0XHRjb25zdCBmb250U2l6ZSA9IGVsV2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwsIG51bGwpLmdldFByb3BlcnR5VmFsdWUoJ2ZvbnQtc2l6ZScpO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlbFdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdsaW5lLWhlaWdodCcpO1xuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSBlbFdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdmb250LWZhbWlseScpO1xuXHRcdGNvbnN0IGZvbnQgPSBgJHtmb250U3R5bGV9ICR7Zm9udFZhcmlhbnR9ICR7Zm9udFdlaWdodH0gJHtmb250U2l6ZX0vJHtsaW5lSGVpZ2h0fSAke2ZvbnRGYW1pbHl9YDtcblxuXHRcdC8vIEFuZCBhbHNvIGl0cyB0eHQgY29udGVudFxuXHRcdGNvbnN0IHRleHQgPSAoZWwgYXMgYW55KS5pbm5lclRleHQ7XG5cblx0XHQvLyBQb3NpdGlvbiB0aGUgcGl4ZWwgY3Vyc29yIGF0IHRoZSBsZWZ0IG9mIHRoZSBlbGVtZW50XG5cdFx0bGV0IHBpeGVsQ3Vyc29yID0gcmVjdC5sZWZ0O1xuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGxldCBzdGVwOiBudW1iZXI7XG5cblx0XHQvLyBJZiB0aGUgcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIHRoZSBib3ggcHV0IHRoZSBjdXJzb3IgYWZ0ZXIgdGhlIGxhc3QgY2hhcmFjdGVyXG5cdFx0aWYgKHggPiByZWN0LmxlZnQgKyByZWN0LndpZHRoKSB7XG5cdFx0XHRvZmZzZXQgPSB0ZXh0Lmxlbmd0aDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgY2hhcldpZHRoUmVhZGVyID0gQ2hhcldpZHRoUmVhZGVyLmdldEluc3RhbmNlKCk7XG5cdFx0XHQvLyBHb2VzIHRocm91Z2ggYWxsIHRoZSBjaGFyYWN0ZXJzIG9mIHRoZSBpbm5lclRleHQsIGFuZCBjaGVja3MgaWYgdGhlIHggb2YgdGhlIHBvaW50XG5cdFx0XHQvLyBiZWxvbmdzIHRvIHRoZSBjaGFyYWN0ZXIuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoICsgMTsgaSsrKSB7XG5cdFx0XHRcdC8vIFRoZSBzdGVwIGlzIGhhbGYgdGhlIHdpZHRoIG9mIHRoZSBjaGFyYWN0ZXJcblx0XHRcdFx0c3RlcCA9IGNoYXJXaWR0aFJlYWRlci5nZXRDaGFyV2lkdGgodGV4dC5jaGFyQXQoaSksIGZvbnQpIC8gMjtcblx0XHRcdFx0Ly8gTW92ZSB0byB0aGUgY2VudGVyIG9mIHRoZSBjaGFyYWN0ZXJcblx0XHRcdFx0cGl4ZWxDdXJzb3IgKz0gc3RlcDtcblx0XHRcdFx0Ly8gSWYgdGhlIHggb2YgdGhlIHBvaW50IGlzIHNtYWxsZXIgdGhhdCB0aGUgcG9zaXRpb24gb2YgdGhlIGN1cnNvciwgdGhlIHBvaW50IGlzIG92ZXIgdGhhdCBjaGFyYWN0ZXJcblx0XHRcdFx0aWYgKHggPCBwaXhlbEN1cnNvcikge1xuXHRcdFx0XHRcdG9mZnNldCA9IGk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gTW92ZSBiZXR3ZWVuIHRoZSBjdXJyZW50IGNoYXJhY3RlciBhbmQgdGhlIG5leHRcblx0XHRcdFx0cGl4ZWxDdXJzb3IgKz0gc3RlcDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDcmVhdGVzIGEgcmFuZ2Ugd2l0aCB0aGUgdGV4dCBub2RlIG9mIHRoZSBlbGVtZW50IGFuZCBzZXQgdGhlIG9mZnNldCBmb3VuZFxuXHRcdHJhbmdlLnNldFN0YXJ0KGVsLmZpcnN0Q2hpbGQhLCBvZmZzZXQpO1xuXHRcdHJhbmdlLnNldEVuZChlbC5maXJzdENoaWxkISwgb2Zmc2V0KTtcblx0fVxuXG5cdHJldHVybiByYW5nZTtcbn1cblxuY2xhc3MgQ2hhcldpZHRoUmVhZGVyIHtcblx0cHJpdmF0ZSBzdGF0aWMgX0lOU1RBTkNFOiBDaGFyV2lkdGhSZWFkZXIgfCBudWxsID0gbnVsbDtcblxuXHRwdWJsaWMgc3RhdGljIGdldEluc3RhbmNlKCk6IENoYXJXaWR0aFJlYWRlciB7XG5cdFx0aWYgKCFDaGFyV2lkdGhSZWFkZXIuX0lOU1RBTkNFKSB7XG5cdFx0XHRDaGFyV2lkdGhSZWFkZXIuX0lOU1RBTkNFID0gbmV3IENoYXJXaWR0aFJlYWRlcigpO1xuXHRcdH1cblx0XHRyZXR1cm4gQ2hhcldpZHRoUmVhZGVyLl9JTlNUQU5DRTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlOiB7IFtjYWNoZUtleTogc3RyaW5nXTogbnVtYmVyIH07XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9jYWNoZSA9IHt9O1xuXHRcdHRoaXMuX2NhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHR9XG5cblx0cHVibGljIGdldENoYXJXaWR0aChjaGFyOiBzdHJpbmcsIGZvbnQ6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0Y29uc3QgY2FjaGVLZXkgPSBjaGFyICsgZm9udDtcblx0XHRpZiAodGhpcy5fY2FjaGVbY2FjaGVLZXldKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2FjaGVbY2FjaGVLZXldO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRleHQgPSB0aGlzLl9jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSE7XG5cdFx0Y29udGV4dC5mb250ID0gZm9udDtcblx0XHRjb25zdCBtZXRyaWNzID0gY29udGV4dC5tZWFzdXJlVGV4dChjaGFyKTtcblx0XHRjb25zdCB3aWR0aCA9IG1ldHJpY3Mud2lkdGg7XG5cdFx0dGhpcy5fY2FjaGVbY2FjaGVLZXldID0gd2lkdGg7XG5cdFx0cmV0dXJuIHdpZHRoO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFvWCx1QkFBdUI7QUFDM1ksU0FBa0UsdUJBQW9EO0FBQ3RILFNBQVMsaUJBQWlCLHdCQUF3QjtBQUNsRCxTQUFTLGdCQUFnQjtBQUV6QixTQUEyQixvQkFBb0I7QUFDL0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLG1CQUFtQjtBQUlyQyxTQUFTLHFCQUFxQjtBQUM5QixZQUFZLFNBQVM7QUFDckIsU0FBUyx5QkFBeUIsaUJBQWlCO0FBQ25ELFNBQVMsd0JBQXdCO0FBR2pDLFNBQVMsWUFBWTtBQUdyQixJQUFXLG9CQUFYLGtCQUFXQSx1QkFBWDtBQUNDLEVBQUFBLHNDQUFBO0FBQ0EsRUFBQUEsc0NBQUE7QUFGVSxTQUFBQTtBQUFBLEdBQUE7QUFLWCxNQUFNLHFCQUFxQjtBQUFBLEVBRTFCLFlBQ1UsWUFBZ0MsTUFDeEM7QUFE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LGlCQUFnQjtBQUFBLEVBQ3hCO0FBQUEsRUFLUSxjQUFjO0FBQ3JCLFNBQUssU0FBUyxDQUFDO0FBQ2YsU0FBSyxVQUFVLFNBQVMsY0FBYyxRQUFRO0FBQUEsRUFDL0M7QUFBQSxFQUVPLGFBQWEsTUFBYyxNQUFzQjtBQUN2RCxVQUFNLFdBQVcsT0FBTztBQUN4QixRQUFJLEtBQUssT0FBTyxRQUFRLEdBQUc7QUFDMUIsYUFBTyxLQUFLLE9BQU8sUUFBUTtBQUFBLElBQzVCO0FBRUEsVUFBTSxVQUFVLEtBQUssUUFBUSxXQUFXLElBQUk7QUFDNUMsWUFBUSxPQUFPO0FBQ2YsVUFBTSxVQUFVLFFBQVEsWUFBWSxJQUFJO0FBQ3hDLFVBQU0sUUFBUSxRQUFRO0FBQ3RCLFNBQUssT0FBTyxRQUFRLElBQUk7QUFDeEIsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQS9CTSxpQkFDVSxZQUFvQztBQURwRCxJQUFNLGtCQUFOOyIsCiAgIm5hbWVzIjogWyJIaXRUZXN0UmVzdWx0VHlwZSIsICJIaXRUZXN0UmVzdWx0IiwgImxpbmVOdW1iZXIiLCAibWF4TGluZUNvbHVtbiIsICJsaW5lV2lkdGgiLCAidmlzaWJsZVJhbmdlIl0KfQo=
