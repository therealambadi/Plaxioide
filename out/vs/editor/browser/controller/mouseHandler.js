import * as dom from "../../../base/browser/dom.js";
import { StandardWheelEvent } from "../../../base/browser/mouseEvent.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as platform from "../../../base/common/platform.js";
import { HitTestContext, MouseTarget, MouseTargetFactory } from "./mouseTarget.js";
import { MouseTargetType } from "../editorBrowser.js";
import { ClientCoordinates, EditorMouseEvent, EditorMouseEventFactory, GlobalEditorPointerMoveMonitor, createEditorPagePosition, createCoordinatesRelativeToEditor, PageCoordinates } from "../editorDom.js";
import { EditorZoom } from "../../common/config/editorZoom.js";
import { Position } from "../../common/core/position.js";
import { Selection } from "../../common/core/selection.js";
import { ViewEventHandler } from "../../common/viewEventHandler.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { NavigationCommandRevealType } from "../coreCommands.js";
import { MouseWheelClassifier } from "../../../base/browser/ui/scrollbar/scrollableElement.js";
class MouseHandler extends ViewEventHandler {
  constructor(context, viewController, viewHelper) {
    super();
    this._mouseLeaveMonitor = null;
    this._context = context;
    this.viewController = viewController;
    this.viewHelper = viewHelper;
    this.mouseTargetFactory = new MouseTargetFactory(this._context, viewHelper);
    this._mouseDownOperation = this._register(new MouseDownOperation(
      this._context,
      this.viewController,
      this.viewHelper,
      this.mouseTargetFactory,
      (e, testEventTarget) => this._createMouseTarget(e, testEventTarget),
      (e) => this._getMouseColumn(e)
    ));
    this.lastMouseLeaveTime = -1;
    this._height = this._context.configuration.options.get(EditorOption.layoutInfo).height;
    const mouseEvents = new EditorMouseEventFactory(this.viewHelper.viewDomNode);
    this._register(mouseEvents.onContextMenu(this.viewHelper.viewDomNode, (e) => this._onContextMenu(e, true)));
    this._register(mouseEvents.onMouseMove(this.viewHelper.viewDomNode, (e) => {
      this._onMouseMove(e);
      if (!this._mouseLeaveMonitor) {
        this._mouseLeaveMonitor = dom.addDisposableListener(this.viewHelper.viewDomNode.ownerDocument, "mousemove", (e2) => {
          if (!this.viewHelper.viewDomNode.contains(e2.target)) {
            this._onMouseLeave(new EditorMouseEvent(e2, false, this.viewHelper.viewDomNode));
          }
        });
      }
    }));
    this._register(mouseEvents.onMouseUp(this.viewHelper.viewDomNode, (e) => this._onMouseUp(e)));
    this._register(mouseEvents.onMouseLeave(this.viewHelper.viewDomNode, (e) => this._onMouseLeave(e)));
    let capturePointerId = 0;
    this._register(mouseEvents.onPointerDown(this.viewHelper.viewDomNode, (e, pointerId) => {
      capturePointerId = pointerId;
    }));
    this._register(dom.addDisposableListener(this.viewHelper.viewDomNode, dom.EventType.POINTER_UP, (e) => {
      this._mouseDownOperation.onPointerUp();
    }));
    this._register(mouseEvents.onMouseDown(this.viewHelper.viewDomNode, (e) => this._onMouseDown(e, capturePointerId)));
    this._setupMouseWheelZoomListener();
    this._context.addEventHandler(this);
  }
  _setupMouseWheelZoomListener() {
    const classifier = MouseWheelClassifier.INSTANCE;
    let prevMouseWheelTime = 0;
    let gestureStartZoomLevel = EditorZoom.getZoomLevel();
    let gestureHasZoomModifiers = false;
    let gestureAccumulatedDelta = 0;
    const onMouseWheel = (browserEvent) => {
      this.viewController.emitMouseWheel(browserEvent);
      if (!this._context.configuration.options.get(EditorOption.mouseWheelZoom)) {
        return;
      }
      const e = new StandardWheelEvent(browserEvent);
      classifier.acceptStandardWheelEvent(e);
      if (classifier.isPhysicalMouseWheel()) {
        if (hasMouseWheelZoomModifiers(browserEvent)) {
          const zoomLevel = EditorZoom.getZoomLevel();
          const delta = e.deltaY > 0 ? 1 : -1;
          EditorZoom.setZoomLevel(zoomLevel + delta);
          e.preventDefault();
          e.stopPropagation();
        }
      } else {
        if (Date.now() - prevMouseWheelTime > 50) {
          gestureStartZoomLevel = EditorZoom.getZoomLevel();
          gestureHasZoomModifiers = hasMouseWheelZoomModifiers(browserEvent);
          gestureAccumulatedDelta = 0;
        }
        prevMouseWheelTime = Date.now();
        gestureAccumulatedDelta += e.deltaY;
        if (gestureHasZoomModifiers) {
          EditorZoom.setZoomLevel(gestureStartZoomLevel + gestureAccumulatedDelta / 5);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    this._register(dom.addDisposableListener(this.viewHelper.viewDomNode, dom.EventType.MOUSE_WHEEL, onMouseWheel, { capture: true, passive: false }));
    function hasMouseWheelZoomModifiers(browserEvent) {
      return platform.isMacintosh ? (browserEvent.metaKey || browserEvent.ctrlKey) && !browserEvent.shiftKey && !browserEvent.altKey : browserEvent.ctrlKey && !browserEvent.metaKey && !browserEvent.shiftKey && !browserEvent.altKey;
    }
  }
  dispose() {
    this._context.removeEventHandler(this);
    if (this._mouseLeaveMonitor) {
      this._mouseLeaveMonitor.dispose();
      this._mouseLeaveMonitor = null;
    }
    super.dispose();
  }
  // --- begin event handlers
  onConfigurationChanged(e) {
    if (e.hasChanged(EditorOption.layoutInfo)) {
      const height = this._context.configuration.options.get(EditorOption.layoutInfo).height;
      if (this._height !== height) {
        this._height = height;
        this._mouseDownOperation.onHeightChanged();
      }
    }
    return false;
  }
  onCursorStateChanged(e) {
    this._mouseDownOperation.onCursorStateChanged(e);
    return false;
  }
  onFocusChanged(e) {
    return false;
  }
  // --- end event handlers
  getTargetAtClientPoint(clientX, clientY) {
    const clientPos = new ClientCoordinates(clientX, clientY);
    const pos = clientPos.toPageCoordinates(dom.getWindow(this.viewHelper.viewDomNode));
    const editorPos = createEditorPagePosition(this.viewHelper.viewDomNode);
    if (pos.y < editorPos.y || pos.y > editorPos.y + editorPos.height || pos.x < editorPos.x || pos.x > editorPos.x + editorPos.width) {
      return null;
    }
    const relativePos = createCoordinatesRelativeToEditor(this.viewHelper.viewDomNode, editorPos, pos);
    return this.mouseTargetFactory.createMouseTarget(this.viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
  }
  _createMouseTarget(e, testEventTarget) {
    let target = e.target;
    if (!this.viewHelper.viewDomNode.contains(target)) {
      const shadowRoot = dom.getShadowRoot(this.viewHelper.viewDomNode);
      if (shadowRoot) {
        target = shadowRoot.elementsFromPoint(e.posx, e.posy).find(
          (el) => this.viewHelper.viewDomNode.contains(el)
        );
      }
    }
    return this.mouseTargetFactory.createMouseTarget(this.viewHelper.getLastRenderData(), e.editorPos, e.pos, e.relativePos, testEventTarget ? target : null);
  }
  _getMouseColumn(e) {
    return this.mouseTargetFactory.getMouseColumn(e.relativePos);
  }
  _onContextMenu(e, testEventTarget) {
    this.viewController.emitContextMenu({
      event: e,
      target: this._createMouseTarget(e, testEventTarget)
    });
  }
  _onMouseMove(e) {
    const targetIsWidget = this.mouseTargetFactory.mouseTargetIsWidget(e);
    if (!targetIsWidget) {
      e.preventDefault();
    }
    if (this._mouseDownOperation.isActive()) {
      return;
    }
    const actualMouseMoveTime = e.timestamp;
    if (actualMouseMoveTime < this.lastMouseLeaveTime) {
      return;
    }
    this.viewController.emitMouseMove({
      event: e,
      target: this._createMouseTarget(e, true)
    });
  }
  _onMouseLeave(e) {
    if (this._mouseLeaveMonitor) {
      this._mouseLeaveMonitor.dispose();
      this._mouseLeaveMonitor = null;
    }
    this.lastMouseLeaveTime = (/* @__PURE__ */ new Date()).getTime();
    this.viewController.emitMouseLeave({
      event: e,
      target: null
    });
  }
  _onMouseUp(e) {
    this.viewController.emitMouseUp({
      event: e,
      target: this._createMouseTarget(e, true)
    });
  }
  _onMouseDown(e, pointerId) {
    const t = this._createMouseTarget(e, true);
    const targetIsContent = t.type === MouseTargetType.CONTENT_TEXT || t.type === MouseTargetType.CONTENT_EMPTY;
    const targetIsGutter = t.type === MouseTargetType.GUTTER_GLYPH_MARGIN || t.type === MouseTargetType.GUTTER_LINE_NUMBERS || t.type === MouseTargetType.GUTTER_LINE_DECORATIONS;
    const targetIsLineNumbers = t.type === MouseTargetType.GUTTER_LINE_NUMBERS;
    const selectOnLineNumbers = this._context.configuration.options.get(EditorOption.selectOnLineNumbers);
    const targetIsViewZone = t.type === MouseTargetType.CONTENT_VIEW_ZONE || t.type === MouseTargetType.GUTTER_VIEW_ZONE;
    const targetIsWidget = t.type === MouseTargetType.CONTENT_WIDGET;
    let shouldHandle = e.leftButton || e.middleButton;
    if (platform.isMacintosh && e.leftButton && e.ctrlKey) {
      shouldHandle = false;
    }
    const focus = () => {
      e.preventDefault();
      this.viewHelper.focusTextArea();
    };
    if (shouldHandle && (targetIsContent || targetIsLineNumbers && selectOnLineNumbers)) {
      focus();
      this._mouseDownOperation.start(t.type, e, pointerId);
    } else if (targetIsGutter) {
      e.preventDefault();
    } else if (targetIsViewZone) {
      const viewZoneData = t.detail;
      if (shouldHandle && this.viewHelper.shouldSuppressMouseDownOnViewZone(viewZoneData.viewZoneId)) {
        focus();
        this._mouseDownOperation.start(t.type, e, pointerId);
        e.preventDefault();
      }
    } else if (targetIsWidget && this.viewHelper.shouldSuppressMouseDownOnWidget(t.detail)) {
      focus();
      e.preventDefault();
    }
    this.viewController.emitMouseDown({
      event: e,
      target: t
    });
  }
  _onMouseWheel(e) {
    this.viewController.emitMouseWheel(e);
  }
}
class MouseDownOperation extends Disposable {
  constructor(_context, _viewController, _viewHelper, _mouseTargetFactory, createMouseTarget, getMouseColumn) {
    super();
    this._context = _context;
    this._viewController = _viewController;
    this._viewHelper = _viewHelper;
    this._mouseTargetFactory = _mouseTargetFactory;
    this._createMouseTarget = createMouseTarget;
    this._getMouseColumn = getMouseColumn;
    this._mouseMoveMonitor = this._register(new GlobalEditorPointerMoveMonitor(this._viewHelper.viewDomNode));
    this._topBottomDragScrolling = this._register(new TopBottomDragScrolling(
      this._context,
      this._viewHelper,
      this._mouseTargetFactory,
      (position, inSelectionMode, revealType) => this._dispatchMouse(position, inSelectionMode, revealType)
    ));
    this._mouseState = new MouseDownState();
    this._currentSelection = new Selection(1, 1, 1, 1);
    this._isActive = false;
    this._lastMouseEvent = null;
  }
  dispose() {
    super.dispose();
  }
  isActive() {
    return this._isActive;
  }
  _onMouseDownThenMove(e) {
    this._lastMouseEvent = e;
    this._mouseState.setModifiers(e);
    const position = this._findMousePosition(e, false);
    if (!position) {
      return;
    }
    if (this._mouseState.isDragAndDrop) {
      this._viewController.emitMouseDrag({
        event: e,
        target: position
      });
    } else {
      if (position.type === MouseTargetType.OUTSIDE_EDITOR && (position.outsidePosition === "above" || position.outsidePosition === "below")) {
        this._topBottomDragScrolling.start(position, e);
      } else {
        this._topBottomDragScrolling.stop();
        this._dispatchMouse(position, true, NavigationCommandRevealType.Minimal);
      }
    }
  }
  start(targetType, e, pointerId) {
    this._lastMouseEvent = e;
    this._mouseState.setStartedOnLineNumbers(targetType === MouseTargetType.GUTTER_LINE_NUMBERS);
    this._mouseState.setStartButtons(e);
    this._mouseState.setModifiers(e);
    const position = this._findMousePosition(e, true);
    if (!position || !position.position) {
      return;
    }
    this._mouseState.trySetCount(e.detail, position.position);
    e.detail = this._mouseState.count;
    const options = this._context.configuration.options;
    if (!options.get(EditorOption.readOnly) && options.get(EditorOption.dragAndDrop) && !options.get(EditorOption.columnSelection) && !this._mouseState.altKey && e.detail < 2 && !this._isActive && !this._currentSelection.isEmpty() && position.type === MouseTargetType.CONTENT_TEXT && position.position && this._currentSelection.containsPosition(position.position)) {
      this._mouseState.isDragAndDrop = true;
      this._isActive = true;
      this._mouseMoveMonitor.startMonitoring(
        this._viewHelper.viewLinesDomNode,
        pointerId,
        e.buttons,
        (e2) => this._onMouseDownThenMove(e2),
        (browserEvent) => {
          const position2 = this._findMousePosition(this._lastMouseEvent, false);
          if (dom.isKeyboardEvent(browserEvent)) {
            this._viewController.emitMouseDropCanceled();
          } else {
            this._viewController.emitMouseDrop({
              event: this._lastMouseEvent,
              target: position2 ? this._createMouseTarget(this._lastMouseEvent, true) : null
              // Ignoring because position is unknown, e.g., Content View Zone
            });
          }
          this._stop();
        }
      );
      return;
    }
    this._mouseState.isDragAndDrop = false;
    this._dispatchMouse(position, e.shiftKey, NavigationCommandRevealType.Minimal);
    if (!this._isActive) {
      this._isActive = true;
      this._mouseMoveMonitor.startMonitoring(
        this._viewHelper.viewLinesDomNode,
        pointerId,
        e.buttons,
        (e2) => this._onMouseDownThenMove(e2),
        () => this._stop()
      );
    }
  }
  _stop() {
    this._isActive = false;
    this._topBottomDragScrolling.stop();
  }
  onHeightChanged() {
    this._mouseMoveMonitor.stopMonitoring();
  }
  onPointerUp() {
    this._mouseMoveMonitor.stopMonitoring();
  }
  onCursorStateChanged(e) {
    this._currentSelection = e.selections[0];
  }
  _getPositionOutsideEditor(e) {
    const editorContent = e.editorPos;
    const model = this._context.viewModel;
    const viewLayout = this._context.viewLayout;
    const mouseColumn = this._getMouseColumn(e);
    if (e.posy < editorContent.y) {
      const outsideDistance = editorContent.y - e.posy;
      const verticalOffset = Math.max(viewLayout.getCurrentScrollTop() - outsideDistance, 0);
      const viewZoneData = HitTestContext.getZoneAtCoord(this._context, verticalOffset);
      if (viewZoneData) {
        const newPosition = this._helpPositionJumpOverViewZone(viewZoneData);
        if (newPosition) {
          return MouseTarget.createOutsideEditor(mouseColumn, newPosition, "above", outsideDistance);
        }
      }
      const aboveLineNumber = viewLayout.getLineNumberAtVerticalOffset(verticalOffset);
      return MouseTarget.createOutsideEditor(mouseColumn, new Position(aboveLineNumber, 1), "above", outsideDistance);
    }
    if (e.posy > editorContent.y + editorContent.height) {
      const outsideDistance = e.posy - editorContent.y - editorContent.height;
      const verticalOffset = viewLayout.getCurrentScrollTop() + e.relativePos.y;
      const viewZoneData = HitTestContext.getZoneAtCoord(this._context, verticalOffset);
      if (viewZoneData) {
        const newPosition = this._helpPositionJumpOverViewZone(viewZoneData);
        if (newPosition) {
          return MouseTarget.createOutsideEditor(mouseColumn, newPosition, "below", outsideDistance);
        }
      }
      const belowLineNumber = viewLayout.getLineNumberAtVerticalOffset(verticalOffset);
      return MouseTarget.createOutsideEditor(mouseColumn, new Position(belowLineNumber, model.getLineMaxColumn(belowLineNumber)), "below", outsideDistance);
    }
    const possibleLineNumber = viewLayout.getLineNumberAtVerticalOffset(viewLayout.getCurrentScrollTop() + e.relativePos.y);
    if (e.posx < editorContent.x) {
      const outsideDistance = editorContent.x - e.posx;
      return MouseTarget.createOutsideEditor(mouseColumn, new Position(possibleLineNumber, 1), "left", outsideDistance);
    }
    if (e.posx > editorContent.x + editorContent.width) {
      const outsideDistance = e.posx - editorContent.x - editorContent.width;
      return MouseTarget.createOutsideEditor(mouseColumn, new Position(possibleLineNumber, model.getLineMaxColumn(possibleLineNumber)), "right", outsideDistance);
    }
    return null;
  }
  _findMousePosition(e, testEventTarget) {
    const positionOutsideEditor = this._getPositionOutsideEditor(e);
    if (positionOutsideEditor) {
      return positionOutsideEditor;
    }
    const t = this._createMouseTarget(e, testEventTarget);
    const hintedPosition = t.position;
    if (!hintedPosition) {
      return null;
    }
    if (t.type === MouseTargetType.CONTENT_VIEW_ZONE || t.type === MouseTargetType.GUTTER_VIEW_ZONE) {
      const newPosition = this._helpPositionJumpOverViewZone(t.detail);
      if (newPosition) {
        return MouseTarget.createViewZone(t.type, t.element, t.mouseColumn, newPosition, t.detail);
      }
    }
    return t;
  }
  _helpPositionJumpOverViewZone(viewZoneData) {
    const selectionStart = new Position(this._currentSelection.selectionStartLineNumber, this._currentSelection.selectionStartColumn);
    const positionBefore = viewZoneData.positionBefore;
    const positionAfter = viewZoneData.positionAfter;
    if (positionBefore && positionAfter) {
      if (positionBefore.isBefore(selectionStart)) {
        return positionBefore;
      } else {
        return positionAfter;
      }
    }
    return null;
  }
  _dispatchMouse(position, inSelectionMode, revealType) {
    if (!position.position) {
      return;
    }
    this._viewController.dispatchMouse({
      position: position.position,
      mouseColumn: position.mouseColumn,
      startedOnLineNumbers: this._mouseState.startedOnLineNumbers,
      revealType,
      inSelectionMode,
      mouseDownCount: this._mouseState.count,
      altKey: this._mouseState.altKey,
      ctrlKey: this._mouseState.ctrlKey,
      metaKey: this._mouseState.metaKey,
      shiftKey: this._mouseState.shiftKey,
      leftButton: this._mouseState.leftButton,
      middleButton: this._mouseState.middleButton,
      onInjectedText: position.type === MouseTargetType.CONTENT_TEXT && position.detail.injectedText !== null
    });
  }
}
class TopBottomDragScrolling extends Disposable {
  constructor(_context, _viewHelper, _mouseTargetFactory, _dispatchMouse) {
    super();
    this._context = _context;
    this._viewHelper = _viewHelper;
    this._mouseTargetFactory = _mouseTargetFactory;
    this._dispatchMouse = _dispatchMouse;
    this._operation = null;
  }
  dispose() {
    super.dispose();
    this.stop();
  }
  start(position, mouseEvent) {
    if (this._operation) {
      this._operation.setPosition(position, mouseEvent);
    } else {
      this._operation = new TopBottomDragScrollingOperation(this._context, this._viewHelper, this._mouseTargetFactory, this._dispatchMouse, position, mouseEvent);
    }
  }
  stop() {
    if (this._operation) {
      this._operation.dispose();
      this._operation = null;
    }
  }
}
class TopBottomDragScrollingOperation extends Disposable {
  constructor(_context, _viewHelper, _mouseTargetFactory, _dispatchMouse, position, mouseEvent) {
    super();
    this._context = _context;
    this._viewHelper = _viewHelper;
    this._mouseTargetFactory = _mouseTargetFactory;
    this._dispatchMouse = _dispatchMouse;
    this._position = position;
    this._mouseEvent = mouseEvent;
    this._lastTime = Date.now();
    this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(dom.getWindow(mouseEvent.browserEvent), () => this._execute());
  }
  dispose() {
    this._animationFrameDisposable.dispose();
    super.dispose();
  }
  setPosition(position, mouseEvent) {
    this._position = position;
    this._mouseEvent = mouseEvent;
  }
  /**
   * update internal state and return elapsed ms since last time
   */
  _tick() {
    const now = Date.now();
    const elapsed = now - this._lastTime;
    this._lastTime = now;
    return elapsed;
  }
  /**
   * get the number of lines per second to auto-scroll
   */
  _getScrollSpeed() {
    const lineHeight = this._context.configuration.options.get(EditorOption.lineHeight);
    const viewportInLines = this._context.configuration.options.get(EditorOption.layoutInfo).height / lineHeight;
    const outsideDistanceInLines = this._position.outsideDistance / lineHeight;
    if (outsideDistanceInLines <= 1.5) {
      return Math.max(30, viewportInLines * (1 + outsideDistanceInLines));
    }
    if (outsideDistanceInLines <= 3) {
      return Math.max(60, viewportInLines * (2 + outsideDistanceInLines));
    }
    return Math.max(200, viewportInLines * (7 + outsideDistanceInLines));
  }
  _execute() {
    const lineHeight = this._context.configuration.options.get(EditorOption.lineHeight);
    const scrollSpeedInLines = this._getScrollSpeed();
    const elapsed = this._tick();
    const scrollInPixels = scrollSpeedInLines * (elapsed / 1e3) * lineHeight;
    const scrollValue = this._position.outsidePosition === "above" ? -scrollInPixels : scrollInPixels;
    this._context.viewModel.viewLayout.deltaScrollNow(0, scrollValue);
    this._viewHelper.renderNow();
    const viewportData = this._context.viewLayout.getLinesViewportData();
    const edgeLineNumber = this._position.outsidePosition === "above" ? viewportData.startLineNumber : viewportData.endLineNumber;
    let mouseTarget;
    {
      const editorPos = createEditorPagePosition(this._viewHelper.viewDomNode);
      const horizontalScrollbarHeight = this._context.configuration.options.get(EditorOption.layoutInfo).horizontalScrollbarHeight;
      const pos = new PageCoordinates(this._mouseEvent.pos.x, editorPos.y + editorPos.height - horizontalScrollbarHeight - 0.1);
      const relativePos = createCoordinatesRelativeToEditor(this._viewHelper.viewDomNode, editorPos, pos);
      mouseTarget = this._mouseTargetFactory.createMouseTarget(this._viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
    }
    if (!mouseTarget.position || mouseTarget.position.lineNumber !== edgeLineNumber) {
      if (this._position.outsidePosition === "above") {
        mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, 1), "above", this._position.outsideDistance);
      } else {
        mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, this._context.viewModel.getLineMaxColumn(edgeLineNumber)), "below", this._position.outsideDistance);
      }
    }
    this._dispatchMouse(mouseTarget, true, NavigationCommandRevealType.None);
    this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(dom.getWindow(mouseTarget.element), () => this._execute());
  }
}
const _MouseDownState = class _MouseDownState {
  get altKey() {
    return this._altKey;
  }
  get ctrlKey() {
    return this._ctrlKey;
  }
  get metaKey() {
    return this._metaKey;
  }
  get shiftKey() {
    return this._shiftKey;
  }
  get leftButton() {
    return this._leftButton;
  }
  get middleButton() {
    return this._middleButton;
  }
  get startedOnLineNumbers() {
    return this._startedOnLineNumbers;
  }
  constructor() {
    this._altKey = false;
    this._ctrlKey = false;
    this._metaKey = false;
    this._shiftKey = false;
    this._leftButton = false;
    this._middleButton = false;
    this._startedOnLineNumbers = false;
    this._lastMouseDownPosition = null;
    this._lastMouseDownPositionEqualCount = 0;
    this._lastMouseDownCount = 0;
    this._lastSetMouseDownCountTime = 0;
    this.isDragAndDrop = false;
  }
  get count() {
    return this._lastMouseDownCount;
  }
  setModifiers(source) {
    this._altKey = source.altKey;
    this._ctrlKey = source.ctrlKey;
    this._metaKey = source.metaKey;
    this._shiftKey = source.shiftKey;
  }
  setStartButtons(source) {
    this._leftButton = source.leftButton;
    this._middleButton = source.middleButton;
  }
  setStartedOnLineNumbers(startedOnLineNumbers) {
    this._startedOnLineNumbers = startedOnLineNumbers;
  }
  trySetCount(setMouseDownCount, newMouseDownPosition) {
    const currentTime = (/* @__PURE__ */ new Date()).getTime();
    if (currentTime - this._lastSetMouseDownCountTime > _MouseDownState.CLEAR_MOUSE_DOWN_COUNT_TIME) {
      setMouseDownCount = 1;
    }
    this._lastSetMouseDownCountTime = currentTime;
    if (setMouseDownCount > this._lastMouseDownCount + 1) {
      setMouseDownCount = this._lastMouseDownCount + 1;
    }
    if (this._lastMouseDownPosition && this._lastMouseDownPosition.equals(newMouseDownPosition)) {
      this._lastMouseDownPositionEqualCount++;
    } else {
      this._lastMouseDownPositionEqualCount = 1;
    }
    this._lastMouseDownPosition = newMouseDownPosition;
    this._lastMouseDownCount = Math.min(setMouseDownCount, this._lastMouseDownPositionEqualCount);
  }
};
_MouseDownState.CLEAR_MOUSE_DOWN_COUNT_TIME = 400;
let MouseDownState = _MouseDownState;
export {
  MouseHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL21vdXNlSGFuZGxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkV2hlZWxFdmVudCwgSU1vdXNlV2hlZWxFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEhpdFRlc3RDb250ZXh0LCBNb3VzZVRhcmdldCwgTW91c2VUYXJnZXRGYWN0b3J5LCBQb2ludGVySGFuZGxlckxhc3RSZW5kZXJEYXRhIH0gZnJvbSAnLi9tb3VzZVRhcmdldC5qcyc7XG5pbXBvcnQgeyBJTW91c2VUYXJnZXQsIElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3IsIElNb3VzZVRhcmdldFZpZXdab25lRGF0YSwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDbGllbnRDb29yZGluYXRlcywgRWRpdG9yTW91c2VFdmVudCwgRWRpdG9yTW91c2VFdmVudEZhY3RvcnksIEdsb2JhbEVkaXRvclBvaW50ZXJNb3ZlTW9uaXRvciwgY3JlYXRlRWRpdG9yUGFnZVBvc2l0aW9uLCBjcmVhdGVDb29yZGluYXRlc1JlbGF0aXZlVG9FZGl0b3IsIFBhZ2VDb29yZGluYXRlcyB9IGZyb20gJy4uL2VkaXRvckRvbS5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udHJvbGxlciB9IGZyb20gJy4uL3ZpZXcvdmlld0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yWm9vbSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yWm9vbS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBIb3Jpem9udGFsUG9zaXRpb24gfSBmcm9tICcuLi92aWV3L3JlbmRlcmluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgVmlld0V2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3RXZlbnRIYW5kbGVyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBOYXZpZ2F0aW9uQ29tbWFuZFJldmVhbFR5cGUgfSBmcm9tICcuLi9jb3JlQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTW91c2VXaGVlbENsYXNzaWZpZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xpbmVzR3B1IH0gZnJvbSAnLi4vdmlld1BhcnRzL3ZpZXdMaW5lc0dwdS92aWV3TGluZXNHcHUuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElQb2ludGVySGFuZGxlckhlbHBlciB7XG5cdHZpZXdEb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0bGluZXNDb250ZW50RG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHZpZXdMaW5lc0RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHR2aWV3TGluZXNHcHU6IFZpZXdMaW5lc0dwdSB8IHVuZGVmaW5lZDtcblxuXHRmb2N1c1RleHRBcmVhKCk6IHZvaWQ7XG5cdGRpc3BhdGNoVGV4dEFyZWFFdmVudChldmVudDogQ3VzdG9tRXZlbnQpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGxhc3QgcmVuZGVyZWQgaW5mb3JtYXRpb24gZm9yIGN1cnNvcnMgJiB0ZXh0YXJlYS5cblx0ICovXG5cdGdldExhc3RSZW5kZXJEYXRhKCk6IFBvaW50ZXJIYW5kbGVyTGFzdFJlbmRlckRhdGE7XG5cblx0LyoqXG5cdCAqIFJlbmRlciByaWdodCBub3dcblx0ICovXG5cdHJlbmRlck5vdygpOiB2b2lkO1xuXG5cdHNob3VsZFN1cHByZXNzTW91c2VEb3duT25WaWV3Wm9uZSh2aWV3Wm9uZUlkOiBzdHJpbmcpOiBib29sZWFuO1xuXHRzaG91bGRTdXBwcmVzc01vdXNlRG93bk9uV2lkZ2V0KHdpZGdldElkOiBzdHJpbmcpOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBEZWNvZGUgYSBwb3NpdGlvbiBmcm9tIGEgcmVuZGVyZWQgZG9tIG5vZGVcblx0ICovXG5cdGdldFBvc2l0aW9uRnJvbURPTUluZm8oc3Bhbk5vZGU6IEhUTUxFbGVtZW50LCBvZmZzZXQ6IG51bWJlcik6IFBvc2l0aW9uIHwgbnVsbDtcblxuXHR2aXNpYmxlUmFuZ2VGb3JQb3NpdGlvbihsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTogSG9yaXpvbnRhbFBvc2l0aW9uIHwgbnVsbDtcblx0Z2V0TGluZVdpZHRoKGxpbmVOdW1iZXI6IG51bWJlcik6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE1vdXNlSGFuZGxlciBleHRlbmRzIFZpZXdFdmVudEhhbmRsZXIge1xuXG5cdHByb3RlY3RlZCBfY29udGV4dDogVmlld0NvbnRleHQ7XG5cdHByb3RlY3RlZCB2aWV3Q29udHJvbGxlcjogVmlld0NvbnRyb2xsZXI7XG5cdHByb3RlY3RlZCB2aWV3SGVscGVyOiBJUG9pbnRlckhhbmRsZXJIZWxwZXI7XG5cdHByb3RlY3RlZCBtb3VzZVRhcmdldEZhY3Rvcnk6IE1vdXNlVGFyZ2V0RmFjdG9yeTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9tb3VzZURvd25PcGVyYXRpb246IE1vdXNlRG93bk9wZXJhdGlvbjtcblx0cHJpdmF0ZSBsYXN0TW91c2VMZWF2ZVRpbWU6IG51bWJlcjtcblx0cHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgX21vdXNlTGVhdmVNb25pdG9yOiBJRGlzcG9zYWJsZSB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRleHQ6IFZpZXdDb250ZXh0LCB2aWV3Q29udHJvbGxlcjogVmlld0NvbnRyb2xsZXIsIHZpZXdIZWxwZXI6IElQb2ludGVySGFuZGxlckhlbHBlcikge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLnZpZXdDb250cm9sbGVyID0gdmlld0NvbnRyb2xsZXI7XG5cdFx0dGhpcy52aWV3SGVscGVyID0gdmlld0hlbHBlcjtcblx0XHR0aGlzLm1vdXNlVGFyZ2V0RmFjdG9yeSA9IG5ldyBNb3VzZVRhcmdldEZhY3RvcnkodGhpcy5fY29udGV4dCwgdmlld0hlbHBlcik7XG5cblx0XHR0aGlzLl9tb3VzZURvd25PcGVyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgTW91c2VEb3duT3BlcmF0aW9uKFxuXHRcdFx0dGhpcy5fY29udGV4dCxcblx0XHRcdHRoaXMudmlld0NvbnRyb2xsZXIsXG5cdFx0XHR0aGlzLnZpZXdIZWxwZXIsXG5cdFx0XHR0aGlzLm1vdXNlVGFyZ2V0RmFjdG9yeSxcblx0XHRcdChlLCB0ZXN0RXZlbnRUYXJnZXQpID0+IHRoaXMuX2NyZWF0ZU1vdXNlVGFyZ2V0KGUsIHRlc3RFdmVudFRhcmdldCksXG5cdFx0XHQoZSkgPT4gdGhpcy5fZ2V0TW91c2VDb2x1bW4oZSlcblx0XHQpKTtcblxuXHRcdHRoaXMubGFzdE1vdXNlTGVhdmVUaW1lID0gLTE7XG5cdFx0dGhpcy5faGVpZ2h0ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKS5oZWlnaHQ7XG5cblx0XHRjb25zdCBtb3VzZUV2ZW50cyA9IG5ldyBFZGl0b3JNb3VzZUV2ZW50RmFjdG9yeSh0aGlzLnZpZXdIZWxwZXIudmlld0RvbU5vZGUpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW91c2VFdmVudHMub25Db250ZXh0TWVudSh0aGlzLnZpZXdIZWxwZXIudmlld0RvbU5vZGUsIChlKSA9PiB0aGlzLl9vbkNvbnRleHRNZW51KGUsIHRydWUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihtb3VzZUV2ZW50cy5vbk1vdXNlTW92ZSh0aGlzLnZpZXdIZWxwZXIudmlld0RvbU5vZGUsIChlKSA9PiB7XG5cdFx0XHR0aGlzLl9vbk1vdXNlTW92ZShlKTtcblxuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzg3ODlcblx0XHRcdC8vIFdoZW4gbW92aW5nIHRoZSBtb3VzZSByZWFsbHkgcXVpY2tseSwgdGhlIGJyb3dzZXIgc29tZXRpbWVzIGZvcmdldHMgdG9cblx0XHRcdC8vIHNlbmQgdXMgYSBgbW91c2VsZWF2ZWAgb3IgYG1vdXNlb3V0YCBldmVudC4gV2UgdGhlcmVmb3JlIGluc3RhbGwgaGVyZVxuXHRcdFx0Ly8gYSBnbG9iYWwgYG1vdXNlbW92ZWAgbGlzdGVuZXIgdG8gbWFudWFsbHkgcmVjb3ZlciBpZiB0aGUgbW91c2UgZ29lcyBvdXRzaWRlXG5cdFx0XHQvLyB0aGUgZWRpdG9yLiBBcyBzb29uIGFzIHRoZSBtb3VzZSBsZWF2ZXMgb3V0c2lkZSBvZiB0aGUgZWRpdG9yLCB3ZVxuXHRcdFx0Ly8gcmVtb3ZlIHRoaXMgbGlzdGVuZXJcblxuXHRcdFx0aWYgKCF0aGlzLl9tb3VzZUxlYXZlTW9uaXRvcikge1xuXHRcdFx0XHR0aGlzLl9tb3VzZUxlYXZlTW9uaXRvciA9IGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlLm93bmVyRG9jdW1lbnQsICdtb3VzZW1vdmUnLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmICghdGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlLmNvbnRhaW5zKGUudGFyZ2V0IGFzIE5vZGUgfCBudWxsKSkge1xuXHRcdFx0XHRcdFx0Ly8gd2VudCBvdXRzaWRlIHRoZSBlZGl0b3IhXG5cdFx0XHRcdFx0XHR0aGlzLl9vbk1vdXNlTGVhdmUobmV3IEVkaXRvck1vdXNlRXZlbnQoZSwgZmFsc2UsIHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW91c2VFdmVudHMub25Nb3VzZVVwKHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSwgKGUpID0+IHRoaXMuX29uTW91c2VVcChlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW91c2VFdmVudHMub25Nb3VzZUxlYXZlKHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSwgKGUpID0+IHRoaXMuX29uTW91c2VMZWF2ZShlKSkpO1xuXG5cdFx0Ly8gYHBvaW50ZXJkb3duYCBldmVudHMgY2FuJ3QgYmUgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlcmUncyBhIGRvdWJsZSBjbGljaywgb3IgdHJpcGxlIGNsaWNrXG5cdFx0Ly8gYmVjYXVzZSB0aGVpciBgZS5kZXRhaWxgIGlzIGFsd2F5cyAwLlxuXHRcdC8vIFdlIHdpbGwgdGhlcmVmb3JlIHNhdmUgdGhlIHBvaW50ZXIgaWQgZm9yIHRoZSBtb3VzZSBhbmQgdGhlbiByZXVzZSBpdCBpbiB0aGUgYG1vdXNlZG93bmAgZXZlbnRcblx0XHQvLyBmb3IgYGVsZW1lbnQuc2V0UG9pbnRlckNhcHR1cmVgLlxuXHRcdGxldCBjYXB0dXJlUG9pbnRlcklkOiBudW1iZXIgPSAwO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vdXNlRXZlbnRzLm9uUG9pbnRlckRvd24odGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlLCAoZSwgcG9pbnRlcklkKSA9PiB7XG5cdFx0XHRjYXB0dXJlUG9pbnRlcklkID0gcG9pbnRlcklkO1xuXHRcdH0pKTtcblx0XHQvLyBUaGUgYHBvaW50ZXJ1cGAgbGlzdGVuZXIgcmVnaXN0ZXJlZCBieSBgR2xvYmFsRWRpdG9yUG9pbnRlck1vdmVNb25pdG9yYCBkb2VzIG5vdCBnZXQgaW52b2tlZCAxMDAlIG9mIHRoZSB0aW1lcy5cblx0XHQvLyBJIHNwZWN1bGF0ZSB0aGF0IHRoaXMgaXMgYmVjYXVzZSB0aGUgYHBvaW50ZXJ1cGAgbGlzdGVuZXIgaXMgb25seSByZWdpc3RlcmVkIGR1cmluZyB0aGUgYG1vdXNlZG93bmAgZXZlbnQsIGFuZCBwZXJoYXBzXG5cdFx0Ly8gdGhlIGBwb2ludGVydXBgIGV2ZW50IGlzIGFscmVhZHkgcXVldWVkIGZvciBkaXNwYXRjaGluZywgd2hpY2ggbWFrZXMgaXQgdGhhdCB0aGUgbmV3IGxpc3RlbmVyIGRvZXNuJ3QgZ2V0IGZpcmVkLlxuXHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQ2NDg2IGZvciByZXBybyBzdGVwcy5cblx0XHQvLyBUbyBjb21wZW5zYXRlIGZvciB0aGF0LCB3ZSBzaW1wbHkgcmVnaXN0ZXIgaGVyZSBhIGBwb2ludGVydXBgIGxpc3RlbmVyIGFuZCBqdXN0IGNvbW11bmljYXRlIGl0LlxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlLCBkb20uRXZlbnRUeXBlLlBPSU5URVJfVVAsIChlOiBQb2ludGVyRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuX21vdXNlRG93bk9wZXJhdGlvbi5vblBvaW50ZXJVcCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb3VzZUV2ZW50cy5vbk1vdXNlRG93bih0aGlzLnZpZXdIZWxwZXIudmlld0RvbU5vZGUsIChlKSA9PiB0aGlzLl9vbk1vdXNlRG93bihlLCBjYXB0dXJlUG9pbnRlcklkKSkpO1xuXHRcdHRoaXMuX3NldHVwTW91c2VXaGVlbFpvb21MaXN0ZW5lcigpO1xuXG5cdFx0dGhpcy5fY29udGV4dC5hZGRFdmVudEhhbmRsZXIodGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXR1cE1vdXNlV2hlZWxab29tTGlzdGVuZXIoKTogdm9pZCB7XG5cblx0XHRjb25zdCBjbGFzc2lmaWVyID0gTW91c2VXaGVlbENsYXNzaWZpZXIuSU5TVEFOQ0U7XG5cblx0XHRsZXQgcHJldk1vdXNlV2hlZWxUaW1lID0gMDtcblx0XHRsZXQgZ2VzdHVyZVN0YXJ0Wm9vbUxldmVsID0gRWRpdG9yWm9vbS5nZXRab29tTGV2ZWwoKTtcblx0XHRsZXQgZ2VzdHVyZUhhc1pvb21Nb2RpZmllcnMgPSBmYWxzZTtcblx0XHRsZXQgZ2VzdHVyZUFjY3VtdWxhdGVkRGVsdGEgPSAwO1xuXG5cdFx0Y29uc3Qgb25Nb3VzZVdoZWVsID0gKGJyb3dzZXJFdmVudDogSU1vdXNlV2hlZWxFdmVudCkgPT4ge1xuXHRcdFx0dGhpcy52aWV3Q29udHJvbGxlci5lbWl0TW91c2VXaGVlbChicm93c2VyRXZlbnQpO1xuXG5cdFx0XHRpZiAoIXRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ubW91c2VXaGVlbFpvb20pKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZSA9IG5ldyBTdGFuZGFyZFdoZWVsRXZlbnQoYnJvd3NlckV2ZW50KTtcblx0XHRcdGNsYXNzaWZpZXIuYWNjZXB0U3RhbmRhcmRXaGVlbEV2ZW50KGUpO1xuXG5cdFx0XHRpZiAoY2xhc3NpZmllci5pc1BoeXNpY2FsTW91c2VXaGVlbCgpKSB7XG5cdFx0XHRcdGlmIChoYXNNb3VzZVdoZWVsWm9vbU1vZGlmaWVycyhicm93c2VyRXZlbnQpKSB7XG5cdFx0XHRcdFx0Y29uc3Qgem9vbUxldmVsOiBudW1iZXIgPSBFZGl0b3Jab29tLmdldFpvb21MZXZlbCgpO1xuXHRcdFx0XHRcdGNvbnN0IGRlbHRhID0gZS5kZWx0YVkgPiAwID8gMSA6IC0xO1xuXHRcdFx0XHRcdEVkaXRvclpvb20uc2V0Wm9vbUxldmVsKHpvb21MZXZlbCArIGRlbHRhKTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gd2UgY29uc2lkZXIgbW91c2V3aGVlbCBldmVudHMgdGhhdCBvY2N1ciB3aXRoaW4gNTBtcyBvZiBlYWNoIG90aGVyIHRvIGJlIHBhcnQgb2YgdGhlIHNhbWUgZ2VzdHVyZVxuXHRcdFx0XHQvLyB3ZSBkb24ndCB3YW50IHRvIGNvbnNpZGVyIG1vdXNlIHdoZWVsIGV2ZW50cyB3aGVyZSBjdHJsL2NtZCBpcyBwcmVzc2VkIGR1cmluZyB0aGUgaW5lcnRpYSBwaGFzZVxuXHRcdFx0XHQvLyB3ZSBhbHNvIHdhbnQgdG8gYWNjdW11bGF0ZSBkZWx0YVkgdmFsdWVzIGZyb20gdGhlIHNhbWUgZ2VzdHVyZSBhbmQgdXNlIHRoYXQgdG8gc2V0IHRoZSB6b29tIGxldmVsXG5cdFx0XHRcdGlmIChEYXRlLm5vdygpIC0gcHJldk1vdXNlV2hlZWxUaW1lID4gNTApIHtcblx0XHRcdFx0XHQvLyByZXNldCBpZiBtb3JlIHRoYW4gNTBtcyBoYXZlIHBhc3NlZFxuXHRcdFx0XHRcdGdlc3R1cmVTdGFydFpvb21MZXZlbCA9IEVkaXRvclpvb20uZ2V0Wm9vbUxldmVsKCk7XG5cdFx0XHRcdFx0Z2VzdHVyZUhhc1pvb21Nb2RpZmllcnMgPSBoYXNNb3VzZVdoZWVsWm9vbU1vZGlmaWVycyhicm93c2VyRXZlbnQpO1xuXHRcdFx0XHRcdGdlc3R1cmVBY2N1bXVsYXRlZERlbHRhID0gMDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHByZXZNb3VzZVdoZWVsVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdGdlc3R1cmVBY2N1bXVsYXRlZERlbHRhICs9IGUuZGVsdGFZO1xuXG5cdFx0XHRcdGlmIChnZXN0dXJlSGFzWm9vbU1vZGlmaWVycykge1xuXHRcdFx0XHRcdEVkaXRvclpvb20uc2V0Wm9vbUxldmVsKGdlc3R1cmVTdGFydFpvb21MZXZlbCArIGdlc3R1cmVBY2N1bXVsYXRlZERlbHRhIC8gNSk7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlLCBkb20uRXZlbnRUeXBlLk1PVVNFX1dIRUVMLCBvbk1vdXNlV2hlZWwsIHsgY2FwdHVyZTogdHJ1ZSwgcGFzc2l2ZTogZmFsc2UgfSkpO1xuXG5cdFx0ZnVuY3Rpb24gaGFzTW91c2VXaGVlbFpvb21Nb2RpZmllcnMoYnJvd3NlckV2ZW50OiBJTW91c2VXaGVlbEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHRwbGF0Zm9ybS5pc01hY2ludG9zaFxuXHRcdFx0XHRcdC8vIG9uIG1hY09TIHdlIHN1cHBvcnQgY21kICsgdHdvIGZpbmdlcnMgc2Nyb2xsIChgbWV0YUtleWAgc2V0KVxuXHRcdFx0XHRcdC8vIGFuZCBhbHNvIHRoZSB0d28gZmluZ2VycyBwaW5jaCBnZXN0dXJlIChgY3RyS2V5YCBzZXQpXG5cdFx0XHRcdFx0PyAoKGJyb3dzZXJFdmVudC5tZXRhS2V5IHx8IGJyb3dzZXJFdmVudC5jdHJsS2V5KSAmJiAhYnJvd3NlckV2ZW50LnNoaWZ0S2V5ICYmICFicm93c2VyRXZlbnQuYWx0S2V5KVxuXHRcdFx0XHRcdDogKGJyb3dzZXJFdmVudC5jdHJsS2V5ICYmICFicm93c2VyRXZlbnQubWV0YUtleSAmJiAhYnJvd3NlckV2ZW50LnNoaWZ0S2V5ICYmICFicm93c2VyRXZlbnQuYWx0S2V5KVxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0LnJlbW92ZUV2ZW50SGFuZGxlcih0aGlzKTtcblx0XHRpZiAodGhpcy5fbW91c2VMZWF2ZU1vbml0b3IpIHtcblx0XHRcdHRoaXMuX21vdXNlTGVhdmVNb25pdG9yLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX21vdXNlTGVhdmVNb25pdG9yID0gbnVsbDtcblx0XHR9XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8gLS0tIGJlZ2luIGV2ZW50IGhhbmRsZXJzXG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKSkge1xuXHRcdFx0Ly8gbGF5b3V0IGNoYW5nZVxuXHRcdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKS5oZWlnaHQ7XG5cdFx0XHRpZiAodGhpcy5faGVpZ2h0ICE9PSBoZWlnaHQpIHtcblx0XHRcdFx0dGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdFx0XHR0aGlzLl9tb3VzZURvd25PcGVyYXRpb24ub25IZWlnaHRDaGFuZ2VkKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25DdXJzb3JTdGF0ZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLl9tb3VzZURvd25PcGVyYXRpb24ub25DdXJzb3JTdGF0ZUNoYW5nZWQoZSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkZvY3VzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdGb2N1c0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHQvLyAtLS0gZW5kIGV2ZW50IGhhbmRsZXJzXG5cblx0cHVibGljIGdldFRhcmdldEF0Q2xpZW50UG9pbnQoY2xpZW50WDogbnVtYmVyLCBjbGllbnRZOiBudW1iZXIpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblx0XHRjb25zdCBjbGllbnRQb3MgPSBuZXcgQ2xpZW50Q29vcmRpbmF0ZXMoY2xpZW50WCwgY2xpZW50WSk7XG5cdFx0Y29uc3QgcG9zID0gY2xpZW50UG9zLnRvUGFnZUNvb3JkaW5hdGVzKGRvbS5nZXRXaW5kb3codGhpcy52aWV3SGVscGVyLnZpZXdEb21Ob2RlKSk7XG5cdFx0Y29uc3QgZWRpdG9yUG9zID0gY3JlYXRlRWRpdG9yUGFnZVBvc2l0aW9uKHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSk7XG5cblx0XHRpZiAocG9zLnkgPCBlZGl0b3JQb3MueSB8fCBwb3MueSA+IGVkaXRvclBvcy55ICsgZWRpdG9yUG9zLmhlaWdodCB8fCBwb3MueCA8IGVkaXRvclBvcy54IHx8IHBvcy54ID4gZWRpdG9yUG9zLnggKyBlZGl0b3JQb3Mud2lkdGgpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbGF0aXZlUG9zID0gY3JlYXRlQ29vcmRpbmF0ZXNSZWxhdGl2ZVRvRWRpdG9yKHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSwgZWRpdG9yUG9zLCBwb3MpO1xuXHRcdHJldHVybiB0aGlzLm1vdXNlVGFyZ2V0RmFjdG9yeS5jcmVhdGVNb3VzZVRhcmdldCh0aGlzLnZpZXdIZWxwZXIuZ2V0TGFzdFJlbmRlckRhdGEoKSwgZWRpdG9yUG9zLCBwb3MsIHJlbGF0aXZlUG9zLCBudWxsKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlTW91c2VUYXJnZXQoZTogRWRpdG9yTW91c2VFdmVudCwgdGVzdEV2ZW50VGFyZ2V0OiBib29sZWFuKTogSU1vdXNlVGFyZ2V0IHtcblx0XHRsZXQgdGFyZ2V0ID0gZS50YXJnZXQ7XG5cdFx0aWYgKCF0aGlzLnZpZXdIZWxwZXIudmlld0RvbU5vZGUuY29udGFpbnModGFyZ2V0KSkge1xuXHRcdFx0Y29uc3Qgc2hhZG93Um9vdCA9IGRvbS5nZXRTaGFkb3dSb290KHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZSk7XG5cdFx0XHRpZiAoc2hhZG93Um9vdCkge1xuXHRcdFx0XHR0YXJnZXQgPSAoPGFueT5zaGFkb3dSb290KS5lbGVtZW50c0Zyb21Qb2ludChlLnBvc3gsIGUucG9zeSkuZmluZChcblx0XHRcdFx0XHQoZWw6IEVsZW1lbnQpID0+IHRoaXMudmlld0hlbHBlci52aWV3RG9tTm9kZS5jb250YWlucyhlbClcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMubW91c2VUYXJnZXRGYWN0b3J5LmNyZWF0ZU1vdXNlVGFyZ2V0KHRoaXMudmlld0hlbHBlci5nZXRMYXN0UmVuZGVyRGF0YSgpLCBlLmVkaXRvclBvcywgZS5wb3MsIGUucmVsYXRpdmVQb3MsIHRlc3RFdmVudFRhcmdldCA/IHRhcmdldCA6IG51bGwpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TW91c2VDb2x1bW4oZTogRWRpdG9yTW91c2VFdmVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW91c2VUYXJnZXRGYWN0b3J5LmdldE1vdXNlQ29sdW1uKGUucmVsYXRpdmVQb3MpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9vbkNvbnRleHRNZW51KGU6IEVkaXRvck1vdXNlRXZlbnQsIHRlc3RFdmVudFRhcmdldDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMudmlld0NvbnRyb2xsZXIuZW1pdENvbnRleHRNZW51KHtcblx0XHRcdGV2ZW50OiBlLFxuXHRcdFx0dGFyZ2V0OiB0aGlzLl9jcmVhdGVNb3VzZVRhcmdldChlLCB0ZXN0RXZlbnRUYXJnZXQpXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX29uTW91c2VNb3ZlKGU6IEVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCB0YXJnZXRJc1dpZGdldCA9IHRoaXMubW91c2VUYXJnZXRGYWN0b3J5Lm1vdXNlVGFyZ2V0SXNXaWRnZXQoZSk7XG5cdFx0aWYgKCF0YXJnZXRJc1dpZGdldCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9tb3VzZURvd25PcGVyYXRpb24uaXNBY3RpdmUoKSkge1xuXHRcdFx0Ly8gSW4gc2VsZWN0aW9uL2RyYWcgb3BlcmF0aW9uXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGFjdHVhbE1vdXNlTW92ZVRpbWUgPSBlLnRpbWVzdGFtcDtcblx0XHRpZiAoYWN0dWFsTW91c2VNb3ZlVGltZSA8IHRoaXMubGFzdE1vdXNlTGVhdmVUaW1lKSB7XG5cdFx0XHQvLyBEdWUgdG8gdGhyb3R0bGluZywgdGhpcyBldmVudCBvY2N1cnJlZCBiZWZvcmUgdGhlIG1vdXNlIGxlZnQgdGhlIGVkaXRvciwgdGhlcmVmb3JlIGlnbm9yZSBpdC5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdDb250cm9sbGVyLmVtaXRNb3VzZU1vdmUoe1xuXHRcdFx0ZXZlbnQ6IGUsXG5cdFx0XHR0YXJnZXQ6IHRoaXMuX2NyZWF0ZU1vdXNlVGFyZ2V0KGUsIHRydWUpXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX29uTW91c2VMZWF2ZShlOiBFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX21vdXNlTGVhdmVNb25pdG9yKSB7XG5cdFx0XHR0aGlzLl9tb3VzZUxlYXZlTW9uaXRvci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9tb3VzZUxlYXZlTW9uaXRvciA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMubGFzdE1vdXNlTGVhdmVUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHR0aGlzLnZpZXdDb250cm9sbGVyLmVtaXRNb3VzZUxlYXZlKHtcblx0XHRcdGV2ZW50OiBlLFxuXHRcdFx0dGFyZ2V0OiBudWxsXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX29uTW91c2VVcChlOiBFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy52aWV3Q29udHJvbGxlci5lbWl0TW91c2VVcCh7XG5cdFx0XHRldmVudDogZSxcblx0XHRcdHRhcmdldDogdGhpcy5fY3JlYXRlTW91c2VUYXJnZXQoZSwgdHJ1ZSlcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfb25Nb3VzZURvd24oZTogRWRpdG9yTW91c2VFdmVudCwgcG9pbnRlcklkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB0ID0gdGhpcy5fY3JlYXRlTW91c2VUYXJnZXQoZSwgdHJ1ZSk7XG5cblx0XHRjb25zdCB0YXJnZXRJc0NvbnRlbnQgPSAodC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUIHx8IHQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfRU1QVFkpO1xuXHRcdGNvbnN0IHRhcmdldElzR3V0dGVyID0gKHQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9HTFlQSF9NQVJHSU4gfHwgdC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0xJTkVfTlVNQkVSUyB8fCB0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9ERUNPUkFUSU9OUyk7XG5cdFx0Y29uc3QgdGFyZ2V0SXNMaW5lTnVtYmVycyA9ICh0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9OVU1CRVJTKTtcblx0XHRjb25zdCBzZWxlY3RPbkxpbmVOdW1iZXJzID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zZWxlY3RPbkxpbmVOdW1iZXJzKTtcblx0XHRjb25zdCB0YXJnZXRJc1ZpZXdab25lID0gKHQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVklFV19aT05FIHx8IHQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9WSUVXX1pPTkUpO1xuXHRcdGNvbnN0IHRhcmdldElzV2lkZ2V0ID0gKHQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfV0lER0VUKTtcblxuXHRcdGxldCBzaG91bGRIYW5kbGUgPSBlLmxlZnRCdXR0b24gfHwgZS5taWRkbGVCdXR0b247XG5cdFx0aWYgKHBsYXRmb3JtLmlzTWFjaW50b3NoICYmIGUubGVmdEJ1dHRvbiAmJiBlLmN0cmxLZXkpIHtcblx0XHRcdHNob3VsZEhhbmRsZSA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzID0gKCkgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy52aWV3SGVscGVyLmZvY3VzVGV4dEFyZWEoKTtcblx0XHR9O1xuXG5cdFx0aWYgKHNob3VsZEhhbmRsZSAmJiAodGFyZ2V0SXNDb250ZW50IHx8ICh0YXJnZXRJc0xpbmVOdW1iZXJzICYmIHNlbGVjdE9uTGluZU51bWJlcnMpKSkge1xuXHRcdFx0Zm9jdXMoKTtcblx0XHRcdHRoaXMuX21vdXNlRG93bk9wZXJhdGlvbi5zdGFydCh0LnR5cGUsIGUsIHBvaW50ZXJJZCk7XG5cblx0XHR9IGVsc2UgaWYgKHRhcmdldElzR3V0dGVyKSB7XG5cdFx0XHQvLyBEbyBub3Qgc3RlYWwgZm9jdXNcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9IGVsc2UgaWYgKHRhcmdldElzVmlld1pvbmUpIHtcblx0XHRcdGNvbnN0IHZpZXdab25lRGF0YSA9IHQuZGV0YWlsO1xuXHRcdFx0aWYgKHNob3VsZEhhbmRsZSAmJiB0aGlzLnZpZXdIZWxwZXIuc2hvdWxkU3VwcHJlc3NNb3VzZURvd25PblZpZXdab25lKHZpZXdab25lRGF0YS52aWV3Wm9uZUlkKSkge1xuXHRcdFx0XHRmb2N1cygpO1xuXHRcdFx0XHR0aGlzLl9tb3VzZURvd25PcGVyYXRpb24uc3RhcnQodC50eXBlLCBlLCBwb2ludGVySWQpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0YXJnZXRJc1dpZGdldCAmJiB0aGlzLnZpZXdIZWxwZXIuc2hvdWxkU3VwcHJlc3NNb3VzZURvd25PbldpZGdldCg8c3RyaW5nPnQuZGV0YWlsKSkge1xuXHRcdFx0Zm9jdXMoKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdDb250cm9sbGVyLmVtaXRNb3VzZURvd24oe1xuXHRcdFx0ZXZlbnQ6IGUsXG5cdFx0XHR0YXJnZXQ6IHRcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfb25Nb3VzZVdoZWVsKGU6IElNb3VzZVdoZWVsRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdDb250cm9sbGVyLmVtaXRNb3VzZVdoZWVsKGUpO1xuXHR9XG59XG5cbmNsYXNzIE1vdXNlRG93bk9wZXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NyZWF0ZU1vdXNlVGFyZ2V0OiAoZTogRWRpdG9yTW91c2VFdmVudCwgdGVzdEV2ZW50VGFyZ2V0OiBib29sZWFuKSA9PiBJTW91c2VUYXJnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dldE1vdXNlQ29sdW1uOiAoZTogRWRpdG9yTW91c2VFdmVudCkgPT4gbnVtYmVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21vdXNlTW92ZU1vbml0b3I6IEdsb2JhbEVkaXRvclBvaW50ZXJNb3ZlTW9uaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfdG9wQm90dG9tRHJhZ1Njcm9sbGluZzogVG9wQm90dG9tRHJhZ1Njcm9sbGluZztcblx0cHJpdmF0ZSByZWFkb25seSBfbW91c2VTdGF0ZTogTW91c2VEb3duU3RhdGU7XG5cblx0cHJpdmF0ZSBfY3VycmVudFNlbGVjdGlvbjogU2VsZWN0aW9uO1xuXHRwcml2YXRlIF9pc0FjdGl2ZTogYm9vbGVhbjtcblx0cHJpdmF0ZSBfbGFzdE1vdXNlRXZlbnQ6IEVkaXRvck1vdXNlRXZlbnQgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdDb250cm9sbGVyOiBWaWV3Q29udHJvbGxlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92aWV3SGVscGVyOiBJUG9pbnRlckhhbmRsZXJIZWxwZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW91c2VUYXJnZXRGYWN0b3J5OiBNb3VzZVRhcmdldEZhY3RvcnksXG5cdFx0Y3JlYXRlTW91c2VUYXJnZXQ6IChlOiBFZGl0b3JNb3VzZUV2ZW50LCB0ZXN0RXZlbnRUYXJnZXQ6IGJvb2xlYW4pID0+IElNb3VzZVRhcmdldCxcblx0XHRnZXRNb3VzZUNvbHVtbjogKGU6IEVkaXRvck1vdXNlRXZlbnQpID0+IG51bWJlclxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2NyZWF0ZU1vdXNlVGFyZ2V0ID0gY3JlYXRlTW91c2VUYXJnZXQ7XG5cdFx0dGhpcy5fZ2V0TW91c2VDb2x1bW4gPSBnZXRNb3VzZUNvbHVtbjtcblxuXHRcdHRoaXMuX21vdXNlTW92ZU1vbml0b3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgR2xvYmFsRWRpdG9yUG9pbnRlck1vdmVNb25pdG9yKHRoaXMuX3ZpZXdIZWxwZXIudmlld0RvbU5vZGUpKTtcblx0XHR0aGlzLl90b3BCb3R0b21EcmFnU2Nyb2xsaW5nID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRvcEJvdHRvbURyYWdTY3JvbGxpbmcoXG5cdFx0XHR0aGlzLl9jb250ZXh0LFxuXHRcdFx0dGhpcy5fdmlld0hlbHBlcixcblx0XHRcdHRoaXMuX21vdXNlVGFyZ2V0RmFjdG9yeSxcblx0XHRcdChwb3NpdGlvbiwgaW5TZWxlY3Rpb25Nb2RlLCByZXZlYWxUeXBlKSA9PiB0aGlzLl9kaXNwYXRjaE1vdXNlKHBvc2l0aW9uLCBpblNlbGVjdGlvbk1vZGUsIHJldmVhbFR5cGUpXG5cdFx0KSk7XG5cdFx0dGhpcy5fbW91c2VTdGF0ZSA9IG5ldyBNb3VzZURvd25TdGF0ZSgpO1xuXG5cdFx0dGhpcy5fY3VycmVudFNlbGVjdGlvbiA9IG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSk7XG5cdFx0dGhpcy5faXNBY3RpdmUgPSBmYWxzZTtcblx0XHR0aGlzLl9sYXN0TW91c2VFdmVudCA9IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgaXNBY3RpdmUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzQWN0aXZlO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Nb3VzZURvd25UaGVuTW92ZShlOiBFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fbGFzdE1vdXNlRXZlbnQgPSBlO1xuXHRcdHRoaXMuX21vdXNlU3RhdGUuc2V0TW9kaWZpZXJzKGUpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9maW5kTW91c2VQb3NpdGlvbihlLCBmYWxzZSk7XG5cdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0Ly8gSWdub3JpbmcgYmVjYXVzZSBwb3NpdGlvbiBpcyB1bmtub3duXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX21vdXNlU3RhdGUuaXNEcmFnQW5kRHJvcCkge1xuXHRcdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIuZW1pdE1vdXNlRHJhZyh7XG5cdFx0XHRcdGV2ZW50OiBlLFxuXHRcdFx0XHR0YXJnZXQ6IHBvc2l0aW9uXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHBvc2l0aW9uLnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5PVVRTSURFX0VESVRPUiAmJiAocG9zaXRpb24ub3V0c2lkZVBvc2l0aW9uID09PSAnYWJvdmUnIHx8IHBvc2l0aW9uLm91dHNpZGVQb3NpdGlvbiA9PT0gJ2JlbG93JykpIHtcblx0XHRcdFx0dGhpcy5fdG9wQm90dG9tRHJhZ1Njcm9sbGluZy5zdGFydChwb3NpdGlvbiwgZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90b3BCb3R0b21EcmFnU2Nyb2xsaW5nLnN0b3AoKTtcblx0XHRcdFx0dGhpcy5fZGlzcGF0Y2hNb3VzZShwb3NpdGlvbiwgdHJ1ZSwgTmF2aWdhdGlvbkNvbW1hbmRSZXZlYWxUeXBlLk1pbmltYWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzdGFydCh0YXJnZXRUeXBlOiBNb3VzZVRhcmdldFR5cGUsIGU6IEVkaXRvck1vdXNlRXZlbnQsIHBvaW50ZXJJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fbGFzdE1vdXNlRXZlbnQgPSBlO1xuXG5cdFx0dGhpcy5fbW91c2VTdGF0ZS5zZXRTdGFydGVkT25MaW5lTnVtYmVycyh0YXJnZXRUeXBlID09PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0xJTkVfTlVNQkVSUyk7XG5cdFx0dGhpcy5fbW91c2VTdGF0ZS5zZXRTdGFydEJ1dHRvbnMoZSk7XG5cdFx0dGhpcy5fbW91c2VTdGF0ZS5zZXRNb2RpZmllcnMoZSk7XG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9maW5kTW91c2VQb3NpdGlvbihlLCB0cnVlKTtcblx0XHRpZiAoIXBvc2l0aW9uIHx8ICFwb3NpdGlvbi5wb3NpdGlvbikge1xuXHRcdFx0Ly8gSWdub3JpbmcgYmVjYXVzZSBwb3NpdGlvbiBpcyB1bmtub3duXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbW91c2VTdGF0ZS50cnlTZXRDb3VudChlLmRldGFpbCwgcG9zaXRpb24ucG9zaXRpb24pO1xuXG5cdFx0Ly8gT3ZlcndyaXRlIHRoZSBkZXRhaWwgb2YgdGhlIE1vdXNlRXZlbnQsIGFzIGl0IHdpbGwgYmUgc2VudCBvdXQgaW4gYW4gZXZlbnQgYW5kIGNvbnRyaWJ1dGlvbnMgbWlnaHQgcmVseSBvbiBpdC5cblx0XHRlLmRldGFpbCA9IHRoaXMuX21vdXNlU3RhdGUuY291bnQ7XG5cblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cblx0XHRpZiAoIW9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZWFkT25seSlcblx0XHRcdCYmIG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5kcmFnQW5kRHJvcClcblx0XHRcdCYmICFvcHRpb25zLmdldChFZGl0b3JPcHRpb24uY29sdW1uU2VsZWN0aW9uKVxuXHRcdFx0JiYgIXRoaXMuX21vdXNlU3RhdGUuYWx0S2V5IC8vIHdlIGRvbid0IHN1cHBvcnQgbXVsdGlwbGUgbW91c2Vcblx0XHRcdCYmIGUuZGV0YWlsIDwgMiAvLyBvbmx5IHNpbmdsZSBjbGljayBvbiBhIHNlbGVjdGlvbiBjYW4gd29ya1xuXHRcdFx0JiYgIXRoaXMuX2lzQWN0aXZlIC8vIHRoZSBtb3VzZSBpcyBub3QgZG93biB5ZXRcblx0XHRcdCYmICF0aGlzLl9jdXJyZW50U2VsZWN0aW9uLmlzRW1wdHkoKSAvLyB3ZSBkb24ndCBkcmFnIHNpbmdsZSBjdXJzb3Jcblx0XHRcdCYmIChwb3NpdGlvbi50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUKSAvLyBzaW5nbGUgY2xpY2sgb24gdGV4dFxuXHRcdFx0JiYgcG9zaXRpb24ucG9zaXRpb24gJiYgdGhpcy5fY3VycmVudFNlbGVjdGlvbi5jb250YWluc1Bvc2l0aW9uKHBvc2l0aW9uLnBvc2l0aW9uKSAvLyBzaW5nbGUgY2xpY2sgb24gYSBzZWxlY3Rpb25cblx0XHQpIHtcblx0XHRcdHRoaXMuX21vdXNlU3RhdGUuaXNEcmFnQW5kRHJvcCA9IHRydWU7XG5cdFx0XHR0aGlzLl9pc0FjdGl2ZSA9IHRydWU7XG5cblx0XHRcdHRoaXMuX21vdXNlTW92ZU1vbml0b3Iuc3RhcnRNb25pdG9yaW5nKFxuXHRcdFx0XHR0aGlzLl92aWV3SGVscGVyLnZpZXdMaW5lc0RvbU5vZGUsXG5cdFx0XHRcdHBvaW50ZXJJZCxcblx0XHRcdFx0ZS5idXR0b25zLFxuXHRcdFx0XHQoZSkgPT4gdGhpcy5fb25Nb3VzZURvd25UaGVuTW92ZShlKSxcblx0XHRcdFx0KGJyb3dzZXJFdmVudD86IE1vdXNlRXZlbnQgfCBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9maW5kTW91c2VQb3NpdGlvbih0aGlzLl9sYXN0TW91c2VFdmVudCEsIGZhbHNlKTtcblxuXHRcdFx0XHRcdGlmIChkb20uaXNLZXlib2FyZEV2ZW50KGJyb3dzZXJFdmVudCkpIHtcblx0XHRcdFx0XHRcdC8vIGNhbmNlbFxuXHRcdFx0XHRcdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIuZW1pdE1vdXNlRHJvcENhbmNlbGVkKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX3ZpZXdDb250cm9sbGVyLmVtaXRNb3VzZURyb3Aoe1xuXHRcdFx0XHRcdFx0XHRldmVudDogdGhpcy5fbGFzdE1vdXNlRXZlbnQhLFxuXHRcdFx0XHRcdFx0XHR0YXJnZXQ6IChwb3NpdGlvbiA/IHRoaXMuX2NyZWF0ZU1vdXNlVGFyZ2V0KHRoaXMuX2xhc3RNb3VzZUV2ZW50ISwgdHJ1ZSkgOiBudWxsKSAvLyBJZ25vcmluZyBiZWNhdXNlIHBvc2l0aW9uIGlzIHVua25vd24sIGUuZy4sIENvbnRlbnQgVmlldyBab25lXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9zdG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9tb3VzZVN0YXRlLmlzRHJhZ0FuZERyb3AgPSBmYWxzZTtcblx0XHR0aGlzLl9kaXNwYXRjaE1vdXNlKHBvc2l0aW9uLCBlLnNoaWZ0S2V5LCBOYXZpZ2F0aW9uQ29tbWFuZFJldmVhbFR5cGUuTWluaW1hbCk7XG5cblx0XHRpZiAoIXRoaXMuX2lzQWN0aXZlKSB7XG5cdFx0XHR0aGlzLl9pc0FjdGl2ZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9tb3VzZU1vdmVNb25pdG9yLnN0YXJ0TW9uaXRvcmluZyhcblx0XHRcdFx0dGhpcy5fdmlld0hlbHBlci52aWV3TGluZXNEb21Ob2RlLFxuXHRcdFx0XHRwb2ludGVySWQsXG5cdFx0XHRcdGUuYnV0dG9ucyxcblx0XHRcdFx0KGUpID0+IHRoaXMuX29uTW91c2VEb3duVGhlbk1vdmUoZSksXG5cdFx0XHRcdCgpID0+IHRoaXMuX3N0b3AoKVxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zdG9wKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lzQWN0aXZlID0gZmFsc2U7XG5cdFx0dGhpcy5fdG9wQm90dG9tRHJhZ1Njcm9sbGluZy5zdG9wKCk7XG5cdH1cblxuXHRwdWJsaWMgb25IZWlnaHRDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuX21vdXNlTW92ZU1vbml0b3Iuc3RvcE1vbml0b3JpbmcoKTtcblx0fVxuXG5cdHB1YmxpYyBvblBvaW50ZXJVcCgpOiB2b2lkIHtcblx0XHR0aGlzLl9tb3VzZU1vdmVNb25pdG9yLnN0b3BNb25pdG9yaW5nKCk7XG5cdH1cblxuXHRwdWJsaWMgb25DdXJzb3JTdGF0ZUNoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Q3Vyc29yU3RhdGVDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJyZW50U2VsZWN0aW9uID0gZS5zZWxlY3Rpb25zWzBdO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UG9zaXRpb25PdXRzaWRlRWRpdG9yKGU6IEVkaXRvck1vdXNlRXZlbnQpOiBJTW91c2VUYXJnZXQgfCBudWxsIHtcblx0XHRjb25zdCBlZGl0b3JDb250ZW50ID0gZS5lZGl0b3JQb3M7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9jb250ZXh0LnZpZXdNb2RlbDtcblx0XHRjb25zdCB2aWV3TGF5b3V0ID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0O1xuXG5cdFx0Y29uc3QgbW91c2VDb2x1bW4gPSB0aGlzLl9nZXRNb3VzZUNvbHVtbihlKTtcblxuXHRcdGlmIChlLnBvc3kgPCBlZGl0b3JDb250ZW50LnkpIHtcblx0XHRcdGNvbnN0IG91dHNpZGVEaXN0YW5jZSA9IGVkaXRvckNvbnRlbnQueSAtIGUucG9zeTtcblx0XHRcdGNvbnN0IHZlcnRpY2FsT2Zmc2V0ID0gTWF0aC5tYXgodmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsVG9wKCkgLSBvdXRzaWRlRGlzdGFuY2UsIDApO1xuXHRcdFx0Y29uc3Qgdmlld1pvbmVEYXRhID0gSGl0VGVzdENvbnRleHQuZ2V0Wm9uZUF0Q29vcmQodGhpcy5fY29udGV4dCwgdmVydGljYWxPZmZzZXQpO1xuXHRcdFx0aWYgKHZpZXdab25lRGF0YSkge1xuXHRcdFx0XHRjb25zdCBuZXdQb3NpdGlvbiA9IHRoaXMuX2hlbHBQb3NpdGlvbkp1bXBPdmVyVmlld1pvbmUodmlld1pvbmVEYXRhKTtcblx0XHRcdFx0aWYgKG5ld1Bvc2l0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IobW91c2VDb2x1bW4sIG5ld1Bvc2l0aW9uLCAnYWJvdmUnLCBvdXRzaWRlRGlzdGFuY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFib3ZlTGluZU51bWJlciA9IHZpZXdMYXlvdXQuZ2V0TGluZU51bWJlckF0VmVydGljYWxPZmZzZXQodmVydGljYWxPZmZzZXQpO1xuXHRcdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IobW91c2VDb2x1bW4sIG5ldyBQb3NpdGlvbihhYm92ZUxpbmVOdW1iZXIsIDEpLCAnYWJvdmUnLCBvdXRzaWRlRGlzdGFuY2UpO1xuXHRcdH1cblxuXHRcdGlmIChlLnBvc3kgPiBlZGl0b3JDb250ZW50LnkgKyBlZGl0b3JDb250ZW50LmhlaWdodCkge1xuXHRcdFx0Y29uc3Qgb3V0c2lkZURpc3RhbmNlID0gZS5wb3N5IC0gZWRpdG9yQ29udGVudC55IC0gZWRpdG9yQ29udGVudC5oZWlnaHQ7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbE9mZnNldCA9IHZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbFRvcCgpICsgZS5yZWxhdGl2ZVBvcy55O1xuXHRcdFx0Y29uc3Qgdmlld1pvbmVEYXRhID0gSGl0VGVzdENvbnRleHQuZ2V0Wm9uZUF0Q29vcmQodGhpcy5fY29udGV4dCwgdmVydGljYWxPZmZzZXQpO1xuXHRcdFx0aWYgKHZpZXdab25lRGF0YSkge1xuXHRcdFx0XHRjb25zdCBuZXdQb3NpdGlvbiA9IHRoaXMuX2hlbHBQb3NpdGlvbkp1bXBPdmVyVmlld1pvbmUodmlld1pvbmVEYXRhKTtcblx0XHRcdFx0aWYgKG5ld1Bvc2l0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IobW91c2VDb2x1bW4sIG5ld1Bvc2l0aW9uLCAnYmVsb3cnLCBvdXRzaWRlRGlzdGFuY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJlbG93TGluZU51bWJlciA9IHZpZXdMYXlvdXQuZ2V0TGluZU51bWJlckF0VmVydGljYWxPZmZzZXQodmVydGljYWxPZmZzZXQpO1xuXHRcdFx0cmV0dXJuIE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IobW91c2VDb2x1bW4sIG5ldyBQb3NpdGlvbihiZWxvd0xpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oYmVsb3dMaW5lTnVtYmVyKSksICdiZWxvdycsIG91dHNpZGVEaXN0YW5jZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zc2libGVMaW5lTnVtYmVyID0gdmlld0xheW91dC5nZXRMaW5lTnVtYmVyQXRWZXJ0aWNhbE9mZnNldCh2aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKSArIGUucmVsYXRpdmVQb3MueSk7XG5cblx0XHRpZiAoZS5wb3N4IDwgZWRpdG9yQ29udGVudC54KSB7XG5cdFx0XHRjb25zdCBvdXRzaWRlRGlzdGFuY2UgPSBlZGl0b3JDb250ZW50LnggLSBlLnBvc3g7XG5cdFx0XHRyZXR1cm4gTW91c2VUYXJnZXQuY3JlYXRlT3V0c2lkZUVkaXRvcihtb3VzZUNvbHVtbiwgbmV3IFBvc2l0aW9uKHBvc3NpYmxlTGluZU51bWJlciwgMSksICdsZWZ0Jywgb3V0c2lkZURpc3RhbmNlKTtcblx0XHR9XG5cblx0XHRpZiAoZS5wb3N4ID4gZWRpdG9yQ29udGVudC54ICsgZWRpdG9yQ29udGVudC53aWR0aCkge1xuXHRcdFx0Y29uc3Qgb3V0c2lkZURpc3RhbmNlID0gZS5wb3N4IC0gZWRpdG9yQ29udGVudC54IC0gZWRpdG9yQ29udGVudC53aWR0aDtcblx0XHRcdHJldHVybiBNb3VzZVRhcmdldC5jcmVhdGVPdXRzaWRlRWRpdG9yKG1vdXNlQ29sdW1uLCBuZXcgUG9zaXRpb24ocG9zc2libGVMaW5lTnVtYmVyLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHBvc3NpYmxlTGluZU51bWJlcikpLCAncmlnaHQnLCBvdXRzaWRlRGlzdGFuY2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZE1vdXNlUG9zaXRpb24oZTogRWRpdG9yTW91c2VFdmVudCwgdGVzdEV2ZW50VGFyZ2V0OiBib29sZWFuKTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0Y29uc3QgcG9zaXRpb25PdXRzaWRlRWRpdG9yID0gdGhpcy5fZ2V0UG9zaXRpb25PdXRzaWRlRWRpdG9yKGUpO1xuXHRcdGlmIChwb3NpdGlvbk91dHNpZGVFZGl0b3IpIHtcblx0XHRcdHJldHVybiBwb3NpdGlvbk91dHNpZGVFZGl0b3I7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdCA9IHRoaXMuX2NyZWF0ZU1vdXNlVGFyZ2V0KGUsIHRlc3RFdmVudFRhcmdldCk7XG5cdFx0Y29uc3QgaGludGVkUG9zaXRpb24gPSB0LnBvc2l0aW9uO1xuXHRcdGlmICghaGludGVkUG9zaXRpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1ZJRVdfWk9ORSB8fCB0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfVklFV19aT05FKSB7XG5cdFx0XHRjb25zdCBuZXdQb3NpdGlvbiA9IHRoaXMuX2hlbHBQb3NpdGlvbkp1bXBPdmVyVmlld1pvbmUodC5kZXRhaWwpO1xuXHRcdFx0aWYgKG5ld1Bvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBNb3VzZVRhcmdldC5jcmVhdGVWaWV3Wm9uZSh0LnR5cGUsIHQuZWxlbWVudCwgdC5tb3VzZUNvbHVtbiwgbmV3UG9zaXRpb24sIHQuZGV0YWlsKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdDtcblx0fVxuXG5cdHByaXZhdGUgX2hlbHBQb3NpdGlvbkp1bXBPdmVyVmlld1pvbmUodmlld1pvbmVEYXRhOiBJTW91c2VUYXJnZXRWaWV3Wm9uZURhdGEpOiBQb3NpdGlvbiB8IG51bGwge1xuXHRcdC8vIEZvcmNlIHBvc2l0aW9uIG9uIHZpZXcgem9uZXMgdG8gZ28gYWJvdmUgb3IgYmVsb3cgZGVwZW5kaW5nIG9uIHdoZXJlIHNlbGVjdGlvbiBzdGFydGVkIGZyb21cblx0XHRjb25zdCBzZWxlY3Rpb25TdGFydCA9IG5ldyBQb3NpdGlvbih0aGlzLl9jdXJyZW50U2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0TGluZU51bWJlciwgdGhpcy5fY3VycmVudFNlbGVjdGlvbi5zZWxlY3Rpb25TdGFydENvbHVtbik7XG5cdFx0Y29uc3QgcG9zaXRpb25CZWZvcmUgPSB2aWV3Wm9uZURhdGEucG9zaXRpb25CZWZvcmU7XG5cdFx0Y29uc3QgcG9zaXRpb25BZnRlciA9IHZpZXdab25lRGF0YS5wb3NpdGlvbkFmdGVyO1xuXG5cdFx0aWYgKHBvc2l0aW9uQmVmb3JlICYmIHBvc2l0aW9uQWZ0ZXIpIHtcblx0XHRcdGlmIChwb3NpdGlvbkJlZm9yZS5pc0JlZm9yZShzZWxlY3Rpb25TdGFydCkpIHtcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uQmVmb3JlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uQWZ0ZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGlzcGF0Y2hNb3VzZShwb3NpdGlvbjogSU1vdXNlVGFyZ2V0LCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4sIHJldmVhbFR5cGU6IE5hdmlnYXRpb25Db21tYW5kUmV2ZWFsVHlwZSk6IHZvaWQge1xuXHRcdGlmICghcG9zaXRpb24ucG9zaXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIuZGlzcGF0Y2hNb3VzZSh7XG5cdFx0XHRwb3NpdGlvbjogcG9zaXRpb24ucG9zaXRpb24sXG5cdFx0XHRtb3VzZUNvbHVtbjogcG9zaXRpb24ubW91c2VDb2x1bW4sXG5cdFx0XHRzdGFydGVkT25MaW5lTnVtYmVyczogdGhpcy5fbW91c2VTdGF0ZS5zdGFydGVkT25MaW5lTnVtYmVycyxcblx0XHRcdHJldmVhbFR5cGUsXG5cblx0XHRcdGluU2VsZWN0aW9uTW9kZTogaW5TZWxlY3Rpb25Nb2RlLFxuXHRcdFx0bW91c2VEb3duQ291bnQ6IHRoaXMuX21vdXNlU3RhdGUuY291bnQsXG5cdFx0XHRhbHRLZXk6IHRoaXMuX21vdXNlU3RhdGUuYWx0S2V5LFxuXHRcdFx0Y3RybEtleTogdGhpcy5fbW91c2VTdGF0ZS5jdHJsS2V5LFxuXHRcdFx0bWV0YUtleTogdGhpcy5fbW91c2VTdGF0ZS5tZXRhS2V5LFxuXHRcdFx0c2hpZnRLZXk6IHRoaXMuX21vdXNlU3RhdGUuc2hpZnRLZXksXG5cblx0XHRcdGxlZnRCdXR0b246IHRoaXMuX21vdXNlU3RhdGUubGVmdEJ1dHRvbixcblx0XHRcdG1pZGRsZUJ1dHRvbjogdGhpcy5fbW91c2VTdGF0ZS5taWRkbGVCdXR0b24sXG5cblx0XHRcdG9uSW5qZWN0ZWRUZXh0OiBwb3NpdGlvbi50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUICYmIHBvc2l0aW9uLmRldGFpbC5pbmplY3RlZFRleHQgIT09IG51bGxcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBUb3BCb3R0b21EcmFnU2Nyb2xsaW5nIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfb3BlcmF0aW9uOiBUb3BCb3R0b21EcmFnU2Nyb2xsaW5nT3BlcmF0aW9uIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0OiBWaWV3Q29udGV4dCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92aWV3SGVscGVyOiBJUG9pbnRlckhhbmRsZXJIZWxwZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW91c2VUYXJnZXRGYWN0b3J5OiBNb3VzZVRhcmdldEZhY3RvcnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlzcGF0Y2hNb3VzZTogKHBvc2l0aW9uOiBJTW91c2VUYXJnZXQsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiwgcmV2ZWFsVHlwZTogTmF2aWdhdGlvbkNvbW1hbmRSZXZlYWxUeXBlKSA9PiB2b2lkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX29wZXJhdGlvbiA9IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5zdG9wKCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhcnQocG9zaXRpb246IElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3IsIG1vdXNlRXZlbnQ6IEVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fb3BlcmF0aW9uKSB7XG5cdFx0XHR0aGlzLl9vcGVyYXRpb24uc2V0UG9zaXRpb24ocG9zaXRpb24sIG1vdXNlRXZlbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9vcGVyYXRpb24gPSBuZXcgVG9wQm90dG9tRHJhZ1Njcm9sbGluZ09wZXJhdGlvbih0aGlzLl9jb250ZXh0LCB0aGlzLl92aWV3SGVscGVyLCB0aGlzLl9tb3VzZVRhcmdldEZhY3RvcnksIHRoaXMuX2Rpc3BhdGNoTW91c2UsIHBvc2l0aW9uLCBtb3VzZUV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RvcCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fb3BlcmF0aW9uKSB7XG5cdFx0XHR0aGlzLl9vcGVyYXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fb3BlcmF0aW9uID0gbnVsbDtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVG9wQm90dG9tRHJhZ1Njcm9sbGluZ09wZXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX3Bvc2l0aW9uOiBJTW91c2VUYXJnZXRPdXRzaWRlRWRpdG9yO1xuXHRwcml2YXRlIF9tb3VzZUV2ZW50OiBFZGl0b3JNb3VzZUV2ZW50O1xuXHRwcml2YXRlIF9sYXN0VGltZTogbnVtYmVyO1xuXHRwcml2YXRlIF9hbmltYXRpb25GcmFtZURpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHQ6IFZpZXdDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdIZWxwZXI6IElQb2ludGVySGFuZGxlckhlbHBlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb3VzZVRhcmdldEZhY3Rvcnk6IE1vdXNlVGFyZ2V0RmFjdG9yeSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwYXRjaE1vdXNlOiAocG9zaXRpb246IElNb3VzZVRhcmdldCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuLCByZXZlYWxUeXBlOiBOYXZpZ2F0aW9uQ29tbWFuZFJldmVhbFR5cGUpID0+IHZvaWQsXG5cdFx0cG9zaXRpb246IElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3IsXG5cdFx0bW91c2VFdmVudDogRWRpdG9yTW91c2VFdmVudFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Bvc2l0aW9uID0gcG9zaXRpb247XG5cdFx0dGhpcy5fbW91c2VFdmVudCA9IG1vdXNlRXZlbnQ7XG5cdFx0dGhpcy5fbGFzdFRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMuX2FuaW1hdGlvbkZyYW1lRGlzcG9zYWJsZSA9IGRvbS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGRvbS5nZXRXaW5kb3cobW91c2VFdmVudC5icm93c2VyRXZlbnQpLCAoKSA9PiB0aGlzLl9leGVjdXRlKCkpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fYW5pbWF0aW9uRnJhbWVEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0UG9zaXRpb24ocG9zaXRpb246IElNb3VzZVRhcmdldE91dHNpZGVFZGl0b3IsIG1vdXNlRXZlbnQ6IEVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdHRoaXMuX21vdXNlRXZlbnQgPSBtb3VzZUV2ZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZSBhbmQgcmV0dXJuIGVsYXBzZWQgbXMgc2luY2UgbGFzdCB0aW1lXG5cdCAqL1xuXHRwcml2YXRlIF90aWNrKCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRjb25zdCBlbGFwc2VkID0gbm93IC0gdGhpcy5fbGFzdFRpbWU7XG5cdFx0dGhpcy5fbGFzdFRpbWUgPSBub3c7XG5cdFx0cmV0dXJuIGVsYXBzZWQ7XG5cdH1cblxuXHQvKipcblx0ICogZ2V0IHRoZSBudW1iZXIgb2YgbGluZXMgcGVyIHNlY29uZCB0byBhdXRvLXNjcm9sbFxuXHQgKi9cblx0cHJpdmF0ZSBfZ2V0U2Nyb2xsU3BlZWQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCB2aWV3cG9ydEluTGluZXMgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pLmhlaWdodCAvIGxpbmVIZWlnaHQ7XG5cdFx0Y29uc3Qgb3V0c2lkZURpc3RhbmNlSW5MaW5lcyA9IHRoaXMuX3Bvc2l0aW9uLm91dHNpZGVEaXN0YW5jZSAvIGxpbmVIZWlnaHQ7XG5cblx0XHRpZiAob3V0c2lkZURpc3RhbmNlSW5MaW5lcyA8PSAxLjUpIHtcblx0XHRcdHJldHVybiBNYXRoLm1heCgzMCwgdmlld3BvcnRJbkxpbmVzICogKDEgKyBvdXRzaWRlRGlzdGFuY2VJbkxpbmVzKSk7XG5cdFx0fVxuXHRcdGlmIChvdXRzaWRlRGlzdGFuY2VJbkxpbmVzIDw9IDMpIHtcblx0XHRcdHJldHVybiBNYXRoLm1heCg2MCwgdmlld3BvcnRJbkxpbmVzICogKDIgKyBvdXRzaWRlRGlzdGFuY2VJbkxpbmVzKSk7XG5cdFx0fVxuXHRcdHJldHVybiBNYXRoLm1heCgyMDAsIHZpZXdwb3J0SW5MaW5lcyAqICg3ICsgb3V0c2lkZURpc3RhbmNlSW5MaW5lcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXhlY3V0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCBzY3JvbGxTcGVlZEluTGluZXMgPSB0aGlzLl9nZXRTY3JvbGxTcGVlZCgpO1xuXHRcdGNvbnN0IGVsYXBzZWQgPSB0aGlzLl90aWNrKCk7XG5cdFx0Y29uc3Qgc2Nyb2xsSW5QaXhlbHMgPSBzY3JvbGxTcGVlZEluTGluZXMgKiAoZWxhcHNlZCAvIDEwMDApICogbGluZUhlaWdodDtcblx0XHRjb25zdCBzY3JvbGxWYWx1ZSA9ICh0aGlzLl9wb3NpdGlvbi5vdXRzaWRlUG9zaXRpb24gPT09ICdhYm92ZScgPyAtc2Nyb2xsSW5QaXhlbHMgOiBzY3JvbGxJblBpeGVscyk7XG5cblx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC52aWV3TGF5b3V0LmRlbHRhU2Nyb2xsTm93KDAsIHNjcm9sbFZhbHVlKTtcblx0XHR0aGlzLl92aWV3SGVscGVyLnJlbmRlck5vdygpO1xuXG5cdFx0Y29uc3Qgdmlld3BvcnREYXRhID0gdGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldExpbmVzVmlld3BvcnREYXRhKCk7XG5cdFx0Y29uc3QgZWRnZUxpbmVOdW1iZXIgPSAodGhpcy5fcG9zaXRpb24ub3V0c2lkZVBvc2l0aW9uID09PSAnYWJvdmUnID8gdmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlciA6IHZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyKTtcblxuXHRcdC8vIEZpcnN0LCB0cnkgdG8gZmluZCBhIHBvc2l0aW9uIHRoYXQgbWF0Y2hlcyB0aGUgaG9yaXpvbnRhbCBwb3NpdGlvbiBvZiB0aGUgbW91c2Vcblx0XHRsZXQgbW91c2VUYXJnZXQ6IElNb3VzZVRhcmdldDtcblx0XHR7XG5cdFx0XHRjb25zdCBlZGl0b3JQb3MgPSBjcmVhdGVFZGl0b3JQYWdlUG9zaXRpb24odGhpcy5fdmlld0hlbHBlci52aWV3RG9tTm9kZSk7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0ID0gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKS5ob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0O1xuXHRcdFx0Y29uc3QgcG9zID0gbmV3IFBhZ2VDb29yZGluYXRlcyh0aGlzLl9tb3VzZUV2ZW50LnBvcy54LCBlZGl0b3JQb3MueSArIGVkaXRvclBvcy5oZWlnaHQgLSBob3Jpem9udGFsU2Nyb2xsYmFySGVpZ2h0IC0gMC4xKTtcblx0XHRcdGNvbnN0IHJlbGF0aXZlUG9zID0gY3JlYXRlQ29vcmRpbmF0ZXNSZWxhdGl2ZVRvRWRpdG9yKHRoaXMuX3ZpZXdIZWxwZXIudmlld0RvbU5vZGUsIGVkaXRvclBvcywgcG9zKTtcblx0XHRcdG1vdXNlVGFyZ2V0ID0gdGhpcy5fbW91c2VUYXJnZXRGYWN0b3J5LmNyZWF0ZU1vdXNlVGFyZ2V0KHRoaXMuX3ZpZXdIZWxwZXIuZ2V0TGFzdFJlbmRlckRhdGEoKSwgZWRpdG9yUG9zLCBwb3MsIHJlbGF0aXZlUG9zLCBudWxsKTtcblx0XHR9XG5cdFx0aWYgKCFtb3VzZVRhcmdldC5wb3NpdGlvbiB8fCBtb3VzZVRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyICE9PSBlZGdlTGluZU51bWJlcikge1xuXHRcdFx0aWYgKHRoaXMuX3Bvc2l0aW9uLm91dHNpZGVQb3NpdGlvbiA9PT0gJ2Fib3ZlJykge1xuXHRcdFx0XHRtb3VzZVRhcmdldCA9IE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IodGhpcy5fcG9zaXRpb24ubW91c2VDb2x1bW4sIG5ldyBQb3NpdGlvbihlZGdlTGluZU51bWJlciwgMSksICdhYm92ZScsIHRoaXMuX3Bvc2l0aW9uLm91dHNpZGVEaXN0YW5jZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb3VzZVRhcmdldCA9IE1vdXNlVGFyZ2V0LmNyZWF0ZU91dHNpZGVFZGl0b3IodGhpcy5fcG9zaXRpb24ubW91c2VDb2x1bW4sIG5ldyBQb3NpdGlvbihlZGdlTGluZU51bWJlciwgdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2V0TGluZU1heENvbHVtbihlZGdlTGluZU51bWJlcikpLCAnYmVsb3cnLCB0aGlzLl9wb3NpdGlvbi5vdXRzaWRlRGlzdGFuY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2Rpc3BhdGNoTW91c2UobW91c2VUYXJnZXQsIHRydWUsIE5hdmlnYXRpb25Db21tYW5kUmV2ZWFsVHlwZS5Ob25lKTtcblx0XHR0aGlzLl9hbmltYXRpb25GcmFtZURpc3Bvc2FibGUgPSBkb20uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShkb20uZ2V0V2luZG93KG1vdXNlVGFyZ2V0LmVsZW1lbnQpLCAoKSA9PiB0aGlzLl9leGVjdXRlKCkpO1xuXHR9XG59XG5cbmNsYXNzIE1vdXNlRG93blN0YXRlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTEVBUl9NT1VTRV9ET1dOX0NPVU5UX1RJTUUgPSA0MDA7IC8vIG1zXG5cblx0cHJpdmF0ZSBfYWx0S2V5OiBib29sZWFuO1xuXHRwdWJsaWMgZ2V0IGFsdEtleSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2FsdEtleTsgfVxuXG5cdHByaXZhdGUgX2N0cmxLZXk6IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgY3RybEtleSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2N0cmxLZXk7IH1cblxuXHRwcml2YXRlIF9tZXRhS2V5OiBib29sZWFuO1xuXHRwdWJsaWMgZ2V0IG1ldGFLZXkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9tZXRhS2V5OyB9XG5cblx0cHJpdmF0ZSBfc2hpZnRLZXk6IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgc2hpZnRLZXkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9zaGlmdEtleTsgfVxuXG5cdHByaXZhdGUgX2xlZnRCdXR0b246IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgbGVmdEJ1dHRvbigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2xlZnRCdXR0b247IH1cblxuXHRwcml2YXRlIF9taWRkbGVCdXR0b246IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgbWlkZGxlQnV0dG9uKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fbWlkZGxlQnV0dG9uOyB9XG5cblx0cHJpdmF0ZSBfc3RhcnRlZE9uTGluZU51bWJlcnM6IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgc3RhcnRlZE9uTGluZU51bWJlcnMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9zdGFydGVkT25MaW5lTnVtYmVyczsgfVxuXG5cdHByaXZhdGUgX2xhc3RNb3VzZURvd25Qb3NpdGlvbjogUG9zaXRpb24gfCBudWxsO1xuXHRwcml2YXRlIF9sYXN0TW91c2VEb3duUG9zaXRpb25FcXVhbENvdW50OiBudW1iZXI7XG5cdHByaXZhdGUgX2xhc3RNb3VzZURvd25Db3VudDogbnVtYmVyO1xuXHRwcml2YXRlIF9sYXN0U2V0TW91c2VEb3duQ291bnRUaW1lOiBudW1iZXI7XG5cdHB1YmxpYyBpc0RyYWdBbmREcm9wOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX2FsdEtleSA9IGZhbHNlO1xuXHRcdHRoaXMuX2N0cmxLZXkgPSBmYWxzZTtcblx0XHR0aGlzLl9tZXRhS2V5ID0gZmFsc2U7XG5cdFx0dGhpcy5fc2hpZnRLZXkgPSBmYWxzZTtcblx0XHR0aGlzLl9sZWZ0QnV0dG9uID0gZmFsc2U7XG5cdFx0dGhpcy5fbWlkZGxlQnV0dG9uID0gZmFsc2U7XG5cdFx0dGhpcy5fc3RhcnRlZE9uTGluZU51bWJlcnMgPSBmYWxzZTtcblx0XHR0aGlzLl9sYXN0TW91c2VEb3duUG9zaXRpb24gPSBudWxsO1xuXHRcdHRoaXMuX2xhc3RNb3VzZURvd25Qb3NpdGlvbkVxdWFsQ291bnQgPSAwO1xuXHRcdHRoaXMuX2xhc3RNb3VzZURvd25Db3VudCA9IDA7XG5cdFx0dGhpcy5fbGFzdFNldE1vdXNlRG93bkNvdW50VGltZSA9IDA7XG5cdFx0dGhpcy5pc0RyYWdBbmREcm9wID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xhc3RNb3VzZURvd25Db3VudDtcblx0fVxuXG5cdHB1YmxpYyBzZXRNb2RpZmllcnMoc291cmNlOiBFZGl0b3JNb3VzZUV2ZW50KSB7XG5cdFx0dGhpcy5fYWx0S2V5ID0gc291cmNlLmFsdEtleTtcblx0XHR0aGlzLl9jdHJsS2V5ID0gc291cmNlLmN0cmxLZXk7XG5cdFx0dGhpcy5fbWV0YUtleSA9IHNvdXJjZS5tZXRhS2V5O1xuXHRcdHRoaXMuX3NoaWZ0S2V5ID0gc291cmNlLnNoaWZ0S2V5O1xuXHR9XG5cblx0cHVibGljIHNldFN0YXJ0QnV0dG9ucyhzb3VyY2U6IEVkaXRvck1vdXNlRXZlbnQpIHtcblx0XHR0aGlzLl9sZWZ0QnV0dG9uID0gc291cmNlLmxlZnRCdXR0b247XG5cdFx0dGhpcy5fbWlkZGxlQnV0dG9uID0gc291cmNlLm1pZGRsZUJ1dHRvbjtcblx0fVxuXG5cdHB1YmxpYyBzZXRTdGFydGVkT25MaW5lTnVtYmVycyhzdGFydGVkT25MaW5lTnVtYmVyczogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3N0YXJ0ZWRPbkxpbmVOdW1iZXJzID0gc3RhcnRlZE9uTGluZU51bWJlcnM7XG5cdH1cblxuXHRwdWJsaWMgdHJ5U2V0Q291bnQoc2V0TW91c2VEb3duQ291bnQ6IG51bWJlciwgbmV3TW91c2VEb3duUG9zaXRpb246IFBvc2l0aW9uKTogdm9pZCB7XG5cdFx0Ly8gYS4gSW52YWxpZGF0ZSBtdWx0aXBsZSBjbGlja2luZyBpZiB0b28gbXVjaCB0aW1lIGhhcyBwYXNzZWQgKHdpbGwgYmUgaGl0IGJ5IElFIGJlY2F1c2UgdGhlIGRldGFpbCBmaWVsZCBvZiBtb3VzZSBldmVudHMgY29udGFpbnMgZ2FyYmFnZSBpbiBJRTEwKVxuXHRcdGNvbnN0IGN1cnJlbnRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHRpZiAoY3VycmVudFRpbWUgLSB0aGlzLl9sYXN0U2V0TW91c2VEb3duQ291bnRUaW1lID4gTW91c2VEb3duU3RhdGUuQ0xFQVJfTU9VU0VfRE9XTl9DT1VOVF9USU1FKSB7XG5cdFx0XHRzZXRNb3VzZURvd25Db3VudCA9IDE7XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3RTZXRNb3VzZURvd25Db3VudFRpbWUgPSBjdXJyZW50VGltZTtcblxuXHRcdC8vIGIuIEVuc3VyZSB0aGF0IHdlIGRvbid0IGp1bXAgZnJvbSBzaW5nbGUgY2xpY2sgdG8gdHJpcGxlIGNsaWNrIGluIG9uZSBnbyAod2lsbCBiZSBoaXQgYnkgSUUgYmVjYXVzZSB0aGUgZGV0YWlsIGZpZWxkIG9mIG1vdXNlIGV2ZW50cyBjb250YWlucyBnYXJiYWdlIGluIElFMTApXG5cdFx0aWYgKHNldE1vdXNlRG93bkNvdW50ID4gdGhpcy5fbGFzdE1vdXNlRG93bkNvdW50ICsgMSkge1xuXHRcdFx0c2V0TW91c2VEb3duQ291bnQgPSB0aGlzLl9sYXN0TW91c2VEb3duQ291bnQgKyAxO1xuXHRcdH1cblxuXHRcdC8vIGMuIEludmFsaWRhdGUgbXVsdGlwbGUgY2xpY2tpbmcgaWYgdGhlIGxvZ2ljYWwgcG9zaXRpb24gaXMgZGlmZmVyZW50XG5cdFx0aWYgKHRoaXMuX2xhc3RNb3VzZURvd25Qb3NpdGlvbiAmJiB0aGlzLl9sYXN0TW91c2VEb3duUG9zaXRpb24uZXF1YWxzKG5ld01vdXNlRG93blBvc2l0aW9uKSkge1xuXHRcdFx0dGhpcy5fbGFzdE1vdXNlRG93blBvc2l0aW9uRXF1YWxDb3VudCsrO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sYXN0TW91c2VEb3duUG9zaXRpb25FcXVhbENvdW50ID0gMTtcblx0XHR9XG5cdFx0dGhpcy5fbGFzdE1vdXNlRG93blBvc2l0aW9uID0gbmV3TW91c2VEb3duUG9zaXRpb247XG5cblx0XHQvLyBGaW5hbGx5IHNldCB0aGUgbGFzdE1vdXNlRG93bkNvdW50XG5cdFx0dGhpcy5fbGFzdE1vdXNlRG93bkNvdW50ID0gTWF0aC5taW4oc2V0TW91c2VEb3duQ291bnQsIHRoaXMuX2xhc3RNb3VzZURvd25Qb3NpdGlvbkVxdWFsQ291bnQpO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUE0QztBQUNyRCxTQUFTLGtCQUErQjtBQUN4QyxZQUFZLGNBQWM7QUFDMUIsU0FBUyxnQkFBZ0IsYUFBYSwwQkFBd0Q7QUFDOUYsU0FBNEUsdUJBQXVCO0FBQ25HLFNBQVMsbUJBQW1CLGtCQUFrQix5QkFBeUIsZ0NBQWdDLDBCQUEwQixtQ0FBbUMsdUJBQXVCO0FBRTNMLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBSTFCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsNEJBQTRCO0FBa0M5QixNQUFNLHFCQUFxQixpQkFBaUI7QUFBQSxFQVdsRCxZQUFZLFNBQXNCLGdCQUFnQyxZQUFtQztBQUNwRyxVQUFNO0FBSFAsU0FBUSxxQkFBeUM7QUFLaEQsU0FBSyxXQUFXO0FBQ2hCLFNBQUssaUJBQWlCO0FBQ3RCLFNB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
