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
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { EditorOption, RenderLineNumbersType } from "../../../common/config/editorOptions.js";
import { StickyScrollWidget, StickyScrollWidgetState } from "./stickyScrollWidget.js";
import { StickyLineCandidateProvider } from "./stickyScrollProvider.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ClickLinkGesture } from "../../gotoSymbol/browser/link/clickLinkGesture.js";
import { Range } from "../../../common/core/range.js";
import { getDefinitionsAtPosition } from "../../gotoSymbol/browser/goToSymbol.js";
import { goToDefinitionWithLocation } from "../../inlayHints/browser/inlayHintsLocations.js";
import { Position } from "../../../common/core/position.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import * as dom from "../../../../base/browser/dom.js";
import { StickyRange } from "./stickyScrollElement.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { FoldingController } from "../../folding/browser/folding.js";
import { toggleCollapseState } from "../../folding/browser/foldingModel.js";
import { Emitter } from "../../../../base/common/event.js";
import { mainWindow } from "../../../../base/browser/window.js";
let StickyScrollController = class extends Disposable {
  constructor(_editor, _contextMenuService, _languageFeaturesService, _instaService, _languageConfigurationService, _languageFeatureDebounceService, _contextKeyService) {
    super();
    this._editor = _editor;
    this._contextMenuService = _contextMenuService;
    this._languageFeaturesService = _languageFeaturesService;
    this._instaService = _instaService;
    this._contextKeyService = _contextKeyService;
    this._sessionStore = new DisposableStore();
    this._maxStickyLines = Number.MAX_SAFE_INTEGER;
    this._candidateDefinitionsLength = -1;
    this._focusedStickyElementIndex = -1;
    this._enabled = false;
    this._focused = false;
    this._positionRevealed = false;
    this._onMouseDown = false;
    this._endLineNumbers = [];
    this._mouseTarget = null;
    this._onDidChangeStickyScrollHeight = this._register(new Emitter());
    this.onDidChangeStickyScrollHeight = this._onDidChangeStickyScrollHeight.event;
    this._stickyScrollWidget = new StickyScrollWidget(this._editor);
    this._stickyLineCandidateProvider = new StickyLineCandidateProvider(this._editor, _languageFeaturesService, _languageConfigurationService);
    this._register(this._stickyScrollWidget);
    this._register(this._stickyLineCandidateProvider);
    this._widgetState = StickyScrollWidgetState.Empty;
    const stickyScrollDomNode = this._stickyScrollWidget.getDomNode();
    this._register(this._editor.onDidChangeConfiguration((e) => {
      this._readConfigurationChange(e);
    }));
    this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.CONTEXT_MENU, async (event) => {
      this._onContextMenu(dom.getWindow(stickyScrollDomNode), event);
    }));
    this._stickyScrollFocusedContextKey = EditorContextKeys.stickyScrollFocused.bindTo(this._contextKeyService);
    this._stickyScrollVisibleContextKey = EditorContextKeys.stickyScrollVisible.bindTo(this._contextKeyService);
    const focusTracker = this._register(dom.trackFocus(stickyScrollDomNode));
    this._register(focusTracker.onDidBlur((_) => {
      if (this._positionRevealed === false && stickyScrollDomNode.clientHeight === 0) {
        this._focusedStickyElementIndex = -1;
        this.focus();
      } else {
        this._disposeFocusStickyScrollStore();
      }
    }));
    this._register(focusTracker.onDidFocus((_) => {
      this.focus();
    }));
    this._registerMouseListeners();
    this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.MOUSE_DOWN, (e) => {
      this._onMouseDown = true;
    }));
    this._register(this._stickyScrollWidget.onDidChangeStickyScrollHeight((e) => {
      this._onDidChangeStickyScrollHeight.fire(e);
    }));
    this._onDidResize();
    this._readConfiguration();
  }
  get stickyScrollCandidateProvider() {
    return this._stickyLineCandidateProvider;
  }
  get stickyScrollWidgetState() {
    return this._widgetState;
  }
  get stickyScrollWidgetHeight() {
    return this._stickyScrollWidget.height;
  }
  static get(editor) {
    return editor.getContribution(StickyScrollController.ID);
  }
  _disposeFocusStickyScrollStore() {
    this._stickyScrollFocusedContextKey.set(false);
    this._focusDisposableStore?.dispose();
    this._focused = false;
    this._positionRevealed = false;
    this._onMouseDown = false;
  }
  isFocused() {
    return this._focused;
  }
  focus() {
    if (this._onMouseDown) {
      this._onMouseDown = false;
      this._editor.focus();
      return;
    }
    const focusState = this._stickyScrollFocusedContextKey.get();
    if (focusState === true) {
      return;
    }
    this._focused = true;
    this._focusDisposableStore = new DisposableStore();
    this._stickyScrollFocusedContextKey.set(true);
    this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumbers.length - 1;
    this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
  }
  focusNext() {
    if (this._focusedStickyElementIndex < this._stickyScrollWidget.lineNumberCount - 1) {
      this._focusNav(true);
    }
  }
  focusPrevious() {
    if (this._focusedStickyElementIndex > 0) {
      this._focusNav(false);
    }
  }
  selectEditor() {
    this._editor.focus();
  }
  // True is next, false is previous
  _focusNav(direction) {
    this._focusedStickyElementIndex = direction ? this._focusedStickyElementIndex + 1 : this._focusedStickyElementIndex - 1;
    this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
  }
  goToFocused() {
    const lineNumbers = this._stickyScrollWidget.lineNumbers;
    this._disposeFocusStickyScrollStore();
    this._revealPosition({ lineNumber: lineNumbers[this._focusedStickyElementIndex], column: 1 });
  }
  _revealPosition(position) {
    this._reveaInEditor(position, () => this._editor.revealPosition(position));
  }
  _revealLineInCenterIfOutsideViewport(position) {
    this._reveaInEditor(position, () => this._editor.revealLineInCenterIfOutsideViewport(position.lineNumber, ScrollType.Smooth));
  }
  _reveaInEditor(position, revealFunction) {
    if (this._focused) {
      this._disposeFocusStickyScrollStore();
    }
    this._positionRevealed = true;
    revealFunction();
    this._editor.setSelection(Range.fromPositions(position));
    this._editor.focus();
  }
  _registerMouseListeners() {
    const sessionStore = this._register(new DisposableStore());
    const gesture = this._register(new ClickLinkGesture(this._editor, {
      extractLineNumberFromMouseEvent: (e) => {
        const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
        return position ? position.lineNumber : 0;
      }
    }));
    const getMouseEventTarget = (mouseEvent) => {
      if (!this._editor.hasModel()) {
        return null;
      }
      if (mouseEvent.target.type !== MouseTargetType.OVERLAY_WIDGET || mouseEvent.target.detail !== this._stickyScrollWidget.getId()) {
        return null;
      }
      const mouseTargetElement = mouseEvent.target.element;
      if (!mouseTargetElement || mouseTargetElement.innerText !== mouseTargetElement.innerHTML) {
        return null;
      }
      const position = this._stickyScrollWidget.getEditorPositionFromNode(mouseTargetElement);
      if (!position) {
        return null;
      }
      return {
        range: new Range(position.lineNumber, position.column, position.lineNumber, position.column + mouseTargetElement.innerText.length),
        textElement: mouseTargetElement
      };
    };
    const stickyScrollWidgetDomNode = this._stickyScrollWidget.getDomNode();
    this._register(dom.addStandardDisposableListener(stickyScrollWidgetDomNode, dom.EventType.CLICK, (mouseEvent) => {
      if (mouseEvent.ctrlKey || mouseEvent.altKey || mouseEvent.metaKey) {
        return;
      }
      if (!mouseEvent.leftButton) {
        return;
      }
      if (mouseEvent.shiftKey) {
        const lineIndex = this._stickyScrollWidget.getLineIndexFromChildDomNode(mouseEvent.target);
        if (lineIndex === null) {
          return;
        }
        const position2 = new Position(this._endLineNumbers[lineIndex], 1);
        this._revealLineInCenterIfOutsideViewport(position2);
        return;
      }
      const isInFoldingIconDomNode = this._stickyScrollWidget.isInFoldingIconDomNode(mouseEvent.target);
      if (isInFoldingIconDomNode) {
        const lineNumber = this._stickyScrollWidget.getLineNumberFromChildDomNode(mouseEvent.target);
        this._toggleFoldingRegionForLine(lineNumber);
        return;
      }
      const isInStickyLine = this._stickyScrollWidget.isInStickyLine(mouseEvent.target);
      if (!isInStickyLine) {
        return;
      }
      let position = this._stickyScrollWidget.getEditorPositionFromNode(mouseEvent.target);
      if (!position) {
        const lineNumber = this._stickyScrollWidget.getLineNumberFromChildDomNode(mouseEvent.target);
        if (lineNumber === null) {
          return;
        }
        position = new Position(lineNumber, 1);
      }
      this._revealPosition(position);
    }));
    const mouseMoveListener = (mouseEvent) => {
      this._mouseTarget = mouseEvent.target;
      this._onMouseMoveOrKeyDown(mouseEvent);
    };
    const keyDownListener = (mouseEvent) => {
      this._onMouseMoveOrKeyDown(mouseEvent);
    };
    const keyUpListener = (e) => {
      if (this._showEndForLine !== void 0) {
        this._showEndForLine = void 0;
        this._renderStickyScroll();
      }
    };
    mainWindow.addEventListener(dom.EventType.MOUSE_MOVE, mouseMoveListener);
    mainWindow.addEventListener(dom.EventType.KEY_DOWN, keyDownListener);
    mainWindow.addEventListener(dom.EventType.KEY_UP, keyUpListener);
    this._register(toDisposable(() => {
      mainWindow.removeEventListener(dom.EventType.MOUSE_MOVE, mouseMoveListener);
      mainWindow.removeEventListener(dom.EventType.KEY_DOWN, keyDownListener);
      mainWindow.removeEventListener(dom.EventType.KEY_UP, keyUpListener);
    }));
    this._register(gesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, _keyboardEvent]) => {
      const mouseTarget = getMouseEventTarget(mouseEvent);
      if (!mouseTarget || !mouseEvent.hasTriggerModifier || !this._editor.hasModel()) {
        sessionStore.clear();
        return;
      }
      const { range, textElement } = mouseTarget;
      if (!range.equalsRange(this._stickyRangeProjectedOnEditor)) {
        this._stickyRangeProjectedOnEditor = range;
        sessionStore.clear();
      } else if (textElement.style.textDecoration === "underline") {
        return;
      }
      const cancellationToken = new CancellationTokenSource();
      sessionStore.add(toDisposable(() => cancellationToken.dispose(true)));
      let currentHTMLChild;
      getDefinitionsAtPosition(this._languageFeaturesService.definitionProvider, this._editor.getModel(), new Position(range.startLineNumber, range.startColumn + 1), false, cancellationToken.token).then((candidateDefinitions) => {
        if (cancellationToken.token.isCancellationRequested) {
          return;
        }
        if (candidateDefinitions.length !== 0) {
          this._candidateDefinitionsLength = candidateDefinitions.length;
          const childHTML = textElement;
          if (currentHTMLChild !== childHTML) {
            sessionStore.clear();
            currentHTMLChild = childHTML;
            currentHTMLChild.style.textDecoration = "underline";
            sessionStore.add(toDisposable(() => {
              currentHTMLChild.style.textDecoration = "none";
            }));
          } else if (!currentHTMLChild) {
            currentHTMLChild = childHTML;
            currentHTMLChild.style.textDecoration = "underline";
            sessionStore.add(toDisposable(() => {
              currentHTMLChild.style.textDecoration = "none";
            }));
          }
        } else {
          sessionStore.clear();
        }
      });
    }));
    this._register(gesture.onCancel(() => {
      sessionStore.clear();
    }));
    this._register(gesture.onExecute(async (e) => {
      if (e.target.type !== MouseTargetType.OVERLAY_WIDGET || e.target.detail !== this._stickyScrollWidget.getId()) {
        return;
      }
      const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
      if (!position) {
        return;
      }
      if (!this._editor.hasModel() || !this._stickyRangeProjectedOnEditor) {
        return;
      }
      if (this._candidateDefinitionsLength > 1) {
        if (this._focused) {
          this._disposeFocusStickyScrollStore();
        }
        this._revealPosition({ lineNumber: position.lineNumber, column: 1 });
      }
      this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, { uri: this._editor.getModel().uri, range: this._stickyRangeProjectedOnEditor });
    }));
  }
  _onContextMenu(targetWindow, e) {
    const event = new StandardMouseEvent(targetWindow, e);
    this._contextMenuService.showContextMenu({
      menuId: MenuId.StickyScrollContext,
      getAnchor: () => event
    });
  }
  _onMouseMoveOrKeyDown(mouseEvent) {
    if (!mouseEvent.shiftKey) {
      return;
    }
    if (!this._mouseTarget || !dom.isHTMLElement(this._mouseTarget)) {
      return;
    }
    const currentEndForLineIndex = this._stickyScrollWidget.getLineIndexFromChildDomNode(this._mouseTarget);
    if (currentEndForLineIndex === null || this._showEndForLine === currentEndForLineIndex) {
      return;
    }
    this._showEndForLine = currentEndForLineIndex;
    this._renderStickyScroll();
  }
  _toggleFoldingRegionForLine(line) {
    if (!this._foldingModel || line === null) {
      return;
    }
    const stickyLine = this._stickyScrollWidget.getRenderedStickyLine(line);
    const foldingIcon = stickyLine?.foldingIcon;
    if (!foldingIcon) {
      return;
    }
    toggleCollapseState(this._foldingModel, 1, [line]);
    foldingIcon.isCollapsed = !foldingIcon.isCollapsed;
    const scrollTop = (foldingIcon.isCollapsed ? this._editor.getTopForLineNumber(foldingIcon.foldingEndLine) : this._editor.getTopForLineNumber(foldingIcon.foldingStartLine)) - this._editor.getOption(EditorOption.lineHeight) * stickyLine.index + 1;
    this._editor.setScrollTop(scrollTop);
    this._renderStickyScroll(line);
  }
  _readConfiguration() {
    const options = this._editor.getOption(EditorOption.stickyScroll);
    if (options.enabled === false) {
      this._editor.removeOverlayWidget(this._stickyScrollWidget);
      this._resetState();
      this._sessionStore.clear();
      this._enabled = false;
      return;
    } else if (options.enabled && !this._enabled) {
      this._editor.addOverlayWidget(this._stickyScrollWidget);
      this._sessionStore.add(this._editor.onDidScrollChange((e) => {
        if (e.scrollTopChanged) {
          this._showEndForLine = void 0;
          this._renderStickyScroll();
        }
      }));
      this._sessionStore.add(this._editor.onDidLayoutChange(() => this._onDidResize()));
      this._sessionStore.add(this._editor.onDidChangeModelTokens((e) => this._onTokensChange(e)));
      this._sessionStore.add(this._stickyLineCandidateProvider.onDidChangeStickyScroll(() => {
        this._showEndForLine = void 0;
        this._renderStickyScroll();
      }));
      this._enabled = true;
    }
    const lineNumberOption = this._editor.getOption(EditorOption.lineNumbers);
    if (lineNumberOption.renderType === RenderLineNumbersType.Relative) {
      this._sessionStore.add(this._editor.onDidChangeCursorPosition(() => {
        this._showEndForLine = void 0;
        this._renderStickyScroll(0);
      }));
    }
  }
  _readConfigurationChange(event) {
    if (event.hasChanged(EditorOption.stickyScroll) || event.hasChanged(EditorOption.minimap) || event.hasChanged(EditorOption.lineHeight) || event.hasChanged(EditorOption.showFoldingControls) || event.hasChanged(EditorOption.lineNumbers)) {
      this._readConfiguration();
    }
    if (event.hasChanged(EditorOption.lineNumbers) || event.hasChanged(EditorOption.folding) || event.hasChanged(EditorOption.showFoldingControls)) {
      this._renderStickyScroll(0);
    }
  }
  _needsUpdate(event) {
    const stickyLineNumbers = this._stickyScrollWidget.getCurrentLines();
    for (const stickyLineNumber of stickyLineNumbers) {
      for (const range of event.ranges) {
        if (stickyLineNumber >= range.fromLineNumber && stickyLineNumber <= range.toLineNumber) {
          return true;
        }
      }
    }
    return false;
  }
  _onTokensChange(event) {
    if (this._needsUpdate(event)) {
      this._renderStickyScroll(0);
    }
  }
  _onDidResize() {
    const layoutInfo = this._editor.getLayoutInfo();
    const theoreticalLines = layoutInfo.height / this._editor.getOption(EditorOption.lineHeight);
    this._maxStickyLines = Math.round(theoreticalLines * 0.25);
    this._renderStickyScroll(0);
  }
  async _renderStickyScroll(rebuildFromLine) {
    const model = this._editor.getModel();
    if (!model || model.isTooLargeForTokenization()) {
      this._resetState();
      return;
    }
    const nextRebuildFromLine = this._updateAndGetMinRebuildFromLine(rebuildFromLine);
    const stickyWidgetVersion = this._stickyLineCandidateProvider.getVersionId();
    const shouldUpdateState = stickyWidgetVersion === void 0 || stickyWidgetVersion === model.getVersionId();
    if (shouldUpdateState) {
      if (!this._focused) {
        await this._updateState(nextRebuildFromLine);
      } else {
        if (this._focusedStickyElementIndex === -1) {
          await this._updateState(nextRebuildFromLine);
          this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
          if (this._focusedStickyElementIndex !== -1) {
            this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
          }
        } else {
          const focusedStickyElementLineNumber = this._stickyScrollWidget.lineNumbers[this._focusedStickyElementIndex];
          await this._updateState(nextRebuildFromLine);
          if (this._stickyScrollWidget.lineNumberCount === 0) {
            this._focusedStickyElementIndex = -1;
          } else {
            const previousFocusedLineNumberExists = this._stickyScrollWidget.lineNumbers.includes(focusedStickyElementLineNumber);
            if (!previousFocusedLineNumberExists) {
              this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
            }
            this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
          }
        }
      }
    }
  }
  _updateAndGetMinRebuildFromLine(rebuildFromLine) {
    if (rebuildFromLine !== void 0) {
      const minRebuildFromLineOrInfinity = this._minRebuildFromLine !== void 0 ? this._minRebuildFromLine : Infinity;
      this._minRebuildFromLine = Math.min(rebuildFromLine, minRebuildFromLineOrInfinity);
    }
    return this._minRebuildFromLine;
  }
  async _updateState(rebuildFromLine) {
    this._minRebuildFromLine = void 0;
    this._foldingModel = await FoldingController.get(this._editor)?.getFoldingModel() ?? void 0;
    this._widgetState = this.findScrollWidgetState();
    const stickyWidgetHasLines = this._widgetState.startLineNumbers.length > 0;
    this._stickyScrollVisibleContextKey.set(stickyWidgetHasLines);
    this._stickyScrollWidget.setState(this._widgetState, this._foldingModel, rebuildFromLine);
  }
  async _resetState() {
    this._minRebuildFromLine = void 0;
    this._foldingModel = void 0;
    this._widgetState = StickyScrollWidgetState.Empty;
    this._stickyScrollVisibleContextKey.set(false);
    this._stickyScrollWidget.setState(void 0, void 0);
  }
  findScrollWidgetState() {
    if (!this._editor.hasModel()) {
      return StickyScrollWidgetState.Empty;
    }
    const textModel = this._editor.getModel();
    const maxNumberStickyLines = Math.min(this._maxStickyLines, this._editor.getOption(EditorOption.stickyScroll).maxLineCount);
    const scrollTop = this._editor.getScrollTop();
    let lastLineRelativePosition = 0;
    const startLineNumbers = [];
    const endLineNumbers = [];
    const arrayVisibleRanges = this._editor.getVisibleRanges();
    if (arrayVisibleRanges.length !== 0) {
      const fullVisibleRange = new StickyRange(arrayVisibleRanges[0].startLineNumber, arrayVisibleRanges[arrayVisibleRanges.length - 1].endLineNumber);
      const candidateRanges = this._stickyLineCandidateProvider.getCandidateStickyLinesIntersecting(fullVisibleRange);
      for (const range of candidateRanges) {
        const start = range.startLineNumber;
        const end = range.endLineNumber;
        const isValidRange = textModel.isValidRange({ startLineNumber: start, endLineNumber: end, startColumn: 1, endColumn: 1 });
        if (isValidRange && end - start > 0) {
          const topOfElement = range.top;
          const bottomOfElement = topOfElement + range.height;
          const topOfBeginningLine = this._editor.getTopForLineNumber(start) - scrollTop;
          const bottomOfEndLine = this._editor.getBottomForLineNumber(end) - scrollTop;
          if (topOfElement > topOfBeginningLine && topOfElement <= bottomOfEndLine) {
            startLineNumbers.push(start);
            endLineNumbers.push(end + 1);
            if (bottomOfElement > bottomOfEndLine) {
              lastLineRelativePosition = bottomOfEndLine - bottomOfElement;
            }
          }
          if (startLineNumbers.length === maxNumberStickyLines) {
            break;
          }
        }
      }
    }
    this._endLineNumbers = endLineNumbers;
    return new StickyScrollWidgetState(startLineNumbers, endLineNumbers, lastLineRelativePosition, this._showEndForLine);
  }
  dispose() {
    super.dispose();
    this._sessionStore.dispose();
  }
};
StickyScrollController.ID = "store.contrib.stickyScrollController";
StickyScrollController = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILanguageConfigurationService),
  __decorateParam(5, ILanguageFeatureDebounceService),
  __decorateParam(6, IContextKeyService)
], StickyScrollController);
export {
  StickyScrollController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdGlja3lTY3JvbGwvYnJvd3Nlci9zdGlja3lTY3JvbGxDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiwgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uLCBSZW5kZXJMaW5lTnVtYmVyc1R5cGUsIENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgU3RpY2t5U2Nyb2xsV2lkZ2V0LCBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZSB9IGZyb20gJy4vc3RpY2t5U2Nyb2xsV2lkZ2V0LmpzJztcbmltcG9ydCB7IElTdGlja3lMaW5lQ2FuZGlkYXRlUHJvdmlkZXIsIFN0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlciB9IGZyb20gJy4vc3RpY2t5U2Nyb2xsUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsVG9rZW5zQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ2xpY2tMaW5rR2VzdHVyZSwgQ2xpY2tMaW5rTW91c2VFdmVudCB9IGZyb20gJy4uLy4uL2dvdG9TeW1ib2wvYnJvd3Nlci9saW5rL2NsaWNrTGlua0dlc3R1cmUuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IGdldERlZmluaXRpb25zQXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uL2dvdG9TeW1ib2wvYnJvd3Nlci9nb1RvU3ltYm9sLmpzJztcbmltcG9ydCB7IGdvVG9EZWZpbml0aW9uV2l0aExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vaW5sYXlIaW50cy9icm93c2VyL2lubGF5SGludHNMb2NhdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0aWNreVJhbmdlIH0gZnJvbSAnLi9zdGlja3lTY3JvbGxFbGVtZW50LmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50LCBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nQ29udHJvbGxlciB9IGZyb20gJy4uLy4uL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nLmpzJztcbmltcG9ydCB7IEZvbGRpbmdNb2RlbCwgdG9nZ2xlQ29sbGFwc2VTdGF0ZSB9IGZyb20gJy4uLy4uL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nTW9kZWwuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0aWNreVNjcm9sbENvbnRyb2xsZXIge1xuXHRnZXQgc3RpY2t5U2Nyb2xsQ2FuZGlkYXRlUHJvdmlkZXIoKTogSVN0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlcjtcblx0Z2V0IHN0aWNreVNjcm9sbFdpZGdldFN0YXRlKCk6IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlO1xuXHRyZWFkb25seSBzdGlja3lTY3JvbGxXaWRnZXRIZWlnaHQ6IG51bWJlcjtcblx0aXNGb2N1c2VkKCk6IGJvb2xlYW47XG5cdGZvY3VzKCk6IHZvaWQ7XG5cdGZvY3VzTmV4dCgpOiB2b2lkO1xuXHRmb2N1c1ByZXZpb3VzKCk6IHZvaWQ7XG5cdGdvVG9Gb2N1c2VkKCk6IHZvaWQ7XG5cdGZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpOiBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZTtcblx0ZGlzcG9zZSgpOiB2b2lkO1xuXHRzZWxlY3RFZGl0b3IoKTogdm9pZDtcblx0b25EaWRDaGFuZ2VTdGlja3lTY3JvbGxIZWlnaHQ6IEV2ZW50PHsgaGVpZ2h0OiBudW1iZXIgfT47XG59XG5cbmV4cG9ydCBjbGFzcyBTdGlja3lTY3JvbGxDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24sIElTdGlja3lTY3JvbGxDb250cm9sbGVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnc3RvcmUuY29udHJpYi5zdGlja3lTY3JvbGxDb250cm9sbGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGlja3lTY3JvbGxXaWRnZXQ6IFN0aWNreVNjcm9sbFdpZGdldDtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyOiBJU3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uU3RvcmU6IERpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIF93aWRnZXRTdGF0ZTogU3RpY2t5U2Nyb2xsV2lkZ2V0U3RhdGU7XG5cdHByaXZhdGUgX2ZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9tYXhTdGlja3lMaW5lczogbnVtYmVyID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cblx0cHJpdmF0ZSBfc3RpY2t5UmFuZ2VQcm9qZWN0ZWRPbkVkaXRvcjogSVJhbmdlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jYW5kaWRhdGVEZWZpbml0aW9uc0xlbmd0aDogbnVtYmVyID0gLTE7XG5cblx0cHJpdmF0ZSBfc3RpY2t5U2Nyb2xsRm9jdXNlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9zdGlja3lTY3JvbGxWaXNpYmxlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBfZm9jdXNEaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleDogbnVtYmVyID0gLTE7XG5cdHByaXZhdGUgX2VuYWJsZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBfZm9jdXNlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9wb3NpdGlvblJldmVhbGVkID0gZmFsc2U7XG5cdHByaXZhdGUgX29uTW91c2VEb3duID0gZmFsc2U7XG5cdHByaXZhdGUgX2VuZExpbmVOdW1iZXJzOiBudW1iZXJbXSA9IFtdO1xuXHRwcml2YXRlIF9zaG93RW5kRm9yTGluZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9taW5SZWJ1aWxkRnJvbUxpbmU6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbW91c2VUYXJnZXQ6IEV2ZW50VGFyZ2V0IHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGlja3lTY3JvbGxIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGhlaWdodDogbnVtYmVyIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VTdGlja3lTY3JvbGxIZWlnaHQgPSB0aGlzLl9vbkRpZENoYW5nZVN0aWNreVNjcm9sbEhlaWdodC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIF9sYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0ID0gbmV3IFN0aWNreVNjcm9sbFdpZGdldCh0aGlzLl9lZGl0b3IpO1xuXHRcdHRoaXMuX3N0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlciA9IG5ldyBTdGlja3lMaW5lQ2FuZGlkYXRlUHJvdmlkZXIodGhpcy5fZWRpdG9yLCBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIF9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3N0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlcik7XG5cblx0XHR0aGlzLl93aWRnZXRTdGF0ZSA9IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlLkVtcHR5O1xuXHRcdGNvbnN0IHN0aWNreVNjcm9sbERvbU5vZGUgPSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZ2V0RG9tTm9kZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHR0aGlzLl9yZWFkQ29uZmlndXJhdGlvbkNoYW5nZShlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihzdGlja3lTY3JvbGxEb21Ob2RlLCBkb20uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgYXN5bmMgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl9vbkNvbnRleHRNZW51KGRvbS5nZXRXaW5kb3coc3RpY2t5U2Nyb2xsRG9tTm9kZSksIGV2ZW50KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsRm9jdXNlZENvbnRleHRLZXkgPSBFZGl0b3JDb250ZXh0S2V5cy5zdGlja3lTY3JvbGxGb2N1c2VkLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsVmlzaWJsZUNvbnRleHRLZXkgPSBFZGl0b3JDb250ZXh0S2V5cy5zdGlja3lTY3JvbGxWaXNpYmxlLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgZm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXMoc3RpY2t5U2Nyb2xsRG9tTm9kZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoXyA9PiB7XG5cdFx0XHQvLyBTdXBwb3NlIHRoYXQgdGhlIGJsdXJyaW5nIGlzIGNhdXNlZCBieSBzY3JvbGxpbmcsIHRoZW4ga2VlcCB0aGUgZm9jdXMgb24gdGhlIHN0aWNreSBzY3JvbGxcblx0XHRcdC8vIFRoaXMgaXMgZGV0ZXJtaW5lZCBieSB0aGUgZmFjdCB0aGF0IHRoZSBoZWlnaHQgb2YgdGhlIHdpZGdldCBoYXMgYmVjb21lIHplcm8gYW5kIHRoZXJlIGhhcyBiZWVuIG5vIHBvc2l0aW9uIHJldmVhbGluZ1xuXHRcdFx0aWYgKHRoaXMuX3Bvc2l0aW9uUmV2ZWFsZWQgPT09IGZhbHNlICYmIHN0aWNreVNjcm9sbERvbU5vZGUuY2xpZW50SGVpZ2h0ID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXggPSAtMTtcblx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXG5cdFx0XHR9XG5cdFx0XHQvLyBJbiBhbGwgb3RoZXIgY2FzZWVzLCBkaXNwb3NlIHRoZSBmb2N1cyBvbiB0aGUgc3RpY2t5IHNjcm9sbFxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2VGb2N1c1N0aWNreVNjcm9sbFN0b3JlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKF8gPT4ge1xuXHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlck1vdXNlTGlzdGVuZXJzKCk7XG5cdFx0Ly8gU3VwcG9zZSB0aGF0IG1vdXNlIGRvd24gb24gdGhlIHN0aWNreSBzY3JvbGwsIHRoZW4gZG8gbm90IGZvY3VzIG9uIHRoZSBzdGlja3kgc2Nyb2xsIGJlY2F1c2UgdGhpcyB3aWxsIGJlIGZvbGxvd2VkIGJ5IHRoZSByZXZlYWxpbmcgb2YgYSBwb3NpdGlvblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoc3RpY2t5U2Nyb2xsRG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5fb25Nb3VzZURvd24gPSB0cnVlO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQub25EaWRDaGFuZ2VTdGlja3lTY3JvbGxIZWlnaHQoKGUpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsSGVpZ2h0LmZpcmUoZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX29uRGlkUmVzaXplKCk7XG5cdFx0dGhpcy5fcmVhZENvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdGdldCBzdGlja3lTY3JvbGxDYW5kaWRhdGVQcm92aWRlcigpOiBJU3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyO1xuXHR9XG5cblx0Z2V0IHN0aWNreVNjcm9sbFdpZGdldFN0YXRlKCk6IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0U3RhdGU7XG5cdH1cblxuXHRnZXQgc3RpY2t5U2Nyb2xsV2lkZ2V0SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5oZWlnaHQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogSVN0aWNreVNjcm9sbENvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxTdGlja3lTY3JvbGxDb250cm9sbGVyPihTdGlja3lTY3JvbGxDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VGb2N1c1N0aWNreVNjcm9sbFN0b3JlKCkge1xuXHRcdHRoaXMuX3N0aWNreVNjcm9sbEZvY3VzZWRDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0dGhpcy5fZm9jdXNEaXNwb3NhYmxlU3RvcmU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9mb2N1c2VkID0gZmFsc2U7XG5cdFx0dGhpcy5fcG9zaXRpb25SZXZlYWxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX29uTW91c2VEb3duID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgaXNGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9mb2N1c2VkO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdC8vIElmIHRoZSBtb3VzZSBpcyBkb3duLCBkbyBub3QgZm9jdXMgb24gdGhlIHN0aWNreSBzY3JvbGxcblx0XHRpZiAodGhpcy5fb25Nb3VzZURvd24pIHtcblx0XHRcdHRoaXMuX29uTW91c2VEb3duID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZm9jdXNTdGF0ZSA9IHRoaXMuX3N0aWNreVNjcm9sbEZvY3VzZWRDb250ZXh0S2V5LmdldCgpO1xuXHRcdGlmIChmb2N1c1N0YXRlID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2ZvY3VzZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2ZvY3VzRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuX3N0aWNreVNjcm9sbEZvY3VzZWRDb250ZXh0S2V5LnNldCh0cnVlKTtcblx0XHR0aGlzLl9mb2N1c2VkU3RpY2t5RWxlbWVudEluZGV4ID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmxpbmVOdW1iZXJzLmxlbmd0aCAtIDE7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmZvY3VzTGluZVdpdGhJbmRleCh0aGlzLl9mb2N1c2VkU3RpY2t5RWxlbWVudEluZGV4KTtcblx0fVxuXG5cdHB1YmxpYyBmb2N1c05leHQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXggPCB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQubGluZU51bWJlckNvdW50IC0gMSkge1xuXHRcdFx0dGhpcy5fZm9jdXNOYXYodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGZvY3VzUHJldmlvdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXggPiAwKSB7XG5cdFx0XHR0aGlzLl9mb2N1c05hdihmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNlbGVjdEVkaXRvcigpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdC8vIFRydWUgaXMgbmV4dCwgZmFsc2UgaXMgcHJldmlvdXNcblx0cHJpdmF0ZSBfZm9jdXNOYXYoZGlyZWN0aW9uOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleCA9IGRpcmVjdGlvbiA/IHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXggKyAxIDogdGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleCAtIDE7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmZvY3VzTGluZVdpdGhJbmRleCh0aGlzLl9mb2N1c2VkU3RpY2t5RWxlbWVudEluZGV4KTtcblx0fVxuXG5cdHB1YmxpYyBnb1RvRm9jdXNlZCgpOiB2b2lkIHtcblx0XHRjb25zdCBsaW5lTnVtYmVycyA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5saW5lTnVtYmVycztcblx0XHR0aGlzLl9kaXNwb3NlRm9jdXNTdGlja3lTY3JvbGxTdG9yZSgpO1xuXHRcdHRoaXMuX3JldmVhbFBvc2l0aW9uKHsgbGluZU51bWJlcjogbGluZU51bWJlcnNbdGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleF0sIGNvbHVtbjogMSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbFBvc2l0aW9uKHBvc2l0aW9uOiBJUG9zaXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYUluRWRpdG9yKHBvc2l0aW9uLCAoKSA9PiB0aGlzLl9lZGl0b3IucmV2ZWFsUG9zaXRpb24ocG9zaXRpb24pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbExpbmVJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHBvc2l0aW9uOiBJUG9zaXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYUluRWRpdG9yKHBvc2l0aW9uLCAoKSA9PiB0aGlzLl9lZGl0b3IucmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocG9zaXRpb24ubGluZU51bWJlciwgU2Nyb2xsVHlwZS5TbW9vdGgpKTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhSW5FZGl0b3IocG9zaXRpb246IElQb3NpdGlvbiwgcmV2ZWFsRnVuY3Rpb246ICgpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZm9jdXNlZCkge1xuXHRcdFx0dGhpcy5fZGlzcG9zZUZvY3VzU3RpY2t5U2Nyb2xsU3RvcmUoKTtcblx0XHR9XG5cdFx0dGhpcy5fcG9zaXRpb25SZXZlYWxlZCA9IHRydWU7XG5cdFx0cmV2ZWFsRnVuY3Rpb24oKTtcblx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9uKFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zaXRpb24pKTtcblx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTW91c2VMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHRjb25zdCBzZXNzaW9uU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGNvbnN0IGdlc3R1cmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2xpY2tMaW5rR2VzdHVyZSh0aGlzLl9lZGl0b3IsIHtcblx0XHRcdGV4dHJhY3RMaW5lTnVtYmVyRnJvbU1vdXNlRXZlbnQ6IChlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmdldEVkaXRvclBvc2l0aW9uRnJvbU5vZGUoZS50YXJnZXQuZWxlbWVudCk7XG5cdFx0XHRcdHJldHVybiBwb3NpdGlvbiA/IHBvc2l0aW9uLmxpbmVOdW1iZXIgOiAwO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdldE1vdXNlRXZlbnRUYXJnZXQgPSAobW91c2VFdmVudDogQ2xpY2tMaW5rTW91c2VFdmVudCk6IHsgcmFuZ2U6IFJhbmdlOyB0ZXh0RWxlbWVudDogSFRNTEVsZW1lbnQgfSB8IG51bGwgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmIChtb3VzZUV2ZW50LnRhcmdldC50eXBlICE9PSBNb3VzZVRhcmdldFR5cGUuT1ZFUkxBWV9XSURHRVQgfHwgbW91c2VFdmVudC50YXJnZXQuZGV0YWlsICE9PSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZ2V0SWQoKSkge1xuXHRcdFx0XHQvLyBub3QgaG92ZXJpbmcgb3ZlciBvdXIgd2lkZ2V0XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbW91c2VUYXJnZXRFbGVtZW50ID0gbW91c2VFdmVudC50YXJnZXQuZWxlbWVudDtcblx0XHRcdGlmICghbW91c2VUYXJnZXRFbGVtZW50IHx8IG1vdXNlVGFyZ2V0RWxlbWVudC5pbm5lclRleHQgIT09IG1vdXNlVGFyZ2V0RWxlbWVudC5pbm5lckhUTUwpIHtcblx0XHRcdFx0Ly8gbm90IG9uIGEgc3BhbiBlbGVtZW50IHJlbmRlcmluZyB0ZXh0XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZ2V0RWRpdG9yUG9zaXRpb25Gcm9tTm9kZShtb3VzZVRhcmdldEVsZW1lbnQpO1xuXHRcdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0XHQvLyBub3QgaG92ZXJpbmcgYSBzdGlja3kgc2Nyb2xsIGxpbmVcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uICsgbW91c2VUYXJnZXRFbGVtZW50LmlubmVyVGV4dC5sZW5ndGgpLFxuXHRcdFx0XHR0ZXh0RWxlbWVudDogbW91c2VUYXJnZXRFbGVtZW50XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCBzdGlja3lTY3JvbGxXaWRnZXREb21Ob2RlID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmdldERvbU5vZGUoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoc3RpY2t5U2Nyb2xsV2lkZ2V0RG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5DTElDSywgKG1vdXNlRXZlbnQ6IElNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRpZiAobW91c2VFdmVudC5jdHJsS2V5IHx8IG1vdXNlRXZlbnQuYWx0S2V5IHx8IG1vdXNlRXZlbnQubWV0YUtleSkge1xuXHRcdFx0XHQvLyBtb2RpZmllciBwcmVzc2VkXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghbW91c2VFdmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0XHRcdC8vIG5vdCBsZWZ0IGNsaWNrXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChtb3VzZUV2ZW50LnNoaWZ0S2V5KSB7XG5cdFx0XHRcdC8vIHNoaWZ0IGNsaWNrXG5cdFx0XHRcdGNvbnN0IGxpbmVJbmRleCA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5nZXRMaW5lSW5kZXhGcm9tQ2hpbGREb21Ob2RlKG1vdXNlRXZlbnQudGFyZ2V0KTtcblx0XHRcdFx0aWYgKGxpbmVJbmRleCA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IG5ldyBQb3NpdGlvbih0aGlzLl9lbmRMaW5lTnVtYmVyc1tsaW5lSW5kZXhdLCAxKTtcblx0XHRcdFx0dGhpcy5fcmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocG9zaXRpb24pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpc0luRm9sZGluZ0ljb25Eb21Ob2RlID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmlzSW5Gb2xkaW5nSWNvbkRvbU5vZGUobW91c2VFdmVudC50YXJnZXQpO1xuXHRcdFx0aWYgKGlzSW5Gb2xkaW5nSWNvbkRvbU5vZGUpIHtcblx0XHRcdFx0Ly8gY2xpY2tlZCBvbiBmb2xkaW5nIGljb25cblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5nZXRMaW5lTnVtYmVyRnJvbUNoaWxkRG9tTm9kZShtb3VzZUV2ZW50LnRhcmdldCk7XG5cdFx0XHRcdHRoaXMuX3RvZ2dsZUZvbGRpbmdSZWdpb25Gb3JMaW5lKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpc0luU3RpY2t5TGluZSA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5pc0luU3RpY2t5TGluZShtb3VzZUV2ZW50LnRhcmdldCk7XG5cdFx0XHRpZiAoIWlzSW5TdGlja3lMaW5lKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIG5vcm1hbCBjbGlja1xuXHRcdFx0bGV0IHBvc2l0aW9uID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmdldEVkaXRvclBvc2l0aW9uRnJvbU5vZGUobW91c2VFdmVudC50YXJnZXQpO1xuXHRcdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmdldExpbmVOdW1iZXJGcm9tQ2hpbGREb21Ob2RlKG1vdXNlRXZlbnQudGFyZ2V0KTtcblx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPT09IG51bGwpIHtcblx0XHRcdFx0XHQvLyBub3QgaG92ZXJpbmcgYSBzdGlja3kgc2Nyb2xsIGxpbmVcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cG9zaXRpb24gPSBuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9yZXZlYWxQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0fSkpO1xuXHRcdGNvbnN0IG1vdXNlTW92ZUxpc3RlbmVyID0gKG1vdXNlRXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuX21vdXNlVGFyZ2V0ID0gbW91c2VFdmVudC50YXJnZXQ7XG5cdFx0XHR0aGlzLl9vbk1vdXNlTW92ZU9yS2V5RG93bihtb3VzZUV2ZW50KTtcblx0XHR9O1xuXHRcdGNvbnN0IGtleURvd25MaXN0ZW5lciA9IChtb3VzZUV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl9vbk1vdXNlTW92ZU9yS2V5RG93bihtb3VzZUV2ZW50KTtcblx0XHR9O1xuXHRcdGNvbnN0IGtleVVwTGlzdGVuZXIgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3Nob3dFbmRGb3JMaW5lICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fc2hvd0VuZEZvckxpbmUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bWFpbldpbmRvdy5hZGRFdmVudExpc3RlbmVyKGRvbS5FdmVudFR5cGUuTU9VU0VfTU9WRSwgbW91c2VNb3ZlTGlzdGVuZXIpO1xuXHRcdG1haW5XaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihkb20uRXZlbnRUeXBlLktFWV9ET1dOLCBrZXlEb3duTGlzdGVuZXIpO1xuXHRcdG1haW5XaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihkb20uRXZlbnRUeXBlLktFWV9VUCwga2V5VXBMaXN0ZW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdG1haW5XaW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihkb20uRXZlbnRUeXBlLk1PVVNFX01PVkUsIG1vdXNlTW92ZUxpc3RlbmVyKTtcblx0XHRcdG1haW5XaW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihkb20uRXZlbnRUeXBlLktFWV9ET1dOLCBrZXlEb3duTGlzdGVuZXIpO1xuXHRcdFx0bWFpbldpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKGRvbS5FdmVudFR5cGUuS0VZX1VQLCBrZXlVcExpc3RlbmVyKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihnZXN0dXJlLm9uTW91c2VNb3ZlT3JSZWxldmFudEtleURvd24oKFttb3VzZUV2ZW50LCBfa2V5Ym9hcmRFdmVudF0pID0+IHtcblx0XHRcdGNvbnN0IG1vdXNlVGFyZ2V0ID0gZ2V0TW91c2VFdmVudFRhcmdldChtb3VzZUV2ZW50KTtcblx0XHRcdGlmICghbW91c2VUYXJnZXQgfHwgIW1vdXNlRXZlbnQuaGFzVHJpZ2dlck1vZGlmaWVyIHx8ICF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRzZXNzaW9uU3RvcmUuY2xlYXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgeyByYW5nZSwgdGV4dEVsZW1lbnQgfSA9IG1vdXNlVGFyZ2V0O1xuXG5cdFx0XHRpZiAoIXJhbmdlLmVxdWFsc1JhbmdlKHRoaXMuX3N0aWNreVJhbmdlUHJvamVjdGVkT25FZGl0b3IpKSB7XG5cdFx0XHRcdHRoaXMuX3N0aWNreVJhbmdlUHJvamVjdGVkT25FZGl0b3IgPSByYW5nZTtcblx0XHRcdFx0c2Vzc2lvblN0b3JlLmNsZWFyKCk7XG5cdFx0XHR9IGVsc2UgaWYgKHRleHRFbGVtZW50LnN0eWxlLnRleHREZWNvcmF0aW9uID09PSAndW5kZXJsaW5lJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRzZXNzaW9uU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjYW5jZWxsYXRpb25Ub2tlbi5kaXNwb3NlKHRydWUpKSk7XG5cblx0XHRcdGxldCBjdXJyZW50SFRNTENoaWxkOiBIVE1MRWxlbWVudDtcblxuXHRcdFx0Z2V0RGVmaW5pdGlvbnNBdFBvc2l0aW9uKHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRlZmluaXRpb25Qcm92aWRlciwgdGhpcy5fZWRpdG9yLmdldE1vZGVsKCksIG5ldyBQb3NpdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uICsgMSksIGZhbHNlLCBjYW5jZWxsYXRpb25Ub2tlbi50b2tlbikudGhlbigoY2FuZGlkYXRlRGVmaW5pdGlvbnMgPT4ge1xuXHRcdFx0XHRpZiAoY2FuY2VsbGF0aW9uVG9rZW4udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNhbmRpZGF0ZURlZmluaXRpb25zLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuX2NhbmRpZGF0ZURlZmluaXRpb25zTGVuZ3RoID0gY2FuZGlkYXRlRGVmaW5pdGlvbnMubGVuZ3RoO1xuXHRcdFx0XHRcdGNvbnN0IGNoaWxkSFRNTDogSFRNTEVsZW1lbnQgPSB0ZXh0RWxlbWVudDtcblx0XHRcdFx0XHRpZiAoY3VycmVudEhUTUxDaGlsZCAhPT0gY2hpbGRIVE1MKSB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uU3RvcmUuY2xlYXIoKTtcblx0XHRcdFx0XHRcdGN1cnJlbnRIVE1MQ2hpbGQgPSBjaGlsZEhUTUw7XG5cdFx0XHRcdFx0XHRjdXJyZW50SFRNTENoaWxkLnN0eWxlLnRleHREZWNvcmF0aW9uID0gJ3VuZGVybGluZSc7XG5cdFx0XHRcdFx0XHRzZXNzaW9uU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGN1cnJlbnRIVE1MQ2hpbGQuc3R5bGUudGV4dERlY29yYXRpb24gPSAnbm9uZSc7XG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghY3VycmVudEhUTUxDaGlsZCkge1xuXHRcdFx0XHRcdFx0Y3VycmVudEhUTUxDaGlsZCA9IGNoaWxkSFRNTDtcblx0XHRcdFx0XHRcdGN1cnJlbnRIVE1MQ2hpbGQuc3R5bGUudGV4dERlY29yYXRpb24gPSAndW5kZXJsaW5lJztcblx0XHRcdFx0XHRcdHNlc3Npb25TdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y3VycmVudEhUTUxDaGlsZC5zdHlsZS50ZXh0RGVjb3JhdGlvbiA9ICdub25lJztcblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2Vzc2lvblN0b3JlLmNsZWFyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZ2VzdHVyZS5vbkNhbmNlbCgoKSA9PiB7XG5cdFx0XHRzZXNzaW9uU3RvcmUuY2xlYXIoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZ2VzdHVyZS5vbkV4ZWN1dGUoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLk9WRVJMQVlfV0lER0VUIHx8IGUudGFyZ2V0LmRldGFpbCAhPT0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmdldElkKCkpIHtcblx0XHRcdFx0Ly8gbm90IGhvdmVyaW5nIG92ZXIgb3VyIHdpZGdldFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5nZXRFZGl0b3JQb3NpdGlvbkZyb21Ob2RlKGUudGFyZ2V0LmVsZW1lbnQpO1xuXHRcdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0XHQvLyBub3QgaG92ZXJpbmcgYSBzdGlja3kgc2Nyb2xsIGxpbmVcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCAhdGhpcy5fc3RpY2t5UmFuZ2VQcm9qZWN0ZWRPbkVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY2FuZGlkYXRlRGVmaW5pdGlvbnNMZW5ndGggPiAxKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9mb2N1c2VkKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGlzcG9zZUZvY3VzU3RpY2t5U2Nyb2xsU3RvcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yZXZlYWxQb3NpdGlvbih7IGxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsIGNvbHVtbjogMSB9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2luc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihnb1RvRGVmaW5pdGlvbldpdGhMb2NhdGlvbiwgZSwgdGhpcy5fZWRpdG9yIGFzIElBY3RpdmVDb2RlRWRpdG9yLCB7IHVyaTogdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkudXJpLCByYW5nZTogdGhpcy5fc3RpY2t5UmFuZ2VQcm9qZWN0ZWRPbkVkaXRvciB9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkNvbnRleHRNZW51KHRhcmdldFdpbmRvdzogV2luZG93LCBlOiBNb3VzZUV2ZW50KSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KHRhcmdldFdpbmRvdywgZSk7XG5cblx0XHR0aGlzLl9jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdG1lbnVJZDogTWVudUlkLlN0aWNreVNjcm9sbENvbnRleHQsXG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGV2ZW50LFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Nb3VzZU1vdmVPcktleURvd24obW91c2VFdmVudDogS2V5Ym9hcmRFdmVudCB8IE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIW1vdXNlRXZlbnQuc2hpZnRLZXkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9tb3VzZVRhcmdldCB8fCAhZG9tLmlzSFRNTEVsZW1lbnQodGhpcy5fbW91c2VUYXJnZXQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRFbmRGb3JMaW5lSW5kZXggPSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZ2V0TGluZUluZGV4RnJvbUNoaWxkRG9tTm9kZSh0aGlzLl9tb3VzZVRhcmdldCk7XG5cdFx0aWYgKGN1cnJlbnRFbmRGb3JMaW5lSW5kZXggPT09IG51bGwgfHwgdGhpcy5fc2hvd0VuZEZvckxpbmUgPT09IGN1cnJlbnRFbmRGb3JMaW5lSW5kZXgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fc2hvd0VuZEZvckxpbmUgPSBjdXJyZW50RW5kRm9yTGluZUluZGV4O1xuXHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9nZ2xlRm9sZGluZ1JlZ2lvbkZvckxpbmUobGluZTogbnVtYmVyIHwgbnVsbCkge1xuXHRcdGlmICghdGhpcy5fZm9sZGluZ01vZGVsIHx8IGxpbmUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc3RpY2t5TGluZSA9IHRoaXMuX3N0aWNreVNjcm9sbFdpZGdldC5nZXRSZW5kZXJlZFN0aWNreUxpbmUobGluZSk7XG5cdFx0Y29uc3QgZm9sZGluZ0ljb24gPSBzdGlja3lMaW5lPy5mb2xkaW5nSWNvbjtcblx0XHRpZiAoIWZvbGRpbmdJY29uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRvZ2dsZUNvbGxhcHNlU3RhdGUodGhpcy5fZm9sZGluZ01vZGVsLCAxLCBbbGluZV0pO1xuXHRcdGZvbGRpbmdJY29uLmlzQ29sbGFwc2VkID0gIWZvbGRpbmdJY29uLmlzQ29sbGFwc2VkO1xuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IChmb2xkaW5nSWNvbi5pc0NvbGxhcHNlZCA/XG5cdFx0XHR0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihmb2xkaW5nSWNvbi5mb2xkaW5nRW5kTGluZSlcblx0XHRcdDogdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIoZm9sZGluZ0ljb24uZm9sZGluZ1N0YXJ0TGluZSkpXG5cdFx0XHQtIHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpICogc3RpY2t5TGluZS5pbmRleCArIDE7XG5cdFx0dGhpcy5fZWRpdG9yLnNldFNjcm9sbFRvcChzY3JvbGxUb3ApO1xuXHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbChsaW5lKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlYWRDb25maWd1cmF0aW9uKCkge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpO1xuXHRcdGlmIChvcHRpb25zLmVuYWJsZWQgPT09IGZhbHNlKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IucmVtb3ZlT3ZlcmxheVdpZGdldCh0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQpO1xuXHRcdFx0dGhpcy5fcmVzZXRTdGF0ZSgpO1xuXHRcdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9lbmFibGVkID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmIChvcHRpb25zLmVuYWJsZWQgJiYgIXRoaXMuX2VuYWJsZWQpIHtcblx0XHRcdC8vIFdoZW4gc3RpY2t5IHNjcm9sbCB3YXMganVzdCBlbmFibGVkLCBhZGQgdGhlIGxpc3RlbmVycyBvbiB0aGUgc3RpY2t5IHNjcm9sbFxuXHRcdFx0dGhpcy5fZWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0KTtcblx0XHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkU2Nyb2xsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLnNjcm9sbFRvcENoYW5nZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9zaG93RW5kRm9yTGluZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR0aGlzLl9yZW5kZXJTdGlja3lTY3JvbGwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRMYXlvdXRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRSZXNpemUoKSkpO1xuXHRcdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbFRva2VucygoZSkgPT4gdGhpcy5fb25Ub2tlbnNDaGFuZ2UoZSkpKTtcblx0XHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5hZGQodGhpcy5fc3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyLm9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fc2hvd0VuZEZvckxpbmUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZU51bWJlck9wdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVOdW1iZXJzKTtcblx0XHRpZiAobGluZU51bWJlck9wdGlvbi5yZW5kZXJUeXBlID09PSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuUmVsYXRpdmUpIHtcblx0XHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zaG93RW5kRm9yTGluZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fcmVuZGVyU3RpY2t5U2Nyb2xsKDApO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlYWRDb25maWd1cmF0aW9uQ2hhbmdlKGV2ZW50OiBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50KSB7XG5cdFx0aWYgKFxuXHRcdFx0ZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uc3RpY2t5U2Nyb2xsKVxuXHRcdFx0fHwgZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubWluaW1hcClcblx0XHRcdHx8IGV2ZW50Lmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpXG5cdFx0XHR8fCBldmVudC5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKVxuXHRcdFx0fHwgZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZU51bWJlcnMpXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9yZWFkQ29uZmlndXJhdGlvbigpO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5saW5lTnVtYmVycykgfHwgZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9sZGluZykgfHwgZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uc2hvd0ZvbGRpbmdDb250cm9scykpIHtcblx0XHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9uZWVkc1VwZGF0ZShldmVudDogSU1vZGVsVG9rZW5zQ2hhbmdlZEV2ZW50KSB7XG5cdFx0Y29uc3Qgc3RpY2t5TGluZU51bWJlcnMgPSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZ2V0Q3VycmVudExpbmVzKCk7XG5cdFx0Zm9yIChjb25zdCBzdGlja3lMaW5lTnVtYmVyIG9mIHN0aWNreUxpbmVOdW1iZXJzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIGV2ZW50LnJhbmdlcykge1xuXHRcdFx0XHRpZiAoc3RpY2t5TGluZU51bWJlciA+PSByYW5nZS5mcm9tTGluZU51bWJlciAmJiBzdGlja3lMaW5lTnVtYmVyIDw9IHJhbmdlLnRvTGluZU51bWJlcikge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX29uVG9rZW5zQ2hhbmdlKGV2ZW50OiBJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQpIHtcblx0XHRpZiAodGhpcy5fbmVlZHNVcGRhdGUoZXZlbnQpKSB7XG5cdFx0XHQvLyBSZWJ1aWxkaW5nIHRoZSB3aG9sZSB3aWRnZXQgZnJvbSBsaW5lIDBcblx0XHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZFJlc2l6ZSgpIHtcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gdGhpcy5fZWRpdG9yLmdldExheW91dEluZm8oKTtcblx0XHQvLyBNYWtlIHN1cmUgc3RpY2t5IHNjcm9sbCBkb2Vzbid0IHRha2UgdXAgbW9yZSB0aGFuIDI1JSBvZiB0aGUgZWRpdG9yXG5cdFx0Y29uc3QgdGhlb3JldGljYWxMaW5lcyA9IGxheW91dEluZm8uaGVpZ2h0IC8gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0dGhpcy5fbWF4U3RpY2t5TGluZXMgPSBNYXRoLnJvdW5kKHRoZW9yZXRpY2FsTGluZXMgKiAuMjUpO1xuXHRcdHRoaXMuX3JlbmRlclN0aWNreVNjcm9sbCgwKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlbmRlclN0aWNreVNjcm9sbChyZWJ1aWxkRnJvbUxpbmU/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwgfHwgbW9kZWwuaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpKSB7XG5cdFx0XHR0aGlzLl9yZXNldFN0YXRlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG5leHRSZWJ1aWxkRnJvbUxpbmUgPSB0aGlzLl91cGRhdGVBbmRHZXRNaW5SZWJ1aWxkRnJvbUxpbmUocmVidWlsZEZyb21MaW5lKTtcblx0XHRjb25zdCBzdGlja3lXaWRnZXRWZXJzaW9uID0gdGhpcy5fc3RpY2t5TGluZUNhbmRpZGF0ZVByb3ZpZGVyLmdldFZlcnNpb25JZCgpO1xuXHRcdGNvbnN0IHNob3VsZFVwZGF0ZVN0YXRlID0gc3RpY2t5V2lkZ2V0VmVyc2lvbiA9PT0gdW5kZWZpbmVkIHx8IHN0aWNreVdpZGdldFZlcnNpb24gPT09IG1vZGVsLmdldFZlcnNpb25JZCgpO1xuXHRcdGlmIChzaG91bGRVcGRhdGVTdGF0ZSkge1xuXHRcdFx0aWYgKCF0aGlzLl9mb2N1c2VkKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3VwZGF0ZVN0YXRlKG5leHRSZWJ1aWxkRnJvbUxpbmUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU3VwcG9zZSB0aGF0IHByZXZpb3VzbHkgdGhlIHN0aWNreSBzY3JvbGwgd2lkZ2V0IGhhZCBoZWlnaHQgMCwgdGhlbiBpZiB0aGVyZSBhcmUgdmlzaWJsZSBsaW5lcywgc2V0IHRoZSBsYXN0IGxpbmUgYXMgZm9jdXNlZFxuXHRcdFx0XHRpZiAodGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl91cGRhdGVTdGF0ZShuZXh0UmVidWlsZEZyb21MaW5lKTtcblx0XHRcdFx0XHR0aGlzLl9mb2N1c2VkU3RpY2t5RWxlbWVudEluZGV4ID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmxpbmVOdW1iZXJDb3VudCAtIDE7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZm9jdXNMaW5lV2l0aEluZGV4KHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBmb2N1c2VkU3RpY2t5RWxlbWVudExpbmVOdW1iZXIgPSB0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQubGluZU51bWJlcnNbdGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleF07XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fdXBkYXRlU3RhdGUobmV4dFJlYnVpbGRGcm9tTGluZSk7XG5cdFx0XHRcdFx0Ly8gU3VwcG9zZSB0aGF0IGFmdGVyIHNldHRpbmcgdGhlIHN0YXRlLCB0aGVyZSBhcmUgbm8gc3RpY2t5IGxpbmVzLCBzZXQgdGhlIGZvY3VzZWQgaW5kZXggdG8gLTFcblx0XHRcdFx0XHRpZiAodGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmxpbmVOdW1iZXJDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZm9jdXNlZFN0aWNreUVsZW1lbnRJbmRleCA9IC0xO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwcmV2aW91c0ZvY3VzZWRMaW5lTnVtYmVyRXhpc3RzID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmxpbmVOdW1iZXJzLmluY2x1ZGVzKGZvY3VzZWRTdGlja3lFbGVtZW50TGluZU51bWJlcik7XG5cblx0XHRcdFx0XHRcdC8vIElmIHRoZSBsaW5lIG51bWJlciBpcyBzdGlsbCB0aGVyZSwgZG8gbm90IGNoYW5nZSBhbnl0aGluZ1xuXHRcdFx0XHRcdFx0Ly8gSWYgdGhlIGxpbmUgbnVtYmVyIGlzIG5vdCB0aGVyZSwgc2V0IHRoZSBuZXcgZm9jdXNlZCBsaW5lIHRvIGJlIHRoZSBsYXN0IGxpbmVcblx0XHRcdFx0XHRcdGlmICghcHJldmlvdXNGb2N1c2VkTGluZU51bWJlckV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9mb2N1c2VkU3RpY2t5RWxlbWVudEluZGV4ID0gdGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LmxpbmVOdW1iZXJDb3VudCAtIDE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuZm9jdXNMaW5lV2l0aEluZGV4KHRoaXMuX2ZvY3VzZWRTdGlja3lFbGVtZW50SW5kZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUFuZEdldE1pblJlYnVpbGRGcm9tTGluZShyZWJ1aWxkRnJvbUxpbmU6IG51bWJlciB8IHVuZGVmaW5lZCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHJlYnVpbGRGcm9tTGluZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBtaW5SZWJ1aWxkRnJvbUxpbmVPckluZmluaXR5ID0gdGhpcy5fbWluUmVidWlsZEZyb21MaW5lICE9PSB1bmRlZmluZWQgPyB0aGlzLl9taW5SZWJ1aWxkRnJvbUxpbmUgOiBJbmZpbml0eTtcblx0XHRcdHRoaXMuX21pblJlYnVpbGRGcm9tTGluZSA9IE1hdGgubWluKHJlYnVpbGRGcm9tTGluZSwgbWluUmVidWlsZEZyb21MaW5lT3JJbmZpbml0eSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9taW5SZWJ1aWxkRnJvbUxpbmU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVTdGF0ZShyZWJ1aWxkRnJvbUxpbmU/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9taW5SZWJ1aWxkRnJvbUxpbmUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZm9sZGluZ01vZGVsID0gYXdhaXQgRm9sZGluZ0NvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik/LmdldEZvbGRpbmdNb2RlbCgpID8/IHVuZGVmaW5lZDtcblx0XHR0aGlzLl93aWRnZXRTdGF0ZSA9IHRoaXMuZmluZFNjcm9sbFdpZGdldFN0YXRlKCk7XG5cdFx0Y29uc3Qgc3RpY2t5V2lkZ2V0SGFzTGluZXMgPSB0aGlzLl93aWRnZXRTdGF0ZS5zdGFydExpbmVOdW1iZXJzLmxlbmd0aCA+IDA7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsVmlzaWJsZUNvbnRleHRLZXkuc2V0KHN0aWNreVdpZGdldEhhc0xpbmVzKTtcblx0XHR0aGlzLl9zdGlja3lTY3JvbGxXaWRnZXQuc2V0U3RhdGUodGhpcy5fd2lkZ2V0U3RhdGUsIHRoaXMuX2ZvbGRpbmdNb2RlbCwgcmVidWlsZEZyb21MaW5lKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc2V0U3RhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fbWluUmVidWlsZEZyb21MaW5lID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2ZvbGRpbmdNb2RlbCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl93aWRnZXRTdGF0ZSA9IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlLkVtcHR5O1xuXHRcdHRoaXMuX3N0aWNreVNjcm9sbFZpc2libGVDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0dGhpcy5fc3RpY2t5U2Nyb2xsV2lkZ2V0LnNldFN0YXRlKHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdGZpbmRTY3JvbGxXaWRnZXRTdGF0ZSgpOiBTdGlja3lTY3JvbGxXaWRnZXRTdGF0ZSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIFN0aWNreVNjcm9sbFdpZGdldFN0YXRlLkVtcHR5O1xuXHRcdH1cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBtYXhOdW1iZXJTdGlja3lMaW5lcyA9IE1hdGgubWluKHRoaXMuX21heFN0aWNreUxpbmVzLCB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpLm1heExpbmVDb3VudCk7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wOiBudW1iZXIgPSB0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsVG9wKCk7XG5cdFx0bGV0IGxhc3RMaW5lUmVsYXRpdmVQb3NpdGlvbjogbnVtYmVyID0gMDtcblx0XHRjb25zdCBzdGFydExpbmVOdW1iZXJzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGVuZExpbmVOdW1iZXJzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGFycmF5VmlzaWJsZVJhbmdlcyA9IHRoaXMuX2VkaXRvci5nZXRWaXNpYmxlUmFuZ2VzKCk7XG5cdFx0aWYgKGFycmF5VmlzaWJsZVJhbmdlcy5sZW5ndGggIT09IDApIHtcblx0XHRcdGNvbnN0IGZ1bGxWaXNpYmxlUmFuZ2UgPSBuZXcgU3RpY2t5UmFuZ2UoYXJyYXlWaXNpYmxlUmFuZ2VzWzBdLnN0YXJ0TGluZU51bWJlciwgYXJyYXlWaXNpYmxlUmFuZ2VzW2FycmF5VmlzaWJsZVJhbmdlcy5sZW5ndGggLSAxXS5lbmRMaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZVJhbmdlcyA9IHRoaXMuX3N0aWNreUxpbmVDYW5kaWRhdGVQcm92aWRlci5nZXRDYW5kaWRhdGVTdGlja3lMaW5lc0ludGVyc2VjdGluZyhmdWxsVmlzaWJsZVJhbmdlKTtcblx0XHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgY2FuZGlkYXRlUmFuZ2VzKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0ID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBlbmQgPSByYW5nZS5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBpc1ZhbGlkUmFuZ2UgPSB0ZXh0TW9kZWwuaXNWYWxpZFJhbmdlKHsgc3RhcnRMaW5lTnVtYmVyOiBzdGFydCwgZW5kTGluZU51bWJlcjogZW5kLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAxIH0pO1xuXHRcdFx0XHRpZiAoaXNWYWxpZFJhbmdlICYmIGVuZCAtIHN0YXJ0ID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IHRvcE9mRWxlbWVudCA9IHJhbmdlLnRvcDtcblx0XHRcdFx0XHRjb25zdCBib3R0b21PZkVsZW1lbnQgPSB0b3BPZkVsZW1lbnQgKyByYW5nZS5oZWlnaHQ7XG5cdFx0XHRcdFx0Y29uc3QgdG9wT2ZCZWdpbm5pbmdMaW5lID0gdGhpcy5fZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIoc3RhcnQpIC0gc2Nyb2xsVG9wO1xuXHRcdFx0XHRcdGNvbnN0IGJvdHRvbU9mRW5kTGluZSA9IHRoaXMuX2VkaXRvci5nZXRCb3R0b21Gb3JMaW5lTnVtYmVyKGVuZCkgLSBzY3JvbGxUb3A7XG5cdFx0XHRcdFx0aWYgKHRvcE9mRWxlbWVudCA+IHRvcE9mQmVnaW5uaW5nTGluZSAmJiB0b3BPZkVsZW1lbnQgPD0gYm90dG9tT2ZFbmRMaW5lKSB7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXJzLnB1c2goc3RhcnQpO1xuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcnMucHVzaChlbmQgKyAxKTtcblx0XHRcdFx0XHRcdGlmIChib3R0b21PZkVsZW1lbnQgPiBib3R0b21PZkVuZExpbmUpIHtcblx0XHRcdFx0XHRcdFx0bGFzdExpbmVSZWxhdGl2ZVBvc2l0aW9uID0gYm90dG9tT2ZFbmRMaW5lIC0gYm90dG9tT2ZFbGVtZW50O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RhcnRMaW5lTnVtYmVycy5sZW5ndGggPT09IG1heE51bWJlclN0aWNreUxpbmVzKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fZW5kTGluZU51bWJlcnMgPSBlbmRMaW5lTnVtYmVycztcblx0XHRyZXR1cm4gbmV3IFN0aWNreVNjcm9sbFdpZGdldFN0YXRlKHN0YXJ0TGluZU51bWJlcnMsIGVuZExpbmVOdW1iZXJzLCBsYXN0TGluZVJlbGF0aXZlUG9zaXRpb24sIHRoaXMuX3Nob3dFbmRGb3JMaW5lKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBeUMsdUJBQXVCO0FBQ2hFLFNBQThCLGtCQUFrQjtBQUNoRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGNBQWMsNkJBQXdEO0FBQy9FLFNBQVMsb0JBQW9CLCtCQUErQjtBQUM1RCxTQUF1QyxtQ0FBbUM7QUFFMUUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUE2QztBQUN0RCxTQUFpQixhQUFhO0FBQzlC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
