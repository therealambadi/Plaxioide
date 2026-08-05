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
import * as dom from "../../../../base/browser/dom.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { TokenizationRegistry } from "../../../common/languages.js";
import { HoverOperation, HoverStartMode, HoverStartSource } from "./hoverOperation.js";
import { HoverParticipantRegistry, HoverRangeAnchor } from "./hoverTypes.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ContentHoverWidget } from "./contentHoverWidget.js";
import { ContentHoverComputer } from "./contentHoverComputer.js";
import { ContentHoverResult } from "./contentHoverTypes.js";
import { Emitter } from "../../../../base/common/event.js";
import { RenderedContentHover } from "./contentHoverRendered.js";
import { isMousePositionWithinElement } from "./hoverUtils.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let ContentHoverWidgetWrapper = class extends Disposable {
  constructor(_editor, _instantiationService, _keybindingService, _hoverService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._currentResult = null;
    this._renderedContentHover = this._register(new MutableDisposable());
    this._onContentsChanged = this._register(new Emitter());
    this.onContentsChanged = this._onContentsChanged.event;
    this._contentHoverWidget = this._register(this._instantiationService.createInstance(ContentHoverWidget, this._editor));
    this._participants = this._initializeHoverParticipants();
    this._hoverOperation = this._register(new HoverOperation(this._editor, new ContentHoverComputer(this._editor, this._participants)));
    this._registerListeners();
  }
  _initializeHoverParticipants() {
    const participants = [];
    for (const participant of HoverParticipantRegistry.getAll()) {
      const participantInstance = this._instantiationService.createInstance(participant, this._editor);
      participants.push(participantInstance);
    }
    participants.sort((p1, p2) => p1.hoverOrdinal - p2.hoverOrdinal);
    this._register(this._contentHoverWidget.onDidResize(() => {
      this._participants.forEach((participant) => participant.handleResize?.());
    }));
    this._register(this._contentHoverWidget.onDidScroll((e) => {
      this._participants.forEach((participant) => participant.handleScroll?.(e));
    }));
    return participants;
  }
  _registerListeners() {
    this._register(this._hoverOperation.onResult((result) => {
      const messages = result.hasLoadingMessage ? this._addLoadingMessage(result) : result.value;
      this._withResult(new ContentHoverResult(messages, result.isComplete, result.options));
    }));
    const contentHoverWidgetNode = this._contentHoverWidget.getDomNode();
    this._register(dom.addStandardDisposableListener(contentHoverWidgetNode, "keydown", (e) => {
      if (e.equals(KeyCode.Escape)) {
        this.hide();
      }
    }));
    this._register(dom.addStandardDisposableListener(contentHoverWidgetNode, "mouseleave", (e) => {
      this._onMouseLeave(e);
    }));
    this._register(TokenizationRegistry.onDidChange(() => {
      if (this._contentHoverWidget.position && this._currentResult) {
        this._setCurrentResult(this._currentResult);
      }
    }));
  }
  /**
   * Returns true if the hover shows now or will show.
   */
  _startShowingOrUpdateHover(anchor, mode, source, focus, mouseEvent) {
    const contentHoverIsVisible = this._contentHoverWidget.position && this._currentResult;
    if (!contentHoverIsVisible) {
      if (anchor) {
        this._startHoverOperationIfNecessary(anchor, mode, source, focus, false);
        return true;
      }
      return false;
    }
    const isHoverSticky = this._editor.getOption(EditorOption.hover).sticky;
    const isMouseGettingCloser = mouseEvent && this._contentHoverWidget.isMouseGettingCloser(mouseEvent.event.posx, mouseEvent.event.posy);
    const isHoverStickyAndIsMouseGettingCloser = isHoverSticky && isMouseGettingCloser;
    if (isHoverStickyAndIsMouseGettingCloser) {
      if (anchor) {
        this._startHoverOperationIfNecessary(anchor, mode, source, focus, true);
      }
      return true;
    }
    if (!anchor) {
      this._setCurrentResult(null);
      return false;
    }
    const currentAnchorEqualsPreviousAnchor = this._currentResult && this._currentResult.options.anchor.equals(anchor);
    if (currentAnchorEqualsPreviousAnchor) {
      return true;
    }
    const currentAnchorCompatibleWithPreviousAnchor = this._currentResult && anchor.canAdoptVisibleHover(this._currentResult.options.anchor, this._contentHoverWidget.position);
    if (!currentAnchorCompatibleWithPreviousAnchor) {
      this._setCurrentResult(null);
      this._startHoverOperationIfNecessary(anchor, mode, source, focus, false);
      return true;
    }
    if (this._currentResult) {
      this._setCurrentResult(this._currentResult.filter(anchor));
    }
    this._startHoverOperationIfNecessary(anchor, mode, source, focus, false);
    return true;
  }
  _startHoverOperationIfNecessary(anchor, mode, source, shouldFocus, insistOnKeepingHoverVisible) {
    const currentAnchorEqualToPreviousHover = this._hoverOperation.options && this._hoverOperation.options.anchor.equals(anchor);
    if (currentAnchorEqualToPreviousHover) {
      return;
    }
    this._hoverOperation.cancel();
    const contentHoverComputerOptions = {
      anchor,
      source,
      shouldFocus,
      insistOnKeepingHoverVisible
    };
    this._hoverOperation.start(mode, contentHoverComputerOptions);
  }
  _setCurrentResult(hoverResult) {
    let currentHoverResult = hoverResult;
    const currentResultEqualToPreviousResult = this._currentResult === currentHoverResult;
    if (currentResultEqualToPreviousResult) {
      return;
    }
    const currentHoverResultIsEmpty = currentHoverResult && currentHoverResult.hoverParts.length === 0;
    if (currentHoverResultIsEmpty) {
      currentHoverResult = null;
    }
    this._currentResult = currentHoverResult;
    if (this._currentResult) {
      this._showHover(this._currentResult);
    } else {
      this._hideHover();
    }
  }
  _addLoadingMessage(hoverResult) {
    for (const participant of this._participants) {
      if (!participant.createLoadingMessage) {
        continue;
      }
      const loadingMessage = participant.createLoadingMessage(hoverResult.options.anchor);
      if (!loadingMessage) {
        continue;
      }
      return hoverResult.value.slice(0).concat([loadingMessage]);
    }
    return hoverResult.value;
  }
  _withResult(hoverResult) {
    const previousHoverIsVisibleWithCompleteResult = this._contentHoverWidget.position && this._currentResult && this._currentResult.isComplete;
    if (!previousHoverIsVisibleWithCompleteResult) {
      this._setCurrentResult(hoverResult);
    }
    const isCurrentHoverResultComplete = hoverResult.isComplete;
    if (!isCurrentHoverResultComplete) {
      return;
    }
    const currentHoverResultIsEmpty = hoverResult.hoverParts.length === 0;
    const insistOnKeepingPreviousHoverVisible = hoverResult.options.insistOnKeepingHoverVisible;
    const shouldKeepPreviousHoverVisible = currentHoverResultIsEmpty && insistOnKeepingPreviousHoverVisible;
    if (shouldKeepPreviousHoverVisible) {
      return;
    }
    this._setCurrentResult(hoverResult);
  }
  _showHover(hoverResult) {
    const context = this._getHoverContext();
    this._renderedContentHover.value = new RenderedContentHover(this._editor, hoverResult, this._participants, context, this._keybindingService, this._hoverService);
    if (this._renderedContentHover.value.domNodeHasChildren) {
      this._contentHoverWidget.show(this._renderedContentHover.value);
    } else {
      this._renderedContentHover.clear();
    }
  }
  _hideHover() {
    this._contentHoverWidget.hide();
    this._participants.forEach((participant) => participant.handleHide?.());
  }
  _getHoverContext() {
    const hide = () => {
      this.hide();
    };
    const onContentsChanged = () => {
      this._onContentsChanged.fire();
      this._contentHoverWidget.onContentsChanged();
    };
    const setMinimumDimensions = (dimensions) => {
      this._contentHoverWidget.setMinimumDimensions(dimensions);
    };
    const focus = () => this.focus();
    return { hide, onContentsChanged, setMinimumDimensions, focus };
  }
  showsOrWillShow(mouseEvent) {
    const isContentWidgetResizing = this._contentHoverWidget.isResizing;
    if (isContentWidgetResizing) {
      return true;
    }
    const anchorCandidates = this._findHoverAnchorCandidates(mouseEvent);
    const anchorCandidatesExist = anchorCandidates.length > 0;
    if (!anchorCandidatesExist) {
      return this._startShowingOrUpdateHover(null, HoverStartMode.Delayed, HoverStartSource.Mouse, false, mouseEvent);
    }
    const anchor = anchorCandidates[0];
    return this._startShowingOrUpdateHover(anchor, HoverStartMode.Delayed, HoverStartSource.Mouse, false, mouseEvent);
  }
  _findHoverAnchorCandidates(mouseEvent) {
    const anchorCandidates = [];
    for (const participant of this._participants) {
      if (!participant.suggestHoverAnchor) {
        continue;
      }
      const anchor = participant.suggestHoverAnchor(mouseEvent);
      if (!anchor) {
        continue;
      }
      anchorCandidates.push(anchor);
    }
    const target = mouseEvent.target;
    switch (target.type) {
      case MouseTargetType.CONTENT_TEXT: {
        anchorCandidates.push(new HoverRangeAnchor(0, target.range, mouseEvent.event.posx, mouseEvent.event.posy));
        break;
      }
      case MouseTargetType.CONTENT_EMPTY: {
        const epsilon = this._editor.getOption(EditorOption.fontInfo).typicalHalfwidthCharacterWidth / 2;
        const mouseIsWithinLinesAndCloseToHover = !target.detail.isAfterLines && typeof target.detail.horizontalDistanceToText === "number" && target.detail.horizontalDistanceToText < epsilon;
        if (!mouseIsWithinLinesAndCloseToHover) {
          break;
        }
        anchorCandidates.push(new HoverRangeAnchor(0, target.range, mouseEvent.event.posx, mouseEvent.event.posy));
        break;
      }
    }
    anchorCandidates.sort((a, b) => b.priority - a.priority);
    return anchorCandidates;
  }
  _onMouseLeave(e) {
    const editorDomNode = this._editor.getDomNode();
    const isMousePositionOutsideOfEditor = !editorDomNode || !isMousePositionWithinElement(editorDomNode, e.x, e.y);
    if (isMousePositionOutsideOfEditor) {
      this.hide();
    }
  }
  startShowingAtRange(range, mode, source, focus) {
    this._startShowingOrUpdateHover(new HoverRangeAnchor(0, range, void 0, void 0), mode, source, focus, null);
  }
  getWidgetContent() {
    const node = this._contentHoverWidget.getDomNode();
    if (!node.textContent) {
      return void 0;
    }
    return node.textContent;
  }
  async updateHoverVerbosityLevel(action, index, focus) {
    this._renderedContentHover.value?.updateHoverVerbosityLevel(action, index, focus);
  }
  doesHoverAtIndexSupportVerbosityAction(index, action) {
    return this._renderedContentHover.value?.doesHoverAtIndexSupportVerbosityAction(index, action) ?? false;
  }
  getAccessibleWidgetContent() {
    return this._renderedContentHover.value?.getAccessibleWidgetContent();
  }
  getAccessibleWidgetContentAtIndex(index) {
    return this._renderedContentHover.value?.getAccessibleWidgetContentAtIndex(index);
  }
  focusedHoverPartIndex() {
    return this._renderedContentHover.value?.focusedHoverPartIndex ?? -1;
  }
  containsNode(node) {
    return node ? this._contentHoverWidget.getDomNode().contains(node) : false;
  }
  focus() {
    const hoverPartsCount = this._renderedContentHover.value?.hoverPartsCount;
    if (hoverPartsCount === 1) {
      this.focusHoverPartWithIndex(0);
      return;
    }
    this._contentHoverWidget.focus();
  }
  focusHoverPartWithIndex(index) {
    this._renderedContentHover.value?.focusHoverPartWithIndex(index);
  }
  scrollUp() {
    this._contentHoverWidget.scrollUp();
  }
  scrollDown() {
    this._contentHoverWidget.scrollDown();
  }
  scrollLeft() {
    this._contentHoverWidget.scrollLeft();
  }
  scrollRight() {
    this._contentHoverWidget.scrollRight();
  }
  pageUp() {
    this._contentHoverWidget.pageUp();
  }
  pageDown() {
    this._contentHoverWidget.pageDown();
  }
  goToTop() {
    this._contentHoverWidget.goToTop();
  }
  goToBottom() {
    this._contentHoverWidget.goToBottom();
  }
  hide() {
    this._hoverOperation.cancel();
    this._setCurrentResult(null);
  }
  getDomNode() {
    return this._contentHoverWidget.getDomNode();
  }
  get isColorPickerVisible() {
    return this._renderedContentHover.value?.isColorPickerVisible() ?? false;
  }
  get isVisibleFromKeyboard() {
    return this._contentHoverWidget.isVisibleFromKeyboard;
  }
  get isVisible() {
    return this._contentHoverWidget.isVisible;
  }
  get isFocused() {
    return this._contentHoverWidget.isFocused;
  }
  get isResizing() {
    return this._contentHoverWidget.isResizing;
  }
  get widget() {
    return this._contentHoverWidget;
  }
};
ContentHoverWidgetWrapper = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IHoverService)
], ContentHoverWidgetWrapper);
export {
  ContentHoverWidgetWrapper
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlcldpZGdldFdyYXBwZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElFZGl0b3JNb3VzZUV2ZW50LCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IEhvdmVyT3BlcmF0aW9uLCBIb3ZlclJlc3VsdCwgSG92ZXJTdGFydE1vZGUsIEhvdmVyU3RhcnRTb3VyY2UgfSBmcm9tICcuL2hvdmVyT3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IEhvdmVyQW5jaG9yLCBIb3ZlclBhcnRpY2lwYW50UmVnaXN0cnksIEhvdmVyUmFuZ2VBbmNob3IsIElFZGl0b3JIb3ZlckNvbnRleHQsIElFZGl0b3JIb3ZlclBhcnRpY2lwYW50LCBJSG92ZXJQYXJ0LCBJSG92ZXJXaWRnZXQgfSBmcm9tICcuL2hvdmVyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEhvdmVyVmVyYm9zaXR5QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3N0YW5kYWxvbmUvc3RhbmRhbG9uZUVudW1zLmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlcldpZGdldCB9IGZyb20gJy4vY29udGVudEhvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlckNvbXB1dGVyLCBDb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMgfSBmcm9tICcuL2NvbnRlbnRIb3ZlckNvbXB1dGVyLmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlclJlc3VsdCB9IGZyb20gJy4vY29udGVudEhvdmVyVHlwZXMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFJlbmRlcmVkQ29udGVudEhvdmVyIH0gZnJvbSAnLi9jb250ZW50SG92ZXJSZW5kZXJlZC5qcyc7XG5pbXBvcnQgeyBpc01vdXNlUG9zaXRpb25XaXRoaW5FbGVtZW50IH0gZnJvbSAnLi9ob3ZlclV0aWxzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcblxuZXhwb3J0IGNsYXNzIENvbnRlbnRIb3ZlcldpZGdldFdyYXBwZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUhvdmVyV2lkZ2V0IHtcblxuXHRwcml2YXRlIF9jdXJyZW50UmVzdWx0OiBDb250ZW50SG92ZXJSZXN1bHQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVuZGVyZWRDb250ZW50SG92ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8UmVuZGVyZWRDb250ZW50SG92ZXI+KCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRlbnRIb3ZlcldpZGdldDogQ29udGVudEhvdmVyV2lkZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wYXJ0aWNpcGFudHM6IElFZGl0b3JIb3ZlclBhcnRpY2lwYW50W107XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyT3BlcmF0aW9uOiBIb3Zlck9wZXJhdGlvbjxDb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMsIElIb3ZlclBhcnQ+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ29udGVudHNDaGFuZ2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkNvbnRlbnRzQ2hhbmdlZCA9IHRoaXMuX29uQ29udGVudHNDaGFuZ2VkLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb250ZW50SG92ZXJXaWRnZXQsIHRoaXMuX2VkaXRvcikpO1xuXHRcdHRoaXMuX3BhcnRpY2lwYW50cyA9IHRoaXMuX2luaXRpYWxpemVIb3ZlclBhcnRpY2lwYW50cygpO1xuXHRcdHRoaXMuX2hvdmVyT3BlcmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEhvdmVyT3BlcmF0aW9uKHRoaXMuX2VkaXRvciwgbmV3IENvbnRlbnRIb3ZlckNvbXB1dGVyKHRoaXMuX2VkaXRvciwgdGhpcy5fcGFydGljaXBhbnRzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9pbml0aWFsaXplSG92ZXJQYXJ0aWNpcGFudHMoKTogSUVkaXRvckhvdmVyUGFydGljaXBhbnRbXSB7XG5cdFx0Y29uc3QgcGFydGljaXBhbnRzOiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBIb3ZlclBhcnRpY2lwYW50UmVnaXN0cnkuZ2V0QWxsKCkpIHtcblx0XHRcdGNvbnN0IHBhcnRpY2lwYW50SW5zdGFuY2UgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShwYXJ0aWNpcGFudCwgdGhpcy5fZWRpdG9yKTtcblx0XHRcdHBhcnRpY2lwYW50cy5wdXNoKHBhcnRpY2lwYW50SW5zdGFuY2UpO1xuXHRcdH1cblx0XHRwYXJ0aWNpcGFudHMuc29ydCgocDEsIHAyKSA9PiBwMS5ob3Zlck9yZGluYWwgLSBwMi5ob3Zlck9yZGluYWwpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5vbkRpZFJlc2l6ZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9wYXJ0aWNpcGFudHMuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiBwYXJ0aWNpcGFudC5oYW5kbGVSZXNpemU/LigpKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29udGVudEhvdmVyV2lkZ2V0Lm9uRGlkU2Nyb2xsKChlKSA9PiB7XG5cdFx0XHR0aGlzLl9wYXJ0aWNpcGFudHMuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiBwYXJ0aWNpcGFudC5oYW5kbGVTY3JvbGw/LihlKSk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiBwYXJ0aWNpcGFudHM7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ob3Zlck9wZXJhdGlvbi5vblJlc3VsdCgocmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBtZXNzYWdlcyA9IChyZXN1bHQuaGFzTG9hZGluZ01lc3NhZ2UgPyB0aGlzLl9hZGRMb2FkaW5nTWVzc2FnZShyZXN1bHQpIDogcmVzdWx0LnZhbHVlKTtcblx0XHRcdHRoaXMuX3dpdGhSZXN1bHQobmV3IENvbnRlbnRIb3ZlclJlc3VsdChtZXNzYWdlcywgcmVzdWx0LmlzQ29tcGxldGUsIHJlc3VsdC5vcHRpb25zKSk7XG5cdFx0fSkpO1xuXHRcdGNvbnN0IGNvbnRlbnRIb3ZlcldpZGdldE5vZGUgPSB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuZ2V0RG9tTm9kZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihjb250ZW50SG92ZXJXaWRnZXROb2RlLCAna2V5ZG93bicsIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoY29udGVudEhvdmVyV2lkZ2V0Tm9kZSwgJ21vdXNlbGVhdmUnLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5fb25Nb3VzZUxlYXZlKGUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihUb2tlbml6YXRpb25SZWdpc3RyeS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnBvc2l0aW9uICYmIHRoaXMuX2N1cnJlbnRSZXN1bHQpIHtcblx0XHRcdFx0dGhpcy5fc2V0Q3VycmVudFJlc3VsdCh0aGlzLl9jdXJyZW50UmVzdWx0KTsgLy8gcmVuZGVyIGFnYWluXG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaG92ZXIgc2hvd3Mgbm93IG9yIHdpbGwgc2hvdy5cblx0ICovXG5cdHByaXZhdGUgX3N0YXJ0U2hvd2luZ09yVXBkYXRlSG92ZXIoXG5cdFx0YW5jaG9yOiBIb3ZlckFuY2hvciB8IG51bGwsXG5cdFx0bW9kZTogSG92ZXJTdGFydE1vZGUsXG5cdFx0c291cmNlOiBIb3ZlclN0YXJ0U291cmNlLFxuXHRcdGZvY3VzOiBib29sZWFuLFxuXHRcdG1vdXNlRXZlbnQ6IElFZGl0b3JNb3VzZUV2ZW50IHwgbnVsbFxuXHQpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb250ZW50SG92ZXJJc1Zpc2libGUgPSB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQucG9zaXRpb24gJiYgdGhpcy5fY3VycmVudFJlc3VsdDtcblx0XHRpZiAoIWNvbnRlbnRIb3ZlcklzVmlzaWJsZSkge1xuXHRcdFx0aWYgKGFuY2hvcikge1xuXHRcdFx0XHR0aGlzLl9zdGFydEhvdmVyT3BlcmF0aW9uSWZOZWNlc3NhcnkoYW5jaG9yLCBtb2RlLCBzb3VyY2UsIGZvY3VzLCBmYWxzZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBpc0hvdmVyU3RpY2t5ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uaG92ZXIpLnN0aWNreTtcblx0XHRjb25zdCBpc01vdXNlR2V0dGluZ0Nsb3NlciA9IG1vdXNlRXZlbnQgJiYgdGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LmlzTW91c2VHZXR0aW5nQ2xvc2VyKG1vdXNlRXZlbnQuZXZlbnQucG9zeCwgbW91c2VFdmVudC5ldmVudC5wb3N5KTtcblx0XHRjb25zdCBpc0hvdmVyU3RpY2t5QW5kSXNNb3VzZUdldHRpbmdDbG9zZXIgPSBpc0hvdmVyU3RpY2t5ICYmIGlzTW91c2VHZXR0aW5nQ2xvc2VyO1xuXHRcdC8vIFRoZSBtb3VzZSBpcyBnZXR0aW5nIGNsb3NlciB0byB0aGUgaG92ZXIsIHNvIHdlIHdpbGwga2VlcCB0aGUgaG92ZXIgdW50b3VjaGVkXG5cdFx0Ly8gQnV0IHdlIHdpbGwga2ljayBvZmYgYSBob3ZlciB1cGRhdGUgYXQgdGhlIG5ldyBhbmNob3IsIGluc2lzdGluZyBvbiBrZWVwaW5nIHRoZSBob3ZlciB2aXNpYmxlLlxuXHRcdGlmIChpc0hvdmVyU3RpY2t5QW5kSXNNb3VzZUdldHRpbmdDbG9zZXIpIHtcblx0XHRcdGlmIChhbmNob3IpIHtcblx0XHRcdFx0dGhpcy5fc3RhcnRIb3Zlck9wZXJhdGlvbklmTmVjZXNzYXJ5KGFuY2hvciwgbW9kZSwgc291cmNlLCBmb2N1cywgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Ly8gSWYgbW91c2UgaXMgbm90IGdldHRpbmcgY2xvc2VyIGFuZCBhbmNob3Igbm90IGRlZmluZWQsIGhpZGUgdGhlIGhvdmVyXG5cdFx0aWYgKCFhbmNob3IpIHtcblx0XHRcdHRoaXMuX3NldEN1cnJlbnRSZXN1bHQobnVsbCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIElmIG1vdXNlIGlmIG5vdCBnZXR0aW5nIGNsb3NlciBhbmQgYW5jaG9yIGlzIGRlZmluZWQsIGFuZCB0aGUgbmV3IGFuY2hvciBpcyB0aGUgc2FtZSBhcyB0aGUgcHJldmlvdXMgYW5jaG9yXG5cdFx0Y29uc3QgY3VycmVudEFuY2hvckVxdWFsc1ByZXZpb3VzQW5jaG9yID0gdGhpcy5fY3VycmVudFJlc3VsdCAmJiB0aGlzLl9jdXJyZW50UmVzdWx0Lm9wdGlvbnMuYW5jaG9yLmVxdWFscyhhbmNob3IpO1xuXHRcdGlmIChjdXJyZW50QW5jaG9yRXF1YWxzUHJldmlvdXNBbmNob3IpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHQvLyBJZiBtb3VzZSBpZiBub3QgZ2V0dGluZyBjbG9zZXIgYW5kIGFuY2hvciBpcyBkZWZpbmVkLCBhbmQgdGhlIG5ldyBhbmNob3IgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgYW5jaG9yXG5cdFx0Y29uc3QgY3VycmVudEFuY2hvckNvbXBhdGlibGVXaXRoUHJldmlvdXNBbmNob3IgPSB0aGlzLl9jdXJyZW50UmVzdWx0ICYmIGFuY2hvci5jYW5BZG9wdFZpc2libGVIb3Zlcih0aGlzLl9jdXJyZW50UmVzdWx0Lm9wdGlvbnMuYW5jaG9yLCB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQucG9zaXRpb24pO1xuXHRcdGlmICghY3VycmVudEFuY2hvckNvbXBhdGlibGVXaXRoUHJldmlvdXNBbmNob3IpIHtcblx0XHRcdHRoaXMuX3NldEN1cnJlbnRSZXN1bHQobnVsbCk7XG5cdFx0XHR0aGlzLl9zdGFydEhvdmVyT3BlcmF0aW9uSWZOZWNlc3NhcnkoYW5jaG9yLCBtb2RlLCBzb3VyY2UsIGZvY3VzLCBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Ly8gV2UgYXJlbid0IGdldHRpbmcgYW55IGNsb3NlciB0byB0aGUgaG92ZXIsIHNvIHdlIHdpbGwgZmlsdGVyIGV4aXN0aW5nIHJlc3VsdHNcblx0XHQvLyBhbmQga2VlcCB0aG9zZSB3aGljaCBhbHNvIGFwcGx5IHRvIHRoZSBuZXcgYW5jaG9yLlxuXHRcdGlmICh0aGlzLl9jdXJyZW50UmVzdWx0KSB7XG5cdFx0XHR0aGlzLl9zZXRDdXJyZW50UmVzdWx0KHRoaXMuX2N1cnJlbnRSZXN1bHQuZmlsdGVyKGFuY2hvcikpO1xuXHRcdH1cblx0XHR0aGlzLl9zdGFydEhvdmVyT3BlcmF0aW9uSWZOZWNlc3NhcnkoYW5jaG9yLCBtb2RlLCBzb3VyY2UsIGZvY3VzLCBmYWxzZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIF9zdGFydEhvdmVyT3BlcmF0aW9uSWZOZWNlc3NhcnkoYW5jaG9yOiBIb3ZlckFuY2hvciwgbW9kZTogSG92ZXJTdGFydE1vZGUsIHNvdXJjZTogSG92ZXJTdGFydFNvdXJjZSwgc2hvdWxkRm9jdXM6IGJvb2xlYW4sIGluc2lzdE9uS2VlcGluZ0hvdmVyVmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRBbmNob3JFcXVhbFRvUHJldmlvdXNIb3ZlciA9IHRoaXMuX2hvdmVyT3BlcmF0aW9uLm9wdGlvbnMgJiYgdGhpcy5faG92ZXJPcGVyYXRpb24ub3B0aW9ucy5hbmNob3IuZXF1YWxzKGFuY2hvcik7XG5cdFx0aWYgKGN1cnJlbnRBbmNob3JFcXVhbFRvUHJldmlvdXNIb3Zlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9ob3Zlck9wZXJhdGlvbi5jYW5jZWwoKTtcblx0XHRjb25zdCBjb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnM6IENvbnRlbnRIb3ZlckNvbXB1dGVyT3B0aW9ucyA9IHtcblx0XHRcdGFuY2hvcixcblx0XHRcdHNvdXJjZSxcblx0XHRcdHNob3VsZEZvY3VzLFxuXHRcdFx0aW5zaXN0T25LZWVwaW5nSG92ZXJWaXNpYmxlXG5cdFx0fTtcblx0XHR0aGlzLl9ob3Zlck9wZXJhdGlvbi5zdGFydChtb2RlLCBjb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0Q3VycmVudFJlc3VsdChob3ZlclJlc3VsdDogQ29udGVudEhvdmVyUmVzdWx0IHwgbnVsbCk6IHZvaWQge1xuXHRcdGxldCBjdXJyZW50SG92ZXJSZXN1bHQgPSBob3ZlclJlc3VsdDtcblx0XHRjb25zdCBjdXJyZW50UmVzdWx0RXF1YWxUb1ByZXZpb3VzUmVzdWx0ID0gdGhpcy5fY3VycmVudFJlc3VsdCA9PT0gY3VycmVudEhvdmVyUmVzdWx0O1xuXHRcdGlmIChjdXJyZW50UmVzdWx0RXF1YWxUb1ByZXZpb3VzUmVzdWx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRIb3ZlclJlc3VsdElzRW1wdHkgPSBjdXJyZW50SG92ZXJSZXN1bHQgJiYgY3VycmVudEhvdmVyUmVzdWx0LmhvdmVyUGFydHMubGVuZ3RoID09PSAwO1xuXHRcdGlmIChjdXJyZW50SG92ZXJSZXN1bHRJc0VtcHR5KSB7XG5cdFx0XHRjdXJyZW50SG92ZXJSZXN1bHQgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLl9jdXJyZW50UmVzdWx0ID0gY3VycmVudEhvdmVyUmVzdWx0O1xuXHRcdGlmICh0aGlzLl9jdXJyZW50UmVzdWx0KSB7XG5cdFx0XHR0aGlzLl9zaG93SG92ZXIodGhpcy5fY3VycmVudFJlc3VsdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2hpZGVIb3ZlcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FkZExvYWRpbmdNZXNzYWdlKGhvdmVyUmVzdWx0OiBIb3ZlclJlc3VsdDxDb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMsIElIb3ZlclBhcnQ+KTogSUhvdmVyUGFydFtdIHtcblx0XHRmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIHRoaXMuX3BhcnRpY2lwYW50cykge1xuXHRcdFx0aWYgKCFwYXJ0aWNpcGFudC5jcmVhdGVMb2FkaW5nTWVzc2FnZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxvYWRpbmdNZXNzYWdlID0gcGFydGljaXBhbnQuY3JlYXRlTG9hZGluZ01lc3NhZ2UoaG92ZXJSZXN1bHQub3B0aW9ucy5hbmNob3IpO1xuXHRcdFx0aWYgKCFsb2FkaW5nTWVzc2FnZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBob3ZlclJlc3VsdC52YWx1ZS5zbGljZSgwKS5jb25jYXQoW2xvYWRpbmdNZXNzYWdlXSk7XG5cdFx0fVxuXHRcdHJldHVybiBob3ZlclJlc3VsdC52YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3dpdGhSZXN1bHQoaG92ZXJSZXN1bHQ6IENvbnRlbnRIb3ZlclJlc3VsdCk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzSG92ZXJJc1Zpc2libGVXaXRoQ29tcGxldGVSZXN1bHQgPSB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQucG9zaXRpb24gJiYgdGhpcy5fY3VycmVudFJlc3VsdCAmJiB0aGlzLl9jdXJyZW50UmVzdWx0LmlzQ29tcGxldGU7XG5cdFx0aWYgKCFwcmV2aW91c0hvdmVySXNWaXNpYmxlV2l0aENvbXBsZXRlUmVzdWx0KSB7XG5cdFx0XHR0aGlzLl9zZXRDdXJyZW50UmVzdWx0KGhvdmVyUmVzdWx0KTtcblx0XHR9XG5cdFx0Ly8gVGhlIGhvdmVyIGlzIHZpc2libGUgd2l0aCBhIHByZXZpb3VzIGNvbXBsZXRlIHJlc3VsdC5cblx0XHRjb25zdCBpc0N1cnJlbnRIb3ZlclJlc3VsdENvbXBsZXRlID0gaG92ZXJSZXN1bHQuaXNDb21wbGV0ZTtcblx0XHRpZiAoIWlzQ3VycmVudEhvdmVyUmVzdWx0Q29tcGxldGUpIHtcblx0XHRcdC8vIEluc3RlYWQgb2YgcmVuZGVyaW5nIHRoZSBuZXcgcGFydGlhbCByZXN1bHQsIHdlIHdhaXQgZm9yIHRoZSByZXN1bHQgdG8gYmUgY29tcGxldGUuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRIb3ZlclJlc3VsdElzRW1wdHkgPSBob3ZlclJlc3VsdC5ob3ZlclBhcnRzLmxlbmd0aCA9PT0gMDtcblx0XHRjb25zdCBpbnNpc3RPbktlZXBpbmdQcmV2aW91c0hvdmVyVmlzaWJsZSA9IGhvdmVyUmVzdWx0Lm9wdGlvbnMuaW5zaXN0T25LZWVwaW5nSG92ZXJWaXNpYmxlO1xuXHRcdGNvbnN0IHNob3VsZEtlZXBQcmV2aW91c0hvdmVyVmlzaWJsZSA9IGN1cnJlbnRIb3ZlclJlc3VsdElzRW1wdHkgJiYgaW5zaXN0T25LZWVwaW5nUHJldmlvdXNIb3ZlclZpc2libGU7XG5cdFx0aWYgKHNob3VsZEtlZXBQcmV2aW91c0hvdmVyVmlzaWJsZSkge1xuXHRcdFx0Ly8gVGhlIGhvdmVyIHdvdWxkIG5vdyBoaWRlIG5vcm1hbGx5LCBzbyB3ZSdsbCBrZWVwIHRoZSBwcmV2aW91cyBtZXNzYWdlc1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9zZXRDdXJyZW50UmVzdWx0KGhvdmVyUmVzdWx0KTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dIb3Zlcihob3ZlclJlc3VsdDogQ29udGVudEhvdmVyUmVzdWx0KTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGV4dCA9IHRoaXMuX2dldEhvdmVyQ29udGV4dCgpO1xuXHRcdHRoaXMuX3JlbmRlcmVkQ29udGVudEhvdmVyLnZhbHVlID0gbmV3IFJlbmRlcmVkQ29udGVudEhvdmVyKHRoaXMuX2VkaXRvciwgaG92ZXJSZXN1bHQsIHRoaXMuX3BhcnRpY2lwYW50cywgY29udGV4dCwgdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuX2hvdmVyU2VydmljZSk7XG5cdFx0aWYgKHRoaXMuX3JlbmRlcmVkQ29udGVudEhvdmVyLnZhbHVlLmRvbU5vZGVIYXNDaGlsZHJlbikge1xuXHRcdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnNob3codGhpcy5fcmVuZGVyZWRDb250ZW50SG92ZXIudmFsdWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yZW5kZXJlZENvbnRlbnRIb3Zlci5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hpZGVIb3ZlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuaGlkZSgpO1xuXHRcdHRoaXMuX3BhcnRpY2lwYW50cy5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IHBhcnRpY2lwYW50LmhhbmRsZUhpZGU/LigpKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhvdmVyQ29udGV4dCgpOiBJRWRpdG9ySG92ZXJDb250ZXh0IHtcblx0XHRjb25zdCBoaWRlID0gKCkgPT4ge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0fTtcblx0XHRjb25zdCBvbkNvbnRlbnRzQ2hhbmdlZCA9ICgpID0+IHtcblx0XHRcdHRoaXMuX29uQ29udGVudHNDaGFuZ2VkLmZpcmUoKTtcblx0XHRcdHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5vbkNvbnRlbnRzQ2hhbmdlZCgpO1xuXHRcdH07XG5cdFx0Y29uc3Qgc2V0TWluaW11bURpbWVuc2lvbnMgPSAoZGltZW5zaW9uczogZG9tLkRpbWVuc2lvbikgPT4ge1xuXHRcdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnNldE1pbmltdW1EaW1lbnNpb25zKGRpbWVuc2lvbnMpO1xuXHRcdH07XG5cdFx0Y29uc3QgZm9jdXMgPSAoKSA9PiB0aGlzLmZvY3VzKCk7XG5cdFx0cmV0dXJuIHsgaGlkZSwgb25Db250ZW50c0NoYW5nZWQsIHNldE1pbmltdW1EaW1lbnNpb25zLCBmb2N1cyB9O1xuXHR9XG5cblxuXHRwdWJsaWMgc2hvd3NPcldpbGxTaG93KG1vdXNlRXZlbnQ6IElFZGl0b3JNb3VzZUV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaXNDb250ZW50V2lkZ2V0UmVzaXppbmcgPSB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuaXNSZXNpemluZztcblx0XHRpZiAoaXNDb250ZW50V2lkZ2V0UmVzaXppbmcpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRjb25zdCBhbmNob3JDYW5kaWRhdGVzOiBIb3ZlckFuY2hvcltdID0gdGhpcy5fZmluZEhvdmVyQW5jaG9yQ2FuZGlkYXRlcyhtb3VzZUV2ZW50KTtcblx0XHRjb25zdCBhbmNob3JDYW5kaWRhdGVzRXhpc3QgPSBhbmNob3JDYW5kaWRhdGVzLmxlbmd0aCA+IDA7XG5cdFx0aWYgKCFhbmNob3JDYW5kaWRhdGVzRXhpc3QpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zdGFydFNob3dpbmdPclVwZGF0ZUhvdmVyKG51bGwsIEhvdmVyU3RhcnRNb2RlLkRlbGF5ZWQsIEhvdmVyU3RhcnRTb3VyY2UuTW91c2UsIGZhbHNlLCBtb3VzZUV2ZW50KTtcblx0XHR9XG5cdFx0Y29uc3QgYW5jaG9yID0gYW5jaG9yQ2FuZGlkYXRlc1swXTtcblx0XHRyZXR1cm4gdGhpcy5fc3RhcnRTaG93aW5nT3JVcGRhdGVIb3ZlcihhbmNob3IsIEhvdmVyU3RhcnRNb2RlLkRlbGF5ZWQsIEhvdmVyU3RhcnRTb3VyY2UuTW91c2UsIGZhbHNlLCBtb3VzZUV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRIb3ZlckFuY2hvckNhbmRpZGF0ZXMobW91c2VFdmVudDogSUVkaXRvck1vdXNlRXZlbnQpOiBIb3ZlckFuY2hvcltdIHtcblx0XHRjb25zdCBhbmNob3JDYW5kaWRhdGVzOiBIb3ZlckFuY2hvcltdID0gW107XG5cdFx0Zm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiB0aGlzLl9wYXJ0aWNpcGFudHMpIHtcblx0XHRcdGlmICghcGFydGljaXBhbnQuc3VnZ2VzdEhvdmVyQW5jaG9yKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYW5jaG9yID0gcGFydGljaXBhbnQuc3VnZ2VzdEhvdmVyQW5jaG9yKG1vdXNlRXZlbnQpO1xuXHRcdFx0aWYgKCFhbmNob3IpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRhbmNob3JDYW5kaWRhdGVzLnB1c2goYW5jaG9yKTtcblx0XHR9XG5cdFx0Y29uc3QgdGFyZ2V0ID0gbW91c2VFdmVudC50YXJnZXQ7XG5cdFx0c3dpdGNoICh0YXJnZXQudHlwZSkge1xuXHRcdFx0Y2FzZSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUOiB7XG5cdFx0XHRcdGFuY2hvckNhbmRpZGF0ZXMucHVzaChuZXcgSG92ZXJSYW5nZUFuY2hvcigwLCB0YXJnZXQucmFuZ2UsIG1vdXNlRXZlbnQuZXZlbnQucG9zeCwgbW91c2VFdmVudC5ldmVudC5wb3N5KSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9FTVBUWToge1xuXHRcdFx0XHRjb25zdCBlcHNpbG9uID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCAvIDI7XG5cdFx0XHRcdC8vIExldCBob3ZlciBraWNrIGluIGV2ZW4gd2hlbiB0aGUgbW91c2UgaXMgdGVjaG5pY2FsbHkgaW4gdGhlIGVtcHR5IGFyZWEgYWZ0ZXIgYSBsaW5lLCBnaXZlbiB0aGUgZGlzdGFuY2UgaXMgc21hbGwgZW5vdWdoXG5cdFx0XHRcdGNvbnN0IG1vdXNlSXNXaXRoaW5MaW5lc0FuZENsb3NlVG9Ib3ZlciA9ICF0YXJnZXQuZGV0YWlsLmlzQWZ0ZXJMaW5lc1xuXHRcdFx0XHRcdCYmIHR5cGVvZiB0YXJnZXQuZGV0YWlsLmhvcml6b250YWxEaXN0YW5jZVRvVGV4dCA9PT0gJ251bWJlcidcblx0XHRcdFx0XHQmJiB0YXJnZXQuZGV0YWlsLmhvcml6b250YWxEaXN0YW5jZVRvVGV4dCA8IGVwc2lsb247XG5cdFx0XHRcdGlmICghbW91c2VJc1dpdGhpbkxpbmVzQW5kQ2xvc2VUb0hvdmVyKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0YW5jaG9yQ2FuZGlkYXRlcy5wdXNoKG5ldyBIb3ZlclJhbmdlQW5jaG9yKDAsIHRhcmdldC5yYW5nZSwgbW91c2VFdmVudC5ldmVudC5wb3N4LCBtb3VzZUV2ZW50LmV2ZW50LnBvc3kpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFuY2hvckNhbmRpZGF0ZXMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xuXHRcdHJldHVybiBhbmNob3JDYW5kaWRhdGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Nb3VzZUxlYXZlKGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JEb21Ob2RlID0gdGhpcy5fZWRpdG9yLmdldERvbU5vZGUoKTtcblx0XHRjb25zdCBpc01vdXNlUG9zaXRpb25PdXRzaWRlT2ZFZGl0b3IgPSAhZWRpdG9yRG9tTm9kZSB8fCAhaXNNb3VzZVBvc2l0aW9uV2l0aGluRWxlbWVudChlZGl0b3JEb21Ob2RlLCBlLngsIGUueSk7XG5cdFx0aWYgKGlzTW91c2VQb3NpdGlvbk91dHNpZGVPZkVkaXRvcikge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHN0YXJ0U2hvd2luZ0F0UmFuZ2UocmFuZ2U6IFJhbmdlLCBtb2RlOiBIb3ZlclN0YXJ0TW9kZSwgc291cmNlOiBIb3ZlclN0YXJ0U291cmNlLCBmb2N1czogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3N0YXJ0U2hvd2luZ09yVXBkYXRlSG92ZXIobmV3IEhvdmVyUmFuZ2VBbmNob3IoMCwgcmFuZ2UsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSwgbW9kZSwgc291cmNlLCBmb2N1cywgbnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V2lkZ2V0Q29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuZ2V0RG9tTm9kZSgpO1xuXHRcdGlmICghbm9kZS50ZXh0Q29udGVudCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIG5vZGUudGV4dENvbnRlbnQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdXBkYXRlSG92ZXJWZXJib3NpdHlMZXZlbChhY3Rpb246IEhvdmVyVmVyYm9zaXR5QWN0aW9uLCBpbmRleDogbnVtYmVyLCBmb2N1cz86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9yZW5kZXJlZENvbnRlbnRIb3Zlci52YWx1ZT8udXBkYXRlSG92ZXJWZXJib3NpdHlMZXZlbChhY3Rpb24sIGluZGV4LCBmb2N1cyk7XG5cdH1cblxuXHRwdWJsaWMgZG9lc0hvdmVyQXRJbmRleFN1cHBvcnRWZXJib3NpdHlBY3Rpb24oaW5kZXg6IG51bWJlciwgYWN0aW9uOiBIb3ZlclZlcmJvc2l0eUFjdGlvbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZENvbnRlbnRIb3Zlci52YWx1ZT8uZG9lc0hvdmVyQXRJbmRleFN1cHBvcnRWZXJib3NpdHlBY3Rpb24oaW5kZXgsIGFjdGlvbikgPz8gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZVdpZGdldENvbnRlbnQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRDb250ZW50SG92ZXIudmFsdWU/LmdldEFjY2Vzc2libGVXaWRnZXRDb250ZW50KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZVdpZGdldENvbnRlbnRBdEluZGV4KGluZGV4OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZENvbnRlbnRIb3Zlci52YWx1ZT8uZ2V0QWNjZXNzaWJsZVdpZGdldENvbnRlbnRBdEluZGV4KGluZGV4KTtcblx0fVxuXG5cdHB1YmxpYyBmb2N1c2VkSG92ZXJQYXJ0SW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRDb250ZW50SG92ZXIudmFsdWU/LmZvY3VzZWRIb3ZlclBhcnRJbmRleCA/PyAtMTtcblx0fVxuXG5cdHB1YmxpYyBjb250YWluc05vZGUobm9kZTogTm9kZSB8IG51bGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKG5vZGUgPyB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuZ2V0RG9tTm9kZSgpLmNvbnRhaW5zKG5vZGUpIDogZmFsc2UpO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGhvdmVyUGFydHNDb3VudCA9IHRoaXMuX3JlbmRlcmVkQ29udGVudEhvdmVyLnZhbHVlPy5ob3ZlclBhcnRzQ291bnQ7XG5cdFx0aWYgKGhvdmVyUGFydHNDb3VudCA9PT0gMSkge1xuXHRcdFx0dGhpcy5mb2N1c0hvdmVyUGFydFdpdGhJbmRleCgwKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgZm9jdXNIb3ZlclBhcnRXaXRoSW5kZXgoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmRlcmVkQ29udGVudEhvdmVyLnZhbHVlPy5mb2N1c0hvdmVyUGFydFdpdGhJbmRleChpbmRleCk7XG5cdH1cblxuXHRwdWJsaWMgc2Nyb2xsVXAoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnNjcm9sbFVwKCk7XG5cdH1cblxuXHRwdWJsaWMgc2Nyb2xsRG93bigpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuc2Nyb2xsRG93bigpO1xuXHR9XG5cblx0cHVibGljIHNjcm9sbExlZnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnNjcm9sbExlZnQoKTtcblx0fVxuXG5cdHB1YmxpYyBzY3JvbGxSaWdodCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuc2Nyb2xsUmlnaHQoKTtcblx0fVxuXG5cdHB1YmxpYyBwYWdlVXAoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LnBhZ2VVcCgpO1xuXHR9XG5cblx0cHVibGljIHBhZ2VEb3duKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5wYWdlRG93bigpO1xuXHR9XG5cblx0cHVibGljIGdvVG9Ub3AoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LmdvVG9Ub3AoKTtcblx0fVxuXG5cdHB1YmxpYyBnb1RvQm90dG9tKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5nb1RvQm90dG9tKCk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9ob3Zlck9wZXJhdGlvbi5jYW5jZWwoKTtcblx0XHR0aGlzLl9zZXRDdXJyZW50UmVzdWx0KG51bGwpO1xuXHR9XG5cblx0cHVibGljIGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuZ2V0RG9tTm9kZSgpO1xuXHR9XG5cblx0cHVibGljIGdldCBpc0NvbG9yUGlja2VyVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRDb250ZW50SG92ZXIudmFsdWU/LmlzQ29sb3JQaWNrZXJWaXNpYmxlKCkgPz8gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzVmlzaWJsZUZyb21LZXlib2FyZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGVudEhvdmVyV2lkZ2V0LmlzVmlzaWJsZUZyb21LZXlib2FyZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZW50SG92ZXJXaWRnZXQuaXNWaXNpYmxlO1xuXHR9XG5cblx0cHVibGljIGdldCBpc0ZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5pc0ZvY3VzZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzUmVzaXppbmcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldC5pc1Jlc2l6aW5nO1xuXHR9XG5cblx0cHVibGljIGdldCB3aWRnZXQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRIb3ZlcldpZGdldDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSx5QkFBeUI7QUFDOUMsU0FBeUMsdUJBQXVCO0FBQ2hFLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0JBQTZCLGdCQUFnQix3QkFBd0I7QUFDOUUsU0FBc0IsMEJBQTBCLHdCQUFnRztBQUNoSixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDRCQUF5RDtBQUNsRSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxxQkFBcUI7QUFFdkIsSUFBTSw0QkFBTixjQUF3QyxXQUFtQztBQUFBLEVBWWpGLFlBQ2tCLFNBQ3VCLHVCQUNILG9CQUNMLGVBQy9CO0FBQ0QsVUFBTTtBQUxXO0FBQ3VCO0FBQ0g7QUFDTDtBQWRqQyxTQUFRLGlCQUE0QztBQUNwRCxTQUFpQix3QkFBd0IsS0FBSyxVQUFVLElBQUksa0JBQXdDLENBQUM7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
